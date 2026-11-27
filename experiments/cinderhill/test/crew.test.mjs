// Crews and who goes (SIM_VERSION 9, 02-spec 3.2 Crews and 6.2 Who goes). In a colony game a new trail gets a Steady
// crew, a quarter of the outside workforce; Light and Surge take a tenth and a half, capped by what the other crews
// leave. Sizes are worked out again only when the workforce has moved by a tenth. An explicit plus or minus sets a
// count and drops the level. Ants on no crew are free: one in three at a time works the nearest trail at off-trail
// speed, the rest rest by the door; a free ant in the nest takes the dig while marked cells lack diggers. At 0 sugar
// adults walk at half speed, and after a minute the oldest die, one in a hundred (at least one) every 10 s, the queen
// last. Plus and minus (sim 7) still work, and a snapshot taken mid-run plays on the same.
import assert from 'node:assert/strict';
import test from 'node:test';
import { CMD, EVENT, FREE_VIA, G, MAT, MODE, NEST, SURFACE, Sim, FOOD, JOB, encodeCommand } from '../sim/sim.js';
import { SLOT } from '../sim/flow.js';
import { cellAt } from '../sim/grid.js';
import { STARVE_AFTER, STARVE_EVERY } from '../sim/colony.js';
import { restore, snapshot } from '../sim/snapshot.js';

function colony(workers = 30) {
  // A long day, so no dusk and no spider in these runs; no queen, so no births (the workforce stays put).
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
  s.g[G.SUGAR] = 400; s.g[G.PROTEIN] = 400; s.g[G.QUEEN] = 0; s.brood.n = 0;
  return s;
}
let id = 0;
const order = (s, o) => s.queueCommand({ tick: s.tick, id: ++id, seat: 0, ...o });
const east = s => order(s, { type: CMD.TRAIL, layer: SURFACE, points: [25, 24, 38, 24] });
const south = s => order(s, { type: CMD.TRAIL, layer: SURFACE, points: [24, 25, 24, 38] });
const level = (s, seq, lv) => order(s, { type: CMD.CREW, seq, delta: 0, level: lv });
const crewOf = (s, slot) => { let k = 0; for (let i = 0; i < s.n; i++) if (s.hp[i] > 0 && s.job[i] === JOB.FORAGE && s.via[i] === slot) k++; return k; };
const want = (s, slot) => s.g[G.WANT0 + slot - SLOT.TRAIL0] - 1;
const isCrew = v => v >= SLOT.TRAIL0 && v < SLOT.TRAIL0 + SLOT.TRAILS;
const run = (s, n, each) => { const ev = []; for (let k = 0; k < n; k++) { s.step(); const e = s.drainEvents(); for (let j = 0; j < e.length; j += 3) ev.push([e[j], e[j + 1], e[j + 2]]); each?.(s); } return ev; };
const draw = (s, fn) => { fn(s); run(s, 1); const slot = s.newestTrail(); return { slot, seq: s.flow.seq[slot] }; };
const kill = (s, n) => { for (let i = s.n - 1; i >= 0 && n > 0; i--) if (s.hp[i] > 0) { s.hp[i] = 0; s.anyDead = true; n--; } };

test('a new trail gets a Steady crew, a quarter of the workforce, and never more', () => {
  const s = colony(30);
  const e = draw(s, east);
  assert.equal(s.g[G.LEVEL0 + e.slot - SLOT.TRAIL0], 2);
  assert.equal(want(s, e.slot), 8, 'Steady: 30 x 25%, rounded');
  let max = 0;
  run(s, 1200, s => { max = Math.max(max, crewOf(s, e.slot)); });
  assert.equal(crewOf(s, e.slot), 8);
  assert.ok(max <= 8, `never over: ${max}`);
});

