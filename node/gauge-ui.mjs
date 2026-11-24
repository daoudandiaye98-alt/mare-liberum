// Mare Liberum · the pages of the gauges: the agent weather of the web (/weather, /de/agentenwetter) and the owner's
// reading of one site (/gauge/view). The weather is written on the node from live numbers. The owner's page is empty
// on the node: its small program reads the owner key from the part of the address after #, which never leaves the
// browser, takes it out of the address bar, and asks the sea with the key in a header. Everything a sensor sent is
// put on the page as text, never as markup. (The programs are plain script without template literals.)
import { page } from './pages.mjs';
import { snippetsFor, KIND_ORDER } from './gauge.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const KIND_LABEL = {
  en: { assistant: 'Assistant reading for a person', 'search-ai': 'AI search', 'ai-crawler': 'AI crawler (training)', search: 'Search engine', 'mcp-client': 'MCP client', a2a: 'A2A agent', registry: 'Registry', crawler: 'Other crawler', resident: 'Resident agent', tool: 'Program', unknown: 'Unknown', anonymous: 'No name', browser: 'Person' },
  de: { assistant: 'Assistent liest für einen Menschen', 'search-ai': 'KI-Suche', 'ai-crawler': 'KI-Crawler (Training)', search: 'Suchmaschine', 'mcp-client': 'MCP-Client', a2a: 'A2A-Agent', registry: 'Verzeichnis', crawler: 'Sonstiger Crawler', resident: 'Bewohner-Agent', tool: 'Programm', unknown: 'Unbekannt', anonymous: 'Ohne Namen', browser: 'Mensch' },
};
const LAKE = {
  en: { 'mcp-registry': 'Official MCP registry', 'npm-mcp': 'MCP servers on npm', erc8004: 'Agents on chain (ERC-8004)', 'x402-bazaar': 'Paid APIs (x402 Bazaar)', 'x402-payai': 'Paid APIs (x402 PayAI)', 'a2a-registry': 'A2A registry', agentverse: 'Agentverse', 'virtuals-acp': 'Virtuals agent commerce', 'hf-spaces': 'Hugging Face Spaces', 'apify-store': 'Apify tools', 'apis-guru': 'OpenAPI descriptions', 'ucp-stores': 'Stores for shopping agents', join: 'Joined by themselves' },
  de: { 'mcp-registry': 'Offizielles MCP-Register', 'npm-mcp': 'MCP-Server auf npm', erc8004: 'Agenten auf der Chain (ERC-8004)', 'x402-bazaar': 'Bezahl-APIs (x402 Bazaar)', 'x402-payai': 'Bezahl-APIs (x402 PayAI)', 'a2a-registry': 'A2A-Register', agentverse: 'Agentverse', 'virtuals-acp': 'Virtuals Agentenhandel', 'hf-spaces': 'Hugging Face Spaces', 'apify-store': 'Apify-Werkzeuge', 'apis-guru': 'OpenAPI-Beschreibungen', 'ucp-stores': 'Shops für Einkaufs-Agenten', join: 'Selbst beigetreten' },
};

