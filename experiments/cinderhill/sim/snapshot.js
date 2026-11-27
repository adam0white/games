// Snapshot and restore at a tick boundary, to and from bytes.
//
// Layout: "CHSM", u16 snapshot version, u16 sim version, u32 count of header values, the header values
// (u32 each: config, ant count, home), then the payload: every other state value through the range coder
// in rangecoder.js. Little-endian throughout. Version 1 (byte-shuffled raw arrays for gzip) is refused.
//
// The payload is lossless: restore gives the same state, hash for hash, and re-encodes to the same bytes.
// What makes it small (spikes/s4.mjs and sim/SPIKES.md S4 have the numbers):
// - Scent: closed cells hold 0, so only open cells are coded, plus a list of closed cells that are not 0
//   (normally empty). Each open cell is predicted from its left, upper and upper-left neighbours (a + b - c)
//   and the residual is coded in a context chosen by how much those neighbours differ.
// - Ants: the cell as its rank among the layer's open cells (an adaptive model per layer and job: many
//   ants share a cell), then the offset inside the cell. Job in the context of the spawn order by index.
//   `since` as the difference from the tick. `lastCell` as "same cell", one of the nine neighbours (with diagonals and the link), or a
//   raw value. `best` as the difference from the flow distance at `lastCell` (the value it usually equals).
// - Terrain: material in a context of its left and upper neighbours; dig marks, dig work and entrance
//   links as lists of the cells that differ from the usual value.
// Every prediction is followed by an exact residual or an escape, so any state round-trips, not only
// states that play produces (test/snapshot.test.mjs corrupts arrays to check this).
//
// Not written: the flow distances (rebuilt on restore before the ants are read; flow.js explains why that
// is exact), the spatial hash and other scratch buffers, and counters marked "not state".

import { G, INF, MAX_GOALS, PATH_MAX, SLOT, rebuild } from './flow.js';
import { BROOD_MAX, CASTE_HP } from './colony.js';
import { FIELDS, SCENT_MAX } from './scent.js';
import { MAT, SUB } from './grid.js';
import { SIM_VERSION, Sim } from './sim.js';
import { Decoder, Encoder, intModel, probs, sint, tree, uint } from './rangecoder.js';

export const SNAPSHOT_VERSION = 9; // 9: crew levels, the workforce and the starving count (globals); 8: the nursery rectangle in the header; 3: lastCell codes the diagonal neighbours; 4: the colony (pile kinds, caste, hit points, team, brood; colony flag in the header); 5: days (the day length in the header, more globals); 6: the spider's globals; 7: crew sizes (globals)
const SCTX = 24; // scent contexts per field
const LIST_MAX = 1 << 20; // a longer command queue, command or event list is a corrupt payload, not an allocation
const RANK_BITS = 12; // measured: 6, 8, 10, 12, 14 bits; 12 is near the best (ants share cells, so a fine model pays)
const MAGIC = [0x43, 0x48, 0x53, 0x4D]; // "CHSM"

/** Every live goal's distances, rebuilt into a fresh array from terrain, links, dig marks and goals. */
function rebuiltDistances(sim) {
  const F = sim.flow, n = sim.L.n;
  const flow = { kind: F.kind, live: F.live, dirty: F.dirty.slice(), cell: F.cell, seq: F.seq, pathLen: F.pathLen, path: F.path, dist: new Uint16Array(MAX_GOALS * n).fill(INF), queue: new Int32Array(n), buckets: F.buckets, btail: F.btail, pending: 0, rebuilds: 0 };
  const view = { L: sim.L, mat: sim.mat, link: sim.link, dig: sim.dig, home: sim.home, flow };
  for (let s = 0; s < MAX_GOALS; s++) if (F.live[s]) rebuild(view, s);
  return flow.dist;
}

