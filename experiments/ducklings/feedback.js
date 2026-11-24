// Show only the conditions that cost this flock its third star.
export function starFeedback({ total, arrived, hits, scatters }) {
  const goals = [];
  if (arrived.length < total) goals.push(`bring all ${total} home`);
  const hazards = [];
  if (hits) hazards.push('hits');
  if (scatters) hazards.push('scares');
  if (hazards.length) goals.push(`avoid ${hazards.join(' and ')}`);
  return goals.length ? `For three stars, ${goals.join(' and ')}.` : '';
}

export function warningOnScreen(y, height) { return y >= 0 && y < height; }
