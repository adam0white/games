// Cinderhill's game renderer (WebGL2). Page only: nothing here is read by the sim, so no hash or replay depends on it.
// The surface is drawn as lit relief: the ash has a height field and a normal, stones stand up out of it and cast
// shadows, and one sun moves from morning through dusk into an ember night. The camera is a real one: an eye above
// the hill looking down at a pitch (0: straight down), so a low pitch shows the far hill, the ridge and the sky.
// The ground pass casts a ray per pixel to the ground plane; everything else projects through the same camera
// (CAM below, and `project` / `unproject` in main.js, which must stay the same arithmetic).
// Draws, per frame: the ground and sky (one full-screen pass), the trail ribbons, ant shadows and ants (one
// instanced buffer, two draws) and particles (points).

const GROUND_VS = `#version 300 es
in vec2 aPos; out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const COMMON = `
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { return 0.55 * noise(p) + 0.3 * noise(p * 2.03 + 7.1) + 0.15 * noise(p * 4.1 + 3.7); }
// smoothstep with its edges in either order (GLSL leaves the descending order undefined).
float ss(float a, float b, float x) { return a < b ? smoothstep(a, b, x) : 1.0 - smoothstep(b, a, x); }
`;
// The camera. uEye: the eye (cells; z up). uPitch: sin and cos of the pitch from straight down. uF: focal length in
// device px. A point's camera coordinates are (right, up, depth); a pixel's ray has depth 1.
const CAM = `
uniform vec2 uView; uniform vec3 uEye; uniform vec2 uPitch; uniform float uF;
vec3 toCam(vec3 P) { vec3 v = P - uEye; return vec3(v.x, -v.y * uPitch.y + v.z * uPitch.x, -v.y * uPitch.x - v.z * uPitch.y); }
vec4 toClip(vec3 c) { if (c.z < 0.05) return vec4(2.0, 2.0, 2.0, 1.0); return vec4(uF * c.x / c.z / (uView.x * 0.5), uF * c.y / c.z / (uView.y * 0.5), 0.0, 1.0); }
vec3 camRay(vec2 px) { vec2 q = (px - uView * 0.5) / uF; return vec3(q.x, q.y * uPitch.y - uPitch.x, -q.y * uPitch.x - uPitch.y); }
`;

const GROUND_FS = `#version 300 es
precision highp float; precision highp int;
in vec2 vUv; out vec4 outColor;
uniform sampler2D uCov;          // R: stone, G: water (one texel a cell, filtered)
uniform sampler2D uScent;        // R trail, G food, B alarm (0..1)
uniform vec2 uSize;              // surface size in cells
uniform float uDist;             // eye to the point looked at, cells
uniform float uTime;
uniform vec3 uSun;               // direction to the sun (x, y on the ground, z up), unit
uniform vec3 uSunCol; uniform vec3 uAmb; uniform float uNight; uniform float uInk;
uniform vec4 uPile[8];           // x, y, amount, kind + 1 (0: none)
uniform vec4 uEntrance;          // x, y (cells), width, 1 when shown
uniform vec4 uAlarm;             // x, y, 0, 1 when live
uniform vec4 uBeacon;            // x, y, age (s), 1 when live: a ring where something new has appeared
${COMMON}
${CAM}
// Smooth fields: one filtered fetch (bilinear over the four nearest cell centres) with a wobble, so edges are
// curves and not stairs. Where all four cells agree there is no edge and no wobble to pay for.
vec2 cov(vec2 w) { if (w.x < -0.5 || w.y < -0.5 || w.x > uSize.x + 0.5 || w.y > uSize.y + 0.5) return vec2(0.0); return texture(uCov, w / uSize).rg; }
float stone(vec2 w) { float c = cov(w).r; if (c < 0.004) return 0.0; if (c > 0.996) return 1.0; return c + (fbm(w * 1.3) - 0.5) * 0.22; }
float water(vec2 w) { float c = cov(w).g; if (c < 0.004) return 0.0; if (c > 0.996) return 1.0; return c + (fbm(w * 0.9 + 5.0) - 0.5) * 0.3; }
float ashH(vec2 w) { return fbm(w * 0.11) * 1.6 + fbm(w * 0.9) * 0.16; }
const float STONE_H = 1.3;
// The sky a ray sees: a gradient to the horizon, the sun or the moon, stars, and the burnt ridge with its snags.
vec3 horizonCol() { return mix(uAmb * 1.25 + uSunCol * 0.38, vec3(0.30, 0.13, 0.08), uNight * 0.55); }
vec3 skyCol(vec3 rd) {
  float flat_ = length(rd.xy), el = rd.z / max(flat_, 1e-4);
  vec2 az = rd.xy / max(flat_, 1e-4);
  vec3 zen = mix(vec3(0.34, 0.47, 0.66) * (uAmb * 1.6 + uSunCol * 0.35), vec3(0.02, 0.03, 0.07), uNight);
  vec3 col = mix(horizonCol(), zen, ss(0.0, 0.55, el));
  vec3 dir = normalize(rd); float sd = max(dot(dir, uSun), 0.0);
  col += uSunCol * (pow(sd, 900.0) * 3.0 + pow(sd, 24.0) * 0.35 + pow(sd, 4.0) * 0.12) * (1.0 - uNight * 0.35);
  float a = atan(az.x, -az.y);
  vec2 sq = vec2(a, el) * 70.0; vec2 sg = floor(sq); float sh = hash(sg);
  float sdot = ss(0.16 + 0.1 * fract(sh * 37.0), 0.02, length(fract(sq) - 0.5));
  col += vec3(0.9, 0.92, 1.0) * step(0.95, sh) * sdot * uNight * ss(0.05, 0.3, el) * (0.6 + 0.4 * sin(uTime * 2.0 + sh * 90.0));
  float ridge = 0.012 + 0.05 * fbm(vec2(a * 5.0, 1.0)) + 0.012 * noise(vec2(a * 23.0, 4.0));
  float ci = floor(a * 46.0), ch = hash(vec2(ci, 3.0));
  float snag = ch > 0.62 ? ss(0.5, 0.36, abs(fract(a * 46.0) - 0.5) / (0.10 + 0.12 * hash(vec2(ci, 9.0)))) * (ridge + 0.01 + 0.05 * ch) : 0.0;
  float land = max(ss(ridge + 0.004, ridge - 0.004, el), step(el, snag));
  vec3 farC = mix(horizonCol(), horizonCol() * 0.42 + vec3(0.02, 0.015, 0.015), clamp(0.25 + 0.75 * el / max(ridge, 0.001), 0.0, 1.0));   // the ridge stands in the same air: pale at its foot
  farC += vec3(1.0, 0.36, 0.08) * uNight * step(0.9, hash(floor(vec2(a, el) * 260.0))) * ss(0.45, 0.1, length(fract(vec2(a, el) * 260.0) - 0.5)) * (0.4 + 0.4 * sin(uTime * 1.3 + ch * 30.0)) * step(el, ridge);
  return mix(col, farC, land);
}
void main() {
  vec2 px = vec2(vUv.x * uView.x, (1.0 - vUv.y) * uView.y);
  vec3 rd = camRay(px);
  if (rd.z > -0.012) {                                                       // above the horizon
    vec3 c = skyCol(rd); if (uInk > 0.5) c = mix(vec3(0.88, 0.85, 0.78), vec3(dot(c, vec3(0.3, 0.6, 0.1))) * 0.6 + 0.3, 0.5);
    vec2 v0 = vUv - 0.5; c *= 1.0 - (0.35 + 0.5 * uNight) * dot(v0, v0) * 1.6; outColor = vec4(min(c, vec3(1.0)), 1.0); return;
  }
  float tG = -uEye.z / rd.z;
  vec2 w = uEye.xy + rd.xy * tG;                                             // the ground point under this pixel
  float ppc = uF / tG;                                                       // device px a cell covers here
#define AT(h) (uEye.xy + rd.xy * ((h) - uEye.z) / rd.z)
  // Ash: a height field and its normal.
  float e = 0.35;
  float h0 = ashH(w), hx = ashH(w + vec2(e, 0.0)), hy = ashH(w + vec2(0.0, e));
  vec3 n = normalize(vec3(-(hx - h0) / e * 1.5, -(hy - h0) / e * 1.5, 1.0));
  float burnt = fbm(w * 0.05 + 3.0);
  vec3 ash = mix(vec3(0.44, 0.42, 0.40), vec3(0.76, 0.73, 0.68), fbm(w * 0.35) * 0.6 + burnt * 0.4);
  ash = mix(ash, vec3(0.20, 0.17, 0.16), ss(0.62, 0.8, fbm(w * 0.17 + 9.0)) * 0.6);   // charred patches
  ash *= 0.9 + 0.2 * noise(w * 3.3);
  vec3 col = ash; float lit = 1.0; float spec = 0.0;
  bool onGround = true;
  // Water: flat and reflective.
  float wt = water(w);
  if (wt > 0.5) {
    float r = sin(w.x * 2.1 + uTime * 0.9) * sin(w.y * 2.7 - uTime * 0.7);
    n = normalize(vec3(r * 0.25, r * 0.2, 1.0));
    col = mix(vec3(0.10, 0.17, 0.22), vec3(0.22, 0.34, 0.40), 0.5 + 0.5 * r);
    col = mix(col, ash * 0.6, ss(0.62, 0.5, wt));
    spec = 0.9;
  }
  // Stones: the top face is the stone lifted STONE_H; under it on screen, its side.
  vec2 ws = AT(STONE_H);
  float top = stone(ws);
  float side = 0.0;
  if (top <= 0.5) for (int j = 1; j < 4; j++) side = max(side, stone(AT(STONE_H * float(j) / 4.0)));
  if (top > 0.5) {
    float e2 = 0.3, s0 = stone(ws), sx = stone(ws + vec2(e2, 0.0)), sy = stone(ws + vec2(0.0, e2));
    float rim = ss(0.5, 0.85, s0);
    n = normalize(vec3(-(sx - s0) / e2 * (1.0 - rim) * 1.6 + (noise(ws * 2.0) - 0.5) * 0.5, -(sy - s0) / e2 * (1.0 - rim) * 1.6 + (noise(ws * 2.0 + 9.0) - 0.5) * 0.5, 1.0));
    col = mix(vec3(0.34, 0.32, 0.31), vec3(0.50, 0.47, 0.44), fbm(ws * 0.8));
    col = mix(col, vec3(0.10, 0.09, 0.09), ss(0.55, 0.9, fbm(ws * 0.4 + 4.0)) * 0.6);   // soot
    onGround = false; spec = 0.15;
  } else if (side > 0.5) {
    col = mix(vec3(0.20, 0.19, 0.19), vec3(0.30, 0.28, 0.27), fbm(w * vec2(3.0, 0.8)));
    n = normalize(vec3(0.0, 0.9, 0.35)); onGround = false;
  }
  // Shadows the stones throw on the ground, toward the side away from the sun, longer when the sun is low.
  float shade = 0.0;
  if (onGround) {
    float len = STONE_H * clamp(sqrt(max(0.0, 1.0 - uSun.z * uSun.z)) / max(uSun.z, 0.18), 0.0, 4.0);
    vec2 dir = normalize(uSun.xy + 1e-4);
    for (int j = 1; j <= 5; j++) { float t = float(j) / 5.0; shade = max(shade, ss(0.42, 0.6, stone(w + dir * len * t)) * (1.0 - t * 0.55)); }
  }
  vec3 emis = vec3(0.0); float cover = 0.0;   // where the door or food lies, scent does not paint over it
  // The entrance: a mound of spoil with a dark mouth.
  if (uEntrance.w > 0.0) {
    vec2 d = w - uEntrance.xy; d.x /= 1.0 + uEntrance.z * 0.25;
    float r = length(d), mh = ss(4.2, 1.6, r);
    if (r < 4.4) {
      vec3 mn = normalize(vec3(d * mh * (1.0 - mh) * 1.4, 1.0));
      n = normalize(mix(n, mn, 0.8 * mh));
      col = mix(col, vec3(0.42, 0.33, 0.24) * (0.85 + 0.3 * noise(w * 4.0)), mh * 0.9);
      float mouth = ss(1.45, 1.05, r);
      col = mix(col, vec3(0.03, 0.02, 0.02), mouth);
      col += vec3(1.0, 0.5, 0.15) * uNight * ss(2.6, 1.0, r) * (1.0 - mouth) * 0.35;   // warm light from inside the hill at night
      shade *= 1.0 - mouth; cover = mh;
    }
  }
  // Food: a seed head (pale, clustered) or a beetle (a dark, shiny shell), each a little dome.
  float glow = 0.0;
  for (int k = 0; k < 8; k++) {
    vec4 p = uPile[k]; if (p.w < 0.5 || p.z <= 0.0) continue;
    float r = 0.7 + 1.5 * sqrt(p.z / 120.0);
    vec2 d = AT(r * 0.3) - p.xy - 0.5;
    float dist = length(d);
    if (dist < r * 2.2) shade = max(shade, ss(r * 1.15, r * 0.7, length(d - normalize(uSun.xy + 1e-4) * r * 0.5)) * 0.55);
    if (dist < r) {
      float dome = sqrt(max(0.0, 1.0 - dist * dist / (r * r)));
      n = normalize(vec3(d / r * 1.2, dome + 0.2));
      if (p.w < 1.5) {
        vec2 q = w * 2.4; vec2 qi = floor(q); float sd = length(fract(q) - 0.5 - (vec2(hash(qi), hash(qi + 7.0)) - 0.5) * 0.3);
        col = mix(vec3(0.62, 0.47, 0.20), vec3(0.96, 0.84, 0.46), ss(0.45, 0.2, sd));
        spec = 0.25;
      } else {
        float stripe = ss(0.06, 0.02, abs(d.x)) + ss(0.8, 1.0, dist / r);
        col = mix(vec3(0.20, 0.07, 0.05), vec3(0.42, 0.13, 0.07), dome); col = mix(col, vec3(0.05, 0.03, 0.03), clamp(stripe, 0.0, 1.0) * 0.8);
        spec = 1.2;
      }
      emis = col * 0.95 + vec3(0.10, 0.07, 0.03); shade = 0.0; cover = 1.0; glow = max(glow, 0.12 * dome);
    }
  }
  // Light.
  float diff = max(dot(n, uSun), 0.0);
  vec3 light = uAmb + uSunCol * diff * (1.0 - shade * 0.85);
  vec3 hv = normalize(uSun + vec3(0.0, 0.0, 1.0));
  col = col * light + uSunCol * spec * pow(max(dot(n, hv), 0.0), 24.0) * (1.0 - shade);
  col += glow * vec3(1.0, 0.9, 0.6) * (0.4 + uNight) + emis * uNight;
  // Embers in the ash: a few by day, many by night, each breathing on its own beat.
  if (onGround && wt <= 0.5) {
    vec2 ci = floor(w * 1.6); float h = hash(ci * 0.731);
    float many = mix(0.992, 0.978, uNight);
    if (h > many) { vec2 d = fract(w * 1.6) - 0.5 - (vec2(hash(ci + 3.0), hash(ci + 5.0)) - 0.5) * 0.5;
      float em = ss(0.28, 0.0, length(d)) * (0.45 + 0.55 * sin(uTime * (1.5 + h * 3.0) + h * 40.0));
      col += vec3(1.0, 0.40, 0.08) * em * mix(0.35, 0.8, uNight); }
  }
  // Scent: by day a stain on the ash, by night light. Trail amber, food green, alarm red; the trail's grains drift.
  vec3 sc = texture(uScent, w / uSize).rgb;
  if (onGround) {
    float grain = 0.75 + 0.5 * fbm(w * 1.1 + vec2(uTime * 0.25, 0.0));
    float tr = clamp(pow(sc.r, 3.0) * 0.9 * grain, 0.0, 0.45) * (1.0 - cover), fo = clamp(pow(sc.g, 3.0) * 0.8 * grain, 0.0, 0.4) * (1.0 - cover), al = clamp(pow(sc.b, 2.0) * 1.2, 0.0, 0.85);
    col = mix(col, vec3(0.95, 0.62, 0.20) * (0.55 + 0.6 * dot(light, vec3(0.33))), tr * (1.0 - uNight) * 0.8);
    col = mix(col, vec3(0.40, 0.66, 0.28) * (0.5 + 0.5 * dot(light, vec3(0.33))), fo * (1.0 - uNight) * 0.7);
    col += (vec3(1.0, 0.58, 0.16) * tr + vec3(0.30, 0.9, 0.38) * fo * 0.7) * uNight;
    col = mix(col, vec3(0.9, 0.14, 0.10), al * 0.8) + vec3(0.9, 0.1, 0.05) * al * uNight * 0.5;
  }
  if (uAlarm.w > 0.0) {
    vec2 d = w - uAlarm.xy; d.y *= 1.0; float dist = length(d), ring = fract(uTime * 0.8), rr = 1.5 + ring * 8.0;
    col = mix(col, vec3(0.95, 0.15, 0.10), (ss(rr - 0.5, rr, dist) - ss(rr, rr + 0.5, dist)) * (1.0 - ring) * 0.9);
  }
  if (uBeacon.w > 0.0) {
    float dist = length(w - uBeacon.xy - 0.5), ring = fract(uBeacon.z * 0.7), rr = 1.0 + ring * 7.0;
    col += vec3(1.0, 0.9, 0.5) * (ss(rr - 0.6, rr, dist) - ss(rr, rr + 0.6, dist)) * (1.0 - ring) * 0.8;
  }
  // Ink: the same scene as a drawing on paper, with inked contours.
  if (uInk > 0.5) {
    float lum = dot(col, vec3(0.3, 0.6, 0.1));
    vec3 paper = mix(vec3(0.80, 0.77, 0.71), vec3(0.90, 0.87, 0.80), fbm(w * 0.06)) * (0.94 + 0.06 * noise(w * 3.1));
    vec3 tone = mix(paper * 0.55, paper, ss(0.05, 0.45, lum));
    col = mix(tone, col, 0.35);
    float st = stone(ws);
    col = mix(col, vec3(0.13, 0.11, 0.10), (1.0 - ss(0.0, 0.09 + 1.4 / ppc, abs(st - 0.5))) * 0.85);
    col = mix(col, vec3(0.13, 0.11, 0.10), (1.0 - ss(0.0, 0.08 + 1.4 / ppc, abs(wt - 0.5))) * 0.6);
  }
  col *= 0.5 + 0.5 * ss(-10.0, 0.0, min(min(w.x, w.y), min(uSize.x - w.x, uSize.y - w.y)));   // past the map the ash darkens, with no line
  col = mix(col, uInk > 0.5 ? vec3(0.86, 0.83, 0.76) : horizonCol(), 1.0 - exp(-max(0.0, tG - uDist * 1.6) / (uDist * 4.5)));   // the far hill fades into the air
  vec2 v = vUv - 0.5; col *= 1.0 - (0.35 + 0.5 * uNight) * dot(v, v) * 1.6;                     // the edges fall away
  outColor = vec4(min(col, vec3(1.0)), 1.0);
}`;

const ANT_VS = `#version 300 es
precision highp float;
in vec2 aCorner;
in vec4 aPos;    // previous x, y, new x, y (cells)
in vec4 aInfo;   // heading (radians), kind (0 forager, 1 digger, 2 guard, 3 nurse; +8: a major), carry (0, 1 sugar, 2 protein), phase
uniform float uAlpha; uniform float uRun;
uniform float uShadow; uniform vec3 uSun; uniform float uBig;
${CAM}
out vec2 vLocal; flat out vec4 vInfo; out float vPx; flat out float vMove;
void main() {
  vec2 p = mix(aPos.xy, aPos.zw, uAlpha);
  float scale = uF / max(toCam(vec3(p, 0.0)).z, 0.05);              // device px a cell covers at this ant
  float major = aInfo.y > 7.5 ? 1.5 : 1.0;
  float half_ = max(0.85 * major * uBig, 4.0 / scale);              // half size in cells; never under about 4 device px
  float c = cos(aInfo.x), s = sin(aInfo.x);
  vec2 o = aCorner * half_;
  vec2 r = vec2(o.x * c - o.y * s, o.x * s + o.y * c);
  float lift = 0.12 * half_;
  // Seen from low down a flat ant would be a sliver: she leans up toward the eye, never thinner than 0.62 of her length.
  float lean = uPitch.x > 0.01 ? (max(uPitch.y, 0.62) - uPitch.y) / uPitch.x : 0.0;
  if (uShadow < 0.5) lift -= r.y * lean;
  if (uShadow > 0.5) { p -= normalize(uSun.xy + 1e-4) * half_ * 0.35 * clamp(1.0 / max(uSun.z, 0.3) - 0.6, 0.2, 2.0); lift = 0.0; r *= 1.1; }
  gl_Position = toClip(toCam(vec3(p + r, lift)));
  vLocal = aCorner; vInfo = aInfo; vPx = half_ * scale;
  vMove = uRun > 0.5 && length(aPos.zw - aPos.xy) > 0.004 ? 1.0 : 0.0;
}`;

const ANT_FS = `#version 300 es
precision highp float;
in vec2 vLocal; flat in vec4 vInfo; in float vPx; flat in float vMove; out vec4 outColor;
uniform float uTime; uniform float uShadow; uniform vec3 uSunCol; uniform vec3 uAmb; uniform float uNight; uniform float uInk;
float ss(float a, float b, float x) { return a < b ? smoothstep(a, b, x) : 1.0 - smoothstep(b, a, x); }
float ell(vec2 p, vec2 c, vec2 r) { vec2 q = (p - c) / r; return (length(q) - 1.0) * min(r.x, r.y); }
float seg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
void main() {
  vec2 p = vLocal;                                              // x along the body (head at +x), -1..1
  float aa = 1.5 / max(vPx, 1.0);
  float kind = mod(vInfo.y, 8.0);
  if (uShadow > 0.5) {
    float d = ell(p, vec2(-0.05, 0.0), vec2(0.8, 0.42));
    float a = (1.0 - ss(-0.25, 0.2, d)) * 0.42 * (1.0 - uNight * 0.6);
    if (a < 0.01) discard;
    outColor = vec4(0.0, 0.0, 0.0, a); return;
  }
  vec3 body = kind < 0.5 ? vec3(0.20, 0.10, 0.06) : kind < 1.5 ? vec3(0.42, 0.22, 0.10) : kind < 2.5 ? vec3(0.36, 0.06, 0.05) : vec3(0.30, 0.18, 0.12);
  vec3 light = uAmb * 1.2 + uSunCol * 0.75;
  vec3 seedCol = vInfo.z > 1.5 ? vec3(0.62, 0.20, 0.12) : vec3(0.97, 0.86, 0.48);
  if (vPx < 6.0) {                                              // far away: one oval, and the load as a dot
    float d = ell(p, vec2(0.0, 0.0), vec2(0.85, 0.45));
    float a = 1.0 - ss(-aa, aa, d);
    vec3 col = body * light + vec3(1.0, 0.55, 0.2) * uNight * 0.8;        // by night a far ant is a spark
    if (d > 0.0) { col = mix(vec3(0.86, 0.82, 0.74) * light, vec3(0.9, 0.5, 0.2), uNight); a = (1.0 - ss(0.0, 0.3, d)) * 0.4; }
    if (vInfo.z > 0.5) { float f = length(p - vec2(0.7, 0.0)) - 0.52; a = max(a, 1.0 - ss(-aa, aa, f)); if (f < 0.0) col = seedCol * (light + uNight * 0.6); }
    if (a < 0.02) discard;
    outColor = vec4(col, a); return;
  }
  // The tripod gait in two frames while the ant moves; standing, the legs rest and only the antennae twitch.
  float step_ = vMove > 0.5 ? step(0.5, fract(uTime * 6.0 + vInfo.w)) : 0.5;
  float twitch = vMove > 0.5 ? 0.0 : 0.05 * sin(uTime * 2.3 + vInfo.w * 40.0) * step(0.7, fract(uTime * 0.37 + vInfo.w));
  float dh = ell(p, vec2(0.55, 0.0), vec2(0.2, 0.17));          // head
  float dt = ell(p, vec2(0.17, 0.0), vec2(0.22, 0.13));         // thorax
  float dg = ell(p, vec2(-0.4, 0.0), vec2(0.4, 0.27));          // gaster
  float d = min(dh, min(dt, dg));
  float legs = 1e3;
  for (int k = 0; k < 3; k++) {
    float x = 0.28 - 0.14 * float(k), swing = (mod(float(k), 2.0) < 0.5 ? step_ : 1.0 - step_) * 0.16 - 0.08;
    legs = min(legs, seg(p, vec2(x, 0.0), vec2(x + 0.14 * float(1 - k) + swing, 0.5)));
    legs = min(legs, seg(p, vec2(x, 0.0), vec2(x + 0.14 * float(1 - k) - swing, -0.5)));
  }
  legs = min(legs, seg(p, vec2(0.6, 0.06), vec2(0.88, 0.24 + twitch)));    // antennae
  legs = min(legs, seg(p, vec2(0.6, -0.06), vec2(0.88, -0.24 + twitch)));
  float lw = max(0.035, 0.9 / vPx);
  float a = max(1.0 - ss(-aa, aa, d), 1.0 - ss(lw - aa, lw + aa, legs));
  // Each body part is a small dome: a highlight toward the top of the part, a darker edge.
  float round_ = clamp(-d / 0.16, 0.0, 1.0);
  vec3 col = body * light * (0.55 + 0.75 * round_) + uSunCol * 0.35 * pow(round_, 6.0);
  col = mix(col, (body * 1.6 + vec3(0.85, 0.42, 0.14)) * (0.3 + 0.7 * round_), uNight * 0.7);   // by night she is lit by the embers: a warm body, not a black one
  col += vec3(1.0, 0.5, 0.15) * uNight * (1.0 - round_) * 0.6 * step(d, 0.0);           // and a hot rim
  // A pale edge of ash dust just outside the body, so she reads on char, on the door's dark and on other ants.
  float halo = (1.0 - ss(0.0, 0.085, d)) * step(0.0, d) * 0.5;
  float legA = 1.0 - ss(lw - aa, lw + aa, legs);
  col = mix(col, mix(mix(vec3(0.86, 0.82, 0.74) * light, vec3(0.9, 0.5, 0.2), uNight), mix(body * light * 0.7, vec3(0.8, 0.4, 0.15), uNight), legA), step(0.0, d));
  a = max(a, halo);
  if (vInfo.z > 0.5) {                                          // the load, held in the jaws
    float f = ell(p, vec2(0.9, 0.0), vec2(0.23, 0.2));
    float fa = 1.0 - ss(-aa, aa, f);
    col = mix(col, seedCol * (light * (0.7 + 0.5 * clamp(-f / 0.1, 0.0, 1.0)) + uNight * 0.6) + vec3(0.5) * pow(clamp(-f / 0.16, 0.0, 1.0), 5.0), fa);
    a = max(a, fa);
  }
  if (uInk > 0.5) col = mix(vec3(0.16, 0.12, 0.10), col, 0.5);
  if (a < 0.02) discard;
  outColor = vec4(col, a);
}`;

const DOT_VS = `#version 300 es
precision highp float;
in vec4 aP;      // x, y (cells), height (cells), size (cells)
in vec4 aC;      // premultiplied colour; alpha 0 adds light
${CAM}
out vec4 vC;
void main() {
  vec3 c = toCam(aP.xyz);
  gl_Position = toClip(c);
  gl_PointSize = max(1.5, aP.w * uF / max(c.z, 0.05));
  vC = aC;
}`;
const DOT_FS = `#version 300 es
precision highp float;
in vec4 vC; out vec4 outColor;
void main() { float d = length(gl_PointCoord - 0.5) * 2.0; float a = 1.0 - smoothstep(0.35, 1.0, d); if (a < 0.01) discard; outColor = vC * a; }`;

// The trails the player drew: ribbons on the ground, each in its own colour, with chevrons that run toward the food.
const TRAIL_VS = `#version 300 es
precision highp float;
in vec4 aP;      // x, y (cells), across (-1..1), along (cells from the trail's start)
in vec4 aC;      // colour, and how fast the chevrons run (cells a second)
${CAM}
out vec4 vC; out vec2 vUs; out float vPx;
void main() { vec3 c = toCam(vec3(aP.xy, 0.03)); gl_Position = toClip(c); vC = aC; vUs = aP.zw; vPx = uF / max(c.z, 0.05); }`;
const TRAIL_FS = `#version 300 es
precision highp float;
in vec4 vC; in vec2 vUs; in float vPx; out vec4 outColor;
uniform float uTime; uniform float uNight; uniform float uInk;
void main() {
  float u = abs(vUs.x), edge = 1.0 - smoothstep(0.5, 1.0, u);
  float ph = fract(vUs.y * 0.55 - uTime * vC.a * 0.55 + u * 0.38);
  float chev = smoothstep(0.0, 0.12, ph) * (1.0 - smoothstep(0.42, 0.58, ph));
  float core = 1.0 - smoothstep(0.0, 0.5, u);
  float a = edge * (0.22 + 0.62 * chev + 0.12 * core);
  if (vPx < 5.0) a = edge * 0.6;                                  // far away the chevrons would shimmer: a plain line
  vec3 col = uInk > 0.5 ? vC.rgb * 0.45 : vC.rgb * (0.85 + 0.5 * uNight + 0.35 * chev);
  outColor = vec4(col * a, a * (1.0 - 0.7 * uNight) * (uInk > 0.5 ? 1.0 : 0.75));   // by night the ribbon is light
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
function program(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error(gl.getProgramInfoLog(p));
  const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) || 0;
  for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, ''); u[name] = gl.getUniformLocation(p, name); }
  return { p, u };
}