test('Light and Surge take a tenth and a half; crews together never take more than the workforce', () => {
  const s = colony(30);
  const e = draw(s, east), so = draw(s, south);
  level(s, e.seq, 1); run(s, 1);
  assert.equal(want(s, e.slot), 3, 'Light: 30 x 10%');
  level(s, e.seq, 3); level(s, so.seq, 3); run(s, 1);
  assert.equal(want(s, e.slot), 15); assert.equal(want(s, so.slot), 15);
  const third = draw(s, s => order(s, { type: CMD.TRAIL, layer: SURFACE, points: [23, 24, 12, 24] }));
  assert.equal(want(s, third.slot), 0, 'no one left for a third crew');
  run(s, 1500);
  assert.equal(crewOf(s, e.slot) + crewOf(s, so.slot) + crewOf(s, third.slot), 30);
  // Its card says why: no free foragers.
  assert.equal(s.freeAll, 0);
});

test('sizes are worked out again only when the workforce moves by a tenth, oldest trail first', () => {
  const s = colony(30);
  const e = draw(s, east);
  run(s, 200);
  kill(s, 2); run(s, 2);
  assert.equal(s.workforce(), 28);
  assert.equal(want(s, e.slot), 8, 'a change of 2 in 30 leaves the size');
  assert.equal(s.g[G.WORKFORCE], 30);
  kill(s, 1); run(s, 2);
  assert.equal(s.g[G.WORKFORCE], 27);
  assert.equal(want(s, e.slot), 7, 'a change of 3 in 30: 27 x 25%, rounded');
  // One ant back and forth around the line does not flap the size.
  let changes = 0, last = want(s, e.slot);
  for (let k = 0; k < 6; k++) { if (k & 1) kill(s, 1); else s.spawn(JOB.FORAGE); run(s, 2); if (want(s, e.slot) !== last) { changes++; last = want(s, e.slot); } }
  assert.equal(changes, 0);
});

test('plus or minus sets a count and drops the level; the count holds through a workforce change', () => {
  const s = colony(30);
  const e = draw(s, east);
  run(s, 600);
  order(s, { type: CMD.CREW, seq: e.seq, delta: 3 }); run(s, 1);
  assert.equal(s.g[G.LEVEL0 + e.slot - SLOT.TRAIL0], 0);
  assert.equal(want(s, e.slot), 11, 'from the Steady 8');
  kill(s, 10); run(s, 2);
  assert.equal(want(s, e.slot), 11, 'a count is not a share');
  order(s, { type: CMD.CREW, seq: e.seq, delta: -(want(s, e.slot) - 3) }); run(s, 1);
  let max = 0; run(s, 900); run(s, 600, s => { max = Math.max(max, crewOf(s, e.slot)); });
  assert.equal(max, 3, `minus sends the rest home: at most 3, saw ${max}`);
  // A level again.
  level(s, e.seq, 2); run(s, 1);
  assert.equal(want(s, e.slot), 5, 'Steady of 20');
});

test('free ants: one in three at a time works the nearest trail at off-trail speed, the rest rest still by the door', () => {
  const s = colony(30);
  const e = draw(s, east);
  // A short trail to the south, to protein moved near: its end is nearer the door than the east trail's.
  s.pileCell[1] = cellAt(s.L, SURFACE, 24, 31); s.startGoals(); s.rebuildFields();
  const so = draw(s, s => order(s, { type: CMD.TRAIL, layer: SURFACE, points: [24, 25, 24, 31] }));
  run(s, 1800); // the 30 ants start out all at once; by now only one in three free ants goes out
  let outSum = 0, freeSum = 0, eastFree = 0, southFree = 0, resting = 0, moved = 0;
  const px = Int32Array.from(s.x), py = Int32Array.from(s.y);
  run(s, 1200, s => {
    let free = 0, out = 0;
    for (let i = 0; i < s.n; i++) {
      if (s.job[i] !== JOB.FORAGE || isCrew(s.via[i])) continue;
      free++;
      if (s.mode[i] !== MODE.REST) out++;
      if (s.via[i] === FREE_VIA + e.slot) eastFree++;
      if (s.via[i] === FREE_VIA + so.slot) southFree++;
      if (s.mode[i] === MODE.REST && s.layer[i] === NEST && s.y[i] >> 8 >= 10) { resting++; if (s.x[i] !== px[i] || s.y[i] !== py[i]) moved++; }
    }
    outSum += out; freeSum += free;
    px.set(s.x.subarray(0, px.length)); py.set(s.y.subarray(0, py.length));
  });
  // One in three goes out (rounded up).
  assert.ok(outSum / freeSum > 0.2 && outSum / freeSum <= 0.37, `free ants out: ${(outSum / freeSum).toFixed(3)} of them`);
  assert.ok(southFree > 1000, `free ants work the near trail: ${southFree}`);
  assert.equal(eastFree, 0, 'and never the far one');
  assert.ok(resting > 1000 && moved === 0, `resting ants stay still: ${moved} moves in ${resting}`);
  assert.ok(s.g[G.PROTEIN] > 400, 'free ants bring loads home');
});

