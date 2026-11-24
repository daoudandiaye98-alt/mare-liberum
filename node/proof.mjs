// Mare Liberum · the proof of function: what an agent reads with the open sea and without it, measured
// Not advertising: a fixed, published set of real tasks, every page read once by tools/proof-bench.mjs (run from a
// session, never on the server) and counted with real tokenizers. The bench keeps counts, addresses, times and its
// method, never the pages themselves: proof/tasks.json (the task set) and proof/bench-<day>.json (one run). This module
// reads the newest run and shows it at /proof (also .json and .md); every number on the page comes from that file.
//   measured   the tokens of each destination page as raw HTML, as plain text (a readability-style extraction, the
//              way a typical fetch tool hands a page to a model) and as the Markdown of the sea's reader; the tokens of
//              the brain's answer for each task, as GET /brain?q=<task> serves it
//   modelled   the search loop an agent runs without the sea (searches and pages read to judge them): the number of
//              steps comes from published figures, the size of each step from this run; no search engine is asked
//   calibrated characters per token for HTML, text and Markdown (TOKEN_RATIO), so the savings ledger can turn the
//              bytes it counts into tokens with a measured ratio instead of a guessed one
// Nothing here runs on its own: the page reads a file, and the tide may re-read one page now and then (remeasure).
import { readFileSync, readdirSync } from 'node:fs';
import { page, esc } from './pages.mjs';

export const PROOF_DIR = new URL('../proof/', import.meta.url);
// the forms a page is counted in, in the order the page shows them
export const FORMATS = ['html', 'text', 'readability', 'prior', 'markdown', 'served', 'servedFull', 'mcp'];
export const FORMAT_NAME = { html: 'raw HTML', text: 'plain text (readability-style)', readability: 'Mozilla Readability text (cross-check)', prior: 'Mare reader Markdown of the release before (same copy)', markdown: 'Mare reader Markdown', served: 'Mare /r/ answer', servedFull: 'Mare /r/ answer, format=full', mcp: 'Mare MCP read_page answer' };
export const TOKENIZER_IDS = ['o200k_base', 'cl100k_base', 'claude-legacy'];

