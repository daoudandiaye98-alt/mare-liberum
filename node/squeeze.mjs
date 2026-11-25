// Mare Liberum · squeeze: text, HTML or JSON an agent already holds, made smaller (since 3.35, the engine room's lever
// "squeeze"; the reader's levers "delta" and "budget" use the same parts, see node/press.mjs)
// Lossless steps first, each measured (node/engine.mjs, one rule for every lever):
//   HTML       → the lean reader's Markdown (node/lean.mjs leanMarkdown: the page's own text, its facts and links once)
//   JSON       → minified; TOON where that spares at least 20 % more, once node/toon.mjs is there (the hook below)
//   text, Markdown → whitespace normalised; a line or a paragraph said again word for word is said once (40 characters
//                and more, never inside code or a table); tracking parameters cut from every link (lean.mjs cleanUrl)
// Lossy steps only when the agent names them, and then said so:
//   q        a question: the text in blocks (paragraphs, list groups, tables, code), each scored with BM25 against the
//            question (stop words English and German left out), the best blocks kept in their order, under their headings
//   budget   tokens: blocks kept greedily until the budget; each gap marked "[… n tokens left out]". Without q: every
//            heading, the first block of each section, then the densest blocks
// Also here: fitBudget (the same for the reader, /r/?budget=) and diffLines (a line diff, capped: past the cap it says
// "changed too much" and the whole is sent). No dependencies; nothing here keeps or writes anything.
import { leanMarkdown, cleanUrl } from './lean.mjs';
import { savingOf, tokensOf, bytesOf, RATIO } from './engine.mjs';

// ---------------------------------------------------------------- TOON (E1's node/toon.mjs), when it is there
// HOOK: one guarded dynamic import, so this file works alone and after the branches meet. Without the file JSON is minified
// only. TOON is taken only where it is at least TOON_MIN_GAIN smaller than the minified JSON (lossless: E1 proves the round
// trip).
let TOON = await import('./toon.mjs').then((m) => (typeof m?.toToon === 'function' ? m : null)).catch(() => null);
// the proofs hand in the reference implementation to prove the path; nothing else calls this
export function toonHook(m) { TOON = m && typeof m.toToon === 'function' ? m : null; return !!TOON; }
export const toonReady = () => !!TOON;
function toonOf(v) { if (!TOON) return null; try { const t = TOON.toToon(v); return typeof t === 'string' && t.length ? t : null; } catch { return null; } }
// TOON only where it spares at least this share of the compact JSON's tokens (integrator, 3.35, from the research: TOON
// saves on tables, is larger or barely smaller on semi-uniform and nested data, and models read it a little less surely).
// E1's node/toon.mjs names the threshold; until the branches meet this one stands, and theirs wins once it is there
export const TOON_MIN_GAIN = 0.2;
export const toonGain = () => { for (const v of [TOON?.TOON_MIN_GAIN, TOON?.TOON_MIN_SAVING, TOON?.TOON_THRESHOLD, TOON?.TOON?.minGain, TOON?.TOON?.minSaving, TOON?.TOON?.threshold]) if (Number.isFinite(v) && v > 0 && v < 1) return v; return TOON_MIN_GAIN; };

// ---------------------------------------------------------------- limits
export const SQUEEZE = Object.freeze({
  maxBytes: 1024 * 1024,    // what /compress takes (the node's own limit for any body, serve.mjs MAX_BODY)
  jsonDepth: 64,            // JSON nested deeper is refused before it is parsed
  repeatMin: 40,            // a line or paragraph is said once only from this many characters on
  minBudget: 50,            // a budget below this many tokens is raised to it (said so)
  diffCells: 4_000_000,     // the line diff's ceiling: (lines a) × (lines b) after the common start and end
  diffEdits: 1000,          // and the most lines changed it still says line by line
});
export class SqueezeError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }

