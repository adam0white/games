// Fix-It Stall: the levels. Pure data, no window or document; sim.js, bots.mjs and the page all read it.
//
// Levels 1 to 15 each bring in one new job, in ORDER; the first customer of such a level brings that job with plenty
// of patience, and every other customer after brings it again. Levels 16 to 32 mix jobs from a pool of six at a
// rising pace: less patience, more customers with two repairs, a golden customer now and then, and goals with two parts.
//
// A goal has one or two parts:
//   fix: n      fix n customers
//   coins: n    earn n coins in base pay
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

// Coin jobs are the calibration sample size. TUNE holds the target in base pay and each deadline.
const SHAPE = {
  1: { fix: 3 },
  2: { fix: 6, time: 'T' },
  3: { list: 6 },
  4: { coinJobs: 17, time: 'T' },
  5: { fix: 14, time: 'T' },
  6: { list: 12 },
  7: { coinJobs: 16, time: 'T' },
  8: { fix: 17, time: 'T' },
  9: { list: 19 },
  10: { coinJobs: 17, time: 'T' },
  11: { fix: 17, time: 'T' },
  12: { list: 16 },
  13: { coinJobs: 16, time: 'T' },
  14: { fix: 17, time: 'T' },
  15: { list: 14 },
  16: { fix: 13, time: 'T' },
  17: { coinJobs: 14, time: 'T' },
  18: { list: 13, time: 'T' },
  19: { fix: 13, safe: true },
  20: { fix: 13, coinJobs: 13, time: 'T' },
  21: { list: 14 },
  22: { coinJobs: 14, time: 'T' },
  23: { fix: 15, time: 'T' },
  24: { list: 14, time: 'T' },
  25: { fix: 15, safe: true },
  26: { fix: 15, coinJobs: 15, time: 'T' },
  27: { list: 15, time: 'T' },
  28: { fix: 16, time: 'T' },
  29: { coinJobs: 16, time: 'T' },
  30: { fix: 16, safe: true },
  31: { list: 16, time: 'T' },
  32: { fix: 18, coinJobs: 18, time: 'T' },
};
export const BUSY_END = 32;

// Each entry is one customer's ticket. Rush levels bring two tickets up together.
const NIGHT = [
  { rule: 'order', intro: 'wind', tickets: [['wind', 'dent'], ['pin', 'wind', 'chain'], ['dent', 'wind']] },
  { rule: 'rush', intro: 'balance', tickets: [['balance'], ['dent'], ['pin'], ['balance'], ['zip'], ['chain']] },
  { rule: 'blackout', intro: 'trace', tickets: [['trace'], ['oil'], ['trace'], ['clock'], ['trace'], ['chain'], ['dent'], ['trace']] },
  { rule: 'boss', tickets: [['dent'], ['zip'], ['wind', 'balance', 'trace']] },
  { rule: 'order', tickets: [['thread', 'dent', 'clock'], ['wind', 'sew', 'pin'], ['oil', 'balance', 'zip'], ['trace', 'spring', 'pump']] },
  { rule: 'rush', tickets: [['oil'], ['clock'], ['wind'], ['balance'], ['thread'], ['pump'], ['rub'], ['trace']] },
  { rule: 'blackout', tickets: [['zip'], ['dent'], ['wind'], ['sew'], ['thread'], ['trace'], ['clock'], ['sharpen'], ['oil'], ['balance']] },
  { rule: 'boss', tickets: [['trace'], ['screw', 'pin', 'dent'], ['spring'], ['oil', 'thread', 'wind']] },
  { rule: 'order', tickets: [['pump', 'oil', 'clock'], ['sharpen', 'thread', 'spring'], ['wind', 'trace', 'rub'], ['wheel', 'sew', 'dent'], ['balance', 'zip', 'chain']] },
  { rule: 'rush', tickets: [['sew'], ['pump'], ['glue'], ['screw'], ['zip'], ['wind'], ['trace'], ['oil'], ['balance'], ['thread']] },
  { rule: 'blackout', tickets: [['wheel'], ['oil'], ['pump'], ['trace'], ['screw'], ['sew'], ['balance'], ['thread'], ['dent'], ['wind'], ['zip'], ['pin']] },
  { rule: 'boss', tickets: [['wind', 'dent', 'pin'], ['balance'], ['oil', 'clock', 'zip'], ['trace'], ['sew', 'pump', 'thread']] },
];
export const COUNT = BUSY_END + NIGHT.length;
export const OPEN_ORDER = [...ORDER, ...NIGHT.map(d => d.intro).filter(Boolean)];
export const CHAPTERS = [[1, INTRO, 'learning'], [INTRO + 1, BUSY_END, 'busy'], [BUSY_END + 1, COUNT, 'night']];
const RULE_LINE = {
  order: 'Pick the repairs in order.',
  rush: 'Serve both customers before they leave.',
  blackout: 'Fix by the swinging lamp.',
  boss: 'Finish all three stages of each big job.',
};
export const ASSIST_RATE = 0.45;
export const STAR_BONUS = 5;
export const canAssist = failures => failures >= 2;

