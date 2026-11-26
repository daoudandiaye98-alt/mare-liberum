// Mare Liberum · proof of the reader as a drop-in (D5 of the night of 25/26 Nov 2026, node/compat.mjs): Jina Reader's
// request headers on /r/ and Firecrawl's POST /v1/scrape and /v2/scrape, on the same reader with every protection it has.
// It proves, on nodes in this process (handle, as serve.mjs answers), with a stubbed web (no network, no live site):
//   without one of Jina's headers every answer of /r/ is byte for byte what origin/main sends (Markdown, format=full, JSON,
//   since=, budget=, If-None-Match, HEAD, errors, robots.txt, an Authorization header alone), and so is /mcp/app;
//   Jina's layout and JSON when asked; X-Return-Format markdown, text and html (html as text/plain, never a page of the
//   sea); the links summary; X-No-Cache a new read that counts like any read; the safe selectors and the unsafe ones named;
//   every other Jina header ignored and named, cookies and proxies never used;
//   Firecrawl's shape for v1 and v2 (markdown, html, rawHtml, links, metadata), formats as strings and objects, options the
//   reader does not have ignored and named in data.warning (never an error), custom headers never sent to the page;
//   onlyMainContent, includeTags, excludeTags, maxAge; Firecrawl's errors; a page that answers an error;
//   an Authorization header accepted and ignored: the same answer without it, never sent on, never kept, never logged;
//   the same protections: robots.txt, the egress gate (private names, IP literals, odd ports, a redirect inward), the
//   size limit, the free limit of 100 pages a day per network shared with /r/, the immune system's pace;
//   counted by the ledger's one rule only: once per network and page per UTC day across /r/ and the scrape doors, never for
//   crawlers or the sea's own calls, never an answer that hands the page's markup over; the page /reader and its twins.
// Negative controls at the end: each rule broken in a copy of the code, and this proof must fail there.
// Runs without the network (this machine and local git only): node tools/reader-compat-proof.mjs   (exit code 1 when a
// proof fails or a control is not caught)
//   --no-controls             only the proofs (the controls run this file that way in each broken copy)
//   MARE_READER_REF=<ref>      the tree the answers without the new headers must equal (default 2d6ca74: origin/main, 3.37.1)
//   MARE_READER_REF_DIR=<dir>  that tree already extracted (the controls hand it on; no git in their copies)
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, cpSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { Buffer } from 'node:buffer';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTROLS = !process.argv.includes('--no-controls');
for (const k of ['MARE_TOLL', 'MARE_ENGINE', 'MARE_FAIR', 'MARE_X402_FACILITATOR', 'MARE_PAY_TO', 'MARE_STATE', 'MARE_DB_URL', 'MARE_DB_KEY', 'MARE_DB_SECRET', 'MARE_BASE_RPC']) delete process.env[k];
// (one key for the /via/ addresses of both trees: without it each module signs with a key of its own)
process.env.MARE_VIA_SECRET = 'reader-proof-via-key, a test value';
let passed = 0, failed = 0;
// (each proof a minute later: the sea's pace per site, which the proof keeps, fills again; the UTC day stays the same)
const proof = async (name, fn) => {
  T0 += 60_000;
  try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 6).join('\n       ')}`); }
  if (failed && process.env.MARE_READER_FIRST_FAIL === '1') { console.log(`\n${passed} proofs held, ${failed} failed (stopped at the first)`); process.exit(1); }
};

// ------------------------------------------------------------------ one clock for every node of the proof
const D = globalThis.Date; let T0 = D.parse('2026-11-26T01:00:00.000Z');
class Clock extends D { constructor(...a) { if (a.length) super(...a); else super(T0); } static now() { return T0; } }
globalThis.Date = Clock;

// ------------------------------------------------------------------ the web of the proof: pages, robots.txt, DNS; every request written down
const SECRET = 'fc-reader-proof-SECRET-7f3a9c'; // an Authorization a caller sends: it must go nowhere
const P = 'https://pages.reader-proof.dev';
const words = (seed, n) => { let s = seed; const W = 'anchor ballast beacon buoy cargo chart crane dock draught ebb fender gangway hull jetty keel ledger lock mooring pilot quay rope rudder sail signal stern swell tide tug wharf winch harbour'.split(' '); return Array.from({ length: n }, () => W[(s = (s * 1103515245 + 12345) % 2147483648) % W.length]).join(' '); };
const HANDBOOK = `<!doctype html><html lang="en"><head><title>Harbour handbook</title><meta name="description" content="How the harbour works, berth by berth."><script>window.track && track('x')</script><style>body{color:red}</style></head>
<body><nav><a href="/">Home</a> <a href="/a">A</a> <a href="/b">B</a> <a href="/c">C</a></nav><main><h1>Harbour handbook</h1>
${Array.from({ length: 12 }, (_, i) => `<h2>Section ${i + 1}</h2><p>${words(i + 7, 40)}. See <a href="/s/${i + 1}">the notes of section ${i + 1}</a>.</p>`).join('\n')}
<div id="berths"><h2>Berths</h2><p>Berth one is deep enough for every ship of the line, at any tide, all year long.</p><p>Berth two waits for the next tide.</p></div>
<div class="ad promo"><p>Buy the premium harbour pass now and save forty percent on every mooring fee this season.</p></div>
<script>document.write('hidden')</script></main><footer><a href="/imprint">Imprint</a></footer></body></html>`;
const PAGES = new Map([
  [`${P}/handbook`, { body: HANDBOOK }],
  [`${P}/notes.txt`, { body: 'Plain notes of the harbour.\nLine two.', type: 'text/plain; charset=utf-8' }],
  [`${P}/missing`, { body: '<html><body>gone</body></html>', status: 404 }],
  [`${P}/away`, { status: 302, location: 'https://inner.reader-proof.dev/admin' }],
  [`${P}/big`, { body: `<html><head><title>Big</title></head><body><main><h1>Big</h1>${'<p>wharf and tide and keel and rope and anchor.</p>'.repeat(66_000)}</main></body></html>` }],
  ['https://closed.reader-proof.dev/page', { body: '<html><head><title>Closed</title></head><body><main><p>not for readers</p></main></body></html>' }],
  ['https://inner.reader-proof.dev/admin', { body: '<html><body>internal</body></html>' }],
]);
for (let i = 0; i < 130; i++) PAGES.set(`${P}/t/${i}.txt`, { body: `note ${i} of the harbour`, type: 'text/plain; charset=utf-8' });
const ROBOTS = { 'closed.reader-proof.dev': 'User-agent: MareLiberum-Reader\nDisallow: /\n' };
const outgoing = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (u, o = {}) => {
  const s = String(u?.url ?? u), h = Object.fromEntries(new Headers(o.headers || {})); outgoing.push({ url: s, headers: h, method: o.method || 'GET' });
  if (/^http:\/\/127\.0\.0\.1:\d+\//.test(s)) return realFetch(u, o);
  const url = new URL(s);
  if (url.pathname === '/robots.txt') return new Response(ROBOTS[url.hostname] || 'User-agent: *\nAllow: /\n', { status: 200, headers: { 'content-type': 'text/plain' } });
  const p = PAGES.get(s);
  if (p) return new Response(p.status === 302 ? null : p.body, { status: p.status || 200, headers: { 'content-type': p.type || 'text/html; charset=utf-8', ...(p.location ? { location: p.location } : {}) } });
  throw new Error(`the proof does not use the network: ${s.slice(0, 80)}`);
};
createRequire(import.meta.url)('node:dns').promises.lookup = async (host) => [{ address: /^inner\./.test(host) ? '10.0.0.7' : '93.184.216.34', family: 4 }];
const logs = [];
for (const k of ['log', 'error', 'warn', 'info']) { const f = console[k].bind(console); console[k] = (...a) => { logs.push(a.map(String).join(' ')); if (k === 'log') f(...a); }; }

// ------------------------------------------------------------------ the nodes: this tree and origin/main
const BASE = 'https://mare.test', SITE = { '/llms.txt': { body: readFileSync(join(ROOT, 'site/llms.txt'), 'utf8'), type: 'text/plain; charset=utf-8' } };
const UA = 'reader-proof-agent/1.0';
const imp = (dir, f) => import(pathToFileURL(join(dir, 'node', f)).href);
const recordingKv = (memoryKv) => { const k = memoryKv(), sets = []; return { get: (key) => k.get(key), set: (key, v, ttl) => { sets.push(JSON.stringify([key, v])); return k.set(key, v, ttl); }, sets }; };
async function nodeOf(rootDir) {
  const core = await imp(rootDir, 'core.mjs'), { createMem } = await imp(rootDir, 'mem.mjs'), { memoryKv } = await imp(rootDir, 'flow.mjs');
  const { immune } = await imp(rootDir, 'immune.mjs'), { createLedger } = await imp(rootDir, 'ledger.mjs'), { payConfig } = await imp(rootDir, 'pay.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'mare-reader-')), file = join(dir, 'sea.tsv');
  process.once('exit', () => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });
  writeFileSync(file, ''); writeFileSync(join(dir, 'build.json'), JSON.stringify({ builtAt: '2026-11-20T10:00:00.000Z', entries: 0, lakes: {} }));
  const db = createMem({ file, base: BASE }), kv = recordingKv(memoryKv), ledger = createLedger({});
  const cfg = { base: BASE, kv, ledger, pay: payConfig({}), site: SITE, waitUntil: () => {} };
  const call = async (path, { method = 'GET', accept = 'text/markdown, text/plain;q=0.9, */*;q=0.5', ua = UA, ip, headers = {}, body, head = false } = {}) => {
    assert.ok(ip, 'every call of the proof names its network');
    const h = { accept, 'user-agent': ua, 'x-forwarded-for': ip, ...(body !== undefined && typeof body !== 'string' ? { 'content-type': 'application/json' } : {}), ...headers };
    const res = await core.handle(new Request(BASE + path, { method, headers: h, ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}) }), db, { ...cfg, ...(head ? { head: true } : {}) });
    const buf = res.body ? Buffer.from(await res.arrayBuffer()) : Buffer.alloc(0), text = buf.toString('utf8'); let j = null; try { j = JSON.parse(text); } catch {}
    return { status: res.status, headers: res.headers, h: Object.fromEntries(res.headers), text, j };
  };
  await call('/stats', { ua: 'MareLiberum-session/1.0', ip: '127.0.0.1' }); // wakes the sea of the node
  immune.set({ mode: 'normal', rest: [], pace: { perMinute: 1_000_000, burst: 1_000_000 } });
  const sea = () => core.seaOf(db, cfg, BASE);
  return { core, db, cfg, kv, ledger, call, immune, sea, rootDir };
}
const REF = process.env.MARE_READER_REF || '2d6ca74e2efa6560fa1ade46ba9713e02a8afcab';
const refDir = (() => {
  const given = process.env.MARE_READER_REF_DIR; if (given && existsSync(join(given, 'node/core.mjs'))) return given;
  const dir = mkdtempSync(join(tmpdir(), 'mare-reader-ref-'));
  const r = spawnSync('sh', ['-c', 'git -C "$1" archive "$2" | tar -x -C "$3"', 'sh', ROOT, REF, dir], { encoding: 'utf8' });
  return r.status === 0 && existsSync(join(dir, 'node/core.mjs')) ? dir : null;
})();
// a receipt of fair share carries a random id: the one part of an answer that differs between two runs of the same code
// the version is the only thing a release changes on these answers: it is masked (a release bumps it, a builder branch does not)
const VERSIONS = new Set();
const steady = (s) => { let t = String(s).replace(/\br\d{8}[a-z0-9]{8}\b/g, 'r<id>'); for (const v of VERSIONS) t = t.split(v).join('<version>'); return t; };
// (since 26.11.2026, tools/reader-code-proof.mjs) code keeps its lines: inside a fenced code block of an answer only the
// whitespace may differ from the reference (it is read here as the reference wrote it: each line run together and trimmed,
// blank lines at most one); everything around the code stays byte for byte
const codeAsBefore = (s) => { const out = []; let fence = null, buf = []; for (const l of String(s).split('\n')) { if (!fence) { const o = /^(`{3,}|~{3,})/.exec(l); out.push(l); if (o) { fence = o[1]; buf = []; } continue; } if (new RegExp(`^${fence[0] === '`' ? '`' : '~'}{${fence.length},}\\s*$`).test(l)) { out.push(buf.map((x) => x.replace(/[ \t\u00a0]+/g, ' ').trim()).join('\n').replace(/\n(- )?\n(?=- )/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '')); out.push(l); fence = null; continue; } buf.push(l); } if (fence) out.push(...buf); return out.join('\n'); };
const same = (a, b, what) => { assert.equal(a.status, b.status, `${what}: status`); assert.equal(steady(codeAsBefore(a.text)), steady(codeAsBefore(b.text)), `${what}: body`); assert.deepEqual(Object.fromEntries(Object.entries(a.h).map(([k, v]) => [k, steady(v)])), Object.fromEntries(Object.entries(b.h).map(([k, v]) => [k, steady(v)])), `${what}: headers`); };
const savingsOf = async (n) => { const v = await n.sea().savings(); return { reads: v?.today?.counts?.reads || 0, readBytes: v?.today?.counts?.readBytes || 0 }; };

