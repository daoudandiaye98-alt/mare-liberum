// Mare Liberum · proof of the session (3.78, node/session.mjs): one call, one key. An agent without a wallet gets a key with
// probe calls for the paid doors, uses them, and pays on over x402 when they are spent.
// It proves, on a node in this process (handle, as serve.mjs answers), with a stubbed web, catalog, facilitator and DNS (no network):
//   open      POST /session → 201, a key mls_ + 32 base64url, shown once (the state keeps only its SHA-256, nothing holds the key
//             in clear), the bookmark in Location and in the answer, 20 probe calls for 7 days, the key 30 days; GET /session says
//             what it is (with today's count), with the key the key's own state; GET /session/<id> the same without key or hash
//   use       the key on /x402/check, /x402/read, /x402/deal and POST /route answers as the paid door (score; markdown; found;
//             paths) with "session" and x-sea-session-left one less; nothing paid, the facilitator never asked, no sale
//   give back a site that cannot be checked, a page that cannot be read, a page without a product: 422 (403 for robots.txt),
//             the probe call given back (as many left as before); a call that cannot be made (no site, eleven pages, no task,
//             no product page): 400 before anything is taken; a HEAD takes nothing
//   empty     the last probe call says what then; the next call is the door's own 402 (its x402 terms) with
//             x-sea-session-left: 0, counted in the funnel; a payment sent with a key buys as always (the key not looked at)
//   limits    30 calls a minute per key (429, Retry-After, the batch door, nothing taken); 10 new keys a network a UTC day
//             (429 with Retry-After until midnight UTC, the next day again); the sea's 2,000 probe calls a day (then 402 and
//             a note, the key keeps its calls); parallel calls never take more than there is
//   errors    a key of the wrong form 401, an unknown key 401, a key past its 30 days 410 with alternatives, probe calls past
//             their 7 days 402; a body that is not a JSON object 400, longer than 4096 characters 413; PUT /session 501,
//             DELETE /session/<id> 501, an unknown bookmark 404
//   callback  https, a public host by name, port 443, no user: kept (its host on the bookmark) and never called; http, an
//             address, a local name, another port, a user, 301 characters: 422
//   books     /openapi.json lists POST and GET /session and GET /session/{id} as free (security: []), the sold doors stay seven;
//             llms.txt says how; the privacy notice says what is kept, in German and in English
// Negative controls at the end: each rule broken in a copy of the code, and this proof must fail there.
// Runs without the network: node tools/session-proof.mjs   (exit code 1 when a proof fails or a control is not caught)
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
process.env.MARE_VIA_SECRET = 'session-proof-via-key, a test value';
let passed = 0, failed = 0;
const D = globalThis.Date; let T0 = D.parse('2026-11-27T09:00:00.000Z');
class Clock extends D { constructor(...a) { if (a.length) super(...a); else super(T0); } static now() { return T0; } }
globalThis.Date = Clock;
const proof = async (name, fn) => { T0 += 60_000; try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 6).join('\n       ')}`); } };
const imp = (f) => import(pathToFileURL(join(ROOT, 'node', f)).href);

// ------------------------------------------------------------------ the world: sites, a shop, the catalog, DNS, a facilitator
const FAC = 'https://facilitator.session-proof.dev', CATALOG = 'https://catalog.shopify.com/api/ucp/mcp', W = 'session-proof.dev';
const HOME = `<!doctype html><html lang="en"><head><title>Harbour shop</title><meta name="description" content="Ropes and sails for every harbour"><script type="application/ld+json">{"@type":"Organization","name":"Harbour shop"}</script></head><body><main><h1>Harbour shop</h1>${'<p>Ropes, sails and charts for every harbour on the coast, packed the same day and sent by ship or by road to the pier you name.</p>'.repeat(6)}</main></body></html>`;
const ARTICLE = `<!doctype html><html lang="en"><head><title>Pier notes</title><meta name="description" content="When the ferries leave"></head><body><main><h1>Pier notes</h1>${'<p>The ferries leave the east pier every hour from six in the morning; the last one waits for the night train and crosses in forty minutes.</p>'.repeat(8)}</main></body></html>`;
const productPage = ({ name = 'Trail Runner 3', price = '89.00', gtin = '0123456789012' } = {}) => `<!doctype html><html lang="en"><head><title>${name} · Shop</title><meta name="description" content="${name}"><script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'Product', name, brand: { '@type': 'Brand', name: 'Example' }, gtin13: gtin, offers: { '@type': 'Offer', price, priceCurrency: 'USD', availability: 'https://schema.org/InStock' } })}</script></head><body><main><h1>${name}</h1><p>The ${name} is a shoe for long trails, light and quick on rock and mud, made to last for many seasons of running.</p><p>Price: ${price} USD</p></main></body></html>`;
const offer = (title, cents, host) => ({ title, price_range: { min: { amount: cents, currency: 'USD' } }, variants: [{ price: { amount: cents, currency: 'USD' }, availability: { available: true }, seller: { url: `https://${host}/products/x`, name: host } }] });
const RUNNER = [offer('Example Trail Runner 3', 7995, `another.${W}`), offer('Example Trail Runner 3', 8400, `third.${W}`)];
const fetched = [], hooks = [];
let facilitator = null;
const answer = (j, status = 200) => new Response(JSON.stringify(j), { status, headers: { 'content-type': 'application/json' } });
globalThis.fetch = async (u, o = {}) => {
  const s = String(u?.url ?? u); fetched.push(s);
  if (s.startsWith(FAC)) { const kind = s.slice(FAC.length + 1), body = JSON.parse(o.body); if (!facilitator) throw new Error('the facilitator must not be asked'); return facilitator(kind, body); }
  if (s === CATALOG) { const q = String(JSON.parse(o.body)?.params?.arguments?.catalog?.query || ''); return answer({ jsonrpc: '2.0', id: 1, result: { structuredContent: { products: /trail runner 3/i.test(q) ? RUNNER : [] } } }); }
  const url = new URL(s);
  if (!url.hostname.endsWith(`.${W}`)) throw new Error(`the proof does not use the network: ${s.slice(0, 80)}`);
  // (3.83) the callbacks of the proof: /hook answers at once, /hook-slow after 3 s (the sea waits 2 s, never longer)
  if (url.hostname.startsWith('cb.') && url.pathname.startsWith('/hook')) { hooks.push({ url: s, method: o.method, body: String(o.body || ''), at: Date.now() }); if (url.pathname === '/hook-slow') await new Promise((r, j) => { const tm = setTimeout(r, 3000); o.signal?.addEventListener?.('abort', () => { clearTimeout(tm); j(o.signal.reason || Object.assign(new Error('aborted'), { name: 'AbortError' })); }); }); return new Response('ok', { status: 200 }); }
  if (url.pathname === '/robots.txt') return new Response(url.hostname.startsWith('closed.') ? 'User-agent: *\nDisallow: /\n' : 'User-agent: *\nAllow: /\n', { status: 200, headers: { 'content-type': 'text/plain' } });
  if (url.pathname === '/llms.txt') return new Response('# Harbour shop\n\nRopes and sails; the catalogue is at /catalogue.\n', { status: 200, headers: { 'content-type': 'text/plain' } });
  if (url.hostname.startsWith('shop.') && url.pathname === '/products/trail-runner-3') return new Response(productPage(), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
  if (url.hostname.startsWith('shop.') && url.pathname === '/about') return new Response(ARTICLE.replaceAll('Pier notes', 'About us'), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
  if (url.pathname === '/pier') return new Response(ARTICLE, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
  if (url.pathname === '/') return new Response(HOME, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
  return new Response('not here', { status: 404, headers: { 'content-type': 'text/plain' } });
};
// a name under gone. leads to no public address: such a site cannot be checked
createRequire(import.meta.url)('node:dns').promises.lookup = async (host) => (String(host).startsWith('gone.') ? [{ address: '10.0.0.7', family: 4 }] : [{ address: '93.184.216.34', family: 4 }]);
for (const k of ['error', 'warn', 'info']) console[k] = () => {};
const PAYER = '0x2222222222222222222222222222222222222222';
const settles = () => (kind) => answer(kind === 'verify' ? { isValid: true, payer: PAYER } : { success: true, transaction: `0x${randomBytes(32).toString('hex')}`, network: 'eip155:8453', payer: PAYER });

// ------------------------------------------------------------------ the node
const BASE = 'https://mare.test', SITE = { '/llms.txt': { body: readFileSync(join(ROOT, 'site/llms.txt'), 'utf8'), type: 'text/plain; charset=utf-8' } };
const core = await imp('core.mjs'), { createMem } = await imp('mem.mjs'), { memoryKv } = await imp('flow.mjs');
const { immune } = await imp('immune.mjs'), { createLedger } = await imp('ledger.mjs'), { payConfig } = await imp('pay.mjs');
const { SESSION, sessionHash, createSessions } = await imp('session.mjs');
const dir = mkdtempSync(join(tmpdir(), 'mare-session-')), file = join(dir, 'sea.tsv');
process.once('exit', () => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });
writeFileSync(file, ''); writeFileSync(join(dir, 'build.json'), JSON.stringify({ builtAt: '2026-11-20T10:00:00.000Z', entries: 0, lakes: {} }));
const db = createMem({ file, base: BASE }), kv = memoryKv(), ledger = createLedger({}), waits = [];
const PAY = { ...payConfig({}), facilitator: FAC, settleWaitMs: 300, verifyMs: 800, settleMs: 4000 };
const cfg = { base: BASE, kv, ledger, pay: PAY, site: SITE, waitUntil: (p) => { waits.push(p); }, creditSweepMs: 0 };
const call = async (path, { method = 'GET', accept = 'application/json', ip, headers = {}, body, raw } = {}) => {
  const h = { accept, 'user-agent': 'session-proof-agent/1.0', 'x-forwarded-for': ip, ...(body !== undefined || raw !== undefined ? { 'content-type': 'application/json' } : {}), ...headers };
  const res = await core.handle(new Request(BASE + path, { method, headers: h, ...(body !== undefined ? { body: JSON.stringify(body) } : raw !== undefined ? { body: raw } : {}) }), db, cfg);
  const text = res.body ? Buffer.from(await res.arrayBuffer()).toString('utf8') : ''; let j = null; try { j = JSON.parse(text); } catch {}
  return { status: res.status, h: Object.fromEntries(res.headers), text, j };
};
await call('/stats', { ip: '127.0.0.1' });
immune.set({ mode: 'normal', rest: [], pace: { perMinute: 1_000_000, burst: 1_000_000 } });
const WALLET = PAY.payTo, USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
let net = 0, site = 0; const fresh = () => `198.51.${100 + Math.floor(net / 250)}.${(net++ % 250) + 1}`, host = () => `s${++site}.${W}`;
const payment = ({ value = '10000', version = 2 } = {}) => {
  const authorization = { from: PAYER, to: WALLET, value: String(value), validAfter: '0', validBefore: String(Math.floor(T0 / 1000) + 300), nonce: `0x${randomBytes(32).toString('hex')}` };
  const inner = { signature: `0x${'ab'.repeat(65)}`, authorization };
  const p = version === 2 ? { x402Version: 2, accepted: { scheme: 'exact', network: 'eip155:8453', amount: String(value), asset: USDC, payTo: WALLET }, payload: inner } : { x402Version: 1, scheme: 'exact', network: 'base', payload: inner };
  return { [version === 2 ? 'payment-signature' : 'x-payment']: Buffer.from(JSON.stringify(p)).toString('base64') };
};
const funnel = async () => (await call('/funnel.json', { ip: '127.0.0.1' })).j;
const bearer = (key) => ({ authorization: `Bearer ${key}` });
const open = async (ip = fresh(), body) => { const r = await call('/session', { method: 'POST', ip, ...(body !== undefined ? { body } : {}) }); assert.equal(r.status, 201, r.text.slice(0, 200)); return r; };
const left = async (key) => (await call('/session', { ip: fresh(), headers: bearer(key) })).j.probe.left;
const today = () => new Date(T0).toISOString().slice(0, 10);
const URLQ = (u) => encodeURIComponent(u);

console.log('open');
let A = null;
await proof('POST /session without a body: 201, a key mls_ with 192 random bits shown once, the bookmark in Location, 20 probe calls for 7 days, 30 days for the key', async () => {
  const r = await open(); A = r.j;
  assert.match(A.key, /^mls_[A-Za-z0-9_-]{32}$/); assert.equal(Buffer.from(A.key.slice(4), 'base64url').length, 24);
  assert.match(A.id, /^[0-9a-f]{24}$/); assert.equal(A.id, sessionHash(A.key).slice(0, 24), 'the id is the head of the hash');
  assert.equal(r.h.location, `${BASE}/session/${A.id}`); assert.equal(A.bookmark, r.h.location);
  assert.equal(A.probe.calls, SESSION.probe); assert.equal(A.probe.left, 20); assert.equal(Date.parse(A.probe.until) - T0, 7 * 86_400_000); assert.equal(Date.parse(A.expires) - T0, 30 * 86_400_000);
  assert.deepEqual(A.probe.doors, ['deal', 'check', 'read', 'route', 'pack']); assert.equal(A.state, 'ok'); assert.equal(A.calls, 0); assert.deepEqual(A.last, []); assert.equal(A.callback, null);
  assert.match(A.once, /shown this one time/); assert.equal(A.use.doors.length, 6); assert.match(A.use.header, /^x-sea-session: <key>/); assert.match(A.use.get, /session\?as=key/);
  assert.equal(A.limits.calls_a_minute, 30); assert.equal(A.limits.sessions_a_network_a_day, 10); assert.equal(A.limits.probe_calls_of_the_sea_a_day, 2000);
  assert.equal(r.h['cache-control'], 'no-store'); assert.match(r.h['access-control-expose-headers'], /x-sea-session-left,x-sea-session,location$/); assert.match(r.h['access-control-allow-headers'], /authorization/);
  const plain = await call(`/x402/check?site=${host()}`, { ip: fresh() }); assert.equal(plain.status, 402); assert.ok(!/x-sea-session/.test(plain.h['access-control-expose-headers']), 'an answer without a key keeps its headers');
  const B = (await open()).j; assert.notEqual(B.key, A.key); assert.notEqual(B.id, A.id);
});
await proof('the key is never kept in clear: the state holds its SHA-256 only; the bookmark shows neither key nor hash nor marks', async () => {
  const keys = kv.keys('session:'); assert.ok(keys.length >= 3);
  for (const k of keys) { const v = JSON.stringify(await kv.get(k)); assert.ok(!v.includes(A.key) && !k.includes(A.key), `${k} holds the key`); assert.ok(!k.includes('198.51.'), `${k} names a network`); }
  const rec = await kv.get(`session:${A.id}`); assert.equal(rec.h, sessionHash(A.key));
  const b = await call(`/session/${A.id}`, { ip: fresh() }); assert.equal(b.status, 200); assert.equal(b.j.id, A.id); assert.equal(b.j.probe.left, 20);
  assert.ok(!b.text.includes(A.key) && !b.text.includes(sessionHash(A.key)), 'no key, no hash'); assert.ok(!/"tag"|"h"|"rate"/.test(b.text), 'no marks, no hash field, no pace');
});
await proof('GET /session says what it is with today\'s count; with the key the key\'s own state; HEAD takes nothing', async () => {
  const g = await call('/session', { ip: fresh() }); assert.equal(g.status, 200); assert.match(g.j.what, /20 probe calls/); assert.equal(g.j.open.call, `GET ${BASE}/session?as=key`); assert.match(g.j.open.or, /^POST /);
  assert.equal(g.j.today.day, today()); assert.ok(g.j.today.opened >= 2); assert.equal(g.j.today.probe_day, 2000); assert.ok(g.j.errors['429'] && g.j.errors['501']);
  const k = await call('/session', { ip: fresh(), headers: { 'x-sea-session': A.key } }); assert.equal(k.status, 200); assert.equal(k.j.id, A.id); assert.equal(k.j.bookmark, A.bookmark);
  const h = await call(`/x402/check?site=${host()}`, { method: 'HEAD', ip: fresh(), headers: bearer(A.key) }); assert.equal(h.status, 402); assert.equal(await left(A.key), 20);
});

console.log('use');
await proof('the key on /x402/check: the paid check (score, page) with "session" and x-sea-session-left 19; nothing paid, the facilitator never asked, no sale', async () => {
  facilitator = null; const f0 = await funnel(), t0 = await ledger.treasury();
  const r = await call(`/x402/check?site=${host()}`, { ip: fresh(), headers: bearer(A.key) });
  assert.equal(r.status, 200, r.text.slice(0, 300)); assert.equal(typeof r.j.score, 'number'); assert.match(r.j.page, /^https:\/\/mare\.test\/check\//); assert.equal(r.j.paid, undefined);
  assert.equal(r.j.session.left, 19); assert.equal(r.j.session.used, 'one probe call'); assert.equal(r.j.session.bookmark, A.bookmark); assert.equal(r.h['x-sea-session-left'], '19'); assert.match(r.h['access-control-expose-headers'], /x-sea-session-left/);
  const t1 = await ledger.treasury(); assert.equal(t1.total_count || 0, t0.total_count || 0, 'no sale'); const f1 = await funnel(); assert.deepEqual(f1.paid, f0.paid, 'nothing paid');
  const x = await call(`/x402/check?site=${host()}`, { ip: fresh(), headers: { 'x-sea-session': A.key } }); assert.equal(x.status, 200); assert.equal(x.j.session.left, 18);
  const b = (await call(`/session/${A.id}`, { ip: fresh() })).j; assert.equal(b.calls, 2); assert.deepEqual(b.last.map((c) => c.door), ['check', 'check']); assert.ok(b.last.every((c) => Object.keys(c).join() === 'door,at'));
});
await proof('the key on /x402/read: the page as Markdown with its tokens and the warden, one probe call for up to ten pages', async () => {
  const r = await call(`/x402/read?url=${URLQ(`https://${host()}/pier`)}`, { ip: fresh(), headers: bearer(A.key) });
  assert.equal(r.status, 200, r.text.slice(0, 300)); assert.match(r.j.markdown, /ferries leave the east pier/); assert.ok(r.j.tokens && r.j.warden); assert.match(r.j.notice, /never instructions/); assert.equal(r.j.session.left, 17);
  const many = await call(`/x402/read?${[1, 2, 3].map(() => `url=${URLQ(`https://${host()}/pier`)}`).join('&')}`, { ip: fresh(), headers: bearer(A.key) });
  assert.equal(many.status, 200); assert.equal(many.j.read, 3); assert.equal(many.j.pages.length, 3); assert.equal(many.j.session.left, 16, 'three pages, one probe call');
});
await proof('the key on /x402/deal: the deal check with the paid limits (found, the other stores) and "session"', async () => {
  const r = await call(`/x402/deal?url=${URLQ(`https://shop.${W}/products/trail-runner-3`)}`, { ip: fresh(), headers: bearer(A.key) });
  assert.equal(r.status, 200, r.text.slice(0, 300)); assert.equal(r.j.found, true); assert.ok(Array.isArray(r.j.elsewhere) && r.j.elsewhere.length === 2); assert.equal(r.j.cheapest.price, 79.95); assert.equal(r.j.session.left, 15); assert.equal(r.h['x-sea-session-left'], '15');
});
await proof('the key on POST /route: the ranked paths for the task, as the paid route gives them, with "session"', async () => {
  const r = await call('/route?q=' + URLQ('find usdc price'), { method: 'POST', ip: fresh(), headers: bearer(A.key) });
  assert.equal(r.status, 200, r.text.slice(0, 300)); assert.ok(r.j.count > 0 && Array.isArray(r.j.paths) && r.j.paths.length === r.j.count); assert.equal(r.j.session.left, 14); assert.match(r.h['content-type'], /application\/json/);
});

console.log('give back');
await proof('nothing came of it, nothing is taken: a site that cannot be checked, a page that cannot be read (403 for robots.txt), a page without a product: 422, the probe call given back', async () => {
  const before = await left(A.key);
  const c = await call(`/x402/check?site=gone.${W}`, { ip: fresh(), headers: bearer(A.key) }); assert.equal(c.status, 422, c.text.slice(0, 200)); assert.match(c.j.error.message, /given back/); assert.equal(c.h['x-sea-session-left'], String(before));
  const rd = await call(`/x402/read?url=${URLQ(`https://${host()}/nothing`)}`, { ip: fresh(), headers: bearer(A.key) }); assert.equal(rd.status, 422, rd.text.slice(0, 200)); assert.match(rd.j.error.message, /given back/);
  const cl = await call(`/x402/read?url=${URLQ(`https://closed.${W}/pier`)}`, { ip: fresh(), headers: bearer(A.key) }); assert.equal(cl.status, 403); assert.match(cl.j.error.message, /robots\.txt/);
  const d = await call(`/x402/deal?url=${URLQ(`https://shop.${W}/about`)}`, { ip: fresh(), headers: bearer(A.key) }); assert.equal(d.status, 422, d.text.slice(0, 200)); assert.match(d.j.error.message, /given back/);
  assert.equal(await left(A.key), before, 'the probe calls given back');
  const b = (await call(`/session/${A.id}`, { ip: fresh() })).j; assert.ok(b.last.filter((x) => x.given_back).length >= 4, 'the bookmark says which came back');
});
await proof('a call that cannot be made takes nothing: no site, eleven pages, no product page, no task: 400 before a probe call is taken', async () => {
  const before = await left(A.key);
  const a = await call('/x402/check', { ip: fresh(), headers: bearer(A.key) }); assert.equal(a.status, 400); assert.match(a.j.error.message, /Nothing was taken/);
  const b = await call(`/x402/read?${Array.from({ length: 11 }, (_, i) => `url=${URLQ(`https://${host()}/pier?${i}`)}`).join('&')}`, { ip: fresh(), headers: bearer(A.key) }); assert.equal(b.status, 400); assert.match(b.j.error.message, /at most 10 pages/);
  const c = await call('/x402/deal', { ip: fresh(), headers: bearer(A.key) }); assert.equal(c.status, 400);
  const d = await call('/route', { method: 'POST', ip: fresh(), headers: bearer(A.key) }); assert.equal(d.status, 400);
  assert.equal(await left(A.key), before);
});
await proof('parallel calls never take more than there is: 6 at once on a key with 3 left: 3 answers, 3 times the door\'s 402, none below zero', async () => {
  const k = (await open()).j; const id = k.id; const rec = await kv.get(`session:${id}`); rec.probe.left = 3; await kv.set(`session:${id}`, rec, 86_400 * 31);
  const rs = await Promise.all(Array.from({ length: 6 }, () => call(`/x402/check?site=${host()}`, { ip: fresh(), headers: bearer(k.key) })));
  assert.deepEqual(rs.map((r) => r.status).sort(), [200, 200, 200, 402, 402, 402]); assert.equal(await left(k.key), 0);
  assert.deepEqual(rs.filter((r) => r.status === 200).map((r) => r.j.session.left).sort(), [0, 1, 2]);
});

console.log('empty');
await proof('the last probe call says what then; the next call is the door\'s own 402 with its x402 terms and x-sea-session-left: 0, counted in the funnel', async () => {
  const k = (await open()).j; const rec = await kv.get(`session:${k.id}`); rec.probe.left = 1; await kv.set(`session:${k.id}`, rec, 86_400 * 31);
  const last = await call(`/x402/check?site=${host()}`, { ip: fresh(), headers: bearer(k.key) }); assert.equal(last.status, 200); assert.equal(last.j.session.left, 0); assert.match(last.j.session.then, /pay it over x402/);
  const f0 = (await funnel()).asked.check || 0;
  const r = await call(`/x402/check?site=${host()}`, { ip: fresh(), headers: bearer(k.key) });
  assert.equal(r.status, 402); assert.equal(r.h['x-sea-session-left'], '0'); const v2 = JSON.parse(Buffer.from(r.h['payment-required'], 'base64').toString('utf8'));
  assert.equal(v2.accepts[0].amount, '10000'); assert.equal(v2.accepts[0].payTo, WALLET); assert.equal((await funnel()).asked.check, f0 + 1);
  const rr = await call(`/x402/read?url=${URLQ(`https://${host()}/pier`)}`, { ip: fresh(), headers: bearer(k.key) }); assert.equal(rr.status, 402); assert.ok(rr.h['payment-required']);
  // (since 3.82) the route gives an empty key one taste first, then its 402
  const ro0 = await call('/route?q=find+usdc+price', { method: 'POST', ip: fresh(), headers: bearer(k.key) }); assert.equal(ro0.status, 200); assert.equal(ro0.j.taste, true);
  const ro = await call('/route?q=find+usdc+price', { method: 'POST', ip: fresh(), headers: bearer(k.key) }); assert.equal(ro.status, 402);
});
await proof('a payment sent with a key buys as always: the key is not looked at, no probe call taken, the sale in the books', async () => {
  facilitator = settles(); const before = await left(A.key), t0 = await ledger.treasury();
  const r = await call(`/x402/check?site=${host()}`, { ip: fresh(), headers: { ...bearer(A.key), ...payment() } });
  facilitator = null;
  assert.equal(r.status, 200, r.text.slice(0, 300)); assert.ok(r.j.paid); assert.equal(r.j.session, undefined); assert.equal(await left(A.key), before);
  const t1 = await ledger.treasury(); assert.equal(t1.total_count, (t0.total_count || 0) + 1);
});

console.log('limits');
await proof('30 calls a minute per key: the 31st is 429 with Retry-After and the batch door, nothing taken', async () => {
  const k = (await open()).j; const ip = fresh();
  for (let i = 0; i < 30; i++) { const r = await call(`/x402/check?site=gone.${W}`, { ip, headers: bearer(k.key) }); assert.equal(r.status, 422, `call ${i + 1}`); }
  const r = await call(`/x402/check?site=${host()}`, { ip, headers: bearer(k.key) });
  assert.equal(r.status, 429); assert.equal(r.j.error.code, 'RESOURCE_EXHAUSTED'); assert.ok(Number(r.h['retry-after']) >= 1 && Number(r.h['retry-after']) <= 60); assert.match(r.j.batch, /up to 10 url=/);
  assert.equal(await left(k.key), 20);
  T0 += 61_000; const again = await call(`/x402/check?site=${host()}`, { ip, headers: bearer(k.key) }); assert.equal(again.status, 200); assert.equal(again.j.session.left, 19);
});
await proof('the sea gives 2,000 probe calls a UTC day: then the doors answer 402 with a note, the key keeps its calls; a new key says so', async () => {
  const day = today(), k0 = `session:probe:${day}`, was = Number(await kv.get(k0)) || 0; await kv.set(k0, 2000, 2 * 86_400);
  const before = await left(A.key);
  const r = await call(`/x402/check?site=${host()}`, { ip: fresh(), headers: bearer(A.key) }); assert.equal(r.status, 402); assert.match(r.h['x-sea-session'], /given out/); assert.equal(r.h['x-sea-session-left'], String(before));
  assert.equal(await left(A.key), before); assert.equal(Number(await kv.get(k0)), 2000, 'the count stays at the cap');
  const n = await open(); assert.equal(n.j.probe.left, 20); assert.match(n.j.note, /given out/);
  await kv.set(k0, was, 2 * 86_400);
  const ok = await call(`/x402/check?site=${host()}`, { ip: fresh(), headers: bearer(A.key) }); assert.equal(ok.status, 200); assert.equal(Number(await kv.get(k0)), was + 1);
});
await proof('10 new keys a network a UTC day: the 11th is 429 with Retry-After until midnight UTC and what to do instead; the next day again', async () => {
  const ip = fresh(); for (let i = 0; i < 10; i++) await open(ip);
  const r = await call('/session', { method: 'POST', ip }); assert.equal(r.status, 429); assert.equal(r.j.error.code, 'RESOURCE_EXHAUSTED');
  const midnight = D.parse(`${today()}T00:00:00Z`) + 86_400_000; assert.equal(Number(r.h['retry-after']), Math.ceil((midnight - T0) / 1000)); assert.equal(r.j.alternatives.length, 2);
  assert.equal((await call('/session', { method: 'POST', ip: fresh() })).status, 201, 'another network opens');
  T0 = midnight + 60_000; assert.equal((await call('/session', { method: 'POST', ip })).status, 201, 'the next day');
});

console.log('errors');
await proof('a key of the wrong form and an unknown key: 401 with the call that opens one; nothing else happens', async () => {
  const bad = await call(`/x402/check?site=${host()}`, { ip: fresh(), headers: { authorization: 'Bearer mls_short' } }); assert.equal(bad.status, 401); assert.equal(bad.j.error.code, 'UNAUTHENTICATED'); assert.equal(bad.j.next.open, `POST ${BASE}/session`);
  const unknown = `mls_${randomBytes(24).toString('base64url')}`;
  const u = await call(`/x402/read?url=${URLQ(`https://${host()}/pier`)}`, { ip: fresh(), headers: bearer(unknown) }); assert.equal(u.status, 401); assert.match(u.j.error.message, /not known/);
  const g = await call('/session', { ip: fresh(), headers: bearer(unknown) }); assert.equal(g.status, 401);
  const other = await call(`/x402/check?site=${host()}`, { ip: fresh(), headers: { authorization: 'Bearer fc-not-a-session' } }); assert.equal(other.status, 402, 'another bearer is not a session');
});
await proof('the body: not a JSON object 400, an array 400, longer than 4096 characters 413; methods /session does not have: 501 with the calls that exist; an unknown bookmark 404', async () => {
  assert.equal((await call('/session', { method: 'POST', ip: fresh(), raw: '{nope' })).status, 400);
  assert.equal((await call('/session', { method: 'POST', ip: fresh(), raw: '[1,2]' })).status, 400);
  assert.equal((await call('/session', { method: 'POST', ip: fresh(), raw: JSON.stringify({ agent: 'x'.repeat(5000) }) })).status, 413);
  const put = await call('/session', { method: 'PUT', ip: fresh() }); assert.equal(put.status, 501); assert.equal(put.j.error.code, 'UNIMPLEMENTED'); assert.equal(put.j.alternatives[0].do, `GET ${BASE}/session?as=key`);
  const del = await call(`/session/${A.id}`, { method: 'DELETE', ip: fresh() }); assert.equal(del.status, 501);
  const nf = await call(`/session/${'0'.repeat(24)}`, { ip: fresh() }); assert.equal(nf.status, 404); assert.equal(nf.j.error.code, 'NOT_FOUND');
  assert.equal((await call('/session/not-an-id', { ip: fresh() })).status, 404);
});
await proof('callback_url: https on a public host by name is kept (its host on the bookmark) and not called by a probe call (since 3.83 once, at the first payment); http, an address, a local name, another port, a user, 301 characters: 422', async () => {
  const cb = `https://hooks.agent-${randomBytes(3).toString('hex')}.example.com/sea`;
  const r = await open(fresh(), { callback_url: cb, agent: 'Proof agent 1.0 <script>' });
  assert.equal(r.j.callback.host, new URL(cb).hostname); assert.match(r.j.callback.state, /called once, at the first payment/); assert.equal(r.j.agent, 'Proof agent 1.0 script');
  const rec = await kv.get(`session:${r.j.id}`); assert.equal(rec.cb.url, cb);
  for (const bad of ['http://hooks.example.com/x', 'https://203.0.113.9/x', 'https://[2001:db8::1]/x', 'https://agent.localhost/x', 'https://box.internal/x', 'https://hooks.example.com:8443/x', 'https://u:p@hooks.example.com/x', `https://hooks.example.com/${'a'.repeat(280)}`, 'not a url', 'https://single/x']) {
    const x = await call('/session', { method: 'POST', ip: fresh(), body: { callback_url: bad } }); assert.equal(x.status, 422, bad); assert.match(x.j.error.message, /callback_url/);
  }
  await call(`/x402/check?site=${host()}`, { ip: fresh(), headers: bearer(r.j.key) });
  assert.ok(!fetched.some((u) => u.includes(new URL(cb).hostname)), 'a probe call does not call the callback');
});
await proof('probe calls past their 7 days: the door\'s 402 (the key still known); a key past its 30 days: 410 with the alternatives; the bookmark says so', async () => {
  const k = (await open()).j;
  T0 += 7 * 86_400_000 + 60_000;
  const r = await call(`/x402/check?site=${host()}`, { ip: fresh(), headers: bearer(k.key) }); assert.equal(r.status, 402); assert.equal(r.h['x-sea-session-left'], '0');
  assert.equal((await call(`/session/${k.id}`, { ip: fresh() })).j.probe.left, 0);
  T0 += 23 * 86_400_000;
  const g = await call(`/x402/check?site=${host()}`, { ip: fresh(), headers: bearer(k.key) }); assert.equal(g.status, 410); assert.equal(g.j.error.code, 'GONE'); assert.equal(g.j.alternatives.length, 2);
  assert.equal((await call(`/session/${k.id}`, { ip: fresh() })).j.state, 'expired');
  T0 += 2 * 86_400_000; assert.equal((await call(`/session/${k.id}`, { ip: fresh() })).status, 404, 'gone a day after');
});
await proof('the module alone: back() gives a probe call back once, by its mark, also when ten newer calls pushed it out of the list', async () => {
  const m = memoryKv(), s = createSessions({ kv: m }); const o = await s.open({ net: '192.0.2.1' }); const h = sessionHash(o.key);
  const first = await s.take(h, 'read'); assert.equal(first.ok, true);
  for (let i = 0; i < 10; i++) assert.equal((await s.take(h, 'check')).ok, true);
  assert.equal((await s.back(h, first)).ok, true); assert.equal((await s.back(h, first)).ok, false, 'never twice');
  assert.equal((await s.back(h, { tag: 'nonsense' })).ok, false); assert.equal((await s.peek(h)).probe.left, 10);
  assert.equal((await s.today()).probe_calls, 10);
});

console.log('the supply in sight (3.81)');
const keysOf = (j) => Object.keys(j);
await proof('every answer to a call with a key says calls_left and calls_used, as its last two fields: the door, the route, the answer that gave the call back, the key\'s own state; the key answers say 20 and 0', async () => {
  const P = await open(); assert.equal(P.j.calls_left, 20); assert.equal(P.j.calls_used, 0); const k = P.j.key;
  const g = await call('/session?as=key', { ip: fresh(), accept: '*/*' }); assert.equal(g.status, 200); assert.match(g.text, /^\{\"key\":\"mls_[A-Za-z0-9_-]{32}\",\"calls_left\":20,\"seat_state\":\"none\",\"price_usd\":24,\"buy_line\":\"this key can buy: POST \/seat with header x-sea-session, no card needed\"\}\n$/, '(4.1) the key answer is JSON'); assert.equal(g.h['x-sea-calls-left'], '20'); assert.equal(g.h['x-sea-calls-used'], '0'); assert.match(g.h['access-control-expose-headers'], /x-sea-calls-left,x-sea-calls-used/);
  const c = await call(`/x402/check?site=${host()}`, { ip: fresh(), headers: bearer(k) }); assert.equal(c.status, 200, c.text.slice(0, 200));
  assert.equal(c.j.calls_left, 19); assert.equal(c.j.calls_used, 1); assert.deepEqual(keysOf(c.j).slice(-4), ['calls_left', 'calls_used', 'seat_state', 'price_per_path']); assert.equal(c.j.seat_state, 'none'); assert.equal(c.j.price_per_path, 0.02); assert.equal(c.j.way_out, undefined);
  const r = await call('/route?q=' + URLQ('find usdc price'), { method: 'POST', ip: fresh(), headers: { 'x-sea-session': k } }); assert.equal(r.status, 200);
  assert.equal(r.j.calls_left, 18); assert.equal(r.j.calls_used, 2); assert.deepEqual(keysOf(r.j).slice(-4), ['calls_left', 'calls_used', 'seat_state', 'price_per_path']); assert.ok(r.text.split('\n').length > 3, 'the lines of the answer kept');
  const back = await call(`/x402/check?site=gone.${W}`, { ip: fresh(), headers: bearer(k) }); assert.ok([422, 502].includes(back.status), back.text.slice(0, 200)); assert.equal(back.j.calls_left, 18); assert.equal(back.j.calls_used, 2);
  const st = await call('/session', { ip: fresh(), headers: bearer(k) }); assert.equal(st.j.probe.left, 18); assert.equal(st.j.calls_left, 18); assert.equal(st.j.calls_used, 2);
  const plain = await call(`/x402/check?site=${host()}`, { ip: fresh() }); assert.equal(plain.status, 402); assert.equal(plain.j.calls_left, undefined, 'no key, no supply');
  const hd = await call(`/x402/check?site=${host()}`, { method: 'HEAD', ip: fresh(), headers: bearer(k) }); assert.equal(hd.status, 402); assert.equal(hd.h['x-sea-calls-left'], '18');
});
await proof('at 3 and at 0 calls left the answer adds way_out: the rest filled up again costs 0.02 USDC, the curl for it, the same key; at 4, 2 and 1 it does not; the 402 after the last call says it too', async () => {
  const k = (await open()).j; const rec = await kv.get(`session:${k.id}`); rec.probe.left = 5; await kv.set(`session:${k.id}`, rec, 86_400 * 31);
  const seen = [];
  for (let i = 0; i < 5; i++) { const r = await call(`/x402/check?site=${host()}`, { ip: fresh(), headers: bearer(k.key) }); assert.equal(r.status, 200); seen.push([r.j.calls_left, !!r.j.way_out]); if (r.j.way_out) {
    assert.match(r.j.way_out.what, /^the rest filled up again costs 0\.02 USDC/); assert.equal(r.j.way_out.curl, `curl -si -X POST '${BASE}/route?a=topup' -H "x-sea-session: $KEY"`); assert.match(r.j.way_out.key, /stays the same: no new key, no new id/);
    assert.deepEqual(keysOf(r.j).slice(-5), ['calls_left', 'calls_used', 'seat_state', 'price_per_path', 'way_out']); assert.ok(r.j.way_out.checkout_url.startsWith(`${BASE}/pay/`), '(4.0) the seat\'s link first'); } }
  assert.deepEqual(seen, [[4, false], [3, true], [2, false], [1, false], [0, true]]);
  const e = await call(`/x402/check?site=${host()}`, { ip: fresh(), headers: bearer(k.key) }); assert.equal(e.status, 402); assert.equal(e.j.calls_left, 0); assert.equal(e.j.calls_used, 5); assert.ok(e.j.way_out && e.j.next_step && e.j.accepts);
});
// (4.0) the seat in sight: its state and the price of one more path in every keyed answer, the same link in way_out as the
// host got from POST /seat?as=host, past its paths the doors answer on and the overage is counted apart on /treasury
await proof('(4.0) a key with a seat: seat_state active and price_per_path 0.01 in every keyed answer; at 0 paths left way_out with the seat\'s link; past its paths the door answers 200 with seat_state overage, nothing refused; /treasury says overage_paths and overage_usd apart; GET /session with the key says all three', async () => {
  const k = (await open()).j, h = sessionHash(k.key);
  const host1 = await call('/seat?as=host', { method: 'POST', ip: fresh(), headers: { 'x-sea-session': k.key } }); assert.equal(host1.status, 201);
  const g = await db.sessions.grant(h, { seat: host1.j.seat_id, sale: 'pi_proof_seat_1', paths: 2 }); assert.equal(g.ok, true);
  const before = await call('/treasury', { ip: fresh() }); const ov0 = before.j.overage_paths;
  const seen = [];
  for (let i = 0; i < 3; i++) {
    const r = await call(`/x402/check?site=${host()}`, { ip: fresh(), headers: bearer(k.key) }); assert.equal(r.status, 200, r.text.slice(0, 200));
    seen.push([r.j.calls_left, r.j.seat_state, r.j.price_per_path, !!r.j.way_out]);
    if (r.j.way_out) assert.equal(r.j.way_out.checkout_url, host1.j.checkout_url, 'the same link the host got, unchanged');
  }
  assert.deepEqual(seen, [[1, 'active', 0.01, false], [0, 'active', 0.01, true], [0, 'overage', 0.01, true]]);
  const tr = await call('/treasury', { ip: fresh() }); assert.equal(tr.j.overage_paths, ov0 + 1); assert.equal(tr.j.overage_usd, Math.round((ov0 + 1)) / 100); assert.equal(tr.j.seats.overage_paths, ov0 + 1); assert.equal(tr.j.seats.price_per_path_over, 0.01);
  const st = await call('/session', { ip: fresh(), headers: bearer(k.key) }); assert.equal(st.status, 200); assert.equal(st.j.seat_state, 'overage'); assert.equal(st.j.price_per_path, 0.01); assert.equal(st.j.calls_left, 0); assert.equal(st.j.seat.overage_paths, 1);
  const k2 = (await open()).j; const tp = await call('/route?a=topup', { method: 'POST', ip: fresh(), headers: { 'x-sea-session': k2.key } }); assert.equal(tp.status, 402);
  assert.ok(tp.j.checkout_url.startsWith(`${BASE}/pay/`), 'the topup by wallet names the same link by card'); assert.ok(tp.j.accepts, 'the x402 terms stay');
  const st2 = await call('/session', { ip: fresh(), headers: bearer(k2.key) }); assert.equal(st2.j.seat_state, 'none'); assert.equal(st2.j.price_per_path, 0.02); assert.equal(st2.j.calls_left, 20);
});
await proof('POST /route?a=topup: no key 400, nothing charged; the key without a payment: 402 with the price of one route (resource ?a=topup), the words without a wallet first; with a payment the same key has 20 probe calls again, a sale of the till (topup-x402-v2); one sale fills up once', async () => {
  const k = (await open()).j; const rec = await kv.get(`session:${k.id}`); rec.probe.left = 0; rec.calls = 20; await kv.set(`session:${k.id}`, rec, 86_400 * 31);
  facilitator = null;
  const nokey = await call('/route?a=topup', { method: 'POST', ip: fresh() }); assert.equal(nokey.status, 400); assert.match(nokey.j.error.message, /session\?as=key/);
  const unknown = await call('/route?a=topup', { method: 'POST', ip: fresh(), headers: { 'x-sea-session': `mls_${'A'.repeat(32)}`, ...payment({ value: '20000' }) } }); assert.equal(unknown.status, 401);
  const ask = await call('/route?a=topup', { method: 'POST', ip: fresh(), headers: bearer(k.key) }); assert.equal(ask.status, 402);
  const v2 = JSON.parse(Buffer.from(ask.h['payment-required'], 'base64').toString('utf8')); assert.equal(v2.accepts[0].amount, '20000'); assert.equal(v2.accepts[0].payTo, WALLET); assert.equal(v2.resource?.url ?? v2.resource, `${BASE}/route?a=topup`);
  assert.match(ask.j.error.message ?? ask.j.error, new RegExp(`^this key buys on credit, no card, no wallet: POST ${BASE.replace(/\./g, '\\.')}/seat with header x-sea-session: <key>`)); assert.match(ask.j.next_step.note, /topup is paid/); assert.equal(ask.j.calls_left, 0); assert.ok(ask.j.way_out);
  facilitator = settles(); const t0 = await ledger.treasury();
  const paid = await call('/route?a=topup', { method: 'POST', ip: fresh(), headers: { ...bearer(k.key), ...payment({ value: '20000' }) } });
  facilitator = null;
  assert.equal(paid.status, 200, paid.text.slice(0, 300)); assert.equal(paid.j.topup, 'done'); assert.equal(paid.j.before.calls_left, 0); assert.equal(paid.j.calls_left, 20); assert.equal(paid.j.calls_used, 20); assert.match(paid.j.key, /the same key/);
  assert.ok(['settled', 'pending'].includes(paid.j.paid.status)); assert.equal(paid.j.paid.amount_usd, 0.02);
  const t1 = await ledger.treasury(); assert.equal(t1.total_count, (t0.total_count || 0) + 1); assert.equal(t1.last_5[0].method, 'topup-x402-v2'); assert.equal(t1.last_5[0].amount_usd, 0.02);
  const again = await call(`/x402/check?site=${host()}`, { ip: fresh(), headers: bearer(k.key) }); assert.equal(again.status, 200); assert.equal(again.j.calls_left, 19); assert.equal(again.j.calls_used, 21);
  const b = (await call(`/session/${k.id}`, { ip: fresh() })).j; assert.equal(b.topups.length, 1); assert.deepEqual(Object.keys(b.topups[0]), ['at', 'status']); assert.ok(!JSON.stringify(b).includes(k.key));
  const store = createSessions({ kv, secret: randomBytes(32) }), k2 = await store.open({ net: 'n1' }), h2 = sessionHash(k2.key);
  const f1 = await store.topup(h2, { sale: 's1', status: 'settled' }); assert.equal(f1.ok, true); assert.equal(f1.left, 20);
  await store.take(h2, 'check'); const f2 = await store.topup(h2, { sale: 's1', status: 'settled' }); assert.equal(f2.again, true); assert.equal(f2.left, 19, 'one sale fills up once');
  assert.ok((await store.today()).paid_keys >= 1);
});

console.log('the first payment without pressure (3.82)');
const TXH = () => `0x${randomBytes(32).toString('hex')}`;
const book = async (tx, value = '20000') => { const d = today(), days = (await kv.get('books:days')) || []; if (!days.includes(d)) await kv.set('books:days', [...days, d], 86_400 * 400); const l = (await kv.get(`books:d:${d}`)) || [];
  await kv.set(`books:d:${d}`, [...l, { k: `${tx}:0`, block: 100 + l.length, log: 0, tx, from: PAYER, to: WALLET.toLowerCase(), value, usd: (Number(value) / 1e6).toFixed(6), nonce: null, time: new Date(T0).toISOString(), seen: new Date(T0).toISOString() }], 86_400 * 400); };
const emptyKey = async () => { const k = (await open()).j; const rec = await kv.get(`session:${k.id}`); rec.probe.left = 0; rec.calls = 20; await kv.set(`session:${k.id}`, rec, 86_400 * 31); return k; };
await proof('a key whose probe calls are spent gets one taste at the route before the 402: 200 with the first 3 paths and paid_full (the full 10 paths cost 0.02 USDC, one call), written down as a free sample; then the 402; a topup starts a new round', async () => {
  const k = await emptyKey(), t0 = await ledger.treasury();
  const r = await call('/route?q=' + URLQ('find usdc price'), { method: 'POST', ip: fresh(), headers: bearer(k.key) });
  assert.equal(r.status, 200, r.text.slice(0, 300)); assert.equal(r.j.taste, true); assert.ok(r.j.paths.length > 0 && r.j.paths.length <= 3); assert.ok(r.j.of >= r.j.paths.length);
  assert.match(r.j.paid_full, /^the full 10 paths cost 0\.02 USDC, one call: POST https:\/\/mare\.test\/route\?q=find%20usdc%20price with an x402 payment/); assert.match(r.j.paid_full, /x-sea-receipt: <transaction hash>/);
  assert.equal(r.j.calls_left, 0); assert.equal(r.j.calls_used, 20); assert.ok(r.j.way_out); assert.equal(r.j.session.left, 0); assert.match(r.h['x-sea-grace'], /one taste/);
  const t1 = await ledger.treasury(); assert.equal(t1.today_free, (t0.today_free || 0) + 1, 'a free sample'); assert.equal(t1.total_count, t0.total_count, 'no sale');
  const again = await call('/route?q=' + URLQ('find usdc price'), { method: 'POST', ip: fresh(), headers: bearer(k.key) }); assert.equal(again.status, 402); assert.equal(again.j.calls_left, 0);
  const other = await emptyKey(); const c = await call(`/x402/check?site=${host()}`, { ip: fresh(), headers: bearer(other.key) }); assert.equal(c.status, 402, 'the taste is the route\'s');
  const store = createSessions({ kv, secret: randomBytes(32) }), k2 = await store.open({ net: 'n2' }), h2 = sessionHash(k2.key), rec = await kv.get(`session:${k2.id}`); rec.probe.left = 0; await kv.set(`session:${k2.id}`, rec, 86_400 * 31);
  assert.equal((await store.grace(h2)).ok, true); assert.equal((await store.grace(h2)).ok, false, 'once a round');
  await store.topup(h2, { sale: 's-round' }); const r2 = await kv.get(`session:${k2.id}`); r2.probe.left = 0; await kv.set(`session:${k2.id}`, r2, 86_400 * 31);
  assert.equal((await store.grace(h2)).ok, true, 'a topup starts a new round');
});
await proof('/settle checks the receipt against the books of the chain: there and enough, settled; not there, less, or no hash: delivered all the same, unverified; the same call again with x-sea-receipt answers, the same sale', async () => {
  const q = 'find usdc price', tx1 = TXH(), tx3 = TXH(); await book(tx1); await book(tx3, '10000');
  const a = await call('/settle', { method: 'POST', ip: fresh(), body: { q, tx: tx1 } }); assert.equal(a.status, 200, a.text.slice(0, 200)); assert.equal(a.j.paid.status, 'settled'); assert.match(a.j.paid.why, /books of the chain: checked and settled/); assert.ok(a.j.count > 0);
  const b = await call('/settle', { method: 'POST', ip: fresh(), body: { q, tx: TXH() } }); assert.equal(b.j.paid.status, 'unverified'); assert.match(b.j.paid.why, /not in this node's books of the chain yet/); assert.ok(b.j.count > 0, 'delivered all the same');
  const c = await call('/settle', { method: 'POST', ip: fresh(), body: { q, tx: tx3 } }); assert.equal(c.j.paid.status, 'unverified'); assert.match(c.j.paid.why, /0\.010000 USDC, less than the price/);
  const t0 = await ledger.treasury(), tx4 = TXH();
  const r = await call('/route?q=' + URLQ(q), { method: 'POST', ip: fresh(), headers: { 'x-sea-receipt': tx4 } }); assert.equal(r.status, 200, r.text.slice(0, 200)); assert.equal(r.j.paid.status, 'unverified'); assert.ok(r.j.count > 0);
  const r2 = await call('/route?q=' + URLQ(q), { method: 'POST', ip: fresh(), headers: { 'x-sea-receipt': tx4 } }); assert.equal(r2.status, 200); assert.equal(r2.j.paid.again, true); assert.equal(r2.j.paid.sale, r.j.paid.sale);
  const t1 = await ledger.treasury(); assert.equal(t1.total_count, t0.total_count + 1, 'one sale for one receipt');
  const tx5 = TXH(); await book(tx5); const s5 = await call('/route?q=' + URLQ(q), { method: 'POST', ip: fresh(), headers: { 'x-sea-receipt': tx5 } }); assert.equal(s5.j.paid.status, 'settled');
  const none = await call('/route', { method: 'POST', ip: fresh(), headers: { 'x-sea-receipt': TXH() } }); assert.equal(none.status, 400);
});
await proof('a topup paid by a transfer: POST /settle {"a":"topup","tx"} with the key; checked against the books (settled) or once a key a UTC day unverified; a receipt buys once; every sum it changed, before and after, in the answer and in GET /treasury?a=topup', async () => {
  const k = await emptyKey(), tx = TXH(); await book(tx);
  assert.equal((await call('/settle', { method: 'POST', ip: fresh(), body: { a: 'topup', tx } })).status, 400, 'no key');
  assert.equal((await call('/settle', { method: 'POST', ip: fresh(), headers: bearer(k.key), body: { a: 'topup' } })).status, 402, 'no receipt');
  const c0 = (await call('/contacts.json', { ip: '127.0.0.1' })).j.today; await Promise.allSettled(waits.splice(0));
  const r = await call('/settle', { method: 'POST', ip: fresh(), headers: bearer(k.key), body: { a: 'topup', tx } });
  await Promise.allSettled(waits.splice(0)); const c1 = (await call('/contacts.json', { ip: '127.0.0.1' })).j.today; assert.equal(c1.paid, c0.paid + 1, 'a topup by transfer is a payment in the contact book, not a probe call');
  assert.equal(r.status, 200, r.text.slice(0, 300)); assert.equal(r.j.topup, 'done'); assert.equal(r.j.calls_left, 20); assert.equal(r.j.paid.status, 'settled'); assert.equal(r.j.paid.treasury, `${BASE}/treasury?a=topup`);
  assert.deepEqual(r.j.sums.changed.calls_left, { before: 0, after: 20 }); assert.equal(r.j.sums.changed.today_paid.after, r.j.sums.changed.today_paid.before + 1); assert.ok(Math.abs(r.j.sums.changed.today_usd.after - r.j.sums.changed.today_usd.before - 0.02) < 1e-9);
  const use = await call(`/x402/check?site=${host()}`, { ip: fresh(), headers: bearer(k.key) }); assert.equal(use.status, 200); assert.equal(use.j.calls_left, 19, 'the same key answers again');
  const twice = await call('/settle', { method: 'POST', ip: fresh(), headers: bearer(k.key), body: { a: 'topup', tx } }); assert.equal(twice.status, 200); assert.match(twice.j.topup, /done before/); assert.equal(twice.j.calls_left, 19); assert.equal(twice.j.sums.changed.today_paid, undefined, 'nothing counted twice');
  const k2 = await emptyKey(); const other = await call('/settle', { method: 'POST', ip: fresh(), headers: bearer(k2.key), body: { a: 'topup', tx } }); assert.equal(other.status, 402); assert.match(other.j.error.message ?? other.j.error, /handed in before/);
  const u1 = await call('/settle', { method: 'POST', ip: fresh(), headers: bearer(k2.key), body: { a: 'topup', tx: TXH() } }); assert.equal(u1.status, 200); assert.equal(u1.j.paid.status, 'unverified'); assert.equal(u1.j.calls_left, 20); assert.equal(u1.j.sums.changed.today_usd_unconfirmed.after - u1.j.sums.changed.today_usd_unconfirmed.before > 0.0199, true);
  const u2 = await call('/settle', { method: 'POST', ip: fresh(), headers: bearer(k2.key), body: { a: 'topup', tx: TXH() } }); assert.equal(u2.status, 429); assert.match(u2.j.error.message, /one topup a key a UTC day/);
  const g = await call('/treasury?a=topup', { ip: fresh() }); assert.equal(g.status, 200); assert.ok(g.j.today.topups >= 2); assert.equal(g.j.log[0].session, k2.id); assert.ok(g.j.log[0].till && g.j.log[0].calls_left); assert.ok(g.j.till && typeof g.j.till.today_paid === 'number');
  assert.ok(!g.text.includes(k.key) && !g.text.includes(k2.key), 'never a key');
});

console.log('the line back (3.83)');
await proof('a callback is called once, at the first payment of its key: one POST with the id, calls_left and the next step, never the key; 2 s at most and never waited for; never again; the bookmark says how it went', async () => {
  const P = await open(fresh(), { callback_url: `https://cb.${W}/hook` }); const k = P.j; const rec = await kv.get(`session:${k.id}`); rec.probe.left = 0; await kv.set(`session:${k.id}`, rec, 86_400 * 31);
  assert.match(k.callback.state, /called once, at the first payment/); hooks.length = 0; waits.length = 0;
  facilitator = settles();
  const r = await call('/route?a=topup', { method: 'POST', ip: fresh(), headers: { ...bearer(k.key), ...payment({ value: '20000' }) } }); assert.equal(r.status, 200, r.text.slice(0, 200));
  await Promise.allSettled(waits.splice(0));
  assert.equal(hooks.length, 1, 'one POST'); assert.equal(hooks[0].method, 'POST'); assert.equal(hooks[0].url, `https://cb.${W}/hook`);
  const b = JSON.parse(hooks[0].body); assert.equal(b.event, 'first_payment'); assert.equal(b.session, k.id); assert.equal(b.calls_left, 20); assert.match(b.next, /same request again with the same key/); assert.ok(!hooks[0].body.includes(k.key) && !hooks[0].body.includes(sessionHash(k.key)), 'never the key');
  T0 += 86_400_000; // the next payment on another UTC day: the key's day counts again, the callback never again
  const r2 = await call('/route?a=topup', { method: 'POST', ip: fresh(), headers: { ...bearer(k.key), ...payment({ value: '20000' }) } }); assert.equal(r2.status, 200); await Promise.allSettled(waits.splice(0));
  facilitator = null; assert.equal(hooks.length, 1, 'never again');
  assert.match((await call(`/session/${k.id}`, { ip: fresh() })).j.callback.state, /^called once at .+: HTTP 200$/);
  // a slow host: the answer does not wait, the call gives up after 2 s
  const S = (await open(fresh(), { callback_url: `https://cb.${W}/hook-slow` })).j; facilitator = settles(); hooks.length = 0;
  const t0 = performance.now(), rs = await call('/route?a=topup', { method: 'POST', ip: fresh(), headers: { ...bearer(S.key), ...payment({ value: '20000' }) } }); const took = performance.now() - t0; facilitator = null;
  assert.equal(rs.status, 200); assert.ok(took < 1500, `the answer waited ${Math.round(took)} ms`); await Promise.allSettled(waits.splice(0));
  assert.equal(hooks.length, 1); assert.match((await call(`/session/${S.id}`, { ip: fresh() })).j.callback.state, /timeout \(2 s\)$/);
  // given with a topup: kept, called at that first payment; a bad one: 422 and nothing charged
  const T = (await open()).j; facilitator = settles(); hooks.length = 0; const tr0 = await ledger.treasury();
  const bad = await call('/route?a=topup', { method: 'POST', ip: fresh(), headers: { ...bearer(T.key), ...payment({ value: '20000' }) }, body: { callback_url: 'http://cb.session-proof.dev/hook' } }); assert.equal(bad.status, 422); assert.equal((await ledger.treasury()).total_count, tr0.total_count, 'nothing charged');
  const good = await call('/route?a=topup', { method: 'POST', ip: fresh(), headers: { ...bearer(T.key), ...payment({ value: '20000' }) }, body: { callback_url: `https://cb.${W}/hook` } }); facilitator = null; assert.equal(good.status, 200); await Promise.allSettled(waits.splice(0));
  assert.equal(hooks.length, 1); assert.equal(JSON.parse(hooks[0].body).session, T.id);
  assert.equal((await call(`/x402/check?site=${host()}`, { ip: fresh(), headers: bearer(T.key) })).status, 200);
  const st = await call('/session', { ip: fresh() }); assert.ok(st.j.today.paid_keys >= 3, 'three keys paid this day'); assert.ok(st.j.today.used_keys >= 1, 'a key took its first door this day');
});

console.log('books');
await proof('/openapi.json: POST and GET /session and GET /session/{id}, free (security: []), no price; the sold doors stay seven', async () => {
  const o = (await call('/openapi.json', { ip: '127.0.0.1' })).j;
  for (const [p, m] of [['/session', 'post'], ['/session', 'get'], ['/session/{id}', 'get']]) { const op = o.paths[p]?.[m]; assert.ok(op, `${m} ${p}`); assert.deepEqual(op.security, []); assert.equal(op['x-payment-info'], undefined); }
  assert.deepEqual(Object.keys(o.paths['/session'].post.requestBody.content['application/json'].schema.properties), ['callback_url', 'agent']);
  const paid = Object.entries(o.paths).flatMap(([p, ops]) => Object.entries(ops).filter(([, op]) => op['x-payment-info']).map(([m]) => `${m.toUpperCase()} ${p}`)); assert.equal(paid.length, 7);
});
await proof('llms.txt says how (one call, the doors, the header, the bookmark, the limits); the privacy notice says what is kept, in German and in English', async () => {
  const l = (await call('/llms.txt', { ip: '127.0.0.1', accept: 'text/plain' })).text;
  for (const w of ['One call, one key', 'GET https://mareliberum.dev/session?as=key', 'POST https://mareliberum.dev/session', 'x-sea-session: <key>', '20 probe calls for 7 days', '/session/<id>', '10 new keys a day per network']) assert.ok(l.includes(w), w);
  const de = (await call('/de/datenschutz', { ip: '127.0.0.1', accept: 'text/html' })).text, en = (await call('/privacy', { ip: '127.0.0.1', accept: 'text/html' })).text;
  assert.match(de, /<p>\(\d+\) Sitzungen: Für Sitzungen \(<code>GET \/session\?as=key<\/code> oder <code>POST \/session<\/code>, seit 3\.78\) bewahrt der Knoten je Schlüssel nur dessen Hashwert \(SHA-256\)/);
  assert.match(en, /<p>\(\d+\) Sessions: for sessions \(<code>GET \/session\?as=key<\/code> or <code>POST \/session<\/code>, since 3\.78\) the node keeps per key only its hash \(SHA-256\)/);
  assert.ok(de.includes('<tr><td>Sitzungen (POST /session)</td>') && en.includes('<tr><td>Sessions (POST /session)</td>'));
});

await Promise.allSettled(waits.splice(0));
console.log(`\n${passed} proofs held, ${failed} failed`);

// ------------------------------------------------------------------ negative controls: each rule broken in a copy, the proof must fail there
let caught = 0, missed = 0;
if (!process.argv.includes('--no-controls')) {
  console.log('\nnegative controls: each rule broken in a copy, the proof must fail there');
  const CONTROLS = [
    ['the key kept in clear', 'node/session.mjs', 'const rec = { v: 1, h, id,', 'const rec = { v: 1, key, h, id,'],
    ['the bookmark shows the hash', 'node/session.mjs', 'id: rec.id, opened: rec.at,', 'id: rec.id, h: rec.h, opened: rec.at,'],
    ['the probe call not given back when nothing came of it', 'node/core.mjs', 'const b = await store.back(sv.h, s), res = out?.res', 'const b = { ok: false }, res = out?.res'],
    ['a probe call taken before the call is checked (no site)', 'node/core.mjs', "if (!sv.bad && !site) return json(", 'if (false) return json('],
    ['two calls at once both take the last probe call (no serial)', 'node/session.mjs', 'const serial = (k, fn) => {', 'const serial = (k, fn) => fn(); const serial0 = (k, fn) => {'],
    ['no pace per key', 'node/session.mjs', 'if (rec.rate?.m === m && rec.rate.n >= SESSION.perMinute)', 'if (false)'],
    ['no limit of new keys per network', 'node/session.mjs', 'if (n > SESSION.perNetDay) {', 'if (false) {'],
    ['the network written down in clear', 'node/session.mjs', 'const nk = `session:net:${day}:${netOf(day, net)}`;', 'const nk = `session:net:${day}:${net}`;'],
    ['an empty key gets no x402 terms (403 instead of the door\'s 402)', 'node/core.mjs', "const res = required(); res.headers.set('x-sea-session-left', String(s.left ?? 0));", "const res = json({ error: 'empty' }, 403); res.headers.set('x-sea-session-left', String(s.left ?? 0));"],
    ['a key past its 30 days still works', 'node/session.mjs', "if (Date.parse(rec.until) <= t) return { ok: false, why: 'expired', until: rec.until, left: 0, used: rec.calls };", ''],
    ['the callback called at every payment (3.83)', 'node/session.mjs', 'if (first && rec.cb?.url && !rec.cb.called) {', 'if (rec.cb?.url) {'],
    ['the answer waits for the callback (3.83)', 'node/core.mjs', 'if (pr.call) callBackOnce(db, cfg, base, sv, pr.call);', 'if (pr.call) await callBackOnce(db, cfg, base, sv, pr.call);'],
    ['a topup by transfer noted as a probe call (3.82)', 'node/core.mjs', "const paidCall = (pay && !pay.bad) || (path === '/settle' && method === 'POST')", "const paidCall = (pay && !pay.bad)"],
    ['no taste for an empty key (3.82)', 'node/core.mjs', "if (taste && s.why === 'empty' && !s.budget) {", 'if (false) {'],
    ['the taste twice a round (3.82)', 'node/session.mjs', 'if (rec.grace === round) return { ok: false, given: true };', ''],
    ['a receipt believed settled without the books (3.82)', 'node/core.mjs', "if (!e) return { ok: false, why: 'the transfer is not in this node", "if (!e) return { ok: true, why: 'the transfer is not in this node"],
    ['one receipt buys for two keys (3.82)', 'node/core.mjs', 'if (sale.again && sale.q !== `topup of session ${d.id}`)', 'if (false)'],
    ['no cap on topups by unchecked receipts (3.82)', 'node/core.mjs', "had.some((x) => String(x.at).slice(0, 10) === day && x.status === 'unverified')", 'false'],
    ['no supply on the answers (3.81)', 'node/core.mjs', 'const out = spliceFields(text, supplyFields(s, base, price));', 'const out = null;'],
    ['no way_out at 3 calls left (3.81)', 'node/core.mjs', '...(s.left === 3 || s.left === 0 ? { way_out:', '...(s.left === 0 ? { way_out:'],
    ['one sale fills a key up twice (3.81)', 'node/session.mjs', "if (mark && (rec.topups || []).some((x) => x.sale === mark)) return", 'if (false) return'],
    ['a topup at another price than one route (3.81)', 'node/core.mjs', "const t = termsFor(payCfg, { base, path: '/route' }), resource = `${base}/route?a=topup`", "const t = termsFor({ ...payCfg, cents: 1 }, { base, path: '/route' }), resource = `${base}/route?a=topup`"],
    ['a local callback kept', 'node/session.mjs', '|| LOCAL.test(host) ||', '||'],
    ['the sea\'s probe calls of the day without a cap', 'node/session.mjs', 'if (g > SESSION.probeDay) {', 'if (false) {'],
  ];
  for (const [name, f, from, to] of CONTROLS) {
    const d2 = mkdtempSync(join(tmpdir(), 'mare-session-ctl-'));
    try {
      cpSync(ROOT, d2, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      const fp = join(d2, f), txt = readFileSync(fp, 'utf8');
      if (!txt.includes(from)) { missed++; console.log(`  FAIL control "${name}": the line to break is gone from ${f}; the control needs updating`); continue; }
      writeFileSync(fp, txt.replace(from, to));
      const r = spawnSync(process.execPath, [join(d2, 'tools/session-proof.mjs'), '--no-controls'], { encoding: 'utf8', timeout: 240_000 });
      const out = `${r.stdout}${r.stderr}`, broke = (out.match(/\n  FAIL /g) || []).length;
      if (r.status !== 0 && broke > 0) { caught++; console.log(`  ok   caught: ${name} (${broke} proof${broke === 1 ? '' : 's'} failed)`); }
      else { missed++; console.log(`  FAIL control "${name}" was not caught (exit ${r.status})`); }
    } finally { try { rmSync(d2, { recursive: true, force: true }); } catch {} }
  }
  console.log(`${caught} of ${CONTROLS.length} controls caught`);
}
process.exit(failed || missed ? 1 : 0);
