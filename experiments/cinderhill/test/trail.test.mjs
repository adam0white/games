// A trail means what was drawn: ants walk the stroke's shape out to the food and back, not the straight
// line to its end (02-spec 6.4; 09-round2-findings trap 9). The cases and the measure are in
// spikes/trail-shape.mjs. Before this rule, the dog-leg case gave an outbound deviation up to 34 cells and
// no loaded ant had passed its corner (sim/SPIKES.md, "Trail shape").
import assert from 'node:assert/strict';
import test from 'node:test';
import { CMD, EVENT, MAT, SUBSYSTEMS, SURFACE, Sim } from '../sim/sim.js';
import { restore, snapshot } from '../sim/snapshot.js';
import { PATH_MAX, SLOT, STEP, TRAIL_OFF } from '../sim/flow.js';
import { cellAt } from '../sim/grid.js';
import { trailShape } from '../spikes/trail-shape.mjs';

const LIMITS = { dogleg: [3, 1], ushape: [3, 1], tightU: [3, 1], crossing: [3, 1], stone: [6, 1.5] }; // max and mean deviation, cells

for (const [name, [max, mean]] of Object.entries(LIMITS)) {
  test(`${name}: ants stay on the drawn stroke both ways, pass its corners in order, and make round trips`, async () => {
    const r = await trailShape(name, { ants: 120, ticks: 6000 });
    for (const way of ['outbound', 'homeward']) {
      const m = r[way];
      assert.ok(m.samples > 10000, `${way}: ${m.samples} samples`);
      assert.ok(m.max <= max, `${way}: max deviation ${m.max} cells (limit ${max})`);
      assert.ok(m.mean <= mean, `${way}: mean deviation ${m.mean.toFixed(2)} cells (limit ${mean})`);
    }
    assert.equal(r.loadsPastCornersInOrder, r.loads, `${r.loadsPastCornersInOrder} of ${r.loads} loads passed every corner in order`);
    assert.ok(r.antsWith2Trips >= 0.9 * r.ants, `${r.antsWith2Trips} of ${r.ants} ants made two round trips`);
  });
}

test('the path is open, 8-connected without cutting a corner, holds each cell once, and goes round a stone close by', () => {
  const s = new Sim({ seed: 1, sw: 64, sh: 64, nw: 16, nh: 16, ants: 0, blank: true });
  s.home = { x: 0, y: 0, w: 1, h: 1 };
  s.mat[s.L.nestBase] = MAT.OPEN; s.link[cellAt(s.L, SURFACE, 2, 2)] = s.L.nestBase; s.link[s.L.nestBase] = cellAt(s.L, SURFACE, 2, 2);
  s.startGoals(); s.step();
  for (let y = 18; y <= 24; y++) for (let x = 28; x <= 34; x++) s.setCell(cellAt(s.L, SURFACE, x, y), MAT.STONE);
  // Through the stone, a loop back over itself, then a diagonal.
  s.queueCommand({ tick: s.tick, type: CMD.TRAIL, layer: SURFACE, points: [5, 21, 50, 21, 50, 10, 40, 10, 40, 30, 55, 45] });
  s.step();
  const F = s.flow, len = F.pathLen[0], path = Array.from(F.path.subarray(0, len));
  assert.ok(len > 40 && len < PATH_MAX, `length ${len}`);
  assert.equal(new Set(path).size, len, 'each cell once');
  for (let j = 0; j < len; j++) {
    assert.equal(s.mat[path[j]], MAT.OPEN, `cell ${j} open`);
    if (!j) continue;
    const a = path[j - 1], b = path[j], ax = a % 64, ay = Math.floor(a / 64), bx = b % 64, by = Math.floor(b / 64);
    const dx = Math.abs(ax - bx), dy = Math.abs(ay - by);
    assert.ok(dx <= 1 && dy <= 1 && dx + dy >= 1, `step ${j} is one cell`);
    if (dx + dy === 2) assert.ok(s.mat[cellAt(s.L, SURFACE, bx, ay)] === MAT.OPEN && s.mat[cellAt(s.L, SURFACE, ax, by)] === MAT.OPEN, `diagonal step ${j} cuts no corner`);
  }
  assert.equal(path[0], cellAt(s.L, SURFACE, 5, 21));
  assert.equal(path[len - 1], cellAt(s.L, SURFACE, 55, 45));
  assert.equal(F.cell[SLOT.TRAIL0], path[len - 1], 'the goal cell is the end');
  for (const c of path) { const y = Math.floor(c / 64); assert.ok(y >= 21 - 4 && y <= 45, `row ${y}: close to the stroke`); }
  assert.ok(path.some((c, j) => j && Math.abs((c % 64) - (path[j - 1] % 64)) === 1 && Math.abs(Math.floor(c / 64) - Math.floor(path[j - 1] / 64)) === 1), 'the diagonal leg takes diagonal steps');
  // The field: on the path the steps left to the end; off it TRAIL_OFF plus the distance to the path (5 a
  // straight step, 7 a diagonal one).
  const d = j => F.dist[SLOT.TRAIL0][path[j]];
  for (let j = 0; j < len; j++) assert.equal(d(j), len - 1 - j);
  assert.equal(F.dist[SLOT.TRAIL0][cellAt(s.L, SURFACE, 5, 19)], TRAIL_OFF + 2 * STEP);
});

