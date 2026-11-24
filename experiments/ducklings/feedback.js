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
