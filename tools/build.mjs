// Mare Liberum · build the sea: pull every public lake, normalize to ARD-shaped rows, write one open data file.
// Usage: node tools/build.mjs            (pull live)        node tools/build.mjs --cache   (reuse data/*.ndjson)
import { createWriteStream, createReadStream, existsSync, readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, readdirSync } from 'node:fs';
import { createGzip, gunzipSync, gzipSync } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { normMcp, normX402, normA2AListed, normUcp, normAgentverse, normHfSpace, normVirtuals, norm8004, normApify, normNpm, norm402Index, normOpenApi, readDomain, fetchJson, safeUrl, clean } from '../node/core.mjs';
import { hayOf, metaOf } from '../node/mem.mjs';
import { installEgressGuard } from '../node/guard.mjs';
import { layOut } from './lay.mjs';
import { tldCountry, CENTROID } from '../node/places.mjs';

const UA = 'MareLiberum/1.1 (open agent index; pull-only; +https://github.com/daoudandiaye98-alt/mare-liberum)';
const CACHE = process.argv.includes('--cache');
// what the lakes and the stores answer is data from outside: nothing in it may send this build to the machine it runs on
installEgressGuard();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const keep = (rows, r) => { if (r) rows.push(r); };
// an address a stranger wrote is kept only when it is a plain public https address
const safe = (u) => safeUrl(u).then((x) => x.toString(), () => null);
const hostOf = (u) => { try { return new URL(u).hostname.toLowerCase(); } catch { return ''; } };
const keyOf = (u) => { try { const x = new URL(u); return `${x.hostname.toLowerCase()}${x.pathname.replace(/\/+$/, '')}`; } catch { return ''; } };
async function get(u, init = {}, tries = 5) {
  for (let i = 0; i < tries; i++) {
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
// The four lakes below ask a slow source three times at most (30 s each) and stop starting pages after about two minutes:
// none runs past four minutes, and a lake that is cut short keeps the rows it has.
async function apifyStore() {
  // the store lists its Actors by popularity and asks for no token; the sea carries the ones somebody besides the author
  // used this month, and the list ends where that use ends
  const rows = [], end = Date.now() + 120000;
  for (let offset = 0; offset < 60000 && Date.now() < end; offset += 1000) {
    let d; try { d = (await get(`https://api.apify.com/v2/store?limit=1000&offset=${offset}&sortBy=popularity`, {}, 3)).json?.data || {}; } catch (e) { if (!rows.length) throw e; break; }
    const items = d.items || [], before = rows.length; for (const a of items) keep(rows, normApify(a));
    // a page may hold fewer Actors than it counts, so the end is told by the store's total
    if (!items.length || offset + 1000 >= (Number(d.total) || 0) || rows.length - before < 20) break;
  }
  // the order shifts while the list is read: an Actor met twice counts once
  return [...new Map(rows.map((r) => [r.id, r])).values()];
}
async function npmMcp() {
  // packages whose authors call them MCP servers, the most downloaded first; one page a second at most (npm's rule for
  // crawlers), and the list ends where downloads fall below what a tool in use gets. Past its last page the search starts over.
  const rows = [], seen = new Set(), end = Date.now() + 120000;
  for (const word of ['mcp-server', 'modelcontextprotocol']) {
    let first = '';
    for (let from = 0; from < 10000 && Date.now() < end; from += 250) {
      let list; try { list = (await get(`https://registry.npmjs.org/-/v1/search?text=keywords:${word}&size=250&from=${from}`, {}, 3)).json?.objects || []; } catch (e) { if (!rows.length) throw e; break; }
      if (!list.length || (from && list[0]?.package?.name === first)) break; first ||= list[0]?.package?.name;
      for (const o of list) { const name = o?.package?.name; if (seen.has(name)) continue; seen.add(name); keep(rows, normNpm(o, await safe(String(o?.package?.links?.repository || '').replace(/^git\+/, '').replace(/\.git$/, '')))); }
      if (!list.some((o) => Number(o?.downloads?.monthly) >= 500)) break;
      await sleep(1000);
    }
  }
  return rows;
}
async function index402() {
  // what the paid lakes do not bring: endpoints paid over Lightning (L402) and MPP, and x402 sellers who registered themselves
  // and whose price answer the directory could read. The directory allows 100 calls a minute; the lake asks one at a time.
  const rows = [], end = Date.now() + 130000;
  for (const part of ['protocol=L402', 'protocol=MPP', 'protocol=x402&source=self-registered&verified=true']) {
    for (let offset = 0, total = 1; offset < total && Date.now() < end; offset += 200) {
      let j; try { j = (await get(`https://402index.io/api/v1/services?health=healthy&limit=200&${part}&offset=${offset}`, {}, 3)).json; } catch (e) { if (!rows.length) throw e; return fewPerHost(rows); }
      total = Number(j?.total) || 0;
      for (const s of j?.services || []) keep(rows, norm402Index(s, await safe(s?.url)));
      await sleep(400);
    }
  }
  return fewPerHost(rows);
}
// some hosts register one endpoint per question, by the thousand: the lake carries the 50 best measured of each host
function fewPerHost(rows, most = 50) {
  const per = new Map();
  return [...rows].sort((a, b) => b.quality - a.quality).filter((r) => { const h = hostOf(r.url), n = per.get(h) || 0; per.set(h, n + 1); return n < most; });
}
async function apisGuru() {
  // the open directory of OpenAPI descriptions (APIs.guru, CC0) is one file: one row per API, its preferred version
  const { json: j } = await get('https://api.apis.guru/v2/list.json', {}, 3), rows = [];
  for (const [name, api] of Object.entries(j && typeof j === 'object' ? j : {})) { const v = api?.versions?.[api.preferred] || Object.values(api?.versions || {}).pop(); keep(rows, normOpenApi(name, v, await safe(v?.swaggerUrl))); }
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
  { name: 'apify-store', pull: apifyStore },
  { name: 'apis-guru', pull: apisGuru },
  // lakes that follow the others (twins): they leave out what the sea already holds under another name
  { name: 'npm-mcp', pull: npmMcp, twins: true },
  { name: '402-index', pull: index402, twins: true },
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
// two names for one thing: the same package in the same registry, the same paid address (whatever the way of paying)
const twinKeys = (r) => [...(r.endpoints || []).filter((e) => e.transport === 'package' && e.identifier).map((e) => `${e.registry}:${e.identifier}`.toLowerCase()), ...(/-resource\+json$/.test(r.type || '') && r.url ? [keyOf(r.url)] : [])];
const held = new Set();
settled.forEach((s, i) => { if (s.status !== 'fulfilled') { lakeStats[LAKES[i].name] = 'pending: ' + s.reason?.message; console.log(`lake ${LAKES[i].name} follows at the next refresh`); } else if (!LAKES[i].twins) for (const r of s.value) { all.set(r.id, r); for (const k of twinKeys(r)) held.add(k); } });
settled.forEach((s, i) => {
  if (s.status !== 'fulfilled' || !LAKES[i].twins) return;
  let twins = 0; for (const r of s.value) { if (twinKeys(r).some((k) => held.has(k))) twins++; else all.set(r.id, r); }
  lakeStats[LAKES[i].name] = s.value.length - twins; console.log(`lake ${LAKES[i].name}: ${twins} rows are held by other lakes already, ${s.value.length - twins} join`);
});
held.clear();
if (all.size < 1000) throw new Error('the sea needs at least one full lake to build');

// Domains that speak for themselves: read their own manifests (ARD, AI Catalog, A2A agent card).
const seedFile = (f) => (existsSync(f) ? readFileSync(f, 'utf8').split('\n').map((l) => l.trim().toLowerCase()).filter((l) => l && !l.startsWith('#')) : []);
// Sellers that publish their own price list (/.well-known/x402) are found among the hosts of the paid lakes.
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
// the index on the map: entries whose publisher uses a country domain, placed at that country's centre (global endings are not placed)
{ const cc = {}; let placed = 0; for (const r of all.values()) { const c = tldCountry(r.publisher || ''); if (c) { cc[c] = (cc[c] || 0) + 1; placed++; } }
  { const k = readdirSync('public').find((f) => /^[0-9a-f]{32}\.txt$/.test(f)); if (k) writeFileSync('data/indexnow.json', JSON.stringify({ key: k.slice(0, -4) })); }
  writeFileSync('data/geo-index.json', JSON.stringify({ at: new Date().toISOString(), total: ids.length, placed, countries: Object.entries(cc).sort((a, b) => b[1] - a[1]).map(([c, n]) => ({ cc: c, n, lat: CENTROID[c][0], lon: CENTROID[c][1] })), note: 'entries of the open index whose publisher uses a country domain, placed at the centre of that country; .com, .io, .ai and other global endings are not placed' })); }
// The sea is written. What follows are the large lists of the Atlas (a million ranked domains, the block lists, the
// table of addresses): they need room of their own, and a build that keeps the whole sea in memory beside them peaks
// half a gigabyte higher, on a machine it shares with the node that answers. So the sea is let go of here.
const built = ids.length;
all.clear(); lakeByKey.clear(); lakeByHost.clear(); hosts.clear(); ids.length = 0; settled.length = 0;
// what travels beside the sea (the pages read first, the ledger's memory, fonts, faces, the open source): tools/lay.mjs
layOut();
// the frontier of the Atlas: the open rank list of the web (Majestic Million, CC BY 3.0), one domain per line
try {
  const r = await fetch('https://downloads.majestic.com/majestic_million.csv', { signal: AbortSignal.timeout(120000), headers: { 'user-agent': 'MareLiberum-Atlas/1.0 (+https://mareliberum.dev/atlas)' } });
  if (!r.ok) throw new Error(`status ${r.status}`);
  const lines = (await r.text()).split('\n'), out = [];
  for (let i = 1; i < lines.length; i++) { const d = (lines[i].split(',')[2] || '').trim().toLowerCase(); if (/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)) out.push(d); }
  if (out.length > 100000) { writeFileSync('data/ranks.txt.gz', gzipSync(out.join('\n') + '\n', { level: 9 })); console.log(`ranks: ${out.length} domains`); }
} catch (e) { console.log(`ranks: not read (${e.message}); the Atlas walks its own lists`); }
// the frontier in every country: the most visited sites per country from the Chrome UX Report (Google, CC BY 4.0), cached monthly by zakird/crux-top-lists;
// per country the top-1000 group and the first 2000 of the top-10k group; adult sites are left out; at most two hosts per domain
try {
  const { createGunzip } = await import('node:zlib'), { Readable } = await import('node:stream');
  const CC = 'ad ae af ag al am ao ar at au az ba bb bd be bf bg bh bi bj bn bo br bs bt bw by bz ca cd cf cg ch ci cl cm cn co cr cu cv cy cz de dj dk dm do dz ec ee eg er es et fi fj fr ga gb gd ge gh gm gn gq gr gt gw gy hk hn hr ht hu id ie il in iq ir is it jm jo jp ke kg kh km kn kr kw kz la lb lc li lk lr ls lt lu lv ly ma mc md me mg mk ml mm mn mo mr mt mu mv mw mx my mz na ne ng ni nl no np nz om pa pe pg ph pk pl pr ps pt py qa re ro rs ru rw sa sb sc sd se sg si sk sl sm sn so sr ss sv sy sz td tg th tj tl tm tn to tr tt tw tz ua ug us uy uz vc ve vn vu ws xk ye za zm zw'.split(' ');
  const ADULT = /porn|xxx|xvideo|xnxx|xhamster|(?<!es|sus|middle)sex|hentai|hentas|nude|nudi|nsfw|onlyfans|fansly|chaturbate|stripchat|bongacams|bonga-cams|cam4|camsoda|livejasmin|spankbang|youporn|redtube|tube8|eporner|brazzers|fapello|milf|escort|acompanhantes|erotic|erotik|(^|[.-])ero|darkero|zettai-ero|maturetube|rule34|booru|hanime|camgirl|camwhore|camrip|cameraprive|fetish|bdsm|naked|swinger|jizz|hookup|horny|beeg|tnaflix|motherless|thumbzilla|youjizz|txxx|hclips|vporn|porntrex|missav|javhd|jable|supjav|^jav|jav\.|javdock|javmix|javsek|javsub|javtiful|njavtv|91porn|avgle|lesbian|bokep|desi(?!re|gn)|leak|(?<!you|ru)tube|pinay|kantot|sulasok|(?<!news|\d)18(?!\d)|(?<!\d)69(?!\d)|nudo|hotx|madura|eroge|casino|toto|huren|hoki|petir|naga-|ledak|sorte|bingo|hotxv|hotebony|hotindian|hotpic|noodlemagazine|(^|\.)fans\.|\.fans$|myfans|fatalfans|vide[yiq]|vidkle|vidsey|vidayo|vidayu|ratuvid|saluranvid|dayonvid|indovid|babe|choti|beurette|bfvideo|mms(\.|$)|dropmms|spicymms|momvid|thisvid|thot|videocelebs|xgay|videosx|tamilprint|\.cam$|\.webcam$|(?<!maxx|cinem|brix|ne|scine)xx(?!l)|slot|togel|gacor|toto\d|188|69plus|cair\d/;
  // public block lists (blocklistproject/Lists, Unlicense): adult and gambling domains; a host is left out when it or a parent domain is listed
  const BLOCK = new Set();
  for (const f of ['porn-nl.txt', 'gambling-nl.txt']) { try { const r = await fetch(`https://raw.githubusercontent.com/blocklistproject/Lists/master/alt-version/${f}`, { signal: AbortSignal.timeout(60000) }); if (r.ok) for (const l of (await r.text()).split('\n')) if (l && l[0] !== '#') BLOCK.add(l.trim().toLowerCase()); } catch {} }
  const blocked = (h) => { const p = h.split('.'); for (let k = 0; k < p.length - 1; k++) if (BLOCK.has(p.slice(k).join('.'))) return true; return false; };
  console.log(`block lists: ${BLOCK.size} domains`);
  const baseOf = (h) => { const p = h.split('.'); return p.length > 2 && /^(co|com|ac|gov|org|net|edu|go|or|ne|gob|nic|mil)$/.test(p[p.length - 2]) && p[p.length - 1].length === 2 ? p.slice(-3).join('.') : p.slice(-2).join('.'); };
  const months = []; for (let i = 1; i <= 4; i++) { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - i); months.push(`${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`); }
  async function topOf(cc) {
    for (const month of months) {
      const ac = new AbortController(), r = await fetch(`https://raw.githubusercontent.com/zakird/crux-top-lists/main/data/country/${cc}/${month}.csv.gz`, { signal: ac.signal, headers: { 'user-agent': 'MareLiberum-Atlas/1.0 (+https://mareliberum.dev/atlas)' } }).catch(() => null);
      if (!r || !r.ok) continue;
      const src = Readable.fromWeb(r.body); src.on('error', () => {}); const gz = src.pipe(createGunzip()); gz.on('error', () => {});
      const top = [], rest = [], per = new Map(); let buf = '', done = false;
      const add = (o, n) => { let h; try { h = new URL(o).hostname.replace(/^www\d?\./, ''); } catch { return; } if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(h) || ADULT.test(h) || blocked(h) || (h.split('.').length > 2 && /\d/.test(h.split('.')[0]))) return; const b = baseOf(h), c = per.get(b) || 0; if (c >= 2) return; per.set(b, c + 1); (n <= 1000 ? top : rest).push(h); };
      try { for await (const chunk of gz) { buf += chunk.toString('utf8'); const lines = buf.split('\n'); buf = lines.pop(); for (const l of lines) { const [o, rk] = l.split(','); const n = Number(rk); if (!n) continue; if (n > 10000 || rest.length >= 2000) { done = true; break; } add(o, n); } if (done) break; } } catch {}
      src.destroy(); gz.destroy(); ac.abort();
      if (top.length) return { month, top, rest };
    }
    return null;
  }
  const out = {}; let i = 0;
  await Promise.all(Array.from({ length: 12 }, async () => { while (i < CC.length) { const c = CC[i++]; try { const x = await topOf(c); if (x) out[c] = x; } catch {} } }));
  const lines = Object.entries(out).map(([c, x]) => `${c}\t${x.month}\t${x.top.length}\t${[...x.top, ...x.rest].join(' ')}`);
  if (lines.length > 50) { writeFileSync('data/ranks-cc.txt.gz', gzipSync(lines.join('\n') + '\n', { level: 9 })); console.log(`ranks per country: ${lines.length} countries, ${lines.reduce((a, l) => a + l.split(' ').length, 0)} sites`); }
} catch (e) { console.log(`ranks per country: not read (${e.message})`); }
// the country a caller stands in: the free IP to Country Lite database by DB-IP (https://db-ip.com, CC BY 4.0), packed into one small
// table for nodes that stand alone (behind a CDN the country comes with every request)
if (!process.env.VERCEL) try {
  const { packGeo } = await import('../node/geoip.mjs');
  const split = (txt) => txt.split('\n').map((l) => l.trim().replace(/"/g, '').split(',')).filter((p) => p.length >= 3);
  const months = []; for (let i = 0; i <= 3; i++) { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - i); months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`); }
  let rows = [], of = '';
  for (const ym of months) {
    const r = await fetch(`https://download.db-ip.com/free/dbip-country-lite-${ym}.csv.gz`, { signal: AbortSignal.timeout(120000), headers: { 'user-agent': UA } }).catch(() => null);
    if (!r || !r.ok) { await r?.body?.cancel().catch(() => {}); continue; }
    rows = split(gunzipSync(Buffer.from(await r.arrayBuffer())).toString('utf8')); of = ym;
    if (rows.length > 50000) break;
  }
  // the same table as it is mirrored for package managers (sapics/ip-location-db), when the first address does not answer
  if (rows.length <= 50000) {
    rows = []; of = 'mirror';
    for (const f of ['dbip-country-ipv4.csv', 'dbip-country-ipv6.csv']) { const r = await fetch(`https://cdn.jsdelivr.net/npm/@ip-location-db/dbip-country/${f}`, { signal: AbortSignal.timeout(120000), headers: { 'user-agent': UA } }).catch(() => null); if (r?.ok) rows.push(...split(await r.text())); }
  }
  if (rows.length > 50000) { writeFileSync('data/geo-ip.bin.gz', packGeo(rows, of)); console.log(`countries by address: ${rows.length} rows (${of})`); }
  else console.log('countries by address: not read; visitors are counted without a country');
} catch (e) { console.log(`countries by address: not read (${e.message})`); }
writeFileSync('public/build.json', readFileSync('data/build.json'));
console.log(`sea built: ${built} entries`);
