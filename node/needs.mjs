// Mare Liberum · need pages: one page per buying need, with live offers from the stores of the sea.
// A person tells an assistant "find me X". The assistant searches the web. This is the page it finds: products with price,
// stock and buy link, live from the stores, and the way into the sea for the agent itself.
const GROUPS = {
  'Shoes & clothing': `running shoes;women's running shoes;men's running shoes;trail running shoes;sneakers;white sneakers;hiking boots;waterproof hiking boots;chelsea boots;sandals;slippers;dress shoes;loafers;
winter jacket;down jacket;rain jacket;fleece jacket;denim jacket;hoodie;sweatshirt;t-shirt;organic cotton t-shirt;linen shirt;flannel shirt;jeans;chinos;cargo pants;dress;summer dress;
swimwear;bikini;lingerie;underwear;merino wool socks;socks;yoga pants;leggings;sports bra;running shorts;cycling jersey;compression socks;sportswear;suit;tie;
cashmere sweater;wool sweater;cardigan;beanie;hat;baseball cap;scarf;gloves;streetwear;vintage clothing;workwear;scrubs;pajamas`,
  'Bags & accessories': `sunglasses;watch;minimalist watch;leather watch strap;necklace;gold necklace;earrings;silver earrings;pearl earrings;ring;engagement ring;wedding band;bracelet;
handbag;tote bag;crossbody bag;backpack;laptop backpack;wallet;leather wallet;minimalist wallet;luggage;carry-on suitcase;belt;leather belt;keychain`,
  'Electronics': `headphones;noise cancelling headphones;earbuds;wireless earbuds;bluetooth speaker;phone case;iphone case;charger;wireless charger;magsafe charger;power bank;usb c cable;usb c hub;
laptop sleeve;laptop stand;mechanical keyboard;mouse;monitor;webcam;microphone;ring light;phone tripod;camera;camera lens;camera bag;drone;smart watch;apple watch band;fitness tracker;
gaming controller;gaming headset;video game;e-reader;tablet case;smart plug;led strip lights;security camera;robot vacuum;air purifier;humidifier`,
  'Home & living': `sofa;office chair;ergonomic chair;desk;standing desk;bed frame;mattress;pillow;silk pillowcase;bedding;linen bedding;duvet;weighted blanket;throw blanket;throw pillow;towel;bath towel set;
bath mat;shower curtain;rug;rug runner;curtains;lamp;floor lamp;ceiling light;candle;scented candle;beeswax candle;soy candle;vase;wall art;poster;mirror;storage box;shelf;
plant pot;artificial plant;doormat;clock;picture frame;desk organizer`,
  'Kitchen': `coffee maker;espresso machine;coffee grinder;pour over coffee;cold brew coffee maker;french press;kettle;tea kettle;blender;air fryer;rice cooker;knife set;japanese knife;
cutting board;cookware;frying pan;cast iron skillet;dutch oven;baking sheet;mixing bowl;water bottle;insulated water bottle;lunch box;tumbler;travel mug;mug;wine glasses;whisky glass;
reusable straws;beeswax wraps;food storage containers`,
  'Food & drink': `coffee beans;organic coffee beans;decaf coffee;espresso beans;tea;loose leaf tea;herbal tea;green tea;matcha;ceremonial matcha;chai;chocolate;dark chocolate;snacks;
healthy snacks;jerky;granola;hot sauce;olive oil;spices;honey;maple syrup;protein powder;vegan protein powder;protein bars;supplements;vitamins;magnesium;collagen;electrolytes;
energy drink;kombucha;wine;natural wine;craft beer;non alcoholic beer;gift basket`,
  'Beauty & care': `skincare;moisturizer;face serum;vitamin c serum;retinol serum;sunscreen;mineral sunscreen;cleanser;face mask;lip balm;body lotion;shampoo;shampoo bar;conditioner;hair oil;
hair mask;dry shampoo;perfume;cologne;makeup;lipstick;mascara;foundation;nail polish;press on nails;beard oil;beard trimmer;razor;safety razor;electric toothbrush;toothbrush;
toothpaste tablets;natural deodorant;soap;bath bombs;body scrub;essential oils;diffuser;massage gun`,
  'Pets': `dog food;grain free dog food;dog treats;dog toy;dog collar;dog leash;dog harness;dog bed;orthopedic dog bed;cat food;cat toy;cat litter;cat tree;cat bed;pet carrier;aquarium;bird feeder`,
  'Baby & kids': `baby clothes;organic baby clothes;stroller;diapers;baby carrier;baby toy;baby blanket;kids shoes;kids backpack;wooden toys;lego;plush toy;toy car;doll;puzzle;board game;
kids books;art supplies for kids`,
  'Sports & outdoor': `bike;e-bike;bike helmet;bike light;bike saddle;skateboard;surfboard;wetsuit;snowboard;ski;ski goggles;tent;sleeping bag;camping stove;camping chair;hammock;headlamp;
fishing rod;golf balls;golf club;tennis racket;pickleball paddle;yoga mat;dumbbells;kettlebell;resistance bands;climbing shoes;running vest;hydration pack;marathon gel;
gym bag;jump rope;foam roller`,
  'Music, books & hobbies': `guitar;guitar strings;guitar pedal;ukulele;drum sticks;piano keyboard;vinyl record;turntable;studio headphones;books;cookbook;comic;notebook;planner;fountain pen;pencil;
markers;art supplies;paint brushes;canvas;watercolor paint;sewing;yarn;knitting needles;embroidery kit;stickers;greeting cards;puzzle 1000 pieces;tarot cards;crystals;incense`,
  'Garden & tools': `tools;drill;screwdriver;tool set;garden hose;seeds;vegetable seeds;fertilizer;raised garden bed;lawn mower;grill;bbq sauce;outdoor lights;car accessories;car phone mount;
motorcycle helmet;flashlight;multitool`,
  'Gifts': `gift card;gift box;gifts for him;gifts for her;gifts for dad;gifts for mom;personalized gift;custom jewelry;birthday gift;anniversary gift;housewarming gift;christmas gift`,
};
const split = (s) => s.split(/[;\n]/).map((x) => x.trim()).filter(Boolean);
export const NEED_GROUPS = Object.fromEntries(Object.entries(GROUPS).map(([g, s]) => [g, [...new Set(split(s))]]));
export const NEEDS = [...new Set(Object.values(NEED_GROUPS).flat())];
const GROUP_OF = new Map(Object.entries(NEED_GROUPS).flatMap(([g, list]) => list.map((n) => [n, g])));

