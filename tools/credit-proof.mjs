// Mare Liberum · proof of prepaid reader credit (D6 of the night of 25/26 Nov 2026, node/credit.mjs): above the free 100 pages a
// day per network, pages bought in advance over x402; never credit on trust.
// It proves, on nodes in this process (handle, as serve.mjs answers), with a stubbed web, facilitator and DNS (no network):
//   buying: 402 with the exact terms; only a signed transfer of exactly 0.05 USDC to the till's wallet; strict (no delivery
//   without a payment the facilitator verified: refused, no verdict, no facilitator); a payment buys once, also two at once; a
//   settlement that fails, at once or later, takes the credit back; the sale in the till's books and on /treasury;
//   the token: mlc_ and 32 base64url letters, shown once, kept only as its SHA-256 (not in the state, the books, a log or a
//   request the sea makes); x-sea-credit, or Authorization: Bearer mlc_… (any other Authorization unread, the answer as now);
//   spending: never before the network's 100 free pages of the day, one page per read that counts against the limit, nothing
//   for the copy of the last hour, what is left on every answer that spent a page, used up, expired, unknown and malformed
//   tokens refused with today's limit answer, no double spend under concurrency, the scrape doors and Jina's form alike;
//   non-payers: today's limit answer, one line and two headers more; every other answer byte for byte origin/main (/r/ and
//   /mcp/app as before); the terms (§ 5a DE and EN), the price lists, the privacy notice, /reader and llms.txt say it.
//   CR8, a settlement whose answer never came back (lost, or a restart between verify and settle), with a stubbed Base RPC:
//   on its own timer and at the start (never in a request), once validBefore and a minute are past and the claim is ten
//   minutes old, the chain is asked: used, settled in the till and the credit kept; not used, taken back (429 "taken back");
//   no clear answer, nothing changed and counted; at most 20 questions a run; the chain check off, nothing asked or taken
//   back; a transfer valid beyond the terms' maxTimeoutSeconds and a minute not taken; wallet, nonce and validBefore kept,
//   never the signature.
// Negative controls at the end: each rule broken in a copy of the code, and this proof must fail there.
// Runs without the network: node tools/credit-proof.mjs   (exit code 1 when a proof fails or a control is not caught)
//   --no-controls              only the proofs (the controls run this file that way in each broken copy)
//   MARE_CREDIT_REF=<ref>       the tree the answers without credit must equal (default 2d6ca74: origin/main, 3.37.1)
//   MARE_CREDIT_REF_DIR=<dir>   that tree already extracted (the controls hand it on; no git in their copies)
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, cpSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash, randomBytes } from 'node:crypto';
import { Buffer } from 'node:buffer';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTROLS = !process.argv.includes('--no-controls');
for (const k of ['MARE_TOLL', 'MARE_ENGINE', 'MARE_FAIR', 'MARE_X402_FACILITATOR', 'MARE_PAY_TO', 'MARE_ROUTE_PRICE_CENTS', 'MARE_STATE', 'MARE_DB_URL', 'MARE_DB_KEY', 'MARE_DB_SECRET', 'MARE_BASE_RPC']) delete process.env[k];
process.env.MARE_VIA_SECRET = 'credit-proof-via-key, a test value';
let passed = 0, failed = 0;
const proof = async (name, fn) => {
  T0 += 60_000;
  try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 6).join('\n       ')}`); }
  if (failed && process.env.MARE_CREDIT_FIRST_FAIL === '1') { console.log(`\n${passed} proofs held, ${failed} failed (stopped at the first)`); process.exit(1); }
};

// ------------------------------------------------------------------ one clock for every node of the proof
const D = globalThis.Date; let T0 = D.parse('2026-11-26T01:00:00.000Z');
class Clock extends D { constructor(...a) { if (a.length) super(...a); else super(T0); } static now() { return T0; } }
globalThis.Date = Clock;

// ------------------------------------------------------------------ the world: pages, robots.txt, DNS, a facilitator; every request written down
const P = 'https://pages.credit-proof.dev', FAC = 'https://facilitator.credit-proof.dev';
const PAGE = `<!doctype html><html lang="en"><head><title>Pier notes</title></head><body><main><h1>Pier notes</h1>${Array.from({ length: 8 }, (_, i) => `<h2>Pier ${i + 1}</h2><p>The ferry leaves pier ${i + 1} at half past the hour, and the harbour office answers every question about berths.</p>`).join('')}</main></body></html>`;
const outgoing = [], asked = [];
let facilitator = null; // (kind, body) => Response
// a stubbed Base RPC (USDC authorizationState): up (answers from used), down (no connection), garbage (no result)
const CHAIN = 'https://chain.credit-proof.dev', chain = { mode: 'up', used: new Set(), asked: [] };
const answer = (j, status = 200) => new Response(JSON.stringify(j), { status, headers: { 'content-type': 'application/json' } });
const realFetch = globalThis.fetch;
globalThis.fetch = async (u, o = {}) => {
  const s = String(u?.url ?? u); outgoing.push({ url: s, headers: Object.fromEntries(new Headers(o.headers || {})), body: typeof o.body === 'string' ? o.body : '' });
  if (s.startsWith(CHAIN)) {
    const j = JSON.parse(o.body), d = String(j.params?.[0]?.data || ''), q = { from: `0x${d.slice(34, 74)}`, nonce: `0x${d.slice(74, 138)}`, to: j.params?.[0]?.to, selector: d.slice(0, 10) };
    chain.asked.push(q); if (chain.mode === 'down') throw new TypeError('fetch failed');
    if (chain.mode === 'garbage') return answer({ jsonrpc: '2.0', id: j.id, error: { code: -32000, message: 'header not found' } });
    return answer({ jsonrpc: '2.0', id: j.id, result: `0x${(chain.used.has(q.nonce) ? 1 : 0).toString(16).padStart(64, '0')}` });
  }
  if (s.startsWith(FAC)) { const kind = s.slice(FAC.length + 1), body = JSON.parse(o.body); asked.push({ kind, body }); if (!facilitator) throw new Error('the facilitator must not be asked'); return facilitator(kind, body); }
  if (/^http:\/\/127\.0\.0\.1:\d+\//.test(s)) return realFetch(u, o);
  const url = new URL(s);
  if (url.pathname === '/robots.txt') return new Response('User-agent: *\nAllow: /\n', { status: 200, headers: { 'content-type': 'text/plain' } });
  if (url.origin === P && url.pathname.startsWith('/t/')) return new Response(`note ${url.pathname} of the harbour`, { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  if (s === `${P}/pier`) return new Response(PAGE, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
  throw new Error(`the proof does not use the network: ${s.slice(0, 80)}`);
};
createRequire(import.meta.url)('node:dns').promises.lookup = async () => [{ address: '93.184.216.34', family: 4 }];
const logs = [];
for (const k of ['log', 'error', 'warn', 'info']) { const f = console[k].bind(console); console[k] = (...a) => { logs.push(a.map(String).join(' ')); if (k === 'log') f(...a); }; }
const PAYER = '0x2222222222222222222222222222222222222222';
const settles = () => (kind) => answer(kind === 'verify' ? { isValid: true, payer: PAYER } : { success: true, transaction: `0x${randomBytes(32).toString('hex')}`, network: 'eip155:8453', payer: PAYER });

// ------------------------------------------------------------------ the nodes: this tree and origin/main
const BASE = 'https://mare.test', SITE = { '/llms.txt': { body: readFileSync(join(ROOT, 'site/llms.txt'), 'utf8'), type: 'text/plain; charset=utf-8' } };
const UA = 'credit-proof-agent/1.0';
const imp = (dir, f) => import(pathToFileURL(join(dir, 'node', f)).href);
const recordingKv = (memoryKv) => { const k = memoryKv(), sets = []; return { get: (key) => k.get(key), set: (key, v, ttl) => { sets.push(JSON.stringify([key, v])); return k.set(key, v, ttl); }, sets }; };
const waits = [];
async function nodeOf(rootDir) {
  const core = await imp(rootDir, 'core.mjs'), { createMem } = await imp(rootDir, 'mem.mjs'), { memoryKv } = await imp(rootDir, 'flow.mjs');
  const { immune } = await imp(rootDir, 'immune.mjs'), { createLedger } = await imp(rootDir, 'ledger.mjs'), { payConfig } = await imp(rootDir, 'pay.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'mare-credit-')), file = join(dir, 'sea.tsv');
  process.once('exit', () => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });
  writeFileSync(file, ''); writeFileSync(join(dir, 'build.json'), JSON.stringify({ builtAt: '2026-11-20T10:00:00.000Z', entries: 0, lakes: {} }));
  const db = createMem({ file, base: BASE }), kv = recordingKv(memoryKv), ledger = createLedger({});
  const PAY = { ...payConfig({}), facilitator: FAC, settleWaitMs: 300, verifyMs: 800, settleMs: 4000 };
  const cfg = { base: BASE, kv, ledger, pay: PAY, site: SITE, waitUntil: (p) => { waits.push(p); }, chainRpc: CHAIN, creditSweepMs: 0 };
  const call = async (path, { method = 'GET', accept = 'text/markdown, text/plain;q=0.9, */*;q=0.5', ua = UA, ip, headers = {}, body, c = {} } = {}) => {
    assert.ok(ip, 'every call of the proof names its network');
    const h = { accept, 'user-agent': ua, 'x-forwarded-for': ip, ...(body !== undefined && typeof body !== 'string' ? { 'content-type': 'application/json' } : {}), ...headers };
    const res = await core.handle(new Request(BASE + path, { method, headers: h, ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}) }), db, { ...cfg, ...c });
    const buf = res.body ? Buffer.from(await res.arrayBuffer()) : Buffer.alloc(0), text = buf.toString('utf8'); let j = null; try { j = JSON.parse(text); } catch {}
    return { status: res.status, headers: res.headers, h: Object.fromEntries(res.headers), text, j };
  };
  await call('/stats', { ua: 'MareLiberum-session/1.0', ip: '127.0.0.1' });
  immune.set({ mode: 'normal', rest: [], pace: { perMinute: 1_000_000, burst: 1_000_000 } });
  return { core, db, cfg, kv, ledger, PAY, call, immune, rootDir };
}
// since 3.40.0 the tree without the credit is release/3.40 before the credit came in (4c64553: 3.39.0 with the guides and the books)
const REF = process.env.MARE_CREDIT_REF || '4c6455348952eb567e0cb009ae8281d687ea28a9';
const refDir = (() => {
  const given = process.env.MARE_CREDIT_REF_DIR; if (given && existsSync(join(given, 'node/core.mjs'))) return given;
  const dir = mkdtempSync(join(tmpdir(), 'mare-credit-ref-'));
  const r = spawnSync('sh', ['-c', 'git -C "$1" archive "$2" | tar -x -C "$3"', 'sh', ROOT, REF, dir], { encoding: 'utf8' });
  return r.status === 0 && existsSync(join(dir, 'node/core.mjs')) ? dir : null;
})();
// the version is the only thing a release changes on these answers (since 3.41.0: a release after the credit bumps it); it is masked
const VERSIONS = new Set();
const steady = (s) => { let t = String(s).replace(/\br\d{8}[a-z0-9]{8}\b/g, 'r<id>'); for (const v of VERSIONS) t = t.split(v).join('<version>'); return t; };
const same = (a, b, what) => { assert.equal(a.status, b.status, `${what}: status`); assert.equal(steady(a.text), steady(b.text), `${what}: body`); assert.deepEqual(Object.fromEntries(Object.entries(a.h).map(([k, v]) => [k, steady(v)])), Object.fromEntries(Object.entries(b.h).map(([k, v]) => [k, steady(v)])), `${what}: headers`); };

const node = await nodeOf(ROOT);
const ref = refDir ? await nodeOf(refDir) : null;
const WALLET = node.PAY.payTo, USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
let net = 0; const fresh = () => `203.0.113.${++net}`;
let pageNo = 0; const nextPage = () => `${P}/t/${++pageNo}.txt`;
// the free pages of a network used up (each a new page, a second apart: the sea's pace per site stays calm)
const useFree = async (n, ip) => { for (let i = 0; i < 100; i++) { T0 += 600; const r = await n.call(`/r/${nextPage()}`, { ip }); assert.equal(r.status, 200, `free read ${i + 1}: ${r.text.slice(0, 120)}`); } };
// a signed USDC transfer (x402 exact, EIP-3009) in the header of x402 v2 (or v1)
const payment = ({ value = '50000', to = WALLET, version = 2, nonce = `0x${randomBytes(32).toString('hex')}`, from = PAYER, noAuth = false, before } = {}) => {
  const authorization = { from, to, value: String(value), validAfter: '0', ...(before === null ? {} : { validBefore: String(before ?? Math.floor(T0 / 1000) + 300) }), nonce };
  const inner = noAuth ? { signature: `0x${'ab'.repeat(65)}` } : { signature: `0x${'ab'.repeat(65)}`, authorization };
  const p = version === 2 ? { x402Version: 2, accepted: { scheme: 'exact', network: 'eip155:8453', amount: String(value), asset: USDC, payTo: to }, payload: inner } : { x402Version: 1, scheme: 'exact', network: 'base', payload: inner };
  return { [version === 2 ? 'payment-signature' : 'x-payment']: Buffer.from(JSON.stringify(p)).toString('base64') };
};
const buy = (headers, ip = fresh()) => node.call('/reader/credit', { method: 'POST', accept: 'application/json', ip, headers });
const salesOf = () => node.ledger.treasury();
const settled = () => Promise.allSettled(waits.splice(0));
const sha = (s) => createHash('sha256').update(s).digest('hex');

console.log('without credit: every answer as on origin/main');
await proof(`the reference tree is there (${REF.slice(0, 7)}); the version is the same or a release later, and masked in every comparison`, () => { assert.ok(ref, 'git archive of the reference failed: set MARE_CREDIT_REF_DIR'); const [a, b] = [ref.core.VERSION, node.core.VERSION].map((v) => v.split('.').map(Number)); assert.ok(b[0] > a[0] || (b[0] === a[0] && (b[1] > a[1] || (b[1] === a[1] && b[2] >= a[2]))), `${node.core.VERSION} is not ${ref.core.VERSION} or later`); VERSIONS.add(ref.core.VERSION); VERSIONS.add(node.core.VERSION); });
await proof('/r/ under the free limit equals origin/main, also with an Authorization that is not credit and with a credit token (nothing spent before the free pages)', async () => {
  const ip = fresh(), url = `/r/${P}/pier`;
  for (const [p, o] of [[url, {}], [`${url}?format=json`, {}], [`${url}?format=full`, {}], [url, { headers: { authorization: 'Bearer fc-not-credit-123' } }], [url, { headers: { authorization: 'Basic dXNlcjpwYXNz' } }], ['/r/%20', {}], [`/r/${P}/t/0.txt`, {}]]) same(await node.call(p, { ip, ...o }), await ref.call(p, { ip, ...o }), `${p} ${JSON.stringify(o)}`);
  // a token of the right form under the free limit: the very answer of a caller without one (nothing spent, no credit headers)
  const tok = `mlc_${randomBytes(24).toString('base64url')}`, other = fresh();
  for (const o of [{ headers: { 'x-sea-credit': tok } }, { headers: { authorization: `Bearer ${tok}` } }]) same(await node.call(`/r/${P}/t/9001.txt`, { ip: other, ...o }), await ref.call(`/r/${P}/t/9001.txt`, { ip: other, ...o }), `token under the limit ${Object.keys(o.headers)[0]}`);
});
await proof('/mcp/app equals origin/main (GET, initialize, tools/list, tools/call read_page)', async () => {
  const ip = fresh(), rpc = (method, params) => ({ method: 'POST', accept: 'application/json, text/event-stream', ip, body: { jsonrpc: '2.0', id: 1, method, ...(params ? { params } : {}) } });
  same(await node.call('/mcp/app', { ip, accept: 'application/json' }), await ref.call('/mcp/app', { ip, accept: 'application/json' }), 'GET /mcp/app');
  for (const [m, p] of [['initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'credit-proof', version: '1' } }], ['tools/list', null], ['tools/call', { name: 'read_page', arguments: { url: `${P}/pier` } }]]) same(await node.call('/mcp/app', rpc(m, p)), await ref.call('/mcp/app', rpc(m, p)), `/mcp/app ${m}`);
});
await proof('a non-payer past the free limit: today\'s 429, the same words plus one line, two headers more (x-sea-credit-buy, link)', async () => {
  const ip = fresh(); await useFree(node, ip); pageNo -= 100; await useFree(ref, ip);
  const p = `/r/${nextPage()}`, a = await node.call(p, { ip }), b = await ref.call(p, { ip });
  assert.equal(a.status, 429); assert.equal(b.status, 429); assert.equal(a.j.error.code, b.j.error.code);
  assert.ok(a.j.error.message.startsWith(`${b.j.error.message} Or read on with prepaid reader credit: POST ${BASE}/reader/credit`), a.j.error.message);
  assert.equal(a.h['x-sea-credit-buy'], `${BASE}/reader/credit`); assert.equal(a.h.link, `<${BASE}/reader#credit>; rel="payment"`);
  const extra = new Set(['x-sea-credit-buy', 'link', 'access-control-expose-headers', 'content-length']);
  for (const k of new Set([...Object.keys(a.h), ...Object.keys(b.h)])) if (!extra.has(k)) assert.equal(a.h[k], b.h[k], k);
  const s = await node.call('/v2/scrape', { method: 'POST', accept: 'application/json', ip, body: { url: nextPage() } }); assert.equal(s.status, 429); assert.match(s.j.error, /reader\/credit/); assert.equal(s.h['x-sea-credit-buy'], `${BASE}/reader/credit`);
  const fc = await node.call(`/r/${nextPage()}`, { ip, headers: { authorization: 'Bearer fc-not-credit-123' } }); assert.equal(fc.j.error.message, a.j.error.message, 'an Authorization without mlc_ is not read');
});

