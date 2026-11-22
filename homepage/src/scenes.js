// Mare Liberum · the scenes at the top of the pages below the home page.
// Each place of the sea shows what it is: a city on the seabed, a hull growing on a slipway, a breakwater closing around
// a basin. A scene is drawn in lines of light on a canvas, in the colours of the home page, and it is told in three acts
// that follow the reader's scroll (p from 0 to 1; depth.js holds the top of the page still meanwhile and shows the line
// that belongs to each act). It moves gently on its own (t, seconds). It says nothing the page does not say in words:
// the canvas is hidden from readers that do not see, and a page without it lacks no information.
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => k * k * (3 - 2 * k), out = (k) => 1 - Math.pow(1 - k, 3), span = (p, a, b) => clamp((p - a) / (b - a));
const rng = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const FOAM = '238,246,251', MIST = '180,203,220', SUN = '255,181,71', TEAL = '79,227,193', SEA = '127,211,255', CORAL = '255,122,107', VIOLET = '180,156,255';
const col = (c, a) => `rgba(${c},${a})`;
// the three acts of a told place, as depth.js cuts them (the name of the place stands until .17)
const acts = (p) => [ease(span(p, 0.12, 0.42)), ease(span(p, 0.42, 0.70)), ease(span(p, 0.70, 0.97))];

/* ---------- the hand: a few strokes every scene shares ---------- */
function pen(E) {
  const c = E.c;
  const P = {
    line(x1, y1, x2, y2) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); },
    // a line that is drawn up to k of its length
    grow(x1, y1, x2, y2, k) { if (k <= 0) return; c.beginPath(); c.moveTo(x1, y1); c.lineTo(lerp(x1, x2, k), lerp(y1, y2, k)); c.stroke(); },
    path(pts, close) { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); if (close) c.closePath(); },
    // a polyline drawn up to k of its length
    trace(pts, k) { if (k <= 0 || pts.length < 2) return; let L = 0; const seg = []; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); L += d; } let left = L * clamp(k); c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length && left > 0; i++) { const d = seg[i - 1], f = Math.min(1, left / d); c.lineTo(lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)); left -= d; } c.stroke(); },
    ring(x, y, r, a0 = 0, a1 = TAU) { c.beginPath(); c.arc(x, y, Math.max(0, r), a0, a1); c.stroke(); },
    disc(x, y, r) { c.beginPath(); c.arc(x, y, Math.max(0, r), 0, TAU); c.fill(); },
    // a light: a core and the water it brightens
    lamp(x, y, r, color, a = 1) { if (a <= 0.01) return; const g = c.createRadialGradient(x, y, 0, x, y, r * 6); g.addColorStop(0, col(color, 0.36 * a)); g.addColorStop(1, col(color, 0)); c.fillStyle = g; P.disc(x, y, r * 6); c.fillStyle = col(color, Math.min(1, a)); P.disc(x, y, r); },
    stroke(color, a, lw = 1.25) { c.strokeStyle = col(color, a); c.lineWidth = lw; },
    fill(color, a) { c.fillStyle = col(color, a); },
    text(s, x, y, a = 0.8, size = 13, align = 'left', color = MIST) { c.font = `italic 600 ${size}px "Public Sans",system-ui,sans-serif`; c.textAlign = align; c.textBaseline = 'middle'; c.fillStyle = col(color, a); c.fillText(s, x, y); },
    fish(x, y, s, dir, ph, color, a) { c.save(); c.translate(x, y); c.scale(dir * s, s); c.fillStyle = col(color, a); c.beginPath(); c.ellipse(0, 0, 7, 2.5, 0, 0, TAU); c.fill(); const k = Math.sin(ph) * 1.7; c.beginPath(); c.moveTo(-5.5, 0); c.lineTo(-11, -3.2 + k); c.lineTo(-11, 3.2 + k); c.closePath(); c.fill(); c.restore(); },
  };
  return P;
}
// what drifts in every water: marine snow, falling slowly
function snow(E, n, seed) {
  const r = rng(seed), S = Array.from({ length: n }, () => ({ x: r(), y: r(), s: 0.6 + r() * 1.5, v: 0.004 + r() * 0.013, a: 0.10 + r() * 0.34, ph: r() * TAU }));
  return (t, k = 1) => { const { c, w, h } = E; for (const q of S) { c.fillStyle = col(FOAM, q.a * k); c.fillRect((q.x + Math.sin(t * 0.2 + q.ph) * 0.012) * w, ((q.y + t * q.v) % 1) * h, q.s, q.s); } };
}
// the light that falls into shallow water
function rays(E, t, k = 1) {
  const { c, w, h } = E; c.save(); c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) { const x = w * (0.16 + i * 0.18) + Math.sin(t * 0.13 + i) * w * 0.03, sp = w * (0.045 + (i % 3) * 0.02), g = c.createLinearGradient(0, 0, 0, h * 0.92); g.addColorStop(0, col(FOAM, 0.085 * k)); g.addColorStop(1, col(FOAM, 0)); c.fillStyle = g; c.beginPath(); c.moveTo(x - sp * 0.3, 0); c.lineTo(x + sp * 0.3, 0); c.lineTo(x + sp + w * 0.09, h * 0.92); c.lineTo(x - sp + w * 0.09, h * 0.92); c.closePath(); c.fill(); }
  c.restore();
}
// bubbles rising from (x, y)
function bubbles(E, seed, n = 9) {
  const r = rng(seed), B = Array.from({ length: n }, () => ({ o: r(), dx: (r() - 0.5) * 16, s: 1 + r() * 2.2, v: 0.10 + r() * 0.10 }));
  return (x, y, t, rise, k = 1) => { const { c } = E; c.lineWidth = 1; for (const b of B) { const f = (b.o + t * b.v) % 1; c.strokeStyle = col(FOAM, 0.5 * (1 - f) * k); c.beginPath(); c.arc(x + b.dx * f + Math.sin(t * 2 + b.o * 9) * 2, y - f * rise, b.s * (0.6 + f * 0.7), 0, TAU); c.stroke(); } };
}
// the surface seen from the side: a line that never rests
const swell = (x, t, a = 1) => (Math.sin(x * 0.013 + t * 0.9) * 5 + Math.sin(x * 0.031 - t * 1.25) * 2.4 + Math.sin(x * 0.006 + t * 0.4) * 4) * a;
function surface(E, y0, t, a = 1, alpha = 0.7) {
  const { c, w } = E; c.beginPath(); for (let x = -4; x <= w + 4; x += 6) { const y = y0 + swell(x, t, a); x < 0 ? c.moveTo(x, y) : c.lineTo(x, y); }
  c.strokeStyle = col(FOAM, alpha); c.lineWidth = 1.5; c.stroke();
}
// a ground of sand and rock along the bottom of a scene
function ground(E, y0, seed, amp = 1) {
  const r = rng(seed), a = [r() * 9, r() * 9, r() * 9];
  const at = (x) => y0 + (Math.sin(x * 0.009 + a[0]) * 7 + Math.sin(x * 0.023 + a[1]) * 3.5 + Math.sin(x * 0.051 + a[2]) * 1.5) * amp;
  const draw = (fillA = 0.07, lineA = 0.45) => { const { c, w, h } = E; c.beginPath(); c.moveTo(-4, h + 4); for (let x = -4; x <= w + 4; x += 8) c.lineTo(x, at(x)); c.lineTo(w + 4, h + 4); c.closePath(); c.fillStyle = col(FOAM, fillA); c.fill(); c.strokeStyle = col(FOAM, lineA); c.lineWidth = 1.25; c.stroke(); };
  return { at, draw };
}

