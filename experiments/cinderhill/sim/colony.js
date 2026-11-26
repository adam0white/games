// The colony: the queen, brood (egg, larva, pupa), sugar and protein, castes, and the fight hook.
// Pure and integer-only, like the rest of sim/. Runs only when cfg.colony is set; the sandbox (the trail
// painter's ?ants= page and the spikes) spawns adults at the start and has no queen or brood.
//
// The rules (02-spec 6.3; numbers to tune by bots and play, 02-spec section 10):
// - A forager carries one load: sugar from a sugar pile, protein from a protein pile. A load brought home
//   adds LOAD[kind] units to that store.
// - The queen lays an egg every LAY_EVERY ticks while the colony has a unit of sugar for it, and faster when
//   sugar is plentiful: every LAY_EVERY/2 ticks at LAY_RICH units in store, LAY_EVERY/4 at 4*LAY_RICH. So a
//   colony that brings in more sugar than it eats turns it into eggs; without this, laying capped growth at
//   50 eggs a day and a colony that played well grew no faster than one left alone (bots.mjs).
// - An egg hatches into a larva after EGG_TICKS. A larva eats one unit of protein every FEED_EVERY ticks while
//   there is protein. After LARVA_FEEDS meals it pupates; if protein is plentiful (MAJOR_PROTEIN units in
//   store) it is fed on to MAJOR_FEEDS meals and becomes a major (well-fed larvae become majors, as in real
//   colonies). A larva with no meal for LARVA_STARVE ticks dies.
// - A pupa becomes an adult after PUPA_TICKS, in the cell where it lay. Jobs go round by birth order.
// - Adults eat: every ADULT_EAT_EVERY ticks, one unit of sugar per ADULTS_PER_SUGAR ants (rounded up). When
//   there is not enough, the store empties and G.HUNGRY counts the missed meal. No adult starves yet (the
//   starvation guard is feature 17, P1).
// Egg to adult is EGG_TICKS + LARVA_FEEDS * FEED_EVERY + PUPA_TICKS = 11,400 ticks, 9.5 minutes: about one day
// of play (02-spec section 10: "about 1 day of play").
//
// Fights (for the battle work to come, 02-spec 6.5): every ant has a caste, hit points, a team and a bite
// cooldown. fight() runs once a tick after every ant has moved: each ant whose cooldown is over bites the first
// enemy within BITE_R on her layer (cells in reading order, then index order), and waits BITE_EVERY ticks. An
// ant at 0 hit points is removed at the end of the tick, keeping the others in index order. With one team on
// the map fight() only counts down cooldowns, so it costs next to nothing in solo play.

import { G } from './flow.js';
import { STREAM, below } from './rng.js';
import { MAT, NEST, cellAt } from './grid.js';

export const CASTE = { WORKER: 0, MAJOR: 1 };
export const CASTE_HP = [12, 30];
export const CASTE_BITE = [2, 5];
export const BITE_EVERY = 10; // ticks between one ant's bites
export const BITE_R = 160; // sub-cell units, by the separation's distance estimate: ants that touch can bite
export const STAGE = { EGG: 0, LARVA: 1, PUPA: 2 };
export const FOOD = { SUGAR: 0, PROTEIN: 1 };
export const LOAD = [4, 2]; // store units per load brought home: sugar, protein
export const BROOD_MAX = 512;
// How a colony game starts (the page's ?colony=1 and bots.mjs): 20 workers, 40 sugar, 4 larvae.
export const START = { ants: 20, sugar: 40, larvae: 4 };
export const C = {
  LAY_EVERY: 240, LAY_RICH: 50, EGG_TICKS: 3000, FEED_EVERY: 1200, LARVA_FEEDS: 3, MAJOR_FEEDS: 5, MAJOR_PROTEIN: 20,
  LARVA_STARVE: 6000, PUPA_TICKS: 4800, ADULT_EAT_EVERY: 1200, ADULTS_PER_SUGAR: 10,
};
// Jobs by birth order, out of ten: 7 forage, 2 dig, 1 guard (JOB values from sim.js: 0 forage, 1 dig, 2 guard).
const JOB_ROUND = [0, 0, 1, 0, 0, 2, 0, 0, 1, 0];

export function makeBrood() {
  return { n: 0, stage: new Uint8Array(BROOD_MAX), age: new Uint16Array(BROOD_MAX), fed: new Uint8Array(BROOD_MAX), hunger: new Uint16Array(BROOD_MAX), cell: new Int32Array(BROOD_MAX) };
}

/** A random open cell of the queen's chamber (the home rectangle), from the spare stream. */
function chamberCell(sim) {
  const h = sim.home, r = sim.rng, S = STREAM.spare;
  for (let tries = 0; tries < 8; tries++) {
    const c = cellAt(sim.L, NEST, h.x + below(r, S, h.w), h.y + below(r, S, h.h));
    if (c >= 0 && sim.mat[c] === MAT.OPEN) return c;
  }
  // Unlucky draws: the first open cell of the chamber in reading order (part of it may be outside the nest).
  for (let y = h.y; y < h.y + h.h; y++) for (let x = h.x; x < h.x + h.w; x++) {
    const c = cellAt(sim.L, NEST, x, y);
    if (c >= 0 && sim.mat[c] === MAT.OPEN) return c;
  }
  return -1;
}

