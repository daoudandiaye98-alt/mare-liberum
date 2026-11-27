// Mare Liberum · proof of the Poppy file (3.77, "Die Poppy-Datei"): /.well-known/poppy.json tells a personal agent that speaks
// the Personal Agent Protocol 1.0 (Meta Muse reads it first on a site) what it may call here without a login. It proves, without
// the network:
//   file     the file answers 200 as JSON for every origin, with the fields Poppy 1.0 requires (protocol_version "1.0",
//            organization with name and domain, apis) and nothing else but a logo; no auth block, so nothing needs a login;
//            each API is {type, url, description} with type openapi or mcp
//   doors    the APIs it names are the OpenAPI description and the full MCP server /mcp, and both answer: the OpenAPI
//            description has the deal check, the MCP server lists the tools the file names; the file never names the app door
//            /mcp/app, a paid door or the wallet; the logo it names is a file of the site
//   count    each read is counted for the UTC day by the name the caller gives itself (Meta AI, Meta, a tool …), the sea's own
//            calls are not counted, /open.json shows the day (reads, meta, by); a day holds at most 24 names, more go to other;
//            a store that fails never stops the file
//   told     llms.txt names the file, /for/bots and /for/bots.md name it; the guidance of /openapi.json stays under 4,000
//            characters
// Negative controls at the end: each rule broken in a copy of the code, and this proof must fail there.
// Runs without the network: node tools/poppy-proof.mjs   (exit code 1 when a proof fails or a control is not caught)
//   --no-controls   only the proofs (the controls run this file that way in each broken copy)
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, cpSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Buffer } from 'node:buffer';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const k of ['MARE_TOLL', 'MARE_ENGINE', 'MARE_FAIR', 'MARE_X402_FACILITATOR', 'MARE_PAY_TO', 'MARE_ROUTE_PRICE_CENTS', 'MARE_STATE', 'MARE_DB_URL', 'MARE_DB_KEY', 'MARE_DB_SECRET', 'MARE_BASE_RPC', 'MARE_CATALOG_ID']) delete process.env[k];
let passed = 0, failed = 0;
const proof = async (name, fn) => { try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 6).join('\n       ')}`); } };
const imp = (f) => import(pathToFileURL(join(ROOT, 'node', f)).href);
globalThis.fetch = async (u) => { throw new Error(`the proof does not use the network: ${String(u?.url ?? u).slice(0, 80)}`); };
for (const k of ['error', 'warn', 'info']) console[k] = () => {};

// ------------------------------------------------------------------ the node
const BASE = 'https://mare.test', SITE = { '/llms.txt': { body: readFileSync(join(ROOT, 'site/llms.txt'), 'utf8'), type: 'text/plain; charset=utf-8' } };
const core = await imp('core.mjs'), { createMem } = await imp('mem.mjs'), { memoryKv } = await imp('flow.mjs');
const { immune } = await imp('immune.mjs'), { createLedger } = await imp('ledger.mjs'), { payConfig } = await imp('pay.mjs');
const { POPPY, poppyCount, poppyToday } = await imp('poppy.mjs'), { BOTS } = await imp('pages.mjs');
const dir = mkdtempSync(join(tmpdir(), 'mare-poppy-')), file = join(dir, 'sea.tsv');
process.once('exit', () => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });
writeFileSync(file, ''); writeFileSync(join(dir, 'build.json'), JSON.stringify({ builtAt: '2026-11-20T10:00:00.000Z', entries: 0, lakes: {} }));
const db = createMem({ file, base: BASE }), kv = memoryKv(), ledger = createLedger({});
const PAY = payConfig({});
const cfg = { base: BASE, kv, ledger, pay: PAY, site: SITE, openMemoMs: 0, waitUntil: () => {}, creditSweepMs: 0 };
let net = 0; const fresh = () => `198.51.100.${++net % 250 + 1}`;
const call = async (path, { method = 'GET', accept = 'application/json', ua = 'poppy-proof-agent/1.0', body, on = cfg } = {}) => {
  const h = { accept, 'user-agent': ua, 'x-forwarded-for': fresh(), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) };
  const res = await core.handle(new Request(BASE + path, { method, headers: h, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }), db, on);
  const text = res.body ? Buffer.from(await res.arrayBuffer()).toString('utf8') : ''; let j = null; try { j = JSON.parse(text); } catch {}
  return { status: res.status, h: Object.fromEntries(res.headers), text, j };
};
await call('/stats');
immune.set({ mode: 'normal', rest: [], pace: { perMinute: 1_000_000, burst: 1_000_000 } });
const day = () => new Date().toISOString().slice(0, 10);
const UA = { muse: 'meta-externalfetcher/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)', meta: 'meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)', tool: 'curl/8.5.0', own: 'MareLiberum-session/1.0', chatgpt: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot' };

console.log('file');
await proof('the file answers 200 as JSON for every origin, cached for an hour', async () => {
  const r = await call(POPPY.path, { ua: UA.tool }); assert.equal(r.status, 200, r.text.slice(0, 200));
  assert.match(r.h['content-type'], /^application\/json/); assert.equal(r.h['access-control-allow-origin'], '*'); assert.match(r.h['cache-control'], /public, max-age=3600/);
  assert.ok(r.j, 'it parses');
});
await proof('it holds the fields Poppy 1.0 requires and nothing else but a logo: no auth block, so nothing needs a login', async () => {
  const j = (await call(POPPY.path, { ua: UA.tool })).j;
  assert.deepEqual(Object.keys(j).sort(), ['apis', 'logo_uri', 'organization', 'protocol_version']);
  assert.equal(j.protocol_version, '1.0'); assert.equal(typeof j.protocol_version, 'string');
  assert.deepEqual(j.organization, { name: 'Mare Liberum', domain: 'mare.test' });
  assert.ok(!('auth' in j), 'no auth block');
});
await proof('each API is {type, url, description} with type openapi or mcp, over https', async () => {
  const j = (await call(POPPY.path, { ua: UA.tool })).j;
  assert.ok(Array.isArray(j.apis) && j.apis.length === 2);
  for (const a of j.apis) {
    assert.deepEqual(Object.keys(a).sort(), ['description', 'type', 'url']); assert.ok(['openapi', 'mcp'].includes(a.type), a.type);
    assert.match(a.url, /^https:\/\//); assert.ok(a.description.length > 40 && a.description.length < 500, a.description);
  }
  assert.deepEqual(j.apis.map((a) => a.type), ['openapi', 'mcp']);
});
await proof('another domain names itself in the file', async () => {
  const res = await core.handle(new Request(`https://sea.example${POPPY.path}`, { headers: { 'user-agent': UA.tool, 'x-forwarded-for': fresh() } }), db, { ...cfg, base: 'https://sea.example' });
  const j = JSON.parse(await res.text()); assert.equal(j.organization.domain, 'sea.example'); assert.equal(j.apis[1].url, 'https://sea.example/mcp');
});

