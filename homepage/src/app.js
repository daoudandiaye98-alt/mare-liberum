// Mare Liberum · Die Reise. One scroll value t (0 at the surface, 6 at the way in) drives the whole stage: which painting
// stands, the field of particles (the tokens: they never disappear, every scene is made from the one before), the
// counter, the name cut by the waterline and the dock's ring. The words fly in by CSS scroll timelines, or by an
// IntersectionObserver where a browser has none. With motion not wanted, every scene stands still and complete.
(() => {
'use strict';
const LIVE = /*@LIVE*/false, B = '/*@B*/';
const D = document, H = D.documentElement, $ = (s) => D.querySelector(s), $$ = (s) => [...D.querySelectorAll(s)];
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const lite = !!(navigator.connection && navigator.connection.saveData);
const sda = !!(window.CSS && CSS.supports && CSS.supports('animation-timeline: view()'));
H.classList.add('js'); if (!sda) H.classList.add('io');
const fmt = (n) => (n == null || isNaN(n) ? '–' : Math.round(Number(n)).toLocaleString('en-US'));
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const smooth = (t, a, b) => ease(clamp((t - a) / (b - a)));

const secs = $$('.sc'), N = secs.length, cards = secs.map((s) => s.querySelector('.card'));
const plates = $$('.plate'), imgs = plates.map((p) => p.querySelector('img'));
const cv = $('#field'), g = cv && cv.getContext('2d');
const count = $('#count'), countN = $('#countn'), countL = $('#countl'), countQ = $('#countq'), ringF = $('#ringf'), ringN = $('#ringn');
const h1 = $('#h1'), veil = $('.veil'), heroOut = [$('#top .card'), $('#top .cue')].filter(Boolean);
let vw = 0, vh = 0, land = false, A = [0], dpr = 1, raf = 0, lastT = -1, waterY = 0, region = null;

// ---- where each scene stands: the scroll position at which its card is read (the band the words are fully shown in)
function measure() {
  vw = innerWidth; vh = innerHeight; land = vw > vh;
  A = cards.map((c, k) => { if (!k) return 0; const r = c.getBoundingClientRect(), top = r.top + scrollY; return Math.max(0, top - (land ? Math.max(0.3 * vh, 0.58 * vh - r.height / 2) : Math.max(0.45 * vh, 0.64 * vh - r.height / 2))); });
  for (let k = 1; k < N; k++) if (A[k] <= A[k - 1]) A[k] = A[k - 1] + 1;
  const f = Number((plates[0] && plates[0].style.getPropertyValue('--fy') || '36%').replace('%', '')) / 100;
  if (land) waterY = -0.02 * vh + 0.385 * 1.04 * vh;
  else { const s = Math.max(vw / 716, vh / 1284), dh = 1284 * s; waterY = (0.385 * dh - (dh - vh) * f) * 1.1; }
  layout();
}
const tAt = (y) => { if (y <= A[0]) return 0; for (let k = 0; k < N - 1; k++) if (y < A[k + 1]) return k + (y - A[k]) / (A[k + 1] - A[k]); return N - 1; };

// ---- the paintings: the hero is in the page; the others come after it stands, the next scene first
const want = new Set(), IN = [[0, 0], [0.22, 0.86], [1.28, 1.9], [2.56, 2.9], [3.3, 3.88], [4.3, 4.88], [5.52, 5.9]];
function feed(k) { const im = imgs[k]; if (im && !im.getAttribute('src') && im.dataset.src) { im.src = im.dataset.src; want.add(k); } }
function feedAll() { let k = 1; const next = () => { if (k >= imgs.length) return; feed(k++); setTimeout(next, 260); }; next(); }
function stagePlates(t) {
  for (let k = 0; k < plates.length; k++) {
    // plate k comes in over plate k-1 while the field changes into its scene, and stays until k+1 covers it fully
    const inn = k === 0 ? 1 : smooth(t, IN[k][0], IN[k][1]), out = k === plates.length - 1 ? 0 : t >= IN[k + 1][1] ? 1 : 0;
    const o = still ? (Math.abs(t - k) < 0.5 || (k === 0 && t < 0.5) ? 1 : 0) : inn * (1 - out);
    const pl = plates[k]; if (pl._o !== o) { pl.style.opacity = o.toFixed(3); pl.style.visibility = o > 0.001 ? 'visible' : 'hidden'; pl._o = o; }
    if (o > 0 && !still && imgs[k]) {
      const d = clamp((t - k + 1) / 2), z = (k === 0 && !land ? 1.1 : 1) * (1 + 0.07 * d), ry = land ? (0.5 - d) * 7 : 0;
      imgs[k].style.transform = `${land ? 'perspective(1400px) ' : ''}translate3d(0,${(land ? (0.5 - d) * 24 : 0).toFixed(1)}px,0) rotateY(${ry.toFixed(2)}deg) scale(${z.toFixed(4)})`;
    }
    if (t > k - 1.4) feed(k);
  }
}

// ---- the counter: tokens burn while the noise grows, and fall to what the sea needs when it becomes one line
let shownV = -1;
function counter(t) {
  if (!count) return;
  const o = still ? (t > 0.5 && t < 2.5 ? 1 : 0) : smooth(t, 0.5, 0.85) * (1 - smooth(t, 2.12, 2.4));
  count.style.opacity = o.toFixed(3); if (o <= 0) return;
  const RAW = 227167, SEA = 865;
  let v = still ? (t < 1.5 ? RAW : SEA) : t < 1.3 ? RAW * ease(clamp((t - 0.42) / 0.5)) : RAW * Math.pow(SEA / RAW, ease(clamp((t - 1.3) / 0.58)));
  v = Math.round(v); if (v !== shownV) { countN.textContent = fmt(v); shownV = v; }
  const sea = still ? t >= 1.5 : t >= 1.62, l = sea ? 'tokens through the sea, the same task' : 'tokens for one task if it reads raw HTML', q = sea ? 'measured; median of 25 tasks, 24 Nov 2026' : 'upper bound; pages measured, search loop modelled';
  if (countL.textContent !== l) countL.textContent = l;
  if (countQ && countQ.textContent !== q) countQ.textContent = q;
}

// ---- the field of tokens
const PAL = [[238, 246, 251], [255, 122, 107], [255, 181, 71], [79, 227, 193], [127, 211, 255], [180, 156, 255], [255, 201, 119], [255, 150, 90]];
const GLY = ['<div>', '</span>', '<script>', 'class=""', 'style=', '{ }', '&nbsp;', 'onclick', '<!-- -->', 'data-v', '</a>', '<img>', 'px;', '<td>', 'var(--x)', '<svg>'];
let SPL = [0, 0, 1, 1], n = 0, R = 100, cx = 0, cy = 0, seed = [], F = {}, glyph = [], sprites = [], hubs = [], edges = [], path = [], fl = 900;
const rnd = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();
function sprite(text, rgb) {
  const c = D.createElement('canvas'), x = c.getContext('2d'), fs = 11 * dpr; x.font = `600 ${fs}px ui-monospace,Menlo,Consolas,monospace`;
  c.width = Math.ceil(x.measureText(text).width) + 4; c.height = Math.ceil(fs * 1.4);
  x.font = `600 ${fs}px ui-monospace,Menlo,Consolas,monospace`; x.fillStyle = `rgb(${rgb})`; x.textBaseline = 'middle'; x.fillText(text, 2, c.height / 2); return c;
}
function layout() {
  if (!g) return;
  dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (land) { const ph = 1.04 * vh, pw = ph * 716 / 1284, right = Math.max(0.04 * vw, (vw - 1320) / 2); cx = vw - right - pw / 2; cy = vh * 0.5; R = Math.min(pw * 0.62, vh * 0.36); }
  else { const top = 64, bot = 0.42 * vh; cx = vw / 2; cy = (top + bot) / 2 + 6; R = Math.min(vw * 0.43, (bot - top) / 2 + 26); }
  fl = R * 3.2;
  const want = land ? (vw * vh > 1.1e6 ? 720 : 560) : 380;
  n = Math.round(want * ((navigator.hardwareConcurrency || 8) <= 4 ? 0.75 : 1) * (govern || 1));
  build();
}
let govern = 1;
function build() {
  seed = []; for (let i = 0; i < n; i++) seed.push([rnd(), rnd(), rnd(), rnd()]);
  sprites = GLY.map((s, i) => sprite(s, PAL[i % 3 === 0 ? 2 : i % 3 === 1 ? 1 : 7].join(',')));
  glyph = seed.map((s, i) => (s[3] < 0.24 ? i % GLY.length : -1));
  const mk = () => ({ p: new Float32Array(n * 3), c: new Uint8Array(n), a: new Float32Array(n).fill(1) });
  const set = (f, i, x, y, z, c, a = 1) => { f.p[i * 3] = x; f.p[i * 3 + 1] = y; f.p[i * 3 + 2] = z; f.c[i] = c; f.a[i] = a; };
  const halfW = land ? Math.min(vw * 0.5, R * 1.9) : vw * 0.5;
  // 0 the surface: sparks on the waterline
  const surf = mk(); for (let i = 0; i < n; i++) { const s = seed[i]; set(surf, i, (s[0] * 2 - 1) * halfW * 1.15, waterY - cy + (s[1] - 0.5) * 10 + (s[2] - 0.3) * 30, (s[2] * 2 - 0.6) * R, s[3] < 0.3 ? 6 : 0, 0.55); }
  // 1 the noise: everything a page carries besides its words, all over the screen
  const noise = mk(); for (let i = 0; i < n; i++) { const s = seed[i]; set(noise, i, (land ? s[0] * 2.5 - 1.15 : s[0] * 2 - 1) * R * (land ? 1 : 1.45), (s[1] * 2 - 1) * R * (land ? 1.15 : 1.05), (s[2] * 2 - 1) * R, s[3] < 0.5 ? 1 : s[3] < 0.8 ? 7 : 2, 0.9); }
  // 2 one clean line, in the order the noise stood (nothing crosses)
  const line = mk(), ord = [...Array(n).keys()].sort((a, b) => noise.p[a * 3] - noise.p[b * 3]);
  ord.forEach((i, j) => set(line, i, (j / (n - 1) * 2 - 1) * (land ? R * 0.95 : vw * 0.46), (land ? 0 : R * 0.42), 0, j % 9 === 0 ? 3 : 0, 1));
  // 2b the shared brain: hubs in a cloud, every particle a cell of one hub; a golden pathway runs through it
  hubs = []; const HN = 34; for (let h = 0; h < HN; h++) { const u = rnd() * 2 - 1, th = rnd() * 6.283, r = Math.cbrt(rnd()); hubs.push([Math.sqrt(1 - u * u) * Math.cos(th) * R * 1.05 * r, u * R * 0.85 * r, Math.sqrt(1 - u * u) * Math.sin(th) * R * 0.8 * r]); }
  edges = []; hubs.forEach((a, i) => { const d = hubs.map((b, j) => [j, (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2]).sort((x, y) => x[1] - y[1]); for (const [j] of d.slice(1, 4)) if (i < j || !edges.some((e) => e[0] === j && e[1] === i)) edges.push([i, j]); });
  path = []; { const seen = new Set(); for (let j = 0; j < 9; j++) { const u = j / 8, px = (u * 2 - 1) * R * 0.95, py = (0.62 - 1.24 * u) * R * 0.8 + Math.sin(u * 6.2832) * R * 0.16; let best = -1, bd = 1e18; hubs.forEach((h, q) => { if (seen.has(q)) return; const d = (h[0] - px) ** 2 + (h[1] - py) ** 2 + 2.5 * h[2] ** 2; if (d < bd) { bd = d; best = q; } }); if (best >= 0) { seen.add(best); path.push(best); hubs[best] = [px, py, hubs[best][2] * 0.25]; } } }
  const onPath = new Set(path), brain = mk(); brain.on = new Float32Array(n); for (let i = 0; i < n; i++) { const s = seed[i], h = hubs[i % HN], r = R * 0.07 * Math.cbrt(s[0]); set(brain, i, h[0] + (s[1] - 0.5) * 2 * r, h[1] + (s[2] - 0.5) * 2 * r, h[2] + (s[3] - 0.5) * 2 * r, onPath.has(i % HN) ? 2 : 4, onPath.has(i % HN) ? 1 : 0.8); brain.on[i] = onPath.has(i % HN) ? (path.indexOf(i % HN) + 1) / path.length : 0; }
  // 3 the system: four constellations on one orbit (stored as the centre's number and the offset from it)
  const sys = mk(), sysK = new Uint8Array(n), shape = (k, j, m) => { const u = j / Math.max(1, m - 1), q = R * 0.2;
    if (k === 0) { const row = j % 5, L = [1, 0.86, 1, 0.7, 0.5][row], x = (Math.floor(j / 5) / Math.max(1, Math.ceil(m / 5) - 1) - 0.5) * 2 * L; return [x * q, (row - 2) * q * 0.34]; }
    if (k === 1) { const a = j * 2.39996, r = Math.sqrt((j + 0.5) / m); return [Math.cos(a) * r * q * 0.95, Math.sin(a) * r * q * 0.95]; }
    if (k === 2) { return u < 0.38 ? [(-0.9 + u / 0.38 * 0.55) * q, (0.05 + u / 0.38 * 0.5) * q] : [(-0.35 + (u - 0.38) / 0.62 * 1.25) * q, (0.55 - (u - 0.38) / 0.62 * 1.25) * q]; }
    const per = u * 3.2; if (per < 1) return [-0.55 * q, (0.75 - per * 1.3) * q]; if (per < 2.2) { const a = Math.PI + (per - 1) / 1.2 * Math.PI; return [Math.cos(a) * 0.55 * q, -0.55 * q + Math.sin(a) * 0.55 * q]; } return [0.55 * q, (-0.55 + (per - 2.2) * 1.3) * q]; };
  const per4 = [0, 0, 0, 0]; for (let i = 0; i < n; i++) per4[i % 4]++;
  const idx4 = [0, 0, 0, 0]; for (let i = 0; i < n; i++) { const k = i % 4, [x, y] = shape(k, idx4[k]++, per4[k]); sysK[i] = k; set(sys, i, x, y, 0, [3, 2, 5, 4][k], 1); }
  sys.k = sysK;
  // 4 the proof: sonar rings on a tilted disc
  const rings = mk(), ringI = new Uint8Array(n), ringA = new Float32Array(n), circ = [1, 2, 3], tot = 6; for (let i = 0; i < n; i++) { const u = i / n, ri = u < 1 / tot ? 0 : u < 3 / tot ? 1 : 2; ringI[i] = ri; ringA[i] = seed[i][0] * 6.2832; set(rings, i, 0, 0, 0, ri === 2 ? 4 : ri === 1 ? 3 : 0, 0.9); }
  rings.ri = ringI; rings.an = ringA; void circ;
  // 5 fair share: five shells; the middle one holds exactly a fifth of the field and is gold
  SPL = land ? [-R * 0.62, R * 0.62, R * 0.5, R * 0.22] : [-vw * 0.17, vw * 0.27, vw * 0.2, vw * 0.09];
  const shells = mk(), split = mk(), mid = Math.round(n * 0.2), sp = land ? R * 0.42 : vw * 0.185, dx = land ? Math.min(0, vw - 34 - (cx + 2.55 * sp)) : 0;
  for (let i = 0; i < n; i++) { const s = seed[i], k = i < mid ? 2 : [0, 1, 3, 4][i % 4], rib = Math.floor(s[0] * 7), a = (-80 + rib * (160 / 6)) * Math.PI / 180, r = sp * 0.5 * Math.sqrt(s[1]), x = dx + (k - 2) * sp + Math.sin(a) * r, y = -Math.cos(a) * r * 0.9 + sp * 0.25;
    set(shells, i, x, y, (s[2] - 0.5) * R * 0.2, k === 2 ? 2 : 0, 1);
    const big = i >= mid, cxS = big ? SPL[0] : SPL[1], rS = (big ? SPL[2] : SPL[3]) * Math.sqrt(s[1]), aS = s[0] * 6.2832;
    set(split, i, cxS + Math.cos(aS) * rS, Math.sin(aS) * rS * 0.9, (s[2] - 0.5) * R * 0.25, big ? 0 : 2, 1); }
  // 6 the way in: one ring that closes as the page ends
  const ring = mk(); for (let i = 0; i < n; i++) set(ring, i, 0, 0, 0, i < 8 ? 2 : seed[i][3] < 0.2 ? 6 : 0, 1);
  F = { surf, noise, line, brain, sys, rings, shells, split, ring };
}
// the keys of the journey: [t where the change starts, t where it is done, from, to]
const SEG = [[0.22, 0.86, 'surf', 'noise'], [1.28, 1.9, 'noise', 'line'], [2.04, 2.4, 'line', 'brain'], [2.56, 2.9, 'brain', 'sys'], [3.3, 3.88, 'sys', 'rings'], [4.3, 4.88, 'rings', 'shells'], [5.04, 5.4, 'shells', 'split'], [5.52, 5.9, 'split', 'ring']];
function state(t) { if (still) t = Math.round(t) === 2 ? 2.5 : Math.round(t) === 5 ? 5.5 : Math.round(t); let from = 'surf'; for (const [a, b, f, to] of SEG) { if (t >= b) { from = to; continue; } if (t > a) return [f, to, (t - a) / (b - a)]; break; } return [from, from, 0]; }
const P3 = new Float32Array(3), Q3 = new Float32Array(3);
function place(name, i, t, time, out) {
  const f = F[name], p = f.p, s = seed[i]; let x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
  if (name === 'surf') { x += Math.sin(time * 0.5 + s[0] * 6.28) * 7; y += Math.sin(time * 1.3 + s[1] * 6.28) * 2; }
  else if (name === 'noise') { const k = R * 0.1; x += Math.sin(time * 0.9 + y * 0.012 + s[0] * 6) * k; y += Math.cos(time * 0.8 + x * 0.01 + s[1] * 6) * k; z += Math.sin(time * 0.6 + s[2] * 6) * k; const a = time * 0.12, c = Math.cos(a), sn = Math.sin(a); const x2 = x * c - z * sn; z = x * sn + z * c; x = x2; }
  else if (name === 'line') { y += Math.sin(x * 0.02 - time * 2.2) * 2.5; }
  else if (name === 'brain') { const a = time * 0.16 + (t - 2) * 0.9, c = Math.cos(a), sn = Math.sin(a), x2 = x * c - z * sn; z = x * sn + z * c; x = x2; }
  else if (name === 'sys') { const k = f.k[i], a = time * 0.14 + (t - 3) * 1.1 + k * Math.PI / 2 + Math.PI / 4, ro = R * (land ? 0.6 : 0.72); const ox = Math.cos(a) * ro, oz = Math.sin(a) * ro, tilt = 0.32; x += ox - (land ? R * 0.16 : 0); y += oz * Math.sin(tilt) * 0.9 - R * 0.05; z = oz * Math.cos(tilt); }
  else if (name === 'rings') { const ri = f.ri[i], r = R * (land ? [0.3, 0.6, 0.88] : [0.34, 0.68, 1.0])[ri] * (1 + 0.05 * Math.sin(time * 1.7 - ri * 1.1)), a = f.an[i] + time * (ri % 2 ? 0.05 : -0.04), tilt = 1.0; x = Math.cos(a) * r; const yy = Math.sin(a) * r; y = yy * Math.cos(tilt); z = yy * Math.sin(tilt); }
  else if (name === 'shells' || name === 'split') { y += Math.sin(time * 1.1 + (x / R) * 2) * 3; }
  else if (name === 'ring') { const close = still ? 1 : smooth(t, 5.55, 6), a = -Math.PI / 2 + (i / n) * close * 6.2832 + time * 0.18, r = R * 0.8 * (1 + (s[0] - 0.5) * 0.06), tilt = 0.42; x = Math.cos(a) * r; const yy = Math.sin(a) * r; y = yy * Math.cos(tilt); z = yy * Math.sin(tilt); }
  out[0] = x; out[1] = y; out[2] = z; return f;
}
const css = {}; const col = (a, b, u) => { const q = Math.round(u * 8), k = a * 100 + b * 10 + q; return css[k] || (css[k] = `rgb(${PAL[a].map((v, j) => Math.round(v + (PAL[b][j] - v) * q / 8)).join(',')})`); };
function label(text, x, y, a, rgb) { if (a < 0.02) return; g.globalAlpha = a; g.fillStyle = `rgb(${rgb})`; g.fillText(text, x, y); }
function draw(t, time) {
  if (!g) return;
  g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, vw, vh); g.globalCompositeOperation = 'lighter';
  const [fa, fb, u0] = state(t), U = ease(clamp(u0));
  const W = (name) => (fa === fb ? (fa === name ? 1 : 0) : (fa === name ? 1 - U : 0) + (fb === name ? U : 0));
  let lastFill = '';
  for (let i = 0; i < n; i++) {
    const s = seed[i], fA = place(fa, i, t, time, P3), fB = place(fb, i, t, time, Q3);
    const ui = fa === fb ? 0 : ease(clamp((u0 - s[0] * 0.38) / 0.62));
    const x = P3[0] + (Q3[0] - P3[0]) * ui, y = P3[1] + (Q3[1] - P3[1]) * ui, z = P3[2] + (Q3[2] - P3[2]) * ui;
    const k = fl / (fl + z); if (k <= 0) continue;
    const sx = cx + x * k, sy = cy + y * k; if (sx < -20 || sx > vw + 20 || sy < -20 || sy > vh + 20) continue;
    let a = (fA.a[i] + (fB.a[i] - fA.a[i]) * ui) * clamp(0.35 + 0.65 * k * k);
    if (fa === 'surf' || fb === 'surf') { const tw = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(time * 2.4 + s[2] * 20)); a *= fa === fb ? tw : 1 - (1 - tw) * (1 - ui); }
    const gi = glyph[i], gwi = gi >= 0 ? (fa === 'noise' ? 1 - ui : fb === 'noise' ? ui : 0) : 0;
    if (gwi > 0.02 && sprites[gi]) { g.globalAlpha = clamp(a * gwi * 0.9); const sp = sprites[gi], w = sp.width / dpr * k, h = sp.height / dpr * k; g.drawImage(sp, sx - w / 2, sy - h / 2, w, h); a *= 1 - gwi; }
    if (a < 0.02) continue;
    const fill = col(fA.c[i], fB.c[i], ui); if (fill !== lastFill) { g.fillStyle = fill; lastFill = fill; }
    let sz = (1.1 + 1.5 * s[1]) * k * (land ? 1.15 : 1);
    // the pathway of the brain lights up hub by hub, and a pulse runs along it
    const on = F.brain.on[i]; if (on && (fa === 'brain' || fb === 'brain')) { const wbi = fa === 'brain' ? (fb === 'brain' ? 1 : 1 - ui) : ui, lit = still ? 1 : smooth(t, 2.1 + on * 0.25, 2.18 + on * 0.25), pu = still ? 0 : Math.exp(-(((time * 0.45) % 1.4 - on) ** 2) / 0.012); sz *= 1 + wbi * lit * (0.9 + 1.4 * pu); a = Math.min(1, a + wbi * lit * 0.5); }
    g.globalAlpha = clamp(a); g.fillRect(sx - sz / 2, sy - sz / 2, sz, sz);
  }
  // the brain's threads, and its pathway: a soft curve lit as far as the scroll has come (the hubs pulse, above)
  const wb = W('brain');
  if (wb > 0.02 && hubs.length) {
    const a = time * 0.16 + (t - 2) * 0.9, c = Math.cos(a), sn = Math.sin(a), pr = hubs.map(([x, y, z]) => { const x2 = x * c - z * sn, z2 = x * sn + z * c, k = fl / (fl + z2); return [cx + x2 * k, cy + y * k, k]; });
    g.lineWidth = 1; g.strokeStyle = 'rgb(127,211,255)'; g.globalAlpha = 0.22 * wb; g.beginPath(); for (const [i, j] of edges) { g.moveTo(pr[i][0], pr[i][1]); g.lineTo(pr[j][0], pr[j][1]); } g.stroke();
    const lit = still ? 1 : smooth(t, 2.1, 2.4), m = path.length - 1, pts = [];
    for (let j = 0; j <= Math.round(40 * lit); j++) { const v = j / 40 * m, q = Math.min(m - 1, Math.floor(v)), f2 = v - q, P = (o) => pr[path[Math.max(0, Math.min(m, q + o))]], cr = (c) => 0.5 * (2 * P(0)[c] + (-P(-1)[c] + P(1)[c]) * f2 + (2 * P(-1)[c] - 5 * P(0)[c] + 4 * P(1)[c] - P(2)[c]) * f2 * f2 + (-P(-1)[c] + 3 * P(0)[c] - 3 * P(1)[c] + P(2)[c]) * f2 * f2 * f2); pts.push([cr(0), cr(1)]); }
    if (pts.length > 1) { g.strokeStyle = 'rgb(255,181,71)'; g.lineCap = 'round'; g.lineJoin = 'round'; for (const [lw, al] of [[10, 0.07], [4, 0.16], [1.4, 0.85]]) { g.lineWidth = lw; g.globalAlpha = al * wb; g.beginPath(); pts.forEach(([x, y], j) => (j ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); } }
  }
  // what the four constellations are, and what the fair share leaves with you
  g.globalCompositeOperation = 'source-over'; g.font = `600 ${land ? 14 : 12.5}px "Public Sans",system-ui,sans-serif`; g.textAlign = 'center';
  const ws = W('sys');
  if (ws > 0.02) { const ro = R * (land ? 0.6 : 0.72), tilt = 0.32, sx0 = land ? -R * 0.16 : 0; ['Reader', 'Brain', 'Market', 'Doors'].forEach((name, k) => { const a = time * 0.14 + (t - 3) * 1.1 + k * Math.PI / 2 + Math.PI / 4, ox = Math.cos(a) * ro, oz = Math.sin(a) * ro, z = oz * Math.cos(tilt), kk = fl / (fl + z); label(name, cx + (ox + sx0) * kk, cy + (oz * Math.sin(tilt) * 0.9 - R * 0.05 + R * 0.3) * kk, ws * clamp(0.4 + kk * 0.6), PAL[[3, 2, 5, 4][k]].join(',')); }); }
  const wsp = W('split');
  if (wsp > 0.02) { const ly = cy + SPL[2] + 24, lh = land ? 18 : 16; label('you keep', cx + SPL[0], ly, wsp, '238,246,251'); label('at least 80 %', cx + SPL[0], ly + lh, wsp, '238,246,251'); label('voluntary share', cx + SPL[1], ly, wsp, '255,201,119'); label('at most 20 %', cx + SPL[1], ly + lh, wsp, '255,201,119'); }
  g.globalAlpha = 1;
}

// ---- the name cut by the waterline, the header's colour, the veil, the dock's ring
let lastScene = -1;
function chrome(t) {
  if (h1 && t < 1.3) { const r = h1.getBoundingClientRect(); h1.style.setProperty('--wl', `${Math.round(waterY - r.top)}px`); }
  if (!still && heroOut[0]) { const o = (1 - smooth(t, 0.08, 0.4)).toFixed(3); for (const el of heroOut) el.style.opacity = o; }
  H.classList.toggle('lit', t < 0.42);
  if (veil) veil.style.opacity = (land ? smooth(t, 0.25, 0.7) : 0.35 + 0.65 * smooth(t, 0.2, 0.6)).toFixed(3);
  if (ringF) ringF.style.strokeDashoffset = (1 - t / (N - 1)).toFixed(4);
  const sc = Math.round(t); if (sc !== lastScene && ringN) { ringN.textContent = String(sc); lastScene = sc; }
}

// ---- the loop: the field always breathes a little; the scroll moves everything else
let lastNow = 0, slow = 0, frames = 0;
function frame(now) {
  raf = 0;
  const t = tAt(scrollY), time = still ? 0 : now / 1000;
  if (t !== lastT || !still) { stagePlates(t); counter(t); chrome(t); draw(t, time); lastT = t; }
  // a machine that cannot keep up gets fewer particles (twice at most), never a stutter
  if (!still && lastNow) { const dt = now - lastNow; frames++; if (dt > 28) slow++; if (frames === 90) { if (slow > 45 && govern > 0.5) { govern *= 0.7; layout(); } frames = 0; slow = 0; } }
  lastNow = now;
  if (!still && !D.hidden) raf = requestAnimationFrame(frame);
}
const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
addEventListener('scroll', kick, { passive: true });
let rz = 0; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { measure(); lastT = -1; kick(); }, 120); });
D.addEventListener('visibilitychange', () => { lastNow = 0; if (!D.hidden) kick(); });