/** The state values not in the header, in a fixed order, through `io` (an Encoder or a Decoder). */
function walk(sim, io, mark = () => {}) {
  const L = sim.L, n = L.n, F = sim.flow, mat = sim.mat;
  const M = intModel(19); // small values: globals, goals, piles, lists, commands, trail paths
  const put = (ta, i, ctx) => { ta[i] = sint(io, M, ctx, ta[i]); };
  const putAll = (ta, ctx) => { for (let i = 0; i < ta.length; i++) put(ta, i, ctx); };

  // Cells whose value differs from `expected(c)`: a count, then gaps and values.
  const exceptions = (ta, expected, ctx) => {
    let count = 0;
    if (!io.decoding) for (let c = 0; c < ta.length; c++) if (ta[c] !== expected(c)) count++;
    count = uint(io, M, ctx, count);
    if (io.decoding) for (let c = 0; c < ta.length; c++) ta[c] = expected(c);
    for (let k = 0, c = -1; k < count; k++) {
      let next = c + 1;
      if (!io.decoding) while (ta[next] === expected(next)) next++;
      c += 1 + uint(io, M, ctx + 1, next - c - 1);
      if (c >= ta.length) throw new Error('snapshot payload is corrupt');
      ta[c] = sint(io, M, ctx + 2, ta[c] - expected(c)) + expected(c);
    }
  };

  // ---- terrain ----
  const matP = probs(64 * 8);
  for (const [base, w, h] of [[0, L.sw, L.sh], [L.nestBase, L.nw, L.nh]]) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = base + y * w + x, left = x ? Math.min(mat[c - 1], 7) : 7, up = y ? Math.min(mat[c - w], 7) : 7;
      // Materials are 0..6; a byte above 7 is coded as 7 here and carried by the exception list below.
      const got = tree(io, matP, (left * 8 + up) * 8, 3, mat[c] < 8 ? mat[c] : 7);
      if (io.decoding) mat[c] = got;
    }
  }
  const matBig = new Uint8Array(n);
  if (!io.decoding) for (let c = 0; c < n; c++) matBig[c] = mat[c] >= 8 ? mat[c] : 0;
  exceptions(matBig, () => 0, 0);
  if (io.decoding) for (let c = 0; c < n; c++) if (matBig[c]) mat[c] = matBig[c];
  exceptions(sim.dig, () => 0, 0);
  exceptions(sim.digWork, () => 0, 0);
  exceptions(sim.link, () => -1, 3);
  putAll(sim.pileCell, 6);
  putAll(sim.pileAmount, 6);
  putAll(sim.pileKind, 6);

  mark('terrain');

  // ---- globals, random streams, goals ----
  putAll(sim.g, 7);
  for (let s = 0; s < sim.rng.length; s++) sim.rng[s] = io.bits(sim.rng[s], 32);
  putAll(F.kind, 8); putAll(F.live, 8); putAll(F.dirty, 8); putAll(F.cell, 9);
  for (let s = 0; s < MAX_GOALS; s++) F.seq[s] = uint(io, M, 10, F.seq[s]);
  // Trail paths: each cell as the step from the one before (mostly +-1 or +-width).
  putAll(F.pathLen, 16);
  for (let k = 0; k < SLOT.TRAILS; k++) {
    const at = k * PATH_MAX, len = Math.min(F.pathLen[k], PATH_MAX);
    for (let j = 0; j < len; j++) {
      // The prediction is kept to a cell index, so the residual of any int32 fits the coder's 32 bits.
      const p = j ? F.path[at + j - 1] : 0, pred = p >= 0 && p < n ? p : 0;
      F.path[at + j] = sint(io, M, j ? 18 : 17, F.path[at + j] - pred) + pred;
    }
  }
  // Distances rebuilt from the terrain and goals just coded, the same on both sides whatever the sim's own
  // distances hold. The decoder installs them (as before: the sim's fields equal a rebuild at a tick
  // boundary); both sides predict the ants' `best` from them. Dirty marks are kept as coded.
  const dist = rebuiltDistances(sim);
  if (io.decoding) F.dist.set(dist);

  mark('globals');

  // ---- scent ----
  const SM = intModel(FIELDS * SCTX);
  for (let f = 0; f < FIELDS; f++) {
    const v = sim.scent.cur[f];
    const closed = new Int32Array(n);
    if (!io.decoding) for (let c = 0; c < n; c++) if (mat[c] !== MAT.OPEN) closed[c] = v[c];
    exceptions(closed, () => 0, 11);
    if (io.decoding) v.set(closed);
    for (const [base, w, h] of [[0, L.sw, L.sh], [L.nestBase, L.nw, L.nh]]) {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const c = base + y * w + x;
        if (mat[c] !== MAT.OPEN) continue;
        const a = x ? v[c - 1] : 0, b = y ? v[c - w] : 0, d = x && y ? v[c - w - 1] : 0;
        const ad = a > d ? a - d : d - a, bd = b > d ? b - d : d - b, act = ad + bd;
        const p = a + b - d, pred = p < 0 ? 0 : p > SCENT_MAX ? SCENT_MAX : p; // clamped, so a residual fits 32 bits
        // Context: how much the neighbours differ, as a bit length. All neighbours zero is its own context.
        // (Adding the value's magnitude as a second context axis measured no better.)
        const ctx = (a | b | d) === 0 ? 0 : 1 + Math.min(SCTX - 2, 32 - Math.clz32(act));
        v[c] = sint(io, SM, f * SCTX + ctx, v[c] - pred) + pred;
      }
    }
  }

  mark('scent');

  // ---- ants ----
  const AM = intModel(64), whereP = probs(1), rankP = probs(2 * 4 * (1 << RANK_BITS)), headP = probs(4 * 256), offP = probs(2 * 256), lastP = probs(4 * 16);
  const rank = new Int32Array(n).fill(-1), byRank = [[], []];
  for (const [layer, base, end] of [[0, 0, L.nestBase], [1, L.nestBase, n]]) {
    for (let c = base; c < end; c++) if (mat[c] === MAT.OPEN) { rank[c] = byRank[layer].length; byRank[layer].push(c); }
  }
  for (let i = 0; i < sim.n; i++) {
    // The constructor spawns jobs by index (12 of 20 forage, 5 dig, 3 guard): that job is the context.
    sim.job[i] = uint(io, AM, 40 + (i % 20 < 12 ? 0 : i % 20 < 17 ? 1 : 2), sim.job[i]);
    const job = sim.job[i] & 3;
    sim.mode[i] = uint(io, AM, 5 + job, sim.mode[i]);
    const mode = sim.mode[i] & 3;
    sim.layer[i] = uint(io, AM, 0 + job, sim.layer[i]);
    const layer = sim.layer[i];
    // Where: an open cell by rank plus the offset inside it, or (escape) raw coordinates.
    const here = io.decoding ? -1 : sim.cellOfAnt(i);
    const byCell = io.bit(whereP, 0, here >= 0 && rank[here] >= 0 && layer < 2 ? 0 : 1) === 0;
    if (byCell) {
      // The rank's top bits through an adaptive tree per layer and job (ants crowd in a few places, and
      // each job in its own), the rest plain.
      const count = byRank[layer].length, low = Math.max(0, 32 - Math.clz32(count - 1) - RANK_BITS), rv = io.decoding ? 0 : rank[here];
      const r = tree(io, rankP, (layer * 4 + job) << RANK_BITS, RANK_BITS, rv >>> low) * (1 << low) + (low ? io.bits(rv, low) : 0);
      if (r >= byRank[layer].length) throw new Error('snapshot payload is corrupt');
      const c = byRank[layer][r], base = layer ? L.nestBase : 0, w = layer ? L.nw : L.sw;
      const cx = (c - base) % w, cy = (c - base - cx) / w;
      sim.x[i] = cx * SUB + tree(io, offP, 0, 8, sim.x[i] & 255);
      sim.y[i] = cy * SUB + tree(io, offP, 256, 8, sim.y[i] & 255);
    } else {
      sim.x[i] = io.bits(sim.x[i], 16);
      sim.y[i] = io.bits(sim.y[i], 16);
    }
    sim.heading[i] = tree(io, headP, job * 256, 8, sim.heading[i]);
    sim.carry[i] = uint(io, AM, 9 + job, sim.carry[i]);
    sim.mem[i] = sint(io, AM, 13 + job, sim.mem[i]);
    sim.goal[i] = sint(io, AM, 17 + mode, sim.goal[i]);
    sim.via[i] = sint(io, AM, 48 + mode, sim.via[i]);
    // lastCell: 0 the ant's cell, 1..4 a neighbour (up, right, down, left), 5..8 a diagonal (up-right,
    // down-right, down-left, up-left), 9 the linked cell, 10 raw.
    const c = sim.cellOfAnt(i), lc = sim.lastCell[i];
    let code = 10;
    if (!io.decoding && c >= 0) {
      if (lc === c) code = 0;
      else if (lc >= 0) {
        for (let k = 0; k < 4 && code === 10; k++) if (lc === L.nb[c * 4 + k]) code = 1 + k; else if (lc === L.dg[c * 4 + k]) code = 5 + k;
        if (code === 10 && lc === sim.link[c]) code = 9;
      }
    }
    code = tree(io, lastP, mode * 16, 4, code);
    if (code > 10 || (code < 10 && c < 0)) throw new Error('snapshot payload is corrupt');
    const near = code === 0 ? c : code < 5 ? L.nb[c * 4 + code - 1] : code < 9 ? L.dg[c * 4 + code - 5] : code === 9 ? sim.link[c] : 0;
    if (code < 10 && code > 0 && near < 0) throw new Error('snapshot payload is corrupt');
    sim.lastCell[i] = code < 10 ? near : sint(io, AM, 21, lc);
    // best: the difference from the rebuilt distance at lastCell on the followed field (INF for no field).
    const g = sim.goal[i], l = sim.lastCell[i];
    const pred = g >= 0 && g < MAX_GOALS && l >= 0 && l < n ? dist[g * n + l] : INF;
    sim.best[i] = sint(io, AM, 22 + (g >= 0 ? 1 : 0), sim.best[i] - pred) + pred;
    sim.stall[i] = uint(io, AM, 44 + mode, sim.stall[i]);
    // since counts ticks in the current mode and saturates; an ant that never changed mode has since equal
    // to the tick, so code the difference from the tick (capped the same way).
    const top = Math.min(sim.g[G.TICK] >>> 0, 0xFFFF);
    sim.since[i] = top - sint(io, AM, 24 + job * 4 + mode, top - sim.since[i]);
    // Caste, hit points as the difference from the caste's full hit points, team, bite cooldown.
    sim.caste[i] = uint(io, AM, 52, sim.caste[i]);
    const full = CASTE_HP[sim.caste[i] & 1];
    sim.hp[i] = full - sint(io, AM, 53, full - sim.hp[i]);
    sim.team[i] = uint(io, AM, 54, sim.team[i]);
    sim.cool[i] = uint(io, AM, 63, sim.cool[i]);
  }

  // ---- brood ----
  const B = sim.brood;
  B.n = uint(io, AM, 55, B.n);
  if (B.n > BROOD_MAX) throw new Error('snapshot payload is corrupt');
  for (let k = 0; k < B.n; k++) {
    B.stage[k] = uint(io, AM, 56, B.stage[k]);
    B.age[k] = uint(io, AM, 57 + Math.min(B.stage[k], 2), B.age[k]);
    B.fed[k] = uint(io, AM, 60, B.fed[k]);
    B.hunger[k] = uint(io, AM, 61, B.hunger[k]);
    // From the cell before (brood lies together); the prediction is kept to a cell index so any int32 residual fits.
    const q = k ? B.cell[k - 1] : 0, p = q >= 0 && q < n ? q : 0;
    B.cell[k] = sint(io, AM, 62, B.cell[k] - p) + p;
  }

  mark('ants');

  // ---- queued commands and undrained events ----
  const qn = uint(io, M, 12, sim.queue.length);
  if (qn > LIST_MAX) throw new Error('snapshot payload is corrupt');
  if (io.decoding) sim.queue = [];
  for (let k = 0; k < qn; k++) {
    const e = io.decoding ? null : sim.queue[k];
    const len = uint(io, M, 13, e ? e.length : 0);
    if (len > LIST_MAX) throw new Error('snapshot payload is corrupt');
    const out = io.decoding ? new Int32Array(len) : e;
    for (let j = 0; j < len; j++) out[j] = sint(io, M, 14, out[j]);
    if (io.decoding) sim.queue.push(out);
  }
  const en = uint(io, M, 12, sim.events.length);
  if (en > LIST_MAX) throw new Error('snapshot payload is corrupt');
  if (io.decoding) sim.events = new Array(en).fill(0);
  for (let k = 0; k < en; k++) sim.events[k] = sint(io, M, 15, sim.events[k]);
  mark('commands');
}

