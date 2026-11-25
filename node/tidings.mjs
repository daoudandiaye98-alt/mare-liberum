// Mare Liberum · tidings: what really changed in the sea, and when.
// Two uses, one record:
//   lastmod   the sitemap of the hubs (/sitemaps/hubs.xml) dates a hub by the day its words, links or structured data
//             last changed, as the sea saw them, and names no day before it saw a change. Numbers that move by themselves
//             (counts, clocks, dates, versions) are no change of a page: they are left out of what is compared.
//   IndexNow  beside the daily run (node/core.mjs indexNowDaily) a second, smaller path: after a tide that changed
//             something, only the pages that changed (a hub whose words or links moved, a need whose pick or price
//             moved) and the pages never told before (new hubs, lists, works, topics, mapped sites), at most 10,000
//             in one post and at most every 3 hours.
// The hubs are looked at by the sea itself (its own call, counted nowhere), at most every 3 hours, on the tide.
import { createHash } from 'node:crypto';
import { HUB_SET } from './hubs.mjs';

export const TIDINGS = { everyMs: 3 * 3600e3, perPost: 10_000, queueMax: 20_000, toldMax: 30_000, ttl: 400 * 86400 };

// a page as the comparison sees it: its words, links and structured data. Scripts that run and styles are the frame's
// behaviour and look (they change with a release, which changes the words as well); digits are counts, clocks, dates and
// versions; receipt ids are new with every counted answer; the units of time follow the clock ("3 minutes ago", "2 hours
// ago"); spacing is no content
export function fingerprint(html) {
  const s = String(html || '')
    .replace(/<script\b(?![^>]*application\/ld\+json)[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    // the id of a fair-share receipt (node/fair.mjs: r + the day + 8 letters) is a new id with every counted answer, no change
    // of the page; it goes before the digits do, which would leave its letters behind
    .replace(/r\d{8}[a-z0-9]{8}/g, 'r-receipt')
    .replace(/\d+/g, '#')
    .replace(/\b(second|minute|hour|day|week|month|year)s?\b/gi, 'time')
    .replace(/\s+/g, ' ').replace(/ ?(<[^>]*>) ?/g, '$1');
  return createHash('sha256').update(s).digest('hex').slice(0, 20);
}
const h8 = (p) => createHash('sha256').update(String(p)).digest('hex').slice(0, 8);
const dayOf = (t) => new Date(t).toISOString().slice(0, 10);

export function createTidings({ kv, now = () => Date.now() } = {}) {
  let mods = null;
  const load = async () => (mods ||= ((await kv?.get('tidings:hubs').catch(() => null)) || {}));
  const t = {
    // a hub as it was just served: a change of its words, links or structured data is dated today and queued for IndexNow.
    // The first look knows no day (the page may have been the same for weeks): it is dated by the next change it sees.
    async look(path, html) {
      if (!HUB_SET.has(path)) return null;
      const m = await load(), h = fingerprint(html), was = m[path];
      if (was?.h === h) return { path, changed: false, day: was.day || null };
      m[path] = { h, day: was ? dayOf(now()) : null };
      await kv?.set('tidings:hubs', m, TIDINGS.ttl).catch(() => {});
      if (was) await t.queue([path]);
      return { path, changed: !!was, day: m[path].day };
    },
    // the day each hub last changed, where the sea saw it change
    async lastmods() { const m = await load(); return Object.fromEntries(Object.entries(m).filter(([, v]) => v?.day).map(([p, v]) => [p, v.day])); },
    // pages that changed, kept until a post (daily or changed) told the engines
    async queue(paths) {
      const add = [...new Set((paths || []).filter((p) => typeof p === 'string' && p.startsWith('/')))]; if (!add.length || !kv) return 0;
      const q = (await kv.get('tidings:queue').catch(() => null)) || [], have = new Set(q.map((x) => x.p)), at = new Date(now()).toISOString();
      for (const p of add) if (!have.has(p)) q.push({ p, t: at });
      await kv.set('tidings:queue', q.slice(-TIDINGS.queueMax), TIDINGS.ttl).catch(() => {});
      return add.length;
    },
    async queued() { return ((await kv?.get('tidings:queue').catch(() => null)) || []).map((x) => x.p); },
    // what a post told leaves the queue
    async sent(paths) {
      if (!kv) return;
      const ps = new Set(paths), q = (await kv.get('tidings:queue').catch(() => null)) || [], left = q.filter((x) => !ps.has(x.p));
      if (left.length !== q.length) await kv.set('tidings:queue', left, TIDINGS.ttl).catch(() => {});
    },
    // the pages of the families the engines were told (hubs, lists, works, topics, mapped sites): no new page any more
    async known(paths) {
      if (!kv) return;
      const known = (await kv.get('tidings:told').catch(() => null)) || [], set = new Set(known), n0 = known.length;
      for (const p of new Set(paths)) { const k = h8(p); if (!set.has(k)) { set.add(k); known.push(k); } }
      if (known.length !== n0) await kv.set('tidings:told', known.slice(-TIDINGS.toldMax), TIDINGS.ttl).catch(() => {});
    },
    async knowsAny() { return ((await kv?.get('tidings:told').catch(() => null)) || []).length > 0; },
    // of these pages, the ones never told before
    async fresh(paths) { const set = new Set((await kv?.get('tidings:told').catch(() => null)) || []); return [...new Set(paths)].filter((p) => !set.has(h8(p))); },
  };
  return t;
}
