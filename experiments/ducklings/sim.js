// Follow Me: pure, seeded simulation. No DOM; runs in Node for the bots.
// One tick is 1/60 s. The only input per tick is a target point in world units, or null.
// World: x runs across the pond (0 to 1, the water is 0.04 to 0.96), y runs up the pond from the start.
// The core rule: duckling n stands where the mother stood D_n seconds ago, where D_n is the sum of the
// gaps of the ducklings ahead of it (about 0.42 s each). So every duckling crosses each point she crossed,
// in order, later. A hazard that has moved into her old path catches the line, not her.

export const DT = 1 / 60;
export const SPEED = 0.28; // mother top speed, pond widths per second
export const GAP = 0.42; // seconds between ducklings on the trail
export const R_MOM = 0.034; // collision radii
export const R_DUCK = 0.022;
export const TOUCH = 0.075; // the mother takes a waiting duckling within this distance
export const NEST_R = 0.17;
export const X_MIN = 0.07, X_MAX = 0.93;
export const HEARTS = 3;
export const LINE_MAX = 10;
export const QUACK_TIME = 1.4, QUACK_COOL = 6, QUACK_SQUEEZE = 0.35;
export const WARN_MIN = 0.7; // every hazard shows itself at least this long before it can hit
const HIST = 900; // path ticks kept: 15 s
const CATCH_UP = 0.9; // a duckling behind its place runs at 1.9 times the trail's own speed

export const NAMES = ['Pip', 'Dot', 'Bean', 'Sunny', 'Nib', 'Puff', 'Wren', 'Fig', 'Moss', 'Tuft', 'Bun', 'Pebble', 'Clover', 'Button', 'Pudding', 'Sprout'];
// A look and a small habit. Only sleepy and eager change the rule's numbers, and only their own gap.
export const TRAITS = {
  eager: { gap: 0.85, word: 'the eager one' },
  sleepy: { gap: 1.18, word: 'the sleepy one' },
  brave: { gap: 1, word: 'the brave one' },
  curious: { gap: 1, word: 'the curious one' },
  tiny: { gap: 1, word: 'the tiny one' },
  loud: { gap: 1, word: 'the loud one' },
};
const TRAIT_ORDER = ['eager', 'sleepy', 'brave', 'curious', 'tiny', 'loud'];

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const mod = (a, n) => ((a % n) + n) % n;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Stages. rows are built bottom to top; each new hazard arrives alone in the stage that introduces it.
// start: ducklings already following; lost: ducklings waiting along the way; par: arrivals for 1, 2 and 3 stars.
export const STAGES = [
  null,
  { rows: ['bend', 'log1', 'bend'], start: 1, lost: 1, time: 60, par: [1, 2, 2] },
  { rows: ['log', 'reeds', 'log', 'bend', 'log2', 'reeds'], start: 2, lost: 4, time: 75, par: [2, 4, 6] },
  { rows: ['log', 'pike', 'log2', 'reeds', 'pike', 'log', 'pike'], start: 2, lost: 5, time: 80, par: [3, 5, 7] },
  { rows: ['pike', 'turtle', 'log2', 'turtle', 'pike', 'turtle', 'log'], start: 2, lost: 5, time: 85, par: [3, 5, 7] },
  { rows: ['log', 'bike', 'turtle', 'bike', 'pike', 'bike', 'log2'], start: 3, lost: 5, time: 85, par: [3, 6, 7] },
  { rows: ['gust', 'bike', 'pike', 'gust', 'log2', 'gust', 'turtle'], start: 3, lost: 5, time: 85, par: [3, 6, 7] },
  { rows: ['heron', 'log2', 'heron', 'turtle', 'pike', 'heron', 'bike'], start: 3, lost: 6, time: 95, par: [3, 6, 8] },
  { rows: ['log2', 'pike', 'bike', 'gust', 'heron', 'turtle', 'log2', 'pike', 'heron'], start: 3, lost: 6, time: 110, par: [3, 6, 8] },
];
export const LAST_STAGE = STAGES.length - 1;
// endless: each lily-pad checkpoint adds time, more for a longer line, so losing ducklings shortens the run
export const CHECK_TIME = 2, CHECK_PER = 3, CHECK_CAP = 6;
export const checkGain = n => CHECK_TIME + CHECK_PER * Math.min(n, CHECK_CAP);
export const ENDLESS_AFTER = 3; // endless opens when stage 3 is done
export const stageSeed = n => 7919 * n + 13;

