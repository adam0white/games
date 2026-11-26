// The start of a colony game (sim 8, 02-spec 3.2): 30 adults, the porch store, near food, twelve brood due from 8 s
// one every 3 s, the late find at 2:00; and with days (?day=), new piles fall at WINDFALL_AT, protein first.
import assert from 'node:assert/strict';
import test from 'node:test';
import { Host } from '../host.js';
import { EVENT, FOOD, G, JOB, NEST, SLOT, SURFACE } from '../sim/sim.js';
import { C, DAY_TICKS, START } from '../sim/colony.js';
import { LATE_FIND_AT, WINDFALL_AT } from '../sim/world.js';

test('the start: 20 foragers by the entrance, 10 nurses, the porch store, and food 8 to 12 cells out', () => {
  for (const seed of [1, 2, 3, 2026]) {
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
    for (const [p, kind, amount] of [[0, FOOD.SUGAR, 30], [1, FOOD.PROTEIN, 20]]) {
      const c = s.pileCell[p], d = Math.hypot(c % L.sw - ex, Math.floor(c / L.sw) - ey);
      assert.equal(s.pileKind[p], kind); assert.equal(s.pileAmount[p], amount);
      assert.ok(d >= 6.5 && d <= 14, `seed ${seed} pile ${p} ${d.toFixed(1)} cells out`);
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
