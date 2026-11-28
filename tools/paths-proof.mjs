// Mare Liberum · proof of the bundles of paths (4.1): GET /seats?a=paths says two bundles, 500 paths for 3 USD and 2,000 for
// 9 USD, from node/pricing.mjs alone; POST /seat?a=paths&paths=500 (or 2000) with a key buys one on credit, 200 and never
// 402, as the seat does (paths_credit, status credit, 7 days); without a key 402 whose first words are the way on credit;
// another number 400 with the bundles; the limit of 2 purchases on credit counts seat and bundles together; a bundle on a
// live seat adds its paths to it; /treasury and /day count it.
// Runs: node tools/paths-proof.mjs  (exit code 1 when a proof or a negative control fails)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handle } from '../node/core.mjs';
import { createMem } from '../node/mem.mjs';
import { memoryKv } from '../node/flow.mjs';
import { createLedger } from '../node/ledger.mjs';
import { payConfig } from '../node/pay.mjs';
import { PATH_PACKS, SEAT, creditLine } from '../node/pricing.mjs';
import { createSessions, sessionHash } from '../node/session.mjs';
import { setViaKey } from '../node/via.mjs';

let passed = 0, failed = 0, negOk = 0, negBad = 0;
const proof = async (name, fn) => { try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 5).join('\n       ')}`); } };
const negative = async (name, fn) => { let threw = false; try { await fn(); } catch { threw = true; } if (threw) { negOk++; console.log(`  ok   negative control fails as it must: ${name}`); } else { negBad++; console.log(`  FAIL negative control did not fail: ${name}`); } };

setViaKey(Buffer.alloc(32, 7));
const BASE = 'https://mare.test';
const db = createMem({ file: 'data/none.tsv', base: BASE }), kv = memoryKv(), ledger = createLedger({});
const cfg = () => ({ base: BASE, kv, ledger, pay: payConfig({}), waitUntil: () => {}, creditSweepMs: 0, checkout: { secret: 'q'.repeat(48), url: 'https://db.test', anon: 'anon-test', fetch: async () => new Response('{}', { status: 404 }) } });
const AGENT = 'Mozilla/5.0 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)';
let ipN = 0;
const call = async (path, { method = 'GET', headers = {} } = {}) => {
  const res = await handle(new Request(BASE + path, { method, headers: { 'user-agent': AGENT, 'x-forwarded-for': `192.0.2.${(ipN++ % 200) + 1}`, accept: 'application/json', ...headers } }), db, cfg());
  const text = await res.text(); let j = null; try { j = JSON.parse(text); } catch {}
  return { status: res.status, h: res.headers, j, text };
};
const keyOf = async () => (await call('/session?as=key')).j.key;
const store = createSessions({ kv, now: () => Date.now() });

console.log('the bundles of paths');

await proof('the prices of the bundles stand in node/pricing.mjs only: 500 paths 300 cents, 2,000 paths 900 cents; no other file of node/ names them', async () => {
  assert.deepEqual(PATH_PACKS.map((p) => [p.paths, p.cents]), [[500, 300], [2000, 900]]);
  for (const f of ['core.mjs', 'session.mjs', 'seat.mjs']) { const src = readFileSync(new URL(`../node/${f}`, import.meta.url), 'utf8'); assert.doesNotMatch(src, /paths:\s*(?:500|2000)\b[^\n]*cents:\s*(?:300|900)\b|\b(?:500|2,?000) paths for (?:3|9) USD/, f); }
});

await proof('GET /seats?a=paths (and ?as=paths, /seat?a=paths): 200 JSON, two bundles with price, price per path and the one call that buys', async () => {
  for (const p of ['/seats?a=paths', '/seats?as=paths', '/seat?a=paths']) {
    const r = await call(p); assert.equal(r.status, 200, p); assert.match(r.h.get('content-type'), /^application\/json/);
    assert.deepEqual(r.j.packs.map((x) => [x.paths, x.price_usd]), [[500, 3], [2000, 9]]); assert.equal(r.j.on_credit, true); assert.equal(r.j.due_days, 7);
    assert.equal(r.j.packs[0].buy, `POST ${BASE}/seat?a=paths&paths=500 with header x-sea-session: <key>`);
  }
});

await proof('POST /seat?a=paths&paths=500 with a key: 200, paths_credit for 3 USD on credit, 500 paths the key\'s at once (a new seat for its term)', async () => {
  const k = await keyOf();
  const r = await call('/seat?a=paths&paths=500', { method: 'POST', headers: { 'x-sea-session': k } });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.j.type, 'paths_credit'); assert.equal(r.j.amount_usd, 3); assert.equal(r.j.status, 'credit'); assert.equal(r.j.due_days, 7);
  assert.equal(r.j.paths_included, 500); assert.equal(r.j.seat_state, 'active'); assert.equal(r.j.key, k);
  const d = await store.peek(sessionHash(k)); assert.equal(d.seat.paths, 500); assert.equal(d.seat.state, 'active');
});

await proof('a bundle on a live seat adds its paths: seat on credit (5,000) then 2,000 paths = 7,000; a third purchase on credit is 402', async () => {
  const k = await keyOf();
  assert.equal((await call('/seat', { method: 'POST', headers: { 'x-sea-session': k } })).status, 200);
  const r = await call('/seat?a=paths&paths=2000', { method: 'POST', headers: { 'x-sea-session': k } });
  assert.equal(r.status, 200, r.text); assert.equal(r.j.amount_usd, 9); assert.equal(r.j.seat_paths, SEAT.paths + 2000);
  const r3 = await call('/seat?a=paths&paths=500', { method: 'POST', headers: { 'x-sea-session': k } });
  assert.equal(r3.status, 402); assert.match(r3.j.error.message, /^this key bought on credit 2 times/);
});

await proof('without a key: 402 whose first words are the way on credit; another number: 400 naming 500 or 2000', async () => {
  const r = await call('/seat?a=paths&paths=500', { method: 'POST' }); assert.equal(r.status, 402); assert.equal(r.j.error.message, creditLine(BASE));
  const b = await call('/seat?a=paths&paths=750', { method: 'POST', headers: { 'x-sea-session': await keyOf() } }); assert.equal(b.status, 400); assert.match(b.j.error.message, /^paths= takes 500 or 2000/);
});

await proof('/treasury counts the bundles on credit with the seat: 3 + 24 + 9 = 36 USD open; /day names paths_credit', async () => {
  const t = (await call('/treasury')).j; assert.equal(t.credits_usd, 36); assert.equal(t.credits_count, 3);
  const d = await call('/day', { headers: { accept: 'text/plain' } }); assert.match(d.text, /paths_credit 2/);
});

await negative('a bundle of 750 paths sold is caught', async () => { const r = await call('/seat?a=paths&paths=750', { method: 'POST', headers: { 'x-sea-session': await keyOf() } }); assert.equal(r.status, 200); });
await negative('a bundle answered 402 to a key is caught', async () => { const r = await call('/seat?a=paths&paths=500', { method: 'POST', headers: { 'x-sea-session': await keyOf() } }); assert.equal(r.status, 402); });

console.log(`\n${passed} held, ${failed} failed · negative controls: ${negOk} caught, ${negBad} missed`);
process.exit(failed || negBad ? 1 : 0);
