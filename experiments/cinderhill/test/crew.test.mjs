// Crews (CMD.CREW, SIM_VERSION 7): plus and minus on a trail set how many ants it wants. Ants short of a crew join
// it, an ant over it goes home and out again free, the newest trail recruits on its own only without a crew size,
// a new trail in the slot starts without one, and a snapshot with crew sizes plays on the same.
import assert from 'node:assert/strict';
import test from 'node:test';
import { CMD, EVENT, G, MAT, MODE, NEST, SURFACE, Sim, FOOD, JOB } from '../sim/sim.js';
import { SLOT } from '../sim/flow.js';
import { cellAt } from '../sim/grid.js';
import { restore, snapshot } from '../sim/snapshot.js';

function colony(workers = 30) {
  // A long day, so no dusk and no spider in these runs.
  const s = new Sim({ seed: 11, sw: 48, sh: 48, nw: 32, nh: 24, ants: 0, blank: true, colony: 1, dayTicks: 20000 });
  s.home = { x: 10, y: 10, w: 8, h: 4 };
  for (let y = 10; y < 14; y++) for (let x = 10; x < 18; x++) s.mat[cellAt(s.L, NEST, x, y)] = MAT.OPEN;
  for (let y = 0; y < 10; y++) s.mat[cellAt(s.L, NEST, 14, y)] = MAT.OPEN;
  const e = cellAt(s.L, SURFACE, 24, 24), top = cellAt(s.L, NEST, 14, 0);
  s.link[e] = top; s.link[top] = e;
  s.pileCell[0] = cellAt(s.L, SURFACE, 38, 24); s.pileAmount[0] = 4000; s.pileKind[0] = FOOD.SUGAR;
  s.pileCell[1] = cellAt(s.L, SURFACE, 24, 38); s.pileAmount[1] = 4000; s.pileKind[1] = FOOD.PROTEIN;
  s.startGoals(); s.rebuildFields();
  for (let k = 0; k < workers; k++) s.spawn(JOB.FORAGE);
  s.g[G.SUGAR] = 400; s.g[G.PROTEIN] = 400;
  return s;
}
let id = 0;
const order = (s, o) => s.queueCommand({ tick: s.tick, id: ++id, seat: 0, ...o });
const east = s => order(s, { type: CMD.TRAIL, layer: SURFACE, points: [25, 24, 38, 24] });
const south = s => order(s, { type: CMD.TRAIL, layer: SURFACE, points: [24, 25, 24, 38] });
const crewOf = (s, slot) => { let k = 0; for (let i = 0; i < s.n; i++) if (s.hp[i] > 0 && s.job[i] === JOB.FORAGE && s.via[i] === slot) k++; return k; };
const slotOf = (s, seq) => { for (let k = SLOT.TRAIL0; k < SLOT.TRAIL0 + SLOT.TRAILS; k++) if (s.flow.live[k] && s.flow.seq[k] === seq) return k; return -1; };
const run = (s, n, each) => { const ev = []; for (let k = 0; k < n; k++) { s.step(); const e = s.drainEvents(); for (let j = 0; j < e.length; j += 3) ev.push([e[j], e[j + 1], e[j + 2]]); each?.(s); } return ev; };

test('plus on an older trail moves ants to it from a trail without a crew size, up to the size and no more', () => {
  const s = colony();
  east(s); run(s, 1); const eSeq = s.flow.seq[s.newestTrail()], eSlot = slotOf(s, eSeq);
  run(s, 600);
  order(s, { type: CMD.CREW, seq: eSeq, delta: -(crewOf(s, eSlot) - 4) }); run(s, 1); // east keeps 4
  south(s); run(s, 1); const sSlot = s.newestTrail();
  run(s, 900);
  assert.equal(crewOf(s, eSlot), 4); assert.ok(crewOf(s, sSlot) >= 15, `south took the rest: ${crewOf(s, sSlot)}`);
  const before = crewOf(s, eSlot);
  order(s, { type: CMD.CREW, seq: eSeq, delta: 8 }); run(s, 1);
  assert.equal(s.g[G.WANT0 + eSlot - SLOT.TRAIL0], before + 8 + 1, 'the count starts at the ants on it');
  let max = 0;
  run(s, 1200, s => { max = Math.max(max, crewOf(s, eSlot)); });
  assert.equal(crewOf(s, eSlot), before + 8, `east crew ${crewOf(s, eSlot)}, wanted ${before + 8}`);
  assert.ok(max <= before + 8, `never over: ${max}`);
  assert.ok(crewOf(s, sSlot) > 0, 'the newest trail still has its own crew');
});

test('minus sends ants over the crew size home, and they come out again free', () => {
  const s = colony();
  east(s); run(s, 1); const seq = s.flow.seq[s.newestTrail()], slot = slotOf(s, seq);
  run(s, 900);
  const before = crewOf(s, slot);
  assert.ok(before >= 10, `a crew of ${before} before`);
  order(s, { type: CMD.CREW, seq, delta: -(before - 3) }); run(s, 1);
  assert.equal(s.g[G.WANT0 + slot - SLOT.TRAIL0], 3 + 1);
  let home = 0;
  const was = Int32Array.from(s.via);
  run(s, 900, s => { for (let i = 0; i < s.n; i++) if (was[i] === slot && s.via[i] === -1 && s.mode[i] === MODE.RETURN) home++; });
  assert.equal(crewOf(s, slot), 3);
  assert.ok(home > 0, 'released ants walk home');
  // With a crew size the newest trail stops taking every seeker: once settled it never goes over.
  let max = 0; run(s, 600, s => { max = Math.max(max, crewOf(s, slot)); });
  assert.equal(max, 3, `at most 3, saw ${max}`);
  // The newest trail has a crew size now, so it no longer takes every seeker: the others work by scent.
  let free = 0; for (let i = 0; i < s.n; i++) if (s.via[i] === -1) free++;
  assert.ok(free >= s.n - 3 - 1, `${free} of ${s.n} free`);
});

test('a crew order for no live trail, or of zero, is rejected; a new trail in the slot starts without a size', () => {
  const s = colony();
  east(s); run(s, 1); const seq = s.flow.seq[s.newestTrail()], slot = slotOf(s, seq);
  order(s, { type: CMD.CREW, seq: seq + 99, delta: 1 });
  order(s, { type: CMD.CREW, seq, delta: 0 });
  const ev = run(s, 1);
  assert.equal(ev.filter(e => e[0] === EVENT.REJECTED).length, 2);
  order(s, { type: CMD.CREW, seq, delta: 5 }); run(s, 1);
  assert.ok(s.g[G.WANT0 + slot - SLOT.TRAIL0] > 0);
  // Four more trails: the fifth reuses the oldest slot (this one).
  for (let k = 0; k < 4; k++) { order(s, { type: CMD.TRAIL, layer: SURFACE, points: [25, 23 - k, 38, 20 - k] }); run(s, 1); }
  assert.notEqual(s.flow.seq[slot], seq, 'the slot holds a new trail');
  assert.equal(s.g[G.WANT0 + slot - SLOT.TRAIL0], 0);
});

test('a snapshot taken with crew sizes plays on the same', () => {
  const a = colony();
  east(a); run(a, 1); const seq = a.flow.seq[a.newestTrail()];
  run(a, 300); south(a); run(a, 300);
  order(a, { type: CMD.CREW, seq, delta: 6 }); run(a, 150);
  const b = restore(snapshot(a));
  run(a, 600); run(b, 600);
  assert.deepEqual(b.hashes(), a.hashes());
});