// ---------------------------------------------------------------- what kind of text it is
const KINDS = { html: 'html', htm: 'html', json: 'json', md: 'md', markdown: 'md', text: 'text', txt: 'text', plain: 'text' };
export const kindOf = (t) => KINDS[String(t || '').toLowerCase().replace(/^(text|application)\//, '').replace(/;.*$/, '').trim()] || null;
// the deepest nesting of a JSON text, counted without parsing it (a string's brackets do not count); stops past max
export function jsonDepth(s, max = SQUEEZE.jsonDepth) {
  let d = 0, top = 0, str = false;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (str) { if (c === 92) i++; else if (c === 34) str = false; continue; }
    if (c === 34) str = true;
    else if (c === 123 || c === 91) { if (++d > top) { top = d; if (top > max) return top; } }
    else if (c === 125 || c === 93) d--;
  }
  return top;
}
const TAGS = /<\/?(p|div|span|a|li|ul|ol|h[1-6]|table|tr|td|th|br|section|article|main|nav|header|footer|img|strong|em|b|i|form|button|script|style|meta|link)\b[^>]*>/gi;
export function detectType(s) {
  const t = String(s ?? '').trimStart();
  if (/^[[{]/.test(t)) { if (jsonDepth(t) > SQUEEZE.jsonDepth) return 'json'; try { JSON.parse(t); return 'json'; } catch {} }
  if (/^(<!doctype\s+html|<html[\s>]|<head[\s>]|<body[\s>]|<\?xml[^>]*>\s*<html)/i.test(t)) return 'html';
  if ((t.slice(0, 200_000).match(TAGS) || []).length >= 3) return 'html';
  if (/^#{1,6}\s|^\s*[-*+]\s|^\s*\d+[.)]\s|^```|^>\s|^\s*\|.*\|\s*$/m.test(t) || /\]\((https?:\/\/|\/)/.test(t)) return 'md';
  return 'text';
}

// ---------------------------------------------------------------- lossless: whitespace, repeats, tracking
const FENCE = /^\s*(`{3,}|~{3,})/;
const isRow = (l) => /^\s*\|.*\|\s*$/.test(l) || (/\S \| \S/.test(l) && !/^\s*([-*+]|\d+[.)])\s/.test(l));
// line ends, the byte order mark, no-break spaces; spaces at the end of a line and runs of spaces inside one (its indent
// and code stay as they are); three and more empty lines become one
export function normalise(s) {
  const lines = String(s ?? '').replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n'), out = [];
  let fence = null;
  for (const line of lines) {
    const f = FENCE.exec(line);
    if (fence) { if (f && f[1][0] === fence[0] && f[1].length >= fence.length) fence = null; out.push(line.replace(/[ \t]+$/, '')); continue; }
    if (f) { fence = f[1]; out.push(line.replace(/[ \t]+$/, '')); continue; }
    const ind = /^[ \t]*/.exec(line)[0];
    out.push(ind + line.slice(ind.length).replace(/ /g, ' ').replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+$/, ''));
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '').replace(/\n+$/, '');
}
// paragraphs (split at empty lines; a code block stays whole, with its empty lines)
function paragraphs(s) {
  const out = []; let cur = [], fence = null, code = false;
  const flush = () => { if (cur.length) out.push({ text: cur.join('\n'), code }); cur = []; code = false; };
  for (const line of String(s).split('\n')) {
    const f = FENCE.exec(line);
    if (fence) { cur.push(line); if (f && f[1][0] === fence[0] && f[1].length >= fence.length) { fence = null; flush(); } continue; }
    if (f) { flush(); fence = f[1]; code = true; cur.push(line); continue; }
    if (!line.trim()) { flush(); continue; }
    cur.push(line);
  }
  flush();
  return out;
}
// a paragraph or a line said again word for word is said once (from repeatMin characters on; never code, a table row or a
// heading: there the place carries meaning)
export function sayOnce(s, { min = SQUEEZE.repeatMin } = {}) {
  const seenP = new Set(), seenL = new Set(), out = [];
  for (const p of paragraphs(s)) {
    if (p.code) { out.push(p.text); continue; }
    const k = p.text.trim();
    if (k.length >= min && seenP.has(k)) continue;
    seenP.add(k);
    const lines = p.text.split('\n').filter((l) => { const t = l.trim(); if (t.length < min || isRow(l) || /^#{1,6}\s/.test(t)) return true; if (seenL.has(t)) return false; seenL.add(t); return true; });
    if (lines.length) out.push(lines.join('\n'));
  }
  return out.join('\n\n');
}
// every web address without its tracking parameters (utm_…, gclid, fbclid …: the reader's own list)
const URLS = /https?:\/\/[^\s<>"'`)\]]+/g;
// (and every path link of Markdown, "](/path?…)")
const PATH_LINK = /\]\((\/[^)\s]*)\)/g, HERE = 'https://p.invalid';
export const cutTracking = (s) => String(s ?? '').replace(URLS, (u) => { const tail = /[.,;:!?]+$/.exec(u)?.[0] || '', bare = tail ? u.slice(0, -tail.length) : u; return cleanUrl(bare) + tail; })
  .replace(PATH_LINK, (m, p) => { if (!p.includes('?')) return m; const c = cleanUrl(HERE + p); return c.startsWith(HERE) ? `](${c.slice(HERE.length)})` : m; });

