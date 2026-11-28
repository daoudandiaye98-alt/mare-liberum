// Mare Liberum · proof of adding a page to the weekend balance (3.91, node/bfcmadd.mjs, "Anmelden bis Cyber Monday"): an
// assistant whose person waits for Cyber Monday adds the product page it watches, GET /seen/bfcm-2026?add=<product page>, and
// the sea measures that page at once and every day until Cyber Monday. It proves, with shops and DNS in memory (no network):
//   add      a store's own product page is measured at once as the caller's deal check (its price of today and its open record
//            in the answer), joins the list of added pages and starts its series; the JSON and the page say so
//   refuse   an Amazon page, a cart, a page over http and a page that gives no price are not added (and say why); crawlers add
//            nothing; a fourth page from the same network on the same day is refused, another network may add; a page already
//            added, or one with a Black Friday price, is answered as already measured without a second check
//   private  the network is kept only as an HMAC: no address in any key or answer; the adds of a day are counted by the name the
//            caller gives itself, and /seen.json says them as bfcm.adds
//   book     on the following days the record book measures every added page once a day, beside the Black Friday pages, without
//            counting it as one of them; on the day of the add it does not measure it a second time
//   honest   an added page without a Black Friday price stands apart ("Measured over the weekend") and is never counted as
//            cheaper, dearer or unchanged, nor left out; an added page with a Black Friday price is a line like any other
//   closed   after Cyber Monday an add is answered 410 and the call is no longer named (balance, /for/bots); until then llms.txt,
//            the deal-check skill and /for/bots name it
// Negative controls at the end: each rule broken in a copy of the code, and this proof must fail there.
// Runs without the network: node tools/bfcmadd-proof.mjs   (exit code 1 when a proof fails or a control is not caught)
//   --no-controls   only the proofs (the controls run this file that way in each broken copy)
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, cpSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { Buffer } from 'node:buffer';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const k of ['MARE_TOLL', 'MARE_ENGINE', 'MARE_FAIR', 'MARE_X402_FACILITATOR', 'MARE_PAY_TO', 'MARE_ROUTE_PRICE_CENTS', 'MARE_STATE', 'MARE_DB_URL', 'MARE_DB_KEY', 'MARE_DB_SECRET', 'MARE_BASE_RPC', 'MARE_CATALOG_ID']) delete process.env[k];
process.env.MARE_VIA_SECRET = 'bfcmadd-proof-via-key, a test value';
let passed = 0, failed = 0;
const D = globalThis.Date; let T0 = D.parse('2026-11-28T12:00:00.000Z');
class Clock extends D { constructor(...a) { if (a.length) super(...a); else super(T0); } static now() { return T0; } }
globalThis.Date = Clock;
const proof = async (name, fn) => { T0 += 60_000; try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 6).join('\n       ')}`); } };
const imp = (f) => import(pathToFileURL(join(ROOT, 'node', f)).href);
const { BFCM_ADD, bfcmAddOpen, bfcmAddSentence, bfcmAddedLine } = await imp('bfcmadd.mjs');
const { bfcmOf } = await imp('bfcm.mjs');

// ------------------------------------------------------------------ the world: shops, an empty catalog, DNS
const CATALOG = 'https://catalog.shopify.com/api/ucp/mcp';
const productPage = ({ name, price, cur = 'USD' }) => `<!doctype html><html lang="en"><head><title>${name} · Shop</title>
<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'Product', name, brand: { '@type': 'Brand', name: 'Example' }, offers: { '@type': 'Offer', price, priceCurrency: cur, availability: 'https://schema.org/InStock' } })}</script></head>
<body><main><h1>${name}</h1><p>The ${name} is a good and plain thing for the house, made to last for many years of daily use in any kitchen.</p><p>Price: ${price} ${cur}</p></main></body></html>`;
const price = { kettle: '40.00', lamp: '25.00', mug: '12.00', pan: '30.00', fan: '55.00' };
const PAGES = Object.fromEntries(Object.keys(price).map((k) => [`${k}.deal-proof.dev/products/${k}`, () => productPage({ name: `Plain ${k[0].toUpperCase()}${k.slice(1)}`, price: price[k] })]));
const read = [];
const answer = (j, status = 200) => new Response(JSON.stringify(j), { status, headers: { 'content-type': 'application/json' } });
globalThis.fetch = async (u, o = {}) => {
  const s = String(u?.url ?? u);
  if (s === CATALOG) return answer({ jsonrpc: '2.0', id: 1, result: { structuredContent: { products: [] } } });
  const url = new URL(s);
  if (!url.hostname.endsWith('.deal-proof.dev')) throw new Error(`the proof does not use the network: ${s.slice(0, 80)}`);
  if (url.pathname === '/robots.txt') return new Response('User-agent: *\nAllow: /\n', { status: 200, headers: { 'content-type': 'text/plain' } });
  read.push(`${url.hostname}${url.pathname}`);
  const f = PAGES[`${url.hostname}${url.pathname}`];
  if (f) return new Response(f(), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
  return new Response('not here', { status: 404, headers: { 'content-type': 'text/plain' } });
};
createRequire(import.meta.url)('node:dns').promises.lookup = async () => [{ address: '93.184.216.34', family: 4 }];
for (const k of ['error', 'warn', 'info']) console[k] = () => {};
{ const say = console.log; console.log = (...a) => { if (!/^mare_/.test(String(a[0] ?? ''))) say(...a); }; }
const P = (k) => `https://${k}.deal-proof.dev/products/${k}`;
const productReads = () => read.filter((x) => x.includes('/products/'));