// Measured numbers per level: time limit (s), coin target, star times [3 stars, 2 stars] (s). Filled by --calibrate.
export const TUNE = {
  1: {stars: [14, 21]},
  2: {stars: [32, 45], time: 85},
  3: {stars: [33, 46]},
  4: {stars: [36, 49], time: 85, coins: 40},
  5: {stars: [45, 50], time: 75},
  6: {stars: [36, 51]},
  7: {stars: [35, 47], time: 80, coins: 31},
  8: {stars: [41, 51], time: 85},
  9: {stars: [38, 52]},
  10: {stars: [41, 53], time: 85, coins: 46},
  11: {stars: [39, 51], time: 80},
  12: {stars: [39, 51]},
  13: {stars: [44, 52], time: 70, coins: 40},
  14: {stars: [44, 52], time: 75},
  15: {stars: [42, 54]},
  16: {stars: [36, 48], time: 70},
  17: {stars: [37, 50], time: 95, coins: 36},
  18: {stars: [34, 46], time: 65},
  19: {stars: [36, 51]},
  20: {stars: [35, 49], time: 65, coins: 37},
  21: {stars: [40, 57]},
  22: {stars: [42, 57], time: 114, coins: 41},
  23: {stars: [50, 69], time: 85},
  24: {stars: [43, 56], time: 70},
  25: {stars: [54, 72]},
  26: {stars: [56, 74], time: 85, coins: 47},
  27: {stars: [47, 65], time: 75},
  28: {stars: [50, 67], time: 75},
  29: {stars: [54, 78], time: 95, coins: 55},
  30: {stars: [44, 63]},
  31: {stars: [58, 80], time: 84},
  32: {stars: [64, 86], time: 90, coins: 57},
  33: {stars: [13, 18]},
  34: {stars: [15, 19]},
  35: {stars: [16, 22]},
  36: {stars: [10, 14]},
  37: {stars: [31, 40]},
  38: {stars: [23, 30]},
  39: {stars: [26, 35]},
  40: {stars: [16, 23]},
  41: {stars: [37, 50]},
  42: {stars: [28, 36]},
  43: {stars: [32, 42]},
  44: {stars: [26, 34]},
};

// How a level is built, before tuning: patience, two-repair chance, dent count step, golden chance, regular.
function pace(n) {
  if (n === 1) return { patience: 30, two: 0, ramp: 0, golden: 0, regular: false };
  if (n <= INTRO) return { patience: n <= 5 ? 16 : n <= 10 ? 14 : 12, two: 0, ramp: n <= 8 ? 0 : 1, golden: 0, regular: n >= 6 };
  const k = (n - INTRO - 1) / (BUSY_END - INTRO - 1); // preserve the original busy street ramp
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
  if (!Number.isInteger(n) || n < 1 || n > COUNT) return null;
  const night = NIGHT[n - BUSY_END - 1];
  if (night) {
    const { rule, tickets, intro = null } = night;
    const band = Math.floor((n - BUSY_END - 1) / 4);
    const patience = rule === 'rush' ? [23, 20, 17][band] : 12 - band;
    return {
      n, intro, pool: OPEN_ORDER, tickets, rule,
      goal: { [rule]: tickets.length, safe: true },
      seed: 1000 + n * 7919, shape: {}, patience, two: 0, golden: 0, regular: false, ramp: 3 + band,
      stars: TUNE[n]?.stars ?? [32, 48],
    };
  }
  if (!Object.hasOwn(SHAPE, n)) return null;
  const shape = SHAPE[n], tune = TUNE[n] ?? {}, intro = n <= INTRO ? ORDER[n - 1] : null, pool = poolOf(n);
  const goal = {};
  if (shape.list) goal.list = listOf(n, shape.list, pool, intro);
  if (shape.fix) goal.fix = shape.fix;
  if (shape.coinJobs) goal.coins = tune.coins ?? shape.coinJobs * 3;
  if (shape.time) goal.time = tune.time ?? 999;
  if (shape.safe) goal.safe = true;
  return {
    n, intro, pool, goal, seed: 1000 + n * 7919,
    stars: tune.stars ?? [goal.time ? goal.time * 0.6 : 60, goal.time ? goal.time * 0.8 : 90],
    shape, rival: n >= 8 && !!(shape.fix && shape.time && !shape.coinJobs), ...pace(n),
  };
}
export const MAP = Array.from({ length: COUNT }, (_, i) => levelDef(i + 1));