function headerValues(sim) {
  const c = sim.cfg, h = sim.home, r = sim.nursery ?? { x: 0, y: 0, w: 0, h: 0 }; // w 0: no nursery (the sandbox)
  return [c.seed >>> 0, c.sw, c.sh, c.nw, c.nh, c.maxAnts, sim.n, h.x, h.y, h.w, h.h, ...c.spread, ...c.halfLife, c.colony ? 1 : 0, c.dayTicks, r.x, r.y, r.w, r.h];
}

/** Coded bytes per part, in walk order (the spike reports them): [[name, bytes], ...]. */
export function snapshotParts(sim) {
  const enc = new Encoder(), out = [];
  let last = 0;
  walk(sim, enc, name => { const at = enc.at + enc.cacheSize; out.push([name, at - last]); last = at; });
  return out;
}

export function snapshot(sim) {
  const header = Uint32Array.from(headerValues(sim));
  const enc = new Encoder();
  walk(sim, enc);
  const payload = enc.finish();
  const out = new Uint8Array(12 + header.byteLength + payload.length), dv = new DataView(out.buffer);
  out.set(MAGIC, 0);
  dv.setUint16(4, SNAPSHOT_VERSION, true);
  dv.setUint16(6, SIM_VERSION, true);
  dv.setUint32(8, header.length, true);
  for (let k = 0; k < header.length; k++) dv.setUint32(12 + 4 * k, header[k], true);
  out.set(payload, 12 + header.byteLength);
  return out;
}

