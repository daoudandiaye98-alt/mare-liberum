// The page as a machine without a graphics chip gets it: no test hook is set, so the page decides for itself.
// Expected: it finds the software renderer, leaves the shader alone and shows the CSS sea (class "nogl", no class "gl").
// Reports the classes, errors, how long the main thread was held (long tasks), and writes screenshots to look at.
// --force=1 sets the hook that makes the page draw the shader anyway, to measure what that costs on the same machine.
import { chromium } from 'playwright-core';
import { proofUA } from './_browser.mjs';
import { mkdirSync } from 'node:fs';
const a = Object.fromEntries(process.argv.slice(2).map((s) => { const [k, ...v] = s.replace(/^--/, '').split('='); return [k, v.join('=') || '1']; }));
const [w, h] = (a.vp || '390x844').split('x').map(Number);
const out = a.out || 'qa/soft'; mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', proxy: /^https:/.test(a.url || '') && process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ userAgent: proofUA(b),  viewport: { width: w, height: h }, deviceScaleFactor: w < 800 ? 2 : 1, hasTouch: w < 800, isMobile: w < 800, reducedMotion: a.reduce ? 'reduce' : 'no-preference', javaScriptEnabled: !a.nojs });
const p = await ctx.newPage(); const errs = [];
p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
p.on('console', (m) => { if (m.type() === 'error' && !/GL Driver Message/.test(m.text())) errs.push('console: ' + m.text().slice(0, 200)); });
await p.addInitScript((force) => {
  if (force) window.__ML = { soft: true };
  window.__long = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push(Math.round(e.duration)); }).observe({ type: 'longtask', buffered: true }); } catch {}
}, !!a.force);
const t0 = Date.now();
await p.goto(a.url, { waitUntil: 'load' });
await p.waitForTimeout(Number(a.wait || 5000));
const tag = a.tag || `${w}`;
const r = a.nojs ? { cls: await p.evaluate(() => document.documentElement.className).catch(() => '') } : await p.evaluate(() => {
  let by = null; try { const c = document.createElement('canvas').getContext('webgl2'); const x = c && c.getExtension('WEBGL_debug_renderer_info'); by = x ? c.getParameter(x.UNMASKED_RENDERER_WEBGL) : null; } catch {}
  const cs = (s, pe, k) => { const e = document.querySelector(s); return e ? getComputedStyle(e, pe)[k] : null; };
  return { cls: document.documentElement.className, renderer: by && String(by).slice(0, 70), seaVisible: cs('#sea', null, 'visibility'),
    sun: cs('#mk-hz', '::before', 'display'), road: cs('.band', '::after', 'display'), water: cs('.band', '::before', 'content'), wave: (cs('.under', '::after', 'clipPath') || '').slice(0, 40),
    sx: getComputedStyle(document.querySelector('#top')).getPropertyValue('--sx'), sr: getComputedStyle(document.querySelector('#top')).getPropertyValue('--sr'),
    theme: document.querySelector('meta[name="theme-color"]')?.content, root: document.documentElement.style.backgroundColor,
    long: window.__long.length, longMs: window.__long.reduce((s, v) => s + v, 0), longMax: Math.max(0, ...window.__long), sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, docH: document.documentElement.scrollHeight };
});
await p.screenshot({ path: `${out}/${tag}-0.png` });
const H = a.nojs ? 0 : r.docH - h;
if (!a.nojs) for (const f of (a.at || '0.03,0.06,0.2,0.5,1').split(',').map(Number)) { await p.evaluate((y) => scrollTo(0, y), Math.round(H * f)); await p.waitForTimeout(900); await p.screenshot({ path: `${out}/${tag}-${String(Math.round(f * 1000)).padStart(4, '0')}.png` }); }
if (!a.nojs) { r.themeEnd = await p.evaluate(() => document.querySelector('meta[name="theme-color"]')?.content); r.rootEnd = await p.evaluate(() => document.documentElement.style.backgroundColor); r.longAll = await p.evaluate(() => window.__long.reduce((s, v) => s + v, 0)); }
console.log(JSON.stringify({ tag, vp: `${w}x${h}`, ms: Date.now() - t0, ...r, errors: errs.length ? [...new Set(errs)] : 'none' }));
await b.close();
