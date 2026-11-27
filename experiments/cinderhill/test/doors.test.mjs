// Doors (SIM_VERSION 10, 02-spec 3.2 Doors and Recall). A colony game's entrance is 3 cells wide. Each entrance cell
// has two lanes, out and in, and each lets 6 ants a second through. An ant at a lane with no room waits ("queued").
// A door is jammed once 10 or more ants have queued at it for 5 s. Under Recall the way in is not limited. The
// sandbox keeps its old 2-cell entrance with no lanes.
import assert from 'node:assert/strict';
import test from 'node:test';
import { CMD, EVENT, G, JAM_AT, JAM_FOR, JOB, LANE_RATE, MAT, MODE, NEST, PASS, SURFACE, Sim } from '../sim/sim.js';
import { cellAt } from '../sim/grid.js';
import { restore, snapshot } from '../sim/snapshot.js';

/** A small colony with a one-cell door: the nest's porch under it, `workers` foragers in the porch, one long trail. */
function oneDoor(workers) {
  const s = new Sim({ seed: 5, sw: 48, sh: 48, nw: 32, nh: 24, ants: 0, maxAnts: 400, blank: true, colony: 1, dayTicks: 20000 });
  s.home = { x: 10, y: 10, w: 8, h: 4 };
  for (let y = 10; y < 14; y++) for (let x = 10; x < 18; x++) s.mat[cellAt(s.L, NEST, x, y)] = MAT.OPEN;
  for (let y = 0; y < 10; y++) s.mat[cellAt(s.L, NEST, 14, y)] = MAT.OPEN;
  const e = cellAt(s.L, SURFACE, 24, 24), top = cellAt(s.L, NEST, 14, 0);
  s.link[e] = top; s.link[top] = e;
  s.startGoals(); s.rebuildFields();
  for (let k = 0; k < workers; k++) s.spawn(JOB.FORAGE);
  s.g[G.SUGAR] = 4000; s.g[G.PROTEIN] = 400; s.g[G.QUEEN] = 0; s.brood.n = 0;
  return { s, e, top };
}
let id = 0;
const order = (s, o) => s.queueCommand({ tick: s.tick, id: ++id, seat: 0, ...o });
const events = s => { const e = s.drainEvents(), out = []; for (let j = 0; j < e.length; j += 3) out.push([e[j], e[j + 1], e[j + 2]]); return out; };
const outside = s => { let n = 0; for (let i = 0; i < s.n; i++) if (s.layer[i] === SURFACE) n++; return n; };

test('the lane numbers: 6 passes a second, a burst of two from a rested lane', () => {
  assert.equal(PASS, 20); assert.equal(LANE_RATE, 6, 'six twentieths of a pass a tick: 6 a second at 20 ticks a second');
  assert.equal(JAM_AT, 10); assert.equal(JAM_FOR, 100, '5 s');
});

test('a one-cell door lets 6 ants a second out, and the rest wait still at it, queued', () => {
  const { s, top } = oneDoor(60);
  for (let i = 0; i < s.n; i++) { s.mode[i] = MODE.SEEK; s.x[i] = (14 << 8) + 128; s.y[i] = (0 << 8) + 128; s.layer[i] = NEST; s.lastCell[i] = top; } // all at the door, inside
  order(s, { type: CMD.TRAIL, layer: SURFACE, points: [25, 24, 40, 24] });
  order(s, { type: CMD.CREW, seq: 0, delta: 0, level: 3 }); // a Surge crew: 30 of them want out at once
  s.step(); events(s);
  const before = outside(s);
  let queuedMax = 0, moved = 0;
  const px = Int32Array.from(s.x), py = Int32Array.from(s.y);
  for (let t = 0; t < 100; t++) {
    s.step();
    queuedMax = Math.max(queuedMax, s.g[G.QUEUED]);
    let flags = 0; for (let i = 0; i < s.n; i++) flags += s.queued[i];
    assert.equal(s.g[G.QUEUED], flags, 'the queue count is the ants queued');
    for (let i = 0; i < s.n; i++) if (s.queued[i] && (s.x[i] !== px[i] || s.y[i] !== py[i]) && s.layer[i] === NEST) moved++;
    px.set(s.x.subarray(0, px.length)); py.set(s.y.subarray(0, py.length));
  }
  const out = outside(s) - before;
  assert.ok(out >= 29 && out <= 31, `5 s at 6 a second: ${out} out`);
  assert.ok(queuedMax >= 10, `a queue forms: ${queuedMax}`);
  assert.equal(moved, 0, 'a queued ant waits where she is');
});

