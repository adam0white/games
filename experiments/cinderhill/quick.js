// A short fixed run shared by the page (check.js), the phone check and test/page.test.mjs.
// EXPECTED is what Node computes for it; the test fails when the sim changes and this line is not updated.
import { replay, script } from './sim/replay.js';

export const QUICK = { cfg: { seed: 2026, sw: 128, sh: 128, nw: 96, nh: 64, ants: 300 }, ticks: 600 };
export const EXPECTED = { tick: 600, total: 2732545835 };

export function quick() {
  const { cfg, ticks } = QUICK;
  return replay({ cfg, commands: script(cfg, ticks), ticks, every: ticks }).records.at(-1);
}