// Keep the English goal descriptor in existing lab records.
export function goalLine(goal) {
  for (const [rule, line] of Object.entries(RULE_LINE)) if (goal[rule]) return line;
  const parts = [];
  if (goal.list) parts.push(`Fix these ${goal.list.length}`);
  if (goal.fix && goal.coins) parts.push(`Fix ${goal.fix} and earn ${goal.coins} base pay`);
  else if (goal.fix) parts.push(`Fix ${goal.fix}`);
  else if (goal.coins) parts.push(`Earn ${goal.coins} base pay`);
  let line = parts.join(' ');
  if (goal.time) line += ` in ${goal.time} seconds`;
  if (goal.safe || goal.list) line += '. One walk-off ends the level';
  return line + '.';
}

// A campaign level pays its repair coins once. New stars always pay, even on a replay.
export function levelReward(coins, stars, previousStars) {
  return (stars && !previousStars ? coins : 0) + Math.max(0, stars - previousStars) * STAR_BONUS;
}

// Display the next tenth so a run just past a star deadline reads over it.
export function resultSeconds(secs) {
  return Math.ceil((secs - 1e-9) * 10) / 10;
}

// The rival stall (tester t1, notes #205 and #233). It fixes a little faster than the clock asks (1.15), so its mistakes bring it home near the limit. It speeds up while
// the player is RIVAL.lead or more ahead, and now and then makes a mistake: it drops a finished one, sneezes or nods off. If it
// reaches the goal first, the level is lost. The clock still ends the level as before. A friend's run (`ghost`, the seconds at which
// the friend fixed each) can stand in for it: it never hurries or slips, and is as fast as the friend was.
export const RIVAL = { hurry: 1.4, lead: 2, gap: [11, 19], gags: { drop: 1.4, sneeze: 1.6, nap: 3 } };
export function makeRival(def, deadline, ghost = null) {
  if (!def?.rival || !deadline) return null;
  const r = { r: (def.seed ^ 0x2f6e2b1) | 0, p: 0, n: 0, goal: def.goal.fix, pace: 1.15 * def.goal.fix / deadline, stall: 0, gag: null, next: 0, hurry: false, ghost };
  r.next = 8 + rivalRand(r) * 6;
  return r;
}
function rivalRand(r) { r.r = (r.r + 0x6D2B79F5) | 0; let t = Math.imul(r.r ^ r.r >>> 15, 1 | r.r); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
// One tick. `clock` is the level's clock, `mine` how many the player has fixed. Returns what happened: 'hurry', 'fixed', a gag, or null.
export function stepRival(r, dt, clock, mine) {
  const was = r.n;
  if (r.ghost) { while (r.n < r.ghost.length && clock >= r.ghost[r.n]) r.n++; r.p = r.n + (r.n < r.ghost.length ? Math.max(0, clock - (r.ghost[r.n - 1] ?? 0)) / (r.ghost[r.n] - (r.ghost[r.n - 1] ?? 0)) : 0); return r.n > was ? 'fixed' : null; }
  if (r.stall > 0) { r.stall -= dt; if (r.stall <= 0) r.gag = null; return null; }
  if (clock >= r.next) {
    const roll = rivalRand(r), [lo, hi] = RIVAL.gap;
    r.gag = roll < 0.34 && r.n > 0 ? 'drop' : roll < 0.67 ? 'sneeze' : 'nap';
    r.stall = RIVAL.gags[r.gag]; r.next = clock + lo + rivalRand(r) * (hi - lo); r.hurry = false;
    if (r.gag === 'drop') { r.p = Math.max(0, r.p - 1); r.n = Math.floor(r.p + 1e-9); }
    return r.gag;
  }
  const hurry = mine - r.n >= RIVAL.lead, began = hurry && !r.hurry;
  r.hurry = hurry; r.p = Math.min(r.goal, r.p + r.pace * (hurry ? RIVAL.hurry : 1) * dt); r.n = Math.floor(r.p + 1e-9);
  return r.n > was ? 'fixed' : began ? 'hurry' : null;
}
// A friend's run as text for a link: the level, then the tenths of a second between one fixed and the next, in base 36.
export const raceText = (n, times) => `${n}.${times.map((t, i) => Math.max(1, Math.round(t * 10) - Math.round((times[i - 1] ?? 0) * 10)).toString(36)).join('-')}`;
export function raceFrom(text) {
  const m = /^(\d{1,2})\.([0-9a-z]{1,3}(?:-[0-9a-z]{1,3}){0,60})$/.exec(text ?? ''); if (!m) return null;
  const def = levelDef(Number(m[1])); if (!def?.rival) return null;
  let t = 0; const times = m[2].split('-').map(v => { t += parseInt(v, 36); return t / 10; });
  return times.length === def.goal.fix && times.every((v, i) => v > (times[i - 1] ?? 0)) && t / 10 <= def.goal.time + 1 ? { n: def.n, times } : null;
}

export function starsFor(def, secs) {
  return secs <= def.stars[0] + 1e-9 ? 3 : secs <= def.stars[1] + 1e-9 ? 2 : 1;
}
