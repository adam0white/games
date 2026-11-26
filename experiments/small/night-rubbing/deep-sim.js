// The deeper sheet (2026-11-26): the same paper, relief and transfer law as sim.js, with four additions that make a
// plate ask for more than one sweep.
// - Pressure comes from the speed of the stroke. A slow, firm stroke presses (up to 1.15); a scribble skates (down to
//   0.04). Pigment laid per second peaks at a steady middle pace, so scrubbing fast is the slow way to a print.
// - Heavy pressure pushes the paper into the hollows too: flat paper darkens with the cube of pressure, which
//   muddies the print (lower contrast).
// - Paper wears where the crayon presses on relief, by the cube of pressure. A cell worn through tears: it holds no
//   pigment and stays a hole in the print.
// - Finds (finds.js) are hidden in the matrix round the specimen. Each has its own count; it is found when enough of
//   its raised cells are marked.
// The specimen's own cells, bands and coverage are counted exactly as in sim.js, so a print filed by the classic
// page loads here with the same coverage (when the plate has no grit; grit avoids the finds and moves a little).
import { WIDTH, HEIGHT, TARGET_HEIGHT, DARK_MARK, ridge, stoneField } from './sim.js';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const GLAZE_BITE = 2.4;
export const FOUND_AT = 0.55;
// Pressure from speed in sheet units a second: 1.15 at 100 or slower, 1 at about 150, 0.04 at 506 or faster.
export const pressureAt = speed => clamp((520 - speed) / 350, 0.04, 1.15);
const WEAR = 0.004, TEAR = 1;

// Where the finds sit: seeded by the plate, far enough from the specimen that rubbing the specimen does not bring
// them up by accident, inside the sheet, apart from each other.
function place(main, finds, seed, radius) {
  const cells = WIDTH * HEIGHT, far = 1e6, near = new Float32Array(cells);
  for (let i = 0; i < cells; i++) near[i] = main[i] > 0.02 ? 0 : far;
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
    const i = y * WIDTH + x;
    if (x > 0) near[i] = Math.min(near[i], near[i - 1] + 1);
    if (y > 0) near[i] = Math.min(near[i], near[i - WIDTH] + 1);
  }
  for (let y = HEIGHT - 1; y >= 0; y--) for (let x = WIDTH - 1; x >= 0; x--) {
    const i = y * WIDTH + x;
    if (x < WIDTH - 1) near[i] = Math.min(near[i], near[i + 1] + 1);
    if (y < HEIGHT - 1) near[i] = Math.min(near[i], near[i + WIDTH] + 1);
  }
  let n = (seed ^ 0x9e3779b9) >>> 0;
  const random = () => (n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296;
  const spots = [];
  for (const find of finds) {
    let best = null;
    for (let attempt = 0; attempt < 400; attempt++) {
      const x = 22 + random() * (WIDTH - 44), y = 22 + random() * (HEIGHT - 44);
      const clear = near[Math.round(y) * WIDTH + Math.round(x)];
      const apart = Math.min(Infinity, ...spots.map(p => Math.hypot(p.x - x, p.y - y)));
      // Prefer a spot clear of the specimen by about a crayon width, not too far out in a corner.
      const score = Math.min(clear - 16 - radius * 0.4, 30) + Math.min(apart - 40, 20) - Math.hypot(x - 120, y - 140) * 0.05;
      if (!best || score > best.score) best = { x, y, score, angle: (random() - 0.5) * 1.2 };
    }
    spots.push(best);
  }
  return spots;
}

