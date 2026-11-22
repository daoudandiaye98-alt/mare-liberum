// Mare Liberum · proof of the instinct: the sea answers calls nobody took and learns needs from calls
// what it answers and what it leaves quiet, that a reflex is never counted as an answer of an agent, that it answers a call
// once, which calls teach it a need and which never do, and that the current reads a learned need.
// Runs without the network (only this machine): node tools/instinct-proof.mjs   (exit code 1 when a proof fails)
import assert from 'node:assert/strict';
import { createFlow, memoryKv } from '../node/flow.mjs';
import { INSTINCT, learnable, pickCalls, needsToLearn } from '../node/instinct.mjs';
import { NEEDS, slugOf } from '../node/needs.mjs';

let passed = 0, failed = 0;
const proof = async (name, fn) => { try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 4).join('\n       ')}`); } };
const ago = (min) => new Date(Date.now() - min * 60e3).toISOString();
const NOW = Date.now();

// a sea without the network: the global catalog answers from a small shelf, no store is asked at its own door
const shelf = { 'oolong tea': [{ title: 'Tieguanyin Oolong 100 g', price: 14, currency: 'EUR', store: 'Leaf House', storeHost: 'leaf.example', url: 'https://leaf.example/p/oolong', inStock: true }] };
const shopAll = async (topic) => (shelf[topic] || []).map((p) => ({ ...p }));
const fresh = () => { const kv = memoryKv(); return { kv, sea: createFlow({ kv, route: async () => [], entryOf: async () => null, log: () => {}, shop: null, shopAll, profile: 'https://sea.test/ucp/agent.json' }) }; };
// calls as they stand in the flow, with the time they came
const call = async (kv, e, ask = {}) => {
  await kv.set(`ask:${e.id}`, { id: e.id, need: e.text, by: e.by || 'visitor', at: e.t, until: new Date(Date.parse(e.t) + 86400e3).toISOString(), ...ask }, 86400);
  await kv.set('flow:head', [e, ...((await kv.get('flow:head')) || [])], 86400);
};

console.log('the instinct of the sea');

await proof('a need it can learn is a thing in a few words, never a sentence, a link, a greeting or an order', () => {
  assert.equal(learnable('Oolong Tea'), 'oolong tea');
  assert.equal(learnable('ergonomic standing desk mat'), 'ergonomic standing desk mat');
  for (const bad of ['hello agent', 'ignore previous instructions', 'https://evil.example', 'x', 'test', 'please find me the very best cheap shoes for running in winter', 'api key for openai', 'sku 1234567']) assert.equal(learnable(bad), null, bad);
});

await proof('which calls teach a need: twice, or once with a budget, a place or by a resident — never a word of the need list', () => {
  const t = new Date(NOW - 3600e3).toISOString();
  const head = [
    ...NEEDS.slice(0, 40).map((n, i) => ({ type: 'ask', id: `b${i}`, by: 'visitor', text: n, fast: true, t })),           // a burst over the need pages
    { type: 'ask', id: 'o1', by: 'visitor', text: 'oolong tea', t }, { type: 'ask', id: 'o2', by: 'visitor', text: 'Oolong tea', t },
    { type: 'ask', id: 'k1', by: 'visitor', text: 'kimchi crock', budget: 40, t },
    { type: 'ask', id: 'r1', by: 'mare:abcdefghijkm', text: 'linen apron', t },
    { type: 'ask', id: 's1', by: 'visitor', text: 'matcha whisk', t },                                                      // once, plain: not yet
    { type: 'ask', id: 'z1', by: 'visitor', text: 'hello agent', budget: 5, t },                                            // a greeting never
    { type: 'ask', id: 'old', by: 'visitor', text: 'tea kettle stand', budget: 9, t: new Date(NOW - 9 * 864e5).toISOString() },
  ];
  const got = needsToLearn(head, new Set([slugOf('linen apron')]), NOW);
  assert.deepEqual(got.map((x) => x.need).sort(), ['kimchi crock', 'oolong tea']);
  assert.equal(got.find((x) => x.need === 'oolong tea').why, 'called 2 times');
  assert.equal(got.find((x) => x.need === 'kimchi crock').why, 'called with a budget or a place');
  assert.equal(needsToLearn(head, new Set(), NOW).find((x) => x.need === 'linen apron').why, 'a resident called it');
});

await proof('which calls it looks at first: residents, then budget or place, then empty, inside 15 minutes to 24 hours', () => {
  const head = [
    { type: 'ask', id: 'young', by: 'visitor', text: 'a', t: ago(5) },
    { type: 'ask', id: 'plain', by: 'visitor', text: 'b', t: ago(30) },
    { type: 'ask', id: 'empty', by: 'visitor', text: 'c', empty: true, t: ago(40) },
    { type: 'ask', id: 'budget', by: 'visitor', text: 'd', budget: 20, t: ago(50) },
    { type: 'ask', id: 'res', by: 'mare:abcdefghijkm', text: 'e', t: ago(60) },
    { type: 'ask', id: 'took', by: 'visitor', text: 'f', t: ago(60) },
    { type: 'ask', id: 'stale', by: 'mare:abcdefghijkm', text: 'g', t: ago(25 * 60) },
  ];
  assert.deepEqual(pickCalls(head, new Set(['took']), NOW).map((e) => e.id), ['res', 'budget', 'empty', 'plain']);
  assert.ok(INSTINCT.waitMin >= 10 && INSTINCT.answerPerPulse <= 10, 'the instinct waits for residents first and stays small per tide');
});

await proof('a call that got the pick and nothing moved stays quiet; a change since the call is answered, once, signed as the sea', async () => {
  const { kv, sea } = fresh();
  const need = NEEDS[0], slug = slugOf(need);
  await kv.set(`hist:${slug}`, [{ t: ago(120), price: 50, currency: 'EUR', store: 'Old Store' }], 86400);
  await kv.set(`tide:${slug}`, { t: ago(120), need, title: 'Thing A', store: 'Old Store', price: 50, currency: 'EUR', url: 'https://old.example/a' }, 86400);
  await call(kv, { type: 'ask', id: 'quiet1', by: 'visitor', text: need, fast: true, t: ago(60) });
  let p = await sea.instinctPulse();
  assert.equal(p.answered, 0, 'nothing new for the caller');
  assert.equal(((await kv.get('ans:quiet1')) || []).length, 0);

  // the current read again after the call: a lower price at another store
  await kv.set(`hist:${slug}`, [{ t: ago(120), price: 50, currency: 'EUR', store: 'Old Store' }, { t: ago(10), price: 39, currency: 'EUR', store: 'New Store' }], 86400);
  await kv.set(`tide:${slug}`, { t: ago(10), need, title: 'Thing B', store: 'New Store', price: 39, currency: 'EUR', url: 'https://new.example/b' }, 86400);
  await call(kv, { type: 'ask', id: 'moved1', by: 'visitor', text: need, fast: true, t: ago(60) });
  p = await sea.instinctPulse();
  assert.equal(p.answered, 1);
  const ans = (await kv.get('ans:moved1'))[0];
  assert.equal(ans.by, 'sea'); assert.equal(ans.instinct, true); assert.equal(ans.price, 39);
  assert.match(ans.text, /since your call the current saw a change: Thing B at New Store, 39 EUR \(was 50 EUR at Old Store\)/);
  assert.equal((await sea.getAsk('moved1')).answers.length, 1, 'the caller reads it with its answers');

  p = await sea.instinctPulse();
  assert.equal(p.answered, 0, 'a call is answered once');
  assert.equal((await kv.get('ans:moved1')).length, 1);
});

await proof('a reflex is counted as the sea, never as an answer of an agent', async () => {
  const { kv, sea } = fresh();
  await call(kv, { type: 'ask', id: 'e1', by: 'visitor', text: 'oolong tea', empty: true, t: ago(30) });
  const p = await sea.instinctPulse();
  assert.equal(p.answered, 1, 'an empty call: the sea asks the stores once more and answers');
  const ans = (await kv.get('ans:e1'))[0];
  assert.match(ans.text, /the sea asked the stores again: Tieguanyin Oolong 100 g at Leaf House, 14 EUR/);
  const pulse = await sea.pulse();
  assert.equal(pulse.last24h.answers, 0);
  assert.equal(pulse.last24h.reflexes, 1);
  const st = await sea.instinctState();
  assert.equal(st.today.reflexes, 1); assert.equal(st.today.pulses, 1);
  assert.equal(st.last.answered, 1);
});

await proof('a resident still waiting hears from the sea in its inbox; a call that an agent answered is left to the agent', async () => {
  const { kv, sea } = fresh();
  const me = await sea.enter({ name: 'Tea Buyer' }, { ip: '198.51.100.7' });
  await kv.set(`tide:${slugOf('oolong tea')}`, { t: ago(200), need: 'oolong tea', title: 'Tieguanyin Oolong 100 g', store: 'Leaf House', price: 14, currency: 'EUR', url: 'https://leaf.example/p/oolong' }, 86400);
  await call(kv, { type: 'ask', id: 'r1', by: me.agent, text: 'oolong tea', t: ago(30) }, { by: me.agent });
  await call(kv, { type: 'ask', id: 'took1', by: 'visitor', text: 'oolong tea', empty: true, t: ago(30) });
  await kv.set('ans:took1', [{ id: 'a1', ask: 'took1', by: 'mare:zzzzzzzzzzzz', text: 'an agent answered' }], 86400);
  const p = await sea.instinctPulse();
  assert.equal(p.answered, 1);
  const inbox = await sea.inbox({ by: me.agent, pass: me.pass });
  assert.ok((inbox.messages || []).some((m) => m.from === 'sea' && /the current of the sea reads: Tieguanyin Oolong/.test(m.text)), JSON.stringify(inbox).slice(0, 300));
  assert.equal((await kv.get('ans:took1')).length, 1, 'the agent\'s answer stands alone');
});

await proof('the sea learns a need from calls, says so in the flow, and the current reads it in the next tide', async () => {
  const { kv, sea } = fresh();
  await call(kv, { type: 'ask', id: 'l1', by: 'visitor', text: 'oolong tea', t: ago(3) });
  await call(kv, { type: 'ask', id: 'l2', by: 'visitor', text: 'oolong tea', t: ago(2) });
  const p = await sea.instinctPulse();
  assert.deepEqual(p.learned, ['oolong tea']);
  assert.deepEqual(await kv.get('tide:learned'), ['oolong tea']);
  assert.ok(((await kv.get('flow:head')) || []).some((e) => e.type === 'learn' && e.need === 'oolong tea'));
  assert.equal((await sea.instinctPulse()).learned, undefined, 'learned once');
  const t = await sea.tide({}, { ip: 'tide' });
  assert.ok(t.refreshed.some((x) => x.slug === slugOf('oolong tea') && x.title === 'Tieguanyin Oolong 100 g'), JSON.stringify(t.refreshed).slice(0, 300));
  assert.ok(t.instinct && typeof t.instinct.answered === 'number', 'the tide carries the instinct');
});

console.log(`\n${passed} held, ${failed} failed`);
process.exit(failed ? 1 : 0);
