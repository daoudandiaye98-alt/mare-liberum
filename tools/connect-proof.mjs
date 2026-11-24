// Mare Liberum · proof of one click into every agent client, and of what the search engines are given.
// Every install link holds the right address (base64 and URL-encoded configs are decoded and read), a button counts a
// person's press once per address, client and day and never the sea's own calls, crawlers, programs or prefetches, a button
// leads only where the fixed table says, the page carries valid structured data, the app door stays as it is on main, the
// hubs stand once in a sitemap of their own and first in the daily IndexNow batch, no sitemap or hub page sends a search
// engine to a page that answers 404 or noindex, the Atlas keeps adult and gambling names out of everything a search
// engine reads, and every Dataset carries name, description, creator, url and license.
// Runs without the network: node tools/connect-proof.mjs   (exit code 1 when a proof fails)
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handle, indexNowDaily } from '../node/core.mjs';
import { memoryKv } from '../node/flow.mjs';
import { createMem, hayOf, metaOf } from '../node/mem.mjs';
import { createLedger } from '../node/ledger.mjs';
import { payConfig } from '../node/pay.mjs';
import { clientsOf, goTarget, cleanConfig, countable, createConnect, CLIENT_IDS, doorsOf, CHECKED } from '../node/connect.mjs';
import { HUBS, HUB_PATHS, HUB_ALT, STATIC_DAY, hubSitemap } from '../node/hubs.mjs';
import { leftOut, ADULT } from '../node/atlas.mjs';
import { countryPage, routePage, webAgentPage } from '../node/pages.mjs';

let passed = 0, failed = 0;
const proof = async (name, fn) => { try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 4).join('\n       ')}`); } };
const noNet = () => { globalThis.fetch = async (u) => { throw new Error(`the proof does not use the network: ${String(u).slice(0, 80)}`); }; };
noNet();
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------------ a small sea with the production address
const BASE = 'https://mareliberum.dev', APP = `${BASE}/mcp/app`, OPEN = `${BASE}/mcp`, TODAY = new Date().toISOString().slice(0, 10);
const dir = mkdtempSync(join(tmpdir(), 'mare-connect-')), file = join(dir, 'sea.tsv');
const row = (id, day) => ({ id: `urn:air:${id}:mcp:demo`, display_name: `Demo ${id}`, type: 'application/mcp-server-card+json', url: `https://${id}/.well-known/mcp/server-card.json`, kind: 'mcp', source: 'self', publisher: id, attested_by: 'domain', description: 'A demo MCP server that answers questions about trains, timetables and delays in plain words.', updated_at: day, endpoints: [{ transport: 'streamable-http', url: `https://${id}/mcp` }] });
const rows = [row('example.org', '2026-10-05T08:00:00.000Z'), row('example.net', '2099-01-01T00:00:00.000Z')];
writeFileSync(file, rows.map((r) => `${r.id}\t${metaOf(r)}\t${hayOf(r)}\t${JSON.stringify(r)}`).sort().join('\n') + '\n');
writeFileSync(join(dir, 'build.json'), JSON.stringify({ builtAt: '2026-11-20T10:00:00.000Z', entries: rows.length, lakes: { self: 1 } }));
const db = createMem({ file, base: BASE }), kv = memoryKv();
const SITE = { '/llms.txt': { body: readFileSync(new URL('../site/llms.txt', import.meta.url), 'utf8'), type: 'text/plain; charset=utf-8' } };
const cfg = { base: BASE, pay: payConfig({}), ledger: createLedger({}), kv, site: SITE };
let ipN = 1;
const CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const HTML = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';
const NAV = { 'user-agent': CHROME, accept: HTML, 'sec-fetch-mode': 'navigate', 'sec-fetch-site': 'same-origin', 'sec-fetch-dest': 'document', 'sec-fetch-user': '?1' };
const call = async (path, { headers = {}, method = 'GET', ip } = {}) => {
  const res = await handle(new Request(BASE + path, { method, headers: { 'user-agent': 'proof-agent/1.0', accept: HTML, 'x-forwarded-for': ip || `198.18.7.${ipN++ % 250}`, ...headers } }), db, cfg);
  return { status: res.status, headers: res.headers, text: await res.text() };
};
const lds = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
const flat = (j) => (Array.isArray(j) ? j.flatMap(flat) : j && typeof j === 'object' ? [j, ...Object.values(j).flatMap(flat)] : []);
const counts = async () => JSON.parse((await call('/connect.json', { headers: { accept: 'application/json' } })).text);
const b64d = (s) => Buffer.from(s, 'base64').toString('utf8');
const sha = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const list = clientsOf(BASE), byId = Object.fromEntries(list.map((c) => [c.id, c]));

