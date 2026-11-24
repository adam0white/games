export const W = 120;
export const H = 160;
const N = W * H;
const kinds = ['garden', 'lamp', 'glass', 'sieve', 'seed', 'lamp', 'glass', 'seed', 'sieve', 'glass', 'lamp'];
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

function dune(s) {
  const { level } = s;
  const x = level === 5 ? 83 : level === 10 ? 35 : 60;
  const y = level === 10 ? 108 : 99;
  s.goal = { x, y };
  for (let j = 1; j < W - 1; j++) {
    const peak = y - (level === 1 ? 8 : level === 5 ? 14 : 20);
    const top = Math.floor(peak + Math.abs(x - j) * 0.46 + 2 * Math.sin((j - x) / 10));
    for (let k = top; k < H - 1; k++) fill(s, j, k);
  }
  s.hint = { x, y: y - 2, toX: x > 70 ? 29 : 96, toY: y - 25 };
}

function glass(s) {
  const neckX = s.level === 6 ? 45 : s.level === 9 ? 78 : 60;
  const throat = s.level === 2 ? 3 : 2;
  const neckY = 73;
  // Both glass rims are actual collision cells. The top mouth narrows toward the outlet.
  for (let x = 3; x < W - 3; x++) {
    const distance = Math.abs(neckX - x);
    if (distance <= throat) continue;
    const bottom = neckY - Math.ceil((distance - throat) * 1.45);
    if (bottom < 14) continue;
    wall(s, x, bottom);
    wall(s, x, bottom + 1);
    for (let y = 14; y < bottom; y++) fill(s, x, y);
  }
  for (let y = 14; y < neckY; y++) {
    for (let x = neckX - throat; x <= neckX + throat; x++) fill(s, x, y);
  }
  // Later vessels are offset. Let the falling stream strike the board and run
  // past its nearer end into the lower mouth. Pulling it clear spills the charge.
  const bowlX = neckX + (s.level === 6 ? 22 : s.level === 9 ? -24 : 0);
  const top = s.level === 2 ? 103 : 113;
  const bottom = 151;
  for (let y = top; y <= bottom; y++) {
    const half = Math.round(8 + 11 * Math.sin((y - top) / (bottom - top) * Math.PI));
    for (const sign of [-1, 1]) {
      wall(s, bowlX + sign * half, y);
      wall(s, bowlX + sign * (half + 1), y);
    }
  }
  for (let x = bowlX - 8; x <= bowlX + 8; x++) wall(s, x, bottom);
  const lineY = s.level === 2 ? 140 : s.level === 6 ? 132 : 124;
  const half = Math.round(8 + 11 * Math.sin((lineY - top) / (bottom - top) * Math.PI)) - 1;
  s.goal = { x: bowlX, y: lineY, half, neckY, bottom };
  s.waste = 0;
  const start = s.level === 6 ? neckX - 24 : s.level === 9 ? neckX + 22 : neckX;
  s.gate = { x: start, y: 96, half: 15 };
  const aim = s.level === 2 ? neckX + 32 : s.level === 6 ? neckX + 4 : neckX - 8;
  s.hint = { x: start, y: 96, toX: aim, toY: 96 };
}

function sorting(s) {
  const deep = s.level === 8;
  // The source well is separate from the inclined two-cell-thick wire cloth.
  for (let y = 50; y < H - 1; y++) wall(s, 43, y);
  for (let x = 1; x < 43; x++) {
    const top = Math.round(60 + Math.abs(22 - x) * 0.32);
    for (let y = top; y < H - 1; y++) fill(s, x, y, random(s) < (deep ? 0.36 : 0.49));
  }
  for (let x = 55; x <= 92; x++) {
    const y = 83 + (x - 55);
    wall(s, x, y, 2);
    wall(s, x, y + 1, 2);
  }
  for (let y = 121; y < H - 1; y++) wall(s, 92, y);
  s.goal = { x: 68, coarseX: 104, y: 151, lineY: 151, target: deep ? 240 : 100 };
  s.hint = { x: 24, y: 75, toX: 69, toY: 68 };
}

