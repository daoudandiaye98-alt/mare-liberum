// Mare Liberum · proof of the harbour toll (3.37, "Der Hafenzoll", node/toll.mjs): up to 10,000 tokens saved by the
// lossless levers stay free per network and UTC day; above that an answer costs 20 % of what it saved at the mid price of
// /savings (USD 2 per million), accrued in millionths of a dollar and settled over x402 in one payment from $0.05; a caller
// that does not pay gets the normal answer, the lever not applied; nobody is blocked.
// It proves, on nodes in this process (handle, as serve.mjs answers) and, for the restarts, on runs of serve.mjs:
//   the numbers of config/toll.json and the formula, exactly (integers, rounded down); the free quota to the token, the
//   answer that crosses it paying only for the part above; the open sum the exact sum of the prices the answers named, an
//   answer priced $0.000000 never tolled; below the quota every lever answer byte for byte what the toll switched off sends
//   and what origin/main (3.36.0) sends; the toll's headers on every tolled answer; from $0.05 the 402 (x402 v1 and v2,
//   exact, USDC on Base, the till's wallet) for a caller that pays and the normal answer for one that does not, on every
//   lever, the lossy levers of the request still applied (budget= with since=, q and budget on /compress); a settled payment
//   clears the toll; a payment header that pays another wallet or sum is left alone (and on /via/ never forwarded); a
//   refused, failed, unanswered or replayed payment clears nothing; a payment still on its way holds the toll and, past its
//   time or at a start, is settled or released by the chain's word (USDC authorizationState on Base); two payers at once
//   both get an answer; a paid request whose door then fails still carries the payment's response; POST /fair/pay settles
//   toll ids from their own network only; the toll's books apart from the database's sales, fair share and the paid move;
//   networks apart (an IPv6 /48 one network), the cap of networks closed (the normal answers); the UTC day; a restart, a
//   hard stop after a payment, a stop that is cut short; no caller told apart by its name; a HEAD of /r/ that says nothing
//   for free; no key of the accounts in the state, and no toll without a server secret; switched off or resting, every door
//   byte for byte origin/main, the pages that describe the toll the only ones apart; the registry of fair share keeps a
//   payment recorded while it is read; the pages that say all this.
// Negative controls at the end: each rule broken in a copy of the code, and this proof must fail there.
// Runs without the network (this machine and local git only): node tools/toll-proof.mjs   (exit code 1 when a proof fails
// or a control is not caught)
//   --no-controls          only the proofs (the controls run this file that way in each broken copy)
//   MARE_TOLL_REF=<ref>     the release the toll must leave byte for byte when off or resting (default 4054f80: 3.36.0 with the legal texts)
//   MARE_TOLL_REF_DIR=<dir> that release as a tree already extracted (the controls hand it on; no git in their copies)
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, cpSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash, hkdfSync, randomBytes } from 'node:crypto';
import { createServer, connect } from 'node:net';
import { Buffer } from 'node:buffer';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTROLS = !process.argv.includes('--no-controls');
// (the proofs on runs of serve.mjs: with the controls, and in the control that breaks serve.mjs itself)
const SERVE_PROOFS = CONTROLS || process.argv.includes('--serve');
for (const k of ['MARE_TOLL', 'MARE_ENGINE', 'MARE_FAIR', 'MARE_X402_FACILITATOR', 'MARE_PAY_TO', 'MARE_ROUTE_PRICE_CENTS', 'MARE_STATE', 'MARE_DB_URL', 'MARE_DB_KEY', 'MARE_DB_SECRET', 'MARE_BASE_RPC']) delete process.env[k];
process.env.MARE_VIA_SECRET = 'toll-proof-via-key, a test value';
const RPC = 'https://rpc.toll-proof.dev'; process.env.MARE_BASE_RPC = RPC;
let passed = 0, failed = 0;
// (a control only needs one proof to fail: its runs stop at the first, MARE_TOLL_FIRST_FAIL=1)
const proof = async (name, fn) => {
  try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 6).join('\n       ')}`); }
  if (failed && process.env.MARE_TOLL_FIRST_FAIL === '1') { console.log(`\n${passed} proofs held, ${failed} failed (stopped at the first)`); process.exit(1); }
};

// ------------------------------------------------------------------ one clock for every node of the proof, moved on purpose
const D = globalThis.Date; let T0 = D.parse('2026-11-25T12:00:00.000Z');
class Clock extends D { constructor(...a) { if (a.length) super(...a); else super(T0); } static now() { return T0; } }
globalThis.Date = Clock;
const setNow = (iso) => { T0 = D.parse(iso); };
const later = (s) => { T0 += s * 1000; };

// ------------------------------------------------------------------ the world of the proof: a facilitator, Base, pages, one x402 provider
const BASE = 'https://mare.test', FAC = 'https://facilitator.test', PROVIDER = 'https://provider.toll-proof.dev', PROVIDER_WALLET = '0x3333333333333333333333333333333333333333';
let facilitator = () => { throw new Error('the facilitator must not be asked'); }; const asked = [];
// Base: USDC's authorizationState(authorizer, nonce) answered by chain(from, nonce): true (used), false (not used), null (no answer)
let chain = () => null; const rpcAsked = [];
const PAGES = new Map(), fetched = [], provided = [];
const realFetch = globalThis.fetch;
const answer = (j, status = 200, h = {}) => new Response(JSON.stringify(j), { status, headers: { 'content-type': 'application/json', ...h } });
const TABLE = { berths: Array.from({ length: 60 }, (_, i) => ({ id: i + 1, pier: `pier ${1 + (i % 6)}`, depth: 7.5, length: 120 + i, free: i % 3 === 0 })) };
globalThis.fetch = async (u, o = {}) => {
  const s = String(u?.url ?? u);
  if (s.startsWith(FAC)) { const kind = s.slice(FAC.length + 1), body = JSON.parse(o.body); asked.push({ kind, body }); return facilitator(kind, body); }
  if (s === RPC) {
    const b = JSON.parse(o.body), data = String(b?.params?.[0]?.data || ''); rpcAsked.push(b);
    const w = chain(`0x${data.slice(34, 74)}`.toLowerCase(), `0x${data.slice(74, 138)}`.toLowerCase());
    return w == null ? answer({ jsonrpc: '2.0', id: b.id, error: { code: -32000, message: 'unavailable' } }) : answer({ jsonrpc: '2.0', id: b.id, result: `0x${(w ? 1 : 0).toString(16).padStart(64, '0')}` });
  }
  if (/^http:\/\/127\.0\.0\.1:\d+\//.test(s)) return realFetch(u, o); // the nodes of the restart proofs, on this machine
  if (/\/robots\.txt$/.test(s)) return new Response('User-agent: *\nAllow: /\n', { status: 200, headers: { 'content-type': 'text/plain' } });
  if (s.startsWith(PROVIDER)) {
    // an x402 provider: 402 without a payment, a JSON table with one (a table TOON spares a lot on)
    const h = o.headers || {}, pay = h['payment-signature'] || h['x-payment'] || null; provided.push({ url: s, pay });
    if (!pay) return answer({ x402Version: 1, error: 'X-PAYMENT header is required', accepts: [{ scheme: 'exact', network: 'base', maxAmountRequired: '10000', payTo: PROVIDER_WALLET }] }, 402);
    return answer(TABLE, 200, { 'payment-response': Buffer.from(JSON.stringify({ success: true, transaction: `0x${'77'.repeat(32)}` })).toString('base64') });
  }
  if (PAGES.has(s)) { fetched.push(s); return new Response(PAGES.get(s), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }); }
  throw new Error(`the proof does not use the network: ${s.slice(0, 80)}`);
};
createRequire(import.meta.url)('node:dns').promises.lookup = async () => [{ address: '93.184.216.34', family: 4 }];
const PAYER = '0x2222222222222222222222222222222222222222';
const settles = (tx = `0x${randomBytes(32).toString('hex')}`) => (kind) => answer(kind === 'verify' ? { isValid: true, payer: PAYER } : { success: true, transaction: tx, network: 'eip155:8453', payer: PAYER });
// verified, and the settlement never comes back (a timeout at the till): the payment stays on its way
const hangs = () => (kind) => (kind === 'verify' ? answer({ isValid: true, payer: PAYER }) : Promise.reject(Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' })));

// a page of the harbour, long enough that reading it again spares thousands of tokens
const WORDS = 'anchor ballast beacon buoy cargo chart crane dock draught ebb fender gangway hull jetty keel ledger lock mooring navigation pilot quay rope rudder sail signal slipway stern swell tide tug wharf winch harbour bollard current'.split(' ');
const pageOf = (seed0, sections = 60, extra = '') => { let seed = seed0; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648; const sent = () => { const w = Array.from({ length: 9 + Math.floor(rnd() * 8) }, () => WORDS[Math.floor(rnd() * WORDS.length)]); w[0] = w[0][0].toUpperCase() + w[0].slice(1); return `${w.join(' ')}.`; }; const para = () => Array.from({ length: 4 }, sent).join(' ');
  return `<!doctype html><html><head><title>Harbour handbook ${seed0}</title></head><body><nav><a href="/">Home</a></nav><main><h1>Harbour handbook ${seed0}</h1>${Array.from({ length: sections }, (_, i) => `<h2>Section ${i + 1}</h2><p>${para()}</p><p>${para()}</p>`).join('\n')}${extra}</main></body></html>`; };
// a text for /compress whose lossless steps spare about 180,000 tokens (HTML to the reader's Markdown): one crosses the quota
const BIG = `<html><body>${Array.from({ length: 6000 }, (_, i) => `<div class="c-${i} wrap" style="margin:0;padding:0" data-x="${i}"><span class="s">line ${i} of the harbour handbook</span></div>`).join('\n')}</body></html>`;
// (since the quota is 10,000: a text that crosses it and stays below $0.05, about 60,000 spared tokens)
const OVER = `<html><body>${Array.from({ length: 2000 }, (_, i) => `<div class="c-${i} wrap" style="margin:0;padding:0" data-x="${i}"><span class="s">line ${i} of the harbour handbook</span></div>`).join('\n')}</body></html>`;
const MID = `<html><body>${Array.from({ length: 300 }, (_, i) => `<div class="m-${i}" style="margin:0"><span>berth ${i} of the inner harbour</span></div>`).join('\n')}</body></html>`;
// Markdown with what the lossless steps take (white space, a paragraph said twice, tracking parameters) and blocks to fit
const PIERS = Array.from({ length: 40 }, (_, i) => `## Pier ${i + 1}\n\n  The ferry leaves at 0${i % 10}:30 from pier ${i + 1}.   Tickets: https://ferry.toll-proof.dev/t?utm_source=x&id=${i}   \n\nThe harbour office answers every question about berths, cranes and fuel at the quay, all day long.\n\nThe harbour office answers every question about berths, cranes and fuel at the quay, all day long.\n`).join('\n');

// ------------------------------------------------------------------ the nodes: this tree (toll on, off, resting) and origin/main
const SITE = { '/llms.txt': { body: readFileSync(join(ROOT, 'site/llms.txt'), 'utf8'), type: 'text/plain; charset=utf-8' } };
const UA = 'toll-proof-agent/1.0';
const imp = (dir, f) => import(pathToFileURL(join(dir, 'node', f)).href);
const waits = [];
const settled = () => Promise.allSettled(waits.splice(0));
async function nodeOf(rootDir, { cfg: extra = {}, kv: kv0 = null, ledger: led0 = null } = {}) {
  const core = await imp(rootDir, 'core.mjs'), { createMem } = await imp(rootDir, 'mem.mjs'), { memoryKv } = await imp(rootDir, 'flow.mjs');
  const { immune } = await imp(rootDir, 'immune.mjs'), { createLedger } = await imp(rootDir, 'ledger.mjs'), { payConfig } = await imp(rootDir, 'pay.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'mare-toll-')), file = join(dir, 'sea.tsv');
  process.once('exit', () => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });
  writeFileSync(file, ''); writeFileSync(join(dir, 'build.json'), JSON.stringify({ builtAt: '2026-11-20T10:00:00.000Z', entries: 0, lakes: {} }));
  const db = createMem({ file, base: BASE }), kv = kv0 || memoryKv(), ledger = led0 || createLedger({});
  const PAY = { ...payConfig({}), facilitator: FAC, settleWaitMs: 200, verifyMs: 500, settleMs: 4000 };
  const cfg = { base: BASE, kv, ledger, pay: PAY, site: SITE, waitUntil: (p) => { waits.push(p); }, tollSweepMs: 0, ...extra };
  const call = async (path, { method = 'GET', accept = 'application/json', ua = UA, ip, headers = {}, body, head = false, c = {} } = {}) => {
    assert.ok(ip, 'every call of the proof names its network');
    const h = { accept, 'user-agent': ua, 'x-forwarded-for': ip, ...(body !== undefined && typeof body !== 'string' ? { 'content-type': 'application/json' } : {}), ...headers };
    const res = await core.handle(new Request(BASE + path, { method, headers: h, ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}) }), db, { ...cfg, ...c, ...(head ? { head: true } : {}) });
    const buf = res.body ? Buffer.from(await res.arrayBuffer()) : Buffer.alloc(0), text = buf.toString('utf8'); let j = null; try { j = JSON.parse(text); } catch {}
    return { status: res.status, headers: res.headers, h: Object.fromEntries(res.headers), text, j };
  };
  const rpc = (door, method, params, o = {}) => call(door, { method: 'POST', accept: 'application/json, text/event-stream', body: { jsonrpc: '2.0', id: 1, method, ...(params ? { params } : {}) }, ...o });
  await call('/stats', { ua: 'MareLiberum-session/1.0', ip: '127.0.0.1' }); // wakes the sea of the node (db.flow)
  return { core, db, cfg, kv, ledger, PAY, call, rpc, immune, rootDir, version: core.VERSION };
}
// a pace that never stands in the way of the proof (the immune system of each tree is its own)
const calm = (n, rest = []) => n.immune.set({ mode: 'normal', rest, pace: { perMinute: 1_000_000, burst: 1_000_000 } });
// since 3.37.1 the tree without the toll is 3.36.0 with the legal texts (legal/texts at 4054f80): the footer of every page and
// the toll's own § 5 in the terms came with them, so that tree, not origin/main, is what the toll must leave byte for byte
const REF = process.env.MARE_TOLL_REF || '4054f80ad4ca422cd48ad389e5b63fffdc22f099';
const refDir = (() => {
  const given = process.env.MARE_TOLL_REF_DIR; if (given && existsSync(join(given, 'node/core.mjs'))) return given;
  const dir = mkdtempSync(join(tmpdir(), 'mare-toll-ref-'));
  const r = spawnSync('sh', ['-c', 'git -C "$1" archive "$2" | tar -x -C "$3"', 'sh', ROOT, REF, dir], { encoding: 'utf8' });
  return r.status === 0 && existsSync(join(dir, 'node/core.mjs')) ? dir : null;
})();
const ON = await nodeOf(ROOT), OFF = await nodeOf(ROOT, { cfg: { toll: 'off' } }), THEIRS = refDir ? await nodeOf(refDir) : null;
calm(ON); if (THEIRS) calm(THEIRS);
const TOLL = await imp(ROOT, 'toll.mjs'), { TOKEN_PRICE } = await imp(ROOT, 'areas.mjs'), { memoryKv } = await imp(ROOT, 'flow.mjs'), { USDC_BASE } = await imp(ROOT, 'pricing.mjs');
const { RELEASES } = await imp(ROOT, 'open.mjs'), { diskKv } = await imp(ROOT, 'disk.mjs'), { squeeze } = await imp(ROOT, 'squeeze.mjs'), { createFair } = await imp(ROOT, 'fair.mjs'), { encodeVia } = await imp(ROOT, 'via.mjs');
console.log(`nodes: this tree ${ON.version} (toll on, toll off), ${REF} ${THEIRS?.version || 'NOT FOUND (no git tree): the comparisons with it fail'}`);

