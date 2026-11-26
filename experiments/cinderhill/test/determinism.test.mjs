// Same seed and commands give the same hashes, twice, and after a snapshot and restore mid-run.
// A different seed must give different hashes (so the check can fail).
import assert from 'node:assert/strict';
import test from 'node:test';
import { Sim } from '../sim/sim.js';
import { script, replay, firstDivergence } from '../sim/replay.js';
import { restore, snapshot } from '../sim/snapshot.js';

const cfg = { seed: 11, sw: 96, sh: 96, nw: 64, nh: 48, ants: 150 };
const TICKS = 2600;
const commands = script(cfg, TICKS);

test('the script has every kind of order', () => {
  assert.deepEqual([...new Set(commands.map(c => c.type))].sort((a, b) => a - b), [1, 2, 3, 4, 5]);
});

test('same seed and commands: same hashes, twice', () => {
  const a = replay({ cfg, commands, ticks: TICKS, every: 10 }).records;
  const b = replay({ cfg, commands: JSON.parse(JSON.stringify(commands)), ticks: TICKS, every: 10 }).records;
  assert.equal(a.length, TICKS / 10);
  assert.equal(firstDivergence(a, b), null);
});

test('a different seed diverges', () => {
  const a = replay({ cfg, commands, ticks: 100, every: 10 }).records;
  const b = replay({ cfg: { ...cfg, seed: 12 }, commands, ticks: 100, every: 10 }).records;
  assert.notEqual(firstDivergence(a, b), null);
});

test('snapshot and restore mid-run: the restored sim matches every tick after', () => {
  const ref = replay({ cfg, commands, ticks: TICKS, every: 1 }).records;
  const half = replay({ cfg, commands, ticks: TICKS / 2, every: TICKS }).sim;
  const bytes = snapshot(half);
  const back = restore(bytes);
  assert.deepEqual(back.hashes(), half.hashes(), 'restored state hashes as the original');
  assert.deepEqual(snapshot(back), bytes, 'and writes the same bytes');
  // The restored sim already holds the queued commands; continue it without queueing them again.
  const rest = replay({ cfg, commands: [], ticks: TICKS, every: 1, sim: back }).records;
  assert.equal(firstDivergence(ref.slice(TICKS / 2), rest), null);
});

test('a snapshot from another version is refused', () => {
  const bytes = snapshot(new Sim({ ...cfg, ants: 3 }));
  bytes[4] ^= 0xFF;
  assert.throws(() => restore(bytes), /snapshot/);
});
