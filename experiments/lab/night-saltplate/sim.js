const STEP = 1 / 60;
const GRAIN_COUNT = 460;
const COVERAGE_GRID = 18;

// Each term is a product of two cosine harmonics on the square.
const MODES = [
  [[1, 0, 1]],
  [[1, 0, 1], [0, 1, -1]],
  [[1, 1, 1]],
  [[2, 0, 1], [0, 2, -1]],
  [[2, 1, 1], [1, 2, -1]],
  [[3, 0, 1], [0, 3, 1]],
  [[3, 1, 1], [1, 3, -1]],
  [[3, 2, 1], [2, 3, 1]],
];

export const LEVELS = [
  { name: 'Twin Fans', target: 4 / 7, threshold: 0.83, hold: 0.65 },
  { name: 'Diagonal', target: 1 / 7, threshold: 0.85, hold: 0.70 },
  { name: 'Cross', target: 2 / 7, threshold: 0.85, hold: 0.75 },
  { name: 'Saltire', target: 3 / 7, threshold: 0.88, hold: 0.80 },
  { name: 'Four Petals', target: 6 / 7, threshold: 0.91, hold: 0.90 },
  { name: 'Lattice', target: 5 / 7, threshold: 0.92, hold: 0.95 },
];

function mix(drive) {
  const scan = Math.min(1, Math.max(0, drive)) * (MODES.length - 1);
  const left = Math.min(MODES.length - 2, Math.floor(scan));
  const fraction = scan - left;
  // Near a resonance its shape dominates. Between peaks the modes mix.
  const incoming = fraction ** 4;
  const outgoing = (1 - fraction) ** 4;
  return [MODES[left], MODES[left + 1], incoming / (incoming + outgoing)];
}

function sample(terms, x, y) {
  let amplitude = 0;
  for (const [m, n, coefficient] of terms) {
    amplitude += coefficient * Math.cos(m * Math.PI * x) * Math.cos(n * Math.PI * y);
  }
  return amplitude;
}

// The tuner sweeps the same modal series on each plate.
export function field(_level, drive, x, y) {
  const [left, right, fraction] = mix(drive);
  return sample(left, x, y) * (1 - fraction) + sample(right, x, y) * fraction;
}

function gradient(left, right, fraction, x, y, result) {
  result.a = 0;
  result.dx = 0;
  result.dy = 0;
  accumulate(left, 1 - fraction, x, y, result);
  accumulate(right, fraction, x, y, result);
}

function accumulate(terms, weight, x, y, result) {
  if (weight === 0) return;
  for (const [m, n, coefficient] of terms) {
    const phaseX = m * Math.PI * x;
    const phaseY = n * Math.PI * y;
    const cosX = Math.cos(phaseX);
    const cosY = Math.cos(phaseY);
    const strength = weight * coefficient;
    result.a += strength * cosX * cosY;
    result.dx -= strength * m * Math.PI * Math.sin(phaseX) * cosY;
    result.dy -= strength * n * Math.PI * cosX * Math.sin(phaseY);
  }
}

function random(state) {
  state.seed = (Math.imul(1664525, state.seed) + 1013904223) >>> 0;
  return state.seed / 4294967296;
}

export function createPlate(level, seed = 1) {
  const config = LEVELS[level - 1];
  if (!config) throw new RangeError('Unknown plate');
  const state = { level, seed: seed >>> 0, grains: [], progress: 0, match: 0, won: false, t: 0, frames: 0, lastStirDrive: null, stirring: 0 };
  for (let index = 0; index < GRAIN_COUNT; index++) {
    state.grains.push({ x: random(state), y: random(state) });
  }
  state.match = measureMatch(state, config);
  return state;
}

// A cell belongs to the print when its padded corners straddle a node.
const PRINT_CELLS = LEVELS.map(({ target }, index) => {
  const cells = [];
  for (let row = 0; row < COVERAGE_GRID; row++) {
    for (let col = 0; col < COVERAGE_GRID; col++) {
      const values = [];
      for (const dx of [-0.03, 1.03]) {
        for (const dy of [-0.03, 1.03]) {
          values.push(field(index + 1, target, (col + dx) / COVERAGE_GRID, (row + dy) / COVERAGE_GRID));
        }
      }
      if (Math.min(...values) <= 0 && Math.max(...values) >= 0) cells.push([col, row]);
    }
  }
  return cells;
});

