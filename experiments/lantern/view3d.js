// Lantern 3D renderer: draws one frame of the Lantern simulation with WebGL2.
// It reads the simulation and never changes it. World axes: x is the sim's x (river units),
// y is up, z points back toward the camera; the boat's row is always z = 0, so z = -(y - s.y).
import { centre, half, fall, fog, wind, rain, sight, dazzle, boat, BOAT, DT } from './sim.js?v=15';
import { disturb, solids, riverOf, SPONGE } from './ripples.js';
import { createWaterGL } from './ripples-gl.js';

const ROWS = 256, DY = 0.05, BEHIND = 40; // river table: 256 rows, 0.05 apart, from 2 units behind the boat
const NEAR = -1.2, FAR = 4.2, ROW_STEP = 0.025; // ground mesh rows, boat-relative
const REED_STEP = 0.007, REED_SPAN = 5.6;
// Camera of the lab page: 1.6 up and 0.7 behind the boat, looking at a point 0.5 ahead, 50 degree vertical field of view.
const CAM = { h: 1.6, back: 0.7, look: 0.5, fov: 50 };
// Lantern's own cameras. The 3D view rides low behind the boat; first person sits at the stern, with the lantern in front (notes #158, #159).
const CAMS = { '3d': { h: 0.98, back: 0.82, look: 0.75, fov: 64 }, first: { h: 0.135, back: 0.1, look: 1.1, fov: 78 } };

const COMMON = `
precision highp int;
precision highp float;
uniform mat4 uVP;
uniform vec3 uEye;
uniform float uSY;
uniform vec3 uRowInfo;
uniform sampler2D uRows;
uniform float uTime;
uniform vec3 uLamp;
uniform vec3 uLampCol;
uniform float uR;
uniform vec4 uPt[8];
uniform vec3 uPtCol[8];
uniform int uNPt;
uniform vec3 uAmb;
uniform vec3 uHorizon;
uniform float uDawn;
uniform float uExpo;
uniform vec3 uWet; // the water's own colour
uniform float uHaze; // 1: the far end of the river fades into the night (Lantern's own views)
uniform float uReedK; // reed height, 1 on the lab page
uniform float uStone; // 0 river banks, 1 the tower's stone, 2 the second sector's violet stone
uniform vec3 uTint; uniform float uTintK; // the boat's colour
// A hash without sine (after Dave Hoskins); inputs are wrapped so large river y keeps full precision.
float hash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float vnoise(vec2 p) {
  vec2 i = mod(floor(p), 289.), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
// The river table: texel 0 holds (centre, half width, waterfall, boat trail x); texel 1 holds (fog, wind, rain, 0).
vec4 row0(float yA) { return texture(uRows, vec2(0.25, ((yA - uRowInfo.x) / uRowInfo.y + 0.5) / uRowInfo.z)); }
vec4 row1(float yA) { return texture(uRows, vec2(0.75, ((yA - uRowInfo.x) / uRowInfo.y + 0.5) / uRowInfo.z)); }
// Height of the bank at a distance off outside the water's edge.
float bankH(float off, float yA, float side) {
  if (uStone > 0.5) return 0.13 * smoothstep(0., 0.015, off) - 0.008 * (1. - smoothstep(0., 0.01, off));
  float n = vnoise(vec2(yA * 7., off * 9. + side * 17.));
  return 0.075 * smoothstep(0.0, 0.07, off) * (0.7 + 0.6 * n) + 0.03 * smoothstep(0.15, 0.6, off) * n - 0.008 * (1. - smoothstep(0., 0.01, off));
}
// The lantern: a point light whose reach ends at uR river units across the water.
float lampW(vec3 p) {
  float x = length(p.xz - uLamp.xz) / uR;
  float w = clamp(1. - x * x * x * x, 0., 1.);
  return w * w / (1. + 3. * x * x);
}
vec3 shade(vec3 p, vec3 n, vec3 v, vec3 alb, float shin, float ks, float wrap) {
  vec3 col = alb * uAmb * (0.65 + 0.35 * n.y);
  vec3 l = normalize(uLamp - p);
  float w = lampW(p);
  float nl = clamp((dot(n, l) + wrap) / (1. + wrap), 0., 1.);
  vec3 h = normalize(l + v);
  float sp = ks * pow(max(dot(n, h), 0.), shin) * (shin + 2.) / 8.;
  col += uLampCol * w * (alb * nl + sp);
  for (int i = 0; i < 8; i++) {
    if (i >= uNPt) break;
    vec3 d = uPt[i].xyz - p;
    float x = length(d) / uPt[i].w;
    if (x >= 1.) continue;
    float wi = 1. - x * x; wi *= wi;
    vec3 li = normalize(d);
    float nli = clamp((dot(n, li) + wrap) / (1. + wrap), 0., 1.);
    float spi = ks * pow(max(dot(n, normalize(li + v)), 0.), shin) * (shin + 2.) / 8.;
    col += uPtCol[i] * wi * (alb * nli + spi);
  }
  return col;
}
// Fog stretches and the dawn haze in the distance.
vec3 atmos(vec3 col, vec3 p) {
  float yA = uSY - p.z;
  float fg = row1(yA).x;
  if (fg > 0.001) {
    float nz = vnoise(vec2(p.x * 5. + uTime * 0.15, yA * 3.));
    col = mix(col, vec3(0.5, 0.55, 0.6) * (0.03 + 0.35 * lampW(p)), fg * (0.25 + 0.3 * nz));
  }
  col *= 1. - uHaze * smoothstep(2.6, 4.1, -p.z);
  col = mix(col, uHorizon, uDawn * smoothstep(1.0, 4.5, length(p - uEye)));
  return col;
}
#ifdef RIPPLES
// The ripples (ripples.js): a height field on a grid fixed to the river. uRip: grid x of its first column, cell size, river y of its
// first row less the boat's, how high a unit of the field stands; uRipN: cells across and along.
uniform sampler2D uH; uniform vec4 uRip; uniform vec2 uRipN;
// At a point on the water: the slope (along x, along the river), the curvature (the Laplacian) and the height, in river units.
// They fade out over the sponge rows at the grid's ends, and where a cell is smaller than about a pixel and a half (far), so far water does not shimmer.
vec4 ripple(vec3 w, float far) {
  vec2 g = vec2((w.x - uRip.x) / uRip.y, (-w.z - uRip.z) / uRip.y), e = 1. / uRipN, uv = g * e;
  float c = texture(uH, uv).r, l = texture(uH, uv - vec2(e.x, 0)).r, r = texture(uH, uv + vec2(e.x, 0)).r, d = texture(uH, uv - vec2(0, e.y)).r, u = texture(uH, uv + vec2(0, e.y)).r;
  float k = smoothstep(2., ${SPONGE}., min(g.y, uRipN.y - g.y)) * clamp(1.8 - 1.1 * far / uRip.y, 0., 1.);
  return vec4(vec3((r - l) * 0.5 / uRip.y, (u - d) * 0.5 / uRip.y, (l + r + d + u - 4. * c) / (uRip.y * uRip.y)) * uRip.w, c) * k;
}
#endif
`;
// Tone mapping, gamma and a little dither against banding in the dark; fragment shaders only.
const POST = `
vec3 post(vec3 c) {
  c = 1. - exp(-c * uExpo);
  c = pow(c, vec3(1. / 2.2));
  return c + (hash(gl_FragCoord.xy) - 0.5) / 255.;
}
`;

