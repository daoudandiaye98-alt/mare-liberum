// Mare Liberum · via: the addresses the sea hands out lead through the sea
// One key signs what the sea hands out. It is derived from the node's own secret (MARE_VIA_SECRET, else the secret of
// the long memory), so the addresses stay valid across restarts and releases; a node without either draws a key at
// start, and its addresses then live as long as the process. The key never leaves the node.
import { createHmac, randomBytes } from 'node:crypto';
import { netKey } from './guard.mjs';

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
