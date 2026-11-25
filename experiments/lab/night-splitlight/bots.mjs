import assert from 'node:assert/strict';
import { BANDS, CENTER, distanceAngle, expose, makePlate, optics, PLATES, RAIL, transmit, turn } from './sim.js';
import * as bench from './bench.js';
import { LEVELS } from './levels.js';
import { par, search } from './solver.js';
import { dailyLevel, valid } from './daily.js';

// Part 1 checks the frozen version 1 rules in sim.js, unchanged. Part 2 (after it) checks the bench the page now plays.
// `--mutate` breaks part 1 (one refractive index for all colours); `--mutate=<fault>` switches on a fault in bench.js.
const fault = (process.argv.find(a => a.startsWith('--mutate=')) || '').slice(9);
if (fault && !['mirror', 'grating', 'lens', 'filter', 'chord', 'moving'].includes(fault)) throw new Error('unknown fault ' + fault);
if (fault) bench.faults[fault] = true;

const mutate = process.argv.includes('--mutate');
const trace = state => optics(state, mutate ? BANDS.map(() => 1.52) : BANDS);
const near = (a, b, eps = 1e-8) => assert.ok(Math.abs(a - b) < eps, a + ' differs from ' + b);
const hold = (s, dial, seconds) => {
  turn(s, dial);
  const field = trace(s);
  for (let i = 0; i < Math.round(60 * seconds); i++) expose(s, field, 1 / 60);
};

// Reference cases: normal incidence, 30° air-to-glass, 50° glass-to-air.
const normal = transmit(1, 0, -1, 0, 1 / 1.5);
near(normal.dx, 1); near(normal.dy, 0);
const thirty = transmit(Math.sqrt(3) / 2, .5, -1, 0, 1 / 1.5);
near(thirty.dy, 1 / 3);
near(thirty.dx, Math.sqrt(8 / 9));
const incident = 50 * Math.PI / 180;
const internal = transmit(Math.cos(incident), Math.sin(incident), -1, 0, 1.5);
assert.ok(internal.reflected);
near(internal.dx, -Math.cos(incident)); near(internal.dy, Math.sin(incident));

const first = makePlate(1, 1);
const opening = trace(first).rays;
const separation = distanceAngle(opening[0].angle, opening[5].angle) * 180 / Math.PI;
console.log('Opening red to violet separation:', separation.toFixed(2), 'degrees');
assert.ok(separation > 45, 'the first prism must transmit red and internally reflect violet onto a different part of the rail');
assert.ok(opening[5].points.length > opening[0].points.length);
for (let i = 0; i < 3600; i++) expose(first, { rays: opening }, 1 / 60);
assert.equal(first.elapsed, 0);
assert.equal(first.targets[0].charge, 0);

let raysChecked = 0;
for (let level = 1; level <= PLATES.length; level++) {
  const s = makePlate(level, 941);
  for (let sample = 0; sample <= 1000; sample++) {
    turn(s, sample / 1000);
    const result = trace(s);
    for (const ray of result.rays) {
      assert.ok(ray.points.length >= 4 && Number.isFinite(ray.angle));
      const end = ray.points.at(-1);
      near(Math.hypot(end.x - CENTER.x, end.y - CENTER.y), RAIL);
      for (const hit of ray.points.slice(1, -1)) {
        // Distance sum equals edge length only when the point lies on that segment.
        assert.ok(result.vertices.some((a, i, v) => {
          const b = v[(i + 1) % v.length];
          return Math.hypot(hit.x - a.x, hit.y - a.y) + Math.hypot(hit.x - b.x, hit.y - b.y)
            - Math.hypot(a.x - b.x, a.y - b.y) < 1e-7;
        }), 'each glass contact lies on a real facet');
      }
      raysChecked++;
    }
  }
}

// Read the visible rays and receivers. Stop at the first sampled position
// that puts each requested wavelength inside the actual opening.
function visibleSweep(s) {
  let stops = 0;
  for (let sample = 0; sample <= 200 && !s.won; sample++) {
    turn(s, sample / 200);
    const field = trace(s);
    const fits = s.targets.some(t => !t.lit && field.rays.every(ray =>
      (t.band >= 0 && ray.band !== t.band) || distanceAngle(ray.angle, t.angle) < t.width));
    if (fits) stops++;
    for (let i = 0; i < (fits ? 28 : 1); i++) expose(s, field, 1 / 60);
  }
  return stops;
}
function movingSweep(s) {
  // One smooth two-second sweep, then rest the dial at its right stop.
  for (let i = 0; i <= 120; i++) {
    turn(s, i / 120);
    expose(s, trace(s), 1 / 60);
  }
  hold(s, 1, 1);
}

