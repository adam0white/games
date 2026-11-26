// A pacer emits the same orders as the page. The log contains both sides' decisions.
import { areaAt, through } from './sim.js';

export const march = lane => (g, side) => g.t === 0 ? { type: 'trail', points: through(g, side, lane) } : null;
const rush = march(0);
const turn = (g, side) => {
  if (g.t === 0 || g.t === 740) return { type: 'trail', points: through(g, side, g.t ? 0 : 2) };
  return null;
};
function guard(g, side) {
  const [gap] = through(g, side, 1, false);
  if (g.t === 0 || g.t === 650) return { type: 'trail', points: through(g, side, 1, g.t > 0) };
  if (g.t === 10) return { type: 'alarm', spot: gap };
  if (g.t === 640) return { type: 'quiet' };
  return null;
}

export function readFront(g, side) {
  if (g.t === 0) return { type: 'trail', points: through(g, side, 1, false) };
  if (g.t % 150 !== 0) return null;
  const targets = [0, 0, 0];
  for (const a of g.sides[1 - side].ants) if (a.role === 'guard' || a.role === 'trail') targets[areaAt(a.pts)]++;
  const lane = targets.indexOf(Math.max(...targets));
  const points = through(g, side, lane);
  return points.every((p, i) => p === g.sides[side].trail[i]) ? null : { type: 'trail', points };
}

export const RIVALS = {
  thornbacks: { army: [50, 10], mind: rush },
  jarkeepers: { army: [43, 21], mind: guard },
  leafstitchers: { army: [52, 14], mind: turn },
};
