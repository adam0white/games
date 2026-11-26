// A trail means what was drawn: ants walk the stroke's shape out to the food and back, not the straight
// line to its end (02-spec 6.4; 09-round2-findings trap 9). The cases and the measure are in
// spikes/trail-shape.mjs. Before this rule, the dog-leg case gave an outbound deviation up to 34 cells and
// no loaded ant had passed its corner (sim/SPIKES.md, "Trail shape").
import assert from 'node:assert/strict';
import test from 'node:test';
import { CMD, MAT, SURFACE, Sim } from '../sim/sim.js';
import { PATH_MAX, SLOT, TRAIL_OFF } from '../sim/flow.js';
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

test('the path is open, 4-connected, holds each cell once, and goes round a stone close by', () => {
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
    if (j) { const a = path[j - 1], b = path[j], dx = Math.abs((a % 64) - (b % 64)), dy = Math.abs(Math.floor(a / 64) - Math.floor(b / 64)); assert.equal(dx + dy, 1, `step ${j} is one cell`); }
  }
  assert.equal(path[0], cellAt(s.L, SURFACE, 5, 21));
  assert.equal(path[len - 1], cellAt(s.L, SURFACE, 55, 45));
  assert.equal(F.cell[SLOT.TRAIL0], path[len - 1], 'the goal cell is the end');
  for (const c of path) { const y = Math.floor(c / 64); assert.ok(y >= 21 - 4 && y <= 45, `row ${y}: close to the stroke`); }
  // The field: on the path the steps left to the end; off it TRAIL_OFF plus steps to the path.
  const d = j => F.dist[SLOT.TRAIL0 * s.L.n + path[j]];
  for (let j = 0; j < len; j++) assert.equal(d(j), len - 1 - j);
  assert.equal(F.dist[SLOT.TRAIL0 * s.L.n + cellAt(s.L, SURFACE, 5, 19)], TRAIL_OFF + 2);
});
