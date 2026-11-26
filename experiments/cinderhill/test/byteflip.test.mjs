// One flipped state byte at a known tick: the divergence check must name that tick and that subsystem.
import assert from 'node:assert/strict';
import test from 'node:test';
import { G, SLOT } from '../sim/sim.js';
import { script, replay, firstDivergence } from '../sim/replay.js';

const cfg = { seed: 5, sw: 64, sh: 64, nw: 64, nh: 48, ants: 120 };
const TICKS = 120, AT = 60;
const commands = script(cfg, TICKS);
const ref = replay({ cfg, commands, ticks: TICKS, every: 1 }).records;
const byte = ta => new Uint8Array(ta.buffer, ta.byteOffset, ta.byteLength);

const FLIPS = {
  ants: s => { byte(s.x)[2 * 7] ^= 1; },
  scent: s => { byte(s.scent.cur[0])[4 * 100] ^= 1; },
  terrain: s => { byte(s.mat)[s.L.n - 1] ^= 1; },
  flow: s => { s.flow.dist[SLOT.HOME * s.L.n + 3] ^= 1; },
  rng: s => { byte(s.rng)[0] ^= 1; },
  events: s => { s.events.push(9, 9, 9); },
  globals: s => { byte(s.g)[4 * G.STORES] ^= 1; },
};

for (const [name, flip] of Object.entries(FLIPS)) {
  test(`a flipped ${name} byte at tick ${AT} is named`, () => {
    const run = replay({ cfg, commands, ticks: TICKS, every: 1, at: s => { if (s.tick === AT) flip(s); } }).records;
    const d = firstDivergence(ref, run);
    assert.ok(d, 'the runs diverge');
    assert.equal(d.tick, AT);
    assert.equal(d.first, name);
    assert.deepEqual(d.subsystems, [name], 'only that subsystem differs at the flip');
  });
}
