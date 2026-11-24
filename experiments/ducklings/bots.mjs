import assert from 'node:assert/strict';
import { create, step, stars, LAST_STAGE, DT, SPEED, GAP, R_MOM, R_DUCK, LINE_MAX, QUACK_TIME, QUACK_SQUEEZE, TRAITS,
  hitAny, moveMom, pathAt, stepDelay, duskRate } from './sim.js';
import { bands, routeCheck } from './route.mjs';
import { starFeedback, warningOnScreen } from './feedback.js';

assert.equal(warningOnScreen(-450, 640), false, 'a distant upstream hazard stays quiet');
assert.equal(warningOnScreen(900, 640), false, 'a hazard behind the screen stays quiet');
assert.equal(warningOnScreen(200, 640), true, 'a visible hazard can sound its warning');

for (const [arrived, hits, scatters, expected] of [
  [3, 0, 0, 'For three stars, bring all 4 home.'],
  [4, 1, 0, 'For three stars, avoid hits.'],
  [4, 0, 1, 'For three stars, avoid scares.'],
  [3, 1, 1, 'For three stars, bring all 4 home and avoid hits and scares.'],
  [4, 0, 0, ''],
]) {
  assert.equal(starFeedback({ total: 4, arrived: Array(arrived), hits, scatters }), expected);
}


const LOOK = 0.15, STEPS = 30; // sample the next 4.5 s for the whole flock
const DIRS = 10;
const REACTIVE_SAMPLES = 7;

// Where to go next: the nearest waiting duckling not far behind, else the nest (or onward, on the endless pond).
function goalOf(s, careful) { return stepping(s, wantOf(s, careful)); }
// Cross one hazard band at a time: if a band lies between her and the goal, aim for the free water just past it,
// so she can stop there and let the line bunch before the next band (a person sees those calm strips too).
let bandCache = null;
function stepping(s, goal) {
  if (!bandCache || bandCache.s !== s || bandCache.n !== s.hazards.length) bandCache = { s, n: s.hazards.length, list: bands(s, -1, 1e9) };
  const m = s.mom;
  if (goal.y > m.y) { const b = bandCache.list.find(b => b.b > m.y + 0.02 && b.a < goal.y); if (b && b.b + 0.04 < goal.y) return { x: goal.x, y: b.b + 0.04 }; }
  else { const b = [...bandCache.list].reverse().find(b => b.a < m.y - 0.02 && b.b > goal.y); if (b && b.a - 0.04 > goal.y) return { x: goal.x, y: b.a - 0.04 }; }
  return goal;
}
function wantOf(s, careful) {
  const m = s.mom; let best = null, bestD = Infinity;
  if (s.line.length < LINE_MAX) for (const l of s.lost) {
    if (l.y < m.y - 1.6) continue;
    if (!careful && (Math.abs(l.x - m.x) > .16 || l.y < m.y - .12 || l.y > m.y + .70)) continue;
    const d = Math.hypot(l.x - m.x, (l.y - m.y) * (l.y < m.y ? 1.5 : 1));
    if (d < bestD) { bestD = d; best = { x: l.x, y: l.y }; }
  }
  if (best) return best;
  return s.nest ? { x: s.nest.x, y: s.nest.y } : { x: 0.5, y: m.y + 1.5 };
}

// Score one way of moving: go in `dir` (or wait) for a moment, then head for the goal.
function score(s, world, dir, goal, quack, careful) {
  const m = { x: s.mom.x, y: s.mom.y, vx: s.mom.vx, vy: s.mom.vy }, trail = [{ x: m.x, y: m.y }];
  const first = dir === 'wait' ? { x: m.x, y: m.y } : null;
  let cost = 0, momHit = false;
  const ticks = 2;
  const samples = careful ? STEPS : REACTIVE_SAMPLES;
  const delays = s.line.map(f => f.delay), hitF = s.line.map(() => false);
  let qT = quack ? QUACK_TIME : s.quackT;
  for (let j = 1; j <= samples; j++) {
    const phase1 = j * LOOK <= 0.9;
    for (let k = 0; k < ticks; k++) {
      const tt = s.t + ((j - 1) * ticks + k + 1) * LOOK / ticks;
      const target = phase1 ? (first ?? (dir === 'goal' ? goal : { x: m.x + Math.cos(dir) * 0.3, y: m.y + Math.sin(dir) * 0.3 })) : goal;
      moveMom(world, m, target, tt, LOOK / ticks, false);
    }
    trail.push({ x: m.x, y: m.y });
    cost += 1.2 * Math.hypot(goal.x - m.x, goal.y - m.y); // sooner is better
    const t = s.t + j * LOOK, fade = 1 / (1 + j * 0.03);
    if (!momHit && s.safe < j * LOOK && hitAny(world, t, m.x, m.y, R_MOM + 0.02)) { momHit = true; cost += 1000 * fade; }
    if (!careful) continue;
    // each duckling: where it will be at time t, on the old trail or on the new one
    qT = Math.max(0, qT - LOOK); let D = 0;
    for (let i = 0; i < delays.length; i++) {
      D += GAP * TRAITS[s.line[i].trait].gap * (qT > 0 ? QUACK_SQUEEZE : 1);
      delays[i] = stepDelay(delays[i], D, LOOK);
      if (hitF[i]) continue;
      const rel = j * LOOK - delays[i]; let p;
      if (rel <= 0) p = pathAt(s, -rel);
      else { const a = rel / LOOK, i0 = Math.floor(a), f = a - i0, A = trail[i0], B = trail[Math.min(i0 + 1, trail.length - 1)]; p = { x: A.x + (B.x - A.x) * f, y: A.y + (B.y - A.y) * f }; }
      if (hitAny(world, t, p.x, p.y, R_DUCK + 0.015, true)) { hitF[i] = true; cost += 300 * fade; }
    }
  }
  cost += 6 * Math.hypot(goal.x - m.x, goal.y - m.y);
  if (quack) cost += 2; // a quack is spent only when it helps
  return cost;
}

