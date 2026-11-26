// Mare Liberum · proof of the operator's page (GET /operator, node/operator.mjs) and the brake on the operator's doors
// It proves, on a node in this process (handle, as serve.mjs answers) and with the page's own script run headless (node's
// webcrypto, a small DOM of its own):
//   the page answers with noindex, no-store and no-referrer, holds no key and no checksum; its script makes the key with
//   crypto.getRandomValues (32 bytes, base64url) and its SHA-256 with crypto.subtle, and that checksum is node's createHash of
//   the key (a known key too); section A sends nothing, stores nothing, logs nothing; section B sends the key only as the header
//   x-mare-mod to this site's own /operator/digest, /operator/ledger.csv and /operator/declarations (same origin, no-store),
//   never in an address, never into a storage; a wrong key shows the 403; the doors answer 403 without the key and 200 with it
//   (the key's hash handed in as cfg.modKeySha, as the books proof does); 30 wrong keys from one network in 10 minutes and its
//   next tries wait (429, the right key too) while another network goes on, and after the 10 minutes it may try again;
//   /moderate counts too; no log line, no stored value and no state of the immune system holds a key; /operator stands in no
//   sitemap, in no llms.txt and in no link of a public page.
// Negative controls at the end: each rule broken in a copy of the code, and this proof must fail there.
// Runs without the network: node tools/operator-proof.mjs   (--no-controls: only the proofs)
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, cpSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash, webcrypto } from 'node:crypto';
import vm from 'node:vm';
import { Buffer } from 'node:buffer';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTROLS = !process.argv.includes('--no-controls');
for (const k of ['MARE_STATE', 'MARE_DB_URL', 'MARE_DB_KEY', 'MARE_DB_SECRET', 'MARE_BASE_RPC', 'MARE_BOOKS', 'MARE_MAIL_KEY', 'MARE_MAIL_FROM']) delete process.env[k];
process.env.MARE_BASE_RPC = 'off';
let passed = 0, failed = 0;
const proof = async (name, fn) => {
  try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 6).join('\n       ')}`); }
  if (failed && process.env.MARE_OPERATOR_FIRST_FAIL === '1') { console.log(`\n${passed} proofs held, ${failed} failed (stopped at the first)`); process.exit(1); }
};
// every line the node writes, kept to look for keys in it
const said = [];
for (const k of ['log', 'error', 'warn', 'info', 'debug']) { const f = console[k].bind(console); console[k] = (...a) => { said.push(a.map((x) => (typeof x === 'string' ? x : (() => { try { return JSON.stringify(x); } catch { return String(x); } })())).join(' ')); if (k === 'log' && /^\s*(ok|FAIL)\b|proofs held|controls caught|^\n?negative/.test(String(a[0]))) f(...a); }; }
// one clock for the brake's 10 minutes
const D = globalThis.Date; let T0 = D.parse('2026-11-26T09:00:00.000Z');
class Clock extends D { constructor(...a) { if (a.length) super(...a); else super(T0); } static now() { return T0; } }
globalThis.Date = Clock;

const imp = (f) => import(pathToFileURL(join(ROOT, 'node', f)).href);
const core = await imp('core.mjs'), { createMem } = await imp('mem.mjs'), { memoryKv } = await imp('flow.mjs'), { createLedger } = await imp('ledger.mjs');
const { immune, KEY_MISSES } = await imp('immune.mjs'), OP = await imp('operator.mjs'), { MOD_KEY_SHA } = await imp('flow.mjs');
const BASE = 'https://mare.test', KEY = 'proof-operator-key-0123456789-abcdefghij', SHA = createHash('sha256').update(KEY).digest('hex');
const dir = mkdtempSync(join(tmpdir(), 'mare-op-')); process.once('exit', () => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });
writeFileSync(join(dir, 'sea.tsv'), ''); writeFileSync(join(dir, 'build.json'), JSON.stringify({ builtAt: '2026-11-20T10:00:00.000Z', entries: 0, lakes: {} }));
const db = createMem({ file: join(dir, 'sea.tsv'), base: BASE }), kv = memoryKv();
const SITE = { '/llms.txt': { body: readFileSync(join(ROOT, 'site/llms.txt'), 'utf8'), type: 'text/plain; charset=utf-8' } };
const cfg = { base: BASE, kv, ledger: createLedger({}), waitUntil: () => {}, modKeySha: SHA, site: SITE, mail: { on: false } };
immune.set({ mode: 'normal', rest: [], pace: { perMinute: 1_000_000, burst: 1_000_000 } });
const call = async (path, { method = 'GET', ip = '198.51.100.20', headers = {}, body, accept = 'text/html' } = {}) => {
  const res = await core.handle(new Request(BASE + path, { method, headers: { 'user-agent': 'Mozilla/5.0 (operator-proof)', accept, 'x-forwarded-for': ip, ...headers }, ...(body !== undefined ? { body } : {}) }), db, cfg);
  const text = await res.text(); let j = null; try { j = JSON.parse(text); } catch {}
  return { status: res.status, headers: res.headers, text, j };
};
const scriptOf = (html) => { const m = /<script>([\s\S]*?)<\/script>/.exec(html); return m ? m[1] : ''; };

// ------------------------------------------------------------------ the page
const page = await call(OP.OPERATOR_PAGE);
const SCRIPT = scriptOf(page.text);
await proof('GET /operator: 200, German, noindex, cache-control no-store, referrer-policy no-referrer; no key and no checksum in it', () => {
  assert.equal(page.status, 200); assert.match(page.headers.get('content-type'), /^text\/html/);
  assert.equal(page.headers.get('cache-control'), 'no-store'); assert.match(page.headers.get('x-robots-tag'), /noindex/); assert.equal(page.headers.get('referrer-policy'), 'no-referrer');
  assert.match(page.text, /<html lang="de" data-look="operator">/); assert.match(page.text, /<meta name="robots" content="noindex/);
  assert.equal((page.text.match(/<script\b/g) || []).length, 1, 'one script on the page, its own'); assert.ok(!/<script[^>]*\bsrc=/.test(page.text) && !/<link[^>]*rel="(?:modulepreload|preload|stylesheet)"/.test(page.text), 'nothing loaded from elsewhere');
  assert.match(page.text, /Neuen Betreiber-Schlüssel erzeugen/); assert.match(page.text, /Anmelden/); for (const b of ['Übersicht', 'Kassenbuch (CSV)', 'Erklärungen']) assert.ok(page.text.includes(`>${b}</button>`), b);
  assert.match(page.text, /Passwort-Manager/); assert.match(page.text, /nur jetzt gezeigt und nirgendwohin gesendet/); assert.match(page.text, /Nur diese Prüfsumme geht an Claude/);
  assert.ok(!page.text.includes(KEY) && !page.text.includes(SHA) && !page.text.includes(MOD_KEY_SHA), 'no key, no checksum');
  assert.ok(!/[A-Za-z0-9_-]{40,}/.test(SCRIPT.replace(/'[^']*'|"[^"]*"/g, (s) => (s.length > 40 && /^['"][A-Za-z0-9_-]+['"]$/.test(s) ? s : ''))), 'no token in the script');
  assert.match(page.text, /<input id="pw" type="password"/); assert.ok(!/<form/.test(page.text), 'no form that could send the key in an address');
});
await proof('the script: crypto.getRandomValues and crypto.subtle; no storage, no console, no address, no other way out; fetch only to the operator\'s own doors with x-mare-mod', () => {
  assert.ok(SCRIPT.includes('crypto.getRandomValues(raw)') && SCRIPT.includes("crypto.subtle.digest('SHA-256'"));
  for (const bad of ['localStorage', 'sessionStorage', 'indexedDB', 'document.cookie', 'console.', 'location', 'history.', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'postMessage', 'window.open', 'caches', '?key', 'searchParams', 'import(']) assert.ok(!SCRIPT.includes(bad), bad);
  assert.equal((SCRIPT.match(/fetch\(/g) || []).length, 1, 'one fetch'); assert.match(SCRIPT, /fetch\(path, \{ method: 'GET', mode: 'same-origin'[^}]*cache: 'no-store'[^}]*headers: \{ 'x-mare-mod': key \} \}\)/);
  assert.match(SCRIPT, /if \(!READS\.includes\(path\)\) return null;/); assert.deepEqual(JSON.parse(/const READS = (\[[^\]]*\]);/.exec(SCRIPT)[1]), ['/operator/digest', '/operator/ledger.csv', '/operator/declarations']);
});

// ------------------------------------------------------------------ the script, run headless: node's webcrypto and a small DOM
function runPage({ fill = null, ip = '198.51.100.30' } = {}) {
  const els = new Map(), sent = [], touched = [], blobs = [];
  const mk = (id) => ({ id, value: '', hidden: true, textContent: '', className: '', href: '', download: '', children: [], listeners: {}, addEventListener(t, f) { this.listeners[t] = f; }, select() {}, replaceChildren(...c) { this.children = c; }, append(...c) { this.children.push(...c); }, click() {}, remove() {} });
  const document = { getElementById: (id) => { if (!els.has(id)) els.set(id, mk(id)); return els.get(id); }, createElement: (tag) => Object.assign(mk(tag), { tag }), body: mk('body') };
  const spy = (name) => new Proxy({}, { get: (t, k) => { touched.push(`${name}.${String(k)}`); return () => null; } });
  const crypto = { getRandomValues: (a) => (fill ? fill(a) : webcrypto.getRandomValues(a)), subtle: webcrypto.subtle };
  const fetch = async (url, opts) => { sent.push({ url, opts }); const r = await core.handle(new Request(BASE + url, { method: opts.method, headers: { 'user-agent': 'Mozilla/5.0 (operator-proof)', 'x-forwarded-for': ip, ...opts.headers } }), db, cfg); return r; };
  const sandbox = { document, crypto, fetch, TextEncoder, Uint8Array, btoa: (s) => Buffer.from(s, 'binary').toString('base64'), navigator: { clipboard: { writeText: async () => {} } },
    URL: { createObjectURL: (b) => { blobs.push(b); return 'blob:operator'; }, revokeObjectURL: () => {} }, setTimeout: () => 0, localStorage: spy('localStorage'), sessionStorage: spy('sessionStorage'), indexedDB: spy('indexedDB'), console: spy('console'), Date: D };
  vm.runInNewContext(SCRIPT, sandbox);
  const click = (id) => els.get(id).listeners.click();
  return { els, sent, touched, blobs, click, el: (id) => document.getElementById(id) };
}
await proof('section A, headless: a key of 32 random bytes (base64url, 43 characters) and its SHA-256, which is node\'s createHash of it; a known key too; nothing sent, stored or logged', async () => {
  const p = runPage(); await p.click('make');
  const key = p.el('key').value, sum = p.el('sum').value;
  assert.match(key, /^[A-Za-z0-9_-]{43}$/); assert.equal(sum, createHash('sha256').update(key).digest('hex')); assert.equal(p.el('made').hidden, false);
  assert.equal(p.sent.length, 0, 'nothing sent'); assert.deepEqual(p.touched, [], 'no storage, no console');
  const known = runPage({ fill: (a) => { for (let i = 0; i < a.length; i++) a[i] = i; return a; } }); await known.click('make');
  const want = Buffer.from(Array.from({ length: 32 }, (_, i) => i)).toString('base64url');
  assert.equal(known.el('key').value, want); assert.equal(known.el('sum').value, createHash('sha256').update(want).digest('hex'));
  const again = runPage(); await again.click('make'); assert.notEqual(again.el('key').value, key, 'a new key each time');
});
await proof('section B, headless: the key goes only as x-mare-mod to /operator/digest, /operator/ledger.csv and /operator/declarations (same origin, no-store, never in the address); the answers are shown; a wrong key shows the 403', async () => {
  const p = runPage(); p.el('pw').value = KEY;
  await p.click('digest'); assert.equal(p.el('msg').textContent, ''); assert.ok(p.el('out').children.length >= 3, 'the overview is shown');
  await p.click('ledger'); assert.equal(p.blobs.length, 1, 'the CSV saved through a Blob'); assert.match(p.el('msg').textContent, /CSV-Datei gespeichert/);
  await p.click('decl'); assert.ok(p.el('out').children.length >= 3);
  assert.deepEqual(p.sent.map((x) => x.url), ['/operator/digest', '/operator/ledger.csv', '/operator/declarations']);
  for (const x of p.sent) { assert.equal(x.opts.headers['x-mare-mod'], KEY); assert.equal(x.opts.cache, 'no-store'); assert.equal(x.opts.mode, 'same-origin'); assert.ok(!x.url.includes(KEY) && !x.url.includes('?')); assert.equal(Object.keys(x.opts.headers).length, 1); }
  assert.deepEqual(p.touched, [], 'no storage, no console');
  const w = runPage({ ip: '198.51.100.31' }); w.el('pw').value = 'not the key'; await w.click('decl'); assert.match(w.el('msg').textContent, /^403: Der Schlüssel stimmt nicht/); assert.equal(w.el('out').children.length, 0);
  const e = runPage(); await e.click('digest'); assert.equal(e.sent.length, 0, 'no key: nothing sent');
});

// ------------------------------------------------------------------ the doors and the brake
await proof('the operator\'s doors: 403 without the key and with a wrong one, 200 with it (/operator/declarations, /operator/digest, /operator/ledger.csv, /operator/ledger.json); /moderate refuses a wrong key', async () => {
  for (const p of ['/operator/declarations', '/operator/digest', '/operator/ledger.csv', '/operator/ledger.json']) {
    assert.equal((await call(p, { ip: '198.51.100.40' })).status, 403, p); assert.equal((await call(p, { ip: '198.51.100.40', headers: { 'x-mare-mod': 'nope' } })).status, 403, p);
    const ok = await call(p, { ip: '198.51.100.41', headers: { 'x-mare-mod': KEY } }); assert.equal(ok.status, 200, p); assert.equal(ok.headers.get('cache-control'), 'no-store');
  }
  assert.equal((await call('/moderate', { method: 'POST', ip: '198.51.100.42', headers: { 'x-mare-mod': 'nope', 'content-type': 'application/json' }, body: '{}' })).status, 403);
});
await proof(`the brake: ${KEY_MISSES} wrong keys from one network in 10 minutes (any operator door, /moderate too) and its next tries wait, the right key too (429, retry-after); another network goes on; after the 10 minutes it may try again`, async () => {
  const ip = '203.0.113.77', doors = ['/operator/digest', '/operator/ledger.csv', '/operator/ledger.json', '/operator/declarations'];
  for (let i = 0; i < KEY_MISSES; i++) {
    const r = i % 10 === 9 ? await call('/moderate', { method: 'POST', ip, headers: { 'x-mare-mod': `guess ${i}`, 'content-type': 'application/json' }, body: '{}' }) : await call(doors[i % 4], { ip, headers: { 'x-mare-mod': `guess ${i}` } });
    assert.equal(r.status, 403, `guess ${i}`);
  }
  const held = await call('/operator/digest', { ip, headers: { 'x-mare-mod': KEY } }); assert.equal(held.status, 429); assert.ok(Number(held.headers.get('retry-after')) > 0); assert.ok(!held.text.includes('"days"'));
  assert.equal((await call('/moderate', { method: 'POST', ip, headers: { 'x-mare-mod': KEY, 'content-type': 'application/json' }, body: '{}' })).status, 429);
  assert.equal((await call('/operator/digest', { ip: '203.0.113.78', headers: { 'x-mare-mod': KEY } })).status, 200, 'another network');
  T0 += 10 * 60_000 + 1000; assert.equal((await call('/operator/digest', { ip, headers: { 'x-mare-mod': KEY } })).status, 200, 'after the 10 minutes');
});
await proof('no key in any log line, any stored value or the state of the immune system', async () => {
  for (const k of [KEY, 'guess 1', 'not the key', 'nope']) assert.ok(!said.some((l) => l.includes(k)), `a log line holds "${k}"`);
  for (const name of kv.keys('')) { const v = JSON.stringify(await kv.get(name)); for (const k of [KEY, 'guess 1', 'not the key']) assert.ok(!v.includes(k), `${name} holds a key`); }
  assert.ok(!JSON.stringify(await immune.status()).includes(KEY));
});
await proof('/operator stands in no sitemap, no llms.txt and no link of a public page', async () => {
  const idx = await call('/sitemap.xml', { accept: 'application/xml' }); assert.equal(idx.status, 200);
  const subs = [...idx.text.matchAll(/<loc>https:\/\/mare\.test(\/[^<]*)<\/loc>/g)].map((m) => m[1]);
  for (const p of ['/sitemap.xml', ...subs.filter((p) => p.endsWith('.xml'))]) { const r = await call(p, { accept: 'application/xml' }); assert.ok(!/\/operator\b/.test(r.text), p); }
  assert.ok(!/\/operator\b/.test(readFileSync(join(ROOT, 'site/llms.txt'), 'utf8'))); assert.ok(!/\/operator\b/.test((await call('/llms.txt', { accept: 'text/plain' })).text));
  for (const p of ['/', '/impressum', '/de/datenschutz', '/privacy', '/de/agb', '/terms', '/about', '/security']) { const r = await call(p); assert.ok(!/href="[^"]*\/operator\b/.test(r.text), p); }
  assert.ok(!/\/operator\b/.test(readFileSync(join(ROOT, 'site/robots.txt'), 'utf8')), 'not even named in robots.txt');
});
await proof('proof:operator in package.json', () => assert.equal(JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).scripts['proof:operator'], 'node tools/operator-proof.mjs'));

console.log(`\n${passed} proofs held, ${failed} failed`);

// ------------------------------------------------------------------ negative controls: break one rule in a copy, the proof must fail there
const BREAK = [
  ['the key kept in localStorage', 'node/operator.mjs', "const key = $('pw').value.trim();", "const key = $('pw').value.trim(); localStorage.setItem('k', key);"],
  ['the key in a query string', 'node/operator.mjs', "try { r = await fetch(path, {", "try { r = await fetch(path + '?key=' + encodeURIComponent(key), {"],
  ['the key header logged', 'node/core.mjs', "if (path === OPERATOR_PATH && req.method === 'GET') return operatorBraked(ip)", "if (path === OPERATOR_PATH && req.method === 'GET' && !console.error('mare_operator', req.headers.get('x-mare-mod'))) return operatorBraked(ip)"],
  ['the brake taken away', 'node/core.mjs', "const wait = immune.keyBraked?.(ip);", "const wait = 0;"],
  ['wrong keys not counted', 'node/core.mjs', "const operatorCounted = (res, ip) => { if (res?.status === 403) immune.keyMiss?.(ip); return res; };", "const operatorCounted = (res) => res;"],
  ['the page kept by caches', 'node/operator.mjs', "'cache-control': 'no-store', 'x-robots-tag'", "'cache-control': 'public, max-age=3600', 'x-robots-tag'"],
  ['the page sends the referrer', 'node/operator.mjs', "'referrer-policy': 'no-referrer',", "'referrer-policy': 'origin',"],
  ['section A sends the checksum home', 'node/operator.mjs', "$('key').value = key; $('sum').value = sum; $('made').hidden = false;", "$('key').value = key; $('sum').value = sum; $('made').hidden = false; fetch('/operator/digest', { headers: { 'x-mare-mod': sum } });"],
  ['the key sent to another door', 'node/operator.mjs', "export const OPERATOR_READS = Object.freeze(['/operator/digest', '/operator/ledger.csv', '/operator/declarations']);", "export const OPERATOR_READS = Object.freeze(['/operator/digest', '/operator/ledger.csv', '/operator/declarations', 'https://elsewhere.example/k']);"],
  ['/operator in llms.txt', 'site/llms.txt', '\n', '\nOperator: https://mareliberum.dev/operator\n'],
  ['the page counted (the census script on it)', 'node/core.mjs', 'd !== OPERATOR_PAGE && !d.startsWith(`${OPERATOR_PAGE}/`) && ', ''],
];
let caught = 0;
if (CONTROLS) {
  console.log('\nnegative controls: each rule broken in a copy, the proof must fail there');
  for (const [what, f, from, to] of BREAK) {
    const t = mkdtempSync(join(tmpdir(), 'mare-op-ctl-'));
    try {
      for (const d of ['node', 'site', 'proof', 'config', 'public']) if (existsSync(join(ROOT, d))) cpSync(join(ROOT, d), join(t, d), { recursive: true });
      mkdirSync(join(t, 'tools'), { recursive: true }); cpSync(join(ROOT, 'tools/operator-proof.mjs'), join(t, 'tools/operator-proof.mjs'));
      for (const x of ['package.json', 'server.json', 'server-dev.json', 'server-lean.json', 'gemini-extension.json', 'serve.mjs']) cpSync(join(ROOT, x), join(t, x));
      const src = readFileSync(join(t, f), 'utf8');
      if (!src.includes(from)) { console.log(`  FAIL control "${what}": the line to break is gone from ${f}; the control needs updating`); continue; }
      writeFileSync(join(t, f), src.replace(from, to));
      const run = spawnSync(process.execPath, ['tools/operator-proof.mjs', '--no-controls'], { cwd: t, encoding: 'utf8', timeout: 300_000, env: { ...process.env, MARE_OPERATOR_FIRST_FAIL: '1' } });
      const held = /(\d+) proofs held, (\d+) failed/.exec(run.stdout || '');
      if (run.status !== 0 && held && Number(held[2]) > 0) { caught++; console.log(`  ok   caught: ${what} (${held[2]} ${held[2] === '1' ? 'proof' : 'proofs'} failed)`); }
      else console.log(`  FAIL not caught: ${what} (exit ${run.status}${held ? `, ${held[0]}` : ''}${run.stderr ? `; ${String(run.stderr).split('\n')[0].slice(0, 160)}` : ''})`);
    } finally { rmSync(t, { recursive: true, force: true }); }
  }
  console.log(`${caught} of ${BREAK.length} controls caught`);
}
process.exit(failed || (CONTROLS && caught !== BREAK.length) ? 1 : 0);
