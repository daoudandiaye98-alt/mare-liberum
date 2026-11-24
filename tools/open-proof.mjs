// Mare Liberum · proof of the open numbers: /open with every live number, the number to steer by (foreign working
// sessions a day), the ledger of what was spared (measured and modelled, one rule from bytes to tokens, worth in USD),
// Markdown for assistants reading for a person (and the switch that rests it), the tool calls of the open MCP door, the
// files to take home, the Dataset markup, and the home page with its counter, built from its sources.
// Runs without the network: node tools/open-proof.mjs   (exit code 1 when a proof fails)
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { handle, headline, VERSION, mdForAgent } from '../node/core.mjs';
import { memoryKv } from '../node/flow.mjs';
import { createMem, hayOf, metaOf } from '../node/mem.mjs';
import { createLedger } from '../node/ledger.mjs';
import { payConfig } from '../node/pay.mjs';
import { immune } from '../node/immune.mjs';
import { KIND_ORDER } from '../node/gauge.mjs';
import { tokensOfBytes, TOKEN_RATIO, TOKEN_ASSUMED, MEASURED_UNIT, TOKEN_PRICE, savingsOf, measuredOf } from '../node/areas.mjs';
import { TOKEN_RATIO as PROOF_RATIO } from '../node/proof.mjs';
import { clientFamily, DATASET_NEEDS, ENDPOINTS, exampleOf, VISIT_KINDS, FAMILIES, RELEASES } from '../node/open.mjs';
import { formLines, pageMarkdown } from '../node/agentmd.mjs';

