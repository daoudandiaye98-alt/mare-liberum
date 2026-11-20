// Mare Liberum · the Atlas crawler — one slice of the web per GitHub Actions job.
// Usage: node tools/atlas.mjs --job 0 --jobs 20 --limit 1000000 --out part-0.ndjson.gz
// The list: the Majestic Million (CC BY 3.0, majestic.com), the sea's own list of the most visited sites, and every site
// agents asked the sea about (/atlas/wanted.txt). Each site is read once: robots.txt first, and where it says no to
// MareLiberum-Atlas nothing else. A handful of small requests per site, many sites side by side, never many on one site.
import { createWriteStream } from 'node:fs';
import { createGzip } from 'node:zlib';
import { profileSite, siteOf } from '../node/atlas.mjs';
import { safeHost } from '../node/check.mjs';
import { TOP } from '../node/web.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const JOB = Number(arg('job', 0)), JOBS = Number(arg('jobs', 1)), LIMIT = Number(arg('limit', 1000000)), CONC = Number(arg('conc', 96)), OUT = arg('out', `part-${JOB}.ndjson.gz`);
const BUDGET = Number(arg('minutes', 170)) * 60000, SEA = arg('sea', 'https://mareliberum.dev'), UA = 'MareLiberum-Atlas/1.0 (+https://mareliberum.dev/atlas)';
const started = Date.now();

async function text(url) { for (let i = 0; i < 4; i++) { try { const r = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(120000) }); if (r.ok) return await r.text(); } catch {} await new Promise((r) => setTimeout(r, 3000 * (i + 1))); } return ''; }

// the list, the same in every job: ranked sites first, then the sea's own and the wanted ones
const seen = new Map();
const add = (raw, rank) => { const h = safeHost(String(raw || '').trim()); if (!h) return; const d = siteOf(h); if (!seen.has(d)) seen.set(d, rank || 0); };
const csv = await text('https://downloads.majestic.com/majestic_million.csv') || await text('http://downloads.majestic.com/majestic_million.csv');
for (const line of csv.split('\n').slice(1)) { const c = line.split(','); if (c.length > 3) { const rank = Number(c[0]); if (rank > 0 && rank <= LIMIT) add(c[2], rank); } }
console.log(`majestic: ${seen.size} sites`);
for (const h of TOP) add(h, 0);
for (const h of (await text(`${SEA}/atlas/wanted.txt`)).split('\n')) add(h, 0);
const all = [...seen.entries()];
const mine = all.filter((_, i) => i % JOBS === JOB);
console.log(`job ${JOB}/${JOBS}: ${mine.length} of ${all.length} sites`);

const gz = createGzip({ level: 6 }); const out = createWriteStream(OUT); gz.pipe(out);
let done = 0, ok = 0, next = 0;
const one = ([d, rank]) => Promise.race([profileSite(d, { rank: rank || undefined }), new Promise((r) => setTimeout(() => r({ d, at: new Date().toISOString().slice(0, 10), rk: rank || undefined, s: 0, x: 'timeout' }), 30000))]).catch(() => null);
await Promise.all(Array.from({ length: CONC }, async () => {
  while (next < mine.length && Date.now() - started < BUDGET) {
    const item = mine[next++]; const p = await one(item); done++;
    if (p) { if (p.s === 200) ok++; if (!gz.write(JSON.stringify(p) + '\n')) await new Promise((r) => gz.once('drain', r)); }
    if (done % 2000 === 0) console.log(`  ${done}/${mine.length} · home page read ${ok} · ${Math.round((Date.now() - started) / 60000)} min`);
  }
}));
gz.end(); await new Promise((r) => out.on('close', r));
console.log(`job ${JOB}: ${done} sites, ${ok} home pages read, ${mine.length - done} left for the next run · ${Math.round((Date.now() - started) / 60000)} min`);
