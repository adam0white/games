// Lantern's 3D water on the GPU: the rules of ripples.js run in half-float textures, or ripples.js's own CPU solver when the
// browser cannot draw into those, and the height texture the 3D view samples for its normals. See ripples.js for the rules.
// Each frame: a pass that marks the banks and rocks (walls), a pass that moves the field with the boat and lets the drops in,
// then grid.steps solver passes a game tick. Nothing here reads pixels back, except sample(), which only the checks call.
import { grid, createField, firstRow, sponge, X0, SPONGE, MAX_ROCKS, MAX_DROPS, CLAMP } from './ripples.js?v=2';

const QUAD = `#version 300 es
void main() { gl_Position = vec4(gl_VertexID == 1 ? 3. : -1., gl_VertexID == 2 ? 3. : -1., 0., 1.); }`;
const HEAD = `#version 300 es
precision highp float; precision highp int;
uniform ivec2 uSize; uniform float uX0, uCell;
out vec4 o;
`;
// The walls: 1 where the bank or a rock is. uRows: one texel a row, the river's centre and half width at the row's middle.
const MASK = `${HEAD}
uniform sampler2D uRows; uniform vec4 uRocks[${MAX_ROCKS}]; uniform int uNRocks; // x, y, radius, half length, in cells
void main() {
  ivec2 q = ivec2(gl_FragCoord.xy); vec2 g = vec2(q) + 0.5;
  vec2 row = texelFetch(uRows, ivec2(q.y, 0), 0).xy;
  float wall = abs(uX0 + g.x * uCell - row.x) > row.y ? 1. : 0.;
  for (int i = 0; i < ${MAX_ROCKS}; i++) { if (i >= uNRocks) break; vec4 r = uRocks[i]; if (length(vec2(max(0., abs(g.x - r.x) - r.w), g.y - r.y)) < r.z) wall = 1.; }
  o = vec4(wall, 0, 0, 1);
}`;
// The field moves with the boat (uShift rows) and the drops go in, as bumps let go from rest. r: height now, g: one step before.
const SPLASH = `${HEAD}
uniform sampler2D uPrev; uniform int uShift;
uniform vec4 uDrops[${MAX_DROPS}]; uniform int uNDrops; // x, y, radius in cells, height
void main() {
  ivec2 q = ivec2(gl_FragCoord.xy), src = q + ivec2(0, uShift);
  vec2 c = src.y >= 0 && src.y < uSize.y ? texelFetch(uPrev, src, 0).rg : vec2(0);
  vec2 g = vec2(q) + 0.5;
  for (int i = 0; i < ${MAX_DROPS}; i++) { if (i >= uNDrops) break; vec4 d = uDrops[i]; float k = length(g - d.xy); if (k < d.z) c += d.w * 0.5 * (1. + cos(3.14159265 * k / d.z)); }
  o = vec4(c, 0, 1);
}`;
// One solver step. A wall neighbour counts as the cell itself (no water crosses a wall); off the grid's ends counts as still water.
const STEP = `${HEAD}
uniform sampler2D uPrev, uMask; uniform float uC2, uKeep, uVisc;
vec2 nb(ivec2 p, vec2 c) { if (p.y < 0 || p.y >= uSize.y) return vec2(0); if (p.x < 0 || p.x >= uSize.x || texelFetch(uMask, p, 0).r > 0.5) return c; return texelFetch(uPrev, p, 0).rg; }
void main() {
  ivec2 q = ivec2(gl_FragCoord.xy);
  if (texelFetch(uMask, q, 0).r > 0.5) { o = vec4(0, 0, 0, 1); return; }
  vec2 c = texelFetch(uPrev, q, 0).rg; float h = c.r;
  vec2 l2 = nb(q + ivec2(1, 0), c) + nb(q - ivec2(1, 0), c) + nb(q + ivec2(0, 1), c) + nb(q - ivec2(0, 1), c) - 4. * c; // now and before
  float d = float(min(q.y, uSize.y - 1 - q.y)), sp = d >= ${SPONGE}. ? 1. : 1. - 0.1 * pow((${SPONGE}. - d) / ${SPONGE}., 2.);
  o = vec4(clamp((h + uKeep * (h - c.g) + uC2 * l2.x + uVisc * (l2.x - l2.y)) * sp, -${CLAMP}., ${CLAMP}.), h * sp, 0, 1);
}`;

