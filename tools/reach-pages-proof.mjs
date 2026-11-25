// Mare Liberum · proof of the guides for developers (node/guides.mjs) and of the reader's OpenAPI (node/readerapi.mjs).
// Every guide answers 200 as a page of the sea, in English, with the foot and both buttons the law asks for; titles and
// descriptions are unique across every hub; every number a guide says is found in its source, which this proof reads on
// its own (the engine bench and the proof of function in proof/, node/toll.mjs, node/squeeze.mjs, node/press.mjs, the
// projection of node/toondoor.mjs, the two gateways in integrations/gateways/), and a figure the source does not hold
// fails; no superlative and no comparison with anyone else; every local link and anchor answers on a local node; each
// guide has its Markdown twin; the hub sitemap, site.xml, the IndexNow batch, llms.txt and /open name what they should;
// /openapi/reader.json is OpenAPI 3.1, names only doors, parameters, headers and statuses the node has, and keeps the
// scrape placeholder in step with the node (a door the node answers stands under paths, a door it does not answer must
// not); the app door /mcp/app stays byte for byte the door the directories reviewed (tools/app-door-3.32.0.json).
// Runs without the network (pages the reader reads come from fixtures here): node tools/reach-pages-proof.mjs
//   --no-controls   skips the negative controls, which break each rule in a copy of the tree and expect this proof to fail
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync, cpSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url)), CONTROLS = !process.argv.includes('--no-controls');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
let passed = 0, failed = 0;
const proof = async (name, fn) => { try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 4).join('\n       ')}`); } };

// ------------------------------------------------------------------ no network: the reader reads fixtures, nothing else leaves
const PAGE_URL = 'https://guides-proof.dev/changelog';
const PAGE_HTML = `<!doctype html><html lang="en"><head><title>Changelog of a library</title></head><body><main><h1>Changelog</h1>${Array.from({ length: 40 }, (_, i) => `<h2>Version 1.${40 - i}.0</h2><p>Fixed a bug in the parser of release ${40 - i}; the reader of this page keeps every line it can.</p>`).join('')}</main></body></html>`;
let indexNowBody = null;
globalThis.fetch = async (u, o) => {
  const k = String(u?.url || u);
  if (k === 'https://api.indexnow.org/indexnow') { indexNowBody = JSON.parse(o.body); return new Response(null, { status: 202 }); }
  if (/^https:\/\/guides-proof\.dev\/robots\.txt$/.test(k)) return new Response('User-agent: *\nAllow: /\n', { status: 200, headers: { 'content-type': 'text/plain' } });
  if (k === PAGE_URL) return new Response(PAGE_HTML, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
  throw new Error(`the proof does not use the network: ${k.slice(0, 80)}`);
};
createRequire(import.meta.url)('node:dns').promises.lookup = async () => [{ address: '93.184.216.34', family: 4 }];

const { handle, indexNowDaily, VERSION } = await import('../node/core.mjs');
const { memoryKv } = await import('../node/flow.mjs');
const { createMem } = await import('../node/mem.mjs');
const { createLedger } = await import('../node/ledger.mjs');
const { payConfig } = await import('../node/pay.mjs');
const { HUBS, HUB_PATHS } = await import('../node/hubs.mjs');
const G = await import('../node/guides.mjs');
const { readerOpenApi, SCRAPE_PATHS } = await import('../node/readerapi.mjs');
const { TOLL_EXAMPLE, tollFacts, TOLL_EXPOSE } = await import('../node/toll.mjs');
const { SQUEEZE } = await import('../node/squeeze.mjs');
const { createVersions, compressUse } = await import('../node/press.mjs');
const { fieldsOf } = await import('../node/toondoor.mjs');
const { CACHING, ENGINE_RULES, PLUG_CHECKED, SOURCES } = await import('../node/engine-ui.mjs');
const { TOON_MIN_GAIN } = await import('../node/toon.mjs');
const { tokensOf } = await import('../node/engine.mjs');
const { ENDPOINTS } = await import('../node/open.mjs');

// ------------------------------------------------------------------ a small sea at the production address
const BASE = 'https://mareliberum.dev';
const dir = mkdtempSync(join(tmpdir(), 'mare-guides-')), file = join(dir, 'sea.tsv');
writeFileSync(file, ''); writeFileSync(join(dir, 'build.json'), JSON.stringify({ builtAt: '2026-11-20T10:00:00.000Z', entries: 0, lakes: {} }));
const db = createMem({ file, base: BASE }), kv = memoryKv();
const SITE = { '/llms.txt': { body: rd('site/llms.txt'), type: 'text/plain; charset=utf-8' } };
const cfg = { base: BASE, pay: payConfig({}), ledger: createLedger({}), kv, site: SITE };
const BROWSER = { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document' };
let ipN = 1;
const call = async (path, { headers = BROWSER, method = 'GET', body, c = cfg } = {}) => {
  const res = await handle(new Request(BASE + path, { method, headers: { 'x-forwarded-for': `198.18.77.${(ipN++ % 250) + 1}`, ...headers }, body }), db, c);
  const text = res.body ? await res.text() : '';
  return { status: res.status, headers: res.headers, text };
};
const AGENT = (accept) => ({ 'user-agent': 'proof-agent/1.0', accept });

// ------------------------------------------------------------------ reading a page: its title, its words, its numbers, its links
const ent = (s) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
const titleOf = (h) => ent((/<title>([\s\S]*?)<\/title>/.exec(h) || [])[1] || '');
const descOf = (h) => ent((/<meta name="description" content="([^"]*)"/.exec(h) || [])[1] || '');
const mainOf = (h) => (/<main id="main">([\s\S]*)<\/main>/.exec(h) || /<main>([\s\S]*)<\/main>/.exec(h) || [])[1] || '';
// the words a guide itself says: its main part without the frame the skin sets around it (the depth, the scene, the way
// on) and without code (a line to copy is an example, not a claim)
const proseOf = (h) => ent(mainOf(h).replace(/<p class="depth">[\s\S]*?<\/p>/, ' ').replace(/<a class="next"[\s\S]*?<\/a>/, ' ').replace(/<div class="scene[\s\S]*?<\/div>/, ' ')
  .replace(/<ol class="beats"[\s\S]*?<\/ol>/, ' ').replace(/<(script|style|pre|code)\b[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
// the same words with the inline code kept (a claim may name a setting in code: MARE_COMPRESS_MIN_CHARS (2,000))
const textOf = (h) => ent(mainOf(h).replace(/<p class="depth">[\s\S]*?<\/p>/, ' ').replace(/<a class="next"[\s\S]*?<\/a>/, ' ').replace(/<(script|style|pre)\b[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
// a figure: digits not glued to a letter, a hyphen or a slash (o200k_base, UTF-8, x402, e1-…, and days, which are read
// apart, are no figures here); 1,000 and 3.66 are one figure each
const numbersIn = (t0) => {
  const t = String(t0).replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' '), out = [];
  for (const m of t.matchAll(/(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?/g)) {
    const i = m.index, j = i + m[0].length, before = t[i - 1] || ' ', after = t[j] || ' ', next = t[j + 1] || ' ';
    if (/[\w\-/]/.test(before) || (before === '.' && /\d/.test(t[i - 2] || ''))) continue;
    if (/[\w\-/]/.test(after) || ((after === '.' || after === ',') && /\d/.test(next))) continue;
    out.push((m[1] + (m[2] || '')).replace(/,/g, ''));
  }
  return out;
};
const datesIn = (t) => [...t.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g)].map((m) => m[1]);
const hrefsOf = (h) => [...mainOf(h).matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)].map((m) => ent(m[1]));
const en = (x) => Number(x).toLocaleString('en-US');
const fewer = (a, b) => Math.round((1 - a / b) * 1000) / 10;

// ------------------------------------------------------------------ the sources, read here on their own
const newest = (re) => readdirSync(join(ROOT, 'proof')).filter((f) => re.test(f)).sort().pop();
const BENCH = JSON.parse(rd(`proof/${newest(/^engine-\d{4}-\d{2}-\d{2}\.json$/)}`));
const PROOF = JSON.parse(rd(`proof/${newest(/^bench-\d{4}-\d{2}-\d{2}\.json$/)}`));
const BT = BENCH.summary.totals.o200k_base, BM = BENCH.mcp, PS = PROOF.summary, PR = PS.reading.o200k_base;
const PY = rd('integrations/gateways/litellm_mare_compress.py'), TS = rd('integrations/gateways/vercel-ai-mare-compress.ts');
const pyDefault = (env) => Number((new RegExp(`"${env}", ([0-9.]+)`).exec(PY) || [])[1]);
const GW = { minChars: pyDefault('MARE_COMPRESS_MIN_CHARS'), timeoutS: pyDefault('MARE_COMPRESS_TIMEOUT'), maxTexts: pyDefault('MARE_COMPRESS_MAX_TEXTS'), remember: Number((/remember=(\d+)/.exec(PY) || [])[1]),
  tsMinChars: Number((/minChars = opts\.minChars \?\? (\d+)/.exec(TS) || [])[1]), tsTimeoutMs: Number((/timeoutMs = opts\.timeoutMs \?\? (\d+)/.exec(TS) || [])[1]), tsMaxTexts: Number((/maxTexts = opts\.maxTexts \?\? (\d+)/.exec(TS) || [])[1]), tsRemember: Number((/\((\d+) texts, by SHA-256/.exec(TS) || [])[1]) };
const PRESS = rd('node/press.mjs'), VERS = createVersions().stats(), TF = tollFacts(BASE), CU = compressUse(BASE);
// fields=: what fieldsOf does at its edges
const depth = (t) => { let d = 0, node = t; while (node instanceof Map) { d++; node = [...node.values()][0]; } return d; };
const FIELDS = { paths: fieldsOf(Array.from({ length: 100 }, (_, i) => `f${i}`).join(',')).size, steps: depth(fieldsOf(Array.from({ length: 20 }, (_, i) => `s${i}`).join('.'))),
  chars: (() => { for (let c = 1990; c <= 2010; c++) { const spec = `${'x'.repeat(c - 1)},y`; if (!fieldsOf(spec).has('y')) return c; } return null; })() };
// the statuses the code answers with (a figure such as 413 on a guide is one the node gives)
const STATUSES = new Set([...PRESS.matchAll(/fail\((\d{3}),/g)].map((m) => m[1]).concat(/status: 304/.test(PRESS) ? ['304'] : []));
const quoteNums = (...texts) => texts.flatMap((t) => numbersIn(String(t)));
const S = {
  engine: [BENCH.fixtures.length, BT.toonSmallerIn.length, BT.ruleIn.length, BT.rule, BT.sent, BT.toon, Math.round(BENCH.toonRule.minSaving * 100), fewer(BT.rule, BT.sent), Math.abs(fewer(BT.toon, BT.sent))],
  mcp: [BM.full.tools, BM.lean.tools, BM.full.bytes, BM.lean.bytes, ...['o200k_base', 'cl100k_base', 'claude-legacy'].flatMap((k) => [BM.full.tokens[k], BM.lean.tokens[k]]), BM.full.tokens.o200k_base - BM.lean.tokens.o200k_base, fewer(BM.lean.tokens.o200k_base, BM.full.tokens.o200k_base)],
  proof: [PS.measured, PR.html.median, PR.text.median, PR.markdown.median, PS.times.o200k_base.htmlPerMarkdown],
  ratios: [BENCH.summary.ratios.o200k_base.sent, BENCH.summary.ratios.o200k_base.toon],
  delta: [TOLL_EXAMPLE.page, TOLL_EXAMPLE.saved, TOLL_EXAMPLE.page - TOLL_EXAMPLE.saved, VERS.hours, VERS.maxBytes / (1024 * 1024), SQUEEZE.diffEdits],
  toll: quoteNums(TF.line, TF.example),
  squeeze: [SQUEEZE.maxBytes / (1024 * 1024), SQUEEZE.jsonDepth, SQUEEZE.minBudget, SQUEEZE.timeMs / 1000],
  quotes: quoteNums(CACHING, ENGINE_RULES.measuring, ENGINE_RULES.apart, ENGINE_RULES.privacy, ...CU.lossless, CU.for, ...SOURCES.map((x) => x.what)),
  toon: [Math.round(TOON_MIN_GAIN * 100)],
  fields: [FIELDS.paths, FIELDS.steps, FIELDS.chars],
  gateway: [GW.minChars, GW.timeoutS, GW.maxTexts, GW.remember, GW.tsTimeoutMs],
  statuses: [...STATUSES],
  openapi: [readerOpenApi(BASE).openapi.slice(0, 3)],
  // the figure in the name of a guide ("Read a web page again for 51 tokens"), which every guide lists under "More guides"
  names: [TOLL_EXAMPLE.page - TOLL_EXAMPLE.saved],
};
// which sources each page may draw a figure from
const MAY = {
  '/guides': ['openapi', 'delta', 'statuses'],
  '/guides/cut-llm-token-costs': ['engine', 'mcp', 'proof', 'ratios', 'delta', 'toll', 'squeeze', 'quotes', 'statuses', 'toon'],
  '/guides/lean-mcp-tool-list': ['mcp', 'quotes', 'toon', 'gateway'],
  '/guides/read-a-page-again': ['delta', 'toll', 'statuses'],
  '/guides/only-the-fields-you-need': ['fields', 'toon'],
  '/guides/compress-litellm-vercel-ai-sdk': ['gateway', 'squeeze', 'quotes', 'toll', 'statuses', 'openapi'],
};
const allowedFor = (p) => new Set([...MAY[p], 'names'].flatMap((k) => S[k].map((x) => String(x).replace(/,/g, ''))));
const DATES = new Set([BENCH.date, PROOF.date, PLUG_CHECKED]);

// ------------------------------------------------------------------ the pages, as the node serves them
const PATHS = G.GUIDE_PATHS, pages = {};
for (const p of PATHS) pages[p] = await call(p);
const LAW = [['/withdraw-contract', 'Withdraw from contract'], ['/cancel-contracts', 'Cancel contracts here']];

console.log('the guides answer as pages of the sea');
await proof(`the ${PATHS.length} guide pages (the index and five guides) answer 200 as English HTML, with their canonical address, one h1, the foot and both buttons of the law`, async () => {
  assert.equal(PATHS.length, 6); assert.deepEqual(PATHS.slice(1), G.GUIDE_SLUGS.map((s) => `/guides/${s}`));
  for (const p of PATHS) {
    const r = pages[p]; assert.equal(r.status, 200, p); assert.match(r.headers.get('content-type') || '', /^text\/html/, p);
    assert.match(r.text, /<html[^>]* lang="en"/, `${p}: English`); assert.ok(r.text.includes(`<link rel="canonical" href="${BASE}${p}">`), `${p}: canonical`);
    assert.equal((mainOf(r.text).match(/<h1\b/g) || []).length, 1, `${p}: one h1`); assert.doesNotMatch(r.text, /<meta name="robots"[^>]*noindex/, `${p}: indexable`); assert.equal(r.headers.get('x-robots-tag'), null, `${p}: no x-robots-tag`);
    const foot = (/<footer id="foot">([\s\S]*?)<\/footer>/.exec(r.text) || [])[1] || ''; assert.ok(foot, `${p}: the foot`);
    for (const [href, words] of LAW) assert.ok(foot.includes(`<a href="${href}"><strong>${words}</strong></a>`), `${p}: the foot lacks “${words}”`);
  }
  assert.equal((await call('/guides/no-such-guide')).status, 404, 'an unknown guide is not there');
});
await proof('titles and descriptions are unique: among the guides and against every other hub of the sea', async () => {
  const seen = new Map();
  for (const p of HUB_PATHS) {
    if (p === '/') continue;
    const r = PATHS.includes(p) ? pages[p] : await call(p); if (r.status !== 200 || !/^text\/html/.test(r.headers.get('content-type') || '')) continue;
    for (const [k, v] of [['title', titleOf(r.text)], ['description', descOf(r.text)]]) { const key = `${k}:${v.trim().toLowerCase()}`; if (PATHS.includes(p)) { assert.ok(v.length >= 30, `${p}: a ${k} of ${v.length} characters`); assert.ok(!seen.has(key), `${p}: its ${k} is also the ${k} of ${seen.get(key)}`); } seen.set(key, seen.get(key) || p); }
  }
  for (const p of PATHS) { assert.ok(titleOf(pages[p].text).length <= 100, `${p}: title of ${titleOf(pages[p].text).length}`); assert.ok(descOf(pages[p].text).length <= 300, `${p}: description of ${descOf(pages[p].text).length}`); }
});
await proof('structured data: every guide a TechArticle with its headline and address, the index a CollectionPage listing the five; a breadcrumb and the organisation on each', () => {
  for (const p of PATHS) {
    const lds = [...pages[p].text.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1])); assert.equal(lds.length, 1, p);
    const g = lds[0]['@graph']; assert.ok(Array.isArray(g), p); const by = (t) => g.find((x) => x['@type'] === t);
    assert.ok(by('Organization') && by('BreadcrumbList'), p);
    if (p === '/guides') { const c = by('CollectionPage'); assert.equal(c.url, `${BASE}/guides`); assert.deepEqual(c.mainEntity.itemListElement.map((x) => x.url), PATHS.slice(1).map((x) => BASE + x)); continue; }
    const a = by('TechArticle'); assert.ok(a, p); assert.equal(a.url, BASE + p); assert.equal(a.headline, ent((/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(pages[p].text) || [])[1]), p); assert.equal(a.description, descOf(pages[p].text), p);
  }
});

console.log('every number a guide says, found in its source');
await proof('every figure in the words of each guide is one its sources hold (the code examples aside); nothing else', () => {
  for (const p of PATHS) {
    const ok = allowedFor(p), got = numbersIn(proseOf(pages[p].text)), stray = [...new Set(got.filter((x) => !ok.has(x)))];
    assert.deepEqual(stray, [], `${p}: figures without a source: ${stray.join(', ')}`);
    for (const d of datesIn(proseOf(pages[p].text))) assert.ok(DATES.has(d), `${p}: the day ${d} is no day of a source`);
  }
});
await proof('the claims, each with the figure of its source: the lean tool list, the page read again, the bench of TOON, the proof of function, the gateways, the limits', () => {
  const T = (p) => textOf(pages[p].text), lean = BM.lean.tokens.o200k_base, full = BM.full.tokens.o200k_base;
  assert.ok(titleOf(pages['/guides/lean-mcp-tool-list'].text).includes(`a tool list of ${en(lean)} tokens instead of ${en(full)}`));
  for (const w of [`${en(BM.full.tools)}`, `${en(BM.full.bytes)}`, `${en(BM.lean.bytes)}`, `${en(full - lean)} tokens fewer on every model call`, `${fewer(lean, full)} % fewer`]) assert.ok(T('/guides/lean-mcp-tool-list').includes(w), `lean: ${w}`);
  const read = TOLL_EXAMPLE.page - TOLL_EXAMPLE.saved;
  assert.ok(titleOf(pages['/guides/read-a-page-again'].text).startsWith(`Read a web page again for ${en(read)} tokens`));
  for (const w of [`a page of ${en(TOLL_EXAMPLE.page)} tokens read again costs ${en(read)} tokens`, `(${en(TOLL_EXAMPLE.saved)} saved)`, `${en(VERS.hours)} hours in memory`, `at most ${en(VERS.maxBytes / 1048576)} MB`, TF.example, TF.line]) assert.ok(T('/guides/read-a-page-again').includes(w), `read again: ${w.slice(0, 60)}`);
  const cut = T('/guides/cut-llm-token-costs');
  for (const w of [`On ${BENCH.fixtures.length} real answers (bench of ${BENCH.date})`, `${en(BT.rule)} tokens instead of ${en(BT.sent)} (${fewer(BT.rule, BT.sent)} % fewer)`, `${en(BT.toon)} (${Math.abs(fewer(BT.toon, BT.sent))} % more)`, `for ${BT.ruleIn.length} (${BT.ruleIn.join(', ')})`,
    `(${en(PS.measured)} pages, measured ${PROOF.date}, o200k_base)`, `took ${en(PR.html.median)} tokens as raw HTML, ${en(PR.markdown.median)} as the Markdown of the sea's reader and ${en(PR.text.median)} as plain text`, `${PS.times.o200k_base.htmlPerMarkdown} times the tokens`,
    `${en(lean)} tokens instead of ${en(full)}`, `holds ${BENCH.summary.ratios.o200k_base.sent} UTF-8 bytes of JSON and ${BENCH.summary.ratios.o200k_base.toon} of TOON`, TF.line, ENGINE_RULES.measuring, ENGINE_RULES.apart, CACHING]) assert.ok(cut.includes(w), `cut: ${w.slice(0, 70)}`);
  const gw = T('/guides/compress-litellm-vercel-ai-sdk');
  assert.ok(GW.minChars === GW.tsMinChars && GW.maxTexts === GW.tsMaxTexts && GW.timeoutS * 1000 === GW.tsTimeoutMs && GW.remember === GW.tsRemember, 'the two gateway files agree');
  assert.deepEqual({ minChars: G.GATEWAY.minChars, timeoutS: G.GATEWAY.timeoutS, maxTexts: G.GATEWAY.maxTexts, remember: G.GATEWAY.remember }, { minChars: GW.minChars, timeoutS: GW.timeoutS, maxTexts: GW.maxTexts, remember: GW.remember }, 'GATEWAY is what the files set');
  for (const w of [`MARE_COMPRESS_MIN_CHARS (${en(GW.minChars)})`, `MARE_COMPRESS_TIMEOUT (${en(GW.timeoutS)} seconds per text)`, `MARE_COMPRESS_MAX_TEXTS (${en(GW.maxTexts)} texts per request)`, `timeoutMs (${en(GW.tsTimeoutMs)})`, `remembers ${en(GW.remember)} answers`, `up to ${SQUEEZE.maxBytes / 1048576} MB (413 above)`, `at most ${SQUEEZE.jsonDepth} levels`, ENGINE_RULES.privacy, ...CU.lossless]) assert.ok(gw.includes(w), `compress: ${w.slice(0, 60)}`);
  assert.deepEqual(G.FIELDS_LIMITS, FIELDS, 'FIELDS_LIMITS is what fieldsOf does');
  for (const w of [`At most ${FIELDS.paths} paths of at most ${FIELDS.steps} steps each, read from the first ${en(FIELDS.chars)} characters`]) assert.ok(T('/guides/only-the-fields-you-need').includes(w), `fields: ${w}`);
});
await proof('no superlative and no comparison with anyone else, on the guides, their Markdown and llms.txt', async () => {
  // (a format against a format, "20 % smaller than compact JSON", is a measurement; a product against others is not said)
  const BAD = /\b(best|fastest|cheapest|leading|unmatched|unbeatable|revolutionary|game.?changing|world.?s (first|only)|state.of.the.art|number one|most (advanced|complete|powerful|efficient))\b|#1\b|\b(better|faster|cheaper|leaner|smaller|more accurate) than (any|every|all|other|others|the rest|competitors?|alternatives?)\b|\bunlike (other|others|competitors?|any)\b/i;
  const RIVALS = /\b(jina|firecrawl|tavily|exa\.ai|scrapingbee|apify|browserbase|diffbot|crawl4ai)\b/i;
  for (const p of PATHS) { const t = proseOf(pages[p].text); assert.doesNotMatch(t, BAD, p); assert.doesNotMatch(t, RIVALS, p); const md = (await call(`${p}.md`, { headers: AGENT('*/*') })).text; assert.doesNotMatch(md, BAD, `${p}.md`); }
  const sec = /## Guides for developers\n\n([\s\S]*?)\n## /.exec(SITE['/llms.txt'].body)?.[1] || ''; assert.doesNotMatch(sec, BAD); assert.doesNotMatch(sec, RIVALS);
});