/** Add one brood item; false when the brood is full. */
export function addBrood(sim, stage, cell = chamberCell(sim)) {
  const B = sim.brood;
  if (B.n >= BROOD_MAX || cell < 0) return false;
  const k = B.n++;
  B.stage[k] = stage; B.age[k] = 0; B.fed[k] = 0; B.hunger[k] = 0; B.cell[k] = cell;
  return true;
}

/** The colony's tick: laying, brood, adults' meals. Called once a tick before the ants move. */
export function stepColony(sim) {
  const g = sim.g, B = sim.brood;
  let w = 0;
  for (let k = 0; k < B.n; k++) {
    let keep = true, stage = B.stage[k];
    if (B.age[k] < 0xFFFF) B.age[k]++;
    const age = B.age[k];
    if (stage === STAGE.EGG) {
      if (age >= C.EGG_TICKS) { stage = STAGE.LARVA; B.age[k] = 0; }
    } else if (stage === STAGE.LARVA) {
      if (B.hunger[k] < 0xFFFF) B.hunger[k]++;
      if (age % C.FEED_EVERY === 0 && g[G.PROTEIN] > 0) { g[G.PROTEIN]--; B.fed[k]++; B.hunger[k] = 0; }
      if (B.hunger[k] >= C.LARVA_STARVE) { keep = false; g[G.BROOD_LOST]++; }
      else if (B.fed[k] >= C.MAJOR_FEEDS || (B.fed[k] >= C.LARVA_FEEDS && g[G.PROTEIN] < C.MAJOR_PROTEIN)) { stage = STAGE.PUPA; B.age[k] = 0; }
    } else if (age >= C.PUPA_TICKS) {
      // An adult, if there is room: at the cap the pupa waits.
      const job = JOB_ROUND[g[G.BORN] % 10], caste = B.fed[k] >= C.MAJOR_FEEDS ? CASTE.MAJOR : CASTE.WORKER;
      const i = sim.spawn(job, caste, 0, B.cell[k]);
      if (i >= 0) { keep = false; g[G.BORN]++; }
    }
    B.stage[k] = stage;
    if (!keep) continue;
    if (w !== k) { B.stage[w] = B.stage[k]; B.age[w] = B.age[k]; B.fed[w] = B.fed[k]; B.hunger[w] = B.hunger[k]; B.cell[w] = B.cell[k]; }
    w++;
  }
  B.n = w;
  // Laying comes after the brood's tick, so an egg is EGG_TICKS old when it hatches, counted from the tick it was laid.
  if (g[G.QUEEN]) {
    if (g[G.LAY] > 0) g[G.LAY]--;
    if (g[G.LAY] === 0 && g[G.SUGAR] > 0 && B.n < BROOD_MAX && sim.n + B.n < sim.cfg.maxAnts) {
      const sugar = g[G.SUGAR];
      if (addBrood(sim, STAGE.EGG)) { // no open cell in the chamber: she tries again next tick
        g[G.SUGAR]--;
        g[G.LAY] = sugar >= 4 * C.LAY_RICH ? C.LAY_EVERY >> 2 : sugar >= C.LAY_RICH ? C.LAY_EVERY >> 1 : C.LAY_EVERY;
      }
    }
  }
  if (g[G.TICK] % C.ADULT_EAT_EVERY === C.ADULT_EAT_EVERY - 1 && sim.n > 0) {
    const need = Math.floor((sim.n + C.ADULTS_PER_SUGAR - 1) / C.ADULTS_PER_SUGAR);
    if (g[G.SUGAR] >= need) g[G.SUGAR] -= need; else { g[G.SUGAR] = 0; g[G.HUNGRY]++; }
  }
}

/** The fight pass, after every ant has moved this tick. The hook battles plug into. */
export function fight(sim) {
  const n = sim.n, team = sim.team, hp = sim.hp, cool = sim.cool, X = sim.x, Y = sim.y;
  let mixed = false;
  for (let i = 0; i < n; i++) { if (cool[i]) cool[i]--; if (team[i] !== team[0]) mixed = true; }
  if (!mixed) return;
  sim.buildBuckets(); // where the ants are now, after this tick's moves
  for (let i = 0; i < n; i++) {
    if (hp[i] === 0 || cool[i]) continue;
    const layer = sim.layer[i], cx = X[i] >> 8, cy = Y[i] >> 8;
    let target = -1;
    for (let oy = -1; oy <= 1 && target < 0; oy++) for (let ox = -1; ox <= 1 && target < 0; ox++) {
      const cc = cellAt(sim.L, layer, cx + ox, cy + oy);
      if (cc < 0) continue;
      for (let j = sim.head[cc]; j >= 0; j = sim.nextAnt[j]) {
        if (team[j] === team[i] || hp[j] === 0) continue;
        const dx = X[i] - X[j], dy = Y[i] - Y[j];
        const adx = dx < 0 ? -dx : dx, ady = dy < 0 ? -dy : dy;
        if ((adx > ady ? adx + ((ady * 3) >> 3) : ady + ((adx * 3) >> 3)) < BITE_R) { target = j; break; } // the separation's distance estimate
      }
    }
    if (target >= 0) { hurt(sim, target, CASTE_BITE[sim.caste[i] & 1]); cool[i] = BITE_EVERY; }
  }
}

