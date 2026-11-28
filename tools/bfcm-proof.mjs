// Mare Liberum · proof of the weekend balance (3.87, node/bfcm.mjs, "Die Wochenend-Bilanz"): /seen/bfcm-2026 counts the same
// product pages of the record book, priced on the store's own page on Black Friday and on Cyber Monday, and says the verdict in
// its title, its heading and its first sentence. It proves, with a node in memory and series written as the book writes them:
//   count    a page counts only with a measured price on both days in the same currency: cheaper, dearer and unchanged (to the
//            cent) are counted right, the median change is right, and pages measured on only one day (or in two currencies)
//            are left out and their number stands in the first sentence
//   before   before Cyber Monday is measured the heading and first sentence say what Black Friday measured and when Cyber
//            Monday follows, and the page says noindex
//   order    the lines go by the change, the largest fall first; Saturday and Sunday stand only when measured; the lowest price
//            measured after Cyber Monday (until 15 Jan 2027) is named
//   honest   never an Amazon page, never a forecast, never /mcp/app; open to search engines only with 10 pages counted and
//            Cyber Monday measured; the start list, the watch and the resting pages of the book are all read
//   found    /seen and llms.txt name the balance; the JSON is CC BY 4.0 and names each page's record
//   again    (3.88) on a day of measuring again the second sentence (and again.line in the JSON) says how many Black Friday
//            pages were measured again today; without the book's numbers for today the page is as before
// Negative controls at the end: each rule broken in a copy of the code, and this proof must fail there.
// Runs without the network: node tools/bfcm-proof.mjs   (exit code 1 when a proof fails or a control is not caught)
//   --no-controls   only the proofs (the controls run this file that way in each broken copy)
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, cpSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const k of ['MARE_TOLL', 'MARE_ENGINE', 'MARE_FAIR', 'MARE_X402_FACILITATOR', 'MARE_PAY_TO', 'MARE_ROUTE_PRICE_CENTS', 'MARE_STATE', 'MARE_DB_URL', 'MARE_DB_KEY', 'MARE_DB_SECRET', 'MARE_BASE_RPC', 'MARE_CATALOG_ID']) delete process.env[k];
process.env.MARE_VIA_SECRET = 'bfcm-proof-via-key, a test value';
let passed = 0, failed = 0;
const D = globalThis.Date; let T0 = D.parse('2026-11-28T12:00:00.000Z');
class Clock extends D { constructor(...a) { if (a.length) super(...a); else super(T0); } static now() { return T0; } }
globalThis.Date = Clock;
const proof = async (name, fn) => { try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 6).join('\n       ')}`); } };
const imp = (f) => import(pathToFileURL(join(ROOT, 'node', f)).href);
const { BFCM, bfcmOf, bfcmJson, bfcmHtml, bfcmHeadline, bfcmLead, bfcmAgainLine } = await imp('bfcm.mjs');

// ------------------------------------------------------------------ the pages: series as node/book.mjs writes them ({d, p, c, r})
const P = (h, n) => `https://${h}/products/${n}`;
const s = (pts) => pts.map(([d, p, c = 'USD', r]) => ({ d, p, c, ...(r ? { r } : {}) }));
const ROWS = [
  { url: P('a.shop.test', 'falls'), name: 'Falls Jacket', store: 'a.shop.test', series: s([['2026-11-27', 100], ['2026-11-28', 95], ['2026-11-30', 90], ['2026-12-03', 80], ['2026-12-05', 85]]) },
  { url: P('b.shop.test', 'rises'), name: 'Rises Mug', store: 'b.shop.test', series: s([['2026-11-27', 50], ['2026-11-30', 55]]) },
  { url: P('c.shop.test', 'stays'), name: 'Stays Lamp', store: 'c.shop.test', series: s([['2026-11-27', 19.99], ['2026-11-30', 19.99]]) },
  { url: P('d.shop.test', 'bf-only'), name: 'Only Friday', store: 'd.shop.test', series: s([['2026-11-27', 30]]) },
  { url: P('e.shop.test', 'two-cur'), name: 'Two Currencies', store: 'e.shop.test', series: s([['2026-11-27', 40, 'EUR'], ['2026-11-30', 42, 'USD']]) },
  { url: 'https://www.amazon.com/products/never', name: 'Amazon Thing', store: 'amazon.com', series: s([['2026-11-27', 10], ['2026-11-30', 5]]) },
  { url: P('g.shop.test', 'cm-only'), name: 'Only Monday', store: 'g.shop.test', series: s([['2026-11-30', 60]]) },
  { url: P('h.shop.test', 'falls-more'), name: 'Falls More Boot', store: 'h.shop.test', series: s([['2026-11-27', 200], ['2026-11-30', 150]]) },
  { url: P('i.shop.test', 'no-price'), name: 'No Price', store: 'i.shop.test', series: [{ d: '2026-11-27', p: 20, c: 'USD' }, { d: '2026-11-30', p: null, c: 'USD' }] },
];

