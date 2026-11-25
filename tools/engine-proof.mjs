// Mare Liberum · proof of the engine room (3.35): every lever is counted in the public ledger by one rule, lossless and
// lossy apart; lossless savings join measured as their own kind and lossy ones never; the sea's own calls, crawlers and
// HEAD count nowhere, the house agent apart; once a day per network and subject, capped per network and day; no receipt
// for them; old days of the ledger read exactly as before; /engine and its twins answer; the rest switch "engine" holds.
// Runs without the network: node tools/engine-proof.mjs   (exit code 1 when a proof fails; --no-controls skips the
// negative controls, which break each rule in a copy of the code and expect this proof to fail there)
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { handle, callerOf, isHouse, seaOf } from '../node/core.mjs';
import { memoryKv } from '../node/flow.mjs';
import { createMem } from '../node/mem.mjs';
import { createLedger } from '../node/ledger.mjs';
import { payConfig } from '../node/pay.mjs';
import { immune } from '../node/immune.mjs';
import { savingOf, engineHeaders, engineOn, engineSwitch, tokensOf, bytesOf, LEVERS, RATIO, ENGINE_RATIOS, ENGINE_VERSION } from '../node/engine.mjs';
import { createAreas, savingsOf, engineOf, engineKey, SAVE } from '../node/areas.mjs';
import { TOKEN_RATIO } from '../node/proof.mjs';
import { tallyRun } from '../node/tally.mjs';
import { loadEngineBench, ENGINE_RULES } from '../node/engine-ui.mjs';
import { HUB_PATHS } from '../node/hubs.mjs';
import { ENDPOINTS } from '../node/open.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url)), CONTROLS = !process.argv.includes('--no-controls');
let passed = 0, failed = 0;
const proof = async (name, fn) => { try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 4).join('\n       ')}`); } };
globalThis.fetch = async (u) => { throw new Error(`the proof does not use the network: ${String(u).slice(0, 80)}`); };
const UA = { agent: 'proof-agent/1.0', own: 'MareLiberum-session/1.0', gptbot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot',
  claudebot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ClaudeBot/1.0; +claudebot@anthropic.com', googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', angel: 'Angel/1.0 (house agent)' };

// ------------------------------------------------------------------ a ledger of its own, at a fixed time, for direct calls
const NOW = '2026-11-25T12:00:00.000Z', DAY = 86400;
const strip = (o) => JSON.parse(JSON.stringify(o));
const ledgerOf = (kv = memoryKv()) => {
  const update = async (key, ttl, change) => { const v = change(await kv.get(key)); await kv.set(key, v, ttl); return v; };
  return { kv, A: createAreas({ kv, update, allow: async () => {}, api: {}, SeaError: Error, clean: (s) => s, strip, now: () => NOW, DAY, entryOf: null, base: 'https://mare.test' }) };
};
const JSON_ROWS = JSON.stringify({ results: Array.from({ length: 12 }, (_, i) => ({ id: `urn:air:x${i}.example:mcp:sea`, name: `Server ${i}`, kind: 'mcp', quality: i % 4, url: `https://x${i}.example/mcp` })) });
const TABLE = (o) => { const r = JSON.parse(o).results, k = Object.keys(r[0]); return `results[${r.length}]{${k.join(',')}}:\n${r.map((x) => `  ${k.map((f) => x[f]).join(',')}`).join('\n')}`; };
const S = { toon: savingOf('toon', { before: JSON_ROWS, beforeForm: 'json', after: TABLE(JSON_ROWS), afterForm: 'toon' }) };
const agent = (ip = '198.18.20.1', extra = {}) => ({ ip, door: '/search', ...extra });

