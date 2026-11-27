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
// Everything here is pure: node/lens.mjs reads and writes the state.
import { canonOf, BOOK_SAID } from './seen.mjs';
import { uncommission, AMAZON } from './commission.mjs';

export const BOOK = Object.freeze({ perDay: 40, watch: 20, hostGapS: 3600, scan: 12, seriesMax: 60, keepDays: 120, said: BOOK_SAID });

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

// what the book visits next → { url, kind: 'watch' | 'new' } or null: first a watched page not visited today, then a new page;
// a page visited today, a store visited within the gap (busy) and a day with BOOK.perDay visits made all wait
export function nextVisit({ tried = 0, watch = [], done = [], fresh = [], busy = () => false } = {}) {
  if (!(tried < BOOK.perDay)) return null;
  const d = new Set(list(done)), w = list(watch);
  for (const url of w) if (!d.has(url) && !busy(bookHost(url))) return { url, kind: 'watch' };
  const ws = new Set(w);
  for (const url of list(fresh)) if (!d.has(url) && !ws.has(url) && !busy(bookHost(url))) return { url, kind: 'new' };
  return null;
}

// the watch after one visit: a new page that gave a record joins while there is room; a watched page that gave none leaves
export function watchAfter(watch, visit, made) {
  const w = list(watch);
  if (visit?.kind === 'watch') return made ? w : w.filter((u) => u !== visit.url);
  return made && visit?.url && w.length < BOOK.watch && !w.includes(visit.url) ? [...w, visit.url] : w;
}

// a page's series after one more look: one price a day (a later look the same day replaces the earlier), oldest first, at most
// BOOK.seriesMax days
export function seriesAfter(series, { day, price, currency, record } = {}) {
  const xs = list(series).filter((x) => x && x.d !== day);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day || '')) || !(Number.isFinite(price) && price > 0) || !currency) return list(series);
  return [...xs, { d: day, p: price, c: currency, ...(record ? { r: record } : {}) }].sort((a, b) => (a.d < b.d ? -1 : 1)).slice(-BOOK.seriesMax);
}

// the book's numbers of a day, as /seen and /seen.json say them
export const bookSays = ({ day, tried = 0, records = 0, watch = 0 } = {}) => ({
  what: 'the sea\'s own daily sample of product pages: each visit is a deal check made by the sea, marked by: "sea" in its record, never counted as an agent\'s use',
  day, visits: tried, records, watch, per_day: BOOK.perDay, watch_max: BOOK.watch,
});