// ---------------------------------------------------------------- hazards
// Every hazard is a closed-form function of time, so the page, the sim and the bots agree on where it is,
// and a bot can look ahead without copying the world.

// A log lane: logs drift across at height y. Log k enters at t = phase + k P with its front at the bank.
function logsAt(h, t) {
  const out = [], travel = (1 + 2 * h.half + 0.1) / h.speed;
  const k1 = Math.floor((t - h.phase) / h.P), k0 = Math.floor((t - h.phase - travel) / h.P);
  for (let k = Math.max(k0, -50); k <= k1 + 1; k++) {
    const tk = h.phase + k * h.P, age = t - tk;
    if (age < -h.warn || age > travel) continue;
    const start = h.dir > 0 ? -h.half : 1 + h.half;
    out.push({ x: start + h.dir * h.speed * age, warn: age < 0, k, age });
  }
  return out;
}
function bikesAt(h, t) {
  const out = [];
  for (const b of h.riders) {
    const c = mod(t + b.phase, b.P), ride = c - b.warn;
    const start = b.dir > 0 ? -0.12 : 1.12;
    if (c < b.warn) out.push({ x: start, dir: b.dir, warn: true, c });
    else { const x = start + b.dir * b.speed * ride; if (x > -0.2 && x < 1.2) out.push({ x, dir: b.dir, warn: false, c }); }
  }
  return out;
}
// Turtle and heron and gust share a cycle: rest, warn, act.
function cycle(h, t) {
  const c = mod(t + h.phase, h.P);
  if (c < h.rest) return { phase: 'rest', c, f: c / h.rest };
  if (c < h.rest + h.warn) return { phase: 'warn', c, f: (c - h.rest) / h.warn };
  if (c < h.rest + h.warn + h.act) return { phase: 'act', c, f: (c - h.rest - h.warn) / h.act };
  return { phase: 'rest', c, f: 1 };
}
export function pikeAt(h, t) {
  const a = h.phase + h.w * t, back = -Math.sign(h.w) * 0.32;
  return { a, hx: h.cx + h.R * Math.cos(a), hy: h.cy + h.R * Math.sin(a), tx: h.cx + h.R * Math.cos(a + back), ty: h.cy + h.R * Math.sin(a + back), mx: h.cx + h.R * Math.cos(a + back / 2), my: h.cy + h.R * Math.sin(a + back / 2) };
}
export function heronAngle(h, cyc) {
  const e = cyc.f < 0.5 ? 2 * cyc.f * cyc.f : 1 - 2 * (1 - cyc.f) * (1 - cyc.f);
  return cyc.phase === 'act' ? h.a0 + (h.a1 - h.a0) * e : cyc.phase === 'warn' ? h.a0 : h.a0;
}
// What the page draws: positions and phases at time t.
export function view(h, t) {
  if (h.kind === 'log') return { logs: logsAt(h, t) };
  if (h.kind === 'bike') return { bikes: bikesAt(h, t) };
  if (h.kind === 'pike') return pikeAt(h, t);
  if (h.kind === 'turtle' || h.kind === 'gust') return cycle(h, t);
  if (h.kind === 'heron') { const c = cycle(h, t); return { ...c, angle: heronAngle(h, c) }; }
  return {};
}

