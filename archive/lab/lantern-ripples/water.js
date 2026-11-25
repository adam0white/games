// Lantern Ripples: the river's water as a height field, and the drawing of that water.
// The sim is the classic two-buffer wave equation with damping: each cell keeps its height now and its height one step ago,
// and the next height is h + KEEP * (h - before) + C2 * (sum of the four neighbours - 4h).
// The grid is fixed to the river, not to the boat. As the boat climbs, whole rows leave at the bottom and still rows come in
// at the top; only the drawing uses the part of a row that is left over, so waves are never smeared by resampling.
// Rocks and the banks hold the water at zero, so waves reflect off them.
// It runs on the GPU in two half-float textures when the browser can draw into them, and otherwise on the CPU in Float32Arrays.
// Units: "river units" are the sim's units (the river is about 0.5 wide); grid units are cells, counted from X0 and from the grid's first row.

export const NX = 72, X0 = -0.02, CELL = 1.04 / NX; // 72 cells across: waves cross about 0.58 river units a second at one step a frame
const C2 = 0.45, KEEP = 0.985, MAX_ROCKS = 48, MAX_DROPS = 64;
const SLOPE = 5; // how strongly a height difference tilts the drawn surface

const QUAD = `#version 300 es
in vec2 p; void main() { gl_Position = vec4(p, 0, 1); }`;

const SIM = `#version 300 es
precision highp float; precision highp int;
uniform sampler2D uPrev; // r: height now, g: height one step ago
uniform sampler2D uRows; // one texel a row: the river's centre and half width, in river units
uniform ivec2 uSize; uniform int uShift;
uniform float uX0, uCell, uC2, uKeep;
uniform vec4 uRocks[${MAX_ROCKS}]; uniform int uNRocks; // x, y, radius, half length, in cells
uniform vec4 uDrops[${MAX_DROPS}]; uniform int uNDrops; // x, y, radius in cells, amount
out vec4 o;
float at(ivec2 q) { q.y += uShift; if (q.x < 0 || q.y < 0 || q.x >= uSize.x || q.y >= uSize.y) return 0.0; return texelFetch(uPrev, q, 0).r; }
void main() {
  ivec2 q = ivec2(gl_FragCoord.xy), src = q + ivec2(0, uShift);
  vec2 c = src.y < uSize.y ? texelFetch(uPrev, src, 0).rg : vec2(0.0);
  float lap = at(q + ivec2(1, 0)) + at(q - ivec2(1, 0)) + at(q + ivec2(0, 1)) + at(q - ivec2(0, 1)) - 4.0 * c.r;
  float h = c.r + uKeep * (c.r - c.g) + uC2 * lap;
  vec2 g = vec2(q) + 0.5;
  for (int i = 0; i < ${MAX_DROPS}; i++) { if (i >= uNDrops) break; vec4 d = uDrops[i]; float k = length(g - d.xy); if (k < d.z) h += d.w * 0.5 * (1.0 + cos(3.14159 * k / d.z)); }
  float now = c.r;
  vec2 row = texelFetch(uRows, ivec2(q.y, 0), 0).xy;
  if (abs(uX0 + g.x * uCell - row.x) > row.y) { h = 0.0; now = 0.0; } // the bank
  for (int i = 0; i < ${MAX_ROCKS}; i++) { if (i >= uNRocks) break; vec4 r = uRocks[i]; if (length(vec2(max(0.0, abs(g.x - r.x) - r.w), g.y - r.y)) < r.z) { h = 0.0; now = 0.0; } }
  o = vec4(clamp(h, -4.0, 4.0), now, 0, 1);
}`;

