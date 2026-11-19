// Mare Liberum · the check: how AI agents see a website.
// Read only from what the site itself publishes (robots.txt, llms.txt, its home page, its agent card), a handful of small
// requests, nothing stored but the result. Nothing guessed: every finding names where it was read.

export const CHECK_UA = 'MareLiberum-Check/1.0 (+https://mareliberum.dev/privacy; reads robots.txt, llms.txt, the home page and the agent card once)';

// the agents that matter for being found and read; role says what a yes or no means for the site
export const AGENTS = [
  { name: 'ChatGPT-User', op: 'OpenAI', role: 'live' },
  { name: 'OAI-SearchBot', op: 'OpenAI', role: 'search' },
  { name: 'GPTBot', op: 'OpenAI', role: 'training' },
  { name: 'Claude-User', op: 'Anthropic', role: 'live' },
  { name: 'Claude-SearchBot', op: 'Anthropic', role: 'search' },
  { name: 'ClaudeBot', op: 'Anthropic', role: 'training' },
  { name: 'Perplexity-User', op: 'Perplexity', role: 'live' },
  { name: 'PerplexityBot', op: 'Perplexity', role: 'search' },
  { name: 'Googlebot', op: 'Google', role: 'search' },
  { name: 'Google-Extended', op: 'Google', role: 'training' },
  { name: 'Bingbot', op: 'Microsoft', role: 'search' },
  { name: 'Applebot-Extended', op: 'Apple', role: 'training' },
  { name: 'Meta-ExternalAgent', op: 'Meta', role: 'training' },
  { name: 'Amazonbot', op: 'Amazon', role: 'search' },
  { name: 'DuckAssistBot', op: 'DuckDuckGo', role: 'live' },
  { name: 'MistralAI-User', op: 'Mistral', role: 'live' },
  { name: 'CCBot', op: 'Common Crawl', role: 'training' },
  { name: 'Bytespider', op: 'ByteDance', role: 'training' },
];

// a website name, never an address: no IP literals, no local or internal names
export function safeHost(q) {
  let h; try { h = new URL(/^https?:\/\//i.test(q) ? q : `https://${String(q).trim()}`).hostname.toLowerCase().replace(/\.$/, ''); } catch { return null; }
  if (!/^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(h)) return null;
  if (/(^|\.)(localhost|local|localdomain|internal|intranet|lan|home|corp|test|invalid|example|onion|arpa)$/.test(h)) return null;
  return h;
}
const privateIp = (a) => /^(0\.|10\.|127\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|::1$|::$|f[cd]|fe80|::ffff:(10|127|192\.168|169\.254)\.)/i.test(a);
export async function publicDns(host) {
  try { const dns = await import('node:dns'); const r = await dns.promises.lookup(host, { all: true }); return r.length > 0 && !r.some((x) => privateIp(x.address)); } catch (e) { return e?.code === 'ENOTFOUND' || e?.code === 'EAI_AGAIN' ? false : true; }
}

// one small read: manual redirects (each target checked again), a size cap and a time cap
export async function grab(url, { max = 350_000, ms = 6000, ua = CHECK_UA } = {}) {
  const ac = new AbortController(), timer = setTimeout(() => ac.abort(), ms);
  try {
    let u = url;
    for (let hop = 0; hop < 4; hop++) {
      const r = await fetch(u, { redirect: 'manual', signal: ac.signal, headers: { 'user-agent': ua, accept: 'text/html,text/plain,application/json;q=0.9,*/*;q=0.5' } });
      if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
        const next = new URL(r.headers.get('location'), u); try { await r.body?.cancel(); } catch {}
        if (next.protocol !== 'https:' && next.protocol !== 'http:') return { status: 0 };
        const h = safeHost(next.hostname); if (!h || !(await publicDns(h))) return { status: 0, blocked: true };
        u = next.href; continue;
      }
      const reader = r.body?.getReader(); const parts = []; let size = 0;
      if (reader) for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; parts.push(value); if (size > max) { try { await reader.cancel(); } catch {} break; } }
      const all = new Uint8Array(Math.min(size, max)); let o = 0; for (const p of parts) { const take = Math.min(p.length, all.length - o); if (take <= 0) break; all.set(p.subarray(0, take), o); o += take; }
      return { status: r.status, url: u, type: r.headers.get('content-type') || '', robotsTag: r.headers.get('x-robots-tag') || '', body: new TextDecoder().decode(all) };
    }
    return { status: 0 };
  } catch { return { status: 0 }; } finally { clearTimeout(timer); }
}

