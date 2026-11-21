// The lockup in every engine and size: the fitted width axis, both lines' widths, and whether the fallback scaling was needed.
import { webkit, firefox, chromium } from 'playwright-core';
const url = process.argv[2]; const E = { webkit, firefox, chromium };
for (const name of ['chromium', 'webkit', 'firefox']) {
  const b = await E[name].launch(name === 'chromium' ? { executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  for (const [w, h] of [[320, 568], [390, 844], [768, 1024], [1440, 900], [1920, 1080]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } }); const p = await ctx.newPage();
    await ctx.addInitScript(() => { window.__ML = { noGovern: true, soft: true }; });
    await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(2500);
    const r = await p.evaluate(() => { const m = document.querySelector('.mark'), a = document.querySelector('.ml-a .l1').getBoundingClientRect(), b = document.querySelector('.ml-a .l2').getBoundingClientRect(); return { w2s: m.style.getPropertyValue('--w2s'), l2k: m.style.getPropertyValue('--l2k'), fs: document.querySelector('#top').style.getPropertyValue('--fs'), l1: +a.width.toFixed(2), l2: +b.width.toFixed(2), h1: +a.height.toFixed(1), h2: +b.height.toFixed(1) }; });
    console.log(name.padEnd(9), `${w}x${h}`.padEnd(10), JSON.stringify(r), Math.abs(r.l1 - r.l2) <= 0.6 ? 'ok' : 'MISMATCH');
    await ctx.close();
  }
  await b.close();
}