// spec: { lines, radius, goal, glaze?, stone?, smudge? }, finds: [{ id, lines }].
export function createDeep(spec, seed = 1, level = 0, finds = []) {
  const cells = WIDTH * HEIGHT;
  const main = new Float32Array(cells), relief = new Float32Array(cells), tooth = new Float32Array(cells);
  const slopeX = new Float32Array(cells), slopeY = new Float32Array(cells);
  for (const { points, width, height } of spec.lines) for (let p = 1; p < points.length; p++) ridge(main, points[p - 1], points[p], width, height);
  relief.set(main);
  const spots = place(main, finds, (seed + level * 7919) >>> 0, spec.radius);
  const findOf = new Uint8Array(cells), findTargets = new Uint32Array(finds.length), findMarks = new Uint32Array(finds.length);
  finds.forEach((find, k) => {
    const own = new Float32Array(cells), { x, y, angle } = spots[k], c = Math.cos(angle), s = Math.sin(angle);
    const at = ([px, py]) => [x + px * c - py * s, y + px * s + py * c];
    for (const { points, width, height } of find.lines) for (let p = 1; p < points.length; p++) ridge(own, at(points[p - 1]), at(points[p]), width, height);
    for (let i = 0; i < cells; i++) if (own[i] > relief[i]) { relief[i] = own[i]; if (own[i] >= TARGET_HEIGHT && main[i] < TARGET_HEIGHT) findOf[i] = k + 1; }
  });
  let stone = null;
  if (spec.stone) {
    const field = stoneField(relief, spec.radius, spec.stone);
    stone = new Uint8Array(cells);
    for (let i = 0; i < cells; i++) {
      if (field[i] > relief[i]) relief[i] = field[i];
      if (field[i] >= TARGET_HEIGHT && !findOf[i]) stone[i] = 1;
    }
  }
  const fossil = i => main[i] >= TARGET_HEIGHT && !(stone && stone[i]);
  let noise = seed >>> 0, target = 0;
  for (let i = 0; i < cells; i++) {
    noise = (Math.imul(noise, 1664525) + 1013904223) >>> 0;
    tooth[i] = noise / 4294967296;
    if (fossil(i)) target++;
    if (findOf[i]) findTargets[findOf[i] - 1]++;
    if (i % WIDTH > 0 && i % WIDTH < WIDTH - 1) slopeX[i] = (relief[i + 1] - relief[i - 1]) / 2;
    if (i >= WIDTH && i < cells - WIDTH) slopeY[i] = (relief[i + WIDTH] - relief[i - WIDTH]) / 2;
  }
  let xMin = WIDTH, xMax = 0, yMin = HEIGHT, yMax = 0;
  for (let i = 0; i < cells; i++) {
    if (!fossil(i)) continue;
    const x = i % WIDTH, y = Math.floor(i / WIDTH);
    xMin = Math.min(xMin, x); xMax = Math.max(xMax, x); yMin = Math.min(yMin, y); yMax = Math.max(yMax, y);
  }
  const band = (position, min, max) => clamp(Math.floor(5 * (position - min) / (max - min + 1)), 0, 4);
  const column = Uint8Array.from({ length: WIDTH }, (_, x) => band(x, xMin, xMax));
  const row = Uint8Array.from({ length: HEIGHT }, (_, y) => 5 + band(y, yMin, yMax));
  const bandTargets = new Uint32Array(10), bandMarks = new Float64Array(10), isMain = new Uint8Array(cells);
  for (let i = 0; i < cells; i++) {
    if (!fossil(i)) continue;
    isMain[i] = 1;
    bandTargets[column[i % WIDTH]]++;
    bandTargets[row[Math.floor(i / WIDTH)]]++;
  }
  return { width: WIDTH, height: HEIGHT, level, seed, radius: spec.radius, goal: spec.goal, glaze: spec.glaze === true,
    stone, smudge: 0, smudgeLimit: spec.smudge ?? Infinity, box: { xMin, xMax, yMin, yMax },
    main, relief, tooth, slopeX, slopeY, isMain, findOf, finds: finds.map((f, k) => ({ id: f.id, ...spots[k] })),
    findTargets, findMarks, found: finds.map(() => false), pigment: new Float32Array(cells), wear: new Float32Array(cells),
    torn: new Uint8Array(cells), tears: 0, touched: new Uint8Array(cells), touchedCount: 0,
    column, row, bandTargets, bandMarks, target, dark: 0, coverage: 0, distance: 0, time: 0, done: false, filedAt: null };
}

function updateCoverage(s) {
  let least = 1;
  for (let i = 0; i < 10; i++) if (s.bandTargets[i]) least = Math.min(least, s.bandMarks[i] / s.bandTargets[i]);
  s.coverage = 0.40 * s.dark / s.target + 0.60 * least;
}

// A specimen cell counts whole once it is dark (as in sim.js) and a little before: half credit at most, growing with
// the square of its pigment, so the meter moves with every stroke. A cell's credit only rises, except when it tears.
export const credit = p => p >= DARK_MARK ? 1 : 0.5 * (p / DARK_MARK) ** 2;
function recredit(s, i, x, y, before, after) {
  const d = credit(after) - credit(before);
  if (!d) return;
  s.dark += d; s.bandMarks[s.column[x]] += d; s.bandMarks[s.row[y]] += d;
}
function count(s, i) {
  const f = s.findOf[i];
  if (f) { s.findMarks[f - 1]++; return; }
  if (s.stone && s.stone[i]) s.smudge++;
}

// Load a stored print (bytes of pigment, as sim.js pigmentByte writes them).
export function loadDeep(s, bytes) {
  s.dark = 0; s.smudge = 0; s.bandMarks.fill(0); s.findMarks.fill(0);
  for (let i = 0; i < bytes.length; i++) {
    s.pigment[i] = bytes.charCodeAt(i) / 255;
    if (s.pigment[i] > 0.02 && !s.touched[i]) { s.touched[i] = 1; s.touchedCount++; }
    if (s.isMain[i]) recredit(s, i, i % WIDTH, Math.floor(i / WIDTH), 0, s.pigment[i]);
    else if (s.relief[i] >= TARGET_HEIGHT && s.pigment[i] >= DARK_MARK) count(s, i);
  }
  updateCoverage(s);
  s.found = s.found.map((_, k) => s.findMarks[k] >= FOUND_AT * s.findTargets[k]);
  s.done = s.coverage >= s.goal;
}

