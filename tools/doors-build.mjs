// Builds node/bangs-data.mjs: the long tail of the routing table — site search links of thousands of websites,
// sorted by what they are good for. Source: the open bang list of Kagi Search (https://github.com/kagisearch/bangs,
// MIT, © 2024 Kagi Search; the idea of bangs comes from DuckDuckGo). Ranks: Majestic Million (CC BY 3.0).
//   node tools/doors-build.mjs [bangs.json] [majestic_million.csv]
// Without files it downloads both. The output is a plain module, so the sea needs no build step to route.
import { readFileSync, writeFileSync } from 'node:fs';

const [, , bangsFile, ranksFile, checkedFile] = process.argv;
// tools/doors-verify.mjs wrote what each door answered to a program; with that file only doors that opened stay
const checked = checkedFile ? JSON.parse(readFileSync(checkedFile, 'utf8')) : null;
const get = async (file, url) => (file ? readFileSync(file, 'utf8') : await (await fetch(url, { headers: { 'user-agent': 'MareLiberum-Atlas/1.0 (+https://mareliberum.dev/atlas)' } })).text());
const bangs = JSON.parse(await get(bangsFile, 'https://raw.githubusercontent.com/kagisearch/bangs/main/data/bangs.json'));
const rankCsv = await get(ranksFile, 'https://downloads.majestic.com/majestic_million.csv');
const rank = new Map();
for (const line of rankCsv.split('\n').slice(1)) { const c = line.split(','); if (c[2]) rank.set(c[2], Number(c[0])); }
// a site on a shared host (a blog, a wiki farm, a pages host) has no rank of its own; it never borrows its host's
const SHARED = /(^|\.)(blogspot\.[a-z.]+|wordpress\.com|github\.io|gitlab\.io|fandom\.com|wikia\.com|wikia\.org|tumblr\.com|medium\.com|substack\.com|neocities\.org|weebly\.com|wixsite\.com|sites\.google\.com|readthedocs\.io|readthedocs\.org|netlify\.app|vercel\.app|pages\.dev|herokuapp\.com|appspot\.com|sourceforge\.net|typepad\.com|livejournal\.com|wikidot\.com|miraheze\.org|gamepedia\.com|shoutwiki\.com|altervista\.org|free\.fr|over-blog\.com|canalblog\.com|hatenablog\.com|exblog\.jp|fc2\.com|web\.app|firebaseapp\.com|azurewebsites\.net|cloudfront\.net|amazonaws\.com|summon\.serialssolutions\.com|exlibrisgroup\.com|bibliocommons\.com|sirsi\.net|aspendiscovery\.org)$/i;
const rankOf = (host) => { const own = rank.get(host); if (own) return own; if (SHARED.test(host)) return 0; const parts = host.split('.'); for (let i = 1; i < parts.length - 1; i++) { const r = rank.get(parts.slice(i).join('.')); if (r) return r; } return 0; };