// ---------- ground: water and banks in one grid ----------
const GROUND_VS = `#version 300 es
${COMMON}
in vec2 aP; // x: column code (|c| <= 1 water across, else bank at |c| - 1 outside the edge); y: distance ahead
uniform float uShift;
out vec3 vW; out vec3 vN;
void main() {
  float d = aP.y - uShift, yA = uSY + d;
  vec4 r = row0(yA);
  float c = aP.x, x, y = 0.;
  vN = vec3(0, 1, 0);
  if (abs(c) <= 1.) x = r.x + c * r.y;
  else {
    float off = abs(c) - 1., side = sign(c);
    x = r.x + side * (r.y + off); y = bankH(off, yA, side);
    float dOff = (bankH(off + 0.004, yA, side) - bankH(max(0., off - 0.004), yA, side)) / (off + 0.004 - max(0., off - 0.004));
    float dY = (bankH(off, yA + 0.01, side) - bankH(off, yA - 0.01, side)) / 0.02;
    vN = normalize(vec3(-side * dOff, 1., dY));
  }
  vW = vec3(x, y, -d);
  gl_Position = uVP * vec4(vW, 1.);
}`;
const GROUND_FS = `#version 300 es
${COMMON}${POST}
in vec3 vW; in vec3 vN;
out vec4 o;
// Sum of travelling waves over river coordinates q; returns the slope (d/dx, d/dy).
vec2 waves(vec2 q, float t, float far) {
  vec2 g = vec2(0);
  const int N = 6;
  vec3 W[N] = vec3[N](vec3(0.2, 1., 60.), vec3(-0.6, 0.8, 83.), vec3(0.9, 0.45, 107.), vec3(-0.35, 0.95, 146.), vec3(0.7, -0.7, 195.), vec3(0.05, 1., 250.));
  for (int i = 0; i < N; i++) {
    vec2 dir = normalize(W[i].xy); float f = W[i].z;
    float a = 0.0028 * 60. / f * clamp(1. - far * f * 0.12, 0., 1.);
    float ph = dot(dir, q) * f - t * (2. + f * 0.04);
    g += a * f * dir * cos(ph);
  }
  return g;
}
void main() {
  float yA = uSY - vW.z;
  vec4 r = row0(yA), r1 = row1(yA);
  vec3 v = normalize(uEye - vW);
  float e = abs(vW.x - r.x) - r.y;
  float far = length(fwidth(vec2(vW.x, yA)));
  vec3 col;
  if (e < 0.002 && vW.y < 0.004) {
    // water
    float fl = r.z;
    vec2 q = vec2(vW.x, yA - uTime * 0.3);
    vec2 g = waves(q, uTime, far) * (1. - 0.5 * fl);
    // the waterfall: fast streaks of white water running with the current
    vec2 qf = vec2(vW.x * 70., (yA - uTime * 2.6) * 7.);
    float foam = 0.;
    if (fl > 0.001) {
      float s1 = vnoise(qf), s2 = vnoise(qf * vec2(2.3, 1.9) + 3.1), s3 = vnoise(vec2(vW.x * 25., (yA - uTime * 3.4) * 3.));
      float streak = smoothstep(0.5, 0.75, s1 * 0.5 + s2 * 0.3 + s3 * 0.35);
      foam = fl * clamp(0.15 + 0.9 * streak, 0., 1.);
      g += fl * 0.06 * vec2(s1 - 0.5, s2 - 0.5);
    }
    // rain stretches roughen the surface
    g += r1.z * 0.03 * vec2(vnoise(q * 90. + uTime * 7.) - 0.5, vnoise(q * 90. - uTime * 6.) - 0.5);
    // a little noise so the water never repeats
    float n0 = vnoise(q * 18. + uTime * 0.4), nx = vnoise((q + vec2(0.01, 0)) * 18. + uTime * 0.4), ny = vnoise((q + vec2(0, 0.01)) * 18. + uTime * 0.4);
    g += vec2(nx - n0, ny - n0) * 0.25 * clamp(1. - far * 30., 0., 1.);
#ifdef RIPPLES
    vec4 rp = ripple(vW, far);
    g += rp.xy;
    foam = max(foam, smoothstep(0.16, 0.42, rp.w) * 0.85); // the crest of a blow's ring breaks white
#endif
    vec3 n = normalize(vec3(-g.x, 1., g.y));
    // the boat's wake: two arms of foam behind the boat along its own path
    float tx = r.w;
    if (yA < uSY) {
      float db = uSY - yA, dx = abs(vW.x - tx);
      float arm = abs(dx - (0.016 + 0.2 * db));
      float wn = vnoise(vec2(vW.x * 60., yA * 60.));
      foam = max(foam, (exp(-arm * arm / 0.00006) * 0.8 + exp(-dx * dx / 0.00012) * 0.5) * exp(-db * 4.) * smoothstep(0.25, 0.75, wn) * 1.3);
    }
    // wind stretches: streaks blowing across the river
    if (abs(r1.y) > 0.01) {
      float wl = vnoise(vec2((vW.x - uTime * 0.6 * sign(r1.y)) * 5., yA * 45.));
      foam = max(foam, abs(r1.y) * smoothstep(0.72, 0.95, wl) * 0.6);
    }
    vec3 alb = uWet;
    col = shade(vW, n, v, alb, 160., 0.32, 0.6);
    // the sky in the water
    float fres = 0.02 + 0.98 * pow(1. - max(dot(n, v), 0.), 5.);
    vec3 rd = reflect(-v, n);
    vec3 sky = mix(vec3(0.003, 0.005, 0.011), uHorizon * 1.2, uDawn * (1. - 0.6 * clamp(rd.y, 0., 1.)));
    col += fres * sky;
#ifdef RIPPLES
    // The lantern mirrored in the water: a tight glint that the ripples break into pieces. Where the normal turns faster than
    // a pixel can show, the glint widens instead of flickering (the normal's spread lowers its sharpness).
    vec3 hv = normalize(normalize(uLamp - vW) + v), dn = fwidth(n);
    float sh = 1100. / (1. + 1100. * dot(dn, dn) * 1.5);
    col += uLampCol * lampW(vW) * pow(max(dot(n, hv), 0.), sh) * (sh + 2.) / 8. * 0.035;
    // The lantern's light under the surface, seen through it: shifted where the surface tilts, and gathered under
    // crests and spread under troughs (the curvature), as the bright lines on a pool's floor are.
    float caus = clamp(1. - rp.z * 0.006, 0.6, 1.8);
    col += uLampCol * uWet * 1.0 * (lampW(vW + vec3(rp.x, 0., -rp.y) * 0.05) * caus - lampW(vW));
#endif
    if (foam > 0.) {
      vec3 fc = shade(vW, vec3(0, 1, 0), v, vec3(0.75, 0.82, 0.85), 8., 0.05, 1.);
      col = mix(col, fc + vec3(0.015, 0.02, 0.025) * fl, clamp(foam, 0., 1.));
    }
  } else {
    // bank: earth at the water, grass above
    vec3 n = normalize(vN);
    float gn = vnoise(vec2(vW.x * 40., yA * 40.)), gn2 = vnoise(vec2(vW.x * 9., yA * 9.));
    vec3 earth = vec3(0.06, 0.045, 0.03), grass = mix(vec3(0.03, 0.05, 0.02), vec3(0.06, 0.075, 0.03), gn);
    vec3 alb = mix(earth, grass, smoothstep(0.015, 0.05, vW.y)) * (0.7 + 0.6 * gn2);
    if (uStone > 0.5) { // courses of stone, joints staggered
      float row = floor(yA / 0.12), jx = fract((vW.x + mod(row, 2.) * 0.1) / 0.2), jy = fract(yA / 0.12);
      float joint = max(step(jx, 0.035), step(jy, 0.05));
      alb = (uStone > 1.5 ? vec3(0.17, 0.12, 0.23) : vec3(0.16, 0.16, 0.18)) * (0.7 + 0.5 * gn2) * (1. - 0.6 * joint);
    }
    float wet = 1. - smoothstep(0., 0.03, e);
    col = shade(vW, n, v, alb, 30. + 30. * wet, 0.04 + 0.4 * wet, 0.1);
  }
  o = vec4(post(atmos(col, vW)), 1.);
}`;

