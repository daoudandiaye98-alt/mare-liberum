// Mare Liberum · proof of TOON (3.35, the engine's lever "toon"): node/toon.mjs against the spec's own conformance
// fixtures (4.4, vendored in tools/fixtures/toon), round trips on those and on real answers of the sea, the host types of
// §3, and fmt=toon / Accept: text/toon on the JSON doors (node/toondoor.mjs, the outermost layer of handle): only when
// asked, every default answer byte for byte what 3.34.1 sends, the TOON answer the same data as the JSON one, JSON kept
// where TOON is not smaller and for errors and JSON-RPC, the app door untouched, counted only for agents (never the sea's
// own calls, crawlers or HEAD; the house agent apart), validators intact, and with the engine resting or off nothing of
// it acts. Negative controls at the end: each rule is broken in a copy of the code, and this proof must fail there.
// Runs without the network: node tools/toon-proof.mjs   (exit code 1 when a proof fails or a control is not caught)
//   --no-controls   only the proofs (the controls run this file that way in each broken copy)
// The 3.34.1 tree comes from git archive of MARE_REF (default cb5ca52); MARE_REF_DIR names one that is there already.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { toToon, fromToon, TOON, ToonError } from '../node/toon.mjs';
import { savingOf, engineHeaders, RATIO } from '../node/engine.mjs';
import { prefersToon, toonAsked, jsonRequest, toonAnswer, toonTag, jsonTag } from '../node/toondoor.mjs';
import { freezeTime, refTree, nodeOf, brokenCopy, runIn, drop, headersOf, same, RECEIPT_IDS, REF } from './engine-kit.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTROLS = !process.argv.includes('--no-controls');
delete process.env.MARE_ENGINE; delete process.env.MARE_FAIR; // the proof holds the defaults: engine on, fair share on
let passed = 0, failed = 0;
const proof = async (name, fn) => { try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 5).join('\n       ')}`); } };
globalThis.fetch = async (u) => { throw new Error(`the proof does not use the network: ${String(u).slice(0, 80)}`); };
const FX = join(ROOT, 'tools/fixtures/toon');

// ------------------------------------------------------------------ 1. the spec's conformance fixtures
console.log(`TOON ${TOON.spec} (${TOON.date}) — the spec's conformance fixtures (tools/fixtures/toon, MIT)`);
const fixtures = (cat) => readdirSync(join(FX, cat)).filter((f) => f.endsWith('.json')).sort().flatMap((f) => JSON.parse(readFileSync(join(FX, cat, f), 'utf8')).tests.map((t, i) => ({ ...t, at: `${cat}/${f}#${i}` })));
const ENC = fixtures('encode'), DEC = fixtures('decode');
const runFixture = (t, cat) => {
  const o = t.options || {};
  let got, threw = null;
  try { got = cat === 'encode' ? toToon(t.input, { delimiter: o.delimiter, indent: o.indentSize }) : fromToon(t.input, { strict: o.strict, indent: o.indentSize }); } catch (e) { threw = e; }
  if (t.shouldError) return threw instanceof ToonError ? null : `expected an error, got ${JSON.stringify(got)?.slice(0, 80)}`;
  if (threw) return `threw ${threw.message}`;
  if (cat === 'encode') return got === t.expected ? null : `got ${JSON.stringify(got).slice(0, 120)}, want ${JSON.stringify(t.expected).slice(0, 120)}`;
  return JSON.stringify(got) === JSON.stringify(t.expected) ? null : `got ${JSON.stringify(got).slice(0, 120)}, want ${JSON.stringify(t.expected).slice(0, 120)}`;
};
for (const [cat, list] of [['encode', ENC], ['decode', DEC]]) {
  await proof(`${cat}: all ${list.length} fixtures of spec ${TOON.spec} (${list.filter((t) => t.shouldError).length} of them must error)`, () => {
    const bad = list.map((t) => [t.at, runFixture(t, cat)]).filter(([, e]) => e);
    assert.equal(bad.length, 0, `${bad.length} of ${list.length} fail:\n${bad.slice(0, 8).map(([a, e]) => `${a}: ${e}`).join('\n')}`);
  });
}
await proof('round trip: every encode fixture decodes back to its input; every valid decode fixture encodes and decodes to itself', () => {
  for (const t of ENC) { const o = t.options || {}; assert.ok(same(fromToon(toToon(t.input, { delimiter: o.delimiter, indent: o.indentSize }), { indent: o.indentSize }), t.input), t.at); }
  for (const t of DEC.filter((x) => !x.shouldError)) { const o = t.options || {}, v = fromToon(t.input, { strict: o.strict, indent: o.indentSize }); assert.ok(same(fromToon(toToon(v)), v), t.at); }
});