// ------------------------------------------------------------------ the node
const BASE = 'https://mare.test';
const SITE = { '/llms.txt': { body: readFileSync(join(ROOT, 'site/llms.txt'), 'utf8'), type: 'text/plain; charset=utf-8' }, '/deal-check.md': { body: readFileSync(join(ROOT, 'site/deal-check.md'), 'utf8'), type: 'text/markdown; charset=utf-8' } };
const core = await imp('core.mjs'), { createMem } = await imp('mem.mjs'), { memoryKv } = await imp('flow.mjs');
const { immune } = await imp('immune.mjs'), { createLedger } = await imp('ledger.mjs'), { payConfig } = await imp('pay.mjs');
const dir = mkdtempSync(join(tmpdir(), 'mare-bfcmadd-')), file = join(dir, 'sea.tsv');
process.once('exit', () => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });
writeFileSync(file, ''); writeFileSync(join(dir, 'build.json'), JSON.stringify({ builtAt: '2026-11-20T10:00:00.000Z', entries: 0, lakes: {} }));
const db = createMem({ file, base: BASE }), kv = memoryKv(), ledger = createLedger({});
const cfg = { base: BASE, kv, ledger, pay: { ...payConfig({}) }, site: SITE, waitUntil: () => {}, creditSweepMs: 0, watchSeed: [] };
const AGENT = 'add-proof-agent/1.0', CHATGPT = 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot';
const call = async (path, { accept = 'application/json', ip = '198.51.100.7', ua = AGENT, method = 'GET' } = {}) => {
  const res = await core.handle(new Request(BASE + path, { method, headers: { accept, 'user-agent': ua, 'x-forwarded-for': ip } }), db, cfg);
  const text = res.body ? Buffer.from(await res.arrayBuffer()).toString('utf8') : ''; let j = null; try { j = JSON.parse(text); } catch {}
  return { status: res.status, h: Object.fromEntries(res.headers), text, j };
};
const add = (u, o) => call(`/seen/bfcm-2026.json?add=${encodeURIComponent(u)}`, o);
await call('/stats', { ip: '127.0.0.1' });
immune.set({ mode: 'normal', rest: [], pace: { perMinute: 1_000_000, burst: 1_000_000 } });
const sea = core.seaOf(db, cfg, BASE);
const added = async () => (await kv.get('book:bfcm_add')) || [];

