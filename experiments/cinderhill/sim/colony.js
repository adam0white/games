// The colony: the queen, brood (egg, larva, pupa), sugar and protein, castes, and the fight hook.
// Pure and integer-only, like the rest of sim/. Runs only when cfg.colony is set; the sandbox (the trail
// painter's ?ants= page and the spikes) spawns adults at the start and has no queen or brood.
//
// The rules (sim 8: the starting values of 02-spec 3.2; numbers to tune by bots and play):
// - A forager carries one load: sugar from a sugar pile, protein from a protein pile. A load brought home (to the
//   porch store, 3 cells under the entrance) adds one unit to that store (LOAD).
// - The queen lays an egg every LAY_EVERY ticks (1 a second) while there is sugar in store, at most one brood per
//   nursery cell (64). Eggs are free.
// - An egg hatches into a larva after EGG_TICKS (15 s). A larva eats one load of protein as soon as there is one
//   (one larva a tick, oldest first in brood order) and pupates LARVA_TICKS (25 s) after hatching once fed; with
//   MAJOR_PROTEIN or more in store it is fed on to MAJOR_FEEDS loads and becomes a major. A larva with no meal for
//   LARVA_STARVE ticks (60 s) dies.
// - A pupa becomes an adult after PUPA_TICKS (20 s), in the cell where it lay. Jobs go round by birth order.
//   Egg to adult: 60 s.
// - Adults eat: every ADULT_EAT_EVERY ticks (a minute), one load of sugar per ADULTS_PER_SUGAR ants (rounded up).
//   When there is not enough, the store empties and G.HUNGRY counts the missed meal. No adult starves yet (the
//   spec's starvation rules are not built).
//
// Fights (for the battle work to come, 02-spec 6.5): every ant has a caste, hit points, a team and a bite
// cooldown. fight() runs once a tick after every ant has moved: each ant whose cooldown is over bites the first
// enemy within BITE_R on her layer (cells in reading order, then index order), and waits BITE_EVERY ticks. An
// ant at 0 hit points is removed at the end of the tick, keeping the others in index order. With one team on
// the map fight() only counts down cooldowns, so it costs next to nothing in solo play.

import { G } from './flow.js';
import { STREAM, below } from './rng.js';
import { MAT, NEST, SURFACE, cellAt } from './grid.js';

export const CASTE = { WORKER: 0, MAJOR: 1 };
export const CASTE_HP = [12, 30];
export const CASTE_BITE = [2, 5];
export const BITE_EVERY = 10; // ticks between one ant's bites
export const BITE_R = 160; // sub-cell units, by the separation's distance estimate: ants that touch can bite
export const STAGE = { EGG: 0, LARVA: 1, PUPA: 2 };
export const FOOD = { SUGAR: 0, PROTEIN: 1 };
export const LOAD = [1, 1]; // store units per load brought home: sugar, protein (02-spec 3.2: 1 load = 1 unit)
export const BROOD_MAX = 512;
// How a colony game starts (02-spec 3.2, owner choice 11 decision 6 B): 30 adults, 20 foragers on the surface around
// the entrance and 10 nurses; 10 sugar and 5 protein in the porch store; 20 eggs aged 0 to 10 s, 20 larvae aged 0 to
// 20 s, and 12 brood due from 8 s, one every 3 s (startColony).
export const START = { ants: 30, surface: 20, sugar: 10, protein: 5, eggs: 20, larvae: 20, pupae: 12 };
export const C = {
  LAY_EVERY: 20, EGG_TICKS: 300, LARVA_TICKS: 500, MAJOR_FEEDS: 3, MAJOR_PROTEIN: 20,
  LARVA_STARVE: 1200, PUPA_TICKS: 400, ADULT_EAT_EVERY: 1200, ADULTS_PER_SUGAR: 10, NURSERY: 64,
};
// Jobs by birth order, out of ten: 7 forage, 2 dig, 1 guard (JOB values from sim.js: 0 forage, 1 dig, 2 guard).
const JOB_ROUND = [0, 0, 1, 0, 0, 2, 0, 0, 1, 0];

