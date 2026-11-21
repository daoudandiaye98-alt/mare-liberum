// Tests the doors of the routing table the way a program meets them: robots.txt first, then one search with a plain word.
//   node tools/doors-verify.mjs candidates.json out.json [concurrency]
// candidates.json: [{ tpl, host, ... }] (DOORS_LIST=candidates.json node tools/doors-build.mjs writes it).
// A door counts as open when robots.txt lets a general program use the search link, the answer is 200 and the result
// page carries the word that was searched. For each door the live assistants its robots.txt keeps off are noted.
import { readFileSync, writeFileSync } from 'node:fs';
import { robotsGroups, robotsAllows } from '../node/check.mjs';

const [, , inFile, outFile, conc = '40'] = process.argv;
const UA = 'MareLiberum-Atlas/1.0 (+https://mareliberum.dev/atlas; maps how agents can use a website, follows robots.txt)';
const WORD = 'water';
const LIVE = [['c', 'claude-user'], ['g', 'chatgpt-user'], ['p', 'perplexity-user']];
const list = JSON.parse(readFileSync(inFile, 'utf8'));
const out = (() => { try { return JSON.parse(readFileSync(outFile, 'utf8')); } catch { return {}; } })();

async function get(url, ms, max = 400_000) {
  const ac = new AbortController(), timer = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(url, { redirect: 'follow', signal: ac.signal, headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.5', 'accept-language': 'en' } });
    const reader = r.body?.getReader(); const parts = []; let size = 0;
    if (reader) for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; parts.push(value); if (size > max) { try { await reader.cancel(); } catch {} break; } }
    return { status: r.status, url: r.url, body: Buffer.concat(parts).toString('utf8') };
  } catch (e) { return { status: 0, err: e?.name === 'AbortError' ? 'timeout' : String(e?.cause?.code || e?.message || e).slice(0, 40) }; } finally { clearTimeout(timer); }
}
const robots = new Map();
const robotsOf = (origin) => { if (!robots.has(origin)) robots.set(origin, get(`${origin}/robots.txt`, 7000, 300_000).then((r) => (r.status === 200 && !/^\s*</.test(r.body) ? robotsGroups(r.body) : r.status >= 500 || r.status === 0 ? null : []))); return robots.get(origin); };

async function test(x) {
  const url = x.tpl.replace(/\{q\}/g, WORD); let u; try { u = new URL(url); } catch { return { ok: false, why: 'bad link' }; }
  const groups = await robotsOf(u.origin);
  if (groups === null) return { ok: false, why: 'no answer' };
  const path = u.pathname + u.search;
  if (!robotsAllows(groups, 'mareliberum-atlas', path).allowed) return { ok: false, why: 'robots.txt says no' };
  const walls = LIVE.filter(([, a]) => !robotsAllows(groups, a, path).allowed).map(([c]) => c).join('');
  const r = await get(url, 12000);
  if (r.status !== 200) return { ok: false, why: r.status ? `answer ${r.status}` : r.err || 'no answer' };
  let moved = false; try { moved = new URL(r.url).hostname.replace(/^www\./, '') !== u.hostname.replace(/^www\./, '') && !new URL(r.url).hostname.endsWith(u.hostname.split('.').slice(-2).join('.')); } catch {}
  if (moved) return { ok: false, why: 'leads elsewhere' };
  const text = r.body.slice(0, 250000).replace(/<script\b[^>]*>[^<]*(?:<(?!\/script>)[^<]*)*<\/script>|<style\b[^>]*>[^<]*(?:<(?!\/style>)[^<]*)*<\/style>/gi, ' ');
  const hits = (text.match(new RegExp(WORD, 'gi')) || []).length;
  if (r.body.length < 1500 || hits < 2) return { ok: false, why: hits ? 'thin page' : 'no results in the page' };
  if (/captcha|are you a robot|unusual traffic|access denied|enable javascript to|verify you are human|just a moment/i.test(text.slice(0, 6000)) && hits < 4) return { ok: false, why: 'wall' };
  return { ok: true, walls, hits: Math.min(hits, 99) };
}

const todo = list.filter((x) => !(x.tpl in out));
let i = 0, done = 0, okN = Object.values(out).filter((v) => v.ok).length;
const save = () => writeFileSync(outFile, JSON.stringify(out));
async function worker() {
  for (;;) { const x = todo[i++]; if (!x) return;
    try { out[x.tpl] = await test(x); } catch (e) { out[x.tpl] = { ok: false, why: 'error' }; }
    if (out[x.tpl].ok) okN++;
    if (++done % 250 === 0) { save(); console.log(`${done}/${todo.length} tested · ${okN} open`); } }
}
await Promise.all(Array.from({ length: Number(conc) }, worker));
save();
const why = {}; for (const v of Object.values(out)) { const k = v.ok ? 'open' : v.why.replace(/\d+/, (n) => n); why[k] = (why[k] || 0) + 1; }
console.log(`done: ${Object.keys(out).length} doors`, Object.entries(why).sort((a, b) => b[1] - a[1]).slice(0, 14));
