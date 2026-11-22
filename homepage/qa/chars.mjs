// Which characters does the page set in which typeface? Walks every text node (after the tools have answered and the menu
// has been opened), honours text-transform, and prints the set per family: the list a font subset must contain.
import { chromium } from 'playwright-core';
import { proofUA } from './_browser.mjs';
const url = process.argv[2];
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ userAgent: proofUA(b),  viewport: { width: 1440, height: 900 } })).newPage();
await p.addInitScript(() => { window.__ML = { noGovern: true, soft: true, time: 4 }; });
await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(2500);
try { await p.fill('#cq', 'wikipedia.org'); await p.press('#cq', 'Enter'); await p.waitForTimeout(2500); await p.fill('#aq', 'running shoes'); await p.press('#aq', 'Enter'); await p.waitForTimeout(2500); } catch {}
const out = await p.evaluate(() => {
  const sets = {};
  const add = (fam, txt, tt) => { const f = fam.split(',')[0].replace(/["']/g, '').trim(); let t = txt; if (tt === 'uppercase') t = t.toUpperCase(); else if (tt === 'lowercase') t = t.toLowerCase(); else if (tt === 'capitalize') t = t + t.toUpperCase(); (sets[f] ||= new Set()); for (const ch of t) sets[f].add(ch); };
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) { const el = n.parentElement; if (!el || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName)) continue; const cs = getComputedStyle(el); add(cs.fontFamily, n.nodeValue, cs.textTransform); }
  for (const el of document.querySelectorAll('*')) for (const pe of ['::before', '::after']) { const cs = getComputedStyle(el, pe); const c = cs.content; if (c && c !== 'none' && c !== 'normal' && /^["']/.test(c)) add(cs.fontFamily, c.slice(1, -1), cs.textTransform); }
  for (const el of document.querySelectorAll('input[placeholder]')) add(getComputedStyle(el).fontFamily, el.placeholder, 'none');
  const res = {}; for (const [f, s] of Object.entries(sets)) res[f] = [...s].filter((c) => c > ' ').sort().join('');
  return res;
});
for (const [f, s] of Object.entries(out)) console.log(f.padEnd(14), String(s.length).padStart(4), s);
await b.close();
