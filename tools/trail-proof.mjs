// Mare Liberum · proof of the way on from a price history (3.90, "Der Weg nach vorn"): the pages ChatGPT search reads
// most lead somewhere. It proves, without the network:
//   history  GET /history/<need> (and .json) carries next before the readings: buy (/buy/<need>) for a need the sea knows,
//            the free price check GET /deal?url=<product page> with a real example, the weekend balance /seen/bfcm-2026 and
//            the free key GET /session?as=key; an unknown need gets no buy; the readings stay as they were
//   list     GET /history carries the same next once, with the index of needs (/buy), and its list of needs as before
//   page     a reader that asks for HTML gets a page: the lowest offer seen in the title, the heading and the first sentence,
//            the next steps right after it, the readings newest first; noindex below 3 readings; JSON stays JSON for
//            everyone else (and always for .json)
//   atlas    /atlas/countries.json carries next (GET /site/<domain>, the free price check, the free key); the country page
//            carries the same as one paragraph right after its first paragraph, and without next it is as it was
//   never    no next points at /mcp/app or at a paid door
// Negative controls at the end: each rule broken in a copy of the code, and this proof must fail there.
// Runs without the network: node tools/trail-proof.mjs   (exit code 1 when a proof fails or a control is not caught)
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
let passed = 0, failed = 0;
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
const { SESSION } = await imp('session.mjs'), { DEAL_FIRST, countryPage } = await imp('pages.mjs'), { NEEDS } = await imp('needs.mjs');
const { historyOf, atlasNext } = await imp('trail.mjs');
const dir = mkdtempSync(join(tmpdir(), 'mare-trail-')), file = join(dir, 'sea.tsv');
process.once('exit', () => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });
writeFileSync(file, ''); writeFileSync(join(dir, 'build.json'), JSON.stringify({ builtAt: '2026-11-20T10:00:00.000Z', entries: 0, lakes: {} }));
const db = createMem({ file, base: BASE }), kv = memoryKv(), ledger = createLedger({});
const cfg = { base: BASE, kv, ledger, pay: payConfig({}), site: SITE, waitUntil: () => {}, creditSweepMs: 0 };
let net = 0; const fresh = () => `198.51.${100 + (net >> 8)}.${++net & 255}`;
const BOT = 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; OAI-SearchBot/1.3; +https://openai.com/searchbot)';
const call = async (path, { accept = 'application/json', headers = {} } = {}) => {
  const res = await core.handle(new Request(BASE + path, { headers: { accept, 'user-agent': BOT, 'x-forwarded-for': fresh(), ...headers } }), db, cfg);
  const text = res.body ? Buffer.from(await res.arrayBuffer()).toString('utf8') : ''; let j = null; try { j = JSON.parse(text); } catch {}
  return { status: res.status, h: Object.fromEntries(res.headers), text, j };
};
await call('/stats');
immune.set({ mode: 'normal', rest: [], pace: { perMinute: 1_000_000, burst: 1_000_000 } });

// the readings of one need, as the current keeps them (node/eco.mjs hist:<slug>): one in another currency, one without a lowest
const ROWS = [
  { t: '2026-11-25T08:00:00.000Z', price: 60, currency: 'EUR', min: 30, store: 'Euro Shop' },
  { t: '2026-11-26T09:00:00.000Z', price: 52, currency: 'USD', min: 49, store: 'Shop A' },
  { t: '2026-11-27T09:00:00.000Z', price: 46, currency: 'USD', min: 41, store: 'Shop B' },
  { t: '2026-11-27T21:00:00.000Z', price: 47, currency: 'USD', min: 44, store: 'Shop B' },
  { t: '2026-11-28T09:00:00.000Z', price: 50, currency: 'USD', store: 'Shop C' },
];
await kv.set('hist:running-shoes', ROWS, 3600); await kv.set('hist:sneakers', ROWS.slice(-2), 3600);
assert.ok(NEEDS.includes('running shoes') && NEEDS.includes('sneakers'), 'the needs of the proof are needs of the sea');

