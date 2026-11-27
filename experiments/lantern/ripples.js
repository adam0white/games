// Lantern's water in the 3D views: a height field that the wake, every pickup, the rain and every blow set rippling.
// From the lab page lantern-ripples (2026-11-24), improved; see NOTES.md, "3D ripples". No DOM and no WebGL here:
// this file is the wave rules, the CPU solver (the fallback when a browser cannot draw into half-float textures) and the
// list of what disturbs the water. view3d.js runs the same rules on the GPU; bots.mjs checks them with this solver.
// It reads the game's state and never writes to it.
//
// The solver is the damped two-buffer wave equation: next = h + KEEP (h - before) + C2 (sum of 4 neighbours - 4 h).
// Banks and rocks are walls the water cannot cross (zero flux: a solid neighbour counts as the cell itself), so a ring comes
// back off them the right way up. The grid is fixed to the river, not to the boat: as the boat moves on, whole rows leave
// behind and still rows come in ahead, so the waves are never smeared. The first and last rows soak waves up (a sponge),
// so the grid's own ends do not throw back rings that nothing on screen made.
import { centre, half, rain, DT } from './sim.js?v=17';

export const X0 = -0.02, SPAN = 1.04; // the grid across: river x from X0, SPAN wide (the river never leaves 0 to 1)
export const BACK = 0.45, AHEAD = 2.3; // the grid along: from BACK behind the boat to AHEAD in front (the 3D camera sees 0.34 behind)
export const SPEED = 0.98; // how fast a ring spreads, river units a second: a little faster than the boat at the start of a night
export const TAU = 1.5; // seconds for a long wave's height to fall to 1/e from this alone (visc in LEVELS takes the short ones faster)
export const SPONGE = 14; // rows at each end of the grid that soak waves up
export const MAX_ROCKS = 48, MAX_DROPS = 64, CLAMP = 4;
// Quality levels: 2 is the full grid, 1 half as fine (same wave speed), 0 is no ripples (the 3D view as before).
// visc: damping of a wave's speed by its neighbours' (Kelvin-Voigt), which kills grid-sized ripples the eye reads as a checker
// and hardly touches a ring; level 1 has fewer, larger cells, so less of it.
export const LEVELS = [null, { nx: 64, steps: 2, visc: 0.012 }, { nx: 128, steps: 3, visc: 0.02 }];

// The grid at a level: cells across and along, the cell's size, solver steps per game tick and the two constants.
export function grid(level) {
  const { nx, steps } = LEVELS[level], cell = SPAN / nx, ny = Math.ceil((BACK + AHEAD) / cell);
  const courant = SPEED / (cell * steps / DT); // must stay under 0.707 for the solver to be stable
  return { nx, ny, cell, steps, visc: LEVELS[level].visc, c2: courant * courant, keep: Math.exp(-2 * DT / steps / TAU) };
}
// A sponge row's factor: 1 in open water, a little under 1 in the last SPONGE rows at either end.
export function sponge(j, ny) { const d = Math.min(j, ny - 1 - j); return d >= SPONGE ? 1 : 1 - 0.1 * ((SPONGE - d) / SPONGE) ** 2; }
// Which grid row is first for a boat at river y: rows are counted from river y = 0, so a row is the same water from frame to frame.
export const firstRow = (sy, cell) => Math.floor((sy - BACK) / cell);