console.log('the one rule (node/engine.mjs)');
await proof('savingOf: before and after in UTF-8 bytes, made tokens with the ratio of each form; saved is the difference, never below zero', () => {
  const s = S.toon; assert.equal(s.lever, 'toon'); assert.equal(s.before, Math.round(bytesOf(JSON_ROWS) / RATIO.json)); assert.equal(s.after, Math.round(bytesOf(TABLE(JSON_ROWS)) / RATIO.toon));
  assert.equal(s.saved, s.before - s.after); assert.ok(s.saved > 0, 'TOON of a table is smaller'); assert.equal(s.lossy, false); assert.deepEqual(s.bytes, { before: bytesOf(JSON_ROWS), after: bytesOf(TABLE(JSON_ROWS)) });
  const grow = savingOf('toon', { before: '{}', beforeForm: 'json', after: 'x'.repeat(400), afterForm: 'toon' }); assert.equal(grow.saved, 0, 'no saving is never a negative one');
  assert.equal(tokensOf('md', 'é'.repeat(100)), Math.round(200 / RATIO.md), 'bytes are UTF-8 bytes, not characters');
  assert.equal(savingOf('budget', { before: 'a'.repeat(900), beforeForm: 'md', after: 'a', afterForm: 'md' }).lossy, true, 'budget is lossy by its lever');
  assert.equal(savingOf('squeeze', { before: 'a'.repeat(900), after: 'a' }).lossy, true, 'squeeze is lossy unless the step says lossless');
  assert.equal(savingOf('squeeze', { before: 'a'.repeat(900), after: 'a', lossy: false }).lossy, false);
});
await proof('engineHeaders: the fixed names, x-sea-engine-lossy only when the saving lost something; nothing for no saving object', () => {
  assert.deepEqual(engineHeaders(S.toon), { 'x-sea-engine': 'toon', 'x-sea-engine-tokens': `${S.toon.before}->${S.toon.after}`, 'x-sea-engine-saved': String(S.toon.saved) });
  assert.equal(engineHeaders(savingOf('budget', { before: 'a'.repeat(900), after: 'a' }))['x-sea-engine-lossy'], '1'); assert.deepEqual(engineHeaders(null), {});
  assert.deepEqual(Object.keys(LEVERS), ['toon', 'lean', 'squeeze', 'delta', 'budget', 'fields']); assert.equal(LEVERS.fields.lossless, false); assert.equal(ENGINE_VERSION, 'engine-1');
});
await proof('the ratios: JSON and TOON as the newest bench measured them (o200k_base); HTML, Markdown and plain text always the proof\'s', () => {
  assert.equal(RATIO.html, TOKEN_RATIO.bytes.html); assert.equal(RATIO.md, TOKEN_RATIO.bytes.markdown); assert.equal(RATIO.text, TOKEN_RATIO.bytes.text);
  const d = loadEngineBench({ fresh: true }); assert.ok(d, 'a run of the engine bench is in proof/ (node tools/engine-bench.mjs)');
  assert.ok(ENGINE_RATIOS, 'the <bench:engine> block is written (node tools/engine-bench.mjs --ratio)'); assert.equal(RATIO.assumption, false);
  const r = d.summary.ratios.o200k_base; assert.equal(d.toonRule.minSaving, 0.2, 'the bench applies the rule of the lever'); assert.equal(ENGINE_RATIOS.json, r.sent, 'json: bytes per token of the JSON the doors send'); assert.equal(ENGINE_RATIOS.toon, r.toon); assert.equal(ENGINE_RATIOS.date, d.date); assert.equal(ENGINE_RATIOS.tokenizer, 'o200k_base');
  assert.equal(RATIO.json, ENGINE_RATIOS.json); assert.equal(RATIO.toon, ENGINE_RATIOS.toon);
});

