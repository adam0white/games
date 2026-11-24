// Each failed condition has its own picture on the three-star card.
export function starFeedback({ total, arrived, hits, scatters }) {
  const goals = [];
  if (arrived.length < total) goals.push('nest');
  if (hits) goals.push('heart');
  if (scatters) goals.push('scatter');
  return goals;
}

export function warningOnScreen(y, height) { return y >= 0 && y < height; }

// The offscreen nest marker sits at markerTop. It shows only once the nest has nearly left the screen,
// so it never covers the nest or the ducklings waiting beside it. All values are canvas pixels; u is the pond width.
export function nestMarkerShows(nestY, markerTop, u) { return nestY + .10 * u < markerTop; }

// Endless: the lily-pad direction cue shows at the start, near sunset, and whenever she has swum back
// more than half a pond width from her furthest point, so a player chasing strays downstream can find the way on.
export function padCueShows(waiting, secondsLeft, best, y) { return waiting || secondsLeft <= 10 || best - y > .5; }

// Folding leaves: the rustle is a countdown drawn round the patch, from 1 (just touched) to 0 (folded).
export function leafLeft(triggeredAt, warning, t) {
  if (triggeredAt === null) return null;
  const age = t - triggeredAt;
  return age >= 0 && age < warning ? 1 - age / warning : null;
}
// The quack that brings the whole line over the leaves on stage 16 while she keeps swimming. Measured with
// steering straight at the nest: a quack from 0.05 to 0.75 s into the rustle brings all three home, so the cue
// opens a little late and closes early, and a thumb that reacts within half a second still lands inside.
export const LEAF_QUACK = { from: 0.12, to: 0.62 };
export function leafQuackCue(triggeredAt, t) {
  if (triggeredAt === null) return false;
  const age = t - triggeredAt;
  return age >= LEAF_QUACK.from && age < LEAF_QUACK.to;
}

// Current: marks that ride the water at exactly the current's own velocity, so how fast and which way the
// marks move is how hard and where the current pushes her. Each mark enters at the downstream edge,
// drifts with (dx, dy) and leaves at the upstream edge. World units; t in seconds.
export function driftMarks(h, t, lanes = 3, spacing = .22) {
  const speed = Math.hypot(h.dx, h.dy), life = (h.y1 - h.y0) / h.dy, every = spacing / h.dy, out = [];
  for (let i = 0; i < lanes; i++) {
    const lane = h.x + (lanes > 1 ? i / (lanes - 1) * 2 - 1 : 0) * h.w * .55;
    for (let k = 0; k * every < life; k++) {
      const age = ((t + i * every / lanes + k * every) % life + life) % life;
      out.push({ x: lane + h.dx * age, y: h.y0 + h.dy * age, angle: Math.atan2(h.dx, h.dy), len: .03 + .1 * speed, fade: Math.min(1, age / .35, (life - age) / .35) });
    }
  }
  return out;
}
