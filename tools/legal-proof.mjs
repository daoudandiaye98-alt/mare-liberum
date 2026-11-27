// Mare Liberum · proof of the legal texts (node/legal.mjs, the Impressum of node/shore.mjs): every legal page answers as HTML
// and as Markdown (the .md twin and Accept: text/markdown), carries its Stand, names the operator and the small-business VAT
// rule (§ 19 UStG). The pages that state prices (/terms, /de/agb, /de/preise) state every price the code defines — read from
// the code, never written down here: the paid route of node/pricing.mjs (default and range), the house offers and the
// harbours of /pricing (node/attention-ui.mjs pricingRows), the smallest fair-share payment (node/fair.mjs) and the
// harbour toll (config/toll.json once 3.37 brought it, else the numbers of the owner's rule of 25.11.2026) — in the form of
// their language, and /de/preise names no euro price the code does not have. So a price that changes in the code without
// the texts makes this proof fail. The hubs, the alternates, the foot of every page and /about carry the new pages, the
// licences agree with /open, and the app door /mcp/app answers byte for byte as on origin/main.
// Since the same Stand: every sale in euro (the payment links of the code, read from it) stands behind the order page for
// business customers (§ 14 BGB) with its box, and no page or data hands out a sale link; the two buttons of § 356a and § 312k
// BGB stand in the foot of every page and lead straight to forms that ask only what the law allows; a declaration is kept
// with its time in the node's own state (on disk at once), shown and handed over as a text file, and read only with the
// operator's key; the e-mail receipt is off until the operator sets a mail key and a sender, and then goes out once.
// Negative controls at the end: each breaks one rule in a copy of the code, and this proof must fail there.
// Runs without the network: node tools/legal-proof.mjs   (exit code 1 when a proof fails or a control is not caught)
//   --no-controls          only the proofs (the controls run this file that way in each broken copy)
//   MARE_LEGAL_REF=<ref>   compare /mcp/app with another ref than origin/main (MARE_REF_DIR: a tree already unpacked)
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, mkdtempSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { freezeTime, refTree, nodeOf, brokenCopy, runIn, drop, headersOf } from './engine-kit.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTROLS = !process.argv.includes('--no-controls');
const REF = process.env.MARE_LEGAL_REF || 'origin/main';
delete process.env.MARE_ENGINE; delete process.env.MARE_FAIR; delete process.env.MARE_TOLL; delete process.env.MARE_ROUTE_PRICE_CENTS; delete process.env.MARE_PAY_TO;
for (const k of ['MARE_MAIL', 'MARE_MAIL_KEY', 'MARE_MAIL_FROM', 'MARE_MAIL_URL', 'MARE_MAIL_BCC']) delete process.env[k];
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
const { STAND, LEGAL_PATHS, LEGAL_PAIRS, GATE, GATE_WORDS, BUTTON_DE, BUTTON_EN } = await mod('node/legal.mjs');
const { CTA, ctaTarget } = await mod('node/attention.mjs');
const { OFFER } = await mod('node/seo.mjs');
const { offersJson, siteReport, siteOwnerCheck, entryListing } = await mod('node/offers.mjs');
const { DECLARE, CONFIRM, DECL, DECL_ID, OPERATOR_PATH, mailConfig, declareAnswer } = await mod('node/declare.mjs');
const { KEPT } = await mod('node/durable.mjs');
const { diskKv } = await mod('node/disk.mjs');
const { HUB_PATHS, HUB_ALT } = await mod('node/hubs.mjs');
const { LICENCES } = await mod('node/open.mjs');
const route = pricingOf({ cents: DEFAULT_CENTS, payTo: HOUSE_WALLET });
// the range the operator may set without a release: every cent priceOf keeps as it was asked
const kept = Array.from({ length: 101 }, (_, c) => c).filter((c) => priceOf({ MARE_ROUTE_PRICE_CENTS: String(c) }).cents === c);
const range = [Math.min(...kept), Math.max(...kept)].map((c) => c / 100);
const rows = pricingRows('https://mare.test', route);
// (since 3.60 a row may also name the price of a year paid ahead: eurYear, the reader ladder and the Reederei)
const EUROS = [...new Set(rows.flatMap((r) => [r.eur, r.yearly, r.eurYear]).filter((x) => Number(x) > 0))].sort((a, b) => a - b);
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
    // the free quota with its unit (since 3.55 the texts also sell 10,000 pages, so the bare number would not be the toll's)
    quota: de ? new RegExp(`${group(TOLL.free, '.').replaceAll('.', '\\.')} [^<.;]{0,40}?eingesparte Tokens`) : new RegExp(`${group(TOLL.free, ',')} tokens saved`),
    toll: de
      ? [pct(TOLL.share), `${usd2(TOLL.settle, 'de')} USD`, `${dec(TOLL.perMillion, 'de')} USD je Million`]
      : [pct(TOLL.share), `USD ${usd2(TOLL.settle, 'en')}`, `USD ${dec(TOLL.perMillion, 'en')} per million`],
    vat: '§ 19 UStG',
  };
};
const PRICED = new Set(['/terms', '/de/agb', '/de/preise']);
const ALL = [...LEGAL_PATHS, '/impressum'];
const langOf = (p) => (p.startsWith('/de/') || p === '/impressum' ? 'de' : 'en');
const textOf = (html) => String(html).replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const has = (t, w, where) => assert.ok(w instanceof RegExp ? w.test(t) : t.includes(w), `${where}: missing "${w}"`);

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
    for (const w of [...f.euros, ...f.route, ...f.fair, f.quota, ...f.toll, f.vat]) has(t, w, p);
    has(pages[p].twin.text, f.quota, `${p}.md`); has(pages[p].twin.text, f.euros[f.euros.length - 1], `${p}.md`);
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
await proof('Datenschutz and privacy: controller, hosting in Helsinki and the database in Ireland, the Vercel redirect, the system log, counts per network, x402 and its facilitator, Stripe, email, no cookies, where a commission link leads, legal bases, rights and objection, the LDI NRW', async () => {
  for (const [p, words] of [['/de/datenschutz', ['Verantwortlich', 'Hetzner', 'Helsinki', 'Supabase', 'Irland', 'Vercel', 'mare-liberum.vercel.app', 'journald', '30 Tagen', 'IPv6', '/64', 'PayAI', 'Base', 'Stripe', 'Gmail', 'keine Cookies', 'Art. 6 Abs. 1 lit. b', 'lit. c', 'lit. f', 'Art. 15', 'Art. 17', 'Art. 21', 'Widerspruchsrecht', 'Art. 77', 'LDI NRW', 'Kavalleriestraße 2–4, 40213 Düsseldorf', 'Data Privacy Framework', 'Standardvertragsklauseln', 'Provisionslinks', 'Partnernetz', 'nie, wer gekauft hat']],
    ['/privacy', ['controller', 'Hetzner', 'Helsinki', 'Supabase', 'Ireland', 'Vercel', 'mare-liberum.vercel.app', 'journald', '30 days', 'IPv6', '/64', 'PayAI', 'Base', 'Stripe', 'Gmail', 'no cookies', 'Art. 6(1)(b)', '(c)', '(f)', 'Art. 15', 'Art. 17', 'Art. 21', 'Right to object', 'Art. 77', 'LDI NRW', 'Kavalleriestraße 2–4, 40213 Düsseldorf', 'Data Privacy Framework', 'standard contractual clauses', 'Commission links', 'network', 'never who bought']]]) for (const w of words) has(pages[p].text, w, p);
});
await proof('Widerrufsbelehrung: the statutory model for services (as Anlage 1 EGBGB reads now: "oder eine E-Mail"; Gestaltungshinweis 3 for the online function of § 356a BGB), the early end for services and digital content (§ 356 Abs. 5 and 6 BGB), the model form, an English translation', async () => {
  const t = pages['/de/widerruf'].text;
  for (const w of [`Sie können Ihr Widerrufsrecht auch online unter https://mareliberum.dev${BUTTON_DE.withdraw} (Schaltfläche „Vertrag widerrufen“ unten auf jeder Seite) ausüben.`, 'Wenn Sie diese Online-Funktion nutzen, übermitteln wir Ihnen auf einem dauerhaften Datenträger (z. B. durch eine E-Mail) unverzüglich eine Eingangsbestätigung mit Informationen zum Inhalt der Widerrufserklärung sowie dem Datum und der Uhrzeit ihres Eingangs.',
    `You can also exercise your right of withdrawal online at https://mareliberum.dev${BUTTON_EN.withdraw}`, 'an acknowledgement of receipt with information on the content of the notice of withdrawal and the date and time of its receipt']) has(t, w, '/de/widerruf');
  assert.ok(pages['/de/widerruf'].html.text.includes(`href="${BUTTON_DE.withdraw}"`), 'the Belehrung links the online function');
  for (const w of ['binnen vierzehn Tagen ohne Angabe von Gründen', 'ab dem Tag des Vertragsabschlusses', '(z. B. ein mit der Post versandter Brief oder eine E-Mail)', 'Folgen des Widerrufs', 'Haben Sie verlangt, dass die Dienstleistungen während der Widerrufsfrist beginnen soll', '§ 356 Abs. 5 BGB', '§ 356 Abs. 6 BGB', '§ 312f BGB', 'Muster-Widerrufsformular', 'Unzutreffendes streichen', 'Unternehmern steht kein Widerrufsrecht zu', 'Right of withdrawal (English translation)', 'within 14 days without giving any reason']) has(t, w, '/de/widerruf');
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
  for (const [k, q] of [['imprint', '/impressum'], ['terms', '/terms'], ['privacy', '/privacy'], ['agb', '/de/agb'], ['datenschutz', '/de/datenschutz'], ['preise', '/de/preise'], ['widerruf', '/de/widerruf'], ['withdraw', BUTTON_DE.withdraw], ['cancel', BUTTON_DE.cancel]]) assert.equal(a[k], `https://mareliberum.dev${q}`, k);
});
await proof('the old addresses still lead to the legal pages (/imprint, /legal, /privacy-policy)', async () => {
  for (const [from, to] of [['/imprint', '/impressum'], ['/legal', '/impressum'], ['/privacy-policy', '/privacy']]) { const r = await node.call(from); assert.equal(r.status, 308, from); assert.equal(r.headers.get('location'), `https://mareliberum.dev${to}`, from); }
});

