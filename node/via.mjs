// Mare Liberum · via: the addresses the sea hands out lead through the sea
// One key signs what the sea hands out. It is derived from the node's own secret (MARE_VIA_SECRET, else the secret of
// the long memory), so the addresses stay valid across restarts and releases; a node without either draws a key at
// start, and its addresses then live as long as the process. The key never leaves the node.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { netKey } from './guard.mjs';
import { robotsGroups, robotsAllows } from './check.mjs';
import { familyOf } from './route.mjs';

// ---------------------------------------------------------------- the token
// A via token is the address itself, a dot, and the first 6 bytes of HMAC-SHA256 over the address with the node's key,
// written as URL-safe base64 without padding. Anyone can read where a token leads (it is no secret and no disguise);
// only the node can make one, so the proxy carries nothing but addresses the sea itself handed out.
export const VIA = { maxUrl: 2048, macBytes: 6 };
export function encodeVia(url, key = viaKey()) {
  const u = Buffer.from(String(url), 'utf8');
  const mac = createHmac('sha256', key).update(u).digest().subarray(0, VIA.macBytes);
  return Buffer.concat([u, Buffer.from('.'), mac]).toString('base64url');
}
// → null (not a token at all), { ok: false, url } (shaped like one, but not signed by this node) or { ok: true, url }
export function decodeVia(token, key = viaKey()) {
  const s = String(token || '');
  if (!/^[A-Za-z0-9_-]{12,6000}$/.test(s)) return null;
  const b = Buffer.from(s, 'base64url');
  if (b.length < VIA.macBytes + 9 || b[b.length - VIA.macBytes - 1] !== 0x2e) return null;
  const u = b.subarray(0, b.length - VIA.macBytes - 1), mac = b.subarray(b.length - VIA.macBytes);
  let url; try { url = new TextDecoder('utf-8', { fatal: true }).decode(u); } catch { return null; }
  if (!/^https?:\/\/[^\s]+$/i.test(url)) return null;
  const want = createHmac('sha256', key).update(u).digest().subarray(0, VIA.macBytes);
  return timingSafeEqual(mac, want) ? { ok: true, url } : { ok: false, url };
}

