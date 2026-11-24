// Lantern: Spark. The spark layer over Lantern's unchanged rules (../../lantern/sim.js). Pure: no DOM, no Date.now, no Math.random.
// The lantern has gone out. The river is black. A spark sends a ring of light out from the boat; every rock, bank and pickup the
// ring passes keeps an afterglow for GLOW seconds. Between sparks the player steers by memory, by stars reflected in the water
// (a rock blots out the stars under it), by fireflies that hover over safe water, by the sound of water on rocks, and by thunder.
//
// The writes into Lantern's state: `s.calm` is scaled once at start by config().flow for the early-night pace; `s.light` is held at 1 before every step, so Lantern's own flame never runs out
// (the run cannot end 'dark'); and on the short early nights `s.over` is set to 'dawn' when the boat has come the night's
// share of the river (config().length). Everything else is Lantern's own step. The layer never draws from Lantern's random streams
// (s.r, s.q), so a seed gives the same river here as in Lantern.
import { create, step, centre, half, boat, progress, GOAL, DT } from '../sim.js?v=15';
export { centre, half, boat, progress, GOAL, DT };

export const NIGHTS = 6;
// Echo night n plays Lantern's story night STAGE[n]: one new river thing a night, the ones that can be read in the dark.
// Lantern's nights 1 to 6: rocks, ice, restless rocks, bobbing rocks, the waterfall, logs. Later Lantern nights add things
// that are about the flame (fog, rain, lightning) or that cannot be read in the dark (wind, hidden rocks, whirlpools that pull),
// so Echo stops at six and gives itself its own ramp below.
export const STAGE = [0, 1, 2, 3, 4, 5, 6];
export const TIN = 8;          // sparks at the start of a night
export const REFILL = 1;        // sparks an ember gives
export const TIN_MAX = 20;
export const GLOW = 2.2;         // seconds an afterglow takes to fade
export const RING_SPEED = 1.6;  // river units a second
export const RING_MAX = 2.3;    // the ring fades out at this radius (the screen shows about 1.6 units ahead)
export const NEAR = 0.22;       // an ember this close glows faintly on its own: the boat feels its warmth
const STAR = 0.07;              // star cell size in river units; one star a cell, jittered
const BANK = 0.05;              // bank sample spacing

// The ramp: Lantern's river gets busier; early flow is slower, fireflies thin out, stars thin out
// (more empty cells, so a hole is less surely a rock), thunder comes less often, and the spare hearts go.
export function config(n) {
  n = Math.max(1, Math.min(NIGHTS, Math.floor(n) || 1));
  const k = (n - 1) / (NIGHTS - 1);
  return {
    n, stage: STAGE[n],
    hearts: n <= 5 ? 2 : 1,   // Lantern's 'hearts' stat: spare lives (3 lives on nights 1–5, then 2)
    length: [0, 0.5, 0.55, 0.6, 0.65, 0.75, 0.9][n], // share of Lantern's river before dawn: the first nights are short
    flow: 0.75 + 0.25 * k,                  // scale calm once at start; keep the first night long without entering its moving-rock section
    calm: 3,                               // Lantern's base calm stat: 12% slower, before the flow multiplier
    fly: 0.55 + 0.2 * k,                   // river units between firefly rows
    empty: 0.5 + 0.1 * k,                 // share of star cells with no star
    thunder: 12 + 16 * k,                  // mean seconds between thunderclaps
  };
}

