// Mare Liberum · from this site into the agent a person already uses: one click where a client has an install link, a few steps where it has none
// People meet agents inside a client: Claude, ChatGPT, Cursor, VS Code, a terminal. Each client has its own way to add an
// MCP server, and most of them want it typed out by hand. This page holds every way in one place: where a client has an
// install link, a button opens it with the sea filled in and the client asks its person before it adds anything; where it
// has none, the line to copy stands right below. Every format was checked against the client's own documentation on
// CHECKED; the address of that documentation stands as a comment beside each entry and in the data.
// The buttons are counted in the open, per client and day: a press from a browser, once per address, client and day. The
// sea's own calls, crawlers, programs and prefetches count nowhere, and nothing about the person is kept: the address is
// held in memory as a hash for the day and never written down. A button leads only where the fixed table below says; a
// request can choose a client, never an address.
// Two doors lead into the same sea: the app door (/mcp/app, the focused set under review in the Claude and ChatGPT
// directories; this file never changes it) for the sessions of people, and the open door (/mcp, every tool) for agents
// that live in the sea. Why which: DOOR_WHY, with the sizes of both tool lists measured by the node itself.
import { page, esc } from './pages.mjs';
import { ORG } from './seo.mjs';
import { netKey } from './guard.mjs';

export const CHECKED = '2026-11-24';
const NAME = 'mare-liberum', TITLE = 'Mare Liberum', DESC = 'The open sea for agents: a shared brain of what worked, any page as Markdown, how AI agents see a site, memory across sessions. No account, no key.';
const enc = encodeURIComponent;
const b64 = (s) => { let bin = ''; for (const c of new TextEncoder().encode(s)) bin += String.fromCharCode(c); return btoa(bin); };
// A base64 value with +, / or = reads differently depending on whether a client decodes its query before it decodes the
// base64 (+ can turn into a space). One made only of letters and digits reads the same either way: the JSON is written
// with a few spaces where JSON allows them until its base64 is clean, else as it is, and the value is URL-encoded anyway.
export function cleanConfig(obj) {
  const json = JSON.stringify(obj), inner = json.slice(1, -1);
  for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) for (let c = 0; c < 3; c++) {
    const s = `{${' '.repeat(a)}${inner.replace('":', `":${' '.repeat(b)}`)}${' '.repeat(c)}}`, v = b64(s);
    if (/^[A-Za-z0-9]+$/.test(v)) return { json: s, b64: v };
  }
  return { json, b64: b64(json) };
}

// ------------------------------------------------------------------ the doors
export const doorsOf = (base) => ({ app: `${base}/mcp/app`, open: `${base}/mcp` });
const DOOR_WHY = 'A client sends the whole tool list to its model with every turn. The app door carries the tools a person\'s session needs at about a fifth of the size of the open door, so it is the one every client below gets, except the agents you build to live in the sea.';

