// Mare Liberum · the seat (since 4.0): a chat host buys for its human, by card, with one link
// Most chat hosts (ChatGPT, Claude, Grok, Gemini, Cursor, Copilot) have no wallet, but their human has a card. The host makes
// one call and hands its human one link; the human presses one button and pays on Stripe; the key the host sent turns active.
//   ask      POST /seat?as=host (or ?a=host; GET too, for a host that can only read links), no auth: { seat_id, checkout_url, price_usd, period_days, paths_included,
//            price_per_path_over, how_to_present, one_sentence, status: awaiting_human }. Nothing is written: the link is a
//            signed token (below). With a key (x-sea-session) the link names the key's public id, and the same key gets the
//            same link the whole UTC day (the way out of node/core.mjs hands that link again at 3 and at 0 calls left).
//   token    base64url of "v1|<seat id>|<key id or ->|<cents>|<expires, unix seconds>|<host>", a dot and the first 12 bytes of
//            HMAC-SHA256 over "seat|" and that text with the node's key (node/via.mjs viaKey, as the /via/ tokens); valid 7 days.
//            Anyone can read it (no secret in it: the key id is the public id of a session bookmark); only the node can make one.
//   page     GET /pay/<token>: the receipt, not an advert. At most 25 lines of HTML, no framework, no picture, no form, one button
//            to the order door /c/seat (node/attention.mjs CTA.seat, for everyone as the agent packs), which leads to the Stripe
//            payment link with the token as client_reference_id; the x402 way in one line. It never asks for a login, an e-mail or
//            an address, and sets no cookie (the sea sets none, as its privacy texts say).
//   confirm  Stripe sends the browser to GET /seat/confirm?session={CHECKOUT_SESSION_ID}. The node has the Edge Function mare-mpp
//            read that Checkout Session (node/checkout.mjs checkoutSession) and gives the seat only when it is complete, paid, in
//            payment mode, through the seat's payment link and for exactly its price. Then, once per payment: the sale is written
//            (q host_seat …, status settled: the money arrived at Stripe; method host_link), a key is derived from the session and
//            gets the seat (so the thanks page shows the same key again), and the browser goes on to /thanks?session=… with the key
//            in one <code> line for the human to paste back to the host. Once the Edge Function hands back the payment's
//            client_reference_id (deploy/mare-mpp.ts), the key named in the token gets the seat instead and nothing is to copy. POST /seat/confirm {"token": …} answers whether
//            that seat is paid: 200 with the key's id once Stripe confirmed it, else 202 (awaiting_human) with the same link; a
//            session that did not pay for the seat is 409. Never 402 here: nothing is paid to this address, an x402 client must not try. Never a seat without a
//            payment Stripe confirmed: a sale nobody paid is never written.
//   seat     30 days, 5,000 paths of the paid doors; past them the doors go on answering and each path counts as overage at
//            0.01 USD (node/session.mjs). The price stands in node/pricing.mjs (SEAT) and nowhere else.
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { SEAT, seatTerms, seatSentence, seatLine, pricingOf, priceOf } from './pricing.mjs';
import { viaKey } from './via.mjs';
import { esc } from './pages.mjs';

const MAC = 12, DAY = 86_400;
export const SEAT_ID_RE = /^st_[0-9a-f]{16}$/;
const KEY_ID = /^[0-9a-f]{24}$/, SRC = /^[a-z]{2,10}$/, CS = /^cs_(live|test)_[A-Za-z0-9]{10,200}$/;
export { HOSTS, hostOf } from './hosts.mjs';
export const isCheckoutSession = (s) => CS.test(String(s || ''));
const dayOf = (t) => new Date(t).toISOString().slice(0, 10);
const sha = (s) => createHash('sha256').update(String(s)).digest('hex');

