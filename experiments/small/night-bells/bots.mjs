// node bots.mjs                 every claim below; exit 0
// node bots.mjs --mutate        apex acceptance reversed: must exit nonzero
// node bots.mjs --mutate=order  the bell order ignored: must exit nonzero
// node bots.mjs --mutate=hold   the clock no longer waits on a full bar: must exit nonzero
// The timing policies use the oscillator equation and the night's spec, never the simulator's ready flag.
import { readFile } from 'node:fs/promises';
const arg = process.argv.find(a => a.startsWith('--mutate'));
const MUTATE = arg ? arg.split('=')[1] || 'apex' : '';
let rules = await import('./sim.js');
if (MUTATE) {
  const source = await readFile(new URL('./sim.js', import.meta.url), 'utf8');
  const swaps = {
    apex: ['return apexDistance(b) <=', 'return apexDistance(b) >='],
    order: ['if (s.order && nextInOrder(s) !== i) return false;', ''],
    hold: ['} else if (s.hold && full) s.held += DT;', '}'],
  }[MUTATE];
  if (!swaps) throw new Error(`unknown mutation ${MUTATE}`);
  const broken = source.replace(swaps[0], swaps[1]);
  if (source === broken) throw new Error('mutation did not apply');
  rules = await import(`data:text/javascript;base64,${Buffer.from(broken).toString('base64')}`);
}
const { create, step, view, DT, LEVELS, LEGACY, NIGHTS, CHORD, rng, digest, melody, dailySpec, dayNumber, plainHunt, nextInOrder } = rules;
const SEEDS = 32;
let failures = 0;
function check(condition, message) { console.log(`${condition ? 'ok' : 'FAIL'} ${message}`); if (!condition) failures++; }
const nearExpected = (phase, width) => Math.abs(Math.sin(phase)) <= Math.sin(width) + 1e-10;
const mod2 = k => ((k % 2) + 2) % 2;
// What the night's rules allow for bell i at apex k, read from the spec fields on the state.
function legal(s, i, k) {
  const b = s.bells[i];
  if (b.free) return false;
  if (b.side !== undefined && mod2(k) !== b.side) return false;
  if (s.order && s.order[s.orderAt % s.order.length] !== i) return false;
  return true;
}

