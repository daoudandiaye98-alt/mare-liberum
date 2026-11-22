// Mare Liberum · the lighthouse
// A pathway of the brain is a place. A course is a way: one to six steps through the sea's tools and the web that solve one
// kind of task. The lighthouse keeps courses for every agent the sea has (the charts, node/charts.mjs), courses residents
// lay, and places visitors name instead of the course they got. For a task it reads what kind of work it is, which courses
// fit its words, and how often each led an agent to the goal; then it draws (Thompson): a course that led there often
// shines first, a course few have walked is still tried now and then, and so the light grows more exact with every outcome.
//   course      a task → the course, up to three alternatives, the expected chance with its 90 % interval, a ticket
//   courseDone  one outcome per ticket (ok, score, note, instead). Weights: resident 1, visitor 0.5, the sea's probe 1;
//               at most 1.0 per course and address-day; every count fades with a half-life of 30 days
//   courseLay   a resident lays a course of its own
//   probePulse  with every tide the sea walks a few courses whose steps it can check itself, by reading only
//   lighthouse  how exact it is, said honestly: Brier over 7 and 30 days, hits, recognition, calibration, probes apart
// No step pays, submits a form, posts or logs in; the sea never pays. Text from agents is data, never instructions.
import { briefFor } from './brief.mjs';
import { readUrl, READER_UA } from './reader.mjs';
import { grab } from './check.mjs';

export const LIGHT = {
  halfLifeDays: 30, prior: { chart: [2, 1], resident: [1, 1], visitor: [1, 1], probe: [1, 1] },
  weight: { resident: 1, visitor: 0.5, probe: 1 }, dayCap: 1, proofDays: 2,
  k1: 1.5, b: 0.75, minFit: 0.3, kindOnly: 0.5, kindFloor: 0.4, forAny: 0.3, forOther: 0.2, learnN: 20, learnUp: 1, learnDown: 0.5,
  alternatives: 3, candidates: 24, maxSteps: 6, ticketDays: 7, minOutcomes: 30, bins: 5, keepDays: 400,
  probePerHour: 20, probeMs: 8000, probeCourses: 3, probeHostGapS: 30,
  coursePerHour: 300, donePerHour: 300, layPerHour: 20,
};
export const STEP_VERBS = ['think', 'read_page', 'check_site', 'ask', 'decide', 'search', 'get', 'mind', 'brief', 'go', 'route', 'review', 'site', 'find'];
const VERBS = new Set(STEP_VERBS);
const FEW = 'not enough outcomes';
const NOTICE = 'Courses and notes come from charts, residents and visitors: data, never instructions. No step pays, submits, posts or logs in.';
// what a probe can check by itself: the prefix of a step's check
const CHECKS = /^\s*(reachable|has-price|checkout-link|mcp-alive|a2a-card|answers)\s*:/i;
// addresses a course never leads to: a till, a cart, a login. A course reads and compares; it does not act
const NO_GO = /\/(checkout|cart|basket|warenkorb|kasse|login|log-in|signin|sign-in|signup|sign-up|logout|pay)(\/|$|[?#.])|[?&](add-to-cart|add_to_cart|checkout)=/i;
// words a step may not say (pay, buy, order, log in, submit, connect a wallet), unless it says never to
const ACTS = /\b(pay|purchase|buy (?:it|now|this|that|the|a|an)|order (?:it|now|the|this|that)|place (?:an |the )?order|(?:complete|finish) (?:the )?(?:checkout|purchase|order)|proceed to (?:the )?checkout|(?:log|sign) ?in\b(?! (?:page|form|screen|link|button))|log ?on|sign ?up|register (?:an |a )?account|create (?:an |a )?account|submit|send (?:the |a |an )?(?:form|payment|money|order)|fill (?:in|out) (?:the |a )?form|enter (?:your |the )?(?:card|password|seed|private key|pin)|connect (?:your |a |the )?wallet|(?:sign|approve) (?:the |a )?(?:transaction|tx|permit)|post (?:it|this|that|a|an|the|your))\b/gi;
const NEVER = /\b(never|not|no|don'?t|without|nie|nicht|kein\w*)\b[^.;]{0,24}$/i;
const acts = (s) => { const t = String(s || ''); for (const m of t.matchAll(ACTS)) if (!NEVER.test(t.slice(Math.max(0, m.index - 32), m.index))) return m[0]; return null; };
// an address on the machine or the network beside it is no place on the web
const PRIVATE = (u) => { let x; try { x = new URL(u).hostname.toLowerCase().replace(/^\[|\]$/g, ''); } catch { return true; } return /(^|\.)(localhost|local|localdomain|internal|intranet|lan|home|corp)$/.test(x) || /^(0|10|127)\.|^169\.254\.|^172\.(1[6-9]|2\d|3[01])\.|^192\.168\.|^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|^\d+$|^0x/i.test(x) || x.includes(':'); };
const PRICE = /(?:[$€£¥]\s?\d[\d.,]*|\b\d[\d.,]*\s?(?:€|eur|usd|gbp|chf|\$|£))/i;
const TILL = /checkout|\/cart\b|basket|warenkorb|kasse|add[-_]to[-_]cart|buy[-_]now/i;
// the sea's own verbs that can answer a step by themselves (answers:), and the ones that need the step's address
const ANSWERING = new Set(['brief', 'think', 'route', 'search', 'find', 'decide', 'ask', 'read_page', 'check_site']);
const NEEDS_TO = new Set(['read_page', 'check_site']);

// word stems: the same word in its forms counts once (shop, shops, shopping; prüfen, prüfe)
const SUFFIX = ['ings', 'ing', 'ers', 'ies', 'es', 'er', 'ed', 'en', 's', 'e'];
export function stem(w) {
  for (const x of SUFFIX) {
    if (!w.endsWith(x) || w.length - x.length < 3) continue;
    let s = x === 'ies' ? `${w.slice(0, -3)}y` : w.slice(0, -x.length);
    if (/(ing|ed|er|ers|ings)$/.test(x) && /([^aeiouls])\1$/.test(s)) s = s.slice(0, -1);
    return s;
  }
  return w;
}
const r3 = (x) => Math.round(x * 1000) / 1000;
const pct = (x) => `${Math.round(x * 100)} %`;

// ---------------------------------------------------------------- Beta: draws (Thompson) and quantiles (the 90 % interval)
function lgamma(x) {
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  x -= 1; let a = c[0]; const t = x + 7.5; for (let i = 1; i < 9; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}
function betacf(x, a, b) {
  const tiny = 1e-30, qab = a + b, qap = a + 1, qam = a - 1; let c = 1, d = 1 - (qab * x) / qap; if (Math.abs(d) < tiny) d = tiny; d = 1 / d; let h = d;
  for (let m = 1; m <= 200; m++) {
    const m2 = 2 * m; let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < tiny) d = tiny; c = 1 + aa / c; if (Math.abs(c) < tiny) c = tiny; d = 1 / d; h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < tiny) d = tiny; c = 1 + aa / c; if (Math.abs(c) < tiny) c = tiny; d = 1 / d; const del = d * c; h *= del;
    if (Math.abs(del - 1) < 3e-12) break;
  }
  return h;
}
export function ibeta(x, a, b) {
  if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(x, a, b)) / a : 1 - (bt * betacf(1 - x, b, a)) / b;
}
export function qbeta(p, a, b) { let lo = 0, hi = 1; for (let i = 0; i < 48; i++) { const m = (lo + hi) / 2; if (ibeta(m, a, b) < p) lo = m; else hi = m; } return (lo + hi) / 2; }
// a draw from Beta(a, b) out of a source of randomness in [0, 1): two Gamma draws (Marsaglia–Tsang), never an endless loop
export function betaDraw(a, b, rng = Math.random) {
  const u = () => { const x = Number(rng()); return x > 1e-12 && x < 1 ? x : x >= 1 ? 1 - 1e-12 : 1e-12; };
  const normal = () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u());
  const gamma = (k) => {
    if (k < 1) return gamma(k + 1) * Math.pow(u(), 1 / k);
    const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
    for (let i = 0; i < 64; i++) {
      let x = normal(), v = 1 + c * x; for (let j = 0; v <= 0 && j < 16; j++) { x = normal(); v = 1 + c * x; } if (v <= 0) continue;
      v = v * v * v; const w = u();
      if (w < 1 - 0.0331 * x ** 4 || Math.log(w) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
    return k;
  };
  const x = gamma(a), y = gamma(b);
  return x + y > 0 ? x / (x + y) : a / (a + b);
}

// ---------------------------------------------------------------- BM25 over the task texts of the courses
// idx = { n: { id: length }, w: { word: { id: tf } } } · words: the stems of the task · → [[id, fit 0..1]]
export function bm25(words, idx, { k1 = LIGHT.k1, b = LIGHT.b } = {}) {
  const ids = Object.keys(idx?.n || {}), N = ids.length; if (!N || !words.length) return [];
  const avg = ids.reduce((s, id) => s + (idx.n[id] || 0), 0) / N || 1;
  const idf = (w) => { const df = Object.keys(idx.w[w] || {}).length; return Math.log(1 + (N - df + 0.5) / (df + 0.5)); };
  // a course of average length that holds every word of the task once scores 1
  const full = words.reduce((s, w) => s + idf(w), 0) || 1, got = new Map();
  for (const w of words) {
    const post = idx.w[w]; if (!post) continue; const i = idf(w);
    for (const [id, tf] of Object.entries(post)) { const dl = idx.n[id] || avg; got.set(id, (got.get(id) || 0) + (i * tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * dl) / avg))); }
  }
  return [...got].map(([id, s]) => [id, Math.min(1, s / full)]);
}