// ------------------------------------------------------------------ helpers
const TOLL_HDR = ['x-sea-toll', 'x-sea-toll-state', 'x-sea-toll-usd', 'x-sea-toll-tokens', 'x-sea-toll-open-usd', 'x-sea-toll-id', 'x-sea-toll-payment'];
const noToll = (r, what) => { for (const k of TOLL_HDR) assert.equal(r.headers.get(k), null, `${what}: no ${k}`); };
const micro = (usd) => Math.round(Number(usd) * 1e6);
const twoFifths = (t) => Math.floor((t * 2) / 5); // 0.2 × USD 2 per million tokens, in millionths of a dollar: 0.4 a token
const mask = (s, v) => String(s ?? '').replaceAll(v, '<V>').replace(/\br\d{8}[a-z0-9]{8}\b/g, 'r<id>');
const shape = (r, v) => ({ status: r.status, headers: Object.fromEntries([...r.headers.entries()].map(([k, x]) => [k, mask(x, v)]).sort(([a], [b]) => (a < b ? -1 : 1))), body: mask(r.text, v) });
const sameAs = (a, va, b, vb, what) => { const x = shape(a, va), y = shape(b, vb); assert.equal(x.status, y.status, `${what}: status`); assert.deepEqual(x.headers, y.headers, `${what}: headers`); assert.equal(x.body, y.body, `${what}: body`); };
let ipN = 0;
const net = () => { ipN++; return `203.0.${100 + Math.floor(ipN / 250)}.${(ipN % 250) + 1}`; };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64');
const auth = (value, to, nonce, before) => ({ from: PAYER, to, value: String(value), validAfter: '0', validBefore: String(before ?? Math.floor(Date.now() / 1000) + 300), nonce: nonce || `0x${randomBytes(32).toString('hex')}` });
const v2 = (value, { to = ON.PAY.payTo, nonce, amount, before } = {}) => b64({ x402Version: 2, accepted: { scheme: 'exact', network: 'eip155:8453', amount: String(amount ?? value), asset: USDC_BASE, payTo: to, maxTimeoutSeconds: 300, extra: { name: 'USD Coin', version: '2' } }, payload: { signature: `0x${'11'.repeat(65)}`, authorization: auth(value, to, nonce, before) } });
const v1 = (value, { to = ON.PAY.payTo, nonce } = {}) => b64({ x402Version: 1, scheme: 'exact', network: 'base', payload: { signature: `0x${'11'.repeat(65)}`, authorization: auth(value, to, nonce) } });
const counted = [];
const watch = (n) => { const f = n.db.flow, g = f.countEngine.bind(f); f.countEngine = (lever, s, ctx, subject) => { counted.push({ node: n === ON ? 'on' : n === OFF ? 'off' : 'other', lever, saved: s?.saved, lossy: s?.lossy, ip: ctx?.ip }); return g(lever, s, ctx, subject); }; };
watch(ON); watch(OFF);
const acct = async (n, ip) => n.db.tollBook.account(ip);
const openOf = async (n, ip) => TOLL.openMicro(await acct(n, ip));
const books = async (n) => (await n.kv.get('toll:books')) || { total: { micro: 0, n: 0 }, pays: [] };
const compress = (n, ip, body = BIG, o = {}) => n.call('/compress', { method: 'POST', ip, headers: { 'content-type': 'text/html', ...(o.headers || {}) }, body, ...(o.c ? { c: o.c } : {}), ...(o.accept ? { accept: o.accept } : {}), ...(o.ua ? { ua: o.ua } : {}) });
// a network brought past $0.05 the real way: two texts of about 180,000 spared tokens each through /compress
const pause = async (n, ip, o = {}) => { for (let i = 0; i < 4; i++) { const r = await compress(n, ip, BIG, o); if (r.h['x-sea-toll-state'] === 'paused') return r; assert.equal(r.h['x-sea-toll-state'], 'open', 'the toll accrues until it is due'); } throw new Error('four texts and the toll never came due'); };
let pageN = 0;
const newPage = (sections = 60) => { const url = `https://harbour${++pageN}.toll-proof.dev/handbook`; PAGES.set(url, pageOf(pageN, sections)); return url; };
const readCacheKey = (raw) => `read:${createHash('sha256').update(raw).digest('hex').slice(0, 24)}`;
const bare = (etag) => String(etag).replace(/^W\/"|"$/g, '');
const MD = 'text/markdown';

// ================================================================== the numbers and the formula
console.log('the numbers of config/toll.json and the formula');
await proof('config/toll.json: 10,000 free tokens per network and day (since 3.37.2, D1; 100,000 before), a share of 0.2, settled from $0.05, at USD 2 per million (the mid price of /savings, the same number); a value out of its range falls back and says so', () => {
  const raw = JSON.parse(readFileSync(join(ROOT, 'config/toll.json'), 'utf8'));
  assert.deepEqual([raw.freeTokensPerNetworkPerDay, raw.share, raw.settleAtUsd, raw.usdPerMillion], [10000, 0.2, 0.05, 2]);
  assert.equal(raw.usdPerMillion, TOKEN_PRICE.mid, 'the price is the ledger\'s mid price');
  const C = TOLL.TOLL; assert.deepEqual([C.free, C.share, C.settleAtUsd, C.usdPerMillion, C.settleMicro, C.fallback.length], [10000, 0.2, 0.05, 2, 50000, 0]);
  const bad = TOLL.tollConfig({ freeTokensPerNetworkPerDay: -1, share: 0.5, settleAtUsd: 0.01, usdPerMillion: 'x' });
  assert.deepEqual([...bad.fallback].sort(), ['freeTokensPerNetworkPerDay', 'settleAtUsd', 'share', 'usdPerMillion']); assert.equal(bad.share, 0.2); assert.equal(bad.settleMicro, 50000);
});
await proof('the price of tokens above the quota is floor(tokens × 0.2 × USD 2 per million) in millionths of a dollar, in whole numbers: 9,077 tokens cost $0.003630, for every count from 0 to 10^9 checked', () => {
  assert.equal(TOLL.microOf(9077), 3630); assert.equal(TOLL.usd6(TOLL.microOf(9077)), '0.003630');
  for (const t of [0, 1, 2, 3, 4, 5, 6, 7, 10, 49, 50, 999, 1000, 9077, 80419, 100000, 124999, 125000, 1e6, 123456789, 1e9]) assert.equal(TOLL.microOf(t), twoFifths(t), `${t} tokens`);
  let seed = 42; for (let i = 0; i < 5000; i++) { seed = (seed * 1103515245 + 12345) % 2147483648; const t = seed % 3_000_000; assert.equal(TOLL.microOf(t), twoFifths(t), `${t} tokens`); }
  const other = TOLL.tollConfig({ freeTokensPerNetworkPerDay: 10, share: 0.1, settleAtUsd: 0.05, usdPerMillion: 0.1 });
  for (const t of [0, 99, 100, 101, 12345, 10_000_000]) assert.equal(TOLL.microOf(t, other), Math.floor(t / 100), `share 0.1 at USD 0.10: ${t} tokens`);
  assert.equal(TOLL.microOf(-5), 0); assert.equal(TOLL.microOf('nonsense'), 0);
});
await proof('the free quota to the token: an answer that ends exactly at the quota (10,000) is free; the next answers are tolled only once their price is at least $0.000001 (one or two tokens above it cost nothing and are not tolled); an answer that crosses the quota pays only for the part above it; at $0.05 the toll is due (14 answers of 9,077 tokens)', async () => {
  const T = TOLL.createToll({ kv: memoryKv(), sweepMs: 0 });
  const a = await T.account('192.0.2.10');
  const F = TOLL.TOLL.free; let d = T.decide(a, F - 9077); assert.deepEqual([d.state, d.lever, d.tolled], ['free', true, 0]);
  d = T.decide(a, 9077); assert.deepEqual([d.state, d.tolled, a.s], ['free', 0, F], 'exactly at the boundary: free');
  d = T.decide(a, 1); assert.deepEqual([d.state, d.lever, d.micro, a.t, TOLL.openMicro(a)], ['free', true, 0, 0, 0], 'one token above the quota: priced $0.000000, not tolled');
  d = T.decide(a, 2); assert.deepEqual([d.state, a.t, a.n, a.id], ['free', 0, 0, null], 'two tokens: priced $0.000000, not tolled, no toll id');
  d = T.decide(a, 3); assert.deepEqual([d.state, d.tolled, d.micro, d.open], ['open', 3, 1, 1], 'three tokens: $0.000001');
  d = T.decide(a, 9077); assert.deepEqual([d.state, d.tolled, d.micro, d.open], ['open', 9077, 3630, 3631], 'the open sum is the sum of the answers\' prices');
  const b = await T.account('192.0.2.11'); T.decide(b, F - 5000); d = T.decide(b, 9077); assert.deepEqual([d.state, d.free, d.tolled, d.micro], ['open', 5000, 4077, twoFifths(4077)], 'the crossing answer pays for 4,077 tokens');
  const c = await T.account('192.0.2.12'); T.decide(c, F); let k = 0;
  while (k < 100 && (d = T.decide(c, 9077)).state === 'open') k++; // (bounded: a toll that never comes due ends here too)
  assert.equal(k, 14, 'fourteen answers of 9,077 tokens reach $0.05'); assert.equal(d.state, 'paused'); assert.equal(d.lever, false); assert.equal(d.open, 14 * 3630);
  assert.equal(c.t, 14 * 9077, 'nothing of the paused answer was written as tolled'); assert.equal(c.s, F + 14 * 9077);
  assert.deepEqual(T.decide(c, 0), { state: null, lever: true, saved: 0, tolled: 0, micro: 0 }, 'an answer that saved nothing is left as it is');
});
await proof('the open sum is the exact sum of the prices the answers named (F4): 300 answers of 7 tokens above the quota open $0.000600 (each $0.000002), 1,000 answers of 2 tokens open nothing and say nothing; over HTTP the x-sea-toll-usd of every tolled answer adds up to the sum the 402 asks', async () => {
  const T = TOLL.createToll({ kv: memoryKv(), sweepMs: 0 }), a = await T.account('192.0.2.20'); T.decide(a, TOLL.TOLL.free);
  let told = 0; for (let i = 0; i < 300; i++) { const d = T.decide(a, 7); assert.equal(d.micro, 2); told += d.micro; }
  assert.equal(told, 600); assert.equal(TOLL.openMicro(a), 600, 'not floor(2,100 × 0.4) = 840');
  const b = await T.account('192.0.2.21'); T.decide(b, TOLL.TOLL.free);
  for (let i = 0; i < 1000; i++) { const d = T.decide(b, 2); assert.equal(d.state, 'free'); assert.deepEqual(T.headers(d, BASE, b), {}); }
  assert.deepEqual([b.t, b.m, TOLL.openMicro(b), b.id], [0, 0, 0, null]);
  const ip = net(); let sum = 0, page = newPage(60);
  for (let i = 0; i < 4; i++) { const r = await compress(ON, ip); if (r.h['x-sea-toll-usd']) sum += micro(r.h['x-sea-toll-usd']); if (r.h['x-sea-toll-state'] === 'paused') break; }
  assert.equal(await openOf(ON, ip), sum);
  const ask = await ON.call(`/r/${page}?since=e1-0123456789abcdef0123`, { ip, accept: MD, headers: { 'x-sea-toll': 'pay' } }); assert.equal(ask.status, 402);
  assert.equal(Number(ask.j.accepts[0].maxAmountRequired), sum, 'the 402 asks exactly what the answers said');
});

// ================================================================== below the quota: nothing changes
console.log('below the free quota every lever answer is byte for byte what it was');
await proof(`below the quota: TOON, since= and the 304, /compress and /mcp/lean tools/call answer byte for byte as with the toll off and as ${REF} (the version masked), with no toll header`, async () => {
  assert.ok(THEIRS, `a tree of ${REF}`);
  const url = newPage(6), nodes = [ON, OFF, THEIRS], ips = nodes.map(() => net()), got = nodes.map(() => []);
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i], ip = ips[i], first = await n.call(`/r/${url}`, { ip, accept: MD }), tag = first.h.etag;
    got[i].push(first, await n.call(`/r/${url}?since=${bare(tag)}`, { ip, accept: MD }), await n.call(`/r/${url}`, { ip, accept: MD, headers: { 'if-none-match': tag } }),
      await n.call('/routes.json?fmt=toon', { ip }), await n.call('/routes.json', { ip, accept: 'text/toon, application/json;q=0.5' }), await compress(n, ip, MID), await n.call('/compress', { method: 'POST', ip, body: { json: TABLE } }),
      await n.rpc('/mcp/lean', 'tools/call', { name: 'call_tool', arguments: { name: 'build_agent', arguments: {} } }, { ip }), await n.rpc('/mcp/lean', 'tools/list', null, { ip }));
  }
  const names = ['/r/', 'since= unchanged', 'If-None-Match 304', 'fmt=toon', 'Accept: text/toon', '/compress HTML', '/compress JSON', '/mcp/lean call_tool build_agent', '/mcp/lean tools/list'];
  for (let k = 0; k < names.length; k++) { noToll(got[0][k], names[k]); sameAs(got[0][k], ON.version, got[1][k], OFF.version, `${names[k]}: toll on and off`); sameAs(got[0][k], ON.version, got[2][k], THEIRS.version, `${names[k]}: against ${REF}`); }
  assert.equal(got[0][2].status, 304); assert.equal(got[0][3].h['content-type'], 'text/toon; charset=utf-8'); assert.ok(Number(got[0][5].h['x-sea-engine-saved']) > 0);
  assert.equal(JSON.parse(got[0][7].text).result._meta['mareliberum.dev/format'], 'toon', 'the lean result is TOON');
  const a = await acct(ON, ips[0]); assert.ok(a.s > 0 && a.t === 0 && !a.id, 'the free counter counted, nothing tolled, no toll id');
});

// ================================================================== accrual: the crossing answer, the headers, the amounts
console.log('above the quota the toll accrues, and every tolled answer says so');
await proof('the answer that crosses the quota pays exactly for the tokens above it; every tolled answer names this answer\'s toll, the open sum (the sum of the answers\' tolls) and the id; nothing of the toll in a shared cache', async () => {
  const ip = net(), page = newPage(60);
  const c1 = await compress(ON, ip, OVER), saved = Number(c1.h['x-sea-engine-saved']);
  const F = TOLL.TOLL.free; assert.ok(saved > F, `one text spares more than the quota: ${saved}`);
  assert.equal(c1.h['x-sea-toll-state'], 'open'); assert.equal(Number(c1.h['x-sea-toll-tokens']), saved - F, 'only the part above the quota');
  let sum = twoFifths(saved - F);
  assert.equal(micro(c1.h['x-sea-toll-usd']), sum); assert.equal(micro(c1.h['x-sea-toll-open-usd']), sum);
  assert.match(c1.h['x-sea-toll-id'], TOLL.TOLL_ID); const id = c1.h['x-sea-toll-id'];
  assert.match(c1.h['x-sea-toll'], new RegExp(`^${c1.h['x-sea-toll-usd']} USD for this answer: 20 % of ${saved - F} tokens saved above the free ${F} a day, at USD 2 per million; ${c1.h['x-sea-toll-open-usd']} USD open, settled by x402 from 0\\.050000 USD: x-sea-toll: pay with a lever request, or POST https://mare\\.test/fair/pay\\?r=${id}$`));
  assert.equal(c1.h['cache-control'], 'private, no-store'); for (const k of ['x-sea-toll', 'x-sea-toll-id', 'x-sea-toll-open-usd']) assert.ok(c1.h['access-control-expose-headers'].split(',').includes(k), k);
  assert.ok(/^[\x20-\x7e]+$/.test(c1.h['x-sea-toll']), 'the line is ASCII');
  const first = await ON.call(`/r/${page}`, { ip, accept: MD }), tag = bare(first.h.etag);
  noToll(first, 'a page read the first time saves nothing by a lever');
  let tokens = saved - F;
  for (let i = 0; i < 2; i++) {
    const r = await ON.call(`/r/${page}?since=${tag}`, { ip, accept: MD }), s = Number(r.h['x-sea-engine-saved']); tokens += s; sum += twoFifths(s);
    assert.match(r.text, /^Unchanged since e1-/); assert.equal(r.h['x-sea-toll-state'], 'open'); assert.equal(Number(r.h['x-sea-toll-tokens']), s);
    assert.equal(micro(r.h['x-sea-toll-usd']), twoFifths(s)); assert.equal(micro(r.h['x-sea-toll-open-usd']), sum); assert.equal(r.h['x-sea-toll-id'], id);
  }
  const a = await acct(ON, ip); assert.deepEqual([a.t, a.m, a.n, TOLL.openTokens(a), TOLL.openMicro(a)], [tokens, sum, 3, tokens, sum]);
});
await proof('per answer, not once a day: the same text twice is tolled twice (the ledger counts it once, and stays as it is)', async () => {
  const ip = net(), n0 = counted.length;
  const a = await compress(ON, ip, OVER), b = await compress(ON, ip, OVER);
  assert.equal(Number(b.h['x-sea-toll-tokens']), Number(b.h['x-sea-engine-saved']), 'the whole saving of the second answer');
  assert.equal(micro(b.h['x-sea-toll-open-usd']), twoFifths(Number(a.h['x-sea-toll-tokens'])) + twoFifths(Number(b.h['x-sea-toll-tokens'])));
  assert.equal(counted.slice(n0).filter((x) => x.lever === 'squeeze' && x.ip === ip).length, 2, 'the ledger is handed both');
});
await proof('only the lossless part is tolled: TOON with fields= pays for what TOON spared (the projection is lossy and free); /compress with a budget pays for its lossless steps, not for what the budget cut', async () => {
  const ip = net(); await compress(ON, ip, OVER); // above the quota, the toll open and not yet due
  const proj = await OFF.call('/routes.json?fields=topics', { ip: net() }), both = await ON.call('/routes.json?fmt=toon&fields=topics', { ip });
  const toonPart = Number(both.h['x-sea-engine-saved']) - Number(proj.h['x-sea-engine-saved']);
  assert.ok(Number(proj.h['x-sea-engine-saved']) > 0, 'the projection spared tokens'); assert.ok(toonPart > 100, `TOON spared tokens of its own: ${toonPart}`);
  assert.equal(Number(both.h['x-sea-toll-tokens']), toonPart, 'the toll counts only what TOON spared');
  const want = squeeze(PIERS, { type: 'md', budget: 200 }), r = await ON.call('/compress', { method: 'POST', ip, body: { text: PIERS, type: 'md', budget: 200 } });
  assert.ok(want.parts.lossless.saved > 0 && want.parts.lossy?.saved > 0, 'both parts spared tokens'); assert.equal(r.j.lossy, true);
  assert.equal(Number(r.h['x-sea-toll-tokens']), want.parts.lossless.saved, 'the lossless steps only'); assert.ok(Number(r.h['x-sea-toll-tokens']) < Number(r.h['x-sea-engine-saved']));
  assert.equal(micro(r.h['x-sea-toll-usd']), twoFifths(want.parts.lossless.saved));
});

