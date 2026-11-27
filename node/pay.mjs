// Mare Liberum · the till: the one paid move of the sea
// Everything in the sea stays free except one move: POST /route?q=<task> answers with the best paths for that task.
// It costs a few cents in USDC on Base and is paid the way agents pay without an account, x402:
//   1. the first call gets 402 Payment Required with the terms: the PAYMENT-REQUIRED header (x402 v2), the same terms
//      in the body (x402 v1), and for agents without an x402 client a plain line: send the USDC, then POST /settle
//   2. the agent signs a transfer of exactly that amount to the sea's wallet and calls again with PAYMENT-SIGNATURE
//      (v2) or X-PAYMENT (v1)
//   3. a facilitator checks the signature and moves the USDC from the agent's wallet straight to the sea's wallet;
//      the facilitator never holds the money and neither does the sea
// The hard rule of the till: an agent that wants to pay is never turned away by the sea's own trouble. When the
// payment cannot be checked (no facilitator, the facilitator does not answer) the agent gets what it paid for at once
// and the sale is written down as unverified. A payment the facilitator itself refuses is answered with 402 again,
// with the reason, and nothing is delivered for it.
import { Buffer } from 'node:buffer';
import { USDC_BASE, HOUSE_WALLET, priceOf, pricingOf } from './pricing.mjs';

// price, wallet and token live in node/pricing.mjs, the one place that writes them down
export { USDC_BASE, HOUSE_WALLET };
// a public facilitator for Base that needs no key (free up to 10,000 settlements a month); MARE_X402_FACILITATOR
// names another one, "off" switches checking off (every sale is then unverified)
export const FACILITATOR = 'https://facilitator.payai.network';
const WALLET = /^0x[0-9a-fA-F]{40}$/, TXHASH = /^0x[0-9a-fA-F]{64}$/;
const UA = 'MareLiberum-Till/1.0 (+https://mareliberum.dev/job)';
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');

export function payConfig(env = process.env) {
  const f = String(env.MARE_X402_FACILITATOR ?? '').trim();
  // the price of the move (1 to 5 US cents, 2 when nothing else is set) and the wallet: node/pricing.mjs
  const { cents, payTo } = priceOf(env);
  return {
    payTo, cents,
    window: 300,
    facilitator: /^(off|none|0|false)$/i.test(f) ? null : /^https:\/\/[^\s]+$/.test(f) ? f.replace(/\/+$/, '') : FACILITATOR,
    verifyMs: 6000, settleWaitMs: 12000, settleMs: 60000,
  };
}

// how the paid move is called and what it answers, for discovery catalogs (the x402 "bazaar" extension): a facilitator
// that settles a payment carrying it lists the move in its catalog, so paying agents find it (since 3.29.0)
export function bazaarOf(base) {
  return { info: {
    input: { type: 'http', method: 'POST', bodyType: 'json', body: { q: 'find usdc price' } },
    output: { type: 'json', example: { task: 'find usdc price', count: 10, paths: [{ rank: 1, title: 'a USDC price API', kind: 'x402', from: 'the open index', to: `${base}/via/<token>?q=find+usdc+price`, why: 'a place from the open index; paid per call via x402' }], next: { now: 'GET the first "to"' } } },
  } };
}

// the terms of one sale, in both shapes x402 knows
export function termsFor(cfg, { base, q, path = '/route' }) {
  const resource = q ? `${base}${path}?q=${encodeURIComponent(q)}` : `${base}${path}`;
  const atomic = String(cfg.cents * 10000); // USDC has 6 decimals: 1 cent = 10,000
  const description = 'Mare Liberum: the 10 best agent paths for your task, each a /via/ address, ranked with reasons and the next step';
  const extra = { name: 'USD Coin', version: '2' };
  // v1 catalogs read the call from outputSchema (discoverable: true)
  const outputSchema = { input: { type: 'http', method: 'POST', discoverable: true, bodyType: 'json', bodyFields: { q: { type: 'string', required: true, description: 'the task in plain words' } } }, output: { type: 'object', properties: { task: { type: 'string' }, count: { type: 'number' }, paths: { type: 'array', description: 'the 10 best agent paths, each a /via/ address, with rank, title, why and score' }, next: { type: 'object' } } } };
  const v1 = { scheme: 'exact', network: 'base', maxAmountRequired: atomic, resource, description, mimeType: 'application/json', outputSchema, payTo: cfg.payTo, maxTimeoutSeconds: cfg.window, asset: USDC_BASE, extra };
  const v2 = { scheme: 'exact', network: 'eip155:8453', amount: atomic, asset: USDC_BASE, payTo: cfg.payTo, maxTimeoutSeconds: cfg.window, extra };
  return { cents: cfg.cents, usd: cfg.cents / 100, atomic, resource, description, v1, v2, payTo: cfg.payTo, window: cfg.window, pricing: pricingOf(cfg, base) };
}

