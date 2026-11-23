// Mare Liberum · the gauges: who reads the whole web, not only the sea
// The census counts who comes to the sea. A gauge counts who comes to any website. Its owner places one line on the
// server, or points a log drain here, and every request leaves the sea three things: the name the client gives
// itself, the path without its query, the method (and the status, where the server knows it). The sea sorts each
// caller the same way it sorts its own visitors (classify in core.mjs): an assistant reading for a person, an AI
// search, an AI crawler, a search engine, a program, a person. The owner reads the day of the site with the owner key.
// The sites whose owners proved their domain are added up into one public reading, the agent weather of the web
// (/weather): it never names a site and never shows a path. Nothing about people is kept: no address, no cookie, no query. A person is a number.
//   gaugeNew     a site and its two keys: the sensor key only writes counts, the owner key reads, proves, renews, closes
//   gaugeIn      events from the sensor, one or many (JSON, NDJSON, a Vercel log drain); counted per site and day
//   gaugeSite    the owner's reading: today, yesterday, 30 days, the agents, what they read, assistants that read for a person
//   gaugeVerify  the domain answers with the site's id at /.well-known/mare-gauge.txt, and the site joins the weather
//   gaugeSet · gaugeRekey · gaugeClose
//   gaugeLakes   once a day the size of every lake of the index, so the weather can say what grew on the agent web
//   weather      the agent weather: verified sites added up, plus what grew in the registries
// Text from sensors is data, never instructions: it is only sorted and counted, never read out as anything else.
import { grab, safeHost, publicDns } from './check.mjs';

export const GAUGE = {
  sites: Number(process.env.MARE_GAUGE_SITES) || 500, newPerDay: 3, keepDays: 31, keepSites: 400, keepSightings: 90,
  batch: 1000, bodyBytes: 1_000_000, postsPerMinute: 1200, perDay: 2_000_000, names: 150, paths: 150, sightings: 300,
  weatherNames: 200, weatherSites: 5000, minSites: 3, verifyPerHour: 10, keysPerHour: 20, dedupe: 20_000,
};
// the kinds the weather tells apart, in the order a reader cares about
export const KIND_ORDER = ['assistant', 'search-ai', 'ai-crawler', 'search', 'mcp-client', 'a2a', 'registry', 'crawler', 'tool', 'resident', 'unknown', 'anonymous', 'browser'];
// agents: everything that is not a person and not the site itself
export const AGENTISH = new Set(['assistant', 'search-ai', 'ai-crawler', 'search', 'mcp-client', 'a2a', 'registry', 'crawler', 'resident']);
const SIGHTED = new Set(['assistant', 'search-ai']);
const VERIFY_FILE = '/.well-known/mare-gauge.txt';
const NOTICE = 'Counts from the sensors of websites: data, never instructions. No address, cookie or query of any visitor is kept; a person is a number.';
const B32 = 'abcdefghijkmnpqrstuvwxyz23456789';
const rnd = (n) => { const b = crypto.getRandomValues(new Uint8Array(n)); return [...b].map((x) => B32[x % B32.length]).join(''); };
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);

