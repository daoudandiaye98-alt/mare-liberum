// Mare Liberum · proof of the free deal check first (3.70, "Der freie Preis-Check zuerst"): where assistants that can only open
// a link arrive (ChatGPT-User reads /earn, /about and the agent card), the first lines say what they can do for their person at
// once. It proves, without the network:
//   pages    /earn and /about carry, right after their heading, one paragraph with the free call GET /deal?url=<product page>,
//            a finished example on a real product page, a real open price record and how the sea earns (the same sentence as
//            /for/bots); the call stands within the first 1,000 characters of the page's text and of what ChatGPT-User gets; the
//            paragraph names no paid door and never the app door /mcp/app; what the pages said before is still there
//   data     /earn.json and the JSON of /about lead with price_check, the same object on both
//   card     the agent card's description begins with the free call, its first skill is deal_check with the example, and the
//            call stands within the first 1,000 characters of the card; the skills that were there stay, in their order
//   example  the example is GET /deal with url = a product page (/products/), the record is /seen/<16 hex>
// Negative controls at the end: each rule broken in a copy of the code, and this proof must fail there.
// Runs without the network: node tools/dealfirst-proof.mjs   (exit code 1 when a proof fails or a control is not caught)
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
const BASE = 'https://mare.test', SITE = { '/llms.txt': { body: readFileSync(join(ROOT, 'site/llms.txt'), 'utf8'), type: 'text/plain; charset=utf-8' } };
const core = await imp('core.mjs'), { createMem } = await imp('mem.mjs'), { memoryKv } = await imp('flow.mjs');
const { immune } = await imp('immune.mjs'), { createLedger } = await imp('ledger.mjs'), { payConfig } = await imp('pay.mjs');
const { DEAL_FIRST, dealFirst, botsParts } = await imp('pages.mjs');
const dir = mkdtempSync(join(tmpdir(), 'mare-dealfirst-')), file = join(dir, 'sea.tsv');
process.once('exit', () => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });
writeFileSync(file, ''); writeFileSync(join(dir, 'build.json'), JSON.stringify({ builtAt: '2026-11-20T10:00:00.000Z', entries: 0, lakes: {} }));
const db = createMem({ file, base: BASE }), kv = memoryKv(), ledger = createLedger({});
const cfg = { base: BASE, kv, ledger, pay: payConfig({}), site: SITE, waitUntil: () => {}, creditSweepMs: 0 };
let net = 0; const fresh = () => `198.51.100.${++net}`;
const BROWSER = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36', CHATGPT = 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot';
const call = async (path, { accept = 'application/json', ua = BROWSER } = {}) => {
  const res = await core.handle(new Request(BASE + path, { headers: { accept, 'user-agent': ua, 'x-forwarded-for': fresh() } }), db, cfg);
  const text = res.body ? Buffer.from(await res.arrayBuffer()).toString('utf8') : ''; let j = null; try { j = JSON.parse(text); } catch {}
  return { status: res.status, h: Object.fromEntries(res.headers), text, j };
};
await call('/stats', { ua: 'deal-first-proof/1.0' });
immune.set({ mode: 'normal', rest: [], pace: { perMinute: 1_000_000, burst: 1_000_000 } });

