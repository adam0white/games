// Pour: the rules. Pure, seeded, runs in Node. A jug of juice tips around its spout; the drops are particles
// (position-based: gravity, push apart, walls). Fill the glass to the line: not under it, not over it.
// World units: 100 wide, 160 tall, y down. One step is DT seconds.
//   const s = create(level, seed); step(s, tilt); s.over, s.won, s.stars, s.inGlass ...
//   tilt is the angle the player asks for, 0 (upright) to MAX_TILT radians; the jug tips at TURN rad/s and stands up at SETDOWN.

export const DT = 1 / 60;
export const MAX_TILT = 2.4;
export const TURN = 1.5, SETDOWN = 3.5; // tipping is slow (a fast tip flings juice); standing the jug up is quick
export const R = 1.45;          // drop radius
export const FLOOR = 152;
const G = 220, SUB = 2, DAMP = 0.996, AIR = 0.975; // AIR: free drops lose sideways speed, so the stream falls in a column
const JW = 15, JD = 42;         // jug inner half-width and depth (local frame: lip line y=0, bottom y=JD)

export function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Levels: n from 1. Glass width, target band, motion and spare juice set the difficulty.
export const LEVELS = 8;
export function level(n) {
  const k = Math.max(1, Math.min(LEVELS, n | 0));
  const T = [
    // drops, glass half-width, target, band (+-), glass sway amplitude, sway speed (rad/s), spill allowed, glass x offset
    [80, 13, 34, 7, 0, 0, 22, 11],
    [80, 12, 38, 6, 0, 0, 20, 11],
    [78, 12, 34, 5, 4, 0.6, 20, 11],
    [78, 11, 40, 5, 6, 0.7, 19, 11],
    [76, 11, 40, 4, 7, 0.8, 20, 11],
    [76, 10, 42, 6, 8, 0.9, 18, 11],
    [74, 10, 36, 3, 9, 1.0, 16, 11],
    [74, 10, 44, 3, 10, 1.1, 18, 11],
  ][k - 1];
  const [drops, gw, target, band, sway, speed, spill, gx] = T;
  return { n: k, drops, gw, target, band, sway, speed, spill, gx, time: 30 };
}

export function create(n, seed = 1, opts = {}) {
  const L = level(n), rand = rng(seed * 7919 + L.n);
  const s = {
    L, seed, t: 0, mutate: !!opts.mutate, rs: (seed * 2654435761 + L.n * 97) >>> 0 || 1,
    pivot: { x: 44, y: 30 }, angle: 0,
    glass: { x0: 44 + L.gx, x: 44 + L.gx, w: L.gw, top: 108, bottom: FLOOR - 2, phase: rand() * Math.PI * 2 },
    p: [], // {x,y,px,py,st} st: 0 jug, 1 free, 2 spilled (frozen)
    inGlass: 0, inJug: 0, spilled: 0, flying: 0, calm: 0, poured: false,
    over: false, won: false, stars: 0, why: '', events: [],
  };
  // fill the jug: a loose grid with seeded jitter, in local coordinates
  const cols = Math.floor((JW * 2 - 2 * R) / (2 * R) + 1);
  for (let i = 0; i < L.drops; i++) {
    const c = i % cols, r = Math.floor(i / cols);
    const lx = -JW + R + c * 2 * R * 1.0 + (r % 2) * R * 0.9 + rand() * 0.2, ly = JD - R - r * 2 * R * 1.0 - rand() * 0.2;
    const w = toWorld(s, lx, ly);
    s.p.push({ x: w.x, y: w.y, px: w.x, py: w.y, st: 0 });
  }
  count(s);
  return s;
}

// local frame: x across the jug, y down from the lip line; the pivot is the right lip (JW, 0)
export function toWorld(s, lx, ly) {
  const c = Math.cos(s.angle), n = Math.sin(s.angle), x = lx - JW, y = ly;
  return { x: s.pivot.x + c * x - n * y, y: s.pivot.y + n * x + c * y };
}
function toLocal(s, wx, wy) {
  const c = Math.cos(s.angle), n = Math.sin(s.angle), x = wx - s.pivot.x, y = wy - s.pivot.y;
  return { x: c * x + n * y + JW, y: -n * x + c * y };
}
export const JUG = { w: JW, d: JD };

