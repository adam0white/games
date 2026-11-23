// Proves the rules: node bots.mjs  (exits non-zero on any failure)
//  1. determinism: the generator, the route walk and the daily village give the same result twice;
//  2. every shipped level is solvable; its stored shortest length is the solver's; a brute-force search
//     that uses only walk() (the route checker the page uses) agrees with the solver on the shortest
//     length and on the number of routes up to two hops longer;
//  3. after level 3, no shortest-by-distance path solves the level, and each level's new villager matters;
//  4. bots: the solver bot wins every level with 3 stars; a do-nothing bot never wins; a random bot that
//     wanders along paths (three sends a level, like a player before the hint) wins clearly less;
//  5. a year of daily villages: each one generates, is solvable, and is the same on a second run.
import { LEVELS } from './levels.js';
import { walk, solve, straightPaths, essential, generate, daily, dailySeed, wander, stars, rng, DAILY_SPEC, KINDS } from './sim.js';

const t0 = Date.now();
let failures = 0;
const fail = text => { failures++; console.log('FAIL ' + text); };
const check = (ok, text) => { if (!ok) fail(text); };

// 1. Determinism.
{
  const a = generate(424242, DAILY_SPEC), b = generate(424242, DAILY_SPEC);
  check(JSON.stringify(a) === JSON.stringify(b), 'generate is deterministic');
  const lv = LEVELS[10], route = solve(lv).best;
  check(JSON.stringify(walk(lv, route)) === JSON.stringify(walk(lv, route)), 'walk is deterministic');
  const r1 = rng(7), r2 = rng(7);
  check([1, 2, 3, 4].every(() => r1() === r2()), 'rng is deterministic');
}

// 2 and 3. Every level.
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
const randomBot = (level, r) => { const res = wander(level, r); return res.won ? { ...res, stars: stars(res.hops, level.min) } : res; };

const rows = [], rates = [];
let solverStars = 0, randomStars = 0, randomWins = 0, randomTrials = 0, straightWins = 0;
LEVELS.forEach((level, i) => {
  const n = i + 1, sol = solve(level);
  check(sol.solvable, `level ${n} solvable`);
  if (!sol.solvable) return;
  check(sol.min === level.min, `level ${n} stored shortest ${level.min} = solver ${sol.min}`);
  const w = walk(level, sol.best);
  check(w.correct, `level ${n} solver route is correct by walk()`);
  solverStars += stars(sol.best.length - 1, level.min);
  const counts = brute(level, sol.min + 2);
  const bruteMin = counts.findIndex(c => c > 0), bruteUpTo = counts.reduce((a, c, h) => a + (h <= sol.min + 2 ? c || 0 : 0), 0);
  check(bruteMin === sol.min, `level ${n} brute-force shortest ${bruteMin} = solver ${sol.min}`);
  check(bruteUpTo === sol.countUpTo, `level ${n} brute-force routes up to +2 ${bruteUpTo} = solver ${sol.countUpTo}`);
  const straight = straightPaths(level), straightOk = straight.some(p => walk(level, p).correct);
  if (straightOk) straightWins++;
  if (n > 3) check(!straightOk, `level ${n}: no shortest-by-distance path solves it`);
  if (level.must) check(essential(level, level.must), `level ${n}: the new idea (${level.must}) matters`);
  const r = rng(n * 31);
  let wins = 0, starSum = 0;
  const trials = 400;
  for (let t = 0; t < trials; t++) { const res = randomBot(level, r); if (res.won) { wins++; starSum += res.stars; } }
  randomWins += wins; randomTrials += trials; rates[n] = wins / trials;
  const kinds = [...new Set(level.nodes.map(v => v.kind + (v.once ? '+sleepy' : '')).filter(k => k !== 'teller' && k !== 'listener'))];
  randomStars += starSum;
  rows.push({ n, name: level.name, villagers: level.nodes.length, paths: level.edges.length, min: sol.min, shortest: sol.countMin, upTo2: sol.countUpTo,
    straight: straightOk ? 'solves' : 'fails', random: (100 * wins / trials).toFixed(0) + '%', newIdea: level.must ?? (n <= 3 ? 'paint' : 'mix'), kinds: kinds.join(' ') });
});

