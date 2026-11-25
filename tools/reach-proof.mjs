// Mare Liberum · proof of the reach: the public repository is an install source for Gemini CLI, Claude Code, Cursor and
// the official MCP registry, every manifest carries the fields its documentation requires, every tool of the open door
// (/mcp) is described for an agent (a title, when to use it and when a sibling fits, what it stores, what comes back,
// every input, the MCP annotations), and the app door (/mcp/app) answers initialize and tools/list byte for byte as the
// assistant directories reviewed it at 3.32.0 (tools/app-door-3.32.0.json).
// Runs without the network: node tools/reach-proof.mjs   (exit code 1 when a proof fails)
//   --against <git ref>   also holds the app door of this tree to the one of that ref (local git only), e.g. origin/main
//   --print [core.mjs]    prints the raw bodies of the app door of a tree (how the fixture was made)
// The documents each check follows are named beside it; their addresses are in the report of the branch reach/1.
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

globalThis.fetch = async (u) => { throw new Error(`the proof does not use the network: ${String(u).slice(0, 80)}`); };

// the app door as a client meets it: the raw bodies of initialize and tools/list, from the core module of any tree
export const DOOR_CALLS = {
  initialize: { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'reach-proof', version: '1' } } },
  initialize_latest: { jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'reach-proof', version: '1' } } },
  'tools/list': { jsonrpc: '2.0', id: 3, method: 'tools/list', params: {} },
};
export async function doorBodies(coreUrl, door = '/mcp/app') {
  const { handle } = await import(coreUrl), { createMem } = await import(new URL('./mem.mjs', coreUrl).href);
  const base = 'https://mareliberum.dev', db = createMem({ file: '/nonexistent/reach-proof.tsv', base });
  const out = {}; let n = 0;
  for (const [k, msg] of Object.entries(DOOR_CALLS)) {
    const res = await handle(new Request(base + door, { method: 'POST', headers: { accept: 'application/json, text/event-stream', 'content-type': 'application/json', 'user-agent': 'reach-proof/1.0', 'x-forwarded-for': `198.18.9.${10 + n++}` }, body: JSON.stringify(msg) }), db, { base, site: {} });
    out[k] = { status: res.status, body: await res.text() };
  }
  return out;
}

