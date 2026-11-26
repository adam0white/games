// The days acceptance (NOTES.md): the careful bot meets every day's goal for three days. Its own file, so it runs in
// parallel with the other suites (about 30 to 50 s). The idle bot's misses on days 1 and 2 are structural (no trail, no
// dig: test/days.test.mjs); the full sweep over 12 seeds, idle's day 3 included, is in sim/SPIKES.md, "Days".
import assert from 'node:assert/strict';
import test from 'node:test';
import { play } from '../bots.mjs';
const LONG = process.env.CINDERHILL_LONG === '1' ? false : 'over 15 s: runs nightly (CINDERHILL_LONG=1)';

test('the careful bot wins days 1 to 3 on seed 6 (its narrowest margin in the sweep)', { skip: LONG }, () => {
  const days = play('careful', 6);
  assert.deepEqual(days.map(d => d.won), [1, 1, 1], JSON.stringify(days.map(d => d.goal)));
});