let aimed = 0, moving = 0, openings = 0;
for (let level = 1; level <= PLATES.length; level++) {
  const times = [], stops = [];
  let sweepWins = 0;
  for (const seed of [0x51e17 + level * 97, ...Array.from({ length: 48 }, (_, i) => (i + 1) * 7919)]) {
    const s = makePlate(level, seed);
    const same = makePlate(level, seed);
    assert.deepEqual(same, s);
    for (let i = 0; i < s.targets.length; i++) {
      for (let j = i + 1; j < s.targets.length; j++) {
        const a = s.targets[i], b = s.targets[j];
        assert.ok(distanceAngle(a.angle, b.angle) > a.width + b.width, 'receiver openings cannot overlap: ' + [level, seed, i, j]);
      }
    }
    stops.push(visibleSweep(s));
    visibleSweep(same);
    assert.deepEqual(same, s, 'same seed and gestures reproduce the exposure');
    assert.ok(s.won, 'visible sweep reaches every receiver: ' + [level, seed]);
    aimed++;
    times.push(s.elapsed);
    const fast = makePlate(level, seed);
    movingSweep(fast);
    if (fast.won) { sweepWins++; moving++; }
    if (level === 1) {
      for (const dial of [.45, .60, .79, 1]) {
        const beginner = makePlate(1, seed);
        hold(beginner, dial, 1);
        assert.ok(beginner.won && beginner.elapsed < 60, 'one coarse rightward move clears the opening');
        openings++;
      }
    }
  }
  console.log(PLATES[level - 1].name, '49/49; stops', Math.min(...stops), '-', Math.max(...stops),
    '; aimed seconds', Math.min(...times).toFixed(2), '-', Math.max(...times).toFixed(2), '; moving', sweepWins, '/49');
}

const interrupted = makePlate(1, 3);
hold(interrupted, .79, .2);
assert.ok(interrupted.targets[0].charge > 0 && !interrupted.won);
hold(interrupted, .08, 1);
assert.equal(interrupted.targets[0].charge, 0);
hold(interrupted, .79, .5);
assert.ok(interrupted.won);
const won = structuredClone(interrupted);
hold(interrupted, .1, .8);
assert.deepEqual(interrupted, won);

const wrong = makePlate(2, 3);
turn(wrong, .55);
const wrongField = trace(wrong);
for (const ray of wrongField.rays) ray.angle = wrong.targets[0].angle + (ray.band === 0 ? Math.PI : 0);
expose(wrong, wrongField, 1);
assert.equal(wrong.targets[0].charge, 0, 'other wavelengths cannot expose a red receiver');
console.log({ raysChecked, aimed, moving, openings });

// ===================== Part 2: the bench (rules version 2) =====================
const deg = r => r * 180 / Math.PI;
const one = (level, values = []) => bench.trace(level, values).rays;

// Parity: one prism on the bench traces exactly the rays sim.js traces, on all six original plates.
let parityRays = 0, parityWorst = 0;
for (let level = 1; level <= PLATES.length; level++) {
  const p = PLATES[level - 1];
  const turnRange = level === 1 ? [-57 + 128 * .66, -57 + 128 * .89] : [-57, 71];
  const L = { id: level, sources: [{ at: [13, CENTER.y + p.offset] }], parts: [{ kind: 'prism', cut: p.cut, at: [CENTER.x, CENTER.y], turn: turnRange }] };
  const s = makePlate(level, 941);
  for (let i = 0; i <= 1000; i++) {
    turn(s, i / 1000);
    const a = optics(s).rays, b = one(L, [i / 1000]);
    assert.equal(a.length, b.length);
    a.forEach((ray, k) => {
      assert.equal(ray.angle === null, b[k].angle === null, 'same stuck rays');
      assert.equal(ray.points.length, b[k].points.length, 'same contacts');
      ray.points.forEach((q, j) => { parityWorst = Math.max(parityWorst, Math.hypot(q.x - b[k].points[j].x, q.y - b[k].points[j].y)); });
      parityRays++;
    });
  }
}
assert.ok(parityWorst < 1e-9, 'bench and sim.js trace the same rays: ' + parityWorst);
console.log('Parity with sim.js:', parityRays, 'rays at 1,001 positions on 6 plates; worst point difference', parityWorst.toExponential(2));

// Old saves: plates 1-6 keep their glass, cut and lamp, so a saved plate number still opens the same bench.
LEVELS.slice(0, 6).forEach((level, i) => {
  assert.equal(level.id, i + 1);
  assert.deepEqual(level.parts[0].cut, PLATES[i].cut);
  assert.equal(level.sources[0].at[1], CENTER.y + PLATES[i].offset);
});
assert.equal(LEVELS.length, 18);
LEVELS.forEach((level, i) => assert.equal(level.id, i + 1));