const T = {
  en: {
    path: '/weather', title: 'Agent weather of the web: which AI agents read websites today · Mare Liberum',
    desc: 'Live: how much of the traffic on real websites comes from AI assistants reading for people, AI search, AI crawlers and search engines, added up from sites that proved their domain. Plus what grew in the agent registries. Free gauge for your own site.',
    h1: 'The agent weather of the web',
    lead: 'AI agents read the web all day. Few websites can tell which ones, and what for. A gauge counts them on one site: an assistant reading for a person, an AI search, a crawler that trains a model, a search engine, a person. The sites whose owners proved their domain add up to this weather. It never names a site and never shows a path.',
    few: (n, m) => `So far ${n} website${n === 1 ? '' : 's'} with a proven domain report${n === 1 ? 's' : ''}. Below ${m} sites these numbers describe very few places; they are shown as they are.`,
    pulse: (t) => `Today so far: ${n(t.requests)} requests on ${n(t.sites)} sites · ${t.share.agents}% agents · ${t.share.assistants}% assistants reading for a person · ${t.share.aiCrawlers}% AI crawlers · ${t.share.people}% people`,
    none: 'No website reports yet today. Set the first gauge below.',
    who: 'Who reads the web today', whoY: 'Yesterday', kind: 'Kind', name: 'Name', req: 'Requests',
    days: 'Fourteen days', day: 'Day', sites: 'Sites', agents: 'Agents', assistants: 'Assistants', aiSearch: 'AI search', aiCrawlers: 'AI crawlers', people: 'People',
    grew: 'What grew on the agent web', grewLead: 'The open index of the sea reads the public registries of agents every day. The size of each one, and how much it grew:', lake: 'Registry', now: 'Entries', plusDay: 'Since the day before', plusWeek: 'Over the week', noLakes: 'The first reading of the registries comes with the next tide.',
    set: 'Set a gauge on your website', setLead: 'Free. One line on your server, or a log drain, and you see which AI agents read your site, what they read, and when an assistant read a page for a person. Prove your domain and your site counts into this weather (never by name).',
    host: 'Your website', label: 'Name (optional)', go: 'Set the gauge',
    how: 'How it works', howList: ['You get two keys. The sensor address only adds counts; it goes into your server. The owner key reads, proves, renews and closes; keep it like a password.', 'Each request leaves the sea four things: the name the client gives itself, the path without its query, the method and the status. No address, no cookie, nothing a person typed. A person is counted as a number.', 'Assistants reading for a person are kept with time, name and page for 90 days, everything else as counts for 31 days.', 'To join the weather, put the id of your gauge in /.well-known/mare-gauge.txt on your domain and press prove.'],
    data: 'As data', alt: 'Deutsch', altPath: '/de/agentenwetter',
  },
  de: {
    path: '/de/agentenwetter', title: 'Agentenwetter: welche KI-Agenten heute Websites lesen · Mare Liberum',
    desc: 'Live: wie viel vom Verkehr echter Websites von KI-Assistenten kommt, die für Menschen lesen, von KI-Suchen, KI-Crawlern und Suchmaschinen, zusammengezählt aus Websites mit nachgewiesener Domain. Dazu, was in den Agenten-Registern wuchs. Kostenloser Pegel für die eigene Website.',
    h1: 'Das Agentenwetter im Netz',
    lead: 'KI-Agenten lesen den ganzen Tag im Netz. Kaum eine Website weiß, welche und wofür. Ein Pegel zählt sie auf einer Seite: ein Assistent, der für einen Menschen liest, eine KI-Suche, ein Crawler, der ein Modell trainiert, eine Suchmaschine, ein Mensch. Die Websites, deren Betreiber ihre Domain nachgewiesen haben, ergeben zusammen dieses Wetter. Es nennt nie eine Website und zeigt nie einen Pfad.',
    few: (n, m) => `Bisher melden ${n} Website${n === 1 ? '' : 's'} mit nachgewiesener Domain. Unter ${m} Websites beschreiben diese Zahlen sehr wenige Orte; sie stehen hier, wie sie sind.`,
    pulse: (t) => `Heute bisher: ${n(t.requests, 'de')} Anfragen auf ${n(t.sites, 'de')} Websites · ${de(t.share.agents)} % Agenten · ${de(t.share.assistants)} % Assistenten, die für einen Menschen lesen · ${de(t.share.aiCrawlers)} % KI-Crawler · ${de(t.share.people)} % Menschen`,
    none: 'Heute meldet noch keine Website. Setzen Sie unten den ersten Pegel.',
    who: 'Wer heute im Netz liest', whoY: 'Gestern', kind: 'Art', name: 'Name', req: 'Anfragen',
    days: 'Vierzehn Tage', day: 'Tag', sites: 'Websites', agents: 'Agenten', assistants: 'Assistenten', aiSearch: 'KI-Suche', aiCrawlers: 'KI-Crawler', people: 'Menschen',
    grew: 'Was im Agenten-Netz wuchs', grewLead: 'Der offene Index des Meeres liest jeden Tag die öffentlichen Register der Agenten. Die Größe jedes Registers und wie viel dazukam:', lake: 'Register', now: 'Einträge', plusDay: 'Seit dem Vortag', plusWeek: 'Über die Woche', noLakes: 'Die erste Messung der Register kommt mit der nächsten Gezeit.',
    set: 'Einen Pegel auf die eigene Website setzen', setLead: 'Kostenlos. Eine Zeile auf Ihrem Server oder ein Log-Drain, und Sie sehen, welche KI-Agenten Ihre Website lesen, was sie lesen und wann ein Assistent eine Seite für einen Menschen gelesen hat. Weisen Sie Ihre Domain nach, und Ihre Website zählt in dieses Wetter (nie mit Namen).',
    host: 'Ihre Website', label: 'Name (freiwillig)', go: 'Pegel setzen',
    how: 'So funktioniert es', howList: ['Sie bekommen zwei Schlüssel. Die Sensor-Adresse fügt nur Zählungen hinzu; sie gehört in Ihren Server. Der Eigner-Schlüssel liest, weist nach, erneuert und schließt; bewahren Sie ihn wie ein Passwort auf.', 'Jede Anfrage gibt dem Meer vier Dinge: den Namen, den sich der Client selbst gibt, den Pfad ohne Abfrage, die Methode und den Status. Keine Adresse, kein Cookie, nichts, was ein Mensch eingegeben hat. Ein Mensch wird als Zahl gezählt.', 'Assistenten, die für einen Menschen lesen, bleiben mit Zeit, Name und Seite 90 Tage stehen, alles andere als Zählung 31 Tage.', 'Um ins Wetter einzugehen, legen Sie die Kennung Ihres Pegels in /.well-known/mare-gauge.txt auf Ihrer Domain und drücken Nachweisen.'],
    data: 'Als Daten', alt: 'English', altPath: '/weather',
  },
};
function n(x, lang) { return x == null ? '–' : Number(x).toLocaleString(lang === 'de' ? 'de-DE' : 'en-US'); }
const de = (x) => String(x).replace('.', ',');
const sign = (x, lang) => (x == null ? '–' : `${x > 0 ? '+' : ''}${n(x, lang)}`);

