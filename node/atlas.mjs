// Mare Liberum · the Atlas — the web as an agent needs it.
// The web was built for people: menus, buttons, search boxes that run in JavaScript. The Atlas writes down, for each
// website, what an agent needs to act there without guessing: may it read the site (robots.txt per agent), how to search
// it with one plain link (the site's own OpenSearch file or its search form), its feeds and sitemaps, its main sections,
// its developer pages, llms.txt and agent card, and whether the text is there without JavaScript.
// Read only from what each site publishes — robots.txt, the home page and the files it names — a handful of small
// requests per site, once a week, and nothing where robots.txt says no to MareLiberum-Atlas.
// The same code maps a million sites from GitHub Actions (tools/atlas.mjs) and one site on demand in the sea.
import { AGENTS, safeHost, publicDns, grab, robotsGroups, robotsAllows, readPage } from './check.mjs';
import { entities } from './reader.mjs';
import { aside } from './aside.mjs';

export const ATLAS_UA = 'MareLiberum-Atlas/1.0 (+https://mareliberum.dev/atlas; maps how agents can use a website, once a week, follows robots.txt)';
export const ATLAS_TOKENS = ['mareliberum-atlas', 'mareliberum'];
export const ATLAS_SHARDS = 4096, ATLAS_IDX = 1024, ATLAS_LIST = 40000;

