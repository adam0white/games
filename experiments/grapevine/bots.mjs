// Proves the rules: node bots.mjs  (exits non-zero on any failure)
//  1. determinism: the generator, the route walk and the daily village give the same result twice;
//     levels 1 to 30 are unchanged (a hash), because saved stars are kept by level number;
//  2. small hand-made cases for each newer element (one-way lane, gate and bell ringer, keeper), next to the
//     older rules (U-turn, sleepy, timid, parrot, loops);
//  3. every shipped level is solvable; its stored shortest length is the solver's; a brute-force search
//     that uses only walk() (the route checker the page uses) agrees with the solver on the shortest
//     length and on the number of routes up to two hops longer; the same on random villages with every element;
//  4. after level 3, no shortest-by-distance path solves the level, and each level's new idea matters;
//  5. bots: the solver bot wins every level with 3 stars; a do-nothing bot never wins; a random bot that
//     wanders along paths (three sends a level, like a player before the hint) wins clearly less;
//  6. daily villages: each one generates, is solvable, and is the same on a second run, for every tier;
//  7. the ramp, chapter by chapter.
import { createHash } from 'node:crypto';
import { LEVELS, CHAPTERS } from './levels.js';
import { walk, solve, straightPaths, essential, generate, daily, dailySeed, wander, stars, rng, step, startState,
  DAILY_SPEC, DAILY_TIERS, KINDS, ONEWAY, GATE_OPEN, GATE_SHUT, tierFor } from './sim.js';

const t0 = Date.now();
let failures = 0;
const fail = text => { failures++; console.log('FAIL ' + text); };
const check = (ok, text) => { if (!ok) fail(text); };

// 1. Determinism, and chapter 1 as it was.
{
  const a = generate(424242, DAILY_SPEC), b = generate(424242, DAILY_SPEC);
  check(JSON.stringify(a) === JSON.stringify(b), 'generate is deterministic');
  const lv = LEVELS[10], route = solve(lv).best;
  check(JSON.stringify(walk(lv, route)) === JSON.stringify(walk(lv, route)), 'walk is deterministic');
  const r1 = rng(7), r2 = rng(7);
  check([1, 2, 3, 4].every(() => r1() === r2()), 'rng is deterministic');
  const hash = createHash('sha256').update(JSON.stringify(LEVELS.slice(0, 30))).digest('hex');
  check(hash === 'e969104f75586f0d91c6af19e5b7b5a09a9b79bb2c07fa7e7d1002c98c628ffa', `levels 1 to 30 unchanged (hash ${hash.slice(0, 12)})`);
  check(CHAPTERS.length === 3 && CHAPTERS[CHAPTERS.length - 1][1] === LEVELS.length, 'chapters cover every level');
}

