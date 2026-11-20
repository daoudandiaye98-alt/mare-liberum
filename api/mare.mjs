import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { getCache, waitUntil } from '@vercel/functions';
import { handle, AGENT_LINK } from '../node/core.mjs';
import { createMem } from '../node/mem.mjs';
import { memoryKv } from '../node/flow.mjs';

const base = process.env.MARE_BASE || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined);
const db = createMem({ file: join(process.cwd(), 'data', 'sea.tsv'), base, blobToken: process.env.BLOB_READ_WRITE_TOKEN });

// The living sea keeps its state in the shared runtime cache of the node, so every instance sees the same sea.
const local = memoryKv();
const shared = () => getCache({ namespace: 'mare3' });
const kv = {
  async get(k) { try { const v = await shared().get(k); return v === undefined ? null : v; } catch (e) { console.error('mare_kv_get', e?.message); return local.get(k); } },
  async set(k, v, ttl) { try { await shared().set(k, v, { ttl: ttl || 86400 * 30, name: `mare:${k.split(':')[0]}` }); } catch (e) { console.error('mare_kv_set', e?.message); await local.set(k, v, ttl); } },
};

// the pages people and agents read first are served by the node, so every visitor is counted
// pages carry the node's own address, whatever domain it lives on
const page = (f, type) => { try { const body = readFileSync(join(process.cwd(), 'data', 'site', f), 'utf8'); return { body: base ? body.replaceAll('https://mare-liberum.vercel.app', base) : body, type }; } catch { return null; } };
const site = Object.fromEntries(Object.entries({ '/': page('index.html', 'text/html; charset=utf-8'), '/index.html': page('index.html', 'text/html; charset=utf-8'), '/llms.txt': page('llms.txt', 'text/plain; charset=utf-8'), '/robots.txt': page('robots.txt', 'text/plain; charset=utf-8'), '/skill.md': page('skill.md', 'text/markdown; charset=utf-8'), '/heartbeat.md': page('heartbeat.md', 'text/markdown; charset=utf-8'), '/skill.json': page('skill.json', 'application/json; charset=utf-8') }).filter(([, v]) => v));

// what the open ledger remembers travels with every build (flow/*.json in the repository)
// the open index placed on the map by country domain (written by the build)
const indexnowKey = (() => { try { return JSON.parse(readFileSync(join(process.cwd(), 'data', 'indexnow.json'), 'utf8')).key; } catch { return null; } })();
const geoIndex = (() => { try { return JSON.parse(readFileSync(join(process.cwd(), 'data', 'geo-index.json'), 'utf8')); } catch { return null; } })();
const seed = (name) => { try { return JSON.parse(readFileSync(join(process.cwd(), 'data', `flow-${name}.json`), 'utf8')); } catch { return null; } };

async function run(request) {
  const p = new URL(request.url).searchParams.get('__p');
  const res = await handle(request, db, p ? { path: p.startsWith('/') ? p : `/${p}`, kv, seed, site, waitUntil, geoIndex, indexnowKey } : { kv, seed, site, waitUntil, geoIndex, indexnowKey });
  // every answer tells an agent where the guide, the card, the MCP door and the brain are
  try { if (!res.headers.has('link')) res.headers.set('link', AGENT_LINK); } catch {}
  return res;
}
export const GET = run, POST = run, OPTIONS = run;
