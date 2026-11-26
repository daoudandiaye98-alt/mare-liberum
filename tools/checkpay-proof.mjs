// Mare Liberum · proof of the paid check (3.56, node/checkpay.mjs; 0.01 USDC since 3.57): how AI agents see a website, as data, over x402
// in one step, at its own door and at /check past the free checks of the hour.
// It proves, on a node in this process (handle, as serve.mjs answers), with a stubbed web, facilitator and DNS (no network):
//   asking: GET and POST /x402/check without a payment answer 402 with the exact terms (PAYMENT-REQUIRED v2 with the bazaar
//   extension and its JSON Schema, the v1 body discoverable), 0.01 USDC to the till's wallet; /openapi.json, the guide,
//   /discovery/resources and /.well-known/x402 name the door; every 402 without a payment is counted in the funnel
//   paying: only a signed transfer of exactly 0.01 USDC to the till's wallet (the five cents of before, another wallet: refused,
//   the facilitator not asked); a payment buys once; a missing site or a site that cannot be checked is never charged (the
//   claim given back, the same payment then buys a check); strict (refused, no verdict: nothing delivered)
//   delivering: the check with its score and fixes, settled, the sale in the till's books (check: <host>), counted in the funnel
//   the free door: /check stays free (its page for people too); past the 20 free checks of the hour its JSON answer is a 402
//   with the terms of that site (not listed in the indexes) beside the words of before, and one payment there buys the check;
//   a paid check is not one of the free checks of the hour
// Negative controls at the end: each rule broken in a copy of the code, and this proof must fail there.
// Runs without the network: node tools/checkpay-proof.mjs   (exit code 1 when a proof fails or a control is not caught)
//   --no-controls   only the proofs (the controls run this file that way in each broken copy)
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, cpSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { Buffer } from 'node:buffer';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const k of ['MARE_TOLL', 'MARE_ENGINE', 'MARE_FAIR', 'MARE_X402_FACILITATOR', 'MARE_PAY_TO', 'MARE_ROUTE_PRICE_CENTS', 'MARE_STATE', 'MARE_DB_URL', 'MARE_DB_KEY', 'MARE_DB_SECRET', 'MARE_BASE_RPC']) delete process.env[k];
process.env.MARE_VIA_SECRET = 'checkpay-proof-via-key, a test value';
let passed = 0, failed = 0;
const D = globalThis.Date; let T0 = D.parse('2026-11-26T13:00:00.000Z');
class Clock extends D { constructor(...a) { if (a.length) super(...a); else super(T0); } static now() { return T0; } }
globalThis.Date = Clock;
const proof = async (name, fn) => { T0 += 60_000; try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 6).join('\n       ')}`); } };

// ------------------------------------------------------------------ the world: sites, DNS, a facilitator
const FAC = 'https://facilitator.checkpay-proof.dev';
const HOME = `<!doctype html><html lang="en"><head><title>Harbour shop</title><meta name="description" content="Ropes and sails for every harbour"><script type="application/ld+json">{"@type":"Organization","name":"Harbour shop"}</script></head><body><main><h1>Harbour shop</h1>${Array.from({ length: 30 }, (_, i) => `<p>Rope number ${i + 1} holds a boat of ${i + 2} tons in a storm, and the sail beside it is cut from canvas that lasts ten summers.</p>`).join('')}</main></body></html>`;
const asked = [];
let facilitator = null;
const answer = (j, status = 200) => new Response(JSON.stringify(j), { status, headers: { 'content-type': 'application/json' } });
globalThis.fetch = async (u, o = {}) => {
  const s = String(u?.url ?? u);
  if (s.startsWith(FAC)) { const kind = s.slice(FAC.length + 1), body = JSON.parse(o.body); asked.push({ kind, body }); if (!facilitator) throw new Error('the facilitator must not be asked'); return facilitator(kind, body); }
  const url = new URL(s);
  if (!url.hostname.endsWith('.checkpay-proof.dev')) throw new Error(`the proof does not use the network: ${s.slice(0, 80)}`);
  if (url.pathname === '/robots.txt') return new Response('User-agent: *\nAllow: /\nSitemap: https://example.invalid/sitemap.xml\n', { status: 200, headers: { 'content-type': 'text/plain' } });
  if (url.pathname === '/llms.txt') return new Response('# Harbour shop\n\nRopes and sails; the catalogue is at /catalogue.\n', { status: 200, headers: { 'content-type': 'text/plain' } });
  if (url.pathname === '/') return new Response(HOME, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
  return new Response('not here', { status: 404, headers: { 'content-type': 'text/plain' } });
};
// a name under gone. leads to no public address: such a site cannot be checked
createRequire(import.meta.url)('node:dns').promises.lookup = async (host) => (String(host).startsWith('gone.') ? [{ address: '10.0.0.7', family: 4 }] : [{ address: '93.184.216.34', family: 4 }]);
for (const k of ['error', 'warn', 'info']) console[k] = () => {};
const PAYER = '0x2222222222222222222222222222222222222222';
const settles = () => (kind) => answer(kind === 'verify' ? { isValid: true, payer: PAYER } : { success: true, transaction: `0x${randomBytes(32).toString('hex')}`, network: 'eip155:8453', payer: PAYER });

// ------------------------------------------------------------------ the node
const BASE = 'https://mare.test', SITE = { '/llms.txt': { body: readFileSync(join(ROOT, 'site/llms.txt'), 'utf8'), type: 'text/plain; charset=utf-8' } };
const imp = (f) => import(pathToFileURL(join(ROOT, 'node', f)).href);
const core = await imp('core.mjs'), { createMem } = await imp('mem.mjs'), { memoryKv } = await imp('flow.mjs');
const { immune } = await imp('immune.mjs'), { createLedger } = await imp('ledger.mjs'), { payConfig } = await imp('pay.mjs');
const dir = mkdtempSync(join(tmpdir(), 'mare-checkpay-')), file = join(dir, 'sea.tsv');
process.once('exit', () => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });
writeFileSync(file, ''); writeFileSync(join(dir, 'build.json'), JSON.stringify({ builtAt: '2026-11-20T10:00:00.000Z', entries: 0, lakes: {} }));
const db = createMem({ file, base: BASE }), kv = memoryKv(), ledger = createLedger({}), waits = [];
const PAY = { ...payConfig({}), facilitator: FAC, settleWaitMs: 300, verifyMs: 800, settleMs: 4000 };
const cfg = { base: BASE, kv, ledger, pay: PAY, site: SITE, waitUntil: (p) => { waits.push(p); }, creditSweepMs: 0 };
const call = async (path, { method = 'GET', accept = 'application/json', ip, headers = {}, body } = {}) => {
  const h = { accept, 'user-agent': 'checkpay-proof-agent/1.0', 'x-forwarded-for': ip, ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers };
  const res = await core.handle(new Request(BASE + path, { method, headers: h, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }), db, cfg);
  const text = res.body ? Buffer.from(await res.arrayBuffer()).toString('utf8') : ''; let j = null; try { j = JSON.parse(text); } catch {}
  return { status: res.status, h: Object.fromEntries(res.headers), text, j };
};
await call('/stats', { ip: '127.0.0.1' });
immune.set({ mode: 'normal', rest: [], pace: { perMinute: 1_000_000, burst: 1_000_000 } });
const WALLET = PAY.payTo, USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
let net = 0, site = 0; const fresh = () => `198.51.100.${++net}`, host = () => `s${++site}.checkpay-proof.dev`;
const payment = ({ value = '10000', to = WALLET, version = 2, nonce = `0x${randomBytes(32).toString('hex')}` } = {}) => {
  const authorization = { from: PAYER, to, value: String(value), validAfter: '0', validBefore: String(Math.floor(T0 / 1000) + 300), nonce };
  const inner = { signature: `0x${'ab'.repeat(65)}`, authorization };
  const p = version === 2 ? { x402Version: 2, accepted: { scheme: 'exact', network: 'eip155:8453', amount: String(value), asset: USDC, payTo: to }, payload: inner } : { x402Version: 1, scheme: 'exact', network: 'base', payload: inner };
  return { [version === 2 ? 'payment-signature' : 'x-payment']: Buffer.from(JSON.stringify(p)).toString('base64') };
};
const required = (r) => JSON.parse(Buffer.from(r.h['payment-required'], 'base64').toString('utf8'));
const funnel = async () => (await call('/funnel.json', { ip: '127.0.0.1' })).j;
// the free checks of the hour of one network, spent on sites that answer
const spend = async (ip) => { for (let i = 0; i < 20; i++) { T0 += 500; const r = await call(`/check?site=${host()}&format=json`, { ip }); assert.equal(r.status, 200, `free check ${i + 1}: ${r.text.slice(0, 120)}`); assert.equal(typeof r.j.score, 'number'); } };

console.log('asking');
await proof('GET /x402/check without a payment: 402, exactly 0.01 USDC to the till (0.05 until 3.57), v2 with the bazaar extension and its JSON Schema, v1 discoverable; counted', async () => {
  facilitator = null; const before = (await funnel()).asked.check || 0;
  const r = await call(`/x402/check?site=${host()}`, { ip: fresh() });
  assert.equal(r.status, 402);
  const v2 = required(r); assert.equal(v2.x402Version, 2); assert.equal(v2.accepts[0].amount, '10000'); assert.equal(v2.accepts[0].payTo, WALLET); assert.equal(v2.resource.url, `${BASE}/x402/check`);
  assert.equal(v2.extensions.bazaar.info.input.method, 'GET'); assert.equal(v2.extensions.bazaar.schema.properties.input.properties.queryParams.properties.site.type, 'string');
  assert.equal(r.j.accepts[0].maxAmountRequired, '10000'); assert.equal(r.j.accepts[0].outputSchema.input.discoverable, true); assert.equal(r.j.amount_usd, '0.010000');
  const p = await call('/x402/check', { method: 'POST', ip: fresh(), body: { site: host() } }); assert.equal(p.status, 402);
  assert.equal((await funnel()).asked.check, before + 2); assert.equal((await funnel()).doors.check, `GET ${BASE}/x402/check?site=<domain>`);
});
await proof('/openapi.json names GET /x402/check (x-payment-info 0.01 USD, its 402) and the guide five sold doors; /discovery/resources and /.well-known/x402 list it', async () => {
  const o = await call('/openapi.json', { ip: '127.0.0.1' }), op = o.j.paths['/x402/check']?.get;
  assert.ok(op); assert.deepEqual(op['x-payment-info'], { price: { mode: 'fixed', currency: 'USD', amount: '0.01' }, protocols: [{ x402: {} }] }); assert.ok(op.responses['402']); assert.equal(op.security, undefined);
  assert.match(o.j.info['x-guidance'], /Five doors are sold/); assert.match(o.j.info['x-guidance'], /\/x402\/check\?site=<domain>/);
  const d = await call('/discovery/resources', { ip: '127.0.0.1' }), it = d.j.items.find((x) => x.resource === `${BASE}/x402/check`);
  assert.ok(it); assert.equal(it.accepts[0].amount, '10000'); assert.ok(it.extensions.bazaar.info.output.example.score); assert.equal(d.j.pagination.total, d.j.items.length);
  const w = await call('/.well-known/x402', { ip: '127.0.0.1' }); assert.ok(w.j.resources.includes(`${BASE}/x402/check`)); const blk = w.j.pricing.find((p) => p.capability === 'check');
  assert.equal(blk.amount_usd, '0.01'); assert.equal(blk.maxAmountRequired, '10000'); assert.equal(blk.payTo, WALLET); assert.match(w.j.instructions, /four moves/);
});

console.log('paying');
await proof('another amount (the five cents of before too) or another wallet is refused before the facilitator is asked', async () => {
  facilitator = null; asked.length = 0;
  const a = await call(`/x402/check?site=${host()}`, { ip: fresh(), headers: payment({ value: '50000' }) });
  const b = await call(`/x402/check?site=${host()}`, { ip: fresh(), headers: payment({ to: '0x3333333333333333333333333333333333333333' }) });
  const c = await call(`/x402/check?site=${host()}`, { ip: fresh(), headers: payment({ value: '20000', version: 1 }) });
  assert.equal(a.status, 402); assert.match(a.j.error, /a paid check costs exactly 0\.010000/); assert.equal(b.status, 402); assert.match(b.j.error, /another wallet/); assert.equal(c.status, 402); assert.match(c.j.error, /exactly 0\.010000/);
  assert.equal(asked.length, 0);
});
await proof('a payment without a site, or for a site that cannot be checked, is never charged; its claim is given back and buys a check afterwards', async () => {
  facilitator = null; asked.length = 0; const pay = payment(), ip = fresh();
  const a = await call('/x402/check', { ip, headers: pay }); assert.equal(a.status, 400); assert.match(a.j.error.message, /Nothing was charged/);
  const b = await call('/x402/check?site=gone.checkpay-proof.dev', { ip, headers: pay }); assert.ok(b.status === 422 || b.status === 400, `an unreachable site: ${b.status}`); assert.match(b.j.error.message, /Nothing was charged/);
  assert.equal(asked.length, 0);
  facilitator = settles(); const c = await call(`/x402/check?site=${host()}`, { ip, headers: pay }); assert.equal(c.status, 200, c.text.slice(0, 200));
});

await proof('strict: a refused payment and a payment without a verdict deliver nothing', async () => {
  facilitator = (kind) => answer(kind === 'verify' ? { isValid: false, invalidReason: 'insufficient_funds' } : { success: false });
  const a = await call(`/x402/check?site=${host()}`, { ip: fresh(), headers: payment() });
  assert.equal(a.status, 402); assert.match(a.j.error, /not accepted/); assert.equal(a.j.score, undefined);
  facilitator = () => answer({ error: 'busy' }, 500);
  const b = await call(`/x402/check?site=${host()}`, { ip: fresh(), headers: payment() });
  assert.equal(b.status, 402); assert.match(b.j.error, /nothing was charged/); assert.equal(b.j.score, undefined);
});
console.log('delivering');
await proof('a paid check: score and fixes, settled, in the till\'s books with the host only, counted in the funnel; a payment buys once', async () => {
  facilitator = settles(); asked.length = 0;
  const f0 = await funnel(), t0 = await ledger.treasury(), h = host(), pay = payment(), ip = fresh();
  const r = await call(`/x402/check?site=https://${h}/some/page`, { ip, headers: pay });
  assert.equal(r.status, 200, r.text.slice(0, 300));
  assert.equal(r.j.host, h); assert.equal(typeof r.j.score, 'number'); assert.ok(r.j.score >= 50, `score ${r.j.score}`); assert.ok(Array.isArray(r.j.parts)); assert.equal(r.j.offers, undefined); assert.equal(r.j.page, `${BASE}/check/${h}`);
  assert.equal(r.j.paid.status, 'settled'); assert.equal(r.j.paid.amount_usd, '0.010000'); assert.ok(r.h['payment-response']); assert.deepEqual(asked.map((x) => x.kind), ['verify', 'settle']);
  const t1 = await ledger.treasury(); assert.equal(t1.total_count, (t0.total_count || 0) + 1);
  const sale = (t1.last_5 || []).find((s) => s.q === `check: ${h}`); assert.ok(sale, JSON.stringify(t1.last_5)); assert.equal(sale.amount_usd, 0.01);
  const f1 = await funnel(); assert.equal(f1.paid.check, (f0.paid.check || 0) + 1); assert.equal(Number(f1.paid_usd), Number(f0.paid_usd) + 0.01);
  asked.length = 0; const again = await call(`/x402/check?site=${host()}`, { ip, headers: pay }); assert.equal(again.status, 402); assert.match(again.j.error, /buys once/); assert.equal(asked.length, 0);
});

