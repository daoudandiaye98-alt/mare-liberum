// Mare Liberum · proof of the press (3.35, the engine room's text levers): squeeze (node/squeeze.mjs, POST /compress) and the
// reader's delta and budget (node/press.mjs, /r/?since=, If-None-Match, ?budget=).
// It proves: the lossless steps lose no fact (every number and every link of the input is still there; JSON parses back to
// the same value); a question and a budget keep the answer on fixtures with a known answer; the budget is kept (measured
// the engine room's one way); /compress refuses above 1 MB (413), an empty body (400), JSON nested too deep (400), a flood
// (429), and keeps nothing of what was sent (every write path watched: the kv, the ledger, the console, the count, the
// versions); the reader's ETag is stable while the page is, 304 on a match, since= unchanged / changed / unknown; every
// default answer is byte for byte what it is with the engine off (the code of 3.34.1); the rest switch; no count for the
// sea's own calls, crawlers or HEAD, the house agent apart. Negative controls: each check, fed a broken part, must fail.
// Also prints before/after tokens of the sea's own pages (in process).
// Runs without the network: node tools/squeeze-proof.mjs  (exit code 1 when a proof or a negative control fails)
// With --web it reads a few public pages through the reader instead (network, robots.txt followed, one call a second)
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { handle } from '../node/core.mjs';
import { createMem } from '../node/mem.mjs';
import { memoryKv } from '../node/flow.mjs';
import { createLedger } from '../node/ledger.mjs';
import { payConfig } from '../node/pay.mjs';
import { setViaKey } from '../node/via.mjs';
import { immune } from '../node/immune.mjs';
import { leanMarkdown, cleanUrl } from '../node/lean.mjs';
import { squeeze, fitBudget, focusOn, diffLines, detectType, jsonDepth, toonHook, toonReady, SQUEEZE, TOON_MIN_GAIN } from '../node/squeeze.mjs';
import { createVersions, sinceOf, readerParams, counter } from '../node/press.mjs';
import { tokensOf, bytesOf } from '../node/engine.mjs';

const WEB = process.argv.includes('--web');
delete process.env.MARE_ENGINE;
let passed = 0, failed = 0, negOk = 0, negBad = 0;
const proof = async (name, fn) => { try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 6).join('\n       ')}`); } };
// a negative control: the check, fed a broken part, must fail
const negative = async (name, fn) => { let threw = false; try { await fn(); } catch { threw = true; } if (threw) { negOk++; console.log(`  ok   negative control fails as it must: ${name}`); } else { negBad++; console.log(`  FAIL negative control did not fail: ${name}`); } };

// ---------------------------------------------------------------- fixtures
const fx = (f) => readFileSync(new URL(`./fixtures/lean/${f}`, import.meta.url), 'utf8');
const SHOP = fx('shop.html'), DOC = fx('article.html'), PLAIN = fx('plain.html');
const NOISY = [
  '# Harbour handbook   ', '', 'Welcome to the harbour.   The office opens at 08:00 and closes at 17:30.', '', '', '', '',
  'This page uses cookies to remember your language. Read the policy at https://harbour-proof.dev/privacy?utm_source=newsletter&utm_medium=email.', '',
  '## Ferries', '', 'The ferry to Helgoland leaves at 09:30 from pier 4.  Tickets cost 42.50 EUR, see [tickets](https://harbour-proof.dev/tickets?ref=1&gclid=abc123).', '',
  'This page uses cookies to remember your language. Read the policy at https://harbour-proof.dev/privacy?utm_source=newsletter&utm_medium=email.', '',
  '```js', 'for (let i = 0; i < 3; i++) {', "  console.log('the same line in code stays twice');", "  console.log('the same line in code stays twice');", '}', '```', '',
  'Pier | Berths | Depth', '4 | 12 | 7.5 m', '5 | 12 | 7.5 m', '5 | 12 | 7.5 m', '',
  '- Call the harbour master on channel 16 for every question about berths.', '- Call the harbour master on channel 16 for every question about berths.', '- Fuel: see [the dock](/fuel?fbclid=xyz&lang=de).', '',
  'Short line', 'Short line', '', 'Weather: https://weather-proof.dev/kiel?mc_cid=77&days=3 (updated 06:00).\t\t', ''].join('\r\n');
// a long handbook with known answers in three sections (English and German), the rest filler of harbour words
const WORDS = 'anchor ballast beacon buoy cargo chart crane dock draught ebb fender gangway hull jetty keel ledger lock mooring navigation pilot quay rope rudder sail signal slipway stern swell tide tug wharf winch harbour bollard current'.split(' ');
let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const sentence = () => { const w = Array.from({ length: 8 + Math.floor(rnd() * 8) }, () => WORDS[Math.floor(rnd() * WORDS.length)]); w[0] = w[0][0].toUpperCase() + w[0].slice(1); return `${w.join(' ')}.`; };
const para = () => Array.from({ length: 3 + Math.floor(rnd() * 3) }, sentence).join(' ');
const ANSWERS = { Ferries: 'The ferry to Helgoland leaves at 09:30 from pier 4; tickets cost 42.50 EUR.', Fuel: 'Diesel costs 1.89 EUR per litre at the fuel dock, cash or card.', 'Öffnungszeiten': 'Das Hafenbüro ist samstags von 9 bis 12 Uhr geöffnet, sonntags geschlossen.' };
const SECTIONS = ['Arrival', 'Berths', 'Pilots', 'Ferries', 'Cargo', 'Cranes', 'Fuel', 'Locks', 'Tides', 'Öffnungszeiten', 'Moorings', 'Signals', 'Winter', 'Ledger', 'Tugs', 'Slipway'];
const handbook = () => { seed = 7; const out = ['# Harbour handbook', '', para()]; for (const s of SECTIONS) { out.push('', `## ${s}`, '', para(), ''); if (ANSWERS[s]) out.push(ANSWERS[s], ''); out.push(para()); if (rnd() > 0.5) out.push('', `- ${sentence()}`, `- ${sentence()}`); } return out.join('\n'); };
const HANDBOOK = handbook();
const QA = [['When does the ferry to Helgoland leave?', '09:30', '## Ferries'], ['How much does diesel cost per litre?', '1.89 EUR', '## Fuel'], ['Wann hat das Hafenbüro am Samstag geöffnet?', '9 bis 12 Uhr', '## Öffnungszeiten']];
// a table whose long texts outweigh its keys: TOON is smaller, but by about 12 % only (below TOON_MIN_GAIN)
const NOTES = { notes: Array.from({ length: 10 }, (_, i) => ({ id: i + 1, text: 'A fairly long sentence of about eighty characters so that the values outweigh the keys' })) };
const asHtml = (md) => `<!doctype html><html><head><title>Harbour handbook</title></head><body><nav><a href="/">Home</a> <a href="/about">About</a></nav><main>${md.split('\n\n').map((b) => (/^## /.test(b) ? `<h2>${b.slice(3)}</h2>` : /^# /.test(b) ? `<h1>${b.slice(2)}</h1>` : /^- /m.test(b) ? `<ul>${b.split('\n').map((l) => `<li>${l.slice(2)}</li>`).join('')}</ul>` : `<p>${b}</p>`)).join('\n')}</main><footer>© 2026 Harbour · <a href="/imprint">Imprint</a></footer></body></html>`;

