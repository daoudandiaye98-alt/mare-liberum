// Mare Liberum · the reader: any public page as clean Markdown for an agent — the membrane agents pass on their way through the web.
// It follows robots.txt, reads one page per call, keeps nothing but a short cache and the name of the site that was read.
import { safeHost, publicDns, grab, robotsGroups, robotsAllows, readPage } from './check.mjs';
import { aside } from './aside.mjs';
import { entities, leanMarkdown } from './lean.mjs';
export { entities };

export const READER_UA = 'MareLiberum-Reader/1.0 (+https://mareliberum.dev/read; reads one page for an agent and follows robots.txt)';
export const READER_TOKEN = 'MareLiberum-Reader';

const abs = (href, base) => { try { const u = new URL(entities(href).trim(), base); return /^https?:$/.test(u.protocol) ? u.href : null; } catch { return null; } };
const inline = (s) => entities(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

// HTML to Markdown, plainly: the main part of the page, headings, paragraphs, lists, links, code; no scripts, no menus.
// menus: false keeps runs of links (a page whose main part holds no menu, like the pages of the sea itself)
export function toMarkdown(html, base, { menus = true } = {}) {
  let h = String(html || '').replace(/<!--[\s\S]*?-->/g, ' ');
  const pick = (tag) => { let best = ''; for (const m of h.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi'))) if (m[1].length > best.length) best = m[1]; return best; };
  const main = pick('main') || pick('article'), region = main && main.replace(/<[^>]+>/g, '').trim().length > 200 ? main : (/<body\b[^>]*>([\s\S]*)<\/body>/i.exec(h)?.[1] || h);
  h = region.replace(/<(script|style|noscript|svg|template|iframe|canvas|select|button|object|embed)\b[\s\S]*?<\/\1>/gi, ' ');
  if (!main) h = h.replace(/<(nav|header|footer|aside|form)\b[\s\S]*?<\/\1>/gi, ' ');
  const keep = []; const hold = (t) => `\u0000${keep.push(t) - 1}\u0000`;
  h = h.replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, (_, c) => hold(`\n\n\`\`\`\n${entities(c.replace(/<[^>]+>/g, '')).trim()}\n\`\`\`\n\n`));
  h = h.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_, c) => hold(`\`${inline(c)}\``));
  h = h.replace(/<a\b[^>]*?href\s*=\s*("([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi, (_, __, d, s2, t) => { const u = abs(d ?? s2, base), x = inline(t); return x ? (u ? hold(`[${x.replace(/[[\]]/g, '')}](${u})`) : x) : ''; });
  h = h.replace(/<img\b[^>]*?alt\s*=\s*("([^"]*)"|'([^']*)')[^>]*>/gi, (_, __, a, b) => { const x = inline(a ?? b ?? ''); return x ? ` [image: ${x}] ` : ' '; });
  h = h.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, t) => { const x = inline(t.replace(/\u0000(\d+)\u0000/g, (m, i) => keep[i])); return x ? hold(`\n\n${'#'.repeat(Number(n))} ${x}\n\n`) : ''; });
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
  return md;
}

// what the reader takes from one page, in one go (run beside the node, see aside.mjs): the page's own words about itself,
// and its main part as lean Markdown (node/lean.mjs) with the links it leads on to, each once and as a full address
export function digest(html, base) { const meta = readPage(html), { md, links } = leanMarkdown(html, base); return { meta, md, links }; }

// read one page for an agent; robots(host) returns the site's robots.txt (cached by the caller)
export async function readUrl(raw, { robots } = {}) {
  let u; try { u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${String(raw).trim()}`); } catch { return { error: 'not a web address' }; }
  if (!/^https?:$/.test(u.protocol)) return { error: 'only http and https pages' };
  // web pages live on the web's ports; the reader is not a way to knock on every door of a machine
  if (u.port && !['80', '443', '8080', '8443'].includes(u.port)) return { error: 'the reader reads web pages on the usual ports (80, 443, 8080, 8443)' };
  const host = safeHost(u.hostname); if (!host) return { error: 'not a public website' };
  if (!(await publicDns(host))) return { error: 'this name does not lead to a public website' };
  const rb = robots ? await robots(host) : null;
  if (rb?.status === 200 && rb.body) { const g = robotsGroups(rb.body), allow = robotsAllows(g, READER_TOKEN, u.pathname + u.search); if (!allow.allowed) return { url: u.href, host, blocked: true, note: 'this site asks readers like this one not to read this page (robots.txt)' }; }
  const r = await grab(u.href, { max: 2_500_000, ms: 9000, ua: READER_UA });
  if (!r.status) return { url: u.href, host, error: 'the page did not answer' };
  if (r.status >= 400) return { url: u.href, host, status: r.status, error: `the page answered ${r.status}` };
  const type = r.type.toLowerCase(), final = r.url || u.href;
  if (/html|xml\+xhtml/.test(type) || /^\s*</.test(r.body)) {
    // a page can be written to stall whoever reads it: it is read beside the node, with a time limit
    let meta, md, found; try { ({ meta, md, links: found } = await aside(import.meta.url, 'digest', [r.body, final])); } catch (e) { return { url: u.href, final, host, status: r.status, error: e?.code === 'EBUSY' ? e.message : 'this page could not be read in time; it is built in a way that stalls readers' }; }
    // the links the page leads on to, as full addresses (the Markdown writes those on the page's own site as paths)
    const links = (found || []).filter((l) => l.text && l.text.length >= 2).slice(0, 60);
    return { url: u.href, final, host, status: r.status, htmlBytes: r.body.length, title: meta.title, description: meta.description, lang: meta.lang, words: md.split(/\s+/).filter(Boolean).length, jsOnly: meta.shell || undefined, markdown: md.slice(0, 60_000), truncated: md.length > 60_000 || undefined, links };
  }
  if (/^text\/|json|markdown|xml/.test(type)) return { url: u.href, final, host, status: r.status, type, markdown: r.body.slice(0, 60_000), truncated: r.body.length > 60_000 || undefined };
  return { url: u.href, final, host, status: r.status, type, error: `this reader reads web pages and text, not ${type.split(';')[0] || 'this kind of file'}` };
}
