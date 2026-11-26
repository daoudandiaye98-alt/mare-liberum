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

export const SEEN = Object.freeze({ path: '/seen', keepDays: 90, perDay: 400, recent: 200, list: 60, index: 2, offers: 6 });

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
export function recordOf(ans, { id, at, base = '' }) {
  const b = String(base || '').replace(/\/+$/, ''), p = ans.product, store = ans.page?.host || hostOf(p.url);
  const url = canonOf(p.url && hostOf(p.url) === store ? p.url : ans.page?.url);
  const offers = (Array.isArray(ans.elsewhere) ? ans.elsewhere : []).slice(0, SEEN.offers).map((o) => ({ store: o.store || null, title: String(o.title || '').slice(0, 120), price: o.price, currency: o.currency,
    ...(o.url ? { url: o.url } : {}), ...(o.checkout ? { checkout: o.checkout } : {}), ...(Number.isFinite(o.below_page_pct) ? { below_page_pct: o.below_page_pct } : {}), ...(o.caution ? { caution: o.caution } : {}) }));
  const n = Number.isFinite(ans.elsewhere_found) ? ans.elsewhere_found : offers.length;
  return {
    record: 'price record', id, url: `${b}${SEEN.path}/${id}`, seen_at: at, day: at.slice(0, 10),
    product: { name: p.name || null, brand: p.brand || null, gtin: p.gtin || null, price: p.price, ...(p.price_is ? { price_is: p.price_is } : {}), list_price: p.list_price ?? null, currency: p.currency, in_stock: p.in_stock ?? null, url },
    store,
    verdict: { word: ans.verdict?.word || null, lines: (ans.verdict?.lines || []).map((l) => String(l).slice(0, 400)).slice(0, 8) },
    elsewhere: offers, elsewhere_found: n, median: ans.median || null,
    seen_before: ans.seen?.checks ? { checks: ans.seen.checks, since: ans.seen.since, low: ans.seen.low, high: ans.seen.high } : { checks: 0 },
    indexable: n >= SEEN.index,
    how: `the deal check of Mare Liberum (${b}/deal): the product page read once (robots.txt respected), its price as its own structured data states it, the same item at other stores live from the Shopify Global Catalog, and the prices agents saw before`,
    check_again: `${b}/deal?url=${encodeURIComponent(url)}`,
    notice: 'An open record of what one deal check saw at the time stated, kept unchanged. It is no endorsement of any store and no advice: Mare Liberum vouches for no store, never pays and never holds money. Prices change; the merchant\'s checkout states the final price.',
  };
}
// the line the deal check's answer carries: where the record stands and what it is for
export const recordRef = (rec, sha256) => ({ id: rec.id, url: rec.url, json: `${rec.url}.json`, sha256, note: 'an open record of what this check saw, kept unchanged at this address: give it to your person as the source of the price you name' });