// how to pay, in words an agent without an x402 client can follow
export function howToPay(t, base) {
  return [
    'x402 v2: call again with the header PAYMENT-SIGNATURE (the PAYMENT-REQUIRED header of the 402 answer holds the terms, base64 JSON)',
    'x402 v1: call again with the header X-PAYMENT (the terms are in "accepts" of the 402 body)',
    `no x402 client: send ${t.usd} USDC on Base (eip155:8453, token ${USDC_BASE}) to ${t.payTo}, then POST ${base}/settle {"q":"<your task>","tx":"<transaction hash>"}`,
  ];
}

// the answer that asks for payment: 402, the terms in every place a client looks for them, and in words a reader
// without an x402 client understands (amount_usd, human, how_to_pay). Fields are only ever added, never taken away.
export function paymentRequired(t, { base, error, cors = {} }) {
  const p = t.pricing || pricingOf(t, base);
  const v2 = { x402Version: 2, error: error || 'PAYMENT-SIGNATURE header is required', resource: { url: t.resource, description: t.description, mimeType: 'application/json' }, accepts: [t.v2], extensions: { bazaar: bazaarOf(base) } };
  const body = {
    x402Version: 1, error: error || 'X-PAYMENT header is required', accepts: [t.v1],
    // maxAmountRequired above is in USDC base units (6 decimals): 20000 is 0.02 USDC
    amount_usd: p.amount_usd, unit: p.unit, human: p.human, how_to_pay: p.how_to_pay,
    free_sample: `POST ${base}/route?q=<your task>&free=true (the first 3 paths, no payment)`,
    what: t.description,
    price: { usd: t.usd, cents: t.cents, asset: 'USDC', network: 'Base (eip155:8453)', pay_to: t.payTo },
    pay: howToPay(t, base),
    settle: `${base}/settle`, prices: `${base}/job`, window_seconds: t.window,
    free: { brain: `${base}/brain?q=<your task>`, doors: `GET ${base}/route?q=<your task>` },
    note: 'No account, no key. The USDC goes from your wallet straight to the address above; the sea never holds anyone\'s money.',
  };
  // the short form for a header: amount and unit as before (US cents), the same price in dollars and in words beside them
  const short = { scheme: 'exact', network: 'base', to: t.payTo, payTo: t.payTo, amount: t.cents, unit: 'USD cents', asset: 'USDC', maxTimeoutSeconds: t.window, settle: `${base}/settle`,
    amount_usd: p.amount_usd, human: p.human, decimals: p.decimals, how_to_pay: p.how_to_pay };
  return new Response(JSON.stringify(body), { status: 402, headers: {
    'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex',
    'payment-required': b64(JSON.stringify(v2)), 'x402-payment-required': JSON.stringify(short), 'x-pay-to': t.payTo, 'x-settle-window': String(t.window),
    link: `<${p.how_to_pay}>; rel="describedby"`, ...cors } });
}