console.log('buying: x402, the till\'s own path, strict, exactly 0.05 USDC');
await proof('without a payment: 402 with the exact terms (50000 = 0.05 USDC, the till\'s wallet, /reader/credit), x402 v1 and v2', async () => {
  const r = await buy({}); assert.equal(r.status, 402); assert.equal(r.j.accepts[0].maxAmountRequired, '50000'); assert.equal(r.j.accepts[0].payTo, WALLET); assert.equal(r.j.accepts[0].resource, `${BASE}/reader/credit`); assert.equal(r.j.amount_usd, '0.050000');
  const v2 = JSON.parse(Buffer.from(r.h['payment-required'], 'base64').toString('utf8')); assert.equal(v2.accepts[0].amount, '50000'); assert.equal(v2.accepts[0].network, 'eip155:8453'); assert.equal(v2.accepts[0].payTo, WALLET);
  const g = await node.call('/reader/credit', { ip: fresh(), accept: 'application/json' }); assert.equal(g.status, 200); assert.equal(g.j.pages, 50); assert.equal(g.j.days, 30); assert.equal(g.j.per_page_usd, '0.001000');
});
await proof('only exactly 0.05 USDC to the till\'s wallet, as a signed transfer: anything else 402, the facilitator never asked, nothing sold', async () => {
  facilitator = settles(); const a0 = asked.length, s0 = (await salesOf()).total_count;
  for (const p of [payment({ value: '49999' }), payment({ value: '50001' }), payment({ value: '100000' }), payment({ value: '49999', version: 1 }), payment({ value: '50001', version: 1 }), payment({ value: '100000', version: 1 }), payment({ value: '50000', to: '0x4444444444444444444444444444444444444444' }), payment({ value: '50000', to: '0x4444444444444444444444444444444444444444', version: 1 }), payment({ noAuth: true }), payment({ noAuth: true, version: 1 }), payment({ value: '50000', nonce: 'x' }), { 'payment-signature': 'not base64 json' }]) {
    const r = await buy(p); assert.equal(r.status, 402, JSON.stringify(r.j?.error)); assert.equal(r.j.token, undefined);
  }
  assert.equal(asked.length, a0, 'the facilitator was never asked'); assert.equal((await salesOf()).total_count, s0, 'nothing sold');
});
await proof('strict: a payment the facilitator refuses, gives no verdict on, or cannot be asked about is not taken (402, no token, no sale); it may come again', async () => {
  const s0 = (await salesOf()).total_count, p = payment();
  facilitator = (kind) => answer(kind === 'verify' ? { isValid: false, invalidReason: 'invalid_signature' } : { success: false });
  let r = await buy(p); assert.equal(r.status, 402); assert.match(r.j.error, /not accepted/); assert.equal(r.j.token, undefined);
  facilitator = () => answer({ error: 'down' }, 500); r = await buy(p); assert.equal(r.status, 402); assert.match(r.j.error, /no verdict/);
  const off = await node.call('/reader/credit', { method: 'POST', accept: 'application/json', ip: fresh(), headers: p, c: { pay: { ...node.PAY, facilitator: null } } }); assert.equal(off.status, 402); assert.equal(off.j.token, undefined);
  assert.equal((await salesOf()).total_count, s0, 'nothing sold');
  facilitator = settles(); r = await buy(p); assert.equal(r.status, 200, 'the same payment, verified now, buys'); await settled();
});
let TOKEN = null;
await proof('a verified, settled payment: 200 with the token once (mlc_ + 32 base64url), 50 pages, 30 days; a sale of the till on /treasury', async () => {
  facilitator = settles(); const s0 = await salesOf();
  const r = await buy(payment({ version: 1 }));
  assert.equal(r.status, 200, r.text.slice(0, 200)); assert.match(r.j.token, /^mlc_[A-Za-z0-9_-]{32}$/); assert.equal(r.j.pages, 50); assert.equal(r.j.left, 50);
  assert.equal(Date.parse(r.j.until), T0 + 30 * 86400e3); assert.equal(r.j.paid.status, 'settled'); assert.ok(r.h['x-payment-response'], 'the payment\'s response');
  const s1 = await salesOf(); assert.equal(s1.total_count, s0.total_count + 1); assert.equal(Math.round(s1.total_usd * 100), Math.round(s0.total_usd * 100) + 5);
  assert.equal(s1.last_5[0].method, 'credit-x402-v1'); assert.equal(s1.last_5[0].amount_usd, 0.05);
  const t = await node.call('/treasury', { ip: fresh(), accept: 'application/json' }); assert.ok(t.j.last_5.some((x) => x.method === 'credit-x402-v1')); assert.match(t.j.read, /Reader credit/);
  TOKEN = r.j.token;
  const g = await node.call('/reader/credit', { ip: fresh(), accept: 'application/json', headers: { 'x-sea-credit': TOKEN } }); assert.equal(g.j.token.left, 50); assert.equal(g.j.token.state, 'ok');
});
await proof('the token is kept only as its SHA-256: not in the state, the books, a log or a request the sea makes', async () => {
  assert.ok(TOKEN); const everything = [...node.kv.sets, ...logs, ...outgoing.map((x) => JSON.stringify(x)), JSON.stringify(await salesOf())].join('\n');
  assert.ok(!everything.includes(TOKEN) && !everything.includes(TOKEN.slice(4)), 'the token appears nowhere');
  assert.ok(node.kv.sets.some((x) => x.includes(`credit:t:${sha(TOKEN)}`)), 'its hash is the key');
});
await proof('a payment buys once: again later, and two of the same at once (one token, one sale)', async () => {
  facilitator = settles(); const p = payment(), s0 = (await salesOf()).total_count;
  const [a, b] = await Promise.all([buy(p), buy(p)]); await settled();
  assert.deepEqual([a.status, b.status].sort(), [200, 402]); assert.equal((await salesOf()).total_count, s0 + 1);
  const again = await buy(p); assert.equal(again.status, 402); assert.match(again.j.error, /buys once/);
});
await proof('a settlement that fails takes the credit back: at once (402, no token) and later (the token handed out stops at once)', async () => {
  facilitator = (kind) => answer(kind === 'verify' ? { isValid: true, payer: PAYER } : { success: false, errorReason: 'insufficient_funds' });
  const r = await buy(payment()); assert.equal(r.status, 402); assert.match(r.j.error, /did not settle/); assert.equal(r.j.token, undefined);
  facilitator = (kind) => (kind === 'verify' ? answer({ isValid: true, payer: PAYER }) : new Promise((ok) => setTimeout(() => ok(answer({ success: false, errorReason: 'nonce used' })), 600)));
  const late = await buy(payment()); assert.equal(late.status, 200, 'handed out while the settlement is on its way'); assert.equal(late.j.paid.status, 'pending');
  await settled();
  const ip = fresh(); await useFree(node, ip);
  const x = await node.call(`/r/${nextPage()}`, { ip, headers: { 'x-sea-credit': late.j.token } }); assert.equal(x.status, 429); assert.match(x.j.error.message, /taken back/);
  facilitator = settles();
});

