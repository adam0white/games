// Bot measurements for the war build, per colony and not only by wins. Run from anywhere:
//   node war/measure.mjs visitor [seeds] [mission] [comes|hungry]
// A deep-store bot and a plain bot each play The Crossing; the mission is then played in the nests they left, with and
// without the nest's visitor, in each pairing and each seat. Per colony: seeds the visitor ate, visitors killed, ants
// died, adults and seeds at the end. Then the plain bot against the timid rival, visitor off and on.
import { Host } from './host.js';
import { CG } from './sim.js';
import { VISITOR } from './tables.js';

const [what = 'visitor', nSeeds = '6', mission = 'frost', strength = 'comes'] = process.argv.slice(2);
if (what !== 'visitor') { console.error('usage: node war/measure.mjs visitor [seeds] [mission] [comes|hungry]'); process.exit(1); }
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
