// Mare Liberum · adding a page to the weekend balance (since 3.91, "Anmelden bis Cyber Monday"). An assistant whose person waits
// for Cyber Monday can add the product page it watches: GET /seen/bfcm-2026?add=<product page>. The page is measured at once on
// the store's own page (a deal check of that agent, with its open record) and again every day until Cyber Monday, so on Tuesday
// the weekend balance (node/bfcm.mjs) shows whether waiting paid off for that very page.
//   pages    only a store's own product page over https (…/products/<handle>, as the record book visits it), never a cart, a
//            checkout or an Amazon page; a page that gives no price on its own page is not added
//   limits   at most BFCM_ADD.perNet pages a day per network (the network only as an HMAC of the node's key, like the contact
//            book), at most BFCM_ADD.max pages in all; crawlers read the balance, they add nothing
//   days     open to the end of Cyber Monday (UTC); after that an add is answered "closed"
//   honest   a page added without a price measured on Black Friday is shown apart ("Measured over the weekend") and never
//            counted as cheaper, dearer or unchanged
//   counted  the adds of a day by the name the caller gives itself (the census names), never an address: /seen.json bfcm.adds
// This module is a leaf: it imports nothing, so node/pages.mjs may name the call without a circle through the deal check.

export const BFCM_ADD = Object.freeze({ path: '/seen/bfcm-2026', param: 'add', until: '2026-11-30', perNet: 3, max: 200, names: 24 });

// whether a page may be added on `day` (UTC, YYYY-MM-DD): to the end of Cyber Monday
export const bfcmAddOpen = (day) => /^\d{4}-\d{2}-\d{2}$/.test(String(day || '')) && day <= BFCM_ADD.until;

// the call, and the sentence an assistant can act on (the same words on /for/bots, in the skill and in llms.txt)
export const bfcmAddCall = (base) => `GET ${String(base || '').replace(/\/+$/, '')}${BFCM_ADD.path}?${BFCM_ADD.param}=<product page>`;
export const bfcmAddSentence = (base) => `Your person is waiting for Cyber Monday? Add the product page: ${bfcmAddCall(base)}. It is measured on the store's own page every day until 30 Nov 2026; on Tuesday the balance shows whether waiting paid off. Free, no account, at most ${BFCM_ADD.perNet} pages a day.`;

// the answer to an add that worked: what happens now, the price of today and its record
export function bfcmAddedLine(x) {
  const today = x?.today && Number.isFinite(x.today.price) ? ` Today: ${x.today.price} ${x.today.currency}` : '';
  const rec = x?.record ? `, record ${x.record}` : '';
  if (x?.already === 'black-friday') return 'Already measured: this page has a Black Friday price and is measured on the store\'s own page every day until Cyber Monday (30 Nov 2026).';
  if (x?.already === 'added') return 'Already added: this page is measured on the store\'s own page every day until Cyber Monday (30 Nov 2026).';
  return `Added: this page is measured on the store's own page each day until Cyber Monday (30 Nov 2026); the balance on Tuesday will show it.${today}${today ? rec : ''}.`;
}
