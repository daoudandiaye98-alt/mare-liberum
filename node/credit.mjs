// Mare Liberum · reader credit (since 3.38, D6 of the night of 25/26 Nov 2026, as the coordinator decided it): prepaid pages of
// the reader above the free limit. Never credit on trust: nothing is read on credit before a verified payment.
//   buy      POST /reader/credit over x402, the till's own path (node/pay.mjs takePayment, strict: no delivery without a payment
//            the facilitator verified), USDC on Base to the till's wallet, exactly USD 0.05 (a payment of any other amount is
//            not taken) for 50 pages, valid 30 days. The answer hands the token out once: mlc_ and 192 random bits (base64url).
//            The sea keeps only its SHA-256, the pages bought and left, the expiry and the id of the sale. A payment (wallet and
//            nonce of its signed transfer) buys once. A payment whose settlement fails takes its credit back.
//   use      x-sea-credit: <token>, or Authorization: Bearer mlc_… (only a bearer with that prefix is looked at, so a Firecrawl
//            SDK's api key works; any other Authorization stays unread). A page is spent only where the free limit would
//            refuse the read (after the network's 100 free pages of the UTC day; one page per read that would count against
//            the limit), on the reader's HTTP doors (/r/, /read, POST /v1/scrape and /v2/scrape). An answer that spent a page
//            says what is left (x-sea-credit-left, x-sea-credit-until). Spending is one after the other per token: never twice.
//   books    a credit payment is a sale of the till (the same books as the paid route, method credit-x402-v1 or -v2): /treasury
//            shows it. The credit itself lives in the node's state (credit:…), no table and no migration.
//   never    a token in clear anywhere (not in the state, the books, a log or a request the sea makes); credit before the free
//            pages are used; a page spent twice; a non-payer's answer other than today's limit answer (one line and two headers
//            more: how to buy credit).
import { createHash, randomBytes } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { USDC_BASE } from './pricing.mjs';

export const CREDIT = Object.freeze({ cents: 5, micro: 50_000, pages: 50, days: 30 });
export const CREDIT_PREFIX = 'mlc_';
export const CREDIT_RE = /^mlc_[A-Za-z0-9_-]{32}$/;
export const CREDIT_EXPOSE = 'x-sea-credit-left,x-sea-credit-until';
const DAY = 86_400;
export const tokenHash = (t) => createHash('sha256').update(String(t)).digest('hex');
const usd6 = (micro) => (Math.max(0, Number(micro) || 0) / 1e6).toFixed(6);

// the token a request carries, as its hash: x-sea-credit, else an Authorization whose bearer starts with mlc_. Any other
// Authorization is not looked at beyond its first letters and stays as unread as before. { bad } for a token of the wrong form
export function creditOf(headers) {
  const x = headers?.get?.('x-sea-credit');
  if (x != null) { const t = String(x).trim(); return CREDIT_RE.test(t) ? { hash: tokenHash(t) } : { bad: true }; }
  const a = headers?.get?.('authorization');
  if (a == null || !/^\s*bearer\s+mlc_/i.test(a)) return null;
  const t = String(a).trim().replace(/^bearer\s+/i, '').trim();
  return CREDIT_RE.test(t) ? { hash: tokenHash(t) } : { bad: true };
}

// what the limit answer adds for every caller: one line and two headers on how to buy credit (nothing else changes)
export function creditHint(base, why = null) {
  const b = String(base || '').replace(/\/+$/, '');
  const said = why === 'expired' ? 'This credit has expired. ' : why === 'used up' ? 'This credit is used up. ' : why === 'unknown' || why === 'bad' ? 'This credit token is not known here. ' : why === 'revoked' ? 'This credit was taken back: its payment did not settle. ' : '';
  return { line: `${said}Or read on with prepaid reader credit: POST ${b}/reader/credit over x402 (0.05 USDC on Base for 50 pages above the free limit, 30 days), then send x-sea-credit: <token> (${b}/reader#credit).`,
    headers: { 'x-sea-credit-buy': `${b}/reader/credit`, link: `<${b}/reader#credit>; rel="payment"` } };
}