let passed = 0, failed = 0;
const proof = async (name, fn) => { try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 5).join('\n       ')}`); } };
globalThis.fetch = async (u) => { throw new Error(`the proof does not use the network: ${String(u).slice(0, 80)}`); };
const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const ROOT = new URL('..', import.meta.url).pathname;

// ------------------------------------------------------------------ a small sea with the real home page and guide
const dir = mkdtempSync(join(tmpdir(), 'mare-open-')), file = join(dir, 'sea.tsv');
const rows = [{ id: 'urn:air:example.com:mcp:weather', display_name: 'Weather MCP', type: 'application/mcp-server-card+json', url: 'https://example.com/mcp', kind: 'mcp', source: 'mcp-registry', publisher: 'example.com', attested_by: 'domain', endpoints: [{ transport: 'streamable-http', url: 'https://example.com/mcp' }], capabilities: [], tags: ['mcp', 'weather'], description: 'Weather forecasts for agents' }];
writeFileSync(file, rows.map((r) => `${r.id}\t${metaOf(r)}\t${hayOf(r)}\t${JSON.stringify(r)}`).sort().join('\n') + '\n');
writeFileSync(join(dir, 'build.json'), JSON.stringify({ builtAt: '2026-11-20T10:00:00.000Z', entries: rows.length, lakes: { 'mcp-registry': 1 } }));
const BASE = 'https://mare.test', db = createMem({ file, base: BASE }), ledger = createLedger({}), kv = memoryKv();
const read = (f) => readFileSync(new URL(`../site/${f}`, import.meta.url), 'utf8');
const SITE = { '/': { body: read('index.html'), type: 'text/html; charset=utf-8' }, '/llms.txt': { body: read('llms.txt'), type: 'text/plain; charset=utf-8' }, '/robots.txt': { body: read('robots.txt'), type: 'text/plain; charset=utf-8' } };
const cfg = { base: BASE, pay: payConfig({}), ledger, kv, site: SITE, openMemoMs: 0 };
immune.use({ every: 0, kv, base: BASE, store: null }); immune.set({});
let ipN = 1; const IPS = [];
const BROWSER = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';
const call = async (path, { accept = BROWSER, ua = 'proof-agent/1.0', method = 'GET', body, headers = {} } = {}) => {
  const ip = `198.18.7.${ipN++ % 250}`; IPS.push(ip);
  const res = await handle(new Request(BASE + path, { method, headers: { accept, 'user-agent': ua, 'content-type': 'application/json', 'x-forwarded-for': ip, ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) }), db, cfg);
  return { status: res.status, headers: res.headers, text: await res.text() };
};
const mcp = async (path, msg, ua = 'proof-mcp/1.0', headers = {}) => call(path, { method: 'POST', accept: 'application/json, text/event-stream', ua, body: msg, headers });
const sea = () => db.flow;
const UA = {
  chatgpt: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot',
  claude: 'Claude-User (+https://support.anthropic.com/)', claudeCode: 'Claude-User (claude-code/2.0.14; +https://support.anthropic.com/)',
  perplexity: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)', mistral: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; MistralAI-User/1.0; +https://docs.mistral.ai/robots)',
  googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', bingbot: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  oaiSearch: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot', claudeSearch: 'Claude-SearchBot/1.0 (+https://www.anthropic.com)', perplexityBot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
  gptbot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot', claudebot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ClaudeBot/1.0; +claudebot@anthropic.com',
  browser: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36', own: 'MareLiberum-session/1.0',
};
const counts = async () => (await sea().savings()).today.counts;

// a tiny XML reader: every tag closes in order, attributes are quoted, & only starts an entity, nothing stray
function wellFormed(xml) {
  const s = String(xml).replace(/^<\?xml[^>]*\?>/, '').replace(/<!--[\s\S]*?-->/g, ''), stack = [];
  const tag = /<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[A-Za-z_:][\w:.-]*\s*=\s*(?:"[^"<]*"|'[^'<]*'))*)\s*(\/?)>/g;
  let at = 0, m;
  while ((m = tag.exec(s))) {
    const text = s.slice(at, m.index); if (/[<>]/.test(text)) throw new Error(`stray markup near ${text.slice(0, 40)}`);
    if (/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);)/i.test(text + m[3])) throw new Error(`a bare & near ${(text + m[3]).slice(0, 60)}`);
    if (m[1]) { if (stack.pop() !== m[2]) throw new Error(`</${m[2]}> closes the wrong tag`); } else if (!m[4]) stack.push(m[2]);
    at = tag.lastIndex;
  }
  if (/[<>]/.test(s.slice(at))) throw new Error('stray markup at the end');
  if (stack.length) throw new Error(`unclosed: ${stack.join(', ')}`);
  return true;
}
const ldOf = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
const datasetsOf = (html) => ldOf(html).flatMap((x) => x['@graph'] || [x]).filter((x) => x['@type'] === 'Dataset');
const checkDataset = (d, files) => {
  for (const k of DATASET_NEEDS) assert.ok(d[k] != null && d[k] !== '', `Dataset needs ${k}`);
  assert.ok(d.description.length >= 50 && d.description.length <= 5000, `description of 50 to 5,000 characters: ${d.description.length}`);
  assert.equal(d.creator['@type'], 'Organization'); assert.equal(d.creator.name, 'Mare Liberum'); assert.equal(d.creator.url, BASE);
  assert.match(d.url, /^https:\/\//); assert.match(d.license, /^https:\/\/creativecommons\.org\//); assert.equal(d.isAccessibleForFree, true); assert.match(d.dateModified, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(Array.isArray(d.distribution) && d.distribution.length === files.length);
  for (const [type, path] of files) assert.ok(d.distribution.some((x) => x['@type'] === 'DataDownload' && x.encodingFormat === type && x.contentUrl === `${BASE}${path}`), `${type} ${path}`);
};

console.log('one rule from bytes to tokens, and what tokens are worth');
await proof('every count turns into tokens through tokensOfBytes, with the ratio the proof of function measured for its form and its unit; 4 bytes a token stays only as the fallback', () => {
  // 3.33.0: the ratio is the one node/proof.mjs measured (o200k_base), never a second number written here
  assert.equal(TOKEN_RATIO.assumption, false); assert.equal(TOKEN_RATIO.tokenizer, PROOF_RATIO.tokenizer);
  assert.equal(TOKEN_RATIO.html, PROOF_RATIO.html); assert.equal(TOKEN_RATIO.md, PROOF_RATIO.markdown); assert.equal(TOKEN_RATIO.text, PROOF_RATIO.text);
  assert.equal(TOKEN_RATIO.bytes.html, PROOF_RATIO.bytes.html); assert.equal(TOKEN_RATIO.bytes.md, PROOF_RATIO.bytes.markdown);
  assert.equal(tokensOfBytes('html', Math.round(PROOF_RATIO.html * 1000), 'chars'), 1000); assert.equal(tokensOfBytes('md', Math.round(PROOF_RATIO.markdown * 1000), 'chars'), 1000);
  assert.equal(tokensOfBytes('html', Math.round(PROOF_RATIO.bytes.html * 1000)), 1000, 'bytes is the default unit'); assert.equal(tokensOfBytes('md', Math.round(PROOF_RATIO.bytes.markdown * 1000), 'bytes'), 1000);
  assert.equal(tokensOfBytes('md', 0), 0); assert.equal(tokensOfBytes('nonsense', Math.round(PROOF_RATIO.bytes.text * 100)), 100, 'an unknown form counts as plain text');
  assert.match(TOKEN_RATIO.source.url, /\/proof$/); assert.match(TOKEN_RATIO.basis, /measured/);
  // what each kind counts in: UTF-8 bytes for pages of the sea, characters for the reader and for counts from before 3.33.0
  assert.deepEqual(MEASURED_UNIT, { md: 'bytes', mdAgent: 'bytes', read: 'chars', before: 'chars' });
  const core = readFileSync(new URL('../node/core.mjs', import.meta.url), 'utf8'), lens = readFileSync(new URL('../node/lens.mjs', import.meta.url), 'utf8');
  assert.match(core, /spared\(agent \? 'mdAgent' : 'md'\)\(bytesOf\(page\)/, 'the front page counts UTF-8 bytes'); assert.match(lens, /countBytes\?\.\('read', r\.htmlBytes, r\.markdown\.length/, 'the reader counts characters');
  // the assumption of 3.32.0 is kept, labelled, as the fallback only
  assert.equal(TOKEN_ASSUMED.assumption, true); assert.equal(TOKEN_ASSUMED.html, 4); assert.match(TOKEN_ASSUMED.source.url, /^https:\/\/platform\.claude\.com\//); assert.equal(TOKEN_RATIO.fallback.html, 4);
  const src = readFileSync(new URL('../node/areas.mjs', import.meta.url), 'utf8'), open = readFileSync(new URL('../node/open.mjs', import.meta.url), 'utf8');
  assert.equal((src.match(/\/ SAVE\.bytesPerToken|bytesPerToken\)|bytesPerToken: 4/g) || []).length, 0, 'no second rule from bytes to tokens');
  assert.doesNotMatch(open, /\/ 4\b/, 'the open numbers use the one rule as well');
});
await proof('measured counts the HTML stood in for and the Markdown sent, each with its own ratio and unit; counts from before 3.33.0 (only the difference) still count, as Markdown in characters', () => {
  const t = (b, r) => Math.round(b / r);
  assert.equal(measuredOf({ mdAgentHtml: 40000, mdAgentOut: 8000, mdAgentBytes: 32000 }, 'mdAgent'), t(40000, PROOF_RATIO.bytes.html) - t(8000, PROOF_RATIO.bytes.markdown));
  assert.equal(measuredOf({ readHtml: 32200, readOut: 3580, readBytes: 28620 }, 'read'), t(32200, PROOF_RATIO.html) - t(3580, PROOF_RATIO.markdown), 'the reader in characters');
  assert.equal(measuredOf({ mdBytes: 4000 }, 'md'), t(4000, PROOF_RATIO.markdown), 'the difference alone, as before');
  const s = savingsOf({ path: 2, plan: 1, market: 1, readBytes: 4000, mdBytes: 4000 }), m = 2 * t(4000, PROOF_RATIO.markdown);
  assert.equal(s.tokens.measured, m); assert.equal(s.tokens.mid, 2 * 15000 + 5000 + 20000 + m);
});
await proof('worth: a million tokens are $0.10, $2 and $8 at list prices for input tokens, each band with official sources', () => {
  // a million tokens of HTML spared outright: the bytes the measured HTML ratio makes a million tokens of
  const b = Math.round(PROOF_RATIO.bytes.html * 1_000_000), s = savingsOf({ mdAgentHtml: b, mdAgentOut: 0, mdAgentBytes: b });
  assert.equal(s.tokens.measured, 1_000_000); assert.deepEqual([s.usd.low, s.usd.mid, s.usd.high], [0.1, 2, 8]); assert.deepEqual([s.usd.measuredLow, s.usd.measuredMid, s.usd.measuredHigh], [0.1, 2, 8]);
  assert.deepEqual([TOKEN_PRICE.low, TOKEN_PRICE.mid, TOKEN_PRICE.high], [0.1, 2, 8]);
  for (const host of ['platform.claude.com', 'developers.openai.com', 'ai.google.dev']) assert.ok(TOKEN_PRICE.sources.some((x) => new URL(x.url).hostname === host), host);
  assert.deepEqual(s.wh, { low: 0, mid: 0, high: 0 }, 'Markdown spares tokens; no energy is claimed for it');
});

console.log('Markdown for assistants reading for a person');
await proof('ChatGPT-User, Claude-User, Claude Code, Perplexity-User and MistralAI-User get the Markdown twin of a page: type, Vary and the HTML as alternate', async () => {
  for (const [name, ua] of [['chatgpt', UA.chatgpt], ['claude', UA.claude], ['claude code', UA.claudeCode], ['perplexity', UA.perplexity], ['mistral', UA.mistral]]) {
    const r = await call('/savings', { ua });
    assert.equal(r.status, 200, name); assert.equal(r.headers.get('content-type'), 'text/markdown; charset=utf-8', name); assert.equal(r.headers.get('vary'), 'User-Agent, Accept', name);
    assert.ok(r.headers.get('link').includes(`<${BASE}/savings>; rel="alternate"; type="text/html"`), `${name}: ${r.headers.get('link')}`);
    assert.match(r.text, /^# What the shared brain saves/, name); assert.doesNotMatch(r.text, /<(html|head|script|style|svg|div)\b/i, name);
  }
});
await proof('search engines, AI search, training crawlers and browsers get HTML that says it varies with User-Agent; nothing is counted for them', async () => {
  const before = (await counts()).mdAgent || 0;
  for (const [name, ua] of Object.entries({ googlebot: UA.googlebot, bingbot: UA.bingbot, oaiSearch: UA.oaiSearch, claudeSearch: UA.claudeSearch, perplexityBot: UA.perplexityBot, gptbot: UA.gptbot, claudebot: UA.claudebot, browser: UA.browser, own: UA.own })) {
    const r = await call('/savings', { ua }); assert.match(r.headers.get('content-type'), /^text\/html/, name); assert.match(r.text, /^<!doctype html>/i, name);
    assert.match(r.headers.get('vary'), /accept/i, name); assert.match(r.headers.get('vary'), /user-agent/i, name);
  }
  assert.equal((await counts()).mdAgent || 0, before);
});
await proof('what an assistant was spared counts as measured, kind md-agent, with the door it came through and the bytes of both forms', async () => {
  const before = await counts(); await call('/brain/areas', { ua: UA.chatgpt }); const after = await counts();
  assert.equal((after.mdAgent || 0) - (before.mdAgent || 0), 1); assert.ok(after.mdAgentHtml - (before.mdAgentHtml || 0) > after.mdAgentOut - (before.mdAgentOut || 0));
  const s = await sea().savings(); assert.ok(s.byKind.all.find((x) => x.kind === 'md-agent').tokens > 0); assert.ok(s.byDoor.all.some((d) => d.door === '/brain' && d.measured > 0), JSON.stringify(s.byDoor.all));
  const measuredKinds = s.byKind.all.filter((x) => x.how === 'measured').reduce((t, x) => t + x.tokens, 0), measuredDoors = s.byDoor.all.reduce((t, d) => t + d.measured, 0);
  assert.ok(Math.abs(measuredDoors - measuredKinds) <= 2 * s.byDoor.all.length, `the doors add up to the kinds, but for rounding: ${measuredDoors} against ${measuredKinds}`); assert.equal(s.byDoor.all.reduce((t, d) => t + d.answers, 0), s.all.markdown);
});
await proof('the front page goes to an assistant as the guide for agents with the live numbers under its title; /index.md and Accept: text/markdown keep their headers', async () => {
  const a = await call('/', { ua: UA.claude }); assert.equal(a.headers.get('content-type'), 'text/markdown; charset=utf-8'); assert.equal(a.headers.get('vary'), 'User-Agent, Accept');
  assert.match(a.text, /^# Mare Liberum · the first stop for agents/); assert.match(a.text, /^Live, counted \d\d:\d\d UTC: .* tokens spared for agents so far \(measured .*, modelled .*\) · version /m); assert.match(a.headers.get('link'), /rel="alternate"; type="text\/html"/);
  const m = await call('/', { accept: 'text/markdown' }); assert.equal(m.headers.get('link'), `<${BASE}/>; rel="canonical"`); assert.equal(m.headers.get('vary'), 'accept');
  const t = await call('/index.md'); assert.equal(t.headers.get('x-robots-tag'), 'noindex, follow'); assert.match(t.text, /^# Mare Liberum · the first stop/);
});
await proof('the operator rests it without a release: "md-agents" in rest of immune:policy, and assistants get HTML again', async () => {
  immune.set({ mode: 'normal', rest: ['md-agents'] });
  try { const r = await call('/savings', { ua: UA.chatgpt }); assert.match(r.headers.get('content-type'), /^text\/html/); const f = await call('/', { ua: UA.claude }); assert.match(f.headers.get('content-type'), /^text\/html/); }
  finally { immune.set({ mode: 'normal', rest: [] }); }
  assert.equal((await call('/savings', { ua: UA.chatgpt })).headers.get('content-type'), 'text/markdown; charset=utf-8');
});
await proof('a page that would lose what an assistant needs keeps it: a form becomes one line with its address and fields; lists of links stay; via addresses stay as they are', async () => {
  const html = '<main><h1>Check</h1><form action="/check" method="get"><label for="cq">Website</label><input id="cq" name="site"><input type="hidden" name="src" value="md"><button>Go</button></form><form id="js" class="box"><input name="x"></form><ul><li><a href="/a">A</a></li><li><a href="/b">B</a></li><li><a href="/c">C</a></li></ul></main>';
  const { md } = pageMarkdown(`<html><head><title>Check</title></head><body>${html}</body></html>`, `${BASE}/check`, BASE);
  assert.match(md, /Form: `GET https:\/\/mare\.test\/check\?site=<Website>&src=md`/); assert.equal((md.match(/Form:/g) || []).length, 1, 'a form worked by a script is left alone');
  for (const x of ['[A](https://mare.test/a)', '[B](https://mare.test/b)', '[C](https://mare.test/c)']) assert.ok(md.includes(x), x);
  assert.match(formLines('<form action="/review" method="post"><textarea name="draft" placeholder="your draft"></textarea></form>', BASE), /POST https:\/\/mare\.test\/review with draft=&lt;your draft&gt;/);
  const check = await call('/check', { ua: UA.chatgpt }); assert.match(check.text, /Form: `GET https:\/\/mare\.test\/check\?site=<Website>`/);
  assert.equal(mdForAgent('/via/abc'), false); assert.equal(mdForAgent('/brain/areas'), true);
});

console.log('the number to steer by: foreign working sessions');
await proof('a tool called at /mcp or /mcp/app, an A2A message with a task and a task over HTTP each open one session a caller and day, by client family', async () => {
  const w0 = (await sea().workDays(1)).days[0].sessions;
  const ip = '203.0.113.21', init = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', clientInfo: { name: 'claude-code' } } }, tool = { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'stats', arguments: {} } };
  const same = { 'x-forwarded-for': ip };
  await mcp('/mcp', init, 'node', same); await mcp('/mcp', tool, 'node', same); await mcp('/mcp', tool, 'node', same);
  await mcp('/mcp/app', tool, 'Claude-User', { 'x-forwarded-for': '203.0.113.22' });
  await mcp('/mcp', tool, 'openai-mcp/1.0.0', { 'x-forwarded-for': '203.0.113.23' });
  await mcp('/mcp', tool, 'Cursor/1.7', { 'x-forwarded-for': '203.0.113.24', 'mcp-session-id': 'cursor-session-1' }); await mcp('/mcp', tool, 'Cursor/1.7', { 'x-forwarded-for': '203.0.113.25', 'mcp-session-id': 'cursor-session-2' });
  await call('/a2a', { method: 'POST', ua: 'some-a2a-agent/1.0', body: { jsonrpc: '2.0', id: 1, method: 'message/send', params: { message: { role: 'user', parts: [{ kind: 'text', text: 'find running shoes' }] } } }, headers: { 'x-forwarded-for': '203.0.113.26' } });
  await call('/brain?q=weather+in+berlin', { accept: '*/*', ua: 'python-requests/2.31', headers: { 'x-forwarded-for': '203.0.113.27' } });
  await call('/ask', { method: 'POST', accept: 'application/json', ua: 'my-agent/1.0', body: { need: 'running shoes size 44' }, headers: { 'x-forwarded-for': '203.0.113.28' } });
  const d = (await sea().workDays(1)).days[0];
  assert.equal(d.sessions - w0, 8, JSON.stringify(d));
  assert.ok(d.families['claude-code'] >= 1 && d.families['claude-ai'] >= 1 && d.families.chatgpt >= 1 && d.families.cursor >= 2, JSON.stringify(d.families));
  assert.ok(d.doors.mcp >= 4 && d.doors.app >= 1 && d.doors.a2a >= 1 && d.doors.http >= 2, JSON.stringify(d.doors));
});
await proof('never a session: the sea itself, crawlers, a person in a browser, a registry, the house agent, a proof client, a checker that only connects and lists, a call without a task', async () => {
  const w0 = (await sea().workDays(1)).days[0].sessions, tool = { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'stats', arguments: {} } };
  await mcp('/mcp', tool, UA.own, { 'x-forwarded-for': '203.0.113.31' }); await mcp('/mcp', tool, UA.gptbot, { 'x-forwarded-for': '203.0.113.32' });
  await mcp('/mcp', { jsonrpc: '2.0', id: 1, method: 'initialize', params: { clientInfo: { name: 'registry-checker' } } }, 'checker/1.0', { 'x-forwarded-for': '203.0.113.33' }); await mcp('/mcp', { jsonrpc: '2.0', id: 3, method: 'tools/list' }, 'checker/1.0', { 'x-forwarded-for': '203.0.113.33' });
  await mcp('/mcp', { jsonrpc: '2.0', id: 1, method: 'initialize', params: { clientInfo: { name: 'mare-proof' } } }, 'node', { 'x-forwarded-for': '203.0.113.34' }); await mcp('/mcp', tool, 'node', { 'x-forwarded-for': '203.0.113.34' });
  await mcp('/mcp', tool, 'Neuronto-Registry/1.0', { 'x-forwarded-for': '203.0.113.35' });
  await call('/brain?q=weather', { ua: 'Angel/1.0', accept: '*/*', headers: { 'x-forwarded-for': '203.0.113.36' } });
  await call('/brain?q=weather', { ua: UA.browser, headers: { 'sec-fetch-mode': 'navigate', 'x-forwarded-for': '203.0.113.37' } });
  await call('/brain', { ua: 'python-requests/2.31', accept: '*/*', headers: { 'x-forwarded-for': '203.0.113.38' } });
  await call('/brain?q=weather', { ua: UA.claudebot, accept: '*/*', headers: { 'x-forwarded-for': '203.0.113.39' } });
  assert.equal((await sea().workDays(1)).days[0].sessions, w0);
});
await proof('only counts are written: the tide keeps work:<day> with numbers, no key, no address, no session id', async () => {
  await sea().flushOpen(); const day = new Date().toISOString().slice(0, 10), kept = await kv.get(`work:${day}`);
  assert.ok(kept.sessions >= 8); for (const [k, v] of Object.entries(kept)) { assert.equal(typeof v, 'number', k); assert.match(k, /^(sessions|f:[a-z-]+|d:(mcp|app|a2a|http))$/, k); }
  const all = JSON.stringify(kept); for (const x of ['203.0.113', 'cursor-session', '198.18.']) assert.ok(!all.includes(x), x);
  assert.equal(await kv.get('work:since'), day);
  assert.equal(clientFamily('Anthropic/ClaudeAI'), 'claude-ai'); assert.equal(clientFamily('cursor-vscode'), 'cursor'); assert.equal(clientFamily(null, 'Visual Studio Code/1.95'), 'vscode'); assert.equal(clientFamily(null, 'ChatGPT-User/1.0'), 'chatgpt'); assert.equal(clientFamily('weird'), 'other');
  assert.equal(FAMILIES.length, 6);
});

console.log('the tool calls of the open MCP door');
await proof('each tool call at /mcp counts under its tool, per day; the sea\'s own calls, crawlers and the app door do not', async () => {
  const day = () => sea().mcpTools(1).then((x) => x.days[0].tools);
  const before = await day(), call1 = (name, ua, path = '/mcp', ip) => mcp(path, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: { q: 'weather', query: 'weather' } } }, ua, ip ? { 'x-forwarded-for': ip } : {});
  await call1('think', 'Cursor/1.7'); await call1('think', 'Cursor/1.7'); await call1('search', 'Cursor/1.7');
  await mcp('/mcp', [{ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'stats', arguments: {} } }, { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'no_such_tool', arguments: {} } }], 'Cursor/1.7');
  await call1('stats', UA.own); await call1('stats', UA.gptbot); await call1('stats', 'Claude-User', '/mcp/app');
  const after = await day(), d = (k) => (after[k] || 0) - (before[k] || 0);
  assert.equal(d('think'), 2); assert.equal(d('search'), 1); assert.equal(d('stats'), 1); assert.equal(d('(no such tool)'), 1); assert.equal(d('no_such_tool'), 0);
});
await proof('the sea\'s own tool calls at /mcp, /mcp/app and in a batch count nowhere: no ask in the brain\'s stats, no reuse, no walk; the same call from a foreign client counts (3.33.0)', async () => {
  const q = 'fact check a claim about creatine', kvStats = async () => (await kv.get('brain:stats')) || {};
  // a confirmed path for the task, laid and rated by foreign agents, so that think hands out a solved part (a reuse)
  await sea().layPath({ q, to: 'https://pubmed.ncbi.nlm.nih.gov/', title: 'PubMed' }, { ip: '198.18.9.8' });
  const id = (await sea().findPaths(q, 1))[0].id; await sea().rate(id, { worked: 1 }, { ip: '198.18.9.9' });
  const think = (ua, path = '/mcp', n = 1) => mcp(path, n > 1 ? Array.from({ length: n }, (_, i) => ({ jsonrpc: '2.0', id: i + 1, method: 'tools/call', params: { name: 'think', arguments: { q } } })) : { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'think', arguments: { q } } }, ua);
  const rate = (ua) => mcp('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'rate_path', arguments: { id, outcome: 'worked' } } }, ua);
  const asks0 = (await kvStats()).asks || 0, path0 = (await counts()).path || 0, walks0 = (await sea().findPaths(q, 1))[0].worked || 0;
  for (const r of [await think(UA.own), await think(UA.own, '/mcp/app'), await think(UA.own, '/mcp', 2)]) { assert.equal(r.status, 200); assert.doesNotMatch(r.text, /"isError":true/); }
  const rOwn = JSON.parse((await rate(UA.own)).text); assert.match(rOwn.result.content[0].text, /the sea's own calls are not counted/);
  assert.equal((await kvStats()).asks || 0, asks0, 'own think: no ask in the brain\'s stats');
  assert.equal((await counts()).path || 0, path0, 'own think: no reuse in the ledger');
  assert.equal((await sea().findPaths(q, 1))[0].worked || 0, walks0, 'own rate_path: the path is not strengthened');
  // the same call from outside counts once each
  await think('Cursor/1.7'); assert.equal((await kvStats()).asks || 0, asks0 + 1, 'a foreign think is an ask'); assert.equal((await counts()).path || 0, path0 + 1, 'a foreign think that hands out a confirmed path is a reuse');
});
await proof('/mcp/app stays byte for byte what it was: initialize (but for the version) and tools/list as in 3.32.0', async () => {
  const h = (s) => createHash('sha256').update(s).digest('hex');
  const init = await mcp('/mcp/app', { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', clientInfo: { name: 'Anthropic/ClaudeAI' } } }, 'Claude-User');
  const list = await mcp('/mcp/app', { jsonrpc: '2.0', id: 2, method: 'tools/list' }, 'Claude-User');
  assert.equal(h(init.text.replaceAll(VERSION, '<V>')), 'afb248ffebbd46b3d3d350d7a34bb36018d82f25a1f5901807f81ad0a4ab895b');
  assert.equal(h(list.text), '5b702b221d45a41a40f0f7a1bcecf2418a5334d357238acfd6f2de3ff37d4a7f');
});

console.log('/open, its data and its files');
await proof('/open shows the number to steer by first, then every number: visits by kind (own scale per row), agents, brain, market, savings, money, costs, releases, doors', async () => {
  const r = await call('/open'); assert.equal(r.status, 200); assert.match(r.text, /<h1>Every number in public<\/h1>/);
  assert.match(r.text, /<p class="hero-n"><b>[\d,]+<\/b>foreign working sessions today so far/);
  for (const x of ['Foreign working sessions', 'Who came, day by day', 'What agents did', 'What the brain holds', 'Money in, money out', 'Version and releases', 'Every public door that answers as data', 'Take the numbers with you', '€7.13', 'VAT included', 'may be counted until they carry the sea&#39;s own marker']) assert.ok(r.text.includes(x), x);
  assert.equal((r.text.match(/<div class="vrow">/g) || []).length, VISIT_KINDS.length + 1, 'one row a kind, and the sessions');
  for (const svg of r.text.match(/<svg viewBox[\s\S]*?<\/svg>/g)) wellFormed(svg);
  assert.match(r.text, /animation:rise-bar/); assert.match(r.text, /prefers-reduced-motion:no-preference/);
  for (const ip of IPS.slice(-40)) assert.ok(!r.text.includes(ip), `no address on the page: ${ip}`);
});
await proof('/open carries schema.org Dataset markup Google Dataset Search can list: every field it asks for, a CSV and the JSON', async () => {
  const ds = datasetsOf((await call('/open')).text); assert.equal(ds.length, 1); checkDataset(ds[0], [['text/csv', '/open/visits.csv'], ['application/json', '/open.json']]);
  const sv = datasetsOf((await call('/savings')).text); assert.equal(sv.length, 1); checkDataset(sv[0], [['text/csv', '/savings.csv'], ['application/json', '/savings.json']]);
});
await proof('/open.json: the same numbers as data, aggregated only, 14 days by kind with days without a record marked, and every public door', async () => {
  const r = await call('/open.json'); assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /^application\/json/); const j = JSON.parse(r.text);
  for (const k of ['work', 'visits', 'agents', 'brain', 'market', 'savings', 'money', 'costs', 'releases', 'endpoints', 'downloads', 'license']) assert.ok(k in j, k);
  assert.equal(j.version, VERSION); assert.equal(j.visits.days.length, 14); assert.equal(j.work.days.length, 14);
  assert.ok(j.visits.days.every((d) => d.recorded === (d.kinds !== null))); assert.ok(j.visits.days.some((d) => d.recorded));
  assert.deepEqual(Object.keys(j.work.families), FAMILIES.map(([f]) => f)); for (const k of ['what', 'never', 'how', 'caveat']) assert.ok(j.work[k].length > 40, k);
  assert.equal(j.money.till.totalUsd, 0, 'zero stays zero'); assert.equal(j.costs[0].eurPerMonth, 7.13); assert.ok(j.releases.some((x) => x.version === '3.32.0' && x.pr));
  assert.ok(j.agents.mcp.byTool.some((x) => x.tool === 'think' && x.days >= 2));
  const paths = j.endpoints.map((e) => e.path); for (const p of ['/census', '/pulse', '/treasury', '/stats', '/brain?format=json', '/brain/market.json', '/savings.json', '/proof.json', '/attention.json', '/connect.json', '/lighthouse.json', '/instinct.json', '/immune.json', '/open.json']) assert.ok(paths.includes(p), p);
  for (const ip of IPS) assert.ok(!r.text.includes(ip), `no address in the data: ${ip}`);
});
await proof('every public door the index names answers as data (but the three of 3.33.0 that other parts bring, and the one that needs an identifier)', async () => {
  const skip = (p, since) => since || /<identifier>/.test(p);
  for (const [, list] of ENDPOINTS) for (const [path, , since] of list) {
    if (skip(path, since)) continue;
    const r = await call(exampleOf(path), { accept: 'application/json' });
    assert.ok(r.status < 500, `${path}: ${r.status}`); assert.match(r.headers.get('content-type') || '', /json/, `${path}: ${r.headers.get('content-type')}`);
  }
});
await proof('/open.md is the page for agents: Markdown, the doors as rows with their addresses, no markup', async () => {
  const r = await call('/open.md'); assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /^text\/markdown/); assert.match(r.text, /^# Every number of the open sea, in public/);
  assert.doesNotMatch(r.text, /<(html|script|style|svg)\b/i); assert.ok(r.text.includes('[`/census`](https://mare.test/census)') || r.text.includes('[/census](https://mare.test/census)'), 'the doors keep their links');
  assert.match(r.text, /Working sessions/); assert.match(r.text, /Training crawlers/);
});
await proof('/open/visits.csv: one row a day from the first record, one column for every kind the census tells apart; /savings.csv from the day the count began', async () => {
  const v = await call('/open/visits.csv'); assert.match(v.headers.get('content-type'), /^text\/csv/); const lines = v.text.trim().split('\n');
  assert.equal(lines[0], ['day', ...KIND_ORDER, 'total'].join(',')); assert.ok(lines.length >= 2); assert.ok(lines.slice(1).every((l) => /^\d{4}-\d{2}-\d{2},/.test(l) && l.split(',').length === KIND_ORDER.length + 2));
  const s = await call('/savings.csv'); const sl = s.text.trim().split('\n');
  assert.equal(sl[0], 'day,reuses_path,reuses_plan,reuses_market,md_answers,md_agent_answers,reader_answers,bytes_html,bytes_markdown,bytes_spared,tokens_measured,tokens_modelled_low,tokens_modelled_mid,tokens_modelled_high,usd_low,usd_mid,usd_high,wh_low,wh_mid,wh_high');
  const today = sl[sl.length - 1].split(','); assert.equal(today[0], new Date().toISOString().slice(0, 10)); assert.ok(Number(today[5]) >= 1, 'md-agent answers today'); assert.ok(Number(today[10]) > 0, 'measured tokens today');
  for (const ip of IPS) assert.ok(!v.text.includes(ip) && !s.text.includes(ip));
});

console.log('/savings and its badge');
await proof('/savings leads with every token spared, measured and modelled apart, a 30-day chart, kinds and doors, worth and energy, and keeps what it said in 3.32.0', async () => {
  const h = await call('/savings'); assert.equal(h.status, 200);
  for (const x of ['tokens spared for AI agents so far', 'The last 30 days', 'By kind and by door', 'What it is worth', 'md-agent', 'What one reuse spares', 'If it grows', 'Sources', 'Not counted', 'Joule', '485 TWh in 2025', 'Put the count on your page', '/savings/badge.svg']) assert.ok(h.text.includes(x), x);
  for (const svg of h.text.match(/<svg viewBox[\s\S]*?<\/svg>/g)) wellFormed(svg);
  // the ratio says where it comes from, and links the proof that measured it
  assert.ok(h.text.includes('How counts become tokens: measured, not assumed'), 'the ratio is labelled'); assert.ok(h.text.includes('<a href="/proof">proof of function</a>'), '/proof is linked');
  assert.ok(h.text.includes(`${TOKEN_RATIO.html}</b> characters of raw HTML`) && h.text.includes(`${TOKEN_RATIO.md}</b> characters of the sea's Markdown`), 'the measured numbers are shown');
  const j = JSON.parse((await call('/savings.json')).text);
  assert.equal(j.series.length, 30); assert.deepEqual(Object.keys(j.hero).sort(), ['measured', 'modelled', 'note', 'tokens', 'usd', 'wh']); assert.equal(j.hero.tokens, j.hero.measured + j.hero.modelled.mid);
  assert.deepEqual(j.byKind.all.map((x) => x.kind), ['md', 'md-agent', 'read', 'path', 'plan', 'market']); assert.equal(j.scenarios.length, 4); assert.equal(j.notCounted.length, 3); assert.equal(j.price.mid, 2); assert.equal(j.ratio.assumption, false); assert.match(j.ratio.proof, /\/proof$/); assert.equal(j.ratio.tokenizer, 'o200k_base');
});
await proof('/savings/badge.svg is well-formed SVG with the live count, is counted as no visit, and the page offers it to copy', async () => {
  const b = await call('/savings/badge.svg'); assert.match(b.headers.get('content-type'), /^image\/svg\+xml/); wellFormed(b.text);
  const hero = JSON.parse((await call('/savings.json')).text).hero.tokens;
  assert.match(b.text, /tokens spared for agents by the open sea/); assert.ok(b.text.includes(`>${hero.toLocaleString('en-US')}</text>`), `the badge shows ${hero}`);
  const page = (await call('/savings')).text; assert.ok(page.includes(`[![Tokens spared for agents by the open sea](${BASE}/savings/badge.svg)](${BASE}/savings)`.replace(/&/g, '&amp;')) || page.includes('[![Tokens spared for agents by the open sea]'));
  const day = new Date().toISOString().slice(0, 10), total = async () => { await tick(40); return Object.values((await kv.get(`census:${day}`))?.kinds || {}).reduce((s, v) => s + v, 0); };
  const before = await total(); await call('/savings/badge.svg', { ua: 'github-camo (+https://github.com/atmos/camo)' }); assert.equal(await total(), before, 'a badge shown on another page is no visit');
});

