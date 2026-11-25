// Mare Liberum · the guides: one task a developer searches for, one page each (/guides, /guides/<slug>; since the reach of D9)
// A developer does not search for "the engine room". They search for what hurts: an agent's token bill, a tool list that
// fills the context, a page read again and again, JSON answers full of fields nobody reads, a gateway to put something
// into. Each guide answers one of those with the levers the sea already has (node/engine.mjs, node/engine-ui.mjs): what to
// type, what it was measured to spare, and where it spares nothing. Every page is plain HTML through page() of
// node/pages.mjs, dressed by node/skin.mjs like every page (the header, the foot with the two buttons the law asks for),
// with its Markdown twin at <path>.md (node/agentmd.mjs) and TechArticle data for search engines.
// Every number a guide says comes from one place in the code or in proof/, gathered in guideFacts() below and named
// beside it: the engine bench (proof/engine-<day>.json, shown on /engine), the proof of function (proof/bench-<day>.json,
// shown on /proof), the toll (node/toll.mjs, /engine#toll), the limits of the squeeze and the reader (node/squeeze.mjs,
// node/press.mjs), the projection of fields= (node/toondoor.mjs) and the gateways (integrations/gateways/). Text quoted
// from a source (the toll's lines, the engine's rules) is quoted word for word. tools/reach-pages-proof.mjs takes every
// number off each page and finds it in those sources, or fails; no superlatives, no comparison with anyone else.
import { page, esc } from './pages.mjs';
import { ORG } from './seo.mjs';
import { LEVERS, ENGINE_RATIOS } from './engine.mjs';
import { engineData, loadEngineBench, ENGINE_RULES, SOURCES, CACHING, PLUG_CHECKED } from './engine-ui.mjs';
import { loadBench } from './proof.mjs';
import { TOLL, TOLL_EXAMPLE, tollFacts } from './toll.mjs';
import { SQUEEZE } from './squeeze.mjs';
import { createVersions, compressUse } from './press.mjs';
import { TOON_MIN_GAIN } from './toon.mjs';

const TOK = 'o200k_base', TOKS = ['o200k_base', 'cl100k_base', 'claude-legacy'];
// fields= (node/toondoor.mjs fieldsOf): at most 64 paths of at most 12 steps, read from the first 2,000 characters of the
// parameter. Literals there; tools/reach-pages-proof.mjs holds them to what fieldsOf does
export const FIELDS_LIMITS = Object.freeze({ paths: 64, steps: 12, chars: 2000 });
// the two gateways (integrations/gateways/litellm_mare_compress.py, vercel-ai-mare-compress.ts): their defaults, as their
// files set them; tools/reach-pages-proof.mjs reads both files and holds these to them
export const GATEWAY = Object.freeze({ minChars: 2000, timeoutS: 4, maxTexts: 8, remember: 256 });
const REPO = 'https://github.com/daoudandiaye98-alt/mare-liberum';
// the machine-readable description of the reader and /compress (node/readerapi.mjs)
export const READER_API = '/openapi/reader.json';

const n = (x) => (x == null || !Number.isFinite(Number(x)) ? '–' : Number(x).toLocaleString('en-US'));
// a change in words, as /engine says it: "25.9 % fewer" or "8.3 % more"
export const fewer = (a, b) => { if (!(b > 0) || a == null) return '–'; const x = Math.round((1 - a / b) * 1000) / 10; return x >= 0 ? `${x} % fewer` : `${-x} % more`; };
const pct = (share) => `${Math.round(share * 1000) / 10} %`;

