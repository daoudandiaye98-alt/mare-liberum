// Mare Liberum · proof of being found: search engines get the pages worth an index and skip the rest; agents get every
// page as Markdown when they ask for it. Search results (/find?q=) and brain topics no pathway fires for stay out of the
// index; the registrations that arrive by the hundred thousand with one sentence (on-chain agents) keep their page but
// leave the index and the sitemaps; the sitemaps carry the day the sea was drawn; robots.txt lets crawlers skip the moves
// of agents (/go, /d, /via, /rate, /lay, /course/) while agents keep them; /about states who runs the sea for machines too.
// Runs without the network: node tools/find-proof.mjs   (exit code 1 when a proof fails)
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handle } from '../node/core.mjs';
import { createMem, hayOf, metaOf } from '../node/mem.mjs';
import { createLedger } from '../node/ledger.mjs';
import { payConfig } from '../node/pay.mjs';
import { wantsMarkdown, mdTwin, pageMarkdown } from '../node/agentmd.mjs';

let passed = 0, failed = 0;
const proof = async (name, fn) => { try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 4).join('\n       ')}`); } };
globalThis.fetch = async (u) => { throw new Error(`the proof does not use the network: ${String(u).slice(0, 80)}`); };

// a small sea: one MCP server, one on-chain registration with one sentence, one on-chain agent that takes a price
const dir = mkdtempSync(join(tmpdir(), 'mare-find-')), file = join(dir, 'sea.tsv');
const rows = [
  { id: 'urn:air:mcp.example:mcp:tool', display_name: 'Proof MCP tool', type: 'application/mcp-server-card+json', url: 'https://mcp.example/mcp', kind: 'mcp', source: 'mcp-registry', publisher: 'mcp.example', endpoints: [{ url: 'https://mcp.example/mcp', transport: 'streamable-http' }], description: 'Reads proof data for agents and answers questions about it in plain words.' },
  { id: 'urn:air:8004scan.io:agent:1:1', display_name: 'Kladose', type: 'application/json', url: 'https://www.8004scan.io/agents/1/1', kind: 'agent', source: 'erc8004', publisher: '8004scan.io', endpoints: [{ url: 'https://www.8004scan.io/agents/1/1' }], description: 'Kladose is an AI agent on Central City, where people and AI agents work together in shared rooms.' },
  { id: 'urn:air:8004scan.io:agent:1:2', display_name: 'Price oracle', type: 'application/json', url: 'https://www.8004scan.io/agents/1/2', kind: 'agent', source: 'erc8004', publisher: '8004scan.io', endpoints: [{ url: 'https://oracle.example/x402' }], pay: { priceUsd: 0.01, network: 'base', protocol: 'x402' }, description: 'Answers price questions for a fee per call, settled in USDC on Base for every agent.' },
];
writeFileSync(file, rows.map((r) => `${r.id}\t${metaOf(r)}\t${hayOf(r)}\t${JSON.stringify(r)}`).sort().join('\n') + '\n');
writeFileSync(join(dir, 'build.json'), JSON.stringify({ builtAt: '2026-11-20T10:00:00.000Z', entries: rows.length, lakes: { 'mcp-registry': 1, erc8004: 2 } }));
const BASE = 'https://mare.test', db = createMem({ file, base: BASE }), ledger = createLedger({});
let ipN = 1;
const BROWSER = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', AGENT_MD = 'text/markdown, text/html, */*';
const SITE = { '/llms.txt': { body: '# Mare Liberum · the first stop for agents on the internet\n\nAsk the brain first: GET /brain?q=<task>\n', type: 'text/plain; charset=utf-8' },
  '/': { body: '<!doctype html><html lang="en"><head><title>Mare Liberum</title><meta name="description" content="x"></head><body><main><h1>The front page</h1><p>Counters and zones for people.</p></main></body></html>', type: 'text/html; charset=utf-8' } };
const call = async (path, { accept = BROWSER, ua = 'proof-agent/1.0', method = 'GET', site } = {}) => {
  const res = await handle(new Request(BASE + path, { method, headers: { accept, 'user-agent': ua, 'x-forwarded-for': `198.18.2.${ipN++ % 250}` } }), db, { base: BASE, pay: payConfig({}), ledger, ...(site ? { site } : {}) });
  return { status: res.status, headers: res.headers, text: await res.text() };
};
const robotsMeta = (h) => /<meta name="robots" content="([^"]*)"/.exec(h)?.[1] || null;

console.log('every page as Markdown for the agent that asks');
await proof('who asks for Markdown: agents that name it before or beside HTML; never a browser or a search engine', () => {
  for (const a of ['text/markdown', AGENT_MD, 'text/markdown;q=1.0, text/x-markdown;q=0.9, text/plain;q=0.8, text/html;q=0.7', 'text/x-markdown']) assert.equal(wantsMarkdown(a), true, a);
  for (const a of [BROWSER, '*/*', '', 'text/html', 'application/json', 'text/markdown;q=0.5, text/html', 'text/markdown;q=0']) assert.equal(wantsMarkdown(a), false, a);
});
await proof('Accept: text/markdown gets the page as Markdown: title, description, main part, no markup; the HTML address stays canonical', async () => {
  const html = await call('/about'), md = await call('/about', { accept: AGENT_MD });
  assert.equal(md.status, 200); assert.match(md.headers.get('content-type'), /^text\/markdown/); assert.equal(md.headers.get('link'), `<${BASE}/about>; rel="canonical"`);
  assert.match(md.headers.get('vary'), /accept/); assert.equal(md.headers.get('x-robots-tag'), null, 'the same address, the same page in another form');
  assert.match(md.text, /^# About Mare Liberum/); assert.match(md.text, /^> Mare Liberum, the open sea for agents/m); assert.match(md.text, /Oroboros Design/); assert.match(md.text, /oroborosdesign@gmail\.com/);
  assert.doesNotMatch(md.text, /<(html|head|script|style|meta|div)\b/i); assert.match(md.text, /For agents: https:\/\/mare\.test\/llms\.txt/);
  assert.ok(md.text.length * 2 < html.text.length, `${md.text.length} against ${html.text.length}`);
});
await proof('a browser still gets HTML, and the HTML says it varies with Accept; so does a search engine', async () => {
  const b = await call('/about'); assert.match(b.headers.get('content-type'), /^text\/html/); assert.match(b.headers.get('vary'), /accept/i); assert.match(b.text, /^<!doctype html>/i);
  const g = await call('/about', { ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }); assert.match(g.headers.get('content-type'), /^text\/html/);
});
await proof('.md at the end of an address gives its Markdown twin, kept out of the index; /index.md is the front page; real .md documents stay themselves', async () => {
  const t = await call('/about.md'); assert.equal(t.status, 200); assert.match(t.headers.get('content-type'), /^text\/markdown/);
  assert.equal(t.headers.get('x-robots-tag'), 'noindex, follow'); assert.equal(t.headers.get('link'), `<${BASE}/about>; rel="canonical"`); assert.match(t.text, /^# About Mare Liberum/);
  const hub = await call('/mcp-servers.md'); assert.equal(hub.status, 200); assert.match(hub.text, /^# MCP Server Directory/);
  assert.equal(mdTwin('/index.md'), '/'); assert.equal(mdTwin('/.md'), '/'); assert.equal(mdTwin('/brain.md'), '/brain');
  for (const own of ['/skill.md', '/SKILL.md', '/learn.md', '/offers/sample-report.md', '/brief/cold-email.md', '/site/github.com.md', '/.well-known/agent-skills/mare-liberum/SKILL.md']) assert.equal(mdTwin(own), null, own);
  assert.equal(mdTwin('/about'), null);
  const none = await call('/no-such-page.md'); assert.equal(none.status, 404);
});
await proof('the front page as Markdown is the guide for agents (llms.txt with the price line), canonical to the front page; /index.md too, out of the index', async () => {
  const f = await call('/', { accept: AGENT_MD, site: SITE }); assert.equal(f.status, 200); assert.match(f.headers.get('content-type'), /^text\/markdown/);
  assert.match(f.text, /^# Mare Liberum · the first stop for agents/); assert.match(f.text, /Ask the brain first/); assert.equal(f.headers.get('link'), `<${BASE}/>; rel="canonical"`); assert.equal(f.headers.get('x-robots-tag'), null);
  const t = await call('/index.md', { site: SITE }); assert.equal(t.status, 200); assert.match(t.text, /^# Mare Liberum · the first stop/); assert.equal(t.headers.get('x-robots-tag'), 'noindex, follow');
});
await proof('answers that are data stay data, whatever the Accept; a page Markdown keeps one title line', async () => {
  const p = await call('/pulse', { accept: 'text/markdown' }); assert.match(p.headers.get('content-type'), /^application\/json/);
  const { md } = pageMarkdown('<html><head><title>Same</title><meta name="description" content="A line."></head><body><main><h1>Same</h1><p>Body text that is long enough to be the main part of a page for the reader to keep it.</p><p>' + 'More words here. '.repeat(20) + '</p></main></body></html>', 'https://x.test/p', 'https://x.test');
  assert.equal((md.match(/^# Same$/gm) || []).length, 1); assert.match(md, /^> A line\./m);
});

console.log('search results and empty topics stay out of the index');
await proof('/find?q= is a search result: crawlers follow its links but do not index it; /find itself stays', async () => {
  const f = await call('/find?q=shoes'); assert.equal(f.status, 200); assert.equal(f.headers.get('x-robots-tag'), 'noindex, follow');
  const page = await call('/find'); assert.equal(page.headers.get('x-robots-tag'), null);
});
await proof('a brain topic no pathway fires for is a page for agents, not for the index; with a pathway it is indexed under its topic address', async () => {
  const empty = await call('/brain/proof-seashells'); assert.equal(empty.status, 200); assert.equal(robotsMeta(empty.text), 'noindex, follow');
  const q = await call('/brain?q=proof+seashells'); assert.equal(robotsMeta(q.text), 'noindex, follow');
  const lay = await call(`/lay?q=${encodeURIComponent('proof seashells')}&to=${encodeURIComponent('https://shells.example/guide')}`); assert.equal(lay.status, 200, lay.text);
  const full = await call('/brain/proof-seashells'); assert.equal(robotsMeta(full.text), null); assert.match(full.text, /<link rel="canonical" href="https:\/\/mare\.test\/brain\/proof-seashells">/);
});
await proof('a site that did not answer gets no place in the index', async () => {
  const s = await call('/site/proof-dead.example'); if (s.status === 200) assert.match(s.headers.get('x-robots-tag') || '', /noindex/); else assert.ok([400, 404].includes(s.status), String(s.status));
});

console.log('the thin registrations leave the index and the sitemaps, their pages stay');
await proof('an on-chain registration with one sentence: page for agents (noindex, follow); with a price or a server of its own: indexed', async () => {
  const thin = await call('/e/8004scan.io:agent:1:1'); assert.equal(thin.status, 200); assert.equal(robotsMeta(thin.text), 'noindex, follow'); assert.match(thin.text, /Kladose/);
  const paid = await call('/e/8004scan.io:agent:1:2'); assert.equal(paid.status, 200); assert.equal(robotsMeta(paid.text), null);
  const mcp = await call('/e/mcp.example:mcp:tool'); assert.equal(mcp.status, 200); assert.equal(robotsMeta(mcp.text), null);
});
await proof('the sitemaps name the MCP server and the paid agent, not the thin registration; the count says the same', async () => {
  const sm = (await call('/sitemaps/0.xml')).text;
  assert.match(sm, /\/e\/mcp\.example:mcp:tool</); assert.match(sm, /\/e\/8004scan\.io:agent:1:2</); assert.doesNotMatch(sm, /\/e\/8004scan\.io:agent:1:1</);
  assert.equal((await db('mare_pages_count', {})).count, 2);
});

console.log('the sitemaps carry the day the sea was drawn; robots.txt; who runs it');
// (3.33.0: a lastmod Google can verify, or none. The hubs carry theirs in hubs.xml, an entry its own last change at its
// source, the other pages none; the day of the build only dates the files of the entry maps in the index. node/hubs.mjs)
await proof('a sitemap names a day only where it knows it; the index dates the entry maps by the build; /pricing, a page for people since 3.33.0, stands once, with the hubs', async () => {
  const hubs = (await call('/sitemaps/hubs.xml')).text, today = new Date().toISOString().slice(0, 10);
  // (3.34.0, M3: a live hub such as / names no day before the sea saw its words change, not today on every request; node/tidings.mjs)
  assert.match(hubs, /<loc>https:\/\/mare\.test\/<\/loc><changefreq>/); assert.doesNotMatch(hubs, new RegExp(`<lastmod>${today}</lastmod>`)); assert.match(hubs, /<loc>https:\/\/mare\.test\/about<\/loc>/);
  const site = (await call('/sitemaps/site.xml')).text; assert.doesNotMatch(site, /\/pricing</); assert.doesNotMatch(site, /<lastmod>/);
  // until 3.32.0 /pricing sent people on to /offers and stood in no list; attention/1 made it the page of every price, so the
  // hubs name it once (and only the hubs: a hub stands in no other map of the sea)
  assert.equal(hubs.split('<loc>https://mare.test/pricing</loc>').length, 2, '/pricing once in hubs.xml');
  const pr = await call('/pricing'); assert.equal(pr.status, 200); assert.match(pr.text, /<h1[^>]*>/);
  const entries = (await call('/sitemaps/0.xml')).text; assert.doesNotMatch(entries, /<lastmod>2026-11-20<\/lastmod>/, 'not the day of the build');
  const index = (await call('/sitemap.xml')).text; assert.match(index, /sitemaps\/site\.xml<\/loc><\/sitemap>/); assert.match(index, /sitemaps\/0\.xml<\/loc><lastmod>2026-11-20<\/lastmod>/);
  assert.doesNotMatch(index, /sitemaps\/brain\.xml<\/loc><lastmod>/, 'a list without a known day carries none');
});
await proof('robots.txt: every agent may take every step; search engines and crawlers skip the moves (/go, /d, /via, /rate, /lay, /course/)', () => {
  const r = readFileSync(new URL('../site/robots.txt', import.meta.url), 'utf8'), groups = r.split(/\n(?=User-agent: \S+\n(?!User-agent))/);
  const star = r.slice(r.indexOf('User-agent: *'), r.indexOf('\n\n', r.indexOf('User-agent: *')));
  assert.match(star, /Allow: \//); assert.doesNotMatch(star, /Disallow: \/(go|d|via|rate|lay|course)/);
  const crawl = r.slice(r.indexOf('User-agent: Googlebot'), r.indexOf('Agentmap:'));
  for (const bot of ['Googlebot', 'Bingbot', 'ClaudeBot', 'GPTBot', 'PerplexityBot', 'OAI-SearchBot']) assert.match(crawl, new RegExp(`User-agent: ${bot}\\n`));
  for (const d of ['/r/', '/go/', '/go?', '/d/', '/via/', '/rate/', '/lay?', '/course/']) assert.ok(crawl.includes(`Disallow: ${d}\n`), d);
  assert.doesNotMatch(crawl, /User-agent: (Claude-User|ChatGPT-User|Perplexity-User)/, 'agents acting for a person keep the open group');
  assert.match(r, /^Sitemap: https:\/\/mareliberum\.dev\/sitemap\.xml$/m); assert.ok(groups.length >= 2);
});
await proof('/about says for machines who runs the sea and how to reach them, as the page says it for people', async () => {
  const h = (await call('/about')).text, lds = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  const g = lds.flatMap((x) => x['@graph'] || [x]), about = g.find((x) => x['@type'] === 'AboutPage'), org = g.find((x) => x['@type'] === 'Organization');
  assert.ok(about && org); assert.equal(org.email, 'oroborosdesign@gmail.com'); assert.equal(org.contactPoint.email, 'oroborosdesign@gmail.com');
  assert.deepEqual(org.parentOrganization.address, { '@type': 'PostalAddress', streetAddress: 'Eulenbergstraße 22', postalCode: '51065', addressLocality: 'Köln', addressCountry: 'DE' });
  assert.equal(org.parentOrganization.name, 'Oroboros Design'); assert.equal(org.parentOrganization.founder.name, 'Daouda Ndiaye');
  for (const v of [org.parentOrganization.address.streetAddress, org.email]) assert.ok(h.includes(v), `${v} stands on the page too`);
});

rmSync(dir, { recursive: true, force: true });
console.log(`\n${passed} held, ${failed} failed`);
process.exit(failed ? 1 : 0);
