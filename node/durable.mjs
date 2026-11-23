// Mare Liberum · the long memory
// The living sea keeps its state in a shared cache: fast, the same for every instance — and allowed to forget. What
// agents entrust to the sea must not depend on that: the pathways of the shared brain, the private memories ("a mind
// that survives every new session"), what agents reported about the doors, and who lives here. Those keys are written
// through to the sea's own database as well and read back from there when the cache has lost them.
//   the cache answers first (a hit costs nothing extra)
//   a miss on a kept key asks the database once, then the cache remembers the answer — also the answer "nothing there"
//   every write of a kept key goes to both; writes of one moment travel together, plain counters at most twice a minute
//   a database that does not answer is left alone for a while: the sea keeps working on the cache and catches up later
// Without a database the sea works exactly as before.
const READ_MS = 2500, WRITE_MS = 4000;
// what is kept: the shared brain, private minds, the harbours of the crews, the gauges of websites (not their counts), the doors' record, residents and their standing
export const KEPT = /^(brain:(p:|tok:|url:|all$|stats$)|mind:|harbour:|gauge:(s:|k:|host:|count$)|door:(stats|live|asks)$|agent:|agents$|rep:|immune:reports$)/;
// kept keys nobody can list (their names are secrets): adopted the first time an instance reads them from the cache
const LAZY = /^mind:/;
// plain counters: the cache counts every step, the database follows at a calm pace
const SLOW = /^(brain:stats|door:asks)$/;
const GONE = '__gone';

