// Mare Liberum · proof of the open price record (3.65, node/seen.mjs, "Der Preisbeleg"): every deal check of a product page
// leaves a record of what it saw at its own permanent address, which an agent can hand to its person as the source of a price.
// It proves, with the same shops, catalog, DNS and facilitator as the deal check's proof (no network):
//   made     a free deal check of a product page answers with its record (id, page, JSON, SHA-256) and names it as a next step
//            right after checking the store; a check by words alone and a page without a product leave no record
//   page     /seen/<id> shows the product, the store, the price, the verdict and the same item elsewhere, with its canonical
//            address and schema.org data; /seen/<id>.json is the record, whose SHA-256 is that of its canonical JSON; the record
//            keeps the page's address without its campaign or session query, and nothing of who asked
//   fixed    the same look on the same day is the same record, unchanged; a new price is a new record; /seen lists the newest first
//   index    a record that compares fewer than 3 prices says noindex (header and page); the addresses open to search engines
//            are only those of records that compare 3 or more; an unknown or malformed record is a 404
//   sitemap  (3.66) /sitemaps/seen.xml names exactly those records, each dated by its day, and the sitemap index names it
//   words    (3.67) the verdict stands where AI answers quote a page: in the title, in the heading and in the first sentence
//            after it, as plain HTML, within the first 200 characters from the heading on; the links back to the sea stand
//            after the record; /seen says in its heading how many of the newest were cheaper elsewhere, and its newest first
//   quote    (3.73) /seen/quote and /seen/quote.json count the newest records: of the pages compared with other stores how many
//            were cheaper elsewhere (in the heading and the first sentence), the median saving at the lowest other offer without
//            a caution, how many pages state a list price of their own, apart for agents' checks and the sea's own sample; a line
//            kept before 3.73 is counted from its record; noindex until 10 pages were compared; /seen, llms.txt and IndexNow name it
//   indexed  (3.73) /sitemaps/seen.xml names every record open to search engines that is still kept, from a list of its own,
//            also once it left the newest of /seen, and none older than the records are kept
// Negative controls at the end: each rule broken in a copy of the code, and this proof must fail there.
// Runs without the network: node tools/seen-proof.mjs   (exit code 1 when a proof fails or a control is not caught)
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
process.env.MARE_VIA_SECRET = 'seen-proof-via-key, a test value';
let passed = 0, failed = 0;
const D = globalThis.Date; let T0 = D.parse('2026-11-27T09:00:00.000Z');
class Clock extends D { constructor(...a) { if (a.length) super(...a); else super(T0); } static now() { return T0; } }
globalThis.Date = Clock;
const proof = async (name, fn) => { T0 += 60_000; try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 6).join('\n       ')}`); } };
const imp = (f) => import(pathToFileURL(join(ROOT, 'node', f)).href);
const { DEAL } = await imp('deal.mjs');
const { SEEN, canonical, canonOf, savingOf } = await imp('seen.mjs');

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
const dir = mkdtempSync(join(tmpdir(), 'mare-seen-')), file = join(dir, 'sea.tsv');
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


const RUN_UTM = encodeURIComponent('https://shop.deal-proof.dev/products/trail-runner-3?utm_source=mail&session=abc123');
const sha = (s) => createHash('sha256').update(s).digest('hex');
console.log('made');
let first = null;
await proof('a free deal check of a product page answers with its open record (id, page, JSON, SHA-256), named right after checking the store', async () => {
  const r = await call(`/deal?url=${RUN_UTM}`, { ip: fresh() }); assert.equal(r.status, 200, r.text.slice(0, 300));
  const rec = r.j.record; assert.ok(rec, 'the answer carries its record'); assert.match(rec.id, /^[0-9a-f]{16}$/);
  assert.equal(rec.url, `${BASE}${SEEN.path}/${rec.id}`); assert.equal(rec.json, `${rec.url}.json`); assert.match(rec.sha256, /^[0-9a-f]{64}$/);
  const i = r.j.next.findIndex((x) => x.do === 'show your person the open record'); assert.ok(i >= 0, 'named as a next step'); assert.equal(r.j.next[i].at, rec.url);
  assert.equal(r.j.next[i - 1]?.do, 'check the store before paying', 'right after checking the store');
  first = rec;
});
await proof('a check by words alone and a page without a product leave no record', async () => {
  const q = await call('/deal?q=Trail+Runner+3&currency=USD', { ip: fresh() }); assert.equal(q.status, 200); assert.equal(q.j.record, undefined, 'no record for words someone typed');
  const about = await call(`/deal?url=${encodeURIComponent('https://shop.deal-proof.dev/about')}`, { ip: fresh() }); assert.equal(about.status, 200); assert.equal(about.j.record, undefined, 'no record without a product');
});
console.log('page');
await proof('/seen/<id> shows the product, the store, the price, the verdict and the same item elsewhere, with its canonical address and schema.org data; open to search engines', async () => {
  const r = await call(`${SEEN.path}/${first.id}`, { ip: fresh(), accept: 'text/html' }); assert.equal(r.status, 200); assert.match(r.h['content-type'], /^text\/html/);
  for (const s of ['Trail Runner 3', 'shop.deal-proof.dev', '89 USD', 'Another Shop', 'What the deal check found', `<link rel="canonical" href="${BASE}${SEEN.path}/${first.id}">`, '"@type":"Product"', 'no endorsement of any store']) assert.ok(r.text.includes(s), s);
  assert.ok(!/noindex/.test(r.text) && !r.h['x-robots-tag'], 'a record that compares 3 or more prices is open to search engines');
  // (3.92) kept a day; an hour while the call that adds this page to the weekend balance stands on it (node/recordnext.mjs)
  assert.match(r.h['cache-control'], r.text.includes('/seen/bfcm-2026?add=') ? /max-age=3600/ : /max-age=86400/);
});
await proof('/seen/<id>.json is the record: its SHA-256 is that of its canonical JSON; the page address without campaign or session; nothing of who asked', async () => {
  const r = await call(`${SEEN.path}/${first.id}.json`, { ip: fresh() }); assert.equal(r.status, 200);
  const { sha256, ...rest } = r.j; assert.equal(sha256, first.sha256); assert.equal(sha(canonical(rest)), sha256, 'the hash of the canonical JSON');
  assert.equal(r.j.product.url, 'https://shop.deal-proof.dev/products/trail-runner-3', 'no campaign or session query');
  assert.equal(r.j.store, 'shop.deal-proof.dev'); assert.equal(r.j.product.price, 89); assert.equal(r.j.verdict.word, 'cheaper-elsewhere'); assert.ok(r.j.elsewhere.length >= 2);
  const text = JSON.stringify(r.j); for (const w of ['198.51.100.', 'x-forwarded-for', 'caller', 'utm_source', 'abc123', '"ip"']) assert.ok(!text.includes(w), `the record keeps nothing of who asked: ${w}`);
  assert.equal(canonOf('https://Shop.example/p/x?variant=42&utm=1#top'), 'https://shop.example/p/x?variant=42'); assert.equal(canonOf('https://u:p@shop.example/p'), null);
});
console.log('fixed');
await proof('the same look on the same day is the same record, unchanged; a new price is a new record; /seen lists the newest first', async () => {
  const again = await call(`/deal?url=${RUN}`, { ip: fresh() }); assert.equal(again.j.record.id, first.id, 'the same record');
  const kept = await call(`${SEEN.path}/${first.id}.json`, { ip: fresh() }); assert.equal(kept.j.sha256, first.sha256, 'unchanged'); 
  shopPrice = '84.00';
  const moved = await call(`/deal?url=${RUN}`, { ip: fresh() }); shopPrice = '89.00';
  assert.notEqual(moved.j.record.id, first.id, 'a new price is a new record');
  const list = await call(`${SEEN.path}.json`, { ip: fresh() }); assert.equal(list.status, 200);
  assert.deepEqual(list.j.records.slice(0, 2).map((x) => x.id), [moved.j.record.id, first.id], 'newest first');
  assert.equal(list.j.records[0].price, 84); assert.equal(list.j.records[0].url, `${BASE}${SEEN.path}/${moved.j.record.id}`);
  const page = await call(SEEN.path, { ip: fresh(), accept: 'text/html' }); assert.equal(page.status, 200); assert.ok(page.text.includes(`${SEEN.path}/${moved.j.record.id}`) && page.text.includes('Price records'));
});
console.log('index');
let thin = null;
await proof('a record that compares fewer than 3 prices says noindex (header and page); unknown or malformed records are a 404', async () => {
  const r = await call(`/deal?url=${encodeURIComponent('https://shop.deal-proof.dev/products/pricey')}`, { ip: fresh() }); assert.equal(r.status, 200); assert.ok(r.j.record, 'a page with its price leaves a record'); thin = r.j.record;
  const p = await call(`${SEEN.path}/${thin.id}`, { ip: fresh(), accept: 'text/html' }); assert.equal(p.status, 200);
  assert.equal(p.h['x-robots-tag'], 'noindex'); assert.ok(p.text.includes('<meta name="robots" content="noindex,follow">'));
  const j = await call(`${SEEN.path}/${thin.id}.json`, { ip: fresh() }); assert.equal(j.j.indexable, false);
  for (const bad of [`${SEEN.path}/0000000000000000`, `${SEEN.path}/0000000000000000.json`, `${SEEN.path}/xyz`, `${SEEN.path}/${first.id}x`]) assert.equal((await call(bad, { ip: fresh() })).status, 404, bad);
});
await proof('the addresses open to search engines are those of records that compare 3 or more prices; /seen and llms.txt name the records', async () => {
  const listed = await db.flow.seenListed(); assert.ok(listed.includes(`${SEEN.path}/${first.id}`)); assert.ok(!listed.includes(`${SEEN.path}/${thin.id}`), 'no thin record');
  const llms = readFileSync(join(ROOT, 'site/llms.txt'), 'utf8'); assert.ok(llms.includes('https://mareliberum.dev/seen') && llms.includes('open price record'));
  for (const f of ['skills/deal-check/SKILL.md', 'site/deal-check.md']) assert.ok(readFileSync(join(ROOT, f), 'utf8').includes('`record`'), f);
});
console.log('sitemap');
await proof('/sitemaps/seen.xml lists only the records that compare 3 or more prices, dated by their day; the sitemap index names it with that day', async () => {
  const r = await call('/sitemaps/seen.xml', { ip: fresh(), accept: 'application/xml' }); assert.equal(r.status, 200); assert.match(r.h['content-type'], /^application\/xml/);
  const locs = [...r.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.ok(locs.includes(`${BASE}${SEEN.path}/${first.id}`), 'a record of 3 or more prices is named');
  assert.ok(!locs.includes(`${BASE}${SEEN.path}/${thin.id}`), 'a record that says noindex is not named');
  for (const l of locs) assert.match(l, new RegExp(`^${BASE}${SEEN.path}/[0-9a-f]{16}$`), l);
  assert.deepEqual(locs.map((l) => l.slice(-16)), (await db.flow.seenListed()).map((x) => x.slice(-16)), 'the same records the engines hear of, newest first');
  assert.deepEqual(locs.map((l) => l.slice(-16)), (await db.flow.seenIndexed()).map((x) => x.id), 'the list of its own');
  assert.ok(r.text.includes(`<lastmod>${new Date(T0).toISOString().slice(0, 10)}</lastmod>`), 'dated by the day it was seen');
  const idx = await call('/sitemap.xml', { ip: fresh(), accept: 'application/xml' }); assert.equal(idx.status, 200);
  assert.ok(idx.text.includes(`<sitemap><loc>${BASE}/sitemaps/seen.xml</loc><lastmod>${new Date(T0).toISOString().slice(0, 10)}</lastmod></sitemap>`), 'the index names it with its day');
  assert.ok(readFileSync(join(ROOT, 'site/llms.txt'), 'utf8').includes('https://mareliberum.dev/sitemaps/seen.xml'), 'llms.txt names it');
});
console.log('words');
// the text a reader without scripts sees from the heading on, tags removed and spaces folded, as AI answers quote it
const fromH1 = (html, n = 200) => { const i = html.indexOf('<h1'); assert.ok(i >= 0, 'a heading'); return html.slice(i).replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim().slice(0, n); };
await proof('a record says its verdict in its title, its heading and the first sentence after it: store, price, verdict, how many prices and the lowest, within 200 characters', async () => {
  const r = await call(`${SEEN.path}/${first.id}`, { ip: fresh(), accept: 'text/html' }); assert.equal(r.status, 200);
  const title = /<title>([^<]*)<\/title>/.exec(r.text)?.[1] || ''; assert.ok(title.includes('cheaper elsewhere') && title.includes('89 USD'), title);
  const h1 = /<h1>([^<]*)<\/h1>/.exec(r.text)?.[1] || ''; assert.equal(h1, 'Trail Runner 3 at shop.deal-proof.dev: 89 USD, cheaper elsewhere');
  const words = fromH1(r.text);
  for (const s of ['cheaper elsewhere', 'prices checked on', 'the lowest is 79.95 USD at Another Shop', '10.2 % below this page']) assert.ok(words.includes(s), `${s} in the first 200 characters: ${words}`);
  assert.ok(/<\/h1>\s*<p class="lead">\d+ prices checked on /.test(r.text), 'the first sentence right after the heading');
  const nav = r.text.indexOf('<a href="/">Mare Liberum</a>'); assert.ok(nav > r.text.indexOf('What the deal check found'), 'the links back to the sea after the record');
  // what stands before the heading in the source (the skip link, the name of the sea, the button of the dive plan, the depth)
  // is shorter than the verdict; the dive plan itself stands after the page
  const pre = r.text.slice(r.text.indexOf('<body'), r.text.indexOf('<h1')).replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  assert.ok(pre.length < h1.length, `before the heading only ${pre.length} characters, fewer than the verdict's ${h1.length}: ${pre.slice(0, 300)}`);
  assert.ok(r.text.indexOf('id="plan"') > r.text.indexOf('</main>'), 'the dive plan after the page');
});
await proof('a record without other offers says so in its heading and first sentence; its own list price follows', async () => {
  const r = await call(`${SEEN.path}/${thin.id}`, { ip: fresh(), accept: 'text/html' }); assert.equal(r.status, 200);
  const words = fromH1(r.text); assert.ok(words.startsWith('Summit Jacket 2 at shop.deal-proof.dev: 199 USD, no other offer found'), words);
  assert.ok(words.includes('no matching offer in stock at another Shopify store'), words);
  const f = await call(`${SEEN.path}/${first.id}`, { ip: fresh(), accept: 'text/html' }); assert.ok(fromH1(f.text, 400).includes('Its own list price: 129 USD.'), 'the list price the page states');
});
await proof('/seen says in its heading how many of the newest records were cheaper elsewhere, and names the newest in its first sentence', async () => {
  const list = (await call(`${SEEN.path}.json`, { ip: fresh() })).j.records, cheaper = list.filter((x) => x.word === 'cheaper-elsewhere').length;
  const r = await call(SEEN.path, { ip: fresh(), accept: 'text/html' }); assert.equal(r.status, 200);
  const words = fromH1(r.text, 260);
  assert.ok(words.startsWith(`Open price records: ${cheaper} of ${list.length} checked product pages cheaper elsewhere`), words);
  assert.ok(words.includes(`The newest, seen`) && words.includes(`${list[0].name} at ${list[0].store}`), words);
  assert.ok(r.text.indexOf('<a href="/">Mare Liberum</a>') > r.text.indexOf('<h1'), 'the links back to the sea after the heading');
});
console.log('quote');
// the quote as this proof counts it, from the records themselves (their JSON), never from the code under proof
const expectQuote = async () => {
  const ids = (await call(`${SEEN.path}.json`, { ip: fresh() })).j.records.map((x) => x.id), recs = [];
  for (const id of ids) recs.push((await call(`${SEEN.path}/${id}.json`, { ip: fresh() })).j);
  const tally = (xs) => {
    const cmp = xs.filter((r) => r.verdict.word === 'cheaper-elsewhere' || r.verdict.word === 'lowest-found'), ch = xs.filter((r) => r.verdict.word === 'cheaper-elsewhere');
    const saves = ch.map((r) => r.elsewhere.find((o) => !o.caution && Number.isFinite(o.below_page_pct))?.below_page_pct).filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
    const med = saves.length ? Math.round((saves.length % 2 ? saves[saves.length >> 1] : (saves[saves.length / 2 - 1] + saves[saves.length / 2]) / 2) * 10) / 10 : null;
    return { records: xs.length, compared: cmp.length, cheaper_elsewhere: ch.length, median_saving_pct: med, list_price_stated: xs.filter((r) => Number.isFinite(r.product.list_price) && r.product.list_price > r.product.price).length };
  };
  return { of: recs.length, all: tally(recs), agent: tally(recs.filter((r) => r.by !== 'sea')), sea: tally(recs.filter((r) => r.by === 'sea')) };
};
const pick = (t) => ({ records: t.records, compared: t.compared, cheaper_elsewhere: t.cheaper_elsewhere, median_saving_pct: t.median_saving_pct, list_price_stated: t.list_price_stated });
await proof('the saving of a record is the lowest other offer without a caution; an offer flagged as far below the others never makes it', async () => {
  assert.equal(savingOf({ verdict: { word: 'cheaper-elsewhere' }, elsewhere: [{ caution: 'far below the median', below_page_pct: 40 }, { below_page_pct: 5.5 }] }), 5.5);
  assert.equal(savingOf({ verdict: { word: 'cheaper-elsewhere' }, elsewhere: [{ caution: 'far below the median', below_page_pct: 40 }] }), null);
  assert.equal(savingOf({ verdict: { word: 'lowest-found' }, elsewhere: [{ below_page_pct: -3 }] }), null);
});
let seaRec = null;
await proof('/seen/quote.json counts the newest records: pages compared, cheaper elsewhere, median saving, list prices, apart for agents and the sea', async () => {
  shopPrice = '86.00'; const sea = await db.flow.deal({ url: 'https://shop.deal-proof.dev/products/trail-runner-3', base: BASE }, { ip: 'sea-book', who: 'the sea', whoKind: 'sea', book: true }); shopPrice = '89.00';
  assert.ok(sea?.record?.id, 'the sea\'s own check left a record'); seaRec = sea.record;
  assert.equal((await call(`${SEEN.path}/${seaRec.id}.json`, { ip: fresh() })).j.by, 'sea');
  const want = await expectQuote(), r = await call(`${SEEN.path}/quote.json`, { ip: fresh() }); assert.equal(r.status, 200, r.text.slice(0, 200));
  assert.equal(r.j.of, want.of); assert.deepEqual(pick(r.j.all), want.all); assert.deepEqual(pick(r.j.by.agent), want.agent); assert.deepEqual(pick(r.j.by.sea), want.sea);
  assert.ok(want.sea.records === 1 && want.agent.records >= 3 && want.all.compared < want.all.records, 'a sea record, agents\' records and one not compared');
  assert.ok(Number.isFinite(want.all.median_saving_pct) && want.all.list_price_stated >= 1, 'a saving and a list price to count');
  assert.equal(r.j.all.cheaper_share_pct, Math.round((want.all.cheaper_elsewhere / want.all.compared) * 1000) / 10, 'the share of the pages compared');
  assert.equal(r.j.page, `${BASE}${SEEN.path}/quote`); assert.equal(r.j.records, `${BASE}${SEEN.path}.json`);
  const text = JSON.stringify(r.j); for (const w of ['198.51.100.', 'sea-book', '"ip"']) assert.ok(!text.includes(w), `nothing of who asked: ${w}`);
});
await proof('/seen/quote says the share in its heading and the median saving and the list prices in the first sentence; noindex while fewer than 10 pages were compared', async () => {
  const q = (await call(`${SEEN.path}/quote.json`, { ip: fresh() })).j, a = q.all, r = await call(`${SEEN.path}/quote`, { ip: fresh(), accept: 'text/html' }); assert.equal(r.status, 200); assert.match(r.h['content-type'], /^text\/html/);
  const h1 = /<h1>([^<]*)<\/h1>/.exec(r.text)?.[1] || ''; assert.equal(h1, `How often a product page was not the lowest price: ${a.cheaper_elsewhere} of ${a.compared} (${a.cheaper_share_pct} %) cheaper elsewhere`);
  const words = fromH1(r.text, 420);
  for (const s of [`Of the newest ${q.of} open price records`, `${a.compared} compared the page with other stores and ${a.cheaper_elsewhere} found it cheaper elsewhere`, `median saving at the lowest other store without a caution was ${a.median_saving_pct} %`, `${a.list_price_stated} of ${q.of} pages stated a list price`]) assert.ok(words.includes(s), `${s}: ${words}`);
  assert.ok(r.text.includes('the sea&#39;s daily sample') && r.text.includes(`<link rel="canonical" href="${BASE}${SEEN.path}/quote">`), 'the sample apart, the canonical address');
  assert.ok(a.compared < SEEN.quoteMin); assert.equal(q.indexable, false); assert.equal(r.h['x-robots-tag'], 'noindex'); assert.ok(r.text.includes('<meta name="robots" content="noindex,follow">'));
});
await proof('a line kept before 3.73 (without saving or list price) is counted from its record, the same as a new line', async () => {
  const before = (await call(`${SEEN.path}/quote.json`, { ip: fresh() })).j, lines = await kv.get('seen:recent');
  await kv.set('seen:recent', lines.map(({ save, lp, ...old }) => old), 3600);
  try { const after = (await call(`${SEEN.path}/quote.json`, { ip: fresh() })).j; assert.deepEqual(after.all, before.all); assert.deepEqual(after.by, before.by); }
  finally { await kv.set('seen:recent', lines, 3600); }
});
await proof('with 10 or more pages compared the quote is open to search engines; /seen, llms.txt and IndexNow name it', async () => {
  for (let i = 0; i < 10; i++) { shopPrice = `${70 + i}.50`; const r = await call(`/deal?url=${RUN}`, { ip: fresh() }); assert.ok(r.j.record, `record ${i}`); }
  shopPrice = '89.00';
  const q = (await call(`${SEEN.path}/quote.json`, { ip: fresh() })).j; assert.ok(q.all.compared >= SEEN.quoteMin); assert.equal(q.indexable, true);
  const want = await expectQuote(); assert.deepEqual(pick(q.all), want.all, 'still the records\' own count');
  const r = await call(`${SEEN.path}/quote`, { ip: fresh(), accept: 'text/html' }); assert.ok(!r.h['x-robots-tag'] && !/noindex/.test(r.text), 'open to search engines');
  assert.ok((await call(SEEN.path, { ip: fresh(), accept: 'text/html' })).text.includes(`<a href="${SEEN.path}/quote">`), '/seen links the quote');
  assert.ok(readFileSync(join(ROOT, 'site/llms.txt'), 'utf8').includes('https://mareliberum.dev/seen/quote'), 'llms.txt names it');
  assert.ok(/'\/seen', '\/seen\/quote'\];/.test(readFileSync(join(ROOT, 'node/core.mjs'), 'utf8')), 'among the lists IndexNow hears of');
  assert.equal((await call(`${SEEN.path}/quote`, { ip: fresh(), method: 'POST', body: {} })).status, 405);
});
console.log('indexed');
await proof('/sitemaps/seen.xml names every record open to search engines that is still kept, also once it left the newest of /seen; none older than the records are kept', async () => {
  const lines = await kv.get('seen:recent'), ix = await kv.get('seen:ix');
  await kv.set('seen:recent', [], 3600);
  await kv.set('seen:ix', [...ix, { id: 'abcdefabcdefabcd', at: new Date(T0 - (SEEN.keepDays + 1) * 86_400_000).toISOString(), ix: true }], 3600);
  try {
    const r = await call('/sitemaps/seen.xml', { ip: fresh(), accept: 'application/xml' }), locs = [...r.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].slice(-16));
    assert.ok(locs.includes(first.id), 'a record no more among the newest of /seen is still named');
    assert.ok(!locs.includes(thin.id), 'never a record that says noindex');
    assert.ok(!locs.includes('abcdefabcdefabcd'), 'never one older than the records are kept');
    assert.equal(new Set(locs).size, locs.length, 'each once');
  } finally { await kv.set('seen:recent', lines, 3600); await kv.set('seen:ix', ix, 3600); }
});
await Promise.allSettled(waits.splice(0));
console.log(`\n${passed} proofs held, ${failed} failed`);

