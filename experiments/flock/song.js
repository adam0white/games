// What Night Flock's music hears (kit/music.js, 2026-11-24). It reads the evening; it never changes it, and sim.js never
// calls it. The page and bots.mjs both use it, so the bots check the same mapping the player hears.
// The 'bell' preset (a soft bell over a pasture), in the dusk: minor chords while the flock is out, turning major once
// four fifths of it is in the fold. Volume from measuring the rendered mix (NOTES.md, 2026-11-24).
export const SONG = { preset: 'bell', volume: 0.22 };
const clamp = n => Math.max(0, Math.min(1, n));
// Each frame: progress is the share of the flock in the fold; danger is the wolf (its eyes, then its run) or a flock that has
// lost its calm; light is the evening's light, which runs out with the time.
export function mood(game) {
  const wolf = game.wolf, eyes = wolf?.phase === 'eyes' ? 0.45 : 0, run = wolf?.active ? 1 : 0;
  return {
    progress: clamp(game.home / game.sheep.length),
    danger: Math.max(eyes, run, clamp((0.8 - game.calm) / 0.4)),
    light: clamp(1 - game.time / game.limit),
  };
}
// Counters to compare across a step.
export const look = game => ({ home: game.home, lost: game.lost, strays: game.sheep.filter(s => s.stray).length });
// What the player did in that step: a sheep into the fold plays the next note of the evening's tune; a sheep that breaks
// away from the flock is a note not played (the streak ends); a sheep lost to the woods or the stream is a blow.
export function heard(before, game) {
  const now = look(game);
  return { notes: now.home - before.home, misses: now.strays - before.strays, blows: now.lost - before.lost };
}
