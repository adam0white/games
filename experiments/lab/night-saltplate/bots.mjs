import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// --mutate breaks the salt's drift to the still lines; --mutate=handle makes the bow and the finger do
// nothing; --mutate=stiff takes the stiff plate's bent peak away. Each must fail a claim below.
const MUTATIONS = {
  drift: [['const travel = Math.min(0.0095, distance * 0.38);', 'const travel = 0;']],
  handle: [
    ["if (spec.handle === 'bow' || (spec.free && handle)) e = mode.f(handle[0], handle[1]);", 'e = 1;'],
    ["else if (spec.handle === 'damp' && handle) e = Math.exp(-14 * mode.f(handle[0], handle[1]) ** 2);", ''],
  ],
  stiff: [['if (spec.stiff && mode.id === spec.mode && !caught) offset = Math.max(offset, 0.22);', '']],
};
const mutateArg = process.argv.find(arg => arg.startsWith('--mutate'));
const mutation = mutateArg ? (mutateArg.split('=')[1] || 'drift') : null;
async function loadSimulation() {
  if (!mutation) return import('./sim.js');
  let source = await readFile(new URL('./sim.js', import.meta.url), 'utf8');
  assert(MUTATIONS[mutation], `unknown mutation ${mutation}`);
  for (const [normal, broken] of MUTATIONS[mutation]) {
    assert(source.includes(normal), 'mutation must replace the actual code: ' + normal);
    source = source.replaceAll(normal, broken);
  }
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}

const sim = await loadSimulation();
const { LEVELS: ALL, createPlate, field, tick } = sim;
// The first six plates keep their first checks unchanged; the twelve new plates have their own below.
const LEVELS = ALL.filter(spec => spec.kind === 'classic');
const GROUP_SIZE = 12;
const seeds = Array.from({ length: GROUP_SIZE }, (_, index) => 313 + 41 * index);
let checks = 0;

function run(level, seed, drive, seconds) {
  const state = createPlate(level, seed);
  for (let frame = 0; frame < seconds * 60 && !state.won; frame++) {
    tick(state, drive(frame));
  }
  return state;
}

function check(condition, message) {
  assert(condition, message);
  checks++;
}

// Diagonal has the independent analytic node x = y.
const diagonal = LEVELS.findIndex(config => config.name === 'Diagonal') + 1;
const diagonalTarget = LEVELS[diagonal - 1].target;
const start = createPlate(diagonal, seeds[0]);
const tuned = run(diagonal, seeds[0], () => diagonalTarget, 3);
const openingNotch = run(1, seeds[0], () => LEVELS[0].target, 3);
const meanDiagonalDistance = state => state.grains.reduce(
  (sum, grain) => sum + Math.abs(grain.x - grain.y) / Math.SQRT2, 0,
) / state.grains.length;
const startDistance = meanDiagonalDistance(start);
const endDistance = meanDiagonalDistance(tuned);
check(startDistance > 0.18, 'seeded sand starts dispersed');
check(endDistance < 0.015, `sand should migrate to x = y, mean distance ${endDistance.toFixed(4)}`);
check(openingNotch.won && openingNotch.t < 2.5, 'engraved notch wins the opening in under 2.5 seconds');

const idle = run(diagonal, seeds[0], () => null, 3);
assert.deepEqual(idle.grains, start.grains, 'idle sand holds position');
checks++;
check(!idle.won && idle.progress === 0 && idle.t === 3, 'idle cannot finish a plate');

const interrupted = createPlate(1, seeds[0]);
for (let frame = 0; interrupted.progress === 0 && frame < 120; frame++) {
  tick(interrupted, LEVELS[0].target);
}
check(interrupted.progress > 0 && !interrupted.won, 'hold starts before a win');
tick(interrupted, null);
check(interrupted.progress === 0, 'idle interrupts the hold');