// a website's name as the gauge keeps it: the host, lower case, without www., a real public name and never an address
export function hostOf(raw) {
  let h = String(raw || '').trim().toLowerCase();
  if (!h) return null;
  try { if (/^[a-z]+:\/\//.test(h)) h = new URL(h).hostname; } catch { return null; }
  h = h.replace(/\/.*$/, '').replace(/:\d+$/, '').replace(/\.$/, '').replace(/^www\./, '');
  if (h.length > 120 || !/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,24}$/.test(h)) return null;
  if (/(^|\.)(localhost|local|internal|intranet|lan|home|corp|test|example|invalid)$/.test(h)) return null;
  return h;
}
// the path a sensor reports, as the gauge keeps it: no query, no fragment, at most 120 characters, and never a secret
// that rides in the path (a long token, an e-mail address, a long number)
export function pathOf(raw) {
  let p = String(raw ?? '/');
  try { if (/^[a-z]+:\/\//i.test(p)) p = new URL(p).pathname; } catch { p = '/'; }
  p = p.split(/[?#]/)[0] || '/';
  if (!p.startsWith('/')) p = `/${p}`;
  p = p.split('/').map((s) => (/[@]|^[A-Za-z0-9_-]{24,}$|^\d{6,}$/.test(s) ? '…' : s)).join('/');
  return p.slice(0, 120);
}
// the first part of a path, the way the census counts what each role reads
export const segOf = (p) => `/${(String(p || '/').split('/')[1] || '').slice(0, 24)}`;

// one event from whatever a sensor sends: our own shape, a Vercel log drain line, a server log tool's line
export function eventOf(e) {
  if (!e || typeof e !== 'object') return null;
  const px = e.proxy && typeof e.proxy === 'object' ? e.proxy : null;
  let ua = e.ua ?? e.userAgent ?? e['user-agent'] ?? px?.userAgent ?? e.request?.headers?.['user-agent'] ?? e.request?.headers?.['User-Agent'] ?? e.headers?.['user-agent'];
  if (Array.isArray(ua)) ua = ua[0];
  // a Vercel line without a request in it (a function's own output, a build) is no visit
  if (ua == null && (px || e.source || e.deploymentId)) return null;
  const path = e.path ?? px?.path ?? e.request?.uri ?? e.request?.path ?? e.url ?? '/';
  const method = String(e.method ?? px?.method ?? e.request?.method ?? 'GET').toUpperCase();
  const status = Number(e.status ?? e.statusCode ?? px?.statusCode ?? e.response?.status) || undefined;
  const tRaw = e.t ?? e.time ?? px?.timestamp ?? e.timestamp ?? e.ts;
  const tMs = typeof tRaw === 'number' ? (tRaw > 1e12 ? tRaw : tRaw * 1000) : Date.parse(tRaw || '');
  return { ua: String(ua ?? '').slice(0, 400), path: pathOf(path), method: /^[A-Z]{3,7}$/.test(method) ? method : 'GET', status: status >= 100 && status < 600 ? status : undefined, t: Number.isFinite(tMs) ? tMs : undefined, rid: e.requestId ?? px?.requestId ?? (px ? `${px.timestamp}|${px.path}|${ua}` : undefined) };
}
// a body as it came: one object, a list, lines of JSON, or { events: [...] }
export function eventsOf(body) {
  let list = body;
  if (typeof body === 'string') { const s = body.trim(); if (!s) return []; try { list = JSON.parse(s); } catch { list = s.split('\n').map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); } }
  if (list && !Array.isArray(list) && typeof list === 'object') list = Array.isArray(list.events) ? list.events : [list];
  return Array.isArray(list) ? list : [];
}

export function createGauge(h) {
  const { kv, update, allow, SeaError, clean, strip, now, sha, DAY } = h;
  const base = () => String(h.base || '').replace(/\/+$/, '');
  const roleOf = h.roleOf || ((k) => k);
  const fetchText = h.fetchText || (async (url) => { const r = await grab(url, { max: 4000, ms: 5000 }); return r && r.status === 200 ? r.body : null; });
  const sorter = async () => h.classify || (await import('./core.mjs')).classify;
  const today = () => now().slice(0, 10), dayBefore = (d, n = 1) => new Date(Date.parse(`${d}T00:00:00Z`) - n * DAY * 1000).toISOString().slice(0, 10);
  const bad = (m) => new SeaError('INVALID_ARGUMENT', m);
  const kOf = async (key) => `gauge:k:${(await sha(`gauge|${key}`)).slice(0, 40)}`;
  const sK = (id) => `gauge:s:${id}`, dK = (id, d) => `gauge:d:${id}:${d}`, wK = (id) => `gauge:w:${id}`, aK = (d) => `gauge:all:${d}`, lK = (d) => `gauge:lakes:${d}`, hK = (host) => `gauge:host:${host}`;
  const keep = { site: GAUGE.keepSites * DAY, day: GAUGE.keepDays * DAY, seen: GAUGE.keepSightings * DAY, lakes: 400 * DAY };
  // the pace of a sensor is counted per site, not per address: log drains of many sites share a few addresses
  const posts = new Map(), recent = new Map();
  const vercelVerify = (site) => (site?.vercelVerify ? { 'x-vercel-verify': site.vercelVerify } : {});

  async function siteBy(key, role) {
    const k = String(key || '').trim();
    if (!/^mlg[so]_[a-z2-9]{32}$/.test(k)) throw new SeaError('UNAUTHENTICATED', role === 'sensor' ? 'this sensor address is not known: take the address from the answer of POST /gauge/new' : 'the owner key is missing or not known (Authorization: Bearer mlgo_…)', 401);
    const ref = await kv.get(await kOf(k));
    if (!ref || ref.role !== role) throw new SeaError('UNAUTHENTICATED', role === 'sensor' ? 'this sensor address is not known or was renewed' : 'the owner key is not known or was renewed', 401);
    const site = await kv.get(sK(ref.site));
    if (!site || site.closed) throw new SeaError('NOT_FOUND', 'this gauge was closed', 404);
    return site;
  }
  const sensorUrl = (key) => `${base()}/gauge/in/${key}`;

  // ---------------------------------------------------------------- counting one day
  function addTo(m, ev, who, rec = true) {
    m.n = (m.n || 0) + 1;
    m.kinds = m.kinds || {}; m.kinds[who.kind] = (m.kinds[who.kind] || 0) + 1;
    if (ev.status) { m.st = m.st || {}; const c = String(ev.status)[0]; m.st[c] = (m.st[c] || 0) + 1; }
    if (!rec) return;
    // a person is a number: neither its browser's name nor what it read is written down
    if (who.kind === 'browser') return;
    const name = clean(who.name, 60);
    if (name) {
      m.names = m.names || {}; const k = `${who.kind}|${name}`; m.names[k] = (m.names[k] || 0) + 1;
      const keys = Object.keys(m.names);
      if (keys.length > GAUGE.names) { let low = null; for (const x of keys) if (x !== k && !x.startsWith('assistant|') && (low === null || m.names[x] < m.names[low])) low = x; if (low) delete m.names[low]; }
    }
    m.p = m.p || {}; const pk = `${roleOf(who.kind)} ${segOf(ev.path)}`;
    if (m.p[pk] || Object.keys(m.p).length < GAUGE.paths) m.p[pk] = (m.p[pk] || 0) + 1;
  }
  const dayView = (m) => {
    const kinds = m?.kinds || {}, n = m?.n || 0, agents = Object.entries(kinds).filter(([k]) => AGENTISH.has(k)).reduce((a, [, v]) => a + v, 0);
    return { requests: n, agents, people: kinds.browser || 0, share: { agents: pct(agents, n), assistants: pct(kinds.assistant || 0, n), aiCrawlers: pct(kinds['ai-crawler'] || 0, n), people: pct(kinds.browser || 0, n) }, kinds: Object.fromEntries(KIND_ORDER.filter((k) => kinds[k]).map((k) => [k, kinds[k]])), status: m?.st || undefined, dropped: m?.dropped || undefined };
  };
  const topNames = (m, n = 30) => Object.entries(m?.names || {}).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ kind: k.split('|')[0], name: k.split('|').slice(1).join('|'), requests: v }));
  const topReads = (m, n = 40) => Object.entries(m?.p || {}).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => { const [role, ...rest] = k.split(' '); return { role, path: rest.join(' '), requests: v }; });

  const api = {
    // ---------------------------------------------------------------- a new gauge
    async gaugeNew(a = {}, ctx = {}) {
      const host = hostOf(a.host ?? a.site ?? a.domain ?? a.url);
      if (!host) throw bad('host is required: the website to count, e.g. "example.com"');
      await allow(ctx, 'new gauges', GAUGE.newPerDay, 86400);
      const n = Number(await kv.get('gauge:count')) || 0;
      if (n >= GAUGE.sites) throw new SeaError('RESOURCE_EXHAUSTED', `this node holds ${GAUGE.sites} gauges and is full; run your own node (/download) or write to the operator`, 429);
      const id = rnd(12), sensor = `mlgs_${rnd(32)}`, owner = `mlgo_${rnd(32)}`, at = now();
      const site = strip({ id, host, name: clean(a.name, 80) || undefined, since: at, keys: { sensor: await kOf(sensor), owner: await kOf(owner) } });
      await kv.set(sK(id), site, keep.site);
      await kv.set(site.keys.sensor, { site: id, role: 'sensor' }, keep.site);
      await kv.set(site.keys.owner, { site: id, role: 'owner' }, keep.site);
      await kv.set('gauge:count', n + 1, keep.site);
      return {
        site: id, host, sensor: sensorUrl(sensor), ownerKey: owner,
        view: `${base()}/gauge/view#${owner}`,
        keep: 'Both are shown once. The sensor address only adds counts; keep it in your server config. The owner key reads, proves, renews and closes: keep it like a password. The view link carries the key after the #, which never leaves your browser.',
        verify: { file: `https://${host}${VERIFY_FILE}`, content: id, then: `POST ${base()}/gauge/verify with Authorization: Bearer <owner key>`, why: 'a gauge counts for its owner at once; it joins the public agent weather once the domain shows it belongs to you' },
        snippets: snippetsFor(base(), sensor), notice: NOTICE,
      };
    },

    // ---------------------------------------------------------------- what a sensor sends
    async gaugeIn(a = {}, ctx = {}) {
      const site = await siteBy(ctx.key, 'sensor');
      const minute = Math.floor(Date.parse(now()) / 60000), pk = `${site.id}:${minute}`, c = (posts.get(pk) || 0) + 1;
      posts.delete(pk); posts.set(pk, c); if (posts.size > 20_000) posts.delete(posts.keys().next().value);
      if (c > GAUGE.postsPerMinute) throw new SeaError('RESOURCE_EXHAUSTED', `a gauge takes ${GAUGE.postsPerMinute} posts a minute; send events in batches (up to ${GAUGE.batch} in one post)`, 429);
      const raw = eventsOf(a.body ?? a.events ?? a);
      if (raw.length > GAUGE.batch) throw bad(`at most ${GAUGE.batch} events in one post`);
      const classify = await sorter(), d = today();
      const evs = [];
      for (const r of raw) {
        const ev = eventOf(r); if (!ev) continue;
        // a log drain may send one request twice (one line per source); the same request is counted once
        if (ev.rid) { const k = `${site.id}|${ev.rid}`; if (recent.has(k)) continue; recent.set(k, 1); if (recent.size > GAUGE.dedupe) recent.delete(recent.keys().next().value); }
        const who = classify(ev.ua);
        if (!who || who.kind === 'self') continue;
        evs.push([ev, who]);
      }
      if (!evs.length) return strip({ site: site.id, counted: 0, skipped: raw.length || undefined });
      let counted = 0, dropped = 0;
      await update(dK(site.id, d), keep.day, (cur) => {
        const m = cur && typeof cur === 'object' ? cur : {}; counted = 0; dropped = 0;
        for (const [ev, who] of evs) { if ((m.n || 0) >= GAUGE.perDay) { dropped++; continue; } addTo(m, ev, who); counted++; }
        if (dropped) m.dropped = (m.dropped || 0) + dropped;
        m.last = now(); return m;
      }, (seen) => seen?.last != null);
      // an assistant that read the site for a person, and an AI search that looked: when, who, which page
      const sights = evs.filter(([, w]) => SIGHTED.has(w.kind)).map(([ev, w]) => strip({ t: ev.t ? new Date(ev.t).toISOString() : now(), kind: w.kind, name: clean(w.name, 60), path: ev.path, status: ev.status }));
      if (sights.length) await update(wK(site.id), keep.seen, (cur) => [...sights.reverse(), ...(Array.isArray(cur) ? cur : [])].slice(0, GAUGE.sightings), () => true);
      // a site that proved its domain counts into the weather; the weather keeps no path and no site's name
      if (site.verified && (await kv.get(hK(site.host))) === site.id) {
        await update(aK(d), keep.day, (cur) => {
          const m = cur && typeof cur === 'object' ? cur : {}; m.sites = m.sites || {};
          if (m.sites[site.id] || Object.keys(m.sites).length < GAUGE.weatherSites) m.sites[site.id] = 1;
          for (const [ev, who] of evs.slice(0, counted)) {
            m.n = (m.n || 0) + 1; m.kinds = m.kinds || {}; m.kinds[who.kind] = (m.kinds[who.kind] || 0) + 1;
            if (who.kind !== 'browser' && who.name) { m.names = m.names || {}; const k = `${who.kind}|${clean(who.name, 60)}`; if (m.names[k] || Object.keys(m.names).length < GAUGE.weatherNames) m.names[k] = (m.names[k] || 0) + 1; }
          }
          m.last = now(); return m;
        }, (seen) => seen?.last != null);
      }
      return strip({ site: site.id, counted, dropped: dropped || undefined });
    },
    gaugeHeaders: async (key) => { try { return vercelVerify(await siteBy(key, 'sensor')); } catch { return {}; } },

    // ---------------------------------------------------------------- the owner's reading
    async gaugeSite(a = {}, ctx = {}) {
      const site = await siteBy(ctx.key, 'owner'), d = today(), y = dayBefore(d);
      const days = Array.from({ length: 30 }, (_, i) => dayBefore(d, 29 - i));
      const [t, p, w, ...series] = await Promise.all([kv.get(dK(site.id, d)), kv.get(dK(site.id, y)), kv.get(wK(site.id)), ...days.map((x) => kv.get(dK(site.id, x)))]);
      return {
        site: strip({ id: site.id, host: site.host, name: site.name, since: site.since, verified: site.verified || false, verifiedAt: site.verifiedAt, last: t?.last || p?.last || undefined }),
        today: { day: d, ...dayView(t), agentsTop: topNames(t), reads: topReads(t) },
        yesterday: { day: y, ...dayView(p), agentsTop: topNames(p), reads: topReads(p) },
        days: days.map((x, i) => { const v = dayView(series[i]); return { day: x, requests: v.requests, agents: v.agents, assistants: v.kinds.assistant || 0, aiSearch: v.kinds['search-ai'] || 0, aiCrawlers: v.kinds['ai-crawler'] || 0, search: v.kinds.search || 0, people: v.people }; }),
        forPeople: (Array.isArray(w) ? w : []).slice(0, 60),
        weather: site.verified ? 'this site counts into the public agent weather (never by name)' : `prove the domain to join the weather: put "${site.id}" in https://${site.host}${VERIFY_FILE}, then POST /gauge/verify`,
        kept: `counts ${GAUGE.keepDays} days, readings by assistants ${GAUGE.keepSightings} days; no address, cookie or query of any visitor`, notice: NOTICE,
      };
    },
    async gaugeVerify(a = {}, ctx = {}) {
      const site = await siteBy(ctx.key, 'owner');
      await allow(ctx, 'gauge proofs', GAUGE.verifyPerHour, 3600);
      const url = `https://${site.host}${VERIFY_FILE}`;
      if (!h.fetchText) { const sh = safeHost(site.host); if (!sh || !(await publicDns(sh))) throw bad('this host does not resolve to a public address'); }
      let body = null; try { body = await fetchText(url); } catch { body = null; }
      if (!body || !String(body).split(/\s+/).includes(site.id)) return { verified: false, file: url, expected: site.id, found: body == null ? 'no answer with status 200' : clean(body, 80), next: `put only "${site.id}" in ${url} and ask again` };
      const at = now();
      await kv.set(sK(site.id), { ...site, verified: true, verifiedAt: at }, keep.site);
      // one site stands for a host in the weather: the one whose id the domain shows now
      const prev = await kv.get(hK(site.host));
      if (prev && prev !== site.id) { const o = await kv.get(sK(prev)); if (o) await kv.set(sK(prev), { ...o, verified: false, verifiedAt: undefined }, keep.site); }
      await kv.set(hK(site.host), site.id, keep.site);
      return { verified: true, at, host: site.host, weather: `${base()}/weather` };
    },
    // settings the owner can give a gauge: the token a Vercel log drain asks the endpoint to echo
    async gaugeSet(a = {}, ctx = {}) {
      const site = await siteBy(ctx.key, 'owner');
      const v = a.vercelVerify == null ? site.vercelVerify : (/^[A-Za-z0-9_-]{4,120}$/.test(String(a.vercelVerify)) ? String(a.vercelVerify) : '') || undefined;
      const next = strip({ ...site, name: a.name != null ? clean(a.name, 80) || undefined : site.name, vercelVerify: v });
      await kv.set(sK(site.id), next, keep.site);
      return strip({ site: site.id, name: next.name, vercelVerify: next.vercelVerify ? 'set: the sensor address answers with x-vercel-verify' : undefined });
    },
    async gaugeRekey(a = {}, ctx = {}) {
      const site = await siteBy(ctx.key, 'owner');
      const which = ['sensor', 'owner'].includes(a.which) ? a.which : null;
      if (!which) throw bad('which is required: sensor or owner');
      await allow(ctx, 'gauge keys', GAUGE.keysPerHour, 3600);
      const key = `${which === 'sensor' ? 'mlgs' : 'mlgo'}_${rnd(32)}`, k = await kOf(key);
      await kv.set(k, { site: site.id, role: which }, keep.site);
      if (site.keys?.[which]) await kv.set(site.keys[which], null);
      await kv.set(sK(site.id), { ...site, keys: { ...site.keys, [which]: k } }, keep.site);
      return which === 'sensor' ? { sensor: sensorUrl(key), keep: 'The sensor address before this one no longer counts. Put this one in your server config.' } : { ownerKey: key, view: `${base()}/gauge/view#${key}`, keep: 'The owner key before this one no longer works. This one is shown once.' };
    },
    async gaugeClose(a = {}, ctx = {}) {
      const site = await siteBy(ctx.key, 'owner');
      if (hostOf(a.confirm) !== site.host) throw bad(`to close, send confirm with the host of this gauge (${site.host})`);
      for (const k of Object.values(site.keys || {})) await kv.set(k, null);
      if ((await kv.get(hK(site.host))) === site.id) await kv.set(hK(site.host), null);
      await kv.set(wK(site.id), null);
      await kv.set(sK(site.id), { id: site.id, closed: now() }, 30 * DAY);
      const n = Number(await kv.get('gauge:count')) || 1; await kv.set('gauge:count', Math.max(0, n - 1), keep.site);
      return { closed: true, host: site.host, note: `the counts of the last days fade within ${GAUGE.keepDays} days; nothing of this site is in the weather by name` };
    },

    // ---------------------------------------------------------------- the registries: what grew on the agent web
    async gaugeLakes(idx = {}) {
      const d = today();
      if (await kv.get(lK(d))) return { day: d, kept: 'already' };
      if (!idx || typeof idx !== 'object' || !idx.byLake) return { day: d, kept: 'no index' };
      await kv.set(lK(d), { at: now(), entries: Number(idx.entries) || 0, byLake: { ...idx.byLake }, byKind: { ...(idx.byKind || {}) } }, keep.lakes);
      return { day: d, kept: 'now' };
    },

    // ---------------------------------------------------------------- the agent weather of the web
    async weather() {
      const d = today(), days = Array.from({ length: 14 }, (_, i) => dayBefore(d, 13 - i));
      const [count, all, lakeDays] = await Promise.all([kv.get('gauge:count'), Promise.all(days.map((x) => kv.get(aK(x)))), Promise.all(Array.from({ length: 8 }, (_, i) => kv.get(lK(dayBefore(d, i)))))]);
      const t = all[13], p = all[12];
      const read = (m) => { const v = dayView(m); return { ...v, sites: Object.keys(m?.sites || {}).length, agentsTop: topNames(m, 25).filter((x) => AGENTISH.has(x.kind)) }; };
      const now0 = lakeDays[0] || lakeDays[1], before = lakeDays.find((x, i) => i >= 1 && x && x !== now0) || null, week = lakeDays.slice().reverse().find((x) => x && x !== now0) || null;
      const grew = now0 ? Object.keys(now0.byLake).map((lake) => strip({ lake, now: now0.byLake[lake], day: before ? now0.byLake[lake] - (before.byLake[lake] || 0) : undefined, week: week ? now0.byLake[lake] - (week.byLake[lake] || 0) : undefined })).sort((a, b) => (b.day ?? 0) - (a.day ?? 0)) : [];
      const kindsGrew = now0 && before ? Object.keys(now0.byKind || {}).map((k) => ({ kind: k, now: now0.byKind[k], day: now0.byKind[k] - ((before.byKind || {})[k] || 0) })).sort((a, b) => b.day - a.day) : [];
      const tv = read(t), pv = read(p);
      return {
        at: now(),
        sites: { gauges: Number(count) || 0, reportingToday: tv.sites, reportingYesterday: pv.sites },
        enough: tv.sites >= GAUGE.minSites || pv.sites >= GAUGE.minSites,
        note: tv.sites < GAUGE.minSites && pv.sites < GAUGE.minSites ? `fewer than ${GAUGE.minSites} websites with a proven domain report so far: these numbers describe very few sites` : undefined,
        today: { day: d, ...tv }, yesterday: { day: dayBefore(d), ...pv },
        days: days.map((x, i) => { const v = dayView(all[i]); return { day: x, sites: Object.keys(all[i]?.sites || {}).length, requests: v.requests, agents: v.agents, assistants: v.kinds.assistant || 0, aiSearch: v.kinds['search-ai'] || 0, aiCrawlers: v.kinds['ai-crawler'] || 0, people: v.people }; }),
        registries: strip({ day: now0 ? String(now0.at).slice(0, 10) : undefined, since: before ? String(before.at).slice(0, 10) : undefined, weekSince: week ? String(week.at).slice(0, 10) : undefined, entries: now0?.entries, grew, kinds: kindsGrew.length ? kindsGrew : undefined, note: now0 ? 'the size of each lake of the open index at the first tide of a day; a lake that did not answer in a build can look smaller for a day' : 'the first reading of the registries comes with the next tide' }),
        join: { new: `POST ${base()}/gauge/new {"host":"<your site>"}`, page: `${base()}/weather#gauge`, snippets: `${base()}/gauge/snippets` },
        notice: NOTICE,
      };
    },
  };
  return api;
}