const DRAW = `#version 300 es
precision highp float; precision highp int;
uniform sampler2D uH, uRows;
uniform vec2 uGrid;
uniform vec4 uView; // left px, px per river unit, the boat's row in px from the top, screen height px
uniform vec2 uShake;
uniform float uX0, uCell, uGY, uSlope; // uGY: river y of the grid's first row, less the boat's y
uniform vec3 uLamp; // the boat's x, the light's radius in river units, how dark the night is outside it
uniform vec3 uFire; uniform float uWash, uEdgeW;
uniform vec3 uWater, uBank, uEdge;
out vec4 o;
void main() {
  vec2 fc = gl_FragCoord.xy - vec2(uShake.x, -uShake.y);
  float py = uView.w - fc.y; // gl_FragCoord counts up from the bottom; the page counts down from the top
  float wx = (fc.x - uView.x) / uView.y, ry = (uView.z - py) / uView.y;
  vec2 g = vec2((wx - uX0) / uCell, (ry - uGY) / uCell);
  float fy = clamp(g.y - 0.5, 0.0, uGrid.y - 1.0); int j = int(fy);
  vec2 row = mix(texelFetch(uRows, ivec2(j, 0), 0).xy, texelFetch(uRows, ivec2(min(j + 1, int(uGrid.y) - 1), 0), 0).xy, fy - float(j));
  float side = abs(wx - row.x) - row.y; // above 0 on the bank
  vec3 col = uBank;
  vec3 L = normalize(vec3(uLamp.x - wx, -ry, 0.08)); // the lantern hangs a little above the boat
  if (side < 0.0) {
    vec2 uv = g / uGrid, e = 1.0 / uGrid;
    float hl = texture(uH, uv - vec2(e.x, 0)).r, hr = texture(uH, uv + vec2(e.x, 0)).r, hd = texture(uH, uv - vec2(0, e.y)).r, hu = texture(uH, uv + vec2(0, e.y)).r;
    vec3 n = normalize(vec3((hl - hr) * uSlope, (hd - hu) * uSlope, 1.0));
    vec3 hv = normalize(L + vec3(0, 0, 1));
    float lit = dot(n, L) - L.z; // light on a slope, less the light on still water, so still water keeps the main game's colour;
    // a trough is never darker than 45% of still water, so the dark rocks keep their contrast
    float glint = max(0.0, pow(max(dot(n, hv), 0.0), 90.0) - pow(hv.z, 90.0)); // only tilted water throws a glint
    col = uWater * max(0.45, 1.0 + 1.7 * lit) + uFire * min(0.5, glint * 1.4);
  }
  if (abs(side) < uEdgeW) col = uEdge; // the water's edge, as on the main game
  float t = (length(vec2(wx - uLamp.x, ry - 0.05)) / uLamp.y - 0.15) / 0.85; // the main game's darkness: clear to 0.15 of the radius, then two ramps
  float a = t < 0.0 ? 0.0 : t < 0.7 ? 0.55 * uLamp.z * t / 0.7 : t < 1.0 ? mix(0.55 * uLamp.z, uLamp.z, (t - 0.7) / 0.3) : uLamp.z;
  col = mix(col, vec3(4.0, 6.0, 12.0) / 255.0, a);
  col += uFire * uWash * max(0.0, 1.0 - length(vec2(wx - uLamp.x, ry)) / (0.8 * uLamp.y)); // the warm wash inside the light
  o = vec4(col, 1);
}`;

const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);

