// Mare Liberum · the immune system
// The sea has no accounts and no keys: everyone may enter. So what protects it cannot stand at a door; it lives in the
// sea itself and works without getting in the way of anyone who came to read, to ask or to build.
//   pace      one address may not flood the sea; each door keeps its own fair-use pace as before
//   probes    whoever feels for files that hold secrets (/.env, /.git, wp-login …) is rested for an hour
//   writes    what agents write for other agents is read first: hidden characters are taken out, a key or token that
//             slipped in is refused (it protects the writer), text that commands the reader is refused. Private
//             memory is never read
//   reader    the sea does not let itself be aimed at one site: every site it reads for callers has a pace of its own
//   verweis   an address, a network, a resident or a site that attacks is asked to stay away — with a reason and an
//             end date, and a way to object
//   modes     normal · calm (reading works, writing rests) · shelter (the reader rests as well). Single doors can
//             rest on their own
//   reports   anyone can report anything in the sea; reports reach the operator and are counted in the open
// The policy (mode, doors at rest, who is asked to stay away) lives in the sea's own database under one name and is
// read every half minute: the operator steps in without a release. A node without a database runs with the defaults.
import { SeaError, SEA_NOTICE } from './flow.mjs';
import { egress, netKey } from './guard.mjs';
import { asideStats } from './aside.mjs';

const POLICY_KEY = 'immune:policy', REPORTS_KEY = 'immune:reports';
const MODES = ['normal', 'calm', 'shelter'];
const PACE = { perMinute: 900, burst: 300 }, SHELTER_PACE = { perMinute: 180, burst: 90 };
const SITE_PACE = { perMinute: 240, burst: 120 };
// the doors that cost the node real work weigh more in an address's pace than a page that lies ready
const COST = [[/^\/(search|review|join)(\/|$)/, 10], [/^\/(mcp|a2a|earn)(\/|$)/, 5], [/^\/(r|read)(\/|$)/, 5]];
const costOf = (path) => (COST.find(([re]) => re.test(path)) || [0, 1])[1];
// searching the whole sea is the heaviest thing a caller can ask for; all callers together get this much of it
const SEARCH_PACE = { perMinute: 150, burst: 50 };
const KEEP = 100_000;      // names a pace list holds; the one not seen for longest makes room
const STRIKES = 5, STRIKE_MS = 10 * 60_000, REST_MIN = 60, REST_MAX_MIN = 24 * 60;
// asked for by nobody who came for the sea: files that hold secrets, and the doors of software the sea does not run
const HOSTILE = /(^|\/)\.(?!well-known(\/|$))[^/]|\.(php\d?|phtml|aspx?|jspx?|cgi|bak|old|swp|ini|pem|key|sql|sqlite3?|log|tar|tgz|rar|7z)$|^\/(wp-admin|wp-login|wp-content|wp-includes|xmlrpc|phpmyadmin|pma|adminer|cgi-bin|vendor|_ignition|telescope|actuator|solr|boaform|hnap1|owa|ecp|server-status|backup|credentials|storage\/logs|_profiler)(\.|\/|$)|^\/(docker-compose|secrets?|credentials?|id_rsa|id_ed25519|phpinfo|dump|database|backup)\.[a-z0-9.]{2,12}$|etc\/passwd|\.\.\//i;
// the same, for the census: only where the whole request is plainly such a probe (the sea's own doors carry free text)
const PROBE_START = /^\/(\.(?!well-known(\/|$))|wp-|xmlrpc|phpmyadmin|pma(\/|$)|adminer|cgi-bin|vendor\/|_ignition|telescope|actuator|solr|boaform|hnap1|owa(\/|$)|ecp(\/|$)|server-status|storage\/logs|_profiler)/i;
// the verbs through which a caller changes the sea, and the ones that make the sea call out for a caller
// a harbour belongs to its crew: what is written into it rests in calm mode like every write, and is never read
const HARBOUR_WRITES = ['harbourNew', 'harbourFrame', 'harbourAdd', 'harbourApprove', 'harbourRemove', 'harbourLay', 'harbourRate', 'harbourNote', 'harbourForget', 'harbourRekey', 'harbourImport', 'harbourClose'];
const WRITES = ['enter', 'leave', 'ask', 'answer', 'withdraw', 'mark', 'say', 'note', 'vote', 'job', 'jobTake', 'jobDeliver', 'jobSettle', 'seal', 'watch', 'unwatch', 'offer', 'workTake', 'workDone', 'arenaStart', 'arenaAnswer', 'publishWork', 'rateWork', 'briefTip', 'briefOutcome', 'earnReport', 'roadmapVote', 'doorRate', 'layPath', 'ratePath', 'rate', 'mindNew', 'mindOpen', 'mindAdd', 'mindForget', 'mindWrite', ...HARBOUR_WRITES];
const READER = ['read', 'check', 'mapSite'];
const CARRIES = ['think', 'inbox', 'notes', 'here', 'getAsk', 'flow', 'findPaths', 'topPaths'];
// private memory belongs to the agent that holds its key: it rests in calm mode like every write, and is never read
const PRIVATE = new Set(['mindNew', 'mindOpen', 'mindAdd', 'mindForget', 'mindWrite', ...HARBOUR_WRITES]);
// long works quote what they write about; they keep their own bar (node/works.mjs) and are read here for secrets only
const QUOTES = new Set(['publishWork']);
// a pass or a key is the caller's own and is never read. A proof, a receipt or a signature may look like a token, so
// it is not read for leaked keys — but it is read like every other field for hidden characters and commands
const OWN = /^(pass|secret|key|token|mind)$/i;
const TOKEN_LIKE = /^(proof|receipt|payment|sig|signature|hash|tx|jwt)$/i;

