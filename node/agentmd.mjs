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
// one HTML page of the sea as Markdown: title, description, the main part, and where the page and the guide live
export function pageMarkdown(html, url, base) {
  const title = attr(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const desc = attr(html, /<meta\s+name="description"\s+content="([^"]*)"/i);
  const canon = attr(html, /<link\s+rel="canonical"\s+href="([^"]*)"/i) || url;
  let body = toMarkdown(html, base);
  // the page's own first heading repeats the title: keep one of them
  if (title && body.startsWith('# ')) { const first = body.split('\n', 1)[0].slice(2).trim(); if (title.toLowerCase().startsWith(first.toLowerCase())) body = body.slice(body.indexOf('\n') + 1).trim(); }
  const head = [title && `# ${title}`, desc && `> ${desc}`].filter(Boolean).join('\n\n');
  return { canon, md: `${head}${head ? '\n\n' : ''}${body}\n\n---\nPage: ${canon} · For agents: ${base}/llms.txt · MCP: ${base}/mcp · Ask first: ${base}/brain?q=<task>\n` };
}

// the response for an agent that asked for Markdown: built from the HTML answer, or that answer as it was
export async function asMarkdown(res, { url, base, twin = false, spared }) {
  if (res.status !== 200 || !/^text\/html/i.test(res.headers.get('content-type') || '')) return res;
  const page = await res.text(), { canon, md } = pageMarkdown(page, url, base);
  // what the Markdown spared against the HTML, for the ledger of the Unibrain (node/areas.mjs)
  try { spared?.(page.length, md.length); } catch {}
  const h = new Headers();
  for (const k of ['cache-control', 'access-control-allow-origin', 'access-control-expose-headers', 'x-robots-tag']) { const v = res.headers.get(k); if (v) h.set(k, v); }
  h.set('content-type', 'text/markdown; charset=utf-8');
  h.set('vary', 'accept');
  h.set('link', `<${canon}>; rel="canonical"`);
  // the .md twin is a copy of an indexed page: search engines keep the HTML one
  if (twin) h.set('x-robots-tag', 'noindex, follow');
  return new Response(md, { status: 200, headers: h });
}
