// Mare Liberum · proof of the pages ChatGPT search reads (3.85, "Die Seiten, die ChatGPT-Suche liest"): OpenAI's crawlers read
// the sea by the tens of thousands a day and ChatGPT-User lands on the buy pages, but nobody could tell which pages each reader
// pulls, and the buy pages opened with a dive plan instead of what an assistant can do for its person. It proves, without the network:
//   names    /census?day= names, for every named reader of the search and AI kinds, the pages it read that day (names[].paths):
//            the first part of the path, with /* when the path goes deeper, never the query and never a handle or an id;
//            a name with a space in it (OpenAI search) keeps its whole name; the sea's own calls count nowhere; a browser or a
//            program gets no paths; the short census without a day stays as it was, without paths
//   carry    a node that takes over adds the counts of the old node, paths included (node/carry.mjs)
//   buy      /buy and every /buy/<need> say, right after the heading and the first sentence, the free deal check
//            GET /deal?url=<product page> (within 400 characters of text from the heading on), never a paid door and never
//            the app door /mcp/app; the dive plan stands after the page and its footer there, as on /seen; other pages keep it
//            right after the header
//   guide    llms.txt says both: the buy pages open with the free deal check, and /census?day= gives names[].paths
// Negative controls at the end: each rule broken in a copy of the code, and this proof must fail there.
// Runs without the network: node tools/readers-proof.mjs   (exit code 1 when a proof fails or a control is not caught)
//   --no-controls   only the proofs (the controls run this file that way in each broken copy)
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, cpSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { Buffer } from 'node:buffer';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const k of ['MARE_TOLL', 'MARE_ENGINE', 'MARE_FAIR', 'MARE_X402_FACILITATOR', 'MARE_PAY_TO', 'MARE_ROUTE_PRICE_CENTS', 'MARE_STATE', 'MARE_DB_URL', 'MARE_DB_KEY', 'MARE_DB_SECRET', 'MARE_BASE_RPC', 'MARE_CATALOG_ID']) delete process.env[k];
let passed = 0, failed = 0;
const proof = async (name, fn) => { try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 6).join('\n       ')}`); } };
const imp = (f) => import(pathToFileURL(join(ROOT, 'node', f)).href);

// ------------------------------------------------------------------ the world: nothing answers, the proof uses no network
globalThis.fetch = async () => new Response('not here', { status: 404, headers: { 'content-type': 'text/plain' } });
createRequire(import.meta.url)('node:dns').promises.lookup = async () => [{ address: '93.184.216.34', family: 4 }];
for (const k of ['error', 'warn', 'info']) console[k] = () => {};

// ------------------------------------------------------------------ the node
const BASE = 'https://mare.test', LLMS = readFileSync(join(ROOT, 'site/llms.txt'), 'utf8'), SITE = { '/llms.txt': { body: LLMS, type: 'text/plain; charset=utf-8' } };
const core = await imp('core.mjs'), { createMem } = await imp('mem.mjs'), { memoryKv } = await imp('flow.mjs');
const { immune } = await imp('immune.mjs'), { createLedger } = await imp('ledger.mjs'), { payConfig } = await imp('pay.mjs');
const { carryIn } = await imp('carry.mjs');
const dir = mkdtempSync(join(tmpdir(), 'mare-readers-')), file = join(dir, 'sea.tsv');
process.once('exit', () => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });
writeFileSync(file, ''); writeFileSync(join(dir, 'build.json'), JSON.stringify({ builtAt: '2026-11-20T10:00:00.000Z', entries: 0, lakes: {} }));
// the census is written after the answer (waitUntil): the proof keeps those writes and waits for them
const pending = [], settle = async () => { while (pending.length) await Promise.allSettled(pending.splice(0)); };
const db = createMem({ file, base: BASE }), kv = memoryKv(), ledger = createLedger({});
const cfg = { base: BASE, kv, ledger, pay: payConfig({}), site: SITE, waitUntil: (p) => { pending.push(p); }, creditSweepMs: 0 };
let net = 0; const fresh = () => `198.51.100.${++net}`;
const BROWSER = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const OAI = 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.3; +https://openai.com/searchbot';
const GPTBOT = 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot';
const CHATGPT = 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot';
const SELF = 'MareLiberum-session/1.0', PROGRAM = 'readers-proof-program/1.0';
const call = async (path, { accept = 'application/json', ua = BROWSER } = {}) => {
  const res = await core.handle(new Request(BASE + path, { headers: { accept, 'user-agent': ua, 'x-forwarded-for': fresh() } }), db, cfg);
  const text = res.body ? Buffer.from(await res.arrayBuffer()).toString('utf8') : ''; let j = null; try { j = JSON.parse(text); } catch {}
  return { status: res.status, h: Object.fromEntries(res.headers), text, j };
};
await call('/stats', { ua: 'readers-proof/1.0' });
immune.set({ mode: 'normal', rest: [], pace: { perMinute: 1_000_000, burst: 1_000_000 } });
const DAY = new Date().toISOString().slice(0, 10);
const unesc = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const textOf = (html) => unesc(html.replace(/<head[\s\S]*?<\/head>/i, '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const reader = (c, kind, name) => (c.names || []).find((x) => x.kind === kind && x.name === name);
const pathsOf = (r) => Object.fromEntries((r?.paths || []).map((p) => [p.path, p.n]));

// the visits of the day: OpenAI search on three kinds of page (one with a query, one deep), GPTBot twice on the same kind,
// ChatGPT-User once, and the sea itself, a browser and a program on the same pages
for (const p of ['/buy/sneakers?country=DE', '/seen', '/e/github.com:readers-proof/deep/er', '/seen/0123456789abcdef']) await call(p, { ua: OAI, accept: 'text/html' });
for (const p of ['/buy/sneakers', '/buy/hoodie']) await call(p, { ua: GPTBOT, accept: 'text/html' });
await call('/earn', { ua: CHATGPT, accept: 'text/html' });
for (const ua of [SELF, BROWSER, PROGRAM]) for (const p of ['/buy/sneakers', '/seen']) await call(p, { ua, accept: 'text/html' });
await settle();

console.log('names');
await proof('/census?day= names for OpenAI search (a name with a space) the pages it read: /buy/*, /seen, /e/*, /seen/*, once each', async () => {
  const c = (await call(`/census?day=${DAY}`)).j; assert.ok(c, 'the census answers');
  const r = reader(c, 'search-ai', 'OpenAI search'); assert.ok(r, 'OpenAI search is named whole');
  assert.deepEqual(pathsOf(r), { '/buy/*': 1, '/seen': 1, '/e/*': 1, '/seen/*': 1 });
  assert.ok(r.paths.every((p, i, a) => !i || a[i - 1].n >= p.n), 'the most read first');
});
await proof('GPTBot and ChatGPT-User get their pages too: two buy pages are one kind of page, counted twice', async () => {
  const c = (await call(`/census?day=${DAY}`)).j;
  assert.deepEqual(pathsOf(reader(c, 'ai-crawler', 'OpenAI GPTBot')), { '/buy/*': 2 });
  assert.deepEqual(pathsOf(reader(c, 'assistant', 'ChatGPT')), { '/earn': 1 });
});
await proof('the sea\'s own calls count nowhere; a browser or a program gets no paths', async () => {
  const c = (await call(`/census?day=${DAY}`)).j;
  for (const x of c.names) if (!['search-ai', 'ai-crawler', 'search', 'assistant'].includes(x.kind)) assert.equal(x.paths, undefined, `${x.kind}|${x.name}`);
  const all = Object.values(Object.fromEntries(c.names.filter((x) => x.paths).map((x) => [x.name, pathsOf(x)])));
  assert.equal(all.reduce((s, p) => s + (p['/buy/*'] || 0), 0), 3, 'only the 3 buy pages of OpenAI search and GPTBot');
  assert.equal(all.reduce((s, p) => s + (p['/seen'] || 0), 0), 1, 'only the one /seen of OpenAI search');
});
await proof('a key of the day is kind|name|first part, with /* for deeper paths: never a query, a handle or an id', async () => {
  const m = await kv.get(`census:${DAY}`); const keys = Object.keys(m?.np || {}); assert.ok(keys.length >= 5, `${keys.length} keys`);
  for (const k of keys) {
    assert.match(k, /^[a-z-]+\|[^|]+\|\/[a-z0-9._:-]*(\/\*)?$/i, k);
    assert.ok(!/[?=&#]|sneakers|hoodie|0123456789abcdef|readers-proof|country/.test(k.slice(k.lastIndexOf('|'))), `nothing after the first part in ${k}`);
  }
});
await proof('the short census without a day stays as it was: no paths anywhere', async () => {
  const r = await call('/census'); assert.equal(r.status, 200); assert.ok(r.j?.today?.top, 'the short census');
  assert.ok(!r.text.includes('"paths"'), 'no paths in the short census');
});

console.log('carry');
await proof('a node that takes over adds the old node\'s paths to its own day (node/carry.mjs)', async () => {
  const k2 = memoryKv(), d = DAY;
  await k2.set(`census:${d}`, { kinds: { 'search-ai': 1 }, names: { 'search-ai|OpenAI search': 1 }, np: { 'search-ai|OpenAI search|/buy/*': 1 } }, 3600 * 24 * 40);
  await carryIn(k2, { parts: [{ id: 'readers-proof-carry', census: { [d]: { kinds: { 'search-ai': 2 }, names: { 'search-ai|OpenAI search': 2 }, np: { 'search-ai|OpenAI search|/buy/*': 2, 'search-ai|OpenAI search|/seen': 1 } } } }] });
  assert.deepEqual((await k2.get(`census:${d}`)).np, { 'search-ai|OpenAI search|/buy/*': 3, 'search-ai|OpenAI search|/seen': 1 });
});

console.log('buy');
const CALL = `GET ${BASE}/deal?url=<product page>`;
for (const p of ['/buy', '/buy/sneakers']) {
  await proof(`${p}: the free deal check right after the heading and its first sentence, within 400 characters of text, no paid door`, async () => {
    const r = await call(p, { accept: 'text/html' }); assert.equal(r.status, 200); assert.match(r.h['content-type'], /^text\/html/);
    const m = /<h1>([\s\S]*?)<\/h1>\s*<p>([\s\S]*?)<\/p>\s*(<p id="deal-first">[\s\S]*?<\/p>)/.exec(r.text); assert.ok(m, 'heading, first sentence, then the paragraph');
    const para = unesc(m[3]); assert.ok(para.includes(CALL), 'the free call'); assert.ok(para.includes('/deal?url='));
    assert.ok(!/x402|USDC|\/offers|\/mcp\/app|\/session|\/seat/.test(para), 'never a paid door, never the app door');
    const after = textOf(r.text.slice(r.text.indexOf('<h1>'))), at = after.indexOf(CALL); assert.ok(at >= 0 && at < 400, `the call at character ${at} from the heading on`);
  });
  await proof(`${p}: the dive plan stands after the page and its footer, the header stays`, async () => {
    const r = await call(p, { accept: 'text/html' }), plan = r.text.indexOf('id="plan"'), main = r.text.indexOf('</main>'), h1 = r.text.indexOf('<h1>');
    assert.ok(plan > 0 && main > 0 && plan > main && plan > r.text.indexOf('id="foot"'), `plan at ${plan}, end of the page at ${main}`);
    assert.ok(r.text.indexOf('id="hdr"') > 0 && r.text.indexOf('id="hdr"') < h1, 'the header before the heading');
  });
}
await proof('other pages keep the dive plan right after the header (/earn)', async () => {
  const r = await call('/earn', { accept: 'text/html' }), plan = r.text.indexOf('id="plan"');
  assert.ok(plan > 0 && plan < r.text.indexOf('<h1'), 'the plan before the heading on /earn');
});

console.log('guide');
await proof('llms.txt says the buy pages open with the free deal check and that /census?day= gives names[].paths', async () => {
  assert.ok(/buy pages open with the free deal check[^\n]*\/deal\?url=<product page>/.test(LLMS), 'the buy pages');
  assert.ok(/\/census\?day=YYYY-MM-DD[^\n]*names\[\]\.paths/.test(LLMS), 'the census');
});

console.log(`\n${passed} of ${passed + failed} proofs passed`);

// ------------------------------------------------------------------ negative controls: each rule broken in a copy, the proof must fail there
let caught = 0, missed = 0;
if (!process.argv.includes('--no-controls')) {
  console.log('\nnegative controls: each rule broken in a copy, the proof must fail there');
  const CONTROLS = [
    ['the dive plan back before the heading of the buy pages', 'node/skin.mjs', 'const PLAN_LATE = /^\\/(?:seen|buy)(?:\\/|$)/;', 'const PLAN_LATE = /^\\/seen(?:\\/|$)/;'],
    ['a buy page without the free deal check', 'node/needs.mjs', '<h1>${esc(T)}</h1><p>${esc(desc)}</p>\n${dealLine(base)}\n', '<h1>${esc(T)}</h1><p>${esc(desc)}</p>\n'],
    ['the buy index without the free deal check', 'node/needs.mjs', '<h1>Buy by need</h1><p>${esc(desc)}</p>\n${dealLine(base)}\n', '<h1>Buy by need</h1><p>${esc(desc)}</p>\n'],
    ['the paid door in the paragraph', 'node/needs.mjs', 'too-cheap warnings, an open price record).</p>`;', 'too-cheap warnings, an open price record). More: /x402/deal.</p>`;'],
    ['the whole path in the key (the handle written down)', 'node/flow.mjs', "${parts.length > 2 && parts.slice(2).some(Boolean) ? '/*' : ''}", "${parts.length > 2 ? '/' + parts.slice(2).join('/') : ''}"],
    ['a key split at its first | (the name cut)', 'node/flow.mjs', "const i = k.lastIndexOf('|');", "const i = k.indexOf('|');"],
    ['paths for every kind (a program counted)', 'node/flow.mjs', "const NP_KINDS = new Set(['search-ai', 'ai-crawler', 'search', 'assistant']);", "const NP_KINDS = { has: () => true };"],
    ['paths in the short census', 'node/flow.mjs', 'today: { kinds: t?.kinds || {}, top: top(t),', 'today: { kinds: t?.kinds || {}, top: withPaths(t, top(t)),'],
    ['the old node\'s paths left behind', 'node/carry.mjs', '      if (c.np) m.np = add(m.np || {}, c.np);\n', ''],
    ['llms.txt silent on the paths', 'site/llms.txt', ' (GET /census?day=YYYY-MM-DD gives, for named search and AI readers, names[].paths: the ten page kinds each one read that day)', ''],
  ];
  for (const [name, f, from, to] of CONTROLS) {
    const d2 = mkdtempSync(join(tmpdir(), 'mare-readers-ctl-'));
    try {
      cpSync(ROOT, d2, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      const fp = join(d2, f), txt = readFileSync(fp, 'utf8');
      if (!txt.includes(from)) { missed++; console.log(`  FAIL control "${name}": the line to break is gone from ${f}; the control needs updating`); continue; }
      writeFileSync(fp, txt.replace(from, to));
      const r = spawnSync(process.execPath, [join(d2, 'tools/readers-proof.mjs'), '--no-controls'], { encoding: 'utf8', timeout: 240_000, env: { ...process.env, NODE_PATH: join(ROOT, 'node_modules') } });
      const out = `${r.stdout}${r.stderr}`, broke = (out.match(/\n  FAIL /g) || []).length;
      if (r.status !== 0 && broke > 0) { caught++; console.log(`  ok   caught: ${name} (${broke} proof${broke === 1 ? '' : 's'} failed)`); }
      else { missed++; console.log(`  FAIL control "${name}" was not caught (exit ${r.status})`); }
    } finally { try { rmSync(d2, { recursive: true, force: true }); } catch {} }
  }
  console.log(`${caught} of ${CONTROLS.length} controls caught`);
}
process.exit(failed || missed ? 1 : 0);
