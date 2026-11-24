import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function loadSimulation() {
  if (!process.argv.includes('--mutate')) return import('./sim.js');

  // Remove the force toward nodes while keeping the input, scattering and scoring.
  const source = await readFile(new URL('./sim.js', import.meta.url), 'utf8');
  const normal = 'const travel = Math.min(0.0095, distance * 0.38);';
  assert(source.includes(normal), 'mutation must replace the actual drift calculation');
  const mutant = source.replace(normal, 'const travel = 0;');
  return import(`data:text/javascript;base64,${Buffer.from(mutant).toString('base64')}`);
}

const { LEVELS, createPlate, field, tick } = await loadSimulation();
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
check(new Set(signatures).size === LEVELS.length && LEVELS.length >= 6, 'campaign prints are distinct');

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

console.log(`${checks} checks passed. Opening notch ${openingNotch.t.toFixed(2)}s. Off-center opening ${GROUP_SIZE}/${GROUP_SIZE}, latest ${Math.max(...opening.map(state => state.t)).toFixed(2)}s.`);
console.log(`Mean diagonal distance ${startDistance.toFixed(4)} → ${endDistance.toFixed(4)}. Wrong mode match ${wrong.match.toFixed(3)}.`);
console.log(campaignTimes.join('\n'));
console.log(`${wrongPairs}/${wrongPairs} wrong mode pairs rejected and retuned, latest ${latestRetune.toFixed(2)}s after retune. ${LEVELS.length * 2} sweeps completed, latest ${latestSweep.toFixed(2)}s after reaching the target.`);
console.log(`Meter-guided scan: ${meterScanTimes.join(', ')}.`);
