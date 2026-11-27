// Mare Liberum · the open price record (since 3.65, "Der Preisbeleg"): every deal check of a product page leaves a record of
// what it saw, at its own permanent address, that an agent can hand to its person as the source of what it says.
// Why it exists: an agent that tells its person "this is the lowest price" has nothing to show for it; a screenshot proves
// nothing and a chat answer is gone with the chat. The record is the agent's receipt: the page's price as its own structured
// data stated it, the same item at other stores (Shopify Global Catalog), the median, the cautions and the verdict, at the minute
// it was seen, with the SHA-256 of its canonical JSON. A person (or another agent) opens the link and sees the same.
//   what     only a deal check of a product page that the reader could read and that states a price and a currency; a check by
//            words alone (?q=) leaves no record, because the words someone types are theirs
//   never    who asked: no address, no caller, no wallet; only the store's public page and the catalog's public offers
//   fixed    a record never changes: the same store, page, price, verdict and lowest offer on the same day (UTC) is the same
//            record; anything else that differs is a new one
//   kept     SEEN.keepDays days, at most SEEN.offers other offers each; at most SEEN.perDay new records a day (a busier day
//            leaves the rest without a record), so the records stay small beside the rest of the node's memory
//   indexed  only a record that compares the page with at least SEEN.index other offers is open to search engines (as the
//            needs' pages of node/needs.mjs: fewer than 3 prices is no page to index); every other one says noindex
//   not      an endorsement of any store and no advice: the page says so, and keeps the deal check's caution beside an offer
//            far below the others
//   by       (since 3.72) a record made by the sea's own daily sample (node/book.mjs) says so: by: "sea" and the sentence of the
//            book, on its page and in the list; a record an agent's check made carries neither and is unchanged

// the sentence a record of the record book carries (node/book.mjs names it BOOK.said)
export const BOOK_SAID = 'Made by the sea\'s own daily sample of product pages (at most 40 a day, the same watched pages every day, one read per store an hour, robots.txt respected), not by an agent\'s check.';
export const SEEN = Object.freeze({ path: '/seen', keepDays: 90, perDay: 400, recent: 200, list: 60, index: 2, offers: 6, indexed: 2000, quoteMin: 10 });

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ld = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;
const money = (x, c) => (Number.isFinite(x) ? `${Number(x).toFixed(Number.isInteger(x) ? 0 : 2)} ${c || ''}`.trim() : '');
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch { return null; } };

