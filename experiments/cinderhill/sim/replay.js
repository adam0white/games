// Scripted commands, replays and the divergence check. Pure, so the spikes run the same file in Node,
// browsers and workerd, and every engine is fed the same JSON command log.

import { CMD, NEST, SURFACE, Sim, encodeCommand, G } from './sim.js';
import { SUBSYSTEMS } from './hash.js';

/** A seeded script of player orders over `ticks`: rooms to dig, trails to each food pile, alarms on the
 *  surface and in the nest, and recalls. Built from a fresh sim's world (so the targets make sense), with
 *  its own random numbers so it never touches the sim's streams. Returns plain objects (JSON-safe). */
export function script(cfg, ticks) {
  const sim = new Sim({ ...cfg, ants: 0 });
  const L = sim.L, h = sim.home, ex = L.sw >> 1, ey = L.sh >> 1;
  let s = (cfg.seed ^ 0x5EED) >>> 0;
  const rand = n => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), s | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return (((t ^ (t >>> 14)) >>> 16) * n) >>> 16; };
  const out = [];
  let id = 0;
  const add = c => out.push({ seat: id & 1, id: ++id, ...c });
  const room = (x0, y0, w, hh) => { const cells = []; for (let y = y0; y < y0 + hh; y++) for (let x = x0; x < x0 + w; x++) if (x >= 0 && y >= 0 && x < L.nw && y < L.nh) cells.push(x, y); return cells; };
  const pile = p => { const c = sim.pileCell[p]; return c < 0 ? null : [c % L.sw, Math.floor(c / L.sw)]; };
  const trailTo = (tick, p) => {
    const at = pile(p);
    if (!at) return;
    const mx = (ex + at[0]) >> 1, my = ((ey + at[1]) >> 1) + rand(9) - 4;
    add({ tick, type: CMD.TRAIL, layer: SURFACE, points: [ex + 1, ey + 1, mx, my, at[0], at[1]] });
  };
  add({ tick: 10, type: CMD.DIG, cells: room(h.x + h.w, h.y, 12, 4) });
  trailTo(40, 0);
  for (let t = 1200, k = 0; t < ticks; t += 1200, k++) {
    // A room or a tunnel next to what is dug, alternating sides and going deeper.
    const side = k & 1 ? -1 : 1, depth = Math.min(L.nh - 8, h.y + 6 + 5 * (k >> 1));
    add({ tick: t, type: CMD.DIG, cells: k % 3 === 2 ? room((L.nw >> 1) + side * 2, h.y + h.h, 2, depth - h.y) : room(side > 0 ? h.x + h.w : h.x - 12, depth, 12, 4) });
  }
  for (let t = 2000, p = 1; t < ticks; t += 2000, p++) trailTo(t, p % 4);
  for (let t = 1500; t < ticks; t += 700 + rand(300)) {
    const x = ex + rand(80) - 40, y = ey + rand(80) - 40;
    add({ tick: t, type: CMD.TRAIL, layer: SURFACE, points: [ex, ey, x, y] });
  }
  for (let t = 300; t < ticks; t += 4000) {
    const at = pile(1) ?? [ex + 20, ey];
    add({ tick: t, type: CMD.ALARM, layer: SURFACE, x: at[0], y: at[1], hold: 200 });
    add({ tick: t + 2400, type: CMD.ALARM, layer: NEST, x: h.x + 2, y: h.y + 2, hold: 100 });
  }
  for (let t = 2500; t < ticks; t += 4000) { add({ tick: t, type: CMD.RECALL, on: true }); add({ tick: t + 400, type: CMD.RECALL, on: false }); }
  // Crews (SIM_VERSION 7): sizes on the newest trail, up and down.
  for (let t = 900, k = 0; t < ticks; t += 1700, k++) add({ tick: t, type: CMD.CREW, seq: 0, delta: k % 3 === 2 ? -6 : 5 });
  // Stable order: (tick, seat, id). The comparator makes the order the same on every engine.
  out.sort((a, b) => a.tick - b.tick || a.seat - b.seat || a.id - b.id);
  return out.filter(c => c.tick < ticks);
}

/** Run `ticks` ticks of cfg with the commands, recording hashes every `every` ticks (and at the end).
 *  `onTick(sim)` runs after each tick (spikes time it); `at(sim)` too (tests flip bytes there). */
export function replay({ cfg, commands, ticks, every = 20, onTick, at, sim: given }) {
  const sim = given ?? new Sim(cfg);
  for (const c of commands) if (c.tick >= sim.tick) sim.queueCommand(encodeCommand(c));
  const records = [];
  while (sim.g[G.TICK] < ticks) {
    sim.step();
    if (onTick) onTick(sim);
    if (at) at(sim);
    if (sim.g[G.TICK] % every === 0 || sim.g[G.TICK] === ticks) records.push(sim.hashes());
  }
  return { sim, records };
}

/** The first record where two runs differ: { tick, subsystems, first }, or null when they agree.
 *  `first` names the first differing subsystem in SUBSYSTEMS order. */
export function firstDivergence(a, b) {
  const n = Math.min(a.length, b.length);
  for (let k = 0; k < n; k++) {
    if (a[k].tick !== b[k].tick) return { tick: a[k].tick, subsystems: ['tick'], first: 'tick' };
    const diff = SUBSYSTEMS.filter(s => a[k][s] !== b[k][s]);
    if (diff.length) return { tick: a[k].tick, subsystems: diff, first: diff[0] };
  }
  if (a.length !== b.length) return { tick: a[n]?.tick ?? b[n]?.tick, subsystems: ['length'], first: 'length' };
  return null;
}
