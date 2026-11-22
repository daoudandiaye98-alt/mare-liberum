// Contrast: for every visible text box, the contrast against the real pixels behind it (the text hidden, the scene running).
//   node qa/contrast.mjs --url=… --vp=390x844 --wait=1900
// Schwelle: 4.5:1, ab 24 px (oder 18.66 px fett) 3:1. Gibt je Selektor den schlechtesten gemessenen Wert aus.
import { chromium } from 'playwright-core';
import { proofUA } from './_browser.mjs';
import { PNG } from 'pngjs';
const a = Object.fromEntries(process.argv.slice(2).map((s) => { const [k, ...v] = s.replace(/^--/, '').split('='); return [k, v.join('=') || '1']; }));
const [w, h] = (a.vp || '390x844').split('x').map(Number);
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ userAgent: proofUA(b),  viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: w < 800, isMobile: w < 800 });
const p = await ctx.newPage();
const times = (a.times || '4,11.3').split(',').map(Number); let ti = 0;
await p.addInitScript(() => { window.__ML = { noGovern: true, soft: true, strict: true, time: 4, q: 0.5 }; });
await p.goto(a.url, { waitUntil: 'load' }); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(900);
if (a.click) for (const sel of a.click.split(',')) { await p.evaluate((s) => document.querySelector(s)?.click(), sel); await p.waitForTimeout(250); }
const H = await p.evaluate(() => document.documentElement.scrollHeight);
const lum = (r, g, bl) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(bl); };
const ratio = (x, y) => (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
const worst = new Map(); let checked = 0;
const step = Math.round(h * 0.82);
for (let y = 0; y < H; y += step) {
  await p.evaluate(([yy, t]) => { window.__ML.time = t; scrollTo(0, yy); }, [y, times[ti++ % times.length]]);
  await p.waitForTimeout(Number(a.wait || 750));
  // --hide=.a,.b: things that float over the page and would be taken for its ground
  if (a.hide) await p.addStyleTag({ content: `${a.hide}{visibility:hidden!important}` });
  const els = await p.evaluate(() => {
    const out = [], vh = innerHeight, vw = innerWidth;
    const fixed = [...document.querySelectorAll('.dock,.hdr')].map((f) => [f, f.getBoundingClientRect()]);
    const hit = (r, q) => r.left < q.right && r.right > q.left && r.top < q.bottom + 4 && r.bottom > q.top - 4;
    const name = (e) => { let n = e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/)[0] : ''); const par = e.closest('section,footer,header,.dock,.plan'); return (par ? (par.id ? '#' + par.id : par.tagName.toLowerCase() + '.' + String(par.className).split(' ')[0]) + ' ' : '') + n; };
    for (const e of document.querySelectorAll('body *')) {
      if (!e.childNodes.length || ![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      if (e.closest('.sr,.skip,script,style,[popover]:not(:popover-open)')) continue;
      const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.5) continue;
      const er = e.getBoundingClientRect(); if (er.width <= 2 && er.height <= 2) continue;
      let clipped = false; for (let q = e; q && q !== document.body; q = q.parentElement) { const cp = getComputedStyle(q).clipPath; if (cp && cp !== 'none') { clipped = true; break; } } if (clipped) continue;
      let op = 1; for (let q = e; q; q = q.parentElement) op *= Number(getComputedStyle(q).opacity); if (op < 0.5) continue;
      const m = cs.color.match(/[\d.]+/g).map(Number); if (m[3] != null && m[3] < 0.5) continue;
      for (const n of e.childNodes) { if (n.nodeType !== 3 || !n.textContent.trim()) continue; const rg = document.createRange(); rg.selectNodeContents(n);
        for (const r of rg.getClientRects()) { if (r.width < 3 || r.height < 3 || r.bottom < 2 || r.top > vh - 2 || r.right < 2 || r.left > vw - 2) continue;
          if (fixed.some(([f, q]) => !f.contains(e) && hit(r, q))) continue;
          // text clipped away by an ancestor is not on screen
          const el = document.elementFromPoint(Math.min(vw - 1, Math.max(0, r.left + r.width / 2)), Math.min(vh - 1, Math.max(0, r.top + r.height / 2)));
          if (el && !(el === e || e.contains(el) || el.contains(e))) { const zs = getComputedStyle(el); if (zs.pointerEvents !== 'none' && !el.matches('canvas')) continue; }
          out.push({ n: name(e), x: r.left, y: r.top, w: r.width, h: r.height, c: m.slice(0, 3), fs: parseFloat(cs.fontSize), fw: Number(cs.fontWeight) || 400, t: n.textContent.trim().slice(0, 26) }); } }
    }
    return out;
  });
  await p.addStyleTag({ content: '*,*::before,*::after{color:transparent!important;text-shadow:none!important;caret-color:transparent!important}::placeholder{color:transparent!important}.ml-a,.ml-b{visibility:hidden!important}.key,.dot,.meter i,.str i,.mk2{visibility:hidden!important}' }).then(async (tag) => {
    await p.waitForTimeout(340);
    const png = PNG.sync.read(await p.screenshot());
    await tag.evaluate((n) => n.remove());
    for (const e of els) {
      const ls = []; const x0 = Math.max(0, Math.floor(e.x)), x1 = Math.min(png.width - 1, Math.ceil(e.x + e.w)), y0 = Math.max(0, Math.floor(e.y)), y1 = Math.min(png.height - 1, Math.ceil(e.y + e.h));
      const sx = Math.max(1, Math.floor((x1 - x0) / 40)), sy = Math.max(1, Math.floor((y1 - y0) / 10));
      for (let yy = y0; yy <= y1; yy += sy) for (let xx = x0; xx <= x1; xx += sx) { const i = (yy * png.width + xx) * 4; ls.push(lum(png.data[i], png.data[i + 1], png.data[i + 2])); }
      if (!ls.length) continue; ls.sort((q, r) => q - r);
      const lo = ls[Math.floor(ls.length * 0.03)], hi = ls[Math.floor(ls.length * 0.97)], lt = lum(...e.c);
      const cr = lt > lo && lt < hi ? 1 : Math.min(ratio(lt, lo), ratio(lt, hi));
      const need = e.fs >= 24 || (e.fs >= 18.66 && e.fw >= 700) ? 3 : 4.5; checked++;
      const k = e.n + (need === 3 ? ' (large)' : '');
      const cur = worst.get(k); if (!cur || cr / need < cur.cr / cur.need) worst.set(k, { cr, need, at: y, t: e.t, bg: [lo.toFixed(3), hi.toFixed(3)], fg: lt.toFixed(3) });
    }
  });
}
const rows = [...worst.entries()].map(([k, v]) => ({ k, ...v })).sort((x, y) => x.cr / x.need - y.cr / y.need);
const fails = rows.filter((r) => r.cr < r.need);
console.log(JSON.stringify({ vp: `${w}x${h}`, textRectsMeasured: checked, selectors: rows.length, fails: fails.length, lowest: rows.slice(0, Number(a.show || 14)).map((r) => `${r.cr.toFixed(2)}:1 (need ${r.need}) ${r.k} @${r.at} "${r.t}" bg ${r.bg} fg ${r.fg}`) }, null, 1));
await b.close();
