// Scent fields: integer values per cell that spread to open neighbours and decay with a set half-life.
//
// Invariants (tested in test/scent.test.mjs):
// - Spreading conserves mass. Each pair of open neighbours exchanges trunc((a - b) * D / 256), the same
//   amount with opposite sign on each side, so diffusion alone never creates or loses scent. Measured decay
//   is then the decay step alone.
// - Walls hold none and pass none: a closed cell is written 0 and exchanges with nobody.
// - Decay reaches zero. Values are kept in 24 bits; each tick v loses floor(v * K / 2^32), but at least 1
//   while v > 0. With 24 bits the per-tick loss stays proportional (a true half-life) down to a few
//   thousandths of the maximum; an 8-bit field with multiply-and-round would stall at small values.
// - v * K must stay an exact double: v < 2^24 and K < 2^29, so v * K < 2^53. K < 2^29 holds for half-lives
//   of 8 ticks or more.
// - Double buffering: the update reads `cur` and writes every cell of `scratch`, then swaps. The scratch
//   buffer is overwritten whole each tick, so which buffer is which carries no state.

import { MAT } from './grid.js';

export const FIELD = { TRAIL: 0, FOOD: 1, ALARM: 2 };
export const FIELDS = 3;
export const SCENT_MAX = (1 << 24) - 1;
const TWO32 = 4294967296;

/** K for a half-life in ticks: the integer K with (1 - K/2^32)^h closest to 1/2. Uses only + - * / and
 *  comparisons on doubles, which are correctly rounded on every engine, so K is the same everywhere. */
export function decayK(halfLife) {
  if (!(halfLife >= 8 && halfLife <= 1e6) || halfLife !== Math.floor(halfLife)) throw new Error('half-life must be an integer 8..1e6 ticks');
  const powTo = (f, h) => { let r = 1, b = f; while (h > 0) { if (h & 1) r *= b; b *= b; h = Math.floor(h / 2); } return r; };
  let lo = 0, hi = 536870911; // K below 2^29
  while (lo < hi) { // smallest K whose factor^h is at or below 1/2
    const mid = Math.floor((lo + hi) / 2);
    if (powTo(1 - mid / TWO32, halfLife) <= 0.5) hi = mid; else lo = mid + 1;
  }
  return lo;
}

export function makeScent(n, cfg) {
  return {
    cur: Array.from({ length: FIELDS }, () => new Int32Array(n)),
    scratch: new Int32Array(n),
    // Per field: spread D/256 per neighbour per tick (at most 63 keeps values non-negative) and decay K.
    spread: cfg.spread.slice(),
    halfLife: cfg.halfLife.slice(),
    k: cfg.halfLife.map(decayK),
  };
}

export function deposit(sim, field, c, amount) {
  const f = sim.scent.cur[field], v = f[c] + amount;
  f[c] = v > SCENT_MAX ? SCENT_MAX : v;
}

/** Value at a cell for the sensors: -1 for a closed or missing cell. */
export function smell(sim, field, c) {
  return c < 0 || sim.mat[c] !== MAT.OPEN ? -1 : sim.scent.cur[field][c];
}

export function stepScent(sim) {
  const S = sim.scent, { L, mat } = sim, nb = L.nb, n = L.n;
  for (let f = 0; f < FIELDS; f++) {
    const cur = S.cur[f], out = S.scratch, D = S.spread[f], K = S.k[f];
    for (let c = 0; c < n; c++) {
      if (mat[c] !== MAT.OPEN) { out[c] = 0; continue; }
      const v = cur[c];
      let acc = v;
      for (let k = 0; k < 4; k++) {
        const m = nb[c * 4 + k];
        if (m < 0 || mat[m] !== MAT.OPEN) continue;
        const d = cur[m] - v;
        if (d > 0) acc += (d * D) >> 8; else if (d < 0) acc -= ((-d) * D) >> 8;
      }
      if (acc > 0) {
        let loss = Math.floor((acc * K) / TWO32);
        if (loss < 1) loss = 1;
        acc = acc > loss ? acc - loss : 0;
      }
      out[c] = acc;
    }
    S.scratch = cur;
    S.cur[f] = out;
  }
}
