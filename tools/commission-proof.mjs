// Mare Liberum · proof of the commissions (node/commission.mjs): money without anyone pressing a button, and nothing else.
// Off unless the operator sets MARE_COMMISSION, and then nothing changes; on, the shop links of the buying answers carry the
// commission and say so, a person who clicks a /via/ address goes to the shop itself, the sea never fetches a commission
// link itself, a crawler never gets one, the order and the verdict stay exactly as they are, the app door (/mcp/app) does
// not change, a link that carries someone else's tag keeps it, and "commission" in rest turns it all off again.
// Negative controls: each rule is broken in a copy of the code, and the check that guards it must fail there.
// Runs without the network: node tools/commission-proof.mjs [--against <git ref>]   (exit code 1 when a proof fails)
//   --against <ref>   also holds this tree, commissions off, to the answers of that ref byte for byte (local git only)
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0, failed = 0;
const proof = async (name, fn) => { try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 4).join('\n       ')}`); } };

// ------------------------------------------------------------------ the web, faked: a catalog, shop pages, nothing else
const BASE = 'https://mareliberum.dev', NEED = 'trail running shoes';
const ON = { domains: { 'amazon.de': { tag: 'mareliberum-21' } }, awin: { affid: '1234567', merchants: { 'beta-shoes.example': '4711' } }, wrap: { network: 'skimlinks', id: '123X456', agentsAllowed: true } };
const AMAZON_DE = 'Als Amazon-Partner verdiene ich an qualifizierten Verkäufen.';
const item = (title, cents, rating, url, checkout, seller, sellerUrl, extra = {}) => ({ title, rating: { value: rating }, ...extra, variants: [{ price: { amount: cents, currency: 'EUR' }, availability: { available: true }, url, checkout_url: checkout, seller: { name: seller, url: sellerUrl } }] });
// the stores' own order: a promoted offer (it pays through its catalog) first, then shops each rule names, then one that carries someone else's tag
const CATALOG = [
  item('Trail running shoes Delta', 11900, 4.5, 'https://delta-trail.example/products/delta', 'https://delta-trail.example/cart/9:1', 'Delta Trail', 'https://delta-trail.example', { placement: { commission: { percentage: { value: 8 } } } }),
  item('Trail running shoes Alpha', 12900, 4.7, 'https://www.amazon.de/dp/B0ALPHA', 'https://www.amazon.de/gp/aws/cart/add.html?ASIN.1=B0ALPHA', 'Amazon', 'https://www.amazon.de'),
  item('Trail running shoes Beta', 9900, 4.4, 'https://beta-shoes.example/products/beta', 'https://beta-shoes.example/cart/42:1', 'Beta Shoes', 'https://beta-shoes.example'),
  item('Trail running shoes Gamma', 8900, 4.1, 'https://gamma-run.example/products/gamma', 'https://gamma-run.example/cart/7:1', 'Gamma Run', 'https://gamma-run.example'),
  item('Trail running shoes Epsilon', 10900, 4.0, 'https://www.amazon.de/dp/B0EPS?tag=someoneelse-21', 'https://www.amazon.de/gp/aws/cart/add.html?ASIN.1=B0EPS&tag=someoneelse-21', 'Amazon', 'https://www.amazon.de'),
];
const FETCHED = [];
globalThis.fetch = async (u, o = {}) => {
  const s = String(u?.url || u);
  if (s === 'https://catalog.shopify.com/api/ucp/mcp') return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { structuredContent: { products: CATALOG } } }), { headers: { 'content-type': 'application/json' } });
  if (/^https:\/\/[a-z0-9.-]+\.(example|de)\//.test(s)) { FETCHED.push(s); return /\/robots\.txt$/.test(s) ? new Response('', { status: 404 }) : new Response('<!doctype html><html><head><title>Shop</title></head><body><p>A shoe.</p></body></html>', { headers: { 'content-type': 'text/html; charset=utf-8' } }); }
  throw new Error(`the proof does not use the network: ${s.slice(0, 80)}`);
};

// ------------------------------------------------------------------ a tree: the modules of one copy of node/, with a small sea of its own
let n = 0;
async function tree(dir) {
  const imp = (f) => import(pathToFileURL(join(dir, 'node', f)).href);
  const [core, via, flow, mem, ledger, pay, im] = await Promise.all(['core.mjs', 'via.mjs', 'flow.mjs', 'mem.mjs', 'ledger.mjs', 'pay.mjs', 'immune.mjs'].map(imp));
  const cm = await imp('commission.mjs').catch(() => null); // a ref from before the commissions has none
  const sd = mkdtempSync(join(tmpdir(), 'mare-commission-')), file = join(sd, 'sea.tsv');
  writeFileSync(file, ''); writeFileSync(join(sd, 'build.json'), JSON.stringify({ builtAt: '2026-11-20T10:00:00.000Z', entries: 0, lakes: {} }));
  const db = mem.createMem({ file, base: BASE }), cfg = { base: BASE, pay: pay.payConfig({}), ledger: ledger.createLedger({}), kv: flow.memoryKv(), site: {} };
  via.setViaKey('commission-proof-key-0123456789abcdef');
  const call = async (path, { headers = {}, method = 'GET', body } = {}) => {
    const res = await core.handle(new Request(BASE + path, { method, headers: { 'user-agent': 'proof-agent/1.0', accept: 'application/json', 'x-forwarded-for': `198.18.${20 + (n % 200)}.${(n++ % 250) + 1}`, ...(body ? { 'content-type': 'application/json' } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined }), db, cfg);
    return { status: res.status, headers: res.headers, text: await res.text() };
  };
  const rpc = async (door, name, args, headers = {}) => JSON.parse((await call(door, { method: 'POST', headers: { accept: 'application/json, text/event-stream', ...headers }, body: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } } })).text).result.structuredContent;
  const a2a = async (data) => JSON.parse((await call('/a2a', { method: 'POST', body: { jsonrpc: '2.0', id: 1, method: 'message/send', params: { message: { role: 'user', messageId: 'm1', parts: [{ kind: 'data', data }] } } } })).text).result.parts;
  return { dir, core, cm, via, kv: cfg.kv, im: im.immune, call, rpc, a2a, set: (c) => cm?.setCommission(c == null ? null : JSON.stringify(c)), rest: (r) => im.immune.set({ mode: 'normal', rest: r ? ['commission'] : [] }) };
}
const T = await tree(ROOT);
// a copy of node/ (its own module instances): with the repository's config/commission.json ('shipped'), none ('missing'), or
// one written for it; MARE_COMMISSION set while it loads; one place in one file broken (the negative controls)
const COPIES = [];
async function copyOf({ config = 'shipped', env, mutate, from = ROOT } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'mare-commission-copy-')); COPIES.push(dir);
  cpSync(join(from, 'node'), join(dir, 'node'), { recursive: true });
  for (const d of ['proof', 'public', 'site']) symlinkSync(join(ROOT, d), join(dir, d));
  if (config === 'shipped') symlinkSync(join(ROOT, 'config'), join(dir, 'config'));
  else if (config && typeof config === 'object') { mkdirSync(join(dir, 'config')); writeFileSync(join(dir, 'config', 'commission.json'), JSON.stringify(config)); }
  if (mutate) { const [file, from, to] = mutate, f = join(dir, 'node', file), src = readFileSync(f, 'utf8'); assert.equal(src.split(from).length, 2, `the place to break is found once in ${file}`); writeFileSync(f, src.replace(from, to)); }
  if (env !== undefined) process.env.MARE_COMMISSION = env;
  try { return await tree(dir); } finally { delete process.env.MARE_COMMISSION; }
}
// the answers a node gives as it was loaded (nothing set by the proof): the seven the --against run compares
async function asLoaded(t) {
  const out = {}; t.rest(false);
  out.decide = still(await decideHttp(t)); out.ask = still(JSON.parse((await t.call(`/ask?need=${encodeURIComponent(NEED)}&kind=merchant`)).text));
  out.mcp = still(await t.rpc('/mcp', 'decide', { need: NEED })); out.app = still(await t.rpc('/mcp/app', 'decide', { need: NEED }));
  out.a2a = still(await t.a2a({ skill: 'decide', need: NEED })); out.buy = (await t.call('/buy/trail-running-shoes', { headers: PERSON })).text.replace(/\/ask\/[a-z0-9]{10}/g, '');
  const w = await t.call(viaOf(t, 'https://www.amazon.de/dp/B0ALPHA'), { headers: PERSON }); out.via = [w.status, w.text, [...w.headers].filter(([k]) => k !== 'date')];
  return out;
}

// ------------------------------------------------------------------ helpers
const CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const PERSON = { 'user-agent': CHROME, accept: 'text/html,application/xhtml+xml,*/*;q=0.8', 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document', 'sec-fetch-site': 'cross-site', 'sec-fetch-user': '?1' };
const GOOGLE = { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', accept: 'text/html' };
const CLAUDEBOT = { 'user-agent': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)' };
const TAGGED = /mareliberum-21|awin1\.com|skimresources\.com|viglink\.com/;
// a commission link back to the shop's own address (the three kinds this proof configures)
const untag = (s) => {
  if (typeof s !== 'string') return s;
  let u; try { u = new URL(s); } catch { return s; }
  if (u.hostname === 'www.awin1.com') return u.searchParams.get('ued');
  if (u.hostname === 'go.skimresources.com') return u.searchParams.get('url');
  if (u.searchParams.get('tag') === 'mareliberum-21') { const p = [...u.searchParams].filter(([k, v]) => !(k === 'tag' && v === 'mareliberum-21')); u.search = new URLSearchParams(p).toString(); return u.href; }
  return s;
};
const plain = (v) => (Array.isArray(v) ? v.map(plain) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([k]) => k !== 'commission_rule' && !(k === 'commission' && v[k] === true) && k !== 'commission_network' && k !== 'commission_disclosure').map(([k, x]) => [k, plain(x)])) : untag(v));
// an answer without what differs on every call: the id of the call, the clock, and what the sea remembers of the calls
// before it (that list grows with every call of this proof)
const still = (v) => { const o = JSON.parse(JSON.stringify(v).replace(/"id":"[a-z0-9]{10}"/g, '"id":"…"').replace(/\/ask\/[a-z0-9]{10}/g, '/ask/…').replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, '…')); if (o && typeof o === 'object' && !Array.isArray(o)) delete o.before; return o; };
const titles = (l) => (l || []).map((p) => p.title);
const links = (v, out = []) => { if (Array.isArray(v)) v.forEach((x) => links(x, out)); else if (v && typeof v === 'object') { for (const [k, x] of Object.entries(v)) { if (typeof x === 'string' && /^https?:\/\//.test(x)) out.push([k, x, v]); else links(x, out); } } return out; };
const sha = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
// where two answers part: the first few paths that differ (for the message of a failed proof)
const parts = (a, b, at = '', out = []) => { if (out.length > 4) return out; if (a && b && typeof a === 'object' && typeof b === 'object') { for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) parts(a[k], b[k], `${at}.${k}`, out); } else if (JSON.stringify(a) !== JSON.stringify(b)) out.push(`${at}: ${JSON.stringify(a)?.slice(0, 160)} ≠ ${JSON.stringify(b)?.slice(0, 160)}`); return out; };
const decideHttp = async (t, h = {}) => JSON.parse((await t.call(`/decide?need=${encodeURIComponent(NEED)}`, { headers: h })).text);
const viaOf = (t, url) => t.via.viaUrl(url, { base: BASE }).slice(BASE.length);
// a via address the sea handed out as a commission link (said so where it stood): only such an address may carry one
const viaM = (t, url) => t.via.viaUrl(url, { base: BASE, m: true }).slice(BASE.length);
const reEsc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// a commission link, wherever it stands: a tagged or wrapped address, or a via address handed out as one (m=1)
const isCommissionLink = (u) => TAGGED.test(u) && !/someoneelse/.test(u) || /\/via\/[A-Za-z0-9_-]+\?(?:[^"]*&)?m=1(?:&|$)/.test(u);

// ------------------------------------------------------------------ the checks (each throws when its rule is broken; the negative controls break them)
const checks = {
  // off: nothing configured, nothing changes
  async offIsOff(t) {
    t.set(null); t.rest(false);
    assert.equal(t.cm.commissionState().configured, false); assert.equal(t.cm.commissionFor('https://www.amazon.de/dp/B0ALPHA'), null);
    const x = { decision: { pick: { title: 'a', url: 'https://www.amazon.de/dp/X', checkout: 'https://www.amazon.de/c', price: 1 } } }; assert.equal(t.cm.withCommission(x), x, 'the same object comes back');
    const d = await decideHttp(t); assert.ok(d.decision?.pick, 'a pick'); assert.ok(!TAGGED.test(JSON.stringify(d)) && !/commission_rule|"commission":true/.test(JSON.stringify(d)));
  },
  // on: every rule kind adds what it should, once; precedence domains > awin > wrap; nothing the sea must not touch
  async rules(t) {
    t.set(ON); t.rest(false);
    const f = t.cm.commissionFor;
    assert.deepEqual(f('https://www.amazon.de/dp/B0ALPHA'), { url: 'https://www.amazon.de/dp/B0ALPHA?tag=mareliberum-21', commission: true, network: 'amazon.de', direct: true, disclosure: AMAZON_DE });
    assert.equal(f('https://smile.amazon.de/dp/B0ALPHA?th=1').url, 'https://smile.amazon.de/dp/B0ALPHA?th=1&tag=mareliberum-21', 'a subdomain of a named shop');
    assert.deepEqual(f('https://beta-shoes.example/cart/42:1'), { url: `https://www.awin1.com/cread.php?awinmid=4711&awinaffid=1234567&ued=${encodeURIComponent('https://beta-shoes.example/cart/42:1')}`, commission: true, network: 'awin', direct: false });
    assert.deepEqual(f('https://gamma-run.example/products/gamma'), { url: `https://go.skimresources.com/?id=123X456&url=${encodeURIComponent('https://gamma-run.example/products/gamma')}`, commission: true, network: 'skimlinks', direct: false });
    t.set({ wrap: { network: 'sovrn', key: 'k3y', agentsAllowed: true } }); assert.equal(f('https://gamma-run.example/p').url, `https://redirect.viglink.com?key=k3y&u=${encodeURIComponent('https://gamma-run.example/p')}`);
    assert.equal(f('https://www.amazon.de/dp/B0ALPHA'), null, 'no wrapper touches an Amazon address');
    const no = t.set({ wrap: { network: 'skimlinks', id: '123X456' } }); assert.equal(no.configured, false); assert.match(no.skipped.join(' '), /agentsAllowed/, 'a wrapper needs the network\'s consent to agent traffic');
    assert.equal(t.set({ domains: { 'amazon.com': { tag: 'x-20', direct: false } } }).direct[0], 'amazon.com', 'Amazon is direct whatever the file says'); assert.equal(f('https://www.amazon.com/dp/X').disclosure, 'As an Amazon Associate I earn from qualifying purchases.');
    t.set({ awin: { affid: '1', merchants: { 'beta-shoes.example': '2' }, direct: true } }); assert.equal(f('https://beta-shoes.example/p').direct, true, 'any part may be direct'); t.set(ON);
    for (const u of ['https://mareliberum.dev/brain', 'https://buy.stripe.com/x', 'https://www.paypal.com/checkoutnow', 'https://go.skimresources.com/?id=9&url=x', 'https://www.awin1.com/cread.php?awinmid=1', 'http://user:pw@shop.example/', 'https://shop.example:8443/', 'ftp://shop.example/', 'javascript:alert(1)', '', null]) assert.equal(f(u), null, String(u));
  },
  // someone else's tag stays: the sea takes nobody's commission
  async noHijack(t) {
    t.set(ON); t.rest(false);
    assert.equal(t.cm.commissionFor('https://www.amazon.de/dp/B0EPS?tag=someoneelse-21'), null);
    const d = await decideHttp(t), eps = [...(d.top || []), ...(d.decision.alternatives || [])].find((p) => /Epsilon/.test(p.title));
    assert.ok(eps, 'Epsilon is offered'); assert.equal(eps.url, 'https://www.amazon.de/dp/B0EPS?tag=someoneelse-21'); assert.equal(eps.commission, undefined);
  },
  // an operator's configuration is checked: what does not hold is left out, no id is ever shown
  async config(t) {
    const s = t.set({ domains: { 'amazon.de': { tag: 'ok-21' }, 'mareliberum.dev': { tag: 'x' }, 'bad host': { tag: 'x' }, 'shop.example': { tag: 'a b' } }, awin: { affid: 'abc', merchants: { 'x.example': '1' } }, wrap: { network: 'evil', id: 'x' } });
    assert.deepEqual(s.domains, ['amazon.de']); assert.equal(s.awin.length, 0); assert.equal(s.wrap, null); assert.equal(s.skipped.length, 5);
    assert.ok(!JSON.stringify(t.set(ON)).includes('mareliberum-21') && !JSON.stringify(t.cm.commissionState()).includes('123X456'), 'the state names shops and networks, never an id');
    assert.equal(t.set('{not json').configured, false); t.set(ON);
    assert.equal(t.cm.COMMISSION_RULE, 'Some links may earn the sea a commission from the shop; it never changes the order or the verdict.');
  },
  // on: the buying answer over HTTP, MCP and A2A carries the commission on its shop links and says so on each
  async disclosed(t) {
    t.set(ON); t.rest(false);
    const answers = [await decideHttp(t), JSON.parse((await t.call(`/ask?need=${encodeURIComponent(NEED)}&kind=merchant`)).text), await t.rpc('/mcp', 'decide', { need: NEED })];
    for (const d of answers) {
      const tagged = links(d).filter(([, u]) => TAGGED.test(u) && !/someoneelse/.test(u)); assert.ok(tagged.length >= 3, `${tagged.length} commission links`);
      for (const [, u, o] of tagged) { assert.equal(o.commission, true, u); assert.ok(['amazon.de', 'awin', 'skimlinks'].includes(o.commission_network), u); }
      assert.equal(d.commission_rule, t.cm.COMMISSION_RULE);
      for (const [, u, o] of tagged) if (/amazon\.de/.test(u)) assert.equal(o.commission_disclosure, AMAZON_DE, 'Amazon\'s sentence stands beside its link');
      for (const [, , o] of links(d)) if (o.commission === true) assert.ok(links(o).some(([, u]) => TAGGED.test(u)) || TAGGED.test(JSON.stringify(o)), 'nothing marked that carries no commission');
    }
    const parts = await t.a2a({ skill: 'decide', need: NEED }), text = parts.find((p) => p.kind === 'text').text, data = parts.find((p) => p.kind === 'data').data;
    assert.equal(data.commission_rule, t.cm.COMMISSION_RULE); assert.ok(text.includes(t.cm.COMMISSION_RULE), 'the words of A2A say the rule');
    if (data.decision.pick.commission === true) assert.ok(text.includes('(a commission link') && (!data.decision.pick.commission_disclosure || text.includes(data.decision.pick.commission_disclosure)), text);
    const promoted = links(answers[1]).find(([, u]) => /delta-trail/.test(u)); assert.ok(promoted && !TAGGED.test(promoted[1]) && promoted[2].promoted === true && promoted[2].commission === 8, 'an offer that pays through its catalog keeps what it says');
  },
  // on and off give the same order, the same pick, the same reasons and scores: only the links and their marks differ
  async sameOrder(t) {
    t.set(null); t.rest(false); const off = [still(await decideHttp(t)), still(JSON.parse((await t.call(`/ask?need=${encodeURIComponent(NEED)}&kind=merchant`)).text)), still(await t.rpc('/mcp', 'decide', { need: NEED }))];
    t.set(ON); const on = [still(await decideHttp(t)), still(JSON.parse((await t.call(`/ask?need=${encodeURIComponent(NEED)}&kind=merchant`)).text)), still(await t.rpc('/mcp', 'decide', { need: NEED }))];
    for (let i = 0; i < off.length; i++) {
      assert.ok(TAGGED.test(JSON.stringify(on[i])), 'the commission is on');
      assert.deepEqual(titles(on[i].top || on[i].products), titles(off[i].top || off[i].products), 'the order of the offers');
      for (const k of ['pick', 'cheapest', 'bestRated']) assert.equal(on[i].decision?.[k]?.title, off[i].decision?.[k]?.title, k);
      for (const k of ['why', 'score', 'parts', 'rule', 'confidence', 'considered', 'fitting']) assert.deepEqual(on[i].decision?.[k], off[i].decision?.[k], k);
      assert.deepEqual(titles(on[i].decision?.alternatives), titles(off[i].decision?.alternatives), 'alternatives');
      assert.deepEqual(plain(on[i]), off[i], `without its links and marks, the answer is the same answer: ${parts(plain(on[i]), off[i]).join(' | ')}`);
    }
    // on, but no rule fits: the same answer, byte for byte
    t.set({ domains: { 'nowhere.example': { tag: 'x' } } }); assert.equal(JSON.stringify(still(await decideHttp(t))), JSON.stringify(off[0]));
    t.set(ON);
  },
  // the app door never changes: its tools, its first answer, and its buying answer with commissions on
  async appDoor(t) {
    t.set(null); t.rest(false); const off = still(await t.rpc('/mcp/app', 'decide', { need: NEED }));
    t.set(ON); const on = still(await t.rpc('/mcp/app', 'decide', { need: NEED }));
    assert.equal(JSON.stringify(on), JSON.stringify(off)); assert.ok(!TAGGED.test(JSON.stringify(on)) && !/commission_rule/.test(JSON.stringify(on)));
    const raw = async (method, params) => JSON.parse((await t.call('/mcp/app', { method: 'POST', headers: { accept: 'application/json, text/event-stream', 'user-agent': 'mare-proof/1.0' }, body: { jsonrpc: '2.0', id: 1, method, params } })).text);
    const l = await raw('tools/list'), i = await raw('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'mare-proof', version: '1' } }); delete i.result.serverInfo.version;
    assert.equal(sha(l.result), 'daa60266448605a5af0d0d11d2c5685952f2b0c36fd36c0a76678836cc8229b0'); assert.equal(sha(i.result), '16217dddbea543a5c9b20d61bcb44b7d748a282d1b27a4077c748e922b823666');
  },
  // a crawler never gets a commission link: not over the open MCP door, not from /via/
  async crawlers(t) {
    t.set(ON); t.rest(false);
    const d = await t.rpc('/mcp', 'decide', { need: NEED }, CLAUDEBOT); assert.ok(d.decision?.pick, 'answered as an agent is'); assert.ok(!TAGGED.test(JSON.stringify(d)) && !d.commission_rule);
    for (const u of ['https://beta-shoes.example/products/beta', 'https://www.amazon.de/dp/B0ALPHA']) { const r = await t.call(viaM(t, u), { headers: GOOGLE }); assert.equal(r.status, 302); assert.equal(r.headers.get('location'), u); }
  },
  // /via/: a person who clicked goes to the shop with the commission; an agent gets the page the sea fetched from the shop's
  // own address (the sea never opens a commission link); a prefetch and a driven browser are no person
  async viaWalks(t) {
    t.set(ON); t.rest(false); const target = 'https://beta-shoes.example/products/beta', path = viaM(t, target);
    const plainWalk = await t.call(viaOf(t, target), { headers: PERSON }); assert.equal(plainWalk.status, 302); assert.equal(plainWalk.headers.get('location'), target, 'an address not handed out as a commission link carries none'); assert.equal(plainWalk.headers.get('x-via-commission'), null);
    const p = await t.call(path, { headers: PERSON }); assert.equal(p.status, 302); assert.equal(p.headers.get('location'), `https://www.awin1.com/cread.php?awinmid=4711&awinaffid=1234567&ued=${encodeURIComponent(target)}`); assert.equal(p.headers.get('x-via-commission'), 'awin');
    const am = await t.call(viaM(t, 'https://www.amazon.de/dp/B0ALPHA'), { headers: PERSON }); assert.equal(am.status, 302); assert.equal(am.headers.get('location'), 'https://www.amazon.de/dp/B0ALPHA', 'Amazon: the person goes to the shop, without a tag'); assert.equal(am.headers.get('x-via-commission'), null);
    const q = await t.call(viaOf(t, 'https://plain-shop.example/item')); assert.equal(q.status, 200);
    const g = await t.call(viaM(t, 'https://gamma-run.example/products/gamma'), { headers: PERSON }); assert.equal(g.status, 302); assert.match(g.headers.get('location'), /^https:\/\/go\.skimresources\.com\/\?id=123X456&url=/);
    FETCHED.length = 0;
    const a = await t.call(path); assert.equal(a.status, 200); assert.equal(a.headers.get('x-via-target'), target);
    const pre = await t.call(path, { headers: { ...PERSON, 'sec-purpose': 'prefetch' } }); assert.equal(pre.status, 200, 'a prefetch is carried, not sent on');
    const hl = await t.call(path, { headers: { ...PERSON, 'user-agent': CHROME.replace('Chrome/', 'HeadlessChrome/') } }); assert.equal(hl.status, 200, 'a driven browser is carried');
    assert.ok(FETCHED.includes(target), 'the sea fetched the shop\'s own address'); assert.ok(!FETCHED.some((u) => TAGGED.test(u)), `the sea never opens a commission link: ${FETCHED.filter((u) => TAGGED.test(u))}`);
  },
  // off: a person gets what a person got before (the carried page), and the sea fetches the plain address
  async viaOff(t) {
    t.set(null); t.rest(false); FETCHED.length = 0;
    const r = await t.call(viaOf(t, 'https://www.amazon.de/dp/B0ALPHA'), { headers: PERSON }); assert.equal(r.status, 200); assert.equal(r.headers.get('content-security-policy'), 'sandbox'); assert.equal(r.headers.get('x-via-commission'), null);
    assert.deepEqual(FETCHED.filter((u) => !/robots\.txt$/.test(u)), ['https://www.amazon.de/dp/B0ALPHA']);
  },
  // the page for people: commission links lead through /via/ (a crawler never meets one), say rel="sponsored" and carry the marker; the page says the rule
  async page(t) {
    t.set(ON); t.rest(false);
    const h = (await t.call('/buy/trail-running-shoes', { headers: PERSON })).text;
    assert.ok(!/awin1\.com|skimresources\.com|viglink\.com/.test(h), 'no wrapped link stands in the page: those go through /via/');
    const as = [...h.matchAll(/<a ([^>]*)>/g)].map((m) => m[1]), viaLinks = as.filter((a) => /href="https:\/\/mareliberum\.dev\/via\/[^"]*[?&]m=1"/.test(a)), direct = as.filter((a) => /href="https:\/\/www\.amazon\.de\/[^"]*tag=mareliberum-21"/.test(a));
    assert.ok(viaLinks.length >= 4, `${viaLinks.length} commission links through /via/`); assert.ok(direct.length >= 2, `${direct.length} direct Amazon links`);
    for (const a of [...viaLinks, ...direct]) assert.match(a, /rel="sponsored nofollow noopener"/);
    assert.equal(h.split(t.cm.COMMISSION_MARK).length - 1, viaLinks.length + direct.length, 'each commission link carries the marker');
    assert.equal((h.match(new RegExp(`tag=mareliberum-21" rel="sponsored nofollow noopener">[^<]*</a> ${reEsc(t.cm.COMMISSION_MARK)} <small class="cm-note">${AMAZON_DE}</small>`, 'g')) || []).length, direct.length, 'Amazon\'s sentence beside each Amazon link');
    assert.ok(h.includes(t.cm.COMMISSION_RULE) && !h.includes('Mare Liberum takes no cut'), 'the page says the rule');
    assert.ok(h.includes('href="https://delta-trail.example/products/delta" rel="nofollow noopener"') && h.includes('href="https://www.amazon.de/dp/B0EPS?tag=someoneelse-21"'), 'the others link the shop as before');
    const ld = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]).join(''); assert.ok(ld.includes('https://www.amazon.de/dp/B0ALPHA"') && !/\/via\//.test(ld), 'structured data names the shop itself');
    t.set(null); const o = (await t.call('/buy/trail-running-shoes', { headers: PERSON })).text; assert.ok(!/\/via\/|sponsored|class="cm"/.test(o) && o.includes('Mare Liberum takes no cut'), 'off: the page as before'); t.set(ON);
  },
  // the operator rests it without a release: "commission" in rest, and everything is as if nothing were set
  async rests(t) {
    t.set(ON); t.rest(true);
    try {
      assert.equal(t.cm.commissionOn(), false); assert.equal(t.cm.commissionState().resting, true);
      const d = await decideHttp(t); assert.ok(!TAGGED.test(JSON.stringify(d)) && !d.commission_rule);
      const r = await t.call(viaM(t, 'https://beta-shoes.example/products/beta'), { headers: PERSON }); assert.equal(r.status, 200, 'a person gets the carried page again');
      const h = (await t.call('/buy/trail-running-shoes', { headers: PERSON })).text; assert.ok(!/sponsored|class="cm"/.test(h));
    } finally { t.rest(false); }
  },
  // the ids come from config/commission.json (a pull request) or MARE_COMMISSION, which wins; an empty or missing file is off
  async configFile(t) {
    // copies of the code under test (t.dir): with the repository's file, without one, with ids, with the environment set
    const shipped = JSON.parse(readFileSync(join(ROOT, 'config', 'commission.json'), 'utf8')), from = t.dir;
    const S = await copyOf({ from, config: 'shipped' }), M = await copyOf({ from, config: 'missing' });
    for (const [t, what] of [[S, 'the shipped (empty) file'], [M, 'no file']]) { const st = t.cm.commissionState(); assert.equal(st.configured, false, what); assert.equal(st.source, null, what); assert.deepEqual(st.skipped, [], `${what}: nothing to say`); }
    const a = await asLoaded(S), b = await asLoaded(M);
    for (const k of Object.keys(a)) assert.equal(JSON.stringify(a[k]), JSON.stringify(b[k]), `${k}: the empty file and no file answer the same`);
    assert.ok(!TAGGED.test(JSON.stringify(a)) && !/commission_rule|"commission":true|sponsored|class="cm"/.test(JSON.stringify(a)), 'and carry no commission');
    t.set(null); t.rest(false); const c = await asLoaded(t);
    for (const k of Object.keys(a)) assert.equal(JSON.stringify(a[k]), JSON.stringify(c[k]), `${k}: as this tree with nothing set`);
    const F = await copyOf({ from, config: { ...shipped, ...ON } }); assert.equal(F.cm.commissionState().source, 'config/commission.json'); assert.equal(F.cm.commissionFor('https://www.amazon.de/dp/B0ALPHA').url, 'https://www.amazon.de/dp/B0ALPHA?tag=mareliberum-21', 'the ids of the file are used');
    const E = await copyOf({ from, config: ON, env: JSON.stringify({ wrap: { network: 'sovrn', key: 'envkey', agentsAllowed: true } }) }); assert.equal(E.cm.commissionState().source, 'MARE_COMMISSION');
    assert.match(E.cm.commissionFor('https://gamma-run.example/products/gamma').url, /^https:\/\/redirect\.viglink\.com\?key=envkey&u=/, 'the environment wins over the file');
    assert.equal(E.cm.commissionFor('https://www.amazon.de/dp/B0ALPHA'), null, 'and only the environment: the file\'s Amazon tag is not used');
    const B = await copyOf({ from, config: ON, env: '   ' }); assert.equal(B.cm.commissionState().source, 'config/commission.json', 'an empty environment value leaves the file');
  },
  // what the sea keeps is the shop's own address: a pathway laid with a commission link of this node, through any door, keeps
  // the clean address (one path, not two); a rating changes none; someone else's tag stays as it was laid
  async cleanStore(t) {
    t.set(ON); t.rest(false);
    const clean = 'https://www.amazon.de/dp/B0ALPHA', task = 'trail running shoes for wet ground';
    const first = await t.rpc('/mcp', 'lay_path', { q: task, to: clean, note: 'good grip' }), id = first.path.id;
    for (const to of [t.cm.commissionFor(clean).url, t.cm.commissionFor('https://www.amazon.de/dp/B0ALPHA').url]) {
      const r = await t.rpc('/mcp', 'lay_path', { q: task, to }); assert.equal(r.path.id, id, 'the same path, not a second one'); assert.equal(r.fresh, false); assert.equal(r.path.to, clean);
    }
    for (const u of ['https://beta-shoes.example/cart/42:1', 'https://gamma-run.example/products/gamma']) {
      const r = await t.rpc('/mcp', 'lay_path', { q: `${task} ${u.includes('beta') ? 'beta' : 'gamma'}`, to: t.cm.commissionFor(u).url }); assert.equal(r.path.to, u, `a wrapper of ours is kept as the shop's address: ${r.path.to}`);
      assert.equal((await t.kv.get(`brain:p:${r.path.id}`)).to, u);
    }
    const lay = JSON.parse((await t.call(`/lay?${new URLSearchParams({ q: `${task} http`, to: t.cm.commissionFor(clean).url })}`, { headers: { accept: 'application/json' } })).text); assert.equal(lay.path?.to, clean, `HTTP /lay: ${JSON.stringify(lay).slice(0, 200)}`);
    await t.rpc('/mcp', 'rate_path', { path: id, worked: true, note: 'it worked' }); assert.equal((await t.kv.get(`brain:p:${id}`)).to, clean, 'a rating keeps the address');
    const other = await t.rpc('/mcp', 'lay_path', { q: `${task} other`, to: 'https://www.amazon.de/dp/B0EPS?tag=someoneelse-21' }); assert.equal(other.path.to, 'https://www.amazon.de/dp/B0EPS?tag=someoneelse-21', 'someone else\'s tag stays as laid');
    const th = await t.rpc('/mcp', 'think', { q: task }); assert.ok((th.paths || []).length && th.paths.every((p) => !TAGGED.test(p.to)), 'the brain hands its paths out clean');
    for (const u of [clean, 'https://smile.amazon.de/dp/X?th=1', 'https://www.amazon.de/s?k=a+b&x=%7E#top', 'https://beta-shoes.example/cart/42:1', 'https://gamma-run.example/p?x=1']) assert.equal(t.cm.uncommission(t.cm.commissionFor(u).url), u, `round trip ${u}`);
    for (const u of ['https://www.amazon.de/dp/B0EPS?tag=someoneelse-21', 'https://go.skimresources.com/?id=OTHER&url=https%3A%2F%2Fx.example%2F', 'https://www.awin1.com/cread.php?awinmid=1&awinaffid=999&ued=https%3A%2F%2Fx.example%2F', 'not a url', null]) assert.equal(t.cm.uncommission(u), u, `not ours: ${u}`);
    t.rest(true); try { assert.equal(t.cm.uncommission(t.cm.commissionFor === null ? '' : `${clean}?tag=mareliberum-21`), clean, 'resting, the sea still knows its own tag'); } finally { t.rest(false); }
  },
  // Amazon: whatever the configuration says, an Amazon address never rides a /via/ redirect with a tag (Vergütungskatalog
  // Ziff. 2(e)) and no wrapper touches it; it is handed out only as the direct, visible link with Amazon's sentence beside it
  async amazonNeverVia(t) {
    t.rest(false);
    const AMZ = ['https://www.amazon.de/dp/B0ALPHA', 'https://smile.amazon.de/dp/B0ALPHA?th=1', 'https://www.amazon.com/dp/B0US', 'https://www.amazon.co.uk/dp/B0UK'];
    const configs = [{ domains: { 'amazon.de': { tag: 'mareliberum-21' }, 'amazon.com': { tag: 'mare-20' } } }, { domains: { 'amazon.de': { tag: 'mareliberum-21', direct: false } } },
      { domains: { 'amazon.de': { tag: 'mareliberum-21' } }, wrap: { network: 'skimlinks', id: '123X456', agentsAllowed: true } }, { wrap: { network: 'sovrn', key: 'k3y', agentsAllowed: true, direct: false } }, ON];
    for (const c of configs) {
      t.set(c);
      for (const u of AMZ) {
        assert.equal(t.cm.viaCommissionFor(u), null, `${u} rides no via address with a commission (${JSON.stringify(c).slice(0, 60)})`);
        for (const path of [viaM(t, u), viaOf(t, u)]) { const r = await t.call(path, { headers: PERSON }); assert.equal(r.status, 302); assert.equal(r.headers.get('location'), u, `${u}: the person goes to Amazon as it is`); assert.equal(r.headers.get('x-via-commission'), null); }
        const d = t.cm.commissionFor(u); if (d) { assert.equal(d.direct, true); assert.ok(d.disclosure, 'with Amazon\'s sentence'); assert.match(d.url, /^https:\/\/[a-z.]*amazon\.[a-z.]+\//, 'never a wrapper'); }
      }
    }
    t.set(ON); const h = (await t.call('/buy/trail-running-shoes', { headers: PERSON })).text;
    for (const m of h.matchAll(/<a [^>]*href="(https:\/\/mareliberum\.dev\/via\/[^"]+)"/g)) { const tok = new URL(m[1].replace(/&amp;/g, '&')).pathname.slice(5); assert.doesNotMatch(t.via.decodeVia(tok)?.url || '', /amazon\./, 'no Amazon address through /via/ on the page'); }
  },
  // wherever a commission link can stand, it says so: on every page a person opens (the words beside the link), in every JSON
  // answer (commission: true on its object), in the Markdown an assistant reads (the same words)
  async markedEverywhere(t) {
    t.set(ON); t.rest(false);
    await t.rpc('/mcp', 'lay_path', { q: 'trail running shoes for mud', to: 'https://beta-shoes.example/products/beta', note: 'good in mud' });
    const pages = ['/buy/trail-running-shoes', '/brain?q=trail+running+shoes+for+mud', '/brain/trail-running-shoes-for-mud', '/', '/brain', '/brain/market', '/buy', '/current', '/works', '/sites', '/routes'];
    let seen = 0;
    for (const p of pages) {
      const h = (await t.call(p, { headers: PERSON })).text;
      for (const m of h.matchAll(/<a [^>]*href="([^"]+)"[^>]*>[\s\S]*?<\/a>/g)) { const href = m[1].replace(/&amp;/g, '&'); if (!isCommissionLink(href)) continue; seen++; assert.ok(h.slice(m.index + m[0].length).startsWith(` ${t.cm.COMMISSION_MARK}`), `${p}: the words stand beside ${href.slice(0, 80)}`); }
    }
    assert.ok(seen >= 6, `${seen} commission links on pages`);
    const md = (await t.call('/buy/trail-running-shoes', { headers: { ...PERSON, accept: 'text/markdown' } })).text;
    const mdLinks = [...md.matchAll(/\]\(([^)\s]+)\)/g)].filter((m) => isCommissionLink(m[1]));
    assert.ok(mdLinks.length >= 4, `${mdLinks.length} commission links in the Markdown`);
    for (const m of mdLinks) assert.ok(md.slice(m.index + m[0].length, m.index + m[0].length + t.cm.COMMISSION_WORDS.length + 4).includes(t.cm.COMMISSION_WORDS), `Markdown: the words beside ${m[1].slice(0, 60)}`);
    const answers = [await decideHttp(t), JSON.parse((await t.call(`/ask?need=${encodeURIComponent(NEED)}&kind=merchant`)).text), await t.rpc('/mcp', 'decide', { need: NEED }), (await t.a2a({ skill: 'decide', need: NEED })).find((x) => x.kind === 'data').data,
      JSON.parse((await t.call('/brain?q=trail+running+shoes+for+mud', { headers: { accept: 'application/json' } })).text)];
    let js = 0;
    const walk = (v) => { if (Array.isArray(v)) return v.forEach(walk); if (!v || typeof v !== 'object') return; for (const x of Object.values(v)) { if (typeof x === 'string' && isCommissionLink(x)) { js++; assert.equal(v.commission, true, `JSON: commission: true beside ${x.slice(0, 80)}`); } else walk(x); } };
    answers.forEach(walk); assert.ok(js >= 8, `${js} commission links in JSON`);
    assert.ok(links(answers[4]).some(([, u]) => /\/via\/[^?]+\?(?:.*&)?m=1/.test(u)), 'the brain hands out its commission link as one');
  },
  // the via addresses of other answers say so where their place pays one (the answer gets the rule once)
  async viaMarks(t) {
    t.set(ON); t.rest(false);
    const out = t.via.rewriteForAgents({ paths: [{ name: 'a', to: 'https://beta-shoes.example/products/beta' }, { name: 'b', to: 'https://mareliberum.dev/brain' }, { name: 'c', to: 'https://www.amazon.de/dp/B0ALPHA' }] }, { base: BASE, cm: t.cm.viaCommissionFor, rule: t.cm.COMMISSION_RULE });
    assert.equal(out.paths[0].commission, true); assert.equal(out.paths[0].commission_network, 'awin'); assert.match(out.paths[0].to, /^https:\/\/mareliberum\.dev\/via\/[^?]+\?m=1$/, 'the address stays the via address, handed out as a commission link');
    assert.doesNotMatch(out.paths[2].to, /m=1/, 'the Amazon via address is no commission link');
    assert.equal(out.paths[1].commission, undefined); assert.equal(out.paths[2].commission, undefined, 'an Amazon via address carries no commission'); assert.equal(out.commission_rule, t.cm.COMMISSION_RULE);
    const none = t.via.rewriteForAgents({ paths: [{ to: 'https://www.amazon.de/dp/B0ALPHA' }] }, { base: BASE }); assert.ok(!('commission' in none.paths[0]) && !('commission_rule' in none), 'without cm: as before');
  },
};

