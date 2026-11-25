// Mare Liberum · the engine on every JSON door (since 3.35): TOON (lever "toon") and projection (lever "fields"), in one
// place, the outermost layer of handle in node/core.mjs. Nobody else sees any change: a request that does not ask never
// reaches this module and its answer is byte for byte what it was. An agent asks with
//   fmt=toon, or an Accept that prefers text/toon over application/json: the answer as TOON (node/toon.mjs, spec 4.4),
//     lossless, sent only where it is at least TOON_MIN_GAIN (20 %) fewer tokens than the compact JSON of the same answer;
//     else the compact JSON, and x-sea-engine-note says why;
//   fields=a,b.c (comma-separated dotted paths; an array is projected element by element): only those members, lossy and
//     said so (x-sea-engine-lossy); a path that is not there gives nothing, never an error; the fair receipt always stays.
//   Both together: the projection first, then TOON where it pays.
// The doors answer JSON as always (asked with Accept: application/json and without these parameters, so a door that
// answers both ways answers its data), with their fair receipt and headers; every header stays. Measured by the one rule
// (savingOf, node/engine.mjs) against the compact JSON of the answer, counted through the ledger (countEngine) under the
// rules of /savings: never the sea's own calls, never crawlers, never HEAD; the house agent apart.
// Left alone, byte for byte: error answers (every status but 200 and 201), answers that carry x-sea-engine already
// (a door of the engine has its own forms, e.g. /compress), and the app door (/mcp/app, rule 4); /compress is not asked at
// all. JSON-RPC envelopes stay JSON (the lean MCP door /mcp/lean speaks TOON inside its tool results instead).
// Validators: this layer hashes nothing. A TOON answer carries the door's tag marked as its own ("<tag>.toon", weak stays
// weak), an If-None-Match with such a tag is asked of the door as the JSON tag it came from, a 304 passes through; an
// answer whose bytes the layer changed otherwise (a projection, compact JSON) carries no ETag.
import { toToon, TOON, TOON_MIN_GAIN } from './toon.mjs';
import { savingOf, engineHeaders } from './engine.mjs';

// left alone: the app door, /compress (its own forms), and the reader /r/<address>, whose query belongs to the page it reads
const LEFT_ALONE = /^\/(mcp\/app|compress|r)(\/|$)/;
const JSON_TYPE = /^application\/(json|[a-z.+-]*\+json)\s*(;|$)/i;
const FMT = /^fmt=toon$/i, FIELDS = /^fields=/i;
export const ENGINE_EXPOSE = 'x-sea-engine,x-sea-engine-tokens,x-sea-engine-saved,x-sea-engine-lossy,x-sea-engine-note';
const NOTE = 'x-sea-engine-note';
export const toonTag = (t) => String(t).trim().replace(/^(W\/)?"(.*)"$/, (m, w, x) => (x.endsWith('.toon') ? m : `${w || ''}"${x}.toon"`));
export const jsonTag = (t) => String(t).trim().replace(/^(W\/)?"(.*)\.toon"$/, (m, w, x) => `${w || ''}"${x}"`);

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

// ------------------------------------------------------------------ fields=: the members an agent names
const put = (o, k, v) => { if (k === '__proto__') Object.defineProperty(o, k, { value: v, enumerable: true, writable: true, configurable: true }); else o[k] = v; };
// "a,b.c,results.url" → a tree of Maps (true: the whole member); at most 64 paths of at most 12 steps
export function fieldsOf(spec) {
  const tree = new Map(); let n = 0;
  for (const raw of String(spec || '').slice(0, 2000).split(',')) {
    const steps = raw.split('.').map((x) => x.trim()).filter(Boolean).slice(0, 12);
    if (!steps.length) continue;
    if (++n > 64) break;
    let node = tree;
    for (let i = 0; i < steps.length; i++) {
      const k = steps[i], at = node.get(k);
      if (at === true) break; // the whole member is named already
      if (i === steps.length - 1) { node.set(k, true); break; }
      if (!at) { const m = new Map(); node.set(k, m); node = m; } else node = at;
    }
  }
  return tree.size ? tree : null;
}
// the value with only the named members, in their own order; an array element by element; nothing where a path is not
export function project(v, node) {
  if (node === true) return v;
  if (Array.isArray(v)) return v.map((x) => project(x, node)).filter((x) => x !== undefined);
  if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) { const sub = node.get(k); if (sub === undefined) continue; const p = project(v[k], sub); if (p !== undefined) put(o, k, p); } return o; }
  return undefined;
}

