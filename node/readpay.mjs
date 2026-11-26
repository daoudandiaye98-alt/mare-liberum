// Mare Liberum · the paid read (since 3.48, "Die Kasse fragt"): one web page as clean Markdown with its token count, one
// cent per page over x402, in one step. Why it exists: an x402 client pays only when a door answers 402 to a plain call,
// and the reader never did (it answers free, then a limit); so no agent with a wallet could ever pay the sea for what it
// uses most. This door answers 402 at the first call, the client pays by itself and gets the page in the same exchange.
//   price    exactly 0.01 USDC on Base (x402 "exact", EIP-3009) to the till's wallet; any other amount is not taken
//   order    the payment is checked as far as it can be without the facilitator (amount, wallet, nonce, time) and claimed
//            once (its wallet and nonce, the same claim as the reader credit's: a payment buys once, anywhere); then the
//            page is read; only a page that was read is sold: a page that cannot be read (robots.txt, an error) costs
//            nothing and the claim is given back. Then the till's own path (node/pay.mjs takePayment, strict: nothing is
//            delivered on a payment the facilitator gives no verdict on) verifies, delivers and settles
//   free     the reader stays free as before (/r/, 100 pages a day per network); this door does not count against it
//   found    the terms carry the x402 discovery metadata (v1 outputSchema, discoverable; v2 extensions.bazaar), so a
//            facilitator that settles a payment here can list the door in its catalog, and /openapi.json names it for
//            the indexes that read that (x402scan)
// The funnel (createFunnel) counts per UTC day how often each paid door asked (402) and was paid, in the node's state.
import { USDC_BASE } from './pricing.mjs';
import { TOKEN_RATIO, tokensOf } from './proof.mjs';

export const READPAY = Object.freeze({ cents: 1, micro: 10_000, path: '/x402/read' });
export const usd6 = (micro) => (Number(micro) / 1e6).toFixed(6);
export const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
const DAY = 86400;

// the call and its answer, for discovery catalogs (x402 "bazaar"): what to send and what comes back
export function readBazaar(base) {
  const b = String(base || '').replace(/\/+$/, '');
  return { info: {
    input: { type: 'http', method: 'GET', queryParams: { url: 'https://example.com/' } },
    output: { type: 'json', example: { url: 'https://example.com/', title: 'Example Domain', lang: 'en', markdown: '# Example Domain\n\nThis domain is for use in documentation examples…', tokens: { html: 160, markdown: 43, saved: 117, saved_pct: 73 }, paid: { amount_usd: '0.010000', status: 'settled', treasury: `${b}/treasury` } } },
  },
  // the same as JSON Schema (since 3.54): the indexes that build the call from the 402 itself (AgentCash, x402scan) read the
  // query parameters and the answer from here (schema.properties.input.properties.queryParams, …output.properties.example)
  schema: { $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object', required: ['input'], properties: {
    input: { type: 'object', required: ['type', 'method', 'queryParams'], properties: {
      type: { type: 'string', const: 'http' }, method: { type: 'string', enum: ['GET'] },
      queryParams: { type: 'object', required: ['url'], additionalProperties: false, properties: { url: { type: 'string', format: 'uri', description: 'the public page to read (http or https)' } } } } },
    output: { type: 'object', properties: {
      type: { type: 'string', const: 'json' },
      example: { type: 'object', required: ['url', 'markdown', 'tokens', 'paid'], properties: { url: { type: 'string' }, title: { type: 'string' }, description: { type: 'string' }, lang: { type: 'string' }, words: { type: 'number' }, markdown: { type: 'string', description: 'the page as Markdown' }, tokens: { type: 'object', properties: { html: { type: ['number', 'null'] }, markdown: { type: ['number', 'null'] }, saved: { type: ['number', 'null'] }, saved_pct: { type: ['number', 'null'] } } }, paid: { type: 'object', properties: { status: { type: 'string' }, amount_usd: { type: 'string' }, sale: { type: 'string' }, tx: { type: 'string' }, treasury: { type: 'string' } } } } } } } } } };
}

