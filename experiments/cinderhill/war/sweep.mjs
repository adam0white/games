// Bot sweeps for the war sim: who wins, how and when, over many seeds. Run: node experiments/cinderhill/war/sweep.mjs [seeds]
// Seats: a mood number (0 timid, 1 steady, 2 bold) is the rival's own mind; 'novice' lays three trails once and never again;
// 'idle' gives no order.
import { Host } from './host.js';
import { CG, CMD, KIND, MAX_PILES } from './sim.js';

const seeds = Number(process.argv[2]) || 30;
function novice(h) {
  const s = h.sim, sw = s.L.sw, d = s.door[0], piles = [];
  for (let p = 0; p < MAX_PILES; p++) if (s.pileAmount[p] > 0) piles.push([s.doorF[0][s.pileCell[p]], s.pileCell[p]]);
  piles.sort((a, b) => a[0] - b[0]);
  for (const [, c] of piles.slice(0, 3)) h.order({ team: 0, type: CMD.TRAIL, kind: KIND.FORAGE, level: 2, points: [c % sw, Math.floor(c / sw)] });
  h.order({ team: 0, type: CMD.DIET, share: 1 });
  void d;
}
function match(a, b, seed) {
  const ai = { 1: b }; if (typeof a === 'number') ai[0] = a;
  const h = new Host({ seed, ai });
  if (a === 'novice') novice(h);
  h.run(20000);
  const s = h.sim, q = s.g(0, CG.QUEEN_HP) <= 0 || s.g(1, CG.QUEEN_HP) <= 0;
  return { win: s.result - 1, tick: s.tick, queen: q };
}
const rows = [];
for (const [a, b] of [['idle', 1], ['novice', 0], ['novice', 1], ['novice', 2], [0, 1], [1, 1], [2, 1], [0, 2], [2, 2], [1, 0]]) {
  let w = 0, q = 0, t = 0;
  for (let seed = 1; seed <= seeds; seed++) { const r = match(a, b, seed); if (r.win === 0) w++; if (r.queen) q++; t += r.tick; }
  rows.push({ left: String(a), right: String(b), 'left wins %': Math.round(100 * w / seeds), 'by queen %': Math.round(100 * q / seeds), 'mean end (s)': Math.round(t / seeds / 20) });
}
console.table(rows);
