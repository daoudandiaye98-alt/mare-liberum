// Mare Liberum · the state of the agent web: the most visited websites of the world, checked again and again for how AI agents
// can find, read and act on them. A few sites ride along with every tide; each result is kept for eight days, the board says
// what the web as a whole lets agents do. Read from what each site publishes, nothing guessed.
import { checkSite, AGENTS } from './check.mjs';
import { tldCountry } from './places.mjs';

export const TOP = [
  // the world
  'google.com', 'youtube.com', 'facebook.com', 'instagram.com', 'x.com', 'wikipedia.org', 'amazon.com', 'reddit.com', 'linkedin.com', 'netflix.com', 'microsoft.com', 'apple.com', 'github.com', 'stackoverflow.com', 'yahoo.com', 'bing.com', 'duckduckgo.com', 'pinterest.com', 'tiktok.com', 'twitch.tv',
  'whatsapp.com', 'telegram.org', 'discord.com', 'zoom.us', 'slack.com', 'notion.so', 'canva.com', 'dropbox.com', 'spotify.com', 'imdb.com', 'medium.com', 'substack.com', 'quora.com', 'wordpress.com', 'wix.com', 'squarespace.com', 'mozilla.org', 'w3.org', 'archive.org', 'weather.com',
  // AI
  'openai.com', 'chatgpt.com', 'anthropic.com', 'claude.ai', 'huggingface.co', 'perplexity.ai', 'mistral.ai', 'cohere.com', 'x.ai', 'deepseek.com', 'character.ai', 'midjourney.com', 'stability.ai', 'deepmind.google', 'meta.com', 'nvidia.com', 'cloudflare.com', 'vercel.com',
  // shops and travel
  'ebay.com', 'walmart.com', 'target.com', 'bestbuy.com', 'etsy.com', 'shopify.com', 'aliexpress.com', 'alibaba.com', 'temu.com', 'shein.com', 'ikea.com', 'nike.com', 'adidas.com', 'hm.com', 'zara.com', 'costco.com', 'homedepot.com', 'lowes.com', 'macys.com', 'wayfair.com', 'asos.com', 'booking.com', 'airbnb.com', 'expedia.com', 'tripadvisor.com', 'uber.com', 'paypal.com', 'stripe.com',
  // news
  'nytimes.com', 'washingtonpost.com', 'cnn.com', 'foxnews.com', 'bbc.com', 'theguardian.com', 'reuters.com', 'apnews.com', 'bloomberg.com', 'wsj.com', 'forbes.com', 'cnbc.com', 'npr.org', 'aljazeera.com', 'economist.com', 'ft.com', 'time.com', 'theverge.com', 'techcrunch.com', 'wired.com', 'espn.com',
  // knowledge, health, public
  'nasa.gov', 'usa.gov', 'cdc.gov', 'nih.gov', 'who.int', 'un.org', 'europa.eu', 'harvard.edu', 'mit.edu', 'stanford.edu', 'khanacademy.org', 'coursera.org', 'duolingo.com', 'mayoclinic.org', 'webmd.com', 'healthline.com', 'indeed.com', 'glassdoor.com', 'zillow.com',
  // work software
  'salesforce.com', 'adobe.com', 'oracle.com', 'ibm.com', 'sap.com', 'atlassian.com', 'hubspot.com', 'intel.com', 'samsung.com', 'sony.com',
  // United Kingdom
  'bbc.co.uk', 'gov.uk', 'nhs.uk', 'ox.ac.uk', 'cam.ac.uk', 'rightmove.co.uk', 'dailymail.co.uk', 'telegraph.co.uk', 'argos.co.uk', 'tesco.com', 'johnlewis.com', 'sky.com',
  // Germany, Austria, Switzerland
  'spiegel.de', 'zeit.de', 'faz.net', 'sueddeutsche.de', 'bild.de', 'tagesschau.de', 'zdf.de', 'otto.de', 'zalando.de', 'amazon.de', 'ebay.de', 'idealo.de', 'chefkoch.de', 'bahn.de', 'bund.de', 'check24.de', 'mediamarkt.de', 'dm.de', 'lidl.de', 'rewe.de', 'sparkasse.de', 'bmw.de', 'mercedes-benz.de', 't-online.de', 'web.de', 'heise.de', 'golem.de', 'stepstone.de', 'kicker.de', 'tum.de',
  'orf.at', 'derstandard.at', 'willhaben.at', 'srf.ch', 'nzz.ch', 'admin.ch', 'galaxus.ch',
  // France, Spain, Italy, Benelux, Nordics, Poland
  'lemonde.fr', 'lefigaro.fr', 'leboncoin.fr', 'orange.fr', 'service-public.fr', 'fnac.com', 'cdiscount.com', 'francetvinfo.fr', 'elpais.com', 'marca.com', 'elmundo.es', 'rtve.es', 'elcorteingles.es', 'idealista.com',
  'corriere.it', 'repubblica.it', 'gazzetta.it', 'ansa.it', 'rai.it', 'subito.it', 'nu.nl', 'bol.com', 'marktplaats.nl', 'nos.nl', 'rijksoverheid.nl', 'hln.be', 'aftonbladet.se', 'svt.se', 'blocket.se', 'vg.no', 'nrk.no', 'finn.no', 'dr.dk', 'yle.fi',
  'onet.pl', 'wp.pl', 'allegro.pl', 'gov.pl', 'idnes.cz', 'index.hu', 'digi24.ro', 'kathimerini.gr', 'publico.pt',
  // Eastern Europe, Turkey, Middle East, Africa
  'yandex.ru', 'mail.ru', 'vk.com', 'avito.ru', 'rozetka.com.ua', 'hurriyet.com.tr', 'trendyol.com', 'timesofisrael.com', 'haaretz.co.il', 'gulfnews.com', 'noon.com', 'ahram.org.eg', 'news24.com', 'gov.za', 'takealot.com', 'punchng.com', 'jumia.com.ng', 'nation.africa',
  // Asia
  'yahoo.co.jp', 'rakuten.co.jp', 'nhk.or.jp', 'asahi.com', 'nikkei.com', 'kakaku.com', 'baidu.com', 'qq.com', 'taobao.com', 'jd.com', 'weibo.com', 'bilibili.com', 'sina.com.cn', 'naver.com', 'daum.net', 'coupang.com', 'chosun.com',
  'flipkart.com', 'indiatimes.com', 'ndtv.com', 'hindustantimes.com', 'irctc.co.in', 'paytm.com', 'zomato.com', 'shopee.sg', 'straitstimes.com', 'gov.sg', 'tokopedia.com', 'detik.com', 'kompas.com', 'vnexpress.net', 'thairath.co.th', 'rappler.com', 'grab.com', 'dawn.com',
  // Americas, Oceania
  'globo.com', 'uol.com.br', 'mercadolivre.com.br', 'gov.br', 'mercadolibre.com.mx', 'eluniversal.com.mx', 'gob.mx', 'clarin.com', 'lanacion.com.ar', 'eltiempo.com', 'emol.com',
  'cbc.ca', 'canada.ca', 'theglobeandmail.com', 'kijiji.ca', 'abc.net.au', 'news.com.au', 'smh.com.au', 'seek.com.au', 'realestate.com.au', 'nzherald.co.nz', 'stuff.co.nz',
];

