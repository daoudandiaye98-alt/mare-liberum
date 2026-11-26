
// Mare Liberum · the operators' till (since 3.55): reader credit by card in the browser, for businesses
// The operator of a script that reads many pages through the reader pays here, not the agent: an offer in euro (business
// customers only, behind the order page /c/reader) through a Stripe payment link, EUR 10 for 10,000 pages of the reader above
// the free 100 a day, valid 30 days. After paying, Stripe sends the buyer to /reader/credit/paid?session={CHECKOUT_SESSION_ID}.
// - The node has the Edge Function mare-mpp read that Checkout Session (it alone holds the restricted Stripe key; the node sends
//   its writer secret, as for the card door) and gives credit only when the session is complete and paid, in payment mode,
//   through one of the till's payment links, for exactly that link's price. Nothing about the buyer comes back: no name, no
//   e-mail, no card.
// - The token is derived from the session (an HMAC under a key from the node's secret), so the buyer's own link shows the same
//   token again; the credit is minted once: a token whose credit exists is only shown, never filled up again.
// - The sea keeps what it keeps for every credit (the token's SHA-256, pages, left, until) and the id of the payment.
// - (since 3.60, the reader ladder) the same till sells bigger packs, each through its own payment link and order page
//   /c/<id> (node/attention.mjs CTA, node/seo.mjs OFFER): Kutter 100,000 pages, Fregatte 500,000, Flotte 1,000,000, each for
//   30 days or, as a year paid in advance, twelve times the pages for 365 days. A session gives exactly the pack of the link
//   it was paid through. The Reederei (an own reader node on a server in the EU) is sold beside it (nodePage): a service set up
//   by hand within 48 hours, no token.
import { createHmac } from 'node:crypto';
import { page, esc } from './pages.mjs';

export const CHECKOUT = Object.freeze({
  cents: 1000, currency: 'eur', pages: 10_000, days: 30,
  // Stripe: plink_1Ug4VQ4IVkazyZLzBNhuF2wm · the payment link itself stands in node/seo.mjs (OFFER.reader), reached only
  // through the order page /c/reader (node/attention.mjs CTA.reader)
  linkId: 'plink_1Ug4VQ4IVkazyZLzBNhuF2wm',
});
// the ladder (since 3.60): every pack the till sells, by the name of its order page /c/<id>; the payment links stand in
// node/seo.mjs OFFER next to these ids. A pack of a year holds twelve months of pages and runs 365 days
const pack = (id, name, cents, pages, days, linkId) => Object.freeze({ id, name, cents, currency: 'eur', pages, days, linkId });
export const TILL = Object.freeze([
  pack('reader', 'Starter', CHECKOUT.cents, CHECKOUT.pages, CHECKOUT.days, CHECKOUT.linkId),
  pack('kutter', 'Kutter', 4_900, 100_000, 30, 'plink_1Ug6ai4IVkazyZLzsS3UkFKX'),
  pack('kutterjahr', 'Kutter, one year', 49_000, 1_200_000, 365, 'plink_1Ug6aj4IVkazyZLz39fIvFiV'),
  pack('fregatte', 'Fregatte', 19_900, 500_000, 30, 'plink_1Ug6ak4IVkazyZLz8nNglOqX'),
  pack('fregattejahr', 'Fregatte, one year', 199_000, 6_000_000, 365, 'plink_1Ug6ak4IVkazyZLzOr0fuf7J'),
  pack('flotte', 'Flotte', 39_000, 1_000_000, 30, 'plink_1Ug6al4IVkazyZLzXK36l7ZK'),
  pack('flottejahr', 'Flotte, one year', 390_000, 12_000_000, 365, 'plink_1Ug6am4IVkazyZLzFdrqEbPB'),
]);
// (since 3.63) the agent packs by card in the browser, in USD: for agents with a one-time card or a wallet (Grok, ChatGPT Wallet,
// Gemini and others) and for the people they act for, consumers included (terms § 5a (8)); their order pages /c/agent10, agent49
// and agent99 lead straight to the payment link (no box of § 14 BGB: they are not offers in euro). The same packs as the card
// door's ?pack=10, 49 and 99 (node/mpp.mjs), here for whoever pays with a card in a checkout
const usdPack = (id, name, cents, pages, days, linkId) => Object.freeze({ id, name, cents, currency: 'usd', pages, days, linkId, everyone: true });
export const AGENT_TILL = Object.freeze([
  usdPack('agent10', 'Agent pack 10', 1_000, 10_000, 30, 'plink_1Ug9FH4IVkazyZLzN99vL87I'),
  usdPack('agent49', 'Agent pack 49', 4_900, 100_000, 30, 'plink_1Ug9FI4IVkazyZLzO4TDxrN7'),
  usdPack('agent99', 'Agent pack 99', 9_900, 250_000, 30, 'plink_1Ug9FJ4IVkazyZLzo8xRWbNc'),
]);
// the pack a payment link sells (null: not one of the till's links), and the pack of a credit by its size (every size is one pack)
export const tillOffer = (link) => TILL.find((o) => o.linkId === link) || AGENT_TILL.find((o) => o.linkId === link) || null;
export const tillByPages = (pages) => TILL.find((o) => o.pages === pages) || null;
const eur = (cents) => (cents / 100).toFixed(2);
const perPage = (o) => (o.cents / 100 / o.pages).toFixed(6);
// the Reederei: an own reader node on a server in the EU, set up by hand within 48 hours of payment; its two payment links
// stand in node/seo.mjs OFFER (reederei, reedereijahr), reached through the order pages /c/reederei and /c/reedereijahr
export const NODE = Object.freeze({ door: '/reader/node', terms: [
  Object.freeze({ id: 'reederei', cents: 290_000, days: 90, linkId: 'plink_1Ug6an4IVkazyZLz7cCZ9jLt' }),
  Object.freeze({ id: 'reedereijahr', cents: 990_000, days: 365, linkId: 'plink_1Ug6ao4IVkazyZLzl3H93euT' }),
] });
export const CHECKOUT_DOOR = '/reader/credit/paid';
export const SESSION_RE = /^cs_(live|test)_[A-Za-z0-9]{10,200}$/;

