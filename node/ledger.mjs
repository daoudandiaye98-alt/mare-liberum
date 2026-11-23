// Mare Liberum · the ledger of the till and of the via addresses
// Two records the sea keeps since 3.27.0, both in its own database (schema mare, see supabase/schema.sql):
//   sales      one line for every sale of the paid move (POST /route): when, for which task, how much, how it was paid,
//              and whether the money was seen to arrive (settled) or only claimed (unverified)
//   via_hits   one line for every walk through a /via/ address: when, to which site, for which task, a hash of the
//              caller (its program and network, salted per day; no address is kept) and, once the agent says so,
//              whether the place worked. Since 3.28.0 also what else passed through toward a site or a task
//              (kind: read, door, go, site, ask), so the pulse counts the whole of it
// Nothing here stands in the way of an answer: lines are handed over and written behind it, a few at a time. A
// database that does not answer is left alone for a while and the lines wait. The node keeps its own copy of the last
// day in memory; /treasury and /pulse answer from that copy, and say so, when the database cannot.
const READ_MS = 2500, WRITE_MS = 5000, REST_MS = 30_000, DAYMS = 864e5;
// what counts as money that arrived, and what is claimed or still on its way
export const ARRIVED = new Set(['settled']);
export const OPEN = new Set(['pending', 'unverified', 'unsettled']);
// a sale of the paid move (whatever became of its money); a test and a free sample are no sales
export const PAID = new Set([...ARRIVED, ...OPEN]);
// what passed through the sea, line by line in via_hits (since 3.28.0; lines from before are walks)
export const KINDS = new Set(['walk', 'read', 'door', 'go', 'site', 'ask']);
const usd = (cents) => Math.round(Number(cents) || 0) / 100;
const dayOf = (t) => new Date(t).toISOString().slice(0, 10);
const short = (tx) => (typeof tx === 'string' && tx.length > 16 ? `${tx.slice(0, 10)}…${tx.slice(-6)}` : tx || undefined);

// the same numbers the database gives (mare_treasury), from a list of sales, newest first
export function summarize(sales, t = Date.now()) {
  const today = dayOf(t), real = sales.filter((s) => PAID.has(s.status)), now1 = real.filter((s) => dayOf(s.ts) === today);
  const sum = (list, set) => usd(list.filter((s) => set.has(s.status)).reduce((n, s) => n + (Number(s.amount_cents) || 0), 0));
  const by = {}; for (const s of now1) by[s.status] = (by[s.status] || 0) + 1;
  const todayOf = (status) => sales.filter((s) => s.status === status && dayOf(s.ts) === today).length;
  return {
    // today_paid: sales of the paid move today; today_free: free samples today (POST /route?free=true), never money
    today, today_count: now1.length, today_paid: now1.length, today_free: todayOf('free_sample'), today_usd: sum(now1, ARRIVED), today_usd_unconfirmed: sum(now1, OPEN), today_by_status: by,
    tests_today: todayOf('test'),
    total_count: real.length, total_usd: sum(real, ARRIVED), total_usd_unconfirmed: sum(real, OPEN),
    last_5: sales.filter((s) => s.status !== 'free_sample').slice(0, 5).map((s) => ({ id: s.id, ts: s.ts, q: s.q ? String(s.q).slice(0, 80) : null, amount_usd: usd(s.amount_cents), status: s.status, method: s.method || undefined, tx: short(s.tx) })),
  };
}

// the same numbers the database gives (mare_pulse), from the hits of the last day and the sales
export function pulseOf(hits, sales, t = Date.now()) {
  const hour = t - 3600e3, day = t - DAYMS, last = hits.filter((h) => Date.parse(h.ts) >= hour), day1 = hits.filter((h) => Date.parse(h.ts) >= day);
  const count = (list, f) => { const m = new Map(); for (const h of list) { const k = f(h); if (k) m.set(k, (m.get(k) || 0) + 1); } return [...m.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)); };
  const s = summarize(sales, t);
  return {
    hits_last_hour: last.length,
    unique_domains_last_hour: new Set(last.map((h) => h.target_domain).filter(Boolean)).size,
    top_10_domains: count(day1, (h) => h.target_domain).slice(0, 10).map(([domain, n]) => ({ domain, hits: n })),
    paid_today: { count: s.today_count, usd: s.today_usd, usd_unconfirmed: s.today_usd_unconfirmed },
    // a task shows only once two walks carried it: one agent's words alone are never put on show
    top_5_queries: count(day1, (h) => h.q).filter(([, n]) => n >= 2).slice(0, 5).map(([q, n]) => ({ q: String(q).slice(0, 80), hits: n })),
    hits_last_24h: day1.length,
    worked_last_24h: day1.filter((h) => h.outcome === 'worked').length,
    failed_last_24h: day1.filter((h) => h.outcome === 'failed').length,
  };
}