// robots.txt as RFC 9309 reads it: groups per user agent, the longest matching rule decides, ties allow
export function robotsGroups(txt) {
  const groups = []; let cur = null, lastUa = false;
  for (const raw of String(txt || '').split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim(); if (!line) continue;
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line); if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === 'user-agent') { if (!cur || !lastUa) { cur = { agents: [], rules: [] }; groups.push(cur); } cur.agents.push(v.toLowerCase()); lastUa = true; continue; }
    lastUa = false;
    if (cur && (k === 'allow' || k === 'disallow')) cur.rules.push({ allow: k === 'allow', path: v });
  }
  return groups;
}
const ruleHits = (pattern, path) => { if (!pattern) return false; const end = pattern.endsWith('$'); const body = (end ? pattern.slice(0, -1) : pattern).split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*'); return new RegExp(`^${body}${end ? '$' : ''}`).test(path); };
export function robotsAllows(groups, agent, path = '/') {
  const a = agent.toLowerCase();
  let rules = groups.filter((g) => g.agents.includes(a)).flatMap((g) => g.rules), named = rules.length > 0 || groups.some((g) => g.agents.includes(a));
  if (!named) rules = groups.filter((g) => g.agents.includes('*')).flatMap((g) => g.rules);
  let best = null;
  for (const r of rules) if (ruleHits(r.path, path) && (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow))) best = r;
  return { allowed: !best || best.allow, named };
}

