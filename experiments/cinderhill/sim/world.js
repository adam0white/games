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

/** A colony game's nursery (sim 8, 02-spec 3.2: 10 to 16 cells down, 64 cells): 16 by 4, 12 cells down, under the
 *  shaft. Fixed by the nest's width, so a snapshot needs no field for it. */
export const nurseryRect = L => ({ x: (L.nw >> 1) - 8, y: Math.max(6, Math.min(12, L.nh - 5)), w: 16, h: 4 }); // higher in a shallow test nest

/** The colony entrance's width in cells (02-spec 3.2: 3). A fixture may narrow it (the pace gate's one-cell door). */
export const DOOR = { wide: 3 };

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
  // The sandbox's chamber is 10 cells down (24 before sim 7). A colony game (sim 8, 02-spec 3.2) has a porch store
  // 3 cells under the entrance, which is home for loads, and the nursery and queen 12 cells down.
  const colony = !!sim.cfg.colony;
  const home = colony ? { x: sx - 2, y: 3, w: 6, h: 2 } : { x: sx - 8, y: 10, w: 16, h: 6 };
  const room = colony ? nurseryRect(L) : home;
  const nearShaft = (x, y) => Math.abs(x - sx) < 14 && y < room.y + 10;
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
  // The entrance (sim 10, 02-spec 3.2 Doors): 3 cells wide in a colony game, 2 in the sandbox; the shaft as wide.
  const doorWide = colony ? DOOR.wide : 2;
  for (let y = 0; y < room.y; y++) for (let x = sx; x < sx + doorWide; x++) sim.mat[cellAt(L, NEST, x, y)] = MAT.OPEN;
  for (const r of colony ? [home, room] : [home]) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) sim.mat[cellAt(L, NEST, x, y)] = MAT.OPEN;
  sim.home = home;
  if (colony) sim.nursery = room;

  // Entrance links: surface (ex + k, ey) to the top of the shaft.
  for (let k = 0; k < doorWide; k++) {
    const a = cellAt(L, SURFACE, ex + k, ey), b = cellAt(L, NEST, sx + k, 0);
    sim.mat[a] = MAT.OPEN;
    sim.link[a] = b; sim.link[b] = a;
  }

  if (colony) { firstFood(sim); return; }

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

// A colony game's first food (sim 8, 02-spec 3.2): a seed head of 30 sugar loads and a beetle of 20 protein loads,
// 8 to 12 cells from the entrance in two different compass directions (a straight step of d, a diagonal of 7d/10,
// then a jitter of a cell), each with a clear patch, visible from the start.
// The late find ("a third pile of 120 loads, mixed, past a stone at 2:00"): a pile holds one kind, so it is two
// piles of 60, side by side 25 to 35 cells out, behind a stone that stands between them and the entrance. The stone
// and the clearing are made here, so the terrain does not change mid-game; slots 2 and 3 keep the cells with no food
// until LATE_FIND_AT (lateFind). Further slots stay empty.
const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
function firstFood(sim) {
  const { L, rng } = sim, ex = L.sw >> 1, ey = L.sh >> 1, q0 = below(rng, W, 8), opening = [];
  for (let p = 0; p < 2; p++) {
    // A diagonal steps round(d / sqrt 2) on each axis; a straight step is jittered a cell sideways. Either way the
    // pile is 8 to 12 cells out (no jitter at 12), clamped inside a small map.
    const d = 8 + below(rng, W, 5), [dx, dy] = DIRS[(q0 + p * (3 + below(rng, W, 3))) & 7], j = below(rng, W, 3) - 1;
    const ax = dx && dy ? Math.round((dx * d * 707) / 1000) : dx * d + (dx || d === 12 ? 0 : j), ay = dx && dy ? Math.round((dy * d * 707) / 1000) : dy * d + (dy || d === 12 ? 0 : j);
    const px = Math.max(3, Math.min(L.sw - 4, ex + ax)), py = Math.max(3, Math.min(L.sh - 4, ey + ay));
    disc(sim, SURFACE, px, py, 2, MAT.OPEN, () => false); opening.push([px, py]);
    sim.pileCell[p] = cellAt(L, SURFACE, px, py); sim.pileAmount[p] = p === 0 ? 30 : 20; sim.pileKind[p] = p; // 0 sugar, 1 protein
  }
  const d = 25 + below(rng, W, 11), [dx, dy] = DIRS[below(rng, W, 8)], k = dx && dy ? 7 : 10;
  const px = Math.max(4, Math.min(L.sw - 5, ex + Math.trunc((dx * d * k) / 10))), py = Math.max(4, Math.min(L.sh - 5, ey + Math.trunc((dy * d * k) / 10)));
  // The stone keeps off the entrance and the opening piles' pickup cells (on a small map they can be near).
  const near = (x, y) => opening.some(([ox, oy]) => Math.abs(x - ox) < 4 && Math.abs(y - oy) < 4);
  disc(sim, SURFACE, px - Math.trunc((dx * 6 * k) / 10), py - Math.trunc((dy * 6 * k) / 10), 2, MAT.STONE,
    (x, y) => (Math.abs(x - ex) < 3 && Math.abs(y - ey) < 3) || near(x, y));
  disc(sim, SURFACE, px, py, 2, MAT.OPEN, () => false);
  for (let p = 2; p < sim.pileCell.length; p++) { sim.pileCell[p] = -1; sim.pileAmount[p] = 0; sim.pileKind[p] = 0; }
  if (sim.pileCell.length >= 4) for (let j = 0; j < 2; j++) {
    sim.pileCell[2 + j] = cellAt(L, SURFACE, px + (j ? 1 : -1) * (dy ? 1 : 0), py + (j ? 1 : -1) * (dy ? 0 : 1)); sim.pileKind[2 + j] = j;
  }
}

export const LATE_FIND_AT = 2400; // 2:00
/** The late find appears: slots 2 and 3 get 60 loads each (firstFood placed them). */
export function lateFind(sim, setGoal, slot0, goalFood, event) {
  for (let p = 2; p < 4 && p < sim.pileCell.length; p++) {
    const c = sim.pileCell[p];
    if (c < 0 || sim.pileAmount[p] > 0) continue;
    for (let i = 0; i < sim.n; i++) if (sim.mem[i] === slot0 + p) sim.mem[i] = -1;
    sim.pileAmount[p] = 60;
    setGoal(sim, slot0 + p, goalFood, c);
    event(p, sim.pileKind[p]);
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
    let near = false; // not on or beside a pile with food: pileAt() finds the lower slot first, so the new one would wait
    for (let k = 0; k < sim.pileCell.length && !near; k++) if (sim.pileAmount[k] > 0) { const q2 = sim.pileCell[k], qx = q2 % L.sw, qy = Math.floor(q2 / L.sw); near = Math.abs(qx - px) <= 2 && Math.abs(qy - py) <= 2; }
    if (near) continue;
    for (let i = 0; i < sim.n; i++) if (sim.mem[i] === slot0 + p) sim.mem[i] = -1; // the slot's old pile is gone: no ant remembers the new one
    const kind = sim.g[G.WINDFALLS] & 1 ? 0 : 1;
    sim.g[G.WINDFALLS]++;
    sim.pileCell[p] = c; sim.pileAmount[p] = 200 + below(rng, W, 200); sim.pileKind[p] = kind;
    setGoal(sim, slot0 + p, goalFood, c);
    event(p, kind);
    return;
  }
}
