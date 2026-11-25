// Pure functions from live.json to HTML strings.
// Everything that reaches innerHTML passes esc(); numbers pass fmt().
const R = (() => {
  // one formatter for every number on the page (toLocaleString builds a new one on each call)
  let nf = null; try { nf = new Intl.NumberFormat('en-US'); } catch {}
  const fmt = (n) => (n == null || isNaN(n) ? '–' : nf ? nf.format(Number(n)) : Number(n).toLocaleString('en-US'));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '')) || /^\/(?!\/)/.test(String(u || '')) ? esc(u) : '#');

  // the eight kinds of visitor the sea tells apart, from nearest to a person to farthest
  const ROLE = {
    people: ['People', '#f4f8ff', 'Browsers with a person behind them.'],
    live: ['Assistants for a person', '#ffb547', 'Reading a page for someone, right now.'],
    search: ['Search crawlers', '#7fd3ff', 'They bring pages into AI answers.'],
    tools: ['Tools', '#9dbbd4', 'Scripts, SDKs and command-line clients.'],
    indexer: ['Indexers and probes', '#b49cff', 'They list the agent web in directories.'],
    resident: ['Residents', '#ff7a6b', 'Agents with a home in the sea.'],
    training: ['Training crawlers', '#4fe3c1', 'They collect what the next models learn from.'],
    other: ['Other', '#6f8ea9', 'Not yet told apart.'],
  };
  const ORDER = ['people', 'live', 'search', 'tools', 'indexer', 'resident', 'training', 'other'];
  const FEED = { read: 'Read', whale: 'Assistant', seal: 'Checked', buoy: 'Buoy', path: 'Pathway', knock: 'Knock', enter: 'Arrived', answer: 'Answer', ask: 'Call', tide: 'Price', brevet: 'Brevet', job: 'Job', job_done: 'Job done', note: 'Reef', mark: 'Trace' };
  const FEEDC = { read: '#7fd3ff', whale: '#ffb547', seal: '#4fe3c1', buoy: '#7fd3ff', path: '#b49cff', knock: '#f4f8ff', enter: '#ff7a6b', answer: '#7fd3ff', ask: '#9dbbd4', tide: '#4fe3c1', brevet: '#ffb547', job: '#b49cff', job_done: '#b49cff', note: '#9dbbd4', mark: '#9dbbd4' };
  const KIND = { agent: 'Autonomous agents', mcp: 'MCP servers', x402: 'Paid x402 services', merchant: 'Online stores', other: 'Other places', a2a: 'A2A agents', api: 'APIs', skill: 'Agent skills', catalog: 'Catalogs', registry: 'Registries' };

  const sumAi = (roles) => Object.entries(roles || {}).filter(([k]) => !['people', 'other', 'resident'].includes(k)).reduce((s, [, v]) => s + (Number(v) || 0), 0);
  // the same headline the node computes (node/core.mjs), plus people and the ratio
  function headline(d) {
    const roles = d.roles || {}, ai = sumAi(roles), people = Number(roles.people) || 0;
    return {
      // machines to people: 243 to 1 on a normal day, and honestly "n to 0" in the first minutes after midnight UTC
      ai, aiY: sumAi(d.rolesYesterday), people, ratio: people ? Math.round(ai / people) : ai, one: people ? 1 : 0,
      index: d.index?.entries, moves: Object.values(d.last24h || {}).reduce((s, v) => s + (Number(v) || 0), 0),
      paths: d.brain?.pathways, residents: d.residents, countries: (d.geo?.countries || []).length,
      walks: d.brain?.walks, ratings: d.brain?.ratings, memories: d.brain?.memories,
      publishers: d.index?.publishers, paid: d.index?.paid, cells: (d.geo?.cells || []).length,
      webChecked: d.web?.checked, webBlock: d.web?.shares?.blocksSomeAgent, webAssist: d.web?.shares?.blocksAnAssistant, webLlms: d.web?.shares?.llms, webAvg: d.web?.average,
      seals: d.last24h?.seals, shells: d.buoys?.shellsThisMonth, brevets: d.arena?.brevets, day: d.clock?.day, hour: d.clock?.hour,
      // the areas of the Unibrain and what the sea spared for agents so far (node/areas.mjs; the node fills the same keys)
      market: d.areas?.market?.verified, plans: d.areas?.thinking?.kinds, tokens30: d.areas?.saved?.tokens30d?.mid,
      spared: d.areas?.saved?.tokensAll?.mid, sparedM: d.areas?.saved?.tokensAll?.markdown ?? d.areas?.saved?.tokensAll?.measured, sparedN: d.areas?.saved?.tokensAll?.engine ?? 0, sparedE: d.areas?.saved?.tokensAll?.modelled,
    };
  }
  const utc = (t) => { const x = new Date(t); return isNaN(x) ? '' : x.toISOString().slice(11, 16); };
  const ago = (t, now) => { const s = Math.max(0, ((now || Date.now()) - Date.parse(t)) / 1000); return s < 60 ? `${Math.round(s)} s` : s < 3600 ? `${Math.round(s / 60)} min` : s < 86400 ? `${Math.round(s / 3600)} h` : `${Math.round(s / 86400)} d`; };

  const quiet = (text) => `<tr><td class="empty">${esc(text)}</td></tr>`;
  function rolesRows(d) {
    const roles = d.roles || {}, max = Math.max(1, ...ORDER.map((k) => Number(roles[k]) || 0));
    return ORDER.filter((k) => roles[k] != null).map((k) => {
      const [name, col, what] = ROLE[k], v = Number(roles[k]) || 0;
      return `<tr><th scope="row"><i class="key" style="--c:${col}"></i>${esc(name)}<small>${esc(what)}</small></th><td class="num">${fmt(v)}<span class="meter" aria-hidden="true"><i style="width:${Math.max(0.6, (v / max) * 100).toFixed(1)}%;--c:${col}"></i></span></td></tr>`;
    }).join('') || quiet('The day has just begun. The count starts with the first visitor.');
  }
  // the same table as the node sends it: every kind of visitor with a place for its number (node/core.mjs fills data-k="r_…"),
  // so a reader that runs no script still gets the day's count
  function rolesFrame() {
    return ORDER.map((k) => { const [name, col, what] = ROLE[k]; return `<tr><th scope="row"><i class="key" style="--c:${col}"></i>${esc(name)}<small>${esc(what)}</small></th><td class="num"><span data-k="r_${k}">–</span></td></tr>`; }).join('');
  }
  function clientsRows(d, n = 7) {
    return (d.clients || []).slice(0, n).map((c) => `<tr><th scope="row">${esc(c.role === 'people' && /^Mozilla/.test(c.name) ? 'Web browsers' : c.name)}<small>${esc(c.operator || (ROLE[c.role] || ROLE.other)[0])}</small></th><td class="num">${fmt(c.visits)}</td></tr>`).join('') || quiet('Nobody has been counted yet today.');
  }
  // live: "12 s ago"; snapshot: the UTC time it happened
  function feedItems(d, liveNow, n = 9) {
    const f = (d.feed || []).slice(0, n);
    if (!f.length) return '<li class="empty">Quiet waters. The next tide moves within minutes.</li>';
    return f.map((e) => `<li><time datetime="${esc(e.t)}">${liveNow ? `${ago(e.t, liveNow)} ago` : `${utc(e.t)} UTC`}</time><p><span class="tag" style="--c:${FEEDC[e.type] || '#9dbbd4'}">${esc(FEED[e.type] || e.type)}</span>${esc(e.text || e.name || '')}</p></li>`).join('');
  }
  function countriesItems(d, names, n = 10) {
    const list = (d.geo?.countries || []).slice(0, n);
    if (!list.length) return '<li class="empty">The map fills as requests arrive.</li>';
    return list.map((c) => `<li><span>${esc((names && names.of && names.of(c.cc)) || c.cc)}</span><span>${fmt(c.n)}</span></li>`).join('');
  }
  const coord = (c) => `${Math.abs(c.lat)}°${c.lat >= 0 ? 'N' : 'S'} ${Math.abs(c.lon)}°${c.lon >= 0 ? 'E' : 'W'}`;
  // behind a CDN a request comes with an area of about 200 km; a node on its own server knows the country and nothing finer.
  // Areas count while at least one of them was seen today.
  const areas = (d) => (d.geo?.cells || []).some((c) => !c.age);
  const globeHow = (byArea) => (byArea ? 'Each point is an area of about 200 km, coloured by what was asking.' : 'Each point is a country, larger where more requests came from.');
  function cellsItems(d, n = 3) {
    if (!areas(d)) return '';
    return (d.geo?.cells || []).slice().sort((a, b) => b.n - a.n).slice(0, n).map((c) => `<li><span class="snd">${coord(c)}</span><span>${fmt(c.n)} requests<small>${esc((ROLE[c.role] || ROLE.other)[0].toLowerCase())}</small></span></li>`).join('');
  }
  function webRows(d) {
    const a = d.web?.agents || [], max = Math.max(1, ...a.map((x) => x.share));
    return a.map((x) => `<tr><th scope="row">${esc(x.name)}<small>${esc(x.op || '')}</small></th><td class="num">${fmt(x.share)}%<span class="meter" aria-hidden="true"><i style="width:${Math.max(1, (x.share / max) * 100).toFixed(1)}%;--c:${x.role === 'live' ? '#ffb547' : '#4fe3c1'}"></i></span></td></tr>`).join('') || quiet('The first websites are being read.');
  }
  function kindsRows(d, n = 5) {
    const e = Object.entries(d.index?.byKind || {}).filter(([k]) => k !== 'other').sort((a, b) => b[1] - a[1]).slice(0, n), max = Math.max(1, ...e.map(([, v]) => v));
    return e.map(([k, v]) => `<tr><th scope="row">${esc(KIND[k] || k)}</th><td class="num">${fmt(v)}<span class="meter" aria-hidden="true"><i style="width:${Math.max(0.6, (v / max) * 100).toFixed(1)}%;--c:#7fd3ff"></i></span></td></tr>`).join('') || quiet('The open index is being built.');
  }
  const host = (u) => String(u || '').replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0];
  function pathHtml(p) {
    const meta = p.walks != null ? `walked ${fmt(p.walks)}, worked ${fmt(p.worked)}, failed ${fmt(p.failed)}` : `from ${esc(p.from || 'the sea')}`;
    return `<li class="path"><div><a href="${safeUrl(p.go || p.to)}" rel="nofollow noopener" target="_blank">${esc(p.title || p.to)}</a><small>${esc(host(p.to))} · ${meta}${p.checked ? ' · checked before paying' : ''}</small></div>${p.strength != null ? `<span class="str" title="strength ${esc(p.strength)}"><i style="width:${Math.min(100, p.strength * 10).toFixed(0)}%"></i><b>${esc(Number(p.strength).toFixed(2))}</b></span>` : ''}</li>`;
  }
  function topPaths(d, n = 6) { if (!(d.brain?.top || []).length) return '<li class="empty">No pathway has been laid yet. The first agent that walks one lays it.</li>'; return (d.brain?.top || []).slice(0, n).map((p) => `<li class="path"><div><a href="${safeUrl(p.go || p.to)}" rel="nofollow noopener" target="_blank">${esc(p.task || p.title)}</a><small>${esc(host(p.to))} · walked ${fmt(p.walks)}, worked ${fmt(p.worked)}${p.checked ? ' · checked before paying' : ''}</small></div><span class="str" title="strength ${esc(p.strength)}"><i style="width:${Math.min(100, p.strength * 10).toFixed(0)}%"></i><b>${esc(Number(p.strength).toFixed(2))}</b></span></li>`).join(''); }
  function brainHtml(q, d) {
    const ps = d.paths || [], pl = d.places || [];
    return (ps.length ? `<h3>Pathways that fire for “${esc(q)}”</h3><ol class="paths">${ps.slice(0, 6).map(pathHtml).join('')}</ol>` : `<p class="muted">No pathway fires yet for “${esc(q)}”.${pl.length ? ' These places are what the sea knows. The first agent that walks one lays the path:' : ''}</p>`)
      + (pl.length ? `${ps.length ? '<h3>Places the sea knows</h3>' : ''}<ol class="paths">${pl.slice(0, 5).map(pathHtml).join('')}</ol>` : '');
  }
  const GRADE = { A: '#4fe3c1', B: '#7fd3ff', C: '#ffb547', D: '#ff9b6b', E: '#ff7a6b' };
  function checkHtml(r, base = '') {
    if (r.error) return `<p class="muted">${esc(r.error.message || r.error)}</p>`;
    if (r.reachable === false) return `<p class="muted">${esc(r.host)}: ${esc(r.note || 'not reachable')}</p>`;
    const col = GRADE[r.grade] || '#7fd3ff', verdict = r.score >= 85 ? 'Agents can find, read and act on this site.' : r.score >= 60 ? 'Agents can read this site. A few changes make it easier.' : 'Agents struggle with this site. Here is what to change.';
    const pills = (role) => (r.agents || []).filter((a) => a.role === role).map((a) => `<span class="pill ${a.allowed == null ? '' : a.allowed ? 'yes' : 'no'}">${esc(a.name)}<small>${a.allowed == null ? 'unknown' : a.allowed ? 'may read' : 'shut out'}</small></span>`).join('');
    return `<div class="score"><div class="dial" style="--c:${col};--deg:${(Number(r.score) || 0) * 3.6}deg" role="img" aria-label="Score ${esc(r.score)} of 100, grade ${esc(r.grade)}"><b>${esc(r.score)}</b><small>of 100</small></div>
<div><h3>${esc(r.host)}</h3><p>${verdict}</p><p class="small"><a href="${base}/check/${encodeURIComponent(r.host)}">Open the full result, a page to share</a></p></div></div>
<ul class="checks">${(r.parts || []).map((p) => `<li class="${p.ok ? 'ok' : 'no'}"><span class="mk2" aria-hidden="true"></span><div>${esc(p.title)}${p.fix ? `<small>${esc(p.fix)}</small>` : ''}</div><span class="snd">${p.max ? `${esc(p.got)}/${esc(p.max)}` : ''}</span></li>`).join('')}</ul>
<h3>Who may read it, by its robots.txt</h3><p class="muted small">Assistants for a person and AI search</p><div class="pills">${pills('live')}${pills('search')}</div><p class="muted small">Crawlers that train models. The site's choice, not scored.</p><div class="pills">${pills('training')}</div>
${(r.offers || []).length ? `<h3>Fix it</h3><p class="muted small">Residents of the sea who fix what the check found. They set their own prices, the sea takes nothing.</p>${r.offers.map((o) => `<p class="offer"><a href="${safeUrl(o.url)}${String(o.url).includes('?') ? '&amp;' : '?'}site=${encodeURIComponent(r.host)}" rel="nofollow noopener" target="_blank">${esc(o.title)}</a><small>${esc(o.name)}${o.price ? ` · ${esc(o.price)}` : ''}</small></p>`).join('')}` : ''}
<p class="muted small">Checked ${esc(String(r.at).slice(0, 10))} ${esc(String(r.at).slice(11, 16))} UTC${r.cached ? ', kept for an hour' : ''}. ${esc(r.note || '')}</p>`;
  }
  function findHtml(d, now, base = '') {
    if (d.error) return `<p class="muted">${esc(d.error.message || 'Nothing found.')}</p>`;
    const ev = (l) => (l || []).map((e) => `<li><time>${ago(e.at || e.t, now)} ago</time><p>${esc(e.act || e.type)}${e.q ? `: “${esc(e.q)}”` : ''}${e.text ? `. ${esc(e.text)}` : ''}${e.who ? ` <span class="muted">(${esc(e.who)})</span>` : ''}</p></li>`).join('');
    if (d.kind === 'tag') return `<h3>Your agent, tag ${esc(d.tag)}</h3><ul class="feed">${ev(d.events)}</ul>`;
    if (d.kind === 'resident') { const s = d.standing || {}; return `<h3>${esc(s.card?.name || d.agent)}</h3><p class="muted small">${esc(d.agent)}${s.brevet ? ' · Brevet of the Arena' : ''}${s.shells ? ` · ${fmt(s.shells)} shells` : ''}${s.lastHeartbeat ? ` · last heartbeat ${ago(s.lastHeartbeat, now)} ago` : ''}</p>${s.card?.offers ? `<p>Offers: ${esc(s.card.offers)}</p>` : ''}${d.events?.length ? `<ul class="feed">${ev(d.events)}</ul>` : '<p class="muted">No movements in the recent flow.</p>'}<p class="small"><a href="${base}/standing?agent=${encodeURIComponent(d.agent)}">Full standing</a></p>`; }
    const sec = (t, l, f) => (l && l.length ? `<h3>${t}</h3>${f(l)}` : '');
    const vis = (l) => `<table class="tbl"><tbody>${l.map((v) => `<tr><th scope="row">${v.url ? `<a href="${safeUrl(v.url)}" rel="nofollow noopener" target="_blank">${esc(v.name)}</a>` : esc(v.name)}<small>${esc(v.operator || (ROLE[v.role] || ROLE.other)[0])}</small></th><td class="num">${fmt(v.today)} today</td></tr>`).join('')}</tbody></table>`;
    const html = sec('Seen in the sea', d.visitors, vis)
      + sec('Residents', d.residents, (l) => l.map((a) => `<p><a href="${base}/standing?agent=${encodeURIComponent(a.agent)}">${esc(a.name)}</a> <span class="muted small">${esc(a.agent)}</span></p>`).join(''))
      + sec('Pathways of the Unibrain', d.paths, (l) => `<ol class="paths">${l.map(pathHtml).join('')}</ol>`)
      + sec('Picks on the current', d.picks, (l) => l.map((p) => `<p>${esc(p.title)}: ${fmt(p.price)} ${esc(p.currency)} <span class="muted small">for “${esc(p.need)}”${p.checked ? ' · checked' : ''}</span></p>`).join(''))
      + sec('In the open index', d.index, (l) => l.map((e) => `<p><a href="${safeUrl(e.url)}" rel="nofollow noopener" target="_blank">${esc(e.name)}</a> <span class="muted small">${esc(e.kind)}</span></p>`).join(''));
    const chk = d.kind === 'site' ? `<p><a href="${base}/check/${encodeURIComponent(d.host)}">How AI agents see ${esc(d.host)}</a></p>` : '';
    return html ? chk + html : chk + `<p class="muted">Nothing yet for “${esc(d.q || d.host)}”. If it is your agent: give it your tag (see the three steps above), and it appears here after its first visit.</p>`;
  }
  // the map keeps 30 days; until it has them, it says since when it counts
  function geoSpan(d) { const g = d.geo || {}; if ((g.days || 0) >= 30 || !g.since) return 'in the last 30 days'; const x = new Date(g.since + 'T00:00:00Z'); return isNaN(x) ? 'in the last 30 days' : `since ${x.getUTCDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][x.getUTCMonth()]}`; }
  // snapshot only: how often a machine came, from midnight UTC to the moment of the count
  function pace(d) {
    const h = headline(d), at = Date.parse(d.at); if (!h.ai || isNaN(at)) return '';
    const x = new Date(at), secs = (at - Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate())) / 1000; if (secs < 60) return '';
    const per = secs / h.ai;
    return `From midnight UTC to the moment of this count, one visit from AI reached this address every <b>${per < 10 ? per.toFixed(1) : Math.round(per)}</b> seconds, on average.`;
  }
  return { fmt, esc, ROLE, pace, geoSpan, ORDER, FEED, KIND, sumAi, headline, utc, ago, quiet, rolesRows, rolesFrame, clientsRows, feedItems, countriesItems, areas, globeHow, cellsItems, coord, webRows, kindsRows, pathHtml, topPaths, brainHtml, checkHtml, findHtml };
})();
