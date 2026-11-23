// Writes levels.js: three hand-made teaching levels, then villages from the generator in sim.js, one spec per
// level. Run: node make-levels.mjs   (then node bots.mjs to verify every level).
// The spec list is the curation: each new villager kind gets three levels, and the hop range climbs.
// A level's seed is searched from its base seed upward; an entry in PICK fixes the seed after a look.
import { writeFileSync } from 'node:fs';
import { generate, solve, wanderRate } from './sim.js';

const C = { circle: 0, square: 1, triangle: 2, star: 3 }, K = { red: 0, yellow: 1, blue: 2, green: 3 };
const m = (shape, colour, n = 1) => ({ s: C[shape], c: K[colour], n });

// Level 1: one path, one painter. Level 2: two paths, two painters, one is right.
// Level 3: the short path paints the wrong colour; the long one is right.
const HAND = [
  { name: 'First words', nodes: [
      { x: 0.5, y: 1, kind: 'teller' }, { x: 0.5, y: 0, kind: 'listener' }, { x: 0.5, y: 0.5, kind: 'paint', arg: K.red }],
    edges: [[0, 2], [1, 2]], from: 0, to: 1, start: m('circle', 'blue'), want: m('circle', 'red') },
  { name: 'Two ways', nodes: [
      { x: 0.5, y: 1, kind: 'teller' }, { x: 0.5, y: 0, kind: 'listener' },
      { x: 0.2, y: 0.5, kind: 'paint', arg: K.green }, { x: 0.8, y: 0.5, kind: 'paint', arg: K.yellow }],
    edges: [[0, 2], [0, 3], [1, 2], [1, 3]], from: 0, to: 1, start: m('square', 'blue'), want: m('square', 'yellow') },
  { name: 'The long way', nodes: [
      { x: 0.5, y: 1, kind: 'teller' }, { x: 0.5, y: 0, kind: 'listener' },
      { x: 0.2, y: 0.5, kind: 'paint', arg: K.blue }, { x: 0.8, y: 0.68, kind: 'honest' }, { x: 0.8, y: 0.3, kind: 'paint', arg: K.green }],
    edges: [[0, 2], [2, 1], [0, 3], [3, 4], [4, 1]], from: 0, to: 1, start: m('triangle', 'yellow'), want: m('triangle', 'green') },
];

