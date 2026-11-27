// Mare Liberum · the contact book (since 3.79): who reaches the paywall, what stopped them there, how far they came
// One line per contact (an agent: the hash of its program name and its network), kept in the node's state like the sessions
// (node/session.mjs): no table, no migration. supabase/kontaktbuch.sql is the same line as a table of the shared database.
//   contact   cid = HMAC of (SHA-256 of the user agent, network) with a key of the server; the network is IPv4 /24 or IPv6 /48
//             and is never written down: only its HMAC (ip_prefix_hash). A line lives 31 days from first_seen, then a contact
//             that comes back is a new one: no line links an agent across more than a month.
//   fields    ua_hash, ip_prefix_hash, agent and kind (as the census names the program), kompetenz (the door of the last
//             paywall hit), preis_usd (its price), paywall_hits, paywall_type (the cause of the last 402: no_wallet, price,
//             scheme, chain, timeout) and how often each cause stopped it, first_seen, last_seen, the UTC days seen,
//             versuchte_paths (the paid doors tried, at most 20), abbruch_phase (the furthest step reached: 402, session,
//             probe, probe_empty, pay_sent, paid), session (its id), paid and paid_usd, wiederkunft_d7 (seen again on another
//             UTC day within 7 days of first_seen)
//   cause     no payment sent: no_wallet, or price when this contact has sent a readable payment before (it can pay, it did
//             not); a payment sent and refused: what the refusal names (scheme, chain, price, timeout; insufficient funds
//             counts as no_wallet)
//   numbers   per UTC day: new contacts (and how many of them are probes and indexes by their name), 402 answers by cause,
//             contacts with a 402 (once or more than once), payments, contacts that paid after a 402, the cohort of the day
//             (seen again within 7 days); GET /contacts.json, the four lines of the morning at /contacts.txt
//   rolle     (since 3.81) pruefer (a probe, an index or a registry by its name), agent, or agent_with_key: a contact whose key
//             took at least one probe call at a door is an agent with a key, not a probe, whatever its name; the day counts
//             these (with_key) and takes them out of the probes it counted new that day
//   payers    (since 3.84) per UTC day the contacts that paid (each once a day): the first number of "who pays" on /pulse,
//             beside the keys of the day (sessions) and the paid answers (paid)
//   limits    at most 5,000 new contacts a UTC day (more are counted, not kept); own calls (MareLiberum-session) not at all
import { createHash, createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { hostOf } from './hosts.mjs';

export const CONTACTS = Object.freeze({ days: 31, perDay: 5000, paths: 20, aggDays: 40, d7: 7 });
export const PAYWALL_TYPES = Object.freeze(['no_wallet', 'price', 'scheme', 'chain', 'timeout']);
export const PHASES = Object.freeze(['402', 'session', 'probe', 'probe_empty', 'pay_sent', 'paid']);
const DAY = 86_400, DAY_MS = DAY * 1000;
const dayOf = (t) => new Date(t).toISOString().slice(0, 10);
const addDays = (d, n) => dayOf(Date.parse(`${d}T00:00:00Z`) + n * DAY_MS);

// the network a request comes from, coarse: IPv4 /24, IPv6 /48 (never written down, only its HMAC)
export function prefixOf(ip) {
  const s = String(ip || '').trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/%.*$/, '');
  const v = isIP(s);
  if (v === 4) return `${s.split('.').slice(0, 3).join('.')}.0/24`;
  if (v === 6) {
    if (/^::ffff:\d+\.\d+\.\d+\.\d+$/.test(s)) return prefixOf(s.slice(7));
    const [head, tail = ''] = s.split('::'), a = head ? head.split(':') : [], b = tail ? tail.split(':') : [];
    const full = [...a, ...Array(Math.max(0, 8 - a.length - b.length)).fill('0'), ...b].map((x) => parseInt(x || '0', 16).toString(16));
    return `${full.slice(0, 3).join(':')}::/48`;
  }
  return 'unknown';
}

// the paid door a path asks for: route, read, check, deal, pack, credit, session, fair; anything else that answered 402 is
// the toll on the lossless levers
export function doorOf(path, method = 'GET') {
  const p = String(path || '');
  if (p === '/route') return 'route';
  if (p === '/x402/read' || p === '/read' || p.startsWith('/r/')) return 'read';
  if (p === '/x402/check' || p === '/check') return 'check';
  if (p === '/x402/deal' || p === '/deal') return 'deal';
  if (p === '/x402/pack' || p === '/pack') return 'pack';
  if (p.startsWith('/reader/credit')) return 'credit';
  if (p === '/session' || p.startsWith('/session/')) return 'session';
  if (p.startsWith('/fair')) return 'fair';
  if (p === '/settle') return 'route';
  return method === 'GET' || method === 'POST' ? 'toll' : 'other';
}

