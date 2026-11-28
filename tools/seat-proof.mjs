// Mare Liberum · proof of the seat (4.0, node/seat.mjs): a chat host buys for its human, by card, with one link.
// It proves, without the network (the Edge Function mare-mpp is a fake that answers what Stripe holds per session):
// POST /seat?as=host answers the link and the terms exactly as a host needs them (no auth); ?a=host is the same; the link is
// a signed token, valid 7 days, the same all day for the same key; GET /pay/<token> is a receipt of at most 25 lines with
// the price, one button to the order door /c/seat (which leads to the seat's Stripe link with the token as reference) and
// the x402 way in one line, no form, no login, no e-mail, no cookie; a forged or old token gets no page; Stripe's return
// gives the seat only for a payment that is complete, paid, through the seat's link and for exactly 24.00 USD: the sale is
// written once (host_seat, settled, host_link) and /treasury counts it; a key is made for the payment and the thanks page
// shows it in one <code> line (a payment that hands back its reference gives the seat to the key the token names);
// a later visit gives the same answer and writes nothing; an unpaid or foreign session gives nothing and writes nothing;
// POST /seat/confirm {token} is 202 until paid and 200 after (never 402: nothing is paid to this address); /seats names the card before the wallet; the skill, llms.txt
// and /pay/howto say the seat's line from node/pricing.mjs. Negative controls: each check, fed a broken part, must fail.
// Runs: node tools/seat-proof.mjs  (exit code 1 when a proof or a negative control fails)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handle } from '../node/core.mjs';
import { createMem } from '../node/mem.mjs';
import { memoryKv } from '../node/flow.mjs';
import { createLedger } from '../node/ledger.mjs';
import { payConfig } from '../node/pay.mjs';
import { SEAT, seatLine, seatSentence } from '../node/pricing.mjs';
import { seatToken, readSeatToken, seatPaid, payPage, hostOf, checkoutOf } from '../node/seat.mjs';
import { setViaKey } from '../node/via.mjs';
import { OFFER } from '../node/seo.mjs';

