// Mare Liberum · the country a caller stands in
// The node counts its visitors by country and nothing finer. Behind a CDN the country came with every request; a node
// that stands alone looks it up itself, in one small table that travels with the build. The table is made from the
// free IP to Country Lite database by DB-IP (https://db-ip.com, CC BY 4.0).
//   file: gzip of one JSON line { v, at, cc: [codes], v4, v6 } followed by
//         v4 starts (uint32 LE × v4) · v4 country (uint8 × v4) · v6 starts, first 64 bits (uint64 LE × v6) · v6 country (uint8 × v6)
//   a row says: from this address on, this country (255 = unknown) until the next row begins
import { readFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';

const NONE = 255;
const v4Of = (s) => { const p = String(s).split('.'); if (p.length !== 4) return -1; let n = 0; for (const x of p) { if (!/^\d{1,3}$/.test(x) || +x > 255) return -1; n = n * 256 + +x; } return n; };
// the first 64 bits of an IPv6 address (the network a caller stands in), or null
function hi64(s) {
  s = String(s).split('%')[0];
  const halves = s.split('::'); if (halves.length > 2 || s.includes('.')) return null;
  const head = halves[0] ? halves[0].split(':') : [], tail = halves.length === 2 ? (halves[1] ? halves[1].split(':') : []) : null;
  if (tail === null ? head.length !== 8 : head.length + tail.length > 7) return null;
  const g = tail === null ? head : [...head, ...Array(8 - head.length - tail.length).fill('0'), ...tail];
  let n = 0n;
  for (let i = 0; i < 4; i++) { if (!/^[0-9a-f]{1,4}$/i.test(g[i])) return null; n = (n << 16n) | BigInt(parseInt(g[i], 16)); }
  return n;
}
// an IPv4 address written inside an IPv6 one (::ffff:203.0.113.9) is looked up as IPv4
const mapped = (s) => /^::(?:ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(s)?.[1];

// rows: [first address, last address, country code] as text, IPv4 and IPv6 mixed → the packed table
export function packGeo(rows, at = '') {
  const codes = [], idx = new Map();
  const cIdx = (c) => { c = String(c || '').toUpperCase(); if (!/^[A-Z]{2}$/.test(c) || c === 'ZZ') return NONE; if (!idx.has(c)) { if (codes.length >= NONE) return NONE; idx.set(c, codes.length); codes.push(c); } return idx.get(c); };
  const a4 = [], a6 = [];
  for (const [s, e, c] of rows) {
    const n = v4Of(s);
    if (n >= 0) { const z = v4Of(e); if (z >= n) a4.push([n, z, cIdx(c)]); continue; }
    const h = hi64(s), z = hi64(e); if (h !== null && z !== null && z >= h) a6.push([h, z, cIdx(c)]);
  }
  // rows in order; a gap between two rows becomes a row of its own that says "unknown"; neighbours of one country join
  const walk = (list, zero, one, max) => {
    list.sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0));
    const starts = [], cc = []; let next = zero, last = -1;
    const put = (s, c) => { if (c === last) return; starts.push(s); cc.push(c); last = c; };
    for (const [s, e, c] of list) {
      if (s < next) continue; // a row that begins inside the one before it is left out
      if (s > next) put(next, NONE);
      put(s, c); next = e + one;
    }
    if (list.length && next <= max) put(next, NONE);
    return { starts, cc };
  };
  const t4 = walk(a4, 0, 1, 0xffffffff), t6 = walk(a6, 0n, 1n, 0xffffffffffffffffn);
  const head = Buffer.from(`${JSON.stringify({ v: 1, at, cc: codes, v4: t4.starts.length, v6: t6.starts.length, source: 'IP to Country Lite by DB-IP (https://db-ip.com), CC BY 4.0' })}\n`);
  const b4 = Buffer.alloc(t4.starts.length * 4); t4.starts.forEach((s, i) => b4.writeUInt32LE(s, i * 4));
  const b6 = Buffer.alloc(t6.starts.length * 8); t6.starts.forEach((s, i) => b6.writeBigUInt64LE(s, i * 8));
  return gzipSync(Buffer.concat([head, b4, Buffer.from(t4.cc), b6, Buffer.from(t6.cc)]), { level: 9 });
}

// → (address) => two-letter country code, or '' when the table does not know it; null when there is no table
export function loadGeo(file) {
  let raw; try { raw = gunzipSync(readFileSync(file)); } catch { return null; }
  const nl = raw.indexOf(10); if (nl < 0) return null;
  let h; try { h = JSON.parse(raw.toString('utf8', 0, nl)); } catch { return null; }
  if (h?.v !== 1 || !Array.isArray(h.cc)) return null;
  let o = nl + 1;
  const need = h.v4 * 5 + h.v6 * 9; if (raw.length - o < need) return null;
  const s4 = new Uint32Array(h.v4); for (let i = 0; i < h.v4; i++) s4[i] = raw.readUInt32LE(o + i * 4); o += h.v4 * 4;
  const c4 = raw.subarray(o, o + h.v4); o += h.v4;
  const s6 = new BigUint64Array(h.v6); for (let i = 0; i < h.v6; i++) s6[i] = raw.readBigUInt64LE(o + i * 8); o += h.v6 * 8;
  const c6 = raw.subarray(o, o + h.v6);
  // the last row that begins at or before the address
  const find = (starts, n) => { let lo = 0, hi = starts.length - 1, at = -1; while (lo <= hi) { const mid = (lo + hi) >> 1; if (starts[mid] <= n) { at = mid; lo = mid + 1; } else hi = mid - 1; } return at; };
  const of = (ip) => {
    let s = String(ip || '').trim().replace(/^\[|\]$/g, ''); if (!s) return '';
    s = mapped(s) || s;
    const n = v4Of(s);
    if (n >= 0) { const i = find(s4, n); return i < 0 ? '' : h.cc[c4[i]] || ''; }
    const b = hi64(s); if (b === null) return '';
    const i = find(s6, b); return i < 0 ? '' : h.cc[c6[i]] || '';
  };
  of.rows = h.v4 + h.v6; of.at = h.at || ''; of.source = h.source || '';
  return of;
}
