// Proves the spark layer and measures it: node bots.mjs [runs]   (exits non-zero on any failed check)
//   node bots.mjs --mutate[=flies-anywhere]   runs the same checks with one rule deliberately broken (see MUTATION below); they must fail.
// BOT_WORKERS=1 runs rate cases directly; the default uses at most four worker threads.
// Bots use sim.js `view`, `stars`, fireflies and banks. The cue bot gets exact star-occlusion flags: its perception is idealized.
// No bot reads Lantern's rock list directly. These measure strategies, not human cue recognition.
import { start, tick, reach, view, stars, murmur, rating, centre, half, channel, boat, mutate, config, NIGHTS, TIN, REFILL, TIN_MAX, GLOW } from './spark-sim.js';
import { create, step, speed, nightPace } from '../sim.js?v=15';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

// MUTATION: the spark ring lights only what lies behind the point where it was struck (a sign error in the ring test),
// so a spark shows nothing ahead. The spark bots then do no better than the bots that never spark, and checks 3 to 6 fail.
const MUTATE = workerData?.mutation ?? ((process.argv.find(a => a.startsWith('--mutate')) || '').split('=')[1] || (process.argv.includes('--mutate') ? 'ring-behind' : ''));
if (MUTATE) mutate(MUTATE);
const RUNS = Number(process.argv.find(a => /^\d+$/.test(a)) ?? 150);
const t0 = Date.now();
let failures = 0;
const check = (ok, text) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${text}`); if (!ok) failures++; return ok; };

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------------------------------------------------------------- the bots
// A bot is made per run: make(seed) returns (e) => { target, spark }. It is asked every tick and plans every EVERY ticks.
const EVERY = 3;
// Memory of rocks once seen lit: the span of x seen while it glowed, kept after it goes dark.
function remember(mem, v, s) {
  for (const r of v.rocks) {
    const m = mem.get(r.k) ?? { lo: r.x, hi: r.x, y: r.y, rad: r.rad, len: r.len, kind: r.kind, at: s.t };
    m.lo = Math.min(m.lo, r.x); m.hi = Math.max(m.hi, r.x); m.y = r.y; m.at = s.t; m.on = r.on; mem.set(r.k, m);
  }
  for (const [k, m] of mem) if (m.y < s.y - 0.3) mem.delete(k);
}
// Pick the target x to hold for the next HORIZON seconds: roll the boat forward at Lantern's own lateral limit and keep the
// target whose path stays furthest from every obstacle and bank; then prefer fireflies and lit embers, the middle, and little travel.
const HORIZON = 0.6;
function plan(e, { obstacles = [], flies = [], embers = [] }) {
  const s = e.s, v = speed(s), lat = 0.95 * nightPace(s.stage), b = boat(s), c0 = centre(s, s.y + 0.2), h0 = half(s, s.y + 0.2) - b;
  const near = obstacles.filter(o => o.y > s.y - 0.2 && o.y < s.y + v * HORIZON + 0.2);
  const path = [];
  for (let t = 0.05; t <= HORIZON + 1e-9; t += 0.05) {
    const y = s.y + v * t;
    path.push({ y, bank: (half(s, y) - b), c: centre(s, y), weight: 1.5 - 0.5 * t / HORIZON });
  }
  let best = s.x, top = -Infinity;
  for (let i = 0; i <= 30; i++) {
    const x = c0 - h0 + 0.01 + (2 * h0 - 0.02) * i / 30;
    let clear = 0.08, bx = s.x;
    for (const at of path) {
      bx += Math.max(-lat * 0.05, Math.min(lat * 0.05, x - bx));
      clear = Math.min(clear, (at.bank - Math.abs(bx - at.c)) * 2 + 0.02);
      for (const o of near) { const dy = Math.abs(o.y - at.y); if (dy > 0.15) continue; clear = Math.min(clear, (Math.hypot(Math.max(0, o.lo - bx, bx - o.hi), dy) - o.rad - b) * at.weight); }
    }
    let score = clear * 10 - Math.abs(x - s.x) * 0.3 - Math.abs(x - c0) * 0.2;
    for (const f of flies) { const dy = f.y - s.y; if (dy > 0.05 && dy < 0.9) score += Math.max(0, 0.08 - Math.abs(f.x - x)) * 2 / (0.3 + dy); }
    for (const p of embers) { const dy = p.y - s.y; if (p.kind === 'ember' && dy > 0 && dy < 1) score += Math.max(0, 0.08 - Math.abs(p.x - x)) * 2 / (0.3 + dy); }
    if (score > top) { top = score; best = x; }
  }
  return best;
}
const fromMemory = (mem, s, age = 99) => [...mem.values()].filter(m => s.t - m.at < age).map(m => { const u = Math.min(0.04, 0.01 * (s.t - m.at)); return { lo: m.lo - m.len - u, hi: m.hi + m.len + u, y: m.y, rad: m.rad + (m.kind === 'pool' ? 0.1 : 0) }; });
// A hole in the starry water ahead: a cell whose star is missing. The player sees these as gaps in an even scatter of stars.
const holes = e => stars(e, e.s.y - 0.05, e.s.y + 0.9).filter(p => !p.on).map(p => ({ lo: p.x, hi: p.x, y: p.y, rad: 0.02 }));

// A clumsy player: sparks on a loose rhythm, forgets a rock a while after its glow, plans only every few ticks,
// acts on what it saw a moment ago, and wobbles. It ignores stars and fireflies.
function clumsyBot(seed, { react = 0.2, every = 6, wobble = 0.015, gap = [1.2, 2.2], forget = 3 } = {}) {
  const r = rng(seed * 17 + 5), mem = new Map(), queue = []; let target = 0.5, n = 0, last = -99, wait = gap[0];
  return e => {
    const s = e.s, spark = s.t - last >= wait && e.tin > 0; if (spark) { last = s.t; wait = gap[0] + (gap[1] - gap[0]) * r(); }
    if (n++ % every === 0) { const v = view(e); remember(mem, v, s); queue.push([s.t + react, plan(e, { obstacles: fromMemory(mem, s, GLOW + forget), embers: v.embers }) + (r() * 2 - 1) * wobble]); }
    while (queue.length && queue[0][0] <= s.t) target = queue.shift()[1];
    return { target, spark };
  };
}
const BOTS = {
  // Steers at random inside the banks (it sees the banks in starlight) and never sparks.
  blind: seed => { const r = rng(seed * 31 + 1); let target = 0.5, next = 0; return e => { const s = e.s; if (s.t >= next) { next = s.t + 0.4 + 0.8 * r(); target = centre(s, s.y + 0.3) + (r() * 2 - 1) * (half(s, s.y + 0.3) - 0.05); } return { target, spark: false }; }; },
  // Rides the middle of the river and never sparks.
  drift: () => e => ({ target: centre(e.s, e.s.y + 0.15), spark: false }),
  // Never sparks: reads rocks only from the missing stars and goes where the fireflies hover.
  cue: () => { let target = 0.5, n = 0; return e => { if (n++ % EVERY === 0) { const v = view(e); target = plan(e, { obstacles: holes(e), flies: v.flies, embers: v.embers }); } return { target, spark: false }; }; },
  // Sparks every `period` seconds while the tin lasts, and steers by what the sparks showed and it remembers. No stars, no fireflies.
  rhythm: period => () => { const mem = new Map(); let target = 0.5, n = 0, last = -99; return e => {
    const s = e.s, spark = s.t - last >= period && e.tin > 0; if (spark) last = s.t;
    if (n++ % EVERY === 0) { const v = view(e); remember(mem, v, s); target = plan(e, { obstacles: fromMemory(mem, s), embers: v.embers }); }
    return { target, spark };
  }; },
  // A clumsy player: sparks on a loose rhythm, forgets a rock 1.5 s after its glow, acts on what it saw 0.35 s ago, wobbles.
  clumsy: seed => clumsyBot(seed),
  // A careful player: sparks when its picture of the water ahead is old, saves sparks when the tin runs low, and uses
  // memory, missing stars, fireflies and lit embers together.
  careful: () => { const mem = new Map(); let target = 0.5, n = 0, last = -99; return e => {
    const s = e.s, wait = e.tin > 4 ? 1.3 : e.tin > 1 ? 2.2 : 3.5, spark = s.t - last >= wait && e.tin > 0; if (spark) last = s.t;
    if (n++ % EVERY === 0) { const v = view(e); remember(mem, v, s); target = plan(e, { obstacles: [...fromMemory(mem, s), ...holes(e)], flies: v.flies, embers: v.embers }); }
    return { target, spark };
  }; },
};

function play(seed, n, bot, trace = null) {
  const e = start(seed, n), act = bot(seed);
  let guard = 0; e.emptySecs = 0;
  while (!e.s.over && guard++ < 60 * 600) { const { target, spark } = act(e); tick(e, target, spark); if (e.tin === 0) e.emptySecs += 1 / 60; if (trace && (guard % 30 === 0 || e.events.length)) trace.push(`${e.s.t.toFixed(3)}:${e.s.x.toFixed(6)}:${e.tin}:${e.events.join(',')}`); }
  return e;
}
function rate(n, bot, runs = RUNS, from = 1) {
  let won = 0, dist = 0, used = 0, refills = 0, secs = 0, stars = 0, endTin = 0, emptySecs = 0, emptyRuns = 0, dawnMin = Infinity, dawnMax = 0;
  for (let seed = from; seed < from + runs; seed++) { const e = play(seed, n, bot); if (e.s.over === 'dawn') { won++; dawnMin = Math.min(dawnMin, e.s.t); dawnMax = Math.max(dawnMax, e.s.t); } dist += reach(e); used += e.used; refills += e.refills; secs += e.s.t; stars += rating(e); endTin += e.tin; emptySecs += e.emptySecs; if (e.emptySecs > 0) emptyRuns++; }
  return { rate: won / runs, dist: dist / runs, used: used / runs, refills: refills / runs, secs: secs / runs, stars: stars / runs, endTin: endTin / runs, emptySecs: emptySecs / runs, emptyRate: emptyRuns / runs, dawnMin, dawnMax };
}
// Keep each rate case whole: its seed loop and floating-point accumulation order are unchanged.
const rateCase = ([night, bot, period], runs, from) => rate(night, bot === 'rhythm' ? BOTS.rhythm(period) : BOTS[bot], runs, from);
export async function rateCases(cases, runs = RUNS, from = 1, workers = Number(process.env.BOT_WORKERS) || 4, onComplete) {
  const count = Math.min(cases.length, Math.max(1, Math.min(4, Math.floor(workers))));
  if (count <= 1) return cases.map(task => { const value = rateCase(task, runs, from); onComplete?.(task); return value; });
  const threads = [];
  try {
    const batches = await Promise.all(Array.from({ length: count }, (_, lane) => {
      const jobs = cases.map((task, index) => ({ task, index })).filter(job => job.index % count === lane);
      const worker = new Worker(new URL(import.meta.url), { workerData: { jobs, runs, from, mutation: MUTATE } });
      threads.push(worker);
      return new Promise((resolve, reject) => {
        const values = [];
        worker.on('message', result => {
          values.push(result); onComplete?.(cases[result.index]);
          if (values.length === jobs.length) resolve(values);
        });
        worker.once('error', reject);
        worker.once('exit', code => { if (values.length !== jobs.length) reject(new Error(`rate worker exited before returning results (${code})`)); });
      });
    }));
    const results = [];
    for (const { index, value } of batches.flat()) results[index] = value;
    return results;
  } finally {
    await Promise.all(threads.map(worker => worker.terminate()));
  }
}

const fmt = r => `dawn ${(100 * r.rate).toFixed(0)}%  mean distance ${(100 * r.dist).toFixed(0)}%  sparks/run ${r.used.toFixed(1)}  refilled/run ${r.refills.toFixed(1)}  run ${r.secs.toFixed(0)} s  stars/run ${r.stars.toFixed(2)}  tin left ${r.endTin.toFixed(2)}  empty ${(100 * r.emptyRate).toFixed(0)}%/${r.emptySecs.toFixed(2)} s`;
// A margin beyond seed noise: two binomial standard errors of the difference.
const beats = (a, b, runs = RUNS) => a.rate - b.rate > 2 * Math.sqrt((a.rate * (1 - a.rate) + b.rate * (1 - b.rate)) / runs) && a.rate > b.rate;

if (!isMainThread) {
  for (const { task, index } of workerData.jobs) {
    const value = rateCase(task, workerData.runs, workerData.from);
    console.log(`     sample ${JSON.stringify({ night: task[0], bot: task[1], period: task[2], dawns: Math.round(value.rate * workerData.runs), seeds: workerData.runs })}`);
    parentPort.postMessage({ index, value });
  }
} else if (import.meta.main) {
console.log(`Lantern: Spark bots, ${RUNS} seeds a row${MUTATE ? `, MUTATED (${MUTATE})` : ''}`);

// 1. Determinism: the same seed and inputs give the same run, tick for tick.
{
  let same = true;
  for (let seed = 1; seed <= 12; seed++) for (const n of [1, 4, 6]) {
    const a = [], b = []; const ea = play(seed, n, BOTS.careful, a), eb = play(seed, n, BOTS.careful, b);
    if (a.join('|') !== b.join('|') || ea.s.over !== eb.s.over || ea.tin !== eb.tin) same = false;
  }
  check(same, '1. determinism: 36 careful runs replayed twice give identical traces');
}
// 2. The layer leaves Lantern's rules alone: with no sparks, Echo's river and boat match Lantern's own step (light held at 1).
{
  let same = true;
  for (let seed = 1; seed <= 20; seed++) for (const n of [1, 4, 6]) {
    const e = start(seed, n), cf = config(n), s = create(seed, cf.stage, false, [], { hearts: cf.hearts, calm: cf.calm }), r = rng(seed);
    s.calm *= cf.flow;
    for (let i = 0; i < 60 * 40 && !e.s.over; i++) { const x = centre(s, s.y + 0.1) + (r() - 0.5) * 0.2; tick(e, x, false); s.light = 1; step(s, x); }
    if (e.s.x !== s.x || e.s.y !== s.y || (e.s.over !== s.over && !(e.s.over === "dawn" && !s.over)) || e.s.rocks.length !== s.rocks.length) same = false;
  }
  check(same, '2. river rules: 60 no-spark runs match lantern/sim.js at the configured flow step for step');
}
// Tin bookkeeping, every run below: never negative, never more sparks used than TIN + refills.
// 3 to 6. Night 1: the cues carry information, and sparks carry more.
const cases = [[1, 'blind'], [1, 'drift'], [1, 'cue'], [1, 'rhythm', 3], [1, 'rhythm', 6], [1, 'rhythm', 12]];
for (let n = 1; n <= NIGHTS; n++) cases.push([n, 'careful'], [n, 'clumsy']);
const results = await rateCases(cases, RUNS, 1, undefined, ([night, bot, period]) => console.log(`     finished night ${night} ${bot}${period ? ` every ${period} s` : ''}`));
const [blind, drift, cue, r3, r6, r12] = results;
console.log(`     night 1 blind random   ${fmt(blind)}`);
console.log(`     night 1 drift (middle) ${fmt(drift)}`);
console.log(`     night 1 cue (no spark) ${fmt(cue)}`);
console.log(`     night 1 spark every 3 s  ${fmt(r3)}`);
console.log(`     night 1 spark every 6 s  ${fmt(r6)}`);
console.log(`     night 1 spark every 12 s ${fmt(r12)}`);
check(r3.rate > 0.95, `3. a bot that sparks every 3 s (and steers only by what sparks showed) reaches dawn on night 1 in ${(100 * r3.rate).toFixed(0)}% of runs (needs more than 95%)`);
check(beats(r3, r6) && beats(r6, r12), `4. fewer sparks, fewer dawns: every 3 s ${(100 * r3.rate).toFixed(0)}% > every 6 s ${(100 * r6.rate).toFixed(0)}% > every 12 s ${(100 * r12.rate).toFixed(0)}%`);
check(beats(cue, blind) && beats(cue, drift), `5. the star and firefly cues carry information: no-spark cue bot ${(100 * cue.rate).toFixed(0)}% > blind random ${(100 * blind.rate).toFixed(0)}% and middle-rider ${(100 * drift.rate).toFixed(0)}%`);
check(cue.rate < 0.4 && beats(r3, cue), `6. sparks carry more than the cues alone: spark every 3 s ${(100 * r3.rate).toFixed(0)}% > cue bot ${(100 * cue.rate).toFixed(0)}% (cue needs under 40%)`);
// 7 and 8. Every night: the careful bot finishes, the clumsy bot's success falls.
const careful = [], clumsy = [];
for (let n = 1; n <= NIGHTS; n++) {
  careful.push(results[6 + (n - 1) * 2]); clumsy.push(results[7 + (n - 1) * 2]);
  console.log(`     night ${n} careful ${fmt(careful[n - 1])}`);
  console.log(`     night ${n} clumsy  ${fmt(clumsy[n - 1])}`);
}
check(clumsy[0].rate >= 0.5, `7a. the clumsy bot finishes night 1 in ${(100 * clumsy[0].rate).toFixed(0)}% of runs (needs 50%)`);
check(careful.every(r => r.rate >= 0.7), `7b. the careful bot finishes every night: ${careful.map(r => (100 * r.rate).toFixed(0) + '%').join(' ')} (needs 70% each)`);
const falls = clumsy.every((r, i) => i === 0 || (r.rate <= clumsy[i - 1].rate + 0.04 && clumsy[i - 1].rate - r.rate <= 0.3)) && clumsy[0].rate - clumsy[NIGHTS - 1].rate >= 0.3;
check(falls, `8. the clumsy bot's success falls night by night: ${clumsy.map(r => (100 * r.rate).toFixed(0) + '%').join(' ')} (no drop above 30 points)`);
// 9. Fireflies hover over safe water: a boat sitting on a firefly as it comes level would touch no rock.
{
  let flies = 0, bad = 0;
  for (let seed = 1; seed <= 60; seed++) for (const n of [1, 4, 6]) {
    const e = start(seed, n), done = new Set();
    while (!e.s.over && e.s.y < 76) {
      e.s.safe = 1e9; tick(e, centre(e.s, e.s.y), false);
      for (const f of e.flies) if (!done.has(f) && f.y <= e.s.y) { done.add(f); flies++; if (e.s.rocks.some(k => k.on && Math.hypot(Math.max(0, Math.abs(k.x - f.x) - k.len), k.y - f.y) < k.rad + boat(e.s))) bad++; }
    }
  }
  check(flies > 1000 && bad / flies <= 0.01, `9. fireflies over safe water: ${bad} of ${flies} would put the boat on a rock (allowed 1%)`);
}
// 10. The tin: starts at TIN, an ember adds REFILL, it never goes below 0, and an empty tin strikes nothing.
{
  let ok = true;
  for (let seed = 1; seed <= 40; seed++) {
    const e = start(seed, 1); if (e.tin !== TIN) ok = false;
    while (!e.s.over) { const before = e.tin; tick(e, centre(e.s, e.s.y), true); if (e.tin < 0) ok = false; if (e.events.includes('ember') && !e.events.includes('wisp') && e.tin !== Math.min(TIN_MAX, before - (e.events.includes('spark') ? 1 : 0) + REFILL)) ok = false; if (before === 0 && e.events.includes('spark')) ok = false; }
    if (e.used > TIN + e.refills) ok = false;
  }
  check(ok, `10. the tin: starts at ${TIN}, an ember adds ${REFILL}, never below 0, an empty tin strikes nothing`);
}
// 11. The sound of water: louder as a rock nears, panned to the side of the rock whose edge is nearest.
{
  const e = start(3, 1); let samples = 0, wrong = 0;
  for (let i = 0; i < 60 * 40 && !e.s.over; i++) {
    e.s.safe = 1e9; tick(e, centre(e.s, e.s.y), false); const m = murmur(e), s = e.s;
    const edge = k => Math.hypot(Math.max(0, Math.max(0, Math.abs(k.x - s.x) - k.len) - k.rad), Math.max(0, k.y - s.y));
    const k = s.rocks.filter(k => k.on && k.y - s.y > -0.08 && k.y - s.y < 0.75).sort((a, b) => edge(a) - edge(b))[0];
    if (k && edge(k) < 0.1) { samples++; if (m.level < 0.5 || (Math.abs(k.x - s.x) > 0.03 && Math.sign(m.pan) !== Math.sign(k.x - s.x))) wrong++; }
  }
  check(samples > 20 && wrong / samples < 0.05, `11. murmur: within 0.1 of a rock the water is loud and panned to its side in ${samples - wrong} of ${samples} ticks`);
}
// Acceptance for duration and scarcity: measure the existing runs, including dry time, rather than assume a smaller tin binds.
check(r3.dawnMin >= 75 && r3.dawnMax <= 90, `12. night 1 dawn takes ${r3.dawnMin.toFixed(2)}–${r3.dawnMax.toFixed(2)} s (needs 75–90 s)`);
check(r3.refills < r3.used && r3.endTin <= 6 && clumsy[0].emptySecs > 5,
  `13. limited fuel: steady uses ${r3.used.toFixed(2)}, refills ${r3.refills.toFixed(2)}, ends with ${r3.endTin.toFixed(2)}; clumsy spends ${clumsy[0].emptySecs.toFixed(2)} s empty (needs net consumption, at most 6 left, and over 5 s empty)`);
console.log(`${failures ? failures + ' check(s) FAILED' : 'all checks passed'} in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
process.exit(failures ? 1 : 0);
}
