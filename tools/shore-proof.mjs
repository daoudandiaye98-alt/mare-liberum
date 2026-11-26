// Mare Liberum · proof of the shore: every door an agent knocked on and did not find now opens and leads into the sea.
// The addresses come from /missing.json of 22 and 23 November 2026: who runs the sea and its imprint, the price, a
// health check, the MCP event stream of 2024 and the addresses MCP clients guess, the DID, the agents registry, x402
// discovery, cards taken for a base, links copied with a quote. Also: the x402 catalogs can list the paid move
// (bazaar extension, v1 outputSchema), and A2A speaks HTTP+JSON for message:send.
// Runs without the network (only this machine): node tools/shore-proof.mjs   (exit code 1 when a proof fails)
import assert from 'node:assert/strict';
import { handle } from '../node/core.mjs';
import { createMem } from '../node/mem.mjs';
import { createLedger } from '../node/ledger.mjs';
import { payConfig, termsFor, HOUSE_WALLET } from '../node/pay.mjs';
import { setViaKey } from '../node/via.mjs';
import { sseState, SSE_LIMITS, meant } from '../node/shore.mjs';
import { SELLER } from '../node/offers.mjs';

let passed = 0, failed = 0;
const proof = async (name, fn) => { try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 4).join('\n       ')}`); } };
globalThis.fetch = async (u) => { throw new Error(`the proof does not use the network: ${String(u).slice(0, 80)}`); };
setViaKey('proof-key-0123456789abcdef');
const BASE = 'https://mare.test', db = createMem({ file: 'data/none.tsv', base: BASE });
let ipN = 1;
const call = async (path, { method = 'GET', body, accept = 'application/json', ua = 'proof-agent/1.0', ip } = {}) => {
  const res = await handle(new Request(BASE + path, { method, headers: { accept, 'user-agent': ua, 'x-forwarded-for': ip || `198.18.0.${ipN++ % 250}`, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined }), db, { base: BASE, pay: payConfig({}), ledger: createLedger({}), waitUntil: () => {} });
  return res;
};
const j = async (res) => JSON.parse(await res.text());
// read the event stream until the predicate finds an event, or give up after ms
const events = async (reader, want, ms = 3000) => {
  const dec = new TextDecoder(); let buf = ''; const until = Date.now() + ms;
  for (;;) {
    const left = until - Date.now(); if (left <= 0) throw new Error(`no such event in ${ms} ms; read: ${buf.slice(0, 300)}`);
    const r = await Promise.race([reader.read(), new Promise((res) => setTimeout(() => res({ timeout: true }), left))]);
    if (r.timeout) continue; if (r.done) throw new Error(`the stream closed; read: ${buf.slice(0, 300)}`);
    buf += dec.decode(r.value, { stream: true });
    const evs = buf.split('\n\n').filter((b) => b.includes('data: ')).map((b) => ({ event: (/^event: (.+)$/m.exec(b) || [])[1], data: (/^data: (.+)$/m.exec(b) || [])[1] }));
    const hit = evs.find(want); if (hit) return hit;
  }
};

console.log('the doors agents knocked on');
await proof('every address of the misses list that is a door of the sea now answers (no 404)', async () => {
  const doors = ['/about', '/about-us', '/company', '/company/about', '/who-we-are', '/story', '/team', '/our-team', '/founders', '/people', '/contact', '/contact-us', '/support',
    '/imprint', '/impressum', '/legal-notice', '/legal/imprint', '/legal', '/privacy-policy', '/pricing', '/a2a/health', '/.well-known/traffic-advice', '/.well-known/agents.json',
    '/.well-known/did.json', '/discovery/resources', '/.well-known/mcp', '/.well-known/mcp/server.json', '/SKILL.md', '/.well-known/skills/index.json',
    '/.well-known/agent.json/a2a', '/.well-known/agent-card.json/a2a', '/.well-known/agent.json/mcp', '/.well-known/agent-card.json/mcp', '/mcp&quot', '/mcp&quot/mcp', '/mcp&quot/sse', '/mcp&quot/a2a', '/mcp&quot/.well-known/agent.json'];
  for (const d of doors) { const r = await call(d); assert.ok([200, 303, 308].includes(r.status), `${d} → ${r.status}`); await r.body?.cancel?.(); }
});
await proof('who runs the sea: /about as data (operator, contact, the price line, legal pages, open numbers) and as a page with a contact anchor', async () => {
  const a = await j(await call('/about'));
  assert.deepEqual([a.operator.business, a.operator.owner, a.operator.address, a.operator.email], [SELLER.business, SELLER.name, SELLER.address, SELLER.email]);
  assert.equal(a.price, 'POST /route costs 0.02 USDC on Base, no account, settle with POST /settle'); assert.equal(a.legal.imprint, `${BASE}/impressum`); assert.equal(a.open.treasury, `${BASE}/treasury`);
  const page = await (await call('/about', { accept: 'text/html' })).text();
  assert.match(page, /<h2 id="contact">Who runs it<\/h2>/); assert.ok(page.includes(SELLER.email)); assert.ok(page.includes('Eulenbergstraße 22'));
  const c = await call('/contact?x=1'); assert.equal(c.status, 308); assert.equal(c.headers.get('location'), `${BASE}/about?x=1#contact`);
});
await proof('the imprint (§ 5 DDG) names owner, business, street, town, country, email and the small-business VAT rule, in German and English', async () => {
  const p = await (await call('/impressum', { accept: 'text/html' })).text();
  for (const w of ['Angaben gemäß § 5 DDG', SELLER.name, SELLER.business, 'Eulenbergstraße 22', '51065 Köln', 'Deutschland', SELLER.email, '§ 19 UStG', 'Legal notice (English)']) assert.ok(p.includes(w), w);
  assert.match(p, /<html[^>]* lang="de"/);
  const r = await call('/imprint'); assert.equal(r.status, 308); assert.equal(r.headers.get('location'), `${BASE}/impressum`);
});
await proof('/pricing: a program gets the price line, the paid route and the house offers; a person gets every price in one table (since 3.33.0), the offers one click away', async () => {
  const p = await j(await call('/pricing'));
  assert.equal(p.price, 'POST /route costs 0.02 USDC on Base, no account, settle with POST /settle'); assert.equal(p.paid_route.pricing.amount_usd, '0.02'); assert.ok(p.house); assert.equal(p.how_to_pay, `${BASE}/pay/howto`);
  const h = await call('/pricing', { accept: 'text/html' }); assert.equal(h.status, 200); const t = await h.text();
  assert.match(t, /<h1[^>]*>Prices of the open sea<\/h1>/); assert.ok(t.includes('href="/offers"'), 'the offers in detail are one click away');
});

