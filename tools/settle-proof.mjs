// Mare Liberum · proof that a card payment settles a purchase on credit (4.2): the human pays the checkout_url of a key that
// bought on credit; Stripe names the key's seat link as client_reference_id (deploy/mare-mpp.ts hands it back); the payment
// then pays the open purchase (status paid), the seat stays on the same key and no longer falls due, no second seat is given,
// the ledger takes the money as a settled sale, /treasury shows the credit paid. A key with only a bundle open gets the bundle
// paid and the seat it paid for. The same payment twice settles nothing more. Keys without a seat read buy_on_credit from
// their first call. Negative controls: each check, fed a broken part, must fail.
// Runs: node tools/settle-proof.mjs  (exit code 1 when a proof or a negative control fails)
import assert from 'node:assert/strict';
import { handle } from '../node/core.mjs';
import { createMem } from '../node/mem.mjs';
import { memoryKv } from '../node/flow.mjs';
import { createLedger } from '../node/ledger.mjs';
import { payConfig } from '../node/pay.mjs';
import { SEAT } from '../node/pricing.mjs';
import { createSessions, sessionHash } from '../node/session.mjs';
import { readSeatToken } from '../node/seat.mjs';
import { setViaKey } from '../node/via.mjs';

let passed = 0, failed = 0, negOk = 0, negBad = 0;
const proof = async (name, fn) => { try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 5).join('\n       ')}`); } };
const negative = async (name, fn) => { let threw = false; try { await fn(); } catch { threw = true; } if (threw) { negOk++; console.log(`  ok   negative control fails as it must: ${name}`); } else { negBad++; console.log(`  FAIL negative control did not fail: ${name}`); } };

setViaKey(Buffer.alloc(32, 7));
const BASE = 'https://mare.test';
// the Edge Function, as the node reads it: one Checkout Session per id, with the client_reference_id it carried
const SESSIONS = new Map();
const edge = async (_url, init) => { const b = JSON.parse(init.body); const s = SESSIONS.get(b.session); return s ? new Response(JSON.stringify({ ok: true, ...s }), { status: 200 }) : new Response(JSON.stringify({ ok: false, status: 404, message: 'no such session' }), { status: 404 }); };
const paidSession = (id, ref, cents = SEAT.cents) => SESSIONS.set(id, { id, status: 'complete', payment_status: 'paid', mode: 'payment', payment_link: SEAT.linkId, amount_total: cents, currency: SEAT.currency, payment_intent: `pi_${id.slice(-12)}`, livemode: false, created: 1, client_reference_id: ref });
const db = createMem({ file: 'data/none.tsv', base: BASE }), kv = memoryKv(), ledger = createLedger({});
const cfg = () => ({ base: BASE, kv, ledger, pay: payConfig({}), waitUntil: () => {}, creditSweepMs: 0, checkout: { secret: 'q'.repeat(48), url: 'https://db.test', anon: 'anon-test', fetch: edge } });
const AGENT = 'Mozilla/5.0 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)';
let ipN = 0;
const call = async (path, { method = 'GET', headers = {}, body } = {}) => {
  const res = await handle(new Request(BASE + path, { method, headers: { 'user-agent': AGENT, 'x-forwarded-for': `203.0.113.${(ipN++ % 200) + 1}`, accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}), ...headers }, ...(body ? { body } : {}) }), db, cfg());
  const text = await res.text(); let j = null; try { j = JSON.parse(text); } catch {}
  return { status: res.status, h: res.headers, j, text };
};
const store = createSessions({ kv, now: () => Date.now() });
const keyOf = async () => (await call('/session?as=key')).j.key;
const tokenOf = (checkoutUrl) => checkoutUrl.replace(/^.*\/pay\//, '');

console.log('a card payment settles a purchase on credit');

let KEY = null, SALE = null, TOKEN = null;
await proof('the checkout_url of a purchase on credit names the key: its token carries the key\'s id', async () => {
  KEY = await keyOf();
  const r = await call('/seat', { method: 'POST', headers: { 'x-sea-session': KEY } });
  assert.equal(r.status, 200, r.text); SALE = r.j.sale_id; TOKEN = tokenOf(r.j.checkout_url);
  const t = readSeatToken(TOKEN); assert.equal(t.ok, true); assert.equal(t.k, sessionHash(KEY).slice(0, 24));
});

await proof('the human pays: GET /seat/confirm?session=… settles the credit on the same key, no second seat, the money a settled sale', async () => {
  paidSession('cs_test_settle0000000000001', TOKEN);
  const before = await store.peek(sessionHash(KEY)); assert.equal(before.seat.paths, SEAT.paths);
  const r = await call('/seat/confirm?session=cs_test_settle0000000000001');
  assert.equal(r.status, 200, r.text); assert.equal(r.j.status, 'active'); assert.doesNotMatch(String(r.j.key || ''), /^mls_/, 'no new key: the agent keeps its own'); assert.equal(r.j.key_id, sessionHash(KEY).slice(0, 24));
  const after = await store.peek(sessionHash(KEY));
  assert.equal(after.seat.paths, SEAT.paths, 'the seat on credit is the seat paid: no second 5,000 paths'); assert.equal(after.seat.state, 'active'); assert.equal(after.seat.credit_due ?? null, null);
  const t = (await call('/treasury')).j;
  const c = t.credits.last.find((x) => x.sale === SALE); assert.equal(c.status, 'paid');
  assert.equal(t.credits.paid.count, 1); assert.equal(t.credits.paid.usd, 24); assert.equal(t.credits_usd, 0);
  assert.equal(t.total_usd, 24); assert.match(t.last_5[0].q, new RegExp(`pays credit ${SALE}`));
});

await proof('the same payment twice: the same answer, nothing settled or given again', async () => {
  const r = await call('/seat/confirm?session=cs_test_settle0000000000001');
  assert.equal(r.status, 200); const after = await store.peek(sessionHash(KEY)); assert.equal(after.seat.paths, SEAT.paths);
  assert.equal((await call('/treasury')).j.total_usd, 24);
});

await proof('the seat paid no longer falls due: 8 days on it still runs', async () => {
  const t0 = Date.parse('2026-01-01T00:00:00Z'); let t = t0; const s2 = createSessions({ kv: memoryKv(), now: () => t });
  const o = await s2.open(); const h = sessionHash(o.key); await s2.credit(h, {});
  const st = await s2.settle(h.slice(0, 24), { cents: SEAT.cents, sale: 'pi_x' }); assert.equal(st.ok, true); assert.equal(st.seat_paid, true);
  t = t0 + 8 * 86400e3; assert.equal((await s2.peek(h)).seat.state, 'active');
});

await proof('a key with only a bundle on credit: the payment pays the bundle and gives the seat it paid for', async () => {
  const k = await keyOf();
  const b = await call('/seat?a=paths&paths=500', { method: 'POST', headers: { 'x-sea-session': k } }); assert.equal(b.status, 200, b.text);
  paidSession('cs_test_settle0000000000002', tokenOf(b.j.checkout_url));
  const r = await call('/seat/confirm?session=cs_test_settle0000000000002'); assert.equal(r.status, 200, r.text);
  const d = await store.peek(sessionHash(k)); assert.equal(d.seat.paths, 500 + SEAT.paths); assert.equal(d.seat.state, 'active');
  const c = (await call('/treasury')).j.credits.last.find((x) => x.sale === b.j.sale_id); assert.equal(c.status, 'paid');
});

await proof('a payment without a key in its link (no client_reference_id): a new key with a seat, as before', async () => {
  paidSession('cs_test_settle0000000000003', null);
  const r = await call('/seat/confirm?session=cs_test_settle0000000000003'); assert.equal(r.status, 200, r.text);
  assert.match(r.j.key, /^mls_/);
});

await proof('buy_on_credit from the first call of a key without a seat; gone once the key has a seat', async () => {
  const k = await keyOf();
  const r = await call('/route?q=running+shoes', { headers: { 'x-sea-session': k } });
  assert.ok(r.status === 200 || r.status === 202, r.text.slice(0, 200));
  assert.match(String(r.j?.buy_on_credit || r.j?.supply?.buy_on_credit || ''), /^POST https:\/\/mare\.test\/seat with header x-sea-session: <key>: a seat \(24 USD, 5000 paths\) at once, 7 days to pay/);
  const seated = await call('/route?q=running+shoes', { headers: { 'x-sea-session': KEY } });
  assert.equal(seated.j?.buy_on_credit, undefined);
});

await negative('a second seat on the paid credit is caught', async () => { const d = await store.peek(sessionHash(KEY)); assert.equal(d.seat.paths, 2 * SEAT.paths); });
await negative('a credit still open after the payment is caught', async () => { const c = (await call('/treasury')).j.credits.last.find((x) => x.sale === SALE); assert.equal(c.status, 'credit'); });

console.log(`\n${passed} held, ${failed} failed · negative controls: ${negOk} caught, ${negBad} missed`);
process.exit(failed || negBad ? 1 : 0);
