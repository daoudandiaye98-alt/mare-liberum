(() => {
'use strict';
const D = document, H = D.documentElement;
H.classList.add('js');
const $ = (s, r = D) => r.querySelector(s), $$ = (s, r = D) => [...r.querySelectorAll(s)];
const { fmt, esc } = R;
const LIVE = /*@LIVE*/false, B = '/*@B*/', PUBLIC = 'https://mareliberum.dev';
const EX = /*@EX*/null;
const LAND = '/*@LAND*/';
const CC = '/*@CC*/';
const FRAG = `/*@FRAG*/`;
const QA = window.__ML || {};
const mq = matchMedia('(prefers-reduced-motion: reduce)');
let still = mq.matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const RAD = Math.PI / 180;
// a small seeded generator: the school, the strands and the city look the same on every visit
const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const hex3 = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

let data = null, liveMode = false, firstAi = null;
const openedAt = Date.now();
{ const s = $('#snap'); if (s) { try { data = JSON.parse(s.textContent); } catch {} } }

/* ---------- where things are: the horizon, the waterline, each zone, the floor ---------- */
const G = { vw: 0, vh: 0, hz: 0, wl: 1, bed: 2, stops: new Float32Array(7), depth: [[0, 0], [1, 6000]], sun: [0, 0, 40], lights: new Float32Array(64), nl: 0 };
const cv = $('#sea');
const docTop = (el) => el.getBoundingClientRect().top + scrollY;
// the same two curves the shader draws (FRAG, above): the waterline and the seabed
const waveAt = (x, t) => 4.0 * Math.sin(x * 0.011 + t * 0.80) + 2.4 * Math.sin(x * 0.027 - t * 1.25 + 1.7) + 1.1 * Math.sin(x * 0.063 + t * 2.05 + 0.4);
const ridgeAt = (x) => G.bed - (38 * Math.sin(x * 0.0045 + 1.3) + 22 * Math.sin(x * 0.011 + 4.1) + 9 * Math.sin(x * 0.031 + 0.6));
function depthAt(y) { const d = G.depth; if (y <= d[0][0]) return 0; for (let i = 1; i < d.length; i++) if (y <= d[i][0]) return d[i - 1][1] + (d[i][1] - d[i - 1][1]) * (y - d[i - 1][0]) / Math.max(1, d[i][0] - d[i - 1][0]); return d[d.length - 1][1]; }
function yAt(m) { const d = G.depth; for (let i = 1; i < d.length; i++) if (m <= d[i][1]) return d[i - 1][0] + (d[i][0] - d[i - 1][0]) * (m - d[i - 1][1]) / Math.max(1, d[i][1] - d[i - 1][1]); return d[d.length - 1][0]; }

const stage = $('#top'), say = $('.say'), hdr = $('.hdr');
let w2s = null, fontsReady = false;
function fit() {
  // the lockup: LIBERUM is narrowed until it is exactly as wide as MARE, then both fill the column
  const mark = $('.mark'), l1 = $('.ml-a .l1'), l2 = $('.ml-a .l2'), pin = $('.pin');
  if (mark && l1 && l2) {
    if (w2s == null && fontsReady) {
      // The width of a line is linear in the face's width axis on either side of 100 %: two measurements give the line,
      // a few more steps catch a face that bends it. Everything is set on the name itself, so the page is not laid out
      // again for every step.
      const w1 = l1.getBoundingClientRect().width, set = (v) => mark.style.setProperty('--w2s', v.toFixed(2) + '%'), wid = () => l2.getBoundingClientRect().width;
      let x0 = 100; set(x0); let y0 = wid(), x1 = y0 > w1 ? 70 : 140; set(x1); let y1 = wid(), s = 100;
      if (y1 !== y0) {
        // the secant through the last two measurements; the nearest one wins where the line can come no closer
        // (a browser that sets every letter on a whole pixel cannot hit every width)
        let best = Math.abs(y0 - w1) < Math.abs(y1 - w1) ? [x0, Math.abs(y0 - w1)] : [x1, Math.abs(y1 - w1)];
        for (let i = 0; i < 6 && y1 !== y0 && best[1] > 0.2; i++) {
          const x = clamp(x1 + (w1 - y1) * (x1 - x0) / (y1 - y0), 50, 150); set(x); const y = wid(), e = Math.abs(y - w1);
          if (e < best[1]) best = [x, e];
          x0 = x1; y0 = y1; x1 = x; y1 = y;
        }
        s = best[0];
      }
      set(s); w2s = s.toFixed(2);
      // a face that cannot be narrowed (the fallback, when the web font does not arrive) keeps LIBERUM too long: then it is set smaller instead
      const w2 = wid(); if (w2 > w1 * 1.01) mark.style.setProperty('--l2k', (w1 / w2).toFixed(4));
    }
    const fs = parseFloat(getComputedStyle(mark).fontSize) || 100, em = l1.getBoundingClientRect().width / fs;
    if (em > 0) { const to = clamp(Math.min(pin.clientWidth / em, Math.min(innerHeight, 1100) * 0.21), 40, 400); if (Math.abs(to - fs) > 0.4) (stage || H).style.setProperty('--fs', to.toFixed(2) + 'px'); }
  }
  // the ratio fills its line, whatever the number is today
  const big = $('#big');
  if (big) { const f = parseFloat(getComputedStyle(big).fontSize), w = big.firstElementChild.getBoundingClientRect().width; if (w > 0) { const to = Math.min(f * big.clientWidth / w, Math.min(innerHeight, 1100) * 0.42, 470); if (Math.abs(to - f) > 0.6) big.style.setProperty('--bigfs', to.toFixed(1) + 'px'); } }
}

let veilC = NaN;
// The opening lines dissolve as they reach the header, so they never run under the mark and the menu button.
function veil(y) {
  if (!G.say) return;
  // fully there below the header (and wherever the lines stand before the first scroll), gone 46 px higher
  const c = y + G.say[2] - 46 - G.say[0], v = c <= -46 || c > G.say[1] + 20 ? -1e4 : Math.round(c);
  if (v === veilC) return; veilC = v;
  const m = v === -1e4 ? '' : `linear-gradient(to bottom,transparent ${v}px,#000 ${v + 46}px)`;
  say.style.webkitMaskImage = m; say.style.maskImage = m;
}
function measure() {
  G.vw = H.clientWidth; G.vh = (cv && cv.clientHeight) || innerHeight;
  G.hz = docTop($('#mk-hz')); G.wl = docTop($('#mk-wl'));
  const z = ['#readers', '#map', '#check', '#brain', '#inside'].map((s) => docTop($(s)));
  G.bed = docTop($('#connect')) - 10; G.stage = docTop($('#ratio')); G.max = Math.max(0, H.scrollHeight - innerHeight);
  G.say = say ? [docTop(say), say.offsetHeight, Math.min(docTop(say.firstElementChild || say), (hdr ? hdr.offsetHeight : 64) + 40)] : null; veilC = NaN;
  G.stops.set([G.wl, z[0], z[1], z[2], z[3], z[4], G.bed]); dirty = true; wasTint = '';
  G.depth = [[G.wl, 0], [z[1], 200], [z[2], 1000], [z[3], 4000], [z[4], 5600], [G.bed - 120, 6000]];
  const r = clamp(Math.min(G.vw, G.vh) * 0.085, 32, 96), mr = $('.mark').getBoundingClientRect();
  let sx = G.vw * 0.74;
  if (G.vw >= 900) sx = Math.min(G.vw - r - 48, Math.max(G.vw * 0.80, mr.right + r * 1.5));
  G.sun = [sx, G.hz - r * 0.30, r];
  if (!gl && stage) { stage.style.setProperty('--sx', sx.toFixed(1) + 'px'); stage.style.setProperty('--sr', r.toFixed(1) + 'px'); }
  // the ruler
  const ru = $('#ruler'); let out = '';
  const maj = new Set([0, 200, 1000, 2000, 3000, 4000, 5000, 6000]);
  const marks = [0, 50, 100, 150, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1250, 1500, 1750, 2000, 2250, 2500, 2750, 3000, 3250, 3500, 3750, 4000, 4250, 4500, 4750, 5000, 5250, 5500, 5750, 6000];
  for (const m of marks) out += `<i ${maj.has(m) ? 'class="maj" ' : ''}style="top:${yAt(m).toFixed(0)}px">${maj.has(m) ? `<b>${fmt(m)} m</b>` : ''}</i>`;
  ru.innerHTML = out;
  // the city: one tower for every resident of the sea
  const n = clamp(Number(data && data.residents) || 14, 1, 16), rand = rng(1609);
  for (let i = 0; i < n; i++) {
    const wide = G.vw > 900, u = (i + 0.5 + (rand() - 0.5) * 0.8) / n, x = G.vw * (wide ? 0.60 : 0.5) + (u - 0.5) * G.vw * (wide ? 0.56 : 0.86), mid = 1 - Math.abs(u - 0.5) * 1.5, h = 24 + rand() * 58 + mid * 70;
    G.lights.set([x, ridgeAt(x) - h, h + 6, rand()], i * 4);
  }
  G.nl = n;
}

/* ---------- the sea: one fragment shader, locked to the document ---------- */
let gl = null, prog = null, q = QA.q || 1;
const U = {};
const STOPC = new Float32Array(['#083f70', '#07365f', '#062a4d', '#051c3a', '#030f24', '#020916', '#020916'].flatMap(hex3));
function initGL() {
  if (!cv || !cv.getContext) return false;
  try { gl = cv.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' }); } catch { gl = null; }
  if (!gl) return false;
  // a machine without a graphics chip draws WebGL with its processor, and then every frame holds up the whole page:
  // there the sea stays the one the page states in CSS
  if (!QA.soft) { let by = ''; try { const x = gl.getExtension('WEBGL_debug_renderer_info'); by = x ? String(gl.getParameter(x.UNMASKED_RENDERER_WEBGL)) : ''; } catch {}
    if (/swiftshader|llvmpipe|softpipe|software|basic render/i.test(by)) { letGo(); return false; } }
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader'); return s; };
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, '#version 300 es\nin vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}'));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || 'link');
  } catch (e) { if (QA.strict) throw e; gl = null; return false; }
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  for (const n of ['uRes', 'uView', 'uScroll', 'uTime', 'uHz', 'uWl', 'uBed', 'uSun', 'uStopY', 'uStopC', 'uLight', 'uNL', 'uVel', 'uQ', 'uPtr', 'uAmp']) U[n] = gl.getUniformLocation(prog, n);
  gl.uniform3fv(U.uStopC, STOPC);
  return true;
}
// hand the context back, so that nothing is kept for a sea that is not drawn
function letGo() { try { const x = gl && gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); } catch {} gl = null; }
function sizeGL() {
  const cw = cv.clientWidth, ch = cv.clientHeight; if (!cw || !ch) return;
  let s = Math.min(devicePixelRatio || 1, 1.6) * q;
  const px = cw * ch * s * s, cap = 1.7e6; if (px > cap) s *= Math.sqrt(cap / px);
  const w = Math.max(2, Math.round(cw * s)), h = Math.max(2, Math.round(ch * s));
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; gl.viewport(0, 0, w, h); dirty = true; }
}
const lamp = { x: 0, y: 0, a: 0, t: 0 };
let born = 0, dirty = true;
function drawSea(y, time, vel) {
  if (!born) born = performance.now();
  const up = still || QA.time != null ? 1 : 1 - Math.pow(1 - clamp((performance.now() - born) / 1900, 0, 1), 3);
  gl.uniform2f(U.uRes, cv.width, cv.height); gl.uniform2f(U.uView, cv.clientWidth, cv.clientHeight);
  gl.uniform1f(U.uScroll, y); gl.uniform1f(U.uTime, time);
  gl.uniform1f(U.uHz, G.hz); gl.uniform1f(U.uWl, G.wl); gl.uniform1f(U.uBed, G.bed);
  gl.uniform3f(U.uSun, G.sun[0], G.sun[1] + (1 - up) * G.sun[2] * 1.25, G.sun[2]);
  gl.uniform1fv(U.uStopY, G.stops); gl.uniform4fv(U.uLight, G.lights); gl.uniform1i(U.uNL, G.nl);
  gl.uniform1f(U.uVel, still ? 0 : vel); gl.uniform1f(U.uQ, q);
  gl.uniform3f(U.uPtr, lamp.x, lamp.y + y, lamp.a); gl.uniform1f(U.uAmp, amp);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

/* ---------- the monument sinks: the wordmark is cut by the same wave the shader draws ---------- */
const mlA = $('.ml-a'), mlB = $('.ml-b'), cue = $('.cue');
let cutState = '', cueO = 1, amp = 1, splash = 0, lastEdge = '';
function cut(y, time) {
  if (!mlA) return;
  // far below the stage the monument is out of sight: nothing to measure, nothing to cut
  if (y > G.stage + G.vh) { lastEdge = ''; if (cutState !== 'water') { mlA.style.clipPath = 'inset(0 0 100% 0)'; mlB.style.clipPath = 'none'; mlB.style.visibility = ''; cutState = 'water'; } return; }
  const r = mlA.getBoundingClientRect(), s = G.wl - y;
  if (cue && y < G.wl) { const o = clamp((cue.getBoundingClientRect().top - r.bottom - 4) / 44, 0, 1); if (o !== cueO) { cueO = o; cue.style.opacity = o; cue.style.pointerEvents = o < 0.5 ? 'none' : ''; } }
  const st = s > r.bottom + 10 ? 'air' : s < r.top - 10 ? 'water' : 'cut';
  if (st !== 'cut') { lastEdge = ''; if (st !== cutState) { mlA.style.clipPath = st === 'air' ? 'none' : 'inset(0 0 100% 0)'; mlB.style.clipPath = st === 'air' ? 'inset(100% 0 0 0)' : 'none'; mlB.style.visibility = st === 'air' ? 'hidden' : ''; cutState = st; } return; }
  if (cutState !== 'cut') mlB.style.visibility = '';
  cutState = st;
  const n = 26, w = r.width, h = r.height; let edge = '', back = '';
  for (let i = 0; i <= n; i++) { const px = (i / n) * w, py = clamp(s + amp * waveAt(r.left + px, time) - r.top, -20, h + 20); edge += `${px.toFixed(1)}px ${py.toFixed(1)}px,`; back = `,${px.toFixed(1)}px ${py.toFixed(1)}px` + back; }
  if (edge === lastEdge) return; lastEdge = edge;
  mlB.style.clipPath = `polygon(${edge}${w + 2}px ${h + 30}px,-2px ${h + 30}px)`;
  mlA.style.clipPath = `polygon(-2px -30px,${w + 2}px -30px${back})`;
}

/* ---------- the dock: how deep the reader is ---------- */
const dm = $('#dm'), dz = $('#dz');
const ZONE = [[5990, 'The seabed'], [4000, 'The abyss'], [1000, 'Midnight zone'], [200, 'Twilight zone'], [0.5, 'Sunlight zone']];
let lastM = '', lastZ = '', wasUnder = null, wasPast = null, wasDown = false, hudY = 0, wasTint = '', wasRoot = '', tintY = -1e9;
// The browser dives too. Its bar takes the colour the sea has where the window begins, mixed by the rule the shader mixes
// its zones with; and the root, which a phone shows past either end of the page when the page is pulled, is sky above the
// water, the zone's own colour on the way down, and rock at the bottom.
const SKY = ['#dbe9f3', '#eef2f2', '#ffe5c3', '#f4e7d6', '#93c2dc'].map(hex3), ZONEC = ['#083f70', '#07365f', '#062a4d', '#051c3a', '#030f24', '#020916'];
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const hexOf = (c) => '#' + c.map((v) => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0')).join('');
function seaAt(y) {
  if (y < G.hz) { const k = y / Math.max(1, G.hz); return k < 0.79 ? mix3(SKY[0], SKY[1], k / 0.79) : mix3(SKY[1], SKY[2], (k - 0.79) / 0.21); }
  if (y < G.wl) return mix3(SKY[3], SKY[4], (y - G.hz) / Math.max(1, G.wl - G.hz));
  if (y > G.bed + 70) return [0.004, 0.02, 0.047];
  let c = [STOPC[0], STOPC[1], STOPC[2]];
  for (let i = 0; i < 6; i++) { const t = clamp((y - G.stops[i]) / Math.max(1, G.stops[i + 1] - G.stops[i]), 0, 1); c = mix3(c, [STOPC[i * 3 + 3], STOPC[i * 3 + 4], STOPC[i * 3 + 5]], t * t * (3 - 2 * t)); }
  return c;
}
let tintTag = $('meta[name="theme-color"]');
function hud(y) {
  if (Math.abs(y - tintY) >= 12 || !wasTint) {
    tintY = y; const tint = hexOf(seaAt(y + 6));
    if (tint !== wasTint) { wasTint = tint; if (!tintTag) { tintTag = D.createElement('meta'); tintTag.name = 'theme-color'; D.head.appendChild(tintTag); } tintTag.content = tint; }
    let root = '#dbe9f3'; if (y > G.wl - 40) { root = ZONEC[0]; for (let i = 1; i < 6; i++) if (y >= G.stops[i] - 40) root = ZONEC[i]; if (y > G.max - G.vh * 0.6) root = '#01050c'; }
    if (root !== wasRoot) { wasRoot = root; H.style.backgroundColor = root; }
  }
  const under = G.wl - y < 72;
  if (under !== wasUnder) { H.classList.toggle('under', under); wasUnder = under; }
  const past = y > G.stage - 150; if (past !== wasPast) { H.classList.toggle('past', past); wasPast = past; }
  if (Math.abs(y - hudY) > 6) { const down = y > hudY && under && y > 240; if (down !== wasDown) { H.classList.toggle('down', down); wasDown = down; } hudY = y; }
  const m = depthAt(y + G.vh * 0.45);
  const v = m < 200 ? Math.round(m / 5) * 5 : m < 1000 ? Math.round(m / 10) * 10 : Math.round(m / 50) * 50;
  const txt = `${fmt(v)} m`; if (txt !== lastM) dm.textContent = lastM = txt;
  let zn = 'Surface'; for (const [d, name] of ZONE) if (m >= d) { zn = name; break; }
  if (zn !== lastZ) dz.textContent = lastZ = zn;
}

/* ---------- who is down here: one fish for every so many visits, schooling ---------- */
const swarm = (() => {
  const c = $('#swarm'), wrap = $('#swarm-w');
  if (!c || !c.getContext) return { set() {}, tick() {}, size() {} };
  const x2 = c.getContext('2d'), UNITS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000], note = $('.note', wrap);
  let unit = 0;
  const ANCH = { people: [0.20, 0.085], live: [0.50, 0.19], search: [0.26, 0.295], tools: [0.72, 0.325], indexer: [0.31, 0.42], resident: [0.80, 0.455], other: [0.12, 0.535], training: [0.52, 0.765] };
  let W = 0, Hh = 0, dpr = 1, on = false, groups = [], n = 0, roles = null, key = '', drawn = false, kk = 1, lastT = 0;
  let px, py, vx, vy, gi, uu, th, sp, ux, uy;
  const ptr = { x: -1e4, y: -1e4, on: false, t: 0 };
  // How many visits one fish stands for. A school is only readable, and a phone can only move it, while every fish has
  // room: so the busier the day and the smaller the screen, the more visits one fish carries, and the caption says how many.
  function scale() {
    const all = R.ORDER.reduce((s, k) => s + (roles[k] || 0), 0), room = clamp(Math.floor(0.2 * W * Hh / 20), 500, 6000);
    let u = UNITS[UNITS.length - 1]; for (const x of UNITS) if (all / x <= room) { u = x; break; }
    if (u === unit) return; unit = u;
    if (note) note.textContent = `Every fish is ${fmt(u)} visits today. Touch the school.`;
    c.setAttribute('aria-label', `Schools of fish, one fish for every ${fmt(u)} visits today, grouped by kind of visitor. The table below has the numbers.`);
  }
  const keyOf = () => unit + ':' + R.ORDER.map((x) => Math.round((roles[x] || 0) / unit)).join(',');
  const label = (el, g) => { el.innerHTML = `${esc(R.ROLE[g.k][0])} <span class="snd">${fmt(g.v)}</span>`; };
  function build() {
    if (!roles || !W) return;
    scale(); key = keyOf();
    // every kind of visitor has its own seeded sequence, so a new count only adds or removes fish at the end of its school
    const old = groups, o = { px, py, vx, vy };
    groups = R.ORDER.filter((k) => roles[k] > 0).map((k) => ({ k, v: roles[k], count: Math.max(1, Math.round(roles[k] / unit)), col: R.ROLE[k][1], a: ANCH[k] }));
    n = groups.reduce((s, g) => s + g.count, 0);
    px = new Float32Array(n); py = new Float32Array(n); vx = new Float32Array(n); vy = new Float32Array(n); gi = new Uint8Array(n); ux = new Float32Array(n); uy = new Float32Array(n); uu = new Float32Array(n); th = new Float32Array(n); sp = new Float32Array(n);
    let i = 0;
    const per = clamp(0.20 * W * Hh / n, 19, 64); kk = Math.sqrt(per / 19);
    groups.forEach((g, gx) => {
      const rand = rng(7 + R.ORDER.indexOf(g.k) * 101), was = old.find((x) => x.k === g.k && x.W === W && x.H === Hh);
      const A = g.count * (g.k === 'training' ? per : per * 1.55);
      let rx = Math.sqrt(A / Math.PI * 1.3), ry = rx / 1.3; const cap = W * 0.46;
      if (rx > cap) { ry = A / (Math.PI * cap); rx = cap; }
      if (g.k === 'live') { rx = W * 0.36; ry = Hh * 0.016; }
      g.rx = rx; g.ry = Math.min(ry, Hh * 0.215); g.cx = g.a[0] * W; g.cy = g.a[1] * Hh; g.from = i; g.W = W; g.H = Hh;
      g.w = (g.k === 'training' ? 0.20 : g.k === 'live' ? 0.11 : 0.42) * (R.ORDER.indexOf(g.k) % 2 ? -1 : 1);
      for (let j = 0; j < g.count; j++, i++) {
        gi[i] = gx; uu[i] = Math.sqrt(rand()); th[i] = rand() * 6.2832; sp[i] = 0.55 + rand() * 0.9;
        if (was && j < was.to - was.from) { const q = was.from + j; px[i] = o.px[q]; py[i] = o.py[q]; vx[i] = o.vx[q]; vy[i] = o.vy[q]; }
        else { const a = th[i] + lastT * g.w * sp[i]; px[i] = g.cx + Math.cos(a) * uu[i] * g.rx; py[i] = g.cy + Math.sin(a) * uu[i] * g.ry; }
      }
      g.to = i;
    });
    for (const el of $$('.lab', wrap)) { const g = groups.find((x) => x.k === el.dataset.g); if (!g) { el.hidden = true; continue; } el.hidden = false; label(el, g); el.style.left = `${clamp(g.cx / W * 100, 24, 76)}%`; el.style.top = `${Math.max(14, g.cy - g.ry - (g.k === 'training' ? 20 : 24))}px`; }
    drawn = false;
  }
  function size() { const w = c.clientWidth, h = c.clientHeight; if (!w || !h) return; if (w === W && h === Hh) return; W = w; Hh = h; dpr = Math.min(devicePixelRatio || 1, 2); c.width = Math.round(W * dpr); c.height = Math.round(Hh * dpr); build(); }
  // a new count: the school is rebuilt when a fish joins or leaves it; otherwise only the numbers on its labels move
  function set(r) {
    roles = r || {}; if (!W) return;
    scale(); if (keyOf() !== key) return build();
    for (const g of groups) if (g.v !== roles[g.k]) { g.v = roles[g.k]; const el = $(`.lab[data-g="${g.k}"]`, wrap); if (el) label(el, g); }
  }
  function tick(dt, time) {
    if (!on || !n) return;
    if (still && drawn) return;
    const t = still ? 0 : time, live = ptr.on && !still, RR = 78 * kk, R2 = RR * RR; lastT = t;
    for (const g of groups) { g.dx = Math.sin(t * 0.13 + g.from) * 10; g.dy = Math.cos(t * 0.11 + g.from * 1.7) * 7; }
    for (let i = 0; i < n; i++) {
      const g = groups[gi[i]], a = th[i] + t * g.w * sp[i], br = 1 + 0.07 * Math.sin(t * 0.9 + th[i] * 3), ca = Math.cos(a), sa = Math.sin(a);
      const tx = g.cx + g.dx + ca * uu[i] * g.rx * br, ty = g.cy + g.dy + sa * uu[i] * g.ry * br;
      // heading: along the swim, or along the orbit when the fish is at rest
      let hx = -sa * g.rx * g.w, hy = ca * g.ry * g.w;
      if (still) { px[i] = tx; py[i] = ty; }
      else {
        let ax = (tx - px[i]) * 6, ay = (ty - py[i]) * 6;
        if (live) { const dx = px[i] - ptr.x, dy = py[i] - ptr.y, d2 = dx * dx + dy * dy; if (d2 < R2) { const d = Math.sqrt(d2) + 0.01, f = (1 - d / RR) * 2100; ax += dx / d * f; ay += dy / d * f; } }
        vx[i] = (vx[i] + ax * dt) * 0.88; vy[i] = (vy[i] + ay * dt) * 0.88; px[i] += vx[i] * dt; py[i] += vy[i] * dt;
        if (vx[i] * vx[i] + vy[i] * vy[i] > 900) { hx = vx[i]; hy = vy[i]; }
      }
      const hl = Math.hypot(hx, hy) || 1; ux[i] = hx / hl; uy[i] = hy / hl;
    }
    x2.setTransform(dpr, 0, 0, dpr, 0, 0); x2.clearRect(0, 0, W, Hh); x2.lineCap = 'round';
    for (const g of groups) {
      x2.globalAlpha = g.k === 'training' ? 0.9 : g.k === 'other' ? 0.72 : 1;
      x2.beginPath();
      if (g.k === 'people') { x2.fillStyle = g.col; for (let i = g.from; i < g.to; i++) { x2.moveTo(px[i] + 1.8 * kk, py[i]); x2.arc(px[i], py[i], 1.8 * kk, 0, 6.2832); } x2.fill(); continue; }
      const L = (g.k === 'live' ? 15 : g.k === 'training' ? 4.6 : 5.4) * kk;
      for (let i = g.from; i < g.to; i++) { x2.moveTo(px[i], py[i]); x2.lineTo(px[i] - ux[i] * L, py[i] - uy[i] * L); }
      x2.strokeStyle = g.col; x2.lineWidth = (g.k === 'live' ? 6 : g.k === 'training' ? 1.55 : 1.8) * Math.sqrt(kk);
      if (g.k === 'live') { x2.shadowColor = g.col; x2.shadowBlur = 18; }
      x2.stroke(); x2.shadowBlur = 0;
    }
    x2.globalAlpha = 1; drawn = true;
    if (ptr.on && performance.now() - ptr.t > 900) ptr.on = false;
  }
  const at = (e) => { const r = c.getBoundingClientRect(), p = e.touches ? e.touches[0] : e; if (!p) return; ptr.x = p.clientX - r.left; ptr.y = p.clientY - r.top; ptr.on = true; ptr.t = performance.now(); };
  c.addEventListener('pointermove', at); c.addEventListener('pointerdown', at);
  c.addEventListener('touchstart', at, { passive: true }); c.addEventListener('touchmove', at, { passive: true });
  c.addEventListener('pointerleave', () => { ptr.on = false; });
  if ('IntersectionObserver' in window) new IntersectionObserver((e) => { on = e[0].isIntersecting; if (on) { size(); drawn = false; } }, { rootMargin: '120px' }).observe(c); else on = true;
  return { set, tick, size };
})();

/* ---------- where they come from: the atlas as a sonar scope ---------- */
const globe = (() => {
  const c = $('#globe');
  if (!c || !c.getContext) return { set() {}, tick() {}, size() {} };
  const x2 = c.getContext('2d');
  // the land grid the atlas has always used: 70 rows from 80°N, 180 columns from 180°W, 2° apart
  const lp = [];
  for (let r = 0; r < 70; r++) { const lat = 80 - r * 2, skip = Math.max(1, Math.round(1 / Math.max(0.2, Math.cos(lat * RAD)))); for (let h = 0; h < 45; h++) { const v = parseInt(LAND[r * 45 + h], 16) || 0; for (let b = 0; b < 4; b++) { const col = h * 4 + b; if (v & (8 >> b) && col % skip === 0) { const la = lat * RAD, lo = (-180 + col * 2) * RAD; lp.push(Math.cos(la), Math.sin(la), Math.sin(lo), Math.cos(lo)); } } } }
  const land = new Float32Array(lp), nl = land.length / 4;
  let S = 0, dpr = 1, on = false, cells = [], grow = 0.052, core = 0.88, yaw = -66 * RAD, pitch = 24 * RAD, spin = 0, drag = null, lastSweep = 0, dirty = true, idleAt = 0;
  // one centre per country, "US40,-99;DE51,10;…": where a country lights up when the node knows the country and nothing finer
  const centre = {}; for (const s of CC.split(';')) { const m = /^([A-Z]{2})(-?\d+),(-?\d+)$/.exec(s); if (m) centre[m[1]] = [+m[2], +m[3]]; }
  const how = $('#globe-how');
  function set(d) {
    const geo = (d && d.geo) || {}, byArea = R.areas(d || {});
    // areas of about 200 km while the node gets them (behind a CDN); else every country at its centre, in one colour
    const pts = byArea ? (geo.cells || []).filter((x) => x.lat <= 84 && x.lat >= -70)
      : (geo.countries || []).map((x) => { const at = centre[x.cc]; return at ? { lat: at[0], lon: at[1], n: x.n, age: x.today ? 0 : 4 } : null; }).filter(Boolean);
    const max = Math.max(1, ...pts.map((x) => x.n));
    cells = pts.map((x) => ({ cl: Math.cos(x.lat * RAD), sl: Math.sin(x.lat * RAD), so: Math.sin(x.lon * RAD), co: Math.cos(x.lon * RAD), k: Math.sqrt(x.n / max), col: byArea ? (R.ROLE[x.role] || R.ROLE.other)[1] : '#bfe8ff', fade: Math.max(0.4, 1 - (x.age || 0) * 0.05), ping: -9 })).sort((a, b) => b.k - a.k);
    // a whole country in one point would be a floodlight: countries are drawn smaller and softer than areas
    grow = byArea ? 0.052 : 0.038; core = byArea ? 0.88 : 0.70;
    if (how) how.textContent = R.globeHow(byArea);
    c.setAttribute('aria-label', `A globe of dots. Glowing points mark the ${byArea ? 'areas' : 'countries'} where requests reached the sea. Arrow keys turn it. The lists beside it have the numbers.`);
    dirty = true;
  }
  function size() { const w = c.clientWidth; if (!w || w === S) return; S = w; dpr = Math.min(devicePixelRatio || 1, 2); c.width = c.height = Math.round(S * dpr); dirty = true; }
  function tick(dt, time) {
    if (!on || !S) return;
    if (!still && !drag) { const idle = performance.now() - idleAt > 2200; yaw += (spin + (idle ? 0.05 : 0)) * dt; spin *= 0.94; dirty = true; }
    if (!dirty) return; dirty = false;
    const cx = S / 2, cy = S / 2, Rr = S * 0.455, sy0 = Math.sin(yaw), cy0 = Math.cos(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch);
    x2.setTransform(dpr, 0, 0, dpr, 0, 0); x2.clearRect(0, 0, S, S);
    const bg = x2.createRadialGradient(cx - Rr * 0.3, cy - Rr * 0.35, Rr * 0.1, cx, cy, Rr);
    bg.addColorStop(0, 'rgba(18,58,100,.60)'); bg.addColorStop(1, 'rgba(3,15,36,.72)');
    x2.fillStyle = bg; x2.beginPath(); x2.arc(cx, cy, Rr, 0, 6.2832); x2.fill();
    x2.strokeStyle = 'rgba(238,246,251,.30)'; x2.lineWidth = 1; x2.stroke();
    x2.strokeStyle = 'rgba(238,246,251,.12)'; x2.beginPath(); x2.arc(cx, cy, Rr * 0.5, 0, 6.2832); x2.moveTo(cx - Rr, cy); x2.lineTo(cx + Rr, cy); x2.moveTo(cx, cy - Rr); x2.lineTo(cx, cy + Rr); x2.stroke();
    // land, in three shades from the limb to the centre
    const bucket = [[], [], []];
    for (let i = 0; i < nl; i++) { const o = i * 4, cl = land[o], sl = land[o + 1], sx = land[o + 2] * cy0 - land[o + 3] * sy0, cz = land[o + 3] * cy0 + land[o + 2] * sy0, x = cl * sx, z0 = cl * cz, y = sl * cp - z0 * sp, z = sl * sp + z0 * cp; if (z > 0.03) bucket[z > 0.66 ? 2 : z > 0.33 ? 1 : 0].push(cx + Rr * x, cy - Rr * y); }
    const dot = Math.max(1.1, S / 380);
    [0.30, 0.52, 0.78].forEach((al, b) => { x2.fillStyle = `rgba(160,198,224,${al})`; x2.beginPath(); const p = bucket[b]; for (let i = 0; i < p.length; i += 2) x2.rect(p[i] - dot / 2, p[i + 1] - dot / 2, dot, dot); x2.fill(); });
    // the sweep
    const sweep = still ? -1 : (time * 0.8) % 6.2832;
    if (sweep >= 0) {
      x2.save(); x2.beginPath(); x2.arc(cx, cy, Rr, 0, 6.2832); x2.clip();
      if (x2.createConicGradient) { const cg = x2.createConicGradient(sweep, cx, cy); cg.addColorStop(0, 'rgba(127,211,255,0)'); cg.addColorStop(0.80, 'rgba(127,211,255,0)'); cg.addColorStop(1, 'rgba(127,211,255,.20)'); x2.fillStyle = cg; x2.fillRect(cx - Rr, cy - Rr, Rr * 2, Rr * 2); }
      x2.strokeStyle = 'rgba(190,232,255,.55)'; x2.lineWidth = 1.2; x2.beginPath(); x2.moveTo(cx, cy); x2.lineTo(cx + Math.cos(sweep) * Rr, cy + Math.sin(sweep) * Rr); x2.stroke(); x2.restore();
    }
    // requests: an area lights up, and answers the sweep with a ping
    x2.globalCompositeOperation = 'lighter';
    for (const p of cells) {
      const sx = p.so * cy0 - p.co * sy0, cz = p.co * cy0 + p.so * sy0, x = p.cl * sx, z0 = p.cl * cz, y = p.sl * cp - z0 * sp, z = p.sl * sp + z0 * cp; if (z <= 0.03) continue;
      const X = cx + Rr * x, Y = cy - Rr * y, rr = (2.2 + p.k * S * grow) * (0.55 + 0.45 * z);
      if (sweep >= 0) { let a = Math.atan2(Y - cy, X - cx); if (a < 0) a += 6.2832; const passed = lastSweep <= sweep ? (a > lastSweep && a <= sweep) : (a > lastSweep || a <= sweep); if (passed) p.ping = time; }
      x2.globalAlpha = 0.16 * p.fade; x2.fillStyle = p.col; x2.beginPath(); x2.arc(X, Y, rr * 1.9, 0, 6.2832); x2.fill();
      x2.globalAlpha = core * p.fade; x2.beginPath(); x2.arc(X, Y, rr, 0, 6.2832); x2.fill();
      const age = time - p.ping; if (!still && age >= 0 && age < 1.5) { x2.globalAlpha = (1 - age / 1.5) * 0.7; x2.strokeStyle = p.col; x2.lineWidth = 1.2; x2.beginPath(); x2.arc(X, Y, rr + 3 + age * 24, 0, 6.2832); x2.stroke(); }
    }
    x2.globalAlpha = 1; x2.globalCompositeOperation = 'source-over'; lastSweep = sweep;
    if (!still) dirty = true;
  }
  const turn = (dx, dy) => { yaw -= dx; pitch = clamp(pitch + dy, -1.1, 1.1); dirty = true; idleAt = performance.now(); };
  c.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; try { c.setPointerCapture(e.pointerId); } catch {} idleAt = performance.now(); });
  c.addEventListener('pointermove', (e) => { if (!drag) return; const k = 1 / (S * 0.455), dx = (e.clientX - drag.x) * k, dy = (e.clientY - drag.y) * k; turn(dx, e.pointerType === 'touch' ? 0 : dy); spin = -dx * 30; drag.x = e.clientX; drag.y = e.clientY; });
  const end = () => { drag = null; idleAt = performance.now(); };
  c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
  c.addEventListener('keydown', (e) => { const k = { ArrowLeft: [-0.16, 0], ArrowRight: [0.16, 0], ArrowUp: [0, -0.12], ArrowDown: [0, 0.12] }[e.key]; if (!k) return; e.preventDefault(); turn(-k[0], k[1]); });
  if ('IntersectionObserver' in window) new IntersectionObserver((e) => { on = e[0].isIntersecting; if (on) { size(); dirty = true; } }, { rootMargin: '120px' }).observe(c); else on = true;
  return { set, tick, size };
})();