// the terms of one paid read, in both shapes x402 knows (as the paid route's, node/pay.mjs termsFor)
export function readTerms(cfg, { base, resource: at = null, method = 'GET' }) {
  // resource: the address the 402 stands on (since 3.54 the reader's own doors sell a page too, so a client pays and asks again
  // where it was); by default the paid read's door. Only that door is listed in the x402 indexes (discoverable, the bazaar
  // extension): a page bought at /r/ or at a scrape door is the same sale, and an index must not list every page as a service
  const b = String(base || '').replace(/\/+$/, ''), resource = at || `${b}${READPAY.path}`, atomic = String(READPAY.micro), listed = !at;
  const description = 'Mare Liberum: one public web page as clean, token-lean Markdown (robots.txt respected), with its token count against the raw HTML; 0.01 USDC per page, no account, no key';
  const extra = { name: 'USD Coin', version: '2' };
  const outputSchema = {
    input: listed ? { type: 'http', method: 'GET', discoverable: true, queryParams: { url: { type: 'string', required: true, description: 'the public page to read (http or https)' } } } : { type: 'http', method, discoverable: false },
    output: { type: 'object', properties: { url: { type: 'string' }, title: { type: 'string' }, markdown: { type: 'string', description: 'the page as Markdown' }, tokens: { type: 'object', description: 'html, markdown, saved, saved_pct (estimated with the calibrated ratio of /proof)' }, paid: { type: 'object' } } },
  };
  const v1 = { scheme: 'exact', network: 'base', maxAmountRequired: atomic, resource, description, mimeType: 'application/json', outputSchema, payTo: cfg.payTo, maxTimeoutSeconds: cfg.window, asset: USDC_BASE, extra };
  const v2 = { scheme: 'exact', network: 'eip155:8453', amount: atomic, asset: USDC_BASE, payTo: cfg.payTo, maxTimeoutSeconds: cfg.window, extra };
  return { cents: READPAY.cents, usd: READPAY.micro / 1e6, atomic, micro: READPAY.micro, resource, description, v1, v2, payTo: cfg.payTo, window: cfg.window, listed };
}

