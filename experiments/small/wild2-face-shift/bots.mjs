import assert from 'node:assert/strict';
import { create, step, DT, LEVELS, MIN_POSE_TIME, PHOTO_TIME, starsFor } from './sim.js';

const mutate = process.argv.includes('--mutate');
const start = (seed, level = 0) => create(seed, level, { mutate });
const advance = (state, input, frames) => {
  for (let frame = 0; frame < frames; frame++) state = step(state, input);
  return state;
};

// Behavioral examples fixed independently of the bot policies and rule evaluator.
// This is also the mutation sentinel: accepting an opposite face must fail.
let wrong = advance(start(7), { x: -0.8, y: 0.8, active: true }, 240);
assert.equal(wrong.shots.length, 0, 'An opposite face must never trigger the shutter');
assert.equal(wrong.phase, 'play');
let idle = advance(start(7), {}, 1300);
assert.equal(idle.phase, 'lost', 'Doing nothing must lose');
assert.equal(idle.shots.length, 0);
let released = advance(start(7), { x: 0.55, y: -0.5, active: false }, 1300);
assert.equal(released.phase, 'lost', 'A correct released face must not capture');
assert.equal(released.shots.length, 0);
let early = advance(start(7), { x: 0.55, y: -0.5, active: true }, 179);
assert.equal(early.shots.length, 0, 'The shutter must wait three seconds');
early = step(early, { x: 0.55, y: -0.5, active: true });
assert.equal(early.shots.length, 1);
assert.equal(early.score, 100);
assert.ok(Math.abs(early.elapsed - 3) < 1e-8);
const photoElapsed = early.elapsed;
early = advance(early, {}, 38);
assert.equal(early.phase, 'photo');
assert.equal(early.elapsed, photoElapsed, 'Photo time does not consume the level clock');
early = step(early, {});
assert.equal(early.phase, 'play');
assert.equal(early.index, 1);
assert.equal(early.age, 0);

// Level 4 has a literal 0.10 boundary. One axis outside is enough to reject.
let boundary = advance(start(9, 3), { x: 0.65, y: -0.6, active: true }, 180);
assert.equal(boundary.shots.length, 1, 'The inclusive square boundary must match');
let outside = advance(start(9, 3), { x: 0.6501, y: -0.5, active: true }, 240);
assert.equal(outside.shots.length, 0, 'Outside one axis must reject');
let interrupted = advance(start(9, 3), { x: 0.55, y: -0.5, active: true }, 170);
interrupted = step(interrupted, { x: 0.55, y: -0.5, active: false });
interrupted = advance(interrupted, { x: 0.55, y: -0.5, active: true }, 65);
assert.equal(interrupted.shots.length, 0, 'Releasing resets the uninterrupted hold');
interrupted = step(interrupted, { x: 0.55, y: -0.5, active: true });
assert.equal(interrupted.shots.length, 1);
assert.equal(starsFor({level:0,phase:'lost',elapsed:5}),0);
assert.equal(starsFor({level:0,phase:'won',elapsed:13.9}),3);
assert.equal(starsFor({level:0,phase:'won',elapsed:14}),2);
assert.equal(starsFor({level:0,phase:'won',elapsed:18}),1);
const original = start(123);
const originalJSON = JSON.stringify(original);
const clamped = step(original, { x: 5, y: -5, active: true });
assert.equal(clamped.x, 1);
assert.equal(clamped.y, -1);
assert.equal(JSON.stringify(original), originalJSON, 'step must not mutate its input');
assert.notEqual(clamped, original);
let a = start(321, 2), b = start(321, 2);
for (let frame = 0; frame < 2400; frame++) {
  const input = { x: Math.sin(frame / 23), y: Math.cos(frame / 17), active: frame % 13 !== 0 };
  a = step(a, input); b = step(b, input);
  assert.deepEqual(a, b, 'Repeated seeded runs must be identical');
}
assert.notDeepEqual(create(1).targets, create(2).targets, 'Seeds must vary later poses');

