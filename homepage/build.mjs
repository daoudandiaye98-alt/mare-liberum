// Mare Liberum home page: one source, two outputs.
//   node homepage/build.mjs            builds both and says whether site/index.html is what the sources give
//   node homepage/build.mjs --write    also writes site/index.html (the page the node serves)
//   dist/preview/index.html     self-contained (fonts inlined, a real snapshot baked in), for a look without the sea behind it
//   dist/production/index.html  the page of the node: its own fonts, live data, the node's server-side hooks intact
// The head of the page (title, canonical, Open Graph, structured data) is kept from site/index.html as it stands.
// The pages below the home page share one look (src/depth.css, depth.js, scenes.js; node/skin.mjs dresses them). The node
// answers for those three files itself, so the build writes them into node/skin-assets.mjs, with the same --write.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(fileURLToPath(import.meta.url));
const rd = (f) => readFileSync(join(root, f), 'utf8');
const REPO = process.env.MARE_REPO || join(root, '..');
const PUBLIC = 'https://mareliberum.dev';
const R = new Function(rd('src/render.js') + '\nreturn R;')();
const snap = JSON.parse(rd('input/live.json'));
const old = readFileSync(join(REPO, 'site/index.html'), 'utf8');
const LAND = (old.match(/const LAND = '([0-9a-f]+)'/) || [])[1] || rd('input/land.txt').trim();
if (LAND.length !== 70 * 45) throw new Error('land grid: unexpected size ' + LAND.length);

// The four font files are the ones the node serves (site/fonts). Public Sans sets everything a visitor or an agent may
// bring and is the whole Latin file of Fontsource; the two display faces are cut down to what the page sets in them
// (tools/fonts.py writes them).
const FONTS = [
  ['Anybody', 'anybody-display.woff2', 'font-weight:800 900;font-stretch:50% 150%;font-style:normal'],
  ['Public Sans', 'public-sans-latin-wght-normal.woff2', 'font-weight:100 900;font-style:normal'],
  ['Public Sans', 'public-sans-latin-wght-italic.woff2', 'font-weight:100 900;font-style:italic'],
  ['EB Garamond', 'eb-garamond-voice-italic.woff2', 'font-weight:400 600;font-style:italic'],
];
const fontPath = (name) => join(REPO, 'site/fonts', name);
const face = (inline) => FONTS.map(([fam, name, d]) => `@font-face{font-family:"${fam}";src:url(${inline ? `data:font/woff2;base64,${readFileSync(fontPath(name)).toString('base64')}` : `/fonts/${name}`}) format("woff2");${d};font-display:swap}`).join('\n')

const safe = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
// what the preview carries of the sea: only what the page shows
const slim = (d) => ({ at: d.at, clock: d.clock, residents: d.residents, last24h: d.last24h, buoys: d.buoys, arena: d.arena, version: d.version, index: d.index,
  roles: d.roles, rolesYesterday: d.rolesYesterday, clients: (d.clients || []).slice(0, 8), web: d.web,
  brain: { ...d.brain, top: (d.brain?.top || []).slice(0, 6).map((p) => ({ title: p.title, to: p.to, go: p.go, task: p.task, strength: p.strength, walks: p.walks, worked: p.worked, failed: p.failed, checked: !!p.checked })) },
  geo: { cells: d.geo?.cells, countries: d.geo?.countries, days: d.geo?.days, since: d.geo?.since },
  feed: (d.feed || []).slice(0, 12).map((e) => ({ t: e.t, type: e.type, name: e.name, text: e.text })) });
const slimPath = (p) => ({ title: p.title, to: p.to, go: p.go, strength: p.strength, walks: p.walks, worked: p.worked, failed: p.failed, checked: !!p.checked, from: p.from });
const examples = () => { const brain = {}, check = {};
  for (const [q, f] of [['running shoes', 'brain-running-shoes.json'], ['find MCP servers for a task', 'brain-find-MCP-servers-for-a-t.json'], ['pay for an API call with stablecoins x402', 'brain-pay-for-an-API-call-with.json']]) { const b = JSON.parse(rd('input/' + f)); brain[q] = { paths: (b.paths || []).slice(0, 6).map(slimPath), places: (b.places || []).slice(0, 5).map(slimPath) }; }
  for (const [h, f] of [['wikipedia.org', 'check-wikipedia.json'], ['mareliberum.dev', 'check-mare.json']]) { const c = JSON.parse(rd('input/' + f)); check[h] = { host: c.host, reachable: c.reachable, at: c.at, score: c.score, grade: c.grade, agents: c.agents, parts: c.parts, note: c.note, cached: c.cached, offers: c.offers }; }
  return { brain, check }; };

// one centre per country (tools/centres.mjs, from Natural Earth): where a country lights up when the node knows nothing finer
const CC = rd('input/centres.txt').trim();
if (!/^([A-Z]{2}-?\d+,-?\d+;?)+$/.test(CC)) throw new Error('country centres: unexpected form');
const WAIT = 'Loading live data…';

