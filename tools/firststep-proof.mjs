// Mare Liberum · proof of the first step (3.89, "Der erste Schritt"): an assistant that lands on an empty job list or on a
// shelf of doors learns, in the same answer, the free call that starts and the paid call that goes further. It proves,
// without the network:
//   jobs     GET /jobs with no open job carries next: paid work (/earn, /briefs), the free price check for the person with an
//            example on a real product page, the free key GET /session?as=key and how jobs come in; never the app door, never
//            a paid door; with an open job the list answers as before, without next
//   shelf    every /routes/<shelf>.json carries free_start (GET /session?as=key), paid (POST /route?q=, the price of a route
//            from the price table, the free sample, the probe call with a key, the seat on credit) and, only on a shelf of
//            things to buy (shopping, books, games), deal (GET /deal?url=<product page>, free); its doors stay as they were
//   page     /routes/<shelf> carries the same steps as one paragraph right after its first paragraph
//   calls    the named calls answer: GET /session?as=key gives a key, POST /route?q=…&free=true gives the sample, /earn and
//            /briefs answer; /routes.json keeps its shape (the TOON fixture compares it)
// Negative controls at the end: each rule broken in a copy of the code, and this proof must fail there.
// Runs without the network: node tools/firststep-proof.mjs   (exit code 1 when a proof fails or a control is not caught)
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
const { pricingOf, SEAT, CREDIT } = await imp('pricing.mjs'), { SESSION } = await imp('session.mjs'), { BUY_SHELVES } = await imp('firststep.mjs');
const { DEAL_FIRST } = await imp('pages.mjs');
const dir = mkdtempSync(join(tmpdir(), 'mare-firststep-')), file = join(dir, 'sea.tsv');
process.once('exit', () => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });
writeFileSync(file, ''); writeFileSync(join(dir, 'build.json'), JSON.stringify({ builtAt: '2026-11-20T10:00:00.000Z', entries: 0, lakes: {} }));
const db = createMem({ file, base: BASE }), kv = memoryKv(), ledger = createLedger({});
const cfg = { base: BASE, kv, ledger, pay: payConfig({}), site: SITE, waitUntil: () => {}, creditSweepMs: 0 };
let net = 0; const fresh = () => `198.51.${100 + (net >> 8)}.${++net & 255}`;
const BROWSER = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const call = async (path, { accept = 'application/json', method = 'GET', body, headers = {} } = {}) => {
  const init = { method, headers: { accept, 'user-agent': BROWSER, 'x-forwarded-for': fresh(), ...headers } };
  if (body !== undefined) { init.body = JSON.stringify(body); init.headers['content-type'] = 'application/json'; }
  const res = await core.handle(new Request(BASE + path, init), db, cfg);
  const text = res.body ? Buffer.from(await res.arrayBuffer()).toString('utf8') : ''; let j = null; try { j = JSON.parse(text); } catch {}
  return { status: res.status, h: Object.fromEntries(res.headers), text, j };
};
await call('/stats');
immune.set({ mode: 'normal', rest: [], pace: { perMinute: 1_000_000, burst: 1_000_000 } });

