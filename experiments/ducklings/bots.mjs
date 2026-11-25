import assert from 'node:assert/strict';
import { create, step, stars, LAST_STAGE, DT, SPEED, GAP, R_MOM, R_DUCK, LINE_MAX, QUACK_TIME, QUACK_SQUEEZE, TRAITS,
  hitAny, moveMom, pathAt, stepDelay, duskRate, WAIT_APART, SETTLE } from './sim.js';
import { bands, routeCheck } from './route.mjs';
import { LEVELS } from './levels.js';
import { starFeedback, warningOnScreen, nestMarkerShows, padCueShows, leafLeft, leafQuackCue, LEAF_QUACK, driftMarks } from './feedback.js';

assert.equal(warningOnScreen(-450, 640), false, 'a distant upstream hazard stays quiet');
assert.equal(warningOnScreen(900, 640), false, 'a hazard behind the screen stays quiet');
assert.equal(warningOnScreen(200, 640), true, 'a visible hazard can sound its warning');
// 390 px wide at 3x: the marker top is 79 px below a 47 px inset, and the nest is drawn about .12 pond widths tall below its center.
assert.equal(nestMarkerShows(378 - 40, 378, 1170), false, 'the nest marker stays away while the nest itself shows below it');
assert.equal(nestMarkerShows(378 - 200, 378, 1170), true, 'the nest marker appears once the nest is above the screen');
assert.equal(padCueShows(false, 40, 3.2, 2.4), true, 'the lily-pad cue returns when she swims back down the pond');
assert.equal(padCueShows(false, 40, 3.2, 3.0), false, 'the lily-pad cue stays away while she swims on');

