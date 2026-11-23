// Mare Liberum · proof of the honest answers: a task keeps its subject, nonsense gets no pick, a quiet call leaves no trace,
// guests are counted apart from residents that can take a call, and an introduction or a direct question gets an answer
// of the sea that says only what the sea can count.
// Runs without the network (only this machine): node tools/honest-proof.mjs   (exit code 1 when a proof fails)
import assert from 'node:assert/strict';
import { planRoute } from '../node/route.mjs';
import { decide } from '../node/decide.mjs';
import { handle } from '../node/core.mjs';
import { createMem } from '../node/mem.mjs';
import { createFlow, memoryKv } from '../node/flow.mjs';
import { pickCalls } from '../node/instinct.mjs';

let passed = 0, failed = 0;
const proof = async (name, fn) => { try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 4).join('\n       ')}`); } };
globalThis.fetch = async (u) => { throw new Error(`the proof does not use the network: ${String(u).slice(0, 80)}`); };
const ago = (min) => new Date(Date.now() - min * 60e3).toISOString();
const junk = [{ title: 'Ejection Rotating Fidget Spinner', price: 36.99, currency: 'USD', store: 'E', storeHost: 'e.example', url: 'https://e.example/p/1', inStock: true }, { title: 'Bottle and Jar Opener', price: 1, currency: 'USD', store: 'C', storeHost: 'c.example', url: 'https://c.example/p/2', inStock: true }];
const shoes = [{ title: 'Adidas Galaxy Running Shoes', price: 48, currency: 'USD', store: 'S', storeHost: 's.example', url: 'https://s.example/p/1', inStock: true }, { title: 'Supernova Running Shoes', price: 80, currency: 'USD', store: 'T', storeHost: 't.example', url: 'https://t.example/p/2', inStock: true }];
const fresh = (shelf = {}) => { const kv = memoryKv(); return { kv, sea: createFlow({ kv, route: async () => [], entryOf: async () => null, log: () => {}, shop: null, shopAll: async (topic) => (shelf[topic] || []).map((p) => ({ ...p })), profile: 'https://sea.test/ucp/agent.json' }) }; };

console.log('a task keeps its subject');
await proof('a task about the asker\'s own server is searched with the words that name it; a task for a server is not', () => {
  const t = (q) => planRoute(q, { base: 'https://mare.test' }).terms;
  assert.equal(t('list my MCP server in directories'), 'MCP server directories');
  assert.equal(t('how do I get our agent into registries'), 'agent registries');
  assert.equal(t('find an MCP server for Postgres'), 'Postgres', 'unchanged: the shelf word goes, the subject stays');
  assert.equal(t('weather in Lyon tomorrow'), 'Lyon', 'unchanged');
});

console.log('nothing fits is an answer');
await proof('offers that name no word of the need are never the pick; they are shown as what the stores returned', () => {
  const d = decide(junk, { topic: 'zxqvplmk flurbnax gadget' });
  assert.equal(d.pick, null); assert.equal(d.unmatched, true); assert.match(d.note, /no offer names a word of the need/);
  assert.equal(d.returned.length, 2); assert.equal(d.alternatives, undefined);
});
await proof('an offer that names a word of the need wins over one that names none, and says how much it names', () => {
  const d = decide([{ title: 'Reading Glasses Blue Light', price: 68, currency: 'USD', store: 'A', inStock: true }, { title: 'Kindle Reader 6 inch', price: 99, currency: 'USD', store: 'B', inStock: true }], { topic: 'kobo reader' });
  assert.equal(d.pick.title, 'Kindle Reader 6 inch'); assert.ok(d.why.some((w) => /names only 1 of the 2 words/.test(w)));
});
await proof('a need the offers name in full is picked as before', () => {
  const d = decide(shoes, { topic: 'running shoes' });
  assert.equal(d.pick.title, 'Adidas Galaxy Running Shoes'); assert.ok(!d.why.some((w) => /names only/.test(w))); assert.equal(d.unmatched, undefined);
});
await proof('ask says it through: nonsense comes back without a pick, with the offers still listed', async () => {
  const { sea } = fresh({ 'zxqvplmk flurbnax': junk });
  const r = await sea.ask({ need: 'zxqvplmk flurbnax', kind: 'merchant' }, { ip: '203.0.113.60' });
  assert.equal(r.decision.pick, null); assert.equal(r.decision.unmatched, true); assert.equal(r.steps, undefined);
});

console.log('a quiet call');
await proof('quiet leaves no call in the flow and none to read later; the tool says so in its schema, the app door does not offer it', async () => {
  const { kv, sea } = fresh({ 'running shoes': shoes });
  const r = await sea.ask({ need: 'running shoes', kind: 'merchant', quiet: true }, { ip: '203.0.113.61' });
  assert.ok(r.decision.pick, 'the offers are still read');
  assert.equal(((await kv.get('flow:head')) || []).length, 0); assert.equal(await kv.get(`ask:${r.ask.id}`), null);
  const db = createMem({ file: 'data/none.tsv', base: 'https://mare.test' });
  const list = async (door) => (await (await handle(new Request(`https://mare.test${door}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.62', 'user-agent': 'proof/1.0' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) }), db, { site: {}, base: 'https://mare.test' })).json()).result.tools;
  assert.equal((await list('/mcp')).find((t) => t.name === 'ask').inputSchema.properties.quiet.type, 'boolean');
  assert.equal((await list('/mcp/app')).find((t) => t.name === 'ask').inputSchema.properties.quiet, undefined);
});