// the page's address as the record keeps it: scheme, host and path; of the query only a numeric ?variant= (the item itself),
// never a session, a campaign or anything else a link may carry
export function canonOf(u) {
  try {
    const x = new URL(u); if (!/^https?:$/.test(x.protocol) || x.username || x.password) return null;
    const v = x.searchParams.get('variant');
    return `${x.protocol}//${x.hostname.toLowerCase()}${x.pathname.replace(/\/{2,}/g, '/')}${/^\d{1,20}$/.test(v || '') ? `?variant=${v}` : ''}`.slice(0, 600);
  } catch { return null; }
}
// JSON with its keys in order, at every depth: what the record's SHA-256 is taken of
export function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  return JSON.stringify(v ?? null);
}
// what makes two looks the same record → the string whose hash is its id, or null when the answer holds no record
export function recordKey(ans, day) {
  const p = ans?.product, store = ans?.page?.host || hostOf(p?.url), url = canonOf(p?.url && hostOf(p.url) === store ? p.url : ans?.page?.url);
  if (!p || !store || !url || !(Number.isFinite(p.price) && p.price > 0) || !p.currency || !ans?.page?.read) return null;
  return [store, url, p.price, p.currency, day, ans.verdict?.word || '', ans.cheapest?.where === 'another store' ? ans.cheapest.price : ''].join('|');
}
// the record from a deal check's answer (node/deal.mjs dealOf), seen at `at`: only public facts, nothing of who asked
export function recordOf(ans, { id, at, base = '', by } = {}) {
  const b = String(base || '').replace(/\/+$/, ''), p = ans.product, store = ans.page?.host || hostOf(p.url);
  const url = canonOf(p.url && hostOf(p.url) === store ? p.url : ans.page?.url);
  const offers = (Array.isArray(ans.elsewhere) ? ans.elsewhere : []).slice(0, SEEN.offers).map((o) => ({ store: o.store || null, title: String(o.title || '').slice(0, 120), price: o.price, currency: o.currency,
    ...(o.url ? { url: o.url } : {}), ...(o.checkout ? { checkout: o.checkout } : {}), ...(Number.isFinite(o.below_page_pct) ? { below_page_pct: o.below_page_pct } : {}), ...(o.caution ? { caution: o.caution } : {}) }));
  const n = Number.isFinite(ans.elsewhere_found) ? ans.elsewhere_found : offers.length;
  return {
    record: 'price record', id, url: `${b}${SEEN.path}/${id}`, seen_at: at, day: at.slice(0, 10),
    product: { name: p.name || null, brand: p.brand || null, gtin: p.gtin || null, price: p.price, ...(p.price_is ? { price_is: p.price_is } : {}), list_price: p.list_price ?? null, currency: p.currency, in_stock: p.in_stock ?? null, url },
    store,
    ...(by === 'sea' ? { by: 'sea', sample: BOOK_SAID } : {}),
    verdict: { word: ans.verdict?.word || null, lines: (ans.verdict?.lines || []).map((l) => String(l).slice(0, 400)).slice(0, 8) },
    elsewhere: offers, elsewhere_found: n, median: ans.median || null,
    seen_before: ans.seen?.checks ? { checks: ans.seen.checks, since: ans.seen.since, low: ans.seen.low, high: ans.seen.high } : { checks: 0 },
    indexable: n >= SEEN.index,
    how: `the deal check of Mare Liberum (${b}/deal): the product page read once (robots.txt respected), its price as its own structured data states it, the same item at other stores live from the Shopify Global Catalog, and the prices agents saw before`,
    check_again: `${b}/deal?url=${encodeURIComponent(url)}`,
    notice: 'An open record of what one deal check saw at the time stated, kept unchanged. It is no endorsement of any store and no advice: Mare Liberum vouches for no store, never pays and never holds money. Prices change; the merchant\'s checkout states the final price.',
  };
}
// how far below the page the lowest other offer without a caution was, in per cent, when the record says cheaper elsewhere;
// null otherwise (since 3.73): an offer flagged as far below the others is left out, so a doubtful price never makes the saving
export function savingOf(rec) {
  if (rec?.verdict?.word !== 'cheaper-elsewhere') return null;
  const o = (Array.isArray(rec.elsewhere) ? rec.elsewhere : []).find((x) => !x?.caution && Number.isFinite(x?.below_page_pct));
  return o && o.below_page_pct > 0 ? o.below_page_pct : null;
}
// whether the page states a list price of its own above the price it charges (a crossed-out price)
export const claimsListPrice = (rec) => Number.isFinite(rec?.product?.list_price) && rec.product.list_price > rec.product.price;
// the line /seen keeps of a record, newest first; since 3.73 also its saving (save) and its list price claim (lp), which the
// quote counts
export function lineOf(rec) {
  return { id: rec.id, at: rec.seen_at, name: rec.product.name, store: rec.store, price: rec.product.price, currency: rec.product.currency, word: rec.verdict.word,
    n: rec.elsewhere_found, ix: rec.indexable, save: savingOf(rec), lp: claimsListPrice(rec), ...(rec.by ? { by: rec.by } : {}) };
}

