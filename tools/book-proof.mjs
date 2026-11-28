// Mare Liberum · proof of the record book (3.72, node/book.mjs, "Das Belegbuch"): the sea checks product pages on its own every
// day, so the open price records are many and dated, and the same watched pages are seen again day after day.
// It proves, with the same shops, catalog and DNS as the proof of the open price record (no network):
//   pages    the book visits only a store's own product page over https (a numeric variant kept, a campaign dropped), never a
//            checkout or cart, never a page that is no product page, never an Amazon page
//   order    a watched page not visited today goes first, then a new page from the current's picks; a page visited today and a
//            store visited within the hour wait; no visit past 40 a day
//   watch    a new page that gave a record joins the watch while there is room (20); a watched page that gives none leaves it;
//            the series of a page holds one price a day, oldest first
//   tide     POST /tide makes one visit after the current moved: its record says by: "sea" with the sentence of the book, on its
//            page and in /seen; /seen and /seen.json show the day's visits, records and watch
//   counted  a visit is no deal check of the day, no read of the day and no look in the memory of what agents saw: an agent's
//            check of the same page right after says nobody saw it before
//   pace     the same store is not visited again within the hour; the next day the watched page is visited first and the page's
//            series holds both days; a day with 40 visits makes none; the switch "book" (or "deal") in immune:policy rests it,
//            and a crawler's tide visits nothing
//   agents   a record an agent's check made carries no by and no sentence of the book: unchanged
//   seed     (3.76) the start list config/watch-seed.json: only store product pages, at most 2 per store and 20 in all, the
//            shipped file holds and is read whole; its pages go before the watch and take their places in it; a page that gave
//            no comparison on 2 days in a row rests 30 days (a start-list page is skipped, a watched page leaves, a new page
//            waits); POST /tide visits the start list first, /seen.json names seed and dry; a node without a start list is as before
//   again    (3.88, "Die Nachmessung") on 28 to 30 Nov 2026 every page with a Black Friday price (visited on Black Friday, of the
//            start list, the watch or resting) is visited again first, also when it rests dry; such a visit changes neither the
//            dry pages nor the watch; past 40 a day only such pages, up to 100, and only with more than 800 MB free; from
//            1 Dec 2026 as before; /seen.json and the weekend balance say how many were measured again today
// Negative controls at the end: each rule broken in a copy of the code, and this proof must fail there.
// Runs without the network: node tools/book-proof.mjs   (exit code 1 when a proof fails or a control is not caught)
//   --no-controls   only the proofs (the controls run this file that way in each broken copy)
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, cpSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const k of ['MARE_TOLL', 'MARE_ENGINE', 'MARE_FAIR', 'MARE_X402_FACILITATOR', 'MARE_PAY_TO', 'MARE_ROUTE_PRICE_CENTS', 'MARE_STATE', 'MARE_DB_URL', 'MARE_DB_KEY', 'MARE_DB_SECRET', 'MARE_BASE_RPC', 'MARE_CATALOG_ID']) delete process.env[k];
process.env.MARE_VIA_SECRET = 'book-proof-via-key, a test value';
let passed = 0, failed = 0;
const D = globalThis.Date; let T0 = D.parse('2026-11-21T09:00:00.000Z'); // (since 3.88) before the days of measuring again, which have proofs of their own
class Clock extends D { constructor(...a) { if (a.length) super(...a); else super(T0); } static now() { return T0; } }
globalThis.Date = Clock;
const proof = async (name, fn) => { T0 += 60_000; try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 6).join('\n       ')}`); } };
const imp = (f) => import(pathToFileURL(join(ROOT, 'node', f)).href);
const { BOOK, AGAIN, bookUrl, nextVisit, watchAfter, seriesAfter, freshOf, seedOf, loadWatchSeed, dryAfter, isDry, againOn, againOf, perDayOn, WATCH_SEED_FILE } = await imp('book.mjs');
const { SEEN } = await imp('seen.mjs');

// ------------------------------------------------------------------ the world: shops, the catalog, DNS
const CATALOG = 'https://catalog.shopify.com/api/ucp/mcp';
const productPage = ({ name = 'Trail Runner 3', brand = 'Example', price = '89.00', cur = 'USD', gtin = '0123456789012' } = {}) => `<!doctype html><html lang="en"><head><title>${name} · Shop</title><meta name="description" content="${name} by ${brand}">
<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'Product', name, brand: { '@type': 'Brand', name: brand }, ...(gtin ? { gtin13: gtin } : {}), offers: { '@type': 'Offer', price, priceCurrency: cur, availability: 'https://schema.org/InStock' } })}</script></head>
<body><main><h1>${name}</h1><p>The ${name} is a shoe for long trails, light and quick on rock and mud, made to last for many seasons of running.</p><p>Price: ${price} ${cur}</p></main></body></html>`;
let shopPrice = '89.00';
const PAGES = {
  'shop.deal-proof.dev/products/trail-runner-3': () => productPage({ price: shopPrice }),
  'second.deal-proof.dev/products/summit-jacket-2': () => productPage({ name: 'Summit Jacket 2', price: '199.00', gtin: '0999999999999' }),
  'gone.deal-proof.dev/products/old-thing': null,
  'seed.deal-proof.dev/products/trail-runner-3': () => productPage({ price: '85.00' }),
  'seed.deal-proof.dev/products/own-brand-shovel': () => productPage({ name: 'Own Brand Shovel', price: '49.00', gtin: '0888888888888' }),
};
const read = []; // every page of a shop that was read: host and path
const offer = (title, cents, cur, host, { name = null } = {}) => ({ title, price_range: { min: { amount: cents, currency: cur } }, variants: [{ price: { amount: cents, currency: cur }, availability: { available: true }, seller: { url: `https://${host}`, name: name || host }, url: `https://${host}/products/x`, checkout_url: `https://${host}/cart/c/1` }] });
const RUNNER = [offer('Example Trail Runner 3 Running Shoe', 7995, 'USD', 'another.deal-proof.dev', { name: 'Another Shop' }), offer('Trail Runner 3', 8400, 'USD', 'third.deal-proof.dev', { name: 'Third Shop' }), offer('Example Trail Runner 3', 9900, 'USD', 'pricey.deal-proof.dev', { name: 'Pricey Shop' })];
const answer = (j, status = 200) => new Response(JSON.stringify(j), { status, headers: { 'content-type': 'application/json' } });
globalThis.fetch = async (u, o = {}) => {
  const s = String(u?.url ?? u);
  if (s === CATALOG) { const q = String(JSON.parse(o.body)?.params?.arguments?.catalog?.query || ''); return answer({ jsonrpc: '2.0', id: 1, result: { structuredContent: { products: /trail runner 3/i.test(q) ? RUNNER : [] } } }); }
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
// the product pages of shops that were read (the tide itself also looks at shops' front pages and UCP files: not the book)
const pages = () => read.filter((x) => x.includes('/products/'));

// ------------------------------------------------------------------ the node
const BASE = 'https://mare.test', SITE = { '/llms.txt': { body: readFileSync(join(ROOT, 'site/llms.txt'), 'utf8'), type: 'text/plain; charset=utf-8' } };
const core = await imp('core.mjs'), { createMem } = await imp('mem.mjs'), { memoryKv } = await imp('flow.mjs');
const { immune } = await imp('immune.mjs'), { createLedger } = await imp('ledger.mjs'), { payConfig } = await imp('pay.mjs');
const dir = mkdtempSync(join(tmpdir(), 'mare-book-')), file = join(dir, 'sea.tsv');
process.once('exit', () => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });
writeFileSync(file, ''); writeFileSync(join(dir, 'build.json'), JSON.stringify({ builtAt: '2026-11-20T10:00:00.000Z', entries: 0, lakes: {} }));
const db = createMem({ file, base: BASE }), kv = memoryKv(), ledger = createLedger({}), waits = [];
const cfg = { base: BASE, kv, ledger, pay: payConfig({}), site: SITE, waitUntil: (p) => { waits.push(p); }, creditSweepMs: 0 };
const call = async (path, { method = 'GET', accept = 'application/json', ip = '198.51.100.7', ua = 'book-proof-agent/1.0', body } = {}) => {
  const h = { accept, 'user-agent': ua, 'x-forwarded-for': ip, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) };
  const res = await core.handle(new Request(BASE + path, { method, headers: h, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }), db, cfg);
  const text = res.body ? Buffer.from(await res.arrayBuffer()).toString('utf8') : ''; let j = null; try { j = JSON.parse(text); } catch {}
  return { status: res.status, text, j };
};
const settle = async () => { while (waits.length) await Promise.allSettled(waits.splice(0)); };
await call('/stats', { ip: '127.0.0.1' });
immune.set({ mode: 'normal', rest: [], pace: { perMinute: 1_000_000, burst: 1_000_000 } });
const sea = core.seaOf(db, cfg, BASE);
const day = () => new Date().toISOString().slice(0, 10);
// the current's picks, as node/eco.mjs keeps them: a product page, the same with a campaign, a checkout, an Amazon page, a page
// that is no product page, a product page that is gone, and a product page of a second store
const RUN = 'https://shop.deal-proof.dev/products/trail-runner-3', JACKET = 'https://second.deal-proof.dev/products/summit-jacket-2', GONE = 'https://gone.deal-proof.dev/products/old-thing';
const PICKS = { run: `${RUN}?utm_source=mail`, cart: 'https://shop.deal-proof.dev/cart/c/123', amz: 'https://www.amazon.com/products/trail-runner-3', about: 'https://shop.deal-proof.dev/pages/about', gone: GONE, jacket: JACKET, same: 'https://shop.deal-proof.dev/products/summit-socks' };
const seed = async (order) => { await kv.set('tide:recent', order); for (const s of order) await kv.set(`tide:${s}`, { need: s, url: PICKS[s], price: 1, currency: 'USD' }); await kv.set('book:cursor', 0); };
const tide = async (ua = 'mare-tide/1.0 (+https://mareliberum.dev/current)') => { await kv.set('tide:lock', null).catch(() => {}); const r = await call('/tide', { method: 'POST', ua, ip: '127.0.0.1', body: {} }); await settle(); return r; };

