// The ant-eating spider (02-spec 6.5, feature 12): it wears ant scent, so ants neither flee nor fight it, and it
// walks the colony's busiest trail eating the ants it meets. The answer is Recall: with the surface empty it finds
// nothing and leaves. It comes because of what the colony built (the trail with the most ants on it), once a day
// from day 2, and its first visit is the safe form (02-spec 8): it walks the map's top edge, where no trail runs.
//
// A visit, in ticks of a day of T ticks (so short test days still see it):
//   at T/4      it smells a trail: EVENT.SPIDER (WARN, slot or -1). Nothing moves yet; the page warns the player.
//   +WARN       it appears at the trail's far end (or the edge walk's start): EVENT.SPIDER (HUNT, slot)
//   hunting     one cell each MOVE ticks back along the trail toward the nest (it stops at the trail's start);
//               it eats the nearest ant on the surface within one cell (lowest index on a tie), then needs EAT ticks
//               before the next
//   it leaves   at its walk's end after HUNGER ticks with nothing to eat, after T/6 ticks of hunting (300 at least, or half a short day),
//               or at KILL_CAP kills:
//               EVENT.SPIDER (LEFT, kills). So does its trail removed or replaced: the scent it followed is gone.
// Its state is twelve globals (flow.js G.SP..), so it is hashed and snapshotted with them.
import { G, SLOT, PATH_MAX } from './flow.js';
import { SURFACE } from './grid.js';
import { hurt } from './colony.js';

export const SPIDER = { NONE: 0, WARN: 1, HUNT: 2, LEFT: 3 };
export const SP = { FROM_DAY: 2, MOVE: 10, EAT: 20, KILL_CAP: 30, EDGE: 6 };
const warnTicks = T => Math.max(20, (T / 30) | 0), hungerTicks = T => Math.max(40, (T / 40) | 0), huntTicks = T => Math.max(Math.min(300, T >> 1), (T / 6) | 0);

/** The live trail with the most surface ants on or beside its path now (ties: the newest), or -1. */
export function busiestTrail(sim) {
  const F = sim.flow, L = sim.L, near = new Int8Array(L.sw * L.sh).fill(-1), on = new Int32Array(SLOT.TRAILS);
  for (let k = 0; k < SLOT.TRAILS; k++) {
    if (!F.live[SLOT.TRAIL0 + k]) continue;
    const len = Math.min(F.pathLen[k], PATH_MAX);
    for (let j = 0; j < len; j++) {
      const c = F.path[k * PATH_MAX + j], x = c % L.sw, y = (c / L.sw) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < L.sw && ny < L.sh) near[ny * L.sw + nx] = k; // a cell beside two trails counts for the later slot
      }
    }
  }
  for (let i = 0; i < sim.n; i++) { if (sim.layer[i] !== SURFACE) continue; const k = near[(sim.y[i] >> 8) * L.sw + (sim.x[i] >> 8)]; if (k >= 0) on[k]++; }
  let best = -1;
  for (let k = 0; k < SLOT.TRAILS; k++) {
    const s = SLOT.TRAIL0 + k;
    if (!F.live[s] || F.pathLen[k] < 2) continue;
    if (best < 0 || on[k] > on[best - SLOT.TRAIL0] || (on[k] === on[best - SLOT.TRAIL0] && F.seq[s] > F.seq[best])) best = s;
  }
  return best;
}

/** The cell (x, y) at position i of the walk: a trail's path from its far end back to its start, or the top edge. */
function walkCell(sim, i) {
  const g = sim.g, L = sim.L;
  if (g[G.SP_SLOT] < 0) return [SP.EDGE + i, SP.EDGE];
  const k = g[G.SP_SLOT] - SLOT.TRAIL0, c = sim.flow.path[k * PATH_MAX + g[G.SP_LEN] - 1 - i];
  return [c % L.sw, (c / L.sw) | 0];
}

export function stepSpider(sim, spiderEvent) {
  const g = sim.g, T = sim.cfg.dayTicks, inDay = g[G.TICK] % T;
  const st = g[G.SP];
  if (st === SPIDER.NONE) {
    if (g[G.DAY] < SP.FROM_DAY || inDay !== (T >> 2)) return;
    const slot = g[G.SP_VISITS] === 0 ? -1 : busiestTrail(sim);
    g[G.SP] = SPIDER.WARN; g[G.SP_T] = 0; g[G.SP_SLOT] = slot; g[G.SP_I] = 0; g[G.SP_KILLS] = 0; g[G.SP_HUNGRY] = 0; g[G.SP_VISITS]++;
    if (slot >= 0) { g[G.SP_LEN] = Math.min(sim.flow.pathLen[slot - SLOT.TRAIL0], PATH_MAX); g[G.SP_SEQ] = sim.flow.seq[slot]; }
    else { g[G.SP_LEN] = sim.L.sw - 2 * SP.EDGE; g[G.SP_SEQ] = 0; }
    const [x, y] = walkCell(sim, 0); g[G.SP_X] = x; g[G.SP_Y] = y;
    sim.event(spiderEvent, SPIDER.WARN, slot);
    return;
  }
  g[G.SP_T]++;
  const slot = g[G.SP_SLOT];
  if (slot >= 0 && (!sim.flow.live[slot] || sim.flow.seq[slot] !== g[G.SP_SEQ])) { leave(sim, spiderEvent); return; } // its trail is gone
  if (st === SPIDER.WARN) {
    if (g[G.SP_T] >= warnTicks(T)) { g[G.SP] = SPIDER.HUNT; g[G.SP_T] = 0; sim.event(spiderEvent, SPIDER.HUNT, g[G.SP_SLOT]); }
    return;
  }
  // Hunting.
  if (g[G.SP_T] % SP.MOVE === 0 && g[G.SP_I] < g[G.SP_LEN] - 1) { g[G.SP_I]++; const [x, y] = walkCell(sim, g[G.SP_I]); g[G.SP_X] = x; g[G.SP_Y] = y; }
  g[G.SP_HUNGRY]++;
  if (g[G.SP_HUNGRY] >= SP.EAT) { // a meal takes EAT ticks; then it takes the next ant that comes within reach
    const cx = g[G.SP_X], cy = g[G.SP_Y];
    let prey = -1, best = 0x7fffffff;
    for (let i = 0; i < sim.n; i++) {
      if (sim.layer[i] !== SURFACE || sim.hp[i] === 0) continue;
      const dx = (sim.x[i] >> 8) - cx, dy = (sim.y[i] >> 8) - cy;
      if (dx < -1 || dx > 1 || dy < -1 || dy > 1) continue;
      const d = dx * dx + dy * dy;
      if (d < best) { best = d; prey = i; }
    }
    if (prey >= 0) { hurt(sim, prey, 0x7fff); g[G.SP_KILLS]++; g[G.SP_EATEN]++; g[G.SP_HUNGRY] = 0; }
  }
  const atEnd = g[G.SP_I] >= g[G.SP_LEN] - 1;
  if ((atEnd && g[G.SP_HUNGRY] >= hungerTicks(T)) || g[G.SP_T] >= huntTicks(T) || g[G.SP_KILLS] >= SP.KILL_CAP) leave(sim, spiderEvent);
}

function leave(sim, spiderEvent) {
  const g = sim.g;
  sim.event(spiderEvent, SPIDER.LEFT, g[G.SP_KILLS]);
  g[G.SP] = SPIDER.NONE; g[G.SP_T] = 0;
}