// ---------------------------------------------------------------- blocks, terms, BM25
// a Markdown text as blocks: headings, paragraphs, list groups, tables, code; each with the headings it stands under
export function blocksOf(md) {
  const out = []; let cur = null, fence = null;
  const flush = () => { if (cur) { cur.text = cur.lines.join('\n'); delete cur.lines; out.push(cur); cur = null; } };
  for (const line of String(md ?? '').split('\n')) {
    const f = FENCE.exec(line);
    if (fence) { cur.lines.push(line); if (f && f[1][0] === fence[0] && f[1].length >= fence.length) { fence = null; flush(); } continue; }
    if (f) { flush(); cur = { kind: 'code', lines: [line] }; fence = f[1]; continue; }
    if (!line.trim()) { flush(); continue; }
    const h = /^(#{1,6})\s+(.*)$/.exec(line.trim());
    if (h) { flush(); out.push({ kind: 'heading', level: h[1].length, text: line.trim(), title: h[2] }); continue; }
    const kind = /^\s*([-*+]|\d+[.)])\s/.test(line) ? 'list' : isRow(line) ? 'table' : 'para';
    if (cur && (cur.kind === kind || (cur.kind === 'list' && /^\s+\S/.test(line)))) { cur.lines.push(line); continue; }
    flush(); cur = { kind, lines: [line] };
  }
  flush();
  // the headings above each block (the nearest one of each higher level), and the section each block opens or follows
  const stack = []; let section = -1;
  out.forEach((b, i) => {
    if (b.kind === 'heading') { while (stack.length && out[stack[stack.length - 1]].level >= b.level) stack.pop(); b.under = [...stack]; stack.push(i); section = i; b.section = i; return; }
    b.under = [...stack]; b.section = section;
  });
  return out;
}
const EN = 'a about above after again against all also am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers herself him himself his how i if in into is it its itself just me more most my myself no nor not now of off on once only or other our ours ourselves out over own same she should so some such than that the their theirs them themselves then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours yourself yourselves get got can\'t don\'t isn\'t does doesn\'t please tell show find give want need know'.split(' ');
const DE = 'aber alle allem allen aller alles als also am an ander andere anderem anderen anderer anderes auch auf aus bei bin bis bist da damit dann das dass dein deine dem den der des dich die dies diese diesem diesen dieser dieses dir doch dort du durch ein eine einem einen einer eines er es etwas euch euer eure für gegen gewesen hab habe haben hat hatte hatten hier hin hinter ich ihm ihn ihnen ihr ihre im in indem ins ist ja jede jedem jeden jeder jedes jetzt kann kein keine können man manche mein meine mich mir mit muss musste nach nicht nichts noch nun nur ob oder ohne sehr sein seine sich sie sind so solche soll sollte sondern sonst über um und uns unser unter vom von vor war waren warum was weil weiter welche welchem welchen welcher welches wenn wer werde werden wie wieder will wir wird wirst wo wollen wollte würde würden zu zum zur zwar zwischen gibt wie viel welche'.split(' ');
export const STOP_WORDS = new Set([...EN, ...DE]);
// a light stem, the same for the question and the text: hours/hour, opening/open, Preise/Preis, Zeiten/Zeit
const stem = (w) => { if (w.length < 5 || /^\d/.test(w)) return w; for (const s of ['ings', 'ing', 'es', 'en', 'er', 'ed', 's', 'e', 'n']) if (w.endsWith(s) && w.length - s.length >= 4) return w.slice(0, -s.length); return w; };
export const termsOf = (s) => (String(s ?? '').toLowerCase().normalize('NFKC').match(/[\p{L}\p{N}]+/gu) || []).filter((w) => !STOP_WORDS.has(w) && (w.length > 1 || /\d/.test(w))).map(stem);
// BM25 (k1 1.2, b 0.75) of each document (a list of terms) against the question
export function bm25(docs, q, { k1 = 1.2, b = 0.75 } = {}) {
  const qs = [...new Set(termsOf(q))]; if (!qs.length || !docs.length) return docs.map(() => 0);
  const N = docs.length, tfs = docs.map((d) => { const m = new Map(); for (const w of d) m.set(w, (m.get(w) || 0) + 1); return m; });
  const avg = docs.reduce((s, d) => s + d.length, 0) / N || 1, df = new Map();
  for (const m of tfs) for (const w of m.keys()) df.set(w, (df.get(w) || 0) + 1);
  return tfs.map((m, i) => { let s = 0; for (const w of qs) { const f = m.get(w); if (!f) continue; const n = df.get(w) || 0; s += Math.log(1 + (N - n + 0.5) / (n + 0.5)) * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * docs[i].length) / avg))); } return s; });
}

