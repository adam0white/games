// The 3D look. No library: a small WebGL2 renderer of lit ellipsoids, capsules and flat plates with cast shadows.
// Animals are not modelled twice. `Recorder` stands in for a 2D canvas context: art.js draws into it as usual,
// and every ellipse becomes an ellipsoid, every stroked line a capsule chain, every polygon a plate. Later, smaller
// shapes sit on top of earlier, larger ones, which is how a head lands on a body and eyes land on a head.
const VS = `#version 300 es
layout(location=0) in vec3 pos; layout(location=1) in vec3 nor;
layout(location=2) in vec3 c0; layout(location=3) in vec3 c1; layout(location=4) in vec3 c2; layout(location=5) in vec3 tr; layout(location=6) in vec3 col;
uniform mat4 vp; uniform vec3 sun; uniform float shadow;
out vec3 vN; out vec3 vC; out vec3 vW;
void main() {
  vec3 w = c0 * pos.x + c1 * pos.y + c2 * pos.z + tr;
  if (shadow > 0.5) { w -= sun * (w.y / sun.y); w.y = 0.2; }
  vN = normalize(c0 * nor.x / dot(c0, c0) + c1 * nor.y / dot(c1, c1) + c2 * nor.z / dot(c2, c2)); vC = col; vW = w;
  gl_Position = vp * vec4(w, 1.0);
}`;
const FS = `#version 300 es
precision highp float;
in vec3 vN; in vec3 vC; in vec3 vW; uniform vec3 sun; uniform vec3 eye; uniform float shadow; out vec4 o;
void main() {
  if (shadow > 0.5) { o = vec4(0.03, 0.08, 0.02, 0.3); return; }
  vec3 n = normalize(vN), l = -sun, v = normalize(eye - vW);
  float d = max(dot(n, l), 0.0), sky = 0.5 + 0.5 * n.y;
  float spec = pow(max(dot(n, normalize(l + v)), 0.0), 28.0) * 0.35, rim = pow(1.0 - max(dot(n, v), 0.0), 3.0) * 0.22;
  vec3 c = vC * (0.34 + 0.2 * sky + 0.62 * d) + spec + rim * vec3(0.8, 1.0, 0.7);
  o = vec4(c, 1.0);
}`;
const TVS = `#version 300 es
layout(location=0) in vec3 pos; layout(location=1) in vec4 col; uniform mat4 vp; uniform vec3 sun; uniform float shadow; out vec4 vC; out vec3 vW;
void main() { vec3 w = pos; if (shadow > 0.5) { w -= sun * (w.y / sun.y); w.y = 0.2; } vC = col; vW = w; gl_Position = vp * vec4(w, 1.0); }`;
const TFS = `#version 300 es
precision highp float;
in vec4 vC; in vec3 vW; uniform float shadow; uniform float ground; uniform float world; out vec4 o;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  if (shadow > 0.5) { o = vec4(0.03, 0.08, 0.02, 0.3); return; }
  if (ground > 0.5) {
    vec2 p = vW.xz; vec2 cell = floor(p / 90.0);
    vec3 c = mod(cell.x + cell.y, 2.0) < 0.5 ? vec3(0.40, 0.62, 0.31) : vec3(0.43, 0.65, 0.34);
    c *= 0.93 + 0.14 * h(floor(p / 6.0)); c *= 0.9 + 0.1 * h(floor(p / 31.0) + 7.0);
    if (p.x < 0.0 || p.y < 0.0 || p.x > world || p.y > world) c = vec3(0.13, 0.25, 0.11);
    else { float e = min(min(p.x, p.y), min(world - p.x, world - p.y)); if (e < 8.0) c = vec3(0.23, 0.16, 0.1); }
    o = vec4(c, 1.0); return;
  }
  o = vC;
}`;

const rgbCache = new Map();
function rgb(hex) { let v = rgbCache.get(hex); if (!v) { const n = parseInt(hex.slice(1, 7), 16); rgbCache.set(hex, v = [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255].map(c => c * c * 0.85 + c * 0.15)); } return v; }

