// Mare Liberum · proof of the legal texts (node/legal.mjs, the Impressum of node/shore.mjs): every legal page answers as HTML
// and as Markdown (the .md twin and Accept: text/markdown), carries its Stand, names the operator and the small-business VAT
// rule (§ 19 UStG). The pages that state prices (/terms, /de/agb, /de/preise) state every price the code defines — read from
// the code, never written down here: the paid route of node/pricing.mjs (default and range), the house offers and the
// harbours of /pricing (node/attention-ui.mjs pricingRows), the smallest fair-share payment (node/fair.mjs) and the
// harbour toll (config/toll.json once 3.37 brought it, else the numbers of the owner's rule of 25.11.2026) — in the form of
// their language, and /de/preise names no euro price the code does not have. So a price that changes in the code without
// the texts makes this proof fail. The hubs, the alternates, the foot of every page and /about carry the new pages, the
// licences agree with /open, and the app door /mcp/app answers byte for byte as on origin/main.
// Negative controls at the end: each breaks one rule in a copy of the code, and this proof must fail there.
// Runs without the network: node tools/legal-proof.mjs   (exit code 1 when a proof fails or a control is not caught)
//   --no-controls          only the proofs (the controls run this file that way in each broken copy)
//   MARE_LEGAL_REF=<ref>   compare /mcp/app with another ref than origin/main (MARE_REF_DIR: a tree already unpacked)
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { freezeTime, refTree, nodeOf, brokenCopy, runIn, drop, headersOf } from './engine-kit.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTROLS = !process.argv.includes('--no-controls');
const REF = process.env.MARE_LEGAL_REF || 'origin/main';
delete process.env.MARE_ENGINE; delete process.env.MARE_FAIR; delete process.env.MARE_TOLL; delete process.env.MARE_ROUTE_PRICE_CENTS; delete process.env.MARE_PAY_TO;
let passed = 0, failed = 0;
const proof = async (name, fn) => { try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 5).join('\n       ')}`); } };
globalThis.fetch = async (u) => { throw new Error(`the proof does not use the network: ${String(u).slice(0, 80)}`); };
freezeTime();
const mod = (p) => import(pathToFileURL(join(ROOT, p)).href);

// ------------------------------------------------------------------ what the code says (never written down here)
const { pricingOf, priceOf, DEFAULT_CENTS, HOUSE_WALLET } = await mod('node/pricing.mjs');
const { pricingRows } = await mod('node/attention-ui.mjs');
const { SELLER, OFFERS } = await mod('node/offers.mjs');
const { FAIR } = await mod('node/fair.mjs');
const { TOKEN_PRICE } = await mod('node/areas.mjs');
const { STAND, LEGAL_PATHS, LEGAL_PAIRS } = await mod('node/legal.mjs');
const { HUB_PATHS, HUB_ALT } = await mod('node/hubs.mjs');
const { LICENCES } = await mod('node/open.mjs');
const route = pricingOf({ cents: DEFAULT_CENTS, payTo: HOUSE_WALLET });
// the range the operator may set without a release: every cent priceOf keeps as it was asked
const kept = Array.from({ length: 101 }, (_, c) => c).filter((c) => priceOf({ MARE_ROUTE_PRICE_CENTS: String(c) }).cents === c);
const range = [Math.min(...kept), Math.max(...kept)].map((c) => c / 100);
const rows = pricingRows('https://mare.test', route);
const EUROS = [...new Set(rows.flatMap((r) => [r.eur, r.yearly]).filter((x) => Number(x) > 0))].sort((a, b) => a - b);
const fairMin = FAIR.minMicro / 1e6;
// the harbour toll: config/toll.json since 3.37 (node/toll.mjs reads the same file), before that the owner's rule
const tollFile = join(ROOT, 'config/toll.json');
const tollCfg = existsSync(tollFile) ? JSON.parse(readFileSync(tollFile, 'utf8')) : null;
const TOLL = { free: tollCfg?.freeTokensPerNetworkPerDay ?? 100_000, share: tollCfg?.share ?? 0.2, settle: tollCfg?.settleAtUsd ?? 0.05, perMillion: tollCfg?.usdPerMillion ?? 2, from: tollCfg ? 'config/toll.json' : 'the rule of 25.11.2026 (no config/toll.json yet)' };
let EX = { page: 9128, saved: 9077 };
if (existsSync(join(ROOT, 'node/toll.mjs'))) { try { const t = await mod('node/toll.mjs'); if (t.TOLL_EXAMPLE) EX = { page: t.TOLL_EXAMPLE.page, saved: t.TOLL_EXAMPLE.saved }; } catch {} }
// the example's toll as node/toll.mjs works it out: whole millionths, rounded down
const exMicro = Number((BigInt(EX.saved) * BigInt(Math.round(TOLL.share * 1e6)) * BigInt(Math.round(TOLL.perMillion * 1e6))) / 1_000_000_000_000n);

// ------------------------------------------------------------------ the same numbers in the words of each language
const group = (n, sep) => String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
const dec = (x, lang, digits) => { const s = digits == null ? String(x) : Number(x).toFixed(digits); return lang === 'de' ? s.replace('.', ',') : s; };
const usd2 = (x, lang) => dec(Number(x).toFixed(2), lang);
const pct = (x) => `${Math.round(x * 1e4) / 100} %`;
const facts = (lang) => {
  const de = lang === 'de';
  return {
    euros: EUROS.map((e) => `${group(e, de ? '.' : ',')} €`),
    route: [`${usd2(route.price_usd, lang)} USDC`, usd2(range[0], lang), usd2(range[1], lang)],
    fair: [`${usd2(fairMin, lang)} USDC`, pct(FAIR.rate.lower), pct(FAIR.rate.modelled), de ? `${dec(TOKEN_PRICE.mid, 'de')} USD je Million` : `USD ${dec(TOKEN_PRICE.mid, 'en')} per million`],
    toll: de
      ? [`${group(TOLL.free, '.')} `, pct(TOLL.share), `${usd2(TOLL.settle, 'de')} USD`, `${dec(TOLL.perMillion, 'de')} USD je Million`]
      : [`${group(TOLL.free, ',')} `, pct(TOLL.share), `USD ${usd2(TOLL.settle, 'en')}`, `USD ${dec(TOLL.perMillion, 'en')} per million`],
    vat: '§ 19 UStG',
  };
};
const PRICED = new Set(['/terms', '/de/agb', '/de/preise']);
const ALL = [...LEGAL_PATHS, '/impressum'];
const langOf = (p) => (p.startsWith('/de/') || p === '/impressum' ? 'de' : 'en');
const textOf = (html) => String(html).replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const has = (t, w, where) => assert.ok(t.includes(w), `${where}: missing "${w}"`);

console.log(`the legal texts, Stand ${STAND}; prices from the code: route ${route.amount_usd} USDC (${range[0]}–${range[1]}), euros ${EUROS.join(', ')}, fair share from ${fairMin} USDC; the toll from ${TOLL.from}: ${TOLL.free} free, ${pct(TOLL.share)}, USD ${TOLL.perMillion} per million, settled from USD ${TOLL.settle}`);

// ------------------------------------------------------------------ the app door, byte for byte (first, on fresh nodes)
const refDir = refTree(ROOT, REF);
await proof(`/mcp/app answers byte for byte as on ${REF}: initialize, ping, tools/list, the read-only tools, errors, a batch, GET and OPTIONS`, async () => {
  assert.ok(refDir, `the tree of ${REF} could not be unpacked (git archive); set MARE_REF_DIR or MARE_LEGAL_REF`);
  const ours = await nodeOf(ROOT), theirs = await nodeOf(refDir);
  // the version string is masked: the release that merges these texts sets its own number, and only that may differ
  const V = (t) => String(t).replace(/("version":")\d+\.\d+\.\d+(")/g, '$1V$2');
  const H = (h) => Object.fromEntries(Object.entries(headersOf(h)).map(([k, v]) => [k, V(v)]));
  const INIT = { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'legal-proof', version: '1' } };
  const o = { ip: '203.0.113.77' };
  const calls = [
    ['initialize', INIT], ['initialize', { ...INIT, protocolVersion: '2024-11-05' }], ['initialize', { ...INIT, protocolVersion: '1999-01-01' }], ['ping'], ['tools/list'], ['resources/list'], ['no/such/method'],
    ['tools/call', { name: 'think', arguments: { q: 'find mcp servers for postgres' } }], ['tools/call', { name: 'search', arguments: { query: 'postgres' } }],
    ['tools/call', { name: 'get', arguments: { identifier: 'urn:air:mare.test:mcp:nothing' } }], ['tools/call', { name: 'stats', arguments: {} }],
    ['tools/call', { name: 'answers', arguments: { ask: 'nothing-here' } }], ['tools/call', { name: 'mind', arguments: { key: 'short' } }],
    ['tools/call', { name: 'read_page', arguments: { url: 'https://example.com/' } }], ['tools/call', { name: 'enter', arguments: { name: 'x' } }],
  ];
  for (const [m, p] of calls) {
    const a = await ours.rpc('/mcp/app', m, p, o), b = await theirs.rpc('/mcp/app', m, p, o);
    assert.equal(a.status, b.status, `${m} status`); assert.equal(V(a.text), V(b.text), `${m} ${p?.name || ''}`); assert.deepEqual(H(a.headers), H(b.headers), `${m} headers`);
  }
  const batch = [{ jsonrpc: '2.0', id: 1, method: 'initialize', params: INIT }, { jsonrpc: '2.0', id: 2, method: 'tools/list' }, { jsonrpc: '2.0', method: 'notifications/initialized' }];
  for (const [req, label] of [[{ method: 'POST', accept: 'application/json, text/event-stream', body: batch, ip: o.ip }, 'batch'], [{ method: 'POST', accept: 'application/json', body: { jsonrpc: '2.0', method: 'notifications/initialized' }, ip: o.ip }, 'notification'],
    [{ method: 'GET', accept: 'text/html', ip: o.ip }, 'GET'], [{ method: 'OPTIONS', ip: o.ip }, 'OPTIONS']]) {
    const a = await ours.call('/mcp/app', req), b = await theirs.call('/mcp/app', req);
    assert.equal(a.status, b.status, `${label} status`); assert.equal(V(a.text), V(b.text), label); assert.deepEqual(H(a.headers), H(b.headers), `${label} headers`);
  }
});

// ------------------------------------------------------------------ every legal page, as HTML and as Markdown
const node = await nodeOf(ROOT, { base: 'https://mareliberum.dev' });
const BROWSER = { ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36', headers: { 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document', 'sec-ch-ua': '"Chromium";v="131"' } };
const pages = {};
for (const p of ALL) {
  const html = await node.call(p, { accept: 'text/html', ...BROWSER }), twin = await node.call(`${p}.md`, { accept: 'text/markdown' }), asked = await node.call(p, { accept: 'text/markdown' });
  pages[p] = { html, twin, asked, text: textOf(html.text) };
}
const [street, ...rest] = String(SELLER.address).split(',').map((x) => x.trim()), town = rest.slice(0, -1).join(', ');
for (const p of ALL) {
  await proof(`${p}: 200 as HTML (lang ${langOf(p)}) and as Markdown (${p}.md and Accept: text/markdown); Stand ${STAND}; the operator, the address and § 19 UStG`, async () => {
    const { html, twin, asked, text } = pages[p];
    assert.equal(html.status, 200, `${p} html`); assert.match(html.headers.get('content-type') || '', /^text\/html/);
    assert.match(html.text, new RegExp(`<html[^>]* lang="${langOf(p)}"`), 'lang');
    for (const [r, w] of [[twin, 'twin'], [asked, 'accept']]) { assert.equal(r.status, 200, `${p} ${w}`); assert.match(r.headers.get('content-type') || '', /^text\/markdown/, `${p} ${w}`); }
    for (const t of [text, twin.text, asked.text]) for (const w of [`Stand: ${STAND}`, SELLER.name, SELLER.business, street, town, SELLER.email, '§ 19 UStG']) has(t, w, p);
    assert.ok(!/ec\.europa\.eu\/consumers\/odr|OS-Plattform|ODR platform/i.test(html.text), `${p}: names the EU platform for online dispute resolution, closed on 20 July 2025`);
  });
}
await proof(`the pages of node/legal.mjs end with the operator, the Stand and a line to every legal page, in their language`, async () => {
  assert.match(STAND, /^\d{2}\.\d{2}\.\d{4}$/);
  for (const p of LEGAL_PATHS) {
    const t = pages[p].text, de = langOf(p) === 'de';
    has(t, `Stand: ${STAND} · Impressum`, p);
    has(t, de ? `Anbieter: ${SELLER.name}, ${SELLER.business} (Einzelunternehmen)` : `Provider: ${SELLER.name}, ${SELLER.business} (sole proprietorship)`, p);
    for (const q of [...LEGAL_PATHS, '/impressum', '/pricing']) assert.ok(pages[p].html.text.includes(`href="${q}`), `${p}: no link to ${q}`);
  }
});

