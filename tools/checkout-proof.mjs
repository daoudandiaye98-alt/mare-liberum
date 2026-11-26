// Mare Liberum · proof of the operators' till (3.55, node/checkout.mjs, GET /reader/credit/paid): reader credit by card in the
// browser for businesses, EUR 10 for 10,000 pages, sold through the order page /c/reader and a Stripe payment link.
// It proves, without the network (the Edge Function mare-mpp is a fake that records what it was sent):
// without a session the door names the offer and its order page, never the payment link; a session id of the wrong form is
// refused before anything is asked; a session that is complete, paid, in payment mode, through this offer's link and for
// exactly EUR 10.00 gives 10,000 pages once, with a token of the credit form derived from the session; the Edge Function is
// sent the node's secret, the action and the session id, never more; the same link shows the same token again without asking
// Stripe and never fills the credit up; an unpaid, foreign, cheaper or other-currency session, or a read that fails, gives
// nothing; a session whose credit ran out and left the state is never minted again; MARE_CHECKOUT=off and a node without a
// secret give nothing; the page for a person is noindex, no-store and sends no referrer. Negative controls: each check, fed
// a broken part, must fail.
// Runs: node tools/checkout-proof.mjs  (exit code 1 when a proof or a negative control fails)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handle } from '../node/core.mjs';
import { createMem } from '../node/mem.mjs';
import { memoryKv } from '../node/flow.mjs';
import { createLedger } from '../node/ledger.mjs';
import { payConfig } from '../node/pay.mjs';
import { CHECKOUT, CHECKOUT_DOOR, SESSION_RE, TILL, AGENT_TILL, NODE, tillOffer, checkoutKey, checkoutToken, checkoutPaid } from '../node/checkout.mjs';
import { CREDIT_RE, tokenHash } from '../node/credit.mjs';
import { OFFER } from '../node/seo.mjs';
import { CTA, ctaTarget } from '../node/attention.mjs';
import { GATE } from '../node/legal.mjs';

