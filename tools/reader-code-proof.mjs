// Mare Liberum · proof that code keeps its lines through the reader (the fix of 26.11.2026: node/reader.mjs toMarkdown,
// node/lean.mjs list items). The reader made every line tidy, the lines of code too: Python and YAML lost their indentation
// and a Makefile its tab in every .md twin of the sea, in /r/<page>?format=full and in Firecrawl's onlyMainContent: false;
// the lean reader kept code, but set the fence of a code block in a list item at the margin and left its lines two spaces in
// per level. It proves, on nodes in this process with a stubbed web (no network, no live site):
//   a page whose code blocks hold Python (blank lines, nested blocks), YAML (nested lists), a Makefile (a tab) and a block
//   whose first line is indented keeps every line's leading whitespace, exactly, in /r/ (lean and format=full), in
//   POST /v2/scrape (markdown, and onlyMainContent: false), in Jina's layout and in the .md twins of the sea's own pages
//   (/engine.md holds the Python of the OpenAI Agents SDK and LangChain word for word); code in a list item and in a nested
//   one nests as CommonMark reads it: the fence and every line of code go in by the item's indentation, and taking exactly
//   the fence's indentation off gives the code back byte for byte; fenced blocks written in a page's text (``` with an info
//   string, ~~~, an indented fence) stay text, exactly as before (verify-3.40 B1: a "~~~" scene break around a <pre> no
//   longer holds the <pre> aside and loses it); no answer of any shape ever carries a NUL, also where a list holding code
//   stands in a quote, a definition, a stray item, a link or a heading, and where the page itself holds NULs (B2); code in
//   an ordered list nested in an ordered list (and every mix, items numbered 10 and up) sits in its own item (B3);
//   pages written to make the reader slow (2 MB of fences that never close, of falling length, of closing pairs) are read
//   in a child process in well under the bar, as text exactly as before;
//   everything outside code is byte for byte what the reference tree writes (default fbf500e, 3.39.0): every page of the
//   sea (its HTML as this node serves it) and every page of the proof through toMarkdown (with and without menus),
//   leanMarkdown and the .md twin; a page without code through /r/, /v2/scrape and Jina's layout as the reference node
//   answers; and where a page holds code, only whitespace inside its code blocks differs.
// The ledger counts the Markdown an agent gets: a code block that keeps its indentation is a little longer, and is counted
// as it is (node/areas.mjs is not touched).
// Runs without the network: node tools/reader-code-proof.mjs   (exit code 1 when a proof fails or a control is not caught)
//   --no-controls            only the proofs (the controls run this file that way in each broken copy)
//   MARE_CODE_REF=<ref>       the tree everything outside code must equal (default fbf500e: origin/main, 3.39.0)
//   MARE_CODE_REF_DIR=<dir>   that tree already extracted (the controls hand it on; no git in their copies)
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, cpSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { Buffer } from 'node:buffer';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTROLS = !process.argv.includes('--no-controls');
for (const k of ['MARE_TOLL', 'MARE_ENGINE', 'MARE_FAIR', 'MARE_X402_FACILITATOR', 'MARE_PAY_TO', 'MARE_STATE', 'MARE_DB_URL', 'MARE_DB_KEY', 'MARE_DB_SECRET', 'MARE_BASE_RPC']) delete process.env[k];
process.env.MARE_VIA_SECRET = 'reader-code-proof-via-key, a test value';
let passed = 0, failed = 0;
const proof = async (name, fn) => { T0 += 60_000; try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 6).join('\n       ')}`); } };
// one clock for both nodes: the lines an answer dates are the same on both
const D = globalThis.Date; let T0 = D.parse('2026-11-26T02:00:00.000Z');
class Clock extends D { constructor(...a) { if (a.length) super(...a); else super(T0); } static now() { return T0; } }
globalThis.Date = Clock;

// ------------------------------------------------------------------ the code, as its authors wrote it
const PY = `import os


def tide(level: int) -> str:
    """Name the tide."""
    if level > 3:
        return "high"
    elif level < -3:
        return "low"

    return "mid"


class Harbour:
    def __init__(self, name):
        self.name = name
        self.ships = [
            "Ebb",
            "Flow",
        ]`;
const YAML = `harbour:
  name: Mare
  berths:
    - id: 1
      depth: 12
    - id: 2
      depth: 9`;
const MAKE = 'deploy: build\n\t./bot --deploy\n\t@echo "deployed"';
const SNIP = '    def stern(self):\n        return self.ships[-1]';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const WORDS = 'The harbour bot reads the tide, names the berths and tells every ship where to go. These files make it run, and each block below is meant to be copied as it stands, every space in front of every line kept.';
const P = 'https://code.reader-proof.dev';
const DEPLOY = `<!doctype html><html lang="en"><head><title>Deploying the harbour bot</title><meta name="description" content="Three files make the bot run."></head><body><nav><a href="/">Home</a> <a href="/a">A</a> <a href="/b">B</a></nav><main>
<h1>Deploying the harbour bot</h1>
<p>${WORDS}</p>
<h2>The module</h2>
<pre><code class="language-python">${esc(PY)}
</code></pre>
<h2>The config</h2>
<pre>${esc(YAML)}
</pre>
<h2>The Makefile</h2>
<pre>${esc(MAKE)}</pre>
<h2>A method of the class</h2>
<pre>${esc(SNIP)}</pre>
<p>That is all there is to it: three files, one command, and the bot is in the water.</p></main></body></html>`;
const STEPS = `<!doctype html><html lang="en"><head><title>Steps</title></head><body><main><h1>Steps</h1><p>${WORDS}</p>
<ol><li><p>Write the config:</p><pre>${esc(YAML)}</pre></li><li>Then the module:<pre><code class="language-python">${esc(PY)}</code></pre><ul><li>and a nested step, the Makefile:<pre>${esc(MAKE)}</pre></li></ul></li><li>Run it.</li></ol></main></body></html>`;
// fenced blocks written in a page's own text (a page that shows Markdown as it is)
const FENCES = `<!doctype html><html lang="en"><head><title>Fences</title></head><body><main><h1>Fences</h1><p>${WORDS}</p>
<div>\`\`\`python
def f(x):
    return  x  *  2
\`\`\`</div>
<div>~~~
deploy: build
\t./bot   --deploy
~~~</div>
<div>
    \`\`\`sh
      ./run --fast
    \`\`\`
</div>
<div>\`\`\`
this fence   never closes,
    so these lines   stay as they were</div></main></body></html>`;
