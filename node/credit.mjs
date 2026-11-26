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
//   lost     (CR8) a sale whose settlement never answered (a lost facilitator answer, a restart between verify and settle)
//            stays open in credit:open with what the chain needs (wallet, nonce, validBefore of the signed transfer; never its
//            signature, never the token) until its word comes. On its own timer (at the start, then once a minute; never in a
//            request), once validBefore is past (and a minute) and the claim is ten minutes old, the toll's chain check
//            (node/toll.mjs authorizationUsed, MARE_BASE_RPC) is asked, at most 20 times a run: used, the sale is settled in
//            the till and the credit stays; not used, it can no longer be, so the credit is taken back; no clear answer, nothing
//            changes and it is asked again a minute later. With the chain check off (MARE_BASE_RPC=off) nothing is asked and
//            nothing taken back. A payment whose transfer holds longer than the terms' time and a minute is not taken.
import { createHash, randomBytes } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { USDC_BASE } from './pricing.mjs';
import { authorizationUsed } from './toll.mjs';

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
export function creditHint(base, why = null, { payNow = null } = {}) {
  const b = String(base || '').replace(/\/+$/, '');
  const said = why === 'expired' ? 'This credit has expired. ' : why === 'used up' ? 'This credit is used up. ' : why === 'unknown' || why === 'bad' ? 'This credit token is not known here. ' : why === 'revoked' ? 'This credit was taken back: its payment did not settle. ' : '';
  // (since 3.61) the sea's own ways come first in the limit answer (limitSaid below); at a 402 (payNow) the first way is to pay
  // this very page in the same request; a credit page counts only when the read brings Markdown back
  const first = payNow ? `Read on now: this answer is the x402 payment request for this page (${payNow} USDC on Base, paid in the same request), or with prepaid reader credit` : 'Read on with prepaid reader credit';
  return { line: `${said}${first}: POST ${b}/reader/credit over x402 (0.05 USDC on Base for 50 pages above the free limit, 30 days), or by card or Link: POST ${b}/reader/credit/stripe over MPP (0.50 USD for 500 pages, 30 days; for agents with a Link wallet also ?pack=10, ?pack=49 or ?pack=99: 10,000, 100,000 or 250,000 pages for 10, 49 or 99 USD, paid with mpp pay once their person approves; what a page saves, measured: ${b}/reader/credit/stripe), or as a business by card in the browser: ${b}/c/reader?from=limit (EUR 10 for 10,000 pages, 30 days), with bigger packs up to 12,000,000 pages at ${b}/reader/credit/paid#plans; then send x-sea-credit: <token> (${b}/reader#credit). A credit page counts only when the read brings Markdown back.`,
    headers: { 'x-sea-credit-buy': `${b}/reader/credit`, 'x-sea-credit-buy-card': `${b}/reader/credit/stripe`, 'x-sea-credit-buy-business': `${b}/c/reader?from=limit`, link: `<${b}/reader#credit>; rel="payment"` } };
}

