export const W = 120;
export const H = 160;
const N = W * H;
// Ten beds, one new idea each (see NOTES). Level numbers stay 1–10, so old saves keep their meaning.
export const BEDS = [
  { kind: 'garden' },
  { kind: 'lamp', x: 60, y: 99, peak: 8 },                       // 1 dig and throw aside
  { kind: 'seed', seedX: 84, min: 6, max: 14 },                    // 2 pour a measured amount
  { kind: 'glass', neckX: 60, throat: 3, bowlDx: 0, top: 103, lineY: 140, topLine: 129, gateX: 60, stop: true }, // 3 open, then shut in time
  { kind: 'sieve', fineShare: 0.49, target: 100 },                 // 4 the mesh sorts
  { kind: 'lamp', x: 80, y: 114, peak: 30 },                        // 5 a deep hole must be wide
  { kind: 'glass', neckX: 45, throat: 2, bowlDx: 22, top: 113, lineY: 132, gateX: 21, aim: 49 }, // 6 bend the stream
  { kind: 'pile', x: 60, base: 130, markY: 96 },                   // 7 pile it high
  { kind: 'layers' },                                             // 8 order matters: ochre, then blue
  { kind: 'glass', neckX: 60, throat: 2, bowlDx: 0, top: 113, lineY: 134, rim: 44, byHand: true }, // 9 fill the hourglass by hand
  { kind: 'lamp', x: 60, y: 122, peak: 9, hopper: true },          // 10 shut the hopper, then dig
];
const kinds = BEDS.map(b => b.kind);
export const REACH = 5;          // radius of the finger in cells
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const index = (x, y) => y * W + x;

function random(s) {
  let x = s.rng;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  s.rng = x >>> 0;
  return s.rng / 4294967296;
}

function wall(s, x, y, material = 1) {
  s.walls[index(x, y)] = material;
}

function fill(s, x, y, teal = false) {
  const i = index(x, y);
  if (s.walls[i]) return;
  // Each particle carries its shade as it falls. The dune shows deposits of different ages.
  const stratum = Math.sin(y * 0.38 + Math.sin(x * 0.053) * 2.2);
  const shade = clamp(Math.floor(1.7 + stratum * 0.85 + (random(s) - 0.5) * 2.9), 0, 3);
  s.cells[i] = 1 + shade + (teal ? 4 : 0);
}

function dune(s, b) {
  const { x, y } = b;
  s.goal = { x, y };
  for (let j = 1; j < W - 1; j++) {
    const peak = y - b.peak;
    const top = Math.floor(peak + Math.abs(x - j) * 0.46 + 2 * Math.sin((j - x) / 10));
    for (let k = top; k < H - 1; k++) fill(s, j, k);
  }
  s.hint = { x: x - 9, y: y - 5, toX: x > 70 ? 22 : 104, toY: y - 30 };
  if (b.hopper) {
    // A hopper above the lamp. Its board starts open: the first touch starts the stream.
    cone(s, 60, 2, 58, 20, true);
    s.gate = { x: 92, y: 74, half: 13 };
    s.hint = { x: 92, y: 74, toX: 60, toY: 74 };
  }
}

// An upper bulb: a cone of two-cell walls narrowing to a throat at (neckX, neckY).
function cone(s, neckX, throat, neckY, rim, filled) {
  for (let x = 3; x < W - 3; x++) {
    const distance = Math.abs(neckX - x);
    if (distance <= throat) continue;
    const bottom = neckY - Math.ceil((distance - throat) * 1.45);
    if (bottom < rim) continue;
    wall(s, x, bottom);
    wall(s, x, bottom + 1);
    if (filled) for (let y = rim; y < bottom; y++) fill(s, x, y);
  }
  if (filled) for (let y = rim; y < neckY; y++) {
    for (let x = neckX - throat; x <= neckX + throat; x++) fill(s, x, y);
  }
}