export function makeBrood() {
  return { n: 0, stage: new Uint8Array(BROOD_MAX), age: new Uint16Array(BROOD_MAX), fed: new Uint8Array(BROOD_MAX), hunger: new Uint16Array(BROOD_MAX), cell: new Int32Array(BROOD_MAX) };
}

/** The nursery: in a generated colony game a 16 by 4 room 12 cells down (world.js, 02-spec 3.2); otherwise (the
 *  sandbox, test maps) the home chamber. */
export const nursery = sim => sim.nursery ?? sim.home;

/** A random open cell of the nursery, from the spare stream. */
function chamberCell(sim) {
  const h = nursery(sim), r = sim.rng, S = STREAM.spare;
  // One brood per cell (02-spec 3.2): a cell is free when it is open and holds no brood.
  const B = sim.brood, free = c => { if (c < 0 || sim.mat[c] !== MAT.OPEN) return false; for (let k = 0; k < B.n; k++) if (B.cell[k] === c) return false; return true; };
  for (let tries = 0; tries < 8; tries++) {
    const c = cellAt(sim.L, NEST, h.x + below(r, S, h.w), h.y + below(r, S, h.h));
    if (free(c)) return c;
  }
  // Unlucky draws: the first free cell of the nursery in reading order (part of it may be outside the nest).
  for (let y = h.y; y < h.y + h.h; y++) for (let x = h.x; x < h.x + h.w; x++) {
    const c = cellAt(sim.L, NEST, x, y);
    if (free(c)) return c;
  }
  return -1;
}

/** A colony game's start (sim 8, 02-spec 3.2): adults, stores and brood from cfg. The first `surface` adults are
 *  foragers on the surface within 3 cells of the entrance, the rest nurses in the nursery. Brood ages: eggs
 *  0 to 10 s, larvae 0 to 20 s (unfed), and `pupae` brood due from 8 s, one every 3 s: the ones due within a pupa
 *  stage are pupae, the later ones fed larvae (a 20 s pupa cannot be due at 41 s). Their times are fractions of
 *  PUPA_TICKS, so a slower brood (the pace gate's plant) delays them too. */