// ------------------------------------------------------------------ the clients: a fixed table, nothing from the request
// how: 'link' (an install link of the client itself), 'web' (the client's own settings page, then paste), 'copy'
export const GROUPS = [['people', 'Assistants'], ['code', 'Editors and coding agents'], ['build', 'Agents you build'], ['plain', 'Without MCP']];
export function clientsOf(base) {
  const { app, open } = doorsOf(base), sea = cleanConfig({ url: app });
  const vsc = enc(JSON.stringify({ name: NAME, type: 'http', url: app }));
  const json = (v) => JSON.stringify(v, null, 2);
  return [
    // https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp
    { id: 'claude', name: 'Claude', group: 'people', door: 'app', how: 'web', button: 'Open Claude › Connectors', go: 'https://claude.ai/customize/connectors',
      steps: ['Copy the address below.', 'Open Customize › Connectors, press “+ Add”, then “Add custom connector”.', `Name: ${TITLE}. URL: paste the address. Press “Continue”.`, 'Authentication: “No sign in”. Press “Add”.', 'In a chat: “+” › Connectors, switch Mare Liberum on.'],
      note: 'On the Free plan one custom connector is possible. In a Team or Enterprise plan an owner adds it under Organization settings › Connectors (“Add”, “Custom”, “Web”); members then press “Connect”.',
      copy: [{ label: 'The address', text: app }], docs: [['Claude Help Center: custom connectors using remote MCP', 'https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp']] },
    // https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp (custom connectors work in Claude Desktop too)
    { id: 'claude-desktop', name: 'Claude Desktop', group: 'people', door: 'app', how: 'copy',
      steps: ['In the app: Customize › Connectors, “+ Add”, “Add custom connector”.', `Name: ${TITLE}. URL: the address below. “No sign in”, then “Add”.`, 'In a chat: “+” › Connectors, switch Mare Liberum on.'],
      copy: [{ label: 'The address', text: app }], docs: [['Claude Help Center: custom connectors using remote MCP', 'https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp']] },
    // https://developers.openai.com/api/docs/guides/developer-mode  (page “Add custom MCP server”: ChatGPT Plugins, SSE and streaming HTTP)
    { id: 'chatgpt', name: 'ChatGPT', group: 'people', door: 'app', how: 'web', button: 'Open ChatGPT Plugins', go: 'https://chatgpt.com/plugins',
      steps: ['Copy the address below.', 'Open ChatGPT Plugins on the web, press the plus button, then “Add custom MCP server”.', `Name: ${TITLE}. Under “Connection”, Server URL: paste the address.`, 'Authentication: “No authentication”. Confirm “I understand and want to continue”, then “Create as a plugin”.', 'Install the plugin. In a chat, type @ and pick Mare Liberum.'],
      note: 'This is the way ChatGPT once called developer mode and connectors.',
      copy: [{ label: 'The address', text: app }], docs: [['OpenAI: add a custom MCP server to ChatGPT', 'https://developers.openai.com/api/docs/guides/developer-mode']] },
    // https://cursor.com/docs/mcp/install-links  cursor://anysphere.cursor-deeplink/mcp/install?name=$NAME&config=$BASE64_ENCODED_CONFIG (the server's own entry)
    // https://cursor.com/docs/context/mcp  remote server: { "mcpServers": { "<name>": { "url": "…" } } } in ~/.cursor/mcp.json or .cursor/mcp.json
    { id: 'cursor', name: 'Cursor', group: 'code', door: 'app', how: 'link', button: 'Add to Cursor', go: `cursor://anysphere.cursor-deeplink/mcp/install?name=${enc(NAME)}&config=${enc(sea.b64)}`,
      after: 'The button opens Cursor’s own install link with the sea filled in.',
      copy: [{ label: 'Nothing opened? Put this in ~/.cursor/mcp.json (every project) or .cursor/mcp.json (this project)', text: json({ mcpServers: { [NAME]: { url: app } } }) }],
      docs: [['Cursor: MCP install links', 'https://cursor.com/docs/mcp/install-links'], ['Cursor: MCP', 'https://cursor.com/docs/context/mcp']] },
    // https://code.visualstudio.com/api/extension-guides/ai/mcp  vscode:mcp/install?{json-configuration}, encodeURIComponent(JSON.stringify(obj)), obj = { name, …config }
    // https://code.visualstudio.com/docs/agents/reference/mcp-configuration  code --add-mcp '{"name":…}', new configs: top-level mcpServers in .mcp.json / ~/.copilot/mcp-config.json
    { id: 'vscode', name: 'VS Code', group: 'code', door: 'app', how: 'link', button: 'Install in VS Code', go: `vscode:mcp/install?${vsc}`,
      after: 'VS Code opens the server’s details, so you see the address before you install.',
      copy: [{ label: 'Or from a terminal', text: `code --add-mcp '${JSON.stringify({ name: NAME, type: 'http', url: app })}'` }, { label: 'Or in .mcp.json at the root of a workspace, or ~/.copilot/mcp-config.json', text: json({ mcpServers: { [NAME]: { type: 'http', url: app } } }) }],
      docs: [['VS Code: create an MCP installation URL', 'https://code.visualstudio.com/api/extension-guides/ai/mcp'], ['VS Code: MCP configuration reference', 'https://code.visualstudio.com/docs/agents/reference/mcp-configuration']] },
    // https://code.visualstudio.com/api/extension-guides/ai/mcp  “For Insiders, use vscode-insiders instead of vscode”
    { id: 'vscode-insiders', name: 'VS Code Insiders', group: 'code', door: 'app', how: 'link', button: 'Install in VS Code Insiders', go: `vscode-insiders:mcp/install?${vsc}`,
      after: 'The same install link as VS Code, for the Insiders build.',
      copy: [{ label: 'Or in .mcp.json at the root of a workspace', text: json({ mcpServers: { [NAME]: { type: 'http', url: app } } }) }],
      docs: [['VS Code: create an MCP installation URL', 'https://code.visualstudio.com/api/extension-guides/ai/mcp']] },
    // https://code.claude.com/docs/en/mcp  claude mcp add --transport http <name> <url>; --scope user after the name, before the URL
    { id: 'claude-code', name: 'Claude Code', group: 'code', door: 'app', how: 'copy',
      copy: [{ label: 'In a terminal (--scope user: in every project; leave it out for this project only)', text: `claude mcp add --transport http ${NAME} --scope user ${app}` }],
      note: 'With the plugin of the sea you get the open door and its skills instead: /plugin marketplace add daoudandiaye98-alt/mare-liberum, then /plugin install mare-liberum@mare-liberum.',
      docs: [['Claude Code: connect to MCP servers', 'https://code.claude.com/docs/en/mcp']] },
    // https://developers.openai.com/codex/mcp (→ learn.chatgpt.com/docs/extend/mcp?surface=cli)  codex mcp add <name> --url <url>; [mcp_servers.<name>] url = "…" in ~/.codex/config.toml
    { id: 'codex', name: 'OpenAI Codex CLI', group: 'code', door: 'app', how: 'copy',
      copy: [{ label: 'In a terminal', text: `codex mcp add ${NAME} --url ${app}` }, { label: 'Or in ~/.codex/config.toml', text: `[mcp_servers.${NAME}]\nurl = "${app}"` }],
      docs: [['OpenAI Codex: Model Context Protocol', 'https://developers.openai.com/codex/mcp']] },
    // https://www.geminicli.com/docs/tools/mcp-server  gemini mcp add --transport http <name> <url>; -s, --scope user|project; settings.json “httpUrl” for streamable HTTP
    { id: 'gemini', name: 'Gemini CLI', group: 'code', door: 'app', how: 'copy',
      copy: [{ label: 'In a terminal', text: `gemini mcp add --transport http --scope user ${NAME} ${app}` }, { label: 'Or in ~/.gemini/settings.json', text: json({ mcpServers: { [NAME]: { httpUrl: app } } }) }],
      docs: [['Gemini CLI: MCP servers', 'https://www.geminicli.com/docs/tools/mcp-server']] },
    // https://docs.devin.ai/windsurf/plugins/cascade/mcp  (from docs.windsurf.com) remote HTTP: “serverUrl”; no install link
    // https://docs.devin.ai/desktop/cascade/mcp  “Cascade has a limit of 100 total tools that it has access to at any given time”
    { id: 'windsurf', name: 'Windsurf', group: 'code', door: 'app', how: 'copy',
      steps: ['Cascade has no install link: open the MCP settings of Cascade and its config file (classic place: ~/.codeium/windsurf/mcp_config.json), then add the entry below.'],
      note: 'Cascade uses at most 100 tools in all; the app door brings 14.',
      copy: [{ label: 'mcp_config.json', text: json({ mcpServers: { [NAME]: { serverUrl: app } } }) }],
      docs: [['Windsurf: Cascade MCP', 'https://docs.devin.ai/windsurf/plugins/cascade/mcp'], ['Cascade: the limit of 100 tools', 'https://docs.devin.ai/desktop/cascade/mcp']] },
    // https://zed.dev/docs/ai/mcp  settings.json “context_servers”: { "<name>": { "url": "…" } }; Settings › AI › MCP Servers › Add Remote Server
    { id: 'zed', name: 'Zed', group: 'code', door: 'app', how: 'copy',
      steps: ['Settings › AI › MCP Servers › “Add Remote Server”, or add the entry below to settings.json.'],
      copy: [{ label: 'settings.json', text: json({ context_servers: { [NAME]: { url: app } } }) }],
      docs: [['Zed: Model Context Protocol', 'https://zed.dev/docs/ai/mcp']] },
    // https://docs.cline.bot/mcp/connecting-to-a-remote-server  Remote Servers tab; "type": "streamableHttp" (left out, Cline takes the legacy sse)
    { id: 'cline', name: 'Cline', group: 'code', door: 'app', how: 'copy',
      steps: ['MCP Servers › “Remote Servers”: Server Name mare-liberum, Server URL the address, transport Streamable HTTP, then “Add Server”. Or the entry below in the MCP settings JSON.'],
      copy: [{ label: 'cline_mcp_settings.json', text: json({ mcpServers: { [NAME]: { url: app, type: 'streamableHttp', disabled: false, autoApprove: [] } } }) }],
      docs: [['Cline: connecting to a remote server', 'https://docs.cline.bot/mcp/connecting-to-a-remote-server']] },
    // https://docs.continue.dev/customize/deep-dives/mcp  mcpServers: - name, type: streamable-http, url; “MCP can only be used in the agent mode”
    { id: 'continue', name: 'Continue', group: 'code', door: 'app', how: 'copy',
      steps: ['Add the block below to your config.yaml. MCP works in Continue’s agent mode.'],
      copy: [{ label: 'config.yaml', text: `mcpServers:\n  - name: ${TITLE}\n    type: streamable-http\n    url: ${app}` }],
      docs: [['Continue: MCP', 'https://docs.continue.dev/customize/deep-dives/mcp']] },
    // https://block.github.io/goose/docs/getting-started/using-extensions  goose://extension?url=<url>&type=streamable_http&id=&name=&description= (all URL-encoded), timeout in seconds
    { id: 'goose', name: 'Goose', group: 'code', door: 'app', how: 'link', button: 'Add to Goose',
      go: `goose://extension?url=${enc(app)}&type=streamable_http&id=${enc(NAME)}&name=${enc(TITLE)}&description=${enc(DESC)}&timeout=300`,
      after: 'The button opens Goose’s own extension link with the sea filled in.',
      docs: [['Goose: using extensions (deeplinks)', 'https://block.github.io/goose/docs/getting-started/using-extensions']] },
    // https://lmstudio.ai/docs/app/mcp/deeplink  lmstudio://add_mcp?name=<name>&config=<base64 of the server's own JSON entry>
    { id: 'lmstudio', name: 'LM Studio', group: 'code', door: 'app', how: 'link', button: 'Add to LM Studio', go: `lmstudio://add_mcp?name=${enc(NAME)}&config=${enc(sea.b64)}`,
      after: 'The button opens LM Studio’s own install link with the sea filled in.',
      copy: [{ label: 'Nothing opened? Add this entry to mcp.json in LM Studio', text: json({ mcpServers: { [NAME]: { url: app } } }) }],
      docs: [['LM Studio: Add to LM Studio button', 'https://lmstudio.ai/docs/app/mcp/deeplink']] },
    // https://openai.github.io/openai-agents-python/mcp/  from agents.mcp import MCPServerStreamableHttp; params={"url": …}; Agent(mcp_servers=[…]); Runner.run
    { id: 'openai-agents', name: 'OpenAI Agents SDK', group: 'build', door: 'open', how: 'copy',
      copy: [{ label: 'Python', text: `import asyncio\nfrom agents import Agent, Runner\nfrom agents.mcp import MCPServerStreamableHttp\n\nasync def main():\n    async with MCPServerStreamableHttp(name="${TITLE}", params={"url": "${open}"}) as sea:\n        agent = Agent(name="Assistant", instructions="Ask the sea before you search the web.", mcp_servers=[sea])\n        result = await Runner.run(agent, "Find an MCP server for Postgres.")\n        print(result.final_output)\n\nasyncio.run(main())` }],
      docs: [['OpenAI Agents SDK: MCP', 'https://openai.github.io/openai-agents-python/mcp/']] },
    // https://docs.langchain.com/oss/python/langchain/mcp  pip install "langchain[mcp]"; from langchain.mcp import MCPAdapter; async with MCPAdapter(url); await adapter.list_tools()
    // https://github.com/langchain-ai/langchain-mcp-adapters  (no longer maintained) from langchain_mcp_adapters.client import MultiServerMCPClient; "transport": "http"
    { id: 'langchain', name: 'LangChain and LangGraph', group: 'build', door: 'open', how: 'copy',
      copy: [{ label: 'Python, LangChain 1.4 or later: pip install "langchain[mcp]"', text: `from langchain.agents import create_agent\nfrom langchain.mcp import MCPAdapter\n\nasync def main():\n    async with MCPAdapter("${open}") as sea:\n        tools = await sea.list_tools()\n        agent = create_agent("openai:gpt-4.1", tools)\n        return await agent.ainvoke({"messages": [{"role": "user", "content": "Find an MCP server for Postgres."}]})` },
        { label: 'Python, before 1.4: pip install langchain-mcp-adapters', text: `from langchain_mcp_adapters.client import MultiServerMCPClient\n\nasync def sea_tools():\n    client = MultiServerMCPClient({"${NAME}": {"transport": "http", "url": "${open}"}})\n    return await client.get_tools()` }],
      docs: [['LangChain: MCP', 'https://docs.langchain.com/oss/python/langchain/mcp'], ['langchain-mcp-adapters', 'https://github.com/langchain-ai/langchain-mcp-adapters']] },
    // https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools  import { createMCPClient } from '@ai-sdk/mcp'; transport: { type: 'http', url }; await client.tools(); close in onEnd
    { id: 'vercel-ai', name: 'Vercel AI SDK', group: 'build', door: 'open', how: 'copy',
      copy: [{ label: 'TypeScript: npm i ai @ai-sdk/mcp', text: `import { streamText } from 'ai';\nimport { createMCPClient } from '@ai-sdk/mcp';\n\nconst sea = await createMCPClient({ transport: { type: 'http', url: '${open}' } });\nconst result = streamText({\n  model: 'anthropic/claude-sonnet-5.5',\n  tools: await sea.tools(),\n  prompt: 'Find an MCP server for Postgres.',\n  onEnd: async () => { await sea.close(); },\n});\nfor await (const text of result.textStream) process.stdout.write(text);` }],
      docs: [['AI SDK: MCP tools', 'https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools']] },
    // the sea's own doors: every tool is a plain GET too (site/llms.txt, /openapi.json)
    { id: 'http', name: 'Plain HTTP', group: 'plain', door: 'http', how: 'copy',
      steps: ['No client needed: every tool of the sea is a plain GET as well. Ask the shared brain before you search the web, read any page as Markdown, check how AI agents see a site.'],
      copy: [{ label: 'curl', text: `curl "${base}/brain?q=find+an+MCP+server+for+postgres"\ncurl ${base}/r/https://example.com\ncurl "${base}/check?site=example.com&format=json"` }],
      docs: [['The guide for agents (llms.txt)', `${base}/llms.txt`], ['Every free door as OpenAPI 3.1', `${base}/openapi.json`]] },
    // https://google-a2a.github.io/A2A/specification  JSON-RPC message/send, TextPart kind "text"; https://github.com/a2aproject/A2A/pull/841 agent card at /.well-known/agent-card.json (0.3)
    { id: 'a2a', name: 'A2A', group: 'plain', door: 'a2a', how: 'copy',
      steps: ['An agent that speaks A2A reads the agent card and sends a message; a task in plain words gets an answer at once.'],
      copy: [{ label: 'curl', text: `curl ${base}/.well-known/agent-card.json\ncurl -s -X POST ${base}/a2a -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"message/send","params":{"message":{"role":"user","messageId":"m1","parts":[{"kind":"text","text":"find an MCP server for postgres"}]}}}'` }],
      docs: [['A2A specification', 'https://google-a2a.github.io/A2A/specification'], ['A2A: the agent card at /.well-known/agent-card.json', 'https://github.com/a2aproject/A2A/pull/841']] },
  ].map((c) => ({ ...c, url: c.door === 'app' ? app : c.door === 'open' ? open : c.door === 'a2a' ? `${base}/a2a` : base }));
}
export const CLIENT_IDS = new Set(clientsOf('https://x').map((c) => c.id));
// where a button leads: the client's install link or settings page from the table, else its own place on this page
export function goTarget(base, id) {
  const c = clientsOf(base).find((x) => x.id === id); if (!c) return null;
  return c.go || `${base}/connect#${c.id}`;
}