// Rub from (x0, y0) to (x1, y1) at a speed in sheet units a second. Returns what happened along the way:
// { found: [find indexes found], tore: cells torn, bumps: relief edges the crayon's centre crossed }.
export function press(s, x0, y0, x1, y1, speed) {
  const out = { found: [], tore: 0, bumps: 0 };
  if (![x0, y0, x1, y1, speed].every(Number.isFinite)) return out;
  const dx = x1 - x0, dy = y1 - y0, distance = Math.hypot(dx, dy);
  if (!distance) return out;
  const P = pressureAt(speed), flat = 3 * P * P * P, steps = Math.ceil(distance / 4), travel = distance / steps;
  const ux = dx / distance, uy = dy / distance, r = s.radius, glaze = s.glaze;
  let wasHigh = s.relief[clamp(Math.round(y0), 0, HEIGHT - 1) * WIDTH + clamp(Math.round(x0), 0, WIDTH - 1)] >= 0.3;
  for (let k = 0; k < steps; k++) {
    const cx = x0 + dx * (k + 0.5) / steps, cy = y0 + dy * (k + 0.5) / steps;
    const high = s.relief[clamp(Math.round(cy), 0, HEIGHT - 1) * WIDTH + clamp(Math.round(cx), 0, WIDTH - 1)] >= 0.3;
    if (high && !wasHigh) out.bumps++;
    wasHigh = high;
    const left = Math.max(0, Math.ceil(cx - r)), right = Math.min(WIDTH - 1, Math.floor(cx + r));
    const top = Math.max(0, Math.ceil(cy - r)), bottom = Math.min(HEIGHT - 1, Math.floor(cy + r));
    for (let y = top; y <= bottom; y++) {
      for (let x = left; x <= right; x++) {
        const radial = 1 - ((x - cx) ** 2 + (y - cy) ** 2) / (r * r);
        if (radial <= 0) continue;
        const i = y * WIDTH + x;
        if (s.torn[i]) continue;
        const h = s.relief[i], grain = s.tooth[i];
        const lean = ux * s.slopeX[i] + uy * s.slopeY[i];
        const contact = glaze ? clamp(GLAZE_BITE * lean, 0, 1) : clamp(h + 0.75 * lean, 0, 1);
        const transfer = (0.055 * flat + 0.90 * contact * P) * (0.28 + grain * 0.96);
        const old = s.pigment[i];
        const capacity = 0.13 + 0.16 * grain + 0.70 * Math.sqrt(h);
        s.pigment[i] = old + (capacity - old) * Math.min(1, transfer * radial * travel * 0.12 * 0.34);
        if (!s.touched[i]) { s.touched[i] = 1; s.touchedCount++; }
        if (s.isMain[i]) recredit(s, i, x, y, old, s.pigment[i]);
        else if (h >= TARGET_HEIGHT && old < DARK_MARK && s.pigment[i] >= DARK_MARK) count(s, i);
        // Wear: only where the crayon bears on relief, and steeply with pressure.
        if (h > 0.2) {
          s.wear[i] += P * P * P * contact * radial * travel * WEAR * (0.7 + 0.6 * grain);
          if (s.wear[i] >= TEAR) {
            if (s.isMain[i]) recredit(s, i, x, y, s.pigment[i], 0);
            else if (s.findOf[i] && h >= TARGET_HEIGHT && s.pigment[i] >= DARK_MARK) s.findMarks[s.findOf[i] - 1]--;
            s.torn[i] = 1; s.tears++; s.pigment[i] = 0; out.tore++;
          }
        }
      }
    }
    s.distance += travel;
    s.time += travel / Math.max(1, speed);
    updateCoverage(s);
    if (!s.done && s.coverage >= s.goal) { s.done = true; s.filedAt = s.time; }
    s.found.forEach((was, f) => {
      if (!was && s.findMarks[f] >= FOUND_AT * s.findTargets[f]) { s.found[f] = true; out.found.push(f); }
    });
  }
  return out;
}

// Print quality, 0 to 1: how much darker the raised specimen is than the flat paper round it.
export function contrast(s) {
  let ridgeSum = 0, ridgeN = 0, flatSum = 0, flatN = 0;
  const { xMin, xMax, yMin, yMax } = s.box;
  for (let y = yMin; y <= yMax; y++) for (let x = xMin; x <= xMax; x++) {
    const i = y * WIDTH + x;
    if (s.isMain[i]) { ridgeSum += s.pigment[i]; ridgeN++; }
    else if (s.relief[i] < 0.03 && s.touched[i]) { flatSum += s.pigment[i]; flatN++; }
  }
  const ridgeMean = ridgeN ? ridgeSum / ridgeN : 0, flatMean = flatN ? flatSum / flatN : 0;
  return ridgeMean ? clamp((ridgeMean - flatMean) / ridgeMean, 0, 1) : 0;
}

// A plate as the deeper sheet plays it: a crayon a little over half as wide (never under 10 units), and glazed plates
// asking a little less coverage (they need every line rubbed both ways). Goals only go down, so a print filed on the
// classic page is filed here too.
export function deepSpec(spec) {
  const radius = Math.max(10, Math.round(spec.radius * (spec.glaze ? 0.65 : 0.55)));
  return { ...spec, radius, goal: spec.glaze ? spec.goal - 0.04 : spec.goal, lead: undefined, par: undefined };
}
