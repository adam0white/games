// Pour: the rules. Pure, seeded, runs in Node. A jug tips around its spout and pours a liquid into a glass; fill the
// glass to the line: not under it, not over it.
// World units: 100 wide, 160 tall, y down. One step is DT seconds.
//   const s = create(level, seed); step(s, tilt); s.over, s.won, s.stars, s.inGlass ...
//   tilt is what the thumb asks for, 0 (upright) to MAX_TILT; the jug follows at TURN rad/s and stands up at SETDOWN.
//
// The model (2026-11-24 rewrite, see NOTES):
// - The jug is a reservoir, not a pile of particles. The flow out of the spout follows the thumb: nothing below
//   POUR_FROM, then a smooth rise to the liquid's full flow at POUR_FULL, nearly the same at any fill. A liquid's
//   `lag` is how long the flow takes to follow the thumb (honey keeps coming after you lift).
// - Each drop leaves the spout as a particle. In the stream drops do not push each other (they fall as one column);
//   once a drop touches the glass, the liquid in it, or a wall, it is liquid: drops push apart when closer than a
//   diameter, pull together a little out to 1.5 diameters (cohesion), and share their velocity with neighbours
//   (XSPH viscosity). Position-based (Verlet), two substeps, one Jacobi pass per substep.
// - Only + - * / sqrt and floor are used on the state, so a seed gives the same pour in every browser.

export const DT = 1 / 60;
export const MAX_TILT = 2.4;
export const TURN = 2.4, SETDOWN = 5;   // the jug follows the thumb at TURN rad/s and stands up at SETDOWN
export const POUR_FROM = 0.95, POUR_FULL = 2.25; // thumb tilt where liquid starts to run, and where the flow is full
export const R = 1.45;                  // drop radius
export const FLOOR = 152;
export const SPOUT = { x: 44, y: 56 };
const G = 220, SUB = 2, DAMP = 0.996, AIR = 0.975;
const JW = 15, JD = 42;                 // jug inner half-width and depth (local frame: lip line y=0, bottom y=JD)
const D = 2 * R, H = 1.5 * D, D2 = D * D, H2 = H * H;
export const AREA = 7.2;                // area one settled drop takes in a glass (measured 7.2 to 7.5 for juice and soda, 5.4 to 6.1 for honey; see NOTES)

export function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// A sine from + - * / only (Math.sin may differ in its last bit between browsers).
export function psin(x) {
  const TAU = 6.283185307179586, PI = 3.141592653589793, HALF = 1.5707963267948966;
  x -= TAU * Math.floor(x / TAU + 0.5);
  if (x > HALF) x = PI - x; else if (x < -HALF) x = -PI - x;
  const x2 = x * x;
  return x * (1 - x2 / 6 * (1 - x2 / 20 * (1 - x2 / 42 * (1 - x2 / 72 * (1 - x2 / 110)))));
}

// Liquids: flow (drops a second at full tilt), lag (s), viscosity and cohesion (per substep), how far the spout
// throws (units a second at no flow and the extra at full flow), foam (units of froth per drop that lands).
export const LIQUIDS = {
  juice: { flow: 9, lag: 0.08, visc: 0.1, stick: 0.03, throw: [9, 9], fall: [5, 5], foam: 0 },
  honey: { flow: 4.7, lag: 0.5, visc: 0.45, stick: 0.1, throw: [4, 4], fall: [3, 3], foam: 0 },
  soda: { flow: 9, lag: 0.08, visc: 0.06, stick: 0.02, throw: [9, 9], fall: [5, 5], foam: 1.3 },
};

// Levels: one new idea each. n from 1.
export const LEVELS = 8;
export function level(n) {
  const k = Math.max(1, Math.min(LEVELS, n | 0));
  const T = [
    // idea, liquid, drops, glass half-width, target, band (+-), sway amplitude, sway speed, spill allowed, glass x offset, glasses, seconds, pace (flow x)
    ['juice', 'juice', 80, 13, 34, 9, 0, 0, 30, 6, 1, 30, 1],
    ['honey', 'honey', 80, 11, 34, 6, 0, 0, 26, 3, 1, 40, 0.98],
    ['tall', 'juice', 80, 10, 40, 7, 0, 0, 26, 6, 1, 30, 0.88],
    ['sway', 'juice', 80, 10, 36, 7, 12, 1.3, 22, 6, 1, 30, 1],
    ['soda', 'soda', 80, 12, 34, 7, 0, 0, 26, 6, 1, 40, 0.98],
    ['honey-sway', 'honey', 80, 10, 30, 5, 12, 1.4, 15, 3, 1, 45, 1],
    ['two', 'juice', 80, 10, 24, 7, 0, 0, 30, 6, 2, 45, 1.04],
    ['small', 'juice', 70, 8, 22, 6, 0, 0, 24, 6, 1, 30, 0.97],
  ][k - 1];
  const [idea, liquid, drops, gw, target, band, sway, speed, spill, gx, glasses, time, pace] = T;
  return { n: k, idea, liquid, drops, gw, target, band, sway, speed, spill, gx, glasses, time, pace };
}