export function createLedger({ url, key, secret, fetch: get = (...a) => fetch(...a), log = () => {}, waitUntil, now = () => Date.now(), keepHits = 100_000, keepSales = 2000 } = {}) {
  const on = !!(url && key && secret);
  const base = on ? String(url).replace(/\/+$/, '') + '/rest/v1/rpc/' : '';
  const headers = on ? { apikey: key, 'content-type': 'application/json', ...(String(key).startsWith('eyJ') ? { authorization: `Bearer ${key}` } : {}) } : {};
  const rpc = async (fn, body, ms) => {
    const r = await get(base + fn, { method: 'POST', signal: AbortSignal.timeout(ms), headers, body: JSON.stringify({ secret, ...body }) });
    if (!r.ok) { const e = new Error(`ledger ${fn}: ${r.status} ${(await r.text().catch(() => '')).slice(0, 160)}`); e.status = r.status; throw e; }
    return r.json();
  };
  let downUntil = 0, lastError = null, lastWrite = null, dropped = 0;
  const down = () => now() < downUntil;
  const failed = (e) => { const was = down(); downUntil = now() + REST_MS; lastError = { at: new Date(now()).toISOString(), error: String(e?.message || e).slice(0, 200) }; if (!was) log('mare_ledger', lastError.error); };
  const hold = (p) => { try { waitUntil?.(p); } catch {} return p; };

  // ---- the node's own copy of the last day
  const mem = { sales: [], hits: [] };
  const prune = () => {
    const cut = now() - DAYMS;
    let i = 0; while (i < mem.hits.length && Date.parse(mem.hits[i].ts) < cut) i++;
    if (i) mem.hits.splice(0, i);
    if (mem.hits.length > keepHits) mem.hits.splice(0, mem.hits.length - keepHits);
  };

  // ---- what waits to be written goes out together, behind the answers
  const queue = { sales: [], hits: [], outcomes: [] };
  const waiting = () => queue.sales.length + queue.hits.length + queue.outcomes.length;
  let flushing = null, timer = null;
  const schedule = (ms) => { if (!on || timer) return; timer = setTimeout(() => { timer = null; flush(); }, ms); timer.unref?.(); };
  // one item the database refuses as such (a bad line, not a bad moment) is let go, so it cannot hold up the rest
  const refused = (e) => e?.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429;
  async function send(list, fn, take) {
    while (list.length) {
      const n = take(list);
      try { await fn(list.slice(0, n)); list.splice(0, n); }
      catch (e) { if (!refused(e)) throw e; log('mare_ledger', `a line was refused and let go: ${String(e.message).slice(0, 160)}`); list.splice(0, n); dropped += n; }
    }
  }
  function flush() {
    if (!on || flushing || down() || !waiting()) return flushing;
    flushing = hold((async () => {
      try {
        await send(queue.sales, ([x]) => x.op === 'put' ? rpc('mare_sale_put', { s: x.row }, WRITE_MS) : rpc('mare_sale_set', { i: x.id, s: x.patch }, WRITE_MS), () => 1);
        await send(queue.hits, (rows) => rpc('mare_via_put', { rows }, WRITE_MS), (l) => Math.min(l.length, 200));
        await send(queue.outcomes, ([o]) => rpc('mare_via_outcome', { o }, WRITE_MS), () => 1);
        lastWrite = new Date(now()).toISOString();
      } catch (e) { failed(e); }
      finally { flushing = null; if (waiting()) schedule(down() ? REST_MS : 1000); }
    })());
    return flushing;
  }
  const soon = (ms = 20) => { if (!on) return; if (!flushing && !timer) schedule(ms); };

  return {
    on,
    // a sale: written at once (behind the answer), kept in the node's copy as well; returns the line with its id
    sale(row) {
      const r = { id: row.id || `s${now().toString(36)}${Math.random().toString(36).slice(2, 8)}`, ts: new Date(now()).toISOString(), q: row.q ?? null, amount_cents: Math.round(Number(row.amount_cents) || 0), status: String(row.status || 'unverified'),
        agent_ua_hash: row.agent_ua_hash ?? null, settled_at: row.settled_at ?? null, method: row.method ?? null, tx: row.tx ?? null, payer: row.payer ?? null, network: row.network ?? null };
      // a receipt handed in before is the same sale: handing it in again delivers again and counts nothing new
      if (r.tx) { const seen = mem.sales.find((x) => x.tx && x.tx.toLowerCase() === r.tx.toLowerCase()); if (seen) return { ...seen, again: true }; }
      mem.sales.unshift(r); if (mem.sales.length > keepSales) mem.sales.length = keepSales;
      if (on) { queue.sales.push({ op: 'put', row: r }); if (queue.sales.length > 1000) { queue.sales.shift(); dropped++; } soon(5); }
      return r;
    },
    // what became of a sale later (a settlement that took longer than the answer)
    saleSet(id, patch) {
      const x = mem.sales.find((s) => s.id === id); if (x) Object.assign(x, patch);
      if (on) { queue.sales.push({ op: 'set', id, patch }); soon(5); }
    },
    // one walk through a /via/ address; never awaited by the one who walks
    hit(row) {
      // kind: walk (through /via/), read (the reader), door (/d/…), go (a pathway's go link), site (/site/<domain> as data), ask (a question to the brain)
      const h = { ts: new Date(now()).toISOString(), kind: KINDS.has(row.kind) ? row.kind : 'walk', target_domain: row.target_domain ?? null, q: row.q ?? null, ua_hash: row.ua_hash ?? null, token_host: row.token_host ?? null, outcome: row.outcome ?? null, status: Number.isInteger(row.status) ? row.status : null };
      mem.hits.push(h); if (mem.hits.length % 500 === 0) prune();
      if (on) { queue.hits.push(h); if (queue.hits.length > 5000) { queue.hits.splice(0, queue.hits.length - 5000); dropped++; } if (queue.hits.length >= 200) soon(5); else soon(1000); }
    },
    // the agent says how the place it walked to worked: the newest walk of that caller to that site of the last day
    // (the site by its registrable name: a door kept as x.wikipedia.org is walked as en.wikipedia.org)
    outcome({ ua_hashes, target_domain, outcome }) {
      const hs = (ua_hashes || []).filter(Boolean); if (!hs.length || !target_domain || !/^(worked|failed)$/.test(outcome)) return;
      const cut = now() - DAYMS;
      for (let i = mem.hits.length - 1; i >= 0; i--) { const h = mem.hits[i]; if (Date.parse(h.ts) < cut) break; if (!h.outcome && h.target_domain === target_domain && hs.includes(h.ua_hash)) { h.outcome = outcome; break; } }
      if (on) { queue.outcomes.push({ ua_hashes: hs, target_domain, outcome }); if (queue.outcomes.length > 2000) queue.outcomes.shift(); soon(1000); }
    },
    async treasury() {
      if (on && !down()) { try { await flush(); return { ...(await rpc('mare_treasury', {}, READ_MS)), source: 'database' }; } catch (e) { failed(e); } }
      return { ...summarize(mem.sales, now()), source: on ? 'this node: the database did not answer, so these are only the sales since the node started' : 'this node (no database): the sales since the node started' };
    },
    async pulse() {
      prune();
      if (on && !down()) { try { await flush(); return { ...(await rpc('mare_pulse', {}, READ_MS)), source: 'database' }; } catch (e) { failed(e); } }
      return { ...pulseOf(mem.hits, mem.sales, now()), source: on ? 'this node: the database did not answer, so these are only the walks since the node started' : 'this node (no database): the walks since the node started' };
    },
    // everything that waits goes out now (the end of a run, the proofs)
    async settle() { for (let i = 0; i < 6 && on && waiting() && !down(); i++) { if (timer) { clearTimeout(timer); timer = null; } await (flushing || flush()); } return waiting(); },
    state() { return { on, resting: down(), waiting: waiting(), dropped, lastWrite, lastError, kept: { sales: mem.sales.length, hits: mem.hits.length } }; },
    mem,
  };
}