const mix = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
// The day as keyframes: [phase, sun azimuth (turns), sun height (0..1), sun colour, ambient, night].
const SKY = [
  [0.00, 0.62, 0.30, [1.05, 0.86, 0.66], [0.40, 0.42, 0.48], 0],     // morning: a low warm sun
  [0.30, 0.75, 0.85, [1.00, 0.97, 0.90], [0.50, 0.50, 0.52], 0],     // midday
  [0.55, 0.90, 0.32, [1.15, 0.72, 0.42], [0.42, 0.36, 0.40], 0.15],  // late afternoon, gold
  [0.68, 0.97, 0.14, [1.05, 0.45, 0.25], [0.26, 0.22, 0.32], 0.6],   // dusk
  [0.76, 0.20, 0.55, [0.20, 0.26, 0.42], [0.10, 0.10, 0.17], 1],     // night: a cold moon
  [0.94, 0.30, 0.50, [0.22, 0.28, 0.44], [0.11, 0.11, 0.18], 1],
  [1.00, 0.62, 0.30, [1.05, 0.86, 0.66], [0.40, 0.42, 0.48], 0],
];
/** The light at a phase of the day, 0 (morning) to 1 (the next morning). */
export function sky(phase) {
  phase = ((phase % 1) + 1) % 1;
  let k = 0; while (k < SKY.length - 2 && phase >= SKY[k + 1][0]) k++;
  const a = SKY[k], b = SKY[k + 1], t = (phase - a[0]) / (b[0] - a[0]), s = t * t * (3 - 2 * t);
  let az = mix(a[1], b[1], s); if (Math.abs(b[1] - a[1]) > 0.5) az = s < 0.5 ? a[1] : b[1];   // the sun sets and the moon is up: no sweep through the ground
  const el = mix(a[2], b[2], s), ang = az * Math.PI * 2, c = Math.sqrt(1 - el * el);
  return { sun: [Math.cos(ang) * c, Math.sin(ang) * c, el], sunCol: mix3(a[3], b[3], s), amb: mix3(a[4], b[4], s), night: mix(a[5], b[5], s) };
}

