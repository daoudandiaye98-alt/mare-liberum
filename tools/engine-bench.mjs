// Mare Liberum · the engine bench (dev time only, never on the server): the sea's real JSON answers, read from a local
// node, as indented JSON, as the JSON the door sends, as minified JSON and as TOON, each counted with real tokenizers
// (o200k_base, cl100k_base and the legacy Claude tokenizer); and the open MCP door's tools/list against a lean list of
// four tools. Every TOON answer is decoded again and compared with the JSON (lossless, or the run says not).
//   npm install --prefix ~/.cache/mare-proof js-tiktoken@1.0.21 @anthropic-ai/tokenizer@0.0.4 @toon-format/toon
//   node tools/engine-bench.mjs [--lakes <dir>] [--toon <toon.mjs>] [--deps <dir>] [--day YYYY-MM-DD] [--dry]
//   node tools/engine-bench.mjs --ratio     writes the <bench:engine> block of node/engine.mjs from the newest run
// The tokenizers and the TOON reference are no dependencies of the sea: the package.json of the repository never names
// them. TOON: the file named with --toon (the sea's own node/toon.mjs once it exists, exporting toToon and fromToon),
// else the reference implementation @toon-format/toon from the folder of the tokenizers; the run names which one.
// The local node runs in this process with an index of its own: the first rows of each lake in --lakes (default data/,
// the lakes the build reads), or an empty index if there are none. Nothing is written but proof/engine-<day>.json.
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync, readdirSync, openSync, readSync, closeSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const ROOT = new URL('..', import.meta.url);
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? d : process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true; };
const BASE = 'https://mareliberum.dev', UA = 'MareLiberum-session/1.0 (engine bench)';
// the toon lever sends TOON only when it is at least this much smaller than compact JSON (in tokens here, o200k_base and the others)
export const RULE = 0.2;
// the answers counted: [id, door, how to ask]. At least twelve of them must answer, or the run stops
export const FIXTURES = [
  ['search', '/search?q=weather+api'], ['search-mcp', '/search?q=github+mcp+server'], ['brain', '/brain?q=compare+prices+for+headphones'], ['brain-home', '/brain?format=json'],
  ['find', '/find.json?q=weather'], ['market', '/brain/market.json'], ['areas', '/brain/areas.json'], ['thinking', '/brain/thinking.json'], ['stats', '/stats'], ['savings', '/savings.json'],
  ['open', '/open.json'], ['offers', '/offers.json'], ['works', '/works.json'], ['routes', '/routes.json'], ['briefs', '/briefs.json'], ['fair', '/fair.json'], ['pricing', '/pricing.json'],
  ['connect', '/connect.json'], ['agents', '/agents?limit=25'], ['mcp-tools', 'POST /mcp tools/list'],
];
// the lean list as the lean door is to build it (brief 3.35, E1): read_page and think as the open door has them, find_tools
// and call_tool beside them. The integrator measures the real one again after the merge
export const LEAN_EXTRA = [
  { name: 'find_tools', description: 'Find tools of the open sea for a need: the best matches among all of its tools, each with its name, one line and input schema, ranked by BM25 over name, title and description.', inputSchema: { type: 'object', properties: { need: { type: 'string', description: 'what you want to do, in words' }, limit: { type: 'integer', minimum: 1, maximum: 8, description: 'how many tools, at most 8 (default 5)' } }, required: ['need'] } },
  { name: 'call_tool', description: 'Call any tool of the open sea by its name with its arguments; the answer is the same as from the open door /mcp.', inputSchema: { type: 'object', properties: { name: { type: 'string', description: 'the tool, as find_tools named it' }, arguments: { type: 'object', description: 'the arguments of that tool' } }, required: ['name'] } },
];

