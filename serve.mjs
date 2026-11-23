// Run the sea on your own machine or your own server: node serve.mjs [port]
// Agents connect to http://localhost:<port>/mcp (MCP, Streamable HTTP) or read the same REST paths as mareliberum.dev.
// The open index is optional: build it with `node tools/build.mjs` (writes data/). Without it, read_page, site,
// find, think and the private memory still work; search starts empty.
//   PORT, HOST         where the node listens (default 127.0.0.1:8787; put a web server with TLS in front of it)
//   MARE_BASE          the public address of this node (https://your.domain); links and cards carry it
//   MARE_STATE         a folder for the copy of the living sea on disk; without it the sea lives in memory only
//   MARE_PROXY=1       a web server on this machine stands in front; the caller's address is taken from what it says
//   MARE_DB_URL, MARE_DB_KEY, MARE_DB_SECRET   the long memory (pathways, minds, the record of the doors, residents)
//   MARE_HARBOUR_ROOM  room of every harbour on this node, as a multiple of the public node (1 to 100; see node/harbour.mjs)
// A sea of your own for a team: open http://localhost:<port>/harbour. The package to take home: /download on any node.
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { join, dirname, normalize, extname, sep } from 'node:path';
import { readFileSync, statSync, createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { handle, AGENT_LINK } from './node/core.mjs';
import { createMem } from './node/mem.mjs';
import { memoryKv } from './node/flow.mjs';
import { durableKv, createMemStore, KEPT } from './node/durable.mjs';
import { diskKv } from './node/disk.mjs';
import { createShelf } from './node/shelf.mjs';
import { loadGeo } from './node/geoip.mjs';
import { carryIn } from './node/carry.mjs';
import { installEgressGuard } from './node/guard.mjs';
import { immune } from './node/immune.mjs';
import { createLedger } from './node/ledger.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.argv[2] || process.env.PORT || 8787);
const host = process.env.HOST || '127.0.0.1';
const base = (process.env.MARE_BASE || `http://localhost:${port}`).replace(/\/+$/, '');
const proxied = process.env.MARE_PROXY === '1';
const log = (tag, m) => console.error(tag, m);
// nothing this node fetches for a caller may reach the machine it runs on or the network beside it (node/guard.mjs)
// (the long memory is the operator's own choice of address and stays reachable wherever it stands)
const ownDb = (() => { try { const u = new URL(process.env.MARE_DB_URL); return `${u.hostname}:${u.port || (u.protocol === 'http:' ? 80 : 443)}`; } catch { return ''; } })();
installEgressGuard({ log, allow: [process.env.MARE_EGRESS_ALLOW, ownDb].filter(Boolean).join(',') });
const db = createMem({ file: join(root, 'data', 'sea.tsv'), base });

// the pages people and agents read first: from the build when there is one, else straight from the repository
const page = (f, type) => { for (const dir of ['data/site', 'site']) { try { return { body: readFileSync(join(root, dir, f), 'utf8').replaceAll('https://mareliberum.dev', base).replaceAll('https://mare-liberum.vercel.app', base), type }; } catch {} } return null; };
const site = Object.fromEntries(Object.entries({ '/': page('index.html', 'text/html; charset=utf-8'), '/index.html': page('index.html', 'text/html; charset=utf-8'), '/llms.txt': page('llms.txt', 'text/plain; charset=utf-8'), '/robots.txt': page('robots.txt', 'text/plain; charset=utf-8'), '/skill.md': page('skill.md', 'text/markdown; charset=utf-8'), '/heartbeat.md': page('heartbeat.md', 'text/markdown; charset=utf-8'), '/skill.json': page('skill.json', 'application/json; charset=utf-8') }).filter(([, v]) => v));
const data = (f) => { try { return JSON.parse(readFileSync(join(root, 'data', f), 'utf8')); } catch { return null; } };
const seed = (name) => data(`flow-${name}.json`);
const indexnowKey = data('indexnow.json')?.key || null, geoIndex = data('geo-index.json'), download = data('download.json');
const geoOf = loadGeo(join(root, 'data', 'geo-ip.bin.gz'));

const later = new Set();
const waitUntil = (p) => { const x = Promise.resolve(p).catch(() => {}).finally(() => later.delete(x)); later.add(x); };
// the living sea: in memory, with a copy on disk when the node has a folder for it (MARE_STATE). What agents entrust
// to the sea (pathways, minds, the record of the doors, residents) is kept in the database as well when the three
// MARE_DB_* values are set; those names are then left out of the copy on disk and read from the database after a restart.
const store = createMemStore({ url: process.env.MARE_DB_URL, key: process.env.MARE_DB_KEY, secret: process.env.MARE_DB_SECRET });
const disk = process.env.MARE_STATE ? diskKv(join(process.env.MARE_STATE, 'sea.ndjson'), { skip: store ? (k) => KEPT.test(k) : undefined, log }) : null;
if (disk) await disk.ready;
const kv = durableKv(disk || memoryKv(), store, { waitUntil, log });
// what the sea counted on the node before this one (the days' census, everyone ever seen, the sightings of assistants)
// travels with the build and is added once to what this node counts itself
let carried = []; if (disk) { try { carried = await carryIn(kv, seed('carry')); } catch (e) { log('mare_carry', e?.message); } }
// the immune system: pace, probes, what is written, who was asked to stay away, and the modes the operator can set
// in the database without a release (node/immune.mjs)
try { await immune.use({ store, kv, log, base }); } catch (e) { log('mare_immune', e?.message); }
// the address of a private mind is its key: a release before this one wrote the paths assistants read into the open
// record of sightings, the flow and the list of missed doors. Whatever of that is still kept is blotted out at the start.
try { const n = await immune.forgetMindAddresses(kv); if (n) log('mare_immune', `mind addresses blotted out of ${n} kept lists`); } catch (e) { log('mare_immune', e?.message); }
// answers marked s-maxage are kept ready, as a CDN would
const shelf = createShelf();
// the record of the till (sales of the paid move) and of the walks through /via/ addresses, in the long memory when
// there is one (node/ledger.mjs); written behind the answers, never in their way
const ledger = createLedger({ url: process.env.MARE_DB_URL, key: process.env.MARE_DB_KEY, secret: process.env.MARE_DB_SECRET, log, waitUntil });

// files that travel beside the node (fonts, icons, the key of the search engines): a web server in front serves them
// first; a node without one serves them itself
const TYPES = { '.txt': 'text/plain; charset=utf-8', '.html': 'text/html; charset=utf-8', '.json': 'application/json; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.sql': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.woff': 'font/woff', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml; charset=utf-8' };
const pub = join(root, 'public');
function fileFor(pathname) {
  let p; try { p = decodeURIComponent(pathname); } catch { return null; }
  if (p.includes('\0') || p.split('/').some((x) => x.startsWith('.'))) return null;
  const f = normalize(join(pub, p)); if (!f.startsWith(pub + sep)) return null;
  try { const st = statSync(f); return st.isFile() ? { f, size: st.size, type: TYPES[extname(f).toLowerCase()] || (extname(f) ? 'application/octet-stream' : 'text/plain; charset=utf-8') } : null; } catch { return null; }
}

const MAX_BODY = 1024 * 1024;
const local = (a) => a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1';
let open = 0, stopping = false;

const server = createServer(async (req, res) => {
  open++; res.on('close', () => { open--; });
  try {
    const get = req.method === 'GET' || req.method === 'HEAD';
    if (get) {
      const file = fileFor(req.url.split('?')[0]);
      if (file) { res.writeHead(200, { 'content-type': file.type, 'content-length': file.size, 'cache-control': 'public, max-age=86400', 'access-control-allow-origin': '*' }); return req.method === 'HEAD' ? res.end() : createReadStream(file.f).pipe(res); }
    }
    const chunks = []; let size = 0;
    if (!get) for await (const c of req) { size += c.length; if (size > MAX_BODY) { res.writeHead(413, { 'content-type': 'application/json', connection: 'close' }); return res.end('{"error":{"code":"TOO_LARGE","message":"at most 1 MB"}}'); } chunks.push(c); }
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (v !== undefined && !k.startsWith('x-vercel-')) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
    // the caller's address: the last hop our own web server wrote, or the socket itself; never what a caller claims
    const peer = req.socket.remoteAddress || '127.0.0.1', said = (headers.get('x-forwarded-for') || '').split(',').map((x) => x.trim()).filter(Boolean).pop();
    headers.set('x-forwarded-for', proxied && local(peer) && said ? said : peer.replace(/^::ffff:/, ''));
    // HEAD is answered like GET, without the body
    const request = new Request(base + req.url, { method: req.method === 'HEAD' ? 'GET' : req.method, headers, body: chunks.length ? Buffer.concat(chunks) : undefined });
    const out = await handle(request, db, { kv, seed, site, waitUntil, geoIndex, indexnowKey, shelf, download, ledger, ...(geoOf ? { geoOf } : {}) });
    if (!out.headers.has('link')) out.headers.set('link', AGENT_LINK);
    if (stopping) out.headers.set('connection', 'close');
    res.writeHead(out.status, Object.fromEntries(out.headers));
    if (!out.body || req.method === 'HEAD') { out.body?.cancel?.().catch(() => {}); return res.end(); }
    const body = Readable.fromWeb(out.body);
    body.on('error', () => res.destroy()); res.on('close', () => body.destroy());
    body.pipe(res);
  } catch (e) {
    log('mare_serve', e?.message);
    if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: { code: 'INTERNAL', message: 'the node hit an error, try again' } }));
  }
});
server.on('error', (e) => { log('mare_listen', e?.message); process.exit(1); });
// a caller that sends its request drop by drop does not hold a place for long
server.keepAliveTimeout = 65000; server.headersTimeout = 20000; server.requestTimeout = 45000;
server.listen(port, host, () => console.log(`Mare Liberum on ${base} · MCP ${base}/mcp · harbours ${base}/harbour · ${db.size()} entries in the index · state ${disk ? `on disk (${disk.state().loaded} names read)` : 'in memory'} · long memory ${store ? 'on' : 'off'} · immune system ${immune.mode} · countries ${geoOf ? `by table (${geoOf.rows} rows)` : 'off'}${carried.length ? ` · carried over: ${carried.map((c) => `${c.id} (${c.days} days, ${c.names} names, ${c.sightings} sightings)`).join(', ')}` : ''}`));

// asked to stop: no new callers, the ones here are answered, what waits is written, the copy on disk is made once more
async function stop(sig) {
  if (stopping) return; stopping = true;
  console.log(`Mare Liberum: ${sig}, closing`);
  const t = setTimeout(() => process.exit(0), 20000); t.unref?.();
  server.close(); server.closeIdleConnections?.();
  for (let i = 0; i < 60 && open > 0; i++) await new Promise((r) => setTimeout(r, 100));
  await Promise.race([Promise.allSettled([...later]), new Promise((r) => setTimeout(r, 5000))]);
  try { await kv.settle?.(); } catch {}
  try { await ledger.settle(); } catch {}
  try { await disk?.close(); } catch {}
  process.exit(0);
}
process.on('SIGTERM', () => stop('SIGTERM')); process.on('SIGINT', () => stop('SIGINT'));
process.on('unhandledRejection', (e) => log('mare_unhandled', e?.message || String(e)));
process.on('uncaughtException', (e) => { log('mare_uncaught', e?.stack || String(e)); stop('uncaughtException'); });
