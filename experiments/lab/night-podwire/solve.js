// Look-ahead player for the bots and the daily par. Runs in Node and in the page.
// It tries every grip along the windings (and every fret setting and release time where those
// matter), simulates a few seconds ahead, and keeps the pluck that opens most or comes closest.
// The work is a generator, so the page can spread it over frames.
import { at, BASE, clone, create, cueOf, cueWait, fret, grab, harmonic, plates, podX, pull, release, tick, TICK } from './sim.js';

export const HORIZON = 4;
const LOOK = 2.6; // seconds simulated ahead for each candidate pluck
const timed = s => s.live || s.pods.some(p => p.swing);

export function gripsFor(s, step = 3) {
  const out = [];
  for (const [a, b] of s.zones) for (let x = a; x <= b + 1e-9; x += step) out.push(Math.min(b, x));
  return out;
}
function fretSettings(s) {
  const n = s.frets?.length || 0, out = [];
  for (let m = 0; m < 1 << n; m++) out.push(Array.from({ length: n }, (_, k) => !!(m >> k & 1)));
  return out.length ? out : [[]];
}
function setFrets(s, want) {
  (s.frets || []).forEach((f, k) => { if (f.on !== want[k]) fret(s, k); });
}
export function wait(s, seconds) {
  for (let n = Math.round(seconds / TICK); n > 0 && !s.won; n--) tick(s);
}
// A real pull takes time; a live wire keeps moving under the finger meanwhile.
export const GESTURE = .25;
// Pull straight down from wherever the wire is at x, and let go.
export function pluck(s, x, depth) {
  const y = BASE + at(s, x);
  if (!grab(s, x, y)) return false;
  if (s.live) for (let n = Math.round(GESTURE / TICK); n > 0; n--) tick(s);
  pull(s, y + depth - s.grip.start);
  return release(s);
}
export function act(s, a) {
  if (a.frets) setFrets(s, a.frets);
  if (a.delay) wait(s, a.delay);
  return pluck(s, a.x, a.depth);
}
function progress(s) {
  let score = 0;
  for (const p of s.pods) {
    if (p.open) { score += 1; continue; }
    if (p.crackedAt != null) score += .5;
    score += .4 * Math.min(.95, p.reach || 0);
  }
  return score;
}
function look(s, seconds) {
  for (const p of s.pods) p.reach = 0;
  for (let n = Math.round(seconds / TICK); n > 0 && !s.won; n--) {
    tick(s);
    if (n % 4) continue;
    for (const p of s.pods) {
      if (p.open) continue;
      const r = p.type === 'tuned' ? harmonic(s, p.mode) / p.height : -at(s, podX(s, p)) / p.height;
      if (r > p.reach) p.reach = r;
    }
  }
  return progress(s);
}
export function* chooseSteps(s, { step = 3 } = {}) {
  const depth = s.maxPull ?? plates[s.level - 1].maxPull ?? 86;
  // Release times matter only for a live wire or a moving pod: one period of the wire in 0.15 s steps.
  const waits = timed(s) ? Array.from({ length: 12 }, (_, k) => k * .15) : [0];
  if (timed(s)) step = Math.max(step, 6);
  let best = null;
  for (const frets of fretSettings(s)) for (const delay of waits) for (const x of gripsFor(s, step)) {
    const t = clone(s);
    const a = { x, depth, delay, frets: s.frets?.length ? frets : null };
    if (!act(t, a)) continue;
    const score = look(t, LOOK) - delay * .01;
    if (!best || score > best.score + 1e-9) best = { ...a, score };
    yield;
  }
  return best;
}
function run(gen) { let r; do r = gen.next(); while (!r.done); return r.value; }
export const choose = (s, options) => run(chooseSteps(s, options));

// Plays a plate to the end. `noise` makes a clumsy player: { aim, depth, time, random }.
export function* solveSteps(s, { limit = 8, noise = null, step = 3 } = {}) {
  const plan = [];
  while (!s.won && plan.length < limit) {
    const a = yield* chooseSteps(s, { step });
    if (!a) break;
    const done = noise ? {
      ...a,
      x: a.x + (noise.random() * 2 - 1) * noise.aim,
      depth: a.depth - noise.random() * noise.depth,
      delay: Math.max(0, a.delay + (noise.random() * 2 - 1) * noise.time),
    } : a;
    // A clumsy finger still lands on the winding it aimed for, at its nearest end.
    const zone = s.zones.find(([lo, hi]) => a.x >= lo && a.x <= hi);
    done.x = Math.max(zone[0], Math.min(zone[1], done.x));
    act(s, done);
    plan.push(done);
    // On a live wire the next pluck may come before this one has finished: keep going while
    // the look-ahead says this one alone will not finish the plate.
    if (timed(s)) {
      const ahead = clone(s);
      wait(ahead, HORIZON);
      if (!ahead.won && plan.length < limit) continue;
    }
    wait(s, HORIZON);
  }
  return { won: s.won, plucks: s.plucks, plan };
}
export const solve = (s, options) => run(solveSteps(s, options));

export function random(seed) {
  let state = seed >>> 0;
  return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
}
// Fewest plucks the look-ahead player needs on a plate: the par (null if it cannot clear it).
export function* parSteps(level, seed, options) {
  const r = yield* solveSteps(create(level, seed, options));
  return r.won ? r.plucks : null;
}
export const par = (level, seed, options) => run(parSteps(level, seed, options));

// A player who copies only what the drawn finger does.
export function followCue(s) {
  for (const g of cueOf(s)) {
    if (g.fret !== undefined) { if (!s.frets[g.fret].on) fret(s, g.fret); continue; }
    // The drawn `after` is release to release; a live pull itself takes GESTURE seconds.
    act(s, { x: g.x, depth: g.depth, delay: Math.max(0, cueWait(s, g) - (s.live && g.after ? GESTURE : 0)) });
  }
  wait(s, HORIZON);
  return s.pods.filter(p => p.open).length;
}