// ------------------------------------------------------------------ the offers in euro: business customers only, behind the order page
const SALE = /^https:\/\/buy\.stripe\.com\//;
// the payment links that sell, read from the code: the house offers (node/offers.mjs) and the harbours (node/seo.mjs)
const SALE_LINKS = new Set([...Object.values(OFFERS).map((o) => o.link), ...Object.values(OFFER)].filter((u) => SALE.test(String(u || ''))));
// the services of the counted door that lead to one of them
// (since 3.63) the agent packs in USD are for everyone, consumers included (CTA.everyone): no box, their order page leads straight
// to Stripe (tools/checkout-proof.mjs proves it); every other sale keeps the box of § 14 BGB
const SALES = Object.keys(CTA).filter((id) => SALE.test(String(ctaTarget(id) || '')) && !CTA[id].everyone);
const OPEN_SALES = Object.keys(CTA).filter((id) => SALE.test(String(ctaTarget(id) || '')) && CTA[id].everyone);
const nodeFiles = readdirSync(join(ROOT, 'node')).filter((f) => f.endsWith('.mjs'));
const linksIn = (t) => [...String(t).matchAll(/https:\/\/buy\.stripe\.com\/[A-Za-z0-9_]+/g)].map((m) => m[0]);
await proof(`every payment link in the code is either a sale (${SALE_LINKS.size}, each reached only through its door /c/<service>) or the one voluntary support of the open atlas`, () => {
  assert.ok(SALE_LINKS.size >= 5 && SALES.length >= 5, `${SALE_LINKS.size} sale links, ${SALES.length} doors`);
  for (const u of SALE_LINKS) assert.ok([...SALES, ...OPEN_SALES].some((id) => ctaTarget(id) === u), `${u}: a sale link without a door`);
  for (const id of [...SALES, ...OPEN_SALES]) assert.ok(SALE_LINKS.has(ctaTarget(id)), `${id}: a door to a link the code does not sell through`);
  const donations = new Set();
  // (a copy of the code for a negative control holds node/, tools/ and site/; the sources of the home page stay with the repository)
  for (const f of [...nodeFiles.map((x) => `node/${x}`), 'site/index.html', 'homepage/src/page.html'].filter((x) => existsSync(join(ROOT, x)))) {
    const lines = readFileSync(join(ROOT, f), 'utf8').split('\n');
    lines.forEach((l, i) => { for (const u of linksIn(l)) if (!SALE_LINKS.has(u)) { assert.match(l, /Support the (open )?atlas/, `${f}:${i + 1}: a payment link that is neither a sale nor the support of the atlas: ${u}`); donations.add(u); } });
  }
  assert.equal(donations.size, 1, 'one link for the voluntary support');
  for (const u of donations) assert.ok(!SALE_LINKS.has(u));
});
await proof('(3.63) the sales for everyone are exactly the agent packs in USD (agent10, agent49, agent99); their order pages lead straight to the payment link', async () => {
  assert.deepEqual(OPEN_SALES, ['agent10', 'agent49', 'agent99']);
  for (const id of OPEN_SALES) { assert.match(CTA[id].price, /USD/, id); const go = await node.call(`/c/${id}?from=pricing`, { accept: 'text/html', ...BROWSER }); assert.equal(go.status, 302, id); assert.equal(go.headers.get('location'), ctaTarget(id), id); }
});
for (const [from, lang] of [['pricing', 'en'], ['law', 'de']]) {
  await proof(`the order page (${lang}) stands before every sale (${SALES.join(', ')}): a notice for business customers, the price, a box that must be ticked, a plain form; ticked, the door leads to the payment link with its reference as before`, async () => {
    const W = GATE_WORDS[lang], box = `<input type="checkbox" name="${GATE.field}" value="${GATE.value}" required>`;
    for (const id of SALES) {
      const r = await node.call(`/c/${id}?from=${from}&ref=page-x`, { accept: 'text/html', ...BROWSER }), h = r.text, t = textOf(h);
      assert.equal(r.status, 200, id); assert.equal(r.headers.get('location'), null, id); assert.match(r.headers.get('content-type') || '', /^text\/html/, id);
      assert.match(r.headers.get('cache-control') || '', /no-store/, id); assert.match(r.headers.get('x-robots-tag') || '', /noindex/, id);
      assert.match(h, new RegExp(`<html[^>]* lang="${lang}"`), `${id} lang`);
      for (const w of [`<form method="get" action="/c/${id}" class="box">`, box, `name="from" value="${from}"`, 'name="ref" value="page-x"', `name="${GATE.go}" value="1"`]) assert.ok(h.includes(w), `${id}: missing ${w}`);
      assert.equal((h.match(/<input type="checkbox"/g) || []).length, 1, `${id}: one box`);
      for (const w of [W.title, W.box, W.go, 'Nur für Unternehmer im Sinne von § 14 BGB', lang === 'de' ? 'Gemäß § 19 UStG' : 'No VAT is charged', lang === 'de' ? 'Als Verbraucher (§ 13 BGB) können Sie hier nicht bestellen.' : 'Consumers (§ 13 BGB) cannot order here.']) has(t, w, `/c/${id}`);
      if (lang === 'en') has(t, CTA[id].price, `/c/${id}`);
      assert.ok(!SALE.test(h) && !h.includes('buy.stripe.com'), `${id}: a payment link before the box`);
      const ok = await node.call(`/c/${id}?from=${from}&ref=page-x&${GATE.field}=${GATE.value}&${GATE.go}=1`, { accept: 'text/html', ...BROWSER });
      assert.equal(ok.status, 302, `${id} ticked`); assert.equal(ok.headers.get('location'), ctaTarget(id, 'page-x'), `${id}: the payment link with its reference`);
      const no = await node.call(`/c/${id}?from=${from}&ref=page-x&${GATE.go}=1`, { accept: 'text/html', ...BROWSER });
      assert.equal(no.status, 200, `${id} unticked`); assert.equal(no.headers.get('location'), null); assert.ok(no.text.includes('role="alert"') && no.text.includes(box), `${id}: asked again`);
    }
    assert.ok(GATE_WORDS.de.title === 'Nur für Unternehmer im Sinne von § 14 BGB' && GATE_WORDS.de.box === 'Ich bestelle als Unternehmer (§ 14 BGB) für mein Unternehmen', 'the German words as Daouda set them');
  });
}
await proof('no page and no data hand out a sale link: every button to a sale is its door, and the data name the door (pay, go), never the payment link', async () => {
  const B = 'https://mareliberum.dev', doors = new Set();
  for (const p of ['/offers', '/pricing', '/claim', '/attention', '/business', '/de/unternehmen', '/de/agenturen', '/teams', '/de/kanzleien', '/offers/sample-report', '/de/preise', '/de/agb', '/terms', '/impressum', '/about']) {
    for (const [r, w] of [[await node.call(p, { accept: 'text/html', ...BROWSER }), 'html'], [await node.call(`${p}.md`, { accept: 'text/markdown' }), 'md']]) {
      assert.equal(r.status, 200, `${p} ${w}`);
      for (const u of linksIn(r.text)) assert.ok(!SALE_LINKS.has(u), `${p} (${w}) hands out ${u}`);
      for (const m of r.text.matchAll(/\/c\/([a-z]{2,12})\?/g)) if (SALES.includes(m[1])) doors.add(m[1]);
    }
  }
  for (const id of SALES) assert.ok(doors.has(id), `no button leads to the door of ${id}`);
  const data = { '/pricing.json': (await node.call('/pricing.json')).text, '/offers.json': (await node.call('/offers.json')).text, '/claim.json': (await node.call('/claim.json')).text, '/about': (await node.call('/about')).text,
    offersJson: JSON.stringify(offersJson(B)), siteReport: JSON.stringify(siteReport('example.com', B)), siteOwnerCheck: JSON.stringify(siteOwnerCheck('example.com', B)), entryListing: JSON.stringify(entryListing({ identifier: 'urn:air:example.com:mcp:rope' }, B)) };
  for (const [k, v] of Object.entries(data)) for (const u of linksIn(v)) assert.ok(!SALE_LINKS.has(u), `${k} hands out ${u}`);
  for (const o of offersJson(B).paid) { assert.equal(o.pay, o.go, o.id); assert.ok(o.pay.startsWith(`${B}/c/`), o.id); assert.match(o.customers, /§ 14 BGB/); }
  assert.ok(siteReport('example.com', B).pay.startsWith(`${B}/c/report?`) && entryListing({ identifier: 'urn:air:example.com:mcp:rope' }, B).ownerCheck.pay.startsWith(`${B}/c/owner?`));
});