// ---------------------------------------------------------------- the token
export function seatToken({ id, k = null, cents = SEAT.cents, exp, src = 'other' }, key = viaKey()) {
  const payload = `v1|${id}|${k || '-'}|${cents}|${exp}|${SRC.test(src) ? src : 'other'}`;
  const mac = createHmac('sha256', key).update(`seat|${payload}`).digest().subarray(0, MAC);
  return Buffer.concat([Buffer.from(payload, 'utf8'), Buffer.from('.'), mac]).toString('base64url');
}
// → null (not shaped like a token) · { ok: false, why } (not this node's, or not a seat's) · { ok: false, expired, … } · { ok, id, k, cents, exp, src }
export function readSeatToken(token, { now = Date.now(), key = viaKey() } = {}) {
  const s = String(token || '');
  if (!/^[A-Za-z0-9_-]{40,400}$/.test(s)) return null;
  const b = Buffer.from(s, 'base64url');
  if (b.length < MAC + 12 || b[b.length - MAC - 1] !== 0x2e) return null;
  const body = b.subarray(0, b.length - MAC - 1), mac = b.subarray(b.length - MAC);
  const want = createHmac('sha256', key).update(Buffer.concat([Buffer.from('seat|'), body])).digest().subarray(0, MAC);
  if (!timingSafeEqual(mac, want)) return { ok: false, why: 'this link was not made by this sea' };
  const [v, id, k, cents, exp, src] = body.toString('utf8').split('|');
  if (v !== 'v1' || !SEAT_ID_RE.test(id || '') || !(k === '-' || KEY_ID.test(k || '')) || !/^\d{1,7}$/.test(cents || '') || !/^\d{9,11}$/.test(exp || '')) return { ok: false, why: 'this is not the link of a seat' };
  const t = { ok: true, id, k: k === '-' ? null : k, cents: Number(cents), exp: Number(exp), src: SRC.test(src || '') ? src : 'other', token: s };
  return t.exp * 1000 <= now ? { ...t, ok: false, expired: true, why: `this link ran out after ${SEAT.tokenDays} days: ask your agent for a new one` } : t;
}
// the seat id of a key on one UTC day (the same key gets the same link all day); a seat asked without a key gets a new id
export const seatIdFor = (keyId, day, key = viaKey()) => `st_${createHmac('sha256', key).update(`seat-id|${keyId}|${day}`).digest('hex').slice(0, 16)}`;
export const newSeatId = () => `st_${randomBytes(8).toString('hex')}`;
// the key a payment gets that came without a key: derived from the Stripe session, so a reload of the thanks page shows it again
export const seatKeyOf = (session, key = viaKey()) => `mls_${createHmac('sha256', key).update(`seat-key|${session}`).digest().subarray(0, 24).toString('base64url')}`;
export const sessionMark = (session) => sha(`seat|${session}`).slice(0, 32);

// the link a host hands over: with a key, one link a day for that key (valid 7 days from the start of that day); without, a new seat
export function checkoutOf(base, { k = null, src = 'other', now = Date.now(), cents = SEAT.cents } = {}) {
  const b = String(base).replace(/\/+$/, ''), day = dayOf(now);
  const id = k ? seatIdFor(k, day) : newSeatId();
  const exp = k ? Math.floor(Date.parse(`${day}T00:00:00Z`) / 1000) + (SEAT.tokenDays + 1) * DAY : Math.floor(now / 1000) + SEAT.tokenDays * DAY;
  const token = seatToken({ id, k, cents, exp, src });
  return { seat_id: id, token, checkout_url: `${b}/pay/${token}`, expires: new Date(exp * 1000).toISOString() };
}
// the one button: the order door of the seat (node/attention.mjs CTA.seat), which leads to the Stripe page with the token as the
// sea's own reference (never anything about the buyer)
export const doorOf = (base, token) => `${String(base).replace(/\/+$/, '')}/c/seat?from=pay&ref=${encodeURIComponent(token)}`;

// ---------------------------------------------------------------- what a host gets (POST /seat?as=host)
export function hostAnswer(base, c, { keyed = false } = {}) {
  const t = seatTerms(), b = String(base).replace(/\/+$/, '');
  return {
    seat_id: c.seat_id, checkout_url: c.checkout_url, price_usd: t.price_usd, period_days: t.period_days, paths_included: t.paths_included,
    price_per_path_over: t.price_per_path_over, how_to_present: 'give the human this one link, say one sentence, never paraphrase the price',
    one_sentence: seatSentence(), status: 'awaiting_human',
    expires: c.expires,
    then: 'once the human has paid, the thanks page shows a key with the seat in one line; the human pastes it back to you and you send it as x-sea-session',
    state: `POST ${b}/seat/confirm {"token":"<the part of checkout_url after /pay/>"}: 202 while unpaid, 200 with the key's id once Stripe confirmed the payment`,
  };
}
// the offer as data (GET /seats, /licence, /seat): the card first, since most hosts have no wallet; the wallet after it
export function seatOffer(base, routeUsd = pricingOf(priceOf(), base).amount_usd) {
  const b = String(base).replace(/\/+$/, ''), t = seatTerms();
  return {
    what: 'A seat for an agent, bought by its human with one link: the paid doors of the sea (route, read, check, deal, pack) for 30 days',
    ...t, line: seatLine(),
    ways: [
      { way: 'card', first: true, for: 'a chat host whose human has a card (most hosts have no wallet)', call: `POST ${b}/seat?as=host`, with_key: 'send the header x-sea-session: <key> and that key turns active once paid', gives: 'checkout_url: one page, one button, paid on Stripe (card, Link, Apple Pay, Google Pay); the sea asks for no login, no e-mail and no address', then: 'give the human the one link and the one_sentence, never paraphrase the price' },
      { way: 'wallet', for: 'an agent with a wallet', call: `POST ${b}/route?q=<task>`, gives: `each path ${routeUsd} USDC over x402 on Base, no seat needed`, how: `${b}/pay/howto` },
    ],
    free: { call: `GET ${b}/session?as=key`, gives: '20 probe calls for 7 days on the paid doors, no account' },
    confirm: `GET ${b}/seat/confirm?session=<Stripe Checkout Session> (Stripe sends the browser there) · POST ${b}/seat/confirm {"token":"…"}`,
    seller: 'Oroboros Design, Daouda Ndiaye, Köln (no VAT charged, § 19 UStG)', terms: `${b}/terms`, withdrawal: `${b}/de/widerruf#en`,
    note: '?as= and ?a= mean the same on /seat, /seats and /licence',
  };
}