// a page without code: double spaces, no-break spaces, lists, a table, links, a menu, a quote
const PLAIN = `<!doctype html><html lang="en"><head><title>Harbour notes</title><meta name="description" content="Notes."></head><body><nav><a href="/">Home</a> <a href="/x">X</a> <a href="/y">Y</a> <a href="/z">Z</a></nav><main>
<h1>Harbour   notes</h1><p>${WORDS}  Two  spaces&nbsp;and&#160;more,   here.</p>
<ul><li>  first   item </li><li><a href="/one">one</a></li><li><a href="/two">two</a></li><li><a href="/three">three</a></li></ul>
<table><tr><th>Berth</th><th>Depth</th></tr><tr><td> one </td><td>12 m</td></tr></table>
<blockquote>  a quote   with   spaces </blockquote><p><code>inline   code</code> stays inline.</p>
<p>A line<br>    broken   in two.</p></main><footer>Imprint</footer></body></html>`;
const PAGES = new Map([[`${P}/deploy`, DEPLOY], [`${P}/steps`, STEPS], [`${P}/fences`, FENCES], [`${P}/plain`, PLAIN]]);
const realFetch = globalThis.fetch;
globalThis.fetch = async (u, o = {}) => {
  const s = String(u?.url ?? u);
  if (/^http:\/\/127\.0\.0\.1:\d+\//.test(s)) return realFetch(u, o);
  if (new URL(s).pathname === '/robots.txt') return new Response('User-agent: *\nAllow: /\n', { status: 200, headers: { 'content-type': 'text/plain' } });
  if (PAGES.has(s)) return new Response(PAGES.get(s), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
  throw new Error(`the proof does not use the network: ${s.slice(0, 80)}`);
};
createRequire(import.meta.url)('node:dns').promises.lookup = async () => [{ address: '93.184.216.34', family: 4 }];
for (const k of ['log', 'error', 'warn', 'info']) { const f = console[k].bind(console); console[k] = (...a) => { if (k === 'log' && !/^mare_/.test(String(a[0]))) f(...a); }; }

// ------------------------------------------------------------------ the nodes: this tree and the reference
const BASE = 'https://mare.test', SITE = { '/llms.txt': { body: readFileSync(join(ROOT, 'site/llms.txt'), 'utf8'), type: 'text/plain; charset=utf-8' } };
const imp = (dir, f) => import(pathToFileURL(join(dir, 'node', f)).href);
async function nodeOf(rootDir) {
  const core = await imp(rootDir, 'core.mjs'), { createMem } = await imp(rootDir, 'mem.mjs'), { memoryKv } = await imp(rootDir, 'flow.mjs');
  const { immune } = await imp(rootDir, 'immune.mjs'), { createLedger } = await imp(rootDir, 'ledger.mjs'), { payConfig } = await imp(rootDir, 'pay.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'mare-code-')), file = join(dir, 'sea.tsv');
  process.once('exit', () => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });
  writeFileSync(file, ''); writeFileSync(join(dir, 'build.json'), JSON.stringify({ builtAt: '2026-11-20T10:00:00.000Z', entries: 0, lakes: {} }));
  const db = createMem({ file, base: BASE }), cfg = { base: BASE, kv: memoryKv(), ledger: createLedger({}), pay: payConfig({}), site: SITE, waitUntil: () => {} };
  const call = async (path, { method = 'GET', accept = 'text/markdown, text/plain;q=0.9, */*;q=0.5', ua = 'reader-code-proof/1.0', ip = '198.51.100.9', headers = {}, body } = {}) => {
    const h = { accept, 'user-agent': ua, 'x-forwarded-for': ip, ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers };
    const res = await core.handle(new Request(BASE + path, { method, headers: h, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }), db, cfg);
    const text = res.body ? Buffer.from(await res.arrayBuffer()).toString('utf8') : ''; let j = null; try { j = JSON.parse(text); } catch {}
    return { status: res.status, h: Object.fromEntries(res.headers), text, j };
  };
  await call('/stats', { ua: 'MareLiberum-session/1.0', ip: '127.0.0.1' });
  immune.set({ mode: 'normal', rest: [], pace: { perMinute: 1_000_000, burst: 1_000_000 } });
  return { call, core, reader: await imp(rootDir, 'reader.mjs'), lean: await imp(rootDir, 'lean.mjs'), agentmd: await imp(rootDir, 'agentmd.mjs'), engineUi: await imp(rootDir, 'engine-ui.mjs') };
}
const REF = process.env.MARE_CODE_REF || 'fbf500e';
const refDir = (() => {
  const given = process.env.MARE_CODE_REF_DIR; if (given && existsSync(join(given, 'node/core.mjs'))) return given;
  const dir = mkdtempSync(join(tmpdir(), 'mare-code-ref-'));
  const r = spawnSync('sh', ['-c', 'git -C "$1" archive "$2" | tar -x -C "$3"', 'sh', ROOT, REF, dir], { encoding: 'utf8' });
  return r.status === 0 && existsSync(join(dir, 'node/core.mjs')) ? dir : null;
})();
const node = await nodeOf(ROOT), ref = refDir ? await nodeOf(refDir) : null;
const VERSIONS = [node.core.VERSION, ref?.core.VERSION].filter(Boolean);
const steady = (s) => { let t = String(s).replace(/\br\d{8}[a-z0-9]{8}\b/g, 'r<id>'); for (const v of VERSIONS) t = t.split(v).join('<version>'); return t; };
let net = 0; const fresh = () => `198.51.100.${++net}`;

// ------------------------------------------------------------------ code blocks in Markdown
// the fenced blocks of a Markdown text: a fence (``` or ~~~, an info string or none, at any indentation) to the next of its
// sign; ind: the fence's indentation (a block in a list item goes in with its item)
const FENCE = /^([ \t]*)(`{3,}|~{3,})(.*)$/;
function split(md) {
  const parts = [], lines = String(md).split('\n'); let text = [];
  for (let i = 0; i < lines.length; i++) {
    const o = FENCE.exec(lines[i]);
    if (o) { let j = i + 1; for (; j < lines.length; j++) if (new RegExp(`^[ \\t]*${o[2][0] === '`' ? '`' : '~'}{${o[2].length},}\\s*$`).test(lines[j])) break;
      if (j < lines.length) { parts.push({ text: text.join('\n') }); text = []; parts.push({ fence: lines[i].trim(), ind: o[1], code: lines.slice(i + 1, j).join('\n') }); i = j; continue; } }
    text.push(lines[i]);
  }
  parts.push({ text: text.join('\n') });
  return parts;
}
// CommonMark's rule for a block in a list item: every line of code carries at least the fence's indentation, and taking
// exactly that off gives the code (blank lines inside a list item's code go, as before): the indentations of the blocks
// that hold the code so, or none
const nestedAs = (md, code) => split(md).filter((p) => 'code' in p && p.code.split('\n').every((l) => !l.trim() || l.startsWith(p.ind)) && nonBlank(p.code.split('\n').map((l) => l.slice(p.ind.length)).join('\n')) === nonBlank(code)).map((p) => p.ind);
const nestedIn = (md, code) => {
  const L = md.split('\n'); const want = nonBlank(code).split('\n');
  for (let i = 0; i < L.length; i++) {
    const o = /^( *)(`{3,})/.exec(L[i]); if (!o) continue; const ind = o[1].length; let j = i + 1; while (j < L.length && !new RegExp(`^ {0,${ind + 3}}\`{3,}\\s*$`).test(L[j])) j++;
    const body = L.slice(i + 1, j); if (!body.every((l) => !l.trim() || l.startsWith(' '.repeat(ind)))) continue;
    if (body.map((l) => l.slice(ind)).filter((l) => l.trim()).join('\n') !== want.join('\n')) continue;
    let k = i - 1; while (k >= 0 && !(/^( *)([-*]|\d+[.)]) /.test(L[k]) && /^( *)/.exec(L[k])[1].length < ind)) k--;
    if (k < 0) return { ok: false, why: 'no list item above the block' };
    const m = /^( *)([-*]|\d+[.)]) /.exec(L[k]), col = m[1].length + m[2].length + 1;
    return { ok: ind >= col && ind <= col + 3, item: L[k].trim(), ind, col };
  }
  return { ok: false, why: 'no block holds the code' };
};
const blocks = (md) => split(md).filter((p) => 'code' in p).map((p) => p.code);
const nonBlank = (s) => s.split('\n').filter((l) => l.trim()).join('\n');
// exactly the code (where code keeps its blank lines too), or its lines exactly with blank lines as the lean reader sets them
const hasExact = (md, code, what) => assert.ok(blocks(md).includes(code), `${what}: no block holds the code exactly:\n${code.split('\n')[0]} …\nblocks: ${JSON.stringify(blocks(md)).slice(0, 400)}`);
const hasLines = (md, code, what) => assert.ok(blocks(md).some((b) => nonBlank(b) === nonBlank(code)), `${what}: no block holds the lines of the code exactly:\n${code.split('\n')[0]} …\nblocks: ${JSON.stringify(blocks(md)).slice(0, 400)}`);
// what the reference made of a code block: every line run together and trimmed, a blank line before a "- " line gone, blank
// lines at most one, none at the ends (the passes toMarkdown made over every line)
const asBefore = (code) => code.split('\n').map((l) => l.replace(/[ \t\u00a0]+/g, ' ').trim()).join('\n').replace(/\n(- )?\n(?=- )/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '');
// only whitespace inside code blocks differs: the same parts, every text part equal, every code block equal as before
function onlyCodeDiffers(now, before, what) {
  const a = split(now), b = split(before);
  assert.equal(a.length, b.length, `${what}: ${a.length} parts against ${b.length}`);
  a.forEach((p, i) => { if ('code' in p) { assert.ok('code' in b[i], `${what}: part ${i} is code here only`); assert.equal(p.fence, b[i].fence, `${what}: fence ${i}`); assert.equal(asBefore(p.code), asBefore(b[i].code), `${what}: block ${i} differs beyond whitespace`); } else assert.equal(p.text, b[i].text, `${what}: the text around code, part ${i}`); });
}

