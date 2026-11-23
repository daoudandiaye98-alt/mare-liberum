// Mare Liberum · proof of via: the addresses the sea hands out lead through the sea, and the proxy behind them is a
// needle's eye, not a hole. The token (only the node can make one, a changed one is refused), which addresses are
// wrapped and which stay as they are, that an answer the sea keeps is never changed, and the proxy itself: its limits
// (ports, 15 s, 2 MB, 600 an hour, 32 at once), redirects that come back as via addresses, what it carries and what not
// (no cookies or credentials either way, a sandbox for what it hands back), crawlers sent to the place, robots.txt for
// pages, 502 with a hint when a place fails, and what each walk leaves in the record.
// Runs without the network (only this machine): node tools/via-proof.mjs   (exit code 1 when a proof fails)
import assert from 'node:assert/strict';
import { setViaKey, encodeVia, decodeVia, wraps, viaUrl, rewriteForAgents, viaProxy, callerHash, callerHashes, PROXY, VIA_EXCLUDE } from '../node/via.mjs';
import { handle } from '../node/core.mjs';
import { createMem } from '../node/mem.mjs';
import { createLedger } from '../node/ledger.mjs';

let passed = 0, failed = 0;
const proof = async (name, fn) => { try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 4).join('\n       ')}`); } };
globalThis.fetch = async (u) => { throw new Error(`the proof does not use the network: ${String(u).slice(0, 80)}`); };
setViaKey('proof-key-0123456789abcdef');
const BASE = 'https://sea.test';
let ipN = 1; const ip = () => `198.51.100.${ipN++ % 250}`;
const req = (token, { method = 'GET', headers = {}, body, query = '' } = {}) => new Request(`${BASE}/via/${token}${query}`, { method, headers, body });
// a place that answers as told; every call is written down
const place = (answers) => { const seen = []; const get = async (u, o = {}) => { seen.push({ u: String(u), o }); const a = typeof answers === 'function' ? await answers(String(u), o) : answers; if (a instanceof Error) throw a; return a; }; get.seen = seen; return get; };
const ok = (body = '{"ok":true}', headers = { 'content-type': 'application/json' }, status = 200) => new Response(body, { status, headers });
const run = (token, o = {}) => { const hits = [], walks = []; return viaProxy({ req: req(token, o), token, base: BASE, ip: o.ip || ip(), ua: o.ua || 'proof-agent/1.0', readOnly: o.readOnly || false, onHit: (h) => hits.push(h), onWalk: (u, q) => walks.push({ u, q }), get: o.get || place(ok()), now: o.now }).then((res) => ({ res, hits, walks })); };

console.log('the token');
await proof('a token is the address, a dot and 6 bytes of HMAC, URL-safe base64 without padding; it reads back', () => {
  const u = 'https://api.openalex.org/works?search=creatine&per-page=10', t = encodeVia(u);
  assert.match(t, /^[A-Za-z0-9_-]+$/); assert.ok(!t.includes('='));
  const raw = Buffer.from(t, 'base64url'); assert.equal(raw.subarray(0, raw.length - 7).toString(), u); assert.equal(raw[raw.length - 7], 0x2e);
  assert.deepEqual(decodeVia(t), { ok: true, url: u });
});
await proof('a token changed on the way, or made with another key, is refused; something that is no token is told apart', () => {
  const t = encodeVia('https://example.com/a');
  const bad = t.slice(0, 10) + (t[10] === 'A' ? 'B' : 'A') + t.slice(11);
  const d = decodeVia(bad); assert.ok(d === null || d.ok === false);
  setViaKey('another-key-of-another-node-000'); assert.equal(decodeVia(t).ok, false); setViaKey('proof-key-0123456789abcdef');
  for (const x of ['howto', 'mare:abcdefghjkmn', '', 'a'.repeat(5), '../../etc/passwd']) assert.equal(decodeVia(x), null, x);
});

console.log('which addresses go through the sea');
await proof('plain public addresses are wrapped; the sea\'s own, templates, odd ports, names with passwords and long ones stay', () => {
  for (const u of ['https://en.wikipedia.org/w/rest.php/v1/search/page?q=usdc', 'http://example.com/', 'https://example.com:443/x']) assert.ok(wraps(u, BASE), u);
  for (const u of ['https://mareliberum.dev/brain?q=x', 'https://www.mareliberum.dev/lay', 'https://hz.mareliberum.dev/x', 'https://sea.test/rate/abc?worked=1', 'https://x.com/search?q={q}', 'https://x.com/<task>',
    'https://example.com:8080/', 'https://user:pw@example.com/', 'ftp://example.com/', 'not a url', 'https://example.com/' + 'a'.repeat(2100)]) assert.ok(!wraps(u, BASE), u);
});
await proof('rewriteForAgents wraps the address keys anywhere in an answer, adds the task, and leaves the kept answer as it was', () => {
  const kept = { task: 'find usdc price', doors: [{ name: 'W', to: 'https://en.wikipedia.org/x?q=usdc', template: 'https://en.wikipedia.org/x?q={q}', go: 'https://sea.test/d/w?q=usdc', worked_it: 'https://sea.test/d/w/worked' }],
    places: [{ to: 'https://api.example.com/price', pay: { payTo: '0x0CAc7D3c89be4f478E4c8f713C0D3D2D0954678D' } }], sites: [{ example: 'https://shop.example/?s=usdc', map: 'https://sea.test/site/shop.example' }], note: 'see https://elsewhere.example/ in words' };
  const before = JSON.stringify(kept), out = rewriteForAgents(kept, { base: BASE, q: 'find usdc price' });
  assert.equal(JSON.stringify(kept), before, 'the kept answer is untouched');
  assert.match(out.doors[0].to, /^https:\/\/sea\.test\/via\/[A-Za-z0-9_-]+\?q=find\+usdc\+price$/);
  assert.equal(decodeVia(out.doors[0].to.split('/via/')[1].split('?')[0]).url, 'https://en.wikipedia.org/x?q=usdc');
  assert.equal(out.doors[0].template, kept.doors[0].template); assert.equal(out.doors[0].go, kept.doors[0].go); assert.equal(out.doors[0].worked_it, kept.doors[0].worked_it);
  assert.match(out.places[0].to, /\/via\//); assert.equal(out.places[0].pay.payTo, kept.places[0].pay.payTo);
  assert.match(out.sites[0].example, /\/via\//); assert.equal(out.sites[0].map, kept.sites[0].map);
  assert.equal(out.note, kept.note, 'free text is not rewritten');
  assert.match(out.via, /^3 addresses in this answer lead through the sea/);
  assert.equal(rewriteForAgents({ a: 1 }, { base: BASE }).via, undefined, 'nothing to wrap, nothing added');
});
await proof('an address with letters beyond ASCII is carried the way the web writes it, so every header stays plain', async () => {
  const out = rewriteForAgents({ to: 'https://de.wikipedia.org/wiki/Müller_(Familienname)' }, { base: BASE });
  const t = out.to.split('/via/')[1]; assert.equal(decodeVia(t).url, 'https://de.wikipedia.org/wiki/M%C3%BCller_(Familienname)');
  const { res } = await run(t); assert.equal(res.status, 200); assert.equal(res.headers.get('x-via-target'), 'https://de.wikipedia.org/wiki/M%C3%BCller_(Familienname)');
  const raw = encodeVia('https://例え.jp/パス'), r2 = await run(raw); assert.equal(r2.res.status, 200); assert.match(r2.res.headers.get('x-via-target'), /^https:\/\/xn--/);
});
await proof('an address out of a private memory carries p=1 and no task', () => {
  const out = rewriteForAgents({ notes: [{ url: 'https://example.com/private-tool' }] }, { base: BASE, priv: true });
  assert.match(out.notes[0].url, /\/via\/[A-Za-z0-9_-]+\?p=1$/);
});

console.log('the proxy: what it carries');
await proof('it carries the request to the place and hands back the answer with X-Via, X-Via-Target, a sandbox, noindex and a 5-minute cache', async () => {
  const get = place(ok('{"pages":[1]}')), t = encodeVia('https://api.example.com/search?q=usdc');
  const { res, hits, walks } = await run(t, { get, query: '?q=find+usdc+price' });
  assert.equal(res.status, 200); assert.equal(await res.text(), '{"pages":[1]}');
  assert.equal(res.headers.get('x-via'), 'mare-liberum'); assert.equal(res.headers.get('x-via-target'), 'https://api.example.com/search?q=usdc');
  assert.equal(res.headers.get('content-security-policy'), 'sandbox'); assert.equal(res.headers.get('cache-control'), 'public, max-age=300'); assert.match(res.headers.get('x-robots-tag'), /noindex/);
  assert.equal(get.seen[0].u, 'https://api.example.com/search?q=usdc'); assert.equal(get.seen[0].o.redirect, 'manual');
  assert.deepEqual(hits.map((h) => [h.target_domain, h.token_host, h.q, h.status]), [['example.com', 'api.example.com', 'find usdc price', 200]]);
  assert.equal(walks.length, 1); assert.equal(walks[0].q, 'find usdc price');
});
await proof('cookies and credentials are not carried, either way; the x402 headers are', async () => {
  const get = place(ok('{}', { 'content-type': 'application/json', 'set-cookie': 'a=1', 'clear-site-data': '"storage"', 'strict-transport-security': 'max-age=1', 'payment-required': 'eyJ4IjoxfQ==' }, 402));
  const { res } = await run(encodeVia('https://paid.example/api'), { get, method: 'POST', body: '{"x":1}', headers: { cookie: 's=1', authorization: 'Bearer secret', 'x-api-key': 'k', 'content-type': 'application/json', 'payment-signature': 'c2ln' } });
  const sent = get.seen[0].o.headers;
  assert.equal(sent.cookie, undefined); assert.equal(sent.authorization, undefined); assert.equal(sent['x-api-key'], undefined);
  assert.equal(sent['payment-signature'], 'c2ln'); assert.equal(sent['content-type'], 'application/json'); assert.match(sent['user-agent'], /^MareLiberum-Via\//);
  assert.equal(Buffer.from(get.seen[0].o.body).toString(), '{"x":1}');
  assert.equal(res.status, 402); assert.equal(res.headers.get('payment-required'), 'eyJ4IjoxfQ==');
  for (const h of ['set-cookie', 'clear-site-data', 'strict-transport-security']) assert.equal(res.headers.get(h), null, h);
  assert.equal(res.headers.get('cache-control'), 'no-store');
});
await proof('a redirect is not followed: it comes back as a new via address with the same task', async () => {
  const get = place(new Response(null, { status: 301, headers: { location: '/new?x=1' } }));
  const { res } = await run(encodeVia('http://example.com/old'), { get, query: '?q=find' });
  assert.equal(res.status, 301); assert.equal(get.seen.length, 1);
  const loc = res.headers.get('location'); assert.match(loc, /^https:\/\/sea\.test\/via\/[A-Za-z0-9_-]+\?q=find$/);
  assert.equal(decodeVia(loc.split('/via/')[1].split('?')[0]).url, 'http://example.com/new?x=1');
  const odd = await run(encodeVia('http://example.com/old'), { get: place(new Response(null, { status: 302, headers: { location: 'http://example.com:8080/x' } })) });
  assert.equal(odd.res.status, 502); assert.equal((await odd.res.json()).error.code, 'VIA_REDIRECT');
});

console.log('the proxy: its limits');
await proof('only ports 80 and 443, and a token the node signed', async () => {
  assert.equal((await run(encodeVia('https://example.com:8443/'))).res.status, 400);
  const t = encodeVia('https://example.com/'); setViaKey('another-key-of-another-node-000');
  const r = await run(t); setViaKey('proof-key-0123456789abcdef');
  assert.equal(r.res.status, 403); assert.equal((await r.res.json()).error.code, 'BAD_TOKEN');
  assert.equal(await viaProxy({ req: req('howto'), token: 'howto', base: BASE, ip: ip() }), null, 'no token: the caller answers as before');
});
await proof('a place that does not answer, answers 5xx or is no public address gets 502 JSON with a hint back to the brain', async () => {
  for (const [get, want] of [[place(Object.assign(new Error('timeout'), { name: 'TimeoutError' })), /did not answer within 15 seconds/], [place(Object.assign(new Error('x'), { cause: { code: 'EGRESS_REFUSED' } })), /not a public address/], [place(ok('oops', { 'content-type': 'text/plain' }, 503)), /answered 503/]]) {
    const { res, hits } = await run(encodeVia('https://down.example/'), { get, query: '?q=usdc+price' });
    const j = await res.json();
    assert.equal(res.status, 502); assert.match(j.error.message, want); assert.match(j.hint, /\/brain\?q=usdc%20price/); assert.equal(hits[0].status, 502);
  }
});
await proof('more than 2 MB is refused, by its length or while it streams', async () => {
  const big = await run(encodeVia('https://big.example/'), { get: place(ok('x', { 'content-type': 'text/plain', 'content-length': String(PROXY.maxBytes + 1) })) });
  assert.equal(big.res.status, 502); assert.equal((await big.res.json()).error.code, 'TOO_LARGE');
  const stream = new ReadableStream({ start(c) { for (let i = 0; i < 3; i++) c.enqueue(new Uint8Array(1024 * 1024)); c.close(); } });
  const s = await run(encodeVia('https://big.example/s'), { get: place(new Response(stream, { headers: { 'content-type': 'application/octet-stream' } })) });
  assert.equal(s.res.status, 502); assert.equal((await s.res.json()).error.code, 'TOO_LARGE');
});
await proof('600 walks an hour per address, then 429 with Retry-After and the note that the brain is free; the next hour opens again', async () => {
  const me = '203.0.113.77', t = encodeVia('https://example.com/'), at = Date.UTC(2026, 10, 23, 18, 30);
  for (let i = 0; i < PROXY.perHour; i++) assert.equal((await run(t, { ip: me, now: () => at })).res.status, 200);
  const r = await run(t, { ip: me, now: () => at }), j = await r.res.json();
  assert.equal(r.res.status, 429); assert.equal(r.res.headers.get('retry-after'), '1800'); assert.match(j.free, /brain is free/);
  assert.equal((await run(t, { ip: me, now: () => at + 1800e3 + 1 })).res.status, 200);
  assert.equal((await run(t, { ip: '203.0.113.78', now: () => at })).res.status, 200, 'another address walks on');
});
await proof('at most 32 requests at once; the 33rd hears 503 with Retry-After', async () => {
  let release; const gate = new Promise((r) => { release = r; });
  const slow = place(async () => { await gate; return ok(); });
  const running = Array.from({ length: PROXY.inFlight }, () => run(encodeVia('https://slow.example/'), { get: slow }));
  await new Promise((r) => setTimeout(r, 20));
  const extra = await run(encodeVia('https://slow.example/'), { get: slow });
  assert.equal(extra.res.status, 503); assert.equal(extra.res.headers.get('retry-after'), '2');
  release(); for (const p of await Promise.all(running)) assert.equal(p.res.status, 200);
});
await proof('a crawler or a search engine is sent to the place itself and never fetched through the sea', async () => {
  const get = place(ok()), { res, hits } = await run(encodeVia('https://example.com/page'), { readOnly: true, get });
  assert.equal(res.status, 302); assert.equal(res.headers.get('location'), 'https://example.com/page'); assert.equal(get.seen.length, 0); assert.equal(hits.length, 0);
});
await proof('a web page whose robots.txt asks programs to stay away is not carried; a data API is', async () => {
  const get = place((u) => (u.endsWith('/robots.txt') ? ok('User-agent: *\nDisallow: /private', { 'content-type': 'text/plain' }) : ok('<html><body>hi</body></html>', { 'content-type': 'text/html; charset=utf-8' })));
  const r = await run(encodeVia('https://robots-1.example/private/page'), { get });
  assert.equal(r.res.status, 403); assert.equal((await r.res.json()).error.code, 'ROBOTS'); assert.equal(r.hits[0].outcome, 'robots');
  assert.equal((await run(encodeVia('https://robots-1.example/public'), { get })).res.status, 200);
  const api = place((u) => (u.endsWith('/robots.txt') ? ok('User-agent: *\nDisallow: /', { 'content-type': 'text/plain' }) : ok('{"a":1}')));
  assert.equal((await run(encodeVia('https://robots-2.example/api/x'), { get: api })).res.status, 200);
});
await proof('a walk out of a private memory is counted without site and task, and strengthens nothing', async () => {
  const { hits, walks } = await run(encodeVia('https://example.com/x'), { query: '?p=1&q=secret+task' });
  assert.deepEqual(hits[0], { kind: 'walk', q: null, ua_hash: hits[0].ua_hash, token_host: null, target_domain: null, status: 200, outcome: null }); assert.equal(walks.length, 0);
});
await proof('the caller is a salted hash of program and network: the same caller the same day, another day another; no address in it', () => {
  const a = callerHash('203.0.113.5', 'agent/1', '2026-11-23'), b = callerHash('203.0.113.5', 'agent/1', '2026-11-23');
  assert.equal(a, b); assert.match(a, /^[0-9a-f]{16}$/); assert.notEqual(a, callerHash('203.0.113.5', 'agent/1', '2026-11-24')); assert.notEqual(a, callerHash('203.0.113.6', 'agent/1', '2026-11-23'));
  assert.equal(callerHash('2001:db8:1:2:3:4:5:6', 'x', 'd'), callerHash('2001:db8:1:2:ffff:4:5:6', 'x', 'd'), 'an IPv6 network counts as one caller');
  assert.equal(callerHashes('203.0.113.5', 'agent/1').length, 2);
});

console.log('every road through the sea (3.28.0)');
await proof('with anyKey every whole web address of an answer goes through the sea, under any key and inside lists; payment pages, the sea\'s own code, its own routes and templates stay', () => {
  const site = { site: 'github.com', home: 'https://github.com/', llmsTxt: 'https://github.com/llms.txt', sitemaps: ['https://github.com/sitemap_marketing.xml', 'https://github.com/sitemap2.xml'],
    search: { template: 'https://github.com/search?q={q}&ref=opensearch', example: 'https://github.com/search?q=example' }, feeds: [{ title: 'Blog', href: 'https://github.blog/feed/' }],
    report: { pay: 'https://buy.stripe.com/fZu3co4PC2kIcJx3f7es00o?client_reference_id=report-github_com', details: 'https://sea.test/offers#report' },
    use: { read: 'https://sea.test/r/https://github.com/', worked: 'https://sea.test/d/github/worked' }, code: 'https://github.com/daoudandiaye98-alt/mare-liberum/tree/main/examples', words: 'see https://github.com/ for more', n: 3 };
  const out = rewriteForAgents(site, { base: BASE, anyKey: true });
  for (const v of [out.home, out.llmsTxt, out.sitemaps[0], out.sitemaps[1], out.search.example, out.feeds[0].href]) assert.match(v, /^https:\/\/sea\.test\/via\//, v);
  assert.equal(out.search.template, site.search.template, 'a template stays'); assert.equal(out.report.pay, site.report.pay, 'a payment page stays');
  assert.equal(out.report.details, site.report.details); assert.equal(out.use.read, site.use.read); assert.equal(out.use.worked, site.use.worked, 'the sea\'s own routes stay');
  assert.equal(out.code, site.code, 'the sea\'s own code stays'); assert.equal(out.words, site.words, 'text that only mentions an address stays'); assert.equal(out.n, 3);
  assert.match(out.via, /^6 addresses in this answer lead through the sea/); assert.equal(site.sitemaps[0], 'https://github.com/sitemap_marketing.xml', 'what the sea keeps is never changed');
  assert.ok(VIA_EXCLUDE.length >= 2); assert.equal(wraps('https://checkout.stripe.com/c/pay/cs_x', BASE), false); assert.equal(wraps('https://raw.githubusercontent.com/daoudandiaye98-alt/mare-liberum/main/site/skill.md', BASE), false);
  assert.equal(rewriteForAgents({ list: ['https://a.example/'] }, { base: BASE }).list[0], 'https://a.example/', 'without anyKey lists of plain strings stay as before');
});
await proof('an address handed out by a door that counted the click is carried but not counted twice within two minutes; later it counts again', async () => {
  const t = encodeVia('https://api.example.com/x'), now = Date.now();
  const c = new URL(viaUrl('https://api.example.com/x', { base: BASE, q: 'x', counted: now })).searchParams.get('c'); assert.equal(c, String(Math.floor(now / 60000)));
  const fresh = await run(t, { query: `?q=x&c=${c}`, now: () => now + 30_000 }); assert.equal(fresh.res.status, 200); assert.equal(fresh.hits.length, 0, 'counted at the door already'); assert.equal(fresh.walks.length, 1, 'the path still grows');
  const later = await run(t, { query: `?q=x&c=${c}`, now: () => now + 10 * 60_000 }); assert.equal(later.hits.length, 1); assert.equal(later.hits[0].kind, 'walk');
  const plain = await run(t, { query: '?q=x' }); assert.equal(plain.hits[0].kind, 'walk');
});
const mdb = createMem({ file: 'data/none.tsv', base: BASE });
const at = async (path, { ua = 'proof-agent/1.0', accept = 'application/json', ledger = createLedger({}) } = {}) => { const r = await handle(new Request(BASE + path, { headers: { accept, 'user-agent': ua, 'x-forwarded-for': ip() } }), mdb, { base: BASE, ledger, waitUntil: () => {} }); return { r, ledger }; };
await proof('a door (/d/<id>) leads through the sea: Location is a /via/ address with the task, and the click is counted as a door; a crawler is sent to the place itself and not counted', async () => {
  const { r, ledger } = await at('/d/wikipedia?q=creatine');
  assert.equal(r.status, 302); const loc = r.headers.get('location'); assert.match(loc, /^https:\/\/sea\.test\/via\/[A-Za-z0-9_-]+\?q=creatine&c=\d+$/);
  assert.match(decodeVia(loc.split('/via/')[1].split('?')[0]).url, /^https:\/\/[a-z.]*wikipedia\.org\//);
  assert.equal(ledger.mem.hits.length, 1); assert.deepEqual([ledger.mem.hits[0].kind, ledger.mem.hits[0].status, ledger.mem.hits[0].target_domain, ledger.mem.hits[0].q], ['door', 302, 'wikipedia.org', 'creatine']);
  const bot = await at('/d/wikipedia?q=creatine', { ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', accept: 'text/html' });
  assert.equal(bot.r.status, 302); assert.doesNotMatch(bot.r.headers.get('location'), /\/via\//); assert.equal(bot.ledger.mem.hits.length, 0);
});
await proof('/site/<domain> answers a program with data and a person with the page; the data is never HTML', async () => {
  const data = await at('/site/unmapped-proof-site.com', { accept: '*/*' }); assert.match(data.r.headers.get('content-type'), /^application\/json/); assert.equal(data.r.headers.get('vary'), 'accept');
  const plain = await at('/site/unmapped-proof-site.com', { accept: '' }); assert.match(plain.r.headers.get('content-type'), /^application\/json/);
  const page = await at('/site/unmapped-proof-site.com', { accept: 'text/html,application/xhtml+xml' }); assert.match(page.r.headers.get('content-type'), /^text\/html/);
  const md = await at('/site/unmapped-proof-site.com', { accept: 'text/markdown' }); assert.match(md.r.headers.get('content-type'), /^text\/markdown/);
  const json2 = await at('/site/unmapped-proof-site.com.json', { accept: 'text/html' }); assert.match(json2.r.headers.get('content-type'), /^application\/json/);
});

console.log(`\n${passed} held, ${failed} failed`);
process.exit(failed ? 1 : 0);