function glass(s, b) {
  const { neckX, throat } = b;
  const neckY = 73;
  cone(s, neckX, throat, neckY, b.rim || 14, !b.byHand);
  const bowlX = neckX + b.bowlDx;
  const top = b.top;
  const bottom = 151;
  for (let y = top; y <= bottom; y++) {
    const half = Math.round(8 + 11 * Math.sin((y - top) / (bottom - top) * Math.PI));
    for (const sign of [-1, 1]) {
      wall(s, bowlX + sign * half, y);
      wall(s, bowlX + sign * (half + 1), y);
    }
  }
  for (let x = bowlX - 8; x <= bowlX + 8; x++) wall(s, x, bottom);
  const lineY = b.lineY;
  const half = Math.round(8 + 11 * Math.sin((lineY - top) / (bottom - top) * Math.PI)) - 1;
  const topHalf = b.topLine ? Math.round(8 + 11 * Math.sin((b.topLine - top) / (bottom - top) * Math.PI)) - 1 : 0;
  s.goal = { x: bowlX, y: lineY, half, neckY, bottom, topLine: b.topLine || 0, topHalf };
  s.waste = 0;
  if (b.byHand) {
    // No charge in the upper bulb: a dune on each side of the lower bulb holds the sand.
    for (let x = 1; x < W - 1; x++) {
      const edge = x < 60 ? x : W - 1 - x;
      if (edge > 38) continue;
      const topY = Math.floor(edge < 16 ? 96 + edge * 0.5 : 104 + (edge - 16) * 1.6);
      for (let y = topY; y < H - 1; y++) fill(s, x, y);
    }
    s.hint = { x: 14, y: 104, toX: 52, toY: 30 };
    return;
  }
  s.gate = { x: b.gateX, y: 96, half: 15 };
  const aim = b.aim ?? neckX + 32;
  s.hint = { x: b.gateX, y: 96, toX: aim, toY: 96 };
}

function sorting(s, b) {
  // The source well is separate from the inclined two-cell-thick wire cloth.
  for (let y = 50; y < H - 1; y++) wall(s, 43, y);
  for (let x = 1; x < 43; x++) {
    const top = Math.round(60 + Math.abs(22 - x) * 0.32);
    for (let y = top; y < H - 1; y++) fill(s, x, y, random(s) < b.fineShare);
  }
  for (let x = 55; x <= 92; x++) {
    const y = 83 + (x - 55);
    wall(s, x, y, 2);
    wall(s, x, y + 1, 2);
  }
  for (let y = 121; y < H - 1; y++) wall(s, 92, y);
  s.goal = { x: 68, coarseX: 104, y: 151, lineY: 151, target: b.target };
  s.hint = { x: 24, y: 66, toX: 70, toY: 62 };
}

// A narrow planting hollow keeps the depth reading local to the seed.
function planting(s, b) {
  const seedX = b.seedX;
  const sourceX = seedX > 60 ? 26 : 91;
  const seedY = 143;
  for (let x = 1; x < W - 1; x++) {
    const top = Math.min(seedY, Math.floor(83 + Math.abs(x - sourceX) * 1.25));
    for (let y = top; y < H - 1; y++) fill(s, x, y);
  }
  s.goal = { x: seedX, y: seedY, minDepth: b.min, maxDepth: b.max, depth: 0 };
  s.hint = { x: sourceX - 4, y: 86, toX: seedX, toY: 112 };
}

// A low flat bed. The star stands above it: the pile needs a wide foot to reach it.
function piling(s, b) {
  for (let x = 1; x < W - 1; x++) for (let y = b.base; y < H - 1; y++) fill(s, x, y);
  s.goal = { x: b.x, y: b.markY, base: b.base };
  s.hint = { x: 20, y: b.base + 2, toX: b.x, toY: b.markY + 6 };
}

// Sand art: a jar between two heaps. Ochre to the lower line first, then blue on top of it.
function layering(s, b) {
  const jar = { x1: 48, x2: 72, top: 104, bottom: 152, lower: 140, upper: 128 };
  for (let y = jar.top; y <= jar.bottom; y++) { wall(s, jar.x1, y); wall(s, jar.x2, y); }
  for (let x = jar.x1; x <= jar.x2; x++) wall(s, x, jar.bottom);
  for (let x = 1; x < W - 1; x++) {
    if (x >= jar.x1 && x <= jar.x2) continue;
    const blue = x > 60;
    const edge = blue ? x - 104 : 16 - x;     // positive on the outer side
    const top = Math.floor(98 + (edge > 0 ? edge * 0.7 : -edge * 1.3));
    for (let y = top; y < H - 1; y++) fill(s, x, y, blue);
  }
  const width = jar.x2 - jar.x1 - 1;
  s.goal = { x: 60, y: jar.upper, jar, need: Math.round(0.8 * width * (jar.bottom - jar.lower)), ochre: 0, blue: 0 };
}

