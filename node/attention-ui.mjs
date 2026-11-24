// Mare Liberum · the pages of attention (since 3.33.0): /attention, /claim, /pricing, and the line on a listing
// What the AIs read of the open index (node/attention.mjs), what a provider can do with its listing, and every price of the
// house in one table. Each page has its data beside it (.json) and is Markdown for an agent that asks (node/agentmd.mjs).
// Every button to a paid service goes through the counted door /c/<service>. Nothing here changes an order, and nothing
// promises reads, ranking or revenue.
import { page, esc } from './pages.mjs';
import { FAMILIES, GROUPS, ATTENTION } from './attention.mjs';
import { OFFERS, SELLER, isOpen, priceOf, go } from './offers.mjs';
import { perReuse } from './areas.mjs';

const n = (x) => Number(x || 0).toLocaleString('en-US');
const LABEL_GROUP = Object.fromEntries(FAMILIES.map(([, , label, g]) => [label, g]));
const famIn = (by, g) => Object.entries(by || {}).filter(([l]) => LABEL_GROUP[l] === g);
const famText = (by, g, k = 4) => { const e = famIn(by, g); return e.slice(0, k).map(([l, v]) => `${l} ${n(v)}`).join(', ') + (e.length > k ? `, ${e.length - k} more` : ''); };
const times = (x) => `${n(x)} time${x === 1 ? '' : 's'}`;
const dayName = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ------------------------------------------------------------------ the line on a listing (/site/<domain>)
// "AI crawlers read this page N times in the last 7 days (ClaudeBot a, GPTBot b, …)", only for what was read; '' when nothing was
export function attentionLine(A, { html = true, box = false } = {}) {
  if (!A) return '';
  const b = (x) => (html ? `<b>${n(x)}</b>` : n(x)), e = (s) => (html ? esc(s) : s), p = A.page || {}, parts = [];
  for (const g of ['ai', 'search', 'assistant']) if (p[g] > 0) parts.push(parts.length ? `${GROUPS[g]} ${b(p[g])} time${p[g] === 1 ? '' : 's'} (${e(famText(p.by, g))})` : `${cap(GROUPS[g])} read this page ${b(p[g])} time${p[g] === 1 ? '' : 's'} in the last 7 days (${e(famText(p.by, g))})`);
  const ent = A.entries?.ai || 0;
  if (!parts.length && !ent) return '';
  let s = parts.length ? `${parts.join('; ')}.` : '';
  if (ent) s += `${s ? ' ' : ''}Its entries in the open index were read ${b(ent)} ${parts.length ? 'more ' : ''}time${ent === 1 ? '' : 's'} by AI crawlers${parts.length ? '' : ' in the last 7 days'}.`;
  return html ? `${s} ${box ? '<a href="#report">Is this yours?</a> · ' : ''}<a href="/attention">How it is counted</a>` : `${s} How it is counted: /attention`;
}
// the same for the data of a listing: always there, zero stays zero
export function attentionData(A, base) {
  return A ? { days: A.days, from: A.from, to: A.to, page: A.page, entries: A.entries, countingSince: A.since || null, counted: 'reads of this listing by AI crawlers, search engines and assistants reading for a person, by the name each sends (as in the census); at most 3 per caller network and day; the sea\'s own calls never', all: `${base}/attention` } : null;
}

