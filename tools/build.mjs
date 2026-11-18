// Mare Liberum · build the sea: pull every public lake, normalize to ARD-shaped rows, write one open data file.
// Usage: node tools/build.mjs            (pull live)        node tools/build.mjs --cache   (reuse data/*.ndjson)
import { createWriteStream, createReadStream, existsSync, readFileSync, writeFileSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { normMcp, normX402, normA2AListed, normUcp, normAgentverse, normHfSpace, readDomain, fetchJson, safeUrl, clean } from '../node/core.mjs';
import { hayOf, metaOf } from '../node/mem.mjs';

const UA = 'MareLiberum/1.1 (open agent index; pull-only; +https://github.com/daoudandiaye98-alt/mare-liberum)';
const CACHE = process.argv.includes('--cache');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const keep = (rows, r) => { if (r) rows.push(r); };
async function get(u, init = {}) {
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(u, { ...init, headers: { 'user-agent': UA, accept: 'application/json', ...(init.headers || {}) }, signal: AbortSignal.timeout(30000) });
      if (r.ok) return { json: await r.json(), link: r.headers.get('link') || '' };
      await r.body?.cancel(); if (r.status === 429) await sleep(5000 * (i + 1));
    } catch {}
    await sleep(1000 * (i + 1));
  }
  throw new Error('lake_unreachable ' + u);
}
// run a list of jobs with a fixed number of parallel readers
async function pool(items, size, job) { let i = 0; await Promise.all(Array.from({ length: size }, async () => { while (i < items.length) { const x = items[i++]; try { await job(x); } catch {} } })); }

