// Flow fields: one breadth-first distance field per live goal over both layers, entrances as links.
//
// Cost grows with the number of goals, not ants: an ant reads the field under it. A field is rebuilt only
// when a change touches the area it covers (a cell it reached, or a cell next to one), and only at fixed
// points in the tick, so at every tick boundary no field is stale. That is why a snapshot can leave the
// distances out and rebuild them on restore: the rebuilt field equals the one the running sim holds.

import { MAT } from './grid.js';

export const INF = 0xFFFF;
export const GOAL = { NONE: 0, HOME: 1, EXIT: 2, DIG: 3, ALARM: 4, TRAIL: 5, FOOD: 6 };
// Fixed slots; the cap on live goals is the slot count.
export const SLOT = { HOME: 0, EXIT: 1, DIG: 2, ALARM: 3, TRAIL0: 4, TRAILS: 4, FOOD0: 8, FOODS: 8 };
export const MAX_GOALS = 16;

export function makeFlow(n) {
  return {
    kind: new Uint8Array(MAX_GOALS),
    live: new Uint8Array(MAX_GOALS),
    dirty: new Uint8Array(MAX_GOALS),
    cell: new Int32Array(MAX_GOALS).fill(-1), // the goal's cell for ALARM, TRAIL and FOOD
    seq: new Uint32Array(MAX_GOALS), // creation order, to replace the oldest trail
    dist: new Uint16Array(MAX_GOALS * n).fill(INF), // slot-major: dist[slot * n + cell]
    queue: new Int32Array(n), // scratch for the search; not state
    rebuilds: 0, repairs: 0, // counters for the spikes; not state
  };
}

export function setGoal(sim, slot, kind, cell = -1) {
  const F = sim.flow;
  F.kind[slot] = kind; F.live[slot] = 1; F.dirty[slot] = 1; F.cell[slot] = cell;
  F.seq[slot] = sim.g[G.GOAL_SEQ]++;
}

export function dropGoal(sim, slot) {
  const F = sim.flow, n = sim.L.n;
  F.kind[slot] = GOAL.NONE; F.live[slot] = 0; F.dirty[slot] = 0; F.cell[slot] = -1; F.seq[slot] = 0;
  F.dist.fill(INF, slot * n, slot * n + n);
}

// Globals indices shared with sim.js (kept here so flow.js does not import sim.js).
export const G = { TICK: 0, STORES: 1, RECALL: 2, ALARM_HOLD: 3, GOAL_SEQ: 4, DIG_COUNT: 5, DUG: 6, PICKED: 7, LATE: 8, DIG_CREW: 9, SIZE: 16 };

/** Push the goal's source cells (distance 0) in ascending cell order. */
function sources(sim, slot, push) {
  const { L, mat, flow: F } = sim, open = c => mat[c] === MAT.OPEN;
  switch (F.kind[slot]) {
    case GOAL.HOME: {
      const h = sim.home; // a nest rectangle
      for (let y = h.y; y < h.y + h.h; y++) for (let x = h.x; x < h.x + h.w; x++) {
        const c = L.nestBase + y * L.nw + x;
        if (open(c)) push(c);
      }
      break;
    }
    case GOAL.EXIT: // the surface side of every entrance
      for (let c = 0; c < L.nestBase; c++) if (sim.link[c] >= 0 && open(c)) push(c);
      break;
    case GOAL.DIG: // open cells next to a cell marked for digging
      for (let c = L.nestBase; c < L.n; c++) {
        if (!open(c)) continue;
        for (let k = 0; k < 4; k++) { const m = L.nb[c * 4 + k]; if (m >= 0 && sim.dig[m]) { push(c); break; } }
      }
      break;
    default:
      if (F.cell[slot] >= 0 && open(F.cell[slot])) push(F.cell[slot]);
  }
}

