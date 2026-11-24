// node bots.mjs [runs] [--mutate]
// --mutate deliberately reverses each left/right tap. It must fail the directional
// contract and measured play checks. No upstream river rule is changed or copied.
import assert from 'node:assert/strict';
import { create, step, centre, half, sight, speed, nightPace, progress, createControl, tap, release, advanceControl, TAP_STEP, HOLD_DELAY, HOLD_REPEAT } from './sim.js';

const RUNS = Number(process.argv.find(x => /^\d+$/.test(x)) || 200);
const mutated = process.argv.includes('--mutate');
let failures = 0;
const check = (ok, text) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${text}`); if (!ok) failures++; };
const press = (c, side) => tap(c, mutated ? -side : side);

// The 2D game's exact careful policy, transcribed from ../../lantern/bots.mjs steer(s,false).
// It sees only rocks within sight(), ignores embers, and samples 25 possible targets.
function careful(s) {
  const see = sight(s), c = centre(s, s.y + 0.2), h = half(s, s.y + 0.2);
  let best = s.x, bestScore = -Infinity;
  for (let i = 0; i <= 24; i++) {
    const x = c - h + 0.04 + (2 * h - 0.08) * i / 24;
    let score = -Math.abs(x - s.x) * 0.6 - Math.abs(x - c) * 0.3;
    for (const k of s.rocks) { const dy = k.y - s.y; if (dy > -0.03 && dy < see) { const gap = Math.max(0, Math.abs(k.x - x) - k.len) - k.rad - 0.03; if (gap < 0.03) score -= (0.03 - gap) * 60 / (0.15 + dy); } }
    if (score > bestScore) { bestScore = score; best = x; }
  }
  return best;
}
// An expert may anticipate a moving rock's position when it reaches the bow,
// and seek visible embers once the collision penalty has ruled out unsafe routes.
function expert(s, control) {
  const c = centre(s, s.y + 0.2), h = half(s, s.y + 0.2), v = speed(s);
  let best = control.target, high = -Infinity;
  for (let i = -22; i <= 22; i++) {
    const x = control.target + i * TAP_STEP;
    if (x < c - h + 0.035 || x > c + h - 0.035) continue;
    let val = -Math.abs(x - s.x) * 0.35 - Math.abs(x - c) * 0.15;
    for (const k of s.rocks) {
      const dy = k.y - s.y;
      if (dy < -0.04 || dy > sight(s)) continue;
      const t = Math.max(0, dy / Math.max(0.1, v - (k.vy || 0)));
      const kx = k.a ? k.x0 + k.a * Math.sin((s.t + t) * k.w + k.ph) : k.x;
      const bx = s.x + Math.max(-0.95 * nightPace(s.stage) * t, Math.min(0.95 * nightPace(s.stage) * t, x - s.x));
      const gap = Math.max(0, Math.abs(kx - bx) - k.len) - k.rad - 0.022;
      if (gap < 0.025) val -= (0.025 - gap) * 120 / (0.12 + dy);
    }
    for (const e of [...s.embers, ...s.powers]) {
      const dy = e.y - s.y;
      if (e.got || dy <= 0 || dy > sight(s) || e.kind === 'wisp') continue;
      const reward = e.kind === 'ember' ? 0.3 + 1.8 * (1 - s.light) : 0.8;
      val += Math.max(0, 0.085 - Math.abs(e.x - x)) * reward / (0.15 + dy);
    }
    if (val > high) { high = val; best = x; }
  }
  return best;
}
const seeded = seed => { let a = seed >>> 0; return () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; }; };

function run(seed, night, policy, trace = false) {
  const s = create(seed, night), c = createControl(s.x), r = seeded(seed ^ 0x71eb3), log = [];
  const cadence = policy === 'clumsy' ? 9 : 1;
  let decisions = 0, aim = s.x;
  for (let tick = 0; tick < 60 * 240 && !s.over; tick++) {
    let target, input = 0;
    if (policy === '2d') target = careful(s);
    else {
      // Clumsy sees a new target only every 150 ms, then executes its old
      // correction, with at most ten motor taps a second. Its observation is stale.
      if (tick % cadence === 0) aim = (policy === 'expert' ? expert(s, c) : careful(s)) + (policy === 'clumsy' ? (r() - 0.5) * 0.012 : 0);
      if (policy !== 'clumsy' || tick % 6 === 0) {
        const error = aim - c.target;
        if (Math.abs(error) > TAP_STEP * 0.47) {
          let side = Math.sign(error);
          if (policy !== 'clumsy' || r() > 0.025) {
            if (policy === 'clumsy' && r() < 0.005) side = -side;
            press(c, side); release(c); decisions++; input = side;
          }
        }
      }
      target = advanceControl(c);
    }
    step(s, target);
    if (trace) log.push([input, target, s.x, s.y, s.light, [...s.events]]);
  }
  assert.ok(s.over, 'a story run ends inside four minutes');
  return { end: s.over, distance: progress(s), seconds: s.t, taps: decisions, state: JSON.stringify(s), log };
}

// Independent input contracts: direction, exact displacement, boundary, delay and release.
{
  const c = createControl(0.5); press(c, -1);
  check(Math.abs(c.target - (0.5 - TAP_STEP)) < 1e-12, 'left tap subtracts exactly TAP_STEP');
  press(c, 1);
  check(Math.abs(c.target - 0.5) < 1e-12, 'opposite tap restores the target');
  release(c);
  const held = createControl(0.5); tap(held, 1); advanceControl(held, 1, HOLD_DELAY - 1);
  check(Math.abs(held.target - (0.5 + TAP_STEP)) < 1e-12, 'hold does not repeat before 200 ms');
  advanceControl(held);
  check(Math.abs(held.target - (0.5 + TAP_STEP * 2)) < 1e-12, 'hold repeats at 200 ms');
  advanceControl(held, 1, HOLD_REPEAT);
  check(Math.abs(held.target - (0.5 + TAP_STEP * 3)) < 1e-12, 'hold repeats every two ticks');
  release(held); const x = held.target; advanceControl(held, 0, 120);
  check(held.target === x, 'release stops repeated steps and keeps the target');
  const edge = createControl(0.999); tap(edge, 1); advanceControl(edge, 1, 120);
  check(edge.target === 1, 'target clamps at the screen boundary');
}

const baseline = [], tapNight = [], clumsy = new Map();
for (let seed = 1; seed <= RUNS; seed++) {
  baseline.push(run(seed, 1, '2d'));
  tapNight.push(run(seed, 1, 'tap'));
}
const summary = list => ({ dawn: list.filter(s => s.end === 'dawn').length, distance: list.reduce((n, s) => n + s.distance, 0) / list.length, seconds: list.reduce((n, s) => n + s.seconds, 0) / list.length, taps: list.reduce((n, s) => n + s.taps, 0) / list.length });
const a = summary(baseline), b = summary(tapNight);
console.log(`NIGHT 1 2D careful: ${a.dawn}/${RUNS} dawn; tap careful: ${b.dawn}/${RUNS} dawn; mean distance ${(100*b.distance).toFixed(1)}%; mean time ${b.seconds.toFixed(1)}s; mean taps ${b.taps.toFixed(1)}`);
// A ten percentage point tolerance is set before measurement, not an equality
// requirement: target quantization changes trajectories, pickups and moving hazards.
check(b.dawn >= a.dawn - Math.ceil(RUNS * 0.10), 'night 1 tap success is within 10 percentage points of 2D careful');
check(b.dawn > 0, 'careful tap policy reaches dawn on night 1');

for (const night of [1, 3, 8, 20, 50]) {
  const list = [];
  for (let seed = 1; seed <= RUNS; seed++) list.push(run(seed, night, 'clumsy'));
  const s = summary(list); clumsy.set(night, s);
  console.log(`CLUMSY night ${night}: ${s.dawn}/${RUNS} dawn; mean distance ${(100*s.distance).toFixed(1)}%; mean time ${s.seconds.toFixed(1)}s`);
}
check(clumsy.get(1).dawn > 0, 'clumsy tap policy finishes night 1');
const stages = [...clumsy.values()];
check(stages.every((s, i) => !i || s.dawn <= stages[i - 1].dawn), 'clumsy dawn rate does not rise across nights 1, 3, 8, 20, 50');
check(stages[0].dawn > stages[1].dawn && stages[0].distance > stages.at(-1).distance, 'later nights reduce clumsy success and distance');

// Every inherited story night is measured. The unchanged river's existing careful
// policy is not a proof that every night is beatable with this control.
const coverage = [];
if (!mutated) for (let night = 1; night <= 50; night++) {
  let winner = null, attempts = 0;
  for (const [policy, limit] of [['tap', 20], ['expert', 200]]) {
    for (let seed = 1; seed <= limit && !winner; seed++) {
      const s = run(seed, night, policy); attempts++;
      if (s.end === 'dawn') winner = { night, seed, policy, seconds: s.seconds, attempts };
    }
    if (winner) break;
  }
  coverage.push(winner);
  console.log(`NATURAL DAWN night ${night}: ${winner ? `${winner.policy} seed ${winner.seed}, ${winner.seconds.toFixed(1)}s, ${winner.attempts} attempts` : 'not demonstrated'}`);
}
if (!mutated) check(coverage.length === 50 && coverage.every(Boolean), 'a careful tap policy reaches a natural dawn on every offered night (50/50)');
const won = tapNight.filter(s => s.end === 'dawn');
if (won.length) console.log(`NIGHT 1 dawn run length: ${Math.min(...won.map(s => s.seconds)).toFixed(1)}-${Math.max(...won.map(s => s.seconds)).toFixed(1)}s; careful cap60 taps/s in bursts, clumsy cap10 taps/s with150ms observations.`);

// The control and complete sim state/event trace must replay bit-for-bit.
const d1 = run(88, 3, 'tap', true), d2 = run(88, 3, 'tap', true);
check(d1.state === d2.state && JSON.stringify(d1.log) === JSON.stringify(d2.log), `same seeded policy produces the same input and event trace (${d1.log.length} ticks)`);
const replay = create(88, 3), replayControl = createControl(replay.x), replayLog = [];
for (const [input] of d1.log) {
  if (input) { press(replayControl, input); release(replayControl); }
  const target = advanceControl(replayControl); step(replay, target);
  replayLog.push([input, target, replay.x, replay.y, replay.light, [...replay.events]]);
}
check(JSON.stringify(replay) === d1.state && JSON.stringify(replayLog) === JSON.stringify(d1.log), 'recorded tap inputs independently replay the complete state and events');
const d3 = run(89, 3, 'tap');
check(d1.state !== d3.state, 'different river seeds produce different runs');
console.log(`${failures ? 'FAILED' : 'All checks passed'}${mutated ? ' (deliberately reversed tap mutation)' : ''}; ${failures} failures`);
process.exitCode = failures ? 1 : 0;
