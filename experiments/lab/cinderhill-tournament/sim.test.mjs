// node --test experiments/lab/cinderhill-tournament/
import test from 'node:test';
import assert from 'node:assert/strict';
import { create, step, command, play, hash, look, posture, tally, seen, CAP, WAVE, LENGTH, FULL, SAG, RING, DEAD, NEST } from './sim.js';
import { allIn, careful, patient, mirror, idle } from './pacers.js';

// Replays a game from its command log alone.
function replay(seed, sizes, log) {
  const g = create(seed, { a: { ants: sizes[0] }, b: { ants: sizes[1] } });
  let k = 0;
  while (!g.over) {
    while (k < log.length && log[k][0] === g.t) { command(g, log[k][1], log[k][2]); k++; }
    step(g);
  }
  return g;
}

test('same seed and same pacers give the same game, tick for tick', () => {
  for (const seed of [1, 7, 4242]) {
    const a = play(seed, careful, allIn, { a: 60, b: 120 }), b = play(seed, careful, allIn, { a: 60, b: 120 });
    assert.equal(hash(a), hash(b));
    assert.deepEqual(a.over, b.over);
  }
});

test('a game replays from its command log alone', () => {
  for (const seed of [3, 99, 12345]) {
    const g = play(seed, patient, mirror, { a: 90, b: 60 });
    const r = replay(seed, [90, 60], g.log);
    assert.equal(hash(r), hash(g), `seed ${seed}`);
    assert.deepEqual(r.over, g.over);
  }
});

test('different seeds give different colonies', () => {
  const hs = new Set([1, 2, 3, 4, 5].map(s => hash(create(s, { a: { ants: 60 }, b: { ants: 60 } }))));
  assert.equal(hs.size, 5);
});

test(`the ring never holds more than ${CAP} ants of a side, whatever the pacer`, () => {
  for (const [pa, pb] of [[allIn, allIn], [careful, allIn], [patient, careful]]) {
    const g = create(11, { a: { ants: 120 }, b: { ants: 120 } }), minds = [pa(), pb()];
    while (!g.over) {
      for (const side of [0, 1]) { const v = minds[side](seen(g, side)); if (v) command(g, side, v); }
      step(g);
      for (const side of [0, 1]) assert.ok(tally(g, side).ring <= CAP, `t ${g.t}: ${tally(g, side).ring}`);
    }
  }
});

test('no ant dies in a display; only a side that breaks loses ants', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const g = play(seed, careful, allIn, { a: 60, b: 120 });
    const dead = g.sides.map(s => s.dead);
    if (!g.over.broke) assert.deepEqual(dead, [0, 0], `seed ${seed}`);
    else { assert.equal(dead[g.over.winner], 0); assert.ok(dead[1 - g.over.winner] <= 6); }
  }
});

test('a contest ends by the time limit at the latest', () => {
  const g = play(5, idle, idle, { a: 60, b: 60 });
  assert.ok(g.over.t <= LENGTH);
});

test('fresh ants stand taller; spent ants crouch; a new arrival stilts', () => {
  assert.ok(posture(FULL, 100) > posture(600, 100));
  assert.ok(posture(600, 100) > posture(SAG, 100));
  assert.ok(posture(SAG, 100) > posture(SAG - 1, 100));
  assert.ok(posture(800, 0) > posture(800, 100));
});

test('look splits the show into count and freshness that add up', () => {
  const g = create(8, { a: { ants: 60 }, b: { ants: 60 } });
  command(g, 0, 'send');
  for (let i = 0; i < 40; i++) step(g);
  const l = look(g, 0);
  assert.equal(l.n, WAVE);
  assert.equal(l.count + l.fresh, l.total);
});

// The same opening as the test below, without the rotation, up to tick t.
function replay21(t) {
  const g = create(21, { a: { ants: 60 }, b: { ants: 60 } });
  command(g, 0, 'send'); command(g, 0, 'hold');
  for (let i = 0; i < 30; i++) step(g);
  for (let w = 0; w < 3; w++) { command(g, 0, 'send'); command(g, 1, 'send'); }
  while (g.t < t) step(g);
  return g;
}

test('send walks the freshest wave out; hold turns it home; rotate swaps without emptying the ring', () => {
  const g = create(21, { a: { ants: 60 }, b: { ants: 60 } });
  assert.equal(command(g, 0, 'send'), true);
  assert.equal(tally(g, 0).out, WAVE);
  assert.equal(command(g, 0, 'hold'), true);
  assert.equal(tally(g, 0).out, 0);
  for (let i = 0; i < 30; i++) step(g);
  assert.equal(tally(g, 0).nest, 60);
  for (let w = 0; w < 3; w++) { command(g, 0, 'send'); command(g, 1, 'send'); } // both sides, so neither breaks
  for (let i = 0; i < 120; i++) step(g);
  assert.equal(tally(g, 0).ring, CAP);
  const control = replay21(g.t);
  command(g, 0, 'rotate');
  let low = CAP;
  for (let i = 0; i < 60; i++) { step(g); step(control); low = Math.min(low, tally(g, 0).ring); }
  assert.equal(low, CAP, 'the ring stays full through a rotation');
  assert.equal(g.over, null); assert.equal(control.over, null);
  assert.ok(tally(g, 0).ringFresh > tally(control, 0).ringFresh + 100, 'and is fresher than without it');
});

test('rotate with nobody home pulls the tired out at once', () => {
  const g = create(22, { a: { ants: 30 }, b: { ants: 30 } });
  for (let w = 0; w < 3; w++) command(g, 0, 'send');
  for (let i = 0; i < 60; i++) step(g);
  assert.equal(tally(g, 0).nest, 0);
  command(g, 0, 'rotate');
  assert.equal(tally(g, 0).ring, CAP - WAVE);
});

test('the state stays integer', () => {
  const g = play(77, careful, patient, { a: 60, b: 90 });
  assert.ok(Number.isInteger(g.tug));
  for (const s of g.sides) for (const arr of [s.stam, s.size, s.timer]) for (const x of arr) assert.ok(Number.isInteger(x));
});
