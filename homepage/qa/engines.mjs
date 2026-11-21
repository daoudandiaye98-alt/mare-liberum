// The page in the other two engines: WebKit (what Safari is built on) and Firefox.
// For each engine and screen: errors, WebGL, fonts, overflow, the wordmark's two lines, the header and dock, a tool,
// and screenshots to look at. Numbers and files, no ticks.
import { open } from './_browser.mjs';
import { mkdirSync } from 'node:fs';
const a = Object.fromEntries(process.argv.slice(2).map((s) => { const [k, ...v] = s.replace(/^--/, '').split('='); return [k, v.join('=') || '1']; }));
const out = a.out || 'qa/eng'; mkdirSync(out, { recursive: true });
const url = a.url, live = /^https:/.test(url);
const want = (a.engines || 'webkit,firefox').split(',');
const screens = (a.vp || '390x844,1440x900').split(',').map((s) => s.split('x').map(Number));
const stops = (a.stops || '0,0.035,0.09,0.2,0.34,0.5,0.66,0.8,0.93,1').split(',').map(Number);
const report = [];
for (const name of want) {
  for (const [w, h] of screens) {
    const mobile = w < 800; let win;
    try { win = await open(name, url, { viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, ...(name !== 'firefox' && mobile ? { isMobile: true, hasTouch: true } : mobile ? { hasTouch: true } : {}), reducedMotion: a.reduce ? 'reduce' : 'no-preference' }); }
    catch (e) { report.push({ engine: name, vp: `${w}x${h}`, launch: 'FAILED: ' + String(e.message).split('\n').slice(0, 3).join(' | ') }); continue; }
    const { ctx, page: p, close } = win; const errs = [];
    p.on('pageerror', (e) => errs.push('pageerror: ' + String(e.message).slice(0, 200)));
    p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
    await ctx.addInitScript(() => { window.__ML = { noGovern: true, soft: true, strict: true, q: 0.5 }; });
    const r = { engine: name, vp: `${w}x${h}` };
    try {
      await p.goto(url, { waitUntil: 'load', timeout: 60000 }); await p.waitForTimeout(Number(a.wait || 3800));
      Object.assign(r, await p.evaluate(() => {
        const q = (s) => document.querySelector(s), rect = (s) => { const x = q(s)?.getBoundingClientRect(); return x ? [Math.round(x.left), Math.round(x.right), Math.round(x.top), Math.round(x.height)] : null; };
        const c = q('#sea'); let gl = null, why = null; try { const t = document.createElement('canvas'); gl = !!t.getContext('webgl2'); } catch (e) { why = String(e); }
        const cs = (s, k) => q(s) ? getComputedStyle(q(s))[k] : null;
        return { ua: navigator.userAgent.slice(0, 90), cls: document.documentElement.className, webgl2Available: gl, why, canvas: c ? `${c.width}x${c.height}` : null,
          fonts: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '')).join(', '), docH: document.documentElement.scrollHeight, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
          l1: rect('.ml-a .l1'), l2: rect('.ml-a .l2'), pin: rect('.pin'), w2s: getComputedStyle(document.documentElement).getPropertyValue('--w2s'), l2k: getComputedStyle(document.documentElement).getPropertyValue('--l2k'),
          hdr: rect('.hdr'), dock: rect('#dock'), dockBackdrop: cs('#dock', 'backdropFilter') ?? cs('#dock', 'webkitBackdropFilter'), h2stretch: cs('#h-brain', 'fontStretch'), markClip: cs('.ml-a', 'clipPath')?.slice(0, 40), popover: 'popover' in HTMLElement.prototype, big: q('#big')?.textContent.replace(/\s+/g, '') };
      }));
      const H = r.docH - h;
      for (const s of stops) { await p.evaluate((y) => window.scrollTo(0, y), Math.round(H * s)); await p.waitForTimeout(700); await p.screenshot({ path: `${out}/${name}-${w}-${String(Math.round(s * 1000)).padStart(4, '0')}.png` }); }
      // the menu and one tool
      await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(600);
      await p.click('.planb'); await p.waitForTimeout(500);
      r.menuOpen = await p.evaluate(() => { const m = document.querySelector('#plan'); try { return m.matches(':popover-open'); } catch { return m.classList.contains('open') || getComputedStyle(m).display !== 'none'; } });
      await p.screenshot({ path: `${out}/${name}-${w}-menu.png` });
      await p.click('#plan a[href="#check"]'); await p.waitForTimeout(1800);
      r.routed = await p.evaluate(() => Math.round(document.querySelector('#check').getBoundingClientRect().top));
      await p.fill('#cq', 'wikipedia.org'); await p.press('#cq', 'Enter'); await p.waitForTimeout(live ? 9000 : 1500);
      r.check = await p.evaluate(() => document.querySelector('#checkr .dial b')?.textContent || document.querySelector('#checkr')?.textContent.trim().slice(0, 60));
      r.swAfter = await p.evaluate(() => document.documentElement.scrollWidth);
    } catch (e) { r.failed = String(e.message).split('\n')[0].slice(0, 220); }
    r.errors = errs.length ? [...new Set(errs)].slice(0, 8) : 'none';
    report.push(r); await close();
  }
}
console.log(JSON.stringify(report, null, 1));
