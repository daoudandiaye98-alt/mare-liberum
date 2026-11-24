// Mare Liberum · the Atlas in the sea: /site/<domain>, /find, /sites, /atlas.
// The sea maps sites itself, every few minutes (a timer on our own server calls /atlas/step), and keeps every map in its own
// database (node/atlas-store.mjs). The big snapshot lies as open data on the branch atlas-data as a public mirror; the sea
// reads it file by file and keeps what it read for half a day. A site that is not on the map yet is mapped the moment an agent or a
// person asks for it (crawlers only get what is mapped, so no crawler makes the sea knock on other doors). Every site
// asked for is remembered, so the next weekly map reads it too.
import { profileSite, expand, wordsOf, prior, shardOf, idxOf, siteOf, leftOut } from './atlas.mjs';
import { safeHost } from './check.mjs';
import { TOP } from './web.mjs';

const REPO = 'daoudandiaye98-alt/mare-liberum';
const SOURCES = [(p, v) => `https://raw.githubusercontent.com/${REPO}/atlas-data/${p}?v=${encodeURIComponent(v)}`, (p) => `https://cdn.jsdelivr.net/gh/${REPO}@atlas-data/${p}`];
const STOP = new Set('the and for with from that this your you our are how what where when who can find site sites website websites page pages online best top free der die das und mit von für wie wo was ein eine les des une pour avec los las para con una que'.split(' '));
export const queryWords = (q) => [...new Set(String(q || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 2 && t.length <= 30 && !STOP.has(t)))].slice(0, 8);

