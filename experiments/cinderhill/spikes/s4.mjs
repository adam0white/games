// Spike S4: size of a late-join snapshot: a dug nest, 5,000 ants, live scent, after play.
// Pass line: under 64 KB compressed. Usage: node s4.mjs [--ants=5000] [--ticks=3000]
// The orders are script(seed 2026, ticks), so each tick count is its own run (as in SPIKES.md).
import { G, MAT, NEST, Sim } from '../sim/sim.js';
import { cellAt } from '../sim/grid.js';
import { script, replay } from '../sim/replay.js';
import { restore, snapshot, snapshotParts } from '../sim/snapshot.js';

const args = process.argv.slice(2), opt = (k, d) => Number(args.find(a => a.startsWith(`--${k}=`))?.split('=')[1] ?? d);
const ANTS = opt('ants', 5000), TICKS = opt('ticks', 3000);

const squeeze = async (bytes, format) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream(format))).arrayBuffer());
const kb = n => `${(n / 1024).toFixed(1)} KB`;

/** The S4 world: seed 2026, a late-game nest dug before play, then `ticks` of scripted orders. */
export function s4World(ants, ticks) {
  const sim = new Sim({ seed: 2026, ants });
  // Galleries at four depths across the width, shafts between them, and rooms off them.
  const L = sim.L, open = (x, y) => { const c = cellAt(L, NEST, x, y); if (c >= 0 && sim.mat[c] !== MAT.STONE) sim.setCell(c, MAT.OPEN); };
  for (const y of [30, 52, 76, 100]) for (let x = 20; x < L.nw - 20; x++) { open(x, y); open(x, y + 1); }
  for (const x of [40, 70, 96, 97, 122, 150]) for (let y = 24; y < 102; y++) open(x, y);
  for (const [x0, y0] of [[24, 33], [60, 33], [120, 33], [150, 55], [30, 79], [100, 79], [140, 103], [60, 103]]) for (let y = y0; y < y0 + 6; y++) for (let x = x0; x < x0 + 14; x++) open(x, y);
  replay({ cfg: {}, commands: script({ seed: 2026 }, ticks), ticks, every: ticks, sim });
  return sim;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const sim = s4World(ANTS, TICKS);
  let surface = 0; for (let i = 0; i < sim.n; i++) surface += sim.layer[i] === 0 ? 1 : 0;
  console.log(`${sim.n} ants (${surface} on the surface) after ${TICKS} ticks; dug ${sim.g[G.DUG]} cells in play`);
  let t = process.hrtime.bigint();
  const bytes = snapshot(sim);
  const encodeMs = Number(process.hrtime.bigint() - t) / 1e6;
  console.log(`snapshot ${kb(bytes.length)} (${bytes.length} bytes), encoded in ${encodeMs.toFixed(0)} ms`);
  for (const format of ['gzip', 'deflate']) console.log(`${format}: ${kb((await squeeze(bytes, format)).length)}`);
  console.table(Object.fromEntries(snapshotParts(sim).map(([name, b]) => [name, kb(b)])));
  t = process.hrtime.bigint();
  const back = restore(bytes);
  const decodeMs = Number(process.hrtime.bigint() - t) / 1e6;
  console.log(`restored in ${decodeMs.toFixed(0)} ms; ${back.hashes().total === sim.hashes().total ? 'same total hash' : 'DIFFERENT'}`);
}
