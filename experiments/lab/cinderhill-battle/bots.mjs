import { play, TPS } from './sim.js';
import { march, readFront, RIVALS } from './pacers.js';

const seeds = Number(process.argv[2] ?? 24);
if (!Number.isSafeInteger(seeds) || seeds < 1) throw new Error('Pass a positive number of seeds');
function versus(name, a, b, armies, arena = null) {
  const totals = [0, 0, 0], times = [], ends = {};
  for (let seed = 1; seed <= seeds; seed++) for (const swapped of [false, true]) {
    const g = play(seed, swapped ? [b, a] : [a, b], { arena, armies: swapped ? [...armies].reverse() : armies });
    const { winner, reason } = g.over;
    totals[winner === -1 ? 2 : Number(winner !== Number(swapped))]++;
    times.push(g.t / TPS);
    ends[reason] = (ends[reason] ?? 0) + 1;
  }
  const median = times.sort((a, b) => a - b)[seeds];
  const rates = totals.map(n => (100 * n / times.length).toFixed(1) + '%');
  console.log(name.padEnd(28), rates.join(' / '), 'median', median, 's, range', times[0], 'to', times.at(-1), 's', ends);
  return totals;
}

console.log(`${seeds} seeds on both sides, A win / loss / draw`);
for (const lane of [0, 1, 2]) versus(['Open', 'Two-cell gap', 'Tunnel'][lane], march(lane), march(lane), [[0, 20], [60, 0]], lane);
for (const [name, { army, mind }] of Object.entries(RIVALS)) {
  versus(`Open rush v ${name}`, march(0), mind, [[48, 16], army]);
  versus(`Reads front v ${name}`, readFront, mind, [[48, 16], army]);
}