console.log('the ledger (node/areas.mjs countEngine), by direct calls');
await proof('a lossless saving counts once: answers, tokens before, after and saved per lever; it joins measured as its own kind (measuredBy.engine)', async () => {
  const { A } = ledgerOf(); assert.equal(A.countEngine('toon', S.toon, agent(), '/search?q=weather'), true);
  const s = await A.savings(), t = s.today.engine.levers.toon.lossless;
  assert.deepEqual(t, { answers: 1, before: S.toon.before, after: S.toon.after, saved: S.toon.saved });
  assert.equal(s.today.tokens.measured, S.toon.saved); assert.deepEqual(s.today.measuredBy, { markdown: 0, engine: S.toon.saved });
  assert.equal(s.hero.measured, S.toon.saved); assert.equal(s.hero.tokens, s.hero.measured + s.hero.modelled.mid); assert.deepEqual(s.engine.measuredBy, { markdown: 0, engine: S.toon.saved });
  assert.equal(s.engine.lossless, S.toon.saved); assert.equal(s.engine.lossy, 0); assert.equal(s.last30days.engine.lossless.saved, S.toon.saved); assert.equal(s.all.engine.lossless.saved, S.toon.saved);
  assert.ok(s.byKind.all.some((k) => k.kind === 'engine:toon' && k.how === 'measured' && k.tokens === S.toon.saved), 'byKind names the lever');
  assert.ok(s.byDoor.all.some((d) => d.door === '/search' && d.engine?.lossless === S.toon.saved), 'byDoor names the door');
});
await proof('a lossy saving is shown apart and is in no figure of the headline (measured, tokens, usd); budget is lossy even when called lossless', async () => {
  const { A } = ledgerOf(), md = 'line of a long page\n'.repeat(400);
  const b = savingOf('budget', { before: md, beforeForm: 'md', after: md.slice(0, 2000), afterForm: 'md' });
  assert.equal(A.countEngine('budget', b, agent(), 'https://example.com/a?budget=800'), true);
  assert.equal(A.countEngine('budget', { ...b, lossy: false }, agent('198.18.20.2'), 'https://example.com/a'), true);
  const s = await A.savings();
  assert.equal(s.today.engine.levers.budget.lossy.answers, 2); assert.equal(s.today.engine.levers.budget.lossless.answers, 0, 'budget never lands lossless');
  assert.equal(s.hero.measured, 0); assert.equal(s.hero.tokens, 0); assert.equal(s.hero.usd.mid, 0); assert.equal(s.engine.lossy, 2 * b.saved); assert.equal(s.engine.measuredBy.engine, 0);
  assert.ok(s.byKind.all.some((k) => k.kind === 'engine:budget' && k.how === 'lossy'));
});
await proof('squeeze counts its lossless and its lossy part apart, even for the same subject; each once a day', async () => {
  const { A } = ledgerOf(), html = '<div>' + '<p>text and more text</p>'.repeat(200) + '</div>';
  const lossless = savingOf('squeeze', { before: html, beforeForm: 'html', after: 'text and more text\n'.repeat(200), afterForm: 'md', lossy: false });
  const lossy = savingOf('squeeze', { before: 'text and more text\n'.repeat(200), beforeForm: 'md', after: 'text', afterForm: 'md', lossy: true });
  assert.equal(A.countEngine('squeeze', lossless, agent(), 'sha:abc'), true); assert.equal(A.countEngine('squeeze', lossy, agent(), 'sha:abc'), true);
  assert.equal(A.countEngine('squeeze', lossless, agent(), 'sha:abc'), false, 'the same again the same day: no');
  const e = (await A.savings()).today.engine.levers.squeeze; assert.equal(e.lossless.saved, lossless.saved); assert.equal(e.lossy.saved, lossy.saved);
});
await proof('once a day per network and subject: a page by its site and path (query left out), another network counts, an IPv6 /64 is one network', async () => {
  const { A } = ledgerOf();
  const d = savingOf('delta', { before: 'x'.repeat(5000), beforeForm: 'md', after: 'Unchanged', afterForm: 'md' });
  assert.equal(A.countEngine('delta', d, agent(), 'https://example.com/p?since=a1'), true);
  assert.equal(A.countEngine('delta', d, agent(), 'https://example.com/p?since=b2'), false, 'the same page with another query');
  assert.equal(A.countEngine('delta', d, agent(), 'https://www.example.com/p/'), false, 'www and a trailing slash are the same page');
  assert.equal(A.countEngine('delta', d, agent(), 'https://example.com/q'), true, 'another page');
  assert.equal(A.countEngine('delta', d, agent('198.18.20.9'), 'https://example.com/p'), true, 'another network');
  assert.equal(A.countEngine('delta', d, agent('2001:db8:1:2::5'), 'https://example.com/z'), true); assert.equal(A.countEngine('delta', d, agent('2001:db8:1:2::77'), 'https://example.com/z'), false, 'the same /64');
  assert.equal((await A.savings()).today.engine.levers.delta.lossless.answers, 4);
});
const CAP = 500; // the cap the brief fixes; the loop below never trusts a changed figure
await proof(`a network adds at most ${CAP} answers of the engine a day, every lever together; another network still counts`, async () => {
  assert.equal(SAVE.cap.engine, CAP); const { A } = ledgerOf(); let n = 0;
  for (let i = 0; i < CAP + 5; i++) if (A.countEngine(i % 2 ? 'toon' : 'lean', i % 2 ? S.toon : savingOf('lean', { before: 'x'.repeat(40000), beforeForm: 'json', after: 'x'.repeat(3000), afterForm: 'json' }), agent('198.18.21.1'), `tool-${i}`)) n++;
  assert.equal(n, CAP); assert.equal(A.countEngine('toon', S.toon, agent('198.18.21.2'), 'tool-0'), true);
  const e = (await A.savings()).today.engine; assert.equal(e.lossless.answers, CAP + 1);
});
await proof('nothing counts for the sea itself, crawlers, HEAD, an uncounted call, or a saving that breaks the rule', async () => {
  const { A } = ledgerOf(), d = S.toon;
  const no = [[agent(undefined, { own: true })], [agent(undefined, { readOnly: true })], [agent(undefined, { head: true })], [agent(undefined, { uncounted: true })],
    ...['self', 'ai-crawler', 'crawler', 'search', 'search-ai'].map((k) => [agent(undefined, { whoKind: k })])];
  for (const [ctx] of no) assert.equal(A.countEngine('toon', d, ctx, '/x'), false, JSON.stringify(ctx));
  const bad = [null, {}, { ...d, saved: d.saved + 1 }, { ...d, saved: 0, before: 5, after: 5 }, { ...d, before: -1 }, { ...d, before: d.before + 0.5, saved: d.saved + 0.5 }, { ...d, saved: NaN }, { ...d, lever: 'lean' }, { ...d, before: Infinity, saved: Infinity }];
  for (const s of bad) assert.equal(A.countEngine('toon', s, agent('198.18.22.1'), `/bad-${Math.random()}`), false, JSON.stringify(s));
  assert.equal(A.countEngine('turbo', { ...d, lever: 'turbo' }, agent('198.18.22.1'), '/y'), false, 'an unknown lever'); assert.equal(A.countEngine('constructor', d, agent('198.18.22.1'), '/y'), false);
  const s = await A.savings(); assert.equal(s.all.engine.lossless.answers + s.all.engine.lossy.answers, 0); assert.equal(s.hero.measured, 0);
});
await proof('the house agent (Angel) is counted apart: house.engine, never in the headline', async () => {
  const { A } = ledgerOf(); assert.equal(A.countEngine('toon', S.toon, agent(undefined, { house: true }), '/search'), true);
  const s = await A.savings(); assert.equal(s.hero.measured, 0); assert.equal(s.engine.lossless, 0); assert.equal(s.today.engine.lossless.answers, 0);
  assert.deepEqual(s.house.today.engine, { answers: 1, lossless: S.toon.saved, lossy: 0 }); assert.equal(s.house.all.measured, S.toon.saved, 'the house\'s own figure holds it');
});
await proof('no receipt for an engine saving: the tally of the answer gets no note (a Markdown count beside it does); fair share stays fair-1', async () => {
  const { A } = ledgerOf();
  const { tally } = await tallyRun(async () => { A.countEngine('toon', S.toon, agent(), '/search'); A.countEngine('budget', savingOf('budget', { before: 'x'.repeat(4000), after: 'x' }), agent(), '/r/a'); });
  assert.equal(tally.notes.length, 0);
  const { tally: t2 } = await tallyRun(async () => { A.countBytes('md', 40000, 8000, agent(), '/savings', 12000); }); assert.equal(t2.notes.length, 1, 'the control: a Markdown answer is noted');
});
await proof('the counts are written by the tide and read back the same; the keys say lever, kind and figure', async () => {
  const { A, kv } = ledgerOf(); A.countEngine('toon', S.toon, agent(), '/search'); const before = strip(await A.savings());
  assert.equal(await A.flushSave(), 1); const day = await kv.get(`save:${NOW.slice(0, 10)}`);
  assert.equal(day[engineKey('toon', 'lossless', 'saved')], S.toon.saved); assert.equal(day[engineKey('toon', 'lossless', 'answers')], 1); assert.equal(day['@/search|eng:toon:lossless:saved'], S.toon.saved);
  assert.equal(day['@/search|eng:toon:lossless:before'], undefined, 'before and after are not repeated per door');
  const after = strip(await A.savings()); assert.deepEqual(after.engine, before.engine); assert.deepEqual(after.today.engine, before.today.engine);
});
await proof('old days read exactly as before: every figure of the 3.34.1 ledger on fixture days is unchanged (only the read text names the new kinds)', async () => {
  const F = JSON.parse(readFileSync(new URL('fixtures/engine/ledger-3.34.1.json', import.meta.url), 'utf8')), { kv, A } = ledgerOf();
  for (const [d, b] of Object.entries(F.days)) await kv.set(`save:${d}`, b); await kv.set('save:total', F.total); await kv.set('save:since', F.since);
  const diffs = [], sub = (old, now, p) => { if (old && typeof old === 'object') { if (!now || typeof now !== 'object') return diffs.push(`${p}: gone`); if (Array.isArray(old) && old.length !== now.length) return diffs.push(`${p}: length ${old.length} -> ${now.length}`); for (const k of Object.keys(old)) if (!(k === 'read' && /^(|savings400)$/.test(p))) sub(old[k], now[k], `${p}.${k}`); } else if (old !== now) diffs.push(`${p}: ${JSON.stringify(old)} -> ${JSON.stringify(now)}`); };
  for (const [d, b] of Object.entries(F.days)) sub(F.savingsOf[d], strip(savingsOf(b)), `savingsOf[${d}]`);
  sub(F.savingsOfTotal, strip(savingsOf(F.total)), 'savingsOf(total)'); const s = strip(await A.savings()); sub(F.savings, s, ''); sub(F.savings400, strip(await A.savings({ days: 400 })), 'savings400');
  assert.deepEqual(diffs, []); assert.ok(s.read.startsWith(F.savings.read), 'the read text keeps every word and adds one sentence');
  assert.deepEqual(Object.keys(s.hero).sort(), Object.keys(F.savings.hero).sort(), 'the headline keeps its keys');
  assert.equal(s.engine.lossless + s.engine.lossy + s.engine.answers, 0); assert.deepEqual(s.engine.measuredBy, { markdown: F.savings.hero.measured, engine: 0 });
});