// 2. Small cases for the newer elements. Villagers: 0 teller, 1 listener, then the ones each case needs.
{
  const M = (s, c, n = 1) => ({ s, c, n });
  const lv = (nodes, edges, start = M(0, 2), want = M(0, 0)) => ({
    nodes: [{ kind: 'teller' }, { kind: 'listener' }, ...nodes].map((n, i) => ({ x: 0, y: 0, ...n })), edges, from: 0, to: 1, start, want,
  });
  const reason = (level, route) => walk(level, route).reason;
  // One-way lane: 2 -> 1 only. Going 0, 2, 1 is fine; 1 cannot be left anyway, so test 3 -> 2 against a lane 2 -> 3.
  const lane = lv([{ kind: 'paint', arg: 0 }, { kind: 'honest' }], [[0, 2], [2, 3, ONEWAY], [0, 3], [3, 1]]);
  check(reason(lane, [0, 3, 2]) === 'oneway', 'one-way: a lane cannot be walked against its direction');
  check(walk(lane, [0, 2, 3, 1]).correct, 'one-way: with the lane, the route works');
  check(solve(lane).min === 3 && solve(lane, { twoWay: true }).min === 3, 'one-way: solver');
  // Gate and bell: the gate 3-1 starts shut; the bell 2 swaps it.
  const gate = lv([{ kind: 'bell' }, { kind: 'paint', arg: 0 }], [[0, 2], [0, 3], [2, 3], [3, 1, GATE_SHUT]]);
  check(reason(gate, [0, 3, 1]) === 'shut', 'gate: a shut gate stops the route');
  check(walk(gate, [0, 2, 3, 1]).correct, 'gate: the bell opens it');
  check(solve(gate).min === 3 && essential(gate, 'bell'), 'gate: the bell matters');
  // Two rings shut it again: bell, other bell, then the gate.
  const twice = lv([{ kind: 'bell' }, { kind: 'bell' }, { kind: 'paint', arg: 0 }], [[0, 2], [2, 3], [3, 4], [2, 4], [4, 1, GATE_SHUT]]);
  check(reason(twice, [0, 2, 3, 4, 1]) === 'shut' && walk(twice, [0, 2, 4, 1]).correct, 'gate: a second bell shuts it again');
  // An open gate that a bell shuts.
  const open = lv([{ kind: 'bell' }, { kind: 'paint', arg: 0 }], [[0, 2], [2, 3], [0, 3, GATE_OPEN], [3, 1]]);
  check(walk(open, [0, 3, 1]).correct && reason(open, [0, 2, 3, 0]) !== null, 'gate: an open gate lets the route through');
  // Keeper: hands on what they hold, keeps the new news; through a loop they hand back the teller's news.
  const keep = lv([{ kind: 'keeper', memo: M(3, 3, 2) }, { kind: 'more' }, { kind: 'honest' }], [[0, 2], [2, 3], [3, 4], [4, 2], [2, 1]], M(1, 1), M(1, 1, 1));
  const w1 = walk(keep, [0, 2, 1]);
  check(w1.msgs[1].s === 3 && w1.msgs[1].n === 2 && w1.memos[1][0] === 16 * 1 + 4 * 1 + 0, 'keeper: hands on the old news and keeps the new');
  const w2 = walk(keep, [0, 2, 3, 4, 2, 1]);
  check(w2.correct, 'keeper: after a loop, hands back the news they kept');
  check(solve(keep).min === 5 && essential(keep, 'keeper'), 'keeper: solver finds the loop');
  // A parrot after a keeper repeats nothing; a timid villager after a keeper judges the keeper's news.
  const pk = lv([{ kind: 'keeper', memo: M(0, 0) }, { kind: 'parrot' }, { kind: 'timid' }], [[0, 2], [2, 3], [3, 1], [2, 4], [4, 1]], M(0, 2), M(0, 0));
  check(walk(pk, [0, 2, 3, 1]).correct && walk(pk, [0, 2, 3, 1]).changes[2] === 0, 'keeper then parrot: the parrot repeats nothing');
  check(reason(pk, [0, 2, 4]) === 'red', 'keeper then timid: the timid villager refuses the red news the keeper handed on');
  // A sleepy keeper speaks once.
  const sk = lv([{ kind: 'keeper', memo: M(0, 0), once: true }, { kind: 'honest' }, { kind: 'honest' }], [[0, 2], [2, 3], [3, 4], [4, 2], [2, 1]]);
  check(reason(sk, [0, 2, 3, 4, 2]) === 'asleep', 'sleepy keeper: goes home after speaking');
  // U-turn rule stays: 0, 2, 3, 2 is a U-turn.
  check(reason(keep, [0, 2, 3, 2]) === 'back', 'U-turns are still refused');
  // step and walk agree.
  const s = step(gate, step(gate, startState(gate), 2), 3);
  check(s.phase === 1 && s.node === 3, 'step: the bell parity rides along');
}

// 3 and 4. Every level.
function brute(level, limit) {
  // Count solving routes by length using only walk(): extend each valid prefix by every villager.
  const counts = [];
  const go = route => {
    const w = walk(level, route);
    if (!w.valid) return;
    if (w.arrived) { if (w.correct) counts[route.length - 1] = (counts[route.length - 1] || 0) + 1; return; }
    if (route.length - 1 >= limit) return;
    for (let v = 0; v < level.nodes.length; v++) go([...route, v]);
  };
  go([level.from]);
  return counts;
}
const agrees = (level, what) => {
  const sol = solve(level);
  const counts = brute(level, sol.min + 2);
  const bruteMin = counts.findIndex(c => c > 0), bruteUpTo = counts.reduce((a, c, h) => a + (h <= sol.min + 2 ? c || 0 : 0), 0);
  check(bruteMin === sol.min, `${what}: brute-force shortest ${bruteMin} = solver ${sol.min}`);
  check(bruteUpTo === sol.countUpTo, `${what}: brute-force routes up to +2 ${bruteUpTo} = solver ${sol.countUpTo}`);
};
const randomBot = (level, r) => { const res = wander(level, r); return res.won ? { ...res, stars: stars(res.hops, level.min) } : res; };
const chapterOf = n => CHAPTERS.findIndex(([a, b]) => n >= a && n <= b) + 1;
const HANDMADE = new Set([1, 2, 3, 31, 36, 46]);