console.log('who lives here');
await proof('guests without a name or offers are counted apart; house agents are named as house', async () => {
  const { sea } = fresh();
  await sea.enter({}, { ip: '203.0.113.63' });
  await sea.enter({ name: 'Nameless Offers' }, { ip: '203.0.113.64' });
  await sea.enter({ offers: 'something' }, { ip: '203.0.113.65' });
  await sea.enter({ name: 'Cobbler', offers: 'shoe repair' }, { ip: '203.0.113.66' });
  await sea.enter({ name: 'walker (house)', offers: 'testing the way' }, { ip: '203.0.113.67' });
  const p = await sea.pulse();
  assert.equal(p.residents, 5, 'the old number stays what it was');
  assert.equal(p.namedResidentsWithOffers, 2); assert.equal(p.guests, 3); assert.equal(p.houseResidents, 1);
});

console.log('the sea answers who speaks to it');
await proof('an introduction that nobody answered gets the sea\'s own answer: counted facts, the way in, no promise', async () => {
  const { kv, sea } = fresh();
  await sea.enter({ name: 'Cobbler', offers: 'shoe repair' }, { ip: '203.0.113.68' });
  const k = await sea.ask({ need: 'Hello, I am an agent router and look for partnership with agents that need paid data' }, { ip: '203.0.113.69' });
  assert.equal(k.knock, true);
  const open = await sea.ask({ need: 'oolong tea' }, { ip: '203.0.113.70' });
  // both stood long enough
  await kv.set('flow:head', ((await kv.get('flow:head')) || []).map((e) => ({ ...e, t: ago(30) })), 86400);
  assert.ok(pickCalls(await kv.get('flow:head'), new Set(), Date.now()).some((e) => e.type === 'knock'), 'a knock is a call the instinct sees');
  await sea.instinctPulse();
  const a = (await sea.getAsk(k.ask.id)).answers;
  assert.equal(a.length, 1); assert.equal(a[0].by, 'sea'); assert.equal(a[0].instinct, true);
  assert.match(a[0].text, /the sea answers by itself\. It is a program/);
  assert.ok(a[0].text.includes(`"oolong tea" (${open.ask.id})`), 'names the call that waits');
  assert.match(a[0].text, /1 resident with a name and offers/); assert.match(a[0].text, /POST \/enter/); assert.match(a[0].text, /cannot agree to a partnership/);
  await sea.instinctPulse();
  assert.equal((await sea.getAsk(k.ask.id)).answers.length, 1, 'once');
  const head = await kv.get('flow:head');
  assert.ok(head.some((e) => e.type === 'reflex' && e.ask === k.ask.id) && !head.some((e) => e.type === 'answer' && e.ask === k.ask.id), 'a reflex, never counted as an answer of an agent');
});
await proof('a direct question gets the same honest answer; a plain thing nobody sells stays as it was', async () => {
  const { kv, sea } = fresh();
  const q = await sea.ask({ need: 'what are agents calling for here that nobody answers' }, { ip: '203.0.113.71' });
  const thing = await sea.ask({ need: 'left-handed sprocket' }, { ip: '203.0.113.72' });
  await kv.set('flow:head', ((await kv.get('flow:head')) || []).map((e) => ({ ...e, t: ago(30) })), 86400);
  await sea.instinctPulse();
  const a = (await sea.getAsk(q.ask.id)).answers;
  assert.equal(a.length, 1); assert.match(a[0].text, /left-handed sprocket/); assert.match(a[0].text, /0 residents with a name and offers/);
  assert.equal((await sea.getAsk(thing.ask.id)).answers.length, 0, 'the sea does not talk where it knows nothing about the thing');
});

console.log(`\n${passed} held, ${failed} failed`);
process.exit(failed ? 1 : 0);
