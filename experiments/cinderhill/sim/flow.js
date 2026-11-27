// Flow fields: one shortest-distance field per live goal over both layers, entrances as links.
//
// Ants move in eight directions. A step to an orthogonal neighbour costs STEP, a diagonal step costs DIAG
// (5 and 7: the octile ratio 1.4 against the true 1.414), and an entrance link costs STEP. A diagonal step
// needs its target and both side cells open, so no path cuts a wall's corner (grid.js `diagOpen`).
// Fields are built by Dial's bucket queue (costs are small integers); shortest distances are unique, so the
// order inside a bucket does not change the result.
//
// Cost grows with the number of goals, not ants: an ant reads the field under it. A field is rebuilt only
// when a change touches the area it covers (a cell it reached, or a cell next to one), and only at fixed
// points in the tick, so at every tick boundary no field is stale. That is why a snapshot can leave the
// distances out and rebuild them on restore: the rebuilt field equals the one the running sim holds.

import { MAT, diagOpen } from './grid.js';

export const INF = 0xFFFF;
export const STEP = 5, DIAG = 7; // distance units: an orthogonal step, a diagonal step (and a link costs STEP)
export const GOAL = { NONE: 0, HOME: 1, EXIT: 2, DIG: 3, ALARM: 4, TRAIL: 5, FOOD: 6 };
// Fixed slots; the cap on live goals is the slot count.
export const SLOT = { HOME: 0, EXIT: 1, DIG: 2, ALARM: 3, TRAIL0: 4, TRAILS: 4, FOOD0: 8, FOODS: 8 };
export const MAX_GOALS = 16;
// A trail's shape: the stroke as an ordered, 8-connected path of open surface cells (built by the sim when
// the order applies; a diagonal step keeps the corner rule). Its field is not plain distance: a cell on the
// path holds the number of path steps still to walk to the trail's end (0 at the end), a cell off it holds
// TRAIL_OFF plus its distance (in STEP and DIAG units) to the nearest path cell. Descending the field from
// off the path reaches the trail, then walks it in the drawn order.
export const PATH_MAX = 2048, TRAIL_OFF = 4096;
const NB = 16;
export const isTrailSlot = s => s >= SLOT.TRAIL0 && s < SLOT.TRAIL0 + SLOT.TRAILS;

