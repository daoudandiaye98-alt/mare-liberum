// Mare Liberum · proof of the deal check (3.64, node/deal.mjs): one product page read with its price, list price and stock, the
// same item at other stores (Shopify Global Catalog), the prices agents saw for it through the sea, and a verdict whose rules are
// stated; free ten times an hour per network, then 0.01 USDC over x402.
// It proves, with shops written here (product pages with schema.org data, a shop whose robots.txt closes it, a page without a
// product) and a stubbed Shopify Global Catalog, web, DNS and facilitator (no network):
//   match    the same item is told from an accessory for it, from another model (a word with a digit missing) and from other
//            goods; the memory key is the GTIN, else the page (with its variant), else the words asked for
//   compare  out of stock, another currency and the page's own store do not count; one offer per store, the cheapest; the verdict
//            says cheaper elsewhere (with the percentage), lowest found, no comparison, or no product on the page; the page's own
//            list price is said to be its own claim; the memory keeps what pages showed, newest first, and the next check sees it
//   doors    GET /x402/deal without a payment: 402, exactly 0.01 USDC, the bazaar extension with its JSON Schema, v1 discoverable,
//            counted in the funnel; a payment of exactly 0.01 USDC buys one check (12 offers, the whole memory), once; another
//            sum is refused before the facilitator is asked; a check with nothing to compare is not charged (the claim given back,
//            the same payment then buys one); strict (a refused verdict delivers nothing); /deal makes ten checks an hour per
//            network for free (5 offers each), the eleventh is a 402 with the terms of that check (not listed), and paying there
//            makes it with the paid limits; the page a deal check reads is none of the free 100 reads of the day;
//            /openapi.json (seven doors), /.well-known/x402 (six moves), /discovery/resources and /funnel.json name the check
// Negative controls at the end: each rule broken in a copy of the code, and this proof must fail there.
// Runs without the network: node tools/deal-proof.mjs   (exit code 1 when a proof fails or a control is not caught)
//   --no-controls   only the proofs (the controls run this file that way in each broken copy)
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, cpSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { randomBytes, createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const k of ['MARE_TOLL', 'MARE_ENGINE', 'MARE_FAIR', 'MARE_X402_FACILITATOR', 'MARE_PAY_TO', 'MARE_ROUTE_PRICE_CENTS', 'MARE_STATE', 'MARE_DB_URL', 'MARE_DB_KEY', 'MARE_DB_SECRET', 'MARE_BASE_RPC', 'MARE_CATALOG_ID']) delete process.env[k];
process.env.MARE_VIA_SECRET = 'deal-proof-via-key, a test value';
let passed = 0, failed = 0;
const D = globalThis.Date; let T0 = D.parse('2026-11-27T09:00:00.000Z');
class Clock extends D { constructor(...a) { if (a.length) super(...a); else super(T0); } static now() { return T0; } }
globalThis.Date = Clock;
const proof = async (name, fn) => { T0 += 60_000; try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 6).join('\n       ')}`); } };
const imp = (f) => import(pathToFileURL(join(ROOT, 'node', f)).href);
const { DEAL, likeness, dealKey, remembered, seenOf, dealOf } = await imp('deal.mjs');

// ------------------------------------------------------------------ the world: shops, the catalog, DNS, a facilitator
const FAC = 'https://facilitator.deal-proof.dev', CATALOG = 'https://catalog.shopify.com/api/ucp/mcp';
const productPage = ({ name = 'Trail Runner 3', brand = 'Example', price = '89.00', was = '129.00', cur = 'USD', avail = 'InStock', gtin = '0123456789012' } = {}) => `<!doctype html><html lang="en"><head><title>${name} · Shop</title><meta name="description" content="${name} by ${brand}">
<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'Product', name, brand: { '@type': 'Brand', name: brand }, ...(gtin ? { gtin13: gtin } : {}), offers: { '@type': 'Offer', price, priceCurrency: cur, availability: `https://schema.org/${avail}`, ...(was ? { priceSpecification: [{ '@type': 'UnitPriceSpecification', priceType: 'https://schema.org/StrikethroughPrice', price: was, priceCurrency: cur }] } : {}) } })}</script></head>
<body><main><h1>${name}</h1><p>The ${name} is a shoe for long trails, light and quick on rock and mud, made to last for many seasons of running.</p><p>Price: ${price} ${cur}</p></main></body></html>`;
let shopPrice = '89.00';
const PAGES = {
  'shop.deal-proof.dev/products/trail-runner-3': () => productPage({ price: shopPrice }),
  'shop.deal-proof.dev/products/pricey': () => productPage({ name: 'Summit Jacket 2', brand: 'Example', price: '199.00', was: null, gtin: '0999999999999' }),
  'shop.deal-proof.dev/products/sold-out': () => productPage({ name: 'Trail Runner 3', price: '79.00', was: null, avail: 'OutOfStock', gtin: null }),
  'shop.deal-proof.dev/about': () => '<!doctype html><html><head><title>About us</title></head><body><main><h1>About us</h1><p>We sell shoes for trails and mountains since 1990, from a small shop by the sea, and we answer every mail ourselves.</p></main></body></html>',
};
for (let i = 0; i < 110; i++) PAGES[`shop.deal-proof.dev/notes/${i}`] = () => `<!doctype html><html><head><title>Note ${i}</title></head><body><main><h1>Note ${i}</h1><p>A note about trail number ${i}: it climbs through the forest, crosses two rivers and ends at a hut where runners rest.</p></main></body></html>`;
const offer = (title, cents, cur, host, { available = true, name = null } = {}) => ({ title, price_range: { min: { amount: cents, currency: cur } }, variants: [{ price: { amount: cents, currency: cur }, availability: { available }, seller: { url: `https://${host}`, name: name || host }, url: `https://${host}/products/x`, checkout_url: `https://${host}/cart/c/1` }] });
const RUNNER = [
  offer('Example Trail Runner 3 Running Shoe', 7995, 'USD', 'another.deal-proof.dev', { name: 'Another Shop' }),
  offer('Example Trail Runner 3', 8500, 'USD', 'another.deal-proof.dev', { name: 'Another Shop' }),
  offer('Trail Runner 3', 8400, 'USD', 'third.deal-proof.dev', { name: 'Third Shop' }),
  offer('Example Trail Runner 3', 9900, 'USD', 'pricey.deal-proof.dev', { name: 'Pricey Shop' }),
  offer('Shoe bag for the Trail Runner 3', 900, 'USD', 'bags.deal-proof.dev'),
  offer('Example Trail Runner 2', 4900, 'USD', 'old.deal-proof.dev'),
  offer('Example Trail Runner 3', 6000, 'USD', 'empty.deal-proof.dev', { available: false }),
  offer('Example Trail Runner 3', 7000, 'EUR', 'euro.deal-proof.dev'),
  offer('Example Trail Runner 3', 7000, 'USD', 'shop.deal-proof.dev'),
  ...Array.from({ length: 12 }, (_, i) => offer('Example Trail Runner 3', 10000 + i * 100, 'USD', `s${i}.deal-proof.dev`, { name: `Store ${i}` })),
];
const catalogAsked = [];
const fac = []; let facilitator = null;
const answer = (j, status = 200) => new Response(JSON.stringify(j), { status, headers: { 'content-type': 'application/json' } });
globalThis.fetch = async (u, o = {}) => {
  const s = String(u?.url ?? u);
  if (s.startsWith(FAC)) { const kind = s.slice(FAC.length + 1), body = JSON.parse(o.body); fac.push({ kind, body }); if (!facilitator) throw new Error('the facilitator must not be asked'); return facilitator(kind, body); }
  if (s === CATALOG) {
    const q = String(JSON.parse(o.body)?.params?.arguments?.catalog?.query || ''); catalogAsked.push(q);
    const products = /trail runner 3/i.test(q) ? RUNNER : /summit jacket/i.test(q) ? [] : [];
    return answer({ jsonrpc: '2.0', id: 1, result: { structuredContent: { products } } });
  }
  const url = new URL(s);
  if (!url.hostname.endsWith('.deal-proof.dev')) throw new Error(`the proof does not use the network: ${s.slice(0, 80)}`);
  if (url.pathname === '/robots.txt') return new Response(url.hostname.startsWith('closed.') ? 'User-agent: *\nDisallow: /\n' : 'User-agent: *\nAllow: /\n', { status: 200, headers: { 'content-type': 'text/plain' } });
  const f = PAGES[`${url.hostname}${url.pathname}`];
  if (f) return new Response(f(), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
  return new Response('not here', { status: 404, headers: { 'content-type': 'text/plain' } });
};
createRequire(import.meta.url)('node:dns').promises.lookup = async () => [{ address: '93.184.216.34', family: 4 }];
for (const k of ['error', 'warn', 'info']) console[k] = () => {};
const PAYER = '0x2222222222222222222222222222222222222222';
const settles = () => (kind) => answer(kind === 'verify' ? { isValid: true, payer: PAYER } : { success: true, transaction: `0x${randomBytes(32).toString('hex')}`, network: 'eip155:8453', payer: PAYER });

// ------------------------------------------------------------------ the node
const BASE = 'https://mare.test', SITE = { '/llms.txt': { body: readFileSync(join(ROOT, 'site/llms.txt'), 'utf8'), type: 'text/plain; charset=utf-8' } };
const core = await imp('core.mjs'), { createMem } = await imp('mem.mjs'), { memoryKv } = await imp('flow.mjs');
const { immune } = await imp('immune.mjs'), { createLedger } = await imp('ledger.mjs'), { payConfig } = await imp('pay.mjs');
const dir = mkdtempSync(join(tmpdir(), 'mare-deal-')), file = join(dir, 'sea.tsv');
process.once('exit', () => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });
writeFileSync(file, ''); writeFileSync(join(dir, 'build.json'), JSON.stringify({ builtAt: '2026-11-20T10:00:00.000Z', entries: 0, lakes: {} }));
const db = createMem({ file, base: BASE }), kv = memoryKv(), ledger = createLedger({}), waits = [];
const PAY = { ...payConfig({}), facilitator: FAC, settleWaitMs: 300, verifyMs: 800, settleMs: 4000 };
const cfg = { base: BASE, kv, ledger, pay: PAY, site: SITE, waitUntil: (p) => { waits.push(p); }, creditSweepMs: 0 };
const call = async (path, { method = 'GET', accept = 'application/json', ip, headers = {}, body } = {}) => {
  const h = { accept, 'user-agent': 'deal-proof-agent/1.0', 'x-forwarded-for': ip, ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers };
  const res = await core.handle(new Request(BASE + path, { method, headers: h, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }), db, cfg);
  const text = res.body ? Buffer.from(await res.arrayBuffer()).toString('utf8') : ''; let j = null; try { j = JSON.parse(text); } catch {}
  return { status: res.status, h: Object.fromEntries(res.headers), text, j };
};
await call('/stats', { ip: '127.0.0.1' });
immune.set({ mode: 'normal', rest: [], pace: { perMinute: 1_000_000, burst: 1_000_000 } });
const WALLET = PAY.payTo, USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
let net = 0; const fresh = () => `198.51.100.${++net}`;
const RUN = encodeURIComponent('https://shop.deal-proof.dev/products/trail-runner-3');
const payment = ({ value = '10000', to = WALLET, version = 2, nonce = `0x${randomBytes(32).toString('hex')}` } = {}) => {
  const authorization = { from: PAYER, to, value: String(value), validAfter: '0', validBefore: String(Math.floor(T0 / 1000) + 300), nonce };
  const inner = { signature: `0x${'ab'.repeat(65)}`, authorization };
  const p = version === 2 ? { x402Version: 2, accepted: { scheme: 'exact', network: 'eip155:8453', amount: String(value), asset: USDC, payTo: to }, payload: inner } : { x402Version: 1, scheme: 'exact', network: 'base', payload: inner };
  return { [version === 2 ? 'payment-signature' : 'x-payment']: Buffer.from(JSON.stringify(p)).toString('base64') };
};
const required = (r) => JSON.parse(Buffer.from(r.h['payment-required'], 'base64').toString('utf8'));
const funnel = async () => (await call('/funnel.json', { ip: '127.0.0.1' })).j;