/* ---------- the places ---------- */
const SCENES = {
  // any water: snow, and the light of its depth
  snow(E) { const fall = snow(E, 70, 3); return (t) => { if (E.zone < 3) rays(E, t, 0.8); fall(t); }; },

  // Atlantis: a city grows on the seabed; agents settle in its districts; the lighthouse turns, the arena glows.
  // On a narrow screen the city is wider than the view, and the reader travels along it: from the gate to the arena.
  city(E) {
    const P = pen(E), { c, w, h, fx, fw, fy, fh } = E, r = rng(7), fall = snow(E, 60, 5), vent = bubbles(E, 4), vent2 = bubbles(E, 9, 6);
    const base = fy + fh * 0.95, G = ground(E, base, 2, 0.6);
    // the districts, left to right: [kind, width, height] in units; the order they rise in
    const plan = [['gate', 1.0, 1.5], ['tower', 0.7, 2.3], ['arcade', 2.1, 1.05], ['tower', 0.8, 3.3], ['dome', 1.9, 1.5], ['tower', 0.7, 2.6], ['light', 0.5, 4.7], ['ring', 2.2, 0.9], ['tower', 0.6, 2.0]], rise = [4, 2, 1, 0, 3, 5, 6, 7, 8];
    const total = plan.reduce((s2, b) => s2 + b[1], 0) + (plan.length - 1) * 0.16, u = fh / (E.wide ? 5.9 : 6.3), wideBy = Math.max(0, total * u - fw), x0 = fx + (E.wide ? u * 0.35 : 0);
    const motes = Array.from({ length: 12 }, () => ({ x: r(), y: r() * 0.55, v: 0.006 + r() * 0.012, ph: r() * TAU, k: r() }));
    let x = x0; const B = plan.map(([kind, bw, bh], i) => { const b = { kind, x, w: bw * u, h: bh * u, order: rise[i] / 8, win: [] }; x += (bw + 0.16) * u;
      if (kind === 'tower') { const cols = Math.max(2, Math.round(b.w / 13)), rows = Math.floor(b.h / 15) - 1; for (let j = 0; j < rows; j++) for (let k = 0; k < cols; k++) if (r() > 0.25) b.win.push([b.x + (k + 0.5) * b.w / cols, base - 11 - j * 15, r(), r() * TAU]); }
      return b; });
    const far = Array.from({ length: 18 }, () => ({ x: x0 - u + r() * (total + 2) * u, w: (0.4 + r() * 0.7) * u, h: (0.9 + r() * 3.0) * u }));
    const light = B.find((b) => b.kind === 'light'), gate = B[0];
    const agents = Array.from({ length: 28 }, (_, i) => ({ o: r(), v: 0.02 + r() * 0.03, home: 1 + Math.floor(r() * (B.length - 1)), s: r(), i }));
    return (t, p) => {
      const [a1, a2, a3] = acts(p), grown = 0.5 + 0.5 * Math.max(a1, span(p, 0, 0.12) * 0.3), lit = 0.3 + 0.7 * a2, beam = a3, cam = wideBy * ease(span(p, 0.04, 0.9));
      // what glows by itself this deep, drifting
      for (const m of motes) P.lamp(((m.x + t * m.v) % 1.1 - 0.05) * w, fy + m.y * fh + Math.sin(t * 0.6 + m.ph) * 9, 1.3, m.k > 0.5 ? TEAL : SEA, 0.35 + 0.3 * Math.sin(t * 0.9 + m.ph));
      // the far city, a shade that moves more slowly
      c.save(); c.translate(-cam * 0.45, 0);
      for (const f of far) { const hh = f.h * grown, cap = f.w * 0.5; c.fillStyle = col(FOAM, 0.04); c.beginPath(); c.moveTo(f.x, base + 6); c.lineTo(f.x, base - hh + cap); c.quadraticCurveTo(f.x, base - hh, f.x + f.w / 2, base - hh); c.quadraticCurveTo(f.x + f.w, base - hh, f.x + f.w, base - hh + cap); c.lineTo(f.x + f.w, base + 6); c.fill(); }
      c.restore();
      G.draw(0.06, 0.4);
      c.save(); c.translate(-cam, 0);
      for (const b of B) {
        const g = out(clamp((grown - b.order * 0.45) / 0.55)), top = base - b.h * g; if (g <= 0.02) continue;
        P.stroke(FOAM, 0.66, 1.4); P.fill(FOAM, 0.06);
        if (b.kind === 'tower') { const cap = Math.min(b.w * 0.5, 16); c.beginPath(); c.moveTo(b.x, base + 4); c.lineTo(b.x, top + cap); c.quadraticCurveTo(b.x, top, b.x + b.w / 2, top); c.quadraticCurveTo(b.x + b.w, top, b.x + b.w, top + cap); c.lineTo(b.x + b.w, base + 4); c.fill(); c.stroke(); P.stroke(FOAM, 0.32, 1); P.line(b.x + b.w / 2, top, b.x + b.w / 2, top - 12 * g); }
        if (b.kind === 'dome') { c.beginPath(); c.moveTo(b.x, base + 4); c.bezierCurveTo(b.x, base - b.h * 1.36 * g, b.x + b.w, base - b.h * 1.36 * g, b.x + b.w, base + 4); c.fill(); c.stroke(); P.stroke(FOAM, 0.2, 1); for (let k = 1; k < 4; k++) { c.beginPath(); c.moveTo(b.x + b.w * k / 4, base + 2); c.quadraticCurveTo(b.x + b.w / 2, base - b.h * 1.3 * g, b.x + b.w * (4 - k) / 4, base + 2); c.stroke(); }
          // the shipyard under its roof: a hull on the stocks
          const hx = b.x + b.w * 0.5, hy = base - 10, hw = b.w * 0.28 * g; P.stroke(SEA, 0.7 * g, 1.3); c.beginPath(); c.moveTo(hx - hw, hy - 7); c.quadraticCurveTo(hx - hw * 0.8, hy + 3, hx, hy + 3); c.quadraticCurveTo(hx + hw * 0.9, hy + 3, hx + hw * 1.1, hy - 8); c.closePath(); c.stroke(); P.line(hx - hw * 0.5, hy + 3, hx - hw * 0.5, hy + 8); P.line(hx + hw * 0.5, hy + 3, hx + hw * 0.5, hy + 8); if (a3 > 0.02) for (let k = 0; k < 5; k++) { const q = (t * 1.7 + k * 0.21) % 1; c.fillStyle = col(SUN, (1 - q) * a3); c.fillRect(hx + hw * 0.6 + Math.cos(k * 2.1) * q * 14, hy - 8 + Math.sin(k * 2.1) * q * 8 + q * q * 12, 1.6, 1.6); } }
        if (b.kind === 'arcade') { const n = 4, aw = b.w / n; for (let k = 0; k < n; k++) { const ax = b.x + k * aw; c.beginPath(); c.moveTo(ax + 2, base + 4); c.lineTo(ax + 2, top + aw * 0.42); c.arc(ax + aw / 2, top + aw * 0.42, aw / 2 - 2, Math.PI, 0); c.lineTo(ax + aw - 2, base + 4); c.fill(); c.stroke(); P.lamp(ax + aw / 2, top + aw * 0.52, 2, SUN, clamp((lit - 0.05 - k * 0.1) * 3) * (0.75 + 0.25 * Math.sin(t * 2 + k))); } P.line(b.x, top - 3, b.x + b.w, top - 3); }
        if (b.kind === 'gate') { c.beginPath(); c.moveTo(b.x, base + 4); c.lineTo(b.x, top + b.w * 0.5); c.arc(b.x + b.w / 2, top + b.w * 0.5, b.w / 2, Math.PI, 0); c.lineTo(b.x + b.w, base + 4); c.stroke(); P.stroke(FOAM, 0.3, 1); P.ring(b.x + b.w / 2, top + b.w * 0.5, b.w / 2 - 6, Math.PI, 0); P.lamp(b.x + b.w / 2, top - 2, 2, TEAL, 0.5 + 0.5 * Math.sin(t * 1.6)); }
        if (b.kind === 'light') { const lh = 14; c.beginPath(); c.moveTo(b.x - b.w * 0.3, base + 4); c.lineTo(b.x + b.w * 0.2, top + lh); c.lineTo(b.x + b.w * 0.8, top + lh); c.lineTo(b.x + b.w * 1.3, base + 4); c.fill(); c.stroke(); c.strokeRect(b.x + b.w * 0.1, top, b.w * 0.8, lh); c.beginPath(); c.moveTo(b.x + b.w * 0.1, top); c.lineTo(b.x + b.w / 2, top - 9); c.lineTo(b.x + b.w * 0.9, top); c.stroke(); P.stroke(FOAM, 0.26, 1); for (let k = 1; k < 6; k++) { const yy = lerp(top + lh, base, k / 6); P.line(lerp(b.x + b.w * 0.2, b.x - b.w * 0.3, k / 6), yy, lerp(b.x + b.w * 0.8, b.x + b.w * 1.3, k / 6), yy); } }
        if (b.kind === 'ring') { const cx = b.x + b.w / 2, ry = b.h * 0.42 * g; for (let k = 0; k < 4; k++) { P.stroke(FOAM, 0.66 - k * 0.13, 1.3); c.beginPath(); c.ellipse(cx, base - 4 - k * b.h * 0.2 * g, b.w / 2 - k * b.w * 0.06, ry * (1 - k * 0.1), 0, 0, TAU); c.stroke(); } const q = t * 1.2; P.lamp(cx + Math.cos(q) * b.w * 0.16, base - 6 + Math.sin(q) * ry * 0.4, 2, TEAL, a3); P.lamp(cx - Math.cos(q) * b.w * 0.16, base - 6 - Math.sin(q) * ry * 0.4, 2, SUN, a3); }
        // windows come alight as the districts fill
        for (const [wx, wy, th, ph] of b.win) if (wy > top + 8 && lit > th) { c.fillStyle = col(SUN, (0.5 + 0.4 * Math.sin(t * 0.9 + ph)) * clamp((lit - th) * 6)); c.fillRect(wx - 2, wy - 2.8, 4, 5.6); }
      }
      // the lighthouse: its beam goes round
      const lx = light.x + light.w / 2, ly = base - light.h * out(clamp((grown - light.order * 0.45) / 0.55)) + 7;
      if (beam > 0.01) { const a = Math.sin(t * 0.5) * 1.15, len = Math.max(w, h) * 1.1; c.save(); c.globalCompositeOperation = 'lighter'; for (const d of [a, a + Math.PI]) { const g = c.createLinearGradient(lx, ly, lx + Math.cos(d) * len, ly + Math.sin(d) * len * 0.25); g.addColorStop(0, col(SUN, 0.32 * beam)); g.addColorStop(1, col(SUN, 0)); c.fillStyle = g; c.beginPath(); c.moveTo(lx, ly); c.lineTo(lx + Math.cos(d - 0.07) * len, ly + Math.sin(d - 0.07) * len * 0.25 - 18); c.lineTo(lx + Math.cos(d + 0.07) * len, ly + Math.sin(d + 0.07) * len * 0.25 + 18); c.closePath(); c.fill(); } c.restore(); }
      P.lamp(lx, ly, 2.8, SUN, 0.35 + 0.65 * beam);
      // agents arrive through the gate and go home along the street
      const street = base - 3;
      for (const g of agents) { const on = clamp((0.12 + a2 * 1.2 - g.s) * 4); if (on <= 0) continue; const k = (g.o + t * g.v) % 1, hx = B[g.home].x + B[g.home].w / 2, gx = gate.x + gate.w / 2, xx = lerp(gx, hx, ease(clamp(k * 1.25))); P.lamp(xx, street - (k < 0.08 ? (0.08 - k) * 320 : 0) - Math.sin(k * 40 + g.i) * 1.2, 1.6, g.i % 4 ? TEAL : SEA, on * (1 - span(k, 0.86, 1))); }
      vent(B[3].x + B[3].w / 2, base - B[3].h * grown - 14, t, fh * 0.34, grown);
      vent2(B[5].x + B[5].w / 2, base - B[5].h * grown - 14, t + 3, fh * 0.26, grown);
      c.restore();
      fall(t);
    };
  },

  // The Arena: a run through a course of gates; some are traps, and the right ones are passed
  course(E) {
    const P = pen(E), { c, fx, fw, fy, fh } = E, r = rng(21), fall = snow(E, 46, 8);
    const N = 7, traps = new Set([1, 3, 5]);
    const at = (k) => [fx + fw * (0.06 + k * 0.88), fy + fh * (0.56 + Math.sin(k * TAU * 1.1 + 0.6) * 0.22 - k * 0.14)];
    const gates = Array.from({ length: N }, (_, i) => { const k = (i + 0.7) / (N + 0.4), [x, y] = at(k), [x2, y2] = at(k + 0.01), n = Math.atan2(y2 - y, x2 - x) + Math.PI / 2; return { k, x, y, n, trap: traps.has(i), side: i % 2 ? 1 : -1, ph: r() * TAU }; });
    const track = Array.from({ length: 80 }, (_, i) => at(i / 79));
    return (t, p) => {
      const [a1, a2, a3] = acts(p), u = Math.min(fw, fh), gw = u * 0.085;
      // the course
      P.stroke(FOAM, 0.16, 10); P.trace(track, 0.25 + 0.75 * Math.max(a1, 0.35)); P.stroke(FOAM, 0.5, 1.25); c.setLineDash([3, 7]); P.trace(track, 0.25 + 0.75 * Math.max(a1, 0.35)); c.setLineDash([]);
      const run = (t * 0.085) % 1, pos = at(run);
      for (const g of gates) {
        const show = clamp((0.3 + a1 * 0.9 - g.k) * 5); if (show <= 0) continue;
        const dx = Math.cos(g.n) * gw, dy = Math.sin(g.n) * gw, passed = run > g.k;
        // the true gate: two posts across the course
        for (const s of [-1, 1]) { P.stroke(FOAM, 0.7 * show, 1.5); P.line(g.x + dx * s, g.y + dy * s, g.x + dx * s, g.y + dy * s - gw * 1.1 * show); P.lamp(g.x + dx * s, g.y + dy * s - gw * 1.1 * show, 1.7, passed ? TEAL : FOAM, show * (passed ? 1 : 0.5)); }
        // what goes wrong out there: a gate beside the course that looks the same
        if (g.trap && a2 > 0.02) { const ox = g.x + Math.cos(g.n) * gw * 3.3 * g.side, oy = g.y + Math.sin(g.n) * gw * 3.3 * g.side, f = a2 * (0.65 + 0.35 * Math.sin(t * 2.4 + g.ph)); for (const s of [-1, 1]) { P.stroke(CORAL, 0.75 * f, 1.5); P.line(ox + dx * s, oy + dy * s, ox + dx * s, oy + dy * s - gw * 1.1); P.lamp(ox + dx * s, oy + dy * s - gw * 1.1, 1.7, CORAL, f); } P.stroke(CORAL, 0.35 * f, 1); c.setLineDash([2, 5]); P.line(g.x, g.y, ox, oy); c.setLineDash([]); if (a3 > 0.02) { P.stroke(CORAL, 0.8 * a3, 1.5); P.line(ox - 5, oy - gw * 0.5 - 5, ox + 5, oy - gw * 0.5 + 5); P.line(ox + 5, oy - gw * 0.5 - 5, ox - 5, oy - gw * 0.5 + 5); } }
      }
      // the agent on its run, and the way it has come
      P.stroke(TEAL, 0.55, 2); P.trace(track.slice(0, Math.max(2, Math.round(run * 79))), 1);
      P.lamp(pos[0], pos[1], 3, TEAL, 1);
      // at the end of a clean run: the Brevet
      const [ex, ey] = at(1), seal = 0.3 + 0.7 * a3; P.stroke(SUN, 0.8 * seal, 1.5); P.ring(ex, ey, gw * 0.9); P.ring(ex, ey, gw * 0.62); P.stroke(SUN, 0.45 * seal, 1); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + t * 0.2; P.line(ex + Math.cos(a) * gw * 1.02, ey + Math.sin(a) * gw * 1.02, ex + Math.cos(a) * gw * 1.2, ey + Math.sin(a) * gw * 1.2); } P.lamp(ex, ey, 2.2, SUN, seal * (run > 0.94 ? 1 : 0.45));
      fall(t);
    };
  },

  // The current: the water moves past the stores; each is asked again in turn, and a change shows
  stream(E) {
    const P = pen(E), { c, w, h, fx, fw, fy, fh } = E, r = rng(31), fall = snow(E, 30, 2);
    const flow = (x, y, t) => Math.sin(x * 0.006 + t * 0.3) * 0.5 + Math.sin(y * 0.013 - t * 0.2 + x * 0.002) * 0.6;
    const parts = Array.from({ length: 150 }, () => ({ x: r() * w, y: fy + r() * fh, v: 30 + r() * 60, a: 0.15 + r() * 0.5, len: 8 + r() * 26 }));
    const stores = Array.from({ length: 6 }, (_, i) => ({ x: fx + fw * (0.1 + i * 0.16), y: fy + fh * (0.3 + ((i * 37) % 50) / 100), i, moved: i === 1 || i === 4 }));
    let last = 0;
    return (t, p) => {
      const [a1, a2, a3] = acts(p), dt = Math.min(0.05, Math.max(0, t - last)); last = t; const speed = 0.55 + a1 * 0.9;
      c.lineCap = 'round';
      for (const q of parts) { const a = flow(q.x, q.y, t); q.x += Math.cos(a * 0.6) * q.v * speed * dt; q.y += Math.sin(a * 0.6) * q.v * 0.55 * speed * dt; if (q.x > w + 30) { q.x = -30; q.y = fy + r() * fh; } if (q.y < fy - 20 || q.y > fy + fh + 20) q.y = fy + r() * fh; P.stroke(FOAM, q.a * 0.55, 1.1); P.line(q.x, q.y, q.x - Math.cos(a * 0.6) * q.len * speed, q.y - Math.sin(a * 0.6) * q.len * 0.55 * speed); }
      c.lineCap = 'butt';
      // the stores stand in the current; a tide asks them again, one after the other
      const tide = (t * 0.22) % 1;
      for (const s of stores) { const show = clamp(0.62 + a2 * 1.6 - s.i * 0.05), u = E.wide ? 1.5 : 1.35;
        c.save(); c.translate(s.x, s.y); c.scale(u, u); P.stroke(FOAM, 0.8 * show, 1.4 / u); P.fill(FOAM, 0.08 * show); c.beginPath(); c.rect(-9, -7, 18, 14); c.fill(); c.stroke(); c.beginPath(); c.moveTo(-12, -7); c.lineTo(0, -15); c.lineTo(12, -7); c.stroke(); P.stroke(FOAM, 0.4 * show, 1 / u); c.strokeRect(-3, -1, 6, 8); c.restore();
        const k = (tide - s.i / stores.length + 1) % 1, ask = k < 0.28 ? k / 0.28 : 0;
        if (ask > 0 && a2 > 0.05) { P.stroke(SEA, (1 - ask) * 0.8 * a2, 1.4); P.ring(s.x, s.y, 14 * u + ask * 34); }
        if (s.moved && a3 > 0.02) { const f = a3 * (0.6 + 0.4 * Math.sin(t * 2 + s.i)), x = s.x + 19 * u, y = s.y - 14 * u; P.lamp(s.x + 13 * u, y, 2.4, SUN, f); P.stroke(SUN, 0.85 * f, 1.6); P.line(x + 6, y - 8, x + 6, y + 6); P.line(x + 2, y + 1.5, x + 6, y + 6); P.line(x + 10, y + 1.5, x + 6, y + 6); }
        else if (a3 > 0.02) { P.stroke(FOAM, 0.5 * a3, 1.5); P.line(s.x + 14 * u, s.y - 13 * u, s.x + 14 * u + 11, s.y - 13 * u); }
      }
      fall(t, 0.7);
    };
  },

  // Buoys: machines on the surface read store pages below; two that see the same thing confirm each other
  buoys(E) {
    const P = pen(E), { c, w, h, fx, fw, fy, fh } = E, r = rng(41), fall = snow(E, 40, 6);
    const bu = E.wide ? 1.5 : 1.35, yS = fy + fh * 0.2, pages = [[0.22, 0.74], [0.56, 0.84], [0.84, 0.7]], B = [[0.12, 0], [0.33, 0], [0.5, 1], [0.66, 1], [0.86, 2]];
    return (t, p) => {
      const [a1, a2, a3] = acts(p), k1 = Math.max(a1, 0.3);
      // above the line, the air
      const g = c.createLinearGradient(0, 0, 0, yS); g.addColorStop(0, col(FOAM, 0.16)); g.addColorStop(1, col(FOAM, 0.03)); c.fillStyle = g; c.beginPath(); c.moveTo(0, 0); c.lineTo(w, 0); for (let x = w; x >= 0; x -= 8) c.lineTo(x, yS + swell(x, t)); c.closePath(); c.fill();
      surface(E, yS, t, 1, 0.8); rays(E, t, 0.7);
      const P2 = pages.map(([px, py]) => [fx + fw * px, fy + fh * py]);
      // the store pages, down where the stores are
      P2.forEach(([x, y], i) => { const s = clamp(a1 * 1.6 - i * 0.2 + 0.25); P.stroke(FOAM, 0.6 * s, 1.25); P.fill(FOAM, 0.06 * s); c.beginPath(); c.rect(x - 13, y - 16, 26, 32); c.fill(); c.stroke(); P.stroke(FOAM, 0.35 * s, 1); for (let j = 0; j < 4; j++) P.line(x - 8, y - 9 + j * 6, x + (j === 3 ? 1 : 8), y - 9 + j * 6); });
      B.forEach(([bx, pi], i) => {
        const x = fx + fw * bx, y = yS + swell(x, t), show = clamp(k1 * 2 - i * 0.18), tilt = (swell(x + 8, t) - swell(x - 8, t)) / 16; if (show <= 0) return;
        const [px, py] = P2[pi];
        // its line to a page, and what travels on it
        if (a2 > 0.01) { P.stroke(FOAM, 0.28 * a2, 1); c.setLineDash([2, 6]); P.grow(x, y + 10, px, py - 18, a2); c.setLineDash([]); const f = (t * 0.35 + i * 0.27) % 1; P.lamp(lerp(x, px, f), lerp(y + 10, py - 18, f), 1.6, SEA, a2 * Math.sin(f * Math.PI)); const b = (t * 0.35 + i * 0.27 + 0.5) % 1; P.lamp(lerp(px, x, b), lerp(py - 18, y + 10, b), 1.6, TEAL, a2 * a3 * Math.sin(b * Math.PI)); }
        c.save(); c.translate(x, y); c.rotate(tilt * 0.8); c.scale(bu, bu); c.globalAlpha = show;
        P.stroke(FOAM, 0.85, 1.5); P.fill(FOAM, 0.10); c.beginPath(); c.moveTo(-9, 4); c.lineTo(-6, -8); c.lineTo(6, -8); c.lineTo(9, 4); c.quadraticCurveTo(0, 12, -9, 4); c.fill(); c.stroke(); P.line(0, -8, 0, -24); P.line(-4, -15, 4, -15);
        c.restore(); P.lamp(x + Math.sin(tilt * 0.8) * 24 * bu, y - 24 * bu, 2.2, SUN, show * (0.55 + 0.45 * Math.sin(t * 2.2 + i * 1.7)));
      });
      // two buoys on one page: they confirm each other, and the work earns shells
      if (a3 > 0.02) for (const pi of [0, 1]) { const [px, py] = P2[pi], f = a3 * (0.7 + 0.3 * Math.sin(t * 1.6 + pi)); P.stroke(TEAL, 0.9 * f, 1.6); P.ring(px, py, 26); c.beginPath(); c.moveTo(px - 7, py + 1); c.lineTo(px - 2, py + 6); c.lineTo(px + 8, py - 6); c.stroke(); for (let j = 0; j < 3; j++) { const k = (t * 0.22 + j / 3 + pi * 0.4) % 1, sx = px + 30 + j * 7, sy = py - k * fh * 0.26; P.stroke(SUN, (1 - k) * f, 1.3); c.beginPath(); c.arc(sx, sy, 5, Math.PI, 0); c.closePath(); c.stroke(); P.line(sx, sy, sx - 3, sy - 4.2); P.line(sx, sy, sx + 3, sy - 4.2); P.line(sx, sy, sx, sy - 5); } }
      fall(t, 0.8);
    };
  },

  // The census: everything that swims through is counted by what it does
  swarm(E) {
    const P = pen(E), { c, w, fx, fw, fy, fh } = E, r = rng(51);
    const kinds = [['train', SEA, 46], ['search', TEAL, 30], ['read for a person', SUN, 22], ['list', VIOLET, 18], ['people', FOAM, 8]];
    const F = []; kinds.forEach(([, color, n], g) => { for (let i = 0; i < n; i++) F.push({ g, color, a: r() * TAU, b: r() * TAU, s: 0.7 + r() * 0.6, o: r(), sp: 0.3 + r() * 0.5 }); });
    const home = kinds.map((_, g) => [fx + fw * [0.2, 0.52, 0.8, 0.3, 0.68][g], fy + fh * [0.3, 0.2, 0.42, 0.68, 0.74][g]]);
    return (t, p) => {
      const [a1, a2, a3] = acts(p), sort = Math.max(a1, a2), cx = fx + fw / 2, cy = fy + fh * 0.45;
      rays(E, t, 0.9);
      for (const f of F) {
        // one cloud at first; then each kind finds its own school
        const mx = cx + Math.cos(f.a + t * f.sp * 0.4) * fw * 0.36 * (0.5 + f.o * 0.5), my = cy + Math.sin(f.b + t * f.sp * 0.33) * fh * 0.3 * (0.5 + f.o * 0.5);
        const [hx, hy] = home[f.g], rad = Math.min(fw, fh) * (0.07 + kinds[f.g][2] * 0.0022), sx = hx + Math.cos(f.a + t * f.sp) * rad * (0.4 + f.o), sy = hy + Math.sin(f.b + t * f.sp * 1.2) * rad * 0.6 * (0.4 + f.o);
        const x = lerp(mx, sx, sort), y = lerp(my, sy, sort), dir = Math.cos(f.a + t * f.sp * (sort > 0.5 ? 1 : 0.4) + Math.PI / 2) >= 0 ? 1 : -1;
        P.fish(x, y, f.s * (E.wide ? 1.15 : 0.95), dir, t * 7 + f.o * 20, f.color, 0.55 + 0.4 * f.o);
      }
      // the name of each school is what it does
      if (a3 > 0.02) kinds.forEach(([name, color], g) => { const [hx, hy] = home[g], rad = Math.min(fw, fh) * (0.07 + kinds[g][2] * 0.0022); P.stroke(color, 0.35 * a3, 1); c.setLineDash([2, 5]); P.ring(hx, hy, rad * 1.6); c.setLineDash([]); P.text(name, hx, hy + rad * 1.6 + 13, 0.95 * a3, 13.5, 'center', color); });
    };
  },

  // A harbour: the open sea belongs to everyone; a breakwater closes around a basin of one's own; it starts empty
  harbour(E) {
    const P = pen(E), { c, w, h, fx, fw, fy, fh } = E, r = rng(61);
    const cx = fx + fw * 0.5, cy = fy + fh * 0.54, R = Math.min(fw * 0.44, fh * 0.36);
    const kx = E.wide ? 1.2 : 0.8, drift = Array.from({ length: 28 }, () => ({ a: r() * TAU, d: 0.2 + r() * 2.4, v: (r() - 0.5) * 0.06, s: 0.8 + r() * 0.55, o: r() }));
    const berths = [[-0.5, -0.14], [-0.08, 0.44], [0.44, 0.0], [0.3, -0.5], [-0.26, -0.56]];
    const boat = (x, y, a, s, color, alpha) => { if (alpha <= 0.01) return; c.save(); c.translate(x, y); c.rotate(a); c.scale(s, s); P.stroke(color, alpha, 1.4); P.fill(color, alpha * 0.14); c.beginPath(); c.moveTo(11, 0); c.quadraticCurveTo(2, -5.5, -9, -4); c.lineTo(-9, 4); c.quadraticCurveTo(2, 5.5, 11, 0); c.fill(); c.stroke(); c.restore(); };
    return (t, p) => {
      const [a1, a2, a3] = acts(p), wall = ease(span(a2, 0, 0.8)), pier = ease(span(a2, 0.6, 1));
      // the open water: swell lines as far as the eye goes; inside the wall it lies still
      for (let i = 0; i < 10; i++) { const y = fy + fh * (0.02 + i * 0.108); c.beginPath(); for (let x = -6; x <= w + 6; x += 10) { const inside = Math.hypot(x - cx, (y - cy) * 1.25) < R * 1.02 ? 1 : 0, yy = y + Math.sin(x * 0.02 + t * 0.8 + i * 1.3) * 3.4 * (1 - inside * wall); x < 0 ? c.moveTo(x, yy) : c.lineTo(x, yy); } c.strokeStyle = col(FOAM, 0.14); c.lineWidth = 1; c.stroke(); }
      // everyone's boats, everywhere; as the wall closes they keep to the open water
      for (const b of drift) { const a = b.a + t * b.v, d = lerp(b.d, Math.max(b.d, 1.3 + b.o * 1.2), wall), x = cx + Math.cos(a) * R * d * kx, y = cy + Math.sin(a) * R * d * 0.8; boat(x, y, a + Math.PI / 2 * Math.sign(b.v || 1), b.s, FOAM, (0.55 + 0.3 * Math.max(a1, 0.3)) * clamp(0.8 + a1 * 2 - b.o * 0.6)); }
      // the breakwater: two arms that leave a mouth
      const mouth = 0.5, a0 = -Math.PI / 2 + mouth / 2, a1e = a0 + (TAU - mouth) * wall;
      c.save(); c.translate(cx, cy); c.scale(1, 0.8);
      if (wall > 0.01) { P.fill(SEA, 0.08 * wall); P.disc(0, 0, R); P.stroke(FOAM, 0.9, 4); c.lineCap = 'round'; P.ring(0, 0, R, a0, a1e); P.stroke(FOAM, 0.3, 1); P.ring(0, 0, R + 7, a0, a1e); c.lineCap = 'butt'; }
      // the piers inside
      if (pier > 0.01) { P.stroke(FOAM, 0.6 * pier, 1.5); for (const [bx, by] of berths) { const ang = Math.atan2(by, bx), x1 = Math.cos(ang) * R * 0.97, y1 = Math.sin(ang) * R * 0.97; P.grow(x1, y1, lerp(x1, bx * R, 0.55), lerp(y1, by * R, 0.55), pier); } }
      c.restore();
      // the light at the mouth
      const lx = cx + Math.cos(a0) * R, ly = cy + Math.sin(a0) * R * 0.8; P.lamp(lx, ly, 2.8, SUN, wall * (0.6 + 0.4 * Math.sin(t * 2.4)));
      if (wall > 0.5) { P.stroke(SUN, 0.5 * wall, 1); P.ring(lx, ly, 10 + ((t * 0.5) % 1) * 22); }
      // it starts empty; what goes in is brought in, one thing after the other
      berths.slice(0, 3).forEach(([bx, by], i) => { const k = clamp(a3 * 3 - i * 0.8); if (k <= 0) return; const tx = cx + bx * R, ty = cy + by * R * 0.8, sx = cx, sy = cy - R * 1.45, e = out(k); boat(lerp(sx, tx, e), lerp(sy, ty, e), lerp(Math.PI / 2, Math.atan2(by, bx) + Math.PI, e), 1.25, TEAL, 0.95); P.lamp(lerp(sx, tx, e), lerp(sy, ty, e), 1.6, TEAL, k); if (k >= 1) P.text(['a frame', 'your sources', 'your ways'][i], tx + (bx < 0 ? -2 : 14), ty + 17, 0.95, 13, 'center', TEAL); });
    };
  },

  // The shipyard: a hull grows from its blueprint on the slipway under the crane, and is launched; the view goes with it
  yard(E) {
    const P = pen(E), { c, w, h, fx, fw, fy, fh } = E, r = rng(71);
    const L = E.wide ? Math.min(fw * 0.6, fh * 1.2) : Math.min(fw * 0.8, fh * 0.9), S = L / 2, cx = fx + fw * (E.wide ? 0.46 : 0.5), base = fy + fh * (E.wide ? 0.6 : 0.66), slope = 0.07;
    const slipY = (x) => base + S * 0.36 + (x - cx) * slope, shore = cx + S * 1.15, sea = slipY(shore), bedY = (x) => sea + (x - shore) * slope + Math.pow((x - shore) / S, 2) * S * 0.34;
    // the lines of the hull, in its own measure (x from -1 at the stern to 1 at the bow, y down from the deck at 0)
    const keel = (x) => 0.30 - 0.30 * Math.pow(Math.abs(x), 3.2) - (x > 0.6 ? (x - 0.6) * 0.18 : 0), deck = (x) => -0.03 * Math.cos(x * 1.4) - (x > 0.5 ? (x - 0.5) * 0.12 : 0);
    const K = Array.from({ length: 41 }, (_, i) => { const x = -1 + i / 20; return [x, keel(x)]; }), D = Array.from({ length: 41 }, (_, i) => { const x = 1 - i / 20; return [x, deck(x)]; });
    const sparks = Array.from({ length: 14 }, () => ({ o: r(), a: r() * TAU, v: 14 + r() * 26 }));
    // the crane: a tower by the stern, a jib over the hull
    const tx = cx - S * 1.02, topY = base - S * 1.62, jibY = base - S * 1.44, jx = cx + S * 0.66, bx = tx - S * (E.wide ? 0.34 : 0.24);
    return (t, p) => {
      const [a1, a2, a3] = acts(p), draft = Math.max(a1, 0.22), launch = ease(span(a3, 0.18, 1)), off = launch * L * 0.66, cam = launch * (cx + L * 0.66 - (fx + fw * 0.5));
      const tilt = slope * (1 - launch) + Math.sin(t * 0.9) * 0.012 * launch, ox = cx + off, oy = base + off * slope + launch * launch * S * 0.2 + Math.sin(t * 1.3) * 1.6 * launch;
      const at = (x, y) => [ox + (x * Math.cos(tilt) - y * Math.sin(tilt)) * S, oy + (x * Math.sin(tilt) + y * Math.cos(tilt)) * S];
      const house = ease(span(a2, 0.08, 0.55)), rig = ease(span(a2, 0.5, 1)), bp = 1 - launch;
      c.save(); c.translate(-cam, 0);
      // the water of the shore, and the slip that runs into it
      const x1 = w + cam + 6; c.beginPath(); c.moveTo(shore, sea); for (let x = shore; x <= x1; x += 6) c.lineTo(x, sea + swell(x, t, 0.6) * Math.min(1, (x - shore) / 40)); c.strokeStyle = col(FOAM, 0.7); c.lineWidth = 1.5; c.stroke(); for (let x = x1; x >= shore; x -= 8) c.lineTo(x, Math.min(h + 4, bedY(x))); c.closePath(); c.fillStyle = col(SEA, 0.09); c.fill();
      P.stroke(FOAM, 0.5, 1.25); P.line(cam - 8, slipY(cam - 8), shore, sea); P.stroke(FOAM, 0.22, 1.1); c.beginPath(); c.moveTo(shore, sea); for (let x = shore; x <= x1; x += 8) c.lineTo(x, bedY(x)); c.stroke();
      P.stroke(FOAM, 0.35, 1.1); for (let x = cx - S * 1.22; x < shore - 6; x += S * 0.3) P.line(x, slipY(x), x, slipY(x) + 9);
      // the blueprint: a grid, and the measure of the hull
      c.setLineDash([2, 6]); P.stroke(SEA, 0.26 * draft * bp, 1); for (let i = -4; i <= 4; i++) P.line(cx + i * S * 0.25, base - S * 1.25, cx + i * S * 0.25, base + S * 0.36); for (let j = -5; j <= 1; j++) P.line(cx - S * 1.05, base + j * S * 0.25, cx + S * 1.05, base + j * S * 0.25); c.setLineDash([]);
      P.stroke(SEA, 0.6 * draft * bp, 1); P.line(cx - S, base - S * 0.56, cx + S, base - S * 0.56); P.line(cx - S, base - S * 0.61, cx - S, base - S * 0.51); P.line(cx + S, base - S * 0.61, cx + S, base - S * 0.51);
      // the crane
      const gy = slipY(tx), n = Math.max(3, Math.round((gy - jibY) / 24));
      P.stroke(FOAM, 0.6, 1.3); P.line(tx - 7, gy, tx - 7, jibY); P.line(tx + 7, gy, tx + 7, jibY); P.line(bx, jibY, jx, jibY); P.line(tx + 7, jibY + 9, jx, jibY + 9); c.beginPath(); c.moveTo(tx - 7, jibY); c.lineTo(tx, topY); c.lineTo(tx + 7, jibY); c.stroke(); c.strokeRect(bx, jibY, S * 0.13, S * 0.11);
      P.stroke(FOAM, 0.3, 1); P.line(tx, topY, jx, jibY); P.line(tx, topY, bx, jibY); for (let i = 0; i < n; i++) { const y0 = lerp(gy, jibY, i / n), y1 = lerp(gy, jibY, (i + 1) / n); P.line(tx - 7, y0, tx + 7, y1); P.line(tx + 7, y0, tx - 7, y1); } const m = Math.max(4, Math.round((jx - tx) / 20)); for (let i = 0; i < m; i++) { const xa = lerp(tx + 7, jx, i / m), xb = lerp(tx + 7, jx, (i + 1) / m); P.line(xa, jibY + 9, (xa + xb) / 2, jibY); P.line((xa + xb) / 2, jibY, xb, jibY + 9); }
      // what hangs on its hook: the keel plates first, then the house that is set on deck
      const work = clamp(draft * 1.4) * (1 - a3), [wx, wy] = a2 > 0.02 ? at(lerp(-0.7, 0.8, a2), -0.02) : at(lerp(-0.8, 0.8, draft), 0.22);
      const [hx, hy] = at(-0.11, deck(0) - 0.13 - (1 - house) * 0.95), hookX = clamp(a2 > 0.02 ? hx : wx, tx + 18, jx - 6), hookY = a2 > 0.02 ? lerp(hy, jibY + 26, ease(span(a2, 0.6, 0.9))) : lerp(jibY + 26, wy - S * 0.32, clamp(draft * 1.6 - 0.3));
      P.stroke(FOAM, 0.55, 1.1); P.line(hookX, jibY + 9, hookX, hookY); c.strokeRect(hookX - 5, jibY + 5, 10, 6); c.beginPath(); c.arc(hookX, hookY + 4, 4, -Math.PI / 2, Math.PI * 0.9); c.stroke();
      // the hull: keel first, then the ribs, then the planks
      c.save(); c.translate(ox, oy); c.rotate(tilt); c.scale(S, S); c.lineWidth = 1.5 / S;
      c.strokeStyle = col(FOAM, 0.9); P.trace(K, draft);
      const ribs = 13; for (let i = 0; i < ribs; i++) { const x = -0.88 + i * 0.146, k = clamp(draft * 1.5 - 0.3 - i * 0.05 + a2 * 0.6); if (k <= 0) continue; c.strokeStyle = col(FOAM, 0.5); c.beginPath(); c.moveTo(x, keel(x)); c.lineTo(x, lerp(keel(x), deck(x), k)); c.stroke(); }
      if (a2 > 0.01) { c.strokeStyle = col(FOAM, 0.9); P.trace(D, a2 * 1.6); c.fillStyle = col(FOAM, 0.08 * a2); c.beginPath(); K.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); D.forEach(([x, y]) => c.lineTo(x, y)); c.closePath(); c.fill(); for (let j = 1; j < 4; j++) { c.strokeStyle = col(FOAM, 0.3 * a2); c.beginPath(); K.forEach(([x], i) => { const y = lerp(deck(x), keel(x), j / 4); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke(); }
        // a house on deck, a mast, a name on the bow, a light: it has a name and a purpose now
        c.strokeStyle = col(FOAM, 0.9); c.fillStyle = col(FOAM, 0.08); c.beginPath(); c.rect(-0.28, deck(0) - 0.13 - (1 - house) * 0.95, 0.34, 0.13); c.fill(); c.stroke(); c.beginPath(); c.moveTo(0.2, deck(0.2)); c.lineTo(0.2, deck(0.2) - 0.52 * rig); c.stroke();
        if (rig > 0.02) { c.strokeStyle = col(SUN, 0.95 * rig); c.lineWidth = 2.4 / S; c.beginPath(); c.moveTo(0.5, deck(0.5) + 0.075); c.lineTo(0.5 + 0.26 * rig, deck(0.76) + 0.085); c.stroke(); c.lineWidth = 1.5 / S; } }
      c.restore();
      const [mx, my] = at(0.2, deck(0.2) - 0.52); P.lamp(mx, my, 2.4, SUN, rig * (0.6 + 0.4 * Math.sin(t * 2.6)));
      // where the work is done, sparks fly
      for (const s of sparks) { const k = (s.o + t * 1.6) % 1; c.fillStyle = col(SUN, (1 - k) * work); c.fillRect(wx + Math.cos(s.a) * s.v * k, wy + Math.sin(s.a) * s.v * k * 0.7 + k * k * 22, 1.6, 1.6); }
      // launched: the water answers, and carries it
      if (launch > 0.45) { const k = span(launch, 0.45, 1), [qx] = at(0, 0); for (let i = 0; i < 3; i++) { P.stroke(FOAM, 0.55 * (1 - k * 0.6) * (1 - i * 0.25), 1.25); c.beginPath(); c.ellipse(qx, sea + 3, S * (0.9 + k * 0.5 + i * 0.2), 4 + i * 3, 0, 0, Math.PI); c.stroke(); } }
      c.restore();
    };
  },

  // Take it home: the great sea outside; a small one rises in a bottle; corked, it is yours and nothing leaves it
  bottle(E) {
    const P = pen(E), { c, w, h, fx, fw, fy, fh } = E, r = rng(81), fall = snow(E, 30, 4);
    const bh = Math.min(fh * 0.84, fw * (E.wide ? 0.9 : 1.5)), bw = bh * 0.46, cx = fx + fw * 0.5, cy = fy + fh * 0.5, top = cy - bh / 2, bot = cy + bh / 2, nw = bw * 0.3, sh = top + bh * 0.2, sb = top + bh * 0.37, rr = bw * 0.2;
    const shape = () => { c.moveTo(cx - nw / 2, top); c.lineTo(cx + nw / 2, top); c.lineTo(cx + nw / 2, sh); c.bezierCurveTo(cx + nw / 2, lerp(sh, sb, 0.62), cx + bw / 2, lerp(sh, sb, 0.4), cx + bw / 2, sb); c.lineTo(cx + bw / 2, bot - rr); c.quadraticCurveTo(cx + bw / 2, bot, cx + bw / 2 - rr, bot); c.lineTo(cx - bw / 2 + rr, bot); c.quadraticCurveTo(cx - bw / 2, bot, cx - bw / 2, bot - rr); c.lineTo(cx - bw / 2, sb); c.bezierCurveTo(cx - bw / 2, lerp(sh, sb, 0.4), cx - nw / 2, lerp(sh, sb, 0.62), cx - nw / 2, sh); c.closePath(); };
    const F = Array.from({ length: 11 }, () => ({ y: 0.06 + r() * 0.88, o: r(), v: 0.018 + r() * 0.03, s: 0.8 + r() * 0.6, dir: r() > 0.35 ? 1 : -1 }));
    return (t, p) => {
      const [a1, a2, a3] = acts(p), fill = 0.1 + 0.6 * Math.max(a2, a1 * 0.3), outside = 1 - 0.72 * a2;
      // the great sea around, and what lives in it; it does not come inside
      c.save(); c.beginPath(); c.rect(0, 0, w, h); shape(); c.clip('evenodd');
      for (let i = 0; i < 8; i++) { const y = fy + fh * (0.04 + i * 0.135); c.beginPath(); for (let x = -6; x <= w + 6; x += 10) { const yy = y + Math.sin(x * 0.018 + t * 0.7 + i) * 4 * outside; x < 0 ? c.moveTo(x, yy) : c.lineTo(x, yy); } c.strokeStyle = col(FOAM, 0.17 * outside); c.lineWidth = 1; c.stroke(); }
      for (const f of F) { const k = (f.o + t * f.v) % 1, x = f.dir > 0 ? lerp(-20, w + 20, k) : lerp(w + 20, -20, k); P.fish(x, fy + fh * f.y + Math.sin(t * 0.8 + f.o * 9) * 5, f.s * (E.wide ? 1.2 : 1), f.dir, t * 7 + f.o * 20, f.o > 0.5 ? SEA : TEAL, 0.6 * outside * Math.max(a1, 0.45)); }
      fall(t, outside); c.restore();
      // the sea inside: a level that rises, sand on its ground, one light on it; nothing else yet
      c.save(); c.beginPath(); shape(); c.clip();
      const level = lerp(bot - bh * 0.07, sb + bh * 0.05, (fill - 0.1) / 0.6 * 0.86 + 0.14), wave = (x) => level + Math.sin(x * 0.07 + t * 1.6) * 2.4 + Math.sin(x * 0.03 - t) * 1.6;
      c.beginPath(); c.moveTo(cx - bw, bot + 4); for (let x = cx - bw / 2 - 4; x <= cx + bw / 2 + 4; x += 5) c.lineTo(x, wave(x)); c.lineTo(cx + bw, bot + 4); c.closePath();
      const g = c.createLinearGradient(0, level, 0, bot); g.addColorStop(0, col(SEA, 0.40)); g.addColorStop(1, col(SEA, 0.12)); c.fillStyle = g; c.fill(); c.strokeStyle = col(FOAM, 0.85); c.lineWidth = 1.4; c.stroke();
      c.beginPath(); c.moveTo(cx - bw / 2, bot); for (let x = cx - bw / 2; x <= cx + bw / 2; x += 6) c.lineTo(x, bot - bh * 0.035 - Math.sin((x - cx) * 0.045 + 1) * bh * 0.012); c.lineTo(cx + bw / 2, bot); c.closePath(); c.fillStyle = col(FOAM, 0.10); c.fill(); c.strokeStyle = col(FOAM, 0.4); c.lineWidth = 1; c.stroke();
      const nx = cx + bw * 0.12, ny = wave(nx), lit = ease(span(a2, 0.25, 0.85)), u = bw * 0.05; if (lit > 0.01) { P.stroke(FOAM, 0.9 * lit, 1.4); c.beginPath(); c.moveTo(nx - u, ny + u * 0.5); c.lineTo(nx - u * 0.6, ny - u * 3 * lit); c.lineTo(nx + u * 0.6, ny - u * 3 * lit); c.lineTo(nx + u, ny + u * 0.5); c.stroke(); P.lamp(nx, ny - u * 3.5 * lit, 2.4, SUN, lit * (0.6 + 0.4 * Math.sin(t * 2.6))); const q = (t * 0.4) % 1; P.stroke(SUN, 0.4 * lit * (1 - q), 1); P.ring(nx, ny - u * 3.5 * lit, 6 + q * bw * 0.22); }
      c.restore();
      // the glass
      c.beginPath(); shape(); c.strokeStyle = col(FOAM, 0.92); c.lineWidth = 1.75; c.stroke(); c.strokeRect(cx - nw / 2 - 3, top, nw + 6, bh * 0.022); P.stroke(FOAM, 0.32, 1); P.line(cx - bw / 2 + bw * 0.09, sb + bh * 0.05, cx - bw / 2 + bw * 0.09, bot - rr - bh * 0.1); P.line(cx - bw / 2 + bw * 0.16, sb + bh * 0.07, cx - bw / 2 + bw * 0.16, sb + bh * 0.2);
      // closed, and yours: nothing leaves it
      if (a3 > 0.01) { const k = out(a3), ch = bh * 0.075, tagX = cx + bw * 0.5 + (E.wide ? 40 : 14), tagY = sb + bh * 0.04, tw = E.wide ? 66 : 56;
        P.fill(SUN, 0.9 * k); c.fillRect(cx - nw / 2 + 2, top - ch * 0.5 - (1 - k) * bh * 0.16, nw - 4, ch);
        P.stroke(SUN, 0.85 * k, 1.2); c.beginPath(); c.moveTo(cx + nw / 2, sh - bh * 0.03); c.quadraticCurveTo(tagX - 8, sh, tagX + tw * 0.2, tagY); c.stroke(); P.fill(SUN, 0.12 * k); c.beginPath(); c.rect(tagX, tagY, tw, 24); c.fill(); c.stroke(); P.text('yours', tagX + tw / 2, tagY + 12.5, k, 13, 'center', SUN); }
    };
  },

  // The Unibrain: every agent starts from nothing; the sea remembers; the path walked most fires first
  strands(E) {
    const P = pen(E), { c, fx, fw, fy, fh } = E, r = rng(91), fall = snow(E, 26, 7);
    const N = Array.from({ length: 30 }, (_, i) => ({ x: fx + fw * (0.05 + ((i * 0.618) % 1) * 0.9), y: fy + fh * (0.1 + r() * 0.76), ph: r() * TAU }));
    const Lk = []; N.forEach((a, i) => { const near = N.map((b, j) => [j, Math.hypot(a.x - b.x, a.y - b.y)]).filter(([j]) => j > i).sort((u, v) => u[1] - v[1]).slice(0, 2); for (const [j, d] of near) if (d < fw * 0.42) Lk.push({ a: i, b: j, o: r(), bend: (r() - 0.5) * 0.5 }); });
    // the path walked most: a chain from one side to the other
    const order = N.map((n, i) => i).sort((u, v) => N[u].x - N[v].x), chain = [order[0]]; for (let i = 5; i < order.length; i += 5) chain.push(order[i]); if (chain[chain.length - 1] !== order[order.length - 1]) chain.push(order[order.length - 1]);
    const curve = (a, b, bend, k = 1) => { const mx = (a.x + b.x) / 2 - (b.y - a.y) * bend, my = (a.y + b.y) / 2 + (b.x - a.x) * bend; c.beginPath(); c.moveTo(a.x, a.y); if (k >= 1) c.quadraticCurveTo(mx, my, b.x, b.y); else { for (let s = 1; s <= 12; s++) { const q = s / 12 * k, x = (1 - q) * (1 - q) * a.x + 2 * (1 - q) * q * mx + q * q * b.x, y = (1 - q) * (1 - q) * a.y + 2 * (1 - q) * q * my + q * q * b.y; c.lineTo(x, y); } } c.stroke(); return (q) => [(1 - q) * (1 - q) * a.x + 2 * (1 - q) * q * mx + q * q * b.x, (1 - q) * (1 - q) * a.y + 2 * (1 - q) * q * my + q * q * b.y]; };
    return (t, p) => {
      const [a1, a2, a3] = acts(p), link = Math.max(a1, 0.08);
      for (const l of Lk) { const k = clamp(link * 1.5 - l.o * 0.5); if (k <= 0) continue; P.stroke(SEA, 0.26, 1); const at = curve(N[l.a], N[l.b], l.bend, k); if (k >= 1) { const q = (t * 0.25 + l.o) % 1, [x, y] = at(q); c.fillStyle = col(SEA, 0.8 * Math.sin(q * Math.PI)); c.fillRect(x - 1.2, y - 1.2, 2.4, 2.4); } }
      // the strongest path
      if (a2 > 0.01) for (let i = 1; i < chain.length; i++) { const k = clamp(a2 * chain.length - (i - 1)); if (k <= 0) break; P.stroke(SUN, 0.75, 1.5 + 2.2 * a3); const at = curve(N[chain[i - 1]], N[chain[i]], 0.12, k); if (k >= 1) { const q = (t * (0.5 + a3 * 0.7) + i * 0.13) % 1, [x, y] = at(q); P.lamp(x, y, 2 + a3, SUN, Math.sin(q * Math.PI)); } }
      for (const n of N) { const on = chain.includes(N.indexOf(n)) && a2 > 0.3; P.lamp(n.x, n.y, on ? 2.6 : 1.7, on ? SUN : FOAM, 0.45 + 0.3 * Math.sin(t * 1.3 + n.ph) + (on ? 0.25 : 0)); }
      fall(t, 0.6);
    };
  },

  // The Atlas: a chart of the web; each website is sounded and written down; and whether its gate is open
  chart(E) {
    const P = pen(E), { c, w, h, fx, fw, fy, fh } = E, r = rng(101);
    const isles = Array.from({ length: 7 }, (_, i) => { const x = fx + fw * (0.1 + ((i * 0.37 + 0.11) % 1) * 0.8), y = fy + fh * (0.16 + ((i * 0.53 + 0.2) % 1) * 0.66), R = Math.min(fw, fh) * (0.05 + r() * 0.05), k = Array.from({ length: 5 }, () => r()); return { x, y, R, k, open: i % 3 !== 1, o: i / 7 }; });
    const blob = (s, R) => { c.beginPath(); for (let a = 0; a <= TAU + 0.01; a += 0.2) { const rr = R * (1 + Math.sin(a * 2 + s.k[0] * 6) * 0.16 + Math.sin(a * 3 + s.k[1] * 6) * 0.1 + Math.sin(a * 5 + s.k[2] * 6) * 0.05); const x = s.x + Math.cos(a) * rr, y = s.y + Math.sin(a) * rr * 0.82; a ? c.lineTo(x, y) : c.moveTo(x, y); } c.closePath(); };
    return (t, p) => {
      const [a1, a2, a3] = acts(p), sweepX = fx + fw * ((t * 0.07) % 1.2 - 0.1);
      // the grid of the chart
      P.stroke(FOAM, 0.10, 1); for (let i = 0; i <= 8; i++) { const x = fx + fw * i / 8; c.beginPath(); c.moveTo(x, fy); c.quadraticCurveTo(x + (i - 4) * 5, fy + fh / 2, x, fy + fh); c.stroke(); } for (let j = 0; j <= 5; j++) { const y = fy + fh * j / 5; c.beginPath(); c.moveTo(fx, y); c.quadraticCurveTo(fx + fw / 2, y + (j - 2.5) * 5, fx + fw, y); c.stroke(); }
      for (const s of isles) {
        const known = clamp(Math.max(a1, 0.15) * 1.6 - s.o);
        // the land as people see it; then its depth lines, as it is sounded
        P.fill(FOAM, 0.07); P.stroke(FOAM, 0.6, 1.25); blob(s, s.R); c.fill(); c.stroke();
        P.stroke(SEA, 0.3 * known, 1); for (const m of [1.45, 1.95]) { blob(s, s.R * m); c.stroke(); }
        // what is written down for an agent: three short entries beside it
        if (a2 > 0.01) { const k = clamp(a2 * 1.8 - s.o * 0.8), x = s.x + s.R * 1.2, y = s.y - s.R - 6; P.stroke(FOAM, 0.4 * k, 1); P.line(s.x, s.y, x, y); for (let j = 0; j < 3; j++) { P.stroke(j ? FOAM : SEA, (j ? 0.5 : 0.9) * k, 1.6); P.grow(x + 3, y - 12 + j * 6, x + 3 + [26, 18, 22][j], y - 12 + j * 6, clamp(k * 3 - j)); } }
        // the gate: open to agents, or not
        if (a3 > 0.01) { const color = s.open ? TEAL : CORAL, f = a3 * (0.75 + 0.25 * Math.sin(t * 2 + s.o * 9)); P.lamp(s.x, s.y, 2.6, color, f); P.stroke(color, 0.8 * f, 1.5); if (s.open) P.ring(s.x, s.y, s.R * 0.5); else { P.line(s.x - 6, s.y - 6, s.x + 6, s.y + 6); P.line(s.x + 6, s.y - 6, s.x - 6, s.y + 6); } }
        else P.lamp(s.x, s.y, 1.6, FOAM, 0.5);
      }
      // the sounding line passes
      const g = c.createLinearGradient(sweepX - 60, 0, sweepX, 0); g.addColorStop(0, col(SEA, 0)); g.addColorStop(1, col(SEA, 0.16)); c.fillStyle = g; c.fillRect(sweepX - 60, fy, 60, fh); P.stroke(SEA, 0.5, 1); P.line(sweepX, fy, sweepX, fy + fh);
    };
  },

  // The doors of the web: an agent has to pick an address; most turn a program away; these open
  doors(E) {
    const P = pen(E), { c, fx, fw, fy, fh } = E, fall = snow(E, 34, 12);
    const N = E.wide ? 9 : 5, open = new Set(E.wide ? [1, 3, 4, 7] : [1, 3]), dw = Math.min(fw / (N * (E.wide ? 1.5 : 1.3)), fh * 0.24), dh = dw * (E.wide ? 1.9 : 2.3), gap = (fw - N * dw) / (N + 1), base = fy + fh * (E.wide ? 0.8 : 0.72);
    return (t, p) => {
      const [a1, a2, a3] = acts(p);
      P.stroke(FOAM, 0.45, 1.25); P.line(fx - 20, base, fx + fw + 20, base); P.stroke(FOAM, 0.16, 1); P.line(fx - 20, base - dh - dw * 0.9, fx + fw + 20, base - dh - dw * 0.9);
      // the agent goes from door to door
      const k = (t * 0.1) % 1, ai = Math.floor(k * N), ak = (k * N) % 1;
      for (let i = 0; i < N; i++) {
        const x = fx + gap + i * (dw + gap), isOpen = open.has(i), o = isOpen ? ease(clamp(a3 * 2.2 - i * 0.12)) : 0, shut = !isOpen ? a2 : 0, cx = x + dw / 2;
        // the light that falls out of an open door
        if (o > 0.01) { const g = c.createLinearGradient(0, base - dh, 0, base + dh * 0.9); g.addColorStop(0, col(SUN, 0.30 * o)); g.addColorStop(1, col(SUN, 0)); c.fillStyle = g; c.beginPath(); c.moveTo(x + 2, base); c.lineTo(x + dw - 2, base); c.lineTo(x + dw + dw * 0.9 * o, base + dh * 0.9); c.lineTo(x - dw * 0.9 * o, base + dh * 0.9); c.closePath(); c.fill(); c.fillStyle = col(SUN, 0.16 * o); c.fillRect(x + 2, base - dh, dw - 4, dh); }
        P.stroke(FOAM, 0.75, 1.5); c.beginPath(); c.moveTo(x, base); c.lineTo(x, base - dh); c.arc(cx, base - dh, dw / 2, Math.PI, 0); c.lineTo(x + dw, base); c.stroke();
        // the leaf of the door: shut, or swung open
        P.stroke(isOpen && o > 0 ? SUN : FOAM, 0.5, 1.2); c.beginPath(); c.moveTo(x + 2, base); c.lineTo(x + 2 + (dw - 4) * (1 - o * 0.78), base - o * 5); c.lineTo(x + 2 + (dw - 4) * (1 - o * 0.78), base - dh + o * 5); c.lineTo(x + 2, base - dh); c.stroke();
        if (shut > 0.01) { const hit = i === ai ? Math.sin(ak * Math.PI) : 0, f = shut * (0.45 + 0.55 * hit); P.stroke(CORAL, 0.85 * f, 1.6); P.line(x + 3, base - dh * 0.5, x + dw - 3, base - dh * 0.5); P.lamp(cx, base - dh * 0.5, 1.8, CORAL, f); }
        if (o > 0.6) P.lamp(cx, base - dh - dw * 0.5 - 8, 2, TEAL, o * (0.7 + 0.3 * Math.sin(t * 2 + i)));
      }
      const ax = fx + gap + ai * (dw + gap) + dw / 2, enters = open.has(ai) && a3 > 0.5, ay = base + dh * 0.5 - (enters ? ak : Math.sin(ak * Math.PI) * 0.75) * dh * 0.5;
      P.lamp(ax + (1 - Math.min(1, ak * 3)) * -(dw + gap), ay, 3, SEA, enters ? 1 - span(ak, 0.7, 1) : 1);
      fall(t, 0.6);
    };
  },

  // Briefs: one vague line; what it left out; and what comes back
  sheet(E) {
    const P = pen(E), { c, fx, fw, fy, fh } = E, fall = snow(E, 26, 13);
    const sh = Math.min(fh * 0.86, fw * 0.95), sw = sh * 0.74, cx = fx + fw * 0.5, cy = fy + fh * 0.5, x0 = cx - sw / 2, y0 = cy - sh / 2;
    const rows = [0.3, 0.42, 0.54, 0.66, 0.78];
    return (t, p) => {
      const [a1, a2, a3] = acts(p);
      // the sheets behind: the work of others, to start from
      for (let i = 2; i >= 1; i--) { const k = a3 * (1 - i * 0.2); if (k <= 0.01) continue; c.save(); c.translate(cx + i * sw * 0.16, cy - i * 6); c.rotate(i * 0.05); P.stroke(FOAM, 0.35 * k, 1.2); P.fill(FOAM, 0.03 * k); c.beginPath(); c.rect(-sw / 2, -sh / 2, sw, sh); c.fill(); c.stroke(); c.restore(); }
      P.stroke(FOAM, 0.85, 1.5); P.fill(FOAM, 0.06); c.beginPath(); c.rect(x0, y0, sw, sh); c.fill(); c.stroke();
      // the request as it was said: one line
      P.stroke(FOAM, 0.9, 2); P.line(x0 + sw * 0.1, y0 + sh * 0.13, x0 + sw * (0.1 + 0.5 * (0.5 + 0.5 * Math.min(1, a1 * 2 + 0.5))), y0 + sh * 0.13); P.stroke(FOAM, 0.9, 1.5); if (Math.sin(t * 5) > 0 && a1 < 0.9) P.line(x0 + sw * 0.63, y0 + sh * 0.13 - 6, x0 + sw * 0.63, y0 + sh * 0.13 + 6);
      rows.forEach((ry, i) => {
        const y = y0 + sh * ry, miss = clamp(Math.max(a1, 0.1) * 2 - i * 0.25), got = clamp(a2 * 2.4 - i * 0.3), chk = clamp(a3 * 3 - i * 0.35);
        // what was left out: an empty place for it
        c.setLineDash([3, 5]); P.stroke(SEA, 0.55 * miss * (1 - got * 0.8), 1.1); c.strokeRect(x0 + sw * 0.1, y - sh * 0.035, sw * 0.8, sh * 0.07); c.setLineDash([]);
        // what comes back
        P.stroke(FOAM, 0.75, 1.5); P.grow(x0 + sw * 0.2, y - 3, x0 + sw * (0.72 - (i % 3) * 0.07), y - 3, got); P.stroke(FOAM, 0.4, 1.2); P.grow(x0 + sw * 0.2, y + 4, x0 + sw * (0.55 + (i % 2) * 0.12), y + 4, clamp(got * 1.5 - 0.5));
        if (chk > 0) { P.stroke(TEAL, 0.95, 1.7); P.trace([[x0 + sw * 0.115, y], [x0 + sw * 0.14, y + 4], [x0 + sw * 0.175, y - 5]], chk); }
      });
      fall(t, 0.5);
    };
  },

  // Works: a strong result is laid down; each is held against the bar of its kind; the best lights the way for all
  pearls(E) {
    const P = pen(E), { c, fx, fw, fy, fh } = E, r = rng(131), fall = snow(E, 40, 14), G = ground(E, fy + fh * 0.84, 5, 0.8), breath = bubbles(E, 3, 7), breath2 = bubbles(E, 8, 5);
    const N = E.wide ? 7 : 4, S = Array.from({ length: N }, (_, i) => ({ x: fx + fw * (0.1 + i * 0.8 / (N - 1)), q: (E.wide ? [0.5, 0.82, 0.38, 1, 0.6, 0.72, 0.45] : [0.6, 0.38, 1, 0.8])[i], ph: r() * TAU })), best = S.reduce((a, b) => (b.q > a.q ? b : a));
    return (t, p) => {
      const [a1, a2, a3] = acts(p), sz = Math.min(fw / (N * 2.6), fh * 0.13), barY = fy + fh * lerp(0.9, 0.46, a2);
      G.draw(0.06, 0.4);
      for (const s of S) {
        const y = G.at(s.x) - 2, open = ease(clamp(Math.max(a1, 0.25) * 1.6 - (s.x - fx) / fw * 0.6)), py = y - sz * 0.5 - (s === best ? a3 * fh * 0.4 : 0), above = py < barY && a2 > 0.05;
        // the shell, and its lid
        P.stroke(FOAM, 0.8, 1.4); P.fill(FOAM, 0.07); c.beginPath(); c.arc(s.x, y, sz, 0, Math.PI); c.closePath(); c.fill(); c.stroke();
        c.save(); c.translate(s.x - sz, y); c.rotate(-open * 1.05); c.beginPath(); c.arc(sz, 0, sz, Math.PI, 0); c.closePath(); c.fill(); c.stroke(); P.stroke(FOAM, 0.3, 1); for (let k = 1; k < 5; k++) { const a = Math.PI + k * Math.PI / 5; P.line(sz, 0, sz + Math.cos(a) * sz, Math.sin(a) * sz); } c.restore();
        // the pearl: how strong it is
        const glow = open * (0.25 + (above ? 0.75 * s.q : 0.1)) * (0.85 + 0.15 * Math.sin(t * 1.5 + s.ph));
        if (s === best && a3 > 0.02) { P.stroke(SUN, 0.35 * a3, 1); for (const o of S) if (o !== s) P.grow(s.x, py, o.x, G.at(o.x) - sz * 0.6, a3); }
        P.lamp(s.x, py, sz * 0.3 * (0.7 + s.q * 0.5), s === best && a3 > 0.3 ? SUN : FOAM, glow + (s === best ? a3 * 0.5 : 0));
      }
      breath(S[0].x, G.at(S[0].x) - sz, t, fh * 0.55, 0.8); breath2(S[N - 1].x, G.at(S[N - 1].x) - sz, t + 2, fh * 0.4, 0.7);
      // the bar of the kind
      if (a2 > 0.02 && a3 < 0.98) { c.setLineDash([6, 6]); P.stroke(SEA, 0.6 * a2 * (1 - a3), 1.2); P.line(fx, barY, fx + fw, barY); c.setLineDash([]); }
      fall(t, 0.6);
    };
  },

  // Earn: shells settle where work was paid; two paths carry them today
  shells(E) {
    const P = pen(E), { c, fx, fw, fy, fh } = E, r = rng(141), fall = snow(E, 36, 15), G = ground(E, fy + fh * 0.86, 9, 0.9);
    const S = Array.from({ length: 16 }, () => ({ x: fx + r() * fw, o: r(), s: 4 + r() * 4, v: 0.03 + r() * 0.03 }));
    const shell = (x, y, s, a, color) => { P.stroke(color, a, 1.2); c.beginPath(); c.arc(x, y, s, Math.PI, 0); c.closePath(); c.stroke(); for (const d of [-0.6, 0, 0.6]) P.line(x, y, x + Math.sin(d) * s * 0.95, y - Math.cos(d) * s * 0.95); };
    return (t) => {
      G.draw(0.06, 0.4);
      for (const s of S) { const k = (s.o + t * s.v) % 1, y = lerp(fy - 10, G.at(s.x) - 2, Math.min(1, k * 1.4)); shell(s.x + Math.sin(k * 9 + s.o * 7) * 8 * (1 - Math.min(1, k * 1.4)), y, s.s, k > 0.72 ? 0.9 * (1 - span(k, 0.92, 1)) : 0.6, k > 0.72 ? SUN : FOAM); }
      for (const [x0, x1, yk] of [[0.08, 0.5, 0.36], [0.92, 0.5, 0.52]]) { const ax = fx + fw * x0, bx = fx + fw * x1, y = fy + fh * yk; c.setLineDash([2, 7]); P.stroke(SUN, 0.4, 1.2); c.beginPath(); c.moveTo(ax, y); c.quadraticCurveTo((ax + bx) / 2, y - 26, bx, fy + fh * 0.78); c.stroke(); c.setLineDash([]); const k = (t * 0.16 + x0) % 1, q = k, x = (1 - q) * (1 - q) * ax + 2 * (1 - q) * q * ((ax + bx) / 2) + q * q * bx, yy = (1 - q) * (1 - q) * y + 2 * (1 - q) * q * (y - 26) + q * q * (fy + fh * 0.78); P.lamp(x, yy, 2.2, SUN, Math.sin(k * Math.PI)); }
      fall(t, 0.6);
    };
  },

  // Why come: an open ring with no gate; agents meet in it; each group finds its place
  compass(E) {
    const P = pen(E), { c, fx, fw, fy, fh } = E, r = rng(151);
    const cx = fx + fw * 0.5, cy = fy + fh * 0.52, R = Math.min(fw, fh) * 0.4, colors = [SEA, TEAL, SUN, VIOLET, FOAM];
    const A = Array.from({ length: 60 }, (_, i) => ({ a: r() * TAU, d: 1.5 + r() * 1.6, g: i % 5, o: r(), v: 0.1 + r() * 0.2 }));
    return (t, p) => {
      const [a1, a2, a3] = acts(p), meet = Math.max(a1, 0.18);
      rays(E, t, 0.8);
      // the ring: open all round, no gate in it
      c.setLineDash([2, 9]); P.stroke(FOAM, 0.55, 1.4); P.ring(cx, cy, R); c.setLineDash([]); P.stroke(FOAM, 0.2, 1); P.ring(cx, cy, R * 0.62); P.ring(cx, cy, R * 0.24);
      for (let i = 0; i < 16; i++) { const a = i / 16 * TAU + t * 0.03, l = i % 4 ? 5 : 12; P.stroke(FOAM, i % 4 ? 0.3 : 0.7, 1.2); P.line(cx + Math.cos(a) * (R + 5), cy + Math.sin(a) * (R + 5), cx + Math.cos(a) * (R + 5 + l), cy + Math.sin(a) * (R + 5 + l)); }
      for (const g of A) {
        // from everywhere, inward; then to the part of the ring that is theirs
        const free = [cx + Math.cos(g.a + t * g.v * 0.2) * R * g.d, cy + Math.sin(g.a + t * g.v * 0.2) * R * g.d * 0.8], ma = g.a + t * g.v, mr = R * (0.12 + g.o * 0.46), met = [cx + Math.cos(ma) * mr, cy + Math.sin(ma) * mr];
        const sa = g.g / 5 * TAU - Math.PI / 2 + (g.o - 0.5) * 0.7 + Math.sin(t * g.v + g.o * 9) * 0.06, sr = R * (0.36 + ((g.o * 7) % 1) * 0.5), own = [cx + Math.cos(sa) * sr, cy + Math.sin(sa) * sr];
        const x = lerp(lerp(free[0], met[0], meet), own[0], a3), y = lerp(lerp(free[1], met[1], meet), own[1], a3);
        P.lamp(x, y, 1.7, a2 > 0.3 ? colors[g.g] : FOAM, 0.55 + 0.4 * g.o);
      }
    };
  },

  // The manifesto: a ship of 1609 on a sea that belongs to no one; four hundred years on, new travellers in its wake
  ship(E) {
    const P = pen(E), { c, w, fx, fw, fy, fh } = E, r = rng(161);
    const sea = fy + fh * 0.62, T = Array.from({ length: 22 }, () => ({ o: r(), y: r(), s: r() }));
    return (t, p) => {
      const [a1, a2, a3] = acts(p), u = E.wide ? Math.min(fw * 0.32, fh * 0.5) : Math.min(fw * 0.5, fh * 0.54), sx = fx + fw * lerp(E.wide ? 0.2 : 0.3, 0.62, ease(span(p, 0, 0.8))), sy = sea + swell(sx, t, 0.8);
      // the sky's light on the water, and the line of the horizon
      rays(E, t, 0.9); P.stroke(FOAM, 0.25, 1); P.line(0, fy + fh * 0.34, w, fy + fh * 0.34);
      // the lines once drawn across the sea: they do not hold
      for (let i = 0; i < 4; i++) { const x = fx + fw * (0.3 + i * 0.2), gone = clamp(a2 * 1.8 - i * 0.25 + (sx > x ? 0.6 : 0)); c.setLineDash([5, 7]); P.stroke(CORAL, 0.6 * (1 - gone) * Math.max(a1, 0.25), 1.3); P.line(x, fy + fh * 0.36, x - fh * 0.12, fy + fh * 0.98); c.setLineDash([]); }
      surface(E, sea, t, 0.8, 0.75);
      // the ship
      c.save(); c.translate(sx, sy); c.rotate((swell(sx + 10, t, 0.8) - swell(sx - 10, t, 0.8)) / 20 * 0.7); c.scale(u / 100, u / 100); c.lineWidth = 1.5 * 100 / u;
      P.stroke(FOAM, 0.9, 1.5 * 100 / u); P.fill(FOAM, 0.10); c.beginPath(); c.moveTo(-58, -14); c.lineTo(-50, 6); c.quadraticCurveTo(0, 16, 46, 6); c.lineTo(66, -12); c.lineTo(40, -9); c.lineTo(-38, -9); c.closePath(); c.fill(); c.stroke();
      for (const [mx, mh, sw2] of [[-28, 78, 24], [4, 96, 30], [34, 70, 22]]) { c.beginPath(); c.moveTo(mx, -9); c.lineTo(mx, -mh); c.stroke(); for (let k = 0; k < 2; k++) { const y1 = -mh + 8 + k * mh * 0.42, y2 = y1 + mh * 0.34, wv = sw2 * (1 - k * 0.12), belly = 7 + Math.sin(t * 1.3 + mx) * 1.5; c.beginPath(); c.moveTo(mx - wv, y1); c.lineTo(mx + wv, y1); c.quadraticCurveTo(mx + wv + belly, (y1 + y2) / 2, mx + wv, y2); c.lineTo(mx - wv, y2); c.quadraticCurveTo(mx - wv + belly, (y1 + y2) / 2, mx - wv, y1); c.fill(); c.stroke(); } }
      c.beginPath(); c.moveTo(66, -12); c.lineTo(92, -26); c.stroke(); c.beginPath(); c.moveTo(4, -96); c.lineTo(18, -104); c.lineTo(4, -108); c.stroke();
      c.restore();
      // its wake; and those who travel in it now
      P.stroke(FOAM, 0.4, 1.1); for (let i = 1; i < 5; i++) { c.beginPath(); c.ellipse(sx - u * 0.5 - i * u * 0.3, sea + 6, u * 0.16 + i * 5, 3 + i, 0, Math.PI, TAU); c.stroke(); }
      for (const g of T) { const k = clamp(a3 * 1.6 - g.o * 0.6); if (k <= 0) continue; const x = sx - u * 0.6 - g.o * fw * 0.5 + ((t * 12 * (0.4 + g.s)) % 40), y = sea + 16 + g.y * fh * 0.3 + Math.sin(t * 1.4 + g.o * 9) * 3; P.lamp(x, y, 1.6, g.s > 0.5 ? TEAL : SEA, k * 0.9); }
    };
  },

  // The check: a website is sounded, and what it publishes itself comes back as marks on the screen
  sonar(E) {
    const P = pen(E), { c, fx, fw, fy, fh } = E, fall = snow(E, 24, 17);
    const cx = fx + fw * 0.5, cy = fy + fh * 0.52, R = Math.min(fw, fh) * 0.44;
    const marks = [['robots.txt', 0.5, 0.62, TEAL], ['llms.txt', 2.1, 0.8, SUN], ['home page', 3.5, 0.45, SEA], ['agent card', 5.2, 0.72, VIOLET]];
    return (t) => {
      const a = (t * 0.7) % TAU;
      for (let i = 1; i <= 4; i++) { P.stroke(FOAM, 0.16 + (i === 4 ? 0.3 : 0), 1.2); P.ring(cx, cy, R * i / 4); }
      P.stroke(FOAM, 0.14, 1); P.line(cx - R, cy, cx + R, cy); P.line(cx, cy - R, cx, cy + R);
      // the sweep
      c.save(); c.translate(cx, cy); c.rotate(a); const g = c.createConicGradient ? c.createConicGradient(-1.2, 0, 0) : null; if (g) { g.addColorStop(0, col(SEA, 0)); g.addColorStop(0.19, col(SEA, 0.30)); g.addColorStop(0.191, col(SEA, 0)); g.addColorStop(1, col(SEA, 0)); c.fillStyle = g; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, R, -1.2, 0); c.closePath(); c.fill(); } P.stroke(SEA, 0.9, 1.4); P.line(0, 0, R, 0); c.restore();
      for (const [name, ma, mr, color] of marks) { const since = ((a - ma + TAU) % TAU) / TAU, f = Math.max(0.22, 1 - since * 1.3), x = cx + Math.cos(ma) * R * mr, y = cy + Math.sin(ma) * R * mr; P.lamp(x, y, 2.6, color, f); P.stroke(color, 0.7 * (1 - since) * (since < 0.4 ? 1 : 0), 1.2); P.ring(x, y, 6 + since * 44); P.text(name, x + (x > cx ? 12 : -12), y - 12, 0.5 + 0.5 * f, 13, x > cx ? 'left' : 'right', color); }
      P.lamp(cx, cy, 2.4, FOAM, 0.9);
      fall(t, 0.5);
    };
  },

  // Buying by need: offers swim by, each with its price tag; the pick carries a light
  tags(E) {
    const P = pen(E), { c, w, fy, fh } = E, r = rng(181), fall = snow(E, 30, 18);
    const T = Array.from({ length: E.wide ? 16 : 10 }, (_, i) => ({ o: r(), y: 0.12 + r() * 0.7, s: 0.8 + r() * 0.5, v: 12 + r() * 16, pick: i % 5 === 2, ph: r() * TAU }));
    return (t) => {
      for (const g of T) { const x = ((g.o * (w + 160) + t * g.v) % (w + 160)) - 80, y = fy + fh * g.y + Math.sin(t * 0.8 + g.ph) * 6, a = Math.sin(t * 0.9 + g.ph) * 0.12;
        c.save(); c.translate(x, y); c.rotate(a); c.scale(g.s, g.s); P.stroke(g.pick ? SUN : FOAM, g.pick ? 0.95 : 0.6, 1.4); P.fill(g.pick ? SUN : FOAM, 0.07); c.beginPath(); c.moveTo(-22, -9); c.lineTo(12, -9); c.lineTo(22, 0); c.lineTo(12, 9); c.lineTo(-22, 9); c.closePath(); c.fill(); c.stroke(); P.ring(13, 0, 2.2); P.stroke(g.pick ? SUN : FOAM, 0.5, 1.2); P.line(-16, -2.5, 2, -2.5); P.line(-16, 3, -4, 3); P.stroke(FOAM, 0.3, 1); c.beginPath(); c.moveTo(22, 0); c.quadraticCurveTo(34, -4, 44, 3 + Math.sin(t * 2 + g.ph) * 3); c.stroke(); c.restore();
        if (g.pick) P.lamp(x - 30 * g.s, y, 2, SUN, 0.6 + 0.4 * Math.sin(t * 2 + g.ph)); }
      fall(t, 0.6);
    };
  },

  // Using the sea: one agent, three doors: a page read as Markdown, the shared brain, a memory that stays
  threads(E) {
    const P = pen(E), { c, fx, fw, fy, fh } = E, fall = snow(E, 28, 19);
    const ax = fx + fw * 0.14, ay = fy + fh * 0.5, ends = [[0.84, 0.2], [0.86, 0.52], [0.82, 0.82]].map(([x, y]) => [fx + fw * x, fy + fh * y]);
    return (t) => {
      rays(E, t, 0.7);
      ends.forEach(([x, y], i) => {
        const mx = (ax + x) / 2, my = (ay + y) / 2 + (i - 1) * 12; P.stroke(FOAM, 0.4, 1.2); c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo(mx, ay, x - 24, y); c.stroke();
        for (const off of [0, 0.5]) { const q = (t * 0.22 + i * 0.3 + off) % 1, back = off ? 1 - q : q, px = (1 - back) * (1 - back) * ax + 2 * (1 - back) * back * mx + back * back * (x - 24), py = (1 - back) * (1 - back) * ay + 2 * (1 - back) * back * ay + back * back * y; P.lamp(px, py, 1.7, off ? TEAL : SEA, Math.sin(q * Math.PI)); }
        P.stroke(FOAM, 0.8, 1.4); P.fill(FOAM, 0.06);
        if (i === 0) { c.beginPath(); c.rect(x - 14, y - 18, 28, 36); c.fill(); c.stroke(); P.stroke(FOAM, 0.5, 1.1); P.line(x - 8, y - 10, x - 5, y - 10); for (let j = 0; j < 4; j++) P.line(x - 8 + (j ? 0 : 6), y - 10 + j * 6, x + 8 - (j === 3 ? 7 : 0), y - 10 + j * 6); }
        if (i === 1) { for (const [dx, dy] of [[0, -14], [-13, 4], [13, 6], [0, 16]]) { P.stroke(SEA, 0.4, 1); P.line(x, y, x + dx, y + dy); P.lamp(x + dx, y + dy, 1.8, SUN, 0.6 + 0.4 * Math.sin(t * 2 + dx)); } P.lamp(x, y, 2.4, FOAM, 0.9); }
        if (i === 2) { c.beginPath(); c.rect(x - 16, y - 13, 32, 26); c.fill(); c.stroke(); P.stroke(FOAM, 0.5, 1.1); P.line(x - 16, y - 4, x + 16, y - 4); P.line(x - 16, y + 5, x + 16, y + 5); P.lamp(x + 9, y - 8.5, 1.5, TEAL, 0.6 + 0.4 * Math.sin(t * 3)); }
      });
      P.stroke(FOAM, 0.85, 1.5); P.ring(ax, ay, 15); P.lamp(ax, ay, 3.2, SEA, 1);
      fall(t, 0.6);
    };
  },

  // The index: every server, agent and paid door has its place on the shelves; a light goes along them and finds what is asked for
  index(E) {
    const P = pen(E), { c, fx, fw, fy, fh } = E, r = rng(171), fall = snow(E, 30, 16);
    const cols = E.wide ? 12 : 8, gx = fw / cols, rows = Math.max(3, Math.min(E.wide ? 6 : 7, Math.floor(fh * 0.9 / (gx * 1.12)))), gy = gx * 1.12, y0 = fy + (fh - gy * rows) * 0.5, s = gx * 0.27;
    const cells = []; for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) cells.push({ x: fx + (i + 0.5) * gx, y: y0 + (j + 0.5) * gy, k: r(), ph: r() * TAU, hit: r() > 0.84, kind: r() });
    return (t, p) => {
      const [a1, a2, a3] = acts(p), full = 0.4 + 0.6 * a1, sx = fx + fw * (((t * 0.11) % 1.3) - 0.15);
      // the shelves
      P.stroke(FOAM, 0.2, 1); for (let j = 1; j <= rows; j++) P.line(fx, y0 + j * gy - gy * 0.08, fx + fw, y0 + j * gy - gy * 0.08);
      // the light that goes along them
      if (a2 > 0.02) { const g = c.createLinearGradient(sx - gx * 1.7, 0, sx + gx * 1.7, 0); g.addColorStop(0, col(SUN, 0)); g.addColorStop(0.5, col(SUN, 0.15 * a2)); g.addColorStop(1, col(SUN, 0)); c.fillStyle = g; c.fillRect(sx - gx * 1.7, y0 - 4, gx * 3.4, gy * rows + 4); }
      for (const q of cells) {
        if (q.k > full) continue;
        const near = Math.max(0, 1 - Math.abs(q.x - sx) / (gx * 1.7)) * a2, lit = q.hit ? Math.max(a3, near) : 0, color = lit > 0.05 ? SUN : FOAM;
        // an entry: a card on its shelf, and the small light of its kind
        P.stroke(color, 0.4 + 0.25 * near + 0.45 * lit, 1.2); P.fill(color, 0.05 + 0.13 * lit); c.beginPath(); c.rect(q.x - s, q.y - s * 1.2, s * 2, s * 2.3); c.fill(); c.stroke();
        P.stroke(color, 0.32 + 0.3 * lit, 1); P.line(q.x - s * 0.55, q.y - s * 0.6, q.x + s * 0.55, q.y - s * 0.6); P.line(q.x - s * 0.55, q.y - s * 0.15, q.x + s * 0.15, q.y - s * 0.15);
        P.lamp(q.x, q.y + s * 0.55, lit > 0.05 ? 2 : 1.2, lit > 0.05 ? SUN : q.kind > 0.7 ? TEAL : q.kind > 0.35 ? SEA : VIOLET, lit > 0.05 ? lit * (0.75 + 0.25 * Math.sin(t * 2 + q.ph)) : 0.4 + 0.25 * Math.sin(t + q.ph));
      }
      fall(t, 0.5);
    };
  },

  // The ground everything rests on: an anchor, and its chain going up
  anchor(E) {
    const P = pen(E), { c, fx, fw, fy, fh } = E, fall = snow(E, 46, 20), G = ground(E, fy + fh * 0.84, 3, 1);
    const x = fx + fw * 0.5, s = Math.min(fw, fh) * 0.2;
    return (t) => {
      G.draw(0.07, 0.42);
      const y = G.at(x) - s * 1.35, sway = Math.sin(t * 0.5) * 0.05;
      // the chain
      P.stroke(FOAM, 0.55, 1.3); for (let i = 0; i < 16; i++) { const k = i / 16, cxk = x + Math.sin(k * 3 + t * 0.6) * s * 0.3 * k, cyk = y - s * 0.5 - k * (fh * 0.9); c.beginPath(); c.ellipse(cxk, cyk, i % 2 ? 2.4 : 4.4, i % 2 ? 5.4 : 3, sway * 6 * k, 0, TAU); c.stroke(); }
      c.save(); c.translate(x, y + s * 0.6); c.rotate(sway); c.translate(0, -s * 0.6);
      P.stroke(FOAM, 0.9, 2); P.ring(0, -s * 0.38, s * 0.13); P.line(0, -s * 0.25, 0, s * 1.05); P.line(-s * 0.34, -s * 0.02, s * 0.34, -s * 0.02);
      c.beginPath(); c.moveTo(-s * 0.72, s * 0.5); c.quadraticCurveTo(-s * 0.6, s * 1.12, 0, s * 1.08); c.quadraticCurveTo(s * 0.6, s * 1.12, s * 0.72, s * 0.5); c.stroke();
      for (const d of [-1, 1]) { c.beginPath(); c.moveTo(d * s * 0.86, s * 0.66); c.lineTo(d * s * 0.72, s * 0.42); c.lineTo(d * s * 0.56, s * 0.64); c.stroke(); }
      c.restore();
      fall(t, 0.7);
    };
  },
};

