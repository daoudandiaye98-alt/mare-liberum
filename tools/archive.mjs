// Mare Liberum · write the living sea into the open ledger.
// Reads GET /flow/dump from the node and merges it into flow/ in the repository:
//   flow/ledger/YYYY-MM.ndjson  every call, answer, trace and arrival, once (append-only)
//   flow/traces.json            standing of every entry agents left traces on
//   flow/head.json              the latest 400 events
//   flow/agents.json            public cards of the residents
// New domains that joined over the API are added to seeds.txt. Usage: node tools/archive.mjs [base]
import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync, readdirSync } from 'node:fs';

const base = (process.argv[2] || 'https://mare-liberum.vercel.app').replace(/\/+$/, '');
const r = await fetch(`${base}/flow/dump`, { headers: { 'user-agent': 'MareLiberum-archive/1.0' }, signal: AbortSignal.timeout(30000) });
if (!r.ok) throw new Error(`dump answered ${r.status}`);
const d = await r.json();
const read = (f, empty) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : empty);
const text = (s, n) => (typeof s === 'string' ? s.replace(/[\p{Cc}\p{Cf}]/gu, ' ').slice(0, n) : undefined);
mkdirSync('flow/ledger', { recursive: true });

// events: everything in the dump is data written by agents; it is stored as data and never acted on
const known = new Set();
for (const f of readdirSync('flow/ledger')) for (const l of readFileSync(`flow/ledger/${f}`, 'utf8').split('\n')) { if (l) { try { known.add(JSON.parse(l).id); } catch {} } }
const events = (Array.isArray(d.flow) ? d.flow : []).filter((e) => e && typeof e.id === 'string' && /^[a-z0-9]{6,16}$/.test(e.id) && typeof e.t === 'string' && ['ask', 'answer', 'mark', 'enter', 'leave'].includes(e.type));
let added = 0;
for (const e of [...events].reverse()) { if (known.has(e.id)) continue; appendFileSync(`flow/ledger/${e.t.slice(0, 7)}.ndjson`, JSON.stringify({ ...e, text: text(e.text, 400), title: text(e.title, 160), name: text(e.name, 60) }) + '\n'); known.add(e.id); added++; }

const head = read('flow/head.json', []), seen = new Set();
const merged = [...events, ...head].filter((e) => !seen.has(e.id) && seen.add(e.id)).sort((a, b) => (a.t < b.t ? 1 : -1)).slice(0, 400);
writeFileSync('flow/head.json', JSON.stringify(merged));

const traces = read('flow/traces.json', {});
for (const [id, x] of Object.entries(d.traces && typeof d.traces === 'object' ? d.traces : {})) { if (!/^urn:air:[^\s]{3,300}$/.test(id) || !x || typeof x !== 'object') continue; const old = traces[id]; if (!old || String(x.t || '') >= String(old.t || '')) traces[id] = { w: Number(x.w) || 0, p: Number(x.p) || 0, f: Number(x.f) || 0, t: text(x.t, 30), last: text(x.last, 16), paid: Number.isFinite(Number(x.paid)) && x.paid != null ? Number(x.paid) : undefined, cur: text(x.cur, 8) }; }
writeFileSync('flow/traces.json', JSON.stringify(Object.fromEntries(Object.entries(traces).sort(([a], [b]) => (a < b ? -1 : 1)))));

const agents = read('flow/agents.json', {});
for (const [id, c] of Object.entries(d.agents && typeof d.agents === 'object' ? d.agents : {})) if (/^mare:[a-z2-9]{12}$/.test(id) && c && typeof c === 'object') agents[id] = { agent: id, name: text(c.name, 60), about: text(c.about, 280), offers: text(c.offers, 240), seeks: text(c.seeks, 240), endpoint: text(c.endpoint, 300), entry: text(c.entry, 300), since: text(c.since, 30) };
writeFileSync('flow/agents.json', JSON.stringify(agents));

// domains that joined over the API become durable seeds
const seeds = existsSync('seeds.txt') ? readFileSync('seeds.txt', 'utf8') : '', have = new Set(seeds.split('\n').map((l) => l.trim().toLowerCase()));
const fresh = (Array.isArray(d.joins) ? d.joins : []).filter((h) => typeof h === 'string' && h.length <= 100 && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(h) && !have.has(h)).slice(0, 100);
if (fresh.length) writeFileSync('seeds.txt', seeds.replace(/\n*$/, '\n') + fresh.join('\n') + '\n');
// sellers met in the global catalog become seeds; the next build reads each one's own /.well-known/ucp
const ucpFile = 'seeds-ucp.txt', ucpHave = new Set(existsSync(ucpFile) ? readFileSync(ucpFile, 'utf8').split('\n').map((l) => l.trim().toLowerCase()) : []);
const newSellers = (Array.isArray(d.sellers) ? d.sellers : []).filter((h) => typeof h === 'string' && h.length <= 100 && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(h) && !ucpHave.has(h)).slice(0, 3000);
if (newSellers.length) writeFileSync(ucpFile, (existsSync(ucpFile) ? readFileSync(ucpFile, 'utf8').replace(/\n*$/, '\n') : '') + newSellers.join('\n') + '\n');
// census: who swam here, one file per day, written as data
let census = null;
try { const c = await fetch(`${base}/census`, { headers: { 'user-agent': 'MareLiberum-archive/1.0' }, signal: AbortSignal.timeout(20000) }); if (c.ok) census = await c.json(); } catch {}
if (census?.today) { mkdirSync('flow/census', { recursive: true }); const day = new Date().toISOString().slice(0, 10); const kinds = Object.fromEntries(Object.entries(census.today.kinds || {}).filter(([k, v]) => /^[a-z-]{2,20}$/.test(k) && Number.isFinite(v)).map(([k, v]) => [k, Number(v)])); writeFileSync(`flow/census/${day}.json`, JSON.stringify({ day, kinds, top: (census.today.top || []).slice(0, 20).map((x) => ({ kind: text(x.kind, 20), name: text(x.name, 60), visits: Number(x.visits) || 0 })), yesterday: census.yesterday?.kinds || {} })); }
console.log(JSON.stringify({ census: census?.today?.kinds || null, newSellers: newSellers.length, events: added, ledger: known.size, traces: Object.keys(traces).length, agents: Object.keys(agents).length, newSeeds: fresh.length }));