function garden(s) {
  for (let x = 1; x < W - 1; x++) {
    const top = Math.round(59 + 3 * Math.cos((x - 59.5) * 0.07));
    for (let y = top; y < H - 1; y++) fill(s, x, y);
  }
  s.goal = { x: 59.5, y: 99 };
  s.hint = { x: 25, y: 81, toX: 38, toY: 122 };
}

// gravity: grains in free fall speed up (1 cell a tick, then 2, 3, up to 4), as sand does (2026-11-26). The page's
// ?v=b passes false for the old constant fall, one cell a tick.
export const MAX_FALL = 4;
export function create(level = 1, seed = 1, { gravity = true } = {}) {
  if (!Number.isInteger(level) || level < 0 || level > 10) level = 1;
  const bed = BEDS[level];
  const s = { level, seed, rng: seed >>> 0 || 0x2aa50f3, kind: kinds[level], status: 'play', ticks: 0,
    cells: new Uint8Array(N), walls: new Uint8Array(N), provenance: new Uint8Array(N), marks: new Uint8Array(N),
    poured: new Uint16Array(N), vel: new Uint8Array(N), gravity: !!gravity,
    hand: { down: false, x: 0, y: 0, load: 0, board: false, travel: 0 }, scoop: [], spill: [],
    gate: null, progress: 0, score: 0, flow: 0, lifted: 0, started: false, sleeping: false, stable: 0 };
  for (let x = 0; x < W; x++) { wall(s, x, 0); wall(s, x, H - 1); }
  for (let y = 0; y < H; y++) { wall(s, 0, y); wall(s, W - 1, y); }
  ({ lamp: dune, glass, sieve: sorting, seed: planting, garden, pile: piling, layers: layering })[s.kind](s, bed);
  s.total = s.cells.reduce((n, grain) => n + Number(grain !== 0), 0);
  aim(s);
  return s;
}

function rake(s, cx, cy, nx, ny) {
  s.patternDirty = true;
  for (let tooth = -1; tooth <= 1; tooth++) {
    const px = cx + tooth * nx * 4;
    const x = px < (W - 1) / 2 ? Math.floor(px + 0.5) : Math.ceil(px - 0.5);
    const y = Math.round(cy + tooth * ny * 4);
    if (x < 1 || x >= W - 1 || y < 1 || y >= H - 1) continue;
    const i = index(x, y);
    if (!s.cells[i]) continue;
    s.marks[i] = 2;
    if ((Math.min(x, W - 1 - x) + y) % 7 === 0 && s.scoop.length < 64) {
      s.scoop.push(s.cells[i]);
      s.cells[i] = 0;
      s.hand.load = s.scoop.length;
      s.sleeping = false;
    }
  }
}

// Sand the hand has just poured is still falling; the finger does not grab it back.
const FRESH = 40;
const isFresh = (s, i) => s.poured[i] && ((s.ticks - s.poured[i]) & 0xffff) < FRESH;
export const capacity = s => s.kind === 'lamp' ? 600 : 420;

// The finger gathers the grains it touches into the hand, up to what a hand holds.
function scoop(s, cx, cy) {
  const limit = capacity(s);
  const r = REACH;
  let got = 0;
  for (let y = Math.max(1, cy - r); y <= Math.min(H - 2, cy + r) && s.scoop.length < limit; y++) {
    const span = Math.floor(Math.sqrt(r * r - (cy - y) ** 2));
    for (let x = Math.max(1, cx - span); x <= Math.min(W - 2, cx + span) && s.scoop.length < limit; x++) {
      const i = index(x, y);
      if (!s.cells[i] || isFresh(s, i)) continue;
      s.scoop.push(s.cells[i] + 16 * s.provenance[i]);
      s.cells[i] = 0;
      s.provenance[i] = 0;
      s.poured[i] = 0;
      got++;
    }
  }
  if (got) { s.lifted += got; s.sleeping = false; }
  s.hand.load = s.scoop.length;
}

function paint(s, x, y, nx = 1, ny = 0) {
  if (s.kind === 'garden') rake(s, x, y, nx, ny);
  else scoop(s, Math.round(x), Math.round(y));
}

