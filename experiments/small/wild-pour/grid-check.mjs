// The neighbour grid against every pair. sim.js finds touching drops through a grid; this check takes states from
// real runs (every level, two seeds, four thumbs, the mutation too, and some odd states) and runs one relaxation pass
// both ways on copies. Corrections are summed then applied, so the two must agree to rounding (1e-9 units).
// 2026-11-24: the rules changed (NOTES.md), so the old comparison with the original sim's Git blob no longer applies.
// Run: fnm exec --using=26.12.0 node experiments/small/wild-pour/grid-check.mjs
import { performance } from 'node:perf_hooks';
import * as sim from './sim.js';

const TOL = 1e-9;
let compared = 0, pairsSeen = 0, worst = 0;
function same(a, b, where) {
  if (a.p.length !== b.p.length) throw Error(`${where}: particle count ${a.p.length} !== ${b.p.length}`);
  for (let i = 0; i < a.p.length; i++) {
    const p = a.p[i], q = b.p[i];
    for (const k of ['x', 'y', 'px', 'py']) {
      const d = Math.abs(p[k] - q[k]);
      if (Number.isNaN(p[k]) !== Number.isNaN(q[k]) || d > TOL) throw Error(`${where}: drop ${i} ${k} ${p[k]} !== ${q[k]}`);
      if (d > worst) worst = d;
    }
    if (p.air !== q.air || p.st !== q.st) throw Error(`${where}: drop ${i} air/st ${p.air}/${p.st} !== ${q.air}/${q.st}`);
  }
}
function compare(s, where) {
  const a = sim.clone(s), b = sim.clone(s);
  sim.relaxOnce(a, false); sim.relaxOnce(b, true);
  same(a, b, where); compared++;
  let touching = 0; for (let i = 0; i < s.p.length; i++) if (s.p[i].x !== a.p[i].x || s.p[i].y !== a.p[i].y) touching++;
  pairsSeen += touching;
}

// A known bad case must fail: the comparison catches a one-micro-unit difference.
{
  const s = sim.create(1, 1); for (let i = 0; i < 200; i++) sim.step(s, 1.9);
  const a = sim.clone(s), b = sim.clone(s); b.p[3].x += 1e-6;
  let caught = false; try { same(a, b, 'self-test'); } catch { caught = true; }
  if (!caught) throw Error('self-test: the comparison missed a 1e-6 difference');
}

const policies = [() => 0, () => 2.4, (s, i) => i % 180 < 90 ? 1.8 : 0, (s, i) => Math.max(0, Math.sin(i / 47) * 2.4)];
let episodes = 0;
for (let n = 1; n <= sim.LEVELS; n++) for (const seed of [7, 113]) for (const mutate of [false, true]) for (let k = 0; k < policies.length; k++) {
  const s = sim.create(n, seed, { mutate });
  for (let i = 0; i < 900 && !s.over; i++) {
    sim.step(s, policies[k](s, i));
    if (i % 15 === 7) compare(s, `level ${n} seed ${seed} mutate ${mutate} thumb ${k} step ${i}`);
  }
  episodes++;
}
// Odd states: a drop far outside the grid, more drops than the buffers hold, a drop that is not a number, a heap.
{
  const s = sim.create(1, 3); for (let i = 0; i < 300; i++) sim.step(s, 1.9);
  const far = sim.clone(s); far.p[0].x = far.p[0].px = -100; compare(far, 'drop far left');
  const big = sim.clone(s); for (let i = 0; i < 200; i++) big.p.push({ ...big.p[i % big.p.length], x: big.p[i % big.p.length].x + 0.3 }); compare(big, 'oversized');
  const nan = sim.clone(s); nan.p[0].x = NaN; compare(nan, 'NaN drop');
  const heap = sim.create(1, 5); heap.p = Array.from({ length: 90 }, (_, i) => ({ x: 50 + (i % 9) * 1.7, y: 140 - Math.floor(i / 9) * 1.7, px: 50 + (i % 9) * 1.7, py: 140 - Math.floor(i / 9) * 1.7, st: 1, air: i % 4 === 0 ? 1 : 0, e: 0 }));
  compare(heap, 'tight heap with stream drops');
  episodes++;
}
if (pairsSeen === 0) throw Error('no drop moved in any compared pass: the check compared nothing');
console.log(`grid against every pair: ${compared} passes from ${episodes} runs agree (largest difference ${worst.toExponential(2)}, tolerance ${TOL}); ${pairsSeen} drop moves compared`);

const bench = brute => {
  const s = sim.create(1, 2); for (let i = 0; i < 400; i++) sim.step(s, i < 200 ? 2.0 : 0);
  const start = performance.now();
  for (let r = 0; r < 4000; r++) sim.relaxOnce(s, brute); // the same heap again and again
  return +(performance.now() - start).toFixed(1);
};
const g1 = bench(false), b1 = bench(true), g2 = bench(false), b2 = bench(true);
console.log(JSON.stringify({ gridMs: [g1, g2], everyPairMs: [b1, b2], speedup: ((b1 + b2) / (g1 + g2)).toFixed(2) }));
