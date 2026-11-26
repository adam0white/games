// The colony (sim/colony.js): the queen lays while there is sugar, brood grows egg to larva to pupa to adult
// on protein, a hungry larva dies, a well-fed one becomes a major, loads fill the right store, and the fight
// hook takes hit points and removes the dead in index order. All on small blank maps, with exact tick counts.
import assert from 'node:assert/strict';
import test from 'node:test';
import { CMD, G, JOB, MAT, NEST, STAGE, SURFACE, Sim, CASTE, CASTE_HP, FOOD, LOAD } from '../sim/sim.js';
import { BITE_EVERY, C, CASTE_BITE, addBrood, hurt } from '../sim/colony.js';
import { cellAt } from '../sim/grid.js';
import { restore, snapshot } from '../sim/snapshot.js';
const LONG = process.env.CINDERHILL_LONG === '1' ? false : 'over 15 s: runs nightly (CINDERHILL_LONG=1)';

function colony({ larvae = 0, ...opts } = {}) {
  const s = new Sim({ seed: 7, sw: 48, sh: 48, nw: 32, nh: 24, ants: 0, blank: true, colony: 1, ...opts });
  s.home = { x: 10, y: 10, w: 8, h: 4 };
  for (let y = 10; y < 14; y++) for (let x = 10; x < 18; x++) s.mat[cellAt(s.L, NEST, x, y)] = MAT.OPEN;
  for (let y = 0; y < 10; y++) s.mat[cellAt(s.L, NEST, 14, y)] = MAT.OPEN;
  const e = cellAt(s.L, SURFACE, 24, 24), top = cellAt(s.L, NEST, 14, 0);
  s.link[e] = top; s.link[top] = e;
  for (let k = 0; k < larvae; k++) addBrood(s, STAGE.LARVA); // in the chamber opened above
  s.startGoals(); s.step();
  return s;
}

test('the queen lays one egg per sugar unit, every LAY_EVERY ticks, and stops when sugar runs out', () => {
  const s = colony();
  s.g[G.SUGAR] = 3;
  for (let t = 0; t < 4 * C.LAY_EVERY; t++) s.step();
  assert.equal(s.brood.n, 3);
  assert.equal(s.g[G.SUGAR], 0);
  for (let k = 0; k < 3; k++) assert.equal(s.brood.stage[k], STAGE.EGG);
  // Every egg lies in an open cell of the chamber.
  for (let k = 0; k < 3; k++) assert.equal(s.mat[s.brood.cell[k]], MAT.OPEN);
});

test('egg to adult takes EGG_TICKS + LARVA_FEEDS meals + PUPA_TICKS, eating protein', () => {
  const s = colony();
  s.g[G.SUGAR] = 1; s.g[G.PROTEIN] = C.LARVA_FEEDS;
  let laid = -1, larva = -1, pupa = -1, adult = -1;
  for (let t = 0; t < 14000 && adult < 0; t++) {
    s.step();
    const B = s.brood;
    if (laid < 0 && B.n === 1) laid = s.tick;
    if (larva < 0 && B.n && B.stage[0] === STAGE.LARVA) larva = s.tick;
    if (pupa < 0 && B.n && B.stage[0] === STAGE.PUPA) pupa = s.tick;
    if (adult < 0 && s.n === 1) adult = s.tick;
  }
  assert.equal(larva - laid, C.EGG_TICKS);
  assert.equal(pupa - larva, C.LARVA_FEEDS * C.FEED_EVERY);
  assert.equal(adult - pupa, C.PUPA_TICKS);
  assert.equal(s.g[G.PROTEIN], 0);
  assert.equal(s.caste[0], CASTE.WORKER);
  assert.equal(s.hp[0], CASTE_HP[CASTE.WORKER]);
  assert.equal(s.layer[0], NEST);
  assert.equal(s.g[G.BORN], 1);
});

