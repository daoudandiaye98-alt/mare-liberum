// Mare Liberum · proof of attention (3.33.0): what the AIs read of the listings is counted by the census's own names, honestly
// and in bounded memory; the counted door to the paid services leads only to their own payment pages or to pages of the sea;
// the pages and their twins render; no failing shop is named; robots.txt says Content-Signal once and names a license the sea
// serves; crawlers keep reading.
// Runs without the network (no fetch, no DNS: the Atlas holds the maps of a few sites):
//   node --expose-gc tools/attention-proof.mjs   (exit code 1 when a proof fails)
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { handle, callerOf } from '../node/core.mjs';
import { createMem } from '../node/mem.mjs';
import { memoryKv } from '../node/flow.mjs';
import { createShelf } from '../node/shelf.mjs';
import { immune } from '../node/immune.mjs';
import { robotsGroups, robotsAllows } from '../node/check.mjs';
import { createAttention, familyOf, labelOf, groupOf, FAMILIES, ATTENTION, ctaTarget, safeTarget, providerHost, encodeSites, decodeSites } from '../node/attention.mjs';
import { OFFERS, OWNER_SITES, SELLER } from '../node/offers.mjs';
import { OFFER } from '../node/seo.mjs';

let passed = 0, failed = 0;
const proof = async (name, fn) => { try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 5).join('\n       ')}`); } };
globalThis.fetch = async (u) => { throw new Error(`the proof does not use the network: ${String(u?.url || u).slice(0, 80)}`); };
const BASE = 'https://mare.test', DAY = 864e5, today = new Date().toISOString().slice(0, 10);
const UA = {
  claude: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
  gpt: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)',
  meta: 'meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)',
  byte: 'Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; Bytespider; spider-feedback@bytedance.com)',
  perplexity: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
  amazon: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Amazonbot/0.1; +https://developer.amazon.com/support/amazonbot) Chrome/119.0.6045.214 Safari/537.36',
  apple: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)',
  cc: 'CCBot/2.0 (https://commoncrawl.org/faq/)',
  google: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  bing: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  oai: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot',
  chatgpt: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot',
  own: 'MareLiberum-session/1.0',
  browser: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  script: 'python-requests/2.31',
};
const MARKS = { 'sec-fetch-mode': 'navigate', 'sec-fetch-site': 'none', 'sec-fetch-dest': 'document', 'upgrade-insecure-requests': '1' };
const ROBOTS = readFileSync(new URL('../site/robots.txt', import.meta.url), 'utf8');
// an x402 API listed by a directory (the bazaar of api.cdp.coinbase.com); its provider is ropes.dev
const ENTRY = { identifier: 'urn:air:api.cdp.coinbase.com:x402:api.ropes.dev:1a2b', displayName: 'Rope prices', description: 'Prices of ropes, per call.', url: 'https://api.ropes.dev/price', tags: [], capabilities: [], metadata: { kind: 'x402', publisher: 'api.cdp.coinbase.com', endpoints: [{ url: 'https://api.ropes.dev/price' }], lake: 'proof' } };
const EP = `/e/${ENTRY.identifier.slice(8)}`;
// one sea per proof: its own memory and index, the Atlas holding maps of a few sites (nothing is read from the web)
function sea({ shelf = false } = {}) {
  const kv = memoryKv(), mem = createMem({ file: 'data/none.tsv', base: BASE });
  const db = Object.assign(async (fn, a) => (fn === 'mare_get' && a?.id === ENTRY.identifier ? ENTRY : mem(fn, a)), mem);
  const cfg = { base: BASE, kv, waitUntil: () => {}, site: { '/robots.txt': { body: ROBOTS, type: 'text/plain; charset=utf-8' } }, ...(shelf ? { shelf: createShelf() } : {}) };
  let n = 1;
  const call = async (path, { ua = UA.script, accept = 'text/html', from, marks = false } = {}) => {
    const r = await handle(new Request(BASE + path, { headers: { accept, 'user-agent': ua, 'x-forwarded-for': from || `198.51.${(n >> 8) & 255}.${n++ & 255}`, ...(marks ? MARKS : {}) } }), db, cfg);
    const txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch {}
    return { status: r.status, txt, j, type: r.headers.get('content-type') || '', loc: r.headers.get('location'), shelf: r.headers.get('x-mare-shelf') };
  };
  const map = (d) => kv.set(`atlas:${d}`, { d, at: today, s: 200, rb: 'ok', t: `${d} (proof)`, ds: 'a site of the proof', w: 300, sc: 70, g: 'B' }, 3600);
  return { kv, call, map };
}
const person = { ua: UA.browser, marks: true };
const has = (t, w) => t.includes(w) || t.includes(w.replace(/&/g, '&amp;'));
// a small XML document is well formed when its tags nest and no stray < or > is left between them
const wellFormed = (xml) => {
  const s = xml.replace(/^<\?xml[^>]*\?>/, '').replace(/<!--[\s\S]*?-->/g, ''), stack = [];
  for (const m of s.matchAll(/<(\/?)([A-Za-z][\w:.-]*)((?:\s+[\w:.-]+="[^"<]*")*)\s*(\/?)>/g)) { if (m[1]) assert.equal(stack.pop(), m[2], `</${m[2]}>`); else if (!m[4]) stack.push(m[2]); }
  assert.deepEqual(stack, [], 'every element closed'); assert.doesNotMatch(s.replace(/<[^>]+>/g, ''), /[<>]/);
};

console.log('who reads: the census\'s own names, each to its family');
await proof('ClaudeBot, GPTBot, Meta, Bytespider, PerplexityBot, Amazonbot, CCBot, OAI-SearchBot are AI crawlers; Googlebot, Bingbot and Applebot search engines; ChatGPT-User an assistant; the sea itself, people and programs no readers', () => {
  const H = (ua, marks) => new Headers({ 'user-agent': ua, ...(marks ? MARKS : {}) });
  const want = { claude: ['ClaudeBot', 'ai'], gpt: ['GPTBot', 'ai'], meta: ['Meta', 'ai'], byte: ['Bytespider', 'ai'], perplexity: ['PerplexityBot', 'ai'], amazon: ['Amazonbot', 'ai'], cc: ['CCBot', 'ai'], oai: ['OAI-SearchBot', 'ai'], google: ['Googlebot', 'search'], bing: ['Bingbot', 'search'], apple: ['Applebot', 'search'], chatgpt: ['ChatGPT-User', 'assistant'] };
  for (const [k, [label, group]] of Object.entries(want)) { const i = familyOf(callerOf(H(UA[k]))); assert.equal(labelOf(i), label, k); assert.equal(groupOf(i), group, k); }
  for (const k of ['own', 'script', 'browser']) assert.equal(familyOf(callerOf(H(UA[k]))), -1, k);
  assert.equal(familyOf(callerOf(H(UA.browser, true))), -1, 'a person');
  assert.equal(new Set(FAMILIES.map((f) => f[2])).size, FAMILIES.length, 'each family has a name of its own');
});

console.log('a read of a listing');
await proof('counted per family once its answer is 200, as a page, as JSON and as Markdown; own calls, people, programs and a 404 never; the JSON twin of the listing carries attention', async () => {
  const S = sea(); await S.map('ropes.dev');
  for (const [ua, p] of [[UA.claude, '/site/ropes.dev'], [UA.claude, '/site/ropes.dev.md'], [UA.gpt, '/site/ropes.dev.json'], [UA.google, '/site/ropes.dev'], [UA.chatgpt, '/site/ropes.dev']]) assert.equal((await S.call(p, { ua })).status, 200, p);
  for (let i = 0; i < 4; i++) { await S.call('/site/ropes.dev', { ua: UA.own }); await S.call('/site/ropes.dev', person); await S.call('/site/ropes.dev.json', { accept: 'application/json' }); }
  assert.equal((await S.call('/site/never-mapped-proof.com', { ua: UA.claude })).status, 404);
  const j = (await S.call('/site/ropes.dev.json', { accept: 'application/json' })).j;
  assert.deepEqual(j.attention.page, { ai: 3, search: 1, assistant: 1, by: { ClaudeBot: 2, GPTBot: 1, Googlebot: 1, 'ChatGPT-User': 1 } });
  assert.equal(j.attention.entries.ai, 0); assert.equal(j.attention.days, 7); assert.equal(j.attention.all, `${BASE}/attention`);
  const O = (await S.call('/attention.json')).j;
  assert.deepEqual([O.week.ai, O.week.search, O.week.assistant, O.days[0].maps, O.days[0].entries], [3, 1, 1, 5, 0]);
});
await proof('the line on the listing: what was read and by whom in the last 7 days, only when something was read; the same in its Markdown', async () => {
  const S = sea(); await S.map('ropes.dev'); await S.map('quiet.dev');
  for (const ua of [UA.claude, UA.claude, UA.meta, UA.google]) await S.call('/site/ropes.dev', { ua });
  const h = (await S.call('/site/ropes.dev', person)).txt;
  assert.match(h, /AI crawlers read this page <b>3<\/b> times in the last 7 days \(ClaudeBot 2, Meta 1\); search engines <b>1<\/b> time \(Googlebot 1\)\./);
  assert.match(h, /<a href="#report">Is this yours\?<\/a>/);
  assert.doesNotMatch((await S.call('/site/quiet.dev', person)).txt, /read this page/, 'nothing read: no line');
  assert.match((await S.call('/site/ropes.dev.md', { accept: 'text/markdown' })).txt, /AI crawlers read this page 3 times in the last 7 days \(ClaudeBot 2, Meta 1\)/);
});
await proof('a read the shelf answers (a node without a CDN keeps ready pages itself) counts too, once', async () => {
  const S = sea({ shelf: true }); await S.map('ropes.dev');
  const a = await S.call('/site/ropes.dev', { ua: UA.claude }), b = await S.call('/site/ropes.dev', { ua: UA.claude });
  assert.equal(a.status, 200); assert.equal(b.shelf, 'hit', 'the second answer came from the shelf');
  assert.equal((await S.call('/site/ropes.dev.json', { accept: 'application/json' })).j.attention.page.by.ClaudeBot, 2);
});
await proof('the rule of 3: one caller network counts at most 3 reads of a listing a day (an IPv6 /64 is one network); the rest is shown as not counted', async () => {
  const S = sea(); await S.map('ropes.dev');
  for (let i = 0; i < 10; i++) await S.call('/site/ropes.dev', { ua: UA.claude, from: '203.0.113.50' });
  for (let i = 1; i <= 5; i++) await S.call('/site/ropes.dev', { ua: UA.gpt, from: `2001:db8:7:8::${i}` });
  const by = (await S.call('/site/ropes.dev.json', { accept: 'application/json' })).j.attention.page.by;
  assert.deepEqual([by.ClaudeBot, by.GPTBot], [3, 3]);
  assert.equal((await S.call('/attention.json')).j.notCounted7days, 9);
});
await proof('an entry counts for its provider\'s own website, never for the directory that listed it; a provider known only by its entries is named without a link', async () => {
  const pick = (kind, publisher, url, endpoints) => providerHost({ url, metadata: { kind, publisher, endpoints } });
  assert.equal(pick('x402', 'api.cdp.coinbase.com', 'https://api.ropes.dev/price', [{ url: 'https://api.ropes.dev/price' }]), 'ropes.dev');
  assert.equal(pick('mcp', 'registry.modelcontextprotocol.io', 'https://registry.modelcontextprotocol.io/v0/servers/x', [{ url: 'https://mcp.knots.dev/mcp' }]), 'knots.dev');
  assert.equal(pick('mcp', 'registry.modelcontextprotocol.io', 'https://registry.modelcontextprotocol.io/v0/servers/x', [{ identifier: 'pkg', transport: 'package' }]), null, 'a package: the registry is no provider');
  assert.equal(pick('agent', '8004scan.io', 'https://www.8004scan.io/agents/1/2'), null);
  assert.equal(pick('actor', 'apify.com', 'https://apify.com/a/b', [{ url: 'https://api.apify.com/v2/acts/x' }]), null);
  assert.equal(pick('mcp', 'github.com', 'https://github.com/a/b'), null); assert.equal(pick('mcp', 'x', 'https://abc.hf.space/mcp'), null);
  assert.equal(pick('merchant', 'shop.brand.com'), 'shop.brand.com', 'a store counts under its own host, the address of its map');
  assert.equal(pick('merchant', 'cool-store.myshopify.com'), 'cool-store.myshopify.com');
  const S = sea();
  assert.equal((await S.call(EP, { ua: UA.claude })).status, 200); assert.equal((await S.call('/e/nothing:here', { ua: UA.claude })).status, 404);
  await S.map('ropes.dev');
  const j = (await S.call('/site/ropes.dev.json', { accept: 'application/json' })).j; assert.deepEqual([j.attention.entries.ai, j.attention.page.ai], [1, 0]);
  const O = (await S.call('/attention.json')).j; assert.equal(O.days[0].entries, 1); assert.deepEqual([O.top[0].site, O.top[0].listing], ['ropes.dev', null]);
  assert.doesNotMatch((await S.call('/attention', person)).txt, /href="\/site\/ropes\.dev"/, 'no link to a map nobody read: it may not exist');
});

console.log('bounds');
await proof('1,000,000 synthetic reads: the memory holds its bounds, every read is in the totals or shown as not counted, no listing is counted more than it was read, no record of a tide reaches 1 MB', async () => {
  const writes = [], kv0 = memoryKv(), kv = { get: (k) => kv0.get(k), set: (k, v, t) => { writes.push([k, typeof v === 'string' ? v.length : JSON.stringify(v).length]); return kv0.set(k, v, t); } };
  let t = Date.parse(`${today}T12:00:00Z`); const A = createAttention({ kv, now: () => t }); await A.ready();
  globalThis.gc?.(); const heap0 = process.memoryUsage().heapUsed, t0 = performance.now();
  let x = 0x9e3779b9; const rnd = () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; };
  const hot = ['hot-one.com', 'hot-two.com', 'hot-three.com'], truth = new Map(), watched = (d) => hot.includes(d) || d.endsWith('000.com');
  let fed = 0;
  for (let i = 0; i < 1_000_000; i++) {
    const h = i % 50 === 0, d = h ? hot[i % 3] : `d${Math.floor(rnd() * 400_000)}.com`, fi = Math.floor(rnd() * 26), net = h ? `hot-${i}` : `10.${(i >> 16) & 255}.${(i >> 8) & 255}.${i & 255}`;
    A.count(i % 10 === 7 ? 'e' : 's', d, fi, net, d); fed++;
    if (watched(d)) truth.set(d, (truth.get(d) || 0) + 1);
  }
  const ms = Math.round(performance.now() - t0), sz = A.size();
  assert.ok(sz.largestDay <= ATTENTION.sites, `a day holds ${sz.largestDay} listings`); assert.equal(sz.slots, ATTENTION.slots);
  const O = await A.overview();
  assert.equal(O.week.ai + O.week.search + O.week.assistant + O.notCounted, fed, 'every read is counted or shown as not counted');
  assert.ok(O.leftOutOfListings > 0, 'the table made room');
  for (const [d, n] of truth) { const s = await A.site(d), got = ['ai', 'search', 'assistant'].reduce((a, g) => a + s.page[g] + s.entries[g], 0); assert.ok(got <= n, `${d}: ${got} > ${n}`); if (hot.includes(d)) assert.equal(got, n, `${d} kept whole`); }
  const f = await A.flush(); assert.ok(f.largest < 1_000_000, `the listings of a day: ${f.largest} bytes`); assert.ok(writes.every(([, n]) => n < 1_000_000)); assert.ok(writes.length <= 4, `${writes.length} records`);
  globalThis.gc?.(); const grew = (process.memoryUsage().heapUsed - heap0) / 1e6;
  if (globalThis.gc) assert.ok(grew < 48, `the memory grew by ${grew.toFixed(1)} MB`);
  for (let k = 1; k <= 40; k++) { t += DAY; A.count('s', 'roll.com', 0, `n${k}`, 'roll.com'); }
  const z = A.size(); assert.ok(z.days <= ATTENTION.keepDays, `${z.days} days`); assert.ok(z.siteTables <= ATTENTION.siteDays, `${z.siteTables} tables`);
  // the worst a day can hold: 10,000 listings with names of 64 letters, each read by 26 families on its map and its entries
  const W = createAttention({ kv: memoryKv(), now: () => t }); await W.ready(); let reads = 0;
  for (let i = 0; i < ATTENTION.sites; i++) { const d = `${String(i).padStart(6, '0')}${'x'.repeat(54)}.com`; for (let fi = 0; fi < 26; fi++) { W.count('s', d, fi, `a${i}-${fi}`, d); W.count('e', d, fi, `b${i}-${fi}`, d); reads += 2; } }
  const wf = await W.flush(), wo = await W.overview(); assert.ok(wf.largest <= ATTENTION.recordMax, `${wf.largest} bytes`); assert.equal(wo.week.ai + wo.week.search + wo.week.assistant + wo.notCounted, reads, 'the totals keep every read');
  console.log(`       1,000,000 reads in ${ms} ms · a day holds ${sz.largestDay} listings · largest record ${f.largest} bytes · heap ${globalThis.gc ? `+${grew.toFixed(1)} MB` : 'not measured (run with --expose-gc)'}`);
});
await proof('what the tide wrote is read back after a restart and added to what the new node counted meanwhile; the listings of a day travel as short lines', async () => {
  const kv = memoryKv(), t = Date.parse(`${today}T08:00:00Z`), a = createAttention({ kv, now: () => t }); await a.ready();
  for (let i = 0; i < 5; i++) a.count('s', 'keep.com', 0, `n${i}`, 'keep.com');
  a.count('e', 'keep.com', 2, 'm1', 'x'); a.click('owner', 'site', { kind: 'browser', name: 'Mozilla/5.0' }, '203.0.113.9'); await a.flush();
  const b = createAttention({ kv, now: () => t }); b.count('s', 'keep.com', 0, 'n9', 'keep.com');
  const s = await b.site('keep.com'); assert.deepEqual([s.page.by.ClaudeBot, s.entries.by.Meta], [6, 1]); assert.equal((await b.overview()).clicks.last30days.owner.total, 1);
  await b.flush(); assert.equal((await createAttention({ kv, now: () => t }).site('keep.com')).page.by.ClaudeBot, 6, 'written once more, not twice');
  const m = new Map([['a.com', { 0: 3, e2: 1 }], ['b.org', { 11: 2 }]]); assert.equal(encodeSites(m), 'a.com|0=3,e2=1\nb.org|11=2'); assert.deepEqual(decodeSites(encodeSites(m)), m);
  // a memory that cannot be read for a while: nothing is written over the old records, and what was read later adds up
  let down = true; const flaky = { get: async (k) => { if (down) throw new Error('memory down'); return kv.get(k); }, set: (k, v, ttl) => kv.set(k, v, ttl) };
  const c = createAttention({ kv: flaky, now: () => t, log: () => {} }); c.count('s', 'keep.com', 0, 'n10', 'keep.com');
  assert.equal((await c.flush()).wrote, 0, 'nothing written over what could not be read');
  down = false; assert.ok((await c.flush()).wrote > 0); assert.equal((await c.site('keep.com')).page.by.ClaudeBot, 7);
});

console.log('the counted door to the paid services');
await proof('every service leads to its own payment page or to a page of the sea; nothing in the request can send anyone elsewhere', async () => {
  const S = sea(), go = (p) => S.call(p, person);
  assert.equal((await go('/c/owner?from=site&ref=ropes.dev')).loc, `${OFFERS.verified.link}?client_reference_id=verified-ropes_dev`);
  assert.equal((await go('/c/report?from=check&ref=ropes.dev')).loc, `${OFFERS.report.link}?client_reference_id=report-ropes_dev`);
  for (const id of ['teams', 'agency', 'law']) { const r = await go(`/c/${id}?from=pricing`); assert.deepEqual([r.status, r.loc], [302, OFFER[id]], id); }
  assert.equal((await go('/c/route')).loc, `${BASE}/pay/howto`); assert.equal((await go('/c/talk')).loc, `${BASE}/about#contact`);
  for (const p of ['/c/owner?from=site&ref=https://evil.example/x&to=https://evil.example&url=//evil.example&next=/%5Cevil.example', '/c/report?ref=%0d%0aLocation:%20https://evil.example']) {
    const r = await go(p); assert.equal(r.status, 302); assert.match(r.loc, /^https:\/\/buy\.stripe\.com\/[A-Za-z0-9_]+\?client_reference_id=[A-Za-z0-9_-]+$/, r.loc);
  }
  for (const p of ['/c/evil', '/c/VERIFIED', '/c/owner/x', '/c/%2F%2Fevil.example', '/c/constructor', '/c/__proto__', '/c/verified']) assert.equal((await go(p)).status, 404, p);
  for (const u of ['https://buy.stripe.com.evil.example/abcdefgh', 'https://evil.example/buy.stripe.com/abcdefgh', '//evil.example', '/\\evil.example', '//buy.stripe.com/abcdefgh', 'javascript:alert(1)', 'http://buy.stripe.com/abcdefgh', 'https://buy.stripe.com/abcdefgh?client_reference_id=a&next=https://evil.example', 'https://buy.stripe.com/abcdefgh#x', '/pricing?x=https://evil.example', ''])
    assert.equal(safeTarget(u), false, u);
  for (const u of [OFFERS.verified.link, OFFERS.report.link, OFFER.teams, OFFER.agency, OFFER.law, '/pay/howto', '/about#contact']) assert.equal(safeTarget(u), true, u);
  // a table changed to point elsewhere sends nobody there: the service leads to /pricing, and nothing is counted
  const keep = [OFFERS.report.link, OFFER.teams];
  try {
    OFFERS.report.link = 'https://evil.example/pay-here'; OFFER.teams = 'https://evil.example/x';
    assert.equal(ctaTarget('report', 'x'), null); assert.equal(ctaTarget('teams'), null);
    assert.equal((await go('/c/report?from=site')).loc, `${BASE}/pricing`); assert.equal((await go('/c/teams?from=site')).loc, `${BASE}/pricing`);
  } finally { [OFFERS.report.link, OFFER.teams] = keep; }
  const c = (await S.call('/attention.json')).j.clicks.last30days;
  assert.equal(c.report.from.site, undefined, 'a door to nowhere is not counted'); assert.equal(c.teams.from.site, undefined);
});
await proof('every button to a paid service, on every page that offers one, passes an open door (302, never a 404), and no payment link is left outside the door', async () => {
  const S = sea(); await S.map('ropes.dev');
  const pages = ['/offers', EP, '/site/ropes.dev', '/business', '/de/unternehmen', '/de/agenturen', '/teams', '/de/kanzleien', '/attention', '/claim', '/pricing', '/offers/sample-report'], doors = new Set();
  for (const p of pages) {
    const r = await S.call(p, person); assert.equal(r.status, 200, p);
    const found = [...r.txt.matchAll(/href="(\/c\/[^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&')); assert.ok(found.length, `${p} has a button`); found.forEach((d) => doors.add(d));
    assert.doesNotMatch(r.txt, /href="https:\/\/buy\.stripe\.com/, `${p}: a payment link outside the door`);
  }
  for (const d of doors) { const r = await S.call(d, person); assert.equal(r.status, 302, d); assert.ok(safeTarget(r.loc) || r.loc.startsWith(`${BASE}/`), `${d} → ${r.loc}`); }
  assert.ok(doors.size >= 15, `${doors.size} buttons`);
});
await proof('clicks count per day, service, page kind and kind of caller; crawlers and the sea itself not; at most 3 per caller network and service', async () => {
  const S = sea();
  for (let i = 0; i < 5; i++) await S.call('/c/owner?from=site&ref=ropes.dev', { ...person, from: '203.0.113.77' });
  await S.call('/c/report?from=attention', { ua: UA.chatgpt }); await S.call('/c/teams?from=pricing', { ua: 'curl/8.4' });
  assert.equal((await S.call('/c/owner?from=site', { ua: UA.claude })).status, 302, 'a crawler is sent on, and not counted');
  await S.call('/c/owner?from=site', { ua: UA.own }); await S.call('/c/law?from=//evil.example', person);
  const c = (await S.call('/attention.json')).j.clicks;
  assert.deepEqual(c.last30days.owner, { total: 3, from: { site: 3 }, who: { person: 3 } });
  assert.deepEqual(c.last30days.report, { total: 1, from: { attention: 1 }, who: { assistant: 1 } });
  assert.deepEqual(c.last30days.teams, { total: 1, from: { pricing: 1 }, who: { program: 1 } });
  assert.deepEqual(c.last30days.law, { total: 1, from: { other: 1 }, who: { person: 1 } });
  assert.equal(c.total, 6);
});
await proof('the operator can let attention rest without a release (immune:policy rest "attention"): nothing is counted, the doors still lead on', async () => {
  const S = sea(); await S.map('ropes.dev');
  immune.set({ rest: ['attention'] });
  try { assert.equal((await S.call('/site/ropes.dev', { ua: UA.claude })).status, 200); assert.equal((await S.call('/c/owner?from=site', person)).status, 302); } finally { immune.set({}); }
  const j = (await S.call('/attention.json')).j; assert.deepEqual([j.week.ai, j.clicks.total], [0, 0]);
});
await proof('a count is shown, never used: only the pages and the door read the counter, nothing else in the sea imports it', () => {
  const dir = new URL('../node/', import.meta.url), files = readdirSync(dir).filter((f) => f.endsWith('.mjs'));
  assert.deepEqual(files.filter((f) => /from '\.\/attention\.mjs'/.test(readFileSync(new URL(f, dir), 'utf8'))).sort(), ['attention-ui.mjs', 'core.mjs']);
  const core = readFileSync(new URL('core.mjs', dir), 'utf8');
  assert.deepEqual([...new Set([...core.matchAll(/attentionOf\(db, cfg\)\.(\w+)/g)].map((m) => m[1]))].sort(), ['click', 'flush', 'hook', 'overview', 'site']);
});

console.log('the pages');
await proof('/attention: a page with a multi-word title in the skin of the sea, its data (.json) and its Markdown (.md); the chart only when something was read', async () => {
  const S = sea(); await S.map('ropes.dev'); for (const ua of [UA.claude, UA.meta, UA.google]) await S.call('/site/ropes.dev', { ua });
  const h = await S.call('/attention', person); assert.equal(h.status, 200); assert.match(h.type, /text\/html/);
  assert.match(h.txt, /<h1[^>]*>What the AIs read on the open sea<\/h1>/); assert.match(h.txt, /data-door="attention"/); assert.match(h.txt, /data-scene="swarm"/);
  assert.match(h.txt, /class="att-chart wide"/); assert.match(h.txt, /<b>2<\/b> reads of listings by AI crawlers/); assert.match(h.txt, /1\. <a href="\/site\/ropes\.dev">ropes\.dev<\/a>/);
  for (const w of ['/c/owner?from=attention', '/c/report?from=attention', 'Owner check · 19 €', 'never adds the level', SELLER.vat, 'How it is counted', 'A click is not a sale']) assert.ok(has(h.txt, w), w);
  const j = await S.call('/attention.json'); assert.match(j.type, /application\/json/);
  for (const k of ['since', 'week', 'weekBefore', 'change', 'days', 'top', 'clicks', 'offers', 'rules', 'families', 'pages']) assert.ok(k in j.j, k);
  assert.deepEqual([j.j.week.ai, j.j.top[0].site, j.j.top[0].listing], [2, 'ropes.dev', `${BASE}/site/ropes.dev`]);
  const m = await S.call('/attention.md', { accept: '*/*' }); assert.match(m.type, /text\/markdown/); assert.match(m.txt, /^# What the AIs read on the open sea/);
  const empty = (await sea().call('/attention', person)).txt; assert.doesNotMatch(empty, /att-chart wide/); assert.match(empty, /Zero stays zero/);
});
await proof('/claim: how to claim, the owner check with its price, that its outcome can be negative and what it never does, § 19 and the contact; as data and as Markdown', async () => {
  const S = sea(), h = (await S.call('/claim', person)).txt;
  assert.match(h, /<h1[^>]*>Claim your listing<\/h1>/); assert.match(h, /data-scene="harbour"/);
  for (const w of ['Owner check · 19 €', 'The outcome can be negative', 'never adds the level “verified” or “proven”', 'It changes no order', SELLER.vat, SELLER.email, 'href="/c/owner?from=claim"', 'href="/c/report?from=claim"', 'POST https://mare.test/enter', 'POST https://mare.test/join']) assert.ok(has(h, w), w);
  assert.doesNotMatch(h, /Verify the listing|Verified listing/);
  const j = (await S.call('/claim.json')).j;
  assert.equal(j.ownerCheck.priceEur, 19); assert.match(j.ownerCheck.go, /\/c\/owner\?from=claim$/); assert.match(j.ownerCheck.outcome, /negative/); assert.equal(j.tax, SELLER.vat); assert.equal(j.seller.contact, SELLER.email);
  assert.match((await S.call('/claim.md')).txt, /^# Claim your listing/);
});
await proof('/pricing: one table of every paid offer, each with its counted link; § 19; measured savings beside modelled ones; for programs the answer of 3.29.0 still stands', async () => {
  const S = sea(), h = (await S.call('/pricing', person)).txt;
  assert.match(h, /<h1[^>]*>Prices of the open sea<\/h1>/);
  for (const w of ['49 € a month, first month free', '79 € a month per team, first month free', '750 € setup + 990 € a year per office', '19 € once', '29 € once', '0.02 USDC per call', 'Institutions: talk to us', SELLER.vat, 'href="/savings"', 'href="/proof"', 'Nothing pays to rank']) assert.ok(has(h, w), w);
  for (const id of ['teams', 'agency', 'law', 'owner', 'report', 'route', 'talk']) assert.ok(h.includes(`href="/c/${id}?from=pricing"`), id);
  assert.equal((h.match(/<tr id="[a-z]+">/g) || []).length, 7, 'one row per offer');
  const j = (await S.call('/pricing', { accept: 'application/json' })).j;
  assert.equal(j.price, 'POST /route costs 0.02 USDC on Base, no account, settle with POST /settle'); assert.equal(j.paid_route.pricing.amount_usd, '0.02'); assert.ok(j.house); assert.equal(j.how_to_pay, `${BASE}/pay/howto`);
  assert.deepEqual(j.offers.map((o) => o.id), ['teams', 'agency', 'law', 'owner', 'report', 'route', 'talk']); assert.ok(j.offers.every((o) => /^https:\/\/mare\.test\/c\/[a-z]+\?from=pricing$/.test(o.go)));
  assert.equal(j.value.measured.reuses30days, 0, 'zero stays zero'); assert.ok(j.value.modelledPerReuse.tokensMid > 0);
  assert.equal((await S.call('/pricing', { accept: '*/*' })).j.price, j.price, 'without asking for a page: data, as before');
  assert.match((await S.call('/pricing.md')).type, /text\/markdown/);
});
await proof('/site/<domain>: the box says plainly that an owner check never changes any order and adds no level of the market; a passed check shows its line; the JSON carries ownerCheck and attention', async () => {
  const S = sea(); await S.map('ropes.dev');
  const box = (await S.call('/site/ropes.dev', person)).txt.match(/<section id="report"[\s\S]*?<\/section>/)[0];
  for (const w of ['Is ropes.dev yours?', 'Owner check · 19 €', 'Get the AI-visibility report · 29 €', 'never changes any order', 'never adds the level “verified” or “proven”', 'the outcome can be negative', 'href="/c/owner?from=site&amp;ref=ropes.dev"', 'href="/c/report?from=site&amp;ref=ropes.dev"', SELLER.vat]) assert.ok(box.includes(w), w);
  assert.doesNotMatch(box, /guarante|will rank|rank higher|boost|more customers|Verified listing/i);
  const j = (await S.call('/site/ropes.dev.json', { accept: 'application/json' })).j;
  assert.equal(j.ownerCheck.priceEur, 19); assert.match(j.ownerCheck.not, /never adds the level "verified" or "proven"/); assert.ok(j.attention); assert.ok(j.report.go.endsWith('/c/report?from=site&ref=ropes.dev'));
  OWNER_SITES['ropes.dev'] = { at: '2026-11-01', until: '2099-11-01' };
  try { const v = (await S.call('/site/ropes.dev', person)).txt; assert.match(v, /<b>Owner checked<\/b> by a person on 2026-11-01, holds until 2099-11-01/); assert.doesNotMatch(v, /Owner check · 19 €/, 'a checked listing is not offered the check again'); }
  finally { delete OWNER_SITES['ropes.dev']; }
});
await proof('no failing shop is named, nor a domain whose name points to adult or gambling content; each still sees its own reads on its page', async () => {
  const S = sea(), sites = ['badshop.com', 'goodshop.com', 'xxx-tube-shop.com', 'sub.goodshop.com', 'sub.badshop.com'];
  for (const d of sites) await S.map(d);
  await S.kv.set('market:idx', { 'badshop.com': [1, today, 'Bad Shop'], 'goodshop.com': [2, today, 'Good Shop'] });
  for (const d of sites) for (const ua of [UA.claude, UA.meta]) await S.call(`/site/${d}`, { ua });
  const j = (await S.call('/attention.json')).j, names = j.top.map((t) => t.site);
  for (const d of ['goodshop.com', 'sub.goodshop.com', 'sub.badshop.com']) assert.ok(names.includes(d), d);
  for (const d of ['badshop.com', 'xxx-tube-shop.com']) assert.ok(!names.includes(d), d);
  assert.ok(!/"badshop\.com"|xxx-tube/.test(JSON.stringify(j)), 'not anywhere in the data');
  const h = (await S.call('/attention', person)).txt; assert.ok(!/>badshop\.com<|xxx-tube/.test(h), 'not on the page');
  assert.equal((await S.call('/site/badshop.com.json', { accept: 'application/json' })).j.attention.page.ai, 2, 'its own page still shows its reads');
});

console.log('robots.txt and the license');
await proof('robots.txt: the Content-Signal line once, in the group of the crawlers, as Cloudflare writes it; /c/ is a move crawlers skip; the rest of the file is that of 3.32.0', () => {
  const lines = ROBOTS.split('\n'), cs = lines.filter((l) => /^\s*content-signal\s*:/i.test(l));
  assert.deepEqual(cs, ['Content-Signal: search=yes, ai-input=yes, ai-train=yes']);
  const i = lines.indexOf(cs[0]); assert.equal(lines[i + 1], 'Allow: /');
  for (let k = i - 1; lines[k] && !lines[k].startsWith('#'); k--) assert.match(lines[k], /^User-agent: \S+$/, 'only the user agents of its group stand before it');
  const groups = robotsGroups(ROBOTS);
  for (const bot of ['ClaudeBot', 'GPTBot', 'meta-externalagent', 'Googlebot', 'PerplexityBot', 'CCBot']) {
    assert.equal(robotsAllows(groups, bot, '/c/owner').allowed, false, bot);
    for (const p of ['/', '/site/ropes.dev', '/attention', '/claim', '/pricing', '/license.xml', '/e/x']) assert.equal(robotsAllows(groups, bot, p).allowed, true, `${bot} ${p}`);
  }
  assert.equal(robotsAllows(groups, 'Claude-User', '/c/owner').allowed, true, 'an assistant acting for a person may follow a button');
  const before = ROBOTS.replace('License: https://mareliberum.dev/license.xml\n', '').replace('Content-Signal: search=yes, ai-input=yes, ai-train=yes\n', '').replace('Disallow: /c/\n', '');
  assert.equal(createHash('sha256').update(before).digest('hex'), '6696a73cc123a9d89a6135668a93151565ff812d844f2c44aafeb86486127e69');
});
await proof('robots.txt names the license once, for every crawler, as an absolute address; the sea serves it as RSL 1.0: every automated use, free, with credit to Mare Liberum', async () => {
  const lines = ROBOTS.split('\n'), lic = lines.filter((l) => /^\s*license\s*:/i.test(l));
  assert.deepEqual(lic, ['License: https://mareliberum.dev/license.xml']); assert.ok(lines.indexOf(lic[0]) < lines.findIndex((l) => /^User-agent:/i.test(l)), 'outside every group: global');
  const x = await sea().call('/license.xml', { ua: UA.claude, accept: '*/*' });
  assert.equal(x.status, 200); assert.match(x.type, /^application\/rsl\+xml/);
  assert.match(x.txt, /<rsl xmlns="https:\/\/rslstandard\.org\/rsl">/); assert.match(x.txt, /<content url="\/">/); assert.match(x.txt, /<permits type="usage">all<\/permits>/);
  assert.match(x.txt, /<payment type="attribution">\s*<standard>https:\/\/creativecommons\.org\/licenses\/by\/4\.0\/<\/standard>\s*<\/payment>/);
  assert.match(x.txt, /<copyright type="organization" contactEmail="oroborosdesign@gmail\.com" contactUrl="https:\/\/mare\.test\/about">Mare Liberum<\/copyright>/);
  assert.doesNotMatch(x.txt, /<prohibits|<payment type="(purchase|subscription|training|crawl|use)"/, 'nothing turns a crawler away, nothing asks for money');
  wellFormed(x.txt);
});
await proof('crawlers keep reading: no 402 and no block for them on robots.txt, the license, the pages and the listings', async () => {
  const S = sea(); await S.map('ropes.dev');
  for (const ua of [UA.claude, UA.gpt, UA.meta, UA.google, UA.perplexity, UA.byte]) for (const p of ['/robots.txt', '/license.xml', '/attention', '/claim', '/pricing', '/site/ropes.dev', EP]) assert.equal((await S.call(p, { ua, accept: '*/*' })).status, 200, `${p} ${ua.slice(0, 40)}`);
});

console.log(`\n${passed} held, ${failed} failed`);
process.exit(failed ? 1 : 0);
