// Mare Liberum · proof of TOON (3.35, the engine's lever "toon"): node/toon.mjs against the spec's own conformance
// fixtures (4.4, vendored in tools/fixtures/toon), round trips on those and on real answers of the sea, the host types of
// §3, and fmt=toon / Accept: text/toon on the JSON doors (node/toondoor.mjs, the outermost layer of handle): only when
// asked, every default answer byte for byte what 3.34.1 sends, the TOON answer the same data as the JSON one, JSON kept
// where TOON is not smaller and for errors and JSON-RPC, the app door untouched, counted only for agents (never the sea's
// own calls, crawlers or HEAD; the house agent apart), validators intact, and with the engine resting or off nothing of
// it acts. Negative controls at the end: each rule is broken in a copy of the code, and this proof must fail there.
// Runs without the network: node tools/toon-proof.mjs   (exit code 1 when a proof fails or a control is not caught)
//   --no-controls   only the proofs (the controls run this file that way in each broken copy)
// The reference tree comes from git archive of MARE_REF (default HEAD: this release, its engine switched off; cb5ca52 for 3.34.1);
// MARE_REF_DIR names one that is there already.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { toToon, fromToon, TOON, ToonError, TOON_MIN_GAIN } from '../node/toon.mjs';
import { savingOf, engineHeaders, RATIO } from '../node/engine.mjs';
import { prefersToon, toonAsked, jsonRequest, toonAnswer, toonTag, jsonTag, toonOrJson, fieldsOf, project } from '../node/toondoor.mjs';
import { freezeTime, refTree, nodeOf, brokenCopy, runIn, drop, headersOf, same, RECEIPT_IDS, REF, OFF, AGAINST } from './engine-kit.mjs';

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
console.log(`real answers of the sea (tools/fixtures/toon/sea, read from mareliberum.dev 3.34.1): compact JSON against TOON by the one rule (node/engine.mjs); TOON goes out only at ${TOON_MIN_GAIN * 100} % fewer tokens or more`);
const SEA = readdirSync(join(FX, 'sea')).filter((f) => f.endsWith('.json')).sort();
const seaRows = SEA.map((f) => { const text = readFileSync(join(FX, 'sea', f), 'utf8'), v = JSON.parse(text), t = toToon(v), c = JSON.stringify(v); return { name: f.replace(/\.json$/, ''), text, v, t, s: savingOf('toon', { before: c, beforeForm: 'json', after: t, afterForm: 'toon' }), pick: toonOrJson(v) }; });
for (const r of seaRows) console.log(`       ${r.name.padEnd(8)} compact JSON ${String(r.s.bytes.before).padStart(6)} B ≈ ${String(r.s.before).padStart(5)} tokens · TOON ${String(r.s.bytes.after).padStart(6)} B ≈ ${String(r.s.after).padStart(5)} tokens (${(r.s.saved / r.s.before * 100).toFixed(1)} % fewer) · sent: ${r.pick.form === 'toon' ? 'TOON' : 'compact JSON'}`);
console.log(`       (tokens by ${RATIO.unit}: json ${RATIO.json}, toon ${RATIO.toon}${RATIO.assumption ? `; an assumption until the bench measures them: ${RATIO.basis}` : ''})`);
await proof(`all ${SEA.length} real answers decode from their TOON to the same data`, () => { for (const r of seaRows) assert.ok(same(fromToon(r.t), r.v), r.name); });
await proof(`TOON only where it pays (TOON_MIN_GAIN = ${TOON_MIN_GAIN}): the table of /routes.json goes out as TOON, every answer under the threshold as its compact JSON`, () => {
  assert.equal(TOON_MIN_GAIN, 0.2);
  const routes = seaRows.find((x) => x.name === 'routes'); assert.equal(routes.pick.form, 'toon'); assert.match(routes.t, /\[\d+\]\{[^}]+\}:\n/, 'the doors of /routes.json become a table');
  for (const r of seaRows) { const pays = r.s.saved > 0 && r.s.saved >= TOON_MIN_GAIN * r.s.before; assert.equal(r.pick.form, pays ? 'toon' : 'json', r.name); if (!pays) assert.equal(r.pick.text, JSON.stringify(r.v), `${r.name}: the compact JSON`); }
  const savings = seaRows.find((x) => x.name === 'savings'); assert.ok(savings.s.saved > 0 && savings.pick.form === 'json', 'savings: TOON is smaller, but not by 20 %: compact JSON');
});

