// A short fixed run shared by the page (check.js), the phone check and test/page.test.mjs.
// EXPECTED is what Node computes for it; the test fails when the sim changes and this line is not updated.
import { replay, script } from './sim/replay.js';

export const QUICK = { cfg: { seed: 2026, sw: 128, sh: 128, nw: 96, nh: 64, ants: 300 }, ticks: 600 };
export const EXPECTED = { tick: 600, total: 2962084395 };

export function quick() {
  const { cfg, ticks } = QUICK;
  return replay({ cfg, commands: script(cfg, ticks), ticks, every: ticks }).records.at(-1);
}

// The long check on the page: spike S2's run (seed 2026, 2,000 ants, 10 minutes of play, the scripted orders).
// Checked by test/page.test.mjs (about 22 s in Node) and by spikes/s2.mjs.
export const LONG = { cfg: { seed: 2026, ants: 2000 }, ticks: 12000 };
export const EXPECTED_LONG = { tick: 12000, total: 1787377502 };
