// Snapshot and restore at a tick boundary, to and from bytes.
//
// Layout: "CHSM", u16 snapshot version, u16 sim version, then u32 header values, then sections, each a u32
// byte length and that many bytes. Multi-byte arrays are written byte-shuffled (all first bytes, then all
// second bytes, ...): the bytes are the same, only reordered, and the high bytes of small numbers, mostly
// zero, then sit together where a compressor finds them. Little-endian throughout.
//
// Not written: the flow distances (rebuilt on restore; flow.js explains why that is exact), the spatial
// hash and other scratch buffers, and counters marked "not state".

import { MAX_GOALS, rebuild } from './flow.js';
import { FIELDS } from './scent.js';
import { SIM_VERSION, Sim } from './sim.js';

export const SNAPSHOT_VERSION = 1;
const MAGIC = [0x43, 0x48, 0x53, 0x4D]; // "CHSM"

function shuffle(ta) {
  const k = ta.BYTES_PER_ELEMENT, src = new Uint8Array(ta.buffer, ta.byteOffset, ta.byteLength);
  if (k === 1) return src.slice();
  const n = ta.length, out = new Uint8Array(src.length);
  for (let i = 0; i < n; i++) for (let j = 0; j < k; j++) out[j * n + i] = src[i * k + j];
  return out;
}

function unshuffle(bytes, into) {
  const k = into.BYTES_PER_ELEMENT, dst = new Uint8Array(into.buffer, into.byteOffset, into.byteLength), n = into.length;
  if (bytes.length !== dst.length) throw new Error('snapshot section has the wrong length');
  if (k === 1) { dst.set(bytes); return; }
  for (let i = 0; i < n; i++) for (let j = 0; j < k; j++) dst[i * k + j] = bytes[j * n + i];
}

/** Every state array, in a fixed order. `sim.n` sets the ant arrays' used length. */
function stateArrays(sim) {
  const n = sim.n, F = sim.flow, a = ta => ta.subarray(0, n);
  return [
    sim.g, sim.rng, sim.mat, sim.dig, sim.digWork, sim.link, sim.pileCell, sim.pileAmount,
    F.kind, F.live, F.dirty, F.cell, F.seq,
    ...sim.scent.cur,
    a(sim.x), a(sim.y), a(sim.layer), a(sim.heading), a(sim.job), a(sim.mode), a(sim.carry), a(sim.mem), a(sim.goal),
    a(sim.best), a(sim.stall), a(sim.since), a(sim.lastCell),
  ];
}

/** Sections as named byte arrays (the spikes report sizes per section). */
export function snapshotSections(sim) {
  const c = sim.cfg, h = sim.home;
  const header = Uint32Array.from([c.seed >>> 0, c.sw, c.sh, c.nw, c.nh, c.maxAnts, sim.n, h.x, h.y, h.w, h.h, ...c.spread, ...c.halfLife]);
  const names = ['globals', 'rng', 'mat', 'dig', 'digWork', 'link', 'pileCell', 'pileAmount', 'goalKind', 'goalLive', 'goalDirty', 'goalCell', 'goalSeq',
    ...Array.from({ length: FIELDS }, (_, f) => `scent${f}`), 'antX', 'antY', 'antLayer', 'antHeading', 'antJob', 'antMode', 'antCarry', 'antMem', 'antGoal', 'antBest', 'antStall', 'antSince', 'antLastCell'];
  const out = [['header', new Uint8Array(header.buffer)]];
  stateArrays(sim).forEach((ta, k) => out.push([names[k], shuffle(ta)]));
  const cmds = [sim.queue.length];
  for (const e of sim.queue) cmds.push(e.length, ...e);
  out.push(['commands', new Uint8Array(Int32Array.from(cmds).buffer)]);
  out.push(['events', new Uint8Array(Int32Array.from(sim.events).buffer)]);
  return out;
}

export function snapshot(sim) {
  const sections = snapshotSections(sim);
  let size = 8;
  for (const [, b] of sections) size += 4 + b.length;
  const out = new Uint8Array(size), dv = new DataView(out.buffer);
  out.set(MAGIC, 0);
  dv.setUint16(4, SNAPSHOT_VERSION, true);
  dv.setUint16(6, SIM_VERSION, true);
  let at = 8;
  for (const [, b] of sections) { dv.setUint32(at, b.length, true); out.set(b, at + 4); at += 4 + b.length; }
  return out;
}

export function restore(bytes) {
  if (MAGIC.some((m, i) => bytes[i] !== m)) throw new Error('not a Cinderhill snapshot');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = dv.getUint16(4, true), simVersion = dv.getUint16(6, true);
  if (version !== SNAPSHOT_VERSION || simVersion !== SIM_VERSION) throw new Error(`snapshot ${version}/${simVersion}, this sim reads ${SNAPSHOT_VERSION}/${SIM_VERSION}`);
  let at = 8;
  const section = () => { const len = dv.getUint32(at, true), b = bytes.subarray(at + 4, at + 4 + len); at += 4 + len; return b; };
  const hb = section(), header = new Uint32Array(hb.slice().buffer);
  const [seed, sw, sh, nw, nh, maxAnts, n, hx, hy, hw, hh] = header;
  const spread = Array.from(header.subarray(11, 11 + FIELDS)), halfLife = Array.from(header.subarray(11 + FIELDS, 11 + 2 * FIELDS));
  const sim = new Sim({ seed, sw, sh, nw, nh, maxAnts, ants: 0, spread, halfLife, restoring: true });
  sim.n = n;
  sim.home = { x: hx, y: hy, w: hw, h: hh };
  for (const ta of stateArrays(sim)) unshuffle(section(), ta);
  const cmds = new Int32Array(section().slice().buffer);
  sim.queue = [];
  for (let k = 1, count = 0; count < cmds[0]; count++) { const len = cmds[k]; sim.queue.push(cmds.slice(k + 1, k + 1 + len)); k += 1 + len; }
  sim.events = Array.from(new Int32Array(section().slice().buffer));
  for (let s = 0; s < MAX_GOALS; s++) if (sim.flow.live[s]) rebuild(sim, s);
  return sim;
}