const GAP = 34; // distance between the two glasses on the belt

export function create(n, seed = 1, opts = {}) {
  const L = level(n), rand = rng(seed * 7919 + L.n), liq = LIQUIDS[L.liquid];
  const s = {
    L, liq, seed, t: 0, mutate: !!opts.mutate, rs: (seed * 2654435761 + L.n * 97) >>> 0 || 1,
    pivot: { x: SPOUT.x, y: SPOUT.y }, angle: 0, flow: 0, acc: 0,
    glasses: [], glass: null, belt: 0, beltMoving: false,
    p: [], // {x,y,px,py,st,air,e} st: 1 free, 2 spilled (frozen); air: 1 while in the stream; e: when it left the spout
    inGlass: 0, inJug: L.drops, spilled: 0, flying: 0, calm: 0, poured: false,
    over: false, won: false, stars: 0, why: '', events: [],
  };
  const phase = rand() * Math.PI * 2;
  for (let i = 0; i < L.glasses; i++)
    s.glasses.push({ x0: SPOUT.x + L.gx + i * GAP, x: 0, w: L.gw, top: 108, bottom: FLOOR - 2, phase, n: 0, foam: 0 });
  placeGlasses(s);
  count(s);
  return s;
}
export const clone = s => structuredClone(s);

function sway(s, t) { return s.L.sway ? s.L.sway * psin(t * s.L.speed + s.glasses[0].phase) : 0; }
export function glassX(s, t = s.t) { return s.glass.x0 - s.belt + sway(s, t); }
function placeGlasses(s) {
  const off = sway(s, s.t) - s.belt;
  for (const g of s.glasses) g.x = g.x0 + off;
  s.glass = s.glasses[s.belt < GAP / 2 ? 0 : 1];
}

// The jug's own angle on screen for the current thumb control and fill: it tips until the surface reaches the spout,
// then a little further as the flow rises. Drawing only (it uses Math.cos and Math.sin; nothing in the state does).
const ONSET = [];
function jugArea(a, level) { // area of the jug below the world line y = level, local frame turned by a about the spout
  const c = Math.cos(a), n = Math.sin(a), pts = [[-JW, 0], [JW, 0], [JW, JD], [-JW, JD]].map(([x, y]) => [c * (x - JW) - n * y, n * (x - JW) + c * y]);
  const out = [];
  for (let i = 0; i < 4; i++) {
    const p = pts[i], q = pts[(i + 1) % 4], pin = p[1] >= level, qin = q[1] >= level;
    if (pin) out.push(p);
    if (pin !== qin) { const t = (level - p[1]) / (q[1] - p[1]); out.push([p[0] + (q[0] - p[0]) * t, level]); }
  }
  let A = 0; for (let i = 0; i < out.length; i++) { const p = out[i], q = out[(i + 1) % out.length]; A += p[0] * q[1] - q[0] * p[1]; }
  return Math.abs(A) / 2;
}
export const JUG_FULL = 0.62; // the share of the jug a full pour of 80 drops fills
function onsetAngle(frac) {
  const i = Math.max(0, Math.min(100, Math.round(frac * 100)));
  if (ONSET[i] === undefined) {
    const A = i / 100 * JUG_FULL * 2 * JW * JD;
    let lo = 0, hi = 3.1;
    for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (jugArea(m, 0) > A) lo = m; else hi = m; }
    ONSET[i] = lo;
  }
  return ONSET[i];
}
export function jugAngle(s) {
  const frac = s.inJug / s.L.drops, on = onsetAngle(frac);
  return s.angle < POUR_FROM ? s.angle / POUR_FROM * on * 0.96 : on * 0.96 + (s.angle - POUR_FROM) / (MAX_TILT - POUR_FROM) * (0.55 + 0.04 * on);
}
// The surface height of what is left in the jug, in world y, for drawing it level.
export function jugSurface(s, a = jugAngle(s)) {
  const A = s.inJug / s.L.drops * JUG_FULL * 2 * JW * JD;
  let lo = -80, hi = 80;
  for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (jugArea(a, m) > A) lo = m; else hi = m; }
  return SPOUT.y + Math.max(0, lo);
}
export function toWorld(s, lx, ly, a = jugAngle(s)) {
  const c = Math.cos(a), n = Math.sin(a), x = lx - JW, y = ly;
  return { x: s.pivot.x + c * x - n * y, y: s.pivot.y + n * x + c * y };
}
export const JUG = { w: JW, d: JD };