// ================================================================== due: the normal answer for a caller that does not pay
console.log('from $0.05: the normal answer for a caller that does not pay, on every lever');
let P_IP = null, P_PAGE = null, P_TAG = null;
await proof('since= and If-None-Match: the whole page as without them (its ETag and x-sea-delta), status 200, nothing counted; the headers say the toll is paused and how to settle', async () => {
  P_IP = net(); P_PAGE = newPage(60);
  P_TAG = (await ON.call(`/r/${P_PAGE}`, { ip: P_IP, accept: MD })).h.etag;
  await pause(ON, P_IP);
  const first = await ON.call(`/r/${P_PAGE}`, { ip: P_IP, accept: MD }), n0 = counted.length; // the page as it is read now, without since=
  noToll(first, 'a plain read');
  const s = await ON.call(`/r/${P_PAGE}?since=${bare(P_TAG)}`, { ip: P_IP, accept: MD }), m = await ON.call(`/r/${P_PAGE}`, { ip: P_IP, accept: MD, headers: { 'if-none-match': P_TAG } });
  for (const [r, what] of [[s, 'since='], [m, 'If-None-Match']]) {
    assert.equal(r.status, 200, what); assert.equal(r.text, first.text, `${what}: the whole page`); assert.equal(r.h.etag, first.h.etag); assert.equal(r.h['x-sea-delta'], first.h['x-sea-delta']); assert.equal(r.h['x-sea-engine'], undefined);
    assert.equal(r.h['x-sea-toll-state'], 'paused'); assert.match(r.h['x-sea-toll'], /^paused: \d+\.\d{6} USD open, settled by x402 from 0\.050000 USD: x-sea-toll: pay with a lever request, or POST https:\/\/mare\.test\/fair\/pay\?r=t\d{8}[a-z0-9]{8}\. This is the normal answer, without the lever; unpaid tolls are not collected$/);
  }
  assert.equal(counted.slice(n0).filter((x) => x.ip === P_IP && x.lever === 'delta').length, 0, 'what was not spared is not counted');
});
await proof('fmt=toon and Accept: text/toon: the JSON the door answers (a projection with fields= stays: lossy, and free), no TOON', async () => {
  const j = await ON.call('/routes.json', { ip: P_IP }), t = await ON.call('/routes.json?fmt=toon', { ip: P_IP }), a = await ON.call('/routes.json', { ip: P_IP, accept: 'text/toon' });
  for (const r of [t, a]) { assert.match(r.h['content-type'], /^application\/json/); assert.deepEqual(JSON.parse(r.text), JSON.parse(j.text)); assert.equal(r.h['x-sea-toll-state'], 'paused'); assert.equal(r.h['x-sea-engine'], undefined); }
  const f = await ON.call('/routes.json?fmt=toon&fields=topics', { ip: P_IP }); assert.match(f.h['content-type'], /^application\/json/); assert.deepEqual(Object.keys(JSON.parse(f.text)), ['topics']); assert.equal(f.h['x-sea-engine'], 'fields'); assert.equal(f.h['x-sea-toll-state'], 'paused');
});
await proof('/compress without a question or a budget: the text comes back as it was sent, with a status that says so (JSON and plain text); nothing counted', async () => {
  const n0 = counted.length;
  const r = await compress(ON, P_IP, MID); assert.equal(r.status, 200); assert.equal(r.j.out, MID); assert.equal(r.j.tokens.saved, 0); assert.equal(r.j.tokens.after, r.j.tokens.before); assert.deepEqual(r.j.steps, []);
  assert.equal(r.j.status, 'unchanged: the toll is paused'); assert.equal(r.j.toll.state, 'paused'); assert.match(r.j.toll.id, TOLL.TOLL_ID); assert.equal(r.h['x-sea-engine'], undefined); assert.equal(r.h['x-sea-toll-state'], 'paused');
  const p = await compress(ON, P_IP, MID, { accept: 'text/plain' }); assert.equal(p.text, MID); assert.equal(p.h['x-sea-toll-state'], 'paused');
  const j = await ON.call('/compress', { method: 'POST', ip: P_IP, body: { json: TABLE } }); assert.equal(j.j.out, JSON.stringify(TABLE));
  assert.equal(counted.slice(n0).filter((x) => x.ip === P_IP).length, 0);
});
await proof('/mcp/lean tools/call: the result in the form of /mcp (the compact JSON as text and structuredContent) with the toll\'s line in _meta; tools/list stays as it is, also for a caller that asks to pay', async () => {
  const o = JSON.parse((await ON.rpc('/mcp', 'tools/call', { name: 'build_agent', arguments: {} }, { ip: net() })).text).result;
  const r = await ON.rpc('/mcp/lean', 'tools/call', { name: 'call_tool', arguments: { name: 'build_agent', arguments: {} } }, { ip: P_IP }), l = JSON.parse(r.text).result;
  assert.deepEqual(l.structuredContent, o.structuredContent); assert.equal(l.content[0].text, JSON.stringify(l.structuredContent)); assert.equal(l.content[0].text, o.content[0].text);
  assert.match(l._meta['mareliberum.dev/toll'], /^paused: /); assert.equal(r.h['x-sea-toll-state'], 'paused');
  const list = await ON.rpc('/mcp/lean', 'tools/list', null, { ip: P_IP, headers: { 'x-sea-toll': 'pay' } }), ref = await OFF.rpc('/mcp/lean', 'tools/list', null, { ip: net(), headers: { 'x-sea-toll': 'pay' } });
  noToll(list, 'tools/list, even asked to pay'); sameAs(list, ON.version, ref, OFF.version, 'tools/list');
});
await proof('the reader\'s JSON answer knows no since=: asked for it with x-sea-toll: pay while the toll is due, it answers as with the toll off (no 402)', async () => {
  const ipOff = net(); await OFF.call(`/r/${P_PAGE}`, { ip: ipOff, accept: MD }); // both nodes hold the page now
  const a = await ON.call(`/r/${P_PAGE}?since=${bare(P_TAG)}&format=json`, { ip: P_IP, headers: { 'x-sea-toll': 'pay' } }), b = await OFF.call(`/r/${P_PAGE}?since=${bare(P_TAG)}&format=json`, { ip: ipOff, headers: { 'x-sea-toll': 'pay' } });
  assert.equal(a.status, 200); noToll(a, 'the JSON reader'); sameAs(a, ON.version, b, OFF.version, 'the JSON reader');
});
await proof('the lossy levers stay free and act while the toll is due: fields= and budget= alone answer as with the toll off', async () => {
  const ipOff = net(), url = newPage(60);
  for (const p of ['/routes.json?fields=doors', `/r/${url}?budget=300`]) {
    const a = await ON.call(p, { ip: P_IP, accept: p.startsWith('/r/') ? MD : 'application/json' }), b = await OFF.call(p, { ip: ipOff, accept: p.startsWith('/r/') ? MD : 'application/json' });
    noToll(a, p); assert.ok(a.h['x-sea-engine-lossy'] === '1', `${p}: the lossy lever acted`); sameAs(a, ON.version, b, OFF.version, p);
  }
});
await proof('the lossy levers act while the toll is due also beside a lossless one (F3): budget= with since= or If-None-Match answers the page fitted to the budget, as budget= alone does with the toll off; /compress with a budget or a question takes the lossy steps alone on the text as it was sent (F3b)', async () => {
  const ipOff = net(), url = newPage(90);
  const tag = (await ON.call(`/r/${url}`, { ip: P_IP, accept: MD })).h.etag; await OFF.call(`/r/${url}`, { ip: ipOff, accept: MD }); // both hold the page now
  const ref = await OFF.call(`/r/${url}?budget=300`, { ip: ipOff, accept: MD }); assert.match(ref.text, /^Fitted to/);
  const n0 = counted.length;
  for (const [what, r] of [['If-None-Match', await ON.call(`/r/${url}?budget=300`, { ip: P_IP, accept: MD, headers: { 'if-none-match': tag } })], ['since=', await ON.call(`/r/${url}?budget=300&since=${bare(tag)}`, { ip: P_IP, accept: MD })]]) {
    assert.equal(r.status, 200, what); assert.equal(r.text, ref.text, `${what}: the page fitted to the budget`); assert.equal(r.h['x-sea-engine'], 'budget'); assert.equal(r.h['x-sea-engine-lossy'], '1'); assert.equal(r.h['x-sea-toll-state'], 'paused', what);
  }
  assert.deepEqual(counted.slice(n0).filter((x) => x.ip === P_IP).map((x) => x.lever), ['budget', 'budget'], 'the lossy lever is counted as with budget= alone; nothing of since=');
  const m0 = counted.length;
  const want = squeeze(PIERS, { type: 'md', budget: 200, lossless: false }), r = await ON.call('/compress', { method: 'POST', ip: P_IP, body: { text: PIERS, type: 'md', budget: 200 } });
  assert.ok(want.lossy && want.steps.every((x) => !x.lossless), 'the budget alone'); assert.equal(r.status, 200); assert.equal(r.j.out, want.out); assert.equal(r.j.lossy, true); assert.ok(r.j.steps.length && r.j.steps.every((x) => !x.lossless));
  assert.notEqual(r.j.out, squeeze(PIERS, { type: 'md', budget: 200 }).out, 'not the lossless steps and the budget'); assert.equal(r.j.status, 'the lossy steps only: the toll is paused'); assert.equal(r.h['x-sea-toll-state'], 'paused'); assert.equal(r.h['x-sea-engine-lossy'], '1');
  const wq = squeeze(PIERS, { type: 'md', q: 'fuel at the quay', lossless: false }), q = await ON.call('/compress?q=fuel+at+the+quay', { method: 'POST', ip: P_IP, headers: { 'content-type': 'text/markdown' }, body: PIERS, accept: 'text/plain' });
  assert.equal(q.text, wq.out); assert.ok(wq.lossy); assert.equal(q.h['x-sea-toll-state'], 'paused');
  const html = await ON.call('/compress?budget=200', { method: 'POST', ip: P_IP, headers: { 'content-type': 'text/html' }, body: MID }); assert.equal(html.j.out, squeeze(MID, { type: 'html', budget: 200, lossless: false }).out); assert.notEqual(html.j.out, MID); assert.equal(html.j.lossy, true);
  assert.ok(counted.slice(m0).filter((x) => x.ip === P_IP).every((x) => x.lever === 'squeeze' && x.lossy), 'only the lossy part counted');
  const free = (await ON.call('/engine.json', { ip: net() })).j.toll.free; assert.match(free, /they act while the toll is due as well/);
});

// ================================================================== a caller that pays
console.log('a caller that pays: 402 with the exact sum, then the lever answer');
const T402 = async (r, what) => {
  assert.equal(r.status, 402, what); const a = r.j.accepts[0], v = JSON.parse(Buffer.from(r.h['payment-required'], 'base64').toString());
  assert.deepEqual([a.scheme, a.network, a.asset, a.payTo], ['exact', 'base', USDC_BASE, ON.PAY.payTo], `${what}: x402 v1`);
  assert.deepEqual([v.x402Version, v.accepts[0].scheme, v.accepts[0].network, v.accepts[0].asset, v.accepts[0].payTo, v.accepts[0].amount], [2, 'exact', 'eip155:8453', USDC_BASE, ON.PAY.payTo, a.maxAmountRequired], `${what}: x402 v2`);
  assert.equal(r.j.amount_usd, TOLL.usd6(Number(a.maxAmountRequired))); assert.match(a.resource, /\/fair\/pay\?r=t\d{8}[a-z0-9]{8}$/); assert.match(r.j.without, /normal answer comes/);
  return Number(a.maxAmountRequired);
};
let S_IP = null, S_OPEN = 0, S_TX = null, S_PAGE = null, S_TAG = null;
await proof('x-sea-toll: pay on every lever answers 402 with the exact open sum before the door works (the page is not read, the text not squeezed, no tool runs), and asks the facilitator nothing', async () => {
  S_IP = net(); S_PAGE = newPage(60); const first = await ON.call(`/r/${S_PAGE}`, { ip: S_IP, accept: MD }); S_TAG = bare(first.h.etag);
  await pause(ON, S_IP); asked.length = 0;
  const open = await openOf(ON, S_IP); assert.ok(open >= 50000);
  const f0 = fetched.length, n0 = counted.length, pay = { 'x-sea-toll': 'pay' };
  const rs = [await ON.call(`/r/${S_PAGE}?since=${S_TAG}`, { ip: S_IP, accept: MD, headers: pay }), await ON.call(`/r/${S_PAGE}`, { ip: S_IP, accept: MD, headers: { ...pay, 'if-none-match': `W/"${S_TAG}"` } }),
    await ON.call('/routes.json?fmt=toon', { ip: S_IP, headers: pay }), await compress(ON, S_IP, MID, { headers: pay }), await ON.rpc('/mcp/lean', 'tools/call', { name: 'call_tool', arguments: { name: 'build_agent', arguments: {} } }, { ip: S_IP, headers: pay })];
  for (const [i, r] of rs.entries()) { assert.equal(await T402(r, `lever ${i}`), open, `lever ${i}: the open sum`); assert.equal(r.h['x-sea-toll-state'], 'paused'); }
  assert.equal(fetched.length, f0, 'no page was fetched'); assert.equal(counted.slice(n0).length, 0, 'nothing ran that counts'); assert.equal(asked.length, 0, 'the facilitator was not asked');
  S_OPEN = open;
});
await proof('a payment that settled clears the open toll: the same request answers with the lever (the line that says unchanged), the payment response and the next toll; the money is in the toll\'s own books (/treasury and /open.json under toll), never a sale of the till, never in fair share (I2)', async () => {
  S_TX = `0x${'ab'.repeat(32)}`; facilitator = settles(S_TX); asked.length = 0;
  const sales0 = ON.ledger.mem.sales.length, pays0 = ((await ON.kv.get('fair:pay')) || []).length;
  const r = await ON.call(`/r/${S_PAGE}?since=${S_TAG}`, { ip: S_IP, accept: MD, headers: { 'payment-signature': v2(S_OPEN) } });
  assert.equal(r.status, 200); assert.match(r.text, /^Unchanged since e1-/, 'the lever answer'); assert.deepEqual(asked.map((x) => x.kind), ['verify', 'settle']);
  const pr = JSON.parse(Buffer.from(r.h['payment-response'], 'base64').toString()); assert.equal(pr.success, true); assert.equal(pr.transaction, S_TX);
  assert.match(r.h['x-sea-toll-payment'], /^settled: \d+\.\d{6} USD paid on Base, transaction 0x(ab){32}; the open toll is cleared$/);
  const s = Number(r.h['x-sea-engine-saved']); assert.equal(r.h['x-sea-toll-state'], 'open'); assert.equal(micro(r.h['x-sea-toll-open-usd']), twoFifths(s), 'only this answer is open now');
  const a = await acct(ON, S_IP); assert.equal(a.h.length, 0); assert.equal(TOLL.openMicro(a), twoFifths(s)); assert.equal(a.pm, S_OPEN);
  const next = await ON.call('/routes.json?fmt=toon', { ip: S_IP }); assert.equal(next.h['content-type'], 'text/toon; charset=utf-8', 'lean again'); assert.equal(next.h['x-sea-toll-state'], 'open');
  const B = await books(ON), p = B.pays.find((x) => x.tx === S_TX); assert.ok(p, 'in the toll\'s books');
  assert.deepEqual([p.status, p.micro, p.ids, B.total.micro, B.total.n], ['settled', S_OPEN, [a.id], S_OPEN, 1]);
  assert.equal(ON.ledger.mem.sales.length, sales0, 'no sale of the till (nothing for the database\'s sales)'); assert.equal(((await ON.kv.get('fair:pay')) || []).length, pays0, 'nothing in the registry of fair share');
  const tr = await ON.call('/treasury', { ip: net() }); assert.equal(tr.j.total_usd, 0, 'no sale of the paid move'); assert.equal(tr.j.today_paid, 0); assert.deepEqual(tr.j.last_5, []);
  assert.deepEqual([tr.j.toll.on, tr.j.toll.settled_usd, tr.j.toll.payments, tr.j.toll.on_its_way_usd, tr.j.toll.today_settled_usd], [true, S_OPEN / 1e6, 1, 0, S_OPEN / 1e6]); assert.match(tr.j.read, /Tolls of the lossless levers/);
  const op = await ON.call('/open.json', { ip: net() }); assert.equal(op.j.money.toll.settledUsd, S_OPEN / 1e6); assert.equal(op.j.money.toll.on, true); assert.equal(op.j.money.till.totalUsd, 0);
  const fj = await ON.call('/fair.json', { ip: net() }), ej = await ON.call('/engine.json', { ip: net() });
  assert.equal(fj.j.live.micro.settled, 0, 'fair share settled nothing'); for (const [what, x] of [['/fair.json', fj], ['/engine.json', ej]]) { assert.ok(!/settledOnChainUsd|onItsWayUsd/.test(x.text), `${what}: no numbers of the toll`); assert.ok(!x.text.includes(TOLL.usd6(S_OPEN)), `${what}: the sum is not shown`); }
});
await proof('x402 v1 (X-PAYMENT) pays the same way, and fmt=toon, /compress and /mcp/lean deliver their lever once paid', async () => {
  for (const [what, go, lean] of [
    ['fmt=toon', (ip, h) => ON.call('/routes.json?fmt=toon', { ip, headers: h }), (r) => r.h['content-type'] === 'text/toon; charset=utf-8'],
    ['/compress', (ip, h) => compress(ON, ip, MID, { headers: h }), (r) => r.j?.tokens?.saved > 0 && r.j.out !== MID],
    ['/mcp/lean', (ip, h) => ON.rpc('/mcp/lean', 'tools/call', { name: 'call_tool', arguments: { name: 'build_agent', arguments: {} } }, { ip, headers: h }), (r) => JSON.parse(r.text).result._meta['mareliberum.dev/format'] === 'toon']]) {
    const ip = net(); await pause(ON, ip); facilitator = settles();
    const ask = await go(ip, { 'x-sea-toll': 'pay' }), sum = await T402(ask, what);
    const r = await go(ip, { 'x-payment': v1(sum) }); assert.equal(r.status, 200, what); assert.ok(lean(r), `${what}: the lever answer`); assert.ok(r.h['x-payment-response'], `${what}: the v1 payment response`); assert.match(r.h['x-sea-toll-payment'], /^settled: /);
    assert.equal(await openOf(ON, ip) < 50000, true, `${what}: no longer due`);
  }
});
await proof('the payment the toll took never goes on to the door (I3): taken out of the request before the door runs', async () => {
  const ip = net(); await pause(ON, ip); const open = await openOf(ON, ip); facilitator = settles();
  const req = new Request(`${BASE}/routes.json?fmt=toon`, { headers: { accept: 'application/json', 'user-agent': UA, 'x-forwarded-for': ip, 'payment-signature': v2(open) } });
  const res = await ON.core.handle(req, ON.db, ON.cfg); await res.arrayBuffer();
  assert.match(res.headers.get('x-sea-toll-payment'), /^settled/); assert.equal(req.headers.get('payment-signature'), null, 'the payment header is gone from the request');
});