// The waterline of the CSS sea: the wave the shader draws and the page script cuts the monument by, at its first moment,
// taken from the page script itself so there is one formula. Points in px from the left edge, 12 px apart, far enough for
// any screen; beyond that the line runs level.
const waveAt = new Function('return ' + ((rd('src/app.js').match(/const waveAt = (\(x, t\) => [^;]+);/) || [])[1] || 'null'))();
if (typeof waveAt !== 'function') throw new Error('the wave formula was not found in the page script');
const WAVE = (() => { let p = ''; for (let x = 0; x <= 4008; x += 12) p += `${x}px ${(14 + waveAt(x, 0)).toFixed(1)}px,`; return p + 'max(100%,4008px) 14px,max(100%,4008px) 100%,0 100%'; })();

function head(mode) {
  if (mode === 'preview') return `<title>Mare Liberum Homepage</title>\n<meta name="description" content="Preview of the Mare Liberum home page: the internet of AI agents, live. Numbers are a real snapshot of ${snap.at.slice(0, 10)}.">\n<meta name="theme-color" content="#dbe9f3">`;
  // production keeps every tag the node, search engines and agents already rely on
  let h = old.slice(old.indexOf('<title>'), old.indexOf('<style>'));
  h = h.replace(/<link rel="preload"[^>]*>\n?/g, '').replace(/<noscript><style>[^<]*<\/style><\/noscript>\n?/g, '').replace(/(<meta name="theme-color" content=")[^"]*(")/, '$1#dbe9f3$2');
  // the picture a shared link shows is the page's own opening scene (tools/og.mjs): its description says what is on it
  h = h.replace(/(<meta property="og:image:alt" content=")[^"]*(")/, '$1The name Mare Liberum standing in a sea at sunrise, cut by the waterline, above the line: The internet of AI agents, live.$2');
  // the site's structured data named "potentialAction" twice, so readers kept only the last one: all three searches go in one list
  h = h.replace(/("potentialAction":\[)(.*?)(\],"description":"[^"]*"),"potentialAction":(\{"@type":"SearchAction".*?"query-input":"[^"]*"\})(\},\{"@type":"Dataset")/s, (m, a, list, c, one, z) => a + list + ',' + one + c + z);
  for (const m of h.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)) {
    const g = JSON.parse(m[1])['@graph'] || [];
    for (const o of g) { const raw = JSON.stringify(o); if (o['@type'] === 'WebSite' && (!Array.isArray(o.potentialAction) || o.potentialAction.length !== 3)) throw new Error('structured data: expected the three searches of the site in one list, found ' + raw.slice(0, 200)); }
    if ((m[1].match(/"potentialAction":/g) || []).length !== 1) throw new Error('structured data: "potentialAction" is named more than once');
  }
  return h.trim() + `\n<link rel="preload" href="/fonts/anybody-display.woff2" as="font" type="font/woff2" crossorigin>\n<link rel="preload" href="/fonts/public-sans-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>`;
}

function build(mode) {
  const live = mode === 'production', B = live ? '' : PUBLIC, d = snap, h = R.headline(d);
  let names = null; try { names = new Intl.DisplayNames(['en'], { type: 'region' }); } catch {}
  const num = (k) => (live ? '–' : R.fmt(h[k]));
  const v = {
    B, PUBLIC: live ? 'https://mare-liberum.vercel.app' : PUBLIC,
    kick: live ? 'Live · the open sea for agents' : `Preview · counted ${d.at.slice(0, 10)}, ${R.utc(d.at)} UTC`,
    stamp: live ? 'Loading live data…' : `A real snapshot of the sea, counted ${d.at.slice(0, 10)} at ${d.at.slice(11, 19)} UTC · Atlantis day ${d.clock?.day}, hour ${d.clock?.hour} · version ${d.version}`,
    aiy: live ? '' : (h.aiY ? ` · the day before ${R.fmt(h.aiY)}` : ''),
    // until the first count arrives the node's page says so; the kinds of visitor are sent with a place for each number
    rolesRows: live ? R.rolesFrame() : R.rolesRows(d), clientsRows: live ? R.quiet(WAIT) : R.clientsRows(d, 6),
    feedItems: live ? '<li class="empty">Listening…</li>' : R.feedItems(d, 0, 7),
    countriesList: live ? '<ol class="countries" id="countries"><li class="empty">The map fills as requests arrive.</li></ol>' : `<ol class="countries" id="countries">${R.countriesItems(d, names)}</ol>`,
    cellsItems: live ? '' : R.cellsItems(d), watersHidden: !live && R.areas(d) ? '' : ' hidden', globeHow: R.globeHow(live || R.areas(d)),
    webRows: live ? R.quiet(WAIT) : R.webRows(d), kindsRows: live ? R.quiet(WAIT) : R.kindsRows(d), topPaths: live ? `<li class="empty">${WAIT}</li>` : R.topPaths(d),
    tClock: live ? '&nbsp;' : `Day ${d.clock?.day}`, tArena: live ? '&nbsp;' : `${R.fmt(d.arena?.brevets)} Brevet${d.arena?.brevets === 1 ? '' : 's'}`, tSeals: live ? '&nbsp;' : `${R.fmt(d.last24h?.seals)} checks`, tBuoys: live ? '&nbsp;' : `${R.fmt(d.buoys?.shellsThisMonth)} shells`,
    since: live ? '' : R.pace(d),
    tDay: live ? 'day –' : `day ${d.clock?.day}`, geoSpan: live ? 'in the last 30 days' : R.geoSpan(d),
  };
  for (const k of ['ai', 'people', 'ratio', 'one', 'residents', 'index', 'paths', 'walks', 'ratings', 'memories', 'countries', 'webChecked', 'webBlock', 'webAssist', 'webLlms', 'webAvg']) v[k] = num(k);
  const js = (rd('src/render.js') + '\n' + rd('src/app.js'))
    .replace('/*@LIVE*/false', String(live)).replace("'/*@B*/'", JSON.stringify(B)).replace('/*@EX*/null', live ? 'null' : safe(examples()))
    .replace("'/*@LAND*/'", JSON.stringify(LAND)).replace("'/*@CC*/'", JSON.stringify(CC)).replace('`/*@FRAG*/`', () => '`' + rd('src/sea.frag').replace(/^\s*\/\/.*$/gm, '').replace(/\n{2,}/g, '\n').trim() + '`');
  if (/<\/script/i.test(js)) throw new Error('script would close early');
  let out = rd('src/page.html')
    .replace('<!--@HEAD-->', () => head(mode)).replace('/*@FONTFACE*/', () => face(!live)).replace('/*@CSS*/', () => rd('src/style.css').replace('/*@WAVE*/', WAVE))
    .replace('<!--@SNAP-->', () => (live ? '' : `<script type="application/json" id="snap">${safe(slim(d))}</script>`))
    .replace('/*@JS*/', () => js);
  out = out.replace(/\{\{(\w+)\}\}/g, (m, k) => { if (!(k in v)) throw new Error('no value for ' + m); return v[k]; });
  const dir = join(root, 'dist', mode); mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), out);
  if (live) built = out;
  return `${mode}: ${(Buffer.byteLength(out) / 1024).toFixed(0)} KB`;
}
let built = '';
console.log(build('preview'), '|', build('production'));
const same = built === old;
if (process.argv.includes('--write') && !same) { writeFileSync(join(REPO, 'site/index.html'), built); console.log('site/index.html written'); }
else console.log(same ? 'site/index.html is what the sources give' : 'site/index.html differs from the sources (node homepage/build.mjs --write)');

