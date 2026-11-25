// Mare Liberum · the engine room: the levers that spare agents tokens, all measured one way (since 3.35)
// An agent pays for every token it reads. The sea already reads pages lean (node/lean.mjs), answers short on request
// (node/compact.mjs) and hands over what others solved (node/brain.mjs). The engine room adds the levers for what agents
// read most besides pages, and counts every one of them the same way:
//   toon      structured answers as TOON instead of JSON, lossless: every JSON door with fmt=toon or Accept: text/toon, and
//             the text the model reads on the lean MCP door
//   lean      the lean MCP door /mcp/lean: a handful of tools instead of every tool of the open door; the rest are found
//             and called when they are needed, with the same answers
//   squeeze   POST /compress: text, HTML or JSON an agent already holds, made smaller; the lossless steps first, a question
//             or a token budget only when the agent names one (then lossy, and said so)
//   delta     a page read again: unchanged in one line, changed as the lines that changed (/r/<address>?since=<etag>, or
//             If-None-Match with the ETag of the answer before)
//   budget    a page fitted to the token budget the agent names (/r/<address>?budget=<tokens>), the parts that answer its
//             question first; lossy, and said so
// One rule for every lever: what the agent would have read (before) and what it read (after), each in UTF-8 bytes, each
// made tokens with the ratio the bench measured for its form (tools/engine-bench.mjs, tokenizer o200k_base). No saving,
// no count. Lossless and lossy savings are counted and shown apart; only lossless ones enter the headline of /savings.
// The engine shapes an answer only when the agent asks for it (a parameter, a header or the lean door): every default
// answer of the sea stays byte for byte what it was. Off (MARE_ENGINE=off) or resting ("engine" in rest of
// immune:policy), nothing of it acts and every answer is what it was before 3.35.
import { TOKEN_RATIO as BENCH } from './proof.mjs';

export const ENGINE_VERSION = 'engine-1';
// the five levers; lossless: what the agent reads says everything the long form said
export const LEVERS = Object.freeze({
  toon: Object.freeze({ lossless: true, door: 'fmt=toon or Accept: text/toon on every JSON door; the text the model reads on /mcp/lean', what: 'structured answers as TOON instead of JSON: the same data, the keys of a table said once' }),
  lean: Object.freeze({ lossless: true, door: '/mcp/lean', what: 'the lean MCP door: a handful of tools instead of every tool of the open door; the rest are found and called when needed' }),
  squeeze: Object.freeze({ lossless: null, door: 'POST /compress', what: 'text, HTML or JSON the agent already holds, made smaller: lossless steps first; a question or a token budget only when the agent names one' }),
  delta: Object.freeze({ lossless: true, door: '/r/<address>?since=<etag> or If-None-Match', what: 'a page read again: unchanged in one line, changed as the lines that changed' }),
  budget: Object.freeze({ lossless: false, door: '/r/<address>?budget=<tokens>', what: 'a page fitted to the token budget the agent names, the parts that answer its question first' }),
});

// <bench:engine> written by tools/engine-bench.mjs --ratio from the newest run (UTF-8 bytes per token, tokenizer o200k_base)
export const ENGINE_RATIOS = null;
// </bench:engine>
// until the bench has measured JSON and TOON, both count with the ratio the proof measured for the sea's Markdown: an
// assumption, and said so wherever a number rests on it
const B = BENCH?.bytes || {};
// once the bench has run, JSON and TOON count with what it measured; HTML, Markdown and text always with the proof's ratios
export const RATIO = Object.freeze(ENGINE_RATIOS ? { html: B.html || 4, md: B.markdown || 4, text: B.text || 4, ...ENGINE_RATIOS, unit: 'UTF-8 bytes per token', assumption: false,
    basis: `measured: JSON and TOON on ${ENGINE_RATIOS.answers} real answers of the sea (${ENGINE_RATIOS.date}, ${ENGINE_RATIOS.tokenizer}, ${ENGINE_RATIOS.source}); HTML, Markdown and plain text from the proof of function (/proof)` }
  : { html: B.html || 4, md: B.markdown || 4, text: B.text || 4, json: B.markdown || 4, toon: B.markdown || 4, unit: 'UTF-8 bytes per token', assumption: true,
    basis: 'JSON and TOON not measured yet: counted with the bytes per token the proof measured for the sea\'s Markdown (o200k_base)' });

const UTF8 = new TextEncoder();
// a text, or a count of UTF-8 bytes
export const bytesOf = (x) => (typeof x === 'number' ? Math.max(0, Math.floor(x)) : UTF8.encode(String(x ?? '')).length);
// tokens of a text (or of n UTF-8 bytes) in a form: 'html' | 'md' | 'text' | 'json' | 'toon'
export function tokensOf(form, x) {
  const r = Number(RATIO[form]) || Number(RATIO.text) || 4, b = bytesOf(x);
  return b > 0 ? Math.round(b / r) : 0;
}
// what one answer of a lever spared: before = what the agent would have read, in its form; after = what it read
export function savingOf(lever, { before, beforeForm = 'text', after, afterForm = 'text', lossy } = {}) {
  const tb = tokensOf(beforeForm, before), ta = tokensOf(afterForm, after);
  const lossless = lossy == null ? LEVERS[lever]?.lossless === true : !lossy;
  return { lever, before: tb, after: ta, saved: Math.max(0, tb - ta), lossy: !lossless, bytes: { before: bytesOf(before), after: bytesOf(after) } };
}
// the headers on an answer the engine shaped (fixed names; the receipt headers of node/fair.mjs stay theirs)
export function engineHeaders(s) {
  if (!s?.lever) return {};
  return { 'x-sea-engine': s.lever, 'x-sea-engine-tokens': `${s.before}->${s.after}`, 'x-sea-engine-saved': String(s.saved), ...(s.lossy ? { 'x-sea-engine-lossy': '1' } : {}) };
}
// on unless the node is switched off (cfg.engine or MARE_ENGINE: off, 0, false, no); resting is asked of the immune
// system where the engine acts (immune.atRest?.('engine'))
export const engineSwitch = (cfg = {}, env = globalThis.process?.env || {}) => !/^(off|0|false|no)$/i.test(String(cfg.engine ?? env.MARE_ENGINE ?? '').trim());
// on, and not resting: the switch of the node and the rest switch "engine" of the immune system (node/immune.mjs atRest).
// The immune system is handed in (core.mjs: engineOn(cfg, immune)), so that this file imports nothing of the sea's state;
// without one, only the switch decides
export const engineOn = (cfg = {}, immune = cfg?.immune, env) => engineSwitch(cfg, env) && !immune?.atRest?.('engine');