console.log('match');
await proof('the same item matches; an accessory for it, another model and other goods do not', () => {
  assert.ok(likeness('Trail Runner 3', 'Example Trail Runner 3 Running Shoe') >= DEAL.match);
  assert.ok(likeness('Trail Runner 3', 'Trail Runner 3') >= 0.99);
  assert.ok(likeness('Trail Runner 3', 'Shoe bag for the Trail Runner 3') < DEAL.match, 'an accessory');
  assert.ok(likeness('Trail Runner 3', 'Example Trail Runner 2') < DEAL.match, 'another model');
  assert.ok(likeness('Sony WH-1000XM5 Wireless Headphones', 'Sony WH-1000XM4 Wireless Headphones') < DEAL.match, 'another model number');
  assert.ok(likeness('Sony WH-1000XM5 Wireless Headphones', 'Sony WH-1000XM5 Noise Canceling Wireless Headphones, Black') >= DEAL.match);
  assert.equal(likeness('Trail Runner 3', 'Garden hose 30 m'), 0);
});
await proof('the memory key: the GTIN, else the page with its variant, else the words asked for', () => {
  assert.equal(dealKey({ product: { gtin: '0123456789012', url: 'https://a.dev/p' } }), 'g:0123456789012');
  assert.equal(dealKey({ product: { url: 'https://www.A.dev/products/X/?variant=42&utm=1' } }), 'u:a.dev/products/x?variant=42');
  assert.equal(dealKey({ page: { url: 'https://a.dev/p/' } }), 'u:a.dev/p');
  assert.equal(dealKey({ q: 'Trail runner 3 EXAMPLE' }), 'q:3 example runner trail');
  assert.equal(dealKey({}), null);
});
await proof('the memory: newest first, the same price again within ten minutes is no new look, at most 60', () => {
  let m = remembered([], { t: '2026-11-27T09:00:00Z', p: 89, c: 'USD' });
  m = remembered(m, { t: '2026-11-27T09:05:00Z', p: 89, c: 'USD' }); assert.equal(m.length, 1);
  m = remembered(m, { t: '2026-11-27T09:20:00Z', p: 89, c: 'USD' }); assert.equal(m.length, 2);
  m = remembered(m, { t: '2026-11-27T09:21:00Z', p: 79, c: 'USD' }); assert.equal(m[0].p, 79);
  let big = []; for (let i = 0; i < 80; i++) big = remembered(big, { t: new D(Date.UTC(2026, 10, 1, 0, i * 11)).toISOString(), p: 50 + i, c: 'USD' });
  assert.equal(big.length, DEAL.seen.max);
  const s = seenOf(m, { currency: 'USD', full: true }); assert.equal(s.checks, 3); assert.equal(s.low.price, 79); assert.equal(s.first.at, '2026-11-27T09:00:00Z'); assert.equal(s.prices.length, 3);
  assert.equal(seenOf(m, { currency: 'EUR' }).checks, 0);
});

