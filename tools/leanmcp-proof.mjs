// Mare Liberum · proof of the lean MCP door /mcp/lean (3.35, the engine's levers "lean" and "toon"): four tools instead of
// every tool; find_tools finds the right one by need (BM25, deterministic); call_tool answers exactly as /mcp does (the
// same structuredContent); the text the model reads is TOON where smaller and says the same; counted only for agents;
// /mcp's tool list and the app door byte for byte those of 3.34.1, /mcp's instructions longer by one sentence only, the
// discovery documents by one line each; resting or off, the lean door is the open door and everything is 3.34.1 again.
// Negative controls at the end: each rule is broken in a copy of the code, and this proof must fail there.
// Runs without the network: node tools/leanmcp-proof.mjs   (exit code 1 when a proof fails or a control is not caught)
//   --no-controls   only the proofs (the controls run this file that way in each broken copy)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fromToon, TOON_MIN_GAIN } from '../node/toon.mjs';
import { savingOf } from '../node/engine.mjs';
import { leanSentence, findTools } from '../node/leanmcp.mjs';
import { freezeTime, refTree, nodeOf, brokenCopy, runIn, drop, headersOf, same, RECEIPT_IDS, REF, OFF, AGAINST } from './engine-kit.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTROLS = !process.argv.includes('--no-controls');
delete process.env.MARE_ENGINE; delete process.env.MARE_FAIR;
let passed = 0, failed = 0;
const proof = async (name, fn) => { try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 5).join('\n       ')}`); } };
globalThis.fetch = async (u) => { throw new Error(`the proof does not use the network: ${String(u).slice(0, 80)}`); };

freezeTime();
const SITE = { '/llms.txt': { body: readFileSync(join(ROOT, 'site/llms.txt'), 'utf8'), type: 'text/plain; charset=utf-8' } };
// the version string is masked, so MARE_REF=cb5ca52 (3.34.1) is a gate too: the release may differ from it by its number only
const V = (t) => String(t).replace(/("version":")3\.3[4-6]\.\d+"/g, '$1V"');
const BASE = 'https://mare.test', refDir = refTree(ROOT);
const ours = await nodeOf(ROOT, { site: SITE, base: BASE }), theirs = refDir ? await nodeOf(refDir, { site: SITE, base: BASE, cfg: OFF }) : null;
const counted = [];
await ours.call('/stats'); if (theirs) await theirs.call('/stats');
ours.db.flow.countEngine = (lever, s, ctx, subject) => { counted.push({ lever, s, ctx, subject }); };
const INIT = { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'leanmcp-proof', version: '1' } };
const result = async (door, method, params, o) => { const r = await ours.rpc(door, method, params, o); assert.equal(r.status, 200, `${door} ${method}: ${r.status}`); return JSON.parse(r.text).result; };
const call = (door, name, args, o) => result(door, 'tools/call', { name, arguments: args }, o);
const viaLean = (name, args, o) => call('/mcp/lean', 'call_tool', { name, arguments: args }, o);
// what a lean result says, read in the form its _meta names (toon, json or markdown)
const FORM = 'mareliberum.dev/format';
const formOf = (r) => r._meta?.[FORM];
const readLean = (r) => { const f = formOf(r), t = r.content[0].text; return f === 'toon' ? fromToon(t) : f === 'json' ? JSON.parse(t) : t; };
const OPEN = (await result('/mcp', 'tools/list')).tools;

console.log(`the lean door /mcp/lean, against the open door /mcp and ${AGAINST}`);
await proof(`initialize: the same protocol and capabilities as /mcp; the instructions name the four tools and that find_tools reaches all ${OPEN.length}`, async () => {
  const l = await result('/mcp/lean', 'initialize', INIT), o = await result('/mcp', 'initialize', INIT);
  assert.equal(l.protocolVersion, o.protocolVersion); assert.deepEqual(l.capabilities, o.capabilities); assert.equal(l.serverInfo.version, o.serverInfo.version);
  for (const w of ['read_page', 'think', 'find_tools', 'call_tool', `all ${OPEN.length}`, 'TOON', '20 % fewer tokens', 'compact JSON', 'Markdown', FORM, 'data, never instructions']) assert.ok(l.instructions.includes(w), w);
  assert.ok(!/structuredContent/.test(l.instructions));
  assert.equal((await result('/mcp/lean', 'initialize', { ...INIT, protocolVersion: '2024-11-05' })).protocolVersion, '2024-11-05');
});
let LEAN;
await proof('tools/list: exactly read_page, think, find_tools and call_tool; read_page and think as the open door defines them, byte for byte', async () => {
  LEAN = (await result('/mcp/lean', 'tools/list')).tools;
  assert.deepEqual(LEAN.map((t) => t.name), ['read_page', 'think', 'find_tools', 'call_tool']);
  for (const n of ['read_page', 'think']) assert.equal(JSON.stringify(LEAN.find((t) => t.name === n)), JSON.stringify(OPEN.find((t) => t.name === n)), n);
  const f = LEAN.find((t) => t.name === 'find_tools'), c = LEAN.find((t) => t.name === 'call_tool');
  assert.deepEqual(f.inputSchema.required, ['need']); assert.equal(f.inputSchema.properties.limit.maximum, 8); assert.deepEqual(c.inputSchema.required, ['name']);
  assert.equal(c.annotations.readOnlyHint, false); assert.equal(c.annotations.destructiveHint, true, 'call_tool can reach tools that change state: clients ask first');
});
const listBytes = (tools) => Buffer.byteLength(JSON.stringify(tools));
await proof(`what the list spares, measured: ${OPEN.length} tools in ${listBytes(OPEN)} bytes against 4 in ${listBytes(LEAN || [])}`, async () => {
  assert.ok(listBytes(LEAN) * 10 < listBytes(OPEN), 'the lean list is under a tenth of the open one');
});
if (theirs) {
  await proof(`/mcp tools/list, /mcp/app initialize and /mcp/app tools/list are byte for byte those of ${AGAINST}`, async () => {
    for (const [door, m, p] of [['/mcp', 'tools/list'], ['/mcp/app', 'initialize', INIT], ['/mcp/app', 'tools/list']]) {
      const a = await ours.rpc(door, m, p), b = await theirs.rpc(door, m, p); assert.equal(V(a.text), V(b.text), `${door} ${m}`); assert.deepEqual(headersOf(a.headers), headersOf(b.headers), `${door} ${m} headers`);
    }
  });
  await proof(`/mcp initialize differs from ${AGAINST} by one sentence: where the lean door is and what it spares, its numbers measured from the two lists`, async () => {
    const a = (await result('/mcp', 'initialize', INIT)).instructions, b = JSON.parse((await theirs.rpc('/mcp', 'initialize', INIT)).text).result.instructions, s = leanSentence(BASE, OPEN);
    assert.ok(a.includes(s)); assert.equal(a.replace(s, ''), b, 'everything else is as it was');
    assert.equal((s.match(/[.;]\s/g) || []).length <= 1 && /^ A lean door/.test(s) && s.trim().endsWith('.'), true, 'one sentence');
    assert.ok(s.includes(`${listBytes(LEAN).toLocaleString('en-US')} instead of ${listBytes(OPEN).toLocaleString('en-US')} bytes`), s);
  });
}
// the same answer through both doors: the tools whose answers do not move with the counters of the sea
const PARITY = [['search', { query: 'postgres' }], ['think', { q: 'find mcp servers for postgres' }], ['brief', { task: 'write a cover letter for a job in Köln' }], ['get', { identifier: 'urn:air:mare.test:mcp:nothing' }],
  ['build_agent', {}], ['build_agent', { name: 'Shelf', kind: 'monitor', purpose: 'watch prices' }], ['review', { task: 'a product description', draft: 'Lorem ipsum dolor sit amet. TODO: add price.' }], ['compare_prompts', { a: 'Write a poem.', b: 'Write a four-line poem about the sea, plain words.' }], ['works', {}], ['read_page', { url: 'https://example.com/' }]];
await proof(`call_tool answers as /mcp tools/call: its text says what /mcp's structuredContent says (and the same error) for ${PARITY.length} calls of ${new Set(PARITY.map(([n]) => n)).size} tools`, async () => {
  for (const [name, args] of PARITY) {
    const o = await call('/mcp', name, args), l = await viaLean(name, args);
    assert.equal(l.isError, o.isError, name);
    if (o.isError) { assert.equal(l.content[0].text, o.content[0].text, `${name}: the same error`); continue; }
    if (name === 'read_page') { assert.equal(formOf(l), 'markdown'); const sc = o.structuredContent; assert.ok(sc.error || sc.blocked ? l.content[0].text.startsWith(`Error: ${sc.error || sc.note}`) : l.content[0].text.includes(sc.markdown), 'read_page: the page as Markdown'); continue; }
    assert.ok(same(readLean(l), o.structuredContent), `${name}: the lean text says what /mcp's structuredContent says`);
  }
  const o = await call('/mcp', 'search', { query: 'zzqx nothing matches this' }), l = await viaLean('search', { query: 'zzqx nothing matches this' });
  assert.ok(o.structuredContent.empty && same(readLean(l), o.structuredContent), 'an empty answer says what to do next (firstContact), on both doors');
  for (const n of ['read_page', 'think']) { const a = n === 'think' ? { q: 'cheap flights' } : { url: 'https://example.com/' }, d = await call('/mcp/lean', n, a), v = await viaLean(n, a); assert.equal(d.content[0].text, v.content[0].text); assert.equal(formOf(d), formOf(v)); assert.equal(d.isError, v.isError); }
});
await proof('a lean result is text only: one text block, no structuredContent, the form in _meta; TOON only where it is at least 20 % fewer tokens than the compact JSON, else the compact JSON', async () => {
  const forms = {};
  for (const [name, args] of [...PARITY, ['find_tools', null]]) {
    const l = name === 'find_tools' ? await call('/mcp/lean', 'find_tools', { need: 'buy something' }) : await viaLean(name, args); if (l.isError) continue;
    assert.equal('structuredContent' in l, false, name); assert.equal(l.content.length, 1); assert.equal(l.content[0].type, 'text'); assert.ok(['toon', 'json', 'markdown'].includes(formOf(l)), name);
    forms[formOf(l)] = (forms[formOf(l)] || 0) + 1;
    if (formOf(l) === 'markdown') continue;
    const v = readLean(l), json = JSON.stringify(v), s = savingOf('toon', { before: json, beforeForm: 'json', after: l.content[0].text, afterForm: 'toon' });
    if (formOf(l) === 'toon') assert.ok(s.saved >= TOON_MIN_GAIN * s.before, `${name}: TOON pays`); else assert.equal(l.content[0].text, json, `${name}: the compact JSON`);
  }
  assert.ok(forms.toon >= 1 && forms.json >= 1, `forms seen: ${JSON.stringify(forms)}`);
});
await proof('read_page on the lean door: the page as Markdown in the form /r/ answers by default (Title, URL Source, Markdown Content, the line to cite it), the same page the open door hands as JSON', async () => {
  const page = { url: 'https://example.org/a', final: 'https://example.org/a', title: 'A page', markdown: '# A page\n\nText with "quotes", a tab\tand two lines.\n\n- one\n- two', links: [{ text: 'next', url: 'https://example.org/b' }], host: 'example.org' };
  const real = ours.db.flow.read; ours.db.flow.read = async () => ({ ...page });
  try {
    const o = (await call('/mcp', 'read_page', { url: page.url })).structuredContent;
    for (const l of [await call('/mcp/lean', 'read_page', { url: page.url }), await viaLean('read_page', { url: page.url })]) {
      assert.equal(formOf(l), 'markdown'); const t = l.content[0].text;
      assert.ok(t.startsWith(`Title: A page\nURL Source: https://example.org/a\nMarkdown Content:\n${o.markdown}\n\n---\nCite the URL Source above`), t.slice(0, 200));
      assert.ok(!t.includes('\\n'), 'real lines, no escaped newlines');
    }
  } finally { ours.db.flow.read = real; }
});
await proof('find_tools: "buy something" → ask, "read a web page as markdown" → read_page, "how do agents see my site" → check_site, each first; the same answer twice', async () => {
  for (const [need, want] of [['buy something', 'ask'], ['read a web page as markdown', 'read_page'], ['how do agents see my site', 'check_site'], ['private memory across sessions', 'mind_new']]) {
    const a = readLean(await call('/mcp/lean', 'find_tools', { need })), b = readLean(await call('/mcp/lean', 'find_tools', { need }));
    assert.equal(a.tools[0]?.name, want, `${need}: ${a.tools.map((t) => t.name).join(', ')}`); assert.deepEqual(a, b, 'deterministic');
  }
});
await proof('find_tools hands each match with one line and the input schema of the open door; limit 1-8 (default 5); no words → the names of all tools', async () => {
  const r = readLean(await call('/mcp/lean', 'find_tools', { need: 'search the open index for mcp servers' }));
  assert.equal(r.tools.length, 5); assert.equal(r.of, OPEN.length);
  for (const t of r.tools) { const o = OPEN.find((x) => x.name === t.name); assert.deepEqual(t.inputSchema, o.inputSchema); assert.ok(!t.description.includes('\n') && t.description.length <= 200 && o.description.startsWith(t.description.replace(/[.;]$/, ''))); }
  assert.equal(readLean(await call('/mcp/lean', 'find_tools', { need: 'search', limit: 2 })).tools.length, 2);
  assert.equal(readLean(await call('/mcp/lean', 'find_tools', { need: 'search the index agents servers stores memory', limit: 50 })).tools.length, 8);
  const e = readLean(await call('/mcp/lean', 'find_tools', { need: '' })); assert.equal(e.tools.length, 0); assert.deepEqual(e.names, OPEN.map((t) => t.name));
  assert.deepEqual(findTools(OPEN, 'buy something', 3), findTools(OPEN, 'buy something', 3));
});
await proof('only the tools of the open set: an unknown name, call_tool or find_tools through call_tool, and open tools called directly are refused with the way to them', async () => {
  for (const n of ['nope', 'call_tool', 'find_tools']) { const r = await viaLean(n, {}); assert.equal(r.isError, true, n); assert.match(r.content[0].text, /find_tools/); }
  const d = await call('/mcp/lean', 'search', { query: 'x' }); assert.equal(d.isError, true); assert.match(d.content[0].text, /call_tool/);
});
// verify-3.35 I2: a tools/list alone (registry checkers, monitors, scripts) puts no list in front of a model and counts nothing;
// the lean list's saving counts when a client calls a tool (the ledger keeps it to once a day per network)
await proof('counted through countEngine: lean when a client calls a tool (the two lists, the one rule), never for a tools/list alone; toon per call where TOON was sent; door /mcp/lean, subject the tool', async () => {
  counted.length = 0;
  await result('/mcp/lean', 'tools/list', undefined, { ip: '203.0.113.9' });
  assert.equal(counted.length, 0, 'a list alone counts nothing');
  await viaLean('find_tools', { need: 'read a web page' }, { ip: '203.0.113.9' });
  const leans = counted.filter((x) => x.lever === 'lean'); assert.equal(leans.length, 1); const c = leans[0], s = savingOf('lean', { before: JSON.stringify(OPEN), beforeForm: 'json', after: JSON.stringify(LEAN), afterForm: 'json' });
  assert.equal(c.lever, 'lean'); assert.deepEqual(c.s, s); assert.equal(c.subject, 'tools/list'); assert.equal(c.ctx.door, '/mcp/lean'); assert.equal(c.ctx.ip, '203.0.113.9');
  for (const [name, args] of [['build_agent', {}], ['brief', { task: 'write a cover letter for a job in Köln' }]]) {
    const n0 = counted.length, r = await viaLean(name, args), t = counted.slice(n0).filter((x) => x.lever === 'toon');
    assert.equal(t.length, formOf(r) === 'toon' ? 1 : 0, name); if (t.length) { assert.equal(t[0].subject, name); assert.equal(t[0].ctx.door, '/mcp/lean'); }
  }
});
await proof('never counted for the sea\'s own calls or crawlers (HEAD is refused: 405); the house agent apart', async () => {
  counted.length = 0;
  for (const ua of ['MareLiberum-session/1.0', 'Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)', 'Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)']) {
    await result('/mcp/lean', 'tools/list', undefined, { ua }); await viaLean('brief', { task: 'write a cover letter' }, { ua });
  }
  assert.equal(counted.length, 0);
  const h = await ours.call('/mcp/lean', { method: 'HEAD', head: true }); assert.equal(h.status, 405);
  await viaLean('find_tools', { need: 'read a web page' }, { ua: 'Angel/1.0' }); const lean = counted.filter((x) => x.lever === 'lean'); assert.equal(lean.length, 1); assert.equal(lean[0].ctx.house, true);
});
await proof('the same door rules as /mcp: batches of up to 16 answered in order, 17 refused; a browser is sent to the guide, other GETs 405; /mcp/lean/ is the same door', async () => {
  const batch = (n) => ours.call('/mcp/lean', { method: 'POST', accept: 'application/json, text/event-stream', body: Array.from({ length: n }, (_, i) => ({ jsonrpc: '2.0', id: i + 1, method: 'ping' })) });
  const b3 = JSON.parse((await batch(3)).text); assert.deepEqual(b3.map((x) => x.id), [1, 2, 3]);
  assert.equal((await batch(17)).status, 400);
  const g = await ours.call('/mcp/lean', { accept: 'text/html' }); assert.equal(g.status, 303); assert.match(g.headers.get('location'), /\/mcp-server$/);
  assert.equal((await ours.call('/mcp/lean')).status, 405);
  assert.equal((await ours.rpc('/mcp/lean/', 'tools/list')).text, (await ours.rpc('/mcp/lean', 'tools/list')).text);
});
if (theirs) {
  const strip = (t) => V(String(t).replace(RECEIPT_IDS, 'r<id>'));
  await proof(`the discovery documents name the lean door in one line each (server card, agent card, /connect), and differ from ${AGAINST} by nothing else`, async () => {
    const sc = JSON.parse((await ours.call('/.well-known/mcp/server-card.json')).text), sc0 = (await theirs.call('/.well-known/mcp/server-card.json')).text;
    assert.deepEqual(sc.remotes[1], { type: 'streamable-http', url: `${BASE}/mcp/lean` }); sc.remotes.splice(1, 1); assert.equal(V(JSON.stringify(sc)), V(sc0));
    const ac = JSON.parse((await ours.call('/.well-known/agent-card.json')).text), ac0 = (await theirs.call('/.well-known/agent-card.json')).text, line = ` (the lean door, 4 tools that reach all: ${BASE}/mcp/lean)`;
    assert.ok(ac.description.includes(line)); ac.description = ac.description.replace(line, ''); assert.equal(V(JSON.stringify(ac)), V(ac0));
    const cj = (await ours.call('/connect.json')).text, cj0 = (await theirs.call('/connect.json')).text, lean = cj.split('\n').filter((l) => l.startsWith('"lean":'));
    assert.equal(lean.length, 1); assert.match(lean[0], /"url":"https:\/\/mare\.test\/mcp\/lean","tools":4/);
    // since 3.36 every client that takes an MCP address carries the lean door as its second option (clients[].lean, and a
    // block of its own in its box on the page): the doors' line and those, nothing else
    const cjo = JSON.parse(cj); delete cjo.doors.lean; assert.equal(cjo.clients.filter((c) => c.lean).length, 18); for (const c of cjo.clients) delete c.lean;
    assert.equal(strip(`${ours.core.lineJson(cjo)}\n`), strip(cj0));
    const cp = (await ours.call('/connect', { accept: 'text/html' })).text, cp0 = (await theirs.call('/connect', { accept: 'text/html' })).text, para = /<p id="door-lean">[^\n]*<\/p>\n/, opt = /<div class="lean-opt" id="lean-[a-z0-9-]+">[\s\S]*?<\/div>\n/g;
    assert.match(cp, para); assert.equal((cp.match(opt) || []).length, 18); assert.equal(strip(cp.replace(para, '').replace(opt, '')), strip(cp0));
  });
  await proof(`resting ("engine" in rest of immune:policy) or switched off (MARE_ENGINE=off): /mcp/lean answers as /mcp; /mcp, the app door, the cards and /connect are ${AGAINST} byte for byte`, async () => {
    const A = await nodeOf(ROOT, { site: SITE, base: BASE }), B = await nodeOf(refDir, { site: SITE, base: BASE, cfg: OFF }), seen = [];
    await A.call('/stats'); await B.call('/stats'); A.db.flow.countEngine = (...x) => seen.push(x);
    const check = async (cfg) => {
      for (const m of ['initialize', 'tools/list']) {
        const p = m === 'initialize' ? INIT : undefined, l = await A.rpc('/mcp/lean', m, p, { cfg }), o = await A.rpc('/mcp', m, p, { cfg }), r = await B.rpc('/mcp', m, p);
        assert.equal(l.text, o.text, `lean ${m} answers as /mcp`); assert.equal(V(o.text), V(r.text), `/mcp ${m} is ${AGAINST}`);
        assert.equal(V((await A.rpc('/mcp/app', m, p, { cfg })).text), V((await B.rpc('/mcp/app', m, p)).text));
      }
      for (const path of ['/.well-known/mcp/server-card.json', '/.well-known/agent-card.json', '/connect.json']) { const a = await A.call(path, { cfg }), b = await B.call(path); assert.equal(strip(a.text), strip(b.text), path); }
      assert.equal(strip((await A.call('/connect', { accept: 'text/html', cfg })).text), strip((await B.call('/connect', { accept: 'text/html' })).text));
      const c = JSON.parse((await A.rpc('/mcp/lean', 'tools/call', { name: 'call_tool', arguments: { name: 'search', arguments: { query: 'x' } } }, { cfg })).text).result;
      assert.equal(c.isError, true, 'resting, the lean door is the open door: call_tool is no tool there');
    };
    await check({ engine: 'off' });
    A.immune.set({ rest: ['engine'] }); try { await check({}); } finally { A.immune.set({}); }
    assert.equal(seen.length, 0, 'nothing counted while the engine rests or is off');
  });
}
const cut = (n) => n.toLocaleString('en-US');
console.log(`what the lean door spares on every tools/list: ${cut(listBytes(OPEN))} → ${cut(listBytes(LEAN || []))} bytes, ${savingOf('lean', { before: JSON.stringify(OPEN), beforeForm: 'json', after: JSON.stringify(LEAN || []), afterForm: 'json' }).before} → ${savingOf('lean', { before: JSON.stringify(OPEN), beforeForm: 'json', after: JSON.stringify(LEAN || []), afterForm: 'json' }).after} tokens by the one rule`);

