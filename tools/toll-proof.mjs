// Mare Liberum · proof of the harbour toll (3.37, "Der Hafenzoll", node/toll.mjs): up to 100,000 tokens saved by the
// lossless levers stay free per network and UTC day; above that an answer costs 20 % of what it saved at the mid price of
// /savings (USD 2 per million), accrued in millionths of a dollar and settled over x402 in one payment from $0.05; a caller
// that does not pay gets the normal answer, the lever not applied; nobody is blocked.
// It proves, on nodes in this process (handle, as serve.mjs answers) and, for the restart, on two runs of serve.mjs:
//   the numbers of config/toll.json and the formula, exactly (integers, rounded down); the free quota to the token, the
//   answer that crosses it paying only for the part above; below the quota every lever answer byte for byte what the toll
//   switched off sends and what origin/main (3.36.0) sends; the toll's headers on every tolled answer; from $0.05 the 402
//   (x402 v1 and v2, exact, USDC on Base, the till's wallet) for a caller that pays and the normal answer for one that does not,
//   on every lever (since= and the 304, TOON, /compress, /mcp/lean tools/call); a settled payment clears the toll and the next
//   answer is lean again; a forged, refused, failed, replayed or inexact payment clears nothing; a payment still on its way
//   holds the toll without asking twice; POST /fair/pay settles toll ids; the books, /treasury and /open.json name the toll
//   apart; networks apart; the UTC day; a restart (the kv on disk, and serve.mjs stopped and started again); switched off or
//   resting, every door byte for byte origin/main; /mcp/app byte for byte; the sea's own calls, crawlers, HEAD and the house
//   agent never tolled; the lossy levers and tools/list never tolled; the pages that say all this.
// Negative controls at the end: each rule broken in a copy of the code, and this proof must fail there.
// Runs without the network (this machine and local git only): node tools/toll-proof.mjs   (exit code 1 when a proof fails
// or a control is not caught)
//   --no-controls          only the proofs (the controls run this file that way in each broken copy)
//   MARE_TOLL_REF=<ref>     the release the toll must leave byte for byte when off or resting (default origin/main, 3.36.0)
//   MARE_TOLL_REF_DIR=<dir> that release as a tree already extracted (the controls hand it on; no git in their copies)
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, cpSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import { Buffer } from 'node:buffer';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTROLS = !process.argv.includes('--no-controls');
for (const k of ['MARE_TOLL', 'MARE_ENGINE', 'MARE_FAIR', 'MARE_X402_FACILITATOR', 'MARE_PAY_TO', 'MARE_ROUTE_PRICE_CENTS', 'MARE_STATE', 'MARE_DB_URL', 'MARE_DB_KEY', 'MARE_DB_SECRET']) delete process.env[k];
process.env.MARE_VIA_SECRET = 'toll-proof-via-key, a test value';
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

// ------------------------------------------------------------------ the world of the proof: a facilitator and pages, nothing else
const BASE = 'https://mare.test', FAC = 'https://facilitator.test';
let facilitator = () => { throw new Error('the facilitator must not be asked'); }; const asked = [];
const PAGES = new Map(), fetched = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (u, o = {}) => {
  const s = String(u?.url ?? u);
  if (s.startsWith(FAC)) { const kind = s.slice(FAC.length + 1), body = JSON.parse(o.body); asked.push({ kind, body }); return facilitator(kind, body); }
  if (/^http:\/\/127\.0\.0\.1:\d+\//.test(s)) return realFetch(u, o); // the nodes of the restart proof, on this machine
  if (/\/robots\.txt$/.test(s)) return new Response('User-agent: *\nAllow: /\n', { status: 200, headers: { 'content-type': 'text/plain' } });
  if (PAGES.has(s)) { fetched.push(s); return new Response(PAGES.get(s), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }); }
  throw new Error(`the proof does not use the network: ${s.slice(0, 80)}`);
};
createRequire(import.meta.url)('node:dns').promises.lookup = async () => [{ address: '93.184.216.34', family: 4 }];
const answer = (j, status = 200) => new Response(JSON.stringify(j), { status, headers: { 'content-type': 'application/json' } });
const PAYER = '0x2222222222222222222222222222222222222222';
const settles = (tx = `0x${randomBytes(32).toString('hex')}`) => (kind) => answer(kind === 'verify' ? { isValid: true, payer: PAYER } : { success: true, transaction: tx, network: 'eip155:8453', payer: PAYER });

// a page of the harbour, long enough that reading it again spares thousands of tokens
const WORDS = 'anchor ballast beacon buoy cargo chart crane dock draught ebb fender gangway hull jetty keel ledger lock mooring navigation pilot quay rope rudder sail signal slipway stern swell tide tug wharf winch harbour bollard current'.split(' ');
const pageOf = (seed0, sections = 60, extra = '') => { let seed = seed0; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648; const sent = () => { const w = Array.from({ length: 9 + Math.floor(rnd() * 8) }, () => WORDS[Math.floor(rnd() * WORDS.length)]); w[0] = w[0][0].toUpperCase() + w[0].slice(1); return `${w.join(' ')}.`; }; const para = () => Array.from({ length: 4 }, sent).join(' ');
  return `<!doctype html><html><head><title>Harbour handbook ${seed0}</title></head><body><nav><a href="/">Home</a></nav><main><h1>Harbour handbook ${seed0}</h1>${Array.from({ length: sections }, (_, i) => `<h2>Section ${i + 1}</h2><p>${para()}</p><p>${para()}</p>`).join('\n')}${extra}</main></body></html>`; };
// a text for /compress whose lossless steps spare about 180,000 tokens (HTML to the reader's Markdown): one crosses the quota
const BIG = `<html><body>${Array.from({ length: 6000 }, (_, i) => `<div class="c-${i} wrap" style="margin:0;padding:0" data-x="${i}"><span class="s">line ${i} of the harbour handbook</span></div>`).join('\n')}</body></html>`;
const MID = `<html><body>${Array.from({ length: 300 }, (_, i) => `<div class="m-${i}" style="margin:0"><span>berth ${i} of the inner harbour</span></div>`).join('\n')}</body></html>`;
const TABLE = { berths: Array.from({ length: 60 }, (_, i) => ({ id: i + 1, pier: `pier ${1 + (i % 6)}`, depth: 7.5, length: 120 + i, free: i % 3 === 0 })) };