export function weatherPage(base, w, lang = 'en') {
  const t = T[lang] || T.en, L = KIND_LABEL[lang] || KIND_LABEL.en, LK = LAKE[lang] || LAKE.en, today = w.today || {}, y = w.yesterday || {};
  const rows = (list) => list.map((a) => `<tr><td>${esc(L[a.kind] || a.kind)}</td><td>${esc(a.name)}</td><td>${n(a.requests, lang)}</td></tr>`).join('');
  const agents = (today.agentsTop || []).length ? today.agentsTop : null;
  const bar = (v, max) => (v ? `<span class="gbar" style="--w:${Math.max(2, Math.round((v / max) * 100))}%"></span>` : '');
  const maxAgents = Math.max(1, ...(w.days || []).map((d) => d.agents || 0)), lived = (w.days || []).filter((d) => d.requests).reverse();
  const reg = w.registries || {}, grew = (reg.grew || []).filter((g) => g.now);
  const sn = snippetsFor(base, null);
  const body = `<p class="muted" style="margin:0"><a href="${t.altPath}" hreflang="${lang === 'de' ? 'en' : 'de'}">${t.alt}</a></p>
<h1>${t.h1}</h1>
<p style="font-size:1.15rem">${t.lead}</p>
${w.note ? `<p class="muted">${esc(t.few(w.sites?.reportingToday || w.sites?.reportingYesterday || 0, 3))}</p>` : ''}
<p class="pulse">${today.requests ? esc(t.pulse(today)) : esc(t.none)}</p>
<h2>${t.who}</h2>
${agents ? `<table><thead><tr><th>${t.kind}</th><th>${t.name}</th><th>${t.req}</th></tr></thead><tbody>${rows(agents)}</tbody></table>` : (y.agentsTop || []).length ? `<p class="muted">${t.whoY}</p><table><thead><tr><th>${t.kind}</th><th>${t.name}</th><th>${t.req}</th></tr></thead><tbody>${rows(y.agentsTop)}</tbody></table>` : `<p class="muted">${esc(t.none)}</p>`}
<h2>${t.days}</h2>
${lived.length ? `<table class="gdays"><thead><tr><th>${t.day}</th><th>${t.sites}</th><th>${t.agents}</th><th>${t.assistants}</th><th>${t.aiCrawlers}</th><th>${t.people}</th></tr></thead><tbody>${lived.map((d) => `<tr><td>${esc(d.day.slice(5))}</td><td>${n(d.sites, lang)}</td><td>${n(d.agents, lang)} ${bar(d.agents, maxAgents)}</td><td>${n(d.assistants, lang)}</td><td>${n(d.aiCrawlers, lang)}</td><td>${n(d.people, lang)}</td></tr>`).join('')}</tbody></table>` : `<p class="muted">${esc(t.none)}</p>`}
<h2>${t.grew}</h2>
${grew.length ? `<p>${t.grewLead}</p><table><thead><tr><th>${t.lake}</th><th>${t.now}</th><th>${t.plusDay}</th><th>${t.plusWeek}</th></tr></thead><tbody>${grew.map((g) => `<tr><td>${esc(LK[g.lake] || g.lake)}</td><td>${n(g.now, lang)}</td><td>${sign(g.day, lang)}</td><td>${sign(g.week, lang)}</td></tr>`).join('')}</tbody></table><p class="muted"><small>${esc(reg.day || '')}${reg.since ? ` · ${esc(reg.since)} → ${esc(reg.day)}` : ''}${reg.weekSince ? ` · ${esc(reg.weekSince)} → ${esc(reg.day)}` : ''} · ${esc(reg.note || '')}</small></p>` : `<p class="muted">${t.noLakes}</p>`}
<h2 id="gauge">${t.set}</h2>
<p>${t.setLead}</p>
<div class="box"><label>${t.host}<br><input id="g-host" placeholder="example.com" autocomplete="off" spellcheck="false" style="width:100%"></label><br><label>${t.label}<br><input id="g-name" autocomplete="off" style="width:100%"></label><br><button id="g-go" type="button">${t.go}</button><div id="g-out" aria-live="polite"></div></div>
<h2>${t.how}</h2><ul>${t.howList.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
<details><summary>Next.js · Cloudflare · Node · WordPress · Vercel · nginx/Apache/Caddy</summary>${['nextjs', 'cloudflare', 'node', 'wordpress', 'vercelDrain', 'serverLog'].map((k) => `<p><b>${esc(sn[k].file)}</b></p><pre>${esc(sn[k].code)}</pre>`).join('')}</details>
<p class="muted"><small>${esc(w.at || '')} · ${t.data}: <a href="/weather.json">/weather.json</a> · ${esc(w.notice || '')}</small></p>
<style>.gbar{display:inline-block;height:.55em;width:var(--w);max-width:7em;background:currentColor;opacity:.55;border-radius:3px;vertical-align:middle}.gdays td{white-space:nowrap}#g-out pre{white-space:pre-wrap;overflow-wrap:anywhere}</style>
<script>${GAUGE_NEW_JS.replace('__LANG__', lang)}</script>`;
  return page(base, t.path, t.title, t.desc, body,
    { '@context': 'https://schema.org', '@type': 'Dataset', name: lang === 'de' ? 'Agentenwetter im Netz' : 'Agent weather of the web', description: t.desc, url: `${base}${t.path}`, isAccessibleForFree: true, license: 'https://creativecommons.org/publicdomain/zero/1.0/', creator: { '@type': 'Organization', name: 'Mare Liberum', url: base }, distribution: [{ '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: `${base}/weather.json` }] },
    '/og.png', { lang, alt: { en: '/weather', de: '/de/agentenwetter' } });
}

// the small program of the weather page: sets a gauge and shows its keys once, with the lines for the server
const GAUGE_NEW_JS = String.raw`(function(){var L='__LANG__',D=L==='de';var go=document.getElementById('g-go'),out=document.getElementById('g-out');if(!go)return;
function el(t,x){var e=document.createElement(t);if(x!=null)e.textContent=x;return e}
function pre(x){var p=el('pre',x);return p}
go.addEventListener('click',function(){var host=document.getElementById('g-host').value.trim(),name=document.getElementById('g-name').value.trim();out.textContent=D?'Wird gesetzt …':'Setting …';go.disabled=true;
fetch('/gauge/new',{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify({host:host,name:name})}).then(function(r){return r.json()}).then(function(j){go.disabled=false;out.textContent='';if(j.error){out.appendChild(el('p',j.error.message));return}
out.appendChild(el('p',D?'Der Pegel steht. Beide Schlüssel werden nur jetzt gezeigt: jetzt sichern.':'The gauge stands. Both keys are shown only now: keep them now.'));
out.appendChild(el('p',D?'Sensor-Adresse (in Ihren Server):':'Sensor address (into your server):'));out.appendChild(pre(j.sensor));
out.appendChild(el('p',D?'Eigner-Schlüssel (wie ein Passwort):':'Owner key (like a password):'));out.appendChild(pre(j.ownerKey));
var a=el('a',D?'Ihre Ansicht öffnen':'Open your reading');a.href=j.view;out.appendChild(a);
out.appendChild(el('p',(D?'Für das Wetter: Datei ':'For the weather: file ')+j.verify.file+(D?' mit dem Inhalt ':' with the content ')+j.verify.content));
var s=j.snippets||{};['nextjs','cloudflare','node','wordpress','vercelDrain','serverLog','test'].forEach(function(k){if(!s[k])return;out.appendChild(el('p',s[k].file));out.appendChild(pre(s[k].code))})}).catch(function(){go.disabled=false;out.textContent=D?'Das Meer hat nicht geantwortet. Bitte noch einmal.':'The sea did not answer. Please try again.'})})})();`;

// the owner's reading of one site. The page carries no key and no number; its program fills it
export function gaugeViewPage(base) {
  const body = `<h1>Your gauge · Ihr Pegel</h1>
<p class="muted">The owner key travels after the # of the address: it never leaves this browser. The page takes it out of the address bar and keeps it only while the tab is open. · Der Eigner-Schlüssel steht hinter dem # der Adresse und verlässt diesen Browser nie.</p>
<div class="box" id="v-key" hidden><label>Owner key · Eigner-Schlüssel<br><input id="v-k" placeholder="mlgo_…" autocomplete="off" spellcheck="false" style="width:100%"></label><br><button id="v-open" type="button">Open · Öffnen</button></div>
<div id="v-out" aria-live="polite"></div>
<style>.gbar{display:inline-block;height:.55em;width:var(--w);max-width:7em;background:currentColor;opacity:.55;border-radius:3px;vertical-align:middle}#v-out td{overflow-wrap:anywhere}</style>
<script>${GAUGE_VIEW_JS.replace('__KINDS__', JSON.stringify({ order: KIND_ORDER, en: KIND_LABEL.en, de: KIND_LABEL.de }).replace(/</g, '\\u003c'))}</script>`;
  return page(base, '/gauge/view', 'Your gauge · Mare Liberum', 'The reading of one website: which AI agents read it, what they read, and when an assistant read a page for a person.', body, null, '/og.png', { robots: 'noindex' });
}
const GAUGE_VIEW_JS = String.raw`(function(){var K=__KINDS__,D=/^de/i.test(navigator.language||''),key='';var out=document.getElementById('v-out'),box=document.getElementById('v-key');
function tr(en,de){return D?de:en}function el(t,x){var e=document.createElement(t);if(x!=null)e.textContent=x;return e}
function lbl(k){return (D?K.de:K.en)[k]||k}function num(x){return x==null?'–':Number(x).toLocaleString(D?'de-DE':'en-US')}
function table(head,rows){var t=el('table'),th=el('thead'),r=el('tr');head.forEach(function(h){r.appendChild(el('th',h))});th.appendChild(r);t.appendChild(th);var b=el('tbody');rows.forEach(function(row){var x=el('tr');row.forEach(function(c){var td=el('td');if(c&&c.nodeType)td.appendChild(c);else td.textContent=c==null?'':String(c);x.appendChild(td)});b.appendChild(x)});t.appendChild(b);return t}
function call(path,body){return fetch(path,{method:body?'POST':'GET',headers:{authorization:'Bearer '+key,accept:'application/json','content-type':'application/json'},body:body?JSON.stringify(body):undefined}).then(function(r){return r.json()})}
function bar(v,m){var s=el('span');if(!v)return s;s.className='gbar';s.style.setProperty('--w',Math.max(2,Math.round(v/m*100))+'%');return s}
function show(j){out.textContent='';if(j.error){out.appendChild(el('p',j.error.message));box.hidden=false;return}box.hidden=true;var s=j.site;
out.appendChild(el('h2',s.host+(s.name?' · '+s.name:'')));
out.appendChild(el('p',(s.verified?tr('Domain proven: this site counts into the agent weather (never by name).','Domain nachgewiesen: diese Website zählt ins Agentenwetter (nie mit Namen).'):tr('Domain not proven yet. ','Domain noch nicht nachgewiesen. ')+j.weather)+(s.last?' · '+tr('last count ','letzte Zählung ')+s.last:'')));
[['today',tr('Today','Heute')],['yesterday',tr('Yesterday','Gestern')]].forEach(function(p){var d=j[p[0]];out.appendChild(el('h3',p[1]+' · '+d.day));
out.appendChild(el('p',num(d.requests)+tr(' requests · ',' Anfragen · ')+d.share.agents+tr('% agents · ','% Agenten · ')+d.share.assistants+tr('% assistants for a person · ','% Assistenten für einen Menschen · ')+d.share.aiCrawlers+tr('% AI crawlers · ','% KI-Crawler · ')+d.share.people+tr('% people','% Menschen')));
if(d.agentsTop&&d.agentsTop.length)out.appendChild(table([tr('Kind','Art'),'Name',tr('Requests','Anfragen')],d.agentsTop.map(function(a){return [lbl(a.kind),a.name,num(a.requests)]})));
if(d.reads&&d.reads.length){out.appendChild(el('p',tr('What each role read (first part of the path):','Was jede Rolle las (erster Teil des Pfads):')));out.appendChild(table([tr('Role','Rolle'),tr('Path','Pfad'),tr('Requests','Anfragen')],d.reads.slice(0,20).map(function(r){return [r.role,r.path,num(r.requests)]})))}});
out.appendChild(el('h3',tr('Assistants that read for a person','Assistenten, die für einen Menschen lasen')));
if(j.forPeople.length)out.appendChild(table([tr('Time','Zeit'),'Name',tr('Page','Seite')],j.forPeople.slice(0,40).map(function(x){return [String(x.t).replace('T',' ').slice(0,16),x.name+(x.kind==='search-ai'?' ('+lbl(x.kind)+')':''),x.path]})));else out.appendChild(el('p',tr('None yet.','Noch keiner.')));
out.appendChild(el('h3',tr('Thirty days','Dreißig Tage')));var m=Math.max.apply(null,[1].concat(j.days.map(function(d){return d.agents})));
var lived=j.days.filter(function(d){return d.requests}).reverse();if(lived.length)out.appendChild(table([tr('Day','Tag'),tr('Agents','Agenten'),tr('Assistants','Assistenten'),tr('AI crawlers','KI-Crawler'),tr('People','Menschen')],lived.map(function(d){var c=document.createElement('span');c.appendChild(document.createTextNode(num(d.agents)+' '));c.appendChild(bar(d.agents,m));return [d.day.slice(5),c,num(d.assistants+d.aiSearch),num(d.aiCrawlers),num(d.people)]})));else out.appendChild(el('p',tr('No counts yet. Put the sensor line in your server.','Noch keine Zählung. Setzen Sie die Sensor-Zeile in Ihren Server.')));
var act=el('div');act.className='box';var b1=el('button',tr('Prove the domain','Domain nachweisen'));b1.type='button';b1.onclick=function(){call('/gauge/verify',{}).then(function(r){alertBox(r.verified?tr('Proven. The site joins the weather.','Nachgewiesen. Die Website geht ins Wetter ein.'):(r.error?r.error.message:tr('Not yet: ','Noch nicht: ')+r.next));if(r.verified)load()})};
var b2=el('button',tr('New sensor address','Neue Sensor-Adresse'));b2.type='button';b2.onclick=function(){call('/gauge/rekey',{which:'sensor'}).then(function(r){alertBox(r.sensor?tr('New sensor address (the old one stops counting): ','Neue Sensor-Adresse (die alte zählt nicht mehr): ')+r.sensor:(r.error?r.error.message:''))})};
act.appendChild(b1);act.appendChild(document.createTextNode(' '));act.appendChild(b2);var msg=el('pre');msg.id='v-msg';msg.hidden=true;act.appendChild(msg);out.appendChild(act);
out.appendChild(el('p',j.kept))}
function alertBox(t){var m=document.getElementById('v-msg');if(m){m.hidden=false;m.textContent=t}}
function load(){out.textContent=tr('Reading …','Wird gelesen …');call('/gauge/site').then(show).catch(function(){out.textContent=tr('The sea did not answer. Please try again.','Das Meer hat nicht geantwortet. Bitte noch einmal.')})}
var h=decodeURIComponent((location.hash||'').slice(1));if(h){key=h.trim();try{history.replaceState(null,'',location.pathname)}catch(e){}load()}else box.hidden=false;
document.getElementById('v-open').onclick=function(){key=document.getElementById('v-k').value.trim();if(key)load()}})();`;