/* ---------- putting a scene on its page ---------- */
export function mount(el, state) {
  const make = SCENES[el.dataset.scene] || SCENES.snow, cv = document.createElement('canvas'), c = cv.getContext('2d');
  if (!c) return;
  el.appendChild(cv);
  // a line is drawn twice: wide and faint under itself, so that it glows like something lit in water
  const stroke0 = c.stroke.bind(c), rect0 = c.strokeRect.bind(c);
  const halo = (go) => { const lw = c.lineWidth, a = c.globalAlpha; if (lw <= 3.2 && !state.lite) { c.lineWidth = lw * 4 + 2.5; c.globalAlpha = a * 0.14; go(); c.lineWidth = lw; c.globalAlpha = a; } go(); };
  c.stroke = (path) => halo(() => (path ? stroke0(path) : stroke0()));
  c.strokeRect = (x, y, ww, hh) => halo(() => rect0(x, y, ww, hh));
  let draw = null, w = 0, h = 0, seen = true, raf = 0, last = -1, tx = 0, ty = 0;
  const zone = Number(document.documentElement.dataset.zone || 3);
  function size() {
    const r = el.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2, Math.max(1, Math.sqrt(2.2e6 / Math.max(1, r.width * r.height))));
    if (!r.width || !r.height || (Math.abs(r.width - w) < 1 && Math.abs(r.height - h) < 1 && draw)) return;
    w = r.width; h = r.height; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    // where the picture stands: beside the words on a wide screen; on a narrow one above them, down to where they begin
    const wide = w >= 900, said = document.querySelector('.said'), sr = said && said.getBoundingClientRect();
    const fx = wide ? w * 0.5 : w * 0.07, fw = wide ? w * 0.46 : w * 0.86, fy = wide ? h * 0.16 : Math.min(h * 0.2, 76);
    const fh = (wide || !sr ? h * 0.84 : clamp(sr.top - r.top - 8, h * 0.5, h * 0.96)) - fy;
    draw = make({ c, w, h, wide, fx, fy, fw, fh, zone });
    last = -1;
  }
  const t0 = performance.now();
  function frame(now) {
    raf = 0; if (!draw) return;
    // a told place follows the reader's scroll; any other place tells its scene itself, once, as the reader arrives, and then stands
    const t = state.calm ? 40 : (now - t0) / 1000, p = state.calm ? 1 : state.story ? state.p : ease(clamp((t - 0.7) / 6.5));
    c.clearRect(0, 0, w, h); c.lineJoin = 'round';
    try { draw(t, p); } catch (e) { console.error('scene', el.dataset.scene, e); draw = null; return; }
    if (!el.classList.contains('live')) el.classList.add('live');
    // the picture has depth: it leans a little with the reader's hand, and with the speed of the dive
    if (!state.calm) { const gx = (state.px || 0) + Math.sin(t * 0.23) * 0.12, gy = (state.py || 0) + Math.cos(t * 0.19) * 0.1 - clamp((state.v || 0) / 40, -1, 1) * 0.9; tx += (gx - tx) * 0.06; ty += (gy - ty) * 0.06; cv.style.transform = `perspective(1100px) translate3d(${(-tx * 10).toFixed(2)}px,${(-ty * 7).toFixed(2)}px,0) rotateY(${(tx * 3.2).toFixed(3)}deg) rotateX(${(-ty * 2.6).toFixed(3)}deg) scale(1.05)`; }
    if (!state.calm && seen && !document.hidden) raf = requestAnimationFrame(frame);
  }
  const go = () => { if (!raf && draw) raf = requestAnimationFrame(frame); };
  size(); go();
  if ('ResizeObserver' in window) new ResizeObserver(() => { size(); go(); }).observe(el); else addEventListener('resize', () => { size(); go(); });
  if ('IntersectionObserver' in window) new IntersectionObserver((es) => { seen = es[0].isIntersecting; if (seen) go(); }).observe(el);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) go(); });
}
export const names = Object.keys(SCENES);