function localWorld(s, careful) {
  const reach = (careful ? STEPS : REACTIVE_SAMPLES) * LOOK * SPEED + .25;
  const gap = Math.max(0, ...s.line.map(f => f.delay));
  // History and future positions are both within these bounds at any sampling time.
  const low = s.mom.y - reach - gap * SPEED;
  const high = s.mom.y + reach + gap * SPEED;
  const hazards = s.hazards.filter(h => h.y0 <= high && h.y1 >= low);
  return { hazards, rocks: s.rocks, reeds: s.reeds, gusts: s.gusts, nest: s.nest };
}

export function planner(careful) {
  let next = 0, choice = null, quackNow = false;
  return s => {
    if (s.t >= next) {
      next = s.t + (careful ? 0.28 : 0.4);
      const goal = goalOf(s, careful), world = localWorld(s, careful);
      const options = ['goal', 'wait'];
      for (let i = 0; i < DIRS; i++) options.push(i / DIRS * Math.PI * 2);
      let best = Infinity; quackNow = false;
      for (const dir of options) for (const q of (careful && s.quackCool <= 0 && s.line.length > 1 ? [false, true] : [false])) {
        const c = score(s, world, dir, goal, q, careful);
        if (c < best) { best = c; choice = dir; quackNow = q; }
      }
      // keep the chosen heading as a point ahead, as a finger would
      choice = { dir: choice, goal };
    } else quackNow = false;
    const m = s.mom, d = choice.dir;
    const target = d === 'wait' ? { x: m.x, y: m.y } : d === 'goal' ? choice.goal : { x: m.x + Math.cos(d) * 0.3, y: m.y + Math.sin(d) * 0.3 };
    return { target, quack: quackNow };
  };
}
// Waypoints are separate from the campaign data. They drive the same eased steering
// and tick loop as a held thumb. A number is a wait at the preceding waypoint.
const ROUTES = [
  null,
  [],
  [[.73, .86]],
  [[.19, .83], [.23, 1.26]],
  [[.22, .86], [.27, 1.29], [.76, 1.53], [.64, 1.91], [.30, 1.91]],
  [[.50, .83], 0.65, [.50, 1.46]],
  [[.50, .79], [.50, 1.49], 0.8, [.34, 2.20]],
  [[.31, .78], [.22, 1.45]],
  [[.58, .75], [.73, 1.33], [.64, 1.71], .2, [.27, 2.42]],
  [[.20, .84], [.20, 1.39]],
  [[.49, .82], [.59, 1.40]],
  [[.64, .86], [.70, 1.35], [.34, 1.55], [.30, 2.07]],
  [[.77, .81], [.77, 1.34]],
  [[.59, .78], [.58, 1.08], [.30, 1.35], [.29, 1.97]],
  [[.47, .86], [.47, 1.38], [.70, 1.62], [.72, 1.90]],
  [[.76, .90], [.75, 1.53], [.23, 1.91]],
  [[.77, .86], [.77, 1.38]],
  [[.66, .78], [.64, 1.15], [.33, 1.26], [.32, 1.93]],
  [[.51, 1.76]],
  [[.30, 1.46], [.64, 1.47], [.67, 2.45]],
  [],
  [[.29, .78], [.24, 1.39], [.24, 1.94]],
  [[.31, .79], [.21, 1.39], [.18, 2.14], [.37, 2.38], [.74, 2.28]],
  [[.25, .83], [.23, 1.25], [.24, 2.40]],
  [[.73, .76], [.72, .91], [.72, 1.43], [.34, 1.51], [.32, 2.12], [.24, 2.73], [.39, 3.40]],
];

