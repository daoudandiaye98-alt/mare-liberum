// Mare Liberum · the weekend balance (since 3.87, "Die Wochenend-Bilanz"): did waiting from Black Friday to Cyber Monday pay
// off? The record book (node/book.mjs) checks the same product pages every day on the store's own page, so for each watched
// page there is one measured price on Black Friday (27 Nov 2026) and, once that day is measured, one on Cyber Monday
// (30 Nov 2026). This page counts only those: no forecast, no estimate, no price from anywhere but the store's own page.
//   ground   a page counts when its own series has a measured price on both days, in the same currency; a page with only one
//            of the two days is left out, and the number left out stands in the first sentence
//   verdict  the title, the heading and the first sentence say how many pages were cheaper on Cyber Monday, how many dearer,
//            how many unchanged and the median change; before Cyber Monday is measured they say what Black Friday measured
//   rows     one line per page: the product, the store, the price on Black Friday, on Saturday and Sunday when measured, on
//            Cyber Monday, the change, and the lowest price measured after Cyber Monday until 15 Jan 2027 (the price-match
//            windows), ordered by the change, the largest fall first; each links its open record
//   index    noindex until 10 pages count and Cyber Monday is measured; never an Amazon page; CC BY 4.0
// Everything here is pure: node/lens.mjs gathers the rows (bfcmRows), node/core.mjs serves the page and its JSON.
import { SEEN, pageKit } from './seen.mjs';
import { AMAZON } from './commission.mjs';

export const BFCM = Object.freeze({ path: `${SEEN.path}/bfcm-2026`, bf: '2026-11-27', sat: '2026-11-28', sun: '2026-11-29', cm: '2026-11-30', until: '2027-01-15', min: 10 });

const { esc, ld, money, head, NAV } = pageKit;
const list = (x) => (Array.isArray(x) ? x : []);
const cents = (p) => Math.round(Number(p) * 100);
const r1 = (x) => Math.round(x * 10) / 10;
const median = (xs) => { const s = xs.filter(Number.isFinite).sort((a, b) => a - b); if (!s.length) return null; const m = s.length >> 1; return r1(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2); };
const point = (series, day) => list(series).find((x) => x && x.d === day && Number.isFinite(x.p) && x.p > 0 && x.c) || null;

// a product page the balance may count: a store's own https product page, never an Amazon page
export function bfcmPage(url) {
  try { const u = new URL(String(url || '')); return u.protocol === 'https:' && /\/products\/[^/]+/.test(u.pathname) && !AMAZON.test(u.hostname.toLowerCase()); } catch { return false; }
}

// one page's line: its measured prices on the days of the weekend and after; null when it has no measured price on either day
export function bfcmLine(row) {
  if (!row || !bfcmPage(row.url)) return null;
  const s = list(row.series), bf = point(s, BFCM.bf), cm = point(s, BFCM.cm);
  if (!bf && !cm) return null;
  const cur = (bf || cm).c, both = !!bf && !!cm && bf.c === cm.c;
  const same = (p) => (p && p.c === cur ? p.p : null), sat = same(point(s, BFCM.sat)), sun = same(point(s, BFCM.sun));
  const after = s.filter((x) => x && x.d > BFCM.cm && x.d <= BFCM.until && x.c === cur && Number.isFinite(x.p) && x.p > 0).sort((a, b) => a.p - b.p || (a.d < b.d ? -1 : 1))[0] || null;
  const host = (() => { try { return new URL(row.url).hostname.replace(/^www\./, ''); } catch { return null; } })();
  return {
    name: row.name || null, store: row.store || host, url: row.url, currency: cur,
    black_friday: bf ? bf.p : null, ...(sat != null ? { saturday: sat } : {}), ...(sun != null ? { sunday: sun } : {}), cyber_monday: cm ? cm.p : null,
    counted: both, change_pct: both ? r1(((cm.p - bf.p) / bf.p) * 100) : null,
    ...(both ? { moved: cents(cm.p) < cents(bf.p) ? 'cheaper' : cents(cm.p) > cents(bf.p) ? 'dearer' : 'unchanged' } : {}),
    ...(after ? { lowest_after_cyber_monday: { price: after.p, on: after.d } } : {}),
    record: (cm && cm.r) || (bf && bf.r) || null,
  };
}

// the balance of all pages on the day `day` (UTC): the counts, the median change and the lines, the largest fall first
export function bfcmOf(rows, day) {
  const lines = list(rows).map(bfcmLine).filter(Boolean), counted = lines.filter((x) => x.counted);
  const n = (w) => counted.filter((x) => x.moved === w).length;
  const order = (a, b) => (a.counted !== b.counted ? (a.counted ? -1 : 1) : a.counted ? a.change_pct - b.change_pct : String(a.name || a.url).localeCompare(String(b.name || b.url)));
  return {
    day: day || null, pages: counted.length, cheaper: n('cheaper'), dearer: n('dearer'), unchanged: n('unchanged'),
    median_change_pct: median(counted.map((x) => x.change_pct)), left_out: lines.length - counted.length,
    measured_black_friday: lines.filter((x) => x.black_friday != null).length, measured_cyber_monday: lines.filter((x) => x.cyber_monday != null).length,
    lines: lines.sort(order),
  };
}