// ------------------------------------------------------------------ the nodes: this tree (toll on, off, resting) and origin/main
const SITE = { '/llms.txt': { body: readFileSync(join(ROOT, 'site/llms.txt'), 'utf8'), type: 'text/plain; charset=utf-8' } };
const UA = 'toll-proof-agent/1.0';
const imp = (dir, f) => import(pathToFileURL(join(dir, 'node', f)).href);
const waits = [];
async function nodeOf(rootDir, { cfg: extra = {}, kv: kv0 = null } = {}) {
  const core = await imp(rootDir, 'core.mjs'), { createMem } = await imp(rootDir, 'mem.mjs'), { memoryKv } = await imp(rootDir, 'flow.mjs');
  const { immune } = await imp(rootDir, 'immune.mjs'), { createLedger } = await imp(rootDir, 'ledger.mjs'), { payConfig } = await imp(rootDir, 'pay.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'mare-toll-')), file = join(dir, 'sea.tsv');
  process.once('exit', () => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });
  writeFileSync(file, ''); writeFileSync(join(dir, 'build.json'), JSON.stringify({ builtAt: '2026-11-20T10:00:00.000Z', entries: 0, lakes: {} }));
  const db = createMem({ file, base: BASE }), kv = kv0 || memoryKv(), ledger = createLedger({});
  const PAY = { ...payConfig({}), facilitator: FAC, settleWaitMs: 200, verifyMs: 500, settleMs: 4000 };
  const cfg = { base: BASE, kv, ledger, pay: PAY, site: SITE, waitUntil: (p) => { waits.push(p); }, ...extra };
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
const REF = process.env.MARE_TOLL_REF || 'origin/main';
const refDir = (() => {
  const given = process.env.MARE_TOLL_REF_DIR; if (given && existsSync(join(given, 'node/core.mjs'))) return given;
  const dir = mkdtempSync(join(tmpdir(), 'mare-toll-ref-'));
  const r = spawnSync('sh', ['-c', 'git -C "$1" archive "$2" | tar -x -C "$3"', 'sh', ROOT, REF, dir], { encoding: 'utf8' });
  return r.status === 0 && existsSync(join(dir, 'node/core.mjs')) ? dir : null;
})();
const ON = await nodeOf(ROOT), OFF = await nodeOf(ROOT, { cfg: { toll: 'off' } }), THEIRS = refDir ? await nodeOf(refDir) : null;
calm(ON); if (THEIRS) calm(THEIRS);
const TOLL = await imp(ROOT, 'toll.mjs'), { TOKEN_PRICE } = await imp(ROOT, 'areas.mjs'), { memoryKv } = await imp(ROOT, 'flow.mjs'), { USDC_BASE } = await imp(ROOT, 'pricing.mjs');
const { RELEASES } = await imp(ROOT, 'open.mjs'), { diskKv } = await imp(ROOT, 'disk.mjs'), { summarize } = await imp(ROOT, 'ledger.mjs'), { squeeze } = await imp(ROOT, 'squeeze.mjs');
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
const auth = (value, to, nonce) => ({ from: PAYER, to, value: String(value), validAfter: '0', validBefore: String(Math.floor(Date.now() / 1000) + 300), nonce: nonce || `0x${randomBytes(32).toString('hex')}` });
const v2 = (value, { to = ON.PAY.payTo, nonce, amount } = {}) => b64({ x402Version: 2, accepted: { scheme: 'exact', network: 'eip155:8453', amount: String(amount ?? value), asset: USDC_BASE, payTo: to, maxTimeoutSeconds: 300, extra: { name: 'USD Coin', version: '2' } }, payload: { signature: `0x${'11'.repeat(65)}`, authorization: auth(value, to, nonce) } });
const v1 = (value, { to = ON.PAY.payTo, nonce } = {}) => b64({ x402Version: 1, scheme: 'exact', network: 'base', payload: { signature: `0x${'11'.repeat(65)}`, authorization: auth(value, to, nonce) } });
const counted = [];
const watch = (n) => { const f = n.db.flow, g = f.countEngine.bind(f); f.countEngine = (lever, s, ctx, subject) => { counted.push({ node: n === ON ? 'on' : n === OFF ? 'off' : 'other', lever, saved: s?.saved, lossy: s?.lossy, ip: ctx?.ip }); return g(lever, s, ctx, subject); }; };
watch(ON); watch(OFF);
const acct = async (n, ip) => n.db.tollBook.account(ip);
const compress = (n, ip, body = BIG, o = {}) => n.call('/compress', { method: 'POST', ip, headers: { 'content-type': 'text/html', ...(o.headers || {}) }, body, ...(o.c ? { c: o.c } : {}), ...(o.accept ? { accept: o.accept } : {}) });
// a network brought past $0.05 the real way: two texts of about 180,000 spared tokens each through /compress
const pause = async (n, ip) => { for (let i = 0; i < 4; i++) { const r = await compress(n, ip); if (r.h['x-sea-toll-state'] === 'paused') return r; assert.equal(r.h['x-sea-toll-state'], 'open', 'the toll accrues until it is due'); } throw new Error('four texts and the toll never came due'); };
let pageN = 0;
const newPage = (sections = 60) => { const url = `https://harbour${++pageN}.toll-proof.dev/handbook`; PAGES.set(url, pageOf(pageN, sections)); return url; };
const readCacheKey = (raw) => `read:${createHash('sha256').update(raw).digest('hex').slice(0, 24)}`;
const MD = 'text/markdown';

// ================================================================== the numbers and the formula
console.log('the numbers of config/toll.json and the formula');
await proof('config/toll.json: 100,000 free tokens per network and day, a share of 0.2, settled from $0.05, at USD 2 per million (the mid price of /savings, the same number); a value out of its range falls back and says so', () => {
  const raw = JSON.parse(readFileSync(join(ROOT, 'config/toll.json'), 'utf8'));
  assert.deepEqual([raw.freeTokensPerNetworkPerDay, raw.share, raw.settleAtUsd, raw.usdPerMillion], [100000, 0.2, 0.05, 2]);
  assert.equal(raw.usdPerMillion, TOKEN_PRICE.mid, 'the price is the ledger\'s mid price');
  const C = TOLL.TOLL; assert.deepEqual([C.free, C.share, C.settleAtUsd, C.usdPerMillion, C.settleMicro, C.fallback.length], [100000, 0.2, 0.05, 2, 50000, 0]);
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
await proof('the free quota to the token: an answer that ends exactly at 100,000 is free, the next token is tolled; an answer that crosses it pays only for the part above it; at $0.05 the toll is due (14 answers of 9,077 tokens)', async () => {
  const T = TOLL.createToll({ kv: memoryKv() });
  const a = await T.account('192.0.2.10');
  let d = T.decide(a, 90923); assert.deepEqual([d.state, d.lever, d.tolled], ['free', true, 0]);
  d = T.decide(a, 9077); assert.deepEqual([d.state, d.tolled, a.s], ['free', 0, 100000], 'exactly at the boundary: free');
  d = T.decide(a, 1); assert.deepEqual([d.state, d.tolled, d.micro, d.open], ['open', 1, 0, 0], 'the next token is tolled (0.4 millionths, rounded down)');
  d = T.decide(a, 9077); assert.deepEqual([d.state, d.tolled, d.micro, d.open], ['open', 9077, 3630, twoFifths(9078)], 'the open sum is rounded once over all tolled tokens');
  const b = await T.account('192.0.2.11'); T.decide(b, 95000); d = T.decide(b, 9077); assert.deepEqual([d.state, d.free, d.tolled, d.micro], ['open', 5000, 4077, twoFifths(4077)], 'the crossing answer pays for 4,077 tokens');
  const c = await T.account('192.0.2.12'); T.decide(c, 100000); let k = 0;
  while (k < 100 && (d = T.decide(c, 9077)).state === 'open') k++; // (bounded: a toll that never comes due ends here too)
  assert.equal(k, 14, 'fourteen answers of 9,077 tokens reach $0.05'); assert.equal(d.state, 'paused'); assert.equal(d.lever, false); assert.equal(d.open, twoFifths(14 * 9077));
  assert.equal(c.t, 14 * 9077, 'nothing of the paused answer was written as tolled'); assert.equal(c.s, 100000 + 14 * 9077);
  assert.deepEqual(T.decide(c, 0), { state: null, lever: true, saved: 0, tolled: 0, micro: 0 }, 'an answer that saved nothing is left as it is');
});

// ================================================================== below the quota: nothing changes
console.log('below the free quota every lever answer is byte for byte what it was');
await proof(`below the quota: TOON, since= and the 304, /compress and /mcp/lean tools/call answer byte for byte as with the toll off and as ${REF} (the version masked), with no toll header`, async () => {
  assert.ok(THEIRS, `a tree of ${REF}`);
  const url = newPage(30), nodes = [ON, OFF, THEIRS], ips = nodes.map(() => net()), got = nodes.map(() => []);
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i], ip = ips[i], first = await n.call(`/r/${url}`, { ip, accept: MD }), tag = first.h.etag;
    got[i].push(first, await n.call(`/r/${url}?since=${tag.replace(/^W\/"|"$/g, '')}`, { ip, accept: MD }), await n.call(`/r/${url}`, { ip, accept: MD, headers: { 'if-none-match': tag } }),
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
let A_IP = null, A_ID = null, A_PAGE = null;
await proof('the answer that crosses the quota pays exactly for the tokens above it; every tolled answer names this answer\'s toll, the open sum and the id; amounts are the formula to the millionth; nothing of the toll in a shared cache', async () => {
  A_IP = net(); A_PAGE = newPage(60);
  const c1 = await compress(ON, A_IP), saved = Number(c1.h['x-sea-engine-saved']);
  assert.ok(saved > 100000, `one text spares more than the quota: ${saved}`);
  assert.equal(c1.h['x-sea-toll-state'], 'open'); assert.equal(Number(c1.h['x-sea-toll-tokens']), saved - 100000, 'only the part above the quota');
  assert.equal(micro(c1.h['x-sea-toll-usd']), twoFifths(saved - 100000)); assert.equal(micro(c1.h['x-sea-toll-open-usd']), twoFifths(saved - 100000));
  assert.match(c1.h['x-sea-toll-id'], TOLL.TOLL_ID); A_ID = c1.h['x-sea-toll-id'];
  assert.match(c1.h['x-sea-toll'], new RegExp(`^${c1.h['x-sea-toll-usd']} USD for this answer: 20 % of ${saved - 100000} tokens saved above the free 100000 a day, at USD 2 per million; ${c1.h['x-sea-toll-open-usd']} USD open, settled by x402 from 0\\.050000 USD: x-sea-toll: pay with a lever request, or POST https://mare\\.test/fair/pay\\?r=${A_ID}$`));
  assert.equal(c1.h['cache-control'], 'private, no-store'); for (const k of ['x-sea-toll', 'x-sea-toll-id', 'x-sea-toll-open-usd']) assert.ok(c1.h['access-control-expose-headers'].split(',').includes(k), k);
  assert.ok(/^[\x20-\x7e]+$/.test(c1.h['x-sea-toll']), 'the line is ASCII');
  // reading a page again: each answer its own toll, the open sum the formula over all tolled tokens
  const first = await ON.call(`/r/${A_PAGE}`, { ip: A_IP, accept: MD }), tag = first.h.etag.replace(/^W\/"|"$/g, '');
  noToll(first, 'a page read the first time saves nothing by a lever');
  let tolled = saved - 100000;
  for (let i = 0; i < 2; i++) {
    const r = await ON.call(`/r/${A_PAGE}?since=${tag}`, { ip: A_IP, accept: MD }), s = Number(r.h['x-sea-engine-saved']); tolled += s;
    assert.match(r.text, /^Unchanged since e1-/); assert.equal(r.h['x-sea-toll-state'], 'open'); assert.equal(Number(r.h['x-sea-toll-tokens']), s);
    assert.equal(micro(r.h['x-sea-toll-usd']), twoFifths(s)); assert.equal(micro(r.h['x-sea-toll-open-usd']), twoFifths(tolled)); assert.equal(r.h['x-sea-toll-id'], A_ID);
  }
  const a = await acct(ON, A_IP); assert.equal(a.t, tolled); assert.equal(a.n, 3); assert.equal(TOLL.openTokens(a), tolled);
});
await proof('per answer, not once a day: the same text twice is tolled twice (the ledger counts it once, and stays as it is)', async () => {
  const ip = net(), n0 = counted.length;
  const a = await compress(ON, ip, BIG), b = await compress(ON, ip, BIG);
  assert.equal(Number(b.h['x-sea-toll-tokens']), Number(b.h['x-sea-engine-saved']), 'the whole saving of the second answer');
  assert.equal(micro(b.h['x-sea-toll-open-usd']), twoFifths(Number(a.h['x-sea-toll-tokens']) + Number(b.h['x-sea-toll-tokens'])));
  assert.equal(counted.slice(n0).filter((x) => x.lever === 'squeeze' && x.ip === ip).length, 2, 'the ledger is handed both');
});

await proof('only the lossless part is tolled: TOON with fields= pays for what TOON spared (the projection is lossy and free); /compress with a budget pays for its lossless steps, not for what the budget cut', async () => {
  const ip = net(); await compress(ON, ip); // above the quota, the toll open and not yet due
  const proj = await OFF.call('/routes.json?fields=doors', { ip: net() }), both = await ON.call('/routes.json?fmt=toon&fields=doors', { ip });
  const toonPart = Number(both.h['x-sea-engine-saved']) - Number(proj.h['x-sea-engine-saved']);
  assert.ok(Number(proj.h['x-sea-engine-saved']) > 0, 'the projection spared tokens'); assert.equal(Number(both.h['x-sea-toll-tokens'] || 0), toonPart, 'the toll counts only what TOON spared');
  const text = Array.from({ length: 40 }, (_, i) => `## Pier ${i + 1}\n\n  The ferry leaves at 0${i % 10}:30 from pier ${i + 1}.   Tickets: https://ferry.toll-proof.dev/t?utm_source=x&id=${i}   \n\nThe harbour office answers every question about berths, cranes and fuel at the quay, all day long.\n\nThe harbour office answers every question about berths, cranes and fuel at the quay, all day long.\n`).join('\n');
  const want = squeeze(text, { type: 'md', budget: 200 }), r = await ON.call('/compress', { method: 'POST', ip, body: { text, type: 'md', budget: 200 } });
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
  const s = await ON.call(`/r/${P_PAGE}?since=${P_TAG.replace(/^W\/"|"$/g, '')}`, { ip: P_IP, accept: MD }), m = await ON.call(`/r/${P_PAGE}`, { ip: P_IP, accept: MD, headers: { 'if-none-match': P_TAG } });
  for (const [r, what] of [[s, 'since='], [m, 'If-None-Match']]) {
    assert.equal(r.status, 200, what); assert.equal(r.text, first.text, `${what}: the whole page`); assert.equal(r.h.etag, first.h.etag); assert.equal(r.h['x-sea-delta'], first.h['x-sea-delta']); assert.equal(r.h['x-sea-engine'], undefined);
    assert.equal(r.h['x-sea-toll-state'], 'paused'); assert.match(r.h['x-sea-toll'], /^paused: \d+\.\d{6} USD open, settled by x402 from 0\.050000 USD: x-sea-toll: pay with a lever request, or POST https:\/\/mare\.test\/fair\/pay\?r=t\d{8}[a-z0-9]{8}\. This is the normal answer, without the lever; unpaid tolls are not collected$/);
  }
  assert.equal(counted.slice(n0).filter((x) => x.ip === P_IP && x.lever === 'delta').length, 0, 'what was not spared is not counted');
});
await proof('fmt=toon and Accept: text/toon: the JSON the door answers (a projection with fields= stays: lossy, and free), no TOON', async () => {
  const j = await ON.call('/routes.json', { ip: P_IP }), t = await ON.call('/routes.json?fmt=toon', { ip: P_IP }), a = await ON.call('/routes.json', { ip: P_IP, accept: 'text/toon' });
  for (const r of [t, a]) { assert.match(r.h['content-type'], /^application\/json/); assert.deepEqual(JSON.parse(r.text), JSON.parse(j.text)); assert.equal(r.h['x-sea-toll-state'], 'paused'); assert.equal(r.h['x-sea-engine'], undefined); }
  const f = await ON.call('/routes.json?fmt=toon&fields=doors', { ip: P_IP }); assert.match(f.h['content-type'], /^application\/json/); assert.deepEqual(Object.keys(JSON.parse(f.text)), ['doors']); assert.equal(f.h['x-sea-engine'], 'fields');
});
await proof('/compress: the text comes back as it was sent, with a status that says so (JSON and plain text); nothing counted', async () => {
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
  const a = await ON.call(`/r/${P_PAGE}?since=${P_TAG.replace(/^W\/"|"$/g, '')}&format=json`, { ip: P_IP, headers: { 'x-sea-toll': 'pay' } }), b = await OFF.call(`/r/${P_PAGE}?since=${P_TAG.replace(/^W\/"|"$/g, '')}&format=json`, { ip: ipOff, headers: { 'x-sea-toll': 'pay' } });
  assert.equal(a.status, 200); noToll(a, 'the JSON reader'); sameAs(a, ON.version, b, OFF.version, 'the JSON reader');
});
await proof('the lossy levers stay free and act while the toll is due: fields= and budget= answer as with the toll off', async () => {
  const ipOff = net(), url = newPage(60);
  for (const p of ['/routes.json?fields=doors', `/r/${url}?budget=300`]) {
    const a = await ON.call(p, { ip: P_IP, accept: p.startsWith('/r/') ? MD : 'application/json' }), b = await OFF.call(p, { ip: ipOff, accept: p.startsWith('/r/') ? MD : 'application/json' });
    noToll(a, p); assert.ok(a.h['x-sea-engine-lossy'] === '1', `${p}: the lossy lever acted`); sameAs(a, ON.version, b, OFF.version, p);
  }
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
  S_IP = net(); S_PAGE = newPage(60); const first = await ON.call(`/r/${S_PAGE}`, { ip: S_IP, accept: MD }); S_TAG = first.h.etag.replace(/^W\/"|"$/g, '');
  await pause(ON, S_IP); asked.length = 0;
  const a = await acct(ON, S_IP), open = TOLL.microOf(TOLL.openTokens(a)); assert.ok(open >= 50000);
  const f0 = fetched.length, n0 = counted.length, pay = { 'x-sea-toll': 'pay' };
  const rs = [await ON.call(`/r/${S_PAGE}?since=${S_TAG}`, { ip: S_IP, accept: MD, headers: pay }), await ON.call(`/r/${S_PAGE}`, { ip: S_IP, accept: MD, headers: { ...pay, 'if-none-match': `W/"${S_TAG}"` } }),
    await ON.call('/routes.json?fmt=toon', { ip: S_IP, headers: pay }), await compress(ON, S_IP, MID, { headers: pay }), await ON.rpc('/mcp/lean', 'tools/call', { name: 'call_tool', arguments: { name: 'build_agent', arguments: {} } }, { ip: S_IP, headers: pay })];
  for (const [i, r] of rs.entries()) { assert.equal(await T402(r, `lever ${i}`), open, `lever ${i}: the open sum`); assert.equal(r.h['x-sea-toll-state'], 'paused'); }
  assert.equal(fetched.length, f0, 'no page was fetched'); assert.equal(counted.slice(n0).length, 0, 'nothing ran that counts'); assert.equal(asked.length, 0, 'the facilitator was not asked');
  S_OPEN = open;
});
await proof('a payment that settled clears the open toll: the same request answers with the lever (the line that says unchanged), the payment response and the next toll; the next answer without payment is lean too', async () => {
  S_TX = `0x${'ab'.repeat(32)}`; facilitator = settles(S_TX); asked.length = 0;
  const r = await ON.call(`/r/${S_PAGE}?since=${S_TAG}`, { ip: S_IP, accept: MD, headers: { 'payment-signature': v2(S_OPEN) } });
  assert.equal(r.status, 200); assert.match(r.text, /^Unchanged since e1-/, 'the lever answer'); assert.deepEqual(asked.map((x) => x.kind), ['verify', 'settle']);
  const pr = JSON.parse(Buffer.from(r.h['payment-response'], 'base64').toString()); assert.equal(pr.success, true); assert.equal(pr.transaction, S_TX);
  assert.match(r.h['x-sea-toll-payment'], /^settled: \d+\.\d{6} USD paid on Base, transaction 0x(ab){32}; the open toll is cleared$/);
  const s = Number(r.h['x-sea-engine-saved']); assert.equal(r.h['x-sea-toll-state'], 'open'); assert.equal(micro(r.h['x-sea-toll-open-usd']), twoFifths(s), 'only this answer is open now');
  const a = await acct(ON, S_IP); assert.equal(a.h.length, 0); assert.equal(TOLL.openTokens(a), s);
  const next = await ON.call('/routes.json?fmt=toon', { ip: S_IP }); assert.equal(next.h['content-type'], 'text/toon; charset=utf-8', 'lean again'); assert.equal(next.h['x-sea-toll-state'], 'open');
  // the money in the till, in the registry and the books, the toll apart from the paid move and from fair share
  const sale = ON.ledger.mem.sales.find((x) => x.method === 'toll-x402-v2'); assert.ok(sale, 'a sale of the till'); assert.deepEqual([sale.status, sale.amount_micro, sale.amount_cents, sale.kind, sale.tx], ['settled', S_OPEN, Math.round(S_OPEN / 1e4), 'toll', S_TX]);
  const pays = await ON.db.fairLedger.payments(ON.ledger), p = pays.find((x) => x.sale === sale.id); assert.deepEqual([p.kind, p.micro, p.status, p.ids], ['toll', S_OPEN, 'settled', [(await acct(ON, S_IP)).id]]);
  const book = await ON.db.fairLedger.books(); assert.ok(book.some((x) => x.sale === sale.id && x.kind === 'toll' && x.amount_micro === S_OPEN && x.tx === S_TX), 'booked as a toll, exact');
  const tr = await ON.call('/treasury', { ip: net() }); assert.equal(tr.j.total_usd, 0, 'no sale of the paid move'); assert.equal(tr.j.toll.settled_usd, S_OPEN / 1e6, 'the toll apart, exact'); assert.equal(tr.j.toll.payments, 1); assert.match(tr.j.read, /Tolls of the lossless levers/);
  const op = await ON.call('/open.json', { ip: net() }); assert.equal(op.j.money.toll.settledUsd, S_OPEN / 1e6); assert.equal(op.j.money.toll.on, true); assert.equal(op.j.money.till.totalUsd, 0);
  const fj = await ON.call('/fair.json', { ip: net() }); assert.equal(fj.j.live.micro.settled, 0, 'fair share settled nothing'); assert.equal(fj.j.toll.settledOnChainUsd, TOLL.usd6(S_OPEN));
  assert.deepEqual(summarize([sale], Date.now()).total_usd, 0, 'the database\'s numbers of the node: no sale of the paid move');
});
await proof('x402 v1 (X-PAYMENT) pays the same way, and fmt=toon, /compress and /mcp/lean deliver their lever once paid', async () => {
  for (const [what, go, lean] of [
    ['fmt=toon', (ip, h) => ON.call('/routes.json?fmt=toon', { ip, headers: h }), (r) => r.h['content-type'] === 'text/toon; charset=utf-8'],
    ['/compress', (ip, h) => compress(ON, ip, MID, { headers: h }), (r) => r.j?.tokens?.saved > 0 && r.j.out !== MID],
    ['/mcp/lean', (ip, h) => ON.rpc('/mcp/lean', 'tools/call', { name: 'call_tool', arguments: { name: 'build_agent', arguments: {} } }, { ip, headers: h }), (r) => JSON.parse(r.text).result._meta['mareliberum.dev/format'] === 'toon']]) {
    const ip = net(); await pause(ON, ip); facilitator = settles();
    const ask = await go(ip, { 'x-sea-toll': 'pay' }), sum = await T402(ask, what);
    const r = await go(ip, { 'x-payment': v1(sum) }); assert.equal(r.status, 200, what); assert.ok(lean(r), `${what}: the lever answer`); assert.ok(r.h['x-payment-response'], `${what}: the v1 payment response`); assert.match(r.h['x-sea-toll-payment'], /^settled: /);
    assert.equal(TOLL.microOf(TOLL.openTokens(await acct(ON, ip))) < 50000, true, `${what}: no longer due`);
  }
});

// ================================================================== payments that clear nothing
console.log('a payment that is forged, refused, failed, replayed or not the exact sum clears nothing');
await proof('forged (another wallet) or not the exact sum (one millionth more or less): refused before the facilitator is asked; the toll stays due', async () => {
  const ip = net(); await pause(ON, ip); facilitator = () => { throw new Error('must not be asked'); }; asked.length = 0;
  const open = TOLL.microOf(TOLL.openTokens(await acct(ON, ip)));
  for (const [pay, why] of [[v2(open, { to: `0x${'99'.repeat(20)}` }), /another wallet/], [v2(open + 1), /exactly/], [v2(open - 1), /exactly/], [v2(open, { amount: open + 5 }), /exactly|accepted/]]) {
    const r = await ON.call('/routes.json?fmt=toon', { ip, headers: { 'payment-signature': pay } }); assert.equal(r.status, 402); assert.match(r.j.error, why);
  }
  assert.equal(asked.length, 0); assert.equal(TOLL.microOf(TOLL.openTokens(await acct(ON, ip))), open); assert.equal((await ON.call('/routes.json?fmt=toon', { ip })).h['x-sea-toll-state'], 'paused');
});
await proof('refused by the facilitator (a bad signature): 402 again with its reason, no sale, the toll stays due', async () => {
  const ip = net(); await pause(ON, ip); const n0 = ON.ledger.mem.sales.length, open = TOLL.microOf(TOLL.openTokens(await acct(ON, ip)));
  facilitator = (kind) => answer(kind === 'verify' ? { isValid: false, invalidReason: 'invalid_exact_evm_signature' } : { success: false });
  const r = await ON.call('/routes.json?fmt=toon', { ip, headers: { 'payment-signature': v2(open) } }); assert.equal(r.status, 402); assert.match(r.j.error, /not accepted: invalid_exact_evm_signature/);
  assert.equal(ON.ledger.mem.sales.length, n0, 'no sale'); assert.equal(TOLL.microOf(TOLL.openTokens(await acct(ON, ip))), open);
});
await proof('verified but not settled (insufficient funds): the normal answer, "nothing was cleared", the toll stays due', async () => {
  const ip = net(); await pause(ON, ip); const open = TOLL.microOf(TOLL.openTokens(await acct(ON, ip)));
  facilitator = (kind) => answer(kind === 'verify' ? { isValid: true, payer: PAYER } : { success: false, errorReason: 'insufficient_funds' });
  const r = await ON.call('/routes.json?fmt=toon', { ip, headers: { 'payment-signature': v2(open) } });
  assert.equal(r.status, 200); assert.match(r.h['content-type'], /^application\/json/, 'the normal answer'); assert.match(r.h['x-sea-toll-payment'], /^unsettled: the payment of \d+\.\d{6} USD did not settle \(insufficient_funds\); nothing was cleared$/);
  const a = await acct(ON, ip); assert.equal(a.h.length, 0); assert.equal(TOLL.microOf(TOLL.openTokens(a)), open); assert.equal((await ON.call('/routes.json?fmt=toon', { ip })).h['x-sea-toll-state'], 'paused');
});
await proof('replayed: a payment that settled once, sent again (by the same network or another), is refused before the facilitator is asked and clears nothing', async () => {
  const ip = net(), ip2 = net(); await pause(ON, ip); await pause(ON, ip2); facilitator = settles();
  const open = TOLL.microOf(TOLL.openTokens(await acct(ON, ip))), pay = v2(open, { nonce: `0x${'5a'.repeat(32)}` });
  assert.match((await ON.call('/routes.json?fmt=toon', { ip, headers: { 'payment-signature': pay } })).h['x-sea-toll-payment'], /^settled/);
  const s0 = TOLL.openTokens(await acct(ON, ip)), open2 = TOLL.microOf(TOLL.openTokens(await acct(ON, ip2)));
  await pause(ON, ip); asked.length = 0; facilitator = () => { throw new Error('must not be asked'); };
  const due = TOLL.microOf(TOLL.openTokens(await acct(ON, ip)));
  const again = await ON.call('/routes.json?fmt=toon', { ip, headers: { 'payment-signature': v2(due, { nonce: `0x${'5a'.repeat(32)}` }) } }); assert.equal(again.status, 402); assert.match(again.j.error, /used before/);
  const other = await ON.call('/routes.json?fmt=toon', { ip: ip2, headers: { 'payment-signature': pay } }); assert.equal(other.status, 402);
  assert.equal(asked.length, 0); assert.ok(TOLL.openTokens(await acct(ON, ip)) > s0); assert.equal(TOLL.microOf(TOLL.openTokens(await acct(ON, ip2))), open2);
});
await proof('a payment verified but still settling holds the toll: the normal answer, never asked twice (no 402 while it is on its way), cleared once the till sees it settled', async () => {
  const ip = net(); await pause(ON, ip); const open = TOLL.microOf(TOLL.openTokens(await acct(ON, ip)));
  let release; const later = new Promise((r) => { release = r; });
  const awake = setInterval(() => {}, 50); // the till waits for a settlement on a timer that keeps no process alive (unref): this one does
  facilitator = (kind) => (kind === 'verify' ? answer({ isValid: true, payer: PAYER }) : later.then(() => answer({ success: true, transaction: `0x${'cd'.repeat(32)}`, network: 'eip155:8453', payer: PAYER })));
  const r = await ON.call('/routes.json?fmt=toon', { ip, headers: { 'payment-signature': v2(open) } });
  assert.equal(r.status, 200); assert.match(r.h['content-type'], /^application\/json/, 'the normal answer while it settles'); assert.match(r.h['x-sea-toll-payment'], /^pending: /); assert.equal(r.h['x-sea-toll-state'], 'settling');
  const ask = await ON.call('/routes.json?fmt=toon', { ip, headers: { 'x-sea-toll': 'pay' } }); assert.equal(ask.status, 200, 'not asked twice'); assert.equal(ask.h['x-sea-toll-state'], 'settling');
  const fp = await ON.call(`/fair/pay?r=${(await acct(ON, ip)).id}`, { method: 'POST', ip: net() }); assert.equal(fp.j.payable, false); assert.match(fp.j.reason, /nothing is open/);
  release(); await Promise.allSettled(waits.splice(0)); await new Promise((x) => setTimeout(x, 1100)); // the till's copy of the sale says settled
  const after = await ON.call('/routes.json?fmt=toon', { ip }); assert.equal(after.h['content-type'], 'text/toon; charset=utf-8', 'lean again once it settled');
  const a = await acct(ON, ip); assert.equal(a.h.length, 0); assert.ok(a.p > 0 && TOLL.microOf(a.p) === open, 'the tokens it paid for are paid');
  clearInterval(awake);
});

// ================================================================== POST /fair/pay with toll ids
console.log('POST /fair/pay settles toll ids, at any time from $0.05');
await proof('a toll id: 402 for the exact open sum, paid → cleared; below $0.05 it says so; a toll id beside a receipt id, or an unknown one, charges nothing', async () => {
  const ip = net(); await pause(ON, ip); const a = await acct(ON, ip), open = TOLL.microOf(TOLL.openTokens(a)); facilitator = settles();
  const ask = await ON.call(`/fair/pay?r=${a.id}`, { method: 'POST', ip: net() }); assert.equal(await T402(ask, '/fair/pay'), open);
  const paid = await ON.call('/fair/pay', { method: 'POST', ip: net(), body: { r: [a.id] }, headers: { 'payment-signature': v2(open) } });
  assert.equal(paid.status, 200); assert.equal(paid.j.paid.status, 'settled'); assert.equal(paid.j.paid.amount_usd, TOLL.usd6(open)); assert.deepEqual(paid.j.paid.tolls, [a.id]); assert.ok(paid.h['payment-response']);
  assert.equal(TOLL.openTokens(a), 0); assert.equal((await ON.call('/routes.json?fmt=toon', { ip })).h['content-type'], 'text/toon; charset=utf-8');
  const small = net(); await compress(ON, small); const b = await acct(ON, small);
  const below = await ON.call(`/fair/pay?r=${b.id}`, { method: 'POST', ip: net() }); assert.equal(below.j.payable, false); assert.equal(below.j.reason, 'below the minimum'); assert.equal(below.j.minimum_usd, '0.050000');
  const mixed = await ON.call(`/fair/pay?r=${b.id},r20261125aaaaaaaa`, { method: 'POST', ip: net() }); assert.equal(mixed.status, 400); assert.match(mixed.j.error.message, /Nothing was charged/);
  const unknown = await ON.call('/fair/pay?r=t20261125zzzzzzzz', { method: 'POST', ip: net() }); assert.equal(unknown.status, 404);
});

// ================================================================== networks, days, restarts
console.log('one network, one day: apart, by the UTC day, through a restart');
await proof('networks apart: a network that owes leaves the next one free and byte for byte as with the toll off; an IPv6 /64 is one network, the next /64 another', async () => {
  const owes = net(); await pause(ON, owes);
  const free = net(), x = await ON.call('/routes.json?fmt=toon', { ip: free }), y = await OFF.call('/routes.json?fmt=toon', { ip: net() }); noToll(x, 'another network'); sameAs(x, ON.version, y, OFF.version, 'another network');
  await pause(ON, '2001:db8:7:1::1');
  assert.equal((await ON.call('/routes.json?fmt=toon', { ip: '2001:db8:7:1::abcd' })).h['x-sea-toll-state'], 'paused', 'the same /64');
  noToll(await ON.call('/routes.json?fmt=toon', { ip: '2001:db8:7:2::1' }), 'the next /64');
});
await proof('the UTC day: past midnight the same network has a new free quota and nothing open (byte for byte as with the toll off); the day before can still be settled by its id', async () => {
  const D0 = T0; setNow('2026-11-25T23:59:30.000Z');
  try {
    const N = await nodeOf(ROOT); calm(N); const ip = net(); await pause(N, ip); const old = await acct(N, ip), open = TOLL.microOf(TOLL.openTokens(old));
    setNow('2026-11-26T00:00:30.000Z');
    const r = await N.call('/routes.json?fmt=toon', { ip }), o = await OFF.call('/routes.json?fmt=toon', { ip: net() }); noToll(r, 'a new day'); sameAs(r, N.version, o, OFF.version, 'a new day');
    const a = await acct(N, ip); assert.equal(a.day, '2026-11-26'); assert.ok(a.s > 0 && a.t === 0, 'a fresh account');
    const ask = await N.call(`/fair/pay?r=${old.id}`, { method: 'POST', ip: net() }); assert.equal(ask.status, 402); assert.equal(Number(ask.j.accepts[0].maxAmountRequired), open, 'yesterday\'s toll, by its id');
  } finally { T0 = D0; }
});
await proof('a restart forgets nothing (the kv on disk, node/disk.mjs): the open toll, its id and the used free quota are there again; no second free quota the same day', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mare-toll-disk-')), file = join(dir, 'sea.ndjson');
  try {
    const d1 = diskKv(file); await d1.ready; const N1 = await nodeOf(ROOT, { kv: d1 }); calm(N1); const ip = net();
    await pause(N1, ip); const a1 = await acct(N1, ip), state = { s: a1.s, t: a1.t, id: a1.id };
    await d1.close();
    const d2 = diskKv(file); await d2.ready; const N2 = await nodeOf(ROOT, { kv: d2 }); calm(N2);
    const r = await N2.call('/routes.json?fmt=toon', { ip }); assert.equal(r.h['x-sea-toll-state'], 'paused', 'still due after the restart'); assert.equal(r.h['x-sea-toll-id'], state.id);
    const a2 = await acct(N2, ip); assert.deepEqual({ s: a2.s, t: a2.t, id: a2.id }, state);
    const fresh = net(), m = await compress(N2, fresh, MID); noToll(m, 'a network that saved nothing before the restart stays free');
    await d2.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
if (CONTROLS) {
  await proof('serve.mjs stopped (SIGTERM) and started again on the same MARE_STATE: the network that owed still owes the same sum under the same id', async () => {
    const state = mkdtempSync(join(tmpdir(), 'mare-toll-state-')), procs = [];
    const freePort = () => new Promise((res) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
    const start = async () => { const port = await freePort(), url = `http://127.0.0.1:${port}`; const p = spawn(process.execPath, ['serve.mjs', String(port)], { cwd: ROOT, env: { ...process.env, MARE_BASE: BASE, HOST: '127.0.0.1', MARE_STATE: state, NO_PROXY: '127.0.0.1', no_proxy: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'pipe'] }); let log = ''; p.stdout.on('data', (b) => { log += b; }); p.stderr.on('data', (b) => { log += b; }); procs.push(p);
      for (let i = 0; i < 200; i++) { try { if ((await realFetch(`${url}/stats`, { headers: { 'user-agent': 'MareLiberum-session/1.0' } })).ok) return { url, p }; } catch {} await new Promise((x) => setTimeout(x, 100)); } throw new Error(`serve.mjs did not answer: ${log.slice(-300)}`); };
    const post = async (url) => { const r = await realFetch(`${url}/compress`, { method: 'POST', headers: { 'content-type': 'text/html', 'user-agent': UA }, body: BIG }); await r.arrayBuffer(); return Object.fromEntries(r.headers); };
    const stop = (p) => new Promise((res) => { p.once('exit', res); p.kill('SIGTERM'); });
    try {
      const one = await start(); await post(one.url); await post(one.url); const before = await post(one.url);
      assert.equal(before['x-sea-toll-state'], 'paused'); await stop(one.p);
      const two = await start(); const after = await post(two.url);
      assert.equal(after['x-sea-toll-state'], 'paused', 'still due'); assert.equal(after['x-sea-toll-id'], before['x-sea-toll-id']); assert.equal(after['x-sea-toll-open-usd'], before['x-sea-toll-open-usd']);
      await stop(two.p);
    } finally { for (const p of procs) try { p.kill('SIGKILL'); } catch {} rmSync(state, { recursive: true, force: true }); }
  });
}

// ================================================================== who is never tolled
console.log('never tolled: the sea\'s own calls, crawlers, HEAD, the house agent, the app door');
await proof('on a network that owes: the session UA, GPTBot, Googlebot, ClaudeBot, Angel and HEAD get the lever answer exactly as with the toll off', async () => {
  const ip = net(); await pause(ON, ip); const url = newPage(40);
  for (const ua of ['MareLiberum-session/1.0', 'Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)', 'Mozilla/5.0 (compatible; Googlebot/2.1)', 'ClaudeBot/1.0', 'Angel/1.0 (+https://angel.oroboros-design.com)']) {
    const a = await ON.call('/routes.json?fmt=toon', { ip, ua }), b = await OFF.call('/routes.json?fmt=toon', { ip: net(), ua }); noToll(a, ua); sameAs(a, ON.version, b, OFF.version, ua);
  }
  const h = await ON.call('/routes.json?fmt=toon', { ip, head: true }), g = await OFF.call('/routes.json?fmt=toon', { ip: net(), head: true }); noToll(h, 'HEAD'); sameAs(h, ON.version, g, OFF.version, 'HEAD');
  const first = await ON.call(`/r/${url}`, { ip, accept: MD, ua: 'MareLiberum-session/1.0' }), s = await ON.call(`/r/${url}?since=${first.h.etag.replace(/^W\/"|"$/g, '')}`, { ip, accept: MD, ua: 'MareLiberum-session/1.0', headers: { 'x-sea-toll': 'pay' } });
  noToll(s, 'the session UA reads again'); assert.match(s.text, /^Unchanged since/);
  const a2 = await ON.call('/routes.json?fmt=toon', { ip, ua: 'Angel/1.0', headers: { 'x-sea-toll': 'pay' } }); assert.equal(a2.status, 200); noToll(a2, 'Angel never asked');
});
await proof(`/mcp/app answers byte for byte as ${REF} (but for the version in serverInfo) and as with the toll off, also for a network that owes and asks to pay`, async () => {
  assert.ok(THEIRS, `a tree of ${REF}`); const ip = net(); await pause(ON, ip);
  const INIT = { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'toll-proof', version: '1' } };
  for (const [m, p] of [['initialize', INIT], ['tools/list', null], ['tools/call', { name: 'think', arguments: { q: 'find mcp servers for postgres' } }]]) {
    const a = await ON.rpc('/mcp/app', m, p, { ip, headers: { 'x-sea-toll': 'pay' } }), b = await THEIRS.rpc('/mcp/app', m, p, { ip: net() }), c = await OFF.rpc('/mcp/app', m, p, { ip: net() });
    noToll(a, m); sameAs(a, ON.version, b, THEIRS.version, `${m} against ${REF}`); sameAs(a, ON.version, c, OFF.version, `${m} toll off`);
  }
});

// ================================================================== off or resting: every door as origin/main
console.log(`switched off (MARE_TOLL=off) or resting ("toll" in rest of immune:policy): every door byte for byte as ${REF}`);
const DOOR_RUN = async (n, ip) => {
  PAGES.set('https://quay.toll-proof.dev/guide', pageOf(7001, 50)); await n.kv.set(readCacheKey('https://quay.toll-proof.dev/guide'), null, 1);
  const out = [], put = (name, r) => out.push([name, r]);
  put('/compress big 1', await compress(n, ip)); put('/compress big 2', await compress(n, ip)); put('/compress big 3', await compress(n, ip));
  put('/compress json', await n.call('/compress', { method: 'POST', ip, body: { json: TABLE } })); put('/compress text/plain', await compress(n, ip, MID, { accept: 'text/plain' }));
  put('/compress x-sea-toll: pay', await compress(n, ip, MID, { headers: { 'x-sea-toll': 'pay' } }));
  put('fmt=toon', await n.call('/routes.json?fmt=toon', { ip })); put('Accept text/toon', await n.call('/routes.json', { ip, accept: 'text/toon' })); put('fields', await n.call('/routes.json?fields=doors', { ip }));
  put('fmt=toon with a payment', await n.call('/routes.json?fmt=toon', { ip, headers: { 'payment-signature': v2(54000) } })); put('fmt=toon x-sea-toll: pay', await n.call('/routes.json?fmt=toon', { ip, headers: { 'x-sea-toll': 'pay' } }));
  const r1 = await n.call('/r/https://quay.toll-proof.dev/guide', { ip, accept: MD }), tag = r1.h.etag; put('/r/', r1);
  put('since=', await n.call(`/r/https://quay.toll-proof.dev/guide?since=${tag.replace(/^W\/"|"$/g, '')}`, { ip, accept: MD })); put('If-None-Match', await n.call('/r/https://quay.toll-proof.dev/guide', { ip, accept: MD, headers: { 'if-none-match': tag } }));
  put('budget=', await n.call('/r/https://quay.toll-proof.dev/guide?budget=400', { ip, accept: MD }));
  PAGES.set('https://quay.toll-proof.dev/guide', pageOf(7001, 50, '<p>One more paragraph about the night ferry.</p>')); await n.kv.set(readCacheKey('https://quay.toll-proof.dev/guide'), null, 1);
  put('since= changed', await n.call(`/r/https://quay.toll-proof.dev/guide?since=${tag.replace(/^W\/"|"$/g, '')}`, { ip, accept: MD }));
  for (const [m, p] of [['initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'toll-proof', version: '1' } }], ['tools/list', null], ['tools/call', { name: 'call_tool', arguments: { name: 'build_agent', arguments: {} } }], ['tools/call', { name: 'find_tools', arguments: { need: 'buy shoes' } }], ['tools/call', { name: 'think', arguments: { q: 'cheap flights' } }]]) put(`/mcp/lean ${m} ${p?.name || ''}`, await n.rpc('/mcp/lean', m, p, { ip }));
  put('/mcp tools/list', await n.rpc('/mcp', 'tools/list', null, { ip })); put('/mcp/app tools/list', await n.rpc('/mcp/app', 'tools/list', null, { ip }));
  put('/hello', await n.call('/hello', { ip })); put('/routes.json', await n.call('/routes.json', { ip }));
  put('/fair/pay GET', await n.call('/fair/pay', { ip })); put('/fair/pay toll id', await n.call('/fair/pay?r=t20261125abcdefgh', { method: 'POST', ip })); put('/.well-known/x402', await n.call('/.well-known/x402', { ip }));
  return out;
};
await proof(`the toll switched off, and resting: ${'every door'} answers byte for byte as ${REF} (the version masked), on a network far above the quota`, async () => {
  assert.ok(THEIRS, `a tree of ${REF}`);
  const theirs = await DOOR_RUN(THEIRS, net()), off = await DOOR_RUN(OFF, net());
  calm(ON, ['toll']); let resting; try { resting = await DOOR_RUN(ON, net()); } finally { calm(ON, []); }
  assert.equal(theirs.length, off.length);
  for (let i = 0; i < theirs.length; i++) { const [name] = theirs[i]; noToll(off[i][1], name); noToll(resting[i][1], name); sameAs(off[i][1], OFF.version, theirs[i][1], THEIRS.version, `off: ${name}`); sameAs(resting[i][1], ON.version, theirs[i][1], THEIRS.version, `resting: ${name}`); }
  assert.ok(Number(off[1][1].h['x-sea-engine-saved']) > 100000, 'the lever still acts above the quota');
  const on = await DOOR_RUN(ON, net()); assert.equal(on[0][1].h['x-sea-toll-state'], 'open', 'and on, the same run is tolled'); assert.equal(on[2][1].h['x-sea-toll-state'], 'paused');
});
await proof('MARE_TOLL=off in the environment, "till" in rest, or a till without wallet or facilitator: no toll; the pages say whether it acts', async () => {
  const { tollSwitch } = TOLL; assert.equal(tollSwitch({}, { MARE_TOLL: 'off' }), false); assert.equal(tollSwitch({}, { MARE_TOLL: '' }), true); assert.equal(tollSwitch({}, {}), true); assert.equal(tollSwitch({ toll: 'no' }, {}), false);
  const ip = net(); await pause(ON, ip);
  calm(ON, ['till']); try { noToll(await ON.call('/routes.json?fmt=toon', { ip }), 'the till rests'); } finally { calm(ON, []); }
  noToll(await ON.call('/routes.json?fmt=toon', { ip, c: { pay: { ...ON.PAY, facilitator: null } } }), 'no facilitator'); noToll(await ON.call('/routes.json?fmt=toon', { ip, c: { pay: { ...ON.PAY, payTo: '' } } }), 'no wallet');
  assert.equal((await ON.call('/routes.json?fmt=toon', { ip })).h['x-sea-toll-state'], 'paused', 'on again');
  assert.equal((await OFF.call('/engine.json', { ip })).j.toll.on, false); assert.equal((await ON.call('/engine.json', { ip })).j.toll.on, true);
});

// ================================================================== what the pages say
console.log('the facts where agents and people read them');
await proof('/engine (a section "The toll" with the example $0.003630), /engine.json, /fair, /pricing (one line) and llms.txt say the price, the free quota, $0.05, the normal answer and that unpaid tolls are not collected; the terms are left to the release of the legal texts', async () => {
  const ip = net(), e = await ON.call('/engine', { ip, accept: 'text/html' }), ej = (await ON.call('/engine.json', { ip })).j.toll;
  assert.ok(e.text.includes('<h2 id="toll">The toll</h2>'));
  for (const w of ['Up to 100,000 saved tokens per network and UTC day stay free', '20 % of the tokens it saved, at USD 2 per million', 'reads a page of 9,128 tokens again with since=', '9,077 tokens saved', '0.2 × 9,077 × $2 / 1,000,000 = $0.003630', 'settled once the open sum reaches $0.05', 'An agent without a wallet gets the normal answer', 'Unpaid tolls are not collected', 'the lean answers pause and the normal answers continue']) {
    assert.ok(e.text.replace(/&amp;/g, '&').includes(w.replace(/&/g, '&')) || e.text.includes(w), `/engine: ${w}`);
  }
  assert.equal(ej.numbers.example.usd, '0.003630'); assert.equal(ej.numbers.freeTokensPerNetworkPerDay, 100000); assert.equal(ej.on, true);
  const f = await ON.call('/fair', { ip, accept: 'text/html' }); assert.ok(f.text.includes('The toll, apart from fair share') && f.text.includes('Unpaid tolls are not collected'));
  const p = await ON.call('/pricing', { ip, accept: 'text/html' }), pj = await ON.call('/pricing.json', { ip }), line = 'Up to 100,000 tokens saved by the lossless levers stay free per network and UTC day; above that an answer costs 20 % of the tokens it saved, at USD 2 per million, settled over x402 in one payment from $0.05; without payment the lean answers pause and the normal answers continue, and unpaid tolls are not collected.';
  assert.equal(p.text.split('id="toll"').length - 1, 1, '/pricing: one line'); assert.ok(p.text.includes(line), '/pricing: the line'); assert.ok(pj.j.toll.includes(line) && pj.j.toll.endsWith('https://mare.test/engine#toll'), '/pricing.json: the line');
  // the terms page stays as origin/main has it: the legal texts, the toll's among them, come in a release of their own
  const t = await ON.call('/terms', { ip: net(), accept: 'text/html' }), t0 = THEIRS ? await THEIRS.call('/terms', { ip: net(), accept: 'text/html' }) : null; assert.ok(t0, `a tree of ${REF}`); sameAs(t, ON.version, t0, THEIRS.version, '/terms');
  const l = SITE['/llms.txt'].body; for (const w of ['The toll: up to 100,000 tokens saved by the lossless levers stay free per network and UTC day', '0.2 x 9,077 x $2 / 1,000,000 = $0.003630', 'x-sea-toll: pay', 'POST https://mareliberum.dev/fair/pay?r=<x-sea-toll-id>', 'unpaid tolls are not collected', 'https://mareliberum.dev/engine#toll']) assert.ok(l.includes(w), `llms.txt: ${w}`);
});
await proof('3.37.0 in VERSION, server.json, server-dev.json, server-lean.json and gemini-extension.json; RELEASES: 3.37.0 without day and pull request, 3.36.0 on 2026-11-25T19:03:27+01:00 with #27; proof:toll in package.json', async () => {
  assert.equal(ON.version, '3.37.0'); for (const f of ['server.json', 'server-dev.json', 'server-lean.json', 'gemini-extension.json']) assert.equal(JSON.parse(readFileSync(join(ROOT, f), 'utf8')).version, '3.37.0', f);
  assert.deepEqual([RELEASES[0].version, RELEASES[0].at, RELEASES[0].pr], ['3.37.0', null, undefined]); assert.ok(RELEASES[0].what.length > 40 && !RELEASES[0].what.includes('\n'));
  assert.deepEqual([RELEASES[1].version, RELEASES[1].at, RELEASES[1].pr], ['3.36.0', '2026-11-25T19:03:27+01:00', 'https://github.com/daoudandiaye98-alt/mare-liberum/pull/27']);
  assert.equal(JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).scripts['proof:toll'], 'node tools/toll-proof.mjs');
});

await Promise.allSettled(waits.splice(0));
console.log(`\n${passed} proofs held, ${failed} failed`);

// ------------------------------------------------------------------ negative controls: break one rule in a copy, the proof must fail there
// Each control copies the code, changes one line so that one rule no longer holds, and runs this proof in the copy with
// --no-controls (the release to compare with handed on as MARE_TOLL_REF_DIR). A control is caught when that run fails.
const BREAK = [
  ['the share raised: 0.25 instead of 0.2 of a saving', 'node/toll.mjs', "shareE6: Math.round(share * 1e6)", "shareE6: Math.round(share * 1.25e6)"],
  ['rounded up instead of down', 'node/toll.mjs', "* BigInt(C.priceE6)) / 1_000_000_000_000n)", "* BigInt(C.priceE6) + 999_999_999_999n) / 1_000_000_000_000n)"],
  ['no free quota', 'node/toll.mjs', 'const free = Math.max(0, Math.min(s, C.free - a.s)), tolled = s - free;', 'const free = 0, tolled = s - free;'],
  ['the quota counted once more than it holds (100,001 free)', 'node/toll.mjs', 'const free = Math.max(0, Math.min(s, C.free - a.s)), tolled = s - free;', 'const free = Math.max(0, Math.min(s, C.free + 1 - a.s)), tolled = s - free;'],
  ['never due: the lever answer for a caller that does not pay', 'node/toll.mjs', 'if (tolled > 0 && openMicro(a) >= C.settleMicro) {', 'if (false) {'],
  ['the 402 asks one millionth more than is open', 'node/toll.mjs', "const t = tollTerms(payCfg, { base, ids: due.map((a) => a.id), micro });", "const t = tollTerms(payCfg, { base, ids: due.map((a) => a.id), micro: micro + 1 });"],
  ['a payment for another sum taken', 'node/toll.mjs', 'const exact = exactOf(p, t); if (exact)', 'const exact = exactOf(p, t); if (false)'],
  ['a replayed payment not refused', 'node/toll.mjs', "if (seen) return { required: t, tokens, error: 'this payment was used before: nothing was cleared' };", ''],
  ['a payment that did not settle clears the toll', 'node/toll.mjs', '} else if (!WAY.has(r.sale.status)) for (const a of due) { releaseHold(a, r.sale.id); save(a); }', '} else for (const a of due) { settleHold(a, r.sale.id); save(a); }'],
  ['a payment on its way not held (the toll asked for again meanwhile)', 'node/toll.mjs', 'for (const a of due) { a.h.push({ sale: sale.id, tok: cover.get(a.key), micro: microOf(cover.get(a.key), C), at }); save(a); }', 'for (const a of due) { save(a); }'],
  ['a settled payment never clears', 'node/toll.mjs', "const settleHold = (a, sale) => { const i = a.h.findIndex((x) => x.sale === sale); if (i < 0) return false; a.p += a.h[i].tok;", "const settleHold = (a, sale) => { const i = a.h.findIndex((x) => x.sale === sale); if (i < 0) return false; a.p += 0;"],
  ['networks share one account', 'node/toll.mjs', ".update(`${day}|${net}`)", ".update(`${day}|`)"],
  ['no new day: the account of the day the node started', 'node/toll.mjs', "const dayOf = () => String(now()).slice(0, 10);", "const dayOf = () => '2026-11-25';"],
  ['nothing written to the kv', 'node/toll.mjs', "const save = (a) => { try { const p = kv.set(a.key, pack(a), ttlOf(a)); p?.catch?.(() => {}); } catch {} };", 'const save = () => {};'],
  ['the switch not asked', 'node/core.mjs', "const tollShown = (cfg) => tollSwitch(cfg) && !immune.atRest?.('toll')", "const tollShown = (cfg) => !immune.atRest?.('toll')"],
  ['the rest switch not asked', 'node/core.mjs', "const tollShown = (cfg) => tollSwitch(cfg) && !immune.atRest?.('toll') && ", "const tollShown = (cfg) => tollSwitch(cfg) && "],
  ['the sea\'s own calls tolled', 'node/core.mjs', "isHead(req, cfg) || who.kind === 'self' || READERS.includes(who.kind) || isHouse(who)) return null;", "isHead(req, cfg) || READERS.includes(who.kind) || isHouse(who)) return null;"],
  ['crawlers tolled', 'node/core.mjs', "isHead(req, cfg) || who.kind === 'self' || READERS.includes(who.kind) || isHouse(who)) return null;", "isHead(req, cfg) || who.kind === 'self' || isHouse(who)) return null;"],
  ['HEAD tolled', 'node/core.mjs', "if (!tollActs(cfg) || isHead(req, cfg) || who.kind === 'self'", "if (!tollActs(cfg) || who.kind === 'self'"],
  ['the house agent tolled', 'node/core.mjs', "READERS.includes(who.kind) || isHouse(who)) return null;", "READERS.includes(who.kind)) return null;"],
  ['the lossy projection tolled with TOON (fields= and fmt=toon)', 'node/core.mjs', "const d = g.decide(got.find((s) => s.lever === 'toon')?.saved || 0);", "const d = g.decide(got.reduce((x, s) => x + (s.saved || 0), 0));"],
  ['the lossy part of /compress tolled (q, budget)', 'node/press.mjs', 'const d = toll ? toll.decide(r.parts.lossless?.saved || 0) : null;', 'const d = toll ? toll.decide(r.saving.saved || 0) : null;'],
  ['the reader\'s JSON answer asked for the toll', 'node/core.mjs', 'const tg = eng && !wantJson && (eng.since', 'const tg = eng && (eng.since'],
  ['tools/list asked for the toll', 'node/core.mjs', "if (lean && list.some((x) => x?.method === 'tools/call'))", "if (lean && list.some((x) => x?.method === 'tools/call' || x?.method === 'tools/list'))"],
  ['/compress hands the lever answer while the toll is due', 'node/press.mjs', 'if (d && !d.lever) {', 'if (false) {'],
  ['the lean door\'s TOON while the toll is due', 'node/core.mjs', "if (d && !d.lever) return ok({ content: [{ type: 'text', text: JSON.stringify(out) }], structuredContent: out,", "if (false) return ok({ content: [{ type: 'text', text: JSON.stringify(out) }], structuredContent: out,"],
  ['a toll payment counted as a sale of the paid move', 'node/ledger.mjs', 'const all = given.filter((s) => !isToll(s));', 'const all = given;'],
  ['a toll payment counted as fair share', 'node/fair.mjs', ".then((l) => l.filter((p) => p.kind !== 'toll'))", ''],
  ['a header for an answer under the quota', 'node/toll.mjs', "if (!d?.state || d.state === 'free') return {};", "if (!d?.state) return {};"],
];
let caught = 0;
if (CONTROLS) {
  console.log('\nnegative controls: each rule broken in a copy, the proof must fail there');
  for (const [what, f, from, to] of BREAK) {
    const tmp = mkdtempSync(join(tmpdir(), 'mare-toll-ctl-'));
    try {
      for (const d of ['node', 'site', 'proof', 'config', 'public']) if (existsSync(join(ROOT, d))) cpSync(join(ROOT, d), join(tmp, d), { recursive: true });
      mkdirSync(join(tmp, 'tools'), { recursive: true }); cpSync(join(ROOT, 'tools/toll-proof.mjs'), join(tmp, 'tools/toll-proof.mjs'));
      for (const x of ['package.json', 'server.json', 'server-dev.json', 'server-lean.json', 'gemini-extension.json']) cpSync(join(ROOT, x), join(tmp, x));
      const src = readFileSync(join(tmp, f), 'utf8');
      if (!src.includes(from)) { console.log(`  FAIL control "${what}": the line to break is gone from ${f}; the control needs updating`); continue; }
      writeFileSync(join(tmp, f), src.replace(from, to));
      const run = spawnSync(process.execPath, ['tools/toll-proof.mjs', '--no-controls'], { cwd: tmp, encoding: 'utf8', timeout: 600_000, env: { ...process.env, MARE_TOLL_REF_DIR: refDir || '', MARE_TOLL_FIRST_FAIL: '1' } });
      const held = /(\d+) proofs held, (\d+) failed/.exec(run.stdout || '');
      if (run.status !== 0 && held && Number(held[2]) > 0) { caught++; console.log(`  ok   caught: ${what} (${held[2]} ${held[2] === '1' ? 'proof' : 'proofs'} failed)`); }
      else console.log(`  FAIL not caught: ${what} (exit ${run.status}${held ? `, ${held[0]}` : ''}${run.stderr ? `; ${String(run.stderr).split('\n')[0].slice(0, 160)}` : ''})`);
    } finally { rmSync(tmp, { recursive: true, force: true }); }
  }
  console.log(`${caught} of ${BREAK.length} controls caught`);
}
if (refDir && !process.env.MARE_TOLL_REF_DIR) rmSync(refDir, { recursive: true, force: true });
process.exit(failed || (CONTROLS && caught !== BREAK.length) ? 1 : 0);