console.log('the weekend balance');
await proof('count: cheaper, dearer and unchanged to the cent, the median change, pages with one day or two currencies left out, Amazon never', async () => {
  const b = bfcmOf(ROWS, '2026-12-01');
  assert.equal(b.pages, 4); assert.equal(b.cheaper, 2); assert.equal(b.dearer, 1); assert.equal(b.unchanged, 1);
  assert.equal(b.median_change_pct, -5); // -25, -10, 0, +10 → median of -10 and 0
  assert.equal(b.left_out, 4); // Friday only, two currencies, Monday only, no price on Monday
  assert.ok(!b.lines.some((x) => /amazon/.test(x.url)), 'no Amazon page');
  assert.ok(!b.lines.find((x) => x.name === 'No Price').counted, 'a day without a measured price is no measured day');
});
await proof('verdict: title, heading and first sentence carry the counts and the median, the left-out pages stand in the first sentence', async () => {
  const b = bfcmOf(ROWS, '2026-12-01');
  assert.equal(bfcmHeadline(b), 'Black Friday or Cyber Monday? 2 of 4 product pages were cheaper on Cyber Monday');
  assert.equal(bfcmLead(b), 'Of 4 product pages measured on the store\'s own page on both days, 2 were cheaper on Cyber Monday, 1 dearer and 1 unchanged; the median change was -5 %. 4 product pages measured on only one of the two days are left out.');
  const h = bfcmHtml(ROWS, 'https://mare.test', '2026-12-01');
  assert.match(h, /<title>Black Friday or Cyber Monday\? 2 of 4 product pages were cheaper on Cyber Monday \| Mare Liberum<\/title>/);
  assert.match(h, /<body><main><h1>Black Friday or Cyber Monday\? 2 of 4 product pages were cheaper on Cyber Monday<\/h1>\n<p class="lead">Of 4 product pages measured on the store&#39;s own page on both days, 2 were cheaper/);
});
await proof('before: Black Friday measured, Cyber Monday to follow, noindex', async () => {
  const early = ROWS.map((r) => ({ ...r, series: r.series.filter((x) => x.d < '2026-11-30') }));
  const b = bfcmOf(early, '2026-11-28');
  assert.equal(b.pages, 0); assert.equal(b.measured_black_friday, 7);
  assert.equal(bfcmHeadline(b), 'Black Friday or Cyber Monday? Measured on Black Friday (27 Nov 2026): 7 product pages');
  assert.match(bfcmLead(b), /^Measured on Black Friday \(27 Nov 2026\): 7 product pages on the store's own page; the Cyber Monday measurement follows on 30 Nov 2026/);
  assert.match(bfcmLead(bfcmOf(early, '2026-11-30')), /the Cyber Monday measurement runs today \(30 Nov 2026\)/);
  assert.equal(bfcmJson(early, '', '2026-11-28').indexable, false);
  assert.match(bfcmHtml(early, '', '2026-11-28'), /<meta name="robots" content="noindex,follow">/);
});
await proof('order: the largest fall first; Saturday only when measured; the lowest after Cyber Monday named', async () => {
  const b = bfcmOf(ROWS, '2026-12-06');
  assert.deepEqual(b.lines.filter((x) => x.counted).map((x) => x.name), ['Falls More Boot', 'Falls Jacket', 'Stays Lamp', 'Rises Mug']);
  assert.equal(b.lines.find((x) => x.name === 'Falls Jacket').saturday, 95); assert.ok(!('saturday' in b.lines.find((x) => x.name === 'Rises Mug')));
  assert.ok(!b.lines.some((x) => 'sunday' in x));
  assert.deepEqual(b.lines.find((x) => x.name === 'Falls Jacket').lowest_after_cyber_monday, { price: 80, on: '2026-12-03' });
  const h = bfcmHtml(ROWS, '', '2026-12-06');
  assert.ok(h.includes('<th>Sat</th>') && !h.includes('<th>Sun</th>') && h.includes('<th>Lowest since</th>'));
  assert.ok(h.indexOf('Falls More Boot') < h.indexOf('Falls Jacket') && h.indexOf('Falls Jacket') < h.indexOf('Rises Mug'));
});
await proof('honest: no forecast, no /mcp/app, no paid door on the page; CC BY 4.0 Dataset with the weekend as its time', async () => {
  const h = bfcmHtml(ROWS, 'https://mare.test', '2026-12-01');
  for (const w of ['Adobe', 'forecast:', '/mcp/app', '/x402/', 'amazon.com']) assert.ok(!h.toLowerCase().includes(w.toLowerCase()), w);
  assert.match(h, /"@type":"Dataset"/); assert.match(h, /"temporalCoverage":"2026-11-27\/2026-11-30"/); assert.match(h, /creativecommons\.org\/licenses\/by\/4\.0/);
  assert.match(h, /GET https:\/\/mare\.test\/deal\?url=&lt;product page&gt;/);
});
await proof('again: the second sentence says how many Black Friday pages were measured again today, right after the first; none without it', async () => {
  const a = { day: '2026-11-29', pages: 34, measured_today: 12, pending: 22, until: '2026-11-30' };
  assert.equal(bfcmAgainLine(a), '12 of the 34 product pages with a Black Friday price were measured again today (29 Nov 2026); each is measured again every day until Cyber Monday.');
  assert.equal(bfcmAgainLine(null), null); assert.equal(bfcmAgainLine({ ...a, pages: 0 }), null);
  const early = ROWS.map((r) => ({ ...r, series: r.series.filter((x) => x.d < '2026-11-30') }));
  const h = bfcmHtml(early, '', '2026-11-29', a); assert.match(h, /<p class="lead">Measured on Black Friday[^\n]*<\/p>\n<p id="again">12 of the 34 product pages/);
  const j = bfcmJson(early, '', '2026-11-29', a); assert.equal(j.again.line, bfcmAgainLine(a)); assert.equal(j.again.pending, 22);
  assert.ok(!('again' in bfcmJson(early, '', '2026-11-29')) && !bfcmHtml(early, '', '2026-11-29').includes('id="again"'), 'as before without it');
});
await proof('index: open to search engines only with 10 pages counted and Cyber Monday measured', async () => {
  const ten = Array.from({ length: 10 }, (_, i) => ({ url: P(`s${i}.shop.test`, 'x'), name: `Item ${i}`, series: s([['2026-11-27', 10 + i], ['2026-11-30', 9 + i]]) }));
  assert.equal(bfcmJson(ten, '', '2026-11-30').indexable, true);
  assert.equal(bfcmJson(ten.slice(0, 9), '', '2026-11-30').indexable, false);
  assert.ok(!bfcmHtml(ten, '', '2026-11-30').includes('noindex'));
});

// ------------------------------------------------------------------ the node: the book's state in memory, the page served
const BASE = 'https://mare.test', SITE = { '/llms.txt': { body: readFileSync(join(ROOT, 'site/llms.txt'), 'utf8'), type: 'text/plain; charset=utf-8' } };
const core = await imp('core.mjs'), { createMem } = await imp('mem.mjs'), { memoryKv } = await imp('flow.mjs');
const { immune } = await imp('immune.mjs'), { createLedger } = await imp('ledger.mjs'), { payConfig } = await imp('pay.mjs');
const dir = mkdtempSync(join(tmpdir(), 'mare-bfcm-')), file = join(dir, 'sea.tsv');
process.once('exit', () => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });
writeFileSync(file, ''); writeFileSync(join(dir, 'build.json'), JSON.stringify({ builtAt: '2026-11-20T10:00:00.000Z', entries: 0, lakes: {} }));
const SEED = [P('seed.shop.test', 'start')];
const db = createMem({ file, base: BASE }), kv = memoryKv(), ledger = createLedger({});
const cfg = { base: BASE, kv, ledger, pay: { ...payConfig({}) }, site: SITE, waitUntil: () => {}, creditSweepMs: 0, watchSeed: SEED };
const call = async (path, accept = 'application/json') => {
  const res = await core.handle(new Request(BASE + path, { headers: { accept, 'user-agent': 'bfcm-proof-agent/1.0', 'x-forwarded-for': '198.51.100.7' } }), db, cfg);
  const text = res.body ? Buffer.from(await res.arrayBuffer()).toString('utf8') : ''; let j = null; try { j = JSON.parse(text); } catch {}
  return { status: res.status, h: Object.fromEntries(res.headers), text, j };
};
await call('/stats');
immune.set({ mode: 'normal', rest: [], pace: { perMinute: 1_000_000, burst: 1_000_000 } });
const sha = (x) => createHash('sha256').update(x).digest('hex');
const put = async (url, pts, name, recId) => {
  await kv.set(`book:series:${sha(url).slice(0, 32)}`, s(pts).map((x) => ({ ...x, r: recId })), 30 * 86400);
  await kv.set(`seen:rec:${recId}`, { id: recId, store: new URL(url).hostname, product: { name, price: pts[pts.length - 1][1], currency: 'USD' } }, 30 * 86400);
};
await put(SEED[0], [['2026-11-27', 120], ['2026-11-30', 99]], 'Seed Sneaker', '1111111111111111');
await put(P('watch.shop.test', 'w'), [['2026-11-27', 70], ['2026-11-30', 77]], 'Watch Kettle', '2222222222222222');
await put(P('rest.shop.test', 'r'), [['2026-11-27', 15], ['2026-11-30', 15]], 'Resting Pen', '3333333333333333');
await put(P('old.shop.test', 'o'), [['2026-11-20', 15]], 'Old Page', '4444444444444444');
await kv.set('book:watch', [P('watch.shop.test', 'w'), P('old.shop.test', 'o')], 30 * 86400);
await kv.set('book:dry', { [P('rest.shop.test', 'r')]: { n: 2, until: '2026-12-30' } }, 30 * 86400);

await proof('served: /seen/bfcm-2026.json reads the start list, the watch and the resting pages, with product, store and record', async () => {
  T0 = D.parse('2026-12-01T09:00:00.000Z');
  const r = await call('/seen/bfcm-2026.json');
  assert.equal(r.status, 200); assert.equal(r.j.pages, 3); assert.equal(r.j.cheaper, 1); assert.equal(r.j.dearer, 1); assert.equal(r.j.unchanged, 1);
  assert.deepEqual(r.j.lines.map((x) => x.name), ['Seed Sneaker', 'Resting Pen', 'Watch Kettle']);
  assert.equal(r.j.lines[0].record, `${BASE}/seen/1111111111111111`); assert.equal(r.j.lines[0].store, 'seed.shop.test');
  assert.equal(r.j.license, 'https://creativecommons.org/licenses/by/4.0/'); assert.equal(r.h['x-robots-tag'], 'noindex'); assert.equal(r.h['access-control-allow-origin'], '*');
});
await proof('served: the page in HTML with its verdict first, the record links, noindex under 10 pages', async () => {
  const r = await call('/seen/bfcm-2026', 'text/html');
  assert.equal(r.status, 200); assert.match(r.h['content-type'], /text\/html/);
  assert.match(r.text, /<h1>Black Friday or Cyber Monday\? 1 of 3 product pages were cheaper on Cyber Monday<\/h1>\n<p class="lead">/);
  assert.ok(r.text.includes('href="/seen/1111111111111111"')); assert.ok(r.text.includes('noindex'));
  assert.ok(r.text.indexOf('<h1>') < r.text.indexOf('<nav>'), 'the links back to the sea after the balance');
});
await proof('found: /seen links the balance, llms.txt names page and data', async () => {
  const r = await call('/seen', 'text/html');
  assert.ok(r.text.includes('<a href="/seen/bfcm-2026">the weekend balance</a>'));
  const l = await call('/llms.txt', 'text/plain');
  assert.ok(l.text.includes('https://mareliberum.dev/seen/bfcm-2026 (page)') && l.text.includes('https://mareliberum.dev/seen/bfcm-2026.json (data, CC BY 4.0)'));
  assert.equal(BFCM.path, '/seen/bfcm-2026');
  assert.equal(JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).scripts['proof:bfcm'], 'node tools/bfcm-proof.mjs');
});
console.log(`\n${passed} proofs held, ${failed} failed`);