// The CPU solver. step() takes the boat's river y, river(y) -> [centre, half], rocks [{ x, y, rad, len }] and drops [{ x, y, r, a }],
// and runs `ticks` game ticks of water. mutate (checks only): 'leaky-rocks' lets water through rocks, 'no-sponge' keeps the ends hard, 'no-visc' lets grid-sized ripples ring on.
export function createField(level, { mutate = '' } = {}) {
  const g = grid(level), { nx, ny, cell } = g, n = nx * ny;
  let now = new Float32Array(n), before = new Float32Array(n), next = new Float32Array(n);
  const solid = new Uint8Array(n);
  let row0 = null;
  const field = { ...g, level, get row0() { return row0; }, get h() { return now; }, solid, reset, step, energy, at };
  function reset() { now.fill(0); before.fill(0); row0 = null; }
  function shift(by) {
    if (by >= ny || by < 0) { now.fill(0); before.fill(0); return; }
    if (!by) return;
    for (const a of [now, before]) { a.copyWithin(0, by * nx); a.fill(0, (ny - by) * nx); }
  }
  function walls(river, rocks) {
    for (let j = 0; j < ny; j++) {
      const [c, h] = river((row0 + j + 0.5) * cell);
      for (let i = 0; i < nx; i++) solid[j * nx + i] = Math.abs(X0 + (i + 0.5) * cell - c) > h ? 1 : 0;
    }
    if (mutate === 'leaky-rocks') return;
    for (const k of rocks) {
      const x = (k.x - X0) / cell, y = k.y / cell - row0, r = k.rad / cell, len = k.len / cell;
      for (let j = Math.max(0, Math.floor(y - r)); j <= Math.min(ny - 1, Math.ceil(y + r)); j++)
        for (let i = Math.max(0, Math.floor(x - r - len)); i <= Math.min(nx - 1, Math.ceil(x + r + len)); i++)
          if (Math.hypot(Math.max(0, Math.abs(i + 0.5 - x) - len), j + 0.5 - y) < r) solid[j * nx + i] = 1;
    }
  }
  function splash(drops) {
    for (const d of drops) {
      const x = (d.x - X0) / cell, y = d.y / cell - row0, r = Math.max(1.5, d.r / cell);
      for (let j = Math.max(0, Math.floor(y - r)); j <= Math.min(ny - 1, Math.ceil(y + r)); j++)
        for (let i = Math.max(0, Math.floor(x - r)); i <= Math.min(nx - 1, Math.ceil(x + r)); i++) {
          const q = Math.hypot(i + 0.5 - x, j + 0.5 - y); if (q >= r) continue;
          const k = j * nx + i, b = d.a * 0.5 * (1 + Math.cos(Math.PI * q / r)); now[k] += b; before[k] += b; // a bump let go from rest
        }
    }
  }
  function once() {
    const { c2, keep } = g, visc = mutate === 'no-visc' ? 0 : g.visc;
    for (let j = 0; j < ny; j++) {
      const sp = mutate === 'no-sponge' ? 1 : sponge(j, ny);
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        if (solid[k]) { next[k] = 0; continue; }
        const h = now[k];
        const b = before[k], L = i > 0 && !solid[k - 1], R = i < nx - 1 && !solid[k + 1], D = j > 0 && !solid[k - nx], U = j < ny - 1 && !solid[k + nx];
        const l = L ? now[k - 1] : h, r = R ? now[k + 1] : h, d = D ? now[k - nx] : (j > 0 ? h : 0), u = U ? now[k + nx] : (j < ny - 1 ? h : 0);
        const bl = L ? before[k - 1] : b, br = R ? before[k + 1] : b, bd = D ? before[k - nx] : (j > 0 ? b : 0), bu = U ? before[k + nx] : (j < ny - 1 ? b : 0);
        const lap = l + r + d + u - 4 * h, lapB = bl + br + bd + bu - 4 * b;
        const v = (h + keep * (h - b) + c2 * lap + visc * (lap - lapB)) * sp; // visc: the shortest waves (a grid-sized checker) die fast, long ones hardly at all
        next[k] = v > CLAMP ? CLAMP : v < -CLAMP ? -CLAMP : v;
      }
    }
    const t = before; before = now; now = next; next = t;
    if (mutate !== 'no-sponge') for (let j = 0; j < ny; j++) { const sp = sponge(j, ny); if (sp < 1) for (let i = 0; i < nx; i++) before[j * nx + i] *= sp; } // the old height too, or the sponge would make waves of its own
  }
  // ticks game ticks: the drops go in at the first, then each tick is g.steps solver steps.
  function step(sy, river, rocks, drops, ticks = 1) {
    const first = firstRow(sy, cell);
    if (row0 === null) { row0 = first; now.fill(0); before.fill(0); } else { shift(first - row0); row0 = first; }
    walls(river, rocks); splash(drops);
    for (let t = 0; t < ticks * g.steps; t++) once();
  }
  function energy() { let e = 0; for (let k = 0; k < n; k++) e += now[k] * now[k]; return e; }
  // The height at river (x, y), nearest cell, 0 off the grid.
  function at(x, y) { const i = Math.floor((x - X0) / cell), j = Math.floor(y / cell) - row0; return i < 0 || j < 0 || i >= nx || j >= ny ? 0 : now[j * nx + i]; }
  return field;
}