console.log('compare');
const runner = { name: 'Trail Runner 3', brand: 'Example', price: 89, was: 129, currency: 'USD', availability: 'in stock', gtin: '0123456789012', url: 'https://shop.deal-proof.dev/products/trail-runner-3' };
const catalogOf = () => RUNNER.map((p) => { const v = p.variants[0]; return { title: p.title, price: v.price.amount / 100, currency: v.price.currency, inStock: v.availability.available, url: v.url, checkout: v.checkout_url, store: v.seller.name, storeUrl: v.seller.url, storeHost: new URL(v.seller.url).hostname }; });
await proof('cheaper elsewhere: out of stock, another currency, the page\'s own store, accessories and other models do not count; one offer per store, the cheapest', () => {
  const r = dealOf({ product: runner, page: { url: runner.url, host: 'shop.deal-proof.dev', read: true }, offers: catalogOf(), paid: true });
  assert.equal(r.found, true); assert.equal(r.verdict.word, 'cheaper-elsewhere');
  assert.equal(r.cheapest.store, 'Another Shop'); assert.equal(r.cheapest.price, 79.95); assert.equal(r.cheapest.below_page_pct, 10.2); assert.equal(r.cheapest.checkout, 'https://another.deal-proof.dev/cart/c/1');
  const stores = r.elsewhere.map((o) => o.store); assert.equal(new Set(stores).size, stores.length, 'one offer per store');
  for (const bad of ['bags.deal-proof.dev', 'old.deal-proof.dev', 'empty.deal-proof.dev', 'euro.deal-proof.dev', 'shop.deal-proof.dev']) assert.ok(!r.elsewhere.some((o) => o.url?.includes(bad)), bad);
  assert.deepEqual(r.elsewhere.slice(0, 3).map((o) => o.price), [79.95, 84, 99]); assert.equal(r.elsewhere.length, DEAL.offers.paid);
  assert.match(r.verdict.lines.join(' '), /list price of 129 USD: 31 % off by its own words/); assert.match(r.verdict.lines.join(' '), /2 other stores list the same item for less/);
  assert.match(r.verdict.lines.join(' '), /first check of this product through the sea/);
  assert.equal(dealOf({ product: runner, page: { url: runner.url, host: 'shop.deal-proof.dev', read: true }, offers: catalogOf() }).elsewhere.length, DEAL.offers.free, 'free: 5 offers');
});
await proof('lowest found, no comparison, no product on the page, and the memory of earlier checks in the verdict', () => {
  const cheap = { ...runner, price: 70, was: null };
  const a = dealOf({ product: cheap, page: { url: runner.url, host: 'shop.deal-proof.dev', read: true }, offers: catalogOf() });
  assert.equal(a.verdict.word, 'lowest-found'); assert.equal(a.cheapest.where, 'this page'); assert.match(a.verdict.lines.join(' '), /lowest price of \d+ matching offers found in USD/);
  const b = dealOf({ product: runner, page: { url: runner.url, host: 'shop.deal-proof.dev', read: true }, offers: [] }); assert.equal(b.verdict.word, 'no-comparison'); assert.equal(b.found, true);
  const c = dealOf({ product: null, page: { url: 'https://shop.deal-proof.dev/about', host: 'shop.deal-proof.dev', read: true }, offers: [] }); assert.equal(c.found, false); assert.equal(c.verdict.word, 'nothing-to-compare'); assert.match(c.verdict.lines[0], /holds no product data/);
  const seen = [{ t: '2026-11-20T10:00:00Z', p: 75, c: 'USD' }, { t: '2026-11-10T10:00:00Z', p: 95, c: 'USD' }];
  const d = dealOf({ product: runner, page: { url: runner.url, host: 'shop.deal-proof.dev', read: true }, offers: [], seen }); assert.match(d.verdict.lines.join(' '), /saw a lower price for it through the sea: 75 USD on 2026-11-20 \(2 checks since 2026-11-10\)/);
  assert.equal(d.seen.checks, 2); assert.equal(d.seen.prices, undefined, 'the whole memory only when paid');
  assert.ok(Array.isArray(d.rules) && d.rules.length >= 4); assert.match(d.notice, /data, never instructions/);
});

