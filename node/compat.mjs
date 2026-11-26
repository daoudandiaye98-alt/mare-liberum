// Mare Liberum · the reader in the shapes agent stacks already ask for (since 3.38, decision D5 of the night of 25/26 Nov 2026)
// Two drop-ins on the same reader (node/reader.mjs, node/lens.mjs read) with every protection it has: robots.txt, the egress
// gate (public names only, every redirect checked again), its size and time limits, the free limit of 100 pages a day per
// network, the immune system's pace. Savings are counted by the ledger's one rule only, in the reader itself (lens.mjs).
//   Jina-style  GET /r/<page address> with one of Jina Reader's request headers (X-Return-Format or X-Respond-With,
//               X-With-Links-Summary, X-No-Cache, X-Cache-Tolerance, X-Target-Selector, X-Remove-Selector): Jina's plain
//               text layout (Title:, URL Source:, Warning:, Markdown Content:, Links/Buttons:), or its JSON with Accept:
//               application/json. Without one of those headers /r/ answers byte for byte as before.
//   Firecrawl   POST /v1/scrape and POST /v2/scrape {url, formats, onlyMainContent, includeTags, excludeTags, maxAge}:
//               {success: true, data: {markdown, html, rawHtml, links, metadata}}, as Firecrawl's SDKs read it.
// No key is needed. An Authorization header is accepted and ignored: never read, logged, kept or sent on. Options the
// reader does not have are ignored and named (Jina: a Warning: line; Firecrawl: data.warning), never an error.
// Shapes checked against the public docs on 26 Nov 2026: docs.firecrawl.dev/api-reference/endpoint/scrape (v2) and
// /api-reference/v1-endpoint/scrape (v1), github.com/jina-ai/reader and jina.ai/reader, and one answer of r.jina.ai.
import { createHash } from 'node:crypto';
import { selectorsOf } from './reader.mjs';
import { cleanUrl } from './lean.mjs';
import { tokensOf } from './engine.mjs';
import { page, esc } from './pages.mjs';

const on = (v) => /^(true|1|yes|all|on)$/i.test(String(v ?? '').trim());
const short = (s, n = 80) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);
const keyOf = (target, remove) => (target.length || remove.length ? `sel-${createHash('sha256').update(JSON.stringify([target, remove])).digest('hex').slice(0, 16)}` : null);
const selList = (v) => [].concat(v ?? []).flatMap((x) => String(x ?? '').split(',')).map((x) => x.trim()).filter(Boolean).slice(0, 40);