/** Mean sub-cells a tick for crew and free foragers walking out alone along the east trail (x 27 to 35, not carrying). */
function pace(sugar) {
  const s = colony(4);
  s.g[G.SUGAR] = sugar; s.g[G.QUEEN] = 1; // with a queen, 0 sugar counts as starving
  const e = draw(s, east);
  assert.equal(want(s, e.slot), 1);
  const sum = { crew: 0, free: 0 }, n = { crew: 0, free: 0 };
  let px = Int32Array.from(s.x), pl = Uint8Array.from(s.layer);
  run(s, 1000, s => {
    for (let i = 0; i < s.n; i++) {
      if (s.layer[i] !== SURFACE || pl[i] !== SURFACE || s.carry[i] || s.mode[i] !== MODE.SEEK) continue;
      const x = s.x[i] >> 8, y = s.y[i] >> 8; if (x < 27 || x > 35 || y !== 24) continue;
      const kind = isCrew(s.via[i]) ? 'crew' : s.via[i] >= FREE_VIA ? 'free' : null; if (!kind) continue;
      let near = false; // another ant within 2 cells pushes her (separation): only lone steps are read
      for (let j = 0; j < s.n; j++) if (j !== i && s.layer[j] === SURFACE && Math.abs(s.x[j] - s.x[i]) < 512 && Math.abs(s.y[j] - s.y[i]) < 512) near = true;
      if (near) continue;
      sum[kind] += s.x[i] - px[i]; n[kind]++;
    }
    px = Int32Array.from(s.x); pl = Uint8Array.from(s.layer);
    s.g[G.SUGAR] = sugar; // loads home do not end the starving
  });
  assert.ok(n.crew > 10 && n.free > 10, `both walked: ${n.crew}, ${n.free}`);
  return { crew: sum.crew / n.crew, free: sum.free / n.free };
}

test('a crew walks its trail at 45 a tick, a free ant at 32; starving, both at half', () => {
  const fed = pace(400);
  assert.ok(fed.crew > 42 && fed.crew <= 45, `crew ${fed.crew}`);
  assert.ok(fed.free > 29 && fed.free <= 32, `free ${fed.free}`);
  const starving = pace(0);
  assert.ok(starving.crew > 20 && starving.crew <= 22.5, `starving crew ${starving.crew}`);
  assert.ok(starving.free > 14 && starving.free <= 16, `starving free ${starving.free}`);
});

test('the dig is an auto job: free ants in the nest take it while cells are marked, and come back free', () => {
  const s = colony(30);
  const e = draw(s, east);
  run(s, 300);
  order(s, { type: CMD.DIG, cells: [13, 9, 15, 9] }); run(s, 1);
  let diggers = 0, crewMax = 0;
  run(s, 2000, s => { let d = 0; for (let i = 0; i < s.n; i++) if (s.job[i] === JOB.DIG) d++; diggers = Math.max(diggers, d); crewMax = Math.max(crewMax, s.g[G.DIG_CREW]); });
  assert.equal(s.g[G.DIG_COUNT], 0, 'dug');
  assert.ok(diggers >= 2 && crewMax <= 8, `diggers ${diggers}, crew ${crewMax} (at most 4 a cell)`);
  run(s, 20);
  for (let i = 0; i < s.n; i++) assert.equal(s.job[i], JOB.FORAGE, `ant ${i} is free again`);
  assert.equal(s.g[G.DIG_CREW], 0);
  assert.ok(crewOf(s, e.slot) > 0, 'the crew kept working');
});