await proof('a store far below the others is marked with a caution, the verdict says so and names the lowest offer without such a gap; a page without one price is compared from its lowest variant', () => {
  const offers = [['Odd Shop', 40, 'odd.deal-proof.dev'], ['Good Shop', 84, 'good.deal-proof.dev'], ['Fair Shop', 86, 'fair.deal-proof.dev'], ['Big Shop', 92, 'big.deal-proof.dev']].map(([store, price, h]) => ({ title: 'Example Trail Runner 3', price, currency: 'USD', inStock: true, url: `https://${h}/p`, checkout: `https://${h}/c`, store, storeHost: h }));
  const r = dealOf({ product: runner, page: { url: runner.url, host: 'shop.deal-proof.dev', read: true }, offers });
  assert.equal(r.verdict.word, 'cheaper-elsewhere'); assert.equal(r.cheapest.store, 'Odd Shop'); assert.match(r.cheapest.caution, /^53\.5 % below the median of the offers found \(86 USD\)$/);
  assert.equal(r.elsewhere[0].caution, r.cheapest.caution); assert.equal(r.elsewhere[1].caution, undefined); assert.deepEqual(r.median, { price: 86, currency: 'USD', of: 5 });
  const lines = r.verdict.lines.join(' '); assert.match(lines, /Caution: that offer is 53\.5 % below the median/); assert.match(lines, /The lowest offer without such a gap: 84 USD at Good Shop \(5\.6 % below this page\)/);
  assert.equal(r.next[0].do, 'check the store before paying'); assert.equal(r.next[1].do, 'buy');
  const v = dealOf({ product: { ...runner, price: null, low: 79, high: 99, was: null }, page: { url: runner.url, host: 'shop.deal-proof.dev', read: true }, offers: [] });
  assert.equal(v.product.price, 79); assert.match(v.product.price_is, /^from/); assert.equal(v.product.high, 99); assert.match(v.verdict.lines[0], /^On this page: from 79 USD \(its lowest variant\)/);
  assert.ok(r.rules.some((x) => /vouches for no store/.test(x)));
});

