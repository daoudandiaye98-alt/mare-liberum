// Mare Liberum · proof of the deal check inside a person's own assistant (3.69, "Das Meer im Assistenten"): /for/bots gives one
// sentence for Grok Bot, one tool block for the xAI API, the deal-check skill at a short address and a daily routine whose checks
// are counted apart. It proves, with the same shops, catalog, DNS and facilitator as the deal check's proof (no network):
//   page     /for/bots is a page whose heading and first sentence say what it gives; it holds the Grok Bot sentence word for word
//            and an xAI tool block that parses, points to the full server /mcp and allows only tools that server has; it
//            never gives the app door /mcp/app to paste; /for/bots.md says the same as Markdown of its own (not the HTML
//            turned into Markdown); /for/botsx is a 404
//   skill    /skills/deal-check/SKILL.md serves the same bytes as /.well-known/agent-skills/deal-check/SKILL.md, and is a 404
//            where the node has no deal-check skill
//   root     .mcp.json at the root of the repository points to https://mareliberum.dev/mcp; the plugin's own .mcp.json keeps the
//            app door
//   count    a deal check with via=bot-template counts once in today.checks and once in today.via_bot_template of GET /deal;
//            without via, with another via, or made for a crawler, it does not count in via_bot_template
//   told     llms.txt names /for/bots and the Grok Bot sentence; the sitemap of hubs names /for/bots; the guidance of
//            /openapi.json stays under 4,000 characters and does not grow for this page
// Negative controls at the end: each rule broken in a copy of the code, and this proof must fail there.
// Runs without the network: node tools/bots-proof.mjs   (exit code 1 when a proof fails or a control is not caught)
//   --no-controls   only the proofs (the controls run this file that way in each broken copy)
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, cpSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { Buffer } from 'node:buffer';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const k of ['MARE_TOLL', 'MARE_ENGINE', 'MARE_FAIR', 'MARE_X402_FACILITATOR', 'MARE_PAY_TO', 'MARE_ROUTE_PRICE_CENTS', 'MARE_STATE', 'MARE_DB_URL', 'MARE_DB_KEY', 'MARE_DB_SECRET', 'MARE_BASE_RPC', 'MARE_CATALOG_ID']) delete process.env[k];
process.env.MARE_VIA_SECRET = 'bots-proof-via-key, a test value';
let passed = 0, failed = 0;
const D = globalThis.Date; let T0 = D.parse('2026-11-27T09:00:00.000Z');
class Clock extends D { constructor(...a) { if (a.length) super(...a); else super(T0); } static now() { return T0; } }
globalThis.Date = Clock;
const proof = async (name, fn) => { T0 += 60_000; try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 6).join('\n       ')}`); } };
const imp = (f) => import(pathToFileURL(join(ROOT, 'node', f)).href);

// ------------------------------------------------------------------ the world: shops, the catalog, DNS, a facilitator
const FAC = 'https://facilitator.deal-proof.dev', CATALOG = 'https://catalog.shopify.com/api/ucp/mcp';
const productPage = ({ name = 'Trail Runner 3', brand = 'Example', price = '89.00', was = '129.00', cur = 'USD', avail = 'InStock', gtin = '0123456789012' } = {}) => `<!doctype html><html lang="en"><head><title>${name} · Shop</title><meta name="description" content="${name} by ${brand}">
<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'Product', name, brand: { '@type': 'Brand', name: brand }, ...(gtin ? { gtin13: gtin } : {}), offers: { '@type': 'Offer', price, priceCurrency: cur, availability: `https://schema.org/${avail}`, ...(was ? { priceSpecification: [{ '@type': 'UnitPriceSpecification', priceType: 'https://schema.org/StrikethroughPrice', price: was, priceCurrency: cur }] } : {}) } })}</script></head>
<body><main><h1>${name}</h1><p>The ${name} is a shoe for long trails, light and quick on rock and mud, made to last for many seasons of running.</p><p>Price: ${price} ${cur}</p></main></body></html>`;
let shopPrice = '89.00';
const PAGES = {
  'shop.deal-proof.dev/products/trail-runner-3': () => productPage({ price: shopPrice }),
  'shop.deal-proof.dev/products/pricey': () => productPage({ name: 'Summit Jacket 2', brand: 'Example', price: '199.00', was: null, gtin: '0999999999999' }),
  'shop.deal-proof.dev/products/sold-out': () => productPage({ name: 'Trail Runner 3', price: '79.00', was: null, avail: 'OutOfStock', gtin: null }),
  'shop.deal-proof.dev/about': () => '<!doctype html><html><head><title>About us</title></head><body><main><h1>About us</h1><p>We sell shoes for trails and mountains since 1990, from a small shop by the sea, and we answer every mail ourselves.</p></main></body></html>',
};
for (let i = 0; i < 110; i++) PAGES[`shop.deal-proof.dev/notes/${i}`] = () => `<!doctype html><html><head><title>Note ${i}</title></head><body><main><h1>Note ${i}</h1><p>A note about trail number ${i}: it climbs through the forest, crosses two rivers and ends at a hut where runners rest.</p></main></body></html>`;
const offer = (title, cents, cur, host, { available = true, name = null } = {}) => ({ title, price_range: { min: { amount: cents, currency: cur } }, variants: [{ price: { amount: cents, currency: cur }, availability: { available }, seller: { url: `https://${host}`, name: name || host }, url: `https://${host}/products/x`, checkout_url: `https://${host}/cart/c/1` }] });
const RUNNER = [
  offer('Example Trail Runner 3 Running Shoe', 7995, 'USD', 'another.deal-proof.dev', { name: 'Another Shop' }),
  offer('Example Trail Runner 3', 8500, 'USD', 'another.deal-proof.dev', { name: 'Another Shop' }),
  offer('Trail Runner 3', 8400, 'USD', 'third.deal-proof.dev', { name: 'Third Shop' }),
  offer('Example Trail Runner 3', 9900, 'USD', 'pricey.deal-proof.dev', { name: 'Pricey Shop' }),
  offer('Shoe bag for the Trail Runner 3', 900, 'USD', 'bags.deal-proof.dev'),
  offer('Example Trail Runner 2', 4900, 'USD', 'old.deal-proof.dev'),
  offer('Example Trail Runner 3', 6000, 'USD', 'empty.deal-proof.dev', { available: false }),
  offer('Example Trail Runner 3', 7000, 'EUR', 'euro.deal-proof.dev'),
  offer('Example Trail Runner 3', 7000, 'USD', 'shop.deal-proof.dev'),
  ...Array.from({ length: 12 }, (_, i) => offer('Example Trail Runner 3', 10000 + i * 100, 'USD', `s${i}.deal-proof.dev`, { name: `Store ${i}` })),
];
const catalogAsked = [];
const fac = []; let facilitator = null;
const answer = (j, status = 200) => new Response(JSON.stringify(j), { status, headers: { 'content-type': 'application/json' } });
globalThis.fetch = async (u, o = {}) => {
  const s = String(u?.url ?? u);
  if (s.startsWith(FAC)) { const kind = s.slice(FAC.length + 1), body = JSON.parse(o.body); fac.push({ kind, body }); if (!facilitator) throw new Error('the facilitator must not be asked'); return facilitator(kind, body); }
  if (s === CATALOG) {
    const q = String(JSON.parse(o.body)?.params?.arguments?.catalog?.query || ''); catalogAsked.push(q);
    const products = /trail runner 3/i.test(q) ? RUNNER : /summit jacket/i.test(q) ? [] : [];
    return answer({ jsonrpc: '2.0', id: 1, result: { structuredContent: { products } } });
  }
  const url = new URL(s);
  if (!url.hostname.endsWith('.deal-proof.dev')) throw new Error(`the proof does not use the network: ${s.slice(0, 80)}`);
  if (url.pathname === '/robots.txt') return new Response(url.hostname.startsWith('closed.') ? 'User-agent: *\nDisallow: /\n' : 'User-agent: *\nAllow: /\n', { status: 200, headers: { 'content-type': 'text/plain' } });
  const f = PAGES[`${url.hostname}${url.pathname}`];
  if (f) return new Response(f(), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
  return new Response('not here', { status: 404, headers: { 'content-type': 'text/plain' } });
};
createRequire(import.meta.url)('node:dns').promises.lookup = async () => [{ address: '93.184.216.34', family: 4 }];
for (const k of ['error', 'warn', 'info']) console[k] = () => {};
const PAYER = '0x2222222222222222222222222222222222222222';
const settles = () => (kind) => answer(kind === 'verify' ? { isValid: true, payer: PAYER } : { success: true, transaction: `0x${randomBytes(32).toString('hex')}`, network: 'eip155:8453', payer: PAYER });

// ------------------------------------------------------------------ the node
const BASE = 'https://mare.test', SITE = { '/llms.txt': { body: readFileSync(join(ROOT, 'site/llms.txt'), 'utf8'), type: 'text/plain; charset=utf-8' }, '/deal-check.md': { body: readFileSync(join(ROOT, 'site/deal-check.md'), 'utf8'), type: 'text/markdown; charset=utf-8' } };
const core = await imp('core.mjs'), { createMem } = await imp('mem.mjs'), { memoryKv } = await imp('flow.mjs');
const { immune } = await imp('immune.mjs'), { createLedger } = await imp('ledger.mjs'), { payConfig } = await imp('pay.mjs');
const dir = mkdtempSync(join(tmpdir(), 'mare-bots-')), file = join(dir, 'sea.tsv');
process.once('exit', () => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });
writeFileSync(file, ''); writeFileSync(join(dir, 'build.json'), JSON.stringify({ builtAt: '2026-11-20T10:00:00.000Z', entries: 0, lakes: {} }));
const db = createMem({ file, base: BASE }), kv = memoryKv(), ledger = createLedger({}), waits = [];
const PAY = { ...payConfig({}), facilitator: FAC, settleWaitMs: 300, verifyMs: 800, settleMs: 4000 };
const cfg = { base: BASE, kv, ledger, pay: PAY, site: SITE, waitUntil: (p) => { waits.push(p); }, creditSweepMs: 0 };
const call = async (path, { method = 'GET', accept = 'application/json', ip, headers = {}, body } = {}) => {
  const h = { accept, 'user-agent': 'deal-proof-agent/1.0', 'x-forwarded-for': ip, ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers };
  const res = await core.handle(new Request(BASE + path, { method, headers: h, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }), db, cfg);
  const text = res.body ? Buffer.from(await res.arrayBuffer()).toString('utf8') : ''; let j = null; try { j = JSON.parse(text); } catch {}
  return { status: res.status, h: Object.fromEntries(res.headers), text, j };
};
await call('/stats', { ip: '127.0.0.1' });
immune.set({ mode: 'normal', rest: [], pace: { perMinute: 1_000_000, burst: 1_000_000 } });
const WALLET = PAY.payTo, USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
let net = 0; const fresh = () => `198.51.100.${++net}`;
const RUN = encodeURIComponent('https://shop.deal-proof.dev/products/trail-runner-3');
const payment = ({ value = '10000', to = WALLET, version = 2, nonce = `0x${randomBytes(32).toString('hex')}` } = {}) => {
  const authorization = { from: PAYER, to, value: String(value), validAfter: '0', validBefore: String(Math.floor(T0 / 1000) + 300), nonce };
  const inner = { signature: `0x${'ab'.repeat(65)}`, authorization };
  const p = version === 2 ? { x402Version: 2, accepted: { scheme: 'exact', network: 'eip155:8453', amount: String(value), asset: USDC, payTo: to }, payload: inner } : { x402Version: 1, scheme: 'exact', network: 'base', payload: inner };
  return { [version === 2 ? 'payment-signature' : 'x-payment']: Buffer.from(JSON.stringify(p)).toString('base64') };
};
const required = (r) => JSON.parse(Buffer.from(r.h['payment-required'], 'base64').toString('utf8'));
const funnel = async () => (await call('/funnel.json', { ip: '127.0.0.1' })).j;