console.log('code keeps its lines: the reader, the scrape doors, Jina\'s layout, the twins');
await proof(`the reference tree is there (${REF})`, () => { assert.ok(ref, 'git archive of the reference failed: set MARE_CODE_REF_DIR'); });
await proof('toMarkdown (the twins, format=full, onlyMainContent: false) keeps Python, YAML, the Makefile\'s tab and an indented first line exactly, blank lines and all', () => {
  for (const menus of [true, false]) { const md = node.reader.toMarkdown(DEPLOY, `${P}/deploy`, { menus }); for (const c of [PY, YAML, MAKE, SNIP]) hasExact(md, c, `toMarkdown menus=${menus}`); assert.ok(md.includes('\n\t./bot --deploy\n'), 'the tab is a tab'); }
});
await proof('the lean reader keeps code exactly; in a list item and a nested one the block nests as CommonMark reads it (fence and code in by the item, the fence\'s indentation off gives the code back; blank lines inside code as before)', () => {
  const d = node.lean.leanMarkdown(DEPLOY, `${P}/deploy`).md; for (const c of [YAML, MAKE, SNIP]) hasExact(d, c, 'lean'); hasLines(d, PY, 'lean');
  const s = node.lean.leanMarkdown(STEPS, `${P}/steps`).md;
  assert.deepEqual(nestedAs(s, YAML), ['   '], 'the config in the first item of an ordered list: fence and code three spaces in ("1. ")'); assert.deepEqual(nestedAs(s, PY), ['   '], 'the module in the second item');
  assert.deepEqual(nestedAs(s, MAKE), ['    '], 'the Makefile in the nested "- " item under "2. ": four spaces in (its marker at 2, content at 4), its tab kept');
  assert.ok(s.includes('\n1. Write the config:\n   ```\n   harbour:\n     name: Mare\n'), 'the item and its code'); assert.ok(s.includes('\n  - and a nested step, the Makefile:\n    ```\n    deploy: build\n    \t./bot --deploy\n'), 'the nested item and its code');
  for (const c of [YAML, PY, MAKE]) assert.ok(nestedIn(s, c).ok, `CommonMark: ${c.split('\n')[0]} in its item ${JSON.stringify(nestedIn(s, c))}`);
});
await proof('/r/<page>: the lean answer and format=full keep the code; the Makefile\'s recipe begins with a tab', async () => {
  const ip = fresh(), r = await node.call(`/r/${P}/deploy`, { ip }), f = await node.call(`/r/${P}/deploy?format=full`, { ip });
  assert.equal(r.status, 200); assert.equal(f.status, 200);
  for (const c of [YAML, MAKE, SNIP]) hasExact(r.text, c, '/r/'); hasLines(r.text, PY, '/r/');
  for (const c of [PY, YAML, MAKE, SNIP]) hasExact(f.text, c, '/r/ format=full');
  const steps = await node.call(`/r/${P}/steps`, { ip }); for (const [c, ind] of [[YAML, '   '], [PY, '   '], [MAKE, '    ']]) assert.deepEqual(nestedAs(steps.text, c), [ind], `/r/ list items: ${c.split('\n')[0]}`);
  assert.ok(r.text.includes('\n\t./bot --deploy\n') && f.text.includes('\n\t./bot --deploy\n'));
});
await proof('POST /v2/scrape and /v1/scrape: data.markdown keeps the code, with onlyMainContent: false exactly', async () => {
  const ip = fresh();
  for (const v of [1, 2]) {
    const r = await node.call(`/v${v}/scrape`, { method: 'POST', accept: 'application/json', ip, body: { url: `${P}/deploy`, formats: ['markdown'] } }); assert.equal(r.status, 200); assert.equal(r.j.success, true);
    for (const c of [YAML, MAKE, SNIP]) hasExact(r.j.data.markdown, c, `/v${v}/scrape`); hasLines(r.j.data.markdown, PY, `/v${v}/scrape`);
    const full = await node.call(`/v${v}/scrape`, { method: 'POST', accept: 'application/json', ip, body: { url: `${P}/deploy`, formats: ['markdown'], onlyMainContent: false } });
    for (const c of [PY, YAML, MAKE, SNIP]) hasExact(full.j.data.markdown, c, `/v${v}/scrape onlyMainContent: false`);
  }
});
await proof('Jina\'s layout (X-Return-Format: markdown, and its JSON) carries the code as the reader wrote it', async () => {
  const ip = fresh(), t = await node.call(`/r/${P}/deploy`, { ip, headers: { 'x-return-format': 'markdown', 'x-no-cache': 'true' } });
  assert.equal(t.status, 200); assert.match(t.text, /^Title: Deploying the harbour bot\n\nURL Source: /); for (const c of [YAML, MAKE, SNIP]) hasExact(t.text, c, 'Jina'); hasLines(t.text, PY, 'Jina');
  const j = await node.call(`/r/${P}/deploy`, { ip, accept: 'application/json', headers: { 'x-return-format': 'markdown' } }); for (const c of [YAML, MAKE, SNIP]) hasExact(j.j.data.content, c, 'Jina JSON');
});
await proof('the .md twins of the sea\'s own pages: /engine.md holds the Python of the OpenAI Agents SDK and of LangChain word for word, /web-to-markdown.md its lines of code', async () => {
  const plug = node.engineUi.plugIn(BASE), lines = plug.clients.filter((c) => ['openai-agents', 'langchain', 'vercel-ai'].includes(c.id)).flatMap((c) => c.lines.map((l) => l.text));
  assert.ok(lines.length >= 4 && lines.some((t) => /\n {8}agent = /.test(t)), 'the snippets hold indented lines');
  for (const [p, accept] of [['/engine.md', '*/*'], ['/engine', 'text/markdown']]) { const r = await node.call(p, { accept, ip: fresh() }); assert.equal(r.status, 200, p); for (const t of lines) hasExact(r.text, t, p); }
  const w = await node.call('/web-to-markdown.md', { accept: '*/*', ip: fresh() }); assert.ok(blocks(w.text).some((b) => b.includes('import requests\nmd = requests.get(')), '/web-to-markdown.md');
});
await proof('fences written in a page\'s own text stay text, byte for byte as fbf500e; a "~~~" or "```" scene break around a <pre> keeps the <pre>, exactly, and leaves no mark (B1)', () => {
  for (const menus of [true, false]) assert.equal(node.reader.toMarkdown(FENCES, `${P}/fences`, { menus }), ref.reader.toMarkdown(FENCES, `${P}/fences`, { menus }), `menus=${menus}`);
  for (const sep of ['~~~', '```', '~~~~']) {
    const html = `<html><body><main><h1>A story</h1><p>${WORDS}</p><p>${sep}</p><p>Part one of the story.</p><pre>code here\n  indented</pre><p>${sep}</p><p>Part two</p></main></body></html>`;
    for (const menus of [true, false]) {
      const md = node.reader.toMarkdown(html, `${P}/story`, { menus }); assert.ok(!md.includes('\u0000'), `${sep}: no mark`); assert.ok(!/(^|\n)c\d+(\n|$)/.test(md), `${sep}: no mark's number`);
      // (a "```" scene break pairs with the <pre>'s own fence when Markdown is read: compared as text, with only the <pre>'s code apart)
      assert.ok(md.includes('```\ncode here\n  indented\n```'), `${sep} menus=${menus}: the <pre> exactly`); assert.equal(md.replace('code here\n  indented', 'code here\nindented'), ref.reader.toMarkdown(html, `${P}/story`, { menus }), `${sep} menus=${menus}: everything but the <pre>'s code as before`);
    }
  }
});