function waypoints(points) {
  let index = 0, until = null;
  return s => {
    const point = points[index];
    if (typeof point === 'number') {
      until ??= s.t + point;
      if (s.t >= until) { index++; until = null; }
      return { target: null };
    }
    if (!point) return { target: s.nest };
    const [x, y] = point;
    if (Math.hypot(s.mom.x - x, s.mom.y - y) < 0.045) index++;
    return { target: { x, y } };
  };
}

const straight = s => ({ target: s.nest });
const idle = () => ({ target: null });
function play(opts, act, limit = 135, sample) {
  const s = create(opts);
  let trace = 0;
  while (!s.over && s.t < limit) {
    const { target, quack } = act(s);
    step(s, target, quack);
    trace = (trace * 31 + Math.round(s.mom.x * 1e4) + Math.round(s.mom.y * 1e4)) % 1e9;
    sample?.(s);
  }
  return { s, trace };
}

function campaign() {
  const table = [];
  for (let stage = 1; stage <= LAST_STAGE; stage++) {
    const points = ROUTES[stage], { s } = play({ stage }, waypoints(points), 28);
    const direct = play({ stage }, straight, 28).s;
    table.push({
      level: stage, home: `${s.arrived.length}/${s.total}`, stars: stars(s), seconds: s.t.toFixed(1),
      straight: stars(direct), hits: s.hits, scares: s.scatters,
    });
    assert.equal(play({ stage }, idle, 20).s.arrived.length, 0, `level ${stage} idle`);
  }
  console.table(table);
  assert.ok(table.every(row => row.stars === 3), 'every level has a clean, full-flock route');
  assert.ok(table.filter(row => row.straight < 3).length >= 14, 'holding straight is worse than route choice');
  const sticky = play({ stage: 12 }, straight, 12).s;
  assert.equal(sticky.hits, 0, 'the mother crosses the weeds unharmed');
  assert.equal(sticky.scatters, 2, 'both followers scatter from the same path');
  const folding = play({ stage: 16 }, straight, 12).s;
  assert.ok(folding.arrived.length < folding.total, 'the line is too long for the folding leaves');
  let pressed = false;
  const closeUp = play({ stage: 16 }, s => {
    const trigger = s.hazards[0].triggeredAt;
    const quack = !pressed && trigger !== null && s.t - trigger > .4;
    pressed ||= quack;
    return { target: s.nest, quack };
  }, 12).s;
  assert.equal(stars(closeUp), 3, 'quacking on the leaf rustle gets the whole line through');
  const dash = play({ stage: 20 }, s => {
    s.hazards.length = 0;
    return straight(s);
  }, 10).s;
  assert.equal(dash.why, 'dusk', 'the direct dash times out without the current');

  const opts = { stage: 24, seed: 0xffffffff };
  const a = play(opts, waypoints(ROUTES[24]));
  const b = play(opts, waypoints(ROUTES[24]));
  assert.equal(a.trace, b.trace, 'campaign fixed-tick determinism');
  assert.deepEqual(a.s, b.s, 'campaign resulting state');
}

function endless() {
  const table = [], totals = { competent: [], average: [] };
  const times = [25, 50, 75, 100], cuts = Object.fromEntries(times.map(t => [t, [0, 0]]));
  for (let k = 1; k <= 12; k++) {
    const seed = k * 101;
    const out = { seed };
    for (const [i, label] of ['competent', 'average'].entries()) {
      const { s } = play({ endless: true, seed }, planner(i === 0));
      totals[label].push(s);
      out[label] = `${s.t.toFixed(1)}s / ${s.score} / ${s.why ?? 'alive'}`;
      for (const t of times) if (s.t >= t) cuts[t][i]++;
    }
    table.push(out);
  }
  console.table(table);
  console.table(times.map(t => ({ seconds: t, drain: duskRate(t).toFixed(2), competent: cuts[t][0], average: cuts[t][1] })));
  const repeat = () => play({ endless: true, seed: 202 }, planner(true));
  assert.equal(repeat().trace, repeat().trace, 'endless fixed-tick determinism');
  const idleRun = play({ endless: true, seed: 101 }, idle).s;
  assert.equal(idleRun.score, 0);
  for (const [label, lo, hi] of [['competent', 60, 120], ['average', 25, 60]]) {
    const runs = totals[label];
    assert.ok(runs.every(s => s.over), `${label}: runs reach an ending`);
    assert.ok(runs.every(s => s.t >= lo && s.t <= hi), `${label}: all 12 runs inside the duration range`);
  }
  assert.ok(totals.competent.filter((s, i) => s.score > totals.average[i].score).length >= 9);
  assert.ok(routeCheck(202, { yEnd: 15, n: 10 }).ok, 'full-flock route on the double-log regression seed');
}

if (process.argv[1]?.endsWith('bots.mjs')) {
  const start = performance.now();
  if (process.argv[2] !== 'endless') campaign();
  if (process.argv[2] !== 'campaign') endless();
  console.log(`Passed in ${((performance.now() - start) / 1000).toFixed(2)}s`);
}
