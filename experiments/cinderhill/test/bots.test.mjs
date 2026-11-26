// A bot run of the scripted orders: no ant goes more than 5 seconds (100 ticks) without progress, and the
// colony forages and digs.
import assert from 'node:assert/strict';
import test from 'node:test';
import { G } from '../sim/sim.js';
import { script, replay } from '../sim/replay.js';

for (const seed of [3, 8]) {
  test(`bot run, seed ${seed}: nobody stuck over 5 s; food comes in; cells get dug`, () => {
    const cfg = { seed, ants: 800 }, ticks = 3000;
    const { sim } = replay({ cfg, commands: script(cfg, ticks), ticks, every: ticks });
    assert.ok(sim.maxStall <= 100, `an ant went ${sim.maxStall} ticks without progress`);
    assert.ok(sim.g[G.STORES] > 50, `stores ${sim.g[G.STORES]}`);
    assert.ok(sim.g[G.DUG] > 20, `dug ${sim.g[G.DUG]}`);
  });
}