const attr = (tag, name) => { const m = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag); return m ? entities(m[2] ?? m[3] ?? m[4] ?? '').trim() : null; };
const text = (html) => entities(String(html || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const abs = (href, base) => { try { const u = new URL(href, base); return /^https?:$/.test(u.protocol) ? u : null; } catch { return null; } };
// the site a URL belongs to: the host without www, so www.ebay.com and ebay.com are one site
export const siteOf = (h) => String(h || '').toLowerCase().replace(/^www\d?\./, '');
// sites the Atlas keeps out of everything a search engine reads (its sitemaps, IndexNow, the lists on its pages; their own
// pages say noindex): adult and gambling sites, by the words in their names. The build picks the country lists with the
// same rule (tools/build.mjs), there together with public block lists. An agent that asks for such a site still gets its map.
export const ADULT = /porn|xxx|xvideo|xnxx|xhamster|(?<!es|sus|middle)sex|hentai|hentas|nude|nudi|nsfw|onlyfans|fansly|chaturbate|stripchat|bongacams|bonga-cams|cam4|camsoda|livejasmin|spankbang|youporn|redtube|tube8|eporner|brazzers|fapello|xfap|fapster|faphouse|milf|escort|acompanhantes|erotic|erotik|(^|[.-])ero|darkero|zettai-ero|maturetube|rule34|booru|hanime|camgirl|camwhore|camrip|cameraprive|fetish|bdsm|naked|swinger|jizz|hookup|horny|beeg|tnaflix|motherless|thumbzilla|youjizz|txxx|hclips|vporn|porntrex|missav|javhd|jable|supjav|^jav|jav\.|javdock|javmix|javsek|javsub|javtiful|njavtv|91porn|avgle|lesbian|bokep|desi(?!re|gn)|leak|(?<!you|ru)tube|pinay|kantot|sulasok|(?<!news|\d)18(?!\d)|(?<!\d)69(?!\d)|nudo|hotx|madura|eroge|casino|toto|huren|hoki|petir|naga-|ledak|sorte|bingo|hotxv|hotebony|hotindian|hotpic|noodlemagazine|(^|\.)fans\.|\.fans$|myfans|fatalfans|vide[yiq]|vidkle|vidsey|vidayo|vidayu|ratuvid|saluranvid|dayonvid|indovid|babe|choti|beurette|bfvideo|mms(\.|$)|dropmms|spicymms|momvid|thisvid|thot|videocelebs|xgay|videosx|tamilprint|\.cam$|\.webcam$|(?<!maxx|cinem|brix|ne|scine)xx(?!l)|slot|togel|gacor|toto\d|188|69plus|cair\d/;
export const leftOut = (host) => ADULT.test(siteOf(host));
const sameSite = (u, host) => { const a = siteOf(u.hostname), b = siteOf(host); return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`); };

// fnv-1a: the same small number in the crawler and in the sea, no crypto needed
export function fnv(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
export const shardOf = (domain) => (fnv(siteOf(domain)) % ATLAS_SHARDS).toString(16).padStart(3, '0');
export const idxOf = (tok) => (fnv(`t|${tok}`) % ATLAS_IDX).toString(16).padStart(3, '0');

// ---------------------------------------------------------------- reading the home page
const Q_NAMES = new Set(['q', 'query', 'search', 's', 'k', 'kw', 'keyword', 'keywords', 'term', 'terms', 'text', 'searchterm', 'search_query', 'searchtext', 'search-term', 'field-keywords', '_nkw', 'w', 'wd', 'p', 'qs', 'find', 'sq', 'st', 'searchstring', 'suchbegriff', 'query_string']);
const SEARCHY = /search|suche|such|recherche|buscar|busca|cerca|ricerca|zoek|sok|sök|szuk|hledat|keres|arama|poisk|find|query|検索|搜索|검색/i;

// the search box of a page, as one GET link with {q} where the words go
export function searchForm(html, pageUrl, host) {
  let best = null;
  for (const m of String(html).matchAll(/<form\b([^>]*)>([\s\S]{0,6000}?)<\/form>/gi)) {
    const tag = `<form ${m[1]}>`, body = m[2];
    if (String(attr(tag, 'method') || 'get').toLowerCase() !== 'get') continue;
    const action = abs(attr(tag, 'action') || pageUrl, pageUrl); if (!action || !sameSite(action, host)) continue;
    let qName = null, qScore = 0; const hidden = [];
    for (const im of body.matchAll(/<input\b[^>]*>/gi)) {
      const it = im[0], name = attr(it, 'name'), type = String(attr(it, 'type') || 'text').toLowerCase(); if (!name) continue;
      if (type === 'hidden') { const v = attr(it, 'value'); if (v != null && v.length < 60 && hidden.length < 4) hidden.push([name, v]); continue; }
      if (type !== 'text' && type !== 'search') continue;
      const s = (type === 'search' ? 3 : 0) + (Q_NAMES.has(name.toLowerCase()) ? 2 : 0) + (SEARCHY.test(`${name} ${attr(it, 'placeholder') || ''} ${attr(it, 'aria-label') || ''}`) ? 2 : 0);
      if (s > qScore) { qScore = s; qName = name; }
    }
    if (!qName) continue;
    const score = qScore + (/role\s*=\s*["']?search/i.test(tag) ? 3 : 0) + (SEARCHY.test(`${action.pathname} ${attr(tag, 'id') || ''} ${attr(tag, 'class') || ''} ${attr(tag, 'name') || ''}`) ? 2 : 0);
    if (score < 3 || (best && best.score >= score)) continue;
    const u = new URL(action.origin + action.pathname); for (const [k, v] of hidden) if (k !== qName) u.searchParams.set(k, v); u.searchParams.set(qName, '__Q__');
    best = { score, url: u.href.replace('__Q__', '{q}') };
  }
  return best?.url || null;
}
// an OpenSearch description: the site's own statement of how to search it
export function openSearchTemplate(xml, host) {
  for (const m of String(xml || '').matchAll(/<Url\b[^>]*>/gi)) {
    const type = String(attr(m[0], 'type') || '').toLowerCase(), tpl = attr(m[0], 'template');
    if (!tpl || !/text\/html|application\/xhtml/.test(type) || !tpl.includes('{searchTerms}')) continue;
    const u = abs(tpl.replace('{searchTerms}', '__Q__').replace(/\{[^}]*\}/g, ''), `https://${host}/`); if (!u || !sameSite(u, host)) continue;
    for (const [k, v] of [...u.searchParams]) if (v === '' && k) u.searchParams.delete(k);
    return u.href.replace('__Q__', '{q}');
  }
  return null;
}
export function homeExtras(html, pageUrl, host) {
  const h = String(html || '');
  const links = [...h.matchAll(/<link\b[^>]*>/gi)].map((x) => x[0]);
  const linkOf = (rel, typeRe) => links.filter((l) => new RegExp(`(^|\\s)${rel}(\\s|$)`, 'i').test(attr(l, 'rel') || '') && (!typeRe || typeRe.test(attr(l, 'type') || ''))).map((l) => abs(attr(l, 'href'), pageUrl)).filter(Boolean);
  const feeds = [...new Set(linkOf('alternate', /rss|atom|feed\+json/i).map((u) => u.href))].slice(0, 3);
  const opensearch = linkOf('search', /opensearchdescription/i)[0]?.href || null;
  const canonical = linkOf('canonical')[0]?.href || null;
  // the main sections: links inside the page's nav and header, short names, same site
  const blocks = [...h.matchAll(/<(nav|header)\b[\s\S]{0,40000}?<\/\1>/gi)].map((x) => x[0]).slice(0, 4);
  const pick = (src, n) => { const out = [], seen = new Set();
    for (const a of src.matchAll(/<a\b([^>]*)>([\s\S]{0,400}?)<\/a>/gi)) {
      const href = attr(`<a ${a[1]}>`, 'href'); if (!href || /^(#|javascript:|mailto:|tel:)/i.test(href)) continue;
      const u = abs(href, pageUrl); if (!u || !sameSite(u, host)) continue;
      const name = (text(a[2]) || attr(`<a ${a[1]}>`, 'aria-label') || attr(`<a ${a[1]}>`, 'title') || '').slice(0, 48); if (name.length < 2 || name.length > 40) continue;
      const key = u.pathname.replace(/\/+$/, '') + u.search; if (seen.has(key) || (u.pathname === '/' && !u.search)) continue; seen.add(key);
      out.push([name, u.hostname === new URL(pageUrl).hostname ? key || '/' : u.href]); if (out.length >= n) break;
    } return out; };
  let nav = pick(blocks.join(' '), 14); if (nav.length < 4) nav = pick(h, 12);
  // developer pages: where an agent finds the API of the site
  let dev = null;
  for (const a of h.matchAll(/<a\b([^>]*)>([\s\S]{0,200}?)<\/a>/gi)) {
    const t = text(a[2]).toLowerCase(), href = attr(`<a ${a[1]}>`, 'href'), u = href && abs(href, pageUrl); if (!u || !sameSite(u, host)) continue;
    if (/^(api|apis|api docs|api reference|developers?|developer portal|developer docs|for developers|entwickler|développeurs|desarrolladores)$/.test(t) || /^(developers?|api|dev)\./.test(u.hostname) || /^\/(developers?|api-docs|docs\/api)(\/|$)/.test(u.pathname)) { dev = u.href; break; }
  }
  // forms an agent can use: what each is for, where it posts (no field values are kept)
  const forms = [];
  for (const f of h.matchAll(/<form\b([^>]*)>([\s\S]{0,20000}?)<\/form>/gi)) {
    const head = `<form ${f[1]}>`, inner = f[2], names = [...inner.matchAll(/<(?:input|textarea|select)\b[^>]*>/gi)].map((x) => `${attr(x[0], 'type') || ''} ${attr(x[0], 'name') || ''} ${attr(x[0], 'id') || ''}`.toLowerCase());
    const has = (re) => names.some((n) => re.test(n)), act = attr(head, 'action'), u = act ? abs(act, pageUrl) : null;
    const k = has(/password/) ? 'login' : /<textarea/i.test(inner) || has(/message|nachricht|comment/) ? 'contact' : has(/\bdate\b|checkin|check-in|arrival|anreise|datum|guests|personen/) ? 'booking' : has(/email|e-mail|newsletter/) && names.length <= 4 ? 'newsletter' : has(/\b(q|query|search|s|keyword|suche)\b/) ? 'search' : null;
    if (!k) continue;
    const kind = k === 'newsletter' && /signup|sign-up|register|join|registrier/i.test(act || '') ? 'signup' : k;
    if (forms.some((x) => x[0] === kind && x[1] === (u ? (sameSite(u, host) && u.hostname === new URL(pageUrl).hostname ? u.pathname + u.search : u.href) : ''))) continue;
    forms.push([kind, u && sameSite(u, host) ? (u.hostname === new URL(pageUrl).hostname ? u.pathname + u.search : u.href) : u ? u.href : '', (attr(head, 'method') || 'get').toLowerCase().slice(0, 4)]);
    if (forms.length >= 6) break;
  }
  // structured data a local or paid task needs: opening hours, price range, whether content is free
  let local = null, paywall = false;
  for (const m of h.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]{0,60000}?)<\/script>/gi)) {
    let j; try { j = JSON.parse(m[1].trim()); } catch { continue; }
    const walk = (o, d = 0) => { if (!o || typeof o !== 'object' || d > 5) return; if (Array.isArray(o)) { o.forEach((x) => walk(x, d + 1)); return; }
      if (o.isAccessibleForFree === false || o.isAccessibleForFree === 'False' || o.isAccessibleForFree === 'false') paywall = true;
      const oh = o.openingHours || (Array.isArray(o.openingHoursSpecification) ? o.openingHoursSpecification.map((x) => `${[].concat(x.dayOfWeek || []).map((dd) => String(dd).split('/').pop().slice(0, 2)).join(',')} ${x.opens || ''}-${x.closes || ''}`) : null);
      if ((oh || o.priceRange) && !local) local = { t: String([].concat(o['@type'] || '')[0]).slice(0, 40) || undefined, oh: oh ? [].concat(oh).map(String).slice(0, 7) : undefined, pr: o.priceRange ? String(o.priceRange).slice(0, 20) : undefined };
      for (const v of Object.values(o)) if (v && typeof v === 'object') walk(v, d + 1); };
    walk(j);
  }
  // machine doors: OpenAPI, Swagger, GraphQL pages the home page links to
  const api = [];
  for (const a of h.matchAll(/<a\b([^>]*)>/gi)) { const href = attr(`<a ${a[1]}>`, 'href'); if (!href || !/openapi|swagger|graphql|api-docs|apidocs|\/api\/?$|redoc/i.test(href)) continue; const u = abs(href, pageUrl); if (u && !api.includes(u.href)) api.push(u.href); if (api.length >= 4) break; }
  const auth = forms.some((f) => f[0] === 'login') || /<a\b[^>]*>\s*(sign in|log ?in|anmelden|einloggen|mein konto|my account|connexion|iniciar sesión)\s*<\/a>/i.test(h);
  if (!paywall && /(subscribe to (continue|read)|abonnieren sie|jetzt abonnieren, um|paywall|nur für abonnenten|for subscribers only)/i.test(h)) paywall = true;
  return { feeds, opensearch, canonical, nav, dev, search: searchForm(h, pageUrl, host), forms, local, api, auth, paywall };
}

