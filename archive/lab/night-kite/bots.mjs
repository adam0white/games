import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = new URL('./sim.js', import.meta.url);
let simulation = await import(source);
if (process.argv.includes('--mutate')) {
  const original = 'drag.x + lift.x + nx * s.tension';
  const reversed = 'drag.x + lift.x - nx * s.tension';
  const code = await readFile(source, 'utf8');
  assert.ok(code.includes(original), 'mutation target exists');
  simulation = await import('data:text/javascript;base64,' + Buffer.from(code.replace(original, reversed)).toString('base64'));
}

const { createFlight, step, windAt, aerodynamics, flightConditions, ROOF } = simulation;
const seeds = [1, 7, 42, 171, 193, 251, 7109, 65537, 1000003, 4294967295];

function steer(s) {
  const { goal } = s;
  return { x: goal.x, y: 520 - (488 - goal.y - 8 - 120) / 0.62 };
}

function run(level, seed, seconds, control, stop = () => false) {
  const s = createFlight(level, seed);
  for (let frame = 0; frame < seconds * 60 && s.status === 'play' && !stop(s); frame++) {
    step(s, control(s));
    const { x, y, vx, vy, angle, spin } = s.kite;
    assert.ok([x, y, vx, vy, angle, spin, s.tension].every(Number.isFinite), 'flight stays finite');
    assert.ok(s.tension >= 0, 'line cannot push');
  }
  return s;
}

const still = { x: 0, y: 0, z: 0 };
assert.deepEqual(aerodynamics(0, 0, 0, 0), { drag: still, lift: still });
const flow = windAt(createFlight(1, 171), 180, 308);
const { drag, lift } = aerodynamics(0, 0, flow.z, 0);
assert.ok(lift.y < -112, 'ordinary horizontal wind supports the kite at trim');
assert.equal(drag.y, 0, 'horizontal wind has no vertical drag at rest');
assert.ok(drag.z > 0, 'drag applies downwind');
const oblique = { x: 27, y: -18, z: 124 };
const banked = aerodynamics(oblique.x, oblique.y, oblique.z, 0.3);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
assert.ok(Math.abs(dot(oblique, banked.lift)) < 1e-9, 'lift remains perpendicular to the relative wind');
assert.ok(dot(oblique, banked.drag) > 0, 'drag adds downwind momentum');
assert.ok(banked.lift.x > 0, 'positive bank redirects lift to the right');

const opening = run(1, 171, 3, () => ({ x: 245, y: 399 }));
assert.equal(opening.status, 'won', 'first gesture reaches the bird ring');
assert.equal(opening.done, 1);
assert.equal(run(1, 171, 120, () => null).done, 0, 'idle never scores');
assert.equal(run(1, 171, 120, () => null).status, 'play', 'idle flight survives without a deadline');

const figures = [];
for (let level = 1; level <= 10; level++) {
  const runs = seeds.map(seed => run(level, seed, 45, steer));
  const wins = runs.filter(s => s.status === 'won');
  const failures = runs.filter(s => s.status !== 'won').map(s => `${s.seed}:${s.status}/${s.done}`);
  assert.equal(wins.length, runs.length, `level ${level} failures: ${failures.join(', ')}`);
  figures.push(Math.max(...wins.map(s => s.t)).toFixed(2));
}

const pickup = run(3, 171, 10, steer, s => s.goal.carrying);
assert.equal(pickup.goal.carrying, true);
assert.equal(pickup.done, 0);
assert.deepEqual({ x: pickup.goal.x, y: pickup.goal.y }, ROOF);
assert.ok(pickup.kite.y > ROOF.y, 'the lantern is picked up below the roof');

const squall = run(5, 171, 10, steer, s => s.goal.progress >= 0.2);
assert.equal(squall.done, 0, 'contact alone does not clear a squall');
for (let i = 0; i < 90; i++) step(squall, { x: 34, y: 465 });
assert.equal(squall.goal.progress, 0, 'squall progress drains on leaving the pocket');
assert.equal(run(5, 171, 15, () => ({ x: 34, y: 465 })).status, 'lost', 'staying outside a squall loses');

const longRuns = seeds.map(seed => run(0, seed, 120, steer, s => s.done === 12));
assert.ok(longRuns.every(s => s.done === 12 && s.status === 'play'), 'endless yields twelve successive goals for each seed');
const expired = run(0, 171, 30, () => null);
assert.equal(expired.status, 'lost', 'endless ends if its goal expires');
assert.equal(flightConditions(expired).remaining, 0);
assert.equal(flightConditions(opening).remaining, null);
assert.deepEqual(longRuns[3], run(0, 171, 120, steer, s => s.done === 12));
assert.notDeepEqual(windAt(createFlight(8, 1), 200, 190), windAt(createFlight(8, 7), 200, 190));

console.log(`Opening gesture: ${Math.round(opening.t * 60)} ticks. Campaign: 100/100, max seconds per level ${figures.join(', ')}.`);
console.log(`Endless: 12 goals across each of ${longRuns.length} seeds, scores ${longRuns.map(s => s.score).join(', ')}.`);

const campaign = Array.from({ length: 10 }, (_, i) => run(i + 1, 171 + i * 157, 45, steer));
assert.ok(campaign.every(flight => flight.status === 'won'), 'every campaign flight on its built-in seed is reachable');

const nearby = [];
for (const dx of [-20, -10, 0, 10, 20]) {
  for (const dy of [-32, -16, 0, 16, 32]) {
    nearby.push(run(1, 171, 10, () => ({ x: 245 + dx, y: 399 + dy })));
  }
}
const nearbyWins = nearby.filter(flight => flight.status === 'won');
assert.ok(nearbyWins.length >= 20, 'opening tolerates imprecise gestures across the sample grid');
console.log('Built-in campaign seconds: ' + campaign.map(flight => flight.t.toFixed(2)).join(', ') + '.');
console.log('Nearby opening endpoints: ' + nearbyWins.length + '/25; slowest win ' +
  Math.max(...nearbyWins.map(flight => flight.t)).toFixed(2) + ' s.');