console.log('links, anchors and the Markdown twins');
await proof('every local link of every guide answers on a local node, and every anchor is there; other links are https to the documentation the engine room names', async () => {
  const known = new Map(), anchorsOf = async (path) => { if (!known.has(path)) known.set(path, await call(path)); return known.get(path); };
  const hosts = new Set(['github.com', ...[...rd('node/engine-ui.mjs').matchAll(/'https:\/\/([a-z0-9.-]+)\//g)].map((m) => m[1])]);
  let local = 0, outside = 0;
  for (const p of PATHS) for (const href of hrefsOf(pages[p].text)) {
    if (/^https?:\/\//.test(href) && !href.startsWith(BASE)) { const u = new URL(href); assert.equal(u.protocol, 'https:', href); assert.ok(hosts.has(u.hostname), `${p}: a link to ${u.hostname}, which the engine room does not name`); outside++; continue; }
    const rel = href.startsWith(BASE) ? href.slice(BASE.length) || '/' : href, [path, anchor] = rel.split('#');
    assert.ok(path.startsWith('/'), `${p}: ${href}`);
    const r = await anchorsOf(path); assert.equal(r.status, 200, `${p} links ${path}: ${r.status}`); local++;
    if (anchor) assert.ok(r.text.includes(`id="${anchor}"`), `${p} links ${path}#${anchor}: no such anchor`);
  }
  assert.ok(local >= 40 && outside >= 10, `${local} local links, ${outside} outside`);
});
await proof('each guide has its Markdown twin (.md and Accept: text/markdown): the same title and figures, the HTML as canonical, not indexed as a copy', async () => {
  for (const p of PATHS) {
    const t = await call(`${p}.md`, { headers: AGENT('*/*') }), a = await call(p, { headers: AGENT('text/markdown') }), title = titleOf(pages[p].text);
    for (const [r, what] of [[t, '.md'], [a, 'Accept']]) { assert.equal(r.status, 200, `${p} ${what}`); assert.match(r.headers.get('content-type') || '', /^text\/markdown/, `${p} ${what}`); assert.ok(r.text.startsWith(`# ${title}\n`), `${p} ${what}: starts with its title`); assert.doesNotMatch(r.text, /<(div|script|style)\b/, `${p} ${what}`); }
    assert.match(t.headers.get('x-robots-tag') || '', /noindex/, `${p}.md is no copy for the search engines`); assert.ok((t.headers.get('link') || '').includes(`<${BASE}${p}>; rel="canonical"`), `${p}.md names the HTML`);
  }
  const twin = (p) => call(`${p}.md`, { headers: AGENT('*/*') });
  const lean = (await twin('/guides/lean-mcp-tool-list')).text; for (const w of [en(BM.lean.tokens.o200k_base), en(BM.full.tokens.o200k_base), 'claude mcp add --transport http mare-lean']) assert.ok(lean.includes(w), w);
  const again = (await twin('/guides/read-a-page-again')).text; for (const w of [en(TOLL_EXAMPLE.page - TOLL_EXAMPLE.saved), 'If-None-Match', 'since=']) assert.ok(again.includes(w), w);
});

console.log('where the search engines and the agents find them');
await proof('the hub sitemap names every guide once, live (undated until the sea sees a change); site.xml names none of them and names /openapi/reader.json', async () => {
  const x = (await call('/sitemaps/hubs.xml', { headers: AGENT('application/xml') })).text;
  for (const p of PATHS) { assert.equal(x.split(`<loc>${BASE}${p}</loc>`).length, 2, `${p} once in hubs.xml`); assert.ok(HUBS.some(([h, , live]) => h === p && live === 1), `${p}: a live hub`); assert.ok(x.includes(`<loc>${BASE}${p}</loc><changefreq>`), `${p}: no day before the sea saw it`); }
  const site = (await call('/sitemaps/site.xml', { headers: AGENT('application/xml') })).text;
  assert.ok(site.includes(`<loc>${BASE}/openapi/reader.json</loc>`)); for (const p of PATHS) assert.ok(!site.includes(`<loc>${BASE}${p}</loc>`), `${p} stands only in hubs.xml`);
});
await proof('the daily IndexNow batch carries every guide among the hubs and /openapi/reader.json among the pages that list; nothing else leaves the node', async () => {
  indexNowBody = null; const out = await indexNowDaily(db, BASE, db.flow, { indexnowKey: 'proofkey0123456789', kv: memoryKv() });
  assert.equal(out.status, 202); const paths = indexNowBody.urlList.map((u) => u.slice(BASE.length) || '/');
  for (const p of PATHS) assert.ok(paths.indexOf(p) >= 0 && paths.indexOf(p) < HUB_PATHS.length, `${p} among the hubs`);
  const at = paths.indexOf('/openapi/reader.json'); assert.ok(at >= HUB_PATHS.length, 'the OpenAPI document among the pages that list'); assert.equal(paths[at - 1], '/openapi.json', 'beside /openapi.json');
});
await proof('llms.txt: a section "Guides for developers" with each guide and the OpenAPI document; its figures are the sources\'; "Every door" names /openapi/reader.json', () => {
  const l = SITE['/llms.txt'].body, sec = /## Guides for developers\n\n([\s\S]*?)\n## /.exec(l)?.[1]; assert.ok(sec, 'the section');
  for (const p of [...PATHS, '/openapi/reader.json']) assert.ok(sec.includes(`(${BASE}${p})`) || sec.includes(`${BASE}${p}\n`), p);
  assert.equal(sec.split('\n').filter((x) => x.startsWith('- ')).length, 6);
  const ok = new Set([...S.mcp, ...S.delta, ...S.openapi, ...S.statuses].map(String)); for (const x of numbersIn(sec)) assert.ok(ok.has(x), `llms.txt guides: ${x} has no source`);
  assert.ok(sec.includes(`again for ${TOLL_EXAMPLE.page - TOLL_EXAMPLE.saved} tokens`) && sec.includes(`${BM.lean.tools} tools instead of ${BM.full.tools}`));
  assert.match(l, /\n- OpenAPI 3\.1 of the reader[^\n]*: \/openapi\/reader\.json/);
});
await proof('/open lists /openapi/reader.json among the doors that answer as data; /engine links the guides', async () => {
  assert.ok(ENDPOINTS.some(([, list]) => list.some(([p]) => p === '/openapi/reader.json')));
  assert.ok((await call('/engine')).text.includes('<a href="/guides">/guides</a>'));
});

console.log('the reader and /compress as OpenAPI 3.1');
const OA = await call('/openapi/reader.json', { headers: AGENT('application/json') }), spec = JSON.parse(OA.text);
await proof('/openapi/reader.json answers JSON: OpenAPI 3.1.0, the node\'s version and address, operations with unique ids and responses, every $ref resolves, every path parameter declared', () => {
  assert.equal(OA.status, 200); assert.match(OA.headers.get('content-type'), /^application\/json/); assert.equal(OA.headers.get('access-control-allow-origin'), '*');
  assert.equal(spec.openapi, '3.1.0'); assert.equal(spec.info.version, VERSION); assert.deepEqual(spec.servers, [{ url: BASE }]); assert.ok(spec.info.title && spec.info.description);
  const ids = [];
  for (const [path, item] of Object.entries(spec.paths)) for (const [m, op] of Object.entries(item)) {
    assert.ok(['get', 'head', 'post'].includes(m), `${path} ${m}`); assert.ok(op.operationId && op.responses && Object.keys(op.responses).length, `${path} ${m}`); ids.push(op.operationId);
    for (const name of [...path.matchAll(/\{([^}]+)\}/g)].map((x) => x[1])) assert.ok((op.parameters || []).some((q) => q.in === 'path' && q.name === name && q.required), `${path} ${m}: {${name}} declared`);
    for (const [code] of Object.entries(op.responses)) assert.match(code, /^[1-5]\d\d$/, `${path} ${m}: ${code}`);
  }
  assert.equal(new Set(ids).size, ids.length, 'unique operation ids');
  const refs = []; const walk = (v) => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (k === '$ref') refs.push(x); else walk(x); } }; walk(spec);
  for (const r of refs) { const at = r.replace(/^#\//, '').split('/').reduce((o, k) => o?.[k], spec); assert.ok(r.startsWith('#/') && at, `$ref ${r}`); }
  assert.deepEqual(Object.keys(spec.paths).sort(), ['/compress', '/r/{address}', '/read'].sort());
});
await proof('the doors it names answer as it says on a local node: the reader with ETag, since= (one line when unchanged), If-None-Match (304) and its headers; /compress with 200, 400, 405, 413 and 503 at rest', async () => {
  const r = await call(`/r/${PAGE_URL}`, { headers: AGENT('text/markdown') }); assert.equal(r.status, 200, r.text.slice(0, 200)); const etag = r.headers.get('etag'); assert.match(etag || '', /^W\/"e1-[0-9a-f]{20}"$/); assert.ok(r.headers.get('x-sea-delta'));
  const tag = etag.slice(3, -1), again = await call(`/r/${PAGE_URL}?since=${tag}`, { headers: AGENT('text/markdown') });
  assert.equal(again.status, 200); assert.match(again.text, /^Unchanged since e1-/); assert.equal(again.text.trim().split('\n').length, 1, 'one line'); assert.equal(again.headers.get('x-sea-engine'), 'delta');
  // the guide's figure is the toll's example; a short address like this one is answered in at most that many tokens
  assert.ok(tokensOf('md', again.text) <= TOLL_EXAMPLE.page - TOLL_EXAMPLE.saved, `the unchanged line takes ${tokensOf('md', again.text)} tokens`);
  const nm = await call(`/r/${PAGE_URL}`, { headers: { ...AGENT('text/markdown'), 'if-none-match': etag } }); assert.equal(nm.status, 304); assert.equal(nm.text, '');
  const viaRead = await call(`/read?url=${encodeURIComponent(PAGE_URL)}&since=${tag}`, { headers: AGENT('text/markdown') }); assert.equal(viaRead.status, 200); assert.match(viaRead.text, /^Unchanged since e1-/, '/read takes since= as well');
  for (const h of Object.keys(spec.paths['/r/{address}'].get.responses[200].headers)) assert.ok(/^(ETag|x-sea-(delta|engine|engine-tokens|engine-saved|engine-lossy|toll))$/.test(h) && (h === 'ETag' || h === 'x-sea-delta' || PRESS.includes(h) || TOLL_EXPOSE.includes(h) || rd('node/engine.mjs').includes(`'${h}'`)), `header ${h} is one the code sends`);
  const post = (body, headers = { 'content-type': 'application/json' }, c = cfg) => call('/compress', { method: 'POST', headers: { ...AGENT('application/json'), ...headers }, body, c });
  const ok = await post(JSON.stringify({ html: `<main><h1>Prices</h1>${'<p>The same line of text, said again and again in this page.</p>'.repeat(30)}</main>` })); assert.equal(ok.status, 200); const j = JSON.parse(ok.text);
  for (const k of spec.components.schemas.CompressResult.required) assert.ok(k in j, `the answer has ${k}`); for (const k of Object.keys(j)) assert.ok(k in spec.components.schemas.CompressResult.properties, `the schema names ${k}`);
  assert.equal((await post('')).status, 400); assert.equal((await call('/compress', { method: 'PUT', headers: AGENT('application/json'), body: 'x' })).status, 405);
  assert.equal((await post('x'.repeat(SQUEEZE.maxBytes + 1), { 'content-type': 'text/plain' })).status, 413); assert.equal((await post('{"text":"a"}', undefined, { ...cfg, engine: 'off' })).status, 503);
  const named = Object.keys(spec.paths['/compress'].post.responses); for (const code of named) assert.ok(code === '200' || code === '402' || STATUSES.has(code), `/compress ${code}: the code answers it`);
  for (const p of spec.paths['/compress'].post.parameters.filter((x) => x.in === 'query')) assert.ok(PRESS.includes(`sp.get('${p.name}')`), `/compress reads ${p.name}`);
  for (const k of Object.keys(spec.components.schemas.CompressRequest.properties)) assert.ok(/const ENVELOPE = new Set\(\[([^\]]*)\]\)/.exec(PRESS)[1].includes(`'${k}'`), `the envelope takes ${k}`);
});
await proof('the scrape placeholder is in step with the node: a door it does not answer stands only under x-mare-placeholder, never under paths', async () => {
  const ph = spec['x-mare-placeholder']?.scrape, tag = spec.tags.find((t) => t.name === 'scrape');
  for (const p of SCRAPE_PATHS) {
    const r = await call(p, { method: 'POST', headers: { ...AGENT('application/json'), 'content-type': 'application/json' }, body: JSON.stringify({ url: PAGE_URL, formats: ['markdown'] }) });
    if (r.status === 404) { assert.ok(!(p in spec.paths), `${p} is not served: it must not stand under paths`); assert.ok(ph?.paths?.includes(p), `${p}: the placeholder names it`); assert.match(tag?.description || '', /PLACEHOLDER/); assert.match(ph.status, /not served/); }
    else { assert.ok(p in spec.paths && spec.paths[p].post, `${p} answers ${r.status}: it must stand under paths`); assert.ok(!ph?.paths?.includes(p), `${p} is served: the placeholder must go`); }
  }
  assert.deepEqual(SCRAPE_PATHS, ['/v1/scrape', '/v2/scrape']); assert.match(rd('node/readerapi.mjs'), /PLACEHOLDER/);
});

console.log('the app door');
await proof('initialize (two protocol versions) and tools/list of /mcp/app are byte for byte the bodies of tools/app-door-3.32.0.json', async () => {
  const FIX = JSON.parse(rd('tools/app-door-3.32.0.json'));
  const norm = (body, v) => body.replace(`"serverInfo":{"name":"mare-liberum","title":"Mare Liberum","version":"${v}"}`, '"serverInfo":{"name":"mare-liberum","title":"Mare Liberum","version":"<node>"}');
  for (const [k, msg] of Object.entries(FIX.calls)) {
    const r = await call('/mcp/app', { method: 'POST', headers: { accept: 'application/json, text/event-stream', 'content-type': 'application/json', 'user-agent': 'reach-pages-proof/1.0' }, body: JSON.stringify(msg), c: { base: BASE, site: {} } });
    assert.equal(r.status, 200, k); assert.equal(norm(r.text, VERSION), norm(FIX.bodies[k].body, FIX.version), `${k} of /mcp/app differs`);
  }
});
await proof('package.json runs this proof as proof:reach-pages', () => assert.equal(JSON.parse(rd('package.json')).scripts['proof:reach-pages'], 'node tools/reach-pages-proof.mjs'));

rmSync(dir, { recursive: true, force: true });
console.log(`\n${passed} proofs held, ${failed} failed`);

// ------------------------------------------------------------------ negative controls: each rule broken in a copy, the proof must fail there
const BREAK = [
  ['a figure off its source (the page read again says 52)', 'node/guides.mjs', 'costs <b>${n(D.read)}</b> tokens: the one line', 'costs <b>${n(D.read + 1)}</b> tokens: the one line'],
  ['a figure nobody measured (up to 90 %)', 'node/guides.mjs', 'Six levers of the open sea spare some of them.', 'Six levers of the open sea spare up to 90 % of them.'],
  ['a superlative', 'node/guides.mjs', "h1: 'Lean MCP door: a smaller tool list',", "h1: 'Lean MCP door: the best tool list',"],
  ['a comparison with someone else', 'node/guides.mjs', 'No account, no key.</p>\n<h2>First: what a page costs</h2>', 'No account, no key, and cheaper than Firecrawl.</p>\n<h2>First: what a page costs</h2>'],
  ['two guides with one title', 'node/guides.mjs', "title: () => 'Only the fields you need: fields= on any JSON answer for AI agents | Mare Liberum',", "title: () => 'Cut the LLM token costs of an AI agent: six levers, measured | Mare Liberum',"],
  ['an anchor that is not there', 'node/guides.mjs', 'In the example of <a href="/engine#toll">/engine#toll</a>', 'In the example of <a href="/engine#tolls">/engine#toll</a>'],
  ['a link to a page that is not there', 'node/guides.mjs', 'More clients, each with an install button where it has one: <a href="/connect">/connect</a>.', 'More clients: <a href="/connects">/connect</a>.'],
  ['a guide left out of the hub sitemap and IndexNow', 'node/hubs.mjs', "['/guides/read-a-page-again', 'weekly', 1],", ''],
  ['no Markdown twin', 'node/agentmd.mjs', "const OWN_MD = /^\\/(skill|SKILL|learn)\\.md$|", "const OWN_MD = /^\\/guides\\/|^\\/(skill|SKILL|learn)\\.md$|"],
  ['a guide without the foot of the law', 'node/guides.mjs', 'return page(base, m.path, m.title, m.desc, body, article(base, m));', "return page(base, m.path, m.title, m.desc, body, article(base, m)).replace('<html lang=\"en\"', '<html data-look=\"own\" lang=\"en\"');"],
  ['the scrape doors claimed before they are served', 'node/readerapi.mjs', "      '/read': {\n", "      '/v1/scrape': { post: { operationId: 'scrapeV1', responses: { 200: { description: 'scraped' } } } },\n      '/read': {\n"],
  ['a status the code does not answer', 'node/readerapi.mjs', "            413: err(`The body is larger than ${mb} MB.`),", "            413: err(`The body is larger than ${mb} MB.`),\n            418: err('A teapot.'),"],
  ['the OpenAPI document out of the IndexNow lists', 'node/core.mjs', "'/openapi.json', '/openapi/reader.json', ", "'/openapi.json', "],
  ['llms.txt without the guides', 'site/llms.txt', '## Guides for developers\n', '## Guides\n'],
  ['a gateway default changed in its file, not on the page', 'integrations/gateways/litellm_mare_compress.py', '"MARE_COMPRESS_MIN_CHARS", 2000, int)', '"MARE_COMPRESS_MIN_CHARS", 3000, int)'],
  ['the bench measured again, the page still says the old figure', 'node/guides.mjs', 'mcp: M ? { date: bench.date, file: `/engine/bench-${bench.date}.json`, full: M.full, lean: M.lean,', 'mcp: M ? { date: bench.date, file: `/engine/bench-${bench.date}.json`, full: { ...M.full, tokens: { ...M.full.tokens, o200k_base: 9700 } }, lean: M.lean,'],
];
let caught = 0;
const control = ([what, f, from, to]) => new Promise((done) => {
  const tmp = mkdtempSync(join(tmpdir(), 'mare-guides-ctl-')), end = (line, ok) => { rmSync(tmp, { recursive: true, force: true }); if (ok) caught++; done(line); };
  try {
    for (const d of ['node', 'proof', 'config', 'integrations/gateways', 'site/llms.txt']) if (existsSync(join(ROOT, d))) { mkdirSync(dirname(join(tmp, d)), { recursive: true }); cpSync(join(ROOT, d), join(tmp, d), { recursive: true }); }
    mkdirSync(join(tmp, 'tools'), { recursive: true }); for (const t of ['reach-pages-proof.mjs', 'app-door-3.32.0.json']) cpSync(join(ROOT, 'tools', t), join(tmp, 'tools', t)); cpSync(join(ROOT, 'package.json'), join(tmp, 'package.json'));
    const src = readFileSync(join(tmp, f), 'utf8'); if (!src.includes(from)) return end(`  FAIL control "${what}": the line to break is gone from ${f}; the control needs updating`, false);
    writeFileSync(join(tmp, f), src.replace(from, to));
  } catch (e) { return end(`  FAIL control "${what}": ${e?.message}`, false); }
  const child = spawn(process.execPath, ['tools/reach-pages-proof.mjs', '--no-controls'], { cwd: tmp }); let out = '';
  const timer = setTimeout(() => child.kill('SIGKILL'), 180_000);
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
