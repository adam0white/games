// Measured play: node experiments/lab/cinderhill-tournament/bots.mjs [seeds] [--mutate=fresh|cap]
// Pits rule-based pacers against each other over many seeds, each pairing on both sides of the ring, and prints
// win rates. Asserts the toy's question: a careful pacer with 60 ants beats an all-in pacer with 120 a good share
// of the time, while numbers still help between equal pacers. --mutate breaks one rule and must make a line fail:
//   fresh  posture no longer depends on stamina (freshness removed from the score)
//   cap    the ring has no cap of 30 a side
import assert from 'node:assert/strict';
import { play, mutate, CAP, DEAD } from './sim.js';
import { allIn, careful, patient, mirror, idle, NEIGHBOURS, PLAYER_ANTS } from './pacers.js';

const args = process.argv.slice(2);
const seeds = Number(args.find(a => !a.startsWith('--')) ?? 300);
const mut = args.find(a => a.startsWith('--mutate'))?.split('=')[1] ?? null;
if (args.some(a => a.startsWith('--mutate'))) mutate(mut || 'fresh');

// One pairing over `seeds` seeds, with A on side 0 for half the seeds and on side 1 for the other half.
function versus(name, pa, na, pb, nb) {
  let win = 0, lose = 0, draw = 0, broke = 0, deathsA = 0, deathsB = 0, len = 0, maxRing = 0;
  for (let k = 0; k < seeds; k++) {
    const seed = 1000 + k, swap = k % 2 === 1;
    const g = swap ? play(seed, pb, pa, { a: nb, b: na }) : play(seed, pa, pb, { a: na, b: nb });
    const A = swap ? 1 : 0, w = g.over.winner;
    if (w === A) win++; else if (w === -1) draw++; else lose++;
    if (g.over.broke) broke++;
    deathsA += g.sides[A].dead; deathsB += g.sides[1 - A].dead; len += g.over.t;
    for (const s of g.sides) { let n = 0; for (let i = 0; i < s.ants; i++) if (s.where[i] === 3) n++; maxRing = Math.max(maxRing, n); }
  }
  const pct = n => Math.round(100 * n / seeds);
  const r = { name, win: pct(win), lose: pct(lose), draw: pct(draw), broke: pct(broke), deathsA: (deathsA / seeds).toFixed(1), deathsB: (deathsB / seeds).toFixed(1), secs: (len / seeds / 10).toFixed(0) };
  console.log(`${name.padEnd(44)} A wins ${String(r.win).padStart(3)}%  loses ${String(r.lose).padStart(3)}%  draws ${String(r.draw).padStart(3)}%  broke ${String(r.broke).padStart(3)}%  dead/contest A ${r.deathsA} B ${r.deathsB}  ${r.secs} s`);
  return r;
}

console.log(`${seeds} seeds a pairing, each pairing on both sides of the ring${mut ? `; MUTATION: ${mut}` : ''}`);
const head = versus('careful 60  v  all-in 120', careful, 60, allIn, 120);
const dumbs = versus('all-in 60  v  all-in 120', allIn, 60, allIn, 120);
const deep = versus('careful 120  v  careful 60', careful, 120, careful, 60);
const same = versus('careful 60  v  careful 60 (side bias)', careful, 60, careful, 60);
const sameDumb = versus('all-in 90  v  all-in 90 (side bias)', allIn, 90, allIn, 90);
const vsIdle = versus('careful 60  v  idle 60', careful, 60, idle, 60);
const careVsDumb60 = versus('careful 60  v  all-in 60', careful, 60, allIn, 60);
console.log('The player (60 ants) against each neighbour, played by the careful pacer and by all-in:');
const hood = {};
for (const [name, nb] of Object.entries(NEIGHBOURS)) {
  hood[name] = versus(`careful ${PLAYER_ANTS}  v  ${name} ${nb.ants}`, careful, PLAYER_ANTS, nb.pacer, nb.ants);
  versus(`all-in ${PLAYER_ANTS}  v  ${name} ${nb.ants}`, allIn, PLAYER_ANTS, nb.pacer, nb.ants);
}
versus(`mirror 60  v  all-in 120`, mirror, 60, allIn, 120);
versus(`patient 60  v  all-in 120`, patient, 60, allIn, 120);

// The toy's claims. A mutation must break at least one of them.
const claims = [
  ['a careful 60 beats an all-in 120 in at least 55% of contests', () => assert.ok(head.win >= 55, `careful 60 won ${head.win}%`)],
  ['an all-in 60 loses to an all-in 120 most of the time', () => assert.ok(dumbs.lose >= 60, `all-in 60 lost ${dumbs.lose}%`)],
  ['between careful pacers the bigger colony wins more often', () => assert.ok(deep.win >= 60, `careful 120 won ${deep.win}%`)],
  ['no side bias: equal pacers win and lose within 12 points of each other', () => assert.ok(Math.abs(same.win - same.lose) <= 12 && Math.abs(sameDumb.win - sameDumb.lose) <= 12, `careful ${same.win}/${same.lose}, all-in ${sameDumb.win}/${sameDumb.lose}`)],
  ['careful 60 beats an idle 60 almost always', () => assert.ok(vsIdle.win >= 95, `${vsIdle.win}%`)],
  ['careful 60 beats all-in 60 almost always', () => assert.ok(careVsDumb60.win >= 90, `${careVsDumb60.win}%`)],
  ['every neighbour can be beaten by careful play and none is a sure win', () => { for (const [n, r] of Object.entries(hood)) assert.ok(r.win >= 15 && r.win <= 95, `${n}: ${r.win}%`); }],
];
let failed = 0;
for (const [what, check] of claims) {
  try { check(); console.log(`ok   ${what}`); } catch (e) { failed++; console.log(`FAIL ${what}: ${e.message}`); }
}
if (failed) { console.log(`${failed} claim(s) failed${mut ? ' (expected under a mutation)' : ''}`); process.exit(1); }