// facts: every number outside a link, every link (without its tracking), every path link of Markdown
const URLS = /https?:\/\/[^\s<>"'`)\]]+/g;
const linksOf = (s) => [...new Set((String(s).match(URLS) || []).map((u) => cleanUrl(u.replace(/[.,;:!?]+$/, ''))))];
const pathLinksOf = (s) => [...new Set((String(s).match(/\]\((\/[^)\s]*)\)/g) || []).map((x) => cleanUrl(`https://p.invalid${x.slice(2, -1)}`).slice('https://p.invalid'.length)))];
const numbersOf = (s) => [...new Set(String(s).replace(URLS, ' ').match(/\d+(?:[.,:]\d+)*/g) || [])];
function keepsFacts(input, out) {
  for (const l of linksOf(input)) assert.ok(out.includes(l), `link kept: ${l}`);
  for (const l of pathLinksOf(input)) assert.ok(out.includes(`](${l})`), `path link kept: ${l}`);
  for (const x of numbersOf(input)) assert.ok(out.includes(x), `number kept: ${x}`);
}

// ---------------------------------------------------------------- the node, without the network
let PAGE_HB = asHtml(HANDBOOK);
const PAGES = () => ({ 'https://bakery-proof.dev/%C3%B6ffnungszeiten': PLAIN, 'https://bakery-proof.dev/%E8%90%A5%E4%B8%9A%E6%97%B6%E9%97%B4': PLAIN, 'https://bakery-proof.dev/hours': PLAIN, 'https://docs.harbour-proof.dev/guide/streams/lines': DOC, 'https://harbour-proof.dev/handbook': PAGE_HB, 'https://harbour-proof.dev/handbook?since=2024-01-01': PAGE_HB });
if (!WEB) {
  globalThis.fetch = async (u) => {
    const k = String(u?.url || u);
    if (/\/robots\.txt$/.test(k)) return new Response(/closed-proof/.test(k) ? 'User-agent: *\nDisallow: /\n' : 'User-agent: *\nAllow: /\n', { status: 200, headers: { 'content-type': 'text/plain' } });
    const p = PAGES()[k]; if (p) return new Response(p, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
    throw new Error(`the proof does not use the network: ${k.slice(0, 80)}`);
  };
  createRequire(import.meta.url)('node:dns').promises.lookup = async () => [{ address: '93.184.216.34', family: 4 }];
}
setViaKey('squeeze-proof-key-0123456789abcdef');
const BASE = 'https://mare.test', db = createMem({ file: '/nonexistent/sea.tsv', base: BASE });
// the kv records every write (the privacy proof reads it)
const writes = [];
const kv0 = memoryKv(), kv = { get: (k) => kv0.get(k), set: (k, v, t) => { writes.push([k, v]); return kv0.set(k, v, t); } };
const ledgerCalls = []; const ledger = createLedger({}); for (const f of Object.keys(ledger)) if (typeof ledger[f] === 'function') { const g = ledger[f]; ledger[f] = (...a) => { ledgerCalls.push([f, a]); return g(...a); }; }
const cfg = { base: BASE, kv, ledger, pay: payConfig({}), site: {}, waitUntil: () => {} };
const OFF = { ...cfg, engine: 'off' };
let ipN = 1;
const call = async (path, { method = 'GET', accept = 'text/markdown', ua = 'proof-agent/1.0', headers = {}, body, c = cfg, ip } = {}) => {
  const res = await handle(new Request(BASE + path, { method, headers: { accept, 'user-agent': ua, 'x-forwarded-for': ip || `198.18.41.${(ipN++ % 250) + 1}`, ...headers }, body }), db, c);
  const buf = res.body ? Buffer.from(await res.arrayBuffer()) : Buffer.alloc(0), text = buf.toString('utf8'); let j = null; try { j = JSON.parse(text); } catch {}
  return { status: res.status, headers: res.headers, h: Object.fromEntries(res.headers), text, buf, j };
};
// the reader keeps a page an hour (node/lens.mjs): a page that changed is read again once its copy is gone
const bust = (raw) => kv0.set(`read:${createHash('sha256').update(raw).digest('hex').slice(0, 24)}`, null, 1);
// the ledger's countEngine (node/areas.mjs, E3) is watched here: what it is handed, and when
const counts = [];
await call('/stats');
const watchCounts = () => { db.flow.countEngine = (lever, s, ctx, subject) => { counts.push({ lever, s, ctx: { own: ctx?.own, readOnly: ctx?.readOnly, head: ctx?.head, house: ctx?.house, door: ctx?.door }, subject }); }; };
watchCounts();
const enc = encodeURIComponent;

if (WEB) {
  // ---------------------------------------------------------------- real pages through the reader (network)
  const list = (process.argv.find((a) => a.startsWith('--pages=')) || '').slice(8).split(',').filter(Boolean);
  const pages = list.length ? list : ['https://example.com/', 'https://en.wikipedia.org/wiki/Mare_Liberum', 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag', 'https://www.rfc-editor.org/rfc/rfc9110.html', 'https://nodejs.org/en/about'];
  const seen = new Map();
  console.log('page | raw HTML tokens | reader Markdown tokens | budget 500 tokens | since unchanged tokens');
  for (const u of pages) {
    const host = new URL(u).hostname, last = seen.get(host) || 0, waitMs = 1100 - (Date.now() - last); if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs)); seen.set(host, Date.now());
    const raw = await fetch(u, { headers: { 'user-agent': 'MareLiberum-session/1.0' } }).then((r) => r.text()).catch(() => '');
    const r = await call(`/r/${u}`), b = await call(`/r/${u}?budget=500`), s = r.h.etag ? await call(`/r/${u}?since=${sinceOf(r.h.etag)}`) : null;
    console.log(`${u} | ${tokensOf('html', raw)} | ${tokensOf('md', r.text)} (${r.status}) | ${tokensOf('md', b.text)} (${b.h['x-sea-engine-tokens'] || 'not cut'}) | ${s ? tokensOf('md', s.text) : '-'}`);
  }
  process.exit(0);
}