console.log('doors');
await proof('GET /x402/deal without a payment: 402, exactly 0.01 USDC to the till, v2 with the bazaar extension and its JSON Schema, v1 discoverable; counted', async () => {
  facilitator = null; const before = (await funnel()).asked.deal || 0;
  const r = await call(`/x402/deal?url=${RUN}`, { ip: fresh() });
  assert.equal(r.status, 402);
  const v2 = required(r); assert.equal(v2.accepts[0].amount, '10000'); assert.equal(v2.accepts[0].payTo, WALLET); assert.equal(v2.resource.url, `${BASE}/x402/deal`);
  assert.equal(v2.extensions.bazaar.info.input.method, 'GET'); assert.equal(v2.extensions.bazaar.schema.properties.input.properties.queryParams.properties.url.type, 'string');
  assert.equal(r.j.accepts[0].maxAmountRequired, '10000'); assert.equal(r.j.accepts[0].outputSchema.input.discoverable, true); assert.equal(r.j.amount_usd, '0.010000');
  const p = await call('/x402/deal', { method: 'POST', ip: fresh(), body: { url: 'https://shop.deal-proof.dev/products/trail-runner-3' } }); assert.equal(p.status, 402);
  assert.equal((await funnel()).asked.deal, before + 2); assert.equal((await funnel()).doors.deal, `GET ${BASE}/x402/deal?url=<product page>`);
});
await proof('/openapi.json names GET /x402/deal (0.01 USD) and the free /deal (security: []), seven sold doors; /.well-known/x402 (six moves) and /discovery/resources list it', async () => {
  const o = (await call('/openapi.json', { ip: '127.0.0.1' })).j, op = o.paths['/x402/deal']?.get, free = o.paths['/deal']?.get;
  assert.ok(op); assert.deepEqual(op['x-payment-info'], { price: { mode: 'fixed', currency: 'USD', amount: '0.01' }, protocols: [{ x402: {} }] }); assert.ok(op.responses['402']); assert.equal(op.security, undefined);
  assert.ok(free); assert.deepEqual(free.security, []);
  assert.match(o.info['x-guidance'], /Seven doors are sold/); assert.match(o.info['x-guidance'], /\/x402\/deal\?url=<product page>/); assert.ok(o.info['x-guidance'].length < 4000, `x-guidance ${o.info['x-guidance'].length} characters`);
  // at the real address too (it stands in the guidance some 25 times): under 4,000 characters, as the indexes take it
  const real = 'https://mareliberum.dev', g2 = JSON.parse(await (await core.handle(new Request(`${real}/openapi.json`, { headers: { 'user-agent': 'deal-proof-agent/1.0', 'x-forwarded-for': '127.0.0.1' } }), db, { ...cfg, base: real })).text()).info['x-guidance'];
  assert.ok(g2.length < 4000, `x-guidance at ${real}: ${g2.length} characters`);
  const w = (await call('/.well-known/x402', { ip: '127.0.0.1' })).j; assert.ok(w.resources.includes(`${BASE}/x402/deal`)); const blk = w.pricing.find((p) => p.capability === 'deal');
  assert.equal(blk.amount_usd, '0.01'); assert.equal(blk.maxAmountRequired, '10000'); assert.equal(blk.payTo, WALLET); assert.match(w.instructions, /six moves/); assert.match(w.instructions, /\/x402\/deal\?url=<product page>/);
  const d = (await call('/discovery/resources', { ip: '127.0.0.1' })).j, it = d.items.find((x) => x.resource === `${BASE}/x402/deal`);
  assert.ok(it); assert.equal(it.accepts[0].amount, '10000'); assert.ok(it.extensions.bazaar.info.output.example.verdict); assert.equal(d.pagination.total, d.items.length);
});
await proof('another amount or another wallet is refused before the facilitator is asked', async () => {
  facilitator = null; fac.length = 0;
  const a = await call(`/x402/deal?url=${RUN}`, { ip: fresh(), headers: payment({ value: '50000' }) });
  const b = await call(`/x402/deal?url=${RUN}`, { ip: fresh(), headers: payment({ to: '0x3333333333333333333333333333333333333333' }) });
  assert.equal(a.status, 402); assert.match(a.j.error, /a deal check costs exactly 0\.010000/); assert.equal(b.status, 402); assert.match(b.j.error, /another wallet/);
  assert.equal(fac.length, 0);
});
await proof('a check with nothing to compare is never charged; its claim is given back and buys a check afterwards', async () => {
  facilitator = null; fac.length = 0; const pay = payment(), ip = fresh();
  const a = await call('/x402/deal', { ip, headers: pay }); assert.equal(a.status, 400); assert.match(a.j.error.message, /Nothing was charged/);
  const b = await call(`/x402/deal?url=${encodeURIComponent('https://shop.deal-proof.dev/about')}`, { ip, headers: pay }); assert.equal(b.status, 422, b.text.slice(0, 200)); assert.match(b.j.error.message, /Nothing was charged/);
  const c = await call(`/x402/deal?url=${encodeURIComponent('https://closed.deal-proof.dev/products/x')}`, { ip, headers: pay }); assert.equal(c.status, 422, c.text.slice(0, 200));
  assert.equal(fac.length, 0);
  facilitator = settles(); const d = await call(`/x402/deal?url=${RUN}`, { ip, headers: pay }); assert.equal(d.status, 200, d.text.slice(0, 200));
});
await proof('strict: a refused payment and a payment without a verdict deliver nothing', async () => {
  facilitator = (kind) => answer(kind === 'verify' ? { isValid: false, invalidReason: 'insufficient_funds' } : { success: false });
  const a = await call(`/x402/deal?url=${RUN}`, { ip: fresh(), headers: payment() });
  assert.equal(a.status, 402); assert.match(a.j.error, /not accepted/); assert.equal(a.j.verdict, undefined);
  facilitator = () => answer({ error: 'busy' }, 500);
  const b = await call(`/x402/deal?url=${RUN}`, { ip: fresh(), headers: payment() });
  assert.equal(b.status, 402); assert.match(b.j.error, /nothing was charged/); assert.equal(b.j.verdict, undefined);
});
await proof('a paid check: the product, cheaper elsewhere, 12 offers and the whole memory, settled, in the till\'s books, counted; a payment buys once', async () => {
  facilitator = settles(); fac.length = 0;
  const f0 = await funnel(), t0 = await ledger.treasury(), pay = payment(), ip = fresh();
  const r = await call(`/x402/deal?url=${RUN}`, { ip, headers: pay });
  assert.equal(r.status, 200, r.text.slice(0, 300));
  assert.equal(r.j.product.name, 'Trail Runner 3'); assert.equal(r.j.product.price, 89); assert.equal(r.j.product.list_price, 129); assert.equal(r.j.product.in_stock, true);
  assert.equal(r.j.verdict.word, 'cheaper-elsewhere'); assert.equal(r.j.cheapest.store, 'Another Shop'); assert.equal(r.j.elsewhere.length, DEAL.offers.paid); assert.ok(Array.isArray(r.j.seen.prices) || r.j.seen.checks === 0);
  assert.equal(r.j.paid.status, 'settled'); assert.equal(r.j.paid.amount_usd, '0.010000'); assert.ok(r.h['payment-response']); assert.deepEqual(fac.map((x) => x.kind), ['verify', 'settle']);
  assert.ok(catalogAsked.some((q) => /Example Trail Runner 3/.test(q)), `the catalog was asked for the brand and the name: ${catalogAsked.slice(-1)}`);
  const t1 = await ledger.treasury(); assert.equal(t1.total_count, (t0.total_count || 0) + 1);
  const sale = (t1.last_5 || []).find((s) => s.q === 'deal: Trail Runner 3'); assert.ok(sale, JSON.stringify(t1.last_5)); assert.equal(sale.amount_usd, 0.01);
  const f1 = await funnel(); assert.equal(f1.paid.deal, (f0.paid.deal || 0) + 1);
  fac.length = 0; const again = await call(`/x402/deal?url=${RUN}`, { ip, headers: pay }); assert.equal(again.status, 402); assert.match(again.j.error, /buys once/); assert.equal(fac.length, 0);
});

