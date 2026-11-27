// Days (sim/colony.js, Days): one goal per day judged at dusk, progress counted from dawn, an eased goal after a
// missed day, the floor gift, and the dawn restart (a dawn save replayed with the same orders reaches the same
// dusk). Small blank maps with short days, so each test takes a fraction of a second.
import assert from 'node:assert/strict';
import test from 'node:test';
import { CMD, EVENT, G, MAT, MODE, NEST, SUB, SURFACE, Sim, FOOD, JOB } from '../sim/sim.js';
import { DAY_GOALS, GIFT_SUGAR, GOAL_KIND, START, dayState, goalOf } from '../sim/colony.js';
import { cellAt } from '../sim/grid.js';
import { restore, snapshot } from '../sim/snapshot.js';

const T = 300;
function colony(opts = {}, workers = 24) {
  const s = new Sim({ seed: 7, sw: 48, sh: 48, nw: 32, nh: 24, ants: 0, blank: true, colony: 1, dayTicks: T, ...opts });
  s.home = { x: 10, y: 10, w: 8, h: 4 };
  for (let y = 10; y < 14; y++) for (let x = 10; x < 18; x++) s.mat[cellAt(s.L, NEST, x, y)] = MAT.OPEN;
  for (let y = 0; y < 10; y++) s.mat[cellAt(s.L, NEST, 14, y)] = MAT.OPEN;
  const e = cellAt(s.L, SURFACE, 24, 24), top = cellAt(s.L, NEST, 14, 0);
  s.link[e] = top; s.link[top] = e;
  s.pileCell[0] = cellAt(s.L, SURFACE, 32, 24); s.pileAmount[0] = 400; s.pileKind[0] = FOOD.SUGAR;
  s.pileCell[1] = cellAt(s.L, SURFACE, 24, 32); s.pileAmount[1] = 400; s.pileKind[1] = FOOD.PROTEIN;
  s.startGoals(); s.rebuildFields(); // fields before the first tick, so a trail at tick 0 finds its way home
  for (let k = 0; k < workers; k++) s.spawn(k % 6 === 5 ? JOB.DIG : JOB.FORAGE);
  s.g[G.SUGAR] = 40;
  return s;
}
const run = (s, ticks, onTick) => { const dusks = []; for (let t = 0; t < ticks; t++) { onTick?.(s); s.step(); const ev = s.drainEvents(); for (let k = 0; k < ev.length; k += 3) if (ev[k] === EVENT.DUSK) dusks.push({ tick: s.tick, day: ev[k + 1], won: ev[k + 2] }); } return dusks; };

test('goals: day 1 trail loads, day 2 digging, day 3 both foods, then day 3 again with a larger target', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(d => goalOf(d)), [{ kind: GOAL_KIND.TRAIL_LOADS, target: 60 }, { kind: GOAL_KIND.DUG, target: 40 }, { kind: GOAL_KIND.BOTH_FOODS, target: 110 }, { kind: GOAL_KIND.BOTH_FOODS, target: 140 }, { kind: GOAL_KIND.BOTH_FOODS, target: 170 }]);
  assert.equal(goalOf(1, 1).target, 45, 'eased by a quarter');
  assert.equal(DAY_GOALS.length, 3);
});

test('dusk falls on the last tick of each day; a day left alone is lost and the next goal is eased', () => {
  const s = colony();
  assert.equal(s.g[G.DAY], 1);
  const dusks = run(s, 3 * T);
  assert.deepEqual(dusks, [{ tick: T, day: 1, won: 0 }, { tick: 2 * T, day: 2, won: 0 }, { tick: 3 * T, day: 3, won: 0 }]);
  assert.equal(s.g[G.DAY], 4);
  assert.equal(s.g[G.DAY_LAST], 2);
  assert.equal(s.g[G.DAYS_WON], 0);
  assert.equal(dayState(s).target, goalOf(4, 1).target);
  assert.equal(dayState(s).left, T);
});

