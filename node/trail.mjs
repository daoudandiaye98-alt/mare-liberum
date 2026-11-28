// Mare Liberum · the way on from a price history (since 3.90, "Der Weg nach vorn"): the pages ChatGPT search reads most
// lead somewhere. The pilot counted OpenAI's search crawler on /history/<need> (306 pages in one hour) and on /atlas/*
// (144), the index ChatGPT search quotes from; those answers held a bare list of prices or sites and no way on: no link to
// the offers of that need, to the free price check, to the weekend balance or to the free key.
//   history  GET /history/<need> (and .json) carries next, before the readings: buy (/buy/<need>, where the sea knows the
//            need), check_price (GET /deal?url=<product page>, free), bfcm (/seen/bfcm-2026) and free_start (GET
//            /session?as=key); GET /history carries the same next once, with the index of needs (/buy) in place of one need
//   page     a reader that asks for HTML gets a page: the need and the lowest offer seen in the title, the heading and the
//            first sentence (AI answers quote a page by its title and about 200 characters after its heading), the next
//            steps as one paragraph right after it, then the readings, newest first; noindex below 3 readings
//   atlas    /atlas/countries and /atlas/country/<cc> (JSON and page) carry next: how an agent reads one of those sites
//            (/site/<domain>), the free price check and the free key
// Everything here is pure: node/core.mjs passes the base address, the readings (node/eco.mjs hist:<slug>) and the probe
// terms of a key. Nothing here pays, nothing points at /mcp/app or at a paid door, and the price check stays free. The
// readings are the sea's own: each time the current asked the stores' catalogs for a need, the price of its pick, the store
// and the lowest offer found; never an estimate.
import { pageKit } from './seen.mjs';
import { BFCM } from './bfcm.mjs';
import { freeStart, dealStep } from './firststep.mjs';

export const HISTORY = Object.freeze({ path: '/history', show: 60, index: 3 });

const { esc, ld, money, head } = pageKit;
const trim = (b) => String(b || '').replace(/\/+$/, '');
const list = (x) => (Array.isArray(x) ? x : []);
const day = (iso) => String(iso || '').slice(0, 10);
const when = (iso) => `${day(iso)} ${String(iso || '').slice(11, 16)} UTC`;
const ok = (x) => x && Number.isFinite(x.price) && x.price > 0 && typeof x.currency === 'string' && x.currency && x.t;
// the lowest offer of one reading: the lowest found, or the pick when the reading holds no lowest
const low = (x) => (Number.isFinite(x.min) && x.min > 0 ? x.min : x.price);

// the weekend balance, in the words an assistant passes on
const bfcmStep = (b) => ({ page: `${b}${BFCM.path}`, what: 'Did waiting from Black Friday to Cyber Monday pay off? The same product pages, measured on the store\'s own page each day.' });

// the next steps from one need's price history; `need` is set only for a need the sea knows (its /buy page exists)
export function historyNext(base, slug, { need, probe, probeDays, dealExample } = {}) {
  const b = trim(base);
  return {
    ...(need ? { buy: { page: `${b}/buy/${slug}`, what: `Today's offers for ${need}, ordered by price, each with the store's own checkout link.` } } : {}),
    check_price: dealStep(b, dealExample),
    bfcm: bfcmStep(b),
    free_start: freeStart(b, { probe, probeDays }),
  };
}

// the next steps from the list of price histories: the index of needs in place of one need
export function historiesNext(base, { probe, probeDays, dealExample } = {}) {
  const b = trim(base);
  return {
    buy: { page: `${b}/buy`, what: 'Every need the sea watches, each with today\'s offers ordered by price.' },
    check_price: dealStep(b, dealExample),
    bfcm: bfcmStep(b),
    free_start: freeStart(b, { probe, probeDays }),
  };
}

// the next steps from the Atlas: how an agent reads one of the sites listed there, the free price check and the free key
export function atlasNext(base, { probe, probeDays } = {}) {
  const b = trim(base);
  return {
    site: { call: `GET ${b}/site/<domain>`, what: 'How an agent reads one of these sites: its search link, sections, feeds and what its robots.txt allows. Free.' },
    check_price: dealStep(b),
    free_start: freeStart(b, { probe, probeDays }),
  };
}

// what the readings say: how many, since when, the latest and the lowest offer seen (only readings in the latest currency)
export function historyOf(rows) {
  const pts = list(rows).filter(ok).sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0));
  if (!pts.length) return { readings: 0, since: null, latest: null, lowest: null, black_friday: null };
  const last = pts[pts.length - 1], same = pts.filter((x) => x.currency === last.currency);
  const lo = same.reduce((m, x) => (low(x) < low(m) ? x : m), same[0]);
  const bf = same.filter((x) => day(x.t) === BFCM.bf).reduce((m, x) => (!m || low(x) < low(m) ? x : m), null);
  return {
    readings: pts.length, since: pts[0].t, currency: last.currency,
    latest: { at: last.t, price: last.price, store: last.store || null, lowest_offer: low(last) },
    lowest: { at: lo.t, price: low(lo) },
    black_friday: bf ? { at: bf.t, price: low(bf) } : null,
  };
}

// the heading: the need and the lowest offer seen, e.g. "Running shoes price history: lowest offer 48 USD (21 Nov 2026)"
export function historyHeadline(need, h) {
  const n = need.charAt(0).toUpperCase() + need.slice(1);
  return h.readings ? `${n} price history: lowest offer ${money(h.lowest.price, h.currency)} (${day(h.lowest.at)})` : `${n} price history: no readings yet`;
}

