// Mare Liberum · proof of the verifier's fixes for 3.33.0 (reports/verify-3.33.md): one proof per finding, each named by
// it, each written so that it fails when its fix is taken back. The counters of a release called "the proof" cannot be
// inflated from one address in a loop (C1, I1, I2, I3); what is measured says against what (I4, I5); a payment buys no
// "verified" (C2); one rule keeps adult and gambling names out (I6); no page promises one click where there are steps
// (I7); the run beside the live one says what it is (I9); and the smaller things (M1–M8, the dock).
// Runs without the network: node tools/fixes-proof.mjs   (exit code 1 when a proof fails)
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { handle } from '../node/core.mjs';
import { createMem } from '../node/mem.mjs';
import { memoryKv } from '../node/flow.mjs';
import { createLedger } from '../node/ledger.mjs';
import { payConfig } from '../node/pay.mjs';
import { immune } from '../node/immune.mjs';
import { createOnce } from '../node/once.mjs';
import { SAVE } from '../node/areas.mjs';
import { plainTextBytes } from '../node/agentmd.mjs';
import { leftOut } from '../node/atlas.mjs';
import { csvCell, LICENCES } from '../node/open.mjs';
import { createAttention } from '../node/attention.mjs';

let passed = 0, failed = 0;
const proof = async (name, fn) => { try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 5).join('\n       ')}`); } };
globalThis.fetch = async (u) => { throw new Error(`the proof does not use the network: ${String(u).slice(0, 80)}`); };
const dns = createRequire(import.meta.url)('node:dns'); dns.promises.lookup = async () => [{ address: '93.184.216.34', family: 4 }];
const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

const BASE = 'https://mare.test', kv = memoryKv(), db = createMem({ file: '/nonexistent/sea.tsv', base: BASE });
const SITE = { '/': { body: read('site/index.html'), type: 'text/html; charset=utf-8' }, '/llms.txt': { body: read('site/llms.txt'), type: 'text/plain; charset=utf-8' }, '/robots.txt': { body: read('site/robots.txt'), type: 'text/plain; charset=utf-8' } };
const cfg = { base: BASE, kv, ledger: createLedger({}), pay: payConfig({}), site: SITE, waitUntil: () => {}, openMemoMs: 0 };
// the overview of /attention is kept a minute; the proof reads it uncached
db.attention = createAttention({ kv, caps: { cacheMs: 0 } });
immune.use({ every: 0, kv, base: BASE, store: null }); immune.set({});
const UA = {
  curl: 'curl/8.5.0', browser: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
  claude: 'Claude-User (+https://support.anthropic.com/)', claudebot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ClaudeBot/1.0; +claudebot@anthropic.com',
  googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', angel: 'Angel/1.0 (+https://angel.oroboros-design.com)',
  duck: 'DuckAssistBot/1.1; (+http://duckduckgo.com/duckassistbot.html)', agent: 'claude-code/2.0', headless: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0 Safari/537.36',
};
const NAV = { 'sec-fetch-mode': 'navigate', 'sec-fetch-site': 'none', 'sec-fetch-dest': 'document', 'upgrade-insecure-requests': '1' };
const call = async (path, { ua = UA.curl, accept = 'text/html', ip = '198.18.60.1', method = 'GET', headers = {}, body } = {}) => {
  const res = await handle(new Request(BASE + path, { method, headers: { accept, 'user-agent': ua, 'x-forwarded-for': ip, 'content-type': 'application/json', ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) }), db, cfg);
  const text = await res.text(); let j = null; try { j = JSON.parse(text); } catch {}
  return { status: res.status, headers: res.headers, text, j };
};
await call('/about');
const sea = () => db.flow;
// before any answer is measured against plain text: the lower view says none, not a saving of zero (I5)
const before = { savings: (await call('/savings', { ua: UA.browser, headers: NAV })).text, open: (await call('/open', { ua: UA.browser, headers: NAV })).text };
const counts = async () => (await sea().savings()).today.counts;
const ldOf = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));

console.log('C1 · the savings counter: once a day per network and page or task; the front page against its own text');
await proof('C1 a Markdown answer counts once a day per network and page: 25 reads, a query loop and a second address of the same /64 add one', async () => {
  const md0 = (await counts()).md || 0;
  for (let i = 0; i < 25; i++) assert.match((await call('/about.md', { ip: '203.0.113.7' })).headers.get('content-type'), /^text\/markdown/);
  for (let i = 0; i < 5; i++) await call(`/about.md?x=${i}`, { ip: '203.0.113.7' });
  for (let i = 0; i < 5; i++) await call('/pricing', { accept: 'text/markdown', ua: `${UA.curl} r${i}`, ip: '203.0.113.7' });
  assert.equal(((await counts()).md || 0) - md0, 2, 'one network: one answer per page (two pages), whatever the query or the program name');
  await call('/about.md', { ip: '203.0.113.8' }); assert.equal(((await counts()).md || 0) - md0, 3, 'another network counts once more');
  await call('/about.md', { ip: '2001:db8:7:7::1' }); await call('/about.md', { ip: '2001:db8:7:7::2' });
  assert.equal(((await counts()).md || 0) - md0, 4, 'two addresses of one IPv6 /64 are one network');
});
await proof('C1 a solved part counts once a day per network and task: 30 asks for one plan from one address are one reuse', async () => {
  const q = 'write a market report on coffee prices in Europe', p0 = (await counts()).plan || 0;
  for (let i = 0; i < 30; i++) await call(`/brain/thinking?q=${encodeURIComponent(q)}`, { accept: 'application/json', ip: '203.0.113.9' });
  const p1 = (await counts()).plan || 0; assert.ok(p1 - p0 === 1, `one reuse, not ${p1 - p0}`);
  await call(`/brain/thinking?q=${encodeURIComponent(q)}`, { accept: 'application/json', ip: '203.0.113.10' }); assert.equal(((await counts()).plan || 0) - p0, 2, 'another network, once more');
});
await proof('C1 one network adds at most the cap a day, whatever it varies (520 pages, 520 tasks); the table is bounded and errs low', async () => {
  assert.deepEqual(SAVE.cap, { measured: 500, reuse: 500 });
  const c0 = await counts(), ctx = { ip: '203.0.113.11', door: '/read' };
  for (let i = 0; i < 520; i++) { sea().countBytes('read', 5000, 500, ctx, `https://site${i}.test/`); sea().countSave('path', 1, ctx, `task number ${i}`); }
  const c1 = await counts(); assert.equal((c1.reads || 0) - (c0.reads || 0), 500, 'measured: 500 a network a day'); assert.equal((c1.path || 0) - (c0.path || 0), 500, 'reuses: 500 a network a day');
  sea().countBytes('read', 5000, 500, { ip: '203.0.113.12', door: '/read' }, 'https://site0.test/'); assert.equal(((await counts()).reads || 0) - (c0.reads || 0), 501, 'another network is not held');
  const full = createOnce({ bits: 4 }); let k = 0; for (let i = 0; i < 100; i++) if (full.first(`198.51.100.${i}`, 'md', '/x')) k++;
  assert.ok(k <= 12, `a full table counts nothing new (${k} of 16 slots)`);
});
await proof('C1 the front page as Markdown is measured against its own plain text, never against the guide it answers with', async () => {
  const c0 = await counts(), r = await call('/', { ua: UA.claude, accept: '*/*', ip: '203.0.113.13' });
  assert.match(r.text, /^# Mare Liberum/, 'the assistant gets the guide'); const c1 = await counts();
  const out = (c1.mdAgentOut || 0) - (c0.mdAgentOut || 0), html = (c1.mdAgentHtml || 0) - (c0.mdAgentHtml || 0), guide = new TextEncoder().encode(r.text).length;
  const own = plainTextBytes((await call('/', { ua: UA.browser, headers: NAV, ip: '203.0.113.14' })).text);
  assert.ok(Math.abs(out - own) < 400, `the Markdown side is the page's own plain text (${out} against ${own}), not the guide (${guide})`);
  assert.ok(out < guide / 2 && html > out, 'never the guide');
});

console.log('C2 · a payment buys no "verified"');
await proof('C2 no page, snippet or source sells a "verified listing"; /pricing\'s description names the owner check', async () => {
  const p = (await call('/pricing', { ua: UA.browser, headers: NAV })).text, desc = /<meta name="description" content="([^"]*)"/.exec(p)[1];
  assert.match(desc, /owner check 19 €/); assert.doesNotMatch(desc, /verified listing/i);
  for (const path of ['/pricing', '/claim', '/offers', '/attention', '/pricing.json', '/claim.json']) assert.doesNotMatch((await call(path, { ua: UA.browser, headers: NAV, accept: path.endsWith('.json') ? 'application/json' : 'text/html' })).text, /verified listing/i, path);
  const src = [...readdirSync(new URL('../node/', import.meta.url)).filter((f) => f.endsWith('.mjs')).map((f) => read(`node/${f}`)), read('site/llms.txt'), read('homepage/src/page.html')].join('\n');
  assert.doesNotMatch(src, /verified listing/i, 'nowhere in the words of the site');
});