// why a 402 stopped the call: no payment at all (no_wallet, or price for a contact that paid or tried before), else what the
// refusal names. The words are the till's own (node/pay.mjs checkPayment, node/readpay.mjs exactFor, the facilitator's verdict)
export function causeOf({ paid = false, bad = false, message = '', wallet = false } = {}) {
  if (!paid) return wallet ? 'price' : 'no_wallet';
  if (bad) return 'scheme';
  const m = String(message || '').toLowerCase();
  if (/insufficient|balance|not enough funds|funds/.test(m)) return 'no_wallet';
  if (/carries none|scheme|could not be read|no nonce|validbefore|must end within|used before|buys once|signature/.test(m)) return 'scheme';
  if (/time ?out|timed out|did not answer|no answer|try again in a moment|did not settle|unsettled|no verdict/.test(m)) return 'timeout';
  if (/eip155|network|another wallet|on base|chain|asset/.test(m)) return 'chain';
  if (/costs exactly|smaller than|is for \d|accepted \d|amount|price|too little/.test(m)) return 'price';
  return 'scheme';
}

// a name that tells an index, a registry or a probe from an agent that came to work: by the census kind and by the name
const PROBE_KINDS = new Set(['registry', 'crawler', 'ai-crawler', 'search', 'search-ai']);
const PROBE_NAME = /probe|lint|scan|monitor|watch|index|crawl|check|liveness|verif|observ|collector|radar|bot\b|spider|uptime|health|inspect|directory|catalog/i;
export const probeLike = (who) => PROBE_KINDS.has(who?.kind) || PROBE_NAME.test(String(who?.name || ''));