const rows = [], rates = [];
let solverStars = 0, randomStars = 0, randomWins = 0, randomTrials = 0, straightWins = 0;
LEVELS.forEach((level, i) => {
  const n = i + 1, sol = solve(level);
  check(sol.solvable, `level ${n} solvable`);
  if (!sol.solvable) return;
  check(sol.min === level.min, `level ${n} stored shortest ${level.min} = solver ${sol.min}`);
  check(walk(level, sol.best).correct, `level ${n} solver route is correct by walk()`);
  solverStars += stars(sol.best.length - 1, level.min);
  agrees(level, `level ${n}`);
  const straightOk = straightPaths(level).some(p => walk(level, p).correct);
  if (straightOk) straightWins++;
  if (!HANDMADE.has(n) || n === 31 || n === 36) check(!straightOk, `level ${n}: no shortest-by-distance path solves it`);
  for (const idea of [level.must, ...(level.also ?? [])].filter(Boolean)) check(essential(level, idea), `level ${n}: the new idea (${idea}) matters`);
  const r = rng(n * 31);
  let wins = 0, starSum = 0;
  const trials = 400;
  for (let t = 0; t < trials; t++) { const res = randomBot(level, r); if (res.won) { wins++; starSum += res.stars; } }
  randomWins += wins; randomTrials += trials; rates[n] = wins / trials;
  randomStars += starSum;
  const lanes = level.edges.filter(e => e[2] === ONEWAY).length, gates = level.edges.filter(e => e[2] >= 2).length;
  rows.push({ n, ch: chapterOf(n), name: level.name, villagers: level.nodes.length, paths: level.edges.length, lanes, gates, min: sol.min, shortest: sol.countMin, upTo2: sol.countUpTo,
    straight: straightOk ? 'solves' : 'fails', random: (100 * wins / trials).toFixed(0) + '%', newIdea: [level.must ?? (n <= 3 ? 'paint' : 'mix'), ...(level.also ?? [])].join('+') });
});

// Random villages with every element: the solver and the brute-force walk() agree.
{
  let n = 0;
  for (let seed = 1; n < 40 && seed < 4000; seed += 37) {
    const lv = generate(seed, { ...DAILY_TIERS[3], gates: [1, 2], oneway: [1, 2], put: { bell: [1, 1], keeper: [1, 2] }, hops: [3, 7], straight: false, maxMin: 0 }, 20);
    if (!lv) continue;
    n++; agrees(lv, `random village ${seed}`);
  }
  check(n >= 30, `random villages with every element: ${n} made`);
}

// 5. A do-nothing bot sends the teller's message without a route; it must never be what the listener wants.
const nothingWins = LEVELS.filter(level => walk(level, [level.from]).correct || (level.start.s === level.want.s && level.start.c === level.want.c && level.start.n === level.want.n)).length;
check(nothingWins === 0, 'the do-nothing bot never wins');

// 6. Daily villages: a year at tier 0 (the village every player has had since the start), and a sample of days for
//    each newer tier. The browser makes one on a tap, so the slowest one is timed.
const dailyRows = [];
for (let tier = 0; tier < DAILY_TIERS.length; tier++) {
  let ok = 0, lower = 0, fallback = 0, slow = 0, days = 0, matters = 0;
  const mins = [];
  const day = new Date(2026, 0, 1);
  for (let d = 0; d < 365; d += tier ? 2 : 1) {
    day.setTime(new Date(2026, 0, 1 + d).getTime());
    const seed = dailySeed(day.getFullYear(), day.getMonth() + 1, day.getDate());
    const t = Date.now(), a = daily(seed, LEVELS[20], tier); slow = Math.max(slow, Date.now() - t);
    const b = daily(seed, LEVELS[20], tier);
    days++;
    if (a === LEVELS[20]) fallback++;
    else if (a.tier !== undefined) lower++;
    const must = DAILY_TIERS[a.tier ?? tier].must;
    if (!must || essential(a, must)) matters++;
    const sol = solve(a);
    if (sol.solvable && JSON.stringify(a) === JSON.stringify(b) && straightPaths(a).every(p => !walk(a, p).correct)) ok++;
    else fail(`daily tier ${tier} ${day.toDateString()} (seed ${seed})`);
    mins.push(sol.min);
  }
  dailyRows.push({ tier, opensAt: tierFor(0) === tier ? 'level 1' : `level ${[1, 32, 37, 47][tier]}`, days, ok, newIdeaMatters: matters, lowerTier: lower, fallback, shortest: `${Math.min(...mins)}-${Math.max(...mins)}`, mean: (mins.reduce((x, y) => x + y, 0) / mins.length).toFixed(1), slowestMs: slow });
  check(matters >= days * 0.95, `daily tier ${tier}: the tier's new idea matters on ${matters} of ${days} days`);
  check(slow < 1500, `daily tier ${tier}: slowest village made in ${slow} ms`);
}
check(tierFor(1) === 0 && tierFor(31) === 0 && tierFor(32) === 1 && tierFor(37) === 2 && tierFor(47) === 3 && tierFor(61) === 3, 'daily tiers open in order');

