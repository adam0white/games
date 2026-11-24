// Writes levels.js: hand-made teaching levels, then villages from the generator in sim.js, one spec per level.
// Run: node make-levels.mjs   (then node bots.mjs to verify every level).
// The spec list is the curation: each new idea gets a hand-made level that teaches it, then generated levels
// where it matters, with the hop range climbing.
// Levels 1 to 30 (chapter 1) are frozen: saved stars are kept by level number. The generator draws the newer
// board elements only when a spec asks for them, so these specs still make the same villages; bots.mjs checks
// a hash of levels 1 to 30.
// A level's seed is searched from its base seed upward; an entry in PICK fixes the seed after a look.
import { writeFileSync } from 'node:fs';
import { generate, solve, wanderRate, ONEWAY, GATE_OPEN, GATE_SHUT } from './sim.js';

const C = { circle: 0, square: 1, triangle: 2, star: 3 }, K = { red: 0, yellow: 1, blue: 2, green: 3 };
const m = (shape, colour, n = 1) => ({ s: C[shape], c: K[colour], n });

// Chapter 1. Level 1: one path, one painter. Level 2: two paths, two painters, one is right.
// Level 3: the short path paints the wrong colour; the long one is right.
const HAND = {
  1: { name: 'First words', nodes: [
      { x: 0.5, y: 1, kind: 'teller' }, { x: 0.5, y: 0, kind: 'listener' }, { x: 0.5, y: 0.5, kind: 'paint', arg: K.red }],
    edges: [[0, 2], [1, 2]], from: 0, to: 1, start: m('circle', 'blue'), want: m('circle', 'red') },
  2: { name: 'Two ways', nodes: [
      { x: 0.5, y: 1, kind: 'teller' }, { x: 0.5, y: 0, kind: 'listener' },
      { x: 0.2, y: 0.5, kind: 'paint', arg: K.green }, { x: 0.8, y: 0.5, kind: 'paint', arg: K.yellow }],
    edges: [[0, 2], [0, 3], [1, 2], [1, 3]], from: 0, to: 1, start: m('square', 'blue'), want: m('square', 'yellow') },
  3: { name: 'The long way', nodes: [
      { x: 0.5, y: 1, kind: 'teller' }, { x: 0.5, y: 0, kind: 'listener' },
      { x: 0.2, y: 0.5, kind: 'paint', arg: K.blue }, { x: 0.8, y: 0.68, kind: 'honest' }, { x: 0.8, y: 0.3, kind: 'paint', arg: K.green }],
    edges: [[0, 2], [2, 1], [0, 3], [3, 4], [4, 1]], from: 0, to: 1, start: m('triangle', 'yellow'), want: m('triangle', 'green') },
  // Chapter 2 starts with the one-way lane: the painter the player wants is next to the listener, but that lane
  // runs down, away from the listener, so the news goes round by the neighbour.
  31: { name: 'One way', must: 'oneway', nodes: [
      { x: 0.5, y: 1, kind: 'teller' }, { x: 0.5, y: 0, kind: 'listener' },
      { x: 0.2, y: 0.5, kind: 'paint', arg: K.red }, { x: 0.8, y: 0.5, kind: 'honest' }],
    edges: [[0, 2], [0, 3], [1, 2, ONEWAY], [2, 3], [3, 1]], from: 0, to: 1, start: m('circle', 'blue'), want: m('circle', 'red') },
  // The bell ringer: the only way to the listener has a shut gate; passing the news through the bell ringer
  // opens it. The painter beside the gate is the one the listener wants.
  36: { name: 'Ding dong', must: 'bell', nodes: [
      { x: 0.5, y: 1, kind: 'teller' }, { x: 0.5, y: 0, kind: 'listener' },
      { x: 0.2, y: 0.55, kind: 'bell' }, { x: 0.8, y: 0.5, kind: 'paint', arg: K.yellow }],
    edges: [[0, 2], [0, 3], [2, 3], [1, 3, GATE_SHUT]], from: 0, to: 1, start: m('square', 'blue'), want: m('square', 'yellow') },
  // Chapter 3 starts with the keeper, who hands on the news they heard last time and keeps the new news.
  // Here the keeper already holds what the listener wants; the painter's way is wrong.
  46: { name: 'Old news', must: 'keeper', nodes: [
      { x: 0.5, y: 1, kind: 'teller' }, { x: 0.5, y: 0, kind: 'listener' },
      { x: 0.25, y: 0.5, kind: 'keeper', memo: m('star', 'green', 2) }, { x: 0.78, y: 0.5, kind: 'paint', arg: K.green }],
    edges: [[0, 2], [0, 3], [1, 2], [1, 3]], from: 0, to: 1, start: m('circle', 'yellow'), want: m('star', 'green', 2) },
};

