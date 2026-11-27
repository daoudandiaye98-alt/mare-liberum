// Mare Liberum · one call, one key (since 3.78): the session of an agent that comes without a wallet
// An agent that arrives without an account, a wallet or a person to ask gets everything it needs from one call:
//   open     POST /session (no body needed) answers 201 with a key mls_ and 192 random bits (base64url), shown once. The sea
//            keeps only its SHA-256; the first 24 hex of it are the session's public id. The key carries probe calls (20, for
//            7 days) for the paid doors that answer one task each: /x402/deal, /x402/check, /x402/read and POST /route.
//   use      Authorization: Bearer mls_… (or x-sea-session: mls_…) on one of those doors, sent without a payment: one probe
//            call is taken before the work and given back when the work brought nothing (no product, no site, no page, no
//            path), as the paid doors charge only for a result. A payment sent with the key wins: the key is not looked at.
//   empty    with no probe call left the door answers as it always does without a payment: 402 with its x402 terms, so an
//            agent with a wallet pays on; the answer says how many calls are left (x-sea-session-left: 0).
//   bookmark GET /session/<id>: what is left, until when, the last calls (door and time only), the callback's state. No key
//            needed and none shown: the id is the bookmark, the key stays the secret. GET /session with the key: the same.
//   callback callback_url (https, a public host by name, port 443) is kept with the session and never called by this release:
//            nothing is sent anywhere before the host has proved it wants the calls (a later release, the broadcast).
//   limits   per session 30 calls a minute (429 with Retry-After and the batch door); per network 10 new sessions a UTC day;
//            the whole sea gives at most 2,000 probe calls a UTC day (then the doors answer 402 until the next UTC day).
//   errors   401 a key the sea does not know or cannot read; 410 a key past its 30 days, with the alternatives; 429 with
//            Retry-After; 501 for a method /session does not have, with the call that does it.
//   supply   (since 3.81) every answer to a call with a key says calls_left and calls_used (take, back and refusals give both);
//            at 3 and at 0 calls left the door adds way_out: the rest filled up again for 0.02 USDC, the same key
//   topup    (since 3.81) topup(h, sale): the probe calls back to 20 for 7 more days and the key 30 more days, the same key and
//            id; only after a payment the till took (POST /route?a=topup), never twice for one sale; the key's paid days are
//            counted (session:paid:<day>, each key once a day) for the open numbers
//   grace    (since 3.82) a key whose probe calls are spent gets one taste at the route before the 402: grace(h) marks it once
//            for this round of probe calls (a topup starts a new round); the door then answers 200 with the first 3 paths
//   never    a key in clear anywhere (state, books, logs, answers after the first); a probe call spent twice or for nothing;
//            money: probe calls are no sale, the till's books stay as they are; a call to a callback.
// The state lives in the node's state (session:…), like the reader credit (node/credit.mjs): no table, no migration. The
// count of new sessions per network lies under an HMAC of the network with a key of the day (as the toll's accounts do).
import { createHash, createHmac, hkdfSync, randomBytes } from 'node:crypto';

export const SESSION = Object.freeze({ prefix: 'mls_', probe: 20, probeDays: 7, days: 30, perMinute: 30, perNetDay: 10, probeDay: 2000, last: 10 });
export const SESSION_RE = /^mls_[A-Za-z0-9_-]{32}$/;
export const SESSION_DOORS = Object.freeze(['deal', 'check', 'read', 'route', 'pack']);
export const SESSION_EXPOSE = 'x-sea-session-left,x-sea-session';
const DAY = 86_400, ID_RE = /^[0-9a-f]{24}$/;
export const sessionHash = (key) => createHash('sha256').update(String(key)).digest('hex');
const idOf = (h) => String(h).slice(0, 24);
const dayOf = (t) => new Date(t).toISOString().slice(0, 10);
const untilDay = (t) => Math.max(1, Math.ceil((Date.parse(`${dayOf(t)}T00:00:00Z`) + DAY * 1000 - t) / 1000));

// the key a request carries: x-sea-session, else an Authorization whose bearer starts with mls_. Any other Authorization (a
// Firecrawl key, the reader credit mlc_) is not this module's. → null (no key) · { bad } (a key of the wrong form) · { h, id }
export function sessionOf(headers) {
  const own = headers?.get?.('x-sea-session'), auth = headers?.get?.('authorization');
  let raw = own != null ? String(own).trim() : null;
  if (raw == null && auth != null) { const m = /^Bearer\s+(mls_\S*)\s*$/i.exec(String(auth).trim()); if (m) raw = m[1]; }
  if (raw == null || raw === '') return null;
  if (!SESSION_RE.test(raw)) return { bad: 'the session key could not be read: it is mls_ and 32 characters of base64url, as POST /session gave it' };
  const h = sessionHash(raw);
  return { h, id: idOf(h) };
}

