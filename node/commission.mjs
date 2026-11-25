// Mare Liberum · commissions: money without anyone pressing a button.
// A shop may pay a commission when a person buys after an agent walked a link the sea handed out. That is the whole idea,
// and it is held to four rules:
//   1. Only the operator turns it on, in the node's environment (MARE_COMMISSION, JSON; the ids come from the networks the
//      operator signed up with). Nothing set, nothing changes: every answer stays what it is, byte for byte.
//   2. It is applied where a link leaves the sea for a person and nowhere else: when a person's browser opens a /via/
//      address (the redirect), and on the shop links the buying answers hand out directly (decide, ask). The sea never
//      fetches a commission link itself, a crawler never gets one, and the app door (/mcp/app) never changes.
//   3. Ranking, verification and the order of an answer never read it: it is laid over an answer that is already made.
//   4. Every such link says so: commission: true in JSON (with the network), a short marker on pages, COMMISSION_RULE.
// The operator rests it without a release: put "commission" into rest of immune:policy.
//
// MARE_COMMISSION, every part optional:
//   { "domains": { "amazon.de": { "tag": "yourtag-21" } },                     query parameters a shop's own program reads
//     "awin":    { "affid": "123456", "merchants": { "shop.example": "4711" } }, Awin deep links (awinmid per shop)
//     "wrap":    { "network": "skimlinks", "id": "123X456" } }                   one catch-all wrapper (or sovrn with "key")
// A shop named under domains or awin wins over the wrapper; a link takes one commission, never two, and a link that
// already carries a tag of its own (or already leads through a network) is left as it is: the sea takes nobody's tag.
import { immune } from './immune.mjs';

export const COMMISSION_RULE = 'Some links may earn the sea a commission from the shop; it never changes the order or the verdict.';

// the addresses that are never touched: the sea's own, payment pages, and what already leads through a network
const OWN = /(^|\.)(mareliberum\.dev|mare-liberum\.vercel\.app)$/;
const NEVER = /(^|\.)(stripe\.com|paypal\.com|klarna\.com|coinbase\.com|go\.skimresources\.com|skimresources\.com|redirect\.viglink\.com|viglink\.com|awin1\.com|amzn\.to|amzn\.eu|shareasale\.com|anrdoezrs\.net|dpbolvw\.net|jdoqocy\.com|kqzyfj\.com|tkqlhce\.com|linksynergy\.com|impact\.com|pxf\.io|sjv\.io|partnerize\.com|prf\.hn|rstyle\.me|shopstyle\.it|howl\.me|bit\.ly)$/;
// a value the operator gives: ids, tags and parameter names are short, plain and printable
const ID = /^[A-Za-z0-9._~-]{1,80}$/, PARAM = /^[A-Za-z0-9_-]{1,32}$/, HOST = /^(?=.{3,253}$)[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,24}$/;
const WRAPS = {
  skimlinks: { needs: 'id', make: (id, u) => `https://go.skimresources.com/?id=${encodeURIComponent(id)}&url=${encodeURIComponent(u)}` },
  sovrn: { needs: 'key', make: (key, u) => `https://redirect.viglink.com?key=${encodeURIComponent(key)}&u=${encodeURIComponent(u)}` },
};