console.log('the install links');
await proof('20 clients, each once, with a place on the page, a door and the documentation it was checked against', () => {
  assert.equal(list.length, 20); assert.equal(CLIENT_IDS.size, 20);
  for (const id of ['claude', 'claude-desktop', 'claude-code', 'chatgpt', 'cursor', 'vscode', 'vscode-insiders', 'windsurf', 'codex', 'gemini', 'zed', 'lmstudio', 'goose', 'cline', 'continue', 'openai-agents', 'langchain', 'vercel-ai', 'http', 'a2a']) assert.ok(byId[id], id);
  for (const c of list) { assert.match(c.id, /^[a-z0-9-]{1,24}$/); assert.ok(['app', 'open', 'http', 'a2a'].includes(c.door), c.id); assert.ok(c.docs?.length && c.docs.every(([t, u]) => t && /^https:\/\//.test(u)), `${c.id} names its documentation`); }
  assert.match(CHECKED, /^\d{4}-\d{2}-\d{2}$/);
});
await proof('Cursor and LM Studio: the config is base64 of the server entry, made of letters and digits only, and holds the app door', () => {
  for (const [id, prefix] of [['cursor', 'cursor://anysphere.cursor-deeplink/mcp/install?'], ['lmstudio', 'lmstudio://add_mcp?']]) {
    const go = byId[id].go; assert.ok(go.startsWith(prefix), go);
    const q = new URLSearchParams(go.slice(prefix.length)); assert.equal(q.get('name'), 'mare-liberum');
    const raw = /[?&]config=([^&]*)/.exec(go)[1]; assert.match(raw, /^[A-Za-z0-9]+$/, 'a client that does not decode its query reads the same value');
    assert.deepEqual(JSON.parse(b64d(q.get('config'))), { url: APP }); assert.deepEqual(JSON.parse(b64d(decodeURIComponent(raw))), { url: APP });
  }
});
await proof('the clean base64 holds for any address, and falls back to the plain JSON (URL-encoded) when no spacing makes it clean', () => {
  for (const b of ['https://mareliberum.dev', 'http://localhost:8787', 'https://sea.example.org', 'https://a.b', 'https://mare-liberum.vercel.app']) {
    const c = cleanConfig({ url: `${b}/mcp/app` }); assert.deepEqual(JSON.parse(b64d(c.b64)), { url: `${b}/mcp/app` }); assert.deepEqual(JSON.parse(c.json), { url: `${b}/mcp/app` });
    const go = goTarget(b, 'cursor'), v = new URLSearchParams(go.split('?')[1]).get('config'); assert.deepEqual(JSON.parse(b64d(v)), { url: `${b}/mcp/app` });
  }
});
await proof('VS Code and VS Code Insiders: URL-encoded JSON with name, type http and the app door', () => {
  for (const [id, scheme] of [['vscode', 'vscode:mcp/install?'], ['vscode-insiders', 'vscode-insiders:mcp/install?']]) {
    const go = byId[id].go; assert.ok(go.startsWith(scheme), go); assert.ok(!/[{}"\s]/.test(go.slice(scheme.length)), 'the JSON is URL-encoded');
    assert.deepEqual(JSON.parse(decodeURIComponent(go.slice(scheme.length))), { name: 'mare-liberum', type: 'http', url: APP });
  }
});
await proof('Goose: every parameter URL-encoded, streamable_http, the app door', () => {
  const go = byId.goose.go; assert.ok(go.startsWith('goose://extension?'), go);
  const q = new URLSearchParams(go.split('?')[1]); assert.equal(q.get('url'), APP); assert.equal(q.get('type'), 'streamable_http'); assert.equal(q.get('id'), 'mare-liberum'); assert.equal(q.get('name'), 'Mare Liberum'); assert.ok(Number(q.get('timeout')) > 0); assert.ok(q.get('description').length > 20);
  assert.ok(!/ /.test(go), 'no raw space in the link');
});
await proof('Claude and ChatGPT open their own settings page; every other client its own place on /connect', () => {
  assert.equal(goTarget(BASE, 'claude'), 'https://claude.ai/customize/connectors');
  assert.equal(goTarget(BASE, 'chatgpt'), 'https://chatgpt.com/plugins');
  for (const c of list.filter((x) => x.how === 'copy')) assert.equal(goTarget(BASE, c.id), `${BASE}/connect#${c.id}`);
  assert.equal(list.filter((c) => c.how === 'link').length, 5); assert.equal(list.filter((c) => c.how === 'web').length, 2);
});
await proof('every line to copy names the right door, and every JSON block parses', () => {
  for (const c of list) for (const x of c.copy || []) {
    if (c.door === 'app') { assert.ok(x.text.includes(APP), `${c.id}: ${x.label}`); }
    if (c.door === 'open') { assert.ok(x.text.includes(`"${OPEN}"`) || x.text.includes(`'${OPEN}'`), `${c.id} uses the open door`); assert.ok(!x.text.includes(APP), c.id); }
    if (/^\s*\{/.test(x.text)) assert.doesNotThrow(() => JSON.parse(x.text), `${c.id}: ${x.label}`);
  }
  assert.ok(byId['claude-code'].copy[0].text === `claude mcp add --transport http mare-liberum --scope user ${APP}`);
  assert.ok(byId.codex.copy[0].text === `codex mcp add mare-liberum --url ${APP}`);
  assert.ok(byId.gemini.copy[0].text === `gemini mcp add --transport http --scope user mare-liberum ${APP}`);
  assert.equal(JSON.parse(byId.gemini.copy[1].text).mcpServers['mare-liberum'].httpUrl, APP);
  assert.equal(JSON.parse(byId.windsurf.copy[0].text).mcpServers['mare-liberum'].serverUrl, APP);
  assert.equal(JSON.parse(byId.zed.copy[0].text).context_servers['mare-liberum'].url, APP);
  assert.equal(JSON.parse(byId.cline.copy[0].text).mcpServers['mare-liberum'].type, 'streamableHttp');
  assert.match(byId.continue.copy[0].text, /type: streamable-http\n {4}url: https:\/\/mareliberum\.dev\/mcp\/app$/);
  assert.match(byId.codex.copy[1].text, /^\[mcp_servers\.mare-liberum\]\nurl = "https:\/\/mareliberum\.dev\/mcp\/app"$/);
});

console.log('the counted buttons');
await proof('a press from a browser opens the install link (302) and counts once for that client today', async () => {
  const r = await call('/connect/go/cursor', { headers: NAV, ip: '203.0.113.10' });
  assert.equal(r.status, 302); assert.equal(r.headers.get('location'), byId.cursor.go); assert.match(r.headers.get('cache-control'), /no-store/); assert.match(r.headers.get('x-robots-tag'), /noindex/);
  await tick(); const j = await counts(); assert.deepEqual(j.counts.today.cursor, { go: 1, copy: 0 }); assert.equal(j.clients.find((c) => c.id === 'cursor').counted.last30days.go, 1);
});
await proof('the same address counts once a day; another address counts again', async () => {
  await call('/connect/go/cursor', { headers: NAV, ip: '203.0.113.10' }); await call('/connect/go/cursor', { headers: NAV, ip: '203.0.113.10' });
  await tick(); assert.equal((await counts()).counts.today.cursor.go, 1);
  await call('/connect/go/cursor', { headers: NAV, ip: '203.0.113.11' }); await tick(); assert.equal((await counts()).counts.today.cursor.go, 2);
});
await proof('the sea itself, crawlers, programs, browsers without marks, driven browsers and prefetches are sent on but never counted', async () => {
  const before = (await counts()).counts.sums.all.go;
  const tries = [
    { 'user-agent': 'MareLiberum-session/1.0', accept: HTML },
    { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', accept: HTML },
    { 'user-agent': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)', accept: HTML },
    { 'user-agent': 'curl/8.5.0', accept: '*/*' },
    { 'user-agent': CHROME, accept: HTML },
    { ...NAV, 'user-agent': CHROME.replace('Chrome/', 'HeadlessChrome/') },
    { ...NAV, 'sec-purpose': 'prefetch' },
    { ...NAV, purpose: 'prefetch' },
    { ...NAV, 'sec-fetch-mode': 'no-cors' },
  ];
  for (const [i, h] of tries.entries()) { const r = await call('/connect/go/vscode', { headers: h, ip: `203.0.113.${50 + i}` }); assert.equal(r.status, 302); assert.equal(r.headers.get('location'), byId.vscode.go); }
  await tick(); const j = await counts(); assert.equal(j.counts.sums.all.go, before); assert.equal(j.counts.today.vscode, undefined);
});
await proof('a press of Copy on the page counts as copied (204), from the same site only', async () => {
  const same = await call('/connect/go/windsurf', { method: 'POST', headers: { 'user-agent': CHROME, 'sec-fetch-mode': 'no-cors', 'sec-fetch-site': 'same-origin', 'sec-fetch-dest': 'empty' }, ip: '203.0.113.20' });
  const cross = await call('/connect/go/windsurf', { method: 'POST', headers: { 'user-agent': CHROME, 'sec-fetch-mode': 'no-cors', 'sec-fetch-site': 'cross-site', 'sec-fetch-dest': 'empty' }, ip: '203.0.113.21' });
  assert.equal(same.status, 204); assert.equal(cross.status, 204);
  await tick(); assert.deepEqual((await counts()).counts.today.windsurf, { go: 0, copy: 1 });
});
await proof('a copy-only client sends its button to its place on the page, counted the same way', async () => {
  const r = await call('/connect/go/claude-code', { headers: NAV, ip: '203.0.113.30' }); assert.equal(r.status, 302); assert.equal(r.headers.get('location'), `${BASE}/connect#claude-code`);
  await tick(); assert.equal((await counts()).counts.today['claude-code'].go, 1);
});
await proof('the counts are written down and read back by a new counter on the same store; zero stays zero', async () => {
  const k2 = memoryKv(), c1 = createConnect(k2), m = { ip: '1.2.3.4', ua: CHROME, kind: 'browser', mode: 'navigate' };
  assert.equal(c1.count('zed', 'go', m), true); assert.equal(c1.count('zed', 'go', m), false); assert.equal(c1.count('nope', 'go', m), false); await c1.settle();
  const s = await createConnect(k2).stats(); assert.deepEqual(s.today.zed, { go: 1, copy: 0 }); assert.equal(s.since, TODAY); assert.deepEqual(s.sums.all, { go: 1, copy: 0 });
  const e = await createConnect(memoryKv()).stats(); assert.deepEqual(e.sums.all, { go: 0, copy: 0 }); assert.equal(e.since, null);
  assert.equal(countable({ kind: 'browser', mode: 'navigate', own: true }, 'go'), false); assert.equal(countable({ kind: 'browser', mode: 'navigate', readOnly: true }, 'go'), false);
});

console.log('no open redirect');
await proof('a button leads only where the fixed table says: unknown clients, addresses and tricks answer 404', async () => {
  for (const p of ['/connect/go/evil.com', '/connect/go/https:%2F%2Fevil.com', '/connect/go/..%2F..%2Fmcp', '/connect/go/%2F%2Fevil.com', '/connect/go/cursor%00', '/connect/go/' + 'a'.repeat(30)]) {
    const r = await call(p, { headers: NAV }); assert.equal(r.status, 404, p); assert.equal(r.headers.get('location'), null, p);
  }
  const q = await call('/connect/go/cursor?to=https://evil.com&url=https://evil.com', { headers: NAV }); assert.equal(q.headers.get('location'), byId.cursor.go);
  const up = await call('/connect/go/CURSOR', { headers: NAV }); assert.equal(up.headers.get('location'), byId.cursor.go);
  const targets = new Set(list.map((c) => goTarget(BASE, c.id)));
  for (const c of list) { const r = await call(`/connect/go/${c.id}`, { headers: { 'user-agent': 'MareLiberum-session/1.0' } }); assert.equal(r.status, 302); assert.ok(targets.has(r.headers.get('location')), c.id); }
  for (const t of targets) assert.ok(/^(cursor|vscode|vscode-insiders|lmstudio|goose):/.test(t) || t.startsWith('https://claude.ai/') || t.startsWith('https://chatgpt.com/') || t.startsWith(`${BASE}/connect#`), t);
});

console.log('the page, its data and its Markdown');
let PAGE = '';
await proof('/connect: the sea\'s look with a told scene, a multi-word title, a box per client, counted buttons with nofollow', async () => {
  const r = await call('/connect', { headers: NAV }); PAGE = r.text;
  assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /text\/html/);
  assert.match(PAGE, /<html[^>]*data-zone="1"[^>]*class="story"/); assert.match(PAGE, /<ol class="beats"/); assert.match(PAGE, /data-scene="threads"/);
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(PAGE)[1]; assert.ok(h1.split(/\s+/).length >= 4, h1);
  const title = /<title>([^<]*)<\/title>/.exec(PAGE)[1], desc = /<meta name="description" content="([^"]*)"/.exec(PAGE)[1];
  assert.ok(title.length <= 75, title); assert.ok(desc.length >= 100 && desc.length <= 170, `${desc.length}`);
  assert.match(PAGE, new RegExp(`<link rel="canonical" href="${BASE}/connect">`));
  for (const c of list) assert.ok(PAGE.includes(`id="${c.id}"`), c.id);
  for (const c of list.filter((x) => x.go)) assert.ok(PAGE.includes(`<a class="buy" href="/connect/go/${c.id}" rel="nofollow">`), c.id);
  assert.equal((PAGE.match(/<pre data-c="/g) || []).length, list.reduce((n, c) => n + (c.copy || []).length, 0));
  assert.match(PAGE, /navigator\.sendBeacon\('\/connect\/go\/'/);
  const table = /<table[\s\S]*?<\/table>/.exec(PAGE)?.[0] || ''; assert.ok(table.includes('href="#cursor"') && table.includes('href="#windsurf"') && table.includes('href="#claude-code"'), 'the pressed clients are listed');
  assert.ok(!table.includes('href="#zed"') && !table.includes('href="#vscode"'), 'a client nobody pressed stands only in its box, at 0');
  for (const h3 of PAGE.matchAll(/<div class="box"[^>]*>\s*<(h\d)/g)) assert.equal(h3[1], 'h3');
});
await proof('the structured data parses: SoftwareApplication (DeveloperApplication, Any, price 0), two WebAPIs with documentation, breadcrumbs', () => {
  const g = lds(PAGE).flatMap((j) => j['@graph'] || [j]);
  const app = g.find((x) => x['@type'] === 'SoftwareApplication'); assert.ok(app);
  assert.equal(app.applicationCategory, 'DeveloperApplication'); assert.equal(app.operatingSystem, 'Any'); assert.equal(app.offers.price, '0'); assert.equal(app.offers.priceCurrency, 'EUR'); assert.ok(app.name && app.url && app.description);
  const apis = g.filter((x) => x['@type'] === 'WebAPI'); assert.equal(apis.length, 2);
  assert.deepEqual(apis.map((x) => x.url).sort(), [OPEN, APP].sort()); for (const a of apis) assert.ok(a.documentation && a.provider && a.name && a.description);
  assert.ok(g.find((x) => x['@type'] === 'BreadcrumbList')); assert.ok(g.find((x) => x['@type'] === 'Organization'));
  assert.ok(!flat(g).some((x) => x.aggregateRating || x.review), 'no rating that nobody gave');
});
await proof('/connect.json: every client with its button, its door and its counts; the tool lists of both doors measured from what the doors serve', async () => {
  const r = await call('/connect.json', { headers: { accept: 'application/json' } }), j = JSON.parse(r.text);
  assert.equal(r.status, 200); assert.match(r.headers.get('x-robots-tag'), /noindex/); assert.equal(j.clients.length, 20);
  for (const c of j.clients) { assert.equal(c.button, `${BASE}/connect/go/${c.id}`); assert.equal(c.opens, goTarget(BASE, c.id)); assert.ok(c.counted); }
  const rpc = async (path) => JSON.parse(await (await handle(new Request(BASE + path, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'user-agent': 'mare-proof/1.0', 'x-forwarded-for': '198.18.9.1' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) }), db, cfg)).text()).result.tools;
  const [a, o] = [await rpc('/mcp/app'), await rpc('/mcp')], n = (v) => Buffer.byteLength(JSON.stringify(v));
  assert.equal(j.doors.app.tools, a.length); assert.equal(j.doors.app.toolListBytes, n(a)); assert.equal(j.doors.open.tools, o.length); assert.equal(j.doors.open.toolListBytes, n(o));
  assert.ok(j.doors.app.toolListBytes * 3 < j.doors.open.toolListBytes, 'the app door is the lighter one');
  const asked = JSON.parse((await call('/connect', { headers: { accept: 'application/json' } })).text); assert.equal(asked.clients.length, 20);
});
await proof('/connect.md and Accept: text/markdown give the page as Markdown, not indexed as a copy', async () => {
  const r = await call('/connect.md', { headers: { accept: '*/*' } }); assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /text\/markdown/); assert.match(r.headers.get('x-robots-tag'), /noindex/);
  assert.match(r.text, /^# Connect Claude, ChatGPT, Cursor and VS Code/); assert.ok(r.text.includes('claude mcp add --transport http mare-liberum'));
  const m = await call('/connect', { headers: { accept: 'text/markdown' } }); assert.match(m.headers.get('content-type'), /text\/markdown/);
});
await proof('the app door is byte for byte the door of main (tools/list, and initialize without the version)', async () => {
  const rpc = async (method, params) => JSON.parse(await (await handle(new Request(`${BASE}/mcp/app`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'user-agent': 'mare-proof/1.0', 'x-forwarded-for': '198.18.9.2' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) }), db, { base: BASE })).text());
  const l = await rpc('tools/list'), i = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'mare-proof', version: '1' } }); delete i.result.serverInfo.version;
  assert.equal(sha(l.result), 'daa60266448605a5af0d0d11d2c5685952f2b0c36fd36c0a76678836cc8229b0'); assert.equal(sha(i.result), '16217dddbea543a5c9b20d61bcb44b7d748a282d1b27a4077c748e922b823666');
});

console.log('the hubs for the search engines');
const NEW = ['/open', '/savings', '/proof', '/attention', '/claim', '/connect', '/brain/areas', '/brain/market', '/brain/thinking', '/pricing'];
await proof('/sitemaps/hubs.xml: every hub once (the 3.33.0 pages too), live hubs dated today, the rest STATIC_DAY, English and German pages naming each other', async () => {
  const r = await call('/sitemaps/hubs.xml'), x = r.text; assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /xml/);
  const locs = [...x.matchAll(/<url><loc>([^<]+)<\/loc>/g)].map((m) => m[1].slice(BASE.length) || '/');
  assert.equal(locs.length, HUBS.length); assert.equal(new Set(locs).size, locs.length, 'each hub once'); assert.deepEqual(locs, HUB_PATHS);
  for (const p of NEW) assert.ok(locs.includes(p), p);
  for (const [p, , live] of HUBS) assert.ok(x.includes(`<loc>${BASE}${p}</loc><lastmod>${live ? TODAY : STATIC_DAY}</lastmod>`), p);
  for (const [en, de] of Object.entries(HUB_ALT)) for (const p of [en, de]) {
    const u = new RegExp(`<loc>${BASE}${p.replace(/\//g, '\\/')}</loc>.*?</url>`).exec(x)[0];
    assert.ok(u.includes(`hreflang="en" href="${BASE}${en}"`) && u.includes(`hreflang="de" href="${BASE}${de}"`) && u.includes(`hreflang="x-default" href="${BASE}${en}"`), p);
  }
  assert.match(x, /xmlns:xhtml="http:\/\/www\.w3\.org\/1999\/xhtml"/); assert.equal(hubSitemap(BASE, TODAY), x);
});
await proof('/sitemap.xml names the hubs first, dated today; /sitemaps/site.xml holds no hub and keeps the addresses for agents', async () => {
  const idx = (await call('/sitemap.xml')).text; assert.match(idx, new RegExp(`^<\\?xml[^>]*\\?><sitemapindex[^>]*><sitemap><loc>${BASE}/sitemaps/hubs\\.xml</loc><lastmod>${TODAY}</lastmod></sitemap>`));
  const site = (await call('/sitemaps/site.xml')).text, locs = [...site.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].slice(BASE.length) || '/');
  for (const p of HUB_PATHS) assert.ok(!locs.includes(p), `hub ${p} stands in site.xml`);
  for (const p of ['/route', '/pulse', '/treasury', '/.well-known/agent-card.json', '/via/howto', '/pay/howto']) assert.ok(locs.includes(p), `${p} stays for agents (the till release lists it)`);
  assert.ok(locs.includes('/atlas/country/de') && locs.some((p) => p.startsWith('/brief/')) && locs.includes('/llms.txt'), 'the other pages stay');
  for (const m of ['site', 'brain', 'buy', 'briefs-i18n', 'sites-live']) assert.ok(idx.includes(`/sitemaps/${m}.xml`), m);
  assert.ok(idx.includes(`<loc>${BASE}/sitemaps/site.xml</loc></sitemap>`), 'site.xml is not dated by the build');
  assert.ok(!/<lastmod>/.test(site), 'no page of site.xml claims a day it did not change');
});