// ------------------------------------------------------------------ 4. fmt=toon on the JSON doors, against 3.34.1
const restore = freezeTime();
const SITE = { '/llms.txt': { body: readFileSync(join(ROOT, 'site/llms.txt'), 'utf8'), type: 'text/plain; charset=utf-8' } };
const refDir = refTree(ROOT);
const ours = await nodeOf(ROOT, { site: SITE }), theirs = refDir ? await nodeOf(refDir, { site: SITE, cfg: OFF }) : null;
console.log(`fmt=toon and Accept: text/toon on the JSON doors (node/toondoor.mjs), against ${AGAINST}${theirs ? '' : ': NOT RUN, no tree of the release (git archive failed)'}`);
const counted = [];
const wake = async () => { await ours.call('/stats'); ours.db.flow.countEngine = (lever, s, ctx, subject) => { counted.push({ lever, s, ctx, subject }); }; if (theirs) await theirs.call('/stats'); };
await wake();
// the default answers: JSON doors, pages, Markdown, the MCP doors' lists (the discovery documents and /mcp's initialize
// change by one sanctioned line each and are proved in tools/leanmcp-proof.mjs)
const DEFAULTS = [['/about'], ['/stats'], ['/search?q=mcp'], ['/brain?q=find+mcp+servers+for+postgres'], ['/brain/areas.json'], ['/savings.json'], ['/fair.json'], ['/open.json'], ['/brief.json?q=write+a+cover+letter'], ['/works.json'], ['/routes.json'],
  ['/nope-404'], ['/', 'text/html'], ['/', 'text/markdown'], ['/brain?q=x', 'text/html'], ['/savings', 'text/html'], ['/llms.txt', '*/*'], ['/about', '*/*'], ['/search?q=mcp', 'application/json, text/toon'], ['/search?q=mcp', 'text/toon;q=0.5, application/json']];
