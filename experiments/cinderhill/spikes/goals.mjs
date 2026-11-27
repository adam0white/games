// Spike for the goal manager (03-features 10: "64 goals live at 2,000 ants inside the tick budget"). S1's world and
// orders, with the goal pool filled to 64 live goals at tick 600 (food goals at fixed open cells, half on the surface,
// half in the nest). Times every tick after the warm-up, then marks all 64 fields at once (a cave-in, a flood)
// and times the ticks that follow, with the quota (REBUILDS a rebuild point) and without it.
// Usage: node goals.mjs [ants] [--ticks=N] [--quota=N]
import { Sim, SURFACE, NEST, MAT } from '../sim/sim.js';
import { GOAL, MAX_GOALS, REBUILDS, SLOT, markDirty, rebuildDirty, setGoal } from '../sim/flow.js';
import { cellAt } from '../sim/grid.js';
import { script } from '../sim/replay.js';
import { encodeCommand } from '../sim/sim.js';

const args = process.argv.slice(2), opt = (k, d) => Number(args.find(a => a.startsWith(`--${k}=`))?.split('=')[1] ?? d);
const ants = Number(args.find(a => !a.startsWith('--')) ?? 2000), TICKS = opt('ticks', 3000), WARM = 600;
const stats = xs => { const s = xs.slice().sort((a, b) => a - b); return { mean: xs.reduce((a, b) => a + b, 0) / xs.length, p95: s[Math.floor(s.length * 0.95)], max: s[s.length - 1] }; };
const f = x => x.toFixed(2);

function run(quota) {
  const cfg = { seed: 2026, ants, maxAnts: Math.max(5000, ants) };
  const sim = new Sim(cfg);
  for (const c of script(cfg, TICKS)) sim.queueCommand(encodeCommand(c));
  if (quota !== REBUILDS) sim.rebuildFields = function () { rebuildDirty(this, quota, s => { for (let i = 0; i < this.n; i++) if (this.goal[i] === s) this.best[i] = 0x7FFFFFFF; }); };
  const steady = [], after = [];
  let burstAt = -1, marked = 0, waitTicks = -1, burst = null;
  // Fill the pool: open cells on a fixed lattice, surface and nest in turn, into any free slot but a trail's (a trail
  // needs a drawn path; the script keeps them live). Done at WARM, and again just before the burst, since piles and
  // the alarm come and go (the review found 61 live at the burst without the refill).
  const fill = () => {
    const L = sim.L, free = () => { for (let s = 0; s < MAX_GOALS; s++) if (!sim.flow.live[s] && !(s >= SLOT.TRAIL0 && s < SLOT.TRAIL0 + SLOT.TRAILS)) return s; return -1; };
    for (let k = 0; k < 4000 && free() >= 0; k++) {
      const surf = k % 2 === 0, w = surf ? L.sw : L.nw, h = surf ? L.sh : L.nh, x = (17 + 37 * k) % w, y = (11 + 53 * k) % h;
      const c = cellAt(L, surf ? SURFACE : NEST, x, y);
      if (sim.mat[c] === MAT.OPEN) setGoal(sim, free(), GOAL.FOOD, c);
    }
  };
  while (sim.tick < TICKS) {
    if (sim.tick === WARM) fill();
    if (sim.tick === Math.floor((WARM + TICKS) / 2)) {
      fill(); sim.rebuildAll(); // the refill's fields built first, so the burst is the marks alone
      burst = []; for (let s = 0; s < MAX_GOALS; s++) if (sim.flow.live[s]) { markDirty(sim, s); burst.push(s); }
      marked = burst.length; burstAt = sim.tick;
    }
    const t = performance.now();
    sim.step();
    const ms = performance.now() - t;
    if (sim.tick > WARM + 20) (burstAt >= 0 && sim.tick - burstAt <= 20 ? after : steady).push(ms);
    // Ticks until every field the burst marked is exact again (later marks are not counted).
    if (burst && waitTicks < 0 && burst.every(s => !sim.flow.live[s] || !sim.flow.dirty[s])) waitTicks = sim.tick - burstAt;
  }
  return { quota: quota === Infinity ? 'none' : quota, live: marked, steady: stats(steady), burst: stats(after), waitTicks, deferred: sim.flow.deferred, hash: sim.hashes().total };
}

const q = opt('quota', REBUILDS);
console.log(`Node ${process.version}, ${ants} ants, ${TICKS} ticks; the pool filled at tick ${WARM}; every field marked at once at tick ${Math.floor((WARM + TICKS) / 2)}`);
for (const r of [...new Set([q, ...(args.includes('--all') ? [1, 2, 3, 4] : [])])].map(run).concat([run(Infinity)])) console.log(`quota ${r.quota}: ${r.live} fields marked in the burst; steady ticks mean ${f(r.steady.mean)} / p95 ${f(r.steady.p95)} / max ${f(r.steady.max)} ms; the 20 ticks after the burst mean ${f(r.burst.mean)} / max ${f(r.burst.max)} ms; every one exact after ${r.waitTicks} tick(s); ${r.deferred} blankings`);
