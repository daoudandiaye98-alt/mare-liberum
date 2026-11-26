// Mare Liberum · the paid check (since 3.56, "Der bezahlte Blick"): how AI agents see a website, as data, for 0.05 USDC over
// x402 in one step. Why it exists: the check is the second thing agents use the sea for, and like the reader it only gave
// itself away (20 checks an hour per network, then a limit). Machines that audit sites in series (SEO and GEO tools, agents
// that prepare a site for agents) had no way to pay for more; an x402 client pays only where a door answers 402.
//   price    exactly 0.05 USDC on Base (x402 "exact", EIP-3009) to the till's wallet; any other amount is not taken
//   order    as the paid read's (node/readpay.mjs): the payment checked as far as it can be without the facilitator and
//            claimed once (the same claim as the reader credit's: a payment buys once, anywhere); then the site is checked;
//            only a site that answered is sold: an unreachable or invalid site costs nothing and the claim is given back.
//            Then the till's own path (node/pay.mjs takePayment, strict) verifies, delivers and settles
//   free     /check stays free as before (20 checks an hour per network); past that its JSON answer is a 402 with the terms
//            of that site (since 3.56), and one payment of exactly 0.05 USDC there buys the check where it was asked
//   found    only GET /x402/check is listed in the x402 indexes (discoverable, the bazaar extension with JSON Schema)
import { USDC_BASE } from './pricing.mjs';
import { usd6, b64, exactFor } from './readpay.mjs';

export const CHECKPAY = Object.freeze({ cents: 5, micro: 50_000, path: '/x402/check' });

// the call and its answer, for discovery catalogs (x402 "bazaar"), also as JSON Schema (AgentCash and x402scan build the call
// from schema.properties.input.properties.queryParams and read the answer from …output.properties.example)
export function checkBazaar(base) {
  const b = String(base || '').replace(/\/+$/, '');
  return {
    info: {
      input: { type: 'http', method: 'GET', queryParams: { site: 'example.com' } },
      output: { type: 'json', example: { host: 'example.com', score: 64, grade: 'C', parts: { robots: 'all 18 AI agents may read', llms_txt: false, agent_card: false, sitemap: true, text_without_js: true }, fixes: ['publish /llms.txt: what the site is and where its main pages are'], page: `${b}/check/example.com`, paid: { amount_usd: '0.050000', status: 'settled', treasury: `${b}/treasury` } } },
    },
    schema: { $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object', required: ['input'], properties: {
      input: { type: 'object', required: ['type', 'method', 'queryParams'], properties: {
        type: { type: 'string', const: 'http' }, method: { type: 'string', enum: ['GET'] },
        queryParams: { type: 'object', required: ['site'], additionalProperties: false, properties: { site: { type: 'string', description: 'the website to check: a domain such as example.com, or an address on it' } } } } },
      output: { type: 'object', properties: {
        type: { type: 'string', const: 'json' },
        example: { type: 'object', required: ['host', 'score', 'paid'], properties: { host: { type: 'string' }, score: { type: 'number', description: 'out of 100' }, grade: { type: 'string' }, parts: { type: 'object' }, agents: { type: 'object' }, fixes: { type: 'array', items: { type: 'string' } }, page: { type: 'string' }, paid: { type: 'object', properties: { status: { type: 'string' }, amount_usd: { type: 'string' }, sale: { type: 'string' }, tx: { type: 'string' }, treasury: { type: 'string' } } } } } } } } },
  };
}

