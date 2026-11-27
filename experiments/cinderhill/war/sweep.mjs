// Bot sweeps for the war sim: who wins, how and when, over many seeds. Run: node experiments/cinderhill/war/sweep.mjs [seeds] [rows, e.g. 4,5,6]
// Seats: a mood number (0 timid, 1 steady, 2 bold) is the rival's own mind; 'novice' lays three trails once and never again;
// 'idle' gives no order. 'no rooms' is the same mind that never digs: building is worth it when the builder beats it.
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
  const ai = { 1: b }; if (typeof a !== 'string') ai[0] = a;
  const h = new Host({ seed, ai, swap: seed % 2 === 0 }); // even seeds change sides, so a bias of the side cancels
  if (a === 'novice') novice(h);
  h.run(20000);
  const s = h.sim, q = s.g(0, CG.QUEEN_HP) <= 0 || s.g(1, CG.QUEEN_HP) <= 0;
  return { win: s.result - 1, tick: s.tick, queen: q };
}
const NB = mood => ({ mood, build: false }); // a mind that never digs
const R = (...rooms) => ({ mood: 1, rooms }); // a steady mind that digs only these: 1 stores, 2 nursery, 3 quarters
const P = (mood, pick, special = 1) => ({ mood, pick, special }); // a mind with a chosen caste: 2 spitters, 3 wardens
const name = m => typeof m !== 'object' ? String(m) : m.pick ? `${m.mood} ${['', '', 'spitters', 'wardens'][m.pick]} x${m.special}` : m.rooms ? '1 only ' + m.rooms.map(r => ['', 'stores', 'nursery', 'quarters'][r]).join('+') : m.mood + ' no rooms';
const rows = [];
const only = process.argv[3] ? process.argv[3].split(',').map(Number) : null;
for (const [a, b] of [['idle', 1], ['novice', 0], ['novice', 1], ['novice', 2], [0, 1], [1, 1], [2, 1], [0, 2], [2, 2], [1, 0], [1, NB(1)], [2, NB(2)], [0, NB(0)], [NB(1), NB(1)], [1, R(1)], [1, R(2)], [1, R(3)], [1, R(1, 3)], [1, R(2, 3)],
  [P(1, 2), 1], [P(1, 3), 1], [P(1, 2), P(1, 3)], [P(2, 2), P(2, 3)], [P(1, 2, 2), 1], [P(1, 3, 2), 1]].filter((_, i) => !only || only.includes(i))) {
  let w = 0, q = 0, t = 0;
  for (let seed = 1; seed <= seeds; seed++) { const r = match(a, b, seed); if (r.win === 0) w++; if (r.queen) q++; t += r.tick; }
  rows.push({ first: name(a), second: name(b), 'first wins %': Math.round(100 * w / seeds), 'by queen %': Math.round(100 * q / seeds), 'mean end (s)': Math.round(t / seeds / 20) });
}
console.table(rows);
