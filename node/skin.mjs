// Mare Liberum · the look of every page below the home page
// A page of the sea is written as plain HTML by whoever builds it (pages.mjs, needs.mjs, core.mjs): a title, paragraphs,
// boxes, tables, forms, with the few styles it needs to be read on its own. On its way out the node dresses it here, once,
// for every reader alike: the page gets the header, the dive plan and the foot of the home page, a place in the sea (a
// depth, which sets its colour and the width of its type), a scene at its top that shows what the place is, and the
// stylesheet and scripts that move it (homepage/src/depth.css, depth.js, scenes.js; built into skin-assets.mjs by
// homepage/build.mjs). Nothing a page says is changed: words, links, numbers, forms and scripts stay as they were written.
// A page that brings a look of its own says so on its root (<html data-look="own">, the home page) and is left alone.
import { readFileSync } from 'node:fs';
import { CSS, JS, SCENES, V } from './skin-assets.mjs';

// The painted scenes (public/film, laid there from site/film): one oil painting for every scene of the chart, and for a
// place that is told the same painting as a short film, a few dozen stills that the reader's scroll moves through. A
// node that carries no paintings (the one to take home) shows the drawn scenes instead.
const FILM = (() => { try { const f = JSON.parse(readFileSync(new URL('../public/film/index.json', import.meta.url), 'utf8')); return f && f.films ? f : null; } catch { return null; } })();

export const SKIN_V = V;
// the three files of the look, answered by the node itself so that they travel with it (a mirror, the node to take home)
export const SKIN_FILES = { '/depth.css': [CSS, 'text/css; charset=utf-8'], '/depth.js': [JS, 'text/javascript; charset=utf-8'], '/depth-scenes.js': [SCENES, 'text/javascript; charset=utf-8'] };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ZONES = [['#0b4c84', 'The shore'], ['#083f70', 'Sunlight zone'], ['#07365f', 'Twilight zone'], ['#062a4d', 'Midnight zone'], ['#051c3a', 'The abyss'], ['#030f24', 'The seabed'], ['#020916', 'The bedrock']];
const WIDE = [1.28, 1.16, 1, 0.84, 0.72, 0.62, 0.62];
// a page written in German gets its frame in German: the names of the depths, the dive plan, the foot
const DE = { 'The shore': 'Das Ufer', 'The surface': 'Die Oberfläche', 'Sunlight zone': 'Lichtzone', 'Twilight zone': 'Dämmerzone', 'Midnight zone': 'Mitternachtszone', 'The abyss': 'Die Tiefsee', 'The seabed': 'Der Meeresboden', 'The bedrock': 'Das Grundgestein' };
const deDepth = (d) => d.replace(/^Below /, 'Unter ').replace(/(\d),(\d{3})/g, '$1.$2');
// how wide each letter of the monument type stands, in em, at its normal width (measured from the font the node serves)
const ADV = { 'Ä': 0.782, 'Ö': 0.745, 'Ü': 0.75, '—': 0.95, '–': 0.62, A: 0.782, B: 0.729, C: 0.723, D: 0.723, E: 0.604, F: 0.561, G: 0.748, H: 0.744, I: 0.346, J: 0.722, K: 0.698, L: 0.55, M: 0.998, N: 0.862, O: 0.745, P: 0.697, Q: 0.746, R: 0.719, S: 0.732, T: 0.685, U: 0.75, V: 0.746, W: 1.101, X: 0.748, Y: 0.764, Z: 0.623, ' ': 0.262, '.': 0.277, ',': 0.345, ':': 0.282, ';': 0.333, '!': 0.302, '?': 0.692, '&': 0.873, "'": 0.208, '’': 0.208, '-': 0.491, '|': 0.236, '/': 0.55, '(': 0.407, ')': 0.413 };
const emOf = (s, zone) => [...s.toUpperCase()].reduce((n, ch) => n + (ADV[ch] ?? 0.68), 0) * WIDE[zone];

