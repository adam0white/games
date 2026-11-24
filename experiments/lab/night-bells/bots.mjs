// node bots.mjs; node bots.mjs --mutate must exit nonzero.
// The timing policy uses the oscillator equation, never the simulator's ready flag.
import { readFile } from 'node:fs/promises';
const MUTATE = process.argv.includes('--mutate');
let rules = await import('./sim.js');
if (MUTATE) {
  const source = await readFile(new URL('./sim.js', import.meta.url), 'utf8');
  const broken = source.replace('return apexDistance(b) <=', 'return apexDistance(b) >=');
  if (source === broken) throw new Error('Timing mutation did not apply');
  rules = await import(`data:text/javascript;base64,${Buffer.from(broken).toString('base64')}`);
}
const { create, step, view, DT, LEVELS, rng, digest } = rules;
const SEEDS = 32;
let failures = 0;
function check(condition, message) { console.log(`${condition ? 'ok' : 'FAIL'} ${message}`); if (!condition) failures++; }
const nearExpected = (phase, width) => Math.abs(Math.sin(phase)) <= Math.sin(width) + 1e-10;

export function careful() {
  const struck = [];
  let next = 0;
  return s => {
    if (s.t + 1e-10 < next) return [];
    for (let i = 0; i < s.bells.length; i++) {
      const b = s.bells[i], apex = Math.round(b.phase / Math.PI);
      const width = s.window / Math.sqrt(s.difficulty) * b.omega * s.difficulty;
      if (struck[i] !== apex && nearExpected(b.phase, width)) {
        struck[i] = apex; next = s.t + .15; return [i];
      }
    }
    return [];
  };
}
export function clumsy(seed) {
  const random = rng(seed * 47 + 11);
  let agenda, next = 0;
  const lag = () => .03 + random() * .42;
  return s => {
    if (!agenda) agenda = s.bells.map(b => {
      const first = (Math.ceil(b.phase / Math.PI) * Math.PI - b.phase) / b.omega;
      return { first, half: Math.PI / b.omega, count: 0, due: first + lag() };
    });
    if (s.t + 1e-10 < next) return [];
    let i = agenda.findIndex(a => s.t + 1e-10 >= a.due);
    if (i < 0) return [];
    const a = agenda[i]; a.count++; a.due = a.first + a.count * a.half + lag();
    next = s.t + .16;
    return [i];
  };
}
export function play(level, seed, policy, endless = false, seconds = 90) {
  const s = create(level, seed, endless);
  while (!s.over && s.t < seconds) step(s, policy(s));
  return s;
}
function range(values) { return `${Math.min(...values).toFixed(2)}–${Math.max(...values).toFixed(2)}`; }

// All policies supply at most one action per 150 ms, including overlapping apexes.
const carefulCounts = [], clumsyCounts = [], spamCounts = [];
let carefulTime = [], firstTime = [], maxMisses = 0, harmonies = 0, minSpacing = 100, overlapSteps = 0;
for (let n = 1; n <= LEVELS; n++) {
  let wins = 0, clumsyWins = 0, spamWins = 0;
  const times = [];
  for (let seed = 1; seed <= SEEDS; seed++) {
    const policy = careful(); let previous = -100;
    const a = play(n, seed, s => {
      if (s.bells.filter(b => nearExpected(b.phase, s.window * b.omega)).length > 1) overlapSteps++;
      const action = policy(s);
      if (action.length) { minSpacing = Math.min(minSpacing, s.t - previous); previous = s.t; }
      return action;
    });
    wins += Number(a.won); times.push(a.t); carefulTime.push(a.t);
    if (n === 1) firstTime.push(a.t);
    maxMisses = Math.max(maxMisses, a.misses); harmonies += a.harmony;
    clumsyWins += Number(play(n, seed, clumsy(seed * 101 + n)).won);
    spamWins += Number(play(n, seed, s => [Math.floor(s.t / .14) % s.bells.length]).won);
  }
  carefulCounts.push(wins); clumsyCounts.push(clumsyWins); spamCounts.push(spamWins);
  console.log(`level ${n}: careful ${wins}/${SEEDS}, clumsy ${clumsyWins}/${SEEDS}, spam ${spamWins}/${SEEDS}, careful seconds ${range(times)}`);
}
check(carefulCounts.every(n => n === SEEDS), `careful completes all ${LEVELS * SEEDS} runs; ${maxMisses} misses, ${harmonies} harmony bursts`);
check(firstTime.every(t => t <= 60), `level 1 careful completion ${range(firstTime)} seconds (under one minute; human learning remains unverified)`);
check(minSpacing >= .15 - 1e-10 && overlapSteps > 0, `independent one-thumb scheduler: minimum action interval ${minSpacing.toFixed(6)} seconds, ${overlapSteps} multi-bell overlap steps`);
check(clumsyCounts[0] >= SEEDS / 2, `clumsy level 1 ${clumsyCounts[0]}/${SEEDS} (at least half)`);
check(clumsyCounts[1] >= 1, `clumsy level 2 ${clumsyCounts[1]}/${SEEDS} (at least one; usable transition)`);
const clumsyTotal = clumsyCounts.reduce((a, b) => a + b, 0);
check(clumsyTotal > 0 && clumsyTotal < LEVELS * SEEDS, `clumsy has both successes and failures: ${clumsyTotal}/${LEVELS * SEEDS}; 30–450ms reaction lag`);
check(clumsyCounts.slice(5).reduce((a, b) => a + b, 0) < clumsyCounts.slice(0, 3).reduce((a, b) => a + b, 0), 'clumsy completes fewer late levels than early levels');
check(spamCounts.every(n => n === 0), `frame-rate spam wins ${spamCounts.reduce((a,b) => a+b,0)}/${LEVELS * SEEDS}`);

