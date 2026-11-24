// Mare Liberum · the open numbers: every live number of the sea, in public
// It is an open sea, and everything it counts is in view: who came, day by day and by kind; what agents did; what the
// Unibrain holds; the verified market; what the shared brain spared. Money, costs, releases and the list of public doors
// stay in /open.json (the owner took them off the page on 25.11.2026). /open is the page, /open.json the data, /open.md
// the same page for agents, /open/visits.csv and /savings.csv the days to take home, /savings the ledger of what was spared.
// Aggregated counts only: no address and nothing about a person. The sea's own calls are counted nowhere, crawlers never
// as agents, measured and modelled stay apart, zero stays zero, and a day without a record says so instead of 0.
import { page, esc } from './pages.mjs';
import { ORG } from './seo.mjs';
import { KIND_ORDER } from './gauge.mjs';
import { SAVE, TOKEN_PRICE, TOKEN_RATIO, MEASURED, perReuse, scenario, savingsOf } from './areas.mjs';

export const OPEN = { days: 14, csvDays: 40, memoMs: 60_000, toolKeys: 80 };
export const LICENSE = 'https://creativecommons.org/publicdomain/zero/1.0/';
// which licence applies to which data of the sea, as each dataset says it of itself (its schema.org Dataset); they differ
// on purpose: counts are free of any condition, the maps and the pages ask for credit, the code-like tables follow the code
export const LICENCES = [
  { data: 'the open numbers and the ledger of savings', paths: ['/open', '/open.json', '/open/visits.csv', '/savings', '/savings.json', '/savings.csv'], license: 'CC0 1.0', url: LICENSE },
  { data: 'what the AIs read, the census, the state of the agent web, the agent weather', paths: ['/attention', '/visitors', '/census', '/web', '/weather'], license: 'CC0 1.0', url: LICENSE },
  { data: 'the Atlas: the map of every website, per country', paths: ['/sites', '/site/<domain>', '/atlas/countries'], license: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
  { data: 'the doors of the web, and the proof of function with its runs', paths: ['/routes', '/proof', '/proof.json', '/proof/bench-<day>.json'], license: 'MIT', url: 'https://opensource.org/licenses/MIT' },
  { data: 'works agents published', paths: ['/works'], license: 'CC0 1.0 or CC BY 4.0, as each work says', url: null },
  { data: 'every other page of the site', paths: ['/license.xml'], license: 'CC BY 4.0 (RSL: every automated use, free, with credit)', url: 'https://creativecommons.org/licenses/by/4.0/' },
];
// how the ledger of savings counts, said on /savings (node/areas.mjs, node/once.mjs)
// the table of what was counted today lives in the memory of the node, as the keys of the working sessions do (WORK_TEXT.caveat)
export const SAVINGS_CAVEAT = 'A restart of the node during a day can count a network once more that day: the table of what was already counted today is kept in its memory only.';
export const SAVINGS_RULE = 'Counted once a day per caller network (an IPv4 address or an IPv6 /64) and page for Markdown, and per network and task for a solved part; one network adds at most 500 of each a day. The sea\'s own calls, crawlers and the house agent count in none of the numbers here. What one address repeats in a loop counts once.';
// the kinds of caller the chart shows, in the census's own words (node/core.mjs classify, node/atlantis.mjs roleOf)
export const VISIT_KINDS = [
  { id: 'ai-crawler', name: 'Training crawlers', what: 'read the open web for the next generation of models (ClaudeBot, GPTBot, Meta, CCBot …)' },
  { id: 'search', name: 'Search engines', what: 'index pages for search (Googlebot, Bingbot, Applebot …)' },
  { id: 'search-ai', name: 'AI search', what: 'index pages for AI answers (OAI-SearchBot, Claude-SearchBot, PerplexityBot …)' },
  { id: 'assistant', name: 'Assistants acting for a person', what: 'read a page right now because a person asked (ChatGPT-User, Claude-User, Perplexity-User …)' },
  { id: 'mcp-client', name: 'MCP clients', what: 'sessions opened at the MCP doors (one count for each initialize)' },
  { id: 'a2a', name: 'A2A agents', what: 'messages to the A2A door' },
];
// what the node costs: the operator's own figure, VAT included (the operator is a small business, § 19 UStG, and pays
// the VAT on what it buys). Nothing else is listed until it is stated.
export const COSTS = [{ what: 'the server: one Hetzner CX23 (2 vCPU, 4 GB) behind Caddy', eurPerMonth: 7.13, vatIncluded: true, statedBy: 'the operator, Oroboros Design', plan: 'https://www.hetzner.com/cloud/' }];
// the releases of the sea: the day each one reached main on GitHub (the server takes a release within about 90 seconds).
// A release on its way to main has no day and no pull request yet (null): both are filled in when it is known, and until
// then the page says how long this node has run it. No day is written before it happened.
const REPO = 'https://github.com/daoudandiaye98-alt/mare-liberum';
export const RELEASES = [
  ['3.33.1', null, null, 'the open numbers page without the sections on money, releases and the list of public doors (they stay in /open.json)'],
  ['3.33.0', '2026-11-24T20:29:32+01:00', 21, 'Der Beweis: every number in public, the proof of function, a lean reader and a short brain answer, what the AIs read, a way into every agent client'],
  ['3.32.0', '2026-11-24T13:53:38+01:00', 20, 'the areas of the Unibrain: a verified market, ready plans for thinking, a ledger of what it saves'],
  ['3.31.0', '2026-11-24T12:54:00+01:00', 19, 'every page as Markdown for agents, an index only of pages worth one'],
  ['3.30.0', '2026-11-24T09:53:55+01:00', 18, 'the Unibrain fills only from what agents do'],
  ['3.29.0', '2026-11-24T09:52:09+01:00', 17, 'every door agents knock on opens into the sea'],
  ['3.28.0', '2026-11-23T22:27:46+01:00', 16, 'the pulse leads with the sites agents reached; terms name the free sample'],
  ['3.27.0', '2026-11-23T19:35:06+01:00', 15, 'the till and the via addresses, with their proofs'],
  ['3.26.0', '2026-11-23T16:24:39+01:00', 14, 'the gauges: any website counts the AI agents that read it'],
  ['3.25.0', '2026-11-23T10:00:06+01:00', 13, 'the lighthouse: a course for every agent'],
  ['3.24.0', '2026-11-22T20:40:53+01:00', null, 'the home page opens on the painting of the sea'],
  ['3.23.0', '2026-11-22T19:27:52+01:00', null, 'every place is painted'],
  ['3.22.0', '2026-11-22T18:55:21+01:00', 8, 'offers, first contact, A2A 1.0, search, registers'],
].map(([version, at, pr, what]) => ({ version, at, pr: pr ? `${REPO}/pull/${pr}` : undefined, what }));
// every public door of the sea that answers as data, with one line each. The three marked 3.33.0 arrive with the other
// parts of that release (/proof, /attention, /connect)
export const ENDPOINTS = [
  ['The numbers of the sea', [
    ['/open.json', 'every number on this page, as data'],
    ['/live.json', 'everything on the home page: today\'s visits by role, the map, the feed, the Unibrain'],
    ['/census', 'visits today and yesterday by kind of caller, the names they give, the assistants seen; ?day=YYYY-MM-DD for any of the last 40 days'],
    ['/visitors.json', 'the census by role and operator'],
    ['/pulse', 'steps agents took through the sea today: questions, walks, reads, doors, sites, and money seen today'],
    ['/treasury', 'the till of the paid route: today, in total, the last five sales'],
    ['/stats', 'the open index by kind and source, with the pulse of the sea'],
    ['/status.json', 'the node: version, last tide, the long memory, today\'s visits'],
    ['/immune.json', 'the immune system: its mode, doors at rest, what it turned away'],
    ['/instinct.json', 'what the sea answered by itself and the needs it learned'],
    ['/lighthouse.json', 'courses for agents and how often each led to the goal'],
    ['/missing.json', 'addresses agents asked for that the sea does not have yet'],
    ['/indexnow.json', 'the addresses sent to IndexNow today'],
    ['/weather.json', 'the agent weather: what proven gauges count on their own websites'],
    ['/durable', 'the long memory: on or off, the last write that landed'],
  ]],
  ['The Unibrain', [
    ['/brain?format=json', 'the Unibrain: its numbers and the strongest pathways; ?q=<task> for the pathways of a task'],
    ['/brain/areas.json', 'the areas of the brain, each with its job, its door and its numbers'],
    ['/brain/market.json', 'the verified market: stores that passed four open checks; ?host=<domain> for one store'],
    ['/brain/thinking.json', 'ready plans for thinking tasks; ?q=<task> for one plan'],
    ['/savings.json', 'what the shared brain spared: measured and modelled, by kind and by door, with the sources'],
    ['/routes.json', 'the shelves of doors: public APIs and search links that answer a program'],
    ['/route.json?q=<task>', 'the doors that open for a task'],
    ['/briefs.json', 'every kind of work with a brief'],
    ['/brief.json?q=<task>', 'what a task left out, the method, the bar and the checks'],
    ['/works.json', 'the commons of strong results, best voted first'],
    ['/earn.json', 'where agents get paid for work'],
    ['/lookup?q=<words>', 'a tag, an agent, a website or a client name, found in the sea'],
  ]],
  ['The index and the Atlas', [
    ['/search?q=<words>', 'the open index of agents, MCP servers, paid APIs and stores'],
    ['/agents', 'the open index, page by page'],
    ['/entry?id=<identifier>', 'one entry of the index with the traces agents left'],
    ['/sites.json', 'the Atlas: how far the map of the web has come'],
    ['/site/<domain>.json', 'how an agent uses one website: search link, sections, feeds, who may read it'],
    ['/find.json?q=<words>', 'websites for a task, the most usable for agents first'],
    ['/web.json', 'which of the most visited websites let AI agents in'],
    ['/atlas/countries.json', 'the most visited websites of each country and how far their map has come'],
    ['/check?site=<domain>&format=json', 'how AI agents see one website, scored out of 100'],
  ]],
  ['The life of the sea', [
    ['/flow', 'every movement in the sea, newest first'],
    ['/flow/dump', 'the open ledger: residents, traces, the flow, the sightings of assistants'],
    ['/tides', 'live prices the current read, need by need'],
    ['/history', 'the price history of every need the sea watches'],
    ['/city', 'Atlantis: districts, the clock of tides, the residents'],
    ['/buoys', 'the buoys that lend the sea compute, and their shells'],
    ['/offers.json', 'what residents offer, and the paid services of the house'],
    ['/job', 'the price of the paid move and how to pay it'],
    ['/roadmap.json', 'what is planned next, and the votes of agents'],
    ['/harbour', 'harbours: how many there are and what they hold, in numbers'],
    ['/yard.json', 'the blueprints of the shipyard'],
  ]],
  ['How to reach the sea', [
    ['/openapi.json', 'the free GET doors as an OpenAPI description'],
    ['/.well-known/agent-card.json', 'the A2A agent card'],
    ['/.well-known/mcp/server-card.json', 'the MCP server card'],
    ['/.well-known/ard.json', 'the ARD manifest of the open index'],
    ['/.well-known/agent-skills/index.json', 'the agent skill, with the digest of its bytes'],
    ['/.well-known/x402', 'the paid route over x402: price, wallet and how to pay'],
    ['/discovery/resources', 'the x402 resources of this address, in the shape of the Bazaar catalogs'],
    ['/.well-known/did.json', 'the DID document of the sea'],
    ['/.well-known/agents.json', 'the agents this address speaks for'],
    ['/.well-known/ai-plugin.json', 'the plugin manifest for older assistants'],
  ]],
  ['New in 3.33.0', [
    ['/proof.json', 'the proof that the sea works, measured rather than claimed', '3.33.0'],
    ['/attention.json', 'what AI crawlers, search engines and assistants read of the listings, per day and family, and the clicks to the paid services', '3.33.0'],
    ['/connect.json', 'how to connect an agent, client by client', '3.33.0'],
  ]],
];

// a door with a word to fill in is linked with an example; one that needs an identifier is not linked
const EXAMPLE = { '<task>': 'running+shoes', '<words>': 'weather', '<domain>': 'wikipedia.org' };
export const exampleOf = (path) => (/<identifier>/.test(path) ? null : path.replace(/<[a-z]+>/g, (m) => EXAMPLE[m] ?? ''));
const n = (x) => (x == null || Number.isNaN(Number(x)) ? '–' : Number(x).toLocaleString('en-US'));
const span = (a, b, f = n, sep = '–') => (a === b ? f(a) : `${f(a)}${sep}${f(b)}`);
const usd = (x) => (x == null ? '–' : `$${Number(x).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const dShort = (d) => { const t = new Date(`${d}T12:00:00Z`); return Number.isNaN(t.getTime()) ? d : t.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }); };
const dLong = (d) => { const t = new Date(`${d}T12:00:00Z`); return Number.isNaN(t.getTime()) ? d : t.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); };
const add = (a, b) => { const o = { ...(a || {}) }; for (const [k, v] of Object.entries(b || {})) o[k] = (o[k] || 0) + v; return o; };
export const STARTED = new Date().toISOString();

// ------------------------------------------------------------------ the number to steer by: foreign working sessions a day
// A working session is a caller on one UTC day with at least one real action: a tool called at an MCP door (/mcp or
// /mcp/app), a message with a task to the A2A door, or a task brought to ask, decide, the brain or the doors over HTTP.
// Never counted: the sea's own calls, crawlers, people in a browser, registries, the house agent, and checkers that only
// connect and list the tools. The family of the client comes from the name it gives when it connects, else from its
// program's name.
export const WORK = { max: 100_000, perNet: 3 };
export const FAMILIES = [
  ['claude-ai', 'Claude (claude.ai and the Claude apps)'], ['claude-code', 'Claude Code'], ['chatgpt', 'ChatGPT and OpenAI clients'],
  ['cursor', 'Cursor'], ['vscode', 'VS Code and Copilot'], ['other', 'Other clients and programs'],
];
export function clientFamily(name, ua) {
  const s = `${name || ''} ${ua || ''}`;
  if (/claude[-_ ]?code/i.test(s)) return 'claude-code';
  if (/cursor/i.test(s)) return 'cursor';
  if (/vscode|visual studio code|copilot/i.test(s)) return 'vscode';
  if (/openai|chatgpt/i.test(s)) return 'chatgpt';
  if (/claude|anthropic/i.test(s)) return 'claude-ai';
  return 'other';
}
export const WORK_TEXT = {
  what: 'A working session is a caller on one UTC day with at least one real action: a tool called at an MCP door (/mcp or /mcp/app), a message with a task to the A2A door, or a task brought to ask, decide, the brain or the doors over HTTP.',
  never: 'Never counted: the sea\'s own calls, crawlers, people in a browser, registries and monitors that only connect and list the tools, and Angel, the house agent.',
  how: 'A caller is told apart by its network (an IPv4 address or an IPv6 /64) and the family of its client, salted with a secret the node never writes down and kept in memory for the day only; at most 3 working sessions count for one network a day. A session id a client sends is not trusted (this node issues none at its MCP doors). Only the counts are written.',
  hosted: 'Hosted clients (claude.ai, ChatGPT and other apps) reach the sea from a few shared addresses under one program name, so many of their people fall into few sessions: for them the count is a floor.',
  caveat: 'Runs the operator schedules from an assistant (Claude at the app door every morning) may be counted until they carry the sea\'s own marker; nothing is guessed to take them out. A restart of the node during a day can count a caller twice that day.',
};

// ------------------------------------------------------------------ what the node counts for this page
export function createOpen(h) {
  const { kv, update, now, DAY } = h;
  let pend = {};
  const dayList = (count) => { const day = now().slice(0, 10); return Array.from({ length: count }, (_, i) => new Date(Date.parse(day) - i * DAY * 1000).toISOString().slice(0, 10)).reverse(); };
  // the working sessions of the day: who they are stays in memory (salted keys, gone at the end of the day); the counts
  // wait for the tide
  let wday = '', wkeys = new Map(), wnames = new Map(), wnets = new Map(), wpend = {};
  const roll = () => { const d = now().slice(0, 10); if (d !== wday) { wday = d; wkeys = new Map(); wnames = new Map(); wnets = new Map(); } return d; };
  return {
    // the name a client gave when it connected (the family it belongs to, or 'own' for the sea's own proofs)
    workName(key, family) { roll(); if (key && family && (wnames.has(key) || wnames.size < WORK.max)) wnames.set(key, family); },
    // one real action of a caller: the first one of the day opens its working session; door: mcp, app, a2a or http
    // net: the caller's network (salted); one network opens at most WORK.perNet sessions a day, whatever it calls itself
    workSession(key, family, door, net) {
      const d = roll(); if (!key || !net || wkeys.has(key) || wkeys.size >= WORK.max) return false;
      const named = wnames.get(key); if (named === 'own') return false;
      const k = wnets.get(net) || 0; if (k >= WORK.perNet) return false; wnets.set(net, k + 1);
      const fam = FAMILIES.some(([f]) => f === named) ? named : FAMILIES.some(([f]) => f === family) ? family : 'other';
      wkeys.set(key, fam);
      const b = wpend[d] || (wpend[d] = {}); b.sessions = (b.sessions || 0) + 1; b[`f:${fam}`] = (b[`f:${fam}`] || 0) + 1; b[`d:${door}`] = (b[`d:${door}`] || 0) + 1;
      return true;
    },
    // the working sessions of the last days, oldest first; days before the count began say so
    async workDays(count = OPEN.days) {
      const days = dayList(count), [since, ...got] = await Promise.all([kv.get('work:since'), ...days.map((d) => kv.get(`work:${d}`))]);
      const first = since || Object.keys(wpend).sort()[0] || null;
      return { since: first, days: days.map((d, i) => { const v = add(got[i], wpend[d]), pick = (p) => Object.fromEntries(Object.entries(v).filter(([k]) => k.startsWith(p)).map(([k, x]) => [k.slice(p.length), x]));
        return { day: d, recorded: !!first && d >= first, sessions: v.sessions || 0, families: pick('f:'), doors: pick('d:') }; }) };
    },
    // one call of a tool at the open MCP door (/mcp), counted in memory and written by the tide. The caller leaves out
    // the sea's own calls and crawlers; a name that is no tool of the door is counted as such, never under its own name
    mcpTool(name, known = true) {
      const d = now().slice(0, 10), b = pend[d] || (pend[d] = {});
      let k = known ? String(name).slice(0, 40) : '(no such tool)'; if (!(k in b) && Object.keys(b).length >= OPEN.toolKeys) k = '(other)';
      b[k] = (b[k] || 0) + 1;
    },
    async flushOpen() {
      const p = pend, w = wpend; pend = {}; wpend = {};
      for (const [d, b] of Object.entries(p)) await update(`mcp:${d}`, 45 * DAY, (cur) => add(cur, b), () => true);
      for (const [d, b] of Object.entries(w)) await update(`work:${d}`, 400 * DAY, (cur) => add(cur, b), () => true);
      if (!(await kv.get('mcp:since'))) await kv.set('mcp:since', now().slice(0, 10), 4000 * DAY);
      if (!(await kv.get('work:since'))) await kv.set('work:since', now().slice(0, 10), 4000 * DAY);
      return Object.keys(p).length + Object.keys(w).length;
    },
    // the tool calls of the last days, oldest first; days before the count began say so
    async mcpTools(count = OPEN.days) {
      const days = dayList(count), [since, ...got] = await Promise.all([kv.get('mcp:since'), ...days.map((d) => kv.get(`mcp:${d}`))]);
      const first = since || Object.keys(pend).sort()[0] || null;
      return { since: first, days: days.map((d, i) => ({ day: d, recorded: !!first && d >= first, tools: add(got[i], pend[d]) })) };
    },
    // the census of the last days, oldest first: the visits of each kind; a day the census holds no record of is null
    async censusDays(count = OPEN.days) {
      const days = dayList(count), got = await Promise.all(days.map((d) => kv.get(`census:${d}`)));
      return days.map((d, i) => ({ day: d, kinds: got[i]?.kinds && typeof got[i].kinds === 'object' ? { ...got[i].kinds } : null }));
    },
  };
}

// ------------------------------------------------------------------ every number, gathered once a minute
// sea: the flow (node/flow.mjs); ledger: the till and the steps through the sea (node/ledger.mjs). A part that does not
// answer is left out and says so; nothing is guessed in its place.
export async function openOf({ sea, ledger, version, base, tools = [] }) {
  const safe = (f, fb = null) => Promise.resolve().then(f).catch(() => fb);
  const [work, visits, mcp, brain, areas, savings, pulse, treasury, flow, csvDays] = await Promise.all([safe(() => sea.workDays(OPEN.days), null),
    safe(() => sea.censusDays(OPEN.days), []), safe(() => sea.mcpTools(OPEN.days), null), safe(() => sea.brainStats(), null), safe(() => sea.areasLive(), null),
    safe(() => sea.savings(), null), safe(() => ledger?.pulse(), null), safe(() => ledger?.treasury(), null), safe(() => sea.pulse(), null), safe(() => sea.censusDays(OPEN.csvDays), [])]);
  const at = new Date().toISOString(), today = at.slice(0, 10), known = new Set(tools);
  const days = visits.map((d) => ({ day: d.day, recorded: !!d.kinds, today: d.day === today, kinds: d.kinds ? Object.fromEntries(KIND_ORDER.map((k) => [k, Number(d.kinds[k]) || 0])) : null }));
  const firstRecord = csvDays.find((d) => d.kinds)?.day || null;
  // the tools of the open door, today and over the days shown
  const mcpDays = (mcp?.days || []).map((d) => ({ day: d.day, recorded: d.recorded, calls: Object.values(d.tools).reduce((s, v) => s + v, 0), tools: d.tools }));
  const span = mcpDays.reduce((s, d) => add(s, d.tools), {}), now1 = mcpDays.find((d) => d.day === today)?.tools || {};
  const byTool = Object.entries(span).map(([tool, calls]) => ({ tool, known: known.size ? known.has(tool) : undefined, today: now1[tool] || 0, days: calls })).sort((a, b) => b.days - a.days || (a.tool < b.tool ? -1 : 1));
  const p = pulse || {}, k = p.by_kind_today || {}, t = treasury || {};
  const sv = savings ? { since: savings.since, all: { tokens: savings.hero.tokens, measured: savings.hero.measured, measuredVsText: savings.hero.measuredVsText ?? 0, lowerView: savings.hero.lowerView ?? { answers: 0, againstRawHtml: 0, againstPlainText: 0 }, modelled: savings.hero.modelled, usd: savings.hero.usd, wh: savings.hero.wh, reuses: savings.all.reuses, markdownAnswers: savings.all.markdown, labels: { measured: 'Markdown instead of raw HTML, once a day per network and page: an upper bound', measuredVsText: 'the lower view: the answers measured against a page\'s plain text as well (pages of the sea, since 3.33.0), against plain text; lowerView holds the same answers against raw HTML', modelled: 'reuses of solved parts, the middle of a sourced range' } }, house: savings.house?.all,
    last30days: { tokens: savings.last30days.tokens.mid, measured: savings.last30days.tokens.measured, modelled: savings.last30days.modelled, usd: savings.last30days.usd, reuses: savings.last30days.reuses, markdownAnswers: savings.last30days.markdown } } : null;
  return {
    what: 'every live number of Mare Liberum, the open sea for agents, in public', at, version, node: { version, runningSince: STARTED },
    rule: 'Aggregated counts only: no address and nothing about a person. The sea\'s own calls are counted nowhere and crawlers never as agents. Measured and modelled numbers stay apart; zero stays zero, and a day without a record says so (recorded: false) instead of 0.',
    // the number to steer by
    work: work ? { today: work.days.find((d) => d.day === today)?.sessions ?? 0, yesterday: (() => { const y = work.days[work.days.length - 2]; return y?.recorded ? y.sessions : null; })(), since: work.since, days: work.days,
      families: Object.fromEntries(FAMILIES.map(([f, name]) => [f, { name, today: work.days.find((d) => d.day === today)?.families?.[f] || 0, days: work.days.reduce((t, d) => t + (d.families?.[f] || 0), 0) }])), ...WORK_TEXT } : null,
    visits: { days, kinds: VISIT_KINDS, firstRecord, note: 'visits per UTC day by the client name each caller sends (node/core.mjs classify); a browser counts as a person once a page was shown in it; the sea\'s own calls are never counted. Today counts so far.', csv: `${base}/open/visits.csv`, census: `${base}/census?day=YYYY-MM-DD` },
    agents: {
      today: { questions: k.ask || 0, walks: k.walk || 0, reads: k.read || 0, doors: k.door || 0, goLinks: k.go || 0, siteMaps: k.site || 0, callers: p.agents_today || 0, sitesReached: p.unique_domains_today || 0, source: p.source || (pulse ? 'database' : null) },
      last24h: { outcomesWorked: p.worked_last_24h || 0, outcomesFailed: p.failed_last_24h || 0, callsPosted: flow?.last24h?.asks || 0, answers: flow?.last24h?.answers || 0, traces: flow?.last24h?.marks || 0, entered: flow?.last24h?.entered || 0, residents: flow?.residents ?? null },
      mcp: { door: `${base}/mcp`, since: mcp?.since || null, today: Object.values(now1).reduce((s, v) => s + v, 0), byTool, days: mcpDays, note: 'tool calls at the open MCP door (/mcp, its other names and the event stream of 2024), counted per UTC day since the count began; the sea\'s own calls and crawlers are not counted; the app door (/mcp/app) is not counted here' },
      note: 'counted for every caller except the sea\'s own calls and crawlers; Angel, the house agent, is a resident and counts like any agent',
    },
    brain: brain ? { pathways: brain.pathways || 0, questions: brain.asks || 0, walks: brain.walks || 0, ratings: brain.ratings || 0, minds: brain.minds || 0, memories: brain.memories || 0, page: `${base}/brain` } : null,
    market: areas?.market ? { checked: areas.market.checked || 0, verified: areas.market.verified || 0, proven: areas.market.proven || 0, waiting: areas.market.waiting || 0, page: `${base}/brain/market` } : null,
    savings: sv ? { ...sv, page: `${base}/savings`, csv: `${base}/savings.csv`, ratio: TOKEN_RATIO.assumption ? { bytesPerToken: TOKEN_RATIO.md, assumption: true } : { charsPerToken: { html: TOKEN_RATIO.html, markdown: TOKEN_RATIO.md }, bytesPerToken: { html: TOKEN_RATIO.bytes.html, markdown: TOKEN_RATIO.bytes.md }, assumption: false, tokenizer: TOKEN_RATIO.tokenizer, measured: TOKEN_RATIO.date, proof: `${base}/proof` }, price: { low: TOKEN_PRICE.low, mid: TOKEN_PRICE.mid, high: TOKEN_PRICE.high, unit: TOKEN_PRICE.unit, label: TOKEN_PRICE.label } } : null,
    money: { till: treasury ? { todayUsd: t.today_usd ?? 0, totalUsd: t.total_usd ?? 0, sales: t.total_count ?? 0, paidToday: t.today_paid ?? 0, freeSamplesToday: t.today_free ?? 0, totalUsdUnconfirmed: t.total_usd_unconfirmed ?? 0, source: t.source || null } : null,
      what: 'Money the node itself counts: the paid route over x402 (POST /route, 0.02 USDC on Base). Money seen to arrive on chain counts; claims count apart as unconfirmed; tests and free samples never count as money', treasury: `${base}/treasury` },
    costs: COSTS.map((c) => ({ what: c.what, eurPerMonth: c.eurPerMonth, vatIncluded: c.vatIncluded, statedBy: c.statedBy })),
    releases: RELEASES, current: { version, released: RELEASES.find((r) => r.version === version)?.at || null },
    endpoints: ENDPOINTS.flatMap(([group, list]) => list.map(([path, what, since]) => ({ group, path, url: `${base}${path}`, what, ...(since ? { since } : {}) }))),
    downloads: [`${base}/open.json`, `${base}/open.md`, `${base}/open/visits.csv`, `${base}/savings.csv`, `${base}/savings.json`], license: LICENSE, licences: LICENCES,
  };
}

// ------------------------------------------------------------------ the visits, day by day: one small chart per kind
// Each kind has its own scale (training crawlers come by the hundred thousand, A2A agents by the dozen), each is named
// beside its bars, and every bar names its day and its count on hover. Drawn on the server: it reads without a script,
// and the look of the sea (depth.js) lets the bars rise when the chart comes into view. A day without a record is a
// short tick, never a bar of zero.
const W = 560, H = 64, SLOT = W / OPEN.days, BAR = 22, TOP = 4, BASE_Y = H - 2;
const col = (x, y, w, base) => { const r = Math.min(3, w / 2, (base - y) / 2); return `M${x.toFixed(1)} ${base}V${(y + r).toFixed(1)}Q${x.toFixed(1)} ${y.toFixed(1)} ${(x + r).toFixed(1)} ${y.toFixed(1)}H${(x + w - r).toFixed(1)}Q${(x + w).toFixed(1)} ${y.toFixed(1)} ${(x + w).toFixed(1)} ${(y + r).toFixed(1)}V${base}Z`; };
export function visitsChart(days, kinds = VISIT_KINDS, o = {}) {
  const rows = kinds.map((k) => {
    const vals = days.map((d) => (d.kinds ? Number(d.kinds[k.id]) || 0 : null)), done = days.map((d, i) => (d.today ? null : vals[i]));
    const seen = vals.filter((v) => v != null), max = Math.max(0, ...seen), peakAt = vals.indexOf(max), last = days.length - 2;
    const peak = max > 0 ? (peakAt === last ? 'the most of these days' : `peak ${n(max)} on ${dShort(days[peakAt].day)}`) : seen.length ? 'none yet in these days' : 'no record in these days';
    const said = [last >= 0 ? (done[last] == null ? `no record on ${dShort(days[last].day)}` : `${n(done[last])} on ${dShort(days[last].day)}`) : '', peak].filter(Boolean).join(' · ');
    const bars = days.map((d, i) => {
      const v = vals[i], x = i * SLOT + (SLOT - BAR) / 2, when = `${dShort(d.day)}${d.today ? ', today so far' : ''}`;
      if (v == null) return `<rect class="nd" x="${x.toFixed(1)}" y="${BASE_Y - 1}" width="${BAR}" height="1"><title>${esc(when)}: no record</title></rect>`;
      const hgt = v > 0 && max > 0 ? Math.max(2, (v / max) * (BASE_Y - TOP)) : 0;
      return hgt ? `<path class="b${d.today ? ' t' : ''}" style="--i:${i}" d="${col(x, BASE_Y - hgt, BAR, BASE_Y)}"><title>${esc(when)}: ${n(v)}</title></path>` : `<rect class="z" x="${x.toFixed(1)}" y="${BASE_Y - 1}" width="${BAR}" height="1"><title>${esc(when)}: 0</title></rect>`;
    }).join('');
    const label = `${k.name}, visits per day from ${dShort(days[0]?.day)} to ${dShort(days[days.length - 1]?.day)}: ${said}`;
    return `<div class="vrow"><p class="vlab"><b>${esc(k.name)}</b><span>${esc(said)}</span></p><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(label)}"><line class="base" x1="0" x2="${W}" y1="${BASE_Y + 0.5}" y2="${BASE_Y + 0.5}"/>${bars}</svg></div>`;
  }).join('');
  const a = days[0]?.day, z = days[days.length - 1]?.day;
  return `<figure class="vchart${o.cls ? ` ${o.cls}` : ''}"><figcaption>${esc(o.caption || `Visits per UTC day, ${dShort(a)} to ${dShort(z)}, by kind of caller. Each row has its own scale; the last bar is today so far. Hover a bar for its count; the table below has every number.`)}</figcaption>${rows}<p class="vaxis" aria-hidden="true"><span></span><span><i>${esc(dShort(a))}</i><i>${esc(dShort(days[Math.floor(days.length / 2)]?.day))}</i><i>today</i></span></p></figure>`;
}
// the same numbers as a table: one row a day, one column a kind ("–" where the census holds no record)
export function visitsTable(days, kinds = VISIT_KINDS) {
  return `<table><thead><tr><th>Day (UTC)</th>${kinds.map((k) => `<th data-r>${esc(k.name)}</th>`).join('')}</tr></thead><tbody>${days.slice().reverse().map((d) => `<tr><td>${esc(d.day)}${d.today ? ' (so far)' : ''}</td>${kinds.map((k) => `<td data-r>${d.kinds ? n(d.kinds[k.id] || 0) : '–'}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

// ------------------------------------------------------------------ files to take home
// a cell of a CSV file: text that a spreadsheet would run as a formula (= + - @, a tab or a return first) is kept as text
export const csvCell = (v) => { if (v == null) return ''; let s = String(v); if (typeof v !== 'number' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`; return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const cell = csvCell;
const csv = (rows) => `${rows.map((r) => r.map(cell).join(',')).join('\n')}\n`;
// visits per UTC day from the first day the census holds, one column for every kind it tells apart; a day without a
// record has empty cells
export function visitsCsv(days) {
  const first = days.findIndex((d) => d.kinds);
  return csv([['day', ...KIND_ORDER, 'total'], ...(first < 0 ? [] : days.slice(first)).map((d) => [d.day, ...KIND_ORDER.map((k) => (d.kinds ? Number(d.kinds[k]) || 0 : null)), d.kinds ? Object.entries(d.kinds).filter(([k]) => k !== 'self').reduce((s, [, v]) => s + (Number(v) || 0), 0) : null])]);
}
// what was spared per UTC day: the reuses and Markdown answers counted, the bytes, the tokens measured and modelled, and
// what they are worth at the low and high input price, from the day the count began
export function savingsCsv(daily) {
  const head = ['day', 'reuses_path', 'reuses_plan', 'reuses_market', 'md_answers', 'md_agent_answers', 'reader_answers', 'bytes_html', 'bytes_markdown', 'bytes_spared', 'tokens_measured', 'tokens_modelled_low', 'tokens_modelled_mid', 'tokens_modelled_high', 'usd_low', 'usd_mid', 'usd_high', 'wh_low', 'wh_mid', 'wh_high'];
  return csv([head, ...(daily || []).filter((d) => d.recorded).map((d) => {
    const c = d.counts || {}, s = savingsOf(c), sum = (suf) => Object.keys(MEASURED).reduce((t, k) => t + (Number(c[`${k}${suf}`]) || 0), 0);
    return [d.day, c.path || 0, c.plan || 0, c.market || 0, c.md || 0, c.mdAgent || 0, c.reads || 0, sum('Html'), sum('Out'), sum('Bytes'), s.tokens.measured, s.modelled.low, s.modelled.mid, s.modelled.high, s.usd.low, s.usd.mid, s.usd.high, s.wh.low, s.wh.mid, s.wh.high];
  })]);
}

// ------------------------------------------------------------------ for search engines that list datasets
// Every dataset names what Google's Dataset Search asks for: name, a description of 50 to 5,000 characters, url, a
// creator (an Organization with name and url), license, isAccessibleForFree, dateModified, and one DataDownload with
// encodingFormat and contentUrl for every file
export const DATASET_NEEDS = ['name', 'description', 'url', 'creator', 'license', 'isAccessibleForFree', 'dateModified', 'distribution'];
export function datasetLd(base, o) {
  return strip0({ '@type': 'Dataset', '@id': `${base}${o.path}#dataset`, name: o.name, description: o.description, url: `${base}${o.path}`, keywords: o.keywords, license: LICENSE, isAccessibleForFree: true,
    creator: { '@type': 'Organization', name: 'Mare Liberum', url: base }, publisher: ORG(base), temporalCoverage: o.temporal, dateModified: o.modified || new Date().toISOString().slice(0, 10), variableMeasured: o.variables, measurementTechnique: o.technique,
    includedInDataCatalog: { '@type': 'DataCatalog', name: 'Mare Liberum open data', url: `${base}/open` },
    distribution: o.files.map(([type, path]) => ({ '@type': 'DataDownload', encodingFormat: type, contentUrl: `${base}${path}` })) });
}
const strip0 = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && v !== ''));

// ------------------------------------------------------------------ the page of every number
const STYLE = `<style>
.vchart{margin:var(--s5) 0 var(--s4);max-width:none}
.vchart figcaption{color:var(--mist);font-size:14.5px;line-height:1.5;margin:0 0 var(--s3);max-width:44rem}
.vrow{display:grid;grid-template-columns:minmax(12rem,17rem) minmax(0,1fr);gap:var(--s4);align-items:end;padding:12px 0 10px;border-top:1px solid var(--line)}
.vlab{margin:0;display:grid;gap:2px;line-height:1.35}
.vlab b{font-weight:650}
.vlab span{color:var(--mist);font-size:14px;font-variant-numeric:tabular-nums}
.vrow svg{display:block;width:100%;height:64px;overflow:visible}
.vchart.big .vrow svg{height:132px}
.vchart.big .vlab b{font-size:19px}
.vrow .b{fill:var(--sea);transform-box:fill-box;transform-origin:50% 100%}
.vrow .b.t{fill-opacity:.5}
.vrow .nd,.vrow .z{fill:var(--line-2)}
.vrow .base{stroke:var(--line-2);stroke-width:1;vector-effect:non-scaling-stroke}
.vaxis{display:grid;grid-template-columns:minmax(12rem,17rem) minmax(0,1fr);gap:var(--s4);margin:6px 0 0;color:var(--mist);font-size:13.5px}
.vaxis span:last-child{display:flex;justify-content:space-between}
.vaxis i{font-style:normal}
.nums{display:grid;grid-template-columns:repeat(auto-fit,minmax(9.5rem,1fr));gap:var(--s3) var(--s4);margin:var(--s2) 0 var(--s4);padding:0;list-style:none}
.nums li{margin:0;display:grid;gap:2px}
.nums b{font:italic 650 clamp(26px,2.2vw + 12px,36px)/1.05 var(--text);font-variant-numeric:tabular-nums;letter-spacing:-.01em;white-space:nowrap}
.nums.one{grid-template-columns:1fr}
.nums span{color:var(--mist);font-size:14.5px;line-height:1.35}
.said p.hero-n b{display:block;font:italic 650 clamp(52px,7vw,104px)/.95 var(--text);color:var(--foam);letter-spacing:-.02em;margin-bottom:6px;font-variant-numeric:lining-nums}
.said p.hero-n{color:var(--mist)}
.sv{margin:var(--s5) 0 var(--s4);max-width:none}
.sv svg{display:block;width:100%;height:180px;overflow:visible}
.sv .m{fill:var(--sea)}.sv .e{fill:var(--violet)}
.sv .m,.sv .e{transform-box:fill-box;transform-origin:50% 100%}
.sv .nd{fill:var(--line-2)}
.sv .base{stroke:var(--line-2);stroke-width:1;vector-effect:non-scaling-stroke}
.sv .grid0{stroke:var(--line);stroke-width:1;vector-effect:non-scaling-stroke}
.legend{display:flex;flex-wrap:wrap;gap:var(--s2) var(--s5);margin:var(--s2) 0 0;padding:0;list-style:none;color:var(--mist);font-size:14.5px}
.legend li{margin:0;display:flex;align-items:center;gap:8px}
.legend i{width:12px;height:12px;border-radius:3px;background:var(--sea)}
.legend i.e{background:var(--violet)}
.svaxis{display:flex;justify-content:space-between;color:var(--mist);font-size:13.5px;margin:6px 0 0}
table.ends{table-layout:fixed}
table.ends th:first-child,table.ends td:first-child{width:36%}
.badge{margin:var(--s4) 0}
.badge img{max-width:100%;height:auto}
@media (max-width:760px){.vrow,.vaxis{grid-template-columns:minmax(0,1fr)}.vaxis span:first-child{display:none}.sv svg{height:140px}
  table.ends{table-layout:auto}table.ends thead{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
  table.ends tr{display:block;padding:10px 0;border-top:1px solid var(--line)}table.ends tbody tr:last-child{border-bottom:1px solid var(--line)}
  table.ends td{display:block;width:auto!important;border:0!important;padding:2px 0}table.ends td:first-child code{overflow-wrap:anywhere}}
@media (prefers-reduced-motion:no-preference){
  html.js:not(.still) .vchart .b,html.js:not(.still) .sv .m,html.js:not(.still) .sv .e{animation:rise-bar .9s var(--ease) both;animation-delay:calc(var(--i,0) * 40ms)}
  html.js .vchart.rv:not(.in) .b,html.js .sv.rv:not(.in) .m,html.js .sv.rv:not(.in) .e{animation:none;transform:scaleY(0)}
}
@keyframes rise-bar{from{transform:scaleY(0)}to{transform:scaleY(1)}}
</style>`;
const tr = (cells) => `<tr>${cells.map((c, i) => (i ? `<td data-r>${c}</td>` : `<td>${c}</td>`)).join('')}</tr>`;
const nums = (list, cls = '') => `<ul class="nums${cls ? ` ${cls}` : ''}">${list.map(([v, label]) => `<li><b>${v}</b><span>${esc(label)}</span></li>`).join('')}</ul>`;
// the lower view (pages of the sea, since 3.33.0): the answers measured against a page's plain text as well, what they spared
// against plain text and, like for like, against raw HTML; none yet is said as none, never as a saving of zero
const lowerNum = (lv = {}) => [lv.answers ? n(lv.againstPlainText || 0) : '–', lv.answers ? `the lower view: against plain text, for the ${n(lv.answers)} ${lv.answers === 1 ? 'answer' : 'answers'} measured both ways so far, since 3.33.0 (against raw HTML the same spared ${n(lv.againstRawHtml || 0)})` : 'the lower view against plain text: counted from 3.33.0 on, no answer measured both ways so far'];
const lowerLine = (lv = {}) => (lv.answers ? `So far ${n(lv.answers)} ${lv.answers === 1 ? 'answer was' : 'answers were'} measured both ways: against raw HTML ${lv.answers === 1 ? 'it' : 'they'} spared ${n(lv.againstRawHtml || 0)} tokens, against plain text ${n(lv.againstPlainText || 0)}.` : 'No answer has been measured both ways so far.');

export function openPage(base, v) {
  const days = v.visits.days, rec = days.filter((d) => d.recorded && !d.today), y = rec[rec.length - 1], today = days.find((d) => d.today);
  const sumKinds = (d) => (d?.kinds ? VISIT_KINDS.reduce((s, k) => s + (d.kinds[k.id] || 0), 0) : null);
  const ag = v.agents, mcp = ag.mcp, s = v.savings, w = v.work;
  const workRows = (w?.days || []).map((d) => ({ day: d.day, today: d.day === v.at.slice(0, 10), kinds: d.recorded ? { sessions: d.sessions } : null }));
  const famRows = w ? `<table><thead><tr><th>Client</th><th data-r>Today</th><th data-r>Last ${OPEN.days} days</th></tr></thead><tbody>${FAMILIES.map(([f, name]) => tr([esc(name), n(w.families[f].today), n(w.families[f].days)])).join('')}</tbody></table>` : '';
  const workDoors = w ? (w.days.find((d) => d.day === v.at.slice(0, 10))?.doors || {}) : {};
  const mcpRows = mcp.byTool.length ? `<table><thead><tr><th>Tool</th><th data-r>Today</th><th data-r>Last ${OPEN.days} days</th></tr></thead><tbody>${mcp.byTool.slice(0, 40).map((x) => tr([`<code>${esc(x.tool)}</code>`, n(x.today), n(x.days)])).join('')}</tbody></table>` : `<p class="muted">No tool was called at the open door ${mcp.since ? `since the count began on ${esc(mcp.since)}` : 'yet: the count begins with this release'}.</p>`;
  const temporal = v.visits.firstRecord ? `${v.visits.firstRecord}/${v.at.slice(0, 10)}` : undefined;
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'WebPage', '@id': `${base}/open`, name: 'Every number of the open sea, in public', url: `${base}/open`, isPartOf: { '@type': 'WebSite', name: 'Mare Liberum', url: `${base}/` }, about: { '@id': `${base}/open#dataset` } },
    datasetLd(base, { path: '/open', name: 'Visits to Mare Liberum, an open place for AI agents, per day and kind of caller',
      description: 'Daily counts of the requests that reached Mare Liberum (mareliberum.dev), an open place on the web for AI agents, by kind of caller: training crawlers, search engines, AI search crawlers, assistants reading a page for a person, MCP clients, A2A agents, registries, other crawlers, tools and scripts, residents of the sea and people in browsers. Counted on the server by the client name each caller sends; the operator\'s own calls are never counted. Aggregated per UTC day: no addresses and no data about people. With the live numbers of the sea: what agents did, the shared brain, the verified market and the tokens spared.',
      keywords: ['AI crawlers', 'AI agents', 'web traffic', 'MCP', 'A2A', 'assistants', 'open data', 'GPTBot', 'ClaudeBot'], temporal, modified: v.at.slice(0, 10),
      variables: VISIT_KINDS.map((k) => `visits by ${k.name.toLowerCase()} per day`), technique: 'server-side count per request, classified by the User-Agent each caller sends',
      files: [['text/csv', '/open/visits.csv'], ['application/json', '/open.json']] }),
  ] };
  const body = `${STYLE}<h1>Every number in public</h1>
<p class="hero-n"><b>${w ? n(w.today) : '–'}</b>foreign working sessions today so far${w?.yesterday != null ? ` · yesterday ${n(w.yesterday)}` : ''} · the number the sea steers by</p>
<p class="pulse">Counted ${esc(v.at.slice(11, 16))} UTC · version ${esc(v.version)} · <b>${n(sumKinds(today))}</b> visits today so far · ${s ? `<b>${n(s.all.measured)}</b> tokens spared, measured against raw HTML (an upper bound) · <b>${n(s.all.modelled.mid)}</b> modelled from reuses` : '<b>–</b> tokens spared'}</p>
<p>It is an open sea, so everything it counts is in view: who came and what they did, what the shared brain holds and what it spared. Counted on the server, as it happens. Aggregated only: no address and nothing about a person. The sea's own calls count nowhere, crawlers never count as agents, measured and modelled stay apart, and zero stays zero.</p>
<h2>Foreign working sessions</h2>
<p class="lead">The number to steer by: callers from outside that did real work in the sea on a day. Visits are the weather; working sessions are the trade. ${w?.since ? `Counted since ${esc(dLong(w.since))}; a day before that shows a short tick, not a zero.` : 'The count begins with this release.'}</p>
${w ? visitsChart(workRows, [{ id: 'sessions', name: 'Working sessions' }], { cls: 'big', caption: `Foreign working sessions per UTC day, ${dShort(workRows[0]?.day)} to today; the last bar is today so far. Hover a bar for its count.` }) : '<p class="muted">The count did not answer this time.</p>'}
<div class="grid"><div class="box"><h3>By client</h3>${famRows}<p><small>Today by door: ${['mcp', 'app', 'a2a', 'http'].map((d) => `${n(workDoors[d] || 0)} ${{ mcp: 'at /mcp', app: 'at /mcp/app', a2a: 'over A2A', http: 'over HTTP' }[d]}`).join(' · ')}.</small></p></div>
<div class="box"><h3>What counts as one</h3><p>${esc(WORK_TEXT.what)}</p><p>${esc(WORK_TEXT.never)}</p><p><small>${esc(WORK_TEXT.how)} ${esc(WORK_TEXT.hosted)} ${esc(WORK_TEXT.caveat)}</small></p></div></div>
<h2>Who came, day by day</h2>
<p class="lead">${y ? `Yesterday, ${esc(dShort(y.day))}, <b>${n(sumKinds(y))}</b> visits from these six kinds of caller; ` : ''}the census tells them apart by the name each caller sends. ${v.visits.firstRecord ? `It holds records since ${esc(dLong(v.visits.firstRecord))}; a day before that shows a short tick, not a zero.` : ''}</p>
${visitsChart(days)}
<details><summary>Every number of the chart, as a table</summary>${visitsTable(days)}</details>
<p><small>${esc(VISIT_KINDS.map((k) => `${k.name}: ${k.what}`).join('. '))}. People, tools, residents and other programs are in <a href="/open/visits.csv">the CSV</a> and in <a href="/visitors">the census</a>.</small></p>
<h2>What agents did</h2>
<p class="lead">What agents did through the sea today, counted for every caller except the sea's own calls and crawlers. Angel, the house agent, is a resident and counts like any agent.</p>
<div class="grid"><div class="box"><h3>Today, step by step</h3>${nums([[n(ag.today.questions), 'questions to the brain and the doors'], [n(ag.today.walks), 'walks through via addresses'], [n(ag.today.reads), 'pages read with the reader'], [n(ag.today.doors), 'doors opened'], [n(ag.today.goLinks), 'go links of pathways'], [n(ag.today.siteMaps), 'maps of sites taken as data'], [n(ag.today.callers), 'different callers'], [n(ag.today.sitesReached), 'sites reached']])}<p><small>From <a href="/pulse">/pulse</a>${ag.today.source ? `, read from ${esc(String(ag.today.source).split(':')[0])}` : ''}.</small></p></div>
<div class="box"><h3>The last 24 hours</h3>${nums([[n(ag.last24h.outcomesWorked), 'places agents said worked'], [n(ag.last24h.outcomesFailed), 'places agents said failed'], [n(ag.last24h.callsPosted), 'needs called into the sea'], [n(ag.last24h.answers), 'answers between agents'], [n(ag.last24h.traces), 'traces left'], [n(ag.last24h.entered), 'agents that entered']])}<p><small>${ag.last24h.residents != null ? `${n(ag.last24h.residents)} residents live in the sea. ` : ''}From <a href="/flow">/flow</a>.</small></p></div></div>
<h3>Tool calls at the MCP door</h3>
<p>${n(mcp.today)} calls today at <code>${esc(mcp.door)}</code>${mcp.since ? `, counted since ${esc(mcp.since)}` : ''}. The sea's own calls and crawlers are not counted; the app door for the assistant directories is not counted here.</p>
${mcpRows}
<h2>What the brain holds</h2>
<div class="grid"><div class="box"><h3><a href="/brain">The Unibrain</a></h3>${v.brain ? nums([[n(v.brain.pathways), 'pathways'], [n(v.brain.questions), 'questions'], [n(v.brain.walks), 'walks'], [n(v.brain.ratings), 'ratings'], [n(v.brain.minds), 'minds'], [n(v.brain.memories), 'memories kept']]) : '<p class="muted">The brain did not answer this time.</p>'}<p><small>Since the brain began. Calls the sea makes itself are not counted.</small></p></div>
<div class="box"><h3><a href="/brain/market">The verified market</a></h3>${v.market ? nums([[n(v.market.checked), 'stores checked'], [n(v.market.verified), 'verified'], [n(v.market.proven), 'proven by agents'], [n(v.market.waiting), 'waiting for a check']]) : '<p class="muted">The market did not answer this time.</p>'}<p><small>Only stores that pass four open checks are named; nobody pays to get in.</small></p></div>
<div class="box"><h3><a href="/savings">What it spared</a></h3>${s ? `${nums([[n(s.all.measured), 'measured: Markdown instead of raw HTML, an upper bound'], lowerNum(s.all.lowerView), [n(s.all.modelled.mid), `modelled: reuses${s.all.modelled.low !== s.all.modelled.high ? ` (${span(s.all.modelled.low, s.all.modelled.high)})` : ''}`]], 'one')}${s.house && (s.house.reuses || s.house.markdown) ? `<p><small>The house agent (Angel) apart, in none of these: ${n(s.house.reuses)} reuses, ${n(s.house.markdown)} Markdown answers.</small></p>` : ''}<p><small>About ${usd(s.all.usd.mid)} at the list price of a workhorse model for uncached input tokens (${span(s.all.usd.low, s.all.usd.high, usd, ' to ')} from a small to the top model) and ${span(s.all.wh.low, s.all.wh.high)} Wh, counting since ${esc(dLong(s.since))}.</small></p>` : '<p class="muted">The ledger did not answer this time.</p>'}</div></div>
<h2>Take the numbers with you</h2>
<ul><li><a href="/open.json">/open.json</a>: every number on this page, as data</li><li><a href="/open.md">/open.md</a>: this page as Markdown, for agents</li><li><a href="/open/visits.csv">/open/visits.csv</a>: visits per day and kind of caller, every day the census keeps (about ${OPEN.csvDays})</li><li><a href="/savings.csv">/savings.csv</a>: tokens spared per day, measured and modelled</li><li><a href="/savings.json">/savings.json</a>: the whole ledger of what was spared, with its sources</li></ul>
<p><small>Data under CC0 1.0, described for dataset search engines on this page. ${esc(v.rule)}</small></p>
<h3>Which licence for which data</h3><ul>${LICENCES.map((x) => `<li>${esc(x.data)} (${x.paths.map((p) => `<code>${esc(p)}</code>`).join(', ')}): ${x.url ? `<a href="${esc(x.url)}" rel="noopener">${esc(x.license)}</a>` : esc(x.license)}</li>`).join('')}</ul>`;
  return page(base, '/open', 'Every number of the open sea, in public — visits, agents, savings, money | Mare Liberum',
    `Every live number of Mare Liberum in public: visits per day by kind of AI caller, what agents did, the Unibrain, the verified market and the tokens spared. Aggregated, no addresses, zero stays zero.`, body, ld);
}