console.log('I1 · working sessions: by network and client family, at most 3 a network a day');
await proof('I1 40 made-up session ids and 40 program names from one address open at most 3 working sessions; /mcp/app gets no session header', async () => {
  const w = async () => (await sea().workDays(1)).days.at(-1).sessions;
  const w0 = await w();
  for (let i = 0; i < 40; i++) await call('/mcp', { method: 'POST', accept: 'application/json, text/event-stream', ip: '203.0.113.20', headers: { 'mcp-session-id': `made-up-${i}` }, body: { jsonrpc: '2.0', id: i, method: 'tools/call', params: { name: 'stats', arguments: {} } } });
  assert.equal(await w() - w0, 1, 'one network, one client: one session, whatever ids it sends');
  const uas = ['Cursor/1.7', 'claude-code/2.0', 'ChatGPT/1.0', 'Visual Studio Code/1.95', 'python-httpx/0.27'];
  for (let i = 0; i < 40; i++) await call(`/brain?q=${encodeURIComponent(`task ${i}`)}`, { ua: `${uas[i % uas.length]} rotated-${i}`, accept: 'application/json', ip: '203.0.113.21' });
  assert.ok(await w() - w0 <= 4, `rotated program names add at most 3 for a network (${await w() - w0 - 1})`);
  const app = await call('/mcp/app', { method: 'POST', accept: 'application/json, text/event-stream', ip: '203.0.113.22', body: { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } } });
  assert.equal(app.headers.get('mcp-session-id'), null, 'no session id issued at the app door');
});