// ---------------------------------------------------------------- one site
// robots.txt first: where it says no to the Atlas, only robots.txt itself is read
// what the map takes from a home page, in one go (run beside whoever maps, see aside.mjs)
export function digestHome(html, pageUrl, host) { return { pg: readPage(html), ex: homeExtras(html, pageUrl, host) }; }
export async function profileSite(input, { rank, fetch: get = grab, dns = publicDns, ms = 7000, homeMax = 600_000 } = {}) {
  const host = safeHost(input); if (!host) return null;
  const d = siteOf(host), at = new Date().toISOString().slice(0, 10), p = { d, at };
  if (rank) p.rk = rank;
  if (!(await dns(host))) return { ...p, s: 0, x: 'no public address' };
  const opt = (max) => ({ max, ms, ua: ATLAS_UA });
  let robots = await get(`https://${host}/robots.txt`, opt(300_000));
  if (!robots.status) { await new Promise((r) => setTimeout(r, 1500)); robots = await get(`https://${host}/robots.txt`, opt(300_000)); }
  // no reply at all is not a wall: the site (or the way to it) was silent; it is read again next time
  if (!robots.status && !robots.blocked) return { ...p, s: 0, x: 'no reply' };
  const robotsOk = robots.status === 200 && !/<html/i.test(robots.body || '') && !/text\/html/i.test(robots.type || '');
  const robotsNone = robots.status === 404 || robots.status === 410, wall = !robotsOk && !robotsNone;
  const groups = robotsOk ? robotsGroups(robots.body) : [];
  const usFor = (path) => { if (!robotsOk) return !wall; for (const t of ATLAS_TOKENS) if (groups.some((g) => g.agents.includes(t))) return robotsAllows(groups, t, path).allowed; return robotsAllows(groups, 'mareliberum-atlas', path).allowed; };
  p.rb = robotsOk ? 'ok' : robotsNone ? 'none' : 'wall';
  if (!wall) { const bl = AGENTS.filter((a) => !robotsAllows(groups, a.name).allowed).map((a) => a.name); if (bl.length) p.bl = bl; }
  if (robotsOk) { const sm = [...robots.body.matchAll(/^\s*sitemap\s*:\s*(\S+)/gim)].map((x) => x[1]).filter((u) => /^https?:\/\//i.test(u)).slice(0, 3); if (sm.length) p.sm = sm; }
  if (wall) { p.s = robots.status || 0; return finish(p); }
  if (!usFor('/')) { p.us = 0; return p; }
  const [home, llms, card] = await Promise.all([
    get(`https://${host}/`, opt(homeMax)),
    usFor('/llms.txt') ? get(`https://${host}/llms.txt`, opt(40_000)) : null,
    usFor('/.well-known/agent-card.json') ? get(`https://${host}/.well-known/agent-card.json`, opt(40_000)) : null,
  ]);
  p.s = home.status || 0;
  if (home.url) { try { const u = new URL(home.url); const f = u.hostname + (u.pathname === '/' ? '' : u.pathname); if (f !== d) p.f = f; if (u.protocol !== 'https:') p.nh = 1; } catch {} }
  if (llms && llms.status === 200 && !/<html/i.test(llms.body || '') && (llms.body || '').trim().length > 20) p.ll = 1;
  if (card && card.status === 200) { try { const j = JSON.parse(card.body); if (j && (j.name || j.skills)) p.ac = { n: String(j.name || '').slice(0, 80), k: Array.isArray(j.skills) ? j.skills.length : 0 }; } catch {} }
  const read = home.status === 200 && /html/i.test(home.type || '') && home.body ? await aside(import.meta.url, 'digestHome', [home.body, home.url || `https://${host}/`, host], { wait: 120_000 }).catch(() => null) : null;
  if (read) {
    const { pg, ex } = read;
    if (pg.title) p.t = entities(pg.title).slice(0, 160); if (pg.description) p.ds = entities(pg.description).slice(0, 300); if (pg.lang) p.lg = String(pg.lang).slice(0, 12);
    p.w = pg.words; if (pg.shell || pg.words < 40) p.sh = 1; if (pg.jsonld.length) p.ld = pg.jsonld.slice(0, 8); if (pg.noindex || /noindex/i.test(home.robotsTag || '')) p.ni = 1;
    if (ex.feeds.length) p.fd = ex.feeds; if (ex.nav.length) p.nv = ex.nav; if (ex.dev) p.dv = ex.dev;
    if (ex.forms?.length) p.fm = ex.forms; if (ex.local) p.lc = ex.local; if (ex.api?.length) p.ap = ex.api; if (ex.auth) p.au = 1; if (ex.paywall) p.pw = 1;
    if (ex.opensearch) { const os = new URL(ex.opensearch); if (sameSite(os, host) && usFor(os.pathname)) { const x = await get(os.href, opt(40_000)); const t = x.status === 200 ? openSearchTemplate(x.body, host) : null; if (t) { p.q = t; p.qf = 'opensearch'; } } }
    if (!p.q && ex.search) { p.q = ex.search; p.qf = 'form'; }
    // robots.txt may ask agents to stay off the search path; say who it names
    if (p.q && robotsOk) { try { const sp = new URL(p.q.replace('{q}', 'x')).pathname; const live = AGENTS.filter((a) => a.role !== 'training'), no = live.filter((a) => !robotsAllows(groups, a.name, sp).allowed).map((a) => a.name); if (no.length) p.qb = no.length === live.length ? ['*'] : no; } catch {} }
  }
  return finish(p);
}
// the same score as the check, from the map
function finish(p) {
  if (p.us === 0) return p;
  const reading = AGENTS.filter((a) => a.role !== 'training'), open = p.rb === 'wall' ? 0 : reading.filter((a) => !(p.bl || []).includes(a.name)).length;
  const sc = Math.round((25 * open) / reading.length) + (p.w >= 120 ? 20 : p.w >= 40 ? 10 : 0) + (p.ld ? 15 : 0) + (p.t ? 5 : 0) + (p.ds ? 5 : 0) + (p.ll ? 10 : 0) + (p.ac ? 10 : 0) + (p.sm ? 5 : 0) + (p.s === 200 && !p.nh ? 5 : 0) - (p.ni ? 15 : 0);
  p.sc = Math.max(0, sc); p.g = sc >= 85 ? 'A' : sc >= 70 ? 'B' : sc >= 50 ? 'C' : sc >= 30 ? 'D' : 'E';
  return p;
}

// ---------------------------------------------------------------- words, for finding sites by what they are
const STOP = new Set('the and for with from that this your you our are was were has have not but all any can more most new www com org net html home page site official welcome online free best top der die das und mit von für den dem des ein eine einer ist auf im zu les des une pour avec dans sur est los las del para con una por que el la il di per con della dei het een van voor met och för til med på'.split(' '));
export function wordsOf(p) {
  const out = new Map(), add = (s, w) => { for (const t of String(s || '').toLowerCase().split(/[^\p{L}\p{N}]+/u)) if (t.length >= 2 && t.length <= 30 && !STOP.has(t) && !/^\d+$/.test(t)) out.set(t, Math.max(out.get(t) || 0, w)); };
  const labels = siteOf(p.d).split('.'); add(labels.slice(0, -1).join(' '), 5); add(labels.slice(0, -1).join(' ').replace(/-/g, ' '), 5);
  add(p.t, 3); add(p.ds, 2); for (const t of p.ld || []) add(String(t).replace(/([a-z])([A-Z])/g, '$1 $2'), 2); for (const [n] of p.nv || []) add(n, 1);
  if (p.q) out.set('search', Math.max(out.get('search') || 0, 1));
  return [...out].sort((a, b) => b[1] - a[1]).slice(0, 48);
}
export const prior = (p) => (1 + (p.sc || 0) / 50) / Math.log10((p.rk || 500000) + 10);

// ---------------------------------------------------------------- what an agent reads
export function expand(p, base = 'https://mareliberum.dev') {
  if (!p) return null;
  const blocked = new Set(p.bl || []), host = p.f ? p.f.split('/')[0] : p.d;
  const agents = AGENTS.map((a) => ({ name: a.name, op: a.op, role: a.role, allowed: p.rb === 'wall' ? null : !blocked.has(a.name) }));
  const nav = (p.nv || []).map(([name, path]) => ({ name, url: /^https?:/.test(path) ? path : `https://${host}${path}` }));
  return strip({
    site: p.d, rank: p.rk, mapped: p.at, status: p.s, home: p.s ? `https://${p.f || p.d}` : undefined, title: p.t && entities(p.t), description: p.ds && entities(p.ds), language: p.lg,
    search: p.q ? strip({ template: p.q, from: p.qf === 'opensearch' ? "the site's OpenSearch description" : "the site's search form", example: p.q.replace('{q}', 'example'), robotsDisallowsFor: p.qb && (p.qb[0] === '*' ? 'all assistants and AI search crawlers' : p.qb) }) : undefined,
    readable: p.w != null ? { words: p.w, withoutJavaScript: !p.sh } : undefined, structuredData: p.ld, sections: nav.length ? nav : undefined,
    feeds: p.fd, sitemaps: p.sm, developers: p.dv, llmsTxt: p.ll ? `https://${host}/llms.txt` : undefined, agentCard: p.ac ? { name: p.ac.n, skills: p.ac.k } : undefined,
    robots: p.rb === 'wall' ? 'robots.txt did not answer: the site turns automated readers away' : p.rb === 'none' ? 'no robots.txt: everything allowed' : 'robots.txt read',
    atlas: p.us === 0 ? 'robots.txt asks the Atlas not to read this site; only robots.txt was read' : undefined, noindex: p.ni ? true : undefined,
    agents, score: p.sc, grade: p.g,
    // ready paths for the most common tasks on this site
    recipes: recipesOf(p, host, nav),
    forms: (p.fm || []).length ? p.fm.map(([kind, action, method]) => ({ kind, action: action ? (/^https?:/.test(action) ? action : `https://${host}${action}`) : undefined, method })) : undefined,
    local: p.lc ? strip({ type: p.lc.t, openingHours: p.lc.oh, priceRange: p.lc.pr }) : undefined,
    apis: p.ap, signIn: p.au ? 'some features need an account' : undefined, paywall: p.pw ? 'some content is for subscribers only' : undefined,
    changes: (p.ch || []).length ? p.ch : undefined,
    use: strip({ read: `${base}/r/https://${host}/`, check: `${base}/check/${p.d}`, searchThroughReader: p.q ? `${base}/r/${p.q.replace('{q}', '<words>')}` : undefined }),
    source: 'read from what the site publishes (robots.txt, the home page and the files it names) by MareLiberum-Atlas; open data, CC BY 4.0',
  });
}
function recipesOf(p, host, nav) {
  const pick = (re) => nav.find((x) => re.test(`${x.name} ${x.url}`))?.url;
  const form = (k) => (p.fm || []).find((f) => f[0] === k);
  const r = {
    search: p.q ? p.q : undefined,
    cart: pick(/\b(cart|basket|warenkorb|bag|panier|carrito)\b/i),
    contact: pick(/\b(contact|kontakt|impressum|support|hilfe|help)\b/i) || (form('contact') ? `form → ${form('contact')[1] || 'this page'}` : undefined),
    account: pick(/\b(log ?in|sign ?in|account|konto|anmelden|my\b)/i) || (form('login') ? `form → ${form('login')[1] || 'this page'}` : undefined),
    booking: form('booking') ? `form → ${form('booking')[1] || 'this page'}` : pick(/\b(book|buchen|reserv|tickets?)\b/i),
    newsletter: form('newsletter') ? `form → ${form('newsletter')[1] || 'this page'}` : undefined,
  };
  return Object.values(r).some(Boolean) ? r : undefined;
}
function strip(o) { for (const k of Object.keys(o)) { const v = o[k]; if (v == null || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length)) delete o[k]; } return o; }

export function siteMarkdown(x) {
  if (!x) return '';
  const L = [`# ${x.site} — for agents`, '', x.title ? `**${x.title}**${x.description ? ` — ${x.description}` : ''}` : '', ''];
  if (x.search) L.push(`**Search:** \`${x.search.template}\` (replace {q} with the words; from ${x.search.from})${x.search.robotsDisallowsFor ? ` — robots.txt asks ${[].concat(x.search.robotsDisallowsFor).join(', ')} not to fetch this path` : ''}`);
  if (x.readable) L.push(`**Readable:** ${x.readable.words} words ${x.readable.withoutJavaScript ? 'without JavaScript' : '— needs JavaScript (use the reader or the search link)'}`);
  const no = (x.agents || []).filter((a) => a.allowed === false).map((a) => a.name);
  L.push(`**Agents:** ${no.length ? `robots.txt blocks ${no.join(', ')}` : x.robots.startsWith('robots.txt did not') ? x.robots : 'none of the 18 known agents is blocked'}`);
  if (x.sections) L.push('', '## Sections', ...x.sections.map((s) => `- [${s.name}](${s.url})`));
  if (x.recipes) L.push('', '## Ready paths', ...Object.entries(x.recipes).filter(([, v]) => v).map(([k, v]) => `- ${k}: ${v}`));
  if (x.local) L.push('', `**Local:** ${[x.local.type, x.local.openingHours && `opening hours ${x.local.openingHours.join('; ')}`, x.local.priceRange && `price range ${x.local.priceRange}`].filter(Boolean).join(' · ')}`);
  if (x.apis) L.push(`**Machine doors:** ${x.apis.join(' · ')}`);
  if (x.signIn || x.paywall) L.push(`**Limits:** ${[x.signIn, x.paywall].filter(Boolean).join(' · ')}`);
  if (x.changes) L.push('', '## Changes seen', ...x.changes.map((c) => `- ${c.at}: ${c.what.join(', ')}`));
  const more = [['Feeds', x.feeds], ['Sitemaps', x.sitemaps], ['Developers', x.developers && [x.developers]], ['llms.txt', x.llmsTxt && [x.llmsTxt]]].filter(([, v]) => v?.length);
  if (more.length) L.push('', '## Files', ...more.map(([k, v]) => `- ${k}: ${v.join(' · ')}`));
  if (x.agentCard) L.push(`- Agent card: ${x.agentCard.name || 'present'}${x.agentCard.skills ? ` (${x.agentCard.skills} skills)` : ''}`);
  L.push('', `${x.score != null ? `Agent-readiness ${x.score}/100 (${x.grade}). ` : ''}Mapped ${x.mapped}${x.rank ? ` · rank ${x.rank}` : ''}.`, '', `Read any page: ${x.use.read} · Full check: ${x.use.check}`, '', `_${x.source}_`);
  return L.filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');
}
