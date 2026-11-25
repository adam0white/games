// One finger's stroke across the garden. A stroke that crosses a stone stops digging until the finger lifts,
// so a drag that runs over a stone wall does not spend cuts on a dry trench behind it.
// enter(i) answers what happened at cell i: 'cut', 'open' (already a channel, bed or spring), 'rock',
// 'broken' (after a stone in this stroke), 'spent' (no cuts left) or 'none'.
export function stroke(state, dig, { breakOnRock = true } = {}) {
  let broken = false;
  return {
    enter(i) {
      const c = state.cells[i];
      if (!c || state.won) return 'none';
      if (broken) return 'broken';
      if (c.kind === 'rock') { broken = breakOnRock; return 'rock'; }
      if (c.dug || c.kind === 'spring' || c.kind === 'bed') return 'open';
      if (!state.remaining) return 'spent';
      return dig(state, i) ? 'cut' : 'none';
    },
  };
}
