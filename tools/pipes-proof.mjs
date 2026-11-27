// Mare Liberum · proof of the pipelines (3.36): the levers one step away in the clients and gateways agents run in.
// The plugin marketplace (both plugins by their documented fields and, where the claude CLI is there, by claude plugin
// validate and a real install into an empty config), the lean door as the second option of every client on /connect
// that takes an MCP address (the first option byte for byte that of the release before), "Plug it in" on /engine (every
// line in the form its documentation gives; the /compress snippets run against a node), the lean door in
// /.well-known/ard.json with a card of its own, the tests of both gateways (stand-ins, then a real node), the version,
// and /mcp/app answering initialize and tools/list as the release before does, with two nodes running (serve.mjs).
// Runs without the network (this machine and local git only): node tools/pipes-proof.mjs   (exit code 1 when a proof fails)
//   MARE_PIPES_REF=<git ref>   the release to hold /mcp/app, the first options of /connect and ard.json to (default 49c19d5,
//                              3.35.0, the release before the pipelines: since #27 merged, origin/main is 3.36.0 itself, and
//                              "the box of the release before" would be the box with its lean block)
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, mkdtempSync, mkdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { nodeOf, refTree, drop, OFF } from './engine-kit.mjs';
import { VERSION, normArd } from '../node/core.mjs';
import { RELEASES } from '../node/open.mjs';
import { clientsOf, leanOf, leanBench } from '../node/connect.mjs';
import { plugIn, PLUG_CHECKED, loadEngineBench } from '../node/engine-ui.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const rd = (p) => readFileSync(join(ROOT, p), 'utf8'), js = (p) => JSON.parse(rd(p));
const BASE = 'https://mareliberum.dev', LEAN = `${BASE}/mcp/lean`, APP = `${BASE}/mcp/app`, REF = process.env.MARE_PIPES_REF || '49c19d5';
let passed = 0, failed = 0;
const proof = async (name, fn) => { try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 5).join('\n       ')}`); } };
// this process speaks only to nodes on this machine
const realFetch = globalThis.fetch;
globalThis.fetch = async (u, o) => { const h = new URL(String(u?.url ?? u)).hostname; if (h !== '127.0.0.1') throw new Error(`the proof does not use the network: ${String(u).slice(0, 80)}`); return realFetch(u, o); };
const NO_PROXY = { NO_PROXY: '127.0.0.1,localhost', no_proxy: '127.0.0.1,localhost' };
const tmp = mkdtempSync(join(tmpdir(), 'mare-pipes-')), BENCH = loadEngineBench(), LB = leanBench(BENCH);
const n = (x) => Number(x).toLocaleString('en-US');

// ------------------------------------------------------------------ two nodes running: this tree and the release before
const freePort = () => new Promise((res) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const procs = [];
async function serve(dir) {
  const port = await freePort(), url = `http://127.0.0.1:${port}`;
  const p = spawn(process.execPath, ['serve.mjs', String(port)], { cwd: dir, env: { ...process.env, ...NO_PROXY, MARE_BASE: BASE, HOST: '127.0.0.1', MARE_STATE: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; p.stdout.on('data', (b) => { log += b; }); p.stderr.on('data', (b) => { log += b; }); procs.push(p);
  for (let i = 0; i < 150; i++) { try { if ((await fetch(`${url}/stats`, { headers: { 'user-agent': 'MareLiberum-session/1.0' } })).ok) return url; } catch {} await sleep(100); }
  throw new Error(`the node in ${dir} did not answer: ${log.slice(-400)}`);
}
const fullRef = (() => { const dir = join(tmp, 'ref'); mkdirSync(dir); const r = spawnSync('sh', ['-c', 'git -C "$1" archive "$2" | tar -x -C "$3"', 'sh', ROOT, REF, dir], { encoding: 'utf8' }); return r.status === 0 && existsSync(join(dir, 'serve.mjs')) ? dir : null; })();
const OURS = await serve(ROOT), THEIRS = fullRef ? await serve(fullRef) : null;
const THEIR_VERSION = fullRef ? /export const VERSION = '([^']+)'/.exec(readFileSync(join(fullRef, 'node/core.mjs'), 'utf8'))?.[1] : null;
const post = async (base, path, msg) => { const r = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'user-agent': 'pipes-proof/1.0' }, body: JSON.stringify(msg) }); return { status: r.status, type: r.headers.get('content-type'), body: await r.text() }; };

// in-process nodes (as serve.mjs answers): this tree with the engine on and off, and the release before
const SITE = { '/llms.txt': { body: rd('site/llms.txt'), type: 'text/plain; charset=utf-8' } };
const on = await nodeOf(ROOT, { base: BASE, site: SITE }), off = await nodeOf(ROOT, { base: BASE, site: SITE, cfg: OFF });
const refDir = refTree(ROOT, REF), ref = refDir ? await nodeOf(refDir, { base: BASE, site: SITE }) : null;
console.log(`nodes: this tree ${VERSION} (${OURS}), ${REF} ${THEIR_VERSION || 'NOT FOUND'} (${THEIRS || 'not running'})`);

