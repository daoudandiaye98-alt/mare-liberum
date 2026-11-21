// Use: the menu, the tools, the keyboard. Clicks for real, reads the state, writes what it found.
//   node qa/act.mjs --url=… --vp=390x844 --out=qa/out/act
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const a = Object.fromEntries(process.argv.slice(2).map((s) => { const [k, ...v] = s.replace(/^--/, '').split('='); return [k, v.join('=') || '1']; }));
const [w, h] = (a.vp || '390x844').split('x').map(Number); const out = a.out || 'qa/act'; mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: w < 800, isMobile: w < 800 });
const p = await ctx.newPage(); const errs = [];
p.on('pageerror', (e) => errs.push('pageerror: ' + e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/GL Driver/.test(m.text())) errs.push('console: ' + m.text()); });
await p.addInitScript(() => { window.__ML = { noGovern: true, soft: true, strict: true, time: 4 }; });
await p.goto(a.url, { waitUntil: 'load' }); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(2800);
const log = {};
// 1 the dive plan opens, closes, routes
await p.click('.planb'); await p.waitForTimeout(400);
log.planOpen = await p.evaluate(() => document.querySelector('#plan').matches(':popover-open'));
await p.screenshot({ path: `${out}/${w}-plan.png` });
await p.click('#plan a[href="#check"]'); await p.waitForTimeout(1600);
log.planClosedAfterLink = await p.evaluate(() => !document.querySelector('#plan').matches(':popover-open'));
log.routedToCheck = await p.evaluate(() => { const r = document.querySelector('#check').getBoundingClientRect(); return Math.round(r.top); });
await p.click('.planb', { force: true }).catch(() => {}); 
// header may be hidden after scrolling down: scroll up a little to bring it back
await p.evaluate(() => scrollBy(0, -80)); await p.waitForTimeout(600);
log.headerBackOnScrollUp = await p.evaluate(() => !document.documentElement.classList.contains('down'));
if (!(await p.evaluate(() => document.querySelector('#plan').matches(':popover-open')))) await p.click('.planb');
await p.waitForTimeout(300); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
log.planClosedOnEscape = await p.evaluate(() => !document.querySelector('#plan').matches(':popover-open'));
// 2 the check: an example with a real kept answer, then a free entry
await p.click('[data-c="wikipedia.org"]'); await p.waitForTimeout(500);
log.checkScore = await p.evaluate(() => document.querySelector('#checkr .dial b')?.textContent || null);
log.checkParts = await p.evaluate(() => document.querySelectorAll('#checkr .checks li').length);
await p.evaluate(() => document.querySelector('#checkr').scrollIntoView({ block: 'start' })); await p.evaluate(() => scrollBy(0, -90)); await p.waitForTimeout(700);
await p.screenshot({ path: `${out}/${w}-check.png` });
await p.fill('#cq', 'example.org'); await p.press('#cq', 'Enter'); await p.waitForTimeout(400);
log.checkFree = await p.evaluate(() => document.querySelector('#checkr')?.textContent.trim().slice(0, 90));
// 3 the brain
await p.click('[data-q="running shoes"]'); await p.waitForTimeout(500);
log.brainPaths = await p.evaluate(() => document.querySelectorAll('#askr .path').length);
await p.evaluate(() => document.querySelector('#askf').scrollIntoView({ block: 'start' })); await p.evaluate(() => scrollBy(0, -90)); await p.waitForTimeout(700);
await p.screenshot({ path: `${out}/${w}-brain.png` });
// 4 connect: the sentence carries a tag, copy answers
log.prompt = await p.evaluate(() => document.querySelector('#prompt').textContent.slice(0, 96));
log.tag = await p.evaluate(() => document.querySelector('#mytag').textContent);
await p.evaluate(() => document.querySelector('[data-copy="prompt"]').scrollIntoView({ block: 'center' })); await p.waitForTimeout(500);
await p.click('[data-copy="prompt"]'); await p.waitForTimeout(300);
log.copyAnswer = await p.evaluate(() => document.querySelector('[data-copy="prompt"]').textContent);
await p.fill('#fq', 'ClaudeBot'); await p.press('#fq', 'Enter'); await p.waitForTimeout(300);
log.findFree = await p.evaluate(() => document.querySelector('#findr')?.textContent.trim().slice(0, 80));
// 5 keyboard: the first tab stops, each with a visible focus ring
await p.evaluate(() => { scrollTo(0, 0); document.activeElement && document.activeElement.blur(); getSelection().removeAllRanges(); }); await p.waitForTimeout(700);
await p.evaluate(() => { const s = document.createElement('span'); s.tabIndex = -1; document.body.prepend(s); s.focus(); s.remove(); });
log.tab = [];
for (let i = 0; i < 7; i++) { await p.keyboard.press('Tab'); log.tab.push(await p.evaluate(() => { const e = document.activeElement, cs = getComputedStyle(e); return `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}.${(e.className || '').toString().split(' ')[0]} "${(e.textContent || '').trim().slice(0, 18)}" outline:${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`; })); }
await p.screenshot({ path: `${out}/${w}-focus.png` });
console.log(JSON.stringify({ vp: `${w}x${h}`, ...log, errors: errs.length ? errs : 'none' }, null, 1));
await b.close();
