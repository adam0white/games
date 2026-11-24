// Paper Pitch rules: paper soccer (https://en.wikipedia.org/wiki/Paper_soccer). Pure and seeded; runs in Node and the page.
// Points are (x, y) with 0 <= x <= w, 0 <= y <= h, plus the three points behind each goal mouth (y = -1 and y = h + 1).
// Player 0 (blue) attacks the top goal (y = -1); player 1 (red) attacks the bottom goal (y = h + 1).

export const DX = [0, 1, 1, 1, 0, -1, -1, -1];
export const DY = [-1, -1, 0, 1, 1, 1, 0, -1];

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

const geo = new Map();
// Geometry for a w x h pitch: point index, validity, and the boundary lines as direction bits per point.
function geometry(w, h) {
  const k = `${w}x${h}`;
  if (geo.has(k)) return geo.get(k);
  const cols = w + 1, rows = h + 3, n = cols * rows, m = w / 2;
  const idx = (x, y) => (y + 1) * cols + x;
  const valid = new Uint8Array(n), bound = new Uint8Array(n), next = new Int16Array(n * 8).fill(-1);
  const inGoal = x => x >= m - 1 && x <= m + 1;
  for (let y = -1; y <= h + 1; y++) for (let x = 0; x <= w; x++) {
    if (y >= 0 && y <= h) valid[idx(x, y)] = 1;
    else if (inGoal(x)) valid[idx(x, y)] = 2;
  }
  const isValid = (x, y) => x >= 0 && x <= w && y >= -1 && y <= h + 1 && valid[idx(x, y)] > 0;
  for (let y = -1; y <= h + 1; y++) for (let x = 0; x <= w; x++) {
    if (!isValid(x, y)) continue;
    for (let d = 0; d < 8; d++) {
      const tx = x + DX[d], ty = y + DY[d];
      if (!isValid(tx, ty)) continue;
      // Into a goal only from the mouth; a diagonal from beside a post would cut across the corner outside the pitch.
      if ((ty < 0 || ty > h) && !inGoal(x)) continue;
      next[idx(x, y) * 8 + d] = idx(tx, ty);
    }
  }
  const wall = (x1, y1, x2, y2) => {
    const d = DX.findIndex((dx, i) => dx === x2 - x1 && DY[i] === y2 - y1);
    bound[idx(x1, y1)] |= 1 << d; bound[idx(x2, y2)] |= 1 << ((d + 4) & 7);
  };
  for (let y = 0; y < h; y++) { wall(0, y, 0, y + 1); wall(w, y, w, y + 1); }
  for (let x = 0; x < w; x++) {
    // The goal line inside the mouth is open; the rest of each end line is boundary.
    if (x >= m - 1 && x + 1 <= m + 1) continue;
    wall(x, 0, x + 1, 0); wall(x, h, x + 1, h);
  }
  for (const [y0, y1] of [[0, -1], [h, h + 1]]) {
    wall(m - 1, y0, m - 1, y1); wall(m + 1, y0, m + 1, y1);
    wall(m - 1, y1, m, y1); wall(m, y1, m + 1, y1);
  }
  const g = { w, h, cols, n, idx, valid, bound, next, centre: idx(m, h / 2) };
  geo.set(k, g);
  return g;
}

export const RULES = { boundaryBounce: true };

export function create(w = 8, h = 10, first = 0, rules = RULES) {
  const g = geometry(w, h);
  return { w, h, g, rules, mask: Uint8Array.from(g.bound), ball: g.centre, turn: first, first, winner: -1, how: '', log: [] };
}
export function clone(s) { return { ...s, mask: Uint8Array.from(s.mask), log: s.log.slice() }; }
export const xy = (s, p) => ({ x: p % s.g.cols, y: Math.floor(p / s.g.cols) - 1 });
export const pointAt = (s, x, y) => s.g.idx(x, y);

