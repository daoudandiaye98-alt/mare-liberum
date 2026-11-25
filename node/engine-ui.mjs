// Mare Liberum · the engine room as a page: /engine, /engine.json, /engine.md (the Markdown twin through node/agentmd.mjs)
// The five levers of node/engine.mjs, each with what it spares, the one line that calls it, whether it loses anything,
// and its live numbers from the ledger of /savings (node/areas.mjs countEngine). Beside them the bench that measured
// JSON and TOON with real tokenizers (tools/engine-bench.mjs, proof/engine-<day>.json), the one measuring rule and the
// privacy rule. Numbers are live or carry their date; zero stays zero.
import { readFileSync, readdirSync } from 'node:fs';
import { page, esc } from './pages.mjs';
import { LEVERS, ENGINE_VERSION, RATIO } from './engine.mjs';
import { TOKEN_PRICE, SAVE, usdOf } from './areas.mjs';
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
  optIn: 'The engine shapes an answer only when the agent asks: a parameter (fmt=toon, since=, budget=), a header (Accept: text/toon, If-None-Match), the lean door /mcp/lean, or POST /compress. Every other answer stays byte for byte what it was.',
  measuring: 'One measuring rule for every lever: what the agent would have read and what it read, each in UTF-8 bytes, each made tokens with the ratio the bench measured for its form (savingOf in node/engine.mjs). No saving, no count, no header claiming one.',
  apart: 'Lossless and lossy savings are counted and shown apart. Lossless savings join the measured figure of /savings as their own kind; lossy ones (a page fitted to a budget or a question) are in no figure of the headline.',
  counting: `Counted like every saving of the sea: never the sea's own calls, never crawlers, never a HEAD request; the house agent apart; once a day per network and subject (a page, a hash of the text, a tool); one network adds at most ${SAVE.cap.engine} answers of the engine a day. No receipt and no fair share is asked for them.`,
  privacy: 'What an agent posts to /compress is never stored, logged or counted beyond its size in bytes. The only versions kept, for since=, are pages read through /r/ (public pages the reader reads anyway): in memory, bounded in bytes and to 24 hours, never anything posted.',
  rest: 'With MARE_ENGINE=off, or "engine" in rest of the immune system\'s policy, nothing of the engine acts: fmt=toon, since= and budget= are ignored, /compress answers 503 with a note, and every answer is what it was before.',
};

// the five levers as the page tells them: a name, what it spares, the one line that calls it
const LEVER_TEXT = (b) => ({
  toon: { name: 'TOON instead of JSON', spares: 'Structured answers repeat every key in every row. TOON says the keys of a table once and then the rows: the same data, every value kept, fewer tokens.', call: `curl -s '${b}/search?q=weather+api&fmt=toon'`, also: 'or the header Accept: text/toon on any JSON door; the lean MCP door hands its tool results to the model as TOON' },
  lean: { name: 'The lean MCP door', spares: 'An MCP client may put every tool definition of a server into the model\'s context on every turn. The lean door lists four tools; find_tools finds any of the others and call_tool calls it, with the same answers.', call: `curl -s ${b}/mcp/lean -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`, also: 'add it to a client as an MCP server at /mcp/lean' },
  squeeze: { name: 'Squeeze what you hold', spares: 'Text, HTML or JSON an agent already holds and is about to pass on: made smaller, the lossless steps first (HTML to Markdown, JSON minified or as TOON, repeated lines said once). A question or a token budget only when the agent names one, then lossy, and said so.', call: `curl -s -X POST ${b}/compress -H 'content-type: application/json' -d '{"html":"<h1>…</h1>","q":"price"}'`, also: 'GET /compress says how; nothing posted is kept' },
  delta: { name: 'Read again, only the change', spares: 'A page read a second time costs the whole page again. With the ETag of the first answer the sea says "unchanged" in one line, or sends only the lines that changed, each under its nearest heading.', call: `curl -s '${b}/r/https://example.com/?since=<etag>'`, also: 'or If-None-Match: <etag> for a 304 without a body' },
  budget: { name: 'A page to your budget', spares: 'A page longer than the question needs: fitted to the token budget the agent names, the parts that answer its question first, every gap marked. It leaves things out, so it is lossy, and says so at the top.', call: `curl -s '${b}/r/https://example.com/?budget=800&q=pricing'`, also: 'with q, the blocks that answer the question come first' },
});
const LOSS = { true: 'lossless', false: 'lossy', null: 'lossless steps first; lossy only when you name a question or a budget' };