const STYLE = `body{margin:0;background:#04111f;color:#d7e6f5;font:16px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}main{max-width:820px;margin:0 auto;padding:24px 18px 56px}
a{color:#7fd3ff}h1{font-size:1.6rem;line-height:1.25;margin:.4em 0}h2{font-size:1.15rem;margin:1.6em 0 .5em}.box{background:#0a2236;border:1px solid #1f5a86;border-radius:10px;padding:12px 14px;color:#eaf4ff}
table{width:100%;border-collapse:collapse;font-size:.95rem}td,th{padding:8px 6px;border-bottom:1px solid #1d3550;text-align:left;vertical-align:top}td.n{text-align:right;white-space:nowrap}
code,pre{background:#071626;border:1px solid #1d3550;border-radius:6px;padding:2px 6px;font-size:.88rem;overflow-wrap:anywhere}pre{padding:12px 14px;white-space:pre-wrap}small,.mut{color:#a9c2da}.warn{color:#ffd28a}
ul.v{padding-left:1.1em}ul.v li{margin:.25em 0}`;
const head = (t, d, canon, extra = '') => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t)}</title><meta name="description" content="${esc(d)}"><link rel="canonical" href="${esc(canon)}">${extra}<style>${STYLE}</style></head>`;
const when = (iso) => `${String(iso).slice(0, 10)} ${String(iso).slice(11, 16)} UTC`;

// one record as a page a person can read: what was seen, where, when, and the same item elsewhere
export function recordPage(rec, base) {
  const b = String(base || '').replace(/\/+$/, ''), p = rec.product, cur = p.currency;
  const name = p.name || 'A product', T = `${name} at ${rec.store}: ${money(p.price, cur)} on ${rec.day}`;
  const d = `${rec.verdict.lines[0] || ''} ${rec.verdict.lines[1] || ''} An open price record of Mare Liberum's deal check, seen ${when(rec.seen_at)}.`.trim();
  const offer = (price, c, url, seller) => ({ '@type': 'Offer', price, priceCurrency: c, ...(url ? { url } : {}), seller: { '@type': 'Organization', name: seller } });
  const data = { '@context': 'https://schema.org', '@type': 'Product', name, ...(p.brand ? { brand: { '@type': 'Brand', name: p.brand } } : {}), ...(p.gtin ? { gtin: p.gtin } : {}),
    offers: [offer(p.price, cur, p.url, rec.store), ...rec.elsewhere.map((o) => offer(o.price, o.currency, o.url, o.store || 'another store'))] };
  const robots = rec.indexable ? '' : '<meta name="robots" content="noindex,follow">';
  const rows = rec.elsewhere.map((o) => `<tr><td>${esc(o.store || '')}<br><small>${esc(o.title)}</small>${o.caution ? `<br><span class="warn">Caution: ${esc(o.caution)}</span>` : ''}</td><td class="n">${esc(money(o.price, o.currency))}${Number.isFinite(o.below_page_pct) ? `<br><small>${o.below_page_pct > 0 ? `${o.below_page_pct} % below the page` : o.below_page_pct < 0 ? `${-o.below_page_pct} % above the page` : 'the page\'s price'}</small>` : ''}</td><td>${o.url ? `<a href="${esc(o.url)}" rel="nofollow noopener">store page</a>` : ''}${o.checkout ? `<br><a href="${esc(o.checkout)}" rel="nofollow noopener">checkout</a>` : ''}</td></tr>`).join('');
  return `${head(`${T} | price record · Mare Liberum`, d, `${b}${SEEN.path}/${rec.id}`, `${robots}<link rel="alternate" type="application/json" href="${esc(`${b}${SEEN.path}/${rec.id}.json`)}">${ld(data)}`)}
<body><main><p><a href="/">Mare Liberum</a> · <a href="${SEEN.path}">price records</a></p>
<h1>${esc(name)}</h1>
<p class="box"><b>${esc(money(p.price, cur))}</b>${p.price_is ? ' (from: its lowest variant)' : ''} at <b>${esc(rec.store)}</b>${p.in_stock === true ? ', in stock' : p.in_stock === false ? ', out of stock' : ''}${Number.isFinite(p.list_price) && p.list_price > p.price ? ` · its own list price ${esc(money(p.list_price, cur))}` : ''}<br><small>seen ${esc(when(rec.seen_at))} on <a href="${esc(p.url)}" rel="nofollow noopener">the product page</a>${p.brand ? ` · ${esc(p.brand)}` : ''}${p.gtin ? ` · GTIN ${esc(p.gtin)}` : ''}</small></p>
<h2>What the deal check found</h2><ul class="v">${rec.verdict.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
${rows ? `<h2>The same item at other stores</h2><table><thead><tr><th>Store</th><th>Price</th><th></th></tr></thead><tbody>${rows}</tbody></table><p><small>${rec.elsewhere_found} matching offer${rec.elsewhere_found === 1 ? '' : 's'} in stock found${rec.median ? ` · median of all prices ${esc(money(rec.median.price, rec.median.currency))} (of ${rec.median.of})` : ''}</small></p>` : '<p class="mut">No matching offer at another Shopify store was found at that minute.</p>'}
${rec.seen_before.checks ? `<p><small>Before this check agents saw this product ${rec.seen_before.checks} time${rec.seen_before.checks === 1 ? '' : 's'} through the sea since ${esc(String(rec.seen_before.since).slice(0, 10))}: lowest ${esc(money(rec.seen_before.low?.price, rec.seen_before.low?.currency))}, highest ${esc(money(rec.seen_before.high?.price, rec.seen_before.high?.currency))}.</small></p>` : ''}
<h2>Check it again</h2><p>Prices move, above all on sale days. A new check reads the page again and leaves a new record if anything changed:</p>
<pre>GET ${esc(rec.check_again)}</pre>
<p><small>Agents: the same check costs nothing ten times an hour; <code>GET ${esc(b)}/x402/deal?url=…</code> makes it for 0.01 USDC with up to 12 offers. This record as data: <a href="${SEEN.path}/${rec.id}.json">JSON</a> (SHA-256 of its canonical JSON inside).</small></p>
<p><small>${esc(rec.notice)}</small></p></main></body></html>`;
}

// the newest records, as the page /seen shows them
export function recordsPage(list, base) {
  const b = String(base || '').replace(/\/+$/, ''), xs = (Array.isArray(list) ? list : []).slice(0, SEEN.list);
  const d = 'Open price records of shopping agents: what Mare Liberum\'s deal check saw on product pages, with the same item at other stores, at the minute it was seen. Each record stays unchanged at its own address.';
  const site = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Price records · Mare Liberum', url: `${b}${SEEN.path}`, description: d };
  return `${head('Open price records of shopping agents | Mare Liberum', d, `${b}${SEEN.path}`, `<link rel="alternate" type="application/json" href="${esc(`${b}${SEEN.path}.json`)}">${ld(site)}`)}
<body><main><p><a href="/">Mare Liberum</a> · the open sea for agents</p><h1>Price records</h1><p>${esc(d)}</p>
<p>An agent makes one with every deal check of a product page and can hand it to its person as the source of the price it names:</p>
<pre>GET ${esc(b)}/deal?url=&lt;product page&gt;</pre>
${xs.length ? `<table><thead><tr><th>Product</th><th>Price</th><th>Seen</th></tr></thead><tbody>${xs.map((x) => `<tr><td><a href="${SEEN.path}/${esc(x.id)}">${esc(x.name || 'a product')}</a><br><small>${esc(x.store)} · ${esc(x.word || '')}${Number.isFinite(x.n) ? ` · ${x.n} other offer${x.n === 1 ? '' : 's'}` : ''}</small></td><td class="n">${esc(money(x.price, x.currency))}</td><td><small>${esc(when(x.at))}</small></td></tr>`).join('')}</tbody></table>` : '<p class="mut">The first record appears with the next deal check of a product page.</p>'}
<p><small>Records hold only the store's public page and the catalog's public offers, never who asked. Mare Liberum vouches for no store. Data: <a href="${SEEN.path}.json">JSON</a> · <a href="/llms.txt">/llms.txt</a></small></p></main></body></html>`;
}
export const recordsJson = (list, base) => { const b = String(base || '').replace(/\/+$/, ''); return { what: 'the newest open price records: what the deal check saw on product pages, each unchanged at its own address', records: (Array.isArray(list) ? list : []).slice(0, SEEN.list).map((x) => ({ ...x, url: `${b}${SEEN.path}/${x.id}`, json: `${b}${SEEN.path}/${x.id}.json` })), make_one: `${b}/deal?url=<product page>` }; };