// B2: a list holding code wherever a list can stand, and a page holding NULs of its own
const LISTCODE = '<ul><li>Step with code<pre><code class="language-python">def f():\n    return 1</code></pre></li><li>Next step</li></ul>';
const WRAPPED = { blockquote: `<blockquote>${LISTCODE}</blockquote>`, dd: `<dl><dt>Term</dt><dd>${LISTCODE}</dd></dl>`, 'stray li': `<div><li>Stray item${LISTCODE}</li></div>`, a: `<a href="/x">${LISTCODE}</a>`, h2: `<h2>${LISTCODE}</h2>`, td: `<table><tr><td>Cell</td><td>${LISTCODE}</td></tr><tr><td>a</td><td>b</td></tr></table>`,
  'NULs in the page': '<p>\u0000```</p><p>text \u0000between\u0000</p><p>\u0000```</p><ul><li>x<pre>\u0000a\n  b</pre></li></ul>' };
for (const [k, inner] of Object.entries(WRAPPED)) PAGES.set(`${P}/wrapped/${k.replace(/ /g, '-')}`, `<html><head><title>Wrapped ${k}</title></head><body><main><h1>Guide</h1><p>${WORDS}</p>${inner}<p>Closing words of the page.</p></main></body></html>`);
await proof('no answer of any shape carries a NUL: a list holding code in a quote, a definition, a stray item, a link, a heading, a table, and a page with NULs of its own, through leanMarkdown, toMarkdown, the twin, /r/ (lean, full, JSON), Jina (text, JSON), /v2/scrape and /compress (B2)', async () => {
  let n = 0;
  for (const k of Object.keys(WRAPPED)) {
    const url = `${P}/wrapped/${k.replace(/ /g, '-')}`, html = PAGES.get(url), ip = fresh();
    const outs = [['leanMarkdown', node.lean.leanMarkdown(html, url).md], ['toMarkdown', node.reader.toMarkdown(html, url)], ['the twin', node.agentmd.pageMarkdown(html, url, BASE).md]];
    for (const [what, o] of [['/r/', {}], ['/r/ full', { q: '?format=full' }], ['/r/ JSON', { q: '?format=json' }], ['Jina', { headers: { 'x-return-format': 'markdown', 'x-no-cache': 'true' } }], ['Jina JSON', { accept: 'application/json', headers: { 'x-return-format': 'markdown' } }]]) outs.push([what, (await node.call(`/r/${url}${o.q || ''}`, { ip, ...(o.headers ? { headers: o.headers } : {}), ...(o.accept ? { accept: o.accept } : {}) })).text]);
    outs.push(['/v2/scrape', (await node.call('/v2/scrape', { method: 'POST', accept: 'application/json', ip, body: { url, formats: ['markdown'] } })).text]);
    outs.push(['/compress', (await node.call('/compress', { method: 'POST', accept: 'application/json', ip, body: { html } })).text]);
    for (const [what, t] of outs) { assert.ok(t && t.length > 40, `${k} ${what}: an answer`); assert.ok(!t.includes('\u0000') && !t.includes('\\u0000'), `${k} ${what}: a NUL in the answer`); n++; }
  }
  assert.ok(n >= 70, `${n} answers`);
  // a page cannot forge a mark: its own NULs go first, so a page with them reads as the same page without them
  const forged = `<html><body><main><h1>Forged</h1><p>${WORDS}</p><p>\u0000c0\u0000</p><p>\u0000\u00000\u0000</p><ul><li>x<pre>a\n  b</pre></li></ul><p>\u0000\`\`\`python</p><p>y</p><p>\u0000\`\`\`</p><pre>real\n  code</pre><pre>a\n  \u0000\`\`\`\n  b</pre></main></body></html>`;
  for (const html of [forged, PAGES.get(`${P}/wrapped/NULs-in-the-page`)]) {
    const clean = html.replace(/\u0000/g, '');
    assert.equal(node.lean.leanMarkdown(html, `${P}/f`).md, node.lean.leanMarkdown(clean, `${P}/f`).md, 'lean: the same as the page without its NULs');
    for (const menus of [true, false]) assert.equal(node.reader.toMarkdown(html, `${P}/f`, { menus }), node.reader.toMarkdown(clean, `${P}/f`, { menus }), `toMarkdown menus=${menus}: the same as the page without its NULs`);
  }
});

