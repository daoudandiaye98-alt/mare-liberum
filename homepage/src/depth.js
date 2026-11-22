// Mare Liberum · what moves on the pages below the home page (the look is depth.css; node/skin.mjs dresses the pages).
// Nothing here adds words. It leads the eye once down the page: the top of a told place holds still while its scene
// moves on and says its lines; what lies below the first screen rises into place as it is reached; numbers count up to
// what the page says; a ruler at the left shows where the reader is. The sea itself moves behind the page, and scrolling
// is diving through it. Motion is the grammar here: what rises word by word is to be read now, what comes into the light
// is next, what pulses once is the reader's turn, and the last thing on a page is the way on. With motion not wanted,
// everything simply stands.
const H = document.documentElement, $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), span = (p, a, b) => clamp((p - a) / (b - a));
const main = $('#main'), top = $('.top'), stick = $('.stick'), said = $('.said'), sceneEl = $('.scene'), beats = $$('.beats li');
const story = H.classList.contains('story') && !calm && !!top && beats.length > 0;
if (story) H.classList.add('go');
const de = /^de/i.test(H.lang || '');
// words that come one after another: every word of a line gets its place in the row
function words(el) {
  let i = 0; const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), nodes = []; while (tw.nextNode()) nodes.push(tw.currentNode);
  for (const n of nodes) { if (!n.nodeValue.trim()) continue; const f = document.createDocumentFragment(); for (const part of n.nodeValue.split(/(\s+)/)) { if (!part) continue; if (/^\s+$/.test(part)) f.appendChild(document.createTextNode(' ')); else { const w = document.createElement('span'); w.className = 'w'; w.style.setProperty('--i', i++); w.textContent = part; f.appendChild(w); } } n.replaceWith(f); }
  return i;
}

/* ---------- the dive plan where the browser has no popover of its own ---------- */
const plan = $('#plan'), planb = $('.planb');
if (plan && planb && !('popover' in HTMLElement.prototype)) {
  const set = (on) => { plan.classList.toggle('open', on); planb.setAttribute('aria-expanded', String(on)); if (on) $('a', plan)?.focus(); else planb.focus(); };
  planb.addEventListener('click', () => set(!plan.classList.contains('open')));
  $('.plan-x', plan)?.addEventListener('click', () => set(false));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && plan.classList.contains('open')) set(false); });
}

/* ---------- where the reader is ---------- */
// p: how far the top of the page has been passed (0 at the surface of the page, 1 where its content begins)
let p = 0, lastY = scrollY, wasPast = null, wasDown = false, beat = -2, run = 1, vh = innerHeight, max = 1, dirty = true;
const state = { get p() { return p; }, calm, story, v: 0, px: 0, py: 0, pulse: null };
const lit = new Set();   // the lines of text now in view: each stands the brighter the nearer it is to where the eye reads
let dots = [], meter = null, hair = null, base = 0;
const ruler = { el: null, dot: null, len: 0 };
function measure() {
  vh = innerHeight; max = Math.max(1, H.scrollHeight - vh);
  run = top ? Math.max(1, story ? top.offsetHeight - vh : top.offsetHeight) : 1;
  if (ruler.el) {
    ruler.len = ruler.el.offsetHeight;
    const hs = $$('main h2'); ruler.el.querySelectorAll('i').forEach((i) => i.remove());
    for (const h of hs) { const i = document.createElement('i'); i.style.top = `${(clamp((h.getBoundingClientRect().top + scrollY - vh * 0.3) / max) * 100).toFixed(2)}%`; ruler.el.appendChild(i); }
  }
  dirty = true;
}
function frame() {
  const y = scrollY;
  const past = y > 24, down = y > lastY + 6 && y > 220 ? true : y < lastY - 6 || y < 120 ? false : wasDown;
  if (past !== wasPast) { H.classList.toggle('past', past); wasPast = past; }
  if (down !== wasDown) { H.classList.toggle('down', down); wasDown = down; }
  lastY = y;
  p = clamp(y / run);
  if (story) {
    // the name of the place gives way to what the scene says: one line at a time
    const out = span(p, 0.05, 0.19);
    said.style.opacity = (1 - out).toFixed(3); said.style.transform = out ? `translate3d(0,${(-out * 46).toFixed(1)}px,0)` : '';
    said.style.visibility = out >= 1 ? 'hidden' : '';
    const n = beats.length, b = p < 0.17 ? -1 : Math.min(n - 1, Math.floor((p - 0.17) / (0.83 / n)));
    if (b !== beat) { beats.forEach((li, i) => { li.classList.toggle('on', i === b); li.classList.toggle('off', i < b); }); dots.forEach((d, i) => d.classList.toggle('on', i <= b)); beat = b; }
  }
  // text comes into the light as it rises towards where the eye reads; at the end of the page everything is lit
  if (lit.size) { const end = clamp(1 - (max - y) / (vh * 0.32)); for (const el of lit) { const r = Math.max(end, clamp((vh * 0.95 - el.getBoundingClientRect().top) / (vh * 0.3))); if (r !== el._r) { el._r = r; el.style.setProperty('--r', r.toFixed(3)); } } }
  if (hair) hair.style.transform = `scaleX(${clamp(y / max).toFixed(4)})`;
  if (meter) { const m = Math.round(base + y / 14); if (m !== meter._m) { meter._m = m; meter.firstChild.nodeValue = `${m.toLocaleString(de ? 'de-DE' : 'en-US')} m`; } }
  if (ruler.dot) ruler.dot.style.transform = `translate3d(0,${(clamp(y / max) * ruler.len).toFixed(1)}px,0)`;
  dirty = false;
}
let ticking = false;
const ask = () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; frame(); }); } };
addEventListener('scroll', ask, { passive: true });
addEventListener('resize', () => { wide(); measure(); ask(); });