const base = { rows: [4, 4], straight: true, maxMin: 4 };
const k = (...list) => list.map(x => (Array.isArray(x) ? x : [x, 1]));
const ALL1 = k(['paint', 2], 'more', 'less', 'swap', 'carve', 'flip', 'timid', 'parrot');
const SPECS = {
  // 4 to 6: the exaggerator
  4: { name: 'Big talk', ...base, villagers: [5, 6], kinds: k(['paint', 2], ['more', 2], 'honest'), must: 'more', hops: [3, 3] },
  5: { name: 'Tall tales', ...base, villagers: [6, 7], kinds: k(['paint', 2], ['more', 2], 'honest'), must: 'more', hops: [3, 4] },
  6: { name: 'Three of them', ...base, villagers: [6, 7], kinds: k(['paint', 2], ['more', 2], 'honest'), must: 'more', hops: [4, 5] },
  // 7 to 9: the grump
  7: { name: 'Grumbles', ...base, villagers: [6, 7], kinds: k(['paint', 2], 'more', ['less', 2], 'honest'), must: 'less', hops: [3, 4] },
  8: { name: 'Ups and downs', ...base, rows: [4, 5], villagers: [7, 8], kinds: k(['paint', 2], ['more', 2], ['less', 2]), must: 'less', hops: [4, 5] },
  9: { name: 'Round again', ...base, rows: [4, 5], villagers: [6, 8], kinds: k(['paint', 1], ['more', 2], ['less', 1], 'honest'), must: 'more', revisit: true, hops: [5, 7], drop: 0.2 },
  // 10 to 12: the muddler
  10: { name: 'Mix-up', ...base, villagers: [6, 7], kinds: k('paint', 'more', 'less', ['swap', 3]), must: 'swap', hops: [3, 4] },
  11: { name: 'Shape shift', ...base, rows: [4, 5], villagers: [7, 8], kinds: k(['paint', 2], 'more', 'less', ['swap', 3]), must: 'swap', hops: [4, 5] },
  12: { name: 'Muddle', ...base, rows: [5, 5], villagers: [7, 9], kinds: k(['paint', 2], 'more', 'less', ['swap', 3]), must: 'swap', hops: [5, 6] },
  // 13 to 15: the sculptor
  13: { name: 'Carved', ...base, villagers: [6, 7], kinds: k('paint', 'more', 'swap', ['carve', 3]), must: 'carve', hops: [3, 4] },
  14: { name: 'Star-maker', ...base, rows: [4, 5], villagers: [7, 8], kinds: k(['paint', 2], 'more', 'less', 'swap', ['carve', 3]), must: 'carve', hops: [4, 5] },
  15: { name: 'Chips fly', ...base, rows: [5, 5], villagers: [8, 9], kinds: k(['paint', 2], 'more', 'less', 'swap', ['carve', 3]), must: 'carve', hops: [5, 6] },
  // 16 to 18: the contrarian
  16: { name: 'Not so', ...base, villagers: [6, 7], kinds: k('paint', 'more', 'carve', ['flip', 3]), must: 'flip', hops: [3, 4] },
  17: { name: 'Quite the opposite', ...base, rows: [4, 5], villagers: [7, 8], kinds: k(['paint', 2], 'more', 'less', 'swap', ['flip', 3]), must: 'flip', hops: [4, 5] },
  18: { name: 'Back and forth', ...base, rows: [5, 5], villagers: [8, 9], kinds: k(['paint', 2], 'more', 'less', 'carve', ['flip', 3]), must: 'flip', hops: [5, 7] },
  // 19 to 21: the timid one, who will not take red news
  19: { name: 'Not red!', ...base, villagers: [6, 7], kinds: k(['paint', 3], 'more', 'flip', ['timid', 2]), must: 'timid', hops: [3, 5] },
  20: { name: 'Tiptoe', ...base, rows: [4, 5], villagers: [7, 8], kinds: k(['paint', 3], 'more', 'less', 'flip', ['timid', 2]), must: 'timid', hops: [4, 6] },
  21: { name: 'Hush', ...base, rows: [5, 5], villagers: [8, 9], kinds: k(['paint', 3], 'more', 'swap', 'flip', ['timid', 2]), must: 'timid', hops: [5, 7] },
  // 22 to 24: sleepy villagers, who speak once and go home
  22: { name: 'Bedtime', ...base, rows: [4, 5], villagers: [7, 8], kinds: k(['paint', 2], ['more', 2], 'less', 'honest'), must: 'once', sleepy: [1, 1], hops: [4, 8], drop: 0.1 },
  23: { name: 'Lights out', ...base, rows: [4, 5], villagers: [7, 8], kinds: k(['paint', 2], 'more', 'less', 'swap', 'carve'), must: 'once', sleepy: [1, 2], hops: [5, 7], drop: 0.2 },
  24: { name: 'Night owls', ...base, rows: [5, 5], villagers: [8, 9], kinds: k(['paint', 2], 'more', 'less', 'flip', 'timid'), must: 'once', sleepy: [2, 2], hops: [5, 8], drop: 0.2 },
  // 25 to 27: the parrot, who repeats what the last speaker did
  25: { name: 'Pretty bird', ...base, villagers: [6, 7], kinds: k(['paint', 2], 'more', ['parrot', 2]), must: 'parrot', hops: [3, 5] },
  26: { name: 'Echo', ...base, rows: [4, 5], villagers: [7, 8], kinds: k(['paint', 2], 'more', 'less', 'swap', ['parrot', 2]), must: 'parrot', hops: [4, 6] },
  27: { name: 'Says it twice', ...base, rows: [5, 5], villagers: [8, 9], kinds: k('paint', 'more', 'less', 'carve', 'flip', ['parrot', 2]), must: 'parrot', hops: [5, 7] },
  // 28 to 30: everyone
  28: { name: 'Market day', ...base, rows: [5, 5], villagers: [8, 9], kinds: ALL1, hops: [6, 7], sleepy: [0, 1] },
  29: { name: 'Festival', ...base, rows: [5, 5], villagers: [9, 9], kinds: ALL1, hops: [6, 8], sleepy: [1, 1] },
  30: { name: 'Lantern night', ...base, rows: [5, 5], villagers: [9, 9], kinds: ALL1, hops: [7, 9], sleepy: [1, 2], revisit: true, drop: 0.2 },

  // Chapter 2, winter. 31 teaches one-way lanes (hand-made); 32 to 35 use them.
  32: { name: 'Downhill', ...base, villagers: [6, 7], kinds: k(['paint', 2], 'more', 'less', 'honest'), oneway: [1, 2], must: 'oneway', hops: [3, 4] },
  33: { name: 'Ice road', ...base, rows: [4, 5], villagers: [7, 8], kinds: k(['paint', 2], 'more', 'less', 'swap'), oneway: [2, 3], must: 'oneway', hops: [4, 5] },
  34: { name: 'Roundabout', ...base, rows: [4, 5], villagers: [6, 8], kinds: k(['paint', 2], ['more', 2], 'less', 'honest'), oneway: [2, 3], must: 'oneway', revisit: true, hops: [5, 7], drop: 0.2 },
  35: { name: 'Sledges', ...base, rows: [5, 5], villagers: [8, 9], kinds: k(['paint', 2], 'more', 'less', 'carve', 'flip'), oneway: [2, 4], must: 'oneway', hops: [5, 6] },
  // 36 teaches gates and the bell ringer (hand-made); 37 to 40 use them.
  37: { name: 'Gatehouse', ...base, villagers: [6, 7], kinds: k(['paint', 2], 'more', 'less', 'honest'), gates: [1, 1], put: { bell: [1, 1] }, must: 'bell', hops: [3, 4] },
  38: { name: 'Open, shut', ...base, rows: [4, 5], villagers: [7, 8], kinds: k(['paint', 2], 'more', 'less', 'swap'), gates: [1, 2], put: { bell: [1, 1] }, must: 'bell', hops: [4, 5] },
  39: { name: 'Two bells', ...base, rows: [4, 5], villagers: [7, 8], kinds: k(['paint', 2], 'more', 'less', 'carve'), gates: [2, 2], put: { bell: [2, 2] }, must: 'bell', hops: [5, 6] },
  40: { name: 'Back for the bell', ...base, rows: [4, 5], villagers: [7, 8], kinds: k(['paint', 2], 'more', 'less', 'honest'), gates: [1, 2], put: { bell: [1, 1] }, must: 'bell', revisit: true, hops: [5, 7], drop: 0.2 },
  // 41 to 45: lanes and gates with the older villagers.
  41: { name: 'Frost', ...base, rows: [4, 5], villagers: [7, 8], kinds: k(['paint', 2], 'more', 'flip', 'timid'), oneway: [1, 2], gates: [1, 1], put: { bell: [1, 1] }, must: 'bell', also: ['oneway'], hops: [5, 6] },
  42: { name: 'Snowed in', ...base, rows: [5, 5], villagers: [8, 9], kinds: k(['paint', 2], 'more', 'less', 'swap'), gates: [1, 2], put: { bell: [1, 1] }, sleepy: [1, 1], must: 'bell', also: ['once'], hops: [5, 7], drop: 0.2 },
  43: { name: 'Icicles', ...base, rows: [5, 5], villagers: [8, 9], kinds: k(['paint', 2], 'more', 'less', 'carve', ['parrot', 2]), oneway: [2, 3], must: 'oneway', also: ['parrot'], hops: [5, 7] },
  44: { name: 'Winter market', ...base, rows: [5, 5], villagers: [8, 9], kinds: ALL1, oneway: [1, 2], gates: [1, 2], put: { bell: [1, 1] }, must: 'bell', hops: [6, 7], sleepy: [0, 1] },
  45: { name: 'Midwinter', ...base, rows: [5, 5], villagers: [9, 9], kinds: ALL1, oneway: [2, 3], gates: [1, 2], put: { bell: [1, 1] }, must: 'bell', also: ['oneway'], hops: [7, 9], sleepy: [0, 1] },

  // Chapter 3, autumn. 46 teaches the keeper (hand-made); 47 to 50 use them.
  47: { name: 'Last week', ...base, villagers: [6, 7], kinds: k(['paint', 2], 'more', 'less', 'honest'), put: { keeper: [1, 1] }, must: 'keeper', hops: [4, 5] },
  48: { name: 'Two keepers', ...base, rows: [4, 5], villagers: [7, 8], kinds: k(['paint', 2], 'more', 'less', 'flip'), put: { keeper: [2, 2] }, must: 'keeper', hops: [5, 6] },
  49: { name: 'Tea and cake', ...base, rows: [4, 5], villagers: [7, 8], kinds: k(['paint', 2], 'more', 'less', 'swap', 'carve'), put: { keeper: [1, 1] }, must: 'keeper', hops: [4, 6] },
  50: { name: 'Swap shop', ...base, rows: [4, 5], villagers: [6, 8], kinds: k(['paint', 2], 'more', 'less', 'honest'), put: { keeper: [1, 1] }, must: 'keeper', revisit: true, hops: [4, 7], drop: 0.2 },
  // 51 to 55: the keeper with lanes, gates and the older villagers.
  51: { name: 'Leaf lanes', ...base, rows: [4, 5], villagers: [7, 8], kinds: k(['paint', 2], 'more', 'less', 'carve'), put: { keeper: [1, 1] }, oneway: [2, 3], must: 'keeper', also: ['oneway'], hops: [5, 6] },
  52: { name: 'Harvest bell', ...base, rows: [4, 5], villagers: [7, 8], kinds: k(['paint', 2], 'more', 'less', 'swap'), put: { keeper: [1, 1], bell: [1, 1] }, gates: [1, 2], must: 'keeper', also: ['bell'], hops: [5, 7] },
  53: { name: 'Old and new', ...base, rows: [5, 5], villagers: [8, 9], kinds: k(['paint', 2], 'more', 'less', 'flip', ['parrot', 2]), put: { keeper: [1, 1] }, must: 'keeper', also: ['parrot'], hops: [5, 7] },
  54: { name: 'Scarecrow', ...base, rows: [5, 5], villagers: [8, 9], kinds: k(['paint', 2], 'more', 'less', 'flip', 'timid'), put: { keeper: [1, 1] }, sleepy: [1, 1], must: 'keeper', hops: [5, 7], drop: 0.2 },
  55: { name: 'Bonfire', ...base, rows: [5, 5], villagers: [8, 9], kinds: k(['paint', 2], 'more', 'less', 'swap'), put: { keeper: [1, 1] }, oneway: [1, 2], must: 'keeper', revisit: true, hops: [6, 8], drop: 0.2 },
  // 56 to 60: everything.
  56: { name: 'Apple picking', ...base, rows: [5, 5], villagers: [8, 9], kinds: ALL1, put: { keeper: [1, 1] }, oneway: [1, 2], must: 'keeper', hops: [6, 7], sleepy: [0, 1] },
  57: { name: 'Windy day', ...base, rows: [5, 5], villagers: [8, 9], kinds: ALL1, put: { keeper: [1, 1], bell: [1, 1] }, gates: [1, 2], oneway: [0, 1], must: 'keeper', hops: [6, 7] },
  58: { name: 'Pumpkins', ...base, rows: [5, 5], villagers: [9, 9], kinds: ALL1, put: { keeper: [1, 2] }, oneway: [1, 2], must: 'keeper', hops: [6, 8], sleepy: [0, 1] },
  59: { name: 'Long shadows', ...base, rows: [5, 5], villagers: [9, 9], kinds: ALL1, put: { keeper: [1, 1], bell: [1, 1] }, gates: [1, 2], oneway: [1, 2], must: 'keeper', also: ['bell'], hops: [7, 8] },
  60: { name: 'Harvest moon', ...base, rows: [5, 5], villagers: [9, 9], kinds: ALL1, put: { keeper: [1, 1], bell: [1, 1] }, gates: [1, 2], oneway: [1, 2], must: 'keeper', hops: [7, 9], sleepy: [0, 1], revisit: true, drop: 0.2 },
};
export const CHAPTERS = [[1, 30], [31, 45], [46, 60]];
const LAST = 60;
// Seeds fixed after looking at the level in the page; a level not listed searches from its base seed.
const PICK = {};
// Levels that search more seeds. Follow-up of 2026-11-23: levels 16, 23, 25 and 26 sat off the ramp with eight seeds.
// The first eight seeds are the same as before, so every other level is unchanged.
const MORE_SEEDS = { 16: 48, 23: 48, 25: 48, 26: 48, 47: 48, 48: 48, 51: 48 };
// Middle and late game audit, 2026-11-24: after the keeper's teaching level, a keeper who starts out holding the
// listener's news makes the level "walk to the keeper, deliver" and wastes every hop before her (levels 47, 48
// and 51 were like that). Such villages are skipped; levels where no candidate was like that are unchanged.
const handsOver = (lv, n) => n > 46 && lv.nodes.some(v => v.kind === 'keeper'
  && v.memo.s === lv.want.s && v.memo.c === lv.want.c && v.memo.n === lv.want.n);