// ---------------------------------------------------------------- Jina-style: the headers of a request to /r/
// the headers that make a request to /r/ one in Jina's form; DNT (sent by browsers) and Authorization change nothing
export const JINA_HEADERS = ['x-respond-with', 'x-return-format', 'x-with-links-summary', 'x-with-images-summary', 'x-with-generated-alt', 'x-no-cache', 'x-cache-tolerance', 'x-target-selector', 'x-remove-selector', 'x-wait-for-selector', 'x-timeout', 'x-set-cookie', 'x-proxy-url', 'x-proxy', 'x-engine', 'x-locale', 'x-retain-images', 'x-retain-links', 'x-token-budget', 'x-max-tokens', 'x-keep-img-data-url', 'x-with-iframe', 'x-with-shadow-dom', 'x-robots-txt', 'x-respond-timing', 'x-markdown-chunking', 'x-preset', 'x-detach-invisibles'];
const JINA_IGNORED = {
  'x-with-images-summary': 'no images summary', 'x-with-generated-alt': 'no image captions', 'x-wait-for-selector': 'no browser: nothing is waited for',
  'x-timeout': "the reader's own limits apply", 'x-set-cookie': 'cookies are never sent to the page', 'x-proxy-url': 'no proxy is used', 'x-proxy': 'no proxy is used',
  'x-engine': 'one engine: a plain read, no browser', 'x-locale': 'no locale is set', 'x-retain-images': 'images stay as the reader writes them', 'x-retain-links': 'links stay as the reader writes them',
  'x-token-budget': 'use budget= on /r/ without these headers', 'x-max-tokens': 'use budget= on /r/ without these headers', 'x-keep-img-data-url': 'image data is never kept',
  'x-with-iframe': 'frames are not read', 'x-with-shadow-dom': 'no browser', 'x-robots-txt': 'robots.txt is always followed, as MareLiberum-Reader', 'x-respond-timing': 'answered when read',
  'x-markdown-chunking': 'one piece', 'x-preset': 'no presets', 'x-detach-invisibles': 'no browser',
};
const FORMS = { markdown: 'markdown', content: 'markdown', text: 'text', html: 'html' };
// the request in Jina's form, or null when it carries none of those headers (then /r/ answers as it always did)
export function jinaAsk(headers) {
  const get = (k) => headers.get(k);
  const named = JINA_HEADERS.filter((k) => get(k) != null), md = [...headers.keys()].filter((k) => /^x-md-/i.test(k));
  if (!named.length && !md.length) return null;
  const ignored = [];
  const asked = String(get('x-respond-with') ?? get('x-return-format') ?? '').trim().toLowerCase();
  const form = asked ? FORMS[asked] || null : 'markdown';
  if (asked && !form) ignored.push(`${get('x-respond-with') != null ? 'X-Respond-With' : 'X-Return-Format'}: ${short(asked, 40)} (Markdown sent)`);
  const tol = get('x-cache-tolerance'), fresh = on(get('x-no-cache')) || (tol != null && /^\d+$/.test(tol.trim()) && Number(tol) < 3600);
  const target = selList(get('x-target-selector')), remove = selList(get('x-remove-selector'));
  for (const [k, why] of Object.entries(JINA_IGNORED)) if (get(k) != null) ignored.push(`${k.replace(/(^|-)([a-z])/g, (m) => m.toUpperCase())} (${why})`);
  if (md.length) ignored.push('X-Md-* (one Markdown style)');
  for (const s of [...selectorsOf(target).bad, ...selectorsOf(remove).bad]) ignored.push(`selector "${short(s, 60)}" (only tag, #id and .class are read)`);
  return { form: form || 'markdown', links: on(get('x-with-links-summary')), fresh, ignored,
    shape: target.length || remove.length || form === 'html' ? { target, remove, key: keyOf(target, remove), ...(form === 'html' ? { raw: true } : {}) } : null };
}
// the words of the page as plain text (X-Return-Format: text): the Markdown without its marks
export const mdText = (md) => String(md || '').replace(/^```[^\n]*$/gm, '').replace(/!?\[([^\]]*)\]\([^)\s]*\)/g, '$1').replace(/\[image: [^\]]*\]/g, '').replace(/^#{1,6}\s+/gm, '').replace(/^>\s?/gm, '')
  .replace(/\*\*([^*\n]+)\*\*/g, '$1').replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/gm, '$1$2').replace(/`([^`\n]+)`/g, '$1').replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
// what the selectors did, said once (Jina: Warning:)
const shapedNote = (r, jn) => (r.shaped?.none && jn?.shape?.target?.length ? 'X-Target-Selector matched nothing on the page (the whole page follows)' : null);
// the text answer in Jina's layout: Title, URL Source, Warning (what was ignored), Markdown Content, Links/Buttons
export function jinaText(r, jn) {
  const warn = [...jn.ignored, shapedNote(r, jn), r.cached ? 'a copy from the last hour (send X-No-Cache: true for a new read)' : null, r.truncated ? 'cut at 60,000 characters' : null].filter(Boolean);
  if (jn.form === 'text') return `${mdText(r.markdown)}\n`;
  if (jn.form === 'html') return `${r.rawHtml ?? r.markdown ?? ''}`;
  const links = jn.links && (r.links || []).length ? `\n\nLinks/Buttons:\n${r.links.map((l) => `- [${String(l.text).replace(/[[\]]/g, '')}](${l.url})`).join('\n')}` : '';
  return `Title: ${r.title || ''}\n\nURL Source: ${cleanUrl(r.final || r.url || '')}\n\n${warn.length ? `Warning: ${warn.join('; ')}\n\n` : ''}Markdown Content:\n${r.markdown || ''}${links}\n`;
}
// the JSON answer in Jina's form (Accept: application/json with one of its headers): {code, status, data}
export function jinaJson(r, jn, st) {
  if (st !== 200) return { data: null, code: st, name: r.blocked ? 'RobotsTxtDisallowed' : 'ReaderError', status: st * 100, message: r.error || r.note || 'the page could not be read', readableMessage: `${r.blocked ? 'RobotsTxtDisallowed' : 'ReaderError'}: ${r.error || r.note || 'the page could not be read'}` };
  const content = jn.form === 'text' ? mdText(r.markdown) : jn.form === 'html' ? r.rawHtml ?? r.markdown ?? '' : r.markdown || '';
  const warn = [...jn.ignored, shapedNote(r, jn), r.cached ? 'a copy from the last hour (send X-No-Cache: true for a new read)' : null].filter(Boolean);
  return { code: 200, status: 20000, data: { title: r.title || '', description: r.description || '', url: cleanUrl(r.final || r.url || ''), content,
    ...(jn.links ? { links: Object.fromEntries((r.links || []).map((l) => [String(l.text), l.url])) } : {}), ...(warn.length ? { warning: warn.join('; ') } : {}), usage: { tokens: tokensOf('md', content) } } };
}

// ---------------------------------------------------------------- Firecrawl-compatible: POST /v1/scrape and /v2/scrape
export const SCRAPE_FORMATS = ['markdown', 'html', 'rawHtml', 'links'];
// asked for nothing the reader would have to do otherwise: never named (the SDKs send some of these on their own)
const QUIET = new Set(['url', 'formats', 'onlyMainContent', 'includeTags', 'excludeTags', 'maxAge', 'origin', 'integration', 'timeout', 'blockAds']);
// options the reader does not have: named when they ask for something (a value that asks for nothing is quiet)
const ASKS = {
  headers: (v) => v && typeof v === 'object' && Object.keys(v).length > 0, actions: (v) => Array.isArray(v) && v.length > 0, waitFor: (v) => Number(v) > 0, mobile: (v) => v === true,
  skipTlsVerification: (v) => v === true, location: (v) => !!v && typeof v === 'object' && Object.keys(v).length > 0, proxy: (v) => !!v && !/^(basic|auto)$/i.test(String(v)),
  removeBase64Images: (v) => v === false, storeInCache: (v) => v === false, zeroDataRetention: (v) => v === true, parsePDF: () => false, parsers: (v) => Array.isArray(v) && v.length > 0,
};
const WHY = { headers: 'never sent to the page', actions: 'no browser', waitFor: 'no browser: nothing is waited for', mobile: 'one reader for every device', skipTlsVerification: 'TLS is always verified',
  location: 'no location is set', proxy: 'no proxy is used', removeBase64Images: 'image data is never sent', storeInCache: "the reader keeps a page's Markdown one hour", zeroDataRetention: "the reader keeps a page's Markdown one hour",
  parsers: 'the reader reads HTML and text pages, not PDF or images' };
// the body of a scrape request → what to read and how, or { error }; v: 1 or 2 (maxAge: v1 reads anew unless told, v2 keeps 2 days)
export function scrapeAsk(body, v) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'send a JSON object: {"url": "https://…", "formats": ["markdown"]}' };
  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!url) return { error: 'url is required: {"url": "https://…", "formats": ["markdown"]}' };
  const ignored = [], want = new Set();
  const list = body.formats === undefined || body.formats === null ? ['markdown'] : Array.isArray(body.formats) ? body.formats : null;
  if (!list) ignored.push('formats (not a list)');
  for (const f of list || []) { const t = typeof f === 'string' ? f : f && typeof f === 'object' ? f.type : null; if (SCRAPE_FORMATS.includes(t)) want.add(t); else ignored.push(`formats: ${short(typeof t === 'string' ? t : JSON.stringify(f), 40)}`); }
  if (!want.size) { want.add('markdown'); if (list?.length || !list) ignored.push('(none of the formats asked is read here: markdown sent)'); }
  const target = selList(body.includeTags), remove = selList(body.excludeTags);
  for (const s of [...selectorsOf(target).bad, ...selectorsOf(remove).bad]) ignored.push(`tag "${short(s, 60)}" (only tag, #id and .class are read)`);
  const age = body.maxAge == null ? (v === 1 ? 0 : 172_800_000) : Number(body.maxAge);
  for (const [k, val] of Object.entries(body)) {
    if (QUIET.has(k)) continue;
    if (k in ASKS) { if (ASKS[k](val)) ignored.push(`${k} (${WHY[k]})`); continue; }
    if (val === false || val === null || val === 0 || val === '' || (Array.isArray(val) && !val.length) || (val && typeof val === 'object' && !Array.isArray(val) && !Object.keys(val).length)) continue;
    ignored.push(short(k, 40));
  }
  return { url, want, full: body.onlyMainContent === false, fresh: !(age >= 3_600_000), ignored,
    shape: target.length || remove.length || want.has('html') || want.has('rawHtml') ? { target, remove, key: keyOf(target, remove), ...(want.has('html') ? { html: true } : {}), ...(want.has('rawHtml') ? { raw: true } : {}) } : null };
}
// the answer of a scrape: { status, body } in Firecrawl's shape
export function scrapeAnswer(r, ask) {
  if (r.note && !r.url && !r.error) return { status: 403, body: { success: false, code: 'NOT_FOR_CRAWLERS', error: `${r.note}` } };
  if (r.blocked) return { status: 403, body: { success: false, code: 'ROBOTS_TXT_DISALLOWED', error: r.note || 'this site asks readers like this one not to read this page (robots.txt)' } };
  const meta = { title: r.title || '', description: r.description || '', language: r.lang || null, sourceURL: ask.url, url: r.final || r.url || ask.url, statusCode: r.status || 0, ...(r.type ? { contentType: r.type } : {}), cacheState: r.cached ? 'hit' : 'miss' };
  // the page answered with an error: Firecrawl's form (success, the page's status and the error in the metadata)
  if (r.error && r.status >= 400) return { status: 200, body: { success: true, data: { ...(ask.want.has('markdown') ? { markdown: '' } : {}), metadata: { ...meta, error: r.error } } } };
  if (r.error) return { status: 422, body: { success: false, code: /busy/.test(r.error) ? 'READER_BUSY' : 'SCRAPE_FAILED', error: r.error } };
  const warn = [...ask.ignored, r.shaped?.none && ask.shape?.target?.length ? 'includeTags matched nothing on the page (the whole page follows)' : null, r.truncated ? 'markdown cut at 60,000 characters' : null, r.partial ? 'read up to 1.5 MB of the page' : null].filter(Boolean);
  const data = {};
  if (ask.want.has('markdown')) data.markdown = r.markdown || '';
  if (ask.want.has('html')) data.html = r.html ?? null;
  if (ask.want.has('rawHtml')) data.rawHtml = r.rawHtml ?? null;
  if (ask.want.has('links')) data.links = (r.links || []).map((l) => l.url);
  data.metadata = meta;
  if (warn.length) data.warning = `Ignored or limited here: ${warn.join('; ')}.`;
  return { status: 200, body: { success: true, data } };
}
export const scrapeError = (status, code, error) => ({ status, body: { success: false, code, error } });

