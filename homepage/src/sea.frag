#version 300 es
// Mare Liberum: one vertical cut through the sea, locked to the document.
// Every pixel knows its place in the page (y = scroll + screen y), so the water column
// and the text that stands in it can never drift apart. Units are CSS pixels.
precision highp float;
out vec4 o;
uniform vec2 uRes;       // drawing buffer, device px
uniform vec2 uView;      // viewport, css px
uniform float uScroll;   // css px
uniform float uTime;     // seconds
uniform float uHz;       // document y of the horizon
uniform float uWl;       // document y of the waterline
uniform float uBed;      // document y of the seabed
uniform vec3 uSun;       // x, document y, radius
uniform float uStopY[7]; // where each zone begins
uniform vec3 uStopC[7];  // the colour of the water there
uniform vec4 uLight[16]; // city lights: x, top y, height, warmth
uniform int uNL;
uniform float uVel;      // how fast the diver moves, css px per second
uniform float uQ;        // quality 0..1
uniform vec3 uPtr;       // lamp: x, document y, strength
uniform float uAmp;      // how rough the waterline is: it splashes when the diver moves fast

float hash21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 hash23(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yzz) * p3.zyx); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; } return s; }

// the waterline: mirrored in JavaScript (waveAt) so the wordmark is cut by the same curve
float wave(float x, float t){ return uAmp * (4.0 * sin(x * 0.011 + t * 0.80) + 2.4 * sin(x * 0.027 - t * 1.25 + 1.7) + 1.1 * sin(x * 0.063 + t * 2.05 + 0.4)); }
// the seabed: mirrored in JavaScript (ridgeAt) so the city stands on it
float ridge(float x){ return uBed - (38.0 * sin(x * 0.0045 + 1.3) + 22.0 * sin(x * 0.011 + 4.1) + 9.0 * sin(x * 0.031 + 0.6)); }

// drifting particles on a grid: one lookup per layer, stretched into streaks while the diver moves
float motes(float x, float y, float cell, float par, float drift, float seed, float stretch){
  vec2 p = vec2(x + sin(y * 0.004 + seed) * 14.0, y * par - uTime * drift) / cell;
  vec2 id = floor(p), f = fract(p);
  vec3 r = hash23(id + seed);
  vec2 d = (f - (0.28 + 0.44 * r.xy)) * cell; d.y /= stretch;
  float rad = 0.6 + 1.5 * r.z;
  float tw = 0.55 + 0.45 * sin(uTime * (0.6 + r.z * 1.7) + r.x * 40.0);
  return smoothstep(rad + 0.9, rad - 0.3, length(d)) * tw * step(0.42, r.y * 0.6 + r.z * 0.6);
}