export function legal(s) {
  const out = [];
  if (s.winner >= 0) return out;
  const m = s.mask[s.ball], base = s.ball * 8;
  for (let d = 0; d < 8; d++) if (s.g.next[base + d] >= 0 && !(m & (1 << d))) out.push(d);
  return out;
}
const hasMove = (s, p) => { const m = s.mask[p], base = p * 8; for (let d = 0; d < 8; d++) if (s.g.next[base + d] >= 0 && !(m & (1 << d))) return true; return false; };
export const target = (s, d) => s.g.next[s.ball * 8 + d];
// True when landing on p makes the mover go again: any line already touches p (with boundaryBounce off, only drawn lines).
export const bounces = (s, p) => (s.rules.boundaryBounce ? s.mask[p] : s.mask[p] & ~s.g.bound[p]) !== 0;

// Draw one segment in direction d. Mutates s; returns an undo record.
export function apply(s, d) {
  const from = s.ball, to = s.g.next[from * 8 + d], player = s.turn;
  const u = { from, turn: s.turn, winner: s.winner, how: s.how };
  const bounce = bounces(s, to);
  s.mask[from] |= 1 << d; s.mask[to] |= 1 << ((d + 4) & 7);
  s.ball = to; s.log.push([from, to, player]);
  const y = Math.floor(to / s.g.cols) - 1;
  if (y < 0 || y > s.h) {
    s.winner = y < 0 ? 0 : 1; s.how = s.winner === player ? 'goal' : 'own';
  } else {
    if (!bounce) s.turn = 1 - player;
    // Only a bounce can leave the mover with nowhere to go: a point with no lines has seven free exits.
    if (!hasMove(s, to)) { s.winner = 1 - s.turn; s.how = 'stuck'; }
  }
  u.bounce = bounce; u.d = d;
  return u;
}
export function undo(s, u) {
  s.mask[u.from] &= ~(1 << u.d); s.mask[s.ball] &= ~(1 << ((u.d + 4) & 7));
  s.ball = u.from; s.turn = u.turn; s.winner = u.winner; s.how = u.how; s.log.pop();
}
export function move(s, d) { const t = clone(s); apply(t, d); return t; }

// --- Bots. Each returns the whole turn as a list of directions. Pure: randomness only from the rng passed in.

// Rows from the ball to the goal player p attacks, and a pull to the middle near that goal.
function value(s, p) {
  if (s.winner >= 0) return s.winner === p ? 1e6 : -1e6;
  const { x, y } = xy(s, s.ball), dist = p === 0 ? y : s.h - y;
  return -10 * dist - 2 * Math.abs(x - s.w / 2) * (dist < 4 ? 1 : 0.3);
}
const goalward = (s, p, ds) => ds.slice().sort((a, b) => (p === 0 ? DY[a] - DY[b] : DY[b] - DY[a]) || a - b);

