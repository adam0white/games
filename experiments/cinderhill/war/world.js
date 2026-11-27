// The crossing: two hills either side of a creek with two fords. Mirror-fair: everything on the left has a twin on
// the right. Home food is small and runs out; the big piles lie on the fords, where the two colonies meet.

import { cellAt, MAT, SURFACE, NEST } from '../sim/grid.js';
import { below, STREAM } from '../sim/rng.js';

export const FOOD_SUGAR = 0, FOOD_PROTEIN = 1;
export const DOORS = [[36, 56], [124, 56]];
export const FORDS = [28, 84]; // the rows the fords are centred on

/** Lay the map out on a new sim. layoutOnly: set just what a save does not carry (doors, rooms, links). */
export function generate(sim, layoutOnly = false) {
  const L = sim.L, cfg = sim.cfg, mat = sim.mat, sw = L.sw, sh = L.sh;
  const S = (x, y) => cellAt(L, SURFACE, x, y), N = (x, y) => cellAt(L, NEST, x, y);
  const doors = [[Math.round((sw * 36) / 160), sh >> 1], [sw - 1 - Math.round((sw * 36) / 160), sh >> 1]];
  if (!layoutOnly) { mat.fill(MAT.OPEN, 0, L.nestBase); mat.fill(MAT.CLAY, L.nestBase); }
  for (let t = 0; t < doors.length; t++) {
    const [dx, dy] = doors[t];
    const open = (x0, y0, x1, y1) => { if (layoutOnly) return; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const c = N(x, y); if (c >= 0) mat[c] = MAT.OPEN; } };
    open(dx, 0, dx, 4); open(dx - 2, 4, dx + 2, 6); // the shaft and the porch store
    open(dx, 7, dx, 10); open(dx - 6, 10, dx + 5, 13); // the nursery
    open(dx, 14, dx, 16); open(dx - 2, 16, dx + 2, 18); // the queen's chamber
    sim.door[t] = S(dx, dy); sim.store[t] = N(dx, 5); sim.queen[t] = N(dx, 17);
    sim.nursery[t] = { x: dx - 6, y: 10, w: 12, h: 4 };
    sim.link[S(dx, dy)] = N(dx, 0); sim.link[N(dx, 0)] = S(dx, dy);
  }
  if (layoutOnly || cfg.blank) return;
  const mid = sw >> 1, mx = x => sw - 1 - x;
  const ford = y => FORDS.some(f => Math.abs(y - Math.round((f * sh) / 112)) <= 2);
  // The creek: four cells wide down the middle, a cell wider here and there, open at the fords.
  for (let y = 0; y < sh; y++) {
    if (ford(y)) continue;
    const e = below(sim.rng, STREAM.world, 3) === 0 ? 1 : 0;
    for (let x = mid - 2 - e; x <= mid + 1 + e; x++) mat[S(x, y)] = MAT.WATER;
  }
  // Food, mirrored.
  const piles = [[27, 49, FOOD_SUGAR, 60], [45, 66, FOOD_PROTEIN, 50], [50, 34, FOOD_SUGAR, 80], [30, 84, FOOD_PROTEIN, 70], [58, 70, FOOD_SUGAR, 70], [20, 22, FOOD_PROTEIN, 60]];
  const spots = [];
  for (const [x, y, kind, amount] of piles) { sim.drop(S(x, y), kind, amount); sim.drop(S(mx(x), y), kind, amount); spots.push([x, y], [mx(x), y]); }
  sim.drop(S(mid - 1, FORDS[0]), FOOD_PROTEIN, 160); sim.drop(S(mid, FORDS[1]), FOOD_SUGAR, 160);
  spots.push([mid, FORDS[0]], [mid, FORDS[1]]);
  // Stones, mirrored: small clumps away from doors, food and the fords.
  const clear = (x, y) => {
    if (x < 2 || y < 2 || y > sh - 3 || x > mid - 6) return false;
    for (const [dx, dy] of doors) if (Math.abs(x - dx) < 9 && Math.abs(y - dy) < 9) return false;
    for (const [px, py] of spots) if (Math.abs(x - px) < 5 && Math.abs(y - py) < 5) return false;
    return true;
  };
  for (let k = 0; k < 16; k++) {
    let x = 2 + below(sim.rng, STREAM.world, mid - 8), y = 2 + below(sim.rng, STREAM.world, sh - 4);
    const size = 2 + below(sim.rng, STREAM.world, 5);
    for (let j = 0; j < size; j++) {
      if (clear(x, y)) { mat[S(x, y)] = MAT.STONE; mat[S(mx(x), y)] = MAT.STONE; }
      const d = below(sim.rng, STREAM.world, 4);
      x += d === 1 ? 1 : d === 3 ? -1 : 0; y += d === 0 ? -1 : d === 2 ? 1 : 0;
    }
  }
}
