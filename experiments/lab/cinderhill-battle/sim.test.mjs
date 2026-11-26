import assert from 'node:assert/strict';
import test from 'node:test';
import { areas, cell, col, row, command, create, LENGTH, play, replay, route, step, through, UNSEAL } from './sim.js';
import { march, readFront, RIVALS } from './pacers.js';

const trail = points => ({ type: 'trail', points });
const tick = (g, n) => { for (let i = 0; i < n; i++) step(g); };
const result = g => ({ map: g.map.rows, t: g.t, sides: g.sides, pins: g.pins, over: g.over, log: g.log });

test('the seed fixes terrain, attrition, and the result', () => {
  const minds = [readFront, RIVALS.leafstitchers.mind];
  assert.deepEqual(result(play(34821, minds)), result(play(34821, minds)));
  const terrains = new Set(Array.from({ length: 20 }, (_, i) => create(i).map.rows.join('')));
  assert.ok(terrains.size >= 3, 'seeds vary the gap and tunnel location');
});

test('serialized log replays both sides and every verb without a pacer', () => {
  const g = create(93);
  const [home] = g.map.queens, spot = cell(7, 13);
  command(g, 0, trail([home, -1, home, spot]));
  command(g, 1, trail(through(g, 1, 1)));
  tick(g, 28);
  command(g, 0, { type: 'alarm', spot });
  tick(g, 112);
  command(g, 0, { type: 'quiet' });
  command(g, 0, { type: 'recall' });
  tick(g, 40);
  command(g, 0, trail(through(g, 0, 1)));
  tick(g, LENGTH);
  assert.deepEqual(g.log[0].points, [home, spot]);
  assert.deepEqual(result(replay(g.seed, JSON.parse(JSON.stringify(g.log)))), result(g));
});

test('paths cross each seeded passage and traverse only linked cells', () => {
  for (const seed of [1, 3, 9, 23]) {
    const g = create(seed);
    for (const lane of [0, 1, 2]) {
      const [home, goal] = g.map.queens;
      const path = route(g, home, through(g, 0, lane));
      assert.equal(path.at(-1), goal);
      assert.ok(path.slice(1).every((p, i) => g.map.links[path[i]].includes(p)));
      const middle = path.find(p => row(p) === 10);
      assert.equal(g.map.rows[middle], lane + 1);
    }
  }
});

test('Alarm waves favor majors and stop recruiting on release; Recall returns remaining troops', () => {
  const g = create(12);
  const spot = cell(8, 13), ants = g.sides[0].ants;
  const guards = () => ants.filter(a => a.role === 'guard');
  command(g, 0, { type: 'alarm', spot });
  tick(g, 1);
  assert.equal(guards().length, 8);
  assert.ok(guards().every(a => a.caste === 1));
  tick(g, 26);
  assert.equal(guards().length, 16);
  command(g, 0, { type: 'quiet' });
  tick(g, 28);
  assert.equal(guards().length, 16);
  command(g, 0, { type: 'recall' });
  assert.equal(guards().length, 0);
  assert.equal(g.sides[0].alarm, -1);
  tick(g, 140);
  assert.ok(ants.every(a => a.role === 'home'));
});

test('ants fight across the open lane boundary within a nest apron', () => {
  const g = create(8, { armies: [[1, 0], [1, 0]] });
  for (const [side, s] of g.sides.entries()) {
    const p = cell(4 + side, 3);
    command(g, side, trail([p]));
    Object.assign(s.ants[0], { pts: p, prev: p, role: 'trail' });
  }
  tick(g, 3);
  assert.equal(g.pins.length, 1);
  assert.ok(g.sides.every(s => s.ants[0].hp < 144));
});

test('an isolated open front takes extra attackers; a two-cell gap supports two pins', () => {
  for (const lane of [0, 1]) {
    const g = create(22, { arena: lane, armies: [[0, 20], [60, 0]] });
    for (const [side, s] of g.sides.entries()) {
      const x = col(through(g, side, lane)[0]), p = cell(x, 10 - side);
      command(g, side, trail([p]));
      for (const a of s.ants) Object.assign(a, { pts: p, prev: p, role: 'trail' });
    }
    step(g);
    assert.equal(g.pins.length, lane ? 2 : 20);
    assert.equal(g.pins.reduce((count, pin) => count + pin.ants[1].length, 0), lane ? 2 : 60);
    assert.ok(areas(g)[lane].power.every(n => n > 0));
  }
});

test('20 majors hold the two-cell gap in most seeds and lose in the open', () => {
  for (const lane of [0, 1]) {
    const outcomes = [];
    for (let seed = 101; seed <= 112; seed++) for (const swapped of [false, true]) {
      const armies = [[0, 20], [60, 0]];
      if (swapped) armies.reverse();
      const g = play(seed, [march(lane), march(lane)], { arena: lane, armies });
      const majorSide = Number(swapped);
      outcomes.push(g.over.winner === majorSide ? 'win' : g.over.winner < 0 ? 'draw' : 'loss');
    }
    if (lane === 0) assert.ok(outcomes.filter(o => o === 'loss').length >= 22, outcomes.join(' '));
    else {
      assert.ok(outcomes.filter(o => o === 'win').length >= 10, outcomes.join(' '));
      assert.ok(outcomes.filter(o => o === 'loss').length <= 6, outcomes.join(' '));
    }
  }
});

test('wounds remove ants from the front and slow their return', () => {
  const g = create(19, { arena: 0, armies: [[1, 0], [2, 0]] });
  const x = col(through(g, 0, 0)[0]);
  for (const [side, s] of g.sides.entries()) {
    const p = cell(x, 10 - side);
    command(g, side, trail([p]));
    for (const a of s.ants) Object.assign(a, { pts: p, prev: p, role: 'trail' });
  }
  g.sides[0].ants[0].hp = 49;
  g.rand = () => 1;
  tick(g, 3);
  const a = g.sides[0].ants[0];
  assert.equal(a.role, 'limp');
  assert.equal(a.scars, 1);
  tick(g, 120);
  assert.equal(a.role, 'rest');
  assert.equal(a.pts, g.map.queens[0]);
});

test('full battles resolve between two and three minutes with chamber, break or time', () => {
  const reasons = new Set();
  for (const rival of Object.values(RIVALS)) for (const mind of [march(0), readFront]) {
    const g = play(5, [mind, rival.mind], { armies: [[48, 16], rival.army] });
    assert.ok(g.t >= UNSEAL && g.t <= LENGTH);
    reasons.add(g.over.reason);
  }
  assert.deepEqual(reasons, new Set(['queen', 'break', 'time']));
});
