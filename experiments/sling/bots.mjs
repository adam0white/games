// The same fixed-tick rules as the page. No browser and no test-only game mode.
// --mutate loads a genuinely broken water rule; the independent collision probe
// must then fail and the process must exit nonzero.
import { readFile } from 'node:fs/promises';
const mutated = process.argv.includes('--mutate');
let sim;
if (mutated) {
  const source = await readFile(new URL('./sim.js', import.meta.url), 'utf8');
  const bad = source.replace("p.type === 'water' || p.type === 'thorn'", "p.type === 'thorn'");
  if (bad === source) throw new Error('water mutation did not apply');
  sim = await import('data:text/javascript;base64,' + Buffer.from(bad).toString('base64'));
} else sim = await import('./sim.js');
const { DT, GAIN, MAX_PULL, LEVELS, level, daily, create, select, launch, step, resolve, solve, guide, windAt, preview, score } = sim;
let failures = 0, assertions = 0;
const check = (ok, name) => { assertions++; if (!ok) { failures++; console.error('FAIL ' + name); } };
const wait = (s, n) => { for (let i = 0; i < n; i++) step(s); };
function replay(l, shots) {
  const s = create(l);
  for (const shot of shots) { wait(s, shot.wait || 0); select(s, shot.from); launch(s, shot.dx, shot.dy); resolve(s); }
  return s;
}
const rng = seed => {
  let r = seed >>> 0;
  return () => { r = (Math.imul(r, 1664525) + 1013904223) >>> 0; return r / 4294967296; };
};

// A deliberately imprecise thumb: 3 s of looking before every throw, independent
// errors in both gesture axes, and a small seed allowance. It replans only from
// the flowers it really grew, never teleports or receives a forced loss.
function clumsy(l, seed, jitter = 7) {
  const r = rng(seed), s = create(l), budget = l.par + 2;
  while (s.status === 'play' && s.seeds < budget) {
    wait(s, 180);
    const a = guide(s);
    if (!a) break;
    wait(s, a.wait || 0);
    select(s, a.from);
    const dx = a.dx + (r() * 2 - 1) * jitter;
    const dy = a.dy + (r() * 2 - 1) * jitter;
    launch(s, dx, dy); resolve(s);
  }
  return s;
}

// Collision probes are explicit geometries with externally stated outcomes.
// Their launch is a short downward toss except the upward thorn test.
function probe(type, upward = false) {
  const l = { name: 'probe', platforms: [
    { x: 0, y: upward ? 350 : 250, w: 10, type: 'soil' },
    { x: 0, y: 300, w: 360, type },
    { x: 280, y: 80, w: 50, type: 'soil', target: true },
  ], start: { x: 65, y: upward ? 350 : 250 }, bees: [], wind: 0 };
  const s = create(l); launch(s, 0, upward ? 70 : -15);
  for (let n = 0; n < 90 && s.seed; n++) {
    step(s);
    if (s.events.some(e => e.e === 'bounce')) break;
  }
  return s;
}
{
  const water = probe('water');
  check(!water.seed && water.flowers.length === 1 && water.events.some(e => e.reason === 'water'), 'water loses a seed and grows no flower');
  check(water.status === 'play' && launch(water, -20, 70) && water.seeds === 2, 'a lost seed allows a new throw and preserves the seed cost');
  const thorn = probe('thorn', true);
  check(!thorn.seed && thorn.events.some(e => e.reason === 'thorn'), 'thorns lose an upward-crossing seed');
  const rock = probe('rock');
  check(rock.seed?.vy < 0 && rock.flowers.length === 1 && rock.events.some(e => e.e === 'bounce'), 'rock reverses downward velocity without growing a flower');
  const lily = probe('lily');
  check(!lily.seed && lily.flowers.length === 2 && lily.flowers[1].platform === 1, 'lily catches a seed and creates a selectable flower');
  const soil = probe('soil');
  check(soil.flowers.length === 2 && select(soil, 1), 'soil grows a selectable launch point');
  check(launch(soil, -30, 65) && !select(soil, 0), 'cannot switch flower during flight');
  const beeLevel = { ...level(0), bees: [{ x: 65, y: 494, r: 15, vx: 96, vy: -120 }] };
  const bee = create(beeLevel); launch(bee, 0, 20); step(bee);
  check(bee.seed?.carried === 24 && bee.seed.vx === 96 && bee.seed.vy === -120, 'bee contact sets the advertised fixed velocity');
  const bx = bee.seed?.x, by = bee.seed?.y; wait(bee, 24);
  check(Math.abs(bee.seed.x - bx - 96 * 24 * DT) < 1e-8 && Math.abs(bee.seed.y - by + 120 * 24 * DT) < 1e-8 && bee.seed.carried === 0, 'bee carries at its fixed vector for exactly 24 ticks');
  const cap = create(level(0)); launch(cap, 0, 1000);
  check(Math.abs(cap.seed.vy) === GAIN * MAX_PULL && cap.seeds === 1, 'pull caps at 100 units and spends one seed');
  const aiming = create(level(0)), before = JSON.stringify(aiming), points = preview(aiming, -30, 70);
  check(points.length > 5 && JSON.stringify(aiming) === before, 'nonempty trajectory preview does not change the idle real run');
  const gust = level(8), idle = create(gust); wait(idle, 60);
  check(Math.abs(windAt(gust, idle.tick) - gust.wind) < 1e-8 && windAt(gust, 180) < 0, 'wind changes direction on a visible global rhythm while idle');
  check(score(3, 100000) > score(4, 0) && score(2, 3) > score(2, 4) && score(999, 100000) === 1, 'fewer seeds always beat any time; time breaks a seed tie');
  check(!launch(create(level(0)), NaN, 30) && !launch(create(level(0)), 1, 1), 'invalid and tiny gestures spend no seed');
}

