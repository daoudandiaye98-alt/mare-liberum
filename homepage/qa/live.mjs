// The page as the node serves it: live mode, the tools, the empty state, and the count after a second poll.
//   node qa/live.mjs --url=http://localhost:8788/ --tag=node --tools=1 --out=qa/out/live
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const a = Object.fromEntries(process.argv.slice(2).map((s) => { const [k, ...v] = s.replace(/^--/, '').split('='); return [k, v.join('=') || '1']; }));
const out = a.out || 'qa/live'; mkdirSync(out, { recursive: true });
// a page on the open web is reached through the session's proxy
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', proxy: /^https:/.test(a.url || '') && process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const p = await ctx.newPage(); const errs = [], reqs = [];
p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
p.on('console', (m) => { if (m.type() === 'error' && !/GL Driver/.test(m.text())) errs.push('console: ' + m.text()); });
p.on('response', (r) => { const u = new URL(r.url()); if (u.pathname !== '/') reqs.push(`${r.status()} ${u.pathname}${u.search.slice(0, 40)}`); });
await p.addInitScript(() => { window.__ML = { noGovern: true, soft: true, strict: true, q: 0.5 }; });
await p.goto(a.url, { waitUntil: 'load' }); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(3500);
const read = () => p.evaluate(() => ({ cls: document.documentElement.className, kick: document.querySelector('#kick').textContent, stamp: document.querySelector('#stamp').textContent, big: document.querySelector('#big').textContent, lead: document.querySelector('#live .lead').textContent, dock: document.querySelector('.dock-live').textContent.trim().replace(/\s+/g, ' '), roles: document.querySelectorAll('#roles tr').length, clients: document.querySelectorAll('#clients tr').length, feed: document.querySelectorAll('#feed li').length, countries: document.querySelectorAll('#countries li').length, top: document.querySelectorAll('#toppaths li').length, since: document.querySelector('#since').textContent, tiles: [...document.querySelectorAll('.tiles b')].map((x) => x.textContent).join(' | '), fonts: [...document.fonts].filter((f) => f.status === 'loaded').length, prompt: document.querySelector('#prompt').textContent.slice(34, 96) }));
const log = { first: await read() };
await p.screenshot({ path: `${out}/${a.tag || 'live'}-hero.png` });
if (a.tools) {
  await p.evaluate(() => { document.querySelector('#q').value = 'running shoes'; document.querySelector('#askf').requestSubmit(); }); await p.waitForTimeout(6000);
  log.ask = await p.evaluate(() => ({ paths: document.querySelectorAll('#askr .path').length, head: document.querySelector('#askr h3')?.textContent }));
  await p.evaluate(() => { document.querySelector('#cq').value = 'mareliberum.dev'; document.querySelector('#checkf').requestSubmit(); }); await p.waitForTimeout(9000);
  log.check = await p.evaluate(() => ({ score: document.querySelector('#checkr .dial b')?.textContent, parts: document.querySelectorAll('#checkr .checks li').length, text: document.querySelector('#checkr')?.textContent.slice(0, 60) }));
  await p.evaluate(() => { document.querySelector('#fq').value = 'ClaudeBot'; document.querySelector('#findf').requestSubmit(); }); await p.waitForTimeout(7000);
  log.find = await p.evaluate(() => document.querySelector('#findr')?.textContent.trim().slice(0, 110));
  await p.waitForTimeout(9000);
  log.afterSecondPoll = await p.evaluate(() => ({ since: document.querySelector('#since').textContent, feedFirst: document.querySelector('#feed li')?.textContent.slice(0, 60), dock: document.querySelector('.dock-live b').textContent }));
  await p.evaluate(() => document.querySelector('#swarm').scrollIntoView({ block: 'center' })); await p.waitForTimeout(1500);
  await p.screenshot({ path: `${out}/${a.tag || 'live'}-swarm.png` });
}
console.log(JSON.stringify({ url: a.url, ...log, requests: [...new Set(reqs)].slice(0, 14), errors: errs.length ? errs : 'none' }, null, 1));
await b.close();
