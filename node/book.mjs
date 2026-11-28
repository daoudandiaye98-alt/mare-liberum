// Mare Liberum · the record book (since 3.72, "Das Belegbuch"): the sea checks product pages on its own, every day, so the
// open price records (node/seen.mjs) are many and dated, and the same pages are seen again day after day.
// Why it exists: one record is cited by nobody; an answer engine quotes a source with many dated records, and a person asks
// whether a sale price was ever really the price, which only a series of looks at the same page can answer. Agents make few
// deal checks yet, so the sea makes some itself, openly, and says on every record it made that it made it.
//   where    the pages the current already picked for the needs of the sea (node/eco.mjs, tide:<slug>): a store's own product
//            page, never a checkout, never an Amazon page (its partner rules forbid price tracking), never a link with a tag
//   watch    at most BOOK.watch pages are the watch: the first pages that gave a record stay in it and are checked again every
//            day (UTC), first of all, so each has a price series; a watched page that gives no record leaves the watch
//   pace     at most BOOK.perDay visits a day (watch and new together), one visit per tide step, at most one visit per store in
//            BOOK.hostGapS seconds; the page is read once through the reader, so robots.txt is respected
//   counted  never as an agent's use: no deal check of the day, no read of the day, no look in the deal check's memory of what
//            agents saw; only the book's own numbers (visits, records, the watch) and its series per page
//   marked   each record the book made carries by: "sea" and the sentence BOOK.said; a record is otherwise like any other
//   seed     (since 3.76) the watch is filled first from a fixed start list, config/watch-seed.json: product pages of the stores
//            whose commission programmes the sea applied for, and of the goods people ask for most; at most BOOK.seedPerStore
//            pages per store, never more than the watch holds; the start list goes before the watch and its pages take their
//            places in it; the node reads the file once, when it starts (serve.mjs), and hands it to each step
//   dry      (since 3.76) a page that gave no comparison with another store (or no record at all) on BOOK.dryDays days in a row
//            rests BOOK.dryRestDays days: a start-list page is skipped, a watched page leaves the watch, a new page waits
//   again    (since 3.88, "Die Nachmessung") on the days from the Saturday after Black Friday to Cyber Monday (AGAIN.from to
//            AGAIN.to, UTC) every page that has a price measured on Black Friday is visited again first, once a day, also when it
//            rests dry; such a visit changes neither the dry pages nor the watch, and while the node has more than AGAIN.freeMB
//            of free memory these visits may go on past BOOK.perDay up to AGAIN.perDay a day, so the weekend balance
//            (node/bfcm.mjs) has the same pages on both days
// Everything here is pure, except the one read of the start list: node/lens.mjs reads and writes the state.
import { readFileSync } from 'node:fs';
import { canonOf, BOOK_SAID } from './seen.mjs';
import { uncommission, AMAZON } from './commission.mjs';

export const BOOK = Object.freeze({ perDay: 40, watch: 20, hostGapS: 3600, scan: 12, seriesMax: 60, keepDays: 120, said: BOOK_SAID, seedPerStore: 2, dryDays: 2, dryRestDays: 30, dryMax: 400 });

// the measuring again of the Black Friday pages (the days of BFCM in node/bfcm.mjs, written out here because that module is
// loaded after this one): its days, its pace a day and the free memory it needs to go past BOOK.perDay
export const AGAIN = Object.freeze({ bf: '2026-11-27', from: '2026-11-28', to: '2026-11-30', perDay: 100, freeMB: 800 });

const list = (x) => (Array.isArray(x) ? x : []);
export const bookHost = (u) => { try { return new URL(u).hostname.toLowerCase(); } catch { return null; } };

// a store's product page as the book visits it (scheme, host, path and a numeric variant), or null: only https, only a path that
// ends in /products/<handle> (the product pages of Shopify stores, where the current's picks come from), never Amazon
export function bookUrl(u) {
  let s = typeof u === 'string' ? u : ''; try { s = uncommission(s); } catch {}
  const c = canonOf(s); if (!c || !c.startsWith('https://')) return null;
  const host = bookHost(c); if (!host || AMAZON.test(host)) return null;
  let path = ''; try { path = new URL(c).pathname; } catch { return null; }
  return /\/products\/[^/]+\/?$/.test(path) && !/\/(cart|checkouts?)\//.test(path) ? c : null;
}