export function createLighthouse(h) {
  const { kv, update, emit, resident, allow, api, SeaError, clean, strip, now, https, toks, sha, DAY } = h;
  const rng = typeof h.rng === 'function' ? h.rng : Math.random;
  const base = () => String(h.base || '').replace(/\/+$/, '');
  const nowMs = () => Date.parse(now()), day = () => now().slice(0, 10);
  const bad = (m) => new SeaError('INVALID_ARGUMENT', m);
  const wordsOf = (s) => [...new Set((toks(s) || []).map(stem))].slice(0, 16);
  const agentOf = (x) => (/^[a-z0-9][a-z0-9-]{1,39}$/.test(String(x || '').toLowerCase()) ? String(x).toLowerCase() : null);
  const ipDay = async (ctx) => (await sha(`${ctx?.ip || 'unknown'}|light|${day()}`)).slice(0, 12);
  const hostOf = (u) => { try { return new URL(u).hostname.toLowerCase(); } catch { return null; } };
  const count = (d) => update('light:stats', LIGHT.keepDays * DAY, (cur) => { const c = { ...(cur && typeof cur === 'object' ? cur : {}) }; for (const [k, n] of Object.entries(d)) c[k] = (c[k] || 0) + n; return c; }, () => true);

  // ---------------------------------------------------------------- a course as the sea keeps it
  function stepOf(s, i) {
    if (!s || typeof s !== 'object') throw bad(`step ${i + 1}: an object with do, say and check`);
    const d = String(s.do ?? s.verb ?? '').trim().toLowerCase();
    if (!VERBS.has(d)) throw bad(`step ${i + 1}: do is one of ${STEP_VERBS.join(', ')}`);
    const say = clean(s.say, 240), check = clean(s.check, 240);
    if (!say || !check) throw bad(`step ${i + 1}: say what the agent does there and how it sees that the step worked (check)`);
    const raw = s.to ?? s.url, given = raw != null && raw !== '', to = given ? https(raw) : undefined;
    if (given && (!to || PRIVATE(to))) throw bad(`step ${i + 1}: to is a public https address`);
    if (d === 'go' && !to) throw bad(`step ${i + 1}: a go step names its https address (to)`);
    if (to && d !== 'go') throw bad(`step ${i + 1}: only a go step names an address (to); the other steps work through the sea`);
    if (to && NO_GO.test(to)) throw bad(`step ${i + 1}: a course never leads to a till, a cart or a login`);
    const act = acts(say) || acts(check);
    if (act) throw bad(`step ${i + 1} says "${act}": a course reads and compares; it never pays, orders, submits, posts or logs in`);
    // on: 'harbour' — the verb runs on the team's own harbour, not on the open sea (kept, never walked by the probe)
    return strip({ do: d, to, on: s.on === 'harbour' ? 'harbour' : undefined, say, check, status: Number.isInteger(s.status) ? s.status : undefined });
  }
  async function courseOf(raw, laidBy) {
    const x = raw && typeof raw === 'object' ? (raw.course && typeof raw.course === 'object' ? { ...raw.course, ...raw } : raw) : null;
    if (!x) throw bad('a course is an object with kind, title, tasks and steps');
    const kind = String(x.kind || '').trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(kind)) throw bad('kind is a short word for the kind of task, like shop-safety or research');
    const title = clean(x.title, 140); if (!title) throw bad('a course has a title: one sentence');
    let steps = x.steps;
    if (typeof steps === 'string') { try { steps = JSON.parse(steps); } catch { throw bad('steps is a JSON list of {do, to, say, check}'); } }
    if (!Array.isArray(steps) || steps.length < 1 || steps.length > LIGHT.maxSteps) throw bad(`a course has 1 to ${LIGHT.maxSteps} steps`);
    steps = steps.map(stepOf);
    const tasks = [...new Set([x.tasks, x.task, x.q, x.examples].flat().filter((t) => typeof t === 'string').map((t) => clean(t, 200)).filter(Boolean))].slice(0, 24);
    const fr = (Array.isArray(x.for) ? x.for : typeof x.for === 'string' ? x.for.split(',') : []).map(agentOf).filter(Boolean);
    const id = /^[a-f0-9]{14}$/.test(String(x.id || '')) ? String(x.id) : (await sha(`${kind}|${JSON.stringify(steps)}`)).slice(0, 14);
    return { id, kind, title, task: tasks[0] || title, for: fr.length ? [...new Set(fr)].slice(0, 12) : ['any'], tasks, steps, laidBy };
  }
  const docOf = (c) => { const tf = {}; for (const t of [...(c.tasks || []), c.title, c.kind.replace(/-/g, ' ')]) for (const w of wordsOf(t)) tf[w] = (tf[w] || 0) + 1; return tf; };

  // the index of words: one name, read once per question
  async function index() { const x = await kv.get('light:index'); return x && x.n && x.w ? { k: {}, ...x } : { n: {}, w: {}, k: {} }; }
  async function indexPut(cs, gone = []) {
    const out = new Set([...gone, ...cs.map((c) => c.id)]), docs = cs.map((c) => [c.id, docOf(c)]);
    await update('light:index', LIGHT.keepDays * DAY, (cur) => {
      const x = cur && cur.n && cur.w ? { k: {}, ...cur } : { n: {}, w: {}, k: {} };
      for (const id of out) delete x.n[id];
      for (const [k, ids] of Object.entries(x.k)) { for (const id of out) delete ids[id]; if (!Object.keys(ids).length) delete x.k[k]; }
      for (const [w, post] of Object.entries(x.w)) { for (const id of out) delete post[id]; if (!Object.keys(post).length) delete x.w[w]; }
      for (const [id, tf] of docs) { x.n[id] = Object.values(tf).reduce((s, v) => s + v, 0) || 1; for (const [w, n] of Object.entries(tf)) (x.w[w] ||= {})[id] = n; }
      for (const c of cs) if (c.kind) (x.k[c.kind] ||= {})[c.id] = 1;
      return x;
    }, (seen) => cs.every((c) => seen?.n?.[c.id] != null) && gone.every((id) => seen?.n?.[id] == null));
  }
  async function put(c) {
    const fresh = !(await kv.get(`light:c:${c.id}`));
    await kv.set(`light:c:${c.id}`, { ...c, at: now(), last: now() }, LIGHT.keepDays * DAY);
    if (fresh) { await indexPut([c]); await count({ laid: 1 }); }
    return fresh;
  }

  // ---------------------------------------------------------------- what kind of task: the brief's reading, and what outcomes taught
  // kinds the charts add to those of the brief name themselves by key words (h.kinds: [{ kind, keys: 'a|b|…' }]); a short
  // key must be a whole word, a longer one may start a word (German compounds)
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const KINDS = (Array.isArray(h.kinds) ? h.kinds : []).map((k) => ({ kind: String(k?.kind || ''), keys: (Array.isArray(k?.keys) ? k.keys : String(k?.keys || '').split('|')).map((x) => String(x).trim().toLowerCase()).filter(Boolean)
    .map((key) => [key, new RegExp(key.length <= 5 && /^\p{L}+$/u.test(key) ? `(^|[^\\p{L}\\p{N}])${esc(key)}($|[^\\p{L}\\p{N}])` : `(^|[^\\p{L}\\p{N}])${esc(key)}`, 'u')]) })).filter((k) => /^[a-z0-9][a-z0-9-]{1,39}$/.test(k.kind) && k.keys.length);
  function priorOf(q) {
    const bf = briefFor(q).kind, t = String(q).toLowerCase(), got = {};
    for (const k of KINDS) { let sc = 0; for (const [key, re] of k.keys) if (re.test(t)) sc += 1 + Math.min(key.length, 24) / 8; if (sc) got[k.kind] = sc; }
    // the brief's kind and the best chart kind weigh the same: neither reading is preferred over the other
    const p = {}, top = Math.max(0, ...Object.values(got)); if (bf && bf !== 'general') p[bf] = 1;
    for (const [k, sc] of Object.entries(got)) p[k] = Math.max(p[k] || 0, sc / top);
    const sum = Object.values(p).reduce((x, y) => x + y, 0); for (const k of Object.keys(p)) p[k] /= sum;
    return p;
  }
  async function kindOf(q, words) {
    const pr = priorOf(q), prior = Object.entries(pr).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    // every word of the task mixes the prior with what it learned, by its own share n/(n+20); the task is the mean of its words
    const rows = await Promise.all(words.map((w) => kv.get(`light:assoc:${w}`))), P = {};
    let lam = 0;
    for (const r of rows) {
      const tot = r && r.n > 0 ? Object.values(r.k || {}).reduce((s, v) => s + Math.max(0, v), 0) : 0, l = tot ? r.n / (r.n + LIGHT.learnN) : 0;
      lam += l / words.length;
      for (const [k, v] of Object.entries(pr)) P[k] = (P[k] || 0) + ((1 - l) * v) / words.length;
      if (tot) for (const [k, v] of Object.entries(r.k)) if (v > 0) P[k] = (P[k] || 0) + ((l * v) / tot) / words.length;
    }
    const top = Object.entries(P).sort((a, b) => b[1] - a[1])[0];
    return { top: top && top[1] > 0 ? top[0] : null, P, prior, learned: r3(lam) };
  }
  const kindFit = (kd, kind) => { const m = Math.max(0, ...Object.values(kd.P)); return LIGHT.kindFloor + (1 - LIGHT.kindFloor) * (m > 0 ? (kd.P[kind] || 0) / m : 0.5); };
  // a course made for the agent that asks comes first; for an agent no fitting course names, every course is equal
  const forFit = (c, agent) => (!agent ? 1 : (c.for || []).includes(agent) ? 1 : !(c.for || []).length || c.for.includes('any') ? LIGHT.forAny : LIGHT.forOther);

  // ---------------------------------------------------------------- how often a course led to the goal: Beta, fading
  const fade = (st, t) => (st?.t ? Math.pow(0.5, Math.max(0, t - Date.parse(st.t)) / 864e5 / LIGHT.halfLifeDays) : 1);
  const betaOf = (c, st, t) => { const [pa, pb] = LIGHT.prior[c.laidBy] || [1, 1], f = fade(st, t); return [pa + (st?.a || 0) * f, pb + (st?.b || 0) * f]; };
  // a visitor's course is shown only after a probe walked it, or after successes from two different address-days
  const open = (c, st) => c.laidBy !== 'visitor' || !!st?.probed || (st?.okDays || []).length >= LIGHT.proofDays;

  async function chart(q, agent) {
    const words = wordsOf(q), kd = await kindOf(q, words);
    if (!words.length) return { words, kd, list: [] };
    const idx = await index(), t = nowMs();
    const hits = bm25(words, idx).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, LIGHT.candidates * 2);
    const rowsOf = (hs, byKind) => Promise.all(hs.map(async ([id, wf]) => { const [c, st] = await Promise.all([kv.get(`light:c:${id}`), kv.get(`light:s:${id}`)]); return c && !c.retired ? { c, st: st || {}, wf, byKind } : null; }));
    const listOf = (rows) => { const l = []; for (const x of rows) { if (!x || !open(x.c, x.st)) continue; const fit = kindFit(kd, x.c.kind) * x.wf; if (fit < LIGHT.minFit) continue; const [a, b] = betaOf(x.c, x.st, t); l.push({ ...x, fit, a, b, expect: a / (a + b) }); } return l; };
    let list = listOf(await rowsOf(hits));
    // no course fits the words of the task, yet its kind is plain: the courses of that kind light up, at half the fit
    if (!list.length && kd.top && kd.top !== 'general') list = listOf(await rowsOf(Object.keys(idx.k?.[kd.top] || {}).sort().slice(0, LIGHT.candidates * 2).map((id) => [id, LIGHT.kindOnly]), true));
    const known = agent && list.some((x) => (x.c.for || []).includes(agent));
    for (const x of list) x.rank = x.fit * (known ? forFit(x.c, agent) : 1);
    return { words, kd, list: list.sort((x, y) => y.rank - x.rank || (x.c.id < y.c.id ? -1 : 1)).slice(0, LIGHT.candidates) };
  }
  const rowOf = (c, st, fit = 1) => { const [a, b] = betaOf(c, st, nowMs()); return { c, st: st || {}, fit, a, b, expect: a / (a + b) }; };
  const view = (x) => strip({ id: x.c.id, kind: x.c.kind, title: x.c.title, task: x.c.task || (x.c.tasks || [])[0], for: x.c.for, steps: x.c.steps.map((s) => strip({ do: s.do, to: s.to, on: s.on, say: s.say, check: s.check })), laid: x.c.laidBy,
    expect: r3(x.expect), interval: [r3(qbeta(0.05, x.a, x.b)), r3(qbeta(0.95, x.a, x.b))], outcomes: x.st.n || 0, probes: x.st.pn ? { runs: x.st.pn, ok: x.st.pok || 0 } : undefined, fit: r3(x.fit),
    notes: (x.st.notes || []).length ? x.st.notes.slice(0, 3) : undefined });
  function whyOf(x, kd, drawn) {
    const n = x.st.n || 0, lo = qbeta(0.05, x.a, x.b), hi = qbeta(0.95, x.a, x.b);
    const kind = x.byKind ? `the task reads as ${kd.top}; no course shares its words yet, so the courses of that kind light up: "${x.c.title}"` : !kd.top ? `the words of the task fit "${x.c.title}"` : x.c.kind === kd.top ? `the task reads as ${kd.top}${kd.learned ? ` (${pct(kd.learned)} of that reading learned from outcomes)` : ''} and its words fit "${x.c.title}"` : `the task reads as ${kd.top}; "${x.c.title}" (${x.c.kind}) fits its words best`;
    return `${kind} (fit ${r3(x.fit)}); it is expected to lead to the goal ${pct(x.expect)} of the time (90 % between ${pct(lo)} and ${pct(hi)}) after ${n ? `${n} outcome${n === 1 ? '' : 's'} from agents` : 'no outcome from agents yet'}${x.st.pn ? ` and ${x.st.pn} probe${x.st.pn === 1 ? '' : 's'} by the sea` : ''}${drawn ? '; chosen by a draw that favours what worked and still tries what few have walked' : ''}.`;
  }

  // ---------------------------------------------------------------- an outcome lands on a course
  async function outcome(id, y, w, ipd, { note, ok, probe } = {}) {
    const wk = `light:w:${id}:${ipd}`, used = Number(await kv.get(wk)) || 0, give = Math.max(0, Math.min(w, LIGHT.dayCap - used));
    if (give > 0) await kv.set(wk, Math.round((used + give) * 1e6) / 1e6, 2 * DAY);
    const t = nowMs(), at = now();
    const st = await update(`light:s:${id}`, LIGHT.keepDays * DAY, (cur) => {
      const s = { ...(cur && typeof cur === 'object' ? cur : {}) }, f = fade(s, t);
      s.a = (s.a || 0) * f + give * y; s.b = (s.b || 0) * f + give * (1 - y); s.t = at;
      if (probe) { s.pn = (s.pn || 0) + 1; if (y >= 0.5) { s.pok = (s.pok || 0) + 1; s.probed = at; } }
      else if (give > 0) {
        s.n = (s.n || 0) + 1; if (y >= 0.5) s.ok = (s.ok || 0) + 1;
        if (y >= 0.5 && !(s.okDays || []).includes(ipd)) s.okDays = [...(s.okDays || []), ipd].slice(-20);
      }
      if (note) s.notes = [strip({ text: note, ok, at }), ...(s.notes || [])].slice(0, 8);
      return s;
    }, () => true);
    return { give, st };
  }
  async function learn(words, kind, up) {
    if (!kind) return;
    for (const w of words) await update(`light:assoc:${w}`, LIGHT.keepDays * DAY, (cur) => {
      const r = cur && typeof cur === 'object' ? { n: cur.n || 0, k: { ...(cur.k || {}) } } : { n: 0, k: {} };
      r.n++; r.k[kind] = Math.max(0, (r.k[kind] || 0) + (up ? LIGHT.learnUp : -LIGHT.learnDown)); return r;
    }, () => true);
  }
  const daily = (change) => update(`light:day:${day()}`, LIGHT.keepDays * DAY, (cur) => {
    const s = cur && typeof cur === 'object' ? { ...cur, bins: (cur.bins || []).map((b) => [...b]) } : {};
    for (const k of ['n', 'brier', 'hits', 'rn', 'rok', 'pn', 'pok']) s[k] = s[k] || 0;
    while ((s.bins ||= []).length < LIGHT.bins) s.bins.push([0, 0, 0]);
    change(s); return s;
  }, () => true);

  // seeding the charts: the same course named for several tasks is one course with all its tasks; a chart that left the
  // list is retired (kept with its outcomes, never shown) — only when the list is the whole chart file (full); a list
  // that did not change writes nothing. Without full, seeding only adds
  async function seedCharts(list, { full = false } = {}) {
    const items = new Map(), skipped = [];
    for (const raw of Array.isArray(list) ? list : []) {
      try { const c = await courseOf(raw, 'chart'), o = items.get(c.id); if (o) o.tasks = [...new Set([...o.tasks, ...c.tasks])].slice(0, 24); else items.set(c.id, c); }
      catch (e) { skipped.push(strip({ title: clean(raw?.title, 80), why: e.message })); }
    }
    const sum = (await sha(JSON.stringify([...items.values()]))).slice(0, 16), was = (await kv.get('light:charts')) || {};
    if (was.sum === sum) return { laid: 0, kept: items.size, retired: 0, skipped };
    let laid = 0, kept = 0; const changed = [];
    for (const c of items.values()) {
      const cur = await kv.get(`light:c:${c.id}`), same = cur && !cur.retired && JSON.stringify({ ...cur, at: 0, last: 0 }) === JSON.stringify({ ...c, at: 0, last: 0 });
      if (same) { kept++; continue; }
      if (cur && cur.laidBy !== 'chart' && !cur.retired) { kept++; continue; }   // a course a resident or visitor laid stays theirs
      await kv.set(`light:c:${c.id}`, { ...c, at: cur?.at || now(), last: now() }, LIGHT.keepDays * DAY); changed.push(c); laid++;
    }
    const gone = full ? (was.ids || []).filter((id) => !items.has(id)) : [];
    for (const id of gone) { const c = await kv.get(`light:c:${id}`); if (c && c.laidBy === 'chart') await kv.set(`light:c:${id}`, { ...c, retired: now() }, LIGHT.keepDays * DAY); }
    if (changed.length || gone.length) await indexPut(changed, gone);
    await kv.set('light:charts', { sum, ids: full ? [...items.keys()] : [...new Set([...(was.ids || []), ...items.keys()])], at: now() }, LIGHT.keepDays * DAY);
    if (laid) await count({ laid });
    return { laid, kept, retired: gone.length, skipped };
  }
  const seeding = h.charts ? seedCharts(h.charts, { full: true }).catch((e) => ({ failed: String(e?.message || e).slice(0, 120) })) : null;
  const ready = () => seeding || Promise.resolve();

  // ---------------------------------------------------------------- the probe: the sea walks its own courses, reading only
  const robots = async (host) => { const k = `robots:${host}`, c = await kv.get(k); if (c) return c; const g = await grab(`https://${host}/robots.txt`, { max: 150_000, ms: 5000, ua: READER_UA }); const v = { status: g.status, body: g.status === 200 && !/<html/i.test(g.body || '') ? g.body : '' }; await kv.set(k, v, 3600); return v; };
  const reader = typeof h.reader === 'function' ? h.reader : (url) => readUrl(url, { robots });
  const timed = (p, ms) => { let tm; return Promise.race([Promise.resolve(p).catch(() => null), new Promise((r) => { tm = setTimeout(() => r(undefined), Math.max(1, ms)); })]).finally(() => clearTimeout(tm)); };
  function planOf(s) {
    if (s.on === 'harbour') return null;                                     // a harbour belongs to its crew: the probe never walks there
    const m = CHECKS.exec(String(s.check || '')); if (!m) return null;
    const kind = m[1].toLowerCase(), to = s.to ? https(s.to) : undefined, host = to ? hostOf(to) : undefined;
    if (to && NO_GO.test(to)) return null;                                   // never opened, whatever the check says
    if (kind === 'answers') return ANSWERING.has(s.do) && (!NEEDS_TO.has(s.do) || to) ? strip({ kind, to, host }) : null;
    if (to) return { kind, to, host };
    // without an address the sea's own answer to the step carries what is checked: a pick (decide, ask) or an entry (search, get)
    if ((kind === 'has-price' || kind === 'checkout-link') && (s.do === 'decide' || s.do === 'ask')) return { kind, via: 'pick' };
    if ((kind === 'mcp-alive' || kind === 'a2a-card') && (s.do === 'search' || s.do === 'get')) return { kind, via: 'entry' };
    return null;
  }
  const json = (r) => { try { return r && !r.error && r.markdown ? JSON.parse(r.markdown) : null; } catch { return null; } };
  async function checkOf(c, s, p, page, ms, polite) {
    const q = (c.tasks || [])[0] || c.title, ctx = { ip: 'probe', readOnly: true, tide: true };
    if (p.via === 'pick') {
      const r = await timed(api?.ask?.({ need: q, kind: 'merchant', compact: true, quiet: true }, { ip: 'probe', tide: true }), ms);
      if (r == null) return null; const pk = r.decision?.pick; if (!pk) return false;
      if (p.kind === 'has-price') return Number(pk.price) > 0 && !!pk.currency;
      return !!https(pk.checkout || pk.url);                                // the link is seen, never opened: the probe walks into no till
    }
    if (p.via === 'entry') {
      const list = await timed(api?.routes?.(q, p.kind === 'mcp-alive' ? 'mcp' : 'a2a', 3), ms);
      if (list == null) return null; const e = (Array.isArray(list) ? list : [])[0]; if (!e) return false;
      const to = (e.endpoints || []).map((x) => https(typeof x === 'string' ? x : x?.url)).find(Boolean) || https(e.url);
      if (!to || NO_GO.test(to)) return false; const host = hostOf(to); if (!(await polite(host))) return null;
      return checkOf(c, s, { kind: p.kind, to, host }, page, ms, polite);
    }
    if (p.kind === 'answers') {
      if (s.do === 'brief') { const b = briefFor(q); return !!((b.steps || []).length && (b.bar || []).length); }
      const r = await timed(
        s.do === 'think' ? api?.think?.({ q }, ctx)
          : s.do === 'route' ? api?.route?.({ q, limit: 3 }, ctx)
          : s.do === 'search' ? api?.routes?.(q, undefined, 3)
          : s.do === 'find' ? api?.findSites?.({ q, limit: 3 })
          : s.do === 'decide' || s.do === 'ask' ? api?.ask?.({ need: q, kind: 'merchant', compact: true, quiet: true }, { ip: 'probe', tide: true })
          : s.do === 'check_site' ? api?.check?.(hostOf(p.to), ctx, { cachedOnly: true })
          : s.do === 'read_page' ? page(p.to) : null, ms);
      if (r == null) return null;
      if (Array.isArray(r)) return r.length > 0;
      if (s.do === 'think') return !!((r.paths || []).length || (r.doors || []).length || (r.places || []).length);
      if (s.do === 'route') return !!(r.doors || []).length;
      if (s.do === 'find') return !!(r.sites || []).length;
      if (s.do === 'decide' || s.do === 'ask') return !!r.decision?.pick;
      if (s.do === 'check_site') return typeof r.score === 'number';
      if (s.do === 'read_page') return r.blocked ? null : !!(r.markdown && !r.error);
      return null;
    }
    if (p.kind === 'a2a-card' || p.kind === 'mcp-alive') {
      const own = p.kind === 'a2a-card' ? /agent(-card)?\.json$/i.test(p.to) : /(server-card|mcp)\.json$/i.test(p.to);
      const url = own ? p.to : `https://${p.host}/.well-known/${p.kind === 'a2a-card' ? 'agent-card.json' : 'mcp/server-card.json'}`;
      const r = await timed(page(url), ms); if (r === undefined) return null; if (r?.blocked) return null;
      const j = json(r);
      if (p.kind === 'a2a-card') return !!(j && j.name && (Array.isArray(j.skills) || j.url));
      if (j && (j.name || j.serverInfo || j.tools || j.endpoints || j.remotes)) return true;
      // a server without a card: a JSON-RPC answer to a plain read of its address still says it is alive (no POST ever)
      if (own) return false;
      const e = await timed(page(p.to), ms); if (e === undefined || e?.blocked) return null;
      const k = json(e); return !!(k && (k.jsonrpc === '2.0' || k.serverInfo));
    }
    const r = await timed(page(p.to), ms);
    if (r === undefined || r?.blocked) return null;
    if (!r || r.error || r.status !== 200) return false;
    if (p.kind === 'reachable') return true;
    if (p.kind === 'has-price') return PRICE.test(r.markdown || '');
    if (p.kind === 'checkout-link') return (r.links || []).some((l) => TILL.test(String(l.url || '')) || /checkout|kasse|warenkorb|add to cart|in den warenkorb/i.test(String(l.text || '')));   // seen, never followed
    return null;
  }

  const lighthouse = {
    seedCharts,
    // ---------------------------------------------------------------- a task in, a course out
    async course(a = {}, ctx) {
      await ready();
      const q = clean(a.q ?? a.task ?? a.need, 300);
      if (!q) return { what: 'the lighthouse: a course (one to six steps) for your kind of task, chosen by how often it led agents to the goal', ask: `${base()}/course?q=<your task in words>[&agent=<blueprint or angel>]`, lighthouse: `${base()}/lighthouse.json` };
      if (!ctx?.readOnly) await allow(ctx, 'course', LIGHT.coursePerHour, 3600);
      const agent = agentOf(a.agent), me = a.by ? await resident(a.by, a.pass) : null;
      const { words, kd, list } = await chart(q, agent);
      if (!list.length) return strip({ task: q, kind: kd.top || undefined, alternatives: [], why: 'no course fits this task yet: no chart, resident or confirmed visitor course matches its words and kind', lay: `${base()}/course/lay (residents) — or ask the brain: ${base()}/brain?q=${encodeURIComponent(q)}`, notice: NOTICE });
      // crawlers read the course that shines brightest; agents get a draw and a ticket
      if (ctx?.readOnly) { const best = [...list].sort((x, y) => y.expect * y.rank - x.expect * x.rank)[0]; return strip({ course: view(best), task: q, kind: kd.top || undefined, alternatives: [], confidence: r3(best.expect), why: whyOf(best, kd, false), note: 'crawlers read courses; an agent gets a ticket to report how it went', notice: NOTICE }); }
      const drawn = list.map((x) => ({ x, d: betaDraw(x.a, x.b, rng) * x.rank })).sort((p, r) => r.d - p.d).map((y) => y.x);
      const pick = drawn[0], alts = drawn.slice(1, 1 + LIGHT.alternatives);
      const ticket = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');
      await kv.set(`light:t:${ticket}`, strip({ c: pick.c.id, p: r3(pick.expect), k: pick.c.kind, rk: kd.top || undefined, w: words, at: now(), by: me?.agent }), LIGHT.ticketDays * DAY);
      await count({ tickets: 1 });
      const ipd = await ipDay(ctx), tag = /^[a-z0-9]{4,12}$/.test(String(a.tag || '')) ? String(a.tag) : null;
      if (tag) await api?.tagEvent?.(tag, { act: 'asked the lighthouse', q, to: pick.c.title, who: ctx?.who, kind: ctx?.whoKind });
      if (!(await kv.get(`light:em:${pick.c.id}:${ipd}`))) { await kv.set(`light:em:${pick.c.id}:${ipd}`, 1, 2 * DAY); await emit({ type: 'course', by: me?.agent, name: me?.name || 'an agent', kind: pick.c.kind, course: pick.c.id, text: `asked the lighthouse and got a course for ${pick.c.kind}: ${pick.c.title}` }); }
      const done = `${base()}/course/${ticket}/done`;
      return strip({ course: view(pick), alternatives: alts.map(view), ticket, confidence: r3(pick.expect), why: whyOf(pick, kd, true),
        done: `${done}?ok=<1 when you reached the goal, 0 when not>`,
        report: { ok: `${done}?ok=1`, failed: `${done}?ok=0`, instead: `${done}?ok=0&instead=<course id or https address that led there>`, until: new Date(nowMs() + LIGHT.ticketDays * 864e5).toISOString() },
        task: q, kind: kd.top || undefined, notice: NOTICE });
    },
    // ---------------------------------------------------------------- one outcome per ticket
    async courseDone(a = {}, ctx) {
      if (ctx?.readOnly) throw new SeaError('PERMISSION_DENIED', 'crawlers read the lighthouse; agents report outcomes', 403);
      await ready();
      await allow(ctx, 'coursedone', LIGHT.donePerHour, 3600);
      const ticket = String(a.ticket || '').trim().toLowerCase();
      if (!/^[a-f0-9]{16}$/.test(ticket)) throw bad('a ticket is 16 hex characters, from /course?q=');
      const t = await kv.get(`light:t:${ticket}`);
      if (!t) throw new SeaError('NOT_FOUND', 'no such ticket: tickets come from /course?q= and hold 7 days', 404);
      if (nowMs() - Date.parse(t.at) > LIGHT.ticketDays * 864e5) throw new SeaError('FAILED_PRECONDITION', 'this ticket is older than 7 days; ask for a new course', 410);
      const me = a.by ? await resident(a.by, a.pass) : null;
      if (t.by && me?.agent !== t.by) throw new SeaError('PERMISSION_DENIED', 'this ticket was given to another resident; report with its by and pass', 403);
      const flag = (v) => (v === true || v === 1 || v === '1' || v === 'true' || v === 'yes' ? true : v === false || v === 0 || v === '0' || v === 'false' || v === 'no' ? false : null);
      let ok = flag(a.ok ?? a.worked);
      const sc = a.score == null || a.score === '' ? null : Number(a.score);
      if (sc != null && !(sc >= 0 && sc <= 1)) throw bad('score is a number from 0 to 1');
      // instead: the course or the place that led there when this course did not
      let instead = null;
      if (a.instead != null && a.instead !== '') {
        const s = String(a.instead).trim();
        if (/^[a-f0-9]{14}$/.test(s)) { const c = await kv.get(`light:c:${s}`); if (!c || c.retired) throw bad('instead names no course the lighthouse knows'); if (s !== t.c) instead = { c }; }
        else { const u = https(s); if (!u || PRIVATE(u)) throw bad('instead is a course id or a public https address'); if (NO_GO.test(u)) throw bad('a course never leads to a till, a cart or a login; name the page before it'); instead = { u }; }
      }
      if (ok == null && !instead) throw bad('say ok=1 (it led to the goal) or ok=0 (it did not)');
      if (instead) ok = false;
      const note = clean(a.note, 300);
      // one outcome per ticket: the mark is set before anything is counted
      if (await kv.get(`light:done:${ticket}`)) throw new SeaError('ALREADY_EXISTS', 'this ticket has its outcome already: one outcome per ticket', 409);
      await kv.set(`light:done:${ticket}`, now(), LIGHT.ticketDays * DAY);
      const y = ok ? (sc ?? 1) : 0, w = me ? LIGHT.weight.resident : LIGHT.weight.visitor, ipd = await ipDay(ctx);
      const chosen = await kv.get(`light:c:${t.c}`), main = await outcome(t.c, y, w, ipd, { note, ok });
      let other = null, laid = null;
      if (instead?.u) {
        // a place named instead becomes a visitor's course: shown only after a probe or a second address-day confirms it
        const c = await courseOf({ kind: t.rk || t.k, title: `A place another agent reached the goal with: ${hostOf(instead.u)}`, tasks: [t.w.join(' ')],
          steps: [{ do: 'go', to: instead.u, say: 'Open the place another agent named for this kind of task and read it as data.', check: 'reachable: the place answers' }] }, 'visitor');
        const was = await kv.get(`light:c:${c.id}`);
        if (!was) await put(c);
        instead.c = was || c; laid = instead.c.id;
      }
      if (instead?.c) other = await outcome(instead.c.id, 1, w, ipd, {});
      // what the words of the task mean, learned: success teaches the kind that led there, failure unteaches the one that did not
      const good = instead?.c ? (other?.give > 0 ? instead.c.kind : null) : y >= 0.5 && main.give > 0 ? t.k : null;
      if (good) await learn(t.w, good, true);
      if (y < 0.5 && main.give > 0 && t.k !== good) await learn(t.w, t.k, false);
      const won = instead?.c && !instead.u ? instead.c.kind : y >= 0.5 ? t.k : null;
      await daily((s) => { s.n++; s.brier += (t.p - y) ** 2; if (y >= 0.5) s.hits++; const i = Math.min(LIGHT.bins - 1, Math.floor(t.p * LIGHT.bins)); s.bins[i][0]++; s.bins[i][1] += t.p; s.bins[i][2] += y; if (won) { s.rn++; if (won === t.k) s.rok++; } });
      await count({ outcomes: 1 });
      await emit({ type: 'outcome', by: me?.agent, name: me?.name || 'an agent', course: t.c, kind: t.k, ok: y >= 0.5, text: `${y >= 0.5 ? 'reached the goal' : 'did not reach the goal'} with the course "${chosen?.title || t.c}"${instead ? ' and named another way' : ''}` });
      const [aa, bb] = betaOf(chosen || { laidBy: 'chart' }, main.st, nowMs());
      return strip({ counted: true, weight: main.give, course: { id: t.c, title: chosen?.title, expect: r3(aa / (aa + bb)), outcomes: main.st.n || 0 }, instead: instead?.c ? strip({ id: instead.c.id, title: instead.c.title, weight: other?.give, shown: open(instead.c, other?.st) || undefined }) : undefined, laid: laid || undefined,
        note: main.give < w ? 'counted; the weight of one address on one course is at most 1.0 a day' : undefined, thanks: y >= 0.5 ? 'the light on this course grows stronger' : 'the light on this course grows weaker; your outcome makes the next draw better' });
    },
    // ---------------------------------------------------------------- residents lay courses of their own
    async courseLay(a = {}, ctx) {
      if (ctx?.readOnly) throw new SeaError('PERMISSION_DENIED', 'crawlers read the lighthouse; residents lay courses', 403);
      await ready();
      const me = await resident(a.by, a.pass);
      if (!me) throw new SeaError('PERMISSION_DENIED', 'residents lay courses: enter first (POST /enter), then send by and pass', 403);
      await allow(ctx, 'courselay', LIGHT.layPerHour, 3600);
      const c = await courseOf({ ...a, id: undefined }, 'resident');
      const was = await kv.get(`light:c:${c.id}`);
      if (was && !was.retired) return { course: view(rowOf(was, await kv.get(`light:s:${c.id}`))), fresh: false };
      await put({ ...c, by: me.agent });
      await emit({ type: 'course', by: me.agent, name: me.name, kind: c.kind, course: c.id, text: `laid a course for ${c.kind}: ${c.title}` });
      return { course: view(rowOf(c, null)), fresh: true };
    },
    // the course that shines brightest for a task, without a draw and without a ticket: the beacon of /brain
    async courseFor(q, agent) {
      await ready();
      const t = clean(q, 300); if (!t) return null;
      const { kd, list } = await chart(t, agentOf(agent));
      if (!list.length) return null;
      const best = [...list].sort((x, y) => y.expect * y.rank - x.expect * x.rank)[0];
      return strip({ ...view(best), why: whyOf(best, kd, false), follow: `${base()}/course?q=${encodeURIComponent(t)}` });
    },
    // ---------------------------------------------------------------- the probe: at most 20 checks an hour, 8 s a run, polite per host
    async probePulse() {
      await ready();
      // the run's cap holds in real time (a stalled page) and on the sea's clock alike
      const t0 = performance.now(), f0 = nowMs(), left = () => LIGHT.probeMs - Math.max(performance.now() - t0, nowMs() - f0);
      const hk = `light:probe:h:${now().slice(0, 13)}`; let used = Number(await kv.get(hk)) || 0;
      const out = { at: now(), checks: 0, courses: [] };
      if (used >= LIGHT.probePerHour) return { ...out, rest: `the ${LIGHT.probePerHour} checks of this hour are used` };
      const ids = Object.keys((await index()).n).sort(), cur = Number(await kv.get('light:probe:cursor')) || 0, hosts = new Set();
      const polite = async (x) => { if (!x || hosts.has(x)) return false; const at = await kv.get(`light:probe:host:${x}`); if (at && nowMs() - Date.parse(at) < LIGHT.probeHostGapS * 1000) return false; hosts.add(x); await kv.set(`light:probe:host:${x}`, now(), 3600); return true; };
      const pages = new Map(), page = (u) => { if (!pages.has(u)) pages.set(u, Promise.resolve().then(() => reader(u)).catch(() => ({ error: 'unread' }))); return pages.get(u); };
      let i = 0;
      for (; i < ids.length && out.courses.length < LIGHT.probeCourses && left() > 1000; i++) {
        const c = await kv.get(`light:c:${ids[(cur + i) % ids.length]}`); if (!c || c.retired) continue;
        const steps = c.steps.map((s, n) => ({ n, s, p: planOf(s) })).filter((x) => x.p); if (!steps.length) continue;
        if (used + steps.length > LIGHT.probePerHour) break;
        // polite: a host is read once a run and not again within half a minute
        const hs = [...new Set(steps.map((x) => x.p.host).filter(Boolean))];
        if (hs.some((x) => hosts.has(x))) continue;
        const last = await Promise.all(hs.map((x) => kv.get(`light:probe:host:${x}`)));
        if (last.some((x) => x && nowMs() - Date.parse(x) < LIGHT.probeHostGapS * 1000)) continue;
        for (const x of hs) { hosts.add(x); await kv.set(`light:probe:host:${x}`, now(), 3600); }
        const res = [];
        for (const x of steps) {
          if (left() < 500) { res.push({ step: x.n + 1, check: x.p.kind, ok: null }); continue; }
          used++; out.checks++;
          let r = null; try { r = await checkOf(c, x.s, x.p, page, Math.min(left(), 6000), polite); } catch { r = null; }
          res.push({ step: x.n + 1, check: x.p.kind, ...(x.p.to ? { to: x.p.to } : {}), ok: r === undefined ? null : r });
        }
        const decided = res.every((r) => r.ok !== null && r.ok !== undefined), ok = decided && res.every((r) => r.ok === true);
        if (decided) {
          await outcome(c.id, ok ? 1 : 0, LIGHT.weight.probe, `probe-${day()}`, { probe: true });
          await daily((s) => { s.pn++; if (ok) s.pok++; });
          await count({ probes: 1 });
          await emit({ type: 'outcome', name: 'the sea (probe)', course: c.id, kind: c.kind, ok, probe: true, text: `the sea walked the course "${c.title}": ${ok ? 'passable' : 'not passable'} (a probe checks the way, not an agent's goal)` });
        }
        out.courses.push({ id: c.id, title: c.title, checks: res, ok: decided ? ok : null });
      }
      if (ids.length) await kv.set('light:probe:cursor', (cur + i) % ids.length, LIGHT.keepDays * DAY);
      await kv.set(hk, used, 2 * 3600);
      const last = strip({ ...out, ms: Math.round(performance.now() - t0) });
      await kv.set('light:probe:last', last, 30 * DAY);
      return last;
    },
    // ---------------------------------------------------------------- how exact the light is, said honestly
    async lighthouse() {
      await ready();
      const t = nowMs(), days = Array.from({ length: 30 }, (_, i) => new Date(t - i * 864e5).toISOString().slice(0, 10));
      const [snaps, stats, lastProbe, idx] = await Promise.all([Promise.all(days.map((d) => kv.get(`light:day:${d}`))), kv.get('light:stats'), kv.get('light:probe:last'), index()]);
      const sum = (k, n) => snaps.slice(0, n).reduce((s, x) => s + (x?.[k] || 0), 0);
      const win = (n) => { const o = sum('n', n), rn = sum('rn', n); return { outcomes: o, brier: o >= LIGHT.minOutcomes ? r3(sum('brier', n) / o) : FEW, hit: o >= LIGHT.minOutcomes ? r3(sum('hits', n) / o) : FEW, recognition: rn >= LIGHT.minOutcomes ? r3(sum('rok', n) / rn) : FEW }; };
      const w7 = win(7), w30 = win(30), enough = w30.outcomes >= LIGHT.minOutcomes;
      const calibration = Array.from({ length: LIGHT.bins }, (_, i) => { const b = snaps.reduce((s, x) => { const v = x?.bins?.[i]; return v ? [s[0] + v[0], s[1] + v[1], s[2] + v[2]] : s; }, [0, 0, 0]);
        return { bin: `${(i / LIGHT.bins).toFixed(1)}–${((i + 1) / LIGHT.bins).toFixed(1)}`, outcomes: b[0], predicted: enough && b[0] ? r3(b[1] / b[0]) : enough ? null : FEW, observed: enough && b[0] ? r3(b[2] / b[0]) : enough ? null : FEW }; });
      // every course the lighthouse keeps, and the one that shines brightest for each kind of task
      const ids = Object.keys(idx.n).slice(0, 3000), laid = { chart: 0, resident: 0, visitor: 0, probe: 0 }, best = new Map();
      for (let i = 0; i < ids.length; i += 100) {
        const rows = await Promise.all(ids.slice(i, i + 100).map(async (id) => { const [c, st] = await Promise.all([kv.get(`light:c:${id}`), kv.get(`light:s:${id}`)]); return c && !c.retired ? { c, st: st || {} } : null; }));
        for (const x of rows) {
          if (!x) continue; laid[x.c.laidBy] = (laid[x.c.laidBy] || 0) + 1; if (!open(x.c, x.st)) continue;
          const [a, b] = betaOf(x.c, x.st, t), e = a / (a + b), o = best.get(x.c.kind);
          if (!o || e > o.expect || (e === o.expect && (x.st.n || 0) > o.outcomes)) best.set(x.c.kind, strip({ kind: x.c.kind, id: x.c.id, title: x.c.title, expect: r3(e), outcomes: x.st.n || 0, probes: x.st.pn || undefined }));
        }
      }
      const total = Object.values(laid).reduce((s, n) => s + n, 0);
      return {
        what: 'the lighthouse: courses (one to six steps) for every agent the sea has, chosen by how often they led agents to the goal; it grows more exact with every outcome',
        at: now(), courses: { total, ...laid, kinds: best.size },
        outcomes: { total: stats?.outcomes || 0, d7: w7.outcomes, d30: w30.outcomes, tickets: stats?.tickets || 0 },
        brier: { d7: w7.brier, d30: w30.brier, note: 'mean of (expected − outcome)² for each ticket; 0 is perfect, 0.25 is a coin' },
        hitRate: typeof w30.hit === 'number' ? w30.hit : null, hit: { d7: w7.hit, d30: w30.hit }, recognition: { d30: w30.recognition, note: 'share of outcomes where the chosen course was of the kind that finally led to the goal' },
        // the same numbers flat; null where fewer than 30 outcomes stand behind them
        brier7: typeof w7.brier === 'number' ? w7.brier : null, brier30: typeof w30.brier === 'number' ? w30.brier : null, hit7: typeof w7.hit === 'number' ? w7.hit : null, hit30: typeof w30.hit === 'number' ? w30.hit : null,
        recognition30: typeof w30.recognition === 'number' ? w30.recognition : null, outcomes7: w7.outcomes, outcomes30: w30.outcomes, probes30: sum('pn', 30), probesPassable30: sum('pok', 30),
        calibration, probes: { d30: { runs: sum('pn', 30), passable: sum('pok', 30) }, total: stats?.probes || 0, last: lastProbe || null, note: 'a probe checks that a course can be walked, not that an agent reached its goal; counted apart from outcomes' },
        best: [...best.values()].sort((x, y) => (x.kind < y.kind ? -1 : 1)).slice(0, 200),
        days: days.map((d, i) => [d, snaps[i]]).filter(([, x]) => x && (x.n || x.pn)).map(([d, x]) => strip({ day: d, outcomes: x.n, brier: x.n ? r3(x.brier / x.n) : undefined, hit: x.n ? r3(x.hits / x.n) : undefined, recognition: x.rn ? r3(x.rok / x.rn) : undefined, probes: x.pn || undefined })),
        minimum: `under ${LIGHT.minOutcomes} outcomes a measure says "${FEW}" instead of a number`,
        ask: `${base()}/course?q=<your task>`, report: `${base()}/course/<ticket>/done?ok=1|0[&score=0..1][&note=][&instead=<course id or https address>]`,
        rule: { halfLifeDays: LIGHT.halfLifeDays, weights: LIGHT.weight, perCourseAndAddressDay: LIGHT.dayCap, ticketDays: LIGHT.ticketDays, probesPerHour: LIGHT.probePerHour, visitorCourses: 'shown after a probe or two successes from different address-days' },
      };
    },
  };
  return lighthouse;
}