// ---------------------------------------------------------------- the two pages (each a receipt: no framework, no picture, no form)
const STYLE = 'body{font:18px/1.5 system-ui,-apple-system,sans-serif;max-width:32rem;margin:10vh auto;padding:0 1.2rem;color:#0b1720;background:#fff}h1{font-size:2.6rem;margin:.2rem 0}a.pay{display:block;text-align:center;background:#0b3d5c;color:#fff;padding:1rem;border-radius:.6rem;text-decoration:none;font-weight:600;margin:1.6rem 0}small{color:#4a5560}code{display:block;word-break:break-all;background:#f1f4f6;padding:.8rem;border-radius:.4rem;font-size:1rem;user-select:all}';
const head = (title) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${esc(title)}</title><style>${STYLE}</style></head><body>`;
const foot = (b) => `<p><small>Mare Liberum is run by Oroboros Design, Köln · <a href="${b}/impressum">Impressum</a> · <a href="${b}/terms">Terms</a> · consumers may withdraw within 14 days: <a href="${b}/de/widerruf#en">how</a></small></p>`;
export function payPage(base, t, routeUsd = pricingOf(priceOf(), base).amount_usd) {
  const b = String(base).replace(/\/+$/, ''), o = seatTerms(), usd = (t.cents / 100).toFixed(0);
  return [
    head(`Mare Liberum · ${usd} USD · a seat for your agent`),
    '<p><b>Mare Liberum</b> · a seat for your agent</p>',
    `<h1>${usd} USD</h1>`,
    `<p>${o.period_days} days · ${o.paths_included.toLocaleString('en-US')} agent paths included · then ${o.price_per_path_over.toFixed(2)} USD per path.</p>`,
    `<a class="pay" href="${esc(doorOf(b, t.token))}">Pay ${usd} USD</a>`,
    '<p><small>You pay on Stripe: card, Link, Apple Pay or Google Pay. No login, no account here. Right after paying you come back here and see the key for your agent.</small></p>',
    `<p><small>With a wallet instead: each path ${routeUsd} USDC over x402 on Base, no seat needed: <code>POST ${esc(b)}/route?q=&lt;task&gt;</code></small></p>`,
    foot(b),
    '</body></html>',
  ].join('\n');
}
export function thanksPage(base, r) {
  const b = String(base).replace(/\/+$/, '');
  if (!r || !r.ok) return [head('Mare Liberum · not confirmed yet'), '<h1>Not confirmed yet</h1>', `<p>${esc(r?.why || 'this payment could not be read')}.</p>`, '<p><small>If you have just paid, open this page again in a minute. Your payment is safe with Stripe; write to oroborosdesign@gmail.com with its time if it stays like this.</small></p>', foot(b), '</body></html>'].join('\n');
  return [
    head('Mare Liberum · paid, thank you'),
    '<h1>Paid. Thank you.</h1>',
    `<p>The seat runs until ${esc(String(r.until).slice(0, 10))}: ${SEAT.paths.toLocaleString('en-US')} agent paths, then ${(SEAT.overCents / 100).toFixed(2)} USD per path.</p>`,
    r.key ? '<p>Your key. Paste it to your agent:</p>' : `<p>The key your agent sent (id ${esc(r.key_id)}) is active now. Nothing to copy: your agent sees seat_state "active" on its next call.</p>`,
    r.key ? `<code>${esc(r.key)}</code>` : '',
    r.key ? '<p><small>Keep it like a password: whoever holds the key uses the seat. This page shows it again on reload.</small></p>' : '',
    '<p><small>Stripe sends the receipt by e-mail. The open numbers of the till: <a href="' + b + '/treasury">/treasury</a></small></p>',
    foot(b),
    '</body></html>',
  ].filter(Boolean).join('\n');
}

// ---------------------------------------------------------------- the payment: null when this Checkout Session paid for exactly the seat
export function seatPaid(s) {
  if (!s || typeof s !== 'object') return 'the payment could not be read';
  if (s.payment_link !== SEAT.linkId) return 'this payment was not made through the seat\'s link';
  if (s.mode !== 'payment') return 'this is not a one-time payment';
  if (s.status !== 'complete' || s.payment_status !== 'paid') return 'this payment is not complete yet; if you have just paid, open the same link again in a minute';
  if (s.amount_total !== SEAT.cents || String(s.currency || '').toLowerCase() !== SEAT.currency) return `this payment is not for exactly ${SEAT.currency.toUpperCase()} ${(SEAT.cents / 100).toFixed(2)}`;
  return null;
}
