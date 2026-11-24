// Each failed condition has its own picture on the three-star card.
export function starFeedback({ total, arrived, hits, scatters }) {
  const goals = [];
  if (arrived.length < total) goals.push('nest');
  if (hits) goals.push('heart');
  if (scatters) goals.push('scatter');
  return goals;
}

export function warningOnScreen(y, height) { return y >= 0 && y < height; }