const wrong = run(diagonal, seeds[0], () => 0, 3);
const meanVerticalDistance = wrong.grains.reduce((sum, grain) => sum + Math.abs(grain.x - 0.5), 0) / wrong.grains.length;
check(meanVerticalDistance < 0.005 && !wrong.won && wrong.match < 0.25,
  'wrong drive physically prints the wrong mode and scores poorly');

const poorSandAtCorrectDrive = createPlate(1, seeds[0]);
tick(poorSandAtCorrectDrive, LEVELS[0].target);
check(poorSandAtCorrectDrive.match < 0.35 && poorSandAtCorrectDrive.progress === 0,
  'a correct tuner position with dispersed sand earns no hold');

const signatures = LEVELS.map(config => {
  const raster = Array.from({ length: 20 * 20 }, (_, index) => {
    const x = (index % 20 + 0.5) / 20;
    const y = (Math.floor(index / 20) + 0.5) / 20;
    return Math.abs(field(1, config.target, x, y)) < 0.13 ? '1' : '0';
  });
  return raster.join('');
});
check(new Set(signatures).size === LEVELS.length && LEVELS.length === 6, 'classic prints are distinct');

const campaignTimes = [];
for (const [index, config] of LEVELS.entries()) {
  const results = seeds.map(seed => {
    const drive = frame => {
      if (frame < 30) return config.target - 0.08;
      return config.target + 0.017 * Math.sin(frame * 2.17 + seed);
    };
    return run(index + 1, seed, drive, 3.5);
  });
  const latest = Math.max(...results.map(state => state.t));
  check(results.every(state => state.won), `${config.name}: ${results.filter(state => state.won).length}/${GROUP_SIZE} wins`);
  check(results.every(state => state.grains.every(({ x, y }) => x >= 0 && x <= 1 && y >= 0 && y <= 1)),
    `${config.name}: all grains stay on the square`);
  campaignTimes.push(`${config.name} ${GROUP_SIZE}/${GROUP_SIZE}, latest ${latest.toFixed(2)}s`);
}

let latestRetune = 0;
let latestSweep = 0;
let wrongPairs = 0;
for (const [index, config] of LEVELS.entries()) {
  const finite = run(index + 1, 0x5517 + (index + 1) * 177, () => config.target, 3);
  check(finite.won && Number.isFinite(finite.match), `${config.name}: coverage and fit stay finite`);
  for (const other of LEVELS) {
    if (other === config) continue;
    const state = run(index + 1, 27, () => other.target, 2.5);
    check(!state.won, `${config.name}: ${other.name} alone cannot satisfy the full print`);
    for (let frame = 0; frame < 150 && !state.won; frame++) tick(state, config.target);
    check(state.won, `${config.name}: recovers after settling on ${other.name}`);
    latestRetune = Math.max(latestRetune, state.t - 2.5);
    wrongPairs++;
  }

  for (const direction of [0, 1]) {
    const framesToSweep = 105;
    const scanned = run(index + 1, seeds[direction], frame => {
      const phase = Math.min(1, frame / framesToSweep);
      return direction + (config.target - direction) * phase;
    }, 4.25);
    check(scanned.won, `${config.name}: completes after continuous sweep from ${direction}`);
    latestSweep = Math.max(latestSweep, scanned.t - framesToSweep / 60);
  }
}

const meterScanTimes = [];
for (const [index, config] of LEVELS.entries()) {
  const state = createPlate(index + 1, 7300 + index);
  for (let stop = 0; stop <= 36 && !state.won; stop++) {
    const drive = stop / 36;
    for (let frame = 0; frame < 45 && !state.won; frame++) tick(state, drive);
    if (state.match >= 0.72) {
      for (let frame = 0; frame < 87 && !state.won; frame++) tick(state, drive);
    }
  }
  check(state.won, `${config.name}: an uninformed scan guided by the meter can finish the print`);
  meterScanTimes.push(`${config.name} ${state.t.toFixed(2)}s`);
}