async function tokenizers(dir) {
  const req = createRequire(join(resolve(dir), 'package.json')), out = [];
  const ver = (name) => { try { return JSON.parse(readFileSync(join(resolve(dir), 'node_modules', name, 'package.json'), 'utf8')).version; } catch { return null; } };
  let jt; try { jt = await import(pathToFileURL(req.resolve('js-tiktoken')).href); } catch { return null; }
  for (const id of ['o200k_base', 'cl100k_base']) { const enc = jt.getEncoding(id); out.push({ id, package: `js-tiktoken@${ver('js-tiktoken')}`, count: (s) => enc.encode(s, [], []).length }); }
  try { const at = req('@anthropic-ai/tokenizer'), enc = at.getTokenizer(); out.push({ id: 'claude-legacy', package: `@anthropic-ai/tokenizer@${ver('@anthropic-ai/tokenizer')}`, count: (s) => enc.encode(String(s).normalize('NFKC'), 'all').length }); } catch {}
  return out;
}
async function toonOf(dir, file, label) {
  if (file && file !== true) { const m = await import(pathToFileURL(resolve(file)).href); if (typeof m.toToon !== 'function' || typeof m.fromToon !== 'function') throw new Error(`${file} exports no toToon/fromToon`); return { implementation: label && label !== true ? String(label) : `${file} (the sea's own encoder)`, spec: m.TOON?.spec ? `v${m.TOON.spec} (${m.TOON.url || 'https://github.com/toon-format/spec'})` : null, encode: (v) => m.toToon(v), decode: (t) => m.fromToon(t) }; }
  const req = createRequire(join(resolve(dir), 'package.json'));
  let m; try { m = await import(pathToFileURL(req.resolve('@toon-format/toon')).href); } catch { return null; }
  const ver = (() => { try { return JSON.parse(readFileSync(join(resolve(dir), 'node_modules/@toon-format/toon/package.json'), 'utf8')).version; } catch { return '?'; } })();
  const spec = (() => { try { return /badge\/spec-v([\d.]+)/.exec(readFileSync(join(resolve(dir), 'node_modules/@toon-format/toon/README.md'), 'utf8'))?.[1] || null; } catch { return null; } })();
  return { implementation: `@toon-format/toon@${ver} (the reference implementation, npm)`, spec: spec ? `v${spec} (https://github.com/toon-format/spec)` : null, encode: (v) => m.encode(v), decode: (t) => m.decode(t) };
}
// the first n lines of a file, without reading all of it
function headLines(file, n, max = 4 << 20) {
  const fd = openSync(file, 'r'), buf = Buffer.alloc(max), got = readSync(fd, buf, 0, max, 0); closeSync(fd);
  return buf.subarray(0, got).toString('utf8').split('\n').slice(0, n).filter((l) => l.trim().startsWith('{'));
}
async function localNode(lakes, perLake = 120) {
  const [{ handle }, { createMem, metaOf, hayOf }, { memoryKv }, { createLedger }, { payConfig }] = await Promise.all([import('../node/core.mjs'), import('../node/mem.mjs'), import('../node/flow.mjs'), import('../node/ledger.mjs'), import('../node/pay.mjs')]);
  const dir = mkdtempSync(join(tmpdir(), 'mare-engine-bench-')), file = join(dir, 'sea.tsv'), rows = [], from = [];
  if (lakes && existsSync(lakes)) for (const f of readdirSync(lakes).filter((x) => /\.ndjson$/.test(x)).sort()) {
    let n = 0; for (const l of headLines(join(lakes, f), perLake)) { try { const r = JSON.parse(l); if (r?.id) { rows.push(r); n++; } } catch {} } if (n) from.push(`${f}: ${n}`);
  }
  const seen = new Set(), uniq = rows.filter((r) => !seen.has(r.id) && seen.add(r.id));
  writeFileSync(file, uniq.map((r) => `${r.id}\t${metaOf(r)}\t${hayOf(r)}\t${JSON.stringify(r)}`).sort().join('\n') + (uniq.length ? '\n' : ''));
  writeFileSync(join(dir, 'build.json'), JSON.stringify({ builtAt: new Date().toISOString(), entries: uniq.length }));
  const db = createMem({ file, base: BASE }), SITE = { '/llms.txt': { body: readFileSync(new URL('site/llms.txt', ROOT), 'utf8'), type: 'text/plain; charset=utf-8' } };
  const cfg = { base: BASE, kv: memoryKv(), ledger: createLedger({}), pay: payConfig({}), site: SITE };
  let ip = 1;
  const call = async (path, init = {}) => { const res = await handle(new Request(BASE + path, { ...init, headers: { 'user-agent': UA, 'x-forwarded-for': `198.18.50.${(ip++ % 250) + 1}`, accept: 'application/json', ...(init.headers || {}) } }), db, cfg); return { status: res.status, type: res.headers.get('content-type') || '', text: await res.text() }; };
  return { call, entries: uniq.length, from, done: () => rmSync(dir, { recursive: true, force: true }) };
}
const B = (s) => Buffer.byteLength(s, 'utf8');
const r2 = (x) => Math.round(x * 100) / 100;
const median = (xs) => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null; };