// the 402: the terms where every x402 client looks for them, and in words
export function readRequired(t, { base, error, cors = {} }) {
  const b = String(base || '').replace(/\/+$/, '');
  const v2 = { x402Version: 2, error: error || 'PAYMENT-SIGNATURE header is required', resource: { url: t.resource, description: t.description, mimeType: 'application/json' }, accepts: [t.v2], ...(t.listed === false ? {} : { extensions: { bazaar: readBazaar(b) } }) };
  const body = { x402Version: 1, error: error || 'X-PAYMENT header is required', accepts: [t.v1],
    amount_usd: usd6(t.micro), unit: 'USDC on Base, 6 decimals (maxAmountRequired is in millionths of a dollar)', what: t.description,
    call: `GET ${b}${READPAY.path}?url=<the page> (or POST {"url": "<the page>"}); an x402 client pays this 402 by itself and gets the page in the same exchange`,
    pay: ['x402 v2: call again with the header PAYMENT-SIGNATURE (the PAYMENT-REQUIRED header holds the terms, base64 JSON)', 'x402 v1: call again with the header X-PAYMENT (the terms are in "accepts" of this body)'],
    exact: 'a payment of exactly this amount; any other is not taken. A page that cannot be read (robots.txt, an error) is not charged',
    pay_to: t.payTo, network: 'Base (eip155:8453)', asset: 'USDC', window_seconds: t.window, terms: `${b}/terms#s4`, page: `${b}/reader`,
    note: 'No account, no key. The USDC goes from your wallet straight to the address above; the sea never holds anyone\'s money.' };
  const short = { scheme: 'exact', network: 'base', to: t.payTo, payTo: t.payTo, amount_usd: usd6(t.micro), decimals: 6, asset: 'USDC', maxTimeoutSeconds: t.window, read: `${b}${READPAY.path}` };
  return new Response(JSON.stringify(body), { status: 402, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex', 'payment-required': b64(JSON.stringify(v2)), 'x402-payment-required': JSON.stringify(short), 'x-pay-to': t.payTo, 'x-settle-window': String(t.window), link: `<${b}/reader>; rel="describedby"`, ...cors } });
}

// the reader's free limit as a 402 (since 3.54): the answer of before (its error, its words, the credit headers) with the terms of
// this one page beside it, so a client with x402 pays by itself and asks again; shape 'scrape' keeps the Firecrawl form
// ({success: false, code, error}), shape 'reader' the sea's ({error: {code, message}})
export function readLimitRequired(t, { base, shape = 'reader', code = 'RESOURCE_EXHAUSTED', message = '', headers = {}, cors = {} }) {
  const b = String(base || '').replace(/\/+$/, '');
  const v2 = { x402Version: 2, error: 'PAYMENT-SIGNATURE header is required', resource: { url: t.resource, description: t.description, mimeType: 'application/json' }, accepts: [t.v2], ...(t.listed === false ? {} : { extensions: { bazaar: readBazaar(b) } }) };
  const terms = { x402Version: 1, accepts: [t.v1], amount_usd: usd6(t.micro), unit: 'USDC on Base, 6 decimals (maxAmountRequired is in millionths of a dollar)',
    read_on: `this page for ${usd6(t.micro)} USDC in one step: an x402 client pays this 402 by itself and asks again (header X-PAYMENT, or PAYMENT-SIGNATURE with the PAYMENT-REQUIRED header); a page that cannot be read is not charged`,
    pay_to: t.payTo, network: 'Base (eip155:8453)', asset: 'USDC', window_seconds: t.window, terms: `${b}/terms#s4`,
    door: `GET ${b}${READPAY.path}?url=<the page>: the same page for the same cent, any time (the door listed in the x402 indexes)` };
  const body = shape === 'scrape' ? { success: false, code, error: message, ...terms } : { error: { code, message }, ...terms };
  const short = { scheme: 'exact', network: 'base', to: t.payTo, payTo: t.payTo, amount_usd: usd6(t.micro), decimals: 6, asset: 'USDC', maxTimeoutSeconds: t.window, read: t.resource };
  const expose = ['payment-required', 'x402-payment-required', ...Object.keys(headers).filter((k) => k !== 'link')].join(',');
  return new Response(JSON.stringify(body), { status: 402, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex', 'payment-required': b64(JSON.stringify(v2)), 'x402-payment-required': JSON.stringify(short), 'x-pay-to': t.payTo, 'x-settle-window': String(t.window), ...headers, ...cors, 'access-control-expose-headers': [cors['access-control-expose-headers'], expose].filter(Boolean).join(',') } });
}

// a payment for exactly the price: a signed USDC transfer (x402 "exact", EIP-3009) to the till's wallet of exactly 0.01 USDC,
// naming its wallet and nonce, ending within the terms' time and a minute. → null when it is that, else why not
const HEX40 = /^0x[0-9a-fA-F]{40}$/, HEX64 = /^0x[0-9a-fA-F]{64}$/;
// (since 3.56 the same check for each door sold at a fixed sum: exactFor('a paid check') for node/checkpay.mjs)
export const exactFor = (noun) => function exact(pay, t, nowMs = Date.now()) {
  const p = pay?.payload, auth = p?.payload?.authorization;
  if (!auth || typeof auth !== 'object') return `${noun} is paid with a signed USDC transfer on Base (x402 "exact", EIP-3009): this payment carries none`;
  let v; try { v = BigInt(String(auth.value)); } catch { return 'the amount of this payment could not be read'; }
  if (v !== BigInt(t.atomic)) return `this payment is for ${usd6(Number(v))} USDC; ${noun} costs exactly ${usd6(t.micro)} USDC: pay that sum`;
  if (pay?.version === 2 && p?.accepted?.amount != null && String(p.accepted.amount) !== t.atomic) return `this payment accepted ${usd6(Number(p.accepted.amount) || 0)} USDC; ${noun} costs exactly ${usd6(t.micro)} USDC`;
  if (String(auth.to || '').toLowerCase() !== String(t.payTo || '').toLowerCase()) return `this payment goes to another wallet than ${t.payTo}`;
  if (!HEX40.test(String(auth.from || '')) || !HEX64.test(String(auth.nonce || ''))) return 'the signed transfer of this payment names no wallet (from) or no nonce: it is not taken';
  const before = Number(auth.validBefore), most = Math.floor(nowMs / 1000) + (Number(t.window) || 300) + 60;
  if (!Number.isSafeInteger(before) || before > most) return `the signed transfer of this payment must end within ${(Number(t.window) || 300) + 60} seconds (validBefore): a longer one is not taken`;
  return null;
};
export const readExact = exactFor('a paid read');

// the page an agent wants, as an address the reader takes (http or https, at most 2000 characters) → the address or null
export function readTarget(x) {
  const s = String(x ?? '').trim();
  if (!s || s.length > 2000 || !/^https?:\/\/[^\s/?#]+\.[^\s/?#]+/i.test(s)) return null;
  try { const u = new URL(s); return /^https?:$/.test(u.protocol) ? u.toString() : null; } catch { return null; }
}

// what a page weighs for a model: its HTML and its Markdown in tokens, estimated with the calibrated ratio of /proof
export function tokensOfRead(r) {
  const md = typeof r?.markdown === 'string' ? r.markdown.length : null, bytes = Number(r?.htmlBytes) || null;
  const perByte = TOKEN_RATIO?.bytes?.html, html = bytes && perByte > 0 ? Math.round(bytes / perByte) : null, markdown = md == null ? null : tokensOf('markdown', md);
  const saved = html != null && markdown != null ? Math.max(0, html - markdown) : null;
  return { html, markdown, saved, saved_pct: saved != null && html > 0 ? Math.round((100 * saved) / html) : null, how: `estimated with the calibrated ratio of ${TOKEN_RATIO?.source || '/proof'} (${TOKEN_RATIO?.tokenizer || 'o200k_base'})` };
}

// the funnel of the paid doors, per UTC day in the node's state (funnel:<day>, kept 40 days): how often a door answered 402
// (asked: every 402 for a call without a payment, the probes of the x402 indexes included) and how often it was paid
// (a sale delivered, settled or still settling), and what was paid in millionths of a dollar
export function createFunnel({ kv, now = () => Date.now() }) {
  const day = () => new Date(now()).toISOString().slice(0, 10);
  let cur = null, curDay = null;
  const load = async (d) => { if (curDay === d && cur) return cur; const v = await kv.get(`funnel:${d}`); cur = v && typeof v === 'object' ? { asked: { ...(v.asked || {}) }, paid: { ...(v.paid || {}) }, micro: Number(v.micro) || 0 } : { asked: {}, paid: {}, micro: 0 }; curDay = d; return cur; };
  const bump = async (kind, door, micro = 0) => { const d = day(), c = await load(d); c[kind][door] = (c[kind][door] || 0) + 1; if (micro > 0) c.micro += micro; await kv.set(`funnel:${d}`, c, 40 * DAY); };
  return {
    asked: (door) => bump('asked', String(door)).catch(() => {}),
    paid: (door, micro) => bump('paid', String(door), Math.max(0, Number(micro) || 0)).catch(() => {}),
    async today() { const d = day(); const c = await load(d).catch(() => null); return { day: d, asked: { ...(c?.asked || {}) }, paid: { ...(c?.paid || {}) }, paid_usd: usd6(c?.micro || 0), what: 'per UTC day: asked = 402 answers of the paid doors to calls without a payment (index probes included), paid = sales delivered' }; },
  };
}
