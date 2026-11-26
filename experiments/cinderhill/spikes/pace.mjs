// The pace check (sim 7): how soon the first load comes home after the first trail, when the first ant is born,
// and the longest stretch of the first five minutes with nothing new to react to. Games are made by host.js as the
// page makes them (?colony=1), so the start (ants in the chamber, the brood, the piles) is the player's.
// Two passive players, the kind that quit in the lab records of 2026-11-26:
// - near: one trail at 3 s from the entrance to the nearest pile, then nothing.
// - owner: one trail at 3 s to the nearest protein pile (what the owner did), then nothing.
// Notable things (the page shows each): the first delivery, a birth, a new pile, a pile empty, the spider's
// warning, a dusk, and a larva lost.
// Acceptance (the coordinator's brief): first delivery 10 to 15 s after the first trail, the first birth within 60 s,
// and no gap over 45 s in the first five minutes.
// Usage: node experiments/cinderhill/spikes/pace.mjs [seeds: first-last, default 1-24] [--json=out.json]
import { writeFileSync } from 'node:fs';
import { Host } from '../host.js';
import { CMD, EVENT, FOOD, G, SURFACE } from '../sim/sim.js';
import { SPIDER } from '../sim/spider.js';

const HZ = 20, FIVE_MIN = 300 * HZ, TRAIL_AT = 3 * HZ;
const arg = process.argv.find(a => /^\d+(-\d+)?$/.test(a)) ?? '1-24';
const [lo, hi] = arg.split('-').map(Number), seeds = [];
for (let s = lo; s <= (hi ?? lo); s++) seeds.push(s);
const json = process.argv.find(a => a.startsWith('--json='))?.slice(7);

function nearest(sim, kind) {
  const L = sim.L, ex = L.sw >> 1, ey = L.sh >> 1;
  let best = null;
  for (let p = 0; p < sim.pileCell.length; p++) {
    const c = sim.pileCell[p];
    if (c < 0 || sim.pileAmount[p] <= 0 || (kind >= 0 && sim.pileKind[p] !== kind)) continue;
    const x = c % L.sw, y = Math.floor(c / L.sw), d = Math.max(Math.abs(x - ex), Math.abs(y - ey));
    if (!best || d < best.d) best = { p, x, y, d };
  }
  return best;
}

export function pace(seed, policy) {
  const host = new Host(0, seed, { colony: true }), sim = host.sim, L = sim.L, ex = L.sw >> 1, ey = L.sh >> 1;
  const marks = [], firsts = {};
  let day1 = null, stores = sim.g[G.STORES], born = sim.g[G.BORN], lost = sim.g[G.BROOD_LOST], trailAt = -1, pile = null;
  const mark = (what, t) => { marks.push([t, what]); if (firsts[what] === undefined) firsts[what] = t; };
  while (host.tick < FIVE_MIN) {
    if (host.tick === TRAIL_AT) {
      pile = nearest(sim, policy === 'owner' ? FOOD.PROTEIN : -1);
      host.order({ type: CMD.TRAIL, layer: SURFACE, points: [ex + 1, ey + 1, pile.x, pile.y] });
      trailAt = host.tick;
    }
    host.step();
    if (host.dusk) { if (day1 === null) day1 = { done: host.dusk.goal.a, target: host.dusk.goal.target, won: host.dusk.won }; host.goOn(); } // the player taps on at the dusk card
    const t = host.tick, g = sim.g;
    if (g[G.STORES] > stores && firsts.delivery === undefined) mark('delivery', t);
    if (g[G.BORN] > born) mark('birth', t);
    if (g[G.BROOD_LOST] > lost) mark('larva lost', t);
    stores = g[G.STORES]; born = g[G.BORN]; lost = g[G.BROOD_LOST];
    for (const e of host.lastEvents ?? []) {
      if (e[0] === EVENT.PILE_NEW) mark('new pile', t);
      else if (e[0] === EVENT.PILE_EMPTY) mark('pile empty', t);
      else if (e[0] === EVENT.SPIDER && e[1] === SPIDER.WARN) mark('spider', t);
      else if (e[0] === EVENT.DUSK) mark('dusk', t);
    }
  }
  const times = [0, ...marks.map(m => m[0]), FIVE_MIN].sort((a, b) => a - b);
  let gap = 0, gapAt = 0;
  for (let k = 1; k < times.length; k++) if (times[k] - times[k - 1] > gap) { gap = times[k] - times[k - 1]; gapAt = times[k - 1]; }
  return {
    seed, policy, pileDist: pile?.d, firstDelivery: firsts.delivery === undefined ? null : (firsts.delivery - trailAt) / HZ,
    firstBirth: firsts.birth === undefined ? null : firsts.birth / HZ, gap: gap / HZ, gapAt: gapAt / HZ,
    ants: sim.n, born: sim.g[G.BORN], lost: sim.g[G.BROOD_LOST], marks: marks.length, day1,
  };
}

const pct = (xs, q) => { const s = xs.filter(x => x !== null).sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : null; };
if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = [];
  for (const policy of ['near', 'owner']) for (const seed of seeds) rows.push(pace(seed, policy));
  for (const policy of ['near', 'owner']) {
    const r = rows.filter(x => x.policy === policy), f = r.map(x => x.firstDelivery), b = r.map(x => x.firstBirth), g = r.map(x => x.gap);
    console.log(`${policy}: ${r.length} seeds; pile ${pct(r.map(x => x.pileDist), 0)}-${pct(r.map(x => x.pileDist), 1)} cells; first delivery median ${pct(f, 0.5)} s, worst ${pct(f, 1)} s (none: ${f.filter(x => x === null).length}); first birth worst ${pct(b, 1)} s; longest gap median ${pct(g, 0.5)} s, worst ${pct(g, 1)} s; ants at 5 min median ${pct(r.map(x => x.ants), 0.5)}; larvae lost median ${pct(r.map(x => x.lost), 0.5)}; day 1 won ${r.filter(x => x.day1?.won).length} of ${r.length} (loads median ${pct(r.map(x => x.day1?.done ?? 0), 0.5)})`);
  }
  for (const r of rows) if (r.firstDelivery === null || r.firstDelivery > 15 || r.firstBirth === null || r.firstBirth > 60 || r.gap > 45) console.log('  over:', JSON.stringify(r));
  if (json) writeFileSync(json, JSON.stringify(rows, null, 1));
}
