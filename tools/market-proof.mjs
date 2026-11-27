// Mare Liberum · proof of the price in the store's own currency (3.75, node/deal.mjs MARKET, node/lens.mjs, "Der Preis in der
// Heimatwährung"): the sea's reader runs in Germany, and a Shopify store shows it the prices of its market for Germany, often
// converted into euros. A store in St. Louis then stood in an open record with a euro price no person at home sees, and the
// catalog was searched in euros, where the same item is rarely listed.
// It proves, with shops, a catalog and DNS of its own (no network):
//   parts    a Shopify product page is https and ends in /products/<handle> (never a cart or checkout); a store's /meta.json
//            gives its currency and country only when they are three and two capital letters; ?currency= is set on the page
//            with its variant kept
//   home     a US store's page shown in EUR is read again with ?currency=USD: the check compares and keeps 4.09 USD, the
//            catalog is asked in USD, the answer and the record say product.market (first 3.95 EUR, asked USD, held) and one line
//            of the verdict says it; the record's address carries no ?currency=
//   stays    a page that stays in EUR when asked in USD keeps its EUR price, says held: false and the line says so
//   same     a page already in the store's own currency, a store without /meta.json and a page that is no product page are read
//            once, with no market in the answer; a currency the caller asks for goes before the store's own
//   once     a store's /meta.json is asked at most once a week (once a day when it names no currency)
//   counted  the extra reads are the sea's own: an agent's check counts one read of the day (its page), not three
//   book     a visit of the record book keeps the series of the page in the store's own currency
// Negative controls at the end: each rule broken in a copy of the code, and this proof must fail there.
// Runs without the network: node tools/market-proof.mjs   (exit code 1 when a proof fails or a control is not caught)
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
process.env.MARE_VIA_SECRET = 'market-proof-via-key, a test value';
let passed = 0, failed = 0;
const D = globalThis.Date; let T0 = D.parse('2026-11-27T11:00:00.000Z');
class Clock extends D { constructor(...a) { if (a.length) super(...a); else super(T0); } static now() { return T0; } }
globalThis.Date = Clock;
const proof = async (name, fn) => { T0 += 60_000; try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 6).join('\n       ')}`); } };
const imp = (f) => import(pathToFileURL(join(ROOT, 'node', f)).href);
const { MARKET, shopifyPage, homeOf, inCurrency, marketOf } = await imp('deal.mjs');

// ------------------------------------------------------------------ the world: shops, the catalog, DNS
const CATALOG = 'https://catalog.shopify.com/api/ucp/mcp';
const productPage = ({ name = 'Uni POSCA Paint Marker PC-3M', brand = 'Mitsubishi Pencil', price = '3.95', cur = 'EUR', gtin = '4902778915912' } = {}) => `<!doctype html><html lang="en"><head><title>${name} · Shop</title><meta name="description" content="${name} by ${brand}">
<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'Product', name, brand: { '@type': 'Brand', name: brand }, ...(gtin ? { gtin13: gtin } : {}), offers: { '@type': 'Offer', price, priceCurrency: cur, availability: 'https://schema.org/InStock' } })}</script></head>
<body><main><h1>${name}</h1><p>The ${name} is a paint marker with opaque ink that covers paper, wood, glass and metal, for artists and schools.</p><p>Price: ${price} ${cur}</p></main></body></html>`;
// each shop: its /meta.json (or none) and its pages; a page given a function of the currency asked for (null: none asked)
const SHOPS = {
  'us.market-proof.dev': { meta: { name: 'Art Supply', country: 'US', currency: 'USD' }, pages: { '/products/posca-pc-3m': (c) => (c === 'USD' ? productPage({ price: '4.09', cur: 'USD' }) : productPage()) } },
  'stuck.market-proof.dev': { meta: { name: 'Stuck Shop', country: 'US', currency: 'USD' }, pages: { '/products/posca-pc-3m': () => productPage() } },
  'home.market-proof.dev': { meta: { name: 'Home Shop', country: 'DE', currency: 'EUR' }, pages: { '/products/posca-pc-3m': () => productPage({ price: '3.80' }) } },
  'none.market-proof.dev': { meta: null, pages: { '/products/posca-pc-3m': () => productPage({ price: '3.70' }) } },
  'odd.market-proof.dev': { meta: 'not json', pages: { '/products/posca-pc-3m': () => productPage({ price: '3.75' }) } },
  'gb.market-proof.dev': { meta: { name: 'Leeds Shop', country: 'GB', currency: 'GBP' }, pages: { '/products/posca-pc-3m': (c) => (c === 'GBP' ? productPage({ price: '3.50', cur: 'GBP' }) : productPage({ price: '4.15' })) } },
  'plain.market-proof.dev': { meta: { name: 'Plain Shop', country: 'US', currency: 'USD' }, pages: { '/p/posca-pc-3m': () => productPage({ price: '3.60' }) } },
  'book.market-proof.dev': { meta: { name: 'Book Shop', country: 'US', currency: 'USD' }, pages: { '/products/posca-pc-3m': (c) => (c === 'USD' ? productPage({ price: '4.29', cur: 'USD' }) : productPage({ price: '4.10' })) } },
};
const fetched = []; // every request to a shop: host, path and the currency asked for
const offer = (title, cents, cur, host, { name = null } = {}) => ({ title, price_range: { min: { amount: cents, currency: cur } }, variants: [{ price: { amount: cents, currency: cur }, availability: { available: true }, seller: { url: `https://${host}`, name: name || host }, url: `https://${host}/products/x`, checkout_url: `https://${host}/cart/c/1` }] });
const POSCA = [offer('Uni POSCA Paint Marker PC-3M', 389, 'USD', 'blick.market-proof.dev', { name: 'Blick' }), offer('POSCA Paint Marker PC-3M', 450, 'USD', 'jerrys.market-proof.dev', { name: 'Jerrys' }), offer('Uni POSCA Paint Marker PC-3M', 360, 'EUR', 'boesner.market-proof.dev', { name: 'Boesner' })];
const catalogAsked = [];
const answer = (j, status = 200) => new Response(JSON.stringify(j), { status, headers: { 'content-type': 'application/json' } });
globalThis.fetch = async (u, o = {}) => {
  const s = String(u?.url ?? u);
  if (s === CATALOG) { const args = JSON.parse(o.body)?.params?.arguments || {}; catalogAsked.push(JSON.stringify(args)); const q = String(args?.catalog?.query || ''); return answer({ jsonrpc: '2.0', id: 1, result: { structuredContent: { products: /posca/i.test(q) ? POSCA : [] } } }); }
  const url = new URL(s);
  if (!url.hostname.endsWith('.market-proof.dev')) throw new Error(`the proof does not use the network: ${s.slice(0, 80)}`);
  if (url.pathname === '/robots.txt') return new Response('User-agent: *\nAllow: /\n', { status: 200, headers: { 'content-type': 'text/plain' } });
  const c = url.searchParams.get('currency'); fetched.push({ host: url.hostname, path: url.pathname, c });
  const shop = SHOPS[url.hostname];
  if (shop && url.pathname === '/meta.json' && shop.meta) return new Response(typeof shop.meta === 'string' ? shop.meta : JSON.stringify(shop.meta), { status: 200, headers: { 'content-type': 'application/json' } });
  const f = shop?.pages?.[url.pathname];
  if (f) return new Response(f(c), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
  return new Response('not here', { status: 404, headers: { 'content-type': 'text/plain' } });
};
createRequire(import.meta.url)('node:dns').promises.lookup = async () => [{ address: '93.184.216.34', family: 4 }];
for (const k of ['error', 'warn', 'info']) console[k] = () => {};
{ const say = console.log; console.log = (...a) => { if (!/^mare_/.test(String(a[0] ?? ''))) say(...a); }; }
const of = (host) => fetched.filter((x) => x.host === host);

// ------------------------------------------------------------------ the node
const BASE = 'https://mare.test', SITE = { '/llms.txt': { body: readFileSync(join(ROOT, 'site/llms.txt'), 'utf8'), type: 'text/plain; charset=utf-8' } };
const core = await imp('core.mjs'), { createMem } = await imp('mem.mjs'), { memoryKv } = await imp('flow.mjs');
const { immune } = await imp('immune.mjs'), { createLedger } = await imp('ledger.mjs'), { payConfig } = await imp('pay.mjs');
const dir = mkdtempSync(join(tmpdir(), 'mare-market-')), file = join(dir, 'sea.tsv');
process.once('exit', () => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });
writeFileSync(file, ''); writeFileSync(join(dir, 'build.json'), JSON.stringify({ builtAt: '2026-11-20T10:00:00.000Z', entries: 0, lakes: {} }));
const db = createMem({ file, base: BASE }), kv = memoryKv(), ledger = createLedger({}), waits = [];
const cfg = { base: BASE, kv, ledger, pay: payConfig({}), site: SITE, waitUntil: (p) => { waits.push(p); }, creditSweepMs: 0 };
let ipn = 10;
const call = async (path, { method = 'GET', accept = 'application/json', ip = `198.51.100.${ipn++}`, ua = 'market-proof-agent/1.0', body } = {}) => {
  const h = { accept, 'user-agent': ua, 'x-forwarded-for': ip, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) };
  const res = await core.handle(new Request(BASE + path, { method, headers: h, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }), db, cfg);
  const text = res.body ? Buffer.from(await res.arrayBuffer()).toString('utf8') : ''; let j = null; try { j = JSON.parse(text); } catch {}
  return { status: res.status, text, j };
};
await call('/stats', { ip: '127.0.0.1' });
immune.set({ mode: 'normal', rest: [], pace: { perMinute: 1_000_000, burst: 1_000_000 } });
const sea = core.seaOf(db, cfg, BASE);
const day = () => new Date().toISOString().slice(0, 10);
const page = (host, path = '/products/posca-pc-3m') => `https://${host}${path}`;
const deal = async (u, extra = '') => { const r = await call(`/deal?url=${encodeURIComponent(u)}${extra}`); assert.equal(r.status, 200, r.text.slice(0, 200)); return r.j; };

