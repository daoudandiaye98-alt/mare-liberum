// Mare Liberum · proof of the tidings (node/tidings.mjs): what really changed, and when.
// A page's fingerprint ignores what moves by itself (counts, clocks, scripts, styles, spacing) and sees words, links and
// structured data; no hub of the sea changes by itself between two looks; a live hub names no lastmod before the sea saw it
// change, then the day it changed (M3), and the index dates the hubs by the newest; IndexNow's second path waits for the
// daily run, posts at most every 3 hours and at most 10,000 addresses, and tells only what changed (hubs that changed, needs
// whose pick or price moved) and pages never told before, never a thin page; buy.xml dates a need by the last day its pick
// or price moved and leaves out a need the current found fewer than 3 offers for. No real post is ever made.
// Negative controls: each rule broken in a copy of node/, the check that guards it must fail there.
// Runs without the network: node tools/tidings-proof.mjs   (exit code 1 when a proof fails)
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, cpSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0, failed = 0;
const proof = async (name, fn) => { try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 4).join('\n       ')}`); } };

// ------------------------------------------------------------------ the network: only a fake IndexNow, which counts what it is sent
const BASE = 'https://mareliberum.dev', KEY = 'proofkey0123456789', TODAY = new Date().toISOString().slice(0, 10);
const POSTS = [];
globalThis.fetch = async (u, o = {}) => {
  if (String(u) === 'https://api.indexnow.org/indexnow' && o.method === 'POST') { POSTS.push(JSON.parse(o.body)); return new Response(null, { status: 202 }); }
  throw new Error(`the proof does not use the network: ${String(u).slice(0, 80)}`);
};

// ------------------------------------------------------------------ a tree: the modules of one copy of node/, with a small sea of its own
async function tree(dir) {
  const imp = (f) => import(pathToFileURL(join(dir, 'node', f)).href);
  const [core, td, hubs, flow, mem, ledger, pay] = await Promise.all(['core.mjs', 'tidings.mjs', 'hubs.mjs', 'flow.mjs', 'mem.mjs', 'ledger.mjs', 'pay.mjs'].map(imp));
  const sd = mkdtempSync(join(tmpdir(), 'mare-tidings-')), file = join(sd, 'sea.tsv');
  writeFileSync(file, ''); writeFileSync(join(sd, 'build.json'), JSON.stringify({ builtAt: '2026-11-20T10:00:00.000Z', entries: 0, lakes: {} }));
  const kv = flow.memoryKv(), db = mem.createMem({ file, base: BASE });
  const cfg = { base: BASE, pay: pay.payConfig({}), ledger: ledger.createLedger({}), kv, site: { '/llms.txt': { body: readFileSync(join(ROOT, 'site/llms.txt'), 'utf8'), type: 'text/plain; charset=utf-8' } }, indexnowKey: KEY };
  const call = async (path, headers = {}) => { const r = await core.handle(new Request(BASE + path, { headers: { 'user-agent': 'proof-agent/1.0', accept: 'text/html', 'x-forwarded-for': '198.18.3.4', ...headers } }), db, cfg); return { status: r.status, headers: r.headers, text: await r.text() }; };
  const own = (path) => call(path, { 'user-agent': 'MareLiberum-tidings/1.0', 'x-forwarded-for': '127.0.0.1' });
  const sea = () => core.seaOf(db, cfg, BASE);
  const T = td.createTidings({ kv });
  // move the clocks the paths read: the last look and the posts, so many hours ago
  const back = async (h) => { const t = new Date(Date.now() - h * 3600e3).toISOString(); await kv.set('tidings:last', { at: t }, 864000); const d = await kv.get(`indexnow:${TODAY}`); if (d) await kv.set(`indexnow:${TODAY}`, { ...d, at: t }, 864000); const c = await kv.get('indexnow:changed:last'); if (c) await kv.set('indexnow:changed:last', { ...c, at: t }, 864000); };
  const changed = () => core.indexNowChanged(db, BASE, sea(), cfg), daily = () => core.indexNowDaily(db, BASE, sea(), cfg);
  return { core, td, hubs, flow, kv, cfg, call, own, T, back, changed, daily, sea };
}
const prof = (d) => ({ d, s: 200, at: '2026-11-22T10:00:00.000Z', t: `${d} home`, ds: 'A shop', g: 'B' });
const paths = (post) => post.urlList.map((u) => u.slice(BASE.length) || '/');
const THIN = /^\/(check|atlas\/country|e)\/|^\/brief\/[^/]+\/./;

// ------------------------------------------------------------------ the checks (each throws when its rule is broken; the negative controls break them)
const checks = {
  fingerprint(t) {
    const f = t.td.fingerprint, page = (n, extra = '') => `<html><head><style>.a{color:#${n}}</style><script>var n=${n}</script><script type="application/ld+json">{"name":"Sea"}</script></head><body><h1>The market</h1><p>${n} verified stores, read ${n} minutes ago</p><a href="/brain/market">market</a>${extra}</body></html>`;
    assert.equal(f(page(7)), f(page(1234)), 'counts are no change');
    assert.equal(f(page(7).replace('minutes', 'hours')), f(page(7)), 'the clock is no change');
    assert.equal(f(page(7).replace('<p>', '<p>\n\n   ')), f(page(7)), 'spacing is no change');
    assert.notEqual(f(page(7, '<p>shop.example joined</p>')), f(page(7)), 'words are');
    assert.notEqual(f(page(7, '<a href="/site/shop.example">x</a>')), f(page(7, '<a href="/site/other.example">x</a>')), 'links are');
    assert.notEqual(f(page(7).replace('"Sea"', '"Sea of agents"')), f(page(7)), 'structured data is');
  },
  async stable(t) {
    // every hub, looked at twice as the sea looks at it, with time between (the clocks and counters move): no hub changes by
    // itself. (A hub that lists who came or what was asked, such as /visitors, changes with traffic, and then it did change.)
    const first = {};
    for (const p of t.hubs.HUB_PATHS) { const r = await t.own(p); if (r.status === 200) first[p] = t.td.fingerprint(r.text); }
    await new Promise((r) => setTimeout(r, 1500));
    const moved = [];
    for (const p of Object.keys(first)) { const r = await t.own(p); if (t.td.fingerprint(r.text) !== first[p]) moved.push(p); }
    assert.ok(Object.keys(first).length >= 60, `${Object.keys(first).length} hubs answered`); assert.deepEqual(moved, [], `hubs that changed by themselves: ${moved.join(' ')}`);
  },
  async look(t) {
    const T2 = t.td.createTidings({ kv: t.flow.memoryKv() });
    const a = await T2.look('/brain/market', '<p>one</p>'); assert.deepEqual(a, { path: '/brain/market', changed: false, day: null }, 'the first look knows no day');
    assert.equal((await T2.look('/brain/market', '<p>one</p>')).changed, false); assert.ok(!(await T2.queued()).includes('/brain/market'));
    const b = await T2.look('/brain/market', '<p>two</p>'); assert.equal(b.changed, true); assert.equal(b.day, TODAY); assert.ok((await T2.queued()).includes('/brain/market'), 'a change is queued for IndexNow');
    assert.equal(await T2.look('/not-a-hub', '<p>x</p>'), null, 'only hubs');
    assert.deepEqual(await T2.lastmods(), { '/brain/market': TODAY });
  },
  sitemap(t) {
    const { hubSitemap, hubsDay, STATIC_DAY, HUBS } = t.hubs, live = HUBS.find(([, , l]) => l)[0], fixed = HUBS.find(([, , l]) => !l)[0];
    const x0 = hubSitemap(BASE, TODAY, {});
    assert.ok(x0.includes(`<loc>${BASE}${live}</loc><changefreq>`), 'a live hub names no day before a change was seen');
    assert.ok(x0.includes(`<loc>${BASE}${fixed}</loc><lastmod>${STATIC_DAY}</lastmod>`), 'a hub of fixed words carries STATIC_DAY');
    assert.ok(!x0.includes(`<lastmod>${TODAY}</lastmod>`) || TODAY === STATIC_DAY, 'no hub dated today without a change');
    const x1 = hubSitemap(BASE, TODAY, { [live]: '2026-11-25', [fixed]: '2026-11-20', '/open': '2999-01-01' });
    assert.ok(x1.includes(`<loc>${BASE}${live}</loc><lastmod>2026-11-25</lastmod>`) || TODAY < '2026-11-25', 'a live hub: the day its change was seen');
    assert.ok(x1.includes(`<loc>${BASE}${fixed}</loc><lastmod>${STATIC_DAY}</lastmod>`), 'a fixed hub: never older than its release day');
    assert.ok(x1.includes(`<loc>${BASE}/open</loc><changefreq>`), 'no day from the future');
    assert.equal(hubsDay(TODAY, {}), STATIC_DAY); assert.equal(hubsDay(TODAY, { [live]: TODAY }), TODAY > STATIC_DAY ? TODAY : STATIC_DAY);
  },
  async indexnow(t) {
    POSTS.length = 0;
    const r0 = await t.changed(); assert.equal(r0.skipped, 'the daily run goes first'); assert.ok(r0.looked >= 60, `looked at ${r0.looked} hubs`); assert.equal(POSTS.length, 0);
    assert.equal((await t.changed()).skipped, 'looked within 3 hours', 'a look at most every 3 hours');
    const d = await t.daily(); assert.equal(d.status, 202); assert.ok(d.at); assert.equal(POSTS.length, 1);
    await t.back(4); const r1 = await t.changed(); assert.equal(POSTS.length, 1, 'no post right after a node starts');
    assert.match(r1.skipped || r1.note || '', /nothing changed|learned/, JSON.stringify(r1));
    // the tide moves things: a store joins the market (its hub changes), the current saw a need's price move, the Atlas mapped a new site
    await t.kv.set('market:s:verified-shop.example', { host: 'verified-shop.example', at: new Date().toISOString(), level: 2, as: 'verified', reasons: ['x'], ucp: { ok: true, name: 'Verified Shop' }, age: { since: '2020-01-01' } }, 864000);
    await t.kv.set('market:idx', { 'verified-shop.example': [2, TODAY, 'Verified Shop'] }, 864000);
    await t.T.queue(['/buy/running-shoes']);
    await t.kv.set('atlas:good-shop.example', prof('good-shop.example'), 864000); await t.kv.set('atlas:recent', ['good-shop.example'], 864000);
    await t.back(1); assert.equal((await t.changed()).skipped, 'looked within 3 hours'); assert.equal(POSTS.length, 1);
    await t.back(4); const r2 = await t.changed(); assert.equal(r2.status, 202, JSON.stringify(r2)); assert.equal(POSTS.length, 2);
    const sent = paths(POSTS[1]);
    for (const p of ['/brain/market', '/buy/running-shoes', '/site/good-shop.example']) assert.ok(sent.includes(p), `${p} told`);
    assert.ok(sent.length < 20, `only what changed: ${sent.length} (${sent.join(' ')})`); assert.ok(!sent.some((p) => THIN.test(p)), 'no thin page');
    assert.equal(POSTS[1].host, 'mareliberum.dev'); assert.equal(POSTS[1].key, KEY); assert.equal(POSTS[1].keyLocation, `${BASE}/${KEY}.txt`);
    const mods = (await t.kv.get('tidings:hubs')) || {}, hubsSent = sent.filter((p) => t.hubs.HUB_SET.has(p));
    assert.ok(hubsSent.includes('/brain/market') && hubsSent.every((p) => mods[p]?.day === TODAY), `only hubs that changed today are told: ${hubsSent.filter((p) => mods[p]?.day !== TODAY)}`);
    assert.deepEqual(await t.T.queued(), [], 'what was told leaves the queue');
    const j = JSON.parse((await t.call('/indexnow.json', { accept: 'application/json' })).text); assert.equal(j.changed?.length, 1); assert.equal(j.changed[0].sent, sent.length);
    // a look is due, but the last post was a moment ago: nothing is told yet
    await t.T.queue(['/buy/another-need']); await t.kv.set('tidings:last', { at: new Date(Date.now() - 4 * 3600e3).toISOString() }, 864000);
    const r3 = await t.changed(); assert.equal(r3.skipped, 'a post within 3 hours', JSON.stringify(r3)); assert.equal(POSTS.length, 2);
    // then only what changed since; and when nothing changed, nothing
    await t.back(4); await t.changed(); assert.equal(POSTS.length, 3); assert.deepEqual(paths(POSTS[2]), ['/buy/another-need']);
    await t.back(4); const r5 = await t.changed(); assert.equal(POSTS.length, 3, JSON.stringify(r5)); assert.equal(r5.sent, 0);
  },
  async cap(t) {
    if (!(await t.kv.get(`indexnow:${TODAY}`))?.sent) await t.daily();
    POSTS.length = 0; await t.back(4);
    const many = Array.from({ length: 12000 }, (_, i) => `/buy/need-${i}`); await t.T.queue(many);
    const a = await t.changed(); assert.equal(paths(POSTS[0]).length, 10000, `${POSTS[0]?.urlList.length} in one post`); assert.equal(a.sent, 10000);
    await t.back(4); await t.changed(); assert.equal(POSTS.length, 2); assert.equal(paths(POSTS[1]).length, 2000, 'the rest in the next post');
    assert.deepEqual(new Set([...paths(POSTS[0]), ...paths(POSTS[1])]), new Set(many), 'each once');
  },
  async buy(t) {
    assert.equal(t.core.buyMoved([{ t: '2026-11-20T10:00:00Z', price: 10, store: 'a' }, { t: '2026-11-21T10:00:00Z', price: 10, store: 'a' }, { t: '2026-11-22T10:00:00Z', price: 9, store: 'a' }, { t: '2026-11-23T10:00:00Z', price: 9, store: 'a' }]), '2026-11-22');
    assert.equal(t.core.buyMoved([{ t: '2026-11-20T10:00:00Z', price: 10, store: 'a' }]), '2026-11-20'); assert.equal(t.core.buyMoved(null), null);
    const { NEEDS, slugOf } = await import(pathToFileURL(join(ROOT, 'node/needs.mjs')).href), [a, b, c] = NEEDS.map(slugOf);
    await t.kv.set(`tide:${a}`, { t: '2026-11-23T10:00:00Z', offers: 2 }, 864000);
    await t.kv.set(`tide:${b}`, { t: '2026-11-23T10:00:00Z', offers: 5 }, 864000); await t.kv.set(`hist:${b}`, [{ t: '2026-11-21T10:00:00Z', price: 30, store: 's' }, { t: '2026-11-23T10:00:00Z', price: 30, store: 's' }], 864000);
    const x = (await t.call('/sitemaps/buy.xml')).text;
    assert.ok(!x.includes(`/buy/${a}<`), 'a need the current found fewer than 3 offers for is left out (its page says noindex)');
    assert.ok(x.includes(`<loc>${BASE}/buy/${b}</loc><lastmod>2026-11-21</lastmod>`), 'dated by the last move of pick or price');
    assert.ok(x.includes(`<loc>${BASE}/buy/${c}</loc><changefreq>`), 'never read: as before, without a day');
    assert.equal((x.match(/<url>/g) || []).length, NEEDS.length - 1);
  },
  async families(t) {
    // every family of pages has its map, each map holds at most 50,000 addresses, robots.txt names the index
    const idx = (await t.call('/sitemap.xml')).text;
    for (const m of ['hubs', 'site', 'briefs-i18n', 'buy', 'brain', 'sites-live']) assert.ok(idx.includes(`${BASE}/sitemaps/${m}.xml`), m);
    const src = readFileSync(join(ROOT, 'node/core.mjs'), 'utf8'); assert.match(src, /const PER_MAP = (\d+);/); assert.ok(Number(/const PER_MAP = (\d+);/.exec(src)[1]) <= 50000); assert.match(src, /ds\.slice\(0, 45000\)/);
    assert.match(readFileSync(join(ROOT, 'site/robots.txt'), 'utf8'), /^Sitemap: https:\/\/mareliberum\.dev\/sitemap\.xml$/m);
    const site = (await t.call('/sitemaps/site.xml')).text; assert.ok(site.includes(`<loc>${BASE}/status</loc>`), '/status, a page that stood in IndexNow only, has its place');
    const st = await t.call('/status', { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }); assert.equal(st.status, 200); assert.ok(!/noindex/.test(st.headers.get('x-robots-tag') || '') && !/<meta name="robots" content="[^"]*noindex/.test(st.text));
  },
};