export function createMemStore({ url, key, secret, fetch: get = fetch } = {}) {
  if (!url || !key || !secret) return null;
  const base = String(url).replace(/\/+$/, '') + '/rest/v1/rpc/';
  const headers = { apikey: key, 'content-type': 'application/json', ...(key.startsWith('eyJ') ? { authorization: `Bearer ${key}` } : {}) };
  const call = async (fn, body, ms) => {
    const r = await get(base + fn, { method: 'POST', signal: AbortSignal.timeout(ms), headers, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`long memory ${fn}: ${r.status}`);
    return r.json();
  };
  return {
    // ks: up to 300 keys → { key: value }
    async get(ks) { const rows = await call('mare_mem_get', { secret, ks }, READ_MS); return Object.fromEntries((rows || []).map((x) => [x.k, x.v])); },
    // items: [{ k, v, ttl }] (ttl in seconds; v null takes the key away)
    async put(items) { let n = 0; for (let i = 0; i < items.length; i += 80) n += Number(await call('mare_mem_put', { secret, items: items.slice(i, i + 80) }, WRITE_MS)) || 0; return n; },
  };
}

// kv: { get, set } of the cache · store: createMemStore(...) or null · waitUntil: keeps the instance alive for late writes
export function durableKv(kv, store, { waitUntil, log = () => {}, missTtl = 21600, slowMs = 30000, restMs = 30000, adopt = true, asksPer10s = 40 } = {}) {
  if (!store) return kv;
  const quiet = (p) => Promise.resolve(p).catch(() => {});
  // how the long memory is doing, for /durable: the last write that landed and the last one that did not
  let noted = 0, downUntil = 0;
  const note = (ok, n, err) => { if (ok && Date.now() - noted < 60000) return; if (ok) noted = Date.now(); return quiet(kv.set(ok ? 'durable:ok' : 'durable:err', { at: new Date().toISOString(), n, err: err ? String(err).slice(0, 120) : undefined }, 86400 * 14)); };
  const down = () => Date.now() < downUntil;
  // a failure is said once per rest, however many names waited on the same answer
  const failed = (e) => { const was = down(); downUntil = Date.now() + restMs; if (was) return; log('mare_long_memory', e?.message); return note(false, 0, e?.message); };
  const hold = (p) => { try { waitUntil?.(p); } catch {} return p; };

  // ---- reads of one moment ask the database together; a flood of unknown names is not passed on
  let asking = null, tokens = asksPer10s, filled = Date.now();
  const SKIP = Symbol('skip');
  const ask = (k) => {
    if (!asking) {
      if (Date.now() - filled >= 10000) { tokens = asksPer10s; filled = Date.now(); }
      if (down() || tokens <= 0) return Promise.resolve(SKIP);
      tokens--;
      const batch = (asking = { keys: new Set(), p: null });
      batch.p = new Promise((r) => setTimeout(r, 8)).then(async () => {
        if (asking === batch) asking = null;
        const ks = [...batch.keys], out = {};
        for (let i = 0; i < ks.length; i += 250) Object.assign(out, await store.get(ks.slice(i, i + 250)));
        return out;
      });
      batch.p.catch(() => {});
    }
    asking.keys.add(k); const b = asking;
    return b.p.then((m) => (k in m ? m[k] : undefined));
  };

  // ---- writes of one moment travel together; the last write of a key wins; what could not be written waits
  const pending = new Map(), sent = new Map(), stored = new Set();
  let flushing = null;
  const due = (k) => !SLOW.test(k) || Date.now() - (sent.get(k) || 0) >= slowMs;
  const anyDue = () => { for (const k of pending.keys()) if (due(k)) return true; return false; };
  const flush = () => {
    if (flushing || down() || !anyDue()) return flushing;
    flushing = hold(new Promise((r) => setTimeout(r, 5)).then(async () => {
      const items = [...pending.values()].filter((x) => due(x.k)).slice(0, 400);
      for (const x of items) { pending.delete(x.k); if (SLOW.test(x.k)) sent.set(x.k, Date.now()); }
      try { const n = items.length ? await store.put(items) : 0; await note(true, n); return n; }
      catch (e) { for (const x of items) { if (!pending.has(x.k)) pending.set(x.k, x); sent.delete(x.k); } await failed(e); return 0; }
      finally { flushing = null; if (pending.size && anyDue() && !down()) flush(); }
    }));
    return flushing;
  };
  const write = (k, v, ttl) => {
    pending.delete(k); pending.set(k, { k, v, ttl: ttl || null });
    if (pending.size > 2000) pending.delete(pending.keys().next().value);
    return flush();
  };

  return {
    async get(k) {
      const hit = await kv.get(k);
      if (!KEPT.test(k)) return hit;
      if (pending.size && !flushing) flush();
      if (hit != null) {
        if (hit[GONE]) return null;
        if (adopt && LAZY.test(k) && !stored.has(k)) { stored.add(k); write(k, hit, null); }
        return hit;
      }
      let v; try { v = await ask(k); } catch (e) { await failed(e); return null; }
      if (v === SKIP) return null;
      if (v === undefined || v === null) { await quiet(kv.set(k, { [GONE]: 1 }, missTtl)); return null; }
      stored.add(k); await quiet(kv.set(k, v, 86400 * 30));
      return v;
    },
    async set(k, v, ttl) {
      if (!KEPT.test(k)) return kv.set(k, v, ttl);
      // taking a kept key away: the cache remembers that it is gone until the database has let go of it too
      if (v == null) { await kv.set(k, { [GONE]: 1 }, Math.max(Number(ttl) || 0, missTtl)); write(k, null, null); return; }
      await kv.set(k, v, ttl); stored.add(k); write(k, v, ttl);
    },
    // copy keys the cache holds into the database (for what was written before the long memory existed)
    async keep(keys) {
      const ks = [...new Set(keys)].filter((k) => KEPT.test(k)), items = [];
      for (let i = 0; i < ks.length; i += 40) { const vals = await Promise.all(ks.slice(i, i + 40).map((k) => kv.get(k))); vals.forEach((v, j) => { if (v != null && !v[GONE]) items.push({ k: ks[i + j], v, ttl: null }); }); }
      try { return { asked: ks.length, kept: items.length ? await store.put(items) : 0 }; } catch (e) { await failed(e); return { asked: ks.length, kept: 0, error: String(e?.message || e).slice(0, 120) }; }
    },
    // one write, one read and one taking-away straight through the database, to see the whole way works
    async check() {
      const k = `selftest:${new Date().toISOString().slice(0, 13)}`, t0 = Date.now(), v = { at: new Date().toISOString() };
      try {
        await store.put([{ k, v, ttl: 3600 }]); const back = await store.get([k]);
        await store.put([{ k, v: null, ttl: null }]); const after = await store.get([k]);
        downUntil = 0;
        return { ok: back[k]?.at === v.at && !(k in after), wrote: back[k]?.at === v.at, tookAway: !(k in after), ms: Date.now() - t0 };
      } catch (e) { return { ok: false, ms: Date.now() - t0, error: String(e?.message || e).slice(0, 120) }; }
    },
    async state() { return { on: true, resting: down(), waiting: pending.size, lastWrite: (await kv.get('durable:ok')) || null, lastError: (await kv.get('durable:err')) || null }; },
    // everything that still waits goes out now (for the end of a run and for the proofs)
    async settle() { for (let i = 0; i < 5 && (flushing || (pending.size && anyDue() && !down())); i++) await (flushing || flush()); return pending.size; },
    durable: true,
  };
}