console.log('doors');
await proof('the APIs it names are the OpenAPI description and the full MCP server /mcp, and both answer', async () => {
  const j = (await call(POPPY.path, { ua: UA.tool })).j;
  assert.equal(j.apis[0].url, `${BASE}/openapi.json`); assert.equal(j.apis[1].url, `${BASE}/mcp`);
  const o = await call('/openapi.json'); assert.equal(o.status, 200); assert.match(String(o.j.openapi), /^3\./); assert.ok(o.j.paths['/deal'], 'the deal check in the OpenAPI description');
  assert.ok(j.apis[0].description.includes(`${BASE}/deal?url=<product page>`), 'the OpenAPI entry leads with the free deal check');
  const m = await call('/mcp', { method: 'POST', accept: 'application/json, text/event-stream', body: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} } });
  const mj = m.j || JSON.parse(/data: (.+)/.exec(m.text)[1]); const names = mj.result.tools.map((t) => t.name);
  for (const t of ['decide', 'ask', 'read_page', 'search']) { assert.ok(j.apis[1].description.includes(t), `the file names ${t}`); assert.ok(names.includes(t), `${t} on /mcp`); }
});
await proof('the file never names the app door, a paid door or the wallet; the logo it names is a file of the site', async () => {
  const r = await call(POPPY.path, { ua: UA.tool });
  assert.ok(!r.text.includes('/mcp/app'), 'no app door'); assert.ok(!/\/x402\/|\/reader\/credit|\/offers/.test(r.text), 'no paid door');
  assert.ok(!r.text.toLowerCase().includes(String(PAY.payTo).toLowerCase()), 'no wallet'); assert.ok(!/0x[0-9a-f]{40}/i.test(r.text), 'no address');
  assert.equal(r.j.logo_uri, `${BASE}/icon-512.png`); assert.ok(existsSync(join(ROOT, 'site/icon-512.png')), 'the logo file');
});

