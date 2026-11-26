// Spike S1: tick cost in Node. Full map (256x256 surface, 192x128 nest), 3 scent fields over both layers,
// flow fields for every live goal, the scripted orders. Usage: node s1.mjs [ants ...] [--ticks=N] [--warm=N]
import { G, Sim } from '../sim/sim.js';
import { MAX_GOALS, rebuild } from '../sim/flow.js';
import { script, replay } from '../sim/replay.js';

const args = process.argv.slice(2), opt = (k, d) => Number(args.find(a => a.startsWith(`--${k}=`))?.split('=')[1] ?? d);
const counts = args.filter(a => !a.startsWith('--')).map(Number);
const TICKS = opt('ticks', 3000), WARM = opt('warm', 600);

const stats = xs => { const s = xs.slice().sort((a, b) => a - b); return { mean: xs.reduce((a, b) => a + b, 0) / xs.length, p95: s[Math.floor(s.length * 0.95)], max: s[s.length - 1] }; };
const f = x => x.toFixed(2);
const rows = [];
for (const ants of counts.length ? counts : [2000, 5000]) {
  const cfg = { seed: 2026, ants, maxAnts: Math.max(5000, ants) };
  const all = [], rebuildTicks = [], plain = [];
  let t = performance.now(), live = 0, rebuildsBefore = 0;
  const { sim } = replay({ cfg, commands: script(cfg, TICKS), ticks: TICKS, every: TICKS, onTick: s => {
    const now = performance.now(), ms = now - t;
    if (s.tick > WARM) {
      all.push(ms);
      (s.flow.rebuilds > rebuildsBefore ? rebuildTicks : plain).push(ms);
      let l = 0; for (let k = 0; k < MAX_GOALS; k++) l += s.flow.live[k]; live = Math.max(live, l);
    }
    rebuildsBefore = s.flow.rebuilds;
    t = performance.now();
  } });
  const a = stats(all), r = rebuildTicks.length ? stats(rebuildTicks) : null, p = stats(plain);
  rows.push({ ants, ticks: all.length, mean: f(a.mean), p95: f(a.p95), max: f(a.max), rebuildTicks: rebuildTicks.length, rebuildMean: r ? f(r.mean) : '-', plainMean: f(p.mean), liveGoals: live, stores: sim.g[G.STORES], dug: sim.g[G.DUG], maxStall: sim.maxStall });
}
console.log(`Node ${process.version}, ${TICKS} ticks, first ${WARM} not timed`);
console.table(rows);

// Worst case for flow: every live goal rebuilt in one tick (a big cave-in), on the 5,000-ant world.
{
  const sim = new Sim({ seed: 2026, ants: 0 });
  replay({ cfg: {}, commands: script({ seed: 2026 }, 2000), ticks: 2000, every: 2000, sim });
  const live = [...Array(MAX_GOALS).keys()].filter(k => sim.flow.live[k]);
  const times = [];
  for (let r = 0; r < 20; r++) { const t = performance.now(); for (const k of live) rebuild(sim, k); times.push(performance.now() - t); }
  const st = stats(times);
  console.log(`rebuilding all ${live.length} live fields at once: mean ${f(st.mean)} ms, max ${f(st.max)} ms (${f(st.mean / live.length)} ms a field)`);
}