console.log('the home page');
await proof('the home page is built from its sources: the build says site/index.html is what they give', () => {
  const out = execFileSync(process.execPath, [join(ROOT, 'homepage/build.mjs')], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, MARE_REPO: ROOT } });
  assert.match(out, /site\/index\.html is what the sources give/, out);
});
await proof('the sources carry the areas of the Unibrain (3.32.0) and the two new doors, and the counter of tokens spared near the top', () => {
  const p = readFileSync(new URL('../homepage/src/page.html', import.meta.url), 'utf8');
  for (const x of ['href="{{B}}/brain/market">The verified market</a>', 'href="{{B}}/brain/thinking">Thinking</a>', 'href="{{B}}/savings">What it saves</a>', 'All six areas of the Unibrain', 'href="{{B}}/open">Every number, in public</a>', 'href="{{B}}/connect">Connect your agent</a>']) assert.ok(p.includes(x), x);
  assert.ok(p.indexOf('id="spared-n"') < p.indexOf('id="readers"'), 'the counter stands in the first section');
  // 3.33.0: the proof and what the AIs read are one click from the home page; the foot names About and the Impressum (§ 5 DDG)
  for (const x of ['href="{{B}}/proof">Proof of function</a>', 'href="{{B}}/attention">What the AIs read</a>', '<li><a href="{{B}}/about">About</a></li><li><a href="{{B}}/impressum">Impressum</a></li>']) assert.ok(p.includes(x), x);
  const built = readFileSync(new URL('../site/index.html', import.meta.url), 'utf8');
  for (const x of ['href="/proof"', 'href="/attention"', 'href="/impressum"']) assert.ok(built.includes(x), `built: ${x}`);
  for (const m of built.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)) for (const o of JSON.parse(m[1])['@graph'] || []) if (o['@type'] === 'Dataset') assert.equal(o.creator?.name, 'Mare Liberum', 'the home page Dataset names its creator');
  assert.match(p, /tokens spared for AI agents so far · measured <span class="snd" data-k="sparedM">\{\{sparedM\}\}<\/span> · modelled <span class="snd" data-k="sparedE">\{\{sparedE\}\}<\/span>/);
  const app = readFileSync(new URL('../homepage/src/app.js', import.meta.url), 'utf8'); assert.match(app, /if \(el && !still && goal\(\) > 0\)/, 'no counting up with reduced motion');
});
await proof('the node fills the counter in the page it sends: every token spared so far, with its measured and modelled parts', async () => {
  await call('/about', { ua: UA.chatgpt });
  const r = await call('/', { ua: UA.browser, headers: { 'sec-fetch-mode': 'navigate' } }); assert.match(r.headers.get('content-type'), /^text\/html/);
  const m = /data-k="spared" data-v="(\d+)">([\d,]+)</.exec(r.text); assert.ok(m, 'the counter is filled'); assert.ok(Number(m[1]) > 0); assert.equal(m[2], Number(m[1]).toLocaleString('en-US'));
  assert.match(r.text, /data-k="sparedM" data-v="\d+">[\d,]+</); assert.match(r.text, /data-k="sparedE" data-v="\d+">[\d,]+</);
  assert.match(r.text, /data-k="market" data-v="\d+">/); assert.ok(r.text.includes('href="/open">Every number, in public</a>'));
  const h = headline({ areas: { saved: { tokensAll: { mid: 12, measured: 10, modelled: 2 } } } }); assert.deepEqual([h.spared, h.sparedM, h.sparedE], [12, 10, 2]);
});

