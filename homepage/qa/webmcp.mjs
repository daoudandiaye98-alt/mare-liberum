// The page's forms as tools for an agent (WebMCP): what Chrome itself lists, and what an invoked tool hands back.
// A form with toolname and tooldescription is a tool; its fields are the parameters (name, required,
// toolparamdescription); toolautosubmit lets the browser submit it. The page answers twice: on the page for the person
// looking, and through SubmitEvent.respondWith for the agent. Chrome keeps WebMCP behind a switch for now
// (--enable-features=WebMCP); a browser without it ignores the attributes.
//   node qa/webmcp.mjs --url=http://localhost:8787/ [--site=example.com]
// Reports the tools with their schemas, anything the browser objects to, and one call of each tool.
import { chromium } from 'playwright-core';
import { CHROME, proofUA } from './_browser.mjs';
const a = Object.fromEntries(process.argv.slice(2).map((s) => { const [k, ...v] = s.replace(/^--/, '').split('='); return [k, v.join('=') || '1']; }));
const url = a.url || 'http://localhost:8787/', sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ ...CHROME, args: [...CHROME.args, '--enable-features=WebMCP'], ...(/^https:/.test(url) && process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY } } : {}) });
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, userAgent: proofUA(b) }), p = await ctx.newPage(), errors = [];
p.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
const cdp = await ctx.newCDPSession(p), tools = [], responded = [], issues = [];
cdp.on('WebMCP.toolsAdded', (e) => tools.push(...(e.tools || [])));
cdp.on('WebMCP.toolResponded', (e) => responded.push(e));
cdp.on('Audits.issueAdded', (e) => { const s = JSON.stringify(e.issue); if (/ModelContext|WebMCP/i.test(s)) issues.push(s.slice(0, 300)); });
const out = { url, chrome: b.version() };
try { await cdp.send('Audits.enable'); await cdp.send('WebMCP.enable'); } catch (e) { out.unsupported = String(e.message).split('\n')[0]; }
await p.goto(url, { waitUntil: 'load' }); await sleep(1500);
out.api = await p.evaluate(() => ({ modelContext: typeof document.modelContext !== 'undefined' || typeof navigator.modelContext !== 'undefined', submitEvent: ['agentInvoked', 'respondWith'].filter((k) => k in SubmitEvent.prototype) }));
out.forms = await p.evaluate(() => [...document.forms].map((f) => ({ id: f.id, toolname: f.getAttribute('toolname'), described: !!f.getAttribute('tooldescription'), fields: [...f.elements].filter((x) => x.name).map((x) => ({ name: x.name, required: x.required, described: !!x.getAttribute('toolparamdescription') })) })));
out.tools = tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema, annotations: t.annotations, declarative: typeof t.backendNodeId === 'number' }));
out.issues = issues;
out.calls = [];
const shows = { find_in_sea: '#findr', ask_brain: '#askr', check_site: '#checkr' };
for (const [toolName, input] of [['find_in_sea', { q: 'ClaudeBot' }], ['ask_brain', { q: 'running shoes' }], ['check_site', { site: a.site || 'wikipedia.org' }]]) {
  const t = tools.find((x) => x.name === toolName); if (!t) { out.calls.push({ tool: toolName, missing: true }); continue; }
  const n = responded.length, t0 = Date.now();
  try { await cdp.send('WebMCP.invokeTool', { frameId: t.frameId, toolName, input }); } catch (e) { out.calls.push({ tool: toolName, refused: String(e.message).split('\n')[0] }); continue; }
  for (let i = 0; i < 160 && responded.length === n; i++) await sleep(250);
  const r = responded[n], text = r && (typeof r.output === 'string' ? r.output : JSON.stringify(r.output ?? null));
  let keys = null; try { keys = Object.keys(JSON.parse(text)); } catch {}
  out.calls.push({ tool: toolName, input, status: r ? r.status : 'no answer in 40 s', ms: Date.now() - t0, error: r?.errorText || undefined, bytes: text ? text.length : 0, keys, onThePage: await p.evaluate((sel) => (document.querySelector(sel)?.innerText || '').replace(/\s+/g, ' ').slice(0, 90), shows[toolName]) });
}
out.errors = errors;
console.log(JSON.stringify(out, null, 1));
await b.close();
