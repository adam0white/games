// Seeded terrain: a surface of ash with stones, a pond and food piles; a nest of soil bands with roots and
// stones, an entrance shaft and a queen's chamber. Uses only the 'world' random stream.

import { MAT, NEST, SURFACE, cellAt } from './grid.js';
import { STREAM, below } from './rng.js';

const W = STREAM.world;

function disc(sim, layer, cx, cy, r, m, keep) {
  for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
    const c = cellAt(sim.L, layer, x, y);
    if (c >= 0 && (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r && !keep(x, y)) sim.mat[c] = m;
  }
}

export function generate(sim) {
  const { L, rng } = sim, ex = L.sw >> 1, ey = L.sh >> 1, sx = L.nw >> 1;
  const nearEntrance = (x, y) => Math.abs(x - ex) < 12 && Math.abs(y - ey) < 12;

  // Surface: open ash, stones, one pond.
  sim.mat.fill(MAT.OPEN, 0, L.nestBase);
  const stones = Math.floor((L.sw * L.sh) / 1600);
  for (let i = 0; i < stones; i++) disc(sim, SURFACE, below(rng, W, L.sw), below(rng, W, L.sh), 1 + below(rng, W, 4), MAT.STONE, nearEntrance);
  disc(sim, SURFACE, Math.floor(L.sw / 5) + below(rng, W, 8), Math.floor(L.sh / 4) + below(rng, W, 8), 6, MAT.WATER, nearEntrance);

  // Nest: soil bands by depth, stones and roots, then the shaft and the chamber.
  for (let y = 0; y < L.nh; y++) {
    const m = y < 8 ? MAT.ASH : y < 40 ? MAT.TOPSOIL : MAT.CLAY;
    sim.mat.fill(m, L.nestBase + y * L.nw, L.nestBase + (y + 1) * L.nw);
  }
  // The queen's chamber is 10 cells down (24 before sim 7): a load reaches the stores seconds after the entrance.
  const home = { x: sx - 8, y: 10, w: 16, h: 6 };
  const nearShaft = (x, y) => Math.abs(x - sx) < 14 && y < home.y + 10;
  for (let i = 0; i < 30; i++) disc(sim, NEST, below(rng, W, L.nw), 10 + below(rng, W, L.nh - 10), 1 + below(rng, W, 3), MAT.STONE, nearShaft);
  for (let i = 0; i < 20; i++) {
    let x = below(rng, W, L.nw), y = below(rng, W, 20);
    for (let k = 0; k < 30; k++) {
      const c = cellAt(L, NEST, x, y);
      if (c < 0) break;
      if (!nearShaft(x, y)) sim.mat[c] = MAT.ROOT;
      y++; x += below(rng, W, 3) - 1;
    }
  }
  for (let y = 0; y < home.y; y++) for (let x = sx; x <= sx + 1; x++) sim.mat[cellAt(L, NEST, x, y)] = MAT.OPEN;
  for (let y = home.y; y < home.y + home.h; y++) for (let x = home.x; x < home.x + home.w; x++) sim.mat[cellAt(L, NEST, x, y)] = MAT.OPEN;
  sim.home = home;

  // Two entrance links: surface (ex, ey) and (ex+1, ey) to the top of the shaft.
  for (let k = 0; k < 2; k++) {
    const a = cellAt(L, SURFACE, ex + k, ey), b = cellAt(L, NEST, sx + k, 0);
    sim.mat[a] = MAT.OPEN;
    sim.link[a] = b; sim.link[b] = a;
  }

  // Food piles, each with a clear patch around it. Sim 7 (the pace pass): the first two (a sugar and a protein) are
  // small and near, about 12 to 15 cells from the entrance (plus a jitter), so the first trail brings food home in seconds; the other two
  // are 30 to 90 cells out, as before. More come during the day (windfall below).
  const piles = Math.min(sim.pileCell.length, 4);
  for (let p = 0; p < piles; p++) {
    const r = p < 2 ? 17 + below(rng, W, 5) : 30 + below(rng, W, 60), q = (p * 64 + below(rng, W, 48)) & 255;
    // A coarse compass from integer steps keeps this integer: eight directions, then a jitter.
    const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]], [dx, dy] = dirs[q >> 5];
    const px = Math.max(3, Math.min(L.sw - 4, ex + Math.floor((dx * r * 7) / 10) + below(rng, W, 9) - 4));
    const py = Math.max(3, Math.min(L.sh - 4, ey + Math.floor((dy * r * 7) / 10) + below(rng, W, 9) - 4));
    disc(sim, SURFACE, px, py, 3, MAT.OPEN, () => false);
    sim.pileCell[p] = cellAt(L, SURFACE, px, py);
    sim.pileAmount[p] = p < 2 ? 120 + below(rng, W, 60) : 400 + below(rng, W, 400);
    sim.pileKind[p] = p & 1; // even piles sugar (nectar), odd protein (insects): FOOD in colony.js
  }
}

// Windfalls (sim 7, the pace pass): in a colony game a new pile falls at WINDFALL_AT[k] twentieths of each day (a dead beetle,
// spilt nectar), so the map changes while the player watches. It takes the first empty pile slot, 24 to 63 cells
// from the entrance on an open cell (eight tries; none open: no pile that time). The first of the game is protein
// (the larvae need it), then they alternate. Uses the world stream; G.WINDFALLS counts them.
export const WINDFALL_AT = [7, 10, 14, 18]; // twentieths of the day: 73, 105, 147 and 189 s into a 3.5-minute day
export function windfall(sim, G, setGoal, slot0, goalFood, event) {
  const { L, rng } = sim, ex = L.sw >> 1, ey = L.sh >> 1;
  let p = -1;
  for (let k = 0; k < sim.pileCell.length; k++) if (sim.pileAmount[k] <= 0) { p = k; break; }
  if (p < 0) return;
  for (let tries = 0; tries < 8; tries++) {
    const r = 24 + below(rng, W, 40), q = below(rng, W, 256);
    const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]], [dx, dy] = dirs[q >> 5];
    const px = Math.max(3, Math.min(L.sw - 4, ex + Math.floor((dx * r * 7) / 10) + (q & 7) - 4));
    const py = Math.max(3, Math.min(L.sh - 4, ey + Math.floor((dy * r * 7) / 10) + ((q >> 3) & 3) - 2));
    const c = cellAt(L, SURFACE, px, py);
    if (sim.mat[c] !== MAT.OPEN || sim.link[c] >= 0) continue;
    const kind = sim.g[G.WINDFALLS] & 1 ? 0 : 1;
    sim.g[G.WINDFALLS]++;
    sim.pileCell[p] = c; sim.pileAmount[p] = 200 + below(rng, W, 200); sim.pileKind[p] = kind;
    setGoal(sim, slot0 + p, goalFood, c);
    event(p, kind);
    return;
  }
}