console.log('squeeze: the lossless steps lose no fact');
await proof('text and Markdown: whitespace normalised, repeats said once (not in code, not in table rows, not short lines), tracking parameters cut; every number and link kept', () => {
  const r = squeeze(NOISY);
  assert.equal(r.type, 'md'); assert.equal(r.lossy, false); keepsFacts(NOISY, r.out);
  assert.deepEqual(r.steps.map((s) => s.step), ['whitespace normalised', 'repeats said once', 'tracking parameters cut']);
  for (const s of r.steps) assert.ok(s.lossless && s.after < s.before, `${s.step} spared tokens`);
  assert.equal(r.out.split('This page uses cookies').length - 1, 1, 'the repeated paragraph once');
  assert.equal(r.out.split('Call the harbour master').length - 1, 1, 'the repeated list line once');
  assert.equal(r.out.split("console.log('the same line in code stays twice')").length - 1, 2, 'code is never deduplicated');
  assert.equal(r.out.split('5 | 12 | 7.5 m').length - 1, 2, 'a table row is never deduplicated');
  assert.equal(r.out.split('Short line').length - 1, 2, 'short lines stay (a short line said twice can mean two things)');
  assert.ok(!/utm_|gclid|fbclid|mc_cid/.test(r.out) && r.out.includes('ref=1') && r.out.includes('lang=de') && r.out.includes('days=3'), 'only the tracking parameters go');
  assert.ok(!/\r| {2,}|\t| |\n{3,}/.test(r.out.replace(/```[\s\S]*?```/g, 'CODE')), 'no CR, no runs of spaces, tabs or no-break spaces, no triple empty lines outside code');
  assert.ok(r.out.includes("  console.log('the same line in code stays twice');"), 'the indent of code stays');
  assert.ok(r.saving.saved > 0 && r.saving.lossy === false && r.parts.lossy === null);
});
await proof('HTML: the lean reader\'s Markdown, then the text steps; every number and link the lean reader keeps is still there (the lean reader\'s own proof covers HTML → Markdown)', () => {
  for (const [html, url] of [[SHOP, 'https://harbour-sports.dev/products/trail-glider-3?variant=1001&_gsid=abc123&utm_source=feed'], [DOC, 'https://docs.harbour-proof.dev/guide/streams/lines'], [PLAIN, 'https://bakery-proof.dev/hours'], [asHtml(HANDBOOK), 'https://harbour-proof.dev/handbook']]) {
    const r = squeeze(html, { url }), lean = leanMarkdown(html, url).md;
    assert.equal(r.type, 'html'); assert.equal(r.form, 'md'); assert.equal(r.steps[0].step, 'html to Markdown (the lean reader)'); keepsFacts(lean, r.out);
    assert.ok(r.saving.saved > 0 && r.saving.before > r.saving.after, `${url}: ${r.saving.before} -> ${r.saving.after}`);
  }
});
await proof('JSON: minified, parses back to the same value; deep nesting refused before parsing', async () => {
  const live = [await call('/savings.json', { accept: 'application/json' }), await call('/fair.json', { accept: 'application/json' }), await call('/stats', { accept: 'application/json' })].map((x) => x.j).filter(Boolean);
  assert.ok(live.length >= 3, 'the sea\'s own JSON answers');
  for (const v of [...live, { a: [{ id: 1, name: 'x' }, { id: 2, name: 'y' }], s: 'a  b', n: null }]) {
    const pretty = JSON.stringify(v, null, 2), r = squeeze(pretty);
    // since the merge with node/toon.mjs a table goes out as TOON when that spares 20 %: it must decode to the same value
    assert.equal(r.type, 'json'); assert.deepEqual(r.form === 'toon' ? (await import('../node/toon.mjs')).fromToon(r.out) : JSON.parse(r.out), v); assert.ok(r.saving.saved > 0);
  }
  assert.equal(jsonDepth('['.repeat(65) + ']'.repeat(65)), 65);
  assert.throws(() => squeeze('['.repeat(65) + ']'.repeat(65)), /nested deeper/);
  assert.equal(squeeze('['.repeat(64) + ']'.repeat(64)).type, 'json');
  assert.equal(jsonDepth('{"a":"[[[[[[[["}'), 1, 'brackets inside a string do not count');
});
await proof('TOON hook: without node/toon.mjs JSON is minified only; with a TOON encoder, JSON goes as TOON only when that spares at least 20 % (TOON_MIN_GAIN), and decodes to the same value (reference implementation, dev only)', async () => {
  const live = [(await call('/savings.json', { accept: 'application/json' })).j, (await call('/fair.json', { accept: 'application/json' })).j];
  assert.equal(squeeze(JSON.stringify([{ a: 1 }, { a: 2 }], null, 2)).form, toonReady() ? 'toon' : 'json');
  const ref = `${homedir()}/.cache/mare-proof/node_modules/@toon-format/toon/dist/index.mjs`;
  if (toonReady() || !existsSync(ref)) { console.log(`       (${toonReady() ? 'node/toon.mjs is there: TOON already in use' : 'reference TOON not installed: path not exercised'})`); return; }
  const T = await import(ref); toonHook({ toToon: (v) => T.encode(v) });
  try {
    const rows = Array.from({ length: 40 }, (_, i) => ({ id: i + 1, host: `shop${i}.dev`, verified: i % 3 === 0, price: 10 + i / 4 }));
    const r = squeeze(JSON.stringify({ rows }, null, 2));
    assert.equal(r.form, 'toon'); assert.deepEqual(r.steps.map((s) => s.step), ['json minified', 'json as TOON']); assert.deepEqual(T.decode(r.out), { rows });
    assert.ok(tokensOf('toon', r.out) <= 0.8 * tokensOf('json', JSON.stringify({ rows })), 'at least 20 % smaller than the minified JSON');
    console.log(`       tabular JSON: pretty ${r.steps[0].before} → minified ${r.steps[0].after} → TOON ${r.steps[1].after} tokens`);
    // the threshold: semi-uniform and nested JSON stays JSON unless TOON spares 20 % (TOON_MIN_GAIN)
    const shapes = [NOTES, { a: { b: { c: [{ x: 1, y: { z: 2 } }, { x: 2, w: [3, 4] }], d: 'e' } } }, { items: Array.from({ length: 12 }, (_, i) => (i % 2 ? { id: i, name: `n${i}`, tags: ['a', 'b'] } : { id: i, title: `t${i}`, meta: { k: i } })) }, live[0], live[1]];
    for (const v of shapes) { const min = JSON.stringify(v), t = T.encode(v), x = squeeze(JSON.stringify(v, null, 2)), worth = tokensOf('toon', t) <= 0.8 * tokensOf('json', min);
      assert.equal(x.form, worth ? 'toon' : 'json', `TOON ${tokensOf('toon', t)} vs JSON ${tokensOf('json', min)} tokens`); assert.deepEqual(worth ? T.decode(x.out) : JSON.parse(x.out), v); }
    assert.equal(TOON_MIN_GAIN, 0.2); assert.equal(squeeze(JSON.stringify(NOTES, null, 2)).form, 'json', 'a table of long texts: TOON spares about 12 %, below the threshold');
  } finally { toonHook(null); }
});
await proof('type detection: HTML, JSON, Markdown, text; a given type wins', () => {
  assert.equal(detectType(SHOP), 'html'); assert.equal(detectType('<p>a</p><p>b</p><br>'), 'html'); assert.equal(detectType('{"a":1}'), 'json'); assert.equal(detectType('[1,2'), 'text');
  assert.equal(detectType('# T\n\ntext'), 'md'); assert.equal(detectType('just words'), 'text'); assert.equal(squeeze('# not html', { type: 'text' }).type, 'text');
});