// /pay/howto: how to pay, as three commands to copy, in plain text (at most 60 lines)
export function payHowto(t, base) {
  const p = t.pricing || pricingOf(t, base);
  return [
    'Mare Liberum · how to pay for the paid route',
    '',
    `0) No wallet needed: one GET gives a key with 20 probe calls for the paid doors (route, read, check, deal, pack); no body, no account.`,
    `KEY=$(curl -s ${base}/session?as=key)`,
    `curl -s -X POST '${base}/route?q=<task>' -H "x-sea-session: $KEY"`,
    `   (POST ${base}/session gives the same key as JSON with its bookmark.)`,
    '',
    `${p.line}.`,
    `You get the 10 best agent paths for your task, each one a /via/ address, ranked with reasons and the next step.`,
    '',
    '1) Try it free: the first 3 of the 10 paths, no payment.',
    `curl -s -X POST '${base}/route?q=test&free=true'`,
    '',
    '2) Ask for all 10. The answer is HTTP 402 Payment Required; its headers say what to pay:',
    `curl -si -X POST '${base}/route?q=<task>'`,
    `   x402-payment-required  the terms as JSON: network base, to (the wallet), amount_usd "${p.amount_usd}", how_to_pay`,
    `   PAYMENT-REQUIRED       the same terms for x402 v2 clients (base64 JSON, network eip155:8453, amount ${p.maxAmountRequired})`,
    `   X-Pay-To               the wallet: ${p.payTo}`,
    `   X-Settle-Window        seconds the terms stay open: ${p.settle_window_seconds}`,
    '   The body repeats the terms for x402 v1 clients ("accepts", with maxAmountRequired).',
    'An x402 client pays by itself: it calls again with PAYMENT-SIGNATURE (v2) or X-PAYMENT (v1) and gets the 10 paths in the same answer.',
    '',
    `3) Paid by a plain USDC transfer instead? Send ${p.amount_usd} USDC on Base to the wallet above, then hand in the receipt:`,
    `curl -s -X POST '${base}/settle' -H 'content-type: application/json' -d '{"q":"<task>","tx":"0x<transaction hash>"}'`,
    '   An x402 payment payload works too: {"q":"<task>","payment":"<base64 payload>"}.',
    '',
    `Amounts: maxAmountRequired is written in USDC base units, and USDC has ${p.decimals} decimals.`,
    `${p.maxAmountRequired} means ${(Number(p.maxAmountRequired) / 1e6).toFixed(6)} USDC, that is ${p.amount_usd} US dollars or ${p.human}.`,
    '',
    `USDC on Base: token ${p.asset}, chain id ${p.chain_id}. No account, no key.`,
    'The money goes from your wallet straight to the wallet above; the sea never holds anyone\'s money.',
    `What the till has taken in: ${base}/treasury`,
    '',
    'A payment the sea cannot verify at once is still accepted and delivered at once; the sale is booked as unverified until it settles.',
    '',
  ].join('\n');
}

// the payment a caller brought: PAYMENT-SIGNATURE (v2), X-PAYMENT (v1), or "payment" in the body of /settle
export function paymentOf(headers, body = {}) {
  const raw = headers?.get?.('payment-signature') || headers?.get?.('x-payment') || (typeof body?.payment === 'string' ? body.payment : null);
  let p = body?.payment && typeof body.payment === 'object' ? body.payment : null;
  if (!p && raw) {
    const s = String(raw).trim();
    try { p = JSON.parse(s.startsWith('{') ? s : Buffer.from(s, 'base64').toString('utf8')); } catch { return { bad: 'the payment could not be read: send the payment payload as base64 JSON' }; }
  }
  if (!p || typeof p !== 'object' || Array.isArray(p)) return raw ? { bad: 'the payment could not be read: send the payment payload as base64 JSON' } : null;
  return { version: Number(p.x402Version) === 2 ? 2 : 1, payload: p };
}

// what the sea can see for itself before it asks anyone: the right network, the right wallet, enough money
export function checkPayment(pay, t) {
  const p = pay.payload, no = (reason) => ({ ok: false, reason });
  if (pay.version === 2) {
    const a = p.accepted && typeof p.accepted === 'object' ? p.accepted : {};
    if (a.scheme && a.scheme !== 'exact') return no(`this move is paid with the scheme "exact", not "${String(a.scheme).slice(0, 30)}"`);
    if (a.network && a.network !== 'eip155:8453') return no('this move is paid on Base (eip155:8453)');
    if (a.payTo && String(a.payTo).toLowerCase() !== t.payTo.toLowerCase()) return no(`this payment is meant for another wallet than ${t.payTo}`);
    if (a.asset && String(a.asset).toLowerCase() !== USDC_BASE.toLowerCase()) return no('this move is paid in USDC on Base');
  } else {
    if (p.scheme && p.scheme !== 'exact') return no(`this move is paid with the scheme "exact", not "${String(p.scheme).slice(0, 30)}"`);
    if (p.network && p.network !== 'base') return no('this move is paid on Base (network "base" in x402 v1)');
  }
  // the transfer itself, where the payment carries one (EIP-3009); other kinds are left to the facilitator
  const auth = p?.payload?.authorization;
  if (auth && typeof auth === 'object') {
    if (String(auth.to || '').toLowerCase() !== t.payTo.toLowerCase()) return no(`this payment goes to another wallet than ${t.payTo}`);
    try { if (BigInt(String(auth.value)) < BigInt(t.atomic)) return no(`this payment is smaller than ${t.usd} USDC`); } catch { return no('the amount of this payment could not be read'); }
  }
  return { ok: true, payer: WALLET.test(String(auth?.from || '')) ? String(auth.from) : null };
}