function coverage(level, occupied) {
  const cells = PRINT_CELLS[level - 1];
  let covered = 0;
  for (const [col, row] of cells) {
    // Allow grains on the nearby edge to cover this cell.
    const start = Math.max(0, row - 1);
    const end = Math.min(COVERAGE_GRID - 1, row + 1);
    const neighbors = (1 << col) | ((1 << col) >>> 1) | (1 << (col + 1));
    for (let adjacent = start; adjacent <= end; adjacent++) {
      if (occupied[adjacent] & neighbors) {
        covered++;
        break;
      }
    }
  }
  return covered / cells.length;
}

function measureMatch(state, config) {
  const [left, right, blend] = mix(config.target);
  const local = { a: 0, dx: 0, dy: 0 };
  const tolerance = state.level === 1 ? 0.021 : 0.016;
  const occupied = new Uint32Array(COVERAGE_GRID);
  let sum = 0;
  for (const grain of state.grains) {
    gradient(left, right, blend, grain.x, grain.y, local);
    const distance = Math.abs(local.a) / (Math.hypot(local.dx, local.dy) + 0.03);
    sum += Math.max(0, 1 - (distance / tolerance) ** 2);
    if (distance < tolerance) {
      const col = Math.floor(grain.x * COVERAGE_GRID);
      const row = Math.floor(grain.y * COVERAGE_GRID);
      occupied[row] |= 1 << col;
    }
  }
  return Math.min(sum / state.grains.length, coverage(state.level, occupied));
}

function clampPosition(value) {
  return Math.max(0.001, Math.min(0.999, value));
}

export function tick(state, drive = null) {
  if (state.won) return state;
  state.frames++;
  state.t = state.frames * STEP;
  if (drive === null) {
    state.progress = 0;
    return state;
  }
  const config = LEVELS[state.level - 1];
  if (state.lastStirDrive === null) state.lastStirDrive = drive;
  if (Math.abs(drive - state.lastStirDrive) >= 0.065) {
    state.lastStirDrive = drive;
    state.stirring = 24;
    for (const grain of state.grains) {
      const angle = random(state) * Math.PI * 2;
      const speed = 0.035 + 0.045 * random(state);
      grain.stirX = Math.cos(angle) * speed;
      grain.stirY = Math.sin(angle) * speed;
    }
  }
  const [left, right, blend] = mix(drive);
  const local = { a: 0, dx: 0, dy: 0 };

  for (const grain of state.grains) {
    gradient(left, right, blend, grain.x, grain.y, local);
    const slope = Math.hypot(local.dx, local.dy);
    const direction = Math.sign(local.a);

    // Take a bounded Newton step toward the node. Scatter rises with distance.
    const distance = Math.abs(local.a) / (slope + 0.3);
    const travel = Math.min(0.0095, distance * 0.38);
    const scatter = Math.min(0.005, distance * 0.05) + 0.00035;
    const dx = -direction * travel * local.dx / (slope + 0.001) + scatter * (random(state) - 0.5);
    const dy = -direction * travel * local.dy / (slope + 0.001) + scatter * (random(state) - 0.5);
    grain.x += dx;
    grain.y += dy;
    if (state.stirring > 0) {
      // The retune shakes grains loose from lines shared by both modes.
      grain.x += grain.stirX;
      grain.y += grain.stirY;
      if (grain.x < 0 || grain.x > 1) {
        grain.x = grain.x < 0 ? -grain.x : 2 - grain.x;
        grain.stirX = -grain.stirX;
      }
      if (grain.y < 0 || grain.y > 1) {
        grain.y = grain.y < 0 ? -grain.y : 2 - grain.y;
        grain.stirY = -grain.stirY;
      }
      grain.stirX *= 0.91;
      grain.stirY *= 0.91;
    }
    grain.x = clampPosition(grain.x);
    grain.y = clampPosition(grain.y);
  }
  if (state.stirring > 0) state.stirring--;
  state.match = measureMatch(state, config);

  if (state.match >= config.threshold) {
    state.progress = Math.min(1, state.progress + STEP / config.hold);
  } else {
    state.progress = 0;
  }
  state.won = state.progress >= 1;
  return state;
}
