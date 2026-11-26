// Colony bots: three ways to play a colony game for three days (36,000 ticks), to tune colony.js.
// - careful: every 1,500 ticks, a trail to the nearest pile of the food the colony is shorter of (sugar or
//   protein), and a new trail when that pile runs out.
// - greedy: trails to sugar only (sugar lays eggs; with no protein the larvae starve).
// - idle: no orders; foragers find food only by wandering.
// The careful bot should grow the colony toward 100 ants in three days, and idle should do clearly worse.
//
// Usage: node experiments/cinderhill/bots.mjs [seeds, comma-separated] [ticks] [bots, comma-separated]
import { CMD, FOOD, G, STAGE, SURFACE, Sim } from './sim/sim.js';
import { START } from './sim/colony.js';
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
};

export function play(bot, seed, ticks = 3 * DAY) {
  const sim = new Sim({ seed, ...START, colony: 1 });
  const L = sim.L, ex = L.sw >> 1, ey = L.sh >> 1, kinds = BOTS[bot];
  const days = [];
  let id = 0, last = -1, lastPile = -1;
  for (let t = 0; t < ticks; t++) {
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
    sim.step();
    if ((t + 1) % DAY === 0) days.push(count(sim));
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
    console.log(`${bot.padEnd(7)} seed ${String(seed).padStart(2)}: ` + days.map((d, k) => `day ${k + 1} ants ${d.ants} brood ${d.brood} (born ${d.born}, lost ${d.lost}, hungry ${d.hungry}, sugar ${d.sugar}, protein ${d.protein})`).join(' | ') + `  ${((performance.now() - t0) / 1000).toFixed(1)} s`);
  }
}
