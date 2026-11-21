// Measures: overflow, touch targets, small text, the fonts that loaded. Prints numbers and places, no ticks.
//   node qa/probe.mjs --url=… --vp=390x844
import { chromium } from 'playwright-core';
const a = Object.fromEntries(process.argv.slice(2).map((s) => { const [k, ...v] = s.replace(/^--/, '').split('='); return [k, v.join('=') || '1']; }));
const [w, h] = (a.vp || '390x844').split('x').map(Number);
// a page on the open web is reached through the session's proxy
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', proxy: /^https:/.test(a.url || '') && process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: w < 800, isMobile: w < 800 });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => { window.__ML = { noGovern: true, soft: true, strict: true }; });
await p.goto(a.url, { waitUntil: 'load' }); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(900);
if (a.open) for (const sel of a.open.split(',')) { await p.click(sel).catch(() => {}); await p.waitForTimeout(300); }
const r = await p.evaluate(() => {
  const cw = document.documentElement.clientWidth, out = { cw, sw: document.documentElement.scrollWidth, docH: document.documentElement.scrollHeight, overflow: [], small: [], targets: [], fonts: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family + ' ' + f.style).join(' | ') };
  const name = (e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : '');
  for (const e of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (e.closest('[popover]:not(:popover-open)')) continue;
    const r = e.getBoundingClientRect(); if (!r.width && !r.height) continue;
    if ((r.right > cw + 0.5 || r.left < -0.5) && cs.position !== 'fixed' && !e.closest('.sr') && e.id !== 'sea') out.overflow.push(`${name(e)} L${r.left.toFixed(0)} R${r.right.toFixed(0)}`);
    if (e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) { const fs = parseFloat(cs.fontSize); if (fs < 12.4 && !e.closest('.sr')) out.small.push(`${name(e)} ${fs}px "${e.textContent.trim().slice(0, 24)}"`); }
    if (e.matches('a,button,input,[tabindex="0"]') && !e.closest('.sr') && !e.classList.contains('skip')) { const inline = e.matches('a') && cs.display === 'inline'; if (!inline && (r.height < 43.5 || r.width < 43.5)) out.targets.push(`${name(e)} ${r.width.toFixed(0)}x${r.height.toFixed(0)} "${(e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 22)}"`); }
  }
  out.inlineLinks = [...document.querySelectorAll('a')].filter((e) => getComputedStyle(e).display === 'inline' && !e.closest('[popover]')).length;
  return out;
});
console.log(JSON.stringify({ vp: `${w}x${h}`, ...r, overflow: r.overflow.slice(0, 14), small: r.small.slice(0, 12), targets: r.targets.slice(0, 30), errors: errs }, null, 1));
await b.close();
