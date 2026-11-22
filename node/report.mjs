// Mare Liberum · the full report on one website, written from what the free check and the Atlas already read
// reportMarkdown(data) turns the answers of /check?site=…&format=json and /site/<domain>.json (for the site and for up to
// three competitors), and the pages read through /r/, into one Markdown document: findings, who may read the site, a
// comparison, the fixes in order of effect and the files ready to use. It reads nothing itself and sends nothing; a
// person reads the result before it goes out. Nothing in it promises a ranking, traffic or revenue.
const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
const table = (head, rows) => [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`)].join('\n');
const ROLE = { live: 'assistant (fetches a page for a person, now)', search: 'AI search', training: 'training' };
const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const yes = (b) => (b ? 'yes' : 'no');

// ---- the files ready to use -------------------------------------------------------------------------------------------
export function draftLlms(check, site) {
  const p = check?.page || {}, host = check?.host || site?.site, name = (p.title || site?.title || host || '').split(/\s[|·–—-]\s/)[0].trim() || host;
  const secs = (site?.sections || []).slice(0, 12);
  return [`# ${name}`, '', `> ${p.description || site?.description || 'TODO: one or two sentences on what this site offers and for whom.'}`, '',
    '## Main pages', ...(secs.length ? secs.map((s) => `- [${s.name}](${s.url})`) : [`- [Home](https://${host}/)`, '- TODO: add the 5 to 10 pages an assistant should read first (offers, prices, contact, FAQ), one line each']),
    ...(site?.search ? ['', '## Search', `- ${site.search.template} (put the words where {q} stands)`] : []),
    '', '## Contact', '- TODO: e-mail address or contact page', ''].join('\n');
}
export function draftRobots(check) {
  const no = (check?.agents || []).filter((a) => a.allowed === false), open = no.filter((a) => a.role !== 'training');
  if (!no.length) return null;
  const block = (a) => `User-agent: ${a.name}\nAllow: /`;
  return [`# Lets the assistants and AI search crawlers in that robots.txt turns away today.`, ...open.map(block),
    ...(no.length > open.length ? ['', '# Training crawlers: your choice. Remove a block below to keep that crawler out.', ...no.filter((a) => a.role === 'training').map(block)] : []), ''].join('\n\n').replace(/\n{3,}/g, '\n\n');
}
export function draftJsonLd(check, site) {
  const p = check?.page || {}, host = check?.host || site?.site, home = site?.home || `https://${host}`, name = (p.title || site?.title || host || '').split(/\s[|·–—-]\s/)[0].trim() || host;
  const g = [{ '@type': 'Organization', '@id': `${home}/#org`, name, url: home, ...(p.description ? { description: p.description } : {}) },
    { '@type': 'WebSite', '@id': `${home}/#site`, url: home, name, ...(p.lang ? { inLanguage: p.lang } : {}), publisher: { '@id': `${home}/#org` },
      ...(site?.search ? { potentialAction: { '@type': 'SearchAction', target: site.search.template.replace('{q}', '{search_term_string}'), 'query-input': 'required name=search_term_string' } } : {}) }];
  return `<script type="application/ld+json">\n${JSON.stringify({ '@context': 'https://schema.org', '@graph': g }, null, 2)}\n</script>`;
}