// Closed-form cases for each new part.
// Mirror along 30°: a ray going +x leaves at 60° (angle of incidence equals angle of reflection).
const mirrorRay = one({ sources: [{ at: [13, 196] }], parts: [{ kind: 'mirror', at: [180, 196], len: 60, angle: 30 }] })[0];
near(deg(mirrorRay.angle), 60, 1e-6);
// Grating across the beam at normal incidence: order m leaves at asin(m λ / d), every colour, both signs.
const gratingRays = one({ sources: [{ at: [13, 196] }], parts: [{ kind: 'grating', at: [180, 196], len: 60, pitch: 1500, angle: 90 }] });
for (const ray of gratingRays) near(Math.sin(ray.angle), ray.order * ray.wave / 1500, 1e-9);
assert.equal(gratingRays.length, 18);
// Thin lens: two parallel beams 20 above and below the axis cross the axis one focal length behind the lens.
for (const ray of one({ sources: [{ at: [13, 176] }, { at: [13, 216] }], parts: [{ kind: 'lens', at: [100, 196], len: 80, f: 50, angle: 90 }] })) {
  const at = ray.points[1], next = ray.points[2];
  const t = (196 - at.y) / (next.y - at.y);
  near(at.x + t * (next.x - at.x), 150, 1e-9);
}
// Filter: only its colour reaches the rail.
const filtered = one({ sources: [{ at: [13, 196] }], parts: [{ kind: 'filter', band: 2, at: [100, 196], len: 40, angle: 90 }] });
assert.deepEqual(filtered.filter(r => r.angle !== null).map(r => r.band), [2]);
// Chord: feeding the receivers one at a time never wins; feeding them together for 0.42 s does.
function hold2(state, level, values, seconds) {
  values.forEach((v, c) => bench.setValue(state, c, v));
  const field = bench.trace(level, state.values);
  for (let i = 0; i < Math.round(seconds * 60); i++) bench.expose(state, field, 1 / 60);
}
{
  const level = LEVELS[1], s = bench.makeBench(level);
  const only = target => { for (let v = 0; v <= 1; v += .001) { const rays = one(level, [v]); if (bench.fed(s.targets[target], rays) && !bench.fed(s.targets[1 - target], rays)) return v; } };
  hold2(s, level, [only(0)], 2); hold2(s, level, [only(1)], 2); hold2(s, level, [only(0)], 2);
  assert.ok(!s.won, 'receivers fed one at a time do not expose the plate');
  hold2(s, level, level.answer, .3);
  assert.ok(!s.won && s.charge > 0, 'the chord charges');
  hold2(s, level, level.answer, .3);
  assert.ok(s.won, 'every receiver fed together for 0.42 s exposes the plate');
}
// Moving receiver: at the answer it is away at first, then passes and the plate is exposed within one period.
{
  const level = LEVELS.find(l => l.idea === 'moving'), s = bench.makeBench(level);
  hold2(s, level, level.answer, .5);
  assert.ok(!s.won, 'the moving receiver starts away from the light');
  const swing = s.targets.find(t => t.swing);
  hold2(s, level, level.answer, swing.period);
  assert.ok(s.won, 'the moving receiver passes the light within one period');
}

// Solver: every plate is cleared, in exactly par turns, by a bot that reads only rays and receivers.
const periodOf = s => Math.max(1, ...s.targets.map(t => t.swing ? t.period : 0));
const solved = [];
for (const level of LEVELS) {
  const s = bench.makeBench(level);
  const p = par(level, s.targets, s.start);
  const k = bench.controlsOf(level).length;
  assert.ok(p.values, 'solver finds plate ' + level.id);
  assert.equal(p.par, k, `plate ${level.id} needs every control it offers`);
  for (const c of p.moved) { bench.setValue(s, c, p.values[c]); s.turns++; }
  const field = bench.trace(level, s.values);
  for (let i = 0; i < periodOf(s) * 60 + 60 && !s.won; i++) bench.expose(s, field, 1 / 60);
  assert.ok(s.won, 'solver clears plate ' + level.id);
  assert.equal(s.turns, p.par);
  for (let i = 0; i < s.targets.length; i++) for (let j = i + 1; j < s.targets.length; j++) {
    const a = s.targets[i], b = s.targets[j];
    assert.ok(distanceAngle(a.angle, b.angle) > a.width + b.width + (a.swing || 0) + (b.swing || 0), 'receivers cannot overlap on plate ' + level.id);
  }
  assert.ok(!bench.makeBench(level).targets.every(t => bench.fed(t, one(level, level.start))), 'plate ' + level.id + ' does not start solved');
  solved.push({ plate: level.id, idea: level.idea, par: p.par, aim: p.values.map(v => +v.toFixed(3)) });
}

