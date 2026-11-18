// Mare Liberum · build the sea: pull every public lake, normalize to ARD-shaped rows, write one open data file.
// Usage: node tools/build.mjs            (pull live)        node tools/build.mjs --cache   (reuse data/*.ndjson)
import { createWriteStream, createReadStream, existsSync, readFileSync, writeFileSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { createGzip, gunzipSync } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { normMcp, normX402, normA2AListed, normUcp, normAgentverse, normHfSpace, normVirtuals, norm8004, readDomain, fetchJson, safeUrl, clean } from '../node/core.mjs';
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
// run a list of jobs with a fixed number of parallel readers; a lake that runs past its time keeps what it has
async function pool(items, size, job, ms = 0) { const end = ms ? Date.now() + ms : Infinity; let i = 0; await Promise.all(Array.from({ length: size }, async () => { while (i < items.length && Date.now() < end) { const x = items[i++]; try { await job(x); } catch {} } })); }

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
async function virtuals() {
  // agents that sell jobs to other agents, the busiest first; the list ends where agents stop selling
  const rows = [], url = (p) => `https://acpx.virtuals.io/api/agents?pagination%5Bpage%5D=${p}&pagination%5BpageSize%5D=100&sort=successfulJobCount:desc`;
  let quiet = 0;
  for (let p = 1; p <= 40 && quiet < 2; p += 4) {
    const pages = await Promise.all([p, p + 1, p + 2, p + 3].map((n) => get(url(n)).then((r) => r.json).catch(() => null)));
    let selling = 0;
    for (const j of pages) for (const a of j?.data || []) { const r = normVirtuals(a); if (r) { rows.push(r); selling++; } }
    quiet = selling ? 0 : quiet + 1;
  }
  return rows;
}
async function erc8004() {
  // agents registered on chain, the ones other agents rated highest first; the best of them come with their own endpoints
  const base = 'https://api.8004scan.io/api/v1/agents?is_testnet=false&min_feedbacks=1&sort_by=total_score&sort_order=desc&limit=100', list = [], offs = [];
  for (let o = 0; o < 5000; o += 100) offs.push(o);
  await pool(offs, 3, async (o) => { const { json: j } = await get(`${base}&offset=${o}`); for (const a of j.items || []) list.push(a); }, 6 * 60000);
  list.sort((x, y) => (Number(y.total_score) || 0) - (Number(x.total_score) || 0));
  const detail = new Map();
  await pool(list.slice(0, 1000), 8, async (a) => { const [chain, , token] = String(a.agent_id).split(':'); const { json } = await get(`https://api.8004scan.io/api/v1/agents/${chain}/${token}`); if (json) detail.set(a.agent_id, json); }, 4 * 60000);
  const rows = []; for (const a of list) keep(rows, norm8004(a, detail.get(a.agent_id)));
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

// the deep lake travels with the repository (tools/deep-8004.mjs): every on-chain agent another agent rated; the live lake refreshes the top
async function deep8004() {
  const f = 'lakes/erc8004-deep.ndjson.gz'; if (!existsSync(f)) return [];
  return gunzipSync(readFileSync(f)).toString('utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

const LAKES = [
  { name: 'mcp-registry', cursor: true, url: 'https://registry.modelcontextprotocol.io/v0/servers?version=latest&limit=100', items: (j) => j.servers, norm: (x) => normMcp(x) },
  { name: 'x402-bazaar', url: 'https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources?limit=100', items: (j) => j.items, norm: (x) => normX402(x, 'x402-bazaar') },
  { name: 'x402-payai', url: 'https://facilitator.payai.network/discovery/resources?limit=100', items: (j) => j.items, norm: (x) => normX402(x, 'x402-payai') },
  { name: 'a2a-registry', url: 'https://a2aregistry.org/api/agents?limit=50', items: (j) => j.agents, total: (j) => j.total, norm: (x) => normA2AListed(x, 'a2a-registry', 'https://a2aregistry.org') },
  { name: 'agentverse', pull: agentverse },
  { name: 'hf-spaces', pull: hfSpaces },
  { name: 'virtuals-acp', pull: virtuals },
  { name: 'erc8004-deep', pull: deep8004 },
  { name: 'erc8004', pull: erc8004 },
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
// Sellers that publish their own price list (/.well-known/x402) are found among the hosts of the paid lakes.
const hostOf = (u) => { try { return new URL(u).hostname.toLowerCase(); } catch { return ''; } };
const keyOf = (u) => { try { const x = new URL(u); return `${x.hostname.toLowerCase()}${x.pathname.replace(/\/+$/, '')}`; } catch { return ''; } };
const paidHosts = [...new Set([...all.values()].filter((r) => r.kind === 'x402').map((r) => hostOf(r.url)).filter(Boolean))], sellers = [];
await pool(paidHosts, 60, async (h) => { const j = await fetchJson(`https://${h}/.well-known/x402`, 300000, 5000); if (Array.isArray(j?.resources) && j.resources.some((r) => typeof r === 'string' && r.startsWith(`https://${h}/`))) sellers.push(h); });
console.log(`paid lakes: ${sellers.length} of ${paidHosts.length} hosts publish their own price list`);
const seeds = [...new Set([...seedFile('seeds.txt'), ...seedFile('seeds-ard.txt'), ...sellers])];
let joined = 0, speaking = 0, priced = 0, retired = 0;
const lakeByKey = new Map(), lakeByHost = new Map();
for (const r of all.values()) if (r.kind === 'x402' && r.source !== 'join') { lakeByKey.set(keyOf(r.url), r); const h = hostOf(r.url); lakeByHost.set(h, [...(lakeByHost.get(h) || []), r]); }
await pool(seeds, 48, async (d) => {
  const { host, rows, paid, listed } = await readDomain(d, { paidMax: 25 });
  if (rows.length) speaking++;
  for (const r of rows) {
    if (r.kind === 'x402') {
      // first-hand price beats the listing; the usage the lake measured travels along
      const old = lakeByKey.get(keyOf(r.url)); priced++;
      if (old) {
        r.pay = { ...r.pay, calls30d: old.pay?.calls30d, payers30d: old.pay?.payers30d }; r.quality = Math.max(r.quality || 0, old.quality || 0);
        if (!r.description) r.description = old.description; if (r.display_name.endsWith(` · ${host}`) && old.display_name) r.display_name = old.display_name;
        r.tags = [...new Set([...(r.tags || []), ...(old.tags || [])])].slice(0, 12); all.delete(old.id);
      }
    }
    all.set(r.id, r); joined++;
  }
  // a seller whose whole list was read speaks for the host: lake rows the seller no longer lists retire
  if (paid?.length && listed <= 25) { const keep = new Set(paid.map(keyOf)); for (const old of lakeByHost.get(host) || []) if (!keep.has(keyOf(old.url)) && all.delete(old.id)) retired++; }
});
console.log(`self-published domains: ${speaking} of ${seeds.length} speak today, ${joined} entries, ${priced} prices read first-hand, ${retired} retired listings`);
lakeStats['first-hand prices'] = priced;
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
// the open ledger of the living sea (traces, latest events) travels with the build, so the sea remembers across restarts
for (const [from, to] of [['flow/traces.json', 'data/flow-traces.json'], ['flow/head.json', 'data/flow-head.json']]) if (existsSync(from)) cpSync(from, to);
// the first pages people and agents read are served by the node
mkdirSync('data/site', { recursive: true }); for (const f of ['index.html', 'llms.txt', 'robots.txt']) if (existsSync(`site/${f}`)) cpSync(`site/${f}`, `data/site/${f}`);
// The source travels with the node: anyone can read it and run a mirror.
mkdirSync('public/source', { recursive: true });
for (const f of ['node/core.mjs', 'node/mem.mjs', 'node/flow.mjs', 'tools/build.mjs', 'tools/archive.mjs', 'engines/postgres/schema.sql', 'seeds.txt', 'seeds-ard.txt', 'store-pages.json', 'README.md', 'LICENSE']) if (existsSync(f)) cpSync(f, `public/source/${f.split('/').pop()}`);
writeFileSync('public/build.json', readFileSync('data/build.json'));
console.log(`sea built: ${ids.length} entries`);