// the new pages one step can offer: the product pages of the current's picks, each once, in their order
export const freshOf = (snaps) => [...new Set(list(snaps).map((x) => bookUrl(x?.url)).filter(Boolean))];

// the start list from the text of config/watch-seed.json ({ "pages": [url, …] }) → { pages, skipped }: each page as the book
// visits it (bookUrl), each once, at most BOOK.seedPerStore per store and BOOK.watch in all; what does not fit is named in
// skipped with its reason, so a wrong line is seen and never visited
export function seedOf(raw) {
  let j = raw; if (typeof raw === 'string') { try { j = JSON.parse(raw); } catch { return { pages: [], skipped: [{ page: null, why: 'the file is no JSON' }] }; } }
  const pages = [], skipped = [], per = {};
  for (const p of list(j?.pages)) {
    const u = bookUrl(p), h = u && bookHost(u);
    if (!u) skipped.push({ page: String(p).slice(0, 200), why: 'no store product page over https (or an Amazon page)' });
    else if (pages.includes(u)) skipped.push({ page: u, why: 'twice' });
    else if ((per[h] || 0) >= BOOK.seedPerStore) skipped.push({ page: u, why: `more than ${BOOK.seedPerStore} pages of ${h}` });
    else if (pages.length >= BOOK.watch) skipped.push({ page: u, why: `more than ${BOOK.watch} pages` });
    else { pages.push(u); per[h] = (per[h] || 0) + 1; }
  }
  return { pages, skipped };
}
export const WATCH_SEED_FILE = new URL('../config/watch-seed.json', import.meta.url);
// the start list as the node starts with it: the file in the repository; no file or a broken one is an empty list
export function loadWatchSeed(file = WATCH_SEED_FILE) { let t = null; try { t = readFileSync(file, 'utf8'); } catch { return []; } return seedOf(t).pages; }

const dayBefore = (day) => { const t = Date.parse(`${day}T00:00:00.000Z`); return Number.isFinite(t) ? new Date(t - 86_400_000).toISOString().slice(0, 10) : null; };
const daysBetween = (a, b) => { const x = Date.parse(`${a}T00:00:00.000Z`), y = Date.parse(`${b}T00:00:00.000Z`); return Number.isFinite(x) && Number.isFinite(y) ? Math.round((y - x) / 86_400_000) : Infinity; };
const mapOf = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});
// the dry pages after one visit on `day`: a page that was compared with another store is no longer dry; one that was not counts
// one more day when its last dry day was yesterday, else starts at one (a second visit the same day changes nothing); a page
// whose last dry day is more than BOOK.dryRestDays days back is forgotten, and at most BOOK.dryMax pages are kept
export function dryAfter(dry, url, day, compared) {
  const m = {};
  for (const [u, x] of Object.entries(mapOf(dry))) if (x && daysBetween(x.d, day) <= BOOK.dryRestDays) m[u] = { d: x.d, n: Number(x.n) || 1 };
  if (url) {
    const x = m[url];
    if (compared) delete m[url];
    else if (!x || x.d !== day) m[url] = { d: day, n: x && x.d === dayBefore(day) ? x.n + 1 : 1 };
  }
  const keep = Object.entries(m).sort((a, b) => (a[1].d < b[1].d ? 1 : -1)).slice(0, BOOK.dryMax);
  return Object.fromEntries(keep);
}
// a page rests while it was dry on BOOK.dryDays days in a row and its last dry day is at most BOOK.dryRestDays days back
export const isDry = (dry, url, day) => { const x = mapOf(dry)[url]; return !!x && (Number(x.n) || 0) >= BOOK.dryDays && (!day || daysBetween(x.d, day) <= BOOK.dryRestDays); };