// Every way to finish this turn, depth first, goalward moves first, stopping after `cap` segments drawn.
function chains(s, cap, visit) {
  const p = s.turn, path = [];
  let nodes = 0, stop = false;
  (function go() {
    for (const d of goalward(s, p, legal(s))) {
      if (stop) return;
      if (++nodes > cap) { stop = true; return; }
      const u = apply(s, d); path.push(d);
      if (s.winner >= 0 || s.turn !== p) { if (visit(path, s) === false) stop = true; }
      else go();
      path.pop(); undo(s, u);
    }
  })();
  return nodes;
}
function easy(s, rng) {
  const t = clone(s), p = t.turn, out = [];
  while (t.winner < 0 && t.turn === p) {
    const ds = legal(t), safe = ds.filter(d => { const u = apply(t, d), ok = !(t.winner >= 0 && t.winner !== p); undo(t, u); return ok; });
    const pick = (safe.length ? safe : ds)[Math.floor(rng() * (safe.length || ds.length))];
    apply(t, pick); out.push(pick);
  }
  return out;
}
function bestChain(s, cap, score, rng) {
  const t = clone(s), p = t.turn;
  let best = null, bestV = -Infinity, ties = 0;
  chains(t, cap, (path, st) => {
    const v = score(st, p) - path.length * 0.01;
    if (v > bestV + 1e-9) { bestV = v; best = path.slice(); ties = 1; }
    else if (Math.abs(v - bestV) <= 1e-9 && rng() * ++ties < 1) best = path.slice();
    if (st.winner === p) return false;
  });
  return { chain: best, v: bestV };
}
function medium(s, rng) { return bestChain(s, 3000, value, rng).chain; }
function hard(s, rng) {
  const t = clone(s), p = t.turn, leaves = [], seen = new Set();
  let win = null;
  chains(t, 2500, (path, st) => {
    if (st.winner === p) { win = path.slice(); return false; }
    const key = st.ball + ':' + st.mask.join('');
    if (!seen.has(key)) { seen.add(key); leaves.push({ path: path.slice(), v: value(st, p) }); }
  });
  if (win) return win;
  leaves.sort((a, b) => b.v - a.v);
  let best = leaves[0].path, bestV = -Infinity;
  for (const leaf of leaves.slice(0, 14)) {
    if (leaf.v <= -1e6) continue;
    const us = leaf.path.map(d => apply(t, d));
    // One reply look-ahead: the opponent's best whole turn, judged from their side.
    const reply = t.winner >= 0 ? null : bestChain(t, 500, value, () => 0.5);
    const v = reply ? 0.6 * leaf.v - reply.v : leaf.v;
    for (let i = us.length - 1; i >= 0; i--) undo(t, us[i]);
    if (v > bestV) { bestV = v; best = leaf.path; }
  }
  return best;
}
export const LEVELS = ['Easy', 'Medium', 'Hard'];
export function botTurn(s, level, rng) { return [easy, medium, hard][level](s, rng); }

// --- Solver and daily puzzle.

// Shortest chain of segments, all in this turn, that puts the ball in the mover's target goal; null if none within maxLen.
export function solve(s, maxLen = 7) {
  const t = clone(s), p = t.turn, path = [];
  for (let limit = 1; limit <= maxLen; limit++) {
    const go = depth => {
      for (const d of legal(t)) {
        const u = apply(t, d); path.push(d);
        if (t.winner === p && t.how === 'goal') return true;
        if (t.winner < 0 && t.turn === p && depth + 1 < limit && go(depth + 1)) return true;
        path.pop(); undo(t, u);
      }
      return false;
    };
    if (go(0)) return path.slice();
  }
  return null;
}
// Today's pitch: seeded self-play on 8 x 10 until blue is to move with a shortest scoring chain of 3 to 7 segments.
export function daily(date) {
  const seed = hashString('pitch:' + date);
  for (let attempt = 0; attempt < 400; attempt++) {
    const rng = mulberry32(seed + attempt * 7919), s = create(8, 10, attempt & 1);
    const lean = 0.35 + rng() * 0.3;
    for (let ply = 0; ply < 160 && s.winner < 0; ply++) {
      if (s.turn === 0 && s.log.length >= 14) {
        const { y } = xy(s, s.ball);
        if (y <= 4) {
          const sol = solve(s, 7);
          if (sol && sol.length >= 3) return { date, state: s, solution: sol, attempt };
        }
      }
      // Both sides drift towards the top goal and never take an immediate goal or a stuck point, so ink piles up near it.
      const ds = legal(s).filter(d => { const u = apply(s, d), ok = s.winner < 0; undo(s, u); return ok; });
      if (!ds.length) break;
      const up = ds.filter(d => DY[d] < 0);
      const pool = up.length && rng() < lean ? up : ds;
      apply(s, pool[Math.floor(rng() * pool.length)]);
    }
  }
  return null;
}
export const snapshot = s => ({ w: s.w, h: s.h, ball: s.ball, turn: s.turn, first: s.first, winner: s.winner, how: s.how, log: s.log.map(e => e.slice()) });
export function restore(o, rules = RULES) {
  const s = create(o.w, o.h, o.first, rules);
  for (const [from, to, player] of o.log) { s.ball = from; s.turn = player; apply(s, DX.findIndex((dx, d) => s.g.next[from * 8 + d] === to)); }
  s.ball = o.ball; s.turn = o.turn; s.winner = o.winner; s.how = o.how;
  return s;
}