// ---------------------------------------------------------------- lossy: keep some blocks, mark the gaps
const SEP = 2;                                   // the empty line between two blocks, in bytes
const gapLine = (bytes) => `[… ${Math.max(1, Math.round(bytes / (RATIO.md || 4))).toLocaleString('en-US')} tokens left out]`;
const GAP_MAX = bytesOf(gapLine(1e9)) + SEP;     // what one gap mark can cost at most, in bytes
// the kept blocks in their order, each gap between them marked with how much it left out
function render(blocks, keep) {
  const parts = []; let gap = 0;
  blocks.forEach((b, i) => { if (keep.has(i)) { if (gap) parts.push(gapLine(gap)); gap = 0; parts.push(b.text); } else gap += bytesOf(b.text) + SEP; });
  if (gap) parts.push(gapLine(gap));
  return parts.join('\n\n');
}
// a block with what it needs to stand: the headings above it
const withHeads = (blocks, i) => [...(blocks[i].under || []), i];
// how much one block says per byte: different words, numbers, links
const density = (b) => { const t = termsOf(b.text), nums = (b.text.match(/\d+(?:[.,]\d+)?/g) || []).length, links = (b.text.match(/\]\(|https?:\/\//g) || []).length; return (new Set(t).size + 2 * nums + links) / (bytesOf(b.text) + 1); };
// the order blocks are taken in: with a question, the ones that answer it best (blocks without a match are not taken); without
// one (or when nothing matches), the page's first block (its lead, cut if it must be), every heading, then the first block of
// each section, then the densest
function orderOf(blocks, q) {
  const idx = blocks.map((_, i) => i);
  if (q && termsOf(q).length) {
    const docs = blocks.map((b) => [...termsOf(b.text), ...(b.under || []).flatMap((h) => termsOf(blocks[h].title))]);
    const sc = bm25(docs, q), best = idx.filter((i) => blocks[i].kind !== 'heading' && sc[i] > 0).sort((a, b) => sc[b] - sc[a] || a - b);
    if (best.length) return { order: best, scores: sc, matched: best.length };
  }
  const heads = idx.filter((i) => blocks[i].kind === 'heading'), firsts = [], seen = new Set();
  for (const i of idx) { const b = blocks[i]; if (b.kind === 'heading' || seen.has(b.section)) continue; seen.add(b.section); firsts.push(i); }
  const rest = idx.filter((i) => blocks[i].kind !== 'heading' && !firsts.includes(i)).map((i) => [i, density(blocks[i])]).sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([i]) => i);
  // the lead: the first paragraph that says a sentence (a page may open with a list of links: that is no lead)
  const prose = (t) => t.replace(/\]\([^)]*\)/g, ']').replace(/https?:\/\/\S+/g, '');
  const li = idx.find((i) => blocks[i].kind === 'para' && prose(blocks[i].text).length >= 80 && /\p{L}[.!?](\s|$)/u.test(prose(blocks[i].text))), lead = li != null ? [li] : firsts.slice(0, 1);
  const without = (xs) => xs.filter((i) => !lead.includes(i));
  return { order: [...lead, ...heads, ...without(firsts), ...without(rest)], scores: null, matched: 0 };
}
// the part of a block that fits into room bytes: its sentences (lines of a list or table) that answer the question best, else
// its first ones, in their order; what it leaves out marked like a gap. null when too little fits to say anything
const MAX_CUTS = 3;
function cutTo(b, room, qs) {
  const units = b.kind === 'para' ? b.text.match(/[^.!?]+(?:[.!?]+["')\]]*(?:\s+|$)|$)/g)?.filter((u) => u.trim()) || [b.text] : b.text.split('\n');
  if (units.length < 2 || room < 100) return null;
  const join = b.kind === 'para' ? '' : '\n', order = units.map((u, i) => i);
  if (qs?.size) { const hits = units.map((u) => termsOf(u).filter((w) => qs.has(w)).length); order.sort((x, y) => hits[y] - hits[x] || x - y); }
  const pick = new Set(); let size = 0;
  for (const i of order) { const c = bytesOf(units[i]) + 1; if (size + c + GAP_MAX > room) continue; pick.add(i); size += c; }
  if (!pick.size || size < 60) return null;
  const parts = []; let gap = 0;
  units.forEach((u, i) => { if (pick.has(i)) { if (gap) parts.push(b.kind === 'para' ? `${gapLine(gap)} ` : gapLine(gap)); gap = 0; parts.push(b.kind === 'para' ? u : u); } else gap += bytesOf(u); });
  if (gap) parts.push(b.kind === 'para' ? ` ${gapLine(gap)}` : gapLine(gap));
  const text = (b.kind === 'para' ? parts.join('') : parts.join(join)).replace(/ +/g, ' ').trim();
  return bytesOf(text) <= room ? text : null;
}
// fit a Markdown text into a budget of tokens (counted the sea's one way: UTF-8 bytes over the bench ratio for Markdown)
// → { out, lossy, kept, of, left (tokens left out), budget, tokens, matched }
export function fitBudget(markdown, { q = '', budget } = {}) {
  const md = String(markdown ?? ''), B = Math.max(SQUEEZE.minBudget, Math.floor(Number(budget) || 0)), all = tokensOf('md', md);
  const blocks = blocksOf(md), of = blocks.filter((b) => b.kind !== 'heading').length;
  if (all <= B) return { out: md, lossy: false, kept: of, of, left: 0, budget: B, tokens: all, matched: null };
  const cap = Math.floor(B * (RATIO.md || 4)), { order, matched } = orderOf(blocks, q), keep = new Set();
  // greedy: a block goes in with the headings above it while the bytes, with one gap mark per gap at most, stay under the cap
  let used = 0, gaps = 0;
  const gapsOf = (k) => { let n = 0, inGap = false; for (let i = 0; i < blocks.length; i++) { if (k.has(i)) inGap = false; else if (!inGap) { n++; inGap = true; } } return n; };
  // a block too long for what is left goes in cut (its best sentences, at most MAX_CUTS blocks), not at all if too little fits
  const qs = matched ? new Set(termsOf(q)) : null; let cuts = 0;
  for (const i of order) {
    const add = withHeads(blocks, i).filter((j) => !keep.has(j)); if (!add.length) continue;
    const cost = add.reduce((s, j) => s + bytesOf(blocks[j].text) + SEP, 0), next = new Set([...keep, ...add]), g = gapsOf(next);
    if (used + cost + g * GAP_MAX > cap) {
      if (cuts >= MAX_CUTS || !['para', 'list', 'table'].includes(blocks[i].kind)) continue;
      const heads = cost - bytesOf(blocks[i].text) - SEP, t = cutTo(blocks[i], cap - used - heads - SEP - g * GAP_MAX, qs); if (!t) continue;
      blocks[i] = { ...blocks[i], text: t, cut: true }; cuts++;
      for (const j of add) keep.add(j); used += heads + bytesOf(t) + SEP; gaps = g; continue;
    }
    for (const j of add) keep.add(j); used += cost; gaps = g;
  }
  let out = render(blocks, keep);
  // the measure decides: while the answer is over the budget, the last block taken goes out again
  const taken = order.filter((i) => keep.has(i)), own = new Set(taken);
  while (tokensOf('md', out) > B && taken.length) { const i = taken.pop(); keep.delete(i); for (const h of blocks[i].under || []) if (!own.has(h) && ![...keep].some((j) => (blocks[j].under || []).includes(h))) keep.delete(h); out = render(blocks, keep); }
  if (tokensOf('md', out) > B) out = gapLine(bytesOf(md));
  const kept = [...keep].filter((i) => blocks[i].kind !== 'heading').length;
  return { out, lossy: true, kept, of, left: Math.max(0, all - tokensOf('md', out)), budget: B, tokens: tokensOf('md', out), matched, gaps };
}
// a question without a budget: the blocks that answer it (BM25 at least 30 % of the best), in their order, under their
// headings; nothing matches → nothing is left out
export function focusOn(markdown, q) {
  const md = String(markdown ?? ''), blocks = blocksOf(md), of = blocks.filter((b) => b.kind !== 'heading').length;
  const { order, scores, matched } = orderOf(blocks, q);
  if (!matched) return { out: md, lossy: false, kept: of, of, left: 0, matched: 0 };
  const top = scores[order[0]], keep = new Set();
  for (const i of order) if (scores[i] >= top * 0.3) for (const j of withHeads(blocks, i)) keep.add(j);
  const out = render(blocks, keep), kept = [...keep].filter((i) => blocks[i].kind !== 'heading').length;
  if (kept >= of) return { out: md, lossy: false, kept: of, of, left: 0, matched };
  return { out, lossy: true, kept, of, left: Math.max(0, tokensOf('md', md) - tokensOf('md', out)), matched };
}

// ---------------------------------------------------------------- squeeze
const FORM = { html: 'html', json: 'json', md: 'md', text: 'text' };
// input: a text (or a JSON value); type: html | json | md | text (else found out); q, budget: the lossy steps, only when
// named; url: the page an HTML text came from (its links stay whole)
// → { out, form, type, steps: [{ step, lossless, before, after }], lossy, saving, parts: { lossless, lossy }, note }
export function squeeze(input, { type, q, budget, url } = {}) {
  const given = kindOf(type), isValue = input !== null && typeof input === 'object';
  const src = isValue ? JSON.stringify(input) : String(input ?? '');
  const kind = given || (isValue ? 'json' : detectType(src));
  const beforeForm = FORM[kind] || 'text', steps = [], notes = [];
  let cur = src, form = beforeForm;
  // one step: taken only when it makes the text smaller (in tokens of its form), each measured
  const step = (name, next, nextForm = form, lossless = true, force = false) => {
    const before = tokensOf(form, cur), after = tokensOf(nextForm, next);
    if (!(after < before) && !force) return false;
    steps.push({ step: name, lossless, before, after }); cur = next; form = nextForm; return true;
  };
  if (kind === 'json') {
    if (jsonDepth(src) > SQUEEZE.jsonDepth) throw new SqueezeError(`JSON nested deeper than ${SQUEEZE.jsonDepth} levels is not taken`);
    let v; if (isValue) v = input; else { try { v = JSON.parse(src); } catch { throw new SqueezeError('this is not valid JSON (send it as text, or fix it)'); } }
    const min = JSON.stringify(v) ?? '';
    step('json minified', min, 'json');
    const t = toonOf(v); if (t != null && tokensOf('toon', t) <= (1 - toonGain()) * tokensOf('json', cur)) step('json as TOON', t, 'toon');
    if (q || budget) notes.push('a question or a budget is applied to text and HTML; JSON is only made smaller without loss');
  } else {
    if (kind === 'html') { let base = 'https://page.invalid/'; try { if (url) base = new URL(String(url)).href; } catch {} const lean = leanMarkdown(src, base); if (lean.md.trim()) step('html to Markdown (the lean reader)', lean.md, 'md', true, true); else notes.push('the HTML holds no text the lean reader keeps'); }
    step('whitespace normalised', normalise(cur));
    step('repeats said once', sayOnce(cur));
    step('tracking parameters cut', cutTracking(cur));
  }
  const clean = cur, cleanForm = form;
  if (kind !== 'json' && (budget || q)) {
    const b = Number(budget);
    if (budget != null && budget !== '' && Number.isFinite(b) && b > 0) {
      if (b < SQUEEZE.minBudget) notes.push(`a budget below ${SQUEEZE.minBudget} tokens is taken as ${SQUEEZE.minBudget}`);
      const f = fitBudget(cur, { q, budget: b });
      if (f.lossy) { step(q ? 'fitted to the budget, the question first (lossy)' : 'fitted to the budget (lossy)', f.out, form, false); notes.push(`${f.kept} of ${f.of} blocks kept, about ${f.left.toLocaleString('en-US')} tokens left out`); if (q && !f.matched) notes.push('nothing matched the question: kept by headings, first blocks and density'); }
    } else if (q) {
      const f = focusOn(cur, q);
      if (f.lossy) { step('kept what answers the question (lossy)', f.out, form, false); notes.push(`${f.kept} of ${f.of} blocks kept, about ${f.left.toLocaleString('en-US')} tokens left out`); }
      else if (!f.matched) notes.push('nothing matched the question: nothing was left out');
    }
  }
  const lossy = steps.some((s) => !s.lossless);
  const saving = savingOf('squeeze', { before: src, beforeForm, after: cur, afterForm: form, lossy });
  const parts = { lossless: savingOf('squeeze', { before: src, beforeForm, after: clean, afterForm: cleanForm, lossy: false }), lossy: lossy ? savingOf('squeeze', { before: clean, beforeForm: cleanForm, after: cur, afterForm: form, lossy: true }) : null };
  return { out: cur, form, type: kind, steps, lossy, saving, parts, note: notes.join('; ') || undefined };
}

// ---------------------------------------------------------------- the line diff
// Myers' diff over lines, after the common start and end; capped: past diffCells or diffEdits it says so (tooMuch) and
// the caller sends the whole. → { tooMuch, ops: [{ op: '=' | '-' | '+', line, a, b }] } (a, b: line numbers, from 0)
export function diffLines(a, b, { cells = SQUEEZE.diffCells, edits = SQUEEZE.diffEdits } = {}) {
  const A = Array.isArray(a) ? a : String(a ?? '').split('\n'), Bl = Array.isArray(b) ? b : String(b ?? '').split('\n');
  let s = 0; while (s < A.length && s < Bl.length && A[s] === Bl[s]) s++;
  let e = 0; while (e < A.length - s && e < Bl.length - s && A[A.length - 1 - e] === Bl[Bl.length - 1 - e]) e++;
  const x = A.slice(s, A.length - e), y = Bl.slice(s, Bl.length - e), n = x.length, m = y.length;
  const ops = []; for (let i = 0; i < s; i++) ops.push({ op: '=', line: A[i], a: i, b: i });
  const tail = () => { for (let i = 0; i < e; i++) ops.push({ op: '=', line: A[A.length - e + i], a: A.length - e + i, b: Bl.length - e + i }); };
  if (!n && !m) { tail(); return { tooMuch: false, ops, changed: 0 }; }
  if (n * m > cells && Math.min(n, m) > 0 && n + m > edits) return { tooMuch: true, ops: null, changed: n + m };
  const max = Math.min(n + m, edits), off = max + 1, v = new Int32Array(2 * max + 3), trace = [];
  let D = -1;
  outer: for (let d = 0; d <= max; d++) {
    trace.push(v.slice(off - d - 1, off + d + 2));
    for (let k = -d; k <= d; k += 2) {
      let i = k === -d || (k !== d && v[off + k - 1] < v[off + k + 1]) ? v[off + k + 1] : v[off + k - 1] + 1, j = i - k;
      while (i < n && j < m && x[i] === y[j]) { i++; j++; }
      v[off + k] = i;
      if (i >= n && j >= m) { D = d; break outer; }
    }
  }
  if (D < 0) return { tooMuch: true, ops: null, changed: n + m };
  // back from the end: each step of d was one line out (-) or one line in (+), around runs of equal lines
  const mid = []; let i = n, j = m;
  for (let d = D; d >= 0; d--) {
    const t = trace[d], at = (k) => t[k + d + 1], k = i - j;
    const pk = k === -d || (k !== d && at(k - 1) < at(k + 1)) ? k + 1 : k - 1, pi = d === 0 ? 0 : at(pk), pj = pi - pk;
    while (i > pi && j > pj) { i--; j--; mid.push({ op: '=', line: x[i], a: s + i, b: s + j }); }
    if (d > 0) { if (i === pi) { j--; mid.push({ op: '+', line: y[j], a: s + i, b: s + j }); } else { i--; mid.push({ op: '-', line: x[i], a: s + i, b: s + j }); } }
  }
  mid.reverse(); ops.push(...mid); tail();
  return { tooMuch: false, ops, changed: D };
}