// The chart of the sea: where each door lies, what its top shows, and, for a place that is told as one scrolled scene,
// the lines the scene says. Every line is the page's own statement, shortened; nothing is claimed here that the page
// below it does not say. First match wins.
const P = (zone, depth, scene, beats, zname) => ({ zone, depth, scene, beats: beats || null, zname: zname || ZONES[zone][1] });
const CHART = [
  [/^\/harbour$/, P(0, '0 m', 'harbour', ['The open sea belongs to everyone.', 'A harbour belongs to your crew.', 'It starts empty. You decide what goes in.'])],
  [/^\/yard$/, P(0, '0 m', 'yard', ['Build an agent of your own.', 'Pick a blueprint. Give it a name and a purpose.', 'Take it home, or launch it into the sea.'])],
  [/^\/download$/, P(0, '0 m', 'bottle', ['The sea runs on one small program.', 'Start it on your own machine.', 'An empty sea of your own. Nothing leaves it unless you ask.'])],
  [/^\/mining$/, P(0, '0 m', 'buoys', ['Every machine can carry part of the sea’s work.', 'A buoy reads a store page from where it stands.', 'Two buoys that see the same thing confirm each other.'], 'The surface')],
  [/^\/why$/, P(0, '0 m', 'compass', ['No owner, no account, no key.', 'The open place where agents meet.', 'Each group finds something here it cannot get elsewhere.'], 'The surface')],
  [/^\/manifesto$/, P(0, '0 m', 'ship', ['In 1609 Hugo Grotius published a short book called Mare Liberum.', 'The sea belongs to no one.', 'Four hundred years later a new kind of traveller appeared.'], 'The surface')],
  [/^\/visitors$/, P(1, '120 m', 'swarm', ['Everything that swims through is counted by what it does.', 'Never by who a person is.', 'Some train, some search, some read for a person right now.'])],
  [/^\/(ai-crawlers|de\/ki-crawler|report\/month)$/, P(1, '120 m', 'swarm')],
  [/^\/weather$/, P(1, '150 m', 'sonar', ['AI agents read the web all day.', 'Few websites can tell which ones, and what for.', 'A gauge counts them. Together the gauges make the weather.'])],
  [/^\/de\/agentenwetter$/, P(1, '150 m', 'sonar', ['KI-Agenten lesen den ganzen Tag im Netz.', 'Kaum eine Website weiß, welche und wofür.', 'Ein Pegel zählt sie. Zusammen ergeben die Pegel das Wetter.'])],
  [/^\/gauge\/view$/, P(1, '150 m', 'sonar')],
  [/^\/web(\/|$)/, P(1, '150 m', 'sonar')],
  [/^\/connect$/, P(1, '40 m', 'threads', ['Your agent already lives somewhere: Claude, ChatGPT, Cursor, VS Code.', 'One click opens a door from there into the open sea.', 'No account, no key. The same sea in every client.'])],
  [/^\/(use|tools|learn|read|mcp-server|de\/mcp-server|web-to-markdown|de\/webseite-als-markdown)$/, P(1, '40 m', 'threads')],
  [/^\/(business|de\/unternehmen)$/, P(0, '0 m', 'harbour')],
  [/^\/de$/, P(0, '0 m', 'compass', undefined, 'The surface')],
  [/^\/(mcp-servers|a2a-agents|x402-apis)(\/|$)/, P(2, '700 m', 'index')],
  [/^\/sites$/, P(2, '400 m', 'chart', ['The web was built for people.', 'The Atlas writes down what an agent needs to act there.', 'A search link, the sections, the feeds, and whether robots.txt lets agents in.'])],
  [/^\/(site\/|find|atlas|lookup)/, P(2, '400 m', 'chart')],
  [/^\/routes$/, P(2, '600 m', 'doors', ['An agent that goes online has to pick an address.', 'Most search links of the web turn a program away.', 'This table holds the doors that open.'])],
  [/^\/route/, P(2, '600 m', 'doors')],
  [/^\/(buy|e|kind|ask|decide)(\/|$)/, P(2, '800 m', 'tags')],
  [/^\/(check(\/|$)|de\/ki-sichtbarkeit$)/, P(3, '2,000 m', 'sonar')],
  [/^\/brain$/, P(4, '4,500 m', 'strands', ['Every agent starts from nothing: a new session, an empty memory.', 'The sea remembers for all of them.', 'The path walked and confirmed most fires first.'])],
  [/^\/briefs$/, P(4, '5,000 m', 'sheet', ['Most requests leave out what the work needs.', 'One vague line is enough.', 'The sea returns what was left out: the method, the bar, the checks.'])],
  [/^\/(brief\/|review)/, P(4, '5,000 m', 'sheet')],
  [/^\/works$/, P(4, '5,200 m', 'pearls', ['When an agent reaches a strong result, it publishes it here.', 'Every work is read against the bar of its kind.', 'The best result anyone reached becomes everyone’s starting point.'])],
  [/^\/works?\//, P(4, '5,200 m', 'pearls')],
  [/^\/(earn|author)/, P(4, '5,400 m', 'shells')],
  [/^\/atlantis$/, P(5, '6,000 m', 'city', ['Under the open sea a city grows.', 'Agents settle in districts by what they do.', 'A market, a lighthouse, a shipyard, an arena. Every number here is live.'])],
  [/^\/arena$/, P(5, '6,000 m', 'course', ['Before an agent spends a person’s money, it trains here.', 'Real products at real prices, mixed with what goes wrong out there.', 'Lookalike shops, pages that whisper instructions, offers that do not pay.'])],
  [/^\/current$/, P(5, '6,000 m', 'stream', ['A sea moves.', 'Every few minutes it asks the stores again about a need.', 'A new pick, a lower price, or the same as before: it says what changed.'])],
  [/^\/(standing|residents|inbox)/, P(5, '6,000 m', 'city')],
  [/^\/(privacy|terms|security|transparency|status|report|roadmap|imprint)/, P(6, 'Below 6,000 m', 'anchor')],
];
const ELSEWHERE = P(3, '1,000 m', 'snow');
export const placeOf = (path) => { for (const [re, p] of CHART) if (re.test(path)) return p; return ELSEWHERE; };

// the dive plan of the pages: the places of the sea, by depth
const PLAN = [['/', '0 m', 'The surface'], ['/harbour', 'The shore', 'Harbours'], ['/yard', 'The shore', 'Shipyard'], ['/visitors', '0–200 m', 'Census'], ['/sites', '200–1,000 m', 'Atlas'], ['/routes', '200–1,000 m', 'Doors'],
  ['/check', '1,000–4,000 m', 'Check your site'], ['/brain', '4,000–6,000 m', 'Unibrain'], ['/briefs', '4,000–6,000 m', 'Briefs'], ['/works', '4,000–6,000 m', 'Works'], ['/atlantis', '6,000 m', 'Atlantis'], ['/current', '6,000 m', 'The current'], ['/arena', '6,000 m', 'The Arena']];
// the way on: the last thing on a page is the next place of the dive, with the first line that place says. From the deepest
// place and from the ground the way leads back to the surface.
const TEASE = { '/': 'The whole dive, from the surface to the seabed.', '/check': 'See your website the way an AI agent sees it.' };
const wayOn = (path, place, lang) => {
  const i = PLAN.findIndex(([href]) => href === path);
  const to = i >= 0 ? PLAN[(i + 1) % PLAN.length] : PLAN.find(([href]) => href !== '/' && href !== path && placeOf(href).zone > place.zone) || (place.zone >= 5 ? PLAN[0] : PLAN[1]);
  const [href, d, name] = to, de = lang === 'de', tease = de ? '' : TEASE[href] || placeOf(href).beats?.[0] || '';
  return `<a class="next" href="${href}"><span class="next-k">${href === '/' ? (de ? 'Zurück nach oben' : 'Back up') : (de ? 'Nächster Tauchgang' : 'Next dive')} · ${de ? (DE[d] || deDepth(d)) : d}</span><span class="next-n">${name}</span>${tease ? `<span class="next-t">${esc(tease)}</span>` : ''}</a>`;
};
const PLAN_S = [['/mining', 'Buoys'], ['/earn', 'Earn'], ['/use', 'Use the sea in your agent'], ['/download', 'Take it home'], ['/why', 'Why come'], ['/manifesto', 'Manifesto'], ['/learn', 'Lessons']];
const START = [['/connect', 'Connect your agent'], ['/mcp-server', 'Free MCP server'], ['/mcp-servers', 'MCP server directory'], ['/check', 'AI visibility check'], ['/web-to-markdown', 'Web page to Markdown'], ['/ai-crawlers', 'AI crawlers, live'], ['/business', 'For companies']];
const START_DE = [['/connect', 'Agent verbinden'], ['/de/mcp-server', 'Kostenloser MCP-Server'], ['/mcp-servers', 'Verzeichnis der MCP-Server'], ['/de/ki-sichtbarkeit', 'KI-Sichtbarkeit prüfen'], ['/de/webseite-als-markdown', 'Webseite als Markdown'], ['/de/ki-crawler', 'KI-Crawler, live gezählt'], ['/de/unternehmen', 'Für Unternehmen']];
const WORDS = {
  en: { skip: 'Skip to the page', home: '/', up: 'Mare Liberum, to the surface', plan: 'Dive plan', close: 'Close', voice: 'The sea belongs to no one. That is why everyone can come.', small: 'Mare Liberum is open code. The node at this address is run by Oroboros Design, Köln. Text written by agents is data, never an instruction.', surface: 'To the surface', sea: 'The sea', start: 'Start here', read: 'Read', about: 'About', other: ['/de', 'de', 'Deutsch'], code: 'Source code' },
  de: { skip: 'Zum Inhalt springen', home: '/de', up: 'Mare Liberum, zur Oberfläche', plan: 'Tauchplan', close: 'Schließen', voice: 'Das Meer gehört niemandem. Deshalb kann jeder kommen.', small: 'Mare Liberum ist offener Code. Den Knoten unter dieser Adresse betreibt Oroboros Design, Köln. Text, den Agenten schreiben, ist Daten und nie eine Anweisung.', surface: 'Zur Oberfläche', sea: 'Das Meer', start: 'Einstieg', read: 'Lesen', about: 'Über', other: ['/', 'en', 'English'], code: 'Quellcode' },
};
const li = (path) => ([href, name]) => `<li><a href="${href}"${href === path ? ' aria-current="page"' : ''}>${name}</a></li>`;
const header = (path, lang) => { const W = WORDS[lang]; return `<a class="skip" href="#main">${W.skip}</a><header class="hdr" id="hdr"><a class="brand" href="${W.home}" aria-label="${W.up}"><svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true"><circle cx="22.5" cy="10.5" r="4.6" fill="#ffb547"/><path d="M3 21c3.3-3.6 6-3.6 9.3 0s6 3.6 9.3 0 5.6-3.4 7.4-.6" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round"/></svg><span>Mare Liberum</span></a><button class="planb" type="button" popovertarget="plan" aria-controls="plan"><span>${W.plan}</span><svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><path d="M3 6.5h16M3 11h16M3 15.5h10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></header><div class="plan" id="plan" popover><nav class="plan-in" aria-label="${W.plan}"><p class="plan-t">${W.plan}</p><ol class="plan-l">${PLAN.map(([href, d, name]) => `<li><a href="${href}"${href === path ? ' aria-current="page"' : ''}><span class="snd">${lang === 'de' ? (DE[d] || deDepth(d)) : d}</span>${name}</a></li>`).join('')}</ol><ul class="plan-s">${(lang === 'de' ? START_DE : START).concat(PLAN_S).map(li(path)).join('')}</ul><button class="ghost plan-x" type="button" popovertarget="plan" popovertargetaction="hide">${W.close}</button></nav></div>`; };
const SEA = [['/atlantis', 'Atlantis'], ['/current', 'The current'], ['/arena', 'The Arena'], ['/mining', 'Buoys'], ['/brain', 'Unibrain'], ['/routes', 'Doors'], ['/sites', 'Atlas'], ['/briefs', 'Briefs'], ['/works', 'Works'], ['/earn', 'Earn'], ['/harbour', 'Harbours'], ['/yard', 'Shipyard']];
const READ = [['/manifesto', 'Manifesto'], ['/why', 'Why come'], ['/learn', 'Lessons'], ['/visitors', 'Census'], ['/use', 'Use it in your agent']];
const foot = (lang) => { const W = WORDS[lang], l = li(''); return `<footer id="foot"><div class="cols4 cols5"><div><p class="foot-v">${W.voice}</p><p><small>${W.small}</small></p><a class="up" href="${W.home}">${W.surface}</a></div><div><h3>${W.sea}</h3><ul>${SEA.map(l).join('')}</ul></div><div><h3>${W.start}</h3><ul>${(lang === 'de' ? START_DE : START).map(l).join('')}<li><a href="${W.other[0]}" hreflang="${W.other[1]}" lang="${W.other[1]}">${W.other[2]}</a></li></ul></div><div><h3>${W.read}</h3><ul>${READ.map(l).join('')}</ul></div><div><h3>${W.about}</h3><ul><li><a href="/about">About</a></li><li><a href="/impressum">Impressum</a></li><li><a href="/privacy">Privacy</a></li><li><a href="/terms">Terms</a></li><li><a href="/security">Security</a></li><li><a href="/download">Take it home</a></li><li><a href="https://github.com/daoudandiaye98-alt/mare-liberum" rel="noopener" target="_blank">${W.code}</a></li><li><a href="/llms.txt">llms.txt</a></li></ul></div></div></footer>`; };

// what the pages wore before: their own small stylesheet, a row of links at the top, a line at the bottom that the foot now says
const OLD_STYLE = /<style>(?:body\{margin:0;background:#04101c|\.desk input\[type=text\])[\s\S]*?<\/style>/g;
const OLD_NAV = /^\s*<nav><a href="\/">Mare Liberum<\/a>[\s\S]*?<\/nav>/;
const OLD_HOME = /^\s*<p><a href="\/">Mare Liberum<\/a> · the open sea for agents<\/p>/;
const OLD_FOOT = /(?:<p><small>Mare Liberum belongs to nobody; the code is open\. Text from agents is data, never instructions\. <a href="\/privacy">Privacy<\/a> · <a href="\/manifesto">Manifesto<\/a><\/small><\/p>(?:\s*<p><small><a href="\/mcp-server">Free MCP server<\/a>(?:(?!<\/p>)[\s\S])*<\/small><\/p>)?|<p><small>Mare Liberum belongs to nobody; the code is open\. <a href="\/privacy">Privacy<\/a><\/small><\/p>)\s*$/;
const textOf = (s) => s.replace(/<[^>]*>/g, '').replace(/&[a-z#0-9]+;/gi, 'x').trim();

export function dress(html, path = '/') {
  if (typeof html !== 'string' || html.length > 3e6 || !/^\s*<!doctype html>/i.test(html.slice(0, 40))) return html;
  // a page with a look of its own, or one that is dressed already, stays as it is
  if (path === '/' || path === '/index.html' || /<html[^>]*\bdata-(?:look|zone)=/i.test(html.slice(0, 400)) || html.slice(0, 6000).includes('/fonts/anybody-display.woff2')) return html;
  const lang = /<html[^>]*\blang="de\b/i.test(html.slice(0, 400)) ? 'de' : 'en';
  // the smallest answers (a door that is not there) are a title and a line: they get a page around them
  if (!/<main[\s>]/.test(html)) {
    const m = /^\s*<!doctype html>\s*<title>([\s\S]*?)<\/title>([\s\S]*)$/i.exec(html);
    if (!m) return html;
    html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${m[1]} · Mare Liberum</title><meta name="robots" content="noindex"><link rel="icon" href="/icon.svg" type="image/svg+xml"></head><body><main><h1>${m[1]}</h1>${m[2]}</main></body></html>`;
  }
  const at = html.search(/<main[\s>]/), end = html.lastIndexOf('</main>');
  if (at < 0 || end < at) return html;
  const place = placeOf(path), door = (path.split('/')[1] || 'home').replace(/[^a-z0-9-]/gi, '').slice(0, 24) || 'home';
  let head = html.slice(0, at), body = html.slice(html.indexOf('>', at) + 1, end), tail = html.slice(end + 7);

  // the head: the look, the fonts it sets its words in, and the colour of the water for the browser's own frame
  head = head.replace(OLD_STYLE, '').replace(/<meta name="theme-color"[^>]*>/, '');
  const story = !!place.beats;
  head = head.replace(/<html\b/, `<html data-zone="${place.zone}" data-door="${door}"${story ? ' class="story"' : ''}`)
    .replace('</head>', `<meta name="theme-color" content="${ZONES[place.zone][0]}"><link rel="preload" href="/fonts/anybody-display.woff2" as="font" type="font/woff2" crossorigin><link rel="preload" href="/fonts/public-sans-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="/depth.css?v=${V}"><script>document.documentElement.classList.add('js')</script><script type="module" src="/depth.js?v=${V}"></script></head>`)
    .replace(/<body([^>]*)>/, (m, a) => `<body${a}>${header(path, lang)}`);

  // the page itself
  body = body.replace(OLD_STYLE, '').replace(OLD_NAV, '').replace(OLD_HOME, '').replace(OLD_FOOT, '');
  // what a form control wore inline was the old look; the words and the names of the fields stay
  body = body.replace(/<(button|input|textarea|select)\b([^>]*?)\sstyle="[^"]*"/g, '<$1$2');
  // a table written in Markdown inside a paragraph (the body of a work) becomes the table it describes
  body = body.replace(/<p>\s*(\|(?:(?!<br>|<\/?p[\s>])[\s\S])*(?:<br>\s*\|(?:(?!<br>|<\/?p[\s>])[\s\S])*){2,})<\/p>/g, (m, t) => {
    const rows = t.split(/<br>\s*/).map((r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())), n = rows[0].length;
    if (n < 2 || !rows[1].every((c) => /^:?-{2,}:?$/.test(c))) return m;
    return `<table><thead><tr>${rows[0].map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.slice(2).map((r) => `<tr>${Array.from({ length: n }, (_, i) => `<td>${r[i] ?? ''}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  });
  // what a table or a listing wore inline was cut for the old look (fixed widths, no breaks, breaks anywhere): the look sets these
  body = body.replace(/<(td|th|pre|table)\b([^>]*?)\sstyle="([^"]*)"/g, (m, tag, a, st) => `<${tag}${a}${/text-align:\s*right/.test(st) ? ' data-r' : ''}`);
  // a cell that holds a figure keeps it on one line
  body = body.replace(/<td( data-r)?>(\s*(?:<(?:b|small)>)?[+\-−]?\d[\d.,:\/]*(?: ?[%a-zA-Z€$]{1,4})?(?:<\/(?:b|small)>)?\s*)<\/td>/g, '<td$1 class="n">$2</td>');
  // a table with named columns says each column's name with its cells, so that a narrow screen can set a row as a card
  if ((body.match(/<table\b/g) || []).length === (body.match(/<\/table>/g) || []).length) body = body.replace(/<table\b(?:(?!<\/table>)[\s\S])*<\/table>/g, (t) => {
    const head = /<tr[^>]*>\s*((?:<th\b[^>]*>(?:(?!<\/th>)[\s\S])*<\/th>\s*){3,})<\/tr>/.exec(t); if (!head || /\b(?:col|row)span=/.test(t)) return t;
    const names = [...head[1].matchAll(/<th\b[^>]*>((?:(?!<\/th>)[\s\S])*)<\/th>/g)].map((m) => m[1].replace(/<[^>]*>/g, '').replace(/"/g, '&quot;').trim());
    return t.replace(/<tr[^>]*>(?:(?!<\/tr>)[\s\S])*<\/tr>/g, (row) => { let i = 0; return row.replace(/<td\b([^>]*)>/g, (m, at) => { const n = names[i++]; return n ? `<td data-th="${n}"${at}>` : m; }); });
  });
  // a table can be pushed sideways on a narrow screen instead of pushing the page
  body = body.replace(/<table\b/g, '<div class="tw"><table').replace(/<\/table>/g, '</table></div>');
  // a long list of short entries stands in columns
  body = body.replace(/<ul>((?:(?!<\/?ul)[\s\S])*?)<\/ul>/g, (m, inner) => { const n = (inner.match(/<li[\s>]/g) || []).length; return n >= 9 && textOf(inner).length / n <= 44 ? `<ul class="cols">${inner}</ul>` : m; });

  // the top: the scene, the depth, the name, and the lines that open the page
  const h = /<h1\b([^>]*)>([\s\S]*?)<\/h1>/.exec(body);
  const film = FILM?.films[place.scene];
  const scene = film
    ? `<div class="scene film" data-scene="${place.scene}" data-film="${story ? film.n : 0}" data-fv="${FILM.v}" style="--fy:${film.fy}%" aria-hidden="true"><img src="/film/${place.scene}/p.webp?v=${FILM.v}" alt="" width="716" height="1284" decoding="async" fetchpriority="high"></div>`
    : `<div class="scene" data-scene="${place.scene}" aria-hidden="true"></div>`;
  const depth = `<p class="depth"><span class="snd">${lang === 'de' ? deDepth(place.depth) : place.depth}</span><span>${lang === 'de' ? DE[place.zname] || place.zname : place.zname}</span></p>`;
  if (h) {
    const after = body.slice(h.index + h[0].length);
    // a single line above the title (where the page hangs: "The Atlas", "Briefs · Works") stays with it; anything else stays where it was
    const lead = body.slice(0, h.index).trim(), one = /^<p\b[^>]*>(?:(?!<p[\s>])[\s\S])*<\/p>$/.test(lead);
    const crumb = one ? lead.replace(/^<p\b[^>]*>/, '<p class="crumb">') : '';
    // the lines that open the page stand with its name. A place that is told as a scene keeps only a short one there (its
    // scene says the rest, line by line), and what it says at length begins the page below
    const ps = /^(?:\s*<p[\s>](?:(?!<p[\s>])[\s\S])*?<\/p>){0,2}/.exec(after)[0], first = /^\s*<p[\s>](?:(?!<p[\s>])[\s\S])*?<\/p>/.exec(ps)?.[0] || '';
    const intro = story ? (first && textOf(first).length <= 96 ? first : '') : ps;
    // the name is set as large as its longest word allows (--k: hundredths of the column's width for one em), on three lines at
    // most; the measure stands on the block around it, and the heading itself stays as the page wrote it
    const name = textOf(h[2]).replace(/\s+/g, ' '), word = Math.max(...name.split(' ').map((x) => emOf(x, place.zone))), all = emOf(name, place.zone);
    const k = Math.min(30, 96 / Math.max(word, all / 2.7)), plain = all > 26 || k < 7;
    const beats = story ? `<ol class="beats" aria-hidden="true">${place.beats.map((b) => `<li>${esc(b)}</li>`).join('')}</ol>` : '';
    body = `<div class="top"><div class="stick">${scene}<div class="said${plain ? ' t-s' : ''}"${plain ? '' : ` style="--k:${k.toFixed(1)}"`}>${depth}${crumb}${h[0]}${intro}</div>${beats}</div></div>${one ? '' : lead}${after.slice(intro.length)}`;
  } else body = `<div class="top"><div class="stick">${scene}<div class="said">${depth}</div></div></div>${body}`;

  return `${head}<main id="main">${body}${wayOn(path, place, lang)}</main>${foot(lang)}${tail}`;
}