console.log('count');
await proof('each read counts for the day by the name the caller gives itself; the sea\'s own calls are not counted', async () => {
  const t0 = await poppyToday(kv, day());
  for (const ua of [UA.muse, UA.muse, UA.meta, UA.tool, UA.own, UA.chatgpt]) assert.equal((await call(POPPY.path, { ua })).status, 200, ua);
  const t1 = await poppyToday(kv, day());
  assert.equal(t1.reads, t0.reads + 5); assert.equal(t1.meta, t0.meta + 3);
  assert.equal(t1.by['Meta AI'], (t0.by['Meta AI'] || 0) + 2); assert.equal(t1.by.Meta, (t0.by.Meta || 0) + 1); assert.equal(t1.by.ChatGPT, (t0.by.ChatGPT || 0) + 1);
  assert.equal(t1.by.tool, (t0.by.tool || 0) + 1); assert.ok(!Object.keys(t1.by).some((n) => /mare/i.test(n)), 'no name of the sea');
  const ns = Object.values(t1.by); assert.ok(ns.every((n, i) => i === 0 || ns[i - 1] >= n), 'most first');
});
await proof('/open.json shows the reads of the day (reads, meta, by), never an address', async () => {
  const o = await call('/open.json'); assert.equal(o.status, 200); const p = o.j.poppy;
  assert.ok(p, 'the field poppy'); assert.equal(p.day, day()); assert.equal(p.file, POPPY.path); assert.equal(p.reads, (await poppyToday(kv, day())).reads); assert.ok(p.meta >= 3);
  assert.ok(!/198\.51\.100\./.test(JSON.stringify(p)), 'no address');
});
await proof('a day holds at most 24 names; more go to other', async () => {
  const k2 = memoryKv();
  for (let i = 0; i < 30; i++) assert.equal(await poppyCount(k2, { kind: 'assistant', name: `Reader ${i}` }, '2026-11-27'), true);
  const t = await poppyToday(k2, '2026-11-27'); assert.equal(Object.keys(t.by).length, POPPY.names + 1); assert.equal(t.by.other, 30 - POPPY.names); assert.equal(t.reads, 30);
  assert.equal(await poppyCount(k2, { kind: 'self' }, '2026-11-27'), false); assert.equal((await poppyToday(k2, '2026-11-27')).reads, 30);
});
await proof('a store that fails never stops the file', async () => {
  const broken = { get: async () => { throw new Error('down'); }, set: async () => { throw new Error('down'); } };
  const r = await call(POPPY.path, { ua: UA.muse, on: { ...cfg, kv: broken } }); assert.equal(r.status, 200); assert.equal(r.j.protocol_version, '1.0');
  assert.deepEqual((await poppyToday(broken, day())).reads, 0);
});