// ------------------------------------------------------------------ the prices: every one the code defines, none it does not
for (const p of PRICED) {
  await proof(`${p} states every price of the code in ${langOf(p) === 'de' ? 'German' : 'English'} form: the paid route and its range, ${EUROS.length} prices in euro, the smallest fair share and the harbour toll`, async () => {
    const f = facts(langOf(p)), t = pages[p].text;
    for (const w of [...f.euros, ...f.route, ...f.fair, ...f.toll, f.vat]) has(t, w, p);
    has(pages[p].twin.text, f.toll[0].trim(), `${p}.md`); has(pages[p].twin.text, f.euros[f.euros.length - 1], `${p}.md`);
  });
}
await proof('/de/preise names no price in euro the code does not have, and works the toll out with an example from the code\'s numbers', async () => {
  const t = pages['/de/preise'].text, said = [...t.matchAll(/(\d{1,3}(?:\.\d{3})*|\d+) €/g)].map((m) => Number(m[1].replace(/\./g, '')));
  assert.ok(said.length >= EUROS.length, 'prices in euro');
  for (const x of said) assert.ok(EUROS.includes(x), `/de/preise names ${x} €, which no offer of the code has`);
  const exDe = dec((exMicro / 1e6).toFixed(6), 'de');
  for (const w of [`${dec(TOLL.share, 'de')} × eingesparte Tokens oberhalb des Freikontingents × ${dec(TOLL.perMillion, 'de')} USD / 1.000.000`, group(EX.page, '.'), group(EX.saved, '.'), `= ${exDe} USD`, `nach etwa ${Math.ceil((TOLL.settle * 1e6) / exMicro)} solcher Antworten`, 'nicht eingefordert']) has(t, w, '/de/preise');
});
await proof('the harbour toll stands in the terms as the owner set it: lossless levers only, settled by x402 from the threshold, never collected, switchable; lossy levers and /mcp/app free', async () => {
  for (const [p, words] of [['/de/agb', ['x-sea-toll: pay', 'POST /fair/pay', 'weder angemahnt noch in Rechnung gestellt noch eingezogen', 'fields=', 'budget=', '/mcp/app', 'abschalten', 'fmt=toon', 'POST /compress', 'since=', 'If-None-Match']],
    ['/terms', ['x-sea-toll: pay', 'POST /fair/pay', 'never reminded, invoiced or collected', 'fields=', 'budget=', '/mcp/app', 'switch the harbour toll off', 'fmt=toon', 'POST /compress', 'since=', 'If-None-Match']]]) for (const w of words) has(pages[p].text, w, p);
  for (const p of ['/de/datenschutz', '/privacy']) for (const w of ['HMAC', '33', 'x-sea-toll-id']) has(pages[p].text, w, p);
});