// the jiggle's random numbers live in the state (a number), so a state can be copied with structuredClone
function jig(s) { let t = (s.rs = (s.rs + 0x6d2b79f5) | 0); t = Math.imul(t ^ (t >>> 15), 1 | t); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }

// How hard the thumb is pouring, 0 to 1, for a control angle.
export function pourShare(a) {
  const x = Math.max(0, Math.min(1, (a - POUR_FROM) / (POUR_FULL - POUR_FROM)));
  return x * (0.35 + 0.65 * x);
}

export function step(s, tilt) {
  if (s.over) return s;
  s.events.length = 0;
  const want = Math.max(0, Math.min(MAX_TILT, +tilt || 0));
  const d = want - s.angle, maxd = (d < 0 ? SETDOWN : TURN) * DT;
  s.angle += Math.max(-maxd, Math.min(maxd, d));
  s.t += DT;
  moveBelt(s);
  placeGlasses(s);
  pour(s);
  const h = DT / SUB, P = s.p;
  for (let sub = 0; sub < SUB; sub++) {
    for (const q of P) {
      if (q.st === 2) continue;
      const vx = (q.x - q.px) * (q.air ? AIR : DAMP), vy = (q.y - q.py) * DAMP;
      q.px = q.x; q.py = q.y;
      q.x += vx + (q.air ? 0 : (jig(s) - 0.5) * 0.04); q.y += vy + G * h * h; // a little jiggle keeps the pile liquid
    }
    relax(s);
    walls(s);
  }
  foam(s);
  count(s);
  judge(s);
  return s;
}

// The flow follows the thumb with the liquid's lag; whole drops leave the spout.
function pour(s) {
  const liq = s.liq, share = pourShare(s.angle);
  const q = s.inJug > 0 ? liq.flow * s.L.pace * share * (0.85 + 0.15 * s.inJug / s.L.drops) : 0;
  s.flow += (q - s.flow) * Math.min(1, DT / liq.lag);
  if (q === 0 && s.flow < 0.4) { s.flow = 0; s.acc = 0; }
  s.acc += s.flow * DT;
  const x = s.flow / (liq.flow * s.L.pace), h = DT / SUB;
  while (s.acc >= 1 && s.inJug > 0) {
    s.acc -= 1; s.inJug--; s.poured = true;
    const vx = liq.throw[0] + liq.throw[1] * x + (jig(s) - 0.5) * 0.8, vy = liq.fall[0] + liq.fall[1] * x;
    const y = s.pivot.y + 0.6 + (jig(s) - 0.5) * 0.8, px = s.pivot.x + 0.8;
    s.p.push({ x: px, y, px: px - vx * h, py: y - vy * h, st: 1, air: 1, e: s.t });
    s.events.push('out');
  }
}

// The second glass waits on a belt; it slides under the spout once the first has stood still in its band.
function moveBelt(s) {
  if (s.glasses.length < 2) return;
  if (!s.beltMoving && s.belt === 0) {
    const [lo] = band(s), g = s.glasses[0];
    if (g.n >= lo && s.calm >= 0.8) { s.beltMoving = true; s.events.push('belt'); }
  }
  if (s.beltMoving) {
    s.belt = Math.min(GAP, s.belt + 22 * DT);
    if (s.belt >= GAP) s.beltMoving = false;
  }
}

// Neighbour grid: cells of H units over the play area; positions outside clamp to the edge cells, which keeps every
// pair closer than H in the same or a neighbouring cell. Corrections are summed, then applied (Jacobi), so the order the
// pairs are visited in changes nothing but the rounding of those sums (grid-check.mjs compares the grid with every pair).
const GX0 = -12, GY0 = -60, GW = Math.ceil(126 / H), GH = Math.ceil(222 / H);
const heads = new Int32Array(GW * GH).fill(-1);
let nexts = new Int32Array(128), cx = new Float64Array(128), cy = new Float64Array(128), vx = new Float64Array(128), vy = new Float64Array(128), land = new Uint8Array(128);
const touched = [];
const cellX = x => { const c = Math.floor((x - GX0) / H); return c >= 0 ? (c < GW ? c : GW - 1) : 0; };
const cellY = y => { const c = Math.floor((y - GY0) / H); return c >= 0 ? (c < GH ? c : GH - 1) : 0; };

