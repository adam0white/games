// The goal manager (SIM_VERSION 11, 05-tech "rewrite the goal manager", 03-features 10): 64 goal slots, a pool
// from slot 16 taken lowest first; 32-bit distances with no 16-bit ceiling; at most REBUILDS fields rebuilt at each
// of the tick's two rebuild points, oldest marked first; a field still marked after one is blank (all INF) and the
// ants following it keep their heading; a snapshot taken with fields waiting restores to the same game.
import assert from 'node:assert/strict';
import test from 'node:test';
import { GOAL, JOB, MAT, MODE, NEST, SLOT, SURFACE, Sim } from '../sim/sim.js';
import { INF, MAX_GOALS, REBUILDS, STEP, allocGoal, distAt, dropGoal, markDirty, rebuild } from '../sim/flow.js';
import { cellAt } from '../sim/grid.js';
import { restore, snapshot } from '../sim/snapshot.js';

const small = (opts = {}) => new Sim({ seed: 4, sw: 64, sh: 64, nw: 48, nh: 32, ants: 0, maxAnts: 400, blank: true, ...opts });
/** `k` pool goals at surface cells along a row, from (x0, y). */
function many(s, k, y = 40, x0 = 2) { const out = []; for (let j = 0; j < k; j++) out.push(allocGoal(s, GOAL.FOOD, cellAt(s.L, SURFACE, x0 + j, y))); return out; }
/** A from-scratch field for `slot` on a copy of the flow (the running one is not touched). */
function scratch(s, slot) {
  const F = s.flow, d = new Uint32Array(s.L.n).fill(INF), dist = F.dist.slice(); dist[slot] = d;
  const flow = { ...F, dist, dirty: F.dirty.slice(), blank: F.blank.slice(), btail: new Int32Array(16), buckets: Array.from({ length: 16 }, () => new Int32Array(1024)), pending: 0 };
  rebuild({ L: s.L, mat: s.mat, link: s.link, dig: s.dig, home: s.home, flow }, slot);
  return d;
}

test('64 slots: the pool is taken lowest free slot first, and a dropped goal gives its memory back', () => {
  const s = small();
  assert.equal(MAX_GOALS, 64);
  const got = many(s, MAX_GOALS - SLOT.POOL0);
  assert.deepEqual(got, Array.from({ length: MAX_GOALS - SLOT.POOL0 }, (_, k) => SLOT.POOL0 + k));
  assert.equal(allocGoal(s, GOAL.FOOD, cellAt(s.L, SURFACE, 1, 1)), -1, 'all taken');
  dropGoal(s, 20);
  assert.equal(s.flow.dist[20], s.flow.none);
  assert.equal(allocGoal(s, GOAL.FOOD, cellAt(s.L, SURFACE, 1, 1)), 20, 'the freed slot again');
  assert.notEqual(s.flow.dist[20], s.flow.none);
});

test('each rebuild point rebuilds REBUILDS fields, oldest marked first; the rest are blank until their turn', () => {
  const s = small();
  const slots = many(s, 30);
  // Re-marking one keeps its place: the first marked is still the oldest.
  markDirty(s, slots[0]);
  const r0 = s.flow.rebuilds;
  s.rebuildFields();
  assert.equal(s.flow.rebuilds - r0, REBUILDS, 'the quota');
  for (let j = 0; j < 30; j++) {
    const done = j < REBUILDS;
    assert.equal(!s.flow.dirty[slots[j]], done, `slot ${slots[j]} ${done ? 'rebuilt' : 'waiting'}`);
    assert.equal(!!s.flow.blank[slots[j]], !done);
    if (!done) assert.ok(s.flow.dist[slots[j]].every(v => v === INF), 'a waiting field is blank');
  }
  for (let t = 0; t < 10; t++) s.step();
  for (const slot of slots) {
    assert.equal(s.flow.dirty[slot], 0);
    assert.deepEqual(s.flow.dist[slot], scratch(s, slot), `slot ${slot} equals a field built from scratch`);
  }
});