// ------------------------------------------------------------------ negative controls: break a rule, the proof must fail
let caught = 0, controls = 0;
if (CONTROLS) {
  console.log('negative controls (each breaks one rule in a copy of the code; this proof must fail there)');
  const C = [
    ['call_tool skips what an empty answer says next (firstContact)', 'node/core.mjs', "        firstContact(tool, args, out, base);\n        // the shop links of a buying answer, as on the open door", "        // the shop links of a buying answer, as on the open door"],
    ['find_tools ranks the weakest match first', 'node/leanmcp.mjs', '.sort((a, b) => b.s - a.s || a.i - b.i)', '.sort((a, b) => a.s - b.s || a.i - b.i)'],
    ['the lean door lists every tool', 'node/core.mjs', "return ok({ tools: LEAN_TOOLS });", 'return ok({ tools: OPEN_TOOLS });'],
    ['crawlers are counted at the lean door', 'node/core.mjs', 'const count = (lever, s, subject) => { if (own || uncounted || !s) return;', 'const count = (lever, s, subject) => { if (own || !s) return;'],
    ['the app door is answered by the lean door', 'node/core.mjs', "lean = leanOn && path === '/mcp/lean';", "lean = (leanOn && path === '/mcp/lean') || app;"],
    ['the rest switch is not asked at the lean door', 'node/core.mjs', "lean = leanOn && path === '/mcp/lean';", "lean = path === '/mcp/lean';"],
    ['the lean door sends structuredContent again', 'node/core.mjs', "return ok({ content: [{ type: 'text', text: t.text }], _meta: { [LEAN_FORMAT]: t.form }, isError: false });", "return ok({ content: [{ type: 'text', text: t.text }], structuredContent: out, _meta: { [LEAN_FORMAT]: t.form }, isError: false });"],
    ['read_page answers JSON on the lean door', 'node/core.mjs', "if (subject === 'read_page' && out", "if (subject === 'read_page_' && out"],
    ['the lean door names no form', 'node/core.mjs', "_meta: { [LEAN_FORMAT]: t.form }, isError: false });", 'isError: false });'],
  ];
  for (const [name, file, from, to] of C) {
    controls++;
    let dir = null;
    try { dir = brokenCopy(ROOT, file, from, to); const r = runIn(dir, 'tools/leanmcp-proof.mjs', { MARE_REF_DIR: refDir || '' }); if (r.status !== 0) { caught++; console.log(`  ok   control caught: ${name}`); } else console.log(`  FAIL control NOT caught: ${name}`); }
    catch (e) { console.log(`  FAIL control could not run: ${name}: ${e.message}`); }
    finally { if (dir) drop(dir); }
  }
}
if (refDir && !process.env.MARE_REF_DIR) drop(refDir);
console.log(`\nleanmcp proof: ${passed} passed, ${failed} failed${CONTROLS ? `; negative controls caught ${caught} of ${controls}` : ''}${theirs ? '' : '; the comparisons with 3.34.1 did NOT run'}`);
process.exit(failed || (CONTROLS && caught !== controls) || !theirs ? 1 : 0);
