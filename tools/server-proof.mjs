// Mare Liberum · proof of the node that stands alone: the copy on disk, the shelf of ready answers, countries by
// address, the release check, the server itself and the updater that fetches a build, runs it and takes it back.
// Runs without the network (only this machine): node tools/server-proof.mjs   (exit code 1 when a proof fails)
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, existsSync, rmSync, cpSync, readlinkSync, chmodSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { diskKv } from '../node/disk.mjs';
import { createShelf } from '../node/shelf.mjs';
import { packGeo, loadGeo } from '../node/geoip.mjs';
import { hayOf, metaOf } from '../node/mem.mjs';
import { compare } from './release.mjs';
import { handle } from '../node/core.mjs';
import { createMem } from '../node/mem.mjs';
import { memoryKv } from '../node/flow.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0, failed = 0;
const proof = async (name, fn) => { try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 5).join('\n       ')}`); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tmp = mkdtempSync(join(tmpdir(), 'mare-proof-'));
const freePort = () => new Promise((res) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const until = async (fn, ms = 15000) => { const end = Date.now() + ms; for (;;) { try { const v = await fn(); if (v) return v; } catch {} if (Date.now() > end) throw new Error('waited too long'); await sleep(150); } };

// ------------------------------------------------------------------ the copy on disk
console.log('the copy on disk');
await proof('what was set is there again after a restart; what has ended or ends soon is not', async () => {
  const f = join(tmp, 'a', 'sea.ndjson');
  let t = 1_000_000;
  const a = diskKv(f, { everyMs: 1e9, now: () => t }); await a.ready;
  await a.set('stays', { n: 1, list: [1, 2, 3], text: 'Grüße · 海' });
  await a.set('long', 'x', 3600);
  await a.set('soon', 'y', 60);             // ends within two minutes: not worth writing
  await a.set('lock', 1, 5);
  assert.equal(await a.close(), 2);
  t += 10_000;
  const b = diskKv(f, { everyMs: 1e9, now: () => t }); assert.equal(await b.ready, 2);
  assert.deepEqual(await b.get('stays'), { n: 1, list: [1, 2, 3], text: 'Grüße · 海' });
  assert.equal(await b.get('long'), 'x'); assert.equal(await b.get('soon'), null);
  t += 3600_000; assert.equal(await b.get('long'), null, 'a name ends at its time, also after a restart');
  await b.close();
});
await proof('names another memory keeps are left out of the copy; a value handed out cannot change the stored one', async () => {
  const f = join(tmp, 'b', 'sea.ndjson');
  const a = diskKv(f, { everyMs: 1e9, skip: (k) => k.startsWith('brain:') }); await a.ready;
  const v = { n: 1 }; await a.set('census:x', v); v.n = 99; const got = await a.get('census:x'); got.n = 7;
  assert.deepEqual(await a.get('census:x'), { n: 1 });
  await a.set('brain:p:1', { kept: 'elsewhere' });
  assert.equal(await a.close(), 1);
  assert.ok(!readFileSync(f, 'utf8').includes('brain:p:1'));
  const b = diskKv(f, { everyMs: 1e9 }); await b.ready; assert.equal(await b.get('brain:p:1'), null); await b.close();
});
await proof('a broken line costs that line only; names that ended are let go at the next pass', async () => {
  const f = join(tmp, 'c', 'sea.ndjson'); mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, `["good",0,{"a":1}]\n{not json\n["old",5,"gone"]\n\n["also",0,[1]]\n`);
  let t = 1000; const a = diskKv(f, { everyMs: 1e9, now: () => t }); assert.equal(await a.ready, 2);
  await a.set('short', 1, 1); t += 5000;
  assert.equal(a.state().names, 3); await a.save(); assert.equal(a.state().names, 2);
  await a.close();
});
await proof('a large sea is written without holding callers up', async () => {
  const f = join(tmp, 'd', 'sea.ndjson'); const a = diskKv(f, { everyMs: 1e9 }); await a.ready;
  const big = { text: 'x'.repeat(2000) }; for (let i = 0; i < 20000; i++) await a.set(`k:${i}`, big);
  let ticks = 0; const iv = setInterval(() => ticks++, 1);
  const n = await a.save(); clearInterval(iv);
  assert.equal(n, 20000); assert.ok(ticks >= 5, `the loop turned ${ticks} times while 40 MB were written`);
  const b = diskKv(f, { everyMs: 1e9 }); assert.equal(await b.ready, 20000); await a.close(); await b.close();
});

// ------------------------------------------------------------------ the shelf
console.log('the shelf of ready answers');
const req = (path, h = {}) => new Request(`https://mare.test${path}`, { headers: h });
const res = (body, cc, status = 200, extra = {}) => new Response(body, { status, headers: { 'content-type': 'text/html', ...(cc ? { 'cache-control': cc } : {}), ...extra } });
await proof('an answer with s-maxage is kept for that time; one without is not', async () => {
  let t = 0; const s = createShelf({ now: () => t });
  assert.equal(s.take(req('/buy'), '/buy', 'browser'), null);
  const first = await s.keep(req('/buy'), '/buy', 'browser', res('<p>one</p>', 'public, max-age=300, s-maxage=3600'));
  assert.equal(await first.text(), '<p>one</p>');
  t = 3599_000; const hit = s.take(req('/buy'), '/buy', 'browser');
  assert.ok(hit?.fresh); assert.equal(hit.res.headers.get('x-mare-shelf'), 'hit'); assert.equal(hit.res.headers.get('age'), '3599'); assert.equal(await hit.res.text(), '<p>one</p>');
  t = 3601_000; assert.equal(s.take(req('/buy'), '/buy', 'browser'), null);
  await s.keep(req('/x'), '/x', 'browser', res('no', 'public, max-age=600'));
  assert.equal(s.take(req('/x'), '/x', 'browser'), null);
});
await proof('errors, private answers and cookies are never kept', async () => {
  const s = createShelf();
  await s.keep(req('/a'), '/a', 'b', res('gone', 'public, s-maxage=60', 404));
  await s.keep(req('/b'), '/b', 'b', res('mine', 'private, s-maxage=60'));
  await s.keep(req('/c'), '/c', 'b', res('cookie', 'public, s-maxage=60', 200, { 'set-cookie': 'a=1' }));
  await s.keep(req('/d'), '/d', 'b', res('zero', 'public, s-maxage=0'));
  for (const p of ['/a', '/b', '/c', '/d']) assert.equal(s.take(req(p), p, 'b'), null, p);
});
await proof('the query, what the caller accepts and the kind of caller each get their own answer', async () => {
  const s = createShelf(), cc = 'public, s-maxage=60';
  await s.keep(req('/buy/shoes?country=DE'), '/buy/shoes', 'browser', res('de', cc));
  await s.keep(req('/buy/shoes', { accept: 'application/json' }), '/buy/shoes', 'tool', res('json', cc));
  assert.equal(s.take(req('/buy/shoes?country=FR'), '/buy/shoes', 'browser'), null);
  assert.equal(s.take(req('/buy/shoes?country=DE'), '/buy/shoes', 'ai-crawler'), null);
  assert.equal(s.take(req('/buy/shoes', { accept: 'text/html' }), '/buy/shoes', 'tool'), null);
  assert.equal(await s.take(req('/buy/shoes?country=DE'), '/buy/shoes', 'browser').res.text(), 'de');
  assert.equal(await s.take(req('/buy/shoes', { accept: 'application/json' }), '/buy/shoes', 'tool').res.text(), 'json');
});
await proof('past its time an answer is handed out once more while one caller makes the new one', async () => {
  let t = 0; const s = createShelf({ now: () => t });
  await s.keep(req('/site/x'), '/site/x', 'b', res('old', 'public, s-maxage=100, stale-while-revalidate=1000'));
  t = 150_000;
  const one = s.take(req('/site/x'), '/site/x', 'b'), two = s.take(req('/site/x'), '/site/x', 'b');
  assert.equal(one.fresh, false, 'the first caller past the time makes the new answer');
  assert.equal(two.fresh, true, 'the second one does not make it again');
  assert.equal(await one.res.text(), 'old'); assert.equal(one.res.headers.get('x-mare-shelf'), 'stale');
  await s.keep(req('/site/x'), '/site/x', 'b', res('new', 'public, s-maxage=100, stale-while-revalidate=1000'));
  const three = s.take(req('/site/x'), '/site/x', 'b'); assert.ok(three.fresh); assert.equal(await three.res.text(), 'new');
  t = 150_000 + 1200_000; assert.equal(s.take(req('/site/x'), '/site/x', 'b'), null, 'past the stale time nothing is handed out');
});
await proof('the shelf has a size: the answers nobody asked for longest make room', async () => {
  const s = createShelf({ maxBytes: 5000, maxBody: 2000 }), cc = 'public, s-maxage=60';
  for (const p of ['/1', '/2', '/3']) await s.keep(req(p), p, 'b', res('x'.repeat(1000), cc));
  assert.ok(s.take(req('/1'), '/1', 'b'));                          // /1 was asked for again
  for (const p of ['/4', '/5']) await s.keep(req(p), p, 'b', res('x'.repeat(1000), cc));
  assert.ok(s.state().bytes <= 5000);
  assert.equal(s.take(req('/2'), '/2', 'b'), null); assert.ok(s.take(req('/1'), '/1', 'b')); assert.ok(s.take(req('/5'), '/5', 'b'));
  const big = await s.keep(req('/big'), '/big', 'b', res('y'.repeat(3000), cc));
  assert.equal((await big.text()).length, 3000, 'an answer too large for the shelf is still handed to its caller'); assert.equal(s.take(req('/big'), '/big', 'b'), null);
});
await proof('the node counts every caller and still answers from the shelf', async () => {
  const kv = memoryKv(), shelf = createShelf(), db = createMem({ file: 'data/none.tsv', base: 'https://mare.test' });
  const ask = () => handle(new Request('https://mare.test/buy', { headers: { 'user-agent': 'Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)', 'x-forwarded-for': '203.0.113.5' } }), db, { kv, shelf, base: 'https://mare.test' });
  const a = await ask(), b = await ask(), c = await ask();
  assert.equal(a.headers.get('x-mare-shelf'), null); assert.equal(b.headers.get('x-mare-shelf'), 'hit'); assert.equal(await a.text(), await c.text());
  await sleep(50);
  const day = await kv.get(`census:${new Date().toISOString().slice(0, 10)}`);
  assert.equal(day?.kinds?.['ai-crawler'], 3, JSON.stringify(day));
  const post = await handle(new Request('https://mare.test/buy', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } }), db, { kv, shelf, base: 'https://mare.test' });
  assert.equal(post.headers.get('x-mare-shelf'), null, 'only GET is answered from the shelf');
});

