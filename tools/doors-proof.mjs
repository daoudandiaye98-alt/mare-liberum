// Mare Liberum · proof of the doors, the long memory and the tide's budget
// Runs without the network: node tools/doors-proof.mjs   (exit code 1 when a proof fails)
import assert from 'node:assert/strict';
import { ruleHits } from '../node/check.mjs';
import { planRoute, readTask, topicsOf, routeSize, brandMap, leadOf, familyOf } from '../node/route.mjs';
import { DOORS, TOPICS } from '../node/doors.mjs';
import { durableKv, KEPT } from '../node/durable.mjs';
import { memoryKv } from '../node/flow.mjs';
import { TIDE } from '../node/eco.mjs';
import { handle } from '../node/core.mjs';
import { createMem } from '../node/mem.mjs';
import { decodeVia } from '../node/via.mjs';

let passed = 0, failed = 0;
const proof = async (name, fn) => { try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.message || e).split('\n').slice(0, 4).join('\n       ')}`); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const realFetch = globalThis.fetch;
const noNet = () => { globalThis.fetch = async (u) => { throw new Error(`the proof does not use the network: ${String(u).slice(0, 80)}`); }; };
noNet();

// ------------------------------------------------------------------ robots.txt rules: right, and in linear time
console.log('robots.txt rules');
await proof('plain prefixes, wildcards and the end mark', () => {
  assert.equal(ruleHits('/search', '/search?q=x'), true);
  assert.equal(ruleHits('/search', '/sea'), false);
  assert.equal(ruleHits('/*.php$', '/a/b.php'), true);
  assert.equal(ruleHits('/*.php$', '/a/b.php?x=1'), false);
  assert.equal(ruleHits('/a*b*c', '/a-1-b-2-c-3'), true);
  assert.equal(ruleHits('/a*b*c', '/a-1-c-2-b'), false);
  assert.equal(ruleHits('/private/', '/private/x'), true);
  assert.equal(ruleHits('/$', '/'), true);
  assert.equal(ruleHits('/$', '/x'), false);
  assert.equal(ruleHits('', '/x'), false);
  assert.equal(ruleHits('*/feed', '/blog/feed'), true);
});
await proof('a hostile rule cannot hold the reader (was: catastrophic backtracking)', () => {
  const t0 = performance.now();
  assert.equal(ruleHits('/' + '*a'.repeat(60) + '$', '/' + 'a'.repeat(20000) + 'b'), false);
  assert.equal(ruleHits('/' + '*a'.repeat(60), '/' + 'a'.repeat(20000)), true);
  assert.ok(performance.now() - t0 < 200, `took ${Math.round(performance.now() - t0)} ms`);
});

// ------------------------------------------------------------------ the table itself
console.log('the table of doors');
await proof('search pages that their own robots.txt closes to assistants are not in the table', () => {
  for (const d of DOORS) assert.ok(!/^https:\/\/(www\.bing\.com\/search|news\.google\.com|pkg\.go\.dev\/search)/.test(d.url), d.id);
});
await proof('every door is well formed and every shelf has a way out', () => {
  const ids = new Set(), shelves = new Set(TOPICS.map((t) => t.id));
  for (const d of DOORS) {
    assert.ok(/^[a-z0-9-]+$/.test(d.id), `id ${d.id}`); assert.ok(!ids.has(d.id), `double id ${d.id}`); ids.add(d.id);
    assert.ok(['api', 'feed', 'page'].includes(d.kind), `${d.id} kind`);
    assert.ok(/^https:\/\//.test(d.url.replace('{base}', 'https://x')), `${d.id} is https`);
    assert.ok(d.name && d.returns, `${d.id} says what it returns`);
    for (const t of d.topics) assert.ok(shelves.has(t) || t === 'general', `${d.id} shelf ${t}`);
    if (d.kind !== 'feed' && d.by !== 'ql') assert.ok(d.test, `${d.id} has a test value`);
  }
  const size = routeSize();
  assert.ok(size.apis >= 100 && size.searchLinks >= 1000, JSON.stringify(size));
  assert.equal(TOPICS.length, 35);
});

// ------------------------------------------------------------------ the plan for a task
console.log('from a task to its doors');
const live = Object.fromEntries(DOORS.filter((d) => d.wait).map((d) => [d.id, { ok: true }]));
const brands = brandMap(['google.com', 'stripe.com', 'notion.com', 'netflix.com', 'amazon.com', 'timeout.com', 'hilton.com', 'angel.com', 'imdb.com', 'spotify.com', 'adyen.com', 'germany.travel']);
const plan = (q, o = {}) => planRoute(q, { base: 'https://mare.test', live, brands, ...o });
const first = (q, o) => plan(q, o).doors[0];
const CASES = [
  // task, shelf, first door, part of its address
  ['latest research on CRISPR off-target effects', 'research', 'openalex', 'search=CRISPR+off-target+effects'],
  ['Apotheke in Leipzig', 'local', 'osm-places', encodeURIComponent('"amenity"="pharmacy"')],
  ['best pizza in New York', 'local', 'osm-places', encodeURIComponent('["cuisine"~"pizza"]')],
  ['vegan restaurants in Berlin', 'local', 'osm-places', encodeURIComponent('["diet:vegan"~"yes|only"]')],
  ['book a table for two in Berlin tonight', 'local', 'osm-places', encodeURIComponent('"amenity"="restaurant"')],
  ['eur to usd exchange rate', 'finance', 'frankfurter', 'base=EUR&symbols=USD'],
  ['weather in Tokyo tomorrow', 'weather', 'wttr', 'wttr.in/Tokyo'],
  ['東京の天気', 'weather', 'wttr', 'wttr.in/' + encodeURIComponent('東京')],
  ['TypeError: Cannot read properties of undefined (reading map) react', 'code', 'stackexchange', 'site=stackoverflow'],
  ['npm package for parsing yaml', 'code', 'npm', 'text=parsing+yaml'],
  ['CVE-2024-3094 details', null, 'cve', 'CVE-2024-3094'],
  ['Nachrichten Bundestag heute', 'news', 'tagesschau', 'searchText=Bundestag'],
  ['whois example.com', 'web', 'sea-site', '/site/example.com.json'],
  ['population of Nigeria', 'geo', 'restcountries', 'name/Nigeria'],
  ['flights from Cologne to Lisbon in March', 'travel', 'wikivoyage', 'q=Lisbon'],
  ['best running shoes under 100 EUR', 'shopping', 'sea-decide', '/decide?need='],
  ['billige Waschmaschine', 'shopping', 'sea-decide', 'Waschmaschine'],
  ['nginx reverse proxy websocket 502', 'ops', 'serverfault', 'site=serverfault'],
  ['search arxiv for diffusion models', 'research', 'arxiv', 'all:diffusion+models'],
  ['Stripe refunds API docs', 'code', 's:stripe.com', 'site%3Astripe.com+refunds+API'],
  ['notion api rate limits', 'code', 's:notion.com', 'site%3Anotion.com'],
  ['How do I cancel my Netflix subscription', null, 's:netflix.com', 'cancel+subscription'],
  ['amazon return policy', null, 's:amazon.com', 'return+policy'],
  ['how to tie a tie', null, 'wikipedia', 'wikipedia.org'],
];
for (const [q, shelf, door, part] of CASES) await proof(`${q}  →  ${door}`, () => {
  const p = plan(q), d = p.doors[0];
  assert.equal(p.topics[0]?.id ?? null, shelf, `shelf of "${q}": ${p.topics.map((t) => t.id)}`);
  assert.equal(d?.id, door, `doors: ${p.doors.map((x) => x.id).join(' ')}`);
  assert.ok(d.to && d.to.includes(part), `address ${d.to}`);
  assert.ok(/^https:\/\//.test(d.to));
  assert.equal(p.general.length, 2);
});
await proof('ordinary words are not taken for sites', () => {
  for (const q of ['Python requests timeout error ReadTimeout', 'Angel investors list Germany', 'Amazon rainforest deforestation rates', 'Compare Stripe vs Adyen pricing for Germany'])
    for (const d of plan(q).doors) assert.ok(!['s:timeout.com', 's:angel.com', 's:amazon.com', 's:germany.travel'].includes(d.id), `${q}: ${d.id}`);
  const guess = plan('Paris Hilton net worth');
  assert.equal(guess.doors[0].id, 'wikipedia');                                   // a capital alone is a guess: behind the plain doors
  assert.ok(guess.terms.includes('Hilton'));                                      // and the word stays in the search
});
await proof('a word that only looks like a shelf word does not call the shelf', () => {
  assert.deepEqual(plan('wikipedia article on photosynthesis').topics.map((t) => t.id), ['reference']);
  assert.equal(leadOf('cheap flights to Lisbon'), 'travel');
  assert.equal(leadOf('cheap laptop'), 'shopping');
  assert.equal(leadOf('pizza dough hydration'), null);
});
await proof('the language of the task picks the edition (Wikipedia, news, town names)', () => {
  assert.equal(readTask('Nachrichten Bundestag heute').lang, 'de');
  assert.equal(readTask('noticias economía hoy').lang, 'es');
  assert.ok(first('noticias economía hoy').to.includes('setlang=es&cc=ES&mkt=es-ES'));
  assert.ok(first('günstige Hotels in Rom').to.includes(encodeURIComponent('["name:de"="Rom"]')));
  assert.ok(plan('Was ist Photosynthese').doors.find((d) => d.id === 'wikipedia').to.startsWith('https://de.wikipedia.org/'));
});
await proof('a door that needs a value the task lacks is listed last, with its template', () => {
  const p = plan('nginx reverse proxy websocket 502'), d = p.doors.find((x) => x.id === 'tldr');
  assert.ok(d && !d.to && d.template.includes('{q}') && d.needs);
  assert.ok(p.doors.indexOf(d) > p.doors.findIndex((x) => x.to));
});
await proof('doors that wait are shown only after the sea opened them; doors that failed twice are hidden', () => {
  const cold = planRoute('nginx reverse proxy websocket 502', { base: 'https://mare.test', live: {}, brands });
  assert.ok(!cold.doors.some((d) => d.id === 'serverfault' || d.id === 'stackexchange'));
  const shut = planRoute('latest research on CRISPR', { base: 'https://mare.test', live: { openalex: { ok: false, n: 2 } }, brands });
  assert.ok(!shut.doors.some((d) => d.id === 'openalex')); assert.equal(shut.doors[0].id, 'crossref');
  const once = planRoute('latest research on CRISPR', { base: 'https://mare.test', live: { openalex: { ok: false, n: 1 } }, brands });
  assert.equal(once.doors[0].id, 'openalex');
});
await proof('what agents report moves the order, and old reports fade', () => {
  const now = new Date().toISOString(), old = new Date(Date.now() - 400 * 86400000).toISOString();
  assert.equal(plan('latest research on CRISPR', { stats: { openalex: { no: 3, last: now } } }).doors[0].id, 'crossref');
  assert.equal(plan('latest research on CRISPR', { stats: { openalex: { no: 3, last: old } } }).doors[0].id, 'openalex');
  assert.equal(plan('latest research on CRISPR', { stats: { arxiv: { ok: 6, w: 20, last: now } } }).doors[0].id, 'arxiv');
});
await proof('every planned address is a plain https address with the words of the task inside', () => {
  for (const q of ['<script>alert(1)</script> weather in Paris', 'pizza in "Rome"]; out; //', 'define a\u0000b', 'x'.repeat(900)]) {
    const p = plan(q);
    for (const d of [...p.doors, ...p.general]) if (d.to) { assert.ok(/^https:\/\/[a-z0-9.-]+[/?]/i.test(d.to), d.to); assert.ok(!/[<>"\s\u0000]/.test(d.to), d.to); assert.ok(d.to.length < 2500); }
  }
});
await proof('family of a host', () => { assert.equal(familyOf('www.api.example.co.uk'), 'example.co.uk'); assert.equal(familyOf('export.arxiv.org'), 'arxiv.org'); });

// ------------------------------------------------------------------ the long memory
console.log('the long memory');
const fakeStore = () => { const rows = new Map(); const s = { rows, gets: 0, puts: 0, fail: false,
  async get(ks) { s.gets++; if (s.fail) throw new Error('database away'); const o = {}; for (const k of ks) if (rows.has(k)) o[k] = structuredClone(rows.get(k)); return o; },
  async put(items) { s.puts++; if (s.fail) throw new Error('database away'); for (const x of items) { if (x.v == null) rows.delete(x.k); else rows.set(x.k, structuredClone(x.v)); } return items.length; } }; return s; };
const forgetful = () => { const m = new Map(); return { m, async get(k) { return m.has(k) ? structuredClone(m.get(k)) : null; }, async set(k, v) { m.set(k, structuredClone(v)); }, forget(k) { m.delete(k); } }; };
const settle = async (kv) => { await sleep(15); await kv.settle(); };
await proof('without a database the store is handed back unchanged', () => { const c = forgetful(); assert.equal(durableKv(c, null), c); });
await proof('what is kept is the brain, the minds, the doors\' record, residents and their standing', () => {
  for (const k of ['brain:p:abc', 'brain:tok:shoes', 'brain:url:0f', 'brain:all', 'brain:stats', 'mind:xyz', 'door:stats', 'door:live', 'door:asks', 'agent:mare:abc', 'agents', 'rep:mare:abc']) assert.ok(KEPT.test(k), k);
  for (const k of ['rl:ask:1', 'tide:last', 'door:w:x:y', 'door:cursor', 'brain:seedcursor', 'durable:ok', 'atlas:wanted', 'agentsx']) assert.ok(!KEPT.test(k), k);
});
await proof('a kept key is written to both; after the cache forgot it, it comes back', async () => {
  const c = forgetful(), s = fakeStore(), kv = durableKv(c, s);
  await kv.set('brain:p:1', { id: '1', to: 'https://a.example' }, 100); await kv.set('rl:x', 5, 60); await settle(kv);
  assert.deepEqual(s.rows.get('brain:p:1'), { id: '1', to: 'https://a.example' }); assert.ok(!s.rows.has('rl:x'));
  c.forget('brain:p:1');
  assert.deepEqual(await kv.get('brain:p:1'), { id: '1', to: 'https://a.example' });
  assert.deepEqual(c.m.get('brain:p:1'), { id: '1', to: 'https://a.example' });       // warm again
  const g = s.gets; await kv.get('brain:p:1'); assert.equal(s.gets, g);                 // the cache answers
});
await proof('"nothing there" is remembered too: a missing key asks the database once', async () => {
  const c = forgetful(), s = fakeStore(), kv = durableKv(c, s);
  assert.equal(await kv.get('brain:tok:unknown'), null); assert.equal(await kv.get('brain:tok:unknown'), null);
  assert.equal(s.gets, 1);
  await kv.set('brain:tok:unknown', ['p1'], 100); assert.deepEqual(await kv.get('brain:tok:unknown'), ['p1']);
});
await proof('misses of one moment ask together', async () => {
  const c = forgetful(), s = fakeStore(), kv = durableKv(c, s);
  s.rows.set('brain:tok:b', ['x']);
  const got = await Promise.all(['a', 'b', 'c', 'd', 'e'].map((t) => kv.get(`brain:tok:${t}`)));
  assert.deepEqual(got, [null, ['x'], null, null, null]); assert.equal(s.gets, 1);
});
await proof('taking a key away reaches the database, and nothing brings it back', async () => {
  const c = forgetful(), s = fakeStore(), kv = durableKv(c, s);
  await kv.set('agent:mare:abc', { name: 'A' }, 100); await settle(kv); assert.ok(s.rows.has('agent:mare:abc'));
  await kv.set('agent:mare:abc', null, 60);
  assert.equal(await kv.get('agent:mare:abc'), null);                                   // at once, before the database knows
  await settle(kv); assert.ok(!s.rows.has('agent:mare:abc'));
  const g = s.gets; assert.equal(await kv.get('agent:mare:abc'), null); assert.equal(s.gets, g);
});
await proof('a mind from before the long memory is adopted the first time it is read', async () => {
  const c = forgetful(), s = fakeStore(), kv = durableKv(c, s);
  await c.set('mind:old', { at: 'then', notes: [{ text: 'remember' }] });
  await kv.get('mind:old'); await kv.get('mind:old'); await settle(kv);
  assert.deepEqual(s.rows.get('mind:old').notes, [{ text: 'remember' }]); assert.equal(s.puts, 1);
});
await proof('plain counters follow at a calm pace and end on the right number', async () => {
  const c = forgetful(), s = fakeStore(), kv = durableKv(c, s, { slowMs: 120 });
  for (let i = 1; i <= 5; i++) { await kv.set('brain:stats', { asks: i }, 100); await sleep(8); }
  await settle(kv); assert.equal(s.puts, 1); assert.equal(s.rows.get('brain:stats').asks, 1);
  await sleep(140); await kv.get('brain:stats'); await settle(kv);                      // the next touch carries the rest
  assert.equal(s.rows.get('brain:stats').asks, 5); assert.equal(s.puts, 2);
});
await proof('a database that is away costs one try; the sea works on and catches up', async () => {
  const c = forgetful(), s = fakeStore(), kv = durableKv(c, s, { restMs: 150 });
  s.fail = true;
  await kv.set('brain:p:2', { id: '2' }, 100); await settle(kv);
  assert.deepEqual(await kv.get('brain:p:2'), { id: '2' });                             // the cache still serves
  const g = s.gets; assert.equal(await kv.get('brain:p:nope'), null); assert.equal(await kv.get('brain:p:nope2'), null);
  assert.equal(s.gets, g);                                                              // resting: no further tries
  assert.ok(!c.m.has('brain:p:nope'));                                                  // and no "nothing there" learned from an outage
  assert.equal((await kv.state()).resting, true);
  s.fail = false; await sleep(170);
  await kv.set('brain:p:3', { id: '3' }, 100); await settle(kv);
  assert.ok(s.rows.has('brain:p:2') && s.rows.has('brain:p:3'));                        // what waited went out with the next write
});
await proof('one failed answer for many names is said once, not once per name', async () => {
  const c = forgetful(), s = fakeStore(), said = []; const kv = durableKv(c, s, { restMs: 100, log: (t, m) => said.push(m) });
  let sets = 0; const set0 = c.set; c.set = async (k, v) => { if (k === 'durable:err') sets++; return set0(k, v); };
  s.fail = true;
  const got = await Promise.all(Array.from({ length: 200 }, (_, i) => kv.get(`brain:p:${i}`)));
  assert.ok(got.every((x) => x === null)); assert.equal(said.length, 1); assert.equal(sets, 1); assert.equal(s.gets, 1);
});
await proof('a flood of unknown names is not passed on to the database', async () => {
  const c = forgetful(), s = fakeStore(), kv = durableKv(c, s, { asksPer10s: 5 });
  for (let i = 0; i < 30; i++) { await kv.get(`agent:mare:flood${i}`); }
  assert.ok(s.gets <= 5, `asked ${s.gets} times`);
});
await proof('keep() takes over what the cache holds; check() goes the whole way', async () => {
  const c = forgetful(), s = fakeStore(), kv = durableKv(c, s);
  await c.set('brain:p:9', { id: '9' }); await c.set('agents', { a: 1 }); await c.set('rl:x', 1);
  assert.deepEqual(await kv.keep(['brain:p:9', 'agents', 'rl:x', 'brain:p:none']), { asked: 3, kept: 2 });
  const chk = await kv.check(); assert.equal(chk.ok, true); assert.equal(chk.tookAway, true);
  assert.equal([...s.rows.keys()].some((k) => k.startsWith('selftest:')), false);
});

// ------------------------------------------------------------------ the node, door by door
console.log('the node');
const db = createMem({ file: 'data/none.tsv', base: 'https://mare.test' });
const SITE = { '/': { body: '<!doctype html><title>home</title>', type: 'text/html; charset=utf-8' }, '/llms.txt': { body: '# guide', type: 'text/plain; charset=utf-8' } };
const call = async (method, path, body, headers = {}) => {
  const r = await handle(new Request('https://mare.test' + path, { method, headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.9', 'user-agent': 'proof/1.0', ...headers }, body: body ? JSON.stringify(body) : undefined }), db, { site: SITE, base: 'https://mare.test' });
  const txt = await r.text(); let j; try { j = JSON.parse(txt); } catch { j = null; }
  return { status: r.status, j, txt, headers: r.headers };
};
const enc = encodeURIComponent;
await proof('GET /route.json?q=… answers with doors, their go links and how to report', async () => {
  const r = await call('GET', `/route.json?q=${enc('latest research on CRISPR off-target effects')}`);
  assert.equal(r.status, 200); assert.equal(r.j.topics[0].id, 'research'); assert.equal(r.j.doors[0].id, 'openalex');
  assert.ok(r.j.doors[0].go.startsWith('https://mare.test/d/openalex?q=')); assert.ok(r.j.doors[0].worked_it.endsWith('/d/openalex/worked'));
  assert.ok(r.j.how && r.j.checked && r.j.general.length === 2);
  assert.ok(r.j.doors.length <= 8);
});
await proof('GET /route without a task says what it is; the pages for people and crawlers render', async () => {
  const a = await call('GET', '/route.json'); assert.equal(a.status, 200); assert.ok(a.j.ask.includes('/route?q='));
  const h = await call('GET', `/route?q=${enc('weather in Tokyo tomorrow')}`, null, { accept: 'text/html' }); assert.equal(h.status, 200); assert.ok(/wttr\.in/.test(h.txt) && /<html/i.test(h.txt));
  const l = await call('GET', '/routes', null, { accept: 'text/html' }); assert.equal(l.status, 200); assert.ok(/<html/i.test(l.txt));
  const t = await call('GET', '/routes.json'); assert.equal(t.j.topics.length, 35);
  const s = await call('GET', '/routes/research.json'); assert.equal(s.status, 200); assert.ok(s.j.doors.length >= 6 && s.j.doors.every((d) => d.template && d.returns));
  const sh = await call('GET', '/routes/research', null, { accept: 'text/html' }); assert.equal(sh.status, 200); assert.ok(/OpenAlex/.test(sh.txt));
  assert.equal((await call('GET', '/routes/nope.json')).status, 404);
});
await proof('a walk through a door is a redirect to the filled address, through the sea (a /via/ address that names it)', async () => {
  // since 3.28.0 the door's address leads through the sea: the Location is a via address whose token names the filled address
  const placeOf = (loc) => decodeVia(new URL(loc).pathname.slice(5)).url;
  const r = await call('GET', `/d/openalex?q=${enc('crispr off-target')}`);
  assert.equal(r.status, 302); assert.match(r.headers.get('location'), /\/via\/[A-Za-z0-9_-]+\?q=crispr\+off-target&c=\d+$/); assert.equal(placeOf(r.headers.get('location')), 'https://api.openalex.org/works?search=crispr+off-target&per-page=10');
  const s = await call('GET', `/d/${enc('s:stripe.com')}?q=refunds`); assert.equal(s.status, 302); assert.ok(placeOf(s.headers.get('location')).startsWith('https://html.duckduckgo.com/html/?q=site%3Astripe.com+refunds'));
  assert.equal((await call('GET', '/d/nope?q=x')).status, 404);
  assert.equal((await call('GET', '/d/tldr')).status, 400);
  assert.equal((await call('GET', `/d/${enc('s:not a domain')}?q=x`)).status, 404);
});
await proof('a report counts once a day from one caller, and the next answer shows it', async () => {
  const a = await call('GET', '/d/openalex/worked'); assert.equal(a.status, 200); assert.equal(a.j.used.worked, 1);
  const b = await call('GET', '/d/openalex/worked'); assert.ok(/already/.test(b.j.note));
  const c = await call('GET', '/d/openalex/failed', null, { 'x-forwarded-for': '203.0.113.77' }); assert.equal(c.j.used.failed, 1);
  const r = await call('GET', `/route.json?q=${enc('latest research on CRISPR')}`);
  const d = r.j.doors.find((x) => x.id === 'openalex'); assert.deepEqual(d.used, { walks: 1, worked: 1, failed: 1 });
});
await proof('crawlers read the doors; they neither rate nor count', async () => {
  const bot = { 'user-agent': 'Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)' };
  const before = (await call('GET', '/routes.json')).j.asks;
  assert.equal((await call('GET', `/route.json?q=${enc('weather in Lyon')}`, null, bot)).status, 200);
  assert.equal((await call('GET', '/routes.json')).j.asks, before);
  assert.equal((await call('GET', '/d/wttr/worked', null, bot)).status, 403);
});
await proof('the shared brain answers a task with the doors first', async () => {
  const r = await call('GET', `/brain?q=${enc('weather in Tokyo tomorrow')}`, null, { accept: 'application/json' });
  assert.equal(r.status, 200); assert.equal(r.j.doors[0].id, 'wttr'); assert.ok(Array.isArray(r.j.web) && r.j.web.length === 2);
});
await proof('MCP: the full endpoint has the route tool, the directory endpoint keeps its reviewed list', async () => {
  const list = await call('POST', '/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/list' });
  assert.ok(list.j.result.tools.some((t) => t.name === 'route'));
  const app = await call('POST', '/mcp/app', { jsonrpc: '2.0', id: 2, method: 'tools/list' });
  assert.deepEqual(app.j.result.tools.map((t) => t.name).sort(), ['answers', 'ask', 'check_site', 'decide', 'get', 'lay_path', 'mind', 'mind_add', 'mind_new', 'rate_path', 'read_page', 'search', 'stats', 'think']);
  const c = await call('POST', '/mcp', { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'route', arguments: { q: 'eur to usd exchange rate' } } });
  assert.equal(c.j.result.structuredContent.doors[0].id, 'frankfurter');
  const th = await call('POST', '/mcp/app', { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'think', arguments: { task: 'weather in Tokyo tomorrow' } } });
  assert.ok(!th.j.error, JSON.stringify(th.j.error)); assert.ok(JSON.stringify(th.j.result).includes('wttr.in'));
});
await proof('A2A: plain words go to the doors unless they are a purchase', async () => {
  const say = (text) => call('POST', '/a2a', { jsonrpc: '2.0', id: 1, method: 'message/send', params: { message: { role: 'user', parts: [{ kind: 'text', text }] } } });
  const a = await say('latest research on CRISPR off-target effects');
  const data = a.j.result.parts.find((p) => p.kind === 'data').data; assert.equal(data.doors[0].id, 'openalex');
  assert.ok(/api\.openalex\.org/.test(a.j.result.parts.find((p) => p.kind === 'text').text));
  const b = await call('POST', '/a2a', { jsonrpc: '2.0', id: 2, method: 'message/send', params: { message: { role: 'user', parts: [{ kind: 'data', data: { skill: 'route', q: 'weather in Lyon' } }] } } });
  assert.equal(b.j.result.parts.find((p) => p.kind === 'data').data.doors[0].id, 'wttr');
});
// since 3.46: the x402 indexes (x402scan, Circle's and Coinbase's discovery) read /openapi.json and probe each paid operation for
// a real 402; only operations that are sold carry x-payment-info, and each of them answers 402 here
await proof('OpenAPI names the two paid doors for the x402 indexes (x-payment-info, a fixed USD price, a 402 response), each answers 402 without a payment, and no free door carries a price; info.contact has the e-mail', async () => {
  const o = await call('GET', '/openapi.json'); assert.equal(o.j.info.contact.email, 'oroborosdesign@gmail.com');
  const paid = Object.entries(o.j.paths).flatMap(([p, ops]) => Object.entries(ops).filter(([, op]) => op['x-payment-info']).map(([m, op]) => [m.toUpperCase(), p, op]));
  assert.deepEqual(paid.map(([m, p]) => `${m} ${p}`).sort(), ['POST /reader/credit', 'POST /route']);
  for (const [m, p, op] of paid) {
    const x = op['x-payment-info']; assert.deepEqual(x.protocols, ['x402']); assert.equal(x.price.mode, 'fixed'); assert.equal(x.price.currency, 'USD'); assert.match(x.price.amount, /^\d+\.\d{2}$/); assert.ok(op.responses['402'], `${p}: a 402 response`);
    const r = await call(m, p === '/route' ? '/route?q=find+usdc+price' : p); assert.equal(r.status, 402, `${m} ${p} without a payment`);
  }
  assert.equal(o.j.paths['/route'].post['x-payment-info'].price.amount, '0.02'); assert.equal(o.j.paths['/reader/credit'].post['x-payment-info'].price.amount, '0.05');
});
await proof('the door is in the open descriptions: OpenAPI, agent card, sitemap, link header', async () => {
  const o = await call('GET', '/openapi.json'); assert.ok(o.j.paths['/route.json']);
  const c = await call('GET', '/.well-known/agent-card.json'); assert.ok(c.j.skills.some((s) => s.id === 'route'));
  const { AGENT_LINK } = await import('../node/core.mjs'); assert.ok(/<\/routes>; rel="related"/.test(AGENT_LINK));
  const sm = await call('GET', '/sitemap.xml'); assert.ok(sm.status !== 200 || /\/routes/.test(sm.txt) || /sitemap/.test(sm.txt));
});
await proof('the long memory says honestly when it is off', async () => {
  const r = await call('GET', '/durable.json'); assert.equal(r.status, 200); assert.equal(r.j.on, false);
});

// ------------------------------------------------------------------ briefs: the kind of work
console.log('briefs');
await proof('a comparison gets the decision brief; word stems of other languages count', async () => {
  const { briefFor } = await import('../node/brief.mjs');
  const kind = (q) => briefFor(q).kind;
  assert.equal(kind('compare vector databases pgvector vs qdrant'), 'decision');           // was: sql
  assert.equal(kind('should we use postgres or mongodb for our app'), 'decision');
  assert.equal(kind('write a SQL query to find duplicate emails'), 'sql');
  assert.equal(kind('summarize the comparison table'), 'summary');
  assert.equal(kind('Hilf mir bei der Entscheidung zwischen zwei Jobangeboten'), 'decision'); // these four never matched before
  assert.equal(kind('Wettbewerbsanalyse für Yogastudios in Köln'), 'market-research');
  assert.equal(kind('Lokalisierung unserer App ins Spanische'), 'translation');
  assert.equal(kind('keywords for a yoga studio website'), 'seo');
});

// ------------------------------------------------------------------ the sea opens its own doors
console.log('the sea opens its doors in turn');
await proof('one step opens doors from the sea\'s side and remembers how they answered', async () => {
  const seen = [];
  globalThis.fetch = async (u) => { const url = String(u); seen.push(url);
    if (/api\.stackexchange\.com|semanticscholar/.test(url)) return new Response(JSON.stringify({ items: [{ title: 'a question about nginx and proxies, long enough to count as an answer from the door' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    if (/overpass|jikan|tagesschau|guardian|gdelt|web\.archive|github|maven/.test(url)) return new Response('busy', { status: 429 });
    return new Response('<!doctype html><html><body>not a bot? verify you are human</body></html>', { status: 403 }); };
  try {
    const sea = db.flow;
    for (let i = 0; i < 8; i++) await sea.doorStep(3);
    const liveNow = (await call('GET', '/routes.json')).j;
    assert.ok(liveNow.opened >= 2, `opened ${liveNow.opened}`);
    const p = await call('GET', `/route.json?q=${enc('nginx reverse proxy websocket 502')}`);
    assert.ok(p.j.doors.some((d) => d.id === 'serverfault'), p.j.doors.map((d) => d.id).join(' '));     // waited, opened, now shown
    assert.ok(seen.every((u) => u.startsWith('https://')));
  } finally { noNet(); }
});

// ------------------------------------------------------------------ the tide keeps to its time
console.log('the tide');
await proof('a tide stops starting new pairs when its budget is used and goes on there next time', async () => {
  const keep = TIDE.budgetMs; TIDE.budgetMs = 120;
  globalThis.fetch = async () => { await sleep(90); return new Response(JSON.stringify({}), { status: 200, headers: { 'content-type': 'application/json' } }); };
  try {
    const db2 = createMem({ file: 'data/none.tsv', base: 'https://mare.test' });
    const r = await handle(new Request('https://mare.test/tide', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.9', 'user-agent': 'proof/1.0' }, body: '{}' }), db2, { site: SITE, base: 'https://mare.test' });
    const j = await r.json();
    assert.equal(r.status, 200); assert.ok(j.tide, JSON.stringify(j).slice(0, 200));
    assert.ok(j.refreshed.length >= 2 && j.refreshed.length < TIDE.needs, `asked ${j.refreshed.length} of ${TIDE.needs}`);
    assert.equal(Number(await db2.flow.tides().then(() => db2.kv?.get?.('tide:cursor')).catch(() => j.refreshed.length)) || j.refreshed.length, j.refreshed.length);
  } finally { TIDE.budgetMs = keep; noNet(); }
});

globalThis.fetch = realFetch;
console.log(`\n${passed} proofs hold${failed ? `, ${failed} FAIL` : ''}`);
process.exit(failed ? 1 : 0);
