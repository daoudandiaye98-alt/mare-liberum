// Mare Liberum · proof of the way on from a price record (3.92, "Der Beleg führt weiter"): the record pages OpenAI's crawler
// reads lead somewhere. It proves, without the network:
//   page     GET /seen/<id> carries one paragraph right after the box with the price, after the heading and the first sentence:
//            this very page checked again (GET /deal?url=<this page>, free; "no other store … compares again" when nothing was
//            compared), the offers and the price history of the product's need, the weekend balance, while adding is open the
//            call that adds this very page, and the free key; kept an hour while the add call stands on it, a day after
//   need     the longest need whose every word stands in the product's name; none for a name that matches no need, never
//            for gift needs; a page that is no store's product page is never offered to the weekend balance
//   record   /seen/<id>.json stays the record as it was kept: no next, its SHA-256 still that of its canonical JSON
//   list     GET /seen.json carries next once before the records: the free price check with a real example, /buy, /history,
//            the weekend balance, the add call while open, the free key
//   never    no next points at /mcp/app or at a paid door
// Negative controls at the end: each rule broken in a copy of the code, and this proof must fail there.
// Runs without the network: node tools/recordnext-proof.mjs   (exit code 1 when a proof fails or a control is not caught)
//   --no-controls   only the proofs (the controls run this file that way in each broken copy)
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, cpSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const k of ['MARE_TOLL', 'MARE_ENGINE', 'MARE_FAIR', 'MARE_X402_FACILITATOR', 'MARE_PAY_TO', 'MARE_ROUTE_PRICE_CENTS', 'MARE_STATE', 'MARE_DB_URL', 'MARE_DB_KEY', 'MARE_DB_SECRET', 'MARE_BASE_RPC', 'MARE_CATALOG_ID']) delete process.env[k];
let passed = 0, failed = 0;
const D = globalThis.Date; let T0 = D.parse('2026-11-28T17:00:00.000Z');
class Clock extends D { constructor(...a) { if (a.length) super(...a); else super(T0); } static now() { return T0; } }
globalThis.Date = Clock;
const proof = async (name, fn) => { try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 6).join('\n       ')}`); } };
const imp = (f) => import(pathToFileURL(join(ROOT, 'node', f)).href);

// ------------------------------------------------------------------ the world: nothing answers, the proof uses no network
globalThis.fetch = async () => new Response('not here', { status: 404, headers: { 'content-type': 'text/plain' } });
createRequire(import.meta.url)('node:dns').promises.lookup = async () => [{ address: '93.184.216.34', family: 4 }];
for (const k of ['error', 'warn', 'info']) console[k] = () => {};

// ------------------------------------------------------------------ the node
const BASE = 'https://mare.test', SITE = { '/llms.txt': { body: readFileSync(join(ROOT, 'site/llms.txt'), 'utf8'), type: 'text/plain; charset=utf-8' } };
const core = await imp('core.mjs'), { createMem } = await imp('mem.mjs'), { memoryKv } = await imp('flow.mjs');
const { immune } = await imp('immune.mjs'), { createLedger } = await imp('ledger.mjs'), { payConfig } = await imp('pay.mjs');
const { SESSION } = await imp('session.mjs'), { DEAL_FIRST } = await imp('pages.mjs');
const { SEEN, recordOf, lineOf, canonical } = await imp('seen.mjs'), { needOfName } = await imp('recordnext.mjs');
const dir = mkdtempSync(join(tmpdir(), 'mare-recnext-')), file = join(dir, 'sea.tsv');
process.once('exit', () => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });
writeFileSync(file, ''); writeFileSync(join(dir, 'build.json'), JSON.stringify({ builtAt: '2026-11-20T10:00:00.000Z', entries: 0, lakes: {} }));
const db = createMem({ file, base: BASE }), kv = memoryKv(), ledger = createLedger({});
const cfg = { base: BASE, kv, ledger, pay: payConfig({}), site: SITE, waitUntil: () => {}, creditSweepMs: 0 };
let net = 0; const fresh = () => `198.51.${100 + (net >> 8)}.${++net & 255}`;
const BOT = 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.3; +https://openai.com/gptbot)';
const call = async (path, { accept = 'application/json', headers = {} } = {}) => {
  const res = await core.handle(new Request(BASE + path, { headers: { accept, 'user-agent': BOT, 'x-forwarded-for': fresh(), ...headers } }), db, cfg);
  const text = res.body ? Buffer.from(await res.arrayBuffer()).toString('utf8') : ''; let j = null; try { j = JSON.parse(text); } catch {}
  return { status: res.status, h: Object.fromEntries(res.headers), text, j };
};
await call('/stats');
immune.set({ mode: 'normal', rest: [], pace: { perMinute: 1_000_000, burst: 1_000_000 } });

// two records as the deal check keeps them: one compared with nothing (a running shoe), one cheaper elsewhere whose name
// matches no need, on a page that is no store's product page
const sha = (s) => createHash('sha256').update(s).digest('hex');
const keep = async (ans, id) => { const rec = recordOf(ans, { id, at: new Date(T0).toISOString(), base: BASE }), kept = { ...rec, sha256: sha(canonical(rec)) }; await kv.set(`seen:rec:${id}`, kept, 30 * 86_400); return kept; };
const SHOE_PAGE = 'https://shoes.recnext.test/products/hoka-clifton-9';
const shoe = await keep({ page: { host: 'shoes.recnext.test', url: SHOE_PAGE, read: true }, product: { name: 'Hoka Clifton 9 Men\'s Running Shoes', brand: 'Hoka', price: 115.99, currency: 'USD', url: SHOE_PAGE, in_stock: true },
  verdict: { word: 'no-comparison', lines: ['No matching offer in stock at another Shopify store.'] }, elsewhere: [], elsewhere_found: 0 }, 'a1b2c3d4e5f60718');
const SAMBA_PAGE = 'https://wstnd.recnext.test/p/samba-og';
const samba = await keep({ page: { host: 'wstnd.recnext.test', url: SAMBA_PAGE, read: true }, product: { name: 'Adidas Samba OG Carbon', price: 100, currency: 'USD', url: SAMBA_PAGE },
  verdict: { word: 'cheaper-elsewhere', lines: ['Cheaper at another store.'] }, elsewhere: [{ store: 'Other Shop', title: 'Adidas Samba OG Carbon', price: 90, currency: 'USD', url: 'https://other.recnext.test/products/samba', below_page_pct: 10 }], elsewhere_found: 1 }, 'b1b2c3d4e5f60718');
await kv.set('seen:recent', [lineOf(shoe), lineOf(samba)], 30 * 86_400);

const STEP = (t) => (/<p id="next-step">([\s\S]*?)<\/p>/.exec(t) || [])[1] || '';
const NEVER = (s, where) => { assert.ok(!/\/mcp\/app/.test(s), `${where}: never the app door`); assert.ok(!/\/x402\//.test(s), `${where}: never a paid door`); };

console.log('page');
await proof('a record compared with nothing leads on right after the box: this very page checked again (saying a new check compares again), the offers and the history of its need, the balance, the add call while open, the free key', async () => {
  const r = await call(`${SEEN.path}/${shoe.id}`, { accept: 'text/html' }); assert.equal(r.status, 200);
  const s = STEP(r.text); assert.ok(s, 'the paragraph of next steps');
  const at = (x) => r.text.indexOf(x);
  assert.ok(at('<h1>') < at('<p class="lead">') && at('<p class="lead">') < at('<p class="box">') && at('<p class="box">') < at('<p id="next-step">') && at('<p id="next-step">') < at('What the deal check found'), 'heading, first sentence, box, then the next steps, before the findings');
  assert.ok(s.includes(`GET ${BASE}/deal?url=${encodeURIComponent(SHOE_PAGE)}`), 'this very page checked again');
  assert.ok(s.includes('No other store with the same item was found at that minute; a new check of this page compares again'), 'says that nothing was compared');
  assert.ok(s.includes(`${BASE}/buy/mens-running-shoes`) && s.includes(`${BASE}/history/mens-running-shoes`), 'the offers and the history of its need');
  assert.ok(s.includes(`${BASE}/seen/bfcm-2026"`), 'the weekend balance');
  assert.ok(s.includes(`GET ${BASE}/seen/bfcm-2026?add=${encodeURIComponent(SHOE_PAGE)}`), 'the call that adds this very page');
  assert.ok(s.includes(`GET ${BASE}/session?as=key`), 'the free key');
  assert.equal(r.h['cache-control'], 'public, max-age=3600', 'kept an hour while the add call stands on it');
  NEVER(s, 'the record page');
});
await proof('a record compared with other stores says prices move; a name that matches no need gets no buy and no history; a page that is no product page is never offered to the balance', async () => {
  const r = await call(`${SEEN.path}/${samba.id}`, { accept: 'text/html' }), s = STEP(r.text); assert.ok(s, 'the paragraph of next steps');
  assert.ok(s.includes('Prices move: check this page again before your person pays') && !s.includes('No other store'), 'prices move');
  assert.ok(s.includes(`GET ${BASE}/deal?url=${encodeURIComponent(SAMBA_PAGE)}`), 'this very page');
  assert.ok(!s.includes('/buy/') && !s.includes('/history/'), 'no need guessed');
  assert.ok(!s.includes('?add='), 'no add for a page that is no store\'s product page');
  assert.equal(r.h['cache-control'], 'public, max-age=86400', 'kept a day without the add call');
  NEVER(s, 'the record page');
});
await proof('/seen/<id>.json stays the record as it was kept: no next, its SHA-256 still that of its canonical JSON', async () => {
  for (const k of [shoe, samba]) {
    const r = await call(`${SEEN.path}/${k.id}.json`); assert.equal(r.status, 200);
    assert.equal(r.j.next, undefined, 'nothing added to the record');
    const { sha256, ...rest } = r.j; assert.equal(sha256, k.sha256); assert.equal(sha(canonical(rest)), sha256, 'the hash of its canonical JSON');
    assert.equal(r.j.check_again, `${BASE}/deal?url=${encodeURIComponent(k.product.url)}`, 'check_again as before');
  }
});
console.log('need');
await proof('the need of a product: the longest need whose every word stands in the name; none for a name that matches no need, never a gift need', async () => {
  assert.equal(needOfName('Hoka Clifton 9 Men\'s Running Shoes'), 'men\'s running shoes', 'the longest');
  assert.equal(needOfName('Anker 737 Power Bank (PowerCore 24K)'), 'power bank');
  assert.equal(needOfName('Merino Wool Socks 3-Pack'), 'merino wool socks', 'a plural s aside');
  assert.equal(needOfName('Running Pouch with Pockets'), null, 'one word in common is no need');
  assert.equal(needOfName('Adidas Samba OG Carbon'), null);
  assert.equal(needOfName('Gift Card 50'), null, 'never a gift need');
  assert.equal(needOfName(''), null);
});
console.log('list');
await proof('/seen.json carries next once before the records: the free price check with a real example, /buy, /history, the balance, the add call while open, the free key; the records as before', async () => {
  const r = await call(`${SEEN.path}.json`), j = r.j; assert.equal(r.status, 200);
  const keys = Object.keys(j); assert.ok(keys.indexOf('next') >= 0 && keys.indexOf('next') < keys.indexOf('records'), 'next before the records');
  assert.equal(j.next.check_price.call, `GET ${BASE}/deal?url=<product page>`); assert.equal(j.next.check_price.example, `${BASE}/deal?url=${encodeURIComponent(DEAL_FIRST.example)}`, 'a real example');
  assert.equal(j.next.buy.page, `${BASE}/buy`); assert.equal(j.next.history.page, `${BASE}/history`); assert.equal(j.next.bfcm.page, `${BASE}/seen/bfcm-2026`);
  assert.equal(j.next.bfcm_add.call, `GET ${BASE}/seen/bfcm-2026?add=<product page>`); assert.equal(j.next.free_start.call, `GET ${BASE}/session?as=key`);
  assert.ok(j.next.free_start.gives.includes(`${SESSION.probe} probe calls`), 'the probe terms of the key');
  assert.deepEqual(j.records.map((x) => x.id), [shoe.id, samba.id], 'the records as before');
  NEVER(JSON.stringify(j.next), '/seen.json');
});
await proof('after Cyber Monday neither a record page nor /seen.json names the add call, and the page is kept a day again', async () => {
  const t = T0; T0 = D.parse('2026-12-01T09:00:00.000Z');
  try {
    const r = await call(`${SEEN.path}/${shoe.id}`, { accept: 'text/html' }), s = STEP(r.text);
    assert.ok(s && !s.includes('?add='), 'no add call'); assert.ok(s.includes(`${BASE}/seen/bfcm-2026"`), 'the balance stays');
    assert.equal(r.h['cache-control'], 'public, max-age=86400');
    assert.equal((await call(`${SEEN.path}.json`)).j.next.bfcm_add, undefined);
  } finally { T0 = t; }
});
await proof('llms.txt names the next steps of a record', async () => {
  assert.ok(SITE['/llms.txt'].body.includes('Each record page leads on'), 'the sentence in llms.txt');
});

