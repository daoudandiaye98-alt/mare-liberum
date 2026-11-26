// Mare Liberum · proof of the books from the chain and the operator's digest (3.38, node/books.mjs, D7 and D8 of the night
// of 25./26.11.2026). It proves, on a chain of its own (a stub of Base's RPC: no live chain is asked) and on nodes in this
// process (handle, as serve.mjs answers):
//   the two event topics are keccak256 of their signatures (a keccak of this file, checked against its known value first);
//   the books read USDC's Transfer logs to the wallet in small ranges from the last block read, halve a range the RPC finds
//   too large and leave no block out, skip what is not money in (a removed log, a zero transfer, another token, another
//   wallet), take the block's time from the chain, keep exact base units (BigInt) and the USD string; a restart resumes from
//   the cursor written at once (the copy on disk not yet made) and counts nothing twice; a write that fails never moves the
//   cursor; a chain that does not answer makes the pass wait (30 s, doubled) and never reaches a caller: the doors answer
//   while the RPC hangs; read only (eth_blockNumber, eth_getLogs, eth_getBlockByNumber, nothing else, in the code too);
//   the labels: till, fair and toll by the transaction, toll by the signed transfer (AuthorizationUsed's wallet and nonce),
//   best effort by wallet, amount and time, unmatched else, and labelled later when the record comes; the flags: a toll
//   payment released but on chain (and the flag stays when the toll's books let the payment go), an unsettled sale on chain;
//   the names: books:* only, never one the database keeps (a store that records every write sees none of them); retention:
//   ten years from the end of the payment's calendar year in German time (a payment at 23:30 UTC on 31 December counts in
//   the next year), on every day's entries in the copy on disk;
//   the doors: /operator/ledger.csv, /operator/ledger.json and /operator/digest answer 403 without the operator key and with a
//   wrong one, and the books and the exact per-day numbers of the digest with it (declarations through the real button,
//   toll accounts and books, till sales, fair share, the facilitator's answers, the chain's errors); /status.json gains
//   counts and nothing else (no address, no transaction, no sum); against origin/main, /mcp/app (initialize, tools/list, a
//   call) and the other public pages byte for byte, the privacy notice apart only by its new sentences; the privacy notice
//   (German and English) says what is kept, why, on which legal basis, how long, and that the addresses come from the chain.
// Negative controls at the end: each rule broken in a copy of the code, and this proof must fail there.
// Runs without the network: node tools/books-proof.mjs   (exit code 1 when a proof fails or a control is not caught)
//   --no-controls            only the proofs (the controls run this file that way in each broken copy)
//   MARE_BOOKS_REF=<ref>      the tree the public answers are compared with (default origin/main of the night, 2d6ca74; in a release
//                            that carries other changes too, the tree of that release without this branch)
//   MARE_BOOKS_REF_DIR=<dir>  that tree already extracted (the controls hand it on; no git in their copies)
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, cpSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { Buffer } from 'node:buffer';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTROLS = !process.argv.includes('--no-controls');
for (const k of ['MARE_TOLL', 'MARE_ENGINE', 'MARE_FAIR', 'MARE_X402_FACILITATOR', 'MARE_PAY_TO', 'MARE_ROUTE_PRICE_CENTS', 'MARE_STATE', 'MARE_DB_URL', 'MARE_DB_KEY', 'MARE_DB_SECRET', 'MARE_BASE_RPC', 'MARE_BOOKS', 'MARE_BOOKS_SINCE', 'MARE_BOOKS_FROM_BLOCK', 'MARE_MAIL', 'MARE_MAIL_KEY', 'MARE_MAIL_FROM', 'MARE_VIA_SECRET']) delete process.env[k];
const RPC = 'https://rpc.books-proof.dev'; process.env.MARE_BASE_RPC = RPC;
let passed = 0, failed = 0;
const proof = async (name, fn) => {
  try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 6).join('\n       ')}`); }
  if (failed && process.env.MARE_BOOKS_FIRST_FAIL === '1') { console.log(`\n${passed} proofs held, ${failed} failed (stopped at the first)`); process.exit(1); }
};

// ------------------------------------------------------------------ one clock for every node of the proof, moved on purpose
const D = globalThis.Date; let T0 = D.parse('2026-11-23T01:40:00.000Z');
class Clock extends D { constructor(...a) { if (a.length) super(...a); else super(T0); } static now() { return T0; } }
globalThis.Date = Clock;
const setNow = (iso) => { T0 = D.parse(iso); };
const later = (s) => { T0 += s * 1000; };

// ------------------------------------------------------------------ keccak-256 (the original padding of Ethereum, not SHA3's)
const RC = ['0x1', '0x8082', '0x800000000000808a', '0x8000000080008000', '0x808b', '0x80000001', '0x8000000080008081', '0x8000000000008009', '0x8a', '0x88', '0x80008009', '0x8000000a', '0x8000808b', '0x800000000000008b', '0x8000000000008089', '0x8000000000008003', '0x8000000000008002', '0x8000000000000080', '0x800a', '0x800000008000000a', '0x8000000080008081', '0x8000000000008080', '0x80000001', '0x8000000080008008'].map(BigInt);
const ROT = [[0, 36, 3, 41, 18], [1, 44, 10, 45, 2], [62, 6, 43, 15, 61], [28, 55, 25, 21, 56], [27, 20, 39, 8, 14]];
const M64 = (1n << 64n) - 1n, rotl = (v, n) => (n === 0 ? v : ((v << BigInt(n)) | (v >> BigInt(64 - n))) & M64);
function keccak256(str) {
  const msg = Buffer.from(str, 'utf8'), rate = 136, len = Math.ceil((msg.length + 1) / rate) * rate, p = Buffer.alloc(len); msg.copy(p); p[msg.length] ^= 0x01; p[len - 1] ^= 0x80;
  const A = Array.from({ length: 25 }, () => 0n);
  for (let off = 0; off < len; off += rate) {
    for (let i = 0; i < rate / 8; i++) A[i] ^= p.readBigUInt64LE(off + i * 8);
    for (let r = 0; r < 24; r++) {
      const C = [0, 1, 2, 3, 4].map((x) => A[x] ^ A[x + 5] ^ A[x + 10] ^ A[x + 15] ^ A[x + 20]);
      for (let x = 0; x < 5; x++) { const d = C[(x + 4) % 5] ^ rotl(C[(x + 1) % 5], 1); for (let y = 0; y < 5; y++) A[x + 5 * y] ^= d; }
      const B = Array(25);
      for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) B[y + 5 * ((2 * x + 3 * y) % 5)] = rotl(A[x + 5 * y], ROT[x][y]);
      for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) A[x + 5 * y] = B[x + 5 * y] ^ (~B[((x + 1) % 5) + 5 * y] & M64 & B[((x + 2) % 5) + 5 * y]);
      A[0] ^= RC[r];
    }
  }
  const out = Buffer.alloc(32); for (let i = 0; i < 4; i++) out.writeBigUInt64LE(A[i], i * 8);
  return `0x${out.toString('hex')}`;
}

// ------------------------------------------------------------------ the chain of the proof: Base as a stub (no live chain is asked)
const hex = (n) => `0x${BigInt(n).toString(16)}`, num = (h) => Number(BigInt(h));
const pad = (a) => `0x${String(a).toLowerCase().slice(2).padStart(64, '0')}`;
const word = (v) => `0x${BigInt(v).toString(16).padStart(64, '0')}`;
const answer = (j, status = 200) => new Response(JSON.stringify(j), { status, headers: { 'content-type': 'application/json' } });
const G = D.parse('2026-11-22T00:00:00Z') / 1000; // the time of block 0 of this chain; a block every 2 seconds
const chain = { head: 46_000, maxRange: 500, down: false, hang: false, logs: [], sloppy: [], asked: [], stamps: false, limited: 0 };
const timeOf = (n) => G + 2 * n;
const matches = (l, f) => {
  if (f.address && String(l.address).toLowerCase() !== String(f.address).toLowerCase()) return false;
  return (f.topics || []).every((t, i) => t == null || (Array.isArray(t) ? t.map((x) => x.toLowerCase()).includes(String(l.topics[i]).toLowerCase()) : String(t).toLowerCase() === String(l.topics[i]).toLowerCase()));
};
const FAC = 'https://facilitator.books-proof.dev';
const fac = { down: false, probes: 0, verify: () => answer({ isValid: true, payer: '0x9999999999999999999999999999999999999999' }), settle: () => answer({ success: true, transaction: `0x${'ab'.repeat(32)}` }) };
const realFetch = globalThis.fetch;
globalThis.fetch = async (u, o = {}) => {
  const s = String(u?.url ?? u);
  if (s === RPC) {
    const body0 = JSON.parse(o.body);
    if (chain.hangFrom != null && body0.method === 'eth_getLogs' && num(body0.params[0].fromBlock) >= chain.hangFrom) { chain.hanging = true; chain.hungAt = num(body0.params[0].fromBlock); await new Promise((_, rej) => { chain.release = () => rej(new Error('let go')); }); }
    if (chain.hang) await new Promise((_, rej) => { const f = () => rej(Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' })); if (o.signal?.aborted) f(); else o.signal?.addEventListener('abort', f); });
    if (chain.down) throw new Error('connect ECONNREFUSED rpc.books-proof.dev');
    const b = JSON.parse(o.body); chain.asked.push(b);
    const ok = (result) => answer({ jsonrpc: '2.0', id: b.id, result }), err = (code, message) => answer({ jsonrpc: '2.0', id: b.id, error: { code, message } });
    if (b.method === 'eth_blockNumber') return ok(hex(chain.head));
    if (b.method === 'eth_getBlockByNumber') { const n = b.params[0] === 'latest' ? chain.head : num(b.params[0]); return ok(n > chain.head ? null : { number: hex(n), timestamp: hex(timeOf(n)) }); }
    if (b.method === 'eth_getLogs') {
      if (chain.limited > 0) { chain.limited--; return answer({ jsonrpc: '2.0', id: b.id, error: { code: -32005, message: 'rate limit exceeded: too many requests' } }, 429); }
      const f = b.params[0], a = num(f.fromBlock), z = num(f.toBlock);
      if (z - a + 1 > chain.maxRange) return err(-32005, `block range is too large: at most ${chain.maxRange}`);
      const known = chain.lagUntil ? Math.min(z, chain.lagUntil) : z; // a backend behind a load balancer that has indexed the logs only so far
      const inRange = (l) => num(l.blockNumber) >= a && num(l.blockNumber) <= known;
      return ok([...chain.logs.filter((l) => inRange(l) && matches(l, f)), ...chain.sloppy.filter(inRange)].map((l) => (chain.stamps ? { ...l, blockTimestamp: hex(timeOf(num(l.blockNumber))) } : l)));
    }
    return err(-32601, `the proof's chain does not know ${b.method}`);
  }
  if (s.startsWith(FAC)) {
    if (fac.down) throw new Error('connect ECONNREFUSED facilitator');
    const kind = s.slice(FAC.length + 1); if (kind === 'supported') { fac.probes++; return answer({ kinds: [{ x402Version: 1, scheme: 'exact', network: 'base' }] }); }
    return fac[kind] ? fac[kind](JSON.parse(o.body || '{}')) : answer({}, 404);
  }
  if (/^http:\/\/127\.0\.0\.1:\d+\//.test(s)) return realFetch(u, o);
  throw new Error(`the proof does not use the network: ${s.slice(0, 80)}`);
};