// ---------------------------------------------------------------- generic paged lakes
async function paged(lake) {
  const rows = []; let cursor = '', offset = 0, total = 0, pages = 0;
  for (;;) {
    const { json: j } = await get(lake.url + (lake.cursor ? (cursor ? `&cursor=${encodeURIComponent(cursor)}` : '') : `&offset=${offset}`));
    const items = lake.items(j) || [];
    for (const it of items) keep(rows, lake.norm(it));
    pages++; if (pages % 100 === 0) console.log(`  ${lake.name}: ${pages} pages, ${rows.length} rows`);
    if (lake.cursor) { cursor = j?.metadata?.nextCursor || ''; if (!cursor) break; await sleep(40); }
    else { offset += items.length; total = lake.total?.(j) || j?.pagination?.total || total; if (!items.length || (total && offset >= total)) break; }
  }
  return rows;
}
// ---------------------------------------------------------------- lakes with their own shape
async function agentverse() {
  // the public marketplace search lists the 10,000 most used agents; the sea carries the active ones
  const rows = [], offs = []; for (let o = 0; o < 10000; o += 50) offs.push(o);
  await pool(offs, 3, async (offset) => {
    const { json: j } = await get('https://agentverse.ai/v1/search/agents', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ search_text: '', sort: 'interactions', direction: 'desc', offset, limit: 50 }) });
    for (const a of j.agents || []) keep(rows, normAgentverse(a));
  });
  return rows;
}
async function hfSpaces() {
  const rows = []; let u = 'https://huggingface.co/api/spaces?filter=mcp-server&limit=1000';
  for (let p = 0; u && p < 200; p++) {
    const { json: j, link } = await get(u);
    for (const s of Array.isArray(j) ? j : []) keep(rows, normHfSpace(s));
    u = /<([^>]+)>;\s*rel="next"/.exec(link)?.[1] || '';
  }
  return rows;
}
// read a public home page the way a search engine does: robots.txt first, then title and description
async function text(url, max, ms, accept) {
  let u = await safeUrl(url);
  for (let hop = 0; hop < 4; hop++) {
    const r = await fetch(u, { redirect: 'manual', headers: { 'user-agent': UA, accept }, signal: AbortSignal.timeout(ms) });
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) { u = await safeUrl(new URL(r.headers.get('location'), u).toString()); await r.body?.cancel(); continue; }
    if (!r.ok || !r.body) { await r.body?.cancel(); return ''; }
    const reader = r.body.getReader(), dec = new TextDecoder(); let out = '';
    while (out.length < max) { const { done, value } = await reader.read(); if (done) break; out += dec.decode(value, { stream: true }); }
    reader.cancel().catch(() => {});
    return out;
  }
  return '';
}
function robotsAllowHome(txt) {
  let mine = null, star = null, cur = [];
  for (const raw of txt.split(/\r?\n/)) {
    const l = raw.replace(/#.*/, '').trim(), m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(l); if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === 'user-agent') { if (cur.done) cur = []; cur.push(v.toLowerCase()); cur.rules ||= []; if (v === '*') star = cur; if (/mareliberum/i.test(v)) mine = cur; }
    else if (k === 'disallow' || k === 'allow') { cur.done = true; (cur.rules ||= []).push([k, v]); }
  }
  const g = mine || star; if (!g) return true;
  return !(g.rules || []).some(([k, v]) => k === 'disallow' && (v === '/' || v === '/*'));
}
const ent = (s) => String(s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x?[0-9a-f]+;|&[a-z]+;/gi, ' ');
async function homePage(host) {
  try {
    const robots = await text(`https://${host}/robots.txt`, 60000, 6000, 'text/plain').catch(() => '');
    if (!robotsAllowHome(robots)) return null;
    const html = await text(`https://${host}/`, 120000, 8000, 'text/html');
    const title = /<title[^>]*>([^<]{1,300})<\/title>/i.exec(html)?.[1];
    const meta = /<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]*content=["']([^"']{1,600})["']/i.exec(html)?.[1]
      || /<meta[^>]+content=["']([^"']{1,600})["'][^>]*(?:name|property)=["'](?:description|og:description)["']/i.exec(html)?.[1];
    return { title: clean(ent(title), 120), description: clean(ent(meta), 400) };
  } catch { return null; }
}
async function ucpStores() {
  // seed list: the open UCP merchant directory by UCP Checker (CC BY 4.0), every store is then read first-hand
  const info = (await get('https://huggingface.co/api/datasets/UCPChecker/ucp-merchants')).json;
  const file = (info.siblings || []).map((s) => s.rfilename).filter((f) => /\.csv$/.test(f)).sort().pop();
  const r = await fetch(`https://huggingface.co/datasets/UCPChecker/ucp-merchants/resolve/main/${file}`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(60000) });
  const lines = (await r.text()).split('\n').slice(1), domains = new Set();
  for (const l of lines) { const [d, status] = l.split(','); if (status === 'verified' && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d || '')) domains.add(d); }
  if (existsSync('seeds-ucp.txt')) for (const d of readFileSync('seeds-ucp.txt', 'utf8').split('\n').map((x) => x.trim().toLowerCase())) if (/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)) domains.add(d);
  // titles and descriptions travel with the repo (store-pages.json); a store that is new to the sea gets its home page read once, gently
  const pages = existsSync('store-pages.json') ? JSON.parse(readFileSync('store-pages.json', 'utf8')) : {};
  let slots = 5; const waiting = [];
  const gently = async (job) => { if (slots > 0) slots--; else await new Promise((go) => waiting.push(go)); try { return await job(); } finally { const next = waiting.shift(); if (next) next(); else slots++; } };
  const rows = []; let done = 0, fresh = 0;
  await pool([...domains], 40, async (host) => {
    const url = `https://${host}/.well-known/ucp`, m = await fetchJson(url, 300000, 9000).catch(() => null);
    if (m?.ucp) {
      if (!pages[host]) { const p = await gently(() => homePage(host)); if (p?.title || p?.description) { pages[host] = p; fresh++; } }
      keep(rows, normUcp(m, host, url, pages[host]));
    }
    if (++done % 500 === 0) console.log(`  ucp-stores: ${done}/${domains.size} read, ${rows.length} open`);
  });
  console.log(`  ucp-stores: ${fresh} home pages read fresh`);
  if (!process.env.VERCEL && fresh) writeFileSync('store-pages.json', JSON.stringify(Object.fromEntries(Object.entries(pages).sort(([a], [b]) => (a < b ? -1 : 1)))));
  return rows;
}

