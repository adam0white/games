// WebGL2 drawing for the trail painter (05-tech: own WebGL2, instanced ants, terrain and scent as textures).
// Per frame: one full-screen pass for the ground (terrain, scent wash, food, the entrance) and one instanced draw for
// the ants. Textures and the instance buffer change at tick rate (20 a second), not every frame; between ticks the
// vertex shader interpolates each ant from its last position to its new one.
// Look (02-spec section 9): ink and wash. Paper-coloured ash with a soft wash and ember specks, stones and water with
// ink outlines on smooth contours, scent laid on as watercolour, ants as small inked bodies with legs that step.

const GROUND_VS = `#version 300 es
in vec2 aPos; out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const GROUND_FS = `#version 300 es
precision highp float; precision highp int;
in vec2 vUv; out vec4 outColor;
uniform highp usampler2D uMat;   // R: material, G: marked for digging
uniform sampler2D uScent;        // R trail, G food, B alarm (0..1)
uniform vec2 uSize;              // layer size in cells
uniform vec2 uView;              // viewport in device px
uniform vec3 uCam;               // centre (cells) and device px per cell
uniform int uNest;
uniform float uTime;
uniform vec4 uPile[8];           // x, y, amount, 0
uniform vec4 uEntrance;          // x, y (cells), 1 when shown
uniform vec4 uAlarm;             // x, y, strength, 1 when live
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { return 0.55 * noise(p) + 0.3 * noise(p * 2.03 + 7.1) + 0.15 * noise(p * 4.1 + 3.7); }
uint matAt(ivec2 c) { c = clamp(c, ivec2(0), ivec2(uSize) - 1); return texelFetch(uMat, c, 0).r; }
float solid(ivec2 c) { if (c.x < 0 || c.y < 0 || c.x >= int(uSize.x) || c.y >= int(uSize.y)) return 1.0; return matAt(c) == 0u ? 0.0 : 1.0; }
#if LOOK == 1
const vec3 INK = vec3(0.95, 0.50, 0.18);
#elif LOOK == 2
const vec3 INK = vec3(0.10, 0.08, 0.12);
#else
const vec3 INK = vec3(0.13, 0.11, 0.10);
#endif
vec3 matColor(uint m, vec2 w) {
  float n = fbm(w * 0.35);
#if LOOK == 2
  n = floor(n * 3.0) / 2.0;                                  // flat stepped tones, as printed
#endif
  if (uNest == 0) {
    if (m == 4u) return mix(vec3(0.33, 0.31, 0.30), vec3(0.45, 0.43, 0.41), n);  // stone
    if (m == 6u) return mix(vec3(0.42, 0.52, 0.58), vec3(0.55, 0.64, 0.68), n);  // water
    return vec3(0.5);
  }
  if (m == 1u) return mix(vec3(0.62, 0.60, 0.57), vec3(0.70, 0.68, 0.64), n);  // loose ash
  if (m == 2u) return mix(vec3(0.47, 0.36, 0.26), vec3(0.55, 0.43, 0.31), n);  // topsoil
  if (m == 3u) return mix(vec3(0.55, 0.33, 0.24), vec3(0.62, 0.40, 0.29), n);  // clay
  if (m == 4u) return mix(vec3(0.36, 0.35, 0.36), vec3(0.47, 0.46, 0.46), n);  // stone
  if (m == 5u) return mix(vec3(0.30, 0.20, 0.13), vec3(0.38, 0.26, 0.17), n);  // roots
  if (m == 6u) return vec3(0.42, 0.52, 0.58);
  return vec3(0.5);
}
void main() {
  vec2 px = vec2(vUv.x * uView.x, (1.0 - vUv.y) * uView.y);
  vec2 w = uCam.xy + (px - uView * 0.5) / uCam.z;           // cells
  float ppc = uCam.z;
  // Paper: warm off-white wash on the surface, pale tunnel cream in the nest.
#if LOOK == 1
  vec3 paper = uNest == 0 ? mix(vec3(0.07, 0.06, 0.06), vec3(0.16, 0.12, 0.10), fbm(w * 0.06)) : mix(vec3(0.22, 0.12, 0.07), vec3(0.32, 0.18, 0.10), fbm(w * 0.1));
  paper *= 0.85 + 0.15 * noise(w * 3.1);
#elif LOOK == 2
  vec3 paper = uNest == 0 ? mix(vec3(0.94, 0.88, 0.63), vec3(0.96, 0.90, 0.66), step(0.5, fbm(w * 0.06))) : mix(vec3(0.99, 0.91, 0.74), vec3(1.0, 0.95, 0.82), step(0.5, fbm(w * 0.1)));
#else
  vec3 paper = uNest == 0 ? mix(vec3(0.80, 0.77, 0.71), vec3(0.88, 0.85, 0.79), fbm(w * 0.06)) : mix(vec3(0.86, 0.80, 0.68), vec3(0.92, 0.87, 0.76), fbm(w * 0.1));
  paper *= 0.94 + 0.06 * noise(w * 3.1);
#endif
  if (w.x < 0.0 || w.y < 0.0 || w.x >= uSize.x || w.y >= uSize.y) { outColor = vec4(paper * 0.55, 1.0); return; }
  // Smooth contour of closed cells: bilinear over the four nearest cell centres, so edges are curves not stairs.
  vec2 g = w - 0.5; ivec2 b = ivec2(floor(g)); vec2 f = fract(g);
  float s = mix(mix(solid(b), solid(b + ivec2(1, 0)), f.x), mix(solid(b + ivec2(0, 1)), solid(b + ivec2(1, 1)), f.x), f.y);
#if LOOK == 2
  s += (fbm(w * 1.7) - 0.5) * 0.06;                          // a clean printed edge
#else
  s += (fbm(w * 1.7) - 0.5) * 0.25;                          // a wobbly hand-drawn edge
#endif
  float aa = 1.2 / ppc + 0.02;
  float inside = smoothstep(0.5 - aa, 0.5 + aa, s);
  ivec2 cell = ivec2(floor(w));
  uint m = matAt(cell);
  if (m == 0u) { m = max(max(matAt(b), matAt(b + ivec2(1, 0))), max(matAt(b + ivec2(0, 1)), matAt(b + ivec2(1, 1)))); }
  vec3 mc = matColor(m, w);
#if LOOK == 1
  mc = mc * vec3(0.52, 0.42, 0.38);                          // rock and soil in the dark, a little red
#elif LOOK == 2
  { float dots = smoothstep(0.32, 0.22, length(fract(w * 2.5) - 0.5)) * step(0.45, fbm(w * 0.5 + 3.0));
    mc *= 1.0 - 0.18 * dots; }                                // halftone shading on solid ground
#endif
  vec3 col = mix(paper, mc, inside);
#if LOOK == 1
  { float edge = abs(s - 0.5);
    float ink = 1.0 - smoothstep(0.0, 0.06 + 1.2 / ppc, edge), glow = 1.0 - smoothstep(0.0, 0.7, edge);
    float beat = 0.6 + 0.4 * sin(uTime * 1.3 + fbm(w * 0.7) * 9.0);
    col += INK * (ink * 0.75 + glow * 0.12) * beat; }        // edges glow like cooling coals
#elif LOOK == 2
  { float ink = 1.0 - smoothstep(0.0, 0.14 + 2.0 / ppc, abs(s - 0.5)); col = mix(col, INK, ink); }
#else
  { float ink = 1.0 - smoothstep(0.0, 0.09 + 1.4 / ppc, abs(s - 0.5)); col = mix(col, INK, ink * 0.85); }
#endif
  // Ember specks in the ash (surface): a few cells glow and flicker (many more by night; none in daylight).
#if LOOK != 2
  if (uNest == 0 && inside < 0.5) {
    float h = hash(vec2(cell) * 0.731);
#if LOOK == 1
    if (h > 0.955) { vec2 d = fract(w) - 0.5; float e = smoothstep(0.3, 0.0, length(d)) * (0.5 + 0.5 * sin(uTime * 3.0 + h * 40.0));
      col += vec3(1.0, 0.42, 0.10) * e * 0.9; }
#else
    if (h > 0.985) { vec2 d = fract(w) - 0.5; float e = smoothstep(0.22, 0.0, length(d)) * (0.6 + 0.4 * sin(uTime * 3.0 + h * 40.0));
      col = mix(col, vec3(0.95, 0.45, 0.15), e * 0.8); }
#endif
    col *= 0.92 + 0.08 * fbm(w * 0.5 + 11.0);
  }
#endif
  // Dig marks: ink hatching on marked cells.
  if (texelFetch(uMat, clamp(cell, ivec2(0), ivec2(uSize) - 1), 0).g > 0u) {
    float hl = abs(fract((w.x + w.y) * 1.5) - 0.5);
    col = mix(col, vec3(0.95, 0.85, 0.35), smoothstep(0.16, 0.08, hl) * 0.75);
  }
  // Scent as watercolour washes: trail amber, food green, alarm red.
  vec3 sc = texture(uScent, w / uSize).rgb;
  float wash = 0.85 + 0.3 * fbm(w * 0.8);
#if LOOK == 1
  col += vec3(1.0, 0.62, 0.18) * clamp(sc.r * 0.95 * wash, 0.0, 0.9);   // scent as light
  col += vec3(0.35, 0.95, 0.40) * clamp(sc.g * 0.5 * wash, 0.0, 0.45);
  col += vec3(1.0, 0.12, 0.08) * clamp(sc.b * 0.9 * wash, 0.0, 0.9);
#elif LOOK == 2
  { float stripe = step(0.5, fract((w.x - w.y) * 0.9 - uTime * 0.5));  // marching stripes
    float dot_ = smoothstep(0.3, 0.2, length(fract(w * 1.5) - 0.5));
    col = mix(col, vec3(0.98, 0.58, 0.05), clamp(sc.r * 1.6, 0.0, 0.9) * (0.45 + 0.55 * stripe));
    col = mix(col, vec3(0.20, 0.66, 0.30), clamp(sc.g * 1.2, 0.0, 0.85) * dot_);
    col = mix(col, vec3(0.88, 0.10, 0.22), clamp(sc.b * 1.2, 0.0, 0.85)); }
#else
  col = mix(col, vec3(0.86, 0.55, 0.16), clamp(sc.r * 0.75 * wash, 0.0, 0.75));
  col = mix(col, vec3(0.36, 0.62, 0.25), clamp(sc.g * 0.55 * wash, 0.0, 0.5));
  col = mix(col, vec3(0.85, 0.18, 0.12), clamp(sc.b * 0.8 * wash, 0.0, 0.8));
#endif
  // Food piles: seed heaps drawn as clustered dots with an ink rim.
  for (int k = 0; k < 8; k++) {
    vec4 p = uPile[k]; if (p.z <= 0.0) continue;
    vec2 d = w - p.xy - 0.5; float r = 0.9 + 1.6 * sqrt(p.z / 800.0);
    float dist = length(d);
    if (dist < r + 0.6) {
      vec2 q = w * 2.2; vec2 qi = floor(q); vec2 qf = fract(q) - 0.5;
      float seed = hash(qi + float(k)) > 0.35 ? smoothstep(0.42, 0.3, length(qf)) : 0.0;
      float body = smoothstep(r, r - 0.4, dist);
      col = mix(col, vec3(0.93, 0.83, 0.48), body * 0.85);
      col = mix(col, vec3(0.62, 0.45, 0.16), body * seed * 0.8);
      col = mix(col, INK, (smoothstep(r - 0.25, r, dist) - smoothstep(r, r + 0.25, dist)) * 0.9);
    }
  }
  // The entrance: a dark hole in a small mound with an ink ring.
  if (uEntrance.w > 0.0) {
    float d = length(w - uEntrance.xy);
#if LOOK == 1
    col = mix(col, vec3(0.28, 0.17, 0.10), smoothstep(3.2, 1.8, d) * 0.6);
    col = mix(col, vec3(1.0, 0.55, 0.2), smoothstep(1.6, 1.0, d) * 0.5);  // warm light from inside the hill
    col = mix(col, vec3(0.02, 0.01, 0.01), smoothstep(1.1, 0.8, d));
#else
    col = mix(col, vec3(0.55, 0.47, 0.38), smoothstep(3.2, 1.8, d) * 0.6);
    col = mix(col, vec3(0.08, 0.06, 0.05), smoothstep(1.3, 0.9, d));
#endif
    col = mix(col, INK, (smoothstep(2.9, 3.1, d) - smoothstep(3.1, 3.35, d)) * 0.7);
  }
  if (uAlarm.w > 0.0) {
    float d = length(w - uAlarm.xy), ring = fract(uTime * 0.8);
    float rr = 1.5 + ring * 8.0;
    col = mix(col, vec3(0.8, 0.1, 0.08), (smoothstep(rr - 0.5, rr, d) - smoothstep(rr, rr + 0.5, d)) * (1.0 - ring) * 0.9);
  }
#if LOOK == 1
  { vec2 v = vUv - 0.5; col *= 1.0 - 0.55 * dot(v, v) * 2.0; }  // a vignette: the night closes in at the edges
#endif
  outColor = vec4(min(col, vec3(1.0)), 1.0);
}`;

const ANT_VS = `#version 300 es
precision highp float;
in vec2 aCorner;
in vec4 aPos;    // previous x, y, new x, y (cells)
in vec4 aInfo;   // heading (radians), job, carry, phase
uniform vec2 uView; uniform vec3 uCam; uniform float uAlpha; uniform float uTime; uniform float uRun;
out vec2 vLocal; flat out vec4 vInfo; out float vPx; flat out float vMove;
void main() {
  vec2 p = mix(aPos.xy, aPos.zw, uAlpha);
  float big = aInfo.y > 1.5 ? 1.25 : 1.0;
#if LOOK == 2
  big *= 1.3;                                               // the field-guide plate draws ants larger
#endif
  float half_ = max(0.62 * big, 3.0 / uCam.z);             // half size in cells; never under 3 device px
  float c = cos(aInfo.x), s = sin(aInfo.x);
  vec2 o = aCorner * half_;
  vec2 r = vec2(o.x * c - o.y * s, o.x * s + o.y * c);
  vec2 px = (p + r - uCam.xy) * uCam.z + uView * 0.5;
  gl_Position = vec4(px.x / uView.x * 2.0 - 1.0, 1.0 - px.y / uView.y * 2.0, 0.0, 1.0);
  vLocal = aCorner; vInfo = aInfo; vPx = half_ * uCam.z;
  vMove = uRun > 0.5 && length(aPos.zw - aPos.xy) > 0.004 ? 1.0 : 0.0;   // moved this tick (a step is 0.09 to 0.14 cells); paused: still
}`;

const ANT_FS = `#version 300 es
precision highp float;
in vec2 vLocal; flat in vec4 vInfo; in float vPx; flat in float vMove; out vec4 outColor;
uniform float uTime;
float ell(vec2 p, vec2 c, vec2 r) { vec2 q = (p - c) / r; return (length(q) - 1.0) * min(r.x, r.y); }
float seg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
void main() {
  vec2 p = vLocal;                                              // x along the body (head at +x), -1..1
  float aa = 1.5 / max(vPx, 1.0);
#if LOOK == 1
  vec3 body = vInfo.y < 0.5 ? vec3(0.04, 0.03, 0.03) : vInfo.y < 1.5 ? vec3(0.12, 0.06, 0.03) : vec3(0.22, 0.03, 0.03);
  const vec3 RIM = vec3(1.0, 0.55, 0.18); const float RIM_A = 0.85, RIM_W = 0.04;
#elif LOOK == 2
  vec3 body = vInfo.y < 0.5 ? vec3(0.12, 0.10, 0.14) : vInfo.y < 1.5 ? vec3(0.85, 0.42, 0.10) : vec3(0.80, 0.12, 0.16);
  const vec3 RIM = vec3(1.0, 0.99, 0.94); const float RIM_A = 1.0, RIM_W = 0.07;
#else
  vec3 body = vInfo.y < 0.5 ? vec3(0.16, 0.10, 0.07) : vInfo.y < 1.5 ? vec3(0.45, 0.22, 0.10) : vec3(0.30, 0.05, 0.06);
  const vec3 RIM = vec3(0.0); const float RIM_A = 0.0, RIM_W = 0.0;
#endif
  if (vPx < 6.0) {                                              // far away: one inked oval with a two-frame wiggle
    float d = ell(p, vec2(0.0, 0.0), vec2(0.85, 0.45));
    float a = 1.0 - smoothstep(-aa, aa, d);
#if LOOK == 1
    body = mix(vec3(1.0, 0.62, 0.25), body, 0.15);             // by night a far ant is a spark
#endif
    if (vInfo.z > 0.5) { float f = length(p - vec2(0.7, 0.0)) - 0.4; a = max(a, 1.0 - smoothstep(-aa, aa, f)); if (f < 0.0) body = vec3(0.95, 0.85, 0.45); }
#if LOOK == 2
    { float r = 1.0 - smoothstep(-aa, aa, d - 0.25); body = mix(RIM, body, a); a = max(a, r); }
#endif
    if (a < 0.02) discard;
    outColor = vec4(body, a); return;
  }
  // The tripod gait in two frames while the ant moves; standing, the legs rest in the middle pose and only
  // the antennae twitch a little.
  float step_ = vMove > 0.5 ? step(0.5, fract(uTime * 5.0 + vInfo.w)) : 0.5;
  float twitch = vMove > 0.5 ? 0.0 : 0.05 * sin(uTime * 2.3 + vInfo.w * 40.0) * step(0.7, fract(uTime * 0.37 + vInfo.w));
  float d = ell(p, vec2(0.55, 0.0), vec2(0.2, 0.17));           // head
  d = min(d, ell(p, vec2(0.17, 0.0), vec2(0.22, 0.13)));        // thorax
  d = min(d, ell(p, vec2(-0.4, 0.0), vec2(0.4, 0.27)));         // gaster
  float legs = 1e3;
  for (int k = 0; k < 3; k++) {
    float x = 0.28 - 0.14 * float(k), swing = (mod(float(k), 2.0) < 0.5 ? step_ : 1.0 - step_) * 0.16 - 0.08;
    legs = min(legs, seg(p, vec2(x, 0.0), vec2(x + 0.14 * float(1 - k) + swing, 0.5)));
    legs = min(legs, seg(p, vec2(x, 0.0), vec2(x + 0.14 * float(1 - k) - swing, -0.5)));
  }
  legs = min(legs, seg(p, vec2(0.6, 0.06), vec2(0.88, 0.24 + twitch)));    // antennae
  legs = min(legs, seg(p, vec2(0.6, -0.06), vec2(0.88, -0.24 + twitch)));
  float lw = max(0.035, 0.9 / vPx);
  float a = max(1.0 - smoothstep(-aa, aa, d), 1.0 - smoothstep(lw - aa, lw + aa, legs));
  vec3 col = body * (1.0 + 0.6 * smoothstep(0.0, -0.12, d) * (p.y > 0.0 ? 0.0 : 0.6));   // a little wash light on one side
  if (vInfo.z > 0.5) {                                          // a carried seed, held in the jaws
    float f = ell(p, vec2(0.88, 0.0), vec2(0.15, 0.13));
    float fa = 1.0 - smoothstep(-aa, aa, f);
    col = mix(col, mix(vec3(0.95, 0.86, 0.5), vec3(0.2, 0.15, 0.1), smoothstep(-0.04, 0.0, f)), fa);
    a = max(a, fa);
  }
  if (RIM_A > 0.0) {                                            // an outline round body and legs: a hot rim by night, white on the plate
    float shape = min(d, legs - lw), rw = max(RIM_W, 1.0 / vPx);
    float rim = (1.0 - smoothstep(rw - aa, rw + aa, shape)) * RIM_A;
    col = mix(RIM, col, a); a = max(a, rim);
  }
  if (a < 0.02) discard;
  outColor = vec4(col, a);
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

export class Renderer {
  /** Returns null when the browser has no WebGL2. */
  /** look: 0 ink, 1 ember, 2 field (looks.js); each is its own shader variant. */
  static create(canvas, hooks = {}, look = 0) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    return gl ? new Renderer(canvas, gl, hooks, look) : null;
  }
  constructor(canvas, gl, hooks, look = 0) {
    this.canvas = canvas; this.gl = gl; this.hooks = hooks; this.look = look | 0; this.lost = false; this.restored = 0; this.losses = 0;
    this.layers = [null, null]; this.antCount = 0;
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.lost = true; this.losses++; hooks.lost?.(); });
    canvas.addEventListener('webglcontextrestored', () => { this.lost = false; this.restored++; this.init(); hooks.restored?.(); });
    this.init();
  }
  init() {
    const gl = this.gl;
    const v = src => src.replace('#version 300 es\n', `#version 300 es\n#define LOOK ${this.look}\n`);
    this.ground = program(gl, GROUND_VS, v(GROUND_FS));
    this.ant = program(gl, v(ANT_VS), v(ANT_FS));
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
    gl.bindVertexArray(null);
    this.matTex = [gl.createTexture(), gl.createTexture()];
    this.scentTex = [gl.createTexture(), gl.createTexture()];
    for (const t of [...this.matTex, ...this.scentTex]) {
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    this.layers = [null, null]; this.antCount = 0;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    this.gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  }
  /** Terrain for one layer: mat (Uint8, w*h) and dig marks (Uint8, w*h). */
  setTerrain(layer, w, h, mat, dig) {
    const gl = this.gl; if (this.lost) return;
    const data = new Uint8Array(w * h * 2);
    for (let i = 0; i < w * h; i++) { data[2 * i] = mat[i]; data[2 * i + 1] = dig[i]; }
    gl.bindTexture(gl.TEXTURE_2D, this.matTex[layer]);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG8UI, w, h, 0, gl.RG_INTEGER, gl.UNSIGNED_BYTE, data);
    this.layers[layer] = { w, h };
  }
  /** Scent for one layer as RGBA bytes (trail, food, alarm, unused). */
  setScent(layer, w, h, rgba) {
    const gl = this.gl; if (this.lost) return;
    gl.bindTexture(gl.TEXTURE_2D, this.scentTex[layer]);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
  }
  /** Instances: Float32Array of 8 floats per ant (see ANT_VS). */
  setAnts(data, count) {
    const gl = this.gl; if (this.lost) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.inst);
    if (data.length > this.instCap) { gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW); this.instCap = data.length; }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, count * 8);
    this.antCount = count;
  }
  resize(cssW, cssH, dpr) {
    const w = Math.max(1, Math.round(cssW * dpr)), h = Math.max(1, Math.round(cssH * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.dpr = dpr;
  }
  /** cam: { x, y, z } with z in CSS px per cell. */
  draw({ layer, cam, alpha, time, piles, entrance, alarm, running = true }) {
    const gl = this.gl; if (this.lost || !this.layers[layer]) return false;
    const W = this.canvas.width, H = this.canvas.height, dpr = this.dpr ?? 1, L = this.layers[layer];
    gl.viewport(0, 0, W, H);
    gl.disable(gl.BLEND);
    const g = this.ground;
    gl.useProgram(g.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.matTex[layer]); gl.uniform1i(g.u.uMat, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.scentTex[layer]); gl.uniform1i(g.u.uScent, 1);
    gl.uniform2f(g.u.uSize, L.w, L.h); gl.uniform2f(g.u.uView, W, H); gl.uniform3f(g.u.uCam, cam.x, cam.y, cam.z * dpr);
    gl.uniform1i(g.u.uNest, layer); gl.uniform1f(g.u.uTime, time);
    const pv = new Float32Array(32); (piles || []).slice(0, 8).forEach((p, k) => { pv[4 * k] = p.x; pv[4 * k + 1] = p.y; pv[4 * k + 2] = p.amount; });
    gl.uniform4fv(g.u.uPile, pv);
    gl.uniform4f(g.u.uEntrance, entrance ? entrance.x : 0, entrance ? entrance.y : 0, 0, entrance ? 1 : 0);
    gl.uniform4f(g.u.uAlarm, alarm ? alarm.x : 0, alarm ? alarm.y : 0, 0, alarm ? 1 : 0);
    gl.bindVertexArray(this.gvao); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (this.antCount) {
      const a = this.ant;
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(a.p);
      gl.uniform2f(a.u.uView, W, H); gl.uniform3f(a.u.uCam, cam.x, cam.y, cam.z * dpr); gl.uniform1f(a.u.uAlpha, alpha); gl.uniform1f(a.u.uTime, time); gl.uniform1f(a.u.uRun, running ? 1 : 0);
      gl.bindVertexArray(this.avao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.antCount);
    }
    gl.bindVertexArray(null);
    return true;
  }
  loseForTest() { const e = this.gl.getExtension('WEBGL_lose_context'); e?.loseContext(); return e; }
}