export function createWater(canvas, { cpu = false } = {}) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false });
  if (!gl) return null;
  const errors = [];
  function program(vs, fs) {
    const p = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) errors.push(gl.getShaderInfoLog(sh));
      gl.attachShader(p, sh);
    }
    gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) errors.push(gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) || 0;
    for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i).name.replace('[0]', ''); u[name] = gl.getUniformLocation(p, name); }
    return { p, u };
  }
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); // one triangle over the whole target
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const draw = program(QUAD, DRAW);

  // The GPU path needs a half-float texture it can draw into. Ask for the extension, then check the framebuffer really works.
  let gpu = false;
  const tex = (w, h, inner, format, type, filter) => {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, inner, w, h, 0, format, type, null);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, filter], [gl.TEXTURE_MAG_FILTER, filter], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    return t;
  };
  let sim = null;
  if (!cpu && (gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'))) {
    const t = tex(4, 4, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.NEAREST), f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gpu = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(f); gl.deleteTexture(t);
    if (gpu) sim = program(QUAD, SIM);
  }
  const path = gpu ? 'gpu' : 'cpu';

  let NY = 0, W = 0, H = 0, unit = 1, left = 0, row0 = null, gy = 0;
  let rowsTex = null, rowsData = null, pair = [], cur = 0, hTex = null, hNow = null, hBefore = null;
  const rocksU = new Float32Array(MAX_ROCKS * 4), dropsU = new Float32Array(MAX_DROPS * 4);

  function resize(w, h, u, l) {
    W = w; H = h; unit = u; left = l; canvas.width = w; canvas.height = h;
    const ny = Math.min(256, Math.ceil((H / unit + 0.06) / CELL) + 1);
    if (ny === NY) return;
    NY = ny; rowsData = new Float32Array(NY * 4);
    if (rowsTex) gl.deleteTexture(rowsTex);
    rowsTex = tex(NY, 1, gl.RGBA32F, gl.RGBA, gl.FLOAT, gl.NEAREST);
    for (const p of pair) { gl.deleteTexture(p.t); gl.deleteFramebuffer(p.f); }
    if (hTex) gl.deleteTexture(hTex);
    if (gpu) {
      pair = [0, 1].map(() => { const t = tex(NX, NY, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR), f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); return { t, f }; });
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    } else {
      hNow = new Float32Array(NX * NY); hBefore = new Float32Array(NX * NY);
      hTex = tex(NX, NY, gl.R16F, gl.RED, gl.FLOAT, gl.LINEAR); // R16F filled from 32-bit floats: filterable with no extension
    }
    reset();
  }
  function reset() {
    row0 = null;
    if (gpu) { for (const p of pair) { gl.bindFramebuffer(gl.FRAMEBUFFER, p.f); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); } gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
    else { hNow.fill(0); hBefore.fill(0); }
  }
  // Which grid row is first: the grid starts a little below the bottom of the screen.
  const firstRow = sy => Math.floor((sy - 0.27 * H / unit - 0.02) / CELL);

  // One step of the water. sy: the boat's river y. river(y) gives [centre, half]. rocks: { x, y, rad, len } in river units.
  // drops: { x, y, r, a }: a raised (or lowered, when a is below 0) bump of radius r river units and height a.
  function step(sy, river, rocks, drops) {
    const first = firstRow(sy); let shift = row0 === null ? NY : first - row0; row0 = first;
    if (shift < 0 || shift > NY) shift = NY; // a new run or a jump: start from still water
    gy = row0 * CELL; // river y of the grid's first row edge
    for (let j = 0; j < NY; j++) { const [c, h] = river(gy + (j + 0.5) * CELL); rowsData[j * 4] = c; rowsData[j * 4 + 1] = h; }
    gl.bindTexture(gl.TEXTURE_2D, rowsTex); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, NY, 1, gl.RGBA, gl.FLOAT, rowsData);
    let nr = 0, nd = 0;
    for (const k of rocks) {
      const y = (k.y - gy) / CELL; if (nr >= MAX_ROCKS || y < -8 || y > NY + 8) continue;
      rocksU.set([(k.x - X0) / CELL, y, k.rad / CELL, k.len / CELL], nr++ * 4);
    }
    for (const d of drops) {
      const y = (d.y - gy) / CELL; if (nd >= MAX_DROPS || y < -4 || y > NY + 4) continue;
      dropsU.set([(d.x - X0) / CELL, y, Math.max(1.2, d.r / CELL), d.a], nd++ * 4);
    }
    if (gpu) {
      const src = pair[cur], dst = pair[1 - cur], u = sim.u;
      gl.useProgram(sim.p); gl.bindFramebuffer(gl.FRAMEBUFFER, dst.f); gl.viewport(0, 0, NX, NY);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.t); gl.uniform1i(u.uPrev, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, rowsTex); gl.uniform1i(u.uRows, 1);
      gl.uniform2i(u.uSize, NX, NY); gl.uniform1i(u.uShift, shift); gl.uniform1f(u.uX0, X0); gl.uniform1f(u.uCell, CELL); gl.uniform1f(u.uC2, C2); gl.uniform1f(u.uKeep, KEEP);
      gl.uniform4fv(u.uRocks, rocksU); gl.uniform1i(u.uNRocks, nr); gl.uniform4fv(u.uDrops, dropsU); gl.uniform1i(u.uNDrops, nd);
      gl.drawArrays(gl.TRIANGLES, 0, 3); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.activeTexture(gl.TEXTURE0);
      cur = 1 - cur;
    } else cpuStep(shift, nr, nd);
  }

  // The same step as the SIM shader, on the CPU.
  function cpuStep(shift, nr, nd) {
    const a = hNow, b = hBefore;
    if (shift) { a.copyWithin(0, shift * NX); b.copyWithin(0, shift * NX); a.fill(0, (NY - shift) * NX); b.fill(0, (NY - shift) * NX); }
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { // b becomes the new height; a stays the height now until the swap
      const k = j * NX + i, h = a[k];
      const lap = (i > 0 ? a[k - 1] : 0) + (i < NX - 1 ? a[k + 1] : 0) + (j > 0 ? a[k - NX] : 0) + (j < NY - 1 ? a[k + NX] : 0) - 4 * h;
      b[k] = h + KEEP * (h - b[k]) + C2 * lap;
    }
    for (let n = 0; n < nd; n++) {
      const x = dropsU[n * 4], y = dropsU[n * 4 + 1], r = dropsU[n * 4 + 2], amt = dropsU[n * 4 + 3];
      for (let j = Math.max(0, Math.floor(y - r)); j <= Math.min(NY - 1, Math.ceil(y + r)); j++) for (let i = Math.max(0, Math.floor(x - r)); i <= Math.min(NX - 1, Math.ceil(x + r)); i++) {
        const d = Math.hypot(i + 0.5 - x, j + 0.5 - y); if (d < r) b[j * NX + i] += amt * 0.5 * (1 + Math.cos(Math.PI * d / r));
      }
    }
    for (let j = 0; j < NY; j++) { // the banks
      const c = rowsData[j * 4], h = rowsData[j * 4 + 1];
      for (let i = 0; i < NX; i++) if (Math.abs(X0 + (i + 0.5) * CELL - c) > h) { a[j * NX + i] = 0; b[j * NX + i] = 0; }
    }
    for (let n = 0; n < nr; n++) { // the rocks
      const x = rocksU[n * 4], y = rocksU[n * 4 + 1], r = rocksU[n * 4 + 2], len = rocksU[n * 4 + 3];
      for (let j = Math.max(0, Math.floor(y - r)); j <= Math.min(NY - 1, Math.ceil(y + r)); j++) for (let i = Math.max(0, Math.floor(x - r - len)); i <= Math.min(NX - 1, Math.ceil(x + r + len)); i++)
        if (Math.hypot(Math.max(0, Math.abs(i + 0.5 - x) - len), j + 0.5 - y) < r) { a[j * NX + i] = 0; b[j * NX + i] = 0; }
    }
    for (let k = 0; k < b.length; k++) b[k] = Math.max(-4, Math.min(4, b[k]));
    hNow = b; hBefore = a;
    gl.bindTexture(gl.TEXTURE_2D, hTex); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, NX, NY, gl.RED, gl.FLOAT, hNow);
  }

  // Draws the water and banks. sy: the boat's river y; lamp: [boat x, light radius, darkness]; fire: '255,170,80'.
  const look = { water: hex('#173a63'), bank: hex('#1a2a20'), edge: hex('#5c8468') };
  function render({ sy, shake = [0, 0], lamp, fire, wash, dpr }) {
    if (row0 === null) return;
    const u = draw.u, f = fire.split(',').map(v => v / 255);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); gl.useProgram(draw.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, gpu ? pair[cur].t : hTex); gl.uniform1i(u.uH, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, rowsTex); gl.uniform1i(u.uRows, 1); gl.activeTexture(gl.TEXTURE0);
    gl.uniform2f(u.uGrid, NX, NY); gl.uniform4f(u.uView, left, unit, H * 0.74, H); gl.uniform2f(u.uShake, shake[0], shake[1]);
    gl.uniform1f(u.uX0, X0); gl.uniform1f(u.uCell, CELL); gl.uniform1f(u.uGY, row0 * CELL - sy); gl.uniform1f(u.uSlope, SLOPE);
    gl.uniform3f(u.uLamp, ...lamp); gl.uniform3f(u.uFire, ...f); gl.uniform1f(u.uWash, wash); gl.uniform1f(u.uEdgeW, 1.25 * dpr / unit);
    gl.uniform3f(u.uWater, ...look.water); gl.uniform3f(u.uBank, ...look.bank); gl.uniform3f(u.uEdge, ...look.edge);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // For the browser checks: the heights now, NX across and NY up, and where the grid sits.
  function sample() {
    let h;
    if (gpu) { const px = new Float32Array(NX * NY * 4); gl.bindFramebuffer(gl.FRAMEBUFFER, pair[cur].f); gl.readPixels(0, 0, NX, NY, gl.RGBA, gl.FLOAT, px); gl.bindFramebuffer(gl.FRAMEBUFFER, null); h = new Float32Array(NX * NY); for (let k = 0; k < h.length; k++) h[k] = px[k * 4]; }
    else h = hNow.slice();
    return { nx: NX, ny: NY, x0: X0, cell: CELL, y0: (row0 ?? 0) * CELL, h };
  }
  return { gl, path, errors, resize, reset, step, render, sample, get rows() { return NY; } };
}