console.log('spending: only past the free pages, one page per read that counts');
await proof('past the free pages a read spends one page (x-sea-credit-left, x-sea-credit-until); the copy of the last hour spends nothing; without the token the limit answer', async () => {
  facilitator = settles(); const b = await buy(payment()); await settled(); const tok = b.j.token, ip = fresh();
  await useFree(node, ip);
  const g0 = await node.call('/reader/credit', { ip, accept: 'application/json', headers: { 'x-sea-credit': tok } }); assert.equal(g0.j.token.left, 50, 'nothing spent on the free pages');
  const page1 = nextPage(), r = await node.call(`/r/${page1}`, { ip, headers: { 'x-sea-credit': tok } });
  assert.equal(r.status, 200); assert.equal(r.h['x-sea-credit-left'], '49'); assert.equal(r.h['x-sea-credit-until'], b.j.until); assert.match(r.h['cache-control'], /private, no-store/); assert.match(r.h['access-control-expose-headers'], /x-sea-credit-left/);
  const hit = await node.call(`/r/${page1}`, { ip, headers: { 'x-sea-credit': tok } }); assert.equal(hit.status, 200); assert.equal(hit.h['x-sea-credit-left'], undefined, 'the copy of the last hour is free');
  assert.equal((await node.call(`/r/${nextPage()}`, { ip })).status, 429, 'without the token: the limit');
  const fcKey = await node.call('/v2/scrape', { method: 'POST', accept: 'application/json', ip, headers: { authorization: `Bearer ${tok}` }, body: { url: nextPage() } });
  assert.equal(fcKey.status, 200); assert.equal(fcKey.j.success, true); assert.equal(fcKey.h['x-sea-credit-left'], '48', 'the token as a Firecrawl api key');
  const jn = await node.call(`/r/${nextPage()}`, { ip, headers: { 'x-sea-credit': tok, 'x-return-format': 'text' } }); assert.equal(jn.status, 200); assert.equal(jn.h['x-sea-credit-left'], '47');
  const g1 = await node.call('/reader/credit', { ip, accept: 'application/json', headers: { 'x-sea-credit': tok } }); assert.equal(g1.j.token.left, 47);
});
await proof('a malformed, unknown, used-up or expired token: today\'s limit answer and a word on why; nothing read', async () => {
  facilitator = settles(); const b = await buy(payment()); await settled(); const tok = b.j.token, ip = fresh(); await useFree(node, ip);
  const o0 = outgoing.length;
  const bad = await node.call(`/r/${nextPage()}`, { ip, headers: { 'x-sea-credit': 'mlc_short' } }); assert.equal(bad.status, 429); assert.match(bad.j.error.message, /not known/);
  const unknown = await node.call(`/r/${nextPage()}`, { ip, headers: { 'x-sea-credit': `mlc_${randomBytes(24).toString('base64url')}` } }); assert.equal(unknown.status, 429); assert.match(unknown.j.error.message, /not known/);
  assert.equal(outgoing.filter((x) => !/robots\.txt$/.test(x.url)).length, outgoing.slice(0, o0).filter((x) => !/robots\.txt$/.test(x.url)).length, 'nothing read for them');
  for (let i = 0; i < 50; i++) { T0 += 600; const r = await node.call(`/r/${nextPage()}`, { ip, headers: { 'x-sea-credit': tok } }); assert.equal(r.status, 200, `page ${i + 1}`); assert.equal(r.h['x-sea-credit-left'], String(49 - i)); }
  const up = await node.call(`/r/${nextPage()}`, { ip, headers: { 'x-sea-credit': tok } }); assert.equal(up.status, 429); assert.match(up.j.error.message, /used up/);
  // another token, 30 days and a second later: expired (a new UTC day: its free pages first)
  const c = await buy(payment()); await settled(); T0 += 30 * 86400e3 + 1000; const ip2 = fresh(); await useFree(node, ip2);
  const ex = await node.call(`/r/${nextPage()}`, { ip: ip2, headers: { 'x-sea-credit': c.j.token } }); assert.equal(ex.status, 429); assert.match(ex.j.error.message, /expired/);
  // (the clock only moves on: the sea's pace per site counts forward)
});
await proof('no double spend: ten reads at once with three pages left spend three, the other seven get the limit', async () => {
  facilitator = settles(); const b = await buy(payment()); await settled(); const tok = b.j.token, ip = fresh(); await useFree(node, ip);
  for (let i = 0; i < 47; i++) { T0 += 600; assert.equal((await node.call(`/r/${nextPage()}`, { ip, headers: { 'x-sea-credit': tok } })).status, 200); }
  const rs = await Promise.all(Array.from({ length: 10 }, () => node.call(`/r/${nextPage()}`, { ip, headers: { 'x-sea-credit': tok } })));
  assert.equal(rs.filter((r) => r.status === 200).length, 3, `statuses ${rs.map((r) => r.status)}`); assert.equal(rs.filter((r) => r.status === 429).length, 7);
  assert.deepEqual(rs.filter((r) => r.status === 200).map((r) => r.h['x-sea-credit-left']).sort(), ['0', '1', '2']);
  const g = await node.call('/reader/credit', { ip, accept: 'application/json', headers: { 'x-sea-credit': tok } }); assert.equal(g.j.token.left, 0);
});

