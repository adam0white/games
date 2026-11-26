import { PLATES } from './plates.js';

export const WIDTH = 240;
export const HEIGHT = 280;
export const PROOFS = [
  { radius: 32, goal: 0.70 }, { radius: 28, goal: 0.76 },
  { radius: 26, goal: 0.80 }, { radius: 25, goal: 0.82 },
  { radius: 23, goal: 0.84 }, { radius: 22, goal: 0.86 },
];
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const TARGET_HEIGHT = 0.34;
export const DARK_MARK = 0.36;
// Plates 7 on (2026-11-25). A glazed plate is smooth on top: the stick only bites on the flank it climbs, so
// contact comes from the stroke's direction alone. Stone is grit around the specimen: it takes graphite like a
// ridge does, and each grit cell that darkens is a smudge. Plates 1 to 6 have neither and no lead limit, and
// take exactly the old path (bots.mjs holds their pigment hashes from before this change).
const GLAZE_BITE = 2.4;
const STONE_CLEAR = 2;

// A rounded ridge under the paper, swept along an engraved line.
export function ridge(field, a, b, width, height) {
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

// Grit for a stone plate: short pebbles on a jittered grid, only where the stick can pass the specimen without
// touching them (more than its radius plus a margin from any part of the fossil). Seeded by the plate, so the
// stone is the same for every player.
export function stoneField(fossil, radius, seed) {
  const cells = WIDTH * HEIGHT, far = 1e6;
  const near = new Float32Array(cells);
  for (let i = 0; i < cells; i++) near[i] = fossil[i] > 0.02 ? 0 : far;
  // Two-pass chamfer distance to the nearest fossil cell (3-4 weights, in cells).
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
    const i = y * WIDTH + x;
    if (x > 0) near[i] = Math.min(near[i], near[i - 1] + 1);
    if (y > 0) {
      near[i] = Math.min(near[i], near[i - WIDTH] + 1);
      if (x > 0) near[i] = Math.min(near[i], near[i - WIDTH - 1] + 1.4142);
      if (x < WIDTH - 1) near[i] = Math.min(near[i], near[i - WIDTH + 1] + 1.4142);
    }
  }
  for (let y = HEIGHT - 1; y >= 0; y--) for (let x = WIDTH - 1; x >= 0; x--) {
    const i = y * WIDTH + x;
    if (x < WIDTH - 1) near[i] = Math.min(near[i], near[i + 1] + 1);
    if (y < HEIGHT - 1) {
      near[i] = Math.min(near[i], near[i + WIDTH] + 1);
      if (x < WIDTH - 1) near[i] = Math.min(near[i], near[i + WIDTH + 1] + 1.4142);
      if (x > 0) near[i] = Math.min(near[i], near[i + WIDTH - 1] + 1.4142);
    }
  }
  const grit = new Float32Array(cells);
  let n = seed >>> 0;
  const random = () => (n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let gy = 6; gy < HEIGHT - 3; gy += 10) for (let gx = 6; gx < WIDTH - 3; gx += 10) {
    const x = gx + (random() - 0.5) * 7, y = gy + (random() - 0.5) * 7;
    const a = random() * Math.PI, l = 1.5 + random() * 2.5, w = 2.4 + random() * 1.6, h = 0.55 + random() * 0.3;
    const at = Math.round(y) * WIDTH + Math.round(x);
    if (!(near[at] > radius + STONE_CLEAR + l + w / 2 + 0.5)) continue;
    ridge(grit, [x - l * Math.cos(a), y - l * Math.sin(a)], [x + l * Math.cos(a), y + l * Math.sin(a)], w, h);
  }
  return grit;
}

export function createPlate(level = 1, seed = 1) {
  if (!Number.isInteger(level) || !PLATES[level - 1]) throw new RangeError('Unknown plate');
  return createSheet({ ...PLATES[level - 1], ...PROOFS[level - 1] }, seed, level);
}