// ------------------------------------------------------------------ /attention
const RULES = (since) => [
  'Counted: every answer of a listing page — the map of a website (/site/<domain>, as HTML, JSON or Markdown) and an entry of the open index (/e/<id>) — to a reader the census sees as an AI crawler, an AI search crawler, a search engine or an assistant reading for a person, by the name the reader sends (the same names as on /visitors).',
  'A read of an entry counts for the provider\'s own website when the entry names one (a store\'s domain, the address of its endpoint), never for the directory that listed it.',
  'At most 3 reads count per caller network (an IPv4 address or an IPv6 /64), listing and day. Names are taken as sent, and a program can wear a crawler\'s name: the rule keeps one address from inflating a listing. Reads beyond it are shown as not counted.',
  'The sea\'s own calls never count. People and programs are no readers here; their clicks on the services are counted apart, below.',
  `Per listing a day keeps its ${n(ATTENTION.sites)} most read; on a very busy day a listing read rarely can be left out of its own line, which then shows less, never more. The totals keep every read.`,
  'Applebot is counted with the search engines, as in the census: it serves Siri and Spotlight, and Apple\'s use for training is decided by the separate Applebot-Extended token. GoogleOther stands for Google\'s crawlers other than Googlebot (GoogleOther, Google-CloudVertexBot).',
  'Left out of the public list, never out of the count: shops that did not pass the checks of the verified market (they are never named), and domains whose names point to adult or gambling content. Every listing sees its own reads on its page.',
  `Kept: the totals ${ATTENTION.keepDays} days, the reads per listing ${ATTENTION.siteDays} days. Counting began on ${since}.`,
  'A count is shown, never used: it changes no order in the index, in the answers to agents or in the verified market. Nobody pays to rank.',
];
const change = (a, b) => (b > 0 ? Math.round(((a - b) / b) * 1000) / 10 : null);
export function attentionJson(base, O) {
  const full = O.weekBefore.days === 7 && O.week.days === 7;
  return {
    what: 'How often AI crawlers, search engines and assistants read the listings of the open index of Mare Liberum: the map of a website (/site/<domain>) and the entries of agents, MCP servers, paid APIs and stores (/e/<id>). Counted per day by the family of the reader.',
    since: O.since, today: O.today,
    week: { from: O.week.from, to: O.week.to, days: O.week.days, ai: O.week.ai, search: O.week.search, assistant: O.week.assistant, byFamily: O.week.by },
    weekBefore: { from: O.weekBefore.from, to: O.weekBefore.to, days: O.weekBefore.days, ai: O.weekBefore.ai, search: O.weekBefore.search, assistant: O.weekBefore.assistant },
    change: { aiPercent: full ? change(O.week.ai, O.weekBefore.ai) : null, note: full ? 'this week against the week before' : 'not enough days counted yet for a comparison of two weeks' },
    days: O.days.map((d) => ({ day: d.day, ai: d.ai, search: d.search, assistant: d.assistant, maps: d.maps, entries: d.entries, byFamily: d.by, notCounted: d.notCounted })),
    top: O.top.map((t) => ({ site: t.site, ai: t.ai, search: t.search, assistant: t.assistant, aiOnMap: t.maps, aiOnEntries: t.entries, byFamily: t.by, listing: t.mapped ? `${base}/site/${t.site}` : null })),
    notCounted7days: O.notCounted, leftOutOfListings7days: O.leftOutOfListings,
    clicks: { ...O.clicks, note: 'clicks on the paid services through the counted door /c/<service>, per service, page kind and kind of caller (person, assistant, program); crawlers and the sea itself are not counted. A click is not a sale: payments happen at Stripe and are not seen here.' },
    offers: providerOffers(base),
    rules: RULES(O.since),
    families: FAMILIES.map(([kind, name, label, group]) => ({ label, group: GROUPS[group], census: `${kind} · ${name}` })),
    pages: { html: `${base}/attention`, json: `${base}/attention.json`, markdown: `${base}/attention.md`, claim: `${base}/claim`, pricing: `${base}/pricing`, census: `${base}/visitors` },
    quote: `Quote it with a link to ${base}/attention.`,
  };
}
const providerOffers = (base) => [
  ...(isOpen('verified') ? [{ id: 'owner', name: OFFERS.verified.name, priceEur: OFFERS.verified.priceEur, go: `${base}${go('owner', 'attention')}`, what: 'a person confirms that you control the domain and checks your listing against the live service; when it passes, the line "Owner checked" with the date for 12 months, named as a paid check', outcome: 'can be negative: without proof of control there is no line', never: 'changes no order and never adds the level "verified" or "proven" of the verified market' }] : []),
  ...(isOpen('report') ? [{ id: 'report', name: 'AI-visibility report (full report with fixes)', priceEur: OFFERS.report.priceEur, go: `${base}${go('report', 'attention')}`, sample: `${base}/offers/sample-report` }] : []),
];
// one column a day, the AI crawlers' reads of listings; the table below holds every number the chart shows
const nice = (v) => { if (!(v > 0)) return 1; const p = 10 ** Math.floor(Math.log10(v)); for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p; return 10 * p; };
function chart(days) {
  const list = days.slice().reverse(), top = nice(Math.max(...list.map((d) => d.ai))), last = list.length - 1;
  const col = (d, i) => `<div class="att-col${i < 3 ? ' l' : i > last - 3 ? ' r' : ''}" tabindex="0" aria-label="${esc(dayName(d.day))}: ${n(d.ai)} reads by AI crawlers"><span class="att-bar" style="height:${((d.ai / top) * 100).toFixed(2)}%"></span><span class="att-tip" aria-hidden="true"><b>${n(d.ai)}</b>${esc(dayName(d.day))}</span></div>`;
  return `<figure class="att-chart wide"><div class="att-plot" role="group" aria-label="Reads of listings by AI crawlers per day, ${esc(dayName(list[0].day))} to ${esc(dayName(list[last].day))}"><span class="att-tick" style="bottom:100%">${n(top)}</span><span class="att-grid" aria-hidden="true"></span>${list.map(col).join('')}</div>
<div class="att-axis" aria-hidden="true"><span>${esc(dayName(list[0].day))}</span>${last > 0 ? `<span>${esc(dayName(list[last].day))}</span>` : ''}</div>
<figcaption class="muted"><small>Reads of listings by AI crawlers, per day (UTC). Point at a column, or read the table below.</small></figcaption></figure>`;
}
const PAGE_CSS = '<style>.att-chart{margin:28px 0 36px}.att-plot{position:relative;display:flex;align-items:flex-end;gap:2px;height:200px;margin-top:22px;border-bottom:1px solid rgba(180,203,220,.42)}.att-grid{position:absolute;left:0;right:0;top:0;border-top:1px solid rgba(180,203,220,.2);pointer-events:none}.att-tick{position:absolute;left:0;margin-bottom:4px;font-size:12.5px;line-height:1;color:var(--mist,#b4cbdc);font-variant-numeric:tabular-nums}.att-col{position:relative;flex:1 1 0;min-width:0;display:flex;align-items:flex-end;justify-content:center;height:100%;outline:none;cursor:default}.att-col:focus-visible{box-shadow:0 0 0 2px rgba(255,181,71,.8);border-radius:4px}.att-bar{display:block;width:100%;max-width:24px;border-radius:4px 4px 0 0;background:#7fd3ff}.att-col:hover .att-bar,.att-col:focus-visible .att-bar{background:#c6ecff}.att-tip{position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);white-space:nowrap;padding:6px 10px;border-radius:9px;background:#03111f;border:1px solid rgba(127,211,255,.4);font-size:13px;line-height:1.35;color:var(--mist,#b4cbdc);opacity:0;pointer-events:none;transition:opacity .12s;z-index:4}.att-col.l .att-tip{left:0;transform:none}.att-col.r .att-tip{left:auto;right:0;transform:none}.att-col:hover .att-tip,.att-col:focus-visible .att-tip{opacity:1}.att-tip b{display:block;font-size:16px;color:#eef6fb;font-weight:650}.att-axis{display:flex;justify-content:space-between;margin-top:6px;font-size:13px;color:var(--mist,#b4cbdc)}.att-find{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.att-find input{flex:1 1 220px;min-width:0}@media (prefers-reduced-motion:reduce){.att-tip{transition:none}}</style>';
const findForm = (label) => `<form class="att-find" action="/site" method="get" role="search"><label class="sr" for="att-d" style="position:absolute;left:-9999px">${esc(label)}</label><input id="att-d" type="text" name="domain" inputmode="url" autocomplete="off" spellcheck="false" maxlength="160" required placeholder="your domain, e.g. shop.example.com"><button type="submit">${esc(label)}</button></form>`;

