// What the page pictures for the player at this moment. No page or sim imports, so the bots read the same answer.
//   cue(game) -> null or { kind, ... }
//     'drag'    the first evening: a finger behind the flock, moving uphill
//     'outrun'  the bellwether grazes apart: flick towards `dir` (-1 left, 1 right)
//     'circle'  the dog is on its outrun: nothing to do
//     'wolf'    eyes or a wolf at { x, y }: take the dog there
//     'bring'   drive the flock to { x, y }: the next bridge, cross-gate or lane, or else the fold
//     'hold'    sheep wait at the closed cross-gate: press and keep still at { x, y }
//     'edge'    a sheep is on a bank: put the dog at { x, y }, on the far side of it
export const HOLD_BELOW = 57;
export const EDGE_NEAR = 12;
const leftEdge = y => 53 + 7 * Math.sin(y * 0.023) + 6 * Math.sin(y * 0.044 + 1.3);
const rightEdge = y => 307 + 10 * Math.sin(y * 0.018 + 1.5) + 5 * Math.sin(y * 0.039);

// The sheep nearest a bank, when one is within EDGE_NEAR of it. The uncalled bellwether grazes the verge on purpose.
export function atBank(game) {
  let worst = null, least = EDGE_NEAR;
  const patch = game.terrain.outrun;
  for (const s of game.sheep) {
    if (s.status !== 'field' || (patch && !patch.gathered && s.id === game.leadId)) continue;
    const l = s.x - leftEdge(s.y), r = rightEdge(s.y) - s.x, d = Math.min(l, r);
    if (d < least) { least = d; worst = { x: s.x + (l < r ? -22 : 22), y: s.y + 5, side: l < r ? -1 : 1, sheep: s.id }; }
  }
  return worst;
}

export function waiting(game) {
  const gate = game.terrain.gate;
  if (!gate || gate.open) return [];
  return game.sheep.filter(s => s.status === 'field' && s.y >= gate.y && s.y < gate.y + 30 &&
    Math.abs(s.x - gate.x) < gate.width / 2);
}

// The next narrow place the lowest sheep has still to pass: the bridge, the cross-gate or the lane.
export function opening(game) {
  const { bridge, gate, lane } = game.terrain;
  let rear = null;
  for (const s of game.sheep) if (s.status === 'field' && (!rear || s.y > rear.y)) rear = s;
  if (!rear) return null;
  let next = null;
  for (const b of [bridge, gate, lane]) if (b && rear.y >= b.y + b.height - .1 && (!next || b.y > next.y)) next = b;
  return next;
}

export function cue(game) {
  if (game.status !== 'play') return null;
  const { outrun, gate } = game.terrain;
  const bank = atBank(game);
  if (bank) return { kind: 'edge', ...bank };
  if (outrun && !outrun.gathered) {
    return game.dog.mode === 'outrun' ? { kind: 'circle' } : { kind: 'outrun', dir: outrun.x < 180 ? -1 : 1 };
  }
  const wolf = game.wolf;
  if (wolf && (wolf.phase === 'eyes' || wolf.active)) return { kind: 'wolf', x: wolf.x, y: wolf.y };
  if (gate && !gate.open && waiting(game).length) return { kind: 'hold', x: gate.x, y: gate.y + HOLD_BELOW };
  const next = opening(game);
  if (next) return { kind: 'bring', x: next.x, y: next.y + next.height };
  if (game.level === 1) return { kind: 'drag' };
  // Nothing narrow is left: the line runs to the fold.
  return { kind: 'bring', x: game.gate.x, y: game.gate.y, fold: true };
}

// While the dog circles an uncalled bellwether, a finger on the field does not call it off.
export function steerable(game) {
  return !(game.dog.mode === 'outrun' && game.terrain.outrun && !game.terrain.outrun.gathered);
}