const attr = (tag, name) => { const m = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i').exec(tag); return m ? (m[2] ?? m[3] ?? '').trim() : null; };
const metaOf = (html, key) => { for (const m of html.matchAll(/<meta\b[^>]*>/gi)) { const t = m[0]; if ((attr(t, 'name') || attr(t, 'property') || '').toLowerCase() === key) return attr(t, 'content'); } return null; };
export const decode = (s) => String(s || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
export function readPage(html) {
  const title = decode(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]).slice(0, 160) || null;
  const types = new Set();
  for (const m of html.matchAll(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { const walk = (x) => { if (Array.isArray(x)) return x.forEach(walk); if (x && typeof x === 'object') { [].concat(x['@type'] || []).forEach((t) => types.add(String(t).slice(0, 40))); if (x['@graph']) walk(x['@graph']); } }; walk(JSON.parse(m[1].trim())); } catch { types.add('(unreadable JSON-LD)'); }
  }
  const text = decode(html.replace(/<(script|style|noscript|svg|template|head)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' '));
  const words = text ? text.split(' ').filter((w) => /[\p{L}\p{N}]/u.test(w)).length : 0;
  const shell = words < 60 && /<div[^>]+id=["'](root|app|__next|__nuxt|svelte)["']/i.test(html);
  const robots = (metaOf(html, 'robots') || '').toLowerCase();
  return { title, description: (metaOf(html, 'description') || '').slice(0, 300) || null, lang: attr(/<html\b[^>]*>/i.exec(html)?.[0] || '', 'lang'), words, shell,
    og: { title: !!metaOf(html, 'og:title'), image: !!metaOf(html, 'og:image') }, jsonld: [...types].slice(0, 12), noindex: /noindex/.test(robots), noai: /noai/.test(robots) };
}

export async function checkSite(host) {
  if (!(await publicDns(host))) return { host, reachable: false, note: 'this name does not lead to a public website' };
  const root = `https://${host}`;
  const [robots, llms, home, card, card2] = await Promise.all([grab(`${root}/robots.txt`, { max: 200_000 }), grab(`${root}/llms.txt`, { max: 60_000 }), grab(`${root}/`), grab(`${root}/.well-known/agent-card.json`, { max: 60_000 }), grab(`${root}/.well-known/agent.json`, { max: 60_000 })]);
  const robotsOk = robots.status === 200 && !/text\/html/i.test(robots.type) && !/<html/i.test(robots.body || '');
  // no robots.txt (404) means everything is allowed; a wall (403, an error, silence) means we cannot tell — and agents meet the same wall
  const robotsNone = robots.status === 404 || robots.status === 410, robotsWall = !robotsOk && !robotsNone;
  const groups = robotsOk ? robotsGroups(robots.body) : [];
  const agents = AGENTS.map((a) => (robotsWall ? { ...a, allowed: null, named: false } : { ...a, ...robotsAllows(groups, a.name) }));
  const sitemap = robotsOk && /^\s*sitemap\s*:/im.test(robots.body) ? true : (await Promise.all([grab(`${root}/sitemap.xml`, { max: 4000 }), grab(`${root}/sitemap_index.xml`, { max: 4000 })])).some((r) => r.status === 200);
  const reach = { status: home.status, https: /^https:/.test(home.url || ''), final: home.url ? (() => { try { const u = new URL(home.url); return u.hostname + (u.pathname === '/' ? '' : u.pathname); } catch { return null; } })() : null };
  const page = home.status === 200 && /html/i.test(home.type) ? readPage(home.body) : null;
  if (page && /noindex/i.test(home.robotsTag)) page.noindex = true;
  const llmsOk = llms.status === 200 && !/<html/i.test(llms.body || '') && (llms.body || '').trim().length > 20;
  const cardOf = (r) => { if (r.status !== 200) return null; try { const j = JSON.parse(r.body); return j && (j.name || j.skills) ? { name: String(j.name || '').slice(0, 80) || null, skills: Array.isArray(j.skills) ? j.skills.length : 0 } : null; } catch { return null; } };
  const agentCard = cardOf(card) || cardOf(card2);

  // the score: what decides whether assistants can find, read and act on the site for a person (training is the site's choice, not scored)
  const reading = agents.filter((a) => a.role !== 'training'), open = reading.filter((a) => a.allowed).length;
  const parts = [
    robotsWall
      ? { key: 'access', max: 25, got: 0, ok: false, title: `robots.txt did not answer (${robots.status || 'no reply'}) — the site turns automated readers away`, fix: 'a bot wall in front of the site stops AI assistants too; let known AI agents through if you want them to read for people', from: 'robots.txt' }
      : { key: 'access', max: 25, got: Math.round((25 * open) / reading.length), ok: open === reading.length, title: `${open} of ${reading.length} assistants and AI search crawlers may read the site`, fix: open === reading.length ? null : 'robots.txt blocks some of them — allow the ones you want to send you visitors (ChatGPT-User, OAI-SearchBot, Claude-User, PerplexityBot, Googlebot, Bingbot)', from: robotsOk ? 'robots.txt' : 'no robots.txt (everything allowed)' },
    { key: 'readable', max: 20, got: !page ? 0 : page.words >= 120 ? 20 : page.words >= 40 ? 10 : 0, ok: !!page && page.words >= 120, title: !page ? (home.status === 403 || home.status === 429 ? `The home page turned us away (${home.status}) — most AI agents meet the same wall` : `The home page did not answer with a page (${home.status || 'no reply'})`) : page.shell ? `The home page shows ${page.words} words before JavaScript runs — most agents see an empty shell` : `${page.words} words readable without JavaScript`, fix: page && page.words < 120 ? 'render the main text on the server, so agents that do not run JavaScript can read it' : !page ? 'make the home page answer with 200 and HTML' : null, from: 'home page' },
    { key: 'structured', max: 15, got: page?.jsonld.length ? 15 : page?.og.title ? 5 : 0, ok: !!page?.jsonld.length, title: page?.jsonld.length ? `Structured data: ${page.jsonld.slice(0, 5).join(', ')}` : 'No structured data (JSON-LD)', fix: page?.jsonld.length ? null : 'describe what you offer as schema.org JSON-LD (Organization, Product, Offer, Article …) — agents read it first', from: 'home page' },
    { key: 'meta', max: 10, got: (page?.title ? 5 : 0) + (page?.description ? 5 : 0), ok: !!(page?.title && page?.description), title: page?.title && page?.description ? 'Title and description present' : `Missing ${[!page?.title && 'title', !page?.description && 'description'].filter(Boolean).join(' and ') || 'page'}`, fix: page?.title && page?.description ? null : 'give the page a clear title and a one-sentence description', from: 'home page' },
    { key: 'llms', max: 10, got: llmsOk ? 10 : 0, ok: llmsOk, title: llmsOk ? 'llms.txt present' : 'No llms.txt', fix: llmsOk ? null : 'publish /llms.txt: a short plain-text guide to the site for language models', from: '/llms.txt' },
    { key: 'agentcard', max: 10, got: agentCard ? 10 : 0, ok: !!agentCard, title: agentCard ? `Agent card: ${agentCard.name || 'present'}${agentCard.skills ? ` · ${agentCard.skills} skills` : ''}` : 'No agent card', fix: agentCard ? null : 'if agents may act with you (book, buy, ask), publish /.well-known/agent-card.json (A2A)', from: '/.well-known/agent-card.json' },
    { key: 'sitemap', max: 5, got: sitemap ? 5 : 0, ok: sitemap, title: sitemap ? 'Sitemap found' : 'No sitemap found in robots.txt, /sitemap.xml or /sitemap_index.xml', fix: sitemap ? null : 'list your pages in /sitemap.xml and name it in robots.txt', from: robotsOk ? 'robots.txt / sitemap.xml' : '/sitemap.xml' },
    { key: 'https', max: 5, got: reach.status === 200 && reach.https ? 5 : 0, ok: reach.status === 200 && reach.https, title: reach.status === 200 ? (reach.https ? 'Answers over HTTPS' : 'Answers without HTTPS') : `Home page answered ${reach.status || 'nothing'}`, fix: reach.status === 200 && reach.https ? null : 'serve the site over HTTPS with status 200', from: 'home page' },
  ];
  if (page?.noindex) parts.push({ key: 'noindex', max: 0, got: 0, ok: false, title: 'The page asks not to be indexed (noindex)', fix: 'remove noindex if you want to appear in AI answers', from: 'robots meta / X-Robots-Tag' });
  const score = parts.reduce((s, p) => s + p.got, 0) - (page?.noindex ? 15 : 0);
  const training = agents.filter((a) => a.role === 'training');
  return { host, reachable: reach.status > 0, at: new Date().toISOString(), score: Math.max(0, score), grade: score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : score >= 30 ? 'D' : 'E', reach, page, llms: llmsOk, agentCard, sitemap, robots: robotsOk,
    agents: agents.map(({ name, op, role, allowed, named }) => ({ name, op, role, allowed, named })), parts,
    robotsStatus: robots.status, training: { allowed: training.filter((a) => a.allowed).length, of: training.length, note: 'letting AI models train on the site is your choice — it is shown, not scored' },
    note: 'read from what the site publishes: robots.txt, llms.txt, the home page and the agent card. robots.txt states wishes; most large AI operators say they follow it.' };
}
