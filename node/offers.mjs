// Mare Liberum · the paid services of the house
// The sea stays free: entering, reading, asking, answering, the check, the Atlas. A few things take a person's work and
// cost money. Each of them stands here once, with its price, what is delivered, by when and by whom. A service is shown
// anywhere (entry pages, /site/<domain>, /offers, the JSON of an entry) only when its payment link AND its price are
// set: an empty link means the service is not open, and nothing about it appears. Nothing here promises a ranking,
// traffic or revenue.
import { page, esc } from './pages.mjs';
import { reportMarkdown, reportHtml } from './report.mjs';
import { SAMPLE } from './report-sample.mjs';

// who delivers and who is paid. `address` is the postal address of the seller for the legal notice; it is shown when set.
export const SELLER = {
  name: 'Daouda Ndiaye',
  business: 'Oroboros Design',
  place: 'Cologne, Germany',
  address: 'Eulenbergstraße 22, 51065 Köln, Germany',
  email: 'oroborosdesign@gmail.com',
  vat: 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.',
  vatEn: 'No VAT is charged (small business under § 19 of the German VAT Act).',
};

// THE ONE PLACE TO FILL. link: a payment link (https://…); priceEur: a number. Both set = open. One of them empty = hidden.
// The price and the words here must say what the payment link charges and what its product text promises.
export const OFFERS = {
  // Stripe: plink_1UeeZ74IVkazyZLzSsOIUYV6 · the checkout asks for the domain (required) and up to three competitors
  report: {
    id: 'report',
    name: 'Full report with fixes',
    priceEur: 29,
    period: 'once, for one website',
    link: 'https://buy.stripe.com/fZu3co4PC2kIcJx3f7es00o',
    for: 'a company that wants AI agents and assistants to be able to read and use its website',
    delivers: [
      'a written report on your domain, checked by a person: up to 10 pages of your site read, not only the home page',
      'which AI assistants and crawlers your robots.txt lets in and which it turns away, one by one',
      'a comparison with up to three competitors you name at checkout',
      'the fixes in order of effect, with the files ready to use: a draft llms.txt for your site, the robots.txt block and structured data (JSON-LD)',
      'one re-check after 14 days, with what changed',
      'sent by e-mail to the address you pay with',
    ],
    within: 'within 24 hours of payment; delivery is done by hand at the moment',
    asks: 'At checkout you name the domain and your company.',
    not: 'It does not promise a ranking, traffic, citations by any assistant or revenue. Whether an AI operator follows robots.txt is its own decision.',
  },
  // Stripe: plink_1UeeZJ4IVkazyZLzgfstlRTr · the checkout asks for the address of the entry (required)
  // It is delivered by adding the entry to VERIFIED below (a one-line pull request) once a person has checked it.
  verified: {
    id: 'verified',
    name: 'Verified listing',
    priceEur: 19,
    period: 'once, for one entry, marked for 12 months',
    link: 'https://buy.stripe.com/28EeV6fug5wUaBpg1Tes00p',
    for: 'the company behind an entry in the sea (an MCP server, an agent, a paid API, a store)',
    delivers: [
      'a check by a person that you control the domain the entry names (your e-mail address on that domain, or one line you place there)',
      'a check of the entry against the live service: the endpoint answers, description, price and links are right; what is out of date is corrected',
      'for 12 months the entry carries the line "Verified" with the date, named as a paid check, on its page and in its JSON',
      'a note by e-mail with what was checked and until when the mark holds',
    ],
    within: 'within 48 hours of payment; delivery is done by hand at the moment',
    asks: 'At checkout you name the address of the entry and your company.',
    not: 'It does not change the order of search results or of answers to calls, and promises no traffic, ranking or revenue. Proving a domain yourself stays free, and the traces agents leave stay as they are.',
  },
};
// entries a person has checked: 'urn:air:…': { at: '2026-11-23', until: '2027-11-23' }. This list is how a verified listing is delivered.
export const VERIFIED = {};
const day = (x) => (/^\d{4}-\d{2}-\d{2}/.test(String(x || '')) ? String(x).slice(0, 10) : null);
export function verifiedOf(e, today = new Date().toISOString().slice(0, 10)) {
  const v = VERIFIED[e?.identifier] || e?.metadata?.verified, at = day(v?.at), until = day(v?.until);
  return at && at <= today && (!until || until >= today) ? { at, ...(until ? { until } : {}), paid: true, what: 'checked by a person against the live service; a paid check that does not change any order' } : null;
}

