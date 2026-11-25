// What Paper Boat's music hears (kit/music.js, 2026-11-24). It reads the run; it never changes it, and sim.js never calls
// it. The page and bots.mjs both use it, so the bots check the same mapping the player hears.
// The 'river' preset (thin pad, plucked notes in a wide echo: water in a gutter). Minor chords down the street, turning
// major near the pond. Volume from measuring the rendered mix (NOTES.md, 2026-11-24).
import { items, length, pawState, grateParted } from './sim.js';
import { VOICES } from '../kit/music.js';
// The river's pickup note at twice the kit's level (0.2, not 0.1): the bed must sit low under the ripples' 0.035 splash
// tone, and at that volume the kit's note would be under half the passenger's own 0.07 notes it replaces.
const midi = n => 440 * 2 ** ((n - 69) / 12);
export const SONG = {
  preset: 'river', volume: 0.35,
  voice: { ...VOICES.river, lead(play, n, at) { play(midi(n), at, 0.45, 0.2, 'triangle', ['lead', 'echo'], 0.003); play(midi(n) * 3, at, 0.08, 0.02, 'sine', ['lead'], 0.002); } },
};
const clamp = n => Math.max(0, Math.min(1, n));
// Each frame: progress is the way down the street (today's stream has no end, so it fills out over two and a half minutes
// and stays before the turn, as Lantern's endless river does); danger is a drain the boat is heading for (any closed grate across the gutter) or a paw about
// to come down near it; light is the dry paper left (low = nearly soaked through).
export function mood(s) {
  const b = s.b, t = s.tick / 60;
  let danger = 0;
  for (const it of items(s, b.y - 1, b.y + 1)) {
    const dy = it.y - b.y, dx = Math.abs(it.x - b.x);
    if (it.k === 'drain' && dy > -0.05 && dy < 0.8 && (dx < 0.4 || it.grate && !grateParted(s, it))) danger = Math.max(danger, (1 - dy / 0.8) * (it.grate && !grateParted(s, it) ? 1 : 1 - dx / 0.4));
    if (it.k === 'paw' && Math.abs(dy) < 0.4 && dx < 0.3 && pawState(s, it).warn) danger = Math.max(danger, 1 - dx / 0.3);
  }
  return {
    progress: s.daily ? Math.min(0.8, t / 150) : clamp((b.y - 0.3) / (length(s) - 0.3)),
    danger: clamp(danger),
    light: clamp(1 - s.soak),
  };
}
// The street's things the boat has gone past: crossing y + 0.15.
const past = (s, y0, y1, kinds) => items(s, y0 - 1, y1 + 1).filter(it => kinds.includes(it.k) && it.y + 0.15 > y0 && it.y + 0.15 <= y1);
// Counters to compare across a step.
export const look = s => ({ y: s.b.y, riders: s.riders.length });
// What the player did in that step: a passenger taken, or a drain or paw got past, plays the next note of the street's
// tune; a passenger left behind (gone past untaken) is a note not played (the streak ends); a paw that swats the boat is a
// blow. Bumps on the kerb, knocks on a pebble and leaves are not: they keep their own sounds.
export function heard(before, s) {
  const y1 = s.b.y, safe = s.over === 'drain' || s.over === 'soak' ? [] : past(s, before.y, y1, ['drain', 'paw']);
  return {
    notes: s.riders.length - before.riders + safe.length,
    misses: past(s, before.y, y1, ['bug']).filter(it => !s.got[it.id]).length,
    blows: s.ev.filter(e => e.type === 'swat').length,
  };
}
