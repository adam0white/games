// The spider (sim/spider.js) and Recall (sim.js: foragers stay in under it): when it comes, where it walks, that it
// eats ants on the surface, that Recall leaves it nothing, that a replaced trail sends it away, and that a snapshot
// taken at any tick of a visit plays on the same. Small blank maps with short days, as in days.test.mjs.
import assert from 'node:assert/strict';
import test from 'node:test';
import { CMD, EVENT, G, MAT, MODE, NEST, SURFACE, Sim, FOOD, JOB } from '../sim/sim.js';
import { SP, SPIDER, busiestTrail } from '../sim/spider.js';
import { SLOT, PATH_MAX } from '../sim/flow.js';
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

test('under Recall a waiting forager\'s search does not age, and guards stay in for a surface alarm', () => {
  const s = colony();
  for (let k = 0; k < 6; k++) s.spawn(JOB.GUARD);
  trail(s); until(s, 100);
  order(s, { type: CMD.RECALL, on: true }); until(s, 300);
  order(s, { type: CMD.ALARM, layer: SURFACE, x: 30, y: 30, hold: 400 });
  let out = 0;
  until(s, 700, sim => { out = Math.max(out, surface(sim)); });
  assert.equal(out, 0, 'no guard went out to the alarm while it lasted');
  let waiting = 0;
  for (let i = 0; i < s.n; i++) if (s.job[i] === JOB.FORAGE && s.layer[i] === NEST && s.mode[i] === MODE.SEEK) { waiting++; assert.equal(s.since[i], 0, `forager ${i}`); }
  assert.ok(waiting >= 8, `${waiting} waiting`);
});

test('no spider on day 1; on day 2 a warning at a quarter of the day, then it walks the top edge and eats no one (the safe form)', () => {
  const s = colony(); trail(s);
  order(s, { type: CMD.TRAIL, layer: SURFACE, points: [25, 25, 9, 6] }); // the newest trail ends on the edge row, where the spider starts
  const ev = until(s, 2 * T);
  const warn = T + (T >> 2), hunt = warn + 20;
  assert.deepEqual(ev[0], [warn, SPIDER.WARN, -1]);
  assert.deepEqual(ev[1], [hunt, SPIDER.HUNT, -1]);
  assert.equal(ev[2][1], SPIDER.LEFT);
  assert.equal(s.g[G.SP_Y], SP.EDGE, 'on the edge row');
  assert.equal(s.g[G.SP_VISITS], 1);
  assert.equal(ev[2][2], 0, 'no meals'); assert.equal(s.g[G.SP_EATEN], 0);
});

test('on day 3 it walks the busiest trail from its far end toward the nest and kills the ants it eats', () => {
  const s = colony(); trail(s);
  const warn = 2 * T + (T >> 2);
  until(s, warn + 1);
  assert.equal(s.g[G.SP], SPIDER.WARN); assert.equal(s.g[G.SP_SLOT], SLOT.TRAIL0, 'the only trail');
  const F = s.flow, len = F.pathLen[0], cell = j => { const c = F.path[j]; return [c % s.L.sw, (c / s.L.sw) | 0]; };
  assert.deepEqual([s.g[G.SP_X], s.g[G.SP_Y]], cell(len - 1), 'at the far end');
  until(s, warn + 20 + SP.MOVE + 1);
  assert.deepEqual([s.g[G.SP_X], s.g[G.SP_Y]], cell(len - 2), 'one cell toward the start');
  const died = s.g[G.DIED], n = s.n;
  const ev = until(s, 3 * T + 200);
  const left = ev.find(e => e[1] === SPIDER.LEFT);
  assert.ok(left[2] >= 3, `${left[2]} eaten`);
  assert.ok(s.g[G.DIED] - died >= left[2], 'each meal is a death');
  assert.ok(s.n <= n - left[2] + s.g[G.BORN], 'and the ants are gone');
});

test('the busiest trail: ants on or beside its path, an ant beside two trails counting for both; ties go to the newest', () => {
  const s = colony(0);
  order(s, { type: CMD.TRAIL, layer: SURFACE, points: [25, 25, 25, 40] }); // slot 4: down
  order(s, { type: CMD.TRAIL, layer: SURFACE, points: [25, 25, 40, 25] }); // slot 5: right, newer
  s.step();
  const put = (x, y) => { const i = s.spawn(JOB.FORAGE) ?? s.n - 1; s.layer[i] = SURFACE; s.x[i] = x * 256 + 128; s.y[i] = y * 256 + 128; };
  assert.equal(busiestTrail(s), SLOT.TRAIL0 + 1, 'no ants: the newest');
  put(25, 26); put(26, 26); // beside both
  assert.equal(busiestTrail(s), SLOT.TRAIL0 + 1, 'a tie: the newest');
  put(24, 35); // beside the older only
  assert.equal(busiestTrail(s), SLOT.TRAIL0, 'three on the older, two on the newer');
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