// the quote of the records (since 3.73, /seen/quote): of the newest records, how many product pages were cheaper elsewhere, the
// median saving, how many pages state a list price of their own, apart for the records agents made and those of the sea's own
// daily sample. Counted only from the records themselves: a page that was compared with no other offer is no page that was or
// was not the lowest, so the share is of the pages compared
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
const medianOf = (xs) => { const s = xs.filter(Number.isFinite).sort((a, b) => a - b); if (!s.length) return null; const m = s.length >> 1; return Math.round((s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) * 10) / 10; };
function tallyOf(xs) {
  const compared = xs.filter((x) => x.word === 'cheaper-elsewhere' || x.word === 'lowest-found'), cheaper = xs.filter((x) => x.word === 'cheaper-elsewhere');
  const saves = cheaper.map((x) => x.save).filter((v) => Number.isFinite(v) && v > 0), lp = xs.filter((x) => x.lp === true).length;
  return { records: xs.length, compared: compared.length, cheaper_elsewhere: cheaper.length, lowest_here: compared.length - cheaper.length, no_comparison: xs.length - compared.length,
    cheaper_share_pct: pct(cheaper.length, compared.length), median_saving_pct: medianOf(saves), savings_counted: saves.length, list_price_stated: lp, list_price_share_pct: pct(lp, xs.length) };
}
export function quoteOf(list) {
  const xs = (Array.isArray(list) ? list : []).filter((x) => x && /^[0-9a-f]{16}$/.test(String(x.id || ''))).slice(0, SEEN.recent);
  const ats = xs.map((x) => String(x.at || '')).filter((t) => /^\d{4}-\d{2}-\d{2}T/.test(t)).sort();
  return { of: xs.length, from: ats[0] || null, to: ats[ats.length - 1] || null, all: tallyOf(xs), by: { agent: tallyOf(xs.filter((x) => x.by !== 'sea')), sea: tallyOf(xs.filter((x) => x.by === 'sea')) } };
}
// the heading and the first sentence of the quote: the share in the heading, the median saving and the list prices after it
export function quoteHeadline(q) {
  const a = q.all; if (!a.compared) return 'How often a product page was not the lowest price: no compared record yet';
  return `How often a product page was not the lowest price: ${a.cheaper_elsewhere} of ${a.compared} (${a.cheaper_share_pct} %) cheaper elsewhere`;
}
export function quoteLead(q) {
  const a = q.all; if (!q.of) return 'No price record yet: the first appears with the next deal check of a product page.';
  const span = q.from && q.to ? ` (${when(q.from)} to ${when(q.to)})` : '';
  const save = Number.isFinite(a.median_saving_pct) ? ` The median saving at the lowest other store without a caution was ${a.median_saving_pct} %.` : '';
  return `Of the newest ${q.of} open price record${q.of === 1 ? '' : 's'}${span}, ${a.compared} compared the page with other stores and ${a.cheaper_elsewhere} found it cheaper elsewhere.${save} ${a.list_price_stated} of ${q.of} page${q.of === 1 ? '' : 's'} stated a list price of their own above the price charged.`;
}
const QUOTE_HOW = 'Counted from the newest open price records only, never from who asked: a page is compared when the deal check found the same item in stock at another store; it is cheaper elsewhere when one of them was lower. The saving is how far below the page the lowest other offer without a caution was (an offer flagged as far below the others is left out). A list price is the crossed-out price the page states for itself. Records of the sea\'s own daily sample are counted apart.';
export const quoteJson = (list, base) => { const b = String(base || '').replace(/\/+$/, ''), q = quoteOf(list); return { what: 'the quote of the open price records: how often a checked product page was cheaper elsewhere, the median saving and how many pages state a list price', ...q, headline: quoteHeadline(q), lead: quoteLead(q), how: QUOTE_HOW, indexable: q.all.compared >= SEEN.quoteMin, records: `${b}${SEEN.path}.json`, page: `${b}${SEEN.path}/quote`, make_one: `${b}/deal?url=<product page>` }; };
export function quotePage(list, base) {
  const b = String(base || '').replace(/\/+$/, ''), q = quoteOf(list), H = quoteHeadline(q), lead = quoteLead(q);
  const robots = q.all.compared >= SEEN.quoteMin ? '' : '<meta name="robots" content="noindex,follow">';
  const cell = (v, suf = '') => (v == null ? '–' : `${esc(String(v))}${suf}`);
  const row = (label, t) => `<tr><td>${esc(label)}</td><td class="n">${t.records}</td><td class="n">${t.compared}</td><td class="n">${t.cheaper_elsewhere}${t.compared ? ` <small>(${cell(t.cheaper_share_pct, ' %')})</small>` : ''}</td><td class="n">${cell(t.median_saving_pct, ' %')}</td><td class="n">${t.list_price_stated}</td></tr>`;
  const data = { '@context': 'https://schema.org', '@type': 'Dataset', name: 'Quote of the open price records · Mare Liberum', description: `${H}. ${lead}`, url: `${b}${SEEN.path}/quote`, license: 'https://creativecommons.org/licenses/by/4.0/', creator: { '@type': 'Organization', name: 'Mare Liberum', url: b || 'https://mareliberum.dev' }, distribution: { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: `${b}${SEEN.path}/quote.json` } };
  return `${head(`${H} | Mare Liberum`, lead, `${b}${SEEN.path}/quote`, `${robots}<link rel="alternate" type="application/json" href="${esc(`${b}${SEEN.path}/quote.json`)}">${ld(data)}`)}
<body><main><h1>${esc(H)}</h1>
<p class="lead">${esc(lead)}</p>
<table><thead><tr><th>Records</th><th>All</th><th>Compared</th><th>Cheaper elsewhere</th><th>Median saving</th><th>List price stated</th></tr></thead><tbody>${row('all', q.all)}${row('made by agents\' checks', q.by.agent)}${row('the sea\'s daily sample', q.by.sea)}</tbody></table>
<p><small>${esc(QUOTE_HOW)}</small></p>
<h2>Check a price before your person buys</h2><p>Every deal check of a product page adds a record to this quote:</p>
<pre>GET ${esc(b)}/deal?url=&lt;product page&gt;</pre>
<p><small>The records themselves: <a href="${SEEN.path}">the newest</a> · this quote as data: <a href="${SEEN.path}/quote.json">JSON</a> (CC BY 4.0). Mare Liberum vouches for no store, never pays and never holds money.</small></p>
${NAV()}</main></body></html>`;
}