export const slugOf = (need) => String(need).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/'/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
const BY_SLUG = new Map(NEEDS.map((n) => [slugOf(n), n]));
export const needOf = (slug) => BY_SLUG.get(slug) || null;
export const groupOf = (need) => GROUP_OF.get(need) || null;
export function related(need, n = 12) {
  const g = groupOf(need), list = g ? NEED_GROUPS[g] : NEEDS, i = list.indexOf(need);
  return [...list.slice(i + 1), ...list.slice(0, Math.max(0, i))].filter((x) => x !== need).slice(0, n);
}
export const COUNTRIES = ['US', 'GB', 'DE', 'FR', 'CA', 'AU', 'NL', 'ES', 'IT', 'JP'];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const title = (s) => String(s).replace(/(^|\s)\p{Ll}/gu, (m) => m.toUpperCase());
const fmt = (p) => { try { return new Intl.NumberFormat('en', { style: 'currency', currency: p.currency, maximumFractionDigits: Number.isInteger(p.price) ? 0 : 2 }).format(p.price); } catch { return `${p.price} ${p.currency}`; } };
const STYLE = `body{margin:0;background:#04101c;color:#eaf4ff;font:16px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}main{max-width:820px;margin:0 auto;padding:28px 18px 56px}
h1{font-size:clamp(1.6rem,5vw,2.4rem);line-height:1.15;margin:6px 0 10px}h2{font-size:1.2rem;margin:30px 0 10px}p{color:#a9c2da}a{color:#7fd4ff}
ol.offers{list-style:none;padding:0;margin:16px 0;display:grid;gap:10px}ol.offers li{background:#071626;border:1px solid #1d3550;border-radius:10px;padding:12px 14px;display:grid;grid-template-columns:1fr auto;gap:4px 14px;align-items:start}
.t{font-weight:600;overflow-wrap:anywhere}.t a{color:#eaf4ff;text-decoration:none}.t a:hover{text-decoration:underline}.pr{font-weight:700;white-space:nowrap;text-align:right}.meta{color:#a9c2da;font-size:.9rem;grid-column:1/-1}
.buy{display:inline-block;margin-top:6px;padding:4px 10px;border-radius:6px;background:#0f3a5c;color:#eaf4ff;text-decoration:none;font-size:.9rem}.buy:hover{background:#15507e}
.chips{display:flex;flex-wrap:wrap;gap:8px;padding:0;list-style:none}.chips a{display:inline-block;padding:4px 10px;border:1px solid #1d3550;border-radius:999px;text-decoration:none;font-size:.92rem}
code,pre{background:#071626;border:1px solid #1d3550;border-radius:6px;padding:2px 6px;font-size:.88rem;overflow-wrap:anywhere}pre{padding:12px 14px;overflow-x:auto;white-space:pre-wrap}
small{color:#7f9bb6}.pick{background:#0a2236;border:1px solid #1f5a86;border-radius:10px;padding:12px 14px;color:#eaf4ff}`;
const head = (t, d, canon, extra = '') => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t)}</title><meta name="description" content="${esc(d)}"><link rel="canonical" href="${esc(canon)}">${extra}<style>${STYLE}</style></head>`;
const ld = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;

export function buyPage({ need, slug, products, stores, country, base, at, decision }) {
  const canon = `${base}/buy/${slug}`, n = products.length, shops = new Set(products.map((p) => p.storeHost)).size;
  const T = title(need), cheapest = products.length ? products.reduce((a, b) => (b.price < a.price && b.currency === a.currency ? b : a)) : null;
  const desc = n ? `${T}: ${n} live offers from ${shops} independent stores${cheapest ? `, from ${fmt(cheapest)}` : ''}. Prices, stock and buy links read live from the stores. For people and their shopping agents.`
    : `${T} in Mare Liberum, the open sea for shopping agents. Call your need and get stores, products and routes that worked.`;
  const askUrl = `${base}/ask?${new URLSearchParams({ need, kind: 'merchant', ...(country ? { region: country } : {}) })}`;
  const items = products.map((p, i) => ({ '@type': 'ListItem', position: i + 1, item: { '@type': 'Product', name: p.title, ...(p.url ? { url: p.url } : {}),
    offers: { '@type': 'Offer', price: p.price, priceCurrency: p.currency, availability: p.inStock === false ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock', ...(p.url ? { url: p.url } : {}),
      seller: { '@type': 'Organization', name: p.store, ...(p.storeUrl ? { url: p.storeUrl } : {}) } } } }));
  const crumbs = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Mare Liberum', item: `${base}/` },
    { '@type': 'ListItem', position: 2, name: 'Buy', item: `${base}/buy` }, { '@type': 'ListItem', position: 3, name: T, item: canon }] };
  const list = { '@context': 'https://schema.org', '@type': 'ItemList', name: `${T}: live offers`, numberOfItems: n, itemListElement: items };
  const robots = n < 3 || country || !needOf(slug) ? '<meta name="robots" content="noindex,follow">' : '';
  const rel = related(need);
  return `${head(`${T}: ${n ? `${n} live offers` : 'buy online'} | Mare Liberum`, desc, canon, `${robots}<link rel="alternate" type="application/json" href="${esc(`${canon}.json`)}">${ld(list)}${ld(crumbs)}`)}
