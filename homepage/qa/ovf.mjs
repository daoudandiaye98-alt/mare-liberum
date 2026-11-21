// which elements reach past the right edge (JS off, web fonts unavailable)
import { chromium } from 'playwright-core';
const a = Object.fromEntries(process.argv.slice(2).map((s) => { const [k, ...v] = s.replace(/^--/, '').split('='); return [k, v.join('=') || '1']; }));
const [w, h] = (a.vp || '390x844').split('x').map(Number);
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: w, height: h }, javaScriptEnabled: !a.nojs });
const p = await ctx.newPage();
if (a.nofonts) await p.route(/\.woff2(\?|$)/, (r) => r.abort());
await p.goto(a.url, { waitUntil: 'load' }); await p.waitForTimeout(600);
const cdp = await ctx.newCDPSession(p);
const r = await cdp.send('Runtime.evaluate', { returnByValue: true, expression: `(() => { const cw = document.documentElement.clientWidth, out = []; for (const el of document.querySelectorAll('body *')) { const r = el.getBoundingClientRect(); if (r.width && (r.right > cw + 0.5 || r.left < -0.5)) { const cs = getComputedStyle(el); if (cs.position === 'fixed' && cs.visibility === 'hidden') continue; out.push(el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + '.' + String(el.className).split(' ')[0] + ' ' + Math.round(r.left) + '..' + Math.round(r.right) + ' font:' + cs.fontFamily.slice(0, 22)); } } return { cw, sw: document.documentElement.scrollWidth, fonts: [...document.fonts].filter((f) => f.status === 'loaded').length, out: out.slice(0, 14) }; })()` });
console.log(JSON.stringify(r.result.value, null, 1));
await b.close();