export function createContacts({ kv, now = () => Date.now(), secret }) {
  const key = createHmac('sha256', secret || 'mare-contacts-unkeyed').update('mare-contacts-v1').digest();
  const mac = (s) => createHmac('sha256', key).update(String(s)).digest('hex').slice(0, 24);
  const chains = new Map();
  const serial = (k, fn) => { const prev = chains.get(k) || Promise.resolve(); const run = prev.then(fn, fn); const tail = run.then(() => {}, () => {}); chains.set(k, tail); tail.then(() => { if (chains.get(k) === tail) chains.delete(k); }); return run; };
  const C = (cid) => `contact:${cid}`, A = (d) => `contacts:day:${d}`, H = (d) => `contacts:cohort:${d}`;
  const empty = () => ({ new: 0, new_probe: 0, with_key: 0, payers: 0, overflow: 0, p402: 0, types: Object.fromEntries(PAYWALL_TYPES.map((t) => [t, 0])), contacts402: 0, single: 0, multi: 0, sessions: 0, probe: 0, paid: 0, paid_usd_micro: 0, converted: 0 });
  const bumpDay = (d, fn) => serial(A(d), async () => { const a = { ...empty(), ...((await kv.get(A(d))) || {}) }; a.types = { ...empty().types, ...(a.types || {}) }; fn(a); await kv.set(A(d), a, CONTACTS.aggDays * DAY); return a; });
  const bumpCohort = (d, fn) => serial(H(d), async () => { const c = { n: 0, back: 0, ...((await kv.get(H(d))) || {}) }; fn(c); await kv.set(H(d), c, CONTACTS.aggDays * DAY); return c; });
  const since = async (d) => { const s = await kv.get('contacts:since'); if (!s || s > d) await kv.set('contacts:since', d, 400 * DAY); return s && s < d ? s : d; };

  // one event at the paywall: { ua, ip, who: {kind, name}, path, method, kind: '402' | 'session' | 'probe' | 'probe_empty' |
  // 'pay_sent' | 'paid', paid (a payment header was sent), bad (it could not be read), message (the refusal), price_usd,
  // session (its id), paid_usd } → the contact line, or null (own calls, the day's cap)
  async function note(e) {
    if (!e || e.who?.kind === 'self' || e.who?.kind === 'resident') return null;
    const t = now(), d = dayOf(t), at = new Date(t).toISOString();
    const ua = String(e.ua || ''), uaHash = createHash('sha256').update(ua).digest('hex'), prefix = prefixOf(e.ip);
    const cid = mac(`${uaHash}|${prefix}`), door = doorOf(e.path, e.method);
    return serial(C(cid), async () => {
      let c = await kv.get(C(cid)), fresh = false;
      if (!c || Date.parse(c.first_seen) + CONTACTS.days * DAY_MS <= t) {
        const day = await kv.get(A(d)); const made = (day?.new || 0) + (day?.overflow || 0);
        if (made >= CONTACTS.perDay) { await bumpDay(d, (a) => { a.overflow += 1; if (e.kind === '402') { a.p402 += 1; a.types[causeOf({ paid: e.paid, bad: e.bad, message: e.message })] += 1; } }); return null; }
        fresh = true;
        // (since 4.0) install_source: the host by its program and the route it came in by (chatgpt:/x402/check), kept from the first contact
        c = { v: 1, cid, install_source: `${hostOf(ua, e.who?.name)}:${String(e.path || '/').slice(0, 60)}`, ua_hash: uaHash, ip_prefix_hash: mac(`net|${prefix}`), agent: String(e.who?.name || '').slice(0, 60) || null, kind: String(e.who?.kind || 'unknown').slice(0, 20), probe: probeLike(e.who), rolle: probeLike(e.who) ? 'pruefer' : 'agent', kompetenz: null, preis_usd: null, paywall_hits: 0, paywall_type: null, paywall_types: {}, first_seen: at, last_seen: at, days: [d], versuchte_paths: [], abbruch_phase: null, session: null, paid: 0, paid_usd: '0.000000', wiederkunft_d7: false, wallet: false, hits_by_day: {} };
      }
      const wasHits = c.paywall_hits, dayHits = c.hits_by_day?.[d] || 0;
      // a key that opened a door: an agent with a key, no longer a probe (also when its name says probe)
      let keyed = false, wasProbe = false;
      if (e.kind === 'probe' && c.rolle !== 'agent_with_key') { keyed = true; wasProbe = !!c.probe; c.rolle = 'agent_with_key'; c.probe = false; }
      if (!c.rolle) c.rolle = c.probe ? 'pruefer' : 'agent';
      // came back: another UTC day within 7 days of the first
      let back = false;
      if (!c.days.includes(d)) { c.days = [...c.days, d].slice(-CONTACTS.days); if (!c.wiederkunft_d7 && t - Date.parse(c.first_seen) <= CONTACTS.d7 * DAY_MS) { c.wiederkunft_d7 = true; back = true; } }
      c.last_seen = at;
      const p = String(e.path || '').startsWith('/r/') ? '/r/' : String(e.path || '').slice(0, 60);
      if (door !== 'toll' && door !== 'other' && !c.versuchte_paths.includes(p)) c.versuchte_paths = [...c.versuchte_paths, p].slice(0, CONTACTS.paths);
      if (e.paid && !e.bad) c.wallet = true;
      if (e.session) c.session = String(e.session).slice(0, 24);
      let type = null;
      if (e.kind === '402' || e.kind === 'probe_empty' || e.kind === 'pay_sent') {
        type = causeOf({ paid: e.paid, bad: e.bad, message: e.message, wallet: c.wallet });
        c.paywall_hits += 1; c.paywall_type = type; c.paywall_types = { ...c.paywall_types, [type]: (c.paywall_types[type] || 0) + 1 };
        c.hits_by_day = Object.fromEntries(Object.entries({ ...(c.hits_by_day || {}), [d]: dayHits + 1 }).slice(-CONTACTS.days));
        if (door !== 'toll' && door !== 'other') { c.kompetenz = door; if (Number.isFinite(Number(e.price_usd))) c.preis_usd = Number(e.price_usd).toFixed(6); }
      }
      // (since 3.84) a contact that paid today counts once among the payers of the day
      const payer = e.kind === 'paid' && c.paid_day !== d; if (e.kind === 'paid') c.paid_day = d;
      if (e.kind === 'paid') { c.paid += 1; c.paid_usd = (Number(c.paid_usd) + (Number(e.paid_usd) || 0)).toFixed(6); if (door !== 'toll' && door !== 'other') c.kompetenz = door; if (Number.isFinite(Number(e.paid_usd))) c.preis_usd = Number(e.paid_usd).toFixed(6); }
      const was = c.abbruch_phase, rank = (x) => (x == null ? -1 : PHASES.indexOf(x));
      if (rank(e.kind) > rank(was)) c.abbruch_phase = e.kind;
      const ttl = Math.max(DAY, Math.ceil((Date.parse(c.first_seen) + CONTACTS.days * DAY_MS - t) / 1000));
      await kv.set(C(cid), c, ttl);
      // the numbers of the day and of the cohorts
      await bumpDay(d, (a) => {
        if (fresh) { a.new += 1; if (c.probe || (keyed && wasProbe)) a.new_probe += 1; }
        if (keyed) { a.with_key += 1; if (wasProbe && dayOf(Date.parse(c.first_seen)) === d) a.new_probe = Math.max(0, a.new_probe - 1); }
        if (type) {
          a.p402 += 1; a.types[type] += 1;
          if (dayHits === 0) { a.contacts402 += 1; a.single += 1; } else if (dayHits === 1) { a.single -= 1; a.multi += 1; }
        }
        if (e.kind === 'session') a.sessions += 1;
        if (e.kind === 'probe') a.probe += 1;
        if (payer) a.payers += 1;
        if (e.kind === 'paid') { a.paid += 1; a.paid_usd_micro += Math.round((Number(e.paid_usd) || 0) * 1e6); if (wasHits > 0 && c.paid === 1) a.converted += 1; }
      });
      if (fresh) { await since(d); await bumpCohort(d, (h) => { h.n += 1; }); }
      if (back) await bumpCohort(dayOf(Date.parse(c.first_seen)), (h) => { h.back += 1; });
      return c;
    });
  }

  // the numbers: today and yesterday (UTC), the cohort for d7, and the four lines of the morning
  async function dashboard() {
    const t = now(), today = dayOf(t), yesterday = addDays(today, -1), start = (await kv.get('contacts:since')) || today;
    const day = async (d) => { const a = { ...empty(), ...((await kv.get(A(d))) || {}) }; return { day: d, ...a, types: { ...empty().types, ...(a.types || {}) } }; };
    const [y, n] = [await day(yesterday), await day(today)];
    const cohortDay = addDays(today, -CONTACTS.d7 - 1), full = cohortDay >= start;
    const cohort = full ? { day: cohortDay, ...((await kv.get(H(cohortDay))) || { n: 0, back: 0 }) } : null;
    let so = { n: 0, back: 0 }; for (let d = start; d <= today; d = addDays(d, 1)) { const h = (await kv.get(H(d))) || {}; so = { n: so.n + (h.n || 0), back: so.back + (h.back || 0) }; if (so.n > 1e9) break; }
    const pct = (a, b) => (b > 0 ? `${((a / b) * 100).toFixed(1).replace('.', ',')} %` : '–');
    const r = y.p402 || y.new || y.paid ? y : n;
    const lines = [
      `1 Neue Agenten an der Bezahlwand (${r.day}): ${r.new} (davon Prüfer und Indizes nach Namen: ${r.new_probe}; agent_with_key, ein Schlüssel öffnete eine Tür: ${r.with_key})`,
      `2 402 nach Typ (${r.day}): kein Wallet ${r.types.no_wallet} · Preis ${r.types.price} · Scheme ${r.types.scheme} · Chain ${r.types.chain} · Timeout ${r.types.timeout} (Kontakte mit 402: ${r.contacts402}, davon einmal ${r.single}, mehrmals ${r.multi})`,
      `3 402 zu bezahlt (${r.day}): ${r.p402} → ${r.paid} bezahlt (${pct(r.paid, r.p402)}); Kontakte, die nach einem 402 zahlten: ${r.converted} von ${r.contacts402}`,
      cohort ? `4 Wiederkehr d7 (Kohorte ${cohort.day}): ${cohort.back} von ${cohort.n} (${pct(cohort.back, cohort.n)})` : `4 Wiederkehr d7: erste volle Kohorte am ${addDays(start, CONTACTS.d7 + 1)} (bisher: ${so.back} von ${so.n} kamen an einem anderen Tag wieder)`,
    ];
    // (where each contact stopped, abbruch_phase, is in its line: the operator's export, never counted here from all lines, so
    // that an open page never walks the whole book)
    return { day: today, since: start, lines, yesterday: y, today: n, cohort_d7: cohort, returned_so_far: so, what: 'the contact book (node/contacts.mjs): per UTC day, who reached the paywall, the cause of each 402 and how far each contact came; no identities, no addresses' };
  }

  // the lines themselves (for the operator's export, in the columns of supabase/kontaktbuch.sql): newest first
  async function rows(limit = 5000) {
    const ks = typeof kv.keys === 'function' ? kv.keys('contact:') : [];
    const out = [];
    for (const k of ks) { const c = await kv.get(k); if (c?.cid) out.push(c); }
    out.sort((a, b) => (a.last_seen < b.last_seen ? 1 : -1));
    return out.slice(0, limit).map(({ v, hits_by_day, wallet, probe, paid_day, ...c }) => ({ ...c, install_source: c.install_source ?? null, probe: !!probe }));
  }

  // (since 3.84) the numbers of today alone (one read): for the line "who pays" of /pulse
  async function today() { const d = dayOf(now()), a = { ...empty(), ...((await kv.get(A(d))) || {}) }; return { day: d, payers: a.payers, paid: a.paid, keys: a.sessions, p402: a.p402 }; }

  return { note, dashboard, rows, today, peek: async (cid) => kv.get(C(cid)) };
}