// ------------------------------------------------------------------ TOON where it pays
// a JSON value as an agent reads it: TOON when that is at least TOON_MIN_GAIN fewer tokens than its compact JSON, else the
// compact JSON (also the text of the lean MCP door's tool results, node/leanmcp.mjs)
export function toonOrJson(v) {
  const json = JSON.stringify(v);
  if (json === undefined) return { text: json, form: 'json', saving: null, why: 'nothing to encode' };
  let toon; try { toon = toToon(JSON.parse(json)); } catch (e) { return { text: json, form: 'json', saving: null, why: String(e?.message || e).replace(/^toon: /, '').replace(/[^\x20-\x7e]/g, '').slice(0, 120) }; }
  const s = savingOf('toon', { before: json, beforeForm: 'json', after: toon, afterForm: 'toon' });
  return s.saved > 0 && s.saved >= TOON_MIN_GAIN * s.before ? { text: toon, form: 'toon', saving: s }
    : { text: json, form: 'json', saving: null, why: `TOON would be ${s.after} tokens against ${s.before} of compact JSON, less than ${Math.round(TOON_MIN_GAIN * 100)} % fewer` };
}

// ------------------------------------------------------------------ the ask
// did the request ask the engine? (null: no, and nothing of this module acts). Cheap for every request that did not.
export function toonAsked(req) {
  const raw = req.url, acc = req.headers.get('accept') || '';
  if (!/[?&](fmt=toon|fields=)/i.test(raw) && !/text\/toon/i.test(acc)) return null;
  const url = new URL(raw), path = url.pathname.replace(/^\/functions\/v1/, '').replace(/^\/mare(?=\/|$)/, '') || '/';
  if (LEFT_ALONE.test(path)) return null;
  const parts = url.search.slice(1).split('&');
  const byParam = parts.some((p) => FMT.test(p)), toon = byParam || prefersToon(acc);
  const fields = parts.some((p) => FIELDS.test(p)) ? fieldsOf(url.searchParams.getAll('fields').join(',')) : null;
  if (!toon && !fields) return null;
  return { url, path: path.length > 1 ? path.replace(/\/+$/, '') : path, by: byParam ? 'fmt=toon' : toon ? 'accept' : 'fields', toon, fields };
}
// the request the doors answer: the same, without fmt=toon and fields= (every other part of the query byte for byte) and
// asking for JSON
export async function jsonRequest(req, t) {
  const u = new URL(t.url);
  const rest = u.search.slice(1).split('&').filter((p) => p && !FMT.test(p) && !FIELDS.test(p)).join('&'); u.search = rest ? `?${rest}` : '';
  const h = new Headers(req.headers); h.set('accept', 'application/json');
  const inm = h.get('if-none-match'); if (inm) { t.heldToon = /\.toon"/.test(inm); h.set('if-none-match', inm.split(',').map(jsonTag).join(', ')); }
  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer();
  return new Request(u, { method: req.method, headers: h, ...(body && body.byteLength ? { body } : {}) });
}

// ------------------------------------------------------------------ the answer
const addTo = (h, name, value) => { const v = h.get(name) || ''; if (!new RegExp(`(^|,)\\s*${value}\\s*(,|$)`, 'i').test(v)) h.set(name, v ? `${v}, ${value}` : value); };
const expose = (h) => { const v = h.get('access-control-expose-headers'); h.set('access-control-expose-headers', v ? `${v},${ENGINE_EXPOSE}` : ENGINE_EXPOSE); };
const shaped = (res, body, { type, note, saving, etag = 'drop' }) => {
  const h = new Headers(res.headers); h.delete('content-length'); addTo(h, 'vary', 'accept'); expose(h);
  if (type) h.set('content-type', type);
  if (note) h.set(NOTE, note);
  if (saving) for (const [k, x] of Object.entries(engineHeaders(saving))) h.set(k, x);
  const e = h.get('etag'); if (e) { if (etag === 'toon') h.set('etag', toonTag(e)); else if (etag === 'drop') h.delete('etag'); }
  return new Response(body, { status: res.status, statusText: res.statusText, headers: h });
};
// the JSON answer → the shape the agent asked for; count is called with each saving when the request may count
export async function toonAnswer(res, { count, heldToon = false, toon = true, fields = null } = {}) {
  // a door of the engine shaped it already: left alone
  if (res.headers.has('x-sea-engine')) return res;
  // not modified: the client holds what it named; a TOON tag it sent comes back as the TOON tag
  if (res.status === 304) { if (!heldToon || !res.headers.get('etag')) return res; const h = new Headers(res.headers); h.set('etag', toonTag(h.get('etag'))); return new Response(null, { status: 304, statusText: res.statusText, headers: h }); }
  // an error: left alone
  if (res.status !== 200 && res.status !== 201) return res;
  const type = res.headers.get('content-type') || '';
  if (!JSON_TYPE.test(type) || !res.body) return shaped(res, res.body, { note: 'not a JSON answer: sent as it is', etag: 'keep' });
  const text = await res.text();
  let v; try { v = JSON.parse(text); } catch { return shaped(res, text, { note: 'json kept: the answer does not parse as JSON', etag: 'keep' }); }
  const rpc = (x) => x && typeof x === 'object' && !Array.isArray(x) && 'jsonrpc' in x;
  if (rpc(v) || (Array.isArray(v) && v.some(rpc))) return shaped(res, text, { note: 'json kept: a JSON-RPC envelope stays JSON; the lean MCP door /mcp/lean answers in text', etag: 'keep' });
  // fields=: the projection, measured against the compact JSON of the whole answer (lossy)
  let w = v, sF = null;
  if (fields && v !== null && typeof v === 'object') {
    w = project(v, fields);
    if (!Array.isArray(v) && Object.prototype.hasOwnProperty.call(v, 'receipt') && !Object.prototype.hasOwnProperty.call(w, 'receipt')) put(w, 'receipt', v.receipt); // the fair receipt always stays
    sF = savingOf('fields', { before: JSON.stringify(v), beforeForm: 'json', after: JSON.stringify(w), afterForm: 'json', lossy: true });
    if (!(sF.saved > 0)) sF = null;
  }
  const json = JSON.stringify(w);
  // TOON where it pays, else the compact JSON
  const t = toon ? toonOrJson(w) : { text: json, form: 'json', saving: null };
  const sT = t.form === 'toon' ? t.saving : null;
  const note = toon && !sT ? `json: ${t.why}` : fields && !sF ? 'fields: nothing was left out' : null;
  for (const s of [sF, sT]) if (s) try { count?.(s); } catch {}
  const saving = sF && sT ? { lever: 'fields,toon', before: sF.before, after: sT.after, saved: sF.saved + sT.saved, lossy: true } : sF || sT;
  // nothing changed in the bytes: the answer as it came, with the note
  if (!fields && !sT && json === text) return shaped(res, text, { note, etag: 'keep' });
  return shaped(res, t.text, { type: sT ? TOON.type : null, note, saving, etag: sT && !fields ? 'toon' : 'drop' });
}
