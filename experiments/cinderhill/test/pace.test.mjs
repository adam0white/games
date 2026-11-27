// The start of a colony game (sim 8, 02-spec 3.2): 30 adults, the porch store, near food, twelve brood due from 8 s
// one every 3 s, the late find at 2:00; and with days (?day=), new piles fall at WINDFALL_AT, protein first.
import assert from 'node:assert/strict';
import test from 'node:test';
import { Host } from '../host.js';
import { EVENT, FOOD, G, JOB, MAT, NEST, SLOT, SURFACE, Sim } from '../sim/sim.js';
import { cellAt } from '../sim/grid.js';
import { C, DAY_TICKS, START } from '../sim/colony.js';
import { LATE_FIND_AT, WINDFALL_AT } from '../sim/world.js';

test('the start: 20 foragers by the entrance, 10 nurses, the porch store, and food 8 to 12 cells out', () => {
  for (const seed of [1, 2, 3, 8, 2026]) {
    const s = new Host(0, seed, { colony: true }).sim, L = s.L, ex = L.sw >> 1, ey = L.sh >> 1;
    assert.equal(s.n, START.ants);
    let surface = 0;
    for (let i = 0; i < s.n; i++) {
      if (s.layer[i] === SURFACE) { surface++; assert.equal(s.job[i], JOB.FORAGE); assert.ok(Math.abs((s.x[i] >> 8) - ex) <= 3 && Math.abs((s.y[i] >> 8) - ey) <= 3, 'by the entrance'); }
      else { assert.equal(s.layer[i], NEST); assert.equal(s.job[i], JOB.NURSE); }
    }
    assert.equal(surface, START.surface);
    assert.deepEqual([s.g[G.SUGAR], s.g[G.PROTEIN]], [10, 5]);
    assert.equal(s.home.y, 3, 'the porch store is 3 cells under the entrance');
    assert.equal(s.nursery.w * s.nursery.h, C.NURSERY);
    const cells = Array.from(s.brood.cell.subarray(0, s.brood.n));
    assert.equal(s.brood.n, 52); assert.equal(new Set(cells).size, 52, 'one brood per cell');
    for (const [p, kind, amount] of [[0, FOOD.SUGAR, 30], [1, FOOD.PROTEIN, 20]]) {
      const c = s.pileCell[p], d = Math.hypot(c % L.sw - ex, Math.floor(c / L.sw) - ey);
      assert.equal(s.pileKind[p], kind); assert.equal(s.pileAmount[p], amount);
      assert.ok(d >= 8 && d <= 12, `seed ${seed} pile ${p} ${d.toFixed(1)} cells out`);
    }
  }
});

test('on 60 seeds the opening food is 8 to 12 cells out; on a small map the late-find stone leaves the opening piles open', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const s = new Sim({ seed, colony: 1, nh: 64, ants: 0 }), L = s.L, ex = L.sw >> 1, ey = L.sh >> 1;
    for (const p of [0, 1]) {
      const c = s.pileCell[p], d = Math.hypot(c % L.sw - ex, Math.floor(c / L.sw) - ey);
      assert.ok(d >= 8 && d <= 12, `seed ${seed} pile ${p} ${d.toFixed(2)} cells out`);
    }
    const m = new Sim({ seed, sw: 28, sh: 28, nw: 32, nh: 24, colony: 1, ants: 0 });
    for (const p of [0, 1]) {
      const c = m.pileCell[p], x = c % m.L.sw, y = Math.floor(c / m.L.sw);
      let open = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (m.mat[cellAt(m.L, SURFACE, x + dx, y + dy)] === MAT.OPEN) open++;
      assert.equal(open, 9, `small map, seed ${seed}: pile ${p} and its pickup cells are open`);
    }
  }
});

test('the twelve brood due from 8 s are born one every 3 s, and the late find appears at 2:00', () => {
  const h = new Host(0, 2026, { colony: true }), s = h.sim, at = [], news = [];
  let born = 0;
  while (h.tick <= LATE_FIND_AT) {
    h.step();
    while (s.g[G.BORN] > born) { born++; at.push(h.tick); }
    for (const e of h.lastEvents) if (e[0] === EVENT.PILE_NEW) news.push([h.tick - 1, e[1], e[2]]);
  }
  for (let k = 0; k < 12; k++) assert.ok(at.includes(20 * (8 + 3 * k)), `a birth at ${8 + 3 * k} s: ${at.slice(0, 14)}`);
  assert.equal(at[0], 160, 'the first at 8 s');
  assert.deepEqual(news.map(n => n[0]), [LATE_FIND_AT, LATE_FIND_AT]);
  assert.deepEqual(news.map(n => n[2]).sort(), [FOOD.SUGAR, FOOD.PROTEIN]);
  for (const [, p] of news) assert.equal(s.pileAmount[p], 60);
});

test('new piles fall at the windfall times of the day, protein first, each with food, apart from the others', () => {
  // Seed 41 put a day-1 sugar windfall on the protein pile before the check that keeps them apart.
  const h = new Host(0, 41, { colony: true, dayTicks: DAY_TICKS }), s = h.sim, at = [], kinds = [];
  while (h.tick < 3 * DAY_TICKS - 1) {
    h.step(); if (h.dusk) h.goOn();
    for (const e of h.lastEvents) if (e[0] === EVENT.PILE_NEW) {
      const p = e[1], c = s.pileCell[p], x = c % s.L.sw, y = Math.floor(c / s.L.sw);
      at.push(h.tick - 1); kinds.push(e[2]); assert.ok(s.pileAmount[p] > 0);
      for (let k = 0; k < s.pileCell.length; k++) if (k !== p && s.pileAmount[k] > 0) { const q = s.pileCell[k]; assert.ok(Math.abs(q % s.L.sw - x) > 2 || Math.abs(Math.floor(q / s.L.sw) - y) > 2, `pile ${p} beside pile ${k}`); }
      for (let i = 0; i < s.n; i++) assert.notEqual(s.mem[i], SLOT.FOOD0 + p, 'no ant remembers a pile she never saw');
    }
  }
  const times = WINDFALL_AT.map(k => Math.floor((DAY_TICKS * k) / 20));
  assert.deepEqual(at.filter(t => t < DAY_TICKS), times, 'all four on day 1');
  assert.ok(at.length > 4, `${at.length} in three days`);
  for (const t of at) assert.ok(times.includes(t % DAY_TICKS), `a pile at ${t}`);
  assert.equal(kinds[0], FOOD.PROTEIN);
  assert.ok(kinds.includes(FOOD.SUGAR));
});
