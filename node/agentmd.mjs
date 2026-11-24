// Mare Liberum · every page as Markdown for the agent that asks for it.
// Agents that read the web (Claude Code, OpenCode, Cursor and others) send `Accept: text/markdown` before text/html, or
// add .md to an address. They get the same page as Markdown: its title, its description and its main part, without the
// styles, scripts and menus (a few kilobytes instead of up to 160). Browsers and search engines never ask for Markdown,
// so they get the page as before. Same content, another format: the HTML address stays the canonical one.
import { toMarkdown, entities } from './reader.mjs';

// the q a list in an Accept header gives a type (0 when it is not named)
const qOf = (accept, types) => {
  let best = 0;
  for (const part of String(accept || '').toLowerCase().split(',')) {
    const [type, ...ps] = part.trim().split(';').map((x) => x.trim());
    if (!types.includes(type)) continue;
    const q = ps.find((p) => p.startsWith('q='));
    const v = q ? Number(q.slice(2)) : 1;
    if (Number.isFinite(v) && v > best) best = v;
  }
  return best;
};
// asked for Markdown at least as much as for HTML (a browser and a search engine never name Markdown)
export const wantsMarkdown = (accept) => {
  const md = qOf(accept, ['text/markdown', 'text/x-markdown']);
  return md > 0 && md >= qOf(accept, ['text/html', 'application/xhtml+xml']);
};
// addresses ending in .md that are real documents of their own (the skill, the lessons, a brief, a site's map …)
const OWN_MD = /^\/(skill|SKILL|learn)\.md$|^\/offers\/sample-report\.md$|^\/\.well-known\/|^\/brief\/[a-z0-9-]+\.md$|^\/site\/[^/]+\.md$/;
// the HTML page an address with .md stands for, or null (/index.md and /.md are the front page)
export const mdTwin = (path) => {
  if (!/\.md$/.test(path) || OWN_MD.test(path)) return null;
  const p = path.slice(0, -3);
  return p === '' || p === '/index' ? '/' : p;
};

const attr = (html, re) => { const m = re.exec(html); return m ? entities(m[1]).replace(/\s+/g, ' ').trim() : ''; };
const UTF8 = new TextEncoder(), bytesOf = (s) => UTF8.encode(String(s || '')).length;
// A form is a door of the page: in Markdown its fields would be lost, and an agent could not use it. Each form is
// written as one line above its fields: the method, the address and the name of every field, with what the field asks
// for (its label, else its placeholder, else its name) and the value of a fixed one.
const unquote = (a, name) => { const m = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(a); return m ? entities(m[2] ?? m[3] ?? m[4] ?? '') : null; };
export function formLines(html, base) {
  const labels = {}; for (const m of String(html).matchAll(/<label\b([^>]*)>([\s\S]*?)<\/label>/gi)) { const f = unquote(m[1], 'for'); if (f) labels[f] = entities(m[2].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim(); }
  let n = 0;
  return String(html).replace(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi, (all, a, inner) => {
    // a form without an address of its own is worked by the page's script (it sends elsewhere): it is left as it is
    const action = unquote(a, 'action'); if (++n > 20 || !action) return all;
    const method = (unquote(a, 'method') || 'get').toUpperCase() === 'POST' ? 'POST' : 'GET';
    let to; try { to = new URL(action, base).href; } catch { return all; }
    const options = {}; for (const m of inner.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi)) { const nm = unquote(m[1], 'name'); if (nm) options[nm] = [...m[2].matchAll(/<option\b([^>]*)>/gi)].map((o) => unquote(o[1], 'value') ?? '').filter(Boolean); }
    const fields = [];
    for (const m of inner.matchAll(/<(input|textarea|select)\b([^>]*)>/gi)) {
      const at = m[2], name = unquote(at, 'name'), type = (unquote(at, 'type') || '').toLowerCase(); if (!name || ['submit', 'button', 'reset', 'image', 'file'].includes(type)) continue;
      const id = unquote(at, 'id'), what = ((id && labels[id]) || unquote(at, 'placeholder') || unquote(at, 'aria-label') || name).replace(/[<>]/g, ''), o = options[name];
      fields.push(type === 'hidden' ? `${name}=${unquote(at, 'value') ?? ''}` : o?.length ? `${name}=<${what}: ${o.slice(0, 12).join(' | ')}${o.length > 12 ? ' | …' : ''}>` : `${name}=<${what}>`);
    }
    if (!fields.length) return all;
    const line = method === 'GET' ? `GET ${to}${to.includes('?') ? '&' : '?'}${fields.join('&')}` : `POST ${to} with ${fields.join(', ')}`;
    return `<p>Form: <code>${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></p><form${a}>${inner}</form>`;
  });
}
// one HTML page of the sea as Markdown: title, description, the main part, and where the page and the guide live. A
// page of the sea holds no menus in its main part (its frame stands outside it), so a list of links is content and stays
export function pageMarkdown(html, url, base) {
  const title = attr(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const desc = attr(html, /<meta\s+name="description"\s+content="([^"]*)"/i);
  const canon = attr(html, /<link\s+rel="canonical"\s+href="([^"]*)"/i) || url;
  let body = toMarkdown(formLines(html, base), base, { menus: false });
  // the page's own first heading repeats the title: keep one of them
  if (title && body.startsWith('# ')) { const first = body.split('\n', 1)[0].slice(2).trim(); if (title.toLowerCase().startsWith(first.toLowerCase())) body = body.slice(body.indexOf('\n') + 1).trim(); }
  const head = [title && `# ${title}`, desc && `> ${desc}`].filter(Boolean).join('\n\n');
  return { canon, md: `${head}${head ? '\n\n' : ''}${body}\n\n---\nPage: ${canon} · For agents: ${base}/llms.txt · MCP: ${base}/mcp · Ask first: ${base}/brain?q=<task>\n` };
}

// the response for an agent that asked for Markdown: built from the HTML answer, or that answer as it was. agent: the
// address of the HTML page, when the Markdown goes to an assistant that asked for HTML (it varies with User-Agent then,
// and names the HTML as its alternate)
export async function asMarkdown(res, { url, base, twin = false, spared, agent }) {
  if (res.status !== 200 || !/^text\/html/i.test(res.headers.get('content-type') || '')) return res;
  const page = await res.text(), { canon, md } = pageMarkdown(page, url, base);
  // what the Markdown spared against the HTML, in bytes, for the ledger of the Unibrain (node/areas.mjs)
  try { spared?.(bytesOf(page), bytesOf(md)); } catch {}
  const h = new Headers();
  for (const k of ['cache-control', 'access-control-allow-origin', 'access-control-expose-headers', 'x-robots-tag']) { const v = res.headers.get(k); if (v) h.set(k, v); }
  h.set('content-type', 'text/markdown; charset=utf-8');
  h.set('vary', agent ? 'User-Agent, Accept' : 'accept');
  h.set('link', agent ? `<${canon}>; rel="canonical", <${agent}>; rel="alternate"; type="text/html"` : `<${canon}>; rel="canonical"`);
  // the .md twin is a copy of an indexed page: search engines keep the HTML one
  if (twin) h.set('x-robots-tag', 'noindex, follow');
  return new Response(md, { status: 200, headers: h });
}