console.log('told');
await proof('llms.txt names the file; /for/bots and /for/bots.md name it', async () => {
  const l = await call('/llms.txt', { accept: 'text/plain' }); assert.ok(l.text.includes('https://mareliberum.dev/.well-known/poppy.json'), 'llms.txt'); assert.ok(/Poppy/.test(l.text) && /Meta Muse/.test(l.text));
  const h = await call(BOTS.path, { accept: 'text/html' }); assert.equal(h.status, 200); assert.ok(h.text.includes(`${BASE}${POPPY.path}`), '/for/bots');
  const m = await call(`${BOTS.path}.md`, { accept: 'text/markdown' }); assert.equal(m.status, 200); assert.ok(m.text.includes(`${BASE}${POPPY.path}`), '/for/bots.md');
  assert.ok(!h.text.includes('/mcp/app') && !m.text.includes('/mcp/app'), 'still never the app door');
});
await proof('the guidance of /openapi.json stays under 4,000 characters', async () => {
  const g = (await call('/openapi.json')).j.info['x-guidance']; assert.ok(g.length < 4000, String(g.length));
});
await proof('proof:poppy in package.json', async () => {
  assert.equal(JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).scripts['proof:poppy'], 'node tools/poppy-proof.mjs');
});
console.log(`${passed} of ${passed + failed} proofs hold`);

// ------------------------------------------------------------------ negative controls: each rule broken in a copy, the proof must fail there
let caught = 0, missed = 0;
if (!process.argv.includes('--no-controls')) {
  console.log('\nnegative controls: each rule broken in a copy, the proof must fail there');
  const CONTROLS = [
    ['an auth block in the file', 'node/poppy.mjs', '    logo_uri: `${base}/icon-512.png`,\n', '    logo_uri: `${base}/icon-512.png`,\n    auth: { type: \'none\' },\n'],
    ['the app door named in the file', 'node/poppy.mjs', "{ type: 'mcp', url: `${base}/mcp`,", "{ type: 'mcp', url: `${base}/mcp/app`,"],
    ['an older protocol version', 'node/poppy.mjs', "version: '1.0',", "version: '0.4',"],
    ['the domain left out of the organization', 'node/poppy.mjs', "organization: { name: 'Mare Liberum', domain: host },", "organization: { name: 'Mare Liberum' },"],
    ['the sea\'s own calls counted', 'node/poppy.mjs', "if (!who || who.kind === 'self') return null;", 'if (!who) return null;'],
    ['no limit on names a day', 'node/poppy.mjs', 'Object.keys(by).length < POPPY.names', 'true'],
    ['a failing store stopping the file', 'node/poppy.mjs', '    return true;\n  } catch { return false; }', '    return true;\n  } finally { /* no guard */ }'],
    ['the route forgetting to count', 'node/core.mjs', "await poppyCount(cfg.kv, classify(req.headers.get('user-agent')), new Date().toISOString().slice(0, 10)); ", ''],
    ['the reads left out of /open.json', 'node/core.mjs', ', poppy: () => poppyToday(cfg.kv, new Date().toISOString().slice(0, 10))', ''],
    ['the file left out of llms.txt', 'site/llms.txt', 'https://mareliberum.dev/.well-known/poppy.json follows', 'The Poppy file follows'],
    ['the file left out of /for/bots', 'node/pages.mjs', '    poppy: `${base}/.well-known/poppy.json`,\n', '    poppy: `${base}/poppy`,\n'],
  ];
  for (const [name, f, from, to] of CONTROLS) {
    const d2 = mkdtempSync(join(tmpdir(), 'mare-poppy-ctl-'));
    try {
      cpSync(ROOT, d2, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      const fp = join(d2, f), txt = readFileSync(fp, 'utf8');
      if (!txt.includes(from)) { missed++; console.log(`  FAIL control "${name}": the line to break is gone from ${f}; the control needs updating`); continue; }
      writeFileSync(fp, txt.replace(from, to));
      const r = spawnSync(process.execPath, [join(d2, 'tools/poppy-proof.mjs'), '--no-controls'], { encoding: 'utf8', timeout: 240_000 });
      const out = `${r.stdout}${r.stderr}`, broke = (out.match(/\n  FAIL /g) || []).length;
      if (r.status !== 0 && broke > 0) { caught++; console.log(`  ok   caught: ${name} (${broke} proof${broke === 1 ? '' : 's'} failed)`); }
      else { missed++; console.log(`  FAIL control "${name}" was not caught (exit ${r.status})`); }
    } finally { try { rmSync(d2, { recursive: true, force: true }); } catch {} }
  }
  console.log(`${caught} of ${CONTROLS.length} controls caught`);
}
process.exit(failed || missed ? 1 : 0);