/** Take hit points from ant i; at 0 she is removed at the end of the tick. */
export function hurt(sim, i, amount) {
  const hp = sim.hp[i];
  if (hp === 0) return;
  sim.hp[i] = hp > amount ? hp - amount : 0;
  if (sim.hp[i] === 0) { sim.g[G.DIED]++; sim.anyDead = true; }
}

// ---- Days (02-spec 6.8, 6.9) ----
// A day is cfg.dayTicks ticks (12,000: ten minutes). Each day has one goal, checked at dusk: the last tick of the
// day, after everything else in that tick. Goals count from dawn, so a day cannot be won with yesterday's work.
// Day 1 asks for the trail, day 2 for digging, day 3 for both foods; each needs an order, so a colony left alone
// fails all three (bots.mjs measures it). Later days repeat day 3 with a larger target.
// Losing a day: the colony keeps what it has, and the next day's goal is eased by a quarter. At every dawn a colony
// below the floor (fewer than START.ants ants, or under FLOOR_SUGAR sugar) gets GIFT_SUGAR sugar (02-spec 6.9:
// "Burr brings seeds"). The page offers a restart from the dawn save; that lives in the page, not here.
export const DAY_TICKS = 12000;
export const GOAL_KIND = { TRAIL_LOADS: 1, DUG: 2, BOTH_FOODS: 3 };
// [kind, target] per day, from day 1.
export const DAY_GOALS = [[GOAL_KIND.TRAIL_LOADS, 40], [GOAL_KIND.DUG, 40], [GOAL_KIND.BOTH_FOODS, 60]];
export const FLOOR_SUGAR = 10, GIFT_SUGAR = 20;

/** The goal of day `day` (1 = the first): { kind, target }, eased by a quarter when `eased`. */
export function goalOf(day, eased = 0) {
  const k = day <= DAY_GOALS.length ? day - 1 : DAY_GOALS.length - 1;
  const [kind, base] = DAY_GOALS[k], target = day <= DAY_GOALS.length ? base : base + 30 * (day - DAY_GOALS.length);
  return { kind, target: eased ? target - (target >>> 2) : target };
}

/** The counters a goal is measured with, as [a, b]; progress is what they gained since dawn. */
function counters(g, kind) {
  if (kind === GOAL_KIND.TRAIL_LOADS) return [g[G.TRAIL_LOADS], 0];
  if (kind === GOAL_KIND.DUG) return [g[G.DUG], 0];
  return [g[G.SUGAR_LOADS], g[G.PROTEIN_LOADS]];
}

/** Today's goal and progress: { day, kind, target, done (0..target), a, b, won, left (ticks to dusk) }. For both
 *  foods, a and b are the sugar and protein loads since dawn and done is the smaller. */
export function dayState(sim) {
  const g = sim.g, day = g[G.DAY], { kind, target } = goalOf(day, g[G.EASED]);
  const [ca, cb] = counters(g, kind), a = ca - g[G.BASE_A], b = cb - g[G.BASE_B];
  const done = kind === GOAL_KIND.BOTH_FOODS ? (a < b ? a : b) : a;
  const T = sim.cfg.dayTicks;
  return { day, kind, target, a, b, done: done > target ? target : done, won: done >= target, left: T - (g[G.TICK] % T), eased: g[G.EASED] };
}

/** Dawn of day `day`: its goal's counters as they are now. */
function dawn(sim, day, eased) {
  const g = sim.g;
  g[G.DAY] = day; g[G.EASED] = eased;
  const [a, b] = counters(g, goalOf(day, eased).kind);
  g[G.BASE_A] = a; g[G.BASE_B] = b;
}

export function startDays(sim) { dawn(sim, 1, 0); }

/** Called at the end of every colony tick, before the tick count moves on. At dusk: judge the goal, raise
 *  EVENT.DUSK (day, won), and start the next day. Returns true at dusk. */
export function stepDay(sim, duskEvent) {
  const g = sim.g, T = sim.cfg.dayTicks;
  if ((g[G.TICK] + 1) % T !== 0) return false;
  const day = g[G.DAY], st = dayState(sim), won = st.won;
  sim.lastDusk = st; // the goal as judged, for the page and bots (not sim state: read it right after the step)
  g[G.DAY_LAST] = won ? 1 : 2;
  if (won) g[G.DAYS_WON]++;
  sim.event(duskEvent, day, won ? 1 : 0);
  if (sim.n < START.ants || g[G.SUGAR] < FLOOR_SUGAR) g[G.SUGAR] = g[G.SUGAR] > 0x7fffffff - GIFT_SUGAR ? 0x7fffffff : g[G.SUGAR] + GIFT_SUGAR; // saturates
  dawn(sim, day + 1, won ? 0 : 1);
  return true;
}
