// Where does the first second go? Loads the page the way a measuring tool does (no test hook, 4x slower processor),
// records a CPU profile and the long tasks, and prints the time per function of the page's script and per kind of work.
import { chromium } from 'playwright-core';
import { proofUA } from './_browser.mjs';
const a = Object.fromEntries(process.argv.slice(2).map((s) => { const [k, ...v] = s.replace(/^--/, '').split('='); return [k, v.join('=') || '1']; }));
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', proxy: /^https:/.test(a.url || '') && process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ userAgent: proofUA(b),  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(a.rate || 4) });
await p.addInitScript((force) => { if (force) window.__ML = { soft: true }; window.__long = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: true }); }, !!a.force);
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start');
await p.goto(a.url, { waitUntil: 'load' }); await p.waitForTimeout(Number(a.wait || 3000));
const { profile } = await cdp.send('Profiler.stop');
const self = new Map(); const dt = profile.timeDeltas; const byId = new Map(profile.nodes.map((n) => [n.id, n]));
profile.samples.forEach((id, i) => { const n = byId.get(id), f = n.callFrame; const key = `${f.functionName || '(anonymous)'}:${f.lineNumber + 1}`; self.set(key, (self.get(key) || 0) + (dt[i] || 0) / 1000); });
const top = [...self.entries()].filter(([k]) => !/^\((idle|program)\)/.test(k)).sort((x, y) => y[1] - x[1]).slice(0, Number(a.top || 22));
console.log('long tasks [start ms, ms]:', JSON.stringify(await p.evaluate(() => window.__long)), '| class:', await p.evaluate(() => document.documentElement.className));
for (const [k, v] of top) console.log(String(v.toFixed(1)).padStart(8), 'ms ', k);
await b.close();
