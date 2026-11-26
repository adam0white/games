// The spider (sim/spider.js) and Recall (sim.js: foragers stay in under it): when it comes, where it walks, that it
// eats ants on the surface, that Recall leaves it nothing, that a replaced trail sends it away, and that a snapshot
// taken at any tick of a visit plays on the same. Small blank maps with short days, as in days.test.mjs.
import assert from 'node:assert/strict';
import test from 'node:test';
import { CMD, EVENT, G, MAT, NEST, SURFACE, Sim, FOOD, JOB } from '../sim/sim.js';
import { SP, SPIDER } from '../sim/spider.js';
import { SLOT } from '../sim/flow.js';
import { cellAt } from '../sim/grid.js';
import { restore, snapshot } from '../sim/snapshot.js';

const T = 300;
function colony(workers = 24) {
  const s = new Sim({ seed: 7, sw: 48, sh: 48, nw: 32, nh: 24, ants: 0, blank: true, colony: 1, dayTicks: T });
  s.home = { x: 10, y: 10, w: 8, h: 4 };
  for (let y = 10; y < 14; y++) for (let x = 10; x < 18; x++) s.mat[cellAt(s.L, NEST, x, y)] = MAT.OPEN;
  for (let y = 0; y < 10; y++) s.mat[cellAt(s.L, NEST, 14, y)] = MAT.OPEN;
  const e = cellAt(s.L, SURFACE, 24, 24), top = cellAt(s.L, NEST, 14, 0);
  s.link[e] = top; s.link[top] = e;
  s.pileCell[0] = cellAt(s.L, SURFACE, 36, 24); s.pileAmount[0] = 4000; s.pileKind[0] = FOOD.SUGAR;
  s.pileCell[1] = cellAt(s.L, SURFACE, 24, 36); s.pileAmount[1] = 4000; s.pileKind[1] = FOOD.PROTEIN;
  s.startGoals(); s.rebuildFields();
  for (let k = 0; k < workers; k++) s.spawn(k % 6 === 5 ? JOB.DIG : JOB.FORAGE);
  s.g[G.SUGAR] = 400; s.g[G.PROTEIN] = 400;
  return s;
}
let id = 0;
const order = (s, o) => s.queueCommand({ tick: s.tick, id: ++id, seat: 0, ...o });
const trail = s => order(s, { type: CMD.TRAIL, layer: SURFACE, points: [25, 25, 36, 24] });
const surface = s => { let k = 0; for (let i = 0; i < s.n; i++) if (s.layer[i] === SURFACE) k++; return k; };
/** Steps to `tick`; returns the spider's events [tick, state, arg]. onTick runs before each step. */
function until(s, tick, onTick) {
  const out = [];
  while (s.tick < tick) { onTick?.(s); s.step(); const ev = s.drainEvents(); for (let k = 0; k < ev.length; k += 3) if (ev[k] === EVENT.SPIDER) out.push([s.tick - 1, ev[k + 1], ev[k + 2]]); }
  return out;
}

test('under Recall the surface empties and stays empty: foragers in the nest do not go out', () => {
  const s = colony();
  trail(s); until(s, 200);
  assert.ok(surface(s) >= 8, `${surface(s)} on the surface before`);
  order(s, { type: CMD.RECALL, on: true }); until(s, 400);
  assert.equal(surface(s), 0, 'all home after 200 ticks');
  until(s, 550);
  assert.equal(surface(s), 0, 'and none go out again');
  order(s, { type: CMD.RECALL, on: false }); until(s, 650);
  assert.ok(surface(s) > 0, 'they go out once Recall is off');
});

test('no spider on day 1; on day 2 a warning at a quarter of the day, then it walks the top edge (the safe form)', () => {
  const s = colony(); trail(s);
  const ev = until(s, 2 * T);
  const warn = T + (T >> 2), hunt = warn + 20;
  assert.deepEqual(ev[0], [warn, SPIDER.WARN, -1]);
  assert.deepEqual(ev[1], [hunt, SPIDER.HUNT, -1]);
  assert.equal(ev[2][1], SPIDER.LEFT);
  assert.equal(s.g[G.SP_Y], SP.EDGE, 'on the edge row');
  assert.equal(s.g[G.SP_VISITS], 1);
});

test('on day 3 it walks the busiest trail from its far end and eats the ants on it', () => {
  const s = colony(); trail(s);
  const ev = until(s, 3 * T + 200).filter(e => e[0] >= 2 * T);
  assert.deepEqual(ev[0].slice(1), [SPIDER.WARN, SLOT.TRAIL0], 'the only trail');
  assert.equal(ev[2][1], SPIDER.LEFT);
  assert.ok(ev[2][2] >= 3, `${ev[2][2]} eaten`);
  assert.ok(s.g[G.SP_EATEN] >= ev[2][2]);
});

test('Recall at the warning, off when it leaves: the spider finds no one', () => {
  const s = colony(); trail(s);
  let on = false;
  const ev = until(s, 3 * T + 200, sim => {
    const st = sim.g[G.SP];
    if (st === SPIDER.WARN && !on) { on = true; order(sim, { type: CMD.RECALL, on: true }); }
    if (st === SPIDER.NONE && on) { on = false; order(sim, { type: CMD.RECALL, on: false }); }
  });
  const left = ev.filter(e => e[1] === SPIDER.LEFT);
  assert.equal(left.length, 2);
  assert.deepEqual(left.map(e => e[2]), [0, 0], 'nothing eaten on either visit');
  assert.equal(s.g[G.SP_EATEN], 0);
});

test('a trail replaced while it hunts sends it away', () => {
  const s = colony(); trail(s);
  until(s, 2 * T + (T >> 2) + 40);
  assert.equal(s.g[G.SP], SPIDER.HUNT);
  for (let k = 0; k < 4; k++) order(s, { type: CMD.TRAIL, layer: SURFACE, points: [25, 25, 25 - 4 * k, 40] }); // four new trails: its slot is reused
  const ev = until(s, s.tick + 3);
  assert.equal(ev.at(-1)[1], SPIDER.LEFT);
  assert.equal(s.g[G.SP], SPIDER.NONE);
});

test('a snapshot at any tick of a visit plays on to the same state', () => {
  const a = colony(); trail(a);
  const from = 2 * T + (T >> 2) - 5, to = from + 160;
  until(a, from);
  const b = restore(snapshot(a));
  let c = restore(snapshot(a));
  for (let t = from; t < to; t++) {
    b.step(); c = restore(snapshot(c)); c.step();
    assert.deepEqual(c.hashes(), b.hashes(), `tick ${t}`);
  }
  assert.ok(b.g[G.SP_KILLS] > 0, 'the run covers meals');
});