const offNotch = frame => LEVELS[0].target + 0.023 + 0.009 * Math.sin(frame * 1.72);
const opening = seeds.map(seed => run(1, seed, offNotch, 3));
check(opening.every(state => state.won), 'the opening accepts a noisy off-center tap');
assert.deepEqual(run(1, seeds[0], offNotch, 3), opening[0], 'identical inputs replay bit for bit');
checks++;
check(JSON.stringify(run(1, seeds[0] + 1, offNotch, 3)) !== JSON.stringify(opening[0]), 'different seeds change the sand');

const classicSummary = () => {
console.log(`Classic plates. Opening notch ${openingNotch.t.toFixed(2)}s. Off-center opening ${GROUP_SIZE}/${GROUP_SIZE}, latest ${Math.max(...opening.map(state => state.t)).toFixed(2)}s.`);
console.log(`Mean diagonal distance ${startDistance.toFixed(4)} → ${endDistance.toFixed(4)}. Wrong mode match ${wrong.match.toFixed(3)}.`);
console.log(campaignTimes.join('\n'));
console.log(`${wrongPairs}/${wrongPairs} wrong mode pairs rejected and retuned, latest ${latestRetune.toFixed(2)}s after retune. ${LEVELS.length * 2} sweeps completed, latest ${latestSweep.toFixed(2)}s after reaching the target.`);
console.log(`Meter-guided scan: ${meterScanTimes.join(', ')}.`);
};
// ---------- The eighteen plates (2026-11-24) ----------
const { SHAPES, answerHandle, setHandle, marks, dailySpec, freeSpec, DAILY_POOL } = sim;
const MODAL = ALL.filter(spec => spec.kind === 'modal');
const { createHash } = await import('node:crypto');

// The first six plates move every grain exactly as before the twelve were added (digest of main's sim.js).
const parity = createHash('sha256');
for (let level = 1; level <= 6; level++) {
  for (const seed of [313, 27, 0x5517 + level * 177]) {
    const state = createPlate(level, seed);
    for (let frame = 0; frame < 400; frame++) {
      const drive = frame < 40 ? null : frame < 120 ? 0.1 + frame / 400 : frame < 200 ? ALL[(level + 2) % 6].target : ALL[level - 1].target + 0.01 * Math.sin(frame);
      tick(state, drive);
      if (frame % 50 === 49) parity.update(JSON.stringify([state.grains.map(grain => [grain.x, grain.y]), state.match, state.progress, state.won, state.t]));
    }
  }
}
check(parity.digest('hex') === '0289351df62b5b6e4d9143a689089e45fe5459f81cdd5b1e3b5228b61056017c', 'the six first plates are unchanged, grain for grain');
check(ALL.length >= 18 && new Set(MODAL.map(spec => spec.idea)).size === MODAL.length, `${ALL.length} plates; each new plate has its own idea`);
check(new Set(MODAL.map(spec => spec.shape)).size === 4, 'square, round, triangle and violin plates');

// Free boundary: a plate held nowhere has no slope across its edge (Neumann). The slope across each
// edge, as a share of the mode's steepest slope anywhere, for every triangle mode and every disk mode
// and twin. The triangle's modes are exact; the disk's Bessel roots are given to four places.
const gradient = (f, x, y) => [(f(x + 1e-4, y) - f(x - 1e-4, y)) / 2e-4, (f(x, y + 1e-4) - f(x, y - 1e-4)) / 2e-4];
const SQ3 = Math.sqrt(3);
const RIM = Math.sqrt(0.2475);
const EDGES = {
  triangle: [[t => [t, 0.933], () => [0, 1]], [t => [t / 2, 0.933 - t * SQ3 / 2], () => [-SQ3 / 2, -0.5]], [t => [1 - t / 2, 0.933 - t * SQ3 / 2], () => [SQ3 / 2, -0.5]]],
  disk: [[t => [0.5 + RIM * Math.cos(t * 2 * Math.PI), 0.5 + RIM * Math.sin(t * 2 * Math.PI)], (x, y) => [(x - 0.5) / RIM, (y - 0.5) / RIM]]],
};
const worstEdge = { triangle: 0, disk: 0 };
for (const shape of Object.keys(EDGES)) {
  for (const mode of SHAPES[shape].modes) {
    for (const f of [mode.f, mode.twin].filter(Boolean)) {
      let steepest = 0;
      for (let j = 0; j <= 50; j++) for (let i = 0; i <= 50; i++) if (SHAPES[shape].inside(i / 50, j / 50)) steepest = Math.max(steepest, Math.hypot(...gradient(f, i / 50, j / 50)));
      for (const [point, normal] of EDGES[shape]) {
        for (let k = 1; k < 40; k++) {
          const [x, y] = point(k / 40);
          const [nx, ny] = normal(x, y);
          const [gx, gy] = gradient(f, x, y);
          worstEdge[shape] = Math.max(worstEdge[shape], Math.abs(gx * nx + gy * ny) / steepest);
        }
      }
    }
  }
}
check(worstEdge.triangle < 1e-3, `triangle edges are free (worst slope across ${worstEdge.triangle.toFixed(5)} of the steepest)`);
check(worstEdge.disk < 0.04, `the disk's rim is free (worst slope across ${worstEdge.disk.toFixed(4)} of the steepest)`);