// ------------------------------------------------------------------ countries by address
console.log('the country a caller stands in');
await proof('addresses find their country; gaps, unknown rows and other spellings do not mislead', async () => {
  const f = join(tmp, 'geo.bin.gz');
  writeFileSync(f, packGeo([
    ['1.0.0.0', '1.0.0.255', 'AU'], ['1.0.1.0', '1.0.3.255', 'CN'], ['1.0.4.0', '1.0.7.255', 'AU'], ['0.0.0.0', '0.255.255.255', 'ZZ'],
    ['8.8.8.0', '8.8.8.255', 'US'], ['8.8.9.0', '8.8.9.255', 'US'], ['203.0.113.0', '203.0.113.255', 'de'], ['255.255.255.0', '255.255.255.255', 'FR'],
    ['2001:200::', '2001:200:ffff:ffff:ffff:ffff:ffff:ffff', 'JP'], ['2a01:4f8::', '2a01:4f9:ffff:ffff:ffff:ffff:ffff:ffff', 'DE'], ['2c0f:fe00::', '2c0f:ffff:ffff:ffff:ffff:ffff:ffff:ffff', 'SN'],
    ['bad', 'row', 'XX'], ['9.9.9.9', '9.9.9.1', 'US'],
  ], '2026-11'));
  const of = loadGeo(f);
  assert.equal(of('1.0.0.7'), 'AU'); assert.equal(of('1.0.2.2'), 'CN'); assert.equal(of('1.0.7.255'), 'AU');
  assert.equal(of('1.0.8.0'), '', 'after the last row of a block nothing is known'); assert.equal(of('0.1.2.3'), '', 'ZZ means unknown');
  assert.equal(of('8.8.9.200'), 'US'); assert.equal(of('8.8.10.1'), ''); assert.equal(of('203.0.113.9'), 'DE'); assert.equal(of('255.255.255.255'), 'FR');
  assert.equal(of('::ffff:8.8.8.8'), 'US'); assert.equal(of('[2a01:4f8:c0c:1234::1]'), 'DE'); assert.equal(of('2A01:4F9:FFFF::1'), 'DE');
  assert.equal(of('2001:200:0:1::1'), 'JP'); assert.equal(of('2001:201::1'), ''); assert.equal(of('2c0f:feb0:1::9'), 'SN'); assert.equal(of('fe80::1%eth0'), '');
  for (const junk of ['', 'unknown', '1.2.3', '300.1.1.1', ':::', '1.2.3.4.5', null, undefined]) assert.equal(of(junk), '', String(junk));
  assert.equal(of.at, '2026-11'); assert.ok(of.rows > 8); assert.match(of.source, /DB-IP/);
  assert.equal(loadGeo(join(tmp, 'none.bin.gz')), null);
});
await proof('a table of a million rows is made small and answers in microseconds', async () => {
  const rows = []; for (let i = 0; i < 400000; i++) { const a = 16777216 + i * 4096, ip = (n) => `${n >>> 24}.${(n >>> 16) & 255}.${(n >>> 8) & 255}.${n & 255}`; rows.push([ip(a), ip(a + 4095), ['US', 'DE', 'SN', 'JP', 'BR'][i % 5]]); }
  const f = join(tmp, 'geo-big.bin.gz'), packed = packGeo(rows, 'x'); writeFileSync(f, packed);
  assert.ok(packed.length < 3_000_000, `${packed.length} bytes`);
  const of = loadGeo(f), t0 = performance.now(); let n = 0;
  for (let i = 0; i < 200000; i++) if (of(`${1 + (i % 200)}.${i % 256}.${(i * 7) % 256}.9`)) n++;
  assert.ok(performance.now() - t0 < 1500, `${Math.round(performance.now() - t0)} ms for 200,000 lookups`); assert.ok(n > 1000);
  assert.equal(of('1.0.0.1'), 'US'); assert.equal(of('1.0.16.1'), 'DE');
});
await proof('the node uses its own table for the country and does not believe a header', async () => {
  const kv = memoryKv(), db = createMem({ file: 'data/none.tsv', base: 'https://mare.test' });
  const f = join(tmp, 'geo.bin.gz'), geoOf = loadGeo(f);
  await handle(new Request('https://mare.test/llms.txt', { headers: { 'user-agent': 'ClaudeBot/1.0', 'x-forwarded-for': '203.0.113.5', 'x-vercel-ip-country': 'US' } }), db, { kv, geoOf, base: 'https://mare.test' });
  await handle(new Request('https://mare.test/llms.txt', { headers: { 'user-agent': 'ClaudeBot/1.0', 'x-forwarded-for': '198.51.100.1', 'x-vercel-ip-country': 'US' } }), db, { kv, geoOf, base: 'https://mare.test' });
  await sleep(50);
  const day = await kv.get(`census:${new Date().toISOString().slice(0, 10)}`);
  assert.deepEqual(day?.cc, { DE: 1 }, JSON.stringify(day?.cc));
});

