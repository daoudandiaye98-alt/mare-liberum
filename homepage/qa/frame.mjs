// The preview the way a host of artifacts runs it: in a sandboxed iframe (a foreign, opaque origin: localStorage
// throws, the clipboard is refused) and under a strict Content-Security-Policy. Prints numbers and places, no ticks.
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFileSync, mkdirSync } from 'node:fs';
const a = Object.fromEntries(process.argv.slice(2).map((s) => { const [k, ...v] = s.replace(/^--/, '').split('='); return [k, v.join('=') || '1']; }));
const out = a.out || 'qa/frame'; mkdirSync(out, { recursive: true });
const html = readFileSync(a.file || 'dist/preview/index.html');
const CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  "font-src data: https://fonts.gstatic.com",
  "img-src data: blob:", "media-src data: blob:", "connect-src 'self'", "worker-src blob:", "form-action 'none'", "base-uri 'none'",
].join('; ');
const BAR = Number(a.bar || 0);
const outer = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>host</title>
<style>html,body{margin:0;height:100%;background:#111;overflow:hidden}#bar{height:${BAR}px;background:#222}iframe{display:block;border:0;width:100%;height:calc(100% - ${BAR}px)}</style>
<div id="bar"></div><iframe id="f" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms" src="/page"></iframe>`;
const srv = createServer((req, res) => {
  if (req.url.startsWith('/page')) { res.writeHead(200, a.nocsp ? { 'content-type': 'text/html; charset=utf-8' } : { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': CSP }); return res.end(html); }
  if (req.url === '/' || req.url.startsWith('/outer')) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(outer); }
  res.writeHead(404); res.end();
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;
const [w, h] = (a.vp || '390x844').split('x').map(Number);
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
// DPR 1: at DPR 2 Playwright miscalculates the hit coordinates inside a foreign (out-of-process) frame, a fault of the tool, not of the page
const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: Number(a.dpr || 1), hasTouch: w < 800, isMobile: w < 800 });
const p = await ctx.newPage(); const errs = [], blocked = [];
p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
p.on('console', (m) => { const t = m.text(); if (/Content Security Policy|Refused to/i.test(t)) blocked.push(t.slice(0, 220)); else if (m.type() === 'error' && !/GL Driver/.test(t)) errs.push('console: ' + t.slice(0, 220)); });
p.on('response', (r) => { if (r.status() >= 400) errs.push(`http ${r.status()} ${new URL(r.url()).pathname}`); });
p.on('requestfailed', (r) => blocked.push('requestfailed: ' + r.url().slice(0, 120) + ' ' + (r.failure()?.errorText || '')));
await ctx.addInitScript(() => { window.__ML = { noGovern: true, soft: true, strict: true, q: 0.5 }; });
await p.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
const f = p.frames().find((x) => x.url().includes('/page'));
await f.evaluate(() => document.fonts.ready); await p.waitForTimeout(3200);
const log = {};
log.env = await f.evaluate(() => { let ls = 'ok'; try { localStorage.getItem('x'); } catch (e) { ls = 'throws ' + e.name; } return { origin: String(location.origin), localStorage: ls, cls: document.documentElement.className, inner: `${innerWidth}x${innerHeight}`, docH: document.documentElement.scrollHeight, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, fonts: [...document.fonts].filter((x) => x.status === 'loaded').map((x) => x.family).join(' | '), tag: document.querySelector('#mytag')?.textContent.length, gl: !!document.querySelector('#sea') && document.documentElement.classList.contains('gl') }; });
await p.screenshot({ path: `${out}/${a.tag || 'frame'}-0.png` });
// scrolling inside the frame: does the page move, does the depth count?
await f.evaluate(() => window.scrollTo(0, 900)); await p.waitForTimeout(1400);
log.scroll1 = await f.evaluate(() => ({ y: Math.round(scrollY), depth: document.querySelector('.dock-depth')?.textContent.trim().replace(/\s+/g, ' '), cls: document.documentElement.className }));
await p.screenshot({ path: `${out}/${a.tag || 'frame'}-1.png` });
// open the menu and jump to a zone
await f.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(900);
await f.evaluate(() => { window.__ev = []; for (const t of ['pointerdown', 'click', 'toggle', 'beforetoggle']) document.addEventListener(t, (e) => window.__ev.push(t + ':' + (e.target.id || (typeof e.target.className === 'string' ? e.target.className : e.target.tagName)) + (e.newState ? '→' + e.newState : '') + '@' + Math.round(e.clientX ?? -1) + ',' + Math.round(e.clientY ?? -1)), true); });
await f.click('.planb'); await p.waitForTimeout(500);
log.menuEvents = await f.evaluate(() => window.__ev);
log.menu = await f.evaluate(() => { const m = document.querySelector('#plan'); let open = false; try { open = m.matches(':popover-open'); } catch {} return { open: open || m.classList.contains('open'), links: m.querySelectorAll('a').length }; });
await p.screenshot({ path: `${out}/${a.tag || 'frame'}-2.png` });
try { await f.click('#plan a[href="#check"]', { timeout: 4000 }); } catch (e) { log.routeClick = 'FAILED: ' + e.message.split('\n')[0]; await f.evaluate(() => document.querySelector('#plan a[href="#check"]').click()); } await p.waitForTimeout(2600);
log.route = await f.evaluate(() => ({ y: Math.round(scrollY), hash: location.hash, top: Math.round(document.querySelector('#check').getBoundingClientRect().top), menuStillOpen: (() => { try { return document.querySelector('#plan').matches(':popover-open'); } catch { return false; } })() }));
// a tool: check a website (an example), then copy (refused inside the frame: does the page fall back cleanly?)
await f.evaluate(() => { document.querySelector('#cq').value = 'wikipedia.org'; document.querySelector('#checkf').requestSubmit(); }); await p.waitForTimeout(1600);
log.check = await f.evaluate(() => ({ score: document.querySelector('#checkr .dial b')?.textContent, parts: document.querySelectorAll('#checkr .checks li').length, stillHere: location.pathname }));
await f.evaluate(() => document.querySelector('#checkr')?.scrollIntoView({ block: 'center' })); await p.waitForTimeout(900);
await p.screenshot({ path: `${out}/${a.tag || 'frame'}-3.png` });
await f.evaluate(() => document.querySelector('[data-copy]')?.scrollIntoView({ block: 'center' })); await p.waitForTimeout(700);
const copySel = await f.evaluate(() => (document.querySelector('[data-copy]') ? '[data-copy]' : null));
if (copySel) { await f.click(copySel); await p.waitForTimeout(400); log.copy = await f.evaluate((s) => document.querySelector(s).textContent.trim(), copySel); await p.waitForTimeout(2600); log.copyAfter = await f.evaluate((s) => document.querySelector(s).textContent.trim(), copySel); }
// ask (an example) and the finder
await f.evaluate(() => { document.querySelector('#q').value = 'running shoes'; document.querySelector('#askf').requestSubmit(); }); await p.waitForTimeout(1400);
log.ask = await f.evaluate(() => ({ paths: document.querySelectorAll('#askr .path').length, head: document.querySelector('#askr h3')?.textContent }));
await f.evaluate(() => { document.querySelector('#fq').value = 'ClaudeBot'; document.querySelector('#findf').requestSubmit(); }); await p.waitForTimeout(1400);
log.find = await f.evaluate(() => document.querySelector('#findr')?.textContent.trim().slice(0, 120));
// ganz nach unten
await f.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await p.waitForTimeout(1600);
log.end = await f.evaluate(() => ({ y: Math.round(scrollY), max: document.documentElement.scrollHeight - innerHeight, depth: document.querySelector('.dock-depth')?.textContent.trim().replace(/\s+/g, ' ') }));
await p.screenshot({ path: `${out}/${a.tag || 'frame'}-4.png` });
console.log(JSON.stringify({ vp: `${w}x${h}`, bar: BAR, ...log, blocked: blocked.length ? [...new Set(blocked)].slice(0, 12) : 'none', errors: errs.length ? [...new Set(errs)].slice(0, 12) : 'none' }, null, 1));
await b.close(); srv.close();