// ================================================================== payments that clear nothing
console.log('a payment header that is not the toll\'s is left alone; a refused, failed, unanswered or replayed payment clears nothing');
await proof('a payment header that pays another wallet or another sum than the open one is not the toll\'s (I3): the normal answer (no 402, no error), nothing taken, the facilitator not asked; with x-sea-toll: pay the 402 says it was left alone; on /fair/pay, the toll\'s own door, it is refused', async () => {
  const ip = net(); await pause(ON, ip); facilitator = () => { throw new Error('must not be asked'); }; asked.length = 0;
  const a = await acct(ON, ip), open = TOLL.openMicro(a);
  for (const pay of [v2(open, { to: `0x${'99'.repeat(20)}` }), v2(open + 1), v2(open - 1), v2(open, { amount: open + 5 }), v1(open, { to: PROVIDER_WALLET }), v2(10000, { to: PROVIDER_WALLET })]) {
    const r = await ON.call('/routes.json?fmt=toon', { ip, headers: { 'payment-signature': pay } }); assert.equal(r.status, 200); assert.match(r.h['content-type'], /^application\/json/); assert.equal(r.h['x-sea-toll-state'], 'paused'); assert.equal(r.h['x-sea-toll-payment'], undefined);
  }
  const both = await ON.call('/routes.json?fmt=toon', { ip, headers: { 'x-sea-toll': 'pay', 'payment-signature': v2(10000, { to: PROVIDER_WALLET }) } });
  assert.equal(await T402(both, 'x-sea-toll: pay beside another payment'), open); assert.match(both.j.error, /does not pay this toll.*left alone/);
  for (const [pay, why] of [[v2(open, { to: `0x${'99'.repeat(20)}` }), /another wallet/], [v2(open + 1), /exactly/], [v2(open - 1), /exactly/]]) {
    const f = await ON.call(`/fair/pay?r=${a.id}`, { method: 'POST', ip, headers: { 'payment-signature': pay } }); assert.equal(f.status, 402); assert.match(f.j.error, why);
  }
  assert.equal(asked.length, 0); assert.equal(TOLL.openMicro(a), open); assert.equal(a.h.length, 0); assert.equal((await ON.call('/routes.json?fmt=toon', { ip })).h['x-sea-toll-state'], 'paused');
});
await proof('refused by the facilitator (a bad signature): 402 again with its reason, nothing held, the toll stays due', async () => {
  const ip = net(); await pause(ON, ip); const open = await openOf(ON, ip), b0 = (await books(ON)).pays.length;
  facilitator = (kind) => answer(kind === 'verify' ? { isValid: false, invalidReason: 'invalid_exact_evm_signature' } : { success: false });
  const r = await ON.call('/routes.json?fmt=toon', { ip, headers: { 'payment-signature': v2(open) } }); assert.equal(r.status, 402); assert.match(r.j.error, /not accepted: invalid_exact_evm_signature/);
  assert.equal((await books(ON)).pays.length, b0, 'nothing in the books'); assert.equal(await openOf(ON, ip), open);
});
await proof('verified but not settled (insufficient funds): the normal answer, "nothing was cleared", the payment released (I6), the toll due again and asked for again', async () => {
  const ip = net(); await pause(ON, ip); const open = await openOf(ON, ip);
  facilitator = (kind) => answer(kind === 'verify' ? { isValid: true, payer: PAYER } : { success: false, errorReason: 'insufficient_funds' });
  const r = await ON.call('/routes.json?fmt=toon', { ip, headers: { 'payment-signature': v2(open) } });
  assert.equal(r.status, 200); assert.match(r.h['content-type'], /^application\/json/, 'the normal answer'); assert.match(r.h['x-sea-toll-payment'], /^unsettled: the payment of \d+\.\d{6} USD did not settle \(insufficient_funds\); nothing was cleared$/);
  const a = await acct(ON, ip); assert.equal(a.h.length, 0); assert.equal(TOLL.openMicro(a), open); assert.equal((await ON.call('/routes.json?fmt=toon', { ip })).h['x-sea-toll-state'], 'paused');
  assert.equal((await books(ON)).pays.find((x) => x.ids?.includes(a.id))?.status, 'released'); assert.equal((await ON.call('/routes.json?fmt=toon', { ip, headers: { 'x-sea-toll': 'pay' } })).status, 402, 'asked for again');
});
await proof('a payment the facilitator gives no verdict on is not taken (I6): 402 "try again", no hold, nothing settled; the toll stays due, and the next payment settles', async () => {
  const ip = net(); await pause(ON, ip); const open = await openOf(ON, ip);
  for (const fac of [() => { throw new TypeError('fetch failed'); }, (kind) => (kind === 'verify' ? new Response('', { status: 500 }) : answer({ success: true }))]) {
    facilitator = fac; asked.length = 0;
    const r = await ON.call('/routes.json?fmt=toon', { ip, headers: { 'payment-signature': v2(open) } });
    assert.equal(r.status, 402); assert.match(r.j.error, /(did not answer|gave no verdict).*not taken.*try again/); assert.deepEqual(asked.map((x) => x.kind), ['verify'], 'never settled');
    const a = await acct(ON, ip); assert.equal(a.h.length, 0); assert.equal(TOLL.openMicro(a), open); assert.equal(r.h['x-sea-toll-state'], 'paused');
  }
  facilitator = settles(); const ok = await ON.call('/routes.json?fmt=toon', { ip, headers: { 'payment-signature': v2(open) } }); assert.match(ok.h['x-sea-toll-payment'], /^settled/);
});
await proof('replayed: a payment that settled once, sent again (by the same network or another), is refused before the facilitator is asked and clears nothing', async () => {
  const ip = net(), ip2 = net(); await pause(ON, ip); await pause(ON, ip2); facilitator = settles();
  const open = await openOf(ON, ip), pay = v2(open, { nonce: `0x${'5a'.repeat(32)}` });
  assert.match((await ON.call('/routes.json?fmt=toon', { ip, headers: { 'payment-signature': pay } })).h['x-sea-toll-payment'], /^settled/);
  const s0 = TOLL.openMicro(await acct(ON, ip)), open2 = await openOf(ON, ip2); assert.equal(open2, open, 'the same sum on the other network');
  await pause(ON, ip); asked.length = 0; facilitator = () => { throw new Error('must not be asked'); };
  const due = await openOf(ON, ip);
  const again = await ON.call('/routes.json?fmt=toon', { ip, headers: { 'payment-signature': v2(due, { nonce: `0x${'5a'.repeat(32)}` }) } }); assert.equal(again.status, 402); assert.match(again.j.error, /used before/);
  const other = await ON.call('/routes.json?fmt=toon', { ip: ip2, headers: { 'payment-signature': pay } }); assert.equal(other.status, 402); assert.match(other.j.error, /used before/);
  assert.equal(asked.length, 0); assert.ok(TOLL.openMicro(await acct(ON, ip)) > s0); assert.equal(await openOf(ON, ip2), open2);
});
await proof('a payment verified but still settling holds the toll: never asked twice (no 402 while it is on its way), the lever answers go on meanwhile and accrue (D3, 3.37.2), cleared the moment the settlement lands behind the answer', async () => {
  const ip = net(); await pause(ON, ip); const open = await openOf(ON, ip);
  let release; const landing = new Promise((r) => { release = r; });
  const awake = setInterval(() => {}, 50); // the till waits for a settlement on a timer that keeps no process alive (unref): this one does
  facilitator = (kind) => (kind === 'verify' ? answer({ isValid: true, payer: PAYER }) : landing.then(() => answer({ success: true, transaction: `0x${'cd'.repeat(32)}`, network: 'eip155:8453', payer: PAYER })));
  try {
    const r = await ON.call('/routes.json?fmt=toon', { ip, headers: { 'payment-signature': v2(open) } });
    assert.equal(r.status, 200); assert.equal(r.h['content-type'], 'text/toon; charset=utf-8', 'the lever answer while it settles'); assert.match(r.h['x-sea-toll-payment'], /^pending: /); assert.equal(r.h['x-sea-toll-state'], 'settling');
    assert.match(r.h['x-sea-toll'], /^settling: a payment of \d+\.\d{6} USD is on its way, and the lever answers go on meanwhile; \d+\.\d{6} USD for this answer: /); assert.ok(micro(r.h['x-sea-toll-usd']) > 0, 'what it saves accrues');
    const ask = await ON.call('/routes.json?fmt=toon', { ip, headers: { 'x-sea-toll': 'pay' } }); assert.equal(ask.status, 200, 'not asked twice'); assert.equal(ask.h['x-sea-toll-state'], 'settling'); assert.equal(ask.h['content-type'], 'text/toon; charset=utf-8');
    for (let i = 0; i < 3; i++) { const c = await compress(ON, ip, MID); assert.equal(c.h['x-sea-toll-state'], 'settling', 'never paused while a payment is held'); assert.notEqual(c.j.out, MID, 'the lever answer'); }
    const fp = await ON.call(`/fair/pay?r=${(await acct(ON, ip)).id}`, { method: 'POST', ip }); assert.equal(fp.j.payable, false); assert.match(fp.j.reason, /nothing is open/);
    const tr = await ON.call('/treasury', { ip: net() }); assert.equal(micro(tr.j.toll.on_its_way_usd), open); assert.equal(tr.j.toll.on_its_way, 1);
    release(); await settled();
    const after = await ON.call('/routes.json?fmt=toon', { ip }); assert.equal(after.h['content-type'], 'text/toon; charset=utf-8', 'lean again once it settled');
    const a = await acct(ON, ip); assert.equal(a.h.length, 0); assert.equal(a.pm, open, 'what it paid for is paid');
    assert.ok(TOLL.openMicro(a) > 0, 'what accrued meanwhile is open now');
  } finally { clearInterval(awake); }
});
await proof('a settlement that never comes back (I6, D3): past the terms\' time the chain is asked (USDC authorizationState on Base, eth_call): used → settled and booked; not used and past validBefore → released, due again; nothing is released without the chain\'s word: no answer, or a node that cannot ask the chain, keeps the payment held (lever answers go on) and asks again with backoff', async () => {
  const D0 = T0, payAt = async (n, ip, nonce) => { const open = await openOf(n, ip); facilitator = hangs(); const r = await n.call('/routes.json?fmt=toon', { ip, headers: { 'payment-signature': v2(open, { nonce }) } }); assert.match(r.h['x-sea-toll-payment'], /^pending: /); await settled(); return open; };
  try {
    const NOC = await nodeOf(ROOT, { cfg: { chainRpc: 'off' } }); calm(NOC);
    const [i1, i2, i3, i4] = [net(), net(), net(), net()]; for (const ip of [i1, i2, i3]) await pause(ON, ip); await pause(NOC, i4);
    const n1 = `0x${'a1'.repeat(32)}`, n2 = `0x${'a2'.repeat(32)}`, n3 = `0x${'a3'.repeat(32)}`, n4 = `0x${'a4'.repeat(32)}`;
    const o1 = await payAt(ON, i1, n1), o2 = await payAt(ON, i2, n2), o3 = await payAt(ON, i3, n3), o4 = await payAt(NOC, i4, n4);
    const total0 = (await books(ON)).total.micro;
    chain = (from, nonce) => (nonce === n1 ? true : nonce === n2 ? false : null); rpcAsked.length = 0;
    later(120); for (const ip of [i1, i2, i3]) { const r = await ON.call('/routes.json?fmt=toon', { ip }); assert.equal(r.h['x-sea-toll-state'], 'settling', 'within the terms\' time: held'); assert.equal(r.h['content-type'], 'text/toon; charset=utf-8', 'the lever answers go on'); }
    assert.equal(rpcAsked.length, 0, 'the chain is not asked while the settlement may still come');
    later(185); // 305 s after the payments: past maxTimeoutSeconds
    const r1 = await ON.call('/routes.json?fmt=toon', { ip: i1 }); assert.equal(r1.h['content-type'], 'text/toon; charset=utf-8', 'used: settled, lean again');
    const call = rpcAsked.find((x) => x.params?.[0]?.data?.endsWith(n1.slice(2)));
    assert.deepEqual([call.method, call.params[0].to, call.params[0].data, call.params[1]], ['eth_call', USDC_BASE, `0xe94a0102${'0'.repeat(24)}${PAYER.slice(2)}${n1.slice(2)}`, 'latest']);
    const B1 = await books(ON); assert.equal(B1.pays.find((x) => x.nonce === n1).status, 'settled'); assert.equal(B1.total.micro, total0 + o1, 'booked');
    assert.equal((await ON.call('/routes.json?fmt=toon', { ip: i2 })).h['x-sea-toll-state'], 'settling', 'not used, but validBefore not yet past: held');
    later(60);
    assert.equal((await ON.call('/routes.json?fmt=toon', { ip: i2 })).h['x-sea-toll-state'], 'paused', 'not used and past validBefore: released, due again'); assert.ok(await openOf(ON, i2) >= o2, 'the held sum is open again (and what accrued meanwhile)');
    assert.equal((await books(ON)).pays.find((x) => x.nonce === n2).status, 'released');
    assert.equal((await ON.call('/routes.json?fmt=toon', { ip: i3 })).h['x-sea-toll-state'], 'settling', 'no answer from the chain: held');
    assert.equal((await NOC.call('/routes.json?fmt=toon', { ip: i4 })).h['x-sea-toll-state'], 'settling', 'no chain check possible: held, never released'); assert.equal((await books(NOC)).pays.find((x) => x.nonce === n4).status, 'pending');
    const asked3 = () => rpcAsked.filter((x) => x.params?.[0]?.data?.endsWith(n3.slice(2))).length, k0 = asked3();
    for (let i = 0; i < 12; i++) { later(600); await ON.call('/routes.json?fmt=toon', { ip: i3 }); await NOC.call('/routes.json?fmt=toon', { ip: i4 }); }
    assert.equal((await ON.call('/routes.json?fmt=toon', { ip: i3 })).h['x-sea-toll-state'], 'settling', 'two hours without the chain\'s word: still held'); assert.equal((await books(NOC)).pays.find((x) => x.nonce === n4).status, 'pending', 'no chain to ask: still held');
    const k1 = asked3(); assert.ok(k1 > k0 && k1 - k0 < 12, `asked again, ever later (${k1 - k0} times in two hours, not every request)`);
    chain = (from, nonce) => (nonce === n3 ? true : null); later(3600); await ON.call('/routes.json?fmt=toon', { ip: i3 });
    assert.equal((await books(ON)).pays.find((x) => x.nonce === n3).status, 'settled', 'the chain\'s word, once it comes'); assert.equal((await ON.call('/treasury', { ip: net() })).j.toll.on_its_way, 0, 'nothing left on its way'); void o3; void o4;
  } finally { T0 = D0; chain = () => null; }
});
await proof('a payment found on its way when a node starts is checked at once (I6): the settlement the stopped node waited for landed (used) → settled, its network lean again; one not yet used and still valid is held, and released once its time is past', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mare-toll-boot-')), file = join(dir, 'sea.ndjson'), D0 = T0;
  try {
    const d1 = diskKv(file); await d1.ready; const N1 = await nodeOf(ROOT, { kv: d1 }); calm(N1); const ipA = net(), ipB = net(); await pause(N1, ipA); await pause(N1, ipB);
    const nA = `0x${'b1'.repeat(32)}`, nB = `0x${'b2'.repeat(32)}`;
    for (const [ip, nonce] of [[ipA, nA], [ipB, nB]]) { facilitator = hangs(); const r = await N1.call('/routes.json?fmt=toon', { ip, headers: { 'payment-signature': v2(await openOf(N1, ip), { nonce }) } }); assert.match(r.h['x-sea-toll-payment'], /^pending/); }
    await settled(); // the node stops hard now: no copy, no close (what a payment changed is on the disk already)
    const d2 = diskKv(file); await d2.ready; const N2 = await nodeOf(ROOT, { kv: d2 }); calm(N2);
    chain = (from, nonce) => (nonce === nA ? true : nonce === nB ? false : null); rpcAsked.length = 0;
    later(10); assert.equal(await N2.core.startToll(N2.db, N2.cfg), 1, 'one left on its way');
    assert.equal(rpcAsked.length, 2, 'both asked at once, within the terms\' time');
    assert.equal((await N2.call('/routes.json?fmt=toon', { ip: ipA })).h['content-type'], 'text/toon; charset=utf-8', 'used: settled, lean again');
    assert.equal((await N2.call('/routes.json?fmt=toon', { ip: ipB })).h['x-sea-toll-state'], 'settling', 'not used, still valid: held');
    later(400); assert.equal((await N2.call('/routes.json?fmt=toon', { ip: ipB })).h['x-sea-toll-state'], 'paused', 'past its time: released');
    const B = await books(N2); assert.deepEqual([B.pays.find((x) => x.nonce === nA).status, B.pays.find((x) => x.nonce === nB).status], ['settled', 'released']);
  } finally { T0 = D0; chain = () => null; rmSync(dir, { recursive: true, force: true }); }
});
await proof('the payments on their way are looked at once a minute without any request (the timer of the toll): one past its time is settled by the chain\'s word, /treasury shows nothing on its way', async () => {
  const D0 = T0, N = await nodeOf(ROOT, { cfg: { tollSweepMs: 25 } }); calm(N);
  try {
    const ip = net(); await pause(N, ip); const nonce = `0x${'c1'.repeat(32)}`; facilitator = hangs();
    assert.match((await N.call('/routes.json?fmt=toon', { ip, headers: { 'payment-signature': v2(await openOf(N, ip), { nonce }) } })).h['x-sea-toll-payment'], /^pending/); await settled();
    chain = (from, n) => (n === nonce ? true : null); later(320);
    for (let i = 0; i < 40 && (await books(N)).pays.find((x) => x.nonce === nonce).status === 'pending'; i++) await new Promise((r) => setTimeout(r, 25));
    assert.equal((await books(N)).pays.find((x) => x.nonce === nonce).status, 'settled'); assert.equal((await N.call('/treasury', { ip: net() })).j.toll.on_its_way, 0);
  } finally { N.db.tollBook.close(); T0 = D0; chain = () => null; }
});
await proof('two payers at the same moment (M2): both get an answer, never an error; one payment is taken and settles once, the other is not taken and says so', async () => {
  const ip = net(); await pause(ON, ip); const open = await openOf(ON, ip); let settlements = 0, inVerify; const verifying = new Promise((r) => { inVerify = r; });
  facilitator = async (kind) => { if (kind === 'verify') inVerify(); await new Promise((r) => setTimeout(r, 80)); if (kind === 'settle') settlements++; return answer(kind === 'verify' ? { isValid: true, payer: PAYER } : { success: true, transaction: `0x${'ee'.repeat(32)}`, network: 'eip155:8453', payer: PAYER }); };
  const first = ON.call('/routes.json?fmt=toon', { ip, headers: { 'payment-signature': v2(open) } });
  await verifying;
  const [y, z] = await Promise.all([ON.call('/routes.json?fmt=toon', { ip, headers: { 'x-payment': v1(open) } }), ON.call('/routes.json?fmt=toon', { ip, headers: { 'x-sea-toll': 'pay' } })]);
  const x = await first;
  assert.deepEqual([x.status, y.status, z.status], [200, 200, 200]); assert.equal(settlements, 1, 'one settlement');
  assert.match(x.h['x-sea-toll-payment'], /^settled/); for (const r of [y, z]) { assert.match(r.h['x-sea-toll-payment'], /^not taken: a payment for this toll is being taken right now/); assert.match(r.h['content-type'], /^application\/json/, 'the normal answer'); }
  const f = await (async () => { await pause(ON, ip); const o = await openOf(ON, ip); let go; const held = new Promise((r) => { go = r; }); facilitator = async (kind) => { if (kind === 'verify') go(); await new Promise((r) => setTimeout(r, 80)); return answer(kind === 'verify' ? { isValid: true, payer: PAYER } : { success: true, transaction: `0x${'ef'.repeat(32)}` }); };
    const one = ON.call('/routes.json?fmt=toon', { ip, headers: { 'payment-signature': v2(o) } }); await held; const r = await ON.call(`/fair/pay?r=${(await acct(ON, ip)).id}`, { method: 'POST', ip, headers: { 'payment-signature': v2(o) } }); await one; return r; })();
  assert.equal(f.status, 200); assert.equal(f.j.payable, false); assert.match(f.j.reason, /being taken right now; nothing was charged/);
});
await proof('a paid request whose door then fails (M3) still carries the payment\'s response: /r/ of a page that cannot be read, /compress of an empty body, and an error the door throws', async () => {
  for (const [what, go] of [
    ['/r/ of a page that cannot be read, with since=', (ip, h) => ON.call('/r/https://gone.toll-proof.dev/x?since=e1-0123456789abcdef0123', { ip, accept: MD, headers: h })],
    ['/compress of an empty body', (ip, h) => ON.call('/compress', { method: 'POST', ip, headers: { 'content-type': 'text/html', ...h }, body: '' })],
    ['/r/ whose reader throws', async (ip, h) => { const f = ON.db.flow, read = f.read; f.read = async () => { throw new Error('the reader broke'); }; try { return await ON.call(`/r/${newPage(20)}?since=e1-0123456789abcdef0123`, { ip, accept: MD, headers: h }); } finally { f.read = read; } }],
  ]) {
    const ip = net(); await pause(ON, ip); const open = await openOf(ON, ip); facilitator = settles(); asked.length = 0;
    const r = await go(ip, { 'payment-signature': v2(open) });
    assert.ok(r.status >= 400, `${what}: the door failed (${r.status})`); assert.equal(asked.filter((x) => x.kind === 'settle').length, 1, `${what}: the payment settled`); assert.equal(await openOf(ON, ip), 0, `${what}: the toll was cleared`);
    assert.equal(JSON.parse(Buffer.from(r.h['payment-response'] || 'e30=', 'base64').toString()).success, true, `${what}: the payment response`); assert.match(r.h['x-sea-toll-payment'] || '', /^settled: /, `${what}: what became of the payment`);
  }
});