// the line the deal check's answer carries: where the record stands and what it is for
export const recordRef = (rec, sha256) => ({ id: rec.id, url: rec.url, json: `${rec.url}.json`, sha256, note: 'an open record of what this check saw, kept unchanged at this address: give it to your person as the source of the price you name' });

const STYLE = `body{margin:0;background:#04111f;color:#d7e6f5;font:16px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}main{max-width:820px;margin:0 auto;padding:24px 18px 56px}
a{color:#7fd3ff}h1{font-size:1.6rem;line-height:1.25;margin:.4em 0}h2{font-size:1.15rem;margin:1.6em 0 .5em}.box{background:#0a2236;border:1px solid #1f5a86;border-radius:10px;padding:12px 14px;color:#eaf4ff}
table{width:100%;border-collapse:collapse;font-size:.95rem}td,th{padding:8px 6px;border-bottom:1px solid #1d3550;text-align:left;vertical-align:top}td.n{text-align:right;white-space:nowrap}
code,pre{background:#071626;border:1px solid #1d3550;border-radius:6px;padding:2px 6px;font-size:.88rem;overflow-wrap:anywhere}pre{padding:12px 14px;white-space:pre-wrap}small,.mut{color:#a9c2da}.warn{color:#ffd28a}
ul.v{padding-left:1.1em}ul.v li{margin:.25em 0}.lead{font-size:1.05rem;color:#eaf4ff}`;
const head = (t, d, canon, extra = '') => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t)}</title><meta name="description" content="${esc(d)}"><link rel="canonical" href="${esc(canon)}">${extra}<style>${STYLE}</style></head>`;
const when = (iso) => `${String(iso).slice(0, 10)} ${String(iso).slice(11, 16)} UTC`;

// the verdict of a record in a few words (since 3.67): AI answers quote a page by its title and about 200 characters from its
// heading on, and skip its meta description and its JSON-LD, so the verdict stands in the title, in the heading and in the
// first sentence right after it, as plain HTML; the links back to the sea stand after the record, not before its heading
const SAYS = Object.freeze({ 'cheaper-elsewhere': 'cheaper elsewhere', 'lowest-found': 'the lowest price found', 'no-comparison': 'no other offer found' });
export const recordSays = (rec) => SAYS[rec?.verdict?.word] || null;
// the heading: the product, the store, the price seen and the verdict, e.g. "Hoka Clifton 9 at randysshoes.com: 115.99 USD, cheaper elsewhere"
export function recordHeadline(rec) {
  const p = rec.product, says = recordSays(rec);
  return `${p.name || 'A product'} at ${rec.store}: ${p.price_is ? 'from ' : ''}${money(p.price, p.currency)}${says ? `, ${says}` : ''}`;
}
// the first sentence: how many prices were compared and when, the lowest and where (with its caution, and the lowest without
// such a gap), and the list price the page states for itself
export function recordLead(rec) {
  const p = rec.product, at = when(rec.seen_at), n = (Number(rec.elsewhere_found) || 0) + 1, word = rec.verdict?.word;
  const low = rec.elsewhere[0], plain = rec.elsewhere.find((o) => !o.caution);
  const list = Number.isFinite(p.list_price) && p.list_price > p.price ? ` Its own list price: ${money(p.list_price, p.currency)}.` : '';
  if (word === 'cheaper-elsewhere' && low) {
    const gap = low.caution ? ` (caution: far below the median of the others${plain && plain !== low ? `; without such a gap ${money(plain.price, plain.currency)} at ${plain.store || 'another store'}` : ''})` : '';
    return `${n} prices checked on ${at}: the lowest is ${money(low.price, low.currency)} at ${low.store || 'another store'}${Number.isFinite(low.below_page_pct) ? `, ${low.below_page_pct} % below this page` : ''}${gap}.${list}`;
  }
  if (word === 'lowest-found') return `${n} prices checked on ${at}: this page has the lowest.${list}`;
  if (word === 'no-comparison') return `Checked on ${at}: no matching offer in stock at another Shopify store.${list}`;
  return `Seen on ${at}.${list}`;
}
const NAV = (more = '') => `<nav><p><small><a href="/">Mare Liberum</a> · <a href="${SEEN.path}">price records</a>${more}</small></p></nav>`;

// one record as a page a person can read: the verdict first, then what was seen, where, when, and the same item elsewhere
export function recordPage(rec, base) {
  const b = String(base || '').replace(/\/+$/, ''), p = rec.product, cur = p.currency;
  const name = p.name || 'A product', says = recordSays(rec), lead = recordLead(rec);
  const T = `${name} at ${rec.store}: ${money(p.price, cur)} on ${rec.day}${says ? `, ${says}` : ''}`;
  const d = `${lead} An open price record of Mare Liberum's deal check.`;
  const offer = (price, c, url, seller) => ({ '@type': 'Offer', price, priceCurrency: c, ...(url ? { url } : {}), seller: { '@type': 'Organization', name: seller } });
  const data = { '@context': 'https://schema.org', '@type': 'Product', name, ...(p.brand ? { brand: { '@type': 'Brand', name: p.brand } } : {}), ...(p.gtin ? { gtin: p.gtin } : {}),
    offers: [offer(p.price, cur, p.url, rec.store), ...rec.elsewhere.map((o) => offer(o.price, o.currency, o.url, o.store || 'another store'))] };
  const robots = rec.indexable ? '' : '<meta name="robots" content="noindex,follow">';
  const rows = rec.elsewhere.map((o) => `<tr><td>${esc(o.store || '')}<br><small>${esc(o.title)}</small>${o.caution ? `<br><span class="warn">Caution: ${esc(o.caution)}</span>` : ''}</td><td class="n">${esc(money(o.price, o.currency))}${Number.isFinite(o.below_page_pct) ? `<br><small>${o.below_page_pct > 0 ? `${o.below_page_pct} % below the page` : o.below_page_pct < 0 ? `${-o.below_page_pct} % above the page` : 'the page\'s price'}</small>` : ''}</td><td>${o.url ? `<a href="${esc(o.url)}" rel="nofollow noopener">store page</a>` : ''}${o.checkout ? `<br><a href="${esc(o.checkout)}" rel="nofollow noopener">checkout</a>` : ''}</td></tr>`).join('');
  return `${head(`${T} | price record · Mare Liberum`, d, `${b}${SEEN.path}/${rec.id}`, `${robots}<link rel="alternate" type="application/json" href="${esc(`${b}${SEEN.path}/${rec.id}.json`)}">${ld(data)}`)}
<body><main><h1>${esc(recordHeadline(rec))}</h1>
<p class="lead">${esc(lead)}</p>
<p class="box"><b>${esc(money(p.price, cur))}</b>${p.price_is ? ' (from: its lowest variant)' : ''} at <b>${esc(rec.store)}</b>${p.in_stock === true ? ', in stock' : p.in_stock === false ? ', out of stock' : ''}${Number.isFinite(p.list_price) && p.list_price > p.price ? ` · its own list price ${esc(money(p.list_price, cur))}` : ''}<br><small>seen ${esc(when(rec.seen_at))} on <a href="${esc(p.url)}" rel="nofollow noopener">the product page</a>${p.brand ? ` · ${esc(p.brand)}` : ''}${p.gtin ? ` · GTIN ${esc(p.gtin)}` : ''}</small></p>
${rec.by === 'sea' ? `<p><small>${esc(rec.sample || BOOK_SAID)}</small></p>
` : ''}<h2>What the deal check found</h2><ul class="v">${rec.verdict.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
${rows ? `<h2>The same item at other stores</h2><table><thead><tr><th>Store</th><th>Price</th><th></th></tr></thead><tbody>${rows}</tbody></table><p><small>${rec.elsewhere_found} matching offer${rec.elsewhere_found === 1 ? '' : 's'} in stock found${rec.median ? ` · median of all prices ${esc(money(rec.median.price, rec.median.currency))} (of ${rec.median.of})` : ''}</small></p>` : '<p class="mut">No matching offer at another Shopify store was found at that minute.</p>'}
${rec.seen_before.checks ? `<p><small>Before this check agents saw this product ${rec.seen_before.checks} time${rec.seen_before.checks === 1 ? '' : 's'} through the sea since ${esc(String(rec.seen_before.since).slice(0, 10))}: lowest ${esc(money(rec.seen_before.low?.price, rec.seen_before.low?.currency))}, highest ${esc(money(rec.seen_before.high?.price, rec.seen_before.high?.currency))}.</small></p>` : ''}
<h2>Check it again</h2><p>Prices move, above all on sale days. A new check reads the page again and leaves a new record if anything changed:</p>
<pre>GET ${esc(rec.check_again)}</pre>
<p><small>Agents: the same check costs nothing ten times an hour; <code>GET ${esc(b)}/x402/deal?url=…</code> makes it for 0.01 USDC with up to 12 offers. This record as data: <a href="${SEEN.path}/${rec.id}.json">JSON</a> (SHA-256 of its canonical JSON inside).</small></p>
<p><small>${esc(rec.notice)}</small></p>
${NAV()}</main></body></html>`;
}