// Kagi's shelf (category / subcategory) → the topic of the sea
const SHELF = [
  [/^Research \/ (Academic|AI)/, 'research'], [/^Research \/ Health/, 'health'],
  [/^Tech \/ (Programming|Language|Libraries|Tools|Downloads \(code\))/, 'code'], [/^Tech \/ (Sysadmin|Domains|domains)/, 'ops'],
  [/^Tech \/ Downloads/, 'software'], [/^Tech \/ (Blogs|Companies|Startups)/, 'technews'], [/^Tech \/ Design/, 'images'], [/^Tech \/ Cryptocurrency/, 'finance'],
  [/^Research \/ Reference \(words/, 'language'], [/^Translation \/ General/, 'language'],
  [/^Research \/ (Reference|Topical)/, 'reference'], [/^Research \/ Learning/, 'learning'], [/^Research \/ Food/, 'food'],
  [/^Research \/ Government/, 'government'], [/^Research \/ Law/, 'law'], [/^Research \/ Travel/, 'travel'],
  [/^Research \/ Local/, 'local'], [/^Online Services \/ Maps/, 'local'], [/^Research \/ Real Estate/, 'realestate'],
  [/^Shopping \//, 'shopping'], [/^News \/ Weather/, 'weather'], [/^News \/ Business/, 'finance'], [/^News \//, 'news'],
  [/^(Entertainment|Multimedia) \/ (Movies|TV)/, 'screen'], [/^(Entertainment|Multimedia|Tech) \/ Games/, 'games'],
  [/^Multimedia \/ Music( \(Folk\))?$/, 'music'], [/^Entertainment \/ (Music|Audio|Radio)/, 'music'],
  [/^Multimedia \/ Videos?$/, 'video'], [/^Multimedia \/ Images/, 'images'], [/^Multimedia \/ Books/, 'books'], [/^Shopping \/ Books/, 'books'], [/^Entertainment \/ Comics/, 'books'],
  [/^Entertainment \/ Sports/, 'sports'], [/^(Entertainment|Online Services) \/ Events/, 'events'], [/^Online Services \/ Jobs/, 'jobs'],
  [/^Online Services \/ Social/, 'community'], [/^Entertainment \/ (Forum|Blogs)/, 'community'], [/^Online Services \/ (Tools|Tracking)/, 'tools'],
  [/^Online Services \/ Search( \(non-US\))?$/, 'websearch'],
];
// kept out of the routing table: search engines that answer programs with a wall, people lookups, adult and pirate sites
const HOST_OUT = /(^|\.)(google\.[a-z.]+|bing\.com|kagi\.com|duckduckgo\.com|startpage\.com|ecosia\.org|qwant\.com|yandex\.[a-z.]+|baidu\.com|so\.com|yahoo\.[a-z.]+|aol\.com|ask\.com|4chan\.org|4chansearch\.com|4plebs\.org|8kun\.top|kiwifarms\.[a-z]+|rebeccablacktech\.com|desuarchive\.org|libgen\.[a-z]+|sci-hub\.[a-z]+|z-lib\.[a-z]+|annas-archive\.[a-z]+|thepiratebay\.[a-z]+|1337x\.[a-z]+|rarbg\.[a-z]+|nyaa\.[a-z]+|rutracker\.[a-z]+|linuxtracker\.org|pipl\.com|mugshots\.com|spokeo\.com|whitepages\.com|peekyou\.com|radaris\.com|intelius\.com|beenverified\.com|yasni\.[a-z]+|192\.com|zabasearch\.com|erowid\.org|chatgpt\.com|claude\.ai|perplexity\.ai|grok\.com)$/i;
const TEXT_OUT = /porn|hentai|xxx|nsfw|booru|xvideos|xhamster|redtube|youporn|rule34|e621|nhentai|onlyfans|chaturbate|motherless|spankbang|literotica|fakku|hanime|escort|torrent(?!freak)|warez|people ?search|mugshot|lyrics/i;

const rows = new Map();
for (const b of bangs) {
  const shelf = `${b.c || ''} / ${b.sc || ''}`, topic = (SHELF.find(([re]) => re.test(shelf)) || [])[1];
  if (!topic || !/^https:\/\//.test(b.u || '') || !b.u.includes('{{{s}}}')) continue;
  let host; try { host = new URL(b.u.replace(/\{\{\{s\}\}\}/g, 'x')).hostname.toLowerCase().replace(/^www\./, ''); } catch { continue; }
  if (HOST_OUT.test(host) || TEXT_OUT.test(host) || TEXT_OUT.test(b.s || '') || /[\t\n"\\`]/.test(b.u + b.s)) continue;
  const tpl = b.u.replace(/\{\{\{s\}\}\}/g, '{q}'), r = rankOf(host);
  if (tpl.length > 220) continue;
  // a door is a search: the word goes into a question field or a search path, not into a profile, a video id or a file name
  if (!/[?&#](q|qs|qt|query|queries|search|searchterm|search_query|searchword|search_text|searchtext|s|st|term|terms|text|keyword|keywords|keys|k|w|wd|word|words|find|lookup|string|expr|title|name|p|i|kw|sp|ss|needle|phrase|criteria|zoek|suche|such|buscar|recherche|cerca)=\{q\}|\/(search|find|lookup|suche|recherche|buscar|busca|cerca|zoeken|szukaj|query|results?|s)[\/?]|search|[?&]search/i.test(tpl)) continue;
  if (/(^|\.)(paypal\.com|messenger\.com|myspace\.com|facebook\.com|instagram\.com|x\.com|twitter\.com|tiktok\.com|linkedin\.com|pinterest\.[a-z.]+|craigslist\.org|ancestry\.[a-z.]+|jw\.org|wikileaks\.org|tripsit\.me)$/i.test(host)) continue;
  const key = `${host}|${topic}`, cur = rows.get(key);
  // one search link per site and topic: the shortest link is the plain search of the site
  if (!cur || tpl.length < cur.tpl.length) rows.set(key, { name: String(b.s).trim().slice(0, 60), host, tpl, topic, rank: r });
}
// sites the rank list knows first; of the unknown ones only shelves where small sites carry the knowledge
const KEEP_UNRANKED = new Set(['research', 'health', 'code', 'ops', 'law', 'government', 'language', 'reference', 'local', 'travel', 'food', 'learning']);
let list = [...rows.values()].filter((x) => x.rank || KEEP_UNRANKED.has(x.topic)).sort((a, b) => (a.rank || 2e6) - (b.rank || 2e6));
if (process.env.DOORS_LIST) { writeFileSync(process.env.DOORS_LIST, JSON.stringify(list)); console.log(`wrote ${list.length} candidates to ${process.env.DOORS_LIST}`); process.exit(0); }
if (checked) { const n = list.length; list = list.filter((x) => checked[x.tpl]?.ok).map((x) => ({ ...x, walls: checked[x.tpl].walls || '' })); console.log(`verified: ${list.length} of ${n} doors opened for a program`); }
const byTopic = {}; for (const x of list) byTopic[x.topic] = (byTopic[x.topic] || 0) + 1;
const body = list.map((x) => [x.topic, x.rank || '', x.host, x.name, x.tpl, x.walls || ''].join('\t')).join('\n');
writeFileSync(new URL('../node/bangs-data.mjs', import.meta.url), `// Generated by tools/doors-build.mjs on ${new Date().toISOString().slice(0, 10)} — do not edit by hand.
// Site search links from the open bang list of Kagi Search (https://github.com/kagisearch/bangs), MIT License,
// Copyright (c) 2024 Kagi Search; bangs were invented by DuckDuckGo. Ranks: Majestic Million (CC BY 3.0, Majestic).
// One line per site: topic, rank (empty when unknown), host, name, search link with {q}, live agents its robots.txt keeps off the search (c Claude, g ChatGPT, p Perplexity).${checked ? `\n// Every door here answered a program with a result page on ${new Date().toISOString().slice(0, 10)} (tools/doors-verify.mjs).` : ''}
export const BANGS_COUNT = ${list.length};
export const BANGS = ${JSON.stringify(body)};
`);
console.log(`doors: ${list.length} site search links`, byTopic, `${Math.round(body.length / 1024)} KB`);
