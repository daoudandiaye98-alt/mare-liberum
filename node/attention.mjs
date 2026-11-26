// Mare Liberum · attention: what the AIs read of the open index, counted in the open (since 3.33.0)
// Every listing of the sea has pages: the map of a website (/site/<domain>) and the entries of the open index (/e/<id>).
// AI crawlers, search engines and assistants read them all day. Here every read of a listing is counted by the family of
// its reader — the census's own kinds and names (callerOf in node/core.mjs), nothing guessed again — per day. A provider
// sees on its listing how much AI attention it gets; /attention shows the whole sea's; the paid services of the house are
// offered beside it, through one counted door (/c/<service>), so what the attention leads to is counted as well.
// Counted in memory, strictly bounded, written by the tide in compact records:
//   att:t:<day>   the totals of the day: reads per family, of maps and of entries; exact        kept 32 days
//   att:s:<day>   the reads per listing of the day, the 10,000 most read (the rest stays in the totals)   kept 9 days
//   att:c:<day>   the clicks on the paid services: per service, page kind and kind of caller    kept 32 days
// A read counts at most 3 times per caller network (an IPv4 address or an IPv6 /64), listing and day; that rule lives in a
// fixed table in memory, as a hash, and is never written down. The sea's own calls never count. People and programs are
// not readers here; their clicks on the services are counted apart. A count is shown, never used: nothing here changes
// an order in the index, in the answers to agents or in the verified market.
import { immune } from './immune.mjs';
import { netKey } from './guard.mjs';
import { safeHost } from './check.mjs';
import { siteOf, leftOut } from './atlas.mjs';
import { registrable } from './areas.mjs';
import { payUrl } from './offers.mjs';
import { OFFER } from './seo.mjs';
import { countable } from './connect.mjs';

export const ATTENTION = { keepDays: 31, siteDays: 8, sites: 10_000, recordMax: 900_000, perCaller: 3, slots: 1 << 18, top: 25, siteLen: 64, cacheMs: 60_000, marketMs: 600_000 };
const DAY = 86400;

// [kind in the census, its name there, the name a provider knows it by, group]. APPEND ONLY: the place in this list is
// the code the records keep. '*' takes a name the census may learn later, so a new reader is still counted in its group.
export const FAMILIES = [
  ['ai-crawler', 'Anthropic ClaudeBot', 'ClaudeBot', 'ai'], ['ai-crawler', 'OpenAI GPTBot', 'GPTBot', 'ai'], ['ai-crawler', 'Meta', 'Meta', 'ai'],
  ['ai-crawler', 'ByteDance', 'Bytespider', 'ai'], ['ai-crawler', 'Amazon', 'Amazonbot', 'ai'], ['ai-crawler', 'Common Crawl', 'CCBot', 'ai'],
  ['ai-crawler', 'Google', 'GoogleOther', 'ai'], ['search-ai', 'OpenAI search', 'OAI-SearchBot', 'ai'], ['search-ai', 'Claude search', 'Claude-SearchBot', 'ai'],
  ['search-ai', 'Perplexity', 'PerplexityBot', 'ai'], ['search-ai', 'You.com', 'YouBot', 'ai'],
  ['search', 'Google', 'Googlebot', 'search'], ['search', 'Bing', 'Bingbot', 'search'], ['search', 'Apple', 'Applebot', 'search'], ['search', 'DuckDuckGo', 'DuckDuckBot', 'search'],
  ['search', 'Brave', 'Bravebot', 'search'], ['search', 'Yandex', 'YandexBot', 'search'], ['search', 'Baidu', 'Baiduspider', 'search'],
  ['assistant', 'ChatGPT', 'ChatGPT-User', 'assistant'], ['assistant', 'Claude', 'Claude-User', 'assistant'], ['assistant', 'Claude Code', 'Claude Code', 'assistant'],
  ['assistant', 'Perplexity', 'Perplexity-User', 'assistant'], ['assistant', 'Meta AI', 'Meta AI', 'assistant'], ['assistant', 'Mistral', 'MistralAI-User', 'assistant'],
  ['search-ai', 'DuckDuckGo Assist', 'DuckAssistBot', 'ai'], ['assistant', 'Google agent', 'Google agent', 'assistant'],
  ['ai-crawler', '*', 'other AI crawlers', 'ai'], ['search-ai', '*', 'other AI search', 'ai'], ['search', '*', 'other search engines', 'search'], ['assistant', '*', 'other assistants', 'assistant'],
];
export const GROUPS = { ai: 'AI crawlers', search: 'search engines', assistant: 'assistants reading for a person' };
const INDEX = new Map(FAMILIES.map(([kind, name], i) => [`${kind}|${name}`, i]));
// the family of a caller as the census sees it, or -1 (the sea itself, people, programs and other bots are no readers here)
export const familyOf = (who) => { const k = who?.kind; if (!k || k === 'self') return -1; return INDEX.get(`${k}|${who.name}`) ?? INDEX.get(`${k}|*`) ?? -1; };
export const labelOf = (i) => FAMILIES[i]?.[2] || 'unknown';
export const groupOf = (i) => FAMILIES[i]?.[3] || null;
const READONLY = new Set(['ai-crawler', 'crawler', 'search', 'search-ai']);

