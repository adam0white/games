// Pure rules. Coordinates describe the face; rendering never changes a match.
export const DT = 1 / 60;
export const MIN_POSE_TIME = 3;
export const PHOTO_TIME = 0.65;
export const LEVELS = Object.freeze([
  Object.freeze({ count: 3, limit: 20, tolerance: 0.38, hold: 0.7 }),
  Object.freeze({ count: 4, limit: 26, tolerance: 0.25, hold: 0.85 }),
  Object.freeze({ count: 5, limit: 32, tolerance: 0.16, hold: 1 }),
  Object.freeze({ count: 6, limit: 38, tolerance: 0.10, hold: 1.1 }),
]);
const EPSILON = 1e-9;
const clamp = n => Math.max(-1, Math.min(1, Number.isFinite(n) ? n : 0));

function randomGenerator(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let n = Math.imul(value ^ (value >>> 15), value | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

export function create(seed, level = 0, { mutate = false } = {}) {
  if (!Number.isInteger(level) || !LEVELS[level]) throw new RangeError('Unknown level');
  const normalizedSeed = Number(seed) >>> 0;
  const random = randomGenerator(normalizedSeed);
  const targets = Array.from({ length: LEVELS[level].count }, (_, index) => index === 0
    ? { x: 0.55, y: -0.5 }
    : { x: (random() * 1.6) - 0.8, y: (random() * 1.6) - 0.8 });
  return {
    seed: normalizedSeed, level, targets, index: 0, x: 0, y: 0,
    elapsed: 0, age: 0, held: 0, phase: 'play', photoTime: 0, score: 0, shots: [],
    // Explicit fault injection for the acceptance suite; normal games omit it.
    ...(mutate ? { mutate: true } : {}),
  };
}

export function step(state, input = {}, dt = DT) {
  if (!Number.isFinite(dt) || dt < 0) throw new RangeError('dt must be finite and nonnegative');
  const next = { ...state };
  if (state.phase === 'won' || state.phase === 'lost') return next;
  if (state.phase === 'photo') {
    next.photoTime += dt;
    if (next.photoTime + EPSILON >= PHOTO_TIME) {
      if (state.index + 1 === state.targets.length) next.phase = 'won';
      else {
        next.index += 1;
        next.age = 0;
        next.held = 0;
        next.photoTime = 0;
        next.phase = 'play';
      }
    }
    return next;
  }

  const rules = LEVELS[state.level];
  next.x = input.x === undefined ? state.x : clamp(input.x);
  next.y = input.y === undefined ? state.y : clamp(input.y);
  next.elapsed += dt;
  next.age += dt;
  const target = state.targets[state.index];
  const error = Math.max(Math.abs(next.x - target.x), Math.abs(next.y - target.y));
  const matching = Boolean(input.active) && (state.mutate || error <= rules.tolerance + EPSILON);
  next.held = matching ? state.held + dt : 0;
  if (next.elapsed + EPSILON >= rules.limit) {
    next.elapsed = rules.limit;
    next.phase = 'lost';
    next.held = 0;
  } else if (next.age + EPSILON >= MIN_POSE_TIME && next.held + EPSILON >= rules.hold) {
    next.phase = 'photo';
    next.photoTime = 0;
    next.score += 100;
    next.shots = [...state.shots, {
      index: state.index, level: state.level, x: next.x, y: next.y,
      target: { ...target }, elapsed: next.elapsed,
    }];
  }
  return next;
}

// Persistent per-level rating: successful fast exposures earn more stars.
export function starsFor(state) {
  if (state.phase !== "won") return 0;
  const fraction = state.elapsed / LEVELS[state.level].limit;
  return fraction < 0.7 ? 3 : fraction < 0.9 ? 2 : 1;
}