// whether `day` (UTC) is a day of measuring again, and how many visits the book may make that day with `freeMB` of free memory:
// past BOOK.perDay only on such a day and only with more than AGAIN.freeMB (an unknown amount is too little)
export const againOn = (day) => /^\d{4}-\d{2}-\d{2}$/.test(String(day || '')) && day >= AGAIN.from && day <= AGAIN.to;
export const perDayOn = (day, freeMB) => (againOn(day) && Number.isFinite(freeMB) && freeMB > AGAIN.freeMB ? AGAIN.perDay : BOOK.perDay);
// the pages to measure again: of the pages given, each once, those a store's product page whose series has a price on Black Friday
export const againOf = (urls, seriesOf = () => []) => [...new Set(list(urls).map(bookUrl).filter(Boolean))].filter((u) => list(seriesOf(u)).some((x) => x && x.d === AGAIN.bf && Number.isFinite(x.p) && x.p > 0));

// what the book visits next → { url, kind: 'again' | 'seed' | 'watch' | 'new' } or null: (since 3.88) first a page to measure
// again (`again`, given only on a day of measuring again; it may rest dry), then a page of the start list, then a watched page,
// then a new page, each not visited today; a page visited today, a store visited within the gap (busy), a page that rests dry
// and a day with BOOK.perDay visits made all wait; past BOOK.perDay only a page to measure again, up to `max` visits
export function nextVisit({ tried = 0, seed = [], watch = [], done = [], fresh = [], again = [], busy = () => false, dry = () => false, max = BOOK.perDay } = {}) {
  const d = new Set(list(done)), free = (url) => !d.has(url) && !busy(bookHost(url));
  if (tried < Math.max(max, BOOK.perDay)) for (const url of list(again)) if (free(url)) return { url, kind: 'again' };
  if (!(tried < BOOK.perDay)) return null;
  const s = list(seed), w = list(watch), ok = (url) => free(url) && !dry(url);
  for (const url of s) if (ok(url)) return { url, kind: 'seed' };
  const ss = new Set(s);
  for (const url of w) if (!ss.has(url) && ok(url)) return { url, kind: 'watch' };
  const ws = new Set([...s, ...w]);
  for (const url of list(fresh)) if (!ws.has(url) && ok(url)) return { url, kind: 'new' };
  return null;
}

// the watch after one visit: a new page that gave a record joins while there is room (the pages of the start list take their
// places first: room is BOOK.watch less them); a watched page that gave none, or that now rests dry, leaves; a visit of the
// start list, and (since 3.88) a visit to measure again, leave the watch as it is
export function watchAfter(watch, visit, made, { seeded = 0, dry = false } = {}) {
  const w = list(watch);
  if (visit?.kind === 'seed' || visit?.kind === 'again') return w;
  if (visit?.kind === 'watch') return made && !dry ? w : w.filter((u) => u !== visit.url);
  return made && !dry && visit?.url && w.length < BOOK.watch - seeded && !w.includes(visit.url) ? [...w, visit.url] : w;
}

// a page's series after one more look: one price a day (a later look the same day replaces the earlier), oldest first, at most
// BOOK.seriesMax days
export function seriesAfter(series, { day, price, currency, record } = {}) {
  const xs = list(series).filter((x) => x && x.d !== day);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day || '')) || !(Number.isFinite(price) && price > 0) || !currency) return list(series);
  return [...xs, { d: day, p: price, c: currency, ...(record ? { r: record } : {}) }].sort((a, b) => (a.d < b.d ? -1 : 1)).slice(-BOOK.seriesMax);
}

// the book's numbers of a day, as /seen and /seen.json say them
// (since 3.76 with seed: how many of the watched pages come from the start list, and dry: how many pages rest; both only when
// there are any, so a book without a start list says what it said before; since 3.88 with again: the Black Friday pages measured
// again today, only on a day of measuring again)
export const bookSays = ({ day, tried = 0, records = 0, watch = 0, seed = 0, dry = 0, again = null } = {}) => ({
  what: 'the sea\'s own daily sample of product pages: each visit is a deal check made by the sea, marked by: "sea" in its record, never counted as an agent\'s use',
  day, visits: tried, records, watch: watch + seed, per_day: BOOK.perDay, watch_max: BOOK.watch, ...(seed ? { seed } : {}), ...(dry ? { dry } : {}), ...(again ? { again } : {}),
});
