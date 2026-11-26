// Mare Liberum · the books from the chain (since 3.38, "Die Bücher aus der Kette")
// Every USDC transfer into the till's wallet on Base is the real record of money in: sales of the paid route, fair share,
// the harbour toll, and whatever else the wallet receives. The node's own records forget (the toll keeps a finished payment 3
// days, the till's copy of its sales lives in memory); the chain does not. So the node reads the chain and keeps its own
// permanent, private ledger of what arrived:
//   reading      USDC's Transfer logs to the wallet (eth_getLogs through MARE_BASE_RPC, default https://mainnet.base.org),
//                incrementally in small block ranges, from the last block read; a range the RPC finds too large is halved;
//                a pass that fails waits (30 s, doubled each time, at most 30 minutes) and starts again where it stopped.
//                A public RPC behind a load balancer can answer eth_getLogs from a node that has not indexed the newest blocks
//                yet (an empty list, no error). So every pass reads the last 1,800 blocks behind the cursor once more (an hour
//                at 2 s a block), and once a UTC day, from 06:00 UTC, the two UTC days before once more: every block of a day D
//                is read again at 06:00 UTC of D+1 and of D+2, so a backend less than 30 hours behind misses no block (one
//                further behind can miss the last hours of a day). A re-read never moves the forward reading's range width; a
//                day re-read that fails in 3 passes is given up and counted. What a re-read finds is booked, nothing twice.
//                (A reorg deeper than 60 blocks that changes a log index could book a transfer again; rare on Base.)
//                Only blocks 60 behind the head are read (two minutes: a block that could still change is not booked). It
//                runs on its own timer, behind everything: no request ever waits for it. Read only: it asks the chain
//                eth_blockNumber, eth_getLogs and eth_getBlockByNumber, and nothing else; it never signs, sends or holds
//   an entry     block, time (the block's), transaction, log index, the paying wallet, the amount in exact base units and as
//                a USD string (USDC has 6 decimals), and a best-effort label: which door it belongs to (till, fair, toll),
//                found by the transaction, by the signed transfer (the wallet and nonce of USDC's AuthorizationUsed in the
//                same transaction, against the toll's own books), or by the paying wallet, the exact amount and a time close
//                to a record no other line took; else "unmatched" (the wallet may receive other payments too). An entry
//                still unmatched is looked at again while the doors' records hold (3 days)
//   the flags    a payment the toll released (for lack of the chain's word, or after its time) whose transfer is on chain is
//                flagged toll-released-on-chain; a sale the till booked as not settled whose transfer is on chain is flagged
//                unsettled-on-chain. A flag is for the operator: nothing happens to the customer by itself
//   kept         in the node's own state (books:*; on a server the copy on disk, each new entry and the cursor written at once,
//                kv.setNow of node/disk.mjs), never in the database (no name of it is one node/durable.mjs keeps there) and on
//                no public door. Each day's entries are kept ten years from the end of the calendar year of the payment
//                (§ 147 Abs. 1 Nr. 1, Abs. 3 und 4 AO: the ledger is a record, an Aufzeichnung, of the money received; the
//                eight years of BEG IV since 01.01.2025 are for Buchungsbelege, Nr. 4), counted in German time and one day
//                more, never a day less; then the node lets them go by itself
//   the doors    GET /operator/ledger.csv and /operator/ledger.json (from=, to= as YYYY-MM-DD), GET /operator/digest (days=,
//                1 to 60): with the operator key only (header x-mare-mod, node/declare.mjs), 403 without it.
//                /status.json gets counts only: no address, no transaction, no sum
//   switch       a node reads the chain while it keeps its state on disk (serve.mjs with MARE_STATE); MARE_BOOKS=off switches it
//                off, MARE_BASE_RPC=off as well. MARE_BOOKS_SINCE (YYYY-MM-DD, default 2026-11-23, the day the till opened) or
//                MARE_BOOKS_FROM_BLOCK say where the first reading starts
import { USDC_BASE, HOUSE_WALLET } from './pricing.mjs';
import { isFair } from './ledger.mjs';
import { payWatch } from './pay.mjs';
import { operatorKeyOk } from './declare.mjs';

export const BOOKS_VERSION = 'books-1';
export const BOOKS_RPC = 'https://mainnet.base.org';
export const BOOKS_SINCE = '2026-11-23';
// keccak256("Transfer(address,address,uint256)") and keccak256("AuthorizationUsed(address,bytes32)") (USDC, FiatTokenV2)
export const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
export const AUTH_USED_TOPIC = '0x98de503528ee59b575ef0c0a2576a82497bfc029a5685b209e9ec333479b10a5';
// the only questions the books ever ask the chain
export const BOOKS_METHODS = Object.freeze(['eth_blockNumber', 'eth_getLogs', 'eth_getBlockByNumber']);
// how long an entry is kept: ten years from the end of the calendar year of the payment (checked 26.11.2026 against the text
// in force, https://www.gesetze-im-internet.de/ao_1977/__147.html: Abs. 3 Satz 1 ten years for Nr. 1 and 4a, eight for Nr. 4)
export const BOOKS_RETAIN = Object.freeze({ years: 10, basis: '§ 147 Abs. 1 Nr. 1, Abs. 3 Satz 1, Abs. 4 AO', why: 'the ledger is a record (Aufzeichnung) of the money received, kept ten years; Buchungsbelege (Nr. 4) are kept eight years since 01.01.2025 (BEG IV)', source: 'https://www.gesetze-im-internet.de/ao_1977/__147.html', from: 'the end of the calendar year of the payment, in German time' });
export const BOOKS_PATHS = new Set(['/operator/ledger.csv', '/operator/ledger.json', '/operator/digest']);
const KEYS = { state: (w) => `books:s:${w}`, day: (d) => `books:d:${d}`, days: 'books:days', tally: (d) => `books:t:${d}` };
export const BOOKS_KEY = /^books:(s:0x[0-9a-f]{40}|d:\d{4}-\d{2}-\d{2}|days|t:\d{4}-\d{2}-\d{2})$/;
const UA = 'MareLiberum-Books/1.0 (+https://mareliberum.dev/privacy)';
const HEX40 = /^0x[0-9a-fA-F]{40}$/, HEX64 = /^0x[0-9a-fA-F]{64}$/, DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAYMS = 864e5, LOOK_BACK = 3 * DAYMS + 3600e3, TALLY_DAYS = 400;
const lc = (s) => String(s ?? '').toLowerCase();
const hex = (n) => `0x${Math.max(0, Math.floor(n)).toString(16)}`;
const num = (h) => { try { const n = Number(BigInt(h)); return Number.isSafeInteger(n) ? n : NaN; } catch { return NaN; } };
const pad = (addr) => `0x${lc(addr).slice(2).padStart(64, '0')}`;
const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);
const okDay = (d) => (DAY.test(String(d || '')) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) ? String(d) : null);
// USDC base units as dollars, exactly: 6 decimals, never a floating point
export const usdOf = (units) => { const s = BigInt(units).toString().padStart(7, '0'); return `${s.slice(0, -6)}.${s.slice(-6)}`; };
const sumUnits = (list) => list.reduce((s, e) => s + BigInt(e.value || '0'), 0n);
const usd6 = (micro) => (Math.max(0, Number(micro) || 0) / 1e6).toFixed(6);

