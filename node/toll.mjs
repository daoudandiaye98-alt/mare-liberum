// Mare Liberum · the harbour toll (since 3.37, "Der Hafenzoll"): a share of what the lossless levers save, above a free quota
// The owner's rule (25.11.2026, "Freikontingent + Zoll"; the quota 10,000 since the night of 25./26.11., "fair for customers and
// fair for us"): up to 10,000 saved tokens per network and UTC day stay free (config/toll.json). Above
// that an agent pays 20 % of what a lossless lever measurably saved it, at the mid price of the ledger of /savings (USD 2 per
// million input tokens), automatically over x402. Nobody is blocked: an agent that does not pay gets the normal answer, the
// lever simply not applied. The numbers live in config/toll.json; the text every page says is made here from them.
//   tolled       the lossless saving of one answer, measured by the one rule of savingOf (node/engine.mjs), the very numbers the
//                ledger of /savings is handed for it: TOON instead of compact JSON (fmt=toon, an Accept that prefers text/toon,
//                the text of a tool result on /mcp/lean), a page read again as its change or as a 304 (/r/ since=,
//                If-None-Match), the lossless steps of POST /compress. Per answer: the ledger counts a saving once a day per
//                network and subject (and that rule stays as it is); the toll counts every answer that saved
//   never        the lossy levers (fields=, budget=, the q and budget of /compress: they act while the toll is due, on the answer
//                or the text as it is without the lossless lever); tools/list and the short tool list of /mcp/lean; HEAD (no
//                body), but for a 304: a HEAD of /r/ answered 304 is the 304 lever, as for a GET (since 3.37.1); the app door
//                /mcp/app; /via/ (its payments are the providers'); the till's own doors. No caller is told apart by its name:
//                every network has the same free quota
//   network      an IPv4 address, or an IPv6 /48 (the free quota and the open sum belong to it, per UTC day)
//   the price    micro-USD of an answer = floor(tokens above the quota × share × usdPerMillion), in whole numbers (no floating
//                point); the open sum is the exact sum of the prices the answers named. An answer whose price is 0 (two tokens
//                or fewer above the quota) is not tolled at all
//   settling     below settleAtUsd the toll accrues, and every tolled answer says so (x-sea-toll and its companions). From
//                settleAtUsd the next lever answer asks: a caller that pays (x-sea-toll: pay, or an x402 payment header that pays
//                the till's wallet exactly the open sum) gets 402 with the x402 terms of the open sum (exact, USDC on Base, the
//                till's wallet) and, after a payment that settled, the lever answer; any other caller gets the normal answer and
//                the headers say how to settle. A payment header that pays anything else is not the toll's and is left alone.
//                POST /fair/pay?r=<toll id> settles the same sum at any time from 0.05 USD, from the network the toll belongs to
//   payments     taken through the till's own path (node/pay.mjs takePayment: the same checks and facilitator), strict: a
//                payment the facilitator gives no verdict on is not taken (402, try again). Only a payment that settled clears
//                a toll. One verified and still settling holds it (never asked twice); when its settlement does not come back
//                within the terms' time (and for every one found on its way when a node starts), the chain is asked: USDC's
//                authorizationState on Base says whether the signed transfer was carried out (settled) or can no longer be
//                (released, the toll open again). Nothing is released without that word (since 3.37.2): while Base cannot be
//                asked, the payment stays held and Base is asked again, ever later; meanwhile the lever answers go on, what they
//                save accrues, and nothing is asked. A payment refused, failed or used before clears nothing
//   the books    the toll's own, in this node's state (toll:books): never in the database's sales, never in fair share, never in
//                the paid move; shown under toll on /treasury and /open.json, exact to the millionth
//   switch       on by default. MARE_TOLL=off switches a node off; "toll" in rest of immune:policy pauses it without a release;
//                it rests too while the till rests or cannot settle (no wallet, or no facilitator to tell a payment from a
//                forged one), and without a server secret to key its accounts. Off or resting, it asks nothing and every
//                lever answer is what it was in 3.36
// The state per network and day is kept in the node's kv under an HMAC of the network with a key of that UTC day, derived from
// a server secret (MARE_VIA_SECRET, else MARE_DB_SECRET): no address and no key is written down. A payment's state goes to the
// disk at once (kv.setNow, node/disk.mjs), the rest with the copy a minute after a change and on every stop: a restart forgets
// no payment, and no settled toll is asked for again.
import { readFileSync } from 'node:fs';
import { createHash, createHmac, hkdfSync, randomBytes } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { TOKEN_PRICE } from './areas.mjs';
import { USDC_BASE } from './pricing.mjs';
import { paymentOf, takePayment } from './pay.mjs';
import { netKey } from './guard.mjs';

export const TOLL_VERSION = 'toll-1';
export const TOLL_FILE = new URL('../config/toll.json', import.meta.url);
// the bounds of each value: share at most 20 % (the agent keeps at least 80 % of every saving, as with fair share), the
// settlement never below the smallest sum the facilitator's fee allows (node/fair.mjs FAIR.minMicro), a price within the rate
// card of /savings
const LIMITS = { freeTokensPerNetworkPerDay: [0, 1e9], share: [1e-6, 0.2], settleAtUsd: [0.05, 10], usdPerMillion: [1e-6, TOKEN_PRICE.high] };
export const TOLL_DEFAULTS = Object.freeze({ freeTokensPerNetworkPerDay: 100_000, share: 0.2, settleAtUsd: 0.05, usdPerMillion: TOKEN_PRICE.mid });
// the values of config/toll.json, each checked; one out of its range falls back to its default (and says so in .fallback)
export function tollConfig(raw) {
  const c = raw && typeof raw === 'object' ? raw : {}, fallback = [];
  const pick = (k) => { const v = Number(c[k]), [lo, hi] = LIMITS[k]; if (Number.isFinite(v) && v >= lo && v <= hi) return v; fallback.push(k); return TOLL_DEFAULTS[k]; };
  const free = Math.floor(pick('freeTokensPerNetworkPerDay')), share = pick('share'), settleAtUsd = pick('settleAtUsd'), usdPerMillion = pick('usdPerMillion');
  // whole numbers for the arithmetic: millionths of the share and of the price, millionths of a dollar for the settlement
  return Object.freeze({ free, share, settleAtUsd, usdPerMillion, shareE6: Math.round(share * 1e6), priceE6: Math.round(usdPerMillion * 1e6), settleMicro: Math.round(settleAtUsd * 1e6), fallback: Object.freeze(fallback) });
}
export function loadTollConfig(file = TOLL_FILE) { let raw = null; try { raw = JSON.parse(readFileSync(file, 'utf8')); } catch {} return tollConfig(raw); }
export const TOLL = loadTollConfig();

