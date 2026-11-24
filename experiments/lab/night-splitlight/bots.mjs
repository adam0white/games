import assert from 'node:assert/strict';
import { BANDS, CENTER, distanceAngle, expose, makePlate, optics, PLATES, RAIL, transmit, turn } from './sim.js';

const mutate = process.argv.includes('--mutate');
const trace = state => optics(state, mutate ? BANDS.map(() => 1.52) : BANDS);
const near = (a, b, eps = 1e-8) => assert.ok(Math.abs(a - b) < eps, a + ' differs from ' + b);
const hold = (s, dial, seconds) => {
  turn(s, dial);
  const field = trace(s);
  for (let i = 0; i < Math.round(60 * seconds); i++) expose(s, field, 1 / 60);
};

// Reference cases: normal incidence, 30° air-to-glass, 50° glass-to-air.
const normal = transmit(1, 0, -1, 0, 1 / 1.5);
near(normal.dx, 1); near(normal.dy, 0);
const thirty = transmit(Math.sqrt(3) / 2, .5, -1, 0, 1 / 1.5);
near(thirty.dy, 1 / 3);
near(thirty.dx, Math.sqrt(8 / 9));
const incident = 50 * Math.PI / 180;
const internal = transmit(Math.cos(incident), Math.sin(incident), -1, 0, 1.5);
assert.ok(internal.reflected);
near(internal.dx, -Math.cos(incident)); near(internal.dy, Math.sin(incident));

const first = makePlate(1, 1);
const opening = trace(first).rays;
const separation = distanceAngle(opening[0].angle, opening[5].angle) * 180 / Math.PI;
console.log('Opening red to violet separation:', separation.toFixed(2), 'degrees');
assert.ok(separation > 45, 'the first prism must transmit red and internally reflect violet onto a different part of the rail');
assert.ok(opening[5].points.length > opening[0].points.length);
for (let i = 0; i < 3600; i++) expose(first, { rays: opening }, 1 / 60);
assert.equal(first.elapsed, 0);
assert.equal(first.targets[0].charge, 0);

let raysChecked = 0;
for (let level = 1; level <= PLATES.length; level++) {
  const s = makePlate(level, 941);
  for (let sample = 0; sample <= 1000; sample++) {
    turn(s, sample / 1000);
    const result = trace(s);
    for (const ray of result.rays) {
      assert.ok(ray.points.length >= 4 && Number.isFinite(ray.angle));
      const end = ray.points.at(-1);
      near(Math.hypot(end.x - CENTER.x, end.y - CENTER.y), RAIL);
      for (const hit of ray.points.slice(1, -1)) {
        // Distance sum equals edge length only when the point lies on that segment.
        assert.ok(result.vertices.some((a, i, v) => {
          const b = v[(i + 1) % v.length];
          return Math.hypot(hit.x - a.x, hit.y - a.y) + Math.hypot(hit.x - b.x, hit.y - b.y)
            - Math.hypot(a.x - b.x, a.y - b.y) < 1e-7;
        }), 'each glass contact lies on a real facet');
      }
      raysChecked++;
    }
  }
}

// Read the visible rays and receivers. Stop at the first sampled position
// that puts each requested wavelength inside the actual opening.
function visibleSweep(s) {
  let stops = 0;
  for (let sample = 0; sample <= 200 && !s.won; sample++) {
    turn(s, sample / 200);
    const field = trace(s);
    const fits = s.targets.some(t => !t.lit && field.rays.every(ray =>
      (t.band >= 0 && ray.band !== t.band) || distanceAngle(ray.angle, t.angle) < t.width));
    if (fits) stops++;
    for (let i = 0; i < (fits ? 28 : 1); i++) expose(s, field, 1 / 60);
  }
  return stops;
}
function movingSweep(s) {
  // One smooth two-second sweep, then rest the dial at its right stop.
  for (let i = 0; i <= 120; i++) {
    turn(s, i / 120);
    expose(s, trace(s), 1 / 60);
  }
  hold(s, 1, 1);
}

let aimed = 0, moving = 0, openings = 0;
for (let level = 1; level <= PLATES.length; level++) {
  const times = [], stops = [];
  let sweepWins = 0;
  for (const seed of [0x51e17 + level * 97, ...Array.from({ length: 48 }, (_, i) => (i + 1) * 7919)]) {
    const s = makePlate(level, seed);
    const same = makePlate(level, seed);
    assert.deepEqual(same, s);
    for (let i = 0; i < s.targets.length; i++) {
      for (let j = i + 1; j < s.targets.length; j++) {
        const a = s.targets[i], b = s.targets[j];
        assert.ok(distanceAngle(a.angle, b.angle) > a.width + b.width, 'receiver openings cannot overlap: ' + [level, seed, i, j]);
      }
    }
    stops.push(visibleSweep(s));
    visibleSweep(same);
    assert.deepEqual(same, s, 'same seed and gestures reproduce the exposure');
    assert.ok(s.won, 'visible sweep reaches every receiver: ' + [level, seed]);
    aimed++;
    times.push(s.elapsed);
    const fast = makePlate(level, seed);
    movingSweep(fast);
    if (fast.won) { sweepWins++; moving++; }
    if (level === 1) {
      for (const dial of [.45, .60, .79, 1]) {
        const beginner = makePlate(1, seed);
        hold(beginner, dial, 1);
        assert.ok(beginner.won && beginner.elapsed < 60, 'one coarse rightward move clears the opening');
        openings++;
      }
    }
  }
  console.log(PLATES[level - 1].name, '49/49; stops', Math.min(...stops), '-', Math.max(...stops),
    '; aimed seconds', Math.min(...times).toFixed(2), '-', Math.max(...times).toFixed(2), '; moving', sweepWins, '/49');
}

const interrupted = makePlate(1, 3);
hold(interrupted, .79, .2);
assert.ok(interrupted.targets[0].charge > 0 && !interrupted.won);
hold(interrupted, .08, 1);
assert.equal(interrupted.targets[0].charge, 0);
hold(interrupted, .79, .5);
assert.ok(interrupted.won);
const won = structuredClone(interrupted);
hold(interrupted, .1, .8);
assert.deepEqual(interrupted, won);

const wrong = makePlate(2, 3);
turn(wrong, .55);
const wrongField = trace(wrong);
for (const ray of wrongField.rays) ray.angle = wrong.targets[0].angle + (ray.band === 0 ? Math.PI : 0);
expose(wrong, wrongField, 1);
assert.equal(wrong.targets[0].charge, 0, 'other wavelengths cannot expose a red receiver');
console.log({ raysChecked, aimed, moving, openings });
