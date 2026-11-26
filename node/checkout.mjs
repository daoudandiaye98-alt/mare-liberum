// Mare Liberum · the operators' till (since 3.55): reader credit by card in the browser, for businesses
// The operator of a script that reads many pages through the reader pays here, not the agent: an offer in euro (business
// customers only, behind the order page /c/reader) through a Stripe payment link, EUR 10 for 10,000 pages of the reader above
// the free 100 a day, valid 30 days. After paying, Stripe sends the buyer to /reader/credit/paid?session={CHECKOUT_SESSION_ID}.
// - The node has the Edge Function mare-mpp read that Checkout Session (it alone holds the restricted Stripe key; the node sends
//   its writer secret, as for the card door) and gives credit only when the session is complete and paid, in payment mode,
//   through this offer's payment link, for exactly EUR 10.00. Nothing about the buyer comes back: no name, no e-mail, no card.
// - The token is derived from the session (an HMAC under a key from the node's secret), so the buyer's own link shows the same
//   token again; the credit is minted once: a token whose credit exists is only shown, never filled up again.
// - The sea keeps what it keeps for every credit (the token's SHA-256, pages, left, until) and the id of the payment.
import { createHmac } from 'node:crypto';
import { page, esc } from './pages.mjs';

export const CHECKOUT = Object.freeze({
  cents: 1000, currency: 'eur', pages: 10_000, days: 30,
  // Stripe: plink_1Ug4VQ4IVkazyZLzBNhuF2wm · the payment link itself stands in node/seo.mjs (OFFER.reader), reached only
  // through the order page /c/reader (node/attention.mjs CTA.reader)
  linkId: 'plink_1Ug4VQ4IVkazyZLzBNhuF2wm',
});
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
export function checkoutPaid(s, o = CHECKOUT) {
  if (!s || typeof s !== 'object') return 'the payment could not be read';
  if (s.payment_link !== o.linkId) return 'this payment was not made through the reader credit offer';
  if (s.mode !== 'payment') return 'this is not a one-time payment';
  if (s.status !== 'complete' || s.payment_status !== 'paid') return 'this payment is not complete yet; if you have just paid, open the same link again in a minute';
  if (s.amount_total !== o.cents || String(s.currency || '').toLowerCase() !== o.currency) return `this payment is not for exactly EUR ${(o.cents / 100).toFixed(2)}`;
  return null;
}

// what the door says: the offer alone, the credit of a paid session (token, pages, use), or why nothing was given
export function checkoutAnswer(base, { token = null, credit = null, minted = null, session = null } = {}) {
  const b = String(base || '').replace(/\/+$/, ''), per = (CHECKOUT.cents / 100 / CHECKOUT.pages).toFixed(6);
  const offer = { what: `Mare Liberum: reader credit for operators, ${CHECKOUT.pages} pages of the reader above the free limit of 100 a day, valid ${CHECKOUT.days} days, paid by card in the browser`,
    price_eur: (CHECKOUT.cents / 100).toFixed(2), pages: CHECKOUT.pages, days: CHECKOUT.days, per_page_eur: per, buy: `${b}/c/reader?from=reader`,
    customers: 'business customers only (Unternehmer within the meaning of § 14 BGB); the order page asks for this before the payment page', terms: `${b}/terms#s5a`, page: `${b}/reader#credit` };
  if (!token) return offer;
  return { token, pages: credit.pages, left: credit.left, until: credit.until, price_eur: offer.price_eur, per_page_eur: per, ...(minted != null ? { minted } : {}),
    use: { header: 'x-sea-credit: <token>', firecrawl: 'Authorization: Bearer <token> (the api key of a Firecrawl SDK)', doors: [`${b}/r/<page address>`, `${b}/read?url=<page address>`, `POST ${b}/v1/scrape`, `POST ${b}/v2/scrape`], spent: 'one page per read that would count against the free limit, only after the network\'s 100 free pages of the UTC day' },
    again: 'This link shows the same token again. Keep the link and the token to yourself: whoever holds either can spend the credit.',
    ...(session ? { paid: { status: 'paid', method: 'Stripe Checkout (card in the browser)', amount_eur: offer.price_eur, reference: session.payment_intent || session.id } } : {}),
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
${j.paid ? `<p><small>Paid: EUR ${esc(j.paid.amount_eur)} through Stripe; reference ${esc(j.paid.reference)}. Your invoice comes from Stripe by e-mail.</small></p>` : ''}
<p><small>Terms: <a href="/terms#s5a">§ 5a</a> (<a href="/de/agb#s5a">AGB § 5a</a>) · the reader: <a href="/reader">/reader</a> · questions: <a href="mailto:oroborosdesign@gmail.com">oroborosdesign@gmail.com</a></small></p>`;
  } else {
    h1 = err ? 'Nothing was given' : 'Reader credit for operators';
    lead = `<p class="pulse">${err ? esc(err.message) : `${esc(String(CHECKOUT.pages))} pages of the reader for EUR ${esc((CHECKOUT.cents / 100).toFixed(2))}, valid ${esc(String(CHECKOUT.days))} days.`}</p>`;
    const o = offer || checkoutAnswer(b);
    body = `<p>${esc(o.what)}. EUR ${esc(o.per_page_eur)} a page; only pages past the free 100 a day are spent.</p>
<p><a href="/c/reader?from=reader" style="display:inline-block;padding:.85rem 1.3rem;border-radius:10px;background:#0b5cad;color:#fff;font-weight:600;text-decoration:none">Buy 10,000 pages for EUR 10</a><br><small class="muted">${esc(o.customers)}. No VAT is charged (small business under § 19 of the German VAT Act).</small></p>
<p>After paying, Stripe brings you back here and this page shows your token at once.</p>
<p><small>Agents pay by themselves: <a href="/reader#credit">x402 or a card over MPP</a> · terms: <a href="/terms#s5a">§ 5a</a> · questions: <a href="mailto:oroborosdesign@gmail.com">oroborosdesign@gmail.com</a></small></p>`;
  }
  return page(b, '/reader/credit/paid', `${h1} · Mare Liberum`, 'Reader credit of Mare Liberum for operators: pages of the reader above the free limit, paid by card.', `<h1>${esc(h1)}</h1>${lead}${body}`, null, '/og.png', { robots: 'noindex, nofollow' });
}