// B3: code in every mix of ordered and unordered lists, and in items numbered 10 and up. CommonMark's rule, in plain JS:
// the fence stands in the content of the item above it (at least the item's indentation plus its marker and a space, at most
// three more), every line of code carries the fence's indentation, and taking exactly that off gives the code back
const PYS = 'def tide(level):\n    if level > 3:\n        return "high"';
const NESTS = {
  'ol in ol': [`<ol><li>Outer<ol><li>Inner<pre>${esc(PYS)}</pre></li></ol></li><li>Two</li></ol>`, '1. Inner'],
  'ul in ol': [`<ol><li>Outer<ul><li>Inner<pre>${esc(PYS)}</pre></li></ul></li><li>Two</li></ol>`, '- Inner'],
  'ol in ul': [`<ul><li>Outer<ol><li>Inner<pre>${esc(PYS)}</pre></li></ol></li><li>Two</li></ul>`, '1. Inner'],
  'ol of ten': [`<ol>${Array.from({ length: 9 }, (_, i) => `<li>Step ${i + 1}</li>`).join('')}<li>Tenth<pre>${esc(PYS)}</pre></li></ol>`, '10. Tenth'],
  'ol in an ol of ten': [`<ol>${Array.from({ length: 9 }, (_, i) => `<li>Step ${i + 1}</li>`).join('')}<li>Tenth<ol><li>Inner<pre>${esc(PYS)}</pre></li></ol></li></ol>`, '1. Inner'],
};
await proof('code in an ordered list nested in an ordered list, every other mix, and items numbered 10 and up stands in the content of its own item, byte-exact, in the lean reader and /r/ (B3)', async () => {
  for (const [k, [inner, item]] of Object.entries(NESTS)) {
    const html = `<html><head><title>${k}</title></head><body><main><h1>Guide</h1><p>${WORDS}</p>${inner}<p>Closing words.</p></main></body></html>`;
    PAGES.set(`${P}/nest/${k.replace(/ /g, '-')}`, html);
    for (const [what, md] of [['leanMarkdown', node.lean.leanMarkdown(html, `${P}/x`).md], ['/r/', (await node.call(`/r/${P}/nest/${k.replace(/ /g, '-')}`, { ip: fresh() })).text]]) {
      const r = nestedIn(md, PYS); assert.ok(r.ok, `${k} ${what}: ${JSON.stringify(r)}\n${md.slice(md.indexOf('Guide'), md.indexOf('Closing'))}`); assert.ok(r.item.startsWith(item), `${k} ${what}: in "${r.item}", not "${item}"`);
    }
  }
});

