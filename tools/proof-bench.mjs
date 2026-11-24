// Mare Liberum · the proof bench: how many tokens an agent spends with the open sea and without it, measured with real
// tokenizers on a fixed, published set of real tasks. Run it from a session or any machine, never on the server:
//
//   npm install --prefix ~/.cache/mare-proof js-tiktoken@1.0.21 @anthropic-ai/tokenizer@0.0.4 @mozilla/readability@0.6.0 linkedom@0.18.15
//   node tools/proof-bench.mjs                  measure the task set in proof/tasks.json → proof/bench-<day>.json
//   node tools/proof-bench.mjs --pick           pick the task set anew (the strongest confirmed pathways at /brain, and EVERYDAY below)
//   options: --deps <dir> (where the tokenizers are installed; default ~/.cache/mare-proof or MARE_PROOF_DEPS)
//            --only <n> (the first n tasks, a quick try; nothing is written)   --write-ratio (also write TOKEN_RATIOS in node/proof.mjs)
//            --ratio (only write TOKEN_RATIOS in node/proof.mjs from the newest run in proof/; no network)
//            --from "<where it ran>"   --sea <address of the sea> (default https://mareliberum.dev)
//            --brain-from <an earlier run> (take the brain's answers over from it, each with its own time; no live call)
//   behind a proxy (Node 22.21 or later): NODE_USE_ENV_PROXY=1 node tools/proof-bench.mjs
//
// The tokenizers are not dependencies of the sea: the server stays without npm packages, and the package.json of the
// repository never names them. The bench needs js-tiktoken (o200k_base, cl100k_base); @anthropic-ai/tokenizer and
// Mozilla Readability are used when they are installed.
//
// What it does for each task:
//   (a) reading: the destination page is read once (robots.txt first, an honest User-Agent, at most one request per
//       second to a host, 15 s and 2.5 MB at most) and counted as raw HTML, as plain text from a readability-style
//       extraction (extractText below, documented in METHOD), as Mozilla Readability's text where installed (a
//       cross-check of that extraction), and as the Markdown of the sea's reader (node/reader.mjs, the same code that
//       answers /r/). The sea's own answers for that page — the /r/ answer and the MCP tool read_page — are rendered by
//       the node's own code on this machine, from the same copy of the page, so no page is read twice.
//   (b) finding: the brain's answer for the task, as GET /brain?q=<task> serves it to an agent (JSON), read live with
//       the session's User-Agent (MareLiberum-session/1.0: the sea counts its own calls nowhere). The search loop an
//       agent runs without the sea is modelled from published figures (METHOD.loop) and sizes measured in this run
//       (one search result, one page as text); no search engine is asked.
// Kept: counts, addresses, times, the tokenizers and the method. Never the pages themselves.
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { robotsGroups, robotsAllows, readPage } from '../node/check.mjs';
import { toMarkdown, entities, READER_TOKEN } from '../node/reader.mjs';
import { decodeVia } from '../node/via.mjs';
import { summarize, TOKENIZER_IDS } from '../node/proof.mjs';

export const BENCH_TOKEN = 'MareLiberum-ProofBench';
export const BENCH_UA = `${BENCH_TOKEN}/1.0 (+https://mareliberum.dev/proof; reads each page of a published task set once to count its tokens; follows robots.txt)`;
export const SESSION_UA = 'MareLiberum-session/1.0';
const ROOT = new URL('../', import.meta.url);

