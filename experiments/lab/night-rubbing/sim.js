import { PLATES } from './plates.js';

export const WIDTH = 240;
export const HEIGHT = 280;
const PROOFS = [
  { radius: 32, goal: 0.70 }, { radius: 28, goal: 0.76 },
  { radius: 26, goal: 0.80 }, { radius: 25, goal: 0.82 },
  { radius: 23, goal: 0.84 }, { radius: 22, goal: 0.86 },
];
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const TARGET_HEIGHT = 0.34;
const DARK_MARK = 0.36;

// A rounded ridge under the paper, swept along an engraved line.
function ridge(field, a, b, width, height) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const length2 = dx * dx + dy * dy;
  const radius = width / 2 + 0.45;
  const left = Math.max(0, Math.floor(Math.min(a[0], b[0]) - radius));
  const right = Math.min(WIDTH - 1, Math.ceil(Math.max(a[0], b[0]) + radius));
  const top = Math.max(0, Math.floor(Math.min(a[1], b[1]) - radius));
  const bottom = Math.min(HEIGHT - 1, Math.ceil(Math.max(a[1], b[1]) + radius));
  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) {
      const along = length2 ? clamp(((x - a[0]) * dx + (y - a[1]) * dy) / length2, 0, 1) : 0;
      const d = Math.hypot(x - a[0] - along * dx, y - a[1] - along * dy);
      const h = height * Math.max(0, 1 - (d / radius) ** 2);
      const i = y * WIDTH + x;
      field[i] = Math.max(field[i], h);
    }
  }
}

export function createPlate(level = 1, seed = 1) {
  if (!Number.isInteger(level) || !PROOFS[level - 1]) throw new RangeError('Unknown plate');
  const cells = WIDTH * HEIGHT;
  const relief = new Float32Array(cells), tooth = new Float32Array(cells);
  const slopeX = new Float32Array(cells), slopeY = new Float32Array(cells);
  for (const { points, width, height } of PLATES[level - 1].lines) {
    for (let p = 1; p < points.length; p++) ridge(relief, points[p - 1], points[p], width, height);
  }
  let noise = seed >>> 0, target = 0;
  for (let i = 0; i < cells; i++) {
    noise = (Math.imul(noise, 1664525) + 1013904223) >>> 0;
    tooth[i] = noise / 4294967296;
    if (relief[i] >= TARGET_HEIGHT) target++;
    if (i % WIDTH > 0 && i % WIDTH < WIDTH - 1) slopeX[i] = (relief[i + 1] - relief[i - 1]) / 2;
    if (i >= WIDTH && i < cells - WIDTH) slopeY[i] = (relief[i + WIDTH] - relief[i - WIDTH]) / 2;
  }
  // Score the ends of long, narrow fossils as well as their dense centres.
  // Five strips in each axis cover the actual extents of this specimen.
  let xMin = WIDTH, xMax = 0, yMin = HEIGHT, yMax = 0;
  for (let i = 0; i < cells; i++) {
    if (relief[i] < TARGET_HEIGHT) continue;
    const x = i % WIDTH, y = Math.floor(i / WIDTH);
    xMin = Math.min(xMin, x); xMax = Math.max(xMax, x);
    yMin = Math.min(yMin, y); yMax = Math.max(yMax, y);
  }
  const band = (position, min, max) => clamp(Math.floor(5 * (position - min) / (max - min + 1)), 0, 4);
  const column = Uint8Array.from({ length: WIDTH }, (_, x) => band(x, xMin, xMax));
  const row = Uint8Array.from({ length: HEIGHT }, (_, y) => 5 + band(y, yMin, yMax));
  const bandTargets = new Uint32Array(10), bandMarks = new Uint32Array(10);
  for (let i = 0; i < cells; i++) {
    if (relief[i] < TARGET_HEIGHT) continue;
    bandTargets[column[i % WIDTH]]++;
    bandTargets[row[Math.floor(i / WIDTH)]]++;
  }
  return { width: WIDTH, height: HEIGHT, level, seed, ...PROOFS[level - 1],
    relief, tooth, slopeX, slopeY, pigment: new Float32Array(cells),
    column, row, bandTargets, bandMarks, target, dark: 0, coverage: 0, distance: 0, done: false };
}

