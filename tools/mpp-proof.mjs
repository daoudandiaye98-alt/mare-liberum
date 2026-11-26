// Mare Liberum · proof of the card door (3.48, node/mpp.mjs, POST /reader/credit/stripe): MPP, method stripe, intent charge.
// It proves, without the network (the Edge Function mare-mpp is a fake that records what it was sent):
// the 402 carries a challenge of the spec (WWW-Authenticate: Payment id, realm, method="stripe", intent="charge", request,
// expires; request = base64url JCS JSON with amount "50", currency usd, the sea's profile and card/link); a credential that
// echoes the challenge with a Shared Payment Token buys 500 pages, once, with a Payment-Receipt of the spec; the Edge Function
// is sent the node's secret, the token, the challenge id and 50 cents, never more; a changed, expired, foreign or used
// challenge, a malformed credential and a refused charge give no credit and a fresh challenge; one PaymentIntent mints once;
// MARE_MPP=off and a node without a secret charge nothing. Negative controls: each check, fed a broken part, must fail.
// Runs: node tools/mpp-proof.mjs  (exit code 1 when a proof or a negative control fails)
import assert from 'node:assert/strict';
import { handle } from '../node/core.mjs';
import { createMem } from '../node/mem.mjs';
import { memoryKv } from '../node/flow.mjs';
import { createLedger } from '../node/ledger.mjs';
import { payConfig } from '../node/pay.mjs';
import { MPP, MPP_DOOR, mppKey, mppChallenge, mppRequest, mppVerify, jcs } from '../node/mpp.mjs';