export class GameRenderer {
  /** Returns null when the browser has no WebGL2. */
  static create(canvas, hooks = {}) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    return gl ? new GameRenderer(canvas, gl, hooks) : null;
  }
  constructor(canvas, gl, hooks) {
    this.canvas = canvas; this.gl = gl; this.lost = false; this.losses = 0;
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.lost = true; this.losses++; hooks.lost?.(); });
    canvas.addEventListener('webglcontextrestored', () => { this.lost = false; this.init(); hooks.restored?.(); });
    this.init();
  }
  init() {
    const gl = this.gl;
    this.ground = program(gl, GROUND_VS, GROUND_FS);
    this.ant = program(gl, ANT_VS, ANT_FS);
    this.dot = program(gl, DOT_VS, DOT_FS);
    this.trail = program(gl, TRAIL_VS, TRAIL_FS);
    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this.gvao = gl.createVertexArray(); gl.bindVertexArray(this.gvao);
    const gp = gl.getAttribLocation(this.ground.p, 'aPos'); gl.enableVertexAttribArray(gp); gl.vertexAttribPointer(gp, 2, gl.FLOAT, false, 0, 0);
    this.inst = gl.createBuffer(); this.instCap = 0;
    this.avao = gl.createVertexArray(); gl.bindVertexArray(this.avao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    const ac = gl.getAttribLocation(this.ant.p, 'aCorner'); gl.enableVertexAttribArray(ac); gl.vertexAttribPointer(ac, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.inst);
    const ap = gl.getAttribLocation(this.ant.p, 'aPos'), ai = gl.getAttribLocation(this.ant.p, 'aInfo');
    gl.enableVertexAttribArray(ap); gl.vertexAttribPointer(ap, 4, gl.FLOAT, false, 32, 0); gl.vertexAttribDivisor(ap, 1);
    gl.enableVertexAttribArray(ai); gl.vertexAttribPointer(ai, 4, gl.FLOAT, false, 32, 16); gl.vertexAttribDivisor(ai, 1);
    this.dots = gl.createBuffer(); this.dotCap = 0; this.dotCount = 0;
    this.dvao = gl.createVertexArray(); gl.bindVertexArray(this.dvao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.dots);
    const dp = gl.getAttribLocation(this.dot.p, 'aP'), dc = gl.getAttribLocation(this.dot.p, 'aC');
    gl.enableVertexAttribArray(dp); gl.vertexAttribPointer(dp, 4, gl.FLOAT, false, 32, 0);
    gl.enableVertexAttribArray(dc); gl.vertexAttribPointer(dc, 4, gl.FLOAT, false, 32, 16);
    this.trails = gl.createBuffer(); this.trailCap = 0; this.trailCount = 0;
    this.tvao = gl.createVertexArray(); gl.bindVertexArray(this.tvao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.trails);
    const tp = gl.getAttribLocation(this.trail.p, 'aP'), tc = gl.getAttribLocation(this.trail.p, 'aC');
    gl.enableVertexAttribArray(tp); gl.vertexAttribPointer(tp, 4, gl.FLOAT, false, 32, 0);
    gl.enableVertexAttribArray(tc); gl.vertexAttribPointer(tc, 4, gl.FLOAT, false, 32, 16);
    gl.bindVertexArray(null);
    this.covTex = gl.createTexture(); this.scentTex = gl.createTexture();
    for (const t of [this.covTex, this.scentTex]) {
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    this.size = null; this.antCount = 0;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    this.gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  }
  /** The surface's materials (Uint8, w*h). */
  setTerrain(w, h, mat) {
    const gl = this.gl; if (this.lost) return;
    const cov = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) { cov[i * 4] = mat[i] === 4 ? 255 : 0; cov[i * 4 + 1] = mat[i] === 6 ? 255 : 0; }
    gl.bindTexture(gl.TEXTURE_2D, this.covTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, cov);
    this.size = { w, h };
  }
  /** Scent as RGBA bytes (trail, food, alarm, unused). */
  setScent(w, h, rgba) {
    const gl = this.gl; if (this.lost) return;
    gl.bindTexture(gl.TEXTURE_2D, this.scentTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
  }
  /** Instances: 8 floats per ant (see ANT_VS). */
  setAnts(data, count) {
    const gl = this.gl; if (this.lost) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.inst);
    if (data.length > this.instCap) { gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW); this.instCap = data.length; }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, count * 8);
    this.antCount = count;
  }
  /** Particles: 8 floats each (x, y, height, size, premultiplied r, g, b, a). */
  setDots(data, count) {
    const gl = this.gl; if (this.lost) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.dots);
    if (data.length > this.dotCap) { gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW); this.dotCap = data.length; }
    if (count) gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, count * 8);
    this.dotCount = count;
  }
  /** Trail ribbons: triangles, 8 floats a vertex (see TRAIL_VS). */
  setTrails(data, count) {
    const gl = this.gl; if (this.lost) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.trails);
    if (data.length > this.trailCap) { gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW); this.trailCap = data.length; }
    if (count) gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, count * 8);
    this.trailCount = count;
  }
  resize(cssW, cssH, dpr) {
    const w = Math.max(1, Math.round(cssW * dpr)), h = Math.max(1, Math.round(cssH * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.dpr = dpr;
  }
  /** view: { ex, ey, ez, sin, cos, f (CSS px), dist } from main.js `pose()`; light: sky(phase). */
  draw({ view, light, ink = false, alpha, time, piles, entrance, alarm, beacon, running = true, big = 1 }) {
    const gl = this.gl; if (this.lost || !this.size) return false;
    const W = this.canvas.width, H = this.canvas.height, dpr = this.dpr ?? 1, L = this.size;
    gl.viewport(0, 0, W, H);
    gl.disable(gl.BLEND);
    const common = P => {
      gl.uniform2f(P.u.uView, W, H); gl.uniform3f(P.u.uEye, view.ex, view.ey, view.ez); gl.uniform2f(P.u.uPitch, view.sin, view.cos); gl.uniform1f(P.u.uF, view.f * dpr);
      if (P.u.uTime) gl.uniform1f(P.u.uTime, time);
      if (P.u.uSun) gl.uniform3fv(P.u.uSun, light.sun);
      if (P.u.uSunCol) gl.uniform3fv(P.u.uSunCol, light.sunCol);
      if (P.u.uAmb) gl.uniform3fv(P.u.uAmb, light.amb);
      if (P.u.uNight) gl.uniform1f(P.u.uNight, light.night);
      if (P.u.uInk) gl.uniform1f(P.u.uInk, ink ? 1 : 0);
    };
    const g = this.ground;
    gl.useProgram(g.p); common(g);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.covTex); gl.uniform1i(g.u.uCov, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.scentTex); gl.uniform1i(g.u.uScent, 1);
    gl.uniform2f(g.u.uSize, L.w, L.h); gl.uniform1f(g.u.uDist, view.dist);
    const pv = new Float32Array(32); (piles || []).slice(0, 8).forEach((p, k) => { pv[4 * k] = p.x; pv[4 * k + 1] = p.y; pv[4 * k + 2] = p.amount; pv[4 * k + 3] = p.kind + 1; });
    gl.uniform4fv(g.u.uPile, pv);
    gl.uniform4f(g.u.uEntrance, entrance ? entrance.x : 0, entrance ? entrance.y : 0, entrance ? entrance.w : 0, entrance ? 1 : 0);
    gl.uniform4f(g.u.uAlarm, alarm ? alarm.x : 0, alarm ? alarm.y : 0, 0, alarm ? 1 : 0);
    gl.uniform4f(g.u.uBeacon, beacon ? beacon.x : 0, beacon ? beacon.y : 0, beacon ? beacon.age : 0, beacon ? 1 : 0);
    gl.bindVertexArray(this.gvao); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.enable(gl.BLEND);
    if (this.trailCount) {
      const tr = this.trail;
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(tr.p); common(tr);
      gl.bindVertexArray(this.tvao); gl.drawArrays(gl.TRIANGLES, 0, this.trailCount);
    }
    if (this.antCount) {
      const a = this.ant;
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(a.p); common(a);
      gl.uniform1f(a.u.uAlpha, alpha); gl.uniform1f(a.u.uRun, running ? 1 : 0); gl.uniform1f(a.u.uBig, big);
      gl.bindVertexArray(this.avao);
      gl.uniform1f(a.u.uShadow, 1); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.antCount);
      gl.uniform1f(a.u.uShadow, 0); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.antCount);
    }
    if (this.dotCount) {
      const d = this.dot;
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(d.p); common(d);
      gl.bindVertexArray(this.dvao); gl.drawArrays(gl.POINTS, 0, this.dotCount);
    }
    gl.bindVertexArray(null);
    return true;
  }
}
