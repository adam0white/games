// The puzzle book's ideas and the checks behind them. Pure; used by puzzles-make.mjs and bots.mjs (not by the page).
import { legal, apply, undo, clone, xy, solve, mulberry32, DY, DX } from './sim.js';

// One new idea per puzzle, in book order. min/max: the shortest scoring chain's length; size: the pitch.
export const IDEAS = [
  { id: 'net', min: 1, max: 2, ink: 12 },
  { id: 'wall', min: 2, max: 6, edge: true },
  { id: 'ink', min: 2, max: 5 },
  { id: 'twice', min: 3, max: 6 },
  { id: 'post', min: 2, max: 5 },
  { id: 'side', min: 2, max: 5 },
  { id: 'back', min: 3, max: 5 },
  { id: 'four', min: 4, max: 4 },
  { id: 'wide', min: 3, max: 5, size: [10, 8] },
  { id: 'cross', min: 3, max: 6 },
  { id: 'trap', min: 3, max: 5 },
  { id: 'long', min: 3, max: 6, size: [6, 12] },
  { id: 'corner', min: 3, max: 6 },
  { id: 'five', min: 5, max: 5, ink: 50 },
  { id: 'tiny', min: 3, max: 6, size: [4, 6] },
  { id: 'six', min: 6, max: 6, ink: 60 },
  { id: 'only', min: 4, max: 7, ink: 50 },
  { id: 'seven', min: 7, max: 7, ink: 70 },
];

// Walk a chain, calling visit(state, step, d, landed point) after each segment.
function walk(s, chain, visit) {
  const t = clone(s);
  chain.forEach((d, i) => { const before = clone(t); apply(t, d); visit(t, i, d, t.ball, before); });
}
const inked = (s, p, player) => s.log.some(([a, b, who]) => who === player && (a === p || b === p));
// True when segment a-b crosses an already drawn diagonal of the same unit square.
function crosses(st, a, b) {
  const A = xy(st, a), B = xy(st, b);
  if (A.x === B.x || A.y === B.y) return false;
  const c = st.g.idx(A.x, B.y), d = st.g.idx(B.x, A.y);
  return st.log.some(([p, q]) => (p === c && q === d) || (p === d && q === c));
}
// A deterministic greedy player: always the most goalward segment, then the one nearest the middle.
function greedyScores(s) {
  const t = clone(s);
  while (t.winner < 0 && t.turn === 0) {
    const ds = legal(t);
    ds.sort((a, b) => DY[a] - DY[b] || Math.abs(xy(t, t.g.next[t.ball * 8 + a]).x - t.w / 2) - Math.abs(xy(t, t.g.next[t.ball * 8 + b]).x - t.w / 2) || a - b);
    apply(t, ds[0]);
  }
  return t.winner === 0 && t.how === 'goal';
}

export function checkIdea(idea, s, sols) {
  if (!sols.length) return false;
  const L = sols[0].length, m = s.w / 2, every = f => sols.every(f);
  const lands = (chain, f) => { let hit = false; walk(s, chain.slice(0, -1), (t, i, d, p, before) => { if (f(t, p, before)) hit = true; }); return hit; };
  switch (idea.id) {
    case 'net': return xy(s, s.ball).y <= 2;
    case 'wall': return every(c => lands(c, (t, p) => { const q = xy(t, p); return q.x === 0 || q.x === t.w; }));
    case 'ink': return every(c => lands(c, (t, p, b) => b.g.bound[p] === 0));
    case 'twice': return every(c => { let n = 0; walk(s, c.slice(0, -1), () => n++); return n >= 2; }) && L >= 3;
    case 'post': return every(c => lands(c, (t, p) => { const q = xy(t, p); return q.y === 0 && Math.abs(q.x - m) === 1; }));
    case 'side': return every(c => DY[c[0]] === 0);
    case 'back': return every(c => DY[c[0]] > 0);
    case 'trap': return !greedyScores(s);
    case 'cross': return every(c => { let hit = false; walk(s, c, (t, i, d, p, b) => { if (crosses(b, b.ball, p)) hit = true; }); return hit; });
    case 'corner': { const q = xy(s, s.ball); return q.x <= 1 || q.x >= s.w - 1; }
    case 'only': return sols.length === 1;
    default: return true; // four, five, six, seven, wide, long, tiny: the length or the pitch is the idea
  }
}

// A clumsy player: each segment follows a shortest scoring chain with probability `skill`, else any legal segment.
// Three tries a puzzle, as on the page before the answer is offered. Returns true when one try scores.
export function clumsyClears(s, rng, skill = 0.75, tries = 3) {
  for (let k = 0; k < tries; k++) {
    const t = clone(s);
    while (t.winner < 0 && t.turn === 0) {
      const ds = legal(t), sol = rng() < skill ? solve(t, 7) : null;
      apply(t, sol ? sol[0] : ds[Math.floor(rng() * ds.length)]);
    }
    if (t.winner === 0 && t.how === 'goal') return true;
  }
  return false;
}
export function clumsyRate(s, n = 200, seed = 1, skill = 0.75) {
  let ok = 0;
  for (let i = 0; i < n; i++) if (clumsyClears(s, mulberry32(seed * 7919 + i), skill)) ok++;
  return ok / n;
}