// The board is taken when the press lands on it (always, in the hourglass beds).
export function grips(s, x, y) {
  if (!s.gate) return false;
  if (s.kind === 'glass') return true;
  return Math.abs(y - s.gate.y) <= 9 && Math.abs(x - s.gate.x) <= s.gate.half + 6;
}

export function press(s, x, y) {
  if (s.status !== 'play' || !Number.isFinite(x + y)) return;
  if (s.hand.down) release(s);
  x = clamp(x, 1, W - 2);
  y = clamp(y, 1, H - 2);
  Object.assign(s.hand, { down: true, x, y, board: grips(s, x, y), travel: 0, speed: 0, moved: 0, age: 0, drip: 0 });
  s.started = true;
  if (s.hand.board) return;
  paint(s, x, y);
  // A finger that lands just above the sand still takes hold of it: reach down to the surface.
  if (s.kind !== 'garden' && !s.scoop.length) {
    const cx = Math.round(x);
    for (let y2 = Math.round(y) + 1; y2 <= Math.min(H - 2, Math.round(y) + 16); y2++) {
      if (!s.cells[index(cx, y2)]) continue;
      paint(s, cx, y2 + 2);
      break;
    }
  }
}

export function move(s, x, y) {
  if (!s.hand.down || s.status !== 'play' || !Number.isFinite(x + y)) return;
  x = clamp(x, 1, W - 2);
  y = clamp(y, 1, H - 2);
  const dx = x - s.hand.x;
  const dy = y - s.hand.y;
  const length = Math.hypot(dx, dy);
  if (s.hand.board) {
    s.gate.x = clamp(s.gate.x + dx, s.gate.half + 1, W - s.gate.half - 2);
    s.sleeping = false;
  } else if (length > 0) {
    const n = Math.ceil(length / (s.kind === 'garden' ? 0.75 : 1.5));
    for (let i = 1; i <= n; i++) {
      paint(s, s.hand.x + dx * i / n, s.hand.y + dy * i / n, -dy / length, dx / length);
    }
  }
  s.hand.travel += length;
  Object.assign(s.hand, { x, y });
}

// Put up to `rate` grains into empty cells of a narrow spout at (x, y), searching upward
// when the spout is buried. Returns how many were placed.
function spout(s, grains, x, y, rate, below) {
  let placed = 0;
  for (let row = y + below; row >= 1 && grains.length && placed < rate; row--) {
    for (const j of [0, -1, 1, -2, 2]) {
      if (!grains.length || placed >= rate) break;
      const cx = x + j;
      if (cx < 1 || cx >= W - 1) continue;
      const i = index(cx, row);
      if (s.cells[i] || s.walls[i]) continue;
      const particle = grains.pop();
      s.cells[i] = particle % 16;
      s.provenance[i] = particle >> 4;
      s.poured[i] = s.ticks || 1;
      s.vel[i] = 0;
      placed++;
    }
    if (row < y - 24) break;
  }
  return placed;
}

// Released sand streams out where the finger left it.
function pour(s) {
  for (let k = s.spill.length - 1; k >= 0; k--) {
    const batch = s.spill[k];
    spout(s, batch.grains, batch.x, batch.y, 14, 0);
    if (!batch.grains.length) s.spill.splice(k, 1);
  }
}

// A held handful trickles out while the finger is over open air: slowly while it moves fast,
// freely while it hovers. A fast flick carries the sand; a still finger pours it.
function trickle(s) {
  const h = s.hand;
  if (!h.down || h.board || s.kind === 'garden') { h.travel = 0; return; }
  // Speed is smoothed over a few ticks: pointer events and ticks do not arrive in step.
  h.speed = 0.7 * (h.speed || 0) + 0.3 * h.travel;
  h.moved = (h.moved || 0) + h.travel;
  h.age = (h.age || 0) + 1;
  h.travel = 0;
  if (!s.scoop.length || (h.moved < 4 && h.age < 30)) return;
  const x = Math.round(h.x), y = Math.round(h.y);
  if (s.cells[index(x, y)] || s.walls[index(x, y)]) return;
  h.drip = (h.drip || 0) + (h.speed > 1.2 ? 0.35 : h.speed > 0.4 ? 2.5 : 8);
  const rate = Math.floor(h.drip);
  h.drip -= rate;
  if (rate && spout(s, s.scoop, x, y + 2, rate, 0)) { s.sleeping = false; h.load = s.scoop.length; }
}