// Does a body of radius r at (x, y) get hit at time t? Returns the hazard kind or null.
export function hits(h, t, x, y, r) {
  if (y < h.y0 - 0.2 || y > h.y1 + 0.2) return null;
  if (h.kind === 'log') {
    const dy = Math.abs(y - h.y); if (dy > h.r + r) return null;
    for (const l of logsAt(h, t)) { if (l.warn) continue; const dx = Math.max(0, Math.abs(x - l.x) - h.half); if (dx * dx + dy * dy < (h.r + r) ** 2) return 'log'; }
    return null;
  }
  if (h.kind === 'pike') {
    const p = pikeAt(h, t);
    if ((x - p.hx) ** 2 + (y - p.hy) ** 2 < (0.045 + r) ** 2) return 'pike';
    if ((x - p.mx) ** 2 + (y - p.my) ** 2 < (0.04 + r) ** 2) return 'pike';
    if ((x - p.tx) ** 2 + (y - p.ty) ** 2 < (0.03 + r) ** 2) return 'pike';
    return null;
  }
  if (h.kind === 'turtle') {
    if (cycle(h, t).phase !== 'act') return null;
    return (x - h.x) ** 2 + (y - h.y) ** 2 < (h.r + r) ** 2 ? 'turtle' : null;
  }
  if (h.kind === 'bike') {
    const dy = Math.abs(y - h.y); if (dy > 0.045 + r) return null;
    for (const b of bikesAt(h, t)) { if (b.warn) continue; const dx = Math.max(0, Math.abs(x - b.x) - 0.04); if (dx * dx + dy * dy < (0.045 + r) ** 2) return 'bike'; }
    return null;
  }
  if (h.kind === 'heron') {
    const c = cycle(h, t); if (c.phase !== 'act') return null;
    const dx = x - h.px, dy = y - h.py, d = Math.hypot(dx, dy); if (d > h.L + r || d < 0.02) return null;
    const a = Math.atan2(dy, dx * h.side) , diff = Math.abs(a - heronAngle(h, c));
    return diff < h.half + r / d ? 'heron' : null;
  }
  return null;
}
// The gust's push on the mother at (x, y), in pond widths per second.
export function push(s, t, x, y) {
  let px = 0;
  for (const h of s.gusts) if (y > h.y0 && y < h.y1) { const c = cycle(h, t); if (c.phase === 'act') px += h.dir * h.force * Math.sin(Math.PI * c.f); }
  return px;
}
export function slowAt(s, x, y) {
  for (const r of s.reeds) if ((x - r.x) ** 2 + (y - r.y) ** 2 < r.r * r.r) return 0.45;
  return 1;
}
export function hitAny(s, t, x, y, r) {
  for (const h of s.hazards) { const k = hits(h, t, x, y, r); if (k) return k; }
  return null;
}

