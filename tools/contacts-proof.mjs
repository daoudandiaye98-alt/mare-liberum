// Mare Liberum · proof of the paywall's watch (3.79, node/contacts.mjs and handle() in node/core.mjs): every 402 says what to
// run next (next_step), and the contact book notes who reached the paywall, why the 402 stopped them and how far they came.
// It proves, on a node in this process (handle, as serve.mjs answers), with a stubbed web, catalog, facilitator and DNS (no network):
//   next_step  every 402 of the paid doors carries it; an agent that knows nothing but the body follows its steps and its next
//              request gets the answer: without a wallet a key with probe calls and the same call again (/x402/check,
//              /x402/read, /x402/deal with a JSON body, POST /route, the free /deal past its limit); with a wallet the payment of
//              accepts[0] (or on a door no session opens, POST /reader/credit); with a spent key the payment; with a key on the free
//              door the paid door; "run" is the same as one shell line
//   K2         POST /session?as=key: the key alone as one line of text (201), its bookmark in Location, server-timing under 300 ms
//   contacts   a line per contact (program and network): kompetenz, preis_usd, paywall_hits, paywall_type and paywall_types,
//              first_seen, last_seen, versuchte_paths, abbruch_phase, session, paid, wiederkunft_d7; the cause of each 402: no
//              wallet, price (a contact that paid before, or a wrong sum), scheme (an unreadable payment), chain (another network),
//              timeout (no verdict of the facilitator in time); once or more than once a day; paid after a 402; back on another
//              day within 7 days; own calls never; no address and no network in clear anywhere
//   numbers    /contacts.json and the four lines of /contacts.txt (new agents, 402 by cause, 402 to paid, back d7); the lines
//              for the operator only (/contacts.ndjson, x-mare-mod) in exactly the columns of supabase/kontaktbuch.sql
// Negative controls at the end: each rule broken in a copy of the code, and this proof must fail there.
// Runs without the network: node tools/contacts-proof.mjs   (exit code 1 when a proof fails or a control is not caught)
//   --no-controls   only the proofs (the controls run this file that way in each broken copy)
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, cpSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { randomBytes, createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const k of ['MARE_TOLL', 'MARE_ENGINE', 'MARE_FAIR', 'MARE_X402_FACILITATOR', 'MARE_PAY_TO', 'MARE_ROUTE_PRICE_CENTS', 'MARE_STATE', 'MARE_DB_URL', 'MARE_DB_KEY', 'MARE_DB_SECRET', 'MARE_BASE_RPC', 'MARE_CATALOG_ID']) delete process.env[k];
process.env.MARE_VIA_SECRET = 'contacts-proof-via-key, a test value';
let passed = 0, failed = 0;
const D = globalThis.Date; let T0 = D.parse('2026-11-27T09:00:00.000Z');
class Clock extends D { constructor(...a) { if (a.length) super(...a); else super(T0); } static now() { return T0; } }
globalThis.Date = Clock;
const proof = async (name, fn) => { T0 += 60_000; try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 6).join('\n       ')}`); } };
const imp = (f) => import(pathToFileURL(join(ROOT, 'node', f)).href);

// ------------------------------------------------------------------ the world: sites, a shop, the catalog, DNS, a facilitator
const FAC = 'https://facilitator.contacts-proof.dev', CATALOG = 'https://catalog.shopify.com/api/ucp/mcp', W = 'contacts-proof.dev';
const HOME = `<!doctype html><html lang="en"><head><title>Harbour shop</title><meta name="description" content="Ropes and sails"></head><body><main><h1>Harbour shop</h1>${'<p>Ropes, sails and charts for every harbour on the coast, packed the same day and sent by ship or by road to the pier you name.</p>'.repeat(6)}</main></body></html>`;
const ARTICLE = `<!doctype html><html lang="en"><head><title>Pier notes</title></head><body><main><h1>Pier notes</h1>${'<p>The ferries leave the east pier every hour from six in the morning; the last one waits for the night train and crosses in forty minutes.</p>'.repeat(8)}</main></body></html>`;
const productPage = () => `<!doctype html><html lang="en"><head><title>Trail Runner 3 · Shop</title><script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'Product', name: 'Trail Runner 3', brand: { '@type': 'Brand', name: 'Example' }, gtin13: '0123456789012', offers: { '@type': 'Offer', price: '89.00', priceCurrency: 'USD', availability: 'https://schema.org/InStock' } })}</script></head><body><main><h1>Trail Runner 3</h1><p>The Trail Runner 3 is a shoe for long trails, light and quick on rock and mud, made to last for many seasons of running.</p></main></body></html>`;
const offer = (title, cents, host) => ({ title, price_range: { min: { amount: cents, currency: 'USD' } }, variants: [{ price: { amount: cents, currency: 'USD' }, availability: { available: true }, seller: { url: `https://${host}/products/x`, name: host } }] });
let facilitator = null;
const answer = (j, status = 200) => new Response(JSON.stringify(j), { status, headers: { 'content-type': 'application/json' } });
globalThis.fetch = async (u, o = {}) => {
  const s = String(u?.url ?? u);
  if (s.startsWith(FAC)) { const kind = s.slice(FAC.length + 1), body = JSON.parse(o.body); if (!facilitator) throw new Error('the facilitator must not be asked'); return facilitator(kind, body, o.signal); }
  if (s === CATALOG) { const q = String(JSON.parse(o.body)?.params?.arguments?.catalog?.query || ''); return answer({ jsonrpc: '2.0', id: 1, result: { structuredContent: { products: /trail runner 3/i.test(q) ? [offer('Example Trail Runner 3', 7995, `another.${W}`)] : [] } } }); }
  const url = new URL(s);
  if (!url.hostname.endsWith(`.${W}`)) throw new Error(`the proof does not use the network: ${s.slice(0, 80)}`);
  if (url.pathname === '/robots.txt') return new Response('User-agent: *\nAllow: /\n', { status: 200, headers: { 'content-type': 'text/plain' } });
  if (url.pathname === '/llms.txt') return new Response('# Harbour shop\n', { status: 200, headers: { 'content-type': 'text/plain' } });
  if (url.hostname.startsWith('shop.') && url.pathname.startsWith('/products/')) return new Response(productPage(), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
  if (url.pathname === '/pier') return new Response(ARTICLE, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
  if (url.pathname === '/') return new Response(HOME, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
  return new Response('not here', { status: 404, headers: { 'content-type': 'text/plain' } });
};
createRequire(import.meta.url)('node:dns').promises.lookup = async () => [{ address: '93.184.216.34', family: 4 }];
for (const k of ['error', 'warn', 'info', 'log']) { const orig = console[k]; console[k] = k === 'log' ? (...a) => { if (!String(a[0]).startsWith('mare_')) orig(...a); } : () => {}; }
const PAYER = '0x2222222222222222222222222222222222222222';
const settles = () => (kind) => answer(kind === 'verify' ? { isValid: true, payer: PAYER } : { success: true, transaction: `0x${randomBytes(32).toString('hex')}`, network: 'eip155:8453', payer: PAYER });

// ------------------------------------------------------------------ the node
const BASE = 'https://mare.test', SITE = { '/llms.txt': { body: readFileSync(join(ROOT, 'site/llms.txt'), 'utf8'), type: 'text/plain; charset=utf-8' } };
const core = await imp('core.mjs'), { createMem } = await imp('mem.mjs'), { memoryKv } = await imp('flow.mjs');
const { immune } = await imp('immune.mjs'), { createLedger } = await imp('ledger.mjs'), { payConfig } = await imp('pay.mjs');
const { createContacts, prefixOf, causeOf, CONTACTS } = await imp('contacts.mjs');
const dir = mkdtempSync(join(tmpdir(), 'mare-contacts-')), file = join(dir, 'sea.tsv');
process.once('exit', () => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });
writeFileSync(file, ''); writeFileSync(join(dir, 'build.json'), JSON.stringify({ builtAt: '2026-11-20T10:00:00.000Z', entries: 0, lakes: {} }));
const MOD = `contacts-proof operator key ${randomBytes(4).toString('hex')}`;
const db = createMem({ file, base: BASE }), kv = memoryKv(), ledger = createLedger({}), waits = [];
const PAY = { ...payConfig({}), facilitator: FAC, settleWaitMs: 300, verifyMs: 800, settleMs: 4000 };
const cfg = { base: BASE, kv, ledger, pay: PAY, site: SITE, waitUntil: (p) => { waits.push(p); }, creditSweepMs: 0, modKeySha: createHash('sha256').update(MOD).digest('hex') };
const settled = () => Promise.allSettled(waits.splice(0));
const call = async (path, { method = 'GET', accept = 'application/json', ip, ua = 'contacts-proof-agent/1.0', headers = {}, body } = {}) => {
  const h = { accept, 'user-agent': ua, 'x-forwarded-for': ip, ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers };
  const res = await core.handle(new Request(BASE + path, { method, headers: h, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }), db, cfg);
  const text = res.body ? Buffer.from(await res.arrayBuffer()).toString('utf8') : ''; let j = null; try { j = JSON.parse(text); } catch {}
  await settled();
  return { status: res.status, h: Object.fromEntries(res.headers), text, j };
};
await call('/stats', { ip: '127.0.0.1' });
immune.set({ mode: 'normal', rest: [], pace: { perMinute: 1_000_000, burst: 1_000_000 } });
const WALLET = PAY.payTo, USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
let net = 0, site = 0; const fresh = () => `198.51.${100 + Math.floor(net / 250)}.${(net++ % 250) + 1}`, host = () => `s${++site}.${W}`;
const payment = ({ value = '10000', network = 'eip155:8453', bad = false } = {}) => {
  if (bad) return { 'payment-signature': 'not a payment at all' };
  const authorization = { from: PAYER, to: WALLET, value: String(value), validAfter: '0', validBefore: String(Math.floor(T0 / 1000) + 300), nonce: `0x${randomBytes(32).toString('hex')}` };
  return { 'payment-signature': Buffer.from(JSON.stringify({ x402Version: 2, accepted: { scheme: 'exact', network, amount: String(value), asset: USDC, payTo: WALLET }, payload: { signature: `0x${'ab'.repeat(65)}`, authorization } })).toString('base64') };
};
const URLQ = (u) => encodeURIComponent(u);
const today = () => new Date(T0).toISOString().slice(0, 10);
const rel = (u) => { assert.ok(u.startsWith(BASE), u); return u.slice(BASE.length); };
// an agent that knows nothing but the 402 it got: it runs the steps of next_step as they stand ({key} is what a step kept; the
// payment placeholder is signed from accepts of the 402, as an x402 client does)
const follow = async (ns, { ip, ua, key = null, wallet = false, last = null } = {}) => {
  let r = last;
  for (const st of ns.steps) {
    const headers = {};
    for (const [h, v] of Object.entries(st.headers || {})) {
      if (/\{x402 /.test(v)) { assert.ok(wallet, 'a payment step for an agent without a wallet'); const terms = JSON.parse(Buffer.from(r.h['payment-required'], 'base64').toString('utf8')).accepts[0]; Object.assign(headers, payment({ value: terms.amount })); }
      else headers[h] = v.replace('{key}', key ?? '');
    }
    r = await call(rel(st.url), { method: st.method, ip, ua, headers, ...(st.body !== undefined ? { body: st.body } : {}) });
    if (st.keep) { assert.equal(r.status, 200, `the step that keeps ${st.keep}: ${r.text.slice(0, 160)}`); key = r.text.trim(); }
  }
  return { r, key };
};
const contact = async (ua, ip) => {
  const { createHmac } = await import('node:crypto');
  const k = createHmac('sha256', (await imp('via.mjs')).viaKey()).update('mare-contacts-v1').digest();
  const cid = createHmac('sha256', k).update(`${createHash('sha256').update(ua).digest('hex')}|${prefixOf(ip)}`).digest('hex').slice(0, 24);
  return kv.get(`contact:${cid}`);
};

console.log('next_step: the 402 says what to run');
await proof('a 402 of /x402/check without a wallet: next_step opens a key with probe calls and sends the same call again; an agent that follows the body gets the check', async () => {
  facilitator = null; const ip = fresh(), ua = 'flow-check/1.0', s = host();
  const r = await call(`/x402/check?site=${s}`, { ip, ua });
  assert.equal(r.status, 402); const ns = r.j.next_step; assert.ok(ns, 'next_step'); assert.ok(r.j.accepts, 'the x402 body stays');
  assert.deepEqual(ns.steps.map((x) => [x.method, x.url]), [['GET', `${BASE}/session?as=key`], ['GET', `${BASE}/x402/check?site=${s}`]]); assert.equal(ns.steps[0].keep, 'key'); assert.equal(ns.steps[1].headers['x-sea-session'], '{key}');
  assert.equal(ns.run, `KEY=$(curl -sf '${BASE}/session?as=key') && curl -s '${BASE}/x402/check?site=${s}' -H "x-sea-session: $KEY"`);
  assert.match(ns.or.say, /PAYMENT-SIGNATURE/); assert.equal(ns.or.steps[0].headers['payment-signature'], '{x402 payment for accepts[0]}');
  const { r: done } = await follow(ns, { ip, ua, last: r }); assert.equal(done.status, 200, done.text.slice(0, 200)); assert.equal(typeof done.j.score, 'number'); assert.equal(done.j.session.left, 19);
});
await proof('the same on /x402/read, /x402/deal (with its JSON body) and POST /route: the next request follows from the body alone', async () => {
  for (const [path, opts, want] of [
    [`/x402/read?url=${URLQ(`https://${host()}/pier`)}`, {}, (j) => /ferries/.test(j.markdown)],
    ['/x402/deal', { method: 'POST', body: { url: `https://shop.${W}/products/runner` } }, (j) => j.found === true],
    [`/route?q=${URLQ('find usdc price')}`, { method: 'POST' }, (j) => j.count > 0],
  ]) {
    const ip = fresh(), ua = `flow-${path.slice(1, 9).replace(/\W/g, '')}/1.0`;
    const r = await call(path, { ip, ua, ...opts }); assert.equal(r.status, 402, path);
    const st = r.j.next_step.steps[1]; assert.equal(st.method, opts.method || 'GET');
    if (opts.body) { assert.deepEqual(st.body, opts.body); assert.match(r.j.next_step.run, /-H 'content-type: application\/json' -d '\{"url":/); }
    const { r: done } = await follow(r.j.next_step, { ip, ua, last: r }); assert.equal(done.status, 200, `${path}: ${done.text.slice(0, 200)}`); assert.ok(want(done.j), path); assert.equal(done.j.session.left, 19);
  }
});
await proof('the free /deal past its ten checks an hour: next_step leads to the paid door with a new key; with a key the free door itself answers (one probe call)', async () => {
  const ip = fresh(), ua = 'flow-free/1.0', u = `https://shop.${W}/products/runner`;
  for (let i = 0; i < 10; i++) { T0 += 500; const r = await call(`/deal?url=${URLQ(u)}`, { ip, ua }); assert.equal(r.status, 200, `free ${i + 1}`); }
  const r = await call(`/deal?url=${URLQ(u)}`, { ip, ua }); assert.equal(r.status, 402); assert.equal(r.j.next_step.steps[1].url, `${BASE}/x402/deal?url=${URLQ(u)}`);
  const { r: done, key } = await follow(r.j.next_step, { ip, ua, last: r }); assert.equal(done.status, 200); assert.equal(done.j.found, true);
  // (since 3.80) the free door past its limit takes the key itself: the same call, one probe call
  const again = await call(`/deal?url=${URLQ(u)}`, { ip, ua, headers: { 'x-sea-session': key } }); assert.equal(again.status, 200, again.text.slice(0, 200)); assert.equal(again.j.found, true); assert.equal(again.j.session.left, 18);
});
await proof('with a wallet: the agent follows "or" (accepts[0] signed) and gets the paid check; on a door no session opens (POST /reader/credit) the payment is the first step', async () => {
  facilitator = settles(); const ip = fresh(), ua = 'flow-wallet/1.0';
  const r = await call(`/x402/check?site=${host()}`, { ip, ua }); assert.equal(r.status, 402);
  const { r: paid } = await follow(r.j.next_step.or, { ip, ua, wallet: true, last: r }); assert.equal(paid.status, 200, paid.text.slice(0, 200)); assert.ok(paid.j.paid);
  const c = await call('/reader/credit', { method: 'POST', ip, ua }); assert.equal(c.status, 402); assert.equal(c.j.next_step.steps.length, 1); assert.equal(c.j.next_step.or, undefined); assert.equal(c.j.next_step.run, undefined);
  const { r: bought } = await follow(c.j.next_step, { ip, ua, wallet: true, last: c }); assert.ok(bought.status === 200 || bought.status === 201, bought.text.slice(0, 200)); assert.ok(bought.j.token || bought.h['x-sea-credit'], 'a reader credit');
  facilitator = null;
});
await proof('a key whose probe calls are spent: next_step is the payment of the same call (and says why); followed with a wallet, the answer comes', async () => {
  facilitator = settles(); const ip = fresh(), ua = 'flow-spent/1.0';
  const k = (await call('/session', { method: 'POST', ip, ua })).j; const rec = await kv.get(`session:${k.id}`); rec.probe.left = 0; await kv.set(`session:${k.id}`, rec, 86_400 * 31);
  const r = await call(`/x402/check?site=${host()}`, { ip, ua, headers: { authorization: `Bearer ${k.key}` } }); assert.equal(r.status, 402);
  assert.match(r.j.next_step.note, /spent/); assert.equal(r.j.next_step.steps[0].headers['payment-signature'], '{x402 payment for accepts[0]}');
  const { r: paid } = await follow(r.j.next_step, { ip, ua, wallet: true, last: r }); assert.equal(paid.status, 200); assert.ok(paid.j.paid);
  facilitator = null;
});
await proof('K2: POST /session?as=key gives the key alone (one line of text, 201), its bookmark in Location, server-timing under 300 ms; one POST, nothing else', async () => {
  const r = await call('/session?as=key', { method: 'POST', ip: fresh(), ua: 'flow-k2/1.0', accept: '*/*' });
  assert.equal(r.status, 201); assert.match(r.h['content-type'], /^text\/plain/); assert.match(r.text, /^mls_[A-Za-z0-9_-]{32}\n$/);
  assert.match(r.h.location, /^https:\/\/mare\.test\/session\/[0-9a-f]{24}$/); assert.equal(r.h['x-sea-session-left'], '20');
  const ms = Number(/session;dur=([\d.]+)/.exec(r.h['server-timing'])?.[1]); assert.ok(ms >= 0 && ms < 300, `server-timing ${r.h['server-timing']}`);
  const use = await call(`/x402/check?site=${host()}`, { ip: fresh(), headers: { 'x-sea-session': r.text.trim() } }); assert.equal(use.status, 200); assert.equal(use.j.session.left, 19);
});

console.log('task 1: the way out without a wallet');
await proof('every 402 begins with the way out without a wallet: the error of the body, of PAYMENT-REQUIRED and of x402-payment-required, and the header x-sea-no-wallet; POST /route with a JSON body too', async () => {
  const W0 = `no wallet needed: run  curl -s ${BASE}/session?as=key  then repeat this call with header  x-sea-session: <key>`;
  const r = await call('/route', { method: 'POST', ip: fresh(), ua: 't1-route/1.0', body: { q: 'x' } }); assert.equal(r.status, 402);
  assert.equal(r.h['x-sea-no-wallet'], W0); assert.ok(String(r.j.error).startsWith(W0), String(r.j.error).slice(0, 120));
  const v2 = JSON.parse(Buffer.from(r.h['payment-required'], 'base64').toString('utf8')); assert.ok(v2.error.startsWith(W0)); assert.equal(v2.accepts.length, 1, 'the terms stay');
  const v1h = JSON.parse(r.h['x402-payment-required']); assert.ok(v1h.error.startsWith(W0));
  assert.match(r.h['access-control-expose-headers'], /x-sea-no-wallet/);
  for (const path of [`/x402/check?site=${host()}`, `/x402/read?url=${URLQ(`https://${host()}/pier`)}`, `/x402/deal?url=${URLQ(`https://shop.${W}/products/runner`)}`, `/x402/pack?url=${URLQ(`https://${host()}/`)}&q=ropes`]) {
    const x = await call(path, { ip: fresh(), ua: 't1-doors/1.0' }); assert.equal(x.status, 402, path); assert.equal(x.h['x-sea-no-wallet'], W0, path);
    assert.ok(String(typeof x.j.error === 'string' ? x.j.error : x.j.error.message).startsWith(W0), path);
  }
  const c = await call('/reader/credit', { method: 'POST', ip: fresh(), ua: 't1-credit/1.0' }); assert.equal(c.status, 402); assert.match(c.h['x-sea-no-wallet'], /^no wallet needed: run {2}curl -s https:\/\/mare\.test\/session\?as=key {2}then read with {2}GET https:\/\/mare\.test\/x402\/read\?url=<page>/);
});
await proof('GET /session?as=key: one GET, no body: the key alone as one line of text (200, Location, server-timing); a crawler and a HEAD get the words, never a key; POST stays as the other way', async () => {
  const r = await call('/session?as=key', { ip: fresh(), ua: 't1-get/1.0', accept: '*/*' }); assert.equal(r.status, 200); assert.match(r.text, /^mls_[A-Za-z0-9_-]{32}\n$/); assert.match(r.h['content-type'], /^text\/plain/);
  assert.match(r.h.location, /\/session\/[0-9a-f]{24}$/); assert.equal(r.h['x-sea-session-left'], '20'); assert.match(r.h['server-timing'], /^session;dur=/); assert.match(r.h['cache-control'], /no-store/);
  const k = r.text.trim(), use = await call(`/x402/check?site=${host()}`, { ip: fresh(), headers: { 'x-sea-session': k } }); assert.equal(use.status, 200); assert.equal(use.j.session.left, 19);
  const bot = await call('/session?as=key', { ip: fresh(), ua: 'Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)' }); assert.equal(bot.status, 200); assert.ok(bot.j?.what, 'a crawler gets the words'); assert.ok(!/mls_/.test(bot.text));
  const head = await call('/session?as=key', { method: 'HEAD', ip: fresh(), ua: 't1-head/1.0' }); assert.ok(!/mls_/.test(head.text));
  const w = (await call('/session', { ip: fresh() })).j; assert.equal(w.open.call, `GET ${BASE}/session?as=key`); assert.match(w.open.or, /^POST /);
  const o = (await call('/openapi.json', { ip: '127.0.0.1' })).j.paths['/session'].get; assert.equal(o.operationId, 'sessionKey'); assert.deepEqual(o.parameters[0].schema.enum, ['key']);
});
await proof('the key works where the words say so: /x402/pack, the reader past its free reads of the day (one probe call a page, x-sea-session-left)', async () => {
  const k = (await call('/session?as=key', { ip: fresh(), ua: 't1-pack/1.0' })).text.trim(), h = host();
  const pk = await call(`/x402/pack?url=${URLQ(`https://${h}/`)}&q=ropes+and+sails`, { ip: fresh(), headers: { 'x-sea-session': k } });
  assert.ok(pk.status === 200 || pk.status === 422, pk.text.slice(0, 200)); if (pk.status === 200) assert.ok(pk.j.passages.length && pk.j.session.left === 19); else assert.match(pk.j.error.message, /given back/);
  const ip = fresh(), page = `https://${host()}/pier`;
  for (let i = 0; i < 100; i++) { const r = await call(`/r/${page}?n=${i}`, { ip, ua: 't1-reader/1.0', accept: 'text/markdown' }); assert.equal(r.status, 200, `free read ${i + 1}`); }
  const wall = await call(`/r/${page}?n=x`, { ip, ua: 't1-reader/1.0', accept: 'text/markdown' }); assert.equal(wall.status, 402); assert.match(wall.h['x-sea-no-wallet'], /session\?as=key/);
  const k2 = (await call('/session?as=key', { ip: fresh(), ua: 't1-reader2/1.0' })).text.trim();
  const through = await call(`/r/${page}?n=y`, { ip, ua: 't1-reader/1.0', accept: 'text/markdown', headers: { 'x-sea-session': k2 } }); assert.equal(through.status, 200, through.text.slice(0, 200)); assert.match(through.text, /ferries/); assert.equal(through.h['x-sea-session-left'], '19');
});

console.log('the contact book');
await proof('a line per contact: kompetenz, preis_usd, paywall_hits, cause, first and last seen, the doors tried, the furthest step, the session', async () => {
  const ip = fresh(), ua = 'book-a/1.0', s = host();
  await call(`/x402/check?site=${s}`, { ip, ua }); T0 += 1000; await call(`/x402/read?url=${URLQ(`https://${s}/pier`)}`, { ip, ua });
  let c = await contact(ua, ip); assert.ok(c);
  assert.equal(c.paywall_hits, 2); assert.equal(c.paywall_type, 'no_wallet'); assert.deepEqual(c.paywall_types, { no_wallet: 2 }); assert.equal(c.kompetenz, 'read'); assert.equal(c.preis_usd, '0.010000');
  assert.deepEqual(c.versuchte_paths, ['/x402/check', '/x402/read']); assert.equal(c.abbruch_phase, '402'); assert.equal(c.agent, 'book-a/1.0'); assert.equal(c.kind, 'unknown');
  assert.ok(c.first_seen < c.last_seen); assert.deepEqual(c.days, [today()]); assert.equal(c.wiederkunft_d7, false); assert.equal(c.session, null);
  const k = (await call('/session', { method: 'POST', ip, ua })).j; c = await contact(ua, ip); assert.equal(c.abbruch_phase, 'session'); assert.equal(c.session, k.id);
  await call(`/x402/check?site=${host()}`, { ip, ua, headers: { authorization: `Bearer ${k.key}` } }); c = await contact(ua, ip); assert.equal(c.abbruch_phase, 'probe');
  assert.equal(c.ip_prefix_hash.length, 24); assert.equal(c.ua_hash, createHash('sha256').update(ua).digest('hex'));
});
await proof('the cause of each 402: no wallet; price (a contact that paid before asks again without paying, or a wrong sum); scheme (an unreadable payment); chain (another network); timeout (no verdict in time)', async () => {
  const s = () => `/x402/check?site=${host()}`;
  facilitator = settles(); const ipP = fresh(), uaP = 'cause-price/1.0';
  assert.equal((await call(s(), { ip: ipP, ua: uaP, headers: payment() })).status, 200);
  await call(s(), { ip: ipP, ua: uaP }); assert.equal((await contact(uaP, ipP)).paywall_type, 'price', 'it can pay and did not');
  const ipW = fresh(), uaW = 'cause-sum/1.0'; const w = await call(s(), { ip: ipW, ua: uaW, headers: payment({ value: '50000' }) }); assert.equal(w.status, 402);
  let c = await contact(uaW, ipW); assert.equal(c.paywall_type, 'price'); assert.equal(c.abbruch_phase, 'pay_sent');
  const ipS = fresh(), uaS = 'cause-scheme/1.0'; await call(s(), { ip: ipS, ua: uaS, headers: payment({ bad: true }) }); assert.equal((await contact(uaS, ipS)).paywall_type, 'scheme');
  const ipC = fresh(), uaC = 'cause-chain/1.0'; await call(s(), { ip: ipC, ua: uaC, headers: payment({ network: 'eip155:1' }) }); assert.equal((await contact(uaC, ipC)).paywall_type, 'chain');
  facilitator = (kind, body, signal) => new Promise((res, rej) => { signal?.addEventListener('abort', () => rej(Object.assign(new Error('timed out'), { name: 'TimeoutError' }))); });
  const awake = setTimeout(() => {}, 5000); // (the till's timeout is an unref'd timer: something has to keep this process awake meanwhile)
  const ipT = fresh(), uaT = 'cause-timeout/1.0'; const t = await call(s(), { ip: ipT, ua: uaT, headers: payment() }); clearTimeout(awake); assert.equal(t.status, 402, t.text.slice(0, 200));
  assert.equal((await contact(uaT, ipT)).paywall_type, 'timeout');
  facilitator = null;
  assert.equal(causeOf({ paid: true, message: 'the payment was not accepted: insufficient_funds' }), 'no_wallet');
});
await proof('once or more than once: a day counts the contacts with a 402 once and those with more; a contact that paid after a 402 counts as paid after a 402', async () => {
  const before = (await call('/contacts.json', { ip: '127.0.0.1' })).j.today;
  const ip1 = fresh(), ip2 = fresh();
  await call(`/x402/check?site=${host()}`, { ip: ip1, ua: 'day-once/1.0' });
  for (let i = 0; i < 3; i++) await call(`/x402/check?site=${host()}`, { ip: ip2, ua: 'day-many/1.0' });
  facilitator = settles(); assert.equal((await call(`/x402/check?site=${host()}`, { ip: ip2, ua: 'day-many/1.0', headers: payment() })).status, 200); facilitator = null;
  const after = (await call('/contacts.json', { ip: '127.0.0.1' })).j.today;
  assert.equal(after.contacts402 - before.contacts402, 2); assert.equal(after.single - before.single, 1); assert.equal(after.multi - before.multi, 1);
  assert.equal(after.p402 - before.p402, 4); assert.equal(after.types.no_wallet - before.types.no_wallet, 4); assert.equal(after.paid - before.paid, 1); assert.equal(after.converted - before.converted, 1);
  const c = await contact('day-many/1.0', ip2); assert.equal(c.abbruch_phase, 'paid'); assert.equal(c.paid, 1); assert.equal(c.paid_usd, '0.010000');
});
await proof('own calls are not contacts; no address and no network in clear in any line', async () => {
  const ip = fresh(); const r = await call(`/x402/check?site=${host()}`, { ip, ua: 'MareLiberum-session/1.0' }); assert.equal(r.status, 402); assert.ok(r.j.next_step, 'next_step for everyone');
  assert.equal(await contact('MareLiberum-session/1.0', ip), null);
  for (const k of kv.keys('contact')) { const v = JSON.stringify(await kv.get(k)); assert.ok(!/198\.51\.|203\.0\.113|\/24|::\/48/.test(v) && !/198\.51\./.test(k), `${k}: ${v.slice(0, 120)}`); }
});
await proof('back within 7 days: a contact seen on another UTC day is wiederkunft_d7, its cohort counts it; the four lines say so', async () => {
  const ip = fresh(), ua = 'back-d7/1.0'; await call(`/x402/check?site=${host()}`, { ip, ua });
  const first = today(); T0 += 86_400_000;
  await call(`/x402/check?site=${host()}`, { ip, ua }); const c = await contact(ua, ip); assert.equal(c.wiederkunft_d7, true); assert.deepEqual(c.days, [first, today()]);
  const j = (await call('/contacts.json', { ip: '127.0.0.1' })).j; assert.ok(j.returned_so_far.back >= 1); assert.equal(j.cohort_d7, null, 'no full cohort yet');
  assert.equal(j.lines.length, 5, 'since 3.83 the keys are line 5'); assert.match(j.lines[4], /^5 Schlüssel \(/); assert.match(j.lines[3], /^4 Wiederkehr d7: erste volle Kohorte am \d{4}-\d{2}-\d{2} \(bisher: \d+ von \d+/);
  const t = await call('/contacts.txt', { ip: '127.0.0.1', accept: 'text/plain' }); assert.equal(t.text.trim().split('\n').length, 5, 'since 3.83 five lines'); assert.match(t.text, /^1 Neue Agenten an der Bezahlwand \(/);
  assert.match(t.text, /\n2 402 nach Typ \(.*\): kein Wallet \d+ · Preis \d+ · Scheme \d+ · Chain \d+ · Timeout \d+/); assert.match(t.text, /\n3 402 zu bezahlt \(/);
  T0 += 9 * 86_400_000; const k = (await call('/contacts.json', { ip: '127.0.0.1' })).j; assert.ok(k.cohort_d7, 'a full cohort eight days on'); assert.match(k.lines[3], /^4 Wiederkehr d7 \(Kohorte /);
});
await proof('a key that opened a door makes its contact agent_with_key, not a probe, whatever its name: line 1 counts it once, and the probes counted new that day lose it; the one GET for a key counts as a session (3.81)', async () => {
  const ua = 'x402-lint/1.0', ip = fresh(), day = async () => (await call('/contacts.json', { ip: '127.0.0.1' })).j.today;
  const d0 = await day();
  const a = await call(`/x402/check?site=${host()}`, { ip, ua }); assert.equal(a.status, 402);
  let c = await contact(ua, ip); assert.equal(c.probe, true); assert.equal(c.rolle, 'pruefer');
  const d1 = await day(); assert.equal(d1.new_probe, d0.new_probe + 1);
  const g = await call('/session?as=key', { ip, ua, accept: '*/*' }); assert.equal(g.status, 200); const key = g.text.trim();
  const d2 = await day(); assert.equal(d2.sessions, d0.sessions + 1, 'the GET for a key is a session in the book');
  const r = await call(`/x402/check?site=${host()}`, { ip, ua, headers: { 'x-sea-session': key } }); assert.equal(r.status, 200, r.text.slice(0, 200));
  c = await contact(ua, ip); assert.equal(c.rolle, 'agent_with_key'); assert.equal(c.probe, false);
  const d3 = await day(); assert.equal(d3.with_key, (d0.with_key || 0) + 1); assert.equal(d3.new_probe, d0.new_probe, 'taken out of the probes of the day');
  const r2 = await call(`/x402/check?site=${host()}`, { ip, ua, headers: { 'x-sea-session': key } }); assert.equal(r2.status, 200);
  assert.equal((await day()).with_key, d3.with_key, 'once per contact');
  const plain = 'harbour-buyer/1.0', ip2 = fresh(); await call(`/x402/check?site=${host()}`, { ip: ip2, ua: plain }); assert.equal((await contact(plain, ip2)).rolle, 'agent');
  const t = await call('/contacts.txt', { ip: '127.0.0.1', accept: 'text/plain' }); assert.match(t.text.split('\n')[0], /; agent_with_key, ein Schlüssel öffnete eine Tür: \d+\)$/);
});
await proof('line 5 of the morning: the keys of the day, given, with at least one door, paid; /contacts.json says the same as numbers (3.83)', async () => {
  const keys = async () => (await call('/contacts.json', { ip: '127.0.0.1' })).j.keys, k0 = await keys();
  const ip = fresh(), key = (await call('/session?as=key', { ip, accept: '*/*' })).text.trim();
  assert.equal((await keys()).given, k0.given + 1);
  assert.equal((await call(`/x402/check?site=${host()}`, { ip, headers: { 'x-sea-session': key } })).status, 200); assert.equal((await call(`/x402/check?site=${host()}`, { ip, headers: { 'x-sea-session': key } })).status, 200);
  assert.equal((await keys()).with_a_door, k0.with_a_door + 1, 'a key once, however many doors');
  facilitator = settles(); const paid = await call(`/x402/check?site=${host()}`, { ip, headers: { 'x-sea-session': key, ...payment() } }); facilitator = null; assert.equal(paid.status, 200);
  const k1 = await keys(); assert.equal(k1.paid, k0.paid + 1);
  const t = await call('/contacts.txt', { ip: '127.0.0.1', accept: 'text/plain' }), l5 = t.text.trim().split('\n')[4];
  assert.equal(l5, `5 Schlüssel (${today()}): heute ausgegeben ${k1.given} · mit mindestens einer Tür ${k1.with_a_door} · bezahlt ${k1.paid}`);
});
await proof('the free /check and /deal lead to the paid door: upgrade with the one curl (a key from one GET and the call with it), and that curl works as it stands (3.83)', async () => {
  const site1 = host(), c = await call(`/check?site=${site1}`, { ip: fresh() }); assert.equal(c.status, 200); assert.equal(typeof c.j.score, 'number');
  assert.equal(c.j.upgrade.curl, `KEY=$(curl -s ${BASE}/session?as=key) && curl -s '${BASE}/x402/check?site=${site1}' -H "x-sea-session: $KEY"`); assert.match(c.j.upgrade.price, /20 probe calls free with one key, then 0\.01 USDC/);
  const m = /^KEY=\$\(curl -s (\S+)\) && curl -s '([^']+)' -H "x-sea-session: \$KEY"$/.exec(c.j.upgrade.curl), ip = fresh();
  const key = (await call(rel(m[1]), { ip, accept: '*/*' })).text.trim(), paidDoor = await call(rel(m[2]), { ip, headers: { 'x-sea-session': key } }); assert.equal(paidDoor.status, 200); assert.equal(paidDoor.j.calls_left, 19);
  const d = await call(`/deal?url=${URLQ(`https://shop.${W}/products/trail-runner-3`)}`, { ip: fresh() }); assert.equal(d.status, 200, d.text.slice(0, 200));
  assert.match(d.j.upgrade.curl, /^KEY=\$\(curl -s https:\/\/mare\.test\/session\?as=key\) && curl -s 'https:\/\/mare\.test\/x402\/deal\?url=https%3A%2F%2Fshop\./);
});
await proof('/pulse says who pays first, above unique_domains_today: the agents that paid today (each once), the keys of the day and the paid doors; the sea\'s own calls never count (3.84)', async () => {
  const pulse = async () => (await call('/pulse.json', { ip: '127.0.0.1' })).j, p0 = await pulse();
  assert.deepEqual(Object.keys(p0).slice(0, 2), ['who_pays', 'unique_domains_today']);
  const ua = 'harbour-payer/2.0', ip = fresh(); facilitator = settles();
  await call('/session?as=key', { ip, ua, accept: '*/*' });
  for (let i = 0; i < 2; i++) assert.equal((await call(`/x402/check?site=${host()}`, { ip, ua, headers: payment() })).status, 200);
  await call(`/x402/check?site=${host()}`, { ip: fresh(), ua: 'MareLiberum-session/1.0', headers: payment() }); facilitator = null;
  const p1 = await pulse(); assert.equal(p1.who_pays.paying_agents_today, p0.who_pays.paying_agents_today + 1, 'one agent, two payments'); assert.equal(p1.who_pays.paid_doors_today, p0.who_pays.paid_doors_today + 2); assert.equal(p1.who_pays.keys_today, p0.who_pays.keys_today + 1);
  await call('/settle', { method: 'POST', ip: fresh(), ua: 'harbour-tester/1.0', body: { q: 'find usdc price', test: true } }); const p2 = await pulse();
  assert.equal(p2.who_pays.paying_agents_today, p1.who_pays.paying_agents_today, 'a test is never a paying agent'); assert.equal(p2.who_pays.paid_doors_today, p1.who_pays.paid_doors_today, 'nor a paid door');
  assert.match(p1.who_pays.line, new RegExp(`^who pays \\(${today()}, UTC\\): ${p1.who_pays.paying_agents_today} paying agents? today · ${p1.who_pays.keys_today} keys? today · ${p1.who_pays.paid_doors_today} paid doors?$`));
});
await proof('the operator\'s lines: /contacts.ndjson only with x-mare-mod, in exactly the columns of supabase/kontaktbuch.sql', async () => {
  assert.equal((await call('/contacts.ndjson', { ip: fresh() })).status, 403); assert.equal((await call('/contacts.ndjson', { ip: fresh(), headers: { 'x-mare-mod': 'wrong' } })).status, 403);
  const r = await call('/contacts.ndjson', { ip: fresh(), headers: { 'x-mare-mod': MOD } }); assert.equal(r.status, 200); assert.match(r.h['content-type'], /ndjson/);
  const rows = r.text.trim().split('\n').map((l) => JSON.parse(l)); assert.ok(rows.length >= 10);
  const sql = readFileSync(join(ROOT, 'supabase/kontaktbuch.sql'), 'utf8'), table = /create table if not exists mare\.contacts \(([\s\S]*?)\n\);/.exec(sql)[1];
  const cols = table.split('\n').map((l) => /^\s{2}([a-z_0-9]+)\s/.exec(l)?.[1]).filter((x) => x && x !== 'check');
  for (const row of rows) assert.deepEqual(Object.keys(row).sort(), [...cols].sort());
  assert.ok(/mare_contact_put/.test(sql) && /enable row level security/.test(sql) && /contacts_morning/.test(sql));
});
await proof('the day\'s cap: past 5,000 new contacts a UTC day a contact is counted, not kept', async () => {
  const m = memoryKv(), b = createContacts({ kv: m, secret: 'x'.repeat(32) }), d = today();
  await m.set(`contacts:day:${d}`, { new: CONTACTS.perDay }, 86_400);
  assert.equal(await b.note({ ua: 'cap/1.0', ip: '192.0.2.9', who: { kind: 'unknown', name: 'cap/1.0' }, path: '/x402/check', method: 'GET', kind: '402' }), null);
  assert.equal((await m.get(`contacts:day:${d}`)).overflow, 1); assert.equal(m.keys('contact:').length, 0);
  assert.equal(prefixOf('203.0.113.77'), '203.0.113.0/24'); assert.equal(prefixOf('2001:db8:abcd:12::1'), '2001:db8:abcd::/48'); assert.equal(prefixOf('::ffff:192.0.2.1'), '192.0.2.0/24');
});

await settled();
console.log(`\n${passed} proofs held, ${failed} failed`);

// ------------------------------------------------------------------ negative controls: each rule broken in a copy, the proof must fail there
let caught = 0, missed = 0;
if (!process.argv.includes('--no-controls')) {
  console.log('\nnegative controls: each rule broken in a copy, the proof must fail there');
  const CONTROLS = [
    ['a test counted as a payment (3.84)', 'node/core.mjs', "if (b?.paid?.status === 'test') return supplied(res);", ''],
    ['a payer counted at every payment (3.84)', 'node/contacts.mjs', "const payer = e.kind === 'paid' && c.paid_day !== d;", "const payer = e.kind === 'paid';"],
    ['no line 5 (3.83)', 'node/core.mjs', "d.lines = [...d.lines, `5 Schlüssel", "d.lines_ = [...d.lines, `5 Schlüssel"],
    ['no upgrade on the free check (3.83)', 'node/core.mjs', "upgrade: upgradeOf('check',", "upgrade_: upgradeOf('check',"],
    ['a key that opened a door stays a probe (3.81)', 'node/contacts.mjs', "if (e.kind === 'probe' && c.rolle !== 'agent_with_key') {", 'if (false) {'],
    ['no next_step in the 402', 'node/core.mjs', 'return new Response(JSON.stringify({ ...body, next_step, ...(supply', 'return res; new Response(JSON.stringify({ ...body, next_step, ...(supply'],
    ['the session step without as=key (the key cannot be kept from the answer)', 'node/core.mjs', "const open = { method: 'GET', url: `${base}/session?as=key`, keep: 'key' };", "const open = { method: 'GET', url: `${base}/session`, keep: 'key' };"],
    ['no way out without a wallet in the 402 (error and header)', 'node/core.mjs', "headers.set('x-sea-no-wallet', hint);", "headers.set('x-sea-other', hint);"],
    ['GET /session?as=key gives no key', 'node/core.mjs', "if (actOf(url) === 'key' && req.method === 'GET' && !", "if (false && !"],
    ['the free deal door past its limit ignores the key', 'node/core.mjs', "if (e instanceof SeaError && e.dealLimit && sessionOf(req.headers)) return", "if (false) return"],
    ['a spent key offered the paid door again', 'node/core.mjs', 'const spent = keyed && SESSION_PATH.test(path);', 'const spent = false;'],
    ['every 402 counted as no wallet', 'node/contacts.mjs', "if (!paid) return wallet ? 'price' : 'no_wallet';", "return 'no_wallet';"],
    ['the network written down in clear', 'node/contacts.mjs', 'ip_prefix_hash: mac(`net|${prefix}`)', 'ip_prefix_hash: prefix'],
    ['no return counted', 'node/contacts.mjs', 'if (!c.wiederkunft_d7 && t - Date.parse(c.first_seen) <= CONTACTS.d7 * DAY_MS) { c.wiederkunft_d7 = true; back = true; }', 'if (false) {}'],
    ['own calls counted as contacts', 'node/contacts.mjs', "if (!e || e.who?.kind === 'self' || e.who?.kind === 'resident') return null;", 'if (!e) return null;'],
    ['the lines open without the operator key', 'node/core.mjs', 'if (!operatorKeyOk(req, cfg.modKeySha || undefined)) return operatorCounted(', 'if (false) return operatorCounted('],
    ['more than once a day never counted', 'node/contacts.mjs', '} else if (dayHits === 1) { a.single -= 1; a.multi += 1; }', '}'],
    ['a refused payment counted as no payment', 'node/core.mjs', "note({ kind: pay ? 'pay_sent' :", "note({ kind: false ? 'pay_sent' :"],
  ];
  for (const [name, f, from, to] of CONTROLS) {
    const d2 = mkdtempSync(join(tmpdir(), 'mare-contacts-ctl-'));
    try {
      cpSync(ROOT, d2, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      const fp = join(d2, f), txt = readFileSync(fp, 'utf8');
      if (!txt.includes(from)) { missed++; console.log(`  FAIL control "${name}": the line to break is gone from ${f}; the control needs updating`); continue; }
      writeFileSync(fp, txt.replace(from, to));
      const r = spawnSync(process.execPath, [join(d2, 'tools/contacts-proof.mjs'), '--no-controls'], { encoding: 'utf8', timeout: 300_000 });
      const out = `${r.stdout}${r.stderr}`, broke = (out.match(/\n  FAIL /g) || []).length;
      if (r.status !== 0 && broke > 0) { caught++; console.log(`  ok   caught: ${name} (${broke} proof${broke === 1 ? '' : 's'} failed)`); }
      else { missed++; console.log(`  FAIL control "${name}" was not caught (exit ${r.status})`); }
    } finally { try { rmSync(d2, { recursive: true, force: true }); } catch {} }
  }
  console.log(`${caught} of ${CONTROLS.length} controls caught`);
}
process.exit(failed || missed ? 1 : 0);