// ================================================================== POST /fair/pay with toll ids
console.log('POST /fair/pay settles toll ids, at any time from $0.05, from their own network');
await proof('a toll id: 402 for the exact open sum and paid → cleared, from its own network; from any other network it is no toll of this node (404, no sum told, I2); below $0.05 it says so; a toll id beside a receipt id, or an unknown one, charges nothing', async () => {
  const ip = net(); await pause(ON, ip); const a = await acct(ON, ip), open = TOLL.openMicro(a); facilitator = settles(); asked.length = 0;
  for (const other of [net(), '2001:db8:aa:1::5']) {
    const o = await ON.call(`/fair/pay?r=${a.id}`, { method: 'POST', ip: other, headers: { 'payment-signature': v2(open) } });
    assert.equal(o.status, 404); assert.equal(o.j.accepts, undefined); assert.ok(!o.text.includes(TOLL.usd6(open)) && !o.text.includes(String(open)), 'the sum is not told'); assert.equal(o.h['payment-required'], undefined);
  }
  assert.equal(asked.length, 0, 'nothing taken from another network');
  const ask = await ON.call(`/fair/pay?r=${a.id}`, { method: 'POST', ip }); assert.equal(await T402(ask, '/fair/pay'), open);
  const up = await ON.call(`/fair/pay?r=${a.id.toUpperCase()}`, { method: 'POST', ip }); assert.equal(up.status, 402, 'the id in capitals');
  const paid = await ON.call('/fair/pay', { method: 'POST', ip, body: { r: [a.id] }, headers: { 'payment-signature': v2(open) } });
  assert.equal(paid.status, 200); assert.equal(paid.j.paid.status, 'settled'); assert.equal(paid.j.paid.amount_usd, TOLL.usd6(open)); assert.deepEqual(paid.j.paid.tolls, [a.id]); assert.ok(paid.h['payment-response']);
  assert.equal(TOLL.openMicro(a), 0); assert.equal((await ON.call('/routes.json?fmt=toon', { ip })).h['content-type'], 'text/toon; charset=utf-8');
  const small = net(); await compress(ON, small, OVER); const b = await acct(ON, small);
  const below = await ON.call(`/fair/pay?r=${b.id}`, { method: 'POST', ip: small }); assert.equal(below.j.payable, false); assert.equal(below.j.reason, 'below the minimum'); assert.equal(below.j.minimum_usd, '0.050000');
  const mixed = await ON.call(`/fair/pay?r=${b.id},r20261125aaaaaaaa`, { method: 'POST', ip: small }); assert.equal(mixed.status, 400); assert.match(mixed.j.error.message, /Nothing was charged/);
  const unknown = await ON.call('/fair/pay?r=t20261125zzzzzzzz', { method: 'POST', ip: small }); assert.equal(unknown.status, 404);
});