// ---------------------------------------------------------------- stage building
// Each row returns its hazards, rocks and reeds and how tall it is. `n` is the longest line the row must let
// through: crossing windows are sized from it, because duckling n crosses n gaps after the mother does.
function row(kind, g, y0, d, n, s) {
  const H = [], need = n * GAP; // seconds the whole line needs to pass one point
  const add = h => { H.push(h); s.hazards.push(h); return h; };
  const ease = Math.max(0, 1 - d * 0.12); // later rows leave less spare time
  if (kind === 'bend') { // two rocks to swim round: the first curve the ducklings copy
    s.rocks.push({ x: 0.36 + g() * 0.06, y: y0 + 0.35, r: 0.1 }, { x: 0.66 + g() * 0.06, y: y0 + 0.85, r: 0.1 });
    return 1.25;
  }
  if (kind === 'log1' || kind === 'log' || kind === 'log2') {
    const lanes = kind === 'log2' ? 2 : 1, slow = kind === 'log1';
    for (let i = 0; i < lanes; i++) {
      const speed = slow ? 0.075 : 0.1 + 0.015 * d + g() * 0.02, half = slow ? 0.14 : 0.1 + g() * 0.06;
      const open = need + 0.6 + 0.9 * ease + (slow ? 2.5 : 0); // the free window at any one point
      const P = open + (2 * half + 2 * 0.04) / speed;
      add({ kind: 'log', y: y0 + 0.3 + i * 0.32, dir: i % 2 ? -1 : 1, speed, half, r: 0.04, P, phase: g() * P, warn: 1.0 });
    }
    return 0.35 + lanes * 0.32 + 0.25;
  }
  if (kind === 'reeds') {
    const gapX = 0.25 + g() * 0.5;
    for (let x = 0.12; x < 0.92; x += 0.13) if (Math.abs(x - gapX) > 0.14) s.reeds.push({ x, y: y0 + 0.35 + g() * 0.08, r: 0.1 });
    s.rocks.push({ x: gapX + (g() < 0.5 ? -0.25 : 0.25), y: y0 + 0.75, r: 0.07 });
    return 1.0;
  }
  if (kind === 'pike') {
    const R = 0.17 + g() * 0.05, w = (g() < 0.5 ? -1 : 1) * (0.75 + 0.08 * d + g() * 0.2);
    add({ kind: 'pike', cx: 0.3 + g() * 0.4, cy: y0 + 0.5, R, w, phase: g() * 6.3 });
    return 1.05;
  }
  if (kind === 'turtle') {
    // Rocks leave two ways through: a short one past the turtle, a long one through reeds.
    const left = g() < 0.5, tx = left ? 0.3 : 0.7, y = y0 + 0.45;
    s.rocks.push({ x: 0.5, y, r: 0.11 }, { x: left ? 0.08 : 0.92, y, r: 0.1 });
    s.rocks.push({ x: left ? 0.93 : 0.07, y: y + 0.02, r: 0.05 });
    s.reeds.push({ x: left ? 0.76 : 0.24, y, r: 0.12 });
    const act = 0.7, rest = need + 0.5 + 0.7 * ease;
    add({ kind: 'turtle', x: tx, y, r: 0.08, P: rest + 1.0 + act, rest, warn: 1.0, act, phase: g() * 5 });
    return 0.95;
  }
  if (kind === 'bike') {
    const y = y0 + 0.35, riders = [];
    const speed = 0.55 + 0.04 * d, cross = 1.25 / speed, band = 0.16 / SPEED; // a rider's crossing and the line's
    for (let i = 0; i < 2; i++) riders.push({ dir: i ? -1 : 1, speed, warn: 1.1, P: 0, phase: 0 });
    const P = 2 * (need + band + 0.6 + 0.8 * ease) + 2 * 0.25; // two riders take turns
    riders[0].P = riders[1].P = Math.max(P, 1.1 + cross + 0.2); riders[0].phase = g() * P; riders[1].phase = riders[0].phase + P / 2;
    add({ kind: 'bike', y, riders });
    return 0.75;
  }
  if (kind === 'gust') {
    const dir = g() < 0.5 ? -1 : 1, yl = y0 + 0.45;
    const rest = 1.6 + g();
    s.gusts.push(add({ kind: 'gust', y0: y0 + 0.1, y1: y0 + 0.95, dir, force: 0.3, rest, warn: 1.0, act: 1.6, P: rest + 2.6, phase: g() * 4 }));
    // a turtle on the side the wind blows to
    const tx = dir > 0 ? 0.74 : 0.26, wait = need + 0.5 + 0.7 * ease;
    add({ kind: 'turtle', x: tx, y: yl + 0.05, r: 0.08, P: wait + 1.7, rest: wait, warn: 1.0, act: 0.7, phase: g() * 4 });
    return 1.1;
  }
  if (kind === 'heron') {
    const side = g() < 0.5 ? 1 : -1, py = y0 + 0.55, L = 0.7;
    const act = 2.4, rest = need + 0.8 + 0.8 * ease;
    add({ kind: 'heron', px: side > 0 ? 0.0 : 1.0, py, side, L, half: 0.17, a0: -1.0, a1: 1.0, rest, warn: 1.0, act, P: rest + 1.0 + act, phase: g() * 6 });
    s.reeds.push({ x: side > 0 ? 0.86 : 0.14, y: py, r: 0.09 });
    return 1.25;
  }
  return 0.6;
}
// Bounds for culling and for keeping waiting ducklings out of harm's way.
function bounds(h) {
  if (h.kind === 'log' || h.kind === 'bike') { h.y0 = h.y - 0.06; h.y1 = h.y + 0.06; }
  else if (h.kind === 'pike') { h.y0 = h.cy - h.R - 0.06; h.y1 = h.cy + h.R + 0.06; }
  else if (h.kind === 'turtle') { h.y0 = h.y - h.r; h.y1 = h.y + h.r; }
  else if (h.kind === 'heron') { h.y0 = h.py - h.L; h.y1 = h.py + h.L; }
  else if (h.kind === 'gust') { /* y0, y1 given */ }
  return h;
}