export function restore(bytes) {
  if (bytes.length < 12 || MAGIC.some((m, i) => bytes[i] !== m)) throw new Error('not a Cinderhill snapshot');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = dv.getUint16(4, true), simVersion = dv.getUint16(6, true);
  // Version 1 (raw shuffled arrays) and any other version are refused by number, never guessed at.
  if (version !== SNAPSHOT_VERSION || simVersion !== SIM_VERSION) throw new Error(`snapshot ${version}/${simVersion}, this sim reads ${SNAPSHOT_VERSION}/${SIM_VERSION}`);
  const count = dv.getUint32(8, true);
  if (count !== 17 + 2 * FIELDS || bytes.length < 12 + 4 * count) throw new Error('snapshot header is corrupt');
  const header = [];
  for (let k = 0; k < count; k++) header.push(dv.getUint32(12 + 4 * k, true));
  const [seed, sw, sh, nw, nh, maxAnts, n, hx, hy, hw, hh] = header;
  const spread = header.slice(11, 11 + FIELDS), halfLife = header.slice(11 + FIELDS, 11 + 2 * FIELDS), colony = header[11 + 2 * FIELDS], dayTicks = header[12 + 2 * FIELDS];
  if (n > maxAnts) throw new Error('snapshot header is corrupt');
  const sim = new Sim({ seed, sw, sh, nw, nh, maxAnts, ants: 0, spread, halfLife, colony, dayTicks, restoring: true });
  sim.n = n;
  sim.home = { x: hx | 0, y: hy | 0, w: hw, h: hh }; // a chamber can start left of the nest's edge: signed
  const [rx, ry, rw, rh] = header.slice(13 + 2 * FIELDS);
  sim.nursery = rw ? { x: rx | 0, y: ry | 0, w: rw, h: rh } : null;
  const dec = new Decoder(bytes.subarray(12 + 4 * count));
  walk(sim, dec);
  dec.finish();
  for (let i = 0; i < n && !sim.anyDead; i++) if (sim.hp[i] === 0) sim.anyDead = true; // hurt between ticks
  return sim;
}