// the key the tokens of this till are derived with (null without a secret: the till then rests)
export const checkoutKey = (secret) => (secret && String(secret).length >= 16 ? createHmac('sha256', String(secret)).update('mare-checkout-token-v1').digest() : null);
// the credit token of one Checkout Session: mlc_ and 32 characters, the form every credit token has (node/credit.mjs CREDIT_RE)
export const checkoutToken = (key, session) => `mlc_${createHmac('sha256', key).update(String(session)).digest('base64url').slice(0, 32)}`;

// the Checkout Session, read by the Edge Function that holds the key: → { ok: true, s } or { ok: false, why, status }
export async function checkoutSession(session, { url, anon, secret, fetchFn = fetch, timeoutMs = 20_000 } = {}) {
  if (!url || !secret) return { ok: false, why: 'the operators\' till rests (no database secret on this node)', status: 503 };
  let r; try {
    r = await fetchFn(`${String(url).replace(/\/$/, '')}/functions/v1/mare-mpp`, { method: 'POST', headers: { 'content-type': 'application/json', ...(anon ? { apikey: anon } : {}) },
      body: JSON.stringify({ secret, action: 'session', session }), signal: AbortSignal.timeout(timeoutMs) });
  } catch { return { ok: false, why: 'the till did not answer in time; open the same link again in a minute', status: 504 }; }
  let p = null; try { p = await r.json(); } catch {}
  if (r.status === 200 && p?.ok === true) return { ok: true, s: p };
  return { ok: false, why: String(p?.message || p?.error || `the payment could not be read (${p?.status || r.status})`).slice(0, 200), status: Number(p?.status || r.status) || 502 };
}

// null when this session paid for exactly this offer, else why not (in words for the buyer)
export function checkoutPaid(s, o = s && typeof s === 'object' ? tillOffer(s.payment_link) : null) {
  if (!s || typeof s !== 'object') return 'the payment could not be read';
  if (!o || s.payment_link !== o.linkId) return 'this payment was not made through one of the reader credit offers';
  if (s.mode !== 'payment') return 'this is not a one-time payment';
  if (s.status !== 'complete' || s.payment_status !== 'paid') return 'this payment is not complete yet; if you have just paid, open the same link again in a minute';
  if (s.amount_total !== o.cents || String(s.currency || '').toLowerCase() !== o.currency) return `this payment is not for exactly ${o.currency.toUpperCase()} ${(o.cents / 100).toFixed(2)}`;
  return null;
}