// the terms of one paid check, in both shapes x402 knows; resource: where the 402 stands (the free /check past its limit
// sells the check there too, then not listed in the indexes)
export function checkTerms(cfg, { base, resource: at = null }) {
  const b = String(base || '').replace(/\/+$/, ''), resource = at || `${b}${CHECKPAY.path}`, atomic = String(CHECKPAY.micro), listed = !at;
  const description = 'Mare Liberum: how AI agents see a website, as data: robots.txt rules for 18 AI agents, llms.txt, agent card, MCP card, sitemap and the text without JavaScript, with a score out of 100 and the fixes; 0.05 USDC per check, no account, no key';
  const extra = { name: 'USD Coin', version: '2' };
  const outputSchema = {
    input: listed ? { type: 'http', method: 'GET', discoverable: true, queryParams: { site: { type: 'string', required: true, description: 'the website to check, e.g. example.com' } } } : { type: 'http', method: 'GET', discoverable: false },
    output: { type: 'object', properties: { host: { type: 'string' }, score: { type: 'number' }, grade: { type: 'string' }, parts: { type: 'object' }, fixes: { type: 'array' }, paid: { type: 'object' } } },
  };
  const v1 = { scheme: 'exact', network: 'base', maxAmountRequired: atomic, resource, description, mimeType: 'application/json', outputSchema, payTo: cfg.payTo, maxTimeoutSeconds: cfg.window, asset: USDC_BASE, extra };
  const v2 = { scheme: 'exact', network: 'eip155:8453', amount: atomic, asset: USDC_BASE, payTo: cfg.payTo, maxTimeoutSeconds: cfg.window, extra };
  return { cents: CHECKPAY.cents, usd: CHECKPAY.micro / 1e6, atomic, micro: CHECKPAY.micro, resource, description, v1, v2, payTo: cfg.payTo, window: cfg.window, listed };
}

// the 402: the terms where every x402 client looks for them, and in words; with message (the free door past its limit) the
// sea's error of before stands beside the terms
export function checkRequired(t, { base, error, message = null, code = 'RESOURCE_EXHAUSTED', cors = {} }) {
  const b = String(base || '').replace(/\/+$/, '');
  const v2 = { x402Version: 2, error: error || 'PAYMENT-SIGNATURE header is required', resource: { url: t.resource, description: t.description, mimeType: 'application/json' }, accepts: [t.v2], ...(t.listed === false ? {} : { extensions: { bazaar: checkBazaar(b) } }) };
  const words = { x402Version: 1, accepts: [t.v1], amount_usd: usd6(t.micro), unit: 'USDC on Base, 6 decimals (maxAmountRequired is in millionths of a dollar)', what: t.description,
    call: `GET ${b}${CHECKPAY.path}?site=<domain> (or POST {"site": "<domain>"}); an x402 client pays this 402 by itself and gets the check in the same exchange`,
    pay: ['x402 v2: call again with the header PAYMENT-SIGNATURE (the PAYMENT-REQUIRED header holds the terms, base64 JSON)', 'x402 v1: call again with the header X-PAYMENT (the terms are in "accepts" of this body)'],
    exact: 'a payment of exactly this amount; any other is not taken. A site that cannot be checked (unreachable, not a website) is not charged',
    pay_to: t.payTo, network: 'Base (eip155:8453)', asset: 'USDC', window_seconds: t.window, terms: `${b}/terms#s4`, page: `${b}/check`,
    note: 'No account, no key. The USDC goes from your wallet straight to the address above; the sea never holds anyone\'s money.' };
  const body = message ? { error: { code, message }, ...words } : { error: error || 'X-PAYMENT header is required', ...words };
  const short = { scheme: 'exact', network: 'base', to: t.payTo, payTo: t.payTo, amount_usd: usd6(t.micro), decimals: 6, asset: 'USDC', maxTimeoutSeconds: t.window, check: t.resource };
  const expose = 'payment-required,x402-payment-required';
  return new Response(JSON.stringify(body), { status: 402, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex', 'payment-required': b64(JSON.stringify(v2)), 'x402-payment-required': JSON.stringify(short), 'x-pay-to': t.payTo, 'x-settle-window': String(t.window), link: `<${b}/check>; rel="describedby"`, ...cors, 'access-control-expose-headers': [cors['access-control-expose-headers'], expose].filter(Boolean).join(',') } });
}

// a payment for exactly the price (as the paid read's: amount, wallet, nonce, time)
export const checkExact = exactFor('a paid check');

// the site an agent names, as the check takes it: a domain or an address on it (http or https) → the host, or null
export function checkTarget(x) {
  let s = String(x ?? '').trim().toLowerCase();
  if (!s || s.length > 300) return null;
  if (!/^https?:\/\//.test(s)) s = `https://${s}`;
  let host; try { host = new URL(s).hostname; } catch { return null; }
  host = host.replace(/^www\./, '').replace(/\.$/, '');
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) || /^\d+(\.\d+)+$/.test(host) || host.length > 253) return null;
  return host;
}