export function release(s) {
  if (!s.hand.down) return;
  if (s.scoop.length) {
    s.spill.push({ x: Math.round(s.hand.x), y: Math.round(s.hand.y), grains: s.scoop });
    s.scoop = [];
    s.sleeping = false;
  }
  s.hand.down = false;
  s.hand.board = false;
  s.hand.load = 0;
}

// Bottom-up sweeps move each particle at most once. Random lateral preference avoids
// a left-hand bias. A particle slips diagonally only when the side has space too.
function runout(s, i, dir) {
  // Fine grains skate across up to six clear cells above a ledge before dropping.
  for (let pass = 0; pass < 2; pass++) {
    const sign = pass ? -dir : dir;
    for (let d = 1; d <= 6; d++) {
      const side = i + d * sign;
      if (s.cells[side] || s.walls[side] === 1) break;
      const lower = side + W;
      if (!s.cells[lower] && s.walls[lower] !== 1) return lower;
    }
  }
  return -1;
}

function fall(s) {
  const { cells, walls, provenance, poured, gate, vel } = s;
  const gateRow = gate ? gate.y * W : -W;
  const gateLeft = gate ? gateRow + Math.round(gate.x) - gate.half : -1;
  const gateRight = gate ? gateRow + Math.round(gate.x) + gate.half : -1;
  let moved = 0;
  let salt = (random(s) * 0xffffffff) >>> 0;
  for (let y = H - 2; y >= 1; y--) {
    const reversed = (salt >>> (y & 31)) & 1;
    const start = y * W + (reversed ? W - 2 : 1);
    const end = y * W + (reversed ? 0 : W - 1);
    const inc = reversed ? -1 : 1;
    for (let i = start; i !== end; i += inc) {
      const grain = cells[i];
      if (!grain) continue;
      const solid = grain < 5 ? 0 : 2;
      const below = i + W;
      let dest = below;
      const blocked = d => cells[d] || (walls[d] && walls[d] !== solid) || (d >= gateLeft && d <= gateRight);
      if (!blocked(dest)) {
        // Free fall: a grain that keeps falling gains a cell a tick every few ticks, up to MAX_FALL.
        let v = 0;
        if (s.gravity) {
          const want = Math.min(MAX_FALL, 1 + (vel[i] >> 2));
          for (let n = 1; n < want && dest + W < N && !blocked(dest + W); n++) {
            if (walls[dest] === 2 && grain >= 5) provenance[i] = 1;
            dest += W;
          }
          v = Math.min(255, vel[i] + 1);
        }
        vel[dest] = v;
      } else {
        if (s.kind === 'sieve' && grain < 5 && walls[below] === 2) provenance[i] = 1;
        const dir = (i + reversed + s.ticks) & 1 ? 1 : -1;
        dest = below + dir;
        if (cells[i + dir] || (walls[i + dir] && walls[i + dir] !== solid) || cells[dest]
          || (walls[dest] && walls[dest] !== solid) || (dest >= gateLeft && dest <= gateRight)) {
          dest = below - dir;
          if (cells[i - dir] || (walls[i - dir] && walls[i - dir] !== solid) || cells[dest]
            || (walls[dest] && walls[dest] !== solid) || (dest >= gateLeft && dest <= gateRight)) {
            if (s.kind !== 'sieve' || grain < 5 || (cells[i - 1] && cells[i + 1])) { vel[i] = 0; continue; }
            dest = runout(s, i, dir);
            if (dest < 0) { vel[i] = 0; continue; }
          }
        }
        // A grain that lands or slips loses most of its speed.
        vel[dest] = vel[i] >> 2;
      }
      cells[dest] = grain;
      cells[i] = 0;
      provenance[dest] = provenance[i] || (walls[dest] === 2 && grain >= 5 ? 1 : 0);
      provenance[i] = 0;
      poured[dest] = poured[i];
      poured[i] = 0;
      if (dest !== i) vel[i] = 0;
      moved++;
    }
  }
  if (gate && s.kind === 'glass') {
    const base = (H - 2) * W;
    for (let x = 1; x < W - 1; x++) {
      if (!cells[base + x]) continue;
      cells[base + x] = 0;
      s.waste++;
      moved++;
    }
  }
  return moved;
}