const { BOTS } = await imp('pages.mjs');
const unesc = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const GROK = `Add a custom MCP server called mare-liberum at ${BASE}/mcp`;
const TITLE = 'Put the deal check into your assistant', LEAD = 'One sentence for Grok Bot, one block for the xAI API, one routine that checks your saved product pages every day: free, no key, no account.';
const xaiOf = (text) => { const m = /\{[^{}\n]*"type":"mcp"[^{}\n]*\}/.exec(unesc(text)); assert.ok(m, 'an xAI tool block'); return JSON.parse(m[0]); };
const mcpTools = async (path) => { const r = await call(path, { method: 'POST', ip: '127.0.0.1', accept: 'application/json, text/event-stream', body: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} } }); const j = r.j || JSON.parse(/data: (.+)/.exec(r.text)[1]); return j.result.tools.map((t) => t.name); };
const today = async () => (await call('/deal', { ip: fresh() })).j.today;

console.log('page');
await proof('/for/bots says in its heading and first sentence what it gives, holds the Grok Bot sentence word for word and an xAI tool block for the full server', async () => {
  const r = await call(BOTS.path, { ip: fresh(), accept: 'text/html' }); assert.equal(r.status, 200); assert.match(r.h['content-type'], /^text\/html/);
  assert.ok(r.text.includes(`<h1>${TITLE}</h1>`), 'the heading'); assert.ok(new RegExp(`</h1>\\s*<p class="lead"[^>]*>${LEAD.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</p>`).test(r.text), 'the first sentence right after the heading');
  assert.ok(unesc(r.text).includes(GROK), 'the Grok Bot sentence'); assert.ok(/\bcustom MCP server\b/.test(r.text), 'with the word custom');
  const x = xaiOf(r.text); assert.equal(x.type, 'mcp'); assert.equal(x.server_url, `${BASE}/mcp`); assert.equal(x.server_label, 'mare_liberum'); assert.deepEqual(x.allowed_tools, ['ask', 'decide', 'read_page']);
  assert.ok(unesc(r.text).includes(`${BASE}/deal?url=<page>&via=${BOTS.via}`), 'the routine with its mark'); assert.ok(r.text.includes('VERIFIED on the store') && r.text.includes('UNVERIFIED'), 'the words people give their agents');
  assert.ok(r.text.includes('never pays'), 'who pays'); assert.ok(r.text.includes('<link rel="canonical"') || r.text.includes(`${BASE}${BOTS.path}`), 'its own address');
});
await proof('the tools the xAI block allows are tools of the full server /mcp', async () => {
  const names = await mcpTools('/mcp'), x = xaiOf((await call(BOTS.path, { ip: fresh(), accept: 'text/html' })).text);
  for (const t of x.allowed_tools) assert.ok(names.includes(t), `${t} on /mcp (${names.join(', ')})`);
});
await proof('/for/bots and its Markdown never give the app door /mcp/app to paste', async () => {
  for (const p of [BOTS.path, `${BOTS.path}.md`]) { const r = await call(p, { ip: fresh(), accept: p.endsWith('.md') ? 'text/markdown' : 'text/html' }); assert.equal(r.status, 200); assert.ok(!r.text.includes('/mcp/app'), p); }
});
await proof('/for/bots.md says the same as Markdown of its own, not the HTML turned into Markdown', async () => {
  const r = await call(`${BOTS.path}.md`, { ip: fresh(), accept: '*/*' }); assert.equal(r.status, 200); assert.match(r.h['content-type'], /^text\/markdown/);
  assert.ok(r.text.startsWith(`# ${TITLE}\n\n${LEAD}\n`), r.text.slice(0, 200)); assert.ok(r.text.includes(GROK)); assert.equal(xaiOf(r.text).server_url, `${BASE}/mcp`);
  assert.ok(r.text.includes(`Source: ${BASE}${BOTS.path}`));
});
await proof('/for/botsx and /for are 404', async () => {
  for (const p of ['/for/botsx', '/for', '/for/bots/x']) assert.equal((await call(p, { ip: fresh() })).status, 404, p);
});
console.log('skill');
await proof('/skills/deal-check/SKILL.md serves the same bytes as /.well-known/agent-skills/deal-check/SKILL.md', async () => {
  const a = await call('/skills/deal-check/SKILL.md', { ip: fresh(), accept: '*/*' }), b = await call('/.well-known/agent-skills/deal-check/SKILL.md', { ip: fresh(), accept: '*/*' });
  assert.equal(a.status, 200); assert.equal(b.status, 200); assert.match(a.h['content-type'], /^text\/markdown/); assert.equal(a.text, b.text); assert.match(a.text, /^---\nname: deal-check\n/);
});
await proof('a node without the deal-check skill answers 404 at its short address', async () => {
  const res = await core.handle(new Request(`${BASE}/skills/deal-check/SKILL.md`, { headers: { 'user-agent': 'deal-proof-agent/1.0', 'x-forwarded-for': fresh() } }), db, { ...cfg, site: { '/llms.txt': SITE['/llms.txt'] } });
  assert.equal(res.status, 404);
});
console.log('root');
await proof('.mcp.json at the root points to the full server; the plugin keeps the app door', async () => {
  const root = JSON.parse(readFileSync(join(ROOT, '.mcp.json'), 'utf8')), plug = JSON.parse(readFileSync(join(ROOT, 'plugins/mare-liberum/.mcp.json'), 'utf8'));
  assert.deepEqual(root, { mcpServers: { 'mare-liberum': { type: 'http', url: 'https://mareliberum.dev/mcp' } } });
  assert.equal(plug.mcpServers['mare-liberum'].url, 'https://mareliberum.dev/mcp/app');
});
console.log('count');
await proof('a deal check with via=bot-template counts once in today.checks and once in today.via_bot_template', async () => {
  const t0 = await today(); assert.equal(typeof t0.via_bot_template, 'number');
  const r = await call(`/deal?url=${RUN}&via=${BOTS.via}`, { ip: fresh() }); assert.equal(r.status, 200, r.text.slice(0, 200));
  const t1 = await today(); assert.equal(t1.checks, t0.checks + 1); assert.equal(t1.via_bot_template, t0.via_bot_template + 1);
});
await proof('without via, with another via, or made for a crawler, a deal check does not count as the routine', async () => {
  const t0 = await today();
  for (const q of ['', '&via=other', '&via=Bot-Template', '&via=bot-template-x']) assert.equal((await call(`/deal?url=${RUN}${q}`, { ip: fresh() })).status, 200, q);
  const t1 = await today(); assert.equal(t1.checks, t0.checks + 4); assert.equal(t1.via_bot_template, t0.via_bot_template);
  await db.flow.deal({ url: decodeURIComponent(RUN), base: BASE }, { ip: fresh(), uncounted: true, via: BOTS.via });
  await db.flow.deal({ url: decodeURIComponent(RUN), base: BASE }, { ip: fresh(), readOnly: true, via: BOTS.via });
  await call(`/deal?url=${RUN}&via=${BOTS.via}`, { ip: fresh(), headers: { 'user-agent': 'Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)' } });
  const t2 = await today(); assert.equal(t2.checks, t1.checks); assert.equal(t2.via_bot_template, t1.via_bot_template);
});
await proof('the paid deal check with via=bot-template counts as the routine too', async () => {
  const t0 = await today(); facilitator = settles();
  const r = await call(`/x402/deal?url=${RUN}&via=${BOTS.via}`, { ip: fresh(), headers: payment() }); assert.equal(r.status, 200, r.text.slice(0, 300));
  facilitator = null; await Promise.allSettled(waits.splice(0));
  const t1 = await today(); assert.equal(t1.checks, t0.checks + 1); assert.equal(t1.via_bot_template, t0.via_bot_template + 1);
});
console.log('told');
await proof('llms.txt names /for/bots and the Grok Bot sentence; the sitemap of hubs names /for/bots', async () => {
  const l = await call('/llms.txt', { ip: fresh(), accept: 'text/plain' }); assert.ok(l.text.includes('https://mareliberum.dev/for/bots')); assert.ok(l.text.includes('Add a custom MCP server called mare-liberum at https://mareliberum.dev/mcp'));
  const s = await call('/sitemaps/hubs.xml', { ip: fresh(), accept: 'application/xml' }); assert.equal(s.status, 200); assert.ok(s.text.includes(`<loc>${BASE}${BOTS.path}</loc>`), 'in the sitemap of hubs');
});
await proof('the guidance of /openapi.json stays under 4,000 characters and does not name this page', async () => {
  const real = 'https://mareliberum.dev', g = JSON.parse(await (await core.handle(new Request(`${real}/openapi.json`, { headers: { 'user-agent': 'deal-proof-agent/1.0', 'x-forwarded-for': '127.0.0.1' } }), db, { ...cfg, base: real })).text()).info['x-guidance'];
  assert.ok(g.length < 4000, `${g.length} characters`); assert.ok(!g.includes('/for/bots'));
});
await Promise.allSettled(waits.splice(0));
console.log(`\n${passed} proofs held, ${failed} failed`);

