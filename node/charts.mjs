// Mare Liberum · the charts of the lighthouse (placeholder: three example courses; the full charts replace this file)
// Pure data, loaded at start by node/lighthouse.mjs (seedCharts, idempotent, laidBy 'chart'). One entry is one course:
//   { kind, title, for: [blueprint ids of the shipyard, 'angel', 'any'], tasks: [typical tasks in words],
//     steps: [{ do, to?, say, check }] }   1 to 6 steps
//   do     think | read_page | check_site | ask | decide | search | get | mind | brief | go
//   to     an https address, for do 'go' (checked reachable when the charts are built; never a till, a cart or a login)
//   check  how the agent sees the step worked; a prefix the probe can check by itself: reachable: · has-price: ·
//          checkout-link: · mcp-alive: · a2a-card: · answers: (the sea itself answers the step)
// The id is sha(kind + steps), 14 characters. The same steps under several entries are one course with all their tasks.
// No step pays, submits a form, posts or logs in.
export const PLACEHOLDER = true;
// kinds the charts add to the kinds of node/brief.mjs, with the words that name them (for recognition)
export const CHART_KINDS = [
  { kind: 'shop-safety', title: 'Is a shop safe to buy from', keys: 'shop safe|trustworthy|fake shop|scam|seriös|betrug' },
  { kind: 'find-agent', title: 'Find an agent, MCP server or paid API', keys: 'mcp server|a2a agent|an agent that|paid api|x402' },
];
export const CHARTS = [
  {
    kind: 'research', title: 'Research a question from sources and cite every claim', for: ['researcher', 'personal-assistant', 'any'],
    tasks: ['research a question with sources', 'find out what the latest studies say about a topic', 'recherchiere ein Thema mit Quellen'],
    steps: [
      { do: 'brief', say: 'Brief the task: what it left out, the method and the bar a good answer meets.', check: 'answers: the brief names the kind of work' },
      { do: 'route', say: 'Open the public doors that answer the question as data (research, news, reference).', check: 'answers: at least one door opens for the task' },
      { do: 'read_page', say: 'Read each source as Markdown and keep its address next to every claim it supports.', check: 'every claim in the answer carries the address of its source' },
    ],
  },
  {
    kind: 'shop-safety', title: 'Check a shop and its offer before a person pays', for: ['buyer', 'angel'],
    tasks: ['check this shop before paying', 'is this online shop safe to buy from', 'prüfe diesen Shop vor dem Kauf'],
    steps: [
      { do: 'check_site', say: 'See how the shop shows itself to agents: robots.txt, llms.txt, structured data, agent card.', check: 'the check returns a score for the shop' },
      { do: 'read_page', say: 'Read the product page: price, currency, seller, shipping and the return policy.', check: 'the page names a price, a seller and a return policy' },
      { do: 'decide', say: 'Compare the offer with the same item at other sellers; the person decides and pays, never the agent.', check: 'answers: the sea returns one pick with a checkout link to compare against' },
    ],
  },
  {
    kind: 'find-agent', title: 'Find an agent, MCP server or paid API for a task', for: ['any'],
    tasks: ['find an MCP server for a task', 'which agent or API can do this', 'find a paid API that reads web pages'],
    steps: [
      { do: 'search', say: 'Search the open index with one or two words (kind mcp, a2a, agent or x402).', check: 'answers: the open index returns entries' },
      { do: 'get', say: 'Read the entry: its endpoints, its price, and the traces other agents left.', check: 'the entry lists an endpoint the agent can reach' },
      { do: 'think', say: 'Ask the brain which of them other agents confirmed for the same task.', check: 'answers: pathways or doors come back for the task' },
    ],
  },
];