test('out and in are separate lanes: ants coming home pass while the way out is full', () => {
  const { s, e, top } = oneDoor(40);
  for (let i = 0; i < 20; i++) { s.mode[i] = MODE.SEEK; s.x[i] = (14 << 8) + 128; s.y[i] = 128; s.layer[i] = NEST; s.lastCell[i] = top; }
  for (let i = 20; i < 40; i++) { s.mode[i] = MODE.RETURN; s.carry[i] = 1; s.via[i] = -1; s.x[i] = (24 << 8) + 128; s.y[i] = (24 << 8) + 128; s.layer[i] = SURFACE; s.lastCell[i] = e; }
  order(s, { type: CMD.TRAIL, layer: SURFACE, points: [25, 24, 40, 24] });
  order(s, { type: CMD.CREW, seq: 0, delta: 20, level: 0 });
  s.step();
  let inn = 0, out = 0;
  for (let t = 0; t < 40; t++) {
    const L = Uint8Array.from(s.layer.subarray(0, s.n));
    s.step();
    for (let i = 0; i < s.n; i++) { if (L[i] === SURFACE && s.layer[i] === NEST) inn++; if (L[i] === NEST && s.layer[i] === SURFACE) out++; }
  }
  assert.ok(inn >= 12 && inn <= 14, `in: ${inn} in 2 s`);
  assert.ok(out >= 12 && out <= 14, `out: ${out} in 2 s`);
});

test('a door is jammed after 10 queue at it for 5 s, and clear once fewer than 10 wait', () => {
  const { s, top } = oneDoor(80);
  for (let i = 0; i < s.n; i++) { s.mode[i] = MODE.SEEK; s.x[i] = (14 << 8) + 128; s.y[i] = 128; s.layer[i] = NEST; s.lastCell[i] = top; }
  order(s, { type: CMD.TRAIL, layer: SURFACE, points: [25, 24, 40, 24] });
  order(s, { type: CMD.CREW, seq: 0, delta: 80, level: 0 });
  let from = -1, jam = -1, clear = -1;
  for (let t = 0; t < 800 && clear < 0; t++) {
    s.step();
    if (from < 0 && s.g[G.QUEUED] >= JAM_AT) from = s.tick;
    for (const [type, on] of events(s)) if (type === EVENT.JAM) { if (on) jam = s.tick; else clear = s.tick; }
    if (jam >= 0 && clear < 0) assert.equal(s.g[G.JAMMED], 1);
  }
  assert.ok(from >= 0 && jam >= 0, `jammed at ${jam}`);
  assert.equal(jam - from, JAM_FOR - 1, 'after 100 ticks of 10 or more queued');
  assert.ok(clear > jam, `clear at ${clear}`);
  assert.equal(s.g[G.JAMMED], 0); assert.equal(s.g[G.JAMS], 1);
});

test('Recall: the way in is not limited', () => {
  const { s, e } = oneDoor(40);
  for (let i = 0; i < s.n; i++) { s.mode[i] = MODE.SEEK; s.x[i] = (24 << 8) + 128; s.y[i] = (24 << 8) + 128; s.layer[i] = SURFACE; s.lastCell[i] = e; }
  order(s, { type: CMD.RECALL, on: true });
  let inn = 0;
  for (let t = 0; t < 10; t++) { const L = Uint8Array.from(s.layer.subarray(0, s.n)); s.step(); for (let i = 0; i < s.n; i++) if (L[i] === SURFACE && s.layer[i] === NEST) inn++; }
  assert.equal(inn, 40, `40 ants at the door under Recall: ${inn} in within half a second (the lane alone would pass 3 or 4)`);
  assert.equal(s.g[G.QUEUED], 0);
});

test('a colony game opens a 3-cell entrance; the sandbox keeps 2', () => {
  const links = s => { let n = 0; for (let c = 0; c < s.L.nestBase; c++) if (s.link[c] >= 0) n++; return n; };
  assert.equal(links(new Sim({ seed: 3, colony: 1, ants: 30 })), 3);
  assert.equal(links(new Sim({ seed: 3, ants: 30 })), 2);
});

test('the sandbox has no lanes: 60 ants at a one-cell door all pass', () => {
  const { s, top } = oneDoor(60);
  s.cfg.colony = 0;
  for (let i = 0; i < s.n; i++) { s.mode[i] = MODE.SEEK; s.x[i] = (14 << 8) + 128; s.y[i] = 128; s.layer[i] = NEST; s.lastCell[i] = top; }
  for (let t = 0; t < 10; t++) s.step();
  assert.ok(outside(s) > 40, `${outside(s)} out in half a second`);
});

