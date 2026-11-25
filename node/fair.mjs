// Mare Liberum · fair share: the sea asks only for a share of what it measurably saves an agent (since 3.34)
// The rule in one sentence: free to enter; when the sea saves you tokens, it asks for a fair share of the saving, and you
// keep at least 80 %. It works like the measurement and verification of energy-saving contracts (IPMVP): a saving is a
// baseline minus what was really spent, each basis says how it was found, and where a number is uncertain the
// conservative end is taken. Three bases, never mixed:
//   lower      measured: the tokens of the page as plain text minus the tokens of the Markdown the sea sent (pages of the
//              sea, where the plain text was taken; nowhere else, so nowhere else is there a lower saving)
//   upper      measured: the tokens of the page as raw HTML minus the Markdown. Shown, never billed
//   modelled   a solved part reused: what finding it again would have cost (the low end of the sourced range on /savings;
//              for a confirmed pathway never more than the cheapest search loop the bench measured on /proof) minus the
//              answer that handed it over, measured from its bytes with the bytes per token the bench measured for the
//              brain's answers. A long answer can cost more than it spares: then the saving is zero
// Valuation: the rate card of /savings (USD per million input tokens: 0.10 low, 2 mid, 8 high); receipts value at mid
// and show low and high. Fair share: 20 % of the lower value plus 10 % of the modelled value, 0 % of the upper one.
// No saving, no share. A drop is a unit of account: 1,000 input tokens an agent did not have to spend, on the
// conservative basis (lower + modelled). It is not sold, not transferred and not paid out, and it promises no value.
// Every answer the ledger of /savings counts gets a receipt, with the same honesty (node/areas.mjs, node/tally.mjs):
// never the sea's own calls, never crawlers, the same once-a-day rule and caps; the house agent (Angel) gets none, and
// the app door (/mcp/app) never carries one. A receipt holds no address and no caller hash. Paying is voluntary: nothing
// is withheld for not paying, and payments change no order, verification, verdict or answer text. Settlement is x402
// for the exact unpaid sum (POST /fair/pay), through the verification and settlement of the till (node/pay.mjs).
// Off by default: the operator switches it on with MARE_FAIR=on and pauses it with "fair" in rest of immune:policy.
// Off, every answer is byte for byte what it was before 3.34.
import { SAVE, TOKEN_PRICE, TOKEN_RATIO, tokensOfBytes, MEASURED_UNIT } from './areas.mjs';
import { loadBench, loadLean, summarize, proofJson } from './proof.mjs';
import { USDC_BASE } from './pricing.mjs';
import { paymentOf, takePayment } from './pay.mjs';
import { page, esc } from './pages.mjs';
import { tallyRun, tallyClose } from './tally.mjs';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';

export const FAIR_VERSION = 'fair-1';
export const FAIR = {
  version: FAIR_VERSION, since: '2026-11-25',
  rule: 'Free to enter. When the sea saves you tokens, it asks for a fair share of the saving — you keep at least 80 %.',
  rate: { lower: 0.2, modelled: 0.1, upper: 0 },
  keepAtLeast: 0.8,
  // the smallest sum one payment settles: 0.05 USDC. One settlement costs the facilitator about $0.001 to $0.0013 (PayAI:
  // gas plus 30 % in credits of $0.001), so below 5 US cents the fee would eat a large part of the share; less is bundled
  minMicro: 50_000,
  minWhy: 'one settlement costs the facilitator about $0.001 to $0.0013 (gas plus 30 %), so below 0.05 USDC the fee would eat a large part of the share',
  minSource: 'https://docs.payai.network/x402/facilitators/pricing.md',
  // receipts in one payment: in the address while it is short, else in the body ({"r":[…]}); small shares need many
  bundleMax: 5000,
  keepDays: 30,
  drop: 1000,
  // what the receipt field adds to a JSON answer, in bytes, counted against the saving of that answer (it is about 140)
  fieldBytes: 240,
  voluntary: 'Paying is voluntary. Nothing is withheld for not paying, and no payment changes any order, verification, verdict or answer.',
  drops: 'A drop is a unit of account: 1,000 input tokens an agent did not have to spend, on the conservative basis (lower + modelled). It is a count kept on the server only: no export, no transfer, no copy on any chain, and no address of the sea moves drops. It is not sold and not paid out, and it promises no value.',
  // beside every dollar figure that is worked out from tokens (not beside money actually received)
  usdNote: 'modelled value for information — not a price, not redeemable, not transferable',
  settledNote: 'USDC actually received on Base, from voluntary payments; the public view shows no address',
};
// the method of the three bases, published with its version (a receipt names the version it was made under)
export const METHOD = {
  version: FAIR_VERSION, since: FAIR.since,
  bases: 'lower: measured, the page as plain text against the Markdown the sea sent (only where the plain text was taken); upper: measured, the page as raw HTML against the same Markdown, shown and never billed; modelled: a solved part reused, the low end of what finding it again costs (/savings), for a pathway at most the cheapest search loop of the bench and never more than a whole task saved there (/proof), minus the answer that carried it, measured',
  valuation: 'tokens times the rate card of /savings for uncached input tokens (USD 0.10, 2 and 8 per million); receipts value at the middle and show both ends',
  share: '20 % of the lower value plus 10 % of the modelled value, 0 % of the upper; rounded down to the millionth of a dollar, so the agent keeps at least 80 % of every saving; no saving, no share',
  conservative: 'the low end of every range; the answer itself and the receipt field counted against the saving; no plain text taken, no lower saving; once a day per network and page or task; the sea\'s own calls, crawlers and the house agent never',
  registry: 'a receipt is made once and counted once; a receipt in a payment that holds is retired and is never billed again; a settlement that fails sets its receipts free again; receipts are kept 30 days, payments 400',
  drops: 'a server-side count of thousands of tokens saved on the conservative basis; nothing moves drops',
};
export const BASES = [
  { id: 'lower', name: 'lower', rate: FAIR.rate.lower, how: 'measured', what: 'the page as plain text against the Markdown the sea sent, for pages of the sea whose plain text was taken; nowhere else', short: 'measured: the page as plain text against the Markdown the sea sent' },
  { id: 'modelled', name: 'modelled', rate: FAIR.rate.modelled, how: 'modelled, calibrated on the bench', what: 'a solved part reused (a confirmed pathway, a ready plan, verified offers): the low end of what finding it again costs (/savings), for a pathway at most the cheapest search loop of the bench and never more than a whole task saved there (/proof), minus the answer that handed it over, measured', short: 'a solved part reused: what finding it again costs, at the low end, minus the answer itself' },
  { id: 'upper', name: 'upper', rate: FAIR.rate.upper, how: 'measured', what: 'the page as raw HTML against the Markdown the sea sent: shown on every receipt, never billed', short: 'measured: the page as raw HTML against the Markdown; shown, never billed' },
];
const REUSE = new Set(Object.keys(SAVE.per));
const UTF8 = new TextEncoder();
const bytesOf = (s) => UTF8.encode(String(s ?? '')).length;
const TOK = 'o200k_base';
export const usd6 = (micro) => (Math.max(0, Number(micro) || 0) / 1e6).toFixed(6);
// a sum for people: $0, whole cents as cents, smaller sums to the millionth (never rounded up)
export const money = (micro) => { const m = Math.max(0, Math.floor(Number(micro) || 0)); return !m ? '$0' : m % 10_000 === 0 ? `$${(m / 1e6).toFixed(2)}` : `$${String(Number((m / 1e6).toFixed(6)))}`; };
const n = (x) => (x == null || !Number.isFinite(Number(x)) ? '–' : Number(x).toLocaleString('en-US'));
const r2 = (x) => Math.round(x * 100) / 100;

