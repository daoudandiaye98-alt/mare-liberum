// Mare Liberum · proof of the paid read (3.48, node/readpay.mjs): one page as Markdown with its token count, 0.01 USDC over
// x402 in one step, and the funnel of the paid doors.
// It proves, on a node in this process (handle, as serve.mjs answers), with a stubbed web, facilitator and DNS (no network):
//   asking: GET and POST /x402/read without a payment answer 402 with the exact terms (PAYMENT-REQUIRED v2 with the bazaar
//   extension, the v1 body with a discoverable outputSchema), 0.01 USDC to the till's wallet; /openapi.json and
//   /discovery/resources name the door; every 402 without a payment is counted in the funnel (/funnel.json)
//   paying: only a signed transfer of exactly 0.01 USDC to the till's wallet (another amount, another wallet: refused, the
//   facilitator not asked); strict (refused, no verdict: nothing delivered); a payment buys once; a missing or unreadable
//   page is never charged (the facilitator not asked, the payment's claim given back, the same payment then buys a page)
//   delivering: the page as Markdown with tokens (html > markdown > 0), the sale in the till's books (method read-x402-v2,
//   1 cent, the host and not the address), the funnel counts the sale and its millionths; a paid read is not one of the 100
//   free reads of the day (a network past its free reads still buys a page)
// Negative controls at the end: each rule broken in a copy of the code, and this proof must fail there.
// Runs without the network: node tools/readpay-proof.mjs   (exit code 1 when a proof fails or a control is not caught)
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
process.env.MARE_VIA_SECRET = 'readpay-proof-via-key, a test value';
let passed = 0, failed = 0;
const D = globalThis.Date; let T0 = D.parse('2026-11-26T13:00:00.000Z');
class Clock extends D { constructor(...a) { if (a.length) super(...a); else super(T0); } static now() { return T0; } }
globalThis.Date = Clock;
const proof = async (name, fn) => { T0 += 60_000; try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 6).join('\n       ')}`); } };

// ------------------------------------------------------------------ the world: pages, robots.txt, DNS, a facilitator
const P = 'https://pages.readpay-proof.dev', FAC = 'https://facilitator.readpay-proof.dev';
const PAGE = `<!doctype html><html lang="en"><head><title>Pier notes</title><meta name="description" content="When the ferries leave"><style>${'.x{color:red}'.repeat(200)}</style><script>${'var a=1;'.repeat(300)}</script></head><body><nav>${'<a href="/n">nav</a>'.repeat(40)}</nav><main><h1>Pier notes</h1>${Array.from({ length: 8 }, (_, i) => `<h2>Pier ${i + 1}</h2><p>The ferry leaves pier ${i + 1} at half past the hour, every hour, from dawn to dusk, and the last one waits for the night train.</p>`).join('')}</main></body></html>`;
const asked = [];
let facilitator = null;
const answer = (j, status = 200) => new Response(JSON.stringify(j), { status, headers: { 'content-type': 'application/json' } });
const realFetch = globalThis.fetch;
globalThis.fetch = async (u, o = {}) => {
  const s = String(u?.url ?? u);
  if (s.startsWith(FAC)) { const kind = s.slice(FAC.length + 1), body = JSON.parse(o.body); asked.push({ kind, body }); if (!facilitator) throw new Error('the facilitator must not be asked'); return facilitator(kind, body); }
  if (/^http:\/\/127\.0\.0\.1:\d+\//.test(s)) return realFetch(u, o);
  const url = new URL(s);
  if (url.pathname === '/robots.txt') return new Response(url.hostname.startsWith('closed.') ? 'User-agent: *\nDisallow: /\n' : 'User-agent: *\nAllow: /\n', { status: 200, headers: { 'content-type': 'text/plain' } });
  if (url.origin === P && url.pathname.startsWith('/t/')) return new Response(`note ${url.pathname} of the harbour`, { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  if (url.origin === P && url.pathname.startsWith('/pier')) return new Response(PAGE, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
  if (url.hostname.startsWith('closed.')) return new Response(PAGE, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
  if (url.origin === P && url.pathname === '/gone') return new Response('not here', { status: 404, headers: { 'content-type': 'text/plain' } });
  throw new Error(`the proof does not use the network: ${s.slice(0, 80)}`);
};
createRequire(import.meta.url)('node:dns').promises.lookup = async () => [{ address: '93.184.216.34', family: 4 }];
for (const k of ['error', 'warn', 'info']) console[k] = () => {};
const PAYER = '0x2222222222222222222222222222222222222222';
const settles = () => (kind) => answer(kind === 'verify' ? { isValid: true, payer: PAYER } : { success: true, transaction: `0x${randomBytes(32).toString('hex')}`, network: 'eip155:8453', payer: PAYER });

// ------------------------------------------------------------------ the node
const BASE = 'https://mare.test', SITE = { '/llms.txt': { body: readFileSync(join(ROOT, 'site/llms.txt'), 'utf8'), type: 'text/plain; charset=utf-8' } };
const imp = (f) => import(pathToFileURL(join(ROOT, 'node', f)).href);
const core = await imp('core.mjs'), { createMem } = await imp('mem.mjs'), { memoryKv } = await imp('flow.mjs');
const { immune } = await imp('immune.mjs'), { createLedger } = await imp('ledger.mjs'), { payConfig } = await imp('pay.mjs');
const dir = mkdtempSync(join(tmpdir(), 'mare-readpay-')), file = join(dir, 'sea.tsv');
process.once('exit', () => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });
writeFileSync(file, ''); writeFileSync(join(dir, 'build.json'), JSON.stringify({ builtAt: '2026-11-20T10:00:00.000Z', entries: 0, lakes: {} }));
const db = createMem({ file, base: BASE }), kv = memoryKv(), ledger = createLedger({}), waits = [];
const PAY = { ...payConfig({}), facilitator: FAC, settleWaitMs: 300, verifyMs: 800, settleMs: 4000 };
const cfg = { base: BASE, kv, ledger, pay: PAY, site: SITE, waitUntil: (p) => { waits.push(p); }, creditSweepMs: 0 };
const call = async (path, { method = 'GET', accept = 'application/json', ip, headers = {}, body } = {}) => {
  const h = { accept, 'user-agent': 'readpay-proof-agent/1.0', 'x-forwarded-for': ip, ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers };
  const res = await core.handle(new Request(BASE + path, { method, headers: h, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }), db, cfg);
  const text = res.body ? Buffer.from(await res.arrayBuffer()).toString('utf8') : ''; let j = null; try { j = JSON.parse(text); } catch {}
  return { status: res.status, h: Object.fromEntries(res.headers), text, j };
};
await call('/stats', { ip: '127.0.0.1' });
immune.set({ mode: 'normal', rest: [], pace: { perMinute: 1_000_000, burst: 1_000_000 } });
const WALLET = PAY.payTo, USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
let net = 0; const fresh = () => `198.51.100.${++net}`;
const payment = ({ value = '10000', to = WALLET, version = 2, nonce = `0x${randomBytes(32).toString('hex')}` } = {}) => {
  const authorization = { from: PAYER, to, value: String(value), validAfter: '0', validBefore: String(Math.floor(T0 / 1000) + 300), nonce };
  const inner = { signature: `0x${'ab'.repeat(65)}`, authorization };
  const p = version === 2 ? { x402Version: 2, accepted: { scheme: 'exact', network: 'eip155:8453', amount: String(value), asset: USDC, payTo: to }, payload: inner } : { x402Version: 1, scheme: 'exact', network: 'base', payload: inner };
  return { [version === 2 ? 'payment-signature' : 'x-payment']: Buffer.from(JSON.stringify(p)).toString('base64') };
};
const funnel = async () => (await call('/funnel.json', { ip: '127.0.0.1' })).j;

console.log('asking');
await proof('GET /x402/read without a payment: 402, exactly 0.01 USDC to the till, v2 with the bazaar extension, v1 discoverable', async () => {
  facilitator = null; const r = await call('/x402/read?url=' + encodeURIComponent(`${P}/pier`), { ip: fresh() });
  assert.equal(r.status, 402);
  const v2 = JSON.parse(Buffer.from(r.h['payment-required'], 'base64').toString('utf8'));
  assert.equal(v2.x402Version, 2); assert.equal(v2.accepts[0].amount, '10000'); assert.equal(v2.accepts[0].payTo, WALLET); assert.equal(v2.accepts[0].network, 'eip155:8453');
  assert.equal(v2.resource.url, `${BASE}/x402/read`); assert.equal(v2.extensions.bazaar.info.input.method, 'GET'); assert.ok(v2.extensions.bazaar.info.input.queryParams.url);
  assert.equal(r.j.accepts[0].maxAmountRequired, '10000'); assert.equal(r.j.accepts[0].outputSchema.input.discoverable, true); assert.equal(r.j.amount_usd, '0.010000');
});
await proof('POST /x402/read without a payment: 402 as well; a GET without the page too (the indexes probe it bare)', async () => {
  const a = await call('/x402/read', { method: 'POST', ip: fresh(), body: { url: `${P}/pier` } }), b = await call('/x402/read', { ip: fresh() });
  assert.equal(a.status, 402); assert.equal(b.status, 402);
});
await proof('the funnel counts every 402 without a payment, per door (/funnel.json)', async () => {
  const before = (await funnel()).asked.read || 0;
  await call('/x402/read', { ip: fresh() }); await call('/route?q=find+a+ferry', { method: 'POST', ip: fresh() });
  const f = await funnel(); assert.equal(f.asked.read, before + 1); assert.ok(f.asked.route >= 1); assert.equal(f.day, '2026-11-26');
  const t = await call('/funnel.json', { ip: '127.0.0.1' }); assert.equal(t.j.doors.read, `GET ${BASE}/x402/read?url=<the page>`); assert.ok(!/0x[0-9a-fA-F]{40}/.test(t.text), 'numbers only: no address');
});
await proof('/openapi.json names GET /x402/read with x-payment-info (0.01 USD) and its 402; /discovery/resources lists it with the bazaar extension', async () => {
  const o = await call('/openapi.json', { ip: '127.0.0.1' }), op = o.j.paths['/x402/read']?.get;
  assert.ok(op); assert.deepEqual(op['x-payment-info'], { price: { mode: 'fixed', currency: 'USD', amount: '0.01' }, protocols: [{ x402: {} }] }); assert.match(o.j.info['x-guidance'], /\/x402\/read\?url=/); assert.ok(op.responses['402']); assert.equal(op.security, undefined);
  const d = await call('/discovery/resources', { ip: '127.0.0.1' }), it = d.j.items.find((x) => x.resource === `${BASE}/x402/read`);
  assert.ok(it); assert.equal(it.accepts[0].amount, '10000'); assert.ok(it.extensions.bazaar.info.output.example.markdown); assert.equal(d.j.pagination.total, d.j.items.length);
  assert.ok(d.j.items.find((x) => x.resource === `${BASE}/route`), 'the paid route stays listed');
});

console.log('paying');
await proof('another amount or another wallet is refused before the facilitator is asked', async () => {
  facilitator = null; asked.length = 0;
  const a = await call('/x402/read?url=' + encodeURIComponent(`${P}/pier`), { ip: fresh(), headers: payment({ value: '50000' }) });
  const b = await call('/x402/read?url=' + encodeURIComponent(`${P}/pier`), { ip: fresh(), headers: payment({ to: '0x3333333333333333333333333333333333333333' }) });
  const c = await call('/x402/read?url=' + encodeURIComponent(`${P}/pier`), { ip: fresh(), headers: payment({ value: '50000', version: 1 }) });
  assert.equal(a.status, 402); assert.match(a.j.error, /exactly 0\.010000/); assert.equal(b.status, 402); assert.match(b.j.error, /another wallet/); assert.equal(c.status, 402); assert.match(c.j.error, /exactly 0\.010000/); assert.equal(asked.length, 0);
});
await proof('a payment without a page, or for a page that cannot be read, is never charged (the facilitator is not asked)', async () => {
  facilitator = null; asked.length = 0;
  const a = await call('/x402/read', { ip: fresh(), headers: payment() });
  assert.equal(a.status, 400); assert.match(a.j.error.message, /Nothing was charged/);
  const b = await call('/x402/read?url=' + encodeURIComponent('https://closed.readpay-proof.dev/page'), { ip: fresh(), headers: payment() });
  assert.equal(b.status, 403); assert.match(b.j.error.message, /Nothing was charged/);
  const c = await call('/x402/read?url=' + encodeURIComponent(`${P}/gone`), { ip: fresh(), headers: payment() });
  assert.ok(c.status === 422 || c.status === 403, `an unreadable page: ${c.status}`); assert.match(c.j.error.message, /Nothing was charged/);
  assert.equal(asked.length, 0);
});
await proof('a payment whose page could not be read buys a page afterwards (its claim was given back)', async () => {
  facilitator = settles(); const pay = payment(), ip = fresh();
  const a = await call('/x402/read?url=' + encodeURIComponent(`${P}/gone`), { ip, headers: pay });
  assert.notEqual(a.status, 200);
  const b = await call('/x402/read?url=' + encodeURIComponent(`${P}/pier?again=1`), { ip, headers: pay });
  assert.equal(b.status, 200, b.text.slice(0, 200));
});
await proof('strict: a refused payment and a payment without a verdict deliver nothing', async () => {
  facilitator = (kind) => answer(kind === 'verify' ? { isValid: false, invalidReason: 'insufficient_funds' } : { success: false });
  const a = await call('/x402/read?url=' + encodeURIComponent(`${P}/pier?s=1`), { ip: fresh(), headers: payment() });
  assert.equal(a.status, 402); assert.match(a.j.error, /not accepted/); assert.equal(a.j.markdown, undefined);
  facilitator = () => answer({ error: 'busy' }, 500);
  const b = await call('/x402/read?url=' + encodeURIComponent(`${P}/pier?s=2`), { ip: fresh(), headers: payment() });
  assert.equal(b.status, 402); assert.match(b.j.error, /nothing was charged/); assert.equal(b.j.markdown, undefined);
});

console.log('delivering');
await proof('a paid read: the page as Markdown with its tokens, settled, in the till\'s books with the host only, counted in the funnel', async () => {
  facilitator = settles(); asked.length = 0;
  const before = await funnel(), t0 = await ledger.treasury();
  const r = await call('/x402/read?url=' + encodeURIComponent(`${P}/pier?d=1`), { ip: fresh(), headers: payment() });
  assert.equal(r.status, 200, r.text.slice(0, 300));
  assert.match(r.j.markdown, /Pier notes/); assert.match(r.j.markdown, /night train/);
  assert.ok(r.j.tokens.html > r.j.tokens.markdown && r.j.tokens.markdown > 0, JSON.stringify(r.j.tokens)); assert.ok(r.j.tokens.saved_pct > 0);
  assert.equal(r.j.paid.status, 'settled'); assert.equal(r.j.paid.amount_usd, '0.010000'); assert.ok(r.h['payment-response']);
  assert.deepEqual(asked.map((x) => x.kind), ['verify', 'settle']);
  const t1 = await ledger.treasury(); assert.equal(t1.total_count, (t0.total_count || 0) + 1);
  const sale = (t1.last_5 || []).find((s) => /^read: /.test(s.q || ''));
  assert.ok(sale, JSON.stringify(t1.last_5)); assert.equal(sale.q, 'read: pages.readpay-proof.dev'); assert.equal(sale.amount_usd, 0.01);
  const after = await funnel(); assert.equal(after.paid.read, (before.paid.read || 0) + 1); assert.equal(Number(after.paid_usd), Number(before.paid_usd) + 0.01);
});
await proof('a payment buys once: the same payment again is refused, the facilitator not asked again', async () => {
  facilitator = settles(); const pay = payment(), ip = fresh();
  const a = await call('/x402/read?url=' + encodeURIComponent(`${P}/pier?o=1`), { ip, headers: pay }); assert.equal(a.status, 200);
  asked.length = 0;
  const b = await call('/x402/read?url=' + encodeURIComponent(`${P}/pier?o=2`), { ip, headers: pay });
  assert.equal(b.status, 402); assert.match(b.j.error, /buys once/); assert.equal(asked.length, 0);
});
await proof('x402 v1 (X-PAYMENT) buys a page as v2 does', async () => {
  facilitator = settles();
  const r = await call('/x402/read?url=' + encodeURIComponent(`${P}/pier?v=1`), { ip: fresh(), headers: payment({ version: 1 }) });
  assert.equal(r.status, 200, r.text.slice(0, 200)); assert.match(r.j.markdown, /Pier notes/);
});
await proof('a paid read is not one of the 100 free reads: a network past its free reads still buys a page', async () => {
  facilitator = settles(); const ip = fresh();
  for (let i = 0; i < 100; i++) { T0 += 700; const r = await call(`/r/${P}/t/${ip}-${i}.txt`, { ip, accept: 'text/markdown' }); assert.equal(r.status, 200, `free read ${i + 1}: ${r.text.slice(0, 100)}`); }
  T0 += 700; const over = await call(`/r/${P}/t/${ip}-over.txt`, { ip, accept: 'text/markdown' }); assert.equal(over.status, 429);
  const paid = await call('/x402/read?url=' + encodeURIComponent(`${P}/pier?free=no`), { ip, headers: payment() }); assert.equal(paid.status, 200, paid.text.slice(0, 200));
});
await Promise.allSettled(waits.splice(0));
console.log(`\n${passed} proofs held, ${failed} failed`);

// ------------------------------------------------------------------ negative controls: each rule broken in a copy, the proof must fail there
let caught = 0, missed = 0;
if (!process.argv.includes('--no-controls')) {
  console.log('\nnegative controls: each rule broken in a copy, the proof must fail there');
  const CONTROLS = [
    ['another amount taken', 'node/readpay.mjs', "if (v !== BigInt(t.atomic)) return", "if (false) return"],
    ['an unreadable page charged (the claim not given back, the payment taken)', 'node/core.mjs', "      if (!page?.markdown || page.blocked || page.error) {\n        await book.release(claim);", "      if (false) {\n        await book.release(claim);"],
    ['a paid read counted against the free reads', 'node/lens.mjs', "      if (!hit && !ctx?.paidRead) {", "      if (!hit) {"],
    ['no 402 without a payment (the door gives the page away)', 'node/core.mjs', "      if (!pay) { funnel.asked('read'); return readRequired(t, { base, cors: CORS }); }", "      if (!pay) { funnel.asked('read'); return json({ markdown: 'free' }); }"],
    ['delivered without a verdict (strict off)', 'node/core.mjs', "label: 'read', strict: true });", "label: 'read', strict: false });"],
  ];
  for (const [name, file, from, to] of CONTROLS) {
    const dir = mkdtempSync(join(tmpdir(), 'mare-readpay-ctl-'));
    try {
      cpSync(ROOT, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      const f = join(dir, file), txt = readFileSync(f, 'utf8');
      if (!txt.includes(from)) { missed++; console.log(`  FAIL control "${name}": the line to break is gone from ${file}; the control needs updating`); continue; }
      writeFileSync(f, txt.replace(from, to));
      const r = spawnSync(process.execPath, [join(dir, 'tools/readpay-proof.mjs'), '--no-controls'], { encoding: 'utf8', timeout: 240_000 });
      const out = `${r.stdout}${r.stderr}`, broke = (out.match(/\n  FAIL /g) || []).length;
      if (r.status !== 0 && broke > 0) { caught++; console.log(`  ok   caught: ${name} (${broke} proof${broke === 1 ? '' : 's'} failed)`); }
      else { missed++; console.log(`  FAIL control "${name}" was not caught (exit ${r.status})`); }
    } finally { try { rmSync(dir, { recursive: true, force: true }); } catch {} }
  }
  console.log(`${caught} of ${CONTROLS.length} controls caught`);
}
process.exit(failed || missed ? 1 : 0);