const CALL = `GET ${BASE}/deal?url=<product page>`;
const unesc = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
// the text a reader sees: no head, no scripts or styles, no tags, white space folded
const textOf = (html) => unesc(html.replace(/<head[\s\S]*?<\/head>/i, '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const paragraphOf = (html) => { const m = /<\/h1>\s*(<p id="deal-first"[^>]*>[\s\S]*?<\/p>)/.exec(html); assert.ok(m, 'the paragraph stands right after the heading'); return m[1]; };
const checkParagraph = (p) => {
  const t = unesc(p), d = dealFirst(BASE);
  assert.ok(t.includes(CALL), 'the free call'); assert.ok(p.includes(`href="${d.example.replace(/&/g, '&amp;')}"`), 'the example as a link');
  assert.ok(t.includes(d.record), 'a real record'); assert.ok(t.includes(botsParts(BASE).money), 'how the sea earns, as /for/bots says it');
  assert.ok(!/x402|USDC|\/offers|\/mcp\/app/.test(t), 'no paid door and never the app door in the paragraph');
};

console.log('pages');
for (const [path, before] of [['/earn', ['Markets, catalogs and boards', 'Before you take work']], ['/about', ['Who runs it', 'The price', 'Open numbers']]]) {
  await proof(`${path} carries the free deal check right after its heading, within the first 1,000 characters of its text, and keeps what it said`, async () => {
    const r = await call(path, { accept: 'text/html' }); assert.equal(r.status, 200); assert.match(r.h['content-type'], /^text\/html/);
    checkParagraph(paragraphOf(r.text));
    const at = textOf(r.text).indexOf(CALL); assert.ok(at >= 0 && at < 1000, `the call at character ${at} of the text`);
    for (const h of before) assert.ok(r.text.includes(h), `${h} stays`);
  });
  await proof(`${path} as ChatGPT-User gets it (Accept: text/html) names the free call within its first 1,000 characters`, async () => {
    const r = await call(path, { accept: 'text/html,application/xhtml+xml,*/*;q=0.8', ua: CHATGPT }); assert.equal(r.status, 200);
    const text = /html/.test(r.h['content-type']) ? textOf(r.text) : r.text, at = text.indexOf(CALL); assert.ok(at >= 0 && at < 1000, `the call at character ${at} of what ChatGPT-User gets (${r.h['content-type']})`);
  });
}

console.log('data');
await proof('/earn.json and the JSON of /about lead with price_check, the same object on both', async () => {
  const e = (await call('/earn.json')).j, a = (await call('/about')).j;
  assert.equal(Object.keys(e)[0], 'price_check'); assert.deepEqual(e.price_check, dealFirst(BASE));
  assert.deepEqual(Object.keys(a).slice(0, 3), ['name', 'what', 'price_check']); assert.deepEqual(a.price_check, e.price_check);
  assert.ok(Array.isArray(e.places) && e.places.length > 3, 'the places stay'); assert.ok(a.operator?.email, 'who runs it stays');
});

console.log('card');
await proof('the agent card begins with the free call, its first skill is deal_check, and the skills that were there stay in order', async () => {
  const r = await call('/.well-known/agent-card.json'); assert.equal(r.status, 200); const c = r.j, d = dealFirst(BASE);
  assert.ok(c.description.startsWith(`Free price check before your person buys: ${CALL}. `), 'the description');
  assert.equal(c.skills[0].id, 'deal_check'); assert.ok(c.skills[0].description.includes(CALL)); assert.ok(c.skills[0].examples.includes(d.example));
  assert.ok(c.skills[0].description.includes(botsParts(BASE).money), 'how the sea earns');
  assert.deepEqual(c.skills.slice(1, 5).map((s) => s.id), ['brief', 'review', 'works', 'earn']); assert.ok(c.skills.some((s) => s.id === 'route_paid'));
  const at = r.text.indexOf(`${BASE}/deal?url=<product page>`); assert.ok(at >= 0 && at < 1000, `the call at character ${at} of the card`);
  for (const p of ['/a2a.card.json', '/.well-known/agent.json']) assert.equal((await call(p)).j.skills[0].id, 'deal_check', p);
});

console.log('example');
await proof('the example is GET /deal on a real product page, the record is an open price record', async () => {
  const d = dealFirst(BASE), u = new URL(d.example);
  assert.equal(u.origin + u.pathname, `${BASE}/deal`); assert.equal(u.searchParams.get('url'), DEAL_FIRST.example); assert.deepEqual([...u.searchParams.keys()], ['url']);
  assert.match(new URL(DEAL_FIRST.example).pathname, /^\/products\/[a-z0-9-]+$/); assert.match(DEAL_FIRST.record, /^\/seen\/[0-9a-f]{16}$/);
  assert.equal(d.record, `${BASE}${DEAL_FIRST.record}`); assert.equal(d.more, `${BASE}/for/bots`);
});

console.log(`\n${passed} of ${passed + failed} proofs passed`);

// ------------------------------------------------------------------ negative controls: each rule broken in a copy, the proof must fail there
let caught = 0, missed = 0;
if (!process.argv.includes('--no-controls')) {
  console.log('\nnegative controls: each rule broken in a copy, the proof must fail there');
  const CONTROLS = [
    ['/earn without the paragraph', 'node/pages.mjs', '<h1>Earn: where agents get paid for work</h1>\n${dealFirstHtml(base)}\n', '<h1>Earn: where agents get paid for work</h1>\n'],
    ['/about without the paragraph', 'node/shore.mjs', '<h1>About Mare Liberum</h1>\n${dealFirstHtml(base)}\n', '<h1>About Mare Liberum</h1>\n'],
    ['/earn.json without price_check', 'node/core.mjs', 'json({ price_check: dealFirst(base), ...r }, 200, hdr)', 'json(r, 200, hdr)'],
    ['the card without the deal skill', 'node/core.mjs', '      dealSkill(base),\n', ''],
    ['the card description without the free call', 'node/core.mjs', 'description: `Free price check before your person buys: GET ${base}/deal?url=<product page>. ${SEA_LINE}', 'description: `${SEA_LINE}'],
    ['another sentence on how the sea earns', 'node/pages.mjs', 'money: botsParts(base).money,', "money: 'The sea earns on every purchase.',"],
    ['the paid door in the paragraph', 'node/pages.mjs', '<a href="${BOTS.path}">Put it into your assistant</a>.</p>`;', '<a href="${BOTS.path}">Put it into your assistant</a>. More: /x402/deal.</p>`;'],
  ];
  for (const [name, f, from, to] of CONTROLS) {
    const d2 = mkdtempSync(join(tmpdir(), 'mare-dealfirst-ctl-'));
    try {
      cpSync(ROOT, d2, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      const fp = join(d2, f), txt = readFileSync(fp, 'utf8');
      if (!txt.includes(from)) { missed++; console.log(`  FAIL control "${name}": the line to break is gone from ${f}; the control needs updating`); continue; }
      writeFileSync(fp, txt.replace(from, to));
      const r = spawnSync(process.execPath, [join(d2, 'tools/dealfirst-proof.mjs'), '--no-controls'], { encoding: 'utf8', timeout: 240_000, env: { ...process.env, NODE_PATH: join(ROOT, 'node_modules') } });
      const out = `${r.stdout}${r.stderr}`, broke = (out.match(/\n  FAIL /g) || []).length;
      if (r.status !== 0 && broke > 0) { caught++; console.log(`  ok   caught: ${name} (${broke} proof${broke === 1 ? '' : 's'} failed)`); }
      else { missed++; console.log(`  FAIL control "${name}" was not caught (exit ${r.status})`); }
    } finally { try { rmSync(d2, { recursive: true, force: true }); } catch {} }
  }
  console.log(`${caught} of ${CONTROLS.length} controls caught`);
}
process.exit(failed || missed ? 1 : 0);
