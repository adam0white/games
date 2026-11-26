// The page's expected hash (quick.js) must be what Node computes, or the page and the phone check would
// report a false mismatch.
import assert from 'node:assert/strict';
import test from 'node:test';
import { EXPECTED, EXPECTED_COLONY, quick, quickColony } from '../quick.js';

test('the page expects the hash Node computes for the quick run', () => {
  const h = quick();
  assert.equal(h.tick, EXPECTED.tick);
  assert.equal(h.total, EXPECTED.total, `set EXPECTED.total to ${h.total} in quick.js`);
});

test('the page expects the hash Node computes for the colony run (days, brood)', () => {
  const h = quickColony();
  assert.equal(h.tick, EXPECTED_COLONY.tick);
  assert.equal(h.total, EXPECTED_COLONY.total, `set EXPECTED_COLONY.total to ${h.total} in quick.js`);
});

// The check page's long run (check.js, the Firefox route for spike S2) steps the same way: a fresh Sim, every
// scripted order queued up front, no events drained. Its expected total must be Node's, or a phone would report
// a false DIFFERENT. Plays 12,000 ticks of 2,000 ants (about half a minute).
test('the page expects the hash Node computes for the long run', async () => {
  const { LONG, EXPECTED_LONG } = await import('../quick.js');
  const { Sim, encodeCommand } = await import('../sim/sim.js');
  const { script } = await import('../sim/replay.js');
  const { cfg, ticks } = LONG, sim = new Sim(cfg);
  for (const c of script(cfg, ticks)) sim.queueCommand(encodeCommand(c));
  while (sim.tick < ticks) sim.step();
  const h = sim.hashes();
  assert.equal(h.tick, EXPECTED_LONG.tick);
  assert.equal(h.total, EXPECTED_LONG.total, `set EXPECTED_LONG.total to ${h.total} in quick.js`);
});