// ------------------------------------------------------------------ the calibration, read from the runs of the bench (/proof)
// Every figure is read from the data behind /proof (node/proof.mjs: the live run and the run beside it), never copied:
//   whole       a whole task (finding the page and reading it), medians, as /proof shows it: WITH the sea the brain's
//               short answer and the page as Markdown (the run beside the live one, "after"); WITHOUT it the search loop
//               (modelled) and the page as plain text, the low end being the conservative one; for an agent that reads raw
//               HTML the same as HTML (an upper bound, shown, never billed). The sea's own earlier full answer is no
//               "without" and is used nowhere here
//   loopLow     the cheapest search loop an agent runs without the sea (the finding part of the conservative "without")
//   jsonBytesPerToken   UTF-8 bytes per token of the brain's answers as measured (the smaller of the runs: an answer counts
//               as large, the saving as small)
// Without a run on the node, or without the measured short answer, there is no calibration and no modelled saving.
const dmy = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(String(d)) ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}` : String(d || ''));
export function calibrate(live = loadBench(), lean = loadLean()) {
  const ok = [live, lean].filter((d) => d?.tasks?.length).map((d) => (d.summary ? d : { ...d, summary: summarize(d) }));
  if (!ok.length || !live?.tasks?.length) return null;
  const L = ok[0], A = lean?.tasks?.length ? ok[ok.length - 1] : null;
  const loops = ok.map((d) => d.summary.finding?.[TOK]?.low).filter((x) => x > 0);
  const ratios = ok.map((d) => { let b = 0, t = 0; for (const x of d.tasks) for (const a of [x.brain, x.brainCompact]) if (a?.bytes > 0 && a?.tokens?.[TOK] > 0) { b += a.bytes; t += a.tokens[TOK]; } return t ? b / t : null; }).filter(Boolean);
  if (!loops.length || !ratios.length) return null;
  // the same numbers /proof shows (proofJson: headline.wholeTask and lean.after.wholeCompact)
  const pj = proofJson('', L, null, A), wt = pj.headline?.wholeTask || {}, withSea = pj.lean?.after?.wholeCompact;
  const text = wt.withoutText || [], html = wt.withoutHtml || [];
  const whole = withSea > 0 && text[0] > 0 && withSea < text[0] ? { with: withSea, withoutText: text, withoutHtml: html, tasks: wt.tasks, saving: text[0] - withSea, saves: r2(1 - withSea / text[0]),
    with_is: 'the brain\'s short answer (fmt=compact) and the page as Markdown', without_is: 'the search loop (modelled) and the page as plain text; raw HTML for an agent that reads it (an upper bound, never billed)',
    date: L.date, label: `bench /proof, ${dmy(L.date)}`, runs: ok.map((d) => d.file || `bench-${d.date}.json`) } : null;
  return { tokenizer: TOK, loopLow: Math.min(...loops), jsonBytesPerToken: r2(Math.min(...ratios)), runs: ok.map((d) => d.file || `bench-${d.date}.json`), date: L.date, label: `bench /proof, ${dmy(L.date)}`, whole };
}
export const BENCH = calibrate();

// what finding a solved part again would cost, the conservative end: the low end of its sourced range (/savings); for a
// confirmed pathway never more than the cheapest search loop of the bench, and never more than what the bench measured a
// whole task to save at its conservative end (without the sea, plain text, minus with it; both as /proof shows them)
export const baselineOf = (kind, cal = BENCH) => { const low = SAVE.per[kind]?.tokens?.[0] || 0; return !cal ? 0 : kind === 'path' ? Math.min(low, cal.loopLow, cal.whole ? cal.whole.saving : Infinity) : low; };
// the tokens of the answer itself, from its bytes: Markdown and HTML by the measured ratios of the reader, everything else
// (JSON) by the bytes per token of the brain's answers on the bench; rounded up
export function answerTokensOf(bytes, type = '', cal = BENCH) {
  const b = Math.max(0, Number(bytes) || 0); if (!b) return 0;
  if (/markdown/i.test(type)) return Math.ceil(b / (TOKEN_RATIO.bytes?.md || TOKEN_RATIO.md));
  if (/html/i.test(type)) return Math.ceil(b / (TOKEN_RATIO.bytes?.html || TOKEN_RATIO.html));
  return Math.ceil(b / (cal?.jsonBytesPerToken || 2.5));
}

// ------------------------------------------------------------------ one receipt, from what the ledger counted for one answer
// notes: [{ k: 'md'|'mdAgent'|'read', html, md, text|null } | { k: 'path'|'plan'|'market', n }] (node/tally.mjs)
export function shareOf({ lower = 0, modelled = 0 } = {}, P = TOKEN_PRICE) {
  // millionths of a dollar: tokens × USD per million tokens. The share is rounded down, so the agent keeps at least 80 %
  const shareTokens = lower * FAIR.rate.lower + modelled * FAIR.rate.modelled, saved = lower + modelled;
  const value = { low: Math.floor(saved * P.low), mid: Math.floor(saved * P.mid), high: Math.floor(saved * P.high) };
  const share = { low: Math.floor(shareTokens * P.low), mid: Math.floor(shareTokens * P.mid), high: Math.floor(shareTokens * P.high) };
  return { saved, value, share, keep: value.mid - share.mid, keepShare: value.mid > 0 ? r2((value.mid - share.mid) / value.mid) : 1 };
}
export function receiptOf(notes = [], { answerBytes = 0, answerType = '', field = false, cal = BENCH } = {}) {
  let lower = 0, upper = 0, answers = 0, againstText = 0; const reuses = {};
  for (const x of notes) {
    if (REUSE.has(x.k)) { reuses[x.k] = (reuses[x.k] || 0) + (Number(x.n) || 1); continue; }
    const unit = MEASURED_UNIT[x.k] || 'bytes', md = tokensOfBytes('md', x.md, unit);
    upper += Math.max(0, tokensOfBytes('html', x.html, unit) - md); answers++;
    if (x.text != null) { lower += Math.max(0, tokensOfBytes('text', x.text, unit) - md); againstText++; }
  }
  const baseline = Object.entries(reuses).reduce((s, [k, c]) => s + c * baselineOf(k, cal), 0);
  const answer = baseline > 0 ? answerTokensOf(answerBytes + (field ? FAIR.fieldBytes : 0), answerType, cal) : 0;
  const modelled = baseline > 0 ? Math.max(0, baseline - answer) : 0;
  // what pathways others laid saved, where it can be told apart: their part of the baseline, of what was spared
  const byPaths = reuses.path && baseline > 0 ? Math.floor((modelled * reuses.path * baselineOf('path', cal)) / baseline) : 0;
  const s = shareOf({ lower, modelled });
  return { tokens: { lower, upper, modelled, conservative: lower + modelled, byPaths }, counted: { answers, againstText, reuses }, modelled: baseline > 0 ? { baseline, answer } : null,
    valueMicro: s.value, shareMicro: s.share, keepMicro: s.keep, keepShare: s.keepShare };
}

// ------------------------------------------------------------------ x402 for the exact unpaid sum (the till verifies and settles)
// How the door is called and what it answers, for x402 catalogs (the bazaar extension, as the till's 402 carries it; the
// declared input validates against schema.properties.input)
const RID_EXAMPLE = 'r20261125abcd1234';
export function fairBazaar() {
  const input = { type: 'http', method: 'POST', queryParams: { r: `${RID_EXAMPLE},r20261125efgh5678` }, bodyType: 'json', body: { r: [RID_EXAMPLE] } };
  const output = { type: 'json', example: { paid: { status: 'settled', amount_usd: '0.050000', receipts: [RID_EXAMPLE] } } };
  const schema = { $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object', required: ['input'], properties: {
    input: { type: 'object', required: ['type', 'method'], properties: { type: { const: 'http' }, method: { const: 'POST' }, queryParams: { type: 'object', properties: { r: { type: 'string', description: 'the receipt ids, comma separated (the x-sea-receipt header of an answer ends with its id)' } } }, bodyType: { const: 'json' }, body: { type: 'object', properties: { r: { type: 'array', items: { type: 'string', pattern: '^r[0-9]{8}[a-z0-9]{8}$' }, maxItems: FAIR.bundleMax } } } } },
    output: { type: 'object', required: ['type'], properties: { type: { const: 'json' }, example: { type: 'object' } } } } };
  return { info: { input, output }, schema };
}
export function fairTerms(cfg, { base, ids, micro }) {
  const list = ids.join(','), digest = ids.length ? createHash('sha256').update(list).digest('hex').slice(0, 16) : '';
  const resource = !ids.length ? `${base}/fair/pay` : list.length <= 600 ? `${base}/fair/pay?r=${list}` : `${base}/fair/pay?bundle=${digest}&receipts=${ids.length}`, atomic = String(micro);
  const description = ids.length ? `Mare Liberum: the voluntary fair share of ${ids.length} receipt${ids.length === 1 ? '' : 's'}, the exact unpaid sum (${usd6(micro)} USD); you keep at least 80 % of every saving`
    : `Mare Liberum: settles the voluntary fair share of the receipts you name in ?r=, the exact unpaid sum, from ${usd6(FAIR.minMicro)} USD; without receipts nothing is due and nothing is taken`;
  const extra = { name: 'USD Coin', version: '2' };
  const outputSchema = { input: { type: 'http', method: 'POST', discoverable: true, bodyType: 'json', bodyFields: { r: { type: 'array', required: true, description: 'the receipt ids to settle (also ?r=<id>,<id> in the address)' } } }, output: { type: 'object', properties: { paid: { type: 'object', description: 'status, amount_usd, sale and the receipts settled' } } } };
  const v1 = { scheme: 'exact', network: 'base', maxAmountRequired: atomic, resource, description, mimeType: 'application/json', outputSchema, payTo: cfg.payTo, maxTimeoutSeconds: cfg.window, asset: USDC_BASE, extra };
  const v2 = { scheme: 'exact', network: 'eip155:8453', amount: atomic, asset: USDC_BASE, payTo: cfg.payTo, maxTimeoutSeconds: cfg.window, extra };
  return { cents: Math.round(micro / 1e4), usd: micro / 1e6, atomic, micro, resource, description, v1, v2, payTo: cfg.payTo, window: cfg.window };
}
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
const PAY_HDR = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' };
export function fairPaymentRequired(t, { base, error, due = [], cors = {} }) {
  const v2 = { x402Version: 2, error: error || 'PAYMENT-SIGNATURE header is required', resource: { url: t.resource, description: t.description, mimeType: 'application/json' }, accepts: [t.v2], extensions: { bazaar: fairBazaar() } };
  const body = { x402Version: 1, error: error || 'X-PAYMENT header is required', accepts: [t.v1],
    amount_usd: usd6(t.micro), unit: 'USDC on Base, 6 decimals (maxAmountRequired is in millionths of a dollar)', what: t.description,
    receipts: due.slice(0, 100).map((r) => ({ id: r.id, share_usd: usd6(r.shareMicro.mid), url: `${base}/fair/r/${r.id}` })), receipts_count: due.length,
    pay: ['x402 v2: call again with the header PAYMENT-SIGNATURE (the PAYMENT-REQUIRED header holds the terms, base64 JSON)', 'x402 v1: call again with the header X-PAYMENT (the terms are in "accepts" of this body)'],
    pay_to: t.payTo, network: 'Base (eip155:8453)', asset: 'USDC', window_seconds: t.window, rule: FAIR.rule, voluntary: FAIR.voluntary, fair: `${base}/fair`,
    note: 'No account, no key. The USDC goes from your wallet straight to the address above; the sea never holds anyone\'s money.' };
  const short = { scheme: 'exact', network: 'base', to: t.payTo, payTo: t.payTo, amount_usd: usd6(t.micro), decimals: 6, asset: 'USDC', maxTimeoutSeconds: t.window, fair: `${base}/fair` };
  return { status: 402, body, headers: { ...PAY_HDR, 'payment-required': b64(JSON.stringify(v2)), 'x402-payment-required': JSON.stringify(short), 'x-pay-to': t.payTo, 'x-settle-window': String(t.window), ...cors } };
}

// ------------------------------------------------------------------ the switch: off unless the operator says on
export const fairSwitch = (cfg = {}, env = globalThis.process?.env || {}) => /^(on|1|true|yes)$/i.test(String(cfg.fair ?? env.MARE_FAIR ?? '').trim());
// the app door under review stays byte for byte as it was: no receipt is made for it, none is sent
export const APP_DOOR = /^\/mcp\/app(\/|$)/;
const ID = /^r\d{8}[a-z0-9]{8}$/;
const dayOfId = (id) => `${id.slice(1, 5)}-${id.slice(5, 7)}-${id.slice(7, 9)}`;
const newId = (at) => `r${at.slice(0, 10).replace(/-/g, '')}${Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('')}`;
const OPEN = new Set(['pending', 'unverified']), HOLDS = new Set(['settled', 'pending', 'unverified']);
// the books of the operator: every settled payment with its time, amount, rate source and transaction (never shown by a route)
const RATE_SOURCE = 'USDC booked at 1 USD; for the books in euro the ECB euro foreign exchange reference rate (USD) of the settlement day';
const add = (a, b) => { const o = { ...(a || {}) }; for (const [k, v] of Object.entries(b || {})) o[k] = typeof v === 'number' ? (o[k] || 0) + v : v; return o; };

// ------------------------------------------------------------------ the ledger of receipts: in memory, written by the tide
export function createFair({ kv, now = () => new Date().toISOString(), base: base0 = '' } = {}) {
  const DAY = 86400;
  let pend = new Map(), inc = {};
  const locked = new Set();
  let chain = Promise.resolve();
  const serial = (fn) => (chain = chain.then(fn, fn));
  const tot = (r) => ({ receipts: 1, lower: r.tokens.lower, upper: r.tokens.upper, modelled: r.tokens.modelled, conservative: r.tokens.conservative, byPaths: r.tokens.byPaths,
    valueLow: r.valueMicro.low, valueMid: r.valueMicro.mid, valueHigh: r.valueMicro.high, shareMicro: r.shareMicro.mid, due: r.shareMicro.mid > 0 ? 1 : 0 });
  const fair = {
    // a receipt for one answer: made, kept in memory at once (its page answers right away), written by the next tide
    make(notes, o = {}) {
      const at = now(), r = { id: newId(at), at, door: o.door || '/', rule: FAIR_VERSION, ...receiptOf(notes, o) };
      pend.set(r.id, r); inc = add(inc, tot(r));
      if (pend.size > 20_000) { const first = pend.keys().next().value; pend.delete(first); }
      return r;
    },
    async get(id) {
      if (!ID.test(String(id || ''))) return null;
      return pend.get(id) || (await kv.get(`fair:d:${dayOfId(id)}`))?.[id] || null;
    },
    // many at once: each day's receipts are read once
    async getMany(ids) {
      const ok = ids.filter((id) => ID.test(String(id || ''))), days = [...new Set(ok.filter((id) => !pend.has(id)).map(dayOfId))];
      const kept = Object.fromEntries(await Promise.all(days.map(async (d) => [d, (await kv.get(`fair:d:${d}`)) || {}])));
      return ok.map((id) => pend.get(id) || kept[dayOfId(id)]?.[id] || null).filter(Boolean);
    },
    // the tide: receipts into their day (kept 31 days), the totals into the running sum
    async flush() {
      const p = pend, i = inc; pend = new Map(); inc = {};
      if (!p.size) return 0;
      const days = {}; for (const r of p.values()) (days[r.at.slice(0, 10)] ||= {})[r.id] = r;
      for (const [d, rs] of Object.entries(days)) { const cur = (await kv.get(`fair:d:${d}`)) || {}; await kv.set(`fair:d:${d}`, { ...cur, ...rs }, (FAIR.keepDays + 1) * DAY); }
      await kv.set('fair:total', add((await kv.get('fair:total')) || {}, i), 4000 * DAY);
      if (!(await kv.get('fair:since'))) await kv.set('fair:since', [...p.values()][0].at.slice(0, 10), 4000 * DAY);
      return p.size;
    },
    // the payments: one line each, the newest first; a receipt in a payment that holds (settled, or on its way) is paid
    async payments(ledger) {
      const list = (await kv.get('fair:pay')) || [];
      // what became of payments still on their way: the till's own copy of the sale knows (node/ledger.mjs)
      let changed = false;
      const landed = [];
      for (const p of list) if (OPEN.has(p.status)) { const s = ledger?.mem?.sales?.find((x) => x.id === p.sale); if (s && s.status !== p.status) { p.status = s.status; if (s.tx) p.tx = s.tx; changed = true; if (s.status === 'settled') landed.push([p, s]); } }
      if (changed) await serial(() => kv.set('fair:pay', list, 400 * DAY));
      for (const [p, s] of landed) await fair.book(p, s);
      return list;
    },
    async paidIds(ledger) { const s = new Map(); for (const p of await fair.payments(ledger)) if (HOLDS.has(p.status)) for (const id of p.ids) if (!s.has(id)) s.set(id, p); return s; },
    // payments are kept 400 days (receipts 30): a receipt in a payment that holds can never be billed again while it exists
    async record(pay) { return serial(async () => { const list = (await kv.get('fair:pay')) || []; const i = list.findIndex((x) => x.sale === pay.sale); if (i >= 0) list[i] = { ...list[i], ...pay }; else list.unshift(pay); const cut = Date.parse(now()) - 400 * DAY * 1000; await kv.set('fair:pay', list.filter((x) => !x.at || Date.parse(x.at) >= cut || OPEN.has(x.status)).slice(0, 100_000), 400 * DAY); }); },
    // into the books, once per sale, when its money is seen to arrive: time, amount, rate source, transaction, paying wallet
    async book(p, sale = {}) {
      if (p?.status !== 'settled') return false;
      return serial(async () => { const list = (await kv.get('fair:book')) || []; if (list.some((x) => x.sale === p.sale)) return false;
        list.unshift({ booked: now(), settled_at: sale.settled_at || now(), sale: p.sale, receipts: p.ids, amount_micro: p.micro, amount: usd6(p.micro), asset: 'USDC', network: 'eip155:8453', tx: sale.tx || p.tx || null, payer: sale.payer || null, rate: { source: RATE_SOURCE, day: String(sale.settled_at || now()).slice(0, 10) } });
        await kv.set('fair:book', list, 4000 * DAY); return true; });
    },
    books: async () => (await kv.get('fair:book')) || [],
    // the public ledger: receipts, tokens per basis, value, share accrued and settled, drops
    async totals(ledger) {
      const [t, since, pays] = await Promise.all([kv.get('fair:total'), kv.get('fair:since'), fair.payments(ledger)]);
      const a = add(t || {}, inc), sum = (st) => pays.filter((p) => st.has(p.status)).reduce((s, p) => s + (p.micro || 0), 0);
      return { since: since || (pend.size ? [...pend.values()][0].at.slice(0, 10) : null), receipts: a.receipts || 0, due: a.due || 0,
        tokens: { lower: a.lower || 0, modelled: a.modelled || 0, upper: a.upper || 0, conservative: a.conservative || 0 },
        valueMicro: { low: a.valueLow || 0, mid: a.valueMid || 0, high: a.valueHigh || 0 }, shareMicro: a.shareMicro || 0,
        settledMicro: sum(new Set(['settled'])), onItsWayMicro: sum(OPEN), payments: pays.filter((p) => HOLDS.has(p.status)).length,
        drops: { total: r2((a.conservative || 0) / FAIR.drop), byPaths: r2((a.byPaths || 0) / FAIR.drop) } };
    },
    // the newest receipts, for the public ledger (memory first, then today and yesterday as the tide wrote them)
    async recent(limit = 20) {
      const d0 = now().slice(0, 10), d1 = new Date(Date.parse(d0) - 864e5).toISOString().slice(0, 10);
      const kept = [...Object.values((await kv.get(`fair:d:${d0}`)) || {}), ...Object.values((await kv.get(`fair:d:${d1}`)) || {})];
      const all = new Map([...kept.map((r) => [r.id, r]), ...[...pend.values()].map((r) => [r.id, r])]);
      return [...all.values()].sort((x, y) => (x.at < y.at ? 1 : -1)).slice(0, limit);
    },
    // settlement: x402 for the exact unpaid sum of the receipts named; below the minimum it says so and asks to bundle
    async pay({ ids, headers, body, payCfg, ledger, base = base0, callerHash, waitUntil, get, cors = {} }) {
      const want = [...new Set((ids || []).map((x) => String(x).trim().toLowerCase()).filter(Boolean))];
      if (!want.length) {
        // a payment that names no receipt settles nothing: it is refused before anyone is asked, and nothing is charged
        if (paymentOf(headers, body || {})) return { status: 400, body: { error: { code: 'INVALID_ARGUMENT', message: `a payment settles the receipts it names: POST ${base}/fair/pay?r=<id>[,<id>…]. Nothing was charged.` }, fair: `${base}/fair` }, headers: { ...PAY_HDR, ...cors } };
        // a call that names none (a catalog checking the door) gets the terms of the door, in both shapes of x402
        return fairPaymentRequired(fairTerms(payCfg, { base, ids: [], micro: FAIR.minMicro }), { base, cors, error: `name the receipts to settle: POST ${base}/fair/pay?r=<id>,<id> answers with their exact unpaid sum; without receipts nothing is due` });
      }
      if (want.length > FAIR.bundleMax) return { status: 400, body: { error: { code: 'INVALID_ARGUMENT', message: `at most ${FAIR.bundleMax} receipts in one payment` } }, headers: { ...PAY_HDR, ...cors } };
      const found = await fair.getMany(want), seen = new Set(found.map((r) => r.id)), unknown = want.filter((id) => !seen.has(id));
      if (!found.length) return { status: 404, body: { error: { code: 'NOT_FOUND', message: `no such receipt on this node (receipts are kept ${FAIR.keepDays} days)` }, unknown }, headers: { ...PAY_HDR, ...cors } };
      const paid = await fair.paidIds(ledger);
      const already = found.filter((r) => paid.has(r.id)).map((r) => ({ id: r.id, sale: paid.get(r.id).sale, status: paid.get(r.id).status }));
      const zero = found.filter((r) => !(r.shareMicro.mid > 0)).map((r) => r.id);
      const due = found.filter((r) => r.shareMicro.mid > 0 && !paid.has(r.id));
      const micro = due.reduce((s, r) => s + r.shareMicro.mid, 0), tell = { already_paid: already.length ? already : undefined, nothing_due: zero.length ? zero : undefined, unknown: unknown.length ? unknown : undefined };
      if (!due.length) return { status: 200, body: { payable: false, reason: 'nothing is due on these receipts: each one is paid or saved nothing on the billed bases', ...tell, fair: `${base}/fair` }, headers: { ...PAY_HDR, ...cors } };
      if (micro < FAIR.minMicro) { const missing = Math.ceil((FAIR.minMicro - micro) / (micro / due.length)), fits1 = due.length + missing <= FAIR.bundleMax;
        return { status: 200, body: { payable: false, reason: 'below the minimum', open_usd: usd6(micro), minimum_usd: usd6(FAIR.minMicro), receipts: due.map((r) => r.id), receipts_missing: missing, missing_is: 'about this many more receipts like these, at their average share',
          ...(fits1 ? {} : { too_small: `at these shares the minimum takes more receipts than one payment bundles (${FAIR.bundleMax}): nothing is due now; receipts are kept ${FAIR.keepDays} days` }), ...tell,
          bundle: `One payment settles at least ${usd6(FAIR.minMicro)} USD: ${FAIR.minWhy} (${FAIR.minSource}). Keep the receipt ids of your answers and pay them together: POST ${base}/fair/pay?r=<id>,<id>,… or {"r":[…]} in the body (up to ${FAIR.bundleMax}).`, voluntary: FAIR.voluntary }, headers: { ...PAY_HDR, ...cors } }; }
      const t = fairTerms(payCfg, { base, ids: due.map((r) => r.id), micro }), pay = paymentOf(headers, body || {});
      if (!pay) return fairPaymentRequired(t, { base, due, cors });
      if (pay.bad) return fairPaymentRequired(t, { base, error: pay.bad, due, cors });
      // a receipt is never billed twice: one payment at a time for each receipt
      if (due.some((r) => locked.has(r.id))) return { status: 409, body: { error: { code: 'ABORTED', message: 'a payment for one of these receipts is being taken right now; nothing was charged. Ask again in a moment.' } }, headers: { ...PAY_HDR, 'retry-after': '5', ...cors } };
      for (const r of due) locked.add(r.id);
      try {
        const ids2 = due.map((r) => r.id), at = now();
        const r = await takePayment({ cfg: payCfg, t, pay, q: `fair share of ${ids2.length} receipt${ids2.length === 1 ? '' : 's'}: ${ids2.join(',')}`.slice(0, 300), ledger, callerHash, waitUntil, get, base, label: 'fair', extra: { amount_micro: micro, kind: 'fair' },
          work: async (sale) => { await fair.record({ sale: sale.id, ids: ids2, micro, status: sale.status, at }); return { receipts: ids2 }; } });
        if (r.refuse) return fairPaymentRequired(t, { base, error: r.refuse, due, cors });
        await fair.record({ sale: r.sale.id, status: r.sale.status, ...(r.sale.tx ? { tx: r.sale.tx } : {}) });
        if (r.sale.status === 'settled') await fair.book({ sale: r.sale.id, ids: ids2, micro, status: 'settled', tx: r.sale.tx }, ledger?.mem?.sales?.find((x) => x.id === r.sale.id) || r.sale);
        const said = { settled: 'paid and settled on Base. Thank you.', pending: 'the payment holds; its settlement is on its way', unverified: 'taken before the payment could be checked; written down as unverified', unsettled: 'the payment was checked but did not settle: the receipts stay unpaid' }[r.sale.status];
        return { status: 200, body: { paid: { status: r.sale.status, amount_usd: usd6(micro), sale: r.sale.id, tx: r.sale.tx || undefined, receipts: ids2, note: said, why: r.reason || undefined }, ...tell, fair: `${base}/fair`, treasury: `${base}/treasury`, thanks: 'The sea only receives. What it takes in is public at /fair and /treasury.' }, headers: { ...PAY_HDR, ...(r.headers || {}), ...cors } };
      } finally { for (const r of due) locked.delete(r.id); }
    },
    state: () => ({ waiting: pend.size, locked: locked.size }),
  };
  return fair;
}

// ------------------------------------------------------------------ the receipt on the answer: headers, and a field in JSON objects
const EXPOSE = 'x-sea-saved-tokens,x-sea-fair-share-usd,x-sea-receipt';
const compactOf = (r, base) => ({ id: r.id, saved_tokens: r.tokens.conservative, fair_share_usd: usd6(r.shareMicro.mid), voluntary: true, url: `${base}/fair/r/${r.id}` });
// the field goes in as the last member of the object, in the object's own layout; what does not read back as the same
// object with the field is sent as it was
export function withField(text, key, value) {
  const end = text.lastIndexOf('}'); if (end < 0) return text;
  const head = text.slice(0, end).replace(/\s+$/, ''), sep = head.endsWith('{') ? '' : /\n"/.test(text) ? ',\n' : ',';
  const out = `${head}${sep}${JSON.stringify(key)}:${JSON.stringify(value)}${text.slice(end)}`;
  try { const a = JSON.parse(text), b = JSON.parse(out); return JSON.stringify(b[key]) === JSON.stringify(value) && Object.keys(b).length === Object.keys(a).length + 1 ? out : text; } catch { return text; }
}
// res: the answer as made; notes: what the ledger counted for it. Returns the same answer when nothing was counted (the
// very same object), else the answer with its receipt
export async function sealFair(res, notes, { path = '/', base = '', fair } = {}) {
  if (!notes?.length || !fair || !res || res.status !== 200 || APP_DOOR.test(path)) return res;
  const type = res.headers.get('content-type') || '', isJson = /^application\/(json|[a-z.+-]*\+json)/i.test(type), reuse = notes.some((x) => REUSE.has(x.k));
  let text = null;
  if ((reuse || isJson) && res.body) { try { text = await res.text(); } catch { return res; } }
  // a JSON object gets the field; a JSON-RPC envelope (MCP, A2A) or a list gets the headers only: strict clients refuse members they do not know
  let obj = false;
  if (isJson && text != null && /^\s*\{/.test(text)) { try { const v = JSON.parse(text); obj = !!v && typeof v === 'object' && !Array.isArray(v) && !('jsonrpc' in v) && !('receipt' in v); } catch {} }
  const door = notes.find((x) => x.door)?.door || `/${(path.split('/')[1] || '').slice(0, 24)}`;
  const r = fair.make(notes, { answerBytes: text != null ? bytesOf(text) : 0, answerType: type, field: obj, door });
  const headers = new Headers(res.headers);
  headers.set('x-sea-saved-tokens', String(r.tokens.conservative));
  headers.set('x-sea-fair-share-usd', usd6(r.shareMicro.mid));
  headers.set('x-sea-receipt', `${base}/fair/r/${r.id}`);
  const ex = headers.get('access-control-expose-headers'); headers.set('access-control-expose-headers', ex ? `${ex},${EXPOSE}` : EXPOSE);
  headers.delete('content-length');
  const out = obj ? withField(text, 'receipt', compactOf(r, base)) : text;
  return new Response(out ?? res.body, { status: res.status, statusText: res.statusText, headers });
}
// one request with a tally around it, sealed at the end (node/core.mjs handle, only when fair share is on)
export async function withReceipt(fn, { path, base, fair }) {
  const { tally, out } = await tallyRun(fn);
  const notes = tallyClose(tally);
  try { return await sealFair(out, notes, { path, base, fair }); } catch (e) { console.error('mare_fair', String(e?.message || e)); return out; }
}

// ------------------------------------------------------------------ the public receipt, the page, the data
const statusOf = (r, paid) => { const p = paid?.get?.(r.id); if (p) return p.status === 'settled' ? 'retired: paid and settled on chain, never billed again' : `retired: paid (${p.status}), never billed again`; return r.shareMicro.mid > 0 ? 'due (voluntary)' : 'nothing due: no saving on the billed bases'; };
export function receiptJson(base, r, paid) {
  const p = paid?.get?.(r.id);
  return { id: r.id, at: r.at, door: r.door, rule: { version: r.rule, sentence: FAIR.rule, page: `${base}/fair` },
    tokens: { lower: r.tokens.lower, modelled: r.tokens.modelled, upper: r.tokens.upper, conservative: r.tokens.conservative, unit: 'input tokens the agent did not have to read' },
    bases: Object.fromEntries(BASES.map((b) => [b.id, { rate: b.rate, how: b.how, what: b.what }])),
    counted: r.counted, modelled: r.modelled ? { baseline: r.modelled.baseline, answer: r.modelled.answer, read: 'what finding the solved parts again would have cost, minus the tokens of the answer that handed them over' } : undefined,
    value_usd: { low: usd6(r.valueMicro.low), mid: usd6(r.valueMicro.mid), high: usd6(r.valueMicro.high), of: 'the conservative tokens (lower + modelled) at the rate card of /savings: USD 0.10, 2 and 8 per million input tokens', note: FAIR.usdNote },
    fair_share_usd: { mid: usd6(r.shareMicro.mid), low: usd6(r.shareMicro.low), high: usd6(r.shareMicro.high), rate: FAIR.rate, billed: 'mid', voluntary: true, note: FAIR.usdNote },
    you_keep: { usd: usd6(r.keepMicro), share_of_saving: r.keepShare, note: FAIR.usdNote }, drops: r2(r.tokens.conservative / FAIR.drop), drop: FAIR.drops, method: { version: r.rule, page: `${base}/fair#method` },
    status: statusOf(r, paid), paid: p ? { status: p.status, sale: p.sale, at: p.at } : undefined,
    pay: r.shareMicro.mid > 0 && !p ? { post: `${base}/fair/pay?r=${r.id}`, minimum_usd: usd6(FAIR.minMicro), bundle: `below the minimum alone: pay several together, POST ${base}/fair/pay?r=${r.id},<id>,…` } : undefined,
    voluntary: FAIR.voluntary, holds: 'no address and no caller hash' };
}
export function receiptPage(base, r, paid) {
  const j = receiptJson(base, r, paid);
  const rows = [['lower: measured against plain text', j.tokens.lower, '20 %'], ['modelled: a solved part reused, calibrated on the bench', j.tokens.modelled, '10 %'], ['upper: measured against raw HTML (shown, never billed)', j.tokens.upper, '0 %']];
  return page(base, `/fair/r/${r.id}`, `Receipt ${r.id} — what the sea saved one answer | Mare Liberum`, `One receipt of the open sea: ${n(j.tokens.conservative)} tokens saved on the conservative basis, a fair share of ${j.fair_share_usd.mid} USD, voluntary.`,
    `<h1>Receipt of one answer</h1><p class="pulse"><b>${n(j.tokens.conservative)}</b> tokens saved on the conservative basis · fair share <b>${money(r.shareMicro.mid)}</b>, voluntary · ${esc(j.status)}</p><p><small>Every dollar figure here: ${esc(FAIR.usdNote)}.</small></p>
<div class="tw"><table class="tbl"><thead><tr><th>basis</th><th>tokens</th><th>share</th></tr></thead><tbody>${rows.map(([a, b, c]) => `<tr><td>${esc(a)}</td><td>${n(b)}</td><td>${c}</td></tr>`).join('')}</tbody></table></div>
${j.modelled ? `<p>Modelled: finding the solved parts again would have cost about ${n(j.modelled.baseline)} tokens; the answer that handed them over cost ${n(j.modelled.answer)} (measured). ${j.tokens.modelled ? `The difference, ${n(j.tokens.modelled)}, is the saving.` : 'The answer cost as much or more: no saving, no share.'}</p>` : ''}
<p>Value of the saving at the rate card of <a href="/savings">/savings</a>: ${money(r.valueMicro.mid)} (${money(r.valueMicro.low)} at a small model, ${money(r.valueMicro.high)} at the top model). You keep ${money(r.keepMicro)} of it, ${Math.round(j.you_keep.share_of_saving * 100)} % (${esc(FAIR.usdNote)}). Drops: ${j.drops}, a count on the server only.</p>
<p><small>Issued ${esc(r.at.slice(0, 16).replace('T', ' '))} UTC at <code>${esc(r.door)}</code> · rule ${esc(r.rule)} · ${esc(FAIR.voluntary)} This receipt holds no address and no caller hash.</small></p>
${j.pay ? `<h2>Pay it</h2><pre>curl -si -X POST '${esc(j.pay.post)}'</pre><p><small>The answer is 402 with the exact sum; an x402 client pays it. One payment settles at least ${money(FAIR.minMicro)}: ${esc(j.pay.bundle)}.</small></p>` : ''}
<p><small><a href="/fair">The rules and the public ledger</a> · as data: <a href="/fair/r/${esc(r.id)}.json">/fair/r/${esc(r.id)}.json</a></small></p>`, undefined, '/og.png', { robots: 'noindex, follow' });
}