// ------------------------------------------------------------------ the modules of this tree
const imp = (dir, f) => import(pathToFileURL(join(dir, 'node', f)).href);
const B = await imp(ROOT, 'books.mjs'), { USDC_BASE, HOUSE_WALLET } = await imp(ROOT, 'pricing.mjs'), { diskKv } = await imp(ROOT, 'disk.mjs');
const { memoryKv } = await imp(ROOT, 'flow.mjs'), { durableKv, KEPT } = await imp(ROOT, 'durable.mjs'), { createLedger } = await imp(ROOT, 'ledger.mjs');
const PAY = await imp(ROOT, 'pay.mjs');
const WALLET = HOUSE_WALLET.toLowerCase(), OTHER_WALLET = '0x4444444444444444444444444444444444444444', USDT = '0xfde4c96c8593536e31f229ea8f37b2ada2699bb2';
const A = (c) => `0x${c.repeat(40)}`; // a paying wallet of the proof
const TX = (c) => `0x${c.repeat(64)}`;
const NONCE = (c) => `0x${c.repeat(64)}`;
const put = (n, { from, value, tx, li = 4, nonce = null, to = WALLET, token = USDC_BASE, removed = false, into = chain.logs }) => {
  if (nonce) into.push({ address: token, topics: [B.AUTH_USED_TOPIC, pad(from), nonce], data: '0x', blockNumber: hex(n), transactionHash: tx, logIndex: hex(li - 1), removed: false });
  into.push({ address: token, topics: [B.TRANSFER_TOPIC, pad(from), pad(to)], data: word(value), blockNumber: hex(n), transactionHash: tx, logIndex: hex(li), removed });
};
const iso = (n) => new D(timeOf(n) * 1000).toISOString();
// the scene: a payment of each kind, and what is not money in
const S = {
  till: { n: 42_000, from: A('a'), value: 20_000, tx: TX('1') },
  fair: { n: 42_100, from: A('b'), value: 50_000, tx: TX('2') },
  toll: { n: 42_200, from: A('c'), value: 61_234, tx: TX('3'), nonce: NONCE('3') },
  released: { n: 42_300, from: A('d'), value: 70_000, tx: TX('4'), nonce: NONCE('4') },
  weak: { n: 42_400, from: A('e'), value: 20_000, tx: TX('5') },
  other: { n: 42_500, from: A('f'), value: 12_345_678_901_234_567n, tx: TX('6') },
  late: { n: 43_000, from: A('7'), value: 20_000, tx: TX('7') },
  unsettled: { n: 43_100, from: A('8'), value: 20_000, tx: TX('8') },
};
for (const x of Object.values(S)) put(x.n, x);
put(42_600, { from: A('9'), value: 0, tx: TX('9') });                                           // a zero transfer (address poisoning): no money
put(42_700, { from: A('a'), value: 999_000, tx: TX('a'), removed: true });                    // a log of a block that was replaced
put(42_800, { from: A('b'), value: 1_000_000, tx: TX('b'), token: USDT, into: chain.sloppy });    // another token, handed by a sloppy RPC
put(42_900, { from: A('c'), value: 1_000_000, tx: TX('c'), to: OTHER_WALLET, into: chain.sloppy }); // another wallet, the same
// what the doors' own records hold (the till's copy of its sales, fair share's registry, the toll's books)
const ledger = createLedger({});
const sale = (row, ts) => { setNow(ts); const r = ledger.sale(row); return r; };
const recordsFor = async (kv) => {
  sale({ q: 'route', amount_cents: 2, status: 'settled', tx: S.till.tx, payer: S.till.from, method: 'x402-v2' }, new D((timeOf(S.till.n) - 5) * 1000).toISOString());
  sale({ q: 'route', amount_cents: 2, status: 'pending', payer: S.weak.from, method: 'x402-v2' }, new D((timeOf(S.weak.n) - 30) * 1000).toISOString());
  S.unsettledSale = sale({ q: 'route', amount_cents: 2, status: 'unsettled', payer: S.unsettled.from, method: 'x402-v2' }, new D((timeOf(S.unsettled.n) - 40) * 1000).toISOString());
  await kv.set('fair:pay', [{ sale: 'sfair1', ids: ['r1'], micro: 50_000, status: 'settled', at: iso(S.fair.n - 10), tx: S.fair.tx }], 400 * 86400);
  const keepNow = (k, v, ttl) => (typeof kv.setNow === 'function' ? kv.setNow(k, v, ttl) : kv.set(k, v, ttl)); // the toll writes its books at once
  await keepNow('toll:books', { v: 1, total: { micro: 61_234, n: 1 }, days: { [iso(S.toll.n).slice(0, 10)]: { micro: 61_234, n: 1 } }, pays: [
    { id: 'tp1', at: iso(S.toll.n - 20), status: 'settled', micro: 61_234, tok: 153_085, keys: [], ids: ['t20261122aaaaaaaa'], from: S.toll.from, nonce: S.toll.nonce, before: timeOf(S.toll.n) + 300, win: 300, end: iso(S.toll.n + 400), why: 'the chain says its signed transfer was carried out (USDC authorizationState on Base)' },
    { id: 'tp2', at: iso(S.released.n - 20), status: 'released', micro: 70_000, tok: 175_000, keys: [], ids: ['t20261122bbbbbbbb', 't20261122cccccccc'], from: S.released.from, nonce: S.released.nonce, before: timeOf(S.released.n) + 300, win: 300, end: iso(S.released.n + 4000), why: 'the chain gave no answer for an hour after its time: released' },
  ] }, 4000 * 86400);
};
const OPTS = { wallet: HOUSE_WALLET, rpc: RPC, since: '2026-11-23', pauseMs: 0, everyMs: 1e9, catchUpMs: 1e9, probe: false, burst: 100 };
const tmp = (p) => { const d = mkdtempSync(join(tmpdir(), p)); process.once('exit', () => { try { rmSync(d, { recursive: true, force: true }); } catch {} }); return d; };
const linesOf = (f) => (existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);

console.log(`the books from the chain: ${B.BOOKS_VERSION}, wallet ${WALLET}, token ${USDC_BASE}, kept ${B.BOOKS_RETAIN.years} years (${B.BOOKS_RETAIN.basis})`);

await proof('the topics are keccak256 of the event signatures (the keccak of this proof first checked against its known value)', () => {
  assert.equal(keccak256(''), '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470');
  assert.equal(keccak256('Transfer(address,address,uint256)'), B.TRANSFER_TOPIC);
  assert.equal(keccak256('AuthorizationUsed(address,bytes32)'), B.AUTH_USED_TOPIC);
});