console.log('the census');
await proof('the sea\'s own calls are not visits, and release dates are stated as they reached main', async () => {
  const day = new Date().toISOString().slice(0, 10), before = Object.values((await kv.get(`census:${day}`))?.kinds || {}).reduce((s, v) => s + v, 0);
  await call('/open', { ua: UA.own }); await tick(40);
  assert.equal(Object.values((await kv.get(`census:${day}`))?.kinds || {}).reduce((s, v) => s + v, 0), before);
  // a release is dated by the moment it reached main; only the newest may still be on its way (no day, no pull request yet)
  assert.ok(RELEASES.every((r, i) => /^\d+\.\d+\.\d+$/.test(r.version) && (r.at === null ? i === 0 && !r.pr : !Number.isNaN(Date.parse(r.at)))));
  assert.equal(RELEASES[0].version, VERSION, 'the newest release is the version this node runs');
  const o = (await call('/open')).text; if (!RELEASES[0].at) assert.match(o, new RegExp(`<b>${VERSION.replace(/\./g, '\\.')}</b></td><td[^>]*>not dated yet · running on this node since`), 'an undated release says how long this node has run it');
});

rmSync(dir, { recursive: true, force: true });
console.log(`\n${passed} proofs held, ${failed} failed`);
process.exit(failed ? 1 : 0);