// every pack of the ladder as data: price, pages, days, the price of a page and its order page (never the payment link)
export const tillPlans = (base) => { const b = String(base || '').replace(/\/+$/, ''); return TILL.map((o) => ({ id: o.id, name: o.name, price_eur: eur(o.cents), pages: o.pages, days: o.days, per_page_eur: perPage(o), buy: `${b}/c/${o.id}?from=reader` })); };
// what the door says: the offer alone (the Starter pack first, as since 3.55, and the whole ladder), the credit of a paid
// session (token, pages, use), or why nothing was given
export function checkoutAnswer(base, { token = null, credit = null, minted = null, session = null, offer: bought = null } = {}) {
  const b = String(base || '').replace(/\/+$/, ''), per = perPage(CHECKOUT);
  const offer = { what: `Mare Liberum: reader credit for operators, ${CHECKOUT.pages} pages of the reader above the free limit of 100 a day, valid ${CHECKOUT.days} days, paid by card in the browser`,
    price_eur: eur(CHECKOUT.cents), pages: CHECKOUT.pages, days: CHECKOUT.days, per_page_eur: per, buy: `${b}/c/reader?from=reader`,
    plans: tillPlans(b),
    node: { what: 'Reederei: your own reader node on a server in the EU, set up within 48 hours of payment, its own address and no shared daily limit', price_eur: NODE.terms.map((t) => `${eur(t.cents)} for ${t.days} days`), page: `${b}${NODE.door}` },
    customers: 'business customers only (Unternehmer within the meaning of § 14 BGB); the order page asks for this before the payment page', terms: `${b}/terms#s5a`, page: `${b}/reader#credit` };
  if (!token) return offer;
  const o = bought || tillByPages(credit?.pages), paidEur = session && Number.isFinite(session.amount_total) ? eur(session.amount_total) : o ? eur(o.cents) : null;
  // (since 3.63) a pack in USD (AGENT_TILL) says its price in USD
  const usd = o?.currency === 'usd', price = o ? (usd ? { plan: o.name, price_usd: eur(o.cents), per_page_usd: perPage(o) } : { plan: o.name, price_eur: eur(o.cents), per_page_eur: perPage(o) }) : {};
  return { token, pages: credit.pages, left: credit.left, until: credit.until, ...price, ...(minted != null ? { minted } : {}),
    use: { header: 'x-sea-credit: <token>', firecrawl: 'Authorization: Bearer <token> (the api key of a Firecrawl SDK)', doors: [`${b}/r/<page address>`, `${b}/read?url=<page address>`, `POST ${b}/v1/scrape`, `POST ${b}/v2/scrape`], spent: 'one page per read that would count against the free limit, only after the network\'s 100 free pages of the UTC day' },
    again: 'This link shows the same token again. Keep the link and the token to yourself: whoever holds either can spend the credit.',
    ...(session ? { paid: { status: 'paid', method: 'Stripe Checkout (card in the browser)', ...(usd ? { amount_usd: paidEur } : { amount_eur: paidEur }), reference: session.payment_intent || session.id } } : {}),
    terms: offer.terms, page: offer.page };
}

