// Pure Node, seeded six-minute comparison. No network; people use a separate scripted forager.
// node loadtest/bots.mjs [--bots ./src/.bots-before.mjs] [--seeds 1,7,42]
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import * as C from '../public/crumbwar/shared/config.js';
import { byteOf } from '../public/crumbwar/shared/move.js';
import { createWorld, addAnt, setInput, foodNear, step } from '../src/sim.mjs';

// Exact maximum count in a closed radius-r disk with an arbitrary center.
// An optimum disk can move until two points touch its boundary. Check both
// possible centers for every pair, and point centers for coincident points.
export function largestCluster(ants, radius = 40) {
  const points = ants.filter(a => a && a.alive);
  if (!points.length) return 0;
  let best = 1;
  const r2 = radius * radius, epsilon = 1e-7;
  const count = (x, y) => {
    let n = 0;
    for (const p of points) if ((p.x - x) ** 2 + (p.y - y) ** 2 <= r2 + epsilon) n++;
    best = Math.max(best, n);
  };
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    count(a.x, a.y);
    for (let j = i + 1; j < points.length; j++) {
      const b = points[j], dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
      if (!d2 || d2 > 4 * r2 + epsilon) continue;
      const h = Math.sqrt(Math.max(0, r2 - d2 / 4) / d2);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      count(mx - dy * h, my + dx * h);
      count(mx + dy * h, my - dx * h);
    }
  }
  return best;
}

// Independent simple foraging control. Same vision, 4 Hz cadence, input call
// and aim error. Nearest visible food; home when carrying; center when searching.
export function drivePerson(w, a) {
  if (!a.alive || (w.tick + a.id) % 5) return;
  let tx = C.WORLD / 2, ty = C.WORLD / 2;
  if (a.carry) [tx, ty] = C.NESTS[a.colony];
  else {
    let best = -1, bd = Infinity;
    foodNear(w, a.x, a.y, C.VIEW, id => {
      const d = (w.fx[id] - a.x) ** 2 + (w.fy[id] - a.y) ** 2;
      if (d < bd) { best = id; bd = d; }
    });
    if (best >= 0) { tx = w.fx[best]; ty = w.fy[best]; }
  }
  const aim = Math.atan2(ty - a.y, tx - a.x) + (w.rand() - 0.5) * 0.35;
  setInput(w, a, byteOf(aim), true, false);
}