// ------------------------------------------------------------------ the proofs
const T = await tree(ROOT);
console.log('what is a change');
await proof('the fingerprint: counts, clocks, scripts, styles and spacing are no change; words, links and structured data are', () => checks.fingerprint(T));
await proof('every hub, looked at twice as the sea looks at it (time between, nothing done): none changes by itself', () => checks.stable(T));
await proof('a look: the first knows no day; the same page is no change; a change is dated today and queued for IndexNow; only hubs', () => checks.look(T));
console.log('lastmod (M3)');
await proof('hubs.xml: a live hub names no day before a change was seen, then that day; a fixed hub never older than STATIC_DAY; no day from the future; the index takes the newest', () => checks.sitemap(T));
await proof('buy.xml: a need is dated by the last move of its pick or price; a need with fewer than 3 offers on the current is left out; a need never read stays, without a day', () => checks.buy(T));
await proof('every family has its map, each map at most 50,000 addresses, robots.txt names the index; /status is listed and indexable', () => checks.families(T));
console.log('IndexNow, the second path');
await proof('after the daily run, at most every 3 hours: only the hubs that changed, the needs that moved and pages never told; no thin page; the queue empties; /indexnow.json says so', () => checks.indexnow(T));
await proof('at most 10,000 addresses in one post; the rest in the next, each once', () => checks.cap(T));
console.log(`       ${POSTS.length} posts in the last check, all to the fake IndexNow; the network was never used`);

