// Country centres for the globe, from Natural Earth 1:50m (public domain) as packaged by world-atlas:
// the centroid of each country's largest polygon (so France is in France, not pulled towards Guiana),
// rounded to whole degrees. Output: "US39,-98;DE51,10;…" by ISO 3166-1 alpha-2.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { feature } from 'topojson-client';
import { geoCentroid, geoArea, geoContains } from 'd3-geo';
const require = createRequire(import.meta.url);
const world = require('world-atlas/countries-50m.json');
const iso = require('i18n-iso-countries');
const fc = feature(world, world.objects.countries);
const out = {}, miss = [], size = {}, twice = [];
for (const f of fc.features) {
  const a2 = f.id != null ? iso.numericToAlpha2(String(f.id).padStart(3, '0')) : null;
  if (!a2) { miss.push(f.properties.name + ' (' + f.id + ')'); continue; }
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  let best = null, bestA = -1;
  // a ring wound the other way reads as the rest of the globe: its true area is what is left of 4π
  for (const p of polys) { const g = { type: 'Polygon', coordinates: p }; let A = geoArea(g); if (A > 2 * Math.PI) A = 4 * Math.PI - A; if (A > bestA) { bestA = A; best = g; } }
  let [lon, lat] = geoCentroid(best);
  // a centroid can fall outside a crescent-shaped country: then take the vertex of the outline nearest to it
  if (!geoContains(best, [lon, lat])) { let d = 1e9, at = null; for (const [x, y] of best.coordinates[0]) { const q = (x - lon) ** 2 + (y - lat) ** 2; if (q < d) { d = q; at = [x, y]; } } [lon, lat] = at; }
  // Natural Earth lists some outlying islands under their country's number (Ashmore and Cartier under Australia): the largest one is the country
  if (size[a2] != null) twice.push(`${a2} ${f.properties.name}`);
  if (size[a2] == null || bestA > size[a2]) { size[a2] = bestA; out[a2] = [Math.round(lat), Math.round(lon)]; }
}
console.log('listed twice:', twice.join(', ') || 'none');
const str = Object.keys(out).sort().map((k) => `${k}${out[k][0]},${out[k][1]}`).join(';');
writeFileSync(new URL('../input/centres.txt', import.meta.url), str);
const LAND = readFileSync(new URL('../input/land.txt', import.meta.url), 'utf8').trim();
const isLand = (lat, lon) => { const r = Math.round((80 - lat) / 2), c = Math.round((lon + 180) / 2) % 180; if (r < 0 || r >= 70) return false; const v = parseInt(LAND[r * 45 + (c >> 2)], 16) || 0; return !!(v & (8 >> (c & 3))); };
const near = (lat, lon) => { for (const [a, b] of [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2], [2, 2], [-2, -2], [2, -2], [-2, 2]]) if (isLand(lat + a, lon + b)) return true; return false; };
const off = Object.keys(out).filter((k) => !near(out[k][0], out[k][1]));
console.log('not on or beside a land dot of the 2° grid (small islands are expected here):', off.map((k) => `${k}${out[k].join(',')}`).join(' '));
console.log(Object.keys(out).length, 'countries,', str.length, 'bytes; without a code:', miss.join(', ') || 'none');
for (const k of ['US', 'DE', 'FR', 'SG', 'FI', 'IE', 'NL', 'GB', 'JP', 'IN', 'BR', 'AU', 'CA', 'RU', 'CN', 'HK', 'KR', 'SE', 'NO', 'ID', 'MY', 'NZ', 'ZA', 'SN', 'PL', 'CH', 'AT', 'ES', 'IT', 'MX', 'AR', 'CL', 'TR', 'AE', 'IL', 'TW', 'VN', 'TH', 'UA', 'RO']) process.stdout.write(`${k}:${out[k] ? out[k].join(',') : '—'}  `);
console.log();
