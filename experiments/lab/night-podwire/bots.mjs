import assert from 'node:assert/strict';
import { at, BASE, cancel, COUNT, create, cueDepth, grab, LEFT, MAX_PULL, plates, pull, release, SPACING, tick } from './sim.js';

const mutate = process.argv.includes('--mutate');
// Broken coupling: erase velocity after every integrator tick. All assertions
// and input policies below also run against the unmodified integrator.
function advance(s, frames) {
  for (let n = 0; n < frames; n++) {
    tick(s);
    if (mutate) s.v.fill(0);
  }
}
function pluck(s, x, depth) {
  const y = BASE + at(s, x);
  assert.ok(grab(s, x, y));
  pull(s, y + depth - s.grip.start);
  assert.ok(release(s));
}
const quiet = create(1);
advance(quiet, 240 * 60);
assert.ok(!quiet.won && quiet.plucks === 0);
assert.equal(grab(quiet, 1, 250), false);
assert.equal(grab(quiet, 180, 150), false);
const original = quiet.u.slice();
assert.ok(grab(quiet, 180, 250));
pull(quiet, 310);
assert.equal(quiet.u[26], 60);
advance(quiet, 240);
assert.ok(!quiet.won);
cancel(quiet);
assert.deepEqual(quiet.u, original);
assert.equal(quiet.plucks, 0);
assert.ok(grab(quiet, 180, 250));
assert.equal(release(quiet), false);

const remote = create(2, 914);
const gripX = 90, mirrorX = 360 - gripX;
assert.equal(grab(remote, mirrorX, 250), false);
pluck(remote, gripX, 84);
advance(remote, 186); // First reflected peak, as predicted by string length / wave speed.
assert.ok(at(remote, mirrorX) < -58, 'the reflected crest must reach the far side');
assert.ok(at(remote, mirrorX) < at(remote, gripX) - 30, 'the crest travels away from the grip');
assert.ok(remote.won, 'wave opens a pod beyond the playable section');
assert.equal(remote.u[0], 0);
assert.equal(remote.u.at(-1), 0);
assert.equal(remote.pods[0].openedAt > 0.3, true);
const saved = remote.pods[0].openedAt;
advance(remote, 720);
assert.equal(remote.pods[0].openedAt, saved);

function play(level, seed, aimError = 0) {
  const s = create(level, seed);
  for (let turn = 0; turn < 8 && !s.won; turn++) {
    const target = s.pods.find(p => !p.open);
    const mirror = 360 - target.x + aimError;
    const candidates = s.zones.map(([lo, hi]) => Math.max(lo, Math.min(hi, mirror)));
    const grip = candidates.sort((a, b) => Math.abs(mirror - a) - Math.abs(mirror - b))[0];
    pluck(s, grip, MAX_PULL);
    for (let i = 0; i < 290 && !s.won; i++) advance(s, 1);
  }
  return s;
}
assert.deepEqual(play(3, 42), play(3, 42));
assert.notDeepEqual(create(3, 42).pods, create(3, 43).pods);
assert.equal(LEFT + (COUNT - 1) * SPACING, 336);
let wins = 0, imprecise = 0;
for (let level = 1; level <= plates.length; level++) {
  const shown = create(level, level * 417);
  const [left, right] = shown.zones[0];
  pluck(shown, (left + right) / 2, cueDepth(level));
  advance(shown, 290);
  assert.ok(shown.pods.some(p => p.open), 'copying the demonstrated gesture must open at least one pod on plate ' + level);
  const times = [], counts = new Set();
  for (let seed = 1; seed <= 32; seed++) {
    const s = play(level, seed);
    assert.ok(s.won, 'reachable level ' + level + ' seed ' + seed);
    assert.ok(s.pods.every(p => p.open && p.openedAt <= s.time));
    assert.ok(s.u.every(Number.isFinite));
    wins++;
    times.push(s.time);
    counts.add(s.plucks);
    if (play(level, seed, seed % 2 ? -15 : 15).won) imprecise++;
  }
  console.log(level, '32/32', 'seconds', Math.min(...times).toFixed(3), Math.max(...times).toFixed(3), 'plucks', [...counts].join('/'));
}
const shallow = create(1); pluck(shallow, 180, 10); advance(shallow, 720);
assert.equal(shallow.won, false, 'a shallow pluck falls short');
console.log('Solved', wins, 'of 192; with 15 world units of aim error', imprecise, 'of 192.');