// ------------------------------------------------------------------ 2. what TOON promises beyond the fixtures (§2, §3, §12)
console.log('the encoder\'s own rules (host types of §3, layout of §12)');
await proof('host types as JSON.stringify reads them (§3, documented in node/toon.mjs); NaN, ±Infinity → null; -0 → 0', () => {
  const v = { d: new Date('2026-11-25T12:00:00.000Z'), n: NaN, i: -Infinity, z: -0, u: undefined, f: () => 1, arr: [undefined, () => 1, Symbol('s')], big: 12n, huge: 2n ** 80n, set: new Set([1, 2]), map: new Map([['a', 1]]), j: { toJSON: () => 'x' }, w: new String('w') };
  assert.equal(toToon(v), 'd: "2026-11-25T12:00:00.000Z"\nn: null\ni: null\nz: 0\narr[3]: null,null,null\nbig: 12\nhuge: "1208925819614629174706176"\nset[2]: 1,2\nmap:\n  a: 1\nj: x\nw: w');
  assert.ok(same(fromToon(toToon({ a: 1, u: undefined })), JSON.parse(JSON.stringify({ a: 1, u: undefined }))));
});
await proof('a string with an unpaired surrogate cannot be said in TOON: the encoder refuses (§3), quoted or not, key or value', () => {
  for (const v of [{ a: 'x\ud800' }, { ['k\udc00']: 1 }, ['\ud83d'], '\udfff']) assert.throws(() => toToon(v), ToonError);
  assert.equal(toToon({ e: '🎉 ok' }), 'e: 🎉 ok');
});
await proof('no trailing newline, no trailing space, no blank line, LF only, no BOM; the same value encodes the same way twice', () => {
  const v = JSON.parse(readFileSync(join(FX, 'sea/savings.json'), 'utf8')), t = toToon(v);
  assert.ok(!t.endsWith('\n') && !/[ \t]$/m.test(t) && !/\n\n/.test(t) && !t.includes('\r') && !t.startsWith('﻿'));
  assert.equal(toToon(v), t);
});
// the reference implementation (dev time only, never a dependency): byte for byte the same text on random values
const refLib = await (async () => { for (const d of [join(homedir(), '.cache/toon-ref'), join(homedir(), '.cache/mare-proof')]) { try { const req = createRequire(join(d, 'package.json')); return await import(pathToFileURL(req.resolve('@toon-format/toon')).href); } catch {} } return null; })();
if (refLib) {
  await proof('the reference implementation (@toon-format/toon, dev time only): 3,000 random values encode byte for byte the same, both decoders read both', () => {
    let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff), pick = (a) => a[Math.floor(rnd() * a.length)];
    const S = ['', ' x', 'true', '42', '05', 'a,b', 'a|b', 'x:y', '-a', '#a', '[1]', 'q"q', 'b\\s', 'l\nb', 'ü', '🎉', 'http://a.b/c?d=e', 'plain words'], K = ['id', 'name', 'x.y', 'my-key', '', '1a', 'ü'];
    const gen = (d) => { const r = rnd(); if (d > 3 || r < 0.35) return pick([null, true, false, 0, -1, 1.5, 1e21, 1e-7, ...S]); if (r < 0.55) return Array.from({ length: Math.floor(rnd() * 4) }, () => gen(d + 1));
      if (r < 0.75) { const ks = [...new Set([pick(K), pick(K)])]; return Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => Object.fromEntries(ks.map((k) => [k, gen(9)]))); }
      return Object.fromEntries(Array.from({ length: Math.floor(rnd() * 4) }, (_, i) => [pick(K) + i, gen(d + 1)])); };
    for (let i = 0; i < 1000; i++) { const v = gen(0); for (const delimiter of [',', '\t', '|']) { const a = toToon(v, { delimiter }); assert.equal(a, refLib.encode(v, { delimiter })); assert.ok(same(refLib.decode(a), fromToon(a))); } }
  });
} else console.log('  note the reference implementation is not installed (npm install --prefix ~/.cache/toon-ref @toon-format/toon): that cross-check did not run');