// ------------------------------------------------------------------ the proofs
console.log('off, as the node starts without MARE_COMMISSION');
await proof('nothing configured: commissionFor gives null, withCommission gives back the same object, a decision carries no commission', () => checks.offIsOff(T));
await proof('off: a person who opens a /via/ address gets the carried page, as before; the sea fetched the plain address', () => checks.viaOff(T));
console.log('the rules');
await proof('a shop\'s query tag, an Awin deep link, a Skimlinks or Sovrn wrapper; a named shop wins over the wrapper; never the sea, a payment page, a network or a strange address', () => checks.rules(T));
await proof('a link that carries someone else\'s tag keeps it, in the rule and in the answer', () => checks.noHijack(T));
await proof('the configuration is checked; what does not hold is left out; the state names shops and networks, never an id; the rule in one sentence', () => checks.config(T));
console.log('on: disclosed, the same order, nothing else changes');
await proof('HTTP /decide and /ask, MCP decide and A2A: every commission link says commission: true with its network, the answer says the rule; a catalog\'s promoted offer keeps its own', () => checks.disclosed(T));
await proof('on and off: the same offers in the same order, the same pick, reasons, scores and rule; on with no fitting rule: the same bytes', () => checks.sameOrder(T));
await proof('the app door (/mcp/app) does not change: tools/list and initialize as on main, and its decide answer is the same with commissions on', () => checks.appDoor(T));
await proof('a crawler gets no commission link: not over the open MCP door, not from /via/', () => checks.crawlers(T));
await proof('/via/: a person goes to the shop with the commission; an agent gets the shop\'s own page; prefetches and driven browsers are carried; the sea never opens a commission link', () => checks.viaWalks(T));
await proof('/buy: commission links lead through /via/, say rel="sponsored" and carry the marker; the page says the rule; structured data and other shops as before', () => checks.page(T));
await proof('"commission" in rest: everything as if nothing were set (decide, /via/, /buy)', () => checks.rests(T));
await proof('other answers: a via address to a place that pays one says so, the answer says the rule once; without cm nothing changes', () => checks.viaMarks(T));
console.log('Amazon, and the words beside every commission link');
await proof('Amazon never rides a /via/ redirect with a tag, whatever the configuration (direct: false, a wrapper, both): a person goes to Amazon as it is, the page links Amazon directly with its sentence', () => checks.amazonNeverVia(T));
await proof('wherever a commission link stands it says so: the words beside it on every page and in the Markdown, commission: true in every JSON answer (decide, ask, MCP, A2A, the brain)', () => checks.markedEverywhere(T));
console.log('where the ids come from, and what the sea keeps');
await proof('config/commission.json: the shipped (empty) file and no file are off and answer byte for byte the same; ids in the file turn it on; MARE_COMMISSION wins over the file', () => checks.configFile(T));
await proof('pathways keep the shop\'s own address: lay_path and /lay with a tag or a wrapper of ours store the clean address (one path), a rating keeps it, someone else\'s tag stays; commission and uncommission are exact inverses', () => checks.cleanStore(T));
T.set(null);