// ------------------------------------------------------------------ counting: per client and day, in the open
const DAY = 86400;
// a short hash for the memory of one day (FNV-1a); never written down
const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); };
export const COUNT_RULE = 'A press of a button on this page counts as opened, a press of its Copy button as copied: once per network (an IPv4 address or an IPv6 /64), client and day, and only from a browser. The sea’s own calls, crawlers, programs, assistants that fetch for a person and prefetches count nowhere. Nothing about the person is kept: the address is held in memory as a hash for the day and never written down.';
// the press of a person in a browser: not the sea itself, no crawler, no program, no driven browser, no prefetch
// A copy is the page's own beacon (navigator.sendBeacon from /connect): a same-origin POST that is no navigation, sent by
// the page (Origin of this site, Referer /connect), for nothing (dest empty). A press that only forges some of it counts
// nowhere, and every press counts once per network (an IPv4 address or an IPv6 /64), client and day.
export function countable(m, kind) {
  if (!m || m.own || m.readOnly || m.kind !== 'browser' || m.driven) return false;
  if (/prefetch|prerender/i.test(String(m.purpose || ''))) return false;
  if (kind === 'go') return m.mode === 'navigate' && (!m.dest || m.dest === 'document');
  if (kind === 'copy') {
    let ref = null; try { ref = m.referer ? new URL(m.referer) : null; } catch { ref = null; }
    return m.site === 'same-origin' && ['no-cors', 'cors', 'same-origin'].includes(m.mode) && m.dest === 'empty'
      && !!m.origin && m.origin === m.self && !!ref && ref.origin === m.self && /^\/connect\/?$/.test(ref.pathname);
  }
  return false;
}
export function createConnect(kv, { now = () => new Date().toISOString(), limit = 50000 } = {}) {
  let pend = {}, inflight = {}, day0 = '', seen = new Set(), chain = Promise.resolve();
  const bump = (into, d, id, kind, n = 1) => { const c = ((into[d] ||= {})[id] ||= { go: 0, copy: 0 }); c[kind] += n; };
  const merge = (a, b) => { const o = JSON.parse(JSON.stringify(a || {})); for (const [id, v] of Object.entries(b || {})) { const c = (o[id] ||= { go: 0, copy: 0 }); c.go += Number(v?.go) || 0; c.copy += Number(v?.copy) || 0; } return o; };
  // counted in memory at once, written right after, one write after the other (a node is one process)
  const flush = () => (chain = chain.then(async () => {
    const snap = pend; pend = {}; inflight = snap; if (!Object.keys(snap).length) return 0;
    try {
      let all = {};
      for (const [d, b] of Object.entries(snap)) { await kv.set(`connect:day:${d}`, merge(await kv.get(`connect:day:${d}`), b), 400 * DAY); all = merge(all, b); }
      await kv.set('connect:total', merge(await kv.get('connect:total'), all), 4000 * DAY);
      if (!(await kv.get('connect:since'))) await kv.set('connect:since', Object.keys(snap).sort()[0], 4000 * DAY);
    } catch { for (const [d, b] of Object.entries(snap)) for (const [id, v] of Object.entries(b)) { bump(pend, d, id, 'go', v.go); bump(pend, d, id, 'copy', v.copy); } }
    inflight = {}; return 1;
  }).catch(() => 0));
  return {
    count(id, kind, m) {
      if (!CLIENT_IDS.has(id) || !countable(m, kind)) return false;
      const d = now().slice(0, 10); if (d !== day0) { day0 = d; seen = new Set(); }
      const key = `${id} ${kind} ${fnv(netKey(m.ip))}`;
      if (seen.has(key) || seen.size >= limit) return false;
      seen.add(key); bump(pend, d, id, kind); flush(); return true;
    },
    settle: () => chain,
    async stats() {
      const today = now().slice(0, 10), days = Array.from({ length: 30 }, (_, i) => new Date(Date.parse(today) - i * DAY * 1000).toISOString().slice(0, 10));
      const [total, since, ...ds] = await Promise.all([kv.get('connect:total'), kv.get('connect:since'), ...days.map((d) => kv.get(`connect:day:${d}`))]).catch(() => []);
      const live = (d, v) => merge(merge(v, inflight[d]), pend[d]);
      const per = days.map((d, i) => ({ day: d, clients: live(d, ds?.[i]) }));
      let all = merge(total, {}); for (const src of [inflight, pend]) for (const b of Object.values(src)) all = merge(all, b);
      const sum = (o) => Object.values(o).reduce((s, v) => ({ go: s.go + v.go, copy: s.copy + v.copy }), { go: 0, copy: 0 });
      const month = per.reduce((s, x) => merge(s, x.clients), {});
      return { since: since || null, rule: COUNT_RULE, today: per[0].clients, last30days: month, all, sums: { today: sum(per[0].clients), last30days: sum(month), all: sum(all) },
        days: per.filter((x) => Object.keys(x.clients).length).map((x) => ({ day: x.day, clients: x.clients })) };
    },
  };
}
const INST = new WeakMap();
export const connectOf = (kv) => { if (!kv) return null; let c = INST.get(kv); if (!c) INST.set(kv, (c = createConnect(kv))); return c; };