const LAKES = [
  { name: 'mcp-registry', cursor: true, url: 'https://registry.modelcontextprotocol.io/v0/servers?version=latest&limit=100', items: (j) => j.servers, norm: (x) => normMcp(x) },
  { name: 'x402-bazaar', url: 'https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources?limit=100', items: (j) => j.items, norm: (x) => normX402(x, 'x402-bazaar') },
  { name: 'x402-payai', url: 'https://facilitator.payai.network/discovery/resources?limit=100', items: (j) => j.items, norm: (x) => normX402(x, 'x402-payai') },
  { name: 'a2a-registry', url: 'https://a2aregistry.org/api/agents?limit=50', items: (j) => j.agents, total: (j) => j.total, norm: (x) => normA2AListed(x, 'a2a-registry', 'https://a2aregistry.org') },
  { name: 'agentverse', pull: agentverse },
  { name: 'hf-spaces', pull: hfSpaces },
  { name: 'ucp-stores', pull: ucpStores },
];

mkdirSync('data', { recursive: true });
const all = new Map(), lakeStats = {};
const settled = await Promise.allSettled(LAKES.map(async (lake) => {
  const cache = `data/${lake.name}.ndjson`, t = Date.now();
  let rows;
  if (CACHE && existsSync(cache)) rows = readFileSync(cache, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  else { rows = await (lake.pull ? lake.pull() : paged(lake)); if (!process.env.VERCEL) writeFileSync(cache, rows.map((r) => JSON.stringify(r)).join('\n') + '\n'); }
  lakeStats[lake.name] = rows.length; console.log(`lake ${lake.name}: ${rows.length} rows in ${Math.round((Date.now() - t) / 1000)} s`);
  return rows;
}));
settled.forEach((s, i) => { if (s.status === 'fulfilled') for (const r of s.value) all.set(r.id, r); else { lakeStats[LAKES[i].name] = 'pending: ' + s.reason?.message; console.log(`lake ${LAKES[i].name} follows at the next refresh`); } });
if (all.size < 1000) throw new Error('the sea needs at least one full lake to build');

// Domains that speak for themselves: read their own manifests (ARD, AI Catalog, A2A agent card).
const seedFile = (f) => (existsSync(f) ? readFileSync(f, 'utf8').split('\n').map((l) => l.trim().toLowerCase()).filter((l) => l && !l.startsWith('#')) : []);
const seeds = [...new Set([...seedFile('seeds.txt'), ...seedFile('seeds-ard.txt')])];
let joined = 0, speaking = 0;
await pool(seeds, 48, async (d) => { const { rows } = await readDomain(d); if (rows.length) speaking++; for (const r of rows) { all.set(r.id, r); joined++; } });
console.log(`self-published domains: ${speaking} of ${seeds.length} speak today, ${joined} entries`);
lakeStats['self-published domains'] = joined;
const hosts = new Set();
for (const r of all.values()) for (const e of r.endpoints || []) { if (e.url && e.transport !== 'repository') { try { hosts.add(new URL(e.url).hostname.toLowerCase()); } catch {} } }

const ids = [...all.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
const out = createWriteStream('data/sea.tsv');
for (const id of ids) {
  const r = all.get(id);
  for (const k of Object.keys(r)) if (r[k] == null) delete r[k];
  if (!out.write(`${id}\t${metaOf(r)}\t${hayOf(r)}\t${JSON.stringify(r)}\n`)) await new Promise((res) => out.once('drain', res));
}
await new Promise((res) => out.end(res));
// the node carries the sea compressed; the plain file stays for local work and mirrors
await pipeline(createReadStream('data/sea.tsv'), createGzip({ level: 6 }), createWriteStream('data/sea.tsv.gz'));
if (process.env.VERCEL) rmSync('data/sea.tsv');
writeFileSync('data/build.json', JSON.stringify({ builtAt: new Date().toISOString(), entries: ids.length, endpointHosts: hosts.size, lakes: lakeStats }));
// The source travels with the node: anyone can read it and run a mirror.
mkdirSync('public/source', { recursive: true });
for (const f of ['node/core.mjs', 'node/mem.mjs', 'tools/build.mjs', 'engines/postgres/schema.sql', 'seeds.txt', 'seeds-ard.txt', 'store-pages.json', 'README.md', 'LICENSE']) if (existsSync(f)) cpSync(f, `public/source/${f.split('/').pop()}`);
writeFileSync('public/build.json', readFileSync('data/build.json'));
console.log(`sea built: ${ids.length} entries`);