// ---------------------------------------------------------------- the line for each kind of server
export function snippetsFor(base, sensor) {
  const url = `${base}/gauge/in/${sensor || 'mlgs_<your sensor key>'}`;
  return {
    nextjs: { file: 'middleware.ts (Next.js on Vercel or anywhere)', code: `import { NextResponse, type NextRequest, type NextFetchEvent } from 'next/server';

export function middleware(req: NextRequest, ev: NextFetchEvent) {
  ev.waitUntil(fetch('${url}', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ua: req.headers.get('user-agent') || '', path: req.nextUrl.pathname, method: req.method }),
  }).catch(() => {}));
  return NextResponse.next();
}
export const config = { matcher: '/((?!_next/|favicon.ico).*)' };` },
    cloudflare: { file: 'a Cloudflare Worker on the route of your site', code: `export default {
  async fetch(req, env, ctx) {
    const res = await fetch(req), u = new URL(req.url);
    ctx.waitUntil(fetch('${url}', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ua: req.headers.get('user-agent') || '', path: u.pathname, method: req.method, status: res.status }),
    }).catch(() => {}));
    return res;
  },
};` },
    node: { file: 'Express or any Node server', code: `app.use((req, res, next) => {
  res.on('finish', () => fetch('${url}', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ua: req.get('user-agent') || '', path: req.path, method: req.method, status: res.statusCode }),
  }).catch(() => {}));
  next();
});` },
    wordpress: { file: 'wp-content/mu-plugins/mare-gauge.php (WordPress; a page cache in front of PHP hides cached pages, a server log is then the better way)', code: `<?php
add_action('shutdown', function () {
  wp_remote_post('${url}', array('blocking' => false, 'timeout' => 0.5,
    'headers' => array('content-type' => 'application/json'),
    'body' => wp_json_encode(array('ua' => $_SERVER['HTTP_USER_AGENT'] ?? '', 'path' => parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH), 'method' => $_SERVER['REQUEST_METHOD'] ?? 'GET', 'status' => http_response_code()))));
});` },
    vercelDrain: { file: 'Vercel: Team Settings → Drains → Logs (no code; plans with drains)', code: `Endpoint: ${url}
Format: JSON or NDJSON · Sources: Static, Lambda, Edge, External
If Vercel asks the endpoint to echo a verification token:
  POST ${base}/gauge/set {"vercelVerify":"<the token>"}  with Authorization: Bearer <owner key>` },
    serverLog: { file: 'nginx, Apache or Caddy: a tiny program beside the server reads the access log (Node 18 or newer, nothing to install)', code: `curl -o gauge-tail.mjs ${base}/gauge/tail.mjs
node gauge-tail.mjs /var/log/nginx/access.log ${url}` },
    test: { file: 'try it', code: `curl -X POST ${url} -H 'content-type: application/json' -d '{"ua":"ChatGPT-User/1.0","path":"/pricing"}'` },
    privacy: 'Only the client name, the path without its query, the method and the status reach the sea. No address, no cookie, nothing a person typed. A person is counted as a number. You decide which paths the line runs on.',
  };
}

