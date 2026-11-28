// Mare Liberum · what the sea counted on the node before travels to the node that takes over
// A node keeps the census of each day, the book of everyone it ever saw and the sightings of assistants in its own
// living memory. When the sea moves to another machine, those counts are read from the old node's open pages
// (tools/carry.mjs), travel with the build (flow/carry.json) and are added, once, to what the new node counted itself.
//   carry: { parts: [ { id, at, census: { day: { kinds, names, p, cc, np } }, use: { day: {..} }, book: { 'kind|name': { kind, name, first, url } }, sightings: [..] } ] }
//   a part is taken in once (its id is remembered); counts are added, the book keeps the earliest sight of a name
const DAY = 86400;
const add = (into, from) => { for (const [k, v] of Object.entries(from && typeof from === 'object' ? from : {})) if (typeof k === 'string' && k.length <= 200 && Number.isFinite(v) && v > 0) into[k] = (into[k] || 0) + v; return into; };

export async function carryIn(kv, carry, { now = Date.now } = {}) {
  const parts = Array.isArray(carry?.parts) ? carry.parts : [], done = [];
  for (const part of parts) {
    if (!part || typeof part.id !== 'string' || !/^[a-z0-9][a-z0-9._:-]{2,80}$/i.test(part.id)) continue;
    const mark = `carry:${part.id}`;
    if (await kv.get(mark)) continue;
    // remembered first: a part that breaks off half-way is not added a second time
    await kv.set(mark, { at: new Date(now()).toISOString() });
    const out = { id: part.id, days: 0, names: 0, sightings: 0 };
    for (const [day, c] of Object.entries(part.census && typeof part.census === 'object' ? part.census : {})) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !c || typeof c !== 'object') continue;
      const left = 40 * DAY - Math.floor((now() - Date.parse(day)) / 1000); if (!(left > 3600)) continue;
      const cur = await kv.get(`census:${day}`), m = cur && typeof cur === 'object' ? cur : { kinds: {}, names: {} };
      m.kinds = add(m.kinds || {}, c.kinds); m.names = add(m.names || {}, c.names);
      if (c.p) m.p = add(m.p || {}, c.p); if (c.cc) m.cc = add(m.cc || {}, c.cc);
      if (c.np) m.np = add(m.np || {}, c.np);
      await kv.set(`census:${day}`, m, left); out.days++;
    }
    for (const [day, u] of Object.entries(part.use && typeof part.use === 'object' ? part.use : {})) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
      const left = 45 * DAY - Math.floor((now() - Date.parse(day)) / 1000); if (!(left > 3600)) continue;
      const cur = await kv.get(`use:${day}`); await kv.set(`use:${day}`, add(cur && typeof cur === 'object' ? cur : {}, u), left);
    }
    if (part.book && typeof part.book === 'object') {
      const cur = await kv.get('census:names'), book = cur && typeof cur === 'object' ? cur : {};
      for (const [k, b] of Object.entries(part.book)) {
        if (!b || typeof b.name !== 'string' || typeof b.kind !== 'string' || typeof b.first !== 'string' || Number.isNaN(Date.parse(b.first))) continue;
        const key = `${b.kind}|${b.name}`.slice(0, 120); if (key !== k) continue;
        if (!book[key] || String(b.first) < String(book[key].first)) { book[key] = { kind: b.kind.slice(0, 20), name: b.name.slice(0, 60), first: b.first, ...(typeof b.url === 'string' && /^https:\/\//.test(b.url) ? { url: b.url.slice(0, 200) } : {}) }; out.names++; }
      }
      await kv.set('census:names', book, 90 * DAY);
    }
    if (Array.isArray(part.sightings) && part.sightings.length) {
      const cur = await kv.get('sightings'), have = Array.isArray(cur) ? cur : [], ids = new Set(have.map((s) => s.id));
      const fresh = part.sightings.filter((s) => s && typeof s.id === 'string' && /^[a-z0-9]{6,16}$/.test(s.id) && typeof s.t === 'string' && !Number.isNaN(Date.parse(s.t)) && !ids.has(s.id))
        .map((s) => Object.fromEntries(Object.entries({ id: s.id, t: s.t, name: s.name, path: s.path, method: s.method, cc: s.cc, ua: s.ua, ref: s.ref }).filter(([, v]) => typeof v === 'string' && v).map(([k, v]) => [k, v.slice(0, 160)])));
      if (fresh.length) { await kv.set('sightings', [...have, ...fresh].sort((a, b) => (a.t < b.t ? 1 : -1)).slice(0, 2000), 400 * DAY); out.sightings = fresh.length; }
    }
    done.push(out);
  }
  return done;
}