// (since 3.61) the words of the limit answer: its first part, then how to read on here, then the word on Angel (node/lens.mjs
// keeps the parts apart); an error without the parts keeps its words with the line after them
export const limitSaid = (e, more) => (e?.limitLine ? `${e.limitLine} ${more.line}${e.alsoLine ? ` ${e.alsoLine}` : ''}` : `${e?.message} ${more.line}`);

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
// the call and its answer for discovery catalogs (x402 "bazaar", since 3.55): the indexes that build the call from the 402 itself
// (AgentCash, x402scan) read what to send and what comes back from here, as JSON Schema too
export function creditBazaar(base) {
  const b = String(base || '').replace(/\/+$/, '');
  return {
    info: {
      input: { type: 'http', method: 'POST', bodyType: 'json', body: {} },
      output: { type: 'json', example: { token: 'mlc_…', pages: CREDIT.pages, left: CREDIT.pages, until: '2026-12-26T00:00:00.000Z', use: `x-sea-credit: <token> on GET ${b}/r/<page>` } },
    },
    schema: { $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object', required: ['input'], properties: {
      input: { type: 'object', required: ['type', 'method'], properties: { type: { type: 'string', const: 'http' }, method: { type: 'string', enum: ['POST'] }, bodyType: { type: 'string', enum: ['json'] }, body: { type: 'object', properties: {}, additionalProperties: false, description: 'nothing to send: the payment is the request' } } },
      output: { type: 'object', properties: { type: { type: 'string', const: 'json' }, example: { type: 'object', required: ['token', 'pages', 'until'], properties: { token: { type: 'string', description: 'mlc_…, shown once: send it as x-sea-credit or as Authorization: Bearer' }, pages: { type: 'number' }, left: { type: 'number' }, until: { type: 'string' }, use: { type: 'string' } } } } } } },
  };
}
export function creditRequired(t, { base, error, cors = {} }) {
  const b = String(base || '').replace(/\/+$/, '');
  const v2 = { x402Version: 2, error: error || 'PAYMENT-SIGNATURE header is required', resource: { url: t.resource, description: t.description, mimeType: 'application/json' }, accepts: [t.v2], extensions: { bazaar: creditBazaar(b) } };
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
export function creditExact(pay, t, nowMs = Date.now()) {
  const p = pay?.payload, auth = p?.payload?.authorization;
  if (!auth || typeof auth !== 'object') return 'reader credit is paid with a signed USDC transfer on Base (x402 "exact", EIP-3009): this payment carries none';
  let v; try { v = BigInt(String(auth.value)); } catch { return 'the amount of this payment could not be read'; }
  if (v !== BigInt(t.atomic)) return `this payment is for ${usd6(Number(v))} USDC; reader credit costs exactly ${usd6(t.micro)} USDC: pay that sum`;
  if (pay?.version === 2 && p?.accepted?.amount != null && String(p.accepted.amount) !== t.atomic) return `this payment accepted ${usd6(Number(p.accepted.amount) || 0)} USDC; reader credit costs exactly ${usd6(t.micro)} USDC`;
  if (String(auth.to || '').toLowerCase() !== String(t.payTo || '').toLowerCase()) return `this payment goes to another wallet than ${t.payTo}`;
  if (!HEX40.test(String(auth.from || '')) || !HEX64.test(String(auth.nonce || ''))) return 'the signed transfer of this payment names no wallet (from) or no nonce: it is not taken';
  // (CR8) it must end within the terms' time (maxTimeoutSeconds) and a minute, as the toll's (node/toll.mjs authOf): once that
  // is past, the chain says for good whether it was carried out, so no sale stays open for long
  const before = Number(auth.validBefore), most = Math.floor(nowMs / 1000) + (Number(t.window) || 300) + 60;
  if (!Number.isSafeInteger(before) || before > most) return `the signed transfer of this payment must end within ${(Number(t.window) || 300) + 60} seconds (validBefore): a longer one is not taken`;
  return null;
}
const payKey = (pay) => { const a = pay?.payload?.payload?.authorization; return createHash('sha256').update(`${String(a?.from || '').toLowerCase()}|${String(a?.nonce || '').toLowerCase()}`).digest('hex'); };
// what the chain needs to be asked later about a payment (x402 v1 and v2 alike: paymentOf of node/pay.mjs reads both into
// payload.payload.authorization): the signing wallet, the nonce and validBefore of its signed transfer. Never its signature
const chainOf = (pay) => { const a = pay?.payload?.payload?.authorization, before = Number(a?.validBefore); return a && HEX40.test(String(a.from || '')) && HEX64.test(String(a.nonce || '')) && Number.isSafeInteger(before) ? { from: String(a.from), nonce: String(a.nonce).toLowerCase(), before } : null; };
// the sales whose settlement has not answered: credit:open → { v: 1, list: [{ sale, at, from, nonce, before }] }; one is looked at
// once validBefore and a minute are past and the claim is ten minutes old; at most ASK_MAX questions to the chain a run
const OPEN = 'credit:open', WAIT = 600_000, GRACE = 60_000, ASK_MAX = 20;
const openDue = (e) => Math.max(e.before * 1000 + GRACE, Date.parse(e.at) + WAIT);

// the credit of a node, in its state: credit:t:<sha256 of the token> → { pages, left, until, at, sale, revoked? };
// credit:sale:<sale id> → the hash (to take back the credit of a payment that did not settle); credit:pay:<hash of wallet and
// nonce> → the payment bought once. Purchases and their taking back go to the disk at once (kv.setNow, node/disk.mjs), a page
// spent with the copy a minute later (a restart may give a page back, never take one).
// ledger: the till's books (a sale the chain shows settled is set there as a settlement that answered); rpc: the toll's chain
// check (node/toll.mjs tollRpc; null: off, nothing asked, nothing taken back); sweepMs: the re-check's own timer (0: none)
export function createCredit({ kv, now = () => Date.now(), ledger = null, rpc = null, get = null, sweepMs = 0 }) {
  const chains = new Map();
  // one after the other per key: two reads with the same token never both spend the last page
  const serial = (k, fn) => { const prev = chains.get(k) || Promise.resolve(); const run = prev.then(fn, fn); const tail = run.then(() => {}, () => {}); chains.set(k, tail); tail.then(() => { if (chains.get(k) === tail) chains.delete(k); }); return run; };
  const put = async (k, v, ttl, soon = false) => { if (soon && typeof kv.setNow === 'function') { const r = kv.setNow(k, v, ttl); if (r !== false) return r; } return kv.set(k, v, ttl); };
  const T = (h) => `credit:t:${h}`, ttlOf = (until) => Math.max(DAY, Math.ceil((Date.parse(until) - now()) / 1000) + DAY);
  const state = (r) => (!r ? 'unknown' : r.revoked ? 'revoked' : Date.parse(r.until) <= now() ? 'expired' : !(r.left > 0) ? 'used up' : 'ok');
  // (CR8) the sales whose settlement has not answered, read once from the state and written at once on every change
  let open = null, openP = null, running = null;
  const counts = { runs: 0, asked: 0, settled: 0, revoked: 0, unclear: 0, expired: 0 }, lastAsked = new Map();
  const loadOpen = () => (open ? Promise.resolve(open) : (openP ||= (async () => {
    let v = null; try { v = await kv.get(OPEN); } catch {}
    const list = v && v.v === 1 && Array.isArray(v.list) ? v.list.filter((e) => e && typeof e.sale === 'string' && HEX40.test(String(e.from)) && HEX64.test(String(e.nonce)) && Number.isSafeInteger(e.before) && Date.parse(e.at)) : [];
    return (open = { v: 1, list });
  })()));
  const keepOpen = () => put(OPEN, open, (CREDIT.days + 2) * DAY, true);
  const closeOpen = async (id) => { await loadOpen(); const i = open.list.findIndex((e) => e.sale === id); if (i < 0) return false; open.list.splice(i, 1); lastAsked.delete(id); await keepOpen(); return true; };
  const book = {
    // a payment buys once: taken for this purchase, or { used } when it bought (or is buying) before; with it what the chain
    // needs to be asked later (wallet, nonce, validBefore; never the signature)
    claim(pay) { const k = `credit:pay:${payKey(pay)}`; return serial(k, async () => { if (await kv.get(k)) return { used: true }; await put(k, { at: new Date(now()).toISOString() }, (CREDIT.days + 2) * DAY, true); return { key: k, chain: chainOf(pay) }; }); },
    // a purchase that was not taken (refused, no verdict): the payment may come again
    release(c) { if (!c?.key) return Promise.resolve(); return serial(c.key, () => put(c.key, null, 60, true)); },
    // the credit of one paid sale: the token, once; the sale stays open until its settlement answers (written before the
    // settlement is asked for, so that a restart in between finds it)
    // (since 3.48 a pack may hold more pages: the card door of node/mpp.mjs sells 500 for 0.50 USD)
    // (since 3.55 the token may be given: derived from a payment whose page can be opened again, the operators' till of
    // node/checkout.mjs. A given token whose credit exists is never filled up again: its credit comes back as it stands,
    // with minted: false)
    // (since 3.60 a pack may run longer than 30 days: a year of the reader ladder runs 365, node/checkout.mjs TILL)
    async mint(sale, claim = null, pages = CREDIT.pages, given = null, days = CREDIT.days) {
      const own = given != null && CREDIT_RE.test(String(given));
      const token = own ? String(given) : `${CREDIT_PREFIX}${randomBytes(24).toString('base64url')}`, h = tokenHash(token), t = now();
      let rec = { pages, left: pages, until: new Date(t + (Number.isSafeInteger(days) && days > 0 ? days : CREDIT.days) * DAY * 1000).toISOString(), at: new Date(t).toISOString(), sale: sale?.id || null }, minted = true;
      await serial(h, async () => {
        if (own) { const old = await kv.get(T(h)); if (old) { rec = old; minted = false; return; } }
        await put(T(h), rec, ttlOf(rec.until), true); if (sale?.id) await put(`credit:sale:${sale.id}`, h, (CREDIT.days + 2) * DAY, true);
      });
      if (minted && sale?.id && claim?.chain) { await loadOpen(); open.list.push({ sale: sale.id, at: rec.at, ...claim.chain }); await keepOpen(); }
      return { token, pages: rec.pages, left: rec.revoked ? 0 : rec.left, until: rec.until, ...(own ? { minted } : {}) };
    },
    // the settlement answered: settled (the sale is closed, the credit stays)
    landed(id) { return closeOpen(id); },
    // one page, where the free limit refuses: { ok, left, until } or { ok: false, why }
    spend(h) {
      return serial(h, async () => {
        const r = await kv.get(T(h)), s = state(r); if (s !== 'ok') return { ok: false, why: s, until: r?.until };
        r.left -= 1; await put(T(h), r, ttlOf(r.until)); return { ok: true, left: r.left, until: r.until };
      });
    },
    // (since 3.61) one page back, for a read that brought no Markdown (node/lens.mjs, the acceptance test of reader credit):
    // never above the pages bought, never for a credit that was taken back or has run out of time
    back(h) {
      return serial(h, async () => {
        const r = await kv.get(T(h)); if (!r || r.revoked || Date.parse(r.until) <= now()) return { ok: false, why: state(r) };
        r.left = Math.min(r.pages, r.left + 1); await put(T(h), r, ttlOf(r.until)); return { ok: true, left: r.left, until: r.until };
      });
    },
    async peek(h) { const r = await kv.get(T(h)); return { state: state(r), ...(r ? { pages: r.pages, left: r.revoked ? 0 : r.left, until: r.until } : {}) }; },
    // the credit of a sale whose payment did not settle is taken back
    async revokeSale(id) {
      await closeOpen(id);
      const h = await kv.get(`credit:sale:${id}`); if (!h) return false;
      return serial(h, async () => { const r = await kv.get(T(h)); if (!r) return false; r.revoked = true; r.left = 0; await put(T(h), r, ttlOf(r.until), true); return true; });
    },
    // (CR8) the sales whose settlement never answered, once their time is past: the chain says whether the signed transfer was
    // carried out. Used: the money arrived, the sale is settled in the till, the credit stays. Not used (and validBefore past):
    // it can never be, the sale is unsettled and the credit taken back. No clear answer: nothing changes, counted, asked again
    // at the next run. At most ASK_MAX questions a run, the longest unasked first. Off (no rpc): nothing asked, nothing changed.
    // A known limit, as for the toll: USDC's authorizationState reads "used" also after the payer's cancelAuthorization, so a
    // transfer cancelled on chain whose settlement answer was lost as well counts as settled here
    async recheck() {
      if (running) return running;
      running = (async () => {
        await loadOpen(); counts.runs++;
        const t = now();
        // bounded: an entry still open when its token expires (a chain never clear, or the check off) goes then, counted; nothing
        // is left to take back, the till keeps the sale as it stands, and credit:open never holds more than 30 days of sales
        let expired = 0; for (const e of open.list.filter((x) => Date.parse(x.at) + CREDIT.days * DAY * 1000 <= t)) if (await closeOpen(e.sale)) { expired++; counts.expired++; }
        if (!rpc) return { asked: 0, off: true, expired, open: open.list.length };
        const due = open.list.filter((e) => t > openDue(e)).sort((a, b) => (lastAsked.get(a.sale) || 0) - (lastAsked.get(b.sale) || 0) || Date.parse(a.at) - Date.parse(b.at)).slice(0, ASK_MAX);
        let asked = 0, settled = 0, revoked = 0, unclear = 0;
        for (const e of due) {
          asked++; counts.asked++; lastAsked.set(e.sale, t);
          const word = await authorizationUsed({ rpc, from: e.from, nonce: e.nonce, ...(get ? { get } : {}) });
          if (word === true) { await closeOpen(e.sale); ledger?.saleSet?.(e.sale, { status: 'settled', settled_at: new Date(now()).toISOString() }); settled++; counts.settled++; }
          else if (word === false) { ledger?.saleSet?.(e.sale, { status: 'unsettled' }); await book.revokeSale(e.sale); revoked++; counts.revoked++; }
          else { unclear++; counts.unclear++; }
        }
        return { asked, settled, revoked, unclear, expired, open: open.list.length };
      })().finally(() => { running = null; });
      return running;
    },
    state: () => ({ open: open ? open.list.length : null, ...counts }),
    close() { if (timer) clearInterval(timer); },
  };
  // the re-check on its own timer, once a minute (it keeps no process alive); never in the path of a request
  const timer = sweepMs > 0 ? setInterval(() => { book.recheck().catch(() => {}); }, sweepMs) : null; timer?.unref?.();
  return book;
}