// R1: three levels, every mix of ul and ol, code at each level, and ten items at the inner level. The text lines of an item go
// two spaces in, as before, so an ordered marker's two spaces are no nesting for CommonMark: where an item's marker line is
// a list item (C <= its indentation <= C + 3, C the content column of the container it is read in), its code stands at the
// item's content column, inside the item; where it is not, at C, the container's own column. Either way the block's code
// comes back byte for byte (taking exactly the fence's indentation off), never lost and never with spaces too many
const CODE3 = (i) => `def f${i}(x):\n    if x:\n        return ${i}\n    return 0`;
const exactAt = (md, code) => { const L = md.split('\n'); for (let i = 0; i < L.length; i++) { const o = /^( *)(`{3,})/.exec(L[i]); if (!o) continue; const ind = o[1].length; let j = i + 1; while (j < L.length && !new RegExp(`^ {${ind}}\`{3,}\\s*$`).test(L[j])) j++; const body = L.slice(i + 1, j); if (body.every((l) => !l.trim() || l.startsWith(' '.repeat(ind))) && body.map((l) => l.slice(ind)).join('\n') === code) return { ind, line: i, L }; } return null; };
const owner = (L, at, ind) => { let k = at - 1; while (k >= 0 && !(/^( *)([-*]|\d+[.)]) /.test(L[k]) && /^( *)/.exec(L[k])[1].length < ind)) k--; return k >= 0 ? L[k].trim() : null; };
await proof('three levels of lists, every mix of ul and ol, code at each level, ten items at the inner level: each block byte-exact at its item\'s content column where CommonMark reads the item, else at its container\'s (R1)', async () => {
  let n = 0;
  for (const a of ['ul', 'ol']) for (const b of ['ul', 'ol']) for (const c of ['ul', 'ol']) for (const ten of [false, true]) {
    const inner = ten ? Array.from({ length: 9 }, (_, i) => `<li>Three ${i + 1}</li>`).join('') + `<li>Level three text<pre>${esc(CODE3(3))}</pre></li>` : `<li>Level three text<pre>${esc(CODE3(3))}</pre></li><li>Three b</li>`;
    const html = `<html><head><title>m</title></head><body><main><h1>Guide</h1><p>${WORDS}</p><${a}><li>Level one text<pre>${esc(CODE3(1))}</pre><${b}><li>Level two text<pre>${esc(CODE3(2))}</pre><${c}>${inner}</${c}></li><li>Two b</li></${b}></li><li>One b</li></${a}><p>Closing words.</p></main></body></html>`;
    const w = (t, num) => (t === 'ol' ? String(num).length + 2 : 2), lv = []; let C = 0;
    for (const [k, [t, num]] of [[a, 1], [b, 1], [c, ten ? 10 : 1]].entries()) { const d = 2 * k, real = C <= d && d <= C + 3, cc = d + w(t, num); lv.push({ d, C, real, cc, at: real ? cc : C }); C = real && w(t, num) <= 2 ? cc : C; }
    PAGES.set(`${P}/m/${a}${b}${c}${ten}`, html);
    for (const [what, md] of [['leanMarkdown', node.lean.leanMarkdown(html, `${P}/m`).md], ['/r/', (await node.call(`/r/${P}/m/${a}${b}${c}${ten}`, { ip: fresh() })).text]]) {
      for (const [i, L] of lv.entries()) {
        const x = exactAt(md, CODE3(i + 1)), name = `${a}>${b}>${c}${ten ? ' (ten)' : ''} level ${i + 1} ${what}`;
        assert.ok(x, `${name}: no block holds the code byte for byte\n${md.slice(md.indexOf('Level one') - 3, md.indexOf('Closing'))}`); assert.equal(x.ind, L.at, `${name}: at ${x.ind}, not ${L.at}`);
        if (L.real) assert.match(owner(x.L, x.line, x.ind) || '', new RegExp(`^(-|\\d+\\.) Level ${['one', 'two', 'three'][i]} text`), `${name}: in its own item`);
        n++;
      }
    }
  }
  assert.equal(n, 96);
});

