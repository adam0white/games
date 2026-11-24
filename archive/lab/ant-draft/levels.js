// Ant Draft: 50 levels and the tutorial. Pure data made from the level number; sim.js plays them (opts.level), bots-levels.mjs proves them.
// Levels come in ten chapters of five. A chapter brings one thing up front; the fifth level of a chapter is its hardest.
export const LEVELS = 50;
export const CHAPTERS = [
  { name: 'Meadow', mix: { aphid: 1 } }, { name: 'Shells', mix: { aphid: 2, beetle: 2 } }, { name: 'Wings', mix: { aphid: 2, wasp: 2 } }, { name: 'Webs', mix: { aphid: 2, spider: 2 } },
  { name: 'Rush', mix: { aphid: 3, wasp: 1, spider: 1 }, swift: 1.25 }, { name: 'Two fronts', mix: { spider: 1, aphid: 2, beetle: 1, wasp: 1 }, sides: 1 }, { name: 'Stone', mix: { beetle: 3, spider: 1 }, tough: 1.12, many: 1.15 },
  { name: 'Swarm', mix: { spider: 1, aphid: 5 }, many: 1.05 }, { name: 'Night hunt', mix: { spider: 2, wasp: 2, beetle: 1 }, many: 1.25 }, { name: 'The great war', mix: { aphid: 3, beetle: 2, wasp: 1, spider: 2 }, many: 1.35 },
];
const COST = { aphid: 1, beetle: 4, wasp: 2.5, spider: 4 };
function rng(a) { return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function level(n) {
  n = Math.max(1, Math.min(LEVELS, Math.floor(n)));
  const c = Math.floor((n - 1) / 5), k = (n - 1) % 5, C = CHAPTERS[c], r = rng(n * 7919), count = 3 + Math.min(3, Math.floor(c / 2) + (k === 4 ? 1 : 0)), waves = [];
  const types = Object.entries(C.mix).flatMap(([t, w]) => Array(w).fill(t));
  for (let w = 0; w < count; w++) {
    const groups = [], top = w === count - 1;
    let budget = (5 + n * 0.22 + k * 0.8) * (1 + w * 0.42) * (C.many ?? 1), at = 1, side = r() < 0.5;
    if (top && n % 10 === 0) { groups.push(['stag', 1, 0.5, 1, 1]); budget *= 0.5; } // a stag beetle leads every tenth level
    let first = true;
    while (budget >= 1) {
      let type = first ? types[types.length - 1] : types[Math.floor(r() * types.length)]; // every wave opens with the chapter's own enemy
      if (COST[type] > budget) type = 'aphid';
      first = false;
      const most = Math.floor(budget / COST[type]), size = Math.min(most, type === 'aphid' ? 4 + Math.floor(r() * 5) : 1 + Math.floor(r() * 2.4));
      side = !side;
      const lane = C.sides ? (side ? 0.1 : 0.9) : 0.12 + r() * 0.76;
      groups.push([type, size, +lane.toFixed(2), +at.toFixed(1), type === 'aphid' ? 0.8 : 1.8]);
      budget -= size * COST[type]; at += C.sides && side ? 0.5 : 2.5 + r() * 2;
    }
    waves.push(groups);
  }
  return { n, chapter: c, name: C.name, waves, tough: (C.tough ?? 1) * (1 + n * 0.004), swift: C.swift ?? 1, start: 6 + Math.floor(n / 10) };
}
// The tutorial: three short waves, and the queen cannot be hurt (opts.safe). main.js shows the words for each step.
export const TUTORIAL = { n: 0, name: 'Tutorial', start: 6, tough: 1, swift: 1, waves: [[['aphid', 3, 0.5, 4, 2]], [['beetle', 1, 0.5, 2, 1], ['aphid', 2, 0.3, 4, 1]], [['wasp', 1, 0.3, 2, 1], ['spider', 1, 0.8, 3, 1]]] };
export const stars = hp => hp >= 80 ? 3 : hp >= 40 ? 2 : 1; // by the queen's health at the end of a level