// ------------------------------------------------------------------ a node of its own, and a door that exists only in this proof
const BASE = 'https://mare.test', dir = mkdtempSync(join(tmpdir(), 'mare-engine-'));
const SITE = { '/llms.txt': { body: readFileSync(new URL('../site/llms.txt', import.meta.url), 'utf8'), type: 'text/plain; charset=utf-8' } };
const node = (extra = {}) => ({ db: createMem({ file: join(dir, `sea-${Math.random().toString(36).slice(2)}.tsv`), base: BASE }), cfg: { base: BASE, kv: memoryKv(), ledger: createLedger({}), pay: payConfig({}), site: SITE, ...extra } });
const N = node();
let ipN = 1;
const call = async (path, { accept = 'text/html', ua = UA.agent, method = 'GET', ip, n = N, body } = {}) => {
  const res = await handle(new Request(BASE + path, { method, headers: { accept, 'user-agent': ua, 'content-type': 'application/json', 'x-forwarded-for': ip || `198.18.30.${(ipN++ % 250) + 1}` }, ...(body ? { body: JSON.stringify(body) } : {}) }), n.db, n.cfg);
  return { status: res.status, headers: res.headers, text: method === 'HEAD' ? '' : await res.text() };
};
// the door of this proof shapes a JSON answer the way a lever does and counts it with the gating handleMd uses for
// countBytes (no self, no crawlers, no HEAD; the house agent apart). It is no door of the sea: nothing public answers here.
const local = async (q, { ua = UA.agent, method = 'GET', ip = '198.18.31.1' } = {}) => {
  const req = new Request(`${BASE}/__engine-proof?q=${encodeURIComponent(q)}`, { method, headers: { 'user-agent': ua, 'x-forwarded-for': ip } });
  const who = callerOf(req.headers), head = req.method === 'HEAD', counts = !head && who.kind !== 'self' && !['ai-crawler', 'crawler', 'search', 'search-ai'].includes(who.kind);
  const s = savingOf('toon', { before: JSON_ROWS, beforeForm: 'json', after: TABLE(JSON_ROWS), afterForm: 'toon' });
  if (counts) seaOf(N.db, N.cfg, BASE).countEngine?.('toon', s, { door: '/__engine-proof', ip, ...(isHouse(who) ? { house: true } : {}) }, `/search?q=${q}`);
  return new Response(head ? null : TABLE(JSON_ROWS), { headers: { 'content-type': 'text/plain; charset=utf-8', ...engineHeaders(s) } });
};
const ledgerNow = async () => JSON.parse((await call('/savings.json', { accept: 'application/json', ua: UA.own })).text);

