import assert from 'node:assert/strict';
import { create, step, DT, LEVELS, MIN_POSE_TIME, PHOTO_TIME, starsFor } from './sim.js';

const mutate = process.argv.includes('--mutate');
const start = (seed, level = 0) => create(seed, level, { mutate });
const advance = (state, input, frames) => {
  for (let frame = 0; frame < frames; frame++) state = step(state, input);
  return state;
};

// Behavioral examples fixed independently of the bot policies and rule evaluator.
// This is also the mutation sentinel: accepting an opposite face must fail.
let wrong = advance(start(7), { x: -0.8, y: 0.8, active: true }, 240);
assert.equal(wrong.shots.length, 0, 'An opposite face must never trigger the shutter');
assert.equal(wrong.phase, 'play');
let idle = advance(start(7), {}, 1300);
assert.equal(idle.phase, 'lost', 'Doing nothing must lose');
assert.equal(idle.shots.length, 0);
let released = advance(start(7), { x: 0.55, y: -0.5, active: false }, 1300);
assert.equal(released.phase, 'lost', 'A correct released face must not capture');
assert.equal(released.shots.length, 0);
let early = advance(start(7), { x: 0.55, y: -0.5, active: true }, 179);
assert.equal(early.shots.length, 0, 'The shutter must wait three seconds');
early = step(early, { x: 0.55, y: -0.5, active: true });
assert.equal(early.shots.length, 1);
assert.equal(early.score, 100);
assert.ok(Math.abs(early.elapsed - 3) < 1e-8);
const photoElapsed = early.elapsed;
early = advance(early, {}, 38);
assert.equal(early.phase, 'photo');
assert.equal(early.elapsed, photoElapsed, 'Photo time does not consume the level clock');
early = step(early, {});
assert.equal(early.phase, 'play');
assert.equal(early.index, 1);
assert.equal(early.age, 0);

// Level 4 has a literal 0.10 boundary. One axis outside is enough to reject.
let boundary = advance(start(9, 3), { x: 0.65, y: -0.6, active: true }, 180);
assert.equal(boundary.shots.length, 1, 'The inclusive square boundary must match');
let outside = advance(start(9, 3), { x: 0.6501, y: -0.5, active: true }, 240);
assert.equal(outside.shots.length, 0, 'Outside one axis must reject');
let interrupted = advance(start(9, 3), { x: 0.55, y: -0.5, active: true }, 170);
interrupted = step(interrupted, { x: 0.55, y: -0.5, active: false });
interrupted = advance(interrupted, { x: 0.55, y: -0.5, active: true }, 65);
assert.equal(interrupted.shots.length, 0, 'Releasing resets the uninterrupted hold');
interrupted = step(interrupted, { x: 0.55, y: -0.5, active: true });
assert.equal(interrupted.shots.length, 1);
assert.equal(starsFor({level:0,phase:'lost',elapsed:5}),0);
assert.equal(starsFor({level:0,phase:'won',elapsed:13.9}),3);
assert.equal(starsFor({level:0,phase:'won',elapsed:14}),2);
assert.equal(starsFor({level:0,phase:'won',elapsed:18}),1);
const original = start(123);
const originalJSON = JSON.stringify(original);
const clamped = step(original, { x: 5, y: -5, active: true });
assert.equal(clamped.x, 1);
assert.equal(clamped.y, -1);
assert.equal(JSON.stringify(original), originalJSON, 'step must not mutate its input');
assert.notEqual(clamped, original);
let a = start(321, 2), b = start(321, 2);
for (let frame = 0; frame < 2400; frame++) {
  const input = { x: Math.sin(frame / 23), y: Math.cos(frame / 17), active: frame % 13 !== 0 };
  a = step(a, input); b = step(b, input);
  assert.deepEqual(a, b, 'Repeated seeded runs must be identical');
}
assert.notDeepEqual(create(1).targets, create(2).targets, 'Seeds must vary later poses');

