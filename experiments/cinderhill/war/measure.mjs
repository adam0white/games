// Bot measurements for the war build, per colony and not only by wins. Run from anywhere:
//   node war/measure.mjs visitor [seeds] [mission] [comes|hungry]
//   node war/measure.mjs door [seeds] [mission] [same]   (same: both in the outpost bot's nests, door open or shut)
// A deep-store bot and a plain bot each play The Crossing; the mission is then played in the nests they left, with and
// without the nest's visitor, in each pairing and each seat. Per colony: seeds the visitor ate, visitors killed, ants
// died, adults and seeds at the end. Then the plain bot against the timid rival, visitor off and on.
import { Host } from './host.js';
import { CG, PATH_MAX, TRAILS } from './sim.js';
import { VISITOR } from './tables.js';

const [what = 'visitor', nSeeds = '6', mission = 'frost', strength = 'comes'] = process.argv.slice(2);
if (what === 'door') { await door(Number(nSeeds), process.argv[4] ?? 'stones', process.argv[5] === 'same'); process.exit(0); }
if (what !== 'visitor') { console.error('usage: node war/measure.mjs visitor [seeds] [mission] [comes|hungry] | door [seeds] [mission]'); process.exit(1); }
const seeds = Number(nSeeds), pest = VISITOR[strength], PLAIN = { mood: 1 }, DEEP = { mood: 1, deep: true };

function play(name, games) {
  const sum = { eaten: [0, 0], killed: [0, 0], died: [0, 0], adults: [0, 0], seeds: [0, 0], wins: [0, 0, 0], end: 0 };
  for (const opts of games) {
    const s = new Host(opts).run(20000).sim;
    for (const t of [0, 1]) { sum.eaten[t] += s.pest[t * 8 + 5]; sum.killed[t] += s.pest[t * 8 + 6]; sum.died[t] += s.g(t, CG.DIED); sum.adults[t] += s.g(t, CG.ADULTS); sum.seeds[t] += s.g(t, CG.SUGAR); }
    sum.wins[s.result === 1 ? 0 : s.result === 2 ? 1 : 2]++; sum.end += s.tick;
  }
  const av = x => x.map(v => Math.round(v / games.length)).join('/');
  console.log(name.padEnd(36), 'eaten', av(sum.eaten), 'killed', sum.killed.join('/'), 'died', av(sum.died), 'adults', av(sum.adults), 'seeds', av(sum.seeds), 'wins', sum.wins.join('/'), 'end', Math.round(sum.end / games.length));
}

const list = Array.from({ length: seeds }, (_, i) => i + 1);
const kept = list.map(seed => ({ deep: new Host({ seed, ai: { 0: DEEP, 1: DEEP }, mission: 'crossing' }).run(20000).sim.nests(), plain: new Host({ seed, ai: { 0: PLAIN, 1: PLAIN }, mission: 'crossing' }).run(20000).sim.nests() }));
const mind = k => (k === 'deep' ? DEEP : PLAIN);
for (const p of [null, pest]) for (const [a, b] of [['deep', 'plain'], ['plain', 'deep'], ['deep', 'deep'], ['plain', 'plain']])
  play(`${p ? strength : 'none'}: kept ${a} v kept ${b}`, list.map(seed => ({ seed, mission, ai: { 0: mind(a), 1: mind(b) }, nests: [kept[seed - 1][a][0], kept[seed - 1][b][1]], ...(p ? { pest: p } : {}) })));
for (const [name, p, m] of [['none: plain v timid', null, PLAIN], [`${strength}: plain v timid`, pest, PLAIN], [`${strength}: deep v timid`, pest, DEEP]])
  play(name, list.map(seed => ({ seed, mission, ai: { 0: m, 1: 0 }, ...(p ? { pest: p } : {}) })));

/** The second door: an outpost bot and a plain bot each play The Crossing; the mission is then played in the nests they
 *  left (the outpost bot's with its door), in each pairing and seat. Per colony: loads home by ticks 1000, 2000 and 3000,
 *  adults at 3000, trails that start at the second door, and the wins. */
async function door(n, mission, same) {
  const PLAIN = { mood: 1 }, OUT = { mood: 1, outpost: 24 }, list = Array.from({ length: n }, (_, i) => i + 1);
  const kept = list.map(seed => { const a = new Host({ seed, mission: 'crossing', sideDoor: 1, ai: { 0: OUT, 1: OUT } }).run(20000).sim, b = new Host({ seed, mission: 'crossing', ai: { 0: PLAIN, 1: PLAIN } }).run(20000).sim;
    return { out: a.nests(), sides: [0, 1].map(t => (a.side[t] >= 0 ? a.side[t] % a.L.sw : -1)), plain: b.nests() }; });
  for (const [name, A, B] of [['plain v plain', 0, 0], ['outpost v plain', 1, 0], ['plain v outpost', 0, 1], ['outpost v outpost', 1, 1]]) {
    const sum = { l1: [0, 0], l2: [0, 0], l3: [0, 0], a3: [0, 0], side: [0, 0], wins: [0, 0, 0] };
    for (const seed of list) {
      const K = kept[seed - 1], h = new Host({ seed, mission, sideDoor: 1, ai: { 0: A ? OUT : PLAIN, 1: B ? OUT : PLAIN }, nests: same ? [K.out[0], K.out[1]] : [(A ? K.out : K.plain)[0], (B ? K.out : K.plain)[1]], sides: [A ? K.sides[0] : -1, B ? K.sides[1] : -1] }), s = h.sim;
      for (const [key, tick] of [['l1', 1000], ['l2', 2000], ['l3', 3000]]) { while (!s.result && s.tick < tick) h.run(100); for (const t of [0, 1]) sum[key][t] += s.g(t, CG.LOADS_S) + s.g(t, CG.LOADS_P); }
      for (const t of [0, 1]) { sum.a3[t] += s.g(t, CG.ADULTS); for (let k = 0; k < TRAILS; k++) { const q = t * TRAILS + k; if (s.trLive[q] && s.trPath[q * PATH_MAX] === s.side[t]) sum.side[t]++; } }
      h.run(20000); sum.wins[s.result === 1 ? 0 : s.result === 2 ? 1 : 2]++;
    }
    const av = x => x.map(v => Math.round(v / n)).join('/');
    console.log(name.padEnd(20), 'loads by 1000', av(sum.l1), 'by 2000', av(sum.l2), 'by 3000', av(sum.l3), 'adults at 3000', av(sum.a3), 'trails from the second door', sum.side.join('/'), 'wins', sum.wins.join('/'));
  }
}