// ------------------------------------------------------------------ the release check
console.log('the release check');
await proof('a build that lost much of the sea is held back; an ordinary day is not', () => {
  const before = { entries: 380000, lakes: { erc8004: 206000, 'ucp-stores': 21936, 'a2a-registry': 663, 'mcp-registry': 82000 } };
  assert.deepEqual(compare({ entries: 381000, lakes: { erc8004: 207000, 'ucp-stores': 21000, 'a2a-registry': 12, 'mcp-registry': 83000 } }, before), []);
  assert.equal(compare({ entries: 175000, lakes: { erc8004: 0, 'ucp-stores': 21936, 'mcp-registry': 82000 } }, before).length, 2);
  assert.equal(compare({ entries: 370000, lakes: { erc8004: 206000, 'ucp-stores': 'pending: lake_unreachable', 'mcp-registry': 82000 } }, before).length, 1);
  assert.deepEqual(compare({ entries: 5000, lakes: {} }, null), []);
});

// ------------------------------------------------------------------ the server itself and the updater
console.log('the server and the updater');
// a small sea, packed the way the workflow packs the real one
function makeRelease(dir, id, { entries = 1200, broken = false } = {}) {
  const src = join(dir, `src-${id}`); mkdirSync(join(src, 'data', 'site'), { recursive: true });
  for (const f of ['serve.mjs', 'package.json', 'node', 'site', 'public', 'deploy']) cpSync(join(root, f), join(src, f), { recursive: true });
  if (broken) writeFileSync(join(src, 'serve.mjs'), 'process.exit(1);\n');
  const lines = [];
  for (let i = 0; i < entries; i++) { const r = { id: `urn:air:proof${String(i).padStart(5, '0')}.example:mcp:x`, display_name: `Proof server ${i}`, type: 'application/mcp-server-card+json', url: `https://proof${i}.example/mcp`, kind: 'mcp', source: 'proof', publisher: `proof${i}.example`, description: 'made for the proof' }; lines.push(`${r.id}\t${metaOf(r)}\t${hayOf(r)}\t${JSON.stringify(r)}`); }
  writeFileSync(join(src, 'data', 'sea.tsv.gz'), gzipSync(lines.sort().join('\n') + '\n'));
  writeFileSync(join(src, 'data', 'build.json'), JSON.stringify({ builtAt: new Date().toISOString(), entries, lakes: { proof: entries } }));
  for (const f of ['index.html', 'llms.txt', 'robots.txt']) cpSync(join(root, 'site', f), join(src, 'data', 'site', f));
  const out = join(dir, 'pub'); mkdirSync(out, { recursive: true });
  execFileSync('tar', ['-czf', join(out, 'sea.tar.gz'), '-C', src, '.']);
  writeFileSync(join(out, 'release.json'), JSON.stringify({ id, entries, sha256: createHash('sha256').update(readFileSync(join(out, 'sea.tar.gz'))).digest('hex') }));
  return src;
}
const rel = join(tmp, 'rel'); mkdirSync(rel);
const first = makeRelease(rel, 'r1');
const stateDir = join(tmp, 'state'), port = await freePort();
const get = (path, opt = {}) => fetch(`http://127.0.0.1:${opt.port || port}${path}`, { ...opt, headers: { 'user-agent': 'MareLiberum-proof/1.0', ...(opt.headers || {}) } });
let child = null;
const start = (dir = first, env = {}) => { child = spawn(process.execPath, ['serve.mjs'], { cwd: dir, env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', MARE_STATE: stateDir, MARE_PROXY: '1', MARE_BASE: 'https://mare.test', MARE_DB_URL: '', MARE_DB_KEY: '', MARE_DB_SECRET: '', ...env }, stdio: ['ignore', 'pipe', 'pipe'] }); child.out = ''; child.stdout.on('data', (d) => { child.out += d; }); child.stderr.on('data', (d) => { child.out += d; }); return until(() => get('/stats').then((r) => r.ok)); };
const stop = () => new Promise((res) => { if (!child || child.exitCode !== null) return res(); child.once('exit', res); child.kill('SIGTERM'); });

await proof('the node starts from a packed build, answers GET and HEAD, serves the files beside it and nothing outside', async () => {
  await start();
  const stats = await (await get('/stats')).json(); assert.equal(stats.entries, 1200);
  const home = await get('/'); assert.equal(home.status, 200); assert.match(home.headers.get('content-type'), /text\/html/); assert.match(await home.text(), /https:\/\/mare\.test/);
  const head = await get('/', { method: 'HEAD' }); assert.equal(head.status, 200); assert.equal(await head.text(), ''); assert.match(head.headers.get('link') || '', /llms\.txt/);
  const file = await get('/google7333cfe4c3fb5c26.html'); assert.equal(file.status, 200); assert.match(await file.text(), /google-site-verification/);
  const font = await get('/ucp/agent.json'); assert.equal(font.status, 200); assert.match(font.headers.get('content-type'), /json/);
  for (const p of ['/../package.json', '/%2e%2e/package.json', '/..%2fserve.mjs', '/.gitignore']) { const r = await fetch(`http://127.0.0.1:${port}${p}`, { headers: { 'user-agent': 'MareLiberum-proof/1.0' } }); assert.ok(r.status === 404 || r.status === 400, `${p} → ${r.status}`); assert.ok(!(await r.text()).includes('"dependencies"')); }
  const e = await get('/e/proof00007.example:mcp:x'); assert.equal(e.status, 200); assert.match(await e.text(), /Proof server 7/);
});
await proof('a caller cannot claim an address or a country; the web server in front is believed', async () => {
  for (let i = 0; i < 3; i++) await get('/llms.txt', { headers: { 'user-agent': 'ClaudeBot/1.0 (+claudebot@anthropic.com)', 'x-forwarded-for': '6.6.6.6, 203.0.113.7', 'x-vercel-ip-country': 'XX' } });
  const census = await until(async () => { const j = await (await get('/census')).json(); return j.today?.kinds?.['ai-crawler'] === 3 ? j : null; });
  assert.equal(census.today.top[0].name, 'Anthropic ClaudeBot');
  assert.ok(!JSON.stringify(census).includes('XX'));
});
await proof('a body that is too large is refused; an ordinary POST is answered', async () => {
  const big = await get('/mcp', { method: 'POST', body: 'x'.repeat(6 * 1024 * 1024), headers: { 'content-type': 'application/json' } }).catch((e) => ({ status: 413, gone: String(e) }));
  assert.equal(big.status, 413);
  const init = await get('/mcp', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'mare-proof', version: '1' } } }) });
  assert.equal(init.status, 200); assert.match(await init.text(), /mare-liberum/);
});
await proof('asked to stop, the node writes its copy; started again, the day goes on where it was', async () => {
  await stop(); assert.match(child.out, /closing/); assert.ok(existsSync(join(stateDir, 'sea.ndjson')));
  assert.match(readFileSync(join(stateDir, 'sea.ndjson'), 'utf8'), /"census:\d{4}-\d\d-\d\d"/);
  await start(); assert.match(child.out, /state on disk \(\d+ names read\)/);
  const j = await (await get('/census')).json(); assert.equal(j.today.kinds['ai-crawler'], 3);
  await stop();
});

