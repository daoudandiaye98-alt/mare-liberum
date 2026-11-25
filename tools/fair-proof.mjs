// Mare Liberum · proof of fair share (3.34): receipts only for what the savings ledger counts (never the sea's own calls,
// never crawlers, once a day per network and page), the share math (20 % lower, 10 % modelled, 0 % upper, the agent keeps
// at least 80 %), the 402 for exactly the unpaid sum, a paid receipt never billed twice, the app door byte for byte, and
// off by default. Negative controls at the end: each rule is broken in a copy of the code, and this proof must fail there.
// Runs without the network: node tools/fair-proof.mjs   (exit code 1 when a proof fails or a control is not caught)
//   --no-controls   only the proofs (the controls run this file that way in each broken copy)
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, cpSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { handle } from '../node/core.mjs';
import { memoryKv } from '../node/flow.mjs';
import { createMem } from '../node/mem.mjs';
import { createLedger } from '../node/ledger.mjs';
import { payConfig, USDC_BASE, HOUSE_WALLET } from '../node/pay.mjs';
import { tokensOfBytes, SAVE } from '../node/areas.mjs';
import { loadBench, loadLean, proofJson } from '../node/proof.mjs';
import { immune } from '../node/immune.mjs';
import { HUB_PATHS } from '../node/hubs.mjs';
import { FAIR, METHOD, BENCH, calibrate, baselineOf, answerTokensOf, shareOf, receiptOf, sealFair, withField, fairSwitch, usd6 } from '../node/fair.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTROLS = !process.argv.includes('--no-controls');
let passed = 0, failed = 0;
const proof = async (name, fn) => { try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 4).join('\n       ')}`); } };
const BASE = 'https://mare.test', FAC = 'https://facilitator.test';
// the facilitator of the proof: it answers as each proof tells it; nothing else is reached
let facilitator = () => { throw new Error('the facilitator must not be asked'); }; const asked = [];
globalThis.fetch = async (u, o = {}) => {
  const s = String(u);
  if (s.startsWith(FAC)) { const kind = s.slice(FAC.length + 1), body = JSON.parse(o.body); asked.push({ kind, body }); return facilitator(kind, body); }
  throw new Error(`the proof does not use the network: ${s.slice(0, 80)}`);
};
const answer = (j, status = 200) => new Response(JSON.stringify(j), { status, headers: { 'content-type': 'application/json' } });

// ------------------------------------------------------------------ the sea of the proof: an empty index, a memory, a till
const dir = mkdtempSync(join(tmpdir(), 'mare-fair-')), file = join(dir, 'sea.tsv');
writeFileSync(file, ''); writeFileSync(join(dir, 'build.json'), JSON.stringify({ builtAt: '2026-11-20T10:00:00.000Z', entries: 0, lakes: {} }));
const db = createMem({ file, base: BASE }), kv = memoryKv(), ledger = createLedger({});
const SITE = { '/llms.txt': { body: readFileSync(join(ROOT, 'site/llms.txt'), 'utf8'), type: 'text/plain; charset=utf-8' } };
const PAY = { ...payConfig({}), facilitator: FAC, settleWaitMs: 200, verifyMs: 500, settleMs: 2000 };
const ON = { base: BASE, pay: PAY, ledger, kv, site: SITE, fair: 'on', waitUntil: () => {} };
const OFF = { base: BASE, pay: PAY, ledger, kv, site: SITE, waitUntil: () => {} };
let ipN = 1;
const MD = 'text/markdown, text/html, */*', JSONA = 'application/json';
const call = async (path, { cfg = ON, accept = JSONA, ua = 'proof-agent/1.0', method = 'GET', body, headers = {}, ip } = {}) => {
  const res = await handle(new Request(BASE + path, { method, headers: { accept, 'user-agent': ua, 'x-forwarded-for': ip || `198.18.${(ipN >> 8) & 255}.${ipN++ & 255}`, ...(body ? { 'content-type': 'application/json' } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) }), db, cfg);
  const text = await res.text(); let j = null; try { j = JSON.parse(text); } catch {}
  return { status: res.status, h: res.headers, text, j };
};
const sea = () => db.flow;
const fairL = () => db.fairLedger;
await call('/brain/areas.json', { cfg: OFF }); // wakes the sea of the proof (db.flow) and its ledger of receipts
const SEA_HDR = ['x-sea-saved-tokens', 'x-sea-fair-share-usd', 'x-sea-receipt'];
const noReceipt = (r, what) => { for (const k of SEA_HDR) assert.equal(r.h.get(k), null, `${what}: no ${k}`); assert.ok(!r.j || typeof r.j !== 'object' || !('receipt' in r.j), `${what}: no receipt field`); };
const idOf = (r) => String(r.h.get('x-sea-receipt') || '').split('/').pop();
const today = () => sea().savings().then((s) => s.today.counts);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64');
const auth = (value, to = HOUSE_WALLET) => ({ from: '0x2222222222222222222222222222222222222222', to, value: String(value), validAfter: '0', validBefore: String(Math.floor(Date.now() / 1000) + 300), nonce: '0x' + '33'.repeat(32) });
const v2 = (value, to = HOUSE_WALLET) => b64({ x402Version: 2, accepted: { scheme: 'exact', network: 'eip155:8453', amount: String(value), asset: USDC_BASE, payTo: to, maxTimeoutSeconds: 300, extra: { name: 'USD Coin', version: '2' } }, payload: { signature: '0x' + '11'.repeat(65), authorization: auth(value, to) } });
const TX = '0x' + 'cd'.repeat(32);
// public words: never a coin, a currency, a token sale or an investment, no cash-out, nothing converted or redeemed later
const FORBIDDEN = /\b(coins?|currenc(y|ies)|token sale|investments?|cash[- ]?out|convert(ed|ible|s)?|exchange[ds]? (later|for)|redeem(ed|s)? (later|for)|future (value|currency|coin|token)s?)\b/i;
// an x402 v2 challenge as catalogs read it (x402scan: a parseable challenge, a non-empty accepts with atomic amounts, a bazaar
// input; docs.x402.org: resource.url absolute, asset a string); the declared input must validate against schema.properties.input
const fits = (v, sc) => { if (!sc || typeof sc !== 'object') return true; if ('const' in sc && v !== sc.const) return false; if (sc.type === 'object') { if (!v || typeof v !== 'object' || Array.isArray(v)) return false; for (const k of sc.required || []) if (!(k in v)) return false; for (const [k, s2] of Object.entries(sc.properties || {})) if (k in v && !fits(v[k], s2)) return false; }
  if (sc.type === 'array') { if (!Array.isArray(v) || (sc.maxItems != null && v.length > sc.maxItems)) return false; if (sc.items && !v.every((x) => fits(x, sc.items))) return false; } if (sc.type === 'string' && (typeof v !== 'string' || (sc.pattern && !new RegExp(sc.pattern).test(v)))) return false; return true; };
function x402Valid(h, what) {
  const raw = h.get('payment-required'); assert.ok(raw, `${what}: a PAYMENT-REQUIRED header`); const c = JSON.parse(Buffer.from(raw, 'base64').toString());
  assert.equal(c.x402Version, 2, `${what}: x402Version 2`); assert.match(c.resource?.url || '', /^https:\/\//, `${what}: resource.url absolute`); assert.ok(Array.isArray(c.accepts) && c.accepts.length, `${what}: accepts not empty`);
  for (const a of c.accepts) { for (const k of ['scheme', 'network', 'asset', 'payTo']) assert.equal(typeof a[k], 'string', `${what}: accepts.${k}`); assert.match(a.amount, /^[1-9][0-9]*$/, `${what}: amount in atomic units`); assert.ok(Number.isInteger(a.maxTimeoutSeconds), `${what}: maxTimeoutSeconds`); assert.match(a.network, /^eip155:\d+$/, `${what}: CAIP-2 network`); }
  const b = c.extensions?.bazaar; assert.equal(b?.info?.input?.type, 'http', `${what}: bazaar input type`); assert.ok(b.info.input.method, `${what}: bazaar input method`); if (b.info.output) assert.ok(b.info.output.type, `${what}: bazaar output type`);
  if (b.schema) assert.ok(fits(b.info.input, b.schema.properties.input), `${what}: the declared input validates against schema.properties.input`);
  return c;
}

console.log('the rule');
await proof('the share: 20 % of the lower value, 10 % of the modelled, nothing of the upper; the agent keeps at least 80 % (2,000 random answers)', () => {
  assert.equal(shareOf({ lower: 1000 }).share.mid, 400); assert.equal(shareOf({ lower: 1000 }).value.mid, 2000); assert.equal(shareOf({ lower: 1000 }).keepShare, 0.8);
  assert.equal(shareOf({ modelled: 1000 }).share.mid, 200); assert.equal(shareOf({ modelled: 1000 }).keepShare, 0.9);
  const up = receiptOf([{ k: 'md', html: 400_000, md: 20_000, text: null }]); assert.ok(up.tokens.upper > 50_000); assert.equal(up.tokens.conservative, 0); assert.equal(up.shareMicro.mid, 0, 'the upper basis is never billed');
  let seed = 7; const rnd = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 2000; i++) {
    const lower = Math.floor(rnd() * 1e6 * (rnd() < 0.3 ? 0 : 1)), modelled = Math.floor(rnd() * 1e5), s = shareOf({ lower, modelled });
    assert.ok(s.share.mid <= 0.2 * s.value.mid + 1e-9, `the share never passes 20 % (${lower}, ${modelled})`);
    assert.ok(s.keep >= FAIR.keepAtLeast * s.value.mid - 1e-9, `the agent keeps at least 80 % (${lower}, ${modelled})`);
    if (!lower && !modelled) assert.equal(s.share.mid, 0, 'no saving, no share');
  }
  assert.deepEqual(FAIR.rate, { lower: 0.2, modelled: 0.1, upper: 0 });
});
await proof('lower and upper follow the ledger\'s own rule for the same answer (tokensOfBytes, measured ratios)', () => {
  const r = receiptOf([{ k: 'md', html: 100_000, md: 20_000, text: 30_000 }]);
  assert.equal(r.tokens.upper, tokensOfBytes('html', 100_000) - tokensOfBytes('md', 20_000));
  assert.equal(r.tokens.lower, Math.max(0, tokensOfBytes('text', 30_000) - tokensOfBytes('md', 20_000)));
  const rd = receiptOf([{ k: 'read', html: 90_000, md: 9_000, text: null }]); assert.equal(rd.tokens.lower, 0, 'no plain text taken, no lower saving'); assert.equal(rd.tokens.upper, tokensOfBytes('html', 90_000, 'chars') - tokensOfBytes('md', 9_000, 'chars'));
});
await proof('modelled is calibrated on the bench: the cheapest search loop and the bytes per token of the brain\'s answers come from the runs on /proof; no run, no modelled saving', () => {
  const runs = [loadBench(), loadLean()].filter(Boolean);
  assert.equal(BENCH.loopLow, Math.min(...runs.map((d) => d.summary.finding.o200k_base.low)));
  const ratio = (d) => { let b = 0, t = 0; for (const x of d.tasks) for (const a of [x.brain, x.brainCompact]) if (a?.bytes > 0 && a?.tokens?.o200k_base > 0) { b += a.bytes; t += a.tokens.o200k_base; } return b / t; };
  assert.equal(BENCH.jsonBytesPerToken, Math.round(Math.min(...runs.map(ratio)) * 100) / 100);
  // the whole task as /proof shows it: with the sea its short answer and the Markdown, without it the plain-text range
  // (the low end conservative) and raw HTML as the upper bound; the sea's own earlier full answer is no "without"
  const pj = proofJson('', loadBench(), null, loadLean()), wt = pj.headline.wholeTask;
  assert.equal(BENCH.whole.with, pj.lean.after.wholeCompact); assert.deepEqual(BENCH.whole.withoutText, wt.withoutText); assert.deepEqual(BENCH.whole.withoutHtml, wt.withoutHtml); assert.equal(BENCH.whole.tasks, wt.tasks);
  assert.notEqual(BENCH.whole.with, wt.sea, 'the earlier full answer of the sea is never the bench\'s "with"'); assert.ok(BENCH.whole.with < BENCH.whole.withoutText[0]);
  assert.equal(BENCH.whole.saving, BENCH.whole.withoutText[0] - BENCH.whole.with); assert.equal(BENCH.label, `bench /proof, ${loadBench().date.split('-').reverse().join('.')}`);
  assert.equal(baselineOf('path'), Math.min(SAVE.per.path.tokens[0], BENCH.loopLow, BENCH.whole.saving)); assert.equal(baselineOf('plan'), SAVE.per.plan.tokens[0]); assert.equal(baselineOf('market'), SAVE.per.market.tokens[0]);
  assert.equal(calibrate(null, null), null); assert.equal(calibrate(loadBench(), null).whole, null, 'no measured short answer, no whole-task figure'); assert.equal(baselineOf('path', null), 0); assert.equal(receiptOf([{ k: 'path', n: 1 }], { answerBytes: 10, cal: null }).tokens.modelled, 0);
});
await proof('no saving, no share: an answer that costs more than the search it spares bills nothing; a short one bills 10 % of the difference', () => {
  const full = receiptOf([{ k: 'path', n: 1 }], { answerBytes: 12_770, answerType: 'application/json; charset=utf-8' });
  assert.equal(full.tokens.modelled, 0); assert.equal(full.shareMicro.mid, 0); assert.equal(full.modelled.answer, Math.ceil(12_770 / BENCH.jsonBytesPerToken));
  const short = receiptOf([{ k: 'path', n: 1 }], { answerBytes: 1_011, answerType: 'application/json' });
  assert.equal(short.tokens.modelled, baselineOf('path') - Math.ceil(1_011 / BENCH.jsonBytesPerToken)); assert.equal(short.shareMicro.mid, Math.floor(short.tokens.modelled * 0.1 * 2));
  assert.equal(answerTokensOf(3590, 'text/markdown'), Math.ceil(3590 / 3.59) === answerTokensOf(3590, 'text/markdown') ? answerTokensOf(3590, 'text/markdown') : -1);
  const withField = receiptOf([{ k: 'plan', n: 1 }], { answerBytes: 600, field: true }); assert.equal(withField.modelled.answer, Math.ceil((600 + FAIR.fieldBytes) / BENCH.jsonBytesPerToken), 'the receipt field counts against the saving it reports');
});

console.log('receipts on the answers the ledger counts');
await proof('a Markdown answer the ledger counts names its receipt in three headers; the receipt holds the same numbers the ledger counted', async () => {
  const before = await today();
  const r = await call('/about', { accept: MD }); assert.equal(r.status, 200); assert.match(r.h.get('content-type'), /markdown/);
  for (const k of SEA_HDR) assert.ok(r.h.get(k), k);
  assert.match(r.h.get('x-sea-receipt'), /^https:\/\/mare\.test\/fair\/r\/r\d{8}[a-z0-9]{8}$/); assert.match(r.h.get('x-sea-fair-share-usd'), /^\d+\.\d{6}$/);
  assert.match(r.h.get('access-control-expose-headers'), /x-sea-receipt/);
  const after = await today(), d = (k) => (after[k] || 0) - (before[k] || 0);
  assert.equal(d('md'), 1);
  const rc = (await call(`/fair/r/${idOf(r)}.json`)).j;
  assert.equal(rc.tokens.upper, tokensOfBytes('html', d('mdHtml')) - tokensOfBytes('md', d('mdOut')), 'upper = what /savings counted against raw HTML');
  assert.equal(rc.tokens.lower, d('mdTextTok'), 'lower = what /savings counted against plain text');
  assert.equal(String(rc.tokens.conservative), r.h.get('x-sea-saved-tokens')); assert.equal(rc.fair_share_usd.mid, r.h.get('x-sea-fair-share-usd'));
  const page = await call(`/fair/r/${idOf(r)}`, { accept: 'text/html' }); assert.equal(page.status, 200); assert.match(page.text, /Receipt of one answer/); assert.match(page.text, /noindex/);
});
await proof('no receipt for the sea\'s own calls, for crawlers, or for an answer already counted today (once a day per network and page)', async () => {
  const before = await today();
  noReceipt(await call('/about', { accept: MD, ua: 'MareLiberum-session/1.0' }), 'own call');
  noReceipt(await call('/about.md', { ua: 'Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)' }), 'training crawler');
  noReceipt(await call('/brain/thinking.json?q=write%20a%20market%20research%20report%20on%20e-bikes', { ua: 'Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)' }), 'crawler on a plan');
  noReceipt(await call('/about', { accept: MD, ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)' }), 'ClaudeBot');
  const mid = await today(); assert.equal((mid.md || 0) - (before.md || 0), 0, 'the ledger counted none of them either'); assert.equal((mid.plan || 0) - (before.plan || 0), 0);
  const first = await call('/manifesto', { accept: MD, ip: '198.19.7.7' }), again = await call('/manifesto', { accept: MD, ip: '198.19.7.7' });
  assert.ok(first.h.get('x-sea-receipt'), 'the first answer of the day counts'); noReceipt(again, 'the same network, page and day');
  const end = await today(); assert.equal((end.md || 0) - (mid.md || 0), 1, 'and the ledger counted it once');
});
await proof('a JSON answer that is an object carries "receipt" as its last field; nothing else in it changes', async () => {
  const q = '/brain/thinking.json?q=write%20a%20market%20research%20report%20on%20e-bikes';
  const on = await call(q), off = await call(q, { cfg: OFF });
  assert.ok(on.j.receipt, 'the field'); assert.deepEqual(Object.keys(on.j.receipt), ['id', 'saved_tokens', 'fair_share_usd', 'voluntary', 'url']); assert.equal(on.j.receipt.url, on.h.get('x-sea-receipt'));
  assert.equal(Object.keys(on.j).pop(), 'receipt');
  assert.equal(on.text, withField(off.text, 'receipt', on.j.receipt), 'the answer with fair share off, plus the field: byte for byte');
  noReceipt(off, 'fair share off');
  const rc = (await call(`/fair/r/${on.j.receipt.id}.json`)).j; assert.equal(rc.counted.reuses.plan, 1); assert.equal(rc.tokens.modelled, Math.max(0, baselineOf('plan') - Math.ceil((Buffer.byteLength(off.text) + FAIR.fieldBytes) / BENCH.jsonBytesPerToken)));
});
await proof('the brain hands over a confirmed pathway: the receipt counts it net of the answer that carried it (the short answer spares more)', async () => {
  await call('/brain/areas.json'); const q = 'compare usdc price apis for a trading bot';
  await sea().layPath({ q, to: 'https://docs.example.org/usdc', title: 'USDC prices' }, { ip: '198.18.200.1' });
  const id = (await sea().findPaths(q, 1))[0].id; await sea().rate(id, { worked: 1 }, { ip: '198.18.200.2' });
  const full = await call(`/brain?q=${encodeURIComponent(q)}`), short = await call(`/brain?q=${encodeURIComponent(q)}&fmt=compact`);
  for (const r of [full, short]) {
    const rc = (await call(`/fair/r/${r.j.receipt.id}.json`)).j; assert.equal(rc.counted.reuses.path, 1);
    // the answer as it was made: this one without the field (the field went in after its last member; a newline before the
    // closing brace, if there was one, was taken out with it)
    const body = Buffer.byteLength(r.text) - Buffer.byteLength(JSON.stringify(r.j.receipt)) - Buffer.byteLength(',\n"receipt":');
    assert.ok([body, body + 1].some((b) => rc.modelled.answer === Math.ceil((b + FAIR.fieldBytes) / BENCH.jsonBytesPerToken)), `answer tokens ${rc.modelled.answer} from ${body} bytes`);
    assert.equal(rc.tokens.modelled, Math.max(0, rc.modelled.baseline - rc.modelled.answer));
    assert.equal(rc.fair_share_usd.mid, usd6(Math.floor(rc.tokens.modelled * 0.1 * 2)));
  }
  assert.ok(Number(short.j.receipt.saved_tokens) > Number(full.j.receipt.saved_tokens), 'the short answer spares more');
});
await proof('MCP and A2A answers carry the headers only: the JSON-RPC envelope gets no member it did not have', async () => {
  const q = 'write a fact check of a claim about vitamin d';
  const m = await call('/mcp', { method: 'POST', accept: 'application/json, text/event-stream', body: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'think', arguments: { q } } } });
  assert.equal(m.status, 200); assert.ok(m.h.get('x-sea-receipt'), 'the MCP answer names its receipt'); assert.deepEqual(Object.keys(m.j).sort(), ['id', 'jsonrpc', 'result']);
  const a = await call('/a2a', { method: 'POST', body: { jsonrpc: '2.0', id: 2, method: 'message/send', params: { message: { role: 'user', parts: [{ kind: 'data', data: { skill: 'think', q: 'write a fact check of a claim about omega 3' } }], messageId: 'm1' } } } });
  assert.equal(a.status, 200); assert.ok(!('receipt' in (a.j || {})), 'no field in the A2A envelope');
});
await proof('the app door /mcp/app answers byte for byte the same with fair share on and off, and carries no receipt', async () => {
  const calls = [['initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'proof', version: '1' } }], ['tools/list', {}], ['tools/call', { name: 'think', arguments: { q: 'write a fact check of a claim about magnesium' } }], ['tools/call', { name: 'read_page', arguments: { url: 'https://example.org/' } }]];
  for (const [method, params] of calls) {
    const ip = `198.20.1.${ipN++ & 255}`, msg = { jsonrpc: '2.0', id: 1, method, params };
    const on = await call('/mcp/app', { method: 'POST', accept: 'application/json, text/event-stream', body: msg, ip });
    const off = await call('/mcp/app', { method: 'POST', accept: 'application/json, text/event-stream', body: msg, ip: `198.21.1.${ipN++ & 255}`, cfg: OFF });
    noReceipt(on, `/mcp/app ${method}`); assert.equal(on.status, off.status);
    if (method !== 'tools/call') assert.equal(on.text, off.text, `${method} byte for byte`);
    assert.deepEqual([...on.h.keys()].sort(), [...off.h.keys()].sort(), `${method}: the same headers`);
  }
});

console.log('off by default');
await proof('nothing set, nothing changes: no headers, no field, the same answer object; /fair/pay rests; /.well-known/x402 lists only /route', async () => {
  assert.equal(fairSwitch({}, {}), false); assert.equal(fairSwitch({}, { MARE_FAIR: 'on' }), true); assert.equal(fairSwitch({ fair: 'off' }, { MARE_FAIR: 'on' }), false);
  noReceipt(await call('/about', { accept: MD, cfg: OFF }), 'off: Markdown'); noReceipt(await call('/brain/thinking.json?q=fact%20check%20a%20claim%20about%20zinc', { cfg: OFF }), 'off: JSON');
  const res = new Response('{"a":1}', { headers: { 'content-type': 'application/json' } });
  assert.equal(await sealFair(res, [], { path: '/x', base: BASE, fair: fairL() }), res, 'nothing counted: the very same answer object');
  const p = await call('/fair/pay?r=r20261125aaaaaaaa', { method: 'POST', cfg: OFF }); assert.equal(p.status, 503); assert.match(p.j.error.message, /nothing is charged/);
  assert.deepEqual((await call('/.well-known/x402', { cfg: OFF })).j.resources, [`${BASE}/route`]); assert.equal((await call('/.well-known/x402', { cfg: OFF })).j.fair, undefined);
  assert.deepEqual((await call('/.well-known/x402')).j.resources, [`${BASE}/route`, `${BASE}/fair/pay`]);
  assert.equal((await call('/fair.json', { cfg: OFF })).j.on, false);
});
await proof('the rest switch "fair" pauses receipts and settlement without a release; the rest of the sea answers as always', async () => {
  immune.set({ mode: 'normal', rest: ['fair'] });
  try {
    const r = await call('/about', { accept: MD }); assert.equal(r.status, 200); noReceipt(r, 'resting');
    assert.equal((await call('/fair/pay?r=r20261125aaaaaaaa', { method: 'POST' })).status, 503);
  } finally { immune.set({ mode: 'normal', rest: [] }); }
  assert.ok((await call('/about', { accept: MD })).h.get('x-sea-receipt'), 'awake again');
});

console.log('settlement: x402 for the exact unpaid sum');
const NOTES3 = [{ k: 'path', n: 1 }, { k: 'plan', n: 1 }, { k: 'market', n: 1 }], PER = receiptOf(NOTES3, { answerBytes: 300, answerType: 'application/json' }).shareMicro.mid, ENOUGH = Math.ceil(FAIR.minMicro / PER) + 1;
const made = (k = ENOUGH) => Array.from({ length: k }, () => fairL().make(NOTES3, { answerBytes: 300, answerType: 'application/json', door: '/brain' }));
await proof('the 402 asks for exactly the unpaid sum, in both shapes of x402, to the till\'s wallet on Base', async () => {
  const rs = made(), sum = rs.reduce((s, r) => s + r.shareMicro.mid, 0); assert.ok(sum >= FAIR.minMicro, `${sum}`);
  const r = await call(`/fair/pay?r=${rs.map((x) => x.id).join(',')}`, { method: 'POST' }); assert.equal(r.status, 402);
  const v2t = JSON.parse(Buffer.from(r.h.get('payment-required'), 'base64').toString());
  assert.equal(v2t.accepts[0].amount, String(sum)); assert.equal(v2t.accepts[0].payTo, PAY.payTo); assert.equal(v2t.accepts[0].network, 'eip155:8453'); assert.equal(v2t.accepts[0].asset, USDC_BASE);
  assert.equal(r.j.accepts[0].maxAmountRequired, String(sum)); assert.equal(r.j.amount_usd, usd6(sum)); assert.equal(JSON.parse(r.h.get('x402-payment-required')).amount_usd, usd6(sum));
  assert.deepEqual(r.j.receipts.map((x) => x.id), rs.map((x) => x.id)); assert.match(r.j.voluntary, /Nothing is withheld/);
});
await proof('schema-valid x402 v2, as the till: the 402 of /fair/pay (with receipts, and for a catalog that names none) and every resource of /.well-known/x402 answers an unpaid probe with a valid challenge', async () => {
  const rs = made(), r = await call(`/fair/pay?r=${rs.map((x) => x.id).join(',')}`, { method: 'POST' }); assert.equal(r.status, 402); const c = x402Valid(r.h, '/fair/pay with receipts');
  assert.equal(c.accepts[0].amount, String(rs.reduce((s2, x) => s2 + x.shareMicro.mid, 0))); assert.equal(r.j.accepts[0].outputSchema.input.method, 'POST'); assert.equal(r.j.accepts[0].outputSchema.input.discoverable, true);
  const probe = await call('/fair/pay', { method: 'POST' }); assert.equal(probe.status, 402, 'a catalog that names no receipt meets the 402, not a 400'); const pc = x402Valid(probe.h, '/fair/pay probe');
  assert.equal(pc.accepts[0].amount, String(FAIR.minMicro)); assert.equal(pc.resource.url, `${BASE}/fair/pay`); assert.match(pc.resource.description, /without receipts nothing is due/);
  const wk = (await call('/.well-known/x402')).j; assert.equal(wk.version, 1); assert.deepEqual(wk.resources, [`${BASE}/route`, `${BASE}/fair/pay`]);
  for (const u of wk.resources) { const pr = await call(u.slice(BASE.length), { method: 'POST' }); assert.equal(pr.status, 402, u); x402Valid(pr.h, u); }
});
await proof('a payment that names no receipt settles nothing: refused before any facilitator is asked, no sale, nothing charged', async () => {
  asked.length = 0; const n0 = ledger.mem.sales.length; facilitator = () => { throw new Error('must not be asked'); };
  const r = await call('/fair/pay', { method: 'POST', headers: { 'payment-signature': v2(FAIR.minMicro) } });
  assert.equal(r.status, 400); assert.match(r.j.error.message, /Nothing was charged/); assert.equal(asked.length, 0); assert.equal(ledger.mem.sales.length, n0);
});
await proof('below 0.05 USDC it asks for nothing: the open sum and about how many receipts are still missing; nothing due and unknown receipts are named; at most 500 in one payment', async () => {
  assert.equal(FAIR.minMicro, 50_000); const one = made(1)[0], r = await call(`/fair/pay?r=${one.id}`, { method: 'POST' });
  assert.equal(r.status, 200); assert.equal(r.h.get('payment-required'), null, 'no 402 below the minimum'); assert.equal(r.j.payable, false); assert.equal(r.j.reason, 'below the minimum'); assert.equal(r.j.open_usd, usd6(one.shareMicro.mid)); assert.equal(r.j.minimum_usd, '0.050000');
  assert.equal(r.j.receipts_missing, Math.ceil((FAIR.minMicro - one.shareMicro.mid) / one.shareMicro.mid)); assert.match(r.j.bundle, /pay them together/); assert.match(r.j.bundle, /docs\.payai\.network/);
  const zero = fairL().make([{ k: 'md', html: 50_000, md: 9_000, text: 4_000 }], { door: '/about' });
  const z = await call(`/fair/pay?r=${zero.id},r20250101zzzzzzzz`, { method: 'POST' }); assert.equal(z.j.payable, false); assert.deepEqual(z.j.nothing_due, [zero.id]); assert.deepEqual(z.j.unknown, ['r20250101zzzzzzzz']);
  assert.equal((await call('/fair/pay?r=r20250101zzzzzzzz', { method: 'POST' })).status, 404);
  assert.equal((await call('/fair/pay', { method: 'POST', body: { r: Array.from({ length: 501 }, (_, i) => `r20261125${String(i).padStart(8, 'a')}`) } })).status, 400);
  const big = made(ENOUGH), viaBody = await call('/fair/pay', { method: 'POST', body: { r: big.map((x) => x.id) } }); assert.equal(viaBody.status, 402, 'receipts in the body work too');
});
let paidSet = null, paidSum = 0;
await proof('paid through the till: verified and settled on Base; the sale is in the ledger as fair-x402-v2 with its exact amount; /fair shows it settled on chain', async () => {
  const rs = made(), sum = rs.reduce((s, r) => s + r.shareMicro.mid, 0); asked.length = 0;
  facilitator = (kind) => answer(kind === 'verify' ? { isValid: true, payer: '0x2222222222222222222222222222222222222222' } : { success: true, transaction: TX, network: 'eip155:8453', payer: '0x2222222222222222222222222222222222222222' });
  const before = (await call('/fair.json')).j.live;
  const r = await call(`/fair/pay?r=${rs.map((x) => x.id).join(',')}`, { method: 'POST', headers: { 'payment-signature': v2(sum) } });
  assert.equal(r.status, 200, r.text); assert.equal(r.j.paid.status, 'settled'); assert.equal(r.j.paid.amount_usd, usd6(sum)); assert.equal(r.j.paid.tx, TX); assert.ok(r.h.get('payment-response'));
  assert.deepEqual(asked.map((a) => a.kind), ['verify', 'settle']); assert.equal(asked[0].body.paymentRequirements.amount, String(sum));
  const sale = ledger.mem.sales[0]; assert.equal(sale.method, 'fair-x402-v2'); assert.equal(sale.amount_micro, sum); assert.equal(sale.kind, 'fair'); assert.equal(sale.amount_cents, Math.round(sum / 1e4)); assert.equal(sale.status, 'settled');
  const after = (await call('/fair.json')).j.live; assert.equal(Number(after.fairShareSettledOnChainUsd) - Number(before.fairShareSettledOnChainUsd), Number(usd6(sum)));
  assert.match((await call(`/fair/r/${rs[0].id}.json`)).j.status, /^retired: paid and settled on chain/); assert.equal((await call(`/fair/r/${rs[0].id}.json`)).j.pay, undefined);
  paidSet = rs; paidSum = sum;
});
await proof('a paid receipt is never billed twice: asked again, nothing is due; bundled with unpaid ones, only those are asked for', async () => {
  const again = await call(`/fair/pay?r=${paidSet.map((x) => x.id).join(',')}`, { method: 'POST', headers: { 'payment-signature': v2(paidSum) } });
  assert.equal(again.status, 200); assert.equal(again.j.payable, false); assert.equal(again.j.already_paid.length, paidSet.length);
  const fresh = made(), sum = fresh.reduce((s, r) => s + r.shareMicro.mid, 0);
  const mix = await call(`/fair/pay?r=${[paidSet[0].id, ...fresh.map((x) => x.id)].join(',')}`, { method: 'POST' });
  assert.equal(mix.status, 402); assert.equal(mix.j.accepts[0].maxAmountRequired, String(sum)); assert.deepEqual(mix.j.receipts.map((x) => x.id), fresh.map((x) => x.id));
});
await proof('the books: every settled payment is booked once with time, amount, rate source and transaction; no public view shows the paying wallet or the transaction', async () => {
  const books = await fairL().books(), b = books.find((x) => x.sale === ledger.mem.sales.find((s2) => s2.amount_micro === paidSum && s2.status === 'settled')?.id);
  assert.ok(b, 'booked'); assert.ok(b.booked && b.settled_at); assert.equal(b.amount_micro, paidSum); assert.equal(b.amount, usd6(paidSum)); assert.equal(b.asset, 'USDC'); assert.equal(b.tx, TX); assert.match(b.rate.source, /ECB euro foreign exchange reference rate/); assert.match(b.rate.day, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(books.filter((x) => x.sale === b.sale).length, 1, 'once'); await fairL().payments(ledger); assert.equal((await fairL().books()).filter((x) => x.sale === b.sale).length, 1, 'still once after the payments are read again');
  for (const u of ['/fair', '/fair.json', '/fair.md', `/fair/r/${paidSet[0].id}`, `/fair/r/${paidSet[0].id}.json`]) { const t = (await call(u, { accept: u.endsWith('.json') ? JSONA : 'text/html' })).text; assert.ok(!t.includes(TX) && !/0x2222222222/i.test(t), `${u} shows no transaction and no wallet`); }
});
await proof('a registry: a paid receipt is retired and never counted or billed twice — not in one bundle, not after the tide wrote it down; only a settlement that fails sets it free', async () => {
  const [a, b] = made(2), dup = await call(`/fair/pay?r=${a.id},${a.id},${b.id},${a.id.toUpperCase()}`, { method: 'POST' });
  assert.equal(dup.j.open_usd, usd6(a.shareMicro.mid + b.shareMicro.mid), 'a receipt named twice counts once');
  await fairL().flush(); const again = await call(`/fair/pay?r=${paidSet.map((x) => x.id).join(',')}`, { method: 'POST' }); assert.equal(again.j.payable, false); assert.equal(again.j.already_paid.length, paidSet.length, 'retired after the tide too');
  const t0 = (await call('/fair.json')).j.live.receipts; await fairL().flush(); assert.equal((await call('/fair.json')).j.live.receipts, t0, 'a receipt counts once in the totals');
  const rs = made(), sum = rs.reduce((s2, x) => s2 + x.shareMicro.mid, 0), ids = rs.map((x) => x.id).join(',');
  facilitator = (kind) => answer(kind === 'verify' ? { isValid: true, payer: '0x2222222222222222222222222222222222222222' } : { success: false, errorReason: 'insufficient_funds' });
  const r = await call(`/fair/pay?r=${ids}`, { method: 'POST', headers: { 'payment-signature': v2(sum) } }); assert.equal(r.j.paid.status, 'unsettled');
  assert.equal((await call(`/fair/pay?r=${ids}`, { method: 'POST' })).status, 402, 'a settlement that failed sets its receipts free again');
});
await proof('the till\'s own checks come first: a payment smaller than the sum, or to another wallet, is refused before any facilitator is asked', async () => {
  const rs = made(), sum = rs.reduce((s, r) => s + r.shareMicro.mid, 0), ids = rs.map((x) => x.id).join(','); asked.length = 0;
  const small = await call(`/fair/pay?r=${ids}`, { method: 'POST', headers: { 'payment-signature': v2(sum - 1) } }); assert.equal(small.status, 402); assert.match(small.j.error, /smaller than/);
  const other = await call(`/fair/pay?r=${ids}`, { method: 'POST', headers: { 'payment-signature': v2(sum, '0x' + '99'.repeat(20)) } }); assert.equal(other.status, 402); assert.match(other.j.error, /another wallet/);
  assert.equal(asked.length, 0); assert.equal((await call(`/fair/r/${rs[0].id}.json`)).j.status, 'due (voluntary)');
});
await proof('a payment the facilitator refuses changes nothing: 402 again with its reason, the receipts stay unpaid', async () => {
  const rs = made(), sum = rs.reduce((s, r) => s + r.shareMicro.mid, 0), n0 = ledger.mem.sales.length;
  facilitator = (kind) => answer(kind === 'verify' ? { isValid: false, invalidReason: 'invalid_exact_evm_signature' } : { success: false });
  const r = await call(`/fair/pay?r=${rs.map((x) => x.id).join(',')}`, { method: 'POST', headers: { 'payment-signature': v2(sum) } });
  assert.equal(r.status, 402); assert.match(r.j.error, /invalid_exact_evm_signature/); assert.equal(ledger.mem.sales.length, n0, 'no sale');
  assert.equal((await call(`/fair/pay?r=${rs.map((x) => x.id).join(',')}`, { method: 'POST' })).status, 402, 'still due');
});
await proof('the till\'s hard rule holds: the facilitator does not answer → taken as unverified, never billed again, and nothing counts as settled on chain', async () => {
  const rs = made(), sum = rs.reduce((s, r) => s + r.shareMicro.mid, 0), settled0 = (await call('/fair.json')).j.live.fairShareSettledOnChainUsd;
  facilitator = () => { throw new Error('facilitator down'); };
  const r = await call(`/fair/pay?r=${rs.map((x) => x.id).join(',')}`, { method: 'POST', headers: { 'payment-signature': v2(sum) } });
  assert.equal(r.status, 200); assert.equal(r.j.paid.status, 'unverified');
  const again = await call(`/fair/pay?r=${rs.map((x) => x.id).join(',')}`, { method: 'POST' }); assert.equal(again.j.payable, false, 'not billed twice');
  const live = (await call('/fair.json')).j.live; assert.equal(live.fairShareSettledOnChainUsd, settled0, 'zero stays zero: unverified is not on chain'); assert.ok(Number(live.paidOnItsWayUsd) >= Number(usd6(sum)));
});

console.log('the page, the data, the words');
await proof('/fair: the rule in one sentence, three bases and the rate card, the live ledger, the calculator labelled bench, how to pay, the links; the same as data and as Markdown', async () => {
  const h = await call('/fair', { accept: 'text/html' }); assert.equal(h.status, 200);
  for (const x of [FAIR.rule, '>lower<', '>modelled<', '>upper<', '0.10', '2.00', '8.00', 'Defaults from the', 'bench', '/fair/pay?r=', 'x-sea-receipt', 'href="/savings"', 'href="/proof"', 'href="/pricing"', 'href="/treasury"', 'id="fcalc"', 'fair share settled on chain', 'drops saved for others by pathways']) assert.ok(h.text.includes(x), x);
  assert.match(h.text, /data-zone=/, 'dressed in the skin of the sea'); assert.match(h.text, /<h1[^>]*>Fair share, in public<\/h1>/);
  const j = (await call('/fair.json')).j; assert.equal(j.rule, FAIR.rule); assert.equal(j.on, true); assert.equal(j.price.mid, 2); assert.equal(j.calculator.bench.label, BENCH.label); assert.equal(j.calculator.bench.saves, BENCH.whole.saves); assert.equal(j.calculator.bench.with, BENCH.whole.with); assert.deepEqual(j.calculator.bench.withoutText, BENCH.whole.withoutText);
  const fmt = (x) => x.toLocaleString('en-US'); for (const x of [BENCH.label, `${fmt(BENCH.whole.with)} tokens with the sea`, `${fmt(BENCH.whole.withoutText[0])}–${fmt(BENCH.whole.withoutText[1])} without it`, `${fmt(BENCH.whole.withoutHtml[0])}–${fmt(BENCH.whole.withoutHtml[1])}`, `value="${BENCH.whole.withoutText[0]}"`]) assert.ok(h.text.includes(x), x);
  const full = proofJson('', loadBench(), null, loadLean()).headline.wholeTask.sea; assert.ok(!h.text.includes(fmt(full)) && j.calculator.bench.with !== full, 'the earlier full answer is not shown as the bench');
  for (const k of ['receipts', 'tokens', 'valueCreatedUsd', 'fairShareAccruedUsd', 'fairShareSettledOnChainUsd', 'drops']) assert.ok(k in j.live, k);
  assert.ok(j.live.receipts >= 10); assert.equal(j.links.treasury, `${BASE}/treasury`);
  const md = await call('/fair.md'); assert.match(md.h.get('content-type'), /markdown/); assert.match(md.text, /^# Fair share/);
});
await proof('public words call the drop a unit of account, never a coin, a currency, a token sale or an investment; a receipt holds no address and no caller hash', async () => {
  const h = (await call('/fair', { accept: 'text/html' })).text, j = (await call('/fair.json')).text, line = SITE['/llms.txt'].body.split('\n').filter((l) => /\/fair/.test(l)).join('\n');
  for (const [what, t] of [['/fair', h], ['/fair.json', j], ['llms.txt', line]]) assert.doesNotMatch(t, FORBIDDEN, what);
  assert.match(h, /unit of account/); assert.match(j, /unit of account/);
  const r = await call('/about', { accept: MD, ip: '198.51.100.77' }), rc = (await call(`/fair/r/${idOf(r)}.json`)).text;
  assert.doesNotMatch(rc, /198\.51\.100\.77|ua_hash|agent_ua_hash|"ip"|"payer"/); assert.doesNotMatch(rc, FORBIDDEN);
});
await proof('every modelled dollar figure says what it is (on /fair, /fair.json, /fair.md and every receipt); the method is published with its rule version; the share is voluntary everywhere', async () => {
  const note = FAIR.usdNote; assert.equal(note, 'modelled value for information — not a price, not redeemable, not transferable');
  const h = (await call('/fair', { accept: 'text/html' })).text, md = (await call('/fair.md')).text, j = (await call('/fair.json')).j;
  for (const [what, t] of [['/fair', h], ['/fair.md', md]]) { assert.ok(t.split(note).length - 1 >= 4, `${what}: the note beside the hero, the ledger, the calculator and the receipts`); assert.match(t, /voluntary/i); }
  assert.equal(j.live.usdNote, note); assert.equal(j.live.valueCreatedUsd.note, note); assert.match(j.live.fairShareAccruedNote, /voluntary/); assert.ok(j.live.fairShareAccruedNote.includes(note)); assert.equal(j.calculator.usdNote, note); assert.ok(j.recent.every((x) => x.shareNote === note));
  assert.match(j.live.fairShareSettledNote, /actually received/, 'money received is no modelled value, and says so');
  const r = await call('/about', { accept: MD, ip: '198.51.100.91' }), rc = (await call(`/fair/r/${idOf(r)}.json`)).j, rp = (await call(`/fair/r/${idOf(r)}`, { accept: 'text/html' })).text;
  for (const k of ['value_usd', 'fair_share_usd', 'you_keep']) assert.equal(rc[k].note, note, k); assert.equal(rc.fair_share_usd.voluntary, true); assert.ok(rp.includes(note)); assert.match(rp, /voluntary/);
  const field = (await call('/brain/thinking.json?q=write%20a%20market%20research%20report%20on%20e-bikes')).j.receipt; assert.equal(field.voluntary, true);
  assert.equal(j.method.version, 'fair-1'); assert.deepEqual(Object.keys(METHOD).filter((k) => !['version', 'since'].includes(k)), ['bases', 'valuation', 'share', 'conservative', 'registry', 'drops']); assert.match(h, /id="method"/); assert.match(h, /The method, rule fair-1/); assert.equal(rc.method.version, 'fair-1');
});
await proof('drops live on the server only: no route exports, moves or transfers them, and no public word speaks of converting them or of a coin', async () => {
  assert.match(FAIR.drops, /server only: no export, no transfer, no copy on any chain/);
  for (const [m, u] of [['POST', '/fair/drops'], ['GET', '/fair/drops'], ['POST', '/fair/transfer'], ['GET', '/fair/export'], ['POST', '/fair/r/r20261125aaaaaaaa']]) assert.ok([404, 405].includes((await call(u, { method: m })).status), `${m} ${u}`);
  const j = (await call('/fair.json')).text; assert.doesNotMatch(j, /"(transfer|export|withdraw|redeem)[a-z_]*"\s*:/i, 'no field that moves drops');
});
await proof('kept by the tide: receipts written into their day and read back the same; totals add up across the flush', async () => {
  const t0 = (await call('/fair.json')).j.live, r = made(1)[0];
  assert.ok(await fairL().flush() >= 1); assert.equal(fairL().state().waiting, 0);
  const back = await fairL().get(r.id); assert.deepEqual(back, r); const day = await kv.get(`fair:d:${r.at.slice(0, 10)}`); assert.ok(day[r.id]);
  const t1 = (await call('/fair.json')).j.live; assert.equal(t1.receipts, t0.receipts + 1); assert.equal((await call('/fair/r/r20250101zzzzzzzz.json')).status, 404);
});
await proof('llms.txt, the hub sitemap and package.json carry fair share', async () => {
  const l = SITE['/llms.txt'].body; for (const x of ['https://mareliberum.dev/fair', 'POST /fair/pay?r=<id>', 'x-sea-receipt', 'you keep at least 80 %']) assert.ok(l.includes(x), x);
  assert.ok(HUB_PATHS.includes('/fair')); const sm = await call('/sitemaps/hubs.xml'); assert.ok(sm.text.includes(`${BASE}/fair<`));
  assert.equal(JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).scripts['proof:fair'], 'node tools/fair-proof.mjs');
});

rmSync(dir, { recursive: true, force: true });
console.log(`\n${passed} proofs held, ${failed} failed`);

// ------------------------------------------------------------------ negative controls: break one rule in a copy, the proof must fail there
// Each control copies the code, changes one line so that one rule no longer holds, and runs this proof in the copy with
// --no-controls. A control is caught when that run fails. The working tree is never touched.
const BREAK = [
  ['the agent keeps 80 %: the lower share raised to 30 %', 'node/fair.mjs', 'rate: { lower: 0.2, modelled: 0.1, upper: 0 }', 'rate: { lower: 0.3, modelled: 0.1, upper: 0 }'],
  ['the upper basis billed', 'node/fair.mjs', 'const s = shareOf({ lower, modelled });', 'const s = shareOf({ lower: lower + Math.floor(upper / 4), modelled });'],
  ['own calls and crawlers counted for Markdown', 'node/core.mjs', "const who0 = callerOf(req.headers), counts = who0.kind !== 'self' && !['ai-crawler', 'crawler', 'search', 'search-ai'].includes(who0.kind);", 'const who0 = callerOf(req.headers), counts = true;'],
  // the ledger guards crawlers twice (once a day, and the count itself): both are taken out
  ['crawlers counted for plans (readOnly let through)', 'node/areas.mjs', 'const firstToday = (ctx, kind, subject, group) => !ctx?.own && !ctx?.readOnly && !ctx?.uncounted &&', 'const firstToday = (ctx, kind, subject, group) => !ctx?.own && !ctx?.uncounted &&',
    'if (ctx?.own || ctx?.readOnly || ctx?.uncounted || !(n > 0)) return;', 'if (ctx?.own || ctx?.uncounted || !(n > 0)) return;'],
  ['a receipt on the app door', 'node/fair.mjs', "res.status !== 200 || APP_DOOR.test(path)) return res;", 'res.status !== 200) return res;'],
  ['the 402 asks for one millionth more than is due', 'node/fair.mjs', 'const t = fairTerms(payCfg, { base, ids: due.map((r) => r.id), micro })', 'const t = fairTerms(payCfg, { base, ids: due.map((r) => r.id), micro: micro + 1 })'],
  ['a paid receipt billed again', 'node/fair.mjs', 'const due = found.filter((r) => r.shareMicro.mid > 0 && !paid.has(r.id));', 'const due = found.filter((r) => r.shareMicro.mid > 0);'],
  ['on by default', 'node/core.mjs', "const fairOn = (cfg) => fairSwitch(cfg) && !immune.atRest?.('fair');", "const fairOn = (cfg) => !immune.atRest?.('fair');"],
  ['the answer not counted against the saving', 'node/fair.mjs', 'const modelled = baseline > 0 ? Math.max(0, baseline - answer) : 0;', 'const modelled = baseline > 0 ? baseline : 0;'],
  ['the sea\'s earlier full answer taken as the bench\'s "with"', 'node/fair.mjs', 'withSea = pj.lean?.after?.wholeCompact;', 'withSea = wt.sea;'],
  ['the 402 of /fair/pay without the bazaar extension (catalogs could not read it)', 'node/fair.mjs', 'accepts: [t.v2], extensions: { bazaar: fairBazaar() } };', 'accepts: [t.v2] };'],
  ['a receipt named twice in one bundle counted twice', 'node/fair.mjs', 'const want = [...new Set((ids || []).map((x) => String(x).trim().toLowerCase()).filter(Boolean))];', 'const want = (ids || []).map((x) => String(x).trim().toLowerCase()).filter(Boolean);'],
  ['a settled payment booked without its transaction', 'node/fair.mjs', "tx: sale.tx || p.tx || null, payer:", 'tx: null, payer:'],
  ['a receipt\'s value without the note that it is no price', 'node/fair.mjs', "USD 0.10, 2 and 8 per million input tokens', note: FAIR.usdNote },", "USD 0.10, 2 and 8 per million input tokens' },"],
];
let caught = 0;
if (CONTROLS) {
  console.log('\nnegative controls: each rule broken in a copy, the proof must fail there');
  for (const [what, f, ...pairs] of BREAK) {
    const tmp = mkdtempSync(join(tmpdir(), 'mare-fair-ctl-'));
    try {
      for (const d of ['node', 'site', 'proof', 'public/film']) if (existsSync(join(ROOT, d))) { mkdirSync(dirname(join(tmp, d)), { recursive: true }); cpSync(join(ROOT, d), join(tmp, d), { recursive: true }); }
      mkdirSync(join(tmp, 'tools'), { recursive: true }); cpSync(join(ROOT, 'tools/fair-proof.mjs'), join(tmp, 'tools/fair-proof.mjs')); cpSync(join(ROOT, 'package.json'), join(tmp, 'package.json'));
      let src = readFileSync(join(tmp, f), 'utf8'), gone = false;
      for (let i = 0; i < pairs.length; i += 2) { if (!src.includes(pairs[i])) gone = true; src = src.replace(pairs[i], pairs[i + 1]); }
      if (gone) { console.log(`  FAIL control "${what}": the line to break is gone from ${f}; the control needs updating`); continue; }
      writeFileSync(join(tmp, f), src);
      const run = spawnSync(process.execPath, ['tools/fair-proof.mjs', '--no-controls'], { cwd: tmp, encoding: 'utf8', timeout: 240_000 });
      const held = /(\d+) proofs held, (\d+) failed/.exec(run.stdout || '');
      if (run.status !== 0 && held && Number(held[2]) > 0) { caught++; console.log(`  ok   caught: ${what} (${held[2]} ${held[2] === '1' ? 'proof' : 'proofs'} failed)`); }
      else console.log(`  FAIL not caught: ${what} (exit ${run.status}${held ? `, ${held[0]}` : ''}${run.stderr ? `; ${String(run.stderr).split('\n')[0].slice(0, 160)}` : ''})`);
    } finally { rmSync(tmp, { recursive: true, force: true }); }
  }
  console.log(`${caught} of ${BREAK.length} controls caught`);
}
process.exit(failed || (CONTROLS && caught !== BREAK.length) ? 1 : 0);