// the operator's configuration, read once, made safe to act on; anything that does not hold is left out (and said so)
export function parseCommission(raw) {
  const out = { domains: new Map(), awin: null, wrap: null, skipped: [] };
  if (raw == null || String(raw).trim() === '') return out;
  let c; try { c = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { out.skipped.push('MARE_COMMISSION is no JSON'); return out; }
  if (!c || typeof c !== 'object' || Array.isArray(c)) { out.skipped.push('MARE_COMMISSION is no object'); return out; }
  for (const [d, params] of Object.entries(c.domains && typeof c.domains === 'object' ? c.domains : {}).slice(0, 200)) {
    const host = String(d).toLowerCase().replace(/^www\./, '');
    const ps = params && typeof params === 'object' && !Array.isArray(params) ? Object.entries(params).filter(([k, v]) => k !== 'network' && PARAM.test(k) && ID.test(String(v))) : [];
    if (!HOST.test(host) || !ps.length || OWN.test(host) || NEVER.test(host)) { out.skipped.push(`domains.${String(d).slice(0, 60)}`); continue; }
    out.domains.set(host, { params: ps.map(([k, v]) => [k, String(v)]), network: ID.test(String(params.network || '')) ? String(params.network) : host });
  }
  if (c.awin && typeof c.awin === 'object') {
    const affid = String(c.awin.affid ?? ''), merchants = new Map();
    for (const [d, mid] of Object.entries(c.awin.merchants && typeof c.awin.merchants === 'object' ? c.awin.merchants : {}).slice(0, 500)) {
      const host = String(d).toLowerCase().replace(/^www\./, '');
      if (HOST.test(host) && /^\d{1,12}$/.test(String(mid)) && !OWN.test(host) && !NEVER.test(host)) merchants.set(host, String(mid)); else out.skipped.push(`awin.merchants.${String(d).slice(0, 60)}`);
    }
    if (/^\d{1,12}$/.test(affid) && merchants.size) out.awin = { affid, merchants }; else out.skipped.push('awin (affid and at least one merchant are needed)');
  }
  if (c.wrap && typeof c.wrap === 'object') {
    const w = WRAPS[String(c.wrap.network || '').toLowerCase()], v = w ? String(c.wrap[w.needs] ?? '') : '';
    if (w && ID.test(v)) out.wrap = { network: String(c.wrap.network).toLowerCase(), value: v }; else out.skipped.push('wrap (skimlinks with id, or sovrn with key)');
  }
  return out;
}

let CFG = parseCommission(process.env.MARE_COMMISSION);
// for the proofs (and only for them): another configuration, as if the node had started with it
export function setCommission(raw) { CFG = parseCommission(raw); return commissionState(); }
export const configured = () => CFG.domains.size > 0 || !!CFG.awin || !!CFG.wrap;
// on: configured by the operator and not resting
export const commissionOn = () => configured() && !immune.atRest?.('commission');
// what the operator set, without a single id: which shops and networks, for the operator's own check
export function commissionState() {
  return { configured: configured(), resting: configured() && !!immune.atRest?.('commission'), domains: [...CFG.domains.keys()], awin: CFG.awin ? [...CFG.awin.merchants.keys()] : [], wrap: CFG.wrap?.network || null, skipped: CFG.skipped, rule: COMMISSION_RULE };
}

// the rule that names a host: the most specific configured name (shop.example matches www.shop.example and eu.shop.example)
const ruleOf = (map, host) => { for (let h = host; h.includes('.'); h = h.slice(h.indexOf('.') + 1)) if (map.has(h)) return map.get(h); return null; };

// → { url, commission: true, network } or null
export function commissionFor(url) {
  if (!commissionOn()) return null;
  const s = String(url ?? '');
  if (s.length > 2048 || !/^https?:\/\//i.test(s)) return null;
  let u; try { u = new URL(s); } catch { return null; }
  if (u.username || u.password || (u.port && u.port !== '80' && u.port !== '443')) return null;
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (!HOST.test(host) || OWN.test(host) || NEVER.test(host)) return null;
  const d = ruleOf(CFG.domains, host);
  if (d) {
    // a link that already carries one of these parameters keeps it: the sea takes nobody's tag
    if (d.params.some(([k]) => u.searchParams.has(k))) return null;
    for (const [k, v] of d.params) u.searchParams.append(k, v);
    return { url: u.href, commission: true, network: d.network };
  }
  const mid = CFG.awin ? ruleOf(CFG.awin.merchants, host) : null;
  if (mid) return { url: `https://www.awin1.com/cread.php?awinmid=${mid}&awinaffid=${CFG.awin.affid}&ued=${encodeURIComponent(u.href)}`, commission: true, network: 'awin' };
  if (CFG.wrap) return { url: WRAPS[CFG.wrap.network].make(CFG.wrap.value, u.href), commission: true, network: CFG.wrap.network };
  return null;
}

// a buying answer (decide, ask), as it leaves a door for an agent: the shop links of its offers (url, checkout) and the
// checkout of the pay step carry the commission where one applies, and say so (commission: true, commission_network);
// the answer gets the rule once. Everything else stays as it is: the order, the pick, the reasons, the scores, and the
// inputs of the read, verify and guard steps (a verifier reads the shop's own address). An offer that already pays the
// sea through its catalog (promoted, with its own commission rate) is left as it is. Off: the same object comes back.
const OFFER_KEYS = ['url', 'checkout'];
const isOffer = (o) => typeof o.checkout === 'string' || (typeof o.url === 'string' && (o.price != null || (o.title != null && o.store != null)));
export function withCommission(out) {
  if (!commissionOn() || !out || typeof out !== 'object') return out;
  let n = 0;
  const offer = (o) => {
    if (o.promoted || typeof o.commission === 'number') return o;
    let copy = null, net = null;
    for (const k of OFFER_KEYS) { if (typeof o[k] !== 'string') continue; const c = commissionFor(o[k]); if (!c) continue; copy ||= { ...o }; copy[k] = c.url; net ||= c.network; }
    if (!copy) return o;
    n++; copy.commission = true; copy.commission_network = net; return copy;
  };
  const walk = (v, depth) => {
    if (depth > 8 || v == null || typeof v !== 'object') return v;
    if (Array.isArray(v)) { let a = null; for (let i = 0; i < v.length; i++) { const y = walk(v[i], depth + 1); if (y !== v[i]) { a ||= v.slice(); a[i] = y; } } return a || v; }
    let o = isOffer(v) ? offer(v) : v;
    for (const k of Object.keys(o)) {
      const x = o[k]; if (!x || typeof x !== 'object') continue;
      // of the next steps only the pay step hands out a link; read, verify and guard keep the shop's own address
      const y = k === 'steps' && !Array.isArray(x) ? (x.pay && typeof x.pay === 'object' ? (() => { const p = offer(x.pay); return p === x.pay ? x : { ...x, pay: p }; })() : x) : k === 'notes' ? x : walk(x, depth + 1);
      if (y !== x) { if (o === v) o = { ...v }; o[k] = y; }
    }
    return o;
  };
  const r = walk(out, 0);
  return n && r && !Array.isArray(r) ? { ...r, commission_rule: COMMISSION_RULE } : r;
}

// for pages: the link a person clicks when a commission applies (through /via/, where the tag is added at redirect time,
// so crawlers never meet a commission link), with rel="sponsored" and the marker; null when none applies
export const COMMISSION_MARK = `<small class="cm" title="${COMMISSION_RULE}">commission link</small>`;