/* ---------- what they remember: one strand for every pathway ---------- */
const strands = (() => {
  const c = $('#strands');
  if (!c || !c.getContext) return { set() {}, tick() {}, size() {} };
  const x2 = c.getContext('2d');
  let W = 0, Hh = 0, dpr = 1, on = false, N = 0, S = null, lit = [], drawn = false;
  function set(b) { const n = clamp(Number(b && b.pathways) || 0, 0, 900), top = ((b && b.top) || []).slice(0, 6); if (n !== N) { N = n; const rand = rng(11); S = new Float32Array(N * 4); for (let i = 0; i < N * 4; i += 4) { S[i] = rand(); S[i + 1] = clamp(S[i] + (rand() - 0.5) * 0.46, 0, 1); S[i + 2] = rand() * 6.2832; S[i + 3] = 0.6 + rand() * 0.8; } }
    const rand = rng(23); lit = top.map((p, i) => { const a = (i + 0.5 + (rand() - 0.5) * 0.5) / Math.max(1, top.length); return { a, b: clamp(a + (rand() - 0.5) * 0.34, 0.03, 0.97), ph: rand(), s: clamp(Number(p.strength) || 0, 0, 10) / 10 }; }); drawn = false; }
  function size() { const w = c.clientWidth, h = c.clientHeight; if (!w || !h || (w === W && h === Hh)) return; W = w; Hh = h; dpr = Math.min(devicePixelRatio || 1, 2); c.width = Math.round(W * dpr); c.height = Math.round(Hh * dpr); drawn = false; }
  const pts = (a, b, ph, t) => { const mid = Hh * (0.5 + (a + b - 1) * 0.20) + Math.sin(t * 0.25 + ph) * 7, y0 = Hh * (0.04 + a * 0.92), y1 = Hh * (0.04 + b * 0.92); return [-12, y0, W * 0.34, y0 + (mid - y0) * 0.80, W * 0.66, y1 + (mid - y1) * 0.80, W + 12, y1]; };
  const bez = (p, u) => { const v = 1 - u, a = v * v * v, b = 3 * v * v * u, cc = 3 * v * u * u, d = u * u * u; return [a * p[0] + b * p[2] + cc * p[4] + d * p[6], a * p[1] + b * p[3] + cc * p[5] + d * p[7]]; };
  function tick(dt, time) {
    if (!on || !W || !S) return; if (still && drawn) return;
    const t = still ? 0 : time;
    x2.setTransform(dpr, 0, 0, dpr, 0, 0); x2.clearRect(0, 0, W, Hh);
    x2.lineWidth = 0.7; x2.strokeStyle = 'rgba(127,211,255,.115)'; x2.beginPath();
    for (let i = 0; i < N * 4; i += 4) { const p = pts(S[i], S[i + 1], S[i + 2], t * S[i + 3]); x2.moveTo(p[0], p[1]); x2.bezierCurveTo(p[2], p[3], p[4], p[5], p[6], p[7]); }
    x2.stroke();
    x2.globalCompositeOperation = 'lighter';
    for (const l of lit) {
      const p = pts(l.a, l.b, l.ph * 6.28, t), g = x2.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, `rgba(79,227,193,${0.25 + l.s * 0.5})`); g.addColorStop(1, `rgba(127,211,255,${0.25 + l.s * 0.5})`);
      x2.strokeStyle = g; x2.lineWidth = 0.9 + l.s * 2.1; x2.beginPath(); x2.moveTo(p[0], p[1]); x2.bezierCurveTo(p[2], p[3], p[4], p[5], p[6], p[7]); x2.stroke();
      if (!still) for (let k = 0; k < 5; k++) { const u = ((t * 0.11 * (0.7 + l.s * 0.6) + l.ph) % 1) - k * 0.012; if (u < 0 || u > 1) continue; const [X, Y] = bez(p, u); x2.globalAlpha = (1 - k / 5) * 0.95; x2.fillStyle = '#f4fbff'; x2.beginPath(); x2.arc(X, Y, (2.1 + l.s * 1.6) * (1 - k * 0.13), 0, 6.2832); x2.fill(); }
      x2.globalAlpha = 1;
    }
    x2.globalCompositeOperation = 'source-over'; drawn = true;
  }
  if ('IntersectionObserver' in window) new IntersectionObserver((e) => { on = e[0].isIntersecting; if (on) { size(); drawn = false; } }, { rootMargin: '120px' }).observe(c); else on = true;
  return { set, tick, size };
})();

