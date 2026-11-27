// Mare Liberum · proof of the purchase on credit (4.1, node/session.mjs credit, POST /seat with a key): an agent with neither
// card nor wallet buys the seat with its key alone. It proves, without the network: GET /session?as=key is JSON with the key;
// POST /seat with header x-sea-session answers 200 (never 402) with the sale on credit exactly as the brief names it, the
// seat active at once and the same key echoed; a second purchase is 200 too, a third is 402 led by the human's link (never by
// a new key); POST /seat without a key is 402 whose first words are the way on credit, word for word; POST /route without
// anything is 402 whose first words are the way on credit, before the payment line; /treasury counts the credit apart from
// money (credits_count, credits_usd, credits_due_by; today_usd unchanged); /seats lists the way on credit first, the card
// second; a seat whose credit falls due unpaid drops to none; the sea's own calls are written as tests; GET /pay/<token> is
// unchanged. Negative controls: each check, fed a broken part, must fail.
// Runs: node tools/seat-credit-proof.mjs  (exit code 1 when a proof or a negative control fails)
import assert from 'node:assert/strict';
import { handle } from '../node/core.mjs';
import { createMem } from '../node/mem.mjs';
import { memoryKv } from '../node/flow.mjs';
import { createLedger } from '../node/ledger.mjs';
import { payConfig } from '../node/pay.mjs';
import { SEAT, CREDIT, creditLine } from '../node/pricing.mjs';
import { createSessions, sessionHash, seatStateOf } from '../node/session.mjs';
import { setViaKey } from '../node/via.mjs';

