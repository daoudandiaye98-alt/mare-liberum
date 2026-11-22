// How the sea tells a person from a program under a browser's name, shown in real engines.
// Every page a browser gets carries one line: once the page has been in front of someone it says so (GET /shown?p=<door>),
// and only that makes a visit by a person. A browser's request for a page that is never shown is counted, after a wait,
// as a script. This tool opens pages the way a person's browser does and the way a driven browser does, and reads the
// node's census before and after. Numbers, no ticks.
//   node qa/shown.mjs --url=http://localhost:8787/ [--engines=chromium,webkit,firefox] [--wait=8]
// It runs against a node of one's own only: here the windows do not say "mare-proof" (they have to be counted), so on
// the open sea every run would read as people who were never there. --wait is the node's own wait in seconds
// (SHOWN_WAIT in node/core.mjs, five minutes; a node started for this with a shorter one makes the last step quick).
import { webkit, firefox, chromium } from 'playwright-core';
import { CHROME } from './_browser.mjs';
const a = Object.fromEntries(process.argv.slice(2).map((s) => { const [k, ...v] = s.replace(/^--/, '').split('='); return [k, v.join('=') || '1']; }));
const base = String(a.url || 'http://localhost:8787/').replace(/\/+$/, '');
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) { console.error('shown.mjs counts as people: it runs against a node of your own (http://localhost:…), never the open sea'); process.exit(2); }
const ENGINES = { webkit, firefox, chromium }, want = (a.engines || 'chromium,webkit,firefox').split(','), wait = Number(a.wait || 300);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// the census as the node tells it, asked under the name of a proof (which the census leaves out)
const census = async () => { const d = await (await fetch(`${base}/visitors.json`, { headers: { 'user-agent': 'mare-proof shown.mjs', accept: 'application/json' } })).json(); return { people: d.today?.roles?.people || 0, tools: d.today?.roles?.tools || 0 }; };
// a window: `driven` leaves the browser saying that a program drives it (navigator.webdriver, as every automation does);
// otherwise it answers as a person's browser would
async function win(name, { driven = false, hidden = false } = {}) {
  const b = await ENGINES[name].launch(name === 'chromium' ? CHROME : {}), ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  if (!driven) await ctx.addInitScript(() => { try { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true }); } catch {} });
  if (hidden) await ctx.addInitScript(() => { window.__vis = 'hidden'; Object.defineProperty(Document.prototype, 'visibilityState', { get: () => window.__vis, configurable: true }); });
  const page = await ctx.newPage(), said = [], errs = [];
  page.on('request', (r) => { const u = new URL(r.url()); if (u.pathname === '/shown') said.push({ at: Date.now(), p: u.searchParams.get('p'), site: r.headers()['sec-fetch-site'] || null }); });
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  return { page, said, errs, close: () => b.close() };
}
const report = [], first = await census();
for (const name of want) {
  const r = { engine: name }, before = await census();
  try {
    // 1 · a driven browser opens a page and looks at nothing
    { const w = await win(name, { driven: true }); await w.page.goto(`${base}/buy`, { waitUntil: 'load' }); await sleep(3200); r.driven = { webdriver: await w.page.evaluate(() => navigator.webdriver), said: w.said.length, errors: w.errs };
      // a browser that names its driver in its own name (a headless Chrome does) is never taken for a person, whatever its pages say
      r.namesDriver = /headless|lighthouse|phantomjs|puppeteer|playwright|selenium|webdriver|cypress/i.test(await w.page.evaluate(() => navigator.userAgent)); await w.close(); }
    // 2 · a person's browser opens a page and reads: the page says so once, after two seconds in view
    { const w = await win(name); const t = Date.now(); await w.page.goto(`${base}/buy`, { waitUntil: 'load' }); const loaded = Date.now() - t; await sleep(1500); const early = w.said.length; await sleep(3000);
      r.reading = { saidBefore2s: early, said: w.said.length, afterLoadMs: w.said[0] ? w.said[0].at - t - loaded : null, door: w.said[0]?.p, site: w.said[0]?.site, errors: w.errs }; await w.close(); }
    // 3 · a person's browser opens a page and presses a key at once: no need to wait
    { const w = await win(name); const t = Date.now(); await w.page.goto(`${base}/brain`, { waitUntil: 'load' }); const loaded = Date.now() - t; await w.page.keyboard.press('Tab'); await sleep(700);
      r.key = { said: w.said.length, afterLoadMs: w.said[0] ? w.said[0].at - t - loaded : null, door: w.said[0]?.p }; await sleep(2600); r.key.saidInAll = w.said.length; await w.close(); }
    // 4 · or turns the wheel
    { const w = await win(name); const t = Date.now(); await w.page.goto(`${base}/privacy`, { waitUntil: 'load' }); const loaded = Date.now() - t; await w.page.mouse.move(400, 300); await w.page.mouse.wheel(0, 240); await sleep(700);
      r.wheel = { said: w.said.length, afterLoadMs: w.said[0] ? w.said[0].at - t - loaded : null, door: w.said[0]?.p }; await w.close(); }
    // 5 · a tab opened in the background says nothing until it is looked at
    { const w = await win(name, { hidden: true }); await w.page.goto(`${base}/`, { waitUntil: 'load' }); await sleep(3000); const whileHidden = w.said.length;
      await w.page.evaluate(() => { window.__vis = 'visible'; document.dispatchEvent(new Event('visibilitychange')); }); await sleep(900); const soon = w.said.length; await sleep(1800);
      r.background = { whileHidden, justAfterLooking: soon, said: w.said.length, door: w.said[0]?.p, errors: w.errs }; await w.close(); }
    await sleep(600);
    const mid = await census(); r.people = mid.people - before.people;
  } catch (e) { r.failed = String(e.message).split('\n')[0].slice(0, 200); }
  report.push(r);
}
// the pages that were opened and never shown (one per engine, by the driven browser) wait on the node; after its wait
// the next caller makes it count them: as scripts
console.error(`waiting ${wait + 2} s for the node to count the pages nobody was shown`);
await sleep((wait + 2) * 1000); await census(); await sleep(400);
const end = await census();
console.log(JSON.stringify({ node: base, engines: report, people: end.people - first.people, scriptsAfterTheWait: end.tools - first.tools, expected: { people: 4 * report.filter((r) => !r.namesDriver).length, scripts: report.filter((r) => r.driven).length + 4 * report.filter((r) => r.namesDriver).length } }, null, 1));
