// Mare Liberum · the lean reader: what an agent needs of a page, and nothing it does not
// An agent pays for every token it reads. A page as the web sends it is mostly what a person never reads: menus, cookie
// banners, footers, galleries, the same links again and again, the template of a shop. The lean reader keeps the main
// part of a page and leaves the rest out before it writes the page as Markdown:
//   the page is parsed once, leniently, the way browsers read broken pages
//   left out: what a person does not see (scripts, styles, hidden boxes, text only for screen readers), form controls,
//     and boxes whose tag, role, class or id name navigation, headers, footers, sidebars, cookies, consent, sharing,
//     newsletters, pop-ups, drawers or other products — never a box that holds the page's main part or its heading
//   the main part is the page's main element (or role=main), else its largest article, else what is left of the body
//   a product page (Shopify, and any page with schema.org Product data) starts with what an agent buys by: the name, the
//     price and its currency, whether it is in stock, the options, the rating and the address of the page; the page's
//     own text follows, without the shop's template (pickers, galleries, other products, review widgets, price chatter)
//   links are written once each, without tracking parameters, as a path when they stay on the page's own site; links to
//     the same page, images and empty list items are left out; a line said twice is said once
// What the page says stays: its heading, prices, facts, tables, code, and the links that lead on.

// ---------------------------------------------------------------- characters
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…', laquo: '«', raquo: '»', copy: '©', reg: '®', euro: '€', pound: '£', yen: '¥', cent: '¢', trade: '™', deg: '°', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', middot: '·', bull: '•', times: '×', frac12: '½', frac14: '¼', frac34: '¾', shy: '' };
const cp = (n) => { try { return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ''; } catch { return ''; } };
export const entities = (s) => String(s || '').replace(/&#x([0-9a-f]+);/gi, (_, h) => cp(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => cp(Number(d))).replace(/&([a-z]+[0-9]*);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
const one = (s) => String(s ?? '').replace(/[\s ]+/g, ' ').trim();

// ---------------------------------------------------------------- a lenient parser: which text stands in which box
const VOID = new Set('area base br col embed hr img input link meta param source track wbr keygen command'.split(' '));
// elements whose content is not markup: read to their end tag at once (title is kept, the rest is never written)
const RAW = new Set('script style textarea title xmp noscript template iframe noembed noframes svg math'.split(' '));
const CLOSES_P = new Set('address article aside blockquote details div dl fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hr main menu nav ol p pre section table ul'.split(' '));
const IMPLIED = { li: new Set(['li']), dt: new Set(['dt', 'dd']), dd: new Set(['dt', 'dd']), tr: new Set(['tr', 'td', 'th']), td: new Set(['td', 'th']), th: new Set(['td', 'th']), option: new Set(['option']), thead: new Set(['tbody', 'tfoot', 'tr', 'td', 'th']), tbody: new Set(['thead', 'tbody', 'tfoot', 'tr', 'td', 'th']), tfoot: new Set(['thead', 'tbody', 'tr', 'td', 'th']) };
const DEPTH = 500;
export function parseHtml(html) {
  const root = { tag: '#root', a: '', kids: [], up: null }; let cur = root, depth = 0;
  const re = /<!--[\s\S]*?(?:-->|$)|<![^>]*>|<\?[^>]*>|<\/([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|[^<]+|</g;
  const s = String(html || ''); let m;
  while ((m = re.exec(s))) {
    const [all, close, open, attrs] = m;
    if (open) {
      const tag = open.toLowerCase();
      if (tag === 'p' || CLOSES_P.has(tag)) { if (cur.tag === 'p') { cur = cur.up; depth--; } }
      const imp = IMPLIED[tag]; if (imp) while (cur !== root && imp.has(cur.tag)) { cur = cur.up; depth--; }
      const el = { tag, a: attrs || '', kids: [], up: cur }; cur.kids.push(el);
      if (RAW.has(tag)) {
        const end = new RegExp(`</${tag}\\s*>`, 'ig'); end.lastIndex = re.lastIndex; const e = end.exec(s);
        if (tag === 'title') el.kids.push(s.slice(re.lastIndex, e ? e.index : s.length));
        re.lastIndex = e ? end.lastIndex : s.length; continue;
      }
      if (!VOID.has(tag) && !/\/\s*$/.test(attrs || '') && depth < DEPTH) { cur = el; depth++; }
    } else if (close) {
      const tag = close.toLowerCase(); let n = cur, d = depth; while (n !== root && n.tag !== tag) { n = n.up; d--; }
      if (n !== root) { cur = n.up; depth = d - 1; }
    } else if (all[0] !== '<' || all.length === 1) cur.kids.push(all);
  }
  return root;
}
// the attributes of an element, read once when they are first asked for
const ATTR = /([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
export function attrs(el) {
  if (el.o) return el.o;
  const o = {}; ATTR.lastIndex = 0; let m;
  while ((m = ATTR.exec(el.a || ''))) { const k = m[1].toLowerCase(); if (!(k in o)) o[k] = m[2] ?? m[3] ?? m[4] ?? ''; }
  return (el.o = o);
}
const isEl = (k) => typeof k !== 'string';
const safeDecode = (x) => { try { return decodeURIComponent(x); } catch { return x; } };
function* elements(root) { const stack = [root]; while (stack.length) { const n = stack.pop(); yield n; for (let i = n.kids.length - 1; i >= 0; i--) if (isEl(n.kids[i])) stack.push(n.kids[i]); } }
// the characters of text in each box, once, from the leaves up
function measure(root) {
  const order = [...elements(root)];
  for (let i = order.length - 1; i >= 0; i--) { const n = order[i]; let len = 0; for (const k of n.kids) len += isEl(k) ? k.len || 0 : k.replace(/\s+/g, '').length; n.len = len; }
  return order;
}
const textOfEl = (el) => { let out = ''; for (const k of el.kids) out += isEl(k) ? (k.tag === 'br' ? ' ' : textOfEl(k)) : k; return out; };

// ---------------------------------------------------------------- what a person does not see, and what is not the page
const DROP_TAGS = new Set('script style noscript template svg math iframe canvas object embed head title button select input textarea option optgroup datalist dialog map audio video picture source track label fieldset legend meter progress output'.split(' '));
const BAD_ROLE = /^(navigation|banner|contentinfo|dialog|alertdialog|search|menu|menubar|complementary|tooltip|toolbar)$/i;
// class and id words of boxes that are not the page: one word of the class or id (split at - and _) is enough …
const BOX_WORDS = new Set('cookie cookies consent gdpr newsletter popup popups modal modals drawer drawers share sharing social socials subscribe toast tooltip wishlist breadcrumb breadcrumbs nav navbar navigation megamenu footer sidebar announcement announcements skip skiplink backtotop'.split(' '));
// … or one of these parts anywhere in it
const BOX_PARTS = /cookie|consent|gdpr|newsletter|popup|pop-up|modal|drawer|breadcrumb|social|share-|sharing|skip-to|skip-link|back-to-top|scroll-to-top|mega-?menu|mobile-?menu|cart-drawer|cartdrawer|mini-?cart|cart-notification|cart-popup|side-?cart|predictive-search|search-modal|search-drawer|search-overlay|localization|country-selector|currency-selector|language-selector|payment-icons?|payment-list|payment-methods|chat-widget|intercom|zendesk|tidio|gorgias|klaviyo|privy|attentive|visually-hidden|sr-only|screen-reader|screenreader|recently-viewed|recommendation|related-|-related|upsell|cross-?sell|also-like|you-may|quick-?view|quick-?shop|quick-add-(modal|popup|drawer|button)|sticky-?(atc|cart|add|buy|bar)|(atc|cart)-sticky/i;
// the head of a site and its menus by class or id: left out around the main part, not inside it (inside, a box called
// "header" is often the title of a table or a section, and a "menu" can be what a restaurant serves)
const FRAME_WORDS = new Set('header masthead topbar menu menus'.split(' '));
// on a product page, the shop's widgets around the product: reviews and ratings (the rating is in the essentials)
const SHOP_PARTS = /review|rating|testimonial|judgeme|jdgm|yotpo|okendo|stamped|loox|junip|trustpilot|spr-|ali-reviews|product-recommend|complementary|bundle|frequently-bought|fbt-|instafeed|instagram/i;
const RESPONSIVE_SHOW = /^(sm|md|lg|xl|2xl):(block|flex|inline|inline-block|inline-flex|grid|table|contents)$/;
function hiddenEl(el) {
  const o = attrs(el);
  if ('hidden' in o || o['aria-hidden'] === 'true') return true;
  if (o.style && /display\s*:\s*none|visibility\s*:\s*hidden/i.test(o.style)) return true;
  if (o.class) { const c = o.class.split(/\s+/); if (c.includes('hidden') && !c.some((x) => RESPONSIVE_SHOW.test(x))) return true; }
  return false;
}
function boxWords(el) {
  const o = attrs(el), s = `${o.class || ''} ${o.id || ''}`.toLowerCase();
  if (!s.trim()) return null;
  return s;
}
// a word counts where it names the box: at the start or the end of a class name ("site-footer", "nav__item"), not in the
// middle of one ("show-nav-on-hover" is a way to show a slider, not a menu)
const boxIsBoiler = (s, inMain) => BOX_PARTS.test(s) || s.split(/\s+/).some((c) => { const w = c.split(/[_-]+/).filter(Boolean); if (!w.length) return false; const ends = w.length === 1 ? [w[0]] : [w[0], w[w.length - 1]]; return ends.some((x) => BOX_WORDS.has(x) || (!inMain && FRAME_WORDS.has(x))); });

// the page's own heading: the first h1 a person sees, inside its main part when it has one
function headingOf(root) {
  const seen = [];
  for (const el of elements(root)) if (el.tag === 'h1' && one(entities(textOfEl(el)))) seen.push(el);
  const visible = seen.filter((h) => { for (let n = h; n && n.tag !== '#root'; n = n.up) { if (hiddenEl(n)) return false; const w = boxWords(n); if (w && /visually-hidden|sr-only|screen-reader/.test(w)) return false; } return true; });
  const inMain = visible.find((h) => { for (let n = h.up; n; n = n.up) { if (n.tag === 'main' || n.tag === 'article' || /^main$/i.test(attrs(n).role || '')) return true; } return false; });
  return inMain || visible[0] || null;
}

// ---------------------------------------------------------------- the page as data: schema.org Product, a Shopify product
const looseJson = (s) => {
  const t = String(s || '').replace(/^\s*<!--|-->\s*$/g, '').replace(/^\s*\/\/<!\[CDATA\[|\/\/\]\]>\s*$/g, '').trim();
  if (!t) return null;
  try { return JSON.parse(t); } catch {}
  try { return JSON.parse(t.replace(/[\u0000-\u001f]+/g, ' ').replace(/,\s*([}\]])/g, '$1')); } catch { return null; }
};
const typeIs = (x, ...names) => [].concat(x?.['@type'] || []).some((t) => names.includes(String(t).replace(/^(https?:\/\/)?schema\.org\//, '').replace(/^schema:/, '')));
function productNodes(html) {
  const out = [];
  for (const m of String(html).matchAll(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    const j = looseJson(m[1]); if (!j) continue;
    // (the products of a list, ItemList, are a listing, not the page's product: they are not walked into)
    const walk = (x, d) => { if (d > 6 || !x || typeof x !== 'object') return; if (Array.isArray(x)) return x.forEach((y) => walk(y, d + 1)); if (typeIs(x, 'Product', 'ProductGroup', 'IndividualProduct', 'ProductModel')) out.push(x); for (const k of ['@graph', 'mainEntity']) if (x[k]) walk(x[k], d + 1); };
    walk(j, 0);
  }
  return out;
}
// a Shopify product as the theme writes it into the page ({{ product | json }}), for the product the address names. A
// page often holds several objects with that handle (apps keep their own copies): the fullest one is taken — options
// named, prices above zero, availability, the description
function shopifyProduct(html, handle) {
  if (!handle) return null;
  const s = String(html), want = `"handle":"${handle}"`; let at = 0, tries = 0, best = null, top = 0;
  while (tries < 12 && (at = s.indexOf(want, at)) !== -1) {
    tries++;
    const start = s.lastIndexOf('{"id":', at); at += want.length;
    if (start === -1 || at - start > 4000) continue;
    const end = closing(s, start); if (end === -1) continue;
    const j = looseJson(s.slice(start, end + 1));
    if (!j || j.handle !== handle || !Array.isArray(j.variants) || !j.variants.length) continue;
    const v = j.variants;
    const sc = (v.some((x) => x && 'option1' in x) ? 3 : 0) + (Array.isArray(j.options) && j.options.length ? 2 : 0) + (v.some((x) => cents(x?.price) > 0) ? 2 : 0) + (v.some((x) => typeof x?.available === 'boolean') ? 1 : 0) + (typeof j.description === 'string' ? 1 : 0);
    if (sc > top) { top = sc; best = j; }
  }
  return best && top >= 2 ? best : null;
}
// where the JSON object that starts at i ends (strings and escapes respected), or -1
function closing(s, i) {
  let d = 0, str = false;
  for (let k = i, n = Math.min(s.length, i + 600_000); k < n; k++) {
    const c = s[k];
    if (str) { if (c === '\\') k++; else if (c === '"') str = false; continue; }
    if (c === '"') str = true; else if (c === '{' || c === '[') d++; else if (c === '}' || c === ']') { d--; if (d === 0) return k; }
  }
  return -1;
}
const AVAIL = { instock: 'in stock', instoreonly: 'in store only', onlineonly: 'in stock', limitedavailability: 'limited', preorder: 'pre-order', presale: 'pre-sale', backorder: 'back-order', outofstock: 'out of stock', soldout: 'sold out', discontinued: 'discontinued' };
const availOf = (v) => { const k = String(v || '').replace(/^.*\//, '').toLowerCase(); return AVAIL[k] || null; };
const inStock = (a) => a === 'in stock' || a === 'limited' || a === 'in store only';
const num = (v) => { if (v == null || v === '') return null; const n = Number(String(v).replace(/[^\d.,-]/g, '').replace(/,(?=\d{3}\b)/g, '').replace(',', '.')); return Number.isFinite(n) && n >= 0 ? n : null; };
const money = (n) => (n == null ? null : (Math.round(n * 100) / 100).toFixed(2));
// Shopify writes prices in cents when it writes numbers ({{ product | json }}), in units when it writes them as text with a point
const cents = (v) => (v == null || v === '' ? null : typeof v === 'number' ? v / 100 : String(v).includes('.') ? num(v) : num(v) / 100);
const strOf = (v) => (typeof v === 'string' ? v : v && typeof v === 'object' ? v.name || v['@id'] || '' : v == null ? '' : String(v));
function offersOf(x) {
  const o = x?.offers; if (!o) return [];
  const list = [];
  for (const it of [].concat(o)) {
    if (!it || typeof it !== 'object') continue;
    if (Array.isArray(it.offers)) list.push(...it.offers.filter((y) => y && typeof y === 'object'));
    list.push(it);
  }
  return list.map((f) => {
    const specs = [].concat(f.priceSpecification || []), was = specs.find((p) => /strikethrough|listprice|msrp/i.test(String(p?.priceType || '')));
    return { price: num(f.price ?? specs.find((p) => !/strikethrough|listprice|msrp/i.test(String(p?.priceType || '')))?.price), low: num(f.lowPrice), high: num(f.highPrice), cur: strOf(f.priceCurrency || specs[0]?.priceCurrency) || null, avail: availOf(f.availability), url: strOf(f.url), name: one(f.name), sku: strOf(f.sku), was: num(was?.price), count: num(f.offerCount) };
  });
}
const variantIdOf = (u) => /[?&]variant=(\d+)/.exec(String(u || ''))?.[1] || null;
// the essentials of a product page, or null when the page is no product
export function productOf(html, pageUrl, { heading } = {}) {
  let page; try { page = new URL(pageUrl); } catch { page = null; }
  const h = String(html || ''), head = h.slice(0, 400_000);
  const meta = (k) => { for (const m of head.matchAll(/<meta\b[^>]*>/gi)) { const t = m[0], n = /(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i.exec(t)?.[1]?.toLowerCase(); if (n === k) return entities(/content\s*=\s*"([^"]*)"|content\s*=\s*'([^']*)'/i.exec(t)?.slice(1).find((x) => x != null) || '').trim() || null; } return null; };
  const handle = /\/products\/([^/?#]+)/.exec(page?.pathname || '')?.[1] || null;
  const nodes = productNodes(h), sp = shopifyProduct(h, handle ? safeDecode(handle) : null);
  const ogType = (meta('og:type') || '').toLowerCase(), ogPrice = num(meta('og:price:amount') || meta('product:price:amount'));
  if (!nodes.length && !sp && !(ogType.includes('product') && ogPrice != null)) return null;
  // the product this page is about: the one whose address is this page, else the one with offers or variants
  const pathOf = (u) => { try { return new URL(u, pageUrl).pathname.replace(/\/+$/, ''); } catch { return ''; } };
  const here = page?.pathname.replace(/\/+$/, '') || '';
  const score = (x) => (pathOf(x.url || x['@id']) === here ? 4 : 0) + (x.offers ? 2 : 0) + (x.hasVariant ? 2 : 0) + (typeIs(x, 'ProductGroup') ? 1 : 0) + (x.name ? 1 : 0);
  const main = nodes.slice().sort((a, b) => score(b) - score(a))[0] || null;
  // several different products and none of them this page's own: a listing, not a product page
  if (!sp && new Set(nodes.map((x) => one(strOf(x.name)).toLowerCase()).filter(Boolean)).size > 2 && !nodes.some((x) => pathOf(x.url || x['@id']) === here)) return null;
  const same = nodes.filter((x) => x !== main && (!main?.name || !x.name || one(x.name).toLowerCase() === one(main.name).toLowerCase()));
  const pick = (f) => { for (const x of [main, ...same]) { const v = x && f(x); if (v != null && v !== '' && !(Array.isArray(v) && !v.length)) return v; } return null; };
  const name = one(entities(strOf(pick((x) => x.name)) || sp?.title || heading || meta('og:title') || ''));
  const cur0 = pick((x) => offersOf(x).find((f) => f.cur)?.cur) || pick((x) => [].concat(x.hasVariant || []).map((v) => offersOf(v).find((f) => f.cur)?.cur).find(Boolean))
    || /Shopify\.currency\s*=\s*\{"active":"([A-Z]{3})"/.exec(h)?.[1] || meta('og:price:currency') || meta('product:price:currency') || null;
  // the variants: Shopify's own list first (it knows the options), else the variants and offers of the structured data
  let variants = [], options = null;
  if (sp?.variants?.length) {
    const names = Array.isArray(sp.options) ? sp.options.map((o) => (typeof o === 'string' ? o : o?.name)).filter(Boolean) : [];
    if (names.length && !(names.length === 1 && /^title$/i.test(names[0]))) options = names;
    variants = sp.variants.map((v) => ({ id: String(v.id), title: one(v.title || v.public_title || ''), price: cents(v.price), was: cents(v.compare_at_price) || null, avail: v.available === true ? 'in stock' : v.available === false ? 'out of stock' : null, opts: [v.option1, v.option2, v.option3].filter((o) => o != null), sku: v.sku || null, gtin: v.barcode || null }));
  }
  const ldVariants = [];
  for (const v of [].concat(pick((x) => x.hasVariant) || [])) { if (!v || typeof v !== 'object') continue; const f = offersOf(v)[0] || {}; ldVariants.push({ id: variantIdOf(v['@id'] || v.url || f.url), title: one(strOf(v.name)).replace(name ? new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[-–—:]\\s*`, 'i') : /^$/, ''), price: f.price, was: f.was, cur: f.cur, avail: f.avail, props: Object.fromEntries(['color', 'size', 'material', 'pattern'].filter((k) => v[k]).map((k) => [k, one(strOf(v[k]))])), gtin: strOf(v.gtin13 || v.gtin12 || v.gtin || v.gtin14 || v.gtin8) || null }); }
  const offers = pick((x) => offersOf(x)) || [];
  if (!variants.length && ldVariants.length) variants = ldVariants.map((v) => ({ ...v, opts: Object.values(v.props).length ? Object.values(v.props) : null }));
  if (!variants.length && offers.length > 1) variants = offers.filter((f) => f.price != null || f.avail).map((f) => ({ id: variantIdOf(f.url), title: f.name, price: f.price, was: f.was, avail: f.avail, sku: f.sku }));
  // availability the structured data states wins over Shopify's (which a theme may not fill)
  for (const v of variants) { const ld = (v.id && ldVariants.find((x) => x.id === v.id)) || (v.id && offers.find((f) => variantIdOf(f.url) === v.id)); if (ld?.avail) v.avail = ld.avail; if (!v.gtin && ld?.gtin) v.gtin = ld.gtin; }
  if (!options && ldVariants.some((v) => Object.keys(v.props).length)) options = Object.keys(ldVariants.find((v) => Object.keys(v.props).length).props).map((k) => k[0].toUpperCase() + k.slice(1));
  // the variant the address names, else the only one
  const vid = variantIdOf(pageUrl), sel = (vid && variants.find((v) => v.id === vid)) || (variants.length === 1 ? variants[0] : null);
  const first = offers[0] || {};
  let price = sel?.price ?? null, was = sel?.was ?? null;
  const prices = variants.map((v) => v.price).filter((x) => x != null);
  const low = prices.length ? Math.min(...prices) : first.low ?? null, high = prices.length ? Math.max(...prices) : first.high ?? null;
  if (!price) price = first.price || (low != null && low === high ? low : null) || (low == null ? ogPrice : null) || price;
  if (was == null && !sel) was = first.was ?? null;
  if (was != null && price != null && was <= price) was = null;
  const known = variants.filter((v) => v.avail), stocked = known.filter((v) => inStock(v.avail));
  const avail = sel?.avail || (known.length ? (stocked.length ? 'in stock' : known[0].avail) : first.avail || availOf(meta('og:availability') || meta('product:availability')));
  const rating = pick((x) => x.aggregateRating && typeof x.aggregateRating === 'object' ? x.aggregateRating : null);
  // (Shopify's own placeholder for a shop without a vendor name is no brand)
  const brand = one(entities(strOf(pick((x) => x.brand)) || sp?.vendor || '')).replace(/^my store$/i, '') || null;
  const canon = (() => { const m = /<link\b[^>]*rel\s*=\s*["']canonical["'][^>]*>/i.exec(head)?.[0]; const href = m && /href\s*=\s*["']([^"']+)["']/i.exec(m)?.[1]; try { return new URL(entities(href || strOf(main?.url) || meta('og:url') || pageUrl), pageUrl).href; } catch { return pageUrl; } })();
  const description = one(entities(strOf(pick((x) => x.description)) || '')) || null;
  return {
    name: name || null, brand, price, was, low: low !== high ? low : null, high: low !== high ? high : null, currency: cur0 ? String(cur0).toUpperCase().slice(0, 3) : null, availability: avail || null,
    variants: variants.length > 1 ? { n: variants.length, inStock: known.length ? stocked.length : null, options, list: variants, selected: sel && variants.length > 1 ? sel.title : null } : null,
    rating: rating ? { value: num(rating.ratingValue), best: num(rating.bestRating) || 5, count: num(rating.reviewCount ?? rating.ratingCount) } : null,
    gtin: sel?.gtin || (variants.length <= 1 ? strOf(main?.gtin13 || main?.gtin12 || main?.gtin || main?.gtin14 || main?.gtin8) || null : null),
    url: canon, path: (() => { try { const c = new URL(canon); return page && c.origin === page.origin ? c.pathname + c.search : null; } catch { return null; } })(), description, descriptionHtml: typeof sp?.description === 'string' && /<[a-z]/i.test(sp.description) ? sp.description : null, handle: handle ? safeDecode(handle) : null,
  };
}
// the options of the variants, value by value (at most a dozen values each)
function optionLines(v) {
  const n = Math.max(0, ...v.list.map((x) => x.opts?.length || 0));
  if (!n) return [`Variants: ${v.list.slice(0, 12).map((x) => x.title).filter(Boolean).join(', ')}${v.n > 12 ? `, … (${v.n})` : ''}`];
  const out = [];
  for (let i = 0; i < n; i++) {
    const vals = []; for (const x of v.list) { const o = x.opts?.[i]; if (o != null && o !== '' && !vals.includes(o)) vals.push(o); }
    if (!vals.length || (vals.length === 1 && /^default title$/i.test(vals[0]))) continue;
    const label = v.options?.[i] || (n > 1 ? `Option ${i + 1}` : 'Variants');
    out.push(`${label}: ${vals.slice(0, 12).join(', ')}${vals.length > 12 ? `, … (${vals.length})` : ''}`);
  }
  return out;
}
export function essentialsMd(p) {
  if (!p) return '';
  const cur = p.currency ? ` ${p.currency}` : '', m = (x) => `${money(x)}${cur}`;
  const lines = [];
  if (p.price != null) lines.push(`Price: ${m(p.price)}${p.was != null ? ` (was ${m(p.was)})` : ''}${p.low != null && p.high != null && p.low !== p.high ? ` · all variants ${money(p.low)}–${m(p.high)}` : ''}`);
  else if (p.low != null) lines.push(`Price: ${money(p.low)}–${m(p.high)}`);
  const v = p.variants;
  if (p.availability) lines.push(`Availability: ${p.availability}${v?.inStock != null ? (v.selected && !inStock(p.availability) ? `; ${v.inStock} of ${v.n} variants in stock` : ` (${v.inStock} of ${v.n} variants)`) : ''}`);
  if (v?.selected) lines.push(`Selected: ${v.selected}`);
  if (v) for (const l of optionLines(v)) lines.push(l);
  if (p.brand) lines.push(`Brand: ${p.brand}`);
  if (p.rating?.value != null) lines.push(`Rating: ${Math.round(p.rating.value * 100) / 100} of ${p.rating.best}${p.rating.count != null ? ` (${p.rating.count} review${p.rating.count === 1 ? '' : 's'})` : ''}`);
  if (p.gtin) lines.push(`GTIN: ${p.gtin}`);
  if (p.url) lines.push(`Page: ${p.path || p.url}`);
  return `${p.name ? `# ${p.name}\n\n` : ''}${lines.map((l) => `- ${l}`).join('\n')}`;
}

// ---------------------------------------------------------------- links: once each, short, without tracking
const TRACK = /^(utm_[a-z_]+|_gsid|_pos|_sid|_ss|_psq|_v|_ga|_gl|gclid|gclsrc|dclid|fbclid|msclkid|yclid|igshid|mc_cid|mc_eid|_hsenc|_hsmi|mkt_tok|srsltid|pk_[a-z_]+|mtm_[a-z_]+|oly_[a-z_]+|vero_[a-z_]+|ref_src|ref_url|spm|scm|trk|trkid|cmpid|campaign_id|ad_id|adgroupid|affiliate_id)$/i;
export function cleanUrl(u) {
  let x; try { x = new URL(u); } catch { return u; }
  const ks = [...x.searchParams.keys()];
  if (ks.some((k) => TRACK.test(k))) { for (const k of ks) if (TRACK.test(k)) x.searchParams.delete(k); }
  return x.href;
}
const SOCIAL_HOSTS = /(^|\.)(facebook\.com|fb\.com|instagram\.com|twitter\.com|x\.com|pinterest\.[a-z.]+|tiktok\.com|linkedin\.com|snapchat\.com|threads\.net|whatsapp\.com|wa\.me|t\.me|telegram\.me|reddit\.com|tumblr\.com|vk\.com|weibo\.com|line\.me)$/i;
const SHARE_PATH = /sharer|share|intent\/|pin\/create|submit|sharearticle|send\?/i;
const NETWORK_NAME = /^(facebook|instagram|twitter|x|pinterest|tiktok|linkedin|snapchat|threads|whatsapp|telegram|reddit|tumblr|youtube|e-?mail|share|tweet|pin it|follow us)$/i;

// ---------------------------------------------------------------- the writer: the main part as Markdown
const BLOCK = new Set('address article aside blockquote body center dd details dialog div dl dt fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hgroup hr li main menu nav ol p pre section summary table tbody td tfoot th thead tr ul'.split(' '));
const PILCROW = /^[¶#§🔗⚓]$|^(permalink|link to this (heading|section)|anchor|copy link)$/i;
function writer(page, base) {
  const seen = new Set(), links = [];
  const pageKey = page ? page.origin + page.pathname + page.search : '';
  const link = (href) => {
    let u; try { u = new URL(entities(String(href || '')).trim(), base); } catch { return null; }
    if (!/^https?:$/.test(u.protocol)) return null;
    if (page && u.hash && u.origin + u.pathname + u.search === pageKey) return null;
    if (page && !u.hash && u.href === page.href) return null;
    const abs = cleanUrl(u.href); let x; try { x = new URL(abs); } catch { return null; }
    return { abs, short: page && x.origin === page.origin ? (x.pathname + x.search + x.hash) || '/' : abs, host: x.hostname, path: x.pathname };
  };
  const md = (el, st) => {
    let out = '';
    for (const k of el.kids) {
      if (!isEl(k)) { out += st.pre ? entities(k) : entities(k).replace(/[\s ]+/g, ' '); continue; }
      const t = k.tag;
      if (t === 'br') { out += st.pre ? '\n' : '\n'; continue; }
      if (t === 'img' || t === 'wbr' || t === 'hr') { if (t === 'hr') out += '\n\n'; continue; }
      if (st.pre) { out += md(k, st); continue; }
      if (t.length === 2 && t[0] === 'h' && t[1] >= '1' && t[1] <= '6') {
        const x = one(md(k, { ...st, heading: true })); if (!x || PILCROW.test(x)) continue;
        out += st.link ? ` ${x} ` : `\n\n${'#'.repeat(Number(t[1]))} ${x}\n\n`; continue;
      }
      if (t === 'pre') { const code = entities(textOfEl(k)).replace(/^\n+|\s+$/g, ''); if (code.trim()) { const lang = /(?:^|\s)(?:language-|lang-|brush:\s*)([\w+#.-]+)/i.exec(`${attrs(k).class || ''} ${k.kids.find((c) => isEl(c) && c.tag === 'code') ? attrs(k.kids.find((c) => isEl(c) && c.tag === 'code')).class || '' : ''}`)?.[1] || ''; out += `\n\n\`\`\`${lang}\n${code}\n\`\`\`\n\n`; } continue; }
      if (t === 'code' || t === 'kbd' || t === 'samp') { const x = one(entities(textOfEl(k))); if (x) out += `\`${x.replace(/`/g, "'")}\``; continue; }
      if (t === 'a') {
        const x = one(md(k, { ...st, link: true }));
        if (!x || PILCROW.test(x)) continue;
        if (st.link) { out += x; continue; }
        const L = link(attrs(k).href);
        if (!L) { out += ` ${x} `; continue; }
        if (SOCIAL_HOSTS.test(L.host) && (SHARE_PATH.test(L.path + L.abs) || NETWORK_NAME.test(x))) continue;
        if (NETWORK_NAME.test(x) && SOCIAL_HOSTS.test(L.host)) continue;
        if (seen.has(L.abs)) { out += ` ${x} `; continue; }
        seen.add(L.abs); links.push({ text: x.slice(0, 120), url: L.abs, short: L.short });
        out += ` [${x.replace(/[[\]]/g, '')}](${L.short}) `; continue;
      }
      if (t === 'ul' || t === 'ol') { const l = list(k, st, t === 'ol'); if (l) out += `\n\n${l}\n\n`; continue; }
      if (t === 'li') { const x = md(k, st).trim(); if (x) out += `\n- ${x.replace(/\n+/g, ' ')}\n`; continue; }
      if (t === 'table') { out += `\n\n${table(k, st)}\n\n`; continue; }
      if (t === 'dl') { out += `\n\n${dl(k, st)}\n\n`; continue; }
      if (t === 'blockquote') { const x = tidy(md(k, st)); if (x) out += `\n\n${x.split('\n').map((l) => `> ${l}`).join('\n')}\n\n`; continue; }
      if (BLOCK.has(t) || t.includes('-')) { out += `\n\n${md(k, st)}\n\n`; continue; }
      out += md(k, st);
    }
    return out;
  };
  const list = (el, st, ordered) => {
    const items = []; let n = 0;
    const item = (k) => {
      const body = tidy(md(k, { ...st, depth: (st.depth || 0) + 1 })); if (!body || !/[\p{L}\p{N}]/u.test(body)) return;
      n++; const [head, ...rest] = body.split('\n').filter((l) => l.trim());
      items.push(`${ordered ? `${n}.` : '-'} ${head}${rest.length ? `\n${rest.map((l) => `  ${l}`).join('\n')}` : ''}`);
    };
    for (const k of el.kids) { if (!isEl(k)) { if (k.trim()) items.push(one(entities(k))); continue; } if (k.tag === 'li') item(k); else if (k.tag === 'ul' || k.tag === 'ol') { const l = list(k, st, k.tag === 'ol'); if (l) items.push(l.split('\n').map((x) => `  ${x}`).join('\n')); } else item(k); }
    return items.join('\n');
  };
  const table = (el, st) => {
    const rows = []; let layout = false;
    const collect = (n) => { for (const k of n.kids) { if (!isEl(k)) continue; if (k.tag === 'tr') rows.push(k); else if (k.tag === 'thead' || k.tag === 'tbody' || k.tag === 'tfoot') collect(k); } };
    collect(el);
    for (const r of rows) for (const c of r.kids) if (isEl(c) && [...elements(c)].some((x) => x !== c && (x.tag === 'table' || /^h[1-6]$/.test(x.tag) || x.tag === 'ul' || x.tag === 'ol'))) layout = true;
    if (layout || !rows.length) return md(el, st);
    const lines = [];
    for (const r of rows) {
      const cells = r.kids.filter((c) => isEl(c) && (c.tag === 'td' || c.tag === 'th')).map((c) => one(md(c, st)));
      if (cells.some((c) => c)) lines.push(cells.join(' | '));
    }
    return lines.join('\n');
  };
  const dl = (el, st) => {
    const out = []; let term = null;
    for (const k of el.kids) {
      if (!isEl(k)) continue;
      const x = one(md(k, st)); if (!x) continue;
      if (k.tag === 'dt') { if (term) out.push(term); term = x; } else if (k.tag === 'dd' && term && term.length <= 60) { out.push(`${term}: ${x}`); term = null; } else { if (term) out.push(term); term = null; out.push(x); }
    }
    if (term) out.push(term);
    return out.join('\n');
  };
  return { md, links };
}
// lines: trimmed, one blank line at most, list indentation and code kept
function tidy(s) {
  const out = []; let code = false;
  for (const raw of String(s).split('\n')) {
    if (/^\s*```/.test(raw)) { code = !code; out.push(raw.trim()); continue; }
    if (code) { out.push(raw.replace(/\s+$/, '')); continue; }
    const ind = /^( *)(?:[-*]|\d+\.) /.exec(raw)?.[1] || '';
    // (a link is written with a space on each side; none before a comma or a full stop, none inside brackets)
    const l = raw.replace(/[ \t\u00a0]+/g, ' ').replace(/ ([.,;:!?)\]])(?=\s|$)/g, '$1').replace(/([(\[]) (?=\[)/g, '$1').trim();
    out.push(l ? ind + l : '');
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ---------------------------------------------------------------- the last pass over the lines
const UI_WORDS = new Set('add to cart|add to bag|add to basket|buy now|buy it now|sold out|sale sold out|sold out sale|unavailable|coming soon|out of stock|in stock|pre-order|preorder|notify me|notify me when available|quantity|decrease quantity|increase quantity|regular price|sale price|unit price|sale|new|msrp|price|was|now|from|per|each|save|choose options|select options|view details|view full details|learn more|read more|show more|show less|view more|close|open|menu|search|share|copy link|link copied|link copied to clipboard|pickup available|shipping calculated at checkout|tax included|taxes included|or|and|default title|size guide|size chart|reviews|write a review|ask a question|find similar|find similar products|similar items|sponsored|available|availability|color|colour|size|style|qty|button label|translation missing|loading|loading data|please wait|skip to product information|skip to content'.split('|'));
// (no word boundaries: shops write "€119,00€89,00Sale" without a space between their spans)
const PRICE_WORDS = /(regular|sale|price|unit|msrp|was|now|from|save|compare|at|per|each|off|incl|excl|tax|vat|usd|eur|gbp|aud|cad|chf|nzd|jpy|sek|nok|dkk|pln|inr)/gi;
const COOKIE = /\b(we|this (web)?site|our (web)?site) uses? cookies\b|\bcookie (policy|settings|preferences|consent)\b|\baccept (all )?cookies\b|\bmanage (cookies|consent|preferences)\b/i;
// what a page says to a browser, not to its reader
const NOTICE = /\b(update|upgrade) your browser\b|\b(javascript|js) (is )?(disabled|required|not enabled|turned off)\b|\benable javascript\b|\byour browser (is|does not|doesn't)\b|\bskip to (main )?content\b/i;
// what a page says around its text on every site, as a whole line: feedback buttons, copy buttons, tables of contents
const CHROME_LINES = new Set('was this page helpful|was this helpful|was this article helpful|did this page help you|copy|copied|copy code|copy to clipboard|edit this page|edit on github|print|back to top|table of contents|on this page|in this article|skip to main content|skip to content|loading|loading data|loading...|please wait, we are loading chart data|yes|no|thank you for your feedback'.split('|'));
const LANGS = new Set('js javascript jsx ts tsx typescript python py bash sh shell zsh console powershell ps1 json jsonc html xml css scss sql yaml yml toml ini http text plain txt c cpp c++ csharp cs java kotlin go golang rust rs ruby rb php swift r dart lua perl diff markdown md dockerfile makefile graphql'.split(' '));
const keyOf = (l) => l.replace(/^\s*(#+ |[-*] |\d+\. |> )/, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').toLowerCase().replace(/\s+/g, ' ').replace(/^[\s\p{P}]+|[\s\p{P}]+$/gu, '');
function lastPass(md, { product, seen = new Set(), menus = true } = {}) {
  const lines = md.split('\n'), out = []; let code = false, prev = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^```/.test(l)) {
      // a code example's label ("js", "python") written just before it: the fence says it once
      if (!code) { let j = out.length - 1; while (j >= 0 && !out[j]) j--; const w = j >= 0 ? out[j].trim().toLowerCase() : ''; if (LANGS.has(w)) { out.length = j; if (l === '```') { out.push(`\`\`\`${w}`); code = true; prev = null; continue; } } }
      code = !code; out.push(l); prev = null; continue;
    }
    if (code) { out.push(l); continue; }
    if (!l.trim()) { out.push(''); continue; }
    if (!/[\p{L}\p{N}]/u.test(l)) continue;
    const k = keyOf(l), heading = /^#/.test(l);
    if (!k) continue;
    if (k === prev) continue;
    if (product && (UI_WORDS.has(k) || (k.length < 40 && !k.replace(PRICE_WORDS, '').replace(/[\d\s.,:/%$€£¥₹+–-]+/g, '').trim()))) continue;
    if (k.length < 500 && (COOKIE.test(k) || NOTICE.test(k))) continue;
    if (CHROME_LINES.has(k)) continue;
    if (seen.has(k) && (k.length >= 20 || heading || (product && /\d/.test(k) && k.length < 40))) continue;
    seen.add(k); prev = k; out.push(l);
  }
  if (!menus) return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  // menus that slipped through a page without a main part: runs of three or more short link-only lines
  const navItem = (l) => /^(\s*[-*] |\s*\d+\. )?\[[^\]]{1,40}\]\([^)]+\)$/.test(l);
  const drop = new Set();
  for (let i = 0; i < out.length;) {
    if (!navItem(out[i])) { i++; continue; }
    let j = i, n = 0; while (j < out.length && (navItem(out[j]) || out[j] === '')) { if (out[j]) n++; j++; }
    if (n >= 3) for (let x = i; x < j; x++) drop.add(x);
    i = j;
  }
  return out.filter((_, i) => !drop.has(i)).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ---------------------------------------------------------------- the lean reader
export function leanMarkdown(html, base, { product: wantProduct = true } = {}) {
  let page; try { page = new URL(base); } catch { page = null; }
  const root = parseHtml(html), order = measure(root);
  const body = order.find((n) => n.tag === 'body') || root, h1 = headingOf(root);
  const product = wantProduct ? productOf(html, base, { heading: h1 ? one(entities(textOfEl(h1))) : null }) : null;
  // what must stay: the heading, the main part, and every box that holds one of them
  const keep = new Set();
  const hold = (n) => { for (let x = n; x; x = x.up) keep.add(x); };
  if (h1) hold(h1);
  for (const n of order) if (n.tag === 'main' || /^main$/i.test(attrs(n).role || '')) hold(n);
  const handle = product?.handle, other = (href) => { const m = /\/products\/([^/?#]+)/.exec(String(href || '')); return !!m && safeDecode(m[1]) !== handle; };
  const bodyLen = body.len || 1;
  if (product) {
    // the product's own text holds its place: the box with the start of its description stays, like the heading
    const probe = keyOf(product.description || '').slice(0, 32);
    if (probe.length >= 20) for (const n of order) { if (n.kids.some((k) => !isEl(k) && keyOf(entities(k)).includes(probe))) { hold(n); break; } }
    // other products in a box: how many links lead to them, and how much of the box's text they are (from the leaves up)
    for (let i = order.length - 1; i >= 0; i--) { const n = order[i]; let c = 0, l = 0; if (n.tag === 'a' && other(attrs(n).href)) { c = 1; l = n.len || 0; } else for (const k of n.kids) if (isEl(k)) { c += k.op || 0; l += k.opl || 0; } n.op = c; n.opl = l; }
  }
  const prune = (n, inMain) => {
    n.kids = n.kids.filter((k) => {
      if (!isEl(k)) return true;
      const t = k.tag;
      if (DROP_TAGS.has(t)) return keep.has(k) && t !== 'script' && t !== 'style';
      if (!keep.has(k)) {
        if (t === 'nav' || t === 'aside' || t === 'footer' || t === 'menu' || (t === 'header' && !inMain)) return false;
        if (hiddenEl(k)) return false;
        const o = attrs(k);
        if (o.role && BAD_ROLE.test(o.role)) return false;
        // a custom element names itself (cart-drawer, quick-add-modal, product-recommendations): its name counts like a class
        const w = `${boxWords(k) || ''}${t.includes('-') ? ` ${t}` : ''}`.trim();
        if (w && k.len < bodyLen * 0.5 && (boxIsBoiler(w, inMain) || (product && SHOP_PARTS.test(w)))) return false;
        if (product && t === 'form' && /\/cart(\/add)?\b/i.test(o.action || '')) return false;
        // a box of other products (recommendations, "complete the look", a grid): two or more links to them that are a fifth
        // of its text, or four and more
        if (product && k.len < bodyLen * 0.5 && k.op >= 2 && (k.op >= 4 || k.opl >= k.len * 0.2)) return false;
      }
      prune(k, inMain || t === 'main' || t === 'article' || /^main$/i.test(attrs(k).role || ''));
      return true;
    });
  };
  prune(body, false);
  measure(body);
  // the main part: main (or role=main), else the largest article, else the body
  const big = (n) => n && n.len >= 200 && n.len >= body.len * 0.2;
  const largest = (f) => { let best = null; for (const n of elements(body)) if (f(n) && (!best || n.len > best.len)) best = n; return best; };
  const mainEl = largest((n) => n.tag === 'main' || /^main$/i.test(attrs(n).role || '')), art = largest((n) => n.tag === 'article');
  const region = big(mainEl) ? mainEl : big(art) ? art : body;
  const w = writer(page, base);
  let md = tidy(w.md(region, {}));
  // the heading stands first, also when the page put it outside its main part
  const inRegion = (n) => { for (let x = n; x; x = x.up) if (x === region) return true; return false; };
  if (h1 && !inRegion(h1)) { const x = one(entities(textOfEl(h1))); if (x) md = `# ${x}\n\n${md}`; }
  let head = '';
  if (product) {
    head = essentialsMd(product);
    // the description, when the page's own text does not carry it
    const d = product.description, probe = d && keyOf(d).slice(0, 60);
    if (d && probe && !keyOf(md.replace(/\n/g, ' ')).includes(probe)) {
      if (product.descriptionHtml) { const r2 = parseHtml(product.descriptionHtml); head += `\n\n${tidy(w.md(r2, {}))}`; } else head += `\n\n${d}`;
    }
  }
  // the essentials are said as they are; what the page says after them is said once, without the shop's chatter
  const rest = lastPass(md, { product: !!product, seen: new Set(head.split('\n').map(keyOf).filter(Boolean)), menus: region === body });
  const md2 = [head, rest].filter(Boolean).join('\n\n');
  // the links the Markdown still carries (a menu left out takes its links with it), each as a full address
  return { md: md2, links: w.links.filter((l) => md2.includes(`](${l.short})`)).map(({ text, url }) => ({ text, url })), product };
}