// Independent policy PRNG (Park-Miller), unrelated to the simulation generator.
function policyRandom(seed) {
  let value = ((seed + 41) * 48271) % 2147483647;
  return () => { value = value * 16807 % 2147483647; return value / 2147483647; };
}
function clumsyPolicy(seed) {
  const random = policyRandom(seed);
  const gaussian = () => Math.sqrt(-2 * Math.log(Math.max(1e-12, random()))) * Math.cos(2 * Math.PI * random());
  let index = -1, biasX = 0, biasY = 0, poseTime = 0;
  return state => {
    if (state.index !== index) {
      index = state.index; poseTime = 0;
      biasX = gaussian() * 0.10; biasY = gaussian() * 0.10;
    }
    if (state.phase !== 'play') return {};
    poseTime += DT;
    const target = state.targets[state.index];
    return {
      x: target.x + biasX + 0.015 * Math.sin(poseTime * 7),
      y: target.y + biasY + 0.015 * Math.cos(poseTime * 9),
      active: poseTime >= 0.5,
    };
  };
}
function carefulPolicy() {
  let index = -1, poseTime = 0;
  return state => {
    if (state.index !== index) { index = state.index; poseTime = 0; }
    if (state.phase !== 'play') return {};
    poseTime += DT;
    return { ...state.targets[state.index], active: poseTime >= 0.25 };
  };
}
function run(seed, level, policyFactory) {
  let state = start(seed, level);
  const policy = policyFactory(seed);
  let wall = 0;
  while (state.phase !== 'won' && state.phase !== 'lost' && wall < 60) {
    state = step(state, policy(state)); wall += DT;
  }
  assert.ok(state.phase === 'won' || state.phase === 'lost', 'Each run must terminate');
  return { won: state.phase === 'won', elapsed: state.elapsed, wall, shots: state.shots.length };
}
const results = [];
for (let level = 0; level < LEVELS.length; level++) {
  const careful = [], clumsy = [];
  for (let seed = 1; seed <= 200; seed++) {
    const state = start(seed, level);
    assert.equal(state.targets.length, [3, 4, 5, 6][level]);
    for (const target of state.targets) assert.ok(Math.abs(target.x) <= 0.8 && Math.abs(target.y) <= 0.8);
    careful.push(run(seed, level, carefulPolicy));
    clumsy.push(run(seed, level, clumsyPolicy));
  }
  assert.equal(careful.filter(run => run.won).length, 200, 'Careful play must win every seed');
  for (const result of careful) {
    assert.equal(result.shots, [3, 4, 5, 6][level]);
    assert.ok(Math.abs(result.elapsed - [9, 12, 15, 18][level]) < 1e-7);
    assert.ok(Math.abs(result.wall - [10.95, 14.6, 18.25, 21.9][level]) < 1e-7);
  }
  const wins = clumsy.filter(run => run.won);
  const average = (runs, key) => runs.length ? +(runs.reduce((sum, run) => sum + run[key], 0) / runs.length).toFixed(3) : null;
  results.push({
    level: level + 1, seeds: 200, carefulWins: 200, clumsyWins: wins.length,
    clumsySuccessPercent: wins.length / 2,
    carefulPlaySeconds: average(careful, 'elapsed'), carefulWallSeconds: average(careful, 'wall'),
    clumsyMeanPlaySeconds: average(clumsy, 'elapsed'), clumsyWinWallSeconds: average(wins, 'wall'),
  });
}
assert.ok(results[0].clumsySuccessPercent >= 95, 'First level must accept at least 95% of the fixed clumsy policy');
for (let i = 1; i < results.length; i++) assert.ok(results[i].clumsyWins < results[i - 1].clumsyWins, 'Clumsy success must strictly decrease');
assert.equal(MIN_POSE_TIME, 3);
assert.equal(PHOTO_TIME, 0.65);
console.table(results);
console.log('PASS: 1,600 seeded bot runs; independent behavioral examples; deterministic pure transitions.');

// ---------------------------------------------------------------------------------------------------------------
// The booth (2026-11-24): a ladder of sitters in booth.js. The classic claims above stay as they were; they are the
// parity run for the unchanged four rounds. `--mutate-part` makes every grab move the head, whatever part it lands on.
const booth = await import('./booth.js');
const { createBooth, stepBooth, RUNGS, PARAMS, PART_PARAM, targetNow, portraitVisible, partAt, likeness, errorOf, tolOf, MEMORY_TIME, CUE_SPOT } = booth;
const mutatePart = process.argv.includes('--mutate-part');
const bstart = opts => createBooth({ ...opts, ...(mutatePart ? { mutate: 'part' } : {}) });
const PART_OF = { w: 'head', o: 'head', b: 'brow', m: 'mouth', l: 'eyes', n: 'nose', e: 'ears' };
const SIGN = { head: 1, brow: -1, mouth: -1, eyes: -1, nose: 1, ears: -1 };