// on unless a node is switched off (cfg.toll or MARE_TOLL: off, 0, false, no); resting is asked of the immune system in core.mjs
export const tollSwitch = (cfg = {}, env = globalThis.process?.env || {}) => !/^(off|0|false|no)$/i.test(String(cfg.toll ?? env.MARE_TOLL ?? '').trim());
// the server secret the keys of the accounts come from: MARE_VIA_SECRET, else MARE_DB_SECRET, at least 16 characters (as
// node/via.mjs takes it). Without one the toll rests: no account is kept under a key that could be guessed
export const tollSecret = (env = globalThis.process?.env || {}) => { const s = String(env.MARE_VIA_SECRET || env.MARE_DB_SECRET || ''); return s.length >= 16 ? s : null; };
// one network: an IPv4 address, or an IPv6 /48 (the /64 of node/guard.mjs netKey, cut to its first three groups)
export function tollNet(ip) {
  const k = netKey(ip || 'unknown'), m = /^([0-9a-f]{1,4}):([0-9a-f]{1,4}):([0-9a-f]{1,4}):[0-9a-f]{1,4}::\/64$/.exec(k);
  return m ? `${m[1]}:${m[2]}:${m[3]}::/48` : k;
}

// what tokens above the quota cost, in millionths of a dollar, rounded down: floor(tokens × share × usdPerMillion)
export function microOf(tokens, C = TOLL) {
  const t = Math.max(0, Math.floor(Number(tokens) || 0));
  return t ? Number((BigInt(t) * BigInt(C.shareE6) * BigInt(C.priceE6)) / 1_000_000_000_000n) : 0;
}
export const usd6 = (micro) => (Math.max(0, Number(micro) || 0) / 1e6).toFixed(6);
const n = (x) => Number(x || 0).toLocaleString('en-US');
const pct = (C) => `${Math.round(C.share * 1e4) / 100} %`;
const money = (usd) => `$${Number(usd) >= 0.01 && Math.round(usd * 100) === usd * 100 ? Number(usd).toFixed(2) : String(Number(usd))}`;
export const TOLL_ID = /^t\d{8}[a-z0-9]{8}$/;
export const TOLL_META = 'mareliberum.dev/toll';
export const TOLL_EXPOSE = 'x-sea-toll,x-sea-toll-state,x-sea-toll-usd,x-sea-toll-tokens,x-sea-toll-open-usd,x-sea-toll-id';
// the example every page gives: a page of 9,128 tokens read again with since=, answered by the line that it is unchanged
export const TOLL_EXAMPLE = Object.freeze({ page: 9128, saved: 9077 });

