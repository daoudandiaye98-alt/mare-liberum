// Mare Liberum · proof of the harbour: a sea of one's own for one crew
// keys and roles, the frame, sources and their approval, passages with their source, ways and notes, the MCP door,
// that nothing of a harbour reaches the open sea, the limits, the long memory, and the package to take home.
// Runs without the network (only this machine): node tools/harbour-proof.mjs   (exit code 1 when a proof fails)
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { handle, VERSION } from '../node/core.mjs';
import { createMem } from '../node/mem.mjs';
import { memoryKv, SeaError } from '../node/flow.mjs';
import { immune } from '../node/immune.mjs';
import { KEPT } from '../node/durable.mjs';
import { words, body, passagesOf, frameText, harbourLimits, createHarbour, sentencesOf, figuresOf, HARBOUR, HARBOUR_TOOLS, HARBOUR_VERBS } from '../node/harbour.mjs';
import { HARBOUR_UI } from '../node/harbour-ui.mjs';
import { packHome } from './lay.mjs';

let passed = 0, failed = 0;
const proof = async (name, fn) => { try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 6).join('\n       ')}`); } };

const BASE = 'https://sea.test';
const db = createMem({ file: '/nonexistent/sea.tsv', base: BASE }), kv = memoryKv();
// every name the sea writes in this run, to look for what must never appear in the open
const written = new Map(); { const set = kv.set.bind(kv); kv.set = async (k, v, ttl) => { written.set(k, v); return set(k, v, ttl); }; }
immune.use({ every: 0, kv, base: BASE, store: null }); immune.set({});
const call = async (path, { ip = '198.51.100.20', method = 'GET', body: b, key, headers = {} } = {}) => {
  const res = await handle(new Request(`${BASE}${path}`, { method, headers: { 'x-forwarded-for': ip, 'user-agent': 'proof-agent/1.0', accept: 'application/json', ...(b ? { 'content-type': 'application/json' } : {}), ...(key ? { authorization: `Bearer ${key}` } : {}), ...headers }, body: b ? JSON.stringify(b) : undefined }), db, { kv, base: BASE });
  let json = null; const text = await res.text(); try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text, headers: res.headers };
};
const post = (path, b, key, o = {}) => call(path, { method: 'POST', body: b || {}, key, ...o });
const rpc = async (key, method, params, o = {}) => (await call(o.path || '/harbour/mcp', { method: 'POST', key, body: { jsonrpc: '2.0', id: 1, method, params }, ...o }));
const tool = async (key, name, args) => { const r = await rpc(key, 'tools/call', { name, arguments: args || {} }); return { ...r.json.result, data: r.json.result?.structuredContent }; };

const HANDBOOK = `# Praxishandbuch Hygiene

## Händedesinfektion
Vor jedem Patientenkontakt werden die Hände 30 Sekunden mit dem alkoholischen Präparat desinfiziert. Schmuck an Händen und Unterarmen ist nicht erlaubt.

## Flächendesinfektion
Behandlungsliegen werden nach jedem Patienten mit dem Flächendesinfektionsmittel gewischt. Die Einwirkzeit beträgt fünf Minuten.

## Aufbereitung der Instrumente
Instrumente der Klasse kritisch B werden maschinell gereinigt und im Autoklaven bei 134 Grad sterilisiert. Jede Charge wird im Chargenbuch dokumentiert.`;
const PRICES = `# Preisliste 2026