// ------------------------------------------------------------------ the method, written into every run
export const METHOD = {
  perHostMs: 1100, timeoutMs: 15000, maxBytes: 2_500_000, markdownCap: 60_000, snippetChars: 160, brainGapMs: 1500, hops: 4,
  robots: 'robots.txt is read once per host and obeyed for the token MareLiberum-ProofBench (RFC 9309: a 4xx answer allows everything, a 5xx answer or no answer forbids everything); a page the sea\'s reader is asked not to read (token MareLiberum-Reader) is left out too',
  html: 'the page as the server sent it, decoded as UTF-8, at most 2.5 MB',
  walls: 'a page that answers with a bot wall instead of itself (a challenge, a captcha, a request to enable JavaScript) is not counted; the run says so in its row',
  text: 'readability-style extraction (tools/proof-bench.mjs, extractText): scripts, styles, form controls, hidden elements, nav, aside and footer elements and boxes whose class or id names navigation, menus, headers, footers, sidebars, comments, cookies, sharing or ads are dropped; every paragraph-like block of 25 characters or more scores its parent (1 + commas + one point per 100 characters, at most 3) and, at half and a sixth, the elements above; a box scores more for words like article, content, main, product, post or text in its class or id and less for the words above; the score is reduced by the share of text in links; the best box and its siblings that score at least a fifth of it are the article; like Readability it tries again with fewer rules when an attempt finds less than 500 characters (without dropping unlikely boxes, then without weighing class names) and keeps the longest attempt; a box that holds the page\'s main or article element is never dropped; the text is written out one block per line, without link targets, markup or images',
  readability: 'Mozilla Readability 0.6.0 (the library behind Firefox Reader View) on a linkedom document: the text of the article it finds, whitespace collapsed the same way; a cross-check of the extraction above, where it is installed',
  markdown: 'the Markdown of the sea\'s reader, toMarkdown in node/reader.mjs (the code that answers /r/ and read_page), on the same copy of the page; not cut (the reader itself cuts at 60,000 characters, see served)',
  served: 'the answer of the sea\'s /r/ door for the page (a few lines about the page and the sea around the Markdown), rendered by the node\'s own route on the same copy of the page on the bench machine; on mareliberum.dev it can also list up to three pathways other agents walked to the site',
  mcp: 'the text block of the answer of the MCP tool read_page (open door /mcp), rendered the same way; it carries the Markdown and a list of the page\'s links',
  keeps: 'at least two thirds of the words of its heading (the first h1 inside its main or article element, else the first h1 a person sees, else og:title, else the longest part of its title; words of three letters or more) and, on a shop page, a price',
  result: 'one search result as a search tool hands it to a model: the page\'s title, its address and a snippet (its meta description, else the start of its text) of at most 160 characters',
  brain: 'the answer of GET /brain?q=<task> with Accept: application/json, as mareliberum.dev serves it to an agent, read live with the User-Agent MareLiberum-session/1.0 (own calls count nowhere)',
  loop: {
    resultsPerSearch: 10,
    low: { toolCalls: 3, searches: 1, pages: 1 },
    high: { toolCalls: 10, searches: 5, pages: 4 },
    rule: 'Anthropic puts simple fact-finding at 3 to 10 tool calls. One of them reads the destination page, which is counted under reading; the others alternate between a search and a page read to judge a result, starting with a search: 3 calls are 1 search and 1 page, 10 calls are 5 searches and 4 pages. A search hands the model 10 results (the page size of the Google Programmable Search API, the default of Exa); one result and one page are as large as the median of this run. Output tokens, reasoning and the re-reading of earlier context in later turns are left out on both sides.',
    sources: [
      { what: 'Simple fact-finding requires just 1 agent with 3-10 tool calls', by: 'Anthropic engineering, How we built our multi-agent research system (13 June 2025)', url: 'https://www.anthropic.com/engineering/multi-agent-research-system' },
      { what: 'The Programmable Search JSON API returns at most 10 results per request (num 1 to 10)', by: 'Google for Developers, cse.list', url: 'https://developers.google.com/custom-search/v1/reference/rest/v1/cse/list' },
      { what: 'numResults: 10 by default', by: 'Exa API reference, search', url: 'https://exa.ai/docs/reference/search' },
      { what: 'count: 20 by default and at most (a loop on this API reads twice as many results per search)', by: 'Brave Search API, web search parameters', url: 'https://api-dashboard.search.brave.com/app/documentation/web-search/query' },
    ],
  },
};

// the everyday tasks: questions asked at the brain (the record of the doors, 23 and 24 November 2026) and common reads of
// coding agents, each with the page a person would expect an agent to open for it (chosen by hand)
export const EVERYDAY = [
  { task: 'find python library for pdf parsing', url: 'https://pypi.org/project/pypdf/', asked: true },
  { task: 'latest research on creatine', url: 'https://pubmed.ncbi.nlm.nih.gov/?term=creatine&sort=date', asked: true },
  { task: 'convert 100 eur to usd', url: 'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/eurofxref-graph-usd.en.html', asked: true },
  { task: 'weather in berlin tomorrow', url: 'https://www.yr.no/en/forecast/daily-table/2-2950159/Germany/Berlin/Berlin', asked: true },
  { task: 'list an MCP server in directories', url: 'https://modelcontextprotocol.io/registry/quickstart', asked: true },
  { task: 'find usdc price', url: 'https://coinmarketcap.com/currencies/usd-coin/', asked: true },
  { task: 'how to use fetch in javascript', url: 'https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch' },
  { task: 'python asyncio gather', url: 'https://docs.python.org/3/library/asyncio-task.html' },
  { task: 'react useeffect hook', url: 'https://react.dev/reference/react/useEffect' },
];
export const SHOPPING_MAX = 24;