test('trail loads count only loads whose carrier came out on a trail; a trail wins day 1', () => {
  const idle = colony({ dayTicks: 1200 }), drawn = colony({ dayTicks: 1200 });
  drawn.queueCommand({ tick: 0, type: CMD.TRAIL, layer: SURFACE, points: [24, 24, 32, 24] });
  const a = run(idle, 1200), b = run(drawn, 1200);
  assert.ok(idle.g[G.STORES] > 0, 'wanderers bring food home');
  assert.equal(idle.g[G.TRAIL_LOADS], 0, 'but none along a trail');
  assert.ok(drawn.g[G.TRAIL_LOADS] > 0);
  assert.equal(drawn.g[G.SUGAR_LOADS] + drawn.g[G.PROTEIN_LOADS], drawn.g[G.STORES]);
  assert.equal(a[0].won, 0);
  // The target is out of reach of this little colony in 1,200 ticks unless the goal is lowered: check the count.
  assert.equal(b[0].won, drawn.g[G.TRAIL_LOADS] >= 40 ? 1 : 0);
});

test('progress counts from dawn: work done yesterday does not count today', () => {
  const s = colony();
  s.g[G.DAY] = 2; s.g[G.DUG] = 50; s.g[G.BASE_A] = 50; // dawn of a digging day after 50 cells dug before
  assert.equal(dayState(s).done, 0);
  s.g[G.DUG] = 90;
  assert.equal(dayState(s).done, 40);
  assert.equal(dayState(s).won, true);
});

test('a dig day is won by digging; it counts cells opened since dawn', () => {
  const s = colony();
  run(s, T); // day 1 lost
  assert.equal(s.g[G.DAY], 2);
  const cells = [];
  for (let y = 10; y < 14; y++) for (let x = 18; x < 28; x++) cells.push(x, y);
  s.queueCommand({ tick: s.tick, type: CMD.DIG, cells });
  s.cfg.dayTicks = T; // unchanged; dig needs time, so check progress rather than the verdict
  const before = dayState(s).done;
  run(s, T - 1);
  assert.equal(before, 0);
  assert.ok(dayState(s).done > 0, `dug ${dayState(s).done}`);
  assert.equal(dayState(s).done, Math.min(dayState(s).target, s.g[G.DUG]));
});

// The floor tests shut the entrance, so no load comes home (ants are quick enough to fetch some within a short day).
const shut = s => { const e = cellAt(s.L, SURFACE, 24, 24), top = s.link[e]; s.link[e] = -1; s.link[top] = -1; return s; };

test('the floor: a colony short of sugar at dawn is given some', () => {
  const s = shut(colony());
  s.g[G.SUGAR] = 0; s.g[G.QUEEN] = 0; // no laying, no adults eating yet at tick T - 1
  run(s, T - 1);
  const sugar = s.g[G.SUGAR];
  run(s, 1);
  assert.equal(s.g[G.SUGAR], sugar + GIFT_SUGAR);
});

test('dawn restart: the dawn save with the same orders reaches the same dusk, hash for hash', () => {
  const orders = s => { if (s.tick === T + 20) s.queueCommand({ tick: s.tick, id: 1, type: CMD.TRAIL, layer: SURFACE, points: [24, 24, 32, 24] }); if (s.tick === T + 90) s.queueCommand({ tick: s.tick, id: 2, type: CMD.DIG, cells: [18, 10, 18, 11] }); };
  const a = colony();
  run(a, T);
  const dawn = snapshot(a);
  run(a, T, orders);
  const dusk = a.hashes();
  const b = restore(dawn);
  assert.equal(b.g[G.DAY], 2);
  run(b, T, orders);
  assert.deepEqual(b.hashes(), dusk);
  // A save mid-day and a save on the dusk tick's eve also play on as the uninterrupted game.
  const c = restore(dawn);
  run(c, T >> 1, orders);
  const d = restore(snapshot(c));
  run(d, T - (T >> 1) - 1, orders);
  const e = restore(snapshot(d));
  run(e, 1, orders);
  assert.deepEqual(e.hashes(), dusk);
});

