const STEP = 1 / 60;
const GRAIN_COUNT = 460;
const POWDER_COUNT = 240;
const COVERAGE_GRID = 18;

// ---------------------------------------------------------------------------------------------
// The six square plates from the first version. This part is unchanged, so their prints, times
// and replays are bit for bit what they were (bots.mjs checks a digest taken from the old file).
// ---------------------------------------------------------------------------------------------

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

const CLASSIC = [
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

// The tuner sweeps the same modal series on each of the six square plates.
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

function createClassic(level, seed) {
  const config = CLASSIC[level - 1];
  const state = { level, seed: seed >>> 0, grains: [], progress: 0, match: 0, won: false, t: 0, frames: 0, lastStirDrive: null, stirring: 0 };
  for (let index = 0; index < GRAIN_COUNT; index++) {
    state.grains.push({ x: random(state), y: random(state) });
  }
  state.match = measureMatch(state, config);
  return state;
}

// A cell belongs to the print when its padded corners straddle a node.
const PRINT_CELLS = CLASSIC.map(({ target }, index) => {
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
  return coverCells(PRINT_CELLS[level - 1], occupied);
}

function coverCells(cells, occupied) {
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

function tickClassic(state, drive) {
  if (state.won) return state;
  state.frames++;
  state.t = state.frames * STEP;
  if (drive === null) {
    state.progress = 0;
    return state;
  }
  const config = CLASSIC[state.level - 1];
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

// ---------------------------------------------------------------------------------------------
// Plates of other shapes. Each shape has a series of standing-wave shapes (modes), each with its
// own place on the tuner. The plate's response is the sum of every mode, weighted by how near the
// tuner is to that mode's pitch, by how strongly the bow excites it where it touches (a mode cannot
// be driven from its own nodal line) and by a damping finger (a mode with an antinode under the
// finger dies). These are approximations for a game: square, disk and triangle use the membrane
// (Neumann) modes, whose nodal figures resemble the plate figures; the violin back uses square
// modes stretched to its outline. None of them predicts the pitch of a real plate.
// ---------------------------------------------------------------------------------------------

const PI = Math.PI;
const cos = Math.cos;
const sin = Math.sin;

function besselJ(n, x) {
  let term = (x / 2) ** n;
  for (let k = 1; k <= n; k++) term /= k;
  let sum = 0;
  for (let k = 0; k < 40; k++) {
    sum += term;
    term *= -(x * x / 4) / ((k + 1) * (k + 1 + n));
    if (Math.abs(term) < 1e-17) break;
  }
  return sum;
}

// Disk of radius 0.5 centred on the square. Free-edge (Neumann) roots j'(n, s).
function diskMode(n, alpha, twin = false) {
  let peak = 0;
  for (let i = 0; i <= 400; i++) peak = Math.max(peak, Math.abs(besselJ(n, alpha * i / 400)));
  const radial = new Float64Array(1025);
  for (let i = 0; i <= 1024; i++) radial[i] = besselJ(n, alpha * Math.min(1, i / 1000)) / peak;
  return (x, y) => {
    const dx = x - 0.5;
    const dy = y - 0.5;
    const r = Math.min(1.024, Math.hypot(dx, dy) * 2) * 1000;
    const i = Math.floor(r);
    const R = radial[i] + (radial[Math.min(1024, i + 1)] - radial[i]) * (r - i);
    if (n === 0) return R;
    const theta = Math.atan2(dy, dx);
    return R * (twin ? sin(n * theta) : cos(n * theta));
  };
}

// Equilateral triangle, side 1, base along y = 0.933. Its Neumann modes are sums of plane waves
// over the triangle's reflection group (Lamé): the six images of k under the symmetries of a corner,
// with k on the lattice dual to the group's translations (length sqrt(3) across each side).
const TRI_BASE = 0.933;
const SQ3 = Math.sqrt(3);
const B1 = [2 * PI / 3, 2 * PI / SQ3];
const B2 = [-4 * PI / 3, 0];
function triangleOrbit(p, q) {
  const kx = p * B1[0] + q * B2[0];
  const ky = p * B1[1] + q * B2[1];
  const orbit = [];
  for (let r = 0; r < 3; r++) {
    const a = r * 2 * PI / 3;
    const rx = kx * cos(a) - ky * sin(a);
    const ry = kx * sin(a) + ky * cos(a);
    orbit.push([rx, ry], [rx, -ry]);
  }
  return orbit;
}
function triangleMode(p, q) {
  const orbit = triangleOrbit(p, q);
  const raw = (x, y) => {
    const X = x;
    const Y = TRI_BASE - y;
    let sum = 0;
    for (const [kx, ky] of orbit) sum += cos(kx * X + ky * Y);
    return sum;
  };
  let peak = 0;
  for (let i = 0; i <= 60; i++) {
    for (let j = 0; j <= 60; j++) {
      const x = i / 60;
      const y = j / 60;
      if (insideTriangle(x, y)) peak = Math.max(peak, Math.abs(raw(x, y)));
    }
  }
  return (x, y) => raw(x, y) / peak;
}
function insideTriangle(x, y) {
  const Y = TRI_BASE - y;
  return Y >= 0 && Y <= SQ3 * x && Y <= SQ3 * (1 - x);
}

// A violin back's outline: upper bout, the C-bouts' waist and the wider lower bout (half widths,
// a little wider than a real violin's so the figures have room).
const VIOLIN = [[0.03, 0], [0.045, 0.1], [0.08, 0.18], [0.14, 0.235], [0.21, 0.255], [0.28, 0.245], [0.34, 0.215],
  [0.385, 0.18], [0.43, 0.165], [0.48, 0.165], [0.53, 0.18], [0.575, 0.225], [0.64, 0.275], [0.72, 0.3],
  [0.8, 0.295], [0.87, 0.26], [0.925, 0.2], [0.955, 0.12], [0.97, 0]];
export function violinHalfWidth(y) {
  if (y <= VIOLIN[0][0] || y >= VIOLIN[VIOLIN.length - 1][0]) return 0;
  let i = 0;
  while (VIOLIN[i + 1][0] < y) i++;
  const p0 = VIOLIN[Math.max(0, i - 1)];
  const p1 = VIOLIN[i];
  const p2 = VIOLIN[i + 1];
  const p3 = VIOLIN[Math.min(VIOLIN.length - 1, i + 2)];
  const t = (y - p1[0]) / (p2[0] - p1[0]);
  // Catmull-Rom through the half widths (rounded tips: square-root ease at both ends).
  const m1 = (p2[1] - p0[1]) / 2;
  const m2 = (p3[1] - p1[1]) / 2;
  const t2 = t * t;
  const t3 = t2 * t;
  let w = (2 * t3 - 3 * t2 + 1) * p1[1] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2[1] + (t3 - t2) * m2;
  if (i === 0) w = p2[1] * Math.sqrt(t);
  if (i === VIOLIN.length - 2) w = p1[1] * Math.sqrt(1 - t);
  return Math.max(0, w);
}
function violinMode(m, n, sign = 0, shift = 0) {
  return (x, y) => {
    const w = Math.max(0.02, violinHalfWidth(y));
    const u = 0.5 + (x - 0.5) / (2 * w);
    const v = (y - 0.03) / 0.94;
    if (sign) return (cos(m * PI * u) * cos(n * PI * v) + sign * cos(n * PI * u) * cos(m * PI * v) + shift) / (2 + shift);
    return cos(m * PI * u) * cos(n * PI * v);
  };
}

const sq = (m, n) => (x, y) => cos(m * PI * x) * cos(n * PI * y);
const sqPair = (m, n, sign) => (x, y) => (cos(m * PI * x) * cos(n * PI * y) + sign * cos(n * PI * x) * cos(m * PI * y)) / 2;

// Each mode: d is its place on the tuner (0 is 110 Hz, 1 is 440 Hz); twin is a second shape at the
// same pitch (a rotated copy on the disk, the swapped copy on the square), which sounds only when a
// bow chooses the mix.
export const SHAPES = {
  square: {
    inside: () => true,
    modes: [
      { id: 'line', d: 0.02, f: sq(1, 0) },
      { id: 'diagonal', d: 0.12, f: sqPair(1, 0, -1) },
      { id: 'cross', d: 0.22, f: sq(1, 1) },
      { id: 'saltire', d: 0.33, f: sqPair(2, 0, -1) },
      { id: 'bars', d: 0.42, f: sq(2, 0), twin: sq(0, 2) },
      { id: 'gate', d: 0.53, f: sq(2, 1), twin: sq(1, 2) },
      { id: 'grid', d: 0.66, f: sq(2, 2) },
      { id: 'ring', d: 0.77, f: sqPair(3, 0, 1) },
      { id: 'weave', d: 0.88, f: sqPair(3, 1, -1) },
      { id: 'lace', d: 0.98, f: sqPair(3, 2, 1) },
    ],
  },
  disk: {
    inside: (x, y) => (x - 0.5) ** 2 + (y - 0.5) ** 2 <= 0.2475,
    modes: [
      { id: 'd11', d: 0.02, f: diskMode(1, 1.8412), twin: diskMode(1, 1.8412, true) },
      { id: 'd21', d: 0.2, f: diskMode(2, 3.0542), twin: diskMode(2, 3.0542, true) },
      { id: 'd01', d: 0.33, f: diskMode(0, 3.8317) },
      { id: 'd31', d: 0.45, f: diskMode(3, 4.2012), twin: diskMode(3, 4.2012, true) },
      { id: 'd12', d: 0.58, f: diskMode(1, 5.3314), twin: diskMode(1, 5.3314, true) },
      { id: 'd41', d: 0.7, f: diskMode(4, 5.3176), twin: diskMode(4, 5.3176, true) },
      { id: 'd22', d: 0.84, f: diskMode(2, 6.7061), twin: diskMode(2, 6.7061, true) },
      { id: 'd02', d: 0.97, f: diskMode(0, 7.0156) },
    ],
  },
  triangle: {
    inside: insideTriangle,
    modes: [
      { id: 't1', d: 0.03, f: triangleMode(1, 1) },
      { id: 't2', d: 0.19, f: triangleMode(2, 1) },
      { id: 't3', d: 0.32, f: triangleMode(2, 2) },
      { id: 't4', d: 0.48, f: triangleMode(3, 2) },
      { id: 't5', d: 0.62, f: triangleMode(3, 3) },
      { id: 't6', d: 0.78, f: triangleMode(4, 2) },
      { id: 't7', d: 0.94, f: triangleMode(4, 3) },
    ],
  },
  violin: {
    inside: (x, y) => y > 0.03 && y < 0.97 && Math.abs(x - 0.5) < violinHalfWidth(y),
    modes: [
      { id: 'v-spine', d: 0.02, f: violinMode(1, 0) },
      { id: 'v-waist', d: 0.1, f: violinMode(0, 1) },
      { id: 'v-cross', d: 0.18, f: violinMode(1, 1) },
      // Violin makers' mode 2 (the X) and mode 5 (the ring) sit an octave apart: 192 and 384 Hz here.
      { id: 'v-x', d: 0.248, f: violinMode(2, 0, -1) },
      { id: 'v-bars', d: 0.42, f: violinMode(0, 2) },
      { id: 'v-ladder', d: 0.55, f: violinMode(1, 2) },
      { id: 'v-arch', d: 0.68, f: violinMode(2, 1) },
      { id: 'v-ring', d: 0.83, f: violinMode(2, 0, 1, 0.7), twin: violinMode(0, 3) },
      { id: 'v-lace', d: 0.98, f: violinMode(2, 2) },
    ],
  },
};

// The twelve new plates. Each brings one idea from the physics of a vibrating plate.
const MODAL = [
  { name: 'Spokes', idea: 'round', shape: 'disk', mode: 'd21', threshold: 0.84, hold: 0.7 },
  { name: 'Halo', idea: 'circle', shape: 'disk', mode: 'd01', threshold: 0.85, hold: 0.75 },
  { name: 'Delta', idea: 'triangle', shape: 'triangle', mode: 't5', threshold: 0.85, hold: 0.75 },
  { name: 'Bowing Point', idea: 'bow', shape: 'square', mode: 'gate', which: 0, handle: 'bow', start: [0.25, 0.3], tolerance: 0.04, threshold: 0.84, hold: 0.8 },
  { name: 'Turning Star', idea: 'turn', shape: 'disk', mode: 'd31', handle: 'bow', answerAt: [0.5 + 0.4 * cos(PI / 9), 0.5 + 0.4 * sin(PI / 9)], start: [0.9, 0.5], tolerance: 0.05, threshold: 0.8, hold: 0.8 },
  { name: 'Violin X', idea: 'violin', shape: 'violin', mode: 'v-x', threshold: 0.85, hold: 0.8 },
  { name: 'Finger', idea: 'finger', shape: 'square', mode: 'bars', which: 0, handle: 'damp', threshold: 0.85, hold: 0.8 },
  { name: 'Duet', idea: 'duet', shape: 'square', mode: 'grid', drone: 'cross', threshold: 0.84, hold: 0.8 },
  { name: 'Stiff Plate', idea: 'stiff', shape: 'triangle', mode: 't4', stiff: true, threshold: 0.85, hold: 0.8 },
  { name: 'Powder', idea: 'powder', shape: 'disk', mode: 'd41', which: 0, powder: true, threshold: 0.8, hold: 0.8 },
  { name: 'Shaker', idea: 'shaker', shape: 'triangle', mode: 't6', shake: { grace: 9, span: 6 }, threshold: 0.86, hold: 0.8 },
  { name: 'Violin Ring', idea: 'ring', shape: 'violin', mode: 'v-ring', which: 0, handle: 'damp', shake: { grace: 14, span: 6 }, threshold: 0.8, hold: 0.85 },
];

// The tuner position of each plate's mode is part of the plate.
for (const spec of MODAL) {
  const mode = SHAPES[spec.shape].modes.find(item => item.id === spec.mode);
  spec.kind = 'modal';
  spec.target = mode.d;
  if (spec.drone) spec.droneDrive = SHAPES[spec.shape].modes.find(item => item.id === spec.drone).d;
}

export const LEVELS = [...CLASSIC.map(spec => ({ ...spec, kind: 'classic', shape: 'square', idea: 'classic' })), ...MODAL];
LEVELS.forEach((spec, index) => { spec.id = 'plate-' + (index + 1); spec.level = index + 1; });

const GRID = 96;
const SIDE = GRID + 1;
const tables = new Map();
// Values and slopes on a 97 x 97 grid, interpolated per grain: the same cost for every shape.
function table(fn) {
  let entry = tables.get(fn);
  if (entry) return entry;
  const v = new Float32Array(SIDE * SIDE);
  const gx = new Float32Array(SIDE * SIDE);
  const gy = new Float32Array(SIDE * SIDE);
  const h = 1e-4;
  for (let j = 0; j < SIDE; j++) {
    for (let i = 0; i < SIDE; i++) {
      const x = i / GRID;
      const y = j / GRID;
      const k = j * SIDE + i;
      v[k] = fn(x, y);
      gx[k] = (fn(x + h, y) - fn(x - h, y)) / (2 * h);
      gy[k] = (fn(x, y + h) - fn(x, y - h)) / (2 * h);
    }
  }
  entry = { v, gx, gy };
  tables.set(fn, entry);
  return entry;
}

function modeList(spec) {
  const shape = SHAPES[spec.shape];
  const list = [];
  for (const mode of shape.modes) {
    // Without a bow the plate sounds the first shape of a pair; a bow lets the pair mix.
    list.push({ d: mode.d, f: mode.f, id: mode.id, part: 0 });
    // A pair sounds together where a bow mixes it or a finger can silence one of the two.
    if (mode.twin && (spec.handle || spec.free)) list.push({ d: mode.d, f: mode.twin, id: mode.id, part: 1 });
  }
  for (const mode of list) mode.table = table(mode.f);
  return list;
}

// Weights for the tone at `drive`: quartic resonance peaks, as in the classic plates.
function coefficients(spec, modes, drive, handle, caught, out) {
  let total = 0;
  const seen = new Set();
  for (let k = 0; k < modes.length; k++) {
    const mode = modes[k];
    let offset = Math.abs(drive - mode.d);
    // Not caught, the stiff mode's peak has bent away: it answers as if far off its pitch.
    if (spec.stiff && mode.id === spec.mode && !caught) offset = Math.max(offset, 0.22);
    const w = 1 / (offset ** 4 + 1e-12);
    if (!seen.has(mode.id)) { total += w; seen.add(mode.id); }
    let e = 1;
    if (spec.handle === 'bow' || (spec.free && handle)) e = mode.f(handle[0], handle[1]);
    else if (spec.handle === 'damp' && handle) e = Math.exp(-14 * mode.f(handle[0], handle[1]) ** 2);
    out[k] = w * e;
  }
  for (let k = 0; k < modes.length; k++) out[k] /= total;
  return out;
}

// The field of one tone at a point: value and slope, summed over modes.
function probe(modes, c, x, y, out) {
  const fx = Math.min(GRID - 1e-6, Math.max(0, x * GRID));
  const fy = Math.min(GRID - 1e-6, Math.max(0, y * GRID));
  const i = Math.floor(fx);
  const j = Math.floor(fy);
  const tx = fx - i;
  const ty = fy - j;
  const k00 = j * SIDE + i;
  const k10 = k00 + 1;
  const k01 = k00 + SIDE;
  const k11 = k01 + 1;
  const w00 = (1 - tx) * (1 - ty);
  const w10 = tx * (1 - ty);
  const w01 = (1 - tx) * ty;
  const w11 = tx * ty;
  let a = 0;
  let dx = 0;
  let dy = 0;
  for (let k = 0; k < modes.length; k++) {
    const weight = c[k];
    if (weight > -1e-5 && weight < 1e-5) continue;
    const { v, gx, gy } = modes[k].table;
    a += weight * (v[k00] * w00 + v[k10] * w10 + v[k01] * w01 + v[k11] * w11);
    dx += weight * (gx[k00] * w00 + gx[k10] * w10 + gx[k01] * w01 + gx[k11] * w11);
    dy += weight * (gy[k00] * w00 + gy[k10] * w10 + gy[k01] * w01 + gy[k11] * w11);
  }
  out.a = a;
  out.dx = dx;
  out.dy = dy;
  return out;
}

// The vibration's strength s = sqrt(sum of each tone squared) and its slope. Salt runs down it.
function strength(tones, x, y, one, out) {
  let e = 0;
  let gx = 0;
  let gy = 0;
  for (const [modes, c] of tones) {
    probe(modes, c, x, y, one);
    e += one.a * one.a;
    gx += one.a * one.dx;
    gy += one.a * one.dy;
  }
  const s = Math.sqrt(e) + 1e-9;
  out.s = s;
  out.gx = gx / s;
  out.gy = gy / s;
  out.g = Math.hypot(out.gx, out.gy);
  return out;
}

// What the engraving shows: the tones with the tuner, bow and finger where the plate's answer is.
function targetTones(spec, modes) {
  const tones = [[modes, coefficients(spec, modes, spec.target, answerHandle(spec, modes), true, new Float64Array(modes.length))]];
  if (spec.drone !== undefined) tones.push([modes, coefficients(spec, modes, spec.droneDrive, null, true, new Float64Array(modes.length))]);
  return tones;
}

// Where the bow or finger has to be. Searched once per plate (bots and the check use it too).
export function answerHandle(spec, modes = modeList(spec)) {
  if (!spec.handle) return null;
  if (spec.answer) return spec.answer;
  if (spec.answerAt) return (spec.answer = spec.answerAt);
  // The intended shape alone: the one mode (or one shape of a pair) the plate names.
  const wanted = modes.find(mode => mode.id === spec.mode && mode.part === (spec.which ?? 0));
  const others = modes.filter(mode => mode !== wanted && Math.abs(mode.d - spec.target) < 0.06);
  const shape = SHAPES[spec.shape];
  let best = null;
  for (let j = 2; j <= 38; j++) {
    for (let i = 2; i <= 38; i++) {
      const x = i / 40;
      const y = j / 40;
      if (!shape.inside(x, y)) continue;
      const own = Math.abs(wanted.f(x, y));
      const rival = Math.max(0, ...others.map(mode => Math.abs(mode.f(x, y))));
      // A bow wants the wanted shape loud and the rival silent; a finger wants the reverse.
      const score = spec.handle === 'bow' ? own - 1.5 * rival : rival - 2 * own;
      if (!best || score > best.score + 1e-9) best = { score, x, y };
    }
  }
  spec.answer = [best.x, best.y];
  return spec.answer;
}

function compileSpec(spec) {
  if (spec.compiled) return spec.compiled;
  const modes = modeList(spec);
  const tones = targetTones(spec, modes);
  const inside = SHAPES[spec.shape].inside;
  const one = { a: 0, dx: 0, dy: 0 };
  const local = { s: 0, gx: 0, gy: 0, g: 0 };
  let peak = 0;
  for (let j = 0; j <= 80; j++) {
    for (let i = 0; i <= 80; i++) {
      if (!inside(i / 80, j / 80)) continue;
      peak = Math.max(peak, strength(tones, i / 80, j / 80, one, local).s);
    }
  }
  // Print cells: the cells a target line passes through. Antinode cells: where fine powder heaps.
  const cells = [];
  const crests = [];
  const cell = 1 / COVERAGE_GRID;
  for (let row = 0; row < COVERAGE_GRID; row++) {
    for (let col = 0; col < COVERAGE_GRID; col++) {
      let near = Infinity;
      let top = 0;
      let insideCount = 0;
      for (let a = 0; a <= 4; a++) {
        for (let b = 0; b <= 4; b++) {
          const x = (col + 0.05 + 0.225 * a) * cell;
          const y = (row + 0.05 + 0.225 * b) * cell;
          if (!inside(x, y)) continue;
          insideCount++;
          strength(tones, x, y, one, local);
          near = Math.min(near, local.s / (local.g + 0.03));
          top = Math.max(top, local.s / peak);
        }
      }
      if (insideCount >= 6 && near < 0.3 * cell) cells.push([col, row]);
      if (insideCount >= 6 && top > 0.93) crests.push([col, row]);
    }
  }
  spec.compiled = { modes, tones, peak, cells, crests, inside };
  return spec.compiled;
}

export function specOf(state) {
  return state.spec;
}

export function createPlate(level, seed = 1) {
  const spec = typeof level === 'object' ? level : LEVELS[level - 1];
  if (!spec) throw new RangeError('Unknown plate');
  if (spec.kind === 'classic') {
    const state = createClassic(spec.level, seed);
    Object.defineProperty(state, 'spec', { value: spec, enumerable: false });
    return state;
  }
  const { inside } = compileSpec(spec);
  const state = {
    level: spec.level ?? 0, seed: seed >>> 0, grains: [], progress: 0, match: 0, won: false, t: 0, frames: 0,
    lastStirDrive: null, stirring: 0, handle: spec.handle ? (spec.start ? [...spec.start] : defaultHandle(spec)) : null,
    caught: false, lastDrive: null, ringing: 0, lost: 0, failed: false, salt: 1, powderMatch: 1, saltMatch: 0,
  };
  if (spec.handle === 'damp') state.handle = null;
  Object.defineProperty(state, 'spec', { value: spec, enumerable: false });
  const count = GRAIN_COUNT + (spec.powder ? POWDER_COUNT : 0);
  for (let index = 0; index < count; index++) {
    let x;
    let y;
    do {
      x = 0.002 + 0.996 * random(state);
      y = 0.002 + 0.996 * random(state);
    } while (!inside(x, y));
    state.grains.push(index < GRAIN_COUNT ? { x, y } : { x, y, powder: true });
  }
  if (spec.shake) {
    // The order grains leave the plate in, fixed by the seed.
    state.order = state.grains.map((_, index) => index).filter(index => index < GRAIN_COUNT);
    for (let i = state.order.length - 1; i > 0; i--) {
      const j = Math.floor(random(state) * (i + 1));
      [state.order[i], state.order[j]] = [state.order[j], state.order[i]];
    }
  }
  if (!spec.free) measureModal(state, spec);
  return state;
}

function defaultHandle(spec) {
  return spec.shape === 'disk' ? [0.9, 0.5] : [0.15, 0.15];
}

// Place the bow or the finger (clamped onto the plate). null lifts the finger.
export function setHandle(state, x, y) {
  const spec = state.spec;
  if (!spec.handle && !spec.free) return state;
  if (x === null) {
    if (spec.handle === 'damp') state.handle = null;
    return state;
  }
  const { inside } = spec.compiled ?? compileSpec(spec);
  x = Math.max(0.01, Math.min(0.99, x));
  y = Math.max(0.01, Math.min(0.99, y));
  // Pull a point outside the outline toward the centre until it is on the plate.
  for (let step = 0; step < 50 && !inside(x, y); step++) {
    x += (0.5 - x) * 0.08;
    y += (0.5 - y) * 0.08;
  }
  state.handle = [x, y];
  return state;
}

function measureModal(state, spec) {
  const { tones, peak, cells, crests } = spec.compiled;
  const one = { a: 0, dx: 0, dy: 0 };
  const local = { s: 0, gx: 0, gy: 0, g: 0 };
  const tolerance = spec.tolerance ?? 0.017;
  const occupied = new Uint32Array(COVERAGE_GRID);
  const dusted = new Uint32Array(COVERAGE_GRID);
  let sum = 0;
  let powder = 0;
  let powderCount = 0;
  const total = GRAIN_COUNT;
  for (const grain of state.grains) {
    if (grain.gone) continue;
    strength(tones, grain.x, grain.y, one, local);
    const col = Math.min(COVERAGE_GRID - 1, Math.floor(grain.x * COVERAGE_GRID));
    const row = Math.min(COVERAGE_GRID - 1, Math.floor(grain.y * COVERAGE_GRID));
    if (grain.powder) {
      powderCount++;
      const height = local.s / peak;
      powder += Math.min(1, Math.max(0, (height - 0.72) / 0.2));
      if (height > 0.85) dusted[row] |= 1 << col;
      continue;
    }
    const distance = local.s / (local.g + 0.03);
    sum += Math.max(0, 1 - (distance / tolerance) ** 2);
    if (distance < tolerance) occupied[row] |= 1 << col;
  }
  state.saltMatch = Math.min(sum / total, coverCells(cells, occupied));
  state.match = state.saltMatch;
  if (spec.powder) {
    state.powderMatch = Math.min(powder / Math.max(1, powderCount), coverCells(crests, dusted));
    state.match = Math.min(state.saltMatch, state.powderMatch);
  }
  return state.match;
}

function tickModal(state, drive) {
  const spec = state.spec;
  if (state.won || state.failed) return state;
  state.frames++;
  state.t = state.frames * STEP;
  if (drive === null) {
    state.progress = 0;
    state.lastDrive = null;
    return state;
  }
  const { modes, inside } = spec.compiled;
  // A stiff plate's tone bends upward as it grows (a hardening spring): the loud branch is caught
  // only by sliding up into it from below. A jump onto the pitch lands on the quiet branch.
  if (spec.stiff) {
    const jump = state.lastDrive === null ? 1 : Math.abs(drive - state.lastDrive);
    const below = drive < spec.target - 0.035;
    const band = drive >= spec.target - 0.1 && drive <= spec.target + 0.03;
    if (!band || jump > 0.06) state.caught = false;
    if (band && jump <= 0.06 && state.lastDrive !== null && state.lastDrive < spec.target - 0.035 && !below) state.caught = true;
  }
  state.lastDrive = drive;
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
  state.c ??= new Float64Array(modes.length);
  state.cDrone ??= new Float64Array(modes.length);
  const tones = [[modes, coefficients(spec, modes, drive, state.handle, state.caught, state.c)]];
  if (spec.drone !== undefined) tones.push([modes, coefficients(spec, modes, spec.droneDrive, null, true, state.cDrone)]);
  const one = { a: 0, dx: 0, dy: 0 };
  const local = { s: 0, gx: 0, gy: 0, g: 0 };

  for (const grain of state.grains) {
    if (grain.gone) continue;
    strength(tones, grain.x, grain.y, one, local);
    const { s, gx, gy, g } = local;
    const px = grain.x;
    const py = grain.y;
    let dx;
    let dy;
    if (grain.powder) {
      // Fine powder is carried by the air the plate stirs, toward the loudest places (antinodes).
      const travel = Math.min(0.006, g * 0.0016);
      const scatter = 0.0004 + 0.002 * Math.max(0, 1 - s * 3);
      dx = travel * gx / (g + 0.001) + scatter * (random(state) - 0.5);
      dy = travel * gy / (g + 0.001) + scatter * (random(state) - 0.5);
    } else {
      // Salt bounces off the moving places and comes to rest where the plate is still (nodes).
      const distance = s / (g + 0.3);
      const travel = Math.min(0.0095, distance * 0.38);
      const scatter = Math.min(0.005, distance * 0.05) + 0.00035;
      dx = -travel * gx / (g + 0.001) + scatter * (random(state) - 0.5);
      dy = -travel * gy / (g + 0.001) + scatter * (random(state) - 0.5);
    }
    grain.x += dx;
    grain.y += dy;
    if (state.stirring > 0) {
      grain.x += grain.stirX;
      grain.y += grain.stirY;
      grain.stirX *= 0.91;
      grain.stirY *= 0.91;
    }
    if (!inside(grain.x, grain.y) || grain.x <= 0 || grain.x >= 1 || grain.y <= 0 || grain.y >= 1) {
      grain.x = px;
      grain.y = py;
      if (state.stirring > 0) {
        grain.stirX = -grain.stirX;
        grain.stirY = -grain.stirY;
      }
    }
  }
  if (state.stirring > 0) state.stirring--;

  // A long loud ring throws the salt off the plate, a little at a time after a grace period.
  if (spec.shake) {
    state.ringing += STEP;
    const { grace, span } = spec.shake;
    const leaving = Math.floor(state.order.length * Math.min(1, Math.max(0, (state.ringing - grace) / span)));
    while (state.lost < leaving) {
      const grain = state.grains[state.order[state.lost]];
      grain.gone = true;
      grain.goneAt = state.t;
      state.lost++;
    }
    state.salt = 1 - state.lost / state.order.length;
  }
  if (spec.free) return state;
  measureModal(state, spec);

  if (state.match >= spec.threshold) {
    state.progress = Math.min(1, state.progress + STEP / spec.hold);
  } else {
    state.progress = 0;
  }
  state.won = state.progress >= 1;
  // Too little salt left to fill the print: the plate has to be salted again.
  if (!state.won && spec.shake && state.salt < spec.threshold) state.failed = true;
  return state;
}

export function tick(state, drive = null) {
  if (state.spec?.kind === 'classic' || !state.spec) return tickClassic(state, drive);
  return tickModal(state, drive);
}

// The signed field of one tone, for drawing: which 0 is the plate's answer, 1 the drone.
export function toneField(spec, which, x, y) {
  if (spec.kind === 'classic') return field(spec.level, spec.target, x, y);
  const { tones } = compileSpec(spec);
  const tone = tones[which];
  if (!tone) return 0;
  return probe(tone[0], tone[1], x, y, { a: 0, dx: 0, dy: 0 }).a;
}

// The live field, for drawing the plate's shimmer and for free play.
export function liveStrength(state, drive, x, y) {
  const spec = state.spec;
  if (spec.kind === 'classic') return Math.abs(field(spec.level, drive, x, y));
  const { modes } = spec.compiled;
  state.cView ??= new Float64Array(modes.length);
  coefficients(spec, modes, drive, state.handle, state.caught, state.cView);
  return Math.abs(probe(modes, state.cView, x, y, { a: 0, dx: 0, dy: 0 }).a);
}

// Places the fine powder should heap (antinode crests) and the spots two tones leave still.
export function marks(spec) {
  if (spec.kind === 'classic') return { crests: [], spots: [] };
  const { tones, peak, inside } = compileSpec(spec);
  const one = { a: 0, dx: 0, dy: 0 };
  const local = { s: 0, gx: 0, gy: 0, g: 0 };
  const n = 120;
  const grid = new Float64Array((n + 1) * (n + 1));
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
    grid[j * (n + 1) + i] = inside(i / n, j / n) ? strength(tones, i / n, j / n, one, local).s : NaN;
  }
  const crests = [];
  const spots = [];
  for (let j = 1; j < n; j++) for (let i = 1; i < n; i++) {
    const value = grid[j * (n + 1) + i];
    if (Number.isNaN(value)) continue;
    let max = true;
    let min = true;
    for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) {
      if (!a && !b) continue;
      const other = grid[Math.min(n, Math.max(0, j + b)) * (n + 1) + Math.min(n, Math.max(0, i + a))];
      if (Number.isNaN(other)) { max = max && value / peak > 0.97; continue; }
      if (other > value) max = false;
      if (other < value) min = false;
    }
    if (spec.powder && max && value / peak > 0.9) crests.push([i / n, j / n]);
    if (spec.drone !== undefined && min && value / peak < 0.06) spots.push([i / n, j / n]);
  }
  const dedupe = list => list.filter(([x, y], index) => !list.slice(0, index).some(([u, v]) => Math.hypot(u - x, v - y) < 0.05));
  return { crests: dedupe(crests), spots: dedupe(spots) };
}

// Free play: any shape, any pitch, the bow where you put it.
export function freeSpec(shape) {
  return { kind: 'modal', free: true, shape, mode: SHAPES[shape].modes[0].id, target: 0, threshold: 2, hold: 1, id: 'free-' + shape, level: 0, handle: null };
}

// The daily figure: a shape and one of its modes, chosen by the date, the same for everyone.
// Left out: the first mode of each shape (too easy), and two violin figures whose salt cannot fill
// the print without a finger (the bots check that every figure in the pool prints).
const NOT_DAILY = new Set(['v-waist', 'v-ring']);
export const DAILY_POOL = [];
for (const shape of Object.keys(SHAPES)) {
  for (const mode of SHAPES[shape].modes.slice(1)) if (!NOT_DAILY.has(mode.id)) DAILY_POOL.push([shape, mode.id]);
}
export function dailySpec(day) {
  let hash = 2166136261;
  for (const char of String(day)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  const [shape, mode] = DAILY_POOL[hash % DAILY_POOL.length];
  return { kind: 'modal', daily: day, shape, mode, target: SHAPES[shape].modes.find(item => item.id === mode).d,
    threshold: 0.85, hold: 0.8, id: 'daily-' + day, level: 0, seed: hash };
}