console.log('I2 · /connect counts per network; a copy is the page\'s own beacon');
await proof('I2 15 presses with 15 browser names from one address are one; forged same-origin copies count nothing', async () => {
  const today = async (id) => { await tick(); return (await call('/connect.json', { accept: 'application/json' })).j.counts.today[id] || { go: 0, copy: 0 }; };
  const g0 = (await today('cursor')).go;
  for (let i = 0; i < 15; i++) await call('/connect/go/cursor', { ua: UA.browser.replace('131.0', `131.0.${i}.0`), headers: NAV, ip: '203.0.113.30' });
  assert.equal((await today('cursor')).go - g0, 1, 'one network: one press');
  const c0 = (await today('zed')).copy, forged = { 'sec-fetch-mode': 'no-cors', 'sec-fetch-site': 'same-origin', 'sec-fetch-dest': 'empty' };
  for (let i = 0; i < 10; i++) await call('/connect/go/zed', { method: 'POST', ua: UA.browser, headers: forged, ip: `203.0.113.${40 + i}` });
  assert.equal((await today('zed')).copy - c0, 0, 'a POST without the page\'s Origin and Referer is no copy');
  await call('/connect/go/zed', { method: 'POST', ua: UA.browser, headers: { ...forged, origin: BASE, referer: `${BASE}/connect` }, ip: '203.0.113.50' });
  await call('/connect/go/zed', { method: 'POST', ua: UA.browser.replace('131.0', '132.0'), headers: { ...forged, origin: BASE, referer: `${BASE}/connect` }, ip: '203.0.113.50' });
  assert.equal((await today('zed')).copy - c0, 1, 'the beacon of the page counts, once per network');
});