// Strikes as soon as the window opens, once per apex, at least 150 ms apart.
export function careful() {
  const struck = [];
  let next = 0;
  return s => {
    if (s.t + 1e-10 < next) return [];
    for (let i = 0; i < s.bells.length; i++) {
      const b = s.bells[i], apex = Math.round(b.phase / Math.PI);
      const width = s.window / Math.sqrt(s.difficulty) * b.omega * s.difficulty;
      if (struck[i] !== apex && legal(s, i, apex) && nearExpected(b.phase, width)) {
        struck[i] = apex; next = s.t + .15; return [i];
      }
    }
    return [];
  };
}
// main's delayed-response bot: plans every apex from the first phase (open loop). Kept for the parity fixture.
export function clumsyOpen(seed) {
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
// The delayed-response bot: sees each bell reach the top, then strikes 30-450 ms later, at least 160 ms apart.
// It follows the night's rules (order, handstroke), so gusts, couplings and rope changes do not fool it.
export function clumsy(seed) {
  const random = rng(seed * 47 + 11);
  let seen = null, next = 0;
  const queue = [], lag = () => .03 + random() * .42;
  return s => {
    if (!seen) seen = s.bells.map(b => Math.floor(b.phase / Math.PI));
    s.bells.forEach((b, i) => {
      const k = Math.floor(b.phase / Math.PI);
      if (k !== seen[i]) {
        seen[i] = k;
        if (legal(s, i, k) && !queue.some(q => q.i === i)) queue.push({ i, due: s.t + lag() });
      }
    });
    if (s.t + 1e-10 < next) return [];
    while (queue.length && s.t - queue[0].due > 1) queue.shift();
    const at = queue.findIndex(q => s.t + 1e-10 >= q.due);
    if (at < 0) return [];
    const [q] = queue.splice(at, 1);
    next = s.t + .16;
    return [q.i];
  };
}
export function play(level, seed, policy, endless = false, seconds = 120, spec = null) {
  const s = create(level, seed, endless, spec);
  while (!s.over && s.t < seconds) step(s, policy(s));
  return s;
}
function range(values) { return `${Math.min(...values).toFixed(2)}–${Math.max(...values).toFixed(2)}`; }

// 1. Parity: main's eight nights and endless, run through these rules, match values taken from main on 2026-11-24.
{
  const project = s => JSON.stringify([s.t, s.hits, s.misses, s.lights, s.harmony, s.score, s.over, s.won, s.why, s.combo, s.accuracy, s.flash, s.aligned, s.bells.map(b => [b.phase, b.energy, b.lastApex, b.lastGood, b.hitFlash, b.missFlash])]);
  const fnv = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return (h >>> 0).toString(16); };
  const out = [];
  const one = (s, p, limit) => { let trail = ''; while (!s.over && s.t < limit) { step(s, p(s)); if (s.ticks % 240 === 0) trail += project(s); } out.push(fnv(trail + project(s))); };
  for (let n = 1; n <= 8; n++) for (let seed = 1; seed <= 6; seed++) for (const kind of ['careful', 'clumsy', 'idle'])
    one(create(n, seed, false, LEGACY[n - 1]), kind === 'careful' ? careful() : kind === 'clumsy' ? clumsyOpen(seed * 101 + n) : () => [], 90);
  for (let seed = 1; seed <= 3; seed++) for (const kind of ['careful', 'idle']) one(create(1, seed, true, LEGACY[0]), kind === 'careful' ? careful() : () => [], 100);
  const hash = fnv(out.join(','));
  check(hash === '92c13613', `main's eight nights and endless replay bit for bit through the new rules (${out.length} runs, ${hash})`);
  let same = 0;
  for (let seed = 1; seed <= 8; seed++) same += Number(project(play(1, seed, clumsy(seed), false, 90, LEGACY[0])) === project(play(1, seed, clumsy(seed), false, 90)));
  check(same === 8, `night 1 is main's night 1 (${same}/8 identical runs)`);
}