export function startColony(sim) {
  const cfg = sim.cfg, g = sim.g, L = sim.L, r = sim.rng, A = STREAM.ants, ex = L.sw >> 1, ey = L.sh >> 1;
  for (let k = 0; k < cfg.ants; k++) {
    if (k < cfg.surface) {
      let cell = -1;
      for (let t = 0; t < 16 && cell < 0; t++) { const c = cellAt(L, SURFACE, ex - 3 + below(r, A, 7), ey - 3 + below(r, A, 7)); if (c >= 0 && sim.mat[c] === MAT.OPEN) cell = c; }
      sim.spawn(0 /* JOB.FORAGE */, CASTE.WORKER, 0, cell >= 0 ? cell : cellAt(L, SURFACE, ex, ey));
    } else sim.spawn(3 /* JOB.NURSE */, CASTE.WORKER, 0, chamberCell(sim));
  }
  g[G.QUEEN] = 1; g[G.SUGAR] = cfg.sugar; g[G.PROTEIN] = cfg.protein;
  const B = sim.brood;
  for (let k = 0; k < cfg.pupae; k++) {
    const due = Math.floor((C.PUPA_TICKS * (8 + 3 * k)) / 20); // 8 s, 11 s, ... with a 20 s pupa
    if (due <= C.PUPA_TICKS) { if (addBrood(sim, STAGE.PUPA)) B.age[B.n - 1] = C.PUPA_TICKS - due; }
    else if (addBrood(sim, STAGE.LARVA)) { B.age[B.n - 1] = Math.max(0, C.LARVA_TICKS - (due - C.PUPA_TICKS)); B.fed[B.n - 1] = 1; }
  }
  for (let k = 0; k < cfg.larvae; k++) if (addBrood(sim, STAGE.LARVA)) B.age[B.n - 1] = B.hunger[B.n - 1] = Math.floor((400 * k) / Math.max(1, cfg.larvae)); // unfed since they hatched
  for (let k = 0; k < cfg.eggs; k++) if (addBrood(sim, STAGE.EGG)) B.age[B.n - 1] = Math.floor((200 * k) / Math.max(1, cfg.eggs));
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
  let w = 0, fedThisTick = false;
  for (let k = 0; k < B.n; k++) {
    let keep = true, stage = B.stage[k];
    if (B.age[k] < 0xFFFF) B.age[k]++;
    const age = B.age[k];
    if (stage === STAGE.EGG) {
      if (age >= C.EGG_TICKS) { stage = STAGE.LARVA; B.age[k] = 0; }
    } else if (stage === STAGE.LARVA) {
      // One meal a tick for the whole brood, in brood order: protein goes to the larvae that came first.
      // A larva fed with MAJOR_PROTEIN in store at her first meal is fed on to MAJOR_FEEDS: each meal since took one.
      const wants = B.fed[k] === 0 || (B.fed[k] < C.MAJOR_FEEDS && g[G.PROTEIN] >= C.MAJOR_PROTEIN - B.fed[k]);
      if (wants && !fedThisTick && g[G.PROTEIN] > 0) { g[G.PROTEIN]--; B.fed[k]++; B.hunger[k] = 0; fedThisTick = true; }
      else if (B.fed[k] === 0 && B.hunger[k] < 0xFFFF) B.hunger[k]++;
      if (B.hunger[k] >= C.LARVA_STARVE) { keep = false; g[G.BROOD_LOST]++; }
      else if (B.fed[k] > 0 && age >= C.LARVA_TICKS && !(wants && g[G.PROTEIN] > 0)) { stage = STAGE.PUPA; B.age[k] = 0; }
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
    if (g[G.LAY] === 0 && g[G.SUGAR] > 0 && B.n < Math.min(BROOD_MAX, C.NURSERY) && sim.n + B.n < sim.cfg.maxAnts) {
      if (addBrood(sim, STAGE.EGG)) g[G.LAY] = C.LAY_EVERY; // no open cell in the nursery: she tries again next tick
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
// A day is cfg.dayTicks ticks (4,200: 3.5 minutes). Each day has one goal, checked at dusk: the last tick of the
// day, after everything else in that tick. Goals count from dawn, so a day cannot be won with yesterday's work.
// Day 1 asks for the trail, day 2 for digging, day 3 for both foods; each needs an order, so a colony left alone
// fails all three (bots.mjs measures it). Later days repeat day 3 with a larger target.
// Losing a day: the colony keeps what it has, and the next day's goal is eased by a quarter. At every dawn a colony
// below the floor (fewer than START.ants ants, or under FLOOR_SUGAR sugar) gets GIFT_SUGAR sugar (02-spec 6.9:
// "Burr brings seeds"). The page offers a restart from the dawn save; that lives in the page, not here.
export const DAY_TICKS = 4200; // 3.5 minutes (sim 7; 12,000 before)
export const GOAL_KIND = { TRAIL_LOADS: 1, DUG: 2, BOTH_FOODS: 3 };
// [kind, target] per day, from day 1.
export const DAY_GOALS = [[GOAL_KIND.TRAIL_LOADS, 60], [GOAL_KIND.DUG, 40], [GOAL_KIND.BOTH_FOODS, 110]]; // sim 7: day 1 asks 60 loads (40 before) and day 3 110 of each food (60 before): ants are twice as fast and food is near, and a day-3 colony left alone fetched at least 77 of each by scent (bots.mjs idle, seed 3)
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