console.log('squeeze: a question and a budget, only when asked');
await proof('a question keeps the block that answers it, under its heading, in the original order (English and German); lossy and said so', () => {
  for (const [q, ans, head] of QA) {
    const f = focusOn(HANDBOOK, q);
    assert.ok(f.lossy && f.out.includes(ans) && f.out.includes(head), `${q} → ${ans} under ${head}`);
    assert.ok(tokensOf('md', f.out) < tokensOf('md', HANDBOOK) / 3, 'much shorter');
    const r = squeeze(HANDBOOK, { q });
    assert.ok(r.lossy && r.out.includes(ans) && r.steps.at(-1).lossless === false && r.parts.lossy.lossy === true && r.parts.lossless.lossy === false);
  }
  const f = focusOn(HANDBOOK, 'ferry Helgoland'); const i = f.out.indexOf('## Ferries'), j = f.out.indexOf('09:30'); assert.ok(i >= 0 && j > i, 'the heading stands above its block');
  assert.ok(/\[… [\d,]+ tokens left out\]/.test(f.out), 'gaps are marked with how much they left out');
  assert.equal(focusOn(HANDBOOK, 'zzzz qqqq').lossy, false, 'nothing matches: nothing left out');
});
await proof('a budget (with a question) keeps the answer and stays inside the budget, measured', () => {
  for (const [q, ans] of QA) for (const b of [80, 150, 400]) { const f = fitBudget(HANDBOOK, { q, budget: b }); assert.ok(f.lossy && f.out.includes(ans), `${q} @${b}`); assert.ok(tokensOf('md', f.out) <= b, `${tokensOf('md', f.out)} <= ${b}`); }
});
await proof('a block longer than what is left goes in as its best sentences (the gap inside it marked), a cut list keeps its indents', () => {
  seed = 11; const long = Array.from({ length: 14 }, sentence); long.splice(7, 0, 'The night pilot for the Kiel canal is booked on channel 73 before 18:00.');
  const md = `# Pilots\n\n${long.join(' ')}\n\n## Other\n\n${para()}`;
  for (const b of [80, 100, 140]) { const f = fitBudget(md, { q: 'How do I book the night pilot for the Kiel canal?', budget: b }); assert.ok(f.out.includes('channel 73 before 18:00'), `@${b}: the answer sentence`); assert.ok(tokensOf('md', f.out) <= b); assert.match(f.out, /\[… [\d,]+ tokens left out\] The night pilot/); }
  const list = `# L\n\n${Array.from({ length: 30 }, (_, i) => (i % 3 ? `  - sub item ${i} ${sentence()}` : `- item ${i} ${sentence()}`)).join('\n')}`;
  const f = fitBudget(list, { budget: 120 }); assert.ok(/\n {2}- sub item/.test(f.out), 'a nested list keeps its indents'); assert.ok(tokensOf('md', f.out) <= 120);
});
await proof('a budget without a question: the first paragraph, every heading, the first block of each section, then the densest; inside the budget', () => {
  const heads = HANDBOOK.split('\n').filter((l) => /^#{1,6} /.test(l)), b = 700;
  const f = fitBudget(HANDBOOK, { budget: b });
  for (const h of heads) assert.ok(f.out.includes(h), `heading kept: ${h}`);
  assert.ok(tokensOf('md', f.out) <= b && f.lossy && f.left > 0);
  for (const md of [HANDBOOK, leanMarkdown(DOC, 'https://docs.harbour-proof.dev/guide/streams/lines').md, NOISY]) for (const bb of [50, 60, 90, 120, 200, 400, 800, 1600, 5000]) for (const q of ['', 'ferry diesel', 'stream lines']) {
    const x = fitBudget(md, { q, budget: bb }); assert.ok(tokensOf('md', x.out) <= Math.max(bb, SQUEEZE.minBudget), `budget ${bb} q "${q}": ${tokensOf('md', x.out)}`);
  }
  const small = fitBudget('# a\n\nshort text', { budget: 500 }); assert.equal(small.lossy, false, 'a text inside the budget is sent whole');
});
await proof('the line diff: Myers, exact on 2,000 random pairs; capped ("changed too much")', () => {
  let s = 3; const r = () => (s = (s * 69069 + 1) % 4294967296) / 4294967296;
  for (let t = 0; t < 2000; t++) {
    const A = Array.from({ length: Math.floor(r() * 14) }, () => 'abcde'[Math.floor(r() * 5)]), B = Array.from({ length: Math.floor(r() * 14) }, () => 'abcde'[Math.floor(r() * 5)]);
    const d = diffLines(A, B); assert.deepEqual(d.ops.filter((o) => o.op !== '+').map((o) => o.line), A); assert.deepEqual(d.ops.filter((o) => o.op !== '-').map((o) => o.line), B);
  }
  const big = Array.from({ length: 3000 }, (_, i) => `line ${i}`), other = Array.from({ length: 3000 }, (_, i) => `other ${i}`);
  assert.equal(diffLines(big, other).tooMuch, true); assert.equal(diffLines(big, [...big.slice(0, 1500), 'new', ...big.slice(1500)]).changed, 1);
});

console.log('POST /compress');
const MARK = 'PRIVATE-MARKER-7f3a9c';
await proof('GET says how (JSON; Markdown for Accept: text/markdown); POST HTML answers { out, form, tokens, steps, lossy, note } with the engine headers', async () => {
  let r = await call('/compress', { accept: 'application/json' }); assert.equal(r.status, 200); assert.equal(r.j.lever, 'squeeze'); assert.ok(r.j.example.includes('/compress'));
  r = await call('/compress', { accept: 'text/markdown' }); assert.equal(r.status, 200); assert.match(r.h['content-type'], /text\/markdown/); assert.match(r.text, /^# POST \/compress/);
  r = await call('/compress', { method: 'POST', accept: 'application/json', headers: { 'content-type': 'text/html' }, body: SHOP });
  assert.equal(r.status, 200); assert.deepEqual(Object.keys(r.j), ['out', 'form', 'tokens', 'steps', 'lossy', 'note']); assert.equal(r.j.form, 'md'); assert.equal(r.j.lossy, false);
  assert.equal(r.h['x-sea-engine'], 'squeeze'); assert.equal(r.h['x-sea-engine-tokens'], `${r.j.tokens.before}->${r.j.tokens.after}`); assert.equal(r.h['x-sea-engine-saved'], String(r.j.tokens.saved)); assert.equal(r.h['x-sea-engine-lossy'], undefined);
  assert.equal(r.h['cache-control'], 'no-store'); assert.equal(r.h['x-sea-receipt'], undefined, 'no receipt for engine savings (rule 17)');
  r = await call('/compress', { method: 'POST', accept: 'text/plain', headers: { 'content-type': 'text/markdown' }, body: NOISY }); assert.equal(r.status, 200); assert.match(r.h['content-type'], /text\/plain/); assert.ok(r.text.startsWith('# Harbour handbook\n'));
});
await proof('a JSON body {text, q, budget}: lossy, said so (x-sea-engine-lossy), the answer kept, the budget kept; lossless and lossy counted apart', async () => {
  counts.length = 0;
  const r = await call('/compress', { method: 'POST', accept: 'application/json', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ html: asHtml(HANDBOOK), q: QA[0][0], budget: 150 }) });
  assert.equal(r.status, 200); assert.equal(r.j.lossy, true); assert.equal(r.h['x-sea-engine-lossy'], '1'); assert.ok(r.j.out.includes(QA[0][1])); assert.ok(r.j.tokens.after <= 150);
  assert.ok(r.j.steps.some((s) => !s.lossless) && r.j.steps.some((s) => s.lossless));
  assert.equal(counts.length, 2); assert.deepEqual(counts.map((c) => [c.lever, c.s.lossy]), [['squeeze', false], ['squeeze', true]]);
  assert.match(counts[0].subject, /^[0-9a-f]{16}$/); assert.equal(counts[1].subject, `${counts[0].subject}:lossy`);
  const raw = await call(`/compress?q=${enc(QA[2][0])}`, { method: 'POST', accept: 'text/markdown', headers: { 'content-type': 'text/markdown' }, body: HANDBOOK });
  assert.ok(raw.text.includes(QA[2][1]) && raw.h['x-sea-engine-lossy'] === '1', 'q as a query parameter with a raw body');
});
await proof('limits: 413 above 1 MB (by its Content-Length and by what came), 1 MB itself taken; 400 on an empty body, white space, broken or too deep JSON, two inputs, a bad budget', async () => {
  const P = (body, ct = 'text/plain', headers = {}) => call('/compress', { method: 'POST', accept: 'application/json', headers: { 'content-type': ct, ...headers }, body, ip: '127.0.0.1' });
  assert.equal((await P('a'.repeat(SQUEEZE.maxBytes + 1))).status, 413);
  assert.equal((await P('a b', 'text/plain', { 'content-length': String(SQUEEZE.maxBytes + 1) })).status, 413, 'refused by what it says, before reading');
  assert.equal((await P('word '.repeat(SQUEEZE.maxBytes / 5))).status, 200, 'exactly 1 MB is taken');
  assert.equal((await P('')).status, 400); assert.equal((await P('   \n ')).status, 400);
  assert.equal((await P('{"text": ', 'application/json')).status, 400);
  assert.equal((await P('['.repeat(65) + ']'.repeat(65), 'application/json')).status, 400);
  assert.equal((await P(JSON.stringify({ text: 'a', html: '<p>b</p>' }), 'application/json')).status, 400);
  assert.equal((await P(JSON.stringify({ text: 'abc', budget: 'lots' }), 'application/json')).status, 400);
  assert.equal((await P(JSON.stringify({ text: '' }), 'application/json')).status, 400);
  assert.equal((await call('/compress', { method: 'PUT', body: 'x' })).status, 405);
});
await proof('the pace: one network that floods /compress with big bodies gets 429 with retry-after (node/immune.mjs, by size)', async () => {
  const big = 'word '.repeat(SQUEEZE.maxBytes / 5); let st = 0, ra = null;
  for (let i = 0; i < 12 && st !== 429; i++) { const r = await call('/compress', { method: 'POST', accept: 'application/json', headers: { 'content-type': 'text/plain' }, body: big, ip: '203.0.113.77' }); st = r.status; ra = r.h['retry-after']; }
  assert.equal(st, 429); assert.ok(Number(ra) >= 1);
});
// nothing of a body is kept: every write path is watched while bodies carrying a marker pass
async function privateRun(post) {
  const w0 = writes.length, l0 = ledgerCalls.length, c0 = counts.length, out = [], orig = { log: console.log, error: console.error, warn: console.warn, info: console.info };
  for (const k of Object.keys(orig)) console[k] = (...a) => { out.push(a.map(String).join(' ')); };
  try { await post(); } finally { Object.assign(console, orig); }
  const seen = JSON.stringify([writes.slice(w0), ledgerCalls.slice(l0), counts.slice(c0), out, db.pressVersions?.stats?.()]);
  assert.ok(!seen.includes(MARK), 'the marker reached a write path');
  return { writes: writes.length - w0, ledger: ledgerCalls.length - l0, counts: counts.length - c0, logs: out.length };
}
const posts = async () => {
  for (const [body, ct] of [[`<p>${MARK} 1</p><p>more ${MARK}</p><p>x</p>`, 'text/html'], [`${MARK} text   with  spaces`, 'text/plain'], [JSON.stringify({ k: MARK, v: [1, 2, 3] }, null, 2), 'application/json'], [JSON.stringify({ text: `# ${MARK}\n\n${HANDBOOK}`, q: MARK, budget: 90 }), 'application/json'], ['{"broken": "' + MARK, 'application/json'], ['['.repeat(70) + `"${MARK}"`, 'application/json']])
    await call('/compress', { method: 'POST', accept: 'application/json', headers: { 'content-type': ct }, body });
};
await proof('nothing posted is kept or logged: the kv, the ledger, the console, the count and the versions never see it (and the door\'s code has no write path)', async () => {
  const n = await privateRun(posts);
  assert.ok(n.counts >= 2, 'the counts happened (sizes and a salted hash only)');
  const src = readFileSync(new URL('../node/press.mjs', import.meta.url), 'utf8'), door = src.slice(src.indexOf('export async function compressDoor'), src.indexOf('// ---------------------------------------------------------------- the reader'));
  assert.ok(door.length > 1000 && !/console\.|\bkv\b|\.set\(|writeFile|appendFile|ledger|versions|tagEvent|emit\(|layPath/.test(door), 'the door has no write path but count(sizes)');
});

console.log('the reader: ETag, If-None-Match, since=, budget=');
const HB = 'https://harbour-proof.dev/handbook';
await proof('every Markdown answer carries a weak ETag and the address to read it again (x-sea-delta); the body has no new line', async () => {
  const r = await call(`/r/${HB}`);
  assert.equal(r.status, 200); assert.match(r.h.etag, /^W\/"e1-[0-9a-f]{20}"$/); assert.equal(r.h['x-sea-delta'], `${BASE}/r/${HB}?since=${sinceOf(r.h.etag)}`);
  assert.ok(!r.text.includes('since='), 'the default body is the 3.34.1 body'); assert.equal(r.h['x-sea-engine'], undefined, 'no engine header on an answer the engine did not shape');
});
await proof('the ETag is stable while the page is (the next answer says "a copy from the last hour" and keeps it), and changes with the page', async () => {
  bust(HB); const a = await call(`/r/${HB}`), b = await call(`/r/${HB}`);
  assert.ok(!a.text.includes('a copy from the last hour') && b.text.includes('a copy from the last hour'), 'the two answers differ'); assert.equal(a.h.etag, b.h.etag);
  PAGE_HB = asHtml(HANDBOOK.replace('09:30', '10:15')); bust(HB);
  const c = await call(`/r/${HB}`); assert.notEqual(c.h.etag, a.h.etag);
  PAGE_HB = asHtml(HANDBOOK); bust(HB); const d = await call(`/r/${HB}`); assert.equal(d.h.etag, a.h.etag, 'the same page, the same ETag');
});
await proof('If-None-Match with the ETag (also in a list, bare, or *): 304 without a body, counted as delta; another ETag: the page', async () => {
  const a = await call(`/r/${HB}`); counts.length = 0;
  for (const inm of [a.h.etag, `"x", ${a.h.etag}`, `"${sinceOf(a.h.etag)}"`, '*']) { const r = await call(`/r/${HB}`, { headers: { 'if-none-match': inm } }); assert.equal(r.status, 304, inm); assert.equal(r.buf.length, 0); assert.equal(r.h.etag, a.h.etag); assert.equal(r.h['x-sea-engine'], 'delta'); }
  assert.equal(counts.length, 4); assert.ok(counts.every((c) => c.lever === 'delta' && c.s.after === 0 && c.s.saved > 0 && c.subject === HB));
  const o = await call(`/r/${HB}`, { headers: { 'if-none-match': 'W/"e1-00000000000000000000"' } }); assert.equal(o.status, 200); assert.ok(o.text.includes('09:30'));
});
await proof('since=<etag>: unchanged → one line; changed → the changed lines under the nearest heading; unknown → the whole page and a note', async () => {
  const a = await call(`/r/${HB}`), tag = sinceOf(a.h.etag); counts.length = 0;
  const u = await call(`/r/${HB}?since=${tag}`);
  assert.equal(u.status, 200); assert.equal(u.text.trim().split('\n').length, 1); assert.match(u.text, /^Unchanged since e1-/); assert.equal(u.h['x-sea-engine'], 'delta'); assert.ok(Number(u.h['x-sea-engine-saved']) > 0);
  PAGE_HB = asHtml(HANDBOOK.replace('09:30', '10:15').replace('Diesel costs 1.89', 'Diesel costs 1.95')); bust(HB);
  const c = await call(`/r/${HB}?since=${tag}`);
  assert.equal(c.status, 200); assert.match(c.text, /^Changed since e1-/); assert.ok(c.text.includes('## Ferries\n- The ferry to Helgoland leaves at 09:30') && c.text.includes('+ The ferry to Helgoland leaves at 10:15'), 'the lines that changed, under their heading');
  assert.ok(c.text.includes('## Fuel\n- Diesel costs 1.89') && c.text.includes('+ Diesel costs 1.95'));
  assert.ok(c.text.includes(`?since=${sinceOf(c.h.etag)}`), 'the last lines say how to read again');
  assert.ok(tokensOf('md', c.text) * 5 < tokensOf('md', a.text), `${tokensOf('md', c.text)} tokens instead of ${tokensOf('md', a.text)}`);
  assert.equal(c.h['x-sea-engine'], 'delta'); assert.equal(c.h['x-sea-engine-lossy'], undefined, 'lossless');
  const x = await call(`/r/${HB}?since=e1-00000000000000000000`);
  assert.match(x.text, /^Note: the version e1-0{20} of this page is not kept here/); assert.ok(x.text.includes('10:15')); assert.equal(x.h['x-sea-engine'], undefined, 'no saving, no claim');
  assert.deepEqual(counts.map((k) => k.lever), ['delta', 'delta'], 'unchanged and changed counted, the whole page not');
  PAGE_HB = asHtml(HANDBOOK); bust(HB);
});
await proof('an address with letters outside ASCII (/read?url=…/öffnungszeiten) is answered as in 3.34.1, its x-sea-delta percent-encoded', async () => {
  const r = await call(`/read?url=${enc('https://bakery-proof.dev/öffnungszeiten')}`); assert.equal(r.status, 200); assert.ok(r.text.includes('Opening hours'));
  assert.equal(r.h['x-sea-delta'], `${BASE}/r/https://bakery-proof.dev/%C3%B6ffnungszeiten?since=${sinceOf(r.h.etag)}`);
  const off = await call(`/read?url=${enc('https://bakery-proof.dev/öffnungszeiten')}`, { c: OFF }); assert.equal(off.status, 200);
  const cjk = await call(`/read?url=${enc('https://bakery-proof.dev/营业时间')}`); assert.equal(cjk.status, 200, 'letters beyond Latin-1 too'); assert.match(cjk.h['x-sea-delta'], /%E8%90%A5%E4%B8%9A/);
});
await proof('a since= or budget= of the page\'s own (not in the engine\'s form) stays part of its address, as in 3.34.1', async () => {
  const r = await call(`/r/${HB}?since=2024-01-01`); assert.ok(r.text.includes(`URL Source: ${HB}?since=2024-01-01`));
  assert.deepEqual(readerParams(new URL(`${BASE}/r/x?since=2024-01-01&budget=low`), '/r/x').strip, []);
  assert.deepEqual(readerParams(new URL(`${BASE}/r/x?since=e1-0123456789abcdef0123&budget=300`), '/r/x').strip, ['since', 'budget']);
});
await proof('budget=<tokens> (with q): lossy and said so at the top, the answer kept, inside the budget (measured), counted as budget', async () => {
  counts.length = 0;
  const r = await call(`/r/${HB}?budget=300&q=${enc(QA[1][0])}`);
  assert.equal(r.status, 200); assert.match(r.text, /^Fitted to your budget of 300 tokens \(lossy\)/); assert.ok(r.text.includes(QA[1][1])); assert.ok(tokensOf('md', r.text) <= 300, `${tokensOf('md', r.text)} tokens`);
  assert.equal(r.h['x-sea-engine'], 'budget'); assert.equal(r.h['x-sea-engine-lossy'], '1'); assert.deepEqual(counts.map((k) => [k.lever, k.s.lossy]), [['budget', true]]);
  for (const b of [120, 200, 500, 1000]) { const x = await call(`/r/${HB}?budget=${b}`); const least = /the least this page takes/.test(x.text); assert.ok(least || tokensOf('md', x.text) <= b, `budget ${b}: ${tokensOf('md', x.text)}`); }
  const t = await call(`/r/${HB}?budget=10`); assert.match(t.text, /the least this page takes \(you asked for 10\)/);
  const w = await call(`/r/https://bakery-proof.dev/hours?budget=5000`); assert.ok(!w.text.startsWith('Fitted'), 'a page inside the budget comes whole'); assert.equal(w.h['x-sea-engine'], undefined);
});
await proof('versions: memory only, bounded by bytes and by 24 hours (the oldest go first)', () => {
  let t = 0; const v = createVersions({ maxBytes: 1000, ttlMs: 1000, now: () => t });
  for (let i = 0; i < 10; i++) v.put(`k${i}`, 'e1-a', 'x'.repeat(300));
  assert.ok(v.stats().bytes <= 1000 && v.stats().versions === 3); assert.equal(v.get('k0', 'e1-a'), null); assert.ok(v.get('k9', 'e1-a'));
  t = 1001; assert.equal(v.get('k9', 'e1-a'), null); assert.equal(v.stats().versions, 0);
  assert.equal(v.put('big', 'e1-a', 'y'.repeat(2000)), false, 'one page larger than the bound is not kept');
  const d = createVersions(); assert.equal(d.stats().maxBytes, 32 * 1024 * 1024); assert.equal(d.stats().hours, 24);
});

console.log('defaults byte for byte, the rest switch, who is counted');
// the same request with the engine on and off: with it off, the code path is the one of 3.34.1 (nothing of the engine runs)
async function sameBytes(path, o = {}, accept = 'text/markdown') {
  for (let t = 0; t < 3; t++) {
    // (a receipt's id is random in every answer since 3.34, with the engine or without: it is the one thing set aside)
    const on = await call(path, { ...o, accept }), off = await call(path, { ...o, accept, c: OFF }), rid = (x) => Buffer.from(x.buf.toString('latin1').replace(/\br\d{8}[a-z0-9]{8}\b/g, 'r<id>'), 'latin1');
    if (rid(on).equals(rid(off))) return { on, off };
    if (t === 2) { const a = on.text, b = off.text; let i = 0; while (i < a.length && a[i] === b[i]) i++; assert.fail(`${path}: the body differs with the engine on, at ${i}: ${JSON.stringify(a.slice(i - 40, i + 60))} vs ${JSON.stringify(b.slice(i - 40, i + 60))}`); }
  }
}
await proof('every default answer is byte for byte the same with the engine on and off: /r/ (lean, full, q, JSON, a page closed by robots.txt, a foreign since=), /read, and doors the engine never touches', async () => {
  for (const [p, acc] of [[`/r/${HB}`], [`/r/${HB}?format=full`], [`/r/${HB}?q=${enc('ferry times')}`], [`/r/${HB}`, 'application/json'], [`/read?url=${enc(HB)}`], [`/r/${HB}?since=2024-01-01`], ['/r/https://closed-proof.dev/page'], ['/r/https://bakery-proof.dev/hours'], ['/savings.json', 'application/json'], ['/fair.json', 'application/json'], ['/llms.txt', 'text/plain'], ['/read', 'text/html']]) {
    const { on, off } = await sameBytes(p, {}, acc);
    const extra = Object.keys(on.h).filter((k) => !(k in off.h)).sort();
    assert.ok(extra.length === 0 || extra.join() === 'etag,x-sea-delta', `${p}: only ETag and x-sea-delta are new (${extra})`);
    if (/^\/r\/https:\/\/harbour|^\/read\?/.test(p) && acc !== 'application/json' && !p.includes('format=full')) assert.equal(extra.join(), 'etag,x-sea-delta', `${p} carries the ETag`);
  }
  const r = await call('/compress', { c: OFF }); assert.ok(r.status === 503);
});
await proof('the rest switch: MARE_ENGINE=off or "engine" in rest of immune:policy → since= and budget= stay part of the address, no ETag, If-None-Match ignored, /compress 503 with a note', async () => {
  const a = await call(`/r/${HB}`), tag = sinceOf(a.h.etag);
  for (const c of [OFF, null]) {
    if (!c) immune.set({ rest: ['engine'] });
    try {
      const cc = c || cfg;
      const s = await call(`/r/${HB}?since=${tag}`, { c: cc }); assert.ok(s.text.includes(`URL Source: ${HB}?since=${tag}`), 'the parameter stays the page\'s'); assert.equal(s.h.etag, undefined);
      const i = await call(`/r/${HB}`, { c: cc, headers: { 'if-none-match': a.h.etag } }); assert.equal(i.status, 200);
      const p = await call('/compress', { c: cc, method: 'POST', accept: 'application/json', headers: { 'content-type': 'text/plain' }, body: 'hello  world' }); assert.equal(p.status, 503); assert.match(p.j.error.message, /rests/);
    } finally { immune.set({}); }
  }
  const back = await call(`/r/${HB}?since=${tag}`); assert.match(back.text, /^Unchanged since/);
});
// who is counted: never the sea's own calls, crawlers, HEAD; the house agent marked
async function gating(make) {
  const got = [], sea = { countEngine: (lever, s, ctx) => got.push(ctx) }, s = { lever: 'delta', before: 10, after: 1, saved: 9, lossy: false };
  for (const ctx of [{ ip: 'a' }, { ip: 'b', own: true }, { ip: 'c', readOnly: true }, { ip: 'd', head: true }, { ip: 'e', house: true }]) make(sea, ctx)('delta', s, 'x');
  make(sea, { ip: 'f' })('delta', { ...s, saved: 0 }, 'x');
  assert.deepEqual(got.map((c) => c.ip), ['a', 'e'], 'only the agent and the house agent (marked) are counted');
}
await proof('no count for the sea\'s own calls, crawlers or HEAD (end to end), the house agent marked; nothing without a saving', async () => {
  await gating(counter);
  const a = await call(`/r/${HB}`), inm = { 'if-none-match': a.h.etag };
  counts.length = 0; await call(`/r/${HB}`, { headers: inm, ua: 'MareLiberum-session/1.0' }); assert.equal(counts.length, 0, 'self');
  await call(`/r/${HB}`, { headers: inm, c: { ...cfg, head: true } }); assert.equal(counts.length, 0, 'HEAD');
  const cr = await call('/compress', { method: 'POST', ua: 'GPTBot/1.0', accept: 'application/json', headers: { 'content-type': 'text/html' }, body: SHOP }); assert.equal(cr.status, 200); assert.equal(counts.length, 0, 'crawler');
  const g = await call(`/r/${HB}`, { ua: 'GPTBot/1.0' }); assert.equal(g.h.etag, undefined, 'a crawler gets the reader\'s note, not a page'); assert.equal(counts.length, 0);
  await call(`/r/${HB}`, { headers: inm, ua: 'Angel/1.0' }); assert.equal(counts.length, 1); assert.equal(counts[0].ctx.house, true, 'the house agent counted apart');
  await call('/compress', { method: 'POST', accept: 'application/json', headers: { 'content-type': 'text/plain' }, body: 'tiny' }); assert.equal(counts.length, 1, 'no saving, no count');
});

console.log('negative controls');
await negative('a squeeze that drops a sentence is caught by the facts check', () => { const r = squeeze(NOISY); keepsFacts(NOISY, r.out.replace(/Tickets cost 42\.50 EUR, /, '')); });
await negative('a squeeze that keeps a tracking parameter is caught', () => { keepsFacts('see https://a-proof.dev/x?utm_source=y&id=1', 'see https://a-proof.dev/x?id=2'); });
await negative('a fitBudget that ignores the budget is caught by the budget check', () => { const broken = (md) => ({ out: md }); assert.ok(tokensOf('md', broken(HANDBOOK).out) <= 300); });
await negative('a question step that loses the answer is caught', () => { const f = focusOn(HANDBOOK, QA[0][0]); assert.ok(f.out.replace(/09:30/g, '').includes(QA[0][1])); });
await negative('a counter that counts crawlers is caught by the gating check', () => gating((sea, ctx) => (lever, s, subject) => { if (!(s.saved > 0) || ctx.own || ctx.head) return; sea.countEngine(lever, s, ctx, subject); }));
await negative('a counter that counts HEAD is caught by the gating check', () => gating((sea, ctx) => (lever, s, subject) => { if (!(s.saved > 0) || ctx.own || ctx.readOnly) return; sea.countEngine(lever, s, ctx, subject); }));
await negative('an ETag over the whole answer (time and copy note in it) is caught by the stability check', async () => { bust(HB); const a = await call(`/r/${HB}`), b = await call(`/r/${HB}`); assert.equal(createHash('sha256').update(a.text).digest('hex'), createHash('sha256').update(b.text).digest('hex')); });
await negative('a door that logs what was sent is caught by the privacy check', () => privateRun(async () => { await posts(); console.error('mare_compress', `${MARK} got a body`); }));
await negative('a door that keeps what was sent in the kv is caught by the privacy check', () => privateRun(async () => { await posts(); await kv.set('compress:last', MARK, 60); }));
await negative('a default answer with a line added (the since= hint in the body) is caught by the byte check', async () => { const a = await call(`/r/${HB}`); const b = Buffer.from(`${a.text}Read it again for only what changed: ${a.h['x-sea-delta']}\n`); assert.ok(a.buf.equals(b)); });
await negative('a reader that takes every since= as its own (a page\'s since=2024-01-01 too) is caught', () => { const strip = (url) => ['since']; assert.deepEqual(strip(new URL(`${BASE}/r/x?since=2024-01-01`)), readerParams(new URL(`${BASE}/r/x?since=2024-01-01`), '/r/x').strip); });
const REF_TOON = `${homedir()}/.cache/mare-proof/node_modules/@toon-format/toon/dist/index.mjs`;
if (!toonReady() && existsSync(REF_TOON)) await negative('a squeeze that takes TOON whenever it is smaller (no 20 % threshold) is caught', async () => {
  const T = await import(REF_TOON), min = JSON.stringify(NOTES), t = T.encode(NOTES), broken = bytesOf(t) < bytesOf(min) ? 'toon' : 'json';
  assert.equal(broken, (tokensOf('toon', t) <= 0.8 * tokensOf('json', min)) ? 'toon' : 'json');
});
await negative('an x-sea-delta header with the address as it came (not percent-encoded) breaks on letters beyond Latin-1', () => { new Response('x', { headers: { 'x-sea-delta': `${BASE}/r/https://bakery-proof.dev/营业时间?since=e1-0` } }); });
await negative('a 1 MB limit that lets one byte more through is caught', async () => { const r = await call('/compress', { method: 'POST', accept: 'application/json', headers: { 'content-type': 'text/plain' }, body: 'a'.repeat(SQUEEZE.maxBytes + 1), ip: '127.0.0.1' }); assert.notEqual(r.status, 413); });

// ---------------------------------------------------------------- the sea's own pages, before and after (printed)
console.log('\nbefore/after tokens, the sea\'s own pages (in process; HTML as a browser gets it → squeeze lossless → budget 500 with no question)');
console.log('page | HTML tokens | squeeze lossless | lossless saved | budget 500');
let shown = 0;
for (const p of ['/', '/read', '/savings', '/fair', '/proof', '/open', '/connect', '/mcp-server', '/why', '/security', '/pricing', '/brain', '/sites', '/briefs', '/teams', '/check']) {
  const r = await call(p, { accept: 'text/html', ua: 'Mozilla/5.0 (proof) Chrome/120', headers: { 'sec-fetch-mode': 'navigate' } }).catch(() => null);
  if (!r || r.status !== 200 || !/text\/html/.test(r.h['content-type'] || '')) continue;
  const s = squeeze(r.text, { url: `${BASE}${p}` }), b = squeeze(r.text, { url: `${BASE}${p}`, budget: 500 });
  console.log(`${p} | ${s.saving.before} | ${s.saving.after} | ${Math.round((100 * s.saving.saved) / (s.saving.before || 1))} % | ${b.saving.after}${b.lossy ? ' (lossy)' : ''}`);
  shown++;
}
await proof('at least 10 of the sea\'s own pages measured', () => assert.ok(shown >= 10, `${shown} pages`));

console.log(`\n${passed} passed, ${failed} failed; negative controls: ${negOk} failed as they must, ${negBad} did not`);
process.exit(failed || negBad ? 1 : 0);