// ---------- solid things in the water: rocks, ice, logs, islands, geyser spouts ----------
const OBJ_VS = `#version 300 es
${COMMON}
in vec3 aPos;
in vec4 aA; // x, z, rad, len
in vec4 aB; // kind, seed, sink, unused
out vec3 vW; out vec3 vN; out vec3 vL; flat out float vKind; flat out float vSeed;
void main() {
  vec3 dir = aPos; float rad = aA.z, len = aA.w, kind = aB.x, seed = aB.y;
  vec3 p; vec3 n = dir; float base;
  if (kind == 1.) { // ice: a flat floe, never smaller than its radius at the waterline
    p = dir * rad * (1.02 + 0.06 * vnoise(dir.xz * 3. + seed));
    p.y = clamp(p.y * 0.6, -rad * 0.3, rad * 0.17);
    base = 0.;
  } else if (kind == 2.) { // log: a capsule whose half length is len + rad
    p = dir * rad; p.x += (dir.x >= 0. ? 1. : -1.) * len; base = -0.3 * rad;
  } else if (kind == 5.) { // geyser spout
    float s = 1. + 0.08 * sin(uTime * 50.);
    p = dir * rad * s;
    if (dir.y > 0.) p.y *= 2.6 + 0.5 * sin(uTime * 9. + seed) + 0.3 * sin(uTime * 23.);
    p.xz *= 1. + 0.15 * sin(dir.y * 9. - uTime * 30.);
    base = 0.;
  } else { // rock: a lumpy low dome, only ever pushed outward from its radius
    float k = vnoise(dir.xz * 2.3 + dir.y * 1.7 + seed) * 0.7 + vnoise(dir.xy * 5.1 + seed * 2.) * 0.3;
    p = dir * rad * (1.03 + 0.13 * k);
    p.y *= kind == 3. ? 1.0 : 0.95;
    base = -0.12 * rad - aB.z;
  }
  vW = vec3(aA.x + p.x, base + p.y, aA.y + p.z);
  vN = n; vL = dir; vKind = kind; vSeed = seed;
  gl_Position = uVP * vec4(vW, 1.);
}`;
const OBJ_FS = `#version 300 es
${COMMON}${POST}
in vec3 vW; in vec3 vN; in vec3 vL; flat in float vKind; flat in float vSeed;
out vec4 o;
void main() {
  if (vW.y < -0.004) discard;
  vec3 v = normalize(uEye - vW);
  vec3 fn = normalize(cross(dFdx(vW), dFdy(vW))); if (dot(fn, v) < 0.) fn = -fn;
  vec3 col;
  float wetBand = 1. - smoothstep(0., 0.025, vW.y);
  if (vKind == 1.) {
    // ice: pale, glassy rim, light passes into it
    vec3 n = normalize(mix(fn, normalize(vN * vec3(1., 2.5, 1.)), 0.35));
    float fres = pow(1. - max(dot(n, v), 0.), 3.);
    float top = smoothstep(0.004, 0.014, vW.y);
    float crack = smoothstep(0.92, 1., vnoise(vW.xz * 140. + vSeed)) * top;
    vec3 alb = mix(vec3(0.16, 0.36, 0.44), vec3(0.5, 0.68, 0.76), top) + crack * 0.4;
    col = shade(vW, n, v, alb * 0.7, 200., 1.6, 0.5);
    float rim = smoothstep(0.75, 1., length(vL.xz)) * top; // the floe's edge catches the light
    col += uLampCol * lampW(vW) * (vec3(0.05, 0.2, 0.26) * (1. - top) + vec3(0.25, 0.32, 0.36) * rim);
    col += fres * vec3(0.02, 0.035, 0.05) + vec3(0.003, 0.008, 0.011);
  } else if (vKind == 2.) {
    // log: bark with rings at the cut ends
    vec3 n = normalize(vN);
    float bark = vnoise(vec2(vW.x * 160., vL.y * 4. + vL.z * 4.));
    vec3 alb = mix(vec3(0.2, 0.12, 0.06), vec3(0.32, 0.21, 0.11), bark);
    if (abs(vL.x) > 0.7) alb = mix(vec3(0.42, 0.3, 0.17), vec3(0.3, 0.2, 0.1), step(0.5, fract(length(vL.yz) * 6.)));
    col = shade(vW, n, v, alb, 40., 0.15 + 0.6 * wetBand, 0.3);
  } else if (vKind == 5.) {
    // geyser spout: white water, slightly bright of its own
    vec3 n = normalize(vN);
    float s = vnoise(vec2(atan(vL.z, vL.x) * 4., vL.y * 6. - uTime * 12.));
    col = shade(vW, n, v, vec3(0.8, 0.9, 1.) * (0.75 + 0.35 * s), 30., 0.4, 0.8) + vec3(0.05, 0.065, 0.08) * (0.6 + s);
  } else {
    // rock, island, rock that follows: faceted stone, wet and shiny near the water
    float m = vnoise(vW.xz * 90. + vSeed) * 0.6 + vnoise(vW.xz * 25.) * 0.4;
    vec3 alb = vKind == 4. ? vec3(0.24, 0.15, 0.13) : vec3(0.24, 0.23, 0.24);
    alb *= 0.75 + 0.5 * m;
    if (vKind == 3. && fn.y > 0.55) alb = mix(vec3(0.1, 0.2, 0.08), vec3(0.18, 0.3, 0.1), m);
    alb *= 1. - 0.45 * wetBand;
    col = shade(vW, fn, v, alb, 45., 0.25 + 1.2 * wetBand, 0.15);
  }
  o = vec4(post(atmos(col, vW)), 1.);
}`;

// ---------- reeds along both banks ----------
const REED_VS = `#version 300 es
${COMMON}
in vec2 aB; // t along the blade, side of the blade's width
uniform float uReedBase;
out vec3 vW; out float vT;
void main() {
  float k = uReedBase + float(gl_InstanceID / 2), side = gl_InstanceID % 2 == 0 ? -1. : 1.;
  float h1 = hash(vec2(k * 0.731, side)), h2 = hash(vec2(side * 1.3, k * 0.173)), h3 = hash(vec2(k * 0.377, side * 3.1));
  float yA = (k + h1) * ${REED_STEP};
  vec4 r = row0(yA);
  float off = 0.002 + 0.05 * h2 * h2;
  float ht = (0.04 + 0.09 * h3) * (h2 < 0.15 ? 0.5 : 1.) * uReedK;
  float t = aB.x;
  float sway = sin(uTime * 1.7 + yA * 2.3 + h1 * 6.) * 0.18 + (h3 - 0.5) * 0.5 + side * 0.25;
  vec3 p = vec3(r.x + side * (r.y + off) + sway * ht * t * t + aB.y * 0.0045 * (1. - t), bankH(off, yA, side) + ht * t - 0.004, -(yA - uSY));
  vW = p; vT = t;
  gl_Position = uVP * vec4(p, 1.);
}`;
const REED_FS = `#version 300 es
${COMMON}${POST}
in vec3 vW; in float vT;
out vec4 o;
void main() {
  vec3 v = normalize(uEye - vW);
  vec3 alb = mix(vec3(0.02, 0.03, 0.012), vec3(0.4, 0.36, 0.12), vT * vT);
  vec3 col = shade(vW, normalize(vec3(0., 0.5, 1.)), v, alb, 10., 0.1, 1.);
  col += uLampCol * lampW(vW) * vec3(0.3, 0.24, 0.07) * vT * vT; // light through the leaf tips
  o = vec4(post(atmos(col, vW)), 1.);
}`;

// ---------- the boat ----------
const BOAT_VS = `#version 300 es
${COMMON}
in vec3 aPos; in vec3 aNor; in vec4 aCol;
uniform mat4 uModel;
out vec3 vW; out vec3 vN; out vec4 vC;
void main() {
  vec4 w = uModel * vec4(aPos, 1.);
  vW = w.xyz; vN = mat3(uModel) * aNor; vC = aCol;
  gl_Position = uVP * w;
}`;
const BOAT_FS = `#version 300 es
${COMMON}${POST}
in vec3 vW; in vec3 vN; in vec4 vC;
uniform float uFlick;
out vec4 o;
void main() {
  if (vW.y < -0.003 && vC.a < 0.5) discard;
  vec3 v = normalize(uEye - vW);
  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  vec3 paint = mix(vC.rgb, uTint * (0.35 + 1.4 * dot(vC.rgb, vec3(0.33))), uTintK);
  vec3 col = shade(vW, n, v, paint, 30., 0.15, 0.4);
  if (vC.a > 1.5) col = vC.rgb * uLampCol * 0.9 * uFlick; // lantern glass glows
  o = vec4(post(atmos(col, vW)), 1.);
}`;