console.log('the free door past its free checks');
await proof('/check stays free under its limit; past 20 an hour its JSON answer is a 402 with the terms of that site (not listed), the words of before; its page stays free', async () => {
  facilitator = null; asked.length = 0; const ip = fresh(); await spend(ip);
  const f0 = (await funnel()).asked.check || 0, h = host(), path = `/check?site=${h}&format=json`;
  const r = await call(path, { ip });
  assert.equal(r.status, 402, r.text.slice(0, 200)); assert.equal(r.j.error.code, 'RESOURCE_EXHAUSTED'); assert.match(r.j.error.message, /calmer pace on check/); assert.match(r.j.error.message, /0\.01 USDC/);
  const v2 = required(r); assert.equal(v2.resource.url, BASE + path); assert.equal(v2.accepts[0].amount, '10000'); assert.equal(v2.extensions, undefined, 'a site bought at /check is not listed as a service');
  assert.equal(r.j.accepts[0].outputSchema.input.discoverable, false); assert.equal((await funnel()).asked.check, f0 + 1); assert.equal(asked.length, 0);
  const page = await call(`/check/${host()}`, { ip, accept: 'text/html' }); assert.equal(page.status, 200); assert.match(page.h['content-type'], /text\/html/);
});
await proof('paying that 402 at /check: one payment of exactly 0.01 USDC buys the check where it was asked; a paid check is not one of the free ones', async () => {
  facilitator = settles(); asked.length = 0; const ip = fresh(); await spend(ip);
  const h = host(), r = await call(`/check?site=${h}&format=json`, { ip, headers: payment() });
  assert.equal(r.status, 200, r.text.slice(0, 200)); assert.equal(r.j.host, h); assert.equal(r.j.paid.status, 'settled'); assert.deepEqual(asked.map((x) => x.kind), ['verify', 'settle']);
  const v1 = await call(`/check?site=${host()}&format=json`, { ip, headers: payment({ version: 1 }) }); assert.equal(v1.status, 200, v1.text.slice(0, 200));
  const own = await call(`/x402/check?site=${host()}`, { ip, headers: payment() }); assert.equal(own.status, 200, 'the own door sells past the free checks too');
});
await Promise.allSettled(waits.splice(0));
console.log(`\n${passed} proofs held, ${failed} failed`);

