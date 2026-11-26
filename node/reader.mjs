// Mare Liberum · the reader: any public page as clean Markdown for an agent — the membrane agents pass on their way through the web.
// It follows robots.txt, reads one page per call, keeps nothing but a short cache and the name of the site that was read.
// A PDF is read too (since 3.59): its text layer, as Markdown, beside the node (node/pdf.mjs).
import { safeHost, publicDns, grab, robotsGroups, robotsAllows, readPage } from './check.mjs';
import { aside } from './aside.mjs';
import { entities, leanMarkdown, parseHtml, attrs, LEAN_MAX } from './lean.mjs';
export { entities };

export const READER_UA = 'MareLiberum-Reader/1.0 (+https://mareliberum.dev/read; reads one page for an agent and follows robots.txt)';
export const READER_TOKEN = 'MareLiberum-Reader';
// the largest PDF the reader takes (since 3.59): a PDF longer than this is read up to here, and says so
export const PDF_MAX = 12_000_000;

const abs = (href, base) => { try { const u = new URL(entities(href).trim(), base); return /^https?:$/.test(u.protocol) ? u.href : null; } catch { return null; } };
const inline = (s) => entities(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
// the lines of a code block as the page wrote them: every line keeps what stands in front of it (the indentation of Python
// and YAML, the tab of a Makefile's recipe) and what stands inside it; only what ends a line is cut, a no-break space (as
// &#160; writes it) is a space, and the blank lines before the first line and after the last one go (keepEdges: they stay)
const codeLines = (s, keepEdges = false) => {
  const ls = String(s).replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').split('\n').map((l) => l.trimEnd());
  let a = 0, b = ls.length; if (!keepEdges) { while (a < b && !ls[a]) a++; while (b > a && !ls[b - 1]) b--; }
  return ls.slice(a, b).join('\n');
};

// HTML to Markdown, plainly: the main part of the page, headings, paragraphs, lists, links, code; no scripts, no menus.
// menus: false keeps runs of links (a page whose main part holds no menu, like the pages of the sea itself)
// Code keeps its lines (since the fix of 26.11.2026): a <pre> block is held aside whole while the lines around it are made
// tidy (spaces run together, each line trimmed, menus out, blank lines at most one), and set back as it stands. Fences
// written in a page's own text stay text, as before (verify-3.40 B1: a "~~~" scene break is no code). Everything outside
// code is written as before, byte for byte; a NUL in the page is dropped first, so that no page can forge a mark.
export function toMarkdown(html, base, { menus = true } = {}) {
  let h = String(html || '').replace(/\u0000/g, '').replace(/<!--[\s\S]*?-->/g, ' ');
  const pick = (tag) => { let best = ''; for (const m of h.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi'))) if (m[1].length > best.length) best = m[1]; return best; };
  const main = pick('main') || pick('article'), region = main && main.replace(/<[^>]+>/g, '').trim().length > 200 ? main : (/<body\b[^>]*>([\s\S]*)<\/body>/i.exec(h)?.[1] || h);
  h = region.replace(/<(script|style|noscript|svg|template|iframe|canvas|select|button|object|embed)\b[\s\S]*?<\/\1>/gi, ' ');
  if (!main) h = h.replace(/<(nav|header|footer|aside|form)\b[\s\S]*?<\/\1>/gi, ' ');
  const keep = []; const hold = (t) => `\u0000${keep.push(t) - 1}\u0000`;
  // a code block, held aside until the end: one mark on a line of its own (\u0000c<n>\u0000), its fences inside it
  const codes = []; const aside = (t) => `\u0000c${codes.push(t) - 1}\u0000`, back = (s) => String(s).replace(/\u0000c(\d+)\u0000/g, (m, k) => back(codes[k] ?? ''));
  h = h.replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, (_, c) => hold(`\n\n${aside(`\`\`\`\n${codeLines(entities(c.replace(/<[^>]+>/g, '')))}\n\`\`\``)}\n\n`));
  h = h.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_, c) => hold(`\`${inline(c)}\``));
  h = h.replace(/<a\b[^>]*?href\s*=\s*("([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi, (_, __, d, s2, t) => { const u = abs(d ?? s2, base), x = inline(t); return x ? (u ? hold(`[${x.replace(/[[\]]/g, '')}](${u})`) : x) : ''; });
  h = h.replace(/<img\b[^>]*?alt\s*=\s*("([^"]*)"|'([^']*)')[^>]*>/gi, (_, __, a, b) => { const x = inline(a ?? b ?? ''); return x ? ` [image: ${x}] ` : ' '; });
  h = h.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, t) => { const x = inline(back(t.replace(/\u0000(\d+)\u0000/g, (m, i) => keep[i]))); return x ? hold(`\n\n${'#'.repeat(Number(n))} ${x}\n\n`) : ''; });
  h = h.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, t) => { const x = inline(t); return x ? ` **${x}** ` : ''; }).replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, t) => { const x = inline(t); return x ? ` *${x}* ` : ''; });
  h = h.replace(/<li\b[^>]*>/gi, '\n- ').replace(/<br\s*\/?>/gi, '\n').replace(/<(td|th)\b[^>]*>/gi, ' | ').replace(/<\/tr>/gi, '\n').replace(/<blockquote\b[^>]*>/gi, '\n\n> ')
    .replace(/<\/?(p|div|section|article|main|ul|ol|table|tbody|thead|tr|blockquote|figure|figcaption|dl|dt|dd|header|footer|nav|aside|form|fieldset|details|summary)\b[^>]*>/gi, '\n\n').replace(/<[^>]+>/g, ' ');
  let md = entities(h).replace(/\u0000(\d+)\u0000/g, (m, i) => keep[i]).replace(/\u0000(\d+)\u0000/g, (m, i) => keep[i]);
  let ls = md.split('\n').map((l) => l.replace(/[ \t ]+/g, ' ').trim());
  // menus: runs of three or more short link-only items (blank lines between them do not break a run) are navigation, not content
  const navItem = (l) => /^(- )?\[[^\]]{1,40}\]\([^)]+\)$/.test(l) || /^-$/.test(l);
  const drop = new Set();
  for (let i = 0; menus && i < ls.length;) {
    if (!navItem(ls[i])) { i++; continue; }
    let j = i, n = 0; while (j < ls.length && (navItem(ls[j]) || ls[j] === '')) { if (ls[j].length > 2) n++; j++; }
    if (n >= 3) for (let k = i; k < j; k++) drop.add(k);
    i = j;
  }
  md = ls.filter((_, k) => !drop.has(k)).join('\n').replace(/\n(- )?\n(?=- )/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return back(md);
}