// the newest records, as the page /seen shows them
export function recordsPage(list, base, book = null) {
  const b = String(base || '').replace(/\/+$/, ''), xs = (Array.isArray(list) ? list : []).slice(0, SEEN.list);
  const d = 'Open price records of shopping agents: what Mare Liberum\'s deal check saw on product pages, with the same item at other stores, at the minute it was seen. Each record stays unchanged at its own address.';
  // the count in the heading and the newest record in the first sentence, as on each record's page (since 3.67)
  const cheaper = xs.filter((x) => x?.word === 'cheaper-elsewhere').length, top = xs[0];
  const H = xs.length ? `Open price records: ${cheaper} of ${xs.length} checked product page${xs.length === 1 ? '' : 's'} cheaper elsewhere` : 'Open price records of shopping agents';
  const lead = top ? `The newest, seen ${when(top.at)}: ${top.name || 'a product'} at ${top.store}, ${money(top.price, top.currency)}${SAYS[top.word] ? `, ${SAYS[top.word]}` : ''}${Number.isFinite(top.n) ? ` (${top.n + 1} prices compared)` : ''}.` : 'No record yet: the first appears with the next deal check of a product page.';
  const site = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Price records · Mare Liberum', url: `${b}${SEEN.path}`, description: d };
  return `${head(`${H} | Mare Liberum`, `${lead} ${d}`, `${b}${SEEN.path}`, `<link rel="alternate" type="application/json" href="${esc(`${b}${SEEN.path}.json`)}">${ld(site)}`)}
<body><main><h1>${esc(H)}</h1><p class="lead">${esc(lead)}</p><p>${esc(d)}</p>
<p>How often a checked page was cheaper elsewhere, the median saving and how many pages state a list price: <a href="${SEEN.path}/quote">the quote of the records</a>.</p>
<p>An agent makes one with every deal check of a product page and can hand it to its person as the source of the price it names:</p>
<pre>GET ${esc(b)}/deal?url=&lt;product page&gt;</pre>
${book ? `<p>The sea adds its own every day: up to ${esc(String(book.per_day))} product pages, ${esc(String(book.watch_max))} of them the same watched pages each day, so each has a series of prices. Today (${esc(String(book.day || ''))} UTC) ${esc(String(book.visits))} visit${book.visits === 1 ? '' : 's'}, ${esc(String(book.records))} record${book.records === 1 ? '' : 's'}, ${esc(String(book.watch))} page${book.watch === 1 ? '' : 's'} watched. Its records say so and are never counted as an agent's check.</p>
` : ''}${xs.length ? `<table><thead><tr><th>Product</th><th>Price</th><th>Seen</th></tr></thead><tbody>${xs.map((x) => `<tr><td><a href="${SEEN.path}/${esc(x.id)}">${esc(x.name || 'a product')}</a><br><small>${esc(x.store)} · ${esc(SAYS[x.word] || x.word || '')}${Number.isFinite(x.n) ? ` · ${x.n} other offer${x.n === 1 ? '' : 's'}` : ''}${x.by === 'sea' ? ' · the sea\'s daily sample' : ''}</small></td><td class="n">${esc(money(x.price, x.currency))}</td><td><small>${esc(when(x.at))}</small></td></tr>`).join('')}</tbody></table>` : ''}
<p><small>Records hold only the store's public page and the catalog's public offers, never who asked. Mare Liberum vouches for no store. Data: <a href="${SEEN.path}.json">JSON</a> · <a href="/llms.txt">/llms.txt</a></small></p>
${NAV()}</main></body></html>`;
}
export const recordsJson = (list, base, book = null) => { const b = String(base || '').replace(/\/+$/, ''); return { what: 'the newest open price records: what the deal check saw on product pages, each unchanged at its own address', records: (Array.isArray(list) ? list : []).slice(0, SEEN.list).map((x) => ({ ...x, url: `${b}${SEEN.path}/${x.id}`, json: `${b}${SEEN.path}/${x.id}.json` })), make_one: `${b}/deal?url=<product page>`, ...(book ? { book } : {}) }; };

