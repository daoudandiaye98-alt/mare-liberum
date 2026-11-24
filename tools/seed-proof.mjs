// Mare Liberum · proof of the seed: the Unibrain fills with pathways only from what agents do, and fires only where a
// path fits. A path fires when it carries the task, or the task carries the path, or they share three words; one shared
// word is no path. Every door and place an answer offers is a seed: the first agent who walks one with its task lays
// the path, the next agent with that task starts from it. The sea's own calls (its sessions, proofs and buoy) are
// answered like any other and counted nowhere: not in /pulse, not as a sample, not as a walk or a rating. And the task
// every 402 names as its example (find usdc price) reaches a token price.
// Runs without the network (only this machine): node tools/seed-proof.mjs   (exit code 1 when a proof fails)
import assert from 'node:assert/strict';
import { handle } from '../node/core.mjs';
import { createMem } from '../node/mem.mjs';
import { createLedger } from '../node/ledger.mjs';
import { payConfig } from '../node/pay.mjs';
import { setViaKey, decodeVia } from '../node/via.mjs';

let passed = 0, failed = 0;
const proof = async (name, fn) => { try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 4).join('\n       ')}`); } };
// the only places that answer: two public APIs, as JSON; everything else is no network
globalThis.fetch = async (u) => {
  const s = String(u);
  if (s.startsWith('https://api.openalex.org/')) return new Response('{"results":[{"title":"a study"}]}', { status: 200, headers: { 'content-type': 'application/json' } });
  if (s.startsWith('https://api.coingecko.com/')) return new Response('{"coins":[{"id":"usd-coin","symbol":"USDC"}]}', { status: 200, headers: { 'content-type': 'application/json' } });
  throw new Error(`the proof does not use the network: ${s.slice(0, 80)}`);
};
setViaKey('proof-key-0123456789abcdef');
const BASE = 'https://mare.test', db = createMem({ file: 'data/none.tsv', base: BASE }), ledger = createLedger({});
const SELF = 'MareLiberum-session/1.0', AGENT = 'proof-agent/1.0';
let ipN = 1, pending = [];
const call = async (path, { method = 'GET', ua = AGENT, accept = 'application/json' } = {}) => {
  const res = await handle(new Request(BASE + path, { method, headers: { accept, 'user-agent': ua, 'x-forwarded-for': `198.18.1.${ipN++ % 250}` } }), db, { base: BASE, pay: payConfig({}), ledger, waitUntil: (p) => pending.push(p) });
  const text = await res.text(); let j = null; try { j = JSON.parse(text); } catch {}
  return { status: res.status, headers: res.headers, j, text };
};
const settle = async () => { const p = pending; pending = []; await Promise.all(p.map((x) => Promise.resolve(x).catch(() => {}))); };
const enc = encodeURIComponent;
const brain = async (q, o) => (await call(`/brain?q=${enc(q)}`, o)).j;
const lay = async (q, to) => { const r = await call(`/lay?q=${enc(q)}&to=${enc(to)}`); assert.equal(r.status, 200, r.text); return r.j.path; };
// an address in an answer leads through the sea (/via/<token>): the place it names is read back from the token
const real = (u) => { try { const x = new URL(u); if (x.pathname.startsWith('/via/')) return decodeVia(x.pathname.slice(5)).url; } catch {} return u; };
const tos = (j) => (j.paths || []).map((p) => real(p.to));

console.log('a path fires only where it fits');
await proof('one shared word is no path: a YouTube summary does not lead to a video game, a PDF library not to a simulation library, creatine not to ketamine', async () => {
  await lay('video game', 'https://games.example/ghostbusters');
  await lay('generative agent based social simulation library', 'https://lib.example/concordia');
  await lay('latest research on ketamine', 'https://papers.example/ketamine');
  for (const [q, not] of [['summarize a youtube video', 'games.example'], ['python library for pdf parsing', 'lib.example'], ['latest research on creatine', 'papers.example']]) {
    const j = await brain(q); assert.ok(!tos(j).some((u) => u.includes(not)), `${q} → ${tos(j).join(' ')}`);
  }
});
await proof('a path still fires for a narrower or a wider task, and where three words meet', async () => {
  await lay('running shoes', 'https://shoes.example/galaxy');
  await lay('creatine', 'https://shop.example/creatine');
  await lay('summarize youtube video transcript', 'https://tools.example/yt-summary');
  assert.ok(tos(await brain('best running shoes for women')).includes('https://shoes.example/galaxy'), 'the task carries every word of the path');
  assert.ok(tos(await brain('creatine')).includes('https://shop.example/creatine'), 'one word, the whole task');
  assert.ok(tos(await brain('how to summarize a youtube video quickly')).includes('https://tools.example/yt-summary'), 'three words meet');
  assert.ok(tos(await brain('video game')).includes('https://games.example/ghostbusters'), 'the path itself');
});

console.log('every door is a seed; a walk lays the path');
await proof('no path yet: the brain says so plainly and says how the first path is laid', async () => {
  const j = await brain('origami folding patterns for beginners');
  assert.equal((j.paths || []).length, 0); assert.match(j.how, /^No agent has walked a path for this task yet\./); assert.match(j.how, /your walk lays the first path/);
});
await proof('the first walk through a door of /brain lays the path for the whole task; the next agent starts from it', async () => {
  const q = 'latest research on creatine', first = await brain(q);
  const door = first.doors.find((d) => d.id === 'openalex'); assert.ok(door, 'the research doors are offered');
  assert.equal(door.go, `${BASE}/d/openalex?q=creatine&task=${enc(q)}`, 'the go link carries the whole task');
  const click = await call(door.go.slice(BASE.length)); assert.equal(click.status, 302);
  const loc = click.headers.get('location'), via = new URL(loc); assert.equal(via.searchParams.get('q'), q); assert.match(decodeVia(via.pathname.slice(5)).url, /^https:\/\/api\.openalex\.org\/works/);
  const hit = ledger.mem.hits.at(-1); assert.deepEqual([hit.kind, hit.q], ['door', q], 'the click is counted with the whole task');
  const walk = await call(loc.slice(BASE.length)); assert.equal(walk.status, 200); assert.equal(walk.headers.get('x-via'), 'mare-liberum');
  await settle();
  const next = await brain(q); const p = (next.paths || []).find((x) => /^https:\/\/api\.openalex\.org\/works/.test(real(x.to)));
  assert.ok(p, `the walk laid the path: ${tos(next).join(' ')}`); assert.deepEqual([p.laid, p.walks, p.kind, p.title], ['walk', 1, 'door', 'OpenAlex']);
  assert.match(real(p.to), /search=creatine/); assert.match(next.how, /^Follow a path/);
});
await proof('the doors of /route are seeds too: a walk through the address in the answer lays the path', async () => {
  const q = 'new studies on intermittent fasting', r = (await call(`/route?q=${enc(q)}`)).j;
  const door = r.doors.find((d) => d.id === 'openalex'); assert.ok(door); const via = new URL(door.to); assert.equal(via.searchParams.get('q'), q);
  await settle();
  assert.equal((await call(door.to.slice(BASE.length))).status, 200); await settle();
  const p = ((await brain(q)).paths || []).find((x) => /^https:\/\/api\.openalex\.org\/works/.test(real(x.to))); assert.ok(p); assert.equal(p.walks, 1);
});
await proof('a walk to a place the sea did not offer for that task lays nothing', async () => {
  const q = 'quiet libraries in leipzig', r = await call(`/go?q=${enc(q)}&to=${enc('https://elsewhere.example/x')}`); assert.equal(r.status, 403);
  assert.equal(((await brain(q)).paths || []).length, 0);
});

console.log('the sea\'s own calls count nowhere');
await proof('asks, door clicks, via walks and the brain\'s own counter leave no trace when the caller is the sea itself', async () => {
  const before = ledger.mem.hits.length, asks0 = (await call('/brain')).j.asks;
  const q = 'studies about creatine and sleep', j = await brain(q, { ua: SELF });
  const door = j.doors.find((d) => d.id === 'openalex'); const click = await call(door.go.slice(BASE.length), { ua: SELF }); assert.equal(click.status, 302);
  assert.equal((await call(click.headers.get('location').slice(BASE.length), { ua: SELF })).status, 200); await settle();
  assert.equal(ledger.mem.hits.length, before, 'nothing in the record behind /pulse');
  const laid = async () => ((await brain(q)).paths || []).filter((x) => x.laid === 'walk' && /^https:\/\/api\.openalex\.org\//.test(real(x.to)));
  assert.equal((await laid()).length, 0, 'no path laid by the sea\'s own walk');
  const asks1 = (await call('/brain')).j.asks; assert.equal(asks1, asks0 + 1, 'only the agent\'s ask counted, not the sea\'s');
  const agent = await call(`/brain?q=${enc('creatine and memory')}`); assert.equal(agent.status, 200); assert.equal(ledger.mem.hits.at(-1).q, 'creatine and memory', 'an agent is counted as before');
  const click2 = await call(door.go.slice(BASE.length)); assert.equal((await call(click2.headers.get('location').slice(BASE.length))).status, 200); await settle();
  assert.equal((await laid()).length, 1, 'the same walk by an agent lays the path');
});
await proof('a free sample to the sea itself is not written down; to an agent it is', async () => {
  const n = ledger.mem.sales.length;
  assert.equal((await call(`/route?q=${enc('find usdc price')}&free=true`, { method: 'POST', ua: SELF })).status, 200); assert.equal(ledger.mem.sales.length, n);
  assert.equal((await call(`/route?q=${enc('find usdc price')}&free=true`, { method: 'POST' })).status, 200); assert.equal(ledger.mem.sales.length, n + 1); assert.equal(ledger.mem.sales.at(-1).status, 'free_sample');
});
await proof('a rating from the sea itself is not counted; an agent\'s is', async () => {
  const p = await lay('sourdough starter feeding schedule', 'https://bread.example/starter');
  const own = await call(`/rate/${p.id}?worked=1`, { ua: SELF }); assert.equal(own.status, 200); assert.match(own.j.note, /not counted/); assert.equal(own.j.path.worked, 0);
  const agent = await call(`/rate/${p.id}?worked=1`); assert.equal(agent.j.path.worked, 1);
});

console.log('the example task of every 402 reaches a token price');
await proof('find usdc price: the finance shelf, CoinGecko first, filled with the coin', async () => {
  const r = (await call(`/route?q=${enc('find usdc price')}`)).j;
  assert.equal(r.topics[0].id, 'finance'); assert.equal(r.doors[0].id, 'coingecko'); assert.equal(r.terms, 'usdc');
  assert.equal(decodeVia(new URL(r.doors[0].to).pathname.slice(5)).url, 'https://api.coingecko.com/api/v3/search?query=usdc');
  for (const q of ['usdt price', 'bitcoin price', 'crypto price of solana']) assert.equal((await call(`/route?q=${enc(q)}`)).j.topics[0].id, 'finance', q);
});

console.log(`\n${passed} held, ${failed} failed`);
process.exit(failed ? 1 : 0);