// Independent examples: each part moves only its own number, in the stated direction.
{
  let s = bstart({ seed: 5, from: 7 });
  assert.deepEqual([...s.open].sort(), [...PARAMS].sort(), 'by the ears rung every part is open');
  const drag = (state, part, dy, dx = 0) => {
    state = stepBooth(state, { active: true, part, dx: 0, dy: 0 });
    state = stepBooth(state, { active: true, part, dx, dy });
    return stepBooth(state, { active: false });
  };
  const moves = { brow: ['b', 0.5], mouth: ['m', 0.5], eyes: ['l', 0.5], nose: ['n', -0.5], ears: ['e', 0.5] };
  for (const [part, [key, value]] of Object.entries(moves)) {
    const after = drag(s, part, -0.5);
    for (const k of PARAMS) assert.ok(Math.abs(after.faces[0][k] - (k === key ? value : 0)) < 1e-9, `${part} up moves ${key} only (got ${k}=${after.faces[0][k]})`);
  }
  const head = drag(s, 'head', 0.4, 0.6);
  assert.ok(Math.abs(head.faces[0].w - 0.6) < 1e-9 && Math.abs(head.faces[0].o - 0.4) < 1e-9, 'head: across stretches, down opens');
  // Relative: a second grab continues from where the face was left.
  const twice = drag(drag(s, 'head', 0, 0.3), 'head', 0, 0.3);
  assert.ok(Math.abs(twice.faces[0].w - 0.6) < 1e-9, 'a second drag adds to the first');
  // Locked parts are the head on the first rung.
  let first = createBooth({ seed: 5 });
  first = drag(first, 'brow', -0.5);
  assert.equal(first.faces[0].b, 0, 'a locked part does not move');
  assert.equal(first.faces[0].o, 0, 'an unopened number stays 0 on the first rung');
  assert.equal(partAt(0, -50, ['w', 'b']), 'brow');
  assert.equal(partAt(0, -50, ['w']), 'head');
  assert.equal(partAt(-32, -19, PARAMS), 'eyes');
  assert.equal(partAt(0, 10, PARAMS), 'nose');
  // The cue for each number sits on the part that moves it, with every part open and with only that number open.
  const partOf = k => k === 'w' || k === 'o' ? 'head' : Object.keys(PART_PARAM).find(p => PART_PARAM[p] === k);
  for (const [k, [x, y]] of Object.entries(CUE_SPOT)) {
    assert.equal(partAt(x, y, PARAMS), partOf(k), `the cue for ${k} is on the ${partOf(k)} with every part open`);
    assert.equal(partAt(x, y, [k]), partOf(k), `the cue for ${k} is on the ${partOf(k)} when it opens`);
  }
  assert.equal(partAt(0, 45, PARAMS), 'mouth');
  assert.equal(partAt(-90, -90, PARAMS), 'ears');
  assert.equal(partAt(-90, 10, PARAMS), 'head');
  // Mirror rung: the same drag moves the other way.
  let mirror = createBooth({ seed: 5, from: RUNGS.findIndex(r => r.id === 'mirror') });
  mirror = drag(mirror, 'head', 0, 0.5);
  assert.ok(Math.abs(mirror.faces[0].w + 0.5) < 1e-9, 'mirror flips the drag');
  // Doing nothing: the sitter leaves; the ladder goes on (a gentle fail).
  let idle = createBooth({ seed: 5 });
  for (let i = 0; i < 60 * 13; i++) idle = stepBooth(idle, {});
  assert.equal(idle.missed, 1, 'an ignored sitter leaves');
  assert.equal(idle.shots.length, 1);
  assert.equal(idle.shots[0].missed, true);
  assert.equal(idle.ri, 0);
  // A wrong face never takes a photo.
  let wrongFace = createBooth({ seed: 5 });
  const t0 = wrongFace.targets[0].p.w;
  wrongFace = stepBooth(wrongFace, { active: true, part: 'head', dx: 0, dy: 0 });
  for (let i = 0; i < 300; i++) wrongFace = stepBooth(wrongFace, { active: true, part: 'head', dx: -t0, dy: 0 });
  assert.equal(wrongFace.shots.filter(s => !s.missed).length, 0, 'the opposite stretch never takes a photo');
  // Determinism: the same day is the same daily for everyone; another day differs.
  const d1 = createBooth({ mode: 'daily', day: '2026-11-24' }), d2 = createBooth({ mode: 'daily', day: '2026-11-24' }), d3 = createBooth({ mode: 'daily', day: '2026-11-25' });
  assert.deepEqual(d1.targets, d2.targets, 'the daily is the same for everyone on a day');
  assert.notDeepEqual(d1.targets, d3.targets, 'the next day is a different daily');
  assert.equal(d1.targets.length, 5);
  assert.deepEqual(d1.targets.map(t => t.mod), [null, 'memory', 'moving', 'spoon', 'mirror']);
  let r1 = createBooth({ seed: 77 }), r2 = createBooth({ seed: 77 });
  for (let f = 0; f < 3000; f++) {
    const input = { active: f % 50 > 8, part: ['head', 'brow', 'mouth'][f % 3], dx: Math.sin(f / 19), dy: Math.cos(f / 23) };
    r1 = stepBooth(r1, input); r2 = stepBooth(r2, input);
  }
  assert.deepEqual(r1, r2, 'repeated booth runs are identical');
}