// ------------------------------------------------------------------ the facts, in the words every page says them
export function tollFacts(base = '', C = TOLL) {
  const ex = microOf(TOLL_EXAMPLE.saved, C), per = Math.ceil(C.settleMicro / Math.max(1, ex));
  return {
    version: TOLL_VERSION,
    rule: `Up to ${n(C.free)} saved tokens per network and UTC day stay free. Above that, an answer a lossless lever shaped costs ${pct(C)} of the tokens it saved, at USD ${C.usdPerMillion} per million (the mid price of /savings), rounded down to the millionth of a dollar.`,
    // the one line where a page names the toll beside other prices (/pricing)
    line: `Up to ${n(C.free)} tokens saved by the lossless levers stay free per network and UTC day; above that an answer costs ${pct(C)} of the tokens it saved, at USD ${C.usdPerMillion} per million, settled over x402 in one payment from ${money(C.settleAtUsd)}; without payment the lean answers pause and the normal answers continue, and unpaid tolls are not collected.`,
    formula: `toll of an answer = ${C.share} × the tokens its lossless lever saved above the free quota × USD ${C.usdPerMillion} / 1,000,000, rounded down to the millionth; the open sum is the sum of these, exactly`,
    network: 'a network is one IPv4 address or one IPv6 /48; its free quota and its open sum are kept per UTC day',
    levers: 'the lossless levers only: TOON instead of JSON (fmt=toon, Accept: text/toon, the text of a tool result on /mcp/lean), a page read again as its change or a 304 (/r/<address>?since=<etag>, If-None-Match; a 304 to a HEAD the same as to a GET), the lossless steps of POST /compress; measured by the one rule of /engine, the same numbers the ledger of /savings is handed (the ledger counts a saving once a day per network and subject; the toll counts every answer that saved)',
    free: `the lossy levers (fields=, budget=, a question or a budget on /compress: they act while the toll is due as well, on the answer or the text as it comes without the lossless lever), tools/list and the short tool list of /mcp/lean, every other door, an answer whose toll would round down to $0.000000, and the first ${n(C.free)} saved tokens of each network a day`,
    example: `Example: an agent reads a page of ${n(TOLL_EXAMPLE.page)} tokens again with since= and gets the one line that says it is unchanged: ${n(TOLL_EXAMPLE.saved)} tokens saved. Above the free quota that answer costs ${C.share} × ${n(TOLL_EXAMPLE.saved)} × $${C.usdPerMillion} / 1,000,000 = $${usd6(ex)} (about $${(ex / 1e6).toFixed(4)}). The toll is settled once the open sum reaches ${money(C.settleAtUsd)}, about ${n(per)} such answers. An agent without a wallet gets the normal answer: the whole page.`,
    settle: `The toll accrues per answer; up to ${money(C.settleAtUsd)} may accrue before payment (the answer that reaches it is delivered, so the sum asked can be that one answer's toll above it). From ${money(C.settleAtUsd)} it is settled in one x402 payment of the exact open sum, USDC on Base to the till's wallet: send the header x-sea-toll: pay with a lever request (the answer is 402 with the terms; pay it and the lever answer comes), or POST ${base}/fair/pay?r=<toll id> at any time from the network the toll belongs to. ${money(C.settleAtUsd)} is the smallest settlement because one costs the facilitator about $0.001 to $0.0013. A payment header that pays another wallet or another sum is not the toll's and is left alone. Only a payment that settled clears the toll; a payment the facilitator gives no verdict on is not taken (try again); one verified and still on its way holds the toll and is never asked for twice; the lever answers go on meanwhile (what they save accrues, asked for once the payment is settled or released). A payment is released only by Base's word: when its authorization can no longer be used and was not (the toll open again); while Base cannot be asked, the payment stays held and Base is asked again, ever later; a new UTC day starts every account fresh.`,
    unpaid: 'Unpaid tolls are not collected: until the open toll is paid, the lean answers pause and the normal answers continue (JSON instead of TOON, the whole page instead of since= or a 304, from /compress the text as sent with only a question or a budget applied, the result in the form of /mcp on /mcp/lean). Nobody is blocked: a lever request that does not pay never gets an error from the toll (one that pays gets a 402 only with the terms, or with why its payment was not taken), and a new UTC day starts with a new free quota and nothing open.',
    headers: 'x-sea-toll (the line in words), x-sea-toll-state (open, paused, settling, or full when the node keeps no more networks that day and the lossless levers rest for new ones), x-sea-toll-usd and x-sea-toll-tokens (this answer), x-sea-toll-open-usd (the open sum) and x-sea-toll-id (the id to settle); on /mcp/lean the line also stands in the result\'s _meta (mareliberum.dev/toll). Answers under the free quota carry none of them and stay byte for byte what they were. Once a network has used its free quota for the day, and while the lever rests for it, a HEAD of /r/ carries no ETag (a 304 to it is tolled as to a GET; while the lever rests it is never answered 304).',
    never: 'Never tolled: the lossy levers, tools/list, a HEAD without a 304 (a 304 answers a HEAD the same as a GET: the same lever, the same count and the same toll), the app door /mcp/app, /via/ (its payments belong to the providers), the till\'s own doors (/route, /settle, /fair, /pay), and every door without a lossless lever. No caller is told apart by its name: the sea\'s own sessions, crawlers and the house agent have the same free quota as everyone.',
    books: 'The toll keeps its own books: never counted with the paid route or with fair share, never written into the database\'s record of the till; /treasury and /open.json show them under toll, exact to the millionth.',
    switch: 'On by default. The operator switches a node off (MARE_TOLL=off) or pauses it without a release ("toll" in rest of immune:policy); it rests too while the till rests or cannot settle a payment, and without a server secret for the keys of its accounts. Off or resting, the toll asks nothing and every lever answer is what it was in 3.36; only the pages that describe it (/engine, /fair, /pricing, /treasury, /open, each also as data, and llms.txt) keep their toll section, and say that it does not act.',
    numbers: { freeTokensPerNetworkPerDay: C.free, share: C.share, usdPerMillion: C.usdPerMillion, settleAtUsd: C.settleAtUsd, example: { pageTokens: TOLL_EXAMPLE.page, savedTokens: TOLL_EXAMPLE.saved, usd: usd6(ex) } },
  };
}