// Clumsy bot. Before: main's six plates under version 1 rules (receivers latch one at a time), aiming at each
// receiver's dial position with gaussian error. After: each plate, aiming every control at the solver's answer with
// the same error. Both hold 0.8 s per try (a full period for a moving receiver) and give up after 12 gestures.
const sigma = .035, TRIALS = 400;
let seed = 12345; const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
const before = [];
for (let level = 1; level <= PLATES.length; level++) {
  let wins = 0;
  for (let trial = 0; trial < TRIALS; trial++) {
    const st = makePlate(level, 0x51e17 + level * 97);
    let bits = st.seed >>> 0; const r = () => (bits = (Math.imul(bits, 1664525) + 1013904223) >>> 0) / 2 ** 32;
    const aims = PLATES[level - 1].exposures.map(([, d]) => d + (r() - .5) * .024);
    for (let i = 0, gestures = 0; i < aims.length && gestures < 12; ) {
      gestures++;
      turn(st, Math.max(0, Math.min(1, aims[i] + sigma * gauss())));
      const f = optics(st);
      for (let k = 0; k < 48; k++) expose(st, f, 1 / 60);
      if (st.targets[i].lit) i++;
    }
    if (st.won) wins++;
  }
  before.push(100 * wins / TRIALS);
}
seed = 12345;
const after = solved.map(({ plate, aim }) => {
  const level = LEVELS[plate - 1];
  let wins = 0;
  for (let trial = 0; trial < TRIALS; trial++) {
    const s = bench.makeBench(level);
    const hold = Math.max(.8, periodOf(s));
    for (let gestures = 0; gestures + aim.length <= 12 && !s.won; gestures += aim.length) {
      aim.forEach((v, c) => bench.setValue(s, c, v + sigma * gauss()));
      const field = bench.trace(level, s.values);
      for (let i = 0; i < hold * 60 && !s.won; i++) bench.expose(s, field, 1 / 60);
    }
    if (s.won) wins++;
  }
  return 100 * wins / TRIALS;
});
console.log('Clumsy bot (aim error ' + sigma + ' of travel, 12 gestures), clear rate per plate');
console.log('  before (main, 6 plates):', before.map(n => n.toFixed(1) + '%').join(' '));
console.log('  after (18 plates):', after.map(n => n.toFixed(1) + '%').join(' '));
for (let i = 1; i < after.length; i++) assert.ok(after[i - 1] - after[i] <= 15, `no cliff: plate ${i} to ${i + 1} drops ${(after[i - 1] - after[i]).toFixed(1)} points`);
assert.ok(after.every(n => n >= 20), 'every plate stays winnable for a clumsy player');
console.table(solved.map((s, i) => ({ ...s, aim: s.aim.join(', '), clumsy: after[i].toFixed(1) + '%' })));

// Daily bench: a year of days from today's launch; each is valid, the same twice, par 2, and the solver clears it at par.
const days = Number(process.env.DAYS || 365);
let dailyAttempts = 0; const families = {};
for (let d = 0; d < days; d++) {
  const day = new Date(Date.UTC(2026, 10, 24 + d)).toISOString().slice(0, 10);
  const level = dailyLevel(day);
  assert.deepEqual(dailyLevel(day), level, 'the same day gives the same bench');
  assert.ok(valid(level));
  const s = bench.makeBench(level);
  const p = par(level, s.targets, s.start, level.answer);
  assert.equal(p.par, 2, 'daily par is 2 on ' + day);
  assert.equal(search(level, s.targets, s.start, [0]), null); assert.equal(search(level, s.targets, s.start, [1]), null);
  const found = search(level, s.targets, s.start, [0, 1]);
  assert.ok(found, 'solver finds the daily bench on ' + day);
  found.forEach((v, c) => { bench.setValue(s, c, v); s.turns++; });
  const field = bench.trace(level, s.values);
  for (let i = 0; i < 120 && !s.won; i++) bench.expose(s, field, 1 / 60);
  assert.ok(s.won && s.turns === 2, 'solver clears the daily bench at par on ' + day);
  dailyAttempts += level.attempts; families[level.family] = (families[level.family] || 0) + 1;
}
console.log('Daily benches:', days, 'days valid and cleared at par 2; families', families, '; mean attempts', (dailyAttempts / days).toFixed(2));
console.log('Part 2 passed', fault ? '(fault ' + fault + ' did not break it)' : '');