if (mutated) {
  console.log(`${assertions} independent probes; ${failures} failures after disabling the actual water-loss branch.`);
  process.exit(failures ? 1 : 0);
}

const rows = [];
let slowSeconds = 0, allPar = 0, bestFlight = 0;
for (let k = 0; k < LEVELS; k++) {
  const l = level(k), answer = solve(l);
  check(!!answer, `lesson ${k + 1} has a collision-checked solution`);
  if (!answer) continue;
  const a = replay(l, answer.shots), b = replay(l, answer.shots);
  check(a.status === 'won' && a.seeds === l.par && answer.par === l.par, `lesson ${k + 1} finishes at stated par ${l.par}`);
  check(JSON.stringify(a) === JSON.stringify(b), `lesson ${k + 1} is deterministic through its complete event log`);
  const targetCount = l.platforms.filter(p => p.target).length;
  check(a.flowers.filter(f => l.platforms[f.platform].target).length === targetCount, `lesson ${k + 1} fills every required patch`);
  // All but the lily lesson attain the counting lower bound: one seed per target.
  check(k === 6 || a.seeds === targetCount, `lesson ${k + 1} par attains the target-count lower bound`);
  for (const phase of [0, 53, 137]) {
    const s = create(l); wait(s, phase);
    for (let n = 0; n < l.par + 1 && s.status === 'play'; n++) {
      const g = guide(s); if (!g) break;
      wait(s, g.wait || 0);
      select(s, g.from); launch(s, g.dx, g.dy); resolve(s);
    }
    check(s.status === 'won', `lesson ${k + 1} can be solved after ${phase} idle ticks`);
  }
  let wins = 0, seconds = 0;
  const N = 400;
  for (let n = 1; n <= N; n++) {
    const s = clumsy(l, n * 7919);
    if (s.status === 'won') wins++;
    seconds += s.tick * DT;
  }
  rows.push({ lesson: k + 1, par: l.par, 'clumsy won / 400': wins, '%': +(100 * wins / N).toFixed(1), 'mean seconds': +(seconds / N).toFixed(1) });
  slowSeconds += a.tick * DT + 3 * a.seeds;
  allPar += a.seeds; bestFlight += a.tick * DT;
}
check(rows[0]['clumsy won / 400'] === 400, 'first lesson is forgiving enough for every clumsy bot');
const band = start => rows.slice(start, start + 5).reduce((n, x) => n + x['clumsy won / 400'], 0) / 20;
for (let k = 1; k < rows.length; k++) check(rows[k]['clumsy won / 400'] < rows[k - 1]['clumsy won / 400'], `clumsy completion strictly decreases from lesson ${k} to ${k + 1}`);
check(rows[14]['clumsy won / 400'] < rows[0]['clumsy won / 400'] * 0.8, 'final lesson is materially harder than the first');
check(slowSeconds >= 60 && slowSeconds <= 240, `15-garden progression has 1–4 minutes of flight and 3-second aiming decisions (${slowSeconds.toFixed(1)} s)`);

let retryCount = 0, maxRetry = 0;
for (let d = 0; d < 120; d++) {
  const date = new Date(Date.UTC(2026, 0, 1 + d)).toISOString().slice(0, 10);
  const l = daily(date), answer = solve(l);
  check(l.platforms.filter(p => p.target).length === 9 && l.par === 9, `daily ${date} has nine targets and a no-miss par`);
  check(!!answer && replay(l, answer.shots).status === 'won', `daily ${date} is solver-checked and finishable`);
  check(JSON.stringify(l) === JSON.stringify(daily(date)), `daily ${date} is deterministic`);
  retryCount += l.attempt; maxRetry = Math.max(maxRetry, l.attempt);
}
check(JSON.stringify(daily('2026-11-23')) !== JSON.stringify(daily('2026-11-24')), 'different UTC dates produce different daily gardens');
let rejected = false; try { daily('2026-02-30'); } catch { rejected = true; }
check(rejected, 'invalid calendar date is rejected');
console.table(rows);
console.log(`15 lessons: ${allPar} par seeds; flights and gust waits ${bestFlight.toFixed(1)} s; with 3-second aiming ${slowSeconds.toFixed(1)} s.`);
console.log(`Clumsy lesson completion: ${rows.map(r => r['%'] + '%').join(', ')}. Same ±7-unit pull error and par+2 seed cap at every level.`);
console.log(`120 UTC dailies solved and deterministic; ${retryCount} discarded candidates, maximum ${maxRetry} retries.`);
console.log(`${assertions} checks; ${failures ? failures + ' FAILED' : 'all passed'}${mutated ? ' (actual water-rule mutation)' : ''}.`);
process.exitCode = failures ? 1 : 0;
