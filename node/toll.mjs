// Mare Liberum · the harbour toll (since 3.37, "Der Hafenzoll"): a share of what the lossless levers save, above a free quota
// The owner's rule (25.11.2026, "Freikontingent + Zoll"): up to 100,000 saved tokens per network and UTC day stay free. Above
// that an agent pays 20 % of what a lossless lever measurably saved it, at the mid price of the ledger of /savings (USD 2 per
// million input tokens), automatically over x402. Nobody is blocked: an agent that does not pay gets the normal answer, the
// lever simply not applied. The numbers live in config/toll.json; the text every page says is made here from them.
//   tolled       the lossless saving of one answer, measured by the one rule of savingOf (node/engine.mjs), the very numbers the
//                ledger of /savings is handed for it: TOON instead of compact JSON (fmt=toon, an Accept that prefers text/toon,
//                the text of a tool result on /mcp/lean), a page read again as its change or as a 304 (/r/ since=,
//                If-None-Match), the lossless steps of POST /compress. Per answer: the ledger's once-a-day rule keeps its
//                public figures honest and stays as it is; the toll counts every answer that saved
//   never        the lossy levers (fields=, budget=, the q and budget of /compress); the short tool list of /mcp/lean (it comes
//                with tools/list, which stays free, and no answer can take it back); the sea's own calls, crawlers, HEAD, the
//                house agent (Angel), the app door /mcp/app, the till's own doors and answers it sold
//   free quota   per network (an IPv4 address, an IPv6 /64: netKey of node/guard.mjs, the key of the ledger's once-a-day rule)
//                and UTC day; the answer that crosses it pays only for the part above it
//   the price    micro-USD = floor(tokens × share × usdPerMillion), in whole numbers (no floating point): per answer for the
//                line of that answer, once over all tolled tokens for the open sum
//   settling     below settleAtUsd the toll accrues, and every tolled answer says so (x-sea-toll and its companions). From
//                settleAtUsd the next lever answer asks: a caller that pays (x-sea-toll: pay, or an x402 payment header) gets
//                402 with the x402 terms of the open sum (exact, USDC on Base, the till's wallet) and, after a payment that
//                settled, the lever answer; any other caller gets the normal answer and the headers say how to settle.
//                POST /fair/pay?r=<toll id> settles the same sum at any time from 0.05 USD (the smallest settlement the
//                facilitator's fee allows, node/fair.mjs). The money moves through the till's own path (node/pay.mjs
//                takePayment: the same checks, facilitator, sale and payment response); the payment goes into the registry of
//                fair share (kv fair:pay, kind toll) and, once settled, into the books, apart from the voluntary fair share
//   payments     only a payment that settled clears a toll. One that is verified but still settling, or that could not be
//                checked, holds the toll: it is not asked for again, and the lever rests until the till's copy of the sale
//                says it settled (then cleared) or failed (then due again). A payment refused, failed or used before clears
//                nothing; a payment for another sum than the open one is refused before anyone is asked
//   switch       on by default. MARE_TOLL=off switches a node off; "toll" in rest of immune:policy pauses it without a release;
//                it rests too while the till rests or cannot settle (no wallet, or no facilitator to tell a payment from a
//                forged one). Off or resting, nothing here acts and every answer is what it was in 3.36
// The state per network and day is kept in the node's kv (on disk with MARE_STATE: the copy on disk is written a minute after
// a change and on every stop, node/disk.mjs), under an HMAC of the network with a salt the node keeps there too: no address is
// written down. A restart forgets no open toll and gives no second free quota the same day.
import { readFileSync } from 'node:fs';
import { createHash, createHmac, randomBytes } from 'node:crypto';
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
    formula: `toll of an answer = ${C.share} × the tokens its lossless lever saved above the free quota × USD ${C.usdPerMillion} / 1,000,000`,
    levers: 'the lossless levers only: TOON instead of JSON (fmt=toon, Accept: text/toon, the text of a tool result on /mcp/lean), a page read again as its change or a 304 (/r/<address>?since=<etag>, If-None-Match), the lossless steps of POST /compress; measured by the one rule of /engine, the same numbers the ledger of /savings is handed',
    free: `the lossy levers (fields=, budget=, a question or a budget on /compress), tools/list and the short tool list of /mcp/lean, every other door, and the first ${n(C.free)} saved tokens of each network a day`,
    example: `Example: an agent reads a page of ${n(TOLL_EXAMPLE.page)} tokens again with since= and gets the one line that says it is unchanged: ${n(TOLL_EXAMPLE.saved)} tokens saved. Above the free quota that answer costs ${C.share} × ${n(TOLL_EXAMPLE.saved)} × $${C.usdPerMillion} / 1,000,000 = $${usd6(ex)} (about $${(ex / 1e6).toFixed(4)}). The toll is settled once the open sum reaches ${money(C.settleAtUsd)}, about ${n(per)} such answers. An agent without a wallet gets the normal answer: the whole page.`,
    settle: `The toll accrues per answer; up to ${money(C.settleAtUsd)} may accrue before payment (the answer that reaches it is delivered, so the sum asked can be that one answer's toll above it). From ${money(C.settleAtUsd)} it is settled in one x402 payment of the exact open sum, USDC on Base to the till's wallet: send the header x-sea-toll: pay with a lever request (the answer is 402 with the terms; pay it and the lever answer comes), or POST ${base}/fair/pay?r=<toll id> at any time. ${money(C.settleAtUsd)} is the smallest settlement because one costs the facilitator about $0.001 to $0.0013. Only a payment that settled clears the toll; one still on its way holds it, is never asked for twice, and the lean answers rest until it lands.`,
    unpaid: 'Unpaid tolls are not collected: until the open toll is paid, the lean answers pause and the normal answers continue (JSON instead of TOON, the whole page instead of since= or a 304, the text as sent from /compress, the result in the form of /mcp on /mcp/lean). Nobody is blocked, and a new UTC day starts with a new free quota and nothing open.',
    headers: 'x-sea-toll (the line in words), x-sea-toll-state (open, paused or settling), x-sea-toll-usd and x-sea-toll-tokens (this answer), x-sea-toll-open-usd (the open sum) and x-sea-toll-id (the id to settle); on /mcp/lean the line also stands in the result\'s _meta (mareliberum.dev/toll). Answers under the free quota carry none of them and stay byte for byte what they were.',
    never: 'Never tolled: the sea\'s own calls, crawlers, HEAD, the house agent, the app door /mcp/app, the till\'s own doors, anything the ledger does not count as a lossless saving of the engine room.',
    switch: 'On by default. The operator switches a node off (MARE_TOLL=off) or pauses it without a release ("toll" in rest of immune:policy); it rests too while the till rests or cannot settle a payment. Off or resting, every answer is what it was in 3.36.',
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
    pay: ['x402 v2: call again with the header PAYMENT-SIGNATURE (the PAYMENT-REQUIRED header holds the terms, base64 JSON)', 'x402 v1: call again with the header X-PAYMENT (the terms are in "accepts" of this body)', `or settle the same sum at any time: POST ${base}/fair/pay?r=${t.ids.join(',')}`],
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
// one payment is used once: its authorization (wallet and nonce), else its whole signed part
const nonceOf = (pay) => { const a = pay?.payload?.payload?.authorization; const raw = a && a.nonce != null ? `${String(a.from || '').toLowerCase()}|${String(a.nonce).toLowerCase()}` : JSON.stringify(pay?.payload?.payload ?? pay?.payload ?? null); return createHash('sha256').update(raw).digest('hex').slice(0, 32); };