test('a larva with no protein dies after LARVA_STARVE ticks; one with plenty becomes a major', () => {
  const a = colony({ larvae: 1 }); // colony() has stepped once: one tick without a meal
  for (let t = 0; t < C.LARVA_STARVE - 2; t++) a.step();
  assert.equal(a.brood.n, 1, 'alive one tick before');
  a.step();
  assert.equal(a.brood.n, 0, 'dead after LARVA_STARVE ticks with no meal');
  assert.equal(a.g[G.BROOD_LOST], 1);
  const b = colony({ larvae: 1 });
  b.g[G.PROTEIN] = 100;
  for (let t = 0; t < C.MAJOR_FEEDS * C.FEED_EVERY + C.PUPA_TICKS + 10 && b.n === 0; t++) b.step();
  assert.equal(b.n, 1);
  assert.equal(b.caste[0], CASTE.MAJOR);
  assert.equal(b.g[G.PROTEIN], 100 - C.MAJOR_FEEDS);
});

test('a load from a protein pile fills the protein store; from a sugar pile, the sugar store', () => {
  const s = colony();
  s.pileCell[0] = cellAt(s.L, SURFACE, 30, 24); s.pileAmount[0] = 50; s.pileKind[0] = FOOD.PROTEIN;
  s.pileCell[1] = cellAt(s.L, SURFACE, 24, 30); s.pileAmount[1] = 50; s.pileKind[1] = FOOD.SUGAR;
  s.startGoals();
  for (let k = 0; k < 6; k++) s.spawn(JOB.FORAGE);
  s.queueCommand({ tick: s.tick, type: CMD.TRAIL, layer: SURFACE, points: [24, 24, 30, 24] });
  for (let t = 0; t < 2500; t++) s.step();
  const protein = s.g[G.PROTEIN], sugar = s.g[G.SUGAR];
  assert.ok(protein >= 4 * LOAD[FOOD.PROTEIN], `protein ${protein}`);
  assert.equal(protein % LOAD[FOOD.PROTEIN], 0);
  assert.equal(sugar % LOAD[FOOD.SUGAR], 0);
  assert.equal((protein / LOAD[FOOD.PROTEIN]) + (sugar / LOAD[FOOD.SUGAR]), s.g[G.STORES]);
});

test('fight hook: ants of two teams bite on their own cooldown; the dead are removed in index order', () => {
  const s = colony({ colony: 0 });
  const at = (i, x, y) => { s.layer[i] = SURFACE; s.x[i] = x; s.y[i] = y; s.lastCell[i] = s.cellOfAnt(i); return i; };
  for (let k = 0; k < 4; k++) at(s.spawn(JOB.GUARD), 5 * 256 + 100 + 10 * k, 5 * 256 + 128);
  const foe = at(s.spawn(JOB.GUARD, CASTE.WORKER, 1), 5 * 256 + 130, 5 * 256 + 140);
  at(s.spawn(JOB.GUARD, CASTE.MAJOR), 40 * 256, 40 * 256); // far away; index 5, the only major
  const hp = [];
  for (let t = 0; t < 4 * BITE_EVERY && s.n === 6; t++) { s.step(); hp.push(s.n === 6 ? s.hp[foe] : 0); }
  // Four workers bite 2 each in the first tick (8 taken), then wait BITE_EVERY ticks: the foe (12) falls then.
  assert.equal(hp[0], CASTE_HP[0] - 4 * CASTE_BITE[0]);
  assert.equal(hp.length, BITE_EVERY + 1);
  assert.equal(s.n, 5, 'the foe is gone');
  for (let i = 0; i < s.n; i++) assert.equal(s.team[i], 0);
  assert.equal(s.g[G.DIED], 1);
  assert.equal(s.caste[4], CASTE.MAJOR, 'the far major moved down to index 4');
  assert.equal(s.hp[4], CASTE_HP[CASTE.MAJOR]);
});