console.log('CR8: a settlement whose answer never came back (the chain asked on its own timer, never in a request)');
// the facilitator verifies, but its answer to settle is lost (no word either way: the sale stays pending)
const lost = (onSettle = () => {}) => (kind) => { if (kind === 'settle') onSettle(); return kind === 'verify' ? answer({ isValid: true, payer: PAYER }) : answer({ error: 'upstream timed out' }, 504); };
const minted = [];
const buyLost = async (o = {}, onSettle) => {
  facilitator = lost(onSettle); const nonce = `0x${randomBytes(32).toString('hex')}`, at = T0;
  const r = await buy(payment({ nonce, ...o })); await settled();
  assert.equal(r.status, 200, r.text.slice(0, 200)); assert.equal(r.j.paid.status, 'pending', 'handed out while its settlement has not answered'); minted.push(r.j.token);
  return { nonce, at, sale: r.j.paid.sale, token: r.j.token };
};
const saleOf = (id) => node.ledger.mem.sales.find((x) => x.id === id);
const peek = async (tok) => (await node.call('/reader/credit', { ip: fresh(), accept: 'application/json', headers: { 'x-sea-credit': tok } })).j.token;
// one run of the re-check (what the timer does once a minute, and serve.mjs at the start)
const tick = () => node.core.startCredit(node.db, node.cfg);
// a restart: the node's book and all it held in memory are gone, the state stays; the new one checks at its start
const restart = (c = {}) => { node.db.creditBook?.close?.(); delete node.db.creditBook; return node.core.startCredit(node.db, { ...node.cfg, ...c }); };
let freeNet = null;
const pastFree = async () => { const day = new Date(T0).toISOString().slice(0, 10); if (freeNet?.day !== day) { freeNet = { ip: fresh(), day }; await useFree(node, freeNet.ip); } return freeNet.ip; };
await proof('settle answer lost, the authorization unused on Base: nothing decided before its time or in a request; then taken back (429 "taken back"), the sale unsettled in the till', async () => {
  const b = await buyLost(), ip = await pastFree();
  const r1 = await node.call(`/r/${nextPage()}`, { ip, headers: { 'x-sea-credit': b.token } }); assert.equal(r1.status, 200); assert.equal(r1.h['x-sea-credit-left'], '49', 'a credit whose settlement is on its way reads');
  assert.equal(saleOf(b.sale).status, 'pending'); const a0 = chain.asked.length;
  let x = await tick(); assert.equal(x.asked, 0, 'nothing is due before its time');
  T0 = Math.max(T0, b.at + 11 * 60e3);
  const r2 = await node.call(`/r/${nextPage()}`, { ip, headers: { 'x-sea-credit': b.token } }); assert.equal(r2.status, 200, 'a request decides nothing'); assert.equal(chain.asked.length, a0, 'a request asks no chain');
  x = await tick(); assert.equal(x.asked, 1); assert.equal(x.revoked, 1); assert.equal(x.settled, 0);
  const q = chain.asked.at(-1); assert.equal(q.nonce, b.nonce); assert.equal(q.from, PAYER.toLowerCase()); assert.equal(q.selector, '0xe94a0102'); assert.equal(q.to, USDC);
  const r3 = await node.call(`/r/${nextPage()}`, { ip, headers: { 'x-sea-credit': b.token } }); assert.equal(r3.status, 429); assert.match(r3.j.error.message, /taken back/);
  assert.equal(saleOf(b.sale).status, 'unsettled', 'the till shows it did not settle'); assert.equal((await peek(b.token)).state, 'revoked');
  assert.equal((await tick()).asked, 0, 'decided once');
});
await proof('settle answer lost, the authorization used on Base: settled in the till (/treasury counts the money), the credit keeps its pages', async () => {
  const s0 = await salesOf(), b = await buyLost(); chain.used.add(b.nonce);
  T0 = Math.max(T0, b.at + 11 * 60e3);
  const x = await tick(); assert.equal(x.asked, 1); assert.equal(x.settled, 1); assert.equal(x.revoked, 0);
  assert.equal(saleOf(b.sale).status, 'settled'); assert.ok(saleOf(b.sale).settled_at, 'settled_at set, as for a settlement that answered');
  const s1 = await salesOf(); assert.equal(Math.round(s1.total_usd * 100), Math.round(s0.total_usd * 100) + 5, 'the money counts as arrived'); assert.equal(s1.total_count, s0.total_count + 1);
  const g = await peek(b.token); assert.equal(g.state, 'ok'); assert.equal(g.left, 50);
  const ip = await pastFree(), r = await node.call(`/r/${nextPage()}`, { ip, headers: { 'x-sea-credit': b.token } }); assert.equal(r.status, 200); assert.equal(r.h['x-sea-credit-left'], '49');
  assert.equal((await tick()).asked, 0, 'decided once');
});
await proof('the chain unreachable or without a clear answer: nothing taken back, nothing settled, counted, asked again a minute later; once it answers, the right outcome follows', async () => {
  const u = await buyLost(), s = await buyLost(); chain.used.add(s.nonce);
  T0 = Math.max(T0, s.at + 11 * 60e3); const c0 = node.db.creditBook.state().unclear;
  try {
    chain.mode = 'down'; let x = await tick(); assert.equal(x.asked, 2); assert.equal(x.unclear, 2); assert.equal(x.revoked, 0); assert.equal(x.settled, 0);
    chain.mode = 'garbage'; T0 += 60e3; x = await tick(); assert.equal(x.asked, 2); assert.equal(x.unclear, 2); assert.equal(x.revoked, 0);
    assert.equal(node.db.creditBook.state().unclear, c0 + 4, 'counted');
    for (const b of [u, s]) { assert.equal((await peek(b.token)).state, 'ok'); assert.equal(saleOf(b.sale).status, 'pending'); }
    chain.mode = 'up'; T0 += 60e3; x = await tick(); assert.equal(x.revoked, 1); assert.equal(x.settled, 1);
  } finally { chain.mode = 'up'; }
  assert.equal((await peek(u.token)).state, 'revoked'); assert.equal(saleOf(u.sale).status, 'unsettled');
  assert.equal((await peek(s.token)).state, 'ok'); assert.equal(saleOf(s.sale).status, 'settled');
});
await proof('a restart between verify and settle: the open sale was written before the settlement was asked for, and the check at the start decides it', async () => {
  let before = -1; const u = await buyLost({}, () => { before = node.kv.sets.length; });
  assert.ok(before > 0 && node.kv.sets.slice(0, before).some((l) => l.startsWith('["credit:open"') && l.includes(u.nonce)), 'on the disk before the settlement was asked for');
  const s = await buyLost(); chain.used.add(s.nonce);
  T0 = Math.max(T0, s.at + 11 * 60e3);
  const x = await restart(); assert.equal(x.asked, 2); assert.equal(x.revoked, 1); assert.equal(x.settled, 1);
  assert.equal((await peek(u.token)).state, 'revoked'); assert.equal(saleOf(u.sale).status, 'unsettled');
  assert.equal((await peek(s.token)).state, 'ok'); assert.equal(saleOf(s.sale).status, 'settled');
});
await proof('before validBefore nothing is decided: a transfer valid 20 minutes (terms of 1200 s) is not asked about after 11 minutes nor at validBefore; a minute after it, it is', async () => {
  facilitator = lost(); const nonce = `0x${randomBytes(32).toString('hex')}`, at = T0, before = Math.floor(T0 / 1000) + 1200;
  const r = await node.call('/reader/credit', { method: 'POST', accept: 'application/json', ip: fresh(), headers: payment({ nonce, before }), c: { pay: { ...node.PAY, window: 1200 } } }); await settled();
  assert.equal(r.status, 200, r.text.slice(0, 200)); assert.equal(r.j.paid.status, 'pending'); minted.push(r.j.token);
  const a0 = chain.asked.length;
  T0 = Math.max(T0, at + 11 * 60e3); assert.equal((await tick()).asked, 0, 'ten minutes, validBefore not past');
  T0 = Math.max(T0, before * 1000); assert.equal((await tick()).asked, 0, 'at validBefore');
  assert.equal(chain.asked.length, a0); assert.equal((await peek(r.j.token)).state, 'ok'); assert.equal(saleOf(r.j.paid.sale).status, 'pending');
  T0 = Math.max(T0, before * 1000 + 61e3); const x = await tick(); assert.equal(x.revoked, 1); assert.equal((await peek(r.j.token)).state, 'revoked');
});
await proof('the validBefore bound: a signed transfer that holds longer than maxTimeoutSeconds and a minute, or names no validBefore, is not taken (402, the facilitator never asked, nothing sold); at the bound it buys', async () => {
  facilitator = settles(); const a0 = asked.length, s0 = (await salesOf()).total_count, now = Math.floor(T0 / 1000);
  for (const p of [payment({ before: now + 361 }), payment({ before: now + 361, version: 1 }), payment({ before: now + 30 * 86400 }), payment({ before: null }), payment({ before: null, version: 1 }), payment({ before: 'soon' })]) {
    const r = await buy(p); assert.equal(r.status, 402); assert.match(String(r.j.error), /validBefore/); assert.equal(r.j.token, undefined);
  }
  assert.equal(asked.length, a0, 'the facilitator was never asked'); assert.equal((await salesOf()).total_count, s0, 'nothing sold');
  for (const version of [1, 2]) { const ok = await buy(payment({ before: now + 360, version })); assert.equal(ok.status, 200, ok.text.slice(0, 200)); await settled(); }
});
await proof('the chain check off (chainRpc off, MARE_BASE_RPC=off): the re-check asks nothing and takes nothing back; switched on again, it decides', async () => {
  const b = await buyLost(); T0 = Math.max(T0, b.at + 11 * 60e3); const a0 = chain.asked.length;
  let x = await restart({ chainRpc: 'off' }); assert.equal(x.asked, 0); assert.equal(x.off, true);
  process.env.MARE_BASE_RPC = 'off'; try { x = await restart({ chainRpc: undefined }); assert.equal(x.asked, 0); assert.equal(x.off, true); } finally { delete process.env.MARE_BASE_RPC; }
  assert.equal(chain.asked.length, a0, 'no chain question'); assert.equal((await peek(b.token)).state, 'ok'); assert.equal(saleOf(b.sale).status, 'pending');
  x = await restart(); assert.equal(x.revoked, 1, 'on again: decided');
});
await proof('bounded: at most 20 chain questions a run, the ones not yet asked first; the rest the next minute', async () => {
  const list = []; for (let i = 0; i < 23; i++) list.push(await buyLost());
  T0 = Math.max(T0, list.at(-1).at + 11 * 60e3);
  try {
    chain.mode = 'down'; const a0 = chain.asked.length; let x = await tick(); assert.equal(x.asked, 20); assert.equal(chain.asked.length - a0, 20); assert.equal(x.open, 23);
    chain.mode = 'up'; T0 += 60e3; const a1 = chain.asked.length; x = await tick(); assert.equal(x.asked, 20); assert.equal(x.revoked, 20);
    assert.deepEqual(chain.asked.slice(a1, a1 + 3).map((q) => q.nonce).sort(), list.slice(20).map((b) => b.nonce).sort(), 'the three not asked before come first');
    T0 += 60e3; x = await tick(); assert.equal(x.asked, 3); assert.equal(x.revoked, 3); assert.equal(x.open, 0);
  } finally { chain.mode = 'up'; }
});
await proof('the re-check runs on its own timer (once a minute in a node, here every 30 ms), not in a request', async () => {
  const b = await buyLost(); T0 = Math.max(T0, b.at + 11 * 60e3);
  node.db.creditBook?.close?.(); delete node.db.creditBook;
  try {
    const g = await node.call('/reader/credit', { ip: fresh(), accept: 'application/json', headers: { 'x-sea-credit': b.token }, c: { creditSweepMs: 30 } });
    assert.equal(g.j.token.state, 'ok', 'the request that made the book decided nothing');
    for (let i = 0; i < 200 && (await node.db.creditBook.peek(sha(b.token))).state === 'ok'; i++) await new Promise((ok) => setTimeout(ok, 10));
    assert.equal((await node.db.creditBook.peek(sha(b.token))).state, 'revoked', 'the timer took it back');
  } finally { node.db.creditBook?.close?.(); delete node.db.creditBook; }
});
await proof('credit:open is bounded: an entry whose chain answer stays unclear is kept and asked each run, and goes (counted) when its token expires, the chain check off as well; the till keeps the sale as it stands', async () => {
  const u = await buyLost(); T0 += 60e3; const w = await buyLost(); T0 = Math.max(T0, w.at + 11 * 60e3);
  const openNow = () => { const l = node.kv.sets.filter((x) => x.startsWith('["credit:open"')).at(-1); return l ? JSON.parse(l)[1].list.map((e) => e.nonce) : []; };
  try {
    chain.mode = 'down'; let x = await tick(); assert.equal(x.unclear, 2); assert.deepEqual(openNow().sort(), [u.nonce, w.nonce].sort());
    T0 = Math.max(T0, u.at + 30 * 86400e3 - 1000); x = await tick(); assert.equal(x.expired, 0); assert.equal(x.unclear, 2, 'a second before the expiry: still kept, still asked');
    const e0 = node.db.creditBook.state().expired;
    T0 = Math.max(T0, u.at + 30 * 86400e3); x = await tick(); assert.equal(x.expired, 1); assert.equal(x.asked, 1, 'only the one still in its 30 days is asked');
    assert.deepEqual(openNow(), [w.nonce], 'gone from the state'); assert.equal(node.db.creditBook.state().expired, e0 + 1, 'counted');
    assert.equal(saleOf(u.sale).status, 'pending', 'the till keeps the sale as it stands'); assert.equal((await peek(u.token)).state, 'expired');
    T0 = Math.max(T0, w.at + 30 * 86400e3); x = await restart({ chainRpc: 'off' }); assert.equal(x.off, true); assert.equal(x.asked, 0); assert.equal(x.expired, 1, 'the check off: it goes at the expiry too');
    assert.deepEqual(openNow(), []);
  } finally { chain.mode = 'up'; node.db.creditBook?.close?.(); delete node.db.creditBook; }
});
await proof('the open sales keep wallet, nonce and validBefore with the sale and its time: never the signature, never a token', async () => {
  const lines = node.kv.sets.filter((l) => l.startsWith('["credit:open"')); assert.ok(lines.length > 10);
  for (const l of lines) for (const e of JSON.parse(l)[1].list) assert.deepEqual(Object.keys(e).sort(), ['at', 'before', 'from', 'nonce', 'sale']);
  assert.ok(!node.kv.sets.some((l) => l.includes('ab'.repeat(65))), 'no signature in the state');
  assert.ok(minted.length > 30); for (const t of minted) assert.ok(!node.kv.sets.some((l) => l.includes(t) || l.includes(t.slice(4))), 'no token in the state');
  assert.ok(!logs.some((l) => minted.some((t) => l.includes(t.slice(4)))), 'no token in a log');
});