// The layer's own random stream (the same generator as Lantern's, on another seed), for thunder only.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// A fixed hash of a cell, for stars: the same sky for a seed whatever the player does.
function hash(i, j, seed) {
  let h = Math.imul(i, 0x27d4eb2d) ^ Math.imul(j, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Test hook for bots.mjs --mutate only; the page never calls it.
let mutant = '';
export function mutate(name) { mutant = name || ''; }

// A night opens with one free spark, so the first thing the player sees is what a spark does.
export function start(seed, n = 1) {
  const cf = config(n);
  const s = create(seed, cf.stage, false, [], { hearts: cf.hearts, calm: cf.calm });
  s.calm *= cf.flow;
  const r = rng(seed ^ 0x51ab7e);
  const e = { seed, n: cf.n, cf, s, r, tin: TIN, used: 0, rings: [{ x: s.x, y: s.y, t: 0, r: 0 }], lit: new Map(), banks: new Map(), flies: [], nextFly: Math.ceil((s.y + 0.6) / cf.fly), nextThunder: 6 + r() * 6, flash: -9, hits: 0, refills: 0, events: [] };
  placeFlies(e);
  return e;
}

// One tick. `target` is Lantern's steering input (0 to 1); `spark` true strikes a spark this tick.
export function tick(e, target, spark = false) {
  const s = e.s;
  e.events = [];
  if (s.over) return e;
  if (spark) {
    if (e.tin > 0) { e.tin--; e.used++; e.rings.push({ x: s.x, y: s.y, t: s.t, r: 0 }); e.events.push('spark'); }
    else e.events.push('empty');
  }
  s.light = 1; // its flame is held; river progress is this game's clock
  step(s, target);
  if (!s.over && progress(s) >= e.cf.length - 1e-9) { s.over = 'dawn'; s.events.push('dawn'); } // a short night ends early
  for (const ev of s.events) {
    if (ev === 'ember') { const before = e.tin; e.tin = Math.min(TIN_MAX, e.tin + REFILL); e.refills += e.tin - before; }
    if (ev === 'wisp') e.tin = Math.max(0, e.tin - 1);
    if (ev === 'hurt' || ev === 'hit') e.hits++;
    e.events.push(ev);
  }
  // Rings grow; whatever a ring's edge passes this tick is lit now.
  for (const g of e.rings) {
    const r0 = g.r; g.r = (s.t - g.t) * RING_SPEED;
    const within = (x, y, pad = 0) => { const d = Math.hypot(x - g.x, y - g.y) - pad; return d <= g.r && d > r0 - 0.02 && (mutant !== 'ring-behind' || y < g.y); };
    for (const k of s.rocks) if (within(k.x, k.y, k.rad + k.len)) e.lit.set(k, s.t);
    for (const p of s.embers) if (!p.got && within(p.x, p.y)) e.lit.set(p, s.t);
    for (let i = Math.floor((g.y - g.r) / BANK); i <= Math.ceil((g.y + g.r) / BANK); i++) {
      const y = i * BANK, c = centre(s, y), h = half(s, y);
      for (const side of [-1, 1]) if (within(c + side * h, y)) e.banks.set(i * 2 + (side > 0 ? 1 : 0), s.t);
    }
  }
  e.rings = e.rings.filter(g => g.r < RING_MAX);
  // Thunder: the whole river in view lights for a blink and keeps its afterglow.
  if (s.t >= e.nextThunder) {
    e.flash = s.t; e.events.push('thunder');
    e.nextThunder = s.t + e.cf.thunder * (0.6 + 0.8 * e.r());
    for (const k of s.rocks) if (k.y > s.y - 0.5 && k.y < s.y + 2) e.lit.set(k, s.t);
    for (const p of s.embers) if (!p.got && p.y > s.y - 0.5 && p.y < s.y + 2) e.lit.set(p, s.t);
    for (let i = Math.floor((s.y - 0.5) / BANK); i <= Math.ceil((s.y + 2) / BANK); i++) { e.banks.set(i * 2, s.t); e.banks.set(i * 2 + 1, s.t); }
  }
  // Forget what is behind and dark.
  if (e.banks.size > 400) for (const [key, t] of e.banks) if (s.t - t > GLOW) e.banks.delete(key);
  for (const [o, t] of e.lit) if (s.t - t > GLOW && (o.got !== undefined ? o.got || o.y < s.y - 1 : o.y0 < s.y - 1.5)) e.lit.delete(o);
  placeFlies(e);
  e.flies = e.flies.filter(f => f.y > s.y - 0.6);
  return e;
}

// How far to dawn tonight, 0 to 1.
export function reach(e) { return Math.min(1, progress(e.s) / e.cf.length); }
// How bright an afterglow is now: 1 just lit, 0 dark.
export function glow(e, o) { const t = e.lit.get(o); return t === undefined ? 0 : Math.max(0, 1 - (e.s.t - t) / GLOW); }

// Fireflies hover over safe water: one a row, every cf.fly units, over the middle of the widest channel that no rock's
// whole travel (swing, bob, drift, a whirlpool's pull) reaches. A row with no channel wide enough for the boat has none.
function placeFlies(e) {
  const s = e.s;
  while (e.nextFly * e.cf.fly < s.y + 1.9) {
    const y = e.nextFly * e.cf.fly; e.nextFly++;
    const x = channel(s, y);
    if (x !== null) e.flies.push({ x: mutant === 'flies-anywhere' ? centre(s, y) + (hash(e.nextFly, 7, e.seed) * 2 - 1) * (half(s, y) - 0.05) : x, y, id: e.nextFly });
  }
}
export function channel(s, y) {
  const c = centre(s, y), b = boat(s), lo = c - half(s, y) + b + 0.015, hi = c + half(s, y) - b - 0.015, cuts = [];
  for (const k of s.rocks) {
    if (!k.on && k.kind !== 'geyser') continue;
    const ylo = k.vy ? k.y0 - 0.15 : k.y0 - k.b, yhi = k.vy ? k.y0 + 0.9 : k.y0 + k.b; // ice drifts on down the river ahead of the boat
    const reachY = k.rad + b + 0.09 + (k.kind === 'pool' ? 0.16 : 0);
    if (y < ylo - reachY || y > yhi + reachY) continue;
    const w = k.rad + k.len + k.a + b + 0.025 + (k.kind === 'pool' ? 0.16 : 0);
    cuts.push([k.x0 - w, k.x0 + w]);
  }
  cuts.sort((p, q) => p[0] - q[0]);
  let x = lo, best = 0, at = null;
  for (const [p, q] of cuts) { if (Math.min(p, hi) - x > best) { best = Math.min(p, hi) - x; at = (x + Math.min(p, hi)) / 2; } x = Math.max(x, q); }
  if (hi - x > best) { best = hi - x; at = (x + hi) / 2; }
  return best > 0.03 ? at : null;
}

// Stars reflected on the water. A reflection of the sky moves with the one who looks, not with the water, so the stars
// hold still around the boat while the river and its rocks slide past beneath them: a star goes out wherever a rock sits now.
// One star per cell of a grid fixed to the boat (some cells empty), only on water. Returns every cell's star between y0 and y1
// as {x, y, on, i, j}; on false is a hole the player can see in the even scatter.
export function stars(e, y0, y1) {
  const s = e.s, out = [];
  // Grid jitter stays within two cells of the requested interval. Distant rocks cannot occlude a returned star.
  const rocks = s.rocks.filter(k => k.on && k.y + k.rad + 0.02 > y0 - 2 * STAR && k.y - k.rad - 0.02 < y1 + 2 * STAR);
  for (let j = Math.floor((y0 - s.y) / STAR); j <= Math.ceil((y1 - s.y) / STAR); j++) {
    for (let i = 0; i < 1 / STAR; i++) {
      if (hash(i, j, e.seed) < e.cf.empty) continue; // no star in this cell
      const x = (i + 0.2 + 0.6 * hash(i, j, e.seed + 1)) * STAR, y = s.y + (j + 0.2 + 0.6 * hash(i, j, e.seed + 2)) * STAR;
      const c = centre(s, y), h = half(s, y);
      if (Math.abs(x - c) > h - 0.008) continue; // the bank: no water, no reflection
      const on = !rocks.some(k => Math.abs(k.y - y) < k.rad + 0.02 && Math.hypot(Math.max(0, Math.abs(k.x - x) - k.len), k.y - y) < k.rad + 0.012);
      out.push({ x, y, on, i, j });
    }
  }
  return out;
}

// What the player can see now, the same for the page and the bots: lit rocks (where they are now), lit or near pickups,
// lit bank samples and the fireflies. Banks are also faintly seen in starlight, so the bots may use centre and half.
export function view(e) {
  const s = e.s, rocks = [], embers = [], banks = [];
  for (const k of s.rocks) { const g = glow(e, k); if (g > 0) rocks.push({ k, x: k.x, y: k.y, rad: k.rad, len: k.len, kind: k.kind, on: k.on, glow: g }); }
  for (const p of s.embers) if (!p.got) { const g = glow(e, p), near = Math.hypot(p.x - s.x, p.y - s.y) < NEAR; if (g > 0 || near) embers.push({ p, x: p.x, y: p.y, kind: p.kind, glow: Math.max(g, near ? 0.35 : 0) }); }
  for (const [key, t] of e.banks) { const g = Math.max(0, 1 - (s.t - t) / GLOW); if (g > 0) { const i = key >> 1, y = i * BANK; banks.push({ y, side: key & 1 ? 1 : -1, x: centre(s, y) + (key & 1 ? 1 : -1) * half(s, y), glow: g }); } }
  return { rocks, embers, banks, flies: e.flies, flash: Math.max(0, 1 - (s.t - e.flash) / 0.35) };
}

// Water on rocks: the nearest rock ahead, as a stereo pan (-1 left, 1 right) and a level (0 to 1) that grows as it nears.
export function murmur(e) {
  const s = e.s; let best = null, level = 0;
  for (const k of s.rocks) {
    if (!k.on) continue;
    const dy = k.y - s.y; if (dy < -0.08 || dy > 0.75) continue;
    const dx = Math.max(0, Math.abs(k.x - s.x) - k.len) - k.rad;
    const d = Math.hypot(dx, Math.max(0, dy)), l = Math.max(0, 1 - d / 0.6) ** 2;
    if (l > level) { level = l; best = k; }
  }
  return { level, pan: best ? Math.max(-1, Math.min(1, (best.x - s.x) / 0.18)) : 0 };
}

// Stars for a night won: one for dawn, one for no blow taken, one for 6 or more sparks still in the tin.
export function rating(e) { if (e.s.over !== 'dawn') return 0; return 1 + (e.hits === 0 ? 1 : 0) + (e.tin >= 6 ? 1 : 0); }