export function makeFlow(n) {
  return {
    kind: new Uint8Array(MAX_GOALS),
    live: new Uint8Array(MAX_GOALS),
    dirty: new Uint8Array(MAX_GOALS),
    cell: new Int32Array(MAX_GOALS).fill(-1), // the goal's cell for ALARM, TRAIL and FOOD
    seq: new Uint32Array(MAX_GOALS), // creation order, to replace the oldest trail
    dist: new Uint16Array(MAX_GOALS * n).fill(INF), // slot-major: dist[slot * n + cell]
    pathLen: new Uint16Array(SLOT.TRAILS), // cells in each trail slot's path
    path: new Int32Array(SLOT.TRAILS * PATH_MAX), // trail slot k's path: path[k * PATH_MAX + index], start first
    queue: new Int32Array(n), // scratch for the search; not state
    // Dial's buckets, indexed by distance mod 16; not state. Each grows on demand.
    buckets: Array.from({ length: NB }, () => new Int32Array(1024)), btail: new Int32Array(NB), pending: 0,
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
  if (isTrailSlot(slot)) sim.g[G.WANT0 + slot - SLOT.TRAIL0] = 0;
  F.kind[slot] = GOAL.NONE; F.live[slot] = 0; F.dirty[slot] = 0; F.cell[slot] = -1; F.seq[slot] = 0;
  F.dist.fill(INF, slot * n, slot * n + n);
}

// Globals indices shared with sim.js (kept here so flow.js does not import sim.js).
// Globals. STORES counts loads brought home (ever); SUGAR and PROTEIN are the stores in units (colony.js).
export const G = { TICK: 0, STORES: 1, RECALL: 2, ALARM_HOLD: 3, GOAL_SEQ: 4, DIG_COUNT: 5, DUG: 6, PICKED: 7, LATE: 8, DIG_CREW: 9,
  SUGAR: 10, PROTEIN: 11, QUEEN: 12, LAY: 13, BORN: 14, HUNGRY: 15, BROOD_LOST: 16, DIED: 17,
  // Days (colony.js): the day number, the goal's counters at dawn, days won, the last dusk, an eased goal, and
  // loads brought home along a trail, of sugar and of protein (ever).
  DAY: 18, BASE_A: 19, BASE_B: 20, DAYS_WON: 21, DAY_LAST: 22, EASED: 23, TRAIL_LOADS: 24, SUGAR_LOADS: 25, PROTEIN_LOADS: 26,
  // The spider (spider.js): state, cell, ticks in state, the trail slot it walks (-1: the edge walk), where it is on
  // its walk, ticks since it last ate, kills this visit, ants eaten ever, visits so far, its walk's length, and the
  // trail's creation number (a trail replaced in that slot ends the visit).
  SP: 27, SP_X: 28, SP_Y: 29, SP_T: 30, SP_SLOT: 31, SP_I: 32, SP_HUNGRY: 33, SP_KILLS: 34, SP_EATEN: 35, SP_VISITS: 36, SP_LEN: 37, SP_SEQ: 38,
  // Windfalls (world.js): new piles fallen so far.
  WINDFALLS: 39,
  // Crews (CMD.CREW): the ants each trail slot wants, plus one; 0 is "as many as come" (the newest trail recruits).
  WANT0: 40,
  // Crew levels (sim 9, 02-spec 3.2 Crews): per trail slot 0 a set count, 1 Light, 2 Steady, 3 Surge; the outside
  // workforce when the levels' sizes were last worked out; ticks the sugar store has stood at 0 (starvation).
  LEVEL0: 44, WORKFORCE: 48, STARVE: 49,
  SIZE: 50 };

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

/** Rebuild one field from scratch. */
export function rebuild(sim, slot) {
  const { L, flow: F } = sim, n = L.n, base = slot * n, d = F.dist;
  d.fill(INF, base, base + n);
  if (isTrailSlot(slot) && F.kind[slot] === GOAL.TRAIL) return rebuildTrail(sim, slot);
  F.btail.fill(0); F.pending = 0;
  let any = false;
  sources(sim, slot, c => { if (d[base + c] !== 0) { d[base + c] = 0; push(F, c, 0); any = true; } });
  if (any) settle(sim, base, 0);
  F.dirty[slot] = 0;
  F.rebuilds++;
}

function push(F, c, key) {
  const b = key & (NB - 1);
  let q = F.buckets[b];
  if (F.btail[b] === q.length) { const g = new Int32Array(q.length * 2); g.set(q); F.buckets[b] = q = g; }
  q[F.btail[b]++] = c; F.pending++;
}

/** Lower the distance of each open neighbour (8 directions with the corner rule, and the link unless
 *  `surface`) of `c` to `from + cost` where that is lower; push each lowered cell. `from` is d[c], except
 *  for a trail's path cells, which act as sources at TRAIL_OFF. The orthogonal neighbours' open flags are
 *  read once and reused for the corner rule (the same rule as grid.js `diagOpen`). */
function relax(sim, base, c, from, surface = false) {
  const { L, mat, link, flow: F } = sim, nb = L.nb, dg = L.dg, d = F.dist, o = c * 4;
  const nd = from + STEP, nd2 = from + DIAG;
  if (nd >= INF) return;
  const m0 = nb[o], m1 = nb[o + 1], m2 = nb[o + 2], m3 = nb[o + 3];
  const o0 = m0 >= 0 && mat[m0] === 0, o1 = m1 >= 0 && mat[m1] === 0, o2 = m2 >= 0 && mat[m2] === 0, o3 = m3 >= 0 && mat[m3] === 0;
  if (o0 && d[base + m0] > nd) { d[base + m0] = nd; push(F, m0, nd); }
  if (o1 && d[base + m1] > nd) { d[base + m1] = nd; push(F, m1, nd); }
  if (o2 && d[base + m2] > nd) { d[base + m2] = nd; push(F, m2, nd); }
  if (o3 && d[base + m3] > nd) { d[base + m3] = nd; push(F, m3, nd); }
  if (!surface) {
    const m = link[c];
    if (m >= 0 && mat[m] === 0 && d[base + m] > nd) { d[base + m] = nd; push(F, m, nd); }
  }
  if (nd2 >= INF) return;
  let m;
  if (o0 && o1 && (m = dg[o]) >= 0 && mat[m] === 0 && d[base + m] > nd2) { d[base + m] = nd2; push(F, m, nd2); }
  if (o1 && o2 && (m = dg[o + 1]) >= 0 && mat[m] === 0 && d[base + m] > nd2) { d[base + m] = nd2; push(F, m, nd2); }
  if (o2 && o3 && (m = dg[o + 2]) >= 0 && mat[m] === 0 && d[base + m] > nd2) { d[base + m] = nd2; push(F, m, nd2); }
  if (o3 && o0 && (m = dg[o + 3]) >= 0 && mat[m] === 0 && d[base + m] > nd2) { d[base + m] = nd2; push(F, m, nd2); }
}

/** Pop buckets in distance order from `cur` until none are pending. A cell popped with a key that is no
 *  longer its distance was lowered again later and is skipped. A relax pushes keys cur + 5 and cur + 7,
 *  never cur + 16, so a bucket being popped gains no entries; an entry 16 or more ahead (a repair's seeds
 *  can spread) stays in its bucket for its turn. */
function settle(sim, base, cur, trailSurface = false) {
  // relax() inlined with everything in locals: this loop is most of a field's cost.
  const { L, mat, link, flow: F } = sim, nb = L.nb, dg = L.dg, d = F.dist, B = F.buckets, T = F.btail;
  let pending = F.pending;
  const put = (m, v) => {
    const b = v & (NB - 1);
    let q = B[b];
    if (T[b] === q.length) { const g = new Int32Array(q.length * 2); g.set(q); B[b] = q = g; }
    q[T[b]++] = m; pending++;
  };
  while (pending > 0 && cur < INF) {
    const b = cur & (NB - 1), len = T[b], bucket = B[b];
    let keep = 0;
    const nd = cur + STEP, nd2 = cur + DIAG;
    for (let i = 0; i < len; i++) {
      const c = bucket[i], v = d[base + c];
      if (v > cur) { bucket[keep++] = c; continue; } // a key 16 or more ahead in the same bucket: kept for later
      pending--;
      if (v !== cur || nd >= INF) continue; // lowered again since it was pushed: handled at its lower key
      const o = c * 4, m0 = nb[o], m1 = nb[o + 1], m2 = nb[o + 2], m3 = nb[o + 3];
      const o0 = m0 >= 0 && mat[m0] === 0, o1 = m1 >= 0 && mat[m1] === 0, o2 = m2 >= 0 && mat[m2] === 0, o3 = m3 >= 0 && mat[m3] === 0;
      if (o0 && d[base + m0] > nd) { d[base + m0] = nd; put(m0, nd); }
      if (o1 && d[base + m1] > nd) { d[base + m1] = nd; put(m1, nd); }
      if (o2 && d[base + m2] > nd) { d[base + m2] = nd; put(m2, nd); }
      if (o3 && d[base + m3] > nd) { d[base + m3] = nd; put(m3, nd); }
      if (!trailSurface) { const m = link[c]; if (m >= 0 && mat[m] === 0 && d[base + m] > nd) { d[base + m] = nd; put(m, nd); } }
      if (nd2 >= INF) continue;
      let m;
      if (o0 && o1 && (m = dg[o]) >= 0 && mat[m] === 0 && d[base + m] > nd2) { d[base + m] = nd2; put(m, nd2); }
      if (o1 && o2 && (m = dg[o + 1]) >= 0 && mat[m] === 0 && d[base + m] > nd2) { d[base + m] = nd2; put(m, nd2); }
      if (o2 && o3 && (m = dg[o + 2]) >= 0 && mat[m] === 0 && d[base + m] > nd2) { d[base + m] = nd2; put(m, nd2); }
      if (o3 && o0 && (m = dg[o + 3]) >= 0 && mat[m] === 0 && d[base + m] > nd2) { d[base + m] = nd2; put(m, nd2); }
    }
    T[b] = keep;
    cur++;
  }
  T.fill(0); F.pending = 0;
}

/** A trail's field (see PATH_MAX above): path cells first, in path order, then a shortest-distance search
 *  outward on the surface only. Trails are surface orders and nest ants head for the exit first, so the
 *  field never crosses an entrance and nest digging never touches it. */
function rebuildTrail(sim, slot) {
  const { L, mat, flow: F } = sim, base = slot * L.n, d = F.dist, k = slot - SLOT.TRAIL0;
  const len = F.pathLen[k] < PATH_MAX ? F.pathLen[k] : PATH_MAX, at = k * PATH_MAX;
  F.btail.fill(0); F.pending = 0;
  for (let j = 0; j < len; j++) {
    const c = F.path[at + j];
    if (c < 0 || c >= L.nestBase || mat[c] !== MAT.OPEN || d[base + c] !== INF) continue;
    d[base + c] = len - 1 - j;
  }
  // Every path cell is a source at TRAIL_OFF for the cells off the path (path values stay below TRAIL_OFF,
  // so they are never lowered). Links are not followed: a link cell's other side is in the nest.
  for (let j = 0; j < len; j++) {
    const c = F.path[at + j];
    if (c >= 0 && c < L.nestBase && mat[c] === MAT.OPEN) relax(sim, base, c, TRAIL_OFF, true);
  }
  settle(sim, base, TRAIL_OFF, true);
  F.dirty[slot] = 0;
  F.rebuilds++;
}

export function rebuildDirty(sim) {
  const F = sim.flow;
  for (let s = 0; s < MAX_GOALS; s++) if (F.live[s] && F.dirty[s]) rebuild(sim, s);
}

/** A cell changed between open and closed (it already has its new material).
 *  Closing: every live field that reached the cell, or has it as a source, is marked for a full rebuild
 *  (distances can grow, which a local repair cannot see cheaply). A closed cell also blocks the diagonals
 *  it was a side of; those join cells next to it, so a field that did not reach it is not affected.
 *  Opening, the common case (digging): distances can only shrink, so the field is repaired in place. The new
 *  cell and its eight neighbours are each lowered to their best neighbour plus the step cost (the new cell
 *  opens steps into itself and diagonals between its orthogonal neighbours), then the lowered cells relax
 *  outward in distance order. Shortest distances are unique, so the repaired field equals a full rebuild
 *  cell for cell (tested in test/flow.test.mjs); the cost is the area that got closer.
 *  A cell that is one of the goal's sources still takes a full rebuild. */
export function terrainChanged(sim, c) {
  const { L, flow: F, mat } = sim, n = L.n, opened = mat[c] === MAT.OPEN;
  for (let s = 0; s < MAX_GOALS; s++) {
    if (!F.live[s] || F.dirty[s]) continue;
    const base = s * n, d = F.dist;
    // A trail's field is not uniform distance, so the in-place repair below does not apply: any surface
    // change rebuilds it. Nest changes never reach it.
    if (isTrailSlot(s) && F.kind[s] === GOAL.TRAIL) { if (c < L.nestBase) F.dirty[s] = 1; continue; }
    if (isSourceCell(sim, s, c)) { F.dirty[s] = 1; continue; }
    if (!opened) { if (d[base + c] !== INF) F.dirty[s] = 1; continue; }
    F.btail.fill(0); F.pending = 0;
    let low = INF;
    const lower = x => {
      if (x < 0 || mat[x] !== MAT.OPEN) return;
      const v = bestVia(sim, base, x);
      if (v < d[base + x]) { d[base + x] = v; push(F, x, v); if (v < low) low = v; }
    };
    lower(c);
    for (let k = 0; k < 4; k++) { lower(L.nb[c * 4 + k]); lower(L.dg[c * 4 + k]); }
    if (low === INF) continue; // nothing got closer
    settle(sim, base, low);
    F.repairs++;
  }
}

/** The lowest neighbour distance plus its step cost into cell x (8 directions with the corner rule, and
 *  the link), or INF. */
function bestVia(sim, base, x) {
  const { L, mat, link, flow: F } = sim, nb = L.nb, d = F.dist;
  let best = INF;
  for (let k = 0; k < 4; k++) {
    const m = nb[x * 4 + k];
    if (m >= 0 && mat[m] === MAT.OPEN && d[base + m] + STEP < best) best = d[base + m] + STEP;
    const q = diagOpen(L, mat, x, k);
    if (q >= 0 && d[base + q] + DIAG < best) best = d[base + q] + DIAG;
  }
  const m = link[x];
  if (m >= 0 && mat[m] === MAT.OPEN && d[base + m] + STEP < best) best = d[base + m] + STEP;
  return best;
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

/** The neighbour one step along a shortest way to the goal (8 directions with the corner rule, or the
 *  link), or -1 at the goal or when unreachable. It takes the neighbour with the lowest distance plus step
 *  cost, and only one strictly closer, so following it never loops; ties go to the first in the fixed order
 *  (up, right, down, left, the four diagonals, the link). On a trail's path the values are path steps, so
 *  this walks the path in order. */
export function nextCell(sim, slot, c) {
  const { L, mat, link, flow: F } = sim, base = slot * L.n, d = F.dist, nb = L.nb, here = d[base + c];
  if (here === INF || here === 0) return -1;
  // A trail's values on its path are path steps, not walking cost. On the path, the next cell is the one that
  // holds one less (as backCell takes one more), so a bend that comes back beside itself is still walked.
  // Off the path, every path cell counts as TRAIL_OFF, so an ant joins the trail at the nearest path cell, not
  // at the one nearest the trail's end.
  const trail = isTrailSlot(slot);
  if (trail && here < TRAIL_OFF) {
    const want = here - 1;
    for (let k = 0; k < 4; k++) { const m = nb[c * 4 + k]; if (m >= 0 && mat[m] === MAT.OPEN && d[base + m] === want) return m; }
    for (let k = 0; k < 4; k++) { const m = diagOpen(L, mat, c, k); if (m >= 0 && d[base + m] === want) return m; }
  }
  const floor = trail && here >= TRAIL_OFF ? TRAIL_OFF : 0;
  let best = INF + DIAG, to = -1;
  for (let k = 0; k < 4; k++) {
    const m = nb[c * 4 + k];
    if (m < 0 || mat[m] !== MAT.OPEN) continue;
    let v = d[base + m];
    if (v < floor) v = floor;
    if (v < here && v + STEP < best) { best = v + STEP; to = m; }
  }
  for (let k = 0; k < 4; k++) {
    const m = diagOpen(L, mat, c, k);
    if (m < 0) continue;
    let v = d[base + m];
    if (v < floor) v = floor;
    if (v < here && v + DIAG < best) { best = v + DIAG; to = m; }
  }
  const m = link[c];
  if (m >= 0 && mat[m] === MAT.OPEN) { const v = d[base + m]; if (v < here && v + STEP < best) to = m; }
  return to;
}

/** Walking a trail backward (toward its start): on the path, the previous path cell; off it, the way to the
 *  nearest path cell; -1 at the start or when unreachable. */
export function backCell(sim, slot, c) {
  const { L, mat, flow: F } = sim, base = slot * L.n, d = F.dist, v = d[base + c];
  if (v >= TRAIL_OFF) return nextCell(sim, slot, c);
  const want = v + 1;
  for (let e = 0; e < 4; e++) {
    const m = L.nb[c * 4 + e];
    if (m >= 0 && mat[m] === MAT.OPEN && d[base + m] === want) return m;
  }
  for (let e = 0; e < 4; e++) {
    const m = diagOpen(L, mat, c, e);
    if (m >= 0 && d[base + m] === want) return m;
  }
  return -1;
}

/** Steps still to walk backward to a trail's start: the path index on the path, TRAIL_OFF plus steps off it. */
export function backDist(sim, slot, c) {
  const v = sim.flow.dist[slot * sim.L.n + c];
  return v >= TRAIL_OFF ? v : sim.flow.pathLen[slot - SLOT.TRAIL0] - 1 - v;
}

export const distAt = (sim, slot, c) => sim.flow.dist[slot * sim.L.n + c];