const node = await nodeOf(ROOT);
const ref = refDir ? await nodeOf(refDir) : null;
if (ref) for (const v of [node.core.VERSION, ref.core.VERSION]) VERSIONS.add(v);
let net = 0; const fresh = () => `198.51.100.${++net}`;

console.log('without the new headers: /r/ and /mcp/app byte for byte as on origin/main');
await proof(`the reference tree is there (${REF.slice(0, 7)})`, () => { assert.ok(ref, 'git archive of the reference failed: set MARE_READER_REF_DIR'); assert.ok(/^\d+\.\d+\.\d+$/.test(node.core.VERSION) && /^\d+\.\d+\.\d+$/.test(ref.core.VERSION), 'both trees name a version'); });
await proof('every /r/ answer without Jina\'s headers equals origin/main (Markdown, full, JSON, since=, budget=, If-None-Match, HEAD, errors, robots, egress, Authorization alone)', async () => {
  const ip = fresh(), url = `/r/${P}/handbook`;
  const cases = [
    [url, {}], [url, { accept: '*/*' }], [`${url}?format=full`, {}], [`${url}?format=json`, {}], [url, { accept: 'application/json' }], [`${url}?budget=120`, {}], [`${url}?q=berths+at+low+tide`, {}],
    [url, { headers: { authorization: `Bearer ${SECRET}` } }], [url, { headers: { dnt: '1' } }], [url, { head: true }],
    [`/r/${P}/missing`, {}], [`/r/${P}/notes.txt`, {}], ['/r/https://closed.reader-proof.dev/page', {}], ['/r/https://inner.reader-proof.dev/admin', {}], [`/r/${P}/away`, {}], ['/r/http://127.0.0.1/', {}], [`/r/${P.replace('https', 'http')}:22/x`, {}],
    [`/read?url=${encodeURIComponent(`${P}/handbook`)}`, {}], ['/read', {}], ['/r', { accept: 'text/html' }],
  ];
  for (const [p, o] of cases) same(await node.call(p, { ip, ...o }), await ref.call(p, { ip, ...o }), `${p} ${JSON.stringify(o)}`);
  // the engine's levers: the ETag the first answer named, read again with since= and If-None-Match
  const first = await node.call(url, { ip }), tag = /e1-[0-9a-f]{20}/.exec(first.h.etag || '')?.[0]; assert.ok(tag, 'the default answer names its ETag');
  for (const [p, o] of [[`${url}?since=${tag}`, {}], [url, { headers: { 'if-none-match': `W/"${tag}"` } }], [url, { head: true, headers: { 'if-none-match': `W/"${tag}"` } }]]) same(await node.call(p, { ip, ...o }), await ref.call(p, { ip, ...o }), `${p} ${JSON.stringify(o)}`);
  // the copy of the last hour, when a read in another reader's form put it there (markup and selectors), is the copy of before
  const w = fresh(), late = fresh();
  for (const page of ['notes.txt', 'handbook-copy']) {
    PAGES.set(`${P}/handbook-copy`, { body: HANDBOOK.replace('Harbour handbook</title>', 'Harbour handbook, a copy</title>') });
    await node.call('/v2/scrape', { method: 'POST', accept: 'application/json', ip: w, body: { url: `${P}/${page}`, formats: ['markdown', 'rawHtml', 'html'] } });
    await node.call(`/r/${P}/${page}`, { ip: w, headers: { 'x-target-selector': 'main' } });
    await ref.call(`/r/${P}/${page}?format=json`, { ip: w });
    for (const o of [{}, { accept: 'application/json' }]) same(await node.call(`/r/${P}/${page}`, { ip: late, ...o }), await ref.call(`/r/${P}/${page}`, { ip: late, ...o }), `the copy of ${page} ${JSON.stringify(o)}`);
  }
});
await proof('/mcp/app equals origin/main (GET, initialize, tools/list, tools/call read_page)', async () => {
  const ip = fresh(), rpc = (method, params) => ({ method: 'POST', accept: 'application/json, text/event-stream', ip, body: { jsonrpc: '2.0', id: 1, method, ...(params ? { params } : {}) } });
  same(await node.call('/mcp/app', { ip, accept: 'application/json' }), await ref.call('/mcp/app', { ip, accept: 'application/json' }), 'GET /mcp/app');
  for (const [m, p] of [['initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'reader-proof', version: '1' } }], ['tools/list', null], ['tools/call', { name: 'read_page', arguments: { url: `${P}/handbook` } }]]) same(await node.call('/mcp/app', rpc(m, p)), await ref.call('/mcp/app', rpc(m, p)), `/mcp/app ${m}`);
});

console.log('Jina-style: the headers of Jina Reader on /r/');
const lean = async (ip) => (await node.call(`/r/${P}/handbook?format=json`, { ip })).j;
await proof('X-Return-Format: markdown gives Jina\'s layout: Title, URL Source, Markdown Content (the reader\'s Markdown), as text/plain, no ETag', async () => {
  const ip = fresh(), r = await node.call(`/r/${P}/handbook`, { ip, headers: { 'x-return-format': 'markdown', 'x-no-cache': 'true' } }), j = await lean(ip);
  assert.equal(r.status, 200); assert.match(r.h['content-type'], /^text\/plain/); assert.equal(r.h['x-content-type-options'], 'nosniff'); assert.equal(r.h.etag, undefined);
  assert.equal(r.text, `Title: Harbour handbook\n\nURL Source: ${P}/handbook\n\nMarkdown Content:\n${j.markdown}\n`);
  const r2 = await node.call(`/r/${P}/handbook`, { ip, headers: { 'x-respond-with': 'content' } }); assert.match(r2.text, /^Title: Harbour handbook\n\nURL Source: /); assert.match(r2.text, /\nWarning: a copy from the last hour/);
});
await proof('X-Respond-With: text gives the words only; X-Return-Format: html the page\'s markup as text/plain (never dressed as a page of the sea)', async () => {
  const ip = fresh(), t = await node.call(`/r/${P}/handbook`, { ip, headers: { 'x-respond-with': 'text' } });
  assert.equal(t.status, 200); assert.ok(!/^Title:/.test(t.text) && !/\]\(https?:/.test(t.text) && !/^#/m.test(t.text), 'no layout, no link marks, no heading marks'); assert.match(t.text, /Harbour handbook/); assert.match(t.text, /Berth one is deep enough/);
  const h = await node.call(`/r/${P}/handbook`, { ip, headers: { 'x-return-format': 'html' } });
  assert.equal(h.status, 200); assert.equal(h.text, HANDBOOK); assert.match(h.h['content-type'], /^text\/plain/); assert.equal(h.h['x-content-type-options'], 'nosniff'); assert.ok(!/MareLiberum|shown\?p=/.test(h.text), 'the page is not dressed by the sea');
});
await proof('X-With-Links-Summary: true ends with Links/Buttons:, one line per link, full addresses', async () => {
  const ip = fresh(), r = await node.call(`/r/${P}/handbook`, { ip, headers: { 'x-return-format': 'markdown', 'x-with-links-summary': 'true' } }), j = await lean(ip);
  const tail = r.text.split('\n\nLinks/Buttons:\n')[1]; assert.ok(tail, 'a Links/Buttons: section'); const lines = tail.trim().split('\n');
  assert.equal(lines.length, j.links.length); for (const l of lines) assert.match(l, /^- \[[^\]]*\]\(https:\/\/pages\.reader-proof\.dev\/[^)]*\)$/);
});
await proof('X-No-Cache: true reads the page again (no copy of the last hour) and counts like any read; without it the copy is handed out', async () => {
  const ip = fresh(), n0 = outgoing.filter((x) => x.url === `${P}/handbook`).length;
  await node.call(`/r/${P}/handbook`, { ip, headers: { 'x-return-format': 'markdown' } });
  assert.equal(outgoing.filter((x) => x.url === `${P}/handbook`).length, n0, 'the copy of the last hour');
  const r = await node.call(`/r/${P}/handbook`, { ip, headers: { 'x-return-format': 'markdown', 'x-no-cache': 'true' } });
  assert.equal(outgoing.filter((x) => x.url === `${P}/handbook`).length, n0 + 1, 'a new read'); assert.ok(!/Warning: a copy/.test(r.text));
  const t = await node.call(`/r/${P}/handbook`, { ip, headers: { 'x-cache-tolerance': '0' } }); assert.equal(outgoing.filter((x) => x.url === `${P}/handbook`).length, n0 + 2, 'X-Cache-Tolerance: 0 too'); assert.equal(t.status, 200);
});
await proof('X-Target-Selector keeps only #berths; X-Remove-Selector takes .ad out; an unsafe selector is named, never read', async () => {
  const ip = fresh(), t = await node.call(`/r/${P}/handbook`, { ip, headers: { 'x-return-format': 'markdown', 'x-target-selector': '#berths' } });
  assert.match(t.text, /Berth one is deep enough/); assert.ok(!/Section 3/.test(t.text) && !/premium harbour pass/.test(t.text), 'only the berths'); assert.match(t.text, /^Title: Harbour handbook\n/);
  const rm = await node.call(`/r/${P}/handbook`, { ip, headers: { 'x-return-format': 'markdown', 'x-remove-selector': 'div.ad, nav' } });
  assert.ok(!/premium harbour pass/.test(rm.text), 'the ad is out'); assert.match(rm.text, /Section 12/);
  const bad = await node.call(`/r/${P}/handbook`, { ip, headers: { 'x-return-format': 'markdown', 'x-target-selector': 'main > p:first-child' } });
  assert.equal(bad.status, 200); assert.match(bad.text, /Warning: selector "main > p:first-child" \(only tag, #id and \.class are read\)/); assert.match(bad.text, /Section 12/);
  const none = await node.call(`/r/${P}/handbook`, { ip, headers: { 'x-target-selector': '#nothing-here' } }); assert.match(none.text, /X-Target-Selector matched nothing/); assert.match(none.text, /Section 12/);
});
await proof('every other Jina header is ignored and named on the Warning: line; cookies and proxies are never used', async () => {
  const ip = fresh(), before = outgoing.length;
  const r = await node.call(`/r/${P}/handbook`, { ip, headers: { 'x-set-cookie': 'session=abc123', 'x-proxy-url': 'http://proxy.reader-proof.dev:3128', 'x-with-images-summary': 'true', 'x-engine': 'browser', 'x-timeout': '30', 'x-md-heading-style': 'setext', 'x-no-cache': 'true' } });
  assert.equal(r.status, 200); for (const k of ['X-Set-Cookie', 'X-Proxy-Url', 'X-With-Images-Summary', 'X-Engine', 'X-Timeout', 'X-Md-*']) assert.ok(r.text.includes(k), `${k} named`);
  const sent = outgoing.slice(before); assert.ok(sent.length >= 1, 'the page was read'); for (const x of sent) { assert.ok(!/proxy\.reader-proof/.test(x.url), 'no proxy'); assert.ok(!Object.keys(x.headers).some((k) => /cookie|authorization|proxy/i.test(k)), 'no cookie, no key, no proxy header'); }
});
await proof('Accept: application/json with a Jina header gives Jina\'s JSON {code, status, data: {title, description, url, content, usage}}; errors in its form', async () => {
  const ip = fresh(), r = await node.call(`/r/${P}/handbook`, { ip, accept: 'application/json', headers: { 'x-return-format': 'markdown', 'x-with-links-summary': 'true' } }), j = await lean(ip);
  assert.equal(r.status, 200); assert.equal(r.j.code, 200); assert.equal(r.j.status, 20000); assert.equal(r.j.data.title, 'Harbour handbook'); assert.equal(r.j.data.description, 'How the harbour works, berth by berth.');
  assert.equal(r.j.data.url, `${P}/handbook`); assert.equal(r.j.data.content, j.markdown); assert.ok(r.j.data.usage.tokens > 0); assert.equal(Object.keys(r.j.data.links).length > 0, true);
  const b = await node.call('/r/https://closed.reader-proof.dev/page', { ip, accept: 'application/json', headers: { 'x-return-format': 'markdown' } });
  assert.equal(b.status, 403); assert.equal(b.j.code, 403); assert.equal(b.j.data, null); assert.match(b.j.message, /robots\.txt/);
  const plain = await node.call('/r/https://closed.reader-proof.dev/page', { ip, headers: { 'x-return-format': 'markdown' } }); assert.equal(plain.status, 403); assert.match(plain.text, /^Error: .*robots\.txt/);
});

console.log('Firecrawl-compatible: POST /v1/scrape and /v2/scrape');
await proof('v1 and v2: {success: true, data: {markdown, metadata: {title, description, language, sourceURL, url, statusCode}}}; the reader\'s Markdown', async () => {
  const ip = fresh(), j = await lean(ip);
  for (const v of [1, 2]) {
    const r = await node.call(`/v${v}/scrape`, { method: 'POST', accept: 'application/json', ip, body: { url: `${P}/handbook` } });
    assert.equal(r.status, 200, `v${v}`); assert.match(r.h['content-type'], /^application\/json/); assert.equal(r.j.success, true);
    assert.equal(r.j.data.markdown, j.markdown); assert.deepEqual(Object.keys(r.j.data), ['markdown', 'metadata']);
    const m = r.j.data.metadata; assert.equal(m.title, 'Harbour handbook'); assert.equal(m.description, 'How the harbour works, berth by berth.'); assert.equal(m.language, 'en'); assert.equal(m.sourceURL, `${P}/handbook`); assert.equal(m.url, `${P}/handbook`); assert.equal(m.statusCode, 200);
  }
});
await proof('formats markdown, html, rawHtml, links (strings or {type}); html without scripts or styles, rawHtml the page as it came, links full addresses', async () => {
  const ip = fresh(), r = await node.call('/v2/scrape', { method: 'POST', accept: 'application/json', ip, body: { url: `${P}/handbook`, formats: ['markdown', { type: 'html' }, 'rawHtml', { type: 'links' }] } });
  assert.equal(r.status, 200); const d = r.j.data; assert.equal(d.rawHtml, HANDBOOK); assert.match(d.html, /Berth one is deep enough/); assert.ok(!/<script|<style|track\(/.test(d.html), 'no scripts, no styles');
  assert.ok(d.links.length > 0 && d.links.every((u) => /^https:\/\/pages\.reader-proof\.dev\//.test(u))); assert.ok(d.markdown.length > 0); assert.equal(d.warning, undefined, 'nothing ignored');
});
await proof('options the reader does not have are ignored and named in data.warning, never an error; custom headers never reach the page', async () => {
  const ip = fresh(), before = outgoing.length;
  const r = await node.call('/v1/scrape', { method: 'POST', accept: 'application/json', ip, body: { url: `${P}/handbook`, formats: ['markdown', 'screenshot', { type: 'json', schema: { type: 'object' } }], headers: { Cookie: 'session=abc', 'X-Api-Key': 'k' }, actions: [{ type: 'click', selector: '#x' }], waitFor: 2000, mobile: true, location: { country: 'DE' }, proxy: 'stealth', skipTlsVerification: true, zeroDataRetention: true, jsonOptions: { prompt: 'x' }, origin: 'python-sdk@4.57.0', blockAds: true, timeout: 30000 } });
  assert.equal(r.status, 200); assert.equal(r.j.success, true); assert.ok(r.j.data.markdown.length > 0);
  for (const k of ['formats: screenshot', 'formats: json', 'headers', 'actions', 'waitFor', 'mobile', 'location', 'proxy', 'skipTlsVerification', 'zeroDataRetention', 'jsonOptions']) assert.ok(r.j.data.warning.includes(k), `${k} named`);
  for (const k of ['origin', 'blockAds', 'timeout']) assert.ok(!new RegExp(`\\b${k}\\b`).test(r.j.data.warning), `${k} quiet`);
  for (const x of outgoing.slice(before)) assert.ok(!Object.keys(x.headers).some((k) => /cookie|x-api-key|authorization/i.test(k)), 'no header of the caller goes to the page');
  const quiet = await node.call('/v2/scrape', { method: 'POST', accept: 'application/json', ip, body: { url: `${P}/handbook`, formats: ['markdown'], onlyMainContent: true, maxAge: 172800000, waitFor: 0, mobile: false, headers: {}, actions: [], removeBase64Images: true, storeInCache: true } });
  assert.equal(quiet.j.data.warning, undefined, 'values that ask for nothing are not named');
});
await proof('onlyMainContent: false gives the reader\'s long Markdown (format=full); includeTags and excludeTags narrow the page', async () => {
  const ip = fresh(), full = await node.call('/v2/scrape', { method: 'POST', accept: 'application/json', ip, body: { url: `${P}/handbook`, onlyMainContent: false } });
  const f = await node.call(`/r/${P}/handbook?format=full`, { ip }); assert.ok(f.text.includes(full.j.data.markdown), 'the Markdown of format=full');
  const inc = await node.call('/v2/scrape', { method: 'POST', accept: 'application/json', ip, body: { url: `${P}/handbook`, includeTags: ['#berths'] } });
  assert.match(inc.j.data.markdown, /Berth one/); assert.ok(!/Section 3/.test(inc.j.data.markdown)); assert.equal(inc.j.data.metadata.title, 'Harbour handbook');
  const exc = await node.call('/v2/scrape', { method: 'POST', accept: 'application/json', ip, body: { url: `${P}/handbook`, excludeTags: ['.ad'] } }); assert.ok(!/premium harbour pass/.test(exc.j.data.markdown)); assert.match(exc.j.data.markdown, /Section 12/);
  const bad = await node.call('/v2/scrape', { method: 'POST', accept: 'application/json', ip, body: { url: `${P}/handbook`, includeTags: ['div[data-x]'] } }); assert.equal(bad.status, 200); assert.match(bad.j.data.warning, /tag "div\[data-x\]"/);
});
await proof('maxAge: v1 reads anew unless told, v2 may hand out the copy of the last hour, maxAge below an hour reads anew', async () => {
  const ip = fresh(), n = () => outgoing.filter((x) => x.url === `${P}/notes.txt`).length, n0 = n();
  await node.call('/v2/scrape', { method: 'POST', accept: 'application/json', ip, body: { url: `${P}/notes.txt` } }); const n1 = n();
  await node.call('/v2/scrape', { method: 'POST', accept: 'application/json', ip, body: { url: `${P}/notes.txt` } }); assert.equal(n(), n1, 'v2: the copy');
  const c = await node.call('/v2/scrape', { method: 'POST', accept: 'application/json', ip, body: { url: `${P}/notes.txt` } }); assert.equal(c.j.data.metadata.cacheState, 'hit');
  await node.call('/v1/scrape', { method: 'POST', accept: 'application/json', ip, body: { url: `${P}/notes.txt` } }); assert.equal(n(), n1 + 1, 'v1: a new read');
  await node.call('/v2/scrape', { method: 'POST', accept: 'application/json', ip, body: { url: `${P}/notes.txt`, maxAge: 60000 } }); assert.equal(n(), n1 + 2, 'maxAge 60 s: a new read'); assert.ok(n0 <= n1);
});
await proof('Firecrawl\'s errors: GET 405, no url 400, not JSON 400, too large 400; robots.txt 403; a page that answers 404: success with statusCode and error', async () => {
  const ip = fresh(), post = (body) => node.call('/v2/scrape', { method: 'POST', accept: 'application/json', ip, body });
  const g = await node.call('/v1/scrape', { ip, accept: 'application/json' }); assert.equal(g.status, 405); assert.equal(g.j.success, false); assert.match(g.j.error, /POST/);
  for (const b of [{}, { url: '' }, { url: 7 }, [1], 'not json', JSON.stringify({ url: `${P}/handbook`, pad: 'x'.repeat(70_000) })]) { const r = await post(b); assert.equal(r.status, 400, JSON.stringify(b).slice(0, 40)); assert.equal(r.j.success, false); assert.equal(r.j.code, 'BAD_REQUEST'); assert.ok(r.j.error); }
  for (const more of [{}, { formats: ['rawHtml'] }, { formats: ['html', 'links'] }, { includeTags: ['main'] }, { excludeTags: ['nav'], maxAge: 0 }]) { const rb = await post({ url: 'https://closed.reader-proof.dev/page', ...more }); assert.equal(rb.status, 403, JSON.stringify(more)); assert.equal(rb.j.success, false); assert.equal(rb.j.code, 'ROBOTS_TXT_DISALLOWED'); assert.ok(!rb.text.includes('not for readers')); }
  for (const hd of [{ 'x-return-format': 'html' }, { 'x-target-selector': 'main' }, { 'x-no-cache': 'true' }]) { const j = await node.call('/r/https://closed.reader-proof.dev/page', { ip, headers: hd }); assert.equal(j.status, 403, JSON.stringify(hd)); assert.ok(!j.text.includes('not for readers')); }
  const m = await post({ url: `${P}/missing` }); assert.equal(m.status, 200); assert.equal(m.j.success, true); assert.equal(m.j.data.metadata.statusCode, 404); assert.match(m.j.data.metadata.error, /404/);
});
await proof('an Authorization header is accepted and ignored: the same answer without it; never sent on, never kept, never logged', async () => {
  const ip = fresh(), k0 = node.kv.sets.length, l0 = logs.length, o0 = outgoing.length;
  const a = await node.call('/v2/scrape', { method: 'POST', accept: 'application/json', ip, headers: { authorization: `Bearer ${SECRET}` }, body: { url: `${P}/handbook`, formats: ['markdown', 'links'] } });
  const b = await node.call('/v2/scrape', { method: 'POST', accept: 'application/json', ip, body: { url: `${P}/handbook`, formats: ['markdown', 'links'] } });
  assert.equal(a.status, 200); assert.equal(b.status, 200); assert.deepEqual(a.j.data, b.j.data, 'the same answer'); assert.equal(a.j.success, true);
  const j = await node.call(`/r/${P}/handbook`, { ip, headers: { authorization: `Bearer ${SECRET}`, 'x-return-format': 'markdown' } }); assert.equal(j.status, 200);
  const everything = [...node.kv.sets.slice(k0), ...logs.slice(l0), ...outgoing.slice(o0).map((x) => JSON.stringify(x)), JSON.stringify(node.ledger), JSON.stringify(await node.sea().savings())].join('\n');
  assert.ok(!everything.includes(SECRET) && !everything.includes('fc-reader-proof'), 'the key appears nowhere');
  assert.ok(outgoing.slice(o0).every((x) => !Object.keys(x.headers).some((k) => /authorization/i.test(k))), 'no Authorization goes out');
});

console.log('the same protections');
await proof('the egress gate: a private name, an IP literal, an odd port and a redirect inward are never read (scrape and Jina)', async () => {
  const ip = fresh(), o0 = outgoing.length, post = (url) => node.call('/v2/scrape', { method: 'POST', accept: 'application/json', ip, body: { url, formats: ['rawHtml'] } });
  for (const u of ['https://inner.reader-proof.dev/admin', 'http://127.0.0.1/', 'http://169.254.169.254/latest/meta-data/', `${P}:22/x`, 'file:///etc/passwd', `${P}/away`]) {
    const r = await post(u); assert.equal(r.j.success, false, u); assert.ok(r.status === 422 || r.status === 400, `${u}: ${r.status}`); assert.ok(!r.text.includes('internal'), 'nothing of the inside');
  }
  const jn = await node.call('/r/https://inner.reader-proof.dev/admin', { ip, headers: { 'x-return-format': 'html' } }); assert.equal(jn.status, 422); assert.ok(!jn.text.includes('internal'));
  assert.ok(!outgoing.slice(o0).some((x) => /inner\.reader-proof|127\.0\.0\.1\/|169\.254/.test(x.url) && !/robots\.txt$/.test(x.url)), 'no request inward');
});
await proof('the size limit: a page past 2.5 MB is read up to it (rawHtml too), the Markdown up to 60,000 characters', async () => {
  const ip = fresh(), r = await node.call('/v2/scrape', { method: 'POST', accept: 'application/json', ip, body: { url: `${P}/big`, formats: ['markdown', 'rawHtml'] } });
  assert.equal(r.status, 200); assert.ok(r.j.data.rawHtml.length <= 2_500_000, `rawHtml ${r.j.data.rawHtml.length}`); assert.ok(r.j.data.markdown.length <= 60_000); assert.match(r.j.data.warning, /read up to 1\.5 MB|cut at 60,000/);
});
await proof('the free limit: 100 pages a day per network, shared by /r/, Jina and the scrape doors; the 101st is a 429; another network reads on', async () => {
  const ip = fresh(); let i = 0;
  for (; i < 100; i++) { T0 += 1000; const r = i % 3 === 0 ? await node.call(`/r/${P}/t/${i}.txt`, { ip }) : i % 3 === 1 ? await node.call(`/r/${P}/t/${i}.txt`, { ip, headers: { 'x-return-format': 'text' } }) : await node.call('/v2/scrape', { method: 'POST', accept: 'application/json', ip, body: { url: `${P}/t/${i}.txt` } }); assert.equal(r.status, 200, `read ${i}: ${r.text.slice(0, 200)}`); }
  const s = await node.call('/v2/scrape', { method: 'POST', accept: 'application/json', ip, body: { url: `${P}/t/120.txt` } }); assert.equal(s.status, 429); assert.equal(s.j.success, false); assert.equal(s.j.code, 'RATE_LIMIT_EXCEEDED'); assert.match(s.j.error, /100 free reads a day/);
  const nc = await node.call('/v1/scrape', { method: 'POST', accept: 'application/json', ip, body: { url: `${P}/t/5.txt`, maxAge: 0 } }); assert.equal(nc.status, 429, 'a new read of a page read before counts too');
  const mk = await node.call('/v2/scrape', { method: 'POST', accept: 'application/json', ip, body: { url: `${P}/t/6.txt`, formats: ['rawHtml'] } }); assert.equal(mk.status, 429, 'markup is always a read');
  const j = await node.call(`/r/${P}/t/121.txt`, { ip, headers: { 'x-no-cache': 'true' } }); assert.equal(j.status, 429); const r = await node.call(`/r/${P}/t/122.txt`, { ip }); assert.equal(r.status, 429);
  const other = await node.call('/v2/scrape', { method: 'POST', accept: 'application/json', ip: fresh(), body: { url: `${P}/t/120.txt` } }); assert.equal(other.status, 200);
});
await proof('the immune system\'s pace holds on the scrape doors', async () => {
  const ip = fresh(); node.immune.set({ mode: 'normal', rest: [], pace: { perMinute: 30, burst: 10 } });
  try { const st = []; for (let i = 0; i < 14; i++) st.push((await node.call('/v2/scrape', { method: 'POST', accept: 'application/json', ip, body: { url: `${P}/notes.txt` } })).status); assert.ok(st.includes(429), `statuses ${st}`); }
  finally { node.immune.set({ mode: 'normal', rest: [], pace: { perMinute: 1_000_000, burst: 1_000_000 } }); }
});

console.log('counted by the ledger\'s one rule only');
await proof('once per network and page per UTC day across /r/, Jina and the scrape doors; another network counts again', async () => {
  const ip = fresh(), s0 = await savingsOf(node);
  await node.call('/v2/scrape', { method: 'POST', accept: 'application/json', ip, body: { url: `${P}/handbook`, maxAge: 0 } }); const s1 = await savingsOf(node); assert.equal(s1.reads, s0.reads + 1, 'the first read counts'); assert.ok(s1.readBytes > s0.readBytes);
  await node.call('/v1/scrape', { method: 'POST', accept: 'application/json', ip, body: { url: `${P}/handbook` } }); await node.call(`/r/${P}/handbook`, { ip, headers: { 'x-return-format': 'markdown', 'x-no-cache': 'true' } }); await node.call(`/r/${P}/handbook`, { ip });
  assert.deepEqual(await savingsOf(node), s1, 'the same page from the same network the same day: not again');
  await node.call('/v2/scrape', { method: 'POST', accept: 'application/json', ip: fresh(), body: { url: `${P}/handbook`, maxAge: 0 } }); assert.equal((await savingsOf(node)).reads, s1.reads + 1, 'another network');
});
await proof('a read narrowed by a selector (X-Target-Selector, X-Remove-Selector, includeTags, excludeTags) is never counted as a saving against the whole page (R6); the same page read plainly is', async () => {
  const s0 = await savingsOf(node), ip = fresh();
  await node.call(`/r/${P}/handbook`, { ip, headers: { 'x-target-selector': '#berths', 'x-no-cache': 'true' } });
  await node.call('/v2/scrape', { method: 'POST', accept: 'application/json', ip, body: { url: `${P}/handbook`, includeTags: ['#berths'], maxAge: 0 } });
  await node.call('/v1/scrape', { method: 'POST', accept: 'application/json', ip, body: { url: `${P}/handbook`, excludeTags: ['.ad'] } });
  assert.deepEqual(await savingsOf(node), s0, 'selector reads add nothing to the ledger');
  await node.call('/v2/scrape', { method: 'POST', accept: 'application/json', ip, body: { url: `${P}/handbook`, maxAge: 0 } });
  assert.equal((await savingsOf(node)).reads, s0.reads + 1, 'the plain read of the same page counts');
});
await proof('never for crawlers or the sea\'s own calls; never an answer that hands the page\'s markup over (html, rawHtml, X-Return-Format: html)', async () => {
  const s0 = await savingsOf(node), o0 = outgoing.length;
  const c = await node.call('/v2/scrape', { method: 'POST', accept: 'application/json', ip: fresh(), ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot', body: { url: `${P}/handbook`, maxAge: 0 } });
  assert.equal(c.status, 403); assert.equal(c.j.success, false); assert.equal(outgoing.length, o0, 'a crawler makes the reader read nothing');
  const own = await node.call('/v2/scrape', { method: 'POST', accept: 'application/json', ip: fresh(), ua: 'MareLiberum-session/1.0', body: { url: `${P}/handbook`, maxAge: 0 } }); assert.equal(own.status, 200);
  for (const f of [['html'], ['rawHtml'], ['markdown', 'html']]) assert.equal((await node.call('/v2/scrape', { method: 'POST', accept: 'application/json', ip: fresh(), body: { url: `${P}/handbook`, formats: f } })).status, 200);
  assert.equal((await node.call(`/r/${P}/handbook`, { ip: fresh(), headers: { 'x-return-format': 'html' } })).status, 200);
  assert.deepEqual(await savingsOf(node), s0, 'nothing counted');
});

console.log('the page that says all this');
await proof('/reader, /reader.md and /reader.json: both ways with copy-paste lines, the limit, the key, privacy; linked from /engine and llms.txt', async () => {
  const ip = fresh(), h = await node.call('/reader', { ip, accept: 'text/html' }), m = await node.call('/reader.md', { ip }), j = await node.call('/reader.json', { ip, accept: 'application/json' });
  assert.equal(h.status, 200); assert.match(h.h['content-type'], /^text\/html/); assert.equal(m.status, 200); assert.match(m.h['content-type'], /^text\/markdown/); assert.equal(j.status, 200);
  for (const t of [h.text, m.text]) for (const s of ['/r/', '/v2/scrape', 'X-Return-Format', 'api_url', 'apiUrl', '100 pages a day', 'Authorization', 'privacy']) assert.ok(t.includes(s), `${s} on the page`);
  assert.equal(j.j.firecrawl.formats.join(), 'markdown,html,rawHtml,links'); assert.match(j.j.key, /never read, logged, kept or sent on/);
  assert.ok(!/\b(best|fastest|leading|unbeatable|cheapest|#1)\b/i.test(h.text.replace(/<[^>]+>/g, ' ')), 'no superlatives');
  assert.match((await node.call('/engine', { ip, accept: 'text/html' })).text, /href="\/reader"/); assert.match(readFileSync(join(ROOT, 'site/llms.txt'), 'utf8'), /\/reader\b/);
});

// ------------------------------------------------------------------ negative controls
const BREAK = [
  ['Jina\'s form without a Jina header (the answers of before change)', 'node/compat.mjs', 'if (!named.length && !md.length) return null;', 'if (false) return null;'],
  ['the app door changed', 'node/core.mjs', "read_page: 'Read a public web page as clean Markdown (title, description, main text, links), up to 100 pages a day per address.", "read_page: 'Read a public web page as clean Markdown (title, description, main text, links), up to 100 pages a day per network."],
  ['robots.txt skipped for a read in another reader\'s form', 'node/reader.mjs', 'if (!allow.allowed) return { url: u.href, host, blocked: true,', 'if (!allow.allowed && !shape) return { url: u.href, host, blocked: true,'],
  ['the egress gate skipped for a read in another reader\'s form', 'node/reader.mjs', "if (!(await publicDns(host))) return { error: 'this name does not lead to a public website' };", "if (!shape && !(await publicDns(host))) return { error: 'this name does not lead to a public website' };"],
  ['a redirect inward followed', 'node/check.mjs', 'const h = safeHost(next.hostname); if (!h || !(await publicDns(h))) return { status: 0, blocked: true };', ''],
  ['the size limit lifted', 'node/reader.mjs', 'const r = await grab(u.href, { max: 2_500_000, ms: 9000, ua: READER_UA });', 'const r = await grab(u.href, { max: 25_000_000, ms: 9000, ua: READER_UA });'],
  ['X-No-Cache and maxAge: 0 past the free limit', 'node/lens.mjs', "      if (!hit) {\n        try { await allow(ctx, 'read', 100, 86400);", "      if (!hit && a.fresh !== true) {\n        try { await allow(ctx, 'read', 100, 86400);"],
  ['markup past the free limit', 'node/lens.mjs', "      if (!hit) {\n        try { await allow(ctx, 'read', 100, 86400);", "      if (!hit && !markup) {\n        try { await allow(ctx, 'read', 100, 86400);"],
  ['the immune system skipped on the scrape doors', 'node/core.mjs', 'const met = immune.meet({ ip, path, method: req.method, scripted });', 'const met = /^\\/v[12]\\/scrape$/.test(path) ? null : immune.meet({ ip, path, method: req.method, scripted });'],
  ['an answer with the page\'s markup counted as a saving', 'node/lens.mjs', 'if (r.markdown && r.htmlBytes && !markup && !shape) api.countBytes', 'if (r.markdown && r.htmlBytes) api.countBytes'],
  ['a selector-narrowed read counted against the whole page (R6)', 'node/lens.mjs', 'if (r.markdown && r.htmlBytes && !markup && !shape) api.countBytes', 'if (r.markdown && r.htmlBytes && !markup) api.countBytes'],
  ['the scrape doors count beside the ledger\'s rule', 'node/core.mjs', "if (r.host) passed('read', r.final || r.url || ask.url,", "if (r.markdown && r.htmlBytes !== 0) sea.countBytes?.('read', 9e5, 1, { ...ctx, door: '/v2' }, `${ask.url}#again`); if (r.host) passed('read', r.final || r.url || ask.url,"],
  ['crawlers read and counted on the scrape doors', 'node/core.mjs', 'let r; try { r = await sea.read({ url: ask.url, ...(ask.full ? { full: true } : {}), ...(ask.fresh ? { fresh: true } : {}), ...(ask.shape ? { shape: ask.shape } : {}) }, ctx); }', 'let r; try { r = await sea.read({ url: ask.url, ...(ask.full ? { full: true } : {}), ...(ask.fresh ? { fresh: true } : {}), ...(ask.shape ? { shape: ask.shape } : {}) }, { ...ctx, readOnly: false }); }'],
  ['the key logged', 'node/core.mjs', "if (ask.error) return out(scrapeError(400, 'BAD_REQUEST', ask.error));", "if (ask.error) return out(scrapeError(400, 'BAD_REQUEST', ask.error)); console.error('scrape', req.headers.get('authorization'));"],
  ['the key kept', 'node/core.mjs', "if (ask.error) return out(scrapeError(400, 'BAD_REQUEST', ask.error));", "if (ask.error) return out(scrapeError(400, 'BAD_REQUEST', ask.error)); await cfg.kv?.set('scrape:last', { auth: req.headers.get('authorization') }, 60);"],
  ['the markup sent as a page (text/html)', 'node/core.mjs', "{ status: st, headers: { 'content-type': 'text/plain; charset=utf-8', ...hdr } });\n      }", "{ status: st, headers: { 'content-type': jn.form === 'html' ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8', ...hdr } });\n      }"],
  ['an option the reader does not have answered with an error', 'node/compat.mjs', 'if (k in ASKS) { if (ASKS[k](val)) ignored.push(', "if (k in ASKS) { if (ASKS[k](val)) return { error: `${k} is not supported` }; if (0) ignored.push("],
  ['the warning left out', 'node/compat.mjs', 'if (warn.length) data.warning =', 'if (false) data.warning ='],
  ['an unsafe selector not named', 'node/reader.mjs', 'if (!m || raw.length > 120 || (!m[1] && !m[2])) { bad.push(raw.slice(0, 80)); continue; }', 'if (!m || raw.length > 120 || (!m[1] && !m[2])) continue;'],
  ['a Jina header that is not read left unnamed (cookies)', 'node/compat.mjs', "'x-set-cookie': 'cookies are never sent to the page', ", ''],
];
let caught = 0;
if (CONTROLS) {
  console.log('\nnegative controls: each rule broken in a copy, the proof must fail there');
  for (const [what, f, from, to] of BREAK) {
    const tmp = mkdtempSync(join(tmpdir(), 'mare-reader-ctl-'));
    try {
      for (const d of ['node', 'site', 'proof', 'config', 'public', 'engines']) if (existsSync(join(ROOT, d))) cpSync(join(ROOT, d), join(tmp, d), { recursive: true });
      mkdirSync(join(tmp, 'tools'), { recursive: true }); cpSync(join(ROOT, 'tools/reader-compat-proof.mjs'), join(tmp, 'tools/reader-compat-proof.mjs'));
      for (const x of ['package.json', 'server.json', 'server-dev.json', 'server-lean.json', 'gemini-extension.json', 'serve.mjs']) if (existsSync(join(ROOT, x))) cpSync(join(ROOT, x), join(tmp, x));
      const src = readFileSync(join(tmp, f), 'utf8');
      if (!src.includes(from)) { console.log(`  FAIL control "${what}": the line to break is gone from ${f}; the control needs updating`); continue; }
      writeFileSync(join(tmp, f), src.replace(from, to));
      const run = spawnSync(process.execPath, ['tools/reader-compat-proof.mjs', '--no-controls'], { cwd: tmp, encoding: 'utf8', timeout: 600_000, env: { ...process.env, MARE_READER_REF_DIR: refDir || '', MARE_READER_FIRST_FAIL: '1' } });
      const held = /(\d+) proofs held, (\d+) failed/.exec(run.stdout || '');
      if (run.status !== 0 && held && Number(held[2]) > 0) { caught++; console.log(`  ok   caught: ${what} (${(/FAIL ([^\n]+)/.exec(run.stdout) || [])[1]?.slice(0, 90) || ''})`); }
      else console.log(`  FAIL not caught: ${what} (exit ${run.status}${held ? `, ${held[0]}` : ''}${run.stderr ? `; ${String(run.stderr).split('\n')[0].slice(0, 160)}` : ''})`);
    } finally { rmSync(tmp, { recursive: true, force: true }); }
  }
  console.log(`${caught} of ${BREAK.length} controls caught`);
}
console.log(`\n${passed} proofs held, ${failed} failed`);
if (refDir && !process.env.MARE_READER_REF_DIR) rmSync(refDir, { recursive: true, force: true });
process.exit(failed || (CONTROLS && caught !== BREAK.length) ? 1 : 0);