function countRect(s, x1, y1, x2, y2, qualifying = null) {
  let n = 0;
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      const i = index(x, y);
      if (s.cells[i] && (!qualifying || qualifying(s.cells[i], s.provenance[i]))) n++;
    }
  }
  return n;
}

function symmetry(s) {
  let matched = 0, ink = 0;
  const marks = s.marks;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (!marks[index(x, y)]) continue;
      ink++;
      const mirror = W - 1 - x;
      const i = index(mirror, y);
      if (marks[i]) {
        matched++;
        continue;
      }
      // A pointer lands between cells. Give near credit within one cell of the
      // reflected tine, and require the matching mark to be on the opposite side.
      const lo = Math.max(mirror - 1, mirror < W / 2 ? 1 : W / 2);
      const hi = Math.min(mirror + 1, mirror < W / 2 ? W / 2 - 1 : W - 2);
      let near = false;
      for (let xx = lo; xx <= hi && !near; xx++) {
        const j = index(xx, y);
        near = marks[j - W] || marks[j] || marks[j + W];
      }
      if (near) matched += 0.9;
    }
  }
  // A point on the axis cannot earn a perfect score. A short pair of strokes can.
  return ink ? Math.round(100 * matched / Math.max(ink, 280)) : 0;
}

function columnTop(s, x) {
  for (let y = 1; y < H - 1; y++) if (s.cells[index(x, y)]) return y;
  return H - 1;
}

function measure(s) {
  const g = s.goal;
  let success = false;
  let hold = 1;
  if (s.kind === 'lamp') {
    const cover = countRect(s, g.x - 5, g.y - 5, g.x + 5, g.y + 5);
    s.progress = 1 - cover / 121;
    success = !s.hand.down && s.progress >= 0.8;
    hold = 30;

  } else if (s.kind === 'glass') {
    let hits = 0;
    // Three sample columns must reach the etched line; an airborne stream does not count.
    for (const dx of [-4, 0, 4]) {
      let height = 0;
      for (let y = g.bottom - 1; y >= g.y && s.cells[index(g.x + dx, y)]; y--) height++;
      hits += height;
    }
    s.progress = hits / ((g.bottom - g.y) * 3);
    success = s.progress === 1;
    if (g.topLine) {
      // The shut-in-time bed: sand past the upper mark, beside the stream, is a spill.
      // The board must be back under the throat for the bed to count.
      let highest = 0;
      for (const dx of [-8, 8]) {
        let height = 0;
        for (let y = g.bottom - 1; y > 1 && s.cells[index(g.x + dx, y)]; y--) height++;
        highest = Math.max(highest, height);
      }
      if (s.started && highest > g.bottom - g.topLine) { s.status = 'lost'; s.ending = 'overfill'; return; }
      success = success && Math.abs(s.gate.x - g.x) <= s.gate.half - 5;
      hold = 45;
    }
    if (s.gate && s.started && (success || s.ticks % 6 === 0) && !countRect(s, 1, 1, W - 2, g.neckY)) {
      s.status = 'lost';
      s.ending = 'empty';
      return;
    }
  } else if (s.kind === 'sieve') {
    g.fine = countRect(s, 44, 123, 91, H - 2, (grain, screened) => grain >= 5 && screened);
    g.coarse = countRect(s, 93, 123, W - 2, H - 2, (grain, screened) => grain < 5 && screened);
    s.progress = Math.min(1, g.fine / g.target, g.coarse / g.target);
    success = s.progress === 1;
  } else if (s.kind === 'seed') {
    let total = 0;
    for (let x = g.x - 2; x <= g.x + 2; x++) {
      for (let y = g.y - 1; y > 0 && s.cells[index(x, y)]; y--) total++;
    }
    g.depth = total / 5;
    s.progress = g.depth < g.minDepth ? g.depth / g.minDepth : clamp(1 - Math.max(0, g.depth - g.maxDepth) / 12, 0, 1);
    success = !s.hand.down && g.depth >= g.minDepth && g.depth <= g.maxDepth && !s.flow && !s.spill.length;
    hold = 18;
  } else if (s.kind === 'pile') {
    let top = H;
    for (let x = g.x - 1; x <= g.x + 1; x++) top = Math.min(top, columnTop(s, x));
    g.top = top;
    s.progress = clamp((g.base - top) / (g.base - g.y), 0, 1);
    success = !s.hand.down && top <= g.y;
    hold = 30;
  } else if (s.kind === 'layers') {
    const { jar } = g;
    let ochre = 0, blue = 0, ochreY = 0, blueY = 0;
    for (let y = jar.top - 4; y < jar.bottom; y++) for (let x = jar.x1 + 1; x < jar.x2; x++) {
      const grain = s.cells[index(x, y)];
      if (!grain) continue;
      if (grain >= 5) { blue++; blueY += y; } else { ochre++; ochreY += y; }
    }
    // Blue must lie on the ochre: its mean depth sits well above the ochre's.
    g.ochre = ochre; g.blue = blue;
    g.ordered = !blue || !ochre || blueY / blue < ochreY / ochre - 6;
    s.progress = (Math.min(1, ochre / g.need) + Math.min(1, blue / g.need)) / 2 * (g.ordered ? 1 : 0.5);
    success = !s.hand.down && ochre >= g.need && blue >= g.need && g.ordered;
    hold = 20;
  } else if (s.kind === 'garden') {
    if (s.started && s.patternDirty) {
      s.score = symmetry(s);
      s.patternDirty = false;
    }
    return;
  }
  s.stable = success ? s.stable + 1 : 0;
  if (s.started && s.stable >= hold) s.status = 'won';
}

