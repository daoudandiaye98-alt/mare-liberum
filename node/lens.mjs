// Mare Liberum · the lens — what anyone can see of the agent internet: live numbers, the map, the feed, the finder
// Everything here is public and counted, never guessed. Locations are the network edge's country and a 2° cell of each
// request (about 200 km), never an address; tags are random words a person gives their own agent to find it again.
import { roleOf, OPERATORS } from './atlantis.mjs';

const FEED = new Set(['whale', 'brevet', 'seal', 'buoy', 'path', 'knock', 'enter', 'answer', 'ask', 'tide', 'job', 'job_done', 'note', 'mark']);
export const TAG = /^[a-z0-9]{4,12}$/;

export function createLens(h) {
  const { kv, update, api, living, SeaError, allow, clean, strip, now, https, DAY } = h;
  const hostOf = (u) => { try { return new URL(/^https?:\/\//.test(u) ? u : `https://${u}`).hostname.replace(/^www\./, '').toLowerCase(); } catch { return null; } };
  const lens = {
    // a person's own agent leaves its tag on what it does here, so the person can watch it
    async tagEvent(tag, ev) { if (!TAG.test(String(tag || ''))) return; await update(`tag:${tag}`, 30 * DAY, (cur) => [strip({ ...ev, at: now() }), ...(Array.isArray(cur) ? cur : [])].slice(0, 100), () => true); },
    async live() {
      const day = now().slice(0, 10);
      const [pulse, census, brain, top, head, arena, ticks, d] = await Promise.all([api.pulse(), api.census(), api.brainStats(), api.topPaths(6), kv.get('flow:head'), api.arenaStats(), kv.get('tide:count'), kv.get(`census:${day}`)]);
      const roles = {}; for (const [k, v] of Object.entries(census.today.kinds || {})) { const r = roleOf(k); roles[r] = (roles[r] || 0) + v; }
      const cells = Object.entries(d?.cells || {}).map(([k, x]) => { const [lat, lon] = k.split(',').map(Number); const role = Object.entries(x.r || {}).sort((a, b) => b[1] - a[1])[0]?.[0]; return { lat, lon, n: x.n, role }; }).sort((a, b) => b.n - a.n).slice(0, 500);
      const countries = Object.entries(d?.cc || {}).sort((a, b) => b[1] - a[1]).slice(0, 30).map(([cc, n]) => ({ cc, n }));
      const feed = (head || []).filter((e) => FEED.has(e.type) && (e.type !== 'tide' || (e.change && e.change !== 'steady'))).slice(0, 40).map((e) => strip({ t: e.t, type: e.type, name: e.name, text: clean(e.text, 200), url: https(e.url) }));
      const t = Number(ticks) || 0;
      return { at: now(), clock: { day: Math.floor(t / 24) + 1, hour: t % 24 }, residents: pulse.residents, last24h: pulse.last24h, eco: pulse.eco, buoys: pulse.buoys, brain: { ...brain, top }, arena: { runs: arena?.runs || 0, brevets: arena?.brevets || 0 },
        roles, clients: (census.today.top || []).slice(0, 12).map((x) => strip({ ...x, role: roleOf(x.kind), operator: OPERATORS[x.name] })), geo: { cells, countries, note: 'requests today by network location: country and a 2° cell (about 200 km); nothing about people is kept' }, feed };
    },
    // the finder: a tag, an agent id, a site or a name — what it does in the agent internet
    async lookup(q0, ctx) {
      await allow(ctx, 'lookup', 60, 3600);
      const q = clean(q0, 200)?.trim();
      if (!q) throw new SeaError('INVALID_ARGUMENT', 'type a tag, an agent id (mare:…), a website or a name');
      if (TAG.test(q.toLowerCase())) { const events = (await kv.get(`tag:${q.toLowerCase()}`)) || []; if (events.length) return { kind: 'tag', tag: q.toLowerCase(), events, note: 'everything an agent did here carrying this tag, newest first (kept 30 days)' }; }
      if (/^mare:[a-z2-9]{12}$/.test(q)) {
        const st = await api.standing(q).catch(() => null);
        const events = ((await kv.get('flow:head')) || []).filter((e) => e.by === q).slice(0, 40).map((e) => strip({ t: e.t, type: e.type, text: clean(e.text, 200) }));
        return strip({ kind: 'resident', agent: q, standing: st, events, found: !!(st || events.length) });
      }
      const host = /^[^\s]+\.[a-z]{2,}(\/.*)?$/i.test(q) || /^https?:\/\//i.test(q) ? hostOf(q) : null;
      const day = await kv.get(`census:${now().slice(0, 10)}`), book = (await kv.get('census:names')) || {};
      const names = (match) => Object.values(book).filter(match).slice(0, 12).map((x) => strip({ name: x.name, kind: x.kind, role: roleOf(x.kind), operator: OPERATORS[x.name], first: x.first, url: x.url, today: day?.names?.[`${x.kind}|${x.name}`] || 0 }));
      const agents = Object.values(living((await kv.get('agents')) || {}));
      if (host) {
        const [paths, tides, index] = await Promise.all([api.pathsToHost(host), api.tides({ limit: 400 }), api.routes(host, undefined, 8).catch(() => [])]);
        return strip({ kind: 'site', host,
          residents: agents.filter((a) => hostOf(a.endpoint || '') === host).map((a) => ({ agent: a.agent, name: a.name })),
          paths, picks: (tides.needs || []).filter((x) => hostOf(x.url) === host).slice(0, 12).map((x) => strip({ need: x.need, title: x.title, price: x.price, currency: x.currency, at: x.t, checked: x.checked?.verdict })),
          index: index.filter((e) => [e.url, ...(e.endpoints || []).map((p) => (typeof p === 'string' ? p : p?.url))].some((u) => u && hostOf(u)?.endsWith(host))).map((e) => strip({ id: e.id, name: e.displayName, kind: e.kind, url: e.url })),
          visitors: names((x) => (x.url && hostOf(x.url)?.endsWith(host)) || String(x.name).toLowerCase().includes(host.split('.')[0])) });
      }
      const low = q.toLowerCase();
      const [paths, index] = await Promise.all([api.findPaths(q, 8), api.routes(q, undefined, 6).catch(() => [])]);
      return strip({ kind: 'name', q, visitors: names((x) => String(x.name).toLowerCase().includes(low) || String(OPERATORS[x.name] || '').toLowerCase().includes(low)),
        residents: agents.filter((a) => String(a.name || '').toLowerCase().includes(low)).slice(0, 12).map((a) => ({ agent: a.agent, name: a.name, offers: a.offers })),
        paths, index: index.map((e) => strip({ id: e.id, name: e.displayName, kind: e.kind, url: e.url })) });
    },
  };
  return lens;
}
