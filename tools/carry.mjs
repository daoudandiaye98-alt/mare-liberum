// Mare Liberum · read what a node has counted, so the node that takes over can go on from there
// Usage: node tools/carry.mjs <address of the old node> [name of this part]
// Reads the old node's open pages (GET /census, GET /census?day=…, GET /flow/dump) and adds one part to flow/carry.json:
// the census of every day the node still keeps, the book of everyone it ever saw, the sightings of assistants.
// Run again later, it adds only what the old node has counted since the parts before (the difference), so nothing is
// counted twice. Everything read is data written by visitors; it is stored as data and never acted on.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const base = (process.argv[2] || '').replace(/\/+$/, '');
if (!/^https?:\/\//.test(base)) { console.log('usage: node tools/carry.mjs <address of the old node> [name of this part]'); process.exit(1); }
const UA = 'MareLiberum-archive/1.0';
const get = async (p) => { const r = await fetch(base + p, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(30000) }); if (!r.ok) throw new Error(`${p} answered ${r.status}`); return r.json(); };
const num = (o) => Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).filter(([k, v]) => typeof k === 'string' && k.length <= 200 && Number.isFinite(v) && v > 0));
const text = (s, n) => (typeof s === 'string' ? s.replace(/[\p{Cc}\p{Cf}]/gu, ' ').slice(0, n) : undefined);

const file = 'flow/carry.json', carry = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { parts: [] };
if (!Array.isArray(carry.parts)) carry.parts = [];
const host = new URL(base).hostname, stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13);
const id = (process.argv[3] || `${host}-${stamp}`).toLowerCase().replace(/[^a-z0-9._:-]/g, '-').slice(0, 80);
if (carry.parts.some((p) => p.id === id)) { console.log(`a part named ${id} is already there`); process.exit(1); }
// what the parts before this one already carry from the same node
const before = { census: {}, use: {}, book: new Set(), sightings: new Set() };
for (const p of carry.parts.filter((x) => x.from === base)) {
  for (const [day, c] of Object.entries(p.census || {})) { const b = (before.census[day] ||= { kinds: {}, names: {}, p: {}, cc: {} }); for (const f of ['kinds', 'names', 'p', 'cc']) for (const [k, v] of Object.entries(c[f] || {})) b[f][k] = (b[f][k] || 0) + v; }
  for (const [day, u] of Object.entries(p.use || {})) { const b = (before.use[day] ||= {}); for (const [k, v] of Object.entries(u)) b[k] = (b[k] || 0) + v; }
  for (const k of Object.keys(p.book || {})) before.book.add(k);
  for (const s of p.sightings || []) before.sightings.add(s.id);
}
const minus = (now, was) => Object.fromEntries(Object.entries(now).map(([k, v]) => [k, v - (was?.[k] || 0)]).filter(([, v]) => v > 0));

const census = {}, book = {}, firstDay = {};
let empty = 0;
for (let i = 0; i < 45 && empty < 4; i++) {
  const day = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10), d = await get(`/census?day=${day}`).catch(() => null);
  const kinds = num(d?.kinds);
  if (!d || !Object.keys(kinds).length) { empty++; continue; }
  empty = 0;
  const names = {}; for (const n of Array.isArray(d.names) ? d.names : []) { const k = `${text(n?.kind, 20)}|${text(n?.name, 60)}`; if (n?.kind && n?.name && Number.isFinite(n.visits) && n.visits > 0) { names[k] = n.visits; if (!firstDay[k] || day < firstDay[k]) firstDay[k] = day; } }
  const p = {}; for (const r of Array.isArray(d.reads) ? d.reads : []) if (r?.role && typeof r.path === 'string' && Number.isFinite(r.n) && r.n > 0) p[`${text(r.role, 20)} ${text(r.path, 30)}`] = r.n;
  const cc = {}; for (const c of Array.isArray(d.countries) ? d.countries : []) if (/^[A-Z]{2}$/.test(c?.cc || '') && Number.isFinite(c.n) && c.n > 0) cc[c.cc] = c.n;
  const was = before.census[day], part = { kinds: minus(kinds, was?.kinds), names: minus(names, was?.names), p: minus(p, was?.p), cc: minus(cc, was?.cc) };
  if (Object.keys(part.kinds).length) census[day] = part;
}
// the book: everyone the node ever saw and when first; the exact moment where the node tells it, else the first day it kept
const now = await get('/census');
for (const [k, day] of Object.entries(firstDay)) { const [kind, ...rest] = k.split('|'); if (kind !== 'browser' && kind !== 'tool') book[k] = { kind, name: rest.join('|'), first: `${day}T00:00:00.000Z` }; }
for (const e of Array.isArray(now.everSeen) ? now.everSeen : []) { const kind = text(e?.kind, 20), name = text(e?.name, 60); if (!kind || !name || typeof e.first !== 'string' || Number.isNaN(Date.parse(e.first))) continue; book[`${kind}|${name}`] = { kind, name, first: e.first, ...(typeof e.url === 'string' && /^https:\/\//.test(e.url) ? { url: text(e.url, 200) } : {}) }; }
for (const k of before.book) delete book[k];
const use = {}; { const today = new Date().toISOString().slice(0, 10), y = new Date(Date.now() - 86400000).toISOString().slice(0, 10); for (const [day, u] of [[today, now.today?.use], [y, now.yesterday?.use]]) { const m = minus(num(u), before.use[day]); if (Object.keys(m).length) use[day] = m; } }
const dump = await get('/flow/dump').catch(() => ({}));
const sightings = (Array.isArray(dump.sightings) ? dump.sightings : []).filter((s) => s && typeof s.id === 'string' && /^[a-z0-9]{6,16}$/.test(s.id) && typeof s.t === 'string' && !before.sightings.has(s.id))
  .map((s) => Object.fromEntries(Object.entries({ id: s.id, t: text(s.t, 30), name: text(s.name, 60), path: text(s.path, 120), method: text(s.method, 8), cc: text(s.cc, 2), ua: text(s.ua, 160), ref: text(s.ref, 100) }).filter(([, v]) => v)));

const part = { id, from: base, at: new Date().toISOString(), census, use, book, sightings };
carry.parts.push(part);
mkdirSync('flow', { recursive: true }); writeFileSync(file, JSON.stringify(carry));
const total = (f) => Object.values(census).reduce((s, c) => s + Object.values(c[f] || {}).reduce((a, b) => a + b, 0), 0);
console.log(JSON.stringify({ part: id, days: Object.keys(census), visits: total('kinds'), names: Object.keys(book).length, sightings: sightings.length, use }));