console.log('adding a page to the weekend balance');
await proof('days: open to the end of Cyber Monday (UTC), closed from 1 Dec 2026; one sentence names the call', async () => {
  assert.equal(bfcmAddOpen('2026-11-28'), true); assert.equal(bfcmAddOpen('2026-11-30'), true); assert.equal(bfcmAddOpen('2026-12-01'), false); assert.equal(bfcmAddOpen(''), false);
  assert.equal(bfcmAddSentence(BASE), 'Your person is waiting for Cyber Monday? Add the product page: GET https://mare.test/seen/bfcm-2026?add=<product page>. It is measured on the store\'s own page every day until 30 Nov 2026; on Tuesday the balance shows whether waiting paid off. Free, no account, at most 3 pages a day.');
  assert.equal(BFCM_ADD.perNet, 3); assert.equal(BFCM_ADD.max, 200);
});
await proof('add: the page is measured at once, its price and record are in the answer, it joins the list and starts its series', async () => {
  read.length = 0;
  const r = await add(P('kettle'));
  assert.equal(r.status, 200, r.text.slice(0, 300)); assert.equal(r.h['cache-control'], 'no-store');
  assert.equal(r.j.added.page, P('kettle')); assert.deepEqual(r.j.added.today, { day: '2026-11-28', price: 40, currency: 'USD' });
  assert.match(r.j.added.record, /^https:\/\/mare\.test\/seen\/[0-9a-f]{16}$/);
  assert.equal(r.j.added.line, `Added: this page is measured on the store's own page each day until Cyber Monday (30 Nov 2026); the balance on Tuesday will show it. Today: 40 USD, record ${r.j.added.record}.`);
  assert.deepEqual(productReads(), ['kettle.deal-proof.dev/products/kettle'], 'read once, on the store\'s own page');
  assert.deepEqual(await added(), [P('kettle')]);
  const series = await sea.bookSeries(P('kettle')); assert.equal(series.length, 1); assert.equal(series[0].d, '2026-11-28'); assert.equal(series[0].p, 40);
  assert.equal(r.j.add.call, 'GET https://mare.test/seen/bfcm-2026?add=<product page>');
  const t = await sea.dealToday?.(); if (t && typeof t.checks === 'number') assert.ok(t.checks >= 1, 'it is the caller\'s own deal check');
});
await proof('add: the page in HTML says it first, and shows the page apart while it has no Black Friday price', async () => {
  const r = await call(`/seen/bfcm-2026?add=${encodeURIComponent(P('lamp'))}`, { accept: 'text/html' });
  assert.equal(r.status, 200, r.text.slice(0, 300)); assert.match(r.h['content-type'], /text\/html/);
  assert.match(r.text, /<p class="lead">[^\n]*<\/p>\n<p id="added"><b>Added: this page is measured on the store&#39;s own page each day until Cyber Monday/);
  assert.match(r.text, /<h2 id="weekend">Measured over the weekend \(no Black Friday price\)<\/h2>/); assert.ok(r.text.includes('Plain Lamp') && r.text.includes('Plain Kettle'));
  assert.match(r.text, /<h2 id="add">Waiting for Cyber Monday\? Add the page<\/h2>/);
});
await proof('refuse: Amazon, a cart, http and a page without a price are not added, and each says why', async () => {
  const before = await added(); read.length = 0;
  for (const u of ['https://www.amazon.com/products/kettle', 'https://kettle.deal-proof.dev/cart/c/1', 'http://kettle.deal-proof.dev/products/kettle', 'https://kettle.deal-proof.dev/pages/about']) {
    const r = await add(u, { ip: '203.0.113.9' }); assert.equal(r.status, 400, u); assert.equal(r.j.error.code, 'INVALID_ARGUMENT'); assert.match(r.j.error.message, /never a cart, a checkout or an Amazon page/);
  }
  assert.deepEqual(productReads(), [], 'nothing was read for them');
  const g = await add('https://gone.deal-proof.dev/products/gone', { ip: '203.0.113.9' }); assert.equal(g.status, 422); assert.equal(g.j.error.code, 'NO_PRICE'); assert.match(g.j.error.message, /was not added/);
  assert.deepEqual(await added(), before);
});
await proof('refuse: a crawler reads the balance and adds nothing', async () => {
  const r = await add(P('mug'), { ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.1; +https://openai.com/gptbot)', ip: '203.0.113.20' });
  assert.equal(r.status, 403); assert.equal(r.j.error.code, 'PERMISSION_DENIED'); assert.ok(!(await added()).includes(P('mug')));
  assert.equal((await call('/seen/bfcm-2026.json', { ua: 'Mozilla/5.0 (compatible; GPTBot/1.1; +https://openai.com/gptbot)', ip: '203.0.113.20' })).status, 200, 'it still reads');
});
await proof('limit: three pages a day per network; the fourth is refused, another network may add', async () => {
  const r3 = await add(P('mug')); assert.equal(r3.status, 200, r3.text.slice(0, 200)); // the third of 198.51.100.0/24 (kettle, lamp, mug)
  const r4 = await add(P('pan'), { ip: '198.51.100.99' }); assert.equal(r4.status, 429); assert.equal(r4.j.error.code, 'RESOURCE_EXHAUSTED'); assert.match(r4.j.error.message, /3 pages a day per network/);
  assert.ok(!(await added()).includes(P('pan')));
  const o = await add(P('pan'), { ip: '192.0.2.44', ua: CHATGPT }); assert.equal(o.status, 200, o.text.slice(0, 200));
  assert.deepEqual(await added(), [P('kettle'), P('lamp'), P('mug'), P('pan')]);
});
await proof('again: a page already added, or one with a Black Friday price, is answered as measured without a second check', async () => {
  read.length = 0;
  const r = await add(P('kettle'), { ip: '192.0.2.50' }); assert.equal(r.status, 200); assert.equal(r.j.added.already, 'added'); assert.match(r.j.added.line, /^Already added/);
  await kv.set('book:again', [P('fan')], 86400);
  const f = await add(P('fan'), { ip: '192.0.2.50' }); assert.equal(f.status, 200); assert.equal(f.j.added.already, 'black-friday');
  assert.deepEqual(productReads(), [], 'no second check'); assert.ok(!(await added()).includes(P('fan')));
  await kv.set('book:again', [], 86400);
});
await proof('private: the network only as an HMAC; /seen.json counts the adds of the day by name, never by address', async () => {
  const keys = kv.keys('bfcm:add:'); assert.ok(keys.length >= 2);
  for (const k of keys) assert.ok(!/198\.51\.100|192\.0\.2|203\.0\.113/.test(k), k);
  const s = await call('/seen.json', { ip: '192.0.2.60' }); assert.equal(s.status, 200);
  const a = s.j.bfcm.adds; assert.equal(a.pages, 4); assert.equal(a.today, 4); assert.equal(a.open, true); assert.equal(a.add, 'GET https://mare.test/seen/bfcm-2026?add=<product page>');
  assert.ok(Object.keys(a.by).some((n) => /ChatGPT/.test(n)), JSON.stringify(a.by)); assert.equal(Object.values(a.by).reduce((x, y) => x + y, 0), 4);
  assert.ok(!/198\.51\.100|192\.0\.2/.test(s.text));
});
await proof('book: on the day of the add the page is not measured twice; on the next days each added page once a day, never counted as a Black Friday page', async () => {
  read.length = 0; await sea.bookStep(BASE, [], { freeMB: 4000 });
  assert.ok(!productReads().some((x) => /kettle|lamp|mug|pan/.test(x)), 'not again on the day of the add');
  for (const day of ['2026-11-29', '2026-11-30']) {
    T0 = D.parse(`${day}T08:00:00.000Z`); read.length = 0;
    for (let i = 0; i < 6; i++) { await sea.bookStep(BASE, [], { freeMB: 4000 }); T0 += 1000; }
    assert.deepEqual(productReads().sort(), ['kettle', 'lamp', 'mug', 'pan'].map((k) => `${k}.deal-proof.dev/products/${k}`), day);
    assert.ok(!(Number(await kv.get(`book:again:n:${day}`)) > 0), 'not counted among the Black Friday pages');
  }
  const s = await sea.bookSeries(P('kettle')); assert.deepEqual(s.map((x) => x.d), ['2026-11-28', '2026-11-29', '2026-11-30']);
});
await proof('honest: on Tuesday the added pages stand apart with Saturday, Sunday and Cyber Monday; counted 0, left out 0', async () => {
  T0 = D.parse('2026-12-01T09:00:00.000Z');
  const r = await call('/seen/bfcm-2026.json', { ip: '192.0.2.70' }); assert.equal(r.status, 200);
  assert.equal(r.j.pages, 0); assert.equal(r.j.left_out, 0); assert.equal(r.j.measured_cyber_monday, 0); assert.equal(r.j.lines.length, 0);
  assert.equal(r.j.weekend_only.pages, 4); const k = r.j.weekend_only.lines.find((x) => x.url === P('kettle'));
  assert.deepEqual([k.saturday, k.sunday, k.cyber_monday, k.counted, k.weekend_only], [40, 40, 40, false, true]); assert.match(k.record, /^https:\/\/mare\.test\/seen\//);
  const b = bfcmOf([{ url: P('lamp'), added: true, series: [{ d: '2026-11-27', p: 30, c: 'USD' }, { d: '2026-11-30', p: 25, c: 'USD' }] }, { url: P('mug'), added: true, series: [{ d: '2026-11-29', p: 12, c: 'USD' }] }], '2026-12-01');
  assert.equal(b.pages, 1); assert.equal(b.cheaper, 1); assert.equal(b.left_out, 0); assert.equal(b.weekend_only.pages, 1, 'an added page with a Black Friday price is a line like any other');
});
await proof('closed: after Cyber Monday an add is 410, the call is no longer named on the balance or /for/bots', async () => {
  const r = await add(P('fan'), { ip: '192.0.2.80' }); assert.equal(r.status, 410); assert.equal(r.j.error.code, 'CLOSED');
  const j = await call('/seen/bfcm-2026.json', { ip: '192.0.2.80' }); assert.ok(!('add' in j.j));
  const h = await call('/seen/bfcm-2026', { accept: 'text/html', ip: '192.0.2.80' }); assert.ok(!h.text.includes('id="add"'));
  const m = await call('/for/bots.md', { accept: 'text/markdown', ip: '192.0.2.80' }); assert.equal(m.status, 200); assert.ok(!m.text.includes('Waiting for Cyber Monday'));
});
await proof('told: llms.txt, the deal-check skill (both copies) and, until Cyber Monday, /for/bots name the call', async () => {
  const call0 = 'GET https://mareliberum.dev/seen/bfcm-2026?add=<product page>';
  assert.ok(SITE['/llms.txt'].body.includes(call0)); assert.ok(SITE['/deal-check.md'].body.includes('`GET https://mareliberum.dev/seen/bfcm-2026?add=<product page>`'));
  assert.equal(readFileSync(join(ROOT, 'skills/deal-check/SKILL.md'), 'utf8'), SITE['/deal-check.md'].body);
  T0 = D.parse('2026-11-29T10:00:00.000Z');
  const m = await call('/for/bots.md', { accept: 'text/markdown', ip: '192.0.2.90' }); assert.ok(m.text.includes(`## Waiting for Cyber Monday?\n\n${bfcmAddSentence(BASE)}\n`));
  const p = await call('/for/bots', { accept: 'text/html', ip: '192.0.2.90' }); assert.ok(p.text.includes('<h2>Waiting for Cyber Monday?</h2>'));
  assert.ok(!m.text.includes('/mcp/app'));
  assert.equal(bfcmAddedLine({ ok: true, added: true, today: { price: 9, currency: 'EUR' }, record: 'R' }), 'Added: this page is measured on the store\'s own page each day until Cyber Monday (30 Nov 2026); the balance on Tuesday will show it. Today: 9 EUR, record R.');
  assert.equal(JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).scripts['proof:bfcmadd'], 'node tools/bfcmadd-proof.mjs');
});
console.log(`\n${passed} proofs held, ${failed} failed`);

// ------------------------------------------------------------------ negative controls: each rule broken in a copy, the proof must fail there
let caught = 0, missed = 0;
if (!process.argv.includes('--no-controls')) {
  console.log('\nnegative controls: each rule broken in a copy, the proof must fail there');
  const CONTROLS = [
    ['no limit per network', 'node/lens.mjs', 'if (used >= BFCM_ADD.perNet) return', 'if (false) return'],
    ['any address added (Amazon, carts, http)', 'node/lens.mjs', 'const page = bookUrl(url);\n', 'const page = String(url || \'\') || null;\n'],
    ['a page without a price added', 'node/lens.mjs', "if (!(Number.isFinite(price) && price > 0 && currency)) return { ok: false, status: 422", "if (false) return { ok: false, status: 422"],
    ['adding still open after Cyber Monday', 'node/lens.mjs', 'if (!bfcmAddOpen(day)) return { ok: false, status: 410', 'if (false) return { ok: false, status: 410'],
    ['a crawler adds', 'node/core.mjs', 'if (ctx.readOnly) return json({ error: { code: \'PERMISSION_DENIED\', message: `crawlers read the weekend balance', 'if (false) return json({ error: { code: \'PERMISSION_DENIED\', message: `crawlers read the weekend balance'],
    ['the network kept as its address', 'node/core.mjs', "createHmac('sha256', viaKey()).update(`bfcm-add|${day0}|${prefixOf(ip)}`).digest('hex').slice(0, 24)", 'prefixOf(ip)'],
    ['added pages not measured again', 'node/lens.mjs', 'const again = [...bf, ...adds.filter((u) => !bf.includes(u))];', 'const again = [...bf];'],
    ['added pages counted as Black Friday pages', 'node/lens.mjs', "visit.kind === 'again' && bf.includes(visit.url)", "visit.kind === 'again'"],
    ['the day of the add measured twice', 'node/lens.mjs', 'await kv.set(`book:done:${day}`, [...arr(done), page]', 'await kv.set(`book:done:x${day}`, [...arr(done), page]'],
    ['weekend-only pages counted with the others', 'node/bfcm.mjs', 'lines = all.filter((x) => !x.weekend_only)', 'lines = all'],
    ['the call named on /for/bots after Cyber Monday', 'node/pages.mjs', '...(bfcmAddOpen(d.day) ? { wait:', '...(true ? { wait:'],
  ];
  for (const [name, f, from, to] of CONTROLS) {
    const d2 = mkdtempSync(join(tmpdir(), 'mare-bfcmadd-ctl-'));
    try {
      cpSync(ROOT, d2, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      const fp = join(d2, f), txt = readFileSync(fp, 'utf8');
      if (!txt.includes(from)) { missed++; console.log(`  FAIL control "${name}": the line to break is gone from ${f}; the control needs updating`); continue; }
      writeFileSync(fp, txt.replace(from, to));
      const r = spawnSync(process.execPath, [join(d2, 'tools/bfcmadd-proof.mjs'), '--no-controls'], { encoding: 'utf8', timeout: 240_000, env: { ...process.env, NODE_PATH: join(ROOT, 'node_modules') } });
      const out = `${r.stdout}${r.stderr}`, broke = (out.match(/\n  FAIL /g) || []).length;
      if (r.status !== 0 && broke > 0) { caught++; console.log(`  ok   caught: ${name} (${broke} proof${broke === 1 ? '' : 's'} failed)`); }
      else { missed++; console.log(`  FAIL control "${name}" was not caught (exit ${r.status})`); }
    } finally { try { rmSync(d2, { recursive: true, force: true }); } catch {} }
  }
  console.log(`${caught} of ${CONTROLS.length} controls caught`);
}
process.exit(failed || missed ? 1 : 0);