const ROLES_OF = Object.fromEntries(AGENTS.map((a) => [a.name, a.role]));
const slim = (r) => ({ s: r.score, g: r.grade, b: r.agents.filter((a) => a.allowed === false).map((a) => a.name), w: r.agents.some((a) => a.allowed == null), words: r.page?.words ?? null, js: !!r.page && r.page.words < 40, l: !!r.llms, j: !!r.page?.jsonld?.length, c: !!r.agentCard, cc: tldCountry(r.host) || undefined, st: r.reach?.status, at: r.at });

export function createWeb(h) {
  const { kv, update, now, DAY } = h;
  const web = {
    // a few sites ride along with every tide; each is read again after six days
    async webStep(n = 3) {
      const cur = Number(await kv.get('web:cursor')) || 0, pick = [];
      for (let i = 0; pick.length < n && i < TOP.length; i++) {
        const host = TOP[(cur + i) % TOP.length], last = await kv.get(`webcheck:${host}`);
        if (!last || Date.now() - Date.parse(last.at) > 6 * DAY * 1000) pick.push(host);
      }
      await kv.set('web:cursor', (cur + n) % TOP.length, 400 * DAY);
      const done = await Promise.all(pick.map(async (host) => { try { const r = await checkSite(host); if (r.reachable === false) return null; await kv.set(`webcheck:${host}`, r, 8 * DAY); return [host, slim(r)]; } catch { return null; } }));
      const got = done.filter(Boolean);
      if (got.length) await update('web:board', 400 * DAY, (cur0) => { const b = cur0 && typeof cur0 === 'object' ? cur0 : { hosts: {} }; for (const [host, x] of got) b.hosts[host] = x; b.at = now(); return b; }, () => true);
      return got.map(([host, x]) => ({ host, score: x.s }));
    },
    // what the web as a whole lets agents do
    async webBoard() {
      const b = (await kv.get('web:board')) || { hosts: {} }, rows = Object.entries(b.hosts).map(([host, x]) => ({ host, ...x })), n = rows.length;
      const pct = (k) => (n ? Math.round((100 * k) / n) : 0);
      const agents = AGENTS.map((a) => { const blocked = rows.filter((r) => r.b.includes(a.name)).length; return { name: a.name, op: a.op, role: a.role, blocked, share: pct(blocked) }; }).sort((x, y) => y.blocked - x.blocked);
      const byCc = {}; for (const r of rows) if (r.cc) { const c = byCc[r.cc] || (byCc[r.cc] = { cc: r.cc, n: 0, sum: 0 }); c.n++; c.sum += r.s; }
      const sorted = rows.slice().sort((x, y) => y.s - x.s || (x.host < y.host ? -1 : 1));
      return { at: b.at || null, checked: n, of: TOP.length, average: n ? Math.round(rows.reduce((s, r) => s + r.s, 0) / n) : null,
        shares: { blocksSomeAgent: pct(rows.filter((r) => r.b.length).length), blocksAnAssistant: pct(rows.filter((r) => r.b.some((x) => ROLES_OF[x] === 'live')).length), wall: pct(rows.filter((r) => r.w).length), jsOnly: pct(rows.filter((r) => r.js).length), llms: pct(rows.filter((r) => r.l).length), jsonld: pct(rows.filter((r) => r.j).length), agentCard: pct(rows.filter((r) => r.c).length) },
        grades: ['A', 'B', 'C', 'D', 'E'].map((g) => ({ g, n: rows.filter((r) => r.g === g).length })), agents,
        countries: Object.values(byCc).map((c) => ({ cc: c.cc, sites: c.n, average: Math.round(c.sum / c.n) })).sort((x, y) => y.sites - x.sites || y.average - x.average),
        sites: sorted.map((r) => ({ host: r.host, score: r.s, grade: r.g, blocked: r.b, wall: r.w || undefined, jsOnly: r.js || undefined, llms: r.l, jsonld: r.j, agentCard: r.c, cc: r.cc, at: r.at })),
        note: 'the most visited websites of the world, read again every six days from what each publishes (robots.txt, llms.txt, home page, agent card); open data, CC0' };
    },
    // anyone may ask the sea to read the next sites a little sooner; one step at a time, at most every twenty seconds
    async webNudge() { if (await kv.get('web:nudge')) return { calm: true, note: 'a step ran a moment ago' }; await kv.set('web:nudge', 1, 20); return { read: await web.webStep(4) }; },
    async webCheckOf(host) { return kv.get(`webcheck:${host}`); },
  };
  return web;
}
