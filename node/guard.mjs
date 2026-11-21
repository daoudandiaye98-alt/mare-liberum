// Mare Liberum · the gate on the way out
// The sea reads the web for its callers: pages, sites, cards, shops. On a server of its own that must never turn
// inwards. No caller may make the node call the machine it runs on, the network beside it or the service addresses of
// the cloud it stands in — whatever name they give it, whatever a site answers as its next address.
// Every outgoing connection of this process passes one gate. It looks at the address the connection really goes to,
// after the name was resolved, at the moment of connecting. A name that answers "public" when it is checked and
// "inside" when it is fetched gains nothing, and neither does a redirect.
//   installEgressGuard({ allow })   once, before the first request; allow: 'host:port,host' for stand-ins in proofs
//   inner(address)                  true for every address that is not a public one (IPv4 and IPv6, mapped forms too)
import net from 'node:net';
import dns from 'node:dns';

const quad = (ip) => { const p = String(ip).split('.'); if (p.length !== 4 || !p.every((x) => /^\d{1,3}$/.test(x))) return null; const n = p.map(Number); return n.every((x) => x <= 255) ? n : null; };
function innerV4(ip) {
  const p = quad(ip); if (!p) return true;
  const [a, b, c] = p;
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168) || (a === 192 && b === 0 && (c === 0 || c === 2)) || (a === 192 && b === 88 && c === 99)
    || (a === 198 && (b === 18 || b === 19)) || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113) || a >= 224;
}
// an IPv6 address as its eight numbers; null when it is not one
function hextets(ip) {
  let s = String(ip).toLowerCase().replace(/^\[|\]$/g, '').replace(/%.*$/, '');
  if (!s.includes(':')) return null;
  const m = /^(.*:)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(s);
  if (m) { const p = quad(m[2]); if (!p) return null; s = `${m[1]}${((p[0] << 8) | p[1]).toString(16)}:${((p[2] << 8) | p[3]).toString(16)}`; }
  const halves = s.split('::'); if (halves.length > 2) return null;
  const part = (x) => (x ? x.split(':') : []);
  const head = part(halves[0]), tail = halves.length === 2 ? part(halves[1]) : [];
  const gap = 8 - head.length - tail.length;
  if (halves.length === 2 ? gap < 1 : gap !== 0) return null;
  const all = [...head, ...Array(halves.length === 2 ? gap : 0).fill('0'), ...tail];
  if (all.length !== 8 || !all.every((x) => /^[0-9a-f]{1,4}$/.test(x))) return null;
  return all.map((x) => parseInt(x, 16));
}
export function inner(address) {
  const s = String(address || '').trim();
  if (quad(s)) return innerV4(s);
  const h = hextets(s); if (!h) return true;
  const carried = (hi, lo) => innerV4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  const [a, b] = h;
  // ::, ::1 and the old "compatible" form are inside; an IPv4 address written as IPv6 is judged as the IPv4 address it is
  if (h.slice(0, 5).every((x) => x === 0)) return h[5] === 0xffff ? carried(h[6], h[7]) : true;
  if (a === 0x64 && b === 0xff9b) return h[2] || h[3] || h[4] || h[5] ? true : carried(h[6], h[7]);   // NAT64
  if (a === 0x2002) return carried(h[1], h[2]);                                                          // 6to4
  if (a === 0x2001 && (b === 0 || b === 0xdb8)) return true;                                             // Teredo, documentation
  // only the global unicast range goes out: not unique-local (fc00::/7), link-local (fe80::/10), multicast (ff00::/8)
  return (a & 0xe000) !== 0x2000;
}

// the name under which an address is counted and, when it has to be, asked to stay away: an IPv4 address as it is,
// an IPv6 address by its network (/64) — one caller there holds a whole network of addresses
export function netKey(address) {
  const s = String(address || '').trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/%.*$/, '');
  if (quad(s)) return s;
  const h = hextets(s); if (!h) return s.slice(0, 64) || 'unknown';
  if (h.slice(0, 5).every((x) => x === 0) && h[5] === 0xffff) return `${h[6] >> 8}.${h[6] & 255}.${h[7] >> 8}.${h[7] & 255}`;
  return `${h.slice(0, 4).map((x) => x.toString(16)).join(':')}::/64`;
}

const state = { on: false, refused: 0, last: null };
export const egress = () => ({ ...state });
export function installEgressGuard({ allow = process.env.MARE_EGRESS_ALLOW || '', log } = {}) {
  if (state.on) return egress();
  const allowed = new Set(String(allow).split(',').map((x) => x.trim().toLowerCase()).filter(Boolean));
  const let_through = (host, port) => allowed.has(`${host}:${port}`) || allowed.has(String(host));
  const refuse = (host, port, address) => {
    state.refused++; state.last = new Date().toISOString();
    try { log?.('mare_egress', `refused ${host}:${port}${address && address !== host ? ` -> ${address}` : ''}`); } catch {}
    return Object.assign(new Error(`host_private: ${host} is not a public address`), { code: 'EGRESS_REFUSED' });
  };
  const original = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function connect(...args) {
    // net.connect() hands over one prepared list [options, callback]; callers may also give (options, cb) or (port, host, cb)
    let o = null, prepared = false;
    if (Array.isArray(args[0])) { o = args[0][0]; prepared = true; }
    else if (args[0] && typeof args[0] === 'object') o = args[0];
    else if (typeof args[0] === 'number' || (typeof args[0] === 'string' && /^\d+$/.test(args[0]))) {
      const cb = args.find((x) => typeof x === 'function');
      o = { port: Number(args[0]), host: typeof args[1] === 'string' ? args[1] : 'localhost' };
      args = cb ? [o, cb] : [o];
    }
    // a socket file on this machine is not a way out to the network
    if (!o || o.path) return original.apply(this, args);
    const host = String(o.host || 'localhost').toLowerCase().replace(/^\[|\]$/g, ''), port = Number(o.port);
    if (let_through(host, port)) return original.apply(this, args);
    if (net.isIP(host)) {
      if (!inner(host)) return original.apply(this, args);
      const e = refuse(host, port); process.nextTick(() => this.destroy(e)); return this;
    }
    const resolve = o.lookup || dns.lookup;
    const lookup = (name, opts, cb) => {
      if (typeof opts === 'function') { cb = opts; opts = {}; }
      resolve(name, opts, (err, address, family) => {
        if (err) return cb(err);
        const list = Array.isArray(address) ? address : [{ address, family }];
        const out = list.filter((x) => !inner(x.address));
        if (!out.length) return cb(refuse(host, port, list[0]?.address));
        return Array.isArray(address) ? cb(null, out) : cb(null, out[0].address, out[0].family);
      });
    };
    const guarded = { ...o, lookup };
    if (prepared) args[0][0] = guarded; else args[0] = guarded;
    return original.apply(this, args);
  };
  state.on = true;
  return egress();
}