const KEY = `GET ${BASE}/session?as=key`, DEAL = `GET ${BASE}/deal?url=<product page>`;
const unesc = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const never = (o, what) => { const s = JSON.stringify(o); assert.ok(!s.includes('/mcp/app'), `${what}: never the app door`); assert.ok(!/\/x402\//.test(s), `${what}: no paid door`); };
const stepsOf = (n, { buy }) => {
  if (buy) assert.equal(n.buy.page, buy); else assert.equal(n.buy, undefined, 'no buy page for a need the sea does not know');
  assert.equal(n.check_price.call, DEAL); assert.match(n.check_price.cost, /^free/);
  const ex = new URL(n.check_price.example); assert.equal(ex.origin + ex.pathname, `${BASE}/deal`); assert.equal(ex.searchParams.get('url'), DEAL_FIRST.example);
  assert.equal(n.bfcm.page, `${BASE}/seen/bfcm-2026`);
  assert.equal(n.free_start.call, KEY); assert.ok(n.free_start.gives.includes(`${SESSION.probe} probe calls`) && n.free_start.gives.includes(`${SESSION.probeDays} days`), 'the probe terms of a key');
};

console.log('history');
for (const p of ['/history/running-shoes', '/history/running-shoes.json']) {
  await proof(`GET ${p} carries next before the readings: its offers, the free price check, the weekend balance, the free key`, async () => {
    const r = await call(p); assert.equal(r.status, 200); assert.match(r.h['content-type'], /^application\/json/);
    assert.deepEqual(Object.keys(r.j), ['need', 'next', 'history'], 'next stands before the readings'); assert.equal(r.j.need, 'running-shoes');
    assert.deepEqual(r.j.history, ROWS, 'the readings stay as they were'); stepsOf(r.j.next, { buy: `${BASE}/buy/running-shoes` }); never(r.j.next, p);
  });
}
await proof('an unknown need gets next without a buy page, and no readings', async () => {
  const r = await call('/history/no-such-need-here'); assert.equal(r.status, 200); assert.deepEqual(r.j.history, []); stepsOf(r.j.next, { buy: null });
});
await proof('a .json history answers JSON even to a reader that asks for HTML', async () => {
  const r = await call('/history/running-shoes.json', { accept: 'text/html' }); assert.match(r.h['content-type'], /^application\/json/); assert.ok(r.j.next);
});

console.log('list');
await proof('GET /history carries next once (the index of needs in place of one need) and its list of needs as before', async () => {
  for (const p of ['/history', '/history.json']) {
    const r = await call(p); assert.equal(r.status, 200); assert.match(r.h['content-type'], /^application\/json/);
    assert.equal(r.j.needs.length, NEEDS.length); assert.deepEqual(r.j.needs[0], { need: NEEDS[0], history: `${BASE}/history/${r.j.needs[0].history.split('/').pop()}` });
    stepsOf(r.j.next, { buy: `${BASE}/buy` }); never(r.j.next, p);
  }
  const h = await call('/history', { accept: 'text/html' }); assert.match(h.h['content-type'], /^text\/html/); assert.match(h.h.vary, /(^|, )accept(,|$)/);
  const m = /<\/h1>\s*<p class="lead">[\s\S]*?<\/p>\s*(<p id="next-step">[\s\S]*?<\/p>)/.exec(h.text); assert.ok(m, 'the steps right after the first paragraph');
  const p = unesc(m[1]); assert.ok(p.includes(KEY) && p.includes(DEAL) && p.includes(`${BASE}/buy`) && p.includes(`${BASE}/seen/bfcm-2026`));
  assert.ok(h.text.includes('href="/history/running-shoes"') && h.text.includes('href="/buy/running-shoes"'), 'every need links its history and its offers');
});

console.log('page');
await proof('the history of a need as a page: the lowest offer seen in the title, the heading and the first sentence, then the steps', async () => {
  const r = await call('/history/running-shoes', { accept: 'text/html,application/xhtml+xml' }); assert.equal(r.status, 200); assert.match(r.h['content-type'], /^text\/html/); assert.match(r.h.vary, /(^|, )accept(,|$)/);
  const title = unesc(/<title>([^<]*)<\/title>/.exec(r.text)[1]), h1 = unesc(/<h1>([^<]*)<\/h1>/.exec(r.text)[1]);
  assert.equal(h1, 'Running shoes price history: lowest offer 41 USD (2026-11-27)', 'the lowest offer in the latest currency, the reading without a lowest counts its pick');
  assert.ok(title.startsWith(h1), 'the title carries the heading');
  const lead = unesc(/<\/h1>\s*<p class="lead">([^<]*)<\/p>/.exec(r.text)[1]);
  assert.ok(lead.startsWith('5 readings of running shoes since 2026-11-25'), lead); assert.ok(lead.includes('picked 50 USD at Shop C') && lead.includes('the lowest offer seen was 41 USD on 2026-11-27'), lead);
  assert.ok(lead.includes('On Black Friday (2026-11-27) the lowest offer was 41 USD.'), lead); assert.ok(!lead.includes('30 EUR') && !lead.includes('EUR'), 'another currency never mixes in');
  const m = /<p class="lead">[\s\S]*?<\/p>\s*(<p id="next-step">[\s\S]*?<\/p>)/.exec(r.text); assert.ok(m, 'the steps right after the first sentence');
  const p = unesc(m[1]); assert.ok(p.includes(`${BASE}/buy/running-shoes`) && p.includes(DEAL) && p.includes(KEY) && p.includes(`${BASE}/seen/bfcm-2026`), p); assert.ok(!p.includes('/mcp/app') && !p.includes('/x402/'));
  const cells = [...r.text.matchAll(/<tr><td[^>]*>([^<]*)<\/td>/g)].map((x) => x[1]); assert.deepEqual(cells, ['2026-11-28 09:00 UTC', '2026-11-27 21:00 UTC', '2026-11-27 09:00 UTC', '2026-11-26 09:00 UTC', '2026-11-25 08:00 UTC'], 'newest first');
  assert.ok(!/<meta name="robots"/.test(r.text), 'open to search engines with 3 readings or more'); assert.ok(r.text.includes('"@type":"Dataset"') && r.text.includes('creativecommons.org/licenses/by/4.0'));
  assert.ok(r.text.includes(`href="${BASE}/history/running-shoes.json"`), 'the data linked');
});
await proof('a page with fewer than 3 readings is noindex; a need with none says so in its heading', async () => {
  const a = await call('/history/sneakers', { accept: 'text/html' }); assert.match(a.text, /<meta name="robots" content="noindex,follow">/);
  const b = await call('/history/no-such-need-here', { accept: 'text/html' }); assert.equal(b.status, 200); assert.match(b.text, /<meta name="robots" content="noindex,follow">/);
  assert.match(unesc(/<h1>([^<]*)<\/h1>/.exec(b.text)[1]), /^No such need here price history: no readings yet$/); assert.ok(!b.text.includes('/buy/no-such-need-here'), 'no buy page for an unknown need');
});
await proof('historyOf counts only readings with a price, a currency and a time', () => {
  const h = historyOf([{ t: '2026-11-27T01:00:00Z', price: 0, currency: 'USD' }, { t: '2026-11-27T02:00:00Z', price: 9, currency: '' }, { price: 9, currency: 'USD' }, { t: '2026-11-28T01:00:00Z', price: 12, currency: 'USD', min: 11 }]);
  assert.equal(h.readings, 1); assert.equal(h.lowest.price, 11); assert.equal(h.black_friday, null);
  assert.equal(historyOf(null).readings, 0);
});

console.log('atlas');
await proof('/atlas/countries.json carries next: how an agent reads a site, the free price check, the free key', async () => {
  const r = await call('/atlas/countries.json'); assert.equal(r.status, 200); assert.ok(Array.isArray(r.j.countries)); const n = r.j.next;
  assert.equal(n.site.call, `GET ${BASE}/site/<domain>`); assert.equal(n.check_price.call, DEAL); assert.equal(n.free_start.call, KEY); never(n, '/atlas/countries');
});
await proof('a country page carries the steps right after its first paragraph; without next it is as it was', () => {
  const c = { cc: 'de', month: '202610', top: 2, count: 2, looked: 2, mapped: 1, sites: [{ site: 'good-shop.com', mapped: true, ok: true, grade: 'B' }, { site: 'unmapped.example', mapped: false, ok: false }] };
  const plain = countryPage(BASE, c), withNext = countryPage(BASE, { ...c, next: atlasNext(BASE, { probe: SESSION.probe, probeDays: SESSION.probeDays }) });
  assert.ok(!plain.includes('id="next-step"'));
  const m = /<p class="pulse">[\s\S]*?<\/p>\s*(<p id="next-step">[\s\S]*?<\/p>)<table>/.exec(withNext); assert.ok(m, 'the paragraph right after the first one');
  const p = unesc(m[1]); assert.ok(p.includes(`GET ${BASE}/site/<domain>`) && p.includes(DEAL) && p.includes(KEY)); assert.ok(!p.includes('/mcp/app'));
  assert.equal(withNext.replace(m[1], ''), plain, 'nothing else changes');
});

console.log(`\n${passed} of ${passed + failed} proofs passed`);

// ------------------------------------------------------------------ negative controls: each rule broken in a copy, the proof must fail there
let caught = 0, missed = 0;
if (!process.argv.includes('--no-controls')) {
  console.log('\nnegative controls: each rule broken in a copy, the proof must fail there');
  const CONTROLS = [
    ['a history without next', 'node/core.mjs', 'json({ need: slug, next: nx, history: rows }', 'json({ need: slug, history: rows }'],
    ['next after the readings', 'node/core.mjs', 'json({ need: slug, next: nx, history: rows }', 'json({ need: slug, history: rows, next: nx }'],
    ['a buy page for every need', 'node/trail.mjs', '...(need ? { buy: {', '...(true ? { buy: {'],
    ['the lowest offer across currencies', 'node/trail.mjs', 'same = pts.filter((x) => x.currency === last.currency)', 'same = pts'],
    ['a page open to search engines with one reading', 'node/trail.mjs', "const robots = h.readings >= HISTORY.index ? ''", "const robots = h.readings >= 1 ? ''"],
    ['the page without the steps', 'node/trail.mjs', '<p class="lead">${esc(lead)}</p>\n${nextHtml(nx)}\n${pts.length', '<p class="lead">${esc(lead)}</p>\n\n${pts.length'],
    ['HTML for a .json history', 'node/core.mjs', 'const res = !asJ && /text\\/html/.test(accept)', 'const res = /text\\/html/.test(accept)'],
    ['the app door in next', 'node/trail.mjs', "site: { call: `GET ${b}/site/<domain>`", "site: { call: `GET ${b}/mcp/app`"],
    ['the country page without the steps', 'node/pages.mjs', '${nextHtml(c.next)}<table>', '<table>'],
  ];
  for (const [name, f, from, to] of CONTROLS) {
    const d2 = mkdtempSync(join(tmpdir(), 'mare-trail-ctl-'));
    try {
      cpSync(ROOT, d2, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      const fp = join(d2, f), txt = readFileSync(fp, 'utf8');
      if (!txt.includes(from)) { missed++; console.log(`  FAIL control "${name}": the line to break is gone from ${f}; the control needs updating`); continue; }
      writeFileSync(fp, txt.replace(from, to));
      const r = spawnSync(process.execPath, [join(d2, 'tools/trail-proof.mjs'), '--no-controls'], { encoding: 'utf8', timeout: 240_000, env: { ...process.env, NODE_PATH: join(ROOT, 'node_modules') } });
      const out = `${r.stdout}${r.stderr}`, broke = (out.match(/\n  FAIL /g) || []).length;
      if (r.status !== 0 && broke > 0) { caught++; console.log(`  ok   caught: ${name} (${broke} proof${broke === 1 ? '' : 's'} failed)`); }
      else { missed++; console.log(`  FAIL control "${name}" was not caught (exit ${r.status})`); }
    } finally { try { rmSync(d2, { recursive: true, force: true }); } catch {} }
  }
  console.log(`${caught} of ${CONTROLS.length} controls caught`);
}
process.exit(failed || missed ? 1 : 0);
