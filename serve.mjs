// Run the sea on your own machine: node serve.mjs [port]
// Agents connect to http://localhost:<port>/mcp (MCP, Streamable HTTP) or read the same REST paths as mareliberum.dev.
// The open index is optional: build it with `node tools/build.mjs` (writes data/sea.tsv). Without it, read_page, site,
// find, think and the private memory still work; search starts empty.
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { join, dirname } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { handle, AGENT_LINK } from './node/core.mjs';
import { createMem } from './node/mem.mjs';
import { memoryKv } from './node/flow.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.argv[2] || process.env.PORT || 8787);
const host = process.env.HOST || '127.0.0.1';
const base = process.env.MARE_BASE || `http://localhost:${port}`;
const db = createMem({ file: join(root, 'data', 'sea.tsv'), base });
const kv = memoryKv();
const page = (f, type) => { try { return { body: readFileSync(join(root, 'site', f), 'utf8').replaceAll('https://mareliberum.dev', base).replaceAll('https://mare-liberum.vercel.app', base), type }; } catch { return null; } };
const site = Object.fromEntries(Object.entries({ '/': page('index.html', 'text/html; charset=utf-8'), '/llms.txt': page('llms.txt', 'text/plain; charset=utf-8'), '/robots.txt': page('robots.txt', 'text/plain; charset=utf-8') }).filter(([, v]) => v));
const seed = (name) => { try { return JSON.parse(readFileSync(join(root, 'data', `flow-${name}.json`), 'utf8')); } catch { return null; } };
const later = new Set();
const waitUntil = (p) => { const x = Promise.resolve(p).catch(() => {}).finally(() => later.delete(x)); later.add(x); };

createServer(async (req, res) => {
  try {
    const chunks = [];
    if (req.method !== 'GET' && req.method !== 'HEAD') for await (const c of req) chunks.push(c);
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
    if (!headers.has('x-forwarded-for')) headers.set('x-forwarded-for', req.socket.remoteAddress || '127.0.0.1');
    const request = new Request(base + req.url, { method: req.method, headers, body: chunks.length ? Buffer.concat(chunks) : undefined });
    const out = await handle(request, db, { kv, seed, site, waitUntil });
    if (!out.headers.has('link')) out.headers.set('link', AGENT_LINK);
    res.writeHead(out.status, Object.fromEntries(out.headers));
    if (!out.body || req.method === 'HEAD') return res.end();
    Readable.fromWeb(out.body).pipe(res);
  } catch (e) {
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'internal', message: String(e?.message || e) }));
  }
}).listen(port, host, () => console.log(`Mare Liberum on ${base} · MCP ${base}/mcp · ${db.size()} entries in the index`));