function updateCoverage(s) {
  let leastCovered = 1;
  for (let i = 0; i < s.bandTargets.length; i++) {
    if (s.bandTargets[i]) leastCovered = Math.min(leastCovered, s.bandMarks[i] / s.bandTargets[i]);
  }
  s.coverage = 0.40 * s.dark / s.target + 0.60 * leastCovered;
}

// Restore a filed print onto a fresh plate. Round towards the nearest byte
// on the same side of the dark-mark threshold, so reloading cannot award or
// revoke a mark. Each byte uses the player's own local deposition.
export function pigmentByte(value) {
  const byte = Math.round(255 * value), threshold = Math.ceil(255 * DARK_MARK);
  return value < DARK_MARK ? Math.min(threshold - 1, byte) : Math.max(threshold, byte);
}

export function loadPigment(s, bytes) {
  s.dark = 0;
  s.bandMarks.fill(0);
  for (let i = 0; i < bytes.length; i++) {
    s.pigment[i] = bytes.charCodeAt(i) / 255;
    if (s.relief[i] < TARGET_HEIGHT || s.pigment[i] < DARK_MARK) continue;
    s.dark++;
    s.bandMarks[s.column[i % WIDTH]]++;
    s.bandMarks[s.row[Math.floor(i / WIDTH)]]++;
  }
  updateCoverage(s);
  s.done = s.coverage >= s.goal;
}

// Integrate friction along the segment. The charcoal has a broad, soft foot.
// Leading slopes take more of the normal load. Paper can only hold so much
// pigment, so repeatedly scrubbing one rib cannot expose its neighbours.
export function rub(s, x0, y0, x1, y1) {
  if (![x0, y0, x1, y1].every(Number.isFinite)) return;
  const dx = x1 - x0, dy = y1 - y0, distance = Math.hypot(dx, dy);
  if (!distance) return;
  const steps = Math.ceil(distance / 4), travel = distance / steps;
  const ux = dx / distance, uy = dy / distance, r = s.radius;
  for (let k = 0; k < steps; k++) {
    const cx = x0 + dx * (k + 0.5) / steps, cy = y0 + dy * (k + 0.5) / steps;
    const left = Math.max(0, Math.ceil(cx - r)), right = Math.min(WIDTH - 1, Math.floor(cx + r));
    const top = Math.max(0, Math.ceil(cy - r)), bottom = Math.min(HEIGHT - 1, Math.floor(cy + r));
    for (let y = top; y <= bottom; y++) {
      for (let x = left; x <= right; x++) {
        const pressure = 1 - ((x - cx) ** 2 + (y - cy) ** 2) / (r * r);
        if (pressure <= 0) continue;
        const i = y * WIDTH + x;
        const h = s.relief[i], grain = s.tooth[i];
        const contact = clamp(h + 0.75 * (ux * s.slopeX[i] + uy * s.slopeY[i]), 0, 1);
        const transfer = (0.055 + 0.90 * contact) * (0.28 + grain * 0.96);
        const old = s.pigment[i];
        const capacity = 0.13 + 0.16 * grain + 0.70 * Math.sqrt(h);
        s.pigment[i] = old + (capacity - old) * Math.min(1, transfer * pressure * travel * 0.12);
        if (h >= TARGET_HEIGHT && old < DARK_MARK && s.pigment[i] >= DARK_MARK) {
          s.dark++;
          s.bandMarks[s.column[x]]++;
          s.bandMarks[s.row[y]]++;
        }
      }
    }
    s.distance += travel;
    updateCoverage(s);
    s.done ||= s.coverage >= s.goal;
  }
}