console.table(rows);
console.table(dailyRows);
const avg = list => (list.reduce((a, b) => a + b, 0) / list.length);
console.log(`solver bot: won ${LEVELS.length}/${LEVELS.length} levels, ${solverStars}/${3 * LEVELS.length} stars`);
console.log(`random bot (three sends a level): won ${(100 * randomWins / randomTrials).toFixed(1)}% of ${randomTrials} level attempts, ${(randomStars / randomTrials).toFixed(2)} stars per attempt (solver: 3.00)`);
console.log(`do-nothing bot: won ${nothingWins}/${LEVELS.length}`);
console.log(`levels a shortest-by-distance path solves: ${straightWins} (only levels 1 to 3 and the keeper's first level, 46, may)`);

// 7. The ramp, chapter by chapter, on the random bot's win rate, leaving out the hand-made teaching levels.
//    Each level is within RAMP_TOL of the median of the five levels around it in its chapter, and each group
//    (one idea) is no easier on average than the group before, give or take RAMP_STEP.
//    Chapter 1 keeps its old groups of three from level 4. Chapters 2 and 3 use the groups in make-levels.mjs.
const RAMP_TOL = 0.12, RAMP_STEP = 0.05;
const GROUPS = [
  Array.from({ length: 9 }, (_, i) => [4 + 3 * i, 6 + 3 * i]),
  [[32, 35], [37, 40], [41, 45]],
  [[47, 50], [51, 55], [56, 60]],
];
GROUPS.forEach((groups, c) => {
  const levels = [];
  for (const [a, b] of groups) for (let n = a; n <= b; n++) levels.push(n);
  levels.forEach((n, i) => {
    const near = levels.slice(Math.max(0, i - 2), i + 3).map(k => rates[k]).sort((a, b) => a - b);
    const med = near.length % 2 ? near[(near.length - 1) / 2] : (near[near.length / 2 - 1] + near[near.length / 2]) / 2;
    check(Math.abs(rates[n] - med) <= RAMP_TOL, `ramp: level ${n} random win ${(100 * rates[n]).toFixed(0)}% is within ${100 * RAMP_TOL} points of its neighbours' median ${(100 * med).toFixed(0)}%`);
  });
  const means = groups.map(([a, b]) => avg(Array.from({ length: b - a + 1 }, (_, k) => rates[a + k])));
  means.forEach((m, i) => { if (i) check(m <= means[i - 1] + RAMP_STEP, `ramp: chapter ${c + 1} levels ${groups[i].join('-')} average ${(100 * m).toFixed(0)}% is not easier than the group before (${(100 * means[i - 1]).toFixed(0)}%)`); });
  console.log(`ramp, chapter ${c + 1}: random-bot win rate by group (${groups.map(g => g.join('-')).join(', ')}): ${means.map(m => (100 * m).toFixed(0) + '%').join(' ')}`);
});
// 8. Middle and late game audit: after the keeper's teaching level (46), no keeper starts out holding the
//    listener's news. Otherwise the level is "walk to the keeper, deliver", and every hop before her is wasted.
for (let n = 47; n <= LEVELS.length; n++) {
  const lv = LEVELS[n - 1], k = lv.nodes.find(v => v.kind === 'keeper' && v.memo.s === lv.want.s && v.memo.c === lv.want.c && v.memo.n === lv.want.n);
  check(!k, `level ${n}: no keeper starts with the listener's news`);
}
for (const n of HANDMADE) check(rates[n] >= 0.5, `teaching level ${n} is easy for a wanderer (${(100 * rates[n]).toFixed(0)}%)`);
check(randomWins / randomTrials < 0.6 && randomStars / randomTrials < 1.5, 'the random bot does clearly worse than the solver bot');
check(Date.now() - t0 < 60000, 'bots finish in under 60 seconds');
console.log(`${failures ? 'FAILED' : 'all checks passed'} in ${((Date.now() - t0) / 1000).toFixed(1)} s (kinds known: ${KINDS.length})`);
process.exit(failures ? 1 : 0);