// the jiggle's random numbers live in the state (a number), so a state can be copied with structuredClone
function jig(s) { let t = (s.rs = (s.rs + 0x6d2b79f5) | 0); t = Math.imul(t ^ (t >>> 15), 1 | t); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
export const clone = s => structuredClone(s);

export function glassX(s, t = s.t) { const g = s.glass; return g.x0 + s.L.sway * Math.sin(t * s.L.speed + g.phase); }

export function step(s, tilt) {
  if (s.over) return s;
  s.events.length = 0;
  const want = Math.max(0, Math.min(MAX_TILT, +tilt || 0));
  const d = want - s.angle, maxd = (d < 0 ? SETDOWN : TURN) * DT;
  s.angle += Math.max(-maxd, Math.min(maxd, d));
  s.t += DT;
  s.glass.x = glassX(s);
  const h = DT / SUB, P = s.p;
  for (let sub = 0; sub < SUB; sub++) {
    for (const q of P) {
      if (q.st === 2) continue;
      const vx = (q.x - q.px) * (q.st === 1 ? AIR : DAMP), vy = (q.y - q.py) * DAMP;
      q.px = q.x; q.py = q.y;
      q.x += vx + (jig(s) - 0.5) * 0.06; q.y += vy + G * h * h; // a little jiggle keeps the pile liquid
    }
    relax(s);
    walls(s);
  }
  count(s);
  judge(s);
  return s;
}

// Keep the snapshot grid and ascending particle order, without per-step bucket allocation.
// Grid cells cover x [-46.4, 139.2), y [-69.6, 208.8); unusual states use the unbounded grid.
const GRID_W = 64, GRID_H = 96, GRID_X = 16, GRID_Y = 24;
const gridHeads = new Int16Array(GRID_W * GRID_H).fill(-1);
const gridNext = new Int16Array(128), gridTouched = new Uint16Array(128);
let gridUsed = 0;
function relax(s) {
  const P = s.p, cell = 2 * R, D = 2 * R, D2 = D * D;
  if (P.length > gridNext.length) return relaxUnbounded(s);
  for (const q of P) {
    if (q.st === 2) continue;
    const cx = Math.floor(q.x / cell) + GRID_X, cy = Math.floor(q.y / cell) + GRID_Y;
    // Include one cell of padding for every neighbor query after pair correction.
    if (!(cx >= 2 && cx < GRID_W - 2 && cy >= 2 && cy < GRID_H - 2)) return relaxUnbounded(s);
  }
  for (let i = 0; i < gridUsed; i++) gridHeads[gridTouched[i]] = -1;
  gridUsed = 0;
  // Prepend in reverse order so each bucket visits j in the original ascending order.
  for (let i = P.length - 1; i >= 0; i--) {
    const q = P[i]; if (q.st === 2) continue;
    const key = (Math.floor(q.x / cell) + GRID_X) * GRID_H + Math.floor(q.y / cell) + GRID_Y;
    if (gridHeads[key] === -1) gridTouched[gridUsed++] = key;
    gridNext[i] = gridHeads[key]; gridHeads[key] = i;
  }
  for (let i = 0; i < P.length; i++) {
    const q = P[i]; if (q.st === 2) continue;
    const cx = Math.floor(q.x / cell) + GRID_X, cy = Math.floor(q.y / cell) + GRID_Y;
    const edge = cx < 1 || cx >= GRID_W - 1 || cy < 1 || cy >= GRID_H - 1;
    for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
      if (edge && (cx + ox < 0 || cx + ox >= GRID_W || cy + oy < 0 || cy + oy >= GRID_H)) continue;
      let j = gridHeads[(cx + ox) * GRID_H + cy + oy];
      for (; j !== -1; j = gridNext[j]) {
        if (j <= i) continue;
        const o = P[j], dx = o.x - q.x, dy = o.y - q.y, d2 = dx * dx + dy * dy;
        if (d2 >= D2 || d2 < 1e-9) continue;
        const d = Math.sqrt(d2), push = (D - d) * 0.5 * 0.5 / d;
        q.x -= dx * push; q.y -= dy * push; o.x += dx * push; o.y += dy * push;
      }
    }
  }
}

// push overlapping drops apart, using a spatial grid
function relaxUnbounded(s) {
  const P = s.p, cell = 2 * R, grid = new Map(), D = 2 * R, D2 = D * D;
  for (let i = 0; i < P.length; i++) {
    const q = P[i]; if (q.st === 2) continue;
    const key = Math.floor(q.x / cell) * 1000 + Math.floor(q.y / cell);
    let b = grid.get(key); if (!b) grid.set(key, b = []); b.push(i);
  }
  for (let i = 0; i < P.length; i++) {
    const q = P[i]; if (q.st === 2) continue;
    const cx = Math.floor(q.x / cell), cy = Math.floor(q.y / cell);
    for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
      const b = grid.get((cx + ox) * 1000 + cy + oy); if (!b) continue;
      for (const j of b) {
        if (j <= i) continue;
        const o = P[j], dx = o.x - q.x, dy = o.y - q.y, d2 = dx * dx + dy * dy;
        if (d2 >= D2 || d2 < 1e-9) continue;
        const d = Math.sqrt(d2), push = (D - d) * 0.5 * 0.5 / d;
        q.x -= dx * push; q.y -= dy * push; o.x += dx * push; o.y += dy * push;
      }
    }
  }
}