const LONG = (d) => `${Number(d.slice(8, 10))} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
const pages = (k) => `${k} product page${k === 1 ? '' : 's'}`;
// the heading and the first sentence: the verdict once both days are measured, before that what Black Friday measured
export function bfcmHeadline(b) {
  if (b.pages) return `Black Friday or Cyber Monday? ${b.cheaper} of ${pages(b.pages)} were cheaper on Cyber Monday`;
  return `Black Friday or Cyber Monday? Measured on Black Friday (${LONG(BFCM.bf)}): ${pages(b.measured_black_friday)}`;
}
export function bfcmLead(b) {
  const out = b.left_out ? ` ${pages(b.left_out)} measured on only one of the two days ${b.left_out === 1 ? 'is' : 'are'} left out.` : '';
  if (b.pages) return `Of ${pages(b.pages)} measured on the store's own page on both days, ${b.cheaper} were cheaper on Cyber Monday, ${b.dearer} dearer and ${b.unchanged} unchanged; the median change was ${b.median_change_pct} %.${out}`;
  const next = String(b.day || '') >= BFCM.cm ? `the Cyber Monday measurement runs today (${LONG(BFCM.cm)})` : `the Cyber Monday measurement follows on ${LONG(BFCM.cm)}`;
  return `Measured on Black Friday (${LONG(BFCM.bf)}): ${pages(b.measured_black_friday)} on the store's own page; ${next}, then this page says which were cheaper.`;
}
export const bfcmIndexable = (b) => b.pages >= BFCM.min && String(b.day || '') >= BFCM.cm;

const HOW = 'Counted only from the sea\'s own daily sample of product pages: the price each store\'s own product page asked, read once a day (UTC), the same pages every day. A page counts when it was measured on both Black Friday and Cyber Monday in the same currency; unchanged means the same price to the cent. No forecast, no estimate and no Amazon page is in these numbers.';

export function bfcmJson(rows, base, day) {
  const b0 = String(base || '').replace(/\/+$/, ''), b = bfcmOf(rows, day);
  return {
    what: 'Black Friday or Cyber Monday, measured: the same product pages on the store\'s own page on both days', days: { black_friday: BFCM.bf, saturday: BFCM.sat, sunday: BFCM.sun, cyber_monday: BFCM.cm, after_until: BFCM.until },
    headline: bfcmHeadline(b), lead: bfcmLead(b), ...b, lines: b.lines.map((x) => ({ ...x, ...(x.record ? { record: `${b0}${SEEN.path}/${x.record}` } : {}) })),
    how: HOW, indexable: bfcmIndexable(b), license: 'https://creativecommons.org/licenses/by/4.0/', page: `${b0}${BFCM.path}`, records: `${b0}${SEEN.path}`, check_one: `${b0}/deal?url=<product page>`,
  };
}

export function bfcmHtml(rows, base, day) {
  const b0 = String(base || '').replace(/\/+$/, ''), b = bfcmOf(rows, day), H = bfcmHeadline(b), lead = bfcmLead(b);
  const robots = bfcmIndexable(b) ? '' : '<meta name="robots" content="noindex,follow">';
  const sat = b.lines.some((x) => 'saturday' in x), sun = b.lines.some((x) => 'sunday' in x), after = b.lines.some((x) => x.lowest_after_cyber_monday);
  const p = (v, c) => (v == null ? '–' : esc(money(v, c)));
  const row = (x) => `<tr><td>${x.record ? `<a href="${SEEN.path}/${esc(x.record)}">${esc(x.name || 'a product')}</a>` : esc(x.name || 'a product')}<br><small>${esc(x.store || '')}</small></td><td class="n">${p(x.black_friday, x.currency)}</td>${sat ? `<td class="n">${p(x.saturday, x.currency)}</td>` : ''}${sun ? `<td class="n">${p(x.sunday, x.currency)}</td>` : ''}<td class="n">${p(x.cyber_monday, x.currency)}</td><td class="n">${x.change_pct == null ? '–' : `${x.change_pct > 0 ? '+' : ''}${esc(String(x.change_pct))} %`}</td>${after ? `<td class="n">${x.lowest_after_cyber_monday ? `${p(x.lowest_after_cyber_monday.price, x.currency)}<br><small>${esc(x.lowest_after_cyber_monday.on)}</small>` : '–'}</td>` : ''}</tr>`;
  const data = { '@context': 'https://schema.org', '@type': 'Dataset', name: 'Black Friday or Cyber Monday, measured · Mare Liberum', description: `${H}. ${lead}`, url: `${b0}${BFCM.path}`, temporalCoverage: `${BFCM.bf}/${BFCM.cm}`, license: 'https://creativecommons.org/licenses/by/4.0/', creator: { '@type': 'Organization', name: 'Mare Liberum', url: b0 || 'https://mareliberum.dev' }, distribution: { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: `${b0}${BFCM.path}.json` } };
  return `${head(`${H} | Mare Liberum`, lead, `${b0}${BFCM.path}`, `${robots}<link rel="alternate" type="application/json" href="${esc(`${b0}${BFCM.path}.json`)}">${ld(data)}`)}
<body><main><h1>${esc(H)}</h1>
<p class="lead">${esc(lead)}</p>
${b.lines.length ? `<table><thead><tr><th>Product</th><th>Black Friday</th>${sat ? '<th>Sat</th>' : ''}${sun ? '<th>Sun</th>' : ''}<th>Cyber Monday</th><th>Change</th>${after ? `<th>Lowest since</th>` : ''}</tr></thead><tbody>${b.lines.map(row).join('')}</tbody></table>` : ''}
<p><small>${esc(HOW)}</small></p>
<h2>Check a price before your person buys</h2><p>The same check, for any product page, free and without an account:</p>
<pre>GET ${esc(b0)}/deal?url=&lt;product page&gt;</pre>
<p><small>The records themselves: <a href="${SEEN.path}">the newest</a> · <a href="${SEEN.path}/quote">the quote of the records</a> · this balance as data: <a href="${BFCM.path}.json">JSON</a> (CC BY 4.0). Mare Liberum vouches for no store, never pays and never holds money.</small></p>
${NAV()}</main></body></html>`;
}
