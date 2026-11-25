// What Harvest Morning's music hears (kit/music.js, 2026-11-24). It reads the morning and its events; it never changes
// them, and sim.js never calls it. The page and bots.mjs both use it, so the bots check the same mapping the player hears.
// The 'flute' voice (slow attack, a little vibrato: a garden, a field) at a walking 88 a minute, with chords for a morning
// instead of Lantern's night. Written in D like the kit's (D add9, Bm7, G, A sus4 while the field stands, then the kit's
// bright D, G maj7, A, D once four fifths of it is cleared); the flute preset plays them a fourth up, in G. Volume from measuring the rendered mix (NOTES.md, 2026-11-24).
export const MORNING = [[50, 54, 57, 64], [47, 50, 54, 57], [43, 50, 55, 59], [45, 50, 52, 57]];
export const SONG = { preset: 'flute', bpm: 88, minor: MORNING, turn: 0.8, volume: 0.4 };
const clamp = n => Math.max(0, Math.min(1, n));
// Each frame: progress is the share of the field cleared (cut and carried off, or lost); danger is crows eating sheaves,
// the last ten seconds before the rain, and the rain itself; light is the time left before the rain.
export function mood(s) {
  let left = 0, eating = 0;
  for (let i = 0; i < s.st.length; i++) if (s.st[i] === 1 || s.st[i] === 2) left++;
  for (const c of s.crows) if (c.eating) eating++;
  const before = s.L.time - s.t;
  return {
    progress: clamp(1 - left / s.total),
    danger: Math.max(clamp(eating * 0.35), before < 0 ? 1 : clamp((10 - before) / 10) * 0.7),
    light: clamp(before / s.L.time),
  };
}
const count = (ev, f) => { let n = 0; for (const e of ev) if (f(e)) n++; return n; };
// What happened in a step (the step's events): each sheaf the farmer bundles plays the next note of the morning's tune;
// a sheaf lost (eaten by a crow, trampled by the fast one, the hare's nest cut) is a note not played; the hidden stone and
// the rain are blows that thin the music for two bars.
export function heard(ev) {
  return {
    notes: count(ev, e => e.type === 'pick' && e.who === 'me'),
    misses: count(ev, e => e.type === 'eaten' || e.type === 'trample' || e.type === 'hare'),
    blows: count(ev, e => e.type === 'stone' || e.type === 'storm'),
  };
}