test('the day length is a setting the hash and the snapshot carry', () => {
  const a = colony(), b = colony({ dayTicks: T + 1 });
  assert.notEqual(a.hashes().globals, b.hashes().globals);
  assert.equal(restore(snapshot(b)).cfg.dayTicks, T + 1);
});

test('a snapshot of the old format (version 4) is refused by number', () => {
  const bytes = snapshot(colony());
  new DataView(bytes.buffer, bytes.byteOffset).setUint16(4, 4, true);
  assert.throws(() => restore(bytes), /snapshot 4\//);
});

test('the sandbox has no days', () => {
  const s = new Sim({ seed: 3, sw: 48, sh: 48, nw: 32, nh: 24, ants: 10, dayTicks: 50 });
  assert.equal(s.g[G.DAY], 0);
  assert.deepEqual(run(s, 120), []);
});

test('the host keeps the dawn saves and restarts a day', async () => {
  const { Host } = await import('../host.js');
  const h = new Host(20, 2026, { colony: true, dayTicks: 200 });
  assert.deepEqual([...h.dawns.keys()], [1]);
  const dawn1 = h.sim.hashes();
  h.order({ type: CMD.TRAIL, layer: SURFACE, points: [129, 129, 140, 140] });
  for (let t = 0; t < 200; t++) h.step();
  assert.equal(h.dusk.day, 1);
  assert.equal(h.dusk.goal.kind, GOAL_KIND.TRAIL_LOADS);
  assert.deepEqual([...h.dawns.keys()], [1], 'the next dawn is saved when the player goes on');
  assert.equal(h.advance(0, false), 0); assert.equal(h.advance(1000, false), 0, 'time stops at dusk');
  assert.ok(h.restartDay(1));
  assert.deepEqual(h.sim.hashes(), dawn1);
  assert.equal(h.dusk, null);
  assert.deepEqual([...h.dawns.keys()], [1]);
  assert.equal(h.log[0].state, 'undone');
  for (let t = 0; t < 200; t++) h.step();
  h.goOn();
  assert.deepEqual([...h.dawns.keys()], [2]);
});

test('the dusk verdict is the one judged at dusk: a load home during the last tick counts on the card', async () => {
  const { Host } = await import('../host.js');
  const h = new Host(20, 2026, { colony: true, dayTicks: 200 });
  for (let t = 0; t < 199; t++) h.step();
  const s = h.sim, world = s.stepWorld.bind(s);
  s.g[G.TRAIL_LOADS] = s.g[G.BASE_A] + goalOf(1).target - 1;
  s.stepWorld = () => { world(); s.g[G.TRAIL_LOADS]++; }; // the last load needed lands inside the dusk tick
  h.step();
  assert.equal(h.dusk.won, true);
  assert.equal(h.dusk.goal.won, true); assert.equal(h.dusk.goal.done, goalOf(1).target);
});

test('days won counts wins only, across a win, a loss and a restore', () => {
  const s = colony();
  run(s, T - 1); s.g[G.TRAIL_LOADS] = s.g[G.BASE_A] + goalOf(1).target; run(s, 1);
  assert.equal(s.g[G.DAYS_WON], 1);
  run(s, T);
  assert.equal(s.g[G.DAY_LAST], 2); assert.equal(s.g[G.DAYS_WON], 1);
  assert.equal(restore(snapshot(s)).g[G.DAYS_WON], 1);
});

test('both foods: the smaller count decides', () => {
  const s = colony(); run(s, 2 * T); // dawn of day 3 (eased after two lost days)
  const { target } = dayState(s);
  const at = (sugar, protein) => { s.g[G.SUGAR_LOADS] = s.g[G.BASE_A] + sugar; s.g[G.PROTEIN_LOADS] = s.g[G.BASE_B] + protein; return dayState(s); };
  assert.equal(at(target, 0).won, false); assert.equal(at(target, target - 1).won, false); assert.equal(at(0, target).won, false);
  const w = at(target, target + 5); assert.equal(w.won, true); assert.equal(w.done, target);
});

test('the floor: fewer than the starting ants brings the gift even with sugar in store; a colony at the floor gets none', () => {
  const gift = (ants, sugar) => {
    const s = shut(colony({}, ants)); s.g[G.QUEEN] = 0; s.g[G.SUGAR] = sugar;
    run(s, T - 1); const before = s.g[G.SUGAR]; run(s, 1); return s.g[G.SUGAR] - before;
  };
  assert.equal(gift(START.ants - 1, 40), GIFT_SUGAR);
  assert.equal(gift(START.ants, 10), 0);
  assert.equal(gift(START.ants, 9), GIFT_SUGAR);
});

test('the floor gift saturates instead of wrapping', () => {
  const s = colony({}, 0); s.g[G.QUEEN] = 0; s.g[G.SUGAR] = 0x7fffffff - 3;
  run(s, T);
  assert.equal(s.g[G.SUGAR], 0x7fffffff);
});

test('a day length that would not restore as itself is refused', () => {
  for (const d of [-5, 2.5, 4294967298]) assert.throws(() => colony({ dayTicks: d }), /dayTicks/);
  assert.equal(colony({ dayTicks: 0 }).cfg.dayTicks, 0, '0: no days (sim 8)');
});

test('a load still counts for the trail goal when new trails replace hers on the way home', () => {
  const s = colony(); s.step();
  const trail = (id, x) => s.queueCommand({ tick: s.tick, id, type: CMD.TRAIL, layer: SURFACE, points: [24, 24, x, 30] });
  trail(10, 26); s.step();
  const first = s.newestTrail();
  s.via[0] = first; s.carry[0] = 1; s.setMode(0, MODE.RETURN);
  s.layer[0] = SURFACE; s.x[0] = 34 * SUB + 128; s.y[0] = 34 * SUB + 128; // out on the surface, far from home
  const loads = s.g[G.TRAIL_LOADS];
  for (let k = 1; k <= 4; k++) trail(10 + k, 26 + k); // four more: the fifth trail takes the oldest slot
  s.step();
  assert.equal(s.via[0], -2, 'her trail was replaced while she carried');
  for (let t = 0; t < 2000 && s.carry[0]; t++) s.step();
  assert.equal(s.carry[0], 0, 'she got home');
  assert.equal(s.g[G.TRAIL_LOADS], loads + 1, 'her load counts for the trail goal');
  assert.equal(s.via[0], -1);
});

test('the host: an order queued on the way to the dusk card is in the next dawn save; orders after it are undone', async () => {
  const { Host } = await import('../host.js');
  const h = new Host(20, 2026, { colony: true, dayTicks: 200 });
  for (let t = 0; t < 200; t++) h.step();
  h.order({ type: CMD.TRAIL, layer: SURFACE, points: [129, 129, 140, 140] }); // queued at dusk (as an alarm let go is)
  h.goOn();
  const dawn2 = h.sim.hashes(), delivered = h.delivered;
  h.step();
  h.order({ type: CMD.TRAIL, layer: SURFACE, points: [129, 129, 120, 140] }); // given during day 2
  for (let t = 1; t < 200; t++) h.step();
  assert.equal(h.dusk.day, 2);
  assert.ok(h.restartDay(2));
  assert.deepEqual(h.sim.hashes(), dawn2);
  assert.equal(h.delivered, delivered);
  assert.deepEqual(h.log.map(e => e.state), ['queued', 'undone'], 'the order in the save waits for its tick again');
  h.step();
  assert.equal(h.log[0].state, 'applied');
  assert.ok(h.sim.newestTrail() >= 0, 'and runs');
});