// the updater, with a stand-in for systemctl that starts and stops the node of this proof
const pubPort = await freePort(); const served = join(rel, 'pub');
const files = createServer((q, s) => { try { const b = readFileSync(join(served, q.url.split('?')[0])); s.writeHead(200); s.end(b); } catch { s.writeHead(404); s.end(); } }).listen(pubPort, '127.0.0.1');
// one stand-in server: its own folders, its own port, its own "systemctl"
function standIn(name, nodePort, more = {}) {
  const ops = join(tmp, `${name}-ops`), srv = join(tmp, `${name}-srv`), fake = join(tmp, `${name}-systemctl`); mkdirSync(ops); mkdirSync(srv);
  writeFileSync(fake, `#!/usr/bin/env bash
# stand-in for systemctl in the proof: "restart mare" stops the node that runs and starts the one in current/
exec 9>&-   # what this starts must not hold the updater's lock (systemd never does)
pidf="${ops}/node.pid"
case "$1 $2" in
  "restart mare") [ -f "$pidf" ] && kill "$(cat "$pidf")" 2>/dev/null; for i in $(seq 1 100); do [ -f "$pidf" ] && kill -0 "$(cat "$pidf")" 2>/dev/null || break; sleep 0.1; done
     ( cd "${srv}/current" && PORT=${nodePort} HOST=127.0.0.1 MARE_STATE="${stateDir}-${name}" MARE_BASE=https://mare.test exec "${process.execPath}" serve.mjs >> "${ops}/node.log" 2>&1 ) &
     echo $! > "$pidf" ;;
  "is-active mare") [ -f "$pidf" ] && kill -0 "$(cat "$pidf")" 2>/dev/null && echo active || echo inactive ;;
  "show mare") echo 0 ;;
  *) : ;;
esac
exit 0
`); chmodSync(fake, 0o755);
  // the updater asks this very process for its files, so it must not hold the loop while it runs
  const env = { ...process.env, NO_PROXY: '127.0.0.1,localhost', no_proxy: '127.0.0.1,localhost', MARE_RELEASE_URL: `http://127.0.0.1:${pubPort}`, MARE_RAW_URL: `http://127.0.0.1:${pubPort}/raw`, MARE_ROOT: srv, MARE_OPS: ops, MARE_ENV: join(tmp, `${name}-env`), MARE_SETUP: join(tmp, `${name}-setup`), MARE_PORT: String(nodePort), MARE_SYSTEMCTL: fake, MARE_APPLY: '0', MARE_BUILDER: '', ...more };
  const update = (extra = {}) => new Promise((res) => { const c = spawn('bash', [...(process.env.MARE_PROOF_TRACE ? ['-x'] : []), join(root, 'deploy', 'update.sh')], { env: { ...env, ...extra }, stdio: ['ignore', 'pipe', 'pipe'] }); let out = ''; c.stdout.on('data', (d) => { out += d; }); c.stderr.on('data', (d) => { out += d; }); c.on('exit', (status) => { if (process.env.MARE_PROOF_TRACE) writeFileSync(process.env.MARE_PROOF_TRACE, `\n===== run, exit ${status}\n${out}`, { flag: 'a' }); res({ status, out }); }); });
  return { ops, srv, env, update, port: nodePort, said: () => readFileSync(join(srv, 'boot', 'status.txt'), 'utf8'), live: () => readlinkSync(join(srv, 'current')), state: () => JSON.parse(readFileSync(join(srv, 'boot', 'status.json'), 'utf8')),
    stats: () => until(() => get('/stats', { port: nodePort }).then((x) => (x.ok ? x.json() : null))), kill: () => { try { process.kill(Number(readFileSync(join(ops, 'node.pid'), 'utf8'))); } catch {} } };
}
const hasTools = ['bash', 'jq', 'curl', 'tar', 'flock', 'sha256sum', 'git'].every((t) => spawnSync('bash', ['-c', `command -v ${t}`]).status === 0);
if (!hasTools) console.log('  skip the updater proofs: bash, jq, curl, tar, flock, sha256sum and git are needed');
else {
  // ---- a finished build, fetched
  const A = standIn('fetch', port, { MARE_SOURCE: 'release' });
  await proof('the updater fetches a finished build, checks its sum, runs it and says how the server is doing', async () => {
    const r = await A.update(); assert.equal(r.status, 0, r.out);
    assert.match(A.said(), /build r1 runs \(1200 entries\)/);
    assert.equal(readFileSync(join(A.ops, 'release-id'), 'utf8').trim(), 'r1'); assert.match(A.live(), /releases\/r1$/);
    assert.equal((await A.stats()).entries, 1200);
    const st = A.state(); assert.equal(st.release, 'r1'); assert.equal(st.node, 'active'); assert.equal(st.longMemory, 'off'); assert.equal(st.source, 'release');
    const again = await A.update(); assert.equal(again.status, 0); assert.equal(A.said().match(/build r1 found/g).length, 1, 'the same build is not fetched twice');
  });
  await proof('a newer build takes over, and the day\'s count goes with it', async () => {
    for (let i = 0; i < 3; i++) await get('/llms.txt', { port: A.port, headers: { 'user-agent': 'ClaudeBot/1.0 (+claudebot@anthropic.com)' } });
    await until(async () => (await (await get('/census', { port: A.port })).json()).today?.kinds?.['ai-crawler'] === 3);
    makeRelease(rel, 'r2', { entries: 1500 });
    const r = await A.update(); assert.equal(r.status, 0, r.out);
    assert.match(A.said(), /build r2 runs \(1500 entries\)/);
    assert.equal((await A.stats()).entries, 1500);
    assert.equal((await (await get('/census', { port: A.port })).json()).today.kinds['ai-crawler'], 3);
  });
  await proof('a build that does not come up is taken back; the one before runs on and the bad one is not tried again', async () => {
    makeRelease(rel, 'r3', { broken: true });
    await A.update({ MARE_HEALTH_TRIES: '4' });
    assert.match(A.said(), /build r3 did not come up healthy; taking it back/); assert.match(A.said(), /the build before runs again/);
    assert.match(A.live(), /releases\/r2$/); assert.equal(readFileSync(join(A.ops, 'release-bad'), 'utf8').trim(), 'r3');
    assert.equal((await A.stats()).entries, 1500);
    await A.update({ MARE_HEALTH_TRIES: '4' }); assert.equal(A.said().match(/build r3 found/g).length, 1);
  });
  await proof('a file that does not match its sum, or a build that is not whole, is left alone', async () => {
    makeRelease(rel, 'r4', { entries: 1300 });
    const m = JSON.parse(readFileSync(join(rel, 'pub', 'release.json'), 'utf8')); writeFileSync(join(rel, 'pub', 'release.json'), JSON.stringify({ ...m, sha256: '0'.repeat(64) }));
    await A.update(); assert.match(A.said(), /does not match its sum yet/); assert.match(A.live(), /releases\/r2$/);
    makeRelease(rel, 'r5', { entries: 40 });
    await A.update(); assert.match(A.said(), /build r5 is not whole \(entries: 40\)/); assert.match(A.live(), /releases\/r2$/);
    writeFileSync(join(rel, 'pub', 'release.json'), JSON.stringify({ id: '../../etc', sha256: 'x' })); await A.update(); assert.match(A.said(), /strange name/);
  });
  await proof('the rescue line runs a changed file once, and not the one that was there when the server was made', async () => {
    mkdirSync(join(rel, 'pub', 'raw'), { recursive: true });
    writeFileSync(join(rel, 'pub', 'raw', 'rescue.sh'), 'exit 0\n'); await A.update();
    assert.ok(!A.said().includes('rescue: running'));
    writeFileSync(join(rel, 'pub', 'raw', 'rescue.sh'), `echo mended > "${join(tmp, 'mended')}"\n`); await A.update(); await A.update();
    assert.equal(readFileSync(join(tmp, 'mended'), 'utf8').trim(), 'mended'); assert.equal(A.said().match(/rescue: running/g).length, 1);
  });
  await proof('the long memory is set once the database knows the server, and the secret goes nowhere else', async () => {
    let asked = 0, got = null;
    const cfg = createServer((q, s) => { let b = ''; q.on('data', (d) => { b += d; }); q.on('end', () => { asked++; got = JSON.parse(b || '{}'); if (asked < 2) { s.writeHead(403); return s.end('{"error":"not allowed"}'); } s.writeHead(200, { 'content-type': 'application/json' }); s.end(JSON.stringify({ url: 'https://db.example', key: 'public-key' })); }); });
    const cfgPort = await freePort(); await new Promise((r) => cfg.listen(cfgPort, '127.0.0.1', r));
    writeFileSync(A.env.MARE_ENV, 'MARE_BASE=https://mare.test\nMARE_DB_SECRET=s3cret-of-this-server-0123456789abcdef\n'); writeFileSync(A.env.MARE_SETUP, `MARE_SOURCE=release\nMARE_CONFIG_URL=http://127.0.0.1:${cfgPort}/config\n`);
    await A.update(); assert.ok(!readFileSync(A.env.MARE_ENV, 'utf8').includes('MARE_DB_KEY'), 'not before the database knows the server');
    await A.update(); const env = readFileSync(A.env.MARE_ENV, 'utf8');
    assert.match(env, /^MARE_DB_URL=https:\/\/db\.example$/m); assert.match(env, /^MARE_DB_KEY=public-key$/m); assert.equal(got.secret, 's3cret-of-this-server-0123456789abcdef');
    await A.update(); assert.equal(asked, 2, 'once it is set, the database is not asked again');
    assert.ok(!A.said().includes('s3cret'), 'the secret is not in what the server says about itself'); assert.equal(A.state().longMemory, 'on');
    cfg.close();
  });
  A.kill();

  // ---- a build made on the server itself, from the repository (the default)
  const repo = join(tmp, 'repo'), git = (...a) => execFileSync('git', ['-C', repo, '-c', 'user.name=proof', '-c', 'user.email=proof@mare.test', ...a], { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
  // the repository of the proof: the real node, and a build that writes a small sea the way tools/build.mjs writes the real one
  const commit = (msg, { entries = 1200, proofHolds = true, crash = false } = {}) => {
    mkdirSync(join(repo, 'tools'), { recursive: true });
    for (const f of ['serve.mjs', 'package.json', 'node', 'site', 'public', 'deploy']) cpSync(join(root, f), join(repo, f), { recursive: true });
    cpSync(join(root, 'tools', 'release.mjs'), join(repo, 'tools', 'release.mjs'));
    writeFileSync(join(repo, 'tools', 'doors-proof.mjs'), `process.exit(${proofHolds ? 0 : 1});\n`);
    writeFileSync(join(repo, 'store-pages.json'), '{}');
    writeFileSync(join(repo, 'tools', 'build.mjs'), `import { mkdirSync, writeFileSync, cpSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { hayOf, metaOf } from '../node/mem.mjs';
if (${crash}) { console.log('lake_unreachable'); process.exit(3); }
if (process.env.MARE_DB_SECRET || process.env.SECRET_OF_ROOT) throw new Error('the build was handed something it must not see');
const entries = ${entries}, lines = [];
for (let i = 0; i < entries; i++) { const r = { id: 'urn:air:proof' + String(i).padStart(5, '0') + '.example:mcp:x', display_name: 'Proof server ' + i, type: 'application/mcp-server-card+json', url: 'https://proof' + i + '.example/mcp', kind: 'mcp', source: 'proof', publisher: 'proof' + i + '.example', description: 'made for the proof' }; lines.push(r.id + '\\t' + metaOf(r) + '\\t' + hayOf(r) + '\\t' + JSON.stringify(r)); }
mkdirSync('data/site', { recursive: true });
const tsv = lines.sort().join('\\n') + '\\n';
writeFileSync('data/sea.tsv', tsv); writeFileSync('data/sea.tsv.gz', gzipSync(tsv)); writeFileSync('data/proof.ndjson', 'the raw rows of a lake\\n');
writeFileSync('data/build.json', JSON.stringify({ builtAt: new Date().toISOString(), entries, lakes: { proof: entries } }));
for (const f of ['index.html', 'llms.txt', 'robots.txt']) cpSync('site/' + f, 'data/site/' + f);
const pages = JSON.parse(readFileSync('store-pages.json', 'utf8')); pages['shop' + Object.keys(pages).length + '.example'] = { title: 'read once' }; writeFileSync('store-pages.json', JSON.stringify(pages));
console.log('sea built: ' + entries + ' entries');
`);
    if (!existsSync(join(repo, '.git'))) git('init', '-q', '-b', 'main');
    git('add', '-A'); git('commit', '-q', '--allow-empty', '-m', msg); return git('rev-parse', 'HEAD');
  };
  const B = standIn('build', await freePort(), { MARE_GIT_URL: repo, SECRET_OF_ROOT: 'must not reach the build' });
  let head = commit('the first sea');
  await proof('the server builds the sea itself from the repository, as a build that sees nothing of its surroundings, and runs it', async () => {
    const r = await B.update(); assert.equal(r.status, 0, r.out);
    assert.match(B.said(), /build: \d{8}-\d{6}-[0-9a-f]{7} \(main moved to [0-9a-f]{7}\)/); assert.match(B.said(), /is ready \(1200 entries, peak \d+ MB\)/); assert.match(B.said(), /runs \(1200 entries\)/);
    assert.equal(readFileSync(join(B.ops, 'built-sha'), 'utf8').trim(), head); assert.equal((await B.stats()).entries, 1200);
    const live = B.live(); assert.ok(existsSync(join(live, 'data', 'sea.tsv.gz')));
    for (const gone of ['data/sea.tsv', 'data/proof.ndjson', '.git']) assert.ok(!existsSync(join(live, gone)), `${gone} makes room`);
    const st = B.state(); assert.equal(st.source, 'build'); assert.equal(st.commit, head); assert.ok(st.lastBuildPeakMB >= 0);
    await B.update(); await B.update(); assert.equal(B.said().match(/ build: \d{8}-\d{6}-[0-9a-f]{7} \(/g).length, 1, 'nothing is built while main stands still');
  });
  await proof('when main moves the sea is built again; what was learned about the stores travels on', async () => {
    head = commit('more of the sea', { entries: 1500 });
    const r = await B.update(); assert.equal(r.status, 0, r.out);
    assert.match(B.said(), /runs \(1500 entries\)/); assert.equal((await B.stats()).entries, 1500); assert.equal(readFileSync(join(B.ops, 'built-sha'), 'utf8').trim(), head);
    assert.deepEqual(Object.keys(JSON.parse(readFileSync(join(B.ops, 'store-pages.json'), 'utf8'))).sort(), ['shop0.example', 'shop1.example']);
  });
  await proof('a build that lost a large part of the sea is held back; the commit can say that it is meant', async () => {
    commit('a lake did not answer', { entries: 1000 });
    await B.update(); assert.match(B.said(), /is held back, it lost part of the sea \(entries: 1000 now, 1500 before/); assert.equal((await B.stats()).entries, 1500);
    await B.update(); assert.equal(B.said().match(/is held back, it lost/g).length, 1, 'the same commit is not built again every two minutes');
    await B.update({ MARE_RETRY_MINUTES: '0' }); assert.equal(B.said().match(/is held back, it lost/g).length, 2, 'but again after a while'); assert.match(B.said(), /trying [0-9a-f]{7} again/);
    head = commit('the sea is smaller now [force-sea]', { entries: 1000 });
    await B.update(); assert.match(B.said(), /runs \(1000 entries\)/); assert.equal((await B.stats()).entries, 1000);
  });
  await proof('a commit whose proofs do not hold, or whose build breaks off, never reaches the node', async () => {
    commit('a mistake', { entries: 1100, proofHolds: false });
    await B.update(); assert.match(B.said(), /is held back, a proof does not hold/); assert.equal((await B.stats()).entries, 1000);
    commit('the lakes are away', { entries: 1100, crash: true });
    await B.update(); assert.match(B.said(), /did not finish \(exit 3/); assert.equal((await B.stats()).entries, 1000);
    assert.equal(readFileSync(join(B.ops, 'built-sha'), 'utf8').trim(), head);
  });
  await proof('once a day the sea is built again although main stands still', async () => {
    head = commit('back to work', { entries: 1100 }); await B.update(); assert.match(B.said(), /runs \(1100 entries\)/);
    const n = B.said().match(/ build: \d{8}-\d{6}-[0-9a-f]{7} \(/g).length;
    await sleep(1100); await B.update({ MARE_REFRESH_HOURS: '0', MARE_RETRY_MINUTES: '0' });
    assert.equal(B.said().match(/ build: \d{8}-\d{6}-[0-9a-f]{7} \(/g).length, n + 1); assert.match(B.said(), /the sea is 0 hours old/);
    assert.equal(readdirSync(join(B.srv, 'releases')).length <= 3, true, 'older builds make room');
  });
  B.kill();
}
files.close(); await stop();
try { rmSync(tmp, { recursive: true, force: true }); } catch {}
console.log(`\n${passed} proofs hold${failed ? `, ${failed} FAIL` : ''}`);
process.exit(failed ? 1 : 0);