// ------------------------------------------------------------------ negative controls
console.log('negative controls: each rule broken in a copy of node/, the check that guards it must fail');
const MUTANTS = [
  ['digits count as a change', 'tidings.mjs', ".replace(/\\d+/g, '#')", '', 'fingerprint'],
  ['a live hub is dated today again (M3)', 'hubs.mjs', 'return live ? s : s && s > STATIC_DAY', 'return live ? today : s && s > STATIC_DAY', 'sitemap'],
  ['no 3 hours between two posts', 'core.mjs', 'if (now - lastPost < TIDINGS.everyMs) return', 'if (false) return', 'indexnow'],
  ['more than 10,000 in one post', 'core.mjs', '.slice(0, TIDINGS.perPost);', ';', 'cap'],
  ['what was told stays in the queue', 'core.mjs', 'if (r.status >= 200 && r.status < 300) { await t.sent(paths); await t.known(fresh); }', 'if (r.status >= 200 && r.status < 300) { await t.known(fresh); }', 'indexnow'],
  ['every hub is told, changed or not', 'core.mjs', 'const paths = [...new Set([...queued, ...fresh])]', 'const paths = [...new Set([...queued, ...fresh, ...fam.hubs])]', 'indexnow'],
  ['buy.xml keeps the thin needs', 'core.mjs', 'if (snap && Number.isFinite(snap.offers) && snap.offers < 3) return \'\';', '', 'buy'],
];
for (const [what, file, from, to, check] of MUTANTS) {
  await proof(`broken: ${what} → ${check} fails`, async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mare-tidings-mut-'));
    try {
      cpSync(join(ROOT, 'node'), join(dir, 'node'), { recursive: true });
      for (const d of ['proof', 'public', 'site']) symlinkSync(join(ROOT, d), join(dir, d));
      const f = join(dir, 'node', file), src = readFileSync(f, 'utf8'); assert.equal(src.split(from).length, 2, `the place to break is found once in ${file}`);
      writeFileSync(f, src.replace(from, to));
      const m = await tree(dir); let held = false;
      try { await checks[check](m); held = true; } catch { /* the check caught it */ }
      assert.equal(held, false, `${check} still holds with the rule broken: it proves nothing`);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
}

console.log(`\n${passed} held, ${failed} failed`);
process.exit(failed ? 1 : 0);