// ------------------------------------------------------------------ the two buttons of §§ 356a and 312k BGB, on every page
const LAW = { de: [[BUTTON_DE.withdraw, 'Vertrag widerrufen'], [BUTTON_DE.cancel, 'Verträge hier kündigen']], en: [[BUTTON_EN.withdraw, 'Withdraw from contract'], [BUTTON_EN.cancel, 'Cancel contracts here']] };
const footOf = (h) => (/<footer id="foot">([\s\S]*?)<\/footer>/.exec(h) || [])[1] || '';
const langIn = (h) => (/<html[^>]* lang="([a-z]{2})/.exec(h) || [])[1];
// the pages of a node without a works store or a home page of its own: every hub but these, and the rest of the kinds of page
const NOT_HERE = { '/': 'the home page is site/index.html (its own look): the next proof serves it', '/works': 'the proof node keeps no works store (on the server /works is a page like any other)' };
await proof(`both buttons stand in the foot of every page, set apart and in the page's language: every hub, every legal page, the order pages, the forms, an entry that is not there`, async () => {
  const list = [...HUB_PATHS.filter((p) => !Object.hasOwn(NOT_HERE, p)), ...ALL, '/about', '/offers', '/claim', '/c/owner?from=pricing', '/c/law?from=law', ...Object.keys(DECLARE), '/e/mare.test:mcp:nothing'];
  let n = 0;
  for (const p of [...new Set(list)]) {
    const r = await node.call(p, { accept: 'text/html', ...BROWSER }), lang = langIn(r.text), foot = footOf(r.text);
    assert.ok([200, 404].includes(r.status) && /^text\/html/.test(r.headers.get('content-type') || ''), `${p}: ${r.status} ${r.headers.get('content-type')}`);
    assert.ok(lang && foot, `${p}: no foot`);
    for (const [href, words] of LAW[lang === 'de' ? 'de' : 'en']) assert.ok(foot.includes(`<a href="${href}"><strong>${words}</strong></a>`), `${p}: the foot lacks “${words}”`);
    n++;
  }
  for (const [lang, two] of Object.entries(LAW)) for (const [href, words] of two) { const r = await node.call(href, { accept: 'text/html', ...BROWSER }); assert.equal(r.status, 200, href); assert.match(r.text, new RegExp(`<h1>${words}</h1>`), `${href}: leads straight to the form of “${words}” (${lang})`); }
  assert.ok(n >= HUB_PATHS.length, `${n} pages`);
});
await proof('the home page (site/index.html, a look of its own) carries both buttons in its foot as the node serves it, once', async () => {
  const HOME = { '/': { body: readFileSync(join(ROOT, 'site/index.html'), 'utf8'), type: 'text/html; charset=utf-8' }, '/index.html': { body: readFileSync(join(ROOT, 'site/index.html'), 'utf8'), type: 'text/html; charset=utf-8' } };
  for (const p of ['/', '/index.html']) {
    const r = await node.call(p, { accept: 'text/html', ...BROWSER, cfg: { site: HOME } }), foot = footOf(r.text);
    assert.equal(r.status, 200, p); assert.equal(langIn(r.text), 'en', p);
    for (const [href, words] of LAW.en) { assert.ok(foot.includes(`<a href="${href}"><strong>${words}</strong></a>`), `${p}: the foot lacks “${words}”`); assert.equal(r.text.split(`href="${href}"`).length, 2, `${p}: ${href} once`); }
  }
  const already = { '/': { body: HOME['/'].body.replace('<p class="stamp" id="stamp"', '<a href="/withdraw-contract">Withdraw from contract</a> <a href="/cancel-contracts">Cancel contracts here</a><p class="stamp" id="stamp"'), type: HOME['/'].type } };
  const r = await node.call('/', { accept: 'text/html', ...BROWSER, cfg: { site: already } }); assert.equal(r.text.split('href="/withdraw-contract"').length, 2, 'a home page whose sources carry the buttons gets no second pair');
});
// what each form may ask (§ 356a Abs. 2 BGB, § 312k Abs. 2 BGB) and nothing more; confirm is the button
const FIELDS = { withdrawal: ['confirm', 'contract', 'date', 'email', 'name'], termination: ['confirm', 'contract', 'effective', 'email', 'name', 'reason', 'type', 'when'] };
const REQUIRED = { withdrawal: ['contract', 'email', 'name'], termination: ['contract', 'email', 'name', 'type'] };
await proof('step 2: each button leads to a form that asks only what the law allows (no reason for a withdrawal; for a cancellation its kind, a reason only if wished, the date), no login, and one button worded as the law says', async () => {
  for (const [path, d] of Object.entries(DECLARE)) {
    const r = await node.call(path, { accept: 'text/html', ...BROWSER }), h = r.text, form = (/<form method="post" action="([^"]+)"[^>]*>([\s\S]*?)<\/form>/.exec(h) || []);
    assert.equal(r.status, 200, path); assert.equal(form[1], path, `${path}: the form sends to itself`);
    const names = [...new Set([...form[2].matchAll(/<(?:input|textarea|select|button)\b[^>]*\bname="([^"]+)"/g)].map((m) => m[1]))].sort();
    assert.deepEqual(names, FIELDS[d.kind], `${path}: fields`);
    const req = [...new Set([...form[2].matchAll(/<(?:input|textarea|select)\b[^>]*\bname="([^"]+)"[^>]*\brequired\b/g)].map((m) => m[1]))].sort();
    assert.deepEqual(req, REQUIRED[d.kind], `${path}: required fields`);
    assert.doesNotMatch(form[2], /type="password"|login|account|Konto|Passwort/i, `${path}: no login`);
    const buttons = [...form[2].matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].map((m) => textOf(m[1]).trim());
    assert.deepEqual(buttons, [CONFIRM[d.kind][d.lang]], `${path}: the button`);
    assert.match(h, new RegExp(`<html[^>]* lang="${d.lang}"`), path);
    if (d.kind === 'withdrawal') assert.ok(!/name="reason"/.test(h), `${path}: a withdrawal needs no reason`);
  }
  assert.deepEqual([CONFIRM.withdrawal.de, CONFIRM.termination.de], ['Widerruf bestätigen', 'jetzt kündigen'], 'the words of § 356a Abs. 3 and § 312k Abs. 2 BGB');
});
// a declaration as a browser sends it
const keyOf = (s) => createHash('sha256').update(s).digest('hex');
const OPKEY = 'legal-proof-operator-key', opCfg = { modKeySha: keyOf(OPKEY), declLog: () => {} };
let ipN = 0;
const send = (path, fields, { ip, origin = 'https://mareliberum.dev', json = false, cfg = opCfg } = {}) => node.call(path, { method: 'POST', accept: 'text/html', ...BROWSER, ip: ip || `192.0.2.${++ipN}`, cfg,
  body: json ? JSON.stringify(fields) : new URLSearchParams(fields).toString(), headers: { ...BROWSER.headers, 'content-type': json ? 'application/json' : 'application/x-www-form-urlencoded', ...(origin ? { origin } : {}) } });
const MARK = { withdrawal: 'Probe Withdrawer Qx7', termination: 'Probe Canceller Zk4' };
const declared = {};
await proof('a declaration is kept with the exact time of its receipt in the node\'s own state, shown in full with that time, handed over as a text file, and the e-mail receipt is promised; what is missing is asked again, keeping what was written', async () => {
  const at = new Date().toISOString(), utc = `${at.slice(0, 19).replace('T', ' ')} UTC`;
  for (const [path, d] of Object.entries(DECLARE)) {
    const fields = d.kind === 'withdrawal' ? { name: `${MARK.withdrawal} ${d.lang}`, contract: 'Bericht für example.com', date: '2026-11-20', email: 'probe@example.com', confirm: '1' }
      : { type: 'extraordinary', reason: 'Dienst nicht erreichbar', name: `${MARK.termination} ${d.lang}`, contract: 'Team-Hafen teams-7', when: 'date', effective: '2026-12-31', email: 'probe@example.com', confirm: '1' };
    const before = (await node.cfg.kv.get(DECL.index)) || [];
    const r = await send(path, fields, { json: d.lang === 'en' && d.kind === 'termination' }), id = r.headers.get('x-declaration-id'), t = textOf(r.text);
    assert.equal(r.status, 200, `${path}: ${t.slice(0, 200)}`); assert.match(id || '', DECL_ID, path); assert.match(r.headers.get('cache-control') || '', /no-store/);
    for (const w of [id, utc, fields.name, fields.contract, fields.email, CONFIRM[d.kind][d.lang], d.lang === 'de' ? 'Ortszeit Köln' : 'local time in Köln', d.lang === 'de' ? 'folgt per E-Mail an probe@example.com' : 'follows by email to probe@example.com']) has(t, w, path);
    if (d.kind === 'termination') has(t, d.lang === 'de' ? 'zum 31.12.2026' : 'on 2026-12-31', path);
    const pre = /<pre id="declaration">([\s\S]*?)<\/pre>/.exec(r.text)?.[1], file = /<a href="data:text\/plain;charset=utf-8,([^"]+)" download="([^"]+)"/.exec(r.text);
    assert.ok(pre && file, `${path}: the declaration and its file`); assert.match(file[2], new RegExp(`-${id}\\.txt$`));
    assert.equal(decodeURIComponent(file[1].replace(/&amp;/g, '&')), textOf(pre).trim() === '' ? '' : pre.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&'), `${path}: the file says what the page says`);
    const x = await node.cfg.kv.get(`${DECL.prefix}${id}`), after = await node.cfg.kv.get(DECL.index);
    assert.equal(x.at, at, `${path}: the time of receipt`); assert.deepEqual([x.kind, x.lang, x.name, x.email, x.contract, x.page], [d.kind, d.lang, fields.name, fields.email, fields.contract, path]);
    assert.equal(x.mail.state, 'off', 'no mail key, no mail'); assert.equal(after[0].id, id); assert.equal(after.length, before.length + 1);
    declared[path] = { id, name: fields.name };
    const miss = await send(path, { ...fields, email: 'not an address' });
    assert.equal(miss.status, 422, `${path}: missing`); assert.ok(miss.text.includes('role="alert"') && miss.text.includes(`value="${fields.name}"`), `${path}: asked again with what was written`);
    assert.equal(((await node.cfg.kv.get(DECL.index)) || []).length, after.length, `${path}: nothing kept for an incomplete declaration`);
  }
  const bad = await send(BUTTON_DE.cancel, { type: 'ordinary', name: 'x', contract: 'y', when: 'date', effective: '2026-02-30', email: 'a@b.de' }); assert.equal(bad.status, 422, 'a date that does not exist');
  const cross = await send(BUTTON_DE.withdraw, { name: 'x', contract: 'y', email: 'a@b.de' }, { origin: 'https://evil.example' }); assert.equal(cross.status, 403, 'a page of another site sends nothing in a visitor\'s name');
  const ip = '192.0.2.250'; let last = null; for (let i = 0; i < DECL.perHour + 1; i++) last = await send(BUTTON_EN.withdraw, { name: `flood ${i}`, contract: 'y', email: 'a@b.de' }, { ip });
  assert.equal(last.status, 429, 'at most perHour declarations an hour from one network'); assert.equal(last.headers.get('retry-after'), '3600');
});
await proof('the declarations are no public data: kept under a name the database never takes, on no public door, readable only with the operator\'s moderation key (x-mare-mod, MOD_KEY_SHA of node/flow.mjs)', async () => {
  assert.equal(KEPT.test(`${DECL.prefix}w20261125abcdefgh`), false); assert.equal(KEPT.test(DECL.index), false);
  const src = readFileSync(join(ROOT, 'node/declare.mjs'), 'utf8'); assert.match(src, /import \{ MOD_KEY_SHA \} from '\.\/flow\.mjs';/); assert.match(src, /keySha = MOD_KEY_SHA/);
  const { id } = declared[BUTTON_DE.withdraw];
  for (const [h, why] of [[{}, 'no key'], [{ 'x-mare-mod': 'wrong' }, 'a wrong key']]) for (const q of ['', `?id=${id}`]) { const r = await node.call(`${OPERATOR_PATH}${q}`, { headers: h, cfg: opCfg }); assert.equal(r.status, 403, `${why} ${q}`); assert.ok(!r.text.includes(MARK.withdrawal)); }
  const all = await node.call(OPERATOR_PATH, { headers: { 'x-mare-mod': OPKEY }, cfg: opCfg }), j = JSON.parse(all.text);
  assert.equal(all.status, 200); assert.match(all.headers.get('cache-control') || '', /no-store/); for (const k of Object.values(declared)) assert.ok(j.declarations.some((x) => x.id === k.id && x.name === k.name), k.id);
  const one = JSON.parse((await node.call(`${OPERATOR_PATH}?id=${id}`, { headers: { 'x-mare-mod': OPKEY }, cfg: opCfg })).text); assert.equal(one.declaration.id, id); assert.match(one.text, new RegExp(id));
  assert.equal((await node.call(`${OPERATOR_PATH}?id=nothing`, { headers: { 'x-mare-mod': OPKEY }, cfg: opCfg })).status, 404);
  assert.equal((await node.call(OPERATOR_PATH, { headers: { 'x-mare-mod': OPKEY } })).status, 403, 'the sea\'s own key, not the proof\'s, opens it on a node as shipped');
  const doors = ['/open.json', '/stats', '/flow', '/pulse', '/durable', '/attention.json', '/about', '/llms.txt', '/sitemaps/hubs.xml', `/brain?q=${encodeURIComponent(MARK.withdrawal)}`, ...Object.keys(DECLARE), ...Object.keys(DECLARE).map((p) => `${p}.md`), `${OPERATOR_PATH}.md`, `${OPERATOR_PATH}?id=${id}`];
  for (const p of doors) for (const accept of ['application/json', 'text/html', 'text/markdown']) { const r = await node.call(p, { accept, ...BROWSER }); for (const k of Object.values(declared)) assert.ok(!r.text.includes(k.name) && !r.text.includes(k.id), `${p} (${accept}) shows a declaration`); }
  for (const q of [MARK.withdrawal, MARK.termination]) { const m = await node.rpc('/mcp', 'tools/call', { name: 'search', arguments: { query: q } }); assert.ok(!Object.values(declared).some((k) => m.text.includes(k.name) || m.text.includes(k.id)), 'the MCP door'); }
});
await proof('on a server the declaration is in the copy of the state on disk at once (MARE_STATE), not with the next minute', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'legal-state-')), f = join(dir, 'sea.ndjson'), disk = diskKv(f, { everyMs: 1e9 }); await disk.ready;
  const waits = [], base = 'https://mareliberum.dev';
  const req = new Request(`${base}${BUTTON_DE.cancel}`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', origin: base }, body: new URLSearchParams({ type: 'ordinary', name: 'Disk Probe', contract: 'Team-Hafen', email: 'disk@example.com' }).toString() });
  const r = await declareAnswer({ req, path: BUTTON_DE.cancel, base, kv: disk, ip: '192.0.2.200', mail: mailConfig({}), save: () => disk.save(), waitUntil: (p) => waits.push(p), log: () => {} });
  await Promise.all(waits); const id = r.headers.get('x-declaration-id');
  assert.equal(r.status, 200); const line = readFileSync(f, 'utf8').split('\n').find((l) => l.includes(`"${DECL.prefix}${id}"`));
  assert.ok(line && line.includes('Disk Probe') && line.includes(new Date().toISOString()), 'the declaration with its time, on disk'); drop(dir);
});
await proof('the e-mail receipt: off until the operator sets a mail key and a sender (MARE_MAIL_KEY, MARE_MAIL_FROM; MARE_MAIL=off stops it); then one message through the HTTP mail API with the declaration, its date and time, a copy to the operator', async () => {
  assert.equal(mailConfig({}).on, false); assert.equal(mailConfig({ MARE_MAIL_KEY: 'k' }).on, false); assert.equal(mailConfig({ MARE_MAIL_FROM: 'a@b.de' }).on, false);
  assert.equal(mailConfig({ MARE_MAIL_KEY: 'k', MARE_MAIL_FROM: 'a@b.de', MARE_MAIL: 'off' }).on, false); assert.equal(mailConfig({ MARE_MAIL_KEY: 'k', MARE_MAIL_FROM: 'a@b.de', MARE_MAIL_URL: 'http://x.example/send' }).on, false);
  assert.equal(mailConfig(process.env).on, false, 'as shipped: off'); assert.equal(mailConfig({ MARE_MAIL_KEY: 'k', MARE_MAIL_FROM: 'a@b.de' }).url, 'https://api.resend.com/emails');
  const sent = [], waits = [];
  const on = { ...opCfg, mail: mailConfig({ MARE_MAIL_KEY: 'test-key', MARE_MAIL_FROM: 'Mare Liberum <legal@mail.example>' }), waitUntil: (p) => waits.push(p), mailFetch: async (u, o) => { sent.push({ u, o }); return new Response('{"id":"x"}', { status: 200 }); } };
  const r = await send(BUTTON_DE.withdraw, { name: 'Mail Probe', contract: 'Bericht', email: 'mail@example.com' }, { cfg: on }); await Promise.all(waits);
  const id = r.headers.get('x-declaration-id'), b = JSON.parse(sent[0]?.o.body || '{}');
  assert.equal(sent.length, 1); assert.equal(sent[0].u, 'https://api.resend.com/emails'); assert.equal(sent[0].o.method, 'POST'); assert.equal(sent[0].o.headers.authorization, 'Bearer test-key');
  assert.deepEqual([b.from, b.to, b.bcc, b.reply_to], ['Mare Liberum <legal@mail.example>', ['mail@example.com'], [SELLER.email], SELLER.email]);
  for (const w of [id, 'Eingangsbestätigung', 'Mail Probe', 'Widerruf bestätigen', `${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC`]) assert.ok(b.text.includes(w), `the mail: ${w}`); assert.ok(b.subject.includes(id));
  assert.equal((await node.cfg.kv.get(`${DECL.prefix}${id}`)).mail.state, 'sent');
  const w2 = [], r2 = await send(BUTTON_DE.withdraw, { name: 'Mail Probe 2', contract: 'Bericht', email: 'mail@example.com' }, { cfg: { ...on, waitUntil: (p) => w2.push(p), mailFetch: async () => new Response('no', { status: 500 }) } }); await Promise.all(w2);
  assert.deepEqual((await node.cfg.kv.get(`${DECL.prefix}${r2.headers.get('x-declaration-id')}`)).mail, { state: 'failed', at: new Date().toISOString(), error: 'status 500' }, 'a failed mail is kept as failed, for the operator to send by hand');
});
await proof('the texts say it: AGB, terms and Preisverzeichnis restrict the offers in euro to businesses and name the order page; both buttons in AGB/terms; the privacy texts name the declarations, where they are kept and for how long', async () => {
  for (const w of ['ausschließlich an Unternehmer im Sinne von § 14 BGB', 'Verbraucher (§ 13 BGB) können sie nicht bestellen', 'durch Ankreuzen', 'Bestellseite', 'zwingenden gesetzlichen Rechte unberührt', '„Verträge hier kündigen“', '„Vertrag widerrufen“']) has(pages['/de/agb'].text, w, '/de/agb');
  for (const w of ['exclusively for businesses within the meaning of § 14 BGB', 'Consumers (§ 13 BGB) cannot order them', 'by ticking a box', 'order page', 'mandatory statutory rights remain unaffected', '“Cancel contracts here”', '“Withdraw from contract”']) has(pages['/terms'].text, w, '/terms');
  for (const w of ['Die Angebote in Euro richten sich ausschließlich an Unternehmer im Sinne von § 14 BGB.', 'Bestellseite']) has(pages['/de/preise'].text, w, '/de/preise');
  for (const w of ['Widerruf und Kündigung über die Schaltflächen', 'nicht in der Datenbank', 'vier Jahre', '§§ 312k und 356a BGB']) has(pages['/de/datenschutz'].text, w, '/de/datenschutz');
  for (const w of ['Withdrawal and cancellation through the buttons', 'not in the database', 'four years', '§§ 312k and 356a BGB']) has(pages['/privacy'].text, w, '/privacy');
  // reader credit (CR8): while a purchase's payment is not settled, wallet, nonce and expiry of the signed transfer in clear, and when they go
  has(pages['/de/datenschutz'].text, 'Solange die Zahlung eines Kaufs nicht abgewickelt ist, bewahrt der Knoten außerdem die Adresse der zahlenden Wallet, die Nonce und das Ende der Gültigkeit der signierten Überweisung im Klartext auf, um in der öffentlichen Blockchain nachzusehen, ob das Geld angekommen ist. Diese Angaben werden gelöscht, sobald das entschieden ist (abgewickelt, zurückgenommen oder das Token abgelaufen), spätestens etwa zehn Minuten nach dem Ende der Gültigkeit der Überweisung, länger nur, solange die Blockchain nicht befragt werden kann.', '/de/datenschutz');
  has(pages['/privacy'].text, 'While the payment of a purchase is not yet settled, the node also keeps the address of the paying wallet, the nonce and the expiry of the signed transfer in clear, so that it can ask the public blockchain whether the money arrived. These are deleted as soon as that is decided (settled, taken back, or the token expired), at the latest about ten minutes after the expiry of the transfer, longer only while the blockchain cannot be asked.', '/privacy');
  for (const p of ['/de/agb', '/de/datenschutz']) for (const q of [BUTTON_DE.withdraw, BUTTON_DE.cancel]) assert.ok(pages[p].html.text.includes(`href="${q}"`), `${p} → ${q}`);
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
    ['the AGB name another free quota of the toll', 'node/legal.mjs', "'Freikontingent: Bis zu 10.000 durch diese Hebel", "'Freikontingent: Bis zu 15.000 durch diese Hebel"],
    ['the Preisverzeichnis names a price no offer has', 'node/legal.mjs', "'29 € einmalig je Website'", "'29 € einmalig je Website, Express 49 €, Premium 99 €'"],
    ['the operator is named without the VAT rule', 'node/legal.mjs', ' · E-Mail: ${mail()}. ${esc(SELLER.vat)}</p></div>', ' · E-Mail: ${mail()}.</p></div>'],
    ['the app door changes its words', 'node/core.mjs', "instructions: 'Mare Liberum is an open, ownerless place for AI agents, with no accounts.'", "instructions: 'Mare Liberum is an open, ownerless place for AI agents, without accounts.'"],
    ['the order page lets one pass without the box', 'node/legal.mjs', 'value="${GATE.value}" required>', 'value="${GATE.value}">'],
    ['the door skips the order page', 'node/core.mjs', 'if (sale && !agreed) return new Response(gatePage(', 'if (false && sale && !agreed) return new Response(gatePage('],
    ['the data of /offers hand out the payment link', 'node/offers.mjs', "pay: `${base}${go(doorOf(o.id), 'offers')}`", 'pay: o.link'],
    ['the foot loses the cancel button', 'node/skin.mjs', "['/de/vertraege-kuendigen', 'Verträge hier kündigen']]", "['/de/kuendigung', 'Kündigung']]"],
    ['the withdrawal form asks for a reason', 'node/declare.mjs', "${area('contract', DECL.fields.contract)}\\n${text('date', 10, false, 'date')}", "${area('contract', DECL.fields.contract)}\\n${area('reason', 1000, false)}\\n${text('date', 10, false, 'date')}"],
    ['the cancel button says something else', 'node/declare.mjs', "termination: { de: 'jetzt kündigen'", "termination: { de: 'Kündigung absenden'"],
    ['declarations go where the database keeps them', 'node/declare.mjs', "prefix: 'legal:decl:'", "prefix: 'mind:decl:'"],
    ['the operator door opens without the key', 'node/declare.mjs', "if (!key || !sameHash(key, keySha))", 'if (false)'],
    ['the Belehrung loses the online function', 'node/legal.mjs', '<p>Sie können Ihr Widerrufsrecht auch online unter', '<p>Sie können Ihr Widerrufsrecht nicht online unter'],
    ['the receipt is mailed although no key is set', 'node/declare.mjs', 'const on = !off && !!key && !!from', 'const on = !off'],
    ['the home page loses the buttons', 'node/core.mjs', 'b = homeButtons(b);', 'b = b;'],
    ['the privacy notice loses the sentence on reader credit not yet settled (wallet, nonce, expiry in clear)', 'node/legal.mjs', ' Solange die Zahlung eines Kaufs nicht abgewickelt ist, bewahrt der Knoten außerdem die Adresse der zahlenden Wallet, die Nonce und das Ende der Gültigkeit der signierten Überweisung im Klartext auf, um in der öffentlichen Blockchain nachzusehen, ob das Geld angekommen ist. Diese Angaben werden gelöscht, sobald das entschieden ist (abgewickelt, zurückgenommen oder das Token abgelaufen), spätestens etwa zehn Minuten nach dem Ende der Gültigkeit der Überweisung, länger nur, solange die Blockchain nicht befragt werden kann.', ''],
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