// the terms of one purchase, in both shapes x402 knows (as the paid route's, node/pay.mjs termsFor)
export function creditTerms(cfg, { base }) {
  const b = String(base || '').replace(/\/+$/, ''), resource = `${b}/reader/credit`, atomic = String(CREDIT.micro);
  const description = `Mare Liberum: reader credit, ${CREDIT.pages} pages of the reader above the free limit of 100 a day, valid ${CREDIT.days} days (exactly ${usd6(CREDIT.micro)} USD)`;
  const extra = { name: 'USD Coin', version: '2' };
  const outputSchema = { input: { type: 'http', method: 'POST', discoverable: true, bodyType: 'json', bodyFields: {} }, output: { type: 'object', properties: { token: { type: 'string', description: 'mlc_…, shown once: send it as x-sea-credit or as Authorization: Bearer' }, pages: { type: 'number' }, left: { type: 'number' }, until: { type: 'string' } } } };
  const v1 = { scheme: 'exact', network: 'base', maxAmountRequired: atomic, resource, description, mimeType: 'application/json', outputSchema, payTo: cfg.payTo, maxTimeoutSeconds: cfg.window, asset: USDC_BASE, extra };
  const v2 = { scheme: 'exact', network: 'eip155:8453', amount: atomic, asset: USDC_BASE, payTo: cfg.payTo, maxTimeoutSeconds: cfg.window, extra };
  return { cents: CREDIT.cents, usd: CREDIT.micro / 1e6, atomic, micro: CREDIT.micro, resource, description, v1, v2, payTo: cfg.payTo, window: cfg.window };
}
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
// the 402: the terms where every x402 client looks, and in words
export function creditRequired(t, { base, error, cors = {} }) {
  const b = String(base || '').replace(/\/+$/, '');
  const v2 = { x402Version: 2, error: error || 'PAYMENT-SIGNATURE header is required', resource: { url: t.resource, description: t.description, mimeType: 'application/json' }, accepts: [t.v2] };
  const body = { x402Version: 1, error: error || 'X-PAYMENT header is required', accepts: [t.v1],
    amount_usd: usd6(t.micro), unit: 'USDC on Base, 6 decimals (maxAmountRequired is in millionths of a dollar)', what: t.description,
    credit: { pages: CREDIT.pages, days: CREDIT.days, per_page_usd: usd6(CREDIT.micro / CREDIT.pages), exact: 'a payment of exactly this amount; any other is not taken', use: 'x-sea-credit: <token> or Authorization: Bearer <token>', spent: 'one page per read that would count against the free limit, only after the network\'s 100 free pages of the day' },
    pay: ['x402 v2: call again with the header PAYMENT-SIGNATURE (the PAYMENT-REQUIRED header holds the terms, base64 JSON)', 'x402 v1: call again with the header X-PAYMENT (the terms are in "accepts" of this body)'],
    pay_to: t.payTo, network: 'Base (eip155:8453)', asset: 'USDC', window_seconds: t.window, terms: `${b}/terms#s5a`, page: `${b}/reader#credit`,
    note: 'No account. Nothing is read on credit before a verified payment. The USDC goes from your wallet straight to the address above; the sea never holds anyone\'s money.' };
  const short = { scheme: 'exact', network: 'base', to: t.payTo, payTo: t.payTo, amount_usd: usd6(t.micro), decimals: 6, asset: 'USDC', maxTimeoutSeconds: t.window, credit: `${b}/reader#credit` };
  return new Response(JSON.stringify(body), { status: 402, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex', 'payment-required': b64(JSON.stringify(v2)), 'x402-payment-required': JSON.stringify(short), 'x-pay-to': t.payTo, 'x-settle-window': String(t.window), ...cors } });
}
// a payment for exactly the price: a signed USDC transfer (x402 "exact", EIP-3009) to the till's wallet of exactly 0.05 USDC,
// naming its wallet and nonce (so that it buys once). → null when it is that, else why not
const HEX40 = /^0x[0-9a-fA-F]{40}$/, HEX64 = /^0x[0-9a-fA-F]{64}$/;
export function creditExact(pay, t) {
  const p = pay?.payload, auth = p?.payload?.authorization;
  if (!auth || typeof auth !== 'object') return 'reader credit is paid with a signed USDC transfer on Base (x402 "exact", EIP-3009): this payment carries none';
  let v; try { v = BigInt(String(auth.value)); } catch { return 'the amount of this payment could not be read'; }
  if (v !== BigInt(t.atomic)) return `this payment is for ${usd6(Number(v))} USDC; reader credit costs exactly ${usd6(t.micro)} USDC: pay that sum`;
  if (pay?.version === 2 && p?.accepted?.amount != null && String(p.accepted.amount) !== t.atomic) return `this payment accepted ${usd6(Number(p.accepted.amount) || 0)} USDC; reader credit costs exactly ${usd6(t.micro)} USDC`;
  if (String(auth.to || '').toLowerCase() !== String(t.payTo || '').toLowerCase()) return `this payment goes to another wallet than ${t.payTo}`;
  if (!HEX40.test(String(auth.from || '')) || !HEX64.test(String(auth.nonce || ''))) return 'the signed transfer of this payment names no wallet (from) or no nonce: it is not taken';
  return null;
}
const payKey = (pay) => { const a = pay?.payload?.payload?.authorization; return createHash('sha256').update(`${String(a?.from || '').toLowerCase()}|${String(a?.nonce || '').toLowerCase()}`).digest('hex'); };

// the credit of a node, in its state: credit:t:<sha256 of the token> → { pages, left, until, at, sale, revoked? };
// credit:sale:<sale id> → the hash (to take back the credit of a payment that did not settle); credit:pay:<hash of wallet and
// nonce> → the payment bought once. Purchases and their taking back go to the disk at once (kv.setNow, node/disk.mjs), a page
// spent with the copy a minute later (a restart may give a page back, never take one).
export function createCredit({ kv, now = () => Date.now() }) {
  const chains = new Map();
  // one after the other per key: two reads with the same token never both spend the last page
  const serial = (k, fn) => { const prev = chains.get(k) || Promise.resolve(); const run = prev.then(fn, fn); const tail = run.then(() => {}, () => {}); chains.set(k, tail); tail.then(() => { if (chains.get(k) === tail) chains.delete(k); }); return run; };
  const put = async (k, v, ttl, soon = false) => { if (soon && typeof kv.setNow === 'function') { const r = kv.setNow(k, v, ttl); if (r !== false) return r; } return kv.set(k, v, ttl); };
  const T = (h) => `credit:t:${h}`, ttlOf = (until) => Math.max(DAY, Math.ceil((Date.parse(until) - now()) / 1000) + DAY);
  const state = (r) => (!r ? 'unknown' : r.revoked ? 'revoked' : Date.parse(r.until) <= now() ? 'expired' : !(r.left > 0) ? 'used up' : 'ok');
  return {
    // a payment buys once: taken for this purchase, or { used } when it bought (or is buying) before
    claim(pay) { const k = `credit:pay:${payKey(pay)}`; return serial(k, async () => { if (await kv.get(k)) return { used: true }; await put(k, { at: new Date(now()).toISOString() }, (CREDIT.days + 2) * DAY, true); return { key: k }; }); },
    // a purchase that was not taken (refused, no verdict): the payment may come again
    release(c) { if (!c?.key) return Promise.resolve(); return serial(c.key, () => put(c.key, null, 60, true)); },
    // the credit of one paid sale: the token, once
    async mint(sale) {
      const token = `${CREDIT_PREFIX}${randomBytes(24).toString('base64url')}`, h = tokenHash(token), t = now();
      const rec = { pages: CREDIT.pages, left: CREDIT.pages, until: new Date(t + CREDIT.days * DAY * 1000).toISOString(), at: new Date(t).toISOString(), sale: sale?.id || null };
      await serial(h, async () => { await put(T(h), rec, ttlOf(rec.until), true); if (sale?.id) await put(`credit:sale:${sale.id}`, h, (CREDIT.days + 2) * DAY, true); });
      return { token, pages: rec.pages, left: rec.left, until: rec.until };
    },
    // one page, where the free limit refuses: { ok, left, until } or { ok: false, why }
    spend(h) {
      return serial(h, async () => {
        const r = await kv.get(T(h)), s = state(r); if (s !== 'ok') return { ok: false, why: s, until: r?.until };
        r.left -= 1; await put(T(h), r, ttlOf(r.until)); return { ok: true, left: r.left, until: r.until };
      });
    },
    async peek(h) { const r = await kv.get(T(h)); return { state: state(r), ...(r ? { pages: r.pages, left: r.revoked ? 0 : r.left, until: r.until } : {}) }; },
    // the credit of a sale whose payment did not settle is taken back
    async revokeSale(id) {
      const h = await kv.get(`credit:sale:${id}`); if (!h) return false;
      return serial(h, async () => { const r = await kv.get(T(h)); if (!r) return false; r.revoked = true; r.left = 0; await put(T(h), r, ttlOf(r.until), true); return true; });
    },
  };
}