for (const [arrived, hits, scatters, expected] of [
  [3, 0, 0, ['nest']],
  [4, 1, 0, ['heart']],
  [4, 0, 1, ['scatter']],
  [3, 1, 1, ['nest', 'heart', 'scatter']],
  [4, 0, 0, []],
]) {
  assert.deepEqual(starFeedback({ total: 4, arrived: Array(arrived), hits, scatters }), expected);
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
export const ROUTES = [
  null,
  [],
  [[.73, .86]],
  [[.19, .83], [.23, 1.26]],
  [[.22, .86], [.27, 1.29], [.76, 1.53], [.64, 1.91], [.30, 1.91]],
  [[.50, .83], 0.65, [.50, 1.46]],
  [[.50, .79], [.50, 1.49], 0.8, [.34, 2.20]],
  [[.31, .78], [.22, 1.45]],
  [[.58, .75], [.73, 1.33], [.64, 1.71], .2, [.27, 2.42]],
  [[.84, .80], [.84, 1.30]],
  [[.49, .82], [.59, 1.40]],
  [[.64, .86], [.70, 1.35], [.34, 1.55], [.30, 2.07]],
  [[.77, .81], [.77, 1.34]],
  [[.59, .78], [.58, 1.08], [.30, 1.35], [.38, 1.95], [.82, 2.08]],
  [[.47, .86], [.47, 1.38], [.30, 1.55]],
  [[.76, .90], [.75, 1.53], [.23, 1.91]],
  [[.77, .86], [.77, 1.38]],
  [[.66, .78], [.64, 1.15], [.33, 1.26], [.32, 1.93]],
  [[.51, 1.30], [.51, 1.76], [.26, 1.98]],
  [[.30, 1.46], [.18, 1.80], [.20, 2.10], [.45, 2.55]],
  [],
  [[.45, .70], [.58, 1.20], [.25, 1.55], [.24, 1.94]],
  [[.31, .79], [.21, 1.39], [.18, 2.14], [.37, 2.38], [.74, 2.28]],
  [[.25, .83], [.23, 1.25], [.24, 2.40], [.40, 2.70], [.80, 2.62]],
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
export const SAME_FEEL = [7, 9, 11, 13, 14, 18, 22, 23, 24];
// Tap where the opening ghost taps (or straight ahead when a stage has none), then hold on the nest.
function ghostThenNest() {
  let i = 0;
  return s => {
    const points = LEVELS[s.stage].guide ?? [[.5, .65]];
    if (i < points.length) {
      const [x, y] = points[i];
      if (Math.hypot(s.mom.x - x, s.mom.y - y) < .045) i++;
      else return { target: { x, y } };
    }
    return { target: s.nest };
  };
}
// The same opening, then short taps toward the nest: she stops at each tap, and the next comes a moment later.
function tapper() {
  const opening = ghostThenNest();
  let dest = null, arrived = null;
  return s => {
    const first = opening(s);
    if (first.target !== s.nest) return first;
    if (dest && Math.hypot(s.mom.x - dest.x, s.mom.y - dest.y) < .045) {
      arrived ??= s.t;
      if (s.t - arrived >= .25) dest = null;
    }
    if (!dest) {
      const dx = s.nest.x - s.mom.x, dy = s.nest.y - s.mom.y, k = Math.min(1, .35 / Math.hypot(dx, dy));
      dest = { x: s.mom.x + dx * k, y: s.mom.y + dy * k }; arrived = null;
    }
    return { target: dest };
  };
}
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

// The opening ghost is the first thing a player copies. Follow it, keep its heading for a few seconds,
// and the flock must come through unharmed. Stages 1, 2 and 5 draw their own guides.
export function ghostHarm(stage) {
  const s = create({ stage }), points = LEVELS[stage].guide ?? [[.5, .65]];
  let i = 0;
  while (!s.over && s.t < 12 && i < points.length) {
    const [x, y] = points[i];
    if (Math.hypot(s.mom.x - x, s.mom.y - y) < .045) { i++; continue; }
    step(s, { x, y });
  }
  const last = points.at(-1), prev = points.at(-2) ?? [.5, .35];
  const dx = last[0] - prev[0], dy = last[1] - prev[1], length = Math.hypot(dx, dy);
  const ahead = { x: last[0] + dx / length * .5, y: last[1] + dy / length * .5 }, until = s.t + 3.5;
  while (!s.over && s.t < until) step(s, ahead);
  return s.hits + s.scatters;
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
  const misled = table.map(row => row.level).filter(stage => ![1, 2, 5].includes(stage) && ghostHarm(stage) > 0);
  assert.deepEqual(misled, [], 'following the opening ghost never leads the flock into harm');
  assert.ok(table.filter(row => row.straight < 3).length >= 14, 'holding straight is worse than route choice');
  // Stages the audit found same-feel or trivial: neither holding straight for the nest nor tapping the default
  // heading (the opening ghost's points, then the nest) may earn two stars. Each still has a 3-star route above.
  const naive = SAME_FEEL.map(stage => ({ stage, straight: stars(play({ stage }, straight, 40).s),
    ghost: stars(play({ stage }, ghostThenNest(), 40).s), taps: stars(play({ stage }, tapper(), 40).s) }));
  console.table(naive);
  assert.deepEqual(naive.filter(row => Math.max(row.straight, row.ghost, row.taps) >= 2).map(row => row.stage), [],
    'no same-feel stage gives two stars to holding straight or tapping the default heading');
  // The search planner from the endless pond also finds the full flock on the retuned stages (it cannot clear 13, a weed stage).
  for (const stage of [9, 14, 18, 23]) assert.equal(stars(play({ stage }, planner(true), 40).s), 3, `planner clears stage ${stage}`);
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
  // The green part of the leaf countdown is the quack that brings all three home while she keeps swimming:
  // a quack on its first tick, and one on its last tick, both give three stars.
  for (const at of ['first', 'last']) {
    let done = false;
    const cued = play({ stage: 16 }, s => {
      const h = s.hazards[0], next = leafQuackCue(h.triggeredAt, s.t + DT);
      const quack = !done && leafQuackCue(h.triggeredAt, s.t) && (at === 'first' || !next);
      done ||= quack;
      return { target: s.nest, quack };
    }, 12).s;
    assert.ok(done, `the leaf cue opened (${at} tick)`);
    assert.equal(stars(cued), 3, `quacking on the ${at} tick of the leaf cue brings all three home`);
  }
  assert.equal(leafLeft(null, 1.55, 3), null, 'untouched leaves show no countdown');
  assert.equal(leafLeft(2, 1.55, 2), 1, 'the countdown starts full');
  assert.ok(Math.abs(leafLeft(2, 1.55, 2 + 1.55 * .75) - .25) < 1e-9, 'the countdown empties as the leaves fold');
  assert.equal(leafLeft(2, 1.55, 3.6), null, 'folded leaves show no countdown');
  assert.ok(LEAF_QUACK.to < 1.55, 'the quack cue closes before the leaves fold');
  // Current: the marks in the water move at the current's own velocity, so they show its direction and strength.
  for (const stage of [18, 19, 20, 21, 23, 24]) for (const h of LEVELS[stage].hazards.filter(h => h.kind === 'current')) {
    const a = driftMarks(h, 3), b = driftMarks(h, 3.1);
    const moved = a.map((m, i) => [b[i].x - m.x, b[i].y - m.y]).filter(([dx, dy]) => dy > 0);
    assert.ok(moved.length >= a.length - 3, `stage ${stage}: most marks keep drifting over a tenth of a second`);
    for (const [dx, dy] of moved) {
      assert.ok(Math.abs(dx - h.dx * .1) < 1e-9 && Math.abs(dy - h.dy * .1) < 1e-9, `stage ${stage}: a mark moves with the current`);
    }
    assert.ok(a.every(m => m.y >= h.y0 && m.y <= h.y1 && Math.abs(m.x - h.x) < h.w + Math.abs(h.dx) * (h.y1 - h.y0) / h.dy), `stage ${stage}: marks stay in the current`);
  }
  const weak = driftMarks({ x: .5, y0: 0, y1: 1, w: .2, dx: 0, dy: .29 }, 1)[0], strong = driftMarks({ x: .5, y0: 0, y1: 1, w: .2, dx: .1, dy: .29 }, 1)[0];
  assert.ok(strong.len > weak.len && strong.angle > weak.angle, 'a stronger, slanted current draws longer, tilted marks');
  const dash = play({ stage: 20 }, s => {
    s.hazards.length = 0;
    return straight(s);
  }, 10).s;
  assert.equal(dash.why, 'dusk', 'the direct dash times out without the current');

  nestDropOff();

  const opts = { stage: 24, seed: 0xffffffff };
  const a = play(opts, waypoints(ROUTES[24]));
  const b = play(opts, waypoints(ROUTES[24]));
  assert.equal(a.trace, b.trace, 'campaign fixed-tick determinism');
  assert.deepEqual(a.s, b.s, 'campaign resulting state');
}

// Second cold play: the level ended the moment she brushed the nest, while the player was steering past it
// for a last waiting duckling (stages 4, 8 and 9 each ended at one star). The nest is a drop-off now.
function nestDropOff() {
  // Stage 4: follow the authored route but end it in the nest before the last duckling, then go back for it.
  const route = ROUTES[4], last = route.at(-1);
  let phase = 0, i = 0, settledAt = null;
  const s = create({ stage: 4 });
  while (!s.over && s.t < 40) {
    let target;
    if (phase === 0) { // the route up to the last waypoint, then the nest
      if (i < route.length - 1) { const [x, y] = route[i]; if (Math.hypot(s.mom.x - x, s.mom.y - y) < .045) i++; target = { x, y }; }
      else target = s.nest;
      if (s.home && !s.line.length) phase = 1;
    } else if (phase === 1) { // out of the nest to the last waiting bird, then home
      target = s.lost.length ? { x: s.lost[0].x, y: s.lost[0].y } : s.nest;
      if (!s.lost.length) phase = 2;
    } else target = s.nest;
    step(s, target);
  }
  assert.equal(s.over, 'nest', 'stage 4: leaving the nest for the last duckling still ends at the nest');
  assert.equal(s.arrived.length, s.total, 'stage 4: the birds dropped at the nest stay home while she fetches the last');
  assert.equal(stars(s), 3, 'stage 4: the fetched duckling counts for the third star');
  assert.ok(last, 'stage 4 has a route');
  // Staying in the nest with enough home and a bird still waiting ends the level after SETTLE seconds, not at once.
  const stay = create({ stage: 4 });
  for (const [x, y] of route.slice(0, 3)) while (!stay.over && Math.hypot(stay.mom.x - x, stay.mom.y - y) >= .045) step(stay, { x, y });
  while (!stay.over && stay.t < 40) {
    step(stay, stay.nest);
    if (stay.home && !stay.line.length && settledAt === null) settledAt = stay.t;
  }
  assert.equal(stay.over, 'nest', 'staying in the nest with enough home ends the level');
  assert.ok(stay.lost.length > 0 && stay.arrived.length >= LEVELS[4].need, 'it ended with a duckling still waiting');
  assert.ok(Math.abs(stay.t - settledAt - SETTLE) < .05, `it ended ${SETTLE} s after the line was home, not at once`);
  // Birds dropped at the nest stay won: leaving with enough home and running out of time still clears the level.
  const late = create({ stage: 4 });
  for (const [x, y] of route.slice(0, 3)) while (!late.over && Math.hypot(late.mom.x - x, late.mom.y - y) >= .045) step(late, { x, y });
  while (!late.over && !(late.home && !late.line.length)) step(late, late.nest);
  assert.ok(!late.over && late.arrived.length >= LEVELS[4].need && late.lost.length > 0, 'enough home with one still waiting');
  late.time = late.t + 3; // stage 4 has no clock; give it one that runs out while she is away
  while (!late.over) step(late, { x: late.nest.x, y: late.nest.y - .4 });
  assert.equal(late.over, 'nest', `leaving the nest with enough home and running out (${late.why}) still clears the level`);
  assert.equal(stars(late), 1);
  // Too few birds left anywhere to make the minimum ends the level at once, with the reason.
  const doomed = create({ stage: 8 });
  step(doomed, null);
  doomed.lost.length = 0; doomed.line.length = 1;
  step(doomed, null);
  assert.equal(doomed.why, 'short', 'a level that can no longer be won ends as short at once');
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
  // A scattered duckling that swims back is a rescue, not new points: scattering must not pay.
  let rejoins = 0, rejoinPoints = 0;
  for (let k = 1; k <= 12 && rejoins < 3; k++) {
    let before = 0;
    play({ endless: true, seed: k * 101 }, planner(true), 135, s => {
      const again = s.events.filter(e => e.type === 'join' && e.again).length;
      if (again && !s.events.some(e => e.type !== 'join')) { rejoins += again; rejoinPoints += s.score - before; }
      before = s.score;
    });
  }
  assert.ok(rejoins > 0, 'the competent planner re-rescues at least one scattered duckling');
  assert.equal(rejoinPoints, 0, 're-rescuing a scattered duckling scores nothing');
  const idleRun = play({ endless: true, seed: 101 }, idle).s;
  assert.equal(idleRun.score, 0);
  for (const [label, lo, hi] of [['competent', 60, 120], ['average', 25, 60]]) {
    const runs = totals[label];
    assert.ok(runs.every(s => s.over), `${label}: runs reach an ending`);
    assert.ok(runs.every(s => s.t >= lo && s.t <= hi), `${label}: all 12 runs inside the duration range`);
  }
  assert.ok(totals.competent.filter((s, i) => s.score > totals.average[i].score).length >= 9);
  assert.ok(routeCheck(202, { yEnd: 15, n: 10 }).ok, 'full-flock route on the double-log regression seed');
  removals();
}

// Endless "vanished" ducklings: log every removal from the line with its reason over many seeds.
// Every removal must come with an event the page draws, and a scattered bird must wait where it can be
// counted, apart from the other waiting birds (two birds on one spot read as one, so the other vanished).
function removals() {
  const chaser = s => {
    const m = s.mom, near = s.lost.filter(l => l.y > m.y - .3).sort((a, b) => Math.hypot(a.x - m.x, a.y - m.y) - Math.hypot(b.x - m.x, b.y - m.y))[0];
    return { target: near ? { x: near.x, y: near.y } : { x: .5, y: m.y + .5 } };
  };
  let scatters = 0, silent = 0, stacked = 0;
  for (let k = 1; k <= 24; k++) for (const act of [chaser, planner(false)]) {
    let before = new Set();
    play({ endless: true, seed: k * 37 + 11 }, act, 90, s => {
      const told = new Set(s.events.filter(e => ['scatter', 'gone', 'arrive'].includes(e.type)).map(e => e.id));
      for (const id of before) if (!s.line.some(f => f.id === id) && !told.has(id)) silent++;
      for (const e of s.events.filter(e => e.type === 'scatter')) {
        scatters++;
        if (s.lost.some(l => l.id !== e.id && Math.hypot(l.x - e.tx, l.y - e.ty) < WAIT_APART)) stacked++;
      }
      before = new Set(s.line.map(f => f.id));
    });
  }
  console.log(`endless removals: ${scatters} scatters, ${silent} without an event, ${stacked} on top of another waiting bird`);
  assert.ok(scatters > 100, 'the removal search sees enough scatters');
  assert.equal(silent, 0, 'every duckling that leaves the line has a drawn reason');
  assert.equal(stacked, 0, 'a scattered duckling never waits on top of another waiting duckling');
}

if (process.argv[1]?.endsWith('bots.mjs')) {
  const start = performance.now();
  if (process.argv[2] !== 'endless') campaign();
  if (process.argv[2] !== 'campaign') endless();
  console.log(`Passed in ${((performance.now() - start) / 1000).toFixed(2)}s`);
}