export function attentionPage(base, O) {
  const W = O.week, has = O.days.some((d) => d.ai + d.search + d.assistant > 0), full = O.weekBefore.days === 7 && W.days === 7, ch = full ? change(W.ai, O.weekBefore.ai) : null;
  const all = W.ai + W.search + W.assistant, share = (v) => { const x = (v / all) * 100; return x > 0 && x < 0.1 ? '&lt;0.1 %' : `${Math.round(x * 10) / 10} %`; };
  const famRows = ['ai', 'search', 'assistant'].flatMap((g) => famIn(W.by, g).map(([l, v]) => `<tr><td>${esc(l)}</td><td>${esc(GROUPS[g])}</td><td>${n(v)}</td><td>${share(v)}</td></tr>`)).join('');
  const dayRow = (d) => `<tr><td>${esc(d.day)}</td><td>${n(d.ai)}</td><td>${n(d.search)}</td><td>${n(d.assistant)}</td><td>${n(d.maps)}</td><td>${n(d.entries)}</td><td>${esc(famText(d.by, 'ai', 3) || '–')}</td></tr>`;
  const dayHead = '<thead><tr><th>day</th><th>AI crawlers</th><th>search engines</th><th>assistants</th><th>map pages</th><th>entries</th><th>AI crawlers by family</th></tr></thead>';
  // a domain is linked only when its own map answered (a read of /site/<domain> counted with 200 this week); a provider known
  // only from its entries has no map page yet, and a link there would lead a search engine to a 404
  const topRows = O.top.map((t, i) => `<tr><td>${i + 1}. ${t.mapped ? `<a href="/site/${esc(t.site)}">${esc(t.site)}</a>` : esc(t.site)}</td><td>${n(t.ai)}</td><td>${n(t.maps)} · ${n(t.entries)}</td><td>${n(t.search)}</td><td>${n(t.assistant)}</td></tr>`).join('');
  const NAMES = { owner: 'Owner check', report: 'AI-visibility report', teams: 'Team harbour, coding agents', agency: 'Team harbour, agencies', law: 'Kanzlei harbour', route: 'Paid route', talk: 'Institutions: talk to us' };
  const clickRows = Object.entries(O.clicks.last30days).map(([id, c]) => `<tr><td>${esc(NAMES[id] || id)}</td><td>${n(c.total)}</td><td>${esc(Object.entries(c.from).map(([f, v]) => `${f} ${n(v)}`).join(', '))}</td><td>${esc(Object.entries(c.who).map(([w, v]) => `${w} ${n(v)}`).join(', '))}</td></tr>`).join('');
  const offers = providerOffers(base);
  const body = `<p class="muted" style="margin:0"><a href="/visitors">The census</a> · what the AIs read</p><h1>What the AIs read on the open sea</h1>
<p class="pulse">Last 7 days: <b>${n(W.ai)}</b> reads of listings by AI crawlers · <b>${n(W.search)}</b> by search engines · <b>${n(W.assistant)}</b> by assistants for a person</p>
<p>Every listing of the open index — the map of a website, an MCP server, a paid API, a store, an agent — has a page on the sea, and AI crawlers read those pages all day. Here every read is counted by the family of the reader, per day, in the open. A provider sees on its own listing how much AI attention it gets.${ch != null ? ` This week against the week before: ${ch > 0 ? '+' : ''}${ch} % by AI crawlers.` : ''}</p>
${PAGE_CSS}${has ? `<h2>Reads per day</h2>${chart(O.days)}` : `<p class="muted">Nothing counted yet: counting began on ${esc(O.since)}. Zero stays zero until a crawler reads a listing.</p>`}
${famRows ? `<h2>Who read, this week</h2><table><thead><tr><th>reader</th><th>group</th><th>reads, 7 days</th><th>share</th></tr></thead><tbody>${famRows}</tbody></table>` : ''}
<h2>The listings read most this week</h2>${topRows ? `<table><thead><tr><th>listing</th><th>AI crawlers</th><th>map · entries</th><th>search engines</th><th>assistants</th></tr></thead><tbody>${topRows}</tbody></table><p class="muted"><small>Domains only, by reads of AI crawlers. Shops that did not pass the checks of the verified market are never named here.</small></p>` : '<p class="muted">No listing read yet this week.</p>'}
<section class="box" id="yours"><h3>Is your API, MCP server, shop or agent listed?</h3>
<p>Find its page: it shows how often AI crawlers read it, counted the same way as here.</p>${findForm('Find my listing')}
${offers.length ? `<p>${offers.map((o) => `<a class="tag" href="${esc(go(o.id, 'attention'))}" rel="nofollow">${o.id === 'owner' ? 'Owner check' : 'Get the AI-visibility report'} · ${n(o.priceEur)} €</a>`).join(' ')}</p>
<p>An owner check confirms that you control the domain and checks your listing against the live service; when it passes, the listing carries the line “Owner checked” with the date for 12 months, named as a paid check, and the outcome can be negative. It never changes any order (not in search results, not in answers to agents, not on this page) and never adds the level “verified” or “proven” of the verified market. <a href="/claim">How claiming works</a> · <a href="/pricing">all prices</a> · <small>${esc(SELLER.vat)}</small></p>` : '<p><a href="/claim">How claiming works</a> · <a href="/pricing">all prices</a></p>'}</section>
<h2>Day by day</h2><table>${dayHead}<tbody>${O.days.slice(0, 7).map(dayRow).join('') || `<tr><td>${esc(O.today)}</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>–</td></tr>`}</tbody></table>
${O.days.length > 7 ? `<details><summary>The ${O.days.length - 7} days before</summary><table>${dayHead}<tbody>${O.days.slice(7).map(dayRow).join('')}</tbody></table></details>` : ''}
<p class="muted"><small>Not counted in the last 7 days under the rule of 3 per caller and listing: ${n(O.notCounted)} reads. Listings left out of a day's own table on busy days: ${n(O.leftOutOfListings)}.</small></p>
<h2>What the attention led to</h2>${clickRows ? `<table><thead><tr><th>service</th><th>clicks, 30 days</th><th>from</th><th>by</th></tr></thead><tbody>${clickRows}</tbody></table>` : '<p>No click on a paid service yet.</p>'}
<p class="muted"><small>Every button to a paid service passes the counted door <code>/c/&lt;service&gt;</code>. Crawlers and the sea's own calls are not counted. A click is not a sale: payments happen at Stripe and are not seen here.</small></p>
<h2>How it is counted</h2><ul>${RULES(O.since).map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
<p><small>As data: <a href="/attention.json">/attention.json</a> · for agents as Markdown: <a href="/attention.md">/attention.md</a> · <a href="/visitors">the census</a> · <a href="/savings">what the shared brain saves</a> · quote it with a link to this page.</small></p>`;
  return page(base, '/attention', 'What the AIs read on the open sea — AI crawler reads of every listing, counted daily | Mare Liberum', `How often ClaudeBot, GPTBot, Meta, PerplexityBot, Googlebot and other readers read the listings of the open index of AI agents, MCP servers, APIs and stores: per day, per family, per listing. Last 7 days: ${n(W.ai)} reads by AI crawlers.`, body,
    { '@context': 'https://schema.org', '@type': 'Dataset', name: 'What the AIs read on the open sea', description: 'Daily counts of how often AI crawlers, search engines and assistants read the listings of the open index of Mare Liberum (maps of websites and entries of agents, MCP servers, paid APIs and stores), by reader family and by listing.', url: `${base}/attention`, isAccessibleForFree: true, temporalCoverage: `${O.since}/${O.today}`, creator: { '@type': 'Organization', name: 'Mare Liberum', url: base }, distribution: [{ '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: `${base}/attention.json` }, { '@type': 'DataDownload', encodingFormat: 'text/markdown', contentUrl: `${base}/attention.md` }] });
}

// ------------------------------------------------------------------ /claim
const NEVER = ['It changes no order: not in search results, not in the answers to agents, not in the counts of /attention.', 'It never adds the level “verified” or “proven” of the verified market: those come only from its four open checks, which run the same for every shop, paid or not, and a payment never lets a shop in.', 'Its outcome can be negative: when control of the domain cannot be shown, the listing gets no line.', 'It promises no ranking, no traffic, no revenue and no reads by any crawler.', 'What is free stays free: the map, the check, the free claim and the attention counts.'];
export function claimJson(base) {
  const v = isOpen('verified') ? OFFERS.verified : null, r = isOpen('report') ? OFFERS.report : null;
  return {
    what: 'How a provider claims its listing on Mare Liberum and has its ownership checked: what it costs, what it does and what it never does.',
    find: { site: `${base}/site/<your domain>`, search: `${base}/search?q=<your name>`, attention: `${base}/attention` },
    free: {
      claim: { how: `POST ${base}/enter {"name":"<your name>","offers":"<what you offer, in one line>","entry":"urn:air:<your entry>"}`, effect: 'You become a resident of the sea, bound to your entry: calls of agents that match what you offer reach your inbox, and you can answer them. No account, no key. It does not prove the entry is yours.' },
      speakForYourself: { how: `POST ${base}/join {"url":"<your domain>"}`, effect: 'The sea reads what your domain publishes itself (agent card, MCP server card, AI catalog, x402 list) and lists those entries as published by the domain.' },
    },
    ...(v ? { ownerCheck: { name: v.name, priceEur: v.priceEur, currency: 'EUR', period: v.period, go: `${base}${go('owner', 'claim')}`, delivers: v.delivers, within: v.within, asks: v.asks, outcome: 'can be negative: when control of the domain cannot be shown, the listing gets no line', tax: SELLER.vat } } : {}),
    ...(r ? { report: { name: r.name, priceEur: r.priceEur, currency: 'EUR', period: r.period, go: `${base}${go('report', 'claim')}`, sample: `${base}/offers/sample-report`, within: r.within, tax: SELLER.vat } } : {}),
    never: NEVER,
    seller: { name: SELLER.name, business: SELLER.business, address: SELLER.address, contact: SELLER.email },
    tax: SELLER.vat, taxEn: SELLER.vatEn, prices: `${base}/pricing`, page: `${base}/claim`,
  };
}
export function claimPage(base) {
  const j = claimJson(base), v = j.ownerCheck, r = j.report;
  const body = `<p class="muted" style="margin:0"><a href="/pricing">Prices</a> · for providers</p><h1>Claim your listing</h1>
<p>Your API, MCP server, shop or agent may already be listed in the open index of Mare Liberum, and AI crawlers read its page every day. Here is how to claim it, what it costs, and what it never does.</p>
${PAGE_CSS}<h2>1 · Find your listing</h2>
<p>The map of your website stands at <code>/site/&lt;your domain&gt;</code>, with how often AI crawlers read it in the last 7 days.</p>${findForm('Find my listing')}
<p>Entries of agents, MCP servers, paid APIs and stores: <a href="/mcp-servers">MCP servers</a> · <a href="/x402-apis">x402 APIs</a> · <a href="/a2a-agents">A2A agents</a> · <a href="/buy">stores by need</a> · <a href="/attention">what the AIs read</a>.</p>
<h2>2 · Claim it, free</h2>
<p>Enter the sea as a resident and name your entry. Calls of agents that match what you offer then reach your inbox, and you can answer them. No account, no key. Entering does not prove the entry is yours.</p>
<pre>${esc(j.free.claim.how)}</pre>
<p>Free as well: publish an agent card, an MCP server card, an AI catalog or an x402 list on your own domain, and the sea lists those entries as published by the domain itself:</p>
<pre>${esc(j.free.speakForYourself.how)}</pre>
${v ? `<h2>3 · The owner check, ${esc(priceOf(v))}</h2>
<ul>${v.delivers.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>
<p>The outcome can be negative: when control of the domain cannot be shown, the listing gets no line, and the note by e-mail says what was checked.</p>
<p><a class="tag" href="${esc(go('owner', 'claim'))}" rel="nofollow">Owner check · ${esc(priceOf(v))}</a> ${esc(v.asks)} ${esc(cap(v.within))}.</p>` : ''}
${r ? `<h2>${v ? '4' : '3'} · The AI-visibility report, ${esc(priceOf(r))}</h2>
<p>How AI agents and assistants read your website, checked by a person: up to 10 pages, every AI agent in robots.txt one by one, a comparison with up to three competitors, the fixes in order of effect with the files ready to use, and one re-check after 14 days. By e-mail, ${esc(r.within)}. <a href="/offers/sample-report">See a sample report</a>.</p>
<p><a class="tag" href="${esc(go('report', 'claim'))}" rel="nofollow">Get the AI-visibility report · ${esc(priceOf(r))}</a></p>` : ''}
<section class="box"><h3>What an owner check never does</h3><ul>${NEVER.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>
<h2>Price, seller and contact</h2>
<table><tbody>${v ? `<tr><td>Owner check</td><td>${esc(priceOf(v))}, ${esc(v.period)}</td></tr>` : ''}${r ? `<tr><td>AI-visibility report</td><td>${esc(priceOf(r))}, ${esc(r.period)}</td></tr>` : ''}<tr><td>Tax</td><td>${esc(SELLER.vat)} <span class="muted">(${esc(SELLER.vatEn)})</span></td></tr>
<tr><td>Seller</td><td>${esc(SELLER.name)}, ${esc(SELLER.business)}, ${esc(SELLER.address)}</td></tr><tr><td>Contact</td><td><a href="mailto:${esc(SELLER.email)}">${esc(SELLER.email)}</a>: a person answers.</td></tr></tbody></table>
<p class="muted"><small>One payment each, for companies only; delivery is done by hand at the moment. As data: <a href="/claim.json">/claim.json</a> · all prices: <a href="/pricing">/pricing</a></small></p>`;
  return page(base, '/claim', 'Claim your listing on the open sea — free claim, owner check 19 € | Mare Liberum', 'How a provider claims its listing on Mare Liberum: find it, claim it free, have the owner checked for 19 € (a check by a person; the outcome can be negative). It never changes any order and never adds a level of the verified market.', body,
    { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Claim your listing on the open sea', url: `${base}/claim`, ...(v ? { mainEntity: { '@type': 'Offer', name: v.name, price: v.priceEur, priceCurrency: 'EUR', url: `${base}/claim`, seller: { '@type': 'Organization', name: SELLER.business } } } : {}) });
}

// ------------------------------------------------------------------ /pricing
// every paid offer of the house in one table; the prices of the harbours are those their own pages name (node/seo.mjs)
export function pricingRows(base, price) {
  const rows = [
    { id: 'teams', name: 'Team harbour for coding agents', for: 'developer teams', price: '49 € a month, first month free, cancel monthly', eur: 49, unit: 'month', gets: 'ten times the room of a free harbour and a direct line: one shared, rated memory for every coding agent of the team over one MCP connection', page: '/teams' },
    { id: 'agency', name: 'Team harbour for agencies', for: 'agencies and consultancies (page in German)', price: '79 € a month per team, first month free, cancel monthly', eur: 79, unit: 'month', gets: '2,000 sources and 10 million characters instead of 200 and 1 million, the first harbour set up together, and a direct line', page: '/de/agenturen' },
    { id: 'law', name: 'Kanzlei harbour', for: 'tax and law firms (page in German)', price: '750 € setup + 990 € a year per office', eur: 750, gets: 'the knowledge store on the firm\'s own machine, set up empty without access to client data; checked updates, help by e-mail within a working day, two dates a year', page: '/de/kanzleien' },
    ...(isOpen('verified') ? [{ id: 'owner', name: OFFERS.verified.name, for: 'providers listed in the open index', price: `${priceOf(OFFERS.verified)} once, the line holds 12 months`, eur: OFFERS.verified.priceEur, gets: 'a person confirms that you control the domain and checks the listing against the live service; when it passes, the line "Owner checked" with the date. The outcome can be negative. It changes no order and adds no level of the verified market', page: '/claim' }] : []),
    ...(isOpen('report') ? [{ id: 'report', name: 'AI-visibility report', for: 'any company with a website', price: `${priceOf(OFFERS.report)} once`, eur: OFFERS.report.priceEur, gets: 'how AI agents read your site, checked by a person: up to 10 pages, every AI agent in robots.txt, three competitors, the fixes with ready files, a re-check after 14 days', page: '/offers/sample-report' }] : []),
    { id: 'route', name: 'Paid route', for: 'agents, per call', price: `${price.amount_usd} USDC per call on Base (x402), the first 3 paths free`, usdc: Number(price.amount_usd), gets: 'the 10 best paths for exactly your task, ranked with reasons; no account', page: '/pay/howto' },
    { id: 'talk', name: 'Institutions: talk to us', for: 'universities, public bodies, large companies', price: 'by agreement', gets: 'a node of your own, volume, terms and support, worked out together', page: '/about#contact' },
  ];
  return rows.map((r) => ({ ...r, go: `${base}${go(r.id, 'pricing')}`, details: `${base}${r.page}` }));
}
export function pricingJson(base, { price, paidRoute, house, savings }) {
  const per = perReuse();
  return {
    // what /pricing said before 3.33.0, for the programs that read it
    price: price.line, paid_route: paidRoute, house, free: 'everything else in the sea: the brain, the doors, the reader, the check, the map of a site', how_to_pay: `${base}/pay/howto`,
    offers: pricingRows(base, price).map(({ page: _p, ...r }) => r),
    tax: SELLER.vat, taxEn: SELLER.vatEn, contact: SELLER.email, seller: `${SELLER.name}, ${SELLER.business}, ${SELLER.address}`,
    value: { measured: savings ? { since: savings.since, reuses30days: savings.last30days?.reuses ?? 0, tokensCounted30days: savings.last30days?.tokens?.measured ?? 0, reusesAll: savings.all?.reuses ?? 0 } : null, modelledPerReuse: { tokensMid: per.tokens[1], tokensRange: [per.tokens[0], per.tokens[2]], whMid: per.wh[1], basis: `${base}/savings` }, proof: `${base}/proof`, note: 'measured counts and modelled values are kept apart; the sea\'s own calls and crawlers are never counted' },
    rule: 'Nothing pays to rank: no payment changes any order in the index, in the answers to agents or in the verified market.',
    page: `${base}/pricing`,
  };
}
export function pricingPage(base, P) {
  const rows = pricingRows(base, P.price), s = P.savings, per = perReuse();
  const tr = (r) => `<tr id="${esc(r.id)}"><td><b>${esc(r.name)}</b></td><td>${esc(r.for)}</td><td>${esc(r.price)}</td><td>${esc(r.gets)}</td><td><a class="tag" href="${esc(go(r.id, 'pricing'))}" rel="nofollow">${r.id === 'talk' ? 'Talk to us' : r.id === 'route' ? 'How to pay' : r.id === 'owner' ? 'Order the check' : r.id === 'report' ? 'Order' : 'Start'}</a> <a href="${esc(r.page)}">details</a></td></tr>`;
  const measured = s ? `Measured on the sea so far: <b>${n(s.last30days?.reuses)}</b> reuses of solved parts in the last 30 days, <b>${n(s.last30days?.tokens?.measured)}</b> tokens spared as counted (Markdown instead of HTML). ` : '';
  const body = `<p class="muted" style="margin:0"><a href="/offers">Offers</a> · every price in one place</p><h1>Prices of the open sea</h1>
<p class="pulse">The sea is free. These few things cost money, each with its own link.</p>
<p>Entering, reading, asking, answering, the <a href="/check">check</a>, the <a href="/sites">Atlas</a> and the <a href="/attention">attention counts</a> cost nothing and stay that way. A few things take a person's work or the room of this node; they are listed here with their price, for whom they are and what they bring.</p>
<table><thead><tr><th>service</th><th>for</th><th>price</th><th>what you get</th><th>link</th></tr></thead><tbody>${rows.map(tr).join('')}</tbody></table>
<p><small>${esc(SELLER.vat)} <span class="muted">(${esc(SELLER.vatEn)})</span> The prices in euro are final; the paid route is paid in USDC on Base. Institutions: write to <a href="mailto:${esc(SELLER.email)}">${esc(SELLER.email)}</a>.</small></p>
<h2>Measured, not promised</h2>
<p>${measured}The shared brain counts every answer that hands an agent a part someone already solved; what one reuse spares is modelled with every assumption sourced: about <b>${n(per.tokens[1])}</b> tokens (${n(per.tokens[0])}–${n(per.tokens[2])}) and ${per.wh[1]} Wh in the usual mix. Measured and modelled numbers stay apart. <a href="/savings">The ledger of what the brain saves</a> · <a href="/proof">how the sea proves its function</a>.</p>
<section class="box"><h3>Nothing pays to rank</h3><p>No payment changes any order: not in search results, not in the answers to agents, not in the verified market, whose open checks run the same for every shop. An owner check is named as a paid check and adds no level of the verified market, and nothing here promises reads, ranking, traffic or revenue.</p></section>
<h2>Who sells</h2><p>${esc(SELLER.name)}, ${esc(SELLER.business)}, ${esc(SELLER.address)} · <a href="mailto:${esc(SELLER.email)}">${esc(SELLER.email)}</a> · <a href="/impressum">Impressum</a></p>
<p class="muted"><small>For agents: <a href="/pricing.json">/pricing.json</a> (the price of the paid route, the house's services and this table) · as Markdown: <a href="/pricing.md">/pricing.md</a> · <a href="/offers">the offers in detail</a> · <a href="/claim">claim a listing</a>. An agent acting for a person shows the price and asks before it follows a payment link.</small></p>`;
  const catalog = rows.filter((r) => r.eur || r.usdc).map((r) => ({ '@type': 'Offer', name: r.name, url: `${base}/pricing#${r.id}`, ...(r.usdc ? { price: r.usdc, priceCurrency: 'USDC' } : { price: r.eur, priceCurrency: 'EUR' }), ...(r.unit ? { priceSpecification: { '@type': 'UnitPriceSpecification', price: r.eur, priceCurrency: 'EUR', unitText: r.unit } } : {}), seller: { '@type': 'Organization', name: SELLER.business } }));
  return page(base, '/pricing', 'What costs money on the open sea — every price of Mare Liberum in one table', 'The sea is free. Every paid service of Mare Liberum in one table: team harbours 49 € and 79 € a month, Kanzlei harbour, verified listing 19 €, AI-visibility report 29 €, the paid route in USDC, institutions by agreement.', body,
    { '@context': 'https://schema.org', '@type': 'OfferCatalog', name: 'Prices of Mare Liberum', url: `${base}/pricing`, itemListElement: catalog });
}

// ------------------------------------------------------------------ /license.xml: the license robots.txt names (RSL 1.0)
// What the sea publishes may be read by machines for anything — search, AI input, AI training, AI indexes — free, with
// credit to Mare Liberum and a link (CC BY 4.0). RSL lets a site say so to crawlers (https://rslstandard.org/rsl): a
// <permits> element allows only what it lists, so it lists "all", and nothing turns a crawler away.
export function licenseXml(base) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Mare Liberum: the license of what this site publishes, for machines (RSL 1.0, https://rslstandard.org/rsl).
     Every automated use is welcome (search, AI input, AI training, AI indexes), free, with credit to Mare Liberum and a link. -->
<rsl xmlns="https://rslstandard.org/rsl">
  <content url="/">
    <license>
      <permits type="usage">all</permits>
      <payment type="attribution">
        <standard>https://creativecommons.org/licenses/by/4.0/</standard>
      </payment>
    </license>
    <copyright type="organization" contactEmail="${esc(SELLER.email)}" contactUrl="${esc(base)}/about">Mare Liberum</copyright>
  </content>
</rsl>
`;
}