async function main() {
  if (arg('ratio')) { const d = newest(); if (!d) throw new Error('no run in proof/ (engine-<day>.json)'); writeRatio(d); console.log(`written: ENGINE_RATIOS in node/engine.mjs from proof/${d.file}`); return; }
  const deps = arg('deps', process.env.MARE_PROOF_DEPS || join(homedir(), '.cache', 'mare-proof'));
  const tk = await tokenizers(deps); if (!tk?.length) { console.error(`js-tiktoken is not installed in ${deps}:\n  npm install --prefix ${deps} js-tiktoken@1.0.21 @anthropic-ai/tokenizer@0.0.4 @toon-format/toon`); process.exit(2); }
  const T = await toonOf(deps, arg('toon'), arg('toon-from')), REF = arg('toon') ? await toonOf(deps) : null; if (!T) { console.error(`no TOON encoder: install @toon-format/toon in ${deps} or name node/toon.mjs with --toon`); process.exit(2); }
  const lakes = arg('lakes', fileURLToPath(new URL('data', ROOT))), N = await localNode(lakes === true ? null : lakes);
  const { VERSION } = await import('../node/core.mjs');
  console.log(`engine bench · ${tk.map((t) => `${t.id} (${t.package})`).join(', ')} · TOON ${T.implementation} · local node ${VERSION}, ${N.entries} entries (${N.from.join(', ') || 'no lakes'})`);
  const count = (s) => Object.fromEntries(tk.map((t) => [t.id, t.count(s)]));
  const fixtures = [];
  for (const [id, door] of FIXTURES) {
    const r = door.startsWith('POST /mcp') ? await N.call('/mcp', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) }) : await N.call(door);
    if (r.status !== 200 || !/json/.test(r.type)) { console.log(`  skip ${id}: ${r.status} ${r.type}`); continue; }
    let v; try { v = JSON.parse(r.text); } catch { console.log(`  skip ${id}: not JSON`); continue; }
    const forms = { json: JSON.stringify(v, null, 2), sent: r.text.replace(/\n$/, ''), min: JSON.stringify(v), toon: T.encode(v) };
    let back = null; try { back = T.decode(forms.toon); } catch {}
    const tokens = Object.fromEntries(tk.map((t) => [t.id, Object.fromEntries(Object.entries(forms).map(([k, s]) => [k, t.count(s)]))]));
    let same; if (REF) { try { same = REF.encode(v) === forms.toon; } catch { same = false; } }
    fixtures.push({ id, door, bytes: Object.fromEntries(Object.entries(forms).map(([k, s]) => [k, B(s)])), tokens, roundTrip: isDeepStrictEqual(back, JSON.parse(forms.min)), ...(same == null ? {} : { sameAsReference: same }) });
    const o = tokens.o200k_base; console.log(`  ${id.padEnd(11)} ${door.padEnd(42)} json ${String(o.json).padStart(6)}  sent ${String(o.sent).padStart(6)}  min ${String(o.min).padStart(6)}  toon ${String(o.toon).padStart(6)}  ${(100 * (1 - o.toon / o.sent)).toFixed(1).padStart(5)} %  ${fixtures.at(-1).roundTrip ? 'round trip' : 'ROUND TRIP FAILED'}`);
  }
  // the open door's list against the lean list (read_page and think as the open door has them, find_tools, call_tool)
  const full = fixtures.find((f) => f.id === 'mcp-tools') ? JSON.parse((await N.call('/mcp', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) })).text).result : null;
  const leanTools = full ? [...full.tools.filter((t) => t.name === 'read_page' || t.name === 'think'), ...LEAN_EXTRA] : null;
  const fullText = full ? JSON.stringify(full) : null, leanText = leanTools ? JSON.stringify({ tools: leanTools }) : null;
  const mcp = full ? { full: { tools: full.tools.length, bytes: B(fullText), tokens: count(fullText) }, lean: { tools: leanTools.length, bytes: B(leanText), tokens: count(leanText), names: leanTools.map((t) => t.name) },
    how: 'tools/list of the open door /mcp as one JSON result, against read_page and think as the open door defines them plus find_tools and call_tool as tools/engine-bench.mjs writes them (LEAN_EXTRA); the lean door of the release is measured again after the merge' } : null;
  N.done();
  if (REF) console.log(`  TOON of ${T.implementation} equals the reference output for ${fixtures.filter((f) => f.sameAsReference).length} of ${fixtures.length} answers`);
  if (fixtures.length < 12) throw new Error(`only ${fixtures.length} answers answered as JSON; at least 12 are needed`);
  const sum = (t, k) => fixtures.reduce((s, f) => s + f.tokens[t][k], 0), bsum = (k) => fixtures.reduce((s, f) => s + f.bytes[k], 0);
  // best: TOON only where it is smaller than what the door sends, the rule of the lever (brief 3.35, E1)
  // rule: what the lever does (integrator, 25.11.2026): TOON only when it is at least RULE smaller than compact JSON, else what the door sends
  const best = (t) => fixtures.reduce((s, f) => s + Math.min(f.tokens[t].sent, f.tokens[t].toon), 0), smaller = (t) => fixtures.filter((f) => f.tokens[t].toon < f.tokens[t].sent).map((f) => f.id);
  const passes = (t, f) => f.tokens[t].toon <= (1 - RULE) * f.tokens[t].min, rule = (t) => fixtures.reduce((s, f) => s + (passes(t, f) ? f.tokens[t].toon : f.tokens[t].sent), 0);
  const totals = Object.fromEntries(tk.map((t) => [t.id, { json: sum(t.id, 'json'), sent: sum(t.id, 'sent'), min: sum(t.id, 'min'), toon: sum(t.id, 'toon'), best: best(t.id), toonSmallerIn: smaller(t.id), rule: rule(t.id), ruleIn: fixtures.filter((f) => passes(t.id, f)).map((f) => f.id) }]));
  const ratios = Object.fromEntries(tk.map((t) => [t.id, { json: r2(bsum('json') / sum(t.id, 'json')), sent: r2(bsum('sent') / sum(t.id, 'sent')), min: r2(bsum('min') / sum(t.id, 'min')), toon: r2(bsum('toon') / sum(t.id, 'toon')) }]));
  const medianSaving = Object.fromEntries(tk.map((t) => [t.id, r2(100 * median(fixtures.map((f) => 1 - f.tokens[t.id].toon / f.tokens[t.id].sent)))]));
  const o = totals.o200k_base, day = arg('day', new Date().toISOString().slice(0, 10));
  const pc = (a, b) => { const x = 100 * (1 - a / b); return `${Math.abs(x).toFixed(1)} % ${x >= 0 ? 'fewer' : 'more'}`; }, L = (x) => x.toLocaleString('en-US');
  const says = `On ${fixtures.length} real answers of a local node (o200k_base), TOON took ${L(o.toon)} tokens where the JSON the doors already send took ${L(o.sent)}: ${pc(o.toon, o.sent)}. TOON was smaller for ${o.toonSmallerIn.length} of the ${fixtures.length} answers (${o.toonSmallerIn.join(', ')}), and at least ${100 * RULE} % smaller than compact JSON, the rule of the lever, for ${o.ruleIn.length} (${o.ruleIn.join(', ') || 'none'}), the ones that hold tables; with that rule the answers take ${L(o.rule)} tokens instead of ${L(o.sent)} (${pc(o.rule, o.sent)}). Against indented JSON (${L(o.json)}) TOON is ${pc(o.toon, o.json)}, but the sea does not send indented JSON.${mcp ? ` The open MCP door's tools/list (${mcp.full.tools} tools) took ${mcp.full.tokens.o200k_base.toLocaleString('en-US')} tokens, a lean list of ${mcp.lean.tools} took ${mcp.lean.tokens.o200k_base.toLocaleString('en-US')}.` : ''}`;
  const reference = REF ? { implementation: REF.implementation, sameOutput: fixtures.filter((f) => f.sameAsReference).length, of: fixtures.length } : undefined;
  const d = { what: 'the engine bench: real JSON answers of a local node as indented JSON, as sent, minified and as TOON, counted with real tokenizers; the MCP list in full and lean', date: day, engine: 'engine-1',
    node: `a local node of Mare Liberum ${VERSION} (in process, ${N.entries} index entries from the first rows of the lakes)`, toon: { implementation: T.implementation, spec: T.spec, ...(reference ? { reference } : {}) },
    tokenizers: tk.map(({ id, package: p }) => ({ id, package: p })), method: 'Each answer is read from the local node as an agent would (Accept: application/json; the MCP list by POST /mcp). Forms: json = JSON.stringify(v, null, 2); sent = the body the door sent; min = JSON.stringify(v); toon = the TOON encoder named above. Bytes are UTF-8. A form\'s ratio is all its bytes over all its tokens. roundTrip: the TOON decoded again equals the JSON.',
    toonRule: { minSaving: RULE, against: 'compact JSON (min), per answer, in tokens of each tokenizer; otherwise what the door sends' }, summary: { totals, ratios, medianSavingVsSent: medianSaving }, mcp, says, fixtures };
  if (arg('dry')) { console.log(says); return; }
  const out = new URL(`proof/engine-${day}.json`, ROOT); writeFileSync(out, compact(d)); console.log(`${says}\nwritten: proof/engine-${day}.json`);
}
// one answer per line: small, and a change between two runs reads line by line
export function compact(d) { const { fixtures, ...rest } = d; return `${JSON.stringify(rest, null, 1).replace(/\n}$/, '')},\n "fixtures": [\n${fixtures.map((f) => `  ${JSON.stringify(f)}`).join(',\n')}\n ]\n}\n`; }
export function newest(dir = new URL('proof/', ROOT)) { try { const name = readdirSync(dir).filter((f) => /^engine-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().pop(); if (!name) return null; const d = JSON.parse(readFileSync(new URL(name, dir), 'utf8')); d.file = name; return d; } catch { return null; } }
// the ratios of the newest run, written into node/engine.mjs between its two marks (tools/engine-proof.mjs checks they match)
export function ratioBlock(d) {
  const r = d.summary.ratios.o200k_base;
  return `export const ENGINE_RATIOS = Object.freeze({ tokenizer: 'o200k_base', date: '${d.date}', source: '/engine/bench-${d.date}.json', answers: ${d.fixtures.length}, unit: 'UTF-8 bytes per token', json: ${r.sent}, toon: ${r.toon} });`;
}
export function writeRatio(d) {
  const file = new URL('node/engine.mjs', ROOT), src = readFileSync(file, 'utf8');
  const next = src.replace(/(\/\/ <bench:engine>[^\n]*\n)[\s\S]*?(\n\/\/ <\/bench:engine>)/, `$1${ratioBlock(d)}$2`);
  if (next === src && !src.includes('// <bench:engine>')) throw new Error('node/engine.mjs has no <bench:engine> marks');
  writeFileSync(file, next);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(e?.stack || e); process.exit(1); });