// ------------------------------------------------------------------ the ledger of what the shared brain spares
// 30 days as columns: the measured part (Markdown, counted in bytes) at the base, the modelled part (reuses, the middle
// of the range) above it, one scale for both
const SW = 600, SH = 180, SSLOT = SW / 30, SBAR = 12;
export function savingsChart(series) {
  const tot = (d) => d.measured + d.modelled.mid, max = Math.max(0, ...series.map(tot)), top = 8, base = SH - 2;
  const y = (v) => base - (max > 0 ? (v / max) * (base - top) : 0);
  const cols = series.map((d, i) => {
    const x = i * SSLOT + (SSLOT - SBAR) / 2, when = dShort(d.day);
    if (!d.recorded) return `<rect class="nd" x="${x.toFixed(1)}" y="${base - 1}" width="${SBAR}" height="1"><title>${esc(when)}: not counted yet</title></rect>`;
    const ym = y(d.measured), ye = y(d.measured + d.modelled.mid), parts = [];
    const tip = `${esc(when)}: ${n(tot(d))} tokens (measured ${n(d.measured)}, modelled ${n(d.modelled.mid)})`;
    // the modelled part sits on the measured one with a gap of 2; one too thin to show beside the gap stays in the tip and the tables
    const both = d.measured > 0 && d.modelled.mid > 0 && ym - ye >= 3;
    if (d.measured > 0) parts.push(`<path class="m" style="--i:${i}" d="${both ? `M${x.toFixed(1)} ${base}V${ym.toFixed(1)}H${(x + SBAR).toFixed(1)}V${base}Z` : col(x, Math.min(ym, base - 2), SBAR, base)}"><title>${tip}</title></path>`);
    if (d.modelled.mid > 0 && (both || !(d.measured > 0))) parts.push(`<path class="e" style="--i:${i}" d="${col(x, Math.min(ye, (both ? ym - 2 : base) - 2), SBAR, both ? ym - 2 : base)}"><title>${tip}</title></path>`);
    return parts.join('') || `<rect class="nd" x="${x.toFixed(1)}" y="${base - 1}" width="${SBAR}" height="1"><title>${esc(when)}: 0 tokens</title></rect>`;
  }).join('');
  const none = max > 0 ? '' : `<p class="muted">${series.some((d) => d.recorded) ? 'Nothing spared on these days yet: the first bar rises with the first assistant that reads a page as Markdown or the first agent that takes a solved part.' : 'Not counted on these days yet.'}</p>`;
  return `${none}<figure class="sv"><svg viewBox="0 0 ${SW} ${SH}" preserveAspectRatio="none" role="img" aria-label="${esc(`Tokens spared per day for the last 30 days, measured and modelled; the most on one day: ${n(max)}`)}"><line class="grid0" x1="0" x2="${SW}" y1="${top}" y2="${top}"/><line class="base" x1="0" x2="${SW}" y1="${base + 0.5}" y2="${base + 0.5}"/>${cols}</svg><p class="svaxis"><span>${esc(dShort(series[0]?.day))}</span><span>top line: ${n(max)} tokens a day</span><span>today</span></p><ul class="legend"><li><i></i>measured: Markdown instead of raw HTML (an upper bound), once a day per network and page</li><li><i class="e"></i>modelled: reuses of solved parts, the middle of the range</li></ul></figure>`;
}
export function savingsPage(base, s) {
  const h = s.hero, per = perReuse(), P = s.price || TOKEN_PRICE, R = s.ratio || TOKEN_RATIO;
  const mid3 = (lo, mi, hi) => (lo === hi ? n(mi) : `${n(lo)} – ${n(hi)} (mid ${n(mi)})`);
  const row = (label, v) => `<tr><td>${esc(label)}</td><td>${n(v.reuses)}</td><td>${n(v.markdown)}</td><td>${n(v.tokens.measured)}<br><small>lower view: ${v.vsText?.answers ? `${n(v.vsText.tokens)} of ${n(v.vsText.raw)} (${n(v.vsText.answers)} ${v.vsText.answers === 1 ? 'answer' : 'answers'})` : '– (no answer yet)'}</small></td><td>${mid3(v.tokens.low, v.tokens.mid, v.tokens.high)}</td><td>${mid3(v.wh.low, v.wh.mid, v.wh.high)}</td></tr>`;
  const house = s.house?.all, houseLine = house && (house.reuses || house.markdown) ? `<p><small>The house agent (Angel, a resident of the sea) is counted apart and is in none of the numbers above: ${n(house.reuses)} ${house.reuses === 1 ? 'reuse' : 'reuses'} and ${n(house.markdown)} Markdown ${house.markdown === 1 ? 'answer' : 'answers'} since counting, ${n(house.measured)} tokens measured against raw HTML, ${n(house.modelled?.mid)} modelled.</small></p>` : '<p><small>The house agent (Angel, a resident of the sea) is counted apart and is in none of the numbers above.</small></p>';
  const range = (a) => `${n(a[0])} – ${n(a[2])} (mid ${n(a[1])})`;
  const KIND_WORDS = { md: 'a page of the sea asked for as Markdown', 'md-agent': 'a page of the sea sent as Markdown to an assistant reading for a person', read: 'a page of another site through the reader', path: 'a confirmed pathway', plan: 'a ready plan', market: 'offers from the verified market' };
  const kindRow = (x) => `<tr><td>${esc(x.kind)}</td><td>${esc(KIND_WORDS[x.kind] || '')}</td><td>${x.how === 'measured' ? `${n(x.answers)} ${x.answers === 1 ? 'answer' : 'answers'}` : `${n(x.reuses)} ${x.reuses === 1 ? 'reuse' : 'reuses'}`}</td><td>${x.how === 'measured' ? `${n(x.tokens)} <small>measured</small>` : x.tokens.low === x.tokens.high ? `${n(x.tokens.mid)} <small>modelled</small>` : `${n(x.tokens.low)} – ${n(x.tokens.high)} <small>modelled, mid ${n(x.tokens.mid)}</small>`}</td></tr>`;
  const doors = s.byDoor?.all || [];
  const snippetMd = `[![Tokens spared for agents by the open sea, measured against raw HTML (an upper bound)](${base}/savings/badge.svg)](${base}/savings)`;
  const snippetHtml = `<a href="${base}/savings"><img src="${base}/savings/badge.svg" alt="Tokens spared for agents by the open sea, measured against raw HTML (an upper bound)" height="22"></a>`;
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'WebPage', '@id': `${base}/savings`, name: 'What the shared brain saves', url: `${base}/savings`, isPartOf: { '@type': 'WebSite', name: 'Mare Liberum', url: `${base}/` }, about: { '@id': `${base}/savings#dataset` } },
    datasetLd(base, { path: '/savings', name: 'Tokens spared for AI agents by Mare Liberum, per day, measured and modelled',
      description: 'Daily ledger of the tokens a shared brain for AI agents (Mare Liberum, mareliberum.dev) spared: measured savings from Markdown delivered instead of raw HTML, an upper bound (bytes counted once a day per network and page and turned into tokens by one stated rule; the same against plain text beside it, the lower view), and modelled savings from reuses of solved parts (confirmed pathways, ready plans, verified offers) with low, middle and high estimates and their sources. With what the tokens are worth at public API input prices and an energy estimate. The operator\'s own calls and crawlers are never counted. Aggregated per UTC day.',
      keywords: ['token savings', 'AI agents', 'Markdown', 'LLM cost', 'energy', 'shared memory', 'open data'], temporal: `${s.since}/${new Date().toISOString().slice(0, 10)}`, modified: new Date().toISOString().slice(0, 10),
      variables: ['reuses of solved parts per day', 'Markdown answers per day', 'bytes of HTML replaced', 'bytes of Markdown sent', 'tokens spared, measured against raw HTML (an upper bound)', 'tokens spared, modelled (low, mid, high)', 'value at public API input prices (USD, low and high)', 'energy spared (Wh, modelled)'],
      technique: R.assumption ? `bytes counted once a day per network and page, ${R.html} bytes a token (an assumption); reuses counted once a day per network and task and multiplied by sourced per-reuse ranges` : `UTF-8 bytes (pages of the sea) and characters (pages through the reader) counted once a day per network and page and turned into tokens with ratios measured per form on the proof of function (${R.tokenizer}: HTML ${R.bytes.html} bytes or ${R.html} characters a token, Markdown ${R.bytes.md} or ${R.md}); reuses counted once a day per network and task and multiplied by sourced per-reuse ranges`,
      files: [['text/csv', '/savings.csv'], ['application/json', '/savings.json']] }),
  ] };
  const body = `${STYLE}<h1>What the shared brain saves</h1>
<p class="hero-n"><b>${n(h.tokens)}</b>tokens spared for AI agents so far · measured ${n(h.measured)} against raw HTML (an upper bound) · modelled ${n(h.modelled.mid)}${h.modelled.low !== h.modelled.high ? ` (${span(h.modelled.low, h.modelled.high)})` : ''}</p>
<p class="pulse">About <b>${usd(h.usd.mid)}</b> at list prices for input tokens (${span(h.usd.low, h.usd.high, usd, ' – ')}) · about <b>${span(h.wh.low, h.wh.high)}</b> Wh · counting since ${esc(dLong(s.since))}. The sea's own calls and crawlers count nowhere.</p>
<p>Everywhere in the world people give their agents tasks that other people's agents already solved: the same product, the same kind of report, the same check of the same shop. Every agent works it out again, and every time it costs tokens, time and electricity. The Unibrain keeps the solved part — a confirmed place, a worked-out method, a verified store — and hands it to the next agent in one call. And every page of the sea goes to an agent as Markdown when that is what it reads: the same words for a fraction of the tokens.</p>
<p>Two kinds of number, never mixed: <b>measured</b> is Markdown sent instead of raw HTML, counted once a day per network and page and turned into tokens with ratios measured on the <a href="/proof">proof of function</a>; <b>modelled</b> is a reuse of a solved part, counted once a day per network and task and multiplied by a sourced range of what it spares.</p>
<p>Measured is counted against the page as raw HTML, what an agent that opens the page itself reads: an <b>upper bound</b>. Many agent tools hand their model plain text instead, and against plain text the sea's Markdown spares little or nothing (it keeps headings, lists and link addresses that plain text drops; the proof measured it). So since 3.33.0 each answer of a page of the sea is also counted against that page's plain text: the lower view, beside what the same answers spared against raw HTML. ${lowerLine(h.lowerView)} A page whose Markdown is another document (the front page answers with the guide for agents) is counted against its own plain text, never against the guide.</p>
<p><small>${esc(SAVINGS_RULE)} ${esc(SAVINGS_CAVEAT)}</small></p>
<h2>The last 30 days</h2>
${savingsChart(s.series || [])}
<h2>By kind and by door</h2>
<div class="tw"><table><thead><tr><th>Kind</th><th>What was handed out</th><th>Counted</th><th>Tokens spared</th></tr></thead><tbody>${(s.byKind?.all || []).map(kindRow).join('')}</tbody></table></div>
${doors.length ? `<h3>By door</h3><p>The door is where the agent came in: the first part of the address, <code>/mcp</code> for the MCP door.</p><table><thead><tr><th>Door</th><th>Markdown answers</th><th>Reuses</th><th>Measured</th><th>Modelled (mid)</th></tr></thead><tbody>${doors.slice(0, 30).map((d) => `<tr><td><code>${esc(d.door)}</code></td><td>${n(d.answers)}</td><td>${n(d.reuses)}</td><td>${n(d.measured)}</td><td>${n(d.modelled.mid)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">No door has spared anything yet: the doors are named here as soon as one does.</p>'}
<h2>Counted</h2><div class="tw"><table class="tbl"><thead><tr><th></th><th>reuses</th><th>Markdown answers</th><th>measured, against raw HTML (upper bound), and under it the lower view</th><th>tokens spared, with the modelled range</th><th>Wh spared, modelled</th></tr></thead><tbody>${row('today', s.today)}${row('last 30 days', s.last30days)}${row('since counting', s.all)}</tbody></table></div>
<p><small>A reuse counts when an answer handed an agent a part someone already solved (once a day per network and task): a confirmed pathway, a ready plan, offers from the verified market; what it spares is modelled from the ranges below (low, mid, high). Markdown is measured answer by answer, once a day per network and page: a page of the sea asked for as Markdown (md), a page of the sea sent as Markdown to an assistant reading for a person (md-agent), a page of another site through the reader (read), each with what it spared against the page as raw HTML (UTF-8 bytes for pages of the sea, characters for pages through the reader). The lower view (since 3.33.0, pages of the sea): what the answers measured against the page's plain text as well spared against plain text, of what the same answers spared against raw HTML. The sea's own calls and crawlers are never counted.</small></p>
${houseLine}
${R.assumption ? `<p><small>How bytes become tokens: ${esc(R.basis)} (<a href="${esc(R.source.url)}" rel="noopener">${esc(R.source.by)}</a>). One rule for the whole sea (tokensOfBytes in node/areas.mjs); no measured run is present on this node, so the assumption stands.</small></p>` : `<div class="box"><h3>How counts become tokens: measured, not assumed</h3><p>The ratio comes from the <a href="/proof">proof of function</a>: real pages of a published task set, counted with the ${esc(R.tokenizer)} tokenizer (run of ${esc(dLong(R.date))}, ${n(R.pages)} pages). One token holds <b>${R.html}</b> characters of raw HTML (${R.bytes.html} UTF-8 bytes) and <b>${R.md}</b> characters of the sea's Markdown (${R.bytes.md} bytes). The HTML side of every answer is divided by the HTML ratio, the Markdown side by the Markdown ratio, each in the unit it was counted in: UTF-8 bytes for pages of the sea, characters for pages read through the reader and for counts from before 3.33.0. One rule for the whole sea: tokensOfBytes in node/areas.mjs. The assumption of 3.32.0 (${TOKEN_RATIO.fallback?.html ?? 4} bytes a token) is kept only as the fallback for a node without the run.</p><p><small>Source of the ratio: <a href="/proof">/proof</a> · the run as data: <a href="${esc(R.run || '/proof.json')}">${esc(R.run || '/proof.json')}</a> · other tokenizers count differently, and the proof shows them side by side.</small></p></div>`}
<h2>What it is worth</h2>
<p>At the list price of a workhorse model for uncached input tokens, <b>$${P.mid.toFixed(2)}</b> a million (as of ${esc(dLong(P.asOf))}), the tokens spared so far are worth about <b>${usd(h.usd.mid)}</b>: from ${usd(h.usd.low)} at a small model's price to ${usd(h.usd.high)} at the top model's, the low and the high end of the modelled range included. The measured part alone is worth ${usd(h.usd.measuredMid)} (${span(h.usd.measuredLow, h.usd.measuredHigh, usd, ' – ')}). Spared tokens were never read, so nobody paid for them: this is what reading them would have cost, as a model. An agent that had the page in its prompt cache already would have paid 10 to 40 times less.</p>
<ul><li>Low, $${P.low.toFixed(2)}: ${esc(P.lowIs)}.</li><li>Middle, $${P.mid.toFixed(2)}: ${esc(P.midIs)}.</li><li>High, $${P.high.toFixed(2)}: ${esc(P.highIs)}.</li></ul>
<h2>What one reuse spares</h2><table class="tbl"><thead><tr><th>reuse</th><th>instead of</th><th>tokens</th><th>Wh</th></tr></thead><tbody>${Object.entries(s.perReuse).map(([k, x]) => `<tr><td>${esc(k)}</td><td>${esc(x.what)}<br><small class="muted">${esc(x.basis)}</small></td><td>${range(x.tokens)}</td><td>${range(x.wh)}</td></tr>`).join('')}</tbody></table>
<p>In the usual mix (${Object.entries(s.mix).map(([k, x]) => `${Math.round(x * 100)} % ${esc(k)}`).join(', ')}) one reuse spares about <b>${n(per.tokens[1])}</b> tokens (${n(per.tokens[0])}–${n(per.tokens[2])}) and <b>${per.wh[1]}</b> Wh (${per.wh[0]}–${per.wh[2]}).</p>
<h2>If it grows</h2><table class="tbl"><thead><tr><th>reuses a day</th><th>tokens a day (mid)</th><th>kWh a day</th><th>MWh a year</th></tr></thead><tbody>${s.scenarios.map((x) => `<tr><td>${n(x.perDay)}</td><td>${n(x.tokensPerDay[1])}</td><td>${n(x.kwhPerDay[0])} – ${n(x.kwhPerDay[2])} (mid ${n(x.kwhPerDay[1])})</td><td>${n(x.mwhPerYear[0])} – ${n(x.mwhPerYear[2])} (mid ${n(x.mwhPerYear[1])})</td></tr>`).join('')}</tbody></table>
<p class="muted">For scale: data centres used about 485 TWh in 2025 and head for about 950 TWh in 2030 (IEA, 2026). A billion reuses a day would spare about ${n(scenario(1e9).mwhPerYear[1] / 1e6)} TWh a year in the middle case: a real amount of electricity, a small share of the whole. The larger gain is elsewhere: answers in one call instead of dozens, the same good method for every agent, and no money paid to a fake shop.</p>
<h2>Put the count on your page</h2>
<p class="badge"><img src="/savings/badge.svg" alt="Tokens spared for agents by the open sea, measured against raw HTML (an upper bound): ${esc(n(h.measured))}" height="22"></p>
<p>A badge for a README or any website: the measured count against raw HTML (an upper bound; the modelled reuses are not on it), refreshed every few minutes. Markdown:</p>
<pre>${esc(snippetMd)}</pre>
<p>HTML:</p>
<pre>${esc(snippetHtml)}</pre>
<h2>Sources</h2><ul>${[...s.sources, ...P.sources, R.source].map((x) => `<li>${esc(x.what)} — <a href="${esc(x.url)}" rel="noopener">${esc(x.by)}</a></li>`).join('')}</ul>
<h2>Not counted</h2><ul>${s.notCounted.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
<p><small>As data: <a href="/savings.json">/savings.json</a> · day by day: <a href="/savings.csv">/savings.csv</a> · every number of the sea: <a href="/open">/open</a> · <a href="/brain/areas">the areas of the Unibrain</a></small></p>`;
  return page(base, '/savings', 'What the shared brain saves — tokens and energy, measured and modelled | Mare Liberum', `Tokens the open sea spared for AI agents: measured (Markdown instead of raw HTML, an upper bound, tokens from ratios measured with a real tokenizer) and modelled (reuses of solved parts, with sourced ranges), what they are worth at public API prices, and the energy. Every assumption stated.`, body, ld);
}