export const median = values => {
  const sorted = [...values].sort((a, b) => a - b), mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
export function scoreCV(scores) {
  const mean = scores.reduce((sum, x) => sum + x, 0) / scores.length;
  return mean ? Math.sqrt(scores.reduce((sum, x) => sum + (x - mean) ** 2, 0) / scores.length) / mean : 0;
}

export function measure(bots, people, seed) {
  const w = createWorld(seed);
  // Match room joins: balance after each person joins.
  for (let i = 0; i < people; i++) { addAnt(w, bots.pickColony(w), false, 0, 0); bots.balance(w); }
  bots.balance(w);
  const occupancy = [];
  let bites = 0, humanBittenTicks = 0, humanKilled = 0, humanNestDeaths = 0;
  for (let t = 0; t < 6 * 60 * C.TICK_HZ; t++) {
    for (const a of w.ants) if (a) (a.bot ? bots.think : drivePerson)(w, a);
    const previousBiteAt = w.ants.map(a => a?.biteAt);
    step(w);
    for (const a of w.ants) if (a && a.biteAt > previousBiteAt[a.id]) bites++;
    for (const [type, killer, victim] of w.events) if (type === 1 && !w.ants[victim].bot) {
      if (killer === 255) humanNestDeaths++;
      else humanKilled++;
    }
    // Applied damage ticks, including lethal bites. Simultaneous bites count
    // once. Exclude enemy-nest guard damage (this forager stays near home/food).
    for (const a of w.ants) if (a && !a.bot && a.hurtAt === w.tick &&
      !C.NESTS.some(([x, y], c) => c !== a.colony && Math.hypot(a.x - x, a.y - y) < C.NEST_R)) humanBittenTicks++;
    // No startup exclusion. Seconds 1 through 360, all living ants.
    if (w.tick % C.TICK_HZ === 0) occupancy.push(largestCluster(w.ants));
  }
  const foodPoints = [...w.colonyScore];
  return {
    people, seed, seconds: occupancy.length, median: median(occupancy), max: Math.max(...occupancy),
    crowdedSeconds: occupancy.filter(n => n >= 6).length,
    crowdedPercent: occupancy.filter(n => n >= 6).length / occupancy.length * 100,
    foodPoints, bites, deaths: w.ants.reduce((sum, a) => sum + (a?.deaths ?? 0), 0),
    colonyDeaths: Array.from({ length: 4 }, (_, c) => w.ants.reduce((sum, a) => sum + (a?.colony === c ? a.deaths : 0), 0)),
    humanBittenTicks, humanKilled, humanNestDeaths, humanDeaths: w.ants.reduce((sum, a) => sum + (a && !a.bot ? a.deaths : 0), 0),
    scoreCV: scoreCV(foodPoints), occupancy,
  };
}

// Time only the full bot decision pass, including staggered no-op calls.
// Sim and human work are outside the interval. Warm the JIT for 200 ticks.
export function timeDecisions(bots, seed = 42) {
  const w = createWorld(seed);
  const person = addAnt(w, bots.pickColony(w), false, 0, 0);
  bots.balance(w);
  let ms = 0, ticks = 0;
  for (let t = 0; t < 6 * 60 * C.TICK_HZ; t++) {
    drivePerson(w, person);
    const start = performance.now();
    for (const a of w.ants) if (a?.bot) bots.think(w, a);
    const elapsed = performance.now() - start;
    if (t >= 200) { ms += elapsed; ticks++; }
    step(w);
  }
  return ms / ticks;
}

async function main() {
  const args = process.argv.slice(2);
  const value = flag => { const i = args.indexOf(flag); return i < 0 ? undefined : args[i + 1]; };
  const botsPath = value('--bots');
  const bots = await import(botsPath ? pathToFileURL(resolve(botsPath)).href : '../src/bots.mjs');
  const seeds = (value('--seeds') ?? '1,7,42').split(',').map(Number);
  if (seeds.some(seed => !Number.isSafeInteger(seed))) throw new Error('Seeds must be integers');
  const timings = Array.from({ length: 3 }, () => timeDecisions(bots));
  console.log(JSON.stringify({ people: 1, bots: 31, decisionMeanMsPerTick: timings, lowest: Math.min(...timings) }));
  if (args.includes('--timing-only')) return;
  console.log('people seed seconds cluster-median cluster-max >=6-percent food-points[Red,Blue,Green,Gold] bites deaths score-CV colony-deaths human-bitten-ticks human-killed human-nest-deaths');
  for (const people of [1, 12]) {
    const runs = seeds.map(seed => measure(bots, people, seed));
    for (const r of runs) console.log(`${people} ${r.seed} ${r.seconds} ${r.median} ${r.max} ${r.crowdedPercent.toFixed(2)} ${r.foodPoints.join('/')} ${r.bites} ${r.deaths} ${r.scoreCV.toFixed(3)} ${r.colonyDeaths.join('/')} ${r.humanBittenTicks} ${r.humanKilled} ${r.humanNestDeaths}`);
    const samples = runs.flatMap(r => r.occupancy);
    const meanFoodPoints = Array.from({ length: 4 }, (_, c) => runs.reduce((sum, r) => sum + r.foodPoints[c], 0) / runs.length);
    console.log(JSON.stringify({ people, seeds, seconds: samples.length, median: median(samples), max: Math.max(...samples), crowdedPercent: samples.filter(n => n >= 6).length / samples.length * 100, meanFoodPoints, meanBites: runs.reduce((sum, r) => sum + r.bites, 0) / runs.length, meanDeaths: runs.reduce((sum, r) => sum + r.deaths, 0) / runs.length, meanColonyDeaths: Array.from({ length: 4 }, (_, c) => runs.reduce((sum, r) => sum + r.colonyDeaths[c], 0) / runs.length), meanHumanBittenTicks: runs.reduce((sum, r) => sum + r.humanBittenTicks, 0) / runs.length, meanHumanKilled: runs.reduce((sum, r) => sum + r.humanKilled, 0) / runs.length, meanScoreCV: runs.reduce((sum, r) => sum + r.scoreCV, 0) / runs.length }));
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