console.log('the texts that say it');
await proof('terms § 5a (DE, EN), the price lists, the privacy notice, /reader, /reader.json and llms.txt name price, pages, days, refund, bearer secret, hash', async () => {
  const ip = fresh(), get = async (p) => (await node.call(p, { ip, accept: 'text/html' })).text;
  const agb = await get('/de/agb'), terms = await get('/terms'), preise = await get('/de/preise'), pricing = await get('/pricing'), ds = await get('/de/datenschutz'), pv = await get('/privacy'), rd = await get('/reader');
  assert.match(agb, /id="s5a"[^>]*>§ 5a Leser-Guthaben/); for (const s of ['0,05 USD für 50 Seiten', '30 Tage', 'nicht erstattet, soweit das Gesetz nichts anderes vorschreibt', 'Inhaberschlüssel', 'genau dieser Betrag']) assert.ok(agb.includes(s), s);
  assert.match(terms, /id="s5a"[^>]*>§ 5a Reader credit/); for (const s of ['USD 0.05 for 50 pages', '30 days', 'not refunded except where the law requires', 'bearer secret', 'exactly this amount']) assert.ok(terms.includes(s), s);
  assert.ok(preise.includes('Leser-Guthaben') && preise.includes('0,05 USDC für 50 Seiten')); assert.ok(pricing.includes('id="credit"') && pricing.includes('0.05 USDC'));
  assert.ok(ds.includes('Leser-Guthaben') && ds.includes('Hashwert (SHA-256)')); assert.ok(pv.includes('reader credit') && pv.includes('hash (SHA-256)'));
  assert.ok(rd.includes('id="credit"') && rd.includes('/reader/credit') && rd.includes('x-sea-credit'));
  const j = await node.call('/reader.json', { ip, accept: 'application/json' }); assert.match(j.j.credit.buy, /exactly 0\.05 USDC/);
  assert.match(readFileSync(join(ROOT, 'site/llms.txt'), 'utf8'), /reader\/credit/);
});