// the program beside a web server that reads its access log and sends the requests in batches. It starts at the end of
// the file, follows what is appended, survives a rotated log, and sends at most every ten seconds.
export const TAIL_MJS = `#!/usr/bin/env node
// Mare Liberum · gauge-tail: counts the agents in a web server's access log for your gauge.
// node gauge-tail.mjs <access.log> <sensor address>   (Node 18 or newer, nothing to install)
// Reads the combined log format (nginx, Apache) and Caddy's JSON log. Sends the client name, the path without its
// query, the method and the status; never an address. Stop with Ctrl+C.
import { openSync, readSync, statSync, closeSync } from 'node:fs';
const [file, sensor] = process.argv.slice(2);
if (!file || !/^https:\\/\\/.+\\/gauge\\/in\\/mlgs_[a-z2-9]{32}$/.test(sensor || '')) { console.error('usage: node gauge-tail.mjs <access.log> <sensor address from /gauge/new>'); process.exit(2); }
const COMBINED = /^\\S+ \\S+ \\S+ \\[[^\\]]+\\] "(\\S+) (\\S+)[^"]*" (\\d{3}) \\S+ "[^"]*" "([^"]*)"/;
const lineOf = (l) => {
  if (l.startsWith('{')) { try { const j = JSON.parse(l), r = j.request || {}; const ua = (r.headers?.['User-Agent'] || r.headers?.['user-agent'] || [])[0]; return ua == null ? null : { ua, path: String(r.uri || '/').split('?')[0], method: r.method, status: j.status }; } catch { return null; } }
  const m = COMBINED.exec(l); return m ? { ua: m[4], path: m[2].split('?')[0], method: m[1], status: Number(m[3]) } : null;
};
let pos = statSync(file).size, rest = '', out = [];
const send = async () => { if (!out.length) return; const batch = out.splice(0, 1000); try { const r = await fetch(sensor, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'MareGaugeTail/1.0' }, body: JSON.stringify(batch) }); if (!r.ok) console.error('gauge:', r.status, (await r.text()).slice(0, 200)); } catch (e) { console.error('gauge:', e.message); out.unshift(...batch.slice(0, 5000 - out.length)); } };
setInterval(() => {
  let size; try { size = statSync(file).size; } catch { return; }
  if (size < pos) pos = 0;
  if (size === pos) return;
  const fd = openSync(file, 'r'), buf = Buffer.alloc(Math.min(size - pos, 4_000_000)); readSync(fd, buf, 0, buf.length, pos); closeSync(fd); pos += buf.length;
  const lines = (rest + buf.toString('utf8')).split('\\n'); rest = lines.pop() || '';
  for (const l of lines) { const e = lineOf(l.trim()); if (e) out.push(e); }
  if (out.length > 20000) out = out.slice(-20000);
}, 1000);
setInterval(send, 10000);
console.log('gauge-tail: reading', file);
`;