export async function fairData(base, fair, { on, ledger } = {}) {
  const [t, recent, paid] = await Promise.all([fair.totals(ledger), fair.recent(12), fair.paidIds(ledger)]);
  const P = TOKEN_PRICE, w = BENCH?.whole;
  return { what: 'fair share: the sea asks only for a share of what it measurably saves an agent', rule: FAIR.rule, version: FAIR_VERSION, on: !!on,
    issuing: on ? 'receipts are issued on every answer the savings ledger counts' : 'this node issues no receipts now: fair share is switched off (or rests)',
    bases: BASES, rates: FAIR.rate, keepAtLeast: FAIR.keepAtLeast,
    price: { unit: P.unit, low: P.low, mid: P.mid, high: P.high, asOf: P.asOf, receiptsValueAt: 'mid', page: `${base}/savings` },
    calibration: BENCH ? { label: BENCH.label, loopLow: BENCH.loopLow, wholeSaving: BENCH.whole?.saving ?? null, jsonBytesPerToken: BENCH.jsonBytesPerToken, tokenizer: BENCH.tokenizer, runs: BENCH.runs, proof: `${base}/proof`, baselines: Object.fromEntries(Object.keys(SAVE.per).map((k) => [k, baselineOf(k)])) } : null,
    live: { since: t.since, receipts: t.receipts, receiptsWithShare: t.due, tokens: t.tokens,
      valueCreatedUsd: { low: usd6(t.valueMicro.low), mid: usd6(t.valueMicro.mid), high: usd6(t.valueMicro.high), of: 'the conservative tokens (lower + modelled)', note: FAIR.usdNote },
      fairShareAccruedUsd: usd6(t.shareMicro), fairShareAccruedNote: `voluntary; ${FAIR.usdNote}`, fairShareSettledOnChainUsd: usd6(t.settledMicro), fairShareSettledNote: FAIR.settledNote, paidOnItsWayUsd: usd6(t.onItsWayMicro), paidOnItsWayNote: FAIR.settledNote, payments: t.payments, drops: t.drops, usdNote: FAIR.usdNote,
      micro: { valueLow: t.valueMicro.low, valueMid: t.valueMicro.mid, valueHigh: t.valueMicro.high, accrued: t.shareMicro, settled: t.settledMicro, onItsWay: t.onItsWayMicro, unit: 'millionths of a US dollar (USDC base units)' } },
    drop: FAIR.drops, method: METHOD, voluntary: FAIR.voluntary,
    calculator: w ? { bench: { label: w.label, date: w.date, with: w.with, withoutText: w.withoutText, withoutHtml: w.withoutHtml, tasks: w.tasks, saves: w.saves, with_is: w.with_is, without_is: w.without_is, median: true, tokenizer: BENCH.tokenizer, proof: `${base}/proof`, runs: w.runs.map((f) => `${base}/proof/${f}`) }, rate: FAIR.rate.modelled, priceMid: P.mid, note: 'the bench is a default, not a promise: receipts measure each answer', usdNote: FAIR.usdNote } : null,
    pay: { how: `POST ${base}/fair/pay?r=<id>[,<id>…]`, minimumUsd: usd6(FAIR.minMicro), bundleMax: FAIR.bundleMax, x402: 'the answer is 402 with the exact unpaid sum; pay it with PAYMENT-SIGNATURE (v2) or X-PAYMENT (v1)', headers: ['x-sea-saved-tokens (conservative basis)', 'x-sea-fair-share-usd', 'x-sea-receipt (the receipt\'s address)'], field: 'JSON answers that are an object carry "receipt": {id, saved_tokens, fair_share_usd, voluntary, url}; MCP and A2A answers carry the headers only', receipts: `${base}/fair/r/<id>(.json)`, keptDays: FAIR.keepDays },
    recent: recent.map((r) => ({ id: r.id, at: r.at, door: r.door, conservative: r.tokens.conservative, upper: r.tokens.upper, shareUsd: usd6(r.shareMicro.mid), shareNote: FAIR.usdNote, shareMicro: r.shareMicro.mid, status: statusOf(r, paid), url: `${base}/fair/r/${r.id}` })),
    never: [FAIR.voluntary, 'The sea only receives: no bot of the sea pays, no wallet of the sea pays out, nothing is minted, sold or transferred.', 'Crawlers and the sea\'s own calls get no receipt; the house agent (Angel) and the app door (/mcp/app) get none either.', 'A receipt in a payment is retired: it is never counted or billed again.', FAIR.drops],
    links: { savings: `${base}/savings`, proof: `${base}/proof`, pricing: `${base}/pricing`, treasury: `${base}/treasury`, open: `${base}/open` } };
}