/** Rebuild one field from scratch. Neighbour order is fixed (up, right, down, left, link). */
export function rebuild(sim, slot) {
  const { L, mat, link, flow: F } = sim, n = L.n, nb = L.nb, q = F.queue, base = slot * n, d = F.dist;
  d.fill(INF, base, base + n);
  let head = 0, tail = 0;
  sources(sim, slot, c => { if (d[base + c] !== 0) { d[base + c] = 0; q[tail++] = c; } });
  while (head < tail) {
    const c = q[head++], nd = d[base + c] + 1;
    if (nd >= INF) continue; // cannot happen on 256x256 layers; keeps INF meaning unreachable
    for (let k = 0; k < 5; k++) {
      const m = k < 4 ? nb[c * 4 + k] : link[c];
      if (m < 0 || mat[m] !== MAT.OPEN || d[base + m] !== INF) continue;
      d[base + m] = nd; q[tail++] = m;
    }
  }
  F.dirty[slot] = 0;
  F.rebuilds++;
}

export function rebuildDirty(sim) {
  const F = sim.flow;
  for (let s = 0; s < MAX_GOALS; s++) if (F.live[s] && F.dirty[s]) rebuild(sim, s);
}

/** A cell changed between open and closed (it already has its new material).
 *  Closing: every live field that reached the cell, or has it as a source, is marked for a full rebuild
 *  (distances can grow, which a local repair cannot see cheaply).
 *  Opening, the common case (digging): distances can only shrink, so the field is repaired in place by a
 *  breadth-first relaxation from the new cell. Shortest distances are unique, so the repaired field equals
 *  a full rebuild cell for cell (tested in test/flow.test.mjs); the cost is the area that got closer.
 *  A cell that is one of the goal's sources still takes a full rebuild. */
export function terrainChanged(sim, c) {
  const { L, flow: F, link, mat } = sim, n = L.n, nb = L.nb, q = F.queue, opened = mat[c] === MAT.OPEN;
  for (let s = 0; s < MAX_GOALS; s++) {
    if (!F.live[s] || F.dirty[s]) continue;
    const base = s * n, d = F.dist;
    if (isSourceCell(sim, s, c)) { F.dirty[s] = 1; continue; }
    if (!opened) { if (d[base + c] !== INF) F.dirty[s] = 1; continue; }
    let best = INF;
    for (let k = 0; k < 5; k++) {
      const m = k < 4 ? nb[c * 4 + k] : link[c];
      if (m >= 0 && mat[m] === MAT.OPEN && d[base + m] + 1 < best) best = d[base + m] + 1;
    }
    if (best >= d[base + c]) continue; // nothing reaches it, or it is no shortcut
    d[base + c] = best;
    let head = 0, tail = 0;
    q[tail++] = c;
    while (head < tail) {
      const x = q[head++], nd = d[base + x] + 1;
      for (let k = 0; k < 5; k++) {
        const m = k < 4 ? nb[x * 4 + k] : link[x];
        if (m < 0 || mat[m] !== MAT.OPEN || d[base + m] <= nd) continue;
        d[base + m] = nd; q[tail++] = m;
      }
    }
    F.repairs++;
  }
}

function isSourceCell(sim, slot, c) {
  const { L, flow: F } = sim;
  switch (F.kind[slot]) {
    case GOAL.HOME: {
      if (c < L.nestBase) return false;
      const i = c - L.nestBase, x = i % L.nw, y = Math.floor(i / L.nw), h = sim.home;
      return x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h;
    }
    case GOAL.EXIT: return c < L.nestBase && sim.link[c] >= 0;
    case GOAL.DIG: return c >= L.nestBase; // sources depend on open cells next to marks: any nest change
    default: return c === F.cell[slot];
  }
}

/** The neighbour (or linked cell) one step closer to the goal, or -1 at the goal or when unreachable. */
export function nextCell(sim, slot, c) {
  const { L, mat, link, flow: F } = sim, base = slot * L.n, d = F.dist;
  let best = d[base + c], to = -1;
  if (best === INF || best === 0) return -1;
  for (let k = 0; k < 5; k++) {
    const m = k < 4 ? L.nb[c * 4 + k] : link[c];
    if (m < 0 || mat[m] !== MAT.OPEN) continue;
    if (d[base + m] < best) { best = d[base + m]; to = m; }
  }
  return to;
}

export const distAt = (sim, slot, c) => sim.flow.dist[slot * sim.L.n + c];