console.log('pages');
await proof('the book visits only a store\'s own product page over https (variant kept, campaign dropped), never a checkout, a cart, another page or Amazon', async () => {
  assert.equal(bookUrl(`${RUN}?utm_source=mail&session=1`), RUN);
  assert.equal(bookUrl(`${RUN}?variant=4711&utm_source=x`), `${RUN}?variant=4711`);
  assert.equal(bookUrl('https://shop.example/collections/run/products/trail'), 'https://shop.example/collections/run/products/trail');
  for (const u of ['http://shop.example/products/a', 'https://shop.example/cart/c/1', 'https://shop.example/checkouts/products/x', 'https://shop.example/pages/about', 'https://www.amazon.com/products/x', 'https://amazon.de/products/x', 'mailto:a@b.c', null, 42]) assert.equal(bookUrl(u), null, String(u));
  assert.deepEqual(freshOf(Object.values(PICKS).map((url) => ({ url }))), [RUN, GONE, JACKET, 'https://shop.deal-proof.dev/products/summit-socks']);
});
console.log('order');
await proof('a watched page not visited today goes first, then a new page; a page visited today and a busy store wait; none past 40 a day', async () => {
  const A = 'https://a.example/products/1', B = 'https://b.example/products/2', C = 'https://c.example/products/3';
  assert.deepEqual(nextVisit({ watch: [A], fresh: [B] }), { url: A, kind: 'watch' });
  assert.deepEqual(nextVisit({ watch: [A], done: [A], fresh: [A, B] }), { url: B, kind: 'new' });
  assert.deepEqual(nextVisit({ watch: [A], fresh: [B, C], busy: (h) => h === 'a.example' || h === 'b.example' }), { url: C, kind: 'new' });
  assert.equal(nextVisit({ tried: BOOK.perDay, watch: [A], fresh: [B] }), null);
  assert.equal(nextVisit({ watch: [], fresh: [] }), null);
  assert.equal(BOOK.perDay, 40); assert.equal(BOOK.watch, 20); assert.equal(BOOK.hostGapS, 3600);
});
console.log('watch');
await proof('a new page that gave a record joins the watch while there is room; a watched page that gives none leaves; a series holds one price a day, oldest first', async () => {
  const w = Array.from({ length: 19 }, (_, i) => `https://s${i}.example/products/x`);
  const w20 = watchAfter(w, { url: 'https://n.example/products/y', kind: 'new' }, true); assert.equal(w20.length, 20);
  assert.equal(watchAfter(w20, { url: 'https://m.example/products/z', kind: 'new' }, true).length, 20, 'no room past 20');
  assert.deepEqual(watchAfter(w, { url: 'https://n.example/products/y', kind: 'new' }, false), w, 'no record, no place');
  assert.deepEqual(watchAfter(w, { url: w[3], kind: 'watch' }, false), w.filter((_, i) => i !== 3), 'a watched page without a record leaves');
  assert.deepEqual(watchAfter(w, { url: w[3], kind: 'watch' }, true), w);
  let s = seriesAfter([], { day: '2026-11-28', price: 80, currency: 'USD' }); s = seriesAfter(s, { day: '2026-11-27', price: 89, currency: 'USD' }); s = seriesAfter(s, { day: '2026-11-28', price: 79, currency: 'USD', record: 'abc' });
  assert.deepEqual(s, [{ d: '2026-11-27', p: 89, c: 'USD' }, { d: '2026-11-28', p: 79, c: 'USD', r: 'abc' }]);
  assert.deepEqual(seriesAfter(s, { day: '2026-11-29', price: null, currency: 'USD' }), s, 'no price, no point');
});