test('a snapshot taken with a queue at the door plays on the same', () => {
  const { s, top } = oneDoor(60);
  for (let i = 0; i < s.n; i++) { s.mode[i] = MODE.SEEK; s.x[i] = (14 << 8) + 128; s.y[i] = 128; s.layer[i] = NEST; s.lastCell[i] = top; }
  order(s, { type: CMD.TRAIL, layer: SURFACE, points: [25, 24, 40, 24] });
  order(s, { type: CMD.CREW, seq: 0, delta: 60, level: 0 });
  for (let t = 0; t < 130; t++) s.step();
  assert.ok(s.g[G.QUEUED] >= 10 && s.g[G.JAMMED] === 1, `queued ${s.g[G.QUEUED]}, jammed ${s.g[G.JAMMED]}`);
  assert.ok(s.g[G.LANE0] > 0, 'a lane in debt');
  const b = restore(snapshot(s));
  assert.deepEqual(b.hashes(), s.hashes());
  for (let t = 0; t < 300; t++) { s.step(); b.step(); }
  assert.deepEqual(b.hashes(), s.hashes());
});

test('the route card says the door is jammed; the inspector says she waits her turn; the HUD counts the queue', async () => {
  const { Host } = await import('../host.js');
  const h = new Host(0, 1, { colony: true }), s = h.sim;
  // Stand in for a jam: the counts the sim keeps (a real jam is in the tests above).
  const ex = s.L.sw >> 1, ey = s.L.sh >> 1;
  h.order({ type: CMD.TRAIL, layer: SURFACE, points: [ex + 1, ey + 1, ex + 10, ey + 1] }); h.step();
  s.g[G.JAMMED] = 1; s.g[G.QUEUED] = 12; s.queued[0] = 1;
  const st = h.stats();
  assert.equal(st.jammed, true); assert.equal(st.queued, 12);
  assert.equal(st.trails[0].why, 'jammed');
  assert.equal(h.inspect(0).why, 'queued');
});

test('the queued marks follow the ants when one dies', () => {
  const { s, top } = oneDoor(60);
  for (let i = 0; i < s.n; i++) { s.mode[i] = MODE.SEEK; s.x[i] = (14 << 8) + 128; s.y[i] = 128; s.layer[i] = NEST; s.lastCell[i] = top; }
  order(s, { type: CMD.TRAIL, layer: SURFACE, points: [25, 24, 40, 24] });
  order(s, { type: CMD.CREW, seq: 0, delta: 60, level: 0 });
  for (let t = 0; t < 40; t++) s.step();
  assert.equal(s.layer[0], SURFACE, 'the first ant is out');
  assert.ok(s.queued[s.n - 1], 'the last one waits');
  s.hp[0] = 0; s.anyDead = true; s.step();
  let flags = 0; for (let i = 0; i < s.n; i++) { flags += s.queued[i]; if (s.queued[i]) assert.equal(s.layer[i], NEST, `ant ${i} marked queued is at the door inside`); }
  assert.equal(flags, s.g[G.QUEUED]);
});

test('an ant queued at a door is not idle, even resting with no route while a job has a gap', async () => {
  const { Observer } = await import('../spikes/replay-lab.mjs');
  const { SLOT } = await import('../sim/sim.js');
  const N = 4, arr = T => new T(N);
  const sim = {
    n: 1, tick: 0, g: new Int32Array(G.SIZE), pileCell: [], pileAmount: [], brood: { n: 0 }, cfg: { maxAnts: N, colony: 1 },
    carry: arr(Uint8Array), via: arr(Int8Array).fill(-1), mode: arr(Uint8Array), job: arr(Uint8Array), mem: arr(Int16Array).fill(-1), since: arr(Uint16Array), goal: arr(Int8Array).fill(-1), layer: arr(Uint8Array),
    queued: arr(Uint8Array), flow: { live: new Uint8Array(16), seq: new Uint32Array(16) }, crew: new Uint16Array(4), mat: new Uint8Array(1),
  };
  const o = new Observer({ sim, lastEvents: [] });
  sim.flow.live[SLOT.TRAIL0] = 1; // a trail with no crew size: a job with a gap
  sim.job[0] = JOB.FORAGE; sim.mode[0] = MODE.REST; sim.since[0] = 300; sim.layer[0] = NEST;
  o.gapRun = 99; o.look();
  assert.equal(o.idleMax, 1, 'resting with no route: idle');
  sim.queued[0] = 1; o.idleMax = 0; o.look();
  assert.equal(o.idleMax, 0, 'queued: counted apart');
});