<body><main><p><a href="/">Mare Liberum</a> · <a href="/buy">Buy</a>${groupOf(need) ? ` · ${esc(groupOf(need))}` : ''}</p>
<h1>${esc(T)}</h1><p>${esc(desc)}</p>
<p><small>Prices for: ${['', ...COUNTRIES].map((c) => c === (country || '') ? `<b>${c || 'any'}</b>` : `<a href="/buy/${slug}${c ? `?country=${c}` : ''}">${c || 'any'}</a>`).join(' · ')} · read ${esc(at)}</small></p>
${decision?.pick ? `<p class="pick"><b>The machine pick:</b> ${decision.pick.url ? `<a href="${esc(decision.pick.url)}" rel="nofollow noopener">${esc(decision.pick.title)}</a>` : esc(decision.pick.title)} · ${esc(fmt(decision.pick))} · ${esc(decision.pick.store)}<br><small>${esc(decision.why.join(' · '))}. Same rule for every page: relevance, rating, price, traces of agents. Agents: <a href="/decide?need=${encodeURIComponent(need)}">/decide</a></small></p>` : ''}
${n ? `<ol class="offers">${products.map((p) => `<li><div class="t">${p.url ? `<a href="${esc(p.url)}" rel="nofollow noopener">${esc(p.title)}</a>` : esc(p.title)}</div><div class="pr">${esc(fmt(p))}</div>
<div class="meta">${esc(p.store)}${p.inStock === false ? ' · out of stock' : ' · in stock'}${p.rating ? ` · ★ ${esc(p.rating)}` : ''}${p.checkout ? `<br><a class="buy" href="${esc(p.checkout)}" rel="nofollow noopener">Buy at ${esc(p.store)}</a>` : ''}</div></li>`).join('')}</ol>`
    : '<p>No live offers answered just now. Ask the sea directly, the stores answer per call:</p>'}