// ------------------------------------------------------------------ negative controls: each rule broken in a copy, the proof must fail there
let caught = 0, missed = 0;
if (!process.argv.includes('--no-controls')) {
  console.log('\nnegative controls: each rule broken in a copy, the proof must fail there');
  const CONTROLS = [
    ['a record changed by a later look', 'node/lens.mjs', "const had = await kv.get(k).catch(() => null); if (had?.id) return recordRef(had, had.sha256);", "const had = null;"],
    ['a record of fewer than 3 prices open to search engines', 'node/seen.mjs', 'indexable: n >= SEEN.index,', 'indexable: true,'],
    ['the hash taken of the JSON as written, not of its canonical form', 'node/lens.mjs', 'sha256 = await sha(canonical(rec))', 'sha256 = await sha(JSON.stringify(rec))'],
    ['the page address kept with its campaign and session', 'node/seen.mjs', "${/^\\d{1,20}$/.test(v || '') ? `?variant=${v}` : ''}`.slice(0, 600);", "${x.search}`.slice(0, 600);"],
    ['a record that says noindex put on the list of seen.xml', 'node/lens.mjs', 'if (rec.indexable) { const ix =', 'if (true) { const ix ='],
    ['a record that says noindex taken from the newest of /seen into seen.xml', 'node/lens.mjs', '...(await lens.seenRecent()).filter((x) => x?.ix)]', '...(await lens.seenRecent())]'],
    ['seen.xml left out of the sitemap index', 'node/core.mjs', "maps = ['hubs', 'seen', 'site',", "maps = ['hubs', 'site',"],
    ['the heading of a record only the product name again', 'node/seen.mjs', '<body><main><h1>${esc(recordHeadline(rec))}</h1>', '<body><main><h1>${esc(name)}</h1>'],
    ['the first sentence of a record left out', 'node/seen.mjs', '<p class="lead">${esc(lead)}</p>\n<p class="box">', '<p class="box">'],
    ['the links back to the sea before the heading', 'node/seen.mjs', '<body><main><h1>${esc(recordHeadline(rec))}</h1>', '<body><main>${NAV()}<h1>${esc(recordHeadline(rec))}</h1>'],
    ['the dive plan back before the heading of a record', 'node/skin.mjs', 'const PLAN_LATE = /^\\/(?:seen|buy)(?:\\/|$)/;', 'const PLAN_LATE = /^$/;'],
    ['/seen without its count in the heading', 'node/seen.mjs', "const H = xs.length ? `Open price records: ${cheaper} of", "const H = !xs.length ? `Open price records: ${cheaper} of"],
    ['the saving taken from an offer flagged as far below the others', 'node/seen.mjs', 'find((x) => !x?.caution && Number.isFinite(x?.below_page_pct))', 'find((x) => Number.isFinite(x?.below_page_pct))'],
    ['the share of all records, not of the pages compared', 'node/seen.mjs', 'cheaper_share_pct: pct(cheaper.length, compared.length)', 'cheaper_share_pct: pct(cheaper.length, xs.length)'],
    ['the sea\'s own records counted as agents\' checks', 'node/seen.mjs', "agent: tallyOf(xs.filter((x) => x.by !== 'sea'))", 'agent: tallyOf(xs)'],
    ['a line kept before 3.73 counted without its record', 'node/lens.mjs', "if ('lp' in x) { out.push(x); continue; }", 'out.push(x); continue;'],
    ['the quote open to search engines with fewer than 10 pages compared', 'node/seen.mjs', 'indexable: q.all.compared >= SEEN.quoteMin,', 'indexable: true,'],
    ['the quote without its first sentence', 'node/seen.mjs', '<body><main><h1>${esc(H)}</h1>\n<p class="lead">${esc(lead)}</p>\n<table>', '<body><main><h1>${esc(H)}</h1>\n<table>'],
    ['seen.xml only from the newest of /seen again', 'node/core.mjs', 'recordsSitemap((await (sea.seenIndexed || sea.seenRecent)?.()', 'recordsSitemap((await (sea.seenRecent)?.()'],
    ['records older than they are kept left in seen.xml', 'node/lens.mjs', "&& String(x.at || '') >= since &&", '&&'],
    ['the record not named among the next steps', 'node/lens.mjs', "ans.next.splice(at + 1, 0, { do: 'show your person the open record'", "ans.next.splice(at + 1, 0, { do: 'see the record'"],
  ];
  for (const [name, f, from, to] of CONTROLS) {
    const d2 = mkdtempSync(join(tmpdir(), 'mare-seen-ctl-'));
    try {
      cpSync(ROOT, d2, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      const fp = join(d2, f), txt = readFileSync(fp, 'utf8');
      if (!txt.includes(from)) { missed++; console.log(`  FAIL control "${name}": the line to break is gone from ${f}; the control needs updating`); continue; }
      writeFileSync(fp, txt.replace(from, to));
      const r = spawnSync(process.execPath, [join(d2, 'tools/seen-proof.mjs'), '--no-controls'], { encoding: 'utf8', timeout: 240_000 });
      const out = `${r.stdout}${r.stderr}`, broke = (out.match(/\n  FAIL /g) || []).length;
      if (r.status !== 0 && broke > 0) { caught++; console.log(`  ok   caught: ${name} (${broke} proof${broke === 1 ? '' : 's'} failed)`); }
      else { missed++; console.log(`  FAIL control "${name}" was not caught (exit ${r.status})`); }
    } finally { try { rmSync(d2, { recursive: true, force: true }); } catch {} }
  }
  console.log(`${caught} of ${CONTROLS.length} controls caught`);
}
process.exit(failed || missed ? 1 : 0);