// 4. A do-nothing bot sends the teller's message without a route; it must never be what the listener wants.
const nothingWins = LEVELS.filter(level => walk(level, [level.from]).correct || (level.start.s === level.want.s && level.start.c === level.want.c && level.start.n === level.want.n)).length;
check(nothingWins === 0, 'the do-nothing bot never wins');

// 5. A year of daily villages.
let dailyOk = 0, dailyFallback = 0;
const dailyMins = [];
{
  const day = new Date(2026, 0, 1);
  for (let d = 0; d < 365; d++) {
    const seed = dailySeed(day.getFullYear(), day.getMonth() + 1, day.getDate());
    const a = daily(seed, LEVELS[20]), b = daily(seed, LEVELS[20]);
    if (a === LEVELS[20]) dailyFallback++;
    const sol = solve(a);
    if (sol.solvable && JSON.stringify(a) === JSON.stringify(b) && straightPaths(a).every(p => !walk(a, p).correct)) dailyOk++;
    else fail(`daily ${day.toDateString()} (seed ${seed})`);
    dailyMins.push(sol.min);
    day.setDate(day.getDate() + 1);
  }
}

console.table(rows);
const avg = list => (list.reduce((a, b) => a + b, 0) / list.length).toFixed(1);
console.log(`solver bot: won ${LEVELS.length}/${LEVELS.length} levels, ${solverStars}/${3 * LEVELS.length} stars`);
console.log(`random bot (three sends a level): won ${(100 * randomWins / randomTrials).toFixed(1)}% of ${randomTrials} level attempts, ${(randomStars / randomTrials).toFixed(2)} stars per attempt (solver: 3.00)`);
console.log(`do-nothing bot: won ${nothingWins}/${LEVELS.length}`);
console.log(`levels a shortest-by-distance path solves: ${straightWins} (only levels 1 to 3 may)`);
console.log(`daily villages for 2026: ${dailyOk}/365 solvable and repeatable, ${dailyFallback} used the fixed fallback, shortest route ${Math.min(...dailyMins)} to ${Math.max(...dailyMins)} hops (mean ${avg(dailyMins)})`);
// 6. The ramp: from level 4 on, the random bot's win rate falls roughly steadily.
//    Each level is within RAMP_TOL of the median of the five levels around it, and each group of three
//    (one villager kind) is no easier on average than the group before, give or take RAMP_STEP.
const RAMP_TOL = 0.12, RAMP_STEP = 0.05;
for (let n = 4; n <= LEVELS.length; n++) {
  const near = [];
  for (let k = Math.max(4, n - 2); k <= Math.min(LEVELS.length, n + 2); k++) near.push(rates[k]);
  near.sort((a, b) => a - b);
  const med = near.length % 2 ? near[(near.length - 1) / 2] : (near[near.length / 2 - 1] + near[near.length / 2]) / 2;
  check(Math.abs(rates[n] - med) <= RAMP_TOL, `ramp: level ${n} random win ${(100 * rates[n]).toFixed(0)}% is within ${100 * RAMP_TOL} points of its neighbours' median ${(100 * med).toFixed(0)}%`);
}
const groups = [];
for (let n = 4; n + 2 <= LEVELS.length; n += 3) groups.push((rates[n] + rates[n + 1] + rates[n + 2]) / 3);
groups.forEach((m, i) => { if (i) check(m <= groups[i - 1] + RAMP_STEP, `ramp: levels ${4 + 3 * i}-${6 + 3 * i} average ${(100 * m).toFixed(0)}% is not easier than the group before (${(100 * groups[i - 1]).toFixed(0)}%)`); });
console.log(`ramp: random-bot win rate by group of three from level 4: ${groups.map(m => (100 * m).toFixed(0) + '%').join(' ')}`);
check(randomWins / randomTrials < 0.6 && randomStars / randomTrials < 1.5, 'the random bot does clearly worse than the solver bot');
check(Date.now() - t0 < 60000, 'bots finish in under 60 seconds');
console.log(`${failures ? 'FAILED' : 'all checks passed'} in ${((Date.now() - t0) / 1000).toFixed(1)} s (kinds known: ${KINDS.length})`);
process.exit(failures ? 1 : 0);
