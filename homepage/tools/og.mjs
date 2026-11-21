// The pictures a link to the sea shows when it is shared (1200 × 630): site/og.png and site/og-check.png.
// Nothing is painted by hand. The page's own preview build is loaded, arranged with a few lines of CSS so that the
// waterline runs through the name, photographed at twice the size and brought down to 1200 × 630 by the browser.
//   node homepage/build.mjs && node homepage/tools/og.mjs          writes both pictures
//   node homepage/tools/og.mjs --only=og --out=/tmp/try.png    one picture somewhere else, to look at first
// Options: --time (the moment of the sea, default 7.5), --cut (how far down the name the waterline stands, 0 to 1).
// Needs playwright-core and a Chrome (CHROME=/path/to/chrome). On a machine without a graphics chip the shader is
// drawn by the processor, which is slow and fine for a still.
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const a = Object.fromEntries(process.argv.slice(2).map((s) => { const [k, ...v] = s.replace(/^--/, '').split('='); return [k, v.join('=') || '1']; }));
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const PAGE = a.url || 'file://' + here('../dist/preview/index.html');
const PICTURES = [
  { name: 'og', out: here('../../site/og.png'), line: 'The internet of AI agents, live.', sub: 'mareliberum.dev', size: 58 },
  { name: 'og-check', out: here('../../site/og-check.png'), line: 'How do AI agents see your website?', sub: 'mareliberum.dev/check', size: 50 },
].filter((x) => !a.only || a.only === x.name);
const time = Number(a.time || 7.5), cutAt = Number(a.cut || 0.66);

const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const pic of PICTURES) {
  const ctx = await b.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2, reducedMotion: 'no-preference' });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  // the page's own hook for pictures and tests: the shader also on a software renderer, a fixed moment, full size
  await p.addInitScript((t) => { window.__ML = { noGovern: true, soft: true, strict: true, time: t, q: 1 }; }, time);
  await p.goto(PAGE, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.addStyleTag({ content: `
    html{--top:84px!important;--u:5.2px!important;scroll-behavior:auto!important}
    html,#top{--fs:195px!important}
    .hdr,.dock,.cue,.ruler,.say,.skip{display:none!important}
    .stage{padding-left:84px!important;padding-right:84px!important}
    .zone,footer{visibility:hidden!important}
    *,*::before,*::after{animation:none!important;transition:none!important}
    #og{position:fixed;z-index:30;left:86px;right:84px;bottom:58px;display:flex;align-items:baseline;justify-content:space-between;gap:40px;color:#eef6fb}
    #og .l{font:italic 500 ${pic.size}px/1.02 "EB Garamond",Georgia,serif;letter-spacing:-.012em}
    #og .s{font:600 25px/1 "Public Sans",system-ui,sans-serif;color:#b4cbdc;letter-spacing:.005em;white-space:nowrap}
  ` });
  await p.evaluate(([l, s]) => { const d = document.createElement('div'); d.id = 'og'; d.innerHTML = '<span class="l"></span><span class="s"></span>'; d.children[0].textContent = l; d.children[1].textContent = s; document.body.appendChild(d); window.dispatchEvent(new Event('resize')); }, [pic.line, pic.sub]);
  await p.waitForTimeout(700);
  // scroll until the waterline stands at the wanted height of the name
  const y = await p.evaluate((k) => { const m = document.querySelector('.ml-a').getBoundingClientRect(), wl = document.querySelector('#mk-wl').getBoundingClientRect().top + scrollY; return Math.max(0, Math.round(wl - (m.top + m.height * k))); }, cutAt);
  await p.evaluate((yy) => scrollTo(0, yy), y); await p.waitForTimeout(900);
  const info = await p.evaluate(() => { const m = document.querySelector('.ml-a').getBoundingClientRect(); return { cls: document.documentElement.className, mark: [Math.round(m.left), Math.round(m.top), Math.round(m.width), Math.round(m.height)], waterline: Math.round(document.querySelector('#mk-wl').getBoundingClientRect().top) }; });
  const big = await p.screenshot({ type: 'png' });
  // down to 1200 × 630: every pixel of the picture is the mean of four of the photograph
  const q = await ctx.newPage();
  const small = await q.evaluate(async (b64) => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const c = document.createElement('canvas'); c.width = 1200; c.height = 630; const x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, 1200, 630); return c.toDataURL('image/png').split(',')[1]; }, big.toString('base64'));
  const out = a.out || pic.out; writeFileSync(out, Buffer.from(small, 'base64'));
  console.log(JSON.stringify({ picture: pic.name, out, bytes: Buffer.from(small, 'base64').length, ...info, errors: errs.length ? errs : 'none' }));
  await ctx.close();
}
await b.close();