// ------------------------------------------------------------------ the books of one network's day
// s: saved tokens counted toward the free quota · t: tokens tolled (above it) · p: tokens paid (settled) · h: payments on their
// way [{ sale, tok, micro, at }] · n: tolled answers · x: normal answers sent while the toll was due · id: the toll's id
const SETTLED = new Set(['settled']), WAY = new Set(['pending', 'unverified']), HOLDS = new Set(['settled', 'pending', 'unverified']);
export const openTokens = (a) => Math.max(0, (a?.t || 0) - (a?.p || 0) - (a?.h || []).reduce((s, x) => s + (x.tok || 0), 0));
export function createToll({ kv, fair = null, now = () => new Date().toISOString(), config = TOLL, cap = 50_000 } = {}) {
  const C = config, DAY = 86400;
  let salt = null, saltP = null;
  const accts = new Map(), loading = new Map(), locked = new Set(), used = new Map(), looked = new Map(), perDay = new Map();
  const dayOf = () => String(now()).slice(0, 10);
  const mono = () => performance.now();
  const saltOf = () => salt || (saltP ||= (async () => {
    let s = null; try { s = await kv.get('toll:salt'); } catch {}
    if (typeof s !== 'string' || s.length < 32) { s = randomBytes(24).toString('hex'); try { await kv.set('toll:salt', s, 4000 * DAY); } catch {} }
    return (salt = s);
  })());
  const keyOf = (day, net) => `toll:n:${day}:${createHmac('sha256', salt).update(`${day}|${net}`).digest('hex').slice(0, 24)}`;
  const fresh = (key, day) => ({ key, day, s: 0, t: 0, p: 0, h: [], n: 0, x: 0, id: null });
  const unpack = (key, day, v) => (v && typeof v === 'object' && v.d === day ? { key, day, s: +v.s || 0, t: +v.t || 0, p: +v.p || 0, h: Array.isArray(v.h) ? v.h.filter((x) => x && typeof x.sale === 'string') : [], n: +v.n || 0, x: +v.x || 0, id: TOLL_ID.test(String(v.id || '')) ? v.id : null } : fresh(key, day));
  const pack = (a) => ({ v: 1, d: a.day, s: a.s, t: a.t, p: a.p, h: a.h, n: a.n, x: a.x, ...(a.id ? { id: a.id } : {}) });
  // kept to the end of its day and one more; a day with a toll 33 days (POST /fair/pay settles it for 31)
  const ttlOf = (a) => Math.max(600, Math.ceil((Date.parse(`${a.day}T00:00:00Z`) + (a.id ? 33 : 2) * 864e5 - Date.parse(now())) / 1000));
  const save = (a) => { try { const p = kv.set(a.key, pack(a), ttlOf(a)); p?.catch?.(() => {}); } catch {} };
  const newId = (day) => `t${day.replace(/-/g, '')}${Array.from(randomBytes(8), (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('')}`;
  const openMicro = (a) => microOf(openTokens(a), C);
  const heldMicro = (a) => a.h.reduce((s, x) => s + (x.micro || 0), 0);
  // the days before today let go from memory (they stay in the kv): a network's account is one object while it is in use
  const sweep = (day) => { if (accts.size <= cap) return; for (const [k, a] of accts) if (a.day !== day && !a.h.length && !locked.has(k)) accts.delete(k); };
  const load = (key, day) => {
    const a = accts.get(key); if (a) return a;
    if (loading.has(key)) return loading.get(key);
    const p = (async () => { let v = null; try { v = await kv.get(key); } catch {} const got = accts.get(key) || unpack(key, day, v); accts.set(key, got); return got; })().finally(() => loading.delete(key));
    loading.set(key, p); return p;
  };
  const settleHold = (a, sale) => { const i = a.h.findIndex((x) => x.sale === sale); if (i < 0) return false; a.p += a.h[i].tok; a.h.splice(i, 1); return true; };
  const releaseHold = (a, sale) => { const i = a.h.findIndex((x) => x.sale === sale); if (i < 0) return false; a.h.splice(i, 1); return true; };

  const toll = {
    config: C,
    // the account of the caller's network today (null: this node keeps no more networks today, and the caller is not tolled)
    async account(ip) {
      await saltOf();
      const day = dayOf(), key = keyOf(day, netKey(ip || 'unknown'));
      sweep(day);
      if (!accts.has(key) && !loading.has(key)) { const c = perDay.get(day) || 0; if (c >= cap) return null; perDay.clear(); perDay.set(day, c + 1); }
      return load(key, day);
    },
    // the account of a toll id (any day the toll is kept), for POST /fair/pay
    async byId(id) {
      if (!TOLL_ID.test(String(id || ''))) return null;
      let key = null; try { key = await kv.get(`toll:i:${id}`); } catch {}
      if (typeof key !== 'string' || !key.startsWith('toll:n:')) return null;
      const a = await load(key, key.slice(7, 17));
      return a && a.id === id ? a : null;
    },
    openTokens, openMicro, heldMicro,
    // due: the open sum has reached the settlement and no payment for it is on its way
    due: (a) => !!a && !a.h.length && openMicro(a) >= C.settleMicro,
    // what became of payments on their way: the till's copy of each sale (through the registry of fair share, node/fair.mjs)
    async resolve(a, ledger, { force = false } = {}) {
      if (!a?.h?.length) return a;
      const t = mono(); if (!force && (looked.get(a.key) || -1e9) > t - 1000) return a; looked.set(a.key, t);
      let list = []; try { list = fair ? await fair.payments(ledger) : []; } catch {}
      let changed = false;
      for (const hold of [...a.h]) {
        const st = list.find((x) => x.sale === hold.sale)?.status || ledger?.mem?.sales?.find((x) => x.id === hold.sale)?.status || null;
        if (st === 'settled') changed = settleHold(a, hold.sale) || changed;
        else if (st && !WAY.has(st)) changed = releaseHold(a, hold.sale) || changed;
      }
      if (changed) save(a);
      return a;
    },
    // one answer that saved `tokens` by a lossless lever: decided and, when the lever answer goes out, written at once.
    // state null: nothing saved (the answer as it is) · free: under the quota · open: tolled and delivered · paused: due, the
    // normal answer · settling: a payment on its way, the normal answer
    decide(a, tokens) {
      const s = Math.max(0, Math.floor(Number(tokens) || 0));
      if (!a || !s) return { state: null, lever: true, saved: s, tolled: 0, micro: 0 };
      const free = Math.max(0, Math.min(s, C.free - a.s)), tolled = s - free;
      if (tolled > 0 && a.h.length) { a.x++; save(a); return { state: 'settling', lever: false, saved: s, tolled, micro: 0, open: openMicro(a), held: heldMicro(a), id: a.id }; }
      if (tolled > 0 && openMicro(a) >= C.settleMicro) { a.x++; save(a); return { state: 'paused', lever: false, saved: s, tolled, micro: 0, open: openMicro(a), id: a.id }; }
      a.s += s;
      if (tolled > 0) { a.t += tolled; a.n++; if (!a.id) { a.id = newId(a.day); try { const p = kv.set(`toll:i:${a.id}`, a.key, 33 * DAY); p?.catch?.(() => {}); } catch {} } }
      save(a);
      return tolled > 0 ? { state: 'open', lever: true, saved: s, free, tolled, micro: microOf(tolled, C), open: openMicro(a), id: a.id } : { state: 'free', lever: true, saved: s, free, tolled: 0, micro: 0 };
    },
    // the headers of a tolled, paused or settling answer (fixed names, ASCII); none for an answer under the quota
    headers(d, base, a = null) {
      if (!d?.state || d.state === 'free') return {};
      const open = d.open ?? (a ? openMicro(a) : 0), at = usd6(C.settleMicro), each = d.state === 'open' && d.micro != null;
      const pay = d.id ? `x-sea-toll: pay with a lever request, or POST ${base}/fair/pay?r=${d.id}` : 'x-sea-toll: pay with a lever request';
      const line = each ? `${usd6(d.micro)} USD for this answer: ${pct(C)} of ${d.tolled} tokens saved above the free ${C.free} a day, at USD ${C.usdPerMillion} per million; ${usd6(open)} USD open, settled by x402 from ${at} USD: ${pay}`
        : d.state === 'open' ? `${usd6(open)} USD open, settled by x402 from ${at} USD: ${pay}`
          : d.state === 'paused' ? `paused: ${usd6(open)} USD open, settled by x402 from ${at} USD: ${pay}. This is the normal answer, without the lever; unpaid tolls are not collected`
            : `settling: a payment of ${usd6(d.held || 0)} USD is on its way; until it settles this is the normal answer, without the lever`;
      return { 'x-sea-toll': line, 'x-sea-toll-state': d.state, ...(each ? { 'x-sea-toll-usd': usd6(d.micro), 'x-sea-toll-tokens': String(d.tolled) } : {}), 'x-sea-toll-open-usd': usd6(open), ...(d.id ? { 'x-sea-toll-id': d.id } : {}) };
    },
    // the state of an account in the same headers, with no answer of its own (a 402, an answer that paid but saved nothing)
    status(a, base) {
      const d = a.h.length ? { state: 'settling', held: heldMicro(a), open: openMicro(a), id: a.id } : toll.due(a) ? { state: 'paused', open: openMicro(a), id: a.id } : { state: 'open', open: openMicro(a), id: a.id };
      return toll.headers(d, base, a);
    },
    // what became of a payment taken with a lever request, in one line (x-sea-toll-payment)
    paidLine(p) {
      const st = String(p?.sale?.status || ''), m = usd6(p?.micro || 0), clean = (x) => String(x || '').replace(/[^\x20-\x7e]/g, '').slice(0, 160);
      return { settled: `settled: ${m} USD paid on Base${p.sale.tx ? `, transaction ${clean(p.sale.tx)}` : ''}; the open toll is cleared`, pending: `pending: ${m} USD verified, the settlement on its way; the toll is held until it lands`,
        unverified: `unverified: ${m} USD taken before it could be checked; the toll is held until it settles`, unsettled: `unsettled: the payment of ${m} USD did not settle${p.reason ? ` (${clean(p.reason)})` : ''}; nothing was cleared` }[st] || `${clean(st)}: ${m} USD`;
    },
    // take a payment for the open sum of the accounts named, through the till (node/pay.mjs takePayment)
    // → { nothing } | { below, micro } | { required: terms, error? } | { busy } | { paid: takePayment's result, terms, tokens }
    async pay({ list, headers, body, payCfg, ledger, base, callerHash, waitUntil, get }) {
      for (const a of list) await toll.resolve(a, ledger, { force: true });
      const due = list.filter((a) => !a.h.length && openTokens(a) > 0 && !locked.has(a.key));
      if (!due.length) return list.some((a) => locked.has(a.key)) ? { busy: true } : { nothing: true, held: list.filter((a) => a.h.length).map((a) => a.id) };
      const cover = new Map(due.map((a) => [a.key, openTokens(a)])), micro = due.reduce((s, a) => s + microOf(cover.get(a.key), C), 0), tokens = [...cover.values()].reduce((s, x) => s + x, 0);
      if (micro < C.settleMicro) return { below: true, micro, tokens, ids: due.map((a) => a.id) };
      const t = tollTerms(payCfg, { base, ids: due.map((a) => a.id), micro });
      const p = paymentOf(headers, body || {});
      if (!p) return { required: t, tokens };
      if (p.bad) return { required: t, tokens, error: p.bad };
      const exact = exactOf(p, t); if (exact) return { required: t, tokens, error: exact };
      const once = nonceOf(p);
      for (const [k, at] of used) if (at < mono() - 3600_000) used.delete(k);
      let seen = used.has(once); if (!seen) { try { seen = !!(await kv.get(`toll:u:${once}`)); } catch {} }
      if (seen) return { required: t, tokens, error: 'this payment was used before: nothing was cleared' };
      if (due.some((a) => locked.has(a.key))) return { busy: true };
      for (const a of due) locked.add(a.key);
      try {
        const at = now(), ids = due.map((a) => a.id);
        const r = await takePayment({ cfg: payCfg, t, pay: p, q: `toll ${ids.join(',')}: ${tokens} tokens above the free quota`.slice(0, 300), ledger, callerHash, waitUntil, get, base, label: 'toll', extra: { amount_micro: micro, kind: 'toll' },
          work: async (sale) => {
            // the payment is checked: from now on its sum is held, never asked for twice
            used.set(once, mono()); try { const q = kv.set(`toll:u:${once}`, 1, 2 * DAY); q?.catch?.(() => {}); } catch {}
            for (const a of due) { a.h.push({ sale: sale.id, tok: cover.get(a.key), micro: microOf(cover.get(a.key), C), at }); save(a); }
            try { await fair?.record({ sale: sale.id, ids, micro, status: sale.status, at, kind: 'toll', tokens }); } catch {}
            return {};
          } });
        if (r.refuse) return { required: t, tokens, error: r.refuse };
        try { await fair?.record({ sale: r.sale.id, status: r.sale.status, ...(r.sale.tx ? { tx: r.sale.tx } : {}) }); } catch {}
        if (r.sale.status === 'settled') {
          for (const a of due) { settleHold(a, r.sale.id); save(a); }
          try { await fair?.book({ sale: r.sale.id, ids, micro, status: 'settled', tx: r.sale.tx, kind: 'toll' }, ledger?.mem?.sales?.find((x) => x.id === r.sale.id) || r.sale); } catch {}
        } else if (!WAY.has(r.sale.status)) for (const a of due) { releaseHold(a, r.sale.id); save(a); }
        return { paid: r, terms: t, tokens, ids };
      } finally { for (const a of due) locked.delete(a.key); }
    },
    // what tolls brought in, from the registry of payments (exact, in millionths of a dollar)
    async totals(ledger) {
      let list = []; try { list = fair ? (await fair.payments(ledger)).filter((x) => x.kind === 'toll') : []; } catch {}
      const today = dayOf(), sum = (l, st) => l.filter((x) => st.has(x.status)).reduce((s, x) => s + (Number(x.micro) || 0), 0), now1 = list.filter((x) => String(x.at || '').slice(0, 10) === today);
      return { settledMicro: sum(list, SETTLED), onItsWayMicro: sum(list, WAY), payments: list.filter((x) => HOLDS.has(x.status)).length, todaySettledMicro: sum(now1, SETTLED), todayPayments: now1.filter((x) => HOLDS.has(x.status)).length };
    },
    state: () => ({ accounts: accts.size, locked: locked.size }),
  };
  return toll;
}