test('a rejected stroke leaves the four live trails as they were, and restore still matches', () => {
  const s = new Sim({ seed: 2, sw: 64, sh: 64, nw: 16, nh: 16, ants: 30, blank: true });
  s.home = { x: 0, y: 0, w: 1, h: 1 };
  s.mat[s.L.nestBase] = MAT.OPEN; s.link[cellAt(s.L, SURFACE, 2, 2)] = s.L.nestBase; s.link[s.L.nestBase] = cellAt(s.L, SURFACE, 2, 2);
  s.startGoals();
  for (let y = 40; y < 50; y++) for (let x = 40; x < 50; x++) s.setCell(cellAt(s.L, SURFACE, x, y), MAT.STONE);
  for (let k = 0; k < 4; k++) s.queueCommand({ tick: 1 + k, id: k + 1, type: CMD.TRAIL, layer: SURFACE, points: [2, 3, 10 + 8 * k, 3, 10 + 8 * k, 30] });
  for (let t = 0; t < 10; t++) s.step();
  const F = s.flow, paths = F.path.slice(), lens = F.pathLen.slice(), seq = F.seq.slice();
  s.drainEvents();
  s.queueCommand({ tick: s.tick, id: 9, type: CMD.TRAIL, layer: SURFACE, points: [41, 41, 48, 48] }); // wholly on stone
  s.step();
  assert.deepEqual(Array.from(s.drainEvents().slice(0, 3)), [EVENT.REJECTED, 0, 9]);
  assert.deepEqual(F.path, paths, 'paths unchanged');
  assert.deepEqual(F.pathLen, lens, 'lengths unchanged');
  assert.deepEqual(F.seq, seq, 'no slot replaced');
  const back = restore(snapshot(s)), a = s.hashes(), b = back.hashes();
  for (const k of SUBSYSTEMS) assert.equal(b[k], a[k], k);
});

test('on its path a trail leads to the next path cell, even where a bend comes back beside an earlier cell; off it, to the nearest path cell', async () => {
  const { nextCell, backCell } = await import('../sim/flow.js');
  const s = new Sim({ seed: 1, sw: 32, sh: 32, nw: 16, nh: 16, ants: 0, blank: true });
  s.home = { x: 0, y: 0, w: 1, h: 1 };
  s.mat[s.L.nestBase] = MAT.OPEN; s.link[cellAt(s.L, SURFACE, 10, 11)] = s.L.nestBase; s.link[s.L.nestBase] = cellAt(s.L, SURFACE, 10, 11);
  s.startGoals(); s.step();
  // (11,11) up to (11,10), right to (13,10), down to (13,12), left to (12,12): the end is diagonal to the start.
  s.queueCommand({ tick: s.tick, type: CMD.TRAIL, layer: SURFACE, points: [11, 11, 11, 10, 13, 10, 13, 13, 12, 13] });
  s.step();
  const at = (x, y) => cellAt(s.L, SURFACE, x, y);
  assert.equal(nextCell(s, SLOT.TRAIL0, at(11, 11)), at(11, 10), 'from the start: up the drawn bend, not across to the end');
  assert.equal(backCell(s, SLOT.TRAIL0, at(12, 13)), at(13, 13), 'walking back from the end: the cell before it');
  // (11,12) is next to the start (11,11) and diagonal to the end (12,13): it joins at the start, the nearest.
  assert.equal(nextCell(s, SLOT.TRAIL0, at(11, 12)), at(11, 11), 'off the path: onto the nearest path cell');
  // A bend whose end comes back diagonal to its start: the old scoring (path steps plus walking cost) jumped to the end.
  s.queueCommand({ tick: s.tick, type: CMD.TRAIL, layer: SURFACE, points: [11, 11, 11, 10, 13, 10, 13, 12, 12, 12] });
  s.step();
  const slot = s.newestTrail();
  assert.equal(nextCell(s, slot, at(11, 11)), at(11, 10), 'from the start of the second stroke: up the bend, not across to its end');
});