// ---- the report -------------------------------------------------------------------------------------------------------
// data: { domain, date: 'YYYY-MM-DD', base, check, site, pages: [{ url, ok, title, words, note }], competitors: [{ domain, check, site }], sample }
export function reportMarkdown(data) {
  const { domain, date, base = 'https://mareliberum.dev', check: c = {}, site: s = {}, pages = [], competitors = [], sample = false } = data;
  const parts = c.parts || [], open = parts.filter((p) => !p.ok).sort((a, b) => (b.max - b.got) - (a.max - a.got));
  const agents = c.agents || s.agents || [], no = agents.filter((a) => a.allowed === false), noLive = no.filter((a) => a.role !== 'training');
  const L = [];
  L.push(`# AI agent readiness report: ${domain}`, '');
  if (sample) L.push(`> **Sample of the house.** This is a real report on ${domain}, a website of the seller's own, shown so that you can see what the paid report contains before you order one. It was written from data read on ${date}.`, '');
  L.push(`Read on ${date} · by Mare Liberum (${base.replace(/^https?:\/\//, '')}), Oroboros Design · sources: what ${domain} publishes itself (robots.txt, llms.txt, the home page, the agent card, the pages named below)`, '');
  if (c.reachable === false || typeof c.score !== 'number') { L.push('## The site could not be read', '', `${cell(c.error || c.note || 'The check got no answer from the site.')} A person looks at this before anything is sent.`, ''); return L.join('\n'); }

  L.push('## 1. In short', '', `**${domain} scores ${c.score} of 100 (grade ${c.grade})** for how well AI assistants and agents can read and use it.`, '');
  L.push(noLive.length ? `- robots.txt turns away ${noLive.length} assistant or AI search crawler${noLive.length > 1 ? 's' : ''}: ${noLive.map((a) => a.name).join(', ')}.` : `- Every assistant and AI search crawler the check knows may read the site${no.length ? `; for training, robots.txt turns away ${no.map((a) => a.name).join(', ')}` : ''}.`);
  if (c.page) L.push(c.page.shell || c.page.words < 40 ? `- Without JavaScript the home page shows ${c.page.words} words. Most agents do not run JavaScript and see an empty page.` : `- The home page shows ${c.page.words} words without JavaScript, so agents can read it.`);
  L.push(open.length ? `- ${open.length} thing${open.length > 1 ? 's' : ''} to fix, worth ${open.reduce((n, p) => n + p.max - p.got, 0)} points. The largest: ${cell(open[0].title)}.` : '- Nothing the check scores is missing.', '');

  L.push('## 2. The score, part by part', '', table(['Part', 'Points', 'Finding', 'Read from'], parts.map((p) => [p.key, `${p.got} / ${p.max}`, p.title, p.from])), '');

  L.push('## 3. Who may read the site', '', 'From robots.txt, one agent at a time. robots.txt states wishes; most large AI operators say they follow it, and whether one does is its own decision.', '',
    table(['Agent', 'Operator', 'What it does', 'May read', 'Named in robots.txt'], agents.map((a) => [a.name, a.op || '', ROLE[a.role] || a.role || '', a.allowed === false ? '**no**' : a.allowed == null ? 'unclear' : 'yes', a.named == null ? '' : yes(a.named)])), '');

  if (c.page) L.push('## 4. What an agent reads first', '', table(['', ''], [['Title', c.page.title || '—'], ['Description', c.page.description || '—'], ['Language', c.page.lang || '—'], ['Words without JavaScript', c.page.words], ['Structured data (JSON-LD)', (c.page.jsonld || []).join(', ') || 'none'], ['llms.txt', yes(c.llms)], ['Agent card', c.agentCard ? `${c.agentCard.name || 'present'}${c.agentCard.skills ? `, ${c.agentCard.skills} skills` : ''}` : 'no'], ['Sitemap', yes(c.sitemap)], ['Asks not to be indexed / not used by AI', `${yes(c.page.noindex)} / ${yes(c.page.noai)}`]]), '');

  L.push('## 5. Pages read', '');
  if (pages.length) L.push(`${pages.length} page${pages.length > 1 ? 's' : ''} of the site, each read the way an agent reads it: without JavaScript, as plain text.`, '', table(['Page', 'Readable', 'Words', 'Title', 'Note'], pages.map((p) => [p.url, p.ok ? (p.words < 40 ? '**almost empty**' : 'yes') : '**no**', p.ok ? p.words : '', p.title || '', p.note || ''])), '');
  else L.push('Only the home page was read: without JavaScript the site names no sections to follow. TODO before sending: name up to 10 pages (`--pages`) and run the tool again.', '');

  L.push('## 6. How an agent uses the site', '', table(['', ''], [['Search with one link', s.search ? `${s.search.template} (from ${s.search.from})` : 'none found on the home page'], ['Sections found', (s.sections || []).map((x) => x.name).join(', ') || 'none without JavaScript'], ['Feeds', (s.feeds || []).join(', ') || 'none'], ['Sitemaps', (s.sitemaps || []).join(', ') || 'none'], ['Developer pages', s.developers || 'none'], ['llms.txt', s.llmsTxt || 'none'], ['Sign-in or paywall', [s.signIn, s.paywall].filter(Boolean).join(' · ') || 'none seen']]), '');

  L.push('## 7. Compared with others', '');
  if (competitors.length) {
    const row = (d, k, st) => { const live = (k?.agents || []).filter((a) => a.allowed === false && a.role !== 'training'); return [d, typeof k?.score === 'number' ? `${k.score} (${k.grade})` : 'not readable', typeof k?.score === 'number' ? (live.length ? live.map((a) => a.name).join(', ') : 'none') : '', k?.page ? k.page.words : '', k?.page ? ((k.page.jsonld || []).length ? 'yes' : 'no') : '', k ? yes(k.llms) : '', k ? yes(!!k.agentCard) : '', st?.search ? 'yes' : 'no']; };
    L.push(table(['Site', 'Score', 'Assistants turned away', 'Words without JavaScript', 'Structured data', 'llms.txt', 'Agent card', 'Search link'], [row(`**${domain}**`, c, s), ...competitors.map((x) => row(x.domain, x.check, x.site))]), '', 'Read the same day, the same way. The table says what each site publishes; it says nothing about how often an assistant names it.', '');
  } else L.push('No competitor was named at checkout. Name up to three and the comparison is added.', '');

  L.push('## 8. What to fix, in order of effect', '');
  if (open.length) open.forEach((p, i) => L.push(`${i + 1}. **${cell(p.title)}** (${p.max - p.got} of ${p.max} points open). ${p.fix ? `Fix: ${cell(p.fix)}.` : ''} Test it afterwards: ${base}/check/${domain}`));
  else L.push('Nothing the check scores is open. What is left is a matter of content: whether the pages answer what a person would ask an assistant about you.');
  if (noLive.length && !open.some((p) => p.key === 'access')) L.push(`- robots.txt turns away ${noLive.map((a) => a.name).join(', ')}; the block in section 9 lets them in.`);
  L.push('');

  L.push('## 9. Files ready to use', '', 'Drafts written from what the site says about itself. Lines marked TODO need a fact only you have. Read them before you publish them.', '');
  if (!c.llms) L.push('### /llms.txt', '', 'Save as `llms.txt` at the top of the site.', '', '```markdown', draftLlms(c, s).trimEnd(), '```', '');
  else L.push('### /llms.txt', '', `Already there${s.llmsTxt ? `: ${s.llmsTxt}` : ''}. No draft needed.`, '');
  const rb = draftRobots(c);
  L.push('### robots.txt', '', ...(rb ? ['Add this block above any `User-agent: *` group.', '', '```text', rb.trimEnd(), '```'] : ['robots.txt turns no known AI agent away. No change needed.']), '');
  if (!(c.page?.jsonld || []).length) L.push('### Structured data (JSON-LD)', '', 'Put this in the `<head>` of the home page, in the HTML the server sends (not added by JavaScript).', '', '```html', draftJsonLd(c, s), '```', '');
  else L.push('### Structured data (JSON-LD)', '', `Already there: ${(c.page.jsonld || []).join(', ')}. No draft needed.`, '');

  L.push('## 10. Re-check', '', `The site is read again on **${addDays(date, 14)}** (14 days after this report), and you get a short note with what changed. You can test any fix yourself at any time, free: ${base}/check/${domain}`, '');
  L.push('## What this report is and is not', '', `It says what ${domain} publishes for machines and what to change so that AI agents can read and use it. It does not promise a ranking, traffic, citations by an assistant or revenue. Prepared by Daouda Ndiaye, Oroboros Design · oroborosdesign@gmail.com`, '');
  return L.join('\n');
}