console.log('parts');
await proof('a Shopify product page, a store\'s own currency and ?currency= are read exactly', async () => {
  assert.equal(shopifyPage('https://shop.example/products/posca'), true);
  assert.equal(shopifyPage('https://shop.example/collections/art/products/posca?variant=1'), true);
  for (const u of ['http://shop.example/products/posca', 'https://shop.example/p/posca', 'https://shop.example/cart/products/x', 'https://shop.example/checkouts/products/x', 'https://shop.example/products/', 'nonsense', null]) assert.equal(shopifyPage(u), false, String(u));
  assert.deepEqual(homeOf('{"name":"A","country":"US","currency":"USD"}'), { currency: 'USD', country: 'US' });
  assert.deepEqual(homeOf('{"currency":"GBP","country":"United Kingdom"}'), { currency: 'GBP', country: null });
  for (const t of ['{"currency":"usd"}', '{"currency":"US Dollar"}', '{"country":"US"}', 'not json', '', null, '<html>']) assert.equal(homeOf(t), null, String(t));
  assert.equal(inCurrency('https://shop.example/products/posca?variant=4711', 'USD'), 'https://shop.example/products/posca?variant=4711&currency=USD');
  assert.equal(inCurrency('https://shop.example/products/posca?currency=EUR', 'USD'), 'https://shop.example/products/posca?currency=USD');
  const m = marketOf({ first: { price: 3.95, currency: 'EUR' }, asked: 'USD', home: 'USD', country: 'US', held: true });
  assert.deepEqual(m, { asked: 'USD', home: 'USD', country: 'US', first: { price: 3.95, currency: 'EUR' }, held: true, source: 'the page read again with ?currency=USD' });
  assert.equal(MARKET.keepDays, 7); assert.equal(MARKET.meta, '/meta.json');
});