// Bots. Both know the target (an oracle, as in the classic bots), except as stated: the clumsy bot remembers a
// memory portrait only from while it shows, aims with a per-number bias, takes time per part, and fixes the
// worst number when the likeness meter does not reach the line (a person sees which part is off: the page
// marks it after a while).
function boothPolicy(seed, clumsy) {
  const random = policyRandom(seed * 7 + (clumsy ? 3 : 1));
  const gaussian = () => Math.sqrt(-2 * Math.log(Math.max(1e-12, random()))) * Math.cos(2 * Math.PI * random());
  let key = null, plan = [], step = null, remembered = null, waited = 0, laughT = 0;
  const sigma = clumsy ? 0.12 : 0;
  const react = clumsy ? 0.8 : 0.2, move = clumsy ? 0.5 : 0.15;
  function goal(state, face) {
    const t = state.targets[state.index];
    if (t.mod === 'memory') { if (portraitVisible(state) || !remembered) remembered = state.faces.map((_, i) => ({ ...targetNow(state, i) })); return remembered[face]; }
    return targetNow(state, face);
  }
  function planFor(state, keys) {
    const t = state.targets[state.index];
    const extra = clumsy && t.mod === 'spoon' ? 0.05 : clumsy && t.mod === 'memory' ? 0.05 : 0;
    const out = [];
    state.faces.forEach((face, fi) => {
      const g = goal(state, fi);
      const parts = new Map();
      for (const k of keys ?? PARAMS) if (Math.abs(face[k] - g[k]) > 1e-6 || keys) { const p = PART_OF[k]; if (!parts.has(p)) parts.set(p, []); parts.get(p).push(k); }
      for (const [part, ks] of parts) {
        const aim = {};
        for (const k of ks) aim[k] = g[k] + (sigma + extra) * gaussian() * (keys ? 0.7 : 1);
        out.push({ part, face: fi, aim, wait: react + (clumsy && t.mod === 'mirror' ? 0.5 : 0) });
      }
    });
    return out;
  }
  return state => {
    const t = state.targets[Math.min(state.index, state.targets.length - 1)];
    const k = `${state.ri}:${state.index}:${state.phase === 'play'}`;
    if (k !== key) { key = k; plan = []; step = null; remembered = null; waited = 0; if (state.phase === 'play' && t.mod !== 'laugh') plan = planFor(state); laughT = 0; }
    if (state.phase !== 'play') return { active: false };
    if (t.mod === 'laugh') { laughT += DT; const ph = laughT % 0.5; return { active: laughT > 0.4, part: 'head', dx: ph < 0.25 ? 1 : -1, dy: 0 }; }
    if (!step && plan.length) { step = { ...plan.shift(), t: 0, from: null }; }
    if (step) {
      step.t += DT;
      if (step.t < step.wait) return { active: false };
      const face = state.faces[step.face];
      if (!step.from) step.from = { ...face };
      const u = Math.min(1, (step.t - step.wait) / move);
      const mirror = t.mod === 'mirror' ? -1 : 1;
      let dx = 0, dy = 0;
      if (step.part === 'head') { dx = ('w' in step.aim ? step.aim.w - step.from.w : 0) * mirror; dy = ('o' in step.aim ? step.aim.o - step.from.o : 0) * mirror; }
      else { const key2 = PART_PARAM[step.part]; dy = (step.aim[key2] - step.from[key2]) * SIGN[step.part] * mirror; }
      if (step.t - step.wait > move + 0.08) { step = null; waited = 0; return { active: false }; }
      // A grab that lands on the face picks the part from where the finger is; the bot names it directly.
      return { active: true, part: step.part, face: step.face, dx: dx * u, dy: dy * u };
    }
    waited += DT;
    if (waited > (clumsy ? 2.5 : 0.3) && errorOf(state) > tolOf(state)) {
      // Fix the worst number.
      let worst = null, size = -1;
      state.faces.forEach((face, fi) => { const g = goal(state, fi); for (const kk of PARAMS) { const e = Math.abs(face[kk] - g[kk]); if (e > size) { size = e; worst = [fi, kk]; } } });
      const g = goal(state, worst[0]);
      const part = PART_OF[worst[1]];
      const ks = part === 'head' ? ['w', 'o'] : [worst[1]];
      const aim = {}; for (const kk of ks) aim[kk] = g[kk] + sigma * 0.8 * gaussian();
      plan = [{ part, face: worst[0], aim, wait: react }];
      waited = 0;
    }
    return { active: false };
  }
}
function climb(seed, clumsy, opts = {}) {
  let state = bstart({ seed, ...opts });
  const policy = boothPolicy(seed, clumsy);
  let wall = 0;
  const entered = [0];
  let lastRi = state.ri, firstPhoto = null;
  while (state.phase !== 'done' && wall < 900) {
    state = stepBooth(state, policy(state)); wall += DT;
    if (state.ri !== lastRi) { entered.push(wall); lastRi = state.ri; }
    if (firstPhoto === null && state.shots.some(s => !s.missed)) firstPhoto = wall;
  }
  assert.equal(state.phase, 'done', 'every climb ends');
  return { state, wall, entered, firstPhoto };
}
const SEEDS = 200;
const perRung = RUNGS.map(r => ({ rung: r.id, clumsyPhotos: 0, carefulPhotos: 0, sitters: 0 }));
const carefulAll = [], clumsyAll = [];
for (let seed = 1; seed <= SEEDS; seed++) {
  const careful = climb(seed, false), clumsy = climb(seed, true);
  carefulAll.push(careful); clumsyAll.push(clumsy);
  careful.state.results.forEach((r, i) => { perRung[i].carefulPhotos += r.photos; perRung[i].sitters += r.of; });
  clumsy.state.results.forEach((r, i) => { perRung[i].clumsyPhotos += r.photos; });
}
const table = perRung.map(r => ({ rung: r.rung, careful: +(100 * r.carefulPhotos / r.sitters).toFixed(1), clumsy: +(100 * r.clumsyPhotos / r.sitters).toFixed(1) }));
const median = xs => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const reach12 = clumsyAll.map(c => c.entered[11]);
const summary = {
  carefulMedianSeconds: +median(carefulAll.map(c => c.wall)).toFixed(1), clumsyMedianSeconds: +median(clumsyAll.map(c => c.wall)).toFixed(1),
  clumsyReach12thRungSecondsMedian: +median(reach12).toFixed(1), clumsyReach12thRungSecondsWorst: +Math.max(...reach12).toFixed(1),
  clumsyFirstPhotoSecondsWorst: +Math.max(...clumsyAll.map(c => c.firstPhoto)).toFixed(2),
  clumsyMeanScore: Math.round(clumsyAll.reduce((a, c) => a + c.state.score, 0) / SEEDS),
  carefulMeanScore: Math.round(carefulAll.reduce((a, c) => a + c.state.score, 0) / SEEDS),
  clumsyMeanBestStreak: +(clumsyAll.reduce((a, c) => a + c.state.bestStreak, 0) / SEEDS).toFixed(2),
};
console.table(table);
console.log(summary);
// Claims.
for (const r of table) assert.equal(r.careful, 100, `careful play photographs every sitter on ${r.rung}`);
assert.ok(summary.clumsyFirstPhotoSecondsWorst <= 10, 'the first photo comes within ten seconds');
assert.ok(summary.clumsyReach12thRungSecondsWorst <= 300, 'twelve situations, one at a time, within five minutes');
const clumsyRates = table.map(r => r.clumsy);
assert.ok(clumsyRates[0] >= 95, 'the first rung is nearly always cleared');
for (let i = 1; i < clumsyRates.length; i++) assert.ok(clumsyRates[i - 1] - clumsyRates[i] <= 15, `no cliff: ${table[i - 1].rung} to ${table[i].rung} drops at most 15 points`);
assert.ok(Math.min(...clumsyRates) >= 55, 'no rung falls below 55% for the clumsy bot');
assert.ok(summary.carefulMeanScore > summary.clumsyMeanScore, 'better play scores more');
// The daily: the careful bot clears it; the clumsy bot mostly does.
let dailyPhotos = 0;
for (let i = 0; i < 60; i++) {
  const day = `2026-12-${String(1 + (i % 28)).padStart(2, '0')}`;
  const careful = climb(i + 1, false, { mode: 'daily', day });
  assert.equal(careful.state.results[0].photos, 5, `careful play photographs all five daily sitters (${day})`);
  dailyPhotos += climb(i + 1, true, { mode: 'daily', day }).state.results[0].photos;
}
console.log({ dailyClumsyPhotoRate: +(100 * dailyPhotos / 300).toFixed(1) });
console.log(`PASS: booth, ${SEEDS * 2} seeded climbs of ${RUNGS.length} rungs; 120 dailies; part, mirror, gentle-fail and determinism examples.`);