// A spot that no hazard can ever reach and no rock covers.
function safeSpot(s, x, y) {
  for (let tries = 0; tries < 40; tries++) {
    let bad = false;
    for (const h of s.hazards) {
      if (h.kind === 'gust') continue;
      if (h.kind === 'log' || h.kind === 'bike') { if (Math.abs(y - h.y) < 0.1) { y = h.y - 0.12; bad = true; } }
      else if (h.kind === 'pike') { const d = Math.hypot(x - h.cx, y - h.cy); if (Math.abs(d - h.R) < 0.09) { y = h.cy - h.R - 0.11; bad = true; } }
      else if (h.kind === 'turtle') { if (Math.hypot(x - h.x, y - h.y) < h.r + 0.07) { y = h.y - h.r - 0.09; bad = true; } }
      else if (h.kind === 'heron') { if (Math.hypot(x - h.px, y - h.py) < h.L + 0.06) { x = h.side > 0 ? 0.84 : 0.16; bad = Math.hypot(x - h.px, y - h.py) < h.L + 0.06; if (bad) y = h.py - h.L - 0.07; } }
    }
    for (const r of s.rocks) { const d = Math.hypot(x - r.x, y - r.y); if (d < r.r + 0.05) { const k = (r.r + 0.06) / (d || 1); x = r.x + (x - r.x) * k; y = r.y + (y - r.y) * k + (d ? 0 : -r.r - 0.06); bad = true; } }
    x = clamp(x, 0.1, 0.9); y = Math.max(0.15, y);
    if (!bad) break;
  }
  return { x, y };
}

function duck(s) {
  const id = s.duckCount++;
  const pick = (id * 7 + (s.seed % 16)) % NAMES.length;
  const trait = TRAIT_ORDER[(id + (s.seed >> 3)) % TRAIT_ORDER.length];
  return { id, name: NAMES[pick] + (id >= NAMES.length ? ' ' + (Math.floor(id / NAMES.length) + 1) : ''), trait };
}

// Lay rows from y upward. For the endless pond, rows are made as she nears them, each from its own seed,
// so the pond is the same however fast she swims.
function layRow(s, kind, d, n, lostHere) {
  const g = rng(s.seed * 31 + s.rowCount * 977 + 5);
  const y0 = s.top, before = s.hazards.length;
  const height = row(kind, g, y0, d, n, s);
  for (let i = before; i < s.hazards.length; i++) bounds(s.hazards[i]);
  s.rowCount++; s.top = y0 + height;
  // the waiting ducklings sit in the pocket just above this row
  for (let i = 0; i < lostHere; i++) {
    const spot = safeSpot(s, 0.2 + 0.6 * g(), s.top + 0.1 + 0.08 * i);
    s.lost.push({ ...duck(s), x: spot.x, y: spot.y, flee: 0, fromX: spot.x, fromY: spot.y, born: true });
    s.top = Math.max(s.top, spot.y);
  }
  s.top += 0.15 + 0.08 * lostHere;
}