await proof('an entry page is dated by its own last change at its source; a day in the future is no day', async () => {
  const x = (await call('/sitemaps/0.xml')).text;
  assert.ok(x.includes(`<loc>${BASE}/e/example.org:mcp:demo</loc><lastmod>2026-10-05</lastmod>`), x.slice(0, 300));
  assert.ok(x.includes(`<loc>${BASE}/e/example.net:mcp:demo</loc></url>`), 'no lastmod from the future');
  assert.ok(!x.includes('<lastmod>2026-11-20</lastmod>'), 'not the day of the build');
});
await proof('robots.txt: the search engines leave the counted buttons and the answers to searches; AI crawlers keep what they could read', async () => {
  const { robotsGroups, robotsAllows } = await import('../node/check.mjs');
  const g = robotsGroups(readFileSync(new URL('../site/robots.txt', import.meta.url), 'utf8'));
  for (const ua of ['Googlebot', 'Bingbot', 'Applebot', 'YandexBot', 'DuckDuckBot']) {
    for (const p of ['/connect/go/cursor', '/c/x', '/find?q=shoes', '/brain?q=x', '/mcp-servers?q=pg', '/route?free=true&q=x', '/check?site=a.com', '/decide?need=x', '/brain/market?host=a.com', '/brain/thinking?task=x']) assert.equal(robotsAllows(g, ua, p).allowed, false, `${ua} ${p}`);
    for (const p of ['/', '/connect', '/brain', '/brain/areas', '/mcp-servers', '/check/a.com', '/site/a.com', '/savings', '/de/mcp-server']) assert.equal(robotsAllows(g, ua, p).allowed, true, `${ua} ${p}`);
  }
  for (const ua of ['ClaudeBot', 'GPTBot', 'OAI-SearchBot', 'PerplexityBot', 'Claude-User', 'ChatGPT-User']) for (const p of ['/connect', '/connect/go/cursor', '/find?q=shoes', '/brain?q=x', '/site/a.com']) assert.equal(robotsAllows(g, ua, p).allowed, true, `${ua} ${p}`);
});

