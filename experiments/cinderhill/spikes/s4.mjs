// Spike S4: compressed size of a late-join snapshot: a dug nest, 5,000 ants, live scent, after play.
// Pass line: under 64 KB. Usage: node s4.mjs [--ants=5000] [--ticks=3000]
import { G, MAT, NEST, Sim } from '../sim/sim.js';
import { cellAt } from '../sim/grid.js';
import { script, replay } from '../sim/replay.js';
import { snapshot, snapshotSections, restore } from '../sim/snapshot.js';

const args = process.argv.slice(2), opt = (k, d) => Number(args.find(a => a.startsWith(`--${k}=`))?.split('=')[1] ?? d);
const ANTS = opt('ants', 5000), TICKS = opt('ticks', 3000);

const squeeze = async (bytes, format) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream(format))).arrayBuffer());
const kb = n => `${(n / 1024).toFixed(1)} KB`;

const sim = new Sim({ seed: 2026, ants: ANTS });
// A late-game nest: galleries at four depths across the width, shafts between them, and rooms off them.
const L = sim.L, open = (x, y) => { const c = cellAt(L, NEST, x, y); if (c >= 0 && sim.mat[c] !== MAT.STONE) sim.setCell(c, MAT.OPEN); };
for (const y of [30, 52, 76, 100]) for (let x = 20; x < L.nw - 20; x++) { open(x, y); open(x, y + 1); }
for (const x of [40, 70, 96, 97, 122, 150]) for (let y = 24; y < 102; y++) open(x, y);
for (const [x0, y0] of [[24, 33], [60, 33], [120, 33], [150, 55], [30, 79], [100, 79], [140, 103], [60, 103]]) for (let y = y0; y < y0 + 6; y++) for (let x = x0; x < x0 + 14; x++) open(x, y);
let dug = 0; for (let c = L.nestBase; c < L.n; c++) dug += sim.mat[c] === MAT.OPEN ? 1 : 0;
replay({ cfg: {}, commands: script({ seed: 2026 }, TICKS), ticks: TICKS, every: TICKS, sim });
const bytes = snapshot(sim);
let surface = 0; for (let i = 0; i < sim.n; i++) surface += sim.layer[i] === 0 ? 1 : 0;
console.log(`${sim.n} ants (${surface} on the surface) after ${TICKS} ticks; nest open cells ${dug} at start, dug ${sim.g[G.DUG]} more in play`);
console.log(`raw snapshot ${kb(bytes.length)}`);
for (const format of ['gzip', 'deflate']) console.log(`${format}: ${kb((await squeeze(bytes, format)).length)}`);
// Without the byte shuffle, for comparison.
const sections = snapshotSections(sim), rows = [];
for (const [name, b] of sections) rows.push({ section: name, raw: b.length, gzip: (await squeeze(b, 'gzip')).length });
const groups = { ants: r => r.section.startsWith('ant'), scent: r => r.section.startsWith('scent'), terrain: r => ['mat', 'dig', 'digWork', 'link', 'pileCell', 'pileAmount'].includes(r.section), other: () => true };
const seen = new Set(), sums = {};
for (const [g, test] of Object.entries(groups)) { const rs = rows.filter(r => !seen.has(r) && test(r)); rs.forEach(r => seen.add(r)); sums[g] = { raw: kb(rs.reduce((a, r) => a + r.raw, 0)), gzipAlone: kb(rs.reduce((a, r) => a + r.gzip, 0)) }; }
console.table(sums);
console.table(rows.filter(r => r.gzip > 600));
// The snapshot restores to the same state.
console.log(`restore check: ${restore(bytes).hashes().total === sim.hashes().total ? 'same total hash' : 'DIFFERENT'}`);