// what the facilitator answered, counted per UTC day in this node's memory (since 3.38): ok, refused (verify said invalid),
// failed (settle said no), noverdict (an answer without one), down (5xx) or error (no answer). node/books.mjs folds the counts
// into the node's state once a minute; the operator's digest shows them. Nothing about the payment or the payer is counted
const watched = new Map(); let lastReached = null, lastMissed = null;
export const payWatch = {
  note(kind, outcome, at = new Date().toISOString()) {
    const d = at.slice(0, 10), k = `${kind}_${outcome}`; let m = watched.get(d); if (!m) watched.set(d, (m = {})); m[k] = (m[k] || 0) + 1;
    if (outcome === 'down' || outcome === 'error') lastMissed = at; else lastReached = at;
  },
  take() { const out = Object.fromEntries(watched); watched.clear(); return out; },
  peek() { return structuredClone(Object.fromEntries(watched)); },
  last: () => ({ reached: lastReached, missed: lastMissed }),
};
// one question to the facilitator: verify (the signature holds, nothing moves) or settle (the USDC moves on chain)
export async function facilitate(cfg, kind, pay, t, ms, get = (...a) => fetch(...a)) {
  let r, text;
  try {
    r = await get(`${cfg.facilitator}/${kind}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json', 'user-agent': UA },
      body: JSON.stringify({ x402Version: pay.version, paymentPayload: pay.payload, paymentRequirements: pay.version === 2 ? t.v2 : t.v1 }), signal: AbortSignal.timeout(ms) });
    text = await r.text();
  } catch (e) { payWatch.note(kind, 'error'); throw e; }
  let body = null; try { body = JSON.parse(text); } catch {}
  const b = body && typeof body === 'object' ? body : null;
  payWatch.note(kind, r.status >= 500 ? 'down' : kind === 'verify' ? (b?.isValid === true ? 'ok' : b?.isValid === false ? 'refused' : 'noverdict') : (b?.success === true ? 'ok' : b?.success === false ? 'failed' : 'noverdict'));
  return { status: r.status, body: b };
}

// take a payment and deliver: verify → the work → settle. work(sale) builds the answer; it must not throw.
// Returns { status, headers, body } for the caller to send.
// label and extra (since 3.34, for the fair share, node/fair.mjs): the sale's method is written "<label>-x402-v<n>" and
// extra fields (amount_micro, kind) go with the sale; without them the sale is written exactly as before
// strict (since 3.37, for the toll, node/toll.mjs): a payment the facilitator gives no verdict on is not taken (refuse, try
// again) instead of being delivered unverified; without strict the hard rule of the till stands as it was
export async function takePayment({ cfg, t, pay, q, ledger, work, callerHash, waitUntil, get, base, label, extra, strict = false }) {
  const local = checkPayment(pay, t);
  if (!local.ok) return { refuse: local.reason };
  let verified = false, reason = null, payer = local.payer;
  if (cfg.facilitator) {
    try {
      const v = await facilitate(cfg, 'verify', pay, t, cfg.verifyMs, get);
      if (v.body?.isValid === false) return { refuse: `the payment was not accepted: ${String(v.body.invalidReason || v.body.error || 'invalid').slice(0, 160)}` };
      if (v.body?.isValid === true) { verified = true; if (WALLET.test(String(v.body.payer || ''))) payer = v.body.payer; }
      else reason = `the facilitator gave no verdict (HTTP ${v.status})`;
    } catch (e) { reason = `the facilitator did not answer (${String(e?.name === 'TimeoutError' ? 'timeout' : e?.message || e).slice(0, 80)})`; }
  } else reason = 'no facilitator is set on this node';
  if (strict && !verified) return { refuse: `${reason}: the payment was not taken and nothing was charged; try again in a moment`, retry: true };
  const network = pay.version === 2 ? 'eip155:8453' : 'base';
  const sale = ledger.sale({ q, amount_cents: t.cents, status: verified ? 'pending' : 'unverified', agent_ua_hash: callerHash, method: `${label ? `${label}-` : ''}x402-v${pay.version}`, payer, network, ...(extra || {}) });
  const answer = await work(sale);
  // settle: the money moves now. A settlement that takes longer than the answer goes on behind it.
  const headers = {};
  let status = verified ? 'pending' : 'unverified', tx = null;
  if (cfg.facilitator) {
    const going = facilitate(cfg, 'settle', pay, t, cfg.settleMs, get).then((r) => ({ r }), (e) => ({ e }));
    const done = (x) => {
      const ok = x?.r?.body?.success === true;
      if (ok) {
        const t2 = String(x.r.body.transaction || '') || null;
        ledger.saleSet(sale.id, { status: 'settled', tx: t2, payer: WALLET.test(String(x.r.body.payer || '')) ? x.r.body.payer : payer, settled_at: new Date().toISOString() });
        return { status: 'settled', tx: t2, response: { success: true, transaction: t2, network: x.r.body.network || network, payer: x.r.body.payer || payer } };
      }
      if (x?.r?.body?.success === false) { const s2 = verified ? 'unsettled' : 'unverified'; ledger.saleSet(sale.id, { status: s2 }); return { status: s2, reason: String(x.r.body.errorReason || x.r.body.error || 'not settled').slice(0, 160) }; }
      return null;
    };
    const first = await Promise.race([going, new Promise((r) => { const tm = setTimeout(() => r(null), cfg.settleWaitMs); tm.unref?.(); })]);
    const d = first ? done(first) : null;
    if (d) { status = d.status; tx = d.tx || null; if (d.reason) reason = d.reason; if (d.response) headers[pay.version === 2 ? 'payment-response' : 'x-payment-response'] = b64(JSON.stringify(d.response)); }
    else {
      // still on its way: the answer goes out now, the sale is set when the facilitator answers
      reason = reason || 'the settlement is still on its way; the sale is set as soon as it lands';
      try { waitUntil?.(going.then(done)); } catch {}
    }
  }
  return { status: 200, headers, sale: { ...sale, status, tx }, reason, answer };
}

// the receipt of an agent that paid on its own (a transfer), or a test; the hard rule holds here too
export function receiptOf(body = {}) {
  const tx = [body.tx, body.transaction, body.hash].find((x) => typeof x === 'string' && x.trim());
  const receipt = [body.receipt, body.proof].find((x) => typeof x === 'string' && x.trim());
  if (body.test === true || body.test === 'true' || body.test === 1 || body.test === '1') return { test: true };
  if (tx && TXHASH.test(tx.trim())) return { tx: tx.trim(), method: 'transfer' };
  if (tx || receipt) return { tx: String(tx || receipt).replace(/[^\x20-\x7e]/g, '').trim().slice(0, 120) || null, method: 'receipt' };
  return null;
}

// the price table: what the one paid move costs and how to pay for it
export function priceTable(cfg, base) {
  const t = termsFor(cfg, { base }), p = t.pricing;
  return {
    what: `The one paid move of Mare Liberum. ${p.line}. Everything else in the sea stays free.`,
    pricing: p,
    price_table: [{
      item: 'route', method: 'POST', url: `${base}/route?q=<your task>`, also: `GET ${base}/route?q=<your task>&paid=true`,
      amount_cents: t.cents, price_usd: t.usd, amount_usd: p.amount_usd, human: p.human, asset: 'USDC', network: 'Base (eip155:8453)', pay_to: t.payTo, settle_window_seconds: t.window,
      free_sample: `POST ${base}/route?q=<your task>&free=true (the first 3 paths, no payment)`, how_to_pay: p.how_to_pay,
      returns: 'the 10 best agent paths for exactly this task, each one already a /via/ address, with the reason for its rank, what other agents reported, and the next step',
      pay: howToPay(t, base),
    }],
    settle: `POST ${base}/settle {"q":"<task>","tx":"<transaction hash>"}`,
    try_free: `POST ${base}/route?q=<task>&free=true`,
    facilitator: cfg.facilitator || 'none (sales are written down as unverified)',
    treasury: `${base}/treasury`, pulse: `${base}/pulse`,
    free: { brain: `${base}/brain?q=<your task>`, doors: `GET ${base}/route?q=<your task>`, sites: `${base}/find?q=<words>`, read: `${base}/r/<address>` },
    job_board: `Work between agents stays free: residents post tasks with POST ${base}/job {"by","pass","task",…} and list them at ${base}/jobs`,
  };
}