Die Erstanamnese dauert 60 Minuten und kostet 120 Euro. Folgetermine dauern 30 Minuten und kosten 65 Euro. Abgesagte Termine werden bis 24 Stunden vorher nicht berechnet.`;

console.log('a sea of one\'s own');
let K = null, ID = null;
await proof('a crew opens a harbour and gets three keys, once; the sea keeps only their hashes', async () => {
  const r = await post('/harbour/new', { name: 'Praxis am Markt', purpose: 'Fragen des Teams zu unseren eigenen Abläufen beantworten', rules: ['Antworte auf Deutsch.', 'Nenne Dokument und Abschnitt.'] });
  assert.equal(r.status, 200, r.text); K = r.json.keys; ID = r.json.harbour.id;
  assert.match(K.owner, /^mlo_[0-9a-f]{40}$/); assert.match(K.crew, /^mlc_[0-9a-f]{40}$/); assert.match(K.guest, /^mlg_[0-9a-f]{40}$/);
  assert.equal(new Set(Object.values(K)).size, 3); assert.equal(r.json.frame.closed, true, 'a harbour is source-bound unless its owner says otherwise');
  assert.equal(r.headers.get('cache-control'), 'no-store'); assert.equal(r.headers.get('x-robots-tag'), 'noindex');
  const all = JSON.stringify([...written.entries()]);
  for (const k of Object.values(K)) assert.ok(!all.includes(k), 'no key is written anywhere');
  assert.equal((await call('/harbour/new')).status, 405, 'a harbour is opened with POST, never by following a link');
  assert.equal((await post('/harbour/new', { name: 'x' })).status, 400);
});
await proof('without a key, with a wrong key, with a key of the wrong shape: no way in', async () => {
  assert.equal((await call('/harbour/about')).status, 401);
  assert.equal((await call('/harbour/about', { key: 'mlo_' + '0'.repeat(40) })).status, 401);
  assert.equal((await call('/harbour/about', { key: K.owner.slice(0, -1) })).status, 401);
  assert.equal((await call('/harbour/about', { key: 'Bearer nonsense' })).status, 401);
  assert.equal((await rpc('', 'initialize', {})).status, 401, 'the MCP door asks for the key as well');
  const a = await call('/harbour/about', { key: K.guest }); assert.equal(a.status, 200); assert.equal(a.json.role, 'guest'); assert.equal(a.json.harbour.name, 'Praxis am Markt');
  assert.equal(a.json.connect, undefined, 'only the owner is shown how to hand the harbour on');
});
await proof('who guesses keys is asked to wait; the crew next door is not', async () => {
  let last; for (let i = 0; i < 32; i++) last = await call('/harbour/about', { key: 'mlc_' + i.toString(16).padStart(40, '0'), ip: '198.51.100.66' });
  assert.equal(last.status, 429);
  assert.equal((await call('/harbour/about', { key: K.crew })).status, 200);
});
await proof('the roles hold: a guest reads, the crew proposes, the owner decides', async () => {
  assert.equal((await post('/harbour/add', { title: 'x', text: 'a text of more than twenty characters' }, K.guest)).status, 403);
  assert.equal((await post('/harbour/frame', { purpose: 'mine now' }, K.crew)).status, 403);
  assert.equal((await post('/harbour/close', { confirm: 'Praxis am Markt' }, K.crew)).status, 403);
  assert.equal((await post('/harbour/export', {}, K.crew)).status, 403);
  assert.equal((await call('/harbour/add?title=x&text=' + 'y'.repeat(30), { key: K.owner })).status, 405, 'nothing is written by GET');
});
let SID = null;
await proof('the owner lays in a source and it answers; every passage names its source', async () => {
  const r = await post('/harbour/add', { title: 'Praxishandbuch Hygiene', text: HANDBOOK, ref: 'Version 3, Januar 2026' }, K.owner);
  assert.equal(r.status, 200, r.text); assert.equal(r.json.source.status, 'approved'); SID = r.json.source.id;
  const s = await call('/harbour/search?q=' + encodeURIComponent('Wie lange dauert die Händedesinfektion?'), { key: K.guest });
  assert.equal(s.status, 200); assert.ok(s.json.passages.length >= 1);
  assert.match(s.json.passages[0].text, /30 Sekunden/); assert.equal(s.json.passages[0].source.title, 'Praxishandbuch Hygiene'); assert.equal(s.json.passages[0].source.ref, 'Version 3, Januar 2026');
  assert.match(s.json.rule, /only from these passages/);
  // close forms of a word find the passage (Instrument = Instrumente, sterilisieren = sterilisiert)
  const t = await call('/harbour/search?q=' + encodeURIComponent('Instrument sterilisieren'), { key: K.guest });
  assert.match(t.json.passages[0].text, /Autoklaven/);
});
await proof('what no approved source covers is said to be uncovered', async () => {
  const s = await call('/harbour/search?q=' + encodeURIComponent('Welche Dosierung von Ibuprofen bei Kindern?'), { key: K.crew });
  assert.equal(s.json.passages.length, 0); assert.match(s.json.rule, /No approved source/); assert.match(s.json.rule, /do not answer from general knowledge/);
});
let PID = null;
await proof('what the crew lays in waits for the owner; until then no answer rests on it', async () => {
  const r = await post('/harbour/add', { title: 'Preisliste 2026', text: PRICES }, K.crew);
  assert.equal(r.json.source.status, 'proposed'); PID = r.json.source.id;
  assert.equal((await call('/harbour/search?q=Erstanamnese+Kosten', { key: K.crew })).json.passages.length, 0);
  assert.equal((await call('/harbour/sources', { key: K.guest })).json.count, 1, 'a guest sees approved sources only');
  assert.equal((await call('/harbour/sources', { key: K.crew })).json.count, 2);
  assert.equal((await call(`/harbour/read/${PID}`, { key: K.guest })).status, 404);
  assert.equal((await post('/harbour/approve', { id: PID }, K.crew)).status, 403);
  assert.equal((await post('/harbour/approve', { id: PID }, K.owner)).json.source.status, 'approved');
  const s = await call('/harbour/search?q=Erstanamnese+Kosten', { key: K.guest });
  assert.match(s.json.passages[0].text, /120 Euro/); assert.equal(s.json.passages[0].source.title, 'Preisliste 2026');
});
await proof('the same title again is a new version; the old words no longer answer', async () => {
  const r = await post('/harbour/add', { title: 'preisliste 2026', text: PRICES.replace('120 Euro', '135 Euro') }, K.owner);
  assert.equal(r.json.source.id, PID); assert.equal(r.json.source.version, 2);
  const s = await call('/harbour/search?q=Erstanamnese+Kosten', { key: K.guest });
  assert.match(s.json.passages[0].text, /135 Euro/); assert.ok(!JSON.stringify(s.json).includes('120 Euro'));
  assert.equal((await call('/harbour/sources', { key: K.owner })).json.count, 2);
});
await proof('a source taken out is gone from every answer', async () => {
  const x = await post('/harbour/add', { title: 'Alte Regel', text: 'Die Mittagspause beginnt um zwölf Uhr und endet um dreizehn Uhr.' }, K.owner);
  assert.match((await call('/harbour/search?q=Mittagspause', { key: K.guest })).json.passages[0].text, /zwölf Uhr/);
  assert.equal((await post('/harbour/remove', { id: x.json.source.id }, K.owner)).json.title, 'Alte Regel');
  assert.equal((await call('/harbour/search?q=Mittagspause', { key: K.guest })).json.passages.length, 0);
  assert.equal((await call(`/harbour/read/${x.json.source.id}`, { key: K.owner })).status, 404);
});
await proof('what a reader cannot see is taken out of a source; its lines stay', async () => {
  const hidden = 'Sichtbarer Satz eins.' + String.fromCharCode(0x200b, 0x202e) + '\n\nSichtbarer Satz zwei.' + String.fromCharCode(0x7) + ' Ende des Textes.';
  const r = await post('/harbour/add', { title: 'Mit Verstecktem', text: hidden }, K.owner);
  const t = (await call(`/harbour/read/${r.json.source.id}`, { key: K.owner })).json.source.text;
  assert.ok(!/[\u200b\u202e\u0007]/.test(t)); assert.match(t, /eins\.\s*\n\nSichtbarer Satz zwei/);
  await post('/harbour/remove', { id: r.json.source.id }, K.owner);
  assert.equal(body('a\r\nb\n\n\n\nc  d\t e', 100), 'a\nb\n\nc d e');
});
let WID = null;
await proof('ways: how a task is done here; ways that hold rise, ways that fail fade', async () => {
  const a = await post('/harbour/lay', { task: 'Neuen Patienten aufnehmen', how: '1. Anamnesebogen ausgeben. 2. Einwilligung unterschreiben lassen. 3. Termin für die Erstanamnese (60 Minuten) eintragen.' }, K.crew);
  assert.equal(a.status, 200, a.text); WID = a.json.way.id;
  const b = await post('/harbour/lay', { task: 'Neuen Patienten aufnehmen', how: 'Einfach einen Termin eintragen, der Rest ergibt sich.' }, K.crew);
  assert.notEqual(b.json.way.id, WID);
  await post('/harbour/rate', { id: WID, worked: true, note: 'lief ohne Rückfrage' }, K.crew);
  await post('/harbour/rate', { id: b.json.way.id, worked: false, note: 'Einwilligung fehlte' }, K.crew);
  const t = await call('/harbour/think?task=' + encodeURIComponent('neue Patientin aufnehmen'), { key: K.guest });
  assert.equal(t.json.ways[0].id, WID, 'the way that held comes first'); assert.equal(t.json.ways[0].worked, 1); assert.equal(t.json.ways[0].notes[0].text, 'lief ohne Rückfrage');
  assert.ok(t.json.ways[1].strength < t.json.ways[0].strength);
  assert.equal((await post('/harbour/lay', { task: 'x', how: 'y' }, K.crew)).status, 400);
  assert.equal((await post('/harbour/lay', { task: 'Etwas', how: 'Ein Weg, der genügt.' }, K.guest)).status, 403);
  assert.equal((await post('/harbour/rate', { id: 'nope', worked: true }, K.crew)).status, 404);
});
await proof('think gives the three shelves at once: ways, passages, notes', async () => {
  await post('/harbour/note', { text: 'Die Erstanamnese macht nur Frau Berger.', tag: 'team' }, K.crew);
  const t = await call('/harbour/think?task=' + encodeURIComponent('Erstanamnese für neuen Patienten planen'), { key: K.crew });
  assert.ok(t.json.ways.length >= 1); assert.ok(t.json.sources.some((p) => /Erstanamnese/.test(p.text))); assert.equal(t.json.notes[0].text, 'Die Erstanamnese macht nur Frau Berger.');
  assert.equal(t.json.frame.sourceBound, true);
  assert.equal((await call('/harbour/notes?tag=team', { key: K.guest })).json.notes.length, 1);
  assert.equal((await post('/harbour/note', { text: 'x' }, K.guest)).status, 403);
});
await proof('a draft is held against the sources: every sentence, every figure; and the check says what it cannot see', async () => {
  const draft = 'Vor jedem Patientenkontakt werden die Hände 30 Sekunden desinfiziert. Die Einwirkzeit der Flächendesinfektion beträgt zehn Minuten bei 45 Grad. Die Erstanamnese kostet 135 Euro. Der Mond besteht aus grünem Käse und kreist um den Jupiter.';
  const r = await post('/harbour/check', { text: draft }, K.guest);
  assert.equal(r.status, 200, r.text); assert.equal(r.json.checked, 4);
  const [a, b, c, d] = r.json.sentences;
  assert.equal(a.found, 'yes'); assert.equal(a.source.title, 'Praxishandbuch Hygiene');
  assert.equal(b.found, 'figure not in the sources', 'the words are there, the figure 45 is in no source'); assert.equal(b.figuresMissing, 1);
  assert.equal(c.found, 'yes'); assert.equal(c.source.title.toLowerCase(), 'preisliste 2026');
  assert.equal(d.found, 'no'); assert.equal(d.source, undefined);
  assert.match(r.json.rule, /Remove or rewrite/); assert.match(r.json.limits, /cannot judge whether the sentence means/);
  const clean = await post('/harbour/check', { text: 'Instrumente der Klasse kritisch B werden im Autoklaven bei 134 Grad sterilisiert.' }, K.guest);
  assert.equal(clean.json.found, 1); assert.match(clean.json.rule, /Every sentence long enough to judge finds its words/); assert.equal(clean.json.tooShort, 0);
  // a short sentence is never passed over in silence: it is named as not judged, and its figures are held against the sources all the same
  const brief = await post('/harbour/check', { text: 'Instrumente der Klasse kritisch B werden im Autoklaven bei 134 Grad sterilisiert. Wir haben auch sonntags geöffnet. Bei 180 Grad. Jede Charge.' }, K.guest);
  assert.equal(brief.json.checked, 4, JSON.stringify(brief.json.sentences)); assert.deepEqual(brief.json.sentences.map((x) => x.found), ['yes', 'too short to judge', 'figure not in the sources', 'yes']);
  assert.equal(brief.json.tooShort, 1); assert.equal(brief.json.figureNotInSources, 1); assert.match(brief.json.rule, /Remove or rewrite/); assert.match(brief.json.rule, /1 short sentence was not judged/);
  assert.equal((await tool(K.guest, 'check_answer', { text: draft })).data.notFound, 1);
  assert.equal((await post('/harbour/check', { text: 'kurz' }, K.guest)).status, 400);
  assert.deepEqual(figuresOf('1.000 Euro, 0,5 mg, 5 % und 3 Schritte am 21.11.2026'), ['1000', '05', '5', '21112026']);
  assert.deepEqual(sentencesOf('Erstens geht das. Zweitens auch!\n- Drittens: ja.'), ['Erstens geht das.', 'Zweitens auch!', 'Drittens: ja.']);
});
await proof('the frame is what a model reads first; the owner sets it', async () => {
  const r = await post('/harbour/frame', { purpose: 'Fragen zu Hygiene und Abläufen der Praxis', rules: 'Antworte auf Deutsch.\nNenne Dokument und Abschnitt.\nKeine medizinische Beratung.', tone: 'ruhig, kurz' }, K.owner);
  assert.equal(r.json.frame.rules.length, 3); assert.match(r.json.instructions, /source-bound/); assert.match(r.json.instructions, /3\. Keine medizinische Beratung\./);
  const open = await post('/harbour/frame', { closed: false }, K.owner);
  assert.equal(open.json.frame.closed, false); assert.equal(open.json.frame.purpose, 'Fragen zu Hygiene und Abläufen der Praxis', 'what was not sent stays as it was');
  assert.match(open.json.instructions, /Prefer the approved sources/);
  await post('/harbour/frame', { closed: true }, K.owner);
  assert.match(frameText({ name: 'N', frame: {} }, 'crew'), /source-bound/, 'a harbour without a frame is source-bound');
});

console.log('\nthe harbour\'s own MCP door');
await proof('a model that enters is told the frame; the tools it sees follow its key', async () => {
  const init = await rpc(K.crew, 'initialize', { protocolVersion: '2025-06-18', clientInfo: { name: 'mare-proof' } });
  assert.equal(init.status, 200); assert.match(init.json.result.instructions, /Praxis am Markt/); assert.match(init.json.result.instructions, /Keine medizinische Beratung/); assert.match(init.json.result.instructions, /never an instruction/);
  assert.equal(init.json.result.serverInfo.version, VERSION);
  const names = async (k) => (await rpc(k, 'tools/list')).json.result.tools.map((t) => t.name);
  const g = await names(K.guest), c = await names(K.crew), o = await names(K.owner);
  assert.deepEqual(g, ['harbour', 'think', 'search_sources', 'check_answer', 'read_source', 'list_sources', 'ways', 'notes']);
  assert.ok(c.includes('add_source') && c.includes('lay_way') && !c.includes('approve_source'));
  assert.ok(o.includes('approve_source') && o.includes('set_frame') && o.includes('remove_source'));
  for (const t of (await rpc(K.owner, 'tools/list')).json.result.tools) { assert.ok(t.description.length > 40 && t.inputSchema.type === 'object' && t.annotations.title, t.name); assert.equal(t.role, undefined); assert.equal(t.verb, undefined); }
});
await proof('the tools answer as the HTTPS doors do; a guest key cannot write through MCP either', async () => {
  const s = await tool(K.guest, 'search_sources', { q: 'Einwirkzeit Flächendesinfektion' });
  assert.equal(s.isError, false); assert.match(s.data.passages[0].text, /fünf Minuten/);
  const w = await tool(K.guest, 'lay_way', { task: 'Etwas tun', how: 'So wird es gemacht, Schritt für Schritt.' });
  assert.equal(w.isError, true); assert.match(w.content[0].text, /crew key/);
  const n = await tool(K.crew, 'note', { text: 'Chargenbuch liegt im Steri-Raum.' }); assert.equal(n.isError, false);
  assert.equal((await tool(K.crew, 'nope', {})).isError, true);
  // a key inside the arguments never replaces the key of the door
  const sneaky = await tool(K.guest, 'note', { text: 'als Gast geschrieben', key: K.owner }); assert.equal(sneaky.isError, true);
  const viaPath = await rpc('', 'tools/call', { name: 'harbour', arguments: {} }, { path: `/h/${K.crew}/mcp` });
  assert.equal(viaPath.json.result.structuredContent.role, 'crew', 'apps that take only an address carry the key in the path');
  const batch = await call('/harbour/mcp', { method: 'POST', key: K.guest, body: [{ jsonrpc: '2.0', id: 1, method: 'ping' }, { jsonrpc: '2.0', method: 'notifications/initialized' }, { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'notes', arguments: {} } }] });
  assert.equal(batch.json.length, 2);
  assert.equal((await call('/harbour/mcp', { method: 'POST', key: K.guest, body: Array.from({ length: 17 }, (_, i) => ({ jsonrpc: '2.0', id: i, method: 'ping' })) })).status, 400);
});
await proof('an assistant at the open door can open a harbour for its person', async () => {
  const r = await call('/mcp', { method: 'POST', ip: '198.51.100.31', body: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'harbour_new', arguments: { name: 'Kanzlei Nord', purpose: 'Mandatsfragen nur aus freigegebenen Quellen' } } } });
  assert.equal(r.json.result.isError, false); assert.match(r.json.result.structuredContent.keys.owner, /^mlo_/);
  const listed = (await call('/mcp', { method: 'POST', body: { jsonrpc: '2.0', id: 1, method: 'tools/list' } })).json.result.tools.map((t) => t.name);
  assert.ok(listed.includes('harbour_new'));
  const app = (await call('/mcp/app', { method: 'POST', body: { jsonrpc: '2.0', id: 1, method: 'tools/list' } })).json.result.tools.map((t) => t.name);
  assert.ok(!app.includes('harbour_new'), 'the door under review at the assistants stays as it is');
});

console.log('\nwhat stays inside, and what the sea still guards');
await proof('nothing a harbour holds reaches the open sea: not the flow, the census, the brain or the index', async () => {
  const marks = ['Praxishandbuch', '30 Sekunden', 'Frau Berger', 'Chargenbuch', 'Patienten aufnehmen', 'Praxis am Markt', 'Kanzlei Nord'];
  for (const path of ['/flow', '/flow/dump', '/census', '/live.json', '/visitors.json', '/missing.json', '/stats', '/status.json', '/brain?q=Hygiene+Handbuch+der+Praxis', '/notes', '/here', '/immune.json']) {
    const r = await call(path); for (const m of marks) assert.ok(!r.text.includes(m), `${path} holds "${m}"`);
    for (const k of Object.values(K)) assert.ok(!r.text.includes(k), `${path} holds a key`);
  }
  const s = await call('/search', { method: 'POST', body: { query: { text: 'Praxishandbuch Hygiene' } } }); assert.ok(!s.text.includes('30 Sekunden'));
  // the doors of a visit are written down without what follows /h/
  await call(`/h/${K.guest}/about`); await call(`/h/${K.guest}/search?q=Hygiene`);
  const open = [...written.entries()].filter(([k]) => !k.startsWith('harbour:'));
  for (const [k, v] of open) { const t = JSON.stringify(v); for (const key of Object.values(K)) assert.ok(!t.includes(key) && !k.includes(key), `the name ${k} holds a key`); for (const m of marks.slice(0, 5)) assert.ok(!t.includes(m), `the name ${k} holds "${m}"`); }
  assert.ok([...written.keys()].filter((k) => k.startsWith('harbour:')).every((k) => KEPT.test(k)), 'everything of a harbour goes to the long memory');
});
await proof('calm mode rests the writes of a harbour like every write; reading goes on', async () => {
  immune.set({ mode: 'calm', note: 'drill' });
  assert.equal((await post('/harbour/note', { text: 'während der Ruhe' }, K.crew)).status, 503);
  assert.equal((await post('/harbour/new', { name: 'In der Ruhe' }, null, { ip: '198.51.100.41' })).status, 503);
  assert.equal((await call('/harbour/search?q=Hygiene', { key: K.guest })).status, 200);
  immune.set({ rest: ['/harbour', '/h'] });
  assert.equal((await call('/harbour/about', { key: K.guest })).status, 503, 'the operator can rest the harbours as one door');
  assert.equal((await call(`/h/${K.guest}/about`)).status, 503);
  assert.equal((await call('/brain')).status, 200, 'the open sea is not touched by it');
  immune.set({});
  assert.equal((await post('/harbour/note', { text: 'nach der Ruhe' }, K.crew)).status, 200);
});
await proof('the operator can rest one harbour or close it; the harbour next door is not touched', async () => {
  const f = await post('/harbour/new', { name: 'Gemeldet' }, null, { ip: '198.51.100.77' }), ko = f.json.keys.owner, id = f.json.harbour.id;
  assert.match(id, /^[a-f0-9]{12}$/);
  await post('/harbour/add', { title: 'Etwas', text: 'Ein Text, der in diesem Hafen liegt, mit genug Zeichen für einen Abschnitt.' }, ko);
  const before = (await call('/harbour')).json.harbours;
  // at rest: every door of this harbour says so and why; what it holds is kept
  immune.set({ harbours: [{ id, do: 'rest', why: 'a report is being looked at' }, { id: 'not-an-id', do: 'close' }, { id: 'ffffffffffff', do: 'close' }] });
  const r = await call('/harbour/about', { key: ko });
  assert.equal(r.status, 503, r.text); assert.match(r.json.error.message, /rests by decision of the operator.*a report is being looked at/);
  assert.equal((await post('/harbour/note', { text: 'eine Notiz' }, f.json.keys.crew)).status, 503);
  assert.equal((await call(`/h/${f.json.keys.guest}/about`)).status, 503);
  assert.match((await rpc(ko, 'tools/call', { name: 'search_sources', arguments: { q: 'Text Hafen' } })).text, /rests by decision of the operator/);
  assert.equal((await call('/harbour/about', { key: K.guest })).status, 200, 'the harbour next door answers as before');
  assert.equal((await call('/harbour')).json.harbours, before, 'a harbour at rest is still there');
  assert.deepEqual((await call('/immune.json')).json.harboursHeld, { atRest: 1, closed: 1 }, 'the sea says how many it holds, not which');
  immune.set({});
  assert.equal((await call('/immune.json')).json.harboursHeld, undefined);
  assert.match((await call('/harbour/search?q=Text+Hafen', { key: ko })).json.passages[0].text, /in diesem Hafen/, 'lifted, it answers again with all it holds');
  // closed: taken away the next time the harbours are counted, even when nobody comes with a key any more
  immune.set({ harbours: [{ id, do: 'close', why: 'unlawful content' }] });
  assert.equal((await call('/harbour')).json.harbours, before - 1);
  for (const [k] of written) if (k.includes(`:${id}`)) assert.equal(await kv.get(k), null, `${k} is still there`);
  assert.equal((await call('/harbour/about', { key: ko })).status, 401);
  // and whoever comes with a key first is told what happened
  const g = await post('/harbour/new', { name: 'Auch gemeldet' }, null, { ip: '198.51.100.78' });
  immune.set({ harbours: [{ id: g.json.harbour.id, do: 'close', why: 'unlawful content' }] });
  const gone = await call('/harbour/about', { key: g.json.keys.owner });
  assert.equal(gone.status, 410, gone.text); assert.match(gone.json.error.message, /closed by the operator.*unlawful content/);
  immune.set({});
  assert.equal((await call('/harbour/about', { key: g.json.keys.owner })).status, 401, 'closed stays closed');
  assert.equal((await call('/harbour')).json.harbours, before - 1);
  assert.equal((await call('/harbour/about', { key: K.guest })).status, 200);
});
await proof('a harbour counts its use and the kinds of program that call, never what was asked; the operator can give one harbour more room', async () => {
  const f = await post('/harbour/new', { name: 'Zählwerk' }, null, { ip: '198.51.100.90' }), ko = f.json.keys.owner, kg = f.json.keys.guest, id = f.json.harbour.id;
  const as = (ua, path, key) => call(path, { key, ip: '198.51.100.90', headers: { 'user-agent': ua } });
  await as('Claude-User/1.0', '/harbour/about', kg); await as('Cursor/1.2.3', '/harbour/sources', kg); await as('Cursor/1.2.3', '/harbour/search?q=geheime+frage', kg);
  await call('/harbour/mcp', { key: kg, method: 'POST', headers: { 'user-agent': 'python-httpx/0.27' }, body: { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', clientInfo: { name: 'ChatGPT', version: '1' }, capabilities: {} } } });
  const about = (await call('/harbour/about', { key: ko })).json;
  assert.ok(about.use.today >= 5 && about.use.month === about.use.today && about.use.all === about.use.today, JSON.stringify(about.use));
  for (const c of ['claude', 'cursor', 'chatgpt']) assert.ok(about.use.clients.includes(c), `${c} in ${about.use.clients}`);
  assert.equal((await call('/harbour/about', { key: kg })).json.use, undefined, 'a guest does not see the count');
  await call('/harbour');   // the count is written with the next look at the harbours
  const kept = await kv.get(`harbour:u:${id}`); assert.ok(kept.all >= 5); assert.ok(!JSON.stringify(kept).includes('geheime') && !JSON.stringify(kept).includes('198.51'), 'no question and no address in the count');
  // more room for one harbour, by the operator's word; the others keep theirs
  assert.equal(about.holds.room, HARBOUR.chars); assert.equal(about.holds.plan, undefined);
  immune.set({ harbours: [{ id, room: 10, plan: 'team' }] });
  const roomy = (await call('/harbour/about', { key: ko })).json; assert.equal(roomy.holds.room, HARBOUR.chars * 10); assert.equal(roomy.holds.plan, 'team');
  assert.equal((await call('/immune.json')).json.harboursHeld.atRest, 0, 'room alone does not rest a harbour');
  assert.equal((await call('/harbour/about', { key: K.owner })).json.holds.room, HARBOUR.chars);
  immune.set({});
  assert.equal((await post('/harbour/close', { confirm: 'Zählwerk' }, ko)).status, 200); assert.equal(await kv.get(`harbour:u:${id}`), null, 'closing takes the count away too');
});
await proof('room has an end: per harbour, per network, and for the node as a whole', async () => {
  // per network: three new harbours a day
  const ip = '198.51.100.50'; for (let i = 0; i < 3; i++) assert.equal((await post('/harbour/new', { name: `Hafen ${i}` }, null, { ip })).status, 200);
  assert.equal((await post('/harbour/new', { name: 'Hafen 4' }, null, { ip })).status, 429);
  // per harbour: a small one fills up
  const mk = (lim) => { const k2 = memoryKv(); const upd = async (k, ttl, change) => { const next = change(await k2.get(k)); await k2.set(k, next, ttl); return next; }; return createHarbour({ kv: k2, update: upd, allow: async () => {}, api: {}, SeaError, clean: (s, n) => (s == null ? undefined : String(s).trim().slice(0, n) || undefined), strip: (o) => { for (const k of Object.keys(o)) if (o[k] == null || o[k] === '') delete o[k]; return o; }, now: () => new Date().toISOString(), sha: async (s) => Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))).toString('hex'), https: () => undefined, DAY: 86400, base: BASE, limits: { ...HARBOUR, ...lim } }); };
  const h = mk({ sources: 2, chars: 300, harbours: 2 }), ctx = { ip: '203.0.113.9' };
  const a = await h.harbourNew({ name: 'Klein' }, ctx), key = { ...ctx, key: a.keys.owner };
  await h.harbourAdd({ title: 'Eins', text: 'x'.repeat(200) }, key);
  const full = await h.harbourAdd({ title: 'Zwei', text: 'y'.repeat(200) }, key).catch((e) => e); assert.equal(full.status, 429); assert.match(full.message, /download/);
  await h.harbourAdd({ title: 'Zwei', text: 'y'.repeat(80) }, key);
  const many = await h.harbourAdd({ title: 'Drei', text: 'z'.repeat(15) + ' genug Text' }, key).catch((e) => e); assert.equal(many.status, 429);
  // a new version of a source may use the room of the version before it
  assert.equal((await h.harbourAdd({ title: 'Eins', text: 'w'.repeat(210) }, key)).source.version, 2);
  // the node as a whole
  await h.harbourNew({ name: 'Zweiter' }, ctx);
  const none = await h.harbourNew({ name: 'Dritter' }, ctx).catch((e) => e); assert.equal(none.status, 429); assert.match(none.message, /full for the moment/);
  // a node of one's own has more room
  assert.equal(harbourLimits(10).sources, HARBOUR.sources * 10); assert.equal(harbourLimits(10).chars, HARBOUR.chars * 10); assert.equal(harbourLimits('x').chars, HARBOUR.chars); assert.equal(harbourLimits(1e9).sources, HARBOUR.sources * 100);
});
await proof('a key that got out is replaced; the old one stops at once', async () => {
  const r = await post('/harbour/rekey', { role: 'guest' }, K.owner); assert.match(r.json.key, /^mlg_/);
  assert.equal((await call('/harbour/about', { key: K.guest })).status, 401);
  assert.equal((await call('/harbour/about', { key: r.json.key })).json.role, 'guest'); K.guest = r.json.key;
  assert.equal((await post('/harbour/rekey', { role: 'owner' }, K.crew)).status, 403);
  assert.equal((await post('/harbour/rekey', { role: 'king' }, K.owner)).status, 400);
});
await proof('the owner carries the harbour to another node: a copy out, a copy in', async () => {
  const ex = await post('/harbour/export', {}, K.owner);
  assert.equal(ex.json.format, 'mare-harbour/1'); assert.equal(ex.json.sources.length, 2); assert.ok(ex.json.ways.length >= 2); assert.ok(ex.json.notes.length >= 2);
  assert.ok(!JSON.stringify(ex.json).includes('mlo_') && !JSON.stringify(ex.json).includes('harbour:k:'), 'a copy carries no key');
  const fresh = await post('/harbour/new', { name: 'Praxis, eigener Rechner' }, null, { ip: '198.51.100.61' }), ko = fresh.json.keys.owner;
  const im = await post('/harbour/import', ex.json, ko);
  assert.equal(im.status, 200, im.text); assert.equal(im.json.imported.sources, 2); assert.ok(im.json.imported.ways >= 2);
  assert.match((await call('/harbour/search?q=Händedesinfektion', { key: ko })).json.passages[0].text, /30 Sekunden/);
  assert.equal((await call('/harbour/about', { key: ko })).json.frame.purpose, 'Fragen zu Hygiene und Abläufen der Praxis');
  assert.equal((await post('/harbour/import', { format: 'something else' }, ko)).status, 400);
});
await proof('closing takes everything away, and asks for the name first', async () => {
  const f = await post('/harbour/new', { name: 'Auf Zeit' }, null, { ip: '198.51.100.62' }), ko = f.json.keys.owner, id = f.json.harbour.id;
  await post('/harbour/add', { title: 'Etwas', text: 'Ein Text, der wieder verschwinden soll, mit genug Zeichen.' }, ko); await post('/harbour/note', { text: 'eine Notiz' }, ko);
  assert.equal((await post('/harbour/close', {}, ko)).status, 400); assert.equal((await post('/harbour/close', { confirm: 'auf zeit' }, ko)).status, 400);
  const before = (await call('/harbour')).json.harbours;
  assert.equal((await post('/harbour/close', { confirm: 'Auf Zeit' }, ko)).json.closed, 'Auf Zeit');
  assert.equal((await call('/harbour/about', { key: ko })).status, 401); assert.equal((await call('/harbour/about', { key: f.json.keys.guest })).status, 401);
  for (const [k] of written) if (k.includes(`:${id}`)) assert.equal(await kv.get(k), null, `${k} is still there`);
  assert.equal((await call('/harbour')).json.harbours, before - 1);
});

console.log('\nthe pages and the package to take home');
await proof('the page of the harbours: for people, with a desk that keeps the key in the page only', async () => {
  const r = await call('/harbour', { headers: { accept: 'text/html' } });
  assert.equal(r.status, 200); assert.match(r.text, /A sea of your own/); assert.match(r.text, /Open a harbour/); assert.match(r.text, /Helsinki/);
  assert.ok(!/localStorage|sessionStorage|document\.cookie/.test(HARBOUR_UI), 'the key is not stored'); assert.ok(!/innerHTML|insertAdjacentHTML|document\.write/.test(HARBOUR_UI), 'what a harbour holds is put on the page as text');
  assert.ok(!HARBOUR_UI.includes('`') && !/<\/script/i.test(HARBOUR_UI));
  for (const id of [...HARBOUR_UI.matchAll(/\$\('([a-z]+)'\)/g)].map((m) => m[1])) assert.ok(new RegExp(`id="${id}"`).test(r.text), `the page has no element "${id}"`);
  const j = await call('/harbour'); assert.equal(j.headers.get('content-type').split(';')[0], 'application/json'); assert.ok(j.json.verbs.includes(`POST ${BASE}/harbour/add`));
  assert.match((await call('/sitemaps/site.xml')).text, /\/harbour<\/loc>/);
  assert.equal(Object.keys(HARBOUR_VERBS).length, 20); assert.equal(HARBOUR_TOOLS.length, 15);
});
await proof('words, passages: a question finds its passage across forms of a word', async () => {
  assert.deepEqual(words('Die Zahnärzte desinfizieren Instrumente'), words('zahnarzt desinfiziert instrument').map((w, i) => (i === 1 ? words('desinfizieren')[0] : w)));
  assert.equal(words('Zahnärzte')[0], words('Zahnarzt')[0]); assert.equal(words('sources')[0], words('source')[0]);
  assert.deepEqual(words('der die das und'), []);
  const ps = passagesOf(Array.from({ length: 12 }, (_, i) => `Absatz ${i}. ` + 'Wort '.repeat(60)).join('\n\n'), 900);
  assert.ok(ps.length >= 4 && ps.every((p) => p.length <= 1100)); assert.equal(passagesOf('kurz').length, 1); assert.ok(passagesOf('x'.repeat(5000), 900).length >= 5);
});
await proof('the package to take home starts empty on a machine of its own, and a harbour works on it', async () => {
  const cwd = process.cwd(); process.chdir(join(import.meta.dirname, '..'));
  let info; try { info = packHome(); } finally { process.chdir(cwd); }
  assert.ok(info && info.bytes > 100_000 && /^[0-9a-f]{64}$/.test(info.sha256)); assert.equal(info.version, VERSION);
  const tar = gunzipSync(readFileSync(join(import.meta.dirname, '..', 'public', 'download', info.file)));
  // unpack by hand: the archive is read the way it was written
  const dir = mkdtempSync(join(tmpdir(), 'mare-home-')), names = [];
  const { mkdirSync, writeFileSync } = await import('node:fs'), { dirname } = await import('node:path');
  for (let o = 0; o + 512 <= tar.length;) { const name = tar.subarray(o, o + 100).toString('utf8').replace(/\0.*$/, ''); if (!name) break; const size = parseInt(tar.subarray(o + 124, o + 135).toString('ascii'), 8); assert.ok(!name.includes('..') && name.startsWith('mare-liberum/')); names.push(name); const to = join(dir, name); mkdirSync(dirname(to), { recursive: true }); writeFileSync(to, tar.subarray(o + 512, o + 512 + size)); o += 512 + Math.ceil(size / 512) * 512; }
  for (const f of ['serve.mjs', 'README.md', 'start.sh', 'start.cmd', 'Dockerfile', 'LICENSE', 'package.json', 'node/core.mjs', 'node/harbour.mjs', 'site/index.html']) assert.ok(names.includes(`mare-liberum/${f}`), `${f} is missing`);
  assert.ok(!names.some((n) => /\.env|secret|\.git|node_modules|probe|data\//.test(n)), 'nothing that does not belong travels along');
  assert.equal(JSON.parse(readFileSync(join(dir, 'mare-liberum', 'package.json'), 'utf8')).dependencies, undefined);
  const home = join(dir, 'mare-liberum'), port = 18000 + Math.floor(Math.random() * 2000);
  const node = spawn(process.execPath, ['serve.mjs', String(port)], { cwd: home, env: { PATH: process.env.PATH, MARE_STATE: './state', MARE_HARBOUR_ROOM: '10' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; node.stdout.on('data', (d) => { out += d; }); node.stderr.on('data', (d) => { out += d; });
  try {
    for (let i = 0; i < 60 && !/Mare Liberum on/.test(out); i++) await new Promise((r) => setTimeout(r, 100));
    assert.match(out, /0 entries in the index/, out.slice(0, 400)); assert.match(out, /state on disk/); assert.match(out, /long memory off/);
    const at = `http://127.0.0.1:${port}`, j = async (path, o = {}) => { const r = await fetch(at + path, { ...o, headers: { accept: 'application/json', 'content-type': 'application/json', 'user-agent': 'proof-agent/1.0', ...(o.headers || {}) } }); return { status: r.status, json: await r.json().catch(() => null) }; };
    const made = await j('/harbour/new', { method: 'POST', body: JSON.stringify({ name: 'Daheim', purpose: 'Probe' }) });
    assert.equal(made.status, 200); const ko = made.json.keys.owner, auth = { authorization: `Bearer ${ko}` };
    assert.equal((await j('/harbour')).json.room.sources, HARBOUR.sources * 10, 'a node of one\'s own has more room');
    assert.equal((await j('/harbour/add', { method: 'POST', headers: auth, body: JSON.stringify({ title: 'Hausordnung', text: 'Die Haustür wird um zweiundzwanzig Uhr abgeschlossen. Besuch meldet sich am Empfang.' }) })).status, 200);
    assert.match((await j('/harbour/search?q=Haust%C3%BCr+abgeschlossen', { headers: auth })).json.passages[0].text, /zweiundzwanzig Uhr/);
    const init = await j('/harbour/mcp', { method: 'POST', headers: auth, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }) });
    assert.match(init.json.result.instructions, /Daheim/);
    assert.equal((await fetch(at + '/harbour', { headers: { accept: 'text/html' } })).status, 200); assert.equal((await fetch(at + '/download', { headers: { accept: 'text/html' } })).status, 200);
    assert.equal((await j('/brain?q=test')).status, 200, 'the open doors of the node work without an index');
    // asked to stop, the node writes its state; started again, the harbour is still there
    node.kill('SIGTERM'); await new Promise((r) => node.on('exit', r));
    assert.ok(existsSync(join(home, 'state', 'sea.ndjson'))); assert.ok(readdirSync(join(home, 'state')).length >= 1);
    const again = spawn(process.execPath, ['serve.mjs', String(port)], { cwd: home, env: { PATH: process.env.PATH, MARE_STATE: './state', MARE_HARBOUR_ROOM: '10' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out2 = ''; again.stdout.on('data', (d) => { out2 += d; }); again.stderr.on('data', (d) => { out2 += d; });
    try {
      for (let i = 0; i < 60 && !/Mare Liberum on/.test(out2); i++) await new Promise((r) => setTimeout(r, 100));
      assert.match((await j('/harbour/search?q=Besuch+Empfang', { headers: auth })).json.passages[0].text, /Empfang/);
    } finally { again.kill('SIGKILL'); }
  } finally { node.kill('SIGKILL'); rmSync(dir, { recursive: true, force: true }); }
});

console.log(`\n${passed} proofs hold${failed ? `, ${failed} FAIL` : ''}`);
process.exit(failed ? 1 : 0);