// ------------------------------------------------------------------ reading: ranges, resume, what is money in
const dir1 = tmp('mare-books-'), f1 = join(dir1, 'sea.ndjson');
let disk1 = diskKv(f1, { everyMs: 1e9 }); await disk1.ready;
await recordsFor(disk1);
setNow('2026-11-23T01:40:00.000Z');
let books1 = B.createBooks({ kv: disk1, ledger, ...OPTS });
const r1 = await books1.pass();
const all1 = await books1.entries();
await proof('the first pass finds where to start by the chain\'s own times (an hour before 23.11.2026) and reads to 60 blocks behind the head', async () => {
  const st = await books1.sync();
  const want = Math.ceil((D.parse('2026-11-23T00:00:00Z') / 1000 - 3600 - G) / 2);
  assert.equal(st.start_block, want); assert.equal(st.safe_head, chain.head - 60); assert.equal(st.next_block, chain.head - 60 + 1); assert.equal(st.behind_blocks, 0);
  assert.equal(r1.found, 8); assert.ok(!r1.error, r1.error);
});
await proof('a range the RPC finds too large is halved; every block from the start to the safe head is read once, in ranges of at most 500', () => {
  const ranges = chain.asked.filter((b) => b.method === 'eth_getLogs' && b.params[0].topics[0] === B.TRANSFER_TOPIC).map((b) => [num(b.params[0].fromBlock), num(b.params[0].toBlock)]);
  const okRanges = ranges.filter(([a, z]) => z - a + 1 <= chain.maxRange);
  assert.ok(ranges.length > okRanges.length, 'a range too large was asked first and narrowed');
  let next = Math.ceil((D.parse('2026-11-23T00:00:00Z') / 1000 - 3600 - G) / 2);
  for (const [a, z] of okRanges) { assert.equal(a, next, 'no block left out, none read twice'); next = z + 1; }
  assert.equal(next, chain.head - 60 + 1);
});
await proof('only money in is booked: a removed log, a zero transfer, another token and another wallet are left out; amounts exact (BigInt) with their USD string', () => {
  const ks = all1.map((e) => e.tx);
  for (const t of [TX('9'), TX('a'), TX('b'), TX('c')]) assert.ok(!ks.includes(t), `${t.slice(0, 6)} is not money in`);
  assert.equal(all1.length, 8);
  const big = all1.find((e) => e.tx === S.other.tx); assert.equal(big.value, '12345678901234567'); assert.equal(big.usd, '12345678901.234567');
  const t = all1.find((e) => e.tx === S.till.tx); assert.equal(t.value, '20000'); assert.equal(t.usd, '0.020000'); assert.equal(t.from, S.till.from); assert.equal(t.to, WALLET); assert.equal(t.block, S.till.n); assert.equal(t.log, 4);
  assert.equal(B.usdOf(1n), '0.000001'); assert.equal(B.usdOf(50_000), '0.050000'); assert.equal(B.usdOf(1_234_567), '1.234567');
});
await proof('the time of each entry is its block\'s, from the chain (eth_getBlockByNumber, or the log\'s blockTimestamp where the RPC gives one)', async () => {
  for (const e of all1) assert.equal(e.time, iso(e.block));
  const kv = memoryKv(), was = chain.stamps; chain.stamps = true; const before = chain.asked.length;
  const b = B.createBooks({ kv, ...OPTS, fromBlock: 41_990 }); await b.pass(); chain.stamps = was;
  const got = await b.entries(); assert.equal(got.length, 8); for (const e of got) assert.equal(e.time, iso(e.block));
  assert.ok(!chain.asked.slice(before).some((x) => x.method === 'eth_getBlockByNumber'), 'with blockTimestamp no block is asked for its time');
});
await proof('the labels: till, fair and toll by the transaction, toll by the signed transfer (wallet and nonce), best effort by wallet, amount and time, unmatched else', () => {
  const by = (x) => all1.find((e) => e.tx === x.tx);
  assert.deepEqual([by(S.till).door, by(S.till).match], ['till', 'tx']);
  assert.deepEqual([by(S.fair).door, by(S.fair).match, by(S.fair).ref], ['fair', 'tx', 'sfair1']);
  assert.deepEqual([by(S.toll).door, by(S.toll).match, by(S.toll).ref, by(S.toll).nonce], ['toll', 'authorization', 'tp1', S.toll.nonce]);
  assert.deepEqual([by(S.weak).door, by(S.weak).match], ['till', 'payer-amount-time']);
  assert.deepEqual([by(S.other).door, by(S.other).match, by(S.other).ref], ['unmatched', null, null]);
  assert.deepEqual([by(S.late).door], ['unmatched']);
  assert.ok(!by(S.toll).flag && !by(S.till).flag && !by(S.fair).flag);
});
await proof('the flags: a toll payment released for lack of the chain\'s word whose transfer is on chain; a sale booked unsettled whose money arrived', () => {
  const r = all1.find((e) => e.tx === S.released.tx), u = all1.find((e) => e.tx === S.unsettled.tx);
  assert.equal(r.door, 'toll'); assert.equal(r.match, 'authorization'); assert.equal(r.flag, 'toll-released-on-chain'); assert.match(r.why, /no answer for an hour/); assert.match(r.why, /t20261122bbbbbbbb,t20261122cccccccc/); assert.match(r.why, /nothing was done on the customer's side/);
  assert.equal(u.door, 'till'); assert.equal(u.flag, 'unsettled-on-chain');
});
await proof('every entry and the cursor are on the disk at once (the copy not yet made): the .now file holds them, under books:* only', () => {
  const now = linesOf(`${f1}.now`), names = new Set(now.map(([k]) => k));
  assert.ok(names.has(`books:s:${WALLET}`) && names.has('books:days'));
  const days = [...names].filter((k) => k.startsWith('books:d:')); assert.ok(days.length >= 1);
  const last = new Map(now.map(([k, , v]) => [k, v])); assert.equal([...days].reduce((s, k) => s + last.get(k).length, 0), 8);
  for (const k of names) if (k.startsWith('books:')) { assert.match(k, B.BOOKS_KEY); assert.ok(!KEPT.test(k), `${k} is never one the database keeps`); }
});

// ------------------------------------------------------------------ a restart: from the cursor, nothing twice; a late record labels later
await proof('after a restart (the copy on disk never made) the books resume from the cursor: forward from it without a gap, behind it only the last 1,800 blocks once more, nothing counted twice', async () => {
  const before = await books1.sync();
  const disk2 = diskKv(f1, { everyMs: 1e9 }); await disk2.ready;
  put(45_990, { from: A('5'), value: 30_000, tx: TX('d') });
  chain.head = 46_200; setNow('2026-11-23T01:47:00.000Z');
  const mark = chain.asked.length, b2 = B.createBooks({ kv: disk2, ledger, ...OPTS });
  const r = await b2.pass(); assert.ok(!r.error, r.error);
  const asked = chain.asked.slice(mark).filter((b) => b.method === 'eth_getLogs' && b.params[0].topics[0] === B.TRANSFER_TOPIC);
  const fwd = asked.filter((b) => num(b.params[0].fromBlock) >= before.next_block), behind = asked.filter((b) => num(b.params[0].toBlock) < before.next_block);
  assert.equal(fwd.length + behind.length, asked.length, 'every range is either forward from the cursor or behind it');
  assert.ok(fwd.length >= 1 && behind.length >= 1, 'forward, and the last hour once more');
  let next = before.next_block; for (const b of fwd) { const a0 = num(b.params[0].fromBlock), z0 = num(b.params[0].toBlock); if (z0 - a0 + 1 > chain.maxRange) continue; assert.equal(a0, next, 'forward without a gap from the cursor'); next = z0 + 1; }
  assert.equal(next, 46_200 - 60 + 1);
  for (const b of behind) assert.ok(num(b.params[0].fromBlock) >= before.next_block - 1800, 'once more only inside the last 1,800 blocks');
  const got = await b2.entries(); assert.equal(got.length, 9); assert.equal(new Set(got.map((e) => `${e.tx}:${e.log}`)).size, 9);
  const st = await b2.sync(); assert.equal(st.next_block, 46_200 - 60 + 1);
  disk1 = disk2; books1 = b2;
});
await proof('an entry still unmatched is labelled when the door\'s record comes later (the till\'s settlement came back with its transaction)', async () => {
  sale({ q: 'route', amount_cents: 2, status: 'settled', tx: S.late.tx, payer: S.late.from, method: 'x402-v1' }, '2026-11-23T01:47:30.000Z');
  setNow('2026-11-23T01:48:00.000Z'); await books1.pass();
  const e = (await books1.entries()).find((x) => x.tx === S.late.tx); assert.equal(e.door, 'till'); assert.equal(e.match, 'tx'); assert.ok(e.labelled);
});
await proof('a best-effort label the till\'s record later contradicts (its settlement names another transaction) is taken back, and that transaction takes it', async () => {
  const kv = memoryKv(), led = createLedger({}), X = A('6');
  put(46_150, { from: X, value: 20_000, tx: TX('0') }); put(46_160, { from: X, value: 20_000, tx: TX('e') }); chain.head = 46_300;
  setNow(new D((timeOf(46_150) - 10) * 1000).toISOString()); const s1 = led.sale({ q: 'route', amount_cents: 2, status: 'pending', payer: X, method: 'x402-v2' });
  setNow('2026-11-23T01:48:00.000Z'); const b = B.createBooks({ kv, ledger: led, ...OPTS, fromBlock: 46_100 }); const r0 = await b.pass(); assert.ok(!r0.error, r0.error);
  let got = await b.entries(); const one = (t) => got.find((e) => e.tx === t);
  assert.deepEqual([one(TX('0')).door, one(TX('0')).match, one(TX('0')).ref], ['till', 'payer-amount-time', s1.id]); assert.equal(one(TX('e')).door, 'unmatched', 'the sale is taken by the first');
  led.saleSet(s1.id, { status: 'settled', tx: TX('e') }); later(60); await b.pass(); got = await b.entries();
  assert.deepEqual([one(TX('e')).door, one(TX('e')).match, one(TX('e')).ref], ['till', 'tx', s1.id]); assert.deepEqual([one(TX('0')).door, one(TX('0')).ref], ['unmatched', null]);
  chain.logs = chain.logs.filter((l) => ![TX('0'), TX('e')].includes(l.transactionHash)); setNow('2026-11-23T01:48:00.000Z');
});
await proof('K3: an RPC backend that has not indexed the newest blocks answers an empty list and the cursor moves on; the next pass reads the last hour once more and books the transfer exactly once', async () => {
  const kv = memoryKv(), H0 = chain.head;
  put(46_330, { from: A('2'), value: 40_000, tx: TX('0') }); chain.head = 46_400; chain.lagUntil = 46_300;
  try {
    const b = B.createBooks({ kv, ...OPTS, fromBlock: 46_250 });
    const r1 = await b.pass(); assert.ok(!r1.error, r1.error); assert.equal((await b.entries()).length, 0, 'the lagging backend answered an empty list'); assert.equal((await b.sync()).next_block, 46_341, 'and the cursor moved past the block');
    chain.lagUntil = null; chain.head = 46_420; later(60); await b.pass(); later(60); await b.pass(); later(60); await b.pass();
    const got = (await b.entries()).filter((e) => e.tx === TX('0')); assert.equal(got.length, 1, 'booked exactly once'); assert.equal(got[0].block, 46_330); assert.equal(got[0].value, '40000');
    assert.equal((await b.sync()).next_block, 46_420 - 60 + 1);
  } finally { chain.lagUntil = null; chain.logs = chain.logs.filter((l) => l.transactionHash !== TX('0')); chain.head = H0; setNow('2026-11-23T01:48:00.000Z'); }
});
await proof('a backend more than an hour behind: from 06:00 UTC of the next day the whole previous UTC day is read once more (bounded to its own blocks, a few ranges a pass) and the transfer is booked exactly once', async () => {
  const kv = memoryKv(), H0 = chain.head, mark = chain.asked.length;
  put(46_330, { from: A('2'), value: 40_000, tx: TX('e') }); chain.head = 46_400; chain.lagUntil = 46_300; setNow('2026-11-23T02:00:00.000Z');
  try {
    const b = B.createBooks({ kv, ...OPTS, fromBlock: 46_250, again: 50 });
    await b.pass(); chain.head = 46_500; later(60); await b.pass(); // still behind: the last 50 blocks once more do not reach back to it
    chain.lagUntil = null; chain.head = 46_600; later(60); await b.pass();
    assert.equal((await b.entries()).filter((e) => e.tx === TX('e')).length, 0, 'the window behind the cursor does not reach back that far');
    chain.head = 86_700; setNow('2026-11-24T05:59:00.000Z'); await b.pass(); await b.pass();
    assert.equal((await kv.get(`books:s:${WALLET}`)).redone, undefined, 'not before 06:00 UTC');
    setNow('2026-11-24T06:30:00.000Z'); let st = null;
    for (let i = 0; i < 80 && st?.redone !== '2026-11-23'; i++) { await b.pass(); st = await kv.get(`books:s:${WALLET}`); later(60); }
    assert.equal(st.redone, '2026-11-23'); assert.equal(st.redo, null);
    const got = (await b.entries()).filter((e) => e.tx === TX('e')); assert.equal(got.length, 1, 'booked exactly once');
    const day = chain.asked.slice(mark).filter((x) => x.method === 'eth_getLogs' && x.params[0].topics[0] === B.TRANSFER_TOPIC).map((x) => [num(x.params[0].fromBlock), num(x.params[0].toBlock)]);
    assert.ok(day.every(([a0, z0]) => a0 >= 46_250), 'never before the start');
    const n0 = (await b.entries()).length; later(3600); await b.pass(); assert.equal((await b.entries()).length, n0, 'once a day: nothing more, nothing twice');
  } finally { chain.lagUntil = null; chain.logs = chain.logs.filter((l) => l.transactionHash !== TX('e')); chain.head = H0; setNow('2026-11-23T01:48:00.000Z'); }
});
await proof('a flag stays when the toll\'s books let the payment go (3 days later), and the books keep the entry', async () => {
  const tb = await disk1.get('toll:books'); assert.ok(tb?.pays?.length, 'the toll\'s books came through the restart'); tb.pays = []; disk1.setNow('toll:books', tb, 4000 * 86400);
  later(4 * 86400); await books1.pass();
  const e = (await books1.entries()).find((x) => x.tx === S.released.tx); assert.equal(e.flag, 'toll-released-on-chain'); assert.equal(e.door, 'toll');
  setNow('2026-11-23T01:48:00.000Z');
});
await proof('a write that fails never moves the cursor: the range is read again and nothing is lost or doubled', async () => {
  const kv = memoryKv(); let fail = true;
  const flaky = { get: (k) => kv.get(k), set: (k, v, t) => kv.set(k, v, t), setNow: (k, v, t) => { if (fail && k.startsWith('books:d:')) return false; kv.set(k, v, t); return true; } };
  const b = B.createBooks({ kv: flaky, ...OPTS, fromBlock: 41_990 });
  const r = await b.pass(); assert.ok(r.error, 'the pass says it failed'); assert.equal((await b.sync()).next_block, 41_990, 'the cursor did not move');
  fail = false; later(31); const r2 = await b.pass(); assert.ok(!r2.error, r2.error);
  assert.equal((await b.entries()).length, 9);
  // the entries written, the cursor not: the range is read again, and what is there already is not counted twice
  const kv2 = memoryKv(); let failState = true;
  const flaky2 = { get: (k) => kv2.get(k), set: (k, v, t) => kv2.set(k, v, t), setNow: (k, v, t) => { if (failState && k.startsWith('books:s:') && v?.next > 41_990) return false; kv2.set(k, v, t); return true; } };
  const b2 = B.createBooks({ kv: flaky2, ...OPTS, fromBlock: 41_990 });
  const r3 = await b2.pass(); assert.ok(r3.error); assert.ok((await b2.entries()).length >= 1, 'the first range\'s entries were written'); assert.equal((await b2.sync()).next_block, 41_990);
  failState = false; later(31); const r4 = await b2.pass(); assert.ok(!r4.error, r4.error);
  const got = await b2.entries(); assert.equal(got.length, 9); assert.equal(new Set(got.map((e) => e.k)).size, 9);
  setNow('2026-11-23T01:48:00.000Z');
});
await proof('the cursor goes to the disk after every range: a node that dies in the middle of a pass resumes behind the last range it wrote', async () => {
  const f = join(tmp('mare-books-crash-'), 'sea.ndjson'), kv = diskKv(f, { everyMs: 1e9 }); await kv.ready;
  const b = B.createBooks({ kv, ...OPTS, fromBlock: 41_990, rpcMs: 60_000 });
  chain.hangFrom = 42_550; chain.hanging = false; const alive = setInterval(() => {}, 50); const p = b.pass();
  try {
    for (let i = 0; i < 400 && !chain.hanging; i++) await new Promise((r) => setTimeout(r, 5));
    assert.ok(chain.hanging, 'the chain hangs in the middle of the pass');
    const after = diskKv(f, { everyMs: 1e9 }); await after.ready; // what a node that starts now reads from the disk
    const st = await after.get(`books:s:${WALLET}`); assert.ok(st && st.next > 41_990, `the cursor moved: ${st?.next}`); assert.equal(st.next, chain.hungAt, 'the cursor is the first block of the range the node died in');
    let n = 0; for (const k of after.keys('books:d:')) n += (await after.get(k)).length;
    assert.equal(n, Object.values(S).filter((x) => x.n < chain.hungAt).length, 'every transfer before it is kept'); assert.ok(n >= 6);
  } finally { chain.hangFrom = null; chain.release?.(); await p.catch(() => {}); clearInterval(alive); }
});

// ------------------------------------------------------------------ a chain that does not answer: the pass waits, the doors do not
await proof('a chain that does not answer: the pass fails quietly, waits 30 s and then 60 s (doubled), keeps its cursor, and starts again where it stopped', async () => {
  const kv = memoryKv(), b = B.createBooks({ kv, ...OPTS, fromBlock: 41_990 });
  chain.down = true; const r = await b.pass(); chain.down = false;
  assert.ok(r.error); assert.equal(Date.parse(r.retryAt) - Date.now(), 30_000); const st = await b.sync(); assert.equal(st.errors_in_a_row, 1); assert.match(st.last_error.error, /ECONNREFUSED/); assert.equal(st.next_block, null, 'nothing read, no cursor');
  chain.down = true; const r2 = await b.pass(); chain.down = false; assert.equal(Date.parse(r2.retryAt) - Date.now(), 60_000);
  const r3 = await b.pass(); assert.ok(!r3.error); assert.equal((await b.sync()).errors_in_a_row, 0); assert.equal((await b.entries()).length, 9);
});
await proof('a rate limit is not a range too large: the pass waits (30 s) with the same range width and reads on afterwards', async () => {
  const kv = memoryKv(), b = B.createBooks({ kv, ...OPTS, fromBlock: 41_990, step: 400 });
  chain.limited = 1; const r = await b.pass(); assert.ok(r.error, 'the pass stopped'); assert.match(r.error, /rate limit/); assert.equal(b.state().step, 400, 'the width stayed'); assert.equal(Date.parse(r.retryAt) - Date.now(), 30_000);
  later(31); const r2 = await b.pass(); assert.ok(!r2.error, r2.error); assert.equal((await b.entries()).length, 9);
  setNow('2026-11-23T01:48:00.000Z');
});
await proof('read only: the books ask the chain eth_blockNumber, eth_getLogs and eth_getBlockByNumber and nothing else, and the code holds no other method, no key, no signature', () => {
  const methods = new Set(chain.asked.map((b) => b.method)); for (const m of methods) assert.ok(B.BOOKS_METHODS.includes(m), m);
  assert.deepEqual([...B.BOOKS_METHODS].sort(), ['eth_blockNumber', 'eth_getBlockByNumber', 'eth_getLogs']);
  const src = readFileSync(join(ROOT, 'node/books.mjs'), 'utf8');
  for (const bad of [/eth_send/, /eth_sign/, /personal_/, /signTypedData/, /privateKey/i, /mnemonic/i, /seed phrase/i, /eth_call/, /wallet_/]) assert.ok(!bad.test(src), `books.mjs holds ${bad}`);
});

// ------------------------------------------------------------------ never the database; retention
await proof('never in the database: through the long memory (node/durable.mjs) with a store that records every write, no name of the books reaches it', async () => {
  const sent = [], store = { get: async () => ({}), put: async (items) => { sent.push(...items.map((x) => x.k)); return items.length; } };
  const kv = durableKv(diskKv(join(tmp('mare-books-db-'), 'sea.ndjson'), { everyMs: 1e9 }), store, {});
  const b = B.createBooks({ kv, ...OPTS, fromBlock: 41_990 }); await b.pass(); await kv.settle?.();
  assert.equal((await b.entries()).length, 9); assert.ok(!sent.some((k) => k.startsWith('books:')), `sent: ${sent.join(',')}`);
});
await proof('kept ten years from the end of the payment\'s calendar year in German time, one day more, never less: on every day\'s entries in the copy on disk', async () => {
  assert.equal(B.BOOKS_RETAIN.years, 10); assert.match(B.BOOKS_RETAIN.basis, /§ 147 Abs\. 1 Nr\. 1, Abs\. 3 Satz 1, Abs\. 4 AO/);
  assert.equal(new D(B.keepUntilMs(D.parse('2026-11-23T10:00:00Z'))).toISOString(), '2037-01-02T00:00:00.000Z');
  assert.equal(new D(B.keepUntilMs(D.parse('2026-12-31T22:59:59Z'))).toISOString(), '2037-01-02T00:00:00.000Z');
  assert.equal(new D(B.keepUntilMs(D.parse('2026-12-31T23:30:00Z'))).toISOString(), '2038-01-02T00:00:00.000Z', 'half past midnight in Köln on 1 January is the next year');
  await disk1.save();
  const copy = linesOf(f1).filter(([k]) => k.startsWith('books:d:'));
  assert.ok(copy.length >= 1);
  for (const [k, e, v] of copy) { const want = Math.max(...v.map((x) => B.keepUntilMs(Date.parse(x.time)))); assert.equal(e, want, `${k} ends ${new D(e).toISOString()}`); }
});

// ------------------------------------------------------------------ the nodes: this tree and origin/main (the public answers)
const SITE = { '/llms.txt': { body: readFileSync(join(ROOT, 'site/llms.txt'), 'utf8'), type: 'text/plain; charset=utf-8' } };
const KEY = `books-proof operator key ${randomBytes(4).toString('hex')}`, KEY_SHA = createHash('sha256').update(KEY).digest('hex');
const waits = [];
async function nodeOf(rootDir, extra = {}) {
  const core = await imp(rootDir, 'core.mjs'), { createMem } = await imp(rootDir, 'mem.mjs'), mk = (await imp(rootDir, 'flow.mjs')).memoryKv;
  const { immune } = await imp(rootDir, 'immune.mjs'), led = (await imp(rootDir, 'ledger.mjs')).createLedger({}), { payConfig } = await imp(rootDir, 'pay.mjs');
  const d = tmp('mare-books-node-'), file = join(d, 'sea.tsv'); writeFileSync(file, ''); writeFileSync(join(d, 'build.json'), JSON.stringify({ builtAt: '2026-11-20T10:00:00.000Z', entries: 0, lakes: {} }));
  const db = createMem({ file, base: 'https://mare.test' }), kv = extra.kv || mk();
  const cfg = { base: 'https://mare.test', kv, ledger: led, pay: { ...payConfig({}), facilitator: FAC, settleWaitMs: 200, verifyMs: 500, settleMs: 2000 }, site: SITE, waitUntil: (p) => { waits.push(p); }, tollSweepMs: 0, modKeySha: KEY_SHA, mail: { on: false },
    booksOptions: { pauseMs: 0, everyMs: 1e9, catchUpMs: 1e9, probe: false, burst: 100, fromBlock: 41_990, rpcMs: 400 }, ...extra.cfg };
  const call = async (path, { method = 'GET', accept = 'application/json', ua = 'books-proof/1.0', ip = '198.51.100.7', headers = {}, body } = {}) => {
    const h = { accept, 'user-agent': ua, 'x-forwarded-for': ip, ...headers };
    const res = await core.handle(new Request(`https://mare.test${path}`, { method, headers: h, ...(body !== undefined ? { body } : {}) }), db, cfg);
    const text = res.body ? Buffer.from(await res.arrayBuffer()).toString('utf8') : ''; let j = null; try { j = JSON.parse(text); } catch {}
    return { status: res.status, headers: res.headers, text, j };
  };
  const rpc = (door, method, params) => call(door, { method: 'POST', accept: 'application/json, text/event-stream', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, ...(params ? { params } : {}) }) });
  immune.set({ mode: 'normal', rest: [], pace: { perMinute: 1_000_000, burst: 1_000_000 } });
  return { core, db, cfg, kv, ledger: led, call, rpc, rootDir, version: core.VERSION };
}
const REF = process.env.MARE_BOOKS_REF || '2d6ca74e2efa6560fa1ade46ba9713e02a8afcab';
const refDir = (() => {
  const given = process.env.MARE_BOOKS_REF_DIR; if (given && existsSync(join(given, 'node/core.mjs'))) return given;
  const d = mkdtempSync(join(tmpdir(), 'mare-books-ref-'));
  const r = spawnSync('sh', ['-c', 'git -C "$1" archive "$2" | tar -x -C "$3"', 'sh', ROOT, REF, d], { encoding: 'utf8' });
  return r.status === 0 && existsSync(join(d, 'node/core.mjs')) ? d : null;
})();
setNow('2026-11-23T02:00:00.000Z');
const ON = await nodeOf(ROOT);
let THEIRS = null;