let passed = 0, failed = 0, negOk = 0, negBad = 0;
const proof = async (name, fn) => { try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 5).join('\n       ')}`); } };
const negative = async (name, fn) => { let threw = false; try { await fn(); } catch { threw = true; } if (threw) { negOk++; console.log(`  ok   negative control fails as it must: ${name}`); } else { negBad++; console.log(`  FAIL negative control did not fail: ${name}`); } };

setViaKey(Buffer.alloc(32, 7));
const BASE = 'https://mare.test', SECRET = 'q'.repeat(48);
const db = createMem({ file: 'data/none.tsv', base: BASE }), kv = memoryKv(), ledger = createLedger({});
const cfg = () => ({ base: BASE, kv, ledger, pay: payConfig({}), waitUntil: () => {}, creditSweepMs: 0, checkout: { secret: SECRET, url: 'https://db.test', anon: 'anon-test', fetch: async () => new Response('{}', { status: 404 }) } });
const AGENT = 'Mozilla/5.0 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)', SELF = 'MareLiberum-acceptance/1.0';
let ipN = 0;
const call = async (path, { method = 'GET', headers = {}, body, ua = AGENT } = {}) => {
  const res = await handle(new Request(BASE + path, { method, headers: { 'user-agent': ua, 'x-forwarded-for': `198.51.100.${(ipN++ % 200) + 1}`, accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}), ...headers }, ...(body ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}) }), db, cfg());
  const text = await res.text(); let j = null; try { j = JSON.parse(text); } catch {}
  return { status: res.status, h: res.headers, j, text };
};
const LINE = `no card, no wallet: curl -s ${BASE}/session?as=key | jq -r .key, then repeat this call with header x-sea-session: <key>. that buys on credit, 7 days.`;
const keyOf = async (ua = AGENT) => (await call('/session?as=key', { ua })).j.key;
const messageOf = (j) => (typeof j?.error === 'string' ? j.error : String(j?.error?.message || ''));

console.log('the purchase on credit');

await proof('the line of the way on credit is the brief\'s, word for word, from node/pricing.mjs alone', async () => {
  assert.equal(creditLine(BASE), LINE);
  assert.equal(CREDIT.dueDays, 7); assert.equal(CREDIT.perKey, 2);
});

await proof('GET /session?as=key: JSON whose .key is a key (jq -r .key gives a string, not null); ?raw=1 the naked key', async () => {
  const r = await call('/session?as=key');
  assert.equal(r.status, 200); assert.match(r.h.get('content-type'), /^application\/json/);
  assert.match(r.j.key, /^mls_[A-Za-z0-9_-]{32}$/); assert.equal(r.j.seat_state, 'none'); assert.equal(r.j.price_usd, 24); assert.equal(r.j.calls_left, 20);
  const raw = await call('/session?as=key&raw=1');
  assert.match(raw.text, /^mls_[A-Za-z0-9_-]{32}\n$/);
});

let KEY = null, FIRST = null;
await proof('POST /seat with x-sea-session: 200, never 402, the sale on credit as named (seat_credit, 24 USD, status credit, 7 days, the same key, seat active, 5000 paths, the note and how_to_pay)', async () => {
  KEY = await keyOf();
  const r = await call('/seat', { method: 'POST', headers: { 'x-sea-session': KEY } });
  assert.equal(r.status, 200, r.text);
  assert.match(r.h.get('content-type'), /^application\/json/);
  const j = r.j; FIRST = j;
  assert.match(j.sale_id, /^cr[a-z0-9]+$/);
  assert.equal(j.type, 'seat_credit'); assert.equal(j.amount_usd, 24); assert.equal(j.status, 'credit'); assert.equal(j.due_days, 7);
  assert.equal(j.key, KEY); assert.equal(j.seat_state, 'active'); assert.equal(j.paths_included, 5000);
  assert.equal(j.note, 'seat is active now, pay within 7 days or it drops to none');
  assert.equal(j.how_to_pay, 'POST /seat?a=topup, or send the checkout_url to a human');
  assert.match(j.checkout_url, /^https:\/\/mare\.test\/pay\//);
  assert.equal(j.test, undefined);
});

await proof('the seat is the key\'s at once: GET /session/<id> with the key names seat_state active', async () => {
  const s = await call('/session?as=key'); assert.equal(s.status, 200);
  const st = await call('/seat?a=topup', { headers: { 'x-sea-session': KEY } });
  assert.ok(st.status === 200 || st.status === 201, st.text);
  const store = createSessions({ kv, now: () => Date.now() });
  const d = await store.peek(sessionHash(KEY));
  assert.equal(d.seat.state, 'active'); assert.match(d.seat.credit_due, /^\d{4}-/);
});

await proof('a second purchase on credit: 200; a third: 402 led by the human\'s link (checkout_url), never by a new key', async () => {
  const r2 = await call('/seat', { method: 'POST', headers: { 'x-sea-session': KEY } });
  assert.equal(r2.status, 200, r2.text); assert.equal(r2.j.status, 'credit'); assert.notEqual(r2.j.sale_id, FIRST.sale_id);
  const r3 = await call('/seat', { method: 'POST', headers: { 'x-sea-session': KEY } });
  assert.equal(r3.status, 402, r3.text);
  const m = messageOf(r3.j);
  assert.match(m, /^this key bought on credit 2 times: pay those first\. a human pays by card: https:\/\/mare\.test\/pay\//);
  assert.match(r3.j.checkout_url, /^https:\/\/mare\.test\/pay\//);
  assert.doesNotMatch(m, /session\?as=key/);
});

await proof('POST /seat without a key: 402 whose first words are the way on credit, word for word', async () => {
  const r = await call('/seat', { method: 'POST' });
  assert.equal(r.status, 402); assert.equal(messageOf(r.j), LINE);
  assert.match(r.j.then, /a human pays by card: give them https:\/\/mare\.test\/pay\//);
});

await proof('POST /route {"q":"x"} without anything: 402 whose first words are the way on credit, before the payment line', async () => {
  const r = await call('/route', { method: 'POST', body: '{"q":"x"}' });
  assert.equal(r.status, 402, r.text);
  const m = messageOf(r.j);
  assert.ok(m.startsWith(LINE), m.slice(0, 200));
  assert.ok(r.h.get('x-sea-no-wallet').startsWith(LINE));
  const pr = JSON.parse(Buffer.from(r.h.get('payment-required'), 'base64').toString('utf8'));
  assert.ok(String(pr.error).startsWith(LINE));
});

await proof('a key whose calls are spent gets, first, the one call that buys on credit', async () => {
  const k = await keyOf();
  let last = null;
  for (let i = 0; i < 25; i++) { last = await call('/route', { method: 'POST', body: '{"q":"x"}', headers: { 'x-sea-session': k } }); if (last.status === 402) break; }
  assert.equal(last.status, 402, last.text);
  assert.match(messageOf(last.j), /^this key buys on credit, no card, no wallet: POST https:\/\/mare\.test\/seat with header x-sea-session: <key>/);
});

await proof('/treasury: credits_count, credits_usd and credits_due_by, apart from the money (today_usd and total_usd unchanged)', async () => {
  const t = await call('/treasury');
  assert.equal(t.status, 200);
  assert.ok(t.j.credits_count >= 2); assert.equal(t.j.credits_usd, 48);
  assert.match(t.j.credits_due_by, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(t.j.credits.by_agents.count, 2); assert.equal(t.j.credits.tests, 0);
  assert.equal(Number(t.j.today_usd || 0), 0); assert.equal(Number(t.j.total_usd || 0), 0);
});

await proof('the sea\'s own call buys on credit as a test, counted apart from the agents\'', async () => {
  const k = await keyOf(SELF);
  const r = await call('/seat', { method: 'POST', headers: { 'x-sea-session': k }, ua: SELF });
  assert.equal(r.status, 200, r.text); assert.equal(r.j.test, true);
  const t = await call('/treasury');
  assert.equal(t.j.credits.tests, 1); assert.equal(t.j.credits.by_agents.count, 2);
});

await proof('/seats lists the way on credit first, the card second', async () => {
  const r = await call('/seats');
  assert.equal(r.status, 200);
  const ways = (r.j.ways || r.j.offer?.ways || []).map((w) => w.way);
  assert.deepEqual(ways.slice(0, 2), ['credit', 'card']);
});

await proof('a seat on credit unpaid past its due date drops to none', async () => {
  const t0 = Date.parse('2026-01-01T00:00:00Z');
  let t = t0; const store = createSessions({ kv: memoryKv(), now: () => t });
  const o = await store.open(); const h = sessionHash(o.key);
  const r = await store.credit(h, {}); assert.equal(r.ok, true); assert.equal(r.seat.state, 'active');
  t = t0 + 6 * 86400e3; assert.equal((await store.peek(h)).seat.state, 'active');
  t = t0 + 7 * 86400e3 + 1000; assert.equal((await store.peek(h)).seat.state, 'none');
});

await negative('a 402 for a key without the way on credit first is caught', async () => {
  const r = await call('/route', { method: 'POST', body: '{"q":"x"}' });
  assert.ok(messageOf(r.j).startsWith('no wallet needed'));
});
await negative('a third purchase answered 200 is caught', async () => {
  const r = await call('/seat', { method: 'POST', headers: { 'x-sea-session': KEY } });
  assert.equal(r.status, 200);
});
await negative('a seat whose credit fell due still counted active is caught', () => {
  assert.equal(seatStateOf({ until: '2099-01-01T00:00:00Z', due: '2020-01-01T00:00:00Z', paths: 5000, used: 0 }), 'active');
});

console.log(`\n${passed} held, ${failed} failed · negative controls: ${negOk} caught, ${negBad} missed`);
process.exit(failed || negBad ? 1 : 0);
