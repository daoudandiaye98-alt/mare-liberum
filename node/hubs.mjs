// Mare Liberum · the hub pages, the first thing a search engine should know of the sea
// The pages a person or a search engine should find first stand in a sitemap of their own (/sitemaps/hubs.xml, first in
// /sitemap.xml), each once, with the day it last changed and, where it has one, its page in the other language. The day
// a hub last changed is the day the sea saw its words, links or structured data change (node/tidings.mjs; numbers that move
// by themselves are no change). A live hub names no day before the sea saw it change (lastmod is optional, and a day that
// is always today teaches the engines to ignore it). A hub of fixed words carries STATIC_DAY, the day of the release that
// last changed its words or the frame every page wears (the header, the dive plan, the foot), or a later change the sea saw.
// The same list goes to the search engines that take IndexNow, once a day (node/core.mjs). A hub appears here and in no
// other sitemap of the sea.
export const STATIC_DAY = '2026-11-24';
// [path, how often it changes, live]
export const HUBS = [
  ['/', 'hourly', 1], ['/connect', 'daily', 1], ['/open', 'daily', 1], ['/proof', 'daily', 1], ['/attention', 'daily', 1], ['/savings', 'daily', 1], ['/fair', 'daily', 1], ['/engine', 'daily', 1],
  // the guides for developers (node/guides.mjs): their words change with a release, their numbers with the bench and the toll, so the
  // sea dates them by the change it sees (live), never by a day before they existed
  ['/guides', 'weekly', 1], ['/guides/cut-llm-token-costs', 'weekly', 1], ['/guides/lean-mcp-tool-list', 'weekly', 1], ['/guides/read-a-page-again', 'weekly', 1],
  ['/guides/only-the-fields-you-need', 'weekly', 1], ['/guides/compress-litellm-vercel-ai-sdk', 'weekly', 1],
  ['/pricing', 'weekly', 0], ['/claim', 'weekly', 0],
  ['/brain', 'hourly', 1], ['/brain/areas', 'daily', 1], ['/brain/market', 'daily', 1], ['/brain/thinking', 'weekly', 0],
  ['/mcp-server', 'daily', 1], ['/mcp-servers', 'daily', 1], ['/a2a-agents', 'daily', 1], ['/x402-apis', 'daily', 1], ['/use', 'weekly', 0],
  ['/check', 'weekly', 0], ['/routes', 'daily', 1], ['/sites', 'daily', 1], ['/briefs', 'weekly', 0], ['/review', 'monthly', 0], ['/works', 'daily', 1], ['/earn', 'daily', 1],
  ['/offers', 'weekly', 0], ['/teams', 'weekly', 0], ['/business', 'weekly', 0], ['/web-to-markdown', 'weekly', 0],
  ['/ai-crawlers', 'daily', 1], ['/weather', 'daily', 1], ['/web', 'daily', 1], ['/buy', 'daily', 1], ['/current', 'hourly', 1], ['/visitors', 'hourly', 1],
  ['/atlantis', 'hourly', 1], ['/arena', 'daily', 1], ['/mining', 'daily', 1], ['/lighthouse', 'daily', 1], ['/learn', 'daily', 1], ['/roadmap', 'daily', 1],
  ['/harbour', 'weekly', 0], ['/yard', 'weekly', 0], ['/download', 'weekly', 0], ['/read', 'weekly', 0], ['/find', 'weekly', 0], ['/atlas', 'monthly', 0],
  ['/why', 'monthly', 0], ['/manifesto', 'monthly', 0], ['/about', 'monthly', 0], ['/impressum', 'monthly', 0], ['/privacy', 'monthly', 0], ['/terms', 'monthly', 0],
  ['/security', 'weekly', 0], ['/transparency', 'weekly', 0], ['/tools', 'monthly', 0],
  ['/de', 'daily', 1], ['/de/mcp-server', 'daily', 1], ['/de/ki-sichtbarkeit', 'weekly', 0], ['/de/unternehmen', 'weekly', 0], ['/de/webseite-als-markdown', 'weekly', 0],
  ['/de/ki-crawler', 'daily', 1], ['/de/agentenwetter', 'daily', 1], ['/de/agenturen', 'weekly', 0], ['/de/kanzleien', 'weekly', 0],
  ['/de/agb', 'monthly', 0], ['/de/datenschutz', 'monthly', 0], ['/de/preise', 'monthly', 0], ['/de/widerruf', 'monthly', 0],
];
// the same page in English and German; the English one is the default for every other language (as the pages' own heads say)
export const HUB_ALT = { '/': '/de', '/mcp-server': '/de/mcp-server', '/check': '/de/ki-sichtbarkeit', '/business': '/de/unternehmen', '/ai-crawlers': '/de/ki-crawler', '/weather': '/de/agentenwetter', '/web-to-markdown': '/de/webseite-als-markdown', '/terms': '/de/agb', '/privacy': '/de/datenschutz' };
export const HUB_PATHS = HUBS.map(([p]) => p);
export const HUB_SET = new Set(HUB_PATHS);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pairOf = (p) => { if (HUB_ALT[p]) return [p, HUB_ALT[p]]; const en = Object.keys(HUB_ALT).find((k) => HUB_ALT[k] === p); return en ? [en, p] : null; };
// seen: the day the sea saw the hub change (node/tidings.mjs), if it did; never a day after today
export const lastmodOf = (live, today, seen) => { const s = /^\d{4}-\d{2}-\d{2}$/.test(seen || '') && seen <= today ? seen : null; return live ? s : s && s > STATIC_DAY ? s : STATIC_DAY; };
// the newest day of all hubs (for the index of the sitemaps), or null
export const hubsDay = (today, mods = {}) => HUBS.map(([p, , live]) => lastmodOf(live, today, mods[p])).filter(Boolean).sort().pop() || null;
export function hubSitemap(base, today = new Date().toISOString().slice(0, 10), mods = {}) {
  const url = ([p, f, live]) => { const pr = pairOf(p), alt = pr ? `<xhtml:link rel="alternate" hreflang="en" href="${esc(base + pr[0])}"/><xhtml:link rel="alternate" hreflang="de" href="${esc(base + pr[1])}"/><xhtml:link rel="alternate" hreflang="x-default" href="${esc(base + pr[0])}"/>` : '', lm = lastmodOf(live, today, mods[p]);
    return `<url><loc>${esc(base + p)}</loc>${lm ? `<lastmod>${lm}</lastmod>` : ''}<changefreq>${f}</changefreq>${alt}</url>`; };
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${HUBS.map(url).join('')}</urlset>`;
}
