// Ants move in eight directions (owner feedback on the trail painter: "Guards can't move diagonally").
// A guard called to an alarm straight down a diagonal walks the diagonal, not an L, and arrives in about the
// octile time; no ant squeezes between two walls that touch at a corner.
import assert from 'node:assert/strict';
import test from 'node:test';
import { CMD, JOB, MAT, STEP, SURFACE, SLOT, Sim } from '../sim/sim.js';
import { cellAt } from '../sim/grid.js';
import { distAt } from '../sim/flow.js';

function field() {
  const s = new Sim({ seed: 4, sw: 64, sh: 64, nw: 16, nh: 16, ants: 0, blank: true });
  s.home = { x: 0, y: 0, w: 1, h: 1 };
  s.mat[s.L.nestBase] = MAT.OPEN;
  const e = cellAt(s.L, SURFACE, 60, 2);
  s.link[e] = s.L.nestBase; s.link[s.L.nestBase] = e;
  s.startGoals(); s.step();
  return s;
}

test('a guard called down a diagonal walks the diagonal and arrives in about the octile time', () => {
  const s = field();
  const i = s.spawn(JOB.GUARD);
  s.layer[i] = SURFACE; s.x[i] = 5 * 256 + 128; s.y[i] = 5 * 256 + 128; s.lastCell[i] = s.cellOfAnt(i);
  s.queueCommand({ tick: s.tick, type: CMD.ALARM, layer: SURFACE, x: 45, y: 45, hold: 400 });
  let worst = 0, arrived = -1;
  for (let t = 0; t < 700 && arrived < 0; t++) {
    s.step();
    const x = s.x[i] / 256, y = s.y[i] / 256;
    worst = Math.max(worst, Math.abs(x - y));
    if (distAt(s, SLOT.ALARM, s.cellOfAnt(i)) <= 2 * STEP) arrived = t;
  }
  // 40 cells each way: the diagonal is 56.6 cells, the L 80. RUN is 36/256 cells a tick: 402 and 569 ticks.
  assert.ok(arrived > 0 && arrived < 470, `arrived at tick ${arrived}`);
  assert.ok(worst < 2.5, `strayed ${worst.toFixed(2)} cells from the diagonal`);
});

test('no ant squeezes between two walls that touch at a corner', () => {
  const s = field();
  s.setCell(cellAt(s.L, SURFACE, 10, 10), MAT.STONE); s.setCell(cellAt(s.L, SURFACE, 11, 11), MAT.STONE);
  const i = s.spawn(JOB.FORAGE);
  s.layer[i] = SURFACE; s.x[i] = 10 * 256 + 250; s.y[i] = 11 * 256 + 6; // cell (10, 11), at the corner
  assert.equal(s.tryMove(i, 20, -20), false, 'up-right into (11, 10) passes between the stones');
  assert.equal(s.x[i], 10 * 256 + 250);
  // Grazing one wall's corner is allowed: open (11, 11) first, then the same step goes.
  s.setCell(cellAt(s.L, SURFACE, 11, 11), MAT.OPEN);
  assert.equal(s.tryMove(i, 20, -20), true);
});

test('fields step diagonally only past two open side cells', () => {
  const s = field();
  s.setCell(cellAt(s.L, SURFACE, 20, 20), MAT.STONE);
  s.queueCommand({ tick: s.tick, type: CMD.ALARM, layer: SURFACE, x: 21, y: 19, hold: 400 });
  s.step();
  // From (20, 21) to (21, 19): the short way starts with the diagonal to (21, 20), past the stone at (20, 20),
  // which would be 7 + 5 = 12. Without it: right, up, up, 15.
  assert.equal(distAt(s, SLOT.ALARM, cellAt(s.L, SURFACE, 20, 21)), 15);
  // In open ground the diagonal is taken: (24, 16) is three diagonals away.
  assert.equal(distAt(s, SLOT.ALARM, cellAt(s.L, SURFACE, 24, 16)), 21);
});