function pair(s, i, j) {
  const P = s.p, q = P[i], o = P[j];
  if (q.air && o.air) return; // the stream falls as one column
  const dx = o.x - q.x, dy = o.y - q.y, d2 = dx * dx + dy * dy;
  if (d2 >= H2 || !(d2 > 1e-9)) return;
  const d = Math.sqrt(d2);
  if (d2 < D2) {
    const push = (D - d) * 0.25 / d;
    cx[i] -= dx * push; cy[i] -= dy * push; cx[j] += dx * push; cy[j] += dy * push;
    if (q.air) land[i] = 1; if (o.air) land[j] = 1; // a stream drop that meets the liquid joins it (after the pass)
  } else if (!q.air && !o.air) {
    const pull = (d - D) * s.liq.stick / d;
    cx[i] += dx * pull; cy[i] += dy * pull; cx[j] -= dx * pull; cy[j] -= dy * pull;
  }
  if (!q.air && !o.air) {
    const w = (1 - d / H) * s.liq.visc * 0.5, ux = (vx[j] - vx[i]) * w, uy = (vy[j] - vy[i]) * w;
    // velocity is x - px, so moving px changes it without moving the drop
    q.px -= ux; q.py -= uy; o.px += ux; o.py += uy;
  }
}

function relax(s, brute = false) {
  const P = s.p, n = P.length;
  if (n > nexts.length) { const m = n * 2; nexts = new Int32Array(m); cx = new Float64Array(m); cy = new Float64Array(m); vx = new Float64Array(m); vy = new Float64Array(m); land = new Uint8Array(m); }
  for (let i = 0; i < n; i++) { cx[i] = 0; cy[i] = 0; land[i] = 0; const q = P[i]; vx[i] = q.x - q.px; vy[i] = q.y - q.py; }
  if (brute) {
    for (let i = 0; i < n; i++) if (P[i].st !== 2) for (let j = i + 1; j < n; j++) if (P[j].st !== 2) pair(s, i, j);
  } else {
    for (const c of touched) heads[c] = -1;
    touched.length = 0;
    for (let i = n - 1; i >= 0; i--) {
      const q = P[i]; if (q.st === 2) continue;
      const c = cellX(q.x) * GH + cellY(q.y);
      if (heads[c] === -1) touched.push(c);
      nexts[i] = heads[c]; heads[c] = i;
    }
    for (let i = 0; i < n; i++) {
      const q = P[i]; if (q.st === 2) continue;
      const gx = cellX(q.x), gy = cellY(q.y);
      for (let ox = -1; ox <= 1; ox++) {
        const x = gx + ox; if (x < 0 || x >= GW) continue;
        for (let oy = -1; oy <= 1; oy++) {
          const y = gy + oy; if (y < 0 || y >= GH) continue;
          for (let j = heads[x * GH + y]; j !== -1; j = nexts[j]) if (j > i) pair(s, i, j);
        }
      }
    }
  }
  for (let i = 0; i < n; i++) { const q = P[i]; if (q.st === 2) continue; q.x += cx[i]; q.y += cy[i]; if (land[i]) q.air = 0; }
}
// For grid-check.mjs: one relaxation pass through the grid or over every pair.
export function relaxOnce(s, brute) { relax(s, brute); return s; }