function walls(s) {
  const g = s.glass, gl = g.x - g.w, gr = g.x + g.w, T = 1.2; // glass wall thickness
  for (const q of s.p) {
    if (q.st === 2) continue;
    if (q.st === 0) {
      const l = toLocal(s, q.x, q.y);
      if (l.y < -R * 0.5 || (l.x > JW - R * 0.6 && l.y < R)) { q.st = 1; s.events.push('out'); }
      else {
        let x = l.x, y = l.y;
        if (x < -JW + R) x = -JW + R;
        if (x > JW - R && y > R) x = JW - R; // the spout: near the lip a drop may roll over the edge
        if (y > JD - R) y = JD - R;
        if (x !== l.x || y !== l.y) { const w = toWorld(s, x, y); q.x = w.x; q.y = w.y; }
        continue;
      }
    }
    // the jug from outside: drops that fall back onto it slide off (treat the jug body as a solid box)
    {
      const l = toLocal(s, q.x, q.y);
      if (l.y > 0 && l.y < JD + T && l.x > -JW - T && l.x < JW + T) {
        {
          const dl = l.x + JW + T, dr = JW + T - l.x, db = JD + T - l.y;
          const m = Math.min(dl, dr, db);
          let x = l.x, y = l.y;
          if (m === dl) x = -JW - T - R * 0.2; else if (m === dr) x = JW + T + R * 0.2; else y = JD + T + R * 0.2;
          const w = toWorld(s, x, y); q.x = w.x; q.y = w.y;
        }
      }
    }
    // the glass: two walls and a floor. Inside stays inside; outside stays outside; the rim tops are solid points.
    if (q.y > g.top - R) {
      const wasIn = q.px > gl && q.px < gr && q.py > g.top - R * 2;
      if (wasIn && q.y > g.top) {
        if (q.x < gl + R) q.x = gl + R;
        if (q.x > gr - R) q.x = gr - R;
        if (q.y > g.bottom - R && !s.mutate) q.y = g.bottom - R; // mutation: the glass has no floor
      } else if (!wasIn && q.y > g.top) {
        if (q.x > gl - T - R && q.x < gl + R && q.px <= gl) q.x = gl - T - R;
        else if (q.x < gr + T + R && q.x > gr - R && q.px >= gr) q.x = gr + T + R;
      }
      for (const rx of [gl - T / 2, gr + T / 2]) { // rim tops
        const dx = q.x - rx, dy = q.y - g.top, d2 = dx * dx + dy * dy, m = R + T / 2;
        if (d2 < m * m && d2 > 1e-9) { const d = Math.sqrt(d2); q.x = rx + dx / d * m; q.y = g.top + dy / d * m; }
      }
    }
    if (q.y > FLOOR - R || q.x < -6 || q.x > 106) { q.st = 2; q.y = Math.min(q.y, FLOOR - R); s.events.push('spill'); }
  }
}

function count(s) {
  const g = s.glass;
  let inG = 0, inJ = 0, sp = 0, fly = 0, speed = 0;
  for (const q of s.p) {
    if (q.st === 2) { sp++; continue; }
    if (q.st === 0) { inJ++; continue; }
    if (q.x > g.x - g.w && q.x < g.x + g.w && q.y > g.top) { inG++; speed += Math.abs(q.y - q.py); }
    else fly++;
  }
  if (inG > s.inGlass && s.inGlass < s.L.target - s.L.band && inG >= s.L.target - s.L.band) s.events.push('line');
  if (inG > s.inGlass) s.events.push('drip');
  s.inGlass = inG; s.inJug = inJ; s.spilled = sp; s.flying = fly;
  if (inJ < s.L.drops) s.poured = true;
}

export function band(s) { return [s.L.target - s.L.band, s.L.target + s.L.band]; }
// Where the glass's liquid surface for `n` drops sits, in world y (for drawing the line): area per drop ~ (2R)^2 * 0.86
export function levelY(s, n) { return s.glass.bottom - n * (2 * R) * (2 * R) * 0.86 / (2 * s.glass.w); }

function judge(s) {
  const [lo, hi] = band(s);
  const pouring = s.angle > 0.9 && s.inJug > 0;
  s.calm = (s.flying === 0 && !pouring) ? s.calm + DT : 0;
  if (s.spilled > s.L.spill) return end(s, false, 'spill');
  if (s.inGlass > hi && s.calm > 0.4) return end(s, false, 'over');
  if (s.poured && s.calm > 0.8 && (s.inGlass >= lo || s.inJug === 0)) {
    if (s.inGlass > hi) return end(s, false, 'over');
    if (s.inGlass < lo) return end(s, false, 'under');
    return end(s, true, 'ok');
  }
  if (s.t > s.L.time) {
    if (s.inGlass >= lo && s.inGlass <= hi) return end(s, true, 'ok');
    return end(s, false, s.inGlass > hi ? 'over' : 'under');
  }
}
function end(s, won, why) {
  s.over = true; s.won = won; s.why = why;
  if (won) {
    const off = Math.abs(s.inGlass - s.L.target);
    s.stars = 1 + (off <= Math.ceil(s.L.band / 2) ? 1 : 0) + (off <= 1 && s.spilled <= 2 ? 1 : 0);
  }
  s.events.push(won ? 'win' : 'lose');
  return s;
}

// A digest of the state, for determinism checks.
export function digest(s) {
  let h = 2166136261;
  for (const q of s.p) for (const v of [q.x, q.y]) { h ^= Math.round(v * 1000); h = Math.imul(h, 16777619); }
  return [s.inGlass, s.spilled, s.inJug, s.over, s.won, s.stars, h >>> 0].join(':');
}