// ------------------------------------------------------------------ the readability-style extraction (plain text, the fair baseline)
const VOID = new Set('area base br col embed hr img input link meta param source track wbr keygen command'.split(' '));
const RAW = new Set('script style textarea title xmp noscript template iframe noembed noframes svg math'.split(' '));
// what never reaches the person reading the page, and what a reader view leaves out
const SKIP = new Set('script style noscript template svg math iframe canvas object embed head title button select input textarea option dialog map audio video picture source nav aside footer'.split(' '));
const BLOCK = new Set('address article aside blockquote body caption center dd details dialog div dl dt fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hr li main nav ol p pre section summary table tbody td tfoot th thead tr ul br'.split(' '));
const IMPLIED = { p: 'p', li: 'li', dt: 'dt dd', dd: 'dt dd', tr: 'td th tr', td: 'td th', th: 'td th', option: 'option', h1: 'p', h2: 'p', h3: 'p', h4: 'p', h5: 'p', h6: 'p', div: 'p', ul: 'p', ol: 'p', table: 'p', pre: 'p', blockquote: 'p', section: 'p', dl: 'p', hr: 'p' };
const IMPLIED_SET = Object.fromEntries(Object.entries(IMPLIED).map(([k, v]) => [k, new Set(v.split(' '))]));
// a lenient parser: enough of HTML to know which text stands in which box
export function parseHtml(html) {
  const root = { tag: '#root', attrs: '', kids: [], parent: null }; let cur = root;
  const re = /<!--[\s\S]*?-->|<![^>]*>|<\?[^>]*>|<\/([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|[^<]+|</g;
  const s = String(html || ''); let m;
  while ((m = re.exec(s))) {
    const [all, close, open, attrs] = m;
    if (open) {
      const tag = open.toLowerCase(), imp = IMPLIED_SET[tag];
      if (imp) while (cur !== root && imp.has(cur.tag)) cur = cur.parent;
      const el = { tag, attrs: attrs || '', kids: [], parent: cur }; cur.kids.push(el);
      if (RAW.has(tag)) { const end = new RegExp(`</${tag}\\s*>`, 'ig'); end.lastIndex = re.lastIndex; const e = end.exec(s); if (tag === 'title') el.kids.push(s.slice(re.lastIndex, e ? e.index : s.length)); re.lastIndex = e ? end.lastIndex : s.length; continue; }
      if (!VOID.has(tag) && !/\/\s*$/.test(attrs || '')) cur = el;
    } else if (close) {
      const tag = close.toLowerCase(); let n = cur; while (n !== root && n.tag !== tag) n = n.parent;
      if (n !== root) cur = n.parent;
    } else if (!all.startsWith('<!--') && !/^<[!?]/.test(all)) cur.kids.push(all);
  }
  return root;
}
const attrOf = (el, name) => { const m = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(el.attrs || ''); return m ? (m[1] ?? m[2] ?? m[3] ?? '') : null; };
const hasAttr = (el, name) => new RegExp(`(?:^|\\s)${name}(?:\\s*=|\\s|$)`, 'i').test(el.attrs || '');
const UNLIKELY = /-ad-|ai2html|banner|breadcrumbs|combx|comment|community|cover-wrap|disqus|extra|footer|gdpr|header|legends|menu|related|remark|replies|rss|shoutbox|sidebar|skyscraper|social|sponsor|supplemental|ad-break|agegate|pagination|pager|popup|yom-remote|cookie|consent|newsletter|drawer|modal|share|nav/i;
const MAYBE = /and|article|body|column|content|main|mathjax|shadow|product/i;
const POSITIVE = /article|body|content|entry|hentry|h-entry|main|page|pagination|post|text|blog|story|product|description|docs?\b|markdown|prose/i;
const NEGATIVE = /-ad-|hidden|^hid$| hid$| hid |^hid |banner|combx|comment|com-|contact|footer|gdpr|masthead|media|meta|outbrain|promo|related|scroll|share|shoutbox|sidebar|skyscraper|sponsor|shopping|tags|widget|cookie|modal|popup|newsletter|drawer|nav|menu/i;
const BAD_ROLE = /^(menu|menubar|complementary|navigation|alert|alertdialog|dialog|banner|contentinfo|search)$/i;
const hidden = (el) => hasAttr(el, 'hidden') || /^true$/i.test(attrOf(el, 'aria-hidden') || '') || /display\s*:\s*none|visibility\s*:\s*hidden/i.test(attrOf(el, 'style') || '');
const words = (el) => `${attrOf(el, 'class') || ''} ${attrOf(el, 'id') || ''}`;
// text of a box: what a person sees, one block per line
function textOf(el, out = [], inLink = null) {
  for (const k of el.kids) {
    if (typeof k === 'string') { out.push(k); if (inLink) inLink.n += entities(k).replace(/\s+/g, ' ').trim().length; continue; }
    if (SKIP.has(k.tag) || hidden(k) || BAD_ROLE.test(attrOf(k, 'role') || '')) continue;
    const block = BLOCK.has(k.tag);
    if (block) out.push('\n');
    textOf(k, out, k.tag === 'a' ? (inLink || { n: 0 }) : inLink);
    if (block) out.push('\n');
  }
  return out;
}
export const tidy = (s) => entities(s).replace(/[ \t \r\f\v]+/g, ' ').split('\n').map((l) => l.trim()).filter(Boolean).join('\n');
const plain = (el) => tidy(textOf(el).join(''));
function linkDensity(el) {
  let all = 0, link = 0;
  const walk = (n, a) => { for (const k of n.kids) { if (typeof k === 'string') { const l = entities(k).replace(/\s+/g, ' ').trim().length; all += l; if (a) link += l; } else if (!SKIP.has(k.tag) && !hidden(k)) walk(k, a || k.tag === 'a'); } };
  walk(el, false);
  return all ? link / all : 0;
}
// the readability-style article: score the boxes that hold paragraphs, take the best and its strong siblings. Like
// Readability, it tries again with fewer rules when an attempt finds less than 500 characters (first without dropping
// unlikely boxes, then without weighing class names) and keeps the longest attempt when none reaches that
export const CHAR_THRESHOLD = 500;
const holdsMain = (el) => el.kids.some((k) => typeof k !== 'string' && (k.tag === 'main' || k.tag === 'article' || /^main$/i.test(attrOf(k, 'role') || '') || holdsMain(k)));
function attempt(html, { strip, weigh }) {
  const root = parseHtml(html);
  const body = (function find(n) { if (n.tag === 'body') return n; for (const k of n.kids) if (typeof k !== 'string') { const b = find(k); if (b) return b; } return null; })(root) || root;
  // what a person never sees goes always; unlikely boxes go in the first attempt (never the body, never inside a table or
  // code, never a box that holds the page's main or article element)
  (function prune(n, inTable) {
    n.kids = n.kids.filter((k) => {
      if (typeof k === 'string') return true;
      if (SKIP.has(k.tag) || hidden(k) || BAD_ROLE.test(attrOf(k, 'role') || '')) return false;
      const w = words(k);
      if (strip && !inTable && k.tag !== 'a' && k.tag !== 'main' && k.tag !== 'article' && w.trim() && UNLIKELY.test(w) && !MAYBE.test(w) && !holdsMain(k)) return false;
      prune(k, inTable || k.tag === 'table' || k.tag === 'code' || k.tag === 'pre');
      return true;
    });
  })(body, false);
  const score = new Map();
  const initial = (el) => { let s = 0; const t = el.tag; if (t === 'div' || t === 'main' || t === 'article') s += 5; else if (/^(pre|td|blockquote)$/.test(t)) s += 3; else if (/^(address|ol|ul|dl|dd|dt|li|form)$/.test(t)) s -= 3; else if (/^(h[1-6]|th)$/.test(t)) s -= 5;
    if (!weigh) return s;
    const c = attrOf(el, 'class') || '', i = attrOf(el, 'id') || ''; if (c) { if (NEGATIVE.test(c)) s -= 25; if (POSITIVE.test(c)) s += 25; } if (i) { if (NEGATIVE.test(i)) s -= 25; if (POSITIVE.test(i)) s += 25; } return s; };
  const paragraphs = [];
  (function collect(n) { for (const k of n.kids) { if (typeof k === 'string') continue; const blockKids = k.kids.some((x) => typeof x !== 'string' && BLOCK.has(x.tag) && x.tag !== 'br');
    if (/^(p|pre|td|section|h[2-6])$/.test(k.tag) || (k.tag === 'div' && !blockKids) || (k.tag === 'li' && !blockKids)) paragraphs.push(k); collect(k); } })(body);
  for (const p of paragraphs) {
    const t = plain(p); if (t.length < 25) continue;
    const s = 1 + (t.match(/[,，、]/g) || []).length + Math.min(Math.floor(t.length / 100), 3);
    let a = p.parent, level = 0;
    while (a && a.tag !== '#root' && level < 5) { if (!score.has(a)) score.set(a, initial(a)); score.set(a, score.get(a) + s / (level === 0 ? 1 : level === 1 ? 2 : level * 3)); a = a.parent; level++; }
  }
  let top = null, best = -Infinity;
  for (const [el, s] of score) { const f = s * (1 - linkDensity(el)); score.set(el, f); if (f > best) { best = f; top = el; } }
  if (!top) return plain(body);
  // the siblings of the best box that score a fifth of it, or that are plain paragraphs of their own
  const parts = [], bar = Math.max(10, best * 0.2), cls = attrOf(top, 'class');
  for (const sib of top.parent?.kids || [top]) {
    if (typeof sib === 'string') continue;
    let keep = sib === top;
    if (!keep) { const s = (score.get(sib) ?? -Infinity) + (cls && attrOf(sib, 'class') === cls ? best * 0.2 : 0); keep = s >= bar;
      if (!keep && sib.tag === 'p') { const t = plain(sib), ld = linkDensity(sib); keep = (t.length > 80 && ld < 0.25) || (t.length <= 80 && t.length > 0 && ld === 0 && /\.( |$)/.test(t)); } }
    if (keep) parts.push(sib);
  }
  return tidy(parts.map((p) => textOf(p).join('')).join('\n'));
}
export function extractText(html) {
  const tries = [];
  for (const flags of [{ strip: true, weigh: true }, { strip: false, weigh: true }, { strip: false, weigh: false }]) {
    const t = attempt(html, flags); if (t.length >= CHAR_THRESHOLD) return t;
    tries.push(t);
  }
  return tries.sort((a, b) => b.length - a.length)[0] || '';
}
// a rough check that a form still holds the page: most words of its heading (its first h1, else og:title, else the
// longest part of its title) and, on a shop page, a price. A form can be small because it lost what the page is about
const STOP = new Set('the and for with from your you our are was this that into over under all new one per its'.split(' '));
export function essentialsOf(html, shop) {
  const one = (s) => entities(String(s || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  // the page's own heading: the first h1 inside its main or article element, else the first h1 a person sees
  const h = String(html || ''), mains = [...h.matchAll(/<(main|article)\b[\s\S]*?<\/\1>/gi)].map((m) => [m.index, m.index + m[0].length]);
  const h1s = [...h.matchAll(/<h1\b([^>]*)>([\s\S]*?)<\/h1>/gi)].map((m) => ({ at: m.index, attrs: m[1], text: one(m[2]) })).filter((x) => x.text);
  const seen = h1s.filter((x) => !/sr-only|visually-hidden|screen-reader|\bhidden\b/i.test(x.attrs));
  const h1 = (seen.find((x) => mains.some(([a, b]) => x.at > a && x.at < b)) || seen[0])?.text;
  const og = one(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i.exec(h)?.[1] || /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:title["']/i.exec(h)?.[1]);
  const title = one(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(h)?.[1]).split(/\s[|–—·-]\s/).sort((a, b) => b.length - a.length)[0] || '';
  const heading = h1 || og || title, words = [...new Set((heading.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []).filter((w) => !STOP.has(w)))];
  return { words, shop: !!shop };
}
export const PRICE = /(?:[$€£¥₹]\s?\d)|(?:\d[\d.,]*\s?(?:€|\$|£|usd|eur|gbp|aud|cad|chf)\b)/i;
export function keeps(text, e) {
  if (!e?.words?.length) return null;
  const t = String(text || '').toLowerCase(), hit = e.words.filter((w) => t.includes(w)).length;
  return hit / e.words.length >= 2 / 3 && (!e.shop || PRICE.test(text || ''));
}
// a bot wall that answers in place of the page (a challenge, a captcha, "enable JavaScript"): not the page, so not counted
const WALL = /<title[^>]*>\s*(client challenge|just a moment|attention required|access denied|checking your browser|verify(ing)? you are (a )?human|are you a robot|captcha|security check|ddos-guard|please wait)/i;
const WALL_MARK = /cf-chl|challenge-platform|\/_fs-ch-|_Incapsula_Resource|px-captcha|perimeterx|datadome/i;
export function botWall(html) {
  const h = String(html || '');
  if (WALL.test(h.slice(0, 20000))) return 'a bot wall answered instead of the page';
  if (h.length < 60_000 && WALL_MARK.test(h)) return 'a bot wall answered instead of the page';
  return null;
}
// one search result as a search tool hands it to a model
export function resultOf(html, url, text, max = METHOD.snippetChars) {
  const meta = readPage(String(html || '')), one = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const snippet = (one(meta.description) || one(text)).slice(0, max);
  return `${one(meta.title)}\n${url}\n${snippet}`;
}

// ------------------------------------------------------------------ politeness: robots.txt, one request a second to a host
export function pacer(gapMs = METHOD.perHostMs, clock = () => Date.now(), sleep = (ms) => new Promise((r) => setTimeout(r, ms))) {
  const last = new Map();
  return async (host) => { if (last.has(host)) { const wait = last.get(host) + gapMs - clock(); if (wait > 0) await sleep(wait); } last.set(host, clock()); };
}
// RFC 9309: 2xx → the rules; 4xx → no rules (everything allowed); 5xx or no answer → everything forbidden
export function robotsVerdict(status, body, token, path) {
  if (status >= 200 && status < 300) { const txt = /<html/i.test(body || '') ? '' : body || ''; return robotsAllows(robotsGroups(txt), token, path).allowed; }
  if (status >= 400 && status < 500) return true;
  return false;
}

// ------------------------------------------------------------------ tokenizers
async function tokenizers(dir) {
  const req = createRequire(join(resolve(dir), 'package.json')), out = [], extra = {};
  const ver = (name) => { try { return JSON.parse(readFileSync(join(resolve(dir), 'node_modules', name, 'package.json'), 'utf8')).version; } catch { return null; } };
  let jt; try { jt = await import(pathToFileURL(req.resolve('js-tiktoken')).href); } catch { return null; }
  for (const id of ['o200k_base', 'cl100k_base']) { const enc = jt.getEncoding(id); out.push({ id, package: `js-tiktoken@${ver('js-tiktoken')}`, count: (s) => enc.encode(s, [], []).length }); }
  try { const at = req('@anthropic-ai/tokenizer'), enc = at.getTokenizer(); out.push({ id: 'claude-legacy', package: `@anthropic-ai/tokenizer@${ver('@anthropic-ai/tokenizer')}`, count: (s) => enc.encode(String(s).normalize('NFKC'), 'all').length }); } catch {}
  try { const { Readability } = req('@mozilla/readability'), { parseHTML } = await import(pathToFileURL(req.resolve('linkedom')).href);
    extra.readability = { package: `@mozilla/readability@${ver('@mozilla/readability')} + linkedom@${ver('linkedom')}`, text: (html) => { try { const { document } = parseHTML(html); const a = new Readability(document, { charThreshold: 500 }).parse(); return a?.textContent ? tidy(a.textContent) : null; } catch { return null; } } }; } catch {}
  const MODELS = { o200k_base: 'OpenAI GPT-4o, GPT-4.1, o-series and GPT-5 models', cl100k_base: 'OpenAI GPT-4 and GPT-3.5 models', 'claude-legacy': 'Anthropic Claude 1 and 2; for Claude 3 and later only "a very rough approximation" (Anthropic)' };
  for (const t of out) t.models = MODELS[t.id];
  return { list: out.filter((t) => TOKENIZER_IDS.includes(t.id)), extra };
}

// ------------------------------------------------------------------ the sea's own answers for a page, rendered here from the same copy
export async function seaRenderer(base) {
  const [{ handle }, { createMem }, { memoryKv }, { createLedger }, { payConfig }] = await Promise.all([import('../node/core.mjs'), import('../node/mem.mjs'), import('../node/flow.mjs'), import('../node/ledger.mjs'), import('../node/pay.mjs')]);
  const dir = mkdtempSync(join(tmpdir(), 'mare-proof-')), db = createMem({ file: join(dir, 'sea.tsv'), base });
  const cfg = { base, kv: memoryKv(), ledger: createLedger({}), pay: payConfig({}), site: {} };
  let ip = 1;
  const call = async (path, init = {}) => { const res = await handle(new Request(base + path, { ...init, headers: { 'user-agent': SESSION_UA, 'x-forwarded-for': `198.18.9.${(ip++ % 250) + 1}`, ...(init.headers || {}) } }), db, cfg); return { status: res.status, text: await res.text() }; };
  return {
    async served(url) { return call(`/read?url=${encodeURIComponent(url)}`, { headers: { accept: 'text/markdown, text/plain;q=0.9' } }); },
    async mcp(url) {
      const r = await call('/mcp', { method: 'POST', headers: { accept: 'application/json, text/event-stream', 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'read_page', arguments: { url } } }) });
      try { const j = JSON.parse(r.text); return { status: r.status, text: j.result?.content?.[0]?.text ?? null, isError: !!j.result?.isError }; } catch { return { status: r.status, text: null }; }
    },
    done() { rmSync(dir, { recursive: true, force: true }); },
  };
}

// ------------------------------------------------------------------ the run
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const utf8 = (s) => Buffer.byteLength(String(s ?? ''), 'utf8');
const day = () => new Date().toISOString().slice(0, 10);
function args(argv) { const a = { _: [] }; for (let i = 0; i < argv.length; i++) { const x = argv[i]; if (x.startsWith('--')) { const k = x.slice(2), v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true; a[k] = v; } else a._.push(x); } return a; }

async function main() {
  const a = args(process.argv.slice(2));
  const deps = a.deps || process.env.MARE_PROOF_DEPS || join(homedir(), '.cache', 'mare-proof'), sea = String(a.sea || 'https://mareliberum.dev').replace(/\/+$/, '');
  const realFetch = globalThis.fetch.bind(globalThis), pace = pacer();
  const get = async (url, { ua = BENCH_UA, accept = 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5', max = METHOD.maxBytes } = {}) => {
    const t0 = Date.now();
    const r = await realFetch(url, { redirect: 'manual', headers: { 'user-agent': ua, accept }, signal: AbortSignal.timeout(METHOD.timeoutMs) });
    const reader = r.body?.getReader(), parts = []; let size = 0, cut = false;
    if (reader) for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; parts.push(value); if (size > max) { cut = true; try { await reader.cancel(); } catch {} break; } }
    const buf = Buffer.concat(parts).subarray(0, max);
    return { status: r.status, location: r.headers.get('location'), type: r.headers.get('content-type') || '', body: buf.toString('utf8'), raw: buf, cut, ms: Date.now() - t0 };
  };

  // ---- the calibrated ratios from the newest run, written into node/proof.mjs (no network)
  if (a.ratio) { const { loadBench } = await import('../node/proof.mjs'); const d = loadBench(); if (!d) throw new Error('no run in proof/'); writeRatio(d); console.log(`written: TOKEN_RATIOS in node/proof.mjs from proof/${d.file}`); return; }

  // ---- picking the task set: the strongest confirmed pathways the brain lists, and the everyday tasks
  if (a.pick) {
    const r = await get(`${sea}/brain`, { ua: SESSION_UA, accept: 'application/json', max: 5_000_000 });
    if (r.status !== 200) throw new Error(`the brain answered ${r.status}`);
    const top = JSON.parse(r.body).top || [], seen = new Set(), tasks = [];
    for (const p of top) {
      if (!((p.worked || 0) > (p.failed || 0))) continue;
      const tok = /\/via\/([A-Za-z0-9_-]+)/.exec(String(p.to || ''))?.[1], url = tok ? decodeVia(tok)?.url : p.to;
      let host; try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { continue; }
      if (seen.has(host) || tasks.length >= SHOPPING_MAX) continue; seen.add(host);
      tasks.push({ id: `s${String(tasks.length + 1).padStart(2, '0')}`, task: p.task, group: 'shopping', source: 'confirmed pathway of the Unibrain', path: p.id, worked: p.worked || 0, failed: p.failed || 0, url });
    }
    EVERYDAY.forEach((e, i) => tasks.push({ id: `e${String(i + 1).padStart(2, '0')}`, task: e.task, group: 'everyday', source: e.asked ? 'asked at the brain; page chosen by hand' : 'common read of coding agents; page chosen by hand', url: e.url }));
    const out = { what: 'the published task set of the proof of function (https://mareliberum.dev/proof)', picked: new Date().toISOString(), from: `${sea}/brain (JSON, field top)`,
      rule: `shopping: the pathways GET /brain lists as the strongest (field top, ${top.length} at pick time), kept when confirmed (more worked than failed reports), at most one per site, at most ${SHOPPING_MAX}; everyday: questions asked at the brain (the record of the doors, 23 and 24 November 2026) and common reads of coding agents, with the page a person would expect an agent to open (chosen by hand; pages whose robots.txt forbids reading, or that a bot wall closes, were not chosen)`,
      tasks };
    writeFileSync(new URL('proof/tasks.json', ROOT), `${JSON.stringify(out, null, 1)}\n`);
    console.log(`task set: ${tasks.length} tasks (${tasks.filter((t) => t.group === 'shopping').length} shopping, ${tasks.filter((t) => t.group === 'everyday').length} everyday) → proof/tasks.json`);
    return;
  }

  const tk = await tokenizers(deps);
  if (!tk) { console.error(`js-tiktoken is not installed in ${deps}. Install the tokenizers outside the repository:\n  npm install --prefix ${deps} js-tiktoken@1.0.21 @anthropic-ai/tokenizer@0.0.4 @mozilla/readability@0.6.0 linkedom@0.18.15`); process.exit(2); }
  const set = JSON.parse(readFileSync(new URL('proof/tasks.json', ROOT), 'utf8')), only = Number(a.only) || 0, tasks = only ? set.tasks.slice(0, only) : set.tasks;
  const count = (s) => Object.fromEntries(tk.list.map((t) => [t.id, t.count(String(s))]));
  const VERSION = /export const VERSION = '([^']+)'/.exec(readFileSync(new URL('node/core.mjs', ROOT), 'utf8'))?.[1] || null;
  let commit = null; try { commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: fileURLToPath(ROOT), encoding: 'utf8' }).trim(); } catch {}
  console.log(`proof bench · ${tasks.length} tasks · tokenizers ${tk.list.map((t) => `${t.id} (${t.package})`).join(', ')}${tk.extra.readability ? ` · cross-check ${tk.extra.readability.package}` : ''}`);

  // the sea's own answers are rendered here, from the copy the bench read: the node's code fetches through this stand-in
  const copies = new Map();
  globalThis.fetch = async (u) => { const k = String(u?.url || u), c = copies.get(k); if (!c) throw new Error(`the bench serves only the page it read: ${k.slice(0, 80)}`); return new Response(c.status >= 300 && c.status < 400 ? null : c.raw, { status: c.status, headers: { 'content-type': c.type || 'text/html', ...(c.location ? { location: c.location } : {}) } }); };
  const render = await seaRenderer(sea);
  const robotsOf = new Map(), startedAt = new Date().toISOString(), rows = [];
  const robots = async (origin) => {
    if (robotsOf.has(origin)) return robotsOf.get(origin);
    // (RFC 9309: redirects of robots.txt are followed, up to five hops)
    let v, at = `${origin}/robots.txt`;
    try { for (let hop = 0; ; hop++) { await pace(new URL(at).hostname); const r = await get(at, { accept: 'text/plain,*/*;q=0.5', max: 500_000 });
      if (r.status >= 300 && r.status < 400 && r.location && hop < 5) { at = new URL(r.location, at).href; continue; }
      v = { status: r.status, body: r.status === 200 ? r.body : '', raw: r.raw, type: r.type }; break; } } catch { v = { status: 0, body: '' }; }
    robotsOf.set(origin, v); return v;
  };
  // the brain's answers of an earlier run of the same task set can be taken over (each keeps its own time), so a second
  // run of the pages asks the live sea nothing
  const brainFrom = typeof a['brain-from'] === 'string' ? new Map(JSON.parse(readFileSync(a['brain-from'], 'utf8')).tasks.filter((x) => x.brain).map((x) => [`${x.id} ${x.task}`, x.brain])) : null;
  let lastBrain = 0;
  for (const t of tasks) {
    const row = { ...t }, t0 = Date.now(); let requests = 0;
    try {
      // (a) the page: robots.txt first, then the page, every hop of a redirect checked again
      let url = t.url, r = null, hops = 0; const chain = [];
      for (;;) {
        const u = new URL(url), rb = await robots(u.origin); if (!robotsOf.get(u.origin).counted) { robotsOf.get(u.origin).counted = true; requests++; }
        const path = u.pathname + u.search;
        if (!robotsVerdict(rb.status, rb.body, BENCH_TOKEN, path)) { row.skipped = 'robots.txt asks this bench not to read it'; break; }
        if (!robotsVerdict(rb.status, rb.body, READER_TOKEN, path)) { row.skipped = 'robots.txt asks the sea\'s reader not to read it'; break; }
        await pace(u.hostname); r = await get(url); requests++; chain.push({ url, ...r });
        if (r.status >= 300 && r.status < 400 && r.location && hops < METHOD.hops) { url = new URL(r.location, url).href; hops++; continue; }
        break;
      }
      if (!row.skipped && r) {
        const html = r.body, isHtml = /html|xml\+xhtml/i.test(r.type) || /^\s*</.test(html);
        if (r.status !== 200) row.skipped = `the page answered ${r.status}`;
        else if (!isHtml) row.skipped = `not a web page (${r.type.split(';')[0]})`;
        else if (botWall(html)) row.skipped = botWall(html);
        else {
          const text = extractText(html), readab = tk.extra.readability?.text(html) ?? null, md = toMarkdown(html, url), result = resultOf(html, url, text);
          // the same copy for the node's own reader: robots.txt and every hop of the page
          copies.clear();
          for (const [origin, rb] of robotsOf) copies.set(`${origin}/robots.txt`, { status: rb.status || 503, type: rb.type || 'text/plain', raw: rb.raw || Buffer.alloc(0) });
          for (const c of chain) copies.set(new URL(c.url).href, c);
          const served = await render.served(t.url), mcp = await render.mcp(t.url);
          const forms = { html, text, ...(readab ? { readability: readab } : {}), markdown: md, ...(served.status === 200 ? { served: served.text } : {}), ...(mcp.text && !mcp.isError ? { mcp: mcp.text } : {}), result };
          const tokens = {}; for (const tz of tk.list) tokens[tz.id] = Object.fromEntries(Object.entries(forms).map(([f, s]) => [f, tz.count(s)]));
          const ess = essentialsOf(html, t.group === 'shopping'), kept = Object.fromEntries(['text', 'readability', 'markdown'].filter((f) => forms[f] != null).map((f) => [f, keeps(forms[f], ess)]));
          row.page = { at: new Date(t0).toISOString(), status: r.status, final: url !== t.url ? url : undefined, type: r.type.split(';')[0], ms: chain.reduce((s, c) => s + c.ms, 0), hops: hops || undefined, cut: r.cut || undefined,
            capped: md.length > METHOD.markdownCap || undefined, servedStatus: served.status !== 200 ? served.status : undefined,
            keeps: ess.words.length ? kept : undefined,
            chars: Object.fromEntries(Object.entries(forms).map(([f, s]) => [f, s.length])), bytes: Object.fromEntries(Object.entries(forms).map(([f, s]) => [f, utf8(s)])), tokens };
        }
      }
    } catch (e) { row.skipped = `the page could not be read (${String(e?.cause?.code || e?.name || e?.message || 'error').slice(0, 60)})`; }
    if (requests) row.requests = requests;
    // (b) the brain's answer for the task, live, at a gentle pace
    if (brainFrom?.has(`${t.id} ${t.task}`)) row.brain = brainFrom.get(`${t.id} ${t.task}`);
    else if (!a['no-brain']) {
      const wait = lastBrain + METHOD.brainGapMs - Date.now(); if (wait > 0) await sleep(wait); lastBrain = Date.now();
      try {
        const b = await get(`${sea}/brain?q=${encodeURIComponent(t.task)}`, { ua: SESSION_UA, accept: 'application/json', max: 5_000_000 }); lastBrain = Date.now();
        row.brain = { at: new Date().toISOString(), status: b.status };
        if (b.status === 200) {
          let j = null; try { j = JSON.parse(b.body); } catch {}
          const targets = (list) => (list || []).map((x) => { const tok = /\/via\/([A-Za-z0-9_-]+)/.exec(String(x?.to || ''))?.[1]; return tok ? decodeVia(tok)?.url : x?.to; }).filter(Boolean);
          const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return null; } }, want = host(t.url);
          const paths = j?.paths || [], rank = t.path ? paths.findIndex((p) => p.id === t.path) + 1 : 0, mine = t.path ? paths.find((p) => p.id === t.path) : null;
          // who confirmed the task's pathway, as the answer says it (the names on its check and its notes)
          const by = mine ? [...new Set([mine.checked?.by, ...(mine.notes || []).map((x) => x?.by)].filter((x) => typeof x === 'string' && x.length < 60))] : undefined;
          Object.assign(row.brain, { chars: b.body.length, bytes: utf8(b.body), tokens: count(b.body), paths: paths.length, doors: (j?.doors || []).length + (j?.web || []).length, places: (j?.places || []).length,
            pathRank: t.path ? rank || null : undefined, confirmedBy: by, destinationHost: [...targets(paths), ...targets(j?.places)].some((u) => host(u) === want) });
        }
      } catch (e) { row.brain = { at: new Date().toISOString(), status: 0, error: String(e?.cause?.code || e?.message || 'error').slice(0, 60) }; }
    }
    rows.push(row);
    const o = row.page?.tokens?.o200k_base;
    console.log(`${t.id} ${t.task.slice(0, 34).padEnd(34)} ${o ? `html ${o.html} · text ${o.text} · md ${o.markdown} · r ${o.served ?? '–'} · mcp ${o.mcp ?? '–'}` : `skipped: ${row.skipped}`} · brain ${row.brain?.tokens?.o200k_base ?? row.brain?.status ?? '–'}`);
  }
  render.done();
  globalThis.fetch = realFetch;

  const d = { what: 'Proof of function: the tokens an agent reads with the open sea and without it (https://mareliberum.dev/proof)', version: 1, date: startedAt.slice(0, 10), startedAt, endedAt: new Date().toISOString(),
    bench: { script: 'tools/proof-bench.mjs', ua: BENCH_UA, sessionUa: SESSION_UA, node: process.version, commit, seaVersion: VERSION, sea, ranFrom: typeof a.from === 'string' ? a.from : 'a session machine' },
    tokenizers: tk.list.map(({ id, package: p, models }) => ({ id, package: p, models })), crossCheck: tk.extra.readability ? tk.extra.readability.package : null,
    taskSet: { file: 'proof/tasks.json', picked: set.picked, rule: set.rule }, method: METHOD, tasks: rows };
  const brainTimes = rows.map((x) => x.brain?.at).filter(Boolean).sort();
  if (brainTimes.length) d.brainAt = { from: brainTimes[0], to: brainTimes.at(-1), takenOver: brainFrom ? true : undefined };
  d.summary = summarize(d);
  const s = d.summary, o = s.reading.o200k_base, f = s.finding.o200k_base;
  console.log(`\nmeasured ${s.measured} of ${s.tasks} pages · median o200k: html ${o.html?.median} · text ${o.text?.median} · markdown ${o.markdown?.median} · /r/ ${o.served?.median} · brain ${f.brain.median} vs modelled loop ${f.low}–${f.high}`);
  if (only || a['no-write']) return;
  mkdirSync(new URL('proof/', ROOT), { recursive: true });
  const file = `proof/bench-${d.date}.json`;
  writeFileSync(new URL(file, ROOT), compact(d));
  console.log(`written: ${file} (${utf8(compact(d))} bytes)`);
  if (a['write-ratio']) { writeRatio(d); console.log('written: TOKEN_RATIOS in node/proof.mjs'); }
}