function mesh() { // unit sphere and unit cylinder (y from 0 to 1, radius 1)
  const sp = [], si = [], cy = [], ci = [], A = 14, B = 9;
  for (let j = 0; j <= B; j++) for (let i = 0; i <= A; i++) { const t = j / B * Math.PI, p = i / A * 2 * Math.PI, x = Math.sin(t) * Math.cos(p), y = Math.cos(t), z = Math.sin(t) * Math.sin(p); sp.push(x, y, z, x, y, z); }
  for (let j = 0; j < B; j++) for (let i = 0; i < A; i++) { const a = j * (A + 1) + i, b = a + A + 1; si.push(a, b, a + 1, a + 1, b, b + 1); }
  const C = 8;
  for (let i = 0; i <= C; i++) { const p = i / C * 2 * Math.PI, x = Math.cos(p), z = Math.sin(p); cy.push(x, 0, z, x, 0, z, x, 1, z, x, 0, z); }
  for (let i = 0; i < C; i++) { const a = i * 2; ci.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
  return { sp: new Float32Array(sp), si: new Uint16Array(si), cy: new Float32Array(cy), ci: new Uint16Array(ci) };
}

export function create3D(canvas, WORLD) {
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
  if (!gl) return null;
  const prog = (vs, fs) => { const p = gl.createProgram(); for (const [t, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) { const sh = gl.createShader(t); gl.shaderSource(sh, src); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); gl.attachShader(p, sh); } gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; };
  let P, T;
  try { P = prog(VS, FS); T = prog(TVS, TFS); } catch (e) { console.warn('3D look unavailable', e); return null; }
  const U = (p, n) => gl.getUniformLocation(p, n), M = mesh(), MAX = 6000, STRIDE = 15;
  const inst = kind => {
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, kind ? M.cy : M.sp, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, kind ? M.ci : M.si, gl.STATIC_DRAW);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, MAX * STRIDE * 4, gl.DYNAMIC_DRAW);
    for (let i = 0; i < 5; i++) { gl.enableVertexAttribArray(2 + i); gl.vertexAttribPointer(2 + i, 3, gl.FLOAT, false, STRIDE * 4, i * 12); gl.vertexAttribDivisor(2 + i, 1); }
    return { vao, buf, data: new Float32Array(MAX * STRIDE), n: 0, count: (kind ? M.ci : M.si).length };
  };
  const balls = inst(0), rods = inst(1);
  const tri = layer => { const vao = gl.createVertexArray(); gl.bindVertexArray(vao); const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, 9000 * 7 * 4, gl.DYNAMIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 28, 12); return { vao, buf, data: new Float32Array(9000 * 7), n: 0, layer }; };
  const plates = tri(), decals = tri(), floor = tri();
  floor.data.set([-3000, 0, -3000, 0, 0, 0, 1, WORLD + 3000, 0, -3000, 0, 0, 0, 1, -3000, 0, WORLD + 3000, 0, 0, 0, 1, WORLD + 3000, 0, -3000, 0, 0, 0, 1, WORLD + 3000, 0, WORLD + 3000, 0, 0, 0, 1, -3000, 0, WORLD + 3000, 0, 0, 0, 1]); floor.n = 6;
  gl.bindBuffer(gl.ARRAY_BUFFER, floor.buf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, floor.data.subarray(0, 42));

  const vp = new Float32Array(16), eye = [0, 0, 0]; let vw = 1, vh = 1;
  const sunRaw = [0.4, -0.8, -0.45], sl = Math.hypot(...sunRaw), sun = sunRaw.map(v => v / sl);

  // ----- what the game calls
  const api = {
    begin(w, h, dpr, tx, ty, span) { // span: world units across the screen width at the target
      vw = w; vh = h; if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
      balls.n = rods.n = plates.n = decals.n = 0;
      const fov = 0.5, pitch = 1.02, asp = w / h, D = span / (2 * Math.tan(fov / 2) * asp);
      eye[0] = tx; eye[1] = D * Math.sin(pitch); eye[2] = ty + D * Math.cos(pitch);
      const f = [tx - eye[0], -eye[1], ty - eye[2]], fl = Math.hypot(...f); f[0] /= fl; f[1] /= fl; f[2] /= fl;
      const r = [-f[2], 0, f[0]], rl = Math.hypot(r[0], r[2]); r[0] /= rl; r[2] /= rl; // forward x up
      const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
      const t = 1 / Math.tan(fov / 2), near = D * 0.2, far = D * 4, A = (far + near) / (near - far), B = 2 * far * near / (near - far);
      const view = [r[0], u[0], -f[0], r[1], u[1], -f[1], r[2], u[2], -f[2], -(r[0] * eye[0] + r[1] * eye[1] + r[2] * eye[2]), -(u[0] * eye[0] + u[1] * eye[1] + u[2] * eye[2]), f[0] * eye[0] + f[1] * eye[1] + f[2] * eye[2]];
      for (let c = 0; c < 4; c++) { // vp = proj * view, column-major
        const x = c < 3 ? view[c * 3] : view[9], y = c < 3 ? view[c * 3 + 1] : view[10], z = c < 3 ? view[c * 3 + 2] : view[11], wv = c < 3 ? 0 : 1;
        vp[c * 4] = t / asp * x; vp[c * 4 + 1] = t * y; vp[c * 4 + 2] = A * z + B * wv; vp[c * 4 + 3] = -z;
      }
    },
    project(x, h, y) { // world point (ground x, height, ground y) to screen pixels
      const cw = vp[3] * x + vp[7] * h + vp[11] * y + vp[15];
      return [((vp[0] * x + vp[4] * h + vp[8] * y + vp[12]) / cw * 0.5 + 0.5) * vw, (0.5 - (vp[1] * x + vp[5] * h + vp[9] * y + vp[13]) / cw * 0.5) * vh, cw];
    },
    ball(x, h, y, ux, uy, vx, vy, hz, c) { if (balls.n >= MAX) return; const d = balls.data, o = balls.n++ * STRIDE; d[o] = ux; d[o + 1] = 0; d[o + 2] = uy; d[o + 3] = 0; d[o + 4] = hz; d[o + 5] = 0; d[o + 6] = vx; d[o + 7] = 0; d[o + 8] = vy; d[o + 9] = x; d[o + 10] = h; d[o + 11] = y; d[o + 12] = c[0]; d[o + 13] = c[1]; d[o + 14] = c[2]; },
    rod(x0, h0, y0, x1, h1, y1, rad, c) {
      if (rods.n >= MAX) return; const ax = x1 - x0, ay = h1 - h0, az = y1 - y0; let nx = -az, nz = ax, nl = Math.hypot(nx, nz); if (nl < 1e-4) { nx = 1; nz = 0; nl = 1; } nx = nx / nl * rad; nz = nz / nl * rad;
      let bx = ay * nz, by = az * nx - ax * nz, bz = -ay * nx; const bl = Math.hypot(bx, by, bz) || 1; bx = bx / bl * rad; by = by / bl * rad; bz = bz / bl * rad;
      const d = rods.data, o = rods.n++ * STRIDE; d[o] = nx; d[o + 1] = 0; d[o + 2] = nz; d[o + 3] = ax; d[o + 4] = ay; d[o + 5] = az; d[o + 6] = bx; d[o + 7] = by; d[o + 8] = bz; d[o + 9] = x0; d[o + 10] = h0; d[o + 11] = y0; d[o + 12] = c[0]; d[o + 13] = c[1]; d[o + 14] = c[2];
      api.ball(x1, h1, y1, rad, 0, 0, rad, rad, c);
    },
    tri(buf, x0, h0, y0, x1, h1, y1, x2, h2, y2, c, a = 1) { const t = buf ? decals : plates; if (t.n >= 8997) return; const d = t.data; for (const [x, h, y] of [[x0, h0, y0], [x1, h1, y1], [x2, h2, y2]]) { const o = t.n++ * 7; d[o] = x; d[o + 1] = h; d[o + 2] = y; d[o + 3] = c[0]; d[o + 4] = c[1]; d[o + 5] = c[2]; d[o + 6] = a; } },
    // flat shapes on the ground: sight wedges and rings
    wedge(x, y, R, a0, a1, c, alpha) { const n = 14; for (let i = 0; i < n; i++) { const p = a0 + (a1 - a0) * i / n, q = a0 + (a1 - a0) * (i + 1) / n; api.tri(1, x, 0.6, y, x + Math.cos(p) * R, 0.6, y + Math.sin(p) * R, x + Math.cos(q) * R, 0.6, y + Math.sin(q) * R, c, alpha); } },
    ring(x, y, r0, r1, c, alpha, dashes = 0, spin = 0) { const n = dashes ? dashes * 2 : 28; for (let i = 0; i < n; i++) { if (dashes && i % 2) continue; const p = spin + i / n * 6.2832, q = spin + (i + 1) / n * 6.2832, cp = Math.cos(p), sp = Math.sin(p), cq = Math.cos(q), sq = Math.sin(q); api.tri(1, x + cp * r0, 0.8, y + sp * r0, x + cp * r1, 0.8, y + sp * r1, x + cq * r1, 0.8, y + sq * r1, c, alpha); api.tri(1, x + cp * r0, 0.8, y + sp * r0, x + cq * r1, 0.8, y + sq * r1, x + cq * r0, 0.8, y + sq * r0, c, alpha); } },
    end() {
      gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0.13, 0.25, 0.11, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.disable(gl.CULL_FACE);
      const up = buf => { gl.bindBuffer(gl.ARRAY_BUFFER, buf.buf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, buf.data.subarray(0, buf.n * (buf.count ? STRIDE : 7))); };
      up(balls); up(rods); up(plates); up(decals);
      const tris = (buf, shadow, ground) => { gl.useProgram(T); gl.uniformMatrix4fv(U(T, 'vp'), false, vp); gl.uniform3fv(U(T, 'sun'), sun); gl.uniform1f(U(T, 'shadow'), shadow); gl.uniform1f(U(T, 'ground'), ground); gl.uniform1f(U(T, 'world'), WORLD); gl.bindVertexArray(buf.vao); gl.drawArrays(gl.TRIANGLES, 0, buf.n); };
      const solids = shadow => { gl.useProgram(P); gl.uniformMatrix4fv(U(P, 'vp'), false, vp); gl.uniform3fv(U(P, 'sun'), sun); gl.uniform3fv(U(P, 'eye'), eye); gl.uniform1f(U(P, 'shadow'), shadow); for (const b of [balls, rods]) { gl.bindVertexArray(b.vao); gl.drawElementsInstanced(gl.TRIANGLES, b.count, gl.UNSIGNED_SHORT, 0, b.n); } };
      gl.disable(gl.BLEND); tris(floor, 0, 1);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false); tris(decals, 0, 0); gl.depthMask(true);
      solids(1); tris(plates, 1, 0); // shadows: all land at one height, so depth LESS keeps them from stacking darker
      gl.disable(gl.BLEND); solids(0); tris(plates, 0, 0);
      gl.bindVertexArray(null);
    },
  };

  // ----- a stand-in 2D context that turns art.js drawing into solids
  class Recorder {
    constructor() { this.m = [1, 0, 0, 1, 0, 0]; this.stack = []; this.path = []; this.clipE = null; this.fillStyle = '#000000'; this.strokeStyle = '#000000'; this.lineWidth = 1; this.globalAlpha = 1; this.solids = []; this.unit = 10; this.lift = 0; this.flat = 0; this.squash = 0.72; }
    start(x, y, a, unit, opt = {}) { const c = Math.cos(a), s = Math.sin(a); this.m = [c, s, -s, c, x, y]; this.stack.length = 0; this.solids.length = 0; this.clipE = null; this.unit = unit; this.lift = opt.lift || 0; this.flat = opt.flat || 0; this.squash = opt.squash || 0.72; this.globalAlpha = 1; }
    save() { this.stack.push([this.m.slice(), this.clipE, this.globalAlpha]); }
    restore() { const t = this.stack.pop(); if (t) { this.m = t[0]; this.clipE = t[1]; this.globalAlpha = t[2]; } }
    translate(x, y) { const m = this.m; m[4] += m[0] * x + m[2] * y; m[5] += m[1] * x + m[3] * y; }
    rotate(a) { const m = this.m, c = Math.cos(a), s = Math.sin(a), a0 = m[0], a1 = m[1]; m[0] = a0 * c + m[2] * s; m[1] = a1 * c + m[3] * s; m[2] = -a0 * s + m[2] * c; m[3] = -a1 * s + m[3] * c; }
    scale(x, y) { const m = this.m; m[0] *= x; m[1] *= x; m[2] *= y; m[3] *= y; }
    pt(x, y) { const m = this.m; return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }
    beginPath() { this.path = []; }
    moveTo(x, y) { this.path.push({ pts: this.pt(x, y) }); }
    lineTo(x, y) { const s = this.path[this.path.length - 1]; if (s?.pts) s.pts.push(...this.pt(x, y)); else this.moveTo(x, y); }
    closePath() { const s = this.path[this.path.length - 1]; if (s?.pts) s.closed = true; }
    ellipse(x, y, rx, ry, rot = 0, a0 = 0, a1 = 6.2832) {
      const m = this.m, c = Math.cos(rot), s = Math.sin(rot), [cx, cy] = this.pt(x, y);
      this.path.push({ e: { cx, cy, ux: (m[0] * c + m[2] * s) * rx, uy: (m[1] * c + m[3] * s) * rx, vx: (-m[0] * s + m[2] * c) * ry, vy: (-m[1] * s + m[3] * c) * ry, a0, a1, full: Math.abs(a1 - a0) > 6.2 } });
    }
    arc(x, y, r, a0, a1) { this.ellipse(x, y, r, r, 0, a0, a1); }
    clip() { const e = this.path.find(s => s.e)?.e; if (e) this.clipE = this.frame(e); }
    setLineDash() {}
    frame(e) { const a = Math.hypot(e.ux, e.uy) || 1e-3, b = Math.hypot(e.vx, e.vy) || 1e-3; return { cx: e.cx, cy: e.cy, ax: e.ux / a / a, ay: e.uy / a / a, bx: e.vx / b / b, by: e.vy / b / b, a, b }; }
    inside(E, x, y) { const dx = x - E.cx, dy = y - E.cy, p = dx * E.ax + dy * E.ay, q = dx * E.bx + dy * E.by; return 1 - p * p - q * q; }
    top(x, y, area = Infinity) { let best = 0; for (const S of this.solids) { if (area > 0.45 * S.a * S.b) continue; const q = this.inside(S, x, y); if (q > 0) best = Math.max(best, S.zc + S.hz * Math.sqrt(q)); } return best; }
    tint(hex) { const c = rgb(hex); if (this.globalAlpha > 0.95) return c; const k = this.globalAlpha; return [c[0] * k + 0.9 * (1 - k), c[1] * k + 0.95 * (1 - k), c[2] * k + (1 - k)]; }
    fill() {
      for (const s of this.path) {
        if (s.e?.full) {
          const E = this.frame(s.e), hz = Math.min(E.a, E.b) * this.squash, under = this.top(E.cx, E.cy, E.a * E.b);
          E.hz = hz; E.zc = (under > 0 ? under + hz * 0.3 : hz * 0.85 + this.flat) + (under > 0 ? 0 : this.lift);
          this.solids.push(E); api.ball(E.cx, E.zc, E.cy, s.e.ux, s.e.uy, s.e.vx, s.e.vy, hz, this.tint(this.fillStyle));
        } else if (s.pts && s.pts.length >= 6) {
          const p = s.pts, n = p.length / 2; let mx = 0, my = 0; for (let i = 0; i < n; i++) { mx += p[i * 2] / n; my += p[i * 2 + 1] / n; }
          const under = this.top(mx, my), h = under > 0 ? under + this.unit * 0.04 : this.unit * 0.42 + this.lift + this.flat, c = this.tint(this.fillStyle);
          for (let i = 1; i < n - 1; i++) api.tri(0, p[0], h, p[1], p[i * 2], h, p[i * 2 + 1], p[i * 2 + 2], h, p[i * 2 + 3], c);
        }
      }
    }
    stroke() {
      const scale = Math.sqrt(Math.abs(this.m[0] * this.m[3] - this.m[1] * this.m[2])), rad = Math.max(this.lineWidth * scale / 2, 0.3), c = this.tint(this.strokeStyle);
      for (const s of this.path) {
        let p = s.pts;
        if (s.e) { const e = s.e, n = e.full ? 16 : 6; p = []; for (let i = 0; i <= n; i++) { const a = e.a0 + (e.a1 - e.a0) * i / n; p.push(e.cx + e.ux * Math.cos(a) + e.vx * Math.sin(a), e.cy + e.uy * Math.cos(a) + e.vy * Math.sin(a)); } }
        if (!p || p.length < 4) continue;
        // split long segments so a line can follow a curved back
        const q = []; for (let i = 0; i < p.length - 2; i += 2) for (let k = 0; k < 3; k++) q.push(p[i] + (p[i + 2] - p[i]) * k / 3, p[i + 1] + (p[i + 3] - p[i + 1]) * k / 3); q.push(p[p.length - 2], p[p.length - 1]);
        const n0 = p.length / 2, n = q.length / 2, early = this.solids.length === 0; let prev = null, was = false;
        for (let i = 0; i < n; i++) {
          const x = q[i * 2], y = q[i * 2 + 1], f = i / (n - 1);
          if (this.clipE && this.inside(this.clipE, x, y) < 0) { prev = null; continue; }
          const under = this.top(x, y); let h;
          if (under > 0) { h = under + rad * 0.4; was = true; }
          else if (this.flat) h = this.unit * 0.42 + this.flat + this.lift + rad;
          else if (was) h = prev ? prev[1] + Math.hypot(x - prev[0], y - prev[2]) * 0.22 : this.unit * 0.3;
          else if (early && n0 === 3) h = rad + this.unit * (f < 0.5 ? 0.5 + f * 0.6 : 0.8 * (1 - f) * 2) + this.lift * (1 - f); // legs and tails: up from the body, over a knee, down to the ground
          else if (early && n0 === 2) h = this.unit * 0.45 + f * Math.hypot(p[2] - p[0], p[3] - p[1]) * 0.45 + this.lift; // quills and claws rise outwards
          else h = rad + this.unit * 0.12 + this.lift;
          const cur = [x, h, y];
          if (prev) api.rod(prev[0], prev[1], prev[2], x, h, y, rad, c); else api.ball(x, h, y, rad, 0, 0, rad, rad, c);
          prev = cur;
        }
      }
    }
  }
  api.recorder = new Recorder();
  api.rgb = rgb;
  return api;
}