const base = { rows: [4, 4], straight: true, maxMin: 4 };
const k = (...list) => list.map(x => (Array.isArray(x) ? x : [x, 1]));
const SPECS = [
  // 4 to 6: the exaggerator
  { name: 'Big talk', ...base, villagers: [5, 6], kinds: k(['paint', 2], ['more', 2], 'honest'), must: 'more', hops: [3, 3] },
  { name: 'Tall tales', ...base, villagers: [6, 7], kinds: k(['paint', 2], ['more', 2], 'honest'), must: 'more', hops: [3, 4] },
  { name: 'Three of them', ...base, villagers: [6, 7], kinds: k(['paint', 2], ['more', 2], 'honest'), must: 'more', hops: [4, 5] },
  // 7 to 9: the grump
  { name: 'Grumbles', ...base, villagers: [6, 7], kinds: k(['paint', 2], 'more', ['less', 2], 'honest'), must: 'less', hops: [3, 4] },
  { name: 'Ups and downs', ...base, rows: [4, 5], villagers: [7, 8], kinds: k(['paint', 2], ['more', 2], ['less', 2]), must: 'less', hops: [4, 5] },
  { name: 'Round again', ...base, rows: [4, 5], villagers: [6, 8], kinds: k(['paint', 1], ['more', 2], ['less', 1], 'honest'), must: 'more', revisit: true, hops: [5, 7], drop: 0.2 },
  // 10 to 12: the muddler
  { name: 'Mix-up', ...base, villagers: [6, 7], kinds: k('paint', 'more', 'less', ['swap', 3]), must: 'swap', hops: [3, 4] },
  { name: 'Shape shift', ...base, rows: [4, 5], villagers: [7, 8], kinds: k(['paint', 2], 'more', 'less', ['swap', 3]), must: 'swap', hops: [4, 5] },
  { name: 'Muddle', ...base, rows: [5, 5], villagers: [7, 9], kinds: k(['paint', 2], 'more', 'less', ['swap', 3]), must: 'swap', hops: [5, 6] },
  // 13 to 15: the sculptor
  { name: 'Carved', ...base, villagers: [6, 7], kinds: k('paint', 'more', 'swap', ['carve', 3]), must: 'carve', hops: [3, 4] },
  { name: 'Star-maker', ...base, rows: [4, 5], villagers: [7, 8], kinds: k(['paint', 2], 'more', 'less', 'swap', ['carve', 3]), must: 'carve', hops: [4, 5] },
  { name: 'Chips fly', ...base, rows: [5, 5], villagers: [8, 9], kinds: k(['paint', 2], 'more', 'less', 'swap', ['carve', 3]), must: 'carve', hops: [5, 6] },
  // 16 to 18: the contrarian
  { name: 'Not so', ...base, villagers: [6, 7], kinds: k('paint', 'more', 'carve', ['flip', 3]), must: 'flip', hops: [3, 4] },
  { name: 'Quite the opposite', ...base, rows: [4, 5], villagers: [7, 8], kinds: k(['paint', 2], 'more', 'less', 'swap', ['flip', 3]), must: 'flip', hops: [4, 5] },
  { name: 'Back and forth', ...base, rows: [5, 5], villagers: [8, 9], kinds: k(['paint', 2], 'more', 'less', 'carve', ['flip', 3]), must: 'flip', hops: [5, 7] },
  // 19 to 21: the timid one, who will not take red news
  { name: 'Not red!', ...base, villagers: [6, 7], kinds: k(['paint', 3], 'more', 'flip', ['timid', 2]), must: 'timid', hops: [3, 5] },
  { name: 'Tiptoe', ...base, rows: [4, 5], villagers: [7, 8], kinds: k(['paint', 3], 'more', 'less', 'flip', ['timid', 2]), must: 'timid', hops: [4, 6] },
  { name: 'Hush', ...base, rows: [5, 5], villagers: [8, 9], kinds: k(['paint', 3], 'more', 'swap', 'flip', ['timid', 2]), must: 'timid', hops: [5, 7] },
  // 22 to 24: sleepy villagers, who speak once and go home
  { name: 'Bedtime', ...base, rows: [4, 5], villagers: [7, 8], kinds: k(['paint', 2], ['more', 2], 'less', 'honest'), must: 'once', sleepy: [1, 1], hops: [4, 8], drop: 0.1 },
  { name: 'Lights out', ...base, rows: [4, 5], villagers: [7, 8], kinds: k(['paint', 2], 'more', 'less', 'swap', 'carve'), must: 'once', sleepy: [1, 2], hops: [5, 7], drop: 0.2 },
  { name: 'Night owls', ...base, rows: [5, 5], villagers: [8, 9], kinds: k(['paint', 2], 'more', 'less', 'flip', 'timid'), must: 'once', sleepy: [2, 2], hops: [5, 8], drop: 0.2 },
  // 25 to 27: the parrot, who repeats what the last speaker did
  { name: 'Pretty bird', ...base, villagers: [6, 7], kinds: k(['paint', 2], 'more', ['parrot', 2]), must: 'parrot', hops: [3, 5] },
  { name: 'Echo', ...base, rows: [4, 5], villagers: [7, 8], kinds: k(['paint', 2], 'more', 'less', 'swap', ['parrot', 2]), must: 'parrot', hops: [4, 6] },
  { name: 'Says it twice', ...base, rows: [5, 5], villagers: [8, 9], kinds: k('paint', 'more', 'less', 'carve', 'flip', ['parrot', 2]), must: 'parrot', hops: [5, 7] },
  // 28 to 30: everyone
  { name: 'Market day', ...base, rows: [5, 5], villagers: [8, 9], kinds: k(['paint', 2], 'more', 'less', 'swap', 'carve', 'flip', 'timid', 'parrot'), hops: [6, 7], sleepy: [0, 1] },
  { name: 'Festival', ...base, rows: [5, 5], villagers: [9, 9], kinds: k(['paint', 2], 'more', 'less', 'swap', 'carve', 'flip', 'timid', 'parrot'), hops: [6, 8], sleepy: [1, 1] },
  { name: 'Lantern night', ...base, rows: [5, 5], villagers: [9, 9], kinds: k(['paint', 2], 'more', 'less', 'swap', 'carve', 'flip', 'timid', 'parrot'), hops: [7, 9], sleepy: [1, 2], revisit: true, drop: 0.2 },
];
// Seeds fixed after looking at the level in the page; a level not listed searches from its base seed.
const PICK = {};
// Levels that search more seeds. Follow-up of 2026-11-23: levels 16, 23, 25 and 26 sat off the ramp with eight seeds.
// The first eight seeds are the same as before, so every other level is unchanged.
const MORE_SEEDS = { 16: 48, 23: 48, 25: 48, 26: 48 };

// The ramp: how often a player with no plan (wanderRate in sim.js) should still win, by level.
// Eight villages that meet each spec are made; the one closest to the target is kept.
const target = n => 0.75 - 0.6 * (n - 4) / 26;
const out = HAND.map(l => ({ ...l, min: solve(l).min }));
SPECS.forEach((spec, i) => {
  const n = i + 4;
  const seeds = PICK[n] ? [PICK[n]] : Array.from({ length: MORE_SEEDS[n] ?? 8 }, (_, j) => 1000 * n + 17 + j * 100003);
  let best = null;
  for (const seed of seeds) {
    const lv = generate(seed, spec, 3000);
    if (!lv) continue;
    const rate = wanderRate(lv, n);
    if (!best || Math.abs(rate - target(n)) < Math.abs(best.rate - target(n))) best = { lv, rate };
  }
  if (!best) { console.error(`level ${n} (${spec.name}): no seed met the spec`); process.exitCode = 1; return; }
  const { lv, rate } = best;
  out.push({ name: spec.name, must: spec.must ?? null, ...lv });
  console.log(`level ${n} ${spec.name}: seed ${lv.seed}, ${lv.nodes.length} villagers, shortest ${lv.min}, wanderer wins ${(rate * 100).toFixed(0)}% (target ${(target(n) * 100).toFixed(0)}%)`);
});
const text = '// Made by make-levels.mjs from the specs there; verified by bots.mjs. Do not edit by hand.\n' +
  'export const LEVELS = [\n' + out.map(l => '  ' + JSON.stringify(l)).join(',\n') + '\n];\n';
writeFileSync(new URL('./levels.js', import.meta.url), text);