test('fight hook: only ants that touch, on the same layer, bite; standing ants bite too', () => {
  const pair = (dx, layer2) => {
    const s = colony({ colony: 0 });
    const a = s.spawn(JOB.GUARD), b = s.spawn(JOB.GUARD, CASTE.WORKER, 1);
    for (const [i, x, l] of [[a, 14 * 256 + 128, NEST], [b, 14 * 256 + 128 + dx, layer2]]) { s.layer[i] = l; s.x[i] = x; s.y[i] = 11 * 256 + 128; s.lastCell[i] = s.cellOfAnt(i); }
    // Guards with no alarm stand still in the nest: they do not move this tick.
    s.step();
    return [s.hp[a], s.hp[b]];
  };
  assert.deepEqual(pair(100, NEST), [CASTE_HP[0] - CASTE_BITE[0], CASTE_HP[0] - CASTE_BITE[0]], 'touching: both bite');
  assert.deepEqual(pair(255, NEST), [CASTE_HP[0], CASTE_HP[0]], 'a cell apart: no bite');
  assert.deepEqual(pair(0, SURFACE), [CASTE_HP[0], CASTE_HP[0]], 'other layer: no bite');
  const diag = (() => {
    const s = colony({ colony: 0 });
    const a = s.spawn(JOB.GUARD), b = s.spawn(JOB.GUARD, CASTE.WORKER, 1);
    for (const [i, d] of [[a, 0], [b, 150]]) { s.layer[i] = NEST; s.x[i] = 14 * 256 + 50 + d; s.y[i] = 11 * 256 + 50 + d; s.lastCell[i] = s.cellOfAnt(i); }
    s.step();
    return [s.hp[a], s.hp[b]];
  })();
  assert.deepEqual(diag, [CASTE_HP[0], CASTE_HP[0]], '150 apart on both axes is not touching');
});

test('a snapshot taken mid-fight, and one with a death pending, play on as the uninterrupted game', () => {
  const make = () => {
    const s = colony({ colony: 0 });
    for (let k = 0; k < 6; k++) { const i = s.spawn(JOB.FORAGE, CASTE.WORKER, k & 1); s.layer[i] = SURFACE; s.x[i] = 30 * 256 + 60 * k; s.y[i] = 34 * 256 + 128; s.lastCell[i] = s.cellOfAnt(i); }
    return s;
  };
  const a = make();
  for (let t = 0; t < 3; t++) a.step();
  assert.ok(a.g[G.DIED] === 0 && Array.from(a.hp.subarray(0, a.n)).some(v => v < CASTE_HP[0]), 'mid-fight');
  hurt(a, 0, 255); // a death pending at the tick boundary
  const b = restore(snapshot(a));
  assert.equal(b.hashes().total, a.hashes().total);
  for (let t = 0; t < 60; t++) { a.step(); b.step(); assert.equal(b.hashes().total, a.hashes().total, `tick ${a.tick}`); }
  assert.ok(a.g[G.DIED] >= 1 && a.n < 6, "the pending death happened in both");
});

test('the hash covers the settings that steer later ticks; the sim keeps its own copy of them', () => {
  const h = cfg => colony(cfg).hashes().total;
  assert.notEqual(h({ maxAnts: 100 }), h({ maxAnts: 101 }));
  const blank = sw => new Sim({ seed: 1, sw, sh: 32 * 64 / sw, nw: 4, nh: 4, ants: 0, blank: true }).hashes().total;
  assert.notEqual(blank(32), blank(64), 'layer sizes');
  const spread = [6, 40, 48], s = new Sim({ seed: 1, sw: 16, sh: 16, nw: 4, nh: 4, ants: 0, blank: true, spread });
  spread[0] = 32;
  assert.equal(s.cfg.spread[0], 6);
});

test('a queen with no open cell keeps her sugar and lays as soon as there is room', () => {
  const s = colony();
  for (let y = 10; y < 14; y++) for (let x = 10; x < 18; x++) s.mat[cellAt(s.L, NEST, x, y)] = MAT.CLAY;
  s.g[G.SUGAR] = 1;
  s.step();
  assert.equal(s.brood.n, 0); assert.equal(s.g[G.SUGAR], 1);
  s.mat[cellAt(s.L, NEST, 12, 11)] = MAT.OPEN;
  s.step();
  assert.equal(s.brood.n, 1); assert.equal(s.g[G.SUGAR], 0);
});

test('a colony game round-trips through a snapshot with brood in every stage', () => {
  const s = colony({ larvae: 2, sugar: 30 });
  s.g[G.PROTEIN] = 6;
  for (let t = 0; t < 7000; t++) s.step();
  const stages = new Set(Array.from(s.brood.stage.subarray(0, s.brood.n)));
  assert.ok(stages.has(STAGE.EGG) && stages.has(STAGE.LARVA) && stages.has(STAGE.PUPA), `stages ${[...stages]}`);
  const bytes = snapshot(s), back = restore(bytes);
  assert.equal(back.hashes().total, s.hashes().total);
  for (let t = 0; t < 3000; t++) { s.step(); back.step(); }
  assert.equal(back.hashes().total, s.hashes().total);
});