export function createAtlas(h) {
  const { kv, update, now, DAY, allow, SeaError } = h;
  const store = h.store || null; // the Atlas store on our own server (node/atlas-store.mjs), if this node has one
  const base = () => String(h.base || 'https://mareliberum.dev').replace(/\/+$/, '');
  // one file of the open map, kept half a day; a missing file is remembered for an hour
  // the version of the map: when a new weekly map is published, every file is read fresh
  // the version of the map is the moment it was put together; a new weekly map gets fresh keys everywhere
  async function version() {
    const v = await kv.get('atlasd:ver'); if (v) return v;
    let at = null; try { const r = await fetch(`https://raw.githubusercontent.com/${REPO}/atlas-data/stats.json?b=${Math.floor(Date.now() / 600000)}`, { signal: AbortSignal.timeout(5000), headers: { 'user-agent': 'MareLiberum/3 (+https://mareliberum.dev/atlas)' } }); if (r.ok) at = String((await r.json()).at || ''); } catch {}
    const ver = at || 'none'; await kv.set('atlasd:ver', ver, at ? 1800 : 300); return ver;
  }
  async function data(path) {
    const v = await version(), key = `atlasd:${v}:${path}`, hit = await kv.get(key); if (hit) return hit.none ? null : hit.v;
    for (const src of SOURCES) {
      try { const r = await fetch(src(path, v), { signal: AbortSignal.timeout(6000), headers: { 'user-agent': 'MareLiberum/3 (+https://mareliberum.dev/atlas)' } }); if (r.status === 404) break; if (!r.ok) continue;
        const val = path.endsWith('.txt') ? await r.text() : await r.json(); await kv.set(key, { v: val }, 12 * 3600); return val; } catch {}
    }
    await kv.set(key, { none: true }, 3600); return null;
  }
  const fresh = (p, days) => p && Date.now() - Date.parse(p.at) < days * DAY * 1000;
  const newer = (a, b) => (!a ? b || null : !b ? a : Date.parse(a.at) >= Date.parse(b.at) ? a : b);
  // a site as the sea knows it: what it mapped a moment ago, then our own store, then the weekly map, the newest wins
  async function stored(d) { return (await storedMany([d]))[d] || null; }
  async function storedMany(ds, memo = true) {
    const out = {}, kvs = await Promise.all(ds.map((d) => kv.get(`atlas:${d}`)));
    ds.forEach((d, i) => { if (kvs[i]) out[d] = kvs[i]; });
    const rest = ds.filter((d) => !out[d]); if (!rest.length) return out;
    let own = {};
    if (store) {
      const memo = await Promise.all(rest.map((d) => kv.get(`atlasx:${d}`))), ask = rest.filter((d, i) => !memo[i]);
      rest.forEach((d, i) => { if (memo[i]?.p) own[d] = memo[i].p; });
      if (ask.length) { try { const got = await store.get(ask); Object.assign(own, got); if (memo) await Promise.all(ask.map((d) => kv.set(`atlasx:${d}`, got[d] ? { p: got[d] } : { none: true }, got[d] ? 7 * DAY : 1800))); } catch {} }
    }
    const snaps = await Promise.all(rest.map(async (d) => ((await data(`s/${shardOf(d)}.json`)) || {})[d] || null));
    rest.forEach((d, i) => { const p = newer(own[d], snaps[i]); if (p) out[d] = p; });
    return out;
  }
  // a site mapped by the sea joins the words, so /find knows it before the next weekly map
  async function remember(p) {
    // what changed since the last visit: the search link, the answer, the robots.txt stance, the grade
    try {
      const old = await stored(p.d);
      if (old && old.at !== p.at) {
        const ch = [];
        if ((old.q || '') !== (p.q || '')) ch.push(p.q ? (old.q ? 'search link changed' : 'search link appeared') : 'search link gone');
        if (old.s !== p.s) ch.push(`answer ${old.s} → ${p.s}`);
        if ((old.rb || '') !== (p.rb || '')) ch.push(`robots.txt ${old.rb || 'read'} → ${p.rb || 'read'}`);
        if (JSON.stringify(old.bl || []) !== JSON.stringify(p.bl || [])) ch.push('blocked agents changed');
        if (old.g && p.g && old.g !== p.g) ch.push(`grade ${old.g} → ${p.g}`);
        if (ch.length) p.ch = [{ at: String(p.at).slice(0, 10), what: ch }, ...(old.ch || [])].slice(0, 5);
        else if (old.ch) p.ch = old.ch;
      }
    } catch {}
    await kv.set(`atlas:${p.d}`, p, 45 * DAY);
    await update('atlas:recent', 60 * DAY, (cur) => [p.d, ...(Array.isArray(cur) ? cur.filter((x) => x !== p.d) : [])].slice(0, 20000), () => true);
    const pr = p.s === 200 ? prior(p) : 0;
    if (store?.writable) {
      const wt = p.s === 200 ? Object.fromEntries(wordsOf(p).slice(0, 24).map(([w, x]) => [w, Math.round(x * pr * 1000) / 1000])) : {};
      try { await store.put([{ d: p.d, p, wt, ok: p.s === 200 }]); await kv.set(`atlasx:${p.d}`, { p }, 7 * DAY); return; } catch {}
    }
    if (p.s !== 200) return;
    for (const [w, wt] of wordsOf(p).slice(0, 24)) await update(`atlas:w:${w}`, 60 * DAY, (cur) => { const l = (Array.isArray(cur) ? cur : []).filter(([d]) => d !== p.d); l.push([p.d, Math.round(wt * pr * 1000) / 1000]); return l.sort((a, b) => b[1] - a[1]).slice(0, 60); }, () => true);
  }
  // the sites of the weekly map as one set, so the frontier passes them without a lookup each
  let SNAP = null;
  async function snapSet() {
    const v = await version(); if (SNAP?.v === v) return SNAP.set;
    const st = await data('stats.json'); if (!st?.at || Date.now() - Date.parse(st.at) > 30 * DAY * 1000) return null;
    const set = new Set(); for (let i = 0; i < (Number(st.lists) || 0); i++) { const t = await data(`l/${i}.txt`); for (const d of String(t || '').split('\n')) if (d) set.add(d); }
    SNAP = { v, set }; return set;
  }
  const want = (d) => update('atlas:wanted', 120 * DAY, (cur) => { const l = Array.isArray(cur) ? cur : []; return l.includes(d) ? l : [...l, d].slice(-50000); }, (seen) => Array.isArray(seen) && seen.includes(d));

  const atlas = {
    // one site as an agent needs it: from the map, or mapped right now for an agent or a person
    async site(q, ctx, { live = true } = {}) {
      const host = safeHost(String(q || '').trim()); if (!host) throw new SeaError('INVALID_ARGUMENT', 'give a website, for example /site/example.com');
      const d = siteOf(host); let p = await stored(d);
      if ((!p || !fresh(p, 30) || (p.s === 0 && !fresh(p, 2))) && live && !ctx?.readOnly) {
        await allow(ctx, 'atlas', 40, 3600);
        const np = await Promise.race([profileSite(host), new Promise((r) => setTimeout(() => r(null), 14000))]).catch(() => null);
        if (np) { p = np; await remember(np); await want(d); }
      }
      if (!p) return { site: d, mapped: false, note: ctx?.readOnly ? 'not on the map yet; it is mapped the first time an agent or a person asks' : 'the site did not answer in time; try again in a minute', map: `${base()}/site/${d}` };
      if (ctx && !ctx.readOnly && !ctx.uncounted) update(`atlas:asked:${now().slice(0, 10)}`, 3 * DAY, (cur) => ({ ...(cur || {}), [d]: ((cur || {})[d] || 0) + 1 }), () => true).catch(() => {});
      return expand(p, base());
    },
    // the search of the Atlas: sites that answer the words, the most usable for agents first
    async find(q, limit = 12) {
      const ws = queryWords(q); if (!ws.length) throw new SeaError('INVALID_ARGUMENT', 'say what you look for in words, for example /find?q=train tickets germany');
      const [lists, own] = await Promise.all([
        Promise.all(ws.map(async (w) => { const [a, b] = await Promise.all([data(`i/${idxOf(w)}.json`).then((o) => (o && o[w]) || []), kv.get(`atlas:w:${w}`).then((l) => l || [])]); return [w, [...a, ...b]]; })),
        store ? store.find(ws, 40).catch(() => []) : [],
      ]);
      // what our own store mapped since the weekly map joins the same words, at the same weights
      for (const r of own) for (const w of r.words || []) { const l = lists.find(([x]) => x === w); if (l) l[1].unshift([r.d, r.s / Math.max(1, r.hit)]); }
      const score = new Map();
      for (const [w, l] of lists) { const seen = new Set(); for (const [d, s] of l) { if (seen.has(d)) continue; seen.add(d); const x = score.get(d) || { s: 0, hit: 0, words: [] }; x.s += s; x.hit++; x.words.push(w); score.set(d, x); } }
      const ranked = [...score].map(([d, x]) => [d, x.s * Math.pow(x.hit / ws.length, 2), x.words]).sort((a, b) => b[1] - a[1]).slice(0, limit);
      const sites = (await Promise.all(ranked.map(async ([d, s, words]) => { const p = await stored(d); if (!p) return null; const x = expand(p, base());
        return { site: d, title: x.title, description: x.description, search: x.search?.template, example: x.search ? x.search.template.replace('{q}', encodeURIComponent(q)) : undefined, readable: x.readable?.withoutJavaScript, blocks: (x.agents || []).filter((a) => a.allowed === false && a.role !== 'training').map((a) => a.name), grade: x.grade, rank: x.rank, matched: words, map: `${base()}/site/${d}` }; }))).filter(Boolean);
      // words agents searched for and found little: the Atlas keeps them, and the frontier looks for their sites
      const found = sites.filter(Boolean).length;
      if (found < 3) update('atlas:hungry', 30 * DAY, (cur) => { const c = cur && typeof cur === 'object' ? cur : {}; for (const w of ws) c[w] = (c[w] || 0) + 1; const top = Object.entries(c).sort((a2, b2) => b2[1] - a2[1]).slice(0, 300); return Object.fromEntries(top); }, () => true).catch(() => {});
      return { q, words: ws, sites, how: 'Each site comes with its own search link: put your words where {q} stands and read the result with the reader (/r/<link>). The full map of a site: /site/<domain>.', more: `${base()}/sites` };
    },
    // the website behind an entry of the open index, if the Atlas has its map (for a link from the entry page)
    async atlasKnown(e) {
      let h; try { const m = e?.metadata || {}; h = siteOf(new URL(m.kind === 'merchant' ? `https://${m.publisher}` : e.url).hostname); } catch { return null; }
      if (!safeHost(h)) return null; const p = await stored(h); return p && p.s === 200 ? h : null;
    },
    // what the map holds about a few sites, without reading anything new: for the doors that lead to them.
    // A site the map does not hold yet is put on the list, so the crawler reads the sites agents are sent to first.
    async atlasPeek(hosts) {
      const ds = [...new Set((hosts || []).map((x) => siteOf(x)).filter((x) => safeHost(x)))].slice(0, 12); if (!ds.length) return {};
      const got = await storedMany(ds).catch(() => ({})), out = {};
      for (const d of ds) {
        const p = got[d];
        if (p && p.s === 200) { const x = expand(p, base()); out[d] = { grade: x.grade, readsWithoutJavaScript: x.readable?.withoutJavaScript, keepsOff: (x.agents || []).filter((a) => a.allowed === false && a.role !== 'training').map((a) => a.name) }; }
        else if (!p) want(d).catch(() => {});
      }
      return out;
    },
    async mapSite(a = {}, ctx) { return atlas.site(a.domain ?? a.site ?? a.url ?? a.q, ctx); },
    async findSites(a = {}) { return atlas.find(a.q ?? a.query ?? a.need ?? a.task, Math.min(Number(a.limit) || 12, 30)); },
    // how many sites the map holds and what the web lets agents do
    async atlasStats() {
      const [st, recent, own] = await Promise.all([data('stats.json'), kv.get('atlas:recent'), store ? store.count().catch(() => null) : null]);
      const hungry = await kv.get('atlas:hungry').catch(() => null);
      return { hungry: hungry ? Object.entries(hungry).slice(0, 30).map(([w, n]) => ({ word: w, asked: n })) : undefined, map: st || { note: 'the first weekly map has not been published yet' }, mappedLive: own ?? (recent || []).length, store: store ? 'the sea maps sites on its own server, every few minutes, and keeps them in its own database' : undefined, data: `https://github.com/${REPO}/tree/atlas-data`, how: { site: `${base()}/site/<domain>`, find: `${base()}/find?q=<words>`, crawler: `${base()}/atlas` } };
    },
    async atlasList(n) { if (n === 'live') return ((await kv.get('atlas:recent')) || []).slice(0, 20000); const t = await data(`l/${Number(n) || 0}.txt`); return t ? t.split('\n').filter(Boolean) : []; },
    // the same lists as a search engine should get them (sitemaps, IndexNow, the lists on pages): no site the Atlas leaves
    // out by its name, and of the sites mapped lately only those whose map answered, so every address is a page to index
    async atlasListOk(n) { return (await atlas.atlasListDated(n)).map(([d]) => d); },
    // [site, the day its map was made] for the sitemaps; the weekly lists say no day (their maps lie in the snapshots)
    async atlasListDated(n) {
      const l = (await atlas.atlasList(n)).filter((d) => !leftOut(d)); if (n !== 'live') return l.map((d) => [d, null]);
      const ps = await Promise.all(l.map((d) => kv.get(`atlas:${d}`).catch(() => null)));
      return l.map((d, i) => [d, ps[i]]).filter(([, p]) => p?.s === 200).map(([d, p]) => [d, /^\d{4}-\d{2}-\d{2}/.test(String(p.at || '')) ? String(p.at).slice(0, 10) : null]);
    },
    async atlasLists() { const st = await data('stats.json'); return Number(st?.lists) || 0; },
    // the Atlas per country: the most visited sites there (Chrome UX Report) and how far the map has come with them
    async atlasCountries() { return (await h.countries?.().catch(() => null)) || []; },
    async atlasCountry(code, limit = 240) {
      const c = await h.countries?.(code).catch(() => null); if (!c) return null;
      const top = c.sites.slice(0, Math.min(c.top || 1000, 1000)), look = top.slice(0, Math.min(Number(limit) || 240, 400));
      const known = await storedMany(look, false).catch(() => ({}));
      const sites = look.map((d) => { const p = known[d]; return { site: d, mapped: !!(p && p.s !== 0), ok: p?.s === 200 && !leftOut(d), grade: p?.g ?? null, search: p ? !!p.q : null, at: p?.at || null }; });
      return { cc: c.cc, month: c.month, top: c.top, count: c.sites.length, looked: look.length, mapped: sites.filter((x) => x.mapped).length, sites, source: 'Chrome UX Report (Google, CC BY 4.0) via github.com/zakird/crux-top-lists' };
    },
    async atlasWanted() { const w = (await kv.get('atlas:wanted')) || []; const r = (await kv.get('atlas:recent')) || []; return [...new Set([...w, ...r])]; },
    // a few sites with every tide: the ones agents asked for and the most visited, so the map grows even between the weekly runs
    // the frontier: sites agents asked for, the most visited, then the open rank list of the web (a million domains), in order;
    // a site is read again after 30 days, one that did not answer after two
    async atlasStep(n = 6, list = TOP) {
      // words agents found little for: the open index names sites for them, which the Atlas then reads first
      try {
        const hungry = Object.keys((await kv.get('atlas:hungry')) || {}), hc = Number(await kv.get('atlas:huntcursor')) || 0;
        if (hungry.length && h.hunt) { const w = hungry[hc % hungry.length]; await kv.set('atlas:huntcursor', hc + 1, 30 * DAY); for (const d of ((await h.hunt(w).catch(() => [])) || []).slice(0, 5)) await want(d); }
      } catch {}
      const wanted = ((await kv.get('atlas:wanted')) || []).slice(-200), rk = (await h.ranks?.().catch(() => null)) || null;
      const fallback = rk?.length ? null : await atlas.atlasList(0);
      const len = wanted.length + list.length + (rk ? rk.length : fallback.length);
      const at = (i) => (i < wanted.length ? wanted[i] : i < wanted.length + list.length ? list[i - wanted.length] : rk ? rk.at(i - wanted.length - list.length) : fallback[i - wanted.length - list.length]);
      // walk the frontier window by window (a few seconds at most) until there are n sites to read
      // first the sites of the weekly map that did not answer: one shard of the map per step, two of them read again
      const pick = [], t0 = Date.now(), rs = Number(await kv.get('atlas:retry')) || 0;
      try {
        const sh = (await data(`s/${(rs % 4096).toString(16).padStart(3, '0')}.json`)) || {};
        const quiet = Object.values(sh).filter((p) => p && p.s === 0 && !fresh(p, 2)).map((p) => p.d).slice(0, 12);
        const now2 = await storedMany(quiet, false);
        for (const d of quiet) { const p = now2[d]; if (!p || (p.s === 0 && !fresh(p, 2))) pick.push(d); if (pick.length >= Math.min(2, n)) break; }
      } catch {}
      await kv.set('atlas:retry', (rs + 1) % 4096, 400 * DAY);
      // then the frontier down the rank list, the most visited first; what the map already holds fresh is passed over quickly
      // the mixed frontier (global list and every country in turn) keeps its own place; it starts where the global list stood
      const fkey = rk?.mixed ? 'atlas:frontier2' : 'atlas:frontier';
      let cur = Number(await kv.get(fkey)) || 0;
      if (!cur && rk?.mixed) { const old = Number(await kv.get('atlas:frontier')) || 0, off = wanted.length + list.length; cur = old > off ? off + 2 * (old - off) : off; }
      if (!cur) cur = wanted.length + list.length;
      const onMap = await snapSet().catch(() => null); // every site on the weekly map, while that map is under 30 days old
      while (len && pick.length < n && Date.now() - t0 < 9000) {
        const look = [], idx = []; let i = 0;
        for (; look.length < 160 && i < Math.min(len, 50000); i++) { const d = siteOf(at((cur + i) % len) || ''); if (!d || onMap?.has(d) || look.includes(d) || pick.includes(d)) continue; look.push(d); idx.push(i); }
        const known = await storedMany(look, false); let used = i;
        for (let j = 0; j < look.length; j++) { const d = look[j], p = known[d]; if (!p || !fresh(p, 30) || (p.s === 0 && !fresh(p, 2))) pick.push(d); if (pick.length >= n) { used = idx[j] + 1; break; } }
        cur = (cur + Math.max(used, 1)) % len;
      }
      await kv.set(fkey, cur || 1, 400 * DAY);
      const done = await Promise.all(pick.map((d) => Promise.race([profileSite(d), new Promise((r) => setTimeout(() => r(null), 15000))]).then(async (p) => { if (p) await remember(p); return p ? { site: d, grade: p.g, search: !!p.q } : null; }).catch(() => null)));
      return done.filter(Boolean);
    },
  };
  return atlas;
}