// A sheet from any plate description: { lines, radius, goal, glaze?, stone? (grit seed), lead? (sheet units of
// stick), smudge? (grit cells allowed to darken), par? }. The daily plate is made this way too.
export function createSheet(spec, seed = 1, level = 0) {
  const cells = WIDTH * HEIGHT;
  const relief = new Float32Array(cells), tooth = new Float32Array(cells);
  const slopeX = new Float32Array(cells), slopeY = new Float32Array(cells);
  for (const { points, width, height } of spec.lines) {
    for (let p = 1; p < points.length; p++) ridge(relief, points[p - 1], points[p], width, height);
  }
  let stone = null, grit = 0;
  if (spec.stone) {
    const field = stoneField(relief, spec.radius, spec.stone);
    stone = new Uint8Array(cells);
    for (let i = 0; i < cells; i++) {
      if (field[i] > relief[i]) relief[i] = field[i];
      if (field[i] >= TARGET_HEIGHT) { stone[i] = 1; grit++; }
    }
  }
  const fossil = i => relief[i] >= TARGET_HEIGHT && !(stone && stone[i]);
  let noise = seed >>> 0, target = 0;
  for (let i = 0; i < cells; i++) {
    noise = (Math.imul(noise, 1664525) + 1013904223) >>> 0;
    tooth[i] = noise / 4294967296;
    if (fossil(i)) target++;
    if (i % WIDTH > 0 && i % WIDTH < WIDTH - 1) slopeX[i] = (relief[i + 1] - relief[i - 1]) / 2;
    if (i >= WIDTH && i < cells - WIDTH) slopeY[i] = (relief[i + WIDTH] - relief[i - WIDTH]) / 2;
  }
  // Score the ends of long, narrow fossils as well as their dense centres.
  // Five strips in each axis cover the actual extents of this specimen.
  let xMin = WIDTH, xMax = 0, yMin = HEIGHT, yMax = 0;
  for (let i = 0; i < cells; i++) {
    if (!fossil(i)) continue;
    const x = i % WIDTH, y = Math.floor(i / WIDTH);
    xMin = Math.min(xMin, x); xMax = Math.max(xMax, x);
    yMin = Math.min(yMin, y); yMax = Math.max(yMax, y);
  }
  const band = (position, min, max) => clamp(Math.floor(5 * (position - min) / (max - min + 1)), 0, 4);
  const column = Uint8Array.from({ length: WIDTH }, (_, x) => band(x, xMin, xMax));
  const row = Uint8Array.from({ length: HEIGHT }, (_, y) => 5 + band(y, yMin, yMax));
  const bandTargets = new Uint32Array(10), bandMarks = new Uint32Array(10);
  for (let i = 0; i < cells; i++) {
    if (!fossil(i)) continue;
    bandTargets[column[i % WIDTH]]++;
    bandTargets[row[Math.floor(i / WIDTH)]]++;
  }
  return { width: WIDTH, height: HEIGHT, level, seed, radius: spec.radius, goal: spec.goal,
    glaze: spec.glaze === true, stone, grit, smudge: 0, smudgeLimit: spec.smudge ?? Infinity,
    lead: spec.lead ?? Infinity, par: spec.par ?? Infinity, box: { xMin, xMax, yMin, yMax },
    relief, tooth, slopeX, slopeY, pigment: new Float32Array(cells),
    column, row, bandTargets, bandMarks, target, dark: 0, coverage: 0, distance: 0, done: false, spoiled: null, filedAt: null };
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
  s.smudge = 0;
  s.bandMarks.fill(0);
  for (let i = 0; i < bytes.length; i++) {
    s.pigment[i] = bytes.charCodeAt(i) / 255;
    if (s.relief[i] < TARGET_HEIGHT || s.pigment[i] < DARK_MARK) continue;
    if (s.stone && s.stone[i]) { s.smudge++; continue; }
    s.dark++;
    s.bandMarks[s.column[i % WIDTH]]++;
    s.bandMarks[s.row[Math.floor(i / WIDTH)]]++;
  }
  updateCoverage(s);
  s.done = s.coverage >= s.goal;
  s.spoiled = null;
}

// Stars for a filed print, from the stick used up to the moment of filing: three within par, two within a
// quarter more, one otherwise. A plate with no par gives none.
export function stars(s) {
  if (!s.done || !Number.isFinite(s.par) || s.filedAt === null) return 0;
  return s.filedAt <= s.par ? 3 : s.filedAt <= s.par * 1.25 ? 2 : 1;
}

// Integrate friction along the segment. The charcoal has a broad, soft foot.
// Leading slopes take more of the normal load. Paper can only hold so much
// pigment, so repeatedly scrubbing one rib cannot expose its neighbours.
export function rub(s, x0, y0, x1, y1) {
  if (![x0, y0, x1, y1].every(Number.isFinite)) return;
  if (s.spoiled) return;
  const dx = x1 - x0, dy = y1 - y0, distance = Math.hypot(dx, dy);
  if (!distance) return;
  const steps = Math.ceil(distance / 4), travel = distance / steps;
  const ux = dx / distance, uy = dy / distance, r = s.radius;
  const glaze = s.glaze, stone = s.stone;
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
        const contact = glaze ? clamp(GLAZE_BITE * (ux * s.slopeX[i] + uy * s.slopeY[i]), 0, 1)
          : clamp(h + 0.75 * (ux * s.slopeX[i] + uy * s.slopeY[i]), 0, 1);
        const transfer = (0.055 + 0.90 * contact) * (0.28 + grain * 0.96);
        const old = s.pigment[i];
        const capacity = 0.13 + 0.16 * grain + 0.70 * Math.sqrt(h);
        s.pigment[i] = old + (capacity - old) * Math.min(1, transfer * pressure * travel * 0.12);
        if (h >= TARGET_HEIGHT && old < DARK_MARK && s.pigment[i] >= DARK_MARK) {
          if (stone && stone[i]) { s.smudge++; continue; }
          s.dark++;
          s.bandMarks[s.column[x]]++;
          s.bandMarks[s.row[y]]++;
        }
      }
    }
    s.distance += travel;
    updateCoverage(s);
    if (!s.done && s.coverage >= s.goal) { s.done = true; s.filedAt = s.distance; }
    if (!s.done && s.smudge > s.smudgeLimit) { s.spoiled = 'smudge'; return; }
    if (!s.done && s.distance >= s.lead) { s.spoiled = 'lead'; return; }
  }
}
