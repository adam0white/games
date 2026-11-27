// The crossing: two hills either side of a creek with two fords. Mirror-fair: everything on the left has a twin on
// the right. Home food is small and runs out; the big piles lie on the fords, where the two colonies meet.

import { cellAt, MAT, SURFACE, NEST } from '../sim/grid.js';
import { below, STREAM } from '../sim/rng.js';
import { MAPS, CACHES } from './tables.js';

export const FOOD_SUGAR = 0, FOOD_PROTEIN = 1;
export const DOORS = [[36, 56], [124, 56]];
export const FORDS = [28, 84]; // the rows the fords are centred on

/** Lay the map out on a new sim. layoutOnly: set just what a save does not carry (doors, rooms, links). */
export function generate(sim, layoutOnly = false) {
  const L = sim.L, cfg = sim.cfg, mat = sim.mat, sw = L.sw, sh = L.sh;
  const S = (x, y) => cellAt(L, SURFACE, x, y), N = (x, y) => cellAt(L, NEST, x, y);
  const doors = [[Math.round((sw * 36) / 160), sh >> 1], [sw - 1 - Math.round((sw * 36) / 160), sh >> 1]];
  if (cfg.swap) doors.reverse(); // seats change sides: for telling a bias of the side from a bias of the seat
  if (!layoutOnly) { mat.fill(MAT.OPEN, 0, L.nestBase); mat.fill(MAT.CLAY, L.nestBase); }
  for (let t = 0; t < doors.length; t++) {
    const [dx, dy] = doors[t];
    const open = (x0, y0, x1, y1) => { if (layoutOnly) return; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const c = N(x, y); if (c >= 0) mat[c] = MAT.OPEN; } };
    open(dx, 0, dx, 4); open(dx - 2, 4, dx + 2, 6); // the shaft and the porch store
    open(dx, 7, dx, 10); open(dx - 6, 10, dx + 5, 13); // the nursery
    open(dx, 14, dx, 16); open(dx - 2, 16, dx + 2, 18); // the queen's chamber
    sim.door[t] = S(dx, dy); sim.store[t] = N(dx, 5); sim.queen[t] = N(dx, 17);
    sim.nursery[t] = { x: dx - 6, y: 10, w: 12, h: 4 };
    if (!layoutOnly) {
      const paint = (x0, y0, x1, y1, kind) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && x < L.nw && y >= 0 && y < L.nh) sim.room[y * L.nw + x] = kind; };
      paint(dx - 2, 4, dx + 2, 6, 1); paint(dx - 6, 10, dx + 5, 13, 2); // the porch is a store, the wide room a nursery
    }
    sim.link[S(dx, dy)] = N(dx, 0); sim.link[N(dx, 0)] = S(dx, dy);
  }
  // Sites that pay while held: a mission's list, in cells of the 160 by 112 map.
  sim.sites = (sim.mission.sites ?? []).map(([x, y]) => S(Math.round((x * sw) / 160), Math.round((y * sh) / 112)));
  if (layoutOnly || cfg.blank) return;
  // Caches in the clay: the left hill's lie as the table says, the right hill's as its mirror.
  const count = Math.min(CACHES.length, sim.mission.caches ?? cfg.caches ?? 4);
  for (let j = 0; j < count; j++) {
    const [ox, y, kind, amount] = CACHES[(Math.abs(cfg.seed | 0) + j) % CACHES.length];
    for (let t = 0; t < doors.length; t++) { const x = doors[t][0] + (doors[t][0] < sw >> 1 ? ox : -ox), c = N(x, y); if (c >= 0 && mat[c] === MAT.CLAY) sim.cache[c - L.nestBase] = amount * 2 + kind; }
  }
  const mid = sw >> 1, mx = x => sw - 1 - x, M = MAPS[sim.mission.map] ?? MAPS.crossing, wall = M.wall === 'stone' ? MAT.STONE : MAT.WATER;
  const ford = y => M.gaps.some(f => Math.abs(y - Math.round((f * sh) / 112)) <= M.gapHalf);
  // The creek: four cells wide down the middle, a cell wider here and there, open at the fords.
  for (let y = 0; y < sh; y++) {
    if (ford(y)) continue;
    const e = below(sim.rng, STREAM.world, 3) === 0 ? 1 : 0;
    if (M.wall) for (let x = mid - 2 - e; x <= mid + 1 + e; x++) mat[S(x, y)] = wall;
  }
  // Food, mirrored.
  const piles = M.piles;
  const spots = [];
  const lean = cfg.lean || 1, glut = cfg.glut || 1; // a mission's seed fall: every seed pile this many times as big
  for (const [x, y, kind, a] of piles) { const amount = Math.max(1, Math.floor((kind === FOOD_SUGAR ? a * glut : a) / lean)); sim.drop(S(x, y), kind, amount); sim.drop(S(mx(x), y), kind, amount); spots.push([x, y], [mx(x), y]); }
  for (const [ox, y, kind, a] of M.mid) { sim.drop(S(mid + ox, y), kind, Math.floor((kind === FOOD_SUGAR ? a * glut : a) / lean)); spots.push([mid, y]); }
  // Stones, mirrored: small clumps away from doors, food and the fords.
  const clear = (x, y) => {
    if (x < 2 || y < 2 || y > sh - 3 || x > mid - 6) return false;
    for (const [dx, dy] of doors) if (Math.abs(x - dx) < 9 && Math.abs(y - dy) < 9) return false;
    for (const [px, py] of spots) if (Math.abs(x - px) < 5 && Math.abs(y - py) < 5) return false;
    return true;
  };
  for (const c of sim.sites) spots.push([c % sw, Math.floor(c / sw)], [mx(c % sw), Math.floor(c / sw)]);
  for (let k = 0; k < M.clumps; k++) {
    let x = 2 + below(sim.rng, STREAM.world, mid - 8), y = 2 + below(sim.rng, STREAM.world, sh - 4);
    const size = 2 + below(sim.rng, STREAM.world, 5);
    for (let j = 0; j < size; j++) {
      if (clear(x, y)) { mat[S(x, y)] = MAT.STONE; mat[S(mx(x), y)] = MAT.STONE; }
      const d = below(sim.rng, STREAM.world, 4);
      x += d === 1 ? 1 : d === 3 ? -1 : 0; y += d === 0 ? -1 : d === 2 ? 1 : 0;
    }
  }
}