const KEY = `GET ${BASE}/session?as=key`, DEAL = `GET ${BASE}/deal?url=<product page>`, ROUTE = `POST ${BASE}/route?q=<your task>`;
const PRICE = pricingOf(payConfig({}), BASE).price_usd;
const unesc = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const noAppNoPaid = (o, what) => { const s = JSON.stringify(o); assert.ok(!s.includes('/mcp/app'), `${what}: never the app door`); assert.ok(!/\/x402\//.test(s), `${what}: no paid door`); };

console.log('jobs');
await proof('GET /jobs with no open job carries next: paid work, the free price check with a real example, the free key, how jobs come in', async () => {
  const r = await call('/jobs'); assert.equal(r.status, 200); assert.deepEqual(r.j.jobs, []); const n = r.j.next; assert.ok(n, 'next is there');
  assert.equal(n.paid_work.earn, `${BASE}/earn`); assert.equal(n.paid_work.briefs, `${BASE}/briefs`);
  assert.equal(n.for_your_person.call, DEAL); assert.match(n.for_your_person.cost, /^free/);
  const ex = new URL(n.for_your_person.example); assert.equal(ex.origin + ex.pathname, `${BASE}/deal`); assert.equal(ex.searchParams.get('url'), DEAL_FIRST.example); assert.match(new URL(DEAL_FIRST.example).pathname, /^\/products\//);
  assert.equal(n.free_start.call, KEY); assert.ok(n.free_start.gives.includes(`${SESSION.probe} probe calls`) && n.free_start.gives.includes(`${SESSION.probeDays} days`), 'the probe terms of a key');
  assert.match(n.jobs_come_in, new RegExp(`POST ${BASE.replace(/\./g, '\\.')}/enter`));
  noAppNoPaid(n, '/jobs next'); assert.ok(r.j.notice, 'the notice stays');
});
await proof('with an open job /jobs answers as before: the job, the notice, no next', async () => {
  const e = await call('/enter', { method: 'POST', body: { name: 'first-step-poster', offers: 'price checks for proofs' } }); assert.equal(e.status, 200); const me = e.j;
  assert.ok(me.agent && me.pass, 'a resident');
  const j = await call('/job', { method: 'POST', body: { by: me.agent, pass: me.pass, task: 'check the price of a pair of running shoes', amount: 0.5, currency: 'USDC' } }); assert.equal(j.status, 200, j.text);
  const r = await call('/jobs'); assert.equal(r.status, 200); assert.equal(r.j.jobs.length, 1); assert.equal(r.j.jobs[0].id, j.j.job.id); assert.equal(r.j.next, undefined); assert.ok(r.j.notice);
  const q = await call('/jobs?q=translation+into+japanese'); assert.deepEqual(q.j.jobs, []); assert.ok(q.j.next, 'a search that finds nothing names the next step too');
});

console.log('shelf');
for (const id of ['shopping', 'research', 'books', 'weather']) {
  const buy = BUY_SHELVES.includes(id);
  await proof(`/routes/${id}.json carries free_start and paid${buy ? ' and the free price check (a shelf of things to buy)' : ', no price check'}; its doors stay`, async () => {
    const r = await call(`/routes/${id}.json`); assert.equal(r.status, 200); const t = r.j;
    assert.deepEqual(Object.keys(t).slice(0, 5), ['id', 'title', 'doors', 'searchLinks', 'ask'], 'the card as it was, first'); assert.equal(t.id, id); assert.ok(Array.isArray(t.doors));
    assert.equal(t.free_start.call, KEY);
    assert.equal(t.paid.call, ROUTE); assert.equal(t.paid.price_usd, PRICE); assert.equal(t.paid.free_sample, `${ROUTE}&free=true gives the first 3`);
    assert.match(t.paid.with_key, /x-sea-session: <key>/); assert.ok(t.paid.on_credit.includes(`POST ${BASE}/seat`) && t.paid.on_credit.includes(`${SEAT.cents / 100} USD`) && t.paid.on_credit.includes(`${CREDIT.dueDays} days`), 'the seat on credit');
    if (buy) { assert.equal(t.deal.call, DEAL); assert.match(t.deal.cost, /^free/); } else assert.equal(t.deal, undefined, 'no price check on a shelf without purchases');
    noAppNoPaid(t, `/routes/${id}`);
  });
}
await proof('every shelf of things to buy is a shelf of /routes.json, and /routes.json keeps its shape', async () => {
  const r = await call('/routes.json'); assert.equal(r.status, 200); const ids = r.j.topics.map((t) => t.id);
  for (const id of BUY_SHELVES) assert.ok(ids.includes(id), id);
  const fx = JSON.parse(readFileSync(join(ROOT, 'tools/fixtures/toon/sea/routes.json'), 'utf8'));
  assert.deepEqual(Object.keys(r.j.topics[0]).sort(), Object.keys(fx.topics[0]).sort()); assert.ok(!('free_start' in r.j) && !('free_start' in r.j.topics[0]), 'the list of shelves is unchanged');
  assert.equal((await call('/routes/nope.json')).status, 404);
});

console.log('page');
for (const id of ['shopping', 'research']) {
  await proof(`/routes/${id} carries the steps as one paragraph right after its first paragraph`, async () => {
    const r = await call(`/routes/${id}`, { accept: 'text/html' }); assert.equal(r.status, 200); assert.match(r.h['content-type'], /^text\/html/);
    const m = /<\/h1>\s*<p>Doors that answer[\s\S]*?<\/p>(<p id="next-step">[\s\S]*?<\/p>)/.exec(r.text); assert.ok(m, 'the paragraph right after the first one');
    const p = unesc(m[1]); assert.ok(p.includes(KEY), 'the free key'); assert.ok(p.includes(ROUTE) && p.includes(`${PRICE} USDC`), 'the paid route and its price');
    if (id === 'shopping') assert.ok(p.includes(DEAL), 'the price check'); else assert.ok(!p.includes('/deal?url='), 'no price check');
    assert.ok(!p.includes('/mcp/app'), 'never the app door');
  });
}

console.log('calls');
await proof('the named calls answer: a key from GET /session?as=key, the free sample of POST /route, /earn and /briefs', async () => {
  const k = await call('/session?as=key'); assert.ok([200, 201].includes(k.status), k.text); assert.match(k.j.key, /^mls_/);
  const s = await call('/route?q=find+a+dataset+of+weather+stations&free=true', { method: 'POST' }); assert.equal(s.status, 200, s.text);
  assert.equal((await call('/earn.json')).status, 200); assert.equal((await call('/briefs.json')).status, 200);
});

console.log(`\n${passed} of ${passed + failed} proofs passed`);

// ------------------------------------------------------------------ negative controls: each rule broken in a copy, the proof must fail there
let caught = 0, missed = 0;
if (!process.argv.includes('--no-controls')) {
  console.log('\nnegative controls: each rule broken in a copy, the proof must fail there');
  const CONTROLS = [
    ['/jobs without next', 'node/core.mjs', 'return json(r.jobs?.length ? r : { ...r, next: jobsNext(', 'return json(r.jobs?.length || true ? r : { ...r, next: jobsNext('],
    ['next on a list with jobs', 'node/core.mjs', 'return json(r.jobs?.length ? r : { ...r, next: jobsNext(', 'return json(false ? r : { ...r, next: jobsNext('],
    ['a shelf without free_start', 'node/firststep.mjs', '  return {\n    free_start: freeStart(b, { probe, probeDays }),\n    paid: {', '  return {\n    paid: {'],
    ['the price check on every shelf', 'node/firststep.mjs', '...(BUY_SHELVES.includes(id) ? { deal: dealStep(b) } : {}),', 'deal: dealStep(b),'],
    ['a price of its own instead of the price table', 'node/core.mjs', 'routeUsd: pricingOf(payCfg, base).price_usd', 'routeUsd: 0.5'],
    ['the page without the paragraph', 'node/pages.mjs', '${shelfNextHtml(t, esc)}', ''],
    ['the app door in next', 'node/firststep.mjs', 'earn: `${b}/earn`,', 'earn: `${b}/mcp/app`,'],
  ];
  for (const [name, f, from, to] of CONTROLS) {
    const d2 = mkdtempSync(join(tmpdir(), 'mare-firststep-ctl-'));
    try {
      cpSync(ROOT, d2, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      const fp = join(d2, f), txt = readFileSync(fp, 'utf8');
      if (!txt.includes(from)) { missed++; console.log(`  FAIL control "${name}": the line to break is gone from ${f}; the control needs updating`); continue; }
      writeFileSync(fp, txt.replace(from, to));
      const r = spawnSync(process.execPath, [join(d2, 'tools/firststep-proof.mjs'), '--no-controls'], { encoding: 'utf8', timeout: 240_000, env: { ...process.env, NODE_PATH: join(ROOT, 'node_modules') } });
      const out = `${r.stdout}${r.stderr}`, broke = (out.match(/\n  FAIL /g) || []).length;
      if (r.status !== 0 && broke > 0) { caught++; console.log(`  ok   caught: ${name} (${broke} proof${broke === 1 ? '' : 's'} failed)`); }
      else { missed++; console.log(`  FAIL control "${name}" was not caught (exit ${r.status})`); }
    } finally { try { rmSync(d2, { recursive: true, force: true }); } catch {} }
  }
  console.log(`${caught} of ${CONTROLS.length} controls caught`);
}
process.exit(failed || missed ? 1 : 0);