await proof('the operator\'s doors answer 403 without the operator key and with a wrong one, and nothing of the books in it', async () => {
  for (const p of ['/operator/ledger.csv', '/operator/ledger.json', '/operator/digest', '/operator/digest?days=30', '/operator/ledger.csv?from=2026-11-01']) {
    for (const h of [{}, { 'x-mare-mod': 'wrong key' }, { 'x-mare-mod': KEY.slice(0, -1) }]) {
      const r = await ON.call(p, { headers: h }); assert.equal(r.status, 403, `${p}`); assert.equal(r.j?.error?.code, 'PERMISSION_DENIED'); assert.equal(r.headers.get('cache-control'), 'no-store'); assert.ok(!/0x[0-9a-f]{40}/i.test(r.text));
    }
  }
});
// the node's books, read from the chain as a node on a server does (startBooks in serve.mjs), into the node's own kv
await recordsFor(ON.kv); for (const s of ledger.mem.sales) ON.ledger.mem.sales.push(structuredClone(s));
setNow('2026-11-23T02:00:00.000Z');
const first = await ON.core.startBooks(ON.db, ON.cfg);
await proof('with the key: /operator/ledger.csv is the books as CSV (exact amounts, door, match, flag), /operator/ledger.json the same with the totals, both no-store and noindex', async () => {
  assert.ok(!first?.error, first?.error);
  const c = await ON.call('/operator/ledger.csv', { headers: { 'x-mare-mod': KEY } });
  assert.equal(c.status, 200); assert.equal(c.headers.get('content-type'), 'text/csv; charset=utf-8'); assert.equal(c.headers.get('cache-control'), 'no-store'); assert.equal(c.headers.get('x-robots-tag'), 'noindex'); assert.match(c.headers.get('content-disposition'), /^attachment; filename="mare-ledger-start-today\.csv"$/);
  const rows = c.text.trimEnd().split('\r\n'); assert.equal(rows[0], B.CSV_HEAD.join(',')); assert.equal(rows.length, 1 + 9);
  const row = rows.find((r) => r.includes(S.other.tx)).split(','); assert.equal(row[8], '12345678901234567'); assert.equal(row[9], '12345678901.234567'); assert.equal(row[10], 'unmatched');
  assert.ok(rows.some((r) => r.includes(S.released.tx) && r.includes(',toll-released-on-chain,')));
  const j = await ON.call('/operator/ledger.json', { headers: { 'x-mare-mod': KEY } });
  assert.equal(j.status, 200); assert.equal(j.j.entries.length, 9); assert.equal(j.j.wallet, WALLET); assert.equal(j.j.retention.years, 10); assert.equal(j.j.totals.transfers, 9); assert.equal(j.j.totals.flagged, 2); assert.equal(j.j.totals.unmatched, 2);
  assert.equal(j.j.totals.amount_base_units, String(20_000n + 50_000n + 61_234n + 70_000n + 20_000n + 12_345_678_901_234_567n + 20_000n + 20_000n + 30_000n));
  const day = await ON.call(`/operator/ledger.json?from=${iso(S.till.n).slice(0, 10)}&to=${iso(S.till.n).slice(0, 10)}`, { headers: { 'x-mare-mod': KEY } }); assert.ok(day.j.entries.length >= 1 && day.j.entries.every((e) => e.time.startsWith(iso(S.till.n).slice(0, 10))));
  assert.equal(B.ledgerCsv([{ time: '2026-11-23T00:00:00.000Z', block: 1, tx: '=HYPERLINK("x")', log: 0, from: '+1', to: '-1', value: '1', usd: '0.000001', door: '@x', match: null, ref: null, flag: null, why: 'a, "b"' }]).split('\r\n')[1],
    `2026-11-23,2026-11-23T00:00:00.000Z,1,"'=HYPERLINK(""x"")",0,'+1,'-1,USDC,1,0.000001,'@x,,,,"a, ""b"""`);
});
await proof('the doors answer while the chain hangs: no request waits for a pass', async () => {
  const alive = setInterval(() => {}, 50); // (the timers of AbortSignal.timeout keep no process alive; a server does)
  chain.hang = true; let ended = false; const p = ON.db.chainBooks.pass().finally(() => { ended = true; });
  try {
    const [a, b, c] = await Promise.all([ON.call('/status.json'), ON.call('/operator/ledger.json', { headers: { 'x-mare-mod': KEY } }), ON.call('/operator/digest', { headers: { 'x-mare-mod': KEY } })]);
    assert.equal(ended, false, 'the doors answered while the pass still waited for the chain'); assert.equal(a.status, 200); assert.equal(b.status, 200); assert.equal(c.status, 200); assert.ok(a.j.counts, 'with its counts');
    const r = await p; assert.ok(r.error, 'the pass gave up on the hanging chain');
  } finally { await p.catch(() => {}); chain.hang = false; clearInterval(alive); }
  later(3600); await ON.db.chainBooks.pass(); setNow('2026-11-23T02:00:00.000Z');
});