console.log('tide');
let made = null;
await proof('POST /tide makes one visit after the current moved: its record says by "sea" with the sentence of the book, on its page and in /seen', async () => {
  await seed(['cart', 'amz', 'about', 'run', 'jacket']); read.length = 0;
  const t = await tide(); assert.equal(t.status, 200, t.text.slice(0, 200));
  assert.deepEqual(pages(), ['shop.deal-proof.dev/products/trail-runner-3'], 'one visit: the first product page');
  const list = (await call('/seen.json')).j; made = list.records[0]; assert.ok(made, 'a record'); assert.equal(made.by, 'sea'); assert.equal(made.store, 'shop.deal-proof.dev');
  const rec = (await call(`${SEEN.path}/${made.id}.json`)).j; assert.equal(rec.by, 'sea'); assert.equal(rec.sample, BOOK.said); assert.equal(rec.product.url, RUN);
  assert.ok(rec.elsewhere_found >= 2 && rec.indexable === true, 'compares 3 prices: open to search engines');
  const page = (await call(`${SEEN.path}/${made.id}`, { accept: 'text/html' })).text; assert.ok(page.includes('Made by the sea&#39;s own daily sample of product pages'), 'the page says so');
  assert.ok(page.indexOf('<h1>') < page.indexOf('daily sample'), 'after the heading');
  const seenPage = (await call(SEEN.path, { accept: 'text/html' })).text; assert.ok(seenPage.includes(`${made.id}`) && seenPage.includes("· the sea's daily sample</small>"), 'the list says so'); assert.ok(seenPage.includes('The sea adds its own every day: up to 40 product pages, 20 of them'), '/seen names the book');
  assert.deepEqual({ ...list.book, what: undefined }, { what: undefined, day: day(), visits: 1, records: 1, watch: 1, per_day: 40, watch_max: 20 });
});
await proof('a visit is no deal check of the day, no read of the day and no look in the memory of what agents saw', async () => {
  const d = (await call('/deal')).j; assert.equal(d.today?.checks, 0, 'no deal check of the day');
  assert.equal((await kv.get(`deal:count:${day()}`)) ?? null, null); assert.equal((await kv.get(`reads:${day()}`)) ?? null, null, 'no read of the day');
  const agent = await call(`/deal?url=${encodeURIComponent(RUN)}`, { ip: '198.51.100.20' }); assert.equal(agent.status, 200, agent.text.slice(0, 200));
  assert.ok(!agent.j.seen?.checks, 'nobody saw it before: the book left no look in the memory of agents');
  assert.equal((await call('/deal')).j.today?.checks, 1, 'the agent\'s check counts');
});
console.log('pace');
await proof('the same store waits an hour; the next tide visits another store; a page that is gone gives no record and joins no watch', async () => {
  T0 += 6 * 60_000; read.length = 0; await seed(['run', 'same', 'gone', 'jacket']);
  await tide(); assert.deepEqual(pages(), ['gone.deal-proof.dev/products/old-thing'], 'another page of shop.deal-proof.dev waits, the next store is read');
  let b = (await call('/seen.json')).j.book; assert.equal(b.visits, 2); assert.equal(b.records, 1); assert.equal(b.watch, 1, 'a page that is gone joins no watch');
  T0 += 6 * 60_000; read.length = 0; await tide(); assert.deepEqual(pages(), ['second.deal-proof.dev/products/summit-jacket-2']);
  b = (await call('/seen.json')).j.book; assert.equal(b.visits, 3); assert.equal(b.records, 2); assert.equal(b.watch, 2, 'the jacket gave a record: it joins the watch');
  T0 += 6 * 60_000; read.length = 0; await tide(); assert.deepEqual(pages(), [], 'all three stores visited within the hour: none again');
});
await proof('the next day the watched page is visited first and its series holds both days', async () => {
  T0 = D.parse(`${new Date(T0 + 86_400_000).toISOString().slice(0, 10)}T08:00:00.000Z`); shopPrice = '79.00'; read.length = 0;
  await seed(['jacket', 'run']); await tide();
  assert.equal(pages()[0], 'shop.deal-proof.dev/products/trail-runner-3', 'the watched page first (the jacket, also watched, comes after it)');
  const series = await sea.bookSeries(RUN); assert.deepEqual(series.map((x) => [x.p, x.c]), [[89, 'USD'], [79, 'USD']]); assert.equal(series.length, 2);
  const list = (await call('/seen.json')).j; assert.equal(list.records[0].by, 'sea'); assert.equal(list.records[0].price, 79); assert.equal(list.book.visits, 1);
});
await proof('a day with 40 visits makes none; the switch "book" or "deal" rests it; a crawler\'s tide visits nothing', async () => {
  T0 += 2 * 3600_000; await seed(['run', 'jacket']);
  await kv.set(`book:tried:${day()}`, 40); read.length = 0; await tide(); assert.deepEqual(pages(), [], '40 a day');
  await kv.set(`book:tried:${day()}`, 1);
  for (const rest of ['book', 'deal']) { immune.set({ mode: 'normal', rest: [rest] }); try { T0 += 6 * 60_000; read.length = 0; await tide(); assert.deepEqual(pages(), [], `at rest: ${rest}`); } finally { immune.set({ mode: 'normal', rest: [] }); } }
  T0 += 6 * 60_000; read.length = 0; await tide('GPTBot/1.2 (+https://openai.com/gptbot)'); assert.deepEqual(pages(), [], 'a crawler moves nothing');
  T0 += 6 * 60_000; read.length = 0; await tide(); assert.equal(pages().length, 1, 'and it visits again');
});
console.log('agents');
await proof('a record an agent\'s check made carries no by and no sentence of the book', async () => {
  shopPrice = '77.00'; const r = await call(`/deal?url=${encodeURIComponent(RUN)}`, { ip: '198.51.100.30' }); assert.ok(r.j.record, 'a record');
  const rec = (await call(`${SEEN.path}/${r.j.record.id}.json`)).j; assert.equal(rec.by, undefined); assert.equal(rec.sample, undefined);
  const page = (await call(`${SEEN.path}/${r.j.record.id}`, { accept: 'text/html' })).text; assert.ok(!page.includes('daily sample'), 'no sentence of the book');
  const line = (await call('/seen.json')).j.records.find((x) => x.id === r.j.record.id); assert.equal(line.by, undefined);
});
console.log('seed');
await proof('the start list holds only store product pages, at most 2 per store and 20 in all; a broken file is an empty list', async () => {
  const r = seedOf({ pages: ['https://a.example/products/1?utm_source=x', 'https://a.example/products/2', 'https://a.example/products/3', 'https://a.example/products/1', 'https://www.amazon.de/products/x', 'https://b.example/cart/c/1', 'http://c.example/products/1', 'https://d.example/pages/about', 42] });
  assert.deepEqual(r.pages, ['https://a.example/products/1', 'https://a.example/products/2']);
  assert.equal(r.skipped.length, 7); assert.ok(r.skipped.some((x) => /more than 2 pages of a\.example/.test(x.why))); assert.ok(r.skipped.some((x) => x.why === 'twice'));
  const many = seedOf({ pages: Array.from({ length: 30 }, (_, i) => `https://s${i}.example/products/x`) }); assert.equal(many.pages.length, 20, 'never more than the watch holds');
  assert.deepEqual(seedOf('{ not json').pages, []); assert.deepEqual(seedOf(null).pages, []);
  const dir2 = mkdtempSync(join(tmpdir(), 'mare-seed-')); try { writeFileSync(join(dir2, 'x.json'), '{ broken'); assert.deepEqual(loadWatchSeed(join(dir2, 'x.json')), []); assert.deepEqual(loadWatchSeed(join(dir2, 'none.json')), []); } finally { rmSync(dir2, { recursive: true, force: true }); }
});
await proof('the shipped config/watch-seed.json holds: every line a store product page, none skipped, never Amazon, at most 2 per store', async () => {
  const raw = readFileSync(WATCH_SEED_FILE, 'utf8'), j = JSON.parse(raw), r = seedOf(raw);
  assert.ok(Array.isArray(j.pages) && j.pages.length >= 1, 'pages'); assert.deepEqual(r.skipped, [], 'nothing skipped');
  assert.equal(r.pages.length, j.pages.length); assert.deepEqual(loadWatchSeed(), r.pages);
  for (const u of j.pages) { assert.ok(!/amazon\.|[?&](tag|utm_|awc|clickref)=/i.test(u), u); }
  assert.ok(typeof j.what === 'string' && j.what.includes('never carries a commission'), 'the file says what it is');
  const sv = readFileSync(join(ROOT, 'serve.mjs'), 'utf8'); assert.ok(sv.includes('const watchSeed = loadWatchSeed();'), 'the node reads the start list once'); assert.ok(/handle\(request, db, \{[^}]*\bwatchSeed\b/.test(sv), 'and hands it to every request');
});
await proof('the start list goes before the watch and takes its places in it; a dry page rests: skipped, leaves the watch, a new one waits', async () => {
  const S = 'https://s.example/products/1', A = 'https://a.example/products/1', B = 'https://b.example/products/2';
  assert.deepEqual(nextVisit({ seed: [S], watch: [A], fresh: [B] }), { url: S, kind: 'seed' });
  assert.deepEqual(nextVisit({ seed: [S], watch: [S, A], done: [S], fresh: [B] }), { url: A, kind: 'watch' }, 'a start-list page in the watch is no second visit');
  assert.deepEqual(nextVisit({ seed: [S], watch: [A], fresh: [S, B], done: [A, S] }), { url: B, kind: 'new' });
  assert.deepEqual(nextVisit({ seed: [S], watch: [A], fresh: [B], dry: (u) => u === S || u === A }), { url: B, kind: 'new' }, 'dry pages rest');
  assert.equal(nextVisit({ seed: [S], fresh: [B], busy: (h) => h === 's.example', dry: (u) => u === B }), null);
  const w = Array.from({ length: 13 }, (_, i) => `https://w${i}.example/products/x`);
  assert.equal(watchAfter(w, { url: B, kind: 'new' }, true, { seeded: 7 }).length, 13, 'room is 20 less the start list');
  assert.equal(watchAfter(w.slice(1), { url: B, kind: 'new' }, true, { seeded: 7 }).length, 13);
  assert.deepEqual(watchAfter(w, { url: S, kind: 'seed' }, false), w, 'a start-list visit leaves the watch as it is');
  assert.deepEqual(watchAfter(w, { url: w[0], kind: 'watch' }, true, { dry: true }), w.slice(1), 'a watched page that rests dry leaves');
  assert.deepEqual(watchAfter(w.slice(1), { url: B, kind: 'new' }, true, { dry: true }), w.slice(1), 'a dry page joins no watch');
  let d = dryAfter({}, A, '2026-11-27', false); assert.deepEqual(d[A], { d: '2026-11-27', n: 1 }); assert.equal(isDry(d, A, '2026-11-27'), false, 'one day is not dry');
  d = dryAfter(d, A, '2026-11-27', false); assert.equal(d[A].n, 1, 'the same day twice is one day');
  d = dryAfter(d, A, '2026-11-28', false); assert.equal(d[A].n, 2); assert.equal(isDry(d, A, '2026-11-28'), true, 'two days in a row');
  assert.equal(isDry(d, A, '2026-12-28'), true); assert.equal(isDry(d, A, '2026-12-29'), false, 'rests 30 days');
  assert.equal(dryAfter(d, A, '2026-12-30', false)[A].n, 1, 'after the rest it starts again');
  assert.equal(dryAfter(dryAfter({}, B, '2026-11-25', false), B, '2026-11-27', false)[B].n, 1, 'a gap of a day: not in a row');
  assert.equal(dryAfter(d, A, '2026-11-29', true)[A], undefined, 'compared: no longer dry');
  assert.equal(BOOK.seedPerStore, 2); assert.equal(BOOK.dryDays, 2); assert.equal(BOOK.dryRestDays, 30);
});
await proof('POST /tide visits the start list first; /seen.json names seed and dry; a start-list page without comparison rests after 2 days', async () => {
  const SR = 'https://seed.deal-proof.dev/products/trail-runner-3', SH = 'https://seed.deal-proof.dev/products/own-brand-shovel';
  cfg.watchSeed = [SH, SR];
  try {
    T0 = D.parse(`${new Date(T0 + 86_400_000).toISOString().slice(0, 10)}T06:00:00.000Z`); read.length = 0; await seed(['run', 'jacket']);
    await tide(); assert.deepEqual(pages(), ['seed.deal-proof.dev/products/own-brand-shovel'], 'the start list first');
    let b = (await call('/seen.json')).j.book; assert.equal(b.seed, 2, 'one day without comparison is not dry'); const dry0 = b.dry || 0; assert.ok(b.watch >= b.seed + 1, 'watch counts the start list beside the watched pages');
    T0 += 6 * 60_000; read.length = 0; await tide(); assert.ok(!pages().includes('seed.deal-proof.dev/products/trail-runner-3'), 'the second page of the same store waits the hour');
    T0 += 61 * 60_000; read.length = 0; await tide(); assert.deepEqual(pages(), ['seed.deal-proof.dev/products/trail-runner-3'], 'then the second start-list page');
    const sp = (await call('/seen', { accept: 'text/html' })).text; assert.ok(sp.includes('2 from its fixed start list'), '/seen names the start list');
    T0 = D.parse(`${new Date(T0 + 86_400_000).toISOString().slice(0, 10)}T06:00:00.000Z`); read.length = 0; await tide();
    assert.deepEqual(pages(), ['seed.deal-proof.dev/products/own-brand-shovel'], 'the next day the start list first again');
    b = (await call('/seen.json')).j.book; assert.equal(b.seed, 1, 'the shovel found no other store two days in a row: it rests'); assert.equal(b.dry, dry0 + 1, 'and is counted as resting');
    T0 += 61 * 60_000; read.length = 0; await tide(); assert.deepEqual(pages(), ['seed.deal-proof.dev/products/trail-runner-3'], 'the compared page stays, the dry one is skipped');
    T0 += 61 * 60_000; read.length = 0; await tide(); assert.ok(!pages().includes('seed.deal-proof.dev/products/own-brand-shovel'), 'the dry page is not visited again');
  } finally { delete cfg.watchSeed; }
  const b = (await call('/seen.json')).j.book; assert.equal(b.seed, undefined, 'a node without a start list says what it said before');
});
console.log('again');
await proof('the days of measuring again are 28 to 30 Nov 2026, the days of the weekend balance; past 40 a day only then and only with more than 800 MB free', async () => {
  const { BFCM } = await imp('bfcm.mjs');
  assert.deepEqual([AGAIN.bf, AGAIN.from, AGAIN.to], [BFCM.bf, BFCM.sat, BFCM.cm]);
  assert.deepEqual(['2026-11-27', '2026-11-28', '2026-11-30', '2026-12-01'].map(againOn), [false, true, true, false]);
  assert.equal(perDayOn('2026-11-29', 2000), 100); assert.equal(perDayOn('2026-11-29', 800), 40); assert.equal(perDayOn('2026-11-29', NaN), 40, 'unknown memory is too little');
  assert.equal(perDayOn('2026-12-01', 4000), 40); assert.equal(perDayOn('2026-11-27', 4000), 40);
});
await proof('a page to measure again goes first, also when it rests dry; past 40 visits only such a page, up to the pace of the day; it leaves the watch as it is', async () => {
  const A = 'https://a.deal-proof.dev/products/x', S = 'https://s.deal-proof.dev/products/y', W = 'https://w.deal-proof.dev/products/z';
  assert.deepEqual(nextVisit({ again: [A], seed: [S], watch: [W], dry: (u) => u === A }), { url: A, kind: 'again' }, 'first, though it rests');
  assert.deepEqual(nextVisit({ again: [A], seed: [S], done: [A] }), { url: S, kind: 'seed' }, 'once a day');
  assert.deepEqual(nextVisit({ again: [A], seed: [S], busy: (h) => h === 'a.deal-proof.dev' }), { url: S, kind: 'seed' }, 'its store waits the hour too');
  assert.deepEqual(nextVisit({ tried: 40, again: [A], seed: [S], max: 100 }), { url: A, kind: 'again' }, 'past 40 with the pace of the day');
  assert.equal(nextVisit({ tried: 40, seed: [S], watch: [W], max: 100 }), null, 'past 40 nothing else');
  assert.equal(nextVisit({ tried: 100, again: [A], max: 100 }), null, 'never past the pace of the day');
  assert.equal(nextVisit({ tried: 40, again: [A] }), null, 'without the higher pace 40 stays the cap');
  assert.deepEqual(watchAfter([W], { url: A, kind: 'again' }, true), [W], 'it joins no watch'); assert.deepEqual(watchAfter([W, A], { url: A, kind: 'again' }, false, { dry: true }), [W, A], 'and leaves none');
});
await proof('the pages to measure again: store product pages with a measured Black Friday price, each once, never Amazon', async () => {
  const bf = [{ d: '2026-11-27', p: 10, c: 'USD' }];
  const S = { 'https://a.deal-proof.dev/products/x': bf, 'https://b.deal-proof.dev/products/y': [{ d: '2026-11-26', p: 10, c: 'USD' }], 'https://www.amazon.com/products/z': bf, 'https://c.deal-proof.dev/pages/about': bf, 'https://d.deal-proof.dev/products/n': [{ d: '2026-11-27', p: null, c: 'USD' }] };
  assert.deepEqual(againOf([...Object.keys(S), 'https://a.deal-proof.dev/products/x'], (u) => S[u]), ['https://a.deal-proof.dev/products/x']);
});
await proof('POST /tide on 29 Nov measures the Black Friday page again first though it rests, changes neither the dry pages nor the watch; /seen.json and the balance say so', async () => {
  const sk = `book:series:${createHash('sha256').update(RUN).digest('hex').slice(0, 32)}`;
  T0 = D.parse('2026-11-27T20:00:00.000Z');
  await kv.set('book:done:2026-11-27', [RUN, GONE], 3 * 86400); await kv.set(sk, [{ d: '2026-11-27', p: 89, c: 'USD' }], 30 * 86400);
  const dry0 = { [RUN]: { d: '2026-11-27', n: 2 } }; await kv.set('book:dry', dry0, 30 * 86400); await kv.set('book:watch', [JACKET], 30 * 86400); await kv.set('book:again', null);
  T0 = D.parse('2026-11-29T06:00:00.000Z'); read.length = 0; shopPrice = '79.00'; await seed(['jacket']); await tide();
  assert.deepEqual(pages(), ['shop.deal-proof.dev/products/trail-runner-3'], 'the resting Black Friday page first');
  assert.deepEqual(await kv.get('book:again'), [RUN], 'the list: the pages of Black Friday with a price (the page that is gone has none)');
  assert.deepEqual(await kv.get('book:dry'), dry0, 'the dry pages as they were'); assert.deepEqual(await kv.get('book:watch'), [JACKET], 'the watch as it was');
  assert.deepEqual((await sea.bookSeries(RUN)).map((x) => x.d), ['2026-11-27', '2026-11-29'], 'the series has Sunday');
  assert.deepEqual((await call('/seen.json')).j.book.again, { day: '2026-11-29', pages: 1, measured_today: 1, pending: 0, until: '2026-11-30' });
  const b = (await call('/seen/bfcm-2026.json')).j;
  assert.equal(b.again.line, '1 of the 1 product page with a Black Friday price was measured again today (29 Nov 2026); each is measured again every day until Cyber Monday.');
  assert.equal(b.lines.find((x) => x.url === RUN)?.sunday, 79, 'the page stands in the balance with its Sunday');
  const h = (await call('/seen/bfcm-2026', { accept: 'text/html' })).text; assert.ok(/<p class="lead">[^\n]*<\/p>\n<p id="again">1 of the 1 product page/.test(h), 'the second sentence');
});
await proof('on Cyber Monday past 40 visits only a page to measure again, only with more than 800 MB free; from 1 Dec as before', async () => {
  T0 = D.parse('2026-11-30T06:00:00.000Z'); await kv.set('book:tried:2026-11-30', 40, 3 * 86400); read.length = 0;
  assert.equal((await sea.bookStep(BASE, [], { freeMB: 500 })).calm, true, 'little memory: 40 stays the cap');
  const r = await sea.bookStep(BASE, [], { freeMB: 2000 }); assert.equal(r.kind, 'again'); assert.equal(r.url, RUN);
  assert.equal((await sea.bookStep(BASE, [], { freeMB: 2000 })).calm, true, 'nothing else past 40');
  T0 = D.parse('2026-12-01T06:00:00.000Z'); await kv.set('book:tried:2026-12-01', 40, 3 * 86400);
  assert.equal((await sea.bookStep(BASE, [], { freeMB: 4000 })).calm, true, '1 Dec: 40 is the cap again');
  await kv.set('book:tried:2026-12-01', 0, 3 * 86400); await seed(['jacket']);
  const n = await sea.bookStep(BASE, [], { freeMB: 4000 }); assert.notEqual(n?.url, RUN, '1 Dec: the resting page rests again');
  assert.equal((await call('/seen.json')).j.book.again, undefined, '/seen.json without again');
});
await proof('llms.txt names the record book; proof:book in package.json', async () => {
  const l = readFileSync(join(ROOT, 'site/llms.txt'), 'utf8'); for (const x of ['The record book:', '"by": "sea"', 'field "book" of https://mareliberum.dev/seen.json', 'The start list of the record book:', 'config/watch-seed.json', 'Fields "seed" (pages of the start list watched) and "dry"']) assert.ok(l.includes(x), x);
  assert.equal(JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).scripts['proof:book'], 'node tools/book-proof.mjs');
});

