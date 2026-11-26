// Mare Liberum · the paid pilot (since 3.59, "Der Lotse"; node/pack.mjs): a website, its documentation or a PDF asked a
// question, answered with the passages that answer it, each with its source, cut to the agent's token budget, over x402 in
// one step. Why it is sold: it does what an agent would otherwise pay for many times over, in tokens and in calls (finding
// the pages, reading up to 40 of them, throwing out menus and repeats, choosing what answers), and it costs the sea work.
//   price    exactly 0.05 USDC on Base (x402 "exact", EIP-3009) to the till's wallet; any other amount is not taken
//   order    as the paid check's (node/checkpay.mjs): the payment checked as far as it can be without the facilitator and
//            claimed once (a payment buys once, anywhere); then the pack is made; only a pack with passages is sold: a site
//            that cannot be read, or pages that hold none of the question's words, cost nothing and the claim is given back.
//            Then the till's own path (node/pay.mjs takePayment, strict) verifies, delivers and settles
//   free     /pack gives 3 packs an hour per network (up to 8 pages and 4,000 tokens each); past that its answer is a 402 with
//            the terms of that pack (not listed in the indexes), and one payment there buys it where it was asked
//   found    only GET /x402/pack is listed in the x402 indexes (discoverable, the bazaar extension with JSON Schema)
import { USDC_BASE } from './pricing.mjs';
import { usd6, b64, exactFor } from './readpay.mjs';
import { PACK } from './pack.mjs';

export const PACKPAY = Object.freeze({ cents: 5, micro: 50_000, path: '/x402/pack', free: '/pack', perHour: 3 });

const WHAT = `Mare Liberum, the pilot: ask a website, its documentation or a PDF a question and get the passages that answer it, each with its source and a link to the passage, cut to your token budget. It finds the pages itself (llms.txt, the sitemap, the links), reads up to ${PACK.paid.pages} of them (robots.txt respected, PDFs too), removes menus and repeats, ranks every passage (BM25, no language model) and checks each for prompt injection; 0.05 USDC per pack, no account, no key`;

// the call and its answer, for discovery catalogs (x402 "bazaar"), also as JSON Schema (AgentCash and x402scan build the call
// from schema.properties.input.properties.queryParams and read the answer from …output.properties.example)
export function packBazaar(base) {
  return {
    info: {
      input: { type: 'http', method: 'GET', queryParams: { url: 'https://docs.example.com/api/', q: 'how do I authenticate requests', tokens: '4000' } },
      output: { type: 'json', example: {
        url: 'https://docs.example.com/api/', q: 'how do I authenticate requests', tokens: { budget: 4000, used: 1830 }, pages: { found: 212, read: 31, used: 4, failed: 0 },
        sources: [{ n: 1, url: 'https://docs.example.com/api/authentication', title: 'Authentication' }],
        passages: [{ source: 1, url: 'https://docs.example.com/api/authentication#:~:text=Send%20your%20key%20in%20the%20Authorization%20header', heading: 'Authentication › API keys', text: 'Send your key in the Authorization header: …', tokens: 64, score: 7.31 }],
        markdown: '# Context pack: how do I authenticate requests\n…', warden: { flagged: false, passages: [] }, paid: { status: 'settled', amount_usd: '0.050000' } } },
    },
    schema: { $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object', required: ['input'], properties: {
      input: { type: 'object', required: ['type', 'method', 'queryParams'], properties: {
        type: { type: 'string', const: 'http' }, method: { type: 'string', enum: ['GET'] },
        queryParams: { type: 'object', required: ['url'], additionalProperties: false, properties: {
          url: { type: 'string', format: 'uri', description: 'the website, the part of it (a docs section) or the PDF to ask' },
          q: { type: 'string', description: 'the question; without it the pack is that part of the site in its own order' },
          tokens: { type: 'string', description: `the token budget of the answer, 500 to ${PACK.paid.tokens} (default ${PACK.paid.dflt})` } } } } },
      output: { type: 'object', properties: {
        type: { type: 'string', const: 'json' },
        example: { type: 'object', required: ['passages', 'sources', 'markdown', 'paid'], properties: {
          passages: { type: 'array', description: 'the passages that answer, best first by page: source, url (opens the page at the passage), heading, text, tokens, score' },
          sources: { type: 'array', description: 'the pages the passages come from: n, url, title' },
          markdown: { type: 'string', description: 'the whole pack as one Markdown text with [n] source marks' },
          tokens: { type: 'object' }, pages: { type: 'object' }, warden: { type: 'object', description: 'passages that read like instructions to an AI (prompt injection), named, never changed' }, paid: { type: 'object' } } } } } } },
  };
}