// air on its way back up: rings with a glint, only near the surface
float bubbles(float x, float y, float cell, float par, float rise, float seed){
  vec2 p = vec2(x + sin(y * 0.02 + uTime * 1.3 + seed) * 5.0, y * par + uTime * rise) / cell;
  vec2 id = floor(p), f = fract(p);
  vec3 r = hash23(id + seed);
  vec2 d = (f - (0.3 + 0.4 * r.xy)) * cell;
  float rad = 1.5 + 4.4 * r.z * r.z, dl = length(d);
  float ring = smoothstep(rad + 1.0, rad, dl) * smoothstep(rad - 2.3, rad - 0.7, dl);
  float glint = smoothstep(1.3, 0.2, length(d + vec2(rad * 0.38)));
  return (ring * 0.65 + glint * 0.55) * step(0.6, r.y);
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float x = uv.x * uView.x;
  float y = uScroll + (1.0 - uv.y) * uView.y;
  float t = uTime, vh = min(uView.y, 1100.0);
  float wl = uWl + wave(x, t);
  vec3 col;

  if (y < uHz) {
    // ---- air: a high-key dawn, bright enough that ink always reads on it ----
    float k = clamp((uHz - y) / max(uHz, 1.0), 0.0, 1.0);
    vec3 top = vec3(0.835, 0.906, 0.953), mid = vec3(0.930, 0.945, 0.950), hor = vec3(1.0, 0.895, 0.765);
    col = mix(hor, mid, smoothstep(0.0, 0.36, k));
    col = mix(col, top, smoothstep(0.30, 1.0, k));
    float veil = fbm(vec2(x * 0.0017 + t * 0.006, y * 0.0075));
    col = mix(col, vec3(1.0, 0.975, 0.94), smoothstep(0.50, 0.86, veil) * 0.42 * smoothstep(0.02, 0.5, k));
    vec2 sd = vec2(x - uSun.x, y - uSun.y); float d = length(sd);
    col += vec3(1.0, 0.56, 0.16) * exp(-d / (uSun.z * 3.4)) * 0.34;
    col = mix(col, vec3(1.0, 0.975, 0.90), exp(-d / (uSun.z * 1.35)) * 0.62);
    vec3 sunc = mix(vec3(1.0, 0.74, 0.30), vec3(1.0, 0.94, 0.74), smoothstep(uSun.z, 0.0, d));
    col = mix(col, sunc, smoothstep(uSun.z + 1.2, uSun.z - 1.2, d));
    col = min(col, vec3(1.0));
  } else if (y < wl) {
    // ---- the surface, seen from above, running out to the horizon ----
    float span = max(uWl - uHz, 1.0);
    float k = clamp((y - uHz) / span, 0.0, 1.0);
    float z = 1.0 / (k * 0.96 + 0.035);
    vec2 w = vec2((x - uView.x * 0.5) * z * 0.0034, z * 1.6);
    float tt = t * 0.55;
    vec2 g = vec2(0.0);
    float ph;
    ph = dot(vec2( 0.08, 1.00), w) *  5.0 + tt * 1.6; g += 0.50 *  5.0 * vec2( 0.08, 1.00) * cos(ph);
    ph = dot(vec2(-0.25, 0.97), w) *  8.3 + tt * 2.1; g += 0.30 *  8.3 * vec2(-0.25, 0.97) * cos(ph);
    ph = dot(vec2( 0.45, 0.89), w) * 13.1 + tt * 2.9; g += 0.18 * 13.1 * vec2( 0.45, 0.89) * cos(ph);
    ph = dot(vec2(-0.60, 0.80), w) * 21.0 + tt * 3.7; g += 0.11 * 21.0 * vec2(-0.60, 0.80) * cos(ph);
    ph = dot(vec2( 0.20, 0.98), w) * 34.0 + tt * 4.6; g += 0.07 * 34.0 * vec2( 0.20, 0.98) * cos(ph);
    float chop = vnoise(w * vec2(9.0, 26.0) + vec2(tt * 0.8, -tt * 2.2));
    float slope = g.y * 0.13;
    vec3 far = vec3(0.965, 0.905, 0.835), near = vec3(0.565, 0.765, 0.875);
    vec3 sea = mix(far, near, smoothstep(0.0, 0.9, pow(k, 0.62)));
    sea += vec3(0.060, 0.066, 0.070) * slope * (0.30 + 1.1 * k);
    float sx = x - uSun.x;
    float roadw = uSun.z * (0.85 + 6.5 * k);
    float road = exp(-(sx * sx) / (roadw * roadw));
    float sp = smoothstep(0.58, 0.97, 0.5 + 0.5 * sin(slope * 4.4 + chop * 6.2831));
    float glint = clamp(road * (0.22 + sp * (0.45 + 0.75 * chop)), 0.0, 1.0);
    sea = mix(sea, vec3(1.0, 0.925, 0.72), glint * (1.0 - 0.30 * k));
    sea += vec3(1.0, 0.97, 0.90) * sp * chop * 0.045 * (1.0 - k);
    sea = mix(sea, vec3(1.0, 0.915, 0.80), exp(-k * 30.0) * 0.92);
    // the wave that is about to be cut by the glass
    sea *= 1.0 - 0.10 * smoothstep(0.72, 1.0, k);
    col = min(sea, vec3(1.0));
  } else {
    // ---- under water: colour by depth, light from above, life in the dark ----
    float dpx = y - uWl;
    vec3 c = uStopC[0];
    for (int i = 0; i < 6; i++) c = mix(c, uStopC[i + 1], smoothstep(uStopY[i], uStopY[i + 1], y));
    float sxn = (x - uSun.x) / uView.x;
    float lit = exp(-dpx / (vh * 0.95));
    float snell = exp(-sxn * sxn * 9.0) * exp(-dpx / (vh * 0.42));
    c += vec3(0.012, 0.052, 0.088) * lit;
    c += vec3(0.18, 0.50, 0.74) * snell * 0.30;
    if (dpx < vh * 4.0) {
      vec2 rp = vec2(x - uSun.x, dpx + vh * 0.14);
      float ang = rp.x / rp.y;
      float sh = vnoise(vec2(ang * 7.0 + t * 0.05, 1.7)) * 0.6 + vnoise(vec2(ang * 19.0 - t * 0.08, 4.2)) * 0.4;
      sh = smoothstep(0.42, 0.86, sh);
      c += vec3(0.11, 0.40, 0.62) * sh * exp(-dpx / (vh * 1.15)) * exp(-ang * ang * 1.5) * 0.40;
      // the underside of the surface, bright and restless
      float us = exp(-(y - wl) / (11.0 + 5.0 * sin(x * 0.021 + t * 0.9)));
      float net = vnoise(vec2(x * 0.045 + t * 0.35, dpx * 0.11 - t * 0.5));
      c += vec3(0.36, 0.70, 0.90) * us * (0.20 + 0.34 * net);
    }
    if (dpx < vh * 1.6 && uQ > 0.5) c += vec3(0.62, 0.86, 0.98) * (bubbles(x, y, 124.0, 0.80, 46.0, 5.5) + bubbles(x, y, 71.0, 0.95, 70.0, 17.9) * 0.6) * exp(-dpx / (vh * 0.55)) * 0.55;
    // the depth lines of the chart: where one zone ends and the next begins
    float iso = 0.0; for (int i = 2; i < 6; i++) iso += exp(-abs(y - uStopY[i]) / 0.75);
    c += vec3(0.50, 0.72, 0.90) * iso * 0.17;
    // marine snow: brightest where there is light to catch, stretched while diving
    float stretch = 1.0 + min(abs(uVel) * 0.012, 7.0);
    float sn = motes(x, y, 96.0, 0.72, 5.0, 3.1, stretch) * 0.50 + motes(x, y, 58.0, 0.88, 8.0, 11.7, stretch) * 0.34;
    if (uQ > 0.5) sn += motes(x, y, 34.0, 1.06, 12.0, 23.3, stretch) * 0.22;
    c += vec3(0.62, 0.84, 0.95) * sn * (0.16 + 0.55 * lit);
    // living light below the reach of the sun
    float deep = smoothstep(uStopY[2], uStopY[4], y);
    if (deep > 0.0) {
      vec2 p = vec2(x + sin(y * 0.002 + t * 0.2) * 30.0, y * 0.94 - t * 3.0) / 210.0;
      vec2 id = floor(p), f = fract(p);
      vec3 r = hash23(id + 7.7);
      vec2 dd = (f - (0.25 + 0.5 * r.xy)) * 210.0;
      float dl = length(dd);
      float beat = 0.5 + 0.5 * sin(t * (0.35 + r.z * 0.9) + r.x * 30.0);
      vec3 hue = r.z < 0.55 ? vec3(0.31, 0.89, 0.76) : (r.z < 0.85 ? vec3(0.50, 0.83, 1.0) : vec3(0.71, 0.61, 1.0));
      c += hue * (smoothstep(2.6, 0.6, dl) * 0.75 + exp(-dl / 13.0) * 0.16) * beat * beat * deep * step(0.5, r.y) * 0.75;
    }
    // the diver's lamp
    if (uPtr.z > 0.0) { float dl = length(vec2(x - uPtr.x, y - uPtr.y)); c += vec3(0.07, 0.17, 0.24) * exp(-dl / 110.0) * uPtr.z; }
    // the floor, the city that was built on it, and the rock everything stands on
    if (y > uBed - vh * 1.7) {
      float ry = ridge(x);
      c += vec3(0.52, 0.23, 0.09) * exp(-max(ry - y, 0.0) / (vh * 0.36)) * 0.30;
      if (y < uBed + 90.0) {
        for (int i = 0; i < 16; i++) {
          if (i >= uNL) break;
          vec4 L = uLight[i];
          float dx = abs(x - L.x);
          if (dx > 80.0) continue;
          float hw = 2.2 + 2.8 * fract(L.w * 7.3);
          float foot = L.y + L.z;
          float inY = smoothstep(L.y - 1.5, L.y + 2.5, y) * (1.0 - smoothstep(foot - 1.0, foot + 8.0, y));
          float fl = (y - L.y) / 7.0;
          float win = smoothstep(0.10, 0.28, fract(fl)) * (0.50 + 0.50 * step(0.30, hash21(vec2(floor(fl), L.x))));
          vec3 lc = mix(vec3(1.0, 0.74, 0.32), vec3(1.0, 0.52, 0.44), L.w);
          float flick = 0.86 + 0.14 * sin(t * (0.7 + L.w * 1.3) + L.x);
          c += lc * (smoothstep(hw + 0.9, hw - 0.4, dx) * inY * (0.22 + 0.78 * win) + exp(-dx / 13.0) * inY * 0.15) * flick;
          float bd = length(vec2(dx, y - (L.y - 6.0)));
          c += lc * (smoothstep(3.0, 1.2, bd) + exp(-bd / 9.0) * 0.5) * (0.62 + 0.38 * sin(t * 1.6 + L.x * 0.7));
        }
      }
      if (y > ry) {
        float dr = y - ry;
        float st = vnoise(vec2(x * 0.0025, dr * 0.045 + vnoise(vec2(x * 0.006, 3.0)) * 2.2));
        vec3 rock = mix(vec3(0.042, 0.052, 0.074), vec3(0.008, 0.016, 0.032), smoothstep(0.0, 170.0, dr));
        rock *= 0.80 + 0.40 * st;
        rock += vec3(1.0, 0.55, 0.25) * exp(-dr / 16.0) * 0.085;
        rock += vec3(0.55, 0.80, 1.0) * step(0.9972, hash21(floor(vec2(x, dr) / 3.0))) * 0.09 * smoothstep(40.0, 220.0, dr);
        c = rock;
      }
    }
    c *= 1.0 - 0.16 * pow(abs(uv.x - 0.5) * 2.0, 2.4);
    col = c;
  }
  // the meniscus: a bright, thin line where the glass cuts the water
  float m = exp(-abs(y - wl) / 1.25);
  col = mix(col, vec3(0.93, 0.985, 1.0), m * 0.85);
  col *= 1.0 - 0.22 * exp(-max(y - wl - 2.0, 0.0) / 5.0) * step(wl + 2.0, y);
  col += (hash21(gl_FragCoord.xy + fract(t) * 61.0) - 0.5) * (1.6 / 255.0);
  o = vec4(col, 1.0);
}