console.log('pages written to make the reader slow (verify-3.40 F2, nit 2)');
// a page written to make the scan slow, converted by this tree's toMarkdown in a child process with a time limit of 10 s
const ADVERSARIAL = {
  unclosed: 'const parts = Array.from({ length: 150000 }, (_, i) => "```x" + i);',
  falling: 'const parts = []; for (let k = 1903; k >= 4; k--) parts.push("`".repeat(k) + "x"); for (let i = 0; i < 50000; i++) parts.push("```");',
  pairs: 'const parts = Array.from({ length: 200000 }, (_, i) => i % 3 === 1 ? "x" : "```");',
};
const pageOf = (kind) => `${ADVERSARIAL[kind]} const html = "<html><body><main><p>" + parts.join("<br>") + "</p></main></body></html>";`;
const timed = (kind) => {
  const script = `${pageOf(kind)} const { toMarkdown } = await import(${JSON.stringify(pathToFileURL(join(ROOT, 'node/reader.mjs')).href)}); const { createHash } = await import('node:crypto'); const t = performance.now(); const out = toMarkdown(html, "https://example.org/"); console.log(JSON.stringify({ ms: Math.round(performance.now() - t), bytes: html.length, sha: createHash('sha256').update(out).digest('hex') }));`;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', timeout: 10_000 });
  return r.error?.code === 'ETIMEDOUT' || r.signal ? { timeout: true } : JSON.parse((r.stdout || '').trim().split('\n').pop() || '{}');
};
const refSha = async (kind) => { const { createHash } = await import('node:crypto'); const parts = (0, eval)(`(() => { ${ADVERSARIAL[kind]} return parts; })()`); return createHash('sha256').update(ref.reader.toMarkdown(`<html><body><main><p>${parts.join('<br>')}</p></main></body></html>`, 'https://example.org/')).digest('hex'); };
await proof('a 2 MB page of fences that never close ("```x" 150,000 times) is read in under 2,000 ms, as text exactly as before', async () => {
  const r = timed('unclosed'); assert.ok(!r.timeout, 'the conversion did not end within 10 s'); assert.ok(r.bytes >= 1_900_000, `${r.bytes} bytes`); assert.ok(r.ms < 2000, `${r.ms} ms`); assert.equal(r.sha, await refSha('unclosed'), 'the same text as before');
});
await proof('a 2 MB page of fences of falling length (1,903 backticks down to 4) among 50,000 short closing lines is read in under 2,000 ms, as text exactly as before', async () => {
  const r = timed('falling'); assert.ok(!r.timeout, 'the conversion did not end within 10 s'); assert.ok(r.bytes >= 1_900_000, `${r.bytes} bytes`); assert.ok(r.ms < 2000, `${r.ms} ms`); assert.equal(r.sha, await refSha('falling'), 'the same text as before');
});
await proof('2 MB of closing pairs ("```", "x", "```" over and over) is read in under 500 ms, as text exactly as before (nit 2)', async () => {
  const r = timed('pairs'); assert.ok(!r.timeout, 'the conversion did not end within 10 s'); assert.ok(r.bytes >= 1_000_000, `${r.bytes} bytes`); assert.ok(r.ms < 500, `${r.ms} ms`); assert.equal(r.sha, await refSha('pairs'), 'the same text as before');
});