// the terms of one paid pack, in both shapes x402 knows; resource: where the 402 stands (the free /pack past its limit sells
// the pack there too, then not listed in the indexes)
export function packTerms(cfg, { base, resource: at = null }) {
  const b = String(base || '').replace(/\/+$/, ''), resource = at || `${b}${PACKPAY.path}`, atomic = String(PACKPAY.micro), listed = !at;
  const extra = { name: 'USD Coin', version: '2' };
  const outputSchema = {
    input: listed ? { type: 'http', method: 'GET', discoverable: true, queryParams: { url: { type: 'string', required: true, description: 'the website, docs section or PDF to ask' }, q: { type: 'string', required: false, description: 'the question' }, tokens: { type: 'string', required: false, description: `token budget, 500 to ${PACK.paid.tokens}` } } } : { type: 'http', method: 'GET', discoverable: false },
    output: { type: 'object', properties: { passages: { type: 'array' }, sources: { type: 'array' }, markdown: { type: 'string' }, tokens: { type: 'object' }, warden: { type: 'object' }, paid: { type: 'object' } } },
  };
  const v1 = { scheme: 'exact', network: 'base', maxAmountRequired: atomic, resource, description: WHAT, mimeType: 'application/json', outputSchema, payTo: cfg.payTo, maxTimeoutSeconds: cfg.window, asset: USDC_BASE, extra };
  const v2 = { scheme: 'exact', network: 'eip155:8453', amount: atomic, asset: USDC_BASE, payTo: cfg.payTo, maxTimeoutSeconds: cfg.window, extra };
  return { cents: PACKPAY.cents, usd: PACKPAY.micro / 1e6, atomic, micro: PACKPAY.micro, resource, description: WHAT, v1, v2, payTo: cfg.payTo, window: cfg.window, listed };
}

// the 402: the terms where every x402 client looks for them, and in words; with message (the free door past its limit) the
// sea's error stands beside the terms
export function packRequired(t, { base, error, message = null, code = 'RESOURCE_EXHAUSTED', cors = {} }) {
  const b = String(base || '').replace(/\/+$/, '');
  const v2 = { x402Version: 2, error: error || 'PAYMENT-SIGNATURE header is required', resource: { url: t.resource, description: t.description, mimeType: 'application/json' }, accepts: [t.v2], ...(t.listed === false ? {} : { extensions: { bazaar: packBazaar(b) } }) };
  const words = { x402Version: 1, accepts: [t.v1], amount_usd: usd6(t.micro), unit: 'USDC on Base, 6 decimals (maxAmountRequired is in millionths of a dollar)', what: t.description,
    call: `GET ${b}${PACKPAY.path}?url=<site, docs section or PDF>&q=<your question>&tokens=<budget> (or POST {"url": …, "q": …, "tokens": …}); an x402 client pays this 402 by itself and gets the pack in the same exchange`,
    pay: ['x402 v2: call again with the header PAYMENT-SIGNATURE (the PAYMENT-REQUIRED header holds the terms, base64 JSON)', 'x402 v1: call again with the header X-PAYMENT (the terms are in "accepts" of this body)'],
    exact: 'a payment of exactly this amount; any other is not taken. A site that cannot be read, or pages that hold none of the words of the question, are not charged',
    free: `${b}${PACKPAY.free}?url=…&q=… gives ${PACKPAY.perHour} packs an hour per network (up to ${PACK.free.pages} pages and ${PACK.free.tokens} tokens each)`,
    pay_to: t.payTo, network: 'Base (eip155:8453)', asset: 'USDC', window_seconds: t.window, terms: `${b}/terms#s4`,
    note: 'No account, no key. The USDC goes from your wallet straight to the address above; the sea never holds anyone\'s money.' };
  const body = message ? { error: { code, message }, ...words } : { error: error || 'X-PAYMENT header is required', ...words };
  const short = { scheme: 'exact', network: 'base', to: t.payTo, payTo: t.payTo, amount_usd: usd6(t.micro), decimals: 6, asset: 'USDC', maxTimeoutSeconds: t.window, pack: t.resource };
  const expose = 'payment-required,x402-payment-required';
  return new Response(JSON.stringify(body), { status: 402, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex', 'payment-required': b64(JSON.stringify(v2)), 'x402-payment-required': JSON.stringify(short), 'x-pay-to': t.payTo, 'x-settle-window': String(t.window), link: `<${b}${PACKPAY.free}>; rel="describedby"`, ...cors, 'access-control-expose-headers': [cors['access-control-expose-headers'], expose].filter(Boolean).join(',') } });
}

// a payment for exactly the price (as the paid read's: amount, wallet, nonce, time)
export const packExact = exactFor('a paid pack');