function play(spec, seed, { drive, handle = undefined, seconds = 6 }) {
  const state = createPlate(spec, seed);
  if (handle) setHandle(state, ...handle);
  for (let frame = 0; frame < seconds * 60 && !state.won && !state.failed; frame++) tick(state, drive(frame, state));
  return state;
}
// A thumb's approach: slide up to the pitch from below, then wobble on it.
const thumb = (target, seed, wobble = 0.017) => frame => frame < 24
  ? target - 0.08 + 0.08 * frame / 24
  : target + wobble * Math.sin(frame * 2.17 + seed);

// The intended answer wins every new plate from twelve seeds.
const answerTimes = [];
for (const spec of MODAL) {
  const results = seeds.map(seed => play(spec, seed, { drive: thumb(spec.target, seed, 0), handle: answerHandle(spec) }));
  check(results.every(state => state.won), `${spec.name}: the answer prints ${results.filter(state => state.won).length}/${GROUP_SIZE}`);
  answerTimes.push(`${spec.name} ${Math.max(...results.map(state => state.t)).toFixed(2)}s`);
}

// One claim for each new idea.
const byIdea = idea => MODAL.find(spec => spec.idea === idea);
const wins = (spec, options) => play(spec, seeds[0], options).won;
const at = target => () => target;
{
  const bow = byIdea('bow');
  check(!wins(bow, { drive: at(bow.target) }), `${bow.name}: with the bow where it starts, the right pitch alone cannot print`);
  check(wins(bow, { drive: at(bow.target), handle: answerHandle(bow) }), `${bow.name}: the bow moved off the rival figure prints`);
  const turn = byIdea('turn');
  check(!wins(turn, { drive: at(turn.target) }), `${turn.name}: the star at the bow's start is turned the wrong way`);
  const [x, y] = answerHandle(turn);
  const mirror = [0.5 + (x - 0.5) * Math.cos(Math.PI / 3) - (y - 0.5) * Math.sin(Math.PI / 3) * -1, 0.5 + (x - 0.5) * Math.sin(-Math.PI / 3) + (y - 0.5) * Math.cos(Math.PI / 3)];
  check(wins(turn, { drive: at(turn.target), handle: mirror }), `${turn.name}: the bow a sixth of a turn round (the star's symmetry) prints too`);
  const finger = byIdea('finger');
  check(!wins(finger, { drive: at(finger.target) }), `${finger.name}: without the finger both figures ring and the print fails`);
  check(wins(finger, { drive: at(finger.target), handle: answerHandle(finger) }), `${finger.name}: the finger on the line prints`);
  const duet = byIdea('duet');
  check(marks(duet).spots.length >= 4, `${duet.name}: the engraving marks ${marks(duet).spots.length} still spots where both figures rest`);
  check(!wins(duet, { drive: at(duet.droneDrive) }), `${duet.name}: the drone's pitch alone cannot print`);
  const stiff = byIdea('stiff');
  check(!wins(stiff, { drive: at(stiff.target) }), `${stiff.name}: a jump onto the pitch lands on the quiet branch`);
  check(!wins(stiff, { drive: frame => Math.max(stiff.target, stiff.target + 0.1 - frame * 0.004) }), `${stiff.name}: sliding down from above stays quiet`);
  check(wins(stiff, { drive: frame => Math.min(stiff.target, stiff.target - 0.1 + frame * 0.004) }), `${stiff.name}: sliding up from below catches the loud branch`);
  const powder = byIdea('powder');
  const dusted = play(powder, seeds[0], { drive: at(powder.target) });
  check(dusted.won && dusted.powderMatch > 0.8 && dusted.saltMatch > 0.8, `${powder.name}: salt on the still lines and powder on the loudest places (${dusted.saltMatch.toFixed(2)}, ${dusted.powderMatch.toFixed(2)})`);
  const shaker = byIdea('shaker');
  const shaken = play(shaker, seeds[0], { drive: at(shaker.target - 0.15), seconds: 30 });
  check(shaken.failed && !shaken.won && shaken.salt < shaker.threshold, `${shaker.name}: a long ring at the wrong pitch shakes the salt off by ${shaken.t.toFixed(1)}s`);
  const ring = byIdea('ring');
  check(!wins(ring, { drive: at(ring.target) }), `${ring.name}: without the finger the ring's twin spoils it`);
}