// ------------------------------------------------------------------ 3. real answers of the sea
console.log('real answers of the sea (tools/fixtures/toon/sea, read from mareliberum.dev 3.34.1): JSON against TOON by the one rule (node/engine.mjs)');
const SEA = readdirSync(join(FX, 'sea')).filter((f) => f.endsWith('.json')).sort();
const seaRows = SEA.map((f) => { const text = readFileSync(join(FX, 'sea', f), 'utf8'), v = JSON.parse(text), t = toToon(v); return { name: f.replace(/\.json$/, ''), text, v, t, s: savingOf('toon', { before: text, beforeForm: 'json', after: t, afterForm: 'toon' }) }; });
for (const r of seaRows) console.log(`       ${r.name.padEnd(8)} JSON ${String(r.s.bytes.before).padStart(6)} B ≈ ${String(r.s.before).padStart(5)} tokens · TOON ${String(r.s.bytes.after).padStart(6)} B ≈ ${String(r.s.after).padStart(5)} tokens · ${r.s.saved > 0 ? `TOON spares ${r.s.saved}` : 'TOON is not smaller: JSON is sent'}`);
console.log(`       (tokens by ${RATIO.unit}: json ${RATIO.json}, toon ${RATIO.toon}${RATIO.assumption ? `; an assumption until the bench measures them: ${RATIO.basis}` : ''})`);
await proof(`all ${SEA.length} real answers decode from their TOON to the same data`, () => { for (const r of seaRows) assert.ok(same(fromToon(r.t), r.v), r.name); });
await proof('TOON is smaller than JSON on the tabular answers (routes, savings) by the one rule', () => {
  for (const n of ['routes', 'savings']) { const r = seaRows.find((x) => x.name === n); assert.ok(r.s.saved > 0 && r.s.bytes.after < r.s.bytes.before, `${n}: ${r.s.before} -> ${r.s.after}`); }
  assert.match(toToon(seaRows.find((x) => x.name === 'routes').v), /\[\d+\]\{[^}]+\}:\n/, 'the doors of /routes.json become a table');
});

// ------------------------------------------------------------------ 4. fmt=toon on the JSON doors, against 3.34.1
const restore = freezeTime();
const SITE = { '/llms.txt': { body: readFileSync(join(ROOT, 'site/llms.txt'), 'utf8'), type: 'text/plain; charset=utf-8' } };
const refDir = refTree(ROOT);
const ours = await nodeOf(ROOT, { site: SITE }), theirs = refDir ? await nodeOf(refDir, { site: SITE }) : null;
console.log(`fmt=toon and Accept: text/toon on the JSON doors (node/toondoor.mjs), against ${REF} (3.34.1)${theirs ? '' : ': NOT RUN, no tree of the release (git archive failed)'}`);
const counted = [];
const wake = async () => { await ours.call('/stats'); ours.db.flow.countEngine = (lever, s, ctx, subject) => { counted.push({ lever, s, ctx, subject }); }; if (theirs) await theirs.call('/stats'); };
await wake();
// the default answers: JSON doors, pages, Markdown, the MCP doors' lists (the discovery documents and /mcp's initialize
// change by one sanctioned line each and are proved in tools/leanmcp-proof.mjs)
const DEFAULTS = [['/about'], ['/stats'], ['/search?q=mcp'], ['/brain?q=find+mcp+servers+for+postgres'], ['/brain/areas.json'], ['/savings.json'], ['/fair.json'], ['/open.json'], ['/brief.json?q=write+a+cover+letter'], ['/works.json'], ['/routes.json'],
  ['/nope-404'], ['/', 'text/html'], ['/', 'text/markdown'], ['/brain?q=x', 'text/html'], ['/savings', 'text/html'], ['/llms.txt', '*/*'], ['/about', '*/*'], ['/search?q=mcp', 'application/json, text/toon'], ['/search?q=mcp', 'text/toon;q=0.5, application/json']];
