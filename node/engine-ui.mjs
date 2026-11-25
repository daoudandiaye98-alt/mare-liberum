// Mare Liberum · the engine room as a page: /engine, /engine.json, /engine.md (the Markdown twin through node/agentmd.mjs)
// The six levers of node/engine.mjs, each with what it spares, where it saves, the one line that calls it, whether it loses anything,
// and its live numbers from the ledger of /savings (node/areas.mjs countEngine). Beside them the bench that measured
// JSON and TOON with real tokenizers (tools/engine-bench.mjs, proof/engine-<day>.json), the one measuring rule and the
// privacy rule. Numbers are live or carry their date; zero stays zero.
import { readFileSync, readdirSync } from 'node:fs';
import { page, esc } from './pages.mjs';
import { LEVERS, ENGINE_VERSION, RATIO } from './engine.mjs';
import { TOKEN_PRICE, ENGINE_CAP, usdOf } from './areas.mjs';
import { PROOF_DIR } from './proof.mjs';

// the newest run of the engine bench in proof/ (engine-YYYY-MM-DD.json), read once
let benchCache = null;
export function loadEngineBench({ dir = PROOF_DIR, fresh = false } = {}) {
  if (benchCache && !fresh) return benchCache.d;
  let d = null;
  try { const name = readdirSync(dir).filter((f) => /^engine-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().pop(); if (name) { d = JSON.parse(readFileSync(new URL(name, dir), 'utf8')); d.file = name; } } catch { d = null; }
  benchCache = { d };
  return d;
}
// one run as the file it is (/engine/bench-<day>.json), or null
export const engineBenchFile = (day) => (/^\d{4}-\d{2}-\d{2}$/.test(String(day)) ? (() => { try { return readFileSync(new URL(`engine-${day}.json`, PROOF_DIR), 'utf8'); } catch { return null; } })() : null);

// the rules, said once for the page, its data and llms.txt
export const ENGINE_RULES = {
  optIn: 'The engine shapes an answer only when the agent asks: a parameter (fmt=toon, fields=, since=, budget=), a header (Accept: text/toon, If-None-Match), the lean door /mcp/lean, or POST /compress. Every other answer stays byte for byte what it was.',
  measuring: 'One measuring rule for every lever: what the agent would have read and what it read, each in UTF-8 bytes, each made tokens with the ratio the bench measured for its form (savingOf in node/engine.mjs). No saving, no count, no header claiming one.',
  apart: 'Lossless and lossy savings are counted and shown apart. Lossless savings join the measured figure of /savings as their own kind; lossy ones (a page fitted to a budget or a question, an answer cut to named fields) are in no figure of the headline.',
  counting: `Counted like every saving of the sea: never the sea's own calls, never crawlers, never a HEAD request; the house agent apart; once a day per network and subject (a page, a hash of the text, a tool); one network adds at most ${ENGINE_CAP} answers of the engine a day. No receipt and no fair share is asked for them.`,
  privacy: 'What an agent posts to /compress is never stored, logged or counted beyond its size in bytes. The only versions kept, for since=, are pages read through /r/ (public pages the reader reads anyway): in memory, bounded in bytes and to 24 hours, never anything posted.',
  rest: 'With MARE_ENGINE=off, or "engine" in rest of the immune system\'s policy, nothing of the engine acts: fmt=toon, fields=, since= and budget= are ignored, /compress answers 503 with a note, and every answer is what it was before.',
};

// the six levers as the page tells them: a name, what it spares, where it saves (research of 25.11.2026), the one line that calls it
const LEVER_TEXT = (b) => ({
  toon: { name: 'TOON instead of JSON', spares: 'Structured answers repeat every key in every row. TOON says the keys of a table once and then the rows: the same data, every value kept.', where: 'Only on tabular data. The engine sends TOON only when it is at least 20 % smaller than compact JSON, else the JSON and a header that says so.', call: `curl -s '${b}/routes.json?fmt=toon'`, also: 'or the header Accept: text/toon on any JSON door' },
  lean: { name: 'The lean MCP door', spares: 'An MCP client may put every tool definition of a server into the model\'s context on every turn. The lean door lists four tools; find_tools finds any of the others and call_tool calls it, with the same answers. Its results go out as text only, so a client that reads text and structured content (ChatGPT) does not read an answer twice.', where: 'Only in clients that load every tool definition (Gemini CLI, Cline, Roo, Zed, agents of your own). Claude Code, Copilot CLI and OpenAI\'s Agents API already defer tools; there it spares almost nothing.', call: `curl -s ${b}/mcp/lean -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`, also: 'add it to a client as an MCP server at /mcp/lean' },
  squeeze: { name: 'Squeeze what you hold', spares: 'Text, HTML or JSON on its way to a model: made smaller, the lossless steps first (HTML to Markdown, JSON minified or as TOON, repeated lines said once). A question or a token budget only when one is named, then lossy, and said so.', where: 'For programs: a hook, a proxy, a pipeline. Not for a model to call with text it already holds: it would pay for that text again as output tokens.', call: `curl -s -X POST ${b}/compress -H 'content-type: application/json' -d '{"html":"<h1>…</h1>","q":"price"}'`, also: 'GET /compress says how; nothing posted is kept' },
  delta: { name: 'Read again, only the change', spares: 'A page read a second time costs the whole page again. With the ETag of the first answer the sea says "unchanged" in one line, or sends only the lines that changed, each under its nearest heading.', where: 'On the reader /r/: a page an agent reads again.', call: `curl -s '${b}/r/https://example.com/?since=<etag>'`, also: 'or If-None-Match: <etag> for a 304 without a body' },
  budget: { name: 'A page to your budget', spares: 'A page longer than the question needs: fitted to the token budget the agent names, the parts that answer its question first, every gap marked. It leaves things out, so it is lossy, and says so at the top.', where: 'On the reader /r/: a page longer than the question needs.', call: `curl -s '${b}/r/https://example.com/?budget=800&q=pricing'`, also: 'with q, the blocks that answer the question come first' },
  fields: { name: 'Only the fields you need', spares: 'A JSON answer carries every field of every row. Name the ones you need, with dots for nested ones, and the rest stays out: deterministic, no model in between.', where: 'On every JSON door. What it leaves out is gone, so it counts as lossy and never in the headline.', call: `curl -s '${b}/savings.json?fields=hero.tokens,hero.measured'`, also: 'fields=<a,b.c>: a list of fields, dots for nested ones' },
});
const LOSS = { true: 'lossless', false: 'lossy', null: 'lossless, or lossy when asked' };

// where the levers and what is said about them come from (primary sources, read 25.11.2026)
export const SOURCES = [
  { what: 'TOON, the format of the toon lever: the specification, version 4.4 (8 October 2026), media type text/toon', url: 'https://github.com/toon-format/spec/blob/main/SPEC.md' },
  { what: 'MCP 2026-07-28, tools: structuredContent and the TextContent block beside it, a deterministic tools/list', url: 'https://modelcontextprotocol.io/specification/2026-07-28/server/tools' },
  { what: 'Claude Code: MCP tool definitions are deferred by default (tool search)', url: 'https://code.claude.com/docs/en/agent-sdk/tool-search' },
  { what: 'OpenAI: tool search and defer_loading; in the Agents API MCP tools are deferred', url: 'https://developers.openai.com/api/docs/guides/tools-tool-search' },
  { what: 'Atlassian mcp-compressor (29 March 2026): the same pattern of a few meta-tools in front of many, before the lean door', url: 'https://www.atlassian.com/blog/developer/mcp-compression-preventing-tool-bloat-in-ai-agents' },
];
export const CACHING = 'list prices for uncached input tokens; a client that had the same text in its prompt cache pays 0.025 to 0.1 times that (Claude, OpenAI and Google pricing), so a saving on a cached prefix such as a tool list is worth far less than this';
const n = (x) => (x == null || !Number.isFinite(Number(x)) ? '–' : Number(x).toLocaleString('en-US'));
const pct = (a, b) => (b > 0 ? `${Math.round((1 - a / b) * 1000) / 10} %` : '–');
// a change in words: "25.9 % fewer" or "8.3 % more"
const fewer = (a, b) => { if (!(b > 0) || a == null) return '–'; const x = Math.round((1 - a / b) * 1000) / 10; return x >= 0 ? `${x} % fewer` : `${-x} % more`; };
const zero = { answers: 0, before: 0, after: 0, saved: 0 };
const lev = (period, lever, c) => period?.engine?.levers?.[lever]?.[c] || zero;

// what the page and /engine.json say: the levers with their live numbers, the bench, the rules, the state of the switch
export function engineData(base, { savings, on = true, bench = loadEngineBench() } = {}) {
  const T = LEVER_TEXT(base), s = savings || null;
  const levers = Object.entries(LEVERS).map(([id, L]) => {
    const live = Object.fromEntries(['today', 'last30days', 'all'].map((p) => [p, { lossless: lev(s?.[p], id, 'lossless'), lossy: lev(s?.[p], id, 'lossy') }]));
    const tb = id === 'toon' && bench?.summary?.totals?.o200k_base?.ruleIn ? ` On the bench of ${bench.date}: ${bench.summary.totals.o200k_base.ruleIn.length} of ${bench.fixtures.length} answers of the sea.` : '';
    return { id, name: T[id].name, lossless: L.lossless, losslessIs: LOSS[String(L.lossless)], spares: T[id].spares, where: `${T[id].where}${tb}`, door: L.door, call: T[id].call, also: T[id].also, live };
  });
  const tot = (p, c) => s?.[p]?.engine?.[c] || zero;
  const all = { lossless: tot('all', 'lossless'), lossy: tot('all', 'lossy') };
  return {
    what: 'the engine room of the sea: open, no account, six measured levers that spare agents tokens, each measured by one rule and counted in one public ledger',
    engine: ENGINE_VERSION, on, state: on ? 'on: every lever acts when an agent asks for it' : 'resting or switched off on this node: nothing of the engine acts, and every answer is what it was before 3.35',
    live: { since: s?.since || null, lossless: all.lossless, lossy: all.lossy, today: { lossless: tot('today', 'lossless'), lossy: tot('today', 'lossy') }, last30days: { lossless: tot('last30days', 'lossless'), lossy: tot('last30days', 'lossy') },
      usd: { low: usdOf(all.lossless.saved, TOKEN_PRICE.low), mid: usdOf(all.lossless.saved, TOKEN_PRICE.mid), high: usdOf(all.lossless.saved, TOKEN_PRICE.high), of: 'the lossless tokens at the rate card of /savings (USD per million uncached input tokens), modelled', caching: CACHING },
      note: 'tokens before, after and saved by the one rule of savingOf, counted once a day per network and subject; lossless ones are part of the measured figure of /savings, lossy ones are in no figure of the headline' },
    levers,
    bench: bench ? benchSummary(base, bench) : null,
    ratio: { ...RATIO },
    rules: ENGINE_RULES, sources: SOURCES,
    headers: { 'x-sea-engine': 'the lever that shaped the answer', 'x-sea-engine-tokens': 'tokens before->after, by the one rule', 'x-sea-engine-saved': 'tokens saved', 'x-sea-engine-lossy': '1 when the saving lost something (only then)' },
    links: { savings: `${base}/savings`, proof: `${base}/proof`, fair: `${base}/fair`, llms: `${base}/llms.txt`, markdown: `${base}/engine.md`, ...(bench ? { bench: `${base}/engine/bench-${bench.date}.json` } : {}) },
  };
}
// the bench in a few numbers: per fixture JSON, minified JSON and TOON in tokens; the MCP list in full and lean
function benchSummary(base, d) {
  const tk = d.tokenizers?.map((t) => t.id) || [];
  return { date: d.date, file: `${base}/engine/bench-${d.date}.json`, tokenizers: d.tokenizers, toon: d.toon, toonRule: d.toonRule, node: d.node, fixtures: (d.fixtures || []).length,
    totals: d.summary?.totals, ratios: d.summary?.ratios, mcp: d.mcp ? { full: d.mcp.full, lean: d.mcp.lean, how: d.mcp.how } : null,
    rows: (d.fixtures || []).map((f) => ({ id: f.id, door: f.door, bytes: f.bytes, tokens: Object.fromEntries(tk.map((t) => [t, f.tokens?.[t]])), roundTrip: f.roundTrip })), says: d.says };
}

const STYLE = `<style>
.fnums{display:grid;grid-template-columns:repeat(auto-fit,minmax(9.5rem,1fr));gap:var(--s3,16px) var(--s4,24px);margin:var(--s3,16px) 0 var(--s4,24px);padding:0;list-style:none}
.fnums li{margin:0;display:grid;gap:2px}
.fnums b{font:italic 650 clamp(24px,2vw + 12px,34px)/1.05 var(--text);font-variant-numeric:tabular-nums;letter-spacing:-.01em;white-space:nowrap}
.fnums span{color:var(--mist);font-size:14.5px;line-height:1.35}
.said p.hero-n b{display:block;font:italic 650 clamp(52px,7vw,104px)/.95 var(--text);color:var(--foam);letter-spacing:-.02em;margin-bottom:6px;font-variant-numeric:lining-nums}
.said p.hero-n{color:var(--mist)}
.levers{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,21rem),1fr));gap:var(--s4,24px);margin:var(--s4,24px) 0}
.lever{display:flex;flex-direction:column;gap:10px;min-width:0}
.lever h3{margin:0}
.lever .loss{display:inline-block;align-self:flex-start;font-size:13px;letter-spacing:.04em;text-transform:uppercase;padding:3px 10px;border-radius:999px;border:1px solid var(--line-2,#2a4157);color:var(--foam,#eef6fb)}
.lever .loss.y{border-color:var(--violet,#9d8cff)}
.lever pre{margin:0;white-space:pre-wrap;word-break:break-all;font-size:13.5px}
.lever .where{margin:0;font-size:15px;color:var(--mist)}
.lever .where b{color:var(--foam,#eef6fb);font-weight:600}
.lnums{margin:2px 0 0;color:var(--mist);font-size:14.5px;line-height:1.5}
.lnums b{font:italic 650 clamp(20px,1.4vw + 10px,26px)/1.2 var(--text);color:var(--foam,#eef6fb);font-variant-numeric:tabular-nums}
.ratio{display:flex;height:12px;border-radius:6px;overflow:hidden;margin:6px 0 2px;background:var(--line,#1b3048)}
.ratio i{display:block;height:100%;background:var(--sea);transform-origin:left;animation:grow 1.1s var(--ease,ease) both}
@keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@media (prefers-reduced-motion:reduce){.ratio i{animation:none}}
</style>`;

// the page: the levers first, then the bench, the rule, what is never kept and the switch
export function enginePage(base, v) {
  const L = v.live, b = v.bench, tk = 'o200k_base';
  const ld = { '@context': 'https://schema.org', '@type': 'WebPage', name: 'The engine room of the sea: six levers that spare agents tokens', url: `${base}/engine`, isPartOf: { '@type': 'WebSite', name: 'Mare Liberum', url: `${base}/` } };
  const nums = (list) => `<ul class="fnums">${list.map(([x, label]) => `<li><b>${x}</b><span>${esc(label)}</span></li>`).join('')}</ul>`;
  const lever = (x) => {
    const a = x.live.all, t = x.live.today, m = x.live.last30days, lossy = x.lossless === false;
    return `<div class="box lever" id="${esc(x.id)}"><h3>${esc(x.name)}</h3><span class="loss${lossy ? ' y' : ''}">${esc(x.losslessIs)}</span><p>${esc(x.spares)}</p><p class="where"><b>Where it saves:</b> ${esc(x.where)}</p><pre><code>${esc(x.call)}</code></pre><p><small>${esc(x.also)}</small></p>
<p class="lnums"><b>${n(t.lossless.saved + t.lossy.saved)}</b> tokens spared today · <b>${n(m.lossless.saved + m.lossy.saved)}</b> in 30 days · <b>${n(a.lossless.answers + a.lossy.answers)}</b> ${a.lossless.answers + a.lossy.answers === 1 ? 'answer' : 'answers'} since counting</p>
<p><small>Since counting: ${n(a.lossless.before + a.lossy.before)} tokens would have been read, ${n(a.lossless.after + a.lossy.after)} were${a.lossy.saved ? `; of the ${n(a.lossless.saved + a.lossy.saved)} saved, ${n(a.lossy.saved)} lossy (not in the headline)` : ''}.</small></p></div>`;
  };
  const benchRows = b ? b.rows.map((r) => { const t = r.tokens?.[tk] || {}; return `<tr><td><code>${esc(r.door)}</code></td><td>${n(t.json)}</td><td>${n(t.sent)}</td><td>${n(t.toon)}</td><td>${t.toon < t.sent ? '<b>' : ''}${fewer(t.toon, t.sent)}${t.toon < t.sent ? '</b>' : ''}</td></tr>`; }).join('') : '';
  const T = b?.totals?.[tk], M = b?.mcp;
  const bar = (a, z, what) => (a > 0 && z > 0 ? `<div class="ratio" role="img" aria-label="${esc(what)}: ${Math.round((100 * a) / z)} %"><i style="width:${Math.max(1, Math.min(100, Math.round((100 * a) / z)))}%"></i></div><p><small>${esc(what)} (${esc(tk)}): ${Math.round((100 * a) / z)} %.</small></p>` : '');
  const benchHtml = b ? `<p>${esc(b.says || '')}</p>
${M ? `<h3>The tool list of an MCP door</h3>${nums([[n(M.full?.tokens?.[tk]), `tokens: the open door's tools/list, ${n(M.full?.tools)} tools`], [n(M.lean?.tokens?.[tk]), `tokens: a lean list of ${n(M.lean?.tools)} tools (${fewer(M.lean?.tokens?.[tk], M.full?.tokens?.[tk])})`]])}${bar(M.lean?.tokens?.[tk], M.full?.tokens?.[tk], 'the lean list as a share of the open one')}<p><small>Measured ${esc(b.date)} with ${esc(tk)}. A client that loads every tool definition reads the difference on every model call; a client that defers tools (Claude Code, Copilot CLI, OpenAI's Agents API) reads little of either, and a cached tool list costs a tenth or less.</small></p>` : ''}
${T ? `<h3>JSON answers as TOON</h3>${nums([[n(T.sent), `tokens: ${b.fixtures} real answers, as the doors send them (JSON)`], [n(T.toon), `all of them as TOON: ${fewer(T.toon, T.sent)}`], [n(T.rule), `with the rule of the lever, TOON only where it is at least ${Math.round(100 * (b.toonRule?.minSaving ?? 0.2))} % smaller than compact JSON (${n(T.ruleIn?.length)} of ${b.fixtures}): ${fewer(T.rule, T.sent)}`]])}${bar(T.rule, T.sent, 'with the rule of the lever, as a share of the JSON sent')}` : ''}
<details><summary>Every answer of the run, one by one (${n(b.rows.length)})</summary><div class="tw"><table class="tbl"><thead><tr><th>answer</th><th>JSON, indented</th><th>JSON as sent</th><th>TOON</th><th>TOON against what is sent</th></tr></thead><tbody>${benchRows}</tbody></table></div></details>
<p><small>Tokens counted with ${esc((b.tokenizers || []).map((t) => `${t.id} (${t.package})`).join(', '))}; the table shows ${esc(tk)}, the run has all three. TOON from ${esc(b.toon?.implementation || 'unknown')}${b.toon?.spec ? `, spec ${esc(b.toon.spec)}` : ''}${b.toon?.reference ? `; its output equals the reference implementation's (${esc(b.toon.reference.implementation)}) for ${n(b.toon.reference.sameOutput)} of ${n(b.toon.reference.of)} answers` : ''}. Every TOON answer was decoded again and compared with the JSON: ${b.rows.every((r) => r.roundTrip) ? 'all equal' : 'not all equal (see the run)'}. Run of ${esc(b.date)} on ${esc(b.node || 'a local node')}: <a href="/engine/bench-${esc(b.date)}.json">the run as data</a>; reproduce it with <code>node tools/engine-bench.mjs</code>.</small></p>
${M ? `<p><small>The MCP list: the open door's <code>tools/list</code> as one JSON answer against a lean list (${esc(M.how || '')}).</small></p>` : ''}` : '<p class="muted">No run of the engine bench is on this node yet: the bench numbers appear here with the first run (node tools/engine-bench.mjs).</p>';
  const R = v.ratio;
  const body = `${STYLE}<h1>The engine room of the sea</h1>
<p class="hero-n"><b>${n(L.lossless.saved)}</b>tokens the engine room spared agents without losing anything · ${n(L.lossless.answers + L.lossy.answers)} ${L.lossless.answers + L.lossy.answers === 1 ? 'answer' : 'answers'} · lossy, apart: ${n(L.lossy.saved)}</p>
<p class="pulse">Open, no account: six measured levers, one public ledger. Nothing changes unless an agent asks.</p>
<p>Agents pay for every token they read. Besides pages, they burn tokens in five places: tool definitions loaded on every turn, structured answers that repeat every key in every row, text they already hold and pass on, pages they read again, and pages longer than the question needs. The sea already reads pages lean, answers short on request and hands over what others solved. The engine room adds six levers for the five places, two of them for structured answers. Each acts only when an agent asks, measures what it spared by the same rule, and counts it in the public ledger of <a href="/savings">/savings</a>. Each says where it saves and where it does not. ${v.on ? '' : `<b>On this node the engine rests right now</b>: ${esc(v.state)}.`}</p>
<h2>Spare tokens: six levers</h2>
<div class="levers">${v.levers.map(lever).join('')}</div>
<p><small>Live from the ledger${L.since ? `, counting since ${esc(L.since)}` : ''}: ${n(L.today.lossless.saved)} tokens spared without loss today, ${n(L.last30days.lossless.saved)} in the last 30 days. Lossless, they are worth about $${(v.live.usd.mid).toFixed(2)} at $${TOKEN_PRICE.mid.toFixed(2)} a million input tokens: ${esc(CACHING)}. Every answer the engine shaped says so in its headers: <code>x-sea-engine</code>, <code>x-sea-engine-tokens</code> (before-&gt;after), <code>x-sea-engine-saved</code>, and <code>x-sea-engine-lossy</code> when it lost something.</small></p>
<h2>The bench</h2>
${benchHtml}
<h2>One measuring rule</h2>
<p>${esc(ENGINE_RULES.measuring)} ${esc(ENGINE_RULES.apart)}</p>
<p>${R.assumption ? `The ratios: ${esc(R.basis || 'an assumption until the bench has run')}.` : `The ratios, measured with ${esc(R.tokenizer || 'o200k_base')} on ${esc(R.date || '')}: one token holds ${esc(String(R.json))} UTF-8 bytes of JSON and ${esc(String(R.toon))} of TOON; HTML ${esc(String(R.html))}, the sea's Markdown ${esc(String(R.md))}, plain text ${esc(String(R.text))} (from the <a href="/proof">proof of function</a>).`}</p>
<p><small>${esc(ENGINE_RULES.counting)}</small></p>
<h2>Only when asked</h2>
<p>${esc(ENGINE_RULES.optIn)}</p>
<h2>What is never kept</h2>
<p>${esc(ENGINE_RULES.privacy)}</p>
<h2>Where this comes from</h2>
<ul>${SOURCES.map((x) => `<li>${esc(x.what)}: <a href="${esc(x.url)}" rel="noopener">${esc(x.url.replace(/^https:\/\//, '').split('/')[0])}</a></li>`).join('')}</ul>
<h2>Switched off, nothing acts</h2>
<p>${esc(ENGINE_RULES.rest)} This node: <b>${esc(v.state)}</b>.</p>
<p><small>What the sea saves in all: <a href="/savings">/savings</a> · how it is measured: <a href="/proof">/proof</a> · the fair share of a saving: <a href="/fair">/fair</a> · the guide for agents: <a href="/llms.txt">/llms.txt</a> · as data: <a href="/engine.json">/engine.json</a> · for agents: <a href="/engine.md">/engine.md</a></small></p>`;
  return page(base, '/engine', 'The engine room — six levers that spare AI agents tokens, measured | Mare Liberum', 'Open, no account: TOON for tables, only the fields asked for, a lean MCP door, squeezing for programs, reading only what changed, a page to a token budget. Six levers, each measured by one rule with real tokenizers and counted in one public ledger, lossless and lossy apart, each with where it saves.', body, ld);
}
