// Mare Liberum · proof of the unfilled placeholders (3.86): programs that walk the maps of the sea call the example
// addresses as they stand ("find?q=example", "q=<words>"), so "example" was the top task of the pulse by a thousand a day
// while real tasks came in twos. It proves, without the network:
//   words    placeholderQ knows a placeholder ("example", "<words>", "<your task>", "{q}", "{searchTerms}", "%3Cwords%3E",
//            the bare names of a search field) and leaves real words alone ("examples", "example shoes", "running shoes")
//   ledger   a hit with a placeholder keeps its line (it counts in hits_today) but never as a task: top_queries shows only
//            real tasks; the node counts the placeholders of the UTC day apart (at most 8 names, the rest under "other"),
//            and a new UTC day begins at zero
//   pulse    /pulse carries template_hits_today (a line, n, by) right after the installations, only when there is one
//   find     /find?q=example (JSON and HTML) answers how to fill q, with an example and the free start (the deal check and a
//            key), noindex, never the app door; /find?q=running shoes stays a search
//   guide    llms.txt says it next to /find?q=<words>
// Negative controls at the end: each rule broken in a copy of the code, and this proof must fail there.
// Runs without the network: node tools/placeholder-proof.mjs   (exit code 1 when a proof fails or a control is not caught)
//   --no-controls   only the proofs (the controls run this file that way in each broken copy)
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, cpSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { Buffer } from 'node:buffer';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const k of ['MARE_TOLL', 'MARE_ENGINE', 'MARE_FAIR', 'MARE_X402_FACILITATOR', 'MARE_PAY_TO', 'MARE_ROUTE_PRICE_CENTS', 'MARE_STATE', 'MARE_DB_URL', 'MARE_DB_KEY', 'MARE_DB_SECRET', 'MARE_BASE_RPC', 'MARE_CATALOG_ID']) delete process.env[k];
let passed = 0, failed = 0;
const proof = async (name, fn) => { try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 6).join('\n       ')}`); } };
const imp = (f) => import(pathToFileURL(join(ROOT, 'node', f)).href);

// ------------------------------------------------------------------ the world: nothing answers, the proof uses no network
globalThis.fetch = async () => new Response('not here', { status: 404, headers: { 'content-type': 'text/plain' } });
createRequire(import.meta.url)('node:dns').promises.lookup = async () => [{ address: '93.184.216.34', family: 4 }];
for (const k of ['error', 'warn', 'info']) console[k] = () => {};

// ------------------------------------------------------------------ the node
const BASE = 'https://mare.test', LLMS = readFileSync(join(ROOT, 'site/llms.txt'), 'utf8'), SITE = { '/llms.txt': { body: LLMS, type: 'text/plain; charset=utf-8' } };
const core = await imp('core.mjs'), { createMem } = await imp('mem.mjs'), { memoryKv } = await imp('flow.mjs');
const { createLedger, placeholderQ } = await imp('ledger.mjs'), { payConfig } = await imp('pay.mjs');
const dir = mkdtempSync(join(tmpdir(), 'mare-placeholder-')), file = join(dir, 'sea.tsv');
process.once('exit', () => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });
writeFileSync(file, ''); writeFileSync(join(dir, 'build.json'), JSON.stringify({ builtAt: '2026-11-20T10:00:00.000Z', entries: 0, lakes: {} }));
const pending = [], settle = async () => { while (pending.length) await Promise.allSettled(pending.splice(0)); };
const db = createMem({ file, base: BASE }), kv = memoryKv(), ledger = createLedger({});
const cfg = { base: BASE, kv, ledger, pay: payConfig({}), site: SITE, waitUntil: (p) => { pending.push(p); }, creditSweepMs: 0 };
let net = 0; const fresh = () => `198.51.100.${++net}`;
const call = async (path, { accept = 'application/json', ua = 'placeholder-proof/1.0', l } = {}) => {
  const res = await core.handle(new Request(BASE + path, { headers: { accept, 'user-agent': ua, 'x-forwarded-for': fresh() } }), db, l ? { ...cfg, ledger: l } : cfg);
  const text = res.body ? Buffer.from(await res.arrayBuffer()).toString('utf8') : ''; let j = null; try { j = JSON.parse(text); } catch {}
  return { status: res.status, h: Object.fromEntries(res.headers), text, j };
};
const UA = (n) => `placeholder-caller-${n}/1.0`;

console.log('the words');
await proof('placeholderQ knows "example", "<words>", "<your task>", "{q}", "{searchTerms}", "%3Cwords%3E" and the bare names of a search field', () => {
  for (const q of ['example', 'Example', '  example ', '<words>', ' <words> ', '<your task>', '<your task in words, any language>', '{q}', '{searchTerms}', '%3Cwords%3E', '%3cwords%3e', 'q', 'query', 'search', 'test'])
    assert.equal(placeholderQ(q), true, q);
});
await proof('placeholderQ leaves real words alone: "examples", "example shoes", "running shoes", "<b>shoes", nothing, a number', () => {
  for (const q of ['examples', 'example shoes', 'running shoes', "men's running shoes", '<b>shoes', '<a><b>', 'testing', '', '   ', null, undefined, 7])
    assert.equal(placeholderQ(q), false, String(q));
});

console.log('\nthe ledger');
await proof('a placeholder keeps its line but is never a task: top_queries shows only "running shoes"; hits_today counts all seven', async () => {
  const l = createLedger({});
  for (const n of [1, 2, 3]) l.hit({ kind: 'read', q: 'example', ua_hash: `h${n}`, target_domain: 'shop.example' });
  for (const n of [4, 5]) l.hit({ kind: 'read', q: '<words>', ua_hash: `h${n}`, target_domain: 'shop.example' });
  for (const n of [6, 7]) l.hit({ kind: 'ask', q: 'running shoes', ua_hash: `h${n}` });
  const p = await l.pulse();
  assert.deepEqual(p.top_queries.map((x) => x.query), ['running shoes']);
  assert.equal(p.hits_today, 7);
  assert.equal(l.mem.hits.filter((h) => h.q === null).length, 5, 'the five placeholder lines are kept without their task');
  const t = l.templates();
  assert.equal(t.n, 5); assert.equal(t.by.example, 3); assert.equal(t.by['<words>'], 2); assert.equal(t.day, new Date().toISOString().slice(0, 10));
});
await proof('the count keeps at most 8 names, the rest under "other"; nothing counted gives null', () => {
  const l = createLedger({});
  assert.equal(l.templates(), null);
  for (let i = 0; i < 12; i++) l.hit({ kind: 'read', q: `<w${i}>`, ua_hash: `h${i}` });
  const t = l.templates();
  assert.equal(t.n, 12); assert.equal(Object.keys(t.by).filter((k) => k !== 'other').length, 8); assert.equal(t.by.other, 4);
  l.hit({ kind: 'read', q: '<w0>', ua_hash: 'hx' }); assert.equal(l.templates().by['<w0>'], 2, 'a name already counted keeps counting');
});
await proof('a new UTC day begins at zero', () => {
  let t = Date.parse('2026-11-28T23:59:00Z'); const l = createLedger({ now: () => t });
  l.hit({ kind: 'read', q: 'example', ua_hash: 'h1' }); assert.equal(l.templates().n, 1);
  t = Date.parse('2026-11-29T00:01:00Z'); assert.equal(l.templates(), null, 'yesterday is not today');
  l.hit({ kind: 'read', q: '<words>', ua_hash: 'h2' }); assert.deepEqual(l.templates(), { day: '2026-11-29', n: 1, by: { '<words>': 1 } });
});

console.log('\nthe pulse');
await proof('/pulse carries template_hits_today (line, n, by) after the installations once a placeholder came; a real task stays in top_queries', async () => {
  const l = createLedger({});
  const before = await call('/pulse', { l });
  assert.equal(before.status, 200); assert.equal(before.j.template_hits_today, undefined, 'nothing counted, no field');
  for (const n of [1, 2, 3]) await call('/brain?q=example', { ua: UA(n), l });
  for (const n of [4, 5]) await call('/brain?q=running+shoes', { ua: UA(n), l });
  await settle();
  const r = await call('/pulse', { l });
  const th = r.j.template_hits_today;
  assert.ok(th, 'template_hits_today is there'); assert.equal(th.n, 3); assert.equal(th.by.example, 3);
  assert.match(th.line, /^unfilled placeholders today \(\d{4}-\d{2}-\d{2}, UTC, since the node started\): 3 · example 3 – not demand$/);
  const keys = Object.keys(r.j), at = keys.indexOf('template_hits_today');
  assert.ok(at >= 0 && keys.indexOf('unique_domains_today') > at, 'before the traffic');
  if (keys.includes('installations_today')) assert.ok(keys.indexOf('installations_today') < at, 'after the installations');
  const qs = (r.j.top_queries || []).map((x) => x.query);
  assert.ok(!qs.includes('example'), 'example is no task'); assert.ok(qs.includes('running shoes'), 'a real task shows');
});

console.log('\nthe find door');
await proof('/find.json?q=example answers how to fill q: placeholder, an example, the free start (deal check, key), noindex, never /mcp/app', async () => {
  for (const q of ['example', '%3Cwords%3E', '<words>', '{q}']) {
    const r = await call(`/find.json?q=${encodeURIComponent(q).replace(/%25/g, '%')}`);
    assert.equal(r.status, 200, q); assert.equal(r.j.placeholder, true, q);
    assert.equal(r.j.example, `${BASE}/find?q=running+shoes`); assert.match(r.j.fill, /fill q with your task/);
    assert.ok(r.j.start.some((s) => s.startsWith(`GET ${BASE}/deal?url=`)), 'the deal check'); assert.ok(r.j.start.some((s) => s.includes('/session?as=key')), 'a key');
    assert.equal(r.h['x-robots-tag'], 'noindex'); assert.ok(!r.text.includes('/mcp/app'));
  }
});
await proof('/find?q=example as HTML: a page that says to fill in the task, links the example and the deal check, noindex', async () => {
  const r = await call('/find?q=example', { accept: 'text/html' });
  assert.equal(r.status, 200); assert.match(r.h['content-type'], /text\/html/);
  assert.match(r.text, /<h1>Fill in your task<\/h1>/); assert.ok(r.text.includes('href="/find?q=running+shoes"')); assert.ok(r.text.includes('href="/deal"'));
  assert.match(r.text, /<meta name="robots" content="noindex">/); assert.ok(!r.text.includes('/mcp/app'));
});
await proof('/find.json?q=running shoes and ?q=examples stay a search (no placeholder answer)', async () => {
  for (const q of ['running+shoes', 'examples']) { const r = await call(`/find.json?q=${q}`); assert.equal(r.status, 200, q); assert.notEqual(r.j?.placeholder, true, q); }
});

console.log('\nthe guide');
await proof('llms.txt says it right after /find?q=<words>: placeholders are no task, /find says how to fill q, /pulse counts them apart', () => {
  const i = LLMS.indexOf('Find websites for a task: GET https://mareliberum.dev/find?q=<words>');
  assert.ok(i >= 0); const after = LLMS.slice(i, i + 400);
  assert.match(after, /a placeholder left as it is \(example, <words>, \{q\}\) is no task/); assert.match(after, /template_hits_today/);
});

console.log(`\n${passed} of ${passed + failed} proofs passed`);

// ------------------------------------------------------------------ negative controls: each rule broken in a copy, the proof must fail there
let caught = 0, missed = 0;
if (!process.argv.includes('--no-controls')) {
  console.log('\nnegative controls: each rule broken in a copy, the proof must fail there');
  const CONTROLS = [
    ['no word is a placeholder', 'node/ledger.mjs', "  if (!t) return false;\n  return PLACEHOLDER_WORDS", "  if (t || !t) return false;\n  return PLACEHOLDER_WORDS"],
    ['"%3Cwords%3E" not decoded', 'node/ledger.mjs', "  let t = q.trim(); try { t = decodeURIComponent(t.replace(/\\+/g, ' ')); } catch {}\n  t = t.trim().toLowerCase();", "  let t = q.trim();\n  t = t.trim().toLowerCase();"],
    ['too eager: every word that begins with "example"', 'node/ledger.mjs', "return PLACEHOLDER_WORDS.has(t) ||", "return PLACEHOLDER_WORDS.has(t) || /^example/.test(t) || /^test/.test(t) ||"],
    ['the placeholder kept as the task', 'node/ledger.mjs', 'q: ph ? null : row.q ?? null,', 'q: row.q ?? null,'],
    ['the placeholder line dropped (hits_today too low)', 'node/ledger.mjs', '      mem.hits.push(h); if (mem.hits.length % 500 === 0) prune();', '      if (!ph) mem.hits.push(h); if (mem.hits.length % 500 === 0) prune();'],
    ['no cap on the names', 'node/ledger.mjs', "Object.keys(t.by).filter((x) => x !== 'other').length < TEMPLATE_KEYS ? k : 'other'", 'true ? k : \'other\''],
    ['the day never turns', 'node/ledger.mjs', 'if (t.day !== day) { t.day = day; t.n = 0; t.by = {}; }', 'if (!t.day) { t.day = day; t.n = 0; t.by = {}; }'],
    ['/pulse without the field', 'node/core.mjs', '...(template_hits_today ? { template_hits_today } : {}), ', ''],
    ['/find searches for "example"', 'node/core.mjs', '      if (placeholderQ(q)) {\n        const fill', '      if (false) {\n        const fill'],
    ['llms.txt silent on the placeholders', 'site/llms.txt', ' Fill <words> with your task: a placeholder left as it is (example, <words>, {q}) is no task, /find answers it with how to fill q, and /pulse counts such calls apart (template_hits_today), never as demand.', ''],
  ];
  for (const [name, f, from, to] of CONTROLS) {
    const d2 = mkdtempSync(join(tmpdir(), 'mare-placeholder-ctl-'));
    try {
      cpSync(ROOT, d2, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      const fp = join(d2, f), txt = readFileSync(fp, 'utf8');
      if (!txt.includes(from)) { missed++; console.log(`  FAIL control "${name}": the line to break is gone from ${f}; the control needs updating`); continue; }
      writeFileSync(fp, txt.replace(from, to));
      const r = spawnSync(process.execPath, [join(d2, 'tools/placeholder-proof.mjs'), '--no-controls'], { encoding: 'utf8', timeout: 240_000, env: { ...process.env, NODE_PATH: join(ROOT, 'node_modules') } });
      const out = `${r.stdout}${r.stderr}`, broke = (out.match(/\n  FAIL /g) || []).length;
      if (r.status !== 0 && broke > 0) { caught++; console.log(`  ok   caught: ${name} (${broke} proof${broke === 1 ? '' : 's'} failed)`); }
      else { missed++; console.log(`  FAIL control "${name}" was not caught (exit ${r.status})`); }
    } finally { try { rmSync(d2, { recursive: true, force: true }); } catch {} }
  }
  console.log(`${caught} of ${CONTROLS.length} controls caught`);
}
process.exit(failed || missed ? 1 : 0);
