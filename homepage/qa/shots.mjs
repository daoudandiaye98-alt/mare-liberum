// To look at: loads the page at one screen size, stops at the given depths, collects errors, writes screenshots.
//   node qa/shots.mjs --url=… --vp=390x844 --at=0,0.2,0.5,1 --out=qa/out --tag=m   (also --px, --sel="#map@-40", --time, --reduce, --nojs)
import { chromium } from 'playwright-core';
import { proofUA } from './_browser.mjs';
import { mkdirSync } from 'node:fs';
const a = Object.fromEntries(process.argv.slice(2).map((s) => { const [k, ...v] = s.replace(/^--/, '').split('='); return [k, v.join('=') || '1']; }));
const [w, h] = (a.vp || '390x844').split('x').map(Number);
const out = a.out || 'qa/out'; mkdirSync(out, { recursive: true });
// a page on the open web is reached through the session's proxy
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', proxy: /^https:/.test(a.url || '') && process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await b.newContext({ userAgent: proofUA(b),  viewport: { width: w, height: h }, deviceScaleFactor: Number(a.dpr || 2), reducedMotion: a.reduce ? 'reduce' : 'no-preference', hasTouch: w < 800, isMobile: w < 800, javaScriptEnabled: !a.nojs });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GL Driver Message/.test(m.text())) errs.push(m.type() + ': ' + m.text()); });
p.on('requestfailed', (r) => errs.push('request: ' + r.url().slice(0, 120) + ' ' + (r.failure()?.errorText || '')));
await p.addInitScript((t) => { window.__ML = { noGovern: true, soft: true, strict: true, time: t }; }, a.time != null ? Number(a.time) : undefined);
await p.goto(a.url, { waitUntil: 'load' });
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(Number(a.wait || 900));
const info = await p.evaluate(() => ({ H: document.documentElement.scrollHeight, vh: innerHeight, gl: document.documentElement.classList.contains('gl'), cls: document.documentElement.className, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
let stops = a.px ? a.px.split(',').map(Number) : a.sel ? [] : (a.at || '0').split(',').map((f) => Math.round(Number(f) * (info.H - info.vh)));
if (a.sel) for (const q of a.sel.split(',')) { const [sel, off] = q.split('@'); stops.push(await p.evaluate(([s, o]) => Math.max(0, Math.round(document.querySelector(s).getBoundingClientRect().top + scrollY + o)), [sel, Number(off || 0)])); }
const tag = a.tag || `${w}x${h}`;
for (const y of stops) {
  await p.evaluate((yy) => scrollTo(0, yy), y);
  await p.waitForTimeout(Number(a.settle || 700));
  await p.screenshot({ path: `${out}/${tag}-${String(y).padStart(5, '0')}.png` });
}
console.log(JSON.stringify({ tag, ...info, stops, errors: errs.length ? errs : 'none' }));
await b.close();