let passed = 0, failed = 0, negOk = 0, negBad = 0;
const proof = async (name, fn) => { try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 5).join('\n       ')}`); } };
const negative = async (name, fn) => { let threw = false; try { await fn(); } catch { threw = true; } if (threw) { negOk++; console.log(`  ok   negative control fails as it must: ${name}`); } else { negBad++; console.log(`  FAIL negative control did not fail: ${name}`); } };

const BASE = 'https://mare.test', SECRET = 'p'.repeat(48), T0 = Date.parse('2026-11-26T12:00:00Z');
const db = createMem({ file: 'data/none.tsv', base: BASE }), kv = memoryKv(), ledger = createLedger({});
let clock = T0, charges = [], answer = () => ({ status: 200, body: { ok: true, status: 'succeeded', id: `pi_${'A'.repeat(10)}${charges.length}` } });
const fakeFetch = async (url, init) => { const b = JSON.parse(init.body); charges.push({ url, b }); const a = answer(b); return new Response(JSON.stringify(a.body), { status: a.status, headers: { 'content-type': 'application/json' } }); };
const cfg = (extra = {}) => ({ base: BASE, kv, ledger, pay: payConfig({}), waitUntil: () => {}, creditSweepMs: 0, mpp: { secret: SECRET, url: 'https://db.test', anon: 'anon-test', fetch: fakeFetch, now: () => clock, ...extra } });
let ipN = 0;
const call = async (method, path, headers = {}, extra = {}) => {
  const res = await handle(new Request(BASE + path, { method, headers: { 'user-agent': 'proof-agent/1.0', 'x-forwarded-for': `198.51.100.${(ipN++ % 200) + 1}`, accept: 'application/json', ...headers } }), db, cfg(extra));
  const text = await res.text(); let j = null; try { j = JSON.parse(text); } catch {}
  return { status: res.status, h: Object.fromEntries(res.headers), j, text };
};
// the challenge of a 402, parsed as a client would
const parse = (hdr) => { const o = {}; for (const m of String(hdr).matchAll(/(\w+)="([^"]*)"/g)) o[m[1]] = m[2]; assert.match(String(hdr), /^Payment /); return o; };
const credential = (c, spt = 'spt_TestToken123') => `Payment ${Buffer.from(JSON.stringify({ challenge: { id: c.id, realm: c.realm, method: c.method, intent: c.intent, request: c.request, expires: c.expires }, payload: { spt } })).toString('base64url')}`;
const fresh = async () => { const r = await call('POST', MPP_DOOR); assert.equal(r.status, 402); return parse(r.h['www-authenticate']); };

console.log('the card door');
await proof('GET says what the door sells: 500 pages, 0.50 USD, MPP method stripe, the profile, card and link; open', async () => {
  const r = await call('GET', MPP_DOOR); assert.equal(r.status, 200); assert.equal(r.j.pages, 500); assert.equal(r.j.price_usd, '0.50'); assert.equal(r.j.network_id, MPP.networkId); assert.deepEqual(r.j.payment_method_types, ['card', 'link']); assert.equal(r.j.open, true);
});
await proof('POST without a credential: 402, a problem document and WWW-Authenticate: Payment with id, realm, method stripe, intent charge, request and expires; the request is base64url JCS JSON (amount "50", usd, the profile, card and link)', async () => {
  const r = await call('POST', MPP_DOOR); assert.equal(r.status, 402); assert.equal(r.j.type, 'https://paymentauth.org/problems/payment-required'); assert.equal(r.j.status, 402);
  const c = parse(r.h['www-authenticate']); for (const f of ['id', 'realm', 'method', 'intent', 'request', 'expires']) assert.ok(c[f], f);
  assert.equal(c.method, 'stripe'); assert.equal(c.intent, 'charge'); assert.equal(c.realm, 'mare.test'); assert.match(c.request, /^[A-Za-z0-9_-]+$/);
  const req = JSON.parse(Buffer.from(c.request, 'base64url').toString('utf8')); assert.equal(Buffer.from(c.request, 'base64url').toString('utf8'), jcs(req), 'JCS');
  assert.deepEqual([req.amount, req.currency, req.methodDetails.networkId, req.methodDetails.paymentMethodTypes], ['50', 'usd', MPP.networkId, ['card', 'link']]); assert.match(req.externalId, /^mare_[A-Za-z0-9_-]{16}$/);
  const other = parse((await call('POST', MPP_DOOR)).h['www-authenticate']); assert.notEqual(other.id, c.id, 'two challenges of the same second differ');
  assert.equal(Date.parse(c.expires) - clock, MPP.ttlSec * 1000); assert.match(r.h['access-control-expose-headers'], /www-authenticate/); assert.equal(charges.length, 0, 'nothing charged');
});
let token = null;
await proof('a credential that echoes the challenge with a Shared Payment Token buys 500 pages once: 200, the token, a Payment-Receipt of the spec; the Edge Function got the secret, the token, the challenge id and 50 cents in usd', async () => {
  const c = await fresh(); const r = await call('POST', MPP_DOOR, { authorization: credential(c) }); assert.equal(r.status, 200, r.text);
  assert.match(r.j.token, /^mlc_/); assert.equal(r.j.pages, 500); assert.equal(r.j.left, 500); token = r.j.token;
  const rc = JSON.parse(Buffer.from(r.h['payment-receipt'], 'base64url').toString('utf8')); assert.deepEqual([rc.method, rc.status, rc.reference], ['stripe', 'success', `pi_${'A'.repeat(10)}1`]);
  assert.equal(charges.length, 1); const b = charges[0].b; assert.equal(charges[0].url, 'https://db.test/functions/v1/mare-mpp');
  assert.deepEqual([b.secret, b.spt, b.challenge, b.amount, b.currency], [SECRET, 'spt_TestToken123', c.id, 50, 'usd']);
});
await proof('the credit is real: the reader credit door reports 500 pages left for the token', async () => {
  const r = await call('GET', '/reader/credit', { 'x-sea-credit': token }); assert.equal(r.status, 200); assert.ok(JSON.stringify(r.j).includes('"left":500'), r.text.slice(0, 300));
});
await proof('the same challenge again: 402 invalid-challenge with a fresh challenge, nothing charged', async () => {
  const n = charges.length; const c = await fresh(); assert.equal((await call('POST', MPP_DOOR, { authorization: credential(c) })).status, 200);
  const again = await call('POST', MPP_DOOR, { authorization: credential(c, 'spt_OtherToken999') }); assert.equal(again.status, 402); assert.equal(again.j.type, 'https://paymentauth.org/problems/invalid-challenge'); assert.ok(again.h['www-authenticate']); assert.equal(charges.length, n + 1);
});
await proof('a changed challenge (another amount), one of another realm, an expired one and a malformed credential: 402, no charge', async () => {
  const n = charges.length, c = await fresh();
  const cheap = { ...c, request: Buffer.from(jcs({ ...JSON.parse(Buffer.from(c.request, 'base64url').toString('utf8')), amount: '5' })).toString('base64url') };
  assert.equal((await call('POST', MPP_DOOR, { authorization: credential(cheap) })).j.type, 'https://paymentauth.org/problems/invalid-challenge');
  const foreign = mppChallenge({ realm: 'other.test', key: mppKey(SECRET), now: clock, request: mppRequest({ description: 'x' }) }).challenge;
  assert.equal((await call('POST', MPP_DOOR, { authorization: credential(foreign) })).j.type, 'https://paymentauth.org/problems/invalid-challenge');
  const old = await fresh(); clock += (MPP.ttlSec + 1) * 1000;
  assert.match((await call('POST', MPP_DOOR, { authorization: credential(old) })).j.detail, /expired/);
  assert.equal((await call('POST', MPP_DOOR, { authorization: 'Payment ' + Buffer.from('not json').toString('base64url') })).j.type, 'https://paymentauth.org/problems/malformed-credential');
  const nospt = await fresh(); assert.equal((await call('POST', MPP_DOOR, { authorization: credential(nospt, 'card_4242') })).j.type, 'https://paymentauth.org/problems/malformed-credential');
  assert.equal(charges.length, n);
});
await proof('a refused charge: 402 verification-failed, no token, and the challenge is spent', async () => {
  answer = () => ({ status: 402, body: { ok: false, status: 402, code: 'card_declined', message: 'Your card was declined.' } });
  const c = await fresh(); const r = await call('POST', MPP_DOOR, { authorization: credential(c) }); assert.equal(r.status, 402); assert.equal(r.j.type, 'https://paymentauth.org/problems/verification-failed'); assert.match(r.j.detail, /declined/); assert.ok(!r.j.token);
  assert.equal((await call('POST', MPP_DOOR, { authorization: credential(c) })).j.type, 'https://paymentauth.org/problems/invalid-challenge');
  answer = () => ({ status: 200, body: { ok: false, status: 'requires_action', id: 'pi_NeedsAction1' } });
  const d = await fresh(); assert.equal((await call('POST', MPP_DOOR, { authorization: credential(d) })).status, 402, 'requires_action is no sale');
});
await proof('one PaymentIntent mints once: a second challenge answered with the same PaymentIntent gets 409 and no second credit', async () => {
  answer = () => ({ status: 200, body: { ok: true, status: 'succeeded', id: 'pi_SameIntent77' } });
  assert.equal((await call('POST', MPP_DOOR, { authorization: credential(await fresh()) })).status, 200);
  const r = await call('POST', MPP_DOOR, { authorization: credential(await fresh()) }); assert.equal(r.status, 409); assert.ok(!r.j.token);
});
await proof('MARE_MPP=off and a node without a secret charge nothing: 503 (the GET says open: false)', async () => {
  const n = charges.length; process.env.MARE_MPP = 'off';
  try { assert.equal((await call('POST', MPP_DOOR)).status, 503); assert.equal((await call('GET', MPP_DOOR)).j.open, false); } finally { delete process.env.MARE_MPP; }
  const saved = { v: process.env.MARE_VIA_SECRET, d: process.env.MARE_DB_SECRET }; delete process.env.MARE_VIA_SECRET; delete process.env.MARE_DB_SECRET;
  try { assert.equal((await call('POST', MPP_DOOR, {}, { secret: undefined, challengeSecret: undefined })).status, 503); } finally { if (saved.v) process.env.MARE_VIA_SECRET = saved.v; if (saved.d) process.env.MARE_DB_SECRET = saved.d; }
  assert.equal(charges.length, n);
});

console.log('negative controls');
const KEY = mppKey(SECRET);
await negative('a verifier that skips the id check takes a cheaper request', () => { const c = mppChallenge({ realm: 'mare.test', key: KEY, now: T0, request: mppRequest({ description: 'x', cents: 5 }) }).challenge; const v = mppVerify({ challenge: c, payload: { spt: 'spt_TestToken123' } }, { key: KEY, now: T0, realm: 'mare.test' }); assert.ok(v.ok, 'the cheap challenge must not pass'); });
await negative('a forged id is caught', () => { const c = { ...mppChallenge({ realm: 'mare.test', key: KEY, now: T0, request: mppRequest({ description: 'x' }) }).challenge, id: 'A'.repeat(32) }; assert.ok(mppVerify({ challenge: c, payload: { spt: 'spt_TestToken123' } }, { key: KEY, now: T0, realm: 'mare.test' }).ok); });
await negative('an expired challenge is caught', () => { const c = mppChallenge({ realm: 'mare.test', key: KEY, now: T0, request: mppRequest({ description: 'x' }) }).challenge; assert.ok(mppVerify({ challenge: c, payload: { spt: 'spt_TestToken123' } }, { key: KEY, now: T0 + 3600e3, realm: 'mare.test' }).ok); });

console.log(`\n${passed} passed, ${failed} failed; negative controls: ${negOk} failed as they must, ${negBad} did not`);
process.exit(failed || negBad ? 1 : 0);