// ---------------------------------------------------------------- the shapes other readers are asked for (since 3.38)
// A request in the form of another reader (Jina's X-Target-Selector and X-Remove-Selector, Firecrawl's includeTags and
// excludeTags, node/compat.mjs) narrows the page before it is written. Only a safe part of CSS is read: a tag, #id, .class
// and their combinations (div.note, article#main, .a.b), several split by commas. Anything else (descendants, attributes,
// pseudo-classes) is not read and is named back as ignored. It runs beside the node with the page (see digest).
const SIMPLE = /^([a-z][a-z0-9-]*)?((?:[#.][\w-]+)*)$/i;
export function selectorsOf(list) {
  const ok = [], bad = [];
  for (const raw of [].concat(list ?? []).flatMap((x) => String(x ?? '').split(',')).map((x) => x.trim()).filter(Boolean).slice(0, 40)) {
    const m = SIMPLE.exec(raw); if (!m || raw.length > 120 || (!m[1] && !m[2])) { bad.push(raw.slice(0, 80)); continue; }
    const parts = m[2].match(/[#.][\w-]+/g) || [], ids = parts.filter((p) => p[0] === '#').map((p) => p.slice(1));
    if (ids.length > 1) { bad.push(raw.slice(0, 80)); continue; }
    ok.push({ tag: m[1] ? m[1].toLowerCase() : null, id: ids[0] || null, classes: parts.filter((p) => p[0] === '.').map((p) => p.slice(1)) });
  }
  return { ok, bad };
}
const VOIDS = new Set('area base br col embed hr img input link meta param source track wbr keygen command'.split(' '));
const isMatch = (el, s) => { if (s.tag && el.tag !== s.tag) return false; if (!s.id && !s.classes.length) return true; const o = attrs(el); if (s.id && o.id !== s.id) return false; const cls = ` ${String(o.class || '').replace(/\s+/g, ' ')} `; return s.classes.every((c) => cls.includes(` ${c} `)); };
// a box written back as markup (the insides of scripts, styles and pictures are never kept: the parser skips them)
const outer = (n) => { if (typeof n === 'string') return n; if (n.tag === '#root') return n.kids.map(outer).join(''); const open = `<${n.tag}${n.a || ''}>`; return VOIDS.has(n.tag) ? open : `${open}${n.kids.map(outer).join('')}</${n.tag}>`; };
// target: keep only the boxes the selectors name (each once, the outermost); remove: take out the boxes they name.
// → { html, matched, bad }: the page as it is when nothing can be done (no selector read, nothing matched)
export function shapeHtml(html, { target = [], remove = [] } = {}) {
  const T = selectorsOf(target), R = selectorsOf(remove), bad = [...T.bad, ...R.bad];
  if (!T.ok.length && !R.ok.length) return { html, matched: 0, bad };
  const root = parseHtml(html, { max: LEAN_MAX }); let removed = 0;
  if (R.ok.length) { const stack = [root]; while (stack.length) { const n = stack.pop(); n.kids = n.kids.filter((k) => { if (typeof k === 'string') return true; if (R.ok.some((s) => isMatch(k, s))) { removed++; return false; } stack.push(k); return true; }); } }
  if (!T.ok.length) return { html: removed ? outer(root) : html, matched: removed, bad };
  const found = [], stack = [root];
  while (stack.length && found.length < 200) { const n = stack.pop(); if (n !== root && T.ok.some((s) => isMatch(n, s))) { found.push(n); continue; } for (let i = n.kids.length - 1; i >= 0; i--) if (typeof n.kids[i] !== 'string') stack.push(n.kids[i]); }
  if (!found.length) return { html: removed ? outer(root) : html, matched: 0, bad, none: true };
  const title = /<title[^>]*>[\s\S]*?<\/title>/i.exec(html)?.[0] || '';
  return { html: `<html><head>${title}</head><body><main>${found.map(outer).join('\n')}</main></body></html>`, matched: found.length, bad };
}
// the main part of a page as markup, without scripts, styles, pictures, frames and comments (Firecrawl's "html"); main:
// false keeps the whole body (onlyMainContent: false)
export function cleanHtml(html, { main = true } = {}) {
  const h = String(html || '').replace(/<!--[\s\S]*?-->/g, ' ');
  const pick = (tag) => { let best = ''; for (const m of h.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi'))) if (m[1].length > best.length) best = m[1]; return best; };
  const m = main ? pick('main') || pick('article') : '', mine = m && m.replace(/<[^>]+>/g, '').trim().length > 200;
  let out = (mine ? m : /<body\b[^>]*>([\s\S]*)<\/body>/i.exec(h)?.[1] || h).replace(/<(script|style|noscript|svg|template|iframe|canvas|object|embed|head)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<(link|meta|base)\b[^>]*>/gi, '');
  if (main && !mine) out = out.replace(/<(nav|header|footer|aside|form)\b[\s\S]*?<\/\1>/gi, ' ');
  return out.replace(/\n\s*\n+/g, '\n').replace(/[ \t]{2,}/g, ' ').trim();
}

// what the reader takes from one page, in one go (run beside the node, see aside.mjs): the page's own words about itself,
// and its main part as lean Markdown (node/lean.mjs) with the links it leads on to, each once and as a full address.
// full: the whole Markdown the reader wrote before the lean one (toMarkdown, every link as it stands): the way back to
// whatever the lean reader leaves out (/r/<page>?format=full)
// shape (since 3.38, asked only in the form of another reader, node/compat.mjs): target/remove narrow the page first
// (shapeHtml); html: the main part as clean markup beside the Markdown. The page's own words about itself are read from
// the whole page.
export function digest(html, base, { full = false, shape = null } = {}) {
  const meta = readPage(html);
  let src = html, shaped = null;
  if (shape && (shape.target?.length || shape.remove?.length)) { const s = shapeHtml(html, shape); src = s.html; shaped = { matched: s.matched, bad: s.bad, none: s.none || undefined }; }
  const more = shape ? { shaped: shaped || undefined, html: shape.html ? cleanHtml(src, { main: !full }) : undefined } : {};
  if (full) { const md = toMarkdown(src, base), links = [], seen = new Set(); for (const m of md.matchAll(/\[([^\]]{2,120})\]\((https?:[^)\s]+)\)/g)) { if (seen.has(m[2]) || links.length >= 60) continue; seen.add(m[2]); links.push({ text: m[1], url: m[2] }); } return { meta, md, links, full: true, ...more }; }
  const { md, links, cut } = leanMarkdown(src, base); return { meta, md, links, cut, ...more };
}

// read one page for an agent; robots(host) returns the site's robots.txt (cached by the caller)
// shape (since 3.38, node/compat.mjs): { target, remove, html, raw } — raw keeps the page's markup as it came (rawHtml)
export async function readUrl(raw, { robots, full = false, shape = null } = {}) {
  let u; try { u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${String(raw).trim()}`); } catch { return { error: 'not a web address' }; }
  if (!/^https?:$/.test(u.protocol)) return { error: 'only http and https pages' };
  // web pages live on the web's ports; the reader is not a way to knock on every door of a machine
  if (u.port && !['80', '443', '8080', '8443'].includes(u.port)) return { error: 'the reader reads web pages on the usual ports (80, 443, 8080, 8443)' };
  const host = safeHost(u.hostname); if (!host) return { error: 'not a public website' };
  if (!(await publicDns(host))) return { error: 'this name does not lead to a public website' };
  const rb = robots ? await robots(host) : null;
  if (rb?.status === 200 && rb.body) { const g = robotsGroups(rb.body), allow = robotsAllows(g, READER_TOKEN, u.pathname + u.search); if (!allow.allowed) return { url: u.href, host, blocked: true, note: 'this site asks readers like this one not to read this page (robots.txt)' }; }
  const r = await grab(u.href, { max: 2_500_000, ms: 9000, ua: READER_UA, pdf: true, maxPdf: PDF_MAX });
  if (!r.status) return { url: u.href, host, error: 'the page did not answer' };
  if (r.status >= 400) return { url: u.href, host, status: r.status, error: `the page answered ${r.status}` };
  const type = r.type.toLowerCase(), final = r.url || u.href;
  // a PDF (since 3.59): its text layer, read beside the node with a time limit (node/pdf.mjs); a scan, a locked file or one
  // too large to unpack is said, and nothing else is made up
  if (r.bytes) {
    let d; try { d = await aside(new URL('./pdf.mjs', import.meta.url).href, 'pdfDigest', [r.bytes], { ms: 9000, heapMb: 384 }); }
    catch (e) { return { url: u.href, final, host, status: r.status, type: 'application/pdf', error: e?.code === 'EBUSY' ? e.message : 'this PDF could not be read in time' }; }
    if (d.error) return { url: u.href, final, host, status: r.status, type: 'application/pdf', error: d.error };
    return { url: u.href, final, host, status: r.status, type: 'application/pdf', title: d.title, words: d.words, markdown: d.markdown,
      pdf: { pages: d.pages, read: d.read, author: d.author, bytes: r.bytes.length, cut: r.cut || d.truncated || undefined } };
  }
  if (/html|xml\+xhtml/.test(type) || /^\s*</.test(r.body)) {
    // a page can be written to stall whoever reads it: it is read beside the node, with a time limit
    let meta, md, found, cut, shaped, clean; try { ({ meta, md, links: found, cut, shaped, html: clean } = await aside(import.meta.url, 'digest', [r.body, final, shape ? { full, shape: { target: shape.target, remove: shape.remove, html: !!shape.html } } : { full }])); } catch (e) { return { url: u.href, final, host, status: r.status, error: e?.code === 'EBUSY' ? e.message : 'this page could not be read in time; it is built in a way that stalls readers' }; }
    // the links the page leads on to, as full addresses (the Markdown writes those on the page's own site as paths)
    const links = (found || []).filter((l) => l.text && l.text.length >= 2).slice(0, 60);
    return { url: u.href, final, host, status: r.status, htmlBytes: r.body.length, title: meta.title, description: meta.description, lang: meta.lang, words: md.split(/\s+/).filter(Boolean).length, jsOnly: meta.shell || undefined, markdown: md.slice(0, 60_000), truncated: md.length > 60_000 || undefined, partial: cut || undefined, links, full: full || undefined,
      ...(shape ? { shaped: shaped || undefined, html: shape.html ? clean : undefined, rawHtml: shape.raw ? r.body : undefined, type: shape.raw || shape.html ? (type || undefined) : undefined } : {}) };
  }
  if (/^text\/|json|markdown|xml/.test(type)) return { url: u.href, final, host, status: r.status, type, markdown: r.body.slice(0, 60_000), truncated: r.body.length > 60_000 || undefined, ...(shape?.raw ? { rawHtml: r.body } : {}) };
  return { url: u.href, final, host, status: r.status, type, error: `this reader reads web pages, text and PDFs, not ${type.split(';')[0] || 'this kind of file'}` };
}