const strip = (t) => String(t).replace(RECEIPT_IDS, 'r<id>');
const stripH = (h) => Object.fromEntries(Object.entries(headersOf(h)).map(([k, v]) => [k, strip(v)]));
// one request to a node of this branch and the same to a node of 3.34.1 (both in the same state: called in lockstep)
const sameAnswer = async (path, o = {}, cfgO = {}, cfgT = {}, A = ours, B = theirs) => {
  const a = await A.call(path, { ...o, cfg: cfgO }), b = await B.call(path, { ...o, cfg: cfgT });
  assert.equal(a.status, b.status, `${path}: status ${a.status} against ${b.status}`);
  assert.equal(strip(a.text), strip(b.text), `${path} (${o.accept || 'application/json'}): the body differs from 3.34.1`);
  assert.deepEqual(stripH(a.headers), stripH(b.headers), `${path}: the headers differ from 3.34.1`);
  return a;
};
if (theirs) {
  await proof(`every default answer is byte for byte what 3.34.1 sends (${DEFAULTS.length} requests: JSON doors, pages, Markdown, errors, Accepts that prefer JSON)`, async () => {
    for (const [p, accept] of DEFAULTS) { const a = await sameAnswer(p, accept ? { accept } : {}); assert.ok(!a.headers.get('x-sea-engine') && !/toon/.test(a.headers.get('content-type') || '')); }
  });
  await proof('the MCP doors\' lists are byte for byte those of 3.34.1: /mcp tools/list, /mcp/app initialize and tools/list', async () => {
    for (const [door, m] of [['/mcp', 'tools/list'], ['/mcp/app', 'initialize'], ['/mcp/app', 'tools/list']]) {
      const params = m === 'initialize' ? { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'toon-proof', version: '1' } } : undefined;
      const a = await ours.rpc(door, m, params), b = await theirs.rpc(door, m, params); assert.equal(a.text, b.text, `${door} ${m}`); assert.deepEqual(headersOf(a.headers), headersOf(b.headers));
    }
  });
}
// the TOON answers
const pairs = [];
await proof('fmt=toon and Accept: text/toon: the JSON answer re-encoded, text/toon per the spec, vary: accept, the engine headers of savingOf, every other header kept', async () => {
  for (const p of ['/savings.json', '/search?q=mcp', '/about', '/fair.json']) {
    const j = await ours.call(p), viaFmt = await ours.call(`${p}${p.includes('?') ? '&' : '?'}fmt=toon`), viaAcc = await ours.call(p, { accept: 'text/toon' });
    for (const t of [viaFmt, viaAcc]) {
      assert.equal(t.status, 200); assert.equal(t.headers.get('content-type'), 'text/toon; charset=utf-8', p);
      assert.ok(same(fromToon(t.text), JSON.parse(j.text)), `${p}: the TOON says what the JSON says`);
      const s = savingOf('toon', { before: j.text, beforeForm: 'json', after: t.text, afterForm: 'toon' });
      assert.ok(s.saved > 0); for (const [k, v] of Object.entries(engineHeaders(s))) assert.equal(t.headers.get(k), v, `${p} ${k}`);
      assert.equal(t.headers.get('x-sea-engine-lossy'), null); assert.match(t.headers.get('vary') || '', /\baccept\b/i);
      for (const [k, v] of j.headers) if (!['content-type', 'content-length', 'vary', 'etag', 'access-control-expose-headers'].includes(k)) assert.equal(t.headers.get(k), v, `${p}: header ${k} kept`);
      assert.match(t.headers.get('access-control-expose-headers') || '', /x-sea-engine-tokens/);
    }
    pairs.push({ p, j, t: viaFmt });
  }
});
await proof('only an Accept that rates text/toon above JSON asks for it (or names it first at the same rate); */*, text/* and no Accept never do', () => {
  for (const a of ['text/toon', 'text/toon, application/json', 'application/json;q=0.5, text/toon', 'text/toon;q=0.9, */*;q=0.8', 'TEXT/TOON']) assert.equal(prefersToon(a), true, a);
  for (const a of ['', '*/*', 'text/*', 'application/json', 'application/json, text/toon', 'text/toon;q=0.5, application/json', 'text/toon;q=0', 'text/toonish', 'application/toon']) assert.equal(prefersToon(a), false, a);
  const r = (u, accept) => new Request(`https://mare.test${u}`, { headers: accept ? { accept } : {} });
  assert.equal(toonAsked(r('/about?fmt=toon')).by, 'fmt=toon'); assert.equal(toonAsked(r('/about?FMT=TOON')).by, 'fmt=toon');
  for (const [u, a] of [['/about'], ['/about?fmt=compact'], ['/about?fmt=toonx'], ['/about?xfmt=toon'], ['/mcp/app?fmt=toon'], ['/mcp/app', 'text/toon'], ['/about', '*/*']]) assert.equal(toonAsked(r(u, a)), null, `${u} ${a || ''}`);
});
await proof('the door is asked exactly what a JSON client asks: fmt=toon taken out, every other part of the query and the body byte for byte, Accept: application/json', async () => {
  const req = new Request('https://mare.test/route?q=a%20b+c&fmt=toon&free=true&x=%C3%BC', { method: 'POST', headers: { accept: 'text/toon', 'content-type': 'application/json', 'if-none-match': '"abc.toon", W/"d"' }, body: '{"q":"ä"}' });
  const t = toonAsked(req), inner = await jsonRequest(req, t);
  assert.equal(new URL(inner.url).search, '?q=a%20b+c&free=true&x=%C3%BC'); assert.equal(inner.headers.get('accept'), 'application/json');
  assert.equal(await inner.text(), '{"q":"ä"}'); assert.equal(inner.headers.get('if-none-match'), '"abc", W/"d"'); assert.equal(t.heldToon, true);
});
await proof('where TOON is not smaller, the JSON answer is sent as it was, saying why in x-sea-engine-note, with no engine headers and no count', async () => {
  const n0 = counted.length, j = await ours.call('/open.json'), t = await ours.call('/open.json?fmt=toon');
  const s = savingOf('toon', { before: j.text, beforeForm: 'json', after: toToon(JSON.parse(j.text)), afterForm: 'toon' });
  assert.ok(!(s.saved > 0), 'the proof needs an answer TOON does not shorten: /open.json');
  assert.equal(t.text, j.text); assert.match(t.headers.get('content-type'), /^application\/json/); assert.match(t.headers.get('x-sea-engine-note'), /^json kept: TOON is not smaller/);
  assert.equal(t.headers.get('x-sea-engine'), null); assert.equal(counted.length, n0);
});
await proof('errors and JSON-RPC envelopes stay JSON, said in the note; the app door ignores the ask byte for byte', async () => {
  const e = await ours.call('/nope-404?fmt=toon'), e0 = await ours.call('/nope-404');
  assert.equal(e.status, 404); assert.equal(e.text, e0.text); assert.match(e.headers.get('x-sea-engine-note'), /status 404/);
  const m = await ours.rpc('/mcp?fmt=toon', 'tools/list'), m0 = await ours.rpc('/mcp', 'tools/list');
  assert.equal(m.text, m0.text); assert.match(m.headers.get('x-sea-engine-note'), /JSON-RPC/);
  for (const o of [{}, { accept: 'text/toon' }]) { const a = await ours.rpc('/mcp/app?fmt=toon', 'tools/list', undefined, o), b = await ours.rpc('/mcp/app', 'tools/list'); assert.equal(a.text, b.text); assert.deepEqual(headersOf(a.headers), headersOf(b.headers)); }
});
await proof('counted for an agent through countEngine (lever toon, the saving of the headers, subject the door\'s path, a mind\'s key never); never for the sea\'s own calls, crawlers or HEAD; the house agent apart', async () => {
  counted.length = 0;
  const a = await ours.call('/savings.json?fmt=toon', { ip: '203.0.113.7' });
  assert.equal(counted.length, 1); const c = counted[0];
  assert.equal(c.lever, 'toon'); assert.equal(`${c.s.before}->${c.s.after}`, a.headers.get('x-sea-engine-tokens')); assert.equal(String(c.s.saved), a.headers.get('x-sea-engine-saved'));
  assert.equal(c.subject, '/savings.json'); assert.equal(c.ctx.door, '/savings.json'); assert.equal(c.ctx.ip, '203.0.113.7'); assert.equal(c.ctx.house, undefined);
  for (const ua of ['MareLiberum-session/1.0', 'Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)', 'Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)']) {
    const r = await ours.call('/savings.json?fmt=toon', { ua }); assert.equal(r.headers.get('content-type'), 'text/toon; charset=utf-8', ua);
  }
  const h = await ours.call('/savings.json?fmt=toon', { head: true }); assert.equal(h.headers.get('content-type'), 'text/toon; charset=utf-8');
  assert.equal(counted.length, 1, 'no count for the sea, crawlers or HEAD');
  await ours.call('/savings.json?fmt=toon', { ua: 'Angel/1.0' }); assert.equal(counted.length, 2); assert.equal(counted[1].ctx.house, true);
  // a mind's address is its key: what reaches the ledger is the door, /m/…
  const key = String(JSON.parse((await ours.call('/m/new')).text).mind || '').split('/m/')[1]; assert.ok(key);
  for (const text of ['one note', 'another note', 'a third note']) assert.equal((await ours.call(`/m/${key}/add`, { method: 'POST', body: { text } })).status, 200);
  const n1 = counted.length, mr = await ours.call(`/m/${key}?fmt=toon`);
  assert.equal(mr.headers.get('content-type'), 'text/toon; charset=utf-8'); assert.equal(counted.length, n1 + 1);
  assert.equal(counted.at(-1).subject, '/m/…'); assert.ok(counted.every((x) => !JSON.stringify(x).includes(key)), 'the key never reaches the ledger');
});
await proof('the fair receipt of a JSON answer survives: its field and its headers are in the TOON answer', async () => {
  const body = { a: [{ x: 1, y: 2 }, { x: 3, y: 4 }, { x: 5, y: 6 }], receipt: { id: 'r20261125abcdefgh', saved_tokens: 12, url: 'https://mare.test/fair/r/r20261125abcdefgh' } };
  const res = new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json; charset=utf-8', 'x-sea-receipt': 'https://mare.test/fair/r/r20261125abcdefgh', 'x-sea-saved-tokens': '12', 'cache-control': 'private' } });
  const t = await toonAnswer(res, {});
  assert.ok(same(fromToon(await t.text()), body)); for (const k of ['x-sea-receipt', 'x-sea-saved-tokens', 'cache-control']) assert.equal(t.headers.get(k), res.headers.get(k));
});
await proof('validators stay the door\'s: a TOON answer carries its tag marked .toon, a TOON If-None-Match is asked as the JSON tag, a 304 passes through', async () => {
  const mk = (status, etag) => new Response(status === 304 ? null : JSON.stringify({ rows: [{ a: 1, b: 2 }, { a: 3, b: 4 }, { a: 5, b: 6 }] }), { status, headers: { 'content-type': 'application/json', ...(etag ? { etag } : {}) } });
  assert.equal((await toonAnswer(mk(200, '"v1"'))).headers.get('etag'), '"v1.toon"'); assert.equal((await toonAnswer(mk(200, 'W/"v1"'))).headers.get('etag'), 'W/"v1.toon"');
  const r304 = await toonAnswer(mk(304, '"v1"'), { heldToon: true }); assert.equal(r304.status, 304); assert.equal(r304.headers.get('etag'), '"v1.toon"'); assert.equal(await r304.text(), '');
  const md304 = mk(304, '"page"'); assert.equal(await toonAnswer(md304, { heldToon: false }), md304, 'a 304 for what the client holds passes through untouched');
  assert.equal(jsonTag(toonTag('"x"')), '"x"'); assert.equal(toonTag(toonTag('"x"')), '"x.toon"');
  const md = new Response('# page', { headers: { 'content-type': 'text/markdown; charset=utf-8', etag: '"page"' } }), m = await toonAnswer(md); assert.equal(m.headers.get('etag'), '"page"'); assert.equal(await m.text(), '# page');
});
if (theirs) {
  await proof('resting ("engine" in rest of immune:policy) or switched off (MARE_ENGINE=off), nothing of it acts: fmt=toon and Accept: text/toon answer as 3.34.1 does', async () => {
    // a fresh pair of nodes, called in lockstep: the live counters of /open.json are the same on both
    const A = await nodeOf(ROOT, { site: SITE }), B = await nodeOf(refDir, { site: SITE }), seen = [];
    await A.call('/stats'); await B.call('/stats'); A.db.flow.countEngine = (...x) => seen.push(x);
    const asks = [['/savings.json?fmt=toon'], ['/search?q=mcp&fmt=toon'], ['/savings.json', 'text/toon'], ['/about', 'text/toon'], ['/open.json?fmt=toon'], ['/nope-404?fmt=toon'], ['/brain?q=x&fmt=toon', 'text/html']];
    for (const [p, accept] of asks) await sameAnswer(p, accept ? { accept } : {}, { engine: 'off' }, {}, A, B);
    A.immune.set({ rest: ['engine'] });
    try { for (const [p, accept] of [...asks, ...DEFAULTS]) await sameAnswer(p, accept ? { accept } : {}, {}, {}, A, B); } finally { A.immune.set({}); }
    for (const [p, accept] of DEFAULTS) await sameAnswer(p, accept ? { accept } : {}, { engine: 'off' }, {}, A, B);
    assert.equal(seen.length, 0, 'nothing counted while the engine rests or is off');
  });
}
restore();
console.log('what TOON spared on the doors of this node (empty sea; tokens by the one rule):');
for (const { p, j, t } of pairs) console.log(`       ${p.padEnd(16)} JSON ${String(Buffer.byteLength(j.text)).padStart(6)} B · TOON ${String(Buffer.byteLength(t.text)).padStart(6)} B · ${t.headers.get('x-sea-engine-tokens')} tokens`);