console.log('the free door');
await proof('/deal without a page or a name says what it is; with a name it compares the catalog\'s offers', async () => {
  const h = await call('/deal', { ip: fresh() }); assert.equal(h.status, 200); assert.match(h.j.use, /\/deal\?url=<product page>/); assert.ok(Number.isInteger(h.j.today.checks) && h.j.today.checks > 0, `today: ${JSON.stringify(h.j.today)}`); assert.equal(h.j.today.day, new Date(T0).toISOString().slice(0, 10));
  const q = await call('/deal?q=Example+Trail+Runner+3&currency=USD', { ip: fresh() }); assert.equal(q.status, 200, q.text.slice(0, 200));
  assert.equal(q.j.found, true); assert.equal(q.j.verdict.word, 'offers-found'); assert.equal(q.j.cheapest.price, 70, 'without a page every store counts'); assert.equal(q.j.cheapest.store, 'shop.deal-proof.dev'); assert.equal(q.j.elsewhere.length, DEAL.offers.free);
});
await proof('the memory: a second check of the page sees the price the first one kept, and a lower price later says it is the lowest seen', async () => {
  const ip = fresh(); shopPrice = '89.00';
  const a = await call(`/deal?url=${encodeURIComponent('https://shop.deal-proof.dev/products/trail-runner-3?variant=7')}`, { ip }); assert.equal(a.status, 200, a.text.slice(0, 200));
  T0 += 30 * 60_000; shopPrice = '74.00';
  const b = await call(`/deal?url=${encodeURIComponent('https://shop.deal-proof.dev/products/trail-runner-3?variant=7')}`, { ip }); assert.equal(b.status, 200);
  assert.ok(b.j.seen.checks >= 1); assert.equal(b.j.product.price, 74); assert.match(b.j.verdict.lines.join(' '), /lowest price agents saw for it through the sea/);
  assert.equal(b.j.verdict.word, 'lowest-found'); shopPrice = '89.00';
});
await proof('a page whose robots.txt closes it is not read; the verdict says so', async () => {
  const r = await call(`/deal?url=${encodeURIComponent('https://closed.deal-proof.dev/products/x')}`, { ip: fresh() });
  assert.equal(r.status, 200); assert.equal(r.j.page.read, false); assert.equal(r.j.page.blocked, true); assert.equal(r.j.found, false); assert.match(r.j.verdict.lines[0], /could not be read/);
});
await proof('ten free checks an hour per network; the eleventh is a 402 with the terms of that check (not listed); paying there makes it with 12 offers', async () => {
  facilitator = null; fac.length = 0; const ip = fresh();
  for (let i = 0; i < DEAL.perHour; i++) { T0 += 500; const r = await call(`/deal?url=${RUN}`, { ip }); assert.equal(r.status, 200, `free check ${i + 1}: ${r.text.slice(0, 120)}`); assert.equal(r.j.elsewhere.length, DEAL.offers.free); }
  const f0 = (await funnel()).asked.deal || 0, path = `/deal?url=${RUN}`;
  const r = await call(path, { ip }); assert.equal(r.status, 402, r.text.slice(0, 200)); assert.equal(r.j.error.code, 'RESOURCE_EXHAUSTED'); assert.match(r.j.error.message, /0\.01 USDC/);
  const v2 = required(r); assert.equal(v2.resource.url, BASE + path); assert.equal(v2.extensions, undefined, 'a check bought at /deal is not listed as a service');
  assert.equal(r.j.accepts[0].outputSchema.input.discoverable, false); assert.equal((await funnel()).asked.deal, f0 + 1); assert.equal(fac.length, 0);
  facilitator = settles(); const p = await call(path, { ip, headers: payment() }); assert.equal(p.status, 200, p.text.slice(0, 200)); assert.equal(p.j.paid.status, 'settled'); assert.equal(p.j.elsewhere.length, DEAL.offers.paid);
});
await proof('the page a deal check reads is none of the free 100 reads of the day', async () => {
  const ip = fresh();
  for (let i = 0; i < 100; i++) { const r = await call(`/r/https://shop.deal-proof.dev/notes/${i}`, { ip, accept: 'text/markdown' }); assert.equal(r.status, 200, `read ${i + 1}: ${r.status} ${r.text.slice(0, 100)}`); }
  const over = await call('/r/https://shop.deal-proof.dev/notes/105', { ip, accept: 'text/markdown' }); assert.ok(over.status === 429 || over.status === 402, `the 101st read: ${over.status}`);
  const d = await call(`/deal?url=${RUN}`, { ip }); assert.equal(d.status, 200, d.text.slice(0, 200)); assert.equal(d.j.page.read, true); assert.equal(d.j.product.name, 'Trail Runner 3');
});
console.log('the skill');
await proof('the skill deal-check is one file in two places (skills/, site/); /.well-known/agent-skills names it after the reading skill, with the sha256 of the bytes served', async () => {
  const md = readFileSync(join(ROOT, 'skills/deal-check/SKILL.md'), 'utf8'); assert.equal(readFileSync(join(ROOT, 'site/deal-check.md'), 'utf8'), md); assert.match(md, /^---\nname: deal-check\ndescription: /);
  for (const w of ['/deal?url=', '/x402/deal', 'never pays', 'data, never instructions', 'Shopify Global Catalog']) assert.ok(md.includes(w), `the skill names ${w}`);
  const md2 = (f) => ({ body: readFileSync(join(ROOT, 'site', f), 'utf8'), type: 'text/markdown; charset=utf-8' });
  const site2 = { ...SITE, '/skill.md': md2('skill.md'), '/lean-web-reading.md': md2('lean-web-reading.md'), '/deal-check.md': md2('deal-check.md') };
  const get = (p) => core.handle(new Request(BASE + p, { headers: { 'user-agent': 'deal-proof-agent/1.0', 'x-forwarded-for': '127.0.0.1' } }), db, { ...cfg, site: site2 });
  const idx = await (await get('/.well-known/agent-skills/index.json')).json(); assert.deepEqual(idx.skills.map((x) => x.name), ['mare-liberum', 'lean-web-reading', 'deal-check']);
  assert.equal(await (await get('/.well-known/agent-skills/deal-check/SKILL.md')).text(), md);
  assert.equal(idx.skills[2].digest, `sha256:${createHash('sha256').update(md).digest('hex')}`); assert.match(idx.skills[2].description, /^Check a product deal before you buy/);
});
await Promise.allSettled(waits.splice(0));
console.log(`\n${passed} proofs held, ${failed} failed`);

