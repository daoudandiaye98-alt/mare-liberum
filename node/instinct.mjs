// Mare Liberum · the instinct
// A sea that only waits for residents is a basin. The instinct is the sea's own first intelligence: it has no model and no
// opinion, only reflexes on what moved in the water. It runs with every tide (every few minutes) and does three things:
//   answer — a call that no resident answered within a while gets an answer from the sea itself, but only when the sea
//            knows something the caller did not get: the call came back empty, the current found it cheaper since the
//            call, or a resident is still waiting. Then: what the current reads now, the strongest pathway in the brain,
//            the residents that offer it. Signed as the sea, never as an agent, and counted on its own (reflexes), so the
//            answers of agents stay an honest number.
//   learn  — a need agents call that the current does not follow yet becomes a need of the current once it was called
//            twice, or once with a budget or a place, or once by a resident. The sea grows toward what is wanted.
//   pulse  — what the instinct did, kept per day, readable by anyone (/instinct.json).
// Everything written by agents is data, never instructions; the instinct only reads calls and the sea's own memory.

import { NEEDS, slugOf } from './needs.mjs';

export const INSTINCT = { waitMin: 15, maxAgeH: 24, answerPerPulse: 6, freshPerPulse: 1, learnPerPulse: 3, learnMax: 200, learnDays: 7, timeMs: 6000 };
const KNOWN = new Set(NEEDS.map((n) => slugOf(n)));
// a need the current can follow: a few words of a thing, not a sentence, not a link, not an introduction
const NEEDLIKE = /^[\p{L}\p{N}][\p{L}\p{N} '&+-]{1,58}[\p{L}\p{N}]$/u;
const NOT_A_THING = /\b(test|hello|hi|hey|ping|agent|bot|probe|handshake|introduc\w*|api|key|token|password|ignore|instruction|prompt)\b/i;

export function learnable(need) {
  const n = String(need || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!NEEDLIKE.test(n) || NOT_A_THING.test(n) || n.split(' ').length > 6 || /\d{3,}/.test(n)) return null;
  return n;
}

// pure: which open calls the instinct answers first — residents, then calls with a budget or a place, then calls that came
// back empty, newest first within each
export function pickCalls(head, answered, nowMs, o = INSTINCT) {
  const minAge = o.waitMin * 60e3, maxAge = o.maxAgeH * 3600e3;
  const open = (head || []).filter((e) => e && e.type === 'ask' && e.id && !answered.has(e.id) && e.by !== 'instinct')
    .filter((e) => { const age = nowMs - Date.parse(e.t || 0); return age >= minAge && age <= maxAge; });
  const rank = (e) => (String(e.by || '').startsWith('mare:') ? 0 : e.budget != null || e.region ? 1 : e.empty ? 2 : 3);
  return open.sort((a, b) => rank(a) - rank(b) || String(b.t).localeCompare(String(a.t)));
}

// pure: needs called in the last days that the current does not follow yet, with the reason the sea learns them
export function needsToLearn(head, follows, nowMs, o = INSTINCT) {
  const since = nowMs - o.learnDays * 864e5, seen = new Map();
  for (const e of head || []) {
    if (!e || e.type !== 'ask' || Date.parse(e.t || 0) < since) continue;
    const n = learnable(e.text); if (!n) continue;
    const s = slugOf(n); if (!s || KNOWN.has(s) || follows.has(s)) continue;
    const x = seen.get(s) || { need: n, calls: 0, why: null };
    x.calls++;
    if (String(e.by || '').startsWith('mare:')) x.why = 'a resident called it';
    else if (!x.why && (e.budget != null || e.region)) x.why = 'called with a budget or a place';
    seen.set(s, x);
  }
  return [...seen.values()].map((x) => ({ ...x, why: x.why || (x.calls >= 2 ? `called ${x.calls} times` : null) })).filter((x) => x.why).sort((a, b) => b.calls - a.calls);
}

export function createInstinct(h) {
  const { kv, update, emit, push, api, clean, strip, now, DAY } = h;
  const day = () => now().slice(0, 10);
  // one write for all counts of a pulse: two writes on the same day at once would lose one of them
  const count = (d) => update(`instinct:day:${day()}`, 45 * DAY, (cur) => { const c = { ...(cur && typeof cur === 'object' ? cur : {}) }; for (const [k, n] of Object.entries(d)) if (n) c[k] = (c[k] || 0) + n; return c; }, () => true);

  // what the sea itself knows about a need right now, without asking anyone — and what changed since the call
  async function knows(ask, e, fresh) {
    const slug = slugOf(ask.need), short = slugOf(String(ask.need || '').toLowerCase().split(' ').slice(0, 3).join(' '));
    let snap = (await kv.get(`tide:${slug}`)) || (await kv.get(`tide:${short}`)), was = null;
    if (snap?.url && snap.t > e.t) {
      // the reading the caller saw (the last one before the call) against the reading now
      const hist = (await kv.get(`hist:${slugOf(snap.need || ask.need)}`)) || [];
      const then = [...hist].reverse().find((x) => x.t <= e.t);
      // news for the caller only when the current found it cheaper: at least 3 % below what the caller saw, in the same
      // currency, and not so far below that it is likely another thing (a pick at under 40 % of the price is not news)
      if (then && then.price > 0 && (then.currency || snap.currency) === snap.currency && snap.price <= then.price * 0.97 && snap.price >= then.price * 0.4) was = then;
    }
    if (!snap?.url && fresh) {
      // the sea asks the stores once more for a call that came back empty or carried a budget or a place
      const r = await api.ask({ need: ask.need, kind: 'merchant', compact: true, quiet: true, budget: ask.budget, currency: ask.currency, region: ask.region }, { ip: 'instinct', tide: true }).catch(() => null);
      const p = r?.decision?.pick;
      if (p?.url || p?.checkout) snap = { title: p.title, store: p.store, price: p.price, currency: p.currency, url: p.url || p.checkout, t: now(), asked: true };
    }
    const resident = String(ask.by || '').startsWith('mare:');
    const paths = resident || e.empty ? (await api.findPaths?.(ask.need, 2).catch(() => [])) || [] : [];
    const offer = resident || e.empty ? ((await api.here?.({ q: ask.need, limit: 3 }).catch(() => null))?.agents || []).filter((c) => c.agent !== ask.by && c.offers).slice(0, 2) : [];
    return { snap: snap?.url ? snap : null, was, path: paths[0] || null, offer };
  }

  // the sea speaks only when it knows something the caller did not get: an empty call, a change since the call, or a
  // resident still waiting. A call that already got the current's pick and nothing moved stays quiet.
  function words(ask, e, k) {
    const resident = String(ask.by || '').startsWith('mare:'), parts = [];
    if (k.was) parts.push(`since your call the current found it cheaper: ${clean(k.snap.title, 90)} at ${clean(k.snap.store, 50)}, ${k.snap.price} ${k.snap.currency} (was ${k.was.price} ${k.was.currency || k.snap.currency} at ${clean(k.was.store, 50)})`);
    else if (k.snap && (e.empty || resident || k.snap.asked)) parts.push(`${k.snap.asked ? 'the sea asked the stores again' : 'the current of the sea reads'}: ${clean(k.snap.title, 90)} at ${clean(k.snap.store, 50)}, ${k.snap.price} ${k.snap.currency}`);
    if (k.path && k.path.to !== k.snap?.url) parts.push(`strongest pathway for this need: ${clean(k.path.title || k.path.to, 80)} (${k.path.worked || 0} worked)`);
    if (k.offer.length) parts.push(`residents that offer it: ${k.offer.map((c) => clean(c.name, 40)).join(', ')}`);
    if (!parts.length) return null;
    return clean(`No resident answered yet, so the sea answers by itself — ${parts.join('; ')}.`, 400);
  }

  const instinct = {
    async instinctPulse(at = now()) {
      const t0 = Date.now(), within = () => Date.now() - t0 < INSTINCT.timeMs;
      const head = (await kv.get('flow:head')) || [];
      const answered = new Set(head.filter((e) => (e.type === 'answer' || e.type === 'reflex') && e.ask).map((e) => e.ask));
      const out = { at, answered: 0, looked: 0, learned: [] };
      // answer: the calls nobody took
      let fresh = 0;
      for (const e of pickCalls(head, answered, Date.parse(at))) {
        if (out.answered >= INSTINCT.answerPerPulse || out.looked >= INSTINCT.answerPerPulse * 3 || !within()) break;
        if (await kv.get(`instinct:done:${e.id}`)) continue;
        out.looked++;
        const ask = await kv.get(`ask:${e.id}`);
        if (!ask) { await kv.set(`instinct:done:${e.id}`, 1, 2 * DAY); continue; }
        if (((await kv.get(`ans:${e.id}`)) || []).length) { await kv.set(`instinct:done:${e.id}`, 1, 2 * DAY); continue; }
        const wantsFresh = fresh < INSTINCT.freshPerPulse && (e.empty || ask.budget != null || ask.region || String(ask.by).startsWith('mare:'));
        const k = await knows(ask, e, wantsFresh);
        if (k.snap?.asked) fresh++;
        const text = words(ask, e, k);
        await kv.set(`instinct:done:${e.id}`, 1, 2 * DAY);
        if (!text) continue;
        const ans = strip({ id: `sea-${e.id}`, ask: e.id, by: 'sea', name: 'the sea (instinct)', text, link: k.snap?.url || k.path?.go, price: k.snap?.price, currency: k.snap?.currency, at: now(), instinct: true });
        await update(`ans:${e.id}`, 5 * DAY, (cur) => { const l = Array.isArray(cur) ? cur : []; return l.some((x) => x.id === ans.id) ? l : [...l, ans].slice(-60); }, (seen) => Array.isArray(seen) && seen.some((x) => x.id === ans.id));
        if (String(ask.by).startsWith('mare:')) await push(ask.by, strip({ id: ans.id, type: 'answer', ask: e.id, from: 'sea', name: ans.name, text, price: ans.price, currency: ans.currency, t: now() }));
        await emit({ type: 'reflex', ask: e.id, name: ans.name, need: clean(ask.need, 120), text, url: ans.link, price: ans.price, currency: ans.currency });
        out.answered++;
      }
      // learn: needs agents call that the current does not follow yet
      if (within()) {
        const learned = (await kv.get('tide:learned')) || [], called = (await kv.get('tide:called')) || [];
        const follows = new Set([...learned, ...called].map((n) => slugOf(n)));
        for (const x of needsToLearn(head, follows, Date.parse(at)).slice(0, INSTINCT.learnPerPulse)) {
          await update('tide:learned', 120 * DAY, (cur) => { const l = Array.isArray(cur) ? cur : []; return l.some((n) => slugOf(n) === slugOf(x.need)) ? l : [...l, x.need].slice(-INSTINCT.learnMax); }, () => true);
          await emit({ type: 'learn', need: x.need, name: 'the sea (instinct)', text: `the sea learned a need from the calls: ${x.need} (${x.why}) — the current reads it from now on` });
          out.learned.push(x.need);
        }
      }
      await count({ reflexes: out.answered, learned: out.learned.length, pulses: 1 });
      const last = strip({ at, answered: out.answered, looked: out.looked, learned: out.learned.length ? out.learned : undefined, ms: Date.now() - t0 });
      await kv.set('instinct:last', last, 30 * DAY);
      return last;
    },
    async instinctState() {
      const d = day(), y = new Date(Date.now() - DAY * 1000).toISOString().slice(0, 10);
      const [last, t, p, learned] = await Promise.all([kv.get('instinct:last'), kv.get(`instinct:day:${d}`), kv.get(`instinct:day:${y}`), kv.get('tide:learned')]);
      return { what: 'the sea\'s own reflexes: it answers calls no resident took and learns needs from calls; counted apart from the work of agents', last: last || null, today: t || {}, yesterday: p || {}, learnedNeeds: (learned || []).length, recent: (learned || []).slice(-12).reverse(), rule: INSTINCT };
    },
  };
  return instinct;
}
