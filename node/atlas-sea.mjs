// Mare Liberum · the Atlas in the sea: /site/<domain>, /find, /sites, /atlas.
// The big map is made once a week by GitHub Actions and lies as open data on the branch atlas-data; the sea reads it
// file by file and keeps what it read for half a day. A site that is not on the map yet is mapped the moment an agent or a
// person asks for it (crawlers only get what is mapped, so no crawler makes the sea knock on other doors). Every site
// asked for is remembered, so the next weekly map reads it too.
import { profileSite, expand, wordsOf, prior, shardOf, idxOf, siteOf } from './atlas.mjs';
import { safeHost } from './check.mjs';
import { TOP } from './web.mjs';

const REPO = 'daoudandiaye98-alt/mare-liberum';
const SOURCES = [(p, v) => `https://raw.githubusercontent.com/${REPO}/atlas-data/${p}?v=${encodeURIComponent(v)}`, (p) => `https://cdn.jsdelivr.net/gh/${REPO}@atlas-data/${p}`];
const STOP = new Set('the and for with from that this your you our are how what where when who can find site sites website websites page pages online best top free der die das und mit von für wie wo was ein eine les des une pour avec los las para con una que'.split(' '));
export const queryWords = (q) => [...new Set(String(q || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 2 && t.length <= 30 && !STOP.has(t)))].slice(0, 8);

export function createAtlas(h) {
  const { kv, update, now, DAY, allow, SeaError } = h;
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
  async function stored(d) { return (await kv.get(`atlas:${d}`)) || ((await data(`s/${shardOf(d)}.json`)) || {})[d] || null; }
  // a site mapped by the sea joins the words, so /find knows it before the next weekly map
  async function remember(p) {
    await kv.set(`atlas:${p.d}`, p, 45 * DAY);
    await update('atlas:recent', 60 * DAY, (cur) => [p.d, ...(Array.isArray(cur) ? cur.filter((x) => x !== p.d) : [])].slice(0, 20000), () => true);
    if (p.s !== 200) return;
    const pr = prior(p);
    for (const [w, wt] of wordsOf(p).slice(0, 24)) await update(`atlas:w:${w}`, 60 * DAY, (cur) => { const l = (Array.isArray(cur) ? cur : []).filter(([d]) => d !== p.d); l.push([p.d, Math.round(wt * pr * 1000) / 1000]); return l.sort((a, b) => b[1] - a[1]).slice(0, 60); }, () => true);
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
      if (ctx && !ctx.readOnly) update(`atlas:asked:${now().slice(0, 10)}`, 3 * DAY, (cur) => ({ ...(cur || {}), [d]: ((cur || {})[d] || 0) + 1 }), () => true).catch(() => {});
      return expand(p, base());
    },
    // the search of the Atlas: sites that answer the words, the most usable for agents first
    async find(q, limit = 12) {
      const ws = queryWords(q); if (!ws.length) throw new SeaError('INVALID_ARGUMENT', 'say what you look for in words, for example /find?q=train tickets germany');
      const lists = await Promise.all(ws.map(async (w) => { const [a, b] = await Promise.all([data(`i/${idxOf(w)}.json`).then((o) => (o && o[w]) || []), kv.get(`atlas:w:${w}`).then((l) => l || [])]); return [w, [...a, ...b]]; }));
      const score = new Map();
      for (const [w, l] of lists) { const seen = new Set(); for (const [d, s] of l) { if (seen.has(d)) continue; seen.add(d); const x = score.get(d) || { s: 0, hit: 0, words: [] }; x.s += s; x.hit++; x.words.push(w); score.set(d, x); } }
      const ranked = [...score].map(([d, x]) => [d, x.s * Math.pow(x.hit / ws.length, 2), x.words]).sort((a, b) => b[1] - a[1]).slice(0, limit);
      const sites = (await Promise.all(ranked.map(async ([d, s, words]) => { const p = await stored(d); if (!p) return null; const x = expand(p, base());
        return { site: d, title: x.title, description: x.description, search: x.search?.template, example: x.search ? x.search.template.replace('{q}', encodeURIComponent(q)) : undefined, readable: x.readable?.withoutJavaScript, blocks: (x.agents || []).filter((a) => a.allowed === false && a.role !== 'training').map((a) => a.name), grade: x.grade, rank: x.rank, matched: words, map: `${base()}/site/${d}` }; }))).filter(Boolean);
      return { q, words: ws, sites, how: 'Each site comes with its own search link: put your words where {q} stands and read the result with the reader (/r/<link>). The full map of a site: /site/<domain>.', more: `${base()}/sites` };
    },
    // the website behind an entry of the open index, if the Atlas has its map (for a link from the entry page)
    async atlasKnown(e) {
      let h; try { const m = e?.metadata || {}; h = siteOf(new URL(m.kind === 'merchant' ? `https://${m.publisher}` : e.url).hostname); } catch { return null; }
      if (!safeHost(h)) return null; const p = await stored(h); return p && p.s === 200 ? h : null;
    },
    async mapSite(a = {}, ctx) { return atlas.site(a.domain ?? a.site ?? a.url ?? a.q, ctx); },
    async findSites(a = {}) { return atlas.find(a.q ?? a.query ?? a.need ?? a.task, Math.min(Number(a.limit) || 12, 30)); },
    // how many sites the map holds and what the web lets agents do
    async atlasStats() {
      const [st, recent] = await Promise.all([data('stats.json'), kv.get('atlas:recent')]);
      return { map: st || { note: 'the first weekly map has not been published yet' }, mappedLive: (recent || []).length, data: `https://github.com/${REPO}/tree/atlas-data`, how: { site: `${base()}/site/<domain>`, find: `${base()}/find?q=<words>`, crawler: `${base()}/atlas` } };
    },
    async atlasList(n) { if (n === 'live') return ((await kv.get('atlas:recent')) || []).slice(0, 20000); const t = await data(`l/${Number(n) || 0}.txt`); return t ? t.split('\n').filter(Boolean) : []; },
    async atlasLists() { const st = await data('stats.json'); return Number(st?.lists) || 0; },
    async atlasWanted() { const w = (await kv.get('atlas:wanted')) || []; const r = (await kv.get('atlas:recent')) || []; return [...new Set([...w, ...r])]; },
    // a few sites with every tide: the ones agents asked for and the most visited, so the map grows even between the weekly runs
    async atlasStep(n = 6, list = TOP) {
      const cur = Number(await kv.get('atlas:cursor')) || 0, queue = [...((await kv.get('atlas:wanted')) || []).slice(-200), ...list], pick = [];
      for (let i = 0; pick.length < n && i < queue.length; i++) { const d = siteOf(queue[(cur + i) % queue.length]); if (!pick.includes(d) && !fresh(await kv.get(`atlas:${d}`), 7)) pick.push(d); }
      await kv.set('atlas:cursor', queue.length ? (cur + n) % queue.length : 0, 400 * DAY);
      const done = await Promise.all(pick.map((d) => Promise.race([profileSite(d), new Promise((r) => setTimeout(() => r(null), 15000))]).then(async (p) => { if (p) await remember(p); return p ? { site: d, grade: p.g, search: !!p.q } : null; }).catch(() => null)));
      return done.filter(Boolean);
    },
  };
  return atlas;
}