// The sea itself, behind the whole page. Far: the water and its light, computed for every point (shafts and a net of
// light where the sun still reaches, clouds of living light in the deep), darker the further down the page the reader
// is. Nearer: what drifts in the water at many distances, each passing at the speed of its distance, so that scrolling
// is diving. When a new part of the page comes into view a school crosses along its heading, the way the eye should go.
const FRAG = `precision mediump float;uniform vec2 r;uniform float t,d,z;uniform vec3 a,b;uniform vec2 m;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,k=.5;for(int i=0;i<4;i++){v+=k*n(p);p=p*2.03+7.1;k*=.5;}return v;}
void main(){vec2 uv=gl_FragCoord.xy/r;uv.y=1.-uv.y;float asp=r.x/r.y;vec2 q=vec2(uv.x*asp,uv.y);
float k=clamp(uv.y*.7+d*.95,0.,1.);vec3 c=mix(a,b,smoothstep(0.,1.,k));
float light=clamp(1.-z/4.2,0.,1.)*(1.-smoothstep(0.,.45,d)*.78);
float ang=(q.x-.64*asp-m.x*.06)/(uv.y+.5);
float rays=fbm(vec2(ang*3.1+t*.035,t*.05))*fbm(vec2(ang*8.5-t*.02,3.));
c+=vec3(.46,.76,1.)*rays*light*.42*pow(1.-uv.y*.9,1.5);
vec2 w=q*5.2+vec2(t*.05,t*.03);float ca=abs(sin(w.x+fbm(w)*4.+t*.3)*sin(w.y*1.2+fbm(w+3.)*4.-t*.25));ca=pow(1.-ca,7.);
c+=vec3(.55,.85,1.)*ca*light*.05*(1.-uv.y*.9);
float deep=clamp((z-1.5)/3.,0.,1.);float neb=smoothstep(.5,.92,fbm(q*1.5+vec2(t*.012+m.x*.03,-t*.02+d*1.6)));
c+=mix(vec3(.08,.50,.46),vec3(.36,.28,.72),fbm(q*.8+9.))*neb*deep*.3;
float sh=.36*(1.-smoothstep(0.,.3,d))*light;float yy=sh-uv.y;
if(yy>0.){float pz=.1/(yy+.012);vec2 pl=vec2((uv.x-.5)*asp*pz*2.2,pz);float rp=fbm(vec2(pl.x*1.4+t*.08,pl.y*1.4-t*.22));float rp2=fbm(pl*3.1+vec2(-t*.1,t*.3));
c+=vec3(.62,.86,1.)*(pow(rp,3.)*1.5+pow(rp2,5.)*1.2)*smoothstep(0.,.07,yy)*exp(-pz*.11)*.75;}
float gh=1.-.34*smoothstep(.5,1.,d)*clamp((z-3.5)/1.5,0.,1.);float gy=uv.y-gh;
if(gy>0.){float pz=.1/(gy+.012);vec2 pl=vec2((uv.x-.5)*asp*pz*2.2+m.x*.2,pz+d*3.);float du=fbm(pl*1.1);float gl=step(.972,h(floor(pl*7.)))*(.5+.5*sin(t*1.7+pl.x*9.));
c=mix(c,c*.55+vec3(.06,.16,.2)*du,smoothstep(0.,.05,gy)*.8);c+=vec3(.2,.85,.72)*gl*exp(-pz*.16)*.5*smoothstep(0.,.04,gy);c+=vec3(.25,.5,.6)*smoothstep(.012,0.,abs(gy))*.25;}
c*=1.-.34*pow(length((uv-.5)*vec2(1.,1.1)),2.2);c+=(h(gl_FragCoord.xy+fract(t))-.5)*.014;
gl_FragColor=vec4(c,1.);}`;
export function mountSea(state) {
  const H = document.documentElement, zone = Number(H.dataset.zone || 3), host = document.createElement('div');
  host.className = 'sea'; host.setAttribute('aria-hidden', 'true'); document.body.prepend(host);
  const hex = (v, d) => { const m = /#([0-9a-f]{6})/i.exec(v || ''); const n = m ? parseInt(m[1], 16) : d; return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
  const css = getComputedStyle(H), ca = hex(css.getPropertyValue('--a'), 0x0b3a66), cb = hex(css.getPropertyValue('--b'), 0x041428);
  // (?sea=full shows the whole sea whatever the machine: for looking at it on one that has no graphics chip)
  const full = /[?&]sea=full\b/.test(location.search);
  // far: the water
  let gl = null, u = null; const wc = document.createElement('canvas'); wc.className = 'water';
  try {
    gl = wc.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power', failIfMajorPerformanceCaveat: !full });
    // a machine that would compute the water on its processor (no graphics chip at work) keeps the still water of the page
    if (gl) { const dbg = gl.getExtension('WEBGL_debug_renderer_info'), name = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : ''; if (!full && /swiftshader|llvmpipe|software|basic render/i.test(name)) gl = null; }
    if (gl) {
      const sh = (type, src) => { const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
      const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}')); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error('link'); gl.useProgram(pr);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      u = Object.fromEntries(['r', 't', 'd', 'z', 'a', 'b', 'm'].map((k) => [k, gl.getUniformLocation(pr, k)]));
      gl.uniform3fv(u.a, ca); gl.uniform3fv(u.b, cb); gl.uniform1f(u.z, zone); host.appendChild(wc);
      wc.addEventListener('webglcontextlost', (e) => { e.preventDefault(); gl = null; wc.remove(); });
    }
  } catch (e) { gl = null; }
  // nearer: what drifts in it
  const cv = document.createElement('canvas'), c = cv.getContext('2d'); if (!c) return; host.appendChild(cv);
  const sprite = (rgb) => { const o = document.createElement('canvas'); o.width = o.height = 64; const g = o.getContext('2d'), q = g.createRadialGradient(32, 32, 0, 32, 32, 32); q.addColorStop(0, `rgba(${rgb},1)`); q.addColorStop(0.25, `rgba(${rgb},.55)`); q.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = q; g.fillRect(0, 0, 64, 64); return o; };
  const SP = [sprite(FOAM), sprite(zone >= 3 ? TEAL : SEA), sprite(zone >= 4 ? VIOLET : FOAM)];
  let w = 0, h = 0, dpr = 1, ly = scrollY, v = 0, mx = 0, my = 0, sx = 0, sy = 0, n = 0;
  const r = rng(7), S = Array.from({ length: 110 }, () => ({ x: r(), y: r(), z: 0.1 + Math.pow(r(), 1.7) * 0.9, ph: r() * TAU, k: r() }));
  const schools = [];
  state.pulse = (y, de) => { if (state.calm || schools.length > 2) return; const q = rng(Math.round(y + scrollY) + 3), dir = de ? -1 : 1; schools.push({ y: y + scrollY, t0: performance.now(), dir, F: Array.from({ length: w < 700 ? 9 : 14 }, (_, i) => ({ dx: q() * 0.34, dy: (q() - 0.5) * 58, s: 0.8 + q() * 0.9, ph: q() * TAU })) }); };
  const size = () => { w = innerWidth; h = innerHeight; dpr = 1; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); c.setTransform(dpr, 0, 0, dpr, 0, 0); if (gl) { const k = w < 700 ? 0.5 : 0.4; wc.width = Math.max(2, Math.round(w * k)); wc.height = Math.max(2, Math.round(h * k)); gl.viewport(0, 0, wc.width, wc.height); gl.uniform2f(u.r, wc.width, wc.height); } };
  addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { mx = e.clientX / w * 2 - 1; my = e.clientY / h * 2 - 1; } }, { passive: true });
  // a machine that cannot keep up gets a quieter sea: first the water moves more slowly and less drifts, then the water stands
  // (it starts quiet and grows richer while the machine keeps up: level 2 quiet, 1 moving, 0 full)
  const t0 = performance.now(); let raf = 0, prev = 0, slow = 16, level = full ? 0 : 2, since = 0, fell = 0; state.lite = !full;
  function frame(now) {
    raf = 0; n++; if (prev && !full) { const dt = now - prev; if (dt < 250) { slow += (dt - slow) * 0.06; since++; if (since > 36 && slow > 25 && level < 2) { level++; since = 0; fell++; } else if (since > 45 && slow < 19.5 && level > 0 && fell < 2) { level--; since = 0; } state.lite = level === 2; } } prev = now;
    const t = state.calm ? 30 : (now - t0) / 1000, y = scrollY, max = Math.max(1, H.scrollHeight - h), d = clamp(y / max);
    v += ((y - ly) - v) * 0.22; ly = y; sx += (mx - sx) * 0.05; sy += (my - sy) * 0.05; state.v = v; state.px = sx; state.py = sy;
    if (gl && (state.calm || n === 1 || (level < 2 && n % (level ? 4 : 2) === 0))) { gl.uniform1f(u.t, t); gl.uniform1f(u.d, d); gl.uniform2f(u.m, sx, sy); gl.drawArrays(gl.TRIANGLES, 0, 3); }
    if (level && n % 2 && !schools.length) { if (!document.hidden) raf = requestAnimationFrame(frame); return; }
    c.clearRect(0, 0, w, h);
    const count = Math.round((w < 700 ? 48 : S.length) * (level === 2 ? 0.45 : level ? 0.7 : 1)), stretch = Math.min(Math.abs(v), 60);
    for (let i = 0; i < count; i++) {
      const q = S[i], f = 1 / q.z, near = q.z < 0.26, size = near ? 9 + (0.26 - q.z) * 150 : Math.max(1.6, 2.6 * f * 0.55);
      const X = ((q.x * (w + 120) + Math.sin(t * 0.21 + q.ph) * 9 * f * 0.3 - sx * 14 * f) % (w + 120) + (w + 120)) % (w + 120) - 60;
      const Y = ((q.y * (h + 160) - y * 0.07 * f + t * (3 + q.k * 6) * f * 0.3 - sy * 9 * f) % (h + 160) + (h + 160)) % (h + 160) - 80;
      c.globalAlpha = near ? 0.06 + q.k * 0.07 : Math.min(0.75, 0.16 + q.k * 0.3 + (1 - q.z) * 0.2);
      const hh = size * (1 + stretch * 0.05 * Math.min(f, 5));
      c.drawImage(SP[near ? 2 : q.k > 0.62 ? 1 : 0], X - size / 2, Y - hh / 2, size, hh);
    }
    c.globalAlpha = 1;
    // a school crosses along a heading that has just come into view
    for (let i = schools.length - 1; i >= 0; i--) {
      const s = schools[i], k = (now - s.t0) / 3100; if (k >= 1) { schools.splice(i, 1); continue; }
      for (const f of s.F) { const kk = k * 1.34 - f.dx, x = s.dir > 0 ? lerp(-40, w + 40, kk) : lerp(w + 40, -40, kk), yy = s.y - y - 34 + f.dy * 0.5 + Math.sin(kk * 9 + f.ph) * 7, a = Math.sin(clamp(kk) * Math.PI) * 0.75; if (a <= 0.01) continue;
        c.save(); c.translate(x, yy); c.scale(s.dir * f.s, f.s); c.fillStyle = col(zone >= 3 ? TEAL : FOAM, a); c.beginPath(); c.ellipse(0, 0, 7.5, 2.6, 0, 0, TAU); c.fill(); const wag = Math.sin(now / 90 + f.ph) * 1.8; c.beginPath(); c.moveTo(-6, 0); c.lineTo(-12, -3 + wag); c.lineTo(-12, 3 + wag); c.closePath(); c.fill(); c.restore();
        if (zone >= 3) { c.globalAlpha = a * 0.5; c.drawImage(SP[1], x - 9, yy - 9, 18, 18); c.globalAlpha = 1; } }
    }
    if (!host.classList.contains('live')) host.classList.add('live');
    if (!state.calm && !document.hidden) raf = requestAnimationFrame(frame);
  }
  const go = () => { if (!raf) raf = requestAnimationFrame(frame); };
  size(); go(); addEventListener('resize', () => { size(); go(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) go(); });
}