// ------------------------------------------------------------------ what each text must hold
await proof('AGB and terms: the German text governs; agents act for their operator; fair share is voluntary; liability in the usual German form; German law, Köln for merchants, § 36 VSBG', async () => {
  for (const w of ['Maßgeblich ist die deutsche Fassung', 'Betreiber des Agenten', 'Vertragspartner wird der Betreiber des Agenten, nicht der Agent', 'Die Zahlung ist freiwillig', 'Vorsatz und grober Fahrlässigkeit', 'Leben, Körper oder Gesundheit', 'wesentlichen Vertragspflicht', 'vertragstypischen, bei Vertragsschluss vorhersehbaren Schaden', 'Produkthaftungsgesetz', 'UN-Kaufrechts', 'gewöhnlichen Aufenthalt', 'Köln ausschließlicher Gerichtsstand', '§ 36 VSBG', 'Über die gesetzlichen Rechte hinaus erstatten wir keine Zahlungen', 'Stripe', 'x402']) has(pages['/de/agb'].text, w, '/de/agb');
  for (const w of ['German version of these terms', 'governs', 'operator of the agent', 'The contracting party is the operator of the agent, not the agent', 'Paying is voluntary', 'intent and gross negligence', 'life, body or health', 'essential contractual obligation', 'typical for the contract and foreseeable', 'Product Liability Act', 'CISG', 'habitual residence', 'Köln (Cologne) is the exclusive place of jurisdiction', '§ 36 VSBG', 'Beyond the statutory rights we refund no payments', 'Stripe', 'x402']) has(pages['/terms'].text, w, '/terms');
});
await proof('licences agree: code MIT, contributions CC0 1.0 (also in the table of /open), works CC BY 4.0 or CC0 1.0, the site CC BY 4.0 as /license.xml says', async () => {
  const row = LICENCES.find((x) => x.paths.includes('/brain')); assert.ok(row && row.license === 'CC0 1.0', '/open names the licence of what agents write');
  assert.equal(LICENCES.find((x) => x.paths.includes('/license.xml'))?.license.startsWith('CC BY 4.0'), true);
  const xml = (await node.call('/license.xml', { accept: 'application/xml' })).text; assert.ok(xml.includes('https://creativecommons.org/licenses/by/4.0/'), 'license.xml');
  for (const p of ['/de/agb', '/terms']) for (const w of ['MIT', 'CC0 1.0', 'CC BY 4.0', '/license.xml', 'Which licence for which data']) has(pages[p].text, w, p);
});
await proof('Datenschutz and privacy: controller, hosting in Helsinki and the database in Ireland, the Vercel redirect, the system log, counts per network, x402 and its facilitator, Stripe, email, no cookies, legal bases, rights and objection, the LDI NRW', async () => {
  for (const [p, words] of [['/de/datenschutz', ['Verantwortlich', 'Hetzner', 'Helsinki', 'Supabase', 'Irland', 'Vercel', 'mare-liberum.vercel.app', 'journald', '30 Tagen', 'IPv6', '/64', 'PayAI', 'Base', 'Stripe', 'Gmail', 'keine Cookies', 'Art. 6 Abs. 1 lit. b', 'lit. c', 'lit. f', 'Art. 15', 'Art. 17', 'Art. 21', 'Widerspruchsrecht', 'Art. 77', 'LDI NRW', 'Kavalleriestraße 2–4, 40213 Düsseldorf', 'Data Privacy Framework', 'Standardvertragsklauseln']],
    ['/privacy', ['controller', 'Hetzner', 'Helsinki', 'Supabase', 'Ireland', 'Vercel', 'mare-liberum.vercel.app', 'journald', '30 days', 'IPv6', '/64', 'PayAI', 'Base', 'Stripe', 'Gmail', 'no cookies', 'Art. 6(1)(b)', '(c)', '(f)', 'Art. 15', 'Art. 17', 'Art. 21', 'Right to object', 'Art. 77', 'LDI NRW', 'Kavalleriestraße 2–4, 40213 Düsseldorf', 'Data Privacy Framework', 'standard contractual clauses']]]) for (const w of words) has(pages[p].text, w, p);
});
await proof('Widerrufsbelehrung: the statutory model for services, the early end for services and digital content (§ 356 Abs. 5 and 6 BGB), the model form, an English translation', async () => {
  const t = pages['/de/widerruf'].text;
  for (const w of ['binnen vierzehn Tagen ohne Angabe von Gründen', 'ab dem Tag des Vertragsabschlusses', '(z. B. ein mit der Post versandter Brief oder E-Mail)', 'Folgen des Widerrufs', 'Haben Sie verlangt, dass die Dienstleistungen während der Widerrufsfrist beginnen soll', '§ 356 Abs. 5 BGB', '§ 356 Abs. 6 BGB', '§ 312f BGB', 'Muster-Widerrufsformular', 'Unzutreffendes streichen', 'Unternehmern steht kein Widerrufsrecht zu', 'Right of withdrawal (English translation)', 'within 14 days without giving any reason']) has(t, w, '/de/widerruf');
  assert.match(pages['/de/widerruf'].html.text, /<section lang="en" id="en">/);
  assert.ok(!t.includes('§ 356 Abs. 4 BGB'), '§ 356 Abs. 4 BGB is the end after twelve months and 14 days; services are Abs. 5, digital content Abs. 6');
});
await proof('Impressum (§ 5 DDG): owner, business, address, email, § 19 UStG, the contact point of the DSA, § 18 Abs. 2 MStV, consumer dispute resolution, links to the four German texts', async () => {
  const t = pages['/impressum'].text;
  for (const w of ['Angaben gemäß § 5 DDG', 'Deutschland', 'Art. 11 und 12', '§ 18 Abs. 2 MStV', 'Verbraucherschlichtungsstelle', 'Legal notice (English)']) has(t, w, '/impressum');
  for (const q of ['/de/agb', '/de/datenschutz', '/de/preise', '/de/widerruf']) assert.ok(pages['/impressum'].html.text.includes(`${q}"`), q);
});