console.log('the Atlas: no 404 and no adult name for a search engine');
// a site that answered, one with an adult name, one whose map failed, one never mapped
const prof = (d, s) => ({ d, s, at: '2026-11-22T10:00:00.000Z', t: `${d} home`, ds: 'A site', g: 'B' });
await kv.set('atlas:good-shop.com', prof('good-shop.com', 200), 864000); await kv.set('atlas:xfapsters.com', prof('xfapsters.com', 200), 864000); await kv.set('atlas:dead-shop.com', prof('dead-shop.com', 503), 864000);
await kv.set('atlas:recent', ['good-shop.com', 'xfapsters.com', 'dead-shop.com', 'never-mapped-site.com'], 864000);
const BOT = { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', accept: HTML };
await proof('the rule leaves out the name a search engine showed (xfapsters) and keeps the research foundations named fap…', () => {
  for (const d of ['xfapsters.com', 'www.xfapsters.net', 'fapello.com', 'pornhub.com', 'casino-x.com']) assert.equal(leftOut(d), true, d);
  for (const d of ['fapesp.br', 'fapemig.br', 'fapdf.df.gov.br', 'fapiao.com', 'mareliberum.dev', 'good-shop.com', 'essex.ac.uk']) assert.equal(leftOut(d), false, d);
  const build = readFileSync(new URL('./build.mjs', import.meta.url), 'utf8');
  assert.ok(!/const ADULT = \//.test(build) && build.includes("const { ADULT } = await import('../node/atlas.mjs')"), 'the build uses the same rule');
  assert.ok(ADULT.test('xfapsters.com'));
});
await proof('sites-live.xml lists only sites whose map answered, and none the Atlas leaves out', async () => {
  const x = (await call('/sitemaps/sites-live.xml')).text, locs = [...x.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.deepEqual(locs, [`${BASE}/site/good-shop.com`]); assert.ok(x.includes(`<loc>${BASE}/site/good-shop.com</loc><lastmod>2026-11-22</lastmod>`), 'dated by its map');
});
await proof('/site/<adult name> says noindex, nofollow; a site never mapped stays 404 for a crawler; a good one is indexable', async () => {
  const a = await call('/site/xfapsters.com', { headers: BOT }); assert.equal(a.status, 200); assert.equal(a.headers.get('x-robots-tag'), 'noindex, nofollow');
  const n = await call('/site/never-mapped-site.com', { headers: BOT }); assert.equal(n.status, 404); assert.match(n.headers.get('x-robots-tag'), /noindex/);
  const g = await call('/site/good-shop.com', { headers: BOT }); assert.equal(g.status, 200); assert.equal(g.headers.get('x-robots-tag'), null);
});
await proof('/sites links no site the Atlas leaves out', async () => {
  const p = (await call('/sites', { headers: NAV })).text; assert.ok(p.includes('/site/good-shop.com')); assert.ok(!p.includes('/site/xfapsters.com')); assert.ok(!p.includes('/site/dead-shop.com'));
});
await proof('a country page links only sites whose map answered; the rest are named without a link', () => {
  const html = countryPage(BASE, { cc: 'de', month: '202610', top: 3, count: 3, looked: 3, mapped: 2, sites: [{ site: 'good-shop.com', mapped: true, ok: true, grade: 'B' }, { site: 'dead-shop.com', mapped: true, ok: false }, { site: 'unmapped.example', mapped: false, ok: false }] });
  assert.ok(html.includes('href="/site/good-shop.com"')); assert.ok(!html.includes('href="/site/dead-shop.com"')); assert.ok(!html.includes('href="/site/unmapped.example"')); assert.ok(html.includes('unmapped.example'));
  assert.ok(!/href="\/site\/[^"]+">\/site\/&lt;domain&gt;/.test(html), 'the note links no site');
});
await proof('a door links the map of its site only when the Atlas holds it', () => {
  const html = routePage(BASE, { task: 'find a train', doors: [{ name: 'Rail search', kind: 'search', to: 'https://rail.example/s?q=x', map: `${BASE}/site/rail.example` }, { name: 'Bus search', kind: 'search', to: 'https://bus.example/s?q=x', map: `${BASE}/site/bus.example`, atlas: { grade: 'B' } }], general: [] });
  assert.ok(!html.includes(`href="${BASE}/site/rail.example"`)); assert.ok(html.includes(`href="${BASE}/site/bus.example"`));
});
await proof('IndexNow: hubs first (the 3.33.0 pages among them), then the pages that list, then what changed; no left-out, failed or unmapped site', async () => {
  let sent = null;
  globalThis.fetch = async (u, o) => { if (String(u) !== 'https://api.indexnow.org/indexnow') throw new Error(`no network: ${u}`); sent = JSON.parse(o.body); return new Response(null, { status: 202 }); };
  try {
    const out = await indexNowDaily(db, BASE, db.flow, { indexnowKey: 'proofkey0123456789', kv: memoryKv() });
    assert.equal(out.status, 202); assert.equal(sent.host, 'mareliberum.dev'); assert.equal(sent.key, 'proofkey0123456789'); assert.equal(sent.keyLocation, `${BASE}/proofkey0123456789.txt`);
    const paths = sent.urlList.map((u) => u.slice(BASE.length) || '/'); assert.ok(paths.length <= 10000);
    assert.deepEqual(paths.slice(0, HUB_PATHS.length), HUB_PATHS); for (const p of NEW) assert.ok(paths.indexOf(p) < HUB_PATHS.length, p);
    assert.ok(paths.indexOf('/llms.txt') === HUB_PATHS.length, 'the pages that list come next');
    const at = paths.indexOf('/site/good-shop.com'), lastList = Math.max(...paths.map((p, k) => (/^\/(routes|web)\/|^\/brief\/[a-z-]+$/.test(p) ? k : -1)));
    const firstThin = paths.findIndex((p) => /^\/(atlas\/country|check)\/|^\/brief\/[^/]+\/./.test(p));
    assert.ok(at > lastList, `a changed page (${at}) after the pages that list (${lastList})`); assert.ok(firstThin < 0 || at < firstThin, `a changed page (${at}) before the thin ones (${firstThin})`);
    for (const p of ['/site/xfapsters.com', '/site/dead-shop.com', '/site/never-mapped-site.com']) assert.ok(!paths.includes(p), p);
    assert.equal(new Set(paths).size, paths.length); assert.ok(out.order.hubs === HUB_PATHS.length && out.order.lists > 0);
  } finally { noNet(); }
});

console.log('every Dataset a search engine reads');
const isDataset = (x) => x && x['@type'] === 'Dataset';
const checkDataset = (d, where) => {
  assert.ok(d.name, `${where}: name`); assert.ok(typeof d.description === 'string' && d.description.length >= 50 && d.description.length <= 5000, `${where}: description of ${d.description?.length}`);
  assert.ok(d.creator?.name && /^https?:\/\//.test(d.creator.url || ''), `${where}: creator with url`); assert.ok(/^https?:\/\//.test(d.url || ''), `${where}: url`); assert.ok(/^https:\/\//.test(d.license || ''), `${where}: license`);
};
await proof('every Dataset on the pages that carry one has name, description (50 to 5,000 characters), creator with url, url and license', async () => {
  let seen = 0; const on = {};
  for (const p of ['/visitors', '/web', '/sites', '/routes', '/ai-crawlers', '/de/ki-crawler', '/current', '/weather', '/de/agentenwetter', '/site/good-shop.com', '/atlas/countries']) {
    const r = await call(p, { headers: NAV }); if (r.status !== 200) continue;
    for (const d of lds(r.text).flatMap(flat).filter(isDataset)) { checkDataset(d, p); seen++; on[p] = (on[p] || 0) + 1; }
  }
  // the page of one site carries the Atlas as the Dataset it is part of: the one Google found without a description
  for (const p of ['/site/good-shop.com', '/visitors', '/sites', '/routes', '/ai-crawlers', '/current', '/weather']) assert.ok(on[p] >= 1, `${p} shows its Dataset`);
  const b = { at: '2026-11-22', checked: 100, agents: [{ name: 'GPTBot', op: 'OpenAI', role: 'training', share: 30 }], sites: [{ host: 'a.example', blocked: ['GPTBot'] }] };
  for (const d of lds(webAgentPage(BASE, b, 'gptbot') || '').flatMap(flat).filter(isDataset)) { checkDataset(d, '/web/gptbot'); seen++; }
  assert.ok(seen >= 10, `only ${seen} Datasets seen`);
});
await proof('every Dataset written in the code names description, creator, url and license (a new one cannot forget them)', () => {
  const src = readdirSync(new URL('../node/', import.meta.url)).filter((f) => f.endsWith('.mjs')).map((f) => [f, readFileSync(new URL(`../node/${f}`, import.meta.url), 'utf8')]);
  let n = 0;
  for (const [f, s] of src) for (const m of s.matchAll(/'@type': 'Dataset'/g)) {
    let depth = 0, i = s.lastIndexOf('{', m.index), end = i; for (; end < s.length; end++) { if (s[end] === '{') depth++; else if (s[end] === '}' && --depth === 0) break; }
    const obj = s.slice(i, end + 1); n++;
    for (const k of ['name:', 'description:', 'creator:', 'url:', 'license:']) assert.ok(obj.includes(k), `${f}: a Dataset without ${k} ${obj.slice(0, 90)}`);
  }
  assert.ok(n >= 10, `${n} Datasets in the code`);
});

console.log(`\n${passed} proofs hold${failed ? `, ${failed} FAIL` : ''}`);
process.exit(failed ? 1 : 0);
