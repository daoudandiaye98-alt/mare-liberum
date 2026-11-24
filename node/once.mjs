// Mare Liberum · once a day: what was already counted today, per caller network, kept in memory only
// A count that one address could repeat in a loop (a page read as Markdown, a solved part handed out) counts once per
// network (an IPv4 address, an IPv6 /64), kind and subject (the page, the task) and UTC day, and one network adds at most
// `cap` counts of a group a day. The table is a fixed array of salted 32-bit hashes (2 MB), drawn anew every day and never
// written down; when it is full, or a hash collides, nothing new counts: the count errs low, never high.
import { netKey } from './guard.mjs';

const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; };
export const ONCE = { bits: 19, probes: 16, fill: 0.75, nets: 200_000 };

export function createOnce({ bits = ONCE.bits, now = () => new Date().toISOString() } = {}) {
  const size = 1 << bits, mask = size - 1;
  let day = '', salt = '', keys = new Uint32Array(size), used = 0, nets = new Map();
  const roll = () => { const d = String(now()).slice(0, 10); if (d !== day) { day = d; salt = crypto.randomUUID(); keys = new Uint32Array(size); used = 0; nets = new Map(); } };
  // true when the hash was not in the table and could be put there
  const put = (h) => {
    h = h || 1;
    for (let i = 0, j = h & mask; i < ONCE.probes; i++, j = (j + 1) & mask) {
      if (keys[j] === h) return false;
      if (keys[j] === 0) { if (used >= size * ONCE.fill) return false; keys[j] = h; used++; return true; }
    }
    return false;
  };
  return {
    // the first time today that this network brings this kind of count for this subject (and it is under its cap)
    first(ip, kind, subject, { cap = Infinity, group = kind } = {}) {
      roll();
      const net = netKey(ip), g = `${net}|${group}`, n = nets.get(g) || 0;
      if (n >= cap || (!nets.has(g) && nets.size >= ONCE.nets)) return false;
      if (!put(fnv(`${salt}|${net}|${kind}|${String(subject ?? '').slice(0, 300)}`))) return false;
      nets.set(g, n + 1);
      return true;
    },
    size: () => used,
  };
}
// the subject of a count: a page by its site and path (its query and fragment left out, so a loop over ?x=1, ?x=2 … is one
// page), a task by its words (case and spaces left out)
export const pageSubject = (p) => { const s = String(p || ''); try { const u = new URL(s, 'https://x.invalid'); return `${u.host === 'x.invalid' ? '' : u.host.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '') || '/'}`; } catch { return s.split(/[?#]/)[0]; } };
export const taskSubject = (q) => String(q || '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 200);