// What disturbs the water this frame, read from the game's state. mem keeps what was seen last frame (start with {}).
// ticks: game ticks since the last frame. Returns drops [{ x, y, r, a }]: a bump of radius r river units and height a
// (below 0 a hollow). It never writes to s or to anything in it.
export function disturb(s, mem, ticks, now) {
  const out = [];
  if (mem.s !== s) { // a new run, or the first frame: what is taken already made its rings before we looked
    mem.s = s; mem.seen = new WeakSet(); mem.x = s.x; mem.y = s.y; mem.hearts = s.hearts; mem.shield = s.shield; mem.over = s.over; mem.rng = 0x9e3779b9;
    for (const e of [...s.embers, ...(s.powers || [])]) if (e.got) mem.seen.add(e);
    return out;
  }
  const rand = () => { mem.rng = (Math.imul(mem.rng, 1664525) + 1013904223) >>> 0; return mem.rng / 4294967296; };
  if (ticks > 0 && !s.over) { // the wake: the hull presses the water down along the way it went since the last frame, harder in a turn
    const dx = s.x - mem.x, dy = s.y - mem.y, len = Math.hypot(dx, dy), turn = Math.min(1, Math.abs(dx) / (0.012 * ticks));
    const pieces = Math.max(1, Math.min(8, Math.ceil(len / 0.012))), a = -(0.035 + 0.1 * turn) * Math.min(4, ticks) / pieces;
    if (len < 0.5) for (let i = 1; i <= pieces; i++) out.push({ x: mem.x + dx * i / pieces, y: mem.y + dy * i / pieces - 0.01, r: 0.024, a });
  }
  mem.x = s.x; mem.y = s.y;
  for (const e of s.embers) if (e.got && !mem.seen.has(e)) {
    mem.seen.add(e);
    out.push(e.kind === 'wisp' ? { x: e.x, y: e.y, r: 0.04, a: -0.55 } : { x: e.x, y: e.y, r: 0.04, a: e.kind === 'ember' ? 0.6 : 0.8 });
  }
  for (const e of s.powers || []) if (e.got && !mem.seen.has(e)) { mem.seen.add(e); out.push({ x: e.x, y: e.y, r: 0.05, a: 0.9 }); }
  if (s.hearts < mem.hearts && !s.over) out.push({ x: s.x, y: s.y + 0.02, r: 0.07, a: 2 }); // a heart took the blow
  if (s.shield < mem.shield) out.push({ x: s.x, y: s.y + 0.02, r: 0.06, a: 1.6 }); // the shield took it
  if (s.over && !mem.over && s.over !== 'dawn' && s.over !== 'dark') out.push({ x: s.x, y: s.y, r: 0.09, a: 2.6 }); // the crash
  if (ticks > 0 && s.events.includes('graze')) out.push({ x: s.x, y: s.y, r: 0.03, a: 0.45 });
  mem.hearts = s.hearts; mem.shield = s.shield; mem.over = s.over;
  if (ticks > 0 && rain(s, s.y)) for (let i = 0; i < ticks * 1.6; i++) { // rain: small rings anywhere on the river in view, more than the eye can count
    if (rand() > 0.62 && i >= ticks) continue;
    const y = s.y - 0.3 + rand() * (AHEAD + 0.2), c = centre(s, y), h = half(s, y);
    out.push({ x: c + (rand() * 2 - 1) * (h - 0.01), y, r: 0.012 + 0.01 * rand(), a: 0.06 + 0.07 * rand() });
  }
  if (ticks > 0) for (let i = 0; i < s.rocks.length; i++) { // things in the water that move it themselves
    const k = s.rocks[i], dy = k.y - s.y; if (dy < -BACK || dy > AHEAD) continue;
    if (k.kind === 'pool') out.push({ x: k.x, y: k.y, r: 0.05, a: -0.05 * (1 + Math.sin(now * 6 + i)) * ticks });
    else if (k.kind === 'geyser') { if (k.on) out.push({ x: k.x, y: k.y, r: k.rad * 1.3, a: 0.2 * Math.sin(now * 22 + i) * ticks }); }
    else if (!(k.kind === 'hidden' && dy > 0.45)) out.push({ x: k.x, y: k.y + k.rad + 0.014, r: 0.018, a: 0.035 * Math.sin(now * 7 + i * 1.7) * Math.min(2, ticks) }); // the current breaks on the upstream side
  }
  return out;
}

// The solid things in the water for the solver, in river units: rocks, ice, logs, islands; not a whirlpool, a geyser or a rock still hidden.
export function solids(s) {
  const out = [];
  for (const k of s.rocks) {
    const dy = k.y - s.y; if (dy < -BACK - 0.1 || dy > AHEAD + 0.1) continue;
    if (k.kind === 'pool' || k.kind === 'geyser' || (k.kind === 'hidden' && dy > 0.45)) continue;
    if (out.length < MAX_ROCKS) out.push({ x: k.x, y: k.y, rad: k.rad, len: k.len || 0 });
  }
  return out;
}
export const riverOf = s => y => [centre(s, y), half(s, y)];
