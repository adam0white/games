// What Night Vine's music hears (kit/music.js, 2026-11-24). It reads the bed; it never changes it, and sim.js never
// calls it. The page and bots.mjs both use it, so the bots check the same mapping the player hears.
// The 'flute' preset (a garden at night): minor chords while the vine climbs, turning major near the window.
// Volume from measuring the rendered mix (NOTES.md, 2026-11-24).
export const SONG = { preset: 'flute', volume: 0.3 };
const clamp = n => Math.max(0, Math.min(1, n));
const worst = s => s.flowers.reduce((m, f) => Math.max(m, f.stress), 0);
// Each frame: progress is the bed's own count of steps (tendrils caught, bunches ripe, the window) out of all of them;
// danger is the most stressed flower under shade; light is how much life that flower has left (low: about to wilt).
export function mood(s) {
  const steps = 2 * s.arms.length + 1;
  return { progress: clamp(walk(s) / steps), danger: worst(s), light: clamp(1 - worst(s)) };
}
const walk = s => s.arms.filter(a => a.grip >= 0).length + s.arms.filter(a => a.ripe).length + (s.window.reached ? 1 : 0);
// Counters to compare across a frame (ticks and the player's cuts between two frames). `cuts`: the page's count of cuts
// that took wood (prune() returned more than 0); the bed itself does not count them.
export const look = (s, cuts = 0) => ({ cuts, grips: s.arms.filter(a => a.grip >= 0).length, ripe: s.arms.filter(a => a.ripe).length,
  window: s.window.reached ? 1 : 0, wilted: s.status === 'wilted' ? 1 : 0 });
// What the player did since: a tendril catching an eye, a bunch ripening, the window reached and a cut each play the next
// note of the bed's tune. A cut that drops a held tendril (and its bunch) is a note not played. A wilted flower is a blow.
export function heard(before, s, cuts = 0) {
  const now = look(s, cuts), lost = Math.max(0, before.grips - now.grips), cut = now.cuts - before.cuts;
  return {
    notes: Math.max(0, now.grips - before.grips) + Math.max(0, now.ripe - before.ripe) + Math.max(0, now.window - before.window) + (lost ? 0 : cut),
    misses: lost,
    blows: now.wilted - before.wilted,
  };
}
