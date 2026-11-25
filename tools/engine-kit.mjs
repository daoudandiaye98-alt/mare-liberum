// Mare Liberum · what the proofs of the engine's doors share (tools/toon-proof.mjs, tools/leanmcp-proof.mjs): a frozen
// clock, the release before the engine as a tree of its own (git archive, never a checkout: nothing in the repository
// changes) and nodes on an empty sea that answer through handle like serve.mjs, without the network or a database.
import { mkdtempSync, writeFileSync, readFileSync, existsSync, cpSync, symlinkSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

// 3.34.1, the release the engine is built on: what every default answer must still be, byte for byte
// since the integration of 3.35 the reference is this release itself, its engine switched off (OFF): so the proofs hold the
// engine to rule 15 (nothing changes unless an agent asks) while the other teams' changes of the release stay theirs.
// MARE_REF=cb5ca52 compares with 3.34.1 instead (the version string and the release's own changes then differ, as they must)
export const REF = process.env.MARE_REF || 'HEAD';
export const OFF = Object.freeze({ engine: 'off' });
export const AGAINST = REF === 'HEAD' ? 'this release with the engine off' : `${REF} (3.34.1)`;
export const RECEIPT_IDS = /\br\d{8}[a-z0-9]{8}\b/g;
// one key signs the /via/ addresses of every node of a proof (a test value, no secret): else each node draws its own and
// the same answer differs by its signatures
process.env.MARE_VIA_SECRET = 'engine-proof-via-key, a test value';

// one moment for every node of a proof: answers that say the time say the same time (call before importing a core)
export function freezeTime(iso = '2026-11-25T12:00:00.000Z') {
  const T0 = Date.parse(iso), D = globalThis.Date;
  class Frozen extends D { constructor(...a) { if (a.length) super(...a); else super(T0); } static now() { return T0; } }
  globalThis.Date = Frozen;
  return () => { globalThis.Date = D; };
}
// the tree of a release (MARE_REF_DIR when the caller has it already, e.g. a negative control in a copy that is no repository)
export function refTree(root, ref = REF) {
  if (process.env.MARE_REF_DIR && existsSync(join(process.env.MARE_REF_DIR, 'node/core.mjs'))) return process.env.MARE_REF_DIR;
  const dir = mkdtempSync(join(tmpdir(), 'mare-ref-'));
  const r = spawnSync('sh', ['-c', 'git -C "$1" archive "$2" node site proof config public package.json | tar -x -C "$3"', 'sh', root, ref, dir], { encoding: 'utf8' });
  return r.status === 0 && existsSync(join(dir, 'node/core.mjs')) ? dir : null;
}
// a copy of this tree with one rule broken (a negative control): the folders the node reads are linked, the rest copied
export function brokenCopy(root, file, from, to) {
  const dir = mkdtempSync(join(tmpdir(), 'mare-ctl-'));
  for (const d of ['node', 'tools']) cpSync(join(root, d), join(dir, d), { recursive: true });
  for (const d of ['site', 'proof', 'config', 'public']) if (existsSync(join(root, d))) symlinkSync(join(root, d), join(dir, d));
  cpSync(join(root, 'package.json'), join(dir, 'package.json'));
  const p = join(dir, file), src = readFileSync(p, 'utf8');
  if (!src.includes(from)) throw new Error(`control: ${file} no longer holds the line it breaks: ${from.slice(0, 60)}`);
  writeFileSync(p, src.replace(from, to));
  return dir;
}
export const runIn = (dir, script, env = {}) => spawnSync(process.execPath, [join(dir, script), '--no-controls'], { cwd: dir, encoding: 'utf8', env: { ...process.env, ...env }, timeout: 300_000 });
export const drop = (dir) => { try { rmSync(dir, { recursive: true, force: true }); } catch {} };

// a node of the tree at rootDir on an empty sea; call() answers like serve.mjs (HEAD is GET with cfg.head)
export async function nodeOf(rootDir, { base = 'https://mare.test', site, cfg: extra = {} } = {}) {
  const core = await import(pathToFileURL(join(rootDir, 'node/core.mjs')).href);
  const { createMem } = await import(pathToFileURL(join(rootDir, 'node/mem.mjs')).href);
  const { memoryKv } = await import(pathToFileURL(join(rootDir, 'node/flow.mjs')).href);
  const { immune } = await import(pathToFileURL(join(rootDir, 'node/immune.mjs')).href);
  const dir = mkdtempSync(join(tmpdir(), 'mare-node-')), file = join(dir, 'sea.tsv');
  process.once('exit', () => drop(dir)); // the empty sea of the proof goes with it
  mkdirSync(dir, { recursive: true }); writeFileSync(file, ''); writeFileSync(join(dir, 'build.json'), JSON.stringify({ builtAt: '2026-11-20T10:00:00.000Z', entries: 0, lakes: {} }));
  const db = createMem({ file, base }), cfg = { base, kv: memoryKv(), site, waitUntil: () => {}, ...extra };
  let n = 0;
  const call = async (path, { method = 'GET', accept = 'application/json', ua = 'proof-agent/1.0', ip, body, headers = {}, cfg: c = {}, head = false } = {}) => {
    n++;
    const h = { accept, 'user-agent': ua, 'x-forwarded-for': ip || `198.18.${(n >> 8) & 255}.${n & 255}`, ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers };
    const res = await core.handle(new Request(base + path, { method, headers: h, ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}) }), db, { ...cfg, ...c, ...(head ? { head: true } : {}) });
    return { status: res.status, headers: res.headers, text: await res.text() };
  };
  const rpc = (door, method, params, o = {}) => call(door, { method: 'POST', accept: 'application/json, text/event-stream', body: { jsonrpc: '2.0', id: 1, method, ...(params ? { params } : {}) }, ...o });
  return { core, db, cfg, call, rpc, immune, rootDir };
}
// every header of an answer, in order of name (what "the same answer" compares beside the body)
export const headersOf = (h) => Object.fromEntries([...h.entries()].sort(([a], [b]) => (a < b ? -1 : 1)));
// objects compared as JSON compares them (members in any order; TOON's tables put fields in the header's order)
export const canon = (v) => (Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);
export const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
