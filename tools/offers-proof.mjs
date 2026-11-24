// Mare Liberum · proof of the paid services of the house
// A paid service shows only while its payment link and its price are set; the free ways stay as they were.
// Runs without the network: node tools/offers-proof.mjs   (exit code 1 when a proof fails)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handle } from '../node/core.mjs';
import { createMem } from '../node/mem.mjs';
import { OFFERS, VERIFIED, SELLER, isOpen, payUrl, verifiedOf, reportBox } from '../node/offers.mjs';
import { reportMarkdown, reportHtml, draftRobots, draftLlms, draftJsonLd } from '../node/report.mjs';
import { SAMPLE } from '../node/report-sample.mjs';
import { sitePage } from '../node/pages.mjs';

let passed = 0, failed = 0;
const proof = async (name, fn) => { try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.message || e).split('\n').slice(0, 4).join('\n       ')}`); } };

// a small web of one site, so that /site/<domain> has something to map; nothing leaves the machine
const PAGES = { '/robots.txt': ['text/plain', 'User-agent: *\nAllow: /\n'], '/': ['text/html', `<!doctype html><html><head><title>Harbour Shop</title><meta name="description" content="Ropes and lamps"></head><body><h1>Harbour Shop</h1><p>${'rope lamp anchor '.repeat(60)}</p><form action="/search"><input name="q"></form></body></html>`] };
globalThis.fetch = async (u) => { const x = new URL(String(u?.url || u)); const p = x.hostname === 'harbourshop.com' ? PAGES[x.pathname] : null; return p ? new Response(p[1], { status: 200, headers: { 'content-type': p[0] } }) : new Response('not found', { status: 404, headers: { 'content-type': 'text/plain' } }); };

const BASE = 'https://mare.test', ID = 'urn:air:tools.example:mcp:rope-server';
const ENTRY = { identifier: ID, displayName: 'Rope Server', description: 'An MCP server that knows knots.', url: 'https://tools.example/mcp', tags: [], capabilities: ['tie'], metadata: { kind: 'mcp', publisher: 'tools.example', endpoints: [{ url: 'https://tools.example/mcp', transport: 'streamable-http' }], lake: 'proof' } };
const mem = createMem({ file: 'data/none.tsv', base: BASE });
const db = Object.assign(async (fn, a) => (fn === 'mare_get' && a?.id === ID ? ENTRY : mem(fn, a)), mem);
const SITE = { '/': { body: '<!doctype html><title>home</title>', type: 'text/html; charset=utf-8' }, '/llms.txt': { body: readFileSync(new URL('../site/llms.txt', import.meta.url), 'utf8'), type: 'text/plain; charset=utf-8' } };
let ipN = 10;
const call = async (path, { method = 'GET', body, accept = 'text/html', ua = 'proof/1.0' } = {}) => {
  const r = await handle(new Request(BASE + path, { method, headers: { accept, 'x-forwarded-for': `203.0.113.${ipN++ % 200}`, 'user-agent': ua, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined }), db, { site: SITE, base: BASE });
  const txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch {}
  return { status: r.status, txt, j, type: r.headers.get('content-type') || '', loc: r.headers.get('location') };
};
const LINKS = { report: 'https://buy.stripe.com/test_reportLINK', verified: 'https://buy.stripe.com/test_verifiedLINK' };
const was = JSON.parse(JSON.stringify(OFFERS));
const close = () => { for (const k of Object.keys(OFFERS)) { OFFERS[k].link = ''; OFFERS[k].priceEur = was[k].priceEur; } };
const open = () => { OFFERS.report.link = LINKS.report; OFFERS.report.priceEur = 29; OFFERS.verified.link = LINKS.verified; OFFERS.verified.priceEur = 19; };
const EP = `/e/${ID.replace('urn:air:', '')}`, EJ = `/entry?id=${encodeURIComponent(ID)}`;

console.log('the rule: shown only while link and price are set');
await proof('as shipped, a service without a payment link is closed', () => {
  for (const o of Object.values(was)) assert.equal(isOpen(o.id), !!o.link && o.priceEur > 0, o.id);
  close(); for (const o of Object.values(OFFERS)) assert.equal(isOpen(o.id), false, o.id);
});
await proof('as shipped: both services are open at the prices their payment links charge', () => {
  assert.equal(was.report.priceEur, 29); assert.match(was.report.link, /^https:\/\/buy\.stripe\.com\/[A-Za-z0-9]+$/);
  assert.equal(was.verified.priceEur, 19); assert.equal(was.verified.link, 'https://buy.stripe.com/28EeV6fug5wUaBpg1Tes00p'); assert.equal(was.report.link, 'https://buy.stripe.com/fZu3co4PC2kIcJx3f7es00o');
  for (const o of Object.values(was)) { assert.ok(o.delivers.length >= 3 && o.within && o.not && o.asks, o.id); assert.match(o.within, /by hand/); }
});
await proof('a link without a price, a price without a link, and a link that is not https stay closed', () => {
  close(); OFFERS.verified.link = LINKS.verified; OFFERS.verified.priceEur = null; assert.equal(isOpen('verified'), false);
  close(); OFFERS.report.priceEur = 29; assert.equal(isOpen('report'), false);
  OFFERS.report.link = 'http://buy.stripe.com/x'; assert.equal(isOpen('report'), false);
  OFFERS.report.link = 'javascript:alert(1)//aaaaaaaa'; assert.equal(isOpen('report'), false);
  OFFERS.report.link = 'https://buy.stripe.com/a"><script>'; assert.equal(isOpen('report'), false);
  close();
});
await proof('the payment link carries which site or entry it is for, in the letters Stripe takes', () => {
  open();
  assert.equal(payUrl('report', 'harbourshop.com'), `${LINKS.report}?client_reference_id=report-harbourshop_com`);
  assert.match(payUrl('verified', 'tools.example:mcp:rope-server'), /\?client_reference_id=verified-tools_example_mcp_rope-server$/);
  OFFERS.report.link = 'https://pay.example/checkout'; assert.equal(payUrl('report', 'a.example'), 'https://pay.example/checkout');
  close(); assert.equal(payUrl('report', 'a.example'), null);
});

console.log('entry pages: Is this yours?');
await proof('closed: the free claim is there for people and for agents, and no paid line', async () => {
  close();
  const h = await call(EP); assert.equal(h.status, 200);
  assert.match(h.txt, /Is this yours\?/); assert.match(h.txt, /Claim it, free/);
  assert.ok(h.txt.includes(`POST ${BASE}/enter {&quot;name&quot;`), 'the way in is written out'); assert.ok(h.txt.includes(ID));
  assert.doesNotMatch(h.txt, /Owner check|Verified listing|buy\.stripe\.com\/test_|§ 19/);
  const j = await call(EJ, { accept: 'application/json' }); assert.equal(j.status, 200);
  assert.equal(j.j.identifier, ID); assert.equal(j.j.displayName, 'Rope Server'); assert.deepEqual(j.j.metadata, ENTRY.metadata);
  assert.equal(j.j.listing.claim.free, true); assert.ok(j.j.listing.claim.how.includes('/enter') && j.j.listing.claim.how.includes(ID));
  assert.equal(j.j.listing.ownerCheck, undefined);
});
await proof('the claim is never a link a crawler could follow into /enter', async () => {
  open(); const h = await call(EP); close();
  assert.doesNotMatch(h.txt, /href="[^"]*\/enter/);
});
await proof('open: the owner check shows with price, link, § 19 and no promise; the JSON says the same', async () => {
  open();
  const h = await call(EP), j = await call(EJ, { accept: 'application/json' }), door = await call('/c/owner?from=entry&ref=tools.example%3Amcp%3Arope-server'); close();
  assert.match(h.txt, /Owner check, 19 €/); assert.ok(h.txt.includes('href="/c/owner?from=entry&amp;ref=tools.example%3Amcp%3Arope-server"'));
  assert.equal(door.loc, `${LINKS.verified}?client_reference_id=verified-tools_example_mcp_rope-server`, 'the counted door leads to the payment link for this entry');
  assert.ok(h.txt.includes(SELLER.vat.replace(/§/, '§'))); assert.match(h.txt, /no promise of ranking or revenue/); assert.match(h.txt, /named as a paid check/); assert.match(h.txt, /Claim it, free/);
  const v = j.j.listing.ownerCheck; assert.equal(v.priceEur, 19); assert.equal(v.currency, 'EUR'); assert.ok(v.pay.startsWith(LINKS.verified)); assert.ok(v.delivers.length >= 3); assert.match(v.within, /48 hours/); assert.equal(v.tax, 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.');
  assert.equal(j.j.listing.claim.free, true);
});
await proof('the mark of a verified listing: shown with its date while it holds, named as a paid check, gone when it has run out', async () => {
  close(); assert.equal(verifiedOf(ENTRY), null);
  VERIFIED[ID] = { at: '2026-11-01', until: '2099-11-01' };
  const h = await call(EP), j = await call(EJ, { accept: 'application/json' });
  assert.match(h.txt, /checked by a person on 2026-11-01, holds until 2099-11-01 · a paid check, it changes no order/); assert.deepEqual([j.j.listing.mark.at, j.j.listing.mark.until, j.j.listing.mark.paid], ['2026-11-01', '2099-11-01', true]);
  VERIFIED[ID] = { at: '2020-01-01', until: '2021-01-01' }; assert.equal(verifiedOf(ENTRY), null); const old = await call(EP); assert.doesNotMatch(old.txt, /checked by a person on/);
  VERIFIED[ID] = { at: '2099-01-01' }; assert.equal(verifiedOf(ENTRY), null, 'a date in the future is no mark');
  delete VERIFIED[ID];
});
await proof('the free way itself works as before: entering with the entry gives a resident', async () => {
  const r = await call('/enter', { method: 'POST', accept: 'application/json', body: { name: 'Rope publisher', offers: 'knots over MCP', entry: ID } });
  assert.equal(r.status, 200); assert.match(r.j.agent, /^mare:/); assert.ok(r.j.pass);
});

console.log('/site/<domain>: the full report');
await proof('closed: the map is as it was, in HTML, JSON and Markdown', async () => {
  close();
  const h = await call('/site/harbourshop.com'); assert.equal(h.status, 200, h.txt.slice(0, 200));
  assert.match(h.txt, /harbourshop\.com for agents/); assert.doesNotMatch(h.txt, /Full report|buy\.stripe\.com\/test_/);
  const j = await call('/site/harbourshop.com.json'); assert.equal(j.j.site, 'harbourshop.com'); assert.equal(j.j.report, undefined);
  const m = await call('/site/harbourshop.com.md'); assert.doesNotMatch(m.txt, /Full report/);
});
await proof('open: the report stands at the end with its price, the link for this site and § 19; everything free is still there', async () => {
  close(); const before = await call('/site/harbourshop.com'), jb = await call('/site/harbourshop.com.json');
  open(); const h = await call('/site/harbourshop.com'), j = await call('/site/harbourshop.com.json'), m = await call('/site/harbourshop.com.md'), door = await call('/c/report?from=site&ref=harbourshop.com'); close();
  assert.match(h.txt, /Full report with fixes, 29 €/); assert.ok(h.txt.includes('href="/c/report?from=site&amp;ref=harbourshop.com"')); assert.equal(door.loc, `${LINKS.report}?client_reference_id=report-harbourshop_com`); assert.ok(h.txt.includes('Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.'));
  assert.match(h.txt, /free and stay free/); assert.match(h.txt, /No promise of ranking or revenue/);
  assert.ok(h.txt.indexOf('id="report"') > h.txt.indexOf('The grammar of the Atlas'), 'at the end of the map');
  const cut = (s) => s.replace(/<section id="report"[\s\S]*?<\/section>/, '');
  assert.equal(cut(h.txt), before.txt, 'the page without the block is the page as it was');
  const { report, ownerCheck, ...rest } = j.j; assert.deepEqual(rest, jb.j); assert.equal(ownerCheck.priceEur, 19); assert.equal(report.priceEur, 29); assert.ok(report.pay.includes('report-harbourshop_com')); assert.ok(report.free.endsWith('/check/harbourshop.com'));
  assert.match(m.txt, /## Full report with fixes, 29 €/);
});
await proof('the result of the free check carries the same offer while it is open, and is the page as it was without it', async () => {
  close(); await call('/check/harbourshop.com'); const b = await call('/check/harbourshop.com'); assert.equal(b.status, 200); assert.match(b.txt, /The check is free and stays free/); assert.doesNotMatch(b.txt, /Full report/);
  const jb = await call('/check?site=harbourshop.com&format=json', { accept: 'application/json' });
  open(); const o = await call('/check/harbourshop.com'), jo = await call('/check?site=harbourshop.com&format=json', { accept: 'application/json' }), door = await call('/c/report?from=check&ref=harbourshop.com'); close();
  assert.match(o.txt, /Full report with fixes, 29 €/); assert.ok(o.txt.includes('href="/c/report?from=check&amp;ref=harbourshop.com"')); assert.equal(door.loc, `${LINKS.report}?client_reference_id=report-harbourshop_com`);
  assert.equal(o.txt.replace(/<section id="report"[\s\S]*?<\/section>/, ''), b.txt);
  assert.equal(typeof jo.j.score, 'number'); assert.deepEqual(jo.j, jb.j, 'the JSON of the check is untouched');
});
await proof('a site that is not on the map gets no offer', async () => {
  open(); const h = sitePage(BASE, { site: 'nowhere.example', mapped: false, note: 'not on the map yet' }); close();
  assert.doesNotMatch(h, /Full report/);
});

console.log('/offers');
await proof('closed: the page says nothing is for sale; open: each service with price, delivery, seller, § 19, contact', async () => {
  close(); const c = await call('/offers'); assert.equal(c.status, 200); assert.match(c.type, /text\/html/);
  assert.match(c.txt, /No paid service is open at the moment/); assert.doesNotMatch(c.txt, /buy\.stripe\.com\/test_/);
  open(); const o = await call('/offers'), dr = await call('/c/report?from=offers'), dv = await call('/c/owner?from=offers'); close();
  assert.deepEqual([dr.loc, dv.loc], [LINKS.report, LINKS.verified], 'the counted doors lead to the payment links');
  for (const w of ['Full report with fixes · 29 €', 'Owner check · 19 €', 'href="/c/report?from=offers"', 'href="/c/owner?from=offers"', 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.', 'by hand', 'ithin 24 hours', 'ithin 48 hours', 'companies only', SELLER.name, SELLER.business, `mailto:${SELLER.email}`, 'What you get', 'What it is not']) assert.ok(o.txt.includes(w), `missing: ${w}`);
  assert.match(o.txt, /lang="en"/);
});
await proof('the page promises no ranking and no revenue, and uses no word of guarantee', async () => {
  open(); const o = await call('/offers'), e = await call(EP), s = await call('/site/harbourshop.com'); close();
  for (const t of [o.txt, e.txt.match(/<section id="yours"[\s\S]*?<\/section>/)[0], s.txt.match(/<section id="report"[\s\S]*?<\/section>/)[0]]) {
    assert.doesNotMatch(t, /guarante|garantier|will rank|rank higher|more sales|more customers|boost/i);
    for (const hit of t.match(/[^.<>]*\b(ranking|revenue|traffic)\b[^.<>]*/gi) || []) assert.match(hit, /\b(no|not|nor)\b/i, `a claim about ${hit.trim().slice(0, 80)}`);
  }
});
await proof('for a program /offers answers as before (residents’ offers), with the paid services beside them', async () => {
  close(); const a = await call('/offers', { accept: 'application/json' }); assert.equal(a.status, 200);
  assert.ok(Array.isArray(a.j.offers)); assert.match(a.j.note, /residents set their own prices/); assert.deepEqual(a.j.house.paid, []);
  const b = await call('/offers', { accept: '*/*' }); assert.ok(Array.isArray(b.j.offers), 'no accept for html: JSON as before');
  const k = await call('/offers?kind=agent-ready'); assert.ok(Array.isArray(k.j.offers), 'with ?kind= always the list');
  open(); const c = await call('/offers.json'); close();
  assert.deepEqual(c.j.house.paid.map((x) => [x.id, x.priceEur]), [['report', 29], ['verified', 19]]); assert.equal(c.j.house.tax, 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.'); assert.equal(c.j.house.seller.contact, SELLER.email);
});
await proof('/offers is in the sitemap and in llms.txt', async () => {
  const sm = await call('/sitemaps/site.xml'); assert.ok(sm.txt.includes(`<loc>${BASE}/offers</loc>`));
  const l = await call('/llms.txt', { accept: 'text/plain' }); assert.match(l.txt, /\/offers\)/); assert.match(l.txt, /GET \/offers\.json/);
});

console.log('the sample report, the report tool and the pages for companies');
await proof('the sample is public, marked as a sample of the house, and carries every part the offer names', async () => {
  open(); const h = await call('/offers/sample-report'), m = await call('/offers/sample-report.md', { accept: 'text/markdown' }), o = await call('/offers'), s = await call('/site/harbourshop.com'); close();
  assert.equal(h.status, 200); assert.match(h.type, /text\/html/); assert.match(h.txt, /This is a sample\./); assert.match(h.txt, /belongs to the seller/); assert.match(h.txt, /Nobody bought it/);
  assert.match(m.type, /text\/markdown/); assert.match(m.txt, /\*\*Sample of the house\.\*\*/);
  for (const w of ['## 2. The score, part by part', '## 3. Who may read the site', '## 5. Pages read', '## 7. Compared with others', '## 8. What to fix, in order of effect', '## 9. Files ready to use', '### /llms.txt', '### robots.txt', '### Structured data (JSON-LD)', '## 10. Re-check', SAMPLE.domain]) assert.ok(m.txt.includes(w), `missing: ${w}`);
  assert.ok(h.txt.includes('<table>') && h.txt.includes('<pre>') && !/<script type="application\/ld\+json">\s*\{\s*"@context": "https:\/\/schema\.org",\s*"@graph"/.test(h.txt.split('<main')[1] || ''), 'the draft JSON-LD is shown as text, not run');
  assert.ok(o.txt.includes('href="/offers/sample-report"')); assert.ok(s.txt.includes('href="/offers/sample-report"'));
  assert.doesNotMatch(m.txt, /guarante|will rank|more sales/i);
  const sm = await call('/sitemaps/site.xml'); assert.ok(sm.txt.includes(`<loc>${BASE}/offers/sample-report</loc>`));
  close(); const c = await call('/offers/sample-report'); assert.equal(c.status, 200); assert.doesNotMatch(c.txt, /buy\.stripe\.com\/test_/);
});
await proof('the report says only what the data says: blocked agents get a robots.txt block, files that exist get no draft, an unread site gets no report', () => {
  const agents = [{ name: 'GPTBot', op: 'OpenAI', role: 'training', allowed: false }, { name: 'Claude-User', op: 'Anthropic', role: 'live', allowed: false }, { name: 'PerplexityBot', op: 'Perplexity', role: 'search', allowed: true }];
  const check = { host: 'shop.example', reachable: true, score: 40, grade: 'D', llms: true, agentCard: null, sitemap: false, agents, page: { title: 'Shop | Ropes', description: 'Ropes.', lang: 'en', words: 300, jsonld: ['Organization'] }, parts: [{ key: 'access', max: 25, got: 10, ok: false, title: 'robots.txt blocks Claude-User', fix: 'let it in', from: 'robots.txt' }, { key: 'sitemap', max: 5, got: 0, ok: false, title: 'No sitemap', fix: 'add one', from: 'robots.txt' }, { key: 'https', max: 5, got: 5, ok: true, title: 'HTTPS', fix: null, from: 'home page' }] };
  const md = reportMarkdown({ domain: 'shop.example', date: '2026-11-22', base: BASE, check, site: { site: 'shop.example', llmsTxt: 'https://shop.example/llms.txt', search: { template: 'https://shop.example/s?q={q}', from: 'the form' } }, pages: [{ url: 'https://shop.example/', ok: true, words: 300, title: 'Shop' }, { url: 'https://shop.example/a|b', ok: false, note: 'the reader answered 403' }], competitors: [{ domain: 'other.example', check: { error: 'no answer' }, site: {} }] });
  assert.match(md, /scores 40 of 100 \(grade D\)/); assert.match(md, /turns away 1 assistant or AI search crawler: Claude-User\./);
  assert.ok(md.indexOf('robots.txt blocks Claude-User') < md.indexOf('No sitemap', md.indexOf('## 8.')) && md.indexOf('## 8.') < md.indexOf('1. **robots.txt blocks Claude-User**'), 'the largest gap first');
  assert.match(md, /User-agent: Claude-User\nAllow: \//); assert.match(md, /Training crawlers: your choice/); assert.match(md, /Already there: https:\/\/shop\.example\/llms\.txt\. No draft needed\./); assert.match(md, /Already there: Organization\. No draft needed\./);
  assert.match(md, /\| other\.example \| not readable \|/); assert.match(md, /a\\\|b/); assert.match(md, /read again on \*\*2026-12-06\*\*/); assert.doesNotMatch(md, /Sample of the house/);
  assert.equal(draftRobots({ agents: agents.map((a) => ({ ...a, allowed: true })) }), null);
  assert.match(draftLlms({ host: 'x.example', page: {} }, {}), /TODO/); assert.match(draftJsonLd(check, { search: { template: 'https://shop.example/s?q={q}' } }), /search_term_string/);
  const none = reportMarkdown({ domain: 'gone.example', date: '2026-11-22', check: { error: 'no answer' }, site: {} }); assert.match(none, /could not be read/); assert.doesNotMatch(none, /## 9\./);
  assert.doesNotMatch(reportHtml('| a | <script>x</script> |\n| --- | --- |\n| [l](javascript:alert(1)) | `c` |'), /<script>|href="javascript/);
});
await proof('the tool writes the report from kept data without the network and sends nothing', async () => {
  const { spawnSync } = await import('node:child_process'); const { mkdtempSync, writeFileSync: w, readFileSync: r, readdirSync } = await import('node:fs'); const { tmpdir } = await import('node:os'); const { join } = await import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'report-')), data = join(dir, 'd.json'), out = join(dir, 'r.md'); w(data, JSON.stringify(SAMPLE));
  const run = spawnSync(process.execPath, [new URL('./report.mjs', import.meta.url).pathname, SAMPLE.domain, '--offline', '--json', data, '--out', out], { encoding: 'utf8', env: { ...process.env, HTTPS_PROXY: 'http://127.0.0.1:9', https_proxy: 'http://127.0.0.1:9' } });
  assert.equal(run.status, 0, run.stderr); assert.match(run.stdout, /Nothing was sent/); assert.equal(r(out, 'utf8'), reportMarkdown(SAMPLE)); assert.deepEqual(readdirSync(dir).sort(), ['d.json', 'r.md']);
  const bad = spawnSync(process.execPath, [new URL('./report.mjs', import.meta.url).pathname, 'not a domain'], { encoding: 'utf8' }); assert.equal(bad.status, 2);
  const src = r(new URL('./report.mjs', import.meta.url), 'utf8'); assert.doesNotMatch(src, /method:\s*'POST'|smtp|sendMail|gmail\.com\/|api\.stripe/i);
});
await proof('/business, /de/unternehmen and /de/agenturen carry the report while it is open, in their language, and are as they were without it', async () => {
  const cut = (t) => t.replace(/<section id="report"[\s\S]*?<\/section>/, '');
  for (const [p, re] of [['/business', /Order the report · 29 €/], ['/de/unternehmen', /Bericht bestellen · 29 €/], ['/de/agenturen', /Bericht bestellen · 29 €/]]) {
    close(); const b = await call(p); assert.equal(b.status, 200, p); assert.doesNotMatch(b.txt, /id="report"/, p);
    const ref = p.startsWith('/de') ? 'business-de&amp;ref=page-de' : 'business&amp;ref=page-en';
    open(); const o = await call(p), door = await call(`/c/report?from=${ref.replace('&amp;', '&')}`); close();
    assert.match(o.txt, re, p); assert.ok(o.txt.includes('Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.'), p); assert.ok(o.txt.includes('/offers/sample-report'), p); assert.ok(o.txt.includes(`href="/c/report?from=${ref}"`), p);
    assert.equal(door.loc, `${LINKS.report}?client_reference_id=report-page-${p.startsWith('/de') ? 'de' : 'en'}`, p);
    assert.equal(cut(o.txt), b.txt, `${p} without the block`);
    const box = o.txt.match(/<section id="report"[\s\S]*?<\/section>/)[0]; assert.doesNotMatch(box, /garantier|guarante/i); assert.match(box, p.startsWith('/de') ? /Keine Zusage zu Platzierung, Reichweite oder Umsatz/ : /No promise of ranking, traffic or revenue/);
  }
  close(); assert.equal(reportBox('de'), '');
});

console.log('the free doors');
await proof('check, brain, ask, flow, stats and the home answer as they did', async () => {
  for (const p of ['/stats', '/flow', '/hello', '/earn.json', '/buy']) { const r = await call(p, { accept: p === '/buy' ? 'text/html' : 'application/json' }); assert.equal(r.status, 200, p); }
  const s = await call('/stats', { accept: 'application/json' }); assert.ok(s.j.version);
});

console.log(`\n${passed} proved, ${failed} failed`);
process.exit(failed ? 1 : 0);
