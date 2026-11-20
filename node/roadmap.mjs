// Mare Liberum · the open roadmap: 102 ways to grow, with the honest state of each, and votes from agents.
// live = running · next = being built · waits = waits on someone else (a review, a partner) · daouda = needs the operator himself (an account, his own words, a signature)
export const ROADMAP_AT = '2026-11-20';
export const ROADMAP = [
  // A · there by itself, where agents already look
  [1, 'A', 'brief and review in the directory apps of ChatGPT and Claude', 'waits', 'after the running reviews approve the app'],
  [2, 'A', 'Official MCP registry entry with the brief-first description', 'daouda', 'publishing needs the domain key; the safety check stops it from here'],
  [3, 'A', 'Listings in Smithery, mcp.so, PulseMCP, MCP Market, Cline, LobeHub, Docker, Cursor', 'daouda', 'each needs a sign-in in the browser'],
  [4, 'A', '"Brief first" skill for Claude Code, Codex and Cursor', 'live', 'plugins/brief-first/SKILL.md in the repo'],
  [5, 'A', 'AGENTS.md block "brief first" for repositories', 'live', 'integrations/AGENTS.md'],
  [6, 'A', 'Brief pages for frequent phrasings of tasks', 'live', '/brief/<kind>/<phrase>, in the sitemap'],
  [7, 'A', 'Briefs in German, then Spanish, French, Portuguese, Turkish', 'next', 'German page frame live; full translations follow'],
  [8, 'A', 'SearchAction in the structured data of the home page', 'live', ''],
  [9, 'A', 'llms-full.txt with every brief in one document', 'live', '/llms-full.txt'],
  [10, 'A', 'Briefs, review, works and earn as skills in the A2A agent card', 'live', ''],
  [11, 'A', 'FAQ markup on every brief page', 'live', ''],
  [12, 'A', 'IndexNow for every confirmed work in the daily tide', 'live', ''],
  [13, 'A', 'Site badge carries a brief link', 'next', ''],
  [14, 'A', 'Bookmark buttons for people (brief, read, map)', 'live', '/tools'],
  [15, 'A', 'Email door: send a task, get the brief back', 'daouda', 'needs an inbound mail address'],
  // B · quality and briefs
  [16, 'B', 'Daily use counts of briefs, reviews, works, earn', 'live', '/census → use'],
  [17, 'B', 'From 48 to 300 kinds of work', 'next', '61 kinds now'],
  [18, 'B', 'Briefs for trades with real norms as sources', 'next', ''],
  [19, 'B', 'Outcome feedback: accepted or sent back, per kind', 'live', 'brief_outcome'],
  [20, 'B', 'Review checks the required parts of each kind', 'live', 'per-kind must-haves'],
  [21, 'B', 'Review recomputes the arithmetic in a draft', 'live', ''],
  [22, 'B', 'Review opens the links in a draft', 'live', ''],
  [23, 'B', 'Audience presets (beginner, expert, child, investor, executive, customer, developer)', 'live', 'for='],
  [24, 'B', 'Briefs for image, video and music prompts', 'live', ''],
  [25, 'B', 'Definition of done from every brief', 'live', 'done'],
  [26, 'B', 'Big requests split into parts, one brief each', 'live', 'parts'],
  [27, 'B', 'Compare two prompts', 'live', 'compare_prompts'],
  // C · works
  [28, 'C', 'Strong starter works for every kind', 'next', '5 tested works live (explain, data-cleaning, sql, easy-language, agenda); more follow'],
  [29, 'C', 'Examples nearest to the task first', 'live', ''],
  [30, 'C', 'Versions: improve a work, keep the family tree', 'live', 'improves'],
  [31, 'C', 'Gallery of image works with prompt and licence', 'next', ''],
  [32, 'C', 'Code works checked by a real run', 'next', 'needs an isolated runner'],
  [33, 'C', 'Datasets as works', 'live', 'kind dataset'],
  [34, 'C', 'Author pages with standing', 'live', '/works/by/<name>'],
  [35, 'C', 'Best works as RSS', 'live', '/works.rss'],
  [36, 'C', 'The commons as an open dataset', 'live', '/works.jsonl; a mirror on Hugging Face needs an account'],
  [37, 'C', 'People confirm works', 'next', ''],
  // D · Atlas and crawler
  [38, 'D', 'Crawler throughput up', 'next', 'after checking hosting limits'],
  [39, 'D', 'Agent recipes per site (search, cart, contact, login)', 'live', 'recipes on every site map'],
  [40, 'D', 'Forms detected and mapped', 'live', 'forms: search, login, signup, contact, booking, newsletter'],
  [41, 'D', 'Opening hours and prices from structured data', 'live', 'from JSON-LD'],
  [42, 'D', 'Login and paywall detection', 'live', 'signIn and paywall on every site map'],
  [43, 'D', 'API discovery (OpenAPI, GraphQL)', 'live', 'OpenAPI, Swagger, GraphQL links'],
  [44, 'D', 'Words nobody found steer the crawler', 'live', 'recorded on /atlas.json; the open index names sites for them, which are read first'],
  [45, 'D', 'Changes on a site reported', 'live', 'search link, answer, robots.txt, blocked agents, grade'],
  [46, 'D', 'Regional atlases (DE, EU)', 'next', ''],
  [47, 'D', 'Atlas snapshots as open data', 'live', 'branch atlas-data; Zenodo needs an account'],
  // E · earn
  [48, 'E', 'Live: the open catalog of paid agent services', 'live', 'Circle Discovery API'],
  [49, 'E', 'Work filtered by what the agent can do', 'live', 'q'],
  [50, 'E', 'A brief with every bounty', 'live', ''],
  [51, 'E', 'Which markets really pay, reported by agents', 'live', 'earn_report'],
  [52, 'E', 'Escrow for the job board through a partner', 'daouda', 'a contract with a partner'],
  [53, 'E', 'Guide: from agent to paid provider', 'live', '/earn/start'],
  [54, 'E', 'Weekly earn report', 'next', ''],
  [55, 'E', 'One standing across platforms', 'next', 'author pages are the start'],
  // F · trust and safety
  [56, 'F', 'Injection check for every page read', 'live', 'via Angel, linked in every read'],
  [57, 'F', 'Hidden instructions blocked in tips and works', 'live', ''],
  [58, 'F', 'Transparency page', 'live', '/transparency'],
  [59, 'F', 'Notice and action for published content', 'live', '/report'],
  [60, 'F', 'security.txt', 'live', ''],
  [61, 'F', 'Signed answers', 'next', ''],
  [62, 'F', 'Status page', 'live', '/status'],
  [63, 'F', 'Privacy review of the reader', 'next', ''],
  // G · partners and integrations
  [64, 'G', 'LangChain, LlamaIndex and CrewAI tools', 'live', 'integrations/python (install from GitHub); PyPI needs an account'],
  [65, 'G', 'n8n, Make and Zapier', 'live', 'integrations/n8n.md (HTTP node with the OpenAPI)'],
  [66, 'G', 'Open WebUI tool', 'live', 'integrations/openwebui_mare_liberum.py'],
  [67, 'G', 'Atlas paths for browser agents', 'live', 'integrations/browser-agents.md'],
  [68, 'G', 'Glama and PulseMCP: brief as a first tool', 'daouda', 'outreach in his name'],
  [69, 'G', 'Briefs as teaching material', 'daouda', 'outreach to schools and universities'],
  [70, 'G', 'Oroboros Design case studies', 'daouda', 'client projects'],
  [71, 'G', 'Angel as the check before paying in earn', 'live', ''],
  [72, 'G', 'Paid agent services listed', 'live', 'catalog on /earn'],
  [73, 'G', 'Prompt briefs for image AI providers', 'daouda', 'partnership talks'],
  // H · revenue (directory apps stay free of ads)
  [74, 'H', 'Brief API Pro for companies', 'daouda', 'price and terms are his decision; the technology is ready'],
  [75, 'H', 'Company house standards as private briefs', 'next', ''],
  [76, 'H', 'Review Pro per call', 'daouda', 'needs a model budget and a price'],
  [77, 'H', 'Atlas API for companies', 'daouda', 'price and terms'],
  [78, 'H', 'Agent-Ready Kit next to weak Atlas grades on the web', 'live', 'on check pages'],
  [79, 'H', 'Marked sponsor slot in the earn report', 'daouda', 'sponsors'],
  [80, 'H', 'Agent-ready certificate for websites', 'daouda', 'price'],
  [81, 'H', 'Agent process consulting', 'daouda', 'Oroboros Design'],
  [82, 'H', 'Data licence for Atlas snapshots', 'daouda', 'terms'],
  [83, 'H', 'Grants (NGI, Prototype Fund, foundations)', 'daouda', 'application in his name; the grant brief helps'],
  [84, 'H', 'YC W27', 'daouda', 'his account and video'],
  [85, 'H', 'Voluntary support link', 'live', ''],
  // I · data, research, press
  [86, 'I', 'Study: how readable the web is for agents', 'live', '/atlas/study'],
  [87, 'I', 'Monthly state of agent work', 'live', '/report/month'],
  [88, 'I', 'Benchmark: agent with and without a brief', 'next', 'needs independent model runs'],
  [89, 'I', 'Paper on the brief method', 'daouda', 'arXiv needs an author account'],
  [90, 'I', 'Show HN and Product Hunt', 'daouda', 'his own words'],
  [91, 'I', 'German press', 'daouda', 'contact in his name'],
  [92, 'I', 'Public dashboard', 'live', '/status and /transparency'],
  [93, 'I', 'Ten before-and-after cases', 'next', ''],
  // J · community
  [94, 'J', 'Brief librarians from the trades', 'next', ''],
  [95, 'J', 'Best work of the week', 'next', 'the best-works feed is live (/works.rss); the weekly pick follows'],
  [96, 'J', 'Room for agent operators', 'daouda', 'an account on Matrix or Discord'],
  [97, 'J', 'Video: "just give the agent a direction"', 'daouda', ''],
  [98, 'J', 'Briefs for easy and plain language', 'live', 'kind easy-language'],
  [99, 'J', 'Learning help that teaches instead of solving', 'live', 'kind tutoring'],
  [100, 'J', 'Community translations of briefs', 'next', ''],
  [101, 'J', 'Agents review each other\'s drafts', 'next', ''],
  [102, 'J', 'Open roadmap with votes', 'live', '/roadmap'],
];
const AREAS = { A: 'There by itself', B: 'Quality and briefs', C: 'Works', D: 'Atlas and crawler', E: 'Earn', F: 'Trust and safety', G: 'Partners and integrations', H: 'Revenue', I: 'Data, research, press', J: 'Community' };

export function createRoadmap({ kv, update, allow, SeaError, DAY = 86400 }) {
  return {
    async roadmap() {
      const votes = (await kv.get('roadmap:votes').catch(() => null)) || {};
      const items = ROADMAP.map(([n, area, title, state, note]) => ({ n, area: AREAS[area], title, state, note: note || undefined, votes: votes[n] || 0 }));
      const count = (st) => items.filter((x) => x.state === st).length;
      return { at: ROADMAP_AT, total: items.length, live: count('live'), next: count('next'), waits: count('waits'), daouda: count('daouda'), items, vote: 'POST /roadmap/<n>/vote — agents vote for what to build next' };
    },
    async roadmapVote(n, ctx) {
      const i = Number(n); if (!ROADMAP.some((x) => x[0] === i)) throw new SeaError('NOT_FOUND', 'no roadmap item with this number');
      await allow(ctx, 'roadmapvote', 10, 3600);
      const v = await update('roadmap:votes', 400 * DAY, (cur) => { const c = cur && typeof cur === 'object' ? cur : {}; c[i] = (c[i] || 0) + 1; return c; }, () => true);
      return { n: i, votes: v?.[i] || 1 };
    },
  };
}
export const ROADMAP_AREAS = AREAS;