// ------------------------------------------------------------------ statistics, the same for the bench, the page and the proofs
// the p-quantile of sorted numbers, interpolated between the two nearest ranks (the common "type 7" definition)
export function quantile(sorted, p) {
  if (!sorted.length) return null;
  const h = (sorted.length - 1) * p, lo = Math.floor(h), hi = Math.ceil(h);
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}
const int = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x));
export const round = (x, d = 2) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 10 ** d) / 10 ** d);
// n, the middle half (p25 to p75), the median and the total of a list of counts
export function stats(values) {
  const v = values.filter((x) => typeof x === 'number' && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return { n: 0 };
  return { n: v.length, min: v[0], p25: int(quantile(v, 0.25)), median: int(quantile(v, 0.5)), p75: int(quantile(v, 0.75)), max: v[v.length - 1], total: v.reduce((s, x) => s + x, 0) };
}
const median = (values) => { const v = values.filter((x) => typeof x === 'number' && Number.isFinite(x)).sort((a, b) => a - b); return v.length ? quantile(v, 0.5) : null; };

// ------------------------------------------------------------------ the summary of one run, computed from its rows
// (the bench writes it into the file; the proofs compute it again from the rows and compare, so the page shows nothing
// the rows do not hold)
export const measuredRows = (d) => (d?.tasks || []).filter((t) => t.page?.tokens);
export function summarize(d) {
  const tasks = d?.tasks || [], rows = measuredRows(d), toks = (d?.tokenizers || []).map((t) => t.id), m = d?.method || {};
  const tokOf = (t, tok, f) => t.page?.tokens?.[tok]?.[f];
  const brains = tasks.filter((t) => t.brain?.status === 200 && t.brain?.tokens), compacts = tasks.filter((t) => t.brainCompact?.status === 200 && t.brainCompact?.tokens);
  const groups = {};
  for (const t of tasks) { const g = groups[t.group] || (groups[t.group] = { tasks: 0, measured: 0 }); g.tasks++; if (t.page?.tokens) g.measured++; }
  // like for like: the pages where both the plain text and the Markdown still hold the page (see keeps)
  const fairRows = rows.filter((t) => t.page.keeps?.text === true && t.page.keeps?.markdown === true);
  const reading = {}, readingByGroup = {}, fair = {}, times = {}, finding = {}, whole = {}, ratios = {};
  for (const tok of toks) {
    reading[tok] = Object.fromEntries(FORMATS.map((f) => [f, stats(rows.map((t) => tokOf(t, tok, f)))]).filter(([, s]) => s.n));
    for (const g of Object.keys(groups)) (readingByGroup[g] ||= {})[tok] = Object.fromEntries(['html', 'text', 'markdown'].map((f) => [f, stats(rows.filter((t) => t.group === g).map((t) => tokOf(t, tok, f)))]).filter(([, s]) => s.n));
    fair[tok] = { n: fairRows.length, ...Object.fromEntries(['html', 'text', 'markdown', 'served'].map((f) => [f, stats(fairRows.map((t) => tokOf(t, tok, f)))])) };
    // how many times larger one form is than another, page by page (the median of those ratios)
    const per = (a, b) => round(median(rows.map((t) => { const x = tokOf(t, tok, a), y = tokOf(t, tok, b); return x > 0 && y > 0 ? x / y : null; })), 1);
    times[tok] = { htmlPerMarkdown: per('html', 'markdown'), htmlPerText: per('html', 'text'), markdownPerText: per('markdown', 'text'), servedPerText: per('served', 'text'), readabilityPerText: per('readability', 'text') };
    // a run with the reader of the release before beside this one (same copy of each page): how many times larger it was
    if (rows.some((t) => tokOf(t, tok, 'prior') != null)) Object.assign(times[tok], { priorPerMarkdown: per('prior', 'markdown'), priorPerText: per('prior', 'text') });
    // the search loop without the sea, modelled: each search hands the model a list of results, each page read to judge
    // it hands the model its text. Sizes from this run: one result (title, address, snippet) and one page as plain text
    const resultTokens = int(median(rows.map((t) => tokOf(t, tok, 'result')))), pageTokens = int(median(rows.map((t) => tokOf(t, tok, 'text'))));
    const loop = m.loop || {}, per1 = (resultTokens || 0) * (loop.resultsPerSearch || 0);
    const cost = (s) => (s ? s.searches * per1 + s.pages * (pageTokens || 0) : null);
    // the brain's answer for every task, and for the tasks where it led to the destination's site (a confirmed pathway)
    const led = brains.filter((t) => t.brain.destinationHost === true);
    finding[tok] = { brain: stats(brains.map((t) => t.brain.tokens[tok])), led: stats(led.map((t) => t.brain.tokens[tok])), resultTokens, pageTokens, searchTokens: per1, low: cost(loop.low), high: cost(loop.high) };
    // the brain's short answer (fmt=compact), where the run asked for it
    if (compacts.length) Object.assign(finding[tok], { compact: stats(compacts.map((t) => t.brainCompact.tokens[tok])), ledCompact: stats(compacts.filter((t) => t.brainCompact.destinationHost === true).map((t) => t.brainCompact.tokens[tok])) });
    // a whole task, where the brain led to the destination: finding the page and reading it. With the sea: the brain's
    // answer and the reader's Markdown (both measured). Without: the modelled loop and the page as plain text (or, for an
    // agent that reads raw HTML, as HTML)
    const both = rows.filter((t) => t.brain?.status === 200 && t.brain.destinationHost === true && t.brain.tokens?.[tok] != null);
    whole[tok] = { n: both.length, sea: stats(both.map((t) => t.brain.tokens[tok] + tokOf(t, tok, 'markdown'))),
      low: stats(both.map((t) => finding[tok].low + tokOf(t, tok, 'text'))), high: stats(both.map((t) => finding[tok].high + tokOf(t, tok, 'text'))),
      lowHtml: stats(both.map((t) => finding[tok].low + tokOf(t, tok, 'html'))), highHtml: stats(both.map((t) => finding[tok].high + tokOf(t, tok, 'html'))) };
    // with the short answer: where it led to the page's site, its answer and the reader's Markdown
    if (compacts.length) { const bc = rows.filter((t) => t.brainCompact?.status === 200 && t.brainCompact.destinationHost === true && t.brainCompact.tokens?.[tok] != null); Object.assign(whole[tok], { compactN: bc.length, seaCompact: stats(bc.map((t) => t.brainCompact.tokens[tok] + tokOf(t, tok, 'markdown'))), lowCompact: stats(bc.map((t) => finding[tok].low + tokOf(t, tok, 'text'))), highCompact: stats(bc.map((t) => finding[tok].high + tokOf(t, tok, 'text'))) }); }
    // characters (JavaScript string length, the unit the savings ledger counts) and UTF-8 bytes per token, over all pages
    const ratio = (f, unit) => { let a = 0, b = 0; for (const t of rows) { const x = t.page?.[unit]?.[f], y = tokOf(t, tok, f); if (x > 0 && y > 0) { a += x; b += y; } } return b ? round(a / b, 2) : null; };
    ratios[tok] = { html: ratio('html', 'chars'), text: ratio('text', 'chars'), markdown: ratio('markdown', 'chars'), served: ratio('served', 'chars'),
      bytes: { html: ratio('html', 'bytes'), text: ratio('text', 'bytes'), markdown: ratio('markdown', 'bytes'), served: ratio('served', 'bytes') } };
  }
  // whether a form still holds the page (a rough check, see the method): a form can be small because it lost the page
  const keepsOf = (list) => Object.fromEntries(['text', 'readability', 'prior', 'markdown'].map((f) => { const c = list.filter((t) => typeof t.page?.keeps?.[f] === 'boolean'); return [f, { kept: c.filter((t) => t.page.keeps[f]).length, of: c.length }]; }).filter(([, v]) => v.of));
  const keeps = { all: keepsOf(rows), ...Object.fromEntries(Object.keys(groups).map((g) => [g, keepsOf(rows.filter((t) => t.group === g))])) };
  // who confirmed the pathways of the shopping tasks, as the brain's answers name them (on their checks and notes)
  const confirmedBy = {}; for (const t of brains) for (const who of t.brain.confirmedBy || []) confirmedBy[who] = (confirmedBy[who] || 0) + 1;
  return { tasks: tasks.length, measured: rows.length, keeps, confirmedBy, skipped: tasks.filter((t) => !t.page?.tokens).map((t) => ({ id: t.id, why: t.skipped || 'not measured' })),
    brains: brains.length, led: brains.filter((t) => t.brain.destinationHost === true).length,
    ...(compacts.length ? { compacts: compacts.length, ledCompact: compacts.filter((t) => t.brainCompact.destinationHost === true).length, firstPathCompact: compacts.filter((t) => t.brainCompact.pathRank === 1).length } : {}), ledByGroup: Object.fromEntries(Object.keys(groups).map((g) => [g, brains.filter((t) => t.group === g && t.brain.destinationHost === true).length])),
    firstPath: brains.filter((t) => t.brain.pathRank === 1).length, groups, capped: rows.filter((t) => t.page?.capped).length, reading, readingByGroup, fair, times, finding, whole, ratios };
}

// ------------------------------------------------------------------ the newest run on this node (read once; a missing file is no error)
let cache = null;
export function loadBench({ dir = PROOF_DIR, fresh = false } = {}) {
  if (cache && !fresh) return cache.d;
  let d = null;
  try {
    const name = readdirSync(dir).filter((f) => /^bench-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().pop();
    if (name) { d = JSON.parse(readFileSync(new URL(name, dir), 'utf8')); d.file = name; }
  } catch { d = null; }
  cache = { d };
  return d;
}
export function loadTasks({ dir = PROOF_DIR } = {}) { try { return JSON.parse(readFileSync(new URL('tasks.json', dir), 'utf8')); } catch { return null; } }
// a run of a branch before its deploy (tools/proof-bench.mjs --tag lean): proof/bench-<day>-lean.json, the newest one
let leanCache = null;
export function loadLean({ dir = PROOF_DIR, fresh = false } = {}) {
  if (leanCache && !fresh) return leanCache.d;
  let d = null;
  try {
    const name = readdirSync(dir).filter((f) => /^bench-\d{4}-\d{2}-\d{2}-lean\.json$/.test(f)).sort().pop();
    if (name) { d = JSON.parse(readFileSync(new URL(name, dir), 'utf8')); d.file = name; }
  } catch { d = null; }
  leanCache = { d };
  return d;
}
export const benchFile = (name) => /^bench-\d{4}-\d{2}-\d{2}(-lean)?\.json$|^tasks\.json$/.test(String(name)) ? (() => { try { return readFileSync(new URL(name, PROOF_DIR), 'utf8'); } catch { return null; } })() : null;

// ------------------------------------------------------------------ the calibration: characters per token, measured
// Written from the newest run by tools/proof-bench.mjs --ratio (tools/bench-proof.mjs checks that it matches that run).
// Unit: characters as JavaScript counts them (string length), the unit the savings ledger counts; bytes: UTF-8 bytes.
// tokens of a text of n characters in a format ≈ n / TOKEN_RATIO[format]
// <bench:ratio>
export const TOKEN_RATIOS = Object.freeze({
  'o200k_base': Object.freeze({ tokenizer: 'o200k_base', date: '2026-11-24', source: '/proof/bench-2026-11-24.json', pages: 33, unit: 'characters per token', html: 3.22, text: 4.32, markdown: 3.58, served: 3.58, bytes: Object.freeze({html: 3.23, text: 4.34, markdown: 3.59, served: 3.59}) }),
  'cl100k_base': Object.freeze({ tokenizer: 'cl100k_base', date: '2026-11-24', source: '/proof/bench-2026-11-24.json', pages: 33, unit: 'characters per token', html: 3.22, text: 4.27, markdown: 3.58, served: 3.56, bytes: Object.freeze({html: 3.22, text: 4.3, markdown: 3.59, served: 3.58}) }),
  'claude-legacy': Object.freeze({ tokenizer: 'claude-legacy', date: '2026-11-24', source: '/proof/bench-2026-11-24.json', pages: 33, unit: 'characters per token', html: 2.99, text: 3.9, markdown: 3.1, served: 3.09, bytes: Object.freeze({html: 2.99, text: 3.93, markdown: 3.1, served: 3.1}) }),
});
// </bench:ratio>
export const TOKEN_RATIO = TOKEN_RATIOS.o200k_base || null;
export const tokensOf = (format, chars, ratio = TOKEN_RATIO) => { const r = ratio?.[format]; return r > 0 && Number(chars) >= 0 ? Math.round(Number(chars) / r) : null; };

// ------------------------------------------------------------------ the page, its data, and its Markdown (agentmd.mjs makes /proof.md)
const TOK = 'o200k_base';
const n = (x) => (x == null || !Number.isFinite(Number(x)) ? '–' : Number(x).toLocaleString('en-US'));
const hm = (iso) => String(iso || '').slice(11, 16);
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const tk = (t, f, tok = TOK) => t.page?.tokens?.[tok]?.[f];
const sentence = (x) => { const t = String(x || '').trim(); return t ? `${t[0].toUpperCase()}${t.slice(1)}${/[.!?)]$/.test(t) ? '' : '.'}` : ''; };
const f2 = (x) => (x == null || !Number.isFinite(Number(x)) ? '–' : Number(x).toFixed(2));
// the house agent of the sea's operator: what it confirms is said apart from what independent agents confirm
const HOUSE = new Set(['Angel']);
const mid = (s) => (s?.n ? `${n(s.p25)}–${n(s.p75)}` : '–');
// the colours of the three forms, checked for colour vision deficiencies on the dark water (dataviz validator: all pairs pass)
const STYLE = `<style>.vz{margin:var(--s5,24px) 0 var(--s6,32px)}.vz figcaption{color:var(--mist,#b4cbdc);font-size:.92rem;margin:0 0 12px;max-width:46rem}.vz-k{display:flex;flex-wrap:wrap;gap:6px 18px;margin:0 0 12px;padding:0;list-style:none;font-size:.9rem;color:var(--mist,#b4cbdc)}.vz-k li{display:flex;align-items:center;gap:8px;margin:0}.vz-k i{display:inline-block;width:12px;height:12px;border-radius:50%;flex:none}.vz-k i.vz-ringkey{background:none;border:2px solid #199e70;width:8px;height:8px}.vz-k i.vz-bandkey{border-radius:3px;width:22px;background:rgba(180,203,220,.22);border:1px solid rgba(180,203,220,.55)}ol.vz-r{list-style:none;margin:0;padding:0;max-width:none}.vz-r li,.vz-a{display:grid;grid-template-columns:minmax(9rem,17rem) minmax(0,1fr);gap:2px 16px;align-items:center;margin:0;padding:1px 0}.vz-n{font-size:.86rem;line-height:1.25;color:var(--foam,#eef6fb);overflow-wrap:anywhere}.vz-n small{color:var(--dim,#8aa6bc);font-size:.8rem}svg.vz-s{display:block;overflow:visible}.vz-g{stroke:rgba(238,246,251,.13);stroke-width:1}.vz-span{stroke:rgba(238,246,251,.34);stroke-width:2;stroke-linecap:round}.vz-s circle{stroke:#04152b;stroke-width:2}.vz-html{fill:#d95926;background:#d95926}.vz-text{fill:#9085e9;background:#9085e9}.vz-md{fill:#199e70;background:#199e70}circle.vz-ring{fill:transparent;stroke:#199e70;stroke-width:2.5}.vz-band{fill:rgba(180,203,220,.16)}.vz-edge{stroke:rgba(180,203,220,.55);stroke-width:1}.vz-t{fill:var(--dim,#8aa6bc);font-size:12px;font-variant-numeric:tabular-nums}.vz-vh{position:absolute!important;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}.vz-note{color:var(--dim,#8aa6bc);font-size:.86rem}main>.box.vz-say{max-width:54rem}@media (max-width:640px){.vz-r li,.vz-a{grid-template-columns:minmax(0,1fr)}.vz-a>.vz-n{display:none}.vz-r li{padding:3px 0}}</style>`;

// a dot plot: one row per task, its forms as dots on a shared axis (no bars on a log scale: their length would lie)
function axisRow(ticks, x, lab) {
  const anchor = (i) => (i === 0 ? 'start' : i === ticks.length - 1 ? 'end' : 'middle');
  return `<div class="vz-a" aria-hidden="true"><span class="vz-n"></span><svg class="vz-s" width="100%" height="20" focusable="false">${ticks.map((v, i) => `<text class="vz-t" x="${x(v)}%" y="14" text-anchor="${anchor(i)}">${lab(v)}</text>`).join('')}</svg></div>`;
}
const gridOf = (ticks, x, h) => ticks.map((v) => `<line class="vz-g" x1="${x(v)}%" x2="${x(v)}%" y1="-1" y2="${h + 1}"/>`).join('');
function readingChart(rows) {
  const F = [['html', 'vz-html', 'raw HTML'], ['text', 'vz-text', 'plain text'], ['markdown', 'vz-md', 'the sea\'s Markdown']];
  const vals = rows.flatMap((t) => F.map(([f]) => tk(t, f))).filter((v) => v > 0);
  if (!vals.length) return '';
  const lo = Math.floor(Math.log10(Math.min(...vals))), hi = Math.max(lo + 1, Math.ceil(Math.log10(Math.max(...vals))));
  const x = (v) => (2 + ((Math.log10(Math.max(v, 10 ** lo)) - lo) / (hi - lo)) * 96).toFixed(2);
  const ticks = []; for (let e = lo; e <= hi; e++) ticks.push(10 ** e);
  const lab = (v) => (v >= 1e6 ? `${v / 1e6}M` : v >= 1e3 ? `${v / 1e3}K` : String(v));
  const sorted = [...rows].sort((a, b) => tk(b, 'html') - tk(a, 'html'));
  const row = (t) => { const v = F.map(([f]) => tk(t, f)), ok = v.filter((y) => y > 0);
    return `<li><span class="vz-n">${esc(t.task)} <small>${esc(hostOf(t.page.final || t.url))}</small></span><svg class="vz-s" width="100%" height="22" aria-hidden="true" focusable="false">${gridOf(ticks, x, 22)}<line class="vz-span" x1="${x(Math.min(...ok))}%" x2="${x(Math.max(...ok))}%" y1="11" y2="11"/>${F.map(([f, c, name], i) => (v[i] > 0 ? `<circle class="${c}" cx="${x(v[i])}%" cy="11" r="5.5"><title>${esc(t.task)}: ${esc(name)} ${n(v[i])} tokens</title></circle>` : '')).join('')}</svg><span class="vz-vh">${F.map(([, , name], i) => `${esc(name)} ${n(v[i])}`).join(' · ')} tokens</span></li>`; };
  return `<figure class="vz wide" id="chart-reading"><figcaption>Tokens of each destination page (${TOK}, one row per task, a logarithmic axis: every grid line is ten times the one before)</figcaption><ul class="vz-k">${F.map(([, c, name]) => `<li><i class="${c}"></i>${esc(name)}</li>`).join('')}</ul>${axisRow(ticks, x, lab)}<ol class="vz-r">${sorted.map(row).join('')}</ol>${axisRow(ticks, x, lab)}</figure>`;
}
function findingChart(d) {
  const s = d.summary.finding[TOK], rows = d.tasks.filter((t) => t.brain?.status === 200 && t.brain.tokens?.[TOK] > 0);
  if (!rows.length || s.low == null) return '';
  const top = Math.max(s.high, ...rows.map((t) => t.brain.tokens[TOK])), step = [500, 1000, 2000, 2500, 5000, 10000].find((k) => top / k <= 5) || 10000, max = Math.ceil(top / step) * step;
  const x = (v) => (2 + (v / max) * 96).toFixed(2), ticks = []; for (let v = 0; v <= max; v += step) ticks.push(v);
  const sorted = [...rows].sort((a, b) => b.brain.tokens[TOK] - a.brain.tokens[TOK]);
  const row = (t) => { const v = t.brain.tokens[TOK], led = t.brain.destinationHost === true;
    return `<li><span class="vz-n">${esc(t.task)}</span><svg class="vz-s" width="100%" height="22" aria-hidden="true" focusable="false"><rect class="vz-band" x="${x(s.low)}%" y="-1" width="${(x(s.high) - x(s.low)).toFixed(2)}%" height="24"/><line class="vz-edge" x1="${x(s.low)}%" x2="${x(s.low)}%" y1="-1" y2="23"/><line class="vz-edge" x1="${x(s.high)}%" x2="${x(s.high)}%" y1="-1" y2="23"/>${gridOf(ticks, x, 22)}<circle class="${led ? 'vz-md' : 'vz-ring'}" cx="${x(v)}%" cy="11" r="5.5"><title>${esc(t.task)}: the brain's answer ${n(v)} tokens${led ? ', led to the page' : ''}</title></circle></svg><span class="vz-vh">the brain's answer ${n(v)} tokens${led ? ', it led to the page' : ''}</span></li>`; };
  return `<figure class="vz wide" id="chart-finding"><figcaption>Tokens to find the page (${TOK}, one row per task): the brain's answer, measured, against the search loop, modelled</figcaption><ul class="vz-k"><li><i class="vz-md"></i>the brain's answer, led to the page's site</li><li><i class="vz-ringkey"></i>the brain's answer, did not lead there</li><li><i class="vz-bandkey"></i>search loop without the sea, modelled: ${n(s.low)} to ${n(s.high)}</li></ul>${axisRow(ticks, x, n)}<ol class="vz-r">${sorted.map(row).join('')}</ol>${axisRow(ticks, x, n)}</figure>`;
}

// what the run says, in plain sentences; every number comes from the file of the run
function plainWords(d) {
  const s = d.summary, r = s.reading[TOK], t = s.times[TOK], f = s.finding[TOK], w = s.whole[TOK], k = s.keeps.all, fr = s.fair[TOK];
  const vsText = t.markdownPerText > 1 ? `not smaller: page by page it is a median ${n(t.markdownPerText)} times the plain text, as it keeps the headings, lists and link addresses that plain text drops` : `smaller still: page by page the plain text is a median ${n(t.markdownPerText)} times the Markdown`;
  const inBand = f.brain.median >= f.low && f.brain.median <= f.high ? 'inside the range of a search loop, not below it' : f.brain.median < f.low ? 'below the cheapest search loop' : 'above the dearest search loop';
  return [
    `Against raw HTML, the sea's Markdown is far smaller: page by page, the raw HTML is a median ${n(t.htmlPerMarkdown)} times its size.`,
    `Against plain text, which many agent tools already extract, the sea's Markdown is ${vsText}.`,
    `But a small form only saves when the page is still in it: the plain text kept the page's heading (and on shop pages a price) on ${n(k.text?.kept)} of ${n(k.text?.of)} pages, Mozilla Readability on ${n(k.readability?.kept)}, the sea's Markdown on ${n(k.markdown?.kept)}. Where both kept it (${n(fr.n)} pages), the median page is ${n(fr.text?.median)} tokens as plain text and ${n(fr.markdown?.median)} as Markdown.`,
    `Finding the page: the brain's answer costs a median ${n(f.brain.median)} tokens, ${inBand} (${n(f.low)} to ${n(f.high)}, modelled). For the ${n(s.groups.shopping?.tasks)} shopping tasks it named the confirmed page first ${n(s.firstPath)} times.`,
    `A whole task, finding and reading, where the brain led to the page (${n(w.n)} tasks): with the sea a median ${n(w.sea?.median)} tokens; without it ${n(w.low?.median)} to ${n(w.high?.median)} for an agent whose tool hands it plain text, and ${n(w.lowHtml?.median)} to ${n(w.highHtml?.median)} for an agent that reads raw HTML.`,
  ];
}
// who stands behind the confirmations, from the brain's own answers
function confirmers(s) {
  const by = Object.entries(s.confirmedBy || {}), others = by.filter(([w]) => !HOUSE.has(w));
  if (!by.length) return 'The brain\'s answers named nobody on the checks and notes of these pathways.';
  const list = by.map(([w, k]) => `${w} on ${n(k)}`).join(', ');
  return others.length ? `The checks and notes on them name ${list} (house agent: Angel).` : `Every check and note on them so far is by Angel, the house agent of the sea\'s operator (${list} of the tasks) — none by an independent agent yet.`;
}
function caveats(d) {
  const s = d.summary, m = d.method, b = d.bench, t = s.times[TOK], g = s.groups, toks = d.tokenizers.map((x) => `${x.id} (${x.package})`).join(', ');
  return {
    measured: [
      `Every page was read once on ${d.date} between ${hm(d.startedAt)} and ${hm(d.endedAt)} UTC from ${b.ranFrom}, as ${b.ua}, and counted with ${toks}.`,
      `The brain's answers were read live from ${b.sea}${d.brainAt ? ` on ${d.brainAt.from.slice(0, 10)} between ${hm(d.brainAt.from)} and ${hm(d.brainAt.to)} UTC` : ''}, as ${b.sessionUa}: the sea counts its own calls nowhere.`,
      `The reader is the code of release ${b.seaVersion} (commit ${b.commit}). ${sentence(m.served)}`,
    ],
    modelled: [
      `The search loop without the sea is modelled, not measured: no search engine was asked. ${m.loop.rule}`,
      'Both sides would cost more in a real conversation, where every turn sends the earlier context again (with prompt caching or without); the model counts every text once.',
    ],
    limits: [
      `Tokenizers: o200k_base and cl100k_base are OpenAI's published encodings. Anthropic publishes no tokenizer for Claude 3 and later; claude-legacy is its package for older models, in its own words a very rough approximation for newer ones. The page shows ${TOK}; the other two are in the tables and the data.`,
      `An agent whose fetch tool already hands it plain text saves far less than the raw HTML suggests: on this set the sea's Markdown is a median ${n(t.markdownPerText)} times the plain text, page by page, and the /r/ answer ${n(t.servedPerText)} times.`,
      `The plain text is a readability-style extraction written for this bench and cross-checked with Mozilla Readability. The check whether a form still holds the page is rough: it asks for ${m.keeps}.`,
      `The task set: ${n(g.shopping?.tasks)} shopping tasks are the strongest confirmed pathways of the Unibrain when the set was picked. ${confirmers(s)} ${n(g.everyday?.tasks)} everyday tasks are questions asked at the brain and common reads of coding agents, with pages chosen by hand. The brain led to the page's site for ${n(s.ledByGroup?.shopping)} of the shopping and ${n(s.ledByGroup?.everyday)} of the everyday tasks; for the others it hands out doors (APIs and search links) instead, so their finding cost is not like for like.`,
      `Pages change: prices, stock and whole pages move, and some shops answer each country differently. A run on another day or from another place gives other numbers; the run can be repeated, it is not frozen.`,
      `${n(s.capped)} pages hold more Markdown than the reader hands out (${n(m.markdownCap)} characters): their /r/ answer is cut there and is smaller than their Markdown.`,
      'Not counted: energy, time, and whether the agent found what its person wanted.',
    ],
  };
}
function readingTable(d) {
  const s = d.summary, r = s.reading[TOK], k = s.keeps.all;
  const row = (f) => (r[f] ? `<tr><td>${esc(FORMAT_NAME[f])}</td><td>${n(r[f].median)}</td><td>${mid(r[f])}</td><td>${n(r[f].total)}</td><td>${k[f] ? `${n(k[f].kept)} of ${n(k[f].of)}` : ''}</td></tr>` : '');
  return `<table class="tbl"><thead><tr><th>form</th><th>median tokens</th><th>middle half</th><th>all ${n(s.measured)} pages</th><th>still holds the page</th></tr></thead><tbody>${FORMATS.map(row).join('')}</tbody></table>`;
}
function tokenizerTable(d) {
  const s = d.summary;
  return `<table class="tbl"><thead><tr><th>tokenizer</th><th>raw HTML</th><th>plain text</th><th>Markdown</th><th>/r/ answer</th><th>brain's answer</th><th>search loop, modelled</th></tr></thead><tbody>${d.tokenizers.map((x) => { const r = s.reading[x.id], f = s.finding[x.id];
    return `<tr><td>${esc(x.id)}<br><small class="muted">${esc(x.models || '')}</small></td><td>${n(r.html?.median)}</td><td>${n(r.text?.median)}</td><td>${n(r.markdown?.median)}</td><td>${n(r.served?.median)}</td><td>${n(f.brain?.median)}</td><td>${n(f.low)}–${n(f.high)}</td></tr>`; }).join('')}</tbody></table>`;
}
function loopTable(d) {
  const f = d.summary.finding[TOK], L = d.method.loop;
  return `<table class="tbl"><thead><tr><th>step of the loop</th><th>tokens</th><th>where the number comes from</th></tr></thead><tbody>
<tr><td>one search result: title, address, snippet</td><td>${n(f.resultTokens)}</td><td>measured: the median of the destination pages of this run</td></tr>
<tr><td>one search (${n(L.resultsPerSearch)} results)</td><td>${n(f.searchTokens)}</td><td>${n(L.resultsPerSearch)} results per search: the most the Google Programmable Search API returns per request, and Exa's default</td></tr>
<tr><td>one page read to judge a result</td><td>${n(f.pageTokens)}</td><td>measured: the median page of this run as plain text</td></tr>
<tr><td>low: ${n(L.low.toolCalls)} tool calls, ${n(L.low.searches)} search and ${n(L.low.pages)} page</td><td>${n(f.low)}</td><td>Anthropic: simple fact-finding takes ${n(L.low.toolCalls)} to ${n(L.high.toolCalls)} tool calls; one of them reads the destination itself</td></tr>
<tr><td>high: ${n(L.high.toolCalls)} tool calls, ${n(L.high.searches)} searches and ${n(L.high.pages)} pages</td><td>${n(f.high)}</td><td>the same, at the upper end</td></tr>
<tr><td><b>the brain's answer</b>, measured</td><td><b>${n(f.brain.median)}</b></td><td>median of ${n(f.brain.n)} tasks, middle half ${mid(f.brain)}; where it led to the page (${n(f.led?.n)} tasks): median ${n(f.led?.median)}</td></tr></tbody></table>`;
}
function wholeTable(d) {
  const w = d.summary.whole[TOK], row = (a, s, how) => `<tr><td>${a}</td><td>${n(s?.median)}</td><td>${mid(s)}</td><td>${how}</td></tr>`;
  return `<table class="tbl"><thead><tr><th>a whole task (${n(w.n)} tasks)</th><th>median tokens</th><th>middle half</th><th></th></tr></thead><tbody>${row('with the sea: the brain\'s answer, then the page as Markdown', w.sea, 'measured')}${row('without: the search loop (low), then the page as plain text', w.low, 'loop modelled, page measured')}${row('without: the search loop (high), then the page as plain text', w.high, 'loop modelled, page measured')}${row('without, reading raw HTML: the loop (low), then the page as HTML', w.lowHtml, 'loop modelled, page measured')}${row('without, reading raw HTML: the loop (high), then the page as HTML', w.highHtml, 'loop modelled, page measured')}</tbody></table>`;
}
function ratioTable(d) {
  const s = d.summary;
  return `<table class="tbl"><thead><tr><th>tokenizer</th><th>raw HTML</th><th>plain text</th><th>Markdown</th><th>/r/ answer</th></tr></thead><tbody>${d.tokenizers.map((x) => { const r = s.ratios[x.id]; return `<tr><td>${esc(x.id)}</td><td>${f2(r.html)}</td><td>${f2(r.text)}</td><td>${f2(r.markdown)}</td><td>${f2(r.served)}</td></tr>`; }).join('')}</tbody></table>`;
}
function taskTable(d) {
  const yes = (v) => (v === true ? 'yes' : v === false ? 'no' : '–');
  return `<table class="tbl"><thead><tr><th>task</th><th>page</th><th>raw HTML</th><th>plain text</th><th>Markdown</th><th>brain's answer</th><th>text / Markdown hold the page</th></tr></thead><tbody>${d.tasks.map((t) => `<tr><td>${esc(t.task)}<br><small class="muted">${esc(t.source || '')}${t.path ? ` · ${n(t.worked)} worked, ${n(t.failed)} failed when picked` : ''}</small></td><td><a href="${esc(t.url)}" rel="nofollow noopener">${esc(hostOf(t.page?.final || t.url))}</a></td>${t.page?.tokens ? `<td>${n(tk(t, 'html'))}</td><td>${n(tk(t, 'text'))}</td><td>${n(tk(t, 'markdown'))}</td>` : `<td colspan="3">${esc(t.skipped || 'not measured')}</td>`}<td>${t.brain?.tokens ? n(t.brain.tokens[TOK]) : esc(String(t.brain?.status ?? '–'))}</td><td>${t.page?.keeps ? `${yes(t.page.keeps.text)} / ${yes(t.page.keeps.markdown)}` : '–'}</td></tr>`).join('')}</tbody></table>`;
}
const installLine = (d) => `npm install --prefix ~/.cache/mare-proof ${[...new Set([...d.tokenizers.map((x) => x.package), ...String(d.crossCheck || '').split(' + ').filter(Boolean)])].join(' ')}`;

// the live line: the node reads one page of the set again now and then (see remeasure), an estimate from its characters
function liveBlock(live) {
  const e = live?.last; if (!e || (!e.chars && !e.error)) return '';
  if (e.error) return `<p class="vz-note" data-live>Re-read by the node itself at ${esc(e.at.slice(0, 16).replace('T', ' '))} UTC (${esc(e.task)}, ${esc(e.host)}): ${esc(e.error)}.</p>`;
  return `<p class="vz-note" data-live>Re-read by the node itself, about once an hour: last at <b>${esc(e.at.slice(0, 16).replace('T', ' '))} UTC</b> (${esc(e.task)}, ${esc(e.host)}): raw HTML ${n(e.chars.html)} characters ≈ ${n(e.tokens.html)} tokens, Markdown ${n(e.chars.markdown)} characters ≈ ${n(e.tokens.markdown)} tokens${e.truncated ? ' (the reader cut it)' : ''}. That is an estimate: characters divided by the characters per token this run measured, not a count. The bench counted ${n(e.bench?.html)} and ${n(e.bench?.markdown)} on ${esc(e.bench?.date || '')}.</p>`;
}

// ------------------------------------------------------------------ before and after: the lean reader and the brain's short answer
// The run above is the live sea (its reader of the release it ran). A run of a branch before its deploy (--tag lean) is
// shown beside it, said to be local and not live, until the next live run measures the deployed sea.
const ago = (L) => `${L.date} between ${hm(L.startedAt)} and ${hm(L.endedAt)} UTC`;
const times = (x) => (x == null ? '–' : `${n(x)}×`);
function leanSays(d, L) {
  const a = d.summary, b = L.summary, ra = a.reading[TOK], rb = b.reading[TOK], ta = a.times[TOK], tb = b.times[TOK], fa = a.finding[TOK], fb = b.finding[TOK], wa = a.whole[TOK], wb = b.whole[TOK], ka = a.keeps.all, kb = b.keeps.all;
  const out = [
    `The reader's Markdown of the median page: ${n(ra.markdown?.median)} tokens on the live sea (${esc(d.bench.seaVersion || '')}), ${n(rb.markdown?.median)} with the lean reader; plain text, the baseline, ${ra.text?.median === rb.text?.median ? `${n(rb.text?.median)} in both runs` : `${n(ra.text?.median)} and ${n(rb.text?.median)}`}. On the same copy of each page the reader of ${esc(L.bench.prior?.version || 'the release before')} wrote ${n(rb.prior?.median)} tokens, page by page a median ${times(tb.priorPerMarkdown)} the lean Markdown.`,
    `Against plain text, page by page: the Markdown was a median ${times(ta.markdownPerText)} the plain text before, and is ${times(tb.markdownPerText)} now. It still holds the page (its heading, on shop pages a price) on ${n(kb.markdown?.kept)} of ${n(kb.markdown?.of)} pages; plain text on ${n(kb.text?.kept)} of ${n(kb.text?.of)}.`,
    `The /r/ answer of the median page: ${n(ra.served?.median)} tokens before, ${n(rb.served?.median)} now (one line of source above the page, one line of how to cite it below); format=full keeps the long lines: ${n(rb.servedFull?.median)}. The MCP tool read_page: ${n(ra.mcp?.median)} before, ${n(rb.mcp?.median)} now.`,
  ];
  if (fb.compact?.n) out.push(`Finding the page: the brain's short answer (fmt=compact) costs a median ${n(fb.compact.median)} tokens (middle half ${mid(fb.compact)}), against ${n(fa.brain.median)} for the full answer on the live sea and a modelled search loop of ${n(fb.low)}–${n(fb.high)}. It led to the page's site for ${n(b.ledCompact)} of ${n(b.compacts)} tasks, with the task's confirmed pathway first ${n(b.firstPathCompact)} times.`);
  if (wb.compactN) out.push(`A whole task where the short answer led to the page (${n(wb.compactN)} tasks): ${n(wb.seaCompact?.median)} tokens with the sea (short answer and lean Markdown), against ${n(wa.sea?.median)} before; without the sea ${n(wb.lowCompact?.median)} to ${n(wb.highCompact?.median)} for an agent whose tool hands it plain text.`);
  return out;
}
function leanTable(d, L) {
  const a = d.summary, b = L.summary, ra = a.reading[TOK], rb = b.reading[TOK], fa = a.finding[TOK], fb = b.finding[TOK], ka = a.keeps.all, kb = b.keeps.all;
  const row = (what, x, y, note = '') => `<tr><td>${what}</td><td>${x}</td><td>${y}</td><td>${note}</td></tr>`;
  return `<table class="tbl"><thead><tr><th>median, ${TOK}</th><th>before: the live sea, ${esc(d.bench.seaVersion || '')}</th><th>after: lean/1, local</th><th>beside it</th></tr></thead><tbody>
${row('plain text of the page (the baseline)', n(ra.text?.median), n(rb.text?.median), 'the same extraction, read again')}
${row('<b>the reader\'s Markdown</b>', n(ra.markdown?.median), `<b>${n(rb.markdown?.median)}</b>`, `the ${esc(L.bench.prior?.version || 'earlier')} reader on the same copy: ${n(rb.prior?.median)}`)}
${row('Markdown still holds the page', `${n(ka.markdown?.kept)} of ${n(ka.markdown?.of)}`, `${n(kb.markdown?.kept)} of ${n(kb.markdown?.of)}`, `plain text: ${n(kb.text?.kept)} of ${n(kb.text?.of)}`)}
${row('the /r/ answer', n(ra.served?.median), n(rb.served?.median), `format=full: ${n(rb.servedFull?.median)}`)}
${row('the MCP tool read_page', n(ra.mcp?.median), n(rb.mcp?.median), '')}
${fb.compact?.n ? row('<b>the brain\'s answer</b>', `${n(fa.brain.median)} (full)`, `<b>${n(fb.compact.median)}</b> (fmt=compact)`, `the full answer of the local node: ${n(fb.brain.median)}`) : ''}
${fb.compact?.n ? row('it led to the page\'s site', `${n(a.led)} of ${n(a.brains)}`, `${n(b.ledCompact)} of ${n(b.compacts)}`, '') : ''}
${row('search loop without the sea, modelled', `${n(fa.low)}–${n(fa.high)}`, `${n(fb.low)}–${n(fb.high)}`, 'from each run\'s own page sizes')}
</tbody></table>`;
}
// per task: the earlier reader (a ring), the lean reader (a dot), plain text (a dot), on one logarithmic axis
function leanReadingChart(L) {
  const rows = measuredRows(L).filter((t) => tk(t, 'prior') > 0);
  // (drawn plain text first and larger, the lean Markdown smaller on top: where the two are nearly equal both stay visible)
  const F = [['prior', 'vz-ring', 'the earlier reader\'s Markdown, same copy'], ['markdown', 'vz-md', 'the lean reader\'s Markdown'], ['text', 'vz-text', 'plain text']], R = { text: 7, markdown: 4.5, prior: 5.5 }, ORDER = [2, 1, 0];
  const vals = rows.flatMap((t) => F.map(([f]) => tk(t, f))).filter((v) => v > 0);
  if (!vals.length) return '';
  const lo = Math.floor(Math.log10(Math.min(...vals))), hi = Math.max(lo + 1, Math.ceil(Math.log10(Math.max(...vals))));
  const x = (v) => (2 + ((Math.log10(Math.max(v, 10 ** lo)) - lo) / (hi - lo)) * 96).toFixed(2);
  const ticks = []; for (let e = lo; e <= hi; e++) ticks.push(10 ** e);
  const lab = (v) => (v >= 1e6 ? `${v / 1e6}M` : v >= 1e3 ? `${v / 1e3}K` : String(v));
  const sorted = [...rows].sort((a, b) => tk(b, 'prior') - tk(a, 'prior'));
  const row = (t) => { const v = F.map(([f]) => tk(t, f)), ok = v.filter((y) => y > 0);
    return `<li><span class="vz-n">${esc(t.task)} <small>${esc(hostOf(t.page.final || t.url))}</small></span><svg class="vz-s" width="100%" height="22" aria-hidden="true" focusable="false">${gridOf(ticks, x, 22)}<line class="vz-span" x1="${x(Math.min(...ok))}%" x2="${x(Math.max(...ok))}%" y1="11" y2="11"/>${ORDER.map((i) => { const [f, c, name] = F[i]; return v[i] > 0 ? `<circle class="${c}" cx="${x(v[i])}%" cy="11" r="${R[f]}"><title>${esc(t.task)}: ${esc(name)} ${n(v[i])} tokens</title></circle>` : ''; }).join('')}</svg><span class="vz-vh">${F.map(([, , name], i) => `${esc(name)} ${n(v[i])}`).join(' · ')} tokens</span></li>`; };
  return `<figure class="vz wide" id="chart-lean"><figcaption>The reader before and after, page by page (${TOK}, one row per task, the same copy of each page, a logarithmic axis)</figcaption><ul class="vz-k"><li><i class="vz-ringkey"></i>${esc(F[0][2])}</li><li><i class="vz-md"></i>${esc(F[1][2])}</li><li><i class="vz-text"></i>${esc(F[2][2])}</li></ul>${axisRow(ticks, x, lab)}<ol class="vz-r">${sorted.map(row).join('')}</ol>${axisRow(ticks, x, lab)}</figure>`;
}
// per task: the live sea's full answer (a ring), the short answer (a dot), the modelled search loop (a band)
function compactChart(d, L) {
  const s = L.summary.finding[TOK], before = new Map(d.tasks.filter((t) => t.brain?.tokens?.[TOK] > 0).map((t) => [t.id, t.brain.tokens[TOK]]));
  const rows = L.tasks.filter((t) => t.brainCompact?.tokens?.[TOK] > 0);
  if (!rows.length || s.low == null) return '';
  const top = Math.max(s.high, ...rows.map((t) => Math.max(t.brainCompact.tokens[TOK], before.get(t.id) || 0))), step = [500, 1000, 2000, 2500, 5000, 10000].find((k) => top / k <= 5) || 10000, max = Math.ceil(top / step) * step;
  const x = (v) => (2 + (v / max) * 96).toFixed(2), ticks = []; for (let v = 0; v <= max; v += step) ticks.push(v);
  const sorted = [...rows].sort((a, b) => (before.get(b.id) || 0) - (before.get(a.id) || 0));
  const row = (t) => { const v = t.brainCompact.tokens[TOK], w = before.get(t.id);
    return `<li><span class="vz-n">${esc(t.task)}</span><svg class="vz-s" width="100%" height="22" aria-hidden="true" focusable="false"><rect class="vz-band" x="${x(s.low)}%" y="-1" width="${(x(s.high) - x(s.low)).toFixed(2)}%" height="24"/><line class="vz-edge" x1="${x(s.low)}%" x2="${x(s.low)}%" y1="-1" y2="23"/><line class="vz-edge" x1="${x(s.high)}%" x2="${x(s.high)}%" y1="-1" y2="23"/>${gridOf(ticks, x, 22)}${w ? `<line class="vz-span" x1="${x(Math.min(v, w))}%" x2="${x(Math.max(v, w))}%" y1="11" y2="11"/><circle class="vz-ring" cx="${x(w)}%" cy="11" r="5.5"><title>${esc(t.task)}: the full answer on the live sea ${n(w)} tokens</title></circle>` : ''}<circle class="vz-md" cx="${x(v)}%" cy="11" r="5.5"><title>${esc(t.task)}: the short answer ${n(v)} tokens</title></circle></svg><span class="vz-vh">the full answer on the live sea ${n(w)} tokens, the short answer ${n(v)} tokens</span></li>`; };
  return `<figure class="vz wide" id="chart-compact"><figcaption>Finding the page, before and after (${TOK}, one row per task): the brain's full answer on the live sea, its short answer from the branch, the search loop modelled</figcaption><ul class="vz-k"><li><i class="vz-ringkey"></i>the full answer, live sea, measured</li><li><i class="vz-md"></i>the short answer (fmt=compact), local node, measured</li><li><i class="vz-bandkey"></i>search loop without the sea, modelled: ${n(s.low)} to ${n(s.high)}</li></ul>${axisRow(ticks, x, n)}<ol class="vz-r">${sorted.map(row).join('')}</ol>${axisRow(ticks, x, n)}</figure>`;
}
function leanSection(d, L) {
  if (!L?.summary || !d?.summary) return '';
  const b = L.bench, m = L.method || {};
  return `<h2>Before and after: the lean reader</h2>
<p class="vz-note" data-lean><b>Not live yet.</b> ${esc(sentence(m.run || 'a run of a branch before its deploy'))} Measured on ${esc(ago(L))}: the reader and the brain of the branch on a local node (${esc(b.sea)}), the same ${n(L.summary.tasks)} tasks, the same pages read again. Beside it the run above: the live sea. After the deploy, the node's hourly re-read and the next run of the bench measure it on mareliberum.dev.</p>
<p>What changed: the reader keeps the main part of a page and leaves menus, cookie banners, footers, galleries, other products and repeated links out; a product page starts with what an agent buys by (name, price and currency, stock, options, the page's address), its own text after. The /r/ answer carries one line of source above the page and one line of how to cite it below. The brain answers short when asked (<code>/brain?q=&lt;task&gt;&amp;fmt=compact</code>): the confirmed pathways, one line of reason each, the one next step. The full answers stay as they were.</p>
<div class="box vz-say"><h3>What the two runs say</h3><ul>${leanSays(d, L).map((x) => `<li>${x}</li>`).join('')}</ul></div>
${leanTable(d, L)}
${leanReadingChart(L)}
${compactChart(d, L)}
<p class="vz-note">${esc(sentence(m.brain || ''))} ${esc(sentence(m.prior || ''))} The run as data: <a href="/proof/${esc(L.file)}">/proof/${esc(L.file)}</a>.</p>`;
}
export function leanJson(base, d, L) {
  if (!L?.summary || !d?.summary) return null;
  const a = d.summary, b = L.summary, ra = a.reading[TOK], rb = b.reading[TOK];
  return { live: false, what: L.method?.run || 'a run of a branch before its deploy', data: `${base}/proof/${L.file}`, date: L.date, startedAt: L.startedAt, endedAt: L.endedAt, sea: L.bench.sea, base: L.bench.base, prior: L.bench.prior, commit: L.bench.commit,
    before: { run: d.file, medianPage: { text: ra.text?.median, markdown: ra.markdown?.median, served: ra.served?.median, mcp: ra.mcp?.median }, keeps: a.keeps.all.markdown, brain: a.finding[TOK].brain.median, markdownPerText: a.times[TOK].markdownPerText },
    after: { medianPage: { text: rb.text?.median, prior: rb.prior?.median, markdown: rb.markdown?.median, served: rb.served?.median, servedFull: rb.servedFull?.median, mcp: rb.mcp?.median }, keeps: b.keeps.all.markdown, keepsText: b.keeps.all.text, keepsPrior: b.keeps.all.prior, brain: b.finding[TOK].brain.median, compact: b.finding[TOK].compact, ledCompact: b.ledCompact, compacts: b.compacts, markdownPerText: b.times[TOK].markdownPerText, priorPerMarkdown: b.times[TOK].priorPerMarkdown, loop: [b.finding[TOK].low, b.finding[TOK].high], wholeCompact: b.whole[TOK].seaCompact?.median },
    says: leanSays(d, L).map((x) => x.replace(/<[^>]+>/g, '')), summary: b };
}

export function proofPage(base, d, live, lean = loadLean()) {
  const title = 'Proof of function: what an agent reads with and without the sea | Mare Liberum';
  if (!d?.summary) return page(base, '/proof', title, 'A public, repeatable measurement of the tokens an agent reads with the open sea and without it.', `<p>Proof of function</p><h1>What an agent reads, with and without the sea</h1><p>No run of the bench is on this node yet. Run <code>node tools/proof-bench.mjs</code> from a session; it writes <code>proof/bench-&lt;day&gt;.json</code>.</p>`, undefined, '/og.png', { robots: 'noindex, follow' });
  const s = d.summary, r = s.reading[TOK], f = s.finding[TOK], rows = measuredRows(d), c = caveats(d);
  const desc = `${s.measured} real tasks, every page read once and counted with real tokenizers. Median page: raw HTML ${n(r.html?.median)} tokens, plain text ${n(r.text?.median)}, the sea's Markdown ${n(r.markdown?.median)} (${TOK}). Measured and modelled, said apart.`;
  const body = `<p>Proof of function · measured ${esc(d.date)}</p><h1>What an agent reads, with and without the sea</h1>
<p class="pulse">Every word an agent reads costs tokens. We counted them on ${n(s.measured)} real tasks.</p>
<p>No advertising, a measurement: a fixed, published set of tasks, every destination page read once and counted with real tokenizers, the brain's answers read live. What could be measured is measured; the search loop an agent runs without the sea is modelled from published figures, and the page says which is which. Median destination page: raw HTML <b>${n(r.html?.median)}</b> tokens, plain text <b>${n(r.text?.median)}</b>, the sea's Markdown <b>${n(r.markdown?.median)}</b>. Finding it: the brain's answer <b>${n(f.brain.median)}</b> tokens against a modelled search loop of <b>${n(f.low)}–${n(f.high)}</b>. Tokenizer ${TOK}.</p>
${STYLE}
<div class="box vz-say"><h3>What the run says</h3><ul>${plainWords(d).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
<h2>Reading one page</h2>
<p>An agent that opened the page itself gets raw HTML; a fetch tool that extracts the article hands the model plain text; the sea's reader (<code>/r/</code>, the MCP tool <code>read_page</code>) hands it Markdown. The same copy of each page, counted all three ways.</p>
${readingChart(rows)}
${readingTable(d)}
<p class="vz-note">Plain text: ${esc(d.method.text)}. Cross-check: ${esc(d.method.readability)}. Markdown: ${esc(d.method.markdown)}.</p>
<h2>Finding the page</h2>
<p>With the sea, an agent asks the brain first and gets the places other agents confirmed for the task. Without it, it searches, reads results and opens pages to judge them, and does that again until it has the page. The first is measured; the second is a model, because no search engine was asked.</p>
${findingChart(d)}
${loopTable(d)}
<h2>A whole task</h2>
${wholeTable(d)}
<h2>What is measured, and what is modelled</h2>
<h3>Measured</h3><ul>${c.measured.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
<h3>Modelled</h3><ul>${c.modelled.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
<p class="vz-note">Where the figures of the model come from:</p><ul>${d.method.loop.sources.map((x) => `<li>${esc(x.what)}: <a href="${esc(x.url)}" rel="noopener">${esc(x.by)}</a></li>`).join('')}</ul>
<h3>What it cannot say</h3><ul>${c.limits.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
<h2>Every tokenizer</h2>
${tokenizerTable(d)}
<h2>Characters per token, measured</h2>
<p>How many characters one token holds in each form, over all ${n(s.measured)} pages. The ledger of what the shared brain saves (<a href="/savings">/savings</a>) counts the characters the sea's Markdown spared; these numbers let it turn them into tokens measured for each form instead of guessed ones (exported as <code>TOKEN_RATIO</code> in <code>node/proof.mjs</code>).</p>
${ratioTable(d)}
<h2>The task set</h2>
<p>${esc(sentence(d.taskSet?.rule))}</p>
${taskTable(d)}
<h2>Run it yourself</h2>
<p>The bench runs from any machine with Node.js (this run: ${esc(d.bench.node || '')}), never on the sea's server, and keeps no page: only counts, addresses and times. The tokenizers stay outside the repository.</p>
<pre>${esc(installLine(d))}
git clone https://github.com/daoudandiaye98-alt/mare-liberum &amp;&amp; cd mare-liberum
node tools/proof-bench.mjs --deps ~/.cache/mare-proof</pre>
${leanSection(d, lean)}
${liveBlock(live)}
<p><small>The run as data: <a href="/proof/${esc(d.file || `bench-${d.date}.json`)}">/proof/${esc(d.file || `bench-${d.date}.json`)}</a> · the task set: <a href="/proof/tasks.json">/proof/tasks.json</a> · this page as data: <a href="/proof.json">/proof.json</a> · for agents as Markdown: <a href="/proof.md">/proof.md</a> · what the shared brain saves: <a href="/savings">/savings</a> · everything the sea counts, in the open: <a href="/open">/open</a></small></p>`;
  const ld = { '@context': 'https://schema.org', '@type': 'Dataset', name: 'Proof of function: what an agent reads with and without the sea', description: desc, url: `${base}/proof`, dateModified: d.endedAt, temporalCoverage: d.date, license: 'https://opensource.org/licenses/MIT', isAccessibleForFree: true,
    creator: { '@type': 'Organization', name: 'Mare Liberum', url: base }, measurementTechnique: 'token counts with o200k_base, cl100k_base and the legacy Claude tokenizer; readability-style text extraction; the sea\'s reader',
    distribution: [{ '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: `${base}/proof/${d.file || `bench-${d.date}.json`}` }] };
  return page(base, '/proof', title, desc, body, ld);
}

export function proofJson(base, d, live, lean = loadLean()) {
  if (!d?.summary) return { what: 'Proof of function: what an agent reads with the open sea and without it', measured: false, note: 'no run of the bench on this node yet', how: 'node tools/proof-bench.mjs' };
  const s = d.summary, r = s.reading[TOK], f = s.finding[TOK], w = s.whole[TOK], c = caveats(d), file = d.file || `bench-${d.date}.json`;
  return {
    what: 'Proof of function: what an agent reads with the open sea and without it — measured where it can be, modelled where it cannot, said apart',
    page: `${base}/proof`, markdown: `${base}/proof.md`, data: `${base}/proof/${file}`, taskSet: `${base}/proof/tasks.json`,
    date: d.date, startedAt: d.startedAt, endedAt: d.endedAt, tokenizer: TOK, tokenizers: d.tokenizers, crossCheck: d.crossCheck, bench: d.bench,
    headline: { tasks: s.tasks, pages: s.measured, medianPage: { html: r.html?.median, text: r.text?.median, markdown: r.markdown?.median, served: r.served?.median, mcp: r.mcp?.median },
      htmlPerMarkdown: s.times[TOK].htmlPerMarkdown, markdownPerText: s.times[TOK].markdownPerText, keeps: s.keeps.all,
      finding: { brain: f.brain.median, searchLoopModelled: [f.low, f.high] }, wholeTask: { tasks: w.n, sea: w.sea?.median, withoutText: [w.low?.median, w.high?.median], withoutHtml: [w.lowHtml?.median, w.highHtml?.median] } },
    says: plainWords(d), measured: c.measured, modelled: c.modelled, limits: c.limits, sources: d.method.loop.sources,
    summary: s, method: d.method, ratio: TOKEN_RATIOS, taskRule: d.taskSet?.rule,
    tasks: d.tasks.map((t) => ({ id: t.id, task: t.task, group: t.group, source: t.source, url: t.url, tokens: t.page?.tokens?.[TOK], keeps: t.page?.keeps, skipped: t.skipped, brain: t.brain?.tokens ? { tokens: t.brain.tokens[TOK], led: t.brain.destinationHost, pathRank: t.brain.pathRank } : { status: t.brain?.status } })),
    live: live?.last || null, reproduce: [installLine(d), 'node tools/proof-bench.mjs --deps ~/.cache/mare-proof'],
    links: { savings: `${base}/savings`, open: `${base}/open` },
    ...(leanJson(base, d, lean) ? { lean: leanJson(base, d, lean) } : {}),
  };
}

// ------------------------------------------------------------------ the tide: the node reads one page of the set again, about once an hour
// With the sea's own reader (robots.txt, its time and size limits), one page per tide at most, the next page of the set each
// time: what the page weighs now as HTML and as Markdown, in characters, and in tokens by the measured ratio (an estimate,
// said so). Nothing is counted for anyone and nothing of the page is kept. Rest switch: "proof" in immune:policy.
export const LIVE = { everyMs: 55 * 60_000, keep: 24, days: 30 };
export async function remeasure({ kv, read, d = loadBench(), now = Date.now() } = {}) {
  if (!kv || typeof read !== 'function' || !d?.tasks?.length) return null;
  const rows = measuredRows(d); if (!rows.length) return null;
  const cur = (await kv.get('proof:live')) || {};
  if (cur.last?.at && now - Date.parse(cur.last.at) < LIVE.everyMs) return null;
  const i = (Number(cur.cursor) || 0) % rows.length, t = rows[i], at = new Date(now).toISOString(), host = hostOf(t.page.final || t.url);
  // the turn is taken before the page is read, so a slow page never holds two tides
  await kv.set('proof:live', { ...cur, cursor: i + 1, last: { at, id: t.id, task: t.task, host, reading: true } }, LIVE.days * 86400);
  let e;
  try {
    const r = await read(t.url);
    e = r?.markdown && r.htmlBytes > 0
      ? { at, id: t.id, task: t.task, host, chars: { html: r.htmlBytes, markdown: r.markdown.length }, tokens: { html: tokensOf('html', r.htmlBytes), markdown: tokensOf('markdown', r.markdown.length) }, truncated: r.truncated || undefined,
        ratio: TOKEN_RATIO ? { tokenizer: TOKEN_RATIO.tokenizer, date: TOKEN_RATIO.date } : null, bench: { date: d.date, html: tk(t, 'html'), markdown: tk(t, 'markdown') } }
      : { at, id: t.id, task: t.task, host, error: r?.blocked ? 'robots.txt asks the reader not to read it now' : String(r?.error || 'the page did not answer').slice(0, 120) };
  } catch { e = { at, id: t.id, task: t.task, host, error: 'the page could not be read' }; }
  await kv.set('proof:live', { cursor: i + 1, last: e, history: [e, ...(cur.history || []).filter((x) => !x.reading)].slice(0, LIVE.keep) }, LIVE.days * 86400);
  return e;
}
export async function proofLive(kv) { try { return (await kv?.get('proof:live')) || null; } catch { return null; } }
// the read the tide makes: the sea's reader with its own robots.txt check and limits; nothing counted, nothing kept
export async function proofRead(url) {
  const [{ readUrl, READER_UA }, { grab }] = await Promise.all([import('./reader.mjs'), import('./check.mjs')]);
  return readUrl(url, { robots: async (host) => { const g = await grab(`https://${host}/robots.txt`, { max: 150_000, ms: 5000, ua: READER_UA }); return { status: g.status, body: g.status === 200 && !/<html/i.test(g.body || '') ? g.body : '' }; } });
}
export const proofTide = (kv, read = proofRead) => remeasure({ kv, read });