// gl: the 3D view's context. level: 1 or 2 (ripples.js LEVELS). cpu: use the CPU solver even when the GPU one would work.
// Returns null when neither can start; the 3D view then draws its water without ripples.
export function createWaterGL(gl, level, { cpu = false } = {}) {
  const g = grid(level), { nx, ny, cell } = g;
  const made = [], fail = () => { for (const [kind, x] of made) gl[kind](x); return null; };
  const keep = (kind, x) => (made.push([kind, x]), x);
  const tex = (w, h, inner, format, type, filter) => {
    const t = keep('deleteTexture', gl.createTexture()); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, inner, w, h, 0, format, type, null);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, filter], [gl.TEXTURE_MAG_FILTER, filter], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    return t;
  };
  const target = t => { const f = keep('deleteFramebuffer', gl.createFramebuffer()); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE; gl.bindFramebuffer(gl.FRAMEBUFFER, null); return ok ? f : null; };
  function program(fs) {
    const p = keep('deleteProgram', gl.createProgram());
    for (const [type, src] of [[gl.VERTEX_SHADER, QUAD], [gl.FRAGMENT_SHADER, fs]]) { const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh); gl.attachShader(p, sh); gl.deleteShader(sh); }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.warn('Lantern ripples: a water program did not build', gl.getProgramInfoLog(p)); return null; }
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i).name; u[name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, name); }
    return { p, u };
  }
  const floats = !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));
  const vao = keep('deleteVertexArray', gl.createVertexArray());
  const rowsData = new Float32Array(ny * 4), rocksU = new Float32Array(MAX_ROCKS * 4), dropsU = new Float32Array(MAX_DROPS * 4);
  let gpu = !cpu && floats, P = null, pair = null, cur = 0, mask = null, rowsTex = null, field = null, hTex = null, row0 = null;
  if (gpu) {
    P = { mask: program(MASK), splash: program(SPLASH), step: program(STEP) };
    rowsTex = tex(ny, 1, gl.RGBA32F, gl.RGBA, gl.FLOAT, gl.NEAREST);
    pair = [0, 1].map(() => { const t = tex(nx, ny, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR); return { t, f: target(t) }; });
    const m = tex(nx, ny, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.NEAREST); mask = { t: m, f: target(m) };
    gpu = P.mask && P.splash && P.step && pair.every(p => p.f) && mask.f;
    if (gpu) { clear(); if (gl.getError() !== gl.NO_ERROR) gpu = false; }
  }
  if (!gpu) { // the CPU solver, its heights sent to a one-channel half-float texture each frame (filterable without any extension)
    fail(); made.length = 0;
    field = createField(level);
    hTex = tex(nx, ny, gl.R16F, gl.RED, gl.FLOAT, gl.LINEAR);
    if (gl.getError() !== gl.NO_ERROR) return fail();
  }
  gl.bindTexture(gl.TEXTURE_2D, null);
  function clear() { for (const p of pair) { gl.bindFramebuffer(gl.FRAMEBUFFER, p.f); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); } gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
  function reset() { row0 = null; if (gpu) clear(); else field.reset(); }

  function pass(prog, dst, setup) {
    gl.useProgram(prog.p); gl.bindFramebuffer(gl.FRAMEBUFFER, dst); gl.viewport(0, 0, nx, ny);
    gl.uniform2i(prog.u.uSize, nx, ny); if (prog.u.uX0) gl.uniform1f(prog.u.uX0, X0); if (prog.u.uCell) gl.uniform1f(prog.u.uCell, cell);
    setup(prog.u); gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  const bindTex = (unit, t, loc) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(loc, unit); };
  // ticks game ticks of water. sy: the boat's river y; river(y) -> [centre, half]; rocks and drops as in ripples.js.
  function step(sy, river, rocks, drops, ticks) {
    if (!gpu) { field.step(sy, river, rocks, drops, ticks); row0 = field.row0; gl.bindTexture(gl.TEXTURE_2D, hTex); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, nx, ny, gl.RED, gl.FLOAT, field.h); gl.bindTexture(gl.TEXTURE_2D, null); return; }
    const first = firstRow(sy, cell); let shift = row0 === null ? ny : first - row0; row0 = first;
    if (shift < 0 || shift > ny) shift = ny; // a new run or a jump: still water
    for (let j = 0; j < ny; j++) { const [c, h] = river((row0 + j + 0.5) * cell); rowsData[j * 4] = c; rowsData[j * 4 + 1] = h; }
    let nr = 0, nd = 0;
    for (const k of rocks) if (nr < MAX_ROCKS) rocksU.set([(k.x - X0) / cell, k.y / cell - row0, k.rad / cell, k.len / cell], nr++ * 4);
    for (const d of drops) { const y = d.y / cell - row0; if (nd < MAX_DROPS && y > -8 && y < ny + 8) dropsU.set([(d.x - X0) / cell, y, Math.max(1.5, d.r / cell), d.a], nd++ * 4); }
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.depthMask(false); gl.bindVertexArray(vao);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, rowsTex); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, ny, 1, gl.RGBA, gl.FLOAT, rowsData);
    pass(P.mask, mask.f, u => { bindTex(0, rowsTex, u.uRows); gl.uniform4fv(u.uRocks, rocksU); gl.uniform1i(u.uNRocks, nr); });
    pass(P.splash, pair[1 - cur].f, u => { bindTex(0, pair[cur].t, u.uPrev); gl.uniform1i(u.uShift, shift); gl.uniform4fv(u.uDrops, dropsU); gl.uniform1i(u.uNDrops, nd); });
    cur = 1 - cur;
    for (let i = 0; i < ticks * g.steps; i++) {
      pass(P.step, pair[1 - cur].f, u => { bindTex(0, pair[cur].t, u.uPrev); bindTex(1, mask.t, u.uMask); gl.uniform1f(u.uC2, g.c2); gl.uniform1f(u.uKeep, g.keep); gl.uniform1f(u.uVisc, g.visc); });
      cur = 1 - cur;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.bindVertexArray(null); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, null); gl.activeTexture(gl.TEXTURE0); gl.depthMask(true);
  }
  // For drawing: the height texture on a unit, and where the grid lies (sy: the boat's river y).
  function bind(unit, loc) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, gpu ? pair[cur].t : hTex); gl.uniform1i(loc, unit); gl.activeTexture(gl.TEXTURE0); }
  const place = sy => row0 === null ? null : [X0, cell, row0 * cell - sy, nx, ny];
  // For the checks: the heights now, nx across and ny along, from the first row (river y = row0 * cell) on.
  function sample() {
    if (!gpu) return { nx, ny, cell, row0, h: Float32Array.from(field.h) };
    const h = new Float32Array(nx * ny), px = new Float32Array(nx * ny * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, pair[cur].f);
    gl.readPixels(0, 0, nx, ny, gl.RGBA, gl.FLOAT, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    for (let k = 0; k < h.length; k++) h[k] = px[k * 4];
    return { nx, ny, cell, row0, h };
  }
  function dispose() { for (const [kind, x] of made) gl[kind](x); made.length = 0; }
  return { level, path: gpu ? 'gpu' : 'cpu', nx, ny, cell, steps: g.steps, step, bind, place, sample, reset, dispose };
}
export { sponge };
