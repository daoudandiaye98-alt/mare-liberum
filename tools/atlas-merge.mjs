// Mare Liberum · the Atlas, put together: every job's slice becomes one open data set the sea reads file by file.
// Usage: node tools/atlas-merge.mjs <dir with part-*.ndjson.gz> <out dir>
//   s/<shard>.json  the sites, 4096 files by a hash of the site name          (what /site/<domain> reads)
//   i/<bucket>.json words → the sites that best answer them, 1024 files        (what /find reads)
//   l/<n>.txt       the sites in rank order, 40,000 per file                   (the sitemaps)
//   stats.json      what the web lets agents do, counted
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { gunzipSync, constants } from 'node:zlib';
import { join } from 'node:path';
import { shardOf, idxOf, wordsOf, prior, ATLAS_LIST } from '../node/atlas.mjs';
import { AGENTS } from '../node/check.mjs';

const [, , IN = 'parts', OUT = 'atlas'] = process.argv;
const PER_WORD = 60;
const files = []; (function walk(d) { for (const f of readdirSync(d, { withFileTypes: true })) { const p = join(d, f.name); if (f.isDirectory()) walk(p); else if (/\.ndjson\.gz$/.test(f.name)) files.push(p); } })(IN);
const sites = new Map();
// the last map keeps what it had for sites this run did not reach
const prev = join(OUT, 's'); let kept = 0;
if (existsSync(prev)) for (const f of readdirSync(prev)) { try { for (const [d, p] of Object.entries(JSON.parse(readFileSync(join(prev, f), 'utf8')))) { sites.set(d, p); kept++; } } catch {} }
let fresh = 0;
// a part cut off mid-run still gives every whole line it holds
for (const f of files) for (const line of gunzipSync(readFileSync(f), { finishFlush: constants.Z_SYNC_FLUSH }).toString('utf8').split('\n')) { if (!line) continue; try { const p = JSON.parse(line); if (!p?.d) continue; const old = sites.get(p.d); if (!old || p.s || !old.s) { if (old?.rk && !p.rk) p.rk = old.rk; sites.set(p.d, p); fresh++; } } catch {} }
console.log(`${files.length} parts · ${fresh} sites read now · ${kept} kept from before · ${sites.size} in the atlas`);

mkdirSync(join(OUT, 's'), { recursive: true }); mkdirSync(join(OUT, 'i'), { recursive: true }); mkdirSync(join(OUT, 'l'), { recursive: true });
const shards = new Map();
for (const [d, p] of sites) { const k = shardOf(d); if (!shards.has(k)) shards.set(k, {}); shards.get(k)[d] = p; }
for (const [k, o] of shards) writeFileSync(join(OUT, 's', `${k}.json`), JSON.stringify(o));

// words: each word keeps the sites that answer it best (how strongly the word belongs to the site × how usable the site is)
const names = [...sites.keys()], words = new Map();
names.forEach((d, n) => { const p = sites.get(d); if (p.s !== 200) return; const pr = prior(p); for (const [w, wt] of wordsOf(p)) { let l = words.get(w); if (!l) words.set(w, (l = [])); l.push(n, wt * pr); } });
const buckets = new Map(); let entries = 0;
for (const [w, l] of words) {
  const n = l.length / 2; if (n < 2 && l[1] < 1) continue;
  const pairs = []; for (let i = 0; i < l.length; i += 2) pairs.push([l[i], l[i + 1]]);
  pairs.sort((a, b) => b[1] - a[1]);
  const k = idxOf(w); if (!buckets.has(k)) buckets.set(k, {});
  buckets.get(k)[w] = pairs.slice(0, PER_WORD).map(([i, s]) => [names[i], Math.round(s * 1000) / 1000]); entries += Math.min(n, PER_WORD);
}
for (const [k, o] of buckets) writeFileSync(join(OUT, 'i', `${k}.json`), JSON.stringify(o));

const ranked = names.filter((d) => sites.get(d).s === 200).sort((a, b) => (sites.get(a).rk || 9e9) - (sites.get(b).rk || 9e9));
for (let i = 0; i * ATLAS_LIST < ranked.length; i++) writeFileSync(join(OUT, 'l', `${i}.txt`), ranked.slice(i * ATLAS_LIST, (i + 1) * ATLAS_LIST).join('\n') + '\n');

// what the web lets agents do, counted over every site whose home page answered
const live = [...sites.values()].filter((p) => p.s === 200), n = live.length, pct = (k) => (n ? Math.round((1000 * k) / n) / 10 : 0), pctAll = (k) => (sites.size ? Math.round((1000 * k) / sites.size) / 10 : 0);
const stats = {
  at: new Date().toISOString(), sites: sites.size, read: n, lists: Math.ceil(ranked.length / ATLAS_LIST), words: words.size, entries,
  share: { searchLink: pct(live.filter((p) => p.q).length), searchFromOpenSearch: pct(live.filter((p) => p.qf === 'opensearch').length), feeds: pct(live.filter((p) => p.fd).length), sitemap: pct(live.filter((p) => p.sm).length), llmsTxt: pct(live.filter((p) => p.ll).length), agentCard: pct(live.filter((p) => p.ac).length), jsonLd: pct(live.filter((p) => p.ld).length), needsJavaScript: pct(live.filter((p) => p.sh).length), developerPages: pct(live.filter((p) => p.dv).length), wall: pctAll([...sites.values()].filter((p) => p.rb === 'wall').length), saysNoToAtlas: pctAll([...sites.values()].filter((p) => p.us === 0).length) },
  blocked: AGENTS.map((a) => ({ name: a.name, op: a.op, role: a.role, share: pct(live.filter((p) => (p.bl || []).includes(a.name)).length) })).sort((a, b) => b.share - a.share),
  grades: ['A', 'B', 'C', 'D', 'E'].map((g) => ({ g, n: live.filter((p) => p.g === g).length })),
  top: ranked.slice(0, 50).map((d) => { const p = sites.get(d); return { site: d, rank: p.rk, grade: p.g, search: !!p.q }; }),
  source: 'MareLiberum-Atlas, read from what each site publishes; ranks from the Majestic Million (CC BY 3.0, majestic.com). Open data, CC BY 4.0.',
};
writeFileSync(join(OUT, 'stats.json'), JSON.stringify(stats, null, 1));
writeFileSync(join(OUT, 'README.md'), `# Mare Liberum Atlas\n\nThe web as an agent needs it: for ${n.toLocaleString('en')} websites, how to search them with one link, whether agents may read them, their feeds, sitemaps, sections and developer pages.\n\nRead it at https://mareliberum.dev/sites and https://mareliberum.dev/site/<domain>. Open data, CC BY 4.0. Ranks from the Majestic Million (CC BY 3.0).\n\nMade by MareLiberum-Atlas (https://mareliberum.dev/atlas), which follows robots.txt.\n`);
console.log(JSON.stringify({ sites: stats.sites, read: n, words: words.size, entries, share: stats.share }, null, 1));