// The meter-only searcher: it knows nothing of the plate but the impression meter on screen. It
// sweeps the tuner up the scale in steps, waiting at each; where the meter rises past 0.72 it stays.
// On a plate with a bow or a finger it does that sweep with the bow or finger at each point of a
// 5 x 5 grid on the plate, in turn. When salt shakes off it salts again and goes on. At the end it
// returns to the best place the meter showed, sliding up into it. Its clock includes every resalt.
function meterSearch(spec, seed) {
  let state = createPlate(spec, seed);
  let clock = 0;
  let resalts = 0;
  let placed = null;
  const best = { match: 0, drive: null, handle: null };
  const place = point => { placed = point; if (point) setHandle(state, ...point); };
  const run = (drive, frames) => {
    for (let frame = 0; frame < frames && !state.won; frame++) {
      tick(state, drive);
      if (state.failed) {
        clock += state.t;
        resalts++;
        state = createPlate(spec, seed + 977 * resalts);
        place(placed);
      }
    }
  };
  const listen = (drive, frames) => {
    run(drive, frames);
    if (state.match > best.match) Object.assign(best, { match: state.match, drive, handle: placed });
    if (state.match >= 0.72) for (let k = 0; k < 4 && !state.won; k++) run(drive, 60);
  };
  const sweep = frames => { for (let stop = 0; stop <= 36 && !state.won; stop++) listen(stop / 36, frames); };
  if (!spec.handle) sweep(45);
  else {
    for (let j = 0; j < 5 && !state.won; j++) {
      for (let i = 0; i < 5 && !state.won; i++) {
        const point = [0.1 + 0.2 * i, 0.1 + 0.2 * j];
        if (!SHAPES[spec.shape].inside(...point)) continue;
        place(point);
        sweep(30);
      }
    }
  }
  // Then it nudges the bow or finger round the best place, keeping each nudge that lifts the meter.
  if (!state.won && best.handle) {
    for (const step of [0.06, 0.03, 0.015, 0.0075]) {
      let moved = true;
      while (moved && !state.won) {
        moved = false;
        const from = best.handle;
        for (let k = 0; k < 8 && !state.won; k++) {
          const point = [from[0] + step * Math.cos(k * Math.PI / 4), from[1] + step * Math.sin(k * Math.PI / 4)];
          if (!SHAPES[spec.shape].inside(...point)) continue;
          const before = best.match;
          place(point);
          listen(best.drive, 40);
          if (best.match > before + 0.01) moved = true;
        }
      }
    }
  }
  if (!state.won && best.drive !== null) {
    place(best.handle);
    for (let k = 6; k >= 0 && !state.won; k--) run(best.drive - k * 0.01, 4);
    run(best.drive, 300);
  }
  return { won: state.won, seconds: clock + state.t, resalts };
}
const searchTimes = [];
for (const spec of ALL) {
  const result = meterSearch(spec, 7300 + spec.level);
  check(result.won, `${spec.name}: the meter-only searcher clears it`);
  searchTimes.push(`${spec.level} ${spec.name} ${result.seconds.toFixed(1)}s${result.resalts ? ` (${result.resalts} resalts)` : ''}`);
}