// ------------------------------------------------------------------ whose listing an entry is
// An entry of the open index is often listed by a directory (the MCP registry, 8004scan, the x402 bazaar, Apify …): the
// directory is not the provider. A read of an entry counts for the provider's own website when the entry names one — a
// store's own domain, or the web address of its endpoint — and never for a directory or a platform many providers share.
const DIRECTORIES = new Set(['modelcontextprotocol.io', '8004scan.io', 'coinbase.com', 'payai.network', 'apify.com', 'huggingface.co', 'agentverse.ai', 'npmjs.com', 'apis.guru', '402index.io', 'virtuals.io', 'smithery.ai', 'glama.ai', 'mcp.so', 'pulsemcp.com', 'github.com', 'githubusercontent.com', 'gitlab.com', 'hf.space', 'google.com', 'amazonaws.com', 'cloudfront.net', 'azurewebsites.net', 'workers.dev', 'deno.dev', 'fly.dev', 'railway.app', 'replit.app', 'ngrok.io', 'ngrok-free.app', 'trycloudflare.com', 'mareliberum.dev']);
export function providerHost(e) {
  const m = e?.metadata || {};
  let h = null;
  try {
    if (m.kind === 'merchant') h = String(m.publisher || '');
    else { const ep = (m.endpoints || []).find((x) => /^https:\/\//i.test(String(x?.url || ''))); h = new URL(ep?.url || e?.url).hostname; }
  } catch { return null; }
  const host = safeHost(h || ''); if (!host) return null;
  // a store counts under its own host (the address of its map); an API or a server under its domain (api.x.com → x.com); a
  // host on a shared platform (x.myshopify.com, x.github.io) under itself, unless the platform is one of the directories
  const site = siteOf(host), reg = registrable(site);
  if (reg ? DIRECTORIES.has(reg) : [...DIRECTORIES].some((d) => site === d || site.endsWith(`.${d}`))) return null;
  const out = m.kind === 'merchant' || !reg ? site : reg;
  return out.length <= ATTENTION.siteLen ? out : null;
}

// ------------------------------------------------------------------ the counted door to the paid services
// /c/<service>?from=<page kind>&ref=<listing> answers 302 to the service's own payment page or to a page of the sea. The
// target comes from this table alone, never from the request: the payment links of node/offers.mjs and node/seo.mjs and
// the sea's own pages. Whatever a table says is held to the same two shapes once more before anyone is sent there.
export const CTA = {
  owner: { name: 'Owner check', price: '19 €, once', to: (ref) => payUrl('verified', ref) },
  report: { name: 'AI-visibility report (full report with fixes)', price: '29 €, once', to: (ref) => payUrl('report', ref) },
  teams: { name: 'Team harbour for coding agents', price: '49 € a month, first month free', to: () => OFFER.teams },
  agency: { name: 'Team harbour for agencies', price: '79 € a month, first month free', to: () => OFFER.agency },
  law: { name: 'Kanzlei harbour', price: '750 € setup + 990 € a year per office', to: () => OFFER.law },
  reader: { name: 'Reader credit for operators', price: '10 €, once, for 10,000 pages (30 days)', to: () => OFFER.reader },
  // the reader ladder and the Reederei (since 3.60, node/checkout.mjs TILL and NODE)
  kutter: { name: 'Reader pack Kutter for operators', price: '49 €, once, for 100,000 pages (30 days)', to: () => OFFER.kutter },
  kutterjahr: { name: 'Reader pack Kutter for operators, one year', price: '490 €, once, for 1,200,000 pages (365 days)', to: () => OFFER.kutterjahr },
  fregatte: { name: 'Reader pack Fregatte for operators', price: '199 €, once, for 500,000 pages (30 days)', to: () => OFFER.fregatte },
  fregattejahr: { name: 'Reader pack Fregatte for operators, one year', price: '1,990 €, once, for 6,000,000 pages (365 days)', to: () => OFFER.fregattejahr },
  flotte: { name: 'Reader pack Flotte for operators', price: '390 €, once, for 1,000,000 pages (30 days)', to: () => OFFER.flotte },
  flottejahr: { name: 'Reader pack Flotte for operators, one year', price: '3,900 €, once, for 12,000,000 pages (365 days)', to: () => OFFER.flottejahr },
  reederei: { name: 'Reederei: your own reader node in the EU', price: '2,900 €, once, for 90 days', to: () => OFFER.reederei },
  reedereijahr: { name: 'Reederei: your own reader node in the EU, one year', price: '9,900 €, once, for 12 months', to: () => OFFER.reedereijahr },
  route: { name: 'Paid route', price: 'per call in USDC (x402)', to: () => '/pay/howto' },
  talk: { name: 'Institutions: talk to us', price: 'by agreement', to: () => '/about#contact' },
};
export const FROM = ['site', 'entry', 'check', 'attention', 'claim', 'pricing', 'offers', 'sample', 'business', 'business-de', 'teams', 'agency', 'law', 'reader', 'limit', 'other'];
const STRIPE = /^https:\/\/buy\.stripe\.com\/[A-Za-z0-9_]{6,64}(\?client_reference_id=[A-Za-z0-9_-]{1,220})?$/;
const OWN = /^\/(?![/\\])[A-Za-z0-9/._-]{0,80}(#[A-Za-z0-9_-]{1,40})?$/;
export const safeTarget = (u) => typeof u === 'string' && (STRIPE.test(u) || OWN.test(u));
export function ctaTarget(id, ref) {
  const c = Object.hasOwn(CTA, id) ? CTA[id] : null; if (!c) return null;
  let to = null; try { to = c.to(ref); } catch { to = null; }
  return safeTarget(to) ? to : null;
}
export const fromOf = (x) => (FROM.includes(String(x || '')) ? String(x) : 'other');

// ------------------------------------------------------------------ the counter
const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0 || 1; };
const add = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };
const dayOf = (t) => new Date(t).toISOString().slice(0, 10);
const back = (day, i) => dayOf(Date.parse(day) - i * DAY * 1000);
// one day's reads per listing as one line each: "<domain>|<code>=<n>,e<code>=<n>" (e: reads of its entries); below 900 kB a day
export const encodeSites = (m) => [...m].map(([d, row]) => `${d}|${Object.entries(row).map(([k, n]) => `${k}=${n}`).join(',')}`).join('\n');
export function decodeSites(s) {
  const m = new Map(); if (typeof s !== 'string') return m;
  for (const line of s.split('\n')) {
    const i = line.indexOf('|'); if (i < 1) continue;
    const row = {}; for (const kv of line.slice(i + 1).split(',')) { const [k, n] = kv.split('='); if (/^e?\d{1,2}$/.test(k) && Number(n) > 0) row[k] = Number(n); }
    if (Object.keys(row).length) m.set(line.slice(0, i), row);
  }
  return m;
}
// a small memory for a node without one (the proofs): get and set with a time to live
const memKv = () => { const m = new Map(); return { async get(k) { const x = m.get(k); return x && (!x.e || x.e > Date.now()) ? structuredClone(x.v) : null; }, async set(k, v, ttl) { m.set(k, { v: structuredClone(v), e: ttl ? Date.now() + ttl * 1000 : 0 }); } }; };

export function createAttention({ kv = memKv(), now = Date.now, log = () => {}, caps = {} } = {}) {
  const C = { ...ATTENTION, ...caps };
  const days = new Map(), clicks = new Map();
  let since = null, cache = null, market = { at: 0, set: new Set() };
  // the rule "at most 3 per caller, listing and day": a fixed table, as big as it will ever be (1.25 MB at 2^18 slots)
  const keys = new Uint32Array(C.slots), hits = new Uint8Array(C.slots); let slotDay = '';
  const under = (k) => {
    const mask = C.slots - 1; let i = k & mask;
    for (let p = 0; p < 8; p++, i = (i + 1) & mask) {
      if (keys[i] === k) { if (hits[i] >= C.perCaller) return false; hits[i]++; return true; }
      if (keys[i] === 0) { keys[i] = k; hits[i] = 1; return true; }
    }
    i = k & mask; keys[i] = k; hits[i] = 1; return true; // a full neighbourhood: the newest caller takes the first place
  };
  const rest = () => immune.atRest?.('attention');
  const blank = () => ({ s: {}, e: {}, rest: {}, sites: new Map(), dropped: 0, capped: 0, dirtyT: false, dirtyS: false });
  // the day a read falls on; a new day lets the oldest go: totals after 31 days, the reads per listing after 8
  function dayRec(day) {
    let D = days.get(day); if (D) return D;
    D = blank(); days.set(day, D);
    const all = [...days.keys()].sort().reverse(), newest = all[0];
    for (const d of all) { if (d < back(newest, C.keepDays - 1)) days.delete(d); else if (d < back(newest, C.siteDays - 1)) days.get(d).sites = null; }
    for (const d of [...clicks.keys()]) if (d < back(newest, C.keepDays - 1)) clicks.delete(d);
    if (day === newest && slotDay !== day) { keys.fill(0); hits.fill(0); slotDay = day; }
    return D;
  }
  // a full day makes room: the quarter of the listings read least goes, oldest first among equals; their reads stay in the totals
  function evict(D) {
    const order = [...D.sites].map(([d, row]) => [d, Object.values(row).reduce((a, b) => a + b, 0)]).sort((a, b) => a[1] - b[1]);
    for (const [d] of order.slice(0, Math.ceil(C.sites / 4))) { for (const [k, n] of Object.entries(D.sites.get(d))) add(D.rest, k, n); D.sites.delete(d); D.dropped++; }
  }
  function count(kind, listing, fi, net, what = '') {
    if (fi < 0) return false;
    const day = dayOf(now()), D = dayRec(day);
    if (!since) since = day;
    if (!under(fnv(`${day}|${net}|${kind}|${listing || what}`))) { D.capped++; D.dirtyT = true; return false; }
    add(kind === 'e' ? D.e : D.s, fi); D.dirtyT = true;
    if (listing && D.sites) {
      let row = D.sites.get(listing);
      if (!row) { if (D.sites.size >= C.sites) evict(D); row = {}; D.sites.set(listing, row); }
      add(row, kind === 'e' ? `e${fi}` : `${fi}`); D.dirtyS = true;
    }
    return true;
  }

  // what the tide wrote before this node started is read once and added to what this node counted since; a read that
  // failed is tried again, and until it worked the tide writes nothing over the old records
  let loading = null, loaded = false;
  const ready = () => (loading ||= (async () => {
    const today = dayOf(now()), ds = Array.from({ length: C.keepDays }, (_, i) => back(today, i));
    const [s0, ...vals] = await Promise.all([kv.get('att:since'), ...ds.map((d) => kv.get(`att:t:${d}`)), ...ds.slice(0, C.siteDays).map((d) => kv.get(`att:s:${d}`)), ...ds.map((d) => kv.get(`att:c:${d}`))]);
    if (typeof s0 === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s0)) since = !since || s0 < since ? s0 : since;
    ds.forEach((d, i) => {
      const t = vals[i], s = i < C.siteDays ? vals[C.keepDays + i] : null, c = vals[C.keepDays + C.siteDays + i];
      if (t && typeof t === 'object') {
        const D = dayRec(d);
        for (const part of ['s', 'e', 'rest']) for (const [k, n] of Object.entries(t[part] || {})) if (Number(n) > 0) add(D[part], k, Number(n));
        D.dropped += Number(t.dropped) || 0; D.capped += Number(t.capped) || 0;
        if (D.sites && s) for (const [dom, row] of decodeSites(s)) { let r = D.sites.get(dom); if (!r) { if (D.sites.size >= C.sites) evict(D); r = {}; D.sites.set(dom, r); } for (const [k, n] of Object.entries(row)) add(r, k, n); }
      }
      if (c && typeof c === 'object') { const X = clicks.get(d) || { n: {}, dirty: false }; for (const [k, n] of Object.entries(c)) if (Number(n) > 0) add(X.n, k, Number(n)); clicks.set(d, X); }
    });
    loaded = true; cache = null;
  })().catch((e) => { loading = null; log('mare_attention', e?.message); }));

  const view = (o) => {
    const by = {}, g = { ai: 0, search: 0, assistant: 0 };
    for (const [k, n] of Object.entries(o)) { const i = Number(k), grp = groupOf(i); if (!grp || !(n > 0)) continue; g[grp] += n; by[labelOf(i)] = (by[labelOf(i)] || 0) + n; }
    return { ...g, by: Object.fromEntries(Object.entries(by).sort((a, b) => b[1] - a[1])) };
  };
  const sum = (list) => { const o = {}; for (const x of list) for (const [k, n] of Object.entries(x || {})) add(o, k, n); return o; };
  // a shop is named by its own host on the market and counted under the same host here (providerHost), so the host decides
  async function failing() {
    if (now() - market.at < C.marketMs) return market.set;
    const idx = await kv.get('market:idx').catch(() => null), set = new Set();
    for (const [h, v] of Object.entries(idx && typeof idx === 'object' ? idx : {})) if (Array.isArray(v) && Number(v[0]) < 2) set.add(siteOf(h));
    market = { at: now(), set }; return set;
  }
  // names of domains that point to adult or gambling content stay out of the public list (their reads still count): the one
  // rule the Atlas keeps them out of sitemaps, IndexNow and search with (node/atlas.mjs leftOut)

  const att = {
    // for every request: a function that counts the answer once it is known, or null (no listing, or no reader)
    hook(path, who, ip) {
      if (!path.startsWith('/site/') && !path.startsWith('/e/')) return null;
      const fi = familyOf(who); if (fi < 0 || rest()) return null;
      const net = netKey(ip);
      if (path.startsWith('/e/')) return (status, listing) => { if (status === 200) count('e', listing || null, fi, net, path.slice(0, 200)); };
      const m = /^\/site\/([^/]{3,160}?)(\.json|\.md)?$/.exec(path); if (!m) return null;
      let d; try { d = decodeURIComponent(m[1]); } catch { return null; }
      const host = safeHost(d); if (!host) return null;
      const site = siteOf(host);
      return (status) => { if (status === 200) count('s', site.length <= C.siteLen ? site : null, fi, net, path); };
    },
    count, ready,
    // a click on a paid service through the counted door: a person in a browser who navigates (the same rule as the buttons
    // of /connect, node/connect.mjs countable): no prefetch, no driven or headless browser, no picture or script that loads
    // the address from another page, no program; per service and page kind, at most 3 per network a day
    click(offer, from, who, ip, marks = {}) {
      if (!who?.kind || who.kind === 'self' || READONLY.has(who.kind) || rest() || !Object.hasOwn(CTA, offer)) return false;
      if (!countable({ ...marks, kind: who.kind }, 'go')) return false;
      const day = dayOf(now()); dayRec(day);
      if (!since) since = day;
      if (!under(fnv(`${day}|${netKey(ip)}|c|${offer}`))) return false;
      const X = clicks.get(day) || { n: {}, dirty: false }; clicks.set(day, X);
      add(X.n, `${offer}|${fromOf(from)}|${who.kind === 'browser' ? 'person' : who.kind === 'assistant' ? 'assistant' : 'program'}`); X.dirty = true;
      return true;
    },
    // the tide writes what changed; one day's reads per listing are at most 10,000 short lines
    async flush() {
      if (rest()) return { rest: true };
      await ready(); if (!loaded) return { wrote: 0, waiting: 'the records of earlier tides could not be read yet; nothing is written over them' };
      let wrote = 0, largest = 0;
      for (const [day, D] of days) {
        if (D.dirtyT) { D.dirtyT = false; await kv.set(`att:t:${day}`, { s: D.s, e: D.e, rest: D.rest, dropped: D.dropped, capped: D.capped }, 32 * DAY); wrote++; }
        if (D.dirtyS && D.sites) {
          // a record stays below a megabyte, however long the names and however many families read a listing: the least read make room
          let v = encodeSites(D.sites); while (v.length > C.recordMax && D.sites.size) { evict(D); v = encodeSites(D.sites); }
          D.dirtyS = false; await kv.set(`att:s:${day}`, v, 9 * DAY); wrote++; largest = Math.max(largest, v.length);
        }
      }
      for (const [day, X] of clicks) if (X.dirty) { X.dirty = false; await kv.set(`att:c:${day}`, X.n, 32 * DAY); wrote++; }
      if (since) await kv.set('att:since', since, 4000 * DAY);
      return { wrote, largest };
    },
    // one listing over the last 7 days: reads of its map page and of its entries, by group and by family
    async site(domain) {
      await ready();
      const d = siteOf(safeHost(String(domain || '')) || ''), today = dayOf(now()), ds = Array.from({ length: 7 }, (_, i) => back(today, i));
      const rows = ds.map((x) => days.get(x)?.sites?.get(d)).filter(Boolean), page = {}, entries = {};
      for (const row of rows) for (const [k, n] of Object.entries(row)) add(k[0] === 'e' ? entries : page, k[0] === 'e' ? k.slice(1) : k, n);
      return { site: d, days: 7, from: ds[6], to: today, since, page: view(page), entries: view(entries) };
    },
    // the whole sea: days, the week, the week before, the listings read most, and the clicks on the services
    async overview() {
      await ready();
      if (cache && now() - cache.at < C.cacheMs) return cache.v;
      const today = dayOf(now()), first = since || today, ds = Array.from({ length: 30 }, (_, i) => back(today, i)).filter((d) => d >= first);
      const dayView = (d) => { const D = days.get(d); const s = view(D?.s || {}), e = view(D?.e || {}), all = view(sum([D?.s, D?.e])); return { day: d, ai: all.ai, search: all.search, assistant: all.assistant, maps: s.ai + s.search + s.assistant, entries: e.ai + e.search + e.assistant, by: all.by, notCounted: D?.capped || 0 }; };
      const week = (from) => { const list = Array.from({ length: 7 }, (_, i) => back(today, from + i)).filter((d) => d >= first); const v = view(sum(list.flatMap((d) => [days.get(d)?.s, days.get(d)?.e]))); return { from: list.at(-1) || null, to: list[0] || null, days: list.length, ...v }; };
      // the listings read most this week, by reads of AI crawlers; shops that did not pass the market's checks are never named
      const bad = await failing(), tally = new Map();
      for (const d of Array.from({ length: 7 }, (_, i) => back(today, i))) for (const [dom, row] of days.get(d)?.sites || []) { const t = tally.get(dom) || {}; for (const [k, n] of Object.entries(row)) add(t, k, n); tally.set(dom, t); }
      const top = [...tally].map(([site, row]) => { const page = {}, entries = {}; for (const [k, n] of Object.entries(row)) add(k[0] === 'e' ? entries : page, k[0] === 'e' ? k.slice(1) : k, n); const all = view(sum([page, entries])), pg = view(page); return { site, ai: all.ai, search: all.search, assistant: all.assistant, maps: pg.ai, entries: view(entries).ai, by: all.by, mapped: pg.ai + pg.search + pg.assistant > 0 }; })
        .filter((x) => x.ai > 0 && !bad.has(x.site) && !leftOut(x.site))
        .sort((a, b) => b.ai - a.ai || (b.search + b.assistant) - (a.search + a.assistant) || a.site.localeCompare(b.site)).slice(0, C.top);
      const cs = {}, cdays = [];
      for (const d of ds) { const X = clicks.get(d)?.n || {}; let n = 0; for (const [k, v] of Object.entries(X)) { const [offer, from, who] = k.split('|'); const o = cs[offer] || (cs[offer] = { total: 0, from: {}, who: {} }); o.total += v; add(o.from, from, v); add(o.who, who, v); n += v; } cdays.push({ day: d, clicks: n }); }
      const v = { since: first, today, days: ds.map(dayView), week: week(0), weekBefore: week(7), top,
        clicks: { last30days: Object.fromEntries(Object.entries(cs).sort((a, b) => b[1].total - a[1].total)), days: cdays, total: cdays.reduce((a, b) => a + b.clicks, 0) },
        notCounted: ds.slice(0, 7).reduce((a, d) => a + (days.get(d)?.capped || 0), 0), leftOutOfListings: ds.slice(0, 7).reduce((a, d) => a + (days.get(d)?.dropped || 0), 0) };
      cache = { at: now(), v }; return v;
    },
    // how big the memory is: the proofs hold it to its bounds
    size() { return { days: days.size, siteTables: [...days.values()].filter((D) => D.sites).length, largestDay: Math.max(0, ...[...days.values()].map((D) => D.sites?.size || 0)), slots: keys.length, clickDays: clicks.size }; },
  };
  ready();
  return att;
}
// one counter per sea (per db), on the node's own memory
export const attentionOf = (db, cfg = {}) => (db.attention ||= createAttention({ ...(cfg.kv || db.kv ? { kv: cfg.kv || db.kv } : {}), log: (t, m) => console.error(t, m) }));