if (process.argv.includes('--print')) {
  const arg = process.argv[process.argv.indexOf('--print') + 1];
  const core = pathToFileURL(resolve(arg && !arg.startsWith('--') ? arg : fileURLToPath(new URL('../node/core.mjs', import.meta.url)))).href;
  const { VERSION } = await import(core);
  console.log(JSON.stringify({ version: VERSION, bodies: await doorBodies(core) }, null, 1));
  process.exit(0);
}

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const rd = (p) => readFileSync(join(ROOT, p), 'utf8'), js = (p) => JSON.parse(rd(p));
let passed = 0, failed = 0;
const proof = async (name, fn) => { try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 4).join('\n       ')}`); } };
const CORE = pathToFileURL(join(ROOT, 'node/core.mjs')).href;
const { VERSION, serverCard } = await import(CORE);
const FIX = js('tools/app-door-3.32.0.json');
// the node names its own version in serverInfo: that, and only that, may move with a release
const norm = (body, v) => body.replace(`"serverInfo":{"name":"mare-liberum","title":"Mare Liberum","version":"${v}"}`, '"serverInfo":{"name":"mare-liberum","title":"Mare Liberum","version":"<node>"}');
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const semver = (v) => String(v).split(/[-+]/)[0].split('.').map(Number);
const older = (a, b) => { const x = semver(a), y = semver(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i]; return false; };
const DOOR = 'https://mareliberum.dev/mcp', REPO = 'https://github.com/daoudandiaye98-alt/mare-liberum';
const png = (p) => { const b = readFileSync(join(ROOT, p)); assert.equal(b.subarray(1, 4).toString(), 'PNG', `${p} is a PNG`); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), bytes: b.length }; };
const frontmatter = (md) => { const m = /^---\n([\s\S]*?)\n---/.exec(md); assert.ok(m, 'frontmatter'); return Object.fromEntries(m[1].split('\n').map((l) => /^([a-z_-]+):\s*(.*)$/.exec(l)).filter(Boolean).map((x) => [x[1], x[2]])); };

// ------------------------------------------------------------------------------------------------------------ the app door
console.log('the app door stays as the directories reviewed it');
await proof('initialize (two protocol versions) and tools/list of /mcp/app are byte for byte the bodies of 3.32.0', async () => {
  const now = await doorBodies(CORE);
  for (const k of Object.keys(DOOR_CALLS)) {
    assert.equal(now[k].status, 200, k);
    assert.equal(norm(now[k].body, VERSION), norm(FIX.bodies[k].body, FIX.version), `${k} of /mcp/app differs from tools/app-door-3.32.0.json`);
  }
});
await proof('the fixture holds what it says: the calls of this proof, 14 app tools, the reviewed instructions without the map of the open door', () => {
  assert.deepEqual(FIX.calls, DOOR_CALLS); assert.equal(FIX.version, '3.32.0');
  const tools = JSON.parse(FIX.bodies['tools/list'].body).result.tools;
  assert.deepEqual(tools.map((t) => t.name), ['ask', 'decide', 'answers', 'read_page', 'check_site', 'think', 'lay_path', 'rate_path', 'mind_new', 'mind', 'mind_add', 'search', 'get', 'stats']);
  const i = JSON.parse(FIX.bodies.initialize.body).result.instructions;
  assert.ok(i.startsWith('Mare Liberum is an open, ownerless place for AI agents, with no accounts. read_page') && !/Start with the tool/.test(i));
});
const against = process.argv.indexOf('--against');
if (against > 0) {
  const ref = process.argv[against + 1] && !process.argv[against + 1].startsWith('--') ? process.argv[against + 1] : 'origin/main';
  await proof(`the app door of this tree and of ${ref} answer byte for byte the same (git archive of node/, no network)`, async () => {
    const dir = mkdtempSync(join(tmpdir(), 'reach-ref-'));
    try {
      execFileSync('tar', ['-x', '-C', dir], { input: execFileSync('git', ['-C', ROOT, 'archive', ref, 'node'], { maxBuffer: 512 * 2 ** 20 }) });
      const other = pathToFileURL(join(dir, 'node/core.mjs')).href, { VERSION: v2 } = await import(other);
      const [ours, theirs] = [await doorBodies(CORE), await doorBodies(other)];
      for (const k of Object.keys(DOOR_CALLS)) assert.equal(norm(ours[k].body, VERSION), norm(theirs[k].body, v2), `${k}: this tree and ${ref} differ`);
      console.log(`       ${ref} names ${v2}, this tree ${VERSION}; ${Object.keys(DOOR_CALLS).length} bodies compared`);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
}

// ----------------------------------------------------------------------------------------------------------- the open door
console.log('the open door says what each tool is for (MCP 2025-11-25 Tool and ToolAnnotations; Glama TDQS)');
const LIST = JSON.parse((await doorBodies(CORE, '/mcp'))['tools/list'].body), OPEN = LIST.result.tools;
const NAMES = new Set(OPEN.map((t) => t.name)), PROPS = new Set(OPEN.flatMap((t) => Object.keys(t.inputSchema?.properties || {})));
// the lean door (since 3.36 the door of the Gemini extension and of the plugin mare-lean)
const LEAN_TOOLS = JSON.parse((await doorBodies(CORE, '/mcp/lean'))['tools/list'].body).result.tools;
const HINTS = ['readOnlyHint', 'destructiveHint', 'idempotentHint', 'openWorldHint'];
await proof('no tool of 3.32.0 is removed or renamed, and the order stays; a tool added since has its own entry in node/opentools.mjs', async () => {
  const kept = OPEN.map((t) => t.name).filter((n) => FIX.openDoorTools.includes(n)); assert.deepEqual(kept, FIX.openDoorTools);
  const { OPEN: TEXTS } = await import(pathToFileURL(join(ROOT, 'node/opentools.mjs')).href);
  for (const n of NAMES) assert.ok(TEXTS[n], `the open door has ${n}, but node/opentools.mjs has no entry for it: add a lean one`);
});
await proof('every tool has a title of its own, a description that says what it does, when to use it (and which sibling fits otherwise) and what comes back', () => {
  for (const t of OPEN) {
    assert.ok(t.title && t.title !== t.name && t.title.length > t.name.length, `${t.name}: a meaningful title`);
    assert.ok(t.description.length >= 100 && t.description.length <= 320, `${t.name}: description of ${t.description.length} characters (100 to 320)`);
    assert.match(t.description, /\b[Uu]se\b/, `${t.name}: says when to use it or which sibling instead`);
    assert.match(t.description, /\bReturns\b/, `${t.name}: says what comes back`);
    assert.ok(t.description.length > 2 * t.title.length && !t.description.toLowerCase().startsWith(t.title.toLowerCase() + '.'), `${t.name}: more than its title`);
  }
});
await proof('every tool another tool names exists: no description points to a tool the door does not have', () => {
  const allowed = new Set([...NAMES, ...PROPS, 'worked_it', 'failed_it', 'source_bound_answerer']);
  for (const t of OPEN) for (const w of t.description.match(/\b[a-z]+_[a-z_]+\b/g) || []) assert.ok(allowed.has(w), `${t.name} names ${w}`);
  // the siblings the descriptions point to are spread over the door, not one tool everybody leans on
  const named = new Map(); for (const t of OPEN) for (const n of NAMES) if (n !== t.name && new RegExp(`\\buse ${n}\\b`).test(t.description)) named.set(n, (named.get(n) || 0) + 1);
  assert.ok(named.size >= 20, `${named.size} distinct siblings are named as the alternative`);
});
await proof('every input is described, every required input exists, and the schema stays an object', () => {
  for (const t of OPEN) {
    assert.equal(t.inputSchema?.type, 'object', t.name);
    const p = t.inputSchema.properties || {};
    for (const [k, v] of Object.entries(p)) assert.ok(typeof v.description === 'string' && v.description.length >= 8, `${t.name}.${k} has no description`);
    for (const r of t.inputSchema.required || []) assert.ok(p[r], `${t.name}: required ${r} is not a property`);
  }
});
await proof('every tool carries all four annotations as booleans; the title lives once, on the tool', () => {
  for (const t of OPEN) { for (const h of HINTS) assert.equal(typeof t.annotations[h], 'boolean', `${t.name}.${h}`); assert.deepEqual(Object.keys(t.annotations), HINTS, t.name); }
});
await proof('annotations and descriptions never contradict each other', () => {
  const PUBLISHES = /\b(publish(es)?|is public|are public|becomes a public|carried to|is laid|leaves the need)\b/i;
  const LEAVES_A_MARK = /\b(public\w*|stored|kept|carried|inbox|ticket|counted|moves?|records|hides?|removed|keeps|issues|sets|state|reorders?)\b/i;
  for (const t of OPEN) {
    const a = t.annotations, d = t.description;
    if (a.readOnlyHint) { assert.ok(!PUBLISHES.test(d), `${t.name} is read-only but says it publishes: ${d.match(PUBLISHES)?.[0]}`); assert.equal(a.destructiveHint, false, t.name); }
    else assert.match(d, LEAVES_A_MARK, `${t.name} changes something and must say what`);
    if (a.destructiveHint) assert.match(d, /\b(removed|for good|stops working)\b/, `${t.name} is destructive and must say what is lost`);
  }
  // the hints that matter most to a client, tool by tool
  const ro = (n) => OPEN.find((t) => t.name === n).annotations.readOnlyHint, ow = (n) => OPEN.find((t) => t.name === n).annotations.openWorldHint;
  for (const n of ['search', 'get', 'brief', 'review', 'check_site', 'site', 'find', 'route', 'think', 'mind', 'stats', 'flow', 'notes', 'jobs', 'works', 'earn', 'build_agent']) assert.equal(ro(n), true, `${n} only reads`);
  for (const n of ['ask', 'decide', 'read_page', 'enter', 'answer', 'mark', 'note', 'lay_path', 'rate_path', 'mind_new', 'mind_add', 'publish_work', 'leave', 'job_step', 'heartbeat', 'harbour_new']) assert.equal(ro(n), false, `${n} changes something`);
  for (const n of ['search', 'read_page', 'check_site', 'site', 'review', 'earn', 'ask', 'decide', 'join']) assert.equal(ow(n), true, `${n} reaches beyond the sea`);
  for (const n of ['mind', 'mind_new', 'mind_add', 'brief', 'think', 'route', 'find', 'stats']) assert.equal(ow(n), false, `${n} stays inside the sea`);
  assert.deepEqual(OPEN.filter((t) => t.annotations.destructiveHint).map((t) => t.name), ['leave', 'job_step']);
});
await proof('ask and decide can both stay quiet on the open door; the app door offers neither quiet nor verified', async () => {
  for (const n of ['ask', 'decide']) { const p = OPEN.find((t) => t.name === n).inputSchema.properties; assert.equal(p.quiet.type, 'boolean'); assert.equal(p.verified.type, 'boolean'); }
  const app = JSON.parse(FIX.bodies['tools/list'].body).result.tools;
  for (const n of ['ask', 'decide']) { const p = app.find((t) => t.name === n).inputSchema.properties; assert.equal(p.quiet, undefined); assert.equal(p.verified, undefined); }
});
await proof('the server card the registry entry points to shows the same tools as the open door', () => {
  const card = serverCard('https://mareliberum.dev');
  assert.deepEqual(card.tools, OPEN.map((t) => ({ name: t.name, title: t.title, description: t.description, annotations: t.annotations })));
  assert.equal(card.remotes[0].url, DOOR);
});
const OPEN_BYTES = Buffer.byteLength((await doorBodies(CORE, '/mcp'))['tools/list'].body), HARD = 45 * 1024;
await proof(`the open door's tool list stays lean: ${OPEN_BYTES} bytes (about ${Math.round(OPEN_BYTES / 4)} tokens), at most ${FIX.openDoorBytes} as at 3.32.0`, () => {
  // every agent that loads the list pays for each byte: say more only by saying something else in fewer words, or raise the
  // ceiling on purpose (never above 45 KB)
  assert.ok(FIX.openDoorBytes <= HARD);
  assert.ok(OPEN_BYTES <= FIX.openDoorBytes, `the open door's tools/list is ${OPEN_BYTES} bytes, more than ${FIX.openDoorBytes}: tighten node/opentools.mjs`);
});