// Independent boundary oracle: imposed phase, known width, no future clock advancement.
// Tap processing happens at the state time; the subsequent step advances the pendulum.
let boundaryFailures = 0;
for (const side of [-1, 1]) for (const apex of [2, 3]) for (const factor of [.999, 1.001]) {
  const s = create(3, 17), b = s.bells[0];
  b.phase = apex * Math.PI + side * s.window * b.omega * factor;
  const shouldHit = factor < 1;
  step(s, [0]);
  if ((s.hits === 1) !== shouldHit) boundaryFailures++;
}
check(boundaryFailures === 0, `independent apex-boundary cases: ${8 - boundaryFailures}/8`);
{
  const s = create(2, 19), b = s.bells[0], p0 = b.phase, e0 = b.energy;
  for (let k = 0; k < 120; k++) step(s);
  check(Math.abs(b.phase - (p0 + b.omega)) < 1e-11 && Math.abs(b.energy - e0 * Math.exp(-s.decay)) < 1e-11,
    'one-second undriven motion matches the analytic phase and damping reference');
  b.phase = Math.PI * 4;
  const before = b.phase, beforeEnergy = b.energy;
  step(s, [0]);
  check(s.hits === 1 && b.energy > beforeEnergy && Math.abs(b.phase - before - b.omega * DT) < 1e-12,
    'an apex impulse restores energy and preserves oscillator phase');
  const hits = s.hits;
  for (let k = 0; k < 20; k++) step(s, [0]);
  check(s.hits === hits, 'the same apex cannot be struck twice');
}
{
  const a = play(6, 12, clumsy(84)), b = play(6, 12, clumsy(84)), c = play(6, 13, clumsy(84));
  check(digest(a) === digest(b) && JSON.stringify(a.bells) !== JSON.stringify(c.bells), 'same-seed runs are identical; different seeds change bell motion, excluding seed metadata');
  let idleWins = 0, premature = 0;
  for (let n = 1; n <= LEVELS; n++) for (let seed = 1; seed <= SEEDS; seed++) {
    const s = play(n, seed, () => []);
    idleWins += Number(s.won);
    if (n === 1 && s.over) premature++;
  }
  const learning = create(1, 1); for (let k = 0; k < 4 / DT; k++) step(learning);
  check(idleWins === 0 && premature === 0 && !learning.over && learning.hits === 0, `idle wins ${idleWins}/${LEVELS * SEEDS}; level 1 remains available after 90 seconds and initial four seconds`);
}
{
  let finite = true, changed = false;
  for (const level of [NaN, Infinity, -100, 900, undefined]) {
    const s = create(level, NaN);
    for (const taps of [null, undefined, {}, [NaN, Infinity, -1, 50, '0'], '0']) {
      const h = s.hits, m = s.misses; step(s, taps); changed ||= s.hits !== h || s.misses !== m;
    }
    finite &&= s.bells.every((b, i) => Object.values(b).every(v => v === null || Number.isFinite(v)) && Object.values(view(s, i)).every(v => typeof v === 'boolean' || Number.isFinite(v)));
  }
  check(finite && !changed, 'invalid levels, seeds and input packets produce finite motion without strikes');
  const s = create(2, 8); s.bells.forEach(b => { b.phase = Math.PI * 2; }); step(s, [0, 1]);
  check(s.hits === 1, 'a multi-index packet cannot perform simultaneous strikes');
  const ended = play(2, 1, careful()), before = digest(ended); step(ended, [0]);
  check(before === digest(ended), 'finished state is immutable under further steps');
}
{
  const idle = play(8, 7, () => [], true, 300);
  const active = play(8, 7, careful(), true, 180);
  check(idle.over && !idle.won && idle.t > 4 && idle.t < 120, `endless idle fades at ${idle.t.toFixed(2)} seconds`);
  check(!active.over && active.score > idle.score && active.difficulty > 1.9 / 1.2 && active.window / Math.sqrt(active.difficulty) < active.window,
    `endless careful survives ${active.t.toFixed(2)} seconds: score ${active.score}, difficulty ${active.difficulty.toFixed(2)}, window ${(active.window / Math.sqrt(active.difficulty)).toFixed(3)} seconds`);
}
console.log(`${MUTATE ? 'mutation' : 'normal'}: ${failures} failed checks; careful times ${range(carefulTime)} seconds`);
process.exitCode = failures ? 1 : 0;