function highest(s, x1, x2, qualifying = () => true) {
  let best = null;
  for (let x = Math.max(1, x1); x <= Math.min(W - 2, x2); x++) {
    for (let y = 1; y < H - 1; y++) {
      const grain = s.cells[index(x, y)];
      if (!grain) continue;
      if (qualifying(grain) && (!best || y < best.y)) best = { x, y };
      break;
    }
  }
  return best;
}

// The moving hint, and the informed bot, start each stroke on sand that is there now.
function aim(s) {
  const g = s.goal, b = BEDS[s.level];
  const from = (p, toX, toY) => { if (p) s.hint = { x: p.x, y: p.y + 2, toX, toY }; };
  if (s.kind === 'lamp') {
    if (s.gate && Math.abs(s.gate.x - 60) > s.gate.half - 4) {
      s.hint = { x: s.gate.x, y: s.gate.y, toX: 60, toY: s.gate.y };
      return;
    }
    const p = highest(s, g.x - 7, g.x + 7);
    if (p) from(p, p.x < g.x ? Math.max(4, p.x - 40) : Math.min(W - 5, p.x + 40), p.y - 26);
  } else if (s.kind === 'seed') {
    const source = g.x > 60 ? 26 : 91;
    from(highest(s, source - 14, source + 14), g.x, g.y - g.maxDepth - 14);
  } else if (s.kind === 'sieve') {
    from(highest(s, 2, 41), 70, 64);
  } else if (s.kind === 'pile') {
    const left = highest(s, 2, g.x - 22), right = highest(s, g.x + 22, W - 3);
    const p = !right || (left && left.y <= right.y) ? left : right;
    from(p, g.x, Math.max(g.y - 4, (g.top || g.base) - 10));
  } else if (s.kind === 'layers') {
    const blue = g.ochre >= g.need;
    from(blue ? highest(s, 80, W - 3) : highest(s, 2, 40), g.x, g.jar.top - 10);
  } else if (s.kind === 'glass' && b.stop) {
    const open = Math.abs(s.gate.x - g.x) > s.gate.half - 5;
    const toX = open || s.progress >= 0.9 ? g.x : g.x + 32;
    s.hint = { x: s.gate.x, y: s.gate.y, toX, toY: s.gate.y };
  } else if (s.kind === 'glass' && b.byHand) {
    const left = highest(s, 2, 33), right = highest(s, 87, W - 3);
    const p = !right || (left && left.y <= right.y) ? left : right;
    from(p, g.x, 34);
  }
}

export function step(s) {
  if (s.status !== 'play') return;
  s.ticks++;
  if (s.gate && !s.started) return;
  trickle(s);
  if (!s.hand.down && s.ticks % 15 === 0) aim(s);
  if (s.spill.length) pour(s);
  s.flow = s.sleeping && !s.spill.length ? 0 : fall(s);
  s.sleeping = !s.flow && !s.spill.length && !(s.hand.down && s.scoop.length);
  measure(s);
}