// ------------------------------------------------------------------ x402 for the exact open sum (the till verifies and settles)
export function tollTerms(cfg, { base, ids, micro }) {
  const list = ids.join(','), resource = `${base}/fair/pay?r=${list.length <= 600 ? list : `${createHash('sha256').update(list).digest('hex').slice(0, 16)}&tolls=${ids.length}`}`, atomic = String(micro);
  const description = `Mare Liberum: the toll of ${ids.length === 1 ? 'one network\'s day' : `${ids.length} network days`}, ${pct(TOLL)} of the tokens the lossless levers saved above the free quota, the exact open sum (${usd6(micro)} USD)`;
  const extra = { name: 'USD Coin', version: '2' };
  const outputSchema = { input: { type: 'http', method: 'POST', discoverable: false, bodyType: 'json', bodyFields: { r: { type: 'array', required: true, description: 'the toll ids to settle (x-sea-toll-id of a tolled answer; also ?r=<id> in the address)' } } }, output: { type: 'object', properties: { paid: { type: 'object', description: 'status, amount_usd, payment and the tolls settled' } } } };
  const v1 = { scheme: 'exact', network: 'base', maxAmountRequired: atomic, resource, description, mimeType: 'application/json', outputSchema, payTo: cfg.payTo, maxTimeoutSeconds: cfg.window, asset: USDC_BASE, extra };
  const v2 = { scheme: 'exact', network: 'eip155:8453', amount: atomic, asset: USDC_BASE, payTo: cfg.payTo, maxTimeoutSeconds: cfg.window, extra };
  return { cents: Math.round(micro / 1e4), usd: micro / 1e6, atomic, micro, resource, description, v1, v2, payTo: cfg.payTo, window: cfg.window, ids };
}
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
const PAY_HDR = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' };
// the 402: the terms in every place an x402 client looks, and in words
export function tollRequired(t, { base, error, tokens = 0, cors = {}, extra = {}, C = TOLL }) {
  const v2 = { x402Version: 2, error: error || 'PAYMENT-SIGNATURE header is required', resource: { url: t.resource, description: t.description, mimeType: 'application/json' }, accepts: [t.v2] };
  const body = { x402Version: 1, error: error || 'X-PAYMENT header is required', accepts: [t.v1],
    amount_usd: usd6(t.micro), unit: 'USDC on Base, 6 decimals (maxAmountRequired is in millionths of a dollar)', what: t.description,
    toll: { ids: t.ids, open_usd: usd6(t.micro), tokens, rule: tollFacts(base, C).rule, settle_at_usd: usd6(C.settleMicro) },
    pay: ['x402 v2: call again with the header PAYMENT-SIGNATURE (the PAYMENT-REQUIRED header holds the terms, base64 JSON)', 'x402 v1: call again with the header X-PAYMENT (the terms are in "accepts" of this body)', `or settle the same sum at any time, from this network: POST ${base}/fair/pay?r=${t.ids.join(',')}`],
    without: 'Call again without x-sea-toll: pay and without a payment header and the normal answer comes, the lever not applied. Unpaid tolls are not collected.',
    pay_to: t.payTo, network: 'Base (eip155:8453)', asset: 'USDC', window_seconds: t.window, engine: `${base}/engine#toll`,
    note: 'No account, no key. The USDC goes from your wallet straight to the address above; the sea never holds anyone\'s money.' };
  const short = { scheme: 'exact', network: 'base', to: t.payTo, payTo: t.payTo, amount_usd: usd6(t.micro), decimals: 6, asset: 'USDC', maxTimeoutSeconds: t.window, toll: `${base}/engine#toll` };
  return { status: 402, body, headers: { ...PAY_HDR, 'payment-required': b64(JSON.stringify(v2)), 'x402-payment-required': JSON.stringify(short), 'x-pay-to': t.payTo, 'x-settle-window': String(t.window), ...cors, ...extra } };
}
// the payment must be for exactly the open sum: the sea never takes more than is open, and a smaller one settles nothing
function exactOf(pay, t) {
  const p = pay?.payload, auth = p?.payload?.authorization;
  if (auth && typeof auth === 'object') {
    let v; try { v = BigInt(String(auth.value)); } catch { return 'the amount of this payment could not be read'; }
    if (v !== BigInt(t.atomic)) return `this payment is for ${usd6(Number(v))} USDC; the open toll is exactly ${usd6(t.micro)} USDC: pay that sum`;
  }
  if (pay?.version === 2 && p?.accepted?.amount != null && String(p.accepted.amount) !== t.atomic) return `this payment accepted ${usd6(Number(p.accepted.amount) || 0)} USDC; the open toll is exactly ${usd6(t.micro)} USDC: pay that sum`;
  return null;
}
// the signed transfer itself (EIP-3009): who signs, its nonce and until when it holds. The toll takes only one that ends within
// the terms' time, so that once that time is past the chain can say for good whether it was carried out
const HEX40 = /^0x[0-9a-fA-F]{40}$/, HEX64 = /^0x[0-9a-fA-F]{64}$/;
function authOf(pay, window, t) {
  const a = pay?.payload?.payload?.authorization;
  if (!a || typeof a !== 'object') return { error: 'the toll is paid with a signed USDC transfer on Base (x402 "exact", EIP-3009): this payment carries none' };
  if (!HEX40.test(String(a.from || '')) || !HEX64.test(String(a.nonce || ''))) return { error: 'the signed transfer of this payment names no wallet (from) or no nonce, so it could never be checked: it is not taken' };
  const before = Number(a.validBefore), most = Math.floor(t / 1000) + (Number(window) || 300) + 60;
  if (!Number.isSafeInteger(before) || before > most) return { error: `the signed transfer of this payment must end within ${(Number(window) || 300) + 60} seconds (validBefore): a longer one is not taken` };
  return { from: String(a.from), nonce: String(a.nonce).toLowerCase(), before };
}
// one payment is used once: its authorization (wallet and nonce), else its whole signed part
const nonceOf = (pay) => { const a = pay?.payload?.payload?.authorization; const raw = a && a.nonce != null ? `${String(a.from || '').toLowerCase()}|${String(a.nonce).toLowerCase()}` : JSON.stringify(pay?.payload?.payload ?? pay?.payload ?? null); return createHash('sha256').update(raw).digest('hex').slice(0, 32); };