// ---------- flat marks on the water: foam rings, whirlpools, ripples, the shield ring, reflections ----------
const DECAL_VS = `#version 300 es
${COMMON}
in vec2 aC;
in vec4 aA; // x, z, half size x, half size z
in vec4 aB; // type, p1, p2, p3
in vec4 aCol;
out vec2 vL; out vec3 vW; flat out vec4 vB; out vec4 vCol; out vec2 vSize;
void main() {
  vec2 lp = aC * aA.zw;
  vW = vec3(aA.x + lp.x, 0.003, aA.y + lp.y);
  vL = lp; vB = aB; vCol = aCol; vSize = aA.zw;
  gl_Position = uVP * vec4(vW, 1.);
}`;
const DECAL_FS = `#version 300 es
${COMMON}${POST}
in vec2 vL; in vec3 vW; flat in vec4 vB; in vec4 vCol; in vec2 vSize;
out vec4 o;
float ring(float d, float r, float w) { float x = (d - r) / w; return exp(-x * x); }
void main() {
  int type = int(vB.x + 0.5);
  vec3 v = normalize(uEye - vW);
  float lit = lampW(vW);
  vec3 foamLit = shade(vW, vec3(0, 1, 0), v, vec3(0.7, 0.78, 0.82), 8., 0.05, 1.);
  float d = length(vL);
  vec4 c = vec4(0);
  if (type == 0) { // foam where the water meets a solid thing (p1 rad, p2 len)
    float dd = length(vec2(max(0., abs(vL.x) - vB.z), vL.y));
    float n = vnoise(vec2(atan(vL.y, vL.x) * 5. + uTime * 2., dd * 80. - uTime * 3.));
    float a = smoothstep(vB.y * 0.98, vB.y * 1.05, dd) * (1. - smoothstep(vB.y * 1.05, vB.y * 1.3, dd)) * smoothstep(0.35, 0.8, n);
    c = vec4(foamLit * a * 0.8, a * 0.5);
  } else if (type == 1) { // whirlpool: arms turning in to a dark centre (p1 rad)
    float ang = atan(vL.y, vL.x);
    float arm = sin(ang * 3. + log(d + 0.004) * 9. + uTime * 5.);
    float a = smoothstep(0.3, 1., arm) * smoothstep(0.17, 0.08, d) * smoothstep(vB.y * 0.8, vB.y * 1.6, d);
    vec3 col = foamLit * a * 0.8;
    float hole = 1. - smoothstep(vB.y * 0.95, vB.y * 1.25, d);
    float shade2 = smoothstep(0.16, vB.y, d) * 0.45;
    c = vec4(col * (1. - hole), max(hole, max(a * 0.6, shade2)));
    c.rgb += uLampCol * lit * vec3(0.2, 0.3, 0.35) * ring(d, vB.y * 1.15, vB.y * 0.15) * 0.5; // light on the rim
  } else if (type == 2) { // ripple over a hidden rock (p1 rad)
    float t = fract(uTime * 0.7);
    float a = ring(d, vB.y * (0.6 + 0.6 * t), 0.004) * (1. - t) + ring(d, vB.y * 0.8, 0.003) * 0.6;
    vec3 col = foamLit * 0.9 + vec3(0.03, 0.05, 0.07);
    c = vec4(col * a, a * 0.4);
  } else if (type == 3) { // the path of a spinning pair (p1 radius of the circle)
    float a = ring(d, vB.y, 0.003) * 0.5;
    c = vec4((foamLit * 0.7 + vec3(0.015, 0.025, 0.035)) * a, a * 0.3);
  } else if (type == 4) { // a resting geyser: a dashed ring (p1 rad)
    float ang = atan(vL.y, vL.x);
    float dash = step(0.45, fract(ang / 6.2832 * 14.));
    float a = ring(d, vB.y, 0.004) * dash + ring(d, vB.y * 0.4, 0.012) * 0.3 * (0.5 + 0.5 * sin(uTime * 6.));
    c = vec4((foamLit + vec3(0.04, 0.06, 0.08)) * a, a * 0.5);
  } else if (type == 5) { // a blowing geyser: splash around the spout (p1 rad)
    float n = vnoise(vec2(atan(vL.y, vL.x) * 6., d * 60. - uTime * 8.));
    float a = smoothstep(vB.y * 0.9, vB.y * 1.1, d) * (1. - smoothstep(vB.y * 1.1, vB.y * 1.9, d)) * (0.4 + 0.6 * n);
    c = vec4((foamLit + vec3(0.03, 0.04, 0.05)) * a, a * 0.8);
  } else if (type == 6) { // shield ring around the boat (p1 radius, colour gives strength)
    float a = ring(d, vB.y, 0.0035) + 0.2 * ring(d, vB.y, 0.012);
    c = vec4(vCol.rgb * a, 0.);
  } else if (type == 7) { // a light's reflection: a shimmering streak running toward the camera
    float along = vL.y / vSize.y; // -1 far end, 1 near end
    float across = vL.x + 0.006 * sin(vL.y * 140. - uTime * 6.) * along;
#ifdef RIPPLES
    vec4 rp = ripple(vW, length(fwidth(vW.xz))); // ripples bend the streak and break it where the water is steep
    across += rp.x * 0.02;
    float broken = clamp(1. - 2.2 * length(rp.xy), 0.08, 1.);
#else
    float broken = 1.;
#endif
    float s = broken * exp(-across * across / (vB.y * vB.y)) * smoothstep(1., 0.2, abs(along)) * (0.55 + 0.45 * vnoise(vec2(vL.x * 200., vL.y * 70. - uTime * 3.)));
    c = vec4(vCol.rgb * s, 0.);
  }
  // tone map the colour itself, then premultiply again, so faint foam is not brightened by the gamma curve
  vec3 lin = c.a > 0.001 ? c.rgb / c.a : c.rgb;
  lin = pow(max(1. - exp(-lin * uExpo), 0.), vec3(1. / 2.2));
  o = vec4(c.a > 0.001 ? lin * c.a : lin, c.a);
}`;

// ---------- glowing things: embers, hearts, shields, the flame, sparks, eyes ----------
const SPRITE_VS = `#version 300 es
${COMMON}
in vec2 aC;
in vec4 aA; // x, y, z, size
in vec4 aCol; // colour, kind
uniform vec3 uCamR; uniform vec3 uCamU;
out vec2 vL; out vec4 vCol;
void main() {
  vec3 p = aA.xyz + (uCamR * aC.x + uCamU * aC.y) * aA.w;
  vL = aC; vCol = aCol;
  gl_Position = uVP * vec4(p, 1.);
}`;
const SPRITE_FS = `#version 300 es
precision highp float;
in vec2 vL; in vec4 vCol;
out vec4 o;
uniform float uTime;
void main() {
  int kind = int(vCol.a + 0.5);
  float d = length(vL);
  vec3 c = vCol.rgb;
  float a;
  if (kind == 1) { // heart: glow with a heart shape in the middle
    vec2 p = vL * 2.6; p.y = -p.y + 0.35;
    p.y -= sqrt(abs(p.x)) * 0.6;
    float h = 1. - smoothstep(0.55, 0.65, length(p));
    float g = exp(-d * d * 5.);
    o = vec4(c * g * 0.8 + vec3(1., 0.3, 0.38) * h * 1.2, 1.); return;
  } else if (kind == 2) { // flame: a teardrop that flickers
    vec2 p = vL; p.y += 0.25; p.x *= 1.0 + max(p.y, 0.) * 1.6;
    float f = exp(-dot(p, p) * 9.);
    float core = exp(-dot(p * vec2(2., 1.3), p * vec2(2., 1.3)) * 14.);
    o = vec4(c * f + vec3(1., 0.95, 0.8) * core, 1.); return;
  } else if (kind == 3) { // spark
    a = 1. - smoothstep(0.3, 1., d);
  } else if (kind == 4) { // shield pickup: glow and a ring
    a = exp(-d * d * 5.) + 0.8 * exp(-pow((d - 0.42) / 0.06, 2.));
  } else { // ember, false ember, glow, eye
    a = exp(-d * d * 6.) + 0.9 * exp(-d * d * 40.);
  }
  o = vec4(c * a, 1.);
}`;

// ---------- overlay: dawn sky, lightning, rain, vignette ----------
const OVER_VS = `#version 300 es
out vec2 vU;
void main() { vec2 p = vec2(gl_VertexID == 1 ? 3. : -1., gl_VertexID == 2 ? 3. : -1.); vU = p * 0.5 + 0.5; gl_Position = vec4(p, 0., 1.); }`;
const OVER_FS = `#version 300 es
precision highp float;
in vec2 vU;
out vec4 o;
uniform float uDawnTop; uniform float uDawnBot; uniform float uFlash; uniform float uRain; uniform float uTime; uniform vec2 uRes;
float hash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
void main() {
  vec3 add = vec3(0); float a = 0.;
  // vignette
  vec2 q = vU - 0.5; float vig = smoothstep(0.35, 0.9, length(q * vec2(uRes.x / uRes.y, 1.) * 1.3));
  a = vig * 0.35;
  // dawn: warm light at the top of the screen, cool at the bottom
  vec3 dawn = mix(vec3(0.47, 0.59, 0.75) * uDawnBot, vec3(1., 0.77, 0.55) * uDawnTop, vU.y);
  add += dawn * 0.75;
  // rain streaks
  if (uRain > 0.) {
    vec2 p = vec2(vU.x * uRes.x / uRes.y * 40. + vU.y * 6., vU.y * 4. + uTime * 3.);
    vec2 cell = floor(p); vec2 f = fract(p);
    float h = hash(cell);
    float x = abs(f.x - h * 0.8 - 0.1);
    float s = step(0.8, hash(cell + 7.)) * smoothstep(0.03, 0., x) * smoothstep(0., 0.3, f.y) * smoothstep(1., 0.5, f.y);
    add += vec3(0.6, 0.7, 0.8) * s * 0.45 * uRain;
  }
  add += vec3(0.85, 0.88, 1.) * uFlash * 0.35;
  o = vec4(add, a * (1. - uFlash));
}`;

// ---------- helpers ----------
function mul(a, b) {
  const r = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let rr = 0; rr < 4; rr++) { let v = 0; for (let k = 0; k < 4; k++) v += a[k * 4 + rr] * b[c * 4 + k]; r[c * 4 + rr] = v; }
  return r;
}
function perspective(fovy, asp, n, f) { const t = 1 / Math.tan(fovy / 2); return new Float32Array([t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]); }
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function lookAt(eye, at, up = [0, 1, 0]) {
  const z = norm(sub(eye, at)), x = norm(cross(up, z)), y = cross(z, x);
  return { m: new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]), x, y };
}
// the flat page's ability colours, brightened for the dark river
const POWER_COL = { boost: [1.9, 1.6, 0.65], slow: [1.4, 1.0, 1.9], size: [0.65, 1.7, 1.5], magnet: [1.9, 1.0, 1.4], flare: [1.75, 1.8, 1.9] };
function model(tx, ty, tz, yaw, roll) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cr = Math.cos(roll), sr = Math.sin(roll);
  // rotate about z (roll) then about y (yaw), then translate
  return new Float32Array([cy * cr, sr, -sy * cr, 0, -cy * sr, cr, sy * sr, 0, sy, 0, cy, 0, tx, ty, tz, 1]);
}

function icosphere(sub) {
  const t = (1 + Math.sqrt(5)) / 2;
  let v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(norm);
  let f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let i = 0; i < sub; i++) {
    const cache = new Map(), nf = [];
    const mid = (a, b) => { const k = a < b ? a + ',' + b : b + ',' + a; if (!cache.has(k)) { v.push(norm([(v[a][0] + v[b][0]) / 2, (v[a][1] + v[b][1]) / 2, (v[a][2] + v[b][2]) / 2])); cache.set(k, v.length - 1); } return cache.get(k); };
    for (const [a, b, c] of f) { const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); nf.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
    f = nf;
  }
  return { pos: new Float32Array(v.flat()), idx: new Uint16Array(f.flat()) };
}