// ------------------------------------------------------------------ negative controls: each rule broken in a copy, the proof must fail there
let caught = 0, missed = 0;
if (!process.argv.includes('--no-controls')) {
  console.log('\nnegative controls: each rule broken in a copy, the proof must fail there');
  const CONTROLS = [
    ['a page with only Black Friday counted', 'node/bfcm.mjs', 'both = !!bf && !!cm && bf.c === cm.c', 'both = !!bf'],
    ['two currencies compared', 'node/bfcm.mjs', 'both = !!bf && !!cm && bf.c === cm.c', 'both = !!bf && !!cm'],
    ['an Amazon page counted', 'node/bfcm.mjs', ' && !AMAZON.test(u.hostname.toLowerCase())', ''],
    ['open to search engines under 10 pages', 'node/bfcm.mjs', 'b.pages >= BFCM.min && ', ''],
    ['the largest rise first', 'node/bfcm.mjs', 'a.counted ? a.change_pct - b.change_pct', 'a.counted ? b.change_pct - a.change_pct'],
    ['the first sentence left out of the page', 'node/bfcm.mjs', '<p class="lead">${esc(lead)}</p>\n${added', '${added'],
    ['the pages left out not said', 'node/bfcm.mjs', 'const out = b.left_out ?', 'const out = false ?'],
    ['the start list of the book not read', 'node/lens.mjs', '...(Array.isArray(seed) ? seed : []), ...(Array.isArray(watch)', '...(Array.isArray(watch)'],
    ['unchanged taken as dearer', 'node/bfcm.mjs', "cents(cm.p) > cents(bf.p) ? 'dearer' : 'unchanged'", "'dearer'"],
    ['the second sentence left out of the page', 'node/bfcm.mjs', "${aline ? `<p id=\"again\">${esc(aline)}</p>\\n` : ''}", ''],
    ['/seen without the link', 'node/seen.mjs', ' Black Friday or Cyber Monday, measured on the same pages: <a href="${SEEN.path}/bfcm-2026">the weekend balance</a>.', ''],
  ];
  for (const [name, f, from, to] of CONTROLS) {
    const d2 = mkdtempSync(join(tmpdir(), 'mare-bfcm-ctl-'));
    try {
      cpSync(ROOT, d2, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      const fp = join(d2, f), txt = readFileSync(fp, 'utf8');
      if (!txt.includes(from)) { missed++; console.log(`  FAIL control "${name}": the line to break is gone from ${f}; the control needs updating`); continue; }
      writeFileSync(fp, txt.replace(from, to));
      const r = spawnSync(process.execPath, [join(d2, 'tools/bfcm-proof.mjs'), '--no-controls'], { encoding: 'utf8', timeout: 240_000 });
      const out = `${r.stdout}${r.stderr}`, broke = (out.match(/\n  FAIL /g) || []).length;
      if (r.status !== 0 && broke > 0) { caught++; console.log(`  ok   caught: ${name} (${broke} proof${broke === 1 ? '' : 's'} failed)`); }
      else { missed++; console.log(`  FAIL control "${name}" was not caught (exit ${r.status})`); }
    } finally { try { rmSync(d2, { recursive: true, force: true }); } catch {} }
  }
  console.log(`${caught} of ${CONTROLS.length} controls caught`);
}
process.exit(failed || missed ? 1 : 0);