// ------------------------------------------------------------------ negative controls: each rule broken in a copy, the proof must fail there
let caught = 0, missed = 0;
if (!process.argv.includes('--no-controls')) {
  console.log('\nnegative controls: each rule broken in a copy, the proof must fail there');
  const CONTROLS = [
    ['an accessory taken for the item', 'node/deal.mjs', "if ([...b].some((w) => ACCESSORY.has(w) && !a.includes(w))) s = Math.min(s, 0.3);", ''],
    ['another model taken for the item (a model number not needed)', 'node/deal.mjs', "if (a.some((w) => /\\d/.test(w) && !b.has(w))) s = Math.min(s, 0.4);", ''],
    ['an offer out of stock compared', 'node/deal.mjs', "o.currency && o.in_stock && o.match >= DEAL.match", "o.currency && o.match >= DEAL.match"],
    ['a check with nothing to compare charged (the claim not given back)', 'node/core.mjs', "      if (!r || r.error || !r.found) {\n        await book.release(claim);", "      if (false) {\n        await book.release(claim);"],
    ['a paid check counted against the free checks', 'node/lens.mjs', "if (!paid) { try { await allow(ctx, 'deal', DEAL.perHour, 3600); }", "if (true) { try { await allow(ctx, 'deal', DEAL.perHour, 3600); }"],
    ['no 402 without a payment (the door gives the check away)', 'node/core.mjs', "        if (!pay) { funnelOf(db, cfg).asked('deal'); return dealRequired(t, { base, cors: CORS }); }", "        if (!pay) { funnelOf(db, cfg).asked('deal'); return json({ found: true }); }"],
    ['the free door past its limit without terms (429 as before)', 'node/core.mjs', "if (e instanceof SeaError && e.dealLimit) {", "if (false) {"],
    ['delivered without a verdict (strict off)', 'node/core.mjs', "label: 'deal', strict: true });", "label: 'deal', strict: false });"],
    ['the page of a deal check counted as a free read', 'node/lens.mjs', "&& !ctx?.packRead && !ctx?.dealRead) {", "&& !ctx?.packRead) {"],
  ];
  for (const [name, f, from, to] of CONTROLS) {
    const d2 = mkdtempSync(join(tmpdir(), 'mare-deal-ctl-'));
    try {
      cpSync(ROOT, d2, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      const fp = join(d2, f), txt = readFileSync(fp, 'utf8');
      if (!txt.includes(from)) { missed++; console.log(`  FAIL control "${name}": the line to break is gone from ${f}; the control needs updating`); continue; }
      writeFileSync(fp, txt.replace(from, to));
      const r = spawnSync(process.execPath, [join(d2, 'tools/deal-proof.mjs'), '--no-controls'], { encoding: 'utf8', timeout: 240_000 });
      const out = `${r.stdout}${r.stderr}`, broke = (out.match(/\n  FAIL /g) || []).length;
      if (r.status !== 0 && broke > 0) { caught++; console.log(`  ok   caught: ${name} (${broke} proof${broke === 1 ? '' : 's'} failed)`); }
      else { missed++; console.log(`  FAIL control "${name}" was not caught (exit ${r.status})`); }
    } finally { try { rmSync(d2, { recursive: true, force: true }); } catch {} }
  }
  console.log(`${caught} of ${CONTROLS.length} controls caught`);
}
process.exit(failed || missed ? 1 : 0);