// ------------------------------------------------------------------ negative controls: each rule broken in a copy, the proof must fail there
let caught = 0, missed = 0;
if (!process.argv.includes('--no-controls')) {
  console.log('\nnegative controls: each rule broken in a copy, the proof must fail there');
  const CONTROLS = [
    ['another amount taken (five cents buy a check)', 'node/readpay.mjs', "if (v !== BigInt(t.atomic)) return", "if (false) return"],
    ['an unreachable site charged (the claim not given back)', 'node/core.mjs', "      if (!r || r.error || r.reachable === false || typeof r.score !== 'number') {\n        await book.release(claim);", "      if (false) {\n        await book.release(claim);"],
    ['a paid check counted against the free checks', 'node/lens.mjs', "if (!ctx?.paidCheck) { try { await allow(ctx, 'check', 20, 3600); }", "if (true) { try { await allow(ctx, 'check', 20, 3600); }"],
    ['no 402 without a payment (the door gives the check away)', 'node/core.mjs', "      if (!pay) { funnelOf(db, cfg).asked('check'); return checkRequired(t, { base, cors: CORS }); }", "      if (!pay) { funnelOf(db, cfg).asked('check'); return json({ score: 100 }); }"],
    ['the free door past its limit without terms (429 as before)', 'node/core.mjs', "if (!html && e instanceof SeaError && e.checkLimit) {", "if (false) {"],
    ['delivered without a verdict (strict off)', 'node/core.mjs', "label: 'check', strict: true });", "label: 'check', strict: false });"],
  ];
  for (const [name, f, from, to] of CONTROLS) {
    const d2 = mkdtempSync(join(tmpdir(), 'mare-checkpay-ctl-'));
    try {
      cpSync(ROOT, d2, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      const fp = join(d2, f), txt = readFileSync(fp, 'utf8');
      if (!txt.includes(from)) { missed++; console.log(`  FAIL control "${name}": the line to break is gone from ${f}; the control needs updating`); continue; }
      writeFileSync(fp, txt.replace(from, to));
      const r = spawnSync(process.execPath, [join(d2, 'tools/checkpay-proof.mjs'), '--no-controls'], { encoding: 'utf8', timeout: 240_000 });
      const out = `${r.stdout}${r.stderr}`, broke = (out.match(/\n  FAIL /g) || []).length;
      if (r.status !== 0 && broke > 0) { caught++; console.log(`  ok   caught: ${name} (${broke} proof${broke === 1 ? '' : 's'} failed)`); }
      else { missed++; console.log(`  FAIL control "${name}" was not caught (exit ${r.status})`); }
    } finally { try { rmSync(d2, { recursive: true, force: true }); } catch {} }
  }
  console.log(`${caught} of ${CONTROLS.length} controls caught`);
}
process.exit(failed || missed ? 1 : 0);