console.log('I3 · /c/ counts a person who navigates, nothing else');
await proof('I3 a picture on another site, a headless browser and a prefetch are sent on and not counted; a navigation is', async () => {
  const total = async () => (await call('/attention.json', { accept: 'application/json' })).j.clicks?.last30days?.talk?.total || 0;
  const t0 = await total();
  const img = await call('/c/talk?from=site', { ua: UA.browser, headers: { 'sec-fetch-dest': 'image', 'sec-fetch-mode': 'no-cors', 'sec-fetch-site': 'cross-site' }, ip: '203.0.113.60' });
  await call('/c/talk?from=site', { ua: UA.headless, headers: NAV, ip: '203.0.113.61' });
  await call('/c/talk?from=site', { ua: UA.browser, headers: { ...NAV, 'sec-purpose': 'prefetch' }, ip: '203.0.113.62' });
  assert.equal(img.status, 302, 'every caller is sent on'); assert.equal(await total() - t0, 0, 'none of them is a click');
  await call('/c/talk?from=site', { ua: UA.browser, headers: NAV, ip: '203.0.113.63' }); assert.equal(await total() - t0, 1, 'a person who navigates is');
});

console.log('I4 and I5 · the badge and the headline say what they measure');
await proof('I4 the badge shows the measured count only, labelled against raw HTML; the /open pulse names measured and modelled apart', async () => {
  await call(`/brain/thinking?q=${encodeURIComponent('fact check a claim about creatine')}`, { accept: 'application/json', ip: '203.0.113.70' });
  const s = (await call('/savings.json', { accept: 'application/json' })).j, b = (await call('/savings/badge.svg')).text;
  assert.ok(s.hero.modelled.mid > 0 && s.hero.tokens !== s.hero.measured, 'there is something modelled to leave out');
  assert.ok(b.includes(`>${s.hero.measured.toLocaleString('en-US')}</text>`), 'the measured count'); assert.ok(!b.includes(`>${s.hero.tokens.toLocaleString('en-US')}</text>`), 'not the sum');
  assert.match(b, /measured vs raw HTML/); assert.match(b, /an upper bound; modelled reuses not included/);
  const o = (await call('/open', { ua: UA.browser, headers: NAV })).text;
  assert.match(o, /tokens spared, measured against raw HTML \(an upper bound\) · <b>[\d,]+<\/b> modelled from reuses/);
});
await proof('I5 "measured" is said to be against raw HTML, an upper bound, everywhere it is shown, with plain text as the lower view beside it', async () => {
  assert.match(read('homepage/src/page.html'), /data-k="sparedM">\{\{sparedM\}\}<\/span> against raw HTML \(an upper bound\)/); assert.match(read('site/index.html'), /against raw HTML \(an upper bound\)/);
  const sv = (await call('/savings', { ua: UA.browser, headers: NAV })).text;
  assert.match(sv, /measured [\d,]+ against raw HTML \(an upper bound\) · modelled/); assert.match(sv, /<th[^>]*>measured, against raw HTML \(upper bound\), and under it the lower view<\/th>/); assert.match(sv, /<br><small>lower view: [\d,]+ of [\d,]+ \([\d,]+ answers?\)<\/small><\/td>/); assert.match(before.savings, /<br><small>lower view: – \(no answer yet\)<\/small><\/td>/);
  assert.match(sv, /So far [\d,]+ answers? (was|were) measured both ways: against raw HTML (it|they) spared [\d,]+ tokens, against plain text [\d,]+\./);
  assert.match(before.savings, /No answer has been measured so yet\./); assert.match(before.open, /<b>–<\/b><span>the lower view against plain text: counted from 3\.33\.0 on, no answer measured so yet/); assert.match(sv, /alt="Tokens spared for agents by the open sea, measured against raw HTML \(an upper bound\)/);
  const o = (await call('/open', { ua: UA.browser, headers: NAV })).text; assert.match(o, /Markdown instead of raw HTML, an upper bound/); assert.match(o, /the lower view: against plain text, for the [\d,]+ answers? measured so since 3\.33\.0 \(against raw HTML the same spared [\d,]+\)/);
  const md = (await call('/', { accept: 'text/markdown', ip: '203.0.113.71' })).text; assert.match(md, /measured [\d,]+ against raw HTML, an upper bound/);
  const s = await sea().savings(), lv = s.hero.lowerView; assert.ok(lv.answers >= 1 && s.today.vsText.answers === lv.answers && lv.againstRawHtml > 0, 'the lower view is counted, the same answers both ways');
  assert.ok(lv.againstPlainText <= lv.againstRawHtml && lv.againstRawHtml <= s.hero.measured + lv.answers + 1 && s.hero.measuredVsText === lv.againstPlainText, `like for like, and lower: ${JSON.stringify(lv)}`);
});

console.log('I6 · one rule for adult and gambling names');
await proof('I6 adult and gambling domains are left out by one rule (sitemaps, IndexNow, /site noindex) and never named on /attention', async () => {
  for (const h of ['redtube.com', 'brazzers.com', 'missav.com', 'beeg.com', 'spankbang.com', 'bet365.com', 'pokerstars.com', '888poker.com', 'lottoland.com', 'gambling.com', 'betway.com', 'unibet.com']) assert.equal(leftOut(h), true, h);
  for (const h of ['essex.ac.uk', 'sussex.ac.uk', 'youtube.com', 'desire.com', 'stakeholder.com', 'pokemon.com', 'alphabet.com', 'wikipedia.org']) assert.equal(leftOut(h), false, h);
  const at = (await import('../node/attention.mjs')).createAttention({ kv: memoryKv() });
  for (const d of ['bet365.com', 'redtube.com', 'ropes.dev']) for (let i = 0; i < 3; i++) at.count('s', d, 0, `n${d}${i}`, `/site/${d}`);
  const top = (await at.overview()).top.map((x) => x.site); assert.ok(top.includes('ropes.dev') && !top.includes('bet365.com') && !top.includes('redtube.com'), top.join(','));
  assert.equal((await call('/site/bet365.com', { ua: UA.browser, headers: NAV })).headers.get('x-robots-tag'), 'noindex, nofollow');
});

console.log('I7 · no page promises one click where there are steps');
await proof('I7 /connect, its title and the guide say one click for Cursor, VS Code, Goose and LM Studio, a few steps for Claude and ChatGPT', async () => {
  const p = (await call('/connect', { ua: UA.browser, headers: NAV })).text, title = /<title>([^<]*)<\/title>/.exec(p)[1], h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(p)[1];
  assert.equal(h1, 'Connect your agent to the sea'); assert.match(p, /One click for Cursor, VS Code, Goose and LM Studio; a few steps for Claude and ChatGPT/);
  for (const t of [title, h1, /<meta name="description" content="([^"]*)"/.exec(p)[1]]) assert.doesNotMatch(t, /in one click|One-click setup/, t);
  const llms = read('site/llms.txt'); assert.doesNotMatch(llms, /one click into Claude|Connect a client in one click/); assert.match(llms, /a few steps for Claude and ChatGPT/);
  assert.doesNotMatch(read('node/skin.mjs'), /One click opens a door/);
});

console.log('I9 · the run beside the live one says what it is');
await proof('I9 /proof names the branch and the commit the lean run measured and its seeded brain, and never says the hourly re-read confirms it', async () => {
  // the run beside the live one, as /proof loads it: the newest run of a branch in proof/
  const f = readdirSync(new URL('../proof/', import.meta.url)).filter((x) => /^bench-\d{4}-\d{2}-\d{2}-lean\.json$/.test(x)).sort().at(-1), L = JSON.parse(read(`proof/${f}`));
  const branch = /\b([a-z][a-z0-9-]*\/\d+)\b/.exec(L.method.run)?.[1], seeded = /\b(\d+) pathways\b/.exec(L.method.brain)?.[1];
  assert.ok(branch && /^[0-9a-f]{7,}$/.test(L.bench.commit) && seeded, `the run names its branch, its commit and its seeded brain (${branch}, ${L.bench.commit}, ${seeded})`);
  const p = (await call('/proof', { ua: UA.browser, headers: NAV })).text;
  assert.ok(p.includes(`on branch ${branch} (commit ${L.bench.commit}: the reader and the short answer this release ships), its brain a local node seeded with the ${seeded} live pathways of these ${L.summary.tasks} tasks`), 'the label says what the run is');
  assert.match(p, /it is no re-run of the bench/); assert.doesNotMatch(p, /confirms it|Not live yet/);
  assert.ok(p.includes(`after: ${branch}, local</th>`), 'the table names the branch of the run too');
});

console.log('the smaller ones');
await proof('M1 a door that answers by Accept varies with the User-Agent too: a program gets data, a search crawler the page', async () => {
  const a = await call('/attention', { accept: '*/*', ua: UA.curl }), g = await call('/attention', { accept: '*/*', ua: UA.googlebot });
  assert.match(a.headers.get('content-type'), /json/); assert.match(g.headers.get('content-type'), /html/);
  for (const r of [a, g]) assert.match(r.headers.get('vary') || '', /accept.*user-agent|user-agent.*accept/i);
});
await proof('M2 /open says which licence applies to which data, as each dataset says it of itself', async () => {
  const o = (await call('/open', { ua: UA.browser, headers: NAV })).text, j = (await call('/open.json', { accept: 'application/json' })).j;
  assert.match(o, /Which licence for which data/); assert.deepEqual(j.licences.map((x) => x.license), LICENCES.map((x) => x.license));
  const lic = async (path) => ldOf((await call(path, { ua: UA.browser, headers: NAV })).text).flatMap((x) => x['@graph'] || [x]).find((x) => x['@type'] === 'Dataset')?.license;
  const of = (p) => LICENCES.find((x) => x.paths.includes(p))?.url;
  for (const p of ['/attention', '/proof', '/open']) assert.equal(await lic(p), of(p), p);
});
await proof('M4 a CSV cell that a spreadsheet would run as a formula is kept as text; numbers stay numbers', () => {
  assert.deepEqual(['=1+1', '+1', '-2', '@x', '\tx'].map(csvCell), ["'=1+1", "'+1", "'-2", "'@x", "'\tx"]); assert.deepEqual([csvCell(-2), csvCell(5), csvCell('2026-11-24')], ['-2', '5', '2026-11-24']);
});
await proof('M5 the house agent (Angel) is counted apart: its reuses and its Markdown are in no headline, and /savings names them on a line of their own', async () => {
  const h0 = (await sea().savings()).hero;
  await call(`/brain/thinking?q=${encodeURIComponent('plan a product launch for a bakery')}`, { ua: UA.angel, accept: 'application/json', ip: '203.0.113.80' });
  assert.match((await call('/about.md', { ua: UA.angel, ip: '203.0.113.80' })).headers.get('content-type'), /^text\/markdown/);
  const s = await sea().savings(); assert.deepEqual([s.hero.measured, s.hero.modelled.mid], [h0.measured, h0.modelled.mid], 'the headline did not move');
  assert.equal(s.house.today.reuses, 1); assert.equal(s.house.today.markdown, 1);
  assert.match((await call('/savings', { ua: UA.browser, headers: NAV })).text, /The house agent \(Angel, a resident of the sea\) is counted apart and is in none of the numbers above: 1 reuse and 1 Markdown answer/);
});
await proof('M5 a crawler that calls a tool at the MCP door gets the answer an agent gets, and counts nowhere: no reuse, saving, read, ask, door ask or session', async () => {
  // one page answers for the reader (and its robots.txt); everything else is still no network
  const PAGE = 'https://kettle-proof.dev/guide', HTML = `<!doctype html><html><head><title>Kettle guide</title></head><body><nav><a href="/">Home</a></nav><main><h1>How to pick a kettle</h1>${'<p>A kettle for a small kitchen holds a litre, boils fast and turns itself off.</p>'.repeat(30)}</main><footer>Shop</footer></body></html>`;
  const net = globalThis.fetch; globalThis.fetch = async (u) => { const k = String(u?.url || u); if (/\/robots\.txt$/.test(k)) return new Response('User-agent: *\nAllow: /\n', { headers: { 'content-type': 'text/plain' } }); if (k === PAGE) return new Response(HTML, { headers: { 'content-type': 'text/html; charset=utf-8' } }); return net(u); };
  try {
    const tool = async (ua, ip, name, args) => (await call('/mcp', { method: 'POST', ua, ip, accept: 'application/json, text/event-stream', body: { jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name, arguments: args } } })).j?.result;
    const day = new Date().toISOString().slice(0, 10), tally = async () => { const s = await sea().savings(), head = (await kv.get('flow:head')) || [];
      return { plan: s.today.counts.plan || 0, path: s.today.counts.path || 0, market: s.today.counts.market || 0, reads: s.today.counts.reads || 0, readsOfDay: (await kv.get(`reads:${day}`))?.total || 0,
        asks: (await kv.get('brain:stats'))?.asks || 0, doorAsks: Number(await kv.get('door:asks')) || 0, calls: head.filter((e) => e.type === 'ask' || e.type === 'knock').length, sessions: (await sea().workDays(1)).days.at(-1).sessions }; };
    const args = { think: { q: 'write a market report on tea prices in Asia' }, route: { q: 'weather in Berlin tomorrow' }, ask: { need: 'a kettle for a small kitchen' }, read_page: { url: PAGE } };
    const t0 = await tally(), c = {}, g = {};
    for (const [name, a] of Object.entries(args)) c[name] = await tool(UA.claudebot, '203.0.113.90', name, a);
    for (const [name, r] of Object.entries(c)) assert.equal(r?.isError, false, `${name}: ${JSON.stringify(r).slice(0, 200)}`);
    assert.match(c.read_page.structuredContent.markdown, /How to pick a kettle/, 'the crawler gets the page');
    assert.deepEqual(await tally(), t0, 'the crawler counted nowhere');
    for (const [name, a] of Object.entries(args)) g[name] = await tool(UA.agent, '203.0.113.91', name, a);
    assert.deepEqual(c.think.structuredContent, g.think.structuredContent, 'think: the answer an agent gets');
    assert.deepEqual(c.route.structuredContent, g.route.structuredContent, 'route: the answer an agent gets');
    const same = (r) => JSON.stringify(r.structuredContent).replaceAll(r.structuredContent.ask.id, 'ID').replace(/"(at|t|until)":"[^"]*"/g, '"$1":""');
    assert.equal(same(c.ask), same(g.ask), 'ask: the answer an agent gets');
    assert.deepEqual({ ...c.read_page.structuredContent, cached: undefined }, { ...g.read_page.structuredContent, cached: undefined }, 'read_page: the answer an agent gets (the second one from the reader\'s cache)');
    assert.equal((await call(`/ask/${c.ask.structuredContent.ask.id}`, { accept: 'application/json' })).status, 200, 'the crawler\'s call is kept, so it can be answered');
    const t1 = await tally();
    assert.ok(t1.asks === t0.asks + 1 && t1.doorAsks > t0.doorAsks && t1.calls === t0.calls + 1 && t1.reads === t0.reads + 1 && t1.readsOfDay === t0.readsOfDay + 1 && t1.sessions === t0.sessions + 1, `an agent's calls count: ${JSON.stringify({ t0, t1 })}`);
  } finally { globalThis.fetch = net; }
});
await proof('M6 DuckAssistBot, DuckDuckGo\'s crawler for its AI answers, gets the page as HTML like AI search, not Markdown', async () => {
  const r = await call('/about', { ua: UA.duck, accept: '*/*' }); assert.match(r.headers.get('content-type'), /^text\/html/);
});
await proof('M7 /proof wears its name as large as the other new pages (no small title at 390 px)', async () => {
  const p = (await call('/proof', { ua: UA.browser, headers: NAV })).text; assert.doesNotMatch(p, /class="said t-s"/); assert.match(p, /<div class="said" style="--k:[\d.]+">/);
});
await proof('M8 the Kanzlei harbour in /pricing\'s structured data names its 990 € a year beside the 750 € setup', async () => {
  const k = ldOf((await call('/pricing', { ua: UA.browser, headers: NAV })).text).flatMap((x) => x.itemListElement || []).find((x) => x.name === 'Kanzlei harbour');
  const specs = [k?.priceSpecification].flat(); assert.ok(specs.some((x) => x?.price === 990 && x.unitText === 'year'), JSON.stringify(k)); assert.ok(specs.some((x) => x?.price === 750));
});
await proof('the dock: the counter of the home page ends a screen above the floating bar (its lines are never under it at rest)', () => {
  assert.match(read('homepage/src/style.css'), /\.spared\{padding-bottom:calc\(84px \+ env\(safe-area-inset-bottom,0px\)\)\}/); assert.match(read('site/index.html'), /\.spared\{padding-bottom:calc\(84px/);
});

console.log(`\n${passed} proofs hold${failed ? `, ${failed} FAIL` : ''}`);
process.exit(failed ? 1 : 0);