// -------------------------------------------------------------------------------------------- the official MCP registry
console.log('the official MCP registry (server.schema.json 2025-12-11)');
const SERVER = js('server.json');
await proof('server.json has the required name, description and version, within the limits of the schema', () => {
  assert.equal(SERVER.$schema, 'https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json');
  assert.match(SERVER.name, /^[a-zA-Z0-9.-]+\/[a-zA-Z0-9._-]+$/); assert.ok(SERVER.name.length >= 3 && SERVER.name.length <= 200);
  assert.ok(SERVER.description.length >= 1 && SERVER.description.length <= 100, `description of ${SERVER.description.length} characters (at most 100)`);
  assert.ok(!SERVER.title || (SERVER.title.length >= 1 && SERVER.title.length <= 100));
  assert.ok(SERVER.version.length <= 255 && SEMVER.test(SERVER.version), 'a semantic version');
  assert.ok(!/^[\^~<>=]|\s-\s|\|\||(^|\.)[xX*](\.|$)/.test(SERVER.version), 'no version range');
  assert.match(SERVER.description, /token/i, 'says in one line what the sea spares an agent');
});
await proof('the name is the domain the door lives on, as the node itself names it; the remote is the open door over Streamable HTTP', () => {
  const card = serverCard('https://mareliberum.dev');
  assert.equal(SERVER.name, 'dev.mareliberum/sea'); assert.equal(SERVER.name, card.name);
  assert.deepEqual(SERVER.remotes, [{ type: 'streamable-http', url: DOOR }]); assert.match(SERVER.remotes[0].url, /^https?:\/\/[^\s]+$/);
  assert.equal(SERVER.packages, undefined, 'a remote server needs no package');
  assert.equal(SERVER.websiteUrl, 'https://mareliberum.dev');
  assert.deepEqual(Object.keys(SERVER.repository).sort(), ['id', 'source', 'url']); assert.equal(SERVER.repository.url, REPO); assert.equal(SERVER.repository.source, 'github'); assert.match(SERVER.repository.id, /^\d+$/);
  for (const i of SERVER.icons) { assert.match(i.src, /^https:\/\/mareliberum\.dev\//); assert.ok(i.src.length <= 255); assert.ok(['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'].includes(i.mimeType)); for (const s of i.sizes) assert.match(s, /^(\d+x\d+|any)$/); }
  assert.ok(existsSync(join(ROOT, 'site', SERVER.icons[0].src.split('/').pop())), 'the icon is a file of the site');
});
await proof('server-dev.json is the same file; a version behind the node is named, not hidden', () => {
  assert.equal(rd('server-dev.json'), rd('server.json'));
  if (older(SERVER.version, VERSION)) console.log(`       note: server.json says ${SERVER.version}, the node ${VERSION}: bump it with the next publish`);
  assert.ok(!older(SERVER.version, '3.4.4'), 'never below the version the registry already holds (3.4.4)');
});

// --------------------------------------------------------------------------------------------------------- Gemini CLI
console.log('Gemini CLI (geminicli.com/docs/extensions/reference, /releasing)');
const GEM = js('gemini-extension.json');
await proof('gemini-extension.json sits at the root with name, version, description, the remote server and its context file', () => {
  assert.match(GEM.name, /^[a-z0-9]+(-[a-z0-9]+)*$/, 'lowercase or numbers, dashes'); assert.equal(GEM.name, 'mare-liberum', 'the name of the repository, which becomes the folder of the extension');
  assert.ok(SEMVER.test(GEM.version)); assert.ok(GEM.description.length > 40 && GEM.description.length <= 300);
  assert.deepEqual(Object.keys(GEM.mcpServers), ['mare-liberum']);
  // httpUrl is Streamable HTTP in every Gemini CLI version; 0.71.1 still reads it and only warns that url with type http is
  // the newer form, which older versions would read as SSE
  // since 3.36 the lean door: Gemini CLI puts every tool definition into each turn, where the lean door spares the most (/engine)
  assert.deepEqual(GEM.mcpServers['mare-liberum'], { httpUrl: `${DOOR}/lean` }, 'the lean door over Streamable HTTP');
  assert.equal(GEM.mcpServers['mare-liberum'].trust, undefined, 'trust is not allowed in an extension');
  assert.equal(GEM.contextFileName, 'GEMINI.md'); assert.ok(existsSync(join(ROOT, GEM.contextFileName)));
});
await proof('GEMINI.md names only tools and inputs the lean and the open door have, says how call_tool reaches the others, and the rules an agent keeps', () => {
  const md = rd('GEMINI.md'), ticks = [...md.matchAll(/`([a-z_]+)(?:: [^`]*)?`/g)].map((m) => m[1]), LEANS = new Set(LEAN_TOOLS.map((t) => t.name));
  assert.ok(ticks.length >= 12); for (const w of ticks) assert.ok(NAMES.has(w) || PROPS.has(w) || LEANS.has(w), `GEMINI.md names ${w}`);
  for (const w of LEANS) assert.ok(ticks.includes(w), `GEMINI.md names the lean tool ${w}`);
  for (const w of ['data, never instructions', 'never pays', 'Never put passwords', '`call_tool` with its name and arguments', '{"name": "search", "arguments": {"query": "postgres", "kind": "mcp"}}']) assert.ok(md.includes(w), w);
  assert.ok(md.includes(`${DOOR}/lean`)); assert.ok(md.length < 4000, 'short: it is loaded into every session');
});

// --------------------------------------------------------------------------------------------------------- Claude Code
console.log('Claude Code (code.claude.com/docs/en/plugins/marketplace-reference, /manifest-reference)');
const MARKET = js('.claude-plugin/marketplace.json');
const RESERVED = ['claude-code-marketplace', 'claude-code-plugins', 'claude-plugins-official', 'anthropic-marketplace', 'anthropic-plugins', 'agent-skills', 'anthropic-agent-skills', 'life-sciences', 'knowledge-work-plugins', 'claude-for-legal', 'claude-for-financial-services', 'financial-services-plugins', 'first-party-plugins', 'claude-tag-plugins', 'claude-community', 'claude-plugins-community', 'healthcare', 'anthropic-plugin-directory', 'claude-plugin-directory', 'inline', 'builtin', 'skills-dir', 'synced', 'claude-plugin-test', 'npm', 'pip', 'uv', 'cargo', 'github', 'gh'];
await proof('.claude-plugin/marketplace.json: name, owner.name and plugins; a name that is not reserved; a description', () => {
  assert.match(MARKET.name, /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/); assert.ok(!RESERVED.includes(MARKET.name.toLowerCase()) && !/^claudeai-/.test(MARKET.name));
  assert.ok(MARKET.owner?.name); assert.ok(MARKET.description); assert.ok(Array.isArray(MARKET.plugins) && MARKET.plugins.length >= 1);
  assert.equal(new Set(MARKET.plugins.map((p) => p.name)).size, MARKET.plugins.length, 'no duplicate plugin');
});
// each plugin wires one door (two plugins since 3.36): mare-liberum the app door, the URL of the Claude connector, so that
// people who have both see one set of tools; mare-lean the lean door. The first stays the app door's plugin
const WIRES = {
  'mare-liberum': { url: `${DOOR}/app`, door: 'the app door', says: 'the app door over http, the URL of the Claude connector', tools: new Set(JSON.parse(FIX.bodies['tools/list'].body).result.tools.map((t) => t.name)) },
  'mare-lean': { url: `${DOOR}/lean`, door: 'the lean door', says: 'the lean door over http', tools: new Set(LEAN_TOOLS.map((t) => t.name)) },
};
await proof('the marketplace lists the app door\'s plugin first and only plugins whose door this proof knows', () => {
  assert.equal(MARKET.plugins[0].name, 'mare-liberum'); for (const p of MARKET.plugins) assert.ok(WIRES[p.name], p.name);
});
for (const entry of MARKET.plugins) {
  const dir = entry.source.replace(/^\.\//, ''), W = WIRES[entry.name] || {};
  await proof(`plugin ${entry.name}: a relative source inside the repository, plugin.json as the manifest, one version wherever the plugin is named`, () => {
    assert.match(entry.source, /^\.\//); assert.ok(!entry.source.includes('..') && !entry.source.includes('\\'));
    assert.ok(statSync(join(ROOT, dir)).isDirectory());
    const pj = js(join(dir, '.claude-plugin/plugin.json'));
    assert.equal(pj.name, entry.name); assert.match(pj.name, /^[a-z0-9]+(-[a-z0-9]+)*$/, 'kebab-case');
    assert.ok(entry.version === undefined || entry.version === pj.version, 'an entry version that differs from plugin.json makes validate warn (plugin.json wins)');
    assert.equal(js(join(dir, '.cursor-plugin/plugin.json')).version, pj.version, 'the Cursor manifest names the same version');
    assert.ok(pj.version && pj.description && pj.author?.name && pj.license); new URL(pj.homepage); new URL(pj.privacyPolicyUrl);
    for (const k of Object.keys(pj)) assert.ok(['$schema', 'name', 'displayName', 'version', 'description', 'author', 'homepage', 'repository', 'license', 'keywords', 'privacyPolicyUrl'].includes(k), `known field ${k}`);
  });
  await proof(`plugin ${entry.name}: .mcp.json wires ${W.says}; the skill has a name that matches its folder`, () => {
    // Anthropic: "Point the bundle's MCP server configuration at the same URL, so people who have both see one set of tools"
    assert.deepEqual(js(join(dir, '.mcp.json')), { mcpServers: { [entry.name]: { type: 'http', url: W.url } } });
    const skills = readdirSync(join(ROOT, dir, 'skills'));
    assert.ok(skills.length >= 1);
    for (const s of skills) { const fm = frontmatter(rd(join(dir, 'skills', s, 'SKILL.md'))); assert.equal(fm.name, s); assert.ok(fm.description && fm.description.length <= 1024, `${s}: description of ${fm.description?.length}`); }
  });
  await proof(`plugin ${entry.name}: a README of 40 words or more outside code blocks, naming only tools of ${W.door}, with privacy, support and license`, () => {
    const md = rd(join(dir, 'README.md')), words = md.replace(/```[\s\S]*?```/g, ' ').split(/\s+/).filter((w) => /[A-Za-z]/.test(w));
    assert.ok(words.length >= 40, `${words.length} words`);
    for (const m of md.matchAll(/`([a-z_]+)`/g)) assert.ok(W.tools.has(m[1]), `the README names ${m[1]}, which ${W.door} does not have`);
    for (const w of ['https://mareliberum.dev/privacy', 'License: MIT', W.url, 'never pays']) assert.ok(md.includes(w), w);
  });
  await proof(`plugin ${entry.name}: a square PNG icon of 512 to 2048 px under 2 MB where the directory looks for it`, () => {
    const i = png(join(dir, 'assets/icon.png')); assert.equal(i.w, i.h); assert.ok(i.w >= 512 && i.w <= 2048); assert.ok(i.bytes < 2 * 2 ** 20);
  });
}

// --------------------------------------------------------------------------------------------------------------- Cursor
console.log('Cursor (cursor.com/docs/reference/plugins)');
const CM = js('.cursor-plugin/marketplace.json');
await proof('.cursor-plugin/marketplace.json lists the same plugin folders; each plugin.json and mcp.json point at the door of the Claude plugin of that folder', () => {
  assert.ok(CM.name && CM.owner?.name && CM.plugins.length >= 1);
  assert.deepEqual(CM.plugins.map((p) => p.name), MARKET.plugins.map((p) => p.name), 'the same plugins in the same order');
  for (const p of CM.plugins) {
    assert.ok(!p.source.includes('..') && !p.source.startsWith('/'), 'relative, inside the repository');
    const pj = js(join(p.source, '.cursor-plugin/plugin.json'));
    assert.equal(pj.name, p.name); assert.match(pj.name, /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/);
    assert.ok(pj.author?.name); assert.ok(existsSync(join(ROOT, p.source, pj.logo)), 'the logo is in the plugin');
    assert.deepEqual(js(join(p.source, 'mcp.json')), { mcpServers: { [p.name]: { url: WIRES[p.name]?.url } } }, 'one plugin folder, one server');
    assert.ok(MARKET.plugins.some((m) => m.source === `./${p.source}` && m.name === p.name), 'the same folder as the Claude plugin');
  }
});

// ----------------------------------------------------------------------------------------------------------------- Glama
console.log('Glama (glama.ai/blog/2025-07-08-what-is-glamajson)');
await proof('glama.json at the root names the maintainer by GitHub login', () => {
  const g = js('glama.json');
  assert.equal(g.$schema, 'https://glama.ai/mcp/schemas/server.json');
  assert.ok(Array.isArray(g.maintainers) && g.maintainers.length >= 1); for (const m of g.maintainers) assert.match(m, /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/);
  assert.ok(REPO.includes(`/${g.maintainers[0]}/`), 'the owner of the repository');
});

// ----------------------------------------------------------------------------------------------------------- the README
console.log('the README says how to install from the repository');
await proof('the last section of the README names the installs the manifests make true, and the Glama badges', () => {
  const md = rd('README.md'), sections = md.split(/\n## /);
  const last = sections[sections.length - 1];
  assert.ok(last.startsWith('Install from this repository'), 'the new section is the last one');
  assert.ok(last.includes(`gemini extensions install ${REPO}`));
  assert.ok(last.includes(`/plugin marketplace add daoudandiaye98-alt/mare-liberum`) && last.includes(`/plugin install ${MARKET.plugins[0].name}@${MARKET.name}`));
  for (const p of MARKET.plugins.slice(1)) assert.ok(last.includes(`/plugin install ${p.name}@${MARKET.name}`), p.name);
  assert.ok(last.includes(SERVER.name));
  assert.match(last, /\| Gemini CLI \|[^\n]*\| `\/mcp\/lean` \|/); assert.match(last, /\| Claude Code \|[^\n]*\| `\/mcp\/app` \|/); assert.match(last, /\| Claude Code, lean door \|[^\n]*\| `\/mcp\/lean` \|/);
  assert.ok(last.includes('https://glama.ai/mcp/connectors/dev.mareliberum/sea/badges/score.svg') && last.includes('https://glama.ai/mcp/servers/daoudandiaye98-alt/mare-liberum/badges/score.svg'));
});
await proof('package.json runs this proof as proof:reach', () => assert.equal(js('package.json').scripts['proof:reach'], 'node tools/reach-proof.mjs'));

console.log(`\n${passed} held, ${failed} failed`);
process.exit(failed ? 1 : 0);