console.log(`\n${passed} of ${passed + failed} proofs passed`);

// ------------------------------------------------------------------ negative controls: each rule broken in a copy, the proof must fail there
let caught = 0, missed = 0;
if (!process.argv.includes('--no-controls')) {
  console.log('\nnegative controls: each rule broken in a copy, the proof must fail there');
  const CONTROLS = [
    ['a record page without next', 'node/core.mjs', 'recordPage(rec, base, recordNextHtml(nx))', 'recordPage(rec, base)'],
    ['next added to the record as data', 'node/core.mjs', 'if (m[2] || asJson) return json(rec, 200, rh);\n      const nx', 'if (m[2] || asJson) return json({ ...rec, next: recordNext(base, rec, {}) }, 200, rh);\n      const nx'],
    ['next before the box with the price', 'node/seen.mjs', "<p class=\"lead\">${esc(lead)}</p>\n<p class=\"box\">", "<p class=\"lead\">${esc(lead)}</p>\n${next}<p class=\"box\">"],
    ['a need guessed from one word in common', 'node/recordnext.mjs', 'x.w.every((w) => have.has(w))', 'x.w.some((w) => have.has(w))'],
    ['the first need, not the longest', 'node/recordnext.mjs', '(!best || x.w.length > best.w.length ||', '(!best || false ||'],
    ['gift needs matched from a name', 'node/recordnext.mjs', 'const NOT_A_PRODUCT = /^(gift|gifts|', 'const NOT_A_PRODUCT = /^(zzz|'],
    ['nothing compared said as prices move', 'node/recordnext.mjs', "const none = rec?.verdict?.word === 'no-comparison' ||", "const none = false &&"],
    ['the add call after Cyber Monday', 'node/recordnext.mjs', 'page && addable(page) && bfcmAddOpen(day) ? { bfcm_add', 'page && addable(page) && true ? { bfcm_add'],
    ['a page that is no product page offered to the balance', 'node/recordnext.mjs', 'page && addable(page) && bfcmAddOpen(day) ? { bfcm_add', 'page && bfcmAddOpen(day) ? { bfcm_add'],
    ['the page kept a day while the add call stands on it', 'node/core.mjs', "...(nx.bfcm_add ? { 'cache-control': 'public, max-age=3600' } : {})", '...({})'],
    ['/seen.json without next', 'node/seen.mjs', "...(next ? { next } : {}), records:", 'records:'],
    ['the app door in next', 'node/recordnext.mjs', "check_price: dealStep(b, dealExample),\n    buy: { page: `${b}/buy`", "check_price: dealStep(b, dealExample),\n    app: `${b}/mcp/app`,\n    buy: { page: `${b}/buy`"],
  ];
  for (const [name, f, from, to] of CONTROLS) {
    const d2 = mkdtempSync(join(tmpdir(), 'mare-recnext-ctl-'));
    try {
      cpSync(ROOT, d2, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      const fp = join(d2, f), txt = readFileSync(fp, 'utf8');
      if (!txt.includes(from)) { missed++; console.log(`  FAIL control "${name}": the line to break is gone from ${f}; the control needs updating`); continue; }
      writeFileSync(fp, txt.replace(from, to));
      const r = spawnSync(process.execPath, [join(d2, 'tools/recordnext-proof.mjs'), '--no-controls'], { encoding: 'utf8', timeout: 240_000, env: { ...process.env, NODE_PATH: join(ROOT, 'node_modules') } });
      const out = `${r.stdout}${r.stderr}`, broke = (out.match(/\n  FAIL /g) || []).length;
      if (r.status !== 0 && broke > 0) { caught++; console.log(`  ok   caught: ${name} (${broke} proof${broke === 1 ? '' : 's'} failed)`); }
      else { missed++; console.log(`  FAIL control "${name}" was not caught (exit ${r.status})`); }
    } finally { try { rmSync(d2, { recursive: true, force: true }); } catch {} }
  }
  console.log(`${caught} of ${CONTROLS.length} controls caught`);
}
process.exit(failed || missed ? 1 : 0);
