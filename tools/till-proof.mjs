// Mare Liberum · proof of the till: the one paid move, from the 402 to the record.
// The terms in every place an x402 client looks (v2 header, v1 body, the short header, wallet and window), what the sea
// checks itself, what the facilitator decides, the hard rule (an agent that wants to pay is never turned away by the
// sea's own trouble: delivered and written down as unverified), receipts handed in at /settle (a test, a transfer, the
// same receipt twice), the price table, the job board that stays free, the treasury that never counts a claim or a
// test as money, the ledger that writes behind the answers and lets a refused line go, the pulse, and the ranking of
// the paid route.
// Runs without the network (only this machine): node tools/till-proof.mjs   (exit code 1 when a proof fails)
import assert from 'node:assert/strict';
import { handle } from '../node/core.mjs';
import { createMem } from '../node/mem.mjs';
import { payConfig, termsFor, checkPayment, receiptOf, HOUSE_WALLET, USDC_BASE, FACILITATOR } from '../node/pay.mjs';
import { createLedger, summarize, pulseOf } from '../node/ledger.mjs';
import { paidRoute } from '../node/paid.mjs';
import { setViaKey, decodeVia } from '../node/via.mjs';

let passed = 0, failed = 0;
const proof = async (name, fn) => { try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 4).join('\n       ')}`); } };
setViaKey('proof-key-0123456789abcdef');
const BASE = 'https://mare.test', FAC = 'https://facilitator.test';
// the facilitator of the proof: it answers as each proof tells it; nothing else is reached
let facilitator = null; const asked = [];
globalThis.fetch = async (u, o = {}) => {
  const s = String(u);
  if (s.startsWith(FAC)) { const kind = s.slice(FAC.length + 1), body = JSON.parse(o.body); asked.push({ kind, body }); return facilitator(kind, body); }
  throw new Error(`the proof does not use the network: ${s.slice(0, 80)}`);
};
const answer = (j, status = 200) => new Response(JSON.stringify(j), { status, headers: { 'content-type': 'application/json' } });
const db = createMem({ file: 'data/none.tsv', base: BASE });
const PAY = { ...payConfig({}), facilitator: FAC, settleWaitMs: 200, verifyMs: 500, settleMs: 2000 };
let ipN = 20;
const call = async (path, { method = 'GET', body, headers = {}, ledger, pay = PAY, ua = 'proof-agent/1.0' } = {}) => {
  const r = await handle(new Request(BASE + path, { method, headers: { accept: 'application/json', 'x-forwarded-for': `203.0.113.${ipN++ % 200}`, 'user-agent': ua, ...(body ? { 'content-type': 'application/json' } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined }), db, { base: BASE, pay, ledger: ledger || createLedger({}), waitUntil: () => {} });
  const txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch {}
  return { status: r.status, j, h: r.headers };
};
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64');
const auth = (to = HOUSE_WALLET, value = '20000') => ({ from: '0x2222222222222222222222222222222222222222', to, value, validAfter: '0', validBefore: String(Math.floor(Date.now() / 1000) + 300), nonce: '0x' + '33'.repeat(32) });
const v1 = (a = auth()) => b64({ x402Version: 1, scheme: 'exact', network: 'base', payload: { signature: '0x' + '11'.repeat(65), authorization: a } });
const v2 = (a = auth()) => b64({ x402Version: 2, accepted: { scheme: 'exact', network: 'eip155:8453', amount: '20000', asset: USDC_BASE, payTo: HOUSE_WALLET, maxTimeoutSeconds: 300, extra: { name: 'USD Coin', version: '2' } }, payload: { signature: '0x' + '11'.repeat(65), authorization: a } });
const TX = '0x' + 'ab'.repeat(32);

console.log('the terms');
await proof('2 US cents are 20000 units of USDC on Base; the wallet and the facilitator have defaults, and the operator can change them', () => {
  const d = payConfig({}); assert.equal(d.cents, 2); assert.equal(d.payTo, HOUSE_WALLET); assert.equal(d.facilitator, FACILITATOR); assert.equal(d.window, 300);
  const t = termsFor(d, { base: BASE, q: 'find usdc price' });
  assert.equal(t.atomic, '20000'); assert.equal(t.v1.network, 'base'); assert.equal(t.v1.maxAmountRequired, '20000'); assert.equal(t.v2.network, 'eip155:8453'); assert.equal(t.v2.amount, '20000');
  assert.equal(t.v2.asset, USDC_BASE); assert.deepEqual(t.v2.extra, { name: 'USD Coin', version: '2' }); assert.equal(t.resource, `${BASE}/route?q=find%20usdc%20price`);
  assert.equal(payConfig({ MARE_ROUTE_PRICE_CENTS: '5' }).cents, 5); assert.equal(payConfig({ MARE_ROUTE_PRICE_CENTS: '50' }).cents, 2, 'more than 5 cents is not taken');
  assert.equal(payConfig({ MARE_PAY_TO: '0x' + 'cd'.repeat(20) }).payTo, '0x' + 'cd'.repeat(20)); assert.equal(payConfig({ MARE_PAY_TO: 'not a wallet' }).payTo, HOUSE_WALLET);
  assert.equal(payConfig({ MARE_X402_FACILITATOR: 'off' }).facilitator, null);
});
await proof('POST /route answers 402 with the terms in the v2 header, the v1 body, x402-payment-required, X-Pay-To and X-Settle-Window', async () => {
  const r = await call('/route?q=find+usdc+price', { method: 'POST' });
  assert.equal(r.status, 402);
  const v2h = JSON.parse(Buffer.from(r.h.get('payment-required'), 'base64').toString());
  assert.equal(v2h.x402Version, 2); assert.equal(v2h.accepts[0].amount, '20000'); assert.equal(v2h.accepts[0].payTo, HOUSE_WALLET); assert.equal(v2h.resource.url, `${BASE}/route?q=find%20usdc%20price`);
  const short = JSON.parse(r.h.get('x402-payment-required'));
  assert.equal(short.amount, 2); assert.equal(short.unit, 'USD cents'); assert.equal(short.to, HOUSE_WALLET); assert.equal(short.payTo, HOUSE_WALLET); assert.equal(short.maxTimeoutSeconds, 300); assert.equal(short.scheme, 'exact');
  assert.equal(r.h.get('x-pay-to'), HOUSE_WALLET); assert.equal(r.h.get('x-settle-window'), '300');
  assert.equal(r.j.x402Version, 1); assert.equal(r.j.accepts[0].maxAmountRequired, '20000'); assert.equal(r.j.price.usd, 0.02); assert.equal(r.j.pay.length, 3);
  assert.match(r.h.get('access-control-expose-headers'), /payment-required/);
  assert.equal((await call('/route?q=find+usdc+price&paid=true')).status, 402, 'GET with paid=true too');
  assert.equal((await call('/route', { method: 'POST', body: {} })).status, 402, 'without a task: the terms, for discovery');
});
await proof('the free doors stay free: GET /route, POST /route.json', async () => {
  assert.equal((await call('/route?q=latest+research+on+creatine')).status, 200);
  assert.equal((await call('/route.json?q=latest+research+on+creatine', { method: 'POST' })).status, 200);
});

console.log('a payment');
await proof('what the sea sees itself: another wallet or too little is refused before anyone is asked', async () => {
  const t = termsFor(PAY, { base: BASE, q: 'x' });
  assert.match(checkPayment({ version: 1, payload: JSON.parse(Buffer.from(v1(auth('0x' + 'de'.repeat(20))), 'base64')) }, t).reason, /another wallet/);
  assert.match(checkPayment({ version: 1, payload: JSON.parse(Buffer.from(v1(auth(HOUSE_WALLET, '100')), 'base64')) }, t).reason, /smaller than 0.02 USDC/);
  asked.length = 0; facilitator = () => { throw new Error('must not be asked'); };
  const r = await call('/route?q=usdc+price', { method: 'POST', headers: { 'x-payment': v1(auth('0x' + 'de'.repeat(20))) } });
  assert.equal(r.status, 402); assert.match(r.j.error, /another wallet/); assert.equal(asked.length, 0);
});
await proof('the facilitator refuses a payment: 402 again with its reason, nothing delivered, no sale', async () => {
  const ledger = createLedger({});
  facilitator = (kind) => answer(kind === 'verify' ? { isValid: false, invalidReason: 'invalid_exact_evm_signature' } : { success: false });
  const r = await call('/route?q=usdc+price', { method: 'POST', headers: { 'x-payment': v1() }, ledger });
  assert.equal(r.status, 402); assert.match(r.j.error, /invalid_exact_evm_signature/); assert.equal(r.j.paths, undefined); assert.equal(ledger.mem.sales.length, 0);
});
await proof('a payment that holds (v2): verified, delivered, settled on chain; PAYMENT-RESPONSE carries the transaction', async () => {
  const ledger = createLedger({}); asked.length = 0;
  facilitator = (kind) => answer(kind === 'verify' ? { isValid: true, payer: '0x2222222222222222222222222222222222222222' } : { success: true, transaction: TX, network: 'eip155:8453', payer: '0x2222222222222222222222222222222222222222' });
  const r = await call('/route?q=latest+research+on+creatine', { method: 'POST', headers: { 'payment-signature': v2() }, ledger });
  assert.equal(r.status, 200); assert.equal(r.j.paid.status, 'settled'); assert.equal(r.j.paid.tx, TX); assert.ok(r.j.paths.length > 0 && r.j.paths.length <= 10);
  for (const p of r.j.paths) assert.match(p.to, /^https:\/\/mare\.test\/via\/[A-Za-z0-9_-]+\?q=latest\+research\+on\+creatine$/);
  const pr = JSON.parse(Buffer.from(r.h.get('payment-response'), 'base64').toString()); assert.equal(pr.success, true); assert.equal(pr.transaction, TX);
  assert.deepEqual(asked.map((a) => a.kind), ['verify', 'settle']); assert.equal(asked[0].body.x402Version, 2); assert.equal(asked[0].body.paymentRequirements.amount, '20000');
  assert.equal(ledger.mem.sales[0].status, 'settled'); assert.equal(ledger.mem.sales[0].tx, TX); assert.equal(ledger.mem.sales[0].method, 'x402-v2');
});
await proof('the hard rule: the facilitator does not answer → delivered at once and written down as unverified', async () => {
  const ledger = createLedger({});
  facilitator = () => { throw new Error('facilitator down'); };
  const r = await call('/route?q=usdc+price', { method: 'POST', headers: { 'x-payment': v1() }, ledger });
  assert.equal(r.status, 200); assert.equal(r.j.paid.status, 'unverified'); assert.match(r.j.paid.why, /did not answer/); assert.equal(ledger.mem.sales[0].status, 'unverified');
  const off = await call('/route?q=usdc+price', { method: 'POST', headers: { 'x-payment': v1() }, ledger, pay: { ...PAY, facilitator: null } });
  assert.equal(off.status, 200); assert.equal(off.j.paid.status, 'unverified'); assert.match(off.j.paid.why, /no facilitator/);
});
await proof('a settlement slower than the answer: delivered as pending, set to settled when it lands', async () => {
  const ledger = createLedger({});
  facilitator = (kind) => kind === 'verify' ? answer({ isValid: true }) : new Promise((r) => setTimeout(() => r(answer({ success: true, transaction: TX })), 400));
  const r = await call('/route?q=usdc+price', { method: 'POST', headers: { 'x-payment': v1() }, ledger });
  assert.equal(r.status, 200); assert.equal(r.j.paid.status, 'pending');
  await new Promise((res) => setTimeout(res, 600));
  assert.equal(ledger.mem.sales[0].status, 'settled'); assert.equal(ledger.mem.sales[0].tx, TX);
});
await proof('a payment that cannot be read, or a paid call without a task, takes nothing', async () => {
  const ledger = createLedger({});
  const r = await call('/route?q=x', { method: 'POST', headers: { 'x-payment': '%%%' }, ledger }); assert.equal(r.status, 402); assert.match(r.j.error, /could not be read/);
  facilitator = () => { throw new Error('must not be asked'); };
  const n = await call('/route', { method: 'POST', headers: { 'x-payment': v1() }, ledger }); assert.equal(n.status, 400); assert.match(n.j.error.message, /Nothing was charged/);
  assert.equal(ledger.mem.sales.length, 0);
});

console.log('receipts at /settle');
await proof('a test, a transfer, the same transfer again, no receipt, no task', async () => {
  const ledger = createLedger({});
  const t = await call('/settle', { method: 'POST', body: { q: 'find usdc price', test: true }, ledger }); assert.equal(t.status, 200); assert.equal(t.j.paid.status, 'test'); assert.ok(Array.isArray(t.j.paths));
  const a = await call('/settle', { method: 'POST', body: { q: 'find usdc price', tx: TX }, ledger }); assert.equal(a.status, 200); assert.equal(a.j.paid.status, 'unverified'); assert.equal(a.j.paid.tx, TX);
  const b = await call('/settle', { method: 'POST', body: { q: 'find usdc price', tx: TX.toUpperCase().replace('0X', '0x') }, ledger }); assert.equal(b.j.paid.again, true); assert.equal(b.j.paid.sale, a.j.paid.sale);
  assert.equal(ledger.mem.sales.filter((s) => s.status !== 'test').length, 1, 'one receipt, one sale');
  assert.equal((await call('/settle', { method: 'POST', body: { q: 'find usdc price' }, ledger })).status, 402);
  assert.equal((await call('/settle', { method: 'POST', body: { tx: TX }, ledger })).status, 400);
  assert.equal((await call('/settle')).status, 200, 'GET /settle explains itself');
  assert.deepEqual(receiptOf({ receipt: 'paid via bank\u0007' }), { tx: 'paid via bank', method: 'receipt' });
});

console.log('the price table and the job board');
await proof('GET /job is the price table; POST /job without a resident is offered the paid move; a resident keeps the free board', async () => {
  const p = await call('/job'); assert.equal(p.status, 200); assert.equal(p.j.price_table[0].amount_cents, 2); assert.equal(p.j.price_table[0].pay_to, HOUSE_WALLET);
  assert.equal((await call('/job', { method: 'POST', body: { task: 'translate a contract' } })).status, 402);
  const res = await call('/job', { method: 'POST', body: { by: 'mare:abcdefghjkmn', pass: 'not-the-pass', task: 'translate a contract', amount: 1 } });
  assert.notEqual(res.status, 402, 'a resident call goes to the job board');
});

console.log('the treasury and the pulse');
await proof('the treasury counts money that arrived as money, a claim apart, and a test never', async () => {
  const ledger = createLedger({});
  for (const s of [{ status: 'settled', amount_cents: 2 }, { status: 'settled', amount_cents: 3 }, { status: 'unverified', amount_cents: 2 }, { status: 'pending', amount_cents: 2 }, { status: 'test', amount_cents: 2 }]) ledger.sale({ q: 'find usdc price', ...s });
  const r = await call('/treasury', { ledger });
  assert.equal(r.status, 200); assert.equal(r.j.today_count, 4); assert.equal(r.j.today_usd, 0.05); assert.equal(r.j.today_usd_unconfirmed, 0.04); assert.equal(r.j.tests_today, 1);
  assert.equal(r.j.total_usd, 0.05); assert.equal(r.j.last_5.length, 5); assert.match(r.j.source, /no database/);
  const old = summarize([{ ts: '2026-11-01T10:00:00Z', status: 'settled', amount_cents: 2 }], Date.parse('2026-11-23T10:00:00Z'));
  assert.equal(old.today_count, 0); assert.equal(old.total_usd, 0.02);
});
await proof('the pulse: walks of the last hour, sites, tasks only once two walks carried them, and what was paid today', async () => {
  const now = Date.now(), at = (m) => new Date(now - m * 60e3).toISOString();
  const hits = [{ ts: at(5), target_domain: 'openalex.org', q: 'creatine', outcome: 'worked' }, { ts: at(10), target_domain: 'openalex.org', q: 'creatine' }, { ts: at(20), target_domain: 'crossref.org', q: 'one agent alone' }, { ts: at(120), target_domain: 'old.org', q: null }];
  const p = pulseOf(hits, [{ ts: at(1), status: 'settled', amount_cents: 2 }], now);
  assert.equal(p.hits_last_hour, 3); assert.equal(p.unique_domains_last_hour, 2); assert.deepEqual(p.top_10_domains[0], { domain: 'openalex.org', hits: 2 });
  assert.deepEqual(p.top_5_queries, [{ q: 'creatine', hits: 2 }]); assert.equal(p.paid_today.usd, 0.02); assert.equal(p.worked_last_24h, 1);
  const r = await call('/pulse'); assert.equal(r.status, 200); assert.equal(typeof r.j.hits_last_hour, 'number');
});

console.log('the ledger behind the answers');
await proof('it writes through the database functions with the node\'s secret, in batches, and lets a refused line go without holding up the rest', async () => {
  const calls = []; let failNext = 0;
  const get = async (u, o) => { const fn = String(u).split('/rpc/')[1], body = JSON.parse(o.body); calls.push({ fn, body }); if (failNext) { failNext--; return new Response('down', { status: 503 }); } if (fn === 'mare_sale_put' && body.s.q === 'refused') return new Response('{"message":"bad"}', { status: 400 }); return new Response('1', { status: 200 }); };
  const l = createLedger({ url: 'https://db.test', key: 'anon', secret: 'writer-secret', fetch: get });
  l.sale({ q: 'refused', amount_cents: 2, status: 'unverified' }); l.sale({ q: 'find usdc price', amount_cents: 2, status: 'unverified' });
  for (let i = 0; i < 3; i++) l.hit({ target_domain: 'openalex.org', q: 'creatine', ua_hash: 'h', token_host: 'api.openalex.org', status: 200 });
  l.outcome({ ua_hashes: ['h'], target_domain: 'openalex.org', outcome: 'worked' });
  assert.equal(await l.settle(), 0);
  assert.deepEqual([...new Set(calls.map((c) => c.fn))], ['mare_sale_put', 'mare_via_put', 'mare_via_outcome']);
  assert.ok(calls.every((c) => c.body.secret === 'writer-secret'));
  assert.equal(calls.filter((c) => c.fn === 'mare_via_put').length, 1, 'three walks, one batch'); assert.equal(calls.find((c) => c.fn === 'mare_via_put').body.rows.length, 3);
  assert.equal(l.state().dropped, 1); assert.equal(l.mem.hits.filter((h) => h.outcome === 'worked').length, 1);
  // a database that does not answer: the line waits, nothing is lost, the answers go on
  failNext = 1; l.hit({ target_domain: 'x.org', status: 200 }); await l.settle(); assert.equal(l.state().waiting, 1); assert.equal(l.state().resting, true);
});

console.log('the paid route');
await proof('ten at most, best first by the stated rule, every address a via address with the task, websites only when they fit the task', async () => {
  const sea = {
    think: async () => ({ paths: [{ to: 'https://reader.example/', title: 'Reader', task: 'read a page', strength: 2, walks: 9, worked: 4, failed: 0, worked_it: 'https://mare.test/rate/p1?worked=1', failed_it: 'https://mare.test/rate/p1?worked=0' }],
      doors: [{ name: 'Any', kind: 'api', to: 'https://any.example/?q=usdc', for: 'general' }, { name: 'Prices', kind: 'api', to: 'https://prices.example/usdc', for: 'money' }],
      places: [{ to: 'https://pay.example/usdc-price', title: 'USDC price API', kind: 'x402', from: 'the open index', pay: { protocol: 'x402', priceUsd: 0.001 } }, { to: 'https://kia.example/', title: 'Kia official site', from: 'the atlas' }],
      web: [{ name: 'Web', kind: 'page', to: 'https://search.example/?q=usdc', site: 'search.example' }] }),
    route: async () => ({ doors: [] }), find: async () => ({ sites: [{ site: 'pharma.example', title: 'Pills', matched: ['price'] }, { site: 'usdc.example', title: 'USDC charts', example: 'https://usdc.example/?s=usdc', grade: 'A', matched: ['usdc'] }] }),
  };
  const r = await paidRoute({ sea, q: 'find usdc price', ctx: {}, base: BASE });
  const from = r.paths.map((p) => decodeVia(p.to.split('/via/')[1].split('?')[0]).url);
  assert.deepEqual(from, ['https://reader.example/', 'https://prices.example/usdc', 'https://pay.example/usdc-price', 'https://usdc.example/?s=usdc', 'https://any.example/?q=usdc', 'https://search.example/?q=usdc']);
  assert.ok(!from.some((u) => /kia|pharma/.test(u)), 'websites that share no word that matters stay out');
  for (const p of r.paths) assert.match(p.to, /\?q=find\+usdc\+price$/);
  assert.deepEqual(r.paths.map((p) => p.rank), [1, 2, 3, 4, 5, 6]); assert.match(r.note, /knows 6 places/); assert.match(r.next.now, /^GET https:\/\/mare\.test\/via\//); assert.match(r.ranking, /^score = /);
  assert.equal(r.paths[0].worked_it, 'https://mare.test/rate/p1?worked=1');
  const empty = await paidRoute({ sea: { think: async () => { throw new Error('down'); } }, q: 'x', ctx: {}, base: BASE });
  assert.equal(empty.count, 0); assert.match(empty.next.now, /\/brain\?q=x/);
});
await proof('the operator rests the till without a release ("till" in rest): 503, nothing charged, the free doors stay open', async () => {
  const { immune } = await import('../node/immune.mjs');
  immune.set({ mode: 'normal', rest: ['till'] });
  try {
    const r = await call('/route?q=usdc', { method: 'POST' }); assert.equal(r.status, 503); assert.match(r.j.error.message, /nothing is charged/);
    assert.equal((await call('/settle', { method: 'POST', body: { q: 'x', test: true } })).status, 503);
    assert.equal((await call('/route?q=usdc')).status, 200, 'the free doors');
  } finally { immune.set({ mode: 'normal', rest: [] }); }
  assert.equal((await call('/route?q=usdc', { method: 'POST' })).status, 402);
});
await proof('x402 discovery names the one paid resource and the wallet', async () => {
  const r = await call('/.well-known/x402'); assert.deepEqual(r.j.resources, [`${BASE}/route`]); assert.equal(r.j.payTo[0].address, payConfig().payTo);
});

console.log(`\n${passed} held, ${failed} failed`);
process.exit(failed ? 1 : 0);