const n = (x) => (x == null || !Number.isFinite(Number(x)) ? '–' : Number(x).toLocaleString('en-US'));
const pct = (a, b) => (b > 0 ? `${Math.round((1 - a / b) * 1000) / 10} %` : '–');
const zero = { answers: 0, before: 0, after: 0, saved: 0 };
const lev = (period, lever, c) => period?.engine?.levers?.[lever]?.[c] || zero;

// what the page and /engine.json say: the levers with their live numbers, the bench, the rules, the state of the switch
export function engineData(base, { savings, on = true, bench = loadEngineBench() } = {}) {
  const T = LEVER_TEXT(base), s = savings || null;
  const levers = Object.entries(LEVERS).map(([id, L]) => {
    const live = Object.fromEntries(['today', 'last30days', 'all'].map((p) => [p, { lossless: lev(s?.[p], id, 'lossless'), lossy: lev(s?.[p], id, 'lossy') }]));
    return { id, name: T[id].name, lossless: L.lossless, losslessIs: LOSS[String(L.lossless)], spares: T[id].spares, door: L.door, call: T[id].call, also: T[id].also, live };
  });
  const tot = (p, c) => s?.[p]?.engine?.[c] || zero;
  const all = { lossless: tot('all', 'lossless'), lossy: tot('all', 'lossy') };
  return {
    what: 'the engine room of the sea: five levers that spare agents tokens, each measured by one rule and counted in the public ledger',
    engine: ENGINE_VERSION, on, state: on ? 'on: every lever acts when an agent asks for it' : 'resting or switched off on this node: nothing of the engine acts, and every answer is what it was before 3.35',
    live: { since: s?.since || null, lossless: all.lossless, lossy: all.lossy, today: { lossless: tot('today', 'lossless'), lossy: tot('today', 'lossy') }, last30days: { lossless: tot('last30days', 'lossless'), lossy: tot('last30days', 'lossy') },
      usd: { low: usdOf(all.lossless.saved, TOKEN_PRICE.low), mid: usdOf(all.lossless.saved, TOKEN_PRICE.mid), high: usdOf(all.lossless.saved, TOKEN_PRICE.high), of: 'the lossless tokens at the rate card of /savings (USD per million uncached input tokens), modelled' },
      note: 'tokens before, after and saved by the one rule of savingOf, counted once a day per network and subject; lossless ones are part of the measured figure of /savings, lossy ones are in no figure of the headline' },
    levers,
    bench: bench ? benchSummary(base, bench) : null,
    ratio: { ...RATIO },
    rules: ENGINE_RULES,
    headers: { 'x-sea-engine': 'the lever that shaped the answer', 'x-sea-engine-tokens': 'tokens before->after, by the one rule', 'x-sea-engine-saved': 'tokens saved', 'x-sea-engine-lossy': '1 when the saving lost something (only then)' },
    links: { savings: `${base}/savings`, proof: `${base}/proof`, fair: `${base}/fair`, llms: `${base}/llms.txt`, markdown: `${base}/engine.md`, ...(bench ? { bench: `${base}/engine/bench-${bench.date}.json` } : {}) },
  };
}
// the bench in a few numbers: per fixture JSON, minified JSON and TOON in tokens; the MCP list in full and lean
function benchSummary(base, d) {
  const tk = d.tokenizers?.map((t) => t.id) || [];
  return { date: d.date, file: `${base}/engine/bench-${d.date}.json`, tokenizers: d.tokenizers, toon: d.toon, node: d.node, fixtures: (d.fixtures || []).length,
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
.lever .fnums{margin:4px 0 0}
.lever .fnums b{font-size:clamp(22px,1.6vw + 10px,28px)}
.ratio{display:flex;height:12px;border-radius:6px;overflow:hidden;margin:6px 0 2px;background:var(--line,#1b3048)}
.ratio i{display:block;height:100%;background:var(--sea);transform-origin:left;animation:grow 1.1s var(--ease,ease) both}
@keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@media (prefers-reduced-motion:reduce){.ratio i{animation:none}}
</style>`;

// the page: the levers first, then the bench, the rule, what is never kept and the switch
export function enginePage(base, v) {
  const L = v.live, b = v.bench, tk = 'o200k_base';
  const ld = { '@context': 'https://schema.org', '@type': 'WebPage', name: 'The engine room of the sea: five levers that spare agents tokens', url: `${base}/engine`, isPartOf: { '@type': 'WebSite', name: 'Mare Liberum', url: `${base}/` } };
  const nums = (list) => `<ul class="fnums">${list.map(([x, label]) => `<li><b>${x}</b><span>${esc(label)}</span></li>`).join('')}</ul>`;
  const lever = (x) => {
    const a = x.live.all, t = x.live.today, m = x.live.last30days, lossy = x.lossless === false;
    return `<div class="box lever" id="${esc(x.id)}"><h3>${esc(x.name)}</h3><span class="loss${lossy ? ' y' : ''}">${esc(x.losslessIs)}</span><p>${esc(x.spares)}</p><pre><code>${esc(x.call)}</code></pre><p><small>${esc(x.also)} · door: <code>${esc(x.door)}</code></small></p>
${nums([[n(t.lossless.saved + t.lossy.saved), 'tokens spared today'], [n(m.lossless.saved + m.lossy.saved), 'in the last 30 days'], [n(a.lossless.answers + a.lossy.answers), a.lossless.answers + a.lossy.answers === 1 ? 'answer since counting' : 'answers since counting']])}
<p><small>Since counting: ${n(a.lossless.before + a.lossy.before)} tokens would have been read, ${n(a.lossless.after + a.lossy.after)} were${a.lossy.saved ? `; of the ${n(a.lossless.saved + a.lossy.saved)} saved, ${n(a.lossy.saved)} lossy (not in the headline)` : ''}.</small></p></div>`;
  };
  const benchRows = b ? b.rows.map((r) => { const t = r.tokens?.[tk] || {}; return `<tr><td><code>${esc(r.door)}</code></td><td>${n(t.json)}</td><td>${n(t.min)}</td><td>${n(t.toon)}</td><td>${pct(t.toon, t.min)}</td></tr>`; }).join('') : '';
  const T = b?.totals?.[tk], M = b?.mcp;
  const benchHtml = b ? `<p>${esc(b.says || '')}</p>
${T ? nums([[n(T.min), `tokens: ${b.fixtures} answers as the sea sends them (minified JSON)`], [n(T.toon), 'the same answers as TOON'], [pct(T.toon, T.min), 'fewer tokens with TOON, all answers together'], ...(M ? [[n(M.full?.tokens?.[tk]), `tokens: the open door's tools/list (${n(M.full?.tools)} tools)`], [n(M.lean?.tokens?.[tk]), `the lean list (${n(M.lean?.tools)} tools)`]] : [])]) : ''}
${T ? `<div class="ratio" aria-hidden="true"><i style="width:${Math.max(2, Math.min(100, Math.round((100 * T.toon) / T.min)))}%"></i></div><p><small>The bar: TOON as a share of the minified JSON the sea sends today (${esc(tk)}).</small></p>` : ''}
<div class="tw"><table class="tbl"><thead><tr><th>answer</th><th>JSON, indented</th><th>JSON, minified</th><th>TOON</th><th>TOON vs minified</th></tr></thead><tbody>${benchRows}</tbody></table></div>
<p><small>Tokens counted with ${esc((b.tokenizers || []).map((t) => `${t.id} (${t.package})`).join(', '))}; the table shows ${esc(tk)}, the run has all three. TOON from ${esc(b.toon?.implementation || 'unknown')}${b.toon?.spec ? `, spec ${esc(b.toon.spec)}` : ''}. Every TOON answer was decoded again and compared with the JSON: ${b.rows.every((r) => r.roundTrip) ? 'all equal' : 'not all equal (see the run)'}. Run of ${esc(b.date)} on ${esc(b.node || 'a local node')}: <a href="/engine/bench-${esc(b.date)}.json">the run as data</a>; reproduce it with <code>node tools/engine-bench.mjs</code>.</small></p>
${M ? `<p><small>The MCP list: the open door's <code>tools/list</code> as one JSON answer against a lean list (${esc(M.how || '')}).</small></p>` : ''}` : '<p class="muted">No run of the engine bench is on this node yet: the bench numbers appear here with the first run (node tools/engine-bench.mjs).</p>';
  const R = v.ratio;
  const body = `${STYLE}<h1>The engine room of the sea</h1>
<p class="hero-n"><b>${n(L.lossless.saved)}</b>tokens the engine room spared agents without losing anything · ${n(L.lossless.answers + L.lossy.answers)} ${L.lossless.answers + L.lossy.answers === 1 ? 'answer' : 'answers'} · lossy, apart: ${n(L.lossy.saved)}</p>
<p class="pulse">Five levers, one measuring rule. Nothing changes unless an agent asks.</p>
<p>Agents pay for every token they read. Besides pages, they burn tokens in five places: tool definitions loaded on every turn, structured answers that repeat every key in every row, text they already hold and pass on, pages they read again, and pages longer than the question needs. The sea already reads pages lean, answers short on request and hands over what others solved. The engine room adds one lever for each of the five places. Each acts only when an agent asks, measures what it spared by the same rule, and counts it in the public ledger of <a href="/savings">/savings</a>. ${v.on ? '' : `<b>On this node the engine rests right now</b>: ${esc(v.state)}.`}</p>
<h2>Spare tokens: five levers</h2>
<div class="levers">${v.levers.map(lever).join('')}</div>
<p><small>Live from the ledger${L.since ? `, counting since ${esc(L.since)}` : ''}: ${n(L.today.lossless.saved)} tokens spared without loss today, ${n(L.last30days.lossless.saved)} in the last 30 days. Lossless, they are worth about $${(v.live.usd.mid).toFixed(2)} at $${TOKEN_PRICE.mid.toFixed(2)} a million input tokens (${esc(v.live.usd.of)}). Every answer the engine shaped says so in its headers: <code>x-sea-engine</code>, <code>x-sea-engine-tokens</code> (before-&gt;after), <code>x-sea-engine-saved</code>, and <code>x-sea-engine-lossy</code> when it lost something.</small></p>
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
<h2>Switched off, nothing acts</h2>
<p>${esc(ENGINE_RULES.rest)} This node: <b>${esc(v.state)}</b>.</p>
<p><small>What the sea saves in all: <a href="/savings">/savings</a> · how it is measured: <a href="/proof">/proof</a> · the fair share of a saving: <a href="/fair">/fair</a> · the guide for agents: <a href="/llms.txt">/llms.txt</a> · as data: <a href="/engine.json">/engine.json</a> · for agents: <a href="/engine.md">/engine.md</a></small></p>`;
  return page(base, '/engine', 'The engine room — five levers that spare AI agents tokens, measured | Mare Liberum', 'TOON instead of JSON, a lean MCP door, squeezing what an agent holds, reading only what changed, a page to a token budget: five levers, each measured by one rule with real tokenizers and counted in public, lossless and lossy apart.', body, ld);
}