let passed = 0, failed = 0, negOk = 0, negBad = 0;
const proof = async (name, fn) => { try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 5).join('\n       ')}`); } };
const negative = async (name, fn) => { let threw = false; try { await fn(); } catch { threw = true; } if (threw) { negOk++; console.log(`  ok   negative control fails as it must: ${name}`); } else { negBad++; console.log(`  FAIL negative control did not fail: ${name}`); } };

const BASE = 'https://mare.test', SECRET = 'q'.repeat(48);
const db = createMem({ file: 'data/none.tsv', base: BASE }), kv = memoryKv(), ledger = createLedger({});
// the fake Edge Function: what Stripe holds per session; what the node sent is kept
const SESSIONS = new Map(), sent = [];
const paidSession = (id, o = {}) => ({ ok: true, id, status: 'complete', payment_status: 'paid', mode: 'payment', payment_link: CHECKOUT.linkId, amount_total: 1000, currency: 'eur', payment_intent: `pi_${id.slice(-10)}`, livemode: true, created: 1, ...o });
let failWith = null;
const fakeFetch = async (url, init) => {
  const b = JSON.parse(init.body); sent.push({ url, b });
  if (failWith) return new Response(JSON.stringify(failWith.body), { status: failWith.status, headers: { 'content-type': 'application/json' } });
  const s = SESSIONS.get(b.session);
  return s ? new Response(JSON.stringify(s), { status: 200, headers: { 'content-type': 'application/json' } }) : new Response(JSON.stringify({ ok: false, status: 404, code: 'resource_missing', message: 'No such checkout.session' }), { status: 404, headers: { 'content-type': 'application/json' } });
};
const cfg = (extra = {}) => ({ base: BASE, kv, ledger, pay: payConfig({}), waitUntil: () => {}, creditSweepMs: 0, checkout: { secret: SECRET, url: 'https://db.test', anon: 'anon-test', fetch: fakeFetch, ...extra } });
let ipN = 0;
const call = async (path, headers = {}, extra = {}, method = 'GET') => {
  const res = await handle(new Request(BASE + path, { method, headers: { 'user-agent': 'proof-agent/1.0', 'x-forwarded-for': `203.0.113.${(ipN++ % 200) + 1}`, accept: 'application/json', ...headers } }), db, cfg(extra));
  const text = await res.text(); let j = null; try { j = JSON.parse(text); } catch {}
  return { status: res.status, h: Object.fromEntries(res.headers), j, text };
};
const sid = (n) => `cs_live_${String(n).padStart(4, '0')}a1B2c3D4e5F6g7H8i9J0`;
const KEY = checkoutKey(SECRET);
const peek = (token) => db.creditBook.peek(tokenHash(token));

console.log('the operators\' till');

await proof('the offer: a payment link in the code (node/seo.mjs OFFER.reader) reached only through its order page /c/reader, for EUR 10 and 10,000 pages, 30 days', async () => {
  assert.match(OFFER.reader, /^https:\/\/buy\.stripe\.com\/[A-Za-z0-9]+$/);
  assert.equal(ctaTarget('reader'), OFFER.reader); assert.match(CTA.reader.price, /10 €.*10,000 pages/);
  assert.deepEqual([CHECKOUT.cents, CHECKOUT.currency, CHECKOUT.pages, CHECKOUT.days], [1000, 'eur', 10000, 30]);
  assert.match(CHECKOUT.linkId, /^plink_[A-Za-z0-9]+$/);
  assert.ok(readFileSync(new URL('../node/seo.mjs', import.meta.url), 'utf8').includes(CHECKOUT.linkId), 'the link id stands next to the link');
});

await proof('without a session the door names the offer and its order page, never the payment link; open', async () => {
  const r = await call(CHECKOUT_DOOR);
  assert.equal(r.status, 200); assert.equal(r.j.price_eur, '10.00'); assert.equal(r.j.pages, 10000); assert.equal(r.j.days, 30); assert.equal(r.j.per_page_eur, '0.001000');
  assert.equal(r.j.buy, `${BASE}/c/reader?from=reader`); assert.equal(r.j.open, true); assert.match(r.j.customers, /§ 14 BGB/);
  assert.ok(!r.text.includes('buy.stripe.com'), 'no payment link handed out');
  assert.equal(r.h['cache-control'], 'no-store'); assert.match(r.h['x-robots-tag'], /noindex/); assert.equal(r.h['referrer-policy'], 'no-referrer');
  assert.equal(sent.length, 0, 'nothing asked');
});

await proof('the page for a person: noindex, no-store, no referrer, a button to the order page, no payment link', async () => {
  const r = await call(CHECKOUT_DOOR, { accept: 'text/html' });
  assert.equal(r.status, 200); assert.match(r.h['content-type'], /^text\/html/); assert.equal(r.h['referrer-policy'], 'no-referrer'); assert.equal(r.h['cache-control'], 'no-store');
  assert.ok(r.text.includes('href="/c/reader?from=reader"')); assert.ok(r.text.includes('<meta name="robots" content="noindex, nofollow">')); assert.ok(!r.text.includes('buy.stripe.com'));
});

await proof('a session id of the wrong form is refused before anything is asked (400)', async () => {
  for (const s of ['x', 'cs_live_', 'pi_123456789012345', 'cs_live_abc$%^', `cs_live_${'a'.repeat(201)}`]) {
    const r = await call(`${CHECKOUT_DOOR}?session=${encodeURIComponent(s)}`); assert.equal(r.status, 400, s); assert.ok(!r.j.token, s);
  }
  assert.equal(sent.length, 0);
});

let T1 = null;
await proof('a paid session through this link for exactly EUR 10.00 gives 10,000 pages once: a token of the credit form, derived from the session; the Edge Function is sent the secret, the action and the session id only', async () => {
  const s = sid(1); SESSIONS.set(s, paidSession(s));
  const r = await call(`${CHECKOUT_DOOR}?session=${s}`);
  assert.equal(r.status, 200, r.text); assert.match(r.j.token, CREDIT_RE); assert.equal(r.j.token, checkoutToken(KEY, s));
  assert.deepEqual([r.j.pages, r.j.left, r.j.minted, r.j.price_eur], [10000, 10000, true, '10.00']);
  assert.equal(r.j.paid.reference, `pi_${s.slice(-10)}`); assert.equal(r.j.paid.amount_eur, '10.00');
  assert.equal(sent.length, 1); assert.deepEqual(Object.keys(sent[0].b).sort(), ['action', 'secret', 'session']); assert.deepEqual([sent[0].b.action, sent[0].b.session, sent[0].b.secret], ['session', s, SECRET]);
  assert.equal(sent[0].url, 'https://db.test/functions/v1/mare-mpp');
  const p = await peek(r.j.token); assert.deepEqual([p.state, p.pages, p.left], ['ok', 10000, 10000]);
  T1 = r.j.token;
});

await proof('the same link shows the same token again without asking Stripe, and never fills the credit up', async () => {
  const s = sid(1), n = sent.length;
  assert.equal((await db.creditBook.spend(tokenHash(T1))).left, 9999);
  const r = await call(`${CHECKOUT_DOOR}?session=${s}`);
  assert.equal(r.status, 200); assert.equal(r.j.token, T1); assert.equal(r.j.left, 9999); assert.equal(r.j.minted, false); assert.equal(sent.length, n, 'Stripe not asked again');
  const html = await call(`${CHECKOUT_DOOR}?session=${s}`, { accept: 'text/html' });
  assert.ok(html.text.includes(`value="${T1}"`) && html.text.includes('9999 of 10000 pages left'), 'the page shows the token and what is left');
});

await proof('an unpaid, foreign, cheaper, other-currency or subscription session gives nothing (402), and nothing is minted', async () => {
  const cases = [[{ status: 'open', payment_status: 'unpaid' }, /not complete/], [{ payment_status: 'unpaid' }, /not complete/], [{ payment_link: 'plink_OtherLink123' }, /not made through/],
    [{ amount_total: 500 }, /exactly EUR 10.00/], [{ currency: 'usd' }, /exactly EUR 10.00/], [{ mode: 'subscription' }, /one-time/]];
  let i = 10;
  for (const [o, why] of cases) {
    const s = sid(i++); SESSIONS.set(s, paidSession(s, o));
    const r = await call(`${CHECKOUT_DOOR}?session=${s}`); assert.equal(r.status, 402, JSON.stringify(o)); assert.match(r.j.error.message, why); assert.ok(!r.j.token);
    assert.equal((await peek(checkoutToken(KEY, s))).state, 'unknown', 'nothing minted');
  }
  // paid a minute later: the same link then gives the credit
  const s = sid(10); SESSIONS.set(s, paidSession(s)); const later = await call(`${CHECKOUT_DOOR}?session=${s}`); assert.equal(later.status, 200); assert.equal(later.j.minted, true);
});

await proof('a read that fails gives nothing: an unknown session 404, a refused or broken read 502 (with Stripe\'s words, never a key)', async () => {
  const unknown = await call(`${CHECKOUT_DOOR}?session=${sid(40)}`); assert.equal(unknown.status, 404); assert.ok(!unknown.j.token);
  failWith = { status: 502, body: { ok: false, status: 403, message: "The provided key '[key]' does not have the required permissions for this endpoint" } };
  try {
    const s = sid(41); SESSIONS.set(s, paidSession(s));
    const r = await call(`${CHECKOUT_DOOR}?session=${s}`); assert.equal(r.status, 502); assert.match(r.j.error.message, /required permissions/); assert.ok(!/rk_live|sk_live/.test(r.text)); assert.ok(!r.j.token);
    assert.equal((await peek(checkoutToken(KEY, s))).state, 'unknown');
  } finally { failWith = null; }
  const s = sid(41); assert.equal((await call(`${CHECKOUT_DOOR}?session=${s}`)).status, 200, 'the same link works once the read works');
});

await proof('a session whose credit ran out and left the state is never minted again (410), and Stripe is not asked', async () => {
  const s = sid(50); SESSIONS.set(s, paidSession(s));
  const first = await call(`${CHECKOUT_DOOR}?session=${s}`); assert.equal(first.status, 200);
  await kv.set(`credit:t:${tokenHash(first.j.token)}`, null, 1); // the credit has run out and left the state
  const n = sent.length, again = await call(`${CHECKOUT_DOOR}?session=${s}`);
  assert.equal(again.status, 410); assert.ok(!again.j.token); assert.equal(sent.length, n); assert.equal((await peek(first.j.token)).state, 'unknown');
});

await proof('MARE_CHECKOUT=off and a node without a secret give nothing (503) and ask nothing; only GET and HEAD are answered', async () => {
  const s = sid(60); SESSIONS.set(s, paidSession(s)); const n = sent.length;
  process.env.MARE_CHECKOUT = 'off';
  try { const r = await call(`${CHECKOUT_DOOR}?session=${s}`); assert.equal(r.status, 503); assert.ok(!r.j.token); assert.equal((await call(CHECKOUT_DOOR)).j.open, false); } finally { delete process.env.MARE_CHECKOUT; }
  const saved = { db: process.env.MARE_DB_SECRET, via: process.env.MARE_VIA_SECRET }; delete process.env.MARE_DB_SECRET; delete process.env.MARE_VIA_SECRET;
  try { assert.equal((await call(`${CHECKOUT_DOOR}?session=${s}`, {}, { secret: undefined })).status, 503); } finally { if (saved.db) process.env.MARE_DB_SECRET = saved.db; if (saved.via) process.env.MARE_VIA_SECRET = saved.via; }
  assert.equal(sent.length, n); assert.equal((await call(`${CHECKOUT_DOOR}?session=${s}`, {}, {}, 'POST')).status, 405);
});

await proof('tokens: the same session gives the same token, another session or another secret another one; every token has the credit form', () => {
  const a = checkoutToken(KEY, sid(1)), b = checkoutToken(KEY, sid(2)), c = checkoutToken(checkoutKey('z'.repeat(48)), sid(1));
  assert.equal(a, checkoutToken(KEY, sid(1))); assert.notEqual(a, b); assert.notEqual(a, c); for (const t of [a, b, c]) assert.match(t, CREDIT_RE);
  assert.equal(checkoutKey('short'), null); assert.ok(SESSION_RE.test(sid(1)) && !SESSION_RE.test('cs_live_x'));
});

await proof('checkoutPaid in words: null only for complete, paid, payment mode, this link, 1000 cents in eur', () => {
  assert.equal(checkoutPaid(paidSession(sid(1))), null);
  for (const o of [{ status: 'expired' }, { payment_status: 'no_payment_required' }, { mode: 'setup' }, { payment_link: null }, { amount_total: 1001 }, { currency: 'EUR ' }]) assert.equal(typeof checkoutPaid(paidSession(sid(1), o)), 'string', JSON.stringify(o));
  assert.equal(checkoutPaid(null), 'the payment could not be read');
});

console.log('\nthe reader ladder (3.60)');
const P = Object.fromEntries(TILL.map((o) => [o.id, o]));
await proof('every pack: its own payment link in the code next to its link id, reached only through its order page /c/<id>; a year holds twelve times the pages for ten times the price and runs 365 days; a page gets cheaper up the ladder', async () => {
  const seo = readFileSync(new URL('../node/seo.mjs', import.meta.url), 'utf8');
  assert.deepEqual(TILL.map((o) => o.id), ['reader', 'kutter', 'kutterjahr', 'fregatte', 'fregattejahr', 'flotte', 'flottejahr']);
  for (const o of TILL) {
    assert.match(o.id, /^[a-z]{2,12}$/, `${o.id} fits the door /c/<id>`); assert.ok(Object.hasOwn(CTA, o.id), o.id); assert.equal(ctaTarget(o.id), OFFER[o.id], o.id);
    assert.match(OFFER[o.id], /^https:\/\/buy\.stripe\.com\/[A-Za-z0-9]+$/, o.id); assert.match(o.linkId, /^plink_[A-Za-z0-9]+$/, o.id); assert.ok(seo.includes(o.linkId), `${o.id}: the link id stands next to the link`);
    assert.equal(o.currency, 'eur'); assert.equal(tillOffer(o.linkId), o);
  }
  assert.equal(new Set(TILL.map((o) => o.linkId)).size, TILL.length, 'one link per pack'); assert.equal(new Set(TILL.map((o) => o.pages)).size, TILL.length, 'one size per pack');
  for (const k of ['kutter', 'fregatte', 'flotte']) { const m = P[k], y = P[`${k}jahr`]; assert.deepEqual([m.days, y.days, y.pages, y.cents], [30, 365, m.pages * 12, m.cents * 10], k); }
  assert.deepEqual(['kutter', 'fregatte', 'flotte'].map((k) => [P[k].cents, P[k].pages]), [[4900, 100000], [19900, 500000], [39000, 1000000]]);
  const per = ['reader', 'kutter', 'fregatte', 'flotte'].map((k) => P[k].cents / P[k].pages); assert.ok(per.every((v, i) => i === 0 || v < per[i - 1]), 'a page gets cheaper up the ladder');
  for (const t of NODE.terms) { assert.ok(Object.hasOwn(CTA, t.id), t.id); assert.equal(ctaTarget(t.id), OFFER[t.id]); assert.ok(seo.includes(t.linkId), t.id); assert.equal(tillOffer(t.linkId), null, 'the Reederei gives no token'); }
});
await proof('a Kutter session gives exactly 100,000 pages for 30 days, a Flotte year exactly 12,000,000 pages for 365 days; the answer names the pack, its price and the amount paid', async () => {
  const now = Date.now();
  for (const [k, n] of [['kutter', 70], ['flottejahr', 71], ['fregattejahr', 72]]) {
    const o = P[k], s = sid(n); SESSIONS.set(s, paidSession(s, { payment_link: o.linkId, amount_total: o.cents }));
    const r = await call(`${CHECKOUT_DOOR}?session=${s}`);
    assert.equal(r.status, 200, r.text); assert.equal(r.j.token, checkoutToken(KEY, s)); assert.deepEqual([r.j.pages, r.j.left, r.j.minted, r.j.plan], [o.pages, o.pages, true, o.name]);
    assert.equal(r.j.price_eur, (o.cents / 100).toFixed(2)); assert.equal(r.j.paid.amount_eur, (o.cents / 100).toFixed(2));
    const days = (Date.parse(r.j.until) - now) / 86_400_000; assert.ok(days > o.days - 0.01 && days < o.days + 0.01, `${k}: ${days} days`);
    const p = await peek(r.j.token); assert.deepEqual([p.state, p.pages, p.left], ['ok', o.pages, o.pages]);
    const again = await call(`${CHECKOUT_DOOR}?session=${s}`); assert.deepEqual([again.j.minted, again.j.pages, again.j.plan], [false, o.pages, o.name]);
  }
});
await proof('a ladder link paid at another pack\'s price, or in another currency, gives nothing (402) and nothing is minted', async () => {
  let n = 80;
  for (const [k, amount, currency] of [['kutter', 1000, 'eur'], ['flottejahr', 39000, 'eur'], ['fregatte', 19900, 'usd']]) {
    const s = sid(n++); SESSIONS.set(s, paidSession(s, { payment_link: P[k].linkId, amount_total: amount, currency }));
    const r = await call(`${CHECKOUT_DOOR}?session=${s}`); assert.equal(r.status, 402, k); assert.match(r.j.error.message, new RegExp(`exactly EUR ${(P[k].cents / 100).toFixed(2)}`)); assert.ok(!r.j.token);
    assert.equal((await peek(checkoutToken(KEY, s))).state, 'unknown');
  }
  const s = sid(n++); SESSIONS.set(s, paidSession(s, { payment_link: NODE.terms[0].linkId, amount_total: NODE.terms[0].cents }));
  const r = await call(`${CHECKOUT_DOOR}?session=${s}`); assert.equal(r.status, 402); assert.match(r.j.error.message, /not made through/); assert.ok(!r.j.token, 'a Reederei payment gives no reader token');
});
await proof('the door without a session lists the whole ladder with its order pages and the Reederei, never a payment link', async () => {
  const r = await call(CHECKOUT_DOOR);
  assert.deepEqual(r.j.plans.map((x) => [x.id, x.pages, x.days, x.price_eur]), TILL.map((o) => [o.id, o.pages, o.days, (o.cents / 100).toFixed(2)]));
  for (const x of r.j.plans) assert.equal(x.buy, `${BASE}/c/${x.id}?from=reader`);
  assert.equal(r.j.node.page, `${BASE}${NODE.door}`); assert.ok(!r.text.includes('buy.stripe.com'));
  const h = await call(CHECKOUT_DOOR, { accept: 'text/html' });
  for (const o of TILL.filter((x) => x.id !== 'reader')) assert.ok(h.text.includes(`href="/c/${o.id}?from=reader"`), o.id);
  assert.ok(h.text.includes('id="plans"') && h.text.includes(`href="${NODE.door}"`)); assert.ok(!h.text.includes('buy.stripe.com'));
});
await proof('the Reederei: /reader/node names both terms and their order pages, never a payment link; ?paid=1 thanks the buyer, noindex and no-store', async () => {
  const r = await call(NODE.door, { accept: 'text/html' });
  assert.equal(r.status, 200); assert.match(r.h['content-type'], /^text\/html/); assert.ok(r.text.includes('href="/c/reederei?from=reader"') && r.text.includes('href="/c/reedereijahr?from=reader"'));
  assert.ok(r.text.includes('2,900') && r.text.includes('9,900') && r.text.includes('48 hours')); assert.ok(!r.text.includes('buy.stripe.com')); assert.ok(!r.text.includes('noindex'));
  const t = await call(`${NODE.door}?paid=1`, { accept: 'text/html' });
  assert.equal(t.status, 200); assert.ok(t.text.includes('your payment has arrived')); assert.equal(t.h['cache-control'], 'no-store'); assert.match(t.h['x-robots-tag'], /noindex/); assert.ok(t.text.includes('<meta name="robots" content="noindex, nofollow">'));
});
await proof('every order page of the ladder asks for the business box first and only then leads to its own payment link', async () => {
  for (const id of [...TILL.map((o) => o.id), ...NODE.terms.map((t) => t.id)]) {
    const gate = await call(`/c/${id}?from=reader`, { accept: 'text/html' }); assert.equal(gate.status, 200, id); assert.ok(gate.text.includes('§ 14 BGB') && !gate.text.includes('buy.stripe.com'), id);
    const go = await call(`/c/${id}?from=reader&${GATE.field}=${GATE.value}`); assert.equal(go.status, 302, id); assert.equal(go.h.location, OFFER[id], id);
  }
});

console.log('\nthe agent packs (3.63)');
const AP = Object.fromEntries(AGENT_TILL.map((o) => [o.id, o]));
await proof('(3.63) the agent packs in USD: 10, 49 and 99 USD for 10,000, 100,000 and 250,000 pages (30 days), each with its own payment link next to its id; their order pages lead straight to Stripe, without the box of § 14 BGB', async () => {
  const seo = readFileSync(new URL('../node/seo.mjs', import.meta.url), 'utf8');
  assert.deepEqual(AGENT_TILL.map((o) => [o.id, o.cents, o.pages, o.days, o.currency]), [['agent10', 1000, 10000, 30, 'usd'], ['agent49', 4900, 100000, 30, 'usd'], ['agent99', 9900, 250000, 30, 'usd']]);
  for (const o of AGENT_TILL) {
    assert.ok(Object.hasOwn(CTA, o.id) && CTA[o.id].everyone === true, o.id); assert.equal(ctaTarget(o.id), OFFER[o.id], o.id); assert.ok(seo.includes(o.linkId), o.id); assert.equal(tillOffer(o.linkId), o, o.id);
    const go = await call(`/c/${o.id}?from=agents`); assert.equal(go.status, 302, o.id); assert.equal(go.h.location, OFFER[o.id], o.id);
  }
});
await proof('(3.63) an agent pack session gives its pages for 30 days and says its price in USD; paid in euro or at another price it gives nothing', async () => {
  const now = Date.now(); let n = 90;
  for (const o of AGENT_TILL) {
    const s = sid(n++); SESSIONS.set(s, paidSession(s, { payment_link: o.linkId, amount_total: o.cents, currency: 'usd' }));
    const r = await call(`${CHECKOUT_DOOR}?session=${s}`); assert.equal(r.status, 200, r.text);
    assert.deepEqual([r.j.pages, r.j.left, r.j.plan, r.j.price_usd, r.j.paid.amount_usd], [o.pages, o.pages, o.name, (o.cents / 100).toFixed(2), (o.cents / 100).toFixed(2)]); assert.ok(!('price_eur' in r.j));
    const days = (Date.parse(r.j.until) - now) / 86_400_000; assert.ok(days > 29.99 && days < 30.01, `${o.id}: ${days} days`);
  }
  for (const [o, amount, currency] of [[AP.agent10, 1000, 'eur'], [AP.agent49, 1000, 'usd']]) {
    const s = sid(n++); SESSIONS.set(s, paidSession(s, { payment_link: o.linkId, amount_total: amount, currency }));
    const r = await call(`${CHECKOUT_DOOR}?session=${s}`); assert.equal(r.status, 402); assert.match(r.j.error.message, new RegExp(`exactly USD ${(o.cents / 100).toFixed(2)}`)); assert.ok(!r.j.token);
  }
});
await proof('(3.63) /for-agents.json: the value of a page, the free part, three packs with mpp pay and their checkout, how to use the token and a summary for the agent\'s person; /for-agents as a page; never a payment link', async () => {
  const r = await call('/for-agents.json'); assert.equal(r.status, 200, r.text); assert.ok(Array.isArray(r.j?.packs), r.text.slice(0, 400));
  assert.deepEqual(r.j.packs.map((p) => [p.pack, p.price_usd, p.pages, p.pay.link_wallet, p.pay.checkout]), [['10', '10.00', 10000, `mpp pay ${BASE}/reader/credit/stripe?pack=10`, `${BASE}/c/agent10?from=agents`], ['49', '49.00', 100000, `mpp pay ${BASE}/reader/credit/stripe?pack=49`, `${BASE}/c/agent49?from=agents`], ['99', '99.00', 250000, `mpp pay ${BASE}/reader/credit/stripe?pack=99`, `${BASE}/c/agent99?from=agents`]]);
  assert.equal(r.j.free.pages_a_day, 100); assert.match(r.j.for_your_person, /pack 10: 10,000 pages for 10\.00 USD/); assert.ok('today' in r.j.value); assert.ok(!r.text.includes('buy.stripe.com'));
  const h = await call('/for-agents', { accept: 'text/html' }); assert.equal(h.status, 200); assert.match(h.h['content-type'], /^text\/html/);
  for (const n of ['10', '49', '99']) assert.ok(h.text.includes(`id="pack-${n}"`) && h.text.includes(`href="/c/agent${n}?from=agents"`), n);
  assert.ok(!h.text.includes('buy.stripe.com'));
});

console.log('\nnegative controls');
await negative('(3.63) a till that took an agent pack paid in euro is caught', () => assert.equal(checkoutPaid(paidSession(sid(1), { payment_link: AP.agent10.linkId, amount_total: 1000, currency: 'eur' })), null));
await negative('(3.63) an agent pack behind the box of § 14 BGB is caught', async () => { const r = await call('/c/agent10?from=agents'); assert.equal(r.status, 200); });
await negative('a till that took any payment link is caught', () => assert.equal(checkoutPaid(paidSession(sid(1), { payment_link: 'plink_Other' })), null));
await negative('a till that took any amount is caught', () => assert.equal(checkoutPaid(paidSession(sid(1), { amount_total: 100 })), null));
await negative('a token not bound to its session is caught', () => assert.equal(checkoutToken(KEY, sid(1)), checkoutToken(KEY, sid(2))));
await negative('a second visit that filled the credit up is caught', async () => { const r = await call(`${CHECKOUT_DOOR}?session=${sid(1)}`); assert.equal(r.j.left, 10000); });
await negative('a till that gave the Starter\'s pages for a Flotte year is caught', async () => { const r = await call(`${CHECKOUT_DOOR}?session=${sid(71)}`); assert.equal(r.j.pages, CHECKOUT.pages); });
await negative('a till that took a Kutter link at the Starter\'s price is caught', () => assert.equal(checkoutPaid(paidSession(sid(1), { payment_link: P.kutter.linkId, amount_total: 1000 })), null));
await negative('a Reederei page that handed out a payment link is caught', async () => { const r = await call(NODE.door, { accept: 'text/html' }); assert.ok(r.text.includes('buy.stripe.com')); });
await negative('a door that handed out the payment link is caught', async () => { const r = await call(CHECKOUT_DOOR); assert.ok(r.text.includes('buy.stripe.com')); });

console.log(`\n${passed} passed, ${failed} failed; negative controls: ${negOk} failed as they must, ${negBad} did not`);
process.exit(failed || negBad ? 1 : 0);
