// Does the menu take the reader to a section? In each engine, with and without the shader: open the menu, follow a link,
// and watch where the page is over the next seconds.
import { open } from './_browser.mjs';
const a = Object.fromEntries(process.argv.slice(2).map((s) => { const [k, ...v] = s.replace(/^--/, '').split('='); return [k, v.join('=') || '1']; }));
for (const name of (a.engines || 'chromium,firefox').split(',')) for (const soft of (a.soft || '1,0').split(',')) {
  const { ctx, page: p, close } = await open(name, a.url, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: a.reduce ? 'reduce' : 'no-preference' });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  if (soft === '1') await ctx.addInitScript(() => { window.__ML = { noGovern: true, soft: true }; });
  await p.goto(a.url, { waitUntil: 'load' }); await p.waitForTimeout(2500);
  const cls = await p.evaluate(() => document.documentElement.className);
  await p.click('.planb'); await p.waitForTimeout(400);
  await p.click(`#plan a[href="#${a.to || 'check'}"]`);
  const track = [];
  for (let i = 0; i < 8; i++) { await p.waitForTimeout(350); track.push(await p.evaluate((id) => [Math.round(scrollY), Math.round(document.getElementById(id).getBoundingClientRect().top)], a.to || 'check')); }
  console.log(JSON.stringify({ engine: name, hook: soft === '1', cls, hash: await p.evaluate(() => location.hash), track: track.map((t) => t.join('/')).join(' '), errors: errs.length ? errs : 'none' }));
  await close();
}