// The clumsy player: slides in from below, wobbles on the pitch, and puts the bow or finger a little
// off the best place (0.015 of the plate, about 5 px on a phone). Clear rate over twelve seeds for every plate: no plate may fall off a cliff.
const clumsy = [];
for (const spec of ALL) {
  const answer = spec.handle ? answerHandle(spec) : null;
  const results = seeds.map((seed, index) => {
    const off = answer ? [answer[0] + 0.015 * Math.cos(index * 2.4), answer[1] + 0.015 * Math.sin(index * 2.4)] : undefined;
    return play(spec, seed, { drive: thumb(spec.target, seed), handle: off, seconds: 8 });
  });
  const cleared = results.filter(state => state.won).length;
  clumsy.push([spec, cleared, Math.max(...results.filter(state => state.won).map(state => state.t), 0)]);
}
const clumsyLine = () => `Clumsy player: ${clumsyTotal}/${ALL.length * GROUP_SIZE} clears. ${clumsy.map(([spec, cleared, slowest]) => `${spec.level} ${cleared}/${GROUP_SIZE} ${slowest.toFixed(2)}s`).join(', ')}.`;
const clumsyTotal = clumsy.reduce((sum, [, cleared]) => sum + cleared, 0);
console.log(clumsyLine());
check(clumsy.every(([, cleared]) => cleared >= GROUP_SIZE - 1), `the clumsy player clears every plate at least ${GROUP_SIZE - 1}/${GROUP_SIZE}`);

// The daily figure: the same for everyone on a day, different across days, and always printable.
check(dailySpec('2026-11-24').mode === dailySpec('2026-11-24').mode && dailySpec('2026-11-24').seed === dailySpec('2026-11-24').seed, 'one daily figure per date');
const month = new Set(Array.from({ length: 30 }, (_, day) => { const spec = dailySpec(`2026-12-${String(day + 1).padStart(2, '0')}`); return spec.shape + spec.mode; }));
check(month.size >= 12, `thirty days give ${month.size} different figures`);
let dailyCleared = 0;
for (const [shape, mode] of DAILY_POOL) {
  const spec = { ...dailySpec('pool'), shape, mode, target: SHAPES[shape].modes.find(item => item.id === mode).d, id: `pool-${shape}-${mode}` };
  delete spec.compiled;
  if (play(spec, 101, { drive: thumb(spec.target, 3) }).won) dailyCleared++;
}
check(dailyCleared === DAILY_POOL.length, `every daily figure prints: ${dailyCleared}/${DAILY_POOL.length}`);

// The instrument never ends a run and follows the bow.
for (const shape of Object.keys(SHAPES)) {
  const free = createPlate(freeSpec(shape), 9);
  setHandle(free, 0.4, 0.6);
  for (let frame = 0; frame < 120; frame++) tick(free, 0.5);
  check(!free.won && !free.failed && free.grains.every(grain => SHAPES[shape].inside(grain.x, grain.y)), `instrument (${shape}): plays on, salt stays on the plate`);
}

console.log(`Answers: ${answerTimes.join(', ')}.`);
console.log(`Meter-only search: ${searchTimes.join(', ')}.`);
console.log(`Daily pool ${DAILY_POOL.length} figures; ${month.size} different in thirty days. Free edges: triangle ${worstEdge.triangle.toFixed(5)}, disk ${worstEdge.disk.toFixed(4)}.`);
classicSummary();
console.log(`${checks} checks passed.`);