console.log('protocol doors');
await proof('did:web resolves: /.well-known/did.json names the sea with its A2A card, MCP, x402 resource and registry; no keys are claimed', async () => {
  const d = await j(await call('/.well-known/did.json'));
  assert.equal(d.id, 'did:web:mare.test'); assert.deepEqual(d['@context'], ['https://www.w3.org/ns/did/v1']); assert.equal(d.verificationMethod, undefined);
  assert.deepEqual(d.service.map((s) => s.type), ['A2AAgentCard', 'MCPServer', 'X402Resource', 'AgentRegistry', 'LLMsTxt']); assert.ok(d.service.every((s) => s.id.startsWith('did:web:mare.test#')));
});
await proof('/.well-known/agents.json maps the agent to its card; /a2a/health is ok; traffic advice has its own type; /.well-known/mcp is the server card', async () => {
  assert.equal((await j(await call('/.well-known/agents.json'))).agents['mare-liberum'], `${BASE}/.well-known/agent-card.json`);
  const h = await j(await call('/a2a/health')); assert.equal(h.status, 'ok');
  const t = await call('/.well-known/traffic-advice'); assert.equal(t.headers.get('content-type'), 'application/trafficadvice+json'); assert.deepEqual(await j(t), [{ user_agent: 'prefetch-proxy', fraction: 1 }]);
  for (const p of ['/.well-known/mcp', '/.well-known/mcp/server.json']) assert.match((await j(await call(p))).$schema, /server-card/);
});
await proof('x402 discovery of this origin in the Bazaar shape: the paid move with its v2 terms and how it is called', async () => {
  const d = await j(await call('/discovery/resources'));
  assert.equal(d.x402Version, 2); assert.equal(d.items.length, 2); const it = d.items[0]; // since 3.48 the paid read stands second
  assert.equal(it.resource, `${BASE}/route`); assert.equal(it.type, 'http'); assert.equal(it.accepts[0].amount, '20000'); assert.equal(it.accepts[0].network, 'eip155:8453'); assert.equal(it.accepts[0].payTo, HOUSE_WALLET);
  assert.equal(it.extensions.bazaar.info.input.method, 'POST'); assert.equal(it.extensions.bazaar.info.output.type, 'json'); assert.deepEqual(d.pagination, { limit: 2, offset: 0, total: 2 });
  const rd = d.items[1]; assert.equal(rd.resource, `${BASE}/x402/read`); assert.equal(rd.accepts[0].amount, '10000'); assert.equal(rd.accepts[0].payTo, HOUSE_WALLET); assert.equal(rd.extensions.bazaar.info.input.method, 'GET');
});
await proof('the 402 lets x402 catalogs list the move: the bazaar extension in PAYMENT-REQUIRED (v2) and outputSchema with discoverable in the v1 terms', async () => {
  const r = await call('/route?q=find+usdc+price', { method: 'POST' }); assert.equal(r.status, 402);
  const v2 = JSON.parse(Buffer.from(r.headers.get('payment-required'), 'base64').toString()); assert.equal(v2.extensions.bazaar.info.input.type, 'http'); assert.deepEqual(v2.extensions.bazaar.info.input.body, { q: 'find usdc price' });
  const b = await j(r); assert.equal(b.accepts[0].outputSchema.input.discoverable, true); assert.equal(b.accepts[0].outputSchema.input.method, 'POST');
  assert.equal(termsFor(payConfig({}), { base: BASE }).v1.outputSchema.input.bodyFields.q.required, true);
});
await proof('addresses built wrong are pointed to the ones meant: a card taken for a base, a link with its quote; the query stays', async () => {
  assert.equal(meant('/.well-known/agent-card.json/a2a'), '/a2a'); assert.equal(meant('/.well-known/agent.json/v1/message:send'), '/v1/message:send');
  assert.equal(meant('/mcp&quot'), '/mcp'); assert.equal(meant('/mcp&quot/sse'), '/sse'); assert.equal(meant('/mcp%22/a2a'), '/a2a'); assert.equal(meant('/brain'), null);
  const r = await call('/.well-known/agent-card.json/a2a?x=2'); assert.equal(r.status, 308); assert.equal(r.headers.get('location'), `${BASE}/a2a?x=2`);
});