// ---------------------------------------------------------------- the page that says all this: /reader, /reader.md, /reader.json
export function readerDoc(base) {
  const b = String(base || '').replace(/\/+$/, '');
  return {
    what: 'The Mare Liberum reader as a drop-in for the two readers agent stacks already call: Jina Reader (a URL prefix and its request headers) and Firecrawl (POST /v1/scrape and /v2/scrape). The same reader underneath: Markdown instead of HTML, robots.txt followed, public addresses only, free up to 100 pages a day per network.',
    jina: { use: `GET ${b}/r/<full page address>`, headers: { 'X-Return-Format or X-Respond-With': 'markdown (Jina\'s layout: Title, URL Source, Markdown Content), text (the words only), html (the page\'s markup, sent as text/plain)', 'X-With-Links-Summary: true': 'a Links/Buttons: list at the end', 'X-No-Cache: true': 'a new read instead of the copy of the last hour (X-Cache-Tolerance below 3600 does the same)', 'X-Target-Selector / X-Remove-Selector': 'keep or take out parts of the page; only tag, #id and .class (and their combinations, several split by commas) are read', 'Accept: application/json': 'with one of these headers: Jina\'s JSON {code, status, data: {title, description, url, content, usage}}' }, ignored: 'Every other Jina header (images summary, generated alt, cookies, proxies, engines, locale, timeouts, X-Md-*) is ignored and named on a Warning: line. Cookies and proxies are never used.', unchanged: 'Without one of these headers /r/ answers exactly as before, with since=, If-None-Match and budget= (the engine room, /engine).' },
    firecrawl: { use: `POST ${b}/v1/scrape or ${b}/v2/scrape {"url": "https://…", "formats": ["markdown"]}`, formats: SCRAPE_FORMATS, options: { onlyMainContent: 'true (default): the main part of the page; false: the reader\'s long Markdown (format=full)', includeTags: 'keep only these parts (tag, #id, .class)', excludeTags: 'take these parts out (tag, #id, .class)', maxAge: 'below one hour (and v1 without maxAge): a new read; otherwise the copy of the last hour may be handed out' }, answer: '{"success": true, "data": {"markdown", "html", "rawHtml", "links", "metadata": {"title", "description", "language", "sourceURL", "url", "statusCode", "cacheState"}, "warning"}}', ignored: 'Options the reader does not have (screenshots, JSON extraction, actions, browsers, proxies, locations, custom headers, PDF parsing) are ignored and named in data.warning, never an error. Custom headers are never sent to the page.', links: 'links: up to 60 links of the page\'s main part, as full addresses (in the Markdown, links within the same site are written as paths)', errors: '403 robots.txt says no; 422 not a public web page or not readable; 429 the free limit is used; a page that answers an error: success with metadata.statusCode and metadata.error, as Firecrawl does' },
    key: 'No key. An Authorization header (an SDK sends one when given a key) is accepted and ignored: it is never read, logged, kept or sent on. The one exception is reader credit: a bearer that starts with mlc_ is your credit token (below).',
    credit: { what: 'Prepaid reader credit for more than the free 100 pages a day: never credit on trust, nothing is read on credit before a verified payment.', buy: `POST ${b}/reader/credit over x402: exactly 0.05 USDC on Base buys 50 pages (0.001 USD a page), valid 30 days. An x402 client pays the 402 by itself. By card or Link: POST ${b}/reader/credit/stripe over MPP (the Machine Payments Protocol, method stripe): exactly 0.50 USD buys 500 pages (0.001 USD a page), valid 30 days; an MPP client with a Link wallet pays the 402 with a Shared Payment Token. For operators of scripts (business customers only): 10,000 pages for EUR 10 by card in the browser at ${b}/c/reader?from=reader (the order page, then Stripe); the token appears right after paying, and the link Stripe brings you back to shows it again.`, token: 'The answer shows a token (mlc_…) once. The sea keeps only its SHA-256, the pages left and the expiry. It is a bearer secret: whoever holds it can spend it; a lost token cannot be restored.', use: 'Send it as x-sea-credit: <token>, or as a Firecrawl SDK\'s api key (Authorization: Bearer mlc_…), on /r/, /read and the scrape doors.', spent: 'One page per read that would count against the free limit, and only after the network\'s 100 free pages of the UTC day; a copy of the last hour costs nothing. Every answer that spent a page says what is left: x-sea-credit-left and x-sea-credit-until.', without: 'Without credit, the limit answer is today\'s 429, with one line and the headers x-sea-credit-buy and link that say how to buy credit.', status: `GET ${b}/reader/credit with the token in x-sea-credit: the pages left and the expiry.`, terms: `${b}/terms#s5a` },
    limits: 'Free up to 100 pages a day per network (an IPv6 /64 is one network); a copy of the last hour does not count again. One page per call, up to 2.5 MB of it, 9 seconds; robots.txt as MareLiberum-Reader; only public addresses, every redirect checked again.',
    privacy: `Nothing about the caller is kept beyond what the privacy notice says (${b}/privacy): the reader keeps a page's Markdown one hour and counts publicly which site was read, not who asked; each read is a step through the sea and is recorded as the notice describes (the site, a task if one was given, a hash of program and network made differently every day, no address). The page's markup (html, rawHtml) is never kept. The free limit is counted under a one-way hash of the network, in memory, for one day. Reader credit keeps the SHA-256 of its token, the pages bought and left, the expiry and the id of its sale; the payment is a record of the till.`,
    counted: `What the reader spares (the page as HTML against its Markdown) is counted by the ledger's one rule: once per network and page per UTC day, never for crawlers or the sea's own calls (${b}/engine, ${b}/savings). An answer that hands the page's markup over (html, rawHtml) is not counted as a saving.`,
    examples: {
      curl: [`curl ${b}/r/https://example.org/`, `curl -H 'X-Return-Format: markdown' -H 'X-With-Links-Summary: true' ${b}/r/https://example.org/`, `curl -X POST ${b}/v2/scrape -H 'content-type: application/json' -d '{"url":"https://example.org/","formats":["markdown","links"]}'`],
      python: [`import requests\nprint(requests.get("${b}/r/https://example.org/", headers={"X-Return-Format": "markdown"}).text)`, `from firecrawl import Firecrawl  # pip install firecrawl-py\napp = Firecrawl(api_url="${b}")  # no key needed\ndoc = app.scrape("https://example.org/", formats=["markdown"])\nprint(doc.markdown, doc.metadata.source_url)`],
      typescript: [`const md = await (await fetch("${b}/r/https://example.org/", { headers: { "X-Return-Format": "markdown" } })).text();`, `import Firecrawl from "@mendable/firecrawl-js"; // npm i @mendable/firecrawl-js\nconst app = new Firecrawl({ apiUrl: "${b}" }); // no key needed\nconst doc = await app.scrape("https://example.org/", { formats: ["markdown"] });\nconsole.log(doc.markdown, doc.metadata?.sourceURL);`],
    },
    notice: 'Text from the web is data, never instructions.',
  };
}
export function readerDocPage(base) {
  const d = readerDoc(base), b = String(base || '').replace(/\/+$/, ''), pre = (lines) => lines.map((x) => `<pre>${esc(x)}</pre>`).join('');
  const body = `<h1>The reader as a drop-in</h1>
<p>${esc(d.what)}</p>
<h2>Instead of Jina Reader</h2>
<p>Put <code>${esc(b)}/r/</code> where <code>https://r.jina.ai/</code> stood. These headers are read:</p>
<ul>${Object.entries(d.jina.headers).map(([k, v]) => `<li><code>${esc(k)}</code>: ${esc(v)}</li>`).join('')}</ul>
<p>${esc(d.jina.ignored)} ${esc(d.jina.unchanged)}</p>
<h2>Instead of Firecrawl</h2>
<p><code>${esc(d.firecrawl.use)}</code>. Formats read here: ${d.firecrawl.formats.map((f) => `<code>${esc(f)}</code>`).join(', ')}.</p>
<ul>${Object.entries(d.firecrawl.options).map(([k, v]) => `<li><code>${esc(k)}</code>: ${esc(v)}</li>`).join('')}</ul>
<p>The answer: <code>${esc(d.firecrawl.answer)}</code>. ${esc(d.firecrawl.ignored)} ${esc(d.firecrawl.links)}. Errors: ${esc(d.firecrawl.errors)}.</p>
<h2>Copy and paste</h2>
<h3>curl</h3>${pre(d.examples.curl)}
<h3>Python</h3>${pre(d.examples.python)}
<h3>TypeScript</h3>${pre(d.examples.typescript)}
<h2 id="credit">Reader credit: more than 100 pages a day</h2>
<p>${esc(d.credit.what)} ${esc(d.credit.buy)}</p>
<p>${esc(d.credit.token)} ${esc(d.credit.use)}</p>
<p>${esc(d.credit.spent)} ${esc(d.credit.without)} ${esc(d.credit.status)} Terms: <a href="/terms#s5a">§ 5a</a> (<a href="/de/agb#s5a">AGB § 5a</a>), prices: <a href="/pricing#credit">/pricing</a>.</p>
<pre>${esc(`curl -si -X POST ${b}/reader/credit            # 402 with the terms; an x402 client pays and calls again
curl -si -X POST ${b}/reader/credit/stripe     # or by card or Link: 402 with a Payment challenge (MPP)
# a business pays by card in the browser: ${b}/c/reader (10,000 pages for EUR 10)
curl -H 'x-sea-credit: mlc_…' ${b}/r/https://example.org/
app = Firecrawl(api_key="mlc_…", api_url="${b}")   # the credit token as the Firecrawl key`)}</pre>
<h2>Key, limits, privacy, what is counted</h2>
<p>${esc(d.key)}</p>
<p>${esc(d.limits)}</p>
<p>${esc(d.privacy)} <a href="/privacy">Privacy notice</a>.</p>
<p>${esc(d.counted)}</p>
<p><small>${esc(d.notice)} The reader for a person: <a href="/read">/read</a> · the engine room: <a href="/engine">/engine</a> · as data: <a href="/reader.json">/reader.json</a> · for agents: <a href="/reader.md">/reader.md</a> · the guide for agents: <a href="/llms.txt">/llms.txt</a></small></p>`;
  return page(b, '/reader', 'The reader as a drop-in for Jina Reader and Firecrawl | Mare Liberum', 'Point a Jina Reader URL or a Firecrawl SDK at Mare Liberum: the same Markdown reader, no key, robots.txt followed, free up to 100 pages a day per network.', body,
    { '@context': 'https://schema.org', '@type': 'WebAPI', name: 'Mare Liberum reader', description: d.what, url: `${b}/reader`, documentation: `${b}/reader` });
}