let passed = 0, failed = 0, negOk = 0, negBad = 0;
const proof = async (name, fn) => { try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 5).join('\n       ')}`); } };
const negative = async (name, fn) => { let threw = false; try { await fn(); } catch { threw = true; } if (threw) { negOk++; console.log(`  ok   negative control fails as it must: ${name}`); } else { negBad++; console.log(`  FAIL negative control did not fail: ${name}`); } };

setViaKey(Buffer.alloc(32, 7));
const BASE = 'https://mare.test', SECRET = 'q'.repeat(48);
const db = createMem({ file: 'data/none.tsv', base: BASE }), kv = memoryKv(), ledger = createLedger({});
const SESSIONS = new Map();
const paidSession = (id, o = {}) => ({ ok: true, id, status: 'complete', payment_status: 'paid', mode: 'payment', payment_link: SEAT.linkId, amount_total: SEAT.cents, currency: 'usd', payment_intent: `pi_${id.slice(-12)}`, livemode: true, created: 1, client_reference_id: null, ...o });
const fakeFetch = async (url, init) => { const b = JSON.parse(init.body); const s = SESSIONS.get(b.session); return s ? new Response(JSON.stringify(s), { status: 200, headers: { 'content-type': 'application/json' } }) : new Response(JSON.stringify({ ok: false, status: 404, message: 'No such checkout.session' }), { status: 404, headers: { 'content-type': 'application/json' } }); };
const cfg = () => ({ base: BASE, kv, ledger, pay: payConfig({}), waitUntil: () => {}, creditSweepMs: 0, checkout: { secret: SECRET, url: 'https://db.test', anon: 'anon-test', fetch: fakeFetch } });
let ipN = 0;
const call = async (path, { method = 'GET', headers = {}, body } = {}) => {
  const res = await handle(new Request(BASE + path, { method, headers: { 'user-agent': 'Mozilla/5.0 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)', 'x-forwarded-for': `203.0.113.${(ipN++ % 200) + 1}`, accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) }), db, cfg());
  const text = await res.text(); let j = null; try { j = JSON.parse(text); } catch {}
  return { status: res.status, h: res.headers, j, text };
};
const sid = (n) => `cs_live_${String(n).padStart(4, '0')}seatA1b2C3d4E5f6G7h8`;
const newKey = async () => JSON.parse((await call('/session?as=key')).text).key;
const sales = () => ledger.treasury().then((t) => t);

console.log('the seat');

await proof('POST /seat?as=host: 201 with seat_id, checkout_url, price_usd 24, period_days 30, paths_included 5000, price_per_path_over 0.01, how_to_present, one_sentence and status awaiting_human, without any auth; ?a=host is the same', async () => {
  for (const q of ['as=host', 'a=host']) {
    const r = await call(`/seat?${q}`, { method: 'POST' });
    assert.equal(r.status, 201, q); const j = r.j;
    assert.deepEqual(Object.keys(j).slice(0, 9), ['seat_id', 'checkout_url', 'price_usd', 'period_days', 'paths_included', 'price_per_path_over', 'how_to_present', 'one_sentence', 'status']);
    assert.match(j.seat_id, /^st_[0-9a-f]{16}$/); assert.ok(j.checkout_url.startsWith(`${BASE}/pay/`));
    assert.equal(j.price_usd, 24); assert.equal(j.period_days, 30); assert.equal(j.paths_included, 5000); assert.equal(j.price_per_path_over, 0.01);
    assert.equal(j.how_to_present, 'give the human this one link, say one sentence, never paraphrase the price');
    assert.equal(j.one_sentence, 'Give Mare Liberum 24 USD for a month, 5000 agent paths included'); assert.equal(j.one_sentence, seatSentence()); assert.equal(j.status, 'awaiting_human');
    const t = readSeatToken(j.checkout_url.split('/pay/')[1]); assert.equal(t.ok, true); assert.equal(t.id, j.seat_id); assert.equal(t.cents, 2400); assert.equal(t.src, 'chatgpt');
    assert.ok(t.exp * 1000 - Date.now() > 6.9 * 86400e3 && t.exp * 1000 - Date.now() <= 7 * 86400e3 + 1000, 'valid 7 days');
  }
  assert.equal((await call('/seat?as=nothing', { method: 'POST' })).status, 400);
  // a host that can only read links: GET gives the same answer (200), nothing written
  const g = await call('/seat?as=host'); assert.equal(g.status, 200); assert.deepEqual(Object.keys(g.j).slice(0, 9), ['seat_id', 'checkout_url', 'price_usd', 'period_days', 'paths_included', 'price_per_path_over', 'how_to_present', 'one_sentence', 'status']); assert.equal(g.j.price_usd, 24);
});

await proof('with a key the link names the key\'s public id, and the same key gets the same link all day', async () => {
  const key = await newKey(); const a = await call('/seat?as=host', { method: 'POST', headers: { 'x-sea-session': key } }), b = await call('/seat?a=host', { method: 'POST', headers: { 'x-sea-session': key } });
  assert.equal(a.j.checkout_url, b.j.checkout_url); const t = readSeatToken(a.j.checkout_url.split('/pay/')[1]); assert.match(t.k, /^[0-9a-f]{24}$/); assert.match(a.j.then, /thanks page shows a key/);
  assert.equal((await call('/seat?as=host', { method: 'POST', headers: { 'x-sea-session': 'mls_' + 'x'.repeat(32) } })).status, 401, 'a key the sea does not know');
});

let LINK = null;
await proof('GET /pay/<token>: 200 text/html, at most 25 lines, the price 24, one button to the order door /c/seat (302 to the seat\'s Stripe link with the token as client_reference_id), the x402 way in one line, no form, no login, no e-mail, no cookie', async () => {
  const j = (await call('/seat?as=host', { method: 'POST' })).j; LINK = j.checkout_url;
  const r = await call(LINK.slice(BASE.length), { headers: { accept: 'text/html' } });
  assert.equal(r.status, 200); assert.match(r.h.get('content-type'), /^text\/html/);
  const lines = r.text.split('\n'); assert.ok(lines.length <= 25, `${lines.length} lines`);
  assert.match(r.text, /24 USD/); assert.equal((r.text.match(/class="pay"/g) || []).length, 1, 'one button');
  const tok = LINK.split('/pay/')[1], door = `${BASE}/c/seat?from=pay&amp;ref=${tok}`; assert.ok(r.text.includes(door), 'the button is the order door'); assert.match(r.text, /x402/);
  const go = await call(`/c/seat?from=pay&ref=${tok}`, { headers: { accept: 'text/html', 'sec-fetch-mode': 'navigate', 'accept-language': 'de' } }); assert.equal(go.status, 302); assert.equal(go.h.get('location'), `${OFFER.seat}?client_reference_id=${tok}`);
  for (const bad of [/<form/i, /<input/i, /<img/i, /type="email"/i, /log ?in\b(?! here)/i, /password/i, /address/i, /stylesheet/i]) assert.ok(!bad.test(r.text.replace(/No login, no account here/, '')), `the page must not carry ${bad}`);
  assert.equal(r.h.get('set-cookie'), null, 'the sea sets no cookie');
  assert.match(r.h.get('x-robots-tag'), /noindex/); assert.equal(r.h.get('referrer-policy'), 'no-referrer');
});

await proof('a forged, cut or old token gets no page and no cookie', async () => {
  const tok = LINK.split('/pay/')[1], forged = tok.slice(0, -2) + (tok.endsWith('AA') ? 'BB' : 'AA');
  for (const t of [forged, 'abc', `${tok}x`]) { const r = await call(`/pay/${t}`); assert.ok(r.status === 404, t); }
  const old = seatToken({ id: 'st_00000000000000aa', exp: Math.floor(Date.now() / 1000) - 10 }); const r = await call(`/pay/${old}`); assert.equal(r.status, 410);
  assert.equal((await call('/pay/howto')).status, 200, '/pay/howto stays the guide');
});

await proof('Stripe\'s return without a key: the seat for a payment Stripe confirmed, one sale (host_seat, settled, host_link, 24.00) in /treasury, a key made for it, shown in one <code> line on /thanks; the key opens a paid door against the seat', async () => {
  const s = sid(1); SESSIONS.set(s, paidSession(s));
  const before = (await ledger.treasury()).today_count || 0;
  const r = await call(`/seat/confirm?session=${s}`, { headers: { accept: 'text/html' } });
  assert.equal(r.status, 303); assert.equal(r.h.get('location'), `${BASE}/thanks?session=${s}`);
  const th = await call(`/thanks?session=${s}`, { headers: { accept: 'text/html' } }); assert.equal(th.status, 200);
  const key = /<code>(mls_[A-Za-z0-9_-]{32})<\/code>/.exec(th.text)?.[1]; assert.ok(key, 'the key in one <code> line');
  const tr = await ledger.treasury(); assert.equal(tr.today_count, before + 1); const line = tr.last_5.find((x) => /^host_seat/.test(x.q));
  assert.ok(line, 'host_seat in a line of the treasury'); assert.equal(line.status, 'settled'); assert.equal(line.method, 'host_link'); assert.equal(Number(line.amount_usd), 24);
  const pub = await call('/treasury'); assert.equal(pub.status, 200); assert.ok(pub.j.last_5.some((x) => /^host_seat/.test(x.q)), 'GET /treasury shows it');
  const me = await call('/session', { headers: { 'x-sea-session': key } }); assert.equal(me.status, 200); assert.equal(me.j.seat.state, 'active'); assert.equal(me.j.seat.paths, 5000);
  const door = await call('/x402/check?site=example.com', { headers: { 'x-sea-session': key } }); assert.notEqual(door.status, 402, 'the key opens the paid door');
  const after = await call('/session', { headers: { 'x-sea-session': key } }); assert.ok(after.j.seat.used <= 1 && after.j.probe.left === 0, 'a path of the seat, never a probe call');
  const again = await call(`/thanks?session=${s}`, { headers: { accept: 'text/html' } }); assert.ok(again.text.includes(key), 'a reload shows the same key');
  assert.equal((await ledger.treasury()).today_count, before + 1, 'a later visit writes nothing');
});

await proof('a payment that hands back its reference (the token, once the Edge Function passes client_reference_id): the key the host sent turns active (seat_state active), nothing to copy, one sale', async () => {
  const key = await newKey(); const j = (await call('/seat?as=host', { method: 'POST', headers: { 'x-sea-session': key } })).j;
  const s = sid(2); SESSIONS.set(s, paidSession(s, { client_reference_id: j.checkout_url.split('/pay/')[1] }));
  const r = await call(`/seat/confirm?session=${s}`, { headers: { accept: 'text/html' } }); assert.equal(r.status, 303);
  const th = await call(`/thanks?session=${s}`, { headers: { accept: 'text/html' } }); assert.match(th.text, /is active now/); assert.ok(!/<code>mls_/.test(th.text), 'no new key: the host has its own');
  const me = await call('/session', { headers: { 'x-sea-session': key } }); assert.equal(me.j.seat.state, 'active');
  const st = await call('/seat/confirm', { method: 'POST', body: { token: j.checkout_url.split('/pay/')[1] } }); assert.equal(st.status, 200); assert.equal(st.j.status, 'active'); assert.equal(st.j.key_id, me.j.id);
  const sg = await call(`/seat/confirm?token=${j.checkout_url.split('/pay/')[1]}`); assert.equal(sg.status, 200, 'the same by GET'); assert.equal(sg.j.status, 'active');
});

await proof('never a seat without a payment Stripe confirmed: unpaid, open, foreign link, wrong amount or currency, unknown session: no seat, no sale; POST /seat/confirm {token} is 202 (awaiting_human, never 402) with the same link while unpaid', async () => {
  const before = (await ledger.treasury()).today_count || 0;
  const cases = [[sid(10), { payment_status: 'unpaid' }], [sid(11), { status: 'open' }], [sid(12), { payment_link: 'plink_other' }], [sid(13), { amount_total: 100 }], [sid(14), { currency: 'eur' }]];
  for (const [s, o] of cases) { SESSIONS.set(s, paidSession(s, o)); const r = await call(`/seat/confirm?session=${s}`, { headers: { accept: 'application/json' } }); assert.ok(r.status === 409, `${JSON.stringify(o)} -> ${r.status}`); assert.equal(r.j.status, 'not_confirmed'); }
  assert.equal((await call(`/seat/confirm?session=${sid(99)}`, { headers: { accept: 'application/json' } })).status, 404, 'a session Stripe does not know');
  assert.equal((await call('/seat/confirm?session=nonsense')).status, 400);
  const j = (await call('/seat?as=host', { method: 'POST' })).j, tok = j.checkout_url.split('/pay/')[1];
  assert.equal((await call(`/seat/confirm?token=${tok}`)).status, 202, 'GET says the same');
  const r = await call('/seat/confirm', { method: 'POST', body: { token: tok } }); assert.equal(r.status, 202); assert.equal(r.j.status, 'awaiting_human'); assert.equal(r.j.checkout_url, j.checkout_url); assert.ok(!('accepts' in r.j) && !('next_step' in r.j), 'no x402 terms: nothing is paid here');
  assert.equal((await ledger.treasury()).today_count, before, 'nothing written');
});

await proof('/seats and /licence: the offer with the card way first, the wallet after it; ?as= and ?a= read alike; /seat?as=key and ?a=key give a key as /session?as=key does', async () => {
  for (const p of ['/seats', '/licence', '/seats?as=host', '/licence?a=host', '/seat']) {
    const r = await call(p); assert.equal(r.status, 200, p); assert.equal(r.j.ways[0].way, 'card'); assert.equal(r.j.ways[1].way, 'wallet'); assert.equal(r.j.price_usd, 24); assert.equal(r.j.line, seatLine());
  }
  const a = await call('/seat?as=key'), b = await call('/seat?a=key'); assert.equal(a.status, 200); assert.equal(b.status, 200);
  assert.match(JSON.parse(a.text).key, /^mls_[A-Za-z0-9_-]{32}$/); assert.match(JSON.parse(b.text).key, /^mls_[A-Za-z0-9_-]{32}$/);
});

await proof('the seat\'s line stands in node/pricing.mjs only: the skill, llms.txt and /pay/howto say it as written there', async () => {
  const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
  assert.equal(seatLine(), '24 USD for 30 days, 5,000 agent paths included, then 0.01 USD per path');
  for (const f of ['site/skill.md', 'skills/mare-liberum/SKILL.md', 'site/llms.txt']) assert.ok(read(f).includes(seatLine()), f);
  assert.ok((await call('/pay/howto')).text.includes(seatLine()));
});

await proof('the host a call comes from: chatgpt, claude, grok, gemini, cursor, copilot, other', () => {
  const t = [['Mozilla/5.0 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)', 'chatgpt'], ['Claude-User/1.0', 'claude'], ['claude-code/2.0', 'claude'], ['', 'cursor', 'cursor-vscode'], ['Grok/1.0 (xAI)', 'grok'], ['Gemini/1.0', 'gemini'], ['', 'copilot', 'Visual Studio Code'], ['curl/8.5.0', 'other']];
  for (const [ua, want, name] of t) assert.equal(hostOf(ua, name), want, `${ua} ${name || ''}`);
});

console.log('negative controls');
await negative('a page with a form is caught', () => { const html = payPage(BASE, readSeatToken(LINK.split('/pay/')[1])).replace('</body>', '<form><input type="email"></form></body>'); assert.ok(!/<form/i.test(html)); });
await negative('a session for EUR 24 passes as the seat is caught', () => { assert.equal(seatPaid(paidSession(sid(50), { currency: 'eur' })), null); });
await negative('a token signed for another seat is caught', () => { const t = readSeatToken(seatToken({ id: 'st_00000000000000ab', exp: Math.floor(Date.now() / 1000) + 60 }, Buffer.alloc(32, 9))); assert.equal(t.ok, true); });
await negative('a host answer without the price is caught', async () => { const j = checkoutOf(BASE); assert.equal(j.price_usd, 24); });

console.log(`\n${passed} held, ${failed} failed · negative controls: ${negOk} caught, ${negBad} missed`);
process.exit(failed || negBad ? 1 : 0);