// ------------------------------------------------------------------ where the pages are found
await proof('the hubs: every legal page in /sitemaps/hubs.xml, English and German pages naming each other there and in their heads', async () => {
  for (const p of ALL) assert.ok(HUB_PATHS.includes(p), `hub ${p}`);
  const x = (await node.call('/sitemaps/hubs.xml')).text;
  for (const p of ALL) assert.ok(x.includes(`<loc>https://mareliberum.dev${p}</loc>`), `sitemap ${p}`);
  for (const [en, de] of Object.entries(LEGAL_PAIRS)) {
    assert.equal(HUB_ALT[en], de);
    for (const p of [en, de]) { const h = pages[p].html.text; assert.ok(h.includes(`hreflang="en" href="https://mareliberum.dev${en}"`) && h.includes(`hreflang="de" href="https://mareliberum.dev${de}"`), `${p} alternates`); }
  }
});
await proof('the foot of every page links the legal pages in its language; /about names them as data', async () => {
  const foot = (h) => (/<footer id="foot">([\s\S]*?)<\/footer>/.exec(h) || [])[1] || '';
  const en = foot(pages['/terms'].html.text), de = foot(pages['/de/agb'].html.text), other = foot((await node.call('/about', { accept: 'text/html', ...BROWSER })).text);
  for (const q of ['/impressum', '/terms', '/privacy', '/pricing', '/de/widerruf#en']) { assert.ok(en.includes(`href="${q}"`), `en foot ${q}`); assert.ok(other.includes(`href="${q}"`), `about foot ${q}`); }
  for (const q of ['/impressum', '/de/agb', '/de/datenschutz', '/de/preise', '/de/widerruf']) assert.ok(de.includes(`href="${q}"`), `de foot ${q}`);
  const a = JSON.parse((await node.call('/about', { accept: 'application/json' })).text).legal;
  for (const [k, q] of [['imprint', '/impressum'], ['terms', '/terms'], ['privacy', '/privacy'], ['agb', '/de/agb'], ['datenschutz', '/de/datenschutz'], ['preise', '/de/preise'], ['widerruf', '/de/widerruf']]) assert.equal(a[k], `https://mareliberum.dev${q}`, k);
});
await proof('the old addresses still lead to the legal pages (/imprint, /legal, /privacy-policy)', async () => {
  for (const [from, to] of [['/imprint', '/impressum'], ['/legal', '/impressum'], ['/privacy-policy', '/privacy']]) { const r = await node.call(from); assert.equal(r.status, 308, from); assert.equal(r.headers.get('location'), `https://mareliberum.dev${to}`, from); }
});