console.log(`\n${passed} proofs hold, ${failed} fail`);

// ------------------------------------------------------------------ negative controls: each rule broken in a copy, the proof must fail there
let caught = 0, missed = 0;
if (!process.argv.includes('--no-controls')) {
  console.log('\nnegative controls: each rule broken in a copy, the proof must fail there');
  const CONTROLS = [
    ['an Amazon page visited', 'node/book.mjs', 'if (!host || AMAZON.test(host)) return null;', 'if (!host) return null;'],
    ['a checkout or any page visited, not only product pages', 'node/book.mjs', "return /\\/products\\/[^/]+\\/?$/.test(path) && !/\\/(cart|checkouts?)\\//.test(path) ? c : null;", 'return c;'],
    ['new pages before the watch', 'node/book.mjs', "for (const url of w) if (!ss.has(url) && ok(url)) return { url, kind: 'watch' };", ''],
    ['the same store visited again within the hour', 'node/lens.mjs', 'busy: (x) => busy.has(x), dry: resting, max });', 'busy: () => false, dry: resting, max });'],
    ['no cap of visits a day', 'node/book.mjs', 'if (!(tried < BOOK.perDay)) return null;', ''],
    ['a visit counted as an agent\'s deal check', 'node/lens.mjs', 'if (!ctx?.uncounted && !book) { const day = now().slice(0, 10);', 'if (!ctx?.uncounted) { const day = now().slice(0, 10);'],
    ['a visit left as a look in the memory of agents', 'node/lens.mjs', '!ctx?.uncounted && !book) await kv.set(k, remembered(', '!ctx?.uncounted) await kv.set(k, remembered('],
    ['a record of the book not marked', 'node/lens.mjs', "book ? { by: 'sea' } : {});", '{});'],
    ['the tide without the book', 'node/core.mjs', "cfg.waitUntil?.(sea.bookStep(base, cfg.watchSeed).catch(", "cfg.waitUntil?.(Promise.resolve(base).catch("],
    ['the book not resting with the deal check', 'node/core.mjs', "!immune.atRest?.('book') && !immune.atRest?.('deal') && sea.bookStep", "!immune.atRest?.('book') && sea.bookStep"],
    ['a watched page without a record kept forever', 'node/book.mjs', 'return made && !dry ? w : w.filter((u) => u !== visit.url);', 'return w;'],
    ['the start list after the watch', 'node/book.mjs', "for (const url of s) if (ok(url)) return { url, kind: 'seed' };", "for (const url of [...w, ...s]) if (ok(url)) return { url, kind: s.includes(url) ? 'seed' : 'watch' };"],
    ['more than 2 pages of a store in the start list', 'node/book.mjs', 'else if ((per[h] || 0) >= BOOK.seedPerStore)', 'else if (false)'],
    ['an Amazon page or any link in the start list', 'node/book.mjs', 'const u = bookUrl(p), h = u && bookHost(u);', 'const u = typeof p === \'string\' ? p : null, h = u && bookHost(u);'],
    ['a dry page visited again', 'node/book.mjs', 'ok = (url) => free(url) && !dry(url);', 'ok = (url) => free(url);'],
    ['dry after one day', 'node/book.mjs', '(Number(x.n) || 0) >= BOOK.dryDays &&', '(Number(x.n) || 0) >= 1 &&'],
    ['dry days counted with a gap', 'node/book.mjs', 'n: x && x.d === dayBefore(day) ? x.n + 1 : 1', 'n: x ? x.n + 1 : 1'],
    ['a dry page resting forever', 'node/book.mjs', '(!day || daysBetween(x.d, day) <= BOOK.dryRestDays)', 'true'],
    ['the start list not handed to the book', 'node/core.mjs', 'sea.bookStep(base, cfg.watchSeed).catch(', 'sea.bookStep(base).catch('],
    ['the Black Friday pages not measured again first', 'node/book.mjs', "for (const url of list(again)) if (free(url)) return { url, kind: 'again' };", ''],
    ['a visit to measure again judged dry', 'node/lens.mjs', "const dry2 = visit.kind === 'again' ? dry : dryAfter(dry, visit.url, day, compared);\n      if (visit.kind !== 'again') await kv.set('book:dry', dry2, 400 * DAY);", "const dry2 = dryAfter(dry, visit.url, day, compared);\n      await kv.set('book:dry', dry2, 400 * DAY);"],
    ['a visit to measure again joins the watch', 'node/book.mjs', "if (visit?.kind === 'seed' || visit?.kind === 'again') return w;", "if (visit?.kind === 'seed') return w;"],
    ['measuring again after Cyber Monday', 'node/book.mjs', '&& day >= AGAIN.from && day <= AGAIN.to;', '&& day >= AGAIN.from;'],
    ['past 40 a day without enough memory', 'node/book.mjs', '&& Number.isFinite(freeMB) && freeMB > AGAIN.freeMB ?', ' ?'],
    ['the node not reading the start list', 'serve.mjs', 'const out = await handle(request, db, { kv, seed, site, watchSeed, waitUntil,', 'const out = await handle(request, db, { kv, seed, site, waitUntil,'],
  ];
  for (const [name, f, from, to] of CONTROLS) {
    const d2 = mkdtempSync(join(tmpdir(), 'mare-book-ctl-'));
    try {
      cpSync(ROOT, d2, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      const fp = join(d2, f), txt = readFileSync(fp, 'utf8');
      if (!txt.includes(from)) { missed++; console.log(`  FAIL control "${name}": the line to break is gone from ${f}; the control needs updating`); continue; }
      writeFileSync(fp, txt.replace(from, to));
      const r = spawnSync(process.execPath, [join(d2, 'tools/book-proof.mjs'), '--no-controls'], { encoding: 'utf8', timeout: 240_000 });
      const out = `${r.stdout}${r.stderr}`, broke = (out.match(/\n  FAIL /g) || []).length;
      if (r.status !== 0 && broke > 0) { caught++; console.log(`  ok   caught: ${name} (${broke} proof${broke === 1 ? '' : 's'} failed)`); }
      else { missed++; console.log(`  FAIL control "${name}" was not caught (exit ${r.status})`); }
    } finally { try { rmSync(d2, { recursive: true, force: true }); } catch {} }
  }
  console.log(`${caught} of ${CONTROLS.length} controls caught`);
}
process.exit(failed || missed ? 1 : 0);