// 2. Every night: careful clears it; the delayed-response bot falls gently; tapping on a beat and idling never win.
const carefulCounts = [], clumsyCounts = [], oldClumsy = [], spamCounts = [];
let carefulTime = [], firstTime = [], maxMisses = 0, harmonies = 0, minSpacing = 100, overlapSteps = 0, heldTimeLosses = 0;
for (let n = 1; n <= LEVELS; n++) {
  let wins = 0, clumsyWins = 0, spamWins = 0, before = 0;
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
    const c = play(n, seed, clumsy(seed * 101 + n));
    clumsyWins += Number(c.won);
    if (c.why === 'time' && c.lights >= c.target) heldTimeLosses++;
    if (n <= 8) before += Number(play(n, seed, clumsy(seed * 101 + n), false, 120, LEGACY[n - 1]).won);
    spamWins += Number(play(n, seed, s => [Math.floor(s.t / .14) % s.bells.length]).won);
  }
  carefulCounts.push(wins); clumsyCounts.push(clumsyWins); spamCounts.push(spamWins); if (n <= 8) oldClumsy.push(before);
  console.log(`night ${String(n).padStart(2)} ${NIGHTS[n - 1].idea.padEnd(10)}: careful ${wins}/${SEEDS}, clumsy ${clumsyWins}/${SEEDS}${n <= 8 ? ` (main's rules ${before}/${SEEDS})` : ''}, spam ${spamWins}/${SEEDS}, careful seconds ${range(times)}`);
}
check(carefulCounts.every(n => n === SEEDS), `careful completes all ${LEVELS * SEEDS} runs; ${maxMisses} misses, ${harmonies} harmony bursts`);
check(firstTime.every(t => t <= 60), `night 1 careful completion ${range(firstTime)} seconds (under one minute; human learning remains unverified)`);
check(minSpacing >= .15 - 1e-10 && overlapSteps > 0, `independent one-thumb scheduler: minimum action interval ${minSpacing.toFixed(6)} seconds, ${overlapSteps} multi-bell overlap steps`);
check(clumsyCounts[0] >= SEEDS / 2, `clumsy night 1 ${clumsyCounts[0]}/${SEEDS} (at least half)`);
const drops = clumsyCounts.slice(1).map((c, i) => clumsyCounts[i] - c);
check(Math.max(...drops) <= 6, `no cliff: the delayed-response bot loses at most 6/32 between neighbouring nights (largest drop ${Math.max(...drops)}; ${clumsyCounts.join(' ')})`);
check(Math.min(...clumsyCounts) >= 2, `every night stays possible for the delayed-response bot (lowest ${Math.min(...clumsyCounts)}/32)`);
const third = k => clumsyCounts.slice(k * 8, k * 8 + 8).reduce((a, b) => a + b, 0);
check(third(2) < third(1) && third(1) < third(0), `the delayed-response bot clears fewer later nights: ${third(0)}, ${third(1)}, ${third(2)} of 256 by thirds`);
check(spamCounts.every(n => n === 0), `beat spam wins ${spamCounts.reduce((a, b) => a + b, 0)}/${LEVELS * SEEDS}`);
check(heldTimeLosses === 0, `no night is lost on the clock with a full bar (${heldTimeLosses} such losses for the delayed-response bot)`);
{
  // main's open-loop bot and this closed-loop bot agree on main's rules (the new bot is not a weaker bot).
  let open = 0, closed = 0;
  for (let n = 1; n <= 8; n++) for (let seed = 1; seed <= SEEDS; seed++) {
    open += Number(play(n, seed, clumsyOpen(seed * 101 + n), false, 90, LEGACY[n - 1]).won);
    closed += Number(play(n, seed, clumsy(seed * 101 + n), false, 90, LEGACY[n - 1]).won);
  }
  check(Math.abs(open - closed) <= 16, `on main's nights the closed-loop bot wins ${closed}/256, main's open-loop bot ${open}/256 (${oldClumsy.join(' ')} by night)`);
}

// 3. Timing and impulse rules (unchanged from main).
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
  for (let n = 1; n <= LEVELS; n++) for (let seed = 1; seed <= 8; seed++) {
    const s = play(n, seed, () => []);
    idleWins += Number(s.won);
    if (n === 1 && s.over) premature++;
  }
  const learning = create(1, 1); for (let k = 0; k < 4 / DT; k++) step(learning);
  check(idleWins === 0 && premature === 0 && !learning.over && learning.hits === 0, `idle wins ${idleWins}/${LEVELS * 8}; night 1 stays open without input`);
}
{
  let finite = true, changed = false;
  for (const level of [NaN, Infinity, -100, 900, undefined]) {
    const s = create(level, NaN);
    for (const taps of [null, undefined, {}, [NaN, Infinity, -1, 50, '0'], '0']) {
      const h = s.hits, m = s.misses; step(s, taps); changed ||= s.hits !== h || s.misses !== m;
    }
    finite &&= s.bells.every((b, i) => Object.values(b).every(v => v === null || typeof v === 'boolean' || Number.isFinite(v)) && Object.values(view(s, i)).every(v => typeof v === 'boolean' || Number.isFinite(v)));
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

// 4. The new rules, each against a reference worked out here.
const atTop = (s, i, k = 2) => { s.bells[i].phase = k * Math.PI; s.nextTap = 0; };
const level = idea => NIGHTS.findIndex(n => n.idea === idea) + 1;
{
  const s = create(level('rounds'), 3); // order 1-2-3
  atTop(s, 1); step(s, [1]);
  const wrong = s.misses === 1 && s.hits === 0;
  atTop(s, 0, 4); step(s, [0]); atTop(s, 1, 4); step(s, [1]);
  check(wrong && s.hits === 2 && nextInOrder(s) === 2, 'rounds: a bell rung out of order at its top is a miss; in order it rings');
  check(plainHunt(3, 6).join('') === '012102120210201021', `plain hunt on three: ${plainHunt(3, 6).join('')}`);
}
{
  const s = create(level('handstroke'), 3); // bell 2 only at even tops (its right-hand swing)
  atTop(s, 1, 3); step(s, [1]);
  const wrongSide = s.misses === 1;
  atTop(s, 1, 4); step(s, [1]);
  check(wrongSide && s.hits === 1, 'handstroke: the rose bell rings on one side of its swing and misses on the other');
}
{
  const s = create(level('octave'), 3);
  atTop(s, 0); step(s, [0]); for (let k = 0; k < Math.round(.2 / DT); k++) step(s); atTop(s, 1, 6); step(s, [1]);
  const one = s.chords;
  const t = create(level('octave'), 3);
  atTop(t, 0); step(t, [0]); for (let k = 0; k < Math.round((CHORD + .1) / DT); k++) step(t); atTop(t, 1, 6); step(t, [1]);
  const b0 = create(level('octave'), 3).bells;
  check(one === 1 && t.chords === 0 && Math.abs(b0[1].omega / b0[0].omega - 2) < 1e-12,
    `octave: two tops struck ${Math.round(.2 * 1000)} ms apart ring a chord, ${Math.round((CHORD + .1) * 1000)} ms apart do not; lengths 4:1 swing exactly 1:2`);
  const tri = create(level('triad'), 3).bells;
  check(Math.abs(tri[1].omega / tri[0].omega - 1.5) < 1e-12 && Math.abs(tri[2].omega / tri[0].omega - 2) < 1e-12, 'triad: lengths 36:16:9 swing 2:3:4');
}
{
  const s = create(level('beam'), 5); s.decay = 0; s.canFade = false;
  const e = () => s.bells.reduce((a, b) => a + b.energy, 0), e0 = e();
  s.bells[0].phase = 2 * Math.PI + .5; s.bells[1].phase = 2 * Math.PI; // bell 1 leads
  const a0 = s.bells[0].energy; step(s);
  check(Math.abs(e() - e0) < 1e-12 && s.bells[0].energy < a0, 'shared beam: energy moves from the leading bell to the lagging one and none is lost');
}
{
  const s = create(level('gust'), 5);
  check(s.gusts.length >= 8 && s.gusts.every((g, i) => i === 0 || g.at > s.gusts[i - 1].at), `gusts: ${s.gusts.length} gusts on a schedule fixed by the seed`);
  const b = s.bells[0], was = b.phase, e0 = b.energy;
  s.gusts = [{ at: 0, bell: 0, push: .3 }]; s.gustAt = 0; step(s);
  const turned = b.phase - was - b.omega * DT;
  // Reference: velocity change in phase space. x = a cos p, y = a sin p + dv.
  const a = Math.sqrt(e0), x = a * Math.cos(was), y = a * Math.sin(was) + .3;
  check(Math.abs(b.energy * Math.exp(s.decay * DT) - Math.min(1, x * x + y * y)) < 1e-9 && Math.abs(turned) < Math.PI / 2, `a gust moves the swing (energy ${e0.toFixed(3)} to ${b.energy.toFixed(3)}, phase ${turned.toFixed(3)} rad) without a jump`);
}
{
  const s = create(level('high'), 4), b = s.bells[0];
  const phaseIn = energy => { b.energy = energy; const p = b.phase; step(s); return b.phase - p; };
  const low = phaseIn(.2), high = phaseIn(1), a = 1.25;
  check(high < low && Math.abs(high / low - (1 - a * a / 16) / (1 - a * a * .2 / 16)) < 1e-9, `high swings: a full swing is ${((1 - high / low) * 100).toFixed(1)}% slower than a low one (period × 1 + A²/16)`);
}
{
  const s = create(level('rope'), 4), b = s.bells[2], w0 = b.omega;
  while (s.t < 12.1) step(s, []);
  check(Math.abs(b.omega / w0 - 1 / Math.sqrt(.55)) < 1e-12, `rope taken in: length × 0.55, the swing quickens × ${(b.omega / w0).toFixed(3)}`);
}
{
  const s = create(level('sympathy'), 4);
  const e0 = s.bells[2].energy; step(s, [2]);
  const inert = s.hits + s.misses === 0;
  const w = play(level('sympathy'), 4, careful());
  check(inert && e0 < .05 && w.won && w.woke, `sympathy: the third bell has no rope; ringing its twin wakes it (careful wins in ${w.t.toFixed(1)} s)`);
}
{
  const s = create(level('heavy'), 4), b = s.bells[2], a = s.bells[0];
  a.energy = b.energy = .5; atTop(s, 2); step(s, [2]); s.nextTap = 0; atTop(s, 0, 6); step(s, [0]);
  check(b.energy < a.energy && b.energy > .5, `heavy tenor: a pull on the heavy bell gives ${((b.energy - .5) / (a.energy - .5) * 100).toFixed(0)}% of the light bell's lift`);
}
{
  const spec = { ...NIGHTS[level('huygens') - 1], lengths: [72, 72, 72], exact: true, decay: 0 };
  const s = create(level('huygens'), 4, false, spec), spread = () => Math.abs(Math.sin((s.bells[0].phase - s.bells[2].phase) / 2));
  s.bells[2].phase += .6; const d0 = spread(); for (let k = 0; k < 10 / DT; k++) step(s);
  check(spread() < d0 / 2, `Huygens' beam: two equal bells ${d0.toFixed(3)} apart are ${spread().toFixed(3)} apart ten seconds later`);
}
{
  const s = create(level('periods'), 4); s.lights = s.target; const held = s.held;
  for (let k = 0; k < 120; k++) step(s);
  check(s.held - held > .99 && !s.over, `a full bar holds the clock (${(s.held - held).toFixed(2)} s held in one second)`);
}
{
  const a = create(level('three'), 9), b = create(level('three'), 9);
  a.rung = [0, 1, 2, 1]; b.rung = [2, 1, 0, 1];
  const ma = melody(a), mb = melody(b), lowest = a.bells.reduce((m, x, i) => x.length > a.bells[m].length ? i : m, 0);
  check(ma.join() !== mb.join() && melody({ ...a, rung: [lowest] })[0] === 0, `the tune is what was rung: ${ma.join('')} and ${mb.join('')}; the longest bell is the lowest note`);
}
{
  const d1 = dailySpec('2026-11-24'), d2 = dailySpec('2026-11-24'), days = [];
  for (let k = 0; k < 60; k++) days.push(new Date(Date.UTC(2026, 10, 24 + k)).toISOString().slice(0, 10));
  const kinds = new Set(days.map(d => dailySpec(d).idea)), seeds = new Set(days.map(dayNumber));
  let cleared = 0, clumsyDaily = 0;
  for (const d of days) {
    cleared += Number(play(1, dayNumber(d), careful(), false, 120, dailySpec(d)).won);
    clumsyDaily += Number(play(1, dayNumber(d), clumsy(dayNumber(d) % 997), false, 120, dailySpec(d)).won);
  }
  check(JSON.stringify(d1) === JSON.stringify(d2) && kinds.size >= 6 && seeds.size === 60, `daily peal: one spec per day, ${kinds.size} kinds of night over 60 days`);
  check(cleared === 60 && clumsyDaily > 0 && clumsyDaily < 60, `daily peal: careful clears ${cleared}/60 days; delayed response ${clumsyDaily}/60`);
}
console.log(`${MUTATE ? `mutation ${MUTATE}` : 'normal'}: ${failures} failed checks; careful times ${range(carefulTime)} seconds`);
process.exitCode = failures ? 1 : 0;