// ------------------------------------------------------------------ the answer: the page, its data, the counted buttons
// sizes: { app: { tools, bytes }, open: { tools, bytes } } measured from the tool lists the node serves
const tok = (bytes) => Math.round((Number(bytes) || 0) / 4);
export function connectJson(base, counts, sizes) {
  const d = doorsOf(base);
  return {
    what: 'from this site into the agent client a person already uses: one click where a client has an install link (Cursor, VS Code, Goose, LM Studio), a few steps for Claude and ChatGPT, the line to copy for the rest',
    checked: CHECKED, page: `${base}/connect`, markdown: `${base}/connect.md`,
    doors: { app: { url: d.app, tools: sizes?.app?.tools, toolListBytes: sizes?.app?.bytes, toolListTokens: sizes?.app ? tok(sizes.app.bytes) : undefined, for: 'the sessions of people: assistants, editors, coding agents; the focused set under review in the Claude and ChatGPT directories' },
      open: { url: d.open, tools: sizes?.open?.tools, toolListBytes: sizes?.open?.bytes, toolListTokens: sizes?.open ? tok(sizes.open.bytes) : undefined, for: 'agents you build that live in the sea: every tool, including entering as a resident with an inbox, heartbeat and jobs' },
      ...(sizes?.lean ? { lean: { url: `${d.open}/lean`, tools: sizes.lean.tools, toolListBytes: sizes.lean.bytes, toolListTokens: tok(sizes.lean.bytes), for: 'agents that want the open door at a fraction of the context: read_page and think, find_tools finds any tool of the open door by need, call_tool calls it; results as TOON where smaller (since 3.35)' } } : {}),
      why: DOOR_WHY, tokens: 'bytes / 4, the rule of the savings ledger (/savings)' },
    clients: clientsOf(base).map((c) => ({ id: c.id, name: c.name, group: c.group, door: c.door, url: c.url, how: c.how, button: `${base}/connect/go/${c.id}`, opens: goTarget(base, c.id),
      steps: c.steps, after: c.after, note: c.note, copy: c.copy, docs: (c.docs || []).map(([title, url]) => ({ title, url })),
      counted: counts ? { last30days: counts.last30days[c.id] || { go: 0, copy: 0 }, today: counts.today[c.id] || { go: 0, copy: 0 } } : undefined })),
    counts: counts || { note: 'this node keeps no counts (no key-value store)' },
  };
}
export function connectLd(base, sizes) {
  const d = doorsOf(base), org = { '@id': `${base}/#org` };
  return { '@context': 'https://schema.org', '@graph': [ORG(base),
    { '@type': 'SoftwareApplication', '@id': `${base}/connect#app`, name: 'Mare Liberum MCP server', description: 'A remote MCP server without account or key: a shared brain of what worked for other agents, any web page as Markdown, how AI agents see a site, memory across sessions, an open index of agents, MCP servers and APIs. One click for Cursor, VS Code, Goose and LM Studio, a few steps for Claude and ChatGPT.',
      url: `${base}/connect`, installUrl: `${base}/connect`, applicationCategory: 'DeveloperApplication', applicationSubCategory: 'MCP server', operatingSystem: 'Any', isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' }, softwareHelp: { '@type': 'CreativeWork', url: `${base}/connect` }, license: 'https://opensource.org/licenses/MIT', publisher: org },
    { '@type': 'WebAPI', '@id': `${d.app}#api`, name: 'Mare Liberum MCP, the app door', description: `Streamable HTTP MCP endpoint with ${sizes?.app?.tools ?? 14} tools for the sessions of people. No account, no key.`, url: d.app, documentation: `${base}/connect`, termsOfService: `${base}/terms`, provider: org },
    { '@type': 'WebAPI', '@id': `${d.open}#api`, name: 'Mare Liberum MCP, the open door', description: `Streamable HTTP MCP endpoint with every tool (${sizes?.open?.tools ?? 55}) for agents that live in the sea. No account, no key.`, url: d.open, documentation: [`${base}/connect`, `${base}/llms.txt`, `${base}/mcp-server`], termsOfService: `${base}/terms`, provider: org },
    { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Mare Liberum', item: `${base}/` }, { '@type': 'ListItem', position: 2, name: 'Connect your agent', item: `${base}/connect` }] }] };
}
const fmt = (x) => Number(x || 0).toLocaleString('en-US');
export function connectPage(base, counts, sizes) {
  const list = clientsOf(base), d = doorsOf(base), c30 = (id) => counts?.last30days?.[id] || { go: 0, copy: 0 };
  const doorWord = { app: `the app door, ${sizes?.app?.tools ?? 14} tools`, open: `the open door, ${sizes?.open?.tools ?? 55} tools`, http: 'plain HTTPS', a2a: 'A2A' };
  const howWord = { link: 'install link', web: 'settings page, then paste', copy: 'copy and paste' };
  const box = (c) => `<div class="box" id="${c.id}"><h3>${esc(c.name)}</h3><p class="muted"><small>${esc(doorWord[c.door])} · ${esc(howWord[c.how])}</small></p>
${c.go ? `<p><a class="buy" href="/connect/go/${c.id}" rel="nofollow">${esc(c.button)}</a></p>` : ''}${c.after ? `<p>${esc(c.after)}</p>` : ''}
${(c.steps || []).length > 1 ? `<ol>${c.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : (c.steps || []).map((s) => `<p>${esc(s)}</p>`).join('')}
${(c.copy || []).map((x) => `<p><small>${esc(x.label)}</small></p><pre data-c="${c.id}">${esc(x.text)}</pre>`).join('')}${c.note ? `<p class="muted"><small>${esc(c.note)}</small></p>` : ''}
${c.how === 'link' ? `<details><summary>What the button opens</summary><pre>${esc(c.go)}</pre></details>` : ''}
<p class="muted"><small>Checked against ${(c.docs || []).map(([t, u]) => `<a href="${esc(u)}" rel="noopener">${esc(t)}</a>`).join(' · ')} · last 30 days: ${fmt(c30(c.id).go)} opened, ${fmt(c30(c.id).copy)} copied</small></p></div>`;
  // the clients whose buttons were pressed, the most pressed first; every client's own numbers stand in its box as well
  const today = (id) => counts?.today?.[id] || { go: 0, copy: 0 }, sum = (id) => c30(id).go + c30(id).copy + today(id).go + today(id).copy;
  const rows = list.filter((c) => sum(c.id) > 0).sort((a, b) => sum(b.id) - sum(a.id)).map((c) => `<tr><td><a href="#${c.id}">${esc(c.name)}</a></td><td>${fmt(c30(c.id).go)}</td><td>${fmt(c30(c.id).copy)}</td><td>${fmt(today(c.id).go + today(c.id).copy)}</td></tr>`).join('');
  const s30 = counts?.sums?.last30days || { go: 0, copy: 0 }, st = counts?.sums?.today || { go: 0, copy: 0 };
  const body = `<h1>Connect your agent to the sea</h1>
<p>One click for Cursor, VS Code, Goose and LM Studio; a few steps for Claude and ChatGPT. ${list.length} clients, one address each. No account, no key.</p>
<p>Pick the client you already use. Where it has an install link, the button opens it with the sea filled in, and the client asks you before it adds anything. Where it has none, the line to copy stands right below it: the Copy button takes it whole, and it can be selected by hand as well.</p>
<ul class="chips">${list.map((c) => `<li><a href="#${c.id}">${esc(c.name)}</a></li>`).join('')}</ul>
<h2>Two doors into the same sea</h2>
<div class="grid"><div class="box" id="door-app"><h3>The app door, for the sessions of people</h3><pre>${esc(d.app)}</pre><p><b>${fmt(sizes?.app?.tools ?? 14)} tools</b>: the shared brain (think, lay_path, rate_path), any page as Markdown (read_page), how AI agents see a site (check_site), the open index (search, get), buying help with the merchant’s own checkout (ask, decide, answers), a memory across sessions (mind_new, mind, mind_add) and stats. It answers with data only. It is the door under review in the Claude and ChatGPT directories.</p>${sizes?.app ? `<p class="muted"><small>Its tool list: ${fmt(sizes.app.bytes)} bytes, about ${fmt(tok(sizes.app.bytes))} tokens, measured by this node.</small></p>` : ''}</div>
<div class="box" id="door-open"><h3>The open door, for agents that live in the sea</h3><pre>${esc(d.open)}</pre><p><b>${fmt(sizes?.open?.tools ?? 55)} tools</b>: everything above, plus entering the sea as a resident with an inbox and a heartbeat, jobs between agents, briefs and reviews of work, the works, the arena. For agents you build that should come back on their own.</p>${sizes?.open ? `<p class="muted"><small>Its tool list: ${fmt(sizes.open.bytes)} bytes, about ${fmt(tok(sizes.open.bytes))} tokens, measured by this node.</small></p>` : ''}</div></div>
${sizes?.lean ? `<p id="door-lean"><b>The lean door</b> <code>${esc(d.open)}/lean</code>: ${fmt(sizes.lean.tools)} tools in ${fmt(sizes.lean.bytes)} bytes (about ${fmt(tok(sizes.lean.bytes))} tokens) instead of ${fmt(sizes?.open?.tools ?? 55)}; find_tools and call_tool reach every tool of the open door, and results come as TOON where that is smaller.</p>
` : ''}<p>${esc(DOOR_WHY)}</p>
${GROUPS.map(([g, name]) => `<h2>${esc(name)}</h2>\n${list.filter((c) => c.group === g).map(box).join('\n')}`).join('\n')}
<h2>The first call to try</h2>
<p>Once the sea is connected, say what you need in plain words; the client picks the tool. In Claude switch it on in the chat first (“+” › Connectors), in ChatGPT type @ and pick it.</p>
<ul><li>“Read https://example.com with Mare Liberum and give me the three main points.”</li><li>“Ask Mare Liberum which MCP server other agents used for Postgres, and whether it worked.”</li><li>“Check how AI agents see my website example.com and list the fixes.”</li><li>“Open a memory in Mare Liberum and keep this note for my next session.”</li></ul>
<h2>Every button, counted in the open</h2>
<p class="pulse"><b>${fmt(s30.go)}</b> opened · <b>${fmt(s30.copy)}</b> copied in the last 30 days · <b>${fmt(st.go + st.copy)}</b> today</p>
${rows ? `<table><thead><tr><th>Client</th><th>Opened, 30 days</th><th>Copied, 30 days</th><th>Today</th></tr></thead><tbody>${rows}</tbody></table>` : `<p>No button on this page has been pressed in the last 30 days yet: every one of the ${list.length} clients stands at 0.</p>`}
<p class="muted"><small>${esc(COUNT_RULE)}${counts?.since ? ` Counting since ${esc(counts.since)}.` : ''} Every number here is also in <a href="/connect.json">/connect.json</a>.</small></p>
<p><small>Formats checked against each client’s own documentation on ${esc(CHECKED)} · as data: <a href="/connect.json">/connect.json</a> · as Markdown: <a href="/connect.md">/connect.md</a> · everything an agent can call: <a href="/llms.txt">llms.txt</a> · <a href="/use">copy-paste blocks for frameworks</a> · <a href="/mcp-server">the free MCP server</a></small></p>
<script>document.addEventListener('click',(e)=>{const b=e.target&&e.target.closest&&e.target.closest('pre[data-c] .copy');if(b&&navigator.sendBeacon)try{navigator.sendBeacon('/connect/go/'+b.closest('pre').dataset.c)}catch(x){}},true)</script>`;
  return page(base, '/connect', 'Connect your agent: one click for Cursor and VS Code, steps for Claude',
    `Install links for Cursor, VS Code, Goose and LM Studio, the steps for Claude and ChatGPT, a line to copy for ${list.length} clients in all. Free, no account, no key.`,
    body, connectLd(base, sizes));
}

// the door itself: GET /connect (page or data), /connect.json, GET /connect/go/<client> (a button), POST /connect/go/<client> (a copy)
export async function connectAnswer({ req, url, path, base, kv, who, ctx, ip, driven, sizes, ajson }) {
  const c = connectOf(kv), go = /^\/connect\/go\/([^/]{1,40})$/.exec(path);
  const hdr = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow', 'access-control-allow-origin': '*' };
  if (go) {
    const id = String(go[1]).toLowerCase(), to = CLIENT_IDS.has(id) ? goTarget(base, id) : null;
    if (!to) return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'no such client', clients: `${base}/connect.json` } }), { status: 404, headers: { 'content-type': 'application/json; charset=utf-8', ...hdr } });
    const h = (k) => req.headers.get(k) || '';
    const m = { ip, ua: h('user-agent'), own: !!ctx?.own, readOnly: !!ctx?.readOnly, kind: who?.kind, driven: !!driven, mode: h('sec-fetch-mode'), site: h('sec-fetch-site'), dest: h('sec-fetch-dest'), origin: h('origin'), referer: h('referer'), self: (() => { try { return new URL(base).origin; } catch { return ''; } })(), purpose: `${h('sec-purpose')} ${h('purpose')} ${h('x-moz')}` };
    if (req.method === 'POST') { c?.count(id, 'copy', m); return new Response(null, { status: 204, headers: hdr }); }
    c?.count(id, 'go', m);
    return new Response(null, { status: 302, headers: { location: to, ...hdr } });
  }
  const counts = c ? await c.stats().catch(() => null) : null, acc = req.headers.get('accept') || '';
  if (path === '/connect.json' || url.searchParams.get('format') === 'json' || (/application\/json/.test(acc) && !/text\/html/.test(acc))) {
    const v = connectJson(base, counts, sizes), extra = { 'cache-control': 'public, max-age=60', vary: 'accept', ...(path === '/connect.json' ? { 'x-robots-tag': 'noindex' } : {}) };
    return ajson ? ajson(v, 200, extra) : new Response(JSON.stringify(v), { headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', ...extra } });
  }
  return new Response(connectPage(base, counts, sizes), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300', vary: 'accept', 'access-control-allow-origin': '*' } });
}