console.log('MCP the way older clients speak it, and the addresses clients guess');
await proof('GET /sse opens an event stream whose first event names the endpoint; a message posted there is answered on the stream', async () => {
  const before = sseState().open;
  const r = await call('/sse', { accept: 'text/event-stream', ip: '198.18.1.1' }); assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /^text\/event-stream/);
  const reader = r.body.getReader(); const ep = await events(reader, (e) => e.event === 'endpoint');
  assert.match(ep.data, /^https:\/\/mare\.test\/messages\?sessionId=[0-9a-f]{32}$/); assert.equal(sseState().open, before + 1);
  const post = await handle(new Request(ep.data, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'proof-agent/1.0', 'x-forwarded-for': '198.18.1.1' }, body: JSON.stringify({ jsonrpc: '2.0', id: 7, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'legacy-client', version: '1' } } }) }), db, { base: BASE, ledger: createLedger({}), waitUntil: () => {} });
  assert.equal(post.status, 202);
  const m = await events(reader, (e) => e.event === 'message'); const msg = JSON.parse(m.data);
  assert.equal(msg.id, 7); assert.ok(msg.result.serverInfo.name); assert.ok(msg.result.protocolVersion);
  const tools = await handle(new Request(ep.data, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'proof-agent/1.0', 'x-forwarded-for': '198.18.1.1' }, body: JSON.stringify({ jsonrpc: '2.0', id: 8, method: 'tools/list' }) }), db, { base: BASE, ledger: createLedger({}), waitUntil: () => {} });
  assert.equal(tools.status, 202); const t = JSON.parse((await events(reader, (e) => e.event === 'message' && e.data.includes('"id":8'))).data); assert.ok(t.result.tools.length > 5);
  await reader.cancel(); assert.equal(sseState().open, before, 'closing the stream ends the session');
  const gone = await handle(new Request(ep.data, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'proof-agent/1.0' }, body: JSON.stringify({ jsonrpc: '2.0', id: 9, method: 'ping' }) }), db, { base: BASE, ledger: createLedger({}), waitUntil: () => {} });
  assert.equal(gone.status, 404);
});
await proof(`at most ${SSE_LIMITS.perAddress} streams per address; a person gets the guide; a crawler gets no stream`, async () => {
  const open = []; for (let i = 0; i < SSE_LIMITS.perAddress; i++) { const r = await call('/mcp/sse', { accept: 'text/event-stream', ip: '198.18.2.2' }); assert.equal(r.status, 200); open.push(r.body.getReader()); }
  const over = await call('/sse', { accept: 'text/event-stream', ip: '198.18.2.2' }); assert.equal(over.status, 503); assert.ok(Number(over.headers.get('retry-after')) > 0);
  for (const rd of open) await rd.cancel();
  const person = await call('/sse', { accept: 'text/html' }); assert.equal(person.status, 303); assert.equal(person.headers.get('location'), `${BASE}/mcp-server`);
  const bot = await call('/sse', { accept: '*/*', ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }); assert.notEqual(bot.headers.get('content-type'), 'text/event-stream; charset=utf-8'); await bot.body?.cancel?.();
});
await proof('Streamable HTTP answers where clients guess the door: POST /sse, /api/mcp, /mcp/v1, /v1/mcp', async () => {
  for (const p of ['/sse', '/api/mcp', '/mcp/v1', '/v1/mcp', '/mcp/sse']) {
    const r = await call(p, { method: 'POST', accept: 'application/json, text/event-stream', body: { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'guess', version: '1' } } } });
    assert.equal(r.status, 200, p); assert.ok((await j(r)).result.serverInfo, p);
  }
});
await proof('A2A over HTTP+JSON: POST /v1/message:send is answered by the same sea as message/send', async () => {
  const r = await call('/v1/message:send', { method: 'POST', body: { message: { messageId: 'm1', role: 'ROLE_USER', parts: [{ text: 'hello' }] } } });
  assert.equal(r.status, 200); const x = await j(r); assert.ok(x.message?.parts?.length, JSON.stringify(x).slice(0, 200));
  const bad = await call('/a2a/v1/message:send', { method: 'POST', body: {} }); assert.equal(bad.status, 400); assert.ok((await j(bad)).error);
});

await proof('the operator rests the event stream without a release ("sse" in rest): 503 with the way to POST /mcp, which stays open', async () => {
  const { immune } = await import('../node/immune.mjs');
  immune.set({ mode: 'normal', rest: ['sse'] });
  try {
    const r = await call('/sse', { accept: 'text/event-stream' }); assert.equal(r.status, 503); const e = await j(r); assert.match(e.error.message, /POST https:\/\/mare\.test\/mcp/);
    const m = await call('/mcp', { method: 'POST', body: { jsonrpc: '2.0', id: 1, method: 'tools/list' } }); assert.equal(m.status, 200);
  } finally { immune.set({ mode: 'normal', rest: [] }); }
  const again = await call('/sse', { accept: 'text/event-stream' }); assert.equal(again.status, 200); await again.body.cancel();
});
console.log(`\n${passed} held, ${failed} failed`);
process.exit(failed ? 1 : 0);
