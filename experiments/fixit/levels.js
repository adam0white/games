// Fix-It Stall: the levels. Pure data, no window or document; sim.js, bots.mjs and the page all read it.
//
// Levels 1 to 15 each bring in one new job, in ORDER; the first customer of such a level brings that job with plenty
// of patience, and every other customer after brings it again. Levels 16 and up mix jobs from a pool of six at a
// rising pace: less patience, more customers with two repairs, a golden customer now and then, and goals with two parts.
//
// A goal has one or two parts:
//   fix: n      fix n customers
//   coins: n    earn n coins
//   list: [..]  fix exactly these customers, in this order (a list never lets a customer walk off)
//   time: s     ...before the level clock reaches s seconds
//   safe: true  ...without anyone walking off
// Stars come from how fast the level was cleared: 3 at or under stars[0] seconds, 2 at or under stars[1], else 1.
// The time limits, coin targets and star times in TUNE were measured with `node bots.mjs --calibrate` (see NOTES.md).

export const ORDER = ['screw', 'pin', 'dent', 'wheel', 'oil', 'rub', 'clock', 'zip', 'chain', 'glue', 'spring', 'sharpen', 'sew', 'thread', 'pump'];
export const INTRO = ORDER.length; // levels 1..15 each bring in one job

// A small seeded draw for building lists and pools, so every level is the same for everyone.
function draw(seed) {
  let r = seed | 0;
  return () => {
    r = (r + 0x6d2b79f5) | 0;
    let t = Math.imul(r ^ (r >>> 15), r | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The goal shapes. A number after a kind of goal is how many; T marks a time limit, measured into TUNE.
const SHAPE = {
  1: { list: 6 },
  2: { fix: 14, time: 'T' },
  3: { list: 17 },
  4: { coins: 17, time: 'T' },
  5: { fix: 14, time: 'T' },
  6: { list: 12 },
  7: { coins: 16, time: 'T' },
  8: { fix: 17, time: 'T' },
  9: { list: 19 },
  10: { coins: 17, time: 'T' },
  11: { fix: 17, time: 'T' },
  12: { list: 16 },
  13: { coins: 16, time: 'T' },
  14: { fix: 17, time: 'T' },
  15: { list: 14 },
  16: { fix: 13, time: 'T' },
  17: { coins: 14, time: 'T' },
  18: { list: 13, time: 'T' },
  19: { fix: 13, safe: true },
  20: { fix: 13, coins: 13, time: 'T' },
  21: { list: 14 },
  22: { coins: 14, time: 'T' },
  23: { fix: 15, time: 'T' },
  24: { list: 14, time: 'T' },
  25: { fix: 15, safe: true },
  26: { fix: 15, coins: 15, time: 'T' },
  27: { list: 15, time: 'T' },
  28: { fix: 16, time: 'T' },
  29: { coins: 16, time: 'T' },
  30: { fix: 16, safe: true },
  31: { list: 16, time: 'T' },
  32: { fix: 18, coins: 18, time: 'T' },
};
export const COUNT = Object.keys(SHAPE).length;

// Measured numbers per level: time limit (s), coin target, star times [3 stars, 2 stars] (s). Filled by --calibrate.
export const TUNE = {
  1: {stars: [14, 21]},
  2: {stars: [32, 45], time: 85},
  3: {stars: [33, 46]},
  4: {stars: [36, 49], time: 85, coins: 130},
  5: {stars: [45, 50], time: 75},
  6: {stars: [36, 51]},
  7: {stars: [35, 47], time: 80, coins: 116},
  8: {stars: [41, 51], time: 85},
  9: {stars: [38, 52]},
  10: {stars: [41, 53], time: 85, coins: 149},
  11: {stars: [39, 51], time: 80},
  12: {stars: [39, 51]},
  13: {stars: [44, 52], time: 70, coins: 131},
  14: {stars: [44, 52], time: 75},
  15: {stars: [42, 54]},
  16: {stars: [36, 48], time: 70},
  17: {stars: [37, 50], time: 70, coins: 122},
  18: {stars: [34, 46], time: 65},
  19: {stars: [36, 51]},
  20: {stars: [35, 49], time: 65, coins: 162},
  21: {stars: [40, 57]},
  22: {stars: [42, 57], time: 75, coins: 157},
  23: {stars: [50, 69], time: 85},
  24: {stars: [43, 56], time: 70},
  25: {stars: [54, 72]},
  26: {stars: [56, 74], time: 85, coins: 146},
  27: {stars: [47, 65], time: 75},
  28: {stars: [50, 67], time: 75},
  29: {stars: [54, 78], time: 95, coins: 218},
  30: {stars: [44, 63]},
  31: {stars: [58, 80], time: 84},
  32: {stars: [64, 86], time: 90, coins: 183},
};

// How a level is built, before tuning: patience, two-repair chance, dent count step, golden chance, regular.
function pace(n) {
  if (n === 1) return { patience: 30, two: 0, ramp: 0, golden: 0, regular: false };
  if (n <= INTRO) return { patience: n <= 5 ? 16 : n <= 10 ? 14 : 12, two: 0, ramp: n <= 8 ? 0 : 1, golden: 0, regular: n >= 6 };
  const k = (n - INTRO - 1) / (COUNT - INTRO - 1); // 0 at level 16, 1 at the last level
  return {
    patience: Math.round((11 - 3.5 * k) * 10) / 10,
    two: Math.round((0.1 + 0.35 * k) * 100) / 100,
    ramp: 2 + Math.min(3, Math.floor(k * 4)),
    golden: n >= 18 ? 0.06 : 0,
    regular: true,
  };
}

// The pool of jobs a level's customers bring.
function poolOf(n) {
  if (n <= INTRO) return ORDER.slice(0, n);
  const rnd = draw(9000 + n), all = ORDER.slice();
  for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
  return all.slice(0, 6);
}

// A set list: the new job every other customer, the rest from the pool, no kind twice in a row.
function listOf(n, len, pool, intro) {
  const rnd = draw(5000 + n), out = [];
  const old = intro ? pool.filter(k => k !== intro) : pool;
  for (let i = 0; i < len; i++) {
    if (intro && (i % 2 === 0 || !old.length)) { out.push(intro); continue; }
    const from = old.filter(k => k !== out.at(-1));
    out.push(from[Math.floor(rnd() * from.length)] ?? old[0]);
  }
  return out;
}

export function levelDef(n) {
  if (!SHAPE[n]) return null;
  const shape = SHAPE[n], tune = TUNE[n] ?? {}, intro = n <= INTRO ? ORDER[n - 1] : null, pool = poolOf(n);
  const goal = {};
  if (shape.list) goal.list = listOf(n, shape.list, pool, intro);
  if (shape.fix) goal.fix = shape.fix;
  if (shape.coins) goal.coins = tune.coins ?? shape.coins * 4; // until measured: about four coins a customer
  if (shape.time) goal.time = tune.time ?? 999;
  if (shape.safe) goal.safe = true;
  return {
    n, intro, pool, goal, seed: 1000 + n * 7919,
    stars: tune.stars ?? [goal.time ? goal.time * 0.6 : 60, goal.time ? goal.time * 0.8 : 90],
    shape, ...pace(n),
  };
}
export const MAP = Array.from({ length: COUNT }, (_, i) => levelDef(i + 1));

// A short line for the goal card and the menu, in plain words.
export function goalLine(goal) {
  const parts = [];
  if (goal.list) parts.push(`Fix these ${goal.list.length}`);
  if (goal.fix && goal.coins) parts.push(`Fix ${goal.fix} and earn ${goal.coins} coins`);
  else if (goal.fix) parts.push(`Fix ${goal.fix}`);
  else if (goal.coins) parts.push(`Earn ${goal.coins} coins`);
  let line = parts.join(' ');
  if (goal.time) line += ` in ${goal.time} seconds`;
  if (goal.safe || (goal.list && !goal.time)) line += '. Nobody walks off';
  else if (goal.list) line += '. Nobody walks off';
  return line + '.';
}

// Stars for a cleared level, from the seconds it took.
export function starsFor(def, secs) {
  return secs <= def.stars[0] + 1e-9 ? 3 : secs <= def.stars[1] + 1e-9 ? 2 : 1;
}
