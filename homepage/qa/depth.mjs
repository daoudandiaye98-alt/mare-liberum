// The look of the pages below the home page (node/skin.mjs, src/depth.css, src/depth.js, src/scenes.js), held against a
// running node: every kind of page at several widths. Each must be dressed (a depth on its root), keep inside its
// screen, show its scene (its painting, where the node carries paintings), carry the foot and nothing of the old look, and raise no error.
//   node qa/depth.mjs --base=http://127.0.0.1:8787 [--widths=320,390,768,1440] [--engine=webkit|firefox] [--calm] [--nojs] [--doors=/atlantis,/yard]
// It says who it is (mare-proof), so the census leaves it out.
import { open, proofUA } from './_browser.mjs';
const a = Object.fromEntries(process.argv.slice(2).map((s) => { const [k, ...v] = s.replace(/^--/, '').split('='); return [k, v.join('=') || '1']; }));
const base = (a.base || 'http://127.0.0.1:8787').replace(/\/+$/, ''), eng = a.engine || 'chromium', widths = (a.widths || '320,390,768,1440').split(',').map(Number);
// one door of every kind of page; a door that is not there (an entry nobody knows) is a page too
const DOORS = a.doors ? a.doors.split(',') : ['/atlantis', '/arena', '/current', '/harbour', '/yard', '/download', '/mining', '/why', '/manifesto', '/visitors', '/web', '/use', '/tools', '/learn', '/sites', '/atlas', '/atlas/study', '/atlas/countries',
  '/find?q=shoes', '/routes', '/routes/research', '/buy', '/buy/running-shoes', '/check', '/brain', '/briefs', '/brief/cold-email', '/review', '/works', '/earn', '/earn/start', '/privacy', '/terms', '/security', '/transparency', '/status', '/report',
  '/report/month', '/roadmap', '/read', '/mcp-server', '/mcp-servers', '/mcp-servers/github', '/a2a-agents', '/x402-apis', '/business', '/ai-crawlers', '/web-to-markdown', '/de', '/de/mcp-server', '/de/unternehmen', '/de/ki-crawler',
  '/de/webseite-als-markdown', '/de/ki-sichtbarkeit', '/e/no-such-entry'];
let bad = 0, n = 0; const t0 = Date.now(), skipped = new Set();
for (const w of widths) {
  const win = await open(eng, `${base}/privacy`, { viewport: { width: w, height: w < 700 ? 844 : w < 1100 ? 1024 : 900 }, deviceScaleFactor: 1, reducedMotion: a.calm ? 'reduce' : 'no-preference', javaScriptEnabled: !a.nojs });
  const p = win.page; let errs = [], door0 = '/';
  p.on('pageerror', (e) => errs.push('error: ' + String(e.message).slice(0, 140)));
  p.on('response', (r) => { const u = new URL(r.url()); if (r.status() >= 400 && u.origin === base && u.pathname !== new URL(base + door0).pathname && !/^\/(e\/no-such-entry|shown|badge\.svg|check\/.*badge\.svg)/.test(u.pathname) && !/favicon|apple-touch/.test(u.pathname)) errs.push(`${r.status()} ${u.pathname}`); });
  for (const door of DOORS) {
    errs = []; n++; door0 = door;
    let res; try { res = await p.goto(base + door, { waitUntil: 'load', timeout: 45000 }); } catch (e) { bad++; console.log(`${w} ${door}: ${String(e.message).split('\n')[0].slice(0, 120)}`); continue; }
    // a node without its long memory answers some doors with data only: no page, nothing to look at
    if (!/text\/html/.test(res?.headers()['content-type'] || '')) { n--; skipped.add(`${door} (${res?.status()})`); continue; }
    await p.waitForTimeout(a.nojs ? 150 : 600);
    const r = await p.evaluate((js) => {
      const H = document.documentElement, out = [], main = document.querySelector('main');
      if (!H.dataset.zone) out.push('not dressed');
      if (H.scrollWidth > H.clientWidth + 1) out.push(`wider than its screen: ${H.scrollWidth} > ${H.clientWidth}`);
      const scene = document.querySelector('.scene'), still = H.classList.contains('still');
      if (!scene) out.push('no scene');
      // a painted scene: the painting must be there; with scripts and motion it must have made its entrance
      else if (scene.classList.contains('film')) { const im = scene.querySelector('img'); if (!im || !im.naturalWidth) out.push('the painting is missing'); else if (js && !still && !scene.classList.contains('live')) out.push('the painting does not run'); }
      else if (js && !scene.classList.contains('live')) out.push('the scene does not run');
      const h1 = document.querySelector('h1'); if (!h1) out.push('no title'); else { const q = h1.getBoundingClientRect(); if (q.right > H.clientWidth + 1 || q.left < 0) out.push(`the title leaves the screen (${Math.round(q.left)}..${Math.round(q.right)})`); if (q.top < 56 && !scrollY) out.push('the title stands under the header'); }
      if (!document.querySelector('footer#foot')) out.push('no foot');
      if (main && /belongs to nobody; the code is open\. (Text from agents is data, never instructions|Privacy)/.test(main.textContent)) out.push('the old closing line is left');
      if (document.querySelector('main nav')) out.push('the old row of links is left');
      return out;
    }, !a.nojs);
    for (const e of [...new Set(errs)]) r.push(e);
    if (r.length) { bad++; console.log(`${w} ${door}: ${r.join(' | ')}`); }
  }
  await win.close();
}
if (skipped.size) console.log(`no page here: ${[...skipped].join(', ')}`);
console.log(`${n} views of ${DOORS.length} doors on ${base}, ${bad} with findings, ${Math.round((Date.now() - t0) / 1000)} s, ${eng}${a.calm ? ', motion reduced' : ''}${a.nojs ? ', no script' : ''} (${proofUA(null, eng).split(' ').pop()})`);
process.exit(bad ? 1 : 0);