// ------------------------------------------------------------------ negative controls: break each rule in a copy, and its check must fail there
console.log('negative controls: each rule broken in a copy of node/, the check that guards it must fail');
const MUTANTS = [
  ['the proxy fetches the commission link for an agent', 'via.mjs', "try { r = await get(target, { method, headers, body, redirect: 'manual'", "try { r = await get((commission && commission(target)?.url) || target, { method, headers, body, redirect: 'manual'", 'viaWalks'],
  ['a crawler is sent to the commission link', 'via.mjs', "if (readOnly) return new Response(null, { status: 302, headers: { location: target,", "if (readOnly) return new Response(null, { status: 302, headers: { location: (commission && commission(target)?.url) || target,", 'crawlers'],
  ['offers that pay come first', 'commission.mjs', 'const r = walk(out, 0);', 'const r = walk(out, 0); for (const k of [\'top\', \'products\']) if (Array.isArray(r?.[k])) r[k] = [...r[k]].sort((a, b) => (b.commission === true) - (a.commission === true));', 'sameOrder'],
  ['a commission link without its mark', 'commission.mjs', 'n++; copy.commission = true; copy.commission_network = net;', 'n++;', 'disclosed'],
  ['the app door gets commissions', 'core.mjs', "if (!app && !uncounted && (msg.params?.name === 'decide'", "if (!uncounted && (msg.params?.name === 'decide'", 'appDoor'],
  ['a crawler on the open MCP door gets commissions', 'core.mjs', "if (!app && !uncounted && (msg.params?.name === 'decide'", "if (!app && (msg.params?.name === 'decide'", 'crawlers'],
  ['the rest switch is ignored', 'commission.mjs', "export const commissionOn = () => configured() && !immune.atRest?.('commission');", 'export const commissionOn = () => configured();', 'rests'],
  ['someone else\'s tag is taken', 'commission.mjs', 'if (d.params.some(([k]) => u.searchParams.has(k))) return null;', '', 'noHijack'],
  ['the page hides the marker', 'needs.mjs', 'mark: ` ${cmMark}', 'mark: `', 'page'],
  ['the marker is only a sign with a tooltip', 'commission.mjs', 'export const COMMISSION_MARK = `<small class="cm">${COMMISSION_WORDS}</small>`;', 'export const COMMISSION_MARK = `<small class="cm" title="${COMMISSION_WORDS}">*</small>`;', 'markedEverywhere'],
  ['a via address carries a commission it never said', 'via.mjs', "let c = null; if (at.searchParams.get('m') === '1') { try { c = commission(target); } catch {} }", 'let c = null; try { c = commission(target); } catch {}', 'viaWalks'],
  ['Amazon rides /via/ with its tag', 'commission.mjs', 'direct: amazon || params.direct === true', 'direct: params.direct === true', 'amazonNeverVia'],
  ['a wrapper wraps Amazon', 'commission.mjs', 'if (AMAZON.test(host)) return null;', '', 'amazonNeverVia'],
  ['a wrapper without the network\'s consent', 'commission.mjs', ' && c.wrap.agentsAllowed === true', '', 'rules'],
  ['off is not off: a person is sent on without commissions', 'core.mjs', 'commission: commissionOn() ? viaCommissionFor : null,', 'commission: (u) => viaCommissionFor(u),', 'viaOff'],
  ['a pathway keeps the commission link', 'brain.mjs', 'const url = https(uncommission(to));', 'const url = https(to);', 'cleanStore'],
  ['the file is never read', 'commission.mjs', "let f = null; try { f = readFileSync(COMMISSION_FILE, 'utf8'); }", "let f = null; try { f = null; }", 'configFile'],
  ['the file wins over the environment', 'commission.mjs', "const e = String(env.MARE_COMMISSION ?? '').trim();", "let f0 = null; try { f0 = readFileSync(COMMISSION_FILE, 'utf8'); } catch {} const e = f0 && parseCommission(f0).domains.size ? '' : String(env.MARE_COMMISSION ?? '').trim();", 'configFile'],
];
for (const [what, file, from, to, check] of MUTANTS) {
  await proof(`broken: ${what} → ${check} fails`, async () => {
    const m = await copyOf({ mutate: [file, from, to] });
    let held = false;
    try { await checks[check](m); held = true; } catch { /* the check caught it */ } finally { m.set(null); m.rest(false); }
    assert.equal(held, false, `${check} still holds with the rule broken: it proves nothing`);
  });
}

