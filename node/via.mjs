// Mare Liberum · via: the addresses the sea hands out lead through the sea
// One key signs what the sea hands out. It is derived from the node's own secret (MARE_VIA_SECRET, else the secret of
// the long memory), so the addresses stay valid across restarts and releases; a node without either draws a key at
// start, and its addresses then live as long as the process. The key never leaves the node.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { netKey } from './guard.mjs';

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
// an address goes through the sea when it is a plain public web address: http or https on the usual ports, no
// template still to be filled ({q}, <task>), no name and password inside, not too long, and not the sea's own
export function wraps(raw, base) {
  const s = String(raw || '');
  if (s.length > VIA.maxUrl || !/^https?:\/\//i.test(s) || /[<>{}\s]/.test(s)) return false;
  let u; try { u = new URL(s); } catch { return false; }
  if (u.username || u.password || (u.port && u.port !== '80' && u.port !== '443')) return false;
  return !ownHost(u.hostname, base);
}
// the via address for a place; q (the task) and p (from a private memory) ride along for the count, never to the place
export function viaUrl(url, { base, q, priv } = {}) {
  const p = new URLSearchParams(); if (q) p.set('q', String(q).slice(0, 120)); if (priv) p.set('p', '1');
  const s = p.toString();
  return `${String(base).replace(/\/+$/, '')}/via/${encodeVia(url)}${s ? `?${s}` : ''}`;
}
// the keys under which the sea hands out addresses (the plain ones, and where /find and /site/<domain> put them)
export const ADDRESS_KEYS = new Set(['url', 'href', 'to', 'go', 'target', 'next', 'path', 'example', 'home']);
// every address under those keys, however deep, becomes a via address. What the sea keeps is never changed: the answer
// is copied where it changes and only there.
export function rewriteForAgents(payload, { base, q, priv, keys = ADDRESS_KEYS } = {}) {
  let n = 0;
  const walk = (v, depth) => {
    if (depth > 14 || v == null || typeof v !== 'object') return v;
    if (Array.isArray(v)) { let out = null; for (let i = 0; i < v.length; i++) { const x = walk(v[i], depth + 1); if (x !== v[i]) { out ||= v.slice(); out[i] = x; } } return out || v; }
    let out = null;
    for (const k of Object.keys(v)) {
      const x = v[k]; let y = x;
      if (typeof x === 'string') { if (keys.has(k) && wraps(x, base)) { y = viaUrl(x, { base, q, priv }); n++; } }
      else if (x && typeof x === 'object') y = walk(x, depth + 1);
      if (y !== x) { out ||= { ...v }; out[k] = y; }
    }
    return out || v;
  };
  const out = walk(payload, 0);
  return n && out && typeof out === 'object' && !Array.isArray(out) && !('via' in out) ? { ...out, via: `${n} address${n === 1 ? '' : 'es'} in this answer lead through the sea (/via/): walking one is counted and strengthens its path. ${String(base).replace(/\/+$/, '')}/via/howto` } : out;
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
