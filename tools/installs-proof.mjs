// Mare Liberum · proof of the installations (4.0, node/installs.mjs): measured, not guessed.
// It proves, without the network: a host program that takes the skill, llms.txt or the MCP handshake is one installation a
// UTC day per caller, under its host (chatgpt, claude, grok, gemini, cursor, copilot, other); crawlers, people in a browser and
// the sea's own calls are none; a key opened counts for its host, a seat for the host its link named; GET /installs answers
// per host today and 7 days, with key and with seat, in under 300 ms; /installs.txt is four lines; /pulse says
// installations_today right above the traffic; the contact book keeps install_source. Negative controls must fail.
// Runs: node tools/installs-proof.mjs  (exit code 1 when a proof or a negative control fails)
import assert from 'node:assert/strict';
import { handle } from '../node/core.mjs';
import { createMem } from '../node/mem.mjs';
import { memoryKv } from '../node/flow.mjs';
import { createLedger } from '../node/ledger.mjs';
import { payConfig } from '../node/pay.mjs';
import { readFileSync } from 'node:fs';
import { createInstalls, installLines, installSourceOf } from '../node/installs.mjs';
import { hostOf } from '../node/hosts.mjs';

let passed = 0, failed = 0, negOk = 0, negBad = 0;
const proof = async (name, fn) => { try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 5).join('\n       ')}`); } };
const negative = async (name, fn) => { let threw = false; try { await fn(); } catch { threw = true; } if (threw) { negOk++; console.log(`  ok   negative control fails as it must: ${name}`); } else { negBad++; console.log(`  FAIL negative control did not fail: ${name}`); } };
for (const k of ['error', 'warn', 'info']) console[k] = () => {};

const BASE = 'https://mare.test', db = createMem({ file: 'data/none.tsv', base: BASE }), kv = memoryKv(), ledger = createLedger({}), waits = [];
const site = { '/skill.md': { body: readFileSync(new URL('../site/skill.md', import.meta.url), 'utf8'), type: 'text/markdown; charset=utf-8' }, '/llms.txt': { body: readFileSync(new URL('../site/llms.txt', import.meta.url), 'utf8'), type: 'text/plain; charset=utf-8' } };
const cfg = { base: BASE, kv, ledger, pay: payConfig({}), site, waitUntil: (p) => { waits.push(p); }, creditSweepMs: 0 };
let n = 0; const ip = () => `198.51.100.${(n++ % 250) + 1}`;
const call = async (path, { method = 'GET', ua = 'proof/1.0', addr = ip(), headers = {}, body } = {}) => {
  const res = await handle(new Request(BASE + path, { method, headers: { 'user-agent': ua, 'x-forwarded-for': addr, accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) }), db, cfg);
  const text = await res.text(); let j = null; try { j = JSON.parse(text); } catch {}
  await Promise.all(waits.splice(0)); return { status: res.status, h: res.headers, text, j };
};
const CLAUDE = 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +Claude-User@anthropic.com)';
const GPT = 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot';
const installs = async () => (await call('/installs')).j;

console.log('installations');
await proof('a host that takes the skill is one installation a day per caller: Claude-User twice from one address counts once, from another once more; ClaudeBot, a browser and the sea\'s own calls count nothing', async () => {
  const a = '203.0.113.7';
  assert.equal((await call('/skills/mare-liberum/SKILL.md', { ua: CLAUDE, addr: a })).status, 200);
  assert.equal((await call('/skills/mare-liberum/', { ua: CLAUDE, addr: a })).status, 200);
  assert.equal((await call('/skill.md', { ua: CLAUDE, addr: '203.0.113.8' })).status, 200);
  await call('/skills/mare-liberum/SKILL.md', { ua: 'Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)' });
  await call('/skills/mare-liberum/SKILL.md', { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15', headers: { accept: 'text/html', 'accept-language': 'de-DE', 'sec-fetch-mode': 'navigate' } });
  await call('/skills/mare-liberum/SKILL.md', { ua: 'MareLiberum-session/1.0' });
  const r = await installs(); assert.equal(r.sources.claude.today, 2); assert.equal(r.total.today, 2, JSON.stringify(r.sources));
  assert.ok(r.top_sources_today.some((x) => x.source === 'claude:/skills/mare-liberum/SKILL.md'));
});
await proof('the MCP handshake is an installation under the client\'s name (cursor-vscode is cursor); llms.txt read by ChatGPT-User is chatgpt; a key opened counts for its host', async () => {
  const r0 = await installs();
  const m = await call('/mcp', { method: 'POST', ua: 'node', body: { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'cursor-vscode', version: '1.0' } } } }); assert.equal(m.status, 200);
  await call('/llms.txt', { ua: GPT });
  const k = await call('/session?as=key', { ua: GPT }); assert.equal(k.status, 200);
  const r = await installs(); assert.equal(r.sources.cursor.today, r0.sources.cursor.today + 1); assert.equal(r.sources.chatgpt.today, r0.sources.chatgpt.today + 1); assert.equal(r.sources.chatgpt.with_key_today, r0.sources.chatgpt.with_key_today + 1);
  assert.ok(r.top_sources_today.some((x) => x.source === 'cursor:/mcp'));
});
await proof('GET /installs: per host (chatgpt, claude, grok, gemini, cursor, copilot, other) today, 7 days, with key, with seat; in under 300 ms; a seat counts for the host its link named', async () => {
  await db.installs.seat('chatgpt');
  const t0 = performance.now(), r = await installs(), ms = performance.now() - t0; assert.ok(ms < 300, `${ms.toFixed(1)} ms`);
  assert.deepEqual(Object.keys(r.sources), ['chatgpt', 'claude', 'grok', 'gemini', 'cursor', 'copilot', 'other']);
  for (const h of Object.keys(r.sources)) assert.deepEqual(Object.keys(r.sources[h]), ['today', 'days_7', 'with_key_today', 'with_key_7', 'with_seat_today', 'with_seat_7']);
  assert.equal(r.sources.chatgpt.with_seat_today, 1); assert.ok(r.sources.claude.days_7 >= r.sources.claude.today);
});
await proof('/installs.txt: four lines for a phone (installations, keys, sales per host, the next step in one sentence)', async () => {
  const t = await call('/installs.txt'); assert.equal(t.status, 200); assert.match(t.h.get('content-type'), /^text\/plain/);
  const lines = t.text.trimEnd().split('\n'); assert.equal(lines.length, 4); for (let i = 0; i < 4; i++) assert.ok(lines[i].startsWith(`${i + 1} `), lines[i]);
  assert.match(lines[0], /claude 2\/2/); assert.match(lines[3], /^4 Nächste Empfehlung: .+\.$/);
});
await proof('/pulse says installations_today right above the traffic numbers', async () => {
  const p = await call('/pulse'); assert.equal(p.status, 200); const keys = Object.keys(p.j);
  assert.ok(keys.includes('installations_today')); assert.ok(keys.indexOf('installations_today') < keys.indexOf('unique_domains_today'), keys.slice(0, 4).join(','));
  assert.ok(keys.indexOf('installations_today') <= 1, 'after who pays at most'); assert.match(p.j.installations_today.line, /^installations today \(\d{4}-\d{2}-\d{2}, UTC\): \d+ · chatgpt \d+/);
});
await proof('the contact book keeps install_source (host and entry route) and the SQL table has the column', async () => {
  await call('/x402/check?site=example.com', { ua: GPT });
  const sql = readFileSync(new URL('../supabase/kontaktbuch.sql', import.meta.url), 'utf8'); assert.match(sql, /install_source\s+text check/); assert.match(sql, /add column if not exists install_source/);
  const rows = await (await import('../node/contacts.mjs')).createContacts({ kv, secret: 'x'.repeat(32) }).rows(); assert.ok(rows.length >= 1); assert.ok(rows.every((r) => 'install_source' in r));
  assert.equal(installSourceOf(GPT, '/x402/check'), 'chatgpt:/x402/check');
});

console.log('negative controls');
await negative('a crawler counted as an installation is caught', async () => { const i = createInstalls({ kv: memoryKv() }); assert.equal(await i.seen({ ua: 'GPTBot/1.1', path: '/llms.txt', kind: 'ai-crawler' }), null); assert.notEqual(await i.seen({ ua: 'GPTBot/1.1', path: '/llms.txt', kind: 'ai-crawler' }), null); });
await negative('a second visit of the same caller counted again is caught', async () => { const i = createInstalls({ kv: memoryKv() }); await i.seen({ ua: CLAUDE, ip: '192.0.2.1', path: '/skill.md' }); assert.notEqual(await i.seen({ ua: CLAUDE, ip: '192.0.2.1', path: '/skill.md' }), null); });
await negative('five lines on /installs.txt are caught', async () => { const i = createInstalls({ kv: memoryKv() }); const l = installLines(await i.report()); assert.equal([...l, 'x'].length, 4); });
await negative('a Cursor client taken for Copilot is caught', () => { assert.equal(hostOf('', 'cursor-vscode'), 'copilot'); });

console.log(`\n${passed} held, ${failed} failed · negative controls: ${negOk} caught, ${negBad} missed`);
process.exit(failed || negBad ? 1 : 0);