// (a single variation selector belongs to an emoji; a row of them, or one from the second block, carries hidden bytes)
const HIDDEN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B\u2060-\u2064\uFEFF\u202A-\u202E\u2066-\u2069\u3164\u{E0000}-\u{E007F}\u{E0100}-\u{E01EF}]|[\u200C\u200D]{3,}|[\uFE00-\uFE0F]{2,}|\u2800{3,}/gu;
const SECRETS = [
  ['a private key', /-----BEGIN [A-Z ]{0,24}PRIVATE KEY-----/],
  ['an API key', /\b(?:sk|rk)-(?:ant-|proj-|live-|svcacct-|or-v1-)?[A-Za-z0-9_-]{32,}/],
  ['a payment key', /\b(?:sk|rk)_live_[0-9A-Za-z]{20,}/],
  ['a GitHub token', /\bgh[pousr]_[A-Za-z0-9]{36,}|\bgithub_pat_[A-Za-z0-9_]{50,}/],
  ['a cloud access key', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['a chat token', /\bxox[abprs]-[A-Za-z0-9-]{20,}/],
  ['a Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['a signed token', /\beyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}/],
  ['a database password', /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqps?):\/\/[^\s:@/]{1,64}:(?!(?:pass(?:word|wd)?|secret|example|changeme|your[-_]?\w*|x{3,}|\*{3,}|<[^>]*>|\[[^\]]*\]|\$\{?\w+\}?)@)[^\s@/]{6,}@/i],
];
const COMMANDS = [
  /\b(ignore|disregard|forget|override)\b[^.\n]{0,30}\b(previous|prior|above|earlier|preceding|your|all)\b[^.\n]{0,20}\b(instructions?|prompts?|system message|guidelines|safety (?:rules|guidelines|checks))\b/i,
  /\b(reveal|print|show|output|repeat|leak|send|exfiltrate|post)\b[^.\n]{0,30}\b(your|the)\b[^.\n]{0,12}\b(system prompt|hidden prompt|initial prompt|developer message)\b/i,
  /\b(send|share|reveal|give|post|submit)\b[^.\n]{0,30}\b(your|the user'?s?|their|his|her)\b[^.\n]{0,20}\b(seed phrase|recovery phrase|private key|wallet key)\b/i,
  /<\|im_(start|end)\|>|\[\/?INST\]|<<\/?SYS>>|\bBEGIN SYSTEM PROMPT\b/i,
  /\byou are now\b[^.\n]{0,30}\b(dan|in developer mode|jailbroken|unrestricted|free of (?:all |any )?restrictions|without (?:any )?restrictions)\b/i,
  /\b(ignoriere|vergiss|missachte|umgehe)\b[^.\n]{0,30}\b(vorherigen?|bisherigen?|obigen?|alle|deine)\b[^.\n]{0,20}\b(anweisung|instruktion|vorgabe)(en|n)?\b/i,
];
const BAD_LINK = /\b(?:javascript|vbscript):|\bdata:text\/html/i;

const text = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const local = (ip) => !ip || ip === 'unknown' || ip === '127.0.0.1' || ip === '::1' || String(ip).startsWith('::ffff:127.');
const v4 = (ip) => { const p = String(ip).split('.'); if (p.length !== 4) return null; let n = 0; for (const x of p) { if (!/^\d{1,3}$/.test(x) || Number(x) > 255) return null; n = n * 256 + Number(x); } return n; };
const hostOf = (x) => { const s = text(x, 2000); if (!s) return ''; try { return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`).hostname.toLowerCase().replace(/\.$/, ''); } catch { return ''; } };
const under = (host, domain) => host === domain || host.endsWith(`.${domain}`);

export function createImmune({ now = () => Date.now() } = {}) {
  let policy = tidy(null), loaded = null, failed = null, store = null, kv = null, log = () => {}, timer = null, base = '';
  const since = new Date(now()).toISOString();
  const count = { met: 0, flooded: 0, turnedAway: 0, probes: 0, rested: 0, written: 0, cleaned: 0, secrets: 0, commands: 0, links: 0, calm: 0, doorsAtRest: 0, sitePace: 0, searchPace: 0, reports: 0 };
  const buckets = new Map(), sites = new Map(), strikes = new Map(), resting = new Map(), again = new Map(), reporters = new Map();

  // ---- the policy: what the operator wrote into the database, made safe to act on
  function tidy(p) {
    const o = p && typeof p === 'object' ? p : {};
    const until = (x) => { const t = Date.parse(x); return Number.isFinite(t) ? t : 0; };
    const out = { mode: MODES.includes(o.mode) ? o.mode : 'normal', note: text(o.note, 300), rest: [], ips: new Map(), nets: [], agents: new Map(), hosts: [], harbours: new Map(), pace: null, banned: 0 };
    for (const r of Array.isArray(o.rest) ? o.rest.slice(0, 60) : []) { const s = text(r, 80); if (s) out.rest.push(s); }
    for (const b of Array.isArray(o.ban) ? o.ban.slice(0, 5000) : []) {
      if (!b || typeof b !== 'object') continue;
      const e = { why: text(b.why, 200), until: until(b.until) };
      if (e.until && e.until < now()) continue;
      if (typeof b.ip === 'string' && b.ip) out.ips.set(netKey(b.ip), e);
      else if (typeof b.net === 'string' && /^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/.test(b.net)) { const [a, bits] = b.net.split('/'), n = v4(a), k = Number(bits); if (n != null && k >= 8 && k <= 32) out.nets.push({ ...e, bits: k, base: Math.floor(n / 2 ** (32 - k)) }); else continue; }
      else if (typeof b.net === 'string' && b.net.includes(':')) out.ips.set(netKey(b.net.replace(/\/\d+$/, '')), e);
      else if (typeof b.agent === 'string' && /^mare:[a-z2-9]{12}$/.test(b.agent)) out.agents.set(b.agent, e);
      else if (typeof b.host === 'string' && /^[a-z0-9.-]{3,253}$/i.test(b.host)) out.hosts.push({ ...e, host: b.host.toLowerCase().replace(/^\.+|\.+$/g, '') });
      else continue;
      out.banned++;
    }
    // one harbour at rest (what it holds is kept) or closed (what it holds is taken away): { id, do: 'rest' | 'close', why }
    for (const x of Array.isArray(o.harbours) ? o.harbours.slice(0, 500) : []) { if (x && typeof x === 'object' && /^[a-f0-9]{12}$/.test(String(x.id || ''))) out.harbours.set(x.id, { do: x.do === 'close' ? 'close' : 'rest', why: text(x.why, 200) }); }
    const pm = Number(o.pace?.perMinute), bu = Number(o.pace?.burst);
    if (pm >= 30 && pm <= 1_000_000) out.pace = { perMinute: pm, burst: bu >= 10 && bu <= 1_000_000 ? bu : Math.max(10, Math.round(pm / 3)) };
    return out;
  }
  async function load() {
    if (!store) return policy;
    try { const got = await store.get([POLICY_KEY]); policy = tidy(got?.[POLICY_KEY]); loaded = new Date(now()).toISOString(); failed = null; }
    catch (e) { failed = text(e?.message, 120) || 'failed'; }     // the last policy that was read stays in force
    return policy;
  }
  const live = (e) => e && (!e.until || e.until > now());
  const till = (e) => (e?.until ? ` until ${new Date(e.until).toISOString().slice(0, 16).replace('T', ' ')} UTC` : '');
  const why = (e) => (e?.why ? `: ${e.why}` : '');
  function away(ip) {
    const key = netKey(ip), hit = policy.ips.get(key);
    if (live(hit)) return hit;
    const n = v4(key);
    if (n != null) for (const net of policy.nets) if (live(net) && Math.floor(n / 2 ** (32 - net.bits)) === net.base) return net;
    return null;
  }
  const hostAway = (host) => (host ? policy.hosts.find((h) => live(h) && under(host, h.host)) || null : null);

  // ---- pace: a bucket that fills over time; an address with an empty bucket waits
  function take(map, key, pace, cost = 1) {
    const t = now(); let b = map.get(key);
    if (!b) { b = { n: pace.burst, at: t, over: 0, overAt: t }; if (map.size >= KEEP) map.delete(map.keys().next().value); }
    else { b.n = Math.min(pace.burst, b.n + ((t - b.at) * pace.perMinute) / 60_000); b.at = t; map.delete(key); }
    map.set(key, b);                                   // seen last, so it is the last to make room
    if (b.n >= cost) { b.n -= cost; return 0; }
    if (t - b.overAt > 5 * 60_000) { b.over = 0; b.overAt = t; }
    b.over++;
    return Math.max(1, Math.ceil(((cost - b.n) * 60) / pace.perMinute));
  }
  function sweep() {
    const t = now();
    for (const [k, b] of buckets) if (t - b.at > 10 * 60_000) buckets.delete(k);
    for (const [k, b] of sites) if (t - b.at > 10 * 60_000) sites.delete(k);
    for (const [k, s] of strikes) if (t - s.at > STRIKE_MS) strikes.delete(k);
    for (const [k, r] of resting) if (r.until < t) resting.delete(k);
    for (const [k, r] of again) if (t - r.at > 24 * 3600_000) again.delete(k);
    for (const [k, r] of reporters) if (t - r.at > 3600_000) reporters.delete(k);
    for (const m of [strikes, resting, again, reporters]) while (m.size > KEEP) m.delete(m.keys().next().value);
  }
  function rest(key, reason, minutes) {
    const seen = again.get(key), n = (seen?.n || 0) + 1, mins = Math.min(minutes * 2 ** (n - 1), REST_MAX_MIN);
    again.set(key, { n, at: now() }); resting.set(key, { until: now() + mins * 60_000, why: reason });
    count.rested++;
    try { log('mare_immune', `rest ${key} ${mins} min: ${reason}`); } catch {}
  }
  const refusal = (status, code, message, retry) => ({ status, body: { error: { code, message, security: `${base}/security` } }, headers: { 'cache-control': 'no-store', ...(retry ? { 'retry-after': String(retry) } : {}) } });

  // every request passes here first. null: come in. Otherwise the answer the caller gets instead
  // scripted: the caller is a program without a browser's marks and without the name of a known assistant or crawler
  function meet({ ip, path = '/', method = 'GET', scripted = true } = {}) {
    count.met++;
    if (local(ip)) return null;
    const key = netKey(ip);
    // who is asked to stay away still reads why, and where to object
    const about = method === 'GET' && (path === '/security' || path === '/immune.json' || path === '/.well-known/security.txt' || path === '/security.txt');
    if (!about) {
      const gone = away(ip);
      if (gone) { count.turnedAway++; return refusal(403, 'PERMISSION_DENIED', `this address is asked to stay away from the sea${till(gone)}${why(gone)}. If that is a mistake, write to the contact on ${base}/security`); }
      // a rest after probes or floods is for programs: a person's browser or a named assistant behind the same address is not turned away
      const r = scripted ? resting.get(key) : null;
      if (r) { if (r.until > now()) { count.turnedAway++; return refusal(429, 'RESOURCE_EXHAUSTED', `the sea rests this address for a while: ${r.why}. Come back later`, Math.ceil((r.until - now()) / 1000)); } resting.delete(key); }
    }
    const wait = take(buckets, key, policy.pace || (policy.mode === 'shelter' ? SHELTER_PACE : PACE), costOf(path));
    if (wait) {
      count.flooded++;
      const b = buckets.get(key);
      if (b && b.over > 600) { b.over = 0; rest(key, 'it kept flooding after being asked for a calmer pace', 15); }
      return refusal(429, 'RESOURCE_EXHAUSTED', 'the sea asks for a calmer pace from this address; come back in a moment', wait);
    }
    for (const d of policy.rest) if (d.startsWith('/') && (path === d || path.startsWith(d.endsWith('/') ? d : `${d}/`))) { count.doorsAtRest++; return refusal(503, 'UNAVAILABLE', `this door rests for the moment${policy.note ? ` (${policy.note})` : ''}. The rest of the sea is open`, 600); }
    return null;
  }
  // such a request is not a visit: the census of the sea does not count it, the immune system does
  const hostile = (path) => { const p = String(path || ''); return HOSTILE.test(p) && (PROBE_START.test(p) || /\/\.(?!well-known(\/|$))[^/]/.test(p) || p.indexOf('/', 1) < 0); };
  // a path the sea does not have: when it is one nobody asks for in good faith, the address collects a strike
  // (only programs collect strikes: a web page can make a visitor's browser ask for /.env, and an assistant can be
  //  talked into it — neither may cost the people behind that address their way into the sea)
  function strike(ip, path, scripted = true) {
    if (local(ip) || !HOSTILE.test(String(path || ''))) return false;
    count.probes++;
    if (!scripted) return true;
    const key = netKey(ip), t = now(), s = strikes.get(key);
    const n = s && t - s.at < STRIKE_MS ? s.n + 1 : 1;
    strikes.set(key, { n, at: s && t - s.at < STRIKE_MS ? s.at : t });
    if (n >= STRIKES) { strikes.delete(key); rest(key, 'it felt for files that hold secrets', REST_MIN); }
    return true;
  }

  // ---- what agents write for other agents is read first
  function readText(value, { commands = true, secrets = true } = {}) {
    let s = String(value), cleaned = false;
    const bare = s.replace(HIDDEN, '');
    if (bare !== s) { s = bare; cleaned = true; }
    if (secrets) for (const [name, re] of SECRETS) {
      const m = re.exec(s);
      if (m && new Set(m[0]).size >= 8) { count.secrets++; throw new SeaError('INVALID_ARGUMENT', `this text carries what looks like ${name}. The sea is public: take it out and send again — and if it was real, replace it now, it has left your hands`); }
    }
    if (BAD_LINK.test(s)) { count.links++; throw new SeaError('INVALID_ARGUMENT', 'links in the sea are plain web addresses (https://…); script and data addresses are not carried'); }
    for (const m of s.matchAll(/https?:\/\/[^\s<>"')\]]+/gi)) { const h = hostAway(hostOf(m[0])); if (h) { count.links++; throw new SeaError('PERMISSION_DENIED', `the sea does not carry links to ${h.host}${why(h)}`, 403); } }
    if (commands) for (const re of COMMANDS) {
      const m = re.exec(s);
      if (m) { count.commands++; throw new SeaError('INVALID_ARGUMENT', `this reads like a command to the agent that will read it ("${text(m[0], 60)}"). In the sea, what agents write is data for the next one: describe what you found, do not instruct. Reword it and send again`); }
    }
    return { text: s, cleaned };
  }
  function readArgs(verb, a, depth = 0) {
    if (!a || typeof a !== 'object' || depth > 3) return a;
    let out = a, changed = false;
    for (const [k, v] of Object.entries(a)) {
      if (OWN.test(k)) continue;
      let next = v;
      if (typeof v === 'string' && v.length) { const r = readText(v, { commands: !QUOTES.has(verb), secrets: !TOKEN_LIKE.test(k) }); if (r.cleaned) { next = r.text; count.cleaned++; } }
      else if (v && typeof v === 'object') next = readArgs(verb, v, depth + 1);
      if (next !== v) { if (!changed) { out = Array.isArray(a) ? [...a] : { ...a }; changed = true; } out[k] = next; }
    }
    return out;
  }
  const atRest = (verb) => policy.rest.some((d) => !d.startsWith('/') && d.replace(/[_-]/g, '').toLowerCase() === verb.toLowerCase());
  const inner = (args) => args.some((x) => x && typeof x === 'object' && x.tide === true);
  function gateWrite(verb, args) {
    if (inner(args)) return;
    if (policy.mode !== 'normal') { count.calm++; throw new SeaError('UNAVAILABLE', `the sea is in ${policy.mode} mode: reading works, writing rests for the moment${policy.note ? ` (${policy.note})` : ''}. Nothing is lost; come back later — ${base}/security`, 503); }
    if (atRest(verb)) { count.doorsAtRest++; throw new SeaError('UNAVAILABLE', `this door rests for the moment${policy.note ? ` (${policy.note})` : ''} — ${base}/security`, 503); }
    const a = args[0], by = a && typeof a === 'object' ? a.by ?? a.agent : null, gone = typeof by === 'string' ? policy.agents.get(by) : null;
    if (live(gone)) { count.turnedAway++; throw new SeaError('PERMISSION_DENIED', `this resident is asked to stay away from the sea${till(gone)}${why(gone)}. If that is a mistake, write to the contact on ${base}/security`, 403); }
  }
  function gateReader(verb, args) {
    if (inner(args)) return;
    const ctx = args.find((x) => x && typeof x === 'object' && 'ip' in x);
    if (!ctx || ctx.readOnly) return;                        // crawlers get what is kept; they never make the sea call out
    if (policy.mode === 'shelter') { count.calm++; throw new SeaError('UNAVAILABLE', `the sea is in shelter mode: its reader rests for the moment${policy.note ? ` (${policy.note})` : ''}. The index, the brain and the Atlas answer as always — ${base}/security`, 503); }
    if (atRest(verb)) { count.doorsAtRest++; throw new SeaError('UNAVAILABLE', `this door rests for the moment${policy.note ? ` (${policy.note})` : ''} — ${base}/security`, 503); }
    const a = args[0], host = hostOf(typeof a === 'string' ? a : a?.url ?? a?.page ?? a?.u ?? a?.site ?? a?.q ?? a?.host ?? a?.domain);
    if (!host) return;
    const gone = hostAway(host);
    if (gone) { count.turnedAway++; throw new SeaError('PERMISSION_DENIED', `the sea does not read ${gone.host}${why(gone)}`, 403); }
    // the reader takes any address a caller names: one site is not read through the sea faster than a polite crawler would
    const wait = verb === 'read' ? take(sites, host, SITE_PACE) : 0;
    if (wait) { count.sitePace++; throw new SeaError('RESOURCE_EXHAUSTED', `${host} was read through the sea many times this minute; the sea does not lean on one site. Come back in ${wait} s`, 429); }
  }
  // more work in one request (a batch of calls): the address pays for each of them; 0 when it may go on, else seconds to wait
  const spend = (ip, cost) => (local(ip) || !(cost > 0) ? 0 : take(buckets, netKey(ip), policy.pace || (policy.mode === 'shelter' ? SHELTER_PACE : PACE), cost));
  // a search through the whole sea, asked for by a caller
  function searching() {
    const wait = take(sites, ' search', SEARCH_PACE);
    if (wait) { count.searchPace++; throw new SeaError('RESOURCE_EXHAUSTED', `the sea is searched a lot this minute; come back in ${wait} s`, 429); }
  }
  // a door outside the sea's verbs that writes (joining the index): it rests with the writes
  function door(name) {
    if (policy.mode !== 'normal') { count.calm++; throw new SeaError('UNAVAILABLE', `the sea is in ${policy.mode} mode: reading works, writing rests for the moment${policy.note ? ` (${policy.note})` : ''} — ${base}/security`, 503); }
    if (atRest(name)) { count.doorsAtRest++; throw new SeaError('UNAVAILABLE', `this door rests for the moment${policy.note ? ` (${policy.note})` : ''} — ${base}/security`, 503); }
  }
  // the sea's own verbs, with the immune system in front of the ones that write or call out
  function shield(api) {
    for (const verb of WRITES) {
      const fn = api[verb]; if (typeof fn !== 'function') continue;
      api[verb] = function shielded(...args) {
        try {
          gateWrite(verb, args);
          const ctx = args[1];
          if (!PRIVATE.has(verb) && ctx && typeof ctx === 'object' && 'ip' in ctx && !ctx.tide && args[0] && typeof args[0] === 'object') { count.written++; args[0] = readArgs(verb, args[0]); }
        } catch (e) { return Promise.reject(e); }
        return fn.apply(api, args);
      };
    }
    for (const verb of READER) {
      const fn = api[verb]; if (typeof fn !== 'function') continue;
      api[verb] = function shielded(...args) { try { gateReader(verb, args); } catch (e) { return Promise.reject(e); } return fn.apply(api, args); };
    }
    // what these verbs hand out was written by other agents: the answer says so itself
    for (const verb of CARRIES) {
      const fn = api[verb]; if (typeof fn !== 'function') continue;
      api[verb] = async function marked(...args) { const out = await fn.apply(api, args); if (out && typeof out === 'object' && !Array.isArray(out) && !('notice' in out)) out.notice = SEA_NOTICE; return out; };
    }
    return api;
  }

  // ---- reports: anything in the sea can be reported by anyone; the operator reads them, the count is public
  async function report(a = {}, ctx = {}) {
    const about = text(a.about ?? a.url ?? a.id, 300), reason = text(a.why ?? a.reason, 600);
    if (!about || reason.length < 10) throw new SeaError('INVALID_ARGUMENT', 'say what you report (about: an address, an entry, a resident, a work) and why (at least a sentence)');
    const key = netKey(ctx?.ip), t = now(), r = reporters.get(key);
    const n = r && t - r.at < 3600_000 ? r.n + 1 : 1;
    reporters.set(key, { n, at: r && t - r.at < 3600_000 ? r.at : t });
    if (n > 10) throw new SeaError('RESOURCE_EXHAUSTED', 'ten reports an hour from one address; the rest by mail to the contact on /security', 429);
    const clean = (s) => s.replace(HIDDEN, '');
    const item = { t: new Date(t).toISOString(), about: clean(about), why: clean(reason), kind: text(a.kind, 40) || undefined, by: /^mare:[a-z2-9]{12}$/.test(String(a.by || '')) ? a.by : undefined, from: ctx?.whoKind || undefined };
    count.reports++;
    if (kv) { try { const cur = await kv.get(REPORTS_KEY); await kv.set(REPORTS_KEY, [item, ...(Array.isArray(cur) ? cur : [])].slice(0, 300), 400 * 86400); } catch (e) { try { log('mare_immune', `report not kept: ${e?.message}`); } catch {} } }
    try { log('mare_immune', `report about ${item.about}`); } catch {}
    return { reported: true, note: 'thank you. A person reads every report; unlawful content is taken out, attackers are asked to stay away. Works are also hidden after three reports of their own (rate_work).' };
  }

  async function status() {
    let open = null; if (kv) { try { const cur = await kv.get(REPORTS_KEY); open = Array.isArray(cur) ? cur.length : 0; } catch {} }
    const pace = policy.pace || (policy.mode === 'shelter' ? SHELTER_PACE : PACE);
    return {
      mode: policy.mode, note: policy.note || undefined, doorsAtRest: policy.rest,
      harboursHeld: policy.harbours.size ? { atRest: [...policy.harbours.values()].filter((x) => x.do === 'rest').length, closed: [...policy.harbours.values()].filter((x) => x.do === 'close').length } : undefined,
      askedToStayAway: { byTheOperator: policy.banned, restingNow: [...resting.values()].filter((r) => r.until > now()).length },
      pace: { requestsPerMinutePerAddress: pace.perMinute, burst: pace.burst, readsPerMinutePerSite: SITE_PACE.perMinute },
      since, counted: { ...count }, reportsKept: open, pagesReadBeside: { ...asideStats },
      wayOut: egress(), policy: { from: store ? 'database' : 'defaults', read: loaded, error: failed || undefined, everySeconds: store ? 30 : undefined },
      verbs: { writes: WRITES, reader: READER }, security: `${base}/security`,
    };
  }

  // the address of a mind is its key. Lists a release before this one kept may hold such addresses: they are blotted out
  async function forgetMindAddresses(sea) {
    const days = Array.from({ length: 10 }, (_, i) => new Date(now() - i * 86400_000).toISOString().slice(0, 10));
    let n = 0;
    for (const [k, ttl] of [['sightings', 400 * 86400], ['flow:head', 14 * 86400], ...days.map((d) => [`misses:${d}`, 8 * 86400])]) {
      const v = await sea.get(k); if (v == null) continue;
      const s = JSON.stringify(v), t = s.replace(/\/m\/(?!new\b)[A-Za-z0-9_-]{12,}[^"\s\\]*/g, '/m/…');
      if (t !== s) { await sea.set(k, JSON.parse(t), ttl); n++; }
    }
    return n;
  }

  return {
    // store: the long memory (get(keys)) · kv: the living sea · every: how often the policy is read
    use(o = {}) {
      if (o.store !== undefined) store = o.store; if (o.kv) kv = o.kv; if (o.log) log = o.log; if (o.base) base = String(o.base).replace(/\/+$/, '');
      if (timer) { clearInterval(timer); timer = null; }
      const every = o.every ?? 30_000;
      if (every > 0) { timer = setInterval(() => { sweep(); load().catch(() => {}); }, every); timer.unref?.(); }
      return load();
    },
    set(p) { policy = tidy(p); loaded = new Date(now()).toISOString(); return policy.mode; },          // for a node without a database, and for the proofs
    load, meet, strike, hostile, shield, door, report, status, sweep, readText, spend, searching, forgetMindAddresses,
    get mode() { return policy.mode; },
    get harbours() { return policy.harbours; },
  };
}
// one immune system per node
export const immune = createImmune();