/* ---------- numbers ---------- */
function count(el, to) {
  const from = Number(el.dataset.v || 0); el.dataset.v = to;
  if (still || !from || from === to || D.hidden) { el.textContent = fmt(to); return; }
  const t0 = performance.now(), d = 900;
  const step = (t) => { const p = Math.min(1, (t - t0) / d), e = 1 - Math.pow(1 - p, 3); el.textContent = fmt(Math.round(from + (to - from) * e)); if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
let names = null; try { names = new Intl.DisplayNames(['en'], { type: 'region' }); } catch {}
const put = (sel, html) => { const el = $(sel); if (el) el.innerHTML = html; };
let askTouched = false;
function apply(d, first) {
  data = d; const h = R.headline(d), now = liveMode ? Date.now() : 0;
  for (const el of $$('[data-k]')) { const v = h[el.dataset.k]; if (v != null) count(el, v); }
  $('#vis').textContent = h.ai === 1 ? 'visit' : 'visits';
  if (!first || liveMode) {
    $('#aiy').textContent = h.aiY ? ` · yesterday ${fmt(h.aiY)}` : '';
    $('#kick').textContent = `Live · ${fmt(h.ai)} AI visits today`;
    $('#stamp').textContent = `Counted ${R.utc(d.at)}:${String(d.at).slice(17, 19)} UTC · Atlantis day ${d.clock?.day}, hour ${d.clock?.hour} · version ${d.version}`;
    put('#roles tbody', R.rolesRows(d)); put('#clients tbody', R.clientsRows(d, 6)); put('#feed', R.feedItems(d, now, 7));
    put('#countries', R.countriesItems(d, names)); put('#cells', R.cellsItems(d)); $('#waters').hidden = !R.areas(d); $('#geo-span').textContent = R.geoSpan(d); $('#t-day').textContent = `day ${d.clock?.day ?? '–'}`; put('#webagents tbody', R.webRows(d)); put('#kinds tbody', R.kindsRows(d));
    if (!askTouched) put('#toppaths', R.topPaths(d));
    $('#t-clock').textContent = `Day ${d.clock?.day ?? '–'}`; $('#t-arena').textContent = `${fmt(d.arena?.brevets)} Brevet${d.arena?.brevets === 1 ? '' : 's'}`;
    $('#t-seals').textContent = `${fmt(d.last24h?.seals)} checks`; $('#t-buoys').textContent = `${fmt(d.buoys?.shellsThisMonth)} shells`;
  }
  swarm.set(d.roles); globe.set(d); strands.set(d.brain); since();
  queueLayout();
}
const dur = (s) => (s < 90 ? `${s} seconds` : s < 5400 ? `${Math.round(s / 60)} minutes` : `${Math.round(s / 3600)} hours`);
function since() {
  const el = $('#since'); if (!el || !data) return;
  if (liveMode && firstAi != null) { const n = Math.max(0, R.headline(data).ai - firstAi), s = Math.round((Date.now() - openedAt) / 1000); el.innerHTML = n > 0 ? `Since you arrived ${dur(s)} ago, <b>${fmt(n)}</b> more ${n === 1 ? 'visit' : 'visits'} from AI reached this address.` : 'You have just arrived. The next count comes within seconds.'; }
  else el.innerHTML = R.pace(data);
}
async function pull() {
  try {
    const r = await fetch('/live.json', { cache: 'no-store' }); if (!r.ok) throw new Error(r.status);
    const d = await r.json(); if (!d || !d.roles) throw new Error('shape');
    if (!liveMode) { liveMode = true; H.classList.add('live'); }
    if (firstAi == null) firstAi = R.headline(d).ai;
    apply(d);
  } catch { if (liveMode) $('#stamp').textContent = 'Live data is out of reach for a moment. Retrying.'; }
}

/* ---------- the three doors a person can use from here ---------- */
const copyText = async (text, btn, label) => { try { await navigator.clipboard.writeText(text); btn.textContent = 'Copied'; } catch { btn.textContent = 'Select the text and copy it'; } setTimeout(() => { btn.textContent = label; }, 2400); };
let tag = null; try { tag = localStorage.getItem('mare-tag'); } catch {}
if (!tag || !/^[a-z0-9]{6}$/.test(tag)) { const a = 'abcdefghjkmnpqrstuvwxyz23456789', r = crypto.getRandomValues(new Uint8Array(6)); tag = [...r].map((x) => a[x % a.length]).join(''); try { localStorage.setItem('mare-tag', tag); } catch {} }
const HOME = LIVE ? location.origin : PUBLIC;
$('#mytag').textContent = tag;
$('#prompt').textContent = `Before you search the web for my task, open ${HOME}/brain?tag=${tag}&q=<my task in a few words> and follow the strongest pathway it shows. Then continue with my task.`;
$('#badgecode').textContent = `[![Mare Liberum: AI visits today](${HOME}/badge.svg)](${HOME}/)`;
for (const b of $$('[data-copy]')) { const label = b.textContent; b.addEventListener('click', () => copyText($('#' + b.dataset.copy).textContent, b, label)); }
{ const SHARE = 'The internet of AI agents, live: every AI crawler, agent and assistant reaching an open place on the web, counted, mapped, open.', enc = encodeURIComponent, home = HOME + '/';
  $('#sh-x').href = `https://x.com/intent/post?text=${enc(SHARE)}&url=${enc(home)}`; $('#sh-li').href = `https://www.linkedin.com/sharing/share-offsite/?url=${enc(home)}`;
  $('#sh-bs').href = `https://bsky.app/intent/compose?text=${enc(SHARE + ' ' + home)}`; $('#sh-rd').href = `https://www.reddit.com/submit?url=${enc(home)}&title=${enc('The internet of AI agents, live: an open atlas')}`;
  $('#sh-wa').href = `https://wa.me/?text=${enc(SHARE + ' ' + home)}`;
  const sc = $('#sharecopy'); sc.addEventListener('click', () => copyText(home, sc, 'Copy link')); }

// with LIVE off (a copy of the page that stands alone) there is no sea behind it: the examples carry real answers, anything else opens on the live address
const away = (what, url) => `<p class="muted">This preview is not connected to the sea. ${what}</p><p><a class="ghost" href="${esc(url)}" rel="noopener" target="_blank">Open it on mareliberum.dev</a></p>`;
const getJson = async (url) => (await fetch(url, { headers: { accept: 'application/json' } })).json();
async function ask(qs) {
  const out = $('#askr'); if (!qs) return; askTouched = true;
  if (!LIVE) { const d = EX && EX.brain && EX.brain[qs]; out.innerHTML = d ? R.brainHtml(qs, d) + '<p class="muted small">A real answer of the brain, kept with this preview.</p>' : away('The three examples above carry real answers.', `${PUBLIC}/brain?q=${encodeURIComponent(qs)}`); queueLayout(); return; }
  out.innerHTML = '<p class="muted">Asking the brain…</p>';
  try { out.innerHTML = R.brainHtml(qs, await getJson(`/brain?format=json&q=${encodeURIComponent(qs)}`)); } catch { out.innerHTML = '<p class="muted">The brain did not answer. Try again in a moment.</p>'; }
  queueLayout();
}
async function check(site) {
  const out = $('#checkr'); if (!site) return;
  if (!LIVE) { const d = EX && EX.check && EX.check[site.toLowerCase()]; out.innerHTML = d ? R.checkHtml(d, PUBLIC) + '<p class="muted small">A real result of the check, kept with this preview.</p>' : away('The first two examples above carry real results.', `${PUBLIC}/check?site=${encodeURIComponent(site)}`); queueLayout(); return; }
  out.innerHTML = '<p class="muted">Reading the site’s robots.txt, llms.txt, home page and agent card…</p>';
  try { out.innerHTML = R.checkHtml(await getJson(`/check?format=json&site=${encodeURIComponent(site)}`), ''); } catch { out.innerHTML = '<p class="muted">The check did not answer. Try again in a moment.</p>'; }
  queueLayout();
}
async function find(qs) {
  const out = $('#findr'); if (!qs) return;
  if (!LIVE) { out.innerHTML = away('The finder needs the live sea.', `${PUBLIC}/lookup?q=${encodeURIComponent(qs)}`); queueLayout(); return; }
  out.innerHTML = '<p class="muted">Looking…</p>';
  try { out.innerHTML = R.findHtml(await getJson(`/lookup?q=${encodeURIComponent(qs)}`), Date.now(), ''); } catch { out.innerHTML = '<p class="muted">The finder did not answer. Try again in a moment.</p>'; }
  queueLayout();
}
$('#askf').addEventListener('submit', (e) => { e.preventDefault(); ask($('#q').value.trim()); });
$('#checkf').addEventListener('submit', (e) => { e.preventDefault(); check($('#cq').value.trim()); });
$('#findf').addEventListener('submit', (e) => { e.preventDefault(); find($('#fq').value.trim()); });
for (const b of $$('[data-q]')) b.addEventListener('click', () => { $('#q').value = b.dataset.q; ask(b.dataset.q); });
for (const b of $$('[data-c]')) b.addEventListener('click', () => { $('#cq').value = b.dataset.c; check(b.dataset.c); });

/* ---------- the dive plan ---------- */
{ const plan = $('#plan'), native = 'popover' in HTMLElement.prototype;
  const shut = () => { if (native) { try { plan.hidePopover(); } catch {} } else plan.classList.remove('open'); };
  if (!native) for (const b of $$('[popovertarget="plan"]')) b.addEventListener('click', () => plan.classList.toggle('open', b.getAttribute('popovertargetaction') !== 'hide' && !plan.classList.contains('open')));
  for (const a of $$('a', plan)) a.addEventListener('click', shut);
  addEventListener('keydown', (e) => { if (e.key === 'Escape') shut(); }); }

/* ---------- links inside the page ---------- */
D.addEventListener('click', (e) => {
  const a = e.target.closest && e.target.closest('a[href^="#"]'); if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
  const id = a.getAttribute('href').slice(1), to = id && D.getElementById(id); if (!to) return;
  e.preventDefault(); to.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
  try { history.replaceState(null, '', '#' + id); } catch {}
  if (!to.hasAttribute('tabindex')) to.setAttribute('tabindex', '-1'); to.focus({ preventScroll: true });
});

/* ---------- the loop ---------- */
let layoutQueued = false;
function layout() { layoutQueued = false; fit(); measure(); swarm.size(); globe.size(); strands.size(); if (gl) sizeGL(); }
function queueLayout() { if (!layoutQueued) { layoutQueued = true; requestAnimationFrame(layout); } }
let last = 0, lastY = scrollY, vel = 0, acc = 0, frames = 0, slow = 0, odd = false, moved = 0, raf = 0;
const t0 = performance.now();
function frame(now) {
  raf = requestAnimationFrame(frame);
  const raw = (now - last) / 1000, dt = clamp(raw, 0.001, 0.05); last = now;
  const y = scrollY, time = QA.time != null ? QA.time : still ? 0 : (now - t0) / 1000;
  if (y !== lastY) moved = now;
  vel += ((y - lastY) / dt - vel) * Math.min(1, dt * 9); lastY = y;
  lamp.a += ((performance.now() - lamp.t < 2600 ? 1 : 0) - lamp.a) * Math.min(1, dt * 4);
  splash += ((still ? 0 : Math.min(Math.abs(vel) / 1100, 1.5)) - splash) * Math.min(1, dt * 5); amp = gl ? 1 + splash : 1;
  // without the shader the waterline is the still one the page states in CSS, and the monument is cut by that one
  hud(y); veil(y); cut(y, gl ? time : 0);
  if (gl) {
    // the water moves slowly: while nobody scrolls or points, every second frame is enough for it
    // and for a reader who asked for stillness nothing moves at all, so the sea is drawn only when something changed
    odd = !odd; const idle = now - Math.max(moved, lamp.t);
    if (still && QA.time == null ? dirty || idle < 4600 : odd || QA.noGovern || now - t0 < 2600 || idle < 1500) { drawSea(y, time, vel); dirty = false; }
    // frames that stay slow: first the sea is drawn smaller, and if that is not enough the CSS sea stands in.
    // A gap of a second or more is a tab that was away, not a slow frame.
    if (!QA.noGovern && now - t0 > 1800 && raw < 1) { acc += raw; if (++frames >= 45 || acc > 0.8) { const avg = acc / frames;
      if (avg > 0.027 && q > 0.5) { q = avg > 0.1 ? 0.5 : Math.max(0.5, q - 0.25); sizeGL(); slow = 0; } else if (avg > 0.05) { if (++slow >= 2) dropGL(); } else slow = 0;
      acc = 0; frames = 0; } }
  }
  swarm.tick(dt, time); globe.tick(dt, time); strands.tick(dt, time);
}
function start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
function stop() { cancelAnimationFrame(raf); raf = 0; }

// Which sea the reader gets is decided before the page is laid out for the first time: the root's class changes the
// style of everything below it, and set afterwards it would have the whole page styled and laid out a second time.
// The shader's first frame is drawn in the same breath, before the browser paints, so its canvas is never shown empty.
// Whenever WebGL is not there, the CSS sea stands.
let noGL = false;
function wake() { if (noGL || !initGL()) return false; sizeGL(); drawSea(scrollY, QA.time != null ? QA.time : 0, 0); H.classList.remove('nogl'); H.classList.add('gl'); return true; }
function asCSS() { gl = null; H.classList.remove('gl'); H.classList.add('nogl'); queueLayout(); }
function dropGL() { noGL = true; letGo(); asCSS(); }
const seaGL = initGL();
H.classList.add(seaGL ? 'gl' : 'nogl');
if (data) apply(data, true);
fit(); measure();
if (seaGL) {
  sizeGL(); drawSea(scrollY, QA.time != null ? QA.time : 0, 0);
  cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); asCSS(); });
  cv.addEventListener('webglcontextrestored', () => { wake(); });
}
swarm.size(); globe.size(); strands.size();
start();
addEventListener('resize', queueLayout);
if ('ResizeObserver' in window) new ResizeObserver(queueLayout).observe($('#main'));
if (D.fonts && D.fonts.ready) D.fonts.ready.then(() => { fontsReady = true; queueLayout(); }); else fontsReady = true;
addEventListener('pointermove', (e) => { lamp.x = e.clientX; lamp.y = e.clientY; lamp.t = performance.now(); }, { passive: true });
addEventListener('touchmove', (e) => { const p = e.touches[0]; if (p) { lamp.x = p.clientX; lamp.y = p.clientY; lamp.t = performance.now(); } }, { passive: true });
mq.addEventListener('change', () => { still = mq.matches; queueLayout(); });
let timer = 0;
const poll = () => { clearInterval(timer); if (LIVE && !D.hidden) { pull(); timer = setInterval(pull, 15000); } };
D.addEventListener('visibilitychange', () => { if (D.hidden) stop(); else start(); poll(); });
poll();
if (!LIVE) setInterval(since, 30000);
})();