// ---- the words: scroll timelines in CSS; elsewhere an observer says when a card arrives
const seenCards = new WeakSet();
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { e.target.classList.add('in'); if (e.target.closest('#proof') && !seenCards.has(e.target)) { seenCards.add(e.target); proofIn(); } } }, { threshold: 0.12 });
  cards.forEach((c) => io.observe(c));
} else cards.forEach((c) => c.classList.add('in'));

// ---- the numbers of the proof: read when the reader gets there, from the same open files anyone can read
function countTo(el, to) {
  const goal = () => Number(to);
  if (el && !still && goal() > 0) { const from = 0, t0 = performance.now(), step = (now) => { const u = clamp((now - t0) / 1100); el.textContent = fmt(from + (goal() - from) * (1 - Math.pow(1 - u, 3))); if (u < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); }
  else if (el) el.textContent = fmt(to);
}
function rise() { for (const el of $$('#proof [data-v]')) countTo(el, el.dataset.v); }
// the live files first; if they are slow, the numbers the node wrote into the page count up, and the live ones follow
function proofIn() {
  if (!LIVE) return rise();
  let done = false; const tm = setTimeout(() => { if (!done) { done = true; rise(); } }, 1500);
  live((ok) => { const first = !done; done = true; clearTimeout(tm); if (first && !ok) rise(); return first; });
}
function live(then) {
  const get = (u) => fetch(B + u, { headers: { accept: 'application/json' }, cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  Promise.all([get('/open.json'), get('/savings.json')]).then(([o, s]) => {
    const anim = then(!!(o || s));
    const put = (sel, v) => { if (v == null || isNaN(v)) return; for (const el of $$(sel)) { el.dataset.v = String(v); if (anim) countTo(el, v); else el.textContent = fmt(v); } };
    if (o) { put('[data-k="paths"]', o.brain && o.brain.pathways); put('[data-k="market"]', o.market && o.market.verified); put('#n-checked', o.market && o.market.checked); put('#n-work', o.work && o.work.today); }
    const h = s && s.hero; if (h) { put('[data-k="spared"]', h.tokens); const mb = s.engine && s.engine.measuredBy; put('[data-k="sparedM"]', mb && mb.markdown != null ? mb.markdown : h.measured); put('[data-k="sparedN"]', mb ? (mb.engine || 0) : 0); put('[data-k="sparedE"]', h.modelled && h.modelled.mid); const el = $('#n-text'); if (el && h.measuredVsText != null) el.textContent = fmt(h.measuredVsText); }
    const at = $('#n-at'), when = (o && o.at) || (s && s.at); if (at && (o || s)) at.textContent = `read live from /open.json and /savings.json at ${new Date(when || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  });
}

// ---- the journey's menu closes when a place in it is chosen
const plan = $('#plan'); if (plan) plan.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('a[href^="#"]') && plan.hidePopover) { try { plan.hidePopover(); } catch {} } });

// ---- copy the address
D.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('[data-copy]'); if (!b) return; const el = D.getElementById(b.dataset.copy); if (!el || !navigator.clipboard) return; navigator.clipboard.writeText(el.textContent.trim()).then(() => { const was = b.textContent; b.textContent = 'Copied'; setTimeout(() => { b.textContent = was; }, 1600); }).catch(() => {}); });

measure(); kick();
const later = () => { measure(); lastT = -1; kick(); if (!still && !lite) feedAll(); };
if (D.readyState === 'complete') setTimeout(later, 300); else addEventListener('load', () => setTimeout(later, 300), { once: true });
if (D.fonts && D.fonts.ready) D.fonts.ready.then(() => { measure(); lastT = -1; kick(); });
})();