// the calendar year of a payment in German time (the books are kept there); without the time zone, the next year (never early)
const BERLIN = (() => { try { const f = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Berlin', year: 'numeric' }); return (ms) => Number(f.format(new Date(ms))); } catch { return null; } })();
export const bookYear = (ms) => { const y = BERLIN ? BERLIN(ms) : NaN; return Number.isInteger(y) && y > 2000 ? y : new Date(ms).getUTCFullYear() + 1; };
// the end of the period for a payment at ms: the end of its year plus the years of BOOKS_RETAIN, and one day more
export const keepUntilMs = (ms, R = BOOKS_RETAIN) => Date.UTC(bookYear(ms) + 1 + R.years, 0, 2);

// on unless switched off (cfg.books or MARE_BOOKS: off, 0, false, no)
export const booksSwitch = (cfg = {}, env = globalThis.process?.env || {}) => !/^(off|0|false|no)$/i.test(String(cfg.books ?? env.MARE_BOOKS ?? '').trim());
// the RPC of Base (the same MARE_BASE_RPC the toll asks); off, none, 0, false or no: the books do not read the chain
export const booksRpc = (cfg = {}, env = globalThis.process?.env || {}) => { const v = String(cfg.booksRpc ?? env.MARE_BASE_RPC ?? '').trim(); if (/^(off|none|0|false|no)$/i.test(v)) return null; return /^https:\/\/[^\s]+$/.test(v) ? v : BOOKS_RPC; };
export const booksStart = (env = globalThis.process?.env || {}) => {
  const b = Number(env.MARE_BOOKS_FROM_BLOCK), since = okDay(env.MARE_BOOKS_SINCE) || BOOKS_SINCE;
  return { since, fromBlock: Number.isSafeInteger(b) && b >= 0 && String(env.MARE_BOOKS_FROM_BLOCK).trim() !== '' ? b : null };
};

// ------------------------------------------------------------------ the doors' own records, read fresh for every pass
// till and fair: the till's copy of its sales (node/ledger.mjs, memory) and fair share's registry and books (fair:pay, fair:book)
// toll: its own books (toll:books, node/toll.mjs): the payments on their way and the ones that ended in the last three days
async function recordsOf(kv, ledger) {
  const out = [], sales = Array.isArray(ledger?.mem?.sales) ? ledger.mem.sales : [];
  const [fp, fb, tb] = await Promise.all(['fair:pay', 'fair:book', 'toll:books'].map((k) => Promise.resolve(kv.get(k)).catch(() => null)));
  for (const s of sales) {
    if (!s || s.status === 'free_sample' || s.status === 'test') continue;
    const fair = isFair(s);
    out.push({ door: fair ? 'fair' : 'till', id: String(s.id || ''), tx: s.tx || null, payer: s.payer || null, units: fair ? (Number.isInteger(s.amount_micro) ? s.amount_micro : null) : Math.round(Number(s.amount_cents) || 0) * 10_000, at: s.ts, status: String(s.status || '') });
  }
  for (const p of Array.isArray(fp) ? fp : []) if (p?.sale) out.push({ door: 'fair', id: String(p.sale), tx: p.tx || null, payer: null, units: Number.isInteger(p.micro) ? p.micro : null, at: p.at, status: String(p.status || '') });
  for (const b of Array.isArray(fb) ? fb : []) if (b?.sale) out.push({ door: 'fair', id: String(b.sale), tx: b.tx || null, payer: b.payer || null, units: Number.isInteger(b.amount_micro) ? b.amount_micro : null, at: b.settled_at || b.booked, status: 'settled' });
  for (const p of Array.isArray(tb?.pays) ? tb.pays : []) if (p?.id) out.push({ door: 'toll', id: String(p.id), tx: p.tx || null, payer: p.from || null, nonce: p.nonce || null, units: Number.isInteger(p.micro) ? p.micro : null, at: p.at, status: String(p.status || ''), why: p.why || null, ids: Array.isArray(p.ids) ? p.ids.slice(0, 50) : [] });
  return out;
}
// which door a transfer belongs to: its transaction, then its signed transfer, then (best effort) wallet, amount and time
export function labelOf(e, recs, taken = new Set()) {
  const tx = lc(e.tx);
  for (const door of ['toll', 'fair', 'till']) { const r = recs.find((x) => x.door === door && x.tx && lc(x.tx) === tx); if (r) return { door, match: 'tx', ref: r.id }; }
  if (e.nonce) { const r = recs.find((x) => x.door === 'toll' && x.nonce && lc(x.nonce) === lc(e.nonce) && lc(x.payer) === lc(e.from)); if (r) return { door: 'toll', match: 'authorization', ref: r.id }; }
  const t = Date.parse(e.time), gap = (x) => Math.abs(t - Date.parse(x.at));
  const near = recs.filter((x) => x.payer && lc(x.payer) === lc(e.from) && x.units != null && String(x.units) === e.value && !(x.tx && lc(x.tx) !== tx) && !taken.has(`${x.door}:${x.id}`)
    && Number.isFinite(Date.parse(x.at)) && t - Date.parse(x.at) >= -120e3 && t - Date.parse(x.at) <= 1800e3).sort((a, b) => gap(a) - gap(b));
  if (near.length && !near.some((x) => x.door !== near[0].door && gap(x) === gap(near[0]))) return { door: near[0].door, match: 'payer-amount-time', ref: near[0].id };
  return { door: 'unmatched', match: null, ref: null };
}
// what the door's own record says against the chain: a released toll payment or an unsettled sale whose money arrived
export function flagOf(e, recs) {
  if (!e.ref || e.door === 'unmatched') return null;
  const mine = recs.filter((x) => x.door === e.door && x.id === e.ref); if (!mine.length) return null;
  if (e.door === 'toll') { const r = mine.find((x) => x.status === 'released'); if (r) return { flag: 'toll-released-on-chain', why: `the toll released this payment (${String(r.why || 'no reason kept').slice(0, 160)}), but its transfer is on chain; toll ids ${r.ids.join(',') || 'none kept'}; nothing was done on the customer's side`, ids: r.ids }; return null; }
  if (mine.some((x) => x.status === 'settled')) return null;
  if (mine.some((x) => x.status === 'unsettled')) return { flag: 'unsettled-on-chain', why: `the ${e.door === 'fair' ? 'fair share' : 'till'} booked this payment as not settled, but its transfer is on chain; nothing was done on the customer's side` };
  return null;
}

// ------------------------------------------------------------------ the export: CSV for the operator's tax files
export const CSV_HEAD = ['day_utc', 'time_utc', 'block', 'tx', 'log_index', 'from', 'to', 'asset', 'amount_base_units', 'amount_usd', 'door', 'match', 'ref', 'flag', 'note'];
const cell = (v) => { let s = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function ledgerCsv(list) {
  const rows = [CSV_HEAD.join(',')];
  for (const e of list) rows.push([String(e.time).slice(0, 10), e.time, e.block, e.tx, e.log, e.from, e.to, 'USDC', e.value, e.usd, e.door, e.match, e.ref, e.flag, e.why].map(cell).join(','));
  return `${rows.join('\r\n')}\r\n`;
}

// ------------------------------------------------------------------ the books of one node
export function createBooks({ kv, wallet = HOUSE_WALLET, token = USDC_BASE, rpc = BOOKS_RPC, since = BOOKS_SINCE, fromBlock = null, ledger = null, facilitator = null, probe = true,
  get = (...a) => fetch(...a), now = () => Date.now(), log = () => {}, confirmations = 60, step: step0 = 1000, minStep = 50, maxStep = 2000, burst = 20, pauseMs = 250,
  everyMs = 60_000, catchUpMs = 2000, rpcMs = 8000, probeMs = 15 * 60_000, again = 1800, dayAgainAfterH = 6, dayAgainBurst = 10 } = {}) {
  const W = lc(wallet), T = lc(token), on = HEX40.test(W) && HEX40.test(T) && !!rpc;
  let step = step0, refused = null, refusedAgain = null, refusedDay = null, seq = 0, running = null, timer = null, stopped = false, rev = 0, sum = null, sumRev = -1, waitUntilMs = 0, lastProbe = 0;
  const times = new Map(), delta = new Map();
  const iso = (ms = now()) => new Date(ms).toISOString();
  const count = (k, n = 1, d = dayOf(now())) => { let m = delta.get(d); if (!m) delta.set(d, (m = {})); m[k] = (m[k] || 0) + n; };

  // ---- writes: at once on the disk where the node keeps one (setNow), else into the store; false when it did not land
  const put = async (k, v, untilMs) => {
    const ttl = Math.max(60, Math.ceil((untilMs - now()) / 1000));
    try { if (typeof kv.setNow === 'function') return kv.setNow(k, v, ttl) !== false; await kv.set(k, v, ttl); return true; } catch (e) { log('mare_books', `write ${k}: ${String(e?.message || e).slice(0, 120)}`); return false; }
  };
  const far = () => keepUntilMs(now());
  const readState = async () => { const s = await Promise.resolve(kv.get(KEYS.state(W))).catch(() => null); return s && s.v === 1 && s.wallet === W ? s : { v: 1, wallet: W, token: T, since, start: null, next: null, head: null, safe: null, lastPass: null, lastOk: null, lastError: null, errors: 0, zero: 0, ranges: 0 }; };
  const readDays = async () => { const d = await Promise.resolve(kv.get(KEYS.days)).catch(() => null); return Array.isArray(d) ? d.filter((x) => DAY.test(x)) : []; };
  const readDay = async (d) => { const l = await Promise.resolve(kv.get(KEYS.day(d))).catch(() => null); return Array.isArray(l) ? l : []; };
  const writeDay = (d, list) => put(KEYS.day(d), list, Math.max(...list.map((e) => keepUntilMs(Date.parse(e.time)))));

  // ---- the chain: read only
  const call = async (method, params) => {
    if (!BOOKS_METHODS.includes(method)) throw new Error(`the books never ask ${method}`);
    const r = await get(rpc, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json', 'user-agent': UA }, body: JSON.stringify({ jsonrpc: '2.0', id: ++seq, method, params }), signal: AbortSignal.timeout(rpcMs) });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j || j.error || !('result' in j)) { const e = new Error(`${method}: ${String(j?.error?.message || `HTTP ${r.status}`).slice(0, 160)}`); e.code = j?.error?.code; e.status = r.status; throw e; }
    return j.result;
  };
  // a range the RPC finds too large (or too slow) is halved; a rate limit is not a range: the pass waits instead
  const tooWide = (e) => { const m = String(e?.message || ''); if (e?.status === 429 || /rate.?limit|too many requests|requests per/i.test(m)) return false; return e?.name === 'TimeoutError' || e?.status === 413 || e?.code === -32005 || e?.code === -32602 || /range|limit|too many|exceed|more than|10000 results|query returned/i.test(m); };
  const sleep = (ms) => (ms > 0 ? new Promise((r) => { const tm = setTimeout(r, ms); tm.unref?.(); }) : Promise.resolve());
  const blockTime = async (n, hint) => {
    if (times.has(n)) return times.get(n);
    let s = num(hint);
    if (!Number.isFinite(s)) { const b = await call('eth_getBlockByNumber', [hex(n), false]); s = num(b?.timestamp); }
    if (!Number.isFinite(s) || s <= 0) throw new Error(`no time for block ${n}`);
    times.set(n, s); if (times.size > 5000) times.delete(times.keys().next().value);
    return s;
  };
  // the first block at or after a time, found by halves (about 26 questions, once)
  const firstBlockAt = async (sec, head, low = 0) => {
    let lo = Math.max(0, low), hi = head;
    if ((await blockTime(hi)) < sec) return hi;
    while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if ((await blockTime(mid)) < sec) lo = mid + 1; else hi = mid; }
    return lo;
  };
  // the Transfer logs to the wallet in [a, b], with the signed transfer of each (AuthorizationUsed in the same transaction)
  const transfersIn = async (a, b) => {
    const logs = await call('eth_getLogs', [{ address: token, fromBlock: hex(a), toBlock: hex(b), topics: [TRANSFER_TOPIC, null, pad(W)] }]);
    if (!Array.isArray(logs)) throw new Error('eth_getLogs: no list');
    const out = [];
    for (const g of logs) {
      if (!g || g.removed === true || lc(g.address) !== T || !Array.isArray(g.topics) || lc(g.topics[0]) !== TRANSFER_TOPIC || lc(g.topics[2]) !== pad(W)) continue;
      const block = num(g.blockNumber), li = num(g.logIndex), tx = lc(g.transactionHash);
      if (!Number.isFinite(block) || block < a || block > b || !Number.isFinite(li) || !HEX64.test(tx) || !HEX64.test(String(g.topics[1] || ''))) continue;
      let value; try { value = BigInt(String(g.data || '0x').length > 2 ? g.data : '0x0'); } catch { continue; }
      if (value <= 0n) { st.zero = (st.zero || 0) + 1; continue; }
      out.push({ k: `${tx}:${li}`, block, log: li, tx, from: `0x${lc(g.topics[1]).slice(26)}`, to: W, value: value.toString(), usd: usdOf(value), nonce: null, hint: g.blockTimestamp });
    }
    if (out.length) {
      const froms = [...new Set(out.map((e) => pad(e.from)))], auths = [];
      for (let i = 0; i < froms.length; i += 50) { const l = await call('eth_getLogs', [{ address: token, fromBlock: hex(a), toBlock: hex(b), topics: [AUTH_USED_TOPIC, froms.slice(i, i + 50)] }]); if (Array.isArray(l)) auths.push(...l); }
      for (const e of out) {
        const mine = auths.filter((x) => x && x.removed !== true && lc(x.address) === T && lc(x.transactionHash) === e.tx && Array.isArray(x.topics) && lc(x.topics[0]) === AUTH_USED_TOPIC && lc(x.topics[1]) === pad(e.from) && num(x.logIndex) < e.log && HEX64.test(String(x.topics[2] || '')))
          .sort((x, y) => num(y.logIndex) - num(x.logIndex));
        if (mine.length) e.nonce = lc(mine[0].topics[2]);
      }
      for (const e of out) { e.time = iso((await blockTime(e.block, e.hint)) * 1000); delete e.hint; }
    }
    return out;
  };

  // the transfers of [a, b] in ranges the RPC takes: a width of its own (it starts at the forward width and a range too large
  // halves only this one: a re-read never touches the forward reading's), a pause between ranges, nothing more once stopped
  const readSpan = async (a, b) => {
    const out = []; let x = a, s = Math.max(minStep, Math.min(step, refusedAgain ?? step));
    while (x <= b && !stopped) {
      const z = Math.min(x + s - 1, b);
      try { out.push(...(await transfersIn(x, z))); x = z + 1; }
      catch (e) { if (tooWide(e) && s > minStep) { refusedAgain = Math.min(refusedAgain ?? Infinity, Math.floor((z - x + 1) * 0.8)); s = Math.max(minStep, Math.floor(s / 2)); count('chain_narrowed'); await sleep(pauseMs); continue; } throw e; }
      if (x <= b) await sleep(pauseMs);
    }
    return out;
  };

  // ---- the books: new entries into their days, at once; nothing counted twice
  let st = null;
  // → the number of entries added (0: all were there), or null when a write failed (nothing may move past it then)
  const keep = async (found, recs) => {
    if (!found.length) return 0;
    const byDay = new Map(); for (const e of found) { const d = e.time.slice(0, 10); if (!byDay.has(d)) byDay.set(d, []); byDay.get(d).push(e); }
    const taken = await takenOf();
    const days = await readDays(); let daysChanged = false, total = 0;
    for (const [d, list] of byDay) {
      const cur = await readDay(d), have = new Set(cur.map((x) => x.k)); let added = 0;
      for (const e of list) {
        if (have.has(e.k)) continue;
        const l = labelOf(e, recs, taken), x = { ...e, door: l.door, match: l.match, ref: l.ref, seen: iso() };
        const f = flagOf(x, recs); if (f) { x.flag = f.flag; x.why = f.why; x.flagged = iso(); log('mare_books', `${f.flag}: ${x.tx.slice(0, 12)}…`); }
        if (l.ref) taken.add(`${l.door}:${l.ref}`);
        cur.push(x); have.add(e.k); added++;
      }
      // nothing new: a day whose entries are kept but that the index lost (a write that failed half way: the store took the
      // day, the index never came) is put back into the index
      if (!added) { if (cur.length && !days.includes(d)) { days.push(d); days.sort(); daysChanged = true; } continue; }
      cur.sort((p, q) => p.block - q.block || p.log - q.log);
      if (!(await writeDay(d, cur))) return null;
      if (!days.includes(d)) { days.push(d); days.sort(); daysChanged = true; }
      rev++; total += added;
    }
    if (daysChanged && !(await put(KEYS.days, days, far()))) return null;
    return total;
  };
  const takenOf = async () => { const t = new Set(), cut = dayOf(now() - LOOK_BACK); for (const d of (await readDays()).filter((x) => x >= cut)) for (const e of await readDay(d)) if (e.ref) t.add(`${e.door}:${e.ref}`); return t; };
  // the entries of the last days once more: a label found now, a flag the door's record calls for now
  const relook = async (recs) => {
    const cut = now() - LOOK_BACK, taken = await takenOf();
    for (const d of (await readDays()).filter((x) => x >= dayOf(cut))) {
      const list = await readDay(d); let changed = false;
      for (const e of list) {
        if (Date.parse(e.time) < cut) continue;
        // a best-effort label the door's record now contradicts (it names another transaction) is taken back and looked for again
        if (e.match === 'payer-amount-time' && recs.some((x) => x.door === e.door && x.id === e.ref && x.tx && lc(x.tx) !== e.tx)) { taken.delete(`${e.door}:${e.ref}`); Object.assign(e, { door: 'unmatched', match: null, ref: null }); changed = true; }
        if (e.door === 'unmatched') { const l = labelOf(e, recs, taken); if (l.ref) { Object.assign(e, { door: l.door, match: l.match, ref: l.ref, labelled: iso() }); taken.add(`${l.door}:${l.ref}`); changed = true; } }
        if (!e.flag) { const f = flagOf(e, recs); if (f) { Object.assign(e, { flag: f.flag, why: f.why, flagged: iso() }); changed = true; log('mare_books', `${f.flag}: ${e.tx.slice(0, 12)}…`); } }
      }
      if (changed) { await writeDay(d, list); rev++; }
    }
  };
  // the counts of the facilitator (node/pay.mjs) and of the books themselves, folded into their day (kept 400 days)
  const fold = async () => {
    const add = (into, from) => { for (const [k, v] of Object.entries(from || {})) into[k] = (into[k] || 0) + (Number(v) || 0); };
    const all = new Map(); for (const [d, m] of Object.entries(payWatch.take())) { all.set(d, { ...m }); }
    for (const [d, m] of delta) add(all.get(d) || (all.set(d, {}), all.get(d)), m); delta.clear();
    for (const [d, m] of all) { const cur = (await Promise.resolve(kv.get(KEYS.tally(d))).catch(() => null)) || {}; add(cur, m); await put(KEYS.tally(d), cur, Date.parse(`${d}T00:00:00Z`) + TALLY_DAYS * DAYMS); }
  };
  // is the facilitator there? Asked only when no payment asked it for a while: GET /supported, the answer itself not read
  const probeOnce = async () => {
    if (!probe || !facilitator || now() - lastProbe < probeMs) return;
    const l = payWatch.last(), recent = [l.reached, l.missed].map((x) => Date.parse(x || '') || 0); if (Math.max(...recent) > now() - probeMs) return;
    lastProbe = now();
    try { const r = await get(`${String(facilitator).replace(/\/+$/, '')}/supported`, { method: 'GET', headers: { accept: 'application/json', 'user-agent': UA }, signal: AbortSignal.timeout(5000) }); try { await r.body?.cancel?.(); } catch {} count(r.status < 500 ? 'probe_ok' : 'probe_failed'); }
    catch { count('probe_failed'); }
  };

  // ---- the two UTC days before once more, once a day from 06:00 UTC (st.redo holds where it stands, st.redone the last day
  // done): bounded to those two days' blocks, at most dayAgainBurst ranges a pass, a width of its own (r.step), never before the
  // start; a span that fails in 3 passes is given up (counted, said once). Every block of a day D is read again at 06:00 of D+1
  // and of D+2: a backend less than 30 hours behind misses none
  async function dayAgain(recs) {
    if (!(dayAgainBurst > 0) || st.next == null || st.next <= st.start) return;
    const t = now(), y = dayOf(t - DAYMS);
    if (t < Date.parse(`${dayOf(t)}T00:00:00Z`) + dayAgainAfterH * 3600e3) return;
    let r = st.redo && st.redo.day === y ? st.redo : null;
    if (!r) {
      if (st.redone && st.redone >= y) return;
      // yesterday and the day before: from 00:00:00 UTC of the day before yesterday to the last block before 00:00:00 today
      const t1 = Math.floor(Date.parse(`${y}T00:00:00Z`) / 1000) + 86_400, t0 = t1 - 2 * 86_400, hi = st.next - 1;
      if ((await blockTime(hi)) < t1) return; // the forward reading has not passed the end of yesterday yet
      if (st.redo) count('chain_day_reread_dropped'); // an unfinished one of an earlier day gives way to this one
      const a = Math.max(st.start, await firstBlockAt(t0, hi, st.start)), b = (await firstBlockAt(t1, hi, st.start)) - 1;
      r = st.redo = { day: y, from: a, to: b, next: a, step, fails: 0 };
    }
    let n = 0, added = 0;
    r.step = Math.max(minStep, Math.min(maxStep, Number(r.step) || step));
    try {
      while (r.next <= r.to && n < dayAgainBurst && !stopped) {
        const z = Math.min(r.next + r.step - 1, r.to);
        let got;
        try { got = await transfersIn(r.next, z); }
        catch (e) { if (tooWide(e) && r.step > minStep) { r.step = Math.max(minStep, Math.floor(r.step / 2)); count('chain_narrowed'); await sleep(pauseMs); continue; } throw e; }
        const k = await keep(got, recs); if (k == null) throw new Error('the books could not be written');
        r.next = z + 1; n++; added += k;
        if (r.next <= r.to && n < dayAgainBurst) await sleep(pauseMs);
      }
    } catch (e) {
      count('chain_reread_failed'); r.fails = (r.fails || 0) + 1;
      if (r.fails >= 3) { log('mare_books', `the days before ${r.day} once more given up after 3 passes, at block ${r.next}: ${String(e?.message || e).slice(0, 120)}`); st.redone = r.day; st.redo = null; count('chain_day_reread_given_up'); }
      return added;
    }
    if (r.next > r.to) { st.redone = r.day; st.redo = null; count('chain_day_reread'); }
    return added;
  }

  // ---- one pass: read what is new, look again at the last days, fold the counts
  async function passOnce() {
    st = await readState();
    if (!on) return { off: true };
    const t = now(); st.lastPass = iso(t);
    try {
      const head = num(await call('eth_blockNumber', []));
      if (!Number.isFinite(head) || head <= 0) throw new Error('eth_blockNumber: no head');
      const safe = Math.max(0, head - confirmations); st.head = head; st.safe = safe;
      if (st.next == null) { st.start = Number.isSafeInteger(fromBlock) ? fromBlock : await firstBlockAt(Math.floor(Date.parse(`${since}T00:00:00Z`) / 1000) - 3600, safe); st.next = st.start; if (!(await put(KEYS.state(W), st, far()))) throw new Error('the state could not be written'); }
      let ranges = 0, found = 0;
      if (refusedDay !== dayOf(t)) { refused = refusedAgain = null; refusedDay = dayOf(t); } // four fifths of the narrowest width the RPC refused (forward, and the last hour apart): the most asked, for a UTC day
      const recs = await recordsOf(kv, ledger);
      // the last hour behind the cursor once more, every pass: a public RPC behind a load balancer can answer eth_getLogs from a
      // node that has not indexed the newest blocks yet (an empty list, no error); what it left out is booked now. keep() counts
      // nothing twice (tx and log index); a re-read that fails is counted and the pass goes on
      if (again > 0 && st.next > st.start) {
        const back = Math.max(st.start, st.next - again);
        try { const got = await readSpan(back, st.next - 1); const k = await keep(got, recs); if (k == null) throw new Error('the books could not be written'); found += k; count('chain_reread'); }
        catch (e) { count('chain_reread_failed'); log('mare_books', `the last hour once more: ${String(e?.message || e).slice(0, 160)}`); }
      }
      while (st.next <= safe && ranges < burst && !stopped) {
        const a = st.next, b = Math.min(a + step - 1, safe);
        let got;
        try { got = await transfersIn(a, b); }
        catch (e) { if (tooWide(e) && step > minStep) { refused = Math.min(refused ?? Infinity, Math.floor((b - a + 1) * 0.8)); step = Math.max(minStep, Math.floor(step / 2)); count('chain_narrowed'); await sleep(pauseMs); continue; } throw e; }
        const k = await keep(got, recs); if (k == null) throw new Error('the books could not be written: the range is read again');
        st.next = b + 1; st.ranges = (st.ranges || 0) + 1; ranges++; found += k; count('chain_ranges');
        if (!(await put(KEYS.state(W), st, far()))) throw new Error('the state could not be written');
        // wider again by a quarter, never to a width the RPC refused today (at most four fifths of the narrowest it refused)
        if (step < maxStep) step = Math.max(minStep, Math.min(maxStep, Math.ceil(step * 1.25), refused ?? maxStep));
        if (st.next <= safe) await sleep(pauseMs);
      }
      // once a UTC day, from 06:00 UTC, the two UTC days before once more (a backend more than an hour behind, up to 30 hours),
      // a few ranges a pass; their first and last block are found by the chain's own times; never before the start
      if (st.next > safe && !stopped) { try { found += (await dayAgain(recs)) || 0; } catch (e) { count('chain_reread_failed'); log('mare_books', `the days before once more: ${String(e?.message || e).slice(0, 160)}`); } }
      await relook(await recordsOf(kv, ledger));
      st.lastOk = iso(); st.errors = 0; st.lastError = null; waitUntilMs = 0;
      await put(KEYS.state(W), st, far());
      return { ranges, found, behind: Math.max(0, safe - st.next + 1) };
    } catch (e) {
      st.errors = (st.errors || 0) + 1; st.lastError = { at: iso(), error: String(e?.message || e).slice(0, 200) }; count('chain_errors');
      waitUntilMs = now() + Math.min(30 * 60_000, 30_000 * 2 ** Math.min(6, st.errors - 1));
      await put(KEYS.state(W), st, far());
      if (st.errors === 1 || st.errors % 10 === 0) log('mare_books', st.lastError.error);
      return { error: st.lastError.error, retryAt: iso(waitUntilMs) };
    } finally {
      try { await probeOnce(); } catch {}
      try { await fold(); } catch (e) { log('mare_books', `fold: ${String(e?.message || e).slice(0, 120)}`); }
    }
  }
  const pass = () => (running ||= passOnce().finally(() => { running = null; }));
  const schedule = (ms) => { if (stopped) return; if (timer) clearTimeout(timer); timer = setTimeout(tick, Math.max(1000, ms)); timer.unref?.(); };
  async function tick() {
    timer = null;
    if (now() < waitUntilMs) return schedule(waitUntilMs - now());
    const r = await pass().catch(() => ({}));
    schedule(r?.error ? waitUntilMs - now() : r?.behind > 0 ? catchUpMs : everyMs);
  }

  // ---- what the operator reads
  async function entries({ from = null, to = null } = {}) {
    const out = []; for (const d of await readDays()) { if ((from && d < from) || (to && d > to)) continue; out.push(...(await readDay(d))); }
    return out.map(({ seen, labelled, flagged, ...e }) => ({ ...e, seen, ...(labelled ? { labelled } : {}), ...(flagged ? { flagged } : {}) }));
  }
  async function summary() {
    if (sum && sumRev === rev) return sum;
    const all = await entries(), doors = {};
    for (const e of all) { const x = (doors[e.door] ||= { transfers: 0, units: 0n }); x.transfers++; x.units += BigInt(e.value); }
    const u = sumUnits(all);
    sum = { transfers: all.length, amount_base_units: u.toString(), amount_usd: usdOf(u), by_door: Object.fromEntries(Object.entries(doors).map(([k, v]) => [k, { transfers: v.transfers, amount_usd: usdOf(v.units) }])), unmatched: all.filter((e) => e.door === 'unmatched').length, flagged: all.filter((e) => e.flag).length, first: all[0]?.time || null, last: all[all.length - 1]?.time || null };
    sumRev = rev; return sum;
  }
  async function sync() {
    const s = await readState(); // what the disk holds (a cursor that could not be written is not told as read)
    return { on, rpc: rpc ? new URL(rpc).host : null, start_block: s.start, next_block: s.next, safe_head: s.safe, behind_blocks: s.next != null && s.safe != null ? Math.max(0, s.safe - s.next + 1) : null, last_pass: s.lastPass, last_ok: s.lastOk, last_error: s.lastError, errors_in_a_row: s.errors || 0, zero_value_transfers_skipped: s.zero || 0, step, since };
  }
  async function about() {
    return { version: BOOKS_VERSION, chain: 'Base (eip155:8453)', asset: 'USDC', token: T, wallet: W, retention: { ...BOOKS_RETAIN }, sync: await sync(), totals: await summary(),
      note: 'Every incoming USDC transfer to the wallet, read from the chain. door: till (paid route), fair (fair share), toll (harbour toll) or unmatched (no record of the sea names it: the wallet may receive other payments too). match: tx, authorization (wallet and nonce of the signed transfer), payer-amount-time (best effort). A flag is for the operator only.' };
  }

  // ---- the digest: per day, from the records each door keeps and from the books
  async function digest({ days = 7, declKv = kv } = {}) {
    const n = Math.min(60, Math.max(1, Math.floor(Number(days)) || 7)), t = now(), list = Array.from({ length: n }, (_, i) => dayOf(t - i * DAYMS)), first = list[n - 1];
    const blank = () => ({
      declarations: { withdrawals: 0, cancellations: 0, receipt_sent: 0, open_without_receipt: 0 },
      toll: { networks: 0, tolled_answers: 0, normal_answers_while_due: 0, tokens_tolled: 0, tolled_usd: '0.000000', settled: { payments: 0, usd: '0.000000' }, on_its_way: { payments: 0, usd: '0.000000' }, released: { payments: 0, usd: '0.000000' } },
      till: { sales: 0, by_status: {}, settled_usd: '0.00', unconfirmed_usd: '0.00' },
      fair: { payments: 0, by_status: {}, settled_usd: '0.000000', unconfirmed_usd: '0.000000' },
      ledger: { transfers: 0, usd: '0.000000', by_door: {}, unmatched: 0, flagged: 0 },
      errors: { facilitator_no_answer: 0, facilitator_down: 0, facilitator_no_verdict: 0, settlement_failed: 0, chain_reads_failed: 0, chain_rereads_failed: 0, chain_day_rereads_given_up: 0, chain_day_rereads_dropped: 0 },
      facilitator: { reached: 0, missed: 0, payments_refused: 0 },
    });
    const out = Object.fromEntries(list.map((d) => [d, blank()]));
    // declarations (node/declare.mjs): received per day, and those whose receipt has not gone out
    const idx = (await Promise.resolve(declKv.get('legal:decl:index')).catch(() => null)) || [];
    for (const x of Array.isArray(idx) ? idx : []) {
      const d = String(x?.at || '').slice(0, 10); if (!out[d]) continue;
      const full = await Promise.resolve(declKv.get(`legal:decl:${x.id}`)).catch(() => null), o = out[d].declarations;
      if (x.kind === 'withdrawal') o.withdrawals++; else if (x.kind === 'termination') o.cancellations++;
      if (full?.mail?.state === 'sent') o.receipt_sent++; else o.open_without_receipt++;
    }
    // the toll: each network's account of the day (node/toll.mjs), and its own books of payments
    const micro = {};
    if (typeof kv.keys === 'function') {
      for (const k of kv.keys('toll:n:')) {
        const d = k.slice(7, 17); if (!out[d]) continue;
        const a = await Promise.resolve(kv.get(k)).catch(() => null); if (!a || a.v !== 2) continue;
        const o = out[d].toll; o.networks++; o.tolled_answers += a.n || 0; o.normal_answers_while_due += a.x || 0; o.tokens_tolled += a.t || 0; micro[d] = (micro[d] || 0) + (a.m || 0);
      }
    } else for (const d of list) out[d].toll.tolled_answers = null;
    for (const d of list) out[d].toll.tolled_usd = usd6(micro[d] || 0);
    const tb = await Promise.resolve(kv.get('toll:books')).catch(() => null);
    for (const [d, v] of Object.entries(tb?.days || {})) if (out[d]) out[d].toll.settled = { payments: v.n || 0, usd: usd6(v.micro) };
    const tallyP = (o, m) => ({ payments: o.payments + 1, usd: usd6(Math.round(Number(o.usd) * 1e6) + (m || 0)) });
    for (const p of Array.isArray(tb?.pays) ? tb.pays : []) {
      if (p.status === 'pending') { const d = String(p.at || '').slice(0, 10); if (out[d]) out[d].toll.on_its_way = tallyP(out[d].toll.on_its_way, p.micro); }
      else if (p.status === 'released') { const d = String(p.end || p.at || '').slice(0, 10); if (out[d]) out[d].toll.released = tallyP(out[d].toll.released, p.micro); }
    }
    // the till and fair share: the till's copy of its sales (this node's memory), fair share's registry (400 days)
    const cents = {};
    for (const s of Array.isArray(ledger?.mem?.sales) ? ledger.mem.sales : []) {
      if (!s || isFair(s) || s.status === 'free_sample' || s.status === 'test') continue;
      const d = String(s.ts || '').slice(0, 10); if (!out[d]) continue;
      const o = out[d].till, c = (cents[d] ||= { settled: 0, open: 0 }); o.sales++; o.by_status[s.status] = (o.by_status[s.status] || 0) + 1;
      if (s.status === 'settled') c.settled += Number(s.amount_cents) || 0; else if (/^(pending|unverified|unsettled)$/.test(s.status)) c.open += Number(s.amount_cents) || 0;
    }
    for (const [d, c] of Object.entries(cents)) { out[d].till.settled_usd = (c.settled / 100).toFixed(2); out[d].till.unconfirmed_usd = (c.open / 100).toFixed(2); }
    const fp = (await Promise.resolve(kv.get('fair:pay')).catch(() => null)) || [], fm = {};
    for (const p of Array.isArray(fp) ? fp : []) {
      const d = String(p?.at || '').slice(0, 10); if (!out[d]) continue;
      const o = out[d].fair, m = (fm[d] ||= { settled: 0, open: 0 }); o.payments++; o.by_status[p.status] = (o.by_status[p.status] || 0) + 1;
      if (p.status === 'settled') m.settled += p.micro || 0; else if (/^(pending|unverified|unsettled)$/.test(p.status)) m.open += p.micro || 0;
    }
    for (const [d, m] of Object.entries(fm)) { out[d].fair.settled_usd = usd6(m.settled); out[d].fair.unconfirmed_usd = usd6(m.open); }
    // the books from the chain
    for (const d of (await readDays()).filter((x) => x >= first)) {
      if (!out[d]) continue; const l = await readDay(d), o = out[d].ledger, by = {};
      o.transfers = l.length; o.usd = usdOf(sumUnits(l)); o.unmatched = l.filter((e) => e.door === 'unmatched').length; o.flagged = l.filter((e) => e.flag).length;
      for (const e of l) (by[e.door] ||= []).push(e);
      o.by_door = Object.fromEntries(Object.entries(by).map(([k, v]) => [k, { transfers: v.length, usd: usdOf(sumUnits(v)) }]));
    }
    // the payment path: what the facilitator answered (node/pay.mjs), the checks of the books, the chain's answers
    const now1 = payWatch.peek(), mine = Object.fromEntries(delta);
    for (const d of list) {
      const c = { ...((await Promise.resolve(kv.get(KEYS.tally(d))).catch(() => null)) || {}) };
      for (const m of [now1[d], mine[d]]) for (const [k, v] of Object.entries(m || {})) c[k] = (c[k] || 0) + v;
      const g = (k) => c[k] || 0, e = out[d].errors, f = out[d].facilitator;
      e.facilitator_no_answer = g('verify_error') + g('settle_error'); e.facilitator_down = g('verify_down') + g('settle_down'); e.facilitator_no_verdict = g('verify_noverdict') + g('settle_noverdict');
      e.settlement_failed = g('settle_failed'); e.chain_reads_failed = g('chain_errors'); e.chain_rereads_failed = g('chain_reread_failed'); e.chain_day_rereads_given_up = g('chain_day_reread_given_up'); e.chain_day_rereads_dropped = g('chain_day_reread_dropped');
      f.reached = g('verify_ok') + g('verify_refused') + g('verify_noverdict') + g('settle_ok') + g('settle_failed') + g('settle_noverdict') + g('probe_ok');
      f.missed = g('verify_error') + g('verify_down') + g('settle_error') + g('settle_down') + g('probe_failed'); f.payments_refused = g('verify_refused');
    }
    const l = payWatch.last(), lastProbeIso = lastProbe ? iso(lastProbe) : null;
    return { version: BOOKS_VERSION, at: iso(t), days: list.map((d) => ({ day: d, ...out[d] })),
      now: { facilitator: { url: facilitator || null, reachable: l.reached || l.missed ? (Date.parse(l.reached || '') || 0) >= (Date.parse(l.missed || '') || 0) : null, last_reached: l.reached, last_missed: l.missed, last_probe: lastProbeIso }, books: await sync(), ledger: await summary() },
      notes: ['till: the sales this node holds in memory since it started (the database keeps all; /treasury)', 'toll: the accounts of the networks (kept to the end of the next day, 33 days with a toll) and the toll\'s own books (a payment 3 days after it ended, daily totals 40 days)', 'errors and the facilitator: counted on this node, kept 400 days', 'ledger: every incoming USDC transfer to the wallet, from the chain; unmatched may be other payments to the same wallet'] };
  }
  // the counts /status.json shows: numbers only, no address, no transaction, no sum (computed at most once a minute)
  let cnt = null, cntAt = 0, cntP = null;
  async function counts({ declKv = kv } = {}) {
    if (cnt && now() - cntAt < 60_000) return cnt;
    cntP ||= (async () => {
      try {
        const g = await digest({ days: 14, declKv }), today = g.days[0], s = g.now.ledger, b = g.now.books;
        const c = { day: today.day, ledger_transfers: s.transfers, ledger_transfers_today: today.ledger.transfers, ledger_unmatched: s.unmatched, ledger_flagged: s.flagged, ledger_behind_blocks: b.behind_blocks,
          tolled_answers_today: today.toll.tolled_answers, toll_payments_settled_today: today.toll.settled.payments, toll_payments_on_their_way: g.days.reduce((x, d) => x + d.toll.on_its_way.payments, 0),
          till_sales_today: today.till.sales, fair_payments_today: today.fair.payments, payment_path_errors_today: Object.values(today.errors).reduce((x, v) => x + v, 0),
          facilitator_reached_today: today.facilitator.reached, facilitator_missed_today: today.facilitator.missed,
          declarations_today: today.declarations.withdrawals + today.declarations.cancellations, declarations_without_receipt: g.days.reduce((x, d) => x + d.declarations.open_without_receipt, 0) };
        cnt = c; cntAt = now(); return c;
      } finally { cntP = null; }
    })();
    const p = cntP;
    return Promise.race([p, new Promise((r) => { const tm = setTimeout(() => r(cnt), 500); tm.unref?.(); })]).catch(() => cnt);
  }

  return {
    on, wallet: W, pass, entries, summary, sync, about, digest, counts,
    // the first pass now (behind the start), then on its own timer; the timer keeps no process alive
    start() { stopped = false; if (!on) return Promise.resolve({ off: true }); const p = pass().catch(() => ({})); p.then((r) => schedule(r?.error ? waitUntilMs - now() : r?.behind > 0 ? catchUpMs : everyMs)); return p; },
    stop() { stopped = true; if (timer) { clearTimeout(timer); timer = null; } return running || Promise.resolve(); },
    state: () => ({ on, running: !!running, step, rev, waiting: Math.max(0, waitUntilMs - now()) }),
  };
}

// ------------------------------------------------------------------ the operator's doors: the key, or 403
const J = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' };
export async function booksAnswer({ req, url, path, books, declKv, keySha }) {
  if (!operatorKeyOk(req, keySha || undefined)) return new Response(JSON.stringify({ error: { code: 'PERMISSION_DENIED', message: 'operator key required (header x-mare-mod)' } }), { status: 403, headers: J });
  if (path === '/operator/digest') return new Response(JSON.stringify(await books.digest({ days: url.searchParams.get('days') || 7, declKv })), { status: 200, headers: J });
  const from = okDay(url.searchParams.get('from')), to = okDay(url.searchParams.get('to'));
  const list = await books.entries({ from, to });
  if (path === '/operator/ledger.csv') return new Response(ledgerCsv(list), { status: 200, headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="mare-ledger-${from || 'start'}-${to || 'today'}.csv"`, 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
  return new Response(JSON.stringify({ ...(await books.about()), from, to, entries: list }), { status: 200, headers: J });
}