// ---- Markdown of a report as HTML (only the forms a report uses) --------------------------------------------------------
const escH = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const inline = (t) => escH(t).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" rel="nofollow">$1</a>');
export function reportHtml(md) {
  const out = [], lines = String(md).split('\n'); let i = 0;
  const cells = (l) => l.replace(/^\|/, '').replace(/\|\s*$/, '').split(/(?<!\\)\|/).map((x) => x.replace(/\\\|/g, '|').trim());
  while (i < lines.length) {
    const l = lines[i];
    if (l.startsWith('```')) { const b = []; i++; while (i < lines.length && !lines[i].startsWith('```')) b.push(lines[i++]); i++; out.push(`<pre>${escH(b.join('\n'))}</pre>`); continue; }
    const h = /^(#{1,3}) (.*)$/.exec(l); if (h) { out.push(`<h${h[1].length + 1}>${inline(h[2])}</h${h[1].length + 1}>`); i++; continue; }
    if (l.startsWith('|')) { const rows = []; while (i < lines.length && lines[i].startsWith('|')) rows.push(cells(lines[i++])); const [head, , ...body] = rows; out.push(`<table>${head.some((x) => x) ? `<thead><tr>${head.map((x) => `<th>${inline(x)}</th>`).join('')}</tr></thead>` : ''}<tbody>${body.map((r) => `<tr>${r.map((x) => `<td>${inline(x)}</td>`).join('')}</tr>`).join('')}</tbody></table>`); continue; }
    if (/^(- |\d+\. )/.test(l)) { const ol = /^\d/.test(l), items = []; while (i < lines.length && /^(- |\d+\. )/.test(lines[i])) items.push(lines[i++].replace(/^(- |\d+\. )/, '')); out.push(`<${ol ? 'ol' : 'ul'}>${items.map((x) => `<li>${inline(x)}</li>`).join('')}</${ol ? 'ol' : 'ul'}>`); continue; }
    if (l.startsWith('> ')) { out.push(`<div class="box"><p style="margin:0">${inline(l.slice(2))}</p></div>`); i++; continue; }
    if (l.trim()) out.push(`<p>${inline(l)}</p>`);
    i++;
  }
  return out.join('\n');
}
