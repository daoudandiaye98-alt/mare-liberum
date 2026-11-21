// Mare Liberum · look at one lake alone, without building the sea.
// Usage: node tools/lake-look.mjs apify-store [rows.ndjson]
// It reads the head of tools/build.mjs (helpers, pulls, the list of lakes) and stops before the build begins.
import { readFileSync, writeFileSync, rmSync } from 'node:fs';

const src = readFileSync(new URL('./build.mjs', import.meta.url), 'utf8'), cut = src.indexOf("\nmkdirSync('data'");
if (cut < 0) throw new Error('tools/build.mjs changed its shape: the line where the build begins was not found');
const head = new URL(`./.lake-look-${process.pid}.mjs`, import.meta.url);
writeFileSync(head, src.slice(0, cut) + '\nexport { LAKES, paged };\n');
try {
  const { LAKES, paged } = await import(head.href), lake = LAKES.find((l) => l.name === process.argv[2]);
  if (!lake) throw new Error('name a lake: ' + LAKES.map((l) => l.name).join(', '));
  const t = Date.now(), rows = await (lake.pull ? lake.pull() : paged(lake));
  console.log(`lake ${lake.name}: ${rows.length} rows, ${new Set(rows.map((r) => r.id)).size} ids, ${Math.round((Date.now() - t) / 1000)} s`);
  for (const r of [rows[0], rows[rows.length >> 1], rows[rows.length - 1]]) console.log(JSON.stringify(r));
  if (process.argv[3]) writeFileSync(process.argv[3], rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
} finally { rmSync(head, { force: true }); }