// ------------------------------------------------------------------ optional: this tree, commissions off, against a ref byte for byte
const against = process.argv.indexOf('--against');
if (against > 0) {
  const ref = process.argv[against + 1] && !process.argv[against + 1].startsWith('--') ? process.argv[against + 1] : 'origin/main';
  await proof(`commissions off: this tree and ${ref} answer byte for byte the same (decide over HTTP, MCP and A2A, ask, /mcp/app, /buy, a person's /via/ walk)`, async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mare-commission-ref-'));
    try {
      execFileSync('tar', ['-x', '-C', dir], { input: execFileSync('git', ['-C', ROOT, 'archive', ref, 'node'], { maxBuffer: 512 * 2 ** 20 }) });
      for (const d of ['proof', 'public', 'site']) symlinkSync(join(ROOT, d), join(dir, d));
      const R = await tree(dir), bodies = async (t) => {
        const out = {}; t.set(null); t.rest(false);
        out.decide = still(await decideHttp(t)); out.ask = still(JSON.parse((await t.call(`/ask?need=${encodeURIComponent(NEED)}&kind=merchant`)).text));
        out.mcp = still(await t.rpc('/mcp', 'decide', { need: NEED })); out.app = still(await t.rpc('/mcp/app', 'decide', { need: NEED }));
        out.a2a = still(await t.a2a({ skill: 'decide', need: NEED })); out.buy = (await t.call('/buy/trail-running-shoes', { headers: PERSON })).text.replace(/\/ask\/[a-z0-9]{10}/g, '');
        const w = await t.call(viaOf(t, 'https://www.amazon.de/dp/B0ALPHA'), { headers: PERSON }); out.via = [w.status, w.text, [...w.headers].filter(([k]) => k !== 'date')];
        return out;
      };
      const [ours, theirs] = [await bodies(T), await bodies(R)];
      for (const k of Object.keys(ours)) assert.equal(JSON.stringify(ours[k]), JSON.stringify(theirs[k]), `${k}: this tree and ${ref} differ`);
      console.log(`       ${Object.keys(ours).length} answers compared`);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
}

for (const d of COPIES) rmSync(d, { recursive: true, force: true });
console.log(`\n${passed} held, ${failed} failed`);
process.exit(failed ? 1 : 0);
