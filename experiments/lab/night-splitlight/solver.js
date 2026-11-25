// A solver that reads only what the player sees: the traced rays and the receivers on the rail.
// Used by bots.mjs (every level and many daily benches) and by the page to work out the daily bench's par.
import { BANDS, controlsOf, distanceAngle, trace } from './bench.js';

// How far the rays are from feeding every receiver; 0 means every receiver is fed (a moving receiver counts as fed
// when the ray lies on its path, since it will pass).
export function miss(level, targets, values) {
  const { rays } = trace(level, values);
  let total = 0;
  for (const target of targets) {
    const reach = target.width * .8 + (target.swing || 0);
    const gap = band => {
      let best = Infinity;
      for (const ray of rays) if (ray.band === band && ray.angle !== null) best = Math.min(best, distanceAngle(ray.angle, target.angle));
      return best === Infinity ? 4 : Math.max(0, best - reach);
    };
    total += target.band >= 0 ? gap(target.band) : BANDS.reduce((n, _, b) => n + gap(b), 0);
  }
  return total;
}

// Search the controls in `free` (indices); the others stay at `values`. Returns values with miss 0, or null.
export function search(level, targets, values, free, { coarse = 0 } = {}) {
  const k = free.length;
  if (!k) return miss(level, targets, values) === 0 ? values.slice() : null;
  const steps = coarse || (k === 1 ? 400 : k === 2 ? 60 : 22);
  let best = null, bestScore = Infinity;
  const v = values.slice();
  const total = (steps + 1) ** k;
  for (let n = 0; n < total; n++) {
    let rest = n;
    for (const c of free) { v[c] = (rest % (steps + 1)) / steps; rest = Math.floor(rest / (steps + 1)); }
    const score = miss(level, targets, v);
    if (score < bestScore) { bestScore = score; best = v.slice(); if (score === 0 && k > 1) break; }
    if (score === 0 && k === 1) break;
  }
  // refine around the best point: shrinking pattern search
  let step = 1 / steps;
  for (let round = 0; round < 40 && bestScore > 0; round++) {
    let improved = false;
    for (const c of free) for (const sign of [-1, 1]) {
      const t = best.slice(); t[c] = Math.max(0, Math.min(1, t[c] + sign * step));
      const s = miss(level, targets, t);
      if (s < bestScore) { bestScore = s; best = t; improved = true; }
    }
    if (!improved) step /= 2;
    if (step < 1e-4) break;
  }
  return bestScore === 0 ? centre(level, targets, best, free) : null;
}

// Move to the middle of the feasible stretch along each free control, as a careful player would.
function centre(level, targets, values, free) {
  const v = values.slice();
  for (const c of free) {
    let lo = v[c], hi = v[c];
    const ok = x => { const t = v.slice(); t[c] = x; return miss(level, targets, t) === 0; };
    while (lo > 0 && ok(Math.max(0, lo - .002))) lo = Math.max(0, lo - .002);
    while (hi < 1 && ok(Math.min(1, hi + .002))) hi = Math.min(1, hi + .002);
    v[c] = (lo + hi) / 2;
    if (!ok(v[c])) v[c] = values[c];
  }
  return v;
}

// Fewest turns: the smallest set of controls that must leave their start positions.
export function par(level, targets, start, answer = null) {
  const n = controlsOf(level).length;
  const all = Array.from({ length: n }, (_, i) => i);
  for (let size = 0; size <= n; size++) {
    if (size === n && n > 1 && answer) return { par: n, values: answer.slice(), moved: all };
    for (const free of subsets(all, size)) {
      const found = search(level, targets, start, free, { coarse: size === 3 ? 16 : 0 });
      if (found) return { par: size, values: found, moved: free };
    }
  }
  return { par: n, values: null, moved: all };
}
function* subsets(list, size, from = 0, acc = []) {
  if (acc.length === size) { yield acc.slice(); return; }
  for (let i = from; i < list.length; i++) { acc.push(list[i]); yield* subsets(list, size, i + 1, acc); acc.pop(); }
}