// ------------------------------------------------------------------ the digest: exact numbers per day
await proof('the digest: per day, declarations (through the real button), toll accounts and payments, till sales, fair share, the books, the payment path and the facilitator, exactly', async () => {
  setNow('2026-11-23T09:00:00.000Z'); const d0 = '2026-11-23';
  // two declarations through the real buttons (mail off: no receipt yet), one of them later confirmed by mail
  const form = (o) => new URLSearchParams(o).toString(), H = { 'content-type': 'application/x-www-form-urlencoded', origin: 'https://mare.test' };
  const w = await ON.call('/de/vertrag-widerrufen', { method: 'POST', headers: H, body: form({ name: 'Erika Muster', contract: 'Bericht 17', email: 'erika@example.org' }), ip: '198.51.100.61' }); assert.equal(w.status, 200);
  const k = await ON.call('/cancel-contracts', { method: 'POST', headers: H, body: form({ type: 'ordinary', name: 'Max Muster', contract: 'Team harbour h-1', email: 'max@example.org', when: 'earliest' }), ip: '198.51.100.62' }); assert.equal(k.status, 200);
  const kid = k.headers.get('x-declaration-id'), kx = await ON.kv.get(`legal:decl:${kid}`); await ON.kv.set(`legal:decl:${kid}`, { ...kx, mail: { state: 'sent', at: '2026-11-23T09:01:00.000Z' } }, 86400);
  // the toll: two networks' accounts of the day (as node/toll.mjs packs them), one payment settled, one on its way, one released
  await ON.kv.set(`toll:n:${d0}:aaaaaaaaaaaaaaaaaaaaaaaa`, { v: 2, d: d0, s: 100_000, t: 300_000, m: 120_000, pt: 0, pm: 0, h: [], n: 7, x: 2, id: 't20261123aaaaaaaa' }, 86400);
  await ON.kv.set(`toll:n:${d0}:bbbbbbbbbbbbbbbbbbbbbbbb`, { v: 2, d: d0, s: 100_000, t: 150_000, m: 60_000, pt: 150_000, pm: 60_000, h: [], n: 3, x: 0, id: 't20261123bbbbbbbb' }, 86400);
  await ON.kv.set(`toll:n:2026-11-22:cccccccccccccccccccccccc`, { v: 2, d: '2026-11-22', s: 1, t: 1, m: 0, pt: 0, pm: 0, h: [], n: 99, x: 0 }, 86400);
  await ON.kv.set('toll:books', { v: 1, total: { micro: 60_000, n: 1 }, days: { [d0]: { micro: 60_000, n: 1 } }, pays: [
    { id: 'tq1', at: `${d0}T08:59:00.000Z`, status: 'pending', micro: 120_000, ids: [], from: A('1'), nonce: NONCE('5') },
    { id: 'tq2', at: `${d0}T07:00:00.000Z`, status: 'released', end: `${d0}T08:05:00.000Z`, micro: 55_000, ids: [], from: A('2'), nonce: NONCE('6'), why: 'no chain check is possible on this node: released after its time' },
    { id: 'tq3', at: `${d0}T06:00:00.000Z`, status: 'settled', end: `${d0}T06:00:05.000Z`, micro: 60_000, ids: [], from: A('3'), nonce: NONCE('7'), tx: TX('e') } ] }, 4000 * 86400);
  // the till: three sales of the day (a settled one, one on its way, a free sample that is no sale); fair share: two payments
  ON.ledger.sale({ q: 'a', amount_cents: 2, status: 'settled', tx: TX('f'), payer: A('4') }); ON.ledger.sale({ q: 'b', amount_cents: 3, status: 'pending', payer: A('4') }); ON.ledger.sale({ q: 'c', amount_cents: 0, status: 'free_sample' });
  await ON.kv.set('fair:pay', [{ sale: 'sf1', ids: ['r1'], micro: 50_000, status: 'settled', at: `${d0}T08:00:00.000Z`, tx: TX('1') }, { sale: 'sf2', ids: ['r2'], micro: 70_000, status: 'pending', at: `${d0}T08:30:00.000Z` }], 400 * 86400);
  // the facilitator: one verify that answers, one settle without an answer, one settle that says no
  const t = { v1: {}, v2: {} }, pay = { version: 2, payload: {} }, cfg = { facilitator: FAC };
  await PAY.facilitate(cfg, 'verify', pay, t, 500); fac.down = true; await PAY.facilitate(cfg, 'settle', pay, t, 500).catch(() => null); fac.down = false;
  const was = fac.settle; fac.settle = () => answer({ success: false, errorReason: 'insufficient_funds' }); await PAY.facilitate(cfg, 'settle', pay, t, 500); fac.settle = was;
  // the chain: one pass that fails today
  chain.down = true; await ON.db.chainBooks.pass(); chain.down = false;
  const r = await ON.call('/operator/digest?days=3', { headers: { 'x-mare-mod': KEY } }); assert.equal(r.status, 200);
  const g = r.j, today = g.days[0]; assert.deepEqual(g.days.map((x) => x.day), ['2026-11-23', '2026-11-22', '2026-11-21']);
  assert.deepEqual(today.declarations, { withdrawals: 1, cancellations: 1, receipt_sent: 1, open_without_receipt: 1 });
  assert.deepEqual(today.toll, { networks: 2, tolled_answers: 10, normal_answers_while_due: 2, tokens_tolled: 450_000, tolled_usd: '0.180000', settled: { payments: 1, usd: '0.060000' }, on_its_way: { payments: 1, usd: '0.120000' }, released: { payments: 1, usd: '0.055000' } });
  assert.equal(g.days[1].toll.tolled_answers, 99);
  assert.deepEqual(today.till, { sales: 3, by_status: { settled: 2, pending: 1 }, settled_usd: '0.04', unconfirmed_usd: '0.03' }, 'the late sale of 01:47 and two of the day; the free sample is no sale');
  assert.deepEqual(today.fair, { payments: 2, by_status: { settled: 1, pending: 1 }, settled_usd: '0.050000', unconfirmed_usd: '0.070000' });
  assert.deepEqual(today.ledger, { transfers: 1, usd: '0.030000', by_door: { unmatched: { transfers: 1, usd: '0.030000' } }, unmatched: 1, flagged: 0 });
  const y = g.days[1].ledger; assert.equal(y.transfers, 8); assert.equal(y.flagged, 2); assert.equal(y.unmatched, 1); assert.equal(y.by_door.toll.transfers, 2); assert.equal(y.by_door.till.transfers, 4); assert.equal(y.by_door.fair.usd, '0.050000');
  assert.deepEqual(today.errors, { facilitator_no_answer: 1, facilitator_down: 0, facilitator_no_verdict: 0, settlement_failed: 1, chain_reads_failed: 2 }, 'the chain: the hanging pass of 02:00 and the one here');
  assert.deepEqual(today.facilitator, { reached: 2, missed: 1, payments_refused: 0 });
  assert.equal(g.now.books.errors_in_a_row, 1); assert.ok(!/@example\.org|Erika|Max Muster/.test(r.text), 'the digest names no person');
});
await proof('the counts of the payment path survive: folded into the node\'s state once a pass, and a node that starts again still shows them', async () => {
  const before = (await ON.call('/operator/digest?days=1', { headers: { 'x-mare-mod': KEY } })).j.days[0].errors;
  await ON.db.chainBooks.pass(); assert.deepEqual(PAY.payWatch.peek(), {}, 'the facilitator\'s counts were taken into the state');
  const tally = await ON.kv.get('books:t:2026-11-23'); assert.equal(tally.settle_failed, 1); assert.equal(tally.settle_error, 1); assert.ok(tally.chain_errors >= 1);
  const again = B.createBooks({ kv: ON.kv, ...OPTS, rpc: null }), d = await again.digest({ days: 1 });
  assert.deepEqual(d.days[0].errors, before);
});
await proof('the facilitator is asked whether it is there only when no payment asked it for 15 minutes (GET /supported), and the answer counts as reached', async () => {
  const kv = memoryKv(), b = B.createBooks({ kv, ...OPTS, facilitator: FAC, probe: true, fromBlock: 46_100 });
  fac.probes = 0; await b.pass(); assert.equal(fac.probes, 0, 'a payment asked it a moment ago');
  later(16 * 60); await b.pass(); assert.equal(fac.probes, 1); later(60); await b.pass(); assert.equal(fac.probes, 1, 'not again within 15 minutes');
  const d = await b.digest({ days: 1 }); assert.ok(d.days[0].facilitator.reached >= 1);
  fac.down = true; later(16 * 60); await b.pass(); fac.down = false; const d2 = await b.digest({ days: 1 }); assert.ok(d2.days[0].facilitator.missed >= 1);
  setNow('2026-11-23T09:00:00.000Z');
});

