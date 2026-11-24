// Vertical motion of a string with two fixed ends. A grip sets the static shape
// under a point load. Release lets neighbouring masses exchange momentum.
export const BASE = 250;
export const LEFT = 24;
export const SPACING = 6;
export const COUNT = 53;
export const TICK = 1 / 240;
export const MAX_PULL = 86;
export const cueDepth = level => level === 1 ? 44 : 84;
export const plates = [
  { name: 'Poppy', latin: 'Papaver', zones: [[72, 288]], buds: [[180, 19]] },
  { name: 'Honesty', latin: 'Lunaria', zones: [[73, 125]], buds: [[253, 39]] },
  { name: 'Flax', latin: 'Linum', zones: [[155, 205]], buds: [[126, 34], [234, 34]] },
  { name: 'Milkweed', latin: 'Asclepias', zones: [[72, 114], [246, 288]], buds: [[90, 56], [270, 56]] },
  { name: 'Love-in-a-mist', latin: 'Nigella', zones: [[93, 130], [156, 204], [230, 267]], buds: [[104, 59], [180, 47], [256, 59]] },
  { name: 'Columbine', latin: 'Aquilegia', zones: [[72, 99], [171, 189], [261, 288]], buds: [[83, 62], [142, 48], [218, 48], [277, 62]] },
];

export function create(level = 1, seed = level) {
  const spec = plates[level - 1];
  let randomState = seed >>> 0;
  function random() {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 4294967296;
  }
  const pods = spec.buds.map(([x, height]) => ({
    x: x + (random() - 0.5) * 6,
    height: height + (random() - 0.5) * 3,
    kind: level - 1, open: false, openedAt: null,
  }));
  return { level, seed, zones: spec.zones, pods, u: Array(COUNT).fill(0), v: Array(COUNT).fill(0),
    time: 0, ticks: 0, grip: null, plucks: 0, won: false, ringing: false };
}

export function at(s, x) {
  const n = Math.max(0, Math.min(COUNT - 1, (x - LEFT) / SPACING));
  const i = Math.min(COUNT - 2, Math.floor(n));
  return s.u[i] + (s.u[i + 1] - s.u[i]) * (n - i);
}

export function grab(s, x, y) {
  if (s.grip || s.won || !Number.isFinite(y) ||
      !s.zones.some(([a, b]) => x >= a && x <= b) ||
      Math.abs(y - BASE - at(s, x)) > 29) return false;
  const i = Math.round((x - LEFT) / SPACING);
  s.grip = { i, y, start: s.u[i], depth: 0, oldU: s.u.slice(), oldV: s.v.slice() };
  return true;
}

export function pull(s, y) {
  const g = s.grip;
  if (!g || !Number.isFinite(y)) return;
  g.depth = Math.max(0, Math.min(MAX_PULL, y - g.y + g.start));
  for (let i = 0; i < COUNT; i++) {
    const slope = i <= g.i ? i / g.i : (COUNT - 1 - i) / (COUNT - 1 - g.i);
    s.u[i] = slope * g.depth;
    s.v[i] = 0;
  }
}

export function cancel(s) {
  if (!s.grip) return;
  s.u = s.grip.oldU;
  s.v = s.grip.oldV;
  s.grip = null;
}

export function release(s) {
  if (!s.grip) return false;
  if (s.grip.depth < 5) { cancel(s); return false; }
  s.grip = null;
  s.plucks++;
  s.ringing = true;
  return true;
}

const SPEED = 67; // Nodes per second; a pulse crosses the wire in 0.78 seconds.
const DRAG = Math.exp(-0.58 * TICK);
export function tick(s) {
  s.time = ++s.ticks * TICK;
  if (!s.ringing || s.grip) return;
  let movement = 0;
  for (let i = 1; i < COUNT - 1; i++) {
    const curvature = s.u[i - 1] + s.u[i + 1] - 2 * s.u[i];
    s.v[i] = DRAG * (s.v[i] + curvature * SPEED ** 2 * TICK);
  }
  for (let i = 1; i < COUNT - 1; i++) {
    s.u[i] += s.v[i] * TICK;
    movement = Math.max(movement, Math.abs(s.v[i]), Math.abs(s.u[i]));
  }
  for (const pod of s.pods) {
    if (!pod.open && -at(s, pod.x) >= pod.height) {
      pod.open = true;
      pod.openedAt = s.time;
    }
  }
  s.won = s.pods.every(p => p.open);
  if (movement < 0.15) {
    s.u.fill(0);
    s.v.fill(0);
    s.ringing = false;
  }
}