// ================================================================== the marketplace
console.log('the Claude Code marketplace and its two plugins (code.claude.com/docs/en/plugins/marketplace-reference, /manifest-reference; cursor.com/docs/reference/plugins)');
const MARKET = js('.claude-plugin/marketplace.json'), CURSOR = js('.cursor-plugin/marketplace.json');
const PLUGIN_FIELDS = ['$schema', 'name', 'displayName', 'version', 'description', 'author', 'homepage', 'repository', 'license', 'keywords', 'privacyPolicyUrl'];
await proof('marketplace.json: name, owner and plugins as documented; mare-liberum first, still wiring the app door; mare-lean second', () => {
  assert.equal(MARKET.name, 'mare-liberum'); assert.ok(MARKET.owner?.name && MARKET.description);
  assert.deepEqual(MARKET.plugins.map((p) => [p.name, p.source]), [['mare-liberum', './plugins/mare-liberum'], ['mare-lean', './plugins/mare-lean']]);
  for (const p of MARKET.plugins) {
    assert.match(p.name, /^[a-z0-9]+(-[a-z0-9]+)*$/); assert.ok(statSync(join(ROOT, p.source)).isDirectory());
    assert.equal(p.version, js(join(p.source, '.claude-plugin/plugin.json')).version, 'one version where the plugin is named');
    assert.ok(p.description.length > 60 && !/\bbest\b|most advanced|world.?s/i.test(p.description));
  }
  // Claude Code counts a plugin's server and a connector with the same URL once: the first plugin stays at the connector's URL
  assert.deepEqual(js('plugins/mare-liberum/.mcp.json'), { mcpServers: { 'mare-liberum': { type: 'http', url: APP } } });
  assert.deepEqual(js('plugins/mare-liberum/mcp.json'), { mcpServers: { 'mare-liberum': { url: APP } } });
});
await proof('plugins/mare-lean: plugin.json with documented fields only, .mcp.json the http server mare-lean at the lean door; for Cursor its manifest, mcp.json and a place in .cursor-plugin/marketplace.json', () => {
  const pj = js('plugins/mare-lean/.claude-plugin/plugin.json');
  assert.equal(pj.name, 'mare-lean'); assert.match(pj.version, /^\d+\.\d+\.\d+$/); assert.ok(pj.author?.name && pj.license === 'MIT' && pj.description.length > 60);
  assert.equal(new URL(pj.homepage).href, `${BASE}/engine`); new URL(pj.privacyPolicyUrl);
  for (const k of Object.keys(pj)) assert.ok(PLUGIN_FIELDS.includes(k), `a documented field: ${k}`);
  assert.deepEqual(js('plugins/mare-lean/.mcp.json'), { mcpServers: { 'mare-lean': { type: 'http', url: LEAN } } });
  const cp = js('plugins/mare-lean/.cursor-plugin/plugin.json'); assert.equal(cp.name, 'mare-lean'); assert.equal(cp.version, pj.version); assert.ok(existsSync(join(ROOT, 'plugins/mare-lean', cp.logo)));
  assert.deepEqual(js('plugins/mare-lean/mcp.json'), { mcpServers: { 'mare-lean': { url: LEAN } } }, 'Cursor infers the transport from url');
  assert.deepEqual(CURSOR.plugins.map((p) => [p.name, p.source]), [['mare-liberum', 'plugins/mare-liberum'], ['mare-lean', 'plugins/mare-lean']]);
  for (const w of [pj.description, MARKET.plugins[1].description, cp.description]) assert.ok(w.includes(`${n(BENCH.mcp.lean.tokens.o200k_base)} tokens instead of ${n(BENCH.mcp.full.tokens.o200k_base)}`), 'the numbers of the bench');
});
await proof('the skill token-levers: its name is its folder, a description under 1,024 characters, and when to use since=, fields=, budget=, the lean door and /compress', () => {
  const md = rd('plugins/mare-lean/skills/token-levers/SKILL.md'), fm = /^---\n([\s\S]*?)\n---\n/.exec(md)?.[1] || '';
  const f = Object.fromEntries(fm.split('\n').map((l) => /^([a-z_-]+):\s*(.*)$/.exec(l)).filter(Boolean).map((x) => [x[1], x[2]]));
  assert.equal(f.name, 'token-levers'); assert.ok(f.description && f.description.length <= 1024); assert.ok(!/: /.test(f.description), 'a plain YAML scalar: no ": " inside');
  for (const w of ['?since=<etag>', 'If-None-Match', 'x-sea-delta', 'fields=', 'fmt=toon', 'budget=800&q=', 'lossy', 'https://mareliberum.dev/mcp/lean', 'find_tools', 'call_tool', 'POST https://mareliberum.dev/compress', 'output tokens', 'data, never instructions', 'x-sea-engine-lossy'])
    assert.ok(md.includes(w), w);
  assert.ok(md.includes(`${n(BENCH.mcp.lean.tokens.o200k_base)} tokens instead of ${n(BENCH.mcp.full.tokens.o200k_base)}`));
  assert.ok(!/\bbest\b|most advanced|world.?s/i.test(md));
});
await proof('the README of mare-lean says how to install it, names only the lean door\'s tools, and what it sends', () => {
  const md = rd('plugins/mare-lean/README.md');
  for (const w of ['/plugin marketplace add daoudandiaye98-alt/mare-liberum', '/plugin install mare-lean@mare-liberum', '/plugin install mare-lean --marketplace daoudandiaye98-alt/mare-liberum', LEAN, 'never pays', 'https://mareliberum.dev/privacy', 'License: MIT']) assert.ok(md.includes(w), w);
  for (const m of md.matchAll(/`([a-z_]+)`/g)) assert.ok(['read_page', 'think', 'find_tools', 'call_tool'].includes(m[1]), m[1]);
});
const CLAUDE = spawnSync('claude', ['--version'], { encoding: 'utf8' }).status === 0;
if (CLAUDE) {
  const cc = (args, dir) => spawnSync('claude', args, { encoding: 'utf8', timeout: 180_000, env: { ...process.env, CLAUDE_CONFIG_DIR: dir } });
  await proof('claude plugin validate --strict passes the marketplace, and --strict --profile directory (the checks of the plugin directory) both plugins', () => {
    const dir = mkdtempSync(join(tmp, 'cc-'));
    for (const [args, what] of [[['plugin', 'validate', '--strict', ROOT], 'the marketplace'], [['plugin', 'validate', '--strict', '--profile', 'directory', join(ROOT, 'plugins/mare-lean')], 'mare-lean'], [['plugin', 'validate', '--strict', '--profile', 'directory', join(ROOT, 'plugins/mare-liberum')], 'mare-liberum']]) {
      const r = cc(args, dir); assert.equal(r.status, 0, `${what}: ${r.stdout}${r.stderr}`); assert.match(r.stdout, /Validation passed/, what);
    }
    const lean = cc(['plugin', 'validate', '--strict', join(ROOT, 'plugins/mare-lean')], dir).stdout;
    assert.match(lean, /mcpServers: mare-lean http https:\/\/mareliberum\.dev\/mcp\/lean/); assert.match(lean, /skills: mare-lean:token-levers/);
  });
  await proof('a real install into an empty Claude Code config: claude plugin install mare-lean --marketplace <this repository>, then mare-liberum@mare-liberum, each with its own server and skill', () => {
    const dir = mkdtempSync(join(tmp, 'cc-'));
    const i = cc(['plugin', 'install', 'mare-lean', '--marketplace', ROOT, '--scope', 'user', '--json'], dir);
    assert.equal(i.status, 0, i.stdout + i.stderr); const got = JSON.parse(i.stdout.trim().split('\n').pop()); assert.equal(got.outcome, 'ok'); assert.equal(got.pluginId, 'mare-lean@mare-liberum');
    const d = cc(['plugin', 'details', 'mare-lean@mare-liberum'], dir).stdout; assert.match(d, /MCP servers \(1\)\s+mare-lean\b/); assert.match(d, /Skills \(1\)\s+token-levers/);
    const j = cc(['plugin', 'install', 'mare-liberum@mare-liberum', '--json'], dir); assert.equal(JSON.parse(j.stdout.trim().split('\n').pop()).outcome, 'ok', j.stdout + j.stderr);
    const e = cc(['plugin', 'details', 'mare-liberum@mare-liberum'], dir).stdout; assert.match(e, /MCP servers \(1\)\s+mare-liberum\b/);
    // Newer versions of the CLI list the plugins they ship inside themselves (ids ending in @builtin) in every config, even an
    // empty one; they are not installed from any marketplace, so the proof counts only the plugins an install put there.
    const list = JSON.parse(cc(['plugin', 'list', '--json'], dir).stdout); assert.deepEqual(list.map((p) => p.id).filter((id) => !/@builtin$/.test(id)).sort(), ['mare-lean@mare-liberum', 'mare-liberum@mare-liberum']);
  });
} else console.log('  note: no claude CLI on this machine: the plugins are held to their documented fields above only');

