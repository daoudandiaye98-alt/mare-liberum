// Mare Liberum · proof of the day of the till (4.1): GET /day is four lines of plain text (sales today by kind, credit open,
// keys with a purchase, the next step in one sentence); /treasury carries last_sale {type, amount_usd, status, ts}, the newest
// sale of money or credit; line 3 of /contacts.txt reads "402 zu bezahlt: <n> -> bezahlt <b>, auf Kredit <c>, <percent>".
// A purchase on credit by an agent moves all three; a test of the sea's own moves none of the agents' numbers.
// Runs: node tools/day-proof.mjs  (exit code 1 when a proof or a negative control fails)
import assert from 'node:assert/strict';
import { handle } from '../node/core.mjs';
import { createMem } from '../node/mem.mjs';
import { memoryKv } from '../node/flow.mjs';
import { createLedger } from '../node/ledger.mjs';
import { payConfig } from '../node/pay.mjs';
import { setViaKey } from '../node/via.mjs';

let passed = 0, failed = 0, negOk = 0, negBad = 0;
const proof = async (name, fn) => { try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 5).join('\n       ')}`); } };
const negative = async (name, fn) => { let threw = false; try { await fn(); } catch { threw = true; } if (threw) { negOk++; console.log(`  ok   negative control fails as it must: ${name}`); } else { negBad++; console.log(`  FAIL negative control did not fail: ${name}`); } };

setViaKey(Buffer.alloc(32, 7));
const BASE = 'https://mare.test';
const db = createMem({ file: 'data/none.tsv', base: BASE }), kv = memoryKv(), ledger = createLedger({});
const cfg = () => ({ base: BASE, kv, ledger, pay: payConfig({}), waitUntil: () => {}, creditSweepMs: 0, checkout: { secret: 'q'.repeat(48), url: 'https://db.test', anon: 'anon-test', fetch: async () => new Response('{}', { status: 404 }) } });
const AGENT = 'Mozilla/5.0 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)', SELF = 'MareLiberum-acceptance/1.0';
let ipN = 0;
const call = async (path, { method = 'GET', headers = {}, body, ua = AGENT } = {}) => {
  const res = await handle(new Request(BASE + path, { method, headers: { 'user-agent': ua, 'x-forwarded-for': `192.0.2.${(ipN++ % 200) + 1}`, accept: '*/*', ...(body ? { 'content-type': 'application/json' } : {}), ...headers }, ...(body ? { body } : {}) }), db, cfg());
  const text = await res.text(); let j = null; try { j = JSON.parse(text); } catch {}
  return { status: res.status, h: res.headers, j, text };
};
const keyOf = async (ua = AGENT) => (await call('/session?as=key', { ua })).j.key;

console.log('the day of the till');

await proof('GET /day before any purchase: 200, text/plain, exactly four lines, the fourth one sentence that names the first purchase on credit', async () => {
  const r = await call('/day');
  assert.equal(r.status, 200); assert.match(r.h.get('content-type'), /^text\/plain/);
  const l = r.text.trimEnd().split('\n'); assert.equal(l.length, 4, r.text);
  assert.match(l[0], /^1 Verkäufe heute \(\d{4}-\d{2}-\d{2}, UTC\): auf Kredit 0 · bezahlt 0 /);
  assert.match(l[1], /^2 Kredit offen: 0 Käufe, 0 USD/);
  assert.match(l[2], /^3 Schlüssel mit einem Kauf: 0 auf Kredit, 0 mit einer Zahlung heute$/);
  assert.match(l[3], /^4 Nächster Schritt: der erste Kauf auf Kredit durch einen Agenten, .*\.$/);
  assert.equal((await call('/treasury')).j.last_sale, null);
});

await proof('the sea\'s own test purchase moves none of the agents\' numbers, but stands as last_sale with test: true', async () => {
  const k = await keyOf(SELF);
  assert.equal((await call('/seat', { method: 'POST', headers: { 'x-sea-session': k }, ua: SELF })).status, 200);
  const l = (await call('/day')).text.trimEnd().split('\n');
  assert.match(l[0], /auf Kredit 0 · bezahlt 0 .*· Tests 1$/); assert.match(l[1], /^2 Kredit offen: 0 Käufe/); assert.match(l[2], /: 0 auf Kredit,/);
  const t = (await call('/treasury')).j; assert.equal(t.last_sale.test, true); assert.equal(t.last_sale.type, 'seat_credit');
});

await proof('an agent\'s purchase on credit: /day line 1 counts it by kind, line 2 the credit open with its due date, line 3 the key; /treasury last_sale is it', async () => {
  const k = await keyOf();
  const s = await call('/seat', { method: 'POST', headers: { 'x-sea-session': k } }); assert.equal(s.status, 200);
  const l = (await call('/day')).text.trimEnd().split('\n'); assert.equal(l.length, 4);
  assert.match(l[0], /auf Kredit 1 \(seat_credit 1, 24 USD\) · bezahlt 0 /);
  assert.match(l[1], /^2 Kredit offen: 1 Käufe, 24 USD, fällig ab \d{4}-\d{2}-\d{2} \(bezahlt 0, Tests apart 1\)$/);
  assert.match(l[2], /^3 Schlüssel mit einem Kauf: 1 auf Kredit,/);
  assert.match(l[3], /^4 Nächster Schritt: die 1 offenen Käufe auf Kredit \(24 USD\) bezahlen lassen/);
  const t = (await call('/treasury')).j;
  assert.deepEqual(Object.keys(t.last_sale).sort(), ['amount_usd', 'status', 'ts', 'type']);
  assert.equal(t.last_sale.type, 'seat_credit'); assert.equal(t.last_sale.amount_usd, 24); assert.equal(t.last_sale.status, 'credit'); assert.match(t.last_sale.ts, /^\d{4}-/);
});

await proof('/contacts.txt line 3: "402 zu bezahlt: <n> -> bezahlt <b>, auf Kredit <c>, <percent>", the credit of the agent counted', async () => {
  await call('/route', { method: 'POST', body: '{"q":"x"}' });
  const t = await call('/contacts.txt', { headers: { accept: 'text/plain' } });
  const l3 = t.text.split('\n').find((x) => x.startsWith('3 '));
  assert.match(l3, /^3 402 zu bezahlt: (\d+) -> bezahlt 0, auf Kredit 1, (?:\d+,\d %) \(\d{4}-\d{2}-\d{2}; /);
});

await proof('HEAD /day: 200 without a body; /day never answers HTML', async () => {
  const res = await handle(new Request(`${BASE}/day`, { method: 'HEAD', headers: { 'user-agent': AGENT, accept: 'text/html' } }), db, cfg());
  assert.equal(res.status, 200); assert.match(res.headers.get('content-type'), /^text\/plain/); assert.equal(await res.text(), '');
});

await negative('a /day of five lines is caught', async () => { const l = (await call('/day')).text.trimEnd().split('\n'); assert.equal(l.length, 5); });
await negative('a last_sale without status is caught', async () => { const t = (await call('/treasury')).j; assert.equal(t.last_sale.status, undefined); });

console.log(`\n${passed} held, ${failed} failed · negative controls: ${negOk} caught, ${negBad} missed`);
process.exit(failed || negBad ? 1 : 0);