// The ramp: how often a player with no plan (wanderRate in sim.js) should still win, by level.
// Eight villages that meet each spec are made; the one closest to the target is kept.
// Chapter 1 falls from 75% at level 4 to 15% at level 30. Each later chapter starts easier again after its
// teaching level and falls to a lower floor.
const target = n => n <= 30 ? 0.75 - 0.6 * (n - 4) / 26
  : n <= 45 ? 0.6 - 0.48 * (n - 32) / 13
  : 0.55 - 0.47 * (n - 47) / 13;
// Level 47 after the audit: the old target picked a village a wanderer wins as often as the teaching level,
// out of line with its neighbours; it aims a little lower.
const TARGET = { 47: 0.47 };
const aim = n => TARGET[n] ?? target(n);
const out = [];
for (let n = 1; n <= LAST; n++) {
  if (HAND[n]) { out.push({ ...HAND[n], min: solve(HAND[n]).min }); continue; }
  const spec = SPECS[n];
  if (!spec) throw new Error(`level ${n} has no spec`);
  const seeds = PICK[n] ? [PICK[n]] : Array.from({ length: MORE_SEEDS[n] ?? 8 }, (_, j) => 1000 * n + 17 + j * 100003);
  let best = null;
  for (const seed of seeds) {
    const lv = generate(seed, spec, 3000);
    if (!lv || handsOver(lv, n)) continue;
    const rate = wanderRate(lv, n);
    if (!best || Math.abs(rate - aim(n)) < Math.abs(best.rate - aim(n))) best = { lv, rate };
  }
  if (!best) { console.error(`level ${n} (${spec.name}): no seed met the spec`); process.exitCode = 1; continue; }
  const { lv, rate } = best;
  out.push({ name: spec.name, must: spec.must ?? null, ...(spec.also ? { also: spec.also } : {}), ...lv });
  console.log(`level ${n} ${spec.name}: seed ${lv.seed}, ${lv.nodes.length} villagers, shortest ${lv.min}, wanderer wins ${(rate * 100).toFixed(0)}% (target ${(aim(n) * 100).toFixed(0)}%)`);
}
const text = '// Made by make-levels.mjs from the specs there; verified by bots.mjs. Do not edit by hand.\n' +
  `export const CHAPTERS = ${JSON.stringify(CHAPTERS)};\n` +
  'export const LEVELS = [\n' + out.map(l => '  ' + JSON.stringify(l)).join(',\n') + '\n];\n';
if (!process.exitCode) writeFileSync(new URL('./levels.js', import.meta.url), text);