// ------------------------------------------------------------------ negative controls: break a rule, the proof must fail
let caught = 0, controls = 0;
if (CONTROLS) {
  console.log('negative controls (each breaks one rule in a copy of the code; this proof must fail there)');
  const C = [
    ['the report costs 39 € in the code, the texts still say 29 €', 'node/offers.mjs', 'priceEur: 29,', 'priceEur: 39,'],
    ['the paid route costs 3 cents by default, the texts still say 0.02 USDC', 'node/pricing.mjs', 'export const DEFAULT_CENTS = 2;', 'export const DEFAULT_CENTS = 3;'],
    ['the team harbour costs 59 € on /pricing, the texts still say 49 €', 'node/attention-ui.mjs', "price: '49 € a month, first month free, cancel monthly', eur: 49,", "price: '59 € a month, first month free, cancel monthly', eur: 59,"],
    ['the German texts lose their Stand at the foot', 'node/legal.mjs', '<p><small>Stand: ${STAND} · ${NAV.de', '<p><small>${NAV.de'],
    ['the AGB name another free quota of the toll', 'node/legal.mjs', "'Freikontingent: Bis zu 100.000 durch diese Hebel", "'Freikontingent: Bis zu 150.000 durch diese Hebel"],
    ['the Preisverzeichnis names a price no offer has', 'node/legal.mjs', "'29 € einmalig je Website'", "'29 € einmalig je Website, Express 49 €, Premium 99 €'"],
    ['the operator is named without the VAT rule', 'node/legal.mjs', ' · E-Mail: ${mail()}. ${esc(SELLER.vat)}</p></div>', ' · E-Mail: ${mail()}.</p></div>'],
    ['the app door changes its words', 'node/core.mjs', "instructions: 'Mare Liberum is an open, ownerless place for AI agents, with no accounts.'", "instructions: 'Mare Liberum is an open, ownerless place for AI agents, without accounts.'"],
  ];
  for (const [name, file, from, to] of C) {
    controls++;
    let dir = null;
    try { dir = brokenCopy(ROOT, file, from, to); const r = runIn(dir, 'tools/legal-proof.mjs', { MARE_REF_DIR: refDir || '' }); if (r.status !== 0) { caught++; console.log(`  ok   control caught: ${name}`); } else console.log(`  FAIL control NOT caught: ${name}`); }
    catch (e) { console.log(`  FAIL control could not run: ${name}: ${e.message}`); }
    finally { if (dir) drop(dir); }
  }
}
if (refDir && !process.env.MARE_REF_DIR) drop(refDir);
console.log(`\nlegal proof: ${passed} passed, ${failed} failed${CONTROLS ? `; negative controls caught ${caught} of ${controls}` : ''}${refDir ? '' : `; the comparison with ${REF} did NOT run`}`);
process.exit(failed || (CONTROLS && caught !== controls) || !refDir ? 1 : 0);