// ------------------------------------------------------------------ 5. negative controls: break a rule, the proof must fail
let caught = 0, controls = 0;
if (CONTROLS) {
  console.log('negative controls (each breaks one rule in a copy of the code; this proof must fail there)');
  const C = [
    ['the encoder leaves a number-like string unquoted', 'node/toon.mjs', '|| NUM_LIKE.test(s) ', ''],
    ['the encoder ends with a newline', 'node/toon.mjs', "return out.join('\\n');", "return out.join('\\n') + '\\n';"],
    ['tables ignore that rows must have the same keys', 'node/toon.mjs', 'if (ok.length !== ks.length) return null;', ''],
    ['the layer shapes answers nobody asked for', 'node/toondoor.mjs', 'export function toonAsked(req) {', "export function toonAsked(req) { if (!/mcp\\/app/.test(req.url)) return { url: new URL(req.url), path: new URL(req.url).pathname, by: 'accept' };"],
    ['TOON is sent even where it is larger', 'node/toondoor.mjs', 'if (!(s.saved > 0)) return kept(', 'if (false) return kept('],
    ['crawlers are counted', 'node/core.mjs', "who.kind !== 'self' && !READERS.includes(who.kind);\n  const res = await handleFair(await jsonRequest(req, t), db, cfg);", "who.kind !== 'self';\n  const res = await handleFair(await jsonRequest(req, t), db, cfg);"],
    ['the rest switch is not asked', 'node/core.mjs', "const engineActs = (cfg) => engineSwitch(cfg) && !immune.atRest?.('engine');", 'const engineActs = (cfg) => true;'],
    ['a TOON answer drops the headers of the JSON answer', 'node/toondoor.mjs', "  const h = new Headers(res.headers);\n  h.set('content-type', TOON.type);", "  const h = new Headers();\n  h.set('content-type', TOON.type);"],
  ];
  for (const [name, file, from, to] of C) {
    controls++;
    let dir = null;
    try { dir = brokenCopy(ROOT, file, from, to); const r = runIn(dir, 'tools/toon-proof.mjs', { MARE_REF_DIR: refDir || '' }); if (r.status !== 0) { caught++; console.log(`  ok   control caught: ${name}`); } else console.log(`  FAIL control NOT caught: ${name}`); }
    catch (e) { console.log(`  FAIL control could not run: ${name}: ${e.message}`); }
    finally { if (dir) drop(dir); }
  }
}
if (refDir && !process.env.MARE_REF_DIR) drop(refDir);
console.log(`\ntoon proof: ${passed} passed, ${failed} failed${CONTROLS ? `; negative controls caught ${caught} of ${controls}` : ''}${theirs ? '' : '; the comparisons with 3.34.1 did NOT run'}`);
process.exit(failed || (CONTROLS && caught !== controls) || !theirs ? 1 : 0);