console.log('the ledger through a request (a door of this proof, gated like handleMd)');
await proof('an agent counts once per subject and day; the sea itself, AI crawlers, a search engine and HEAD count nowhere; Angel apart', async () => {
  const r = await local('weather api'); assert.equal(r.headers.get('x-sea-engine'), 'toon'); assert.equal(r.headers.get('x-sea-engine-saved'), String(S.toon.saved)); assert.equal(r.headers.get('x-sea-engine-lossy'), null);
  await local('weather api'); await local('weather api', { ip: '198.18.31.1' });
  for (const ua of [UA.own, UA.gptbot, UA.claudebot, UA.googlebot]) await local(`crawl ${ua.slice(0, 20)}`, { ua, ip: '198.18.31.2' });
  await local('head only', { method: 'HEAD', ip: '198.18.31.3' }); await local('for angel', { ua: UA.angel, ip: '198.18.31.4' });
  const s = await ledgerNow();
  assert.equal(s.today.engine.levers.toon.lossless.answers, 1, 'one agent, one subject, one day'); assert.equal(s.engine.measuredBy.engine, S.toon.saved);
  assert.equal(s.hero.measured, s.engine.measuredBy.markdown + s.engine.measuredBy.engine); assert.equal(s.house.today.engine?.answers, 1);
});
await proof('/savings and /savings.json name the new kinds; /open and /open.json too; the badge stays Markdown against raw HTML', async () => {
  const h = (await call('/savings', { ua: UA.own })).text; assert.match(h, /The <a href="\/engine">engine room<\/a> counts here since 3\.35/); assert.match(h, /the engine room [\d,]+, lossless\)/); assert.ok(h.includes('engine:toon'), 'the kind is in the table');
  const j = await ledgerNow(); assert.match(j.engine.note, /two kinds/); assert.match(j.read, /engine room/);
  const o = JSON.parse((await call('/open.json', { accept: 'application/json', ua: UA.own })).text); assert.equal(o.savings.all.measuredBy.engine, j.engine.measuredBy.engine); assert.match(o.savings.all.labels.engine, /lossless/);
  assert.match((await call('/open', { ua: UA.own })).text, /engine room<\/a> counts here since 3\.35/);
  const badge = (await call('/savings/badge.svg', { ua: UA.own })).text, shown = Number(/<title>[^<]*: ([\d,]+)<\/title>/.exec(badge)?.[1].replace(/,/g, ''));
  assert.equal(shown, j.engine.measuredBy.markdown, 'the badge is the Markdown figure its label names'); assert.notEqual(shown, j.hero.measured);
});