export function create({ stage = 1, endless = false, seed } = {}) {
  const spec = endless ? null : STAGES[clamp(stage, 1, LAST_STAGE)];
  seed = (seed ?? (endless ? 4242 : stageSeed(stage))) >>> 0;
  const s = {
    seed, stage: endless ? 0 : stage, endless, t: 0, tick: 0,
    mom: { x: 0.5, y: 0.35, vx: 0, vy: 0 }, hearts: HEARTS, stun: 0, safe: 0,
    hx: new Float32Array(HIST), hy: new Float32Array(HIST),
    line: [], lost: [], arrived: [], gone: [], duckCount: 0,
    hazards: [], rocks: [], reeds: [], gusts: [], rowCount: 0, top: 0.75,
    score: 0, joins: 0, scatters: 0, hits: 0, quackT: 0, quackCool: 0, quacks: 0,
    home: false, over: null, why: null, events: [], time: spec ? spec.time : 40, checkpoints: [], nextCheck: 0, total: 0,
    nest: null, best: 0.35,
  };
  // the trail before the start: a straight line below her, so the first ducklings stand in a row
  for (let i = 0; i < HIST; i++) { const back = (HIST - 1 - i) * DT; s.hx[i] = 0.5; s.hy[i] = 0.35 - back * 0.2; }
  s.tick = HIST - 1;
  const startCount = spec ? spec.start : 2;
  for (let i = 0; i < startCount; i++) { const d = duck(s); s.line.push({ ...d, delay: 0 }); }
  setDelays(s, true);
  if (spec) {
    const n = spec.start + spec.lost, rows = spec.rows, per = spreadLost(spec.lost, rows.length);
    rows.forEach((kind, i) => layRow(s, kind, Math.max(0, stage - 2), n, per[i]));
    s.nest = { x: 0.5, y: s.top + 0.35 };
    s.total = n;
  } else {
    s.total = startCount; s.nextCheck = 0;
    endlessAhead(s);
  }
  return s;
}
// Spread the waiting ducklings over the rows: stage 1 puts its one duckling right after the first row.
function spreadLost(lost, rows) {
  const per = Array(rows).fill(0);
  for (let i = 0; i < lost; i++) per[Math.min(rows - 1, Math.floor(i * rows / lost))]++;
  return per;
}
const ENDLESS_POOL = [['log', 'pike', 'log2', 'reeds'], ['turtle', 'bike', 'log2', 'pike'], ['gust', 'heron', 'bike', 'turtle', 'log2', 'pike']];
export function endlessAhead(s) {
  while (s.top < s.mom.y + 3.5) {
    const d = Math.min(8, Math.floor(s.rowCount / 3));
    const g = rng(s.seed + s.rowCount * 131);
    const pool = ENDLESS_POOL[Math.min(2, Math.floor(s.rowCount / 4))].concat(s.rowCount >= 8 ? ENDLESS_POOL[2] : []);
    const kind = s.rowCount === 0 ? 'log' : pool[Math.floor(g() * pool.length)];
    const room = LINE_MAX - s.line.length - s.lost.length;
    const lostHere = room > 0 ? (g() < 0.75 ? 1 : 0) + (g() < 0.25 && room > 1 ? 1 : 0) : 0;
    layRow(s, kind, d, Math.min(LINE_MAX, 4 + d), lostHere);
    s.total += lostHere;
    if (s.rowCount % 2 === 0) { s.checkpoints.push({ y: s.top, got: false }); s.top += 0.25; }
  }
}

// ---------------------------------------------------------------- the trail
// Where the mother was `delay` seconds ago.
export function pathAt(s, delay) {
  const k = clamp(delay / DT, 0, HIST - 2), i = s.tick - k, i0 = Math.floor(i), f = i - i0;
  const a = mod(i0, HIST), b = mod(i0 + 1, HIST);
  return { x: s.hx[a] + (s.hx[b] - s.hx[a]) * f, y: s.hy[a] + (s.hy[b] - s.hy[a]) * f };
}
// Each duckling's place on the trail: its gap added to the gaps of those ahead.
export function targetDelays(s, squeeze = s.quackT > 0) {
  const out = []; let d = 0;
  for (const f of s.line) { d += GAP * TRAITS[f.trait].gap * (squeeze ? QUACK_SQUEEZE : 1); out.push(d); }
  return out;
}
// A duckling short of its place stands still (its delay grows with time); one past it hurries along the trail.
export function stepDelay(delay, target, dt) {
  if (delay < target) return Math.min(target, delay + dt);
  return Math.max(target, delay - CATCH_UP * dt);
}
function setDelays(s, snap) {
  const D = targetDelays(s);
  s.line.forEach((f, i) => { f.delay = snap ? D[i] : stepDelay(f.delay, D[i], DT); });
}
export function followerPos(s, f) { return pathAt(s, f.delay); }