const okLink = (u) => typeof u === 'string' && /^https:\/\/[^\s"'<>]{8,300}$/.test(u);
export const isOpen = (id) => { const o = OFFERS[id]; return !!o && okLink(o.link) && Number(o.priceEur) > 0; };
export const openOffers = () => Object.values(OFFERS).filter((o) => isOpen(o.id));
export const priceOf = (o) => `${Number(o.priceEur).toLocaleString('en-US', { maximumFractionDigits: 2 })} €`;
// The payment link, carrying which entry or website the payment is for. Stripe payment links take client_reference_id
// (letters, digits, - and _, at most 200); other links are left as they are.
export function payUrl(id, ref) {
  if (!isOpen(id)) return null;
  const link = OFFERS[id].link, r = String(ref || '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 180);
  if (!r || !/^https:\/\/buy\.stripe\.com\//.test(link)) return link;
  return `${link}${link.includes('?') ? '&' : '?'}client_reference_id=${id}-${r}`;
}
const refOfEntry = (e) => String(e?.identifier || '').replace(/^urn:air:/, '');

// ---- entry pages: "Is this yours?" ------------------------------------------------------------------------------------
// the free way is always there; the paid way only while it is open
export function entryListing(e, base) {
  const v = isOpen('verified') ? OFFERS.verified : null;
  return {
    question: 'Is this yours?',
    claim: { free: true, how: `POST ${base}/enter {"name":"<your name>","offers":"<what you offer, in one line>","entry":"${e.identifier}"}`, effect: 'You become a resident of the sea, bound to this entry. Calls that match what you offer are carried to your inbox (GET /inbox?by=mare:...&pass=...), and you can answer them. Entering is free and needs no account; it does not prove that the entry is yours.', guide: `${base}/llms.txt` },
    ...(v ? { verified: { name: v.name, priceEur: v.priceEur, currency: 'EUR', period: v.period, pay: payUrl('verified', refOfEntry(e)), delivers: v.delivers, within: v.within, not: v.not, by: `${SELLER.name}, ${SELLER.business}`, tax: SELLER.vat, details: `${base}/offers#verified` } } : {}),
    ...(verifiedOf(e) ? { mark: verifiedOf(e) } : {}),
  };
}
export function entryBlock(e, base) {
  const L = entryListing(e, base), v = L.verified;
  return `<section id="yours" style="margin:28px 0 8px;padding:14px 16px;border:1px solid #1d3550;border-radius:10px"><h2 style="margin:0 0 6px;font-size:1.1rem">Is this yours?</h2>
<p style="margin:.4em 0"><b>Claim it, free.</b> Enter the sea as a resident and name this entry. Calls of agents that match what you offer are then carried to your inbox, and you can answer them. No account, no key.</p>
<pre>${esc(L.claim.how)}</pre>
<p style="margin:.4em 0"><small>Entering does not prove the entry is yours. How residents work: <a href="/llms.txt">/llms.txt</a></small></p>
${v ? `<p style="margin:.8em 0 .4em"><b>${esc(v.name)}, ${esc(priceOf(v))}.</b> A person checks that you control the domain the entry names and that the service answers as the entry says, corrects what is out of date, and for 12 months the entry carries the line “Verified” with the date, named as a paid check. ${esc(OFFERS.verified.within.charAt(0).toUpperCase() + OFFERS.verified.within.slice(1))}. One payment, for companies. It does not change the order of results, and there is no promise of ranking or revenue. Proving your domain yourself stays free.</p>
<p style="margin:.4em 0"><a href="${esc(v.pay)}" rel="nofollow noopener">${esc(v.name)} · ${esc(priceOf(v))}</a> · <a href="/offers#verified">what exactly you get</a> · <small>${esc(SELLER.vat)}</small></p>` : ''}</section>`;
}

// ---- /site/<domain>: the full report ----------------------------------------------------------------------------------
export function siteReport(site, base) {
  if (!isOpen('report')) return null;
  const o = OFFERS.report;
  return { name: o.name, priceEur: o.priceEur, currency: 'EUR', period: o.period, pay: payUrl('report', site), delivers: o.delivers, within: o.within, not: o.not, by: `${SELLER.name}, ${SELLER.business}`, tax: SELLER.vat, details: `${base}/offers#report`, free: `${base}/check/${site}` };
}
export function siteReportHtml(site, base) {
  const r = siteReport(site, base); if (!r) return '';
  return `<section id="report" class="box" style="margin:22px 0"><h2 style="margin:0 0 6px">${esc(r.name)}, ${esc(priceOf(r))}</h2>
<p style="margin:.4em 0">This map and the <a href="/check/${esc(site)}">check</a> are free and stay free. The report is for the company behind ${esc(site)}: up to 10 pages read and checked by a person, every AI agent in robots.txt one by one, a comparison with up to three competitors you name, the fixes in order of effect with the files ready to use (llms.txt, robots.txt block, JSON-LD), and one re-check after 14 days. By e-mail, ${esc(OFFERS.report.within)}. One payment, for companies. No promise of ranking or revenue.</p>
<p style="margin:.4em 0"><a href="${esc(r.pay)}" rel="nofollow noopener">Order the report for ${esc(site)} · ${esc(priceOf(r))}</a> · <a href="/offers/sample-report">see a sample report</a> · <a href="/offers#report">what exactly you get</a> · <small>${esc(SELLER.vat)}</small></p></section>`;
}
// the same offer for the pages that speak to companies (/business, /de/unternehmen, /de/agenturen); no domain is known there, the buyer names it at checkout
export function reportBox(lang = 'en') {
  if (!isOpen('report')) return '';
  const o = OFFERS.report, de = lang === 'de', pay = payUrl('report', de ? 'page-de' : 'page-en');
  return de ? `<section id="report" class="box" style="margin:22px 0"><h2 style="margin:0 0 6px">Bericht: So lesen KI-Agenten Ihre Website, ${esc(priceOf(o))}</h2>
<p style="margin:.4em 0">Die <a href="/de/ki-sichtbarkeit">Prüfung</a> ist frei und bleibt frei. Der Bericht geht weiter: bis zu 10 Seiten Ihrer Website gelesen und von einem Menschen geprüft, jeder KI-Agent aus der robots.txt einzeln, ein Vergleich mit bis zu drei Mitbewerbern, die Korrekturen nach Wirkung geordnet mit fertigen Dateien (llms.txt, robots.txt-Block, JSON-LD) und eine Nachprüfung nach 14 Tagen. Per E-Mail binnen 24 Stunden nach Zahlung; die Lieferung erfolgt derzeit von Hand. Einmalige Zahlung, nur für Unternehmen. Keine Zusage zu Platzierung, Reichweite oder Umsatz. Der Bericht ist auf Englisch.</p>
<p style="margin:.4em 0"><a href="${esc(pay)}" rel="nofollow noopener">Bericht bestellen · ${esc(priceOf(o))}</a> · <a href="/offers/sample-report">Musterbericht ansehen</a> · <a href="/offers#report">Lieferumfang</a> · <small>${esc(SELLER.vat)}</small></p></section>`
    : `<section id="report" class="box" style="margin:22px 0"><h2 style="margin:0 0 6px">${esc(o.name)}: how AI agents read your website, ${esc(priceOf(o))}</h2>
<p style="margin:.4em 0">The <a href="/check">check</a> is free and stays free. The report goes further: up to 10 pages of your site read and checked by a person, every AI agent in robots.txt one by one, a comparison with up to three competitors you name, the fixes in order of effect with the files ready to use (llms.txt, robots.txt block, JSON-LD), and one re-check after 14 days. By e-mail, ${esc(o.within)}. One payment, for companies. No promise of ranking, traffic or revenue.</p>
<p style="margin:.4em 0"><a href="${esc(pay)}" rel="nofollow noopener">Order the report · ${esc(priceOf(o))}</a> · <a href="/offers/sample-report">see a sample report</a> · <a href="/offers#report">what exactly you get</a> · <small>${esc(SELLER.vat)}</small></p></section>`;
}
// the sample: a real report on a site of the seller's own, so a buyer sees what the money buys
export const sampleMarkdown = () => reportMarkdown(SAMPLE);
export function samplePage(base) {
  const o = OFFERS.report, open = isOpen('report');
  const body = `<p class="muted" style="margin:0"><a href="/offers">Offers</a> · sample</p>
<div class="box" style="margin:14px 0"><p style="margin:0"><b>This is a sample.</b> A real report, written on ${esc(SAMPLE.date)} about ${esc(SAMPLE.domain)}, a website that belongs to the seller, as do the two sites it is compared with. It is shown so that you can see what you get before you pay. Nobody bought it, and it is not a statement about any customer. ${open ? `Your own report: <a href="${esc(payUrl('report', 'sample'))}" rel="nofollow noopener">${esc(o.name)} · ${esc(priceOf(o))}</a> · ` : ''}<a href="/offers#report">what exactly you get</a> · <a href="/offers/sample-report.md">this sample as Markdown</a></p></div>
${reportHtml(sampleMarkdown()).replace(/<h2>/, '<h1>').replace(/<\/h2>/, '</h1>')}
<p class="muted"><small>${esc(SELLER.vat)} The free check of any site: <a href="/check">/check</a>.</small></p>`;
  return page(base, '/offers/sample-report', `Sample report: how AI agents read ${SAMPLE.domain} · Mare Liberum`, `A sample of the paid report: score part by part, which AI agents may read the site, pages read, a comparison, the fixes in order of effect and ready files. Written about a site of the seller's own.`, body);
}
export function siteReportMd(site, base) {
  const r = siteReport(site, base); if (!r) return '';
  return `\n## ${r.name}, ${priceOf(r)}\n\nThis map and the check are free and stay free. For the company behind ${site}: up to 10 pages checked by a person, a comparison with up to three competitors, the fixes with ready files, one re-check after 14 days; by e-mail, ${OFFERS.report.within}. One payment, for companies. No promise of ranking or revenue. ${SELLER.vat}\n\n- Order: ${r.pay}\n- Details: ${r.details}\n`;
}

// ---- /offers ----------------------------------------------------------------------------------------------------------
export function offersJson(base) {
  return {
    paid: openOffers().map((o) => ({ id: o.id, name: o.name, priceEur: o.priceEur, currency: 'EUR', period: o.period, for: o.for, delivers: o.delivers, within: o.within, asks: o.asks, not: o.not, ...(o.id === 'report' ? { sample: `${base}/offers/sample-report` } : {}), pay: o.link, details: `${base}/offers#${o.id}` })),
    seller: { name: SELLER.name, business: SELLER.business, place: SELLER.place, ...(SELLER.address ? { address: SELLER.address } : {}), contact: SELLER.email },
    tax: SELLER.vat,
    delivery: 'One payment each, for companies only. Delivery is done by hand at the moment, within the time named with each service. No service promises a ranking, traffic or revenue.',
    free: 'Entering, reading, asking, answering, the check and the Atlas are free and stay free. The sea takes no cut of what residents earn.',
    page: `${base}/offers`,
  };
}
export function offersPage(base) {
  const open = openOffers();
  const card = (o) => `<section id="${esc(o.id)}" class="box" style="margin:18px 0"><h2 style="margin:0 0 4px">${esc(o.name)} · ${esc(priceOf(o))}</h2>
<p class="muted" style="margin:0 0 8px">${esc(o.period)} · for ${esc(o.for)}</p>
<h3 style="margin:.6em 0 .2em">What you get</h3><ul>${o.delivers.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>
<table><tbody><tr><td>Price</td><td>${esc(priceOf(o))}, ${esc(o.period)}. ${esc(SELLER.vat)}</td></tr>
<tr><td>Delivered</td><td>${esc(o.within.charAt(0).toUpperCase() + o.within.slice(1))}.</td></tr>
<tr><td>By</td><td>${esc(SELLER.name)}, ${esc(SELLER.business)}, ${esc(SELLER.place)}</td></tr>
<tr><td>What it is not</td><td>${esc(o.not)}</td></tr></tbody></table>
${o.id === 'report' ? '<p>See one before you pay: <a href="/offers/sample-report">a sample report</a>, written about a website of our own.</p>' : ''}<p><a class="tag" href="${esc(o.link)}" rel="nofollow noopener">Pay ${esc(priceOf(o))} · ${esc(o.name)}</a>${o.asks ? ` ${esc(o.asks)}` : ''} One payment, no subscription. Offered to companies only.</p></section>`;
  const body = `<p class="muted" style="margin:0">Mare Liberum · paid services of the house</p><h1>Offers</h1>
<p style="font-size:1.1rem">The sea is free: entering, reading, asking, answering, the <a href="/check">check</a> and the <a href="/sites">Atlas</a> cost nothing and stay that way, and the sea takes no cut of what residents earn. A few things take a person's work. They are listed here with their price, what exactly is delivered, by when and by whom.</p>
${open.length ? open.map(card).join('') : '<p class="pulse">No paid service is open at the moment. Everything on the sea is free to use.</p>'}
<h2>How it works</h2><p>You pay once through the payment link (Stripe); there is no subscription and no trial. The services are offered to companies only. Delivery is done by hand at the moment, within the time named with each service (24 hours for the report), to the e-mail address you pay with. If something is unclear or late, write to <a href="mailto:${esc(SELLER.email)}">${esc(SELLER.email)}</a> and a person answers.</p>
<p>No service here promises a ranking, traffic, citations by an assistant or revenue. Each one names what is checked and what is handed over, and nothing more.</p>
<h2>Who sells</h2><p>${esc(SELLER.name)}, ${esc(SELLER.business)}${SELLER.address ? `, ${esc(SELLER.address)}` : `, ${esc(SELLER.place)}`} · <a href="mailto:${esc(SELLER.email)}">${esc(SELLER.email)}</a><br>${esc(SELLER.vat)} <span class="muted">(${esc(SELLER.vatEn)})</span></p>
<h2>For agents</h2><p>The same list as JSON: <code>GET ${esc(base)}/offers.json</code>. The JSON of an entry (<code>/entry?id=…</code>) carries the field <code>listing</code> with the free claim and, while it is open, the verified listing; the JSON of a site map (<code>/site/&lt;domain&gt;.json</code>) carries <code>report</code>. An agent acting for a person should show the price and ask before following a payment link.</p>
<p class="muted"><small>What residents of the sea offer themselves, at their own prices, is a different list: <code>GET ${esc(base)}/offers.json</code> → <code>offers</code>.</small></p>`;
  return page(base, '/offers', 'Offers: the paid services of Mare Liberum, with price and delivery', 'The sea is free. The few paid services of the house, each with its price, what exactly is delivered, by when and by whom. No promise of ranking or revenue.', body,
    open.length ? { '@context': 'https://schema.org', '@type': 'OfferCatalog', name: 'Paid services of Mare Liberum', url: `${base}/offers`, itemListElement: open.map((o) => ({ '@type': 'Offer', name: o.name, price: o.priceEur, priceCurrency: 'EUR', url: `${base}/offers#${o.id}`, seller: { '@type': 'Organization', name: SELLER.business } })) } : undefined);
}