// The boat: a small open hull with a post and a lantern, built from flat-shaded triangles.
// Boat space: x to starboard, y up, z toward the stern (the bow points to -z).
function boatMesh() {
  const out = [];
  const tri = (a, b, c, col, glow = 1) => { const n = norm(cross(sub(b, a), sub(c, a))); for (const p of [a, b, c]) out.push(...p, ...n, ...col, glow); };
  const quad = (a, b, c, d, col, glow) => { tri(a, b, c, col, glow); tri(a, c, d, col, glow); };
  const oak = [0.42, 0.27, 0.15], dark = [0.25, 0.15, 0.08], floor = [0.55, 0.4, 0.24], rim = [0.6, 0.45, 0.28];
  // cross sections from bow to stern: z, half beam, gunwale height
  const S = [[-0.054, 0.0, 0.03], [-0.036, 0.016, 0.023], [-0.012, 0.025, 0.019], [0.014, 0.025, 0.019], [0.036, 0.018, 0.022]];
  const ring = ([z, w, top]) => [[-w, top, z], [-w * 0.8, 0.002, z], [0, -0.012, z], [w * 0.8, 0.002, z], [w, top, z]];
  for (let i = 0; i < S.length - 1; i++) {
    const a = ring(S[i]), b = ring(S[i + 1]);
    for (let j = 0; j < 4; j++) quad(a[j], b[j], b[j + 1], a[j + 1], j === 0 || j === 3 ? oak : dark);
    // gunwale rim: a thin strip on top of each side
    for (const side of [-1, 1]) {
      const p = side < 0 ? 0 : 4, ia = a[p], ib = b[p], inw = side * -0.004;
      quad(ia, ib, [ib[0] + inw, ib[1] + 0.002, ib[2]], [ia[0] + inw, ia[1] + 0.002, ia[2]], rim);
    }
  }
  // transom at the stern
  const st = ring(S[S.length - 1]);
  tri(st[0], st[1], st[2], dark); tri(st[0], st[2], st[4], dark); tri(st[2], st[3], st[4], dark);
  // floor boards
  const fl = (z, w) => [[-w * 0.85, 0.006, z], [w * 0.85, 0.006, z]];
  for (let i = 1; i < S.length - 1; i++) { const a = fl(S[i][0], S[i][1]), b = fl(S[i + 1][0], S[i + 1][1]); quad(a[0], a[1], b[1], b[0], floor); }
  // a seat across the middle
  quad([-0.023, 0.014, -0.004], [0.023, 0.014, -0.004], [0.023, 0.014, 0.006], [-0.023, 0.014, 0.006], rim);
  // the post and the lantern
  const box = (x0, y0, z0, x1, y1, z1, col, glow) => {
    const p = (x, y, z) => [x ? x1 : x0, y ? y1 : y0, z ? z1 : z0];
    quad(p(0, 0, 1), p(1, 0, 1), p(1, 1, 1), p(0, 1, 1), col, glow); quad(p(1, 0, 0), p(0, 0, 0), p(0, 1, 0), p(1, 1, 0), col, glow);
    quad(p(0, 0, 0), p(0, 0, 1), p(0, 1, 1), p(0, 1, 0), col, glow); quad(p(1, 0, 1), p(1, 0, 0), p(1, 1, 0), p(1, 1, 1), col, glow);
    quad(p(0, 1, 1), p(1, 1, 1), p(1, 1, 0), p(0, 1, 0), col, glow);
  };
  box(-0.002, 0.006, 0.016, 0.002, 0.07, 0.020, dark);
  box(-0.0065, 0.066, 0.0115, 0.0065, 0.069, 0.0245, [0.35, 0.26, 0.1]); // lantern base
  box(-0.0055, 0.069, 0.0125, 0.0055, 0.082, 0.0235, [1.0, 0.78, 0.45], 2); // glass
  box(-0.007, 0.082, 0.011, 0.007, 0.085, 0.025, [0.35, 0.26, 0.1]); // lantern cap
  return new Float32Array(out);
}
export const LAMP = [0, 0.0755, 0.018]; // the flame, in boat space