// ------------------------------------------------------------------ the facts: every number a guide says, with its source
export function guideFacts(base) {
  const bench = loadEngineBench(), proof = loadBench(), M = bench?.mcp, T = bench?.summary?.totals?.[TOK];
  const P = proof?.summary, R = P?.reading?.[TOK], V = createVersions().stats();
  const eng = engineData(base, { savings: null, on: true });
  return {
    engine: bench && T ? { date: bench.date, file: `/engine/bench-${bench.date}.json`, answers: (bench.fixtures || []).length, json: T.json, sent: T.sent, toon: T.toon, rule: T.rule,
      smaller: (T.toonSmallerIn || []).length, ruleIn: T.ruleIn || [], minGain: bench.toonRule?.minSaving ?? TOON_MIN_GAIN } : null,
    mcp: M ? { date: bench.date, file: `/engine/bench-${bench.date}.json`, full: M.full, lean: M.lean, names: M.lean.names || [] } : null,
    proof: R ? { date: proof.date, file: `/proof/bench-${proof.date}.json`, pages: P.measured, html: R.html?.median, text: R.text?.median, md: R.markdown?.median, htmlPerMd: P.times?.[TOK]?.htmlPerMarkdown } : null,
    ratios: ENGINE_RATIOS,
    delta: { page: TOLL_EXAMPLE.page, saved: TOLL_EXAMPLE.saved, read: TOLL_EXAMPLE.page - TOLL_EXAMPLE.saved, hours: V.hours, mb: Math.round(V.maxBytes / (1024 * 1024)), diffEdits: SQUEEZE.diffEdits },
    squeeze: { mb: Math.round(SQUEEZE.maxBytes / (1024 * 1024)), jsonDepth: SQUEEZE.jsonDepth, minBudget: SQUEEZE.minBudget, timeS: SQUEEZE.timeMs / 1000 },
    toon: { gain: pct(TOON_MIN_GAIN) },
    fields: FIELDS_LIMITS, gateway: GATEWAY,
    toll: { free: TOLL.free, facts: tollFacts(base) },
    levers: eng.levers, plug: eng.plug, use: compressUse(base),
  };
}

// ------------------------------------------------------------------ the pieces every guide is made of
const pre = (text) => `<pre><code>${esc(text)}</code></pre>`;
const label = (text) => `<p><small>${esc(text)}</small></p>`;
const lines = (list) => list.map((l) => `${label(l.label)}${pre(l.text)}`).join('');
const docs = (list) => `<p class="muted"><small>Checked against ${list.map(([t, u]) => `<a href="${esc(u)}" rel="noopener">${esc(t)}</a>`).join(' · ')}</small></p>`;
const ul = (items) => `<ul>${items.map((x) => `<li>${x}</li>`).join('')}</ul>`;
const crumbs = (base, items) => ({ '@type': 'BreadcrumbList', itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: `${base}${path}` })) });
const article = (base, g) => ({ '@context': 'https://schema.org', '@graph': [ORG(base), crumbs(base, [['Mare Liberum', '/'], ['Guides', '/guides'], [g.h1, g.path]]),
  { '@type': 'TechArticle', headline: g.h1, name: g.title, description: g.desc, url: `${base}${g.path}`, inLanguage: 'en', isAccessibleForFree: true, about: g.about, proficiencyLevel: 'Beginner',
    isPartOf: { '@type': 'WebSite', name: 'Mare Liberum', url: `${base}/` }, publisher: { '@id': `${base}/#org` } }] });

