// Mare Liberum · TOON on every JSON door (since 3.35, the engine's lever "toon"): one place, the outermost layer of handle
// in node/core.mjs. An agent that asks for TOON (fmt=toon, or an Accept that prefers text/toon over application/json)
// gets the same answer it would get as JSON, re-encoded as TOON (node/toon.mjs, spec 4.4): lossless, the keys of a table
// said once. Nobody else sees any change: without the ask the request never reaches this module and the answer is byte
// for byte what it was. The JSON answer is made as always (asked of the doors with Accept: application/json and without
// fmt=toon, so a door that answers both ways answers its data), with its fair receipt, headers and all; then:
//   - a JSON answer (200 or 201) becomes text/toon when TOON is smaller in tokens (savingOf, node/engine.mjs), with the
//     engine headers (engineHeaders) and vary: accept, and is counted through the ledger (countEngine) under the rules of
//     /savings: never the sea's own calls, never crawlers, never HEAD, the house agent apart;
//   - JSON stays JSON, and says why in x-sea-engine-note, where TOON would not be smaller, where TOON cannot say it (a
//     string with an unpaired surrogate, §3 of the spec), for JSON-RPC envelopes (MCP and A2A clients parse JSON; the
//     lean MCP door /mcp/lean puts TOON inside its tool results instead) and for errors (every status but 200 and 201);
//   - an answer that is no JSON (a page, Markdown) is sent as the JSON-asking request got it, with the note.
// The app door (/mcp/app) is never touched (rule 4).
import { toToon, TOON } from './toon.mjs';
import { savingOf, engineHeaders } from './engine.mjs';

const APP = /^\/mcp\/app(\/|$)/;
const JSON_TYPE = /^application\/(json|[a-z.+-]*\+json)\s*(;|$)/i;
const FMT = /^fmt=toon$/i;
export const ENGINE_EXPOSE = 'x-sea-engine,x-sea-engine-tokens,x-sea-engine-saved,x-sea-engine-lossy,x-sea-engine-note';
const NOTE = 'x-sea-engine-note';

// q of each media range in an Accept header, in the order given
function ranges(accept) {
  return String(accept || '').split(',').map((s, i) => {
    const [t, ...ps] = s.split(';'); let q = 1;
    for (const p of ps) { const m = /^\s*q\s*=\s*([0-9.]+)\s*$/i.exec(p); if (m) q = Math.max(0, Math.min(1, Number(m[1]) || 0)); }
    return { type: t.trim().toLowerCase(), q, i };
  }).filter((x) => x.type);
}
// an Accept prefers TOON when it names text/toon and rates it above JSON (application/json, else application/*, else */*);
// at the same rate, the one named first wins
export function prefersToon(accept) {
  const r = ranges(accept), toon = r.find((x) => x.type === TOON.media);
  if (!toon || toon.q <= 0) return false;
  const json = r.find((x) => x.type === 'application/json') || r.find((x) => x.type === 'application/*') || r.find((x) => x.type === '*/*');
  return !json || toon.q > json.q || (toon.q === json.q && toon.i < json.i);
}
// did the request ask for TOON? (null: no, and nothing of this module acts). Cheap for every request that did not.
export function toonAsked(req) {
  const raw = req.url, acc = req.headers.get('accept') || '';
  if (!/[?&]fmt=toon(&|#|$)/i.test(raw) && !/text\/toon/i.test(acc)) return null;
  const url = new URL(raw), path = url.pathname.replace(/^\/functions\/v1/, '').replace(/^\/mare(?=\/|$)/, '') || '/';
  if (APP.test(path)) return null;
  const byParam = url.search.slice(1).split('&').some((p) => FMT.test(p));
  if (!byParam && !prefersToon(acc)) return null;
  return { url, path: path.length > 1 ? path.replace(/\/+$/, '') : path, by: byParam ? 'fmt=toon' : 'accept' };
}
// the request the doors answer: the same, without fmt=toon (every other part of the query byte for byte) and asking for JSON
export async function jsonRequest(req, t) {
  const u = new URL(t.url);
  if (t.by === 'fmt=toon') { const rest = u.search.slice(1).split('&').filter((p) => !FMT.test(p)).join('&'); u.search = rest ? `?${rest}` : ''; }
  const h = new Headers(req.headers); h.set('accept', 'application/json');
  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer();
  return new Request(u, { method: req.method, headers: h, ...(body && body.byteLength ? { body } : {}) });
}
const addTo = (h, name, value) => { const v = h.get(name) || ''; if (!new RegExp(`(^|,)\\s*${value}\\s*(,|$)`, 'i').test(v)) h.set(name, v ? `${v}, ${value}` : value); };
const expose = (h) => { const v = h.get('access-control-expose-headers'); h.set('access-control-expose-headers', v ? `${v},${ENGINE_EXPOSE}` : ENGINE_EXPOSE); };
function kept(res, body, why) {
  const h = new Headers(res.headers); h.set(NOTE, why); addTo(h, 'vary', 'accept'); expose(h);
  if (body != null) h.delete('content-length');
  return new Response(body ?? res.body, { status: res.status, statusText: res.statusText, headers: h });
}
// the JSON answer → TOON where it is smaller; count is called with the saving when the request may count
export async function toonAnswer(res, { count } = {}) {
  const type = res.headers.get('content-type') || '';
  if (res.status !== 200 && res.status !== 201) return kept(res, null, `json kept: TOON is for answers with data (status ${res.status})`);
  if (!JSON_TYPE.test(type) || !res.body) return kept(res, null, 'not a JSON answer: sent as it is');
  const text = await res.text();
  let v; try { v = JSON.parse(text); } catch { return kept(res, text, 'json kept: the answer does not parse as JSON'); }
  const rpc = (x) => x && typeof x === 'object' && !Array.isArray(x) && 'jsonrpc' in x;
  if (rpc(v) || (Array.isArray(v) && v.some(rpc))) return kept(res, text, 'json kept: a JSON-RPC envelope stays JSON; the lean MCP door /mcp/lean speaks TOON inside its tool results');
  let toon; try { toon = toToon(v); } catch (e) { return kept(res, text, `json kept: ${String(e?.message || e).replace(/^toon: /, '').replace(/[^\x20-\x7e]/g, '').slice(0, 120)}`); }
  const s = savingOf('toon', { before: text, beforeForm: 'json', after: toon, afterForm: 'toon' });
  if (!(s.saved > 0)) return kept(res, text, `json kept: TOON is not smaller here (${s.after} tokens against ${s.before})`);
  const h = new Headers(res.headers);
  h.set('content-type', TOON.type); h.delete('content-length'); addTo(h, 'vary', 'accept'); expose(h);
  for (const [k, x] of Object.entries(engineHeaders(s))) h.set(k, x);
  try { count?.(s); } catch {}
  return new Response(toon, { status: res.status, statusText: res.statusText, headers: h });
}