// Independent policy PRNG (Park-Miller), unrelated to the simulation generator.
function policyRandom(seed) {
  let value = ((seed + 41) * 48271) % 2147483647;
  return () => { value = value * 16807 % 2147483647; return value / 2147483647; };
}
function clumsyPolicy(seed) {
  const random = policyRandom(seed);
  const gaussian = () => Math.sqrt(-2 * Math.log(Math.max(1e-12, random()))) * Math.cos(2 * Math.PI * random());
  let index = -1, biasX = 0, biasY = 0, poseTime = 0;
  return state => {
    if (state.index !== index) {
      index = state.index; poseTime = 0;
      biasX = gaussian() * 0.10; biasY = gaussian() * 0.10;
    }
    if (state.phase !== 'play') return {};
    poseTime += DT;
    const target = state.targets[state.index];
    return {
      x: target.x + biasX + 0.015 * Math.sin(poseTime * 7),
      y: target.y + biasY + 0.015 * Math.cos(poseTime * 9),
      active: poseTime >= 0.5,
    };
  };
}
function carefulPolicy() {
  let index = -1, poseTime = 0;
  return state => {
    if (state.index !== index) { index = state.index; poseTime = 0; }
    if (state.phase !== 'play') return {};
    poseTime += DT;
    return { ...state.targets[state.index], active: poseTime >= 0.25 };
  };
}
function run(seed, level, policyFactory) {
  let state = start(seed, level);
  const policy = policyFactory(seed);
  let wall = 0;
  while (state.phase !== 'won' && state.phase !== 'lost' && wall < 60) {
    state = step(state, policy(state)); wall += DT;
  }
  assert.ok(state.phase === 'won' || state.phase === 'lost', 'Each run must terminate');
  return { won: state.phase === 'won', elapsed: state.elapsed, wall, shots: state.shots.length };
}
const results = [];
for (let level = 0; level < LEVELS.length; level++) {
  const careful = [], clumsy = [];
  for (let seed = 1; seed <= 200; seed++) {
    const state = start(seed, level);
    assert.equal(state.targets.length, [3, 4, 5, 6][level]);
    for (const target of state.targets) assert.ok(Math.abs(target.x) <= 0.8 && Math.abs(target.y) <= 0.8);
    careful.push(run(seed, level, carefulPolicy));
    clumsy.push(run(seed, level, clumsyPolicy));
  }
  assert.equal(careful.filter(run => run.won).length, 200, 'Careful play must win every seed');
  for (const result of careful) {
    assert.equal(result.shots, [3, 4, 5, 6][level]);
    assert.ok(Math.abs(result.elapsed - [9, 12, 15, 18][level]) < 1e-7);
    assert.ok(Math.abs(result.wall - [10.95, 14.6, 18.25, 21.9][level]) < 1e-7);
  }
  const wins = clumsy.filter(run => run.won);
  const average = (runs, key) => runs.length ? +(runs.reduce((sum, run) => sum + run[key], 0) / runs.length).toFixed(3) : null;
  results.push({
    level: level + 1, seeds: 200, carefulWins: 200, clumsyWins: wins.length,
    clumsySuccessPercent: wins.length / 2,
    carefulPlaySeconds: average(careful, 'elapsed'), carefulWallSeconds: average(careful, 'wall'),
    clumsyMeanPlaySeconds: average(clumsy, 'elapsed'), clumsyWinWallSeconds: average(wins, 'wall'),
  });
}
assert.ok(results[0].clumsySuccessPercent >= 95, 'First level must accept at least 95% of the fixed clumsy policy');
for (let i = 1; i < results.length; i++) assert.ok(results[i].clumsyWins < results[i - 1].clumsyWins, 'Clumsy success must strictly decrease');
assert.equal(MIN_POSE_TIME, 3);
assert.equal(PHOTO_TIME, 0.65);
console.table(results);
console.log('PASS: 1,600 seeded bot runs; independent behavioral examples; deterministic pure transitions.');