// ------------------------------------------------------------------ the chain's word on a payment whose settlement did not come back
// USDC on Base keeps, per signing wallet and nonce, whether a signed transfer (EIP-3009) was carried out:
// authorizationState(address authorizer, bytes32 nonce) → bool, selector 0xe94a0102. → true (used), false (not used), null (no answer)
export const TOLL_RPC = 'https://mainnet.base.org';
const RPC_UA = 'MareLiberum-Till/1.0 (+https://mareliberum.dev/engine#toll)';
export const tollRpc = (cfg = {}, env = globalThis.process?.env || {}) => { const v = String(cfg.chainRpc ?? env.MARE_BASE_RPC ?? '').trim(); if (/^(off|none|0|false|no)$/i.test(v)) return null; return /^https:\/\/[^\s]+$/.test(v) ? v : TOLL_RPC; };
export async function authorizationUsed({ rpc, from, nonce, get = (...a) => fetch(...a), ms = 6000 }) {
  if (!rpc || !HEX40.test(String(from || '')) || !HEX64.test(String(nonce || ''))) return null;
  const data = `0xe94a0102${String(from).slice(2).toLowerCase().padStart(64, '0')}${String(nonce).slice(2).toLowerCase()}`;
  try {
    const r = await get(rpc, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json', 'user-agent': RPC_UA }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: USDC_BASE, data }, 'latest'] }), signal: AbortSignal.timeout(ms) });
    const j = await r.json().catch(() => null), x = j?.result;
    if (typeof x !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(x)) return null;
    return BigInt(x) !== 0n;
  } catch { return null; }
}

// ------------------------------------------------------------------ the books of one network's day
// s: saved tokens counted toward the free quota · t, m: tokens tolled and their price (the sum of the answers' prices, micro-USD)
// · pt, pm: of these, paid (settled) · h: payments on their way [{ sale, tok, micro, at }] · n: tolled answers · x: normal
// answers sent while the lever rested · id: the toll's id
export const openTokens = (a) => Math.max(0, (a?.t || 0) - (a?.pt || 0) - (a?.h || []).reduce((s, x) => s + (x.tok || 0), 0));
export const openMicro = (a) => Math.max(0, (a?.m || 0) - (a?.pm || 0) - (a?.h || []).reduce((s, x) => s + (x.micro || 0), 0));
const FOREIGN = 'the payment header of this request does not pay this toll (another wallet, or another sum than the open one): it was left alone';
const BUSY = 'not taken: a payment for this toll is being taken right now; nothing was charged';
const GRACE = 60_000, RETRY = 3600_000, LOOK = 30_000, KEEP_DONE = 3 * 864e5;
export function createToll({ kv, now = () => new Date().toISOString(), config = TOLL, cap = 50_000, secret = tollSecret(), rpc = TOLL_RPC, get = (...a) => fetch(...a), sweepMs = 60_000, log = () => {} } = {}) {
  const C = config, DAY = 86400;
  const accts = new Map(), loading = new Map(), locked = new Set(), used = new Map(), perDay = new Map(), dayKeys = new Map(), nextAt = new Map(), tries = new Map(), checking = new Set(), inherited = new Set();
  const dayOf = () => String(now()).slice(0, 10);
  const mono = () => performance.now();
  // the key of a UTC day (HKDF-SHA256 of the server secret, the day as its info): nothing of it is kept
  const dayKey = (day) => { let k = dayKeys.get(day); if (!k) { k = Buffer.from(hkdfSync('sha256', secret, 'mare-toll-v1', day, 32)); dayKeys.set(day, k); if (dayKeys.size > 64) dayKeys.delete(dayKeys.keys().next().value); } return k; };
  const keyOf = (day, net) => `toll:n:${day}:${createHmac('sha256', dayKey(day)).update(net).digest('hex').slice(0, 24)}`;
  const fresh = (key, day) => ({ key, day, s: 0, t: 0, m: 0, pt: 0, pm: 0, h: [], n: 0, x: 0, id: null });
  const num = (v) => (Number.isSafeInteger(Number(v)) && Number(v) >= 0 ? Number(v) : 0);
  const unpack = (key, day, v) => (v && typeof v === 'object' && v.v === 2 && v.d === day ? { key, day, s: num(v.s), t: num(v.t), m: num(v.m), pt: num(v.pt), pm: num(v.pm), h: Array.isArray(v.h) ? v.h.filter((x) => x && typeof x.sale === 'string').map((x) => ({ sale: x.sale, tok: num(x.tok), micro: num(x.micro), at: String(x.at || '') })) : [], n: num(v.n), x: num(v.x), id: TOLL_ID.test(String(v.id || '')) ? v.id : null } : fresh(key, day));
  const pack = (a) => ({ v: 2, d: a.day, s: a.s, t: a.t, m: a.m, pt: a.pt, pm: a.pm, h: a.h, n: a.n, x: a.x, ...(a.id ? { id: a.id } : {}) });
  // kept to the end of its day and one more; a day with a toll 33 days (POST /fair/pay settles it for 31)
  const ttlOf = (a) => Math.max(600, Math.ceil((Date.parse(`${a.day}T00:00:00Z`) + (a.id ? 33 : 2) * 864e5 - Date.parse(now())) / 1000));
  // written with the copy on disk (a minute after a change), or at once (soon: the state of a payment, kv.setNow of node/disk.mjs)
  const put = (k, v, ttl, soon = false) => { try { if (soon && typeof kv.setNow === 'function') { kv.setNow(k, v, ttl); return; } const p = kv.set(k, v, ttl); p?.catch?.(() => {}); } catch (e) { log('mare_toll', e?.message); } };
  const save = (a, soon = false) => { if (a.key) put(a.key, pack(a), ttlOf(a), soon); };
  const newId = (day) => `t${day.replace(/-/g, '')}${Array.from(randomBytes(8), (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('')}`;
  const heldMicro = (a) => a.h.reduce((s, x) => s + (x.micro || 0), 0);
  // the days before today let go from memory (they stay in the kv): a network's account is one object while it is in use
  let swept = null;
  const sweepMem = (day) => { if (accts.size <= cap || swept === day) return; swept = day; for (const [k, a] of accts) if (a.day !== day && !a.h.length && !locked.has(k)) accts.delete(k); };
  const load = (key, day) => {
    const a = accts.get(key); if (a) return a;
    if (loading.has(key)) return loading.get(key);
    const p = (async () => { let v = null; try { v = await kv.get(key); } catch {} const got = accts.get(key) || unpack(key, day, v); accts.set(key, got); return got; })().finally(() => loading.delete(key));
    loading.set(key, p); return p;
  };
  // a network beyond the cap of the day: no account, and no lossless lever (the normal answers, never an error), nothing owed
  const FULL = (day) => Object.freeze({ full: true, key: null, day, s: 0, t: 0, m: 0, pt: 0, pm: 0, h: Object.freeze([]), n: 0, x: 0, id: null });

  // ---------------------------------------------------------------- the toll's own books: the payments, apart from everything else
  // total and days: what settled (micro-USD, count; days kept 40) · pays: payments on their way, and the ones that ended in the
  // last three days [{ id, at, status: pending | settled | released, micro, tok, keys, ids, from, nonce, before, win, end, tx, why }]
  const BOOKS = 'toll:books';
  let books = null, booksP = null;
  const loadBooks = () => (books ? Promise.resolve(books) : (booksP ||= (async () => {
    let v = null; try { v = await kv.get(BOOKS); } catch {}
    const b = v && typeof v === 'object' && v.v === 1 && Array.isArray(v.pays) ? v : { v: 1, total: { micro: 0, n: 0 }, days: {}, pays: [] };
    b.total ||= { micro: 0, n: 0 }; b.days ||= {};
    // a payment an earlier run left on its way: nobody waits for its settlement any more, so the chain is asked at once
    for (const p of b.pays) if (p.status === 'pending') inherited.add(p.id);
    return (books = b);
  })()));
  const keepBooks = () => {
    const t = Date.parse(now()), cut = t - KEEP_DONE, dcut = new Date(t - 40 * 864e5).toISOString().slice(0, 10);
    books.pays = books.pays.filter((p) => p.status === 'pending' || Date.parse(p.end || p.at) >= cut).slice(0, 5000);
    for (const d of Object.keys(books.days)) if (d < dcut) delete books.days[d];
    put(BOOKS, books, 4000 * DAY, true);
  };
  // what became of a payment: settled (the tokens it held are paid, the books count it) or released (the toll is open again).
  // Each account it held and the books go to the disk at once
  const finish = async (p, status, { tx = null, why = null } = {}) => {
    if (!p || p.status !== 'pending') return false;
    p.status = status; p.end = now(); if (tx) p.tx = String(tx).replace(/[^\x20-\x7e]/g, '').slice(0, 80); if (why) p.why = String(why).slice(0, 200);
    inherited.delete(p.id);
    if (status === 'settled') { books.total.micro += p.micro; books.total.n++; const d = (books.days[String(p.end).slice(0, 10)] ||= { micro: 0, n: 0 }); d.micro += p.micro; d.n++; }
    keepBooks();
    for (const key of p.keys || []) {
      const a = accts.get(key) || (await load(key, String(key).slice(7, 17)));
      const i = a.h.findIndex((x) => x.sale === p.id); if (i < 0) continue;
      const x = a.h[i]; if (status === 'settled') { a.pt += x.tok; a.pm += x.micro; }
      a.h.splice(i, 1); save(a, true);
    }
    return true;
  };
  // a payment whose settlement did not come back: once the terms' time is past (at once for one an earlier run left), the chain
  // says whether its signed transfer was used (settled) or, once it can no longer be (validBefore past), not (released). Nothing
  // is released without the chain's word (since 3.37.2): where the chain cannot be asked or does not answer, the payment stays
  // held and is asked about again, ever later (30 s, doubling, at most an hour); a new UTC day starts every account fresh anyway
  const check = async (p, { force = false } = {}) => {
    if (!p || p.status !== 'pending' || checking.has(p.id)) return;
    const t = Date.parse(now()), born = Date.parse(p.at) || t, win = (Number(p.win) || 300) * 1000, before = (Number(p.before) || 0) * 1000;
    if (t < born + win && !inherited.has(p.id)) return;
    if (!force && (nextAt.get(p.id) ?? -1e15) > t) return;
    checking.add(p.id);
    try {
      const can = !!rpc && HEX40.test(String(p.from || '')) && HEX64.test(String(p.nonce || ''));
      const word = can ? await authorizationUsed({ rpc, from: p.from, nonce: p.nonce, get }) : null, final = (before || born + win) + GRACE;
      if (word === true) await finish(p, 'settled', { why: 'the chain says its signed transfer was carried out (USDC authorizationState on Base)' });
      else if (word === false && t >= final) await finish(p, 'released', { why: 'the chain says its signed transfer was not carried out and can no longer be (USDC authorizationState on Base, past validBefore)' });
      else { const n = (tries.get(p.id) || 0) + 1; tries.set(p.id, n); nextAt.set(p.id, t + (word === false ? Math.max(LOOK, final - t) : Math.min(RETRY, LOOK * 2 ** (n - 1)))); }
    } finally { checking.delete(p.id); }
  };

  const toll = {
    config: C,
    keyed: !!secret,
    // the account of the caller's network today; past the cap of the day a new network gets FULL (no lossless lever, nothing owed)
    async account(ip) {
      if (!secret) return null;
      const day = dayOf(), key = keyOf(day, tollNet(ip));
      sweepMem(day);
      if (!accts.has(key) && !loading.has(key)) {
        const c = perDay.get(day) || 0;
        if (c >= cap) { let v = null; try { v = await kv.get(key); } catch {} if (!v) return FULL(day); }
        perDay.clear(); perDay.set(day, c + 1);
      }
      return load(key, day);
    },
    // the account of a toll id (any day the toll is kept), for POST /fair/pay: only for a caller from its own network
    async byId(id, ip) {
      if (!secret || !TOLL_ID.test(String(id || ''))) return null;
      let key = null; try { key = await kv.get(`toll:i:${id}`); } catch {}
      if (typeof key !== 'string' || !key.startsWith('toll:n:')) return null;
      const day = key.slice(7, 17); if (keyOf(day, tollNet(ip)) !== key) return null;
      const a = await load(key, day);
      return a && a.id === id ? a : null;
    },
    openTokens, openMicro, heldMicro,
    // due: the open sum has reached the settlement and no payment for it is on its way
    due: (a) => !!a && !a.full && !a.h.length && openMicro(a) >= C.settleMicro,
    // the lossless levers rest for this network: due, a payment on its way, or no room for its account
    rests: (a) => !!a && (!!a.full || (!a.h.length && openMicro(a) >= C.settleMicro)),
    // the free quota of the day is used up (a HEAD of /r/ then carries no ETag, since 3.37.2)
    spent: (a) => !!a && (!!a.full || a.s >= C.free),
    // a payment header is the toll's only when it pays the till's wallet exactly the open sum (a signed USDC transfer)
    claims(headers, a, payTo) {
      if (!a || a.full) return false;
      const p = paymentOf(headers, {}); if (!p || p.bad) return false;
      const auth = p.payload?.payload?.authorization, acc = p.version === 2 && p.payload?.accepted && typeof p.payload.accepted === 'object' ? p.payload.accepted : null;
      if (!auth || typeof auth !== 'object') return false;
      const to = String(payTo || '').toLowerCase(); if (!to || String(auth.to || '').toLowerCase() !== to || (acc?.payTo != null && String(acc.payTo).toLowerCase() !== to)) return false;
      const open = openMicro(a); if (open <= 0) return false;
      let v; try { v = BigInt(String(auth.value)); } catch { return false; }
      return v === BigInt(open) && (acc?.amount == null || String(acc.amount) === String(open));
    },
    // what became of the payments this account waits for (the chain asked when their time is past)
    async resolve(a, _ledger = null, { force = false } = {}) {
      if (!a?.h?.length) return a;
      await loadBooks();
      for (const hold of [...a.h]) {
        const p = books.pays.find((x) => x.id === hold.sale);
        if (p) { if (p.status === 'pending') await check(p, { force }); else if (a.h.some((x) => x.sale === hold.sale)) { const i = a.h.findIndex((x) => x.sale === hold.sale), x = a.h[i]; if (p.status === 'settled') { a.pt += x.tok; a.pm += x.micro; } a.h.splice(i, 1); save(a, true); } }
        // a hold the books do not know (they could not be written): it cannot be checked, so it goes after its time
        else if (Date.parse(now()) - (Date.parse(hold.at) || 0) > 300_000 + 2 * GRACE) { const i = a.h.findIndex((x) => x.sale === hold.sale); if (i >= 0) { a.h.splice(i, 1); save(a, true); } }
      }
      return a;
    },
    // every payment on its way: the ones whose time is past, and at the start every one an earlier run left
    async sweep({ force = false } = {}) { await loadBooks(); for (const p of books.pays.filter((x) => x.status === 'pending')) await check(p, { force }); return books.pays.filter((x) => x.status === 'pending').length; },
    // one answer that saved `tokens` by a lossless lever: decided and, when the lever answer goes out, written at once.
    // state null: nothing saved (the answer as it is) · free: under the quota, or a toll that rounds to 0 · open: tolled and
    // delivered · paused: due, the normal answer · settling: a payment on its way, and the lever answers go on meanwhile (what they
    // save accrues; nothing is asked until the payment is settled or released by the chain's word, since 3.37.2) · full: the normal answer
    decide(a, tokens) {
      const s = Math.max(0, Math.floor(Number(tokens) || 0));
      if (!a || !s) return { state: null, lever: true, saved: s, tolled: 0, micro: 0 };
      if (a.full) return { state: 'full', lever: false, saved: s, tolled: 0, micro: 0 };
      const free = Math.max(0, Math.min(s, C.free - a.s)), tolled = s - free, micro = microOf(tolled, C);
      const held = a.h.length > 0;
      if (micro > 0 && !held && openMicro(a) >= C.settleMicro) { a.x++; save(a); return { state: 'paused', lever: false, saved: s, tolled, micro: 0, open: openMicro(a), id: a.id }; }
      a.s += s;
      if (micro > 0) { a.t += tolled; a.m += micro; a.n++; if (!a.id) { a.id = newId(a.day); put(`toll:i:${a.id}`, a.key, 33 * DAY, true); } }
      save(a);
      return micro > 0 ? { state: held ? 'settling' : 'open', lever: true, saved: s, free, tolled, micro, open: openMicro(a), ...(held ? { held: heldMicro(a) } : {}), id: a.id } : { state: 'free', lever: true, saved: s, free, tolled: 0, micro: 0 };
    },
    // the headers of a tolled, paused, settling or full answer (fixed names, ASCII); none for an answer under the quota
    headers(d, base, a = null) {
      if (!d?.state || d.state === 'free') return {};
      if (d.state === 'full') return { 'x-sea-toll': 'full: this node keeps the toll of no more networks today, so the lossless levers rest for new networks until the next UTC day; this is the normal answer, without the lever, and nothing is owed', 'x-sea-toll-state': 'full' };
      const open = d.open ?? (a ? openMicro(a) : 0), at = usd6(C.settleMicro), each = (d.state === 'open' || d.state === 'settling') && d.micro > 0;
      const pay = d.id ? `x-sea-toll: pay with a lever request, or POST ${base}/fair/pay?r=${d.id}` : 'x-sea-toll: pay with a lever request';
      const priced = each ? `${usd6(d.micro)} USD for this answer: ${pct(C)} of ${d.tolled} tokens saved above the free ${C.free} a day, at USD ${C.usdPerMillion} per million; ` : '';
      const line = d.state === 'open' ? `${priced}${usd6(open)} USD open, settled by x402 from ${at} USD: ${pay}`
        : d.state === 'paused' ? `paused: ${usd6(open)} USD open, settled by x402 from ${at} USD: ${pay}. This is the normal answer, without the lever; unpaid tolls are not collected`
          : `settling: a payment of ${usd6(d.held || 0)} USD is on its way, and the lever answers go on meanwhile; ${priced}${usd6(open)} USD open besides, asked for once that payment is settled or released by the chain's word`;
      return { 'x-sea-toll': line, 'x-sea-toll-state': d.state, ...(each ? { 'x-sea-toll-usd': usd6(d.micro), 'x-sea-toll-tokens': String(d.tolled) } : {}), 'x-sea-toll-open-usd': usd6(open), ...(d.id ? { 'x-sea-toll-id': d.id } : {}) };
    },
    // the state of an account in the same headers, with no answer of its own (a 402, an answer that paid but saved nothing)
    status(a, base) {
      if (a.full) return toll.headers({ state: 'full' }, base, a);
      const d = a.h.length ? { state: 'settling', held: heldMicro(a), open: openMicro(a), id: a.id } : toll.due(a) ? { state: 'paused', open: openMicro(a), id: a.id } : { state: 'open', open: openMicro(a), id: a.id };
      return toll.headers(d, base, a);
    },
    busyLine: BUSY,
    // what became of a payment taken with a lever request, in one line (x-sea-toll-payment)
    paidLine(p) {
      const st = String(p?.sale?.status || ''), m = usd6(p?.micro || 0), clean = (x) => String(x || '').replace(/[^\x20-\x7e]/g, '').slice(0, 160);
      return { settled: `settled: ${m} USD paid on Base${p.sale.tx ? `, transaction ${clean(p.sale.tx)}` : ''}; the open toll is cleared`, pending: `pending: ${m} USD verified, the settlement on its way; the toll is held until it lands, or until Base says whether it was carried out`,
        unsettled: `unsettled: the payment of ${m} USD did not settle${p.reason ? ` (${clean(p.reason)})` : ''}; nothing was cleared` }[st] || `${clean(st)}: ${m} USD`;
    },
    // take a payment for the open sum of the accounts named, through the till (node/pay.mjs takePayment, strict)
    // headers: the request's (null when its payment header is not the toll's: foreign says so in the 402)
    // → { nothing } | { below, micro } | { required: terms, error? } | { busy } | { paid: takePayment's result, terms, tokens }
    async pay({ list, headers, body, payCfg, base, callerHash, waitUntil, get: fetchOf, foreign = false }) {
      await loadBooks();
      for (const a of list) await toll.resolve(a, null, { force: true });
      const due = list.filter((a) => !a.full && !a.h.length && openMicro(a) > 0 && !locked.has(a.key));
      if (!due.length) return list.some((a) => locked.has(a.key)) ? { busy: true } : { nothing: true, held: list.filter((a) => a.h.length).map((a) => a.id) };
      const cover = new Map(due.map((a) => [a.key, { tok: openTokens(a), micro: openMicro(a) }])), ids = due.map((a) => a.id);
      const micro = due.reduce((s, a) => s + cover.get(a.key).micro, 0), tokens = due.reduce((s, a) => s + cover.get(a.key).tok, 0);
      if (micro < C.settleMicro) return { below: true, micro, tokens, ids };
      const t = tollTerms(payCfg, { base, ids, micro });
      const p = headers ? paymentOf(headers, body || {}) : null;
      if (!p) return { required: t, tokens, ...(foreign ? { error: FOREIGN } : {}) };
      if (p.bad) return { required: t, tokens, error: p.bad };
      const exact = exactOf(p, t); if (exact) return { required: t, tokens, error: exact };
      const auth = authOf(p, payCfg.window, Date.parse(now())); if (auth.error) return { required: t, tokens, error: auth.error };
      const once = nonceOf(p);
      for (const [k, at] of used) if (at < mono() - 3600_000) used.delete(k);
      let seen = used.has(once); if (!seen) { try { seen = !!(await kv.get(`toll:u:${once}`)); } catch {} }
      if (seen) return { required: t, tokens, error: 'this payment was used before: nothing was cleared' };
      if (due.some((a) => locked.has(a.key))) return { busy: true };
      for (const a of due) locked.add(a.key);
      try {
        const at = now(); let entry = null;
        // the till of the toll: its sales are the toll's own payments, never the till's sales of the paid move (node/ledger.mjs)
        const till = {
          sale: (row) => ({ id: `tp${Date.parse(at).toString(36)}${randomBytes(5).toString('hex')}`, ts: at, status: String(row.status || 'pending'), method: row.method, payer: row.payer || null }),
          // the settlement's word when it comes behind the answer (or within it): settled clears, anything else releases
          saleSet: (id, patch) => { if (!entry || entry.id !== id) return; if (patch?.status === 'settled') finish(entry, 'settled', { tx: patch.tx }).catch(() => {}); else if (patch?.status) finish(entry, 'released', { why: `the settlement failed (${String(patch.status).slice(0, 20)})` }).catch(() => {}); },
        };
        const r = await takePayment({ cfg: payCfg, t, pay: p, q: 'toll', ledger: till, callerHash, waitUntil, get: fetchOf, base, label: 'toll', strict: true,
          work: async (sale) => {
            // the payment is checked: from now on its sum is held, never asked for twice; the hold goes to the disk at once
            used.set(once, mono()); put(`toll:u:${once}`, 1, 2 * DAY, true);
            entry = { id: sale.id, at, status: 'pending', micro, tok: tokens, keys: due.map((a) => a.key), ids, from: auth.from, nonce: auth.nonce, before: auth.before, win: Number(payCfg.window) || 300, method: sale.method };
            books.pays.unshift(entry); keepBooks();
            for (const a of due) { const c = cover.get(a.key); a.h.push({ sale: sale.id, tok: c.tok, micro: c.micro, at }); save(a, true); }
            return {};
          } });
        if (r.refuse) return { required: t, tokens, error: r.refuse };
        if (entry?.status === 'pending' && r.sale.status === 'settled') await finish(entry, 'settled', { tx: r.sale.tx });
        else if (entry?.status === 'pending' && r.sale.status === 'unsettled') await finish(entry, 'released', { why: r.reason });
        return { paid: r, terms: t, tokens, ids };
      } finally { for (const a of due) locked.delete(a.key); }
    },
    // what the toll brought in, from its own books (exact, in millionths of a dollar)
    async totals() {
      await loadBooks();
      const today = dayOf(), way = books.pays.filter((x) => x.status === 'pending'), d = books.days[today] || { micro: 0, n: 0 };
      return { settledMicro: books.total.micro, payments: books.total.n, onItsWayMicro: way.reduce((s, x) => s + (x.micro || 0), 0), onItsWay: way.length, todaySettledMicro: d.micro, todayPayments: d.n };
    },
    state: () => ({ accounts: accts.size, locked: locked.size, pending: books ? books.pays.filter((x) => x.status === 'pending').length : null }),
    close() { if (timer) clearInterval(timer); },
  };
  // the payments on their way are looked at once a minute (the timer keeps no process alive)
  const timer = sweepMs > 0 ? setInterval(() => { toll.sweep().catch(() => {}); }, sweepMs) : null; timer?.unref?.();
  return toll;
}
