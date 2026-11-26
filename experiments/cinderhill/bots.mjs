// Colony bots: three ways to play a colony game for three days (36,000 ticks), to tune colony.js.
// - careful: every 1,500 ticks, a trail to the nearest pile of the food the colony is shorter of (sugar or
//   protein), and a new trail when that pile runs out.
// - greedy: trails to sugar only (sugar lays eggs; with no protein the larvae starve).
// - idle: no orders; foragers find food only by wandering.
// - careless: careful, but it ignores the spider (spider.js). Careful turns Recall on at the spider's warning and
//   off when it leaves, so the spider finds the surface empty.
// The careful bot should grow the colony toward 100 ants in three days, and idle should do clearly worse.
// Each day has a goal (colony.js, Days). The careful bot also works toward it: on a digging day it marks a
// nursery beside the queen's chamber at dawn. Acceptance (Days PR): idle fails every day's goal on every seed,
// and careful passes every day on every seed.
//
// Usage: node experiments/cinderhill/bots.mjs [seeds, comma-separated] [ticks] [bots, comma-separated]
import { CMD, FOOD, G, STAGE, SURFACE, Sim } from './sim/sim.js';
import { GOAL_KIND, START, goalOf } from './sim/colony.js';
import { EVENT } from './sim/sim.js';
import { SPIDER } from './sim/spider.js';
const DAY = 12000;

function piles(sim, kind) {
  const L = sim.L, ex = L.sw >> 1, ey = L.sh >> 1, out = [];
  for (let p = 0; p < sim.pileCell.length; p++) {
    const c = sim.pileCell[p];
    if (c < 0 || sim.pileAmount[p] <= 0 || sim.pileKind[p] !== kind) continue;
    const x = c % L.sw, y = Math.floor(c / L.sw);
    out.push({ p, x, y, d: Math.max(Math.abs(x - ex), Math.abs(y - ey)) });
  }
  return out.sort((a, b) => a.d - b.d);
}

const BOTS = {
  careful: [FOOD.SUGAR, FOOD.PROTEIN],
  greedy: [FOOD.SUGAR],
  idle: [],
  careless: [FOOD.SUGAR, FOOD.PROTEIN],
};
const DIGS = { careful: true, greedy: false, idle: false, careless: true };
const RECALLS = { careful: true };

/** A nursery of 8 x 6 cells beside the queen's chamber (the side with more soil). */
function nursery(sim) {
  const h = sim.home, L = sim.L, cells = [], x0 = h.x + h.w + 8 <= L.nw ? h.x + h.w : h.x - 8;
  for (let y = h.y; y < h.y + 6; y++) for (let x = x0; x < x0 + 8; x++) cells.push(x, y);
  return cells;
}

export function play(bot, seed, ticks = 3 * DAY, extra = {}) {
  const sim = new Sim({ seed, ...START, colony: 1, ...extra });
  const L = sim.L, ex = L.sw >> 1, ey = L.sh >> 1, kinds = BOTS[bot], T = sim.cfg.dayTicks;
  const days = [];
  let id = 0, last = -1, lastPile = -1, recall = -1, eaten = 0;
  for (let t = 0; t < ticks; t++) {
    // At dawn: a digging day's goal needs a room dug.
    if (DIGS[bot] && t % T === 0 && goalOf(sim.g[G.DAY]).kind === GOAL_KIND.DUG) sim.queueCommand({ tick: sim.tick, id: ++id, seat: 0, type: CMD.DIG, cells: nursery(sim) });
    // Every 1,500 ticks (or when the trail's pile runs out), a trail to the food the colony is shortest of.
    // Seeking foragers take the newest trail, and a forager keeps the trail that led her out, so redrawing
    // to the scarcer food splits the crew between the two foods over time.
    const empty = lastPile >= 0 && sim.pileAmount[lastPile] <= 0;
    if (kinds.length && (t % 1500 === 0 || empty)) {
      const kind = kinds.length === 1 ? kinds[0] : scarcer(sim);
      const near = piles(sim, kind)[0] ?? piles(sim, kind ^ 1)[0];
      if (near && (near.p !== lastPile || kind !== last || empty)) {
        sim.queueCommand({ tick: sim.tick, id: ++id, seat: 0, type: CMD.TRAIL, layer: SURFACE, points: [ex + 1, ey + 1, near.x, near.y] });
        last = kind; lastPile = near.p;
      }
    }
    if (recall >= 0) { sim.queueCommand({ tick: sim.tick, id: ++id, seat: 0, type: CMD.RECALL, on: recall === 1 }); recall = -1; }
    sim.step();
    const ev = sim.drainEvents();
    for (let k = 0; k < ev.length; k += 3) {
      if (ev[k] === EVENT.DUSK) { days.push({ day: ev[k + 1], won: ev[k + 2], goal: sim.lastDusk, eaten: sim.g[G.SP_EATEN] - eaten, ...count(sim) }); eaten = sim.g[G.SP_EATEN]; }
      if (ev[k] === EVENT.SPIDER && RECALLS[bot] && ev[k + 1] !== SPIDER.HUNT) recall = ev[k + 1] === SPIDER.WARN ? 1 : 0;
    }
  }
  return days;
}

/** The food with fewer meals in store: sugar feeds the queen's laying and the adults, protein the larvae. */
function scarcer(sim) {
  const g = sim.g, larvae = Array.from(sim.brood.stage.subarray(0, sim.brood.n)).filter(s => s === STAGE.LARVA).length;
  const sugarNeed = Math.ceil(sim.n / 10) + 5, proteinNeed = larvae + 1; // per 1,200 ticks (colony.js C)
  return g[G.SUGAR] * proteinNeed <= g[G.PROTEIN] * sugarNeed ? FOOD.SUGAR : FOOD.PROTEIN;
}

function count(sim) {
  const g = sim.g;
  return { ants: sim.n, brood: sim.brood.n, born: g[G.BORN], lost: g[G.BROOD_LOST], hungry: g[G.HUNGRY], sugar: g[G.SUGAR], protein: g[G.PROTEIN] };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const seeds = (process.argv[2] ?? '3,8,5').split(',').map(Number), ticks = Number(process.argv[3] ?? 3 * DAY);
  const bots = process.argv[4] ? process.argv[4].split(',') : Object.keys(BOTS);
  for (const bot of bots) for (const seed of seeds) {
    const t0 = performance.now(), days = play(bot, seed, ticks);
    console.log(`${bot.padEnd(7)} seed ${String(seed).padStart(2)}: ` + days.map((d, k) => `day ${k + 1} ${d.won ? 'WON' : 'lost'} ${d.goal.kind === GOAL_KIND.BOTH_FOODS ? `${d.goal.a}s/${d.goal.b}p` : d.goal.a}/${d.goal.target} eaten ${d.eaten} ants ${d.ants} brood ${d.brood} (born ${d.born}, lost ${d.lost}, hungry ${d.hungry}, sugar ${d.sugar}, protein ${d.protein})`).join(' | ') + `  ${((performance.now() - t0) / 1000).toFixed(1)} s`);
  }
}
