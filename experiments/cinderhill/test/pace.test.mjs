// The pace of the first minutes (sim 7): three pupae hatch inside the first minute, and new piles fall during the
// day at WINDFALL_AT, each on open ground, protein first.
import assert from 'node:assert/strict';
import test from 'node:test';
import { Host } from '../host.js';
import { EVENT, FOOD, G } from '../sim/sim.js';
import { DAY_TICKS } from '../sim/colony.js';
import { WINDFALL_AT } from '../sim/world.js';

test('the first ants are born within a minute of the start', () => {
  const h = new Host(0, 2026, { colony: true });
  while (h.tick < 60 * 20 && h.sim.g[G.BORN] < 3) h.step();
  assert.equal(h.sim.g[G.BORN], 3, `born ${h.sim.g[G.BORN]} by ${h.tick / 20} s`);
});

test('new piles fall at the windfall times of the day, protein first, each with food', () => {
  const h = new Host(0, 7, { colony: true }), s = h.sim, at = [], kinds = [];
  while (h.tick < DAY_TICKS - 1) {
    h.step();
    for (const e of h.lastEvents) if (e[0] === EVENT.PILE_NEW) { at.push(h.tick - 1); kinds.push(e[2]); assert.ok(s.pileAmount[e[1]] > 0); }
  }
  assert.deepEqual(at, WINDFALL_AT.map(k => Math.floor((DAY_TICKS * k) / 20)));
  assert.equal(kinds[0], FOOD.PROTEIN);
  assert.ok(kinds.includes(FOOD.SUGAR));
});