// one task per line: small, and a change between two runs reads line by line
export function compact(d) {
  const { tasks, ...rest } = d;
  const head = JSON.stringify(rest, null, 1).replace(/\n}$/, '');
  return `${head},\n "tasks": [\n${tasks.map((t) => `  ${JSON.stringify(t)}`).join(',\n')}\n ]\n}\n`;
}
// the calibrated ratios, written into node/proof.mjs between its two marks (tools/bench-proof.mjs checks they match the newest run)
export function ratioBlock(d) {
  const js = (v) => JSON.stringify(v).replace(/"([a-z_]+)":/g, '$1: ').replace(/,(?=[a-z_]+: )/g, ', ').replace(/"/g, "'");
  const rows = d.tokenizers.map((t) => { const r = d.summary.ratios[t.id];
    return `  '${t.id}': Object.freeze({ tokenizer: '${t.id}', date: '${d.date}', source: '/proof/bench-${d.date}.json', pages: ${d.summary.measured}, unit: 'characters per token', html: ${r.html}, text: ${r.text}, markdown: ${r.markdown}, served: ${r.served}, bytes: Object.freeze(${js(r.bytes)}) }),`; });
  return `export const TOKEN_RATIOS = Object.freeze({\n${rows.join('\n')}\n});`;
}
export function writeRatio(d) {
  const file = new URL('node/proof.mjs', ROOT), src = readFileSync(file, 'utf8');
  const next = src.replace(/(\/\/ <bench:ratio>\n)[\s\S]*?(\n\/\/ <\/bench:ratio>)/, `$1${ratioBlock(d)}$2`);
  if (next === src && !src.includes('// <bench:ratio>')) throw new Error('node/proof.mjs has no <bench:ratio> marks');
  writeFileSync(file, next);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(e?.stack || e); process.exit(1); });