// A narrow planting hollow keeps the depth reading local to the seed.
function planting(s) {
  const seedX = s.level === 7 ? 39 : 84;
  const sourceX = seedX > 60 ? 26 : 91;
  const seedY = 143;
  for (let x = 1; x < W - 1; x++) {
    const top = Math.min(seedY, Math.floor(83 + Math.abs(x - sourceX) * 1.25));
    for (let y = top; y < H - 1; y++) fill(s, x, y);
  }
  s.goal = { x: seedX, y: seedY, minDepth: s.level === 7 ? 13 : 6, maxDepth: s.level === 7 ? 18 : 14, depth: 0 };
  s.hint = { x: sourceX, y: 89, toX: seedX, toY: 121 };
}

function garden(s) {
  for (let x = 1; x < W - 1; x++) {
    const top = Math.round(59 + 3 * Math.cos((x - 59.5) * 0.07));
    for (let y = top; y < H - 1; y++) fill(s, x, y);
  }
  s.goal = { x: 59.5, y: 99 };
  s.hint = { x: 25, y: 81, toX: 38, toY: 122 };
}

export function create(level = 1, seed = 1) {
  if (!Number.isInteger(level) || level < 0 || level > 10) level = 1;
  const s = { level, seed, rng: seed >>> 0 || 0x2aa50f3, kind: kinds[level], status: 'play', ticks: 0,
    cells: new Uint8Array(N), walls: new Uint8Array(N), provenance: new Uint8Array(N), marks: new Uint8Array(N),
    hand: { down: false, x: 0, y: 0, load: 0 }, scoop: [], spill: [],
    gate: null, progress: 0, score: 0, flow: 0, started: false, sleeping: false, stable: 0 };
  for (let x = 0; x < W; x++) { wall(s, x, 0); wall(s, x, H - 1); }
  for (let y = 0; y < H; y++) { wall(s, 0, y); wall(s, W - 1, y); }
  ({ lamp: dune, glass, sieve: sorting, seed: planting, garden })[s.kind](s);
  s.total = s.cells.reduce((n, grain) => n + Number(grain !== 0), 0);
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

function scoop(s, cx, cy) {
  const radius = s.kind === 'lamp' ? 12 : 9;
  const limit = s.kind === 'lamp' ? 680 : 370;
  for (let y = Math.max(1, cy - radius); y <= Math.min(H - 2, cy + radius) && s.scoop.length < limit; y++) {
    const span = Math.floor(Math.sqrt(radius ** 2 - (cy - y) ** 2));
    for (let x = Math.max(1, cx - span); x <= Math.min(W - 2, cx + span) && s.scoop.length < limit; x++) {
      const i = index(x, y);
      if (!s.cells[i]) continue;
      s.scoop.push(s.cells[i] + 16 * s.provenance[i]);
      s.cells[i] = 0;
      s.provenance[i] = 0;
    }
  }
  s.hand.load = s.scoop.length;
  s.sleeping = false;
}

function paint(s, x, y, nx = 1, ny = 0) {
  if (s.kind === 'garden') rake(s, x, y, nx, ny);
  else scoop(s, Math.round(x + s.hand.offsetX), Math.round(y + s.hand.offsetY));
}

export function press(s, x, y) {
  if (s.status !== 'play' || !Number.isFinite(x + y)) return;
  if (s.hand.down) release(s);
  x = clamp(x, 1, W - 2);
  y = clamp(y, 1, H - 2);
  // The exposed bail is the natural first grip. A finger on it digs under the
  // lamp, so the visible contact lifts the same grains as a stroke across its body.
  const bail = s.level === 1 && Math.abs(x - s.goal.x) <= 10
    && y >= s.goal.y - 22 && y <= s.goal.y - 6;
  Object.assign(s.hand, { down: true, x, y, offsetX: bail ? s.goal.x - x : 0, offsetY: bail ? s.goal.y - y : 0 });
  s.started = true;
  if (!s.gate) paint(s, x, y);
}

export function move(s, x, y) {
  if (!s.hand.down || s.status !== 'play' || !Number.isFinite(x + y)) return;
  x = clamp(x, 1, W - 2);
  y = clamp(y, 1, H - 2);
  const dx = x - s.hand.x;
  const dy = y - s.hand.y;
  if (s.gate) {
    s.gate.x = clamp(s.gate.x + dx, s.gate.half + 1, W - s.gate.half - 2);
    s.sleeping = false;
  } else {
    const length = Math.hypot(dx, dy);
    const n = Math.ceil(length / (s.kind === 'garden' ? 0.75 : 2));
    for (let i = 1; i <= n; i++) {
      paint(s, s.hand.x + dx * i / n, s.hand.y + dy * i / n, -dy / length, dx / length);
    }
  }
  Object.assign(s.hand, { x, y });
}

// Leave every released batch at its own location, even when a second stroke starts
// before the previous heap has poured out. A full drop site simply retains the grains.
function pour(s) {
  for (let k = s.spill.length - 1; k >= 0; k--) {
    const batch = s.spill[k];
    let placed = 0;
    for (let y = batch.y; y >= 1 && batch.grains.length && placed < 80; y--) {
      for (let j = -7; j <= 7 && batch.grains.length && placed < 80; j++) {
        const x = batch.x + j;
        if (x < 1 || x >= W - 1) continue;
        const i = index(x, y);
        if (s.cells[i] || s.walls[i]) continue;
        const particle = batch.grains.pop();
        s.cells[i] = particle % 16;
        s.provenance[i] = particle >> 4;
        placed++;
      }
    }
    if (!batch.grains.length) s.spill.splice(k, 1);
  }
}

export function release(s) {
  if (!s.hand.down) return;
  if (s.scoop.length) {
    s.spill.push({ x: Math.round(s.hand.x), y: Math.round(s.hand.y), grains: s.scoop });
    s.scoop = [];
    s.sleeping = false;
  }
  s.hand.down = false;
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
  const { cells, walls, provenance, gate } = s;
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
      if (cells[dest] || (walls[dest] && walls[dest] !== solid) || (dest >= gateLeft && dest <= gateRight)) {
        if (s.kind === 'sieve' && grain < 5 && walls[below] === 2) provenance[i] = 1;
        const dir = (i + reversed + s.ticks) & 1 ? 1 : -1;
        dest = below + dir;
        if (cells[i + dir] || (walls[i + dir] && walls[i + dir] !== solid) || cells[dest]
          || (walls[dest] && walls[dest] !== solid) || (dest >= gateLeft && dest <= gateRight)) {
          dest = below - dir;
          if (cells[i - dir] || (walls[i - dir] && walls[i - dir] !== solid) || cells[dest]
            || (walls[dest] && walls[dest] !== solid) || (dest >= gateLeft && dest <= gateRight)) {
            if (s.kind !== 'sieve' || grain < 5 || (cells[i - 1] && cells[i + 1])) continue;
            dest = runout(s, i, dir);
            if (dest < 0) continue;
          }
        }
      }
      cells[dest] = grain;
      cells[i] = 0;
      provenance[dest] = provenance[i] || (walls[dest] === 2 && grain >= 5 ? 1 : 0);
      provenance[i] = 0;
      moved++;
    }
  }
  if (gate) {
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

function measure(s) {
  const g = s.goal;
  let success = false;
  if (s.kind === 'lamp') {
    const cover = countRect(s, g.x - 5, g.y - 5, g.x + 5, g.y + 5);
    s.progress = 1 - cover / 121;
    success = !s.hand.down && s.progress >= 0.8;
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
    if (s.started && (success || s.ticks % 6 === 0) && !countRect(s, 1, 1, W - 2, g.neckY)) {
      s.status = 'lost';
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
  } else if (s.kind === 'garden') {
    if (s.started && s.patternDirty) {
      s.score = symmetry(s);
      s.patternDirty = false;
    }
    return;
  }
  s.stable = success ? s.stable + 1 : 0;
  if (s.started && s.stable >= (s.kind === 'seed' ? 18 : s.kind === 'lamp' ? 30 : 1)) s.status = 'won';
}

export function step(s) {
  if (s.status !== 'play') return;
  s.ticks++;
  if (s.kind === 'glass' && !s.started) return;
  if (s.spill.length) pour(s);
  s.flow = s.sleeping && !s.spill.length ? 0 : fall(s);
  s.sleeping = !s.flow && !s.spill.length;
  measure(s);
}