test('the page host runs a colony game: births get new indices, stats count the brood', { skip: LONG }, async () => {
  const { Host } = await import('../host.js');
  const h = new Host(20, 2026, { colony: true });
  assert.equal(h.sim.n, 20);
  assert.equal(h.stats().colony.larvae, 4);
  h.sim.g[G.PROTEIN] = 40;
  for (let t = 0; t < C.MAJOR_FEEDS * C.FEED_EVERY + C.PUPA_TICKS + 2; t++) h.step(); // 40 protein: all four are fed to majors
  const st = h.stats();
  assert.ok(st.colony.born >= 4 && h.sim.n === 20 + st.colony.born, `born ${st.colony.born}, n ${h.sim.n}`);
  assert.equal(st.colony.eggs + st.colony.larvae + st.colony.pupae, h.sim.brood.n);
  assert.equal(h.pn, h.sim.n);
  // A death pending before a step (hurt between ticks) still renumbers: that tick is drawn without interpolation.
  hurt(h.sim, 0, 255);
  h.step();
  assert.ok(h.shifted && h.pn === 0);
  // The sandbox host is unchanged: no colony numbers.
  assert.equal(new Host(500).stats().colony, null);
});

test('a digger at work who dies leaves the dig crew', () => {
  const s = colony({ colony: 0 });
  const d = s.spawn(JOB.DIG);
  s.queueCommand({ tick: s.tick, type: CMD.DIG, cells: [18, 11, 19, 11] });
  for (let t = 0; t < 5 && s.g[G.DIG_CREW] === 0; t++) s.step();
  assert.equal(s.g[G.DIG_CREW], 1);
  hurt(s, d, 255);
  s.step();
  assert.equal(s.n, 0);
  assert.equal(s.g[G.DIG_CREW], 0);
});

test('the queen lays faster when sugar is plentiful', () => {
  const lays = sugar => { const s = colony(); s.g[G.SUGAR] = sugar; for (let t = 0; t < 4 * C.LAY_EVERY; t++) s.step(); return s.brood.n; };
  assert.equal(lays(C.LAY_RICH - 10), 4);
  assert.equal(lays(C.LAY_RICH + 10), 8); // ticks 0, 120, ..., 840
  assert.equal(lays(4 * C.LAY_RICH + 100), 16);
});

test('a chamber that starts left of a narrow nest restores to the same place', () => {
  const s = new Sim({ seed: 1, sw: 48, sh: 48, nw: 12, nh: 36, ants: 5, colony: 1, sugar: 5 });
  assert.ok(s.home.x < 0, `home.x ${s.home.x}`);
  for (let i = 0; i < s.n; i++) assert.ok(s.cellOfAnt(i) >= 0, `ant ${i} starts inside the nest`);
  const b = restore(snapshot(s));
  assert.equal(b.home.x, s.home.x);
  for (let t = 0; t < 300; t++) { s.step(); b.step(); }
  assert.equal(b.hashes().total, s.hashes().total);
});

test('the sandbox carries one kind: a load from a protein pile counts as one load, not protein', () => {
  const s = colony({ colony: 0 });
  s.pileCell[1] = cellAt(s.L, SURFACE, 30, 24); s.pileAmount[1] = 50; s.pileKind[1] = FOOD.PROTEIN;
  s.startGoals();
  for (let k = 0; k < 6; k++) s.spawn(JOB.FORAGE);
  s.queueCommand({ tick: s.tick, type: CMD.TRAIL, layer: SURFACE, points: [24, 24, 30, 24] });
  let carried2 = false;
  for (let t = 0; t < 2500; t++) { s.step(); for (let i = 0; i < s.n; i++) if (s.carry[i] === 2) carried2 = true; }
  assert.ok(s.g[G.STORES] > 0, 'loads came home');
  assert.equal(carried2, false);
  assert.equal(s.g[G.PROTEIN], 0);
});