// ------------------------------------------------------------------ negative controls: each rule broken in a copy, the proof must fail there
let caught = 0, missed = 0;
if (!process.argv.includes('--no-controls')) {
  console.log('\nnegative controls: each rule broken in a copy, the proof must fail there');
  const CONTROLS = [
    ['any value of via counted as the routine', 'node/core.mjs', "const viaOf = (u) => (u.searchParams.get('via') === BOTS.via ? { via: BOTS.via } : {});", "const viaOf = (u) => (u.searchParams.has('via') ? { via: BOTS.via } : {});"],
    ['a crawler\'s check counted as the routine', 'node/lens.mjs', "if (!ctx?.uncounted && ctx?.via === 'bot-template')", "if (ctx?.via === 'bot-template')"],
    ['the paid door forgetting the mark', 'node/core.mjs', 'const dealCtx = () => ({ ...ctx, paidDeal: true, ...viaOf(url) });', 'const dealCtx = () => ({ ...ctx, paidDeal: true });'],
    ['the app door given to paste', 'node/pages.mjs', 'mcp = `${base}/mcp`;', 'mcp = `${base}/mcp/app`;'],
    ['the first sentence left out of the page', 'node/pages.mjs', '<p class="lead" style="font-size:1.1rem">${esc(p.lead)}</p>\n', ''],
    ['the Markdown made from the HTML again', 'node/agentmd.mjs', '|^\\/for\\/bots\\.md$', ''],
    ['the short skill address with other bytes', 'node/core.mjs', "return new Response(cfg.site['/deal-check.md'].body, {", "return new Response(`${cfg.site['/deal-check.md'].body}\\n`, {"],
    ['the page left out of the sitemap', 'node/hubs.mjs', " ['/for/bots', 'weekly', 0],", ''],
  ];
  for (const [name, f, from, to] of CONTROLS) {
    const d2 = mkdtempSync(join(tmpdir(), 'mare-bots-ctl-'));
    try {
      cpSync(ROOT, d2, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      const fp = join(d2, f), txt = readFileSync(fp, 'utf8');
      if (!txt.includes(from)) { missed++; console.log(`  FAIL control "${name}": the line to break is gone from ${f}; the control needs updating`); continue; }
      writeFileSync(fp, txt.replace(from, to));
      const r = spawnSync(process.execPath, [join(d2, 'tools/bots-proof.mjs'), '--no-controls'], { encoding: 'utf8', timeout: 240_000 });
      const out = `${r.stdout}${r.stderr}`, broke = (out.match(/\n  FAIL /g) || []).length;
      if (r.status !== 0 && broke > 0) { caught++; console.log(`  ok   caught: ${name} (${broke} proof${broke === 1 ? '' : 's'} failed)`); }
      else { missed++; console.log(`  FAIL control "${name}" was not caught (exit ${r.status})`); }
    } finally { try { rmSync(d2, { recursive: true, force: true }); } catch {} }
  }
  console.log(`${caught} of ${CONTROLS.length} controls caught`);
}
process.exit(failed || missed ? 1 : 0);
