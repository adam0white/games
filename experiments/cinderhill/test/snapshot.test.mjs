// Snapshot format 2 (range-coded): exact restore at random ticks, any state round-trips (not only states
// that play produces), old versions and damaged payloads are refused, and the S4 size pass line holds.
import assert from 'node:assert/strict';
import test from 'node:test';
import { G, SUBSYSTEMS, Sim } from '../sim/sim.js';
import { FIELDS } from '../sim/scent.js';
import { MAX_GOALS } from '../sim/flow.js';
import { next, seedStreams } from '../sim/rng.js';
import { firstDivergence, replay, script } from '../sim/replay.js';
import { SNAPSHOT_VERSION, restore, snapshot } from '../sim/snapshot.js';
import { s4World } from '../spikes/s4.mjs';

const cfg = { seed: 23, sw: 96, sh: 96, nw: 64, nh: 48, ants: 300 };
const FOLLOW = 2000;
const pick = seedStreams(77), rand = n => next(pick, 0) % n;
const subsystems = h => Object.fromEntries(SUBSYSTEMS.map(k => [k, h[k]]));

test('restore at random ticks: same hash in every subsystem, same bytes, and the same next 2,000 ticks', () => {
  const at = [rand(400) + 1, 600 + rand(1400), 2000 + rand(2000)];
  const end = at[2] + FOLLOW, commands = script(cfg, end);
  const ref = replay({ cfg, commands, ticks: end, every: 1 }).records;
  for (const t of at) {
    const sim = replay({ cfg, commands, ticks: t, every: t }).sim;
    const before = subsystems(sim.hashes()), bytes = snapshot(sim), back = restore(bytes);
    assert.deepEqual(subsystems(sim.hashes()), before, `tick ${t}: writing a snapshot leaves the sim as it was`);
    assert.deepEqual(subsystems(back.hashes()), before, `tick ${t}: every subsystem hashes the same`);
    assert.deepEqual(snapshot(back), bytes, `tick ${t}: the restored sim writes the same bytes`);
    // The restored sim already holds the queued commands.
    const rest = replay({ cfg, commands: [], ticks: t + FOLLOW, every: 1, sim: back }).records;
    assert.equal(rest.length, FOLLOW);
    assert.equal(firstDivergence(ref.slice(t, t + FOLLOW), rest), null, `tick ${t}: the next ${FOLLOW} ticks match`);
  }
});

test('any state round-trips: values no play produces still restore exactly', () => {
  const sim = replay({ cfg, commands: script(cfg, 700), ticks: 700, every: 700 }).sim;
  const n = sim.L.n, A = sim.n, int32 = () => (next(pick, 1) | 0);
  const some = (k, f) => { for (let j = 0; j < k; j++) f(); };
  // Terrain: bytes outside the material range, dig marks and work anywhere, links to anywhere.
  some(20, () => { sim.mat[rand(n)] = [7, 8, 200, 255][rand(4)]; });
  some(20, () => { sim.dig[rand(n)] = rand(256); sim.digWork[rand(n)] = rand(256); sim.link[rand(n)] = int32(); });
  some(4, () => { sim.pileCell[rand(sim.pileCell.length)] = int32(); sim.pileAmount[rand(sim.pileAmount.length)] = int32(); });
  // Scent on closed cells, negative and out-of-range values.
  for (let f = 0; f < FIELDS; f++) some(30, () => { sim.scent.cur[f][rand(n)] = [int32(), -1, 0x7FFFFFFF, -0x80000000][rand(4)]; });
  // Globals, random streams, goals (including live slots with odd kinds and cells).
  some(8, () => { sim.g[rand(G.SIZE)] = int32(); });
  sim.rng[0] = 0xFFFFFFFF; sim.rng[1] = 0;
  some(6, () => { const s = rand(MAX_GOALS); sim.flow.kind[s] = rand(256); sim.flow.live[s] = rand(3); sim.flow.dirty[s] = rand(2); sim.flow.cell[s] = int32(); sim.flow.seq[s] = int32() >>> 0; });
  // Ants: positions off the map or in closed cells, odd layers and jobs, any lastCell, best, stall, since.
  some(200, () => {
    const i = rand(A);
    sim.x[i] = rand(65536); sim.y[i] = rand(65536); sim.layer[i] = rand(256); sim.job[i] = rand(256); sim.mode[i] = rand(256);
    sim.heading[i] = rand(256); sim.carry[i] = rand(256); sim.mem[i] = rand(256) - 128; sim.goal[i] = rand(256) - 128;
    sim.best[i] = rand(65536); sim.stall[i] = rand(65536); sim.since[i] = rand(65536); sim.lastCell[i] = int32();
  });
  sim.queue.push(Int32Array.from([int32(), int32(), 0x7FFFFFFF, -0x80000000]), new Int32Array(0));
  sim.events.push(int32(), -1, 0x7FFFFFFF);
  const want = sim.hashes(), bytes = snapshot(sim);
  assert.deepEqual(sim.hashes(), want, 'writing a snapshot leaves the sim as it was');
  const back = restore(bytes), got = back.hashes();
  // Flow distances are rebuilt from the (now inconsistent) terrain, so only the flow hash may differ;
  // the flow state that is written must match exactly.
  for (const k of SUBSYSTEMS.filter(k => k !== 'flow')) assert.equal(got[k], want[k], k);
  for (const k of ['kind', 'live', 'dirty', 'cell', 'seq']) assert.deepEqual(back.flow[k], sim.flow[k], `flow.${k}`);
  assert.deepEqual(snapshot(back), bytes, 'and writes the same bytes');
});

test('old versions and damaged snapshots are refused', () => {
  const bytes = snapshot(new Sim({ ...cfg, ants: 20 }));
  assert.equal(bytes[4] | (bytes[5] << 8), SNAPSHOT_VERSION);
  const v1 = bytes.slice(); v1[4] = 1; v1[5] = 0;
  assert.throws(() => restore(v1), /snapshot 1\/2, this sim reads 2\/2/, 'version 1 (raw arrays) is refused by number');
  const sim2 = bytes.slice(); sim2[6] ^= 0xFF;
  assert.throws(() => restore(sim2), /this sim reads/);
  assert.throws(() => restore(bytes.subarray(0, bytes.length - 3)), /truncated/);
  assert.throws(() => restore(Uint8Array.from([...bytes, 0])), /trailing/);
  const magic = bytes.slice(); magic[0] = 0;
  assert.throws(() => restore(magic), /not a Cinderhill snapshot/);
});

test('S4 pass line: a dug nest with 5,000 ants after 8,000 ticks is under 64 KB gzip-compressed', async () => {
  // 8,000 ticks is where format 1 failed (74.6 KB); spikes/s4.mjs also measures 3,000 and 24,000 (SPIKES.md).
  const sim = s4World(5000, 8000), bytes = snapshot(sim);
  const gz = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  assert.ok(bytes.length < 64 * 1024, `coded ${bytes.length} bytes`);
  assert.ok(gz.length < 64 * 1024, `gzip ${gz.length} bytes`);
  assert.equal(restore(bytes).hashes().total, sim.hashes().total);
});