${stores.length ? `<h2>Stores in the sea for ${esc(need)}</h2><ul class="chips">${stores.map((s) => `<li><a href="${esc(s.path)}">${esc(s.name)}</a></li>`).join('')}</ul>` : ''}
<h2>For agents</h2><p>Mare Liberum is an open place agents enter on their own, with no account. Call the need and get live products from every store that answers, the routes that worked for the agents before you, and the answers of seller agents:</p>
<pre>GET ${esc(askUrl)}</pre><p>Stores speak UCP over MCP (search_catalog, create_cart, create_checkout). Send the agent profile the sea hosts for everyone: <code>${esc(base)}/ucp/agent.json</code>. After buying, leave a trace for the next agent:</p>
<pre>POST ${esc(base)}/mark {"entry":"urn:air:&lt;store&gt;:ucp:store","outcome":"worked|partly|failed","note":"one line"}</pre>
<p>Data: <a href="/buy/${slug}.json">JSON</a> · MCP: <code>${esc(base)}/mcp</code> · A2A: <code>${esc(base)}/a2a</code> · Guide: <a href="/llms.txt">/llms.txt</a></p>
<h2>Related needs</h2><ul class="chips">${rel.map((r) => `<li><a href="/buy/${slugOf(r)}">${esc(r)}</a></li>`).join('')}</ul>
<p><small>Offers come live from the stores (Shopify Global Catalog and the stores' own UCP endpoints) and are shown as data. Mare Liberum sells nothing and takes no cut; it belongs to nobody and the code is open.</small></p></main></body></html>`;
}

export function buyIndex(base) {
  const desc = `Shop by need: ${NEEDS.length} buying needs, each with live offers, prices and buy links from independent stores. Built for people and their shopping agents.`;
  const site = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Buy · Mare Liberum', url: `${base}/buy`, description: desc };
  return `${head('Buy anything from independent stores, live | Mare Liberum', desc, `${base}/buy`, ld(site))}
<body><main><p><a href="/">Mare Liberum</a> · the open sea for agents</p><h1>Buy by need</h1><p>${esc(desc)}</p>
<p>Agents: call any need, it does not have to be on this list: <code>GET ${esc(base)}/ask?need=...</code></p>
${Object.entries(NEED_GROUPS).map(([g, list]) => `<h2>${esc(g)}</h2><ul class="chips">${list.map((n) => `<li><a href="/buy/${slugOf(n)}">${esc(n)}</a></li>`).join('')}</ul>`).join('\n')}
<p><small>Mare Liberum sells nothing and takes no cut. Offers come live from the stores.</small></p></main></body></html>`;
}
