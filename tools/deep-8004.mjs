// Mare Liberum · the deep lake: every agent registered on chain (ERC-8004) that at least one other agent rated.
// The open index 8004scan pages by cursor only, so the deep lake is cut into time windows of a few thousand agents,
// read window by window with a few streams at once, politely, and kept in the repository (lakes/erc8004-deep.ndjson.gz).
// Each build adds the freshest top agents live on top.
// Usage: node tools/deep-8004.mjs
import { createWriteStream, mkdirSync } from 'node:fs';
import { createGzip } from 'node:zlib';
import { norm8004 } from '../node/core.mjs';
const API = 'https://api.8004scan.io/api/v1/agents?is_testnet=false&min_feedbacks=1&sort_by=created_at&sort_order=desc&limit=100';
const UA = 'MareLiberum/2.5 (open sea for agents; +https://mareliberum.dev)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(q) {
  for (let i = 0; i < 6; i++) {
    try {
      const r = await fetch(`${API}${q}`, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(60000) });
      if (r.ok) return await r.json();
      await r.body?.cancel(); await sleep(r.status === 429 ? 8000 * (i + 1) : 2000 * (i + 1));
    } catch { await sleep(2000 * (i + 1)); }
  }
  return null;
}
const iso = (t) => new Date(t).toISOString().replace(/\.\d{3}Z$/, 'Z');
const win = (a, b) => `&created_after=${iso(a)}&created_before=${iso(b)}`;
const count = async (a, b) => (await get(`${win(a, b)}&limit=1`))?.total ?? 0;
// cut time into windows of at most MAX agents
const MAX = 5000, windows = [];
async function cut(a, b, n) {
  if (n == null) n = await count(a, b);
  if (!n) return;
  if (n <= MAX || b - a < 60000) { windows.push({ a, b, n }); return; }
  const m = Math.floor((a + b) / 2), left = await count(a, m);
  await cut(a, m, left); await cut(m, b, n - left);
}
const t0 = Date.now();
await cut(Date.parse('2025-01-01T00:00:00Z'), Date.now() + 3600000);
console.log(`${windows.length} windows, ${windows.reduce((s, w) => s + w.n, 0)} agents expected, cut in ${Math.round((Date.now() - t0) / 1000)} s`);
const seen = new Map();
let pages = 0, done = 0;
async function read(w) {
  let cursor = '';
  for (;;) {
    const j = await get(`${win(w.a, w.b)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`); pages++;
    if (!j) { console.log(`window ${iso(w.a)}: gave up`); return; }
    for (const a of j.items || []) if (!seen.has(a.agent_id)) seen.set(a.agent_id, a);
    cursor = j.next_cursor; if (!j.has_more || !cursor) break;
    await sleep(200);
  }
  done++; if (done % 5 === 0) console.log(`${done}/${windows.length} windows, ${seen.size} agents, ${pages} pages, ${Math.round((Date.now() - t0) / 1000)} s`);
}
let i = 0;
await Promise.all(Array.from({ length: 8 }, async () => { while (i < windows.length) await read(windows[i++]); }));
mkdirSync('lakes', { recursive: true });
const gz = createGzip({ level: 9 }), out = createWriteStream('lakes/erc8004-deep.ndjson.gz'); gz.pipe(out);
let rows = 0;
for (const a of seen.values()) { const r = norm8004(a); if (r) { gz.write(JSON.stringify(r) + '\n'); rows++; } }
gz.end(); await new Promise((r) => out.on('finish', r));
console.log(`deep lake: ${rows} agents from ${seen.size} read in ${Math.round((Date.now() - t0) / 1000)} s, ${pages} pages`);