// the version string is masked, so MARE_REF=cb5ca52 (3.34.1) is a gate too: the release may differ from it by its number only
const V = (t) => String(t).replace(/("version":")3\.3[4-6]\.\d+"/g, '$1V"');
const strip = (t) => V(String(t).replace(RECEIPT_IDS, 'r<id>'));
// against 3.34.1 (MARE_REF=cb5ca52) these answers differ on purpose: the ledger's engine part (E3), the releases and doors of
// /open, the home page's counter sentence; against this release with the engine off (the default) nothing is left out
const CHANGED_BY_RELEASE = REF === 'HEAD' ? new Set() : new Set(['/brain/areas.json', '/open.json', '/savings.json', '/savings', '/', '/llms.txt']);
const stripH = (h) => Object.fromEntries(Object.entries(headersOf(h)).map(([k, v]) => [k, strip(v)]));
// one request to a node of this branch and the same to a node of 3.34.1 (both in the same state: called in lockstep)
const sameAnswer = async (path, o = {}, cfgO = {}, cfgT = {}, A = ours, B = theirs) => {
  const a = await A.call(path, { ...o, cfg: cfgO }), b = await B.call(path, { ...o, cfg: cfgT });
  assert.equal(a.status, b.status, `${path}: status ${a.status} against ${b.status}`);
  assert.equal(strip(a.text), strip(b.text), `${path} (${o.accept || 'application/json'}): the body differs from ${AGAINST}`);
  assert.deepEqual(stripH(a.headers), stripH(b.headers), `${path}: the headers differ from ${AGAINST}`);
  return a;
};
if (theirs) {
  await proof(`every default answer is byte for byte what ${AGAINST} sends (${DEFAULTS.length} requests: JSON doors, pages, Markdown, errors, Accepts that prefer JSON)`, async () => {
    for (const [p, accept] of DEFAULTS) { if (CHANGED_BY_RELEASE.has(p.split('?')[0])) continue; const a = await sameAnswer(p, accept ? { accept } : {}); assert.ok(!a.headers.get('x-sea-engine') && !/toon/.test(a.headers.get('content-type') || '')); }
  });
  await proof(`the MCP doors' lists are byte for byte those of ${AGAINST}: /mcp tools/list, /mcp/app initialize and tools/list`, async () => {
    for (const [door, m] of [['/mcp', 'tools/list'], ['/mcp/app', 'initialize'], ['/mcp/app', 'tools/list']]) {
      const params = m === 'initialize' ? { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'toon-proof', version: '1' } } : undefined;
      const a = await ours.rpc(door, m, params), b = await theirs.rpc(door, m, params); assert.equal(V(a.text), V(b.text), `${door} ${m}`); assert.deepEqual(headersOf(a.headers), headersOf(b.headers));
    }
  });
}
// the TOON answers
const pairs = [];
const compactOf = (t) => JSON.stringify(JSON.parse(t));
const TOON_DOORS = ['/routes.json', '/web.json', '/lighthouse.json'];
await proof('fmt=toon and Accept: text/toon: where TOON is 20 % fewer tokens than the compact JSON, the answer as TOON (text/toon, vary: accept, the engine headers of savingOf), every other header kept', async () => {
  for (const p of TOON_DOORS) {
    const j = await ours.call(p), viaFmt = await ours.call(`${p}${p.includes('?') ? '&' : '?'}fmt=toon`), viaAcc = await ours.call(p, { accept: 'text/toon' });
    for (const t of [viaFmt, viaAcc]) {
      assert.equal(t.status, 200); assert.equal(t.headers.get('content-type'), 'text/toon; charset=utf-8', p);
      assert.ok(same(fromToon(t.text), JSON.parse(j.text)), `${p}: the TOON says what the JSON says`);
      const s = savingOf('toon', { before: compactOf(j.text), beforeForm: 'json', after: t.text, afterForm: 'toon' });
      assert.ok(s.saved >= TOON_MIN_GAIN * s.before, `${p}: TOON pays`); for (const [k, v] of Object.entries(engineHeaders(s))) assert.equal(t.headers.get(k), v, `${p} ${k}`);
      assert.equal(t.headers.get('x-sea-engine-lossy'), null); assert.match(t.headers.get('vary') || '', /\baccept\b/i);
      for (const [k, v] of j.headers) if (!['content-type', 'content-length', 'vary', 'etag', 'access-control-expose-headers'].includes(k)) assert.equal(t.headers.get(k), v, `${p}: header ${k} kept`);
      assert.match(t.headers.get('access-control-expose-headers') || '', /x-sea-engine-tokens/);
    }
    pairs.push({ p, j, t: viaFmt });
  }
});
await proof('under the threshold the compact JSON goes out and the note says why: /savings.json (TOON 16 % fewer), /search (19 %), /open.json (TOON larger); no engine header, no count', async () => {
  const n0 = counted.length;
  for (const p of ['/savings.json', '/search?q=mcp', '/open.json']) {
    const j = await ours.call(p), t = await ours.call(`${p}${p.includes('?') ? '&' : '?'}fmt=toon`), c = compactOf(j.text);
    const s = savingOf('toon', { before: c, beforeForm: 'json', after: toToon(JSON.parse(j.text)), afterForm: 'toon' });
    assert.ok(s.saved < TOON_MIN_GAIN * s.before, `${p} is under the threshold`);
    assert.equal(t.text, c, `${p}: the compact JSON`); assert.match(t.headers.get('content-type'), /^application\/json/); assert.match(t.headers.get('x-sea-engine-note'), /^json: TOON would be \d+ tokens against \d+ of compact JSON, less than 20 % fewer$/);
    assert.equal(t.headers.get('x-sea-engine'), null);
  }
  assert.equal(counted.length, n0);
});
await proof('only an Accept that rates text/toon above JSON asks for it (or names it first at the same rate); */*, text/* and no Accept never do; /compress and the app door are never asked', () => {
  for (const a of ['text/toon', 'text/toon, application/json', 'application/json;q=0.5, text/toon', 'text/toon;q=0.9, */*;q=0.8', 'TEXT/TOON']) assert.equal(prefersToon(a), true, a);
  for (const a of ['', '*/*', 'text/*', 'application/json', 'application/json, text/toon', 'text/toon;q=0.5, application/json', 'text/toon;q=0', 'text/toonish', 'application/toon']) assert.equal(prefersToon(a), false, a);
  const r = (u, accept) => new Request(`https://mare.test${u}`, { headers: accept ? { accept } : {} });
  assert.equal(toonAsked(r('/about?fmt=toon')).by, 'fmt=toon'); assert.equal(toonAsked(r('/about?FMT=TOON')).by, 'fmt=toon'); assert.equal(toonAsked(r('/about?fields=a')).by, 'fields');
  for (const [u, a] of [['/about'], ['/about?fmt=compact'], ['/about?fmt=toonx'], ['/about?xfmt=toon'], ['/about?fields='], ['/about?fields=,.'], ['/mcp/app?fmt=toon'], ['/mcp/app', 'text/toon'], ['/compress?fmt=toon'], ['/compress', 'text/toon'], ['/compress?fields=out'], ['/about', '*/*']]) assert.equal(toonAsked(r(u, a)), null, `${u} ${a || ''}`);
});
await proof('the door is asked exactly what a JSON client asks: fmt=toon and fields= taken out, every other part of the query and the body byte for byte, Accept: application/json', async () => {
  const req = new Request('https://mare.test/route?q=a%20b+c&fmt=toon&free=true&fields=x.y&x=%C3%BC', { method: 'POST', headers: { accept: 'text/toon', 'content-type': 'application/json', 'if-none-match': '"abc.toon", W/"d"' }, body: '{"q":"ä"}' });
  const t = toonAsked(req), inner = await jsonRequest(req, t);
  assert.equal(new URL(inner.url).search, '?q=a%20b+c&free=true&x=%C3%BC'); assert.equal(inner.headers.get('accept'), 'application/json');
  assert.equal(await inner.text(), '{"q":"ä"}'); assert.equal(inner.headers.get('if-none-match'), '"abc", W/"d"'); assert.equal(t.heldToon, true);
});
await proof('left alone, byte for byte: errors (with fmt=toon or fields=), answers that carry x-sea-engine already (a door of the engine, e.g. /compress), the app door; JSON-RPC stays JSON', async () => {
  const e0 = await ours.call('/nope-404');
  for (const q of ['?fmt=toon', '?fields=error', '?fmt=toon&fields=error.code']) { const e = await ours.call(`/nope-404${q}`); assert.equal(e.status, 404); assert.equal(e.text, e0.text); assert.deepEqual(headersOf(e.headers), headersOf(e0.headers)); }
  const shapedAlready = new Response('{"out":"x","form":"text"}', { headers: { 'content-type': 'application/json', 'x-sea-engine': 'squeeze' } });
  assert.equal(await toonAnswer(shapedAlready, { toon: true, fields: fieldsOf('out') }), shapedAlready, 'an answer the engine shaped is returned as it is');
  const m = await ours.rpc('/mcp?fmt=toon', 'tools/list'), m0 = await ours.rpc('/mcp', 'tools/list');
  assert.equal(m.text, m0.text); assert.match(m.headers.get('x-sea-engine-note'), /JSON-RPC/);
  for (const o of [{}, { accept: 'text/toon' }]) { const a = await ours.rpc('/mcp/app?fmt=toon&fields=result', 'tools/list', undefined, o), b = await ours.rpc('/mcp/app', 'tools/list'); assert.equal(a.text, b.text); assert.deepEqual(headersOf(a.headers), headersOf(b.headers)); }
});
// fields=
await proof('fields=a,b.c: only the named members, in their own order, an array element by element; lossy and said so; measured against the compact JSON of the whole answer', async () => {
  const j = await ours.call('/routes.json'), f = await ours.call('/routes.json?fields=topics.id,topics.title,shut'), full = JSON.parse(j.text), got = JSON.parse(f.text);
  assert.equal(f.status, 200); assert.match(f.headers.get('content-type'), /^application\/json/);
  assert.deepEqual(Object.keys(got), ['topics', 'shut'].filter((k) => k in full));
  assert.equal(got.topics.length, full.topics.length); for (const [i, t] of got.topics.entries()) assert.deepEqual(t, { id: full.topics[i].id, title: full.topics[i].title });
  const s = savingOf('fields', { before: JSON.stringify(full), beforeForm: 'json', after: f.text, afterForm: 'json', lossy: true });
  assert.equal(f.headers.get('x-sea-engine'), 'fields'); assert.equal(f.headers.get('x-sea-engine-lossy'), '1'); assert.equal(f.headers.get('x-sea-engine-tokens'), `${s.before}->${s.after}`); assert.equal(f.headers.get('x-sea-engine-saved'), String(s.saved));
  for (const [k, v] of j.headers) if (!['content-type', 'content-length', 'vary', 'etag', 'access-control-expose-headers'].includes(k)) assert.equal(f.headers.get(k), v, `header ${k} kept`);
  assert.deepEqual(project({ a: [{ b: 1, c: 2 }, { b: 3 }, 5, [{ b: 4 }]], d: { e: { f: 1, g: 2 } }, h: 'x' }, fieldsOf('a.b, d.e.g ,zz.top')), { a: [{ b: 1 }, { b: 3 }, [{ b: 4 }]], d: { e: { g: 2 } } });
  assert.deepEqual(project([{ x: 1, y: 2 }, { x: 3 }], fieldsOf('x')), [{ x: 1 }, { x: 3 }], 'a root array is projected element by element');
});
await proof('fields=: a path that is not there gives nothing, never an error; the fair receipt always stays, its headers too', async () => {
  const u = await ours.call('/routes.json?fields=no.such.path'); assert.equal(u.status, 200); assert.equal(u.text, '{}');
  const body = { a: Array.from({ length: 20 }, (_, i) => ({ x: i, y: i * 2, name: `row ${i}` })), other: 'long text '.repeat(40), receipt: { id: 'r20261125abcdefgh', saved_tokens: 12, url: 'https://mare.test/fair/r/r20261125abcdefgh' } };
  const res = () => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json; charset=utf-8', 'x-sea-receipt': 'https://mare.test/fair/r/r20261125abcdefgh', 'x-sea-saved-tokens': '12', 'cache-control': 'private' } });
  for (const [o, check] of [[{ toon: false, fields: fieldsOf('a.x') }, (t) => JSON.parse(t)], [{ toon: true, fields: fieldsOf('nothing') }, (t) => JSON.parse(t)], [{ toon: true }, (t) => fromToon(t)]]) {
    const r0 = res(), r = await toonAnswer(r0, o), v = check(await r.text());
    assert.deepEqual(v.receipt, body.receipt, 'the receipt stays'); for (const k of ['x-sea-receipt', 'x-sea-saved-tokens', 'cache-control']) assert.equal(r.headers.get(k), r0.headers.get(k));
  }
});
await proof('fields= with fmt=toon: the projection first, then TOON where it pays; both savings counted apart (fields lossy, toon lossless), the headers say both', async () => {
  counted.length = 0;
  const j = await ours.call('/routes.json'), f = await ours.call('/routes.json?fields=topics.id,topics.title&fmt=toon', { ip: '203.0.113.8' });
  assert.equal(f.headers.get('content-type'), 'text/toon; charset=utf-8'); assert.ok(same(fromToon(f.text), project(JSON.parse(j.text), fieldsOf('topics.id,topics.title'))));
  assert.equal(f.headers.get('x-sea-engine'), 'fields,toon'); assert.equal(f.headers.get('x-sea-engine-lossy'), '1');
  assert.deepEqual(counted.map((c) => c.lever), ['fields', 'toon']); assert.equal(counted[0].s.lossy, true); assert.equal(counted[1].s.lossy, false);
  assert.equal(f.headers.get('x-sea-engine-saved'), String(counted[0].s.saved + counted[1].s.saved)); assert.equal(f.headers.get('x-sea-engine-tokens'), `${counted[0].s.before}->${counted[1].s.after}`);
});
await proof('counted for an agent through countEngine (the lever of each saving, the saving of the headers, subject the door\'s path, a mind\'s key never); never for the sea\'s own calls, crawlers or HEAD; the house agent apart', async () => {
  counted.length = 0;
  const a = await ours.call('/routes.json?fmt=toon', { ip: '203.0.113.7' });
  assert.equal(counted.length, 1); const c = counted[0];
  assert.equal(c.lever, 'toon'); assert.equal(`${c.s.before}->${c.s.after}`, a.headers.get('x-sea-engine-tokens')); assert.equal(String(c.s.saved), a.headers.get('x-sea-engine-saved'));
  assert.equal(c.subject, '/routes.json'); assert.equal(c.ctx.door, '/routes.json'); assert.equal(c.ctx.ip, '203.0.113.7'); assert.equal(c.ctx.house, undefined);
  for (const ua of ['MareLiberum-session/1.0', 'Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)', 'Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)']) {
    const r = await ours.call('/routes.json?fmt=toon&fields=topics.id', { ua }); assert.equal(r.headers.get('x-sea-engine'), 'fields,toon', ua);
  }
  const h = await ours.call('/routes.json?fmt=toon', { head: true }); assert.equal(h.headers.get('content-type'), 'text/toon; charset=utf-8');
  assert.equal(counted.length, 1, 'no count for the sea, crawlers or HEAD');
  await ours.call('/routes.json?fmt=toon', { ua: 'Angel/1.0' }); assert.equal(counted.length, 2); assert.equal(counted[1].ctx.house, true);
  // a mind's address is its key: what reaches the ledger is the door, /m/…
  const key = String(JSON.parse((await ours.call('/m/new')).text).mind || '').split('/m/')[1]; assert.ok(key);
  for (const text of ['one note', 'another note', 'a third note']) assert.equal((await ours.call(`/m/${key}/add`, { method: 'POST', body: { text } })).status, 200);
  const n1 = counted.length, mr = await ours.call(`/m/${key}?fields=notes.text`);
  assert.equal(mr.headers.get('x-sea-engine'), 'fields'); assert.equal(counted.length, n1 + 1);
  assert.equal(counted.at(-1).subject, '/m/…'); assert.ok(counted.every((x) => !JSON.stringify(x).includes(key)), 'the key never reaches the ledger');
});
await proof('validators stay the door\'s: a TOON answer carries its tag marked .toon, a TOON If-None-Match is asked as the JSON tag, a 304 passes through; a changed JSON carries none', async () => {
  const rows = Array.from({ length: 20 }, (_, i) => ({ a: i, b: i * 2, name: `row ${i}` }));
  const mk = (status, etag, body = { rows }) => new Response(status === 304 ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...(etag ? { etag } : {}) } });
  assert.equal((await toonAnswer(mk(200, '"v1"'))).headers.get('etag'), '"v1.toon"'); assert.equal((await toonAnswer(mk(200, 'W/"v1"'))).headers.get('etag'), 'W/"v1.toon"');
  assert.equal((await toonAnswer(mk(200, '"v1"'), { toon: false, fields: fieldsOf('rows.a') })).headers.get('etag'), null, 'a projection is another document: no tag');
  const r304 = await toonAnswer(mk(304, '"v1"'), { heldToon: true }); assert.equal(r304.status, 304); assert.equal(r304.headers.get('etag'), '"v1.toon"'); assert.equal(await r304.text(), '');
  const md304 = mk(304, '"page"'); assert.equal(await toonAnswer(md304, { heldToon: false }), md304, 'a 304 for what the client holds passes through untouched');
  assert.equal(jsonTag(toonTag('"x"')), '"x"'); assert.equal(toonTag(toonTag('"x"')), '"x.toon"');
  const md = new Response('# page', { headers: { 'content-type': 'text/markdown; charset=utf-8', etag: '"page"' } }), m = await toonAnswer(md); assert.equal(m.headers.get('etag'), '"page"'); assert.equal(await m.text(), '# page');
});
if (theirs) {
  await proof(`resting ("engine" in rest of immune:policy) or switched off (MARE_ENGINE=off), nothing of it acts: fmt=toon, Accept: text/toon and fields= answer as ${AGAINST} does`, async () => {
    // a fresh pair of nodes, called in lockstep: the live counters of /open.json are the same on both
    const A = await nodeOf(ROOT, { site: SITE }), B = await nodeOf(refDir, { site: SITE, cfg: OFF }), seen = [];
    await A.call('/stats'); await B.call('/stats'); A.db.flow.countEngine = (...x) => seen.push(x);
    const asks = [['/routes.json?fmt=toon'], ['/search?q=mcp&fmt=toon'], ['/routes.json', 'text/toon'], ['/about', 'text/toon'], ['/open.json?fmt=toon'], ['/nope-404?fmt=toon'], ['/brain?q=x&fmt=toon', 'text/html'], ['/routes.json?fields=topics.id'], ['/routes.json?fields=topics.id&fmt=toon']];
    const kept = ([p]) => !CHANGED_BY_RELEASE.has(p.split('?')[0]);
    for (const [p, accept] of asks.filter(kept)) await sameAnswer(p, accept ? { accept } : {}, { engine: 'off' }, {}, A, B);
    A.immune.set({ rest: ['engine'] });
    try { for (const [p, accept] of [...asks, ...DEFAULTS].filter(kept)) await sameAnswer(p, accept ? { accept } : {}, {}, {}, A, B); } finally { A.immune.set({}); }
    for (const [p, accept] of DEFAULTS.filter(kept)) await sameAnswer(p, accept ? { accept } : {}, { engine: 'off' }, {}, A, B);
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
    ['the threshold is gone (TOON wherever it is smaller)', 'node/toon.mjs', 'export const TOON_MIN_GAIN = 0.2;', 'export const TOON_MIN_GAIN = 0;'],
    ['TOON is sent even where it is larger', 'node/toondoor.mjs', 's.saved > 0 && s.saved >= TOON_MIN_GAIN * s.before ?', 'true ?'],
    ['the layer shapes answers nobody asked for', 'node/toondoor.mjs', 'export function toonAsked(req) {', "export function toonAsked(req) { if (!/mcp\\/app/.test(req.url)) return { url: new URL(req.url), path: new URL(req.url).pathname, by: 'accept', toon: true, fields: null };"],
    ['crawlers are counted', 'node/core.mjs', "who.kind !== 'self' && !READERS.includes(who.kind);\n  const res = await handleFair(await jsonRequest(req, t), db, cfg);", "who.kind !== 'self';\n  const res = await handleFair(await jsonRequest(req, t), db, cfg);"],
    ['the rest switch is not asked', 'node/core.mjs', 'const engineActs = (cfg) => engineOn(cfg, immune);', 'const engineActs = (cfg) => true;'],
    ['a shaped answer drops the headers of the JSON answer', 'node/toondoor.mjs', "const h = new Headers(res.headers); h.delete('content-length');", "const h = new Headers(); h.delete('content-length');"],
    ['errors are shaped too', 'node/toondoor.mjs', 'if (res.status !== 200 && res.status !== 201) return res;', 'if (false) return res;'],
    ['an answer the engine shaped is shaped again', 'node/toondoor.mjs', "if (res.headers.has('x-sea-engine')) return res;", ''],
    ['a projection keeps what was not named', 'node/toondoor.mjs', 'const sub = node.get(k); if (sub === undefined) continue;', 'const sub = node.get(k) ?? true;'],
    ['a projection drops the fair receipt', 'node/toondoor.mjs', "if (!Array.isArray(v) && Object.prototype.hasOwnProperty.call(v, 'receipt') && !Object.prototype.hasOwnProperty.call(w, 'receipt')) put(w, 'receipt', v.receipt);", ''],
    ['a path that is not there is an error', 'node/toondoor.mjs', "  return undefined;\n}\n\n// ------------------------------------------------------------------ TOON where it pays", "  throw new Error('no such path');\n}\n\n// ------------------------------------------------------------------ TOON where it pays"],
    ['a projection is counted as lossless', 'node/toondoor.mjs', "after: JSON.stringify(w), afterForm: 'json', lossy: true });", "after: JSON.stringify(w), afterForm: 'json', lossy: false });"],
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
console.log(`\ntoon proof: ${passed} passed, ${failed} failed${CONTROLS ? `; negative controls caught ${caught} of ${controls}` : ''}${theirs ? '' : '; the comparisons with ${AGAINST} did NOT run'}`);
process.exit(failed || (CONTROLS && caught !== controls) || !theirs ? 1 : 0);