// ================================================================== /connect
console.log('/connect: the lean door as the second option of every client that takes an MCP address');
const LIST = clientsOf(BASE), MCP = LIST.filter((c) => c.door === 'app' || c.door === 'open'), L = leanOf(BASE);
const NAV = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', 'sec-fetch-mode': 'navigate', 'sec-fetch-site': 'same-origin', 'sec-fetch-dest': 'document' };
const pageOf = async (N) => (await N.call('/connect', { accept: 'text/html' })).text;
const LEAN_BLOCK = /<div class="lean-opt" id="lean-([a-z0-9-]+)">[\s\S]*?<\/div>\n/g;
const boxOf = (html, id) => new RegExp(`<div class="box" id="${id}">[\\s\\S]*?</div>`).exec(html)?.[0];
const PAGE_ON = await pageOf(on), PAGE_OFF = await pageOf(off), PAGE_REF = ref ? await pageOf(ref) : null;
await proof(`every client that takes an MCP address has a lean option (${MCP.length} of ${LIST.length}: not plain HTTP and A2A), in connect.json too; with the engine off none`, async () => {
  assert.equal(MCP.length, 18); assert.deepEqual(LIST.filter((c) => !c.lean).map((c) => c.id), ['http', 'a2a']); assert.deepEqual(Object.keys(L).sort(), MCP.map((c) => c.id).sort());
  const j = JSON.parse((await on.call('/connect.json')).text), j0 = JSON.parse((await off.call('/connect.json')).text);
  for (const c of j.clients) assert.equal(!!c.lean, c.door === 'app' || c.door === 'open', c.id);
  for (const c of j.clients.filter((x) => x.lean)) { assert.equal(c.lean.url, LEAN); assert.ok(c.lean.copy?.length || c.lean.button, c.id); }
  assert.ok(j0.clients.every((c) => !c.lean) && !j0.doors.lean, 'the engine off: no lean option in the data');
  assert.deepEqual(j.doors.lean.bench, LB, 'the bench numbers beside the live ones');
});
await proof('every lean line names the lean door and never the app door, every JSON block parses, and Claude Code gets claude mcp add --transport http mare-lean <lean door>', () => {
  for (const c of MCP) for (const x of c.lean.copy || []) {
    assert.ok(x.text.includes(LEAN) || x.text.endsWith('/plugin install mare-lean@mare-liberum'), `${c.id}: ${x.label}`); assert.ok(!x.text.includes(APP) && !x.text.includes(`"${BASE}/mcp"`) && !x.text.includes(`'${BASE}/mcp'`), `${c.id}: only the lean door`);
    if (/^\s*\{/.test(x.text)) assert.doesNotThrow(() => JSON.parse(x.text), `${c.id}: ${x.label}`);
  }
  const byId = Object.fromEntries(MCP.map((c) => [c.id, c.lean]));
  assert.equal(byId['claude-code'].copy[0].text, `claude mcp add --transport http mare-lean ${LEAN}`);
  assert.equal(byId['claude-code'].copy[1].text, '/plugin marketplace add daoudandiaye98-alt/mare-liberum\n/plugin install mare-lean@mare-liberum');
  assert.equal(byId.codex.copy[0].text, `codex mcp add mare-lean --url ${LEAN}`); assert.equal(byId.codex.copy[1].text, `[mcp_servers.mare-lean]\nurl = "${LEAN}"`);
  assert.equal(byId.gemini.copy[0].text, `gemini mcp add --transport http --scope user mare-lean ${LEAN}`); assert.equal(JSON.parse(byId.gemini.copy[1].text).mcpServers['mare-lean'].httpUrl, LEAN);
  assert.deepEqual(JSON.parse(byId.cursor.copy[0].text), { mcpServers: { 'mare-lean': { url: LEAN } } });
  assert.deepEqual(JSON.parse(/^code --add-mcp '(.*)'$/.exec(byId.vscode.copy[0].text)[1]), { name: 'mare-lean', type: 'http', url: LEAN });
  assert.equal(JSON.parse(byId.windsurf.copy[0].text).mcpServers['mare-lean'].serverUrl, LEAN); assert.equal(JSON.parse(byId.zed.copy[0].text).context_servers['mare-lean'].url, LEAN);
  assert.equal(JSON.parse(byId.cline.copy[0].text).mcpServers['mare-lean'].type, 'streamableHttp'); assert.match(byId.continue.copy[0].text, /type: streamable-http\n {4}url: https:\/\/mareliberum\.dev\/mcp\/lean$/);
  for (const id of ['claude', 'claude-desktop', 'chatgpt']) assert.equal(byId[id].copy[0].text, LEAN, id);
});
await proof('the lean install links hold the lean door (Cursor and LM Studio: base64 of {url} in letters and digits; VS Code: name, type http, url; Goose: streamable_http); ?door=lean leads there, a plain press to the full door as before, and with the engine off ?door=lean too', async () => {
  const b64 = (s) => JSON.parse(Buffer.from(decodeURIComponent(s), 'base64').toString('utf8'));
  for (const [id, prefix] of [['cursor', 'cursor://anysphere.cursor-deeplink/mcp/install?'], ['lmstudio', 'lmstudio://add_mcp?']]) {
    const go = L[id].go, raw = /[?&]config=([^&]*)/.exec(go)[1]; assert.ok(go.startsWith(prefix)); assert.match(raw, /^[A-Za-z0-9]+$/); assert.deepEqual(b64(raw), { url: LEAN }); assert.equal(new URLSearchParams(go.split('?')[1]).get('name'), 'mare-lean');
  }
  for (const [id, scheme] of [['vscode', 'vscode:mcp/install?'], ['vscode-insiders', 'vscode-insiders:mcp/install?']]) assert.deepEqual(JSON.parse(decodeURIComponent(L[id].go.slice(scheme.length))), { name: 'mare-lean', type: 'http', url: LEAN });
  const q = new URLSearchParams(L.goose.go.split('?')[1]); assert.equal(q.get('url'), LEAN); assert.equal(q.get('type'), 'streamable_http'); assert.equal(q.get('id'), 'mare-lean');
  for (const c of MCP.filter((x) => x.go || x.lean.go)) {
    const lean = await on.call(`/connect/go/${c.id}?door=lean`, { headers: NAV }), full = await on.call(`/connect/go/${c.id}`, { headers: NAV }), rest = await off.call(`/connect/go/${c.id}?door=lean`, { headers: NAV });
    assert.equal(lean.status, 302); assert.equal(lean.headers.get('location'), c.lean.go || c.go || `${BASE}/connect#${c.id}`, c.id);
    assert.equal(full.headers.get('location'), c.go || `${BASE}/connect#${c.id}`, `${c.id}: the first button leads where it led`);
    assert.equal(rest.headers.get('location'), full.headers.get('location'), `${c.id}: the engine off, the full door`);
  }
  const evil = await on.call('/connect/go/cursor?door=lean&to=https://evil.example', { headers: NAV }); assert.equal(evil.headers.get('location'), L.cursor.go, 'a request chooses a client and the lean door, never an address');
});
await proof(`the page: a lean block in each of the ${MCP.length} boxes after the first option, labelled with the bench (${LB.lean.tools} tools, ${LB.fewer} fewer tool-list tokens than the open door), its buttons counted for the client, its copies by the same beacon`, () => {
  const ids = [...PAGE_ON.matchAll(LEAN_BLOCK)].map((m) => m[1]); assert.deepEqual(ids.sort(), MCP.map((c) => c.id).sort());
  for (const c of MCP) {
    const box = new RegExp(`<div class="box" id="${c.id}">[\\s\\S]*?<div class="lean-opt" id="lean-${c.id}">([\\s\\S]*?)</div>\\n<p class="muted"><small>Checked against`).exec(PAGE_ON);
    assert.ok(box, `${c.id}: the lean block stands after the first option, before the line of the documentation`);
    assert.ok(box[1].includes(`<b>Lean door: ${LB.lean.tools} tools, ${LB.fewer} fewer tool-list tokens than the open door</b>`), c.id);
    if (c.lean.go) assert.ok(box[1].includes(`<a class="buy" href="/connect/go/${c.id}?door=lean" rel="nofollow">`), c.id);
    assert.equal((box[1].match(/<pre data-l="/g) || []).length, (c.lean.copy || []).length, c.id);
  }
  assert.match(PAGE_ON, /closest\('pre\[data-c\] \.copy,pre\[data-l\] \.copy'\)/); assert.match(PAGE_ON, /navigator\.sendBeacon\('\/connect\/go\/'\+\(p\.dataset\.c\|\|p\.dataset\.l\)\)/);
  assert.match(PAGE_ON, new RegExp(`<p id="door-lean">[^\\n]*${n(LB.lean.tokens)} tokens of tool list instead of ${n(LB.open.tokens)} for the open door, ${LB.fewer.replace(/[.]/g, '\\.')} fewer`));
  assert.ok(!/\bbest\b|most advanced|world.?s/i.test(PAGE_ON.replace(/<script[\s\S]*?<\/script>/g, '')));
});
await proof(`the first option of every box is byte for byte as before: the box without its lean block is the box with the engine off, and the box of ${REF}`, () => {
  assert.ok(PAGE_REF, `${REF}: no tree (git archive failed)`);
  const stripped = PAGE_ON.replace(LEAN_BLOCK, '');
  assert.ok(!/<div class="lean-opt"|<pre data-l=|\?door=lean"|id="door-lean"/.test(PAGE_OFF), 'the engine off: no lean option on the page');
  for (const c of LIST) { const a = boxOf(stripped, c.id), b = boxOf(PAGE_OFF, c.id), r = boxOf(PAGE_REF, c.id); assert.ok(a && b && r, c.id); assert.equal(a, b, `${c.id}: on and off`); assert.equal(a, r, `${c.id}: against ${REF}`); }
  assert.equal(stripped.replace(/<p id="door-lean">[^\n]*<\/p>\n/, ''), PAGE_OFF, 'and nothing else of the page moves with the engine');
});

// ================================================================== /engine: Plug it in
console.log('/engine: "Plug it in", every line in the form its documentation gives');
const ENG = (await on.call('/engine', { accept: 'text/html' })).text, ENGJ = JSON.parse((await on.call('/engine.json')).text), ENGJ0 = JSON.parse((await off.call('/engine.json')).text);
const ENGMD = (await on.call('/engine.md', { accept: 'text/markdown' })).text, P = plugIn(BASE), byPlug = Object.fromEntries(P.clients.map((c) => [c.id, c]));
const PLUG_IDS = ['claude-code', 'cursor', 'vscode', 'codex', 'gemini', 'openai-agents', 'langchain', 'vercel-ai', 'openai-responses', 'litellm'];
await proof(`/engine has "Plug it in" between the levers and the bench: a box for each of ${PLUG_IDS.length} clients and gateways and one for /compress, each with the documentation it was checked against (${PLUG_CHECKED})`, () => {
  assert.deepEqual(P.clients.map((c) => c.id), PLUG_IDS);
  const at = ENG.indexOf('<h2 id="plug">Plug it in</h2>'); assert.ok(at > ENG.indexOf('<div class="levers">') && at < ENG.indexOf('<h2>The bench</h2>'), 'after the levers, before the bench');
  for (const id of [...PLUG_IDS, 'compress']) {
    const box = new RegExp(`<div class="box plug" id="plug-${id}">([\\s\\S]*?)</div>`).exec(ENG)?.[1]; assert.ok(box, id);
    assert.match(box, /<pre><code>/, `${id}: a line to copy`); assert.match(box, /Checked against <a href="https:\/\//, `${id}: its documentation`);
  }
  for (const c of P.clients) for (const [, u] of c.docs) assert.match(u, /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}\//, `${c.id}: ${u}`);
  assert.ok(!/\bbest\b|most advanced|most complete|world.?s/i.test(ENG), 'no superlatives');
  for (const l of ['/savings', '/proof', '/fair', '/llms.txt', '/engine.json', '/engine.md']) assert.ok(ENG.includes(`href="${l}"`), l);
});
await proof('the lines: Claude Code, Cursor, VS Code, Codex, Gemini CLI, the OpenAI Agents SDK, LangChain (adapters and 1.4), the Vercel AI SDK, the OpenAI Responses API and LiteLLM each name the lean door in their documented form', () => {
  const t = (id, i = 0) => byPlug[id].lines[i].text;
  assert.equal(t('claude-code'), `claude mcp add --transport http mare-lean ${LEAN}`); assert.equal(t('claude-code', 1), '/plugin marketplace add daoudandiaye98-alt/mare-liberum\n/plugin install mare-lean@mare-liberum');
  assert.deepEqual(JSON.parse(t('cursor')), { mcpServers: { 'mare-lean': { url: LEAN } } });
  assert.deepEqual(JSON.parse(/^code --add-mcp '(.*)'$/.exec(t('vscode'))[1]), { name: 'mare-lean', type: 'http', url: LEAN }); assert.deepEqual(JSON.parse(t('vscode', 1)), { mcpServers: { 'mare-lean': { type: 'http', url: LEAN } } });
  assert.equal(t('codex'), `codex mcp add mare-lean --url ${LEAN}`); assert.equal(t('codex', 1), `[mcp_servers.mare-lean]\nurl = "${LEAN}"`);
  assert.equal(t('gemini'), `gemini mcp add --transport http --scope user mare-lean ${LEAN}`); assert.deepEqual(JSON.parse(t('gemini', 1)), { mcpServers: { 'mare-lean': { httpUrl: LEAN } } });
  assert.match(t('openai-agents'), new RegExp(`from agents\\.mcp import MCPServerStreamableHttp[\\s\\S]*MCPServerStreamableHttp\\(name="Mare Liberum Lean", params=\\{"url": "${LEAN}"\\}\\) as sea:[\\s\\S]*Agent\\(name="Assistant", mcp_servers=\\[sea\\]\\)[\\s\\S]*Runner\\.run\\(`));
  assert.match(t('langchain'), new RegExp(`from langchain_mcp_adapters\\.client import MultiServerMCPClient[\\s\\S]*MultiServerMCPClient\\(\\{"mare-lean": \\{"transport": "http", "url": "${LEAN}"\\}\\}\\)[\\s\\S]*await client\\.get_tools\\(\\)`));
  assert.match(t('langchain', 1), new RegExp(`from langchain\\.mcp import MCPAdapter[\\s\\S]*async with MCPAdapter\\("${LEAN}"\\) as sea:[\\s\\S]*await sea\\.list_tools\\(\\)`));
  assert.match(t('vercel-ai'), new RegExp(`import \\{ createMCPClient \\} from '@ai-sdk/mcp';[\\s\\S]*createMCPClient\\(\\{ transport: \\{ type: 'http', url: '${LEAN}' \\} \\}\\)[\\s\\S]*tools: await sea\\.tools\\(\\)[\\s\\S]*onEnd: async \\(\\) => \\{ await sea\\.close\\(\\); \\}`));
  const body = JSON.parse(/-d '(\{[\s\S]*\})'$/.exec(t('openai-responses'))[1]), tool = body.tools[0];
  assert.ok(t('openai-responses').startsWith('curl https://api.openai.com/v1/responses \\\n  -H "Authorization: Bearer $OPENAI_API_KEY" \\\n  -H \'content-type: application/json\' \\\n  -d \'{'));
  assert.equal(tool.type, 'mcp'); assert.equal(tool.server_url, LEAN); assert.match(tool.server_label, /^[a-z_]+$/);
  assert.deepEqual(tool.require_approval, { never: { tool_names: ['read_page', 'think', 'find_tools'] } }, 'read-only tools unasked; call_tool asks first');
  assert.equal(t('litellm'), `mcp_servers:\n  mare_lean:\n    url: "${LEAN}"\n    transport: "http"\n    auth_type: "none"`);
  assert.equal(t('litellm', 1), 'litellm_settings:\n  callbacks: litellm_mare_compress.proxy_handler_instance');
  assert.ok(existsSync(join(ROOT, 'integrations/gateways/litellm_mare_compress.py')) && byPlug.litellm.file.endsWith('/integrations/gateways/litellm_mare_compress.py'));
  for (const f of P.compress.files) assert.ok(existsSync(join(ROOT, f.url.split('/blob/main/')[1])), f.url);
});
await proof('/engine.json carries the section as data (plug), the same with the engine on and off; /engine.md as Markdown', () => {
  assert.deepEqual(ENGJ.plug, JSON.parse(JSON.stringify(P))); assert.deepEqual(ENGJ0.plug, ENGJ.plug);
  assert.match(ENGMD, /## Plug it in/); assert.ok(ENGMD.includes(`claude mcp add --transport http mare-lean ${LEAN}`)); assert.doesNotMatch(ENGMD, /<div|<script/);
});
await proof('the /compress snippets run: curl, Python and TypeScript make a page smaller on this node, and give the original text back when nothing answers', () => {
  const local = `${OURS}/compress`, html = `<html><body><main><h1>Plans</h1>${Array.from({ length: 80 }, (_, i) => `<p class="x">  Plan ${i}:   ${i} EUR  </p>\n`).join('')}</main></body></html>`;
  const lines = Object.fromEntries(P.compress.lines.map((l) => [l.label.split(':')[0].split(',')[0], l.text.replaceAll(`${BASE}/compress`, local)]));
  const dir = mkdtempSync(join(tmp, 'snip-')); writeFileSync(join(dir, 'page.html'), html);
  const c = spawnSync('sh', ['-c', lines.curl], { cwd: dir, encoding: 'utf8', env: { ...process.env, ...NO_PROXY }, timeout: 30_000 }), cj = JSON.parse(c.stdout);
  assert.ok(cj.out.length < html.length && cj.tokens.saved > 0 && !cj.out.includes('<p'), 'curl: the page as Markdown, smaller');
  writeFileSync(join(dir, 'snippet.py'), `${lines.Python}\n\nimport sys\npage = open(sys.argv[1]).read()\nout = squeeze(page)\nprint(len(page), len(out), out.splitlines()[0])\n`);
  const py = spawnSync('python3', ['-I', join(dir, 'snippet.py'), join(dir, 'page.html')], { encoding: 'utf8', env: { ...process.env, ...NO_PROXY }, timeout: 30_000 });
  assert.equal(py.status, 0, py.stderr); const [pb, pa, ph] = py.stdout.trim().split(' '); assert.ok(Number(pa) < Number(pb) && ph === '#', `python: ${py.stdout}`);
  writeFileSync(join(dir, 'snippet.ts'), `${lines.TypeScript}\n\nimport { readFileSync } from 'node:fs';\nconst page = readFileSync(process.argv[2], 'utf8');\nconst out = await squeeze(page);\nconsole.log(page.length, out.length, out.split('\\n')[0]);\n`);
  const ts = spawnSync(process.execPath, [join(dir, 'snippet.ts'), join(dir, 'page.html')], { encoding: 'utf8', env: { ...process.env, ...NO_PROXY }, timeout: 30_000 });
  assert.equal(ts.status, 0, ts.stderr); const [tb, ta, th] = ts.stdout.trim().split(' '); assert.ok(Number(ta) < Number(tb) && th === '#', `typescript: ${ts.stdout}`);
  // nothing listens on port 9 of this machine: both give the text back as it was
  writeFileSync(join(dir, 'snippet.py'), `${lines.Python.replaceAll(local, 'http://127.0.0.1:9/compress')}\n\nimport sys\npage = open(sys.argv[1]).read()\nprint(squeeze(page) == page)\n`);
  assert.equal(spawnSync('python3', ['-I', join(dir, 'snippet.py'), join(dir, 'page.html')], { encoding: 'utf8', env: { ...process.env, ...NO_PROXY }, timeout: 30_000 }).stdout.trim(), 'True');
  writeFileSync(join(dir, 'snippet.ts'), `${lines.TypeScript.replaceAll(local, 'http://127.0.0.1:9/compress')}\n\nimport { readFileSync } from 'node:fs';\nconst page = readFileSync(process.argv[2], 'utf8');\nconsole.log((await squeeze(page)) === page);\n`);
  assert.equal(spawnSync(process.execPath, [join(dir, 'snippet.ts'), join(dir, 'page.html')], { encoding: 'utf8', env: { ...process.env, ...NO_PROXY }, timeout: 30_000 }).stdout.trim(), 'true');
});

// ================================================================== the gateways
console.log('the gateways: a LiteLLM proxy callback and Vercel AI SDK middleware for /compress (integrations/gateways)');
const LIVE = { ...process.env, ...NO_PROXY, MARE_COMPRESS_LIVE_URL: `${OURS}/compress` };
await proof('the LiteLLM callback: its tests hold without LiteLLM (a stand-in CustomLogger and /compress), and live against this node\'s /compress', () => {
  const r = spawnSync('python3', ['-I', join(ROOT, 'integrations/gateways/test_litellm_mare_compress.py')], { encoding: 'utf8', env: LIVE, timeout: 120_000 });
  assert.equal(r.status, 0, r.stdout + r.stderr); assert.match(r.stderr, /test_live_a_node_of_mare_liberum \S+ \.\.\. ok/); assert.match(r.stderr, /Ran 12 tests[\s\S]*\nOK/);
});
await proof('the Vercel AI SDK middleware: its tests hold without the AI SDK (prompts in its own form, a stand-in /compress), and live against this node\'s /compress', () => {
  const r = spawnSync(process.execPath, [join(ROOT, 'integrations/gateways/vercel-ai-mare-compress.test.ts')], { encoding: 'utf8', env: LIVE, timeout: 120_000 });
  assert.equal(r.status, 0, r.stdout + r.stderr); assert.match(r.stdout, /ok {3}live: /); assert.match(r.stdout, /9 held, 0 failed/);
});
await proof('both say plainly what leaves for mareliberum.dev, that nothing is stored, and that they fail open; neither needs a package of its own', () => {
  for (const f of ['integrations/gateways/litellm_mare_compress.py', 'integrations/gateways/vercel-ai-mare-compress.ts']) {
    const head = rd(f).slice(0, 2600);
    for (const w of ['https://mareliberum.dev/compress', 'What leaves your', 'nothing sent to /compress is stored or logged', 'Fails open', 'keeps the original', 'lossless']) assert.ok(head.includes(w), `${f}: ${w}`);
  }
  assert.deepEqual([...rd('integrations/gateways/litellm_mare_compress.py').matchAll(/^(?:import|from) (\S+)/gm)].map((m) => m[1]).sort(), ['asyncio', 'collections', 'hashlib', 'json', 'litellm.integrations.custom_logger', 'os', 'urllib.request']);
  assert.ok(!/^import (?!type)/m.test(rd('integrations/gateways/vercel-ai-mare-compress.ts')), 'the middleware imports nothing at run time');
});

// ================================================================== the directories: ard.json and the lean card
console.log('/.well-known/ard.json and ai-catalog.json name the lean door; its card');
await proof(`ard.json and ai-catalog.json: the entries of ${REF} unchanged and in their place, the lean door after them (its card, its 4 tools, /engine as documentation); the engine off, byte for byte the catalog of ${REF}`, async () => {
  assert.ok(ref, `${REF}: no tree`);
  for (const p of ['/.well-known/ard.json', '/.well-known/ai-catalog.json']) {
    const a = JSON.parse((await on.call(p)).text), z = (await off.call(p)).text, r = (await ref.call(p)).text;
    assert.equal(z, r, `${p}: the engine off is ${REF}`);
    const base = JSON.parse(r); assert.deepEqual({ ...a, entries: a.entries.slice(0, base.entries.length) }, base, `${p}: the entries before stay as they were`);
    assert.equal(a.entries.length, base.entries.length + 1); const e = a.entries.at(-1);
    assert.equal(e.identifier, 'urn:air:mareliberum.dev:mcp:lean'); assert.equal(e.type, 'application/mcp-server-card+json'); assert.equal(e.url, `${LEAN}/server-card.json`); assert.equal(e.data, undefined, 'url or data, not both');
    assert.deepEqual(e.capabilities, ['read_page', 'think', 'find_tools', 'call_tool']); assert.match(e.displayName, /4 tools/); assert.ok(e.description.includes(LEAN) && e.description.includes(`${BASE}/engine`));
    assert.deepEqual(e.metadata, { documentationUrl: `${BASE}/engine` }); assert.ok(e.representativeQueries.length >= 2 && e.representativeQueries.length <= 5);
  }
});
await proof('/mcp/lean/server-card.json: the card of the lean door (dev.mareliberum/lean, its remote, the tools /mcp/lean lists, /engine as website); the engine off, 404', async () => {
  const c = await on.call('/mcp/lean/server-card.json'); assert.equal(c.status, 200); const card = JSON.parse(c.text);
  const tools = JSON.parse((await on.rpc('/mcp/lean', 'tools/list')).text).result.tools;
  assert.equal(card.name, 'dev.mareliberum/lean'); assert.equal(card.name, js('server-lean.json').name, 'the name of its registry entry'); assert.equal(card.version, VERSION);
  assert.deepEqual(card.remotes, [{ type: 'streamable-http', url: LEAN }]); assert.equal(card.websiteUrl, `${BASE}/engine`); assert.deepEqual(card.authentication, { required: false, schemes: [] });
  assert.deepEqual(card.tools.map((t) => t.name), tools.map((t) => t.name)); for (const t of card.tools) assert.ok(t.title && t.description && t.annotations, t.name);
  const z = await off.call('/mcp/lean/server-card.json'); assert.equal(z.status, 404); assert.match(JSON.parse(z.text).error.message, /answers as the open door/);
});
await proof('the sea reads its own lean entry as it reads any domain\'s (normArd): an MCP entry of mareliberum.dev with its card', async () => {
  const e = JSON.parse((await on.call('/.well-known/ard.json')).text).entries.at(-1), row = normArd(e, 'mareliberum.dev');
  assert.ok(row); assert.equal(row.kind, 'mcp'); assert.equal(row.id, e.identifier); assert.equal(row.url, `${LEAN}/server-card.json`); assert.deepEqual(row.capabilities, e.capabilities);
});

// ================================================================== /mcp/app: as the release before
console.log(`/mcp/app answers as ${REF} does (two nodes running)`);
const CALLS = {
  initialize: { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'pipes-proof', version: '1' } } },
  initialize_latest: { jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'pipes-proof', version: '1' } } },
  'tools/list': { jsonrpc: '2.0', id: 3, method: 'tools/list', params: {} },
};
await proof(`/mcp/app: tools/list byte for byte as ${REF} answers it, initialize byte for byte but for the version the node names in serverInfo (${THEIR_VERSION} there, ${VERSION} here)`, async () => {
  assert.ok(THEIRS, `${REF}: no node running`);
  for (const [k, msg] of Object.entries(CALLS)) {
    const a = await post(OURS, '/mcp/app', msg), b = await post(THEIRS, '/mcp/app', msg);
    assert.equal(a.status, 200, k); assert.equal(a.status, b.status, k); assert.equal(a.type, b.type, k);
    if (k === 'tools/list') { assert.equal(a.body, b.body, k); continue; }
    const v = (body, ver) => body.replace(`"serverInfo":{"name":"mare-liberum","title":"Mare Liberum","version":"${ver}"}`, '"serverInfo":{"name":"mare-liberum","title":"Mare Liberum","version":"<node>"}');
    assert.ok(a.body.includes(`"version":"${VERSION}"`), `${k}: this node names ${VERSION}`); assert.equal(v(a.body, VERSION), v(b.body, THEIR_VERSION), k);
  }
  const lean = JSON.parse((await post(OURS, '/mcp/lean', CALLS['tools/list'])).body).result.tools; assert.deepEqual(lean.map((t) => t.name), ['read_page', 'think', 'find_tools', 'call_tool'], 'and the lean door is the lean door');
});

// ================================================================== the release
console.log('the release of the pipelines, 3.36.0, in the releases; the version files name the running version; the Gemini extension; llms.txt and the README');
// (3.37.0 names itself in tools/toll-proof.mjs: here 3.36.0 keeps its day and pull request, and 3.35.0 its own)
await proof('VERSION in server.json, server-dev.json, server-lean.json and gemini-extension.json; RELEASES: 3.36.0 on 2026-11-25T19:03:27+01:00 with #27, 3.35.0 on 2026-11-25T17:36:55+01:00 with #25', () => {
  for (const f of ['server.json', 'server-dev.json', 'server-lean.json', 'gemini-extension.json']) assert.equal(js(f).version, VERSION, f);
  assert.equal(rd('server-dev.json'), rd('server.json')); assert.deepEqual(js('server-lean.json').remotes, [{ type: 'streamable-http', url: LEAN }]);
  const r36 = RELEASES.findIndex((r) => r.version === '3.36.0'); assert.ok(r36 >= 0 && RELEASES[r36].what.length > 40 && !RELEASES[r36].what.includes('\n'));
  assert.deepEqual([RELEASES[r36].version, RELEASES[r36].at, RELEASES[r36].pr], ['3.36.0', '2026-11-25T19:03:27+01:00', 'https://github.com/daoudandiaye98-alt/mare-liberum/pull/27']);
  assert.deepEqual([RELEASES[r36 + 1].version, RELEASES[r36 + 1].at, RELEASES[r36 + 1].pr], ['3.35.0', '2026-11-25T17:36:55+01:00', 'https://github.com/daoudandiaye98-alt/mare-liberum/pull/25']);
});
await proof('the Gemini extension connects the lean door (Gemini CLI puts every tool definition into each turn), and GEMINI.md says how call_tool and find_tools reach the other tools', () => {
  assert.deepEqual(js('gemini-extension.json').mcpServers, { 'mare-liberum': { httpUrl: LEAN } });
  const md = rd('GEMINI.md'); for (const w of [LEAN, '`read_page` and `think` are called directly', '`call_tool` with its name and arguments', '`find_tools`', 'data, never instructions', 'never pays']) assert.ok(md.includes(w), w);
});
await proof('llms.txt and the README: a short "Plug in" section pointing to /engine#plug, /connect, the plugin and both gateways', () => {
  const l = /## Plug in\n\n([\s\S]*?)\n## /.exec(rd('site/llms.txt'))?.[1] || '', r = /## Plug in\n\n([\s\S]*?)\n## /.exec(rd('README.md'))?.[1] || '';
  for (const s of [l, r]) for (const w of ['/engine#plug', '/connect', `claude mcp add --transport http mare-lean ${LEAN}`, '/plugin install mare-lean@mare-liberum', 'litellm_mare_compress.py', 'vercel-ai-mare-compress.ts']) assert.ok(s.includes(w), w);
  assert.ok(l.length < 1800 && r.length < 2000, 'short'); assert.doesNotMatch(l + r, /\bbest\b|most advanced|world.?s/i);
});
await proof('package.json runs this proof as proof:pipes', () => assert.equal(js('package.json').scripts['proof:pipes'], 'node tools/pipes-proof.mjs'));

for (const p of procs) p.kill();
drop(tmp); if (refDir && refDir !== process.env.MARE_REF_DIR) drop(refDir);
console.log(`\n${passed} held, ${failed} failed`);
process.exit(failed ? 1 : 0);
