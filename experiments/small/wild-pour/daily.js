// One UTC calendar day, one repeatable pour. No identity or network storage.
export const DAILY_KEY = 'wild-pour:daily';
export function dailyPour(now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  let seed = 2166136261;
  for (const c of day) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619);
  return { day, seed: seed >>> 0, level: 1 };
}
export function validBest(value, day) {
  return value?.v === 1 && value.day === day && Number.isInteger(value.off) && value.off >= 0 &&
    Number.isInteger(value.spilled) && value.spilled >= 0 ? value : null;
}
export function dailyBest(previous, day, state) {
  // A tab finishing yesterday's challenge must not erase today's result.
  if (typeof previous?.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(previous.day) &&
      previous.day > day && validBest(previous, previous.day)) return previous;
  const old = validBest(previous, day);
  if (!state.won) return old;
  const off = Math.abs(state.inGlass - state.L.target), spilled = state.spilled;
  return !old || off < old.off || (off === old.off && spilled < old.spilled)
    ? { v: 1, day, off, spilled } : old;
}