console.log('home');
await proof('a US store\'s page shown in EUR is read again in USD: 4.09 USD compared and kept, the catalog asked in USD, the record says why', async () => {
  const before = catalogAsked.length, j = await deal(page('us.market-proof.dev'));
  assert.equal(j.product.price, 4.09); assert.equal(j.product.currency, 'USD');
  assert.deepEqual(j.product.market, { asked: 'USD', home: 'USD', country: 'US', first: { price: 3.95, currency: 'EUR' }, held: true, source: 'the page read again with ?currency=USD' });
  assert.equal(j.product.url, page('us.market-proof.dev'), 'the page\'s own address, no ?currency=');
  assert.match(j.verdict.lines.join(' '), /On this page: 4\.09 USD, in stock\. Currency: the reader in Germany was first shown 3\.95 EUR; the store's own currency is USD \(its \/meta\.json\), so the page was read again in USD\./);
  assert.ok(catalogAsked.slice(before).some((x) => /USD/.test(x)), 'the catalog asked in USD');
  assert.ok(j.elsewhere.length >= 2 && j.elsewhere.every((o) => o.currency === 'USD'), 'offers compared in USD');
  assert.equal(j.verdict.word, 'cheaper-elsewhere'); assert.equal(j.cheapest.price, 3.89);
  assert.deepEqual(of('us.market-proof.dev').map((x) => `${x.path}${x.c ? `?currency=${x.c}` : ''}`), ['/products/posca-pc-3m', '/meta.json', '/products/posca-pc-3m?currency=USD']);
  assert.ok(j.record?.id, 'a record');
  const rec = (await call(`/seen/${j.record.id}.json`)).j;
  assert.equal(rec.product.price, 4.09); assert.equal(rec.product.currency, 'USD'); assert.equal(rec.product.market.first.currency, 'EUR'); assert.equal(rec.product.market.held, true);
  assert.equal(rec.product.url, page('us.market-proof.dev'));
  assert.match(rec.verdict.lines.join(' '), /first shown 3\.95 EUR/);
});

console.log('stays');
await proof('a page that stays in EUR when asked in USD keeps its EUR price, says held: false and the line says so', async () => {
  const j = await deal(page('stuck.market-proof.dev'));
  assert.equal(j.product.price, 3.95); assert.equal(j.product.currency, 'EUR');
  assert.equal(j.product.market.held, false); assert.equal(j.product.market.asked, 'USD'); assert.equal(j.product.market.source, 'the page as the reader in Germany was shown it');
  assert.match(j.verdict.lines.join(' '), /the store's own currency is USD \(its \/meta\.json\), but the page stayed in EUR when asked in it; this is the price the store shows a reader in Germany\./);
  assert.ok(j.elsewhere.every((o) => o.currency === 'EUR'));
});

console.log('same');
await proof('a page in the store\'s own currency, a store without /meta.json or with a broken one, and a page that is no product page are read once, with no market', async () => {
  for (const [host, path, price, meta] of [['home.market-proof.dev', undefined, 3.8, true], ['none.market-proof.dev', undefined, 3.7, true], ['odd.market-proof.dev', undefined, 3.75, true], ['plain.market-proof.dev', '/p/posca-pc-3m', 3.6, false]]) {
    const j = await deal(page(host, path));
    assert.equal(j.product.price, price, host); assert.equal(j.product.currency, 'EUR', host); assert.equal(j.product.market, undefined, host);
    assert.doesNotMatch(j.verdict.lines.join(' '), /Currency:/, host);
    assert.equal(of(host).filter((x) => x.path !== '/meta.json').length, 1, `${host}: the page once`);
    assert.equal(of(host).filter((x) => x.path === '/meta.json').length, meta ? 1 : 0, `${host}: /meta.json ${meta ? 'once' : 'never'}`);
  }
});
await proof('a currency the caller asks for goes before the store\'s own', async () => {
  const a = await deal(page('gb.market-proof.dev'));
  assert.equal(a.product.price, 3.5); assert.equal(a.product.currency, 'GBP'); assert.equal(a.product.market.home, 'GBP'); assert.equal(a.product.market.country, 'GB');
  const n = of('us.market-proof.dev').length, b = await deal(page('us.market-proof.dev'), '&currency=EUR');
  assert.equal(b.product.price, 3.95); assert.equal(b.product.currency, 'EUR'); assert.equal(b.product.market, undefined, 'asked in EUR, shown in EUR');
  assert.deepEqual(of('us.market-proof.dev').slice(n).map((x) => x.c), [null], 'only the page, no read in USD');
  const c = await deal(page('home.market-proof.dev'), '&currency=usd');
  assert.equal(c.product.market.asked, 'USD'); assert.equal(c.product.market.home, 'EUR'); assert.equal(c.product.market.held, false);
  assert.match(c.verdict.lines.join(' '), /Currency: USD was asked for, but the page stayed in EUR/);
});

console.log('once');
await proof('a store\'s /meta.json is asked at most once a week; one that names no currency once a day', async () => {
  const metas = (h) => of(h).filter((x) => x.path === '/meta.json').length;
  const u0 = metas('us.market-proof.dev'), o0 = metas('odd.market-proof.dev');
  await deal(page('us.market-proof.dev')); await deal(page('odd.market-proof.dev'));
  assert.equal(metas('us.market-proof.dev'), u0, 'the week kept'); assert.equal(metas('odd.market-proof.dev'), o0, 'the day kept');
  T0 += 2 * 86_400_000;
  await deal(page('us.market-proof.dev')); await deal(page('odd.market-proof.dev'));
  assert.equal(metas('us.market-proof.dev'), u0, 'two days later the week still holds'); assert.equal(metas('odd.market-proof.dev'), o0 + 1, 'two days later asked again');
  T0 += 6 * 86_400_000;
  await deal(page('us.market-proof.dev'));
  assert.equal(metas('us.market-proof.dev'), u0 + 1, 'after the week asked again');
});

console.log('counted');
await proof('the extra reads are the sea\'s own: an agent\'s check counts one read of the day, not three', async () => {
  const total = async () => Number((await kv.get(`reads:${day()}`))?.total) || 0;
  await kv.set('deal:home:book.market-proof.dev', null);
  const t0 = await total(), n0 = of('book.market-proof.dev').length;
  const j = await deal(page('book.market-proof.dev'));
  assert.equal(j.product.currency, 'USD'); assert.equal(of('book.market-proof.dev').length - n0, 3, 'page, /meta.json, page in USD');
  assert.equal(await total() - t0, 1, 'one read of the day');
});

console.log('book');
await proof('a visit of the record book keeps the series of the page in the store\'s own currency', async () => {
  T0 += 86_400_000; const u = page('book.market-proof.dev');
  await kv.set('tide:recent', ['posca']); await kv.set('tide:posca', { need: 'posca', url: u, price: 1, currency: 'USD' }); await kv.set('book:cursor', 0);
  const r = await sea.bookStep(BASE);
  assert.equal(r.url, u, JSON.stringify(r)); assert.ok(r.record, 'a record');
  const s = await sea.bookSeries(u); assert.equal(s.at(-1).c, 'USD'); assert.equal(s.at(-1).p, 4.29);
  const rec = (await call(`/seen/${r.record}.json`)).j; assert.equal(rec.by, 'sea'); assert.equal(rec.product.currency, 'USD'); assert.equal(rec.product.market.first.price, 4.1);
});

console.log(`\n${passed} of ${passed + failed} proofs passed`);

// ------------------------------------------------------------------ negative controls: each rule broken in a copy, the proof must fail there
let caught = 0, missed = 0;
if (!process.argv.includes('--no-controls')) {
  console.log('\nnegative controls: each rule broken in a copy, the proof must fail there');
  const CONTROLS = [
    ['the page kept in the currency the reader was shown', 'node/lens.mjs', 'if (asked && asked !== product.currency) {', 'if (false) {'],
    ['the store\'s own currency never asked', 'node/lens.mjs', 'asked = want || home?.currency || null;', 'asked = want || null;'],
    ['the caller\'s currency after the store\'s own', 'node/lens.mjs', 'asked = want || home?.currency || null;', 'asked = home?.currency || want || null;'],
    ['a page that stayed in the other currency taken as held', 'node/lens.mjs', 'const held = p2?.currency === asked &&', 'const held = !!p2 &&'],
    ['the record without the market', 'node/seen.mjs', ', url, ...(p.market ? { market: p.market } : {}) },', ', url },'],
    ['the answer without the market', 'node/deal.mjs', ", ...(product.market ? { market: product.market } : {}) } : null,", ' } : null,'],
    ['the verdict silent about the currency', 'node/deal.mjs', 'if (mk && price != null) said(', 'if (false) said('],
    ['/meta.json asked at every check', 'node/lens.mjs', "if (had && typeof had === 'object') return", "if (false) return"],
    ['the extra reads counted as reads of the day', 'node/lens.mjs', 'const own = { ...ctx, dealRead: true, uncounted: true };', 'const own = { ...ctx, dealRead: true };'],
    ['any page asked again, not only product pages', 'node/deal.mjs', "return x.protocol === 'https:' && /\\/products\\/[^/]+\\/?$/.test(x.pathname) &&", "return x.protocol === 'https:' &&"],
    ['the record\'s address with ?currency=', 'node/lens.mjs', 'product = held ? { ...p2, url: product.url, market }', 'product = held ? { ...p2, url: again, market }'],
  ];
  for (const [name, f, from, to] of CONTROLS) {
    const d2 = mkdtempSync(join(tmpdir(), 'mare-market-ctl-'));
    try {
      cpSync(ROOT, d2, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      const fp = join(d2, f), txt = readFileSync(fp, 'utf8');
      if (!txt.includes(from)) { missed++; console.log(`  FAIL control "${name}": the line to break is gone from ${f}; the control needs updating`); continue; }
      writeFileSync(fp, txt.replace(from, to));
      const r = spawnSync(process.execPath, [join(d2, 'tools/market-proof.mjs'), '--no-controls'], { encoding: 'utf8', timeout: 240_000 });
      const out = `${r.stdout}${r.stderr}`, broke = (out.match(/\n  FAIL /g) || []).length;
      if (r.status !== 0 && broke > 0) { caught++; console.log(`  ok   caught: ${name} (${broke} proof${broke === 1 ? '' : 's'} failed)`); }
      else { missed++; console.log(`  FAIL control "${name}" was not caught (exit ${r.status})`); }
    } finally { try { rmSync(d2, { recursive: true, force: true }); } catch {} }
  }
  console.log(`${caught} of ${CONTROLS.length} controls caught`);
}
process.exit(failed || missed ? 1 : 0);
