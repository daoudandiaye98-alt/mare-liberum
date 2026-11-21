// The frame governor on a slow renderer: the shader is forced on (software WebGL), the governor is left alone.
// Expected: the canvas shrinks step by step; if frames stay slow at the smallest size, the page lets the shader go
// and shows the CSS sea (class "nogl"). Samples class, canvas size and frame pace over time.
import { chromium } from 'playwright-core';
const a = Object.fromEntries(process.argv.slice(2).map((s) => { const [k, ...v] = s.replace(/^--/, '').split('='); return [k, v.join('=') || '1']; }));
const [w, h] = (a.vp || '1440x900').split('x').map(Number);
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: Number(a.dpr || 1) });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => { window.__ML = { soft: true }; window.__f = []; let l = performance.now(); const t = (n) => { window.__f.push(n - l); l = n; requestAnimationFrame(t); }; requestAnimationFrame(t); });
await p.goto(a.url, { waitUntil: 'load' });
const rows = [];
for (let i = 0; i < Number(a.n || 12); i++) {
  await p.waitForTimeout(1500);
  if (a.scroll) await p.evaluate((k) => scrollTo(0, 300 + k * 400), i);
  rows.push(await p.evaluate(() => { const c = document.querySelector('#sea'), f = window.__f.splice(0); const avg = f.length ? f.reduce((s, v) => s + v, 0) / f.length : 0; return { cls: document.documentElement.className, canvas: `${c.width}x${c.height}`, frames: f.length, avgMs: +avg.toFixed(1) }; }));
}
for (const [i, r] of rows.entries()) console.log(`${((i + 1) * 1.5).toFixed(1).padStart(5)} s  ${r.cls.padEnd(16)} canvas ${r.canvas.padEnd(10)} ${String(r.frames).padStart(3)} frames, avg ${r.avgMs} ms`);
console.log('errors:', errs.length ? errs : 'none');
await b.close();