export function createRenderer(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance' });
  if (!gl) return null;
  const errors = [];
  function program(vs, fs, name) {
    const p = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { const log = `${name} shader failed to compile: ${gl.getShaderInfoLog(sh)}`; console.error(log); errors.push(log); }
      gl.attachShader(p, sh);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { const log = `${name} program failed to link: ${gl.getProgramInfoLog(p)}`; console.error(log); errors.push(log); }
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i), key = info.name.replace(/\[0\]$/, ''); u[key] = gl.getUniformLocation(p, info.name); }
    return { p, u, a: n => gl.getAttribLocation(p, n) };
  }
  const P = {
    ground: program(GROUND_VS, GROUND_FS, 'ground'), obj: program(OBJ_VS, OBJ_FS, 'rocks'), reed: program(REED_VS, REED_FS, 'reeds'),
    boat: program(BOAT_VS, BOAT_FS, 'boat'), decal: program(DECAL_VS, DECAL_FS, 'water marks'), sprite: program(SPRITE_VS, SPRITE_FS, 'glows'), over: program(OVER_VS, OVER_FS, 'overlay'),
  };
  if (errors.length) return { errors };

  const buf = (data, target = gl.ARRAY_BUFFER, usage = gl.STATIC_DRAW) => { const b = gl.createBuffer(); gl.bindBuffer(target, b); gl.bufferData(target, data, usage); return b; };
  const attr = (prog, name, size, stride, off, div = 0) => { const l = prog.a(name); if (l < 0) return; gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, stride, off); gl.vertexAttribDivisor(l, div); };

  // river table texture
  const rowsTex = gl.createTexture(), rowData = new Float32Array(ROWS * 2 * 4);
  gl.bindTexture(gl.TEXTURE_2D, rowsTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, 2, ROWS, 0, gl.RGBA, gl.FLOAT, rowData);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // ground grid
  const cols = [], offs = [0.004, 0.01, 0.018, 0.028, 0.04, 0.055, 0.075, 0.1, 0.14, 0.2, 0.3, 0.45, 0.7, 1.0];
  for (let i = offs.length - 1; i >= 0; i--) cols.push(-(1 + offs[i]));
  for (let i = 0; i <= 24; i++) cols.push(-1 + 2 * i / 24);
  for (const o of offs) cols.push(1 + o);
  const nr = Math.round((FAR - NEAR) / ROW_STEP) + 1, gv = [], gi = [];
  for (let r = 0; r < nr; r++) for (const c of cols) gv.push(c, NEAR + r * ROW_STEP);
  for (let r = 0; r < nr - 1; r++) for (let c = 0; c < cols.length - 1; c++) { const a = r * cols.length + c, b = a + cols.length; gi.push(a, b, a + 1, a + 1, b, b + 1); }
  const groundVao = gl.createVertexArray(); gl.bindVertexArray(groundVao);
  buf(new Float32Array(gv)); attr(P.ground, 'aP', 2, 8, 0);
  buf(new Uint16Array(gi), gl.ELEMENT_ARRAY_BUFFER); const groundCount = gi.length;

  // rocks: one sphere mesh drawn once per thing
  const sphere = icosphere(2), MAXOBJ = 96, objData = new Float32Array(MAXOBJ * 8);
  const objVao = gl.createVertexArray(); gl.bindVertexArray(objVao);
  buf(sphere.pos); attr(P.obj, 'aPos', 3, 12, 0);
  const objBuf = buf(objData.byteLength, gl.ARRAY_BUFFER, gl.DYNAMIC_DRAW); attr(P.obj, 'aA', 4, 32, 0, 1); attr(P.obj, 'aB', 4, 32, 16, 1);
  buf(sphere.idx, gl.ELEMENT_ARRAY_BUFFER);

  // reeds
  const reedVao = gl.createVertexArray(); gl.bindVertexArray(reedVao);
  buf(new Float32Array([0, -1, 0, 1, 0.5, -1, 0.5, 1, 1, 0])); attr(P.reed, 'aB', 2, 8, 0);
  buf(new Uint16Array([0, 1, 2, 1, 3, 2, 2, 3, 4]), gl.ELEMENT_ARRAY_BUFFER);
  const reedCount = 2 * Math.ceil(REED_SPAN / REED_STEP);

  // boat
  const boatData = boatMesh(), boatVao = gl.createVertexArray(); gl.bindVertexArray(boatVao);
  buf(boatData); attr(P.boat, 'aPos', 3, 40, 0); attr(P.boat, 'aNor', 3, 40, 12); attr(P.boat, 'aCol', 4, 40, 24);
  const boatCount = boatData.length / 10;

  // quads for marks on the water and for glows
  const quadBuf = buf(new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]));
  const MAXDEC = 128, decData = new Float32Array(MAXDEC * 12), decVao = gl.createVertexArray(); gl.bindVertexArray(decVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf); attr(P.decal, 'aC', 2, 8, 0);
  const decBuf = buf(decData.byteLength, gl.ARRAY_BUFFER, gl.DYNAMIC_DRAW); attr(P.decal, 'aA', 4, 48, 0, 1); attr(P.decal, 'aB', 4, 48, 16, 1); attr(P.decal, 'aCol', 4, 48, 32, 1);
  const MAXSPR = 256, sprData = new Float32Array(MAXSPR * 8), sprVao = gl.createVertexArray(); gl.bindVertexArray(sprVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf); attr(P.sprite, 'aC', 2, 8, 0);
  const sprBuf = buf(sprData.byteLength, gl.ARRAY_BUFFER, gl.DYNAMIC_DRAW); attr(P.sprite, 'aA', 4, 32, 0, 1); attr(P.sprite, 'aCol', 4, 32, 16, 1);
  const overVao = gl.createVertexArray();
  gl.bindVertexArray(null);

  let W = 1, H = 1, camX = 0.5, vp = null, view = null, cam = null, trail = [], lastY = -1;

  // ---------- the ripples (ripples.js, ripples-gl.js): on unless the browser cannot run them, the frames run long, or the player asks for less motion ----------
  // ?ripples=0, 1 or 2 holds a quality level (the checks use this); ?ripples=cpu runs the CPU solver. Nothing is saved.
  const ask = typeof location === 'undefined' ? '' : new URLSearchParams(location.search).get('ripples') ?? '';
  const calm = typeof matchMedia === 'undefined' ? null : matchMedia('(prefers-reduced-motion: reduce)');
  const RIP = { level: 2, pinned: /[0-2]/.test(ask) ? Number(ask.match(/[0-2]/)[0]) : null, cpu: ask.includes('cpu'), water: null, mem: {}, t: 0, y: 0, at: 0, still: false, hide: false,
    gaps: [], since: 0, steps: 0, drops: 0, queued: [], extra: 0, broken: false, fell: [] };
  const HEIGHT = 0.04; // how high a unit of the field stands, river units
  // The rippled ground and water marks: the same shaders with RIPPLES defined, attributes where the plain programs have them.
  // A failure here turns ripples off and never stops the 3D view.
  function variant(vs, fs, base, names) {
    const p = gl.createProgram(), def = src => src.replace('#version 300 es', '#version 300 es\n#define RIPPLES');
    for (const [type, src] of [[gl.VERTEX_SHADER, def(vs)], [gl.FRAGMENT_SHADER, def(fs)]]) { const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh); gl.attachShader(p, sh); gl.deleteShader(sh); }
    for (const n of names) { const l = base.a(n); if (l >= 0) gl.bindAttribLocation(p, l, n); }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.warn('Lantern ripples: the rippled water did not build', gl.getProgramInfoLog(p)); gl.deleteProgram(p); return null; }
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, info.name); }
    return { p, u, a: n => gl.getAttribLocation(p, n) };
  }
  let PR = null; // { ground, decal } once built
  const want = () => RIP.broken ? 0 : RIP.pinned ?? (calm?.matches ? 0 : RIP.level);
  function ensure() { // the water at the level wanted, made or dropped as needed
    const lv = want();
    if (RIP.water && RIP.water.level === lv) return RIP.water;
    RIP.water?.dispose(); RIP.water = null; RIP.mem = {};
    if (!lv) return null;
    if (!PR) { PR = { ground: variant(GROUND_VS, GROUND_FS, P.ground, ['aP']), decal: variant(DECAL_VS, DECAL_FS, P.decal, ['aC', 'aA', 'aB', 'aCol']) }; if (!PR.ground || !PR.decal) { RIP.broken = true; return null; } }
    RIP.water = createWaterGL(gl, lv, { cpu: RIP.cpu });
    // Without float render targets the field runs on the CPU: start it at level 1 (a quarter of the work) unless a level is pinned.
    if (RIP.water?.path === 'cpu' && lv === 2 && RIP.pinned === null) { RIP.water.dispose(); RIP.level = 1; RIP.water = createWaterGL(gl, 1, { cpu: true }); }
    if (!RIP.water) RIP.broken = true;
    return RIP.water;
  }
  // Frames that run long step the ripples down a level, never back up: 90 frames in play averaging over 25 ms (under 40 a second).
  // A gap over 250 ms (a hidden page, a pause in the browser) is not counted, nor the first second after a start.
  function frameTook(ms) {
    if (RIP.pinned !== null || !RIP.level) return;
    if (RIP.since < 60 || ms > 250) return;
    RIP.gaps.push(ms); if (RIP.gaps.length < 90) return;
    const mean = RIP.gaps.reduce((a, b) => a + b, 0) / RIP.gaps.length; RIP.gaps = [];
    if (mean > 25) { RIP.level--; RIP.fell.push(Math.round(mean)); }
  }
  // Each frame: what disturbs the water since the last, then the game ticks it lived through (at most four; none while paused).
  function ripples(s, f) {
    const w = ensure(); if (!w) return null;
    const gap = f.now - RIP.at; RIP.at = f.now;
    const jump = f.snap || RIP.mem.s !== s || s.t < RIP.t || Math.abs(s.y - RIP.y) > 0.6 || gap > 1000;
    let ticks = f.playing ? Math.round((s.t - RIP.t) / DT) : Math.round(Math.min(0.1, (f.dt || 0)) / DT);
    RIP.t = s.t; RIP.y = s.y;
    if (jump) { w.reset(); RIP.mem = {}; RIP.since = 0; RIP.gaps = []; ticks = 0; }
    else { RIP.since++; if (f.playing && ticks > 0) frameTook(gap); }
    if (RIP.still) ticks = 0; // held for a check: only run(n) moves the water
    const drops = disturb(s, RIP.mem, ticks, f.now / 1000).concat(RIP.queued.splice(0));
    ticks = Math.max(0, Math.min(4, ticks)) + RIP.extra; RIP.extra = 0;
    if (!ticks && !drops.length && !jump) return w;
    w.step(s.y, riverOf(s), solids(s), drops, ticks);
    RIP.steps += ticks; RIP.drops += drops.length;
    return w;
  }
  calm?.addEventListener?.('change', () => { RIP.mem = {}; });
  // For the browser checks (experiments/kit/check/phone.mjs, 'lantern ripples'): the state, and ways to hold or test it.
  const hook = () => ({ level: RIP.water ? RIP.water.level : 0, path: RIP.water ? RIP.water.path : 'off', pinned: RIP.pinned, reduced: !!calm?.matches, broken: RIP.broken, steps: RIP.steps, drops: RIP.drops, fell: RIP.fell, nx: RIP.water?.nx ?? 0, ny: RIP.water?.ny ?? 0 });
  Object.assign(hook, {
    pin: l => { RIP.pinned = l; }, feed: (ms, n) => { RIP.since = Math.max(RIP.since, 60); for (let i = 0; i < n; i++) frameTook(ms); return hook(); },
    drop: (x, y, r, a) => RIP.queued.push({ x, y, r, a }), run: n => { RIP.extra += n; }, still: on => { RIP.still = on; }, hide: on => { RIP.hide = on; },
    sample: () => RIP.water?.sample() ?? null,
    // The GPU solver against the CPU one (the one bots.mjs checks): one ring by a straight bank, 30 ticks. Returns the largest difference and the highest wave.
    agree: async () => {
      const { createField } = await import('./ripples.js'), level = RIP.water?.level || 2, a = createWaterGL(gl, level), b = createField(level), river = () => [0.5, 0.3], d = [{ x: 0.55, y: 11, r: 0.04, a: 1 }], rock = [{ x: 0.42, y: 11.12, rad: 0.03, len: 0 }];
      a.step(10, river, rock, d, 0); b.step(10, river, rock, d, 0); a.step(10, river, rock, [], 30); b.step(10, river, rock, [], 30);
      const x = a.sample(); a.dispose(); let diff = 0, top = 0; for (let k = 0; k < x.h.length; k++) { diff = Math.max(diff, Math.abs(x.h[k] - b.h[k])); top = Math.max(top, Math.abs(b.h[k])); }
      return { path: a.path, diff, top };
    },
  });
  if (typeof window !== 'undefined') window.lanternRipples = hook;

  function resize(w, h) { W = w; H = h; canvas.width = w; canvas.height = h; }
  // Where a point on the water lands on the screen, in device pixels.
  function project(x, z, y = 0) {
    if (!vp) return [0, 0];
    const m = vp, X = m[0] * x + m[4] * y + m[8] * z + m[12], Y = m[1] * x + m[5] * y + m[9] * z + m[13], Wc = m[3] * x + m[7] * y + m[11] * z + m[15];
    return [(X / Wc * 0.5 + 0.5) * W, (0.5 - Y / Wc * 0.5) * H];
  }
  // The boat's row on the screen: the device pixel of river x = 0, and device pixels per river unit.
  function boatRow() { const a = project(0, 0), b = project(1, 0); return { left: a[0], unit: b[0] - a[0] }; }

  function setCommon(prog, c) {
    const u = prog.u;
    gl.useProgram(prog.p);
    if (u.uVP) gl.uniformMatrix4fv(u.uVP, false, vp);
    if (u.uEye) gl.uniform3fv(u.uEye, c.eye);
    if (u.uSY) gl.uniform1f(u.uSY, c.sy);
    if (u.uRowInfo) gl.uniform3f(u.uRowInfo, c.yb, DY, ROWS);
    if (u.uRows) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, rowsTex); gl.uniform1i(u.uRows, 0); }
    if (u.uTime) gl.uniform1f(u.uTime, c.time);
    if (u.uLamp) gl.uniform3fv(u.uLamp, c.lamp);
    if (u.uLampCol) gl.uniform3fv(u.uLampCol, c.lampCol);
    if (u.uR) gl.uniform1f(u.uR, c.R);
    if (u.uPt) gl.uniform4fv(u.uPt, c.pt);
    if (u.uPtCol) gl.uniform3fv(u.uPtCol, c.ptCol);
    if (u.uNPt) gl.uniform1i(u.uNPt, c.npt);
    if (u.uAmb) gl.uniform3fv(u.uAmb, c.amb);
    if (u.uHorizon) gl.uniform3fv(u.uHorizon, c.horizon);
    if (u.uDawn) gl.uniform1f(u.uDawn, c.dawnHaze);
    if (u.uExpo) gl.uniform1f(u.uExpo, c.expo);
    if (u.uWet) gl.uniform3fv(u.uWet, c.wet);
    if (u.uHaze) gl.uniform1f(u.uHaze, c.haze);
    if (u.uReedK) gl.uniform1f(u.uReedK, c.reedK);
    if (u.uStone) gl.uniform1f(u.uStone, c.stone);
    if (u.uTint) { gl.uniform3fv(u.uTint, c.tint || [1, 1, 1]); gl.uniform1f(u.uTintK, c.tint ? 0.85 : 0); }
  }

  // f: { now, dt, target, shake, glow, sparks, dawn, day, snap }; Lantern's page adds { cam: '3d' or 'first', fire, wet, tint: colours as
  // three numbers 0 to 1, hideBoat, sink: 0 to 1 after a crash }. Without them the picture is the lab page's.
  function draw(s, f) {
    if (s.y < lastY || f.snap) { trail = []; camX = f.cam === 'first' ? s.x : centre(s, s.y + 0.3); }
    lastY = s.y;
    if (!trail.length || s.y > trail[trail.length - 1][0] + 0.005) trail.push([s.y, s.x]);
    while (trail.length > 2 && trail[0][0] < s.y - 1.6) trail.shift();

    // The time and river y are kept small for the GPU: y is passed relative to a whole number of rows.
    const time = RIP.still ? 1 : (f.now / 1000) % 600;
    const yb = Math.floor(s.y / DY) * DY - BEHIND * DY;
    let ti = 0;
    for (let i = 0; i < ROWS; i++) {
      const y = yb + i * DY, o = i * 8;
      rowData[o] = centre(s, y); rowData[o + 1] = half(s, y); rowData[o + 2] = fall(s, y);
      let tx = trail.length ? (y < trail[0][0] ? trail[0][1] : s.x) : s.x;
      if (y < s.y && trail.length > 1 && y >= trail[0][0]) { while (ti < trail.length - 2 && trail[ti + 1][0] < y) ti++; const a = trail[ti], b = trail[ti + 1]; tx = a[1] + (b[1] - a[1]) * Math.max(0, Math.min(1, (y - a[0]) / (b[0] - a[0] || 1))); }
      rowData[o + 3] = tx;
      rowData[o + 4] = (fog(s, y - 0.3) + 2 * fog(s, y) + fog(s, y + 0.3)) / 4; // softened at the ends of a fog stretch
      rowData[o + 5] = wind(s, y); rowData[o + 6] = rain(s, y) ? 1 : 0; rowData[o + 7] = 0;
    }
    gl.bindTexture(gl.TEXTURE_2D, rowsTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 2, ROWS, gl.RGBA, gl.FLOAT, rowData);

    // camera: pans with the river's centre, never with the boat, so a mouse steering by position stays put
    const own = CAMS[f.cam], C = own || CAM, first = f.cam === 'first', sink = f.sink || 0;
    const mid = centre(s, s.y + 0.3), want = first ? s.x : own ? mid + (s.x - mid) * 0.35 : mid;
    camX += (want - camX) * Math.min(1, (f.dt || 0) * (first ? 14 : 2.5));
    const sh = f.shake * (first ? 0.006 : 0.02), jx = sh * (Math.random() - 0.5), jy = sh * (Math.random() - 0.5);
    const turn = own ? (centre(s, s.y + 1) - centre(s, s.y)) * (first ? 0.7 : 0.35) : 0; // the view turns with the river
    const swing = first ? turn / (C.look + C.back) : 0; // the eye stays behind the boat as the view turns
    const eye = [camX - swing * C.back + jx, C.h * (1 - 0.8 * sink) + jy, C.back], at = [camX + jx + turn, first ? 0.06 + 0.1 * sink : 0, -C.look];
    const tilt = first ? Math.max(-0.5, Math.min(0.5, (f.target - s.x) * 4)) * 0.12 + sink * 0.5 : 0;
    view = lookAt(eye, at, [Math.sin(tilt), Math.cos(tilt), 0]);
    vp = mul(perspective(C.fov * Math.PI / 180, W / H, first ? 0.01 : 0.05, 30), view.m);

    // the boat leans into turns as on the flat page, and turns its bow a little
    const lean = Math.max(-0.5, Math.min(0.5, (f.target - s.x) * 4)), bob = 0.002 * Math.sin(time * 2.1);
    const yaw = -lean * (first ? 0.2 : 0.35) - swing, roll = -lean * 0.45;
    const M = model(s.x, bob, 0, yaw, roll);
    // the size ability makes the boat smaller or bigger, as the rules do
    const grow = boat(s) / BOAT; for (let i = 0; i < 12; i++) M[i] *= grow;
    const lamp = [M[0] * LAMP[0] + M[4] * LAMP[1] + M[8] * LAMP[2] + M[12], M[1] * LAMP[0] + M[5] * LAMP[1] + M[9] * LAMP[2] + M[13], M[2] * LAMP[0] + M[6] * LAMP[1] + M[10] * LAMP[2] + M[14]];
    // the light's reach: the same circle the flat page draws, including fog, lightning and the ember glow
    const clock = RIP.still ? 1000 : f.now, flick = 1 + Math.sin(clock / 90) * 0.015 + Math.sin(clock / 37) * 0.01, R = (sight(s) + f.glow * 0.09) * flick, flash = dazzle(s) < 0;
    const lampCol = (f.fire ? f.fire.map(v => v * v * 2.4 * flick + 0.15) : [2.6 * flick, 1.55 * flick, 0.75 * flick]).map(v => v * (1 + f.glow * 0.4));
    const morning = Math.min(1, f.dawn * 0.45 + f.day);
    const night = [0.006, 0.009, 0.018];
    const amb = flash ? [0.5, 0.55, 0.7] : night.map((v, i) => v + morning * [1.1, 0.85, 0.7][i]);
    const horizon = [1.0, 0.62, 0.38].map(v => v * (0.25 + 0.75 * morning));

    // pickups light the water near them
    const pt = new Float32Array(32), ptCol = new Float32Array(24);
    const glowCol = e => e.kind === 'wisp' ? [0.35, 0.95, 0.3] : e.kind === 'heart' ? [1.0, 0.2, 0.3] : e.kind === 'shield' ? [0.3, 0.6, 1.0] : [1.0, 0.55, 0.2];
    const near = s.embers.filter(e => !e.got && e.y > s.y - 0.6 && e.y < s.y + 2.6).sort((a, b) => Math.abs(a.y - s.y) - Math.abs(b.y - s.y)).slice(0, 8);
    near.forEach((e, i) => { pt.set([e.x, 0.05, -(e.y - s.y), 0.2], i * 4); ptCol.set(glowCol(e).map(v => v * 0.55), i * 3); });

    const c = { eye, sy: s.y, yb, time, lamp, lampCol, R, pt, ptCol, npt: near.length, amb, horizon, dawnHaze: morning * 0.8, expo: 1.6 + morning * 0.4, wet: f.wet || [0.04, 0.075, 0.09], tint: f.tint, haze: own ? 1 - morning : 0, reedK: first ? 0.6 : 1, stone: own && s.tower ? (s.climb > 50 ? 2 : 1) : 0 };

    const water = ripples(s, f), rip = water && !RIP.hide && water.place(s.y);
    const ground = rip ? PR.ground : P.ground, decal = rip ? PR.decal : P.decal;
    const ripUniforms = prog => { if (!rip) return; water.bind(1, prog.u.uH); gl.uniform4f(prog.u.uRip, rip[0], rip[1], rip[2], HEIGHT); gl.uniform2f(prog.u.uRipN, rip[3], rip[4]); };

    gl.viewport(0, 0, W, H);
    gl.clearColor(0.01, 0.012, 0.02, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);

    // ground
    setCommon(ground, c); gl.uniform1f(ground.u.uShift, ((s.y % ROW_STEP) + ROW_STEP) % ROW_STEP); ripUniforms(ground);
    gl.bindVertexArray(groundVao); gl.drawElements(gl.TRIANGLES, groundCount, gl.UNSIGNED_SHORT, 0);

    // things in the water
    let n = 0;
    const put = (x, y, rad, len, kind, seed, sink = 0) => { if (n >= MAXOBJ) return; objData.set([x, -(y - s.y), rad, len, kind, seed, sink, 0], n * 8); n++; };
    const decals = []; const dec = (x, y, sx, sz, type, p1, p2 = 0, col = [0, 0, 0, 0]) => decals.push(x, -(y - s.y), sx, sz, type, p1, p2, 0, ...col);
    const sprites = []; const spr = (x, h, z, size, col, kind) => sprites.push(x, h, z, size, ...col, kind);
    const spun = new Set();
    for (const k of s.rocks) {
      const dy = k.y - s.y;
      if (dy < -1.4 || dy > 4.3) continue;
      const seed = (k.y0 * 7.13 + k.x0 * 3.7) % 50;
      if (k.kind === 'pool') { dec(k.x, k.y, 0.18, 0.18, 1, k.rad); continue; }
      if (k.kind === 'geyser') {
        if (k.on) { put(k.x, k.y, k.rad, 0, 5, seed); dec(k.x, k.y, k.rad * 2, k.rad * 2, 5, k.rad); }
        else dec(k.x, k.y, k.rad * 1.4, k.rad * 1.4, 4, k.rad);
        continue;
      }
      if (k.kind === 'hidden' && dy > 0.45) { dec(k.x, k.y, k.rad * 1.5, k.rad * 1.5, 2, k.rad); continue; }
      if (k.kind === 'spinner') { const key = k.x0 + ',' + k.y0; if (!spun.has(key)) { spun.add(key); dec(k.x0, k.y0, k.a * 1.2, k.a * 1.2, 3, k.a); } }
      const kind = k.ice ? 1 : k.kind === 'log' ? 2 : k.kind === 'isle' ? 3 : k.kind === 'chaser' ? 4 : 0;
      put(k.x, k.y, k.rad, k.len, kind, seed);
      dec(k.x, k.y, (k.len + k.rad) * 1.5, k.rad * 1.5, 0, k.rad, k.len);
      if (k.kind === 'chaser') for (const e of [-0.35, 0.35]) spr(k.x + e * k.rad, k.rad * 0.55, -(k.y - s.y) + k.rad * 0.75, k.rad * 0.4, [1.6, 0.18, 0.08], 0);
    }
    if (n) {
      setCommon(P.obj, c);
      gl.bindBuffer(gl.ARRAY_BUFFER, objBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, objData, 0, n * 8);
      gl.bindVertexArray(objVao); gl.drawElementsInstanced(gl.TRIANGLES, sphere.idx.length, gl.UNSIGNED_SHORT, 0, n);
    }

    // reeds
    if (!c.stone) { setCommon(P.reed, c);
    gl.uniform1f(P.reed.u.uReedBase, Math.floor((s.y + NEAR - 0.1) / REED_STEP));
    gl.bindVertexArray(reedVao); gl.drawElementsInstanced(gl.TRIANGLES, 9, gl.UNSIGNED_SHORT, 0, reedCount); }

    // boat
    setCommon(P.boat, c); gl.uniformMatrix4fv(P.boat.u.uModel, false, M); gl.uniform1f(P.boat.u.uFlick, flick * (1 + f.glow * 0.5));
    gl.bindVertexArray(boatVao); if (!f.hideBoat) gl.drawArrays(gl.TRIANGLES, 0, boatCount);

    // glows and their reflections
    const bob2 = t => 0.006 * Math.sin(time * 3.3 + t * 9);
    for (const e of s.embers) {
      if (e.got) continue;
      const dy = e.y - s.y; if (dy < -1.4 || dy > 4.3) continue;
      const z = -dy, h = 0.045 + bob2(e.y), size = 0.05 * (1 + 0.12 * Math.max(0, dy));
      let col = glowCol(e), kind = 0;
      if (e.kind === 'wisp') { const fl = 0.45 + 0.5 * Math.abs(Math.sin(f.now / 70 + e.y * 5)); col = [0.55 * fl * 1.6, 1.0 * fl * 1.6, 0.4 * fl * 1.6]; }
      else if (e.kind === 'heart') { col = [1.4, 0.25, 0.35]; kind = 1; }
      else if (e.kind === 'shield') { col = [0.45, 0.8, 1.6]; kind = 4; }
      else col = [1.7, 0.95, 0.4];
      spr(e.x, h, z, size, col, kind);
      dec(e.x, e.y - 0.07, 0.03, 0.07, 7, 0.01, 0, [col[0] * 0.5, col[1] * 0.5, col[2] * 0.5, 0]);
    }
    // abilities: one colour each, larger than an ember, with a slow pulse
    for (const e of s.powers || []) {
      if (e.got) continue;
      const dy = e.y - s.y; if (dy < -1.4 || dy > 4.3) continue;
      const pulse = 1 + 0.18 * Math.sin(time * 4 + e.y * 7), col = POWER_COL[e.kind] || [1.5, 1.5, 1.5];
      spr(e.x, 0.07 + bob2(e.y), -dy, 0.075 * pulse * (1 + 0.12 * Math.max(0, dy)), col, 4);
      spr(e.x, 0.07 + bob2(e.y), -dy, 0.03, [2.2, 2.2, 2.2], 0);
      dec(e.x, e.y - 0.09, 0.045, 0.1, 7, 0.012, 0, [col[0] * 0.5, col[1] * 0.5, col[2] * 0.5, 0]);
    }
    // the lantern's own reflection
    dec(lamp[0], s.y - 0.09, 0.03, 0.08, 7, 0.012, 0, [1.2, 0.7, 0.32, 0]);
    // the shield: a blue ring while it is held, blinking just after it breaks
    if (s.shield || (s.safe > 0 && Math.floor(f.now / 90) % 2)) { const r = 0.06 * (1 + Math.sin(f.now / 240) * 0.05), a = s.shield ? 1 : 0.6; dec(s.x, s.y, r * 1.8, r * 1.8, 6, r, 0, [0.5 * a, 0.9 * a, 2.0 * a, 0]); }
    if (s.field && own) { const r = 0.062 * (1 + Math.sin(f.now / 160) * 0.04); dec(s.x, s.y, r * 1.8, r * 1.8, 6, r, 0, [0.9, 1.3, 2.0, 0]); }
    for (const p of f.sparks) spr(p.x, 0.03 + 0.06 * (0.7 - p.life), -(p.y - s.y), 0.008, p.blue ? [0.6, 0.9, 1.6].map(v => v * p.life * 2) : p.red ? [1.6, 0.3, 0.35].map(v => v * p.life * 2) : [1.8, 1.1, 0.5].map(v => v * p.life * 2), 3);
    // the flame and its halo
    const fire = f.fire ? f.fire.map(v => v * 1.6) : [1.6, 0.8, 0.3];
    if (!f.hideBoat) {
      spr(lamp[0], lamp[1] + 0.003, lamp[2], (first ? 0.011 : 0.016) * flick, fire, 2);
      if (!first) spr(lamp[0], lamp[1], lamp[2], 0.09 * (1 + f.glow * 0.3), f.fire ? fire.map(v => v * 0.14) : [0.22, 0.12, 0.04], 0); // in first person it would fill the screen
    }

    gl.enable(gl.BLEND); gl.depthMask(false);
    const nd = Math.min(MAXDEC, decals.length / 12);
    if (nd) {
      decData.set(decals.slice(0, nd * 12));
      setCommon(decal, c); ripUniforms(decal);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.bindBuffer(gl.ARRAY_BUFFER, decBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, decData, 0, nd * 12);
      gl.bindVertexArray(decVao); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, nd);
    }
    const ns = Math.min(MAXSPR, sprites.length / 8);
    if (ns) {
      sprData.set(sprites.slice(0, ns * 8));
      setCommon(P.sprite, c);
      gl.uniform3fv(P.sprite.u.uCamR, view.x); gl.uniform3fv(P.sprite.u.uCamU, view.y);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.bindBuffer(gl.ARRAY_BUFFER, sprBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, sprData, 0, ns * 8);
      gl.bindVertexArray(sprVao); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, ns);
    }
    // overlay
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(P.over.p); const u = P.over.u;
    gl.uniform1f(u.uDawnTop, Math.min(0.85, f.dawn * 0.45 + f.day * 0.6) * 0.7); gl.uniform1f(u.uDawnBot, Math.min(0.5, f.dawn * 0.15 + f.day * 0.4) * 0.5);
    gl.uniform1f(u.uFlash, flash ? 1 : 0); gl.uniform1f(u.uRain, f.playing && rain(s, s.y) ? 1 : 0); gl.uniform1f(u.uTime, time); gl.uniform2f(u.uRes, W, H);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(overVao); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.BLEND); gl.depthMask(true);
    gl.bindVertexArray(null);
  }
  return { gl, errors, resize, draw, project, boatRow, camera: () => ({ ...CAM, x: camX }) };
}