// the first sentence: how many readings since when, the latest pick and lowest offer, and Black Friday when it was read
export function historyLead(need, h) {
  if (!h.readings) return `The sea has no price reading for ${need} yet; the current asks the stores' catalogs for the needs it watches in turn.`;
  const l = h.latest, bf = h.black_friday ? ` On Black Friday (${BFCM.bf}) the lowest offer was ${money(h.black_friday.price, h.currency)}.` : '';
  return `${h.readings} readings of ${need} since ${day(h.since)}: the latest, ${when(l.at)}, picked ${money(l.price, h.currency)}${l.store ? ` at ${l.store}` : ''} with the lowest offer at ${money(l.lowest_offer, h.currency)}; the lowest offer seen was ${money(h.lowest.price, h.currency)} on ${day(h.lowest.at)}.${bf}`;
}

// the next steps as one paragraph, right after the first sentence of a page
const lead = (s) => esc(s).replace(/\.$/, ':');
export function nextHtml(nx) {
  if (!nx?.check_price || !nx?.free_start) return '';
  const buy = nx.buy ? `${lead(nx.buy.what)} <a href="${esc(nx.buy.page)}">${esc(nx.buy.page)}</a>. ` : '';
  const site = nx.site ? `${lead(nx.site.what)} <code>${esc(nx.site.call)}</code>. ` : '';
  const bfcm = nx.bfcm ? ` ${lead(nx.bfcm.what)} <a href="${esc(nx.bfcm.page)}">${esc(nx.bfcm.page)}</a>.` : '';
  return `<p id="next-step">${buy}${site}${lead(nx.check_price.what)} <code>${esc(nx.check_price.call)}</code> (${esc(nx.check_price.cost)}).${bfcm} Start free: <code>${esc(nx.free_start.call)}</code> gives ${esc(nx.free_start.gives)}.</p>`;
}

const NAV = '<nav><p><small><a href="/">Mare Liberum</a> · <a href="/history">price histories</a> · <a href="/buy">buy by need</a> · <a href="/seen">price records</a></small></p></nav>';
const HOW = 'Each reading is the sea\'s own: the current asks the stores\' catalog data for this need, keeps its pick (the price and the store) and the lowest offer found, and dates it. Picks can be different products of the same need; for one product page, check the page itself. Mare Liberum vouches for no store, never pays and never holds money; offers are ordered by price, nobody pays for a place.';

// one need's price history as a page a person and an AI answer can quote
export function historyHtml(base, slug, need, rows, nx) {
  const b = trim(base), h = historyOf(rows), H = historyHeadline(need, h), lead = historyLead(need, h);
  const robots = h.readings >= HISTORY.index ? '' : '<meta name="robots" content="noindex,follow">';
  const pts = list(rows).filter(ok).sort((x, y) => (x.t < y.t ? 1 : x.t > y.t ? -1 : 0)).slice(0, HISTORY.show);
  const data = { '@context': 'https://schema.org', '@type': 'Dataset', name: `${H} · Mare Liberum`, description: lead, url: `${b}${HISTORY.path}/${slug}`, ...(h.readings ? { temporalCoverage: `${day(h.since)}/${day(h.latest.at)}` } : {}), license: 'https://creativecommons.org/licenses/by/4.0/', creator: { '@type': 'Organization', name: 'Mare Liberum', url: b || 'https://mareliberum.dev' }, distribution: { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: `${b}${HISTORY.path}/${slug}.json` } };
  const row = (x) => `<tr><td>${esc(when(x.t))}</td><td class="n">${esc(money(x.price, x.currency))}</td><td>${esc(x.store || '')}</td><td class="n">${esc(money(low(x), x.currency))}</td></tr>`;
  return `${head(`${H} | Mare Liberum`, lead, `${b}${HISTORY.path}/${slug}`, `${robots}<link rel="alternate" type="application/json" href="${esc(`${b}${HISTORY.path}/${slug}.json`)}">${ld(data)}`)}
<body><main><h1>${esc(H)}</h1>
<p class="lead">${esc(lead)}</p>
${nextHtml(nx)}
${pts.length ? `<table><thead><tr><th>Read</th><th>Pick</th><th>Store</th><th>Lowest offer</th></tr></thead><tbody>${pts.map(row).join('')}</tbody></table>` : ''}
<p><small>${esc(HOW)} The readings as data: <a href="${esc(`${HISTORY.path}/${slug}.json`)}">JSON</a> (CC BY 4.0).</small></p>
${NAV}</main></body></html>`;
}

// the list of price histories as a page: the next steps first, then every need with its history and its offers
export function historiesHtml(base, needs, nx, slugOf) {
  const b = trim(base), H = `Price histories of ${needs.length} needs, read from the stores' own catalogs`;
  const lead = `For each need the sea watches, the price of its pick and the lowest offer found, each time the current asked the stores' catalogs; open data (CC BY 4.0).`;
  return `${head(`${H} | Mare Liberum`, lead, `${b}${HISTORY.path}`, `<link rel="alternate" type="application/json" href="${esc(`${b}${HISTORY.path}.json`)}">`)}
<body><main><h1>${esc(H)}</h1>
<p class="lead">${esc(lead)}</p>
${nextHtml(nx)}
<ul class="v">${needs.map((n) => `<li><a href="${esc(`${HISTORY.path}/${slugOf(n)}`)}">${esc(n)}</a> · <small><a href="${esc(`/buy/${slugOf(n)}`)}">offers today</a></small></li>`).join('')}</ul>
<p><small>${esc(HOW)}</small></p>
${NAV}</main></body></html>`;
}