// ------------------------------------------------------------------ negative controls
const BREAK = [
  ['delivery without a verified payment (strict off)', 'node/core.mjs', "work: (sale) => book.mint(sale, claim), callerHash: caller(), waitUntil: cfg.waitUntil, base, label: 'credit', strict: true });", "work: (sale) => book.mint(sale, claim), callerHash: caller(), waitUntil: cfg.waitUntil, base, label: 'credit', strict: false });"],
  ['any amount above the price taken', 'node/credit.mjs', 'if (v !== BigInt(t.atomic)) return', 'if (v < BigInt(t.atomic)) return'],
  ['the token kept in clear', 'node/credit.mjs', 'await serial(h, async () => { await put(T(h), rec, ttlOf(rec.until), true);', 'await serial(h, async () => { await put(T(h), { ...rec, token }, ttlOf(rec.until), true);'],
  ['any Authorization read as credit', 'node/credit.mjs', "if (a == null || !/^\\s*bearer\\s+mlc_/i.test(a)) return null;", 'if (a == null) return null;'],
  ['credit spent before the free pages', 'node/lens.mjs', "try { await allow(ctx, 'read', 100, 86400); } catch {\n          // prepaid", "if (ctx?.credit) await ctx.credit.spend(); try { await allow(ctx, 'read', 100, 86400); } catch {\n          // prepaid"],
  ['expiry ignored', 'node/credit.mjs', "r.revoked ? 'revoked' : Date.parse(r.until) <= now() ? 'expired' :", "r.revoked ? 'revoked' :"],
  ['spending not one after the other (double spend)', 'node/credit.mjs', 'const serial = (k, fn) => {', 'const serial = (k, fn) => fn(); const serial0 = (k, fn) => {'],
  ['a payment buys twice', 'node/core.mjs', 'if (claim.used) return creditRequired(', 'if (false) return creditRequired('],
  ['a failed settlement keeps its credit', 'node/core.mjs', "if (patch?.status && patch.status !== 'settled' && patch.status !== 'pending') book.revokeSale(id).catch(() => {});", ''],
  ['credit not in the till\'s books', 'node/core.mjs', "q: `reader credit: ${CREDIT.pages} pages`, ledger: books,", "q: `reader credit: ${CREDIT.pages} pages`, ledger: { sale: (row) => ({ ...row, id: 'nobook' }), saleSet: () => {} },"],
  ['the line on credit added to every error (non-payers and others changed)', 'node/core.mjs', 'const more = e.readLimit ? creditHint(base, e.readLimit === true ? null : e.readLimit) : null;\n      return fin(', 'const more = creditHint(base, null);\n      return fin('],
  ['the app door changed', 'node/core.mjs', "read_page: 'Read a public web page as clean Markdown (title, description, main text, links), up to 100 pages a day per address.", "read_page: 'Read a public web page as clean Markdown (title, description, main text, links), up to 100 pages a day per network."],
  ['§ 5a without the refund rule', 'node/legal.mjs', 'Nicht genutzte Seiten werden nicht erstattet, soweit das Gesetz nichts anderes vorschreibt; ', ''],
  // CR8: a settlement whose answer never came back
  ['the re-check removed (a sale whose settlement never answered keeps its credit)', 'node/credit.mjs', 'if (!rpc) return { asked: 0, off: true, expired, open: open.list.length };', 'return { asked: 0, off: true, expired, open: open.list.length };'],
  ['credit:open kept past the token\'s expiry (an entry never clear stays for good)', 'node/credit.mjs', 'open.list.filter((x) => Date.parse(x.at) + CREDIT.days * DAY * 1000 <= t)', 'open.list.filter((x) => false)'],
  ['revoke on a chain error (no clear answer taken for "not used")', 'node/credit.mjs', 'else if (word === false) {', 'else if (word !== true) {'],
  ['revoke before validBefore (only the ten minutes waited for)', 'node/credit.mjs', 'const openDue = (e) => Math.max(e.before * 1000 + GRACE, Date.parse(e.at) + WAIT);', 'const openDue = (e) => Date.parse(e.at) + WAIT;'],
  ['a used authorization revoked anyway', 'node/credit.mjs', 'if (word === true) { await closeOpen(e.sale);', 'if (word === true) { await book.revokeSale(e.sale);'],
  ['a transfer valid far beyond the terms taken (no validBefore bound)', 'node/credit.mjs', 'if (!Number.isSafeInteger(before) || before > most) return', 'if (!Number.isSafeInteger(before)) return'],
];
let caught = 0;
if (CONTROLS) {
  console.log('\nnegative controls: each rule broken in a copy, the proof must fail there');
  for (const [what, f, from, to] of BREAK) {
    const tmp = mkdtempSync(join(tmpdir(), 'mare-credit-ctl-'));
    try {
      for (const d of ['node', 'site', 'proof', 'config', 'public', 'engines']) if (existsSync(join(ROOT, d))) cpSync(join(ROOT, d), join(tmp, d), { recursive: true });
      mkdirSync(join(tmp, 'tools'), { recursive: true }); cpSync(join(ROOT, 'tools/credit-proof.mjs'), join(tmp, 'tools/credit-proof.mjs'));
      for (const x of ['package.json', 'server.json', 'server-dev.json', 'server-lean.json', 'gemini-extension.json', 'serve.mjs']) if (existsSync(join(ROOT, x))) cpSync(join(ROOT, x), join(tmp, x));
      const src = readFileSync(join(tmp, f), 'utf8');
      if (!src.includes(from)) { console.log(`  FAIL control "${what}": the line to break is gone from ${f}; the control needs updating`); continue; }
      writeFileSync(join(tmp, f), src.replace(from, to));
      const run = spawnSync(process.execPath, ['tools/credit-proof.mjs', '--no-controls'], { cwd: tmp, encoding: 'utf8', timeout: 600_000, env: { ...process.env, MARE_CREDIT_REF_DIR: refDir || '', MARE_CREDIT_FIRST_FAIL: '1' } });
      const held = /(\d+) proofs held, (\d+) failed/.exec(run.stdout || '');
      if (run.status !== 0 && held && Number(held[2]) > 0) { caught++; console.log(`  ok   caught: ${what} (${(/FAIL ([^\n]+)/.exec(run.stdout) || [])[1]?.slice(0, 90) || ''})`); }
      else console.log(`  FAIL not caught: ${what} (exit ${run.status}${held ? `, ${held[0]}` : ''}${run.stderr ? `; ${String(run.stderr).split('\n')[0].slice(0, 160)}` : ''})`);
    } finally { rmSync(tmp, { recursive: true, force: true }); }
  }
  console.log(`${caught} of ${BREAK.length} controls caught`);
}
console.log(`\n${passed} proofs held, ${failed} failed`);
if (refDir && !process.env.MARE_CREDIT_REF_DIR) rmSync(refDir, { recursive: true, force: true });
process.exit(failed || (CONTROLS && caught !== BREAK.length) ? 1 : 0);