// ================================================================== networks, days, restarts
console.log('one network, one day: apart, by the UTC day, through a restart and a hard stop');
await proof('networks apart: a network that owes leaves the next one free and byte for byte as with the toll off; an IPv6 /48 is one network (its /64s share the free quota and the open sum, M4), the next /48 another', async () => {
  const owes = net(); await pause(ON, owes);
  const free = net(), x = await ON.call('/routes.json?fmt=toon', { ip: free }), y = await OFF.call('/routes.json?fmt=toon', { ip: net() }); noToll(x, 'another network'); sameAs(x, ON.version, y, OFF.version, 'another network');
  await pause(ON, '2001:db8:7:1::1');
  for (const same of ['2001:db8:7:1::abcd', '2001:DB8:7:2:0:0:0:99', '2001:db8:7:ffff::1']) assert.equal((await ON.call('/routes.json?fmt=toon', { ip: same })).h['x-sea-toll-state'], 'paused', `${same}: the same /48`);
  for (const other of ['2001:db8:8:1::1', '2001:db8:6:1::1']) noToll(await ON.call('/routes.json?fmt=toon', { ip: other }), `${other}: another /48`);
  assert.equal(TOLL.tollNet('2001:db8:7:1::1'), '2001:db8:7::/48'); assert.equal(TOLL.tollNet('::ffff:203.0.113.66'), '203.0.113.66'); assert.equal(TOLL.tollNet('203.0.113.66'), '203.0.113.66');
});
await proof('the cap of networks a day fails closed (M4): past 50,000 networks a new one gets the normal answers of the lossless levers (state full, no lever, nothing owed, never an error, never a 402); a network kept before goes on as before', async () => {
  const N = await nodeOf(ROOT); calm(N); const kept = net(); await compress(N, kept, OVER);
  const T = N.db.tollBook; for (let i = 0; i < 50_000; i++) await T.account(`2001:${(0x100 + (i >> 16)).toString(16)}:${(i & 0xffff).toString(16)}::1`);
  const ip = net(), c = await compress(N, ip);
  assert.equal(c.status, 200); assert.equal(c.j.out, BIG, 'the text as sent'); assert.equal(c.j.status, 'unchanged: the toll keeps no more networks today'); assert.equal(c.h['x-sea-toll-state'], 'full'); assert.match(c.h['x-sea-toll'], /^full: .*nothing is owed$/);
  for (const r of [await N.call('/routes.json?fmt=toon', { ip }), await N.call('/routes.json?fmt=toon', { ip, headers: { 'x-sea-toll': 'pay' } })]) { assert.equal(r.status, 200); assert.match(r.h['content-type'], /^application\/json/); assert.equal(r.h['x-sea-toll-state'], 'full'); }
  const k = await N.call('/routes.json?fmt=toon', { ip: kept }); assert.equal(k.h['content-type'], 'text/toon; charset=utf-8', 'a network kept before: the lever'); assert.equal(k.h['x-sea-toll-state'], 'open');
});
await proof('the UTC day: past midnight the same network has a new free quota and nothing open (byte for byte as with the toll off); the day before can still be settled by its id from its network', async () => {
  const D0 = T0; setNow('2026-11-25T23:59:30.000Z');
  try {
    const N = await nodeOf(ROOT); calm(N); const ip = net(); await pause(N, ip); const old = await acct(N, ip), open = TOLL.openMicro(old);
    setNow('2026-11-26T00:00:30.000Z');
    const r = await N.call('/routes.json?fmt=toon', { ip }), o = await OFF.call('/routes.json?fmt=toon', { ip: net() }); noToll(r, 'a new day'); sameAs(r, N.version, o, OFF.version, 'a new day');
    const a = await acct(N, ip); assert.equal(a.day, '2026-11-26'); assert.ok(a.s > 0 && a.t === 0, 'a fresh account');
    const ask = await N.call(`/fair/pay?r=${old.id}`, { method: 'POST', ip }); assert.equal(ask.status, 402); assert.equal(Number(ask.j.accepts[0].maxAmountRequired), open, 'yesterday\'s toll, by its id');
  } finally { T0 = D0; }
});
await proof('a restart forgets nothing (the kv on disk, node/disk.mjs): the open toll, its id and the used free quota are there again; no second free quota the same day', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mare-toll-disk-')), file = join(dir, 'sea.ndjson');
  try {
    const d1 = diskKv(file); await d1.ready; const N1 = await nodeOf(ROOT, { kv: d1 }); calm(N1); const ip = net();
    await pause(N1, ip); const a1 = await acct(N1, ip), state = { s: a1.s, t: a1.t, m: a1.m, id: a1.id };
    await d1.close();
    const d2 = diskKv(file); await d2.ready; const N2 = await nodeOf(ROOT, { kv: d2 }); calm(N2);
    const r = await N2.call('/routes.json?fmt=toon', { ip }); assert.equal(r.h['x-sea-toll-state'], 'paused', 'still due after the restart'); assert.equal(r.h['x-sea-toll-id'], state.id);
    const a2 = await acct(N2, ip); assert.deepEqual({ s: a2.s, t: a2.t, m: a2.m, id: a2.id }, state);
    const fresh = net(), m = await compress(N2, fresh, MID); noToll(m, 'a network that saved nothing before the restart stays free');
    await d2.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
await proof('a hard stop right after a settled payment (I5: kill -9, no copy, no close): the next run knows it was paid and never asks for it again; the payment\'s state was on the disk when the answer went out, and the next copy folds it in', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mare-toll-crash-')), file = join(dir, 'sea.ndjson');
  try {
    const d1 = diskKv(file); await d1.ready; const N1 = await nodeOf(ROOT, { kv: d1 }); calm(N1); const ip = net();
    await pause(N1, ip); await d1.save(); // the copy on disk of a minute ago: the toll due
    const open = await openOf(N1, ip), id = (await acct(N1, ip)).id; facilitator = settles(); asked.length = 0;
    const paid = await N1.call('/routes.json?fmt=toon', { ip, headers: { 'payment-signature': v2(open) } }); assert.match(paid.h['x-sea-toll-payment'], /^settled/);
    assert.ok(readFileSync(`${file}.now`, 'utf8').includes(id), 'on the disk before the answer went out');
    const d2 = diskKv(file); await d2.ready; const N2 = await nodeOf(ROOT, { kv: d2 }); calm(N2); // a new run on the same state, the old one never closed
    const again = await N2.call('/routes.json?fmt=toon', { ip }); assert.equal(again.h['content-type'], 'text/toon; charset=utf-8', 'paid: lean'); assert.notEqual(again.h['x-sea-toll-state'], 'paused');
    const ask = await N2.call('/routes.json?fmt=toon', { ip, headers: { 'x-sea-toll': 'pay', 'payment-signature': v2(open) } }); assert.notEqual(ask.status, 402); assert.equal(asked.filter((x) => x.kind === 'settle').length, 1, 'one settlement for one debt');
    assert.equal((await books(N2)).total.micro >= open, true, 'the books know it');
    await d2.save(); assert.equal(readFileSync(`${file}.now`, 'utf8'), '', 'folded into the copy');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
const SERVE = (() => {
  const freePort = () => new Promise((res) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
  const start = async (state, procs) => { const port = await freePort(), url = `http://127.0.0.1:${port}`; const p = spawn(process.execPath, ['serve.mjs', String(port)], { cwd: ROOT, env: { ...process.env, MARE_BASE: BASE, HOST: '127.0.0.1', MARE_STATE: state, NO_PROXY: '127.0.0.1', no_proxy: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'pipe'] }); let log = ''; p.stdout.on('data', (b) => { log += b; }); p.stderr.on('data', (b) => { log += b; }); procs.push(p);
    for (let i = 0; i < 200; i++) { try { if ((await realFetch(`${url}/stats`, { headers: { 'user-agent': 'MareLiberum-session/1.0' } })).ok) return { url, port, p }; } catch {} await new Promise((x) => setTimeout(x, 100)); } throw new Error(`serve.mjs did not answer: ${log.slice(-300)}`); };
  const post = async (url) => { const r = await realFetch(`${url}/compress`, { method: 'POST', headers: { 'content-type': 'text/html', 'user-agent': UA }, body: BIG }); await r.arrayBuffer(); return Object.fromEntries(r.headers); };
  const stop = (p, sig = 'SIGTERM') => new Promise((res) => { p.once('exit', res); p.kill(sig); });
  return { start, post, stop };
})();
if (SERVE_PROOFS) {
  await proof('serve.mjs stopped (SIGTERM) and started again on the same MARE_STATE: the network that owed still owes the same sum under the same id', async () => {
    const state = mkdtempSync(join(tmpdir(), 'mare-toll-state-')), procs = [];
    try {
      const one = await SERVE.start(state, procs); await SERVE.post(one.url); await SERVE.post(one.url); const before = await SERVE.post(one.url);
      assert.equal(before['x-sea-toll-state'], 'paused'); await SERVE.stop(one.p);
      const two = await SERVE.start(state, procs); const after = await SERVE.post(two.url);
      assert.equal(after['x-sea-toll-state'], 'paused', 'still due'); assert.equal(after['x-sea-toll-id'], before['x-sea-toll-id']); assert.equal(after['x-sea-toll-open-usd'], before['x-sea-toll-open-usd']);
      await SERVE.stop(two.p);
    } finally { for (const p of procs) try { p.kill('SIGKILL'); } catch {} rmSync(state, { recursive: true, force: true }); }
  });
  await proof('a stop that is cut short (I5): serve.mjs asked to stop while a caller still sends its request, killed a second later, keeps what it held: the copy on disk is written first, before anything that can wait', async () => {
    const state = mkdtempSync(join(tmpdir(), 'mare-toll-cut-')), procs = []; let sock = null;
    try {
      const one = await SERVE.start(state, procs); await SERVE.post(one.url); await SERVE.post(one.url); const before = await SERVE.post(one.url); assert.equal(before['x-sea-toll-state'], 'paused');
      // a caller that has not sent all of its body: the node waits for it before it stops
      sock = connect(one.port, '127.0.0.1'); await new Promise((r) => sock.once('connect', r));
      sock.write(`POST /compress HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: text/html\r\nUser-Agent: ${UA}\r\nContent-Length: 100000\r\n\r\n<html>`);
      await new Promise((r) => setTimeout(r, 300));
      one.p.kill('SIGTERM'); await new Promise((r) => setTimeout(r, 1200)); await SERVE.stop(one.p, 'SIGKILL');
      const two = await SERVE.start(state, procs); const after = await SERVE.post(two.url);
      assert.equal(after['x-sea-toll-state'], 'paused', 'still due after the stop that was cut short'); assert.equal(after['x-sea-toll-id'], before['x-sea-toll-id']);
      await SERVE.stop(two.p);
    } finally { try { sock?.destroy(); } catch {} for (const p of procs) try { p.kill('SIGKILL'); } catch {} rmSync(state, { recursive: true, force: true }); }
  });
}

// ================================================================== no caller apart by its name; HEAD; the app door; /via/
console.log('no caller told apart by its name; HEAD; the app door; /via/');
await proof('no caller is told apart by its name (I1): on a network that owes, the session UA, GPTBot, Googlebot, ClaudeBot, Angel and names with "bot", "monitor" or "MareLiberum" get the same normal answer; a fresh network that says it is a bot has the same free quota and is tolled above it; the ledger still counts none of the sea\'s own calls', async () => {
  const ip = net(); await pause(ON, ip);
  for (const ua of ['MareLiberum-session/1.0', 'Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)', 'Mozilla/5.0 (compatible; Googlebot/2.1)', 'ClaudeBot/1.0', 'Angel/1.0 (+https://angel.oroboros-design.com)', 'acme-agent-bot/1.0', 'acme-uptime-monitor/2.0', 'my research agent (uses MareLiberum)', 'mare-proof']) {
    const r = await ON.call('/routes.json?fmt=toon', { ip, ua }); assert.equal(r.status, 200, ua); assert.match(r.h['content-type'], /^application\/json/, `${ua}: no TOON while the toll is due`); assert.equal(r.h['x-sea-toll-state'], 'paused', ua);
    const c = await compress(ON, ip, MID, { ua }); assert.equal(c.j.out, MID, `${ua}: /compress gives the text as sent`); assert.equal(c.h['x-sea-toll-state'], 'paused');
    const p = await ON.call('/routes.json?fmt=toon', { ip, ua, headers: { 'x-sea-toll': 'pay' } }); assert.equal(p.status, 402, `${ua}: asked to pay like anyone`);
  }
  const bot = net(), st = []; for (let i = 0; i < 3; i++) st.push((await compress(ON, bot, BIG, { ua: 'acme-agent-bot/1.0' })).h['x-sea-toll-state']);
  assert.equal(st[0], 'open', 'tolled above the quota like any network'); assert.equal(st[2], 'paused', 'and due like any network');
  const self = net(), n0 = counted.length; const s = await ON.call('/routes.json?fmt=toon', { ip: self, ua: 'MareLiberum-session/1.0' });
  assert.equal(s.h['content-type'], 'text/toon; charset=utf-8'); assert.equal(counted.slice(n0).filter((x) => x.ip === self).length, 0, 'the ledger\'s rules stay: the sea\'s own calls are counted nowhere');
  assert.ok((await acct(ON, self)).s > 0, 'but the toll counts them toward the free quota like any other');
});
await proof('a HEAD of /r/ says nothing for free (I1): below the quota it has the ETag and the 304 as with the toll off; while the toll is due a HEAD carries no ETag and no x-sea-delta and is never 304, with If-None-Match or since=; HEAD is never tolled', async () => {
  const ip = net(), url = newPage(40), ipOff = net();
  const f1 = await ON.call(`/r/${url}`, { ip, accept: MD }), tag = f1.h.etag; await OFF.call(`/r/${url}`, { ip: ipOff, accept: MD });
  const h1 = await ON.call(`/r/${url}`, { ip, accept: MD, head: true }), h2 = await ON.call(`/r/${url}`, { ip, accept: MD, head: true, headers: { 'if-none-match': tag } });
  const o1 = await OFF.call(`/r/${url}`, { ip: ipOff, accept: MD, head: true }), o2 = await OFF.call(`/r/${url}`, { ip: ipOff, accept: MD, head: true, headers: { 'if-none-match': tag } });
  assert.equal(h1.h.etag, tag); assert.equal(h2.status, 304); sameAs(h1, ON.version, o1, OFF.version, 'HEAD below the quota'); sameAs(h2, ON.version, o2, OFF.version, 'HEAD 304 below the quota');
  await pause(ON, ip);
  for (const [what, r, paused] of [['HEAD', await ON.call(`/r/${url}`, { ip, accept: MD, head: true })], ['HEAD with If-None-Match', await ON.call(`/r/${url}`, { ip, accept: MD, head: true, headers: { 'if-none-match': tag } }), true], ['HEAD with since=', await ON.call(`/r/${url}?since=${bare(tag)}`, { ip, accept: MD, head: true })], ['HEAD asking to pay', await ON.call(`/r/${url}?since=${bare(tag)}`, { ip, accept: MD, head: true, headers: { 'x-sea-toll': 'pay' } })], ['HEAD with If-None-Match asking to pay', await ON.call(`/r/${url}`, { ip, accept: MD, head: true, headers: { 'if-none-match': tag, 'x-sea-toll': 'pay' } }), true]]) {
    assert.equal(r.status, 200, what); assert.equal(r.h.etag, undefined, `${what}: no ETag`); assert.equal(r.h['x-sea-delta'], undefined, `${what}: no x-sea-delta`);
    if (paused) assert.equal(r.h['x-sea-toll-state'], 'paused', `${what}: the 304 lever rests (3.37.1: a conditional HEAD is the 304 lever), no 402 to a HEAD`); else noToll(r, what);
  }
  const t = await ON.call('/routes.json?fmt=toon', { ip, head: true }), u = await OFF.call('/routes.json?fmt=toon', { ip: net(), head: true }); noToll(t, 'HEAD of TOON'); sameAs(t, ON.version, u, OFF.version, 'HEAD of TOON (no body: nothing to toll)');
});
await proof('a conditional HEAD of /r/ is the 304 lever (3.37.1): its 304 has the saving of the GET\'s 304 by savingOf, counts toward the free quota and once a day in the ledger, costs the same above the quota with the same toll headers; while the levers rest no ETag and never a 304; since= alone is no lever for a HEAD (the plain HEAD, free); off, a HEAD 304 is what it was', async () => {
  const ip = net(), url = newPage(30), ipOff = net();
  const tag = (await ON.call(`/r/${url}`, { ip, accept: MD })).h.etag; await OFF.call(`/r/${url}`, { ip: ipOff, accept: MD });
  const get304 = await OFF.call(`/r/${url}`, { ip: net(), accept: MD, headers: { 'if-none-match': tag } }), saved = Number(get304.h['x-sea-engine-saved']); assert.equal(get304.status, 304); assert.ok(saved > 1000);
  // under the quota: the very 304 of the toll off, counted toward the quota and in the ledger like the 304 of a GET
  let n0 = counted.length, a = await acct(ON, ip), s0 = a.s;
  const h1 = await ON.call(`/r/${url}`, { ip, accept: MD, head: true, headers: { 'if-none-match': tag } }), o1 = await OFF.call(`/r/${url}`, { ip: ipOff, accept: MD, head: true, headers: { 'if-none-match': tag } });
  assert.equal(h1.status, 304); noToll(h1, 'a HEAD 304 under the quota'); sameAs(h1, ON.version, o1, OFF.version, 'a HEAD 304 under the quota, as with the toll off');
  assert.equal((await acct(ON, ip)).s, s0 + saved, 'counted toward the free quota'); assert.deepEqual(counted.slice(n0).filter((x) => x.ip === ip).map((x) => [x.lever, x.saved]), [['delta', saved]], 'in the ledger as the 304 of a GET');
  assert.equal(counted.slice(n0).filter((x) => x.ip === ipOff).length, 0, 'toll off: a HEAD is counted nowhere, as before');
  // above the quota: the same price and headers as the GET's 304
  await compress(ON, ip, OVER); const open0 = await openOf(ON, ip);
  const g = await ON.call(`/r/${url}`, { ip, accept: MD, headers: { 'if-none-match': tag } }), h = await ON.call(`/r/${url}`, { ip, accept: MD, head: true, headers: { 'if-none-match': tag } });
  for (const [what, r] of [['GET', g], ['HEAD', h]]) { assert.equal(r.status, 304, what); assert.equal(r.h['x-sea-toll-state'], 'open', what); assert.equal(Number(r.h['x-sea-toll-tokens']), saved, what); assert.equal(micro(r.h['x-sea-toll-usd']), twoFifths(saved), what); }
  assert.equal(await openOf(ON, ip), open0 + 2 * twoFifths(saved), 'both priced alike');
  // since= alone is no lever for a HEAD: the plain HEAD, free, nothing counted
  n0 = counted.length; const before = await openOf(ON, ip), sHead = await ON.call(`/r/${url}?since=${bare(tag)}`, { ip, accept: MD, head: true });
  assert.equal(sHead.status, 200); noToll(sHead, 'HEAD with since='); assert.equal(sHead.h['x-sea-engine'], undefined, 'no lever'); assert.equal(await openOf(ON, ip), before); assert.equal(counted.slice(n0).filter((x) => x.ip === ip).length, 0);
  // due: the HEAD's 304 rests with the lever, no ETag, no 402
  await pause(ON, ip); const d = await ON.call(`/r/${url}`, { ip, accept: MD, head: true, headers: { 'if-none-match': tag, 'x-sea-toll': 'pay' } });
  assert.equal(d.status, 200); assert.equal(d.h.etag, undefined); assert.equal(d.h['x-sea-toll-state'], 'paused');
});
await proof('once a network has used its free quota for the day, a HEAD of /r/ carries no ETag (D2, 3.37.2): no tag to compare itself, with or without since=; a 304 to it is still the lever, tolled, without ETag; under the quota the ETag as before; a GET carries it always', async () => {
  const ip = net(), url = newPage(6), first = await ON.call(`/r/${url}`, { ip, accept: MD }), tag = first.h.etag;
  const under = await ON.call(`/r/${url}`, { ip, accept: MD, head: true }); assert.equal(under.h.etag, tag, 'under the quota: the ETag as before'); assert.ok(under.h['x-sea-delta']);
  for (let i = 0; i < 8 && (await acct(ON, ip)).s < TOLL.TOLL.free; i++) await compress(ON, ip, MID);
  const a = await acct(ON, ip); assert.ok(a.s >= TOLL.TOLL.free, 'the quota used'); assert.ok(TOLL.openMicro(a) < TOLL.TOLL.settleMicro, 'open, not due');
  for (const [what, r] of [['HEAD', await ON.call(`/r/${url}`, { ip, accept: MD, head: true })], ['HEAD with since=', await ON.call(`/r/${url}?since=${bare(tag)}`, { ip, accept: MD, head: true })], ['HEAD with If-None-Match', await ON.call(`/r/${url}`, { ip, accept: MD, head: true, headers: { 'if-none-match': tag } })]]) {
    assert.equal(r.h.etag, undefined, `${what}: no ETag`); assert.equal(r.h['x-sea-delta'], undefined, `${what}: no x-sea-delta`);
    if (what === 'HEAD with If-None-Match') { assert.equal(r.status, 304, 'the 304 lever'); assert.equal(r.h['x-sea-toll-state'], 'open', 'tolled as a GET\'s 304'); }
  }
  const g = await ON.call(`/r/${url}`, { ip, accept: MD }); assert.equal(g.h.etag, tag, 'a GET carries it: the page itself is read');
});
await proof(`/mcp/app answers byte for byte as ${REF} (but for the version in serverInfo) and as with the toll off, also for a network that owes and asks to pay`, async () => {
  assert.ok(THEIRS, `a tree of ${REF}`); const ip = net(); await pause(ON, ip);
  const INIT = { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'toll-proof', version: '1' } };
  for (const [m, p] of [['initialize', INIT], ['tools/list', null], ['tools/call', { name: 'think', arguments: { q: 'find mcp servers for postgres' } }]]) {
    const a = await ON.rpc('/mcp/app', m, p, { ip, headers: { 'x-sea-toll': 'pay' } }), b = await THEIRS.rpc('/mcp/app', m, p, { ip: net() }), c = await OFF.rpc('/mcp/app', m, p, { ip: net() });
    noToll(a, m); sameAs(a, ON.version, b, THEIRS.version, `${m} against ${REF}`); sameAs(a, ON.version, c, OFF.version, `${m} toll off`);
  }
});
await proof('/via/ takes no toll (I3, F2): a network that owes pays an x402 provider through /via/ with TOON (fmt=toon, Accept: text/toon) exactly as with the toll off; a payment header that is its toll (the till\'s wallet, the exact open sum) is never forwarded to the provider (F2b), and nothing is taken', async () => {
  const ip = net(); await pause(ON, ip); const token = encodeVia(`${PROVIDER}/v1/prices`), pay = v2(10000, { to: PROVIDER_WALLET });
  for (const o of [{ path: `/via/${token}?fmt=toon` }, { path: `/via/${token}`, accept: 'text/toon, application/json;q=0.5' }]) {
    provided.length = 0;
    const a = await ON.call(o.path, { ip, accept: o.accept || 'application/json', headers: { 'payment-signature': pay } }), b = await OFF.call(o.path, { ip: net(), accept: o.accept || 'application/json', headers: { 'payment-signature': pay } });
    assert.equal(a.status, 200, o.path); noToll(a, o.path); assert.equal(a.h['content-type'], b.h['content-type']); assert.equal(a.text, b.text, `${o.path}: as with the toll off`);
    assert.deepEqual(provided.map((x) => x.pay), [pay, pay], 'the provider got the payment both times');
  }
  const open = await openOf(ON, ip); provided.length = 0; asked.length = 0;
  const c = await ON.call(`/via/${token}?fmt=toon`, { ip, headers: { 'payment-signature': v2(open) } });
  assert.deepEqual(provided.map((x) => x.pay), [null], 'the provider never saw the toll\'s payment'); assert.equal(asked.length, 0, 'nothing taken');
  assert.match(c.h['x-sea-toll-payment'], /^not forwarded: /); assert.equal(await openOf(ON, ip), open, 'the toll is not cleared by it');
});

// ================================================================== off or resting: every door as origin/main
console.log(`switched off (MARE_TOLL=off), resting ("toll" in rest of immune:policy) or without a secret: every door byte for byte as ${REF}`);
const DOOR_RUN = async (n, ip) => {
  PAGES.set('https://quay.toll-proof.dev/guide', pageOf(7001, 50)); await n.kv.set(readCacheKey('https://quay.toll-proof.dev/guide'), null, 1);
  const out = [], put = (name, r) => out.push([name, r]);
  put('/compress big 1', await compress(n, ip)); put('/compress big 2', await compress(n, ip)); put('/compress big 3', await compress(n, ip));
  put('/compress json', await n.call('/compress', { method: 'POST', ip, body: { json: TABLE } })); put('/compress text/plain', await compress(n, ip, MID, { accept: 'text/plain' }));
  put('/compress x-sea-toll: pay', await compress(n, ip, MID, { headers: { 'x-sea-toll': 'pay' } })); put('/compress budget', await n.call('/compress?budget=200', { method: 'POST', ip, headers: { 'content-type': 'text/markdown' }, body: PIERS }));
  put('fmt=toon', await n.call('/routes.json?fmt=toon', { ip })); put('Accept text/toon', await n.call('/routes.json', { ip, accept: 'text/toon' })); put('fields', await n.call('/routes.json?fields=doors', { ip }));
  put('fmt=toon with a payment', await n.call('/routes.json?fmt=toon', { ip, headers: { 'payment-signature': v2(54000) } })); put('fmt=toon x-sea-toll: pay', await n.call('/routes.json?fmt=toon', { ip, headers: { 'x-sea-toll': 'pay' } }));
  const r1 = await n.call('/r/https://quay.toll-proof.dev/guide', { ip, accept: MD }), tag = r1.h.etag; put('/r/', r1);
  put('since=', await n.call(`/r/https://quay.toll-proof.dev/guide?since=${bare(tag)}`, { ip, accept: MD })); put('If-None-Match', await n.call('/r/https://quay.toll-proof.dev/guide', { ip, accept: MD, headers: { 'if-none-match': tag } }));
  put('HEAD', await n.call('/r/https://quay.toll-proof.dev/guide', { ip, accept: MD, head: true })); put('HEAD If-None-Match', await n.call('/r/https://quay.toll-proof.dev/guide', { ip, accept: MD, head: true, headers: { 'if-none-match': tag } }));
  put('budget=', await n.call('/r/https://quay.toll-proof.dev/guide?budget=400', { ip, accept: MD })); put('budget= and since=', await n.call(`/r/https://quay.toll-proof.dev/guide?budget=400&since=${bare(tag)}`, { ip, accept: MD }));
  PAGES.set('https://quay.toll-proof.dev/guide', pageOf(7001, 50, '<p>One more paragraph about the night ferry.</p>')); await n.kv.set(readCacheKey('https://quay.toll-proof.dev/guide'), null, 1);
  put('since= changed', await n.call(`/r/https://quay.toll-proof.dev/guide?since=${bare(tag)}`, { ip, accept: MD }));
  for (const [m, p] of [['initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'toll-proof', version: '1' } }], ['tools/list', null], ['tools/call', { name: 'call_tool', arguments: { name: 'build_agent', arguments: {} } }], ['tools/call', { name: 'find_tools', arguments: { need: 'buy shoes' } }], ['tools/call', { name: 'think', arguments: { q: 'cheap flights' } }]]) put(`/mcp/lean ${m} ${p?.name || ''}`, await n.rpc('/mcp/lean', m, p, { ip }));
  put('/mcp tools/list', await n.rpc('/mcp', 'tools/list', null, { ip })); put('/mcp/app tools/list', await n.rpc('/mcp/app', 'tools/list', null, { ip }));
  put('/hello', await n.call('/hello', { ip })); put('/routes.json', await n.call('/routes.json', { ip }));
  put('/fair/pay GET', await n.call('/fair/pay', { ip })); put('/fair/pay toll id', await n.call('/fair/pay?r=t20261125abcdefgh', { method: 'POST', ip })); put('/.well-known/x402', await n.call('/.well-known/x402', { ip }));
  provided.length = 0; put('/via/ with a payment and TOON', await n.call(`/via/${encodeVia(`${PROVIDER}/v1/prices`)}?fmt=toon`, { ip, headers: { 'payment-signature': v2(54000) } }));
  return out;
};
await proof(`the toll switched off, resting, or without a server secret: every door answers byte for byte as ${REF} (the version masked), on a network far above the quota`, async () => {
  assert.ok(THEIRS, `a tree of ${REF}`);
  const theirs = await DOOR_RUN(THEIRS, net()), off = await DOOR_RUN(OFF, net());
  calm(ON, ['toll']); let resting; try { resting = await DOOR_RUN(ON, net()); } finally { calm(ON, []); }
  // (without a secret: a fresh node of each tree, the same calls)
  const U = await nodeOf(ROOT), M = await nodeOf(refDir); calm(U); calm(M); const theirs2 = await DOOR_RUN(M, net());
  const keep = process.env.MARE_VIA_SECRET; delete process.env.MARE_VIA_SECRET; let unkeyed; try { unkeyed = await DOOR_RUN(U, net()); } finally { process.env.MARE_VIA_SECRET = keep; }
  assert.equal(theirs.length, off.length);
  for (let i = 0; i < theirs.length; i++) { const [name] = theirs[i]; for (const [what, run, v, ref] of [['off', off, OFF.version, theirs], ['resting', resting, ON.version, theirs], ['no secret', unkeyed, U.version, theirs2]]) { noToll(run[i][1], `${what}: ${name}`); sameAs(run[i][1], v, ref[i][1], THEIRS.version, `${what}: ${name}`); } }
  assert.ok(Number(off[1][1].h['x-sea-engine-saved']) > TOLL.TOLL.free, 'the lever still acts above the quota');
  const on = await DOOR_RUN(ON, net()); assert.equal(on[0][1].h['x-sea-toll-state'], 'open', 'and on, the same run is tolled'); assert.equal(on[2][1].h['x-sea-toll-state'], 'paused');
});
await proof('MARE_TOLL=off in the environment, "till" in rest, a till without wallet or facilitator, or no server secret (M6): no toll; the pages say whether it acts', async () => {
  const { tollSwitch, tollSecret } = TOLL; assert.equal(tollSwitch({}, { MARE_TOLL: 'off' }), false); assert.equal(tollSwitch({}, { MARE_TOLL: '' }), true); assert.equal(tollSwitch({}, {}), true); assert.equal(tollSwitch({ toll: 'no' }, {}), false);
  assert.equal(tollSecret({}), null); assert.equal(tollSecret({ MARE_VIA_SECRET: 'too short' }), null); assert.equal(tollSecret({ MARE_DB_SECRET: 'a database secret of 32 letters!' }), 'a database secret of 32 letters!'); assert.equal(tollSecret({ MARE_VIA_SECRET: 'the via secret, long enough', MARE_DB_SECRET: 'a database secret of 32 letters!' }), 'the via secret, long enough');
  const ip = net(); await pause(ON, ip);
  calm(ON, ['till']); try { noToll(await ON.call('/routes.json?fmt=toon', { ip }), 'the till rests'); } finally { calm(ON, []); }
  noToll(await ON.call('/routes.json?fmt=toon', { ip, c: { pay: { ...ON.PAY, facilitator: null } } }), 'no facilitator'); noToll(await ON.call('/routes.json?fmt=toon', { ip, c: { pay: { ...ON.PAY, payTo: '' } } }), 'no wallet');
  const keep = process.env.MARE_VIA_SECRET; delete process.env.MARE_VIA_SECRET;
  try { const r = await ON.call('/routes.json?fmt=toon', { ip }); noToll(r, 'no secret'); assert.equal(r.h['content-type'], 'text/toon; charset=utf-8'); assert.equal((await ON.call('/engine.json', { ip })).j.toll.on, false); }
  finally { process.env.MARE_VIA_SECRET = keep; }
  assert.equal((await ON.call('/routes.json?fmt=toon', { ip })).h['x-sea-toll-state'], 'paused', 'on again');
  assert.equal((await OFF.call('/engine.json', { ip })).j.toll.on, false); assert.equal((await ON.call('/engine.json', { ip })).j.toll.on, true);
});
await proof('no key of the accounts in the state (M6): nothing the toll writes holds the secret, a day\'s key, a salt or an address; the key of a network changes with the UTC day and with the secret', async () => {
  const SECRET = 'a server secret of the proof, 32+ letters', seen = [], kv0 = memoryKv(), kv = { get: (k) => kv0.get(k), set: (k, v, t) => { seen.push([k, JSON.stringify(v)]); return kv0.set(k, v, t); } };
  let day = '2026-11-25T12:00:00.000Z'; const T = TOLL.createToll({ kv, secret: SECRET, now: () => day, sweepMs: 0 }), ip = '198.51.100.77';
  const a = await T.account(ip); T.decide(a, 160000); T.decide(a, 40000);
  day = '2026-11-26T12:00:00.000Z'; const b = await T.account(ip); T.decide(b, 120000);
  const keys = ['2026-11-25', '2026-11-26'].map((d) => Buffer.from(hkdfSync('sha256', SECRET, 'mare-toll-v1', d, 32)).toString('hex'));
  for (const [k, v] of seen) { for (const bad of [SECRET, ...keys, ip, '198.51.100', 'salt']) { assert.ok(!k.includes(bad) && !v.includes(bad), `${k}: holds ${bad.slice(0, 12)}…`); } }
  assert.ok(!seen.some(([k]) => /salt/.test(k)), 'no salt');
  assert.notEqual(a.key.split(':').pop(), b.key.split(':').pop(), 'another key the next day');
  const U = TOLL.createToll({ kv: memoryKv(), secret: `${SECRET}, another`, now: () => day, sweepMs: 0 }); assert.notEqual((await U.account(ip)).key, b.key, 'another key with another secret');
  assert.equal(await TOLL.createToll({ kv: memoryKv(), secret: null, sweepMs: 0 }).account(ip), null, 'no secret: no account');
});
await proof('the registry of fair share keeps a payment recorded while it is read (M5): fair.payments() changes it inside its lock', async () => {
  const kv = memoryKv(), F = createFair({ kv }), at = new Date().toISOString();
  await F.record({ sale: 'sold1', ids: ['r20261125aaaaaaaa'], micro: 50831, status: 'pending', at });
  let release; const gate = new Promise((r) => { release = r; });
  const ledger = { mem: { sales: [] }, saleStatuses: async () => { await gate; return { sold1: { status: 'settled', tx: `0x${'12'.repeat(32)}` } }; } };
  const reading = F.payments(ledger); await new Promise((r) => setTimeout(r, 5));
  await F.record({ sale: 'sold2', ids: ['r20261125bbbbbbbb'], micro: 60000, status: 'pending', at });
  release(); await reading;
  const end = (await kv.get('fair:pay')) || []; assert.deepEqual(end.map((x) => [x.sale, x.status]).sort(), [['sold1', 'settled'], ['sold2', 'pending']]);
  assert.equal((await F.books()).filter((x) => x.sale === 'sold1').length, 1, 'booked once');
});

// ================================================================== what the pages say
console.log('the facts where agents and people read them');
await proof('/engine (a section "The toll" with the example $0.003630), /engine.json, /fair, /pricing (one line) and llms.txt say the price, the free quota, $0.05, the normal answer and that unpaid tolls are not collected, and what they say is so (M7): no name is apart, the ledger counts once a day and the toll every answer, the books apart, which pages keep the toll section; the terms are left to the release of the legal texts', async () => {
  const ip = net(), e = await ON.call('/engine', { ip, accept: 'text/html' }), ej = (await ON.call('/engine.json', { ip })).j.toll;
  assert.ok(e.text.includes('<h2 id="toll">The toll</h2>'));
  for (const w of ['Up to 10,000 saved tokens per network and UTC day stay free', '20 % of the tokens it saved, at USD 2 per million', 'reads a page of 9,128 tokens again with since=', '9,077 tokens saved', '0.2 × 9,077 × $2 / 1,000,000 = $0.003630', 'settled once the open sum reaches $0.05', 'An agent without a wallet gets the normal answer', 'Unpaid tolls are not collected', 'the lean answers pause and the normal answers continue', 'one IPv4 address or one IPv6 /48', 'the open sum is the sum of these, exactly']) {
    assert.ok(e.text.replace(/&amp;/g, '&').replace(/&#39;/g, '\'').includes(w), `/engine: ${w}`);
  }
  assert.equal(ej.numbers.example.usd, '0.003630'); assert.equal(ej.numbers.freeTokensPerNetworkPerDay, 10000); assert.equal(ej.on, true);
  assert.doesNotMatch(ej.never, /anything the ledger does not count/); assert.match(ej.never, /No caller is told apart by its name/); assert.doesNotMatch(ej.never, /^Never tolled: the sea's own calls, crawlers/);
  assert.match(ej.levers, /the ledger counts a saving once a day per network and subject; the toll counts every answer that saved/);
  assert.match(ej.unpaid, /Nobody is blocked: a lever request that does not pay never gets an error from the toll/); assert.match(ej.books, /never counted with the paid route or with fair share, never written into the database's record of the till/);
  assert.doesNotMatch(ej.switch, /every answer is what it was in 3\.36/); assert.match(ej.switch, /every lever answer is what it was in 3\.36; only the pages that describe it \(\/engine, \/fair, \/pricing, \/treasury, \/open, each also as data, and llms\.txt\) keep their toll section/);
  const f = await ON.call('/fair', { ip, accept: 'text/html' }); assert.ok(f.text.includes('The toll, apart from fair share') && f.text.includes('Unpaid tolls are not collected'));
  const p = await ON.call('/pricing', { ip, accept: 'text/html' }), pj = await ON.call('/pricing.json', { ip }), line = 'Up to 10,000 tokens saved by the lossless levers stay free per network and UTC day; above that an answer costs 20 % of the tokens it saved, at USD 2 per million, settled over x402 in one payment from $0.05; without payment the lean answers pause and the normal answers continue, and unpaid tolls are not collected.';
  assert.equal(p.text.split('id="toll"').length - 1, 1, '/pricing: one line'); assert.ok(p.text.includes(line), '/pricing: the line'); assert.ok(pj.j.toll.includes(line) && pj.j.toll.endsWith('https://mare.test/engine#toll'), '/pricing.json: the line');
  // the legal texts (node/legal.mjs) by what they say of the toll: the numbers of config/toll.json and the rules of the code
  const C = TOLL.TOLL, dec = (x) => x.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, '\'').replace(/&amp;/g, '&').replace(/\u00a0/g, ' ');
  const en = { free: C.free.toLocaleString('en-US'), usd: `USD ${C.usdPerMillion}`, at: `USD ${C.settleAtUsd}` }, de = { free: C.free.toLocaleString('de-DE'), usd: `${C.usdPerMillion} USD`, at: `${String(C.settleAtUsd).replace('.', ',')} USD` };
  const legal = async (path) => { const r = await ON.call(path, { ip: net(), accept: 'text/html' }); assert.equal(r.status, 200, path); return dec(r.text); };
  const terms = await legal('/terms'), agb = await legal('/de/agb'), preise = await legal('/de/preise'), privacy = await legal('/privacy'), ds = await legal('/de/datenschutz');
  for (const w of [`up to ${en.free} tokens saved by these levers per network (an IPv4 address or an IPv6 /48 network)`, `${Math.round(C.share * 100)} % of its measured saving, valued at ${en.usd} per million tokens`, `amounts accrue per network until they reach ${en.at}`, 'From the network the toll belongs to, the open amount can also be settled', 'POST /fair/pay?r=<toll id>', 'every other door (/via/ too) and HEAD requests without a 304; a 304 answers a HEAD the same as a GET (the same lever, the same toll)']) assert.ok(terms.includes(w), `/terms: ${w}`);
  for (const w of [`Bis zu ${de.free} durch diese Hebel eingesparte Tokens je Netz (eine IPv4-Adresse oder ein IPv6-Netz /48)`, `${Math.round(C.share * 100)} % ihrer gemessenen Ersparnis, bewertet mit ${de.usd} je Million Tokens`, `bis sie ${de.at} erreichen`, 'Aus dem Netz, zu dem der Zoll gehört', 'POST /fair/pay?r=<Kennung des Zolls>', 'sowie HEAD-Anfragen ohne 304-Antwort; eine 304-Antwort beantwortet eine HEAD-Anfrage genauso wie eine GET-Anfrage (derselbe Hebel, derselbe Zoll)']) assert.ok(agb.includes(w), `/de/agb: ${w}`);
  assert.ok(preise.includes(`Zoll einer Antwort = ${String(C.share).replace('.', ',')} × eingesparte Tokens oberhalb des Freikontingents × ${de.usd} / 1.000.000`), '/de/preise: the formula');
  assert.ok(privacy.includes('The harbour toll counts IPv6 by its first 48 bits (/48).'), '/privacy: /48'); assert.ok(/Hafenzoll[^.]*\/48|\/48[^.]*Hafenzoll/.test(ds), '/de/datenschutz: /48');
  assert.equal(TOLL.tollNet('2001:db8:7:1::1'), '2001:db8:7::/48', 'the code keys IPv6 by /48');
  const l = SITE['/llms.txt'].body; for (const w of ['The toll: up to 10,000 tokens saved by the lossless levers stay free per network and UTC day', 'one IPv6 /48', '0.2 x 9,077 x $2 / 1,000,000 = $0.003630', 'x-sea-toll: pay', 'POST https://mareliberum.dev/fair/pay?r=<x-sea-toll-id> from the same network', 'left alone', 'unpaid tolls are not collected', 'act while the toll is due', 'https://mareliberum.dev/engine#toll']) assert.ok(l.includes(w), `llms.txt: ${w}`);
  // the claim itself: with the toll switched off, the pages it names keep their toll section, and the other pages are origin/main's
  const F = await nodeOf(ROOT, { cfg: { toll: 'off' } }), M = await nodeOf(refDir); calm(F); calm(M);
  // since 3.40.0 the English /mcp-server and /web-to-markdown end their "More:" line with links to the developer guides and the
  // reader's OpenAPI (node/seo.mjs, the reach pages); those links are taken out on both sides, everything else stays byte for byte
  const guides = (s) => s.replace(/ · <a href="\/(guides\/[a-z0-9-]+|openapi\/reader\.json)">[^<]*<\/a>/g, '');
  // since 3.41.0 /mcp-server counts the tools of both doors from the code (it said 53 by hand); the counts are masked on both sides
  const doors = (s) => s.replace(/(with all|mit allen) \d+ (tools|Werkzeugen), <code>\/mcp\/app<\/code> (with the|mit den) \d+ /g, '$1 <n> $2, <code>/mcp/app</code> $3 <n> ');
  const tmask = (s, v) => doors(guides(mask(s, v))).replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z?/g, '<T>');
  for (const [path, accept] of [['/engine', 'text/html'], ['/engine.json', 'application/json'], ['/engine.md', 'text/markdown'], ['/fair', 'text/html'], ['/fair.json', 'application/json'], ['/pricing', 'text/html'], ['/pricing.json', 'application/json'], ['/treasury', 'application/json'], ['/open.json', 'application/json']]) {
    const r = await F.call(path, { ip: '192.0.2.200', accept }), o = await M.call(path, { ip: '192.0.2.200', accept }); assert.equal(r.status, 200, path); assert.ok(/toll/i.test(r.text) && !/toll/i.test(o.text), `${path}: its toll section`);
  }
  for (const [path, accept] of [['/', 'text/html'], ['/hello', 'application/json'], ['/stats', 'application/json'], ['/routes.json', 'application/json'], ['/savings.json', 'application/json'], ['/connect', 'text/html'], ['/mcp-server', 'text/html'], ['/robots.txt', 'text/plain'], ['/.well-known/x402', 'application/json'], ['/job', 'application/json'], ['/pay/howto', 'text/plain'], ['/proof.json', 'application/json']]) {
    const a = await F.call(path, { ip: '192.0.2.200', accept }), b = await M.call(path, { ip: '192.0.2.200', accept });
    assert.equal(a.status, b.status, path); assert.equal(tmask(a.text, F.version), tmask(b.text, M.version), `${path}: as ${REF}`);
  }
});
await proof('3.41.0 in VERSION, server.json, server-dev.json, server-lean.json and gemini-extension.json; RELEASES: 3.41.0 without day and pull request, 3.40.0 on 2026-11-26T03:46:59+01:00 with #32, 3.39.0 on 2026-11-26T00:54:11+01:00 with #31, 3.38.0 on 2026-11-26T00:35:28+01:00 with #30; proof:toll in package.json', async () => {
  assert.equal(ON.version, '3.41.0'); for (const f of ['server.json', 'server-dev.json', 'server-lean.json', 'gemini-extension.json']) assert.equal(JSON.parse(readFileSync(join(ROOT, f), 'utf8')).version, '3.41.0', f);
  assert.deepEqual([RELEASES[0].version, RELEASES[0].at, RELEASES[0].pr], ['3.41.0', null, undefined]); assert.ok(RELEASES[0].what.length > 40 && !RELEASES[0].what.includes('\n'));
  assert.deepEqual([RELEASES[1].version, RELEASES[1].at, RELEASES[1].pr], ['3.40.0', '2026-11-26T03:46:59+01:00', 'https://github.com/daoudandiaye98-alt/mare-liberum/pull/32']);
  assert.deepEqual([RELEASES[2].version, RELEASES[2].at, RELEASES[2].pr], ['3.39.0', '2026-11-26T00:54:11+01:00', 'https://github.com/daoudandiaye98-alt/mare-liberum/pull/31']);
  assert.deepEqual([RELEASES[3].version, RELEASES[3].at, RELEASES[3].pr], ['3.38.0', '2026-11-26T00:35:28+01:00', 'https://github.com/daoudandiaye98-alt/mare-liberum/pull/30']);
  assert.equal(JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).scripts['proof:toll'], 'node tools/toll-proof.mjs');
});

await settled();
console.log(`\n${passed} proofs held, ${failed} failed`);

// ------------------------------------------------------------------ negative controls: break one rule in a copy, the proof must fail there
// Each control copies the code, changes one line so that one rule no longer holds, and runs this proof in the copy with
// --no-controls (the release to compare with handed on as MARE_TOLL_REF_DIR). A control is caught when that run fails.
const BREAK = [
  ['the share raised: 0.25 instead of 0.2 of a saving', 'node/toll.mjs', "shareE6: Math.round(share * 1e6)", "shareE6: Math.round(share * 1.25e6)"],
  ['rounded up instead of down', 'node/toll.mjs', "* BigInt(C.priceE6)) / 1_000_000_000_000n)", "* BigInt(C.priceE6) + 999_999_999_999n) / 1_000_000_000_000n)"],
  ['no free quota', 'node/toll.mjs', 'const free = Math.max(0, Math.min(s, C.free - a.s)), tolled = s - free, micro = microOf(tolled, C);', 'const free = 0, tolled = s - free, micro = microOf(tolled, C);'],
  ['the quota counted once more than it holds (100,001 free)', 'node/toll.mjs', 'const free = Math.max(0, Math.min(s, C.free - a.s)), tolled = s - free, micro = microOf(tolled, C);', 'const free = Math.max(0, Math.min(s, C.free + 1 - a.s)), tolled = s - free, micro = microOf(tolled, C);'],
  ['never due: the lever answer for a caller that does not pay', 'node/toll.mjs', 'if (micro > 0 && !held && openMicro(a) >= C.settleMicro) {', 'if (false) {'],
  ['D1 taken back: the free quota at 100,000 again', 'config/toll.json', '"freeTokensPerNetworkPerDay": 10000', '"freeTokensPerNetworkPerDay": 100000'],
  ['D1 taken back: the terms say 100.000 while the code takes 10,000', 'node/legal.mjs', "'Freikontingent: Bis zu 10.000 durch", "'Freikontingent: Bis zu 100.000 durch"],
  ['D2 taken back: a HEAD above the quota carries the ETag', 'node/core.mjs', '  return T.rests(a) || T.spent(a);', '  return T.rests(a);'],
  ['D3 taken back: released an hour after its time without the chain\'s word', 'node/toll.mjs', 'else { const n = (tries.get(p.id) || 0) + 1;', "else if (t >= final + RETRY) await finish(p, 'released', { why: 'an hour' }); else { const n = (tries.get(p.id) || 0) + 1;"],
  ['D3 taken back: released after its time where the chain cannot be asked', 'node/toll.mjs', 'else { const n = (tries.get(p.id) || 0) + 1;', "else if (!can && t >= final) await finish(p, 'released', { why: 'no chain' }); else { const n = (tries.get(p.id) || 0) + 1;"],
  ['D3 taken back: the chain asked on every request (no backoff)', 'node/toll.mjs', 'nextAt.set(p.id, t + (word === false', 'nextAt.set(p.id, t + 0 * (word === false'],
  ['D3 taken back: the lever answers rest while a payment is held', 'node/toll.mjs', "const held = a.h.length > 0;\n", "const held = a.h.length > 0; if (micro > 0 && held) { a.x++; save(a); return { state: 'settling', lever: false, saved: s, tolled, micro: 0, open: openMicro(a), held: heldMicro(a), id: a.id }; }\n"],
  ['F4/M1 taken back: the open sum rounded once over all tolled tokens', 'node/toll.mjs', 'if (micro > 0) { a.t += tolled; a.m += micro; a.n++;', 'if (micro > 0) { a.t += tolled; a.m = microOf(a.t, C); a.n++;'],
  ['F4/M1 taken back: an answer priced $0.000000 tolled', 'node/toll.mjs', "return micro > 0 ? { state: held ? 'settling' : 'open', lever: true,", "return tolled > 0 ? { state: held ? 'settling' : 'open', lever: true,"],
  ['the 402 asks one millionth more than is open', 'node/toll.mjs', 'const t = tollTerms(payCfg, { base, ids, micro });', 'const t = tollTerms(payCfg, { base, ids, micro: micro + 1 });'],
  ['a payment for another sum taken (on /fair/pay)', 'node/toll.mjs', 'const exact = exactOf(p, t); if (exact)', 'const exact = exactOf(p, t); if (false)'],
  ['a replayed payment not refused', 'node/toll.mjs', "if (seen) return { required: t, tokens, error: 'this payment was used before: nothing was cleared' };", ''],
  ['a payment that did not settle clears the toll', 'node/toll.mjs', "const x = a.h[i]; if (status === 'settled') { a.pt += x.tok; a.pm += x.micro; }", 'const x = a.h[i]; { a.pt += x.tok; a.pm += x.micro; }'],
  ['a payment on its way not held (the toll asked for again meanwhile)', 'node/toll.mjs', 'for (const a of due) { const c = cover.get(a.key); a.h.push({ sale: sale.id, tok: c.tok, micro: c.micro, at }); save(a, true); }', 'for (const a of due) { save(a, true); }'],
  ['a settled payment never clears', 'node/toll.mjs', "const x = a.h[i]; if (status === 'settled') { a.pt += x.tok; a.pm += x.micro; }", "const x = a.h[i]; if (false) { a.pt += x.tok; a.pm += x.micro; }"],
  ['networks share one account', 'node/toll.mjs', ".update(net).digest('hex')", ".update('').digest('hex')"],
  ['no new day: the account of the day the node started', 'node/toll.mjs', "const dayOf = () => String(now()).slice(0, 10);", "const dayOf = () => '2026-11-25';"],
  ['nothing written to the kv', 'node/toll.mjs', 'const save = (a, soon = false) => { if (a.key) put(a.key, pack(a), ttlOf(a), soon); };', 'const save = () => {};'],
  ['the switch not asked', 'node/core.mjs', "const tollShown = (cfg) => tollSwitch(cfg) && !immune.atRest?.('toll')", "const tollShown = (cfg) => !immune.atRest?.('toll')"],
  ['the rest switch not asked', 'node/core.mjs', "const tollShown = (cfg) => tollSwitch(cfg) && !immune.atRest?.('toll') && ", "const tollShown = (cfg) => tollSwitch(cfg) && "],
  ['F1/I1 taken back: callers told apart by their name (the sea\'s own, crawlers, Angel, "bot")', 'node/core.mjs', 'if (!tollActs(cfg) || (isHead(req, cfg) && !head)) return null;', "if (!tollActs(cfg) || (isHead(req, cfg) && !head) || /MareLiberum|Angel|bot|monitor/i.test(req.headers.get('user-agent') || '')) return null;"],
  ['HEAD tolled', 'node/core.mjs', 'if (!tollActs(cfg) || (isHead(req, cfg) && !head)) return null;', 'if (!tollActs(cfg)) return null;'],
  ['3.37.1 taken back: the 304 of a conditional HEAD free again', 'node/core.mjs', 'await tollGate(req, db, cfg, { ip, base, head }) : null;', '(head ? null : await tollGate(req, db, cfg, { ip, base, head })) : null;'],
  ['F1b/I1 taken back: a HEAD of /r/ says "unchanged" while the toll is due', 'node/core.mjs', 'const quiet = eng && !wantJson && head && !tg ? await tollRestsFor(db, cfg, ip) : false;', 'const quiet = false;'],
  ['the lossy projection tolled with TOON (fields= and fmt=toon)', 'node/core.mjs', "const d = g.decide(got.find((s) => s.lever === 'toon')?.saved || 0);", "const d = g.decide(got.reduce((x, s) => x + (s.saved || 0), 0));"],
  ['the lossy part of /compress tolled (q, budget)', 'node/press.mjs', 'd = toll.decide(r.parts.lossless?.saved || 0);', 'd = toll.decide(r.saving.saved || 0);'],
  ['F3/I4 taken back: budget= dropped beside since= while the toll is due', 'node/core.mjs', 'const normal = pressRead({ since: null, budget: eng.budget, strip: eng.strip }, {', 'const normal = pressRead({ since: null, budget: null, strip: [] }, {'],
  ['F3b/I4 taken back: /compress drops the budget and the question while the toll is due', 'node/press.mjs', "if (!d.lever && (opts.q || opts.budget) && r.type !== 'json') raw =", "if (false) raw ="],
  ['the reader\'s JSON answer asked for the toll', 'node/core.mjs', 'const tg = eng && !wantJson && (eng.since', 'const tg = eng && (eng.since'],
  ['tools/list asked for the toll', 'node/core.mjs', "if (lean && list.some((x) => x?.method === 'tools/call'))", "if (lean && list.some((x) => x?.method === 'tools/call' || x?.method === 'tools/list'))"],
  ['/compress hands the lever answer while the toll is due', 'node/press.mjs', 'if (d && !d.lever) {', 'if (false) {'],
  ['the lean door\'s TOON while the toll is due', 'node/core.mjs', "if (d && !d.lever) return ok({ content: [{ type: 'text', text: JSON.stringify(out) }], structuredContent: out,", "if (false) return ok({ content: [{ type: 'text', text: JSON.stringify(out) }], structuredContent: out,"],
  ['a header for an answer under the quota', 'node/toll.mjs', "if (!d?.state || d.state === 'free') return {};", "if (!d?.state) return {};"],
  ['F2/I3 taken back: /via/ asked for the toll', 'node/core.mjs', 'const PAY_DOORS = /^\\/(route|settle|fair|pay|via)(\\/|$)/;', 'const PAY_DOORS = /^\\/(route|settle|fair|pay)(\\/|$)/;'],
  ['I3 taken back: any payment header taken as the toll\'s', 'node/core.mjs', 'const mine = carries && T.claims(req.headers, a, payCfg.payTo),', 'const mine = carries,'],
  ['I3 taken back: the payment the toll took goes on to the door', 'node/core.mjs', 'g.req = withoutPayment(req);', 'g.req = req;'],
  ['F2b/I3 taken back: /via/ forwards the toll\'s payment', 'node/core.mjs', 'if (ta && T.claims(req.headers, ta, (cfg.pay || payConfig()).payTo)) {', 'if (false) {'],
  ['F11/I2 taken back: a toll payment counted with the paid move on /treasury', 'node/core.mjs', 'return json({ ...tr, toll, price:', 'return json({ ...tr, total_usd: (tr.total_usd || 0) + tt.settledMicro / 1e6, toll, price:'],
  ['I2 taken back: a toll settled (and its sum told) from another network', 'node/toll.mjs', 'const day = key.slice(7, 17); if (keyOf(day, tollNet(ip)) !== key) return null;', 'const day = key.slice(7, 17);'],
  ['F8/I5 taken back: the state of a payment waits for the next copy', 'node/toll.mjs', "if (soon && typeof kv.setNow === 'function') { kv.setNow(k, v, ttl); return; }", 'if (false) {}'],
  ['I5 taken back: the copy written last when a node stops', 'serve.mjs', '  try { await disk?.save(); } catch {}\n', ''],
  ['F9a/I6 taken back: a payment without a verdict taken (unverified)', 'node/toll.mjs', "label: 'toll', strict: true,", "label: 'toll', strict: false,"],
  ['F9b/I6 taken back: the chain\'s "used" not taken as settled', 'node/toll.mjs', "if (word === true) await finish(p, 'settled',", "if (word === true) await finish(p, 'released',"],
  ['F9c/I6 taken back: a payment an earlier run left is not asked about at once', 'node/toll.mjs', "for (const p of b.pays) if (p.status === 'pending') inherited.add(p.id);", ''],
  ['F5/M2 taken back: a second payer gets 409', 'node/core.mjs', 'else if (r.busy) { g.busy = true; TOLL_PAID.set(req, g); }', "else if (r.busy) g.answer = json({ error: { code: 'ABORTED', message: 'busy' } }, 409);"],
  ['F14/M3 taken back: /compress after a payment answers an error without the payment\'s response', 'node/core.mjs', 'return tg ? tg.finish(res) : res;\n    }', 'return res;\n    }'],
  ['F14/M3 taken back: the reader after a payment answers an error without the payment\'s response', 'node/core.mjs', "return fin(new Response(md, { status: st, headers: { 'content-type': 'text/markdown; charset=utf-8', ...hdr } }));", "return new Response(md, { status: st, headers: { 'content-type': 'text/markdown; charset=utf-8', ...hdr } });"],
  ['F10/M4 taken back: an IPv6 /64 is a network', 'node/toll.mjs', 'return m ? `${m[1]}:${m[2]}:${m[3]}::/48` : k;', 'return k;'],
  ['F10/M4 taken back: past the cap the toll stops (fail-open)', 'node/toll.mjs', 'if (!v) return FULL(day); }', 'if (!v) return null; }'],
  ['F12/M5 taken back: the registry written from what was read before the lock', 'node/fair.mjs', "const now1 = await serial(async () => { const cur = (await kv.get('fair:pay')) || [];", 'const now1 = await serial(async () => { const cur = list;'],
  ['F13/M6 taken back: a key that holds every day', 'node/toll.mjs', "hkdfSync('sha256', secret, 'mare-toll-v1', day, 32)", "hkdfSync('sha256', secret, 'mare-toll-v1', 'every day', 32)"],
  ['M6 taken back: a toll without a server secret', 'node/toll.mjs', 'return s.length >= 16 ? s : null; };', "return s.length >= 16 ? s : 'the same key on every node'; };"],
  ['F6/M7 taken back: "Off or resting, every answer is what it was in 3.36"', 'node/toll.mjs', "Off or resting, the toll asks nothing and every lever answer is what it was in 3.36; only the pages that describe it (/engine, /fair, /pricing, /treasury, /open, each also as data, and llms.txt) keep their toll section, and say that it does not act.", 'Off or resting, every answer is what it was in 3.36.'],
  ['F7/M7 taken back: "Never tolled: anything the ledger does not count"', 'node/toll.mjs', "No caller is told apart by its name: the sea\\'s own sessions, crawlers and the house agent have the same free quota as everyone.", "Never tolled either: the sea\\'s own calls, crawlers, the house agent, anything the ledger does not count as a lossless saving."],
];
let caught = 0;
if (CONTROLS) {
  console.log('\nnegative controls: each rule broken in a copy, the proof must fail there');
  for (const [what, f, from, to] of BREAK) {
    const tmp = mkdtempSync(join(tmpdir(), 'mare-toll-ctl-'));
    try {
      for (const d of ['node', 'site', 'proof', 'config', 'public']) if (existsSync(join(ROOT, d))) cpSync(join(ROOT, d), join(tmp, d), { recursive: true });
      mkdirSync(join(tmp, 'tools'), { recursive: true }); cpSync(join(ROOT, 'tools/toll-proof.mjs'), join(tmp, 'tools/toll-proof.mjs'));
      for (const x of ['package.json', 'server.json', 'server-dev.json', 'server-lean.json', 'gemini-extension.json', 'serve.mjs']) cpSync(join(ROOT, x), join(tmp, x));
      const src = readFileSync(join(tmp, f), 'utf8');
      if (!src.includes(from)) { console.log(`  FAIL control "${what}": the line to break is gone from ${f}; the control needs updating`); continue; }
      writeFileSync(join(tmp, f), src.replace(from, to));
      const run = spawnSync(process.execPath, ['tools/toll-proof.mjs', '--no-controls', ...(f === 'serve.mjs' ? ['--serve'] : [])], { cwd: tmp, encoding: 'utf8', timeout: 900_000, env: { ...process.env, MARE_TOLL_REF_DIR: refDir || '', MARE_TOLL_FIRST_FAIL: '1' } });
      const held = /(\d+) proofs held, (\d+) failed/.exec(run.stdout || '');
      if (run.status !== 0 && held && Number(held[2]) > 0) { caught++; console.log(`  ok   caught: ${what} (${held[2]} ${held[2] === '1' ? 'proof' : 'proofs'} failed)`); }
      else console.log(`  FAIL not caught: ${what} (exit ${run.status}${held ? `, ${held[0]}` : ''}${run.stderr ? `; ${String(run.stderr).split('\n')[0].slice(0, 160)}` : ''})`);
    } finally { rmSync(tmp, { recursive: true, force: true }); }
  }
  console.log(`${caught} of ${BREAK.length} controls caught`);
}
if (refDir && !process.env.MARE_TOLL_REF_DIR) rmSync(refDir, { recursive: true, force: true });
process.exit(failed || (CONTROLS && caught !== BREAK.length) ? 1 : 0);