test('ants following a blank field keep their heading (no wandering turn); once it is rebuilt they follow it', () => {
  const s = small({ colony: 0 });
  s.home = { x: 20, y: 10, w: 6, h: 4 };
  for (let y = 10; y < 14; y++) for (let x = 20; x < 26; x++) s.mat[cellAt(s.L, NEST, x, y)] = MAT.OPEN;
  const e = cellAt(s.L, SURFACE, 30, 30), top = cellAt(s.L, NEST, 22, 10); s.link[e] = top; s.link[top] = e;
  s.startGoals(); s.rebuildFields(); s.rebuildFields();
  const ants = [];
  for (let k = 0; k < 12; k++) { // sandbox diggers on the surface with no dig marked: they walk home on the HOME field
    const i = s.spawn(JOB.DIG);
    s.layer[i] = SURFACE; s.x[i] = ((10 + 3 * k) << 8) + 128; s.y[i] = (50 << 8) + 128; s.heading[i] = 16 * k; s.mode[i] = MODE.SEEK;
    s.lastCell[i] = cellAt(s.L, SURFACE, 10 + 3 * k, 50); ants.push(i);
  }
  s.flow.dist[SLOT.HOME].fill(INF); s.flow.blank[SLOT.HOME] = 1; s.flow.dirty[SLOT.HOME] = 1 << 30; // waiting for its turn
  s.buildBuckets();
  const h0 = ants.map(i => s.heading[i]);
  for (const i of ants) s.stepAnt(i);
  assert.deepEqual(ants.map(i => s.heading[i]), h0, 'no turn on a blank field');
  rebuild(s, SLOT.HOME); s.flow.dirty[SLOT.HOME] = 0;
  for (const i of ants) s.stepAnt(i);
  assert.ok(ants.every(i => s.goal[i] === SLOT.HOME), 'following home again');
  assert.ok(ants.some((i, k) => s.heading[i] !== h0[k]), 'and turning toward it');
});

test('no 16-bit ceiling: a 16,000-cell tunnel is walked to its end', () => {
  const s = new Sim({ seed: 1, sw: 16, sh: 16, nw: 256, nh: 128, ants: 0, maxAnts: 10, blank: true });
  s.home = { x: 0, y: 0, w: 1, h: 1 };
  // A switchback: every even row open, joined at alternate ends.
  for (let y = 0; y < 128; y += 2) {
    for (let x = 0; x < 256; x++) s.mat[cellAt(s.L, NEST, x, y)] = MAT.OPEN;
    if (y + 2 < 128) s.mat[cellAt(s.L, NEST, (y / 2) % 2 ? 0 : 255, y + 1)] = MAT.OPEN;
  }
  s.startGoals(); s.rebuildFields(); s.rebuildFields();
  const far = cellAt(s.L, NEST, 0, 126), d = distAt(s, SLOT.HOME, far);
  assert.ok(d !== INF && d > 0xFFFF, `the far end: ${d}`);
  assert.equal(d, (64 * 256 - 1 + 63) * STEP, 'one step a cell along the switchback (no diagonals: the walls are 1 thick)');
});

test('a snapshot taken while fields wait for their rebuild plays on as the uninterrupted game', () => {
  const s = new Sim({ seed: 9, colony: 1, ants: 30 });
  for (let t = 0; t < 40; t++) s.step();
  many(s, 40, 140, 100);
  s.step();
  let waiting = 0; for (let k = 0; k < MAX_GOALS; k++) if (s.flow.live[k] && s.flow.dirty[k]) waiting++;
  assert.ok(waiting > 20, `${waiting} fields waiting at the tick boundary`);
  const b = restore(snapshot(s));
  assert.deepEqual(b.hashes(), s.hashes());
  for (let t = 0; t < 300; t++) { s.step(); b.step(); }
  assert.deepEqual(b.hashes(), s.hashes());
});

test('a field marked after the tick\'s last rebuild point (as at dusk) is left out of the hash, and restores the same', () => {
  const s = new Sim({ seed: 9, colony: 1, ants: 30 });
  for (let t = 0; t < 40; t++) s.step();
  markDirty(s, SLOT.HOME); // still exact, marked: the next tick's first rebuild point takes it
  assert.equal(s.flow.blank[SLOT.HOME], 0);
  const b = restore(snapshot(s));
  assert.deepEqual(b.hashes(), s.hashes());
  for (let t = 0; t < 100; t++) { s.step(); b.step(); }
  assert.deepEqual(b.hashes(), s.hashes());
});