/* ---------- the ruler (wide screens): the parts of the page, and a mark for the reader ---------- */
if (main && $$('main h2').length > 1) {
  ruler.el = document.createElement('div'); ruler.el.className = 'ruler'; ruler.el.setAttribute('aria-hidden', 'true');
  ruler.dot = document.createElement('b'); ruler.el.appendChild(ruler.dot); document.body.appendChild(ruler.el);
}

/* ---------- what lies below the first screen rises into place when it is reached ---------- */
// Only what is out of sight is held back, and only by this script: a page whose script never runs shows everything.
const counts = new Map();
function countUp(el) {
  const to = counts.get(el); if (to == null) return; counts.delete(el);
  const t0 = performance.now(), dur = 900 + Math.min(600, Math.log10(to + 1) * 160);
  const step = (now) => { const k = clamp((now - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(to * e).toLocaleString('en-US'); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
if (!calm && main && 'IntersectionObserver' in window) {
  // a new part of the page: a school crosses along its heading, the way the eye should go
  const heads = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { heads.unobserve(e.target); if (scrollY > 40) state.pulse?.(e.boundingClientRect.top + e.boundingClientRect.height / 2, false); } }, { rootMargin: '0px 0px -22% 0px' });
  const io = new IntersectionObserver((es) => {
    let k = 0;
    for (const e of es) if (e.isIntersecting) {
      const el = e.target; io.unobserve(el);
      if (!el.style.getPropertyValue('--d')) el.style.setProperty('--d', `${Math.min(k++, 5) * 70}ms`);
      el.classList.add('in');
      for (const b of el.matches('b') ? [el] : el.querySelectorAll('b')) countUp(b);
    }
  }, { rootMargin: '0px 0px -7% 0px' });
  const hold = (el, d) => { if (el.getBoundingClientRect().top < innerHeight * 0.96) return false; el.classList.add('rv'); if (d != null) el.style.setProperty('--d', `${d}ms`); io.observe(el); return true; };
  const near = new IntersectionObserver((es) => { for (const e of es) { if (e.isIntersecting) lit.add(e.target); else { lit.delete(e.target); if (e.boundingClientRect.top < 0) e.target.style.setProperty('--r', '1'); } } ask(); }, { rootMargin: '10% 0px 10% 0px' });
  const read = (el) => { el.classList.add('rd'); near.observe(el); };
  for (const el of main.children) {
    if (el === top || el.tagName === 'SCRIPT' || el.tagName === 'STYLE') continue;
    if (/^(P|H3|DL|BLOCKQUOTE)$/.test(el.tagName) && !el.classList.contains('next')) { read(el); continue; }
    if (/^(UL|OL)$/.test(el.tagName) && !el.className) { for (const li of el.children) read(li); continue; }
    if (el.tagName === 'H2') { if (el.getBoundingClientRect().top >= innerHeight * 0.96) { el.classList.add('wd'); words(el); } heads.observe(el); }
    if (el.classList.contains('grid')) {
      // the boxes of a group follow one another, row by row
      let row = -1, col = 0, y0 = null;
      for (const box of el.children) { const y = box.offsetTop; if (y !== y0) { row++; col = 0; y0 = y; } hold(box, Math.min(col++, 4) * 90); }
    } else hold(el);
  }
  // a number that is held back with its part counts up to what the page says
  for (const b of $$('main .rv b, main .rv.box b').slice(0, 80)) {
    const s = b.textContent.trim(); if (!/^\d{2,3}(,\d{3})*$|^\d{2,}$/.test(s) || b.children.length) continue;
    const to = Number(s.replace(/,/g, '')); if (!(to >= 10) || to > 1e9) continue;
    const w = b.getBoundingClientRect().width; b.style.display = 'inline-block'; b.style.minWidth = `${Math.ceil(w)}px`; b.style.fontVariantNumeric = 'tabular-nums';
    counts.set(b, to); b.textContent = '0';
  }
}

/* ---------- small helps ---------- */
// a listing that says beside each line what the line gives ("GET …      what comes back") is set line by line, so that a
// narrow screen can put the remark under its line instead of breaking both anywhere; the words stay as they were written
const raw = new WeakMap();
for (const pre of $$('main pre')) {
  if (pre.children.length || pre.id) continue;
  const text = pre.textContent, lines = text.replace(/\s+$/, '').split('\n');
  if (lines.length > 40 || !lines.some((l) => /\S\s{2,}\S/.test(l))) continue;
  raw.set(pre, text); pre.textContent = ''; pre.classList.add('lines');
  for (const l of lines) {
    const ln = document.createElement('span'), lead = /^\s*/.exec(l)[0], add = (cls, s) => { const e = document.createElement('span'); e.className = cls; e.textContent = s; ln.appendChild(e); };
    ln.className = 'ln'; if (lead) add('gap', lead);
    l.slice(lead.length).split(/(\s{2,})/).forEach((s, j) => { if (s) add(j % 2 ? 'gap' : !j ? 'cmd' : /^[{["<-]/.test(s) ? 'arg' : 'rem', s); });
    if (!ln.childNodes.length) ln.textContent = ' ';
    pre.appendChild(ln);
  }
}
// a block of code can be copied in one press
if (navigator.clipboard) for (const pre of $$('main pre')) {
  if (pre.textContent.trim().length < 12) continue;
  const b = document.createElement('button'); b.type = 'button'; b.className = 'copy'; b.textContent = 'Copy';
  b.addEventListener('click', async () => { const text = raw.get(pre) ?? [...pre.childNodes].filter((n) => n !== b).map((n) => n.textContent).join(''); try { await navigator.clipboard.writeText(text.trim()); b.textContent = 'Copied'; } catch { b.textContent = 'Press Ctrl+C'; } setTimeout(() => { b.textContent = 'Copy'; }, 1600); });
  pre.appendChild(b);
}
// a table wider than its screen can be reached and pushed with the keyboard
const more = (t) => t.classList.toggle('more', !t.classList.contains('stack') && t.scrollLeft + t.clientWidth < t.scrollWidth - 4);
const narrow = matchMedia('(max-width: 760px)'), ROLE = { TABLE: 'table', THEAD: 'rowgroup', TBODY: 'rowgroup', TR: 'row', TH: 'columnheader', TD: 'cell' };
const wide = () => { for (const t of $$('.tw')) {
  t.classList.remove('stack');
  const over = t.scrollWidth > t.clientWidth + 2;
  if (over && narrow.matches && $('td[data-th]', t)) {
    // set row by row; it stays a table to those who hear the page
    t.classList.add('stack'); if (!t.dataset.r) { t.dataset.r = '1'; for (const e of $$('table,thead,tbody,tr,th,td', t)) e.setAttribute('role', ROLE[e.tagName]); }
    t.removeAttribute('tabindex'); t.removeAttribute('aria-label'); t.removeAttribute('role');
  } else if (over) { t.tabIndex = 0; t.setAttribute('role', 'region'); t.setAttribute('aria-label', 'Table, scrolls sideways'); if (!t.dataset.w) { t.dataset.w = '1'; t.addEventListener('scroll', () => more(t), { passive: true }); } }
  else { t.removeAttribute('tabindex'); t.removeAttribute('role'); t.removeAttribute('aria-label'); }
  more(t);
} };

/* ---------- the grammar of the page: what is expected of the reader, said by motion ---------- */
if (!calm && main) {
  // a told place says its lines word by word, and shows how many there are: the reader knows there is more
  if (story) { beats.forEach(words); const ol = $('.beats'), dl = document.createElement('div'); dl.className = 'dots'; dl.setAttribute('aria-hidden', 'true'); dots = beats.map(() => dl.appendChild(document.createElement('i'))); ol.after(dl); }
  // at the top: go down
  if (top && stick && H.scrollHeight > innerHeight * 1.3) { const cue = document.createElement('div'); cue.className = 'cue'; cue.setAttribute('aria-hidden', 'true'); cue.innerHTML = `<span>${de ? (story ? 'Scrollen · die Szene geht weiter' : 'Scrollen') : (story ? 'Scroll · the scene goes on' : 'Scroll')}</span><i></i>`; stick.appendChild(cue); }
  // how deep the reader is, and how far through the page
  hair = document.createElement('div'); hair.className = 'hair'; hair.setAttribute('aria-hidden', 'true'); document.body.appendChild(hair);
  const dm = /([\d.,]+)\s*m/.exec($('.depth .snd')?.textContent || ''); base = dm ? Number(dm[1].replace(/[.,]/g, '')) : 0;
  if (H.scrollHeight > innerHeight * 1.6) { meter = document.createElement('div'); meter.className = 'meter'; meter.setAttribute('aria-hidden', 'true'); meter.appendChild(document.createTextNode('')); document.body.appendChild(meter); }
  if ('IntersectionObserver' in window) {
    // a form is the reader's turn: its field asks once, its button answers the eye
    const turn = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { turn.unobserve(e.target); e.target.classList.add('turn'); const f = $('input:not([type=hidden]):not([type=checkbox]):not([type=radio]),textarea', e.target); if (f && !f.value) f.classList.add('ask'); } }, { threshold: 0.6 });
    for (const f of $$('main form')) if ($('input:not([type=hidden]):not([type=checkbox]),textarea', f)) turn.observe(f);
    const nx = $('main .next'); if (nx) { turn.observe(nx); new IntersectionObserver((es) => H.classList.toggle('end', es[0].isIntersecting || es[0].boundingClientRect.top < 0)).observe(nx); }
  }
  // a box has a body: it leans towards the hand that is over it
  if (matchMedia('(hover:hover) and (pointer:fine)').matches) for (const b of $$('.grid>.box,ol.offers>li,main .next')) {
    b.addEventListener('pointermove', (e) => { const r = b.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5; b.style.setProperty('--ry', `${(x * 7).toFixed(2)}deg`); b.style.setProperty('--rx', `${(-y * 6).toFixed(2)}deg`); b.style.setProperty('--gx', `${((x + 0.5) * 100).toFixed(1)}%`); b.style.setProperty('--gy', `${((y + 0.5) * 100).toFixed(1)}%`); });
    b.addEventListener('pointerleave', () => { b.style.removeProperty('--rx'); b.style.removeProperty('--ry'); });
  }
}

/* ---------- the sea behind the page, and the scene at the top ---------- */
if (!navigator.connection?.saveData) import('/depth-scenes.js?v=/*@V*/').then((m) => { try { m.mountSea(state); } catch {} if (sceneEl) m.mount(sceneEl, state); }).catch(() => {});

measure(); wide(); frame();
addEventListener('load', () => { measure(); wide(); ask(); });
if (document.fonts?.ready) document.fonts.ready.then(() => { measure(); ask(); });