// ------------------------------------------------------------------ /status.json: counts and nothing else; every other answer as on origin/main
// (a twin of this tree and origin/main, fresh, asked the very same things in the same order: the census counts every request;
// the twin holds the books of ON, every name books:* copied)
const MINE = await nodeOf(ROOT); for (const k of ON.kv.keys('books:')) await MINE.kv.set(k, await ON.kv.get(k), 86400);
THEIRS = refDir ? await nodeOf(refDir) : null;
console.log(`nodes: this tree ${MINE.version}, ${REF.slice(0, 7)} ${THEIRS?.version || 'NOT FOUND (no git tree): the comparisons with it fail'}`);
await proof('/status.json gains counts: numbers only (and the day), no address, no transaction, no sum; the rest of it as on origin/main', async () => {
  later(61); const ours = await ON.call('/status.json'); assert.equal(ours.status, 200);
  const c = ours.j.counts; assert.ok(c && typeof c === 'object');
  for (const [k, v] of Object.entries(c)) { if (k === 'day') { assert.match(v, /^\d{4}-\d{2}-\d{2}$/); continue; } assert.ok(v === null || Number.isInteger(v), `${k}: ${v}`); assert.ok(!/usd|wallet|payer|from|tx|address|sum|amount/i.test(k), k); }
  assert.ok(!/0x[0-9a-f]{8}/i.test(JSON.stringify(c)));
  assert.equal(c.ledger_transfers, 9); assert.equal(c.ledger_transfers_today, 1); assert.equal(c.ledger_flagged, 2); assert.equal(c.declarations_today, 2); assert.equal(c.declarations_without_receipt, 1); assert.equal(c.tolled_answers_today, 10);
  assert.ok(THEIRS, 'origin/main as a tree'); const [a, b] = [await MINE.call('/status.json'), await THEIRS.call('/status.json')];
  const { counts, ...rest } = a.j; assert.deepEqual({ ...rest, version: '<version>' }, { ...b.j, version: '<version>' }); assert.equal(b.j.counts, undefined); assert.equal(counts.ledger_transfers, 9, 'the books of the twin are there');
  assert.deepEqual(Object.keys(a.j), [...Object.keys(b.j), 'counts']); assert.equal(a.headers.get('cache-control'), b.headers.get('cache-control'));
});
const firstDiff = (x, y) => { let i = 0; while (i < x.length && x[i] === y[i]) i++; return `at ${i}: ${JSON.stringify(x.slice(Math.max(0, i - 120), i + 120))} <> ${JSON.stringify(y.slice(Math.max(0, i - 120), i + 120))}`; };
// (the moment each tree's modules were first loaded, runningSince of /open.json, is the only thing told apart: this tree's came first)
const since0 = (t) => t.replace(/"runningSince":"[^"]*"/g, '"runningSince":"<start>"');
// (and the version each tree names: a release bumps it, the answers stay the same)
const vers = (t, v) => (v ? t.replaceAll(v, '<version>') : t);
const sameText = (a, b, what) => { assert.equal(a.status, b.status, `${what}: status`); const x = vers(since0(a.text), MINE.version), y = vers(since0(b.text), THEIRS.version); assert.ok(x === y, `${what}: body ${x === y ? '' : firstDiff(x, y)}`); assert.deepEqual([...a.headers.entries()].sort(), [...b.headers.entries()].sort(), `${what}: headers`); };
await proof('/mcp/app byte for byte as on origin/main: initialize, tools/list and a tools/call', async () => {
  assert.ok(THEIRS, 'origin/main as a tree');
  for (const [m, p] of [['initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'books-proof', version: '1' } }], ['tools/list', null], ['tools/call', { name: 'think', arguments: { task: 'find a harbour pilot in Hamburg' } }]]) {
    sameText(await MINE.rpc('/mcp/app', m, p), await THEIRS.rpc('/mcp/app', m, p), `/mcp/app ${m}`);
  }
});
await proof('every other public answer as on origin/main (the pages, the data, /mcp tools/list, the operator\'s declarations door); the privacy notice apart only by its new sentences', async () => {
  assert.ok(THEIRS, 'origin/main as a tree');
  for (const p of ['/', '/llms.txt', '/status', '/transparency', '/treasury', '/pricing', '/terms', '/de/agb', '/de/preise', '/de/widerruf', '/engine', '/fair', '/open.json', '/job', '/operator/declarations', '/operator', '/operator/ledger']) {
    sameText(await MINE.call(p, { accept: p.endsWith('.json') ? 'application/json' : 'text/html' }), await THEIRS.call(p, { accept: p.endsWith('.json') ? 'application/json' : 'text/html' }), p);
  }
  sameText(await MINE.rpc('/mcp', 'tools/list'), await THEIRS.rpc('/mcp', 'tools/list'), '/mcp tools/list');
  const NEW = { '/de/datenschutz': [/\n<p>\(7\) Das Kassenbuch aus der Blockchain: [^<]*<\/p>/, /<tr><td>Kassenbuch aus der Blockchain[^\n]*<\/tr>\n/], '/privacy': [/\n<p>\(7\) The cash book from the blockchain: [^<]*<\/p>/, /<tr><td>Cash book from the blockchain[^\n]*<\/tr>\n/] };
  for (const [p, cut] of Object.entries(NEW)) {
    const a = await MINE.call(p, { accept: 'text/html' }), b = await THEIRS.call(p, { accept: 'text/html' });
    let t = a.text; for (const re of cut) { assert.ok(re.test(t), `${p}: ${re}`); t = t.replace(re, ''); }
    assert.equal(vers(t, MINE.version), vers(b.text, THEIRS.version), `${p}: only the new sentences differ`);
    const am = await MINE.call(`${p}.md`, { accept: 'text/markdown' }), bm = await THEIRS.call(`${p}.md`, { accept: 'text/markdown' }); assert.notEqual(am.text, bm.text); assert.ok(am.text.length > bm.text.length);
  }
});
await proof('the privacy notice says it, in German and in English: what is kept, the purpose, Art. 6 Abs. 1 lit. c DSGVO with § 147 AO, the period of BOOKS_RETAIN and that the addresses come from the public chain', async () => {
  const words = { 8: ['acht', 'eight'], 10: ['zehn', 'ten'] }[B.BOOKS_RETAIN.years]; assert.ok(words, 'a period the texts can say');
  const de = (await ON.call('/de/datenschutz', { accept: 'text/html' })).text, en = (await ON.call('/privacy', { accept: 'text/html' })).text;
  const pde = /<p>\(\d+\) (Das Kassenbuch aus der Blockchain: [^<]*)<\/p>/.exec(de)?.[1], pen = /<p>\(\d+\) (The cash book from the blockchain: [^<]*)<\/p>/.exec(en)?.[1];
  assert.ok(pde && pen);
  for (const w of ['Block, Zeitpunkt, Transaktion, zahlende Wallet, Betrag', 'stammen aus der Blockchain, wo sie ohnehin öffentlich stehen', 'nicht in der Datenbank und an keiner öffentlichen Stelle', 'gesetzliche Pflicht, die Einnahmen aufzuzeichnen', 'Rechtsgrundlage: Art. 6 Abs. 1 lit. c DSGVO in Verbindung mit § 147 AO', `${words[0]} Jahre ab dem Ende des Kalenderjahres der Zahlung aufbewahrt (§ 147 Abs. 1 Nr. 1, Abs. 3 und 4 AO) und danach gelöscht`]) assert.ok(pde.includes(w), `de: ${w}`);
  for (const w of ['block, time, transaction, paying wallet, amount', 'come from the blockchain, where they are public anyway', 'not in the database and in no public place', 'statutory duty to record income', 'Legal basis: Art. 6(1)(c) GDPR in conjunction with § 147 AO', `kept for ${words[1]} years from the end of the calendar year of the payment (§ 147(1) no. 1, (3) and (4) AO) and deleted afterwards`]) assert.ok(pen.includes(w), `en: ${w}`);
  assert.ok(de.includes(`<tr><td>Kassenbuch aus der Blockchain (Überweisungen an die Empfänger-Wallet)</td><td>${words[0]} Jahre ab dem Ende des Kalenderjahres der Zahlung</td></tr>`));
  assert.ok(en.includes(`<tr><td>Cash book from the blockchain (transfers to the receiving wallet)</td><td>${words[1]} years from the end of the calendar year of the payment</td></tr>`));
});
await proof('the switch: MARE_BOOKS=off or MARE_BASE_RPC=off and the books read nothing; serve.mjs starts them only with a copy on disk; proof:books in package.json', async () => {
  assert.equal(B.booksSwitch({}, { MARE_BOOKS: 'off' }), false); assert.equal(B.booksSwitch({}, {}), true); assert.equal(B.booksRpc({}, { MARE_BASE_RPC: 'off' }), null); assert.equal(B.booksRpc({}, {}), 'https://mainnet.base.org');
  assert.deepEqual(B.booksStart({ MARE_BOOKS_SINCE: '2026-01-01' }), { since: '2026-01-01', fromBlock: null }); assert.deepEqual(B.booksStart({ MARE_BOOKS_FROM_BLOCK: '123' }), { since: '2026-11-23', fromBlock: 123 }); assert.deepEqual(B.booksStart({}), { since: '2026-11-23', fromBlock: null });
  const mark = chain.asked.length, b = B.createBooks({ kv: memoryKv(), ...OPTS, rpc: null }); assert.deepEqual(await b.pass(), { off: true }); assert.equal(chain.asked.length, mark);
  const serve = readFileSync(join(ROOT, 'serve.mjs'), 'utf8'); assert.match(serve, /if \(disk\) \{ try \{ startBooks\(db, \{ kv, ledger, base \}\); \}/);
  assert.equal(JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).scripts['proof:books'], 'node tools/books-proof.mjs');
});

await Promise.allSettled(waits.splice(0));
console.log(`\n${passed} proofs held, ${failed} failed`);

// ------------------------------------------------------------------ negative controls: break one rule in a copy, the proof must fail there
const BREAK = [
  ['the cursor not written: a restart reads from the start again', 'node/books.mjs', "if (!(await put(KEYS.state(W), st, far()))) throw new Error('the state could not be written');\n        if (step < maxStep)", "if (step < maxStep)"],
  ['nothing kept at once (the cursor and the entries wait for the next copy)', 'node/books.mjs', "if (typeof kv.setNow === 'function') return kv.setNow(k, v, ttl) !== false; ", ''],
  ['an entry counted twice', 'node/books.mjs', 'if (have.has(e.k)) continue;', ''],
  ['a removed log booked', 'node/books.mjs', "if (!g || g.removed === true || lc(g.address)", "if (!g || lc(g.address)"],
  ['a zero transfer booked', 'node/books.mjs', 'if (value <= 0n) {', 'if (value < 0n) {'],
  ['another token booked (the RPC trusted)', 'node/books.mjs', "lc(g.address) !== T || ", ''],
  ['the amount as a floating point number', 'node/books.mjs', "value: value.toString(), usd: usdOf(value)", "value: String(Number(value)), usd: usdOf(value)"],
  ['a range too large not halved', 'node/books.mjs', "if (tooWide(e) && step > minStep) {", "if (false) {"],
  ['the time of the log\'s neighbour block', 'node/books.mjs', "e.time = iso((await blockTime(e.block, e.hint)) * 1000);", "e.time = iso((await blockTime(e.block + 1, e.hint)) * 1000);"],
  ['the signed transfer not matched (toll by nonce)', 'node/books.mjs', "if (e.nonce) { const r = recs.find((x) => x.door === 'toll'", "if (false) { const r = recs.find((x) => x.door === 'toll'"],
  ['no best effort by wallet, amount and time', 'node/books.mjs', "if (near.length && !near.some(", "if (false && !near.some("],
  ['a released toll payment on chain not flagged', 'node/books.mjs', "const r = mine.find((x) => x.status === 'released'); if (r) return", "const r = mine.find((x) => x.status === 'released'); if (false) return"],
  ['a flag taken back when the toll lets the payment go', 'node/books.mjs', "if (!e.flag) { const f = flagOf(e, recs);", "{ const f = flagOf(e, recs); if (!f && e.flag) { delete e.flag; changed = true; }"],
  ['a best-effort label kept when the record names another transaction', 'node/books.mjs', "if (e.match === 'payer-amount-time' && recs.some(", "if (false && recs.some("],
  ['K3 taken back: the last hour behind the cursor not read again', 'node/books.mjs', "if (again > 0 && st.next > st.start) {", "if (false) {"],
  ['the previous UTC day not read again', 'node/books.mjs', "if (st.next > safe && !stopped) { try { await dayAgain(recs, safe); }", "if (false) { try { await dayAgain(recs, safe); }"],
  ['the previous day read again before the start', 'node/books.mjs', "const a = Math.max(st.start, await firstBlockAt(t0, hi, st.start)),", "const a = Math.max(0, await firstBlockAt(t0, hi, 0)),"],
  ['no second look at an unmatched entry', 'node/books.mjs', "if (e.door === 'unmatched') { const l = labelOf(e, recs, taken);", "if (false) { const l = labelOf(e, recs, taken);"],
  ['the cursor moved past a range that was not written', 'node/books.mjs', "if (!(await keep(got, recs))) throw new Error('the books could not be written: the range is read again');", 'await keep(got, recs);'],
  ['a rate limit taken for a range too large (the RPC asked again at once)', 'node/books.mjs', "if (e?.status === 429 || /rate.?limit|too many requests|requests per/i.test(m)) return false;", ''],
  ['no wait after a failed pass', 'node/books.mjs', 'waitUntilMs = now() + Math.min(30 * 60_000, 30_000 * 2 ** Math.min(6, st.errors - 1));', 'waitUntilMs = now();'],
  ['eight years in the code, ten in the texts', 'node/books.mjs', "BOOKS_RETAIN = Object.freeze({ years: 10,", "BOOKS_RETAIN = Object.freeze({ years: 8,"],
  ['the year of the payment in UTC (one year too early at New Year)', 'node/books.mjs', 'export const bookYear = (ms) => { const y = BERLIN ? BERLIN(ms) : NaN;', 'export const bookYear = (ms) => { const y = new Date(ms).getUTCFullYear();'],
  ['the books under a name the database keeps', 'node/books.mjs', "const KEYS = { state: (w) => `books:s:${w}`, day: (d) => `books:d:${d}`,", "const KEYS = { state: (w) => `books:s:${w}`, day: (d) => `agent:books:d:${d}`,"],
  ['a method that writes to the chain allowed', 'node/books.mjs', "export const BOOKS_METHODS = Object.freeze(['eth_blockNumber', 'eth_getLogs', 'eth_getBlockByNumber']);", "export const BOOKS_METHODS = Object.freeze(['eth_blockNumber', 'eth_getLogs', 'eth_getBlockByNumber', 'eth_sendRawTransaction']);"],
  ['the operator key not asked on the books', 'node/books.mjs', "if (!operatorKeyOk(req, keySha || undefined)) return", "if (false) return"],
  ['the digest without the key', 'node/books.mjs', "if (!operatorKeyOk(req, keySha || undefined)) return new Response(JSON.stringify({ error: { code: 'PERMISSION_DENIED', message: 'operator key required (header x-mare-mod)' } }), { status: 403, headers: J });\n  if (path === '/operator/digest')", "if (path === '/operator/digest')"],
  ['status.json shows a sum', 'node/books.mjs', 'ledger_transfers: s.transfers, ledger_transfers_today', 'ledger_usd: s.amount_usd, ledger_transfers: s.transfers, ledger_transfers_today'],
  ['status.json shows the wallet', 'node/core.mjs', "counts: await booksOf(db, cfg).counts({ declKv: declKv(db, cfg) }).catch(() => null) }", "counts: await booksOf(db, cfg).counts({ declKv: declKv(db, cfg) }).catch(() => null), wallet: booksOf(db, cfg).wallet }"],
  ['the counts on the /status page too', 'node/core.mjs', "const st = { version: VERSION, at: new Date().toISOString(),", "const st = { books: 1, version: VERSION, at: new Date().toISOString(),"],
  ['a request waits for the pass', 'node/books.mjs', "if (cnt && now() - cntAt < 60_000) return cnt;", "if (running) await running; if (cnt && now() - cntAt < 60_000) return cnt;"],
  ['the declarations without receipt not counted', 'node/books.mjs', "if (full?.mail?.state === 'sent') o.receipt_sent++; else o.open_without_receipt++;", "if (full?.mail?.state === 'sent') o.receipt_sent++;"],
  ['the tolled answers not counted', 'node/books.mjs', 'o.networks++; o.tolled_answers += a.n || 0;', 'o.networks++;'],
  ['the facilitator\'s failures not counted', 'node/pay.mjs', "} catch (e) { payWatch.note(kind, 'error'); throw e; }", '} catch (e) { throw e; }'],
  ['the counts of the payment path not kept', 'node/books.mjs', "await put(KEYS.tally(d), cur, Date.parse(`${d}T00:00:00Z`) + TALLY_DAYS * DAYMS); }", '}'],
  ['the facilitator asked every pass', 'node/books.mjs', "if (!probe || !facilitator || now() - lastProbe < probeMs) return;", "if (!probe || !facilitator) return;"],
  ['the privacy notice without its legal basis', 'node/legal.mjs', ' Rechtsgrundlage: Art. 6 Abs. 1 lit. c DSGVO in Verbindung mit § 147 AO. Jeder Eintrag', ' Jeder Eintrag'],
  ['the privacy notice without the source of the addresses', 'node/legal.mjs', ' The wallet addresses and transactions come from the blockchain, where they are public anyway; we collect nothing from you for it.', ''],
  ['an answer of /mcp/app changed (a tool more on the app door)', 'node/core.mjs', "const APP_TOOLS = new Set(['think', 'rate_path',", "const APP_TOOLS = new Set(['think', 'find', 'rate_path',"],
];
let caught = 0;
if (CONTROLS) {
  console.log('\nnegative controls: each rule broken in a copy, the proof must fail there');
  for (const [what, f, from, to] of BREAK) {
    const t = mkdtempSync(join(tmpdir(), 'mare-books-ctl-'));
    try {
      for (const d of ['node', 'site', 'proof', 'config', 'public']) if (existsSync(join(ROOT, d))) cpSync(join(ROOT, d), join(t, d), { recursive: true });
      mkdirSync(join(t, 'tools'), { recursive: true }); cpSync(join(ROOT, 'tools/books-proof.mjs'), join(t, 'tools/books-proof.mjs'));
      for (const x of ['package.json', 'server.json', 'server-dev.json', 'server-lean.json', 'gemini-extension.json', 'serve.mjs']) cpSync(join(ROOT, x), join(t, x));
      const src = readFileSync(join(t, f), 'utf8');
      if (!src.includes(from)) { console.log(`  FAIL control "${what}": the line to break is gone from ${f}; the control needs updating`); continue; }
      writeFileSync(join(t, f), src.replace(from, to));
      const run = spawnSync(process.execPath, ['tools/books-proof.mjs', '--no-controls'], { cwd: t, encoding: 'utf8', timeout: 600_000, env: { ...process.env, MARE_BOOKS_REF_DIR: refDir || '', MARE_BOOKS_FIRST_FAIL: '1' } });
      const held = /(\d+) proofs held, (\d+) failed/.exec(run.stdout || '');
      if (run.status !== 0 && held && Number(held[2]) > 0) { caught++; console.log(`  ok   caught: ${what} (${held[2]} ${held[2] === '1' ? 'proof' : 'proofs'} failed)`); }
      else console.log(`  FAIL not caught: ${what} (exit ${run.status}${held ? `, ${held[0]}` : ''}${run.stderr ? `; ${String(run.stderr).split('\n')[0].slice(0, 160)}` : ''})`);
    } finally { rmSync(t, { recursive: true, force: true }); }
  }
  console.log(`${caught} of ${BREAK.length} controls caught`);
}
if (refDir && !process.env.MARE_BOOKS_REF_DIR) rmSync(refDir, { recursive: true, force: true });
process.exit(failed || (CONTROLS && caught !== BREAK.length) ? 1 : 0);