console.log('the engine room: /engine, /engine.json, /engine.md');
await proof('/engine answers 200 in the sea\'s skin: a multi-word H1, the scene, five levers each with its curl line and whether it is lossless, the rules, the links', async () => {
  const r = await call('/engine'); assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /^text\/html/); const h = r.text;
  assert.match(h, /<h1>The engine room of the sea<\/h1>/); assert.match(h, /data-zone="2"/); assert.match(h, /class="beats"/); assert.match(h, /depth\.js/);
  for (const id of Object.keys(LEVERS)) assert.match(h, new RegExp(`<div class="box lever" id="${id}">[\\s\\S]*?<pre><code>curl `), id);
  assert.equal((h.match(/class="loss( y)?"/g) || []).length, 6); for (const id of ['budget', 'fields']) assert.match(h, new RegExp(`id="${id}">[\\s\\S]*?class="loss y">lossy<`), id);
  assert.equal((h.match(/<p class="where"><b>Where it saves:<\/b>/g) || []).length, 6); assert.match(h, /Claude Code, Copilot CLI and OpenAI&#39;s Agents API already defer tools/); assert.match(h, /at least 20 % smaller than compact JSON/);
  assert.match(h, /<h2>Where this comes from<\/h2>/); for (const u of ['github.com/toon-format/spec', 'modelcontextprotocol.io/specification/2026-07-28/server/tools', 'atlassian.com/blog/developer/mcp-compression']) assert.ok(h.includes(u), u);
  assert.match(h, /prompt cache/, 'the caching caveat beside a dollar value'); assert.doesNotMatch(h, /most advanced|most complete|\bbest\b|world.?s/i, 'no superlatives');
  for (const l of ['/savings', '/proof', '/fair', '/llms.txt', '/engine.json', '/engine.md']) assert.ok(h.includes(`href="${l}"`), l);
  for (const k of ['measuring', 'privacy', 'optIn']) assert.ok(h.includes(ENGINE_RULES[k].replace(/'/g, '&#39;').replace(/"/g, '&quot;').slice(0, 60)), k);
  assert.match(h, /<h2>The bench<\/h2>/); assert.match(h, /with the rule of the lever, TOON only where it is at least 20 % smaller/); assert.match(h, /a lean list of 4 tools/);
});
await proof('/engine.json and Accept: application/json give the data; its live numbers are the ledger\'s', async () => {
  const j = JSON.parse((await call('/engine.json', { accept: 'application/json' })).text), s = await ledgerNow();
  assert.equal(j.levers.length, 6); assert.ok(j.levers.every((l) => l.where && l.call)); assert.ok(j.sources.length >= 3 && j.sources.length <= 5); assert.equal(j.on, true); assert.equal(j.engine, 'engine-1'); assert.deepEqual(j.live.lossless, s.all.engine.lossless);
  assert.deepEqual(j.levers.find((l) => l.id === 'toon').live.all.lossless, s.all.engine.levers.toon.lossless); assert.ok(j.bench && j.bench.fixtures >= 12, 'the bench'); assert.ok(j.rules.privacy);
  const a = await call('/engine', { accept: 'application/json' }); assert.match(a.headers.get('content-type'), /^application\/json/);
});
await proof('/engine.md and Accept: text/markdown give the Markdown twin; the bench run answers as data, an unknown one 404', async () => {
  for (const [p, acc] of [['/engine.md', 'text/markdown'], ['/engine', 'text/markdown']]) { const r = await call(p, { accept: acc }); assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /^text\/markdown/); assert.match(r.text, /# The engine room of the sea/); assert.match(r.text, /### TOON instead of JSON/); assert.doesNotMatch(r.text, /<div|<script/); }
  const d = loadEngineBench(), b = await call(`/engine/bench-${d.date}.json`, { accept: 'application/json' }); assert.equal(b.status, 200); assert.equal(JSON.parse(b.text).date, d.date);
  assert.equal((await call('/engine/bench-2000-01-01.json', { accept: 'application/json' })).status, 404);
});
await proof('llms.txt has "Spare tokens: six levers" (one line each, with where it saves); the hub sitemap and the doors of /open list /engine', async () => {
  const l = SITE['/llms.txt'].body, sec = /## Spare tokens: six levers\n\n([\s\S]*?)\n## /.exec(l)?.[1]; assert.ok(sec, 'the section');
  assert.equal(sec.split('\n').filter((x) => x.startsWith('- ')).length, 6); for (const x of ['fmt=toon', 'fields=<a,b.c>', '/mcp/lean', '/compress', 'since=<etag>', 'budget=<tokens>', 'at least 20 % smaller', 'defer tools']) assert.ok(sec.includes(x), x);
  assert.doesNotMatch(sec, /most advanced|most complete|\bbest\b/i);
  assert.ok(HUB_PATHS.includes('/engine')); assert.ok((await call('/sitemaps/hubs.xml')).text.includes(`${BASE}/engine<`));
  assert.ok(ENDPOINTS.some(([, list]) => list.some(([p]) => p === '/engine.json')));
});
await proof('a bench run in proof/: at least 12 real answers, three tokenizers, every TOON decoded back to the same JSON, the MCP list in full and lean', () => {
  const d = loadEngineBench(); assert.ok(d.fixtures.length >= 12); assert.deepEqual(d.tokenizers.map((t) => t.id), ['o200k_base', 'cl100k_base', 'claude-legacy']);
  for (const f of d.fixtures) { assert.equal(f.roundTrip, true, f.id); for (const t of ['o200k_base', 'cl100k_base', 'claude-legacy']) for (const k of ['json', 'sent', 'min', 'toon']) assert.ok(f.tokens[t][k] > 0, `${f.id} ${t} ${k}`); }
  assert.ok(d.mcp.full.tools > d.mcp.lean.tools && d.mcp.lean.tools === 4); assert.ok(d.mcp.full.tokens.o200k_base > d.mcp.lean.tokens.o200k_base); assert.ok(d.toon.implementation);
});

console.log('the rest switch "engine"');
await proof('engineOn: on by default; off with MARE_ENGINE=off or cfg.engine off; resting with "engine" in rest of immune:policy', () => {
  assert.equal(engineOn({}, immune, {}), true); assert.equal(engineOn({ engine: 'off' }, immune, {}), false); assert.equal(engineOn({}, immune, { MARE_ENGINE: 'off' }), false); assert.equal(engineSwitch({}, { MARE_ENGINE: '0' }), false);
  immune.set({ mode: 'normal', rest: ['engine'] }); try { assert.equal(engineOn({}, immune, {}), false); } finally { immune.set({ mode: 'normal', rest: [] }); }
  assert.equal(engineOn({}, immune, {}), true);
});
await proof('the page says so when the engine is off or rests; every default answer is byte for byte the same with the engine on and off', async () => {
  const off = node({ engine: 'off' }), on = node();
  const jOff = JSON.parse((await call('/engine.json', { accept: 'application/json', n: off })).text); assert.equal(jOff.on, false); assert.match(jOff.state, /nothing of the engine acts/);
  immune.set({ mode: 'normal', rest: ['engine'] }); try { const r = JSON.parse((await call('/engine.json', { accept: 'application/json', n: on })).text); assert.equal(r.on, false); } finally { immune.set({ mode: 'normal', rest: [] }); }
  const paths = [['/llms.txt', 'text/plain'], ['/savings.json', 'application/json'], ['/brain/areas.json', 'application/json'], ['/search?q=weather+api', 'application/json'], ['/stats', 'application/json'], ['/fair.json', 'application/json'], ['/openapi.json', 'application/json'], ['/connect.json', 'application/json']];
  for (const [p, accept] of paths) { const a = await call(p, { accept, n: on, ip: '198.18.40.1' }), b = await call(p, { accept, n: off, ip: '198.18.40.1' }); assert.equal(a.status, b.status, p); assert.equal(a.text.replace(/"(at|now|time|generated)":"[^"]*"/g, ''), b.text.replace(/"(at|now|time|generated)":"[^"]*"/g, ''), p); }
  for (const [method, n] of [['initialize', 0], ['tools/list', 1]]) for (const door of ['/mcp', '/mcp/app']) {
    const ask = (x) => call(door, { method: 'POST', accept: 'application/json, text/event-stream', n: x, ip: '198.18.40.2', body: { jsonrpc: '2.0', id: 1 + n, method, params: method === 'initialize' ? { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'proof', version: '1' } } : {} } });
    assert.equal((await ask(on)).text, (await ask(off)).text, `${door} ${method}`);
  }
  const eOn = JSON.parse((await call('/engine.json', { accept: 'application/json', n: on })).text); delete eOn.on; delete eOn.state; delete jOff.on; delete jOff.state; assert.deepEqual(eOn, jOff, 'the engine page differs only in its state');
});

rmSync(dir, { recursive: true, force: true });
console.log(`\n${passed} proofs held, ${failed} failed`);

// ------------------------------------------------------------------ negative controls: each rule broken in a copy, the proof must fail there
const BREAK = [
  ['crawlers counted', 'node/areas.mjs', '|| ENGINE_SKIP.has(ctx?.whoKind)) return false;', ') return false;'],
  ['lossy savings in the headline', 'node/areas.mjs', 'measured = markdown + engine.lossless.saved;', 'measured = markdown + engine.lossless.saved + engine.lossy.saved;'],
  ['no once a day', 'node/areas.mjs', "if (!firstToday(ctx, `eng:${lever}:${cls}`,", "if (!ctx?.ip && !firstToday(ctx, `eng:${lever}:${cls}`,"],
  ['no cap per network', 'node/areas.mjs', 'cap: { measured: 500, reuse: 500, engine: 500 },', 'cap: { measured: 500, reuse: 500, engine: 1e9 },'],
  ['budget counted lossless', 'node/areas.mjs', "s.lossy === false && L.lossless !== false ? 'lossless'", "s.lossy === false ? 'lossless'"],
  ['a saving that breaks the rule trusted', 'node/areas.mjs', '|| saved !== before - after) return false;', ') return false;'],
  ['the house agent in the headline', 'node/areas.mjs', 'quiet = { ...ctx, door: undefined };', 'quiet = { ...ctx, door: undefined }; ctx = { ...ctx, house: undefined };'],
  ['old days read differently (every lever named in byKind)', 'node/areas.mjs', 'ENGINE_CLASSES.filter((c) => o[c].answers > 0)', 'ENGINE_CLASSES.filter(() => true)'],
  ['a receipt for an engine saving', 'node/areas.mjs', 'count(k(\'answers\'), 1, ctx);', 'count(k(\'answers\'), 1, ctx); tallyNote({ k: \'engine\', door: doorOf(ctx) });'],
  ['the rest switch ignored', 'node/engine.mjs', "engineSwitch(cfg, env) && !immune?.atRest?.('engine');", 'engineSwitch(cfg, env);'],
  ['the badge takes the engine in', 'node/core.mjs', 'fmtN(s?.engine?.measuredBy?.markdown ?? s?.hero?.measured ?? 0)', 'fmtN(s?.hero?.measured ?? 0)'],
  ['the page loses its links', 'node/engine-ui.mjs', '<a href="/fair">/fair</a>', '/fair'],
];
let caught = 0;
const control = ([what, f, from, to]) => new Promise((done) => {
  const tmp = mkdtempSync(join(tmpdir(), 'mare-engine-ctl-')), end = (line, ok) => { rmSync(tmp, { recursive: true, force: true }); if (ok) caught++; done(line); };
  try {
    for (const d of ['node', 'site', 'proof', 'tools/fixtures/engine']) if (existsSync(join(ROOT, d))) { mkdirSync(dirname(join(tmp, d)), { recursive: true }); cpSync(join(ROOT, d), join(tmp, d), { recursive: true }); }
    cpSync(join(ROOT, 'tools/engine-proof.mjs'), join(tmp, 'tools/engine-proof.mjs')); cpSync(join(ROOT, 'package.json'), join(tmp, 'package.json'));
    const src = readFileSync(join(tmp, f), 'utf8'); if (!src.includes(from)) return end(`  FAIL control "${what}": the line to break is gone from ${f}; the control needs updating`, false);
    writeFileSync(join(tmp, f), src.replace(from, to));
  } catch (e) { return end(`  FAIL control "${what}": ${e?.message}`, false); }
  const child = spawn(process.execPath, ['tools/engine-proof.mjs', '--no-controls'], { cwd: tmp }); let out = '';
  const timer = setTimeout(() => child.kill('SIGKILL'), 120_000);
  child.stdout.on('data', (b) => { out += b; }); child.stderr.on('data', () => {});
  child.on('close', (code) => { clearTimeout(timer); const held = /(\d+) proofs held, (\d+) failed/.exec(out);
    if (code !== 0 && held && Number(held[2]) > 0) end(`  ok   caught: ${what} (${held[2]} ${held[2] === '1' ? 'proof' : 'proofs'} failed)`, true);
    else end(`  FAIL not caught: ${what} (exit ${code}${held ? `, ${held[0]}` : ', no result: hung or crashed'})`, false); });
});
if (CONTROLS) {
  console.log('\nnegative controls: each rule broken in a copy, the proof must fail there (six at a time)');
  const lines = new Array(BREAK.length); let next = 0;
  await Promise.all(Array.from({ length: 6 }, async () => { while (next < BREAK.length) { const i = next++; lines[i] = await control(BREAK[i]); } }));
  for (const l of lines) console.log(l);
  console.log(`${caught} of ${BREAK.length} controls caught`);
}
process.exit(failed || (CONTROLS && caught !== BREAK.length) ? 1 : 0);