test('starving: after a minute at 0 sugar the oldest adults die, one every 10 s here, the queen last', () => {
  const s = colony(3);
  s.g[G.QUEEN] = 1; s.g[G.SUGAR] = 0; // no sugar, so the queen lays no eggs either
  order(s, { type: CMD.RECALL, on: true }); // everyone stays still in the nest, so the dead are easy to tell
  run(s, 300);
  const died = [];
  let xs = Array.from(s.x.subarray(0, s.n));
  run(s, STARVE_AFTER + 3 * STARVE_EVERY + 10 - 300, s => { if (s.n < xs.length) { died.push(s.g[G.STARVE]); assert.deepEqual(Array.from(s.x.subarray(0, s.n)), xs.slice(1), 'the oldest (first) ant died'); } xs = Array.from(s.x.subarray(0, s.n)); });
  assert.deepEqual(died, [STARVE_AFTER + STARVE_EVERY, STARVE_AFTER + 2 * STARVE_EVERY, STARVE_AFTER + 3 * STARVE_EVERY].map(t => t + 0));
  assert.equal(s.n, 0); assert.equal(s.g[G.QUEEN], 1, 'the queen outlives the workers');
  run(s, STARVE_EVERY);
  assert.equal(s.g[G.QUEEN], 0);
  // Sugar again stops it.
  const t = colony(3); t.g[G.QUEEN] = 1; t.g[G.SUGAR] = 0;
  run(t, STARVE_AFTER + 100); t.g[G.SUGAR] = 5; run(t, 1); assert.equal(t.g[G.STARVE], 0);
  t.g[G.SUGAR] = 0; run(t, STARVE_AFTER + STARVE_EVERY - 1); assert.equal(t.g[G.DIED], 0, 'the minute starts again');
});

test('a snapshot taken with levels, a count, a dig and starvation under way plays on the same', () => {
  const a = colony(30);
  const e = draw(a, east); run(a, 300); const so = draw(a, south); run(a, 300);
  level(a, e.seq, 3); order(a, { type: CMD.CREW, seq: so.seq, delta: 2 }); order(a, { type: CMD.DIG, cells: [13, 9] }); run(a, 150);
  a.g[G.QUEEN] = 1; run(a, STARVE_AFTER + STARVE_EVERY + 50, a => { a.g[G.SUGAR] = 0; }); // one starving death
  kill(a, 4); run(a, 5);
  assert.ok(a.g[G.WORKFORCE] > 0 && a.g[G.STARVE] > STARVE_AFTER + STARVE_EVERY && a.g[G.DIED] > 0);
  const b = restore(snapshot(a));
  assert.deepEqual(b.hashes(), a.hashes());
  run(a, 600); run(b, 600);
  assert.deepEqual(b.hashes(), a.hashes());
});

test('crew, free and dig counts match the ants after every ant\'s step, through give-ups, digs and resizes', () => {
  const s = colony(30);
  const e = draw(s, east); run(s, 200); draw(s, south);
  order(s, { type: CMD.DIG, cells: [13, 9, 15, 9] });
  const step = s.stepAnt.bind(s);
  let bad = [];
  s.stepAnt = i => {
    step(i);
    let free = 0, out = 0, dig = 0; const crew = [0, 0, 0, 0];
    for (let j = 0; j < s.n; j++) {
      if (s.hp[j] === 0) continue;
      if (s.job[j] === JOB.DIG && s.mode[j] === MODE.WORK) dig++;
      if (s.job[j] !== JOB.FORAGE) continue;
      if (isCrew(s.via[j])) crew[s.via[j] - SLOT.TRAIL0]++; else { free++; if (s.mode[j] !== MODE.REST) out++; }
    }
    for (let k = 0; k < SLOT.TRAILS; k++) if (crew[k] !== s.crew[k]) bad.push(`tick ${s.tick} ant ${i}: crew ${k} ${s.crew[k]}, counted ${crew[k]}`);
    if (free !== s.freeAll || out !== s.freeOut) bad.push(`tick ${s.tick} ant ${i}: free ${s.freeAll}/${s.freeOut}, counted ${free}/${out}`);
    if (dig !== s.g[G.DIG_CREW]) bad.push(`tick ${s.tick} ant ${i}: dig ${s.g[G.DIG_CREW]}, counted ${dig}`);
  };
  run(s, 1500, s => {
    if (s.tick % 50 === 0) for (let i = 0; i < s.n; i++) if (s.via[i] >= 0 && s.mode[i] === MODE.SEEK) s.since[i] = 0xFFF0; // every 50 ticks the walkers give up
    if (s.tick === 700) kill(s, 5); // a resize
    if (s.tick === 900) order(s, { type: CMD.CREW, seq: e.seq, delta: -64 });
  });
  assert.deepEqual(bad.slice(0, 5), []);
});

