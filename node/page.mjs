// Mare Liberum · what a store page says about itself
// One reader for the sea and for every buoy: the same function runs in the node and, word for word, in buoy.mjs on
// the machines that lend the sea their compute. It reads the product the page declares (JSON-LD, then meta tags):
// title, price, currency, availability and the product image. It must stay self-contained: no outside names.
export function readHtml(html) {
  const s = String(html || '').slice(0, 1500000);
  const out = { title: null, price: null, currency: null, available: null, image: null };
  const money = (v) => {
    if (v == null) return null;
    let t = String(v).replace(/[^\d.,]/g, '');
    if (!t) return null;
    if (/,\d{1,2}$/.test(t) && !/\.\d{1,2}$/.test(t)) t = t.replace(/\./g, '').replace(',', '.'); else t = t.replace(/,/g, '');
    const n = Number(t);
    return Number.isFinite(n) && n > 0 && n < 1e7 ? Math.round(n * 100) / 100 : null;
  };
  const stock = (v) => {
    const t = String(v || '').toLowerCase().replace(/[^a-z]/g, '');
    if (!t) return null;
    if (/outofstock|soldout|discontinued|unavailable/.test(t)) return false;
    if (/instock|limitedavailability|presale|preorder|onlineonly|backorder/.test(t)) return true;
    return null;
  };
  const meta = (name) => {
    const m = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${name.replace(/[:.]/g, '\\$&')}["'][^>]*>`, 'i').exec(s);
    if (!m) return null;
    const c = /content=["']([^"']*)["']/i.exec(m[0]);
    return c && c[1].trim() ? c[1].trim() : null;
  };
  const found = [];
  const walk = (o, d) => {
    if (!o || typeof o !== 'object' || d > 7) return;
    if (Array.isArray(o)) { for (const x of o) walk(x, d + 1); return; }
    const types = [].concat(o['@type'] || []).map(String);
    if (types.some((x) => /^(Product|ProductGroup|IndividualProduct|ProductModel)$/i.test(x))) found.push(o);
    for (const k of ['@graph', 'mainEntity', 'itemListElement', 'item', 'hasVariant']) if (o[k] && !types.some((x) => /^Product/i.test(x) && k === 'hasVariant')) walk(o[k], d + 1);
  };
  for (const b of s.match(/<script[^>]*application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi) || []) {
    try { walk(JSON.parse(b.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '').trim()), 0); } catch {}
  }
  const p = found[0];
  if (p) {
    if (typeof p.name === 'string') out.title = p.name;
    const img = [].concat(p.image || [])[0];
    out.image = typeof img === 'string' ? img : (img && (img.url || img.contentUrl)) || null;
    const offers = [].concat(p.offers || []).concat([].concat(p.hasVariant || []).flatMap((v) => [].concat((v && v.offers) || [])));
    const list = offers.flatMap((o) => (o && /AggregateOffer/i.test(String(o['@type'])) ? [o, ...[].concat(o.offers || [])] : [o])).filter(Boolean);
    for (const o of list) {
      const pr = money(o.price != null ? o.price : o.lowPrice != null ? o.lowPrice : o.priceSpecification && o.priceSpecification.price);
      if (pr != null && out.price == null) { out.price = pr; out.currency = o.priceCurrency || (o.priceSpecification && o.priceSpecification.priceCurrency) || null; }
      const a = stock(o.availability);
      if (a === true) out.available = true; else if (a === false && out.available == null) out.available = false;
    }
  }
  if (!out.title) out.title = meta('og:title') || ((/<title[^>]*>([^<]{1,300})<\/title>/i.exec(s) || [])[1] || '').trim() || null;
  if (!out.image) out.image = meta('og:image:secure_url') || meta('og:image') || null;
  if (out.price == null) {
    out.price = money(meta('product:price:amount') || meta('og:price:amount') || meta('price'));
    out.currency = meta('product:price:currency') || meta('og:price:currency') || meta('priceCurrency') || out.currency;
  }
  if (out.available == null) out.available = stock(meta('product:availability') || meta('og:availability') || meta('availability'));
  if (out.currency) out.currency = String(out.currency).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || null;
  if (out.title) out.title = out.title.replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim().slice(0, 200);
  if (out.image && out.image.startsWith('//')) out.image = `https:${out.image}`;
  if (out.image) out.image = out.image.slice(0, 400);
  return out;
}

// the same product, seen from two places: the image file (without size and version) or the title must match
export const imgKey = (u) => { try { const x = new URL(String(u)); return x.pathname.split('/').pop().toLowerCase().replace(/_(\d+x\d*|\d*x\d+|small|medium|large|grande|compact|master)(?=[._@])/g, '').replace(/@\dx/, ''); } catch { return null; } };
export const titleKey = (t) => (t ? String(t).toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().slice(0, 60) : null);