// ---------------------------------------------------------------- which addresses go through the sea
// the sea's own addresses stay as they are: its doors, the links an agent posts to (worked_it, failed_it, lay, settle)
const OWN = new Set(['mareliberum.dev', 'www.mareliberum.dev', 'hz.mareliberum.dev', 'mare-liberum.vercel.app']);
export function ownHost(host, base) { const h = String(host || '').toLowerCase(); let b = ''; try { b = new URL(base).hostname.toLowerCase(); } catch {} return OWN.has(h) || (b && h === b); }
// what always stays as it is, wherever it stands in an answer. Every address of the sea itself (above): the routes an
// agent writes to (/lay, /via/mare:…, worked_it, failed_it, /m/…, /settle, /job, /rate, /d/…/worked), /works.json,
// /llms.txt, the skill and the pages; and templates still to be filled (<task>, {q}). Besides those:
export const VIA_EXCLUDE = [
  /^https:\/\/(buy|checkout|billing|pay)\.stripe\.com\//i, // a payment page needs its own origin, cookies and scripts; a sandboxed copy breaks it
  /^https:\/\/(github\.com|raw\.githubusercontent\.com)\/daoudandiaye98-alt\/mare-liberum(\/|$)/i, // the sea's own code: skills, examples
];
// an address goes through the sea when it is a plain public web address: http or https on the usual ports, no
// template still to be filled ({q}, <task>), no name and password inside, not too long, and not the sea's own
export function wraps(raw, base) { return !!wrapTarget(raw, base); }
// the address as the sea carries it: written the way the web writes it (percent-encoded, plain ASCII), or null
export function wrapTarget(raw, base) {
  const s = String(raw || '');
  if (s.length > VIA.maxUrl || !/^https?:\/\//i.test(s) || /[<>{}\s]/.test(s)) return null;
  let u; try { u = new URL(s); } catch { return null; }
  if (u.username || u.password || (u.port && u.port !== '80' && u.port !== '443') || u.href.length > VIA.maxUrl) return null;
  return ownHost(u.hostname, base) || VIA_EXCLUDE.some((x) => x.test(u.href)) ? null : u.href;
}
// the via address for a place; q (the task) and p (from a private memory) ride along for the count, never to the place.
// c (the minute) marks an address handed out by a door the sea already counted the click at (/d/…, /go/…): the walk
// that follows within two minutes is carried as always, but not counted a second time
// m marks an address the sea handed out as a commission link, said so where it stands (commission: true in JSON, the words
// beside the link on a page; node/commission.mjs): only such an address may carry a commission when a person opens it
export function viaUrl(url, { base, q, priv, counted, m } = {}) {
  const p = new URLSearchParams(); if (q) p.set('q', String(q).slice(0, 120)); if (priv) p.set('p', '1'); if (counted) p.set('c', String(Math.floor(counted / 60000))); if (m) p.set('m', '1');
  const s = p.toString();
  return `${String(base).replace(/\/+$/, '')}/via/${encodeVia(url)}${s ? `?${s}` : ''}`;
}
// the keys under which the sea hands out addresses (the plain ones, and where /find and /site/<domain> put them)
export const ADDRESS_KEYS = new Set(['url', 'href', 'to', 'go', 'target', 'next', 'path', 'example', 'home']);
// every address under those keys, however deep, becomes a via address; with anyKey every value that is a whole web
// address does, under any key and inside lists (the map of a site: /site/<domain>). What the sea keeps is never
// changed: the answer is copied where it changes and only there.
// cm (node/commission.mjs, only where the operator turned commissions on): an object whose address leads to a place that
// pays the sea a commission when a person buys there says so (commission: true, commission_network), and the answer says
// the rule once; the address itself stays the via address (the commission is added when a person's browser opens it)
export function rewriteForAgents(payload, { base, q, priv, keys = ADDRESS_KEYS, anyKey = false, cm, rule } = {}) {
  let n = 0, marked = 0, net = null;
  const swap = (x) => { const t = wrapTarget(x, base); if (!t) return x; n++; let c = null; if (cm) { c = cm(t); if (c) { marked++; net = c.network; } } return viaUrl(t, { base, q, priv, m: !!c }); };
  const walk = (v, depth) => {
    if (depth > 14 || v == null || typeof v !== 'object') return v;
    if (Array.isArray(v)) { let out = null; for (let i = 0; i < v.length; i++) { const x = v[i], y = typeof x === 'string' ? (anyKey ? swap(x) : x) : walk(x, depth + 1); if (y !== x) { out ||= v.slice(); out[i] = y; } } return out || v; }
    let out = null, mine = null;
    for (const k of Object.keys(v)) {
      const x = v[k]; let y = x;
      if (typeof x === 'string') { if (anyKey || keys.has(k)) { const m0 = marked; y = swap(x); if (marked > m0 && !mine) mine = net; } }
      else if (x && typeof x === 'object') y = walk(x, depth + 1);
      if (y !== x) { out ||= { ...v }; out[k] = y; }
    }
    // an object that already names a commission of its own (a catalog's promoted offer) keeps what it says
    if (mine && out && out.commission === undefined) { out.commission = true; out.commission_network = mine; }
    return out || v;
  };
  const out = walk(payload, 0);
  const told = n && out && typeof out === 'object' && !Array.isArray(out) && !('via' in out) ? { ...out, via: `${n} address${n === 1 ? '' : 'es'} in this answer lead through the sea (/via/): walking one is counted and strengthens its path. ${String(base).replace(/\/+$/, '')}/via/howto` } : out;
  return marked && rule && told && typeof told === 'object' && !Array.isArray(told) ? { ...told, commission_rule: rule } : told;
}

let KEY = null;
export function viaKey(env = process.env) {
  if (KEY) return KEY;
  const root = String(env.MARE_VIA_SECRET || env.MARE_DB_SECRET || '');
  KEY = root.length >= 16 ? createHmac('sha256', root).update('mare-via-v1').digest() : randomBytes(32);
  return KEY;
}
// for the proofs: a key of their own
export function setViaKey(k) { KEY = k ? Buffer.from(k) : null; }

// who walked, without keeping who: the program and the network of the caller, salted per day with the node's key.
// The same caller on the same day gives the same hash (so "it worked" finds its own walk); nobody can turn it back.
export function callerHash(ip, ua, day = new Date().toISOString().slice(0, 10)) {
  return createHmac('sha256', viaKey()).update(`caller|${netKey(ip || 'unknown')}|${String(ua || '').slice(0, 300)}|${day}`).digest('hex').slice(0, 16);
}
// today's and yesterday's: a report that comes after midnight still finds the walk
export function callerHashes(ip, ua, t = Date.now()) {
  return [0, 1].map((d) => callerHash(ip, ua, new Date(t - d * 864e5).toISOString().slice(0, 10)));
}

// ---------------------------------------------------------------- the proxy: GET or POST /via/<token>
// The sea carries one request to the place the token names and hands back what the place answered, so that every
// address it gave out leads through it. What it will not do:
//   carry anything it did not sign itself (the token), reach inside a network (the gate on the way out, node/guard.mjs,
//   checks every connection after the name is resolved), use other ports than 80 and 443, wait longer than 15 seconds,
//   carry more than 2 MB, follow a redirect blindly (a redirect comes back as a new /via/ address), pass on cookies or
//   credentials in either direction, let what it carries run scripts under the sea's name (sandbox), stand in for a
//   website in a search index (crawlers are sent to the place itself), or read a page whose site asks programs not to
//   (robots.txt, for HTML pages; data APIs are made for programs).
// Each address may walk 600 times an hour; the brain stays free beyond that.

export const PROXY = { timeoutMs: 15000, maxBytes: 2 * 1024 * 1024, perHour: 600, inFlight: 32, robotsMs: 5000, robotsTtlMs: 3600e3 };
export const VIA_UA = 'MareLiberum-Via/1.0 (+https://mareliberum.dev/via/howto; carries one request for an agent)';
export const VIA_TOKEN = 'MareLiberum-Via';
// what an agent's request may carry on to the place, and what the place's answer may carry back
const SEND = ['accept', 'accept-language', 'content-type', 'payment-signature', 'x-payment'];
const KEEP = ['content-type', 'content-language', 'content-disposition', 'last-modified', 'etag', 'retry-after', 'payment-required', 'payment-response', 'x-payment-response', 'x402-payment-required'];
const VIA_CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type,accept,payment-signature,x-payment', 'access-control-expose-headers': 'x-via,x-via-target,payment-required,payment-response,x-payment-response,x402-payment-required,retry-after' };
const pace = new Map(), robotsSeen = new Map();
let inFlight = 0;
export const proxyState = () => ({ inFlight, paced: pace.size, robotsKnown: robotsSeen.size });

const answer = (status, body, extra = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow', 'x-via': 'mare-liberum', ...VIA_CORS, ...extra } });
// the pace of one address: 600 walks in the hour it is in
function paced(ip, now) {
  const hour = Math.floor(now / 3600e3), k = `${netKey(ip || 'unknown')}|${hour}`, n = (pace.get(k) || 0) + 1;
  pace.delete(k); pace.set(k, n); if (pace.size > 100_000) pace.delete(pace.keys().next().value);
  return n > PROXY.perHour ? Math.max(1, Math.ceil(((hour + 1) * 3600e3 - now) / 1000)) : 0;
}
// a body, read up to the limit; null when the place sends more
async function capped(body, max) {
  if (!body) return Buffer.alloc(0);
  const reader = body.getReader(), parts = []; let size = 0;
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength; if (size > max) { try { await reader.cancel(); } catch {} return null; }
    parts.push(value);
  }
  return Buffer.concat(parts.map((p) => Buffer.from(p.buffer, p.byteOffset, p.byteLength)), size);
}
// whether a site lets this program read a page: its robots.txt, once an hour per site; a site without one, or one
// that does not answer, lets it (as the reader does it)
async function robotsLet(u, get) {
  const origin = u.origin, seen = robotsSeen.get(origin), now = Date.now();
  let groups = seen && now - seen.at < PROXY.robotsTtlMs ? seen.groups : undefined;
  if (groups === undefined) {
    groups = null;
    try {
      const r = await get(`${origin}/robots.txt`, { redirect: 'follow', signal: AbortSignal.timeout(PROXY.robotsMs), headers: { 'user-agent': VIA_UA, accept: 'text/plain' } });
      const txt = r.status === 200 ? (await r.text()).slice(0, 300_000) : ''; if (r.status !== 200) await r.body?.cancel?.().catch(() => {});
      if (txt && !/^\s*</.test(txt)) groups = robotsGroups(txt);
    } catch {}
    robotsSeen.set(origin, { groups, at: now }); if (robotsSeen.size > 5000) robotsSeen.delete(robotsSeen.keys().next().value);
  }
  return !groups || robotsAllows(groups, VIA_TOKEN, u.pathname + u.search).allowed !== false;
}

// a person: a browser that navigates to the address because someone clicked it (not a prefetch, not a script, not a crawler)
export function isPerson(headers, kind) {
  const h = (k) => String(headers?.get?.(k) || '').toLowerCase();
  return kind === 'browser' && h('sec-fetch-mode') === 'navigate' && h('sec-fetch-dest') === 'document' && h('sec-fetch-user') === '?1' && !/prefetch|prerender/.test(h('sec-purpose') || h('purpose'));
}
// → a Response, or null when the path holds no token (the caller then answers as before: invitations and the guide)
// person and commission (node/commission.mjs): where the operator turned commissions on, a person's browser goes to the
// place itself (302), with the commission added where one applies; otherwise nothing here changes
export async function viaProxy({ req, token, base, ip, ua, readOnly = false, onHit, onWalk, get = (...a) => fetch(...a), now = Date.now, person = false, commission = null }) {
  const d = decodeVia(token);
  if (!d) return null;
  const at = new URL(req.url), q = (at.searchParams.get('q') || '').replace(/[\p{Cc}\p{Cf}]/gu, ' ').trim().slice(0, 120) || null, priv = at.searchParams.get('p') === '1';
  // handed out by a door that counted the click a moment ago: carried, not counted again
  const minute = Number(at.searchParams.get('c')), counted = Number.isInteger(minute) && minute > 0 && Math.abs(Math.floor(now() / 60000) - minute) <= 2;
  const brain = `${base}/brain?q=${encodeURIComponent(q || '<your task>')}`;
  if (!d.ok) return answer(403, { error: { code: 'BAD_TOKEN', message: 'this via address was not made by this sea (or was changed on the way); ask the brain for fresh addresses' }, hint: brain });
  let u; try { u = new URL(d.url); } catch { return answer(400, { error: { code: 'INVALID_ARGUMENT', message: 'the address in this token cannot be read' }, hint: brain }); }
  const target = u.href;
  if (!/^https?:$/.test(u.protocol)) return answer(400, { error: { code: 'INVALID_ARGUMENT', message: 'the sea carries http and https only' }, hint: brain });
  if (u.port && u.port !== '80' && u.port !== '443') return answer(400, { error: { code: 'INVALID_ARGUMENT', message: 'the sea carries requests to the ports 80 and 443 only' }, direct: d.url, hint: brain });
  // a crawler or a search engine is sent to the place itself: the sea carries requests for agents with a task and does
  // not stand in for other websites in an index
  if (readOnly) return new Response(null, { status: 302, headers: { location: target, 'cache-control': 'public, max-age=3600', 'x-robots-tag': 'noindex, nofollow', 'x-via': 'mare-liberum', 'x-via-target': target, ...VIA_CORS } });
  const host = u.hostname.toLowerCase().replace(/^www\./, ''), who = callerHash(ip, ua);
  const hit = (status, outcome = null) => { if (counted) return; try { onHit?.(priv ? { kind: 'walk', q: null, ua_hash: who, token_host: null, target_domain: null, status, outcome } : { kind: 'walk', q, ua_hash: who, token_host: host, target_domain: familyOf(host), status, outcome }); } catch {} };
  const wait = paced(ip, now());
  if (wait) return answer(429, { error: { code: 'RESOURCE_EXHAUSTED', message: `this address walked ${PROXY.perHour} via addresses this hour; the next hour opens in ${wait} seconds` }, free: `the brain is free and has no such limit: ${brain}`, direct: d.url }, { 'retry-after': String(wait) });
  // a person who clicked goes to the place itself, where commissions are on: a carried copy cannot be bought from, and
  // only a person's own browser can carry a shop's commission. The walk is counted as any walk; the sea fetches nothing
  // (it never opens a commission link itself), and the place's link carries the commission where one applies
  if (person && typeof commission === 'function') {
    // a commission only on an address the sea handed out as a commission link, said so where it stood (m): every other
    // address leads the person to the place as it is
    let c = null; if (at.searchParams.get('m') === '1') { try { c = commission(target); } catch {} }
    hit(302);
    if (!priv) { try { onWalk?.(d.url, q); } catch {} }
    return new Response(null, { status: 302, headers: { location: c?.url || target, 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow', 'x-via': 'mare-liberum', 'x-via-target': target, ...(c ? { 'x-via-commission': c.network } : {}), ...VIA_CORS } });
  }
  if (inFlight >= PROXY.inFlight) return answer(503, { error: { code: 'UNAVAILABLE', message: 'the sea is carrying many requests at this moment; try again in a few seconds' }, direct: d.url, hint: brain }, { 'retry-after': '2' });
  inFlight++;
  try {
    const method = req.method === 'POST' ? 'POST' : 'GET';
    const headers = { 'user-agent': VIA_UA };
    for (const h of SEND) { const v = req.headers.get(h); if (v) headers[h] = v.slice(0, 8000); }
    let body; if (method === 'POST') { try { body = Buffer.from(await req.arrayBuffer()); } catch { body = undefined; } if (body && body.length > 1024 * 1024) return answer(413, { error: { code: 'TOO_LARGE', message: 'the sea carries at most 1 MB to a place' } }); }
    let r;
    try { r = await get(target, { method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(PROXY.timeoutMs) }); }
    catch (e) {
      hit(502);
      const why = e?.name === 'TimeoutError' || e?.name === 'AbortError' ? `did not answer within ${PROXY.timeoutMs / 1000} seconds` : /EGRESS_REFUSED|host_private/.test(`${e?.code} ${e?.message} ${e?.cause?.code} ${e?.cause?.message}`) ? 'is not a public address' : 'could not be reached';
      return answer(502, { error: { code: 'VIA_UPSTREAM', message: `the place ${why}` }, target: d.url, hint: `the brain is free and knows other paths: ${brain}` });
    }
    // a redirect comes back as a new via address (or as the sea's own address); it is never followed blindly
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
      await r.body?.cancel?.().catch(() => {});
      let next = null; try { next = new URL(r.headers.get('location'), target).href; } catch {}
      hit(r.status);
      if (next && wraps(next, base)) return new Response(null, { status: r.status, headers: { location: viaUrl(next, { base, q, priv }), 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow', 'x-via': 'mare-liberum', 'x-via-target': target, ...VIA_CORS } });
      if (next && /^https?:/i.test(next)) { try { if (ownHost(new URL(next).hostname, base)) return new Response(null, { status: r.status, headers: { location: next, 'cache-control': 'no-store', 'x-via': 'mare-liberum', ...VIA_CORS } }); } catch {} }
      return answer(502, { error: { code: 'VIA_REDIRECT', message: 'the place sends you on to an address the sea does not carry (another port, a name and password, or not http)' }, redirect: next, target: d.url, hint: brain });
    }
    if (Number(r.headers.get('content-length')) > PROXY.maxBytes) { await r.body?.cancel?.().catch(() => {}); hit(502); return answer(502, { error: { code: 'TOO_LARGE', message: 'the answer of the place is larger than 2 MB; fetch it yourself' }, direct: d.url, hint: brain }); }
    let buf; try { buf = await capped(r.body, PROXY.maxBytes); } catch (e) { hit(502); return answer(502, { error: { code: 'VIA_UPSTREAM', message: e?.name === 'TimeoutError' || e?.name === 'AbortError' ? `the place did not finish its answer within ${PROXY.timeoutMs / 1000} seconds` : 'the answer of the place broke off' }, target: d.url, hint: brain }); }
    if (!buf) { hit(502); return answer(502, { error: { code: 'TOO_LARGE', message: 'the answer of the place is larger than 2 MB; fetch it yourself' }, direct: d.url, hint: brain }); }
    if (r.status >= 500) { hit(502); return answer(502, { error: { code: 'VIA_UPSTREAM', message: `the place answered ${r.status}` }, status: r.status, target: d.url, hint: `the brain is free and knows other paths: ${brain}` }); }
    const type = r.headers.get('content-type') || '';
    if (method === 'GET' && r.status === 200 && /text\/html|application\/xhtml\+xml/i.test(type) && !(await robotsLet(u, get))) {
      hit(403, 'robots');
      return answer(403, { error: { code: 'ROBOTS', message: 'this site asks programs like the sea not to read this page (robots.txt); the sea does not carry it' }, direct: d.url, hint: brain });
    }
    hit(r.status);
    // the walk strengthens the path to this place (behind the answer)
    if (!priv && r.status < 400) { try { onWalk?.(d.url, q); } catch {} }
    const out = { 'x-via': 'mare-liberum', 'x-via-target': target, 'cache-control': method === 'GET' && r.status === 200 ? 'public, max-age=300' : 'no-store', 'x-robots-tag': 'noindex, nofollow',
      'content-security-policy': 'sandbox', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', ...VIA_CORS };
    for (const h of KEEP) { const v = r.headers.get(h); if (v) out[h] = v; }
    if (!out['content-type']) out['content-type'] = 'application/octet-stream';
    return new Response(r.status === 204 || r.status === 304 ? null : buf, { status: r.status, headers: out });
  } finally { inFlight--; }
}
