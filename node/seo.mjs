// Mare Liberum · the pages people and agents search for.
// Every page here answers one real search: a free MCP server, a directory of MCP servers by topic, how AI agents see a website,
// a web page as Markdown, which AI crawlers come, how a company puts agents to work. English and German, with hreflang.
import { page, esc } from './pages.mjs';
import { reportBox, go } from './offers.mjs';

const pathOf = (id) => `/e/${encodeURIComponent(String(id).replace(/^urn:air:/, '')).replace(/%3A/gi, ':')}`;
const fmt = (n) => Number(n || 0).toLocaleString('en-US');
const fmtDe = (n) => Number(n || 0).toLocaleString('de-DE');
const faqLd = (qa) => ({ '@type': 'FAQPage', mainEntity: qa.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) });
const faqHtml = (qa, h = 'Questions') => `<h2>${esc(h)}</h2>${qa.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join('')}`;
const crumbs = (base, items) => ({ '@type': 'BreadcrumbList', itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: `${base}${path}` })) });
const graph = (...g) => ({ '@context': 'https://schema.org', '@graph': g.filter(Boolean) });
export const ORG = (base) => ({ '@type': 'Organization', '@id': `${base}/#org`, name: 'Mare Liberum', url: `${base}/`, logo: `${base}/icon-512.png`, sameAs: ['https://github.com/daoudandiaye98-alt/mare-liberum'], parentOrganization: { '@type': 'Organization', name: 'Oroboros Design', address: { '@type': 'PostalAddress', addressLocality: 'Köln', addressCountry: 'DE' } }, email: 'oroborosdesign@gmail.com' });
export const APP = (base) => ({ '@type': 'SoftwareApplication', '@id': `${base}/#app`, name: 'Mare Liberum', applicationCategory: 'DeveloperApplication', operatingSystem: 'Any (remote MCP, HTTPS); self-hosted on Node.js 22', url: `${base}/`, offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' }, isAccessibleForFree: true, license: 'https://opensource.org/licenses/MIT', publisher: { '@id': `${base}/#org` }, featureList: ['Remote MCP server without account or API key', 'Web page to Markdown reader that follows robots.txt', 'AI visibility check for any website', 'Directory of 84,000 MCP servers, A2A agents and x402 APIs', 'Task briefs and draft reviews for 61 kinds of work', 'Persistent agent memory', 'Private harbours for teams with source-bound answers', 'Agent builder with blueprints'] });
const LANG = { en: { de: 'Deutsch' }, de: { en: 'English' } };
const switchTo = (lang, other) => `<p class="muted" style="margin:0"><small><a href="${esc(other)}" hreflang="${lang === 'en' ? 'de' : 'en'}">${lang === 'en' ? 'Deutsch' : 'English'}</a></small></p>`;
const connect = (url = 'https://mareliberum.dev/mcp') => `<pre>Claude Code
claude mcp add --transport http mare-liberum ${url}

Cursor · ~/.cursor/mcp.json
{ "mcpServers": { "mare-liberum": { "url": "${url}" } } }

VS Code · .vscode/mcp.json
{ "servers": { "mare-liberum": { "type": "http", "url": "${url}" } } }

Claude, ChatGPT and other apps: add ${url} as a custom connector.</pre>`;
const connectDe = (url = 'https://mareliberum.dev/mcp') => `<pre>Claude Code
claude mcp add --transport http mare-liberum ${url}

Cursor · ~/.cursor/mcp.json
{ "mcpServers": { "mare-liberum": { "url": "${url}" } } }

VS Code · .vscode/mcp.json
{ "servers": { "mare-liberum": { "type": "http", "url": "${url}" } } }

Claude, ChatGPT und andere Apps: ${url} als eigenen Connector hinzufügen.</pre>`;

// ── The directory of MCP servers, by topic ──
// [slug, name, search words, one sentence on what such servers do]
export const MCP_TOPICS = [
  ['github', 'GitHub', 'github', 'read repositories, issues and pull requests, and open or review them from the agent'],
  ['gitlab', 'GitLab', 'gitlab', 'work with GitLab projects, merge requests and pipelines'],
  ['git', 'Git', 'git repository commit', 'read history, diffs and branches of a local repository'],
  ['postgres', 'PostgreSQL', 'postgres postgresql', 'query a PostgreSQL database, inspect its schema and explain plans'],
  ['mysql', 'MySQL', 'mysql mariadb', 'query MySQL and MariaDB databases'],
  ['sqlite', 'SQLite', 'sqlite', 'open a SQLite file and query it'],
  ['mongodb', 'MongoDB', 'mongodb mongo', 'query MongoDB collections and aggregations'],
  ['redis', 'Redis', 'redis', 'read and write keys in Redis'],
  ['supabase', 'Supabase', 'supabase', 'manage Supabase projects, tables and edge functions'],
  ['vector-database', 'vector database', 'vector embeddings qdrant pinecone weaviate chroma pgvector', 'store and search embeddings for retrieval'],
  ['rag', 'RAG and knowledge base', 'rag retrieval knowledge base documents', 'answer from your own documents with retrieval'],
  ['memory', 'memory', 'memory persistent long-term', 'give an agent a memory that survives sessions'],
  ['filesystem', 'filesystem', 'filesystem files directory', 'read and write files in folders you allow'],
  ['browser', 'browser automation', 'browser playwright puppeteer selenium', 'drive a real browser: open pages, click, fill forms, take screenshots'],
  ['web-search', 'web search', 'web search engine', 'search the web and return results to the agent'],
  ['web-scraping', 'web scraping', 'scrape scraping crawl crawler', 'fetch and extract content from web pages'],
  ['slack', 'Slack', 'slack', 'read channels and post messages in Slack'],
  ['discord', 'Discord', 'discord', 'read and send Discord messages'],
  ['telegram', 'Telegram', 'telegram', 'send and read Telegram messages'],
  ['email', 'email and Gmail', 'email gmail imap smtp', 'read, search and draft email'],
  ['calendar', 'calendar', 'calendar google-calendar outlook', 'read and create calendar events'],
  ['notion', 'Notion', 'notion', 'search, read and write Notion pages and databases'],
  ['google-drive', 'Google Drive and Docs', 'google drive docs sheets', 'find and read files in Google Drive, Docs and Sheets'],
  ['obsidian', 'Obsidian', 'obsidian markdown notes vault', 'read and write notes in an Obsidian vault'],
  ['jira', 'Jira and Confluence', 'jira confluence atlassian', 'work with Jira issues and Confluence pages'],
  ['linear', 'Linear', 'linear issues', 'create and update Linear issues'],
  ['figma', 'Figma', 'figma design', 'read Figma designs and turn them into code'],
  ['docker', 'Docker', 'docker container', 'run and inspect Docker containers'],
  ['kubernetes', 'Kubernetes', 'kubernetes k8s kubectl', 'inspect and manage Kubernetes clusters'],
  ['aws', 'AWS', 'aws amazon s3 lambda', 'work with AWS services'],
  ['azure', 'Azure', 'azure microsoft', 'work with Microsoft Azure resources'],
  ['cloudflare', 'Cloudflare', 'cloudflare workers', 'manage Cloudflare Workers, DNS and storage'],
  ['vercel', 'Vercel', 'vercel deployment', 'deploy and inspect Vercel projects'],
  ['sentry', 'Sentry and error monitoring', 'sentry errors monitoring', 'read errors and traces from monitoring'],
  ['stripe', 'Stripe', 'stripe payments', 'read and create payments, customers and invoices in Stripe'],
  ['shopify', 'Shopify', 'shopify ecommerce store', 'manage products and orders of a Shopify store'],
  ['ecommerce', 'shopping and e-commerce', 'shopping ecommerce products checkout', 'find products, prices and checkout links'],
  ['hubspot', 'HubSpot and CRM', 'hubspot crm salesforce', 'read and update contacts and deals in a CRM'],
  ['airtable', 'Airtable', 'airtable', 'read and write Airtable bases'],
  ['excel', 'Excel and spreadsheets', 'excel spreadsheet csv xlsx', 'read and write spreadsheets'],
  ['pdf', 'PDF', 'pdf document', 'read, split and fill PDF files'],
  ['youtube', 'YouTube', 'youtube video transcript', 'get transcripts and data of YouTube videos'],
  ['image-generation', 'image generation', 'image generation stable diffusion dall-e flux', 'create images from text'],
  ['translation', 'translation', 'translate translation deepl', 'translate text between languages'],
  ['maps', 'maps and location', 'maps location geocoding places', 'look up places, routes and coordinates'],
  ['weather', 'weather', 'weather forecast', 'get current weather and forecasts'],
  ['finance', 'finance and stocks', 'finance stock market trading', 'get stock prices, market data and financial reports'],
  ['crypto', 'crypto and blockchain', 'crypto blockchain ethereum solana wallet', 'read chain data and work with wallets and tokens'],
  ['x402', 'x402 payments', 'x402 payment usdc', 'pay per call with x402 or offer paid tools'],
  ['security', 'security', 'security vulnerability cve scan', 'scan for vulnerabilities and look up CVEs'],
  ['seo', 'SEO and analytics', 'seo analytics search-console', 'read search rankings, analytics and SEO data'],
  ['research', 'research papers', 'arxiv research papers pubmed scholar', 'search and read research papers'],
  ['home-assistant', 'Home Assistant', 'home-assistant smart home', 'control and read a smart home'],
  ['n8n', 'n8n and Zapier automation', 'n8n zapier automation workflow', 'start and build automation workflows'],
  ['wordpress', 'WordPress', 'wordpress cms', 'write and manage WordPress content'],
];
const topicOf = (slug) => MCP_TOPICS.find((t) => t[0] === slug);
const cap = (x) => String(x).charAt(0).toUpperCase() + String(x).slice(1);
const kindOf = (e) => {
  const eps = e?.metadata?.endpoints || [];
  if (eps.some((x) => /http|sse|streamable/i.test(x.transport || ''))) return 'remote';
  if (eps.some((x) => x.transport === 'package')) return 'local package';
  return '';
};
const repoOf = (e) => (e?.metadata?.endpoints || []).find((x) => x.transport === 'repository')?.url || '';
const entryRow = (e) => {
  const k = kindOf(e), repo = repoOf(e), when = String(e.updatedAt || '').slice(0, 10);
  const meta = [repo ? `<a href="${esc(repo)}" rel="nofollow noopener">source</a>` : '', e.url && e.url !== repo ? `<a href="${esc(e.url)}" rel="nofollow noopener">listing</a>` : '', when ? `updated ${esc(when)}` : ''].filter(Boolean).join(' · ');
  return `<tr><td><a href="${esc(pathOf(e.identifier))}">${esc(e.displayName || e.identifier)}</a>${k ? ` <span class="tag">${esc(k)}</span>` : ''}<br><small class="muted">${esc(String(e.description || '').slice(0, 220))}</small>${meta ? `<br><small>${meta}</small>` : ''}</td></tr>`;
};

export function mcpHubPage(base, { count, q, results }) {
  const qa = [
    ['What is an MCP server?', 'A server that speaks the Model Context Protocol, the open standard with which AI assistants like Claude, ChatGPT, Cursor and VS Code call tools. An MCP server for GitHub lets the assistant read issues; one for PostgreSQL lets it query a database.'],
    ['Where does this directory come from?', `From the official MCP Registry, npm and other open registries, read again every day. ${fmt(count)} MCP servers are in it today, each with its listing, source and last update.`],
    ['Remote or local — what is the difference?', 'A remote MCP server runs at an address on the internet; you add the URL and it works. A local package runs on your own machine, usually started with npx or uvx.'],
    ['How do I add my MCP server?', 'Publish it in the official MCP Registry (registry.modelcontextprotocol.io). Mare Liberum reads the registry every day; your server appears here on its own.'],
    ['Is there a free MCP server I can try right now?', 'Yes: Mare Liberum itself, at https://mareliberum.dev/mcp. No account, no key: a web reader, an AI visibility check, this directory, task briefs and a memory.'],
  ];
  const body = `<h1>MCP server directory</h1>
<p style="font-size:1.15rem">${fmt(count)} MCP servers for Claude, ChatGPT, Cursor and every assistant that speaks the Model Context Protocol, from the official registry, npm and open sources, read again every day. Search by what you need, or pick a topic.</p>
<form class="row" action="/mcp-servers" method="get" role="search"><input name="q" value="${esc(q || '')}" placeholder="e.g. postgres, github, browser, memory" style="padding:10px;border-radius:8px;border:1px solid #2a5a80;background:#0a1c2e;color:#eaf4ff"> <button style="padding:10px 16px;border-radius:8px">Search</button></form>
${q ? `<h2>MCP servers for “${esc(q)}”</h2>${results?.length ? `<table><tbody>${results.map(entryRow).join('')}</tbody></table>` : '<p>Nothing found. Try a shorter word.</p>'}` : ''}
<h2>MCP servers by topic</h2>
<p>${MCP_TOPICS.map(([s, n]) => `<a class="tag" href="/mcp-servers/${s}">${esc(n)}</a>`).join(' ')}</p>
<h2>Connect a free MCP server in one line</h2>
<p>Mare Liberum is an MCP server too: read any page as Markdown, check how AI agents see a website, search this directory from inside your assistant. <a href="/mcp-server">More on the free MCP server</a>.</p>
${connect()}
${faqHtml(qa)}
<p class="muted"><small>For agents: <code>GET ${esc(base)}/search?q=&lt;words&gt;&amp;kind=mcp</code> (JSON) · MCP tool <code>search</code>. Also: <a href="/a2a-agents">A2A agents</a> · <a href="/x402-apis">x402 APIs</a>.</small></p>`;
  return page(base, q ? `/mcp-servers?q=${encodeURIComponent(q)}` : '/mcp-servers', q ? `MCP servers for “${q}” · Mare Liberum directory` : `MCP Server Directory — ${fmt(count)} MCP servers by topic · Mare Liberum`, `Search ${fmt(count)} MCP servers for Claude, ChatGPT, Cursor and VS Code: GitHub, PostgreSQL, Slack, Notion, browser automation, memory and more. Free, updated daily, from the official MCP Registry.`, body,
    graph(ORG(base), crumbs(base, [['Mare Liberum', '/'], ['MCP servers', '/mcp-servers']]), faqLd(qa), { '@type': 'CollectionPage', name: 'MCP server directory', url: `${base}/mcp-servers`, about: 'Model Context Protocol servers' }), '/og.png', q ? { robots: 'noindex, follow' } : {});
}

export function mcpTopicPage(base, slug, results, count) {
  const t = topicOf(slug); if (!t) return null;
  const [, name, , does] = t, n = results.length;
  const remote = results.filter((e) => kindOf(e) === 'remote').length;
  const qa = [
    [`What does a ${name} MCP server do?`, `It lets an AI assistant ${does}, through the Model Context Protocol. You add it to Claude, ChatGPT, Cursor or VS Code once; then the assistant calls it when a task needs it.`],
    [`How do I install a ${name} MCP server?`, 'A remote server: add its URL as a connector (Claude, ChatGPT) or in mcp.json (Cursor, VS Code). A local package: add the command from its listing, usually npx or uvx, to the same file. Each entry below links its source and listing.'],
    ['Are these servers checked?', 'They are listed as their makers published them in open registries. Mare Liberum shows where each entry comes from and when it changed; read the source before you give a server access to your data.'],
  ];
  const related = MCP_TOPICS.filter((x) => x[0] !== slug).sort((a, b) => ((a[0].charCodeAt(0) * 7 + slug.length) % 11) - ((b[0].charCodeAt(0) * 7 + slug.length) % 11)).slice(0, 12);
  const body = `<p class="muted" style="margin:0"><a href="/mcp-servers">MCP server directory</a></p>
<h1>${esc(cap(name))} MCP servers</h1>
<p style="font-size:1.15rem">${n ? `The ${n} closest MCP servers` : 'MCP servers'} that let Claude, ChatGPT, Cursor and other assistants ${esc(does)}${remote ? `; ${remote} of them run remotely, nothing to install` : ''}. From the official MCP Registry, npm and other open sources, out of ${fmt(count)} in the directory.</p>
${n ? `<table><tbody>${results.map(entryRow).join('')}</tbody></table>` : '<p>None right now. The directory is read again every day.</p>'}
<h2>Add an MCP server to your assistant</h2>
<p>For a remote server, the URL is all it takes. This is how it looks with Mare Liberum, a free MCP server without account:</p>
${connect()}
${faqHtml(qa)}
<h2>More topics</h2>
<p>${related.map(([s, nm]) => `<a class="tag" href="/mcp-servers/${s}">${esc(nm)}</a>`).join(' ')}</p>`;
  return page(base, `/mcp-servers/${slug}`, `${cap(name)} MCP Servers — for Claude, ChatGPT, Cursor · Mare Liberum`, `${cap(name)} MCP servers that let AI assistants ${does}. Compare remote and local servers with source, listing and last update. Free directory, updated daily.`, body,
    graph(ORG(base), crumbs(base, [['Mare Liberum', '/'], ['MCP servers', '/mcp-servers'], [cap(name), `/mcp-servers/${slug}`]]), faqLd(qa), { '@type': 'ItemList', name: `${cap(name)} MCP servers`, numberOfItems: n, itemListElement: results.slice(0, 30).map((e, i) => ({ '@type': 'ListItem', position: i + 1, name: e.displayName || e.identifier, url: `${base}${pathOf(e.identifier)}` })) }));
}

export function kindHubPage(base, kind, results, count) {
  const a2a = kind === 'a2a';
  const name = a2a ? 'A2A agents' : 'x402 APIs', path = a2a ? '/a2a-agents' : '/x402-apis';
  const intro = a2a
    ? 'Agents that speak the Agent2Agent protocol (A2A): each publishes an agent card that says what it can do and where to reach it, so other agents can hand it tasks.'
    : 'APIs that take payment per call with x402: the server answers HTTP 402 with a price, the agent pays in stablecoin and calls again. No account, no API key.';
  const qa = a2a
    ? [['What is A2A?', 'Agent2Agent is an open protocol with which agents find each other through an agent card (/.well-known/agent-card.json) and exchange tasks and results.'], ['How do I list my A2A agent?', 'Publish your agent card at /.well-known/agent-card.json and register it in an open A2A registry; Mare Liberum reads them every day.']]
    : [['What is x402?', 'An open payment standard on top of HTTP: a server answers 402 Payment Required with a price; the client pays, usually in USDC, and repeats the request with proof of payment.'], ['Does Mare Liberum take payments?', 'No. It lists paid APIs so agents can find them; it never takes or holds money.']];
  const body = `<p class="muted" style="margin:0"><a href="/mcp-servers">Directory</a></p><h1>${esc(name)}</h1>
<p style="font-size:1.15rem">${fmt(count)} ${esc(name)} in the open index of Mare Liberum. ${esc(intro)}</p>
<table><tbody>${results.map(entryRow).join('')}</tbody></table>
${faqHtml(qa)}
<p class="muted"><small>For agents: <code>GET ${esc(base)}/search?q=&lt;words&gt;&amp;kind=${a2a ? 'a2a' : 'x402'}</code> · <a href="/mcp-servers">MCP servers</a> · <a href="${a2a ? '/x402-apis' : '/a2a-agents'}">${a2a ? 'x402 APIs' : 'A2A agents'}</a></small></p>`;
  return page(base, path, `${a2a ? 'A2A agents directory' : 'x402 services directory'} — ${fmt(count)} ${a2a ? 'agents with agent cards' : 'pay-per-call APIs'} · Mare Liberum`, `${fmt(count)} ${a2a ? 'A2A agents' : 'x402 services and APIs'} in an open, free directory, updated daily: ${a2a ? 'agent cards, skills and endpoints of Agent2Agent agents' : 'what each paid service does, its price per call and its endpoint. No account'}.`, body,
    graph(ORG(base), crumbs(base, [['Mare Liberum', '/'], [name, path]]), faqLd(qa)));
}

// ── The free MCP server ──
export function mcpServerPage(base, lang, stats) {
  const de = lang === 'de', path = de ? '/de/mcp-server' : '/mcp-server', other = de ? '/mcp-server' : '/de/mcp-server';
  const mcp = fmt(stats?.byKind?.mcp || 84000), mcpDe = fmtDe(stats?.byKind?.mcp || 84000);
  const qa = de ? [
    ['Ist der MCP-Server wirklich kostenlos?', 'Ja. Kein Konto, kein API-Schlüssel, keine Zahlung. Faire Nutzung: 100 gelesene Seiten am Tag und 20 Website-Prüfungen in der Stunde je Netzadresse.'],
    ['Mit welchen Programmen funktioniert er?', 'Mit allen, die MCP über HTTP sprechen: Claude (App, Desktop, Code), ChatGPT, Cursor, VS Code, Windsurf, n8n und eigene Agenten. Ohne MCP gehen dieselben Werkzeuge über A2A und einfache HTTPS-Abrufe.'],
    ['Kann ich ihn selbst betreiben?', 'Ja. Der ganze Server ist ein Programm unter MIT-Lizenz; unter /download liegt das Paket für Node.js 22 und Docker.'],
    ['Was passiert mit meinen Daten?', 'Es gibt keine Konten. Gelesene Seiten werden als Daten zurückgegeben, nie als Anweisungen. Der öffentliche Knoten läuft auf einem Server in der EU (Hetzner, Helsinki).'],
  ] : [
    ['Is this MCP server really free?', 'Yes. No account, no API key, no payment. Fair use: 100 page reads a day and 20 site checks an hour per network address.'],
    ['Which clients does it work with?', 'Every client that speaks MCP over HTTP: Claude (app, desktop, Claude Code), ChatGPT, Cursor, VS Code, Windsurf, n8n and your own agents. Without MCP, the same tools answer over A2A and plain HTTPS GET.'],
    ['Can I host it myself?', 'Yes. The whole server is one program under the MIT licence; /download has the package for Node.js 22 and Docker.'],
    ['What happens to my data?', 'There are no accounts. Pages are returned as data, never as instructions. The public node runs on a server in the EU (Hetzner, Helsinki).'],
  ];
  const tools = de ? [
    ['read_page', 'liest jede öffentliche Webseite als sauberes Markdown und hält sich an robots.txt'],
    ['check_site', 'zeigt, wie ChatGPT, Claude, Perplexity und Google eine Website sehen, mit Note und Korrekturen'],
    ['search, get', `durchsucht ${mcpDe} MCP-Server, A2A-Agenten, x402-APIs und Shops`],
    ['brief, review', 'macht aus einer Ein-Zeilen-Aufgabe einen vollständigen Auftrag und prüft den Entwurf vor der Abgabe (61 Arten von Arbeit, jede Sprache)'],
    ['think, lay_path, rate_path', 'Wege, die andere Agenten für dieselbe Aufgabe bestätigt haben'],
    ['mind_new, mind, mind_add', 'ein privates Gedächtnis, das jede Sitzung überdauert'],
    ['site, find, route', 'wie ein Agent eine Website nutzt: Suchlink, Bereiche, Feeds, Formulare, offene APIs'],
    ['ask, decide', 'ein Kaufvorschlag mit Preis und dem Link zur Kasse des Händlers; bezahlt wird beim Händler'],
  ] : [
    ['read_page', 'reads any public web page as clean Markdown and follows robots.txt'],
    ['check_site', 'shows how ChatGPT, Claude, Perplexity and Google see a website, with a score and plain fixes'],
    ['search, get', `searches ${mcp} MCP servers, A2A agents, x402 APIs and stores`],
    ['brief, review', 'turns a one-line task into a complete brief and checks the draft before it is handed over (61 kinds of work, any language)'],
    ['think, lay_path, rate_path', 'ways other agents confirmed for the same task'],
    ['mind_new, mind, mind_add', 'a private memory that survives every session'],
    ['site, find, route', 'how an agent uses a website: search link, sections, feeds, forms, open APIs'],
    ['ask, decide', 'one buying pick with price and the merchant’s own checkout link; payment happens at the merchant'],
  ];
  const body = `${switchTo(lang, other)}<h1>${de ? 'Kostenloser MCP-Server für KI-Agenten' : 'Free MCP server for AI agents'}</h1>
<p style="font-size:1.15rem">${de ? 'Ein MCP-Server für Claude, ChatGPT, Cursor und VS Code, der ohne Konto und ohne API-Schlüssel läuft. Eine Adresse eintragen, fertig:' : 'One remote MCP server for Claude, ChatGPT, Cursor and VS Code that needs no account and no API key. Add one address and you are done:'} <code>https://mareliberum.dev/mcp</code></p>
${de ? connectDe() : connect()}
<h2>${de ? 'Was Ihr Agent damit kann' : 'What your agent gets'}</h2>
<table><tbody>${tools.map(([n, d]) => `<tr><td><code>${esc(n)}</code></td><td>${esc(d)}</td></tr>`).join('')}</tbody></table>
<p>${de ? 'Zwei Türen: <code>/mcp</code> mit allen 53 Werkzeugen, <code>/mcp/app</code> mit den 14 für Assistenten. Dieselben Werkzeuge antworten über A2A (<code>/a2a</code>) und als einfache HTTPS-Abrufe (<a href="/openapi.json">OpenAPI</a>).' : 'Two doors: <code>/mcp</code> with all 53 tools, <code>/mcp/app</code> with the 14 for assistants. The same tools answer over A2A (<code>/a2a</code>) and plain HTTPS GET (<a href="/openapi.json">OpenAPI</a>).'} ${de ? '<a href="/use">Alle Beispiele für Python, LangChain, CrewAI, LlamaIndex und das Vercel AI SDK</a>.' : '<a href="/use">All examples for Python, LangChain, CrewAI, LlamaIndex and the Vercel AI SDK</a>.'}</p>
${faqHtml(qa, de ? 'Fragen' : 'Questions')}
<p>${de ? 'Weiter:' : 'More:'} <a href="${de ? '/de/unternehmen' : '/business'}">${de ? 'Für Unternehmen' : 'For companies'}</a> · <a href="/mcp-servers">${de ? 'Verzeichnis der MCP-Server' : 'MCP server directory'}</a> · <a href="${de ? '/de/ki-sichtbarkeit' : '/check'}">${de ? 'KI-Sichtbarkeit prüfen' : 'AI visibility check'}</a></p>`;
  return page(base, path, de ? 'Kostenloser MCP-Server ohne API-Schlüssel — für Claude, ChatGPT, Cursor · Mare Liberum' : 'Free MCP Server — no account, no API key · Claude, ChatGPT, Cursor · Mare Liberum',
    de ? `Remote-MCP-Server ohne Konto: Webseiten als Markdown lesen, KI-Sichtbarkeit prüfen, ${mcpDe} MCP-Server durchsuchen, Gedächtnis für Agenten. Eine URL in Claude, ChatGPT, Cursor oder VS Code eintragen.` : `Remote MCP server without account: read any web page as Markdown, check how AI agents see a site, search ${mcp} MCP servers, agent memory. Add one URL to Claude, ChatGPT, Cursor or VS Code.`,
    body, graph(ORG(base), APP(base), crumbs(base, [['Mare Liberum', de ? '/de' : '/'], [de ? 'MCP-Server' : 'MCP server', path]]), faqLd(qa)), '/og.png', { lang, alt: { en: '/mcp-server', de: '/de/mcp-server' } });
}

// ── A web page as Markdown ──
export function markdownPage(base, lang) {
  const de = lang === 'de', path = de ? '/de/webseite-als-markdown' : '/web-to-markdown', other = de ? '/web-to-markdown' : '/de/webseite-als-markdown';
  const qa = de ? [
    ['Brauche ich einen API-Schlüssel?', 'Nein. Die Adresse der Seite hinter /r/ setzen und abrufen. 100 Seiten am Tag je Netzadresse sind frei.'],
    ['Hält sich der Leser an robots.txt?', 'Ja. Was eine Website für Agenten sperrt, liest er nicht, und er sagt das.'],
    ['Warum Markdown statt HTML?', 'Ein Sprachmodell braucht den Text, nicht Menüs, Skripte und Werbung. Markdown spart meist den größten Teil der Token und behält Überschriften, Listen, Tabellen und Links.'],
  ] : [
    ['Do I need an API key?', 'No. Put the page address after /r/ and fetch it. 100 pages a day per network address are free.'],
    ['Does the reader respect robots.txt?', 'Yes. What a site closes to agents it does not read, and it says so.'],
    ['Why Markdown instead of HTML?', 'A language model needs the text, not menus, scripts and ads. Markdown usually saves most of the tokens and keeps headings, lists, tables and links.'],
  ];
  const body = `${switchTo(lang, other)}<h1>${de ? 'Webseite als Markdown — für LLMs und Agenten' : 'Web page to Markdown — for LLMs and agents'}</h1>
<p style="font-size:1.15rem">${de ? 'Jede öffentliche Webseite als sauberes Markdown: Haupttext, Überschriften, Tabellen und Links, ohne Menüs und Skripte. Kostenlos, ohne Schlüssel, für Menschen, Programme und KI-Agenten.' : 'Any public web page as clean Markdown: main text, headings, tables and links, without menus and scripts. Free, no key, for people, programs and AI agents.'}</p>
<pre>curl https://mareliberum.dev/r/https://example.com</pre>
<form class="row" onsubmit="location.href='/r/'+this.u.value;return false" style="margin:12px 0"><input name="u" type="url" required placeholder="https://…" style="padding:10px;border-radius:8px;border:1px solid #2a5a80;background:#0a1c2e;color:#eaf4ff"> <button style="padding:10px 16px;border-radius:8px">${de ? 'Als Markdown lesen' : 'Read as Markdown'}</button></form>
<h2>${de ? 'In Ihrem Code' : 'In your code'}</h2>
<pre>Python
import requests
md = requests.get("https://mareliberum.dev/r/" + url, timeout=30).text

JavaScript
const md = await (await fetch(\`https://mareliberum.dev/r/\${url}\`)).text();

MCP (Claude, ChatGPT, Cursor): ${de ? 'Werkzeug' : 'tool'} read_page · https://mareliberum.dev/mcp</pre>
${faqHtml(qa, de ? 'Fragen' : 'Questions')}
<p>${de ? 'Weiter:' : 'More:'} <a href="${de ? '/de/mcp-server' : '/mcp-server'}">${de ? 'der kostenlose MCP-Server' : 'the free MCP server'}</a> · <a href="${de ? '/de/ki-sichtbarkeit' : '/check'}">${de ? 'Sehen KI-Agenten Ihre Website?' : 'Can AI agents see your site?'}</a></p>`;
  return page(base, path, de ? 'Webseite als Markdown — kostenlose API ohne Schlüssel für LLMs · Mare Liberum' : 'Web Page to Markdown API — free, no key, for LLMs and AI agents · Mare Liberum',
    de ? 'Jede öffentliche Webseite als sauberes Markdown für Sprachmodelle und Agenten: Haupttext, Tabellen, Links. Kostenlos, ohne Konto, hält sich an robots.txt. Per URL, Python, JavaScript oder MCP.' : 'Turn any public web page into clean Markdown for LLMs and AI agents: main text, tables, links. Free, no account, respects robots.txt. Via URL, Python, JavaScript or MCP.',
    body, graph(ORG(base), crumbs(base, [['Mare Liberum', de ? '/de' : '/'], [de ? 'Webseite als Markdown' : 'Web page to Markdown', path]]), faqLd(qa), { '@type': 'WebApplication', name: de ? 'Webseite als Markdown' : 'Web page to Markdown', url: `${base}${path}`, applicationCategory: 'DeveloperApplication', isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' } }), '/og.png', { lang, alt: { en: '/web-to-markdown', de: '/de/webseite-als-markdown' } });
}

// ── For companies ──
export function businessPage(base, lang) {
  const de = lang === 'de', path = de ? '/de/unternehmen' : '/business', other = de ? '/business' : '/de/unternehmen';
  const qa = de ? [
    ['Müssen wir eine eigene KI bauen?', 'Nein. Ihr Team arbeitet weiter mit Claude, ChatGPT, Cursor oder eigenen Agenten. Der Hafen wird als Connector hinzugefügt; jedes Modell bekommt dann Ihren Rahmen, Ihre Quellen und Ihre Wege.'],
    ['Welche Modelle gehen?', 'Jedes, das MCP oder HTTPS spricht. Die Agenten aus der Werft laufen mit Claude, einem OpenAI-kompatiblen Dienst oder lokal über Ollama.'],
    ['Wo liegen unsere Daten?', 'Beim eigenen Knoten auf Ihrem Rechner oder Server, im Ordner state/. Der öffentliche Knoten läuft in der EU (Hetzner, Helsinki); was ein Hafen enthält, geht nicht ins offene Meer, nicht in den Zensus und nicht in den Index.'],
    ['Was kostet es?', 'Der Code steht unter MIT-Lizenz; den eigenen Knoten betreiben Sie ohne Gebühr, und ein Hafen mit 200 Quellen ist hier frei. Mehr Raum und Einrichtung für ein Team gibt es als Pilot ab 49 € im Monat: /de/agenturen und /teams. Kanzleien: /de/kanzleien.'],
  ] : [
    ['Do we have to build our own AI?', 'No. Your team keeps using Claude, ChatGPT, Cursor or its own agents. The harbour is added as a connector; every model then gets your frame, your sources and your ways.'],
    ['Which models work?', 'Any that speaks MCP or HTTPS. Agents from the shipyard run with Claude, an OpenAI-compatible service, or locally through Ollama.'],
    ['Where is our data?', 'With your own node, on your machine or server, in the folder state/. The public node runs in the EU (Hetzner, Helsinki); what a harbour holds never enters the open sea, the census or the index.'],
    ['What does it cost?', 'The code is MIT licensed; you run your own node without a fee, and a harbour with 200 sources is free here. More room and setup for a team is a pilot from 49 € a month: /teams, and in German /de/agenturen.'],
  ];
  const parts = de ? [
    ['Der Hafen', '/harbour', 'Ein privater Raum für ein Team: ein Rahmen, an den sich jedes Modell hält, freigegebene Quellen, aus denen Antworten mit Quellenangabe kommen, und ein Entwurf, der Satz für Satz gegen die Quellen gehalten wird. Drei Schlüssel: Inhaber, Crew, Gast.'],
    ['Die Werft', '/yard', 'Agenten aus Vorlagen bauen: quellengebundene Antworten, Recherche, Kundensupport, Einkauf, Monitoring, Analyse, Betrieb. Als ein kleines Programm mitnehmen, weiterprogrammieren, im eigenen Haus betreiben.'],
    ['Der eigene Knoten', '/download', 'Mare Liberum als ein Programm ohne Abhängigkeiten auf Ihrem Server: Node.js 22 oder Docker, Zustand auf Ihrer Platte, MIT-Lizenz.'],
    ['Briefs und Review', '/briefs', 'Für 61 Arten von Arbeit: was eine Anfrage offen lässt, die Methode, die Qualitätslatte und die Prüfung des Entwurfs vor der Abgabe. Hebt den Durchschnitt jeder Agentenarbeit.'],
    ['Offene Werkzeuge', '/de/mcp-server', 'Webseiten als Markdown, KI-Sichtbarkeit jeder Website, ein Verzeichnis mit über 84.000 MCP-Servern, A2A-Agenten und x402-APIs.'],
  ] : [
    ['The harbour', '/harbour', 'A private space for one team: a frame every model keeps to, approved sources answers come from with the source named, and a draft held against the sources sentence by sentence. Three keys: owner, crew, guest.'],
    ['The shipyard', '/yard', 'Build agents from blueprints: source-bound answers, research, customer support, buying, monitoring, analysis, operations. Take one home as a small program, extend it, run it in-house.'],
    ['Your own node', '/download', 'Mare Liberum as one program without dependencies on your server: Node.js 22 or Docker, state on your disk, MIT licence.'],
    ['Briefs and review', '/briefs', 'For 61 kinds of work: what a request leaves open, the method, the quality bar, and a check of the draft before it is handed over. Raises the average of every agent’s work.'],
    ['Open tools', '/mcp-server', 'Web pages as Markdown, the AI visibility of any website, a directory of 84,000+ MCP servers, A2A agents and x402 APIs.'],
  ];
  const steps = de ? ['Einen Hafen öffnen — hier unter /harbour oder auf dem eigenen Knoten.', 'Freigegebenes Wissen hineinlegen: Handbücher, Richtlinien, Produktdaten, jede Quelle mit Angabe.', 'Den Hafen in Claude, ChatGPT oder Cursor als Connector hinzufügen. Ab jetzt antwortet jedes Modell aus Ihren Quellen.'] : ['Open a harbour — here at /harbour or on your own node.', 'Lay in approved knowledge: handbooks, policies, product data, each source named.', 'Add the harbour as a connector in Claude, ChatGPT or Cursor. From then on every model answers from your sources.'];
  const body = `${switchTo(lang, other)}<h1>${de ? 'KI-Agenten im Unternehmen — auf Wissen, das Sie freigegeben haben' : 'AI agents for your company — on knowledge you approved'}</h1>
<p style="font-size:1.15rem">${de ? 'Mare Liberum verbindet die KI, die Ihr Team schon nutzt, mit Ihrem freigegebenen Wissen, Ihren Regeln und erprobten Arbeitswegen. Über MCP, ohne Konten, ohne eigenes Modell, auf Wunsch komplett auf Ihrem Server.' : 'Mare Liberum connects the AI your team already uses to your approved knowledge, your rules and proven ways of working. Over MCP, without accounts, without a model of your own, and if you like entirely on your own server.'}</p>
<div class="grid">${parts.map(([h, href, t]) => `<div class="box"><h3><a href="${href}">${esc(h)}</a></h3><p style="margin:0">${esc(t)}</p></div>`).join('')}</div>
<h2>${de ? 'In drei Schritten' : 'In three steps'}</h2><ol>${steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
${de ? connectDe('https://mareliberum.dev/harbour/mcp') : connect('https://mareliberum.dev/harbour/mcp')}
${reportBox(lang)}
${faqHtml(qa, de ? 'Fragen' : 'Questions')}
<p>${de ? 'Weiter:' : 'More:'} <a href="/harbour">${de ? 'Hafen öffnen' : 'Open a harbour'}</a> · <a href="/download">${de ? 'Knoten herunterladen' : 'Download the node'}</a> · <a href="/yard">${de ? 'Agenten bauen' : 'Build an agent'}</a> · <a href="${de ? '/de/mcp-server' : '/mcp-server'}">${de ? 'Kostenloser MCP-Server' : 'Free MCP server'}</a></p>`;
  return page(base, path, de ? 'KI-Agenten im Unternehmen einsetzen — MCP-Plattform mit freigegebenem Wissen · Mare Liberum' : 'AI Agents for Business — MCP platform on your approved knowledge · Mare Liberum',
    de ? 'Claude, ChatGPT und eigene Agenten mit Ihrem freigegebenen Wissen verbinden: Antworten mit Quellenangabe, Agenten aus Vorlagen, eigener Server, EU-Hosting, MIT-Lizenz. Ohne eigenes KI-Modell.' : 'Connect Claude, ChatGPT and your own agents to your approved knowledge: answers with sources, agents from blueprints, self-hosted or EU-hosted, MIT licence. No model of your own needed.',
    body, graph(ORG(base), APP(base), crumbs(base, [['Mare Liberum', de ? '/de' : '/'], [de ? 'Unternehmen' : 'Business', path]]), faqLd(qa)), '/og.png', { lang, alt: { en: '/business', de: '/de/unternehmen' } });
}

// ── Which AI crawlers come: live numbers from the census ──
const BOTS = [
  ['GPTBot', 'OpenAI', 'collects pages for training OpenAI models', 'GPTBot'],
  ['OAI-SearchBot', 'OpenAI', 'indexes pages for ChatGPT search', 'OAI-SearchBot'],
  ['ChatGPT-User', 'OpenAI', 'fetches a page when a ChatGPT user asks for it', 'ChatGPT-User'],
  ['ClaudeBot', 'Anthropic', 'collects pages for training Claude', 'ClaudeBot'],
  ['Claude-SearchBot', 'Anthropic', 'indexes pages for Claude’s web search', 'Claude-SearchBot'],
  ['Claude-User', 'Anthropic', 'fetches a page when a Claude user asks for it', 'Claude-User'],
  ['PerplexityBot', 'Perplexity', 'indexes pages for Perplexity answers', 'PerplexityBot'],
  ['Perplexity-User', 'Perplexity', 'fetches a page for a Perplexity user', 'Perplexity-User'],
  ['Google-Extended', 'Google', 'a robots.txt token only: decides whether Gemini may train on pages Googlebot fetched', 'Google-Extended'],
  ['meta-externalagent', 'Meta', 'collects pages for Meta’s AI models', 'meta-externalagent'],
  ['Applebot-Extended', 'Apple', 'a robots.txt token: decides whether Apple may train on pages Applebot fetched', 'Applebot-Extended'],
  ['Amazonbot', 'Amazon', 'crawls for Amazon services including Alexa answers', 'Amazonbot'],
  ['Bytespider', 'ByteDance', 'collects pages for ByteDance models', 'Bytespider'],
  ['CCBot', 'Common Crawl', 'builds the open Common Crawl corpus that many models train on', 'CCBot'],
  ['DuckAssistBot', 'DuckDuckGo', 'fetches pages for DuckDuckGo’s AI answers', 'DuckAssistBot'],
  ['MistralAI-User', 'Mistral', 'fetches a page when a Le Chat user asks for it', 'MistralAI-User'],
];
export function crawlersPage(base, lang, census, day) {
  const de = lang === 'de', path = de ? '/de/ki-crawler' : '/ai-crawlers', other = de ? '/ai-crawlers' : '/de/ki-crawler', F = de ? fmtDe : fmt;
  const names = (census?.names || []).filter((x) => ['ai-crawler', 'assistant', 'search', 'search-ai'].includes(x.kind)).slice(0, 15);
  const total = Object.values(census?.kinds || {}).reduce((a, b) => a + b, 0), ai = census?.kinds?.['ai-crawler'] || 0;
  const qa = de ? [
    ['Welche KI-Crawler gibt es?', 'Die wichtigsten: GPTBot, OAI-SearchBot und ChatGPT-User (OpenAI), ClaudeBot, Claude-SearchBot und Claude-User (Anthropic), PerplexityBot, meta-externalagent (Meta), Amazonbot, Bytespider, CCBot sowie die robots.txt-Zeichen Google-Extended und Applebot-Extended.'],
    ['Soll ich KI-Crawler sperren?', 'Wer in Antworten von ChatGPT, Claude oder Perplexity vorkommen will, lässt die Such- und Nutzer-Crawler herein. Training lässt sich getrennt davon sperren, etwa GPTBot, ClaudeBot und Google-Extended.'],
    ['Woher kommen die Zahlen?', `Aus dem öffentlichen Zensus von Mare Liberum: jeder Abruf dieser Adresse, nach Kennung eingeordnet, ohne Speicherung von Personen. Stand: ${day}.`],
  ] : [
    ['Which AI crawlers are there?', 'The main ones: GPTBot, OAI-SearchBot and ChatGPT-User (OpenAI), ClaudeBot, Claude-SearchBot and Claude-User (Anthropic), PerplexityBot, meta-externalagent (Meta), Amazonbot, Bytespider, CCBot, and the robots.txt tokens Google-Extended and Applebot-Extended.'],
    ['Should I block AI crawlers?', 'To appear in answers from ChatGPT, Claude or Perplexity, let the search and user crawlers in. Training can be blocked separately, for example GPTBot, ClaudeBot and Google-Extended.'],
    ['Where do these numbers come from?', `From the public census of Mare Liberum: every request to this address, sorted by who it says it is, with no record of people. Day: ${day}.`],
  ];
  const body = `${switchTo(lang, other)}<h1>${de ? 'KI-Crawler: wer wirklich kommt — live gezählt' : 'AI crawlers: who really comes — counted live'}</h1>
<p style="font-size:1.15rem">${de ? `Am ${day} kamen ${F(ai)} Abrufe von KI-Crawlern an diese Adresse, von ${F(total)} insgesamt. Das sind die Namen dahinter, wie sie sich selbst melden:` : `On ${day}, AI crawlers made ${F(ai)} of the ${F(total)} requests to this address. These are the names behind them, as they introduce themselves:`}</p>
<table><thead><tr><th>${de ? 'Wer' : 'Who'}</th><th>${de ? 'Art' : 'Kind'}</th><th>${de ? 'Abrufe' : 'Requests'}</th></tr></thead><tbody>${names.map((x) => `<tr><td>${esc(x.name)}</td><td>${esc(x.kind)}</td><td>${F(x.visits)}</td></tr>`).join('')}</tbody></table>
<p class="muted"><small>${de ? 'Alle Zahlen, jeden Tag: ' : 'Every number, every day: '}<a href="/visitors">${de ? 'der Zensus' : 'the census'}</a> · <a href="/census">/census</a> (JSON)</small></p>
<h2>${de ? 'Die KI-Crawler und ihre robots.txt-Namen' : 'The AI crawlers and their robots.txt names'}</h2>
<table><thead><tr><th>robots.txt</th><th>${de ? 'Betreiber' : 'Operator'}</th><th>${de ? 'Wofür' : 'What for'}</th></tr></thead><tbody>${BOTS.map(([n, op, what, tok]) => `<tr><td><code>${esc(tok)}</code></td><td>${esc(op)}</td><td>${esc(what)}</td></tr>`).join('')}</tbody></table>
<h2>${de ? 'robots.txt: in Antworten erscheinen, Training sperren' : 'robots.txt: appear in answers, keep out of training'}</h2>
<pre># ${de ? 'KI-Suche und Nutzerabrufe erlauben' : 'allow AI search and user fetches'}
User-agent: OAI-SearchBot
User-agent: ChatGPT-User
User-agent: Claude-SearchBot
User-agent: Claude-User
User-agent: PerplexityBot
User-agent: Perplexity-User
Allow: /

# ${de ? 'Training sperren' : 'keep out of training'}
User-agent: GPTBot
User-agent: ClaudeBot
User-agent: Google-Extended
User-agent: Applebot-Extended
User-agent: meta-externalagent
User-agent: CCBot
User-agent: Bytespider
Disallow: /</pre>
<p>${de ? 'Ob Ihre Website für diese Crawler offen ist, zeigt die kostenlose Prüfung:' : 'Whether your website is open to these crawlers, the free check shows:'} <a href="${de ? '/de/ki-sichtbarkeit' : '/check'}">${de ? 'KI-Sichtbarkeit prüfen' : 'AI visibility check'}</a>.</p>
${faqHtml(qa, de ? 'Fragen' : 'Questions')}`;
  return page(base, path, de ? 'KI-Crawler-Liste: GPTBot, ClaudeBot, PerplexityBot — live gezählt · Mare Liberum' : 'AI Crawler List 2026: GPTBot, ClaudeBot, PerplexityBot — counted live · Mare Liberum',
    de ? `Welche KI-Crawler eine Website wirklich besuchen, live gezählt (${F(ai)} am ${day}), mit robots.txt-Namen aller KI-Bots und einer Vorlage: in KI-Antworten erscheinen, Training sperren.` : `Which AI crawlers really visit a website, counted live (${F(ai)} on ${day}), with the robots.txt names of every AI bot and a template to appear in AI answers while keeping out of training.`,
    body, graph(ORG(base), crumbs(base, [['Mare Liberum', de ? '/de' : '/'], [de ? 'KI-Crawler' : 'AI crawlers', path]]), faqLd(qa), { '@type': 'Dataset', name: de ? 'KI-Crawler-Besuche' : 'AI crawler visits', description: de ? 'Tägliche Zahl der Abrufe von KI-Crawlern, Assistenten und Suchmaschinen an mareliberum.dev' : 'Daily requests by AI crawlers, assistants and search engines to mareliberum.dev', url: `${base}/census`, isAccessibleForFree: true, license: 'https://creativecommons.org/publicdomain/zero/1.0/' }), '/og.png', { lang, alt: { en: '/ai-crawlers', de: '/de/ki-crawler' } });
}

// ── The AI visibility check, explained (under the form of /check) ──
export const CHECK_QA = [
  ['What does the AI visibility check look at?', 'What the site itself publishes: robots.txt for every known AI crawler and assistant, llms.txt, whether the home page has its text without JavaScript, structured data, an agent card and an MCP door. It gives a score out of 100 and plain fixes.'],
  ['Why do AI assistants not show my website?', 'The usual reasons: robots.txt closes the crawlers of ChatGPT, Claude or Perplexity; the content only appears after JavaScript runs; or the site says too little about itself in text and structured data.'],
  ['Do I need an llms.txt?', 'It helps agents that look for it and costs little, but few crawlers read it today. robots.txt and text that is there without JavaScript matter more.'],
  ['Is the check free?', 'Yes. No account. 20 checks an hour per network address.'],
];
export const checkExtra = (de = false) => de ? '' : `<h2>What is checked</h2><ul><li>robots.txt: is your site open to GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-User, PerplexityBot, Google-Extended and the others? <a href="/ai-crawlers">The list, counted live</a></li><li>llms.txt and llms-full.txt</li><li>text without JavaScript: what an agent reads when it does not run your scripts</li><li>structured data (JSON-LD), title, description</li><li>agent card (A2A) and MCP door</li></ul>${faqHtml(CHECK_QA)}<p>${'Auf Deutsch: <a href="/de/ki-sichtbarkeit">KI-Sichtbarkeit prüfen</a>'}</p>`;

export function deCheckPage(base) {
  const qa = [
    ['Was prüft die KI-Sichtbarkeitsprüfung?', 'Was die Website selbst veröffentlicht: robots.txt für jeden bekannten KI-Crawler und Assistenten, llms.txt, ob die Startseite ihren Text ohne JavaScript zeigt, strukturierte Daten, eine Agent Card und eine MCP-Tür. Ergebnis: eine Note von 100 und klare Korrekturen.'],
    ['Warum zeigen ChatGPT oder Claude meine Website nicht?', 'Meist sperrt die robots.txt die Crawler von ChatGPT, Claude oder Perplexity, der Inhalt erscheint erst nach JavaScript, oder die Seite sagt in Text und strukturierten Daten zu wenig über sich.'],
    ['Brauche ich eine llms.txt?', 'Sie hilft Agenten, die danach suchen, und kostet wenig; heute lesen sie aber nur wenige Crawler. Wichtiger sind robots.txt und Text, der ohne JavaScript da ist.'],
    ['Kostet die Prüfung etwas?', 'Nein. Kein Konto. 20 Prüfungen in der Stunde je Netzadresse.'],
  ];
  const body = `${switchTo('de', '/check')}<h1>KI-Sichtbarkeit prüfen: Sehen ChatGPT, Claude und Perplexity Ihre Website?</h1>
<p style="font-size:1.15rem">Kostenlose Prüfung, ohne Konto: Mare Liberum liest, was Ihre Website selbst veröffentlicht, und zeigt, ob KI-Assistenten, KI-Suchen und KI-Crawler sie finden, lesen und nutzen können.</p>
<form class="row" action="/check" method="get"><input name="site" required placeholder="ihre-website.de" style="padding:10px;border-radius:8px;border:1px solid #2a5a80;background:#0a1c2e;color:#eaf4ff"> <button style="padding:10px 16px;border-radius:8px">Prüfen</button></form>
<h2>Was geprüft wird</h2><ul><li>robots.txt: Ist Ihre Seite offen für GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-User, PerplexityBot, Google-Extended und die anderen? <a href="/de/ki-crawler">Die Liste, live gezählt</a></li><li>llms.txt und llms-full.txt</li><li>Text ohne JavaScript: was ein Agent liest, der Ihre Skripte nicht ausführt</li><li>strukturierte Daten (JSON-LD), Titel, Beschreibung</li><li>Agent Card (A2A) und MCP-Tür</li></ul>
${faqHtml(qa, 'Fragen')}
<p>Weiter: <a href="/de/ki-crawler">KI-Crawler-Liste</a> · <a href="/de/mcp-server">Kostenloser MCP-Server</a> · <a href="/de/unternehmen">Für Unternehmen</a></p>`;
  return page(base, '/de/ki-sichtbarkeit', 'KI-Sichtbarkeit prüfen — sehen ChatGPT, Claude & Perplexity Ihre Website? · kostenlos', 'Kostenloser KI-Sichtbarkeits-Check: robots.txt für GPTBot, ClaudeBot & PerplexityBot, llms.txt, Text ohne JavaScript, strukturierte Daten. Note von 100 und klare Korrekturen, ohne Konto.',
    body, graph(ORG(base), crumbs(base, [['Mare Liberum', '/de'], ['KI-Sichtbarkeit prüfen', '/de/ki-sichtbarkeit']]), faqLd(qa), { '@type': 'WebApplication', name: 'KI-Sichtbarkeit prüfen', url: `${base}/de/ki-sichtbarkeit`, applicationCategory: 'DeveloperApplication', isAccessibleForFree: true, inLanguage: 'de' }), '/og-check.png', { lang: 'de', alt: { en: '/check', de: '/de/ki-sichtbarkeit' } });
}

// ── The German home ──
export function deHomePage(base, stats) {
  const k = stats?.byKind || {};
  const cards = [
    ['/de/mcp-server', 'Kostenloser MCP-Server', 'Eine Adresse in Claude, ChatGPT, Cursor oder VS Code eintragen: Webseiten lesen, Websites prüfen, Werkzeuge finden, Gedächtnis. Kein Konto, kein Schlüssel.'],
    ['/de/ki-sichtbarkeit', 'KI-Sichtbarkeit prüfen', 'Sehen ChatGPT, Claude und Perplexity Ihre Website? Note von 100 und klare Korrekturen.'],
    ['/mcp-servers', 'Verzeichnis der MCP-Server', `${fmtDe(k.mcp)} MCP-Server nach Thema, dazu ${fmtDe(k.a2a)} A2A-Agenten und ${fmtDe(k.x402)} x402-APIs. Täglich aktualisiert.`],
    ['/de/unternehmen', 'Für Unternehmen', 'Die KI, die Ihr Team nutzt, mit freigegebenem Wissen verbinden. Antworten mit Quelle, Agenten aus Vorlagen, eigener Server.'],
    ['/de/webseite-als-markdown', 'Webseite als Markdown', 'Jede öffentliche Seite als sauberes Markdown für Sprachmodelle, per URL, Python oder MCP.'],
    ['/de/ki-crawler', 'KI-Crawler, live gezählt', 'Welche KI-Bots wirklich kommen, mit allen robots.txt-Namen.'],
    ['/briefs', 'Briefs für jede Aufgabe', 'Was eine Anfrage offen lässt, die Methode, die Qualitätslatte und die Prüfung. In jeder Sprache.'],
    ['/yard', 'Agenten bauen', 'Aus Vorlagen ein eigener Agent, der mit Claude, OpenAI oder lokal über Ollama läuft.'],
  ];
  const qa = [
    ['Was ist Mare Liberum?', 'Eine offene Plattform für KI-Agenten, die niemandem gehört: ein kostenloser MCP-Server, ein Verzeichnis mit über 84.000 MCP-Servern, eine Prüfung der KI-Sichtbarkeit jeder Website, Briefs für bessere Agentenarbeit und private Häfen für Teams.'],
    ['Was kostet Mare Liberum?', 'Nichts. Kein Konto, kein API-Schlüssel. Der Code steht unter MIT-Lizenz und läuft auch auf dem eigenen Server.'],
    ['Wer steckt dahinter?', 'Mare Liberum wird von Oroboros Design in Köln gebaut. Der öffentliche Knoten läuft in der EU (Hetzner, Helsinki); der Code ist offen.'],
  ];
  const body = `${switchTo('de', '/')}<h1>Mare Liberum — die offene Plattform für KI-Agenten</h1>
<p style="font-size:1.15rem">Ein Meer, das niemandem gehört: Werkzeuge, die jeder Agent ohne Konto nutzen kann, ein Verzeichnis aller MCP-Server und A2A-Agenten, und ein Ort, an dem Agenten voneinander lernen. Für Entwickler, für Teams und für jede KI, die etwas erledigen soll.</p>
<div class="grid">${cards.map(([h, t, d]) => `<div class="box"><h3><a href="${h}">${esc(t)}</a></h3><p style="margin:0">${esc(d)}</p></div>`).join('')}</div>
<h2>In einer Zeile verbunden</h2>
${connectDe()}
${faqHtml(qa, 'Fragen')}`;
  return page(base, '/de', 'Mare Liberum — offene KI-Agenten-Plattform & kostenloser MCP-Server', `Die offene Plattform für KI-Agenten: kostenloser MCP-Server ohne Schlüssel, ${fmtDe(k.mcp)} MCP-Server im Verzeichnis, KI-Sichtbarkeit jeder Website prüfen, Agenten für Unternehmen. Kein Konto, MIT-Lizenz.`,
    body, graph(ORG(base), APP(base), { '@type': 'WebSite', name: 'Mare Liberum', url: `${base}/de`, inLanguage: 'de' }, faqLd(qa)), '/og.png', { lang: 'de', alt: { en: '/', de: '/de' } });
}

// every page here, for the sitemap and IndexNow
export const SEO_PATHS = ['/mcp-server', '/de/mcp-server', '/mcp-servers', ...MCP_TOPICS.map((t) => `/mcp-servers/${t[0]}`), '/a2a-agents', '/x402-apis', '/web-to-markdown', '/de/webseite-als-markdown', '/business', '/de/unternehmen', '/ai-crawlers', '/de/ki-crawler', '/de/ki-sichtbarkeit', '/de', '/check', '/de/agenturen', '/teams', '/de/kanzleien', '/weather', '/de/agentenwetter'];

// ── Three audiences, three offers. The prices are a pilot: what a team pays for is room on this node and help, never the code. ──
export const OFFER = {
  agency: 'https://buy.stripe.com/9B63co3Ly7F2fVJdTLes00m',   // Team-Hafen (Pilot), 79 € a month, first month free
  teams: 'https://buy.stripe.com/5kQ00ceqc0cA38X4jbes00n',    // team harbour for coding agents, 49 € a month, first month free
  law: 'https://buy.stripe.com/9B6bIUbe02kIcJx5nfes00r',      // Kanzlei-Hafen: Einrichtung 750 € (ohne Einblick in Mandatsdaten) + Jahresbegleitung 990 € je Standort (plink_1Uev8h4IVkazyZLzsmA53lgQ)
  mail: 'oroborosdesign@gmail.com',
};
const cta = (href, label, sub) => `<p style="margin:1.4rem 0"><a href="${esc(href)}" style="display:inline-block;padding:.85rem 1.3rem;border-radius:10px;background:#0b5cad;color:#fff;font-weight:600;text-decoration:none">${esc(label)}</a>${sub ? `<br><small class="muted">${esc(sub)}</small>` : ''}</p>`;
const thanks = (text) => `<div class="box" role="status" style="border-color:#0b5cad"><p style="margin:0"><b>${esc(text)}</b></p></div>`;

export function agencyPage(base, paid) {
  const path = '/de/agenturen';
  const qa = [
    ['Müssen wir unser Werkzeug wechseln?', 'Nein. Ihr Team arbeitet weiter in ChatGPT, Claude oder Cursor. Der Hafen kommt als ein Connector dazu, in jedem dieser Programme mit derselben Adresse.'],
    ['Was ist im Pilotpreis enthalten?', 'Zehnfacher Raum für Ihr Team (2.000 Quellen und 10 Millionen Zeichen statt 200 Quellen und 1 Million), gemeinsame Einrichtung des ersten Hafens und ein direkter Draht zu uns. Der erste Monat ist frei, danach 79 € im Monat, monatlich kündbar.'],
    ['Geht es auch ohne zu zahlen?', 'Ja. Ein Hafen mit 200 Quellen ist frei. Öffnen Sie ihn selbst unter /harbour; der Pilot lohnt sich, sobald mehrere Kunden oder viel Material dazukommen.'],
    ['Halten sich die Modelle wirklich an unsere Quellen?', 'Der Hafen liefert nur freigegebene Stellen, wörtlich und mit Quellenangabe, gibt Ihren Rahmen mit und prüft einen Entwurf Satz für Satz gegen die Quellen. Die Antwort selbst schreibt Ihr Modell; die Prüfung liest Wörter und Zahlen und kann Bedeutung nicht beurteilen.'],
    ['Wo liegen die Daten, und was dürfen wir hineinlegen?', 'Auf einem Server in Helsinki und in einer Datenbank in Irland, beide in der EU. Der Hafen ist durch Schlüssel geschützt, nicht Ende zu Ende verschlüsselt. Einen Vertrag zur Auftragsverarbeitung gibt es im Pilot noch nicht: Legen Sie deshalb keine personenbezogenen Daten Dritter hinein. Für solches Material gibt es den eigenen Knoten zum Herunterladen.'],
    ['Wie wird der Raum freigeschaltet?', 'Nach der Buchung tragen wir Ihren Hafen von Hand ein, in der Regel am selben Werktag. Die Kennung Ihres Hafens steht in seiner Übersicht; geben Sie sie bei der Buchung an oder schicken Sie sie per Mail.'],
  ];
  const body = `${paid ? thanks('Danke, die Buchung ist angekommen. Wir schalten den Raum für Ihren Hafen frei und melden uns per Mail. Noch keinen Hafen? Öffnen Sie ihn unter /harbour und schicken Sie uns seine Kennung.') : ''}
<h1>Ein Gedächtnis für ChatGPT und Claude zugleich</h1>
<p style="font-size:1.15rem">Für Agenturen und Beratungen: Je Kunde ein Hafen mit Ihren Regeln, freigegebenen Unterlagen und erprobten Arbeitswegen. Das ganze Team nutzt ihn aus ChatGPT, Claude und Cursor über einen einzigen Anschluss, und er bleibt, wenn Sie den Anbieter wechseln.</p>
${cta(go('agency', 'agency'), 'Pilot starten: erster Monat frei', 'Danach 79 € je Team im Monat, monatlich kündbar. Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.')}
<p><a href="/harbour">Oder erst frei ausprobieren: einen Hafen öffnen</a></p>
<h2>Was sich ändert</h2>
<div class="grid">
<div class="box"><h3>Heute</h3><p style="margin:0">Kundenwissen steckt in einzelnen Chats, GPTs und Projekten. Ein Teil des Teams nutzt ChatGPT, ein Teil Claude. Jede Person erklärt der KI den Kunden neu.</p></div>
<div class="box"><h3>Mit einem Hafen je Kunde</h3><p style="margin:0">Markenregeln, Briefings und freigegebene Aussagen liegen an einem Ort. Jedes Modell bekommt denselben Rahmen und nennt die Quelle. Was funktioniert hat, wird als Weg festgehalten und vom Team bewertet.</p></div>
<div class="box"><h3>Vor der Abgabe</h3><p style="margin:0">Ein Entwurf wird Satz für Satz gegen die freigegebenen Unterlagen gehalten. Eine Zahl, die in keiner Quelle steht, fällt auf.</p></div>
</div>
<h2>In einer Stunde eingerichtet</h2>
<ol><li>Hafen öffnen und dem Kunden einen Rahmen geben: wofür die KI da ist und woran sie sich hält.</li><li>Freigegebene Unterlagen hineinlegen: Markenhandbuch, Tonalität, Leistungsbeschreibung, Preisliste.</li><li>Die Adresse des Hafens in ChatGPT, Claude oder Cursor als Connector eintragen. Der Crew-Schlüssel schreibt, der Gast-Schlüssel liest nur.</li></ol>
${connectDe('https://mareliberum.dev/harbour/mcp')}
<p class="muted"><small>Der Schlüssel des Hafens wird als Kopfzeile „Authorization: Bearer“ mitgegeben. Für Apps, die nur eine Adresse annehmen: https://mareliberum.dev/h/&lt;Schlüssel&gt;/mcp.</small></p>
${reportBox('de')}
${faqHtml(qa, 'Fragen')}
<p>Fragen vor dem Start: <a href="mailto:${OFFER.mail}?subject=Team-Hafen%20Pilot">${OFFER.mail}</a> · Weiter: <a href="/de/unternehmen">Für Unternehmen</a> · <a href="/de/kanzleien">Für Kanzleien</a> · <a href="/teams">For developer teams</a> · <a href="/security">Sicherheit</a> · <a href="/terms">Bedingungen</a> · <a href="/privacy">Datenschutz</a></p>`;
  return page(base, path, 'Ein KI-Gedächtnis für ChatGPT und Claude zugleich · Mare Liberum',
    'Kundenwissen, Markenregeln und erprobte Arbeitswege an einem Ort, nutzbar aus ChatGPT, Claude und Cursor über einen Anschluss. Antworten mit Quellenangabe. Pilot: erster Monat frei, dann 79 € je Team.',
    body, graph(ORG(base), crumbs(base, [['Mare Liberum', '/de'], ['Agenturen', path]]), faqLd(qa)), '/og.png', { lang: 'de' });
}

export function teamsPage(base, paid) {
  const path = '/teams', url = 'https://mareliberum.dev/harbour/mcp';
  const qa = [
    ['How is this different from a rules file in the repo?', 'A rules file grows and nobody knows which line still helps. In a harbour, a way is laid for one task, every agent that used it says whether it worked, and the ways that keep working rise. It is the same store for every agent and every developer.'],
    ['Which agents can use it?', 'Any client that speaks MCP over HTTP with a header: Claude Code, Cursor, VS Code, Codex and others. Agents built in the shipyard use it too.'],
    ['Can we host it ourselves?', 'Yes, free. The node is one program without dependencies under the MIT licence; download it and the same harbour runs on your machine or server.'],
    ['What does the paid team harbour add?', 'Ten times the room on this node (2,000 sources and 10 million characters instead of 200 and 1 million) and a direct line to us. First month free, then 49 € a month per team, cancel monthly. The free harbour stays free.'],
    ['What does the harbour know about our use?', 'It counts calls per day and month and the kinds of client that call (the program name only), so your crew sees whether it is used. It never stores what was asked.'],
    ['Where does it run, and what should stay out?', 'On a server in Helsinki with a database in Ireland. A hosted harbour is protected by its keys, not encrypted end to end, and there is no data-processing agreement yet: keep personal data of third parties and secrets out. For those, run your own node.'],
  ];
  const body = `${paid ? thanks('Thank you, the booking has arrived. We give your harbour its room, usually the same working day, and write to you. No harbour yet? Open one at /harbour and send us its id.') : ''}
<h1>One shared memory for all your coding agents</h1>
<p style="font-size:1.15rem">Claude Code, Cursor and Codex each learn the traps of your repository on their own, and so does every developer. A harbour is one place they all read and write: your rules, your approved docs, and the ways that worked, rated by the agents that used them.</p>
${cta('/harbour', 'Open a harbour, free', 'No account. Three keys: owner, crew, guest.')}
<h2>Connect every agent to the same harbour</h2>
<pre>Claude Code
claude mcp add --transport http harbour ${url} --header "Authorization: Bearer $HARBOUR_KEY"

Cursor · .cursor/mcp.json
{ "mcpServers": { "harbour": { "url": "${url}", "headers": { "Authorization": "Bearer \${env:HARBOUR_KEY}" } } } }

VS Code · .vscode/mcp.json
{ "servers": { "harbour": { "type": "http", "url": "${url}", "headers": { "Authorization": "Bearer \${input:harbour-key}" } } } }

AGENTS.md · one line for every agent
Before a task: call think with the task. After it: lay_way with what worked, or rate_way for the way you used.</pre>
<div class="grid">
<div class="box"><h3>think</h3><p style="margin:0">Before a task, the agent asks the harbour: has anyone here done this, and what worked? It gets the team's ways first, ranked by confirmations.</p></div>
<div class="box"><h3>lay_way · rate_way</h3><p style="margin:0">After the work, the agent records the way in a sentence and the next one says whether it held. Wrong ways sink, they are not copied forever.</p></div>
<div class="box"><h3>search_sources · check_answer</h3><p style="margin:0">Architecture notes, conventions and runbooks the owner approved, returned as passages with their source. A draft can be held against them.</p></div>
</div>
<h2>Free to self-host, a small fee for room here</h2>
<p>Run the node yourself for nothing: <a href="/download">download it</a>. On this node a harbour with 200 sources is free. A team that wants ten times the room and a direct line pays 49 € a month, first month free.</p>
${cta(go('teams', 'teams'), 'Start the team harbour: first month free', 'Then 49 € a month per team, cancel monthly. No VAT is charged (§ 19 UStG, German small-business rule).')}
${faqHtml(qa)}
<p>Questions: <a href="mailto:${OFFER.mail}?subject=Team%20harbour">${OFFER.mail}</a> · More: <a href="/harbour">The harbour</a> · <a href="/yard">Build an agent</a> · <a href="/download">Download the node</a> · <a href="/business">For companies</a> · <a href="/security">Security</a> · <a href="/terms">Terms</a></p>`;
  return page(base, path, 'Shared memory for coding agents over MCP · Mare Liberum',
    'One shared, rated memory for every coding agent on your team: rules, approved docs and the ways that worked, over one MCP connection. Free to self-host; hosted team harbour 49 € a month, first month free.',
    body, graph(ORG(base), APP(base), crumbs(base, [['Mare Liberum', '/'], ['Teams', path]]), faqLd(qa)), '/og.png', { lang: 'en' });
}

export function lawPage(base, paid) {
  const path = '/de/kanzleien', mail = `mailto:${OFFER.mail}?subject=Kanzlei-Hafen`;
  const qa = [
    ['Verlässt wirklich nichts das Haus?', 'Quellen, Wege und Notizen liegen auf Ihrem Rechner oder Server. Was ein Assistent aus dem Hafen abruft, sieht allerdings der Anbieter dieses Assistenten. Arbeiten Sie mit einem lokalen Modell, bleibt auch das im Haus; arbeiten Sie mit einem Cloud-Assistenten, gelten dessen Bedingungen für die abgerufenen Stellen.'],
    ['Mit welchen Programmen arbeitet der Kanzlei-Hafen?', 'Mit jedem Programm, das MCP im eigenen Netz spricht: Agenten aus unserer Werft mit einem lokalen Modell über Ollama, Claude Code, Cursor und VS Code. Assistenten, die nur aus der Cloud zugreifen, erreichen einen Hafen im Kanzleinetz nicht ohne Freigabe nach außen.'],
    ['Was kostet es?', 'Die Software ist frei (MIT-Lizenz) und bleibt es. Wer Hilfe möchte, bucht die Einrichtung zum Festpreis von 750 € und die Jahresbegleitung für 990 € je Standort: geprüfte Updates mit Anleitung, Hilfe per E-Mail binnen eines Werktags und zwei Termine im Jahr zur Anbindung neuer Programme. Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.'],
    ['Sehen Sie dabei Mandatsdaten?', 'Nein. Wir richten den Hafen leer ein, bevor Unterlagen hineinkommen: per Bildschirmfreigabe, die Sie steuern, oder mit Ihrem IT-Partner. Wir erhalten keinen Zugang zu Ihren Systemen, und Hilfe läuft per E-Mail ohne Einblick in Ihre Unterlagen. Die Vorgaben von § 43e BRAO und § 62a StBerG greifen, wenn einem Dienstleister der Zugang zu Mandatsgeheimnissen eröffnet wird; das geschieht hier nicht. Eine Verschwiegenheitsvereinbarung in Textform schließen wir trotzdem gern mit Ihnen.'],
    ['Und wenn wir Fernwartung möchten?', 'Dann wären wir Dienstleister mit möglichem Zugang zu Mandatsgeheimnissen. Das bieten wir nur mit einem Vertrag in Textform nach § 43e BRAO beziehungsweise § 62a StBerG und einem Vertrag zur Auftragsverarbeitung an. Fragen Sie uns danach.'],
    ['Ersetzt das eine juristische Datenbank?', 'Nein. Fachinhalte bringen wir nicht mit. Der Hafen ist der Ort für Ihr eigenes freigegebenes Wissen: Muster, Vermerke, Abläufe, Kanzleihandbuch.'],
  ];
  const body = `<h1>Der Kanzlei-Hafen: Ihr Wissen bleibt im Haus</h1>
<p style="font-size:1.15rem">Für Steuer- und Anwaltskanzleien: ein Wissensspeicher auf Ihrem eigenen Rechner oder Server. Er gibt nur heraus, was Sie freigegeben haben, wörtlich und mit Fundstelle, und hält jeden Entwurf Satz für Satz gegen Ihre Unterlagen.</p>
${paid ? thanks('Danke. Wir melden uns binnen eines Werktags mit einem Termin für die Einrichtung. Bis dahin bitte noch keine Mandatsunterlagen in den Hafen legen.') : ''}
${cta(go('law', 'law'), 'Kanzlei-Hafen buchen: Einrichtung und erstes Jahr', 'Einrichtung 750 € einmalig, Jahresbegleitung 990 € je Standort, jährlich kündbar. Ohne Einblick in Mandatsdaten. Keine Umsatzsteuer nach § 19 UStG.')}
<p>Lieber erst sprechen? <a href="${mail}">${OFFER.mail}</a></p>
<p><a href="/download">Die Software selbst ansehen: Knoten herunterladen (frei, MIT-Lizenz)</a></p>
<div class="grid">
<div class="box"><h3>Nur freigegebenes Wissen</h3><p style="margin:0">Muster, Vermerke und Abläufe werden vorgeschlagen und von einer berechtigten Person freigegeben. Erst dann gibt der Hafen sie heraus, mit Titel, Abschnitt und Stand.</p></div>
<div class="box"><h3>Auf Ihrer Technik</h3><p style="margin:0">Ein Programm ohne Abhängigkeiten: Node.js oder Docker, der Zustand liegt in einem Ordner auf Ihrer Platte. Kein Konto bei uns, kein Zugriff von uns.</p></div>
<div class="box"><h3>Geprüfte Entwürfe</h3><p style="margin:0">Die Prüfung zeigt, welcher Satz sich auf welche Stelle stützt und welche Zahl in keiner Quelle steht. Sie liest Wörter und Zahlen; die fachliche Bewertung bleibt bei Ihnen.</p></div>
</div>
<h2>Für Systemhäuser</h2>
<p>Sie betreuen Kanzleien und möchten den Hafen mit ausliefern? Die Installation ist ein Archiv und ein Startskript. Schreiben Sie uns: <a href="${mail}">${OFFER.mail}</a>.</p>
${faqHtml(qa, 'Fragen')}
<p class="muted"><small>Diese Seite ist keine Rechtsberatung. Ob und wie Sie Mandatswissen mit KI-Werkzeugen verarbeiten dürfen, klären Sie nach Ihrem Berufsrecht.</small></p>
<p>Weiter: <a href="/de/unternehmen">Für Unternehmen</a> · <a href="/de/agenturen">Für Agenturen</a> · <a href="/security">Sicherheit</a> · <a href="/privacy">Datenschutz</a></p>`;
  return page(base, path, 'KI-Wissensspeicher für Kanzleien, auf eigenem Server · Mare Liberum',
    'Für Steuer- und Anwaltskanzleien: freigegebene Muster, Vermerke und Abläufe auf dem eigenen Server, Antworten mit Fundstelle, Entwürfe gegen die Quellen geprüft. Freie Software; Einrichtung ohne Einblick in Mandatsdaten 750 €, Jahresbegleitung 990 €.',
    body, graph(ORG(base), crumbs(base, [['Mare Liberum', '/de'], ['Kanzleien', path]]), faqLd(qa)), '/og.png', { lang: 'de' });
}