// the same as a page for the person who has just paid (no-store, noindex, no referrer: the link carries the session)
export function checkoutPage(base, j, status = 200) {
  const b = String(base || '').replace(/\/+$/, ''), err = j?.error, offer = j?.offer || (j?.token ? null : j);
  const pre = (t) => `<pre>${esc(t)}</pre>`;
  let h1, lead, body;
  if (j?.token) {
    h1 = 'Your reader credit';
    lead = `<p class="pulse">${esc(String(j.left))} of ${esc(String(j.pages))} pages left, valid until ${esc(String(j.until).slice(0, 10))}.</p>`;
    body = `<div class="box"><p><b>Your token</b> (keep it to yourself: whoever holds it can spend the credit)</p>
<p><input type="text" readonly value="${esc(j.token)}" aria-label="your reader credit token" style="width:100%;font:1rem ui-monospace,monospace;padding:.6rem" onclick="this.select()"></p>
<p><small>${esc(j.again)}</small></p></div>
<h2>Use it</h2>
<p>Send the token with every read past the free 100 pages a day; a page is spent only where the free limit would refuse the read.</p>
${pre(`curl -H 'x-sea-credit: ${j.token}' ${b}/r/https://example.org/`)}
${pre(`app = Firecrawl(api_key="${j.token}", api_url="${b}")   # the token as the Firecrawl key`)}
<p>Doors: ${j.use.doors.map((d) => `<code>${esc(d)}</code>`).join(', ')}. Every answer that spends a page says what is left (<code>x-sea-credit-left</code>).</p>
${j.paid ? `<p><small>Paid: ${j.paid.amount_usd ? `USD ${esc(j.paid.amount_usd)}` : `EUR ${esc(j.paid.amount_eur)}`} through Stripe; reference ${esc(j.paid.reference)}. Your invoice comes from Stripe by e-mail.</small></p>` : ''}
<p><small>Terms: <a href="/terms#s5a">§ 5a</a> (<a href="/de/agb#s5a">AGB § 5a</a>) · the reader: <a href="/reader">/reader</a> · questions: <a href="mailto:oroborosdesign@gmail.com">oroborosdesign@gmail.com</a></small></p>`;
  } else {
    h1 = err ? 'Nothing was given' : 'Reader credit for operators';
    lead = `<p class="pulse">${err ? esc(err.message) : `${esc(String(CHECKOUT.pages))} pages of the reader for EUR ${esc(eur(CHECKOUT.cents))}, valid ${esc(String(CHECKOUT.days))} days, and bigger packs up to ${esc(TILL[TILL.length - 1].pages.toLocaleString('en-US'))} pages.`}</p>`;
    const o = offer || checkoutAnswer(b);
    body = `<p>${esc(o.what)}. EUR ${esc(o.per_page_eur)} a page; only pages past the free 100 a day are spent.</p>
<p><a href="/c/reader?from=reader" style="display:inline-block;padding:.85rem 1.3rem;border-radius:10px;background:#0b5cad;color:#fff;font-weight:600;text-decoration:none">Buy 10,000 pages for EUR 10</a><br><small class="muted">${esc(o.customers)}. No VAT is charged (small business under § 19 of the German VAT Act).</small></p>
${ladderHtml()}
<p>After paying, Stripe brings you back here and this page shows your token at once.</p>
<p><small>Agents pay by themselves: <a href="/reader#credit">x402 or a card over MPP</a> · your own reader node: <a href="${NODE.door}">Reederei</a> · terms: <a href="/terms#s5a">§ 5a</a> · questions: <a href="mailto:oroborosdesign@gmail.com">oroborosdesign@gmail.com</a></small></p>`;
  }
  return page(b, '/reader/credit/paid', `${h1} · Mare Liberum`, 'Reader credit of Mare Liberum for operators: pages of the reader above the free limit, paid by card.', `<h1>${esc(h1)}</h1>${lead}${body}`, null, '/og.png', { robots: 'noindex, nofollow' });
}

// the ladder as a table for a person: every pack with its order page (never the payment link)
const fmt = (n) => Number(n).toLocaleString('en-US');
export function ladderHtml() {
  const rows = TILL.filter((o) => o.id !== 'reader').map((o) => `<tr id="plan-${esc(o.id)}"><td><b>${esc(o.name)}</b></td><td>${esc(fmt(o.pages))}</td><td>${esc(String(o.days))} days</td><td>EUR ${esc(fmt(o.cents / 100))}</td><td>EUR ${esc(perPage(o))}</td><td><a class="tag" href="/c/${esc(o.id)}?from=reader" rel="nofollow">Buy</a></td></tr>`).join('');
  return `<h2 id="plans">Bigger packs for operators</h2>
<p>For scripts and agent fleets that read every day. One payment, one token, the pages for the whole term; a year holds twelve months of pages and runs 365 days.</p>
<table><thead><tr><th>pack</th><th>pages</th><th>term</th><th>price</th><th>a page</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}

// the Reederei, for a person: an own reader node in the EU, its two terms and their order pages; ?paid=1 thanks the buyer
export function nodePage(base, paid = false) {
  const b = String(base || '').replace(/\/+$/, ''), [t90, t365] = NODE.terms;
  const btn = (t, label) => `<a href="/c/${esc(t.id)}?from=reader" style="display:inline-block;margin:.3rem .4rem .3rem 0;padding:.85rem 1.3rem;border-radius:10px;background:#0b5cad;color:#fff;font-weight:600;text-decoration:none">${esc(label)}</a>`;
  const thanks = paid ? `<div class="box" role="status" style="border-color:#0b5cad"><p style="margin:0"><b>Thank you, your payment has arrived. We set up your reader node within 48 hours and write to the e-mail address you gave at the payment. Danke, Ihre Zahlung ist angekommen: Wir richten Ihren Leser-Knoten binnen 48 Stunden ein und schreiben Ihnen an die angegebene E-Mail-Adresse.</b></p></div>` : '';
  const body = `${thanks}<h1>Reederei: your own reader node</h1>
<p class="pulse">The Mare Liberum reader on a server of your own, in the EU, for your agents and scripts alone.</p>
<ul>
<li><b>Your own node:</b> the reader of Mare Liberum (web page to Markdown, PDFs, the prompt-injection warden, the doors of Jina Reader and Firecrawl) on its own server at Hetzner in the EU.</li>
<li><b>Your own address</b> under mareliberum.dev or on a domain of yours, and no shared limit of 100 pages a day: the node reads as much as its server carries (2 vCPU, 4 GB).</li>
<li><b>Set up within 48 hours</b> of payment, then run and updated by us for the term you book. We write to the e-mail address you give at the payment.</li>
</ul>
<p>${btn(t90, `90 days for EUR ${fmt(t90.cents / 100)}`)}${btn(t365, `12 months for EUR ${fmt(t365.cents / 100)}`)}<br><small class="muted">Business customers only (§ 14 BGB); the order page asks for this before the payment page. No VAT is charged (small business under § 19 of the German VAT Act).</small></p>
<h2>Auf Deutsch</h2>
<p lang="de">Ihr eigener Leser-Knoten: der Leser von Mare Liberum auf einem eigenen Server in der EU, mit eigener Adresse, ohne gemeinsames Tageslimit, eingerichtet binnen 48 Stunden nach Zahlung und für die gebuchte Laufzeit von uns betrieben: 90 Tage für ${fmt(t90.cents / 100)} € oder 12 Monate für ${fmt(t365.cents / 100)} €, nur für Unternehmer.</p>
<p><small>Smaller needs: <a href="/reader/credit/paid">reader credit from EUR 10</a> · the reader: <a href="/reader">/reader</a> · terms: <a href="/terms#s4">§ 4</a> (<a href="/de/agb#s4">AGB § 4</a>) · questions: <a href="mailto:oroborosdesign@gmail.com">oroborosdesign@gmail.com</a></small></p>`;
  return page(b, NODE.door, 'Reederei: your own Mare Liberum reader node in the EU', 'Your own Mare Liberum reader node on a server in the EU: web page to Markdown, PDFs and the prompt-injection warden for your agents alone, set up within 48 hours.', body, null, '/og.png', paid ? { robots: 'noindex, nofollow' } : undefined);
}

// (since 3.63) the page for agents: what a page of the reader saves (measured on this node that day, an upper bound), the free
// part, the packs and every way to pay them (mpp pay with a Link wallet; a checkout for one-time cards and wallets), how to use
// the token, and a short, plain summary an agent can give its person. value: { pages, saved_tokens_per_page } or null
export const FOR_AGENTS = '/for-agents';
export function forAgents(base, value = null, { mppDoor = '/reader/credit/stripe' } = {}) {
  const b = String(base || '').replace(/\/+$/, ''), usd3 = value ? +(value.saved_tokens_per_page * 3 / 1e6).toFixed(4) : null;
  const packs = AGENT_TILL.map((o) => { const n = o.id.replace('agent', ''); return { pack: n, price_usd: eur(o.cents), pages: o.pages, days: o.days, per_page_usd: perPage(o),
    pay: { link_wallet: `mpp pay ${b}${mppDoor}?pack=${n}`, checkout: `${b}/c/${o.id}?from=agents` } }; });
  const first = packs[0];
  return {
    what: 'Mare Liberum for agents: any public web page or PDF as clean Markdown, robots.txt followed. 100 pages a day are free per network; past that, prepaid credit.',
    value: { today: value, worth_usd_at_3_per_million_input_tokens: usd3, page_price_usd: (0.001).toFixed(6), page_price_usd_in_the_99_pack: packs[packs.length - 1].per_page_usd,
      note: 'measured on this node today: the Markdown the reader hands over against the raw HTML of the same page, once a day per network and page; an upper bound, the price of a model\'s input decides what it is worth', how: `${b}/savings` },
    free: { pages_a_day: 100, read: `${b}/r/<page address>` },
    packs,
    pay: {
      link_wallet: 'An agent with a Link wallet (Claude, OpenAI agents, OpenClaw, Grok and others) runs mpp pay with the pack\'s door; Link asks its person to approve the spend, and the answer carries the token.',
      checkout: 'An agent that pays on a normal checkout (ChatGPT Wallet, Grok with a Link card, Gemini with Google Pay and others) opens the checkout link; right after paying, the page shows the token.',
      small: `The card door without ?pack sells 500 pages for 0.50 USD: POST ${b}${mppDoor}.`,
    },
    use: { header: 'x-sea-credit: <token>', firecrawl: 'Authorization: Bearer <token> (the api key of a Firecrawl SDK, api_url set to this node)', doors: [`${b}/r/<page address>`, `${b}/read?url=<page address>`, `POST ${b}/v1/scrape`, `POST ${b}/v2/scrape`],
      spent: 'one page per read past the free 100 of the day, and only when the read brings Markdown back' },
    for_your_person: `Mare Liberum reads web pages as Markdown for me. ${value ? `Measured today, a page saves about ${value.saved_tokens_per_page.toLocaleString('en-US')} tokens against its raw HTML (an upper bound, about ${usd3} USD at 3 USD per million input tokens), and costs 0.001 USD.` : 'A page costs 0.001 USD.'} I suggest pack ${first.pack}: ${first.pages.toLocaleString('en-US')} pages for ${first.price_usd} USD, valid ${first.days} days. Shall I buy it?`,
    who: 'people and businesses; consumers have a 14-day right of withdrawal (terms § 13)',
    terms: `${b}/terms#s5a`, withdrawal: `${b}/de/widerruf#en`,
  };
}
export function forAgentsPage(base, j) {
  const b = String(base || '').replace(/\/+$/, ''), v = j.value, pre = (t) => `<pre>${esc(t)}</pre>`;
  const rows = j.packs.map((p) => `<tr id="pack-${esc(p.pack)}"><td><b>${esc(p.price_usd)} USD</b></td><td>${esc(fmt(p.pages))} pages</td><td>${esc(String(p.days))} days</td><td>USD ${esc(p.per_page_usd)}</td><td><code>${esc(p.pay.link_wallet)}</code></td><td><a class="tag" href="/c/agent${esc(p.pack)}?from=agents" rel="nofollow">Checkout</a></td></tr>`).join('');
  const body = `<h1>For agents: the reader, its value and every way to pay</h1>
<p class="pulse">${esc(j.what)}</p>
${v.today ? `<div class="box"><p><b>Measured today:</b> a page saves about ${esc(fmt(v.today.saved_tokens_per_page))} tokens against its raw HTML (${esc(String(v.today.pages))} pages measured; an upper bound), about ${esc(String(v.worth_usd_at_3_per_million_input_tokens))} USD at 3 USD per million input tokens. A page costs ${esc(v.page_price_usd)} USD, in the 99 USD pack ${esc(v.page_price_usd_in_the_99_pack)} USD. <a href="/savings">How we count</a></p></div>` : ''}
<h2>Free</h2>
${pre(`curl ${b}/r/https://example.org/`)}
<p>100 pages a day per network, no account, no key.</p>
<h2>Packs</h2>
<table><thead><tr><th>price</th><th>pages</th><th>term</th><th>a page</th><th>with a Link wallet</th><th>with a card or wallet</th></tr></thead><tbody>${rows}</tbody></table>
<p>${esc(j.pay.link_wallet)}</p><p>${esc(j.pay.checkout)}</p><p><small>${esc(j.pay.small)}</small></p>
<h2>Use the token</h2>
${pre(`curl -H 'x-sea-credit: <token>' ${b}/r/https://example.org/`)}
<p>${esc(j.use.spent)}.</p>
<h2>For your person</h2>
<blockquote>${esc(j.for_your_person)}</blockquote>
<p><small>For ${esc(j.who)}: <a href="/de/widerruf#en">withdrawal</a> · terms: <a href="/terms#s5a">§ 5a</a> (<a href="/de/agb#s5a">AGB § 5a</a>) · as data: <a href="/for-agents.json">/for-agents.json</a> · questions: <a href="mailto:oroborosdesign@gmail.com">oroborosdesign@gmail.com</a></small></p>`;
  return page(b, FOR_AGENTS, 'For agents · Mare Liberum', 'Mare Liberum for AI agents: web pages as Markdown, what a page saves, and packs from 10 USD paid with a Link wallet or a card.', body, null, '/og.png');
}