// a callback the sea may keep: https, a public host by name (no address, no local names), port 443, no user or password
const LOCAL = /(^|\.)(localhost|local|localdomain|internal|intranet|lan|home|corp|private|arpa|test|invalid|onion)$/i;
export function callbackOf(raw) {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  if (s.length > 300) return { bad: 'callback_url is longer than 300 characters' };
  let u; try { u = new URL(s); } catch { return { bad: 'callback_url is not an address' }; }
  if (u.protocol !== 'https:') return { bad: 'callback_url must use https' };
  if (u.username || u.password) return { bad: 'callback_url may not carry a user or password' };
  if (u.port && u.port !== '443') return { bad: 'callback_url must use the port of https (443)' };
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[') || host.includes(':')) return { bad: 'callback_url must name a host, not an address' };
  if (!host.includes('.') || LOCAL.test(host) || host.length > 253 || !/^[a-z0-9.-]+$/.test(host) || host.split('.').some((l) => !l || l.length > 63 || l.startsWith('-') || l.endsWith('-'))) return { bad: 'callback_url must name a public host' };
  u.hash = '';
  return { url: u.toString(), host };
}
// what an agent may call itself: letters, digits and a few signs, 60 at most; anything else is dropped
const agentOf = (v) => { const s = String(v ?? '').replace(/[^A-Za-z0-9 ._/()+:-]/g, '').trim().slice(0, 60); return s || null; };

export function createSessions({ kv, now = () => Date.now(), secret = randomBytes(32) }) {
  const chains = new Map(), dayKeys = new Map();
  // the network is never written down: its count of new sessions lies under an HMAC of the network with a key of the day
  const dayKey = (day) => { let k = dayKeys.get(day); if (!k) { k = Buffer.from(hkdfSync('sha256', secret, 'mare-session-v1', day, 32)); dayKeys.set(day, k); if (dayKeys.size > 8) dayKeys.delete(dayKeys.keys().next().value); } return k; };
  const netOf = (day, net) => createHmac('sha256', dayKey(day)).update(String(net)).digest('hex').slice(0, 24);
  // one after the other per key: two calls with the same key never both take the last probe call
  const serial = (k, fn) => { const prev = chains.get(k) || Promise.resolve(); const run = prev.then(fn, fn); const tail = run.then(() => {}, () => {}); chains.set(k, tail); tail.then(() => { if (chains.get(k) === tail) chains.delete(k); }); return run; };
  const R = (id) => `session:${id}`, ttlOf = (rec) => Math.max(DAY, Math.ceil((Date.parse(rec.until) - now()) / 1000) + DAY);
  const count = (k, d, ttl) => serial(k, async () => { const n = Math.max(0, (Number(await kv.get(k)) || 0) + d); await kv.set(k, n, ttl); return n; });
  const state = (rec, t = now()) => (!rec ? 'unknown' : Date.parse(rec.until) <= t ? 'expired' : 'ok');
  const doc = (rec, t = now()) => ({
    id: rec.id, opened: rec.at, expires: rec.until, state: state(rec, t),
    probe: { calls: rec.probe.n, left: Date.parse(rec.probe.until) <= t ? 0 : rec.probe.left, until: rec.probe.until, doors: SESSION_DOORS },
    calls: rec.calls, last: rec.last.map((c) => ({ door: c.door, at: c.at, ...(c.back ? { given_back: true } : {}) })),
    ...(rec.topups?.length ? { topups: rec.topups.map((x) => ({ at: x.at, status: x.status })) } : {}),
    ...(rec.agent ? { agent: rec.agent } : {}),
    callback: rec.cb ? { host: rec.cb.host, state: 'kept, not called: calls start once the host proves it wants them' } : null,
  });
  return {
    // a new session: { key, id, doc } or { refuse: { status, retry, message } }
    async open({ net = 'unknown', callback = null, agent = null } = {}) {
      const t = now(), day = dayOf(t);
      const cb = callbackOf(callback); if (cb?.bad) return { refuse: { status: 422, message: cb.bad } };
      const nk = `session:net:${day}:${netOf(day, net)}`;
      const n = await count(nk, 1, 2 * DAY);
      if (n > SESSION.perNetDay) { await count(nk, -1, 2 * DAY); return { refuse: { status: 429, retry: untilDay(t), message: `this network opened ${SESSION.perNetDay} sessions today (UTC); the next can be opened tomorrow. A key lasts ${SESSION.days} days: keep the one you have` } }; }
      const given = Number(await kv.get(`session:probe:${day}`)) || 0;
      const key = `${SESSION.prefix}${randomBytes(24).toString('base64url')}`, h = sessionHash(key), id = idOf(h);
      const probe = SESSION.probe;
      const rec = { v: 1, h, id, at: new Date(t).toISOString(), until: new Date(t + SESSION.days * DAY * 1000).toISOString(), probe: { n: probe, left: probe, until: new Date(t + SESSION.probeDays * DAY * 1000).toISOString() }, calls: 0, last: [], rate: { m: 0, n: 0 }, ...(agentOf(agent) ? { agent: agentOf(agent) } : {}), ...(cb ? { cb: { url: cb.url, host: cb.host, at: new Date(t).toISOString() } } : {}) };
      await serial(id, () => kv.set(R(id), rec, ttlOf(rec)));
      await count(`session:open:${day}`, 1, 2 * DAY);
      return { key, id, doc: doc(rec, t), budget: given >= SESSION.probeDay };
    },
    // one probe call for one door: { ok, left, id, until } or { ok: false, why: unknown | expired | slow | empty, retry?, budget? }
    take(h, door) {
      const id = idOf(h);
      return serial(id, async () => {
        const t = now(), rec = await kv.get(R(id));
        if (!rec || rec.h !== h) return { ok: false, why: 'unknown' };
        if (Date.parse(rec.until) <= t) return { ok: false, why: 'expired', until: rec.until, left: 0, used: rec.calls };
        const m = Math.floor(t / 60_000);
        if (rec.rate?.m === m && rec.rate.n >= SESSION.perMinute) return { ok: false, why: 'slow', retry: Math.max(1, Math.ceil(((m + 1) * 60_000 - t) / 1000)), left: Date.parse(rec.probe.until) <= t ? 0 : rec.probe.left, used: rec.calls };
        if (!(rec.probe.left > 0) || Date.parse(rec.probe.until) <= t) return { ok: false, why: 'empty', id, left: 0, used: rec.calls };
        const day = dayOf(t), gk = `session:probe:${day}`;
        const g = await count(gk, 1, 2 * DAY);
        if (g > SESSION.probeDay) { await count(gk, -1, 2 * DAY); return { ok: false, why: 'empty', budget: true, id, left: rec.probe.left, used: rec.calls }; }
        rec.probe.left -= 1; rec.calls += 1; rec.rate = { m, n: rec.rate?.m === m ? rec.rate.n + 1 : 1 };
        const tag = randomBytes(6).toString('hex');
        rec.last = [{ door: String(door).slice(0, 16), at: new Date(t).toISOString(), day, tag }, ...rec.last].slice(0, SESSION.last);
        await kv.set(R(id), rec, ttlOf(rec));
        return { ok: true, left: rec.probe.left, used: rec.calls, id, until: rec.probe.until, tag, day };
      });
    },
    // the work brought nothing: the probe call that take() gave comes back, by its mark (never above what the session was
    // given, never twice; also when ten newer calls have pushed it out of the list of the last calls)
    back(h, taken) {
      const id = idOf(h), tag = String(taken?.tag || '');
      if (!/^[0-9a-f]{12}$/.test(tag)) return Promise.resolve({ ok: false });
      return serial(id, async () => {
        const rec = await kv.get(R(id)); if (!rec || rec.h !== h) return { ok: false };
        const c = rec.last.find((x) => x.tag === tag);
        if (c?.back || (rec.backs || []).includes(tag)) return { ok: false };
        if (c) c.back = true; else rec.backs = [tag, ...(rec.backs || [])].slice(0, 50);
        rec.probe.left = Math.min(rec.probe.n, rec.probe.left + 1); rec.calls = Math.max(0, rec.calls - 1);
        await kv.set(R(id), rec, ttlOf(rec));
        await count(`session:probe:${c?.day || taken.day || dayOf(now())}`, -1, 2 * DAY);
        return { ok: true, left: rec.probe.left, used: rec.calls };
      });
    },
    // (since 3.82) the topups of a key as the state keeps them ({ at, sale, status, before }), for the checks of a receipt
    async topups(h) { const rec = await kv.get(R(idOf(h))); return rec && rec.h === h && Array.isArray(rec.topups) ? rec.topups : []; },
    // (since 3.82) one taste after the trial: { ok, used } once per round of probe calls of an empty key, else { ok: false }
    grace(h) {
      const id = idOf(h);
      return serial(id, async () => {
        const t = now(), rec = await kv.get(R(id));
        if (!rec || rec.h !== h || Date.parse(rec.until) <= t) return { ok: false };
        if (rec.probe.left > 0 && Date.parse(rec.probe.until) > t) return { ok: false };
        const round = rec.round || 0;
        if (rec.grace === round) return { ok: false, given: true };
        rec.grace = round; await kv.set(R(id), rec, ttlOf(rec));
        return { ok: true, used: rec.calls, id };
      });
    },
    // the bookmark: by its id (no key needed, none shown) → the public state, or null
    async view(id) { if (!ID_RE.test(String(id))) return null; const rec = await kv.get(R(id)); return rec ? doc(rec) : null; },
    async peek(h) { const rec = await kv.get(R(idOf(h))); return rec && rec.h === h ? doc(rec) : null; },
    // (since 3.81) the rest filled up again after a payment the till took: { ok, before, left, used, id, until, again } or
    // { ok: false, why: unknown }. The same key and id; the probe calls back to their number for 7 days from now, the key 30 days
    // from now (never shorter than it was); one sale fills up once (handed in again: again, nothing more)
    topup(h, { sale = null, status = null } = {}) {
      const id = idOf(h), mark = String(sale || '').slice(0, 40);
      return serial(id, async () => {
        const t = now(), rec = await kv.get(R(id));
        if (!rec || rec.h !== h) return { ok: false, why: 'unknown' };
        const live = Date.parse(rec.probe.until) > t, before = live ? rec.probe.left : 0;
        if (mark && (rec.topups || []).some((x) => x.sale === mark)) return { ok: true, again: true, before, left: before, used: rec.calls, id, until: rec.probe.until };
        const day = dayOf(t), first = !(rec.topups || []).some((x) => String(x.at).slice(0, 10) === day);
        rec.probe = { n: SESSION.probe, left: SESSION.probe, until: new Date(t + SESSION.probeDays * DAY * 1000).toISOString() }; rec.round = (rec.round || 0) + 1;
        rec.until = new Date(Math.max(Date.parse(rec.until), t + SESSION.days * DAY * 1000)).toISOString();
        rec.topups = [{ at: new Date(t).toISOString(), sale: mark || null, status: String(status || '').slice(0, 16) || null, before }, ...(rec.topups || [])].slice(0, 20);
        await kv.set(R(id), rec, ttlOf(rec));
        if (first) await count(`session:paid:${day}`, 1, 40 * DAY);
        return { ok: true, before, left: rec.probe.left, used: rec.calls, id, until: rec.probe.until };
      });
    },
    // probe calls given today (UTC), for the open numbers
    async today() { const day = dayOf(now()); return { day, opened: Number(await kv.get(`session:open:${day}`)) || 0, probe_calls: Number(await kv.get(`session:probe:${day}`)) || 0, probe_day: SESSION.probeDay, paid_keys: Number(await kv.get(`session:paid:${day}`)) || 0 }; },
  };
}

// the words of each refusal, with what to do instead: → { status, body, headers }
export function sessionRefusal(s, base) {
  const open = `POST ${base}/session`;
  if (s.bad) return { status: 401, body: { error: { code: 'UNAUTHENTICATED', message: s.bad }, next: { open } } };
  if (s.why === 'unknown') return { status: 401, body: { error: { code: 'UNAUTHENTICATED', message: 'this session key is not known here (it may never have been given, or its 30 days and one more are over)' }, next: { open } } };
  if (s.why === 'expired') return { status: 410, body: { error: { code: 'GONE', message: `this session ran out on ${s.until}` }, alternatives: [{ do: open, gives: `a new key with ${SESSION.probe} probe calls` }, { do: 'send the request without the key and pay it over x402', gives: 'the answer at once' }] } };
  if (s.why === 'slow') return { status: 429, headers: { 'retry-after': String(s.retry) }, body: { error: { code: 'RESOURCE_EXHAUSTED', message: `${SESSION.perMinute} calls a minute per session; again in ${s.retry} s. Nothing was taken.` }, batch: `GET ${base}/x402/read takes up to 10 url= in one call` } };
  return null;
}
