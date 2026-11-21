// Mare Liberum · find the stores that sell to agents: ask Shopify's open Global Catalog (every Shopify merchant) for many kinds of goods,
// collect the sellers, then read each seller's own /.well-known/ucp. Sellers that answer join the seed list of the sea.
// Usage: node tools/harvest-shopify.mjs [pages per topic]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fetchJson } from '../node/core.mjs';
import { NEEDS } from '../node/needs.mjs';
const EP = 'https://catalog.shopify.com/api/ucp/mcp', PROFILE = 'https://mareliberum.dev/ucp/agent.json', UA = 'MareLiberum/2.2 (open sea for agents; +https://mareliberum.dev)';
const PAGES = Number(process.argv[2]) || 2;
const BASE_TOPICS = `running shoes;sneakers;hiking boots;sandals;dress shoes;winter jacket;rain jacket;hoodie;t-shirt;jeans;dress;swimwear;lingerie;socks;yoga pants;sportswear;suit;tie;hat;scarf;gloves;sunglasses;watch;necklace;earrings;ring;bracelet;handbag;backpack;wallet;luggage;belt;
headphones;earbuds;speaker;phone case;charger;power bank;laptop sleeve;keyboard;mouse;monitor;webcam;microphone;camera;camera lens;drone;smart watch;fitness tracker;gaming controller;video game;board game;puzzle;
sofa;chair;desk;bed frame;mattress;pillow;bedding;duvet;towel;rug;curtains;lamp;ceiling light;candle;vase;wall art;poster;mirror;storage box;shelf;plant pot;artificial plant;
coffee beans;tea;matcha;chocolate;snacks;hot sauce;olive oil;spices;honey;protein powder;supplements;vitamins;energy drink;wine;craft beer;whisky glass;coffee maker;espresso machine;kettle;blender;knife set;cookware;frying pan;cast iron;baking;water bottle;lunch box;tumbler;
skincare;moisturizer;serum;sunscreen;shampoo;conditioner;hair oil;perfume;cologne;makeup;lipstick;nail polish;beard oil;razor;toothbrush;
dog food;dog toy;dog collar;cat food;cat toy;cat litter;aquarium;bird feeder;
baby clothes;stroller;diapers;baby toy;kids shoes;lego;plush toy;toy car;doll;
bike;bike helmet;bike light;skateboard;surfboard;wetsuit;snowboard;ski;tent;sleeping bag;camping stove;fishing rod;golf balls;golf club;tennis racket;yoga mat;dumbbells;kettlebell;resistance bands;climbing shoes;
guitar;guitar strings;ukulele;drum sticks;piano keyboard;vinyl record;headphones studio;
notebook;planner;fountain pen;pencil;markers;art supplies;paint brushes;canvas;sewing;yarn;knitting needles;stickers;greeting cards;gift card;
car accessories;car phone mount;motorcycle helmet;tools;drill;screwdriver;garden hose;seeds;fertilizer;lawn mower;grill;bbq sauce;
phone;tablet;e-reader;books;cookbook;comic;
cbd;incense;crystals;tarot cards;candles soy;soap;bath bombs;essential oils;diffuser;massage gun;
sneakers limited edition;streetwear;vintage clothing;workwear;uniform;scrubs;cycling jersey;running shorts;compression socks;trail running shoes;marathon gel`.split(/[;\n]/).map((s) => s.trim()).filter(Boolean);
const TOPICS = [...new Set([...BASE_TOPICS, ...NEEDS])];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function search(query, cursor) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(EP, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json', 'user-agent': UA }, signal: AbortSignal.timeout(20000),
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'search_catalog', arguments: { meta: { 'ucp-agent': { profile: PROFILE } }, catalog: { query, pagination: { limit: 50, ...(cursor ? { cursor } : {}) } } } } }) });
      if (r.ok) return (await r.json()).result?.structuredContent || {};
      if (r.status === 429) await sleep(4000 * (i + 1));
    } catch {}
    await sleep(800 * (i + 1));
  }
  return {};
}
const sellers = new Map();
let i = 0, calls = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (i < TOPICS.length) {
    const q = TOPICS[i++]; let cursor;
    for (let p = 0; p < PAGES; p++) {
      const sc = await search(q, cursor); calls++;
      for (const pr of sc.products || []) for (const v of pr.variants || []) { const s = v.seller; if (s?.url && /^https:\/\//.test(s.url)) { try { const h = new URL(s.url).hostname.toLowerCase().replace(/^www\./, ''); if (!sellers.has(h)) sellers.set(h, { name: String(s.name || '').slice(0, 120), topics: new Set() }); sellers.get(h).topics.add(q); } catch {} } }
      cursor = sc.pagination?.cursor; if (!sc.pagination?.has_next_page || !cursor) break;
      await sleep(150);
    }
  }
}));
console.log(`global catalog: ${calls} calls over ${TOPICS.length} topics, ${sellers.size} sellers`);
// every seller is read first-hand: only stores whose own domain answers /.well-known/ucp join
const known = new Set(), seedFile = 'seeds-ucp.txt';
if (existsSync(seedFile)) for (const l of readFileSync(seedFile, 'utf8').split('\n')) known.add(l.trim().toLowerCase());
const pages = existsSync('store-pages.json') ? JSON.parse(readFileSync('store-pages.json', 'utf8')) : {};
const hosts = [...sellers.keys()].filter((h) => !known.has(h)), open = [];
let k = 0, done = 0;
await Promise.all(Array.from({ length: 40 }, async () => {
  while (k < hosts.length) {
    const h = hosts[k++];
    const m = await fetchJson(`https://${h}/.well-known/ucp`, 300000, 8000).catch(() => null);
    if (m?.ucp) { open.push(h); if (!pages[h]) { const s = sellers.get(h); pages[h] = { title: s.name || h, description: `Sells ${[...s.topics].slice(0, 4).join(', ')}.` }; } }
    if (++done % 1000 === 0) console.log(`  read ${done}/${hosts.length}, ${open.length} speak UCP`);
  }
}));
const all = [...new Set([...known, ...open])].filter(Boolean).sort();
writeFileSync(seedFile, '# Stores whose own domain answers /.well-known/ucp. Found through the open Shopify Global Catalog and read first-hand.\n' + all.filter((l) => !l.startsWith('#')).join('\n') + '\n');
writeFileSync('store-pages.json', JSON.stringify(Object.fromEntries(Object.entries(pages).sort(([a], [b]) => (a < b ? -1 : 1)))));
console.log(`new stores that speak UCP: ${open.length}; seed list now ${all.filter((l) => !l.startsWith('#')).length}`);
