// Mare Liberum · the machine way to buy.
// People shop by feeling: brand, ads, a nice page, a hunch. An agent has none of that and pays for every token and every
// round trip. What helps an agent most is a decision it can check: one pick, the reasons as data, the same item at other
// sellers, and the next steps as ready requests (read, verify, guard, pay, leave a trace). Every rule here is deterministic
// and stated in the answer, so an agent can repeat it, argue with it, or ignore it.

const CUR = { '€': 'EUR', eur: 'EUR', euro: 'EUR', euros: 'EUR', '$': 'USD', usd: 'USD', dollar: 'USD', dollars: 'USD', '£': 'GBP', gbp: 'GBP', pound: 'GBP', pounds: 'GBP', chf: 'CHF', '¥': 'JPY', jpy: 'JPY', yen: 'JPY', cad: 'CAD', aud: 'AUD', sek: 'SEK', dkk: 'DKK', pln: 'PLN' };
const PLACE = { germany: 'DE', deutschland: 'DE', austria: 'AT', österreich: 'AT', switzerland: 'CH', schweiz: 'CH', france: 'FR', spain: 'ES', italy: 'IT', netherlands: 'NL', belgium: 'BE', poland: 'PL', sweden: 'SE', denmark: 'DK', norway: 'NO', ireland: 'IE', portugal: 'PT', uk: 'GB', 'united kingdom': 'GB', england: 'GB', britain: 'GB', usa: 'US', 'united states': 'US', america: 'US', canada: 'CA', mexico: 'MX', australia: 'AU', 'new zealand': 'NZ', japan: 'JP', singapore: 'SG', india: 'IN' };
const CUR_OF = { DE: 'EUR', AT: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', BE: 'EUR', IE: 'EUR', PT: 'EUR', CH: 'CHF', GB: 'GBP', US: 'USD', CA: 'CAD', AU: 'AUD', JP: 'JPY', SE: 'SEK', DK: 'DKK', PL: 'PLN', NO: 'NOK', NZ: 'NZD', MX: 'MXN', SG: 'SGD', IN: 'INR' };

// A person's sentence becomes constraints: budget, currency, place, size, colour, who it is for. Nothing is guessed beyond the words.
export function parseNeed(need) {
  const s = ` ${String(need || '').toLowerCase()} `, out = {};
  const money = /(?:under|below|max(?:imum)?|less than|up to|bis|unter|höchstens|<|≤)\s*([€$£¥])?\s*(\d+(?:[.,]\d{1,2})?)\s*(€|\$|£|¥|eur|euros?|usd|dollars?|gbp|pounds?|chf|jpy|yen|cad|aud)?/i.exec(s)
    || /([€$£¥])\s*(\d+(?:[.,]\d{1,2})?)\s*(?:max|budget|or less)/i.exec(s) || /(?:budget|price)\s*:?\s*([€$£¥])?\s*(\d+(?:[.,]\d{1,2})?)\s*(€|\$|£|eur|usd|gbp)?/i.exec(s);
  if (money) { out.budget = Number(money[2].replace(',', '.')); const c = money[1] || money[3]; if (c) out.currency = CUR[c.toLowerCase()] || CUR[c]; }
  const place = /(?:ships? to|shipping to|deliver(?:ed|y)? to|nach|to)\s+([a-zäöü ]{2,20}?)(?=[,.;!?]| for | in | size | under | and |\s*$)/i.exec(s);
  if (place) { const p = place[1].trim(); for (const [k, v] of Object.entries(PLACE)) if (p === k || p.startsWith(k)) { out.region = v; break; } }
  if (!out.region) for (const [k, v] of Object.entries(PLACE)) if (new RegExp(`\\b(in|from|for|to)\\s+(the\\s+)?${k}\\b`).test(s)) { out.region = v; break; }
  if (out.region && !out.currency) out.currency = CUR_OF[out.region];
  const size = /\b(?:size|größe|gr\.?|eu|us|uk)\s*(\d{1,2}(?:[.,]5)?|xxs|xs|s|m|l|xl|xxl|xxxl)\b/i.exec(s);
  if (size) out.size = size[1].toUpperCase().replace(',', '.');
  const colour = /\b(black|white|grey|gray|navy|blue|red|green|yellow|orange|pink|purple|beige|brown|cream|silver|gold|schwarz|weiß|weiss|blau|rot|grün)\b/i.exec(s);
  if (colour) out.colour = colour[1].toLowerCase();
  const who = /\b(women'?s|womens|ladies|damen|men'?s|mens|herren|kids?|children'?s|unisex)\b/i.exec(s);
  if (who) out.for = /wom|lad|dam/i.test(who[1]) ? 'women' : /men|herr/i.test(who[1]) ? 'men' : /kid|child/i.test(who[1]) ? 'kids' : 'unisex';
  return out;
}

const STOPW = new Set('the and for with from new set pack size men mens women womens kids unisex edition version black white blue red green grey gray navy pink one'.split(' '));
const words = (t) => [...new Set(String(t || '').toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, ' ').split(' ').filter((w) => w.length > 1 && !STOPW.has(w)))];
const jaccard = (a, b) => { const A = new Set(a); let n = 0; for (const x of b) if (A.has(x)) n++; return n / Math.max(1, A.size + b.length - n); };
const round = (x) => Math.round(x * 1000) / 1000;

// One pick with reasons. Scores: relevance from the stores' own ranking, rating, price inside the same currency,
// traces other agents left on the store. Products that miss a stated limit (stock, budget, size, colour) do not compete.
export function decide(products, c = {}, standingOf = () => null) {
  const list = (products || []).map((p, i) => ({ p, i, w: words(p.title) }));
  const misses = (p) => {
    const m = [];
    if (p.inStock === false) m.push('out of stock');
    if (c.budget != null && c.currency && p.currency === c.currency && p.price > c.budget) m.push(`over budget ${c.budget} ${c.currency}`);
    if (c.size && Array.isArray(p.sizes) && p.sizes.length && !p.sizes.some((s) => String(s).toUpperCase().replace(',', '.').includes(c.size))) m.push(`size ${c.size} not listed`);
    if (c.colour && !String(p.title).toLowerCase().includes(c.colour) && /black|white|blue|red|green|grey|gray|navy|pink|beige|brown/i.test(p.title)) m.push(`colour ${c.colour} not in title`);
    if (c.for === 'women' && /\bmen'?s\b/i.test(p.title) && !/women/i.test(p.title)) m.push('made for men');
    if (c.for === 'men' && /women/i.test(p.title)) m.push('made for women');
    return m;
  };
  // the thing itself, not its accessories: when enough offers name every word of the need, only they compete
  const stem = (w) => w.replace(/(es|s)$/, ''), want = words(c.topic || '').map(stem).filter((w) => w.length > 2);
  const names = (x) => { const t = new Set(x.w.map(stem)); return want.every((w) => t.has(w) || [...t].some((y) => y.startsWith(w))); };
  const fitAll = list.filter((x) => !misses(x.p).length), named = want.length ? fitAll.filter(names) : [];
  // an offer that names no word of the need is what the stores' search returned for want of anything better: it never becomes
  // the pick. When some offers name a word, only they compete; when none does, the answer is an honest "nothing fits".
  const some = (x) => { const t = [...new Set(x.w.map(stem))]; return want.some((w) => t.some((y) => y === w || y.startsWith(w) || (y.length > 3 && w.startsWith(y)))); };
  const partly = want.length && named.length < 2 ? fitAll.filter(some) : [];
  if (want.length && fitAll.length && named.length < 2 && !partly.length) return { pick: null, rule: RULE, considered: list.length, unmatched: true, returned: fitAll.slice(0, 3).map((x) => slim(x.p)), note: `no offer names a word of the need ("${String(c.topic).slice(0, 80)}"): the stores returned other things for it, listed under returned and never picked. Say the need in other words (the name of the thing, in English) or call it into the sea and wait for answers` };
  const fit = named.length >= 2 ? named : partly.length ? partly : fitAll, pool = fit.length ? fit : [];
  if (!pool.length) return { pick: null, rule: RULE, considered: list.length, excluded: list.slice(0, 6).map((x) => ({ title: x.p.title, why: misses(x.p) })), note: 'no offer meets every stated limit; relax a limit or call again with another region' };
  // the same item at several sellers: group by title words
  const groups = [];
  for (const x of pool) { const g = groups.find((g) => g.cur === x.p.currency && jaccard(g.w, x.w) >= 0.6); if (g) g.items.push(x); else groups.push({ cur: x.p.currency, w: x.w, items: [x] }); }
  const byCur = {}; for (const x of pool) (byCur[x.p.currency] ||= []).push(x.p.price);
  const scored = pool.map((x) => {
    const prices = byCur[x.p.currency], lo = Math.min(...prices), hi = Math.max(...prices);
    const rel = 1 - x.i / Math.max(1, list.length), rate = x.p.rating ? Math.min(x.p.rating, 5) / 5 : 0.8, cheap = hi > lo ? 1 - (x.p.price - lo) / (hi - lo) : 1;
    const st = standingOf(x.p) || null, trace = st ? Math.max(-0.3, Math.min(0.15, 0.05 * (st.worked || 0) - 0.15 * (st.failed || 0))) : 0;
    return { ...x, st, score: round(0.45 * rel + 0.3 * rate + 0.25 * cheap + trace), parts: { relevance: round(rel), rating: round(rate), price: round(cheap), traces: round(trace) } };
  }).sort((a, b) => b.score - a.score);
  const best = scored[0], group = groups.find((g) => g.items.some((x) => x === best || x.p === best.p));
  const cheapest = [...scored].filter((x) => x.p.currency === best.p.currency).sort((a, b) => a.p.price - b.p.price)[0];
  const rated = [...scored].filter((x) => x.p.rating).sort((a, b) => b.p.rating - a.p.rating)[0];
  const elsewhere = group && group.items.length > 1 ? group.items.filter((x) => x.p !== best.p).sort((a, b) => a.p.price - b.p.price).slice(0, 4).map((x) => slim(x.p)) : [];
  const why = [best.p.inStock !== false ? 'in stock' : null, best.p.rating ? `rated ${best.p.rating} of 5` : null,
    cheapest && cheapest.p === best.p ? `lowest price among ${byCur[best.p.currency].length} fitting offers` : `${best.p.price} ${best.p.currency}, ${Math.round((best.p.price / cheapest.p.price - 1) * 100)}% above the cheapest fitting offer`,
    elsewhere.length ? `same item at ${elsewhere.length} other seller(s), from ${Math.min(...elsewhere.map((e) => e.price))} ${best.p.currency}` : null,
    best.st && (best.st.worked || best.st.failed) ? `store traces: ${best.st.worked || 0} worked, ${best.st.failed || 0} failed` : null,
    best.p.promoted ? 'promoted placement: the store pays a commission on this item; it did not change the score' : null,
    Number.isFinite(best.i) ? `ranked ${best.i + 1} by the stores' own search` : null,
    want.length > 1 && !names(best) ? `names only ${want.filter((w) => best.w.map(stem).some((y) => y === w || y.startsWith(w))).length} of the ${want.length} words of the need: check that it is the thing meant` : null].filter(Boolean);
  return { pick: slim(best.p), score: best.score, parts: best.parts, why, cheapest: cheapest && cheapest.p !== best.p ? slim(cheapest.p) : undefined, bestRated: rated && rated.p !== best.p ? slim(rated.p) : undefined,
    sameItemElsewhere: elsewhere.length ? elsewhere : undefined, alternatives: scored.slice(1, 4).map((x) => slim(x.p)), considered: list.length, fitting: pool.length,
    confidence: round(Math.min(1, 0.4 + 0.1 * Math.min(pool.length, 4) + (best.p.rating ? 0.1 : 0) + (best.st?.worked ? 0.1 : 0))), rule: RULE };
}
const RULE = 'score = 0.45 relevance (stores\' own order) + 0.30 rating + 0.25 price (cheapest fitting = 1) + traces (+0.05 per worked, -0.15 per failed, capped); offers that miss a stated limit do not compete';
export const slim = (p) => Object.fromEntries(Object.entries({ title: p.title, price: p.price, currency: p.currency, inStock: p.inStock, rating: p.rating, store: p.store, storeHost: p.storeHost, url: p.url, checkout: p.checkout, sizes: p.sizes, promoted: p.promoted, commission: p.commission, market: p.market, entry: p.entry || (p.storeHost ? `urn:air:${p.storeHost}:ucp:store` : undefined) }).filter(([, v]) => v !== undefined && v !== null && v !== ''));

// The steps after finding, each as a ready request. Services come from residents that declared them; the first resident
// that offered a step stands first until traces say otherwise. Every agent can offer a step: POST /enter with serves.
export function stepsFor(pick, services = [], base = '') {
  if (!pick) return undefined;
  const by = (cap) => services.filter((s) => (s.serves || []).includes(cap)).slice(0, 3);
  const call = (s, cap, input) => (s.calls?.[cap] ? { by: s.name, agent: s.agent, ...fill(s.calls[cap], input), terms: s.terms } : null);
  const fill = (t, input) => JSON.parse(JSON.stringify(t).replace(/"\{\{(\w+)\}\}"/g, (_, k) => JSON.stringify(input[k] ?? null)).replace(/\{\{(\w+)\}\}/g, (_, k) => String(input[k] ?? '')));
  const read = pick.url ? by('read').map((s) => call(s, 'read', { url: pick.url })).filter(Boolean) : [];
  // the store's own product page is what a verifier can read; checkout links of large shop platforms answer bots with 403
  const verify = (pick.url || pick.checkout) ? by('verify').map((s) => call(s, 'verify', { url: pick.url || pick.checkout })).filter(Boolean) : [];
  const guard = by('guard').map((s) => call(s, 'guard', { url: pick.checkout || pick.url, amount_usd: pick.currency === 'USD' ? pick.price : null })).filter(Boolean);
  return {
    read: read.length ? { why: 'the product page as clean data (price, stock, shipping, returns) without what people cannot see', services: read } : undefined,
    verify: verify.length ? { why: 'one look at the store before money moves: domain, TLS, look-alikes, payment provider, text aimed at agents', services: verify } : undefined,
    guard: guard.length ? { why: 'your user\'s spending rules before paying: caps, budgets, allow and block lists', services: guard, ...(pick.currency !== 'USD' ? { note: `amount_usd is the price in USD; the pick is priced in ${pick.currency}` } : {}) } : undefined,
    pay: { checkout: pick.checkout, store: pick.storeHost ? `https://${pick.storeHost}` : undefined, ucp: pick.storeHost ? `the store speaks UCP: call its /.well-known/ucp endpoint (search_catalog, create_cart, create_checkout) with meta["ucp-agent"].profile = "${base}/ucp/agent.json"` : undefined, note: 'paying is your user\'s decision' },
    trace: { request: { method: 'POST', url: `${base}/mark`, body: { entry: pick.entry, outcome: 'worked|partly|failed', paid: pick.price, currency: pick.currency, note: 'one line for the next agent' } }, why: 'your trace becomes the route for the next agent' },
  };
}