// the records open to search engines as a sitemap of their own (/sitemaps/seen.xml, since 3.66): only those that compare 3 or
// more prices (the others say noindex, so a map that named them would contradict their pages), each dated by the day it was
// seen, since a record never changes after; the newest first, at most SEEN.indexed (since 3.73 from a list of its own, which
// keeps every record open to search engines for as long as the record is kept, not only the newest SEEN.recent of /seen)
const okId = (x) => !!x && x.ix === true && /^[0-9a-f]{16}$/.test(String(x.id || ''));
const dayOf = (x) => (/^\d{4}-\d{2}-\d{2}T/.test(String(x?.at || '')) ? String(x.at).slice(0, 10) : null);
export function recordsSitemap(list, base) {
  const b = String(base || '').replace(/\/+$/, ''), xs = (Array.isArray(list) ? list : []).filter(okId).slice(0, SEEN.indexed);
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${xs.map((x) => `<url><loc>${esc(`${b}${SEEN.path}/${x.id}`)}</loc>${dayOf(x) ? `<lastmod>${dayOf(x)}</lastmod>` : ''}<changefreq>never</changefreq></url>`).join('')}</urlset>`;
}
// the day the newest record open to search engines was seen: the lastmod of seen.xml in the sitemap index, or null
export const recordsDay = (list) => { const x = (Array.isArray(list) ? list : []).find(okId); return x ? dayOf(x) : null; };
