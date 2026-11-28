// Mare Liberum · the way on from a price record (since 3.92, "Der Beleg führt weiter"): the record pages OpenAI's crawler
// started to read lead somewhere. The pilot counted GPTBot on /seen/<id> (174 pages in one hour, none the hour before), and a
// record page held its verdict, its offers and one bare "check it again" further down, but no link to the offers of that kind
// of product, to its price history, to the weekend balance or to the free key.
//   page     GET /seen/<id> (HTML) carries one paragraph right after the box with the price: check this very page again
//            (GET /deal?url=<this page>, free; when no other store was found, it says so and that a new check compares
//            again), today's offers of the need the product belongs to (/buy/<need>) and that need's price history
//            (/history/<need>), the weekend balance (/seen/bfcm-2026), while adding is open the call that adds this very page
//            to it, and the free key (GET /session?as=key)
//   list     GET /seen.json carries the same next once, with the index of needs (/buy) and of histories (/history) in place
//            of one need
//   record   /seen/<id>.json stays the record as it was kept: its SHA-256 is that of its canonical JSON, so nothing is added
//            to it; it carries check_again as before
//   need     the need of a record only when every word of one need the sea watches stands in the product's name (a plural
//            "s" aside), the longest such need; a name that matches none gets no buy and no history, never a guess
// Everything here is pure: node/core.mjs passes the base address, the record, the day and the probe terms of a key. Nothing
// here pays, nothing points at /mcp/app or at a paid door, and the price check stays free.
import { NEEDS, slugOf } from './needs.mjs';
import { freeStart, dealStep } from './firststep.mjs';
import { BFCM_AT } from './trail.mjs';
import { BFCM_ADD, bfcmAddOpen } from './bfcmadd.mjs';

const trim = (b) => String(b || '').replace(/\/+$/, '');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// the words of a name, lower case, a plural "s" taken off a word of four letters or more (shoes → shoe, boots → boot)
const words = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9'äöüß-]+/g, ' ').split(' ').filter(Boolean).map((w) => (w.length >= 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w));
// needs that name a person or an occasion, not a product: never matched from a product's name
const NOT_A_PRODUCT = /^(gift|gifts|personalized|custom|birthday|anniversary|housewarming|christmas)\b/;
const NEED_WORDS = NEEDS.filter((n) => !NOT_A_PRODUCT.test(n)).map((n) => ({ need: n, w: words(n) })).filter((x) => x.w.length);

// the need a product belongs to: the longest need the sea watches whose every word stands in the name, or null
export function needOfName(name) {
  const have = new Set(words(name)); if (!have.size) return null;
  let best = null;
  for (const x of NEED_WORDS) if (x.w.every((w) => have.has(w)) && (!best || x.w.length > best.w.length || (x.w.length === best.w.length && x.need.length > best.need.length))) best = x;
  return best ? best.need : null;
}

// the product page of a record a weekend-balance add takes: a store's own product page over https
const addable = (u) => /^https:\/\/[^/?#]+\/(?:[^?#]*\/)?products\/[^/?#]+/.test(String(u || ''));

// the next steps from one record; `day` is today (UTC, YYYY-MM-DD)
export function recordNext(base, rec, { day, probe, probeDays } = {}) {
  const b = trim(base), page = rec?.product?.url || null, need = needOfName(rec?.product?.name), slug = need ? slugOf(need) : null;
  const none = rec?.verdict?.word === 'no-comparison' || !(Number(rec?.elsewhere_found) > 0);
  const check = page
    ? { call: `GET ${b}/deal?url=${encodeURIComponent(page)}`, what: none ? 'No other store with the same item was found at that minute; a new check of this page compares again.' : 'Prices move: check this page again before your person pays, with the same item at other stores and a new open record.', cost: 'free, no key, no account', ...(none ? { compared: 0 } : {}) }
    : dealStep(b);
  return {
    check_price: check,
    ...(need ? {
      buy: { page: `${b}/buy/${slug}`, what: `Today's offers for ${need}, ordered by price, each with the store's own checkout link.`, need, matched_by: 'the product\'s name' },
      history: { page: `${b}/history/${slug}`, what: `The price history of ${need}, read from the stores' own catalogs.` },
    } : {}),
    bfcm: { page: `${b}${BFCM_AT.path}`, what: 'Did waiting from Black Friday to Cyber Monday pay off? The same product pages, measured on the store\'s own page each day.' },
    ...(page && addable(page) && bfcmAddOpen(day) ? { bfcm_add: { call: `GET ${b}${BFCM_ADD.path}?${BFCM_ADD.param}=${encodeURIComponent(page)}`, what: `Your person is waiting for Cyber Monday? Add this page: it is measured on the store's own page every day until ${BFCM_ADD.until}.`, cost: 'free, no account' } } : {}),
    free_start: freeStart(b, { probe, probeDays }),
  };
}

// the next steps from the list of records: the index of needs and of histories in place of one need
export function recordsNext(base, { day, probe, probeDays, dealExample } = {}) {
  const b = trim(base);
  return {
    check_price: dealStep(b, dealExample),
    buy: { page: `${b}/buy`, what: 'Every need the sea watches, each with today\'s offers ordered by price.' },
    history: { page: `${b}/history`, what: 'The price history of every need the sea watches.' },
    bfcm: { page: `${b}${BFCM_AT.path}`, what: 'Did waiting from Black Friday to Cyber Monday pay off? The same product pages, measured on the store\'s own page each day.' },
    ...(bfcmAddOpen(day) ? { bfcm_add: { call: `GET ${b}${BFCM_ADD.path}?${BFCM_ADD.param}=<product page>`, what: `Your person is waiting for Cyber Monday? Add the product page: it is measured on the store's own page every day until ${BFCM_ADD.until}.`, cost: 'free, no account' } } : {}),
    free_start: freeStart(b, { probe, probeDays }),
  };
}

// the next steps of a record as one paragraph, right after the box with the price
const lead = (s) => esc(s).replace(/\.$/, ':');
export function recordNextHtml(nx) {
  if (!nx?.check_price || !nx?.free_start) return '';
  const buy = nx.buy ? ` ${lead(nx.buy.what)} <a href="${esc(nx.buy.page)}">${esc(nx.buy.page)}</a>.` : '';
  const hist = nx.history ? ` ${lead(nx.history.what)} <a href="${esc(nx.history.page)}">${esc(nx.history.page)}</a>.` : '';
  const bfcm = nx.bfcm ? ` ${lead(nx.bfcm.what)} <a href="${esc(nx.bfcm.page)}">${esc(nx.bfcm.page)}</a>.` : '';
  const add = nx.bfcm_add ? ` ${lead(nx.bfcm_add.what)} <code>${esc(nx.bfcm_add.call)}</code> (${esc(nx.bfcm_add.cost)}).` : '';
  return `<p id="next-step">${lead(nx.check_price.what)} <code>${esc(nx.check_price.call)}</code> (${esc(nx.check_price.cost)}).${buy}${hist}${bfcm}${add} Start free: <code>${esc(nx.free_start.call)}</code> gives ${esc(nx.free_start.gives)}.</p>`;
}