test('a crew order for no live trail, or with no change and no level, is rejected; a replaced trail starts Steady', () => {
  const s = colony();
  const e = draw(s, east);
  order(s, { type: CMD.CREW, seq: e.seq + 99, delta: 1 });
  order(s, { type: CMD.CREW, seq: e.seq, delta: 0 });
  order(s, { type: CMD.CREW, seq: e.seq + 99, delta: 0, level: 3 });
  const ev = run(s, 1);
  assert.equal(ev.filter(x => x[0] === EVENT.REJECTED).length, 3);
  order(s, { type: CMD.CREW, seq: e.seq, delta: 5 }); run(s, 1);
  assert.equal(s.g[G.LEVEL0 + e.slot - SLOT.TRAIL0], 0);
  // Four more trails: the fifth reuses the oldest slot (this one).
  for (let k = 0; k < 4; k++) { order(s, { type: CMD.TRAIL, layer: SURFACE, points: [25, 23 - k, 38, 20 - k] }); run(s, 1); }
  assert.notEqual(s.flow.seq[e.slot], e.seq, 'the slot holds a new trail');
  assert.equal(s.g[G.LEVEL0 + e.slot - SLOT.TRAIL0], 2);
});

test('encoded crew orders: a level rides along only when it is 1 to 3; a missing change is refused, a huge one clamped', () => {
  const head = { tick: 0, id: 1, seat: 0, type: CMD.CREW, seq: 7 };
  assert.equal(encodeCommand({ ...head, delta: 2 }).length, 6);
  assert.equal(encodeCommand({ ...head, delta: 0, level: 3 }).at(-1), 3);
  assert.equal(encodeCommand({ ...head, delta: 0, level: 3 }).length, 7);
  assert.equal(encodeCommand({ ...head, delta: 1, level: 9 }).length, 6, 'no level 9');
  const s = colony(4);
  const e = draw(s, east);
  assert.equal(want(s, e.slot), 1);
  order(s, { type: CMD.CREW, seq: e.seq, delta: 2 ** 31 }); run(s, 1);
  assert.equal(want(s, e.slot), 1 + 64, 'clamped to +64 from the Steady count');
  const short = Int32Array.from([s.tick, 0, ++id, CMD.CREW, e.seq]); // no change word
  s.queueCommand(short);
  assert.equal(run(s, 1).filter(x => x[0] === EVENT.REJECTED).length, 1);
});

test('the game\'s start: a dig ordered before any trail gets diggers from the ants resting outside', async () => {
  const { Host } = await import('../host.js');
  const h = new Host(0, 1, { colony: true }), s = h.sim, H = s.home, cells = [];
  for (let y = H.y; y < H.y + H.h; y++) for (let x = H.x + H.w; x < H.x + H.w + 3; x++) if (s.mat[cellAt(s.L, NEST, x, y)] !== MAT.OPEN) cells.push(x, y);
  assert.ok(cells.length >= 6);
  while (s.tick < 20) h.step();
  h.order({ type: CMD.DIG, cells });
  while (s.tick < 250) h.step();
  assert.equal(s.g[G.DUG], cells.length / 2, `dug ${s.g[G.DUG]} of ${cells.length / 2} by 12.5 s`);
});