function walls(s) {
  const T = 1.2; // glass wall thickness
  for (const q of s.p) {
    if (q.st === 2) continue;
    for (const g of s.glasses) {
      const gl = g.x - g.w, gr = g.x + g.w;
      if (q.y <= g.top - R || q.x < gl - T - R * 2 || q.x > gr + T + R * 2) continue;
      // the glass: two walls and a floor. Inside stays inside; outside stays outside; the rim tops are solid points.
      const wasIn = q.px > gl && q.px < gr && q.py > g.top - R * 2;
      if (wasIn && q.y > g.top) {
        // a stream drop stays in the stream until it meets the liquid, a wall or the floor
        const x0 = q.x, y0 = q.y;
        if (q.x < gl + R) q.x = gl + R;
        if (q.x > gr - R) q.x = gr - R;
        if (q.y > g.bottom - R && !s.mutate) q.y = g.bottom - R; // mutation: the glass has no floor
        if (q.air && (q.x !== x0 || q.y !== y0)) q.air = 0;
        if (!q.air && !q.f) { q.f = 1; g.foam += s.liq.foam; } // soda froths where it lands
      } else if (!wasIn && q.y > g.top) {
        if (q.x > gl - T - R && q.x < gl + R && q.px <= gl) { q.x = gl - T - R; q.air = 0; }
        else if (q.x < gr + T + R && q.x > gr - R && q.px >= gr) { q.x = gr + T + R; q.air = 0; }
      }
      for (const rx of [gl - T / 2, gr + T / 2]) { // rim tops
        const dx = q.x - rx, dy = q.y - g.top, d2 = dx * dx + dy * dy, m = R + T / 2;
        if (d2 < m * m && d2 > 1e-9) { const d = Math.sqrt(d2); q.x = rx + dx / d * m; q.y = g.top + dy / d * m; q.air = 0; }
      }
    }
    if (q.y > FLOOR - R || q.x < -6 || q.x > 106 || !(q.y === q.y)) { q.st = 2; q.air = 0; q.y = Math.min(q.y, FLOOR - R); s.events.push('spill'); }
  }
}

// Soda froth sits on top of the liquid and settles away; it never counts as liquid.
function foam(s) {
  if (!s.liq.foam) return;
  for (const g of s.glasses) {
    g.foam -= g.foam * DT / 1.5;
    if (g.foam < 0.05) g.foam = 0;
    const room = levelY(s, g.n, g) - g.top + 4;
    if (g.foam > room) g.foam = room;
  }
}

function count(s) {
  let fly = 0, sp = 0;
  const before = s.glass ? s.glass.n : 0, active = s.glass;
  for (const g of s.glasses) g.n = 0;
  for (const q of s.p) {
    if (q.st === 2) { sp++; continue; }
    let inside = false;
    for (const g of s.glasses) if (q.x > g.x - g.w && q.x < g.x + g.w && q.y > g.top) { g.n++; inside = true; break; }
    if (!inside) fly++;
  }
  const lo = s.L.target - s.L.band, inG = active.n;
  if (inG > before && before < lo && inG >= lo) s.events.push('line');
  if (inG > before) s.events.push('drip');
  s.inGlass = inG; s.spilled = sp; s.flying = fly;
}

export function band(s) { return [s.L.target - s.L.band, s.L.target + s.L.band]; }
// Where a glass's liquid surface for `n` drops sits, in world y (for drawing the line and the liquid).
export function levelY(s, n, g = s.glass) { return g.bottom - n * AREA / (2 * g.w); }

function judge(s) {
  const [lo, hi] = band(s), last = s.glass === s.glasses[s.glasses.length - 1];
  const pouring = s.flow > 0 || s.angle >= POUR_FROM;
  const frothy = s.glasses.some(g => g.foam > 0.5);
  s.calm = (s.flying === 0 && !pouring && !frothy && !s.beltMoving) ? s.calm + DT : 0;
  if (s.spilled > s.L.spill) return end(s, false, 'spill');
  if (s.glasses.some(g => g.n > hi) && s.calm > 0.4) return end(s, false, 'over');
  if (last && s.poured && s.calm > 1.0 && (s.inGlass >= lo || s.inJug === 0)) return verdict(s);
  if (s.t > s.L.time) return verdict(s);
}
function verdict(s) {
  const [lo, hi] = band(s);
  if (s.glasses.some(g => g.n > hi)) return end(s, false, 'over');
  if (s.glasses.some(g => g.n < lo)) return end(s, false, 'under');
  return end(s, true, 'ok');
}
// Stars are for how close: one anywhere in the band, two within 60% of it, three within a quarter of it.
export function starsFor(s) {
  const off = Math.max(...s.glasses.map(g => Math.abs(g.n - s.L.target)));
  return off <= Math.ceil(s.L.band * 0.25) ? 3 : off <= Math.ceil(s.L.band * 0.6) ? 2 : 1;
}
function end(s, won, why) {
  s.over = true; s.won = won; s.why = why;
  if (won) s.stars = starsFor(s);
  s.events.push(won ? 'win' : 'lose');
  return s;
}

// A digest of the state, for determinism checks.
export function digest(s) {
  let h = 2166136261;
  for (const q of s.p) for (const v of [q.x, q.y]) { h ^= Math.round(v * 1000); h = Math.imul(h, 16777619); }
  return [s.inGlass, s.spilled, s.inJug, s.over, s.won, s.stars, h >>> 0].join(':');
}