console.log('everything outside code, byte for byte as the reference tree');
const SEA = [];
await proof('every page of the sea (as this node serves it) through toMarkdown, leanMarkdown and the .md twin: the same bytes where the page holds no code, only whitespace inside code where it does', async () => {
  const { HUB_PATHS } = await imp(ROOT, 'hubs.mjs');
  for (const p of HUB_PATHS) { if (p === '/' || p === '/works') continue; const r = await node.call(p, { accept: 'text/html', ua: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/131.0 Safari/537.36', ip: fresh() }); if (r.status === 200 && /<main/.test(r.text)) SEA.push([p, r.text]); }
  assert.ok(SEA.length >= 50, `${SEA.length} pages`);
  let same = 0, code = 0;
  for (const [p, html] of [...SEA, ['/proof/deploy', DEPLOY], ['/proof/steps', STEPS], ['/proof/fences', FENCES], ['/proof/plain', PLAIN]]) {
    const url = BASE + p, outs = [
      ['toMarkdown', node.reader.toMarkdown(html, url), ref.reader.toMarkdown(html, url)],
      ['toMarkdown menus=false', node.reader.toMarkdown(html, url, { menus: false }), ref.reader.toMarkdown(html, url, { menus: false })],
      ['leanMarkdown', node.lean.leanMarkdown(html, url).md, ref.lean.leanMarkdown(html, url).md],
      ['the twin', node.agentmd.pageMarkdown(html, url, BASE).md, ref.agentmd.pageMarkdown(html, url, BASE).md],
    ];
    const holdsCode = /<pre\b/i.test(html);
    for (const [what, now, before] of outs) { if (!holdsCode) { assert.equal(now, before, `${p} ${what}`); same++; } else { onlyCodeDiffers(now, before, `${p} ${what}`); code++; } }
  }
  assert.ok(same >= 100 && code >= 8, `${same} answers the same, ${code} with code`);
});
await proof('a page without code through /r/ (lean, full, JSON), /v2/scrape (markdown, onlyMainContent: false) and Jina\'s layout: what the reference node answers', async () => {
  const ip = fresh(), u = `/r/${P}/plain`;
  for (const [p, o] of [[u, {}], [`${u}?format=full`, {}], [`${u}?format=json`, {}], [u, { headers: { 'x-return-format': 'markdown' } }], [u, { accept: 'application/json', headers: { 'x-return-format': 'markdown' } }], ['/v2/scrape', { method: 'POST', accept: 'application/json', body: { url: `${P}/plain`, formats: ['markdown', 'links'] } }], ['/v2/scrape', { method: 'POST', accept: 'application/json', body: { url: `${P}/plain`, formats: ['markdown'], onlyMainContent: false } }]]) {
    const a = await node.call(p, { ip, ...o }), b = await ref.call(p, { ip, ...o }); assert.equal(a.status, b.status, p); assert.equal(steady(a.text), steady(b.text), `${p} ${JSON.stringify(o)}`);
  }
});
await proof('package.json runs this proof as proof:reader-code', () => assert.equal(JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).scripts['proof:reader-code'], 'node tools/reader-code-proof.mjs'));
console.log(`\n${passed} proofs held, ${failed} failed`);

// ------------------------------------------------------------------ negative controls: each rule broken in a copy, the proof must fail there
const BREAK = [
  ['the old trim: every line made tidy, the lines of code too', 'node/reader.mjs', '  return back(md);\n}', "  return back(md).split('\\n').map((l) => l.replace(/[ \\t\\u00a0]+/g, ' ').trim()).join('\\n');\n}"],
  ['code in a list item at the margin while its fence goes in (5bef5ae)', 'node/lean.mjs', 'return code ? (own ? pad + l : l) : `  ${l}`; }; };', 'return code ? l : `  ${l}`; }; };'],
  ['the fence of a list item\'s code at the margin, its code two spaces in (fbf500e)', 'node/lean.mjs', 'out.push(raw.includes(LIST_FENCE) ? raw.trimEnd() : raw.trim());', 'out.push(raw.trim());'],
  ['the fixed two-space shift for the code of ordered items (B3)', 'node/lean.mjs', 'const width = (k) => (ordered ? String(k).length + 2 : 2);', 'const width = () => 2;'],
  ['the summed-width shift of 1b51af6 (R1)', 'node/lean.mjs', [["return own ? pad + l.replace(/^\\s*\\u0000?/, LIST_FENCE) : l; }", "return pad + l.replace(/^\\s*\\u0000?/, LIST_FENCE); }"], ["return code ? (own ? pad + l : l) : `  ${l}`; }; };", "return code ? pad + l : `  ${l}`; }; };"], ['const sh = shifter(real ? cc : C);', 'const sh = shifter(w);'], ["l.split('\\n').map(shifter(0))", "l.split('\\n').map(shifter(2))"]], null],
  ['the final NUL sweep of the lean reader removed (B2)', 'node/lean.mjs', "menus: region === body }).replace(/\\u0000/g, '');", 'menus: region === body });'],
  ['a page\'s own NULs let into toMarkdown (B2)', 'node/reader.mjs', "  let h = String(html || '').replace(/\\u0000/g, '').replace(", "  let h = String(html || '').replace("],
  ['a page\'s own NULs let into the lean reader (B2)', 'node/lean.mjs', "  html = String(html ?? '').replace(/\\u0000/g, '');\n", "  html = String(html ?? '');\n"],
  ['marker slices held as fences, back() not recursive (5bef5ae, B1)', 'node/reader.mjs', "  let ls = md.split('\\n').map((l) =>", "  { const raw = md.split('\\n'), o2 = []; for (let i = 0; i < raw.length; i++) { if (/^[ \\t]*(```|~~~)/.test(raw[i])) { let j = i + 1; while (j < raw.length && raw[j].trim() !== raw[i].trim()) j++; if (j < raw.length) { o2.push(raw[i], `\\u0000c${codes.push(raw.slice(i + 1, j).join('\\n').replace(/\\u0000c/g, '\\u0000C')) - 1}\\u0000`, raw[j]); i = j; continue; } } o2.push(raw[i]); } md = o2.join('\\n'); }\n  let ls = md.split('\\n').map((l) =>"],
  ['a tab of a Makefile written as spaces', 'node/reader.mjs', ".replace(/\\u00a0/g, ' ').split('\\n')", ".replace(/\\u00a0/g, ' ').replace(/\\t/g, '    ').split('\\n')"],
  ['outside code, spaces no longer run together', 'node/reader.mjs', "  let ls = md.split('\\n').map((l) => l.replace(", "  let ls = md.split('\\n').map((l) => l.trim() || l.replace("],
];
let caught = 0;
if (CONTROLS) {
  console.log('\nnegative controls: each rule broken in a copy, the proof must fail there');
  for (const [what, f, from, to] of BREAK) {
    const tmp = mkdtempSync(join(tmpdir(), 'mare-code-ctl-'));
    try {
      for (const d of ['node', 'site', 'proof', 'config', 'public', 'engines']) if (existsSync(join(ROOT, d))) cpSync(join(ROOT, d), join(tmp, d), { recursive: true });
      mkdirSync(join(tmp, 'tools'), { recursive: true }); cpSync(join(ROOT, 'tools/reader-code-proof.mjs'), join(tmp, 'tools/reader-code-proof.mjs')); cpSync(join(ROOT, 'package.json'), join(tmp, 'package.json'));
      let src = readFileSync(join(tmp, f), 'utf8'); const pairs = Array.isArray(from) ? from : [[from, to]];
      if (pairs.some(([x]) => !src.includes(x))) { console.log(`  FAIL control "${what}": the line to break is gone from ${f}`); continue; }
      for (const [x, y] of pairs) src = src.replace(x, y); writeFileSync(join(tmp, f), src);
      const run = spawnSync(process.execPath, ['tools/reader-code-proof.mjs', '--no-controls'], { cwd: tmp, encoding: 'utf8', timeout: 600_000, env: { ...process.env, MARE_CODE_REF_DIR: refDir || '' } });
      const held = /(\d+) proofs held, (\d+) failed/.exec(run.stdout || '');
      if (run.status !== 0 && held && Number(held[2]) > 0) { caught++; console.log(`  ok   caught: ${what} (${held[2]} ${held[2] === '1' ? 'proof' : 'proofs'} failed)`); }
      else console.log(`  FAIL not caught: ${what} (exit ${run.status}${held ? `, ${held[0]}` : ', no result'})`);
    } finally { rmSync(tmp, { recursive: true, force: true }); }
  }
  console.log(`${caught} of ${BREAK.length} controls caught`);
}
if (refDir && !process.env.MARE_CODE_REF_DIR) rmSync(refDir, { recursive: true, force: true });
process.exit(failed || (CONTROLS && caught !== BREAK.length) ? 1 : 0);
