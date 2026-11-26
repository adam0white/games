// The pace of the first minutes (sim 7): three pupae hatch inside the first minute, and new piles fall during the
// day at WINDFALL_AT, each on open ground, protein first.
import assert from 'node:assert/strict';
import test from 'node:test';
import { Host } from '../host.js';
import { EVENT, FOOD, G, SLOT } from '../sim/sim.js';
import { DAY_TICKS } from '../sim/colony.js';
import { WINDFALL_AT } from '../sim/world.js';

test('the three starting pupae hatch one by one, the first within 16 s and the last within 46 s', () => {
  const h = new Host(0, 2026, { colony: true }), at = [];
  let born = 0;
  while (h.tick < 46 * 20) { h.step(); while (h.sim.g[G.BORN] > born) { born++; at.push(h.tick); } }
  assert.equal(at.length, 3, `born at ${at}`);
  assert.ok(at[0] <= 16 * 20, `first at ${at[0] / 20} s`);
  assert.equal(new Set(at).size, 3, `apart: ${at}`);
});

test('new piles fall at the windfall times of the day, protein first, each with food, apart from the others', () => {
  // Seed 41 put a day-1 sugar windfall on the protein pile before the check that keeps them apart.
  const h = new Host(0, 41, { colony: true }), s = h.sim, at = [], kinds = [];
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