// One step of the mother toward a target. Used by the sim and by the bots' look-ahead, so both agree.
export function moveMom(s, m, target, t, dt, stunned = false) {
  let dvx = 0, dvy = 0;
  if (target && !stunned) {
    const dx = target.x - m.x, dy = target.y - m.y, d = Math.hypot(dx, dy);
    const v = Math.min(SPEED * slowAt(s, m.x, m.y), d * 4.2);
    if (d > 0.004) { dvx = dx / d * v; dvy = dy / d * v; }
  }
  const k = Math.min(1, (stunned ? 6 : 9) * dt);
  m.vx += (dvx - m.vx) * k; m.vy += (dvy - m.vy) * k;
  m.x += (m.vx + push(s, t, m.x, m.y)) * dt; m.y += m.vy * dt;
  for (const r of s.rocks) { const dx = m.x - r.x, dy = m.y - r.y, d = Math.hypot(dx, dy), min = r.r + R_MOM; if (d < min && d > 1e-6) { m.x = r.x + dx / d * min; m.y = r.y + dy / d * min; } }
  m.x = clamp(m.x, X_MIN, X_MAX); m.y = Math.max(0.1, m.y);
  if (s.nest) m.y = Math.min(m.y, s.nest.y + 0.05);
}

// ---------------------------------------------------------------- one tick
export function step(s, target, quack = false) {
  s.events = [];
  if (s.over) return s;
  const t = s.t + DT;
  // warnings: a hazard entering its warning shows and sounds once
  for (const h of s.hazards) {
    if (h.y0 > s.mom.y + 1.4 || h.y1 < s.mom.y - 1.6) continue;
    if (h.kind === 'turtle' || h.kind === 'heron' || h.kind === 'gust') { if (cycle(h, t).phase === 'warn' && cycle(h, s.t).phase !== 'warn') s.events.push({ type: 'warn', kind: h.kind, x: h.x ?? h.px ?? 0.5, y: h.y ?? h.py ?? h.y0 }); }
    if (h.kind === 'bike') for (const b of h.riders) if (mod(t + b.phase, b.P) < mod(s.t + b.phase, b.P)) s.events.push({ type: 'warn', kind: 'bike', x: b.dir > 0 ? 0 : 1, y: h.y });
  }
  s.t = t;
  // quack: the ducklings sprint along the trail to close up, for a moment
  s.quackCool = Math.max(0, s.quackCool - DT); s.quackT = Math.max(0, s.quackT - DT);
  if (quack && s.quackCool <= 0 && !s.home && s.line.length) { s.quackT = QUACK_TIME; s.quackCool = QUACK_COOL; s.quacks++; s.events.push({ type: 'quack' }); }
  // the mother
  s.stun = Math.max(0, s.stun - DT); s.safe = Math.max(0, s.safe - DT);
  const goal = s.home ? s.nest : target;
  moveMom(s, s.mom, goal, t, DT, s.stun > 0);
  s.tick++; const w = mod(s.tick, HIST); s.hx[w] = s.mom.x; s.hy[w] = s.mom.y;
  if (s.endless) endlessAhead(s);
  // the line follows the trail
  setDelays(s, false);
  const m = s.mom;
  if (!s.home && s.safe <= 0) {
    const k = hitAny(s, t, m.x, m.y, R_MOM);
    if (k) {
      s.hearts--; s.hits++; s.stun = 0.6; s.safe = 2.0; s.events.push({ type: 'hit', by: k, x: m.x, y: m.y });
      if (s.hearts <= 0) { end(s, 'lost-all', 'hearts'); return s; }
    }
  }
  for (let i = 0; i < s.line.length; i++) {
    const f = s.line[i], p = followerPos(s, f);
    if (s.home && s.nest && Math.hypot(p.x - s.nest.x, p.y - s.nest.y) < NEST_R) {
      s.line.splice(i--, 1); s.arrived.push(f);
      s.score += 50 * s.arrived.length; s.events.push({ type: 'arrive', id: f.id, k: s.arrived.length, x: p.x, y: p.y });
      continue;
    }
    const k = hitAny(s, t, p.x, p.y, R_DUCK);
    if (k) {
      s.line.splice(i--, 1); s.scatters++;
      // A second scare and it hides in the reeds for good.
      if (f.scared) { s.gone.push(f); s.events.push({ type: 'gone', id: f.id, by: k, x: p.x, y: p.y }); continue; }
      // The first time, it flees a short way back along the trail and waits there to be fetched.
      const back = pathAt(s, f.delay + 1.1), side = f.id % 2 ? 1 : -1;
      const spot = safeSpot(s, back.x + side * 0.08, back.y - 0.04);
      s.lost.push({ id: f.id, name: f.name, trait: f.trait, x: spot.x, y: spot.y, flee: 0.8, fromX: p.x, fromY: p.y, by: k, scared: true });
      s.events.push({ type: 'scatter', id: f.id, by: k, x: p.x, y: p.y, tx: spot.x, ty: spot.y });
    }
  }
  // waiting ducklings: the mother takes them when she touches them
  for (let i = 0; i < s.lost.length; i++) {
    const l = s.lost[i]; l.flee = Math.max(0, l.flee - DT);
    if (l.flee > 0 || s.home || s.line.length >= LINE_MAX) continue;
    if (Math.hypot(l.x - m.x, l.y - m.y) < TOUCH) {
      s.lost.splice(i--, 1);
      s.line.push({ id: l.id, name: l.name, trait: l.trait, delay: 0, scared: !!l.scared });
      s.joins++; s.score += 10 * s.line.length;
      s.events.push({ type: 'join', id: l.id, n: s.line.length, x: l.x, y: l.y, again: !l.born });
    }
  }
  // endless: lily-pad checkpoints give time and score the line
  if (s.endless) {
    s.best = Math.max(s.best, m.y);
    for (const c of s.checkpoints) if (!c.got && m.y > c.y) { c.got = true; const n = s.line.length, add = checkGain(n); s.time += add; s.score += 20 * n * (n + 1) / 2 + 10; s.events.push({ type: 'check', n, add }); }
  }
  // home
  if (s.nest && !s.home && Math.hypot(m.x - s.nest.x, m.y - s.nest.y) < NEST_R - 0.02) { s.home = true; s.events.push({ type: 'home' }); }
  if (s.home && s.line.length === 0) { s.score += Math.floor(Math.max(0, s.time - s.t)) * 2 + 25 * s.hearts; end(s, 'nest', 'home'); return s; }
  if (!s.home && s.t >= s.time) end(s, 'lost-all', 'dusk');
  return s;
}
function end(s, outcome, why) {
  s.over = outcome; s.why = why;
  // ducklings still in line when the run ends count as lost, as do those still waiting
  s.events.push({ type: 'end', outcome, why });
}

export function stars(s) {
  if (s.endless || s.over !== 'nest') return 0;
  const par = STAGES[s.stage].par, n = s.arrived.length;
  return n >= par[2] ? 3 : n >= par[1] ? 2 : n >= par[0] ? 1 : 0;
}
export function timeLeft(s) { return Math.max(0, s.time - s.t); }
export function progress(s) { return s.nest ? clamp((s.mom.y - 0.35) / (s.nest.y - 0.35), 0, 1) : 0; }