const STYLE = `<style>
.fnums{display:grid;grid-template-columns:repeat(auto-fit,minmax(10.5rem,1fr));gap:var(--s3,16px) var(--s4,24px);margin:var(--s3,16px) 0 var(--s5,32px);padding:0;list-style:none}
.fnums li{margin:0;display:grid;gap:2px}
.fnums b{font:italic 650 clamp(26px,2.2vw + 12px,36px)/1.05 var(--text);font-variant-numeric:tabular-nums;letter-spacing:-.01em;white-space:nowrap}
.fnums span{color:var(--mist);font-size:14.5px;line-height:1.35}
.said p.hero-n b{display:block;font:italic 650 clamp(52px,7vw,104px)/.95 var(--text);color:var(--foam);letter-spacing:-.02em;margin-bottom:6px;font-variant-numeric:lining-nums}
.said p.hero-n{color:var(--mist)}
.calc{display:grid;grid-template-columns:repeat(auto-fit,minmax(12rem,1fr));gap:var(--s3,16px);align-items:end;margin:var(--s3,16px) 0}
.calc label{display:grid;gap:6px;color:var(--mist);font-size:14.5px}
.calc input,.calc select{font:inherit;font-variant-numeric:tabular-nums;padding:10px 12px;border-radius:10px;border:1px solid var(--line-2,#2a4157);background:rgba(4,21,43,.6);color:var(--foam,#eef6fb);min-width:0}
.calc output{display:block}
.split{display:flex;height:14px;border-radius:7px;overflow:hidden;margin:var(--s3,16px) 0 6px;background:var(--line,#1b3048)}
.split i{display:block;height:100%;background:var(--sea);transition:width .6s var(--ease,ease)}
.split i.s{background:var(--violet)}
@media (prefers-reduced-motion:reduce){.split i{transition:none}}
</style>`;
const CALC = `<script>(()=>{const f=document.getElementById('fcalc');if(!f)return;const g=(k)=>Number(f.elements[k].value)||0,fm=(x,d)=>x.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}),o=(k,v)=>{const e=document.querySelector('[data-o="'+k+'"]');if(e)e.textContent=v};
const run=()=>{const pages=g('pages'),per=g('per'),save=g('save')/100,rate=Number(f.elements.basis.value),mid=Number(f.dataset.mid);const saved=Math.round(pages*per*save),value=saved*mid/1e6,share=Math.floor(saved*rate*mid)/1e6,net=value-share;
o('saved',fm(saved,0));o('value',fm(value,2));o('share',fm(share,2));o('net',fm(net,2));o('keep',value>0?fm(100*net/value,0):'100');const s=document.querySelector('.split');if(s&&value>0){s.children[0].style.width=(100*net/value)+'%';s.children[1].style.width=(100*share/value)+'%'}};
f.addEventListener('input',run);run();})();</script>`;
export function fairPage(base, v) {
  const L = v.live, c = v.calculator, P = v.price;
  const ld = { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Fair share: the sea asks only for a share of what it saves', url: `${base}/fair`, isPartOf: { '@type': 'WebSite', name: 'Mare Liberum', url: `${base}/` } };
  const nums = (list) => `<ul class="fnums">${list.map(([x, label]) => `<li><b>${x}</b><span>${esc(label)}</span></li>`).join('')}</ul>`;
  const bench = c ? `a whole task cost ${n(c.bench.with)} tokens with the sea (${c.bench.with_is}) against ${n(c.bench.withoutText[0])}–${n(c.bench.withoutText[1])} without it for an agent whose tool hands it plain text${c.bench.withoutHtml?.[0] ? ` (${n(c.bench.withoutHtml[0])}–${n(c.bench.withoutHtml[1])} for one that reads raw HTML: an upper bound, never billed)` : ''}; medians of ${n(c.bench.tasks)} tasks, ${c.bench.tokenizer}` : '';
  const body = `${STYLE}<h1>Fair share, in public</h1>
<p class="hero-n"><b>${money(L.micro.settled)}</b>settled on chain (${esc(FAIR.settledNote)}) · voluntary fair share accrued ${money(L.micro.accrued)} from ${n(L.receipts)} ${L.receipts === 1 ? 'receipt' : 'receipts'} (${esc(FAIR.usdNote)})</p>
<p class="pulse">${esc(FAIR.rule)}</p>
<p>Every token an agent reads costs its owner money, and the sea saves agents tokens. So it asks for nothing up front and nothing per call: only a share of what it measurably saved, after the fact, on a receipt anyone can read, and paying it is voluntary. You save a hundred, you give at most twenty, you are still eighty ahead. ${v.on ? 'Every answer the savings ledger counts carries a receipt.' : '<b>This node issues no receipts right now</b>: fair share is switched off or rests; the rules below hold as soon as it is on.'}</p>
<h2>Three bases, one rule</h2>
<div class="tw"><table class="tbl"><thead><tr><th>basis</th><th>how it is found</th><th>share</th></tr></thead><tbody>${v.bases.map((b) => `<tr><td><b>${esc(b.name)}</b></td><td>${esc(b.short || b.what)}</td><td>${Math.round(b.rate * 100)} %</td></tr>`).join('')}</tbody></table></div>
<p>Valued at the rate card of <a href="/savings">/savings</a>: USD ${P.low.toFixed(2)} (a small model), <b>${P.mid.toFixed(2)}</b> (a workhorse model, what a receipt bills) and ${P.high.toFixed(2)} (the top model) per million input tokens, as of ${esc(P.asOf)}. The share is rounded down: the agent keeps at least ${Math.round(FAIR.keepAtLeast * 100)} % of every saving. No saving, no share. ${v.calibration ? `Calibration from the <a href="/proof">${esc(v.calibration.label)}</a> (${esc(v.calibration.tokenizer)}): a reused pathway counts at most the cheapest search loop, ${n(v.calibration.loopLow)} tokens${v.calibration.wholeSaving ? `, and never more than a whole task saved there at the conservative end, ${n(v.calibration.wholeSaving)}` : ''}; the brain's answers hold ${v.calibration.jsonBytesPerToken} bytes a token.` : 'No run of the bench is on this node: no modelled saving is claimed.'}</p>
<h2>The ledger, live</h2>
${nums([[n(L.receipts), 'receipts issued'], [n(L.tokens.lower), 'tokens saved, lower basis (measured, against plain text)'], [n(L.tokens.modelled), 'tokens saved, modelled basis (calibrated on the bench)'], [n(L.tokens.upper), 'tokens saved against raw HTML (upper, never billed)'], [money(L.micro.valueMid), `value created for agents on the conservative basis (${money(L.micro.valueLow)} to ${money(L.micro.valueHigh)})`], [money(L.micro.accrued), 'fair share accrued'], [money(L.micro.settled), 'fair share settled on chain'], [n(L.drops.total), 'drops: thousands of tokens saved, conservative'], [n(L.drops.byPaths), 'drops saved for others by pathways agents laid']])}
<p><small>Dollar figures above: ${esc(FAIR.usdNote)}; the sum settled on chain is ${esc(FAIR.settledNote)}. ${L.since ? `Counting since ${esc(L.since)}.` : 'Nothing counted yet.'} ${L.payments ? `${n(L.payments)} ${L.payments === 1 ? 'payment' : 'payments'}; ${money(L.micro.onItsWay)} paid and still on its way to the chain.` : 'No payment yet: zero stays zero.'} ${esc(FAIR.drops)}</small></p>
<h2>What would you keep?</h2>
${c ? `<form id="fcalc" class="calc" data-mid="${P.mid}" onsubmit="return false"><label>Pages or tasks a month<input name="pages" type="number" min="0" step="100" value="10000" inputmode="numeric"></label><label>Tokens each costs you today<input name="per" type="number" min="0" step="1" value="${c.bench.withoutText[0]}" inputmode="numeric"></label><label>Saved by the sea, %<input name="save" type="number" min="0" max="100" step="1" value="${Math.round(c.bench.saves * 100)}" inputmode="numeric"></label><label>Basis<select name="basis"><option value="${FAIR.rate.modelled}">modelled: a solved part reused (10 %)</option><option value="${FAIR.rate.lower}">lower: measured against plain text (20 %)</option></select></label></form>
<div class="split" aria-hidden="true"><i style="width:90%"></i><i class="s" style="width:10%"></i></div>
<p class="pulse">Saved <b><output data-o="saved">–</output></b> tokens a month, worth <b>$<output data-o="value">–</output></b> at $${P.mid.toFixed(2)} a million · fair share <b>$<output data-o="share">–</output></b> · you keep <b>$<output data-o="net">–</output></b> (<output data-o="keep">–</output> %)</p><p><small>${esc(FAIR.usdNote)}; the share stays voluntary.</small></p>
<p><small>Defaults from the <a href="/proof">${esc(c.bench.label)}</a>: ${esc(bench)}. The low end of “without” is taken. Your pages are not the bench: change them. Receipts measure each answer for real.</small></p>${CALC}` : '<p class="muted">No run of the bench on this node: the calculator needs one.</p>'}
<h2>How an agent pays</h2>
<p>Every counted answer names its receipt in three headers: <code>x-sea-saved-tokens</code> (conservative basis), <code>x-sea-fair-share-usd</code> and <code>x-sea-receipt</code>; a JSON answer that is an object also carries <code>"receipt"</code>. Collect the ids and settle them in one x402 payment, no account:</p>
<pre>curl -si -X POST '${esc(base)}/fair/pay?r=&lt;id&gt;,&lt;id&gt;'
# 402 Payment Required: the exact unpaid sum in the PAYMENT-REQUIRED header (x402 v2) and in "accepts" (v1)
# an x402 client signs it and calls again with PAYMENT-SIGNATURE: the receipts are marked paid, never billed twice</pre>
<p><small>Voluntary, and never a condition for an answer. One payment settles at least ${money(FAIR.minMicro)}: ${esc(FAIR.minWhy)} (<a href="${esc(FAIR.minSource)}" rel="noopener">PayAI pricing</a>). Below that the answer gives the open sum and about how many receipts are still missing, without asking for payment; bundle up to ${n(v.pay.bundleMax)} receipts at once. The USDC goes from the agent's wallet straight to the sea's address on Base; the sea never holds anyone's money. Receipts are kept ${n(FAIR.keepDays)} days.</small></p>
<h2>The newest receipts</h2>
${v.recent.length ? `<div class="tw"><table class="tbl"><thead><tr><th>receipt</th><th>door</th><th>saved, conservative</th><th>upper</th><th>share</th><th>status</th></tr></thead><tbody>${v.recent.slice(0, 6).map((r) => `<tr><td><a href="/fair/r/${esc(r.id)}">${esc(r.at.slice(5, 16).replace('T', ' '))}</a></td><td><code>${esc(r.door)}</code></td><td>${n(r.conservative)}</td><td>${n(r.upper)}</td><td>${money(r.shareMicro)}</td><td>${esc(r.status)}</td></tr>`).join('')}</tbody></table></div><p><small>Shares: ${esc(FAIR.usdNote)}. Every receipt of the last ${n(FAIR.keepDays)} days answers at its own address; the newest ${n(v.recent.length)} are in <a href="/fair.json">/fair.json</a>.</small></p>` : '<p class="muted">No receipt yet.</p>'}
<h2 id="method">The method, rule ${esc(v.method.version)}</h2><ol><li><b>Bases.</b> ${esc(v.method.bases)}.</li><li><b>Value.</b> ${esc(v.method.valuation)}.</li><li><b>Share.</b> ${esc(v.method.share)}.</li><li><b>Conservative.</b> ${esc(v.method.conservative)}.</li><li><b>Registry.</b> ${esc(v.method.registry)}.</li><li><b>Drops.</b> ${esc(v.method.drops)}.</li></ol><p><small>Every receipt names the rule it was made under; a new rule gets a new version, and old receipts keep theirs.</small></p>
<h2>What it never does</h2><ul>${v.never.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
<p><small>What the brain saves: <a href="/savings">/savings</a> · how it is measured: <a href="/proof">/proof</a> · every price: <a href="/pricing">/pricing</a> · what the till took in: <a href="/treasury">/treasury</a> · as data: <a href="/fair.json">/fair.json</a> · for agents: <a href="/fair.md">/fair.md</a></small></p>`;
  return page(base, '/fair', 'Fair share — the sea asks only for a share of what it saves you | Mare Liberum', `Free to enter. When the sea saves an agent tokens, it asks for a fair share of the saving: the agent keeps at least 80 %. Receipts, bases and every total in public; paying is voluntary.`, body, ld);
}