// the look of the pages below the home page, as the node serves it
{
  const css = rd('src/depth.css').replace('/*@FONTFACE*/', () => face(false)).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n\s*/g, '\n').replace(/\n+/g, '\n').trim();
  const lean = (js) => js.split('\n').filter((l) => !/^\s*\/\//.test(l) && !/^\s*\/\* -{4,}.*-{4,} \*\/\s*$/.test(l)).join('\n').replace(/\n{2,}/g, '\n').trim();
  const scenes = lean(rd('src/scenes.js')), js0 = lean(rd('src/depth.js'));
  if (!js0.includes('/*@V*/')) throw new Error('depth.js: the place for the version is missing');
  const v = createHash('sha256').update(css).update(js0).update(scenes).digest('hex').slice(0, 10), js = js0.replace('/*@V*/', v);
  const out = `// Mare Liberum · the files of the look of the pages below the home page (see node/skin.mjs).\n// Written by homepage/build.mjs from homepage/src/depth.css, depth.js and scenes.js. Change those, not this.\nexport const V = '${v}';\nexport const CSS = ${JSON.stringify(css)};\nexport const JS = ${JSON.stringify(js)};\nexport const SCENES = ${JSON.stringify(scenes)};\n`;
  const file = join(REPO, 'node/skin-assets.mjs'), was = existsSync(file) ? readFileSync(file, 'utf8') : '';
  mkdirSync(join(root, 'dist', 'skin'), { recursive: true });
  for (const [name, text] of [['depth.css', css], ['depth.js', js], ['depth-scenes.js', scenes]]) writeFileSync(join(root, 'dist', 'skin', name), text);
  const size = (x) => (Buffer.byteLength(x) / 1024).toFixed(1);
  console.log(`look ${v}: depth.css ${size(css)} KB | depth.js ${size(js)} KB | depth-scenes.js ${size(scenes)} KB`);
  if (process.argv.includes('--write') && was !== out) { writeFileSync(file, out); console.log('node/skin-assets.mjs written'); }
  else console.log(was === out ? 'node/skin-assets.mjs is what the sources give' : 'node/skin-assets.mjs differs from the sources (node homepage/build.mjs --write)');
}
