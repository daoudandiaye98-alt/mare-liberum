// axe-core on the page: at the top, with the menu open and after a tool answered. Violations and "needs review", by rule.
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
const a = Object.fromEntries(process.argv.slice(2).map((s) => { const [k, ...v] = s.replace(/^--/, '').split('='); return [k, v.join('=') || '1']; }));
const axe = readFileSync('node_modules/axe-core/axe.min.js', 'utf8');
const [w, h] = (a.vp || '390x844').split('x').map(Number);
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', proxy: /^https:/.test(a.url || '') && process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: w < 800, isMobile: w < 800 });
const p = await ctx.newPage();
await ctx.addInitScript(() => { window.__ML = { noGovern: true, soft: true, strict: true, q: 0.5, soft: true }; });
if (a.css) await ctx.addInitScript((css) => { addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); }); }, a.css);
await p.goto(a.url, { waitUntil: 'load' }); await p.waitForTimeout(3500);
await p.evaluate(axe);
const run = async (label) => {
  const r = await p.evaluate(async () => { const r = await axe.run(document, { resultTypes: ['violations', 'incomplete'] }); const f = (x) => x.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, first: v.nodes.slice(0, 3).map((n) => n.target.join(' ').slice(0, 70) + ' :: ' + (n.any[0]?.message || n.all[0]?.message || n.none[0]?.message || '').slice(0, 130)) })); return { violations: f(r.violations), incomplete: f(r.incomplete), passes: r.passes.length }; });
  console.log(`--- ${label}: ${r.violations.length} violations, ${r.incomplete.length} need review, ${r.passes} rules pass`);
  for (const v of r.violations) { console.log(`  VIOLATION ${v.id} (${v.impact}) × ${v.n}`); for (const f of v.first) console.log('     ' + f); }
  for (const v of r.incomplete) { console.log(`  review    ${v.id} × ${v.n}`); if (a.verbose) for (const f of v.first) console.log('     ' + f); }
};
await run('top of the page');
await p.click('.planb'); await p.waitForTimeout(500); await run('menu open');
await p.keyboard.press('Escape'); await p.waitForTimeout(300);
await p.evaluate(() => { document.querySelector('#cq').value = 'wikipedia.org'; document.querySelector('#checkf').requestSubmit(); document.querySelector('#q').value = 'running shoes'; document.querySelector('#askf').requestSubmit(); }); await p.waitForTimeout(2500);
await run('after the tools answered');
await b.close();