// ------------------------------------------------------------------ the guides
// each: path, title (unique, for the search result), desc (unique), h1, about (for the structured data), body(F, base)
const GUIDES = [
  {
    slug: 'cut-llm-token-costs',
    title: () => 'Cut the LLM token costs of an AI agent: six levers, measured | Mare Liberum',
    desc: () => 'Where an agent\'s tokens go and six opt-in levers that spare some of them: TOON for tables, fields=, a lean MCP door, POST /compress, since= and budget=. Each with what it was measured to spare, where it spares nothing, and a line to copy.',
    h1: 'Cut the token costs of an AI agent',
    about: ['LLM token cost', 'AI agents', 'Model Context Protocol', 'TOON', 'HTTP ETag'],
    body: (F, base) => {
      const E = F.engine, M = F.mcp, P = F.proof, D = F.delta, L = Object.fromEntries(F.levers.map((x) => [x.id, x]));
      const row = (id, measured, not, guide) => `<tr><td><a href="/engine#${id}">${esc(L[id].name)}</a></td><td>${esc(L[id].losslessIs)}</td><td>${measured}</td><td>${not}</td><td>${guide ? `<a href="${guide}">the guide</a>` : '–'}</td></tr>`;
      return `<p>An agent pays for every token it reads: the pages it opens, the tool definitions its client loads, the JSON answers it gets, the text it passes on. Six levers of the open sea spare some of them. Each acts only when the agent asks for it, says in its headers what it spared, and is counted in <a href="/savings">one public ledger</a>. Below: what each was measured to spare, where it spares nothing, and the line to copy. No account, no key.</p>
<h2>First: what a page costs</h2>
${P ? `<p>On the task set of the <a href="/proof">proof of function</a> (${n(P.pages)} pages, measured ${esc(P.date)}, ${TOK}), the median destination page took <b>${n(P.html)}</b> tokens as raw HTML, <b>${n(P.md)}</b> as the Markdown of the sea's reader and <b>${n(P.text)}</b> as plain text. The Markdown keeps headings, links and tables, so it is longer than plain text. Page by page, raw HTML took a median of ${n(P.htmlPerMd)} times the tokens of the Markdown. An agent that reads pages itself starts there:</p>` : '<p>The proof of function has no run on this node yet: <a href="/proof">/proof</a>.</p>'}
${pre(`curl -s ${base}/r/https://example.com/`)}
<h2>The six levers</h2>
<div class="tw"><table><thead><tr><th>Lever</th><th>Loses anything?</th><th>Measured</th><th>Where it spares nothing</th><th>Guide</th></tr></thead><tbody>
${row('toon', E ? `On ${n(E.answers)} real answers (bench of ${esc(E.date)}): TOON was smaller for ${n(E.smaller)} and at least ${F.toon.gain} smaller, the rule of the lever, for ${n(E.ruleIn.length)} (${esc(E.ruleIn.join(', '))}). With the rule, ${n(E.rule)} tokens instead of ${n(E.sent)} (${fewer(E.rule, E.sent)}). All ${n(E.answers)} as TOON: ${n(E.toon)} (${fewer(E.toon, E.sent)}).` : '–', 'Answers that are not tables: the lever then sends the JSON and says why in <code>x-sea-engine-note</code>.')}
${row('lean', M ? `The tool list: <b>${n(M.lean.tokens[TOK])}</b> tokens instead of <b>${n(M.full.tokens[TOK])}</b> (${n(M.full.tools)} tools behind ${n(M.lean.tools)}).` : '–', 'Clients that defer tool definitions already: Claude Code, Copilot CLI, OpenAI\'s Agents API.', '/guides/lean-mcp-tool-list')}
${row('delta', `The example of <a href="/engine#toll">the toll</a>: a page of ${n(D.page)} tokens read again costs <b>${n(D.read)}</b> (${n(D.saved)} saved); If-None-Match answers 304 without a body.`, 'A page that changes on every read.', '/guides/read-a-page-again')}
${row('budget', `You name the budget; a page is fitted to it, never below ${n(F.squeeze.minBudget)} tokens.`, 'It leaves parts out (marked), so it counts in no headline.')}
${row('fields', 'You name the fields; the rest of the answer stays out.', 'It leaves members out, so it counts in no headline.', '/guides/only-the-fields-you-need')}
${row('squeeze', `Lossless steps first; a body of up to ${n(F.squeeze.mb)} MB.`, 'A model that sends text it already holds: it pays for that text again as output tokens.', '/guides/compress-litellm-vercel-ai-sdk')}
</tbody></table></div>
<h2>A line for each</h2>
${F.levers.map((x) => `<h3 id="${esc(x.id)}">${esc(x.name)}</h3><p>${esc(x.spares)}</p>${pre(x.call)}<p><small>${esc(x.also)}</small></p>`).join('')}
<h2>How the savings are counted</h2>
<p>${esc(ENGINE_RULES.measuring)}</p>
<p>${esc(ENGINE_RULES.apart)}</p>
${F.ratios ? `<p>The ratios of the bench: one token holds ${esc(String(F.ratios.json))} UTF-8 bytes of JSON and ${esc(String(F.ratios.toon))} of TOON (${esc(F.ratios.tokenizer)}, ${esc(F.ratios.date)}).</p>` : ''}
<p>What a saving is worth: the prices of the ledger are ${esc(CACHING)}.</p>
<p>Every answer a lever shaped says so: <code>x-sea-engine</code> (the lever), <code>x-sea-engine-tokens</code> (before-&gt;after), <code>x-sea-engine-saved</code>, and <code>x-sea-engine-lossy</code> when it left something out.</p>
<h2>What it costs</h2>
<p>${esc(F.toll.facts.line)} The rule, the formula and whether it acts on this node: <a href="/engine#toll">/engine#toll</a>.</p>`;
    },
  },
  {
    slug: 'lean-mcp-tool-list',
    title: (F) => (F.mcp ? `Lean MCP door: a tool list of ${n(F.mcp.lean.tokens[TOK])} tokens instead of ${n(F.mcp.full.tokens[TOK])} | Mare Liberum` : 'Lean MCP door: a smaller MCP tool list | Mare Liberum'),
    desc: () => 'An MCP client that loads every tool definition reads the whole tool list on every model call. The lean door lists four tools that find and call all the others. When it helps, when it does not (Claude Code defers tool definitions already), and the line for each client.',
    h1: 'Lean MCP door: a smaller tool list',
    about: ['Model Context Protocol', 'MCP tool list', 'LLM context window', 'AI agents'],
    body: (F, base) => {
      const M = F.mcp, L = F.levers.find((x) => x.id === 'lean'), C = Object.fromEntries(F.plug.clients.map((c) => [c.id, c]));
      const t = (side) => TOKS.map((k) => `<td>${n(side.tokens?.[k])}</td>`).join('');
      const client = (c) => `<h3 id="${esc(c.id)}">${esc(c.name)}</h3>${lines(c.lines)}${c.note ? `<p class="muted"><small>${esc(c.note)}</small></p>` : ''}${docs(c.docs)}`;
      return `<p>An MCP client may put every tool definition of a server into the model's context on every turn. The open door of the sea, <code>${esc(base)}/mcp</code>, lists every tool of the sea${M ? ` (${n(M.full.tools)} when the bench of ${esc(M.date)} counted them)` : ''}. The lean door, <code>${esc(base)}/mcp/lean</code>, lists four: ${M ? M.names.map((x) => `<code>${esc(x)}</code>`).join(', ') : 'read_page, think, find_tools and call_tool'}. <code>find_tools</code> finds any other tool by what it is for, and <code>call_tool</code> calls it with the same answer, limits and counting as the open door.</p>
<h2>What it spares</h2>
${M ? `<p>The tool list of each door, as one JSON answer of <code>tools/list</code>, counted with three tokenizers (bench of ${esc(M.date)}, <a href="${esc(M.file)}">the run as data</a>, shown on <a href="/engine">/engine</a>):</p>
<div class="tw"><table><thead><tr><th>Door</th><th>Tools</th><th>Bytes</th>${TOKS.map((k) => `<th>${esc(k)}</th>`).join('')}</tr></thead><tbody>
<tr><td><code>/mcp</code></td><td>${n(M.full.tools)}</td><td>${n(M.full.bytes)}</td>${t(M.full)}</tr>
<tr><td><code>/mcp/lean</code></td><td>${n(M.lean.tools)}</td><td>${n(M.lean.bytes)}</td>${t(M.lean)}</tr>
</tbody></table></div>
<p>In a client that loads every definition, that is <b>${n(M.full.tokens[TOK] - M.lean.tokens[TOK])}</b> tokens fewer on every model call (${TOK}, ${fewer(M.lean.tokens[TOK], M.full.tokens[TOK])}).</p>` : '<p>No run of the engine bench is on this node yet.</p>'}
<h2>When it helps, and when it does not</h2>
<p>${esc(L.where)}</p>
<p>On prompt caching: the prices of the ledger are ${esc(CACHING)}. So the lean door is worth most where nothing is cached and every definition is loaded: an agent loop of your own, Gemini CLI, Cline, Roo, Zed.</p>
<p>Answers are the same as on the open door. A tool result goes out as text only, once (TOON where it is at least ${F.toon.gain} fewer tokens than compact JSON, else the JSON), so a client that reads both text and structured content does not read an answer twice. The tool list itself is never tolled.</p>
<h2>Add it to your client</h2>
<p>Every line follows the client's own documentation, read on ${esc(F.plug.checked)}. More clients, each with an install button where it has one: <a href="/connect">/connect</a>.</p>
${['claude-code', 'cursor', 'vscode', 'codex', 'gemini', 'openai-agents', 'vercel-ai', 'litellm'].filter((id) => C[id]).map((id) => client(C[id])).join('')}
<h2>Check it yourself</h2>
${pre(`curl -s ${base}/mcp/lean -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | wc -c`)}
<p>Where the claims about deferred tools come from: ${SOURCES.filter((s) => /tool search|deferred|defer_loading|mcp-compressor/i.test(s.what)).map((s) => `<a href="${esc(s.url)}" rel="noopener">${esc(s.what)}</a>`).join(' · ')}.</p>`;
    },
  },
  {
    slug: 'read-a-page-again',
    title: (F) => `Read a web page again for ${n(F.delta.read)} tokens: since= and If-None-Match | Mare Liberum`,
    desc: () => 'An agent that checks a page for changes pays for the whole page each time. With the ETag of its first read, the reader answers unchanged in one line, only the lines that changed, or a 304 without a body.',
    h1: (F) => `Read a web page again for ${n(F.delta.read)} tokens`,
    about: ['HTTP ETag', 'If-None-Match', 'web page to Markdown', 'AI agents', 'LLM token cost'],
    body: (F, base) => {
      const D = F.delta, u = `${base}/r/https://example.com/`, tag = 'e1-0123456789abcdef0123';
      return `<p>An agent that watches a page (a price, a changelog, a status, a document it works on) reads it again and again, and pays for the whole page every time. The reader of the sea, <code>/r/&lt;address&gt;</code>, gives every Markdown answer an ETag. Send it back and the answer is only what changed. In the example of <a href="/engine#toll">/engine#toll</a>, a page of ${n(D.page)} tokens read again costs <b>${n(D.read)}</b> tokens: the one line that says it is unchanged (${n(D.saved)} saved). The line names the page's address, so a longer address makes it a little longer.</p>
<h2>First: read once and keep the ETag</h2>
${pre(`curl -sD - '${u}'`)}
<p>The headers carry <code>ETag: W/"e1-…"</code> and <code>x-sea-delta</code>, the address to read the page again for only what changed. The body is the page as Markdown, the same as without them.</p>
<h2>Then: read again with since=</h2>
${pre(`curl -s '${u}?since=${tag}'`)}
<p>Three answers can come back:</p>
${ul([
  '<b>Unchanged</b>: one line, <code>Unchanged since e1-…: &lt;address&gt; (checked … UTC through Mare Liberum)</code>.',
  `<b>Changed</b>: the lines that went out ("-") and came in ("+"), each under the nearest heading above it, and the new ETag. When more changed than the reader says line by line (more than ${n(D.diffEdits)} lines), or the changed lines are no shorter than the page, the whole page comes with a note.`,
  `<b>Not kept</b>: the reader keeps the versions it sent ${n(D.hours)} hours in memory (at most ${n(D.mb)} MB in all). An older ETag gets the whole page and a note, and the new ETag.`,
])}
<h2>Or: If-None-Match for a 304</h2>
${pre(`curl -s -o /dev/null -w '%{http_code}\\n' -H 'If-None-Match: W/"${tag}"' '${u}'`)}
<p>With the ETag of the page as it is now, the answer is 304 without a body. A HEAD with If-None-Match is answered the same way. The JSON form of the reader (<code>format=json</code>) knows neither since= nor If-None-Match; they are for the Markdown answer.</p>
<h2>In your code</h2>
${pre(`import urllib.request\n\nseen = {}  # address -> the ETag of the last answer\n\ndef read(address: str) -> str:\n    url = "${base}/r/" + address\n    tag = seen.get(address)\n    if tag:\n        url += ("&" if "?" in address else "?") + "since=" + tag.strip('W/"')\n    with urllib.request.urlopen(url, timeout=30) as r:\n        if r.headers.get("ETag"):\n            seen[address] = r.headers["ETag"]\n        return r.read().decode()`)}
${pre(`const seen = new Map<string, string>(); // address -> the ETag of the last answer\n\nexport async function read(address: string): Promise<string> {\n  const tag = seen.get(address)?.replace(/^W\\/"|"$/g, '');\n  const url = '${base}/r/' + address + (tag ? (address.includes('?') ? '&' : '?') + 'since=' + tag : '');\n  const r = await fetch(url);\n  const etag = r.headers.get('etag');\n  if (etag) seen.set(address, etag);\n  return r.text();\n}`)}
<h2>Where it spares nothing</h2>
<p>A page that changes on every read (a live counter, a feed, a time stamp in its text) sends its changed lines or the whole page each time. The first read of a page costs the page; the lever spares only from the second read on.</p>
<h2>What it costs</h2>
<p>The lever is lossless and counted in the public ledger of <a href="/savings">/savings</a>, once a day per network and page. ${esc(F.toll.facts.example)}</p>
<p>${esc(F.toll.facts.line)}</p>
<p><small>The reader as a whole: <a href="/web-to-markdown">web page to Markdown</a> · its OpenAPI description: <a href="${READER_API}">${READER_API}</a> · the lever on <a href="/engine#delta">/engine</a></small></p>`;
    },
  },
  {
    slug: 'only-the-fields-you-need',
    title: () => 'Only the fields you need: fields= on any JSON answer for AI agents | Mare Liberum',
    desc: () => 'Name the fields an agent needs, with dots for nested ones, and every other member of a JSON answer stays out. Deterministic, no model in between; it leaves things out, so it says so in a header and counts in no headline.',
    h1: 'Only the fields you need',
    about: ['JSON', 'API response projection', 'AI agents', 'LLM token cost'],
    body: (F, base) => {
      const L = F.levers.find((x) => x.id === 'fields'), X = F.fields;
      return `<p>A JSON answer carries every field of every row, and an agent reads all of them. On every JSON door of the sea, <code>fields=</code> names the ones it needs; the rest stays out. No model is asked, so the same request gives the same answer.</p>
${pre(L.call)}
<h2>The rules</h2>
${ul([
  'A comma-separated list of paths; a dot goes one level down: <code>fields=hero.tokens,hero.measured</code>.',
  'An array is projected element by element: on <code>/routes.json</code>, <code>fields=topics.id,topics.title</code> keeps those two members of every topic.',
  'A path that is not there gives nothing, never an error.',
  `At most ${n(X.paths)} paths of at most ${n(X.steps)} steps each, read from the first ${n(X.chars)} characters of the parameter.`,
  `With <code>fmt=toon</code> as well: the projection first, then TOON where it is at least ${F.toon.gain} smaller than compact JSON.`,
])}
<h2>What it says about itself</h2>
<p>A projected answer carries <code>x-sea-engine: fields</code>, <code>x-sea-engine-tokens</code> (before-&gt;after, against the compact JSON of the whole answer) and <code>x-sea-engine-lossy: 1</code>. What it left out is gone, so it is counted apart from the lossless levers and in no figure of the headline of <a href="/savings">/savings</a>; it carries no ETag of the whole answer. It is never tolled.</p>
<h2>Where it acts</h2>
<p>On every door that answers JSON: the brain, the search, the routes, the savings, the engine room itself, and the rest. Not on the app door <code>/mcp/app</code>, not on <code>/compress</code> and not on the reader <code>/r/</code>: they have forms of their own, and the query of a reader address belongs to the page it reads.</p>
${pre(`curl -s '${base}/engine.json?fields=levers.id,levers.losslessIs'\ncurl -s '${base}/routes.json?fields=topics.id,topics.title&fmt=toon'`)}
<h2>Where it spares nothing</h2>
<p>An answer that holds only what you need already. And a field you name by a wrong path: it is left out without an error, so check a first answer without fields= to see the names.</p>
<p><small>The lever on <a href="/engine#fields">/engine</a> · every JSON door as OpenAPI: <a href="/openapi.json">/openapi.json</a></small></p>`;
    },
  },
  {
    slug: 'compress-litellm-vercel-ai-sdk',
    title: () => '/compress in a LiteLLM proxy or the Vercel AI SDK: smaller tool results | Mare Liberum',
    desc: () => 'Send long tool results through POST /compress before they reach the model: lossless steps only, the answer taken only when it is smaller, the original kept on any error. A LiteLLM proxy callback and a Vercel AI SDK middleware to copy.',
    h1: '/compress in a LiteLLM proxy or the Vercel AI SDK',
    about: ['LiteLLM', 'Vercel AI SDK', 'LLM gateway', 'tool results', 'LLM token cost'],
    body: (F, base) => {
      const C = Object.fromEntries(F.plug.clients.map((c) => [c.id, c])), Q = F.plug.compress, G = F.gateway, U = F.use;
      const litellm = C.litellm, vercel = Q.lines.find((l) => /Vercel AI SDK/.test(l.label));
      return `<p>Tool results are often the longest text an agent's model reads: a page as HTML, a JSON answer, a log. <code>POST ${esc(base)}/compress</code> gives such a text back smaller by lossless steps; a gateway between the agent and its model can send every long tool result there first. Both files below send only tool results of at least ${n(G.minChars)} characters, take the answer only when it is smaller in UTF-8 bytes, and keep the original text on any error or timeout.</p>
<h2>What /compress does to a text</h2>
${ul(U.lossless.map((x) => esc(x)))}
<p>Only when you name a question (<code>q</code>) or a token budget (<code>budget</code>) does it leave parts out, and then it says so (<code>lossy: true</code>, <code>x-sea-engine-lossy: 1</code>). The gateways below name neither.</p>
<h2>LiteLLM proxy</h2>
${litellm ? lines(litellm.lines) : ''}
<p>The callback: <a href="${esc(`${REPO}/blob/main/integrations/gateways/litellm_mare_compress.py`)}" rel="noopener">integrations/gateways/litellm_mare_compress.py</a>, put beside <code>config.yaml</code>. It reads the tool results of OpenAI chat messages, Anthropic tool_result blocks and Responses API function_call_output items. Settings from the environment: <code>MARE_COMPRESS_MIN_CHARS</code> (${n(G.minChars)}), <code>MARE_COMPRESS_TIMEOUT</code> (${n(G.timeoutS)} seconds per text), <code>MARE_COMPRESS_MAX_TEXTS</code> (${n(G.maxTexts)} texts per request), <code>MARE_COMPRESS_URL</code>. It remembers ${n(G.remember)} answers in memory, so a conversation sent again sends no text twice and keeps the same prefix for prompt caching.</p>
${litellm ? docs(litellm.docs) : ''}
<h2>Vercel AI SDK</h2>
${vercel ? lines([vercel]) : ''}
<p>The middleware: <a href="${esc(`${REPO}/blob/main/integrations/gateways/vercel-ai-mare-compress.ts`)}" rel="noopener">integrations/gateways/vercel-ai-mare-compress.ts</a>, no packages (fetch and Web Crypto). Options: <code>minChars</code> (${n(G.minChars)}), <code>timeoutMs</code> (${n(G.timeoutS * 1000)}), <code>maxTexts</code> (${n(G.maxTexts)}), <code>url</code>, <code>fetch</code>. It remembers ${n(G.remember)} answers as the callback does.</p>
${docs(Q.docs)}
<h2>Your own pipeline</h2>
${lines(Q.lines.filter((l) => l !== vercel))}
<h2>Limits and answers</h2>
${ul([
  `A body of up to ${n(F.squeeze.mb)} MB (413 above); JSON nested at most ${n(F.squeeze.jsonDepth)} levels; one text at a time per node and at most ${n(F.squeeze.timeS)} seconds of work on it.`,
  'Busy or resting: 503 with Retry-After. Too fast from one network: 429. Both gateways then keep the original text.',
  'The answer: JSON with <code>out</code>, <code>form</code>, <code>tokens</code> (before, after, saved), <code>steps</code>, <code>lossy</code> and <code>note</code>; only the text with <code>Accept: text/plain</code> or <code>text/markdown</code>.',
  `As OpenAPI 3.1: <a href="${READER_API}">${READER_API}</a>.`,
])}
<h2>What leaves your proxy, and what is kept</h2>
<p>Only the text of the tool results sent. ${esc(ENGINE_RULES.privacy)} Leave the callback out for tool results you may not send to a third party.</p>
<h2>Where it spares nothing</h2>
<p>A tool result that is short, plain text without repeats, or compact JSON that holds no table comes back no smaller, and the gateway keeps it. And /compress is not for a model to call itself with text it already holds. As <code>GET /compress</code> says it: ${esc(U.for.replace(/^programs between an agent and its model: a hook, a proxy, a pipeline\. /, ''))}.</p>
<h2>What it costs</h2>
<p>${esc(F.toll.facts.line)} Tested: the snippets run against a node in <code>tools/pipes-proof.mjs</code>; the callback and the middleware have their own tests beside them.</p>`;
    },
  },
];

export const GUIDE_SLUGS = GUIDES.map((g) => g.slug);
export const GUIDE_PATHS = ['/guides', ...GUIDE_SLUGS.map((s) => `/guides/${s}`)];
const valueOf = (x, F) => (typeof x === 'function' ? x(F) : x);
// one guide as the page says it: path, title, desc, h1, about
export function guideMeta(slug, F) { const g = GUIDES.find((x) => x.slug === slug); return g ? { slug, path: `/guides/${slug}`, title: valueOf(g.title, F), desc: valueOf(g.desc, F), h1: valueOf(g.h1, F), about: g.about } : null; }

const nextOf = (slug, F) => `<h2>More guides</h2>${ul(GUIDES.filter((x) => x.slug !== slug).map((x) => { const m = guideMeta(x.slug, F); return `<a href="${m.path}">${esc(m.h1)}</a>`; }))}
<p><small>Sources of every number on this page: <a href="/engine">/engine</a>${F.engine ? ` (<a href="${esc(F.engine.file)}">the bench run</a>)` : ''} · <a href="/proof">/proof</a>${F.proof ? ` (<a href="${esc(F.proof.file)}">the run</a>)` : ''} · <a href="/engine#toll">the toll</a> · the code: <a href="${REPO}" rel="noopener">github.com/daoudandiaye98-alt/mare-liberum</a></small></p>`;

export function guidePage(base, slug, F = guideFacts(base)) {
  const g = GUIDES.find((x) => x.slug === slug); if (!g) return null;
  const m = guideMeta(slug, F);
  const body = `<p><a href="/guides">Guides</a> · <a href="/engine">The engine room</a></p><h1>${esc(m.h1)}</h1>${g.body(F, base)}${nextOf(slug, F)}`;
  return page(base, m.path, m.title, m.desc, body, article(base, m));
}

export function guidesIndexPage(base, F = guideFacts(base)) {
  const list = GUIDES.map((g) => guideMeta(g.slug, F));
  const ld = { '@context': 'https://schema.org', '@graph': [ORG(base), crumbs(base, [['Mare Liberum', '/'], ['Guides', '/guides']]),
    { '@type': 'CollectionPage', name: 'Guides for developers: spare an AI agent\'s tokens', url: `${base}/guides`, inLanguage: 'en', isPartOf: { '@type': 'WebSite', name: 'Mare Liberum', url: `${base}/` },
      mainEntity: { '@type': 'ItemList', itemListElement: list.map((m, i) => ({ '@type': 'ListItem', position: i + 1, name: m.h1, url: `${base}${m.path}` })) } }] };
  const body = `<p><a href="/engine">The engine room</a></p><h1>Guides for developers</h1>
<p>Five tasks of developers who build AI agents, each answered with what to type, what it was measured to spare and where it spares nothing. Every number comes from a measured run in the open (<a href="/engine">/engine</a>, <a href="/proof">/proof</a>) or from the code, and the page names which. No account, no key.</p>
<div class="grid">${list.map((m) => `<div class="box"><h3><a href="${m.path}">${esc(m.h1)}</a></h3><p>${esc(m.desc)}</p></div>`).join('')}</div>
<h2>For programs</h2>
${ul([
  `<a href="${READER_API}">${READER_API}</a>: the reader <code>/r/</code> and <code>POST /compress</code> as OpenAPI 3.1`,
  '<a href="/openapi.json">/openapi.json</a>: every free GET door as OpenAPI 3.1',
  '<a href="/engine.json">/engine.json</a>: the six levers with their live numbers',
  '<a href="/llms.txt">/llms.txt</a>: the guide for agents',
  'Every guide as Markdown: add <code>.md</code> to its address',
])}`;
  return page(base, '/guides', 'Guides for developers: spare an AI agent\'s tokens, step by step | Mare Liberum', 'Five guides for developers of AI agents: cut token costs with six measured levers, shrink an MCP tool list, read a page again for only the change, ask for only the fields you need, and put /compress into a LiteLLM proxy or the Vercel AI SDK.', body, ld);
}

// the answer of the node for /guides and /guides/<slug>, or null (not a guide)
export function guidesAnswer(base, path) {
  if (path === '/guides') return guidesIndexPage(base);
  const m = /^\/guides\/([a-z0-9-]{1,60})$/.exec(path);
  return m ? guidePage(base, m[1]) : null;
}
