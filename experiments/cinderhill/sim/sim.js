// Cinderhill's deterministic simulation core. Pure: no clock, no DOM, no floating-point Math, no locale.
// The same file runs in the page, in a Durable Object, in Node bots and in tests.
//
// One tick (20 a second, fixed):
//   1. apply the commands queued for this tick, in (tick, seat, id) order
//   2. rebuild dirty flow fields (so new goals are usable this tick)
//   3. world: food piles and a held alarm lay scent
//   4. ants, in index order (separation reads a spatial hash built at the start of this step)
//   5. scent spreads and decays
//   6. rebuild dirty flow fields again, so no field is stale at the tick boundary
// The state at a tick boundary is everything hashed by hashes() and written by snapshot().

import { ANGLES, COS, SIN, angleOf, turnTo } from './math.js';
import { HARDNESS, MAT, NEST, SUB, SURFACE, baseOf, cellAt, cellXY, heightOf, makeLayout, widthOf } from './grid.js';
import { STREAM, STREAMS, below, seedStreams } from './rng.js';
import { G, GOAL, INF, MAX_GOALS, SLOT, distAt, dropGoal, makeFlow, nextCell, rebuild, rebuildDirty, setGoal, terrainChanged } from './flow.js';
import { FIELD, FIELDS, deposit, makeScent, smell, stepScent } from './scent.js';
import { SUBSYSTEMS, finish, hashArray, hashInt } from './hash.js';
import { generate } from './world.js';

export const SIM_VERSION = 1;
export const TICK_HZ = 20;
export { G, GOAL, SLOT, INF, FIELD, MAT, SURFACE, NEST, SUB, SUBSYSTEMS };

export const JOB = { FORAGE: 0, DIG: 1, GUARD: 2 };
export const MODE = { SEEK: 0, RETURN: 1, WORK: 2, REST: 3 };
export const CMD = { TRAIL: 1, DIG: 2, ALARM: 3, RECALL: 4 };
export const EVENT = { DUG: 1, PILE_EMPTY: 2, REJECTED: 3, LATE: 4 };
export const MAX_PILES = 8;
const EVENT_CAP = 1024; // events kept until the host drains them; older ones are dropped (counted in globals)

export const DEFAULTS = {
  seed: 1, sw: 256, sh: 256, nw: 192, nh: 128, ants: 500, maxAnts: 5000,
  // Per scent field (trail, food, alarm): spread D/256 per neighbour per tick, and half-life in ticks.
  // Trail: a third of a ten-minute day (02-spec section 10).
  spread: [6, 40, 48], halfLife: [4000, 60, 200],
  blank: false, // true: an empty map for tests (surface open, nest all clay); no world generation
};

const WALK = 24, RUN = 36; // sub-cell units per tick: about 1.9 and 2.8 cells a second
const TURN = 32; // most a heading turns in one tick when steering toward a target
const SEP_R = 160; // separation radius in sub-cell units
const SENSE_AT = 2 * SUB, SENSE_SIDE = 28, SENSE_MIN = 2000;
const TRAIL_LAY = 60000, TRAIL_STROKE = 400000, FOOD_EMIT = 200000, ALARM_EMIT = 600000, ALARM_FADE = 5000;
const FAR = 150; // a seeking forager this many steps from home goes back
const STALL_KICK = 50;
const SEEK_GIVE_UP = 1200; // a forager that finds nothing in a minute goes home // ticks without progress before an ant turns at random

export class Sim {
  constructor(options = {}) {
    const cfg = { ...DEFAULTS, ...options };
    this.cfg = cfg;
    const L = (this.L = makeLayout(cfg)), n = L.n, A = cfg.maxAnts;
    this.mat = new Uint8Array(n);
    this.dig = new Uint8Array(n); // 1: marked for digging
    this.digWork = new Uint8Array(n); // digging done so far on a marked cell
    this.link = new Int32Array(n).fill(-1);
    this.pileCell = new Int32Array(MAX_PILES).fill(-1);
    this.pileAmount = new Int32Array(MAX_PILES);
    this.home = { x: 0, y: 0, w: 1, h: 1 };
    this.g = new Int32Array(G.SIZE);
    this.rng = seedStreams(cfg.seed);
    this.flow = makeFlow(n);
    this.scent = makeScent(n, cfg);
    // Ants, structure of arrays. Positions are in 1/256 cell on the ant's layer.
    this.n = 0;
    this.x = new Uint16Array(A); this.y = new Uint16Array(A);
    this.layer = new Uint8Array(A); this.heading = new Uint8Array(A);
    this.job = new Uint8Array(A); this.mode = new Uint8Array(A); this.carry = new Uint8Array(A);
    this.mem = new Int8Array(A); // food slot this ant last took from, or -1
    this.goal = new Int8Array(A); // slot followed last tick, or -1
    this.best = new Uint16Array(A); // closest distance to that goal so far
    this.stall = new Uint16Array(A); // ticks without progress
    this.since = new Uint16Array(A); // ticks in the current mode (saturates)
    this.lastCell = new Int32Array(A);
    // Spatial hash (rebuilt every tick from positions; not state).
    this.head = new Int32Array(n); this.nextAnt = new Int32Array(A);
    this.queue = []; // pending commands, each an Int32Array [tick, seat, id, type, ...payload], sorted
    this.events = []; // [type, a, b] triples not yet drained
    this.maxStall = 0; // a counter for tests and bots; not state
    if (options.restoring) return;
    if (!cfg.blank) generate(this);
    else { this.mat.fill(MAT.OPEN, 0, L.nestBase); this.mat.fill(MAT.CLAY, L.nestBase); }
    this.startGoals();
    for (let i = 0; i < cfg.ants; i++) this.spawn(i % 20 < 12 ? JOB.FORAGE : i % 20 < 17 ? JOB.DIG : JOB.GUARD);
    rebuildDirty(this);
  }

  startGoals() {
    setGoal(this, SLOT.HOME, GOAL.HOME);
    setGoal(this, SLOT.EXIT, GOAL.EXIT);
    for (let p = 0; p < MAX_PILES; p++) if (this.pileAmount[p] > 0) setGoal(this, SLOT.FOOD0 + p, GOAL.FOOD, this.pileCell[p]);
  }

  /** A new ant in the home chamber. Returns its index or -1 at the cap. */
  spawn(job) {
    if (this.n >= this.cfg.maxAnts) return -1;
    const i = this.n++, h = this.home, r = this.rng, A = STREAM.ants;
    this.layer[i] = NEST;
    this.x[i] = (h.x + below(r, A, h.w)) * SUB + 128;
    this.y[i] = (h.y + below(r, A, h.h)) * SUB + 128;
    this.heading[i] = below(r, A, ANGLES);
    this.job[i] = job; this.mode[i] = MODE.SEEK; this.carry[i] = 0; this.mem[i] = -1; this.goal[i] = -1;
    this.best[i] = INF; this.stall[i] = 0; this.since[i] = 0; this.lastCell[i] = this.cellOfAnt(i);
    return i;
  }

  cellOfAnt(i) {
    return cellAt(this.L, this.layer[i], this.x[i] >> 8, this.y[i] >> 8);
  }

  // ---- commands ----

  /** Queue a command: { tick, seat, id, type, ...payload } or an encoded Int32Array. */
  queueCommand(cmd) {
    const e = cmd instanceof Int32Array ? cmd : encodeCommand(cmd);
    if (e[0] < this.g[G.TICK]) { this.event(EVENT.LATE, e[1], e[2]); this.g[G.LATE]++; return false; }
    const before = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
    let at = this.queue.length;
    while (at > 0 && before(this.queue[at - 1], e) > 0) at--;
    this.queue.splice(at, 0, e);
    return true;
  }

  applyCommand(e) {
    const L = this.L, type = e[3];
    if (type === CMD.TRAIL) {
      // [layer, count, x0, y0, x1, y1, ...]: a stroke on the surface. Scent along it; a goal at its end.
      const count = Math.min(e[5], 64);
      if (e[4] !== SURFACE || count < 1) return this.event(EVENT.REJECTED, e[1], e[2]);
      let end = -1;
      for (let k = 0; k < count; k++) {
        const x0 = e[6 + 2 * k], y0 = e[7 + 2 * k];
        const x1 = k + 1 < count ? e[8 + 2 * k] : x0, y1 = k + 1 < count ? e[9 + 2 * k] : y0;
        line(x0, y0, x1, y1, (x, y) => {
          const c = cellAt(L, SURFACE, x, y);
          if (c < 0 || this.mat[c] !== MAT.OPEN) return;
          end = c;
          deposit(this, FIELD.TRAIL, c, TRAIL_STROKE);
        });
      }
      if (end < 0) return this.event(EVENT.REJECTED, e[1], e[2]);
      // Replace the oldest trail goal (lowest creation number) when all four are live.
      let slot = -1;
      for (let s = SLOT.TRAIL0; s < SLOT.TRAIL0 + SLOT.TRAILS; s++) if (!this.flow.live[s]) { slot = s; break; }
      if (slot < 0) {
        slot = SLOT.TRAIL0;
        for (let s = SLOT.TRAIL0 + 1; s < SLOT.TRAIL0 + SLOT.TRAILS; s++) if (this.flow.seq[s] < this.flow.seq[slot]) slot = s;
      }
      setGoal(this, slot, GOAL.TRAIL, end);
    } else if (type === CMD.DIG) {
      // [count, x0, y0, ...]: nest cells to dig.
      const count = Math.min(e[4], 256);
      let marked = 0;
      for (let k = 0; k < count; k++) {
        const c = cellAt(L, NEST, e[5 + 2 * k], e[6 + 2 * k]);
        if (c < 0 || this.dig[c] || HARDNESS[this.mat[c]] === 0) continue;
        this.dig[c] = 1; this.g[G.DIG_COUNT]++; marked++;
      }
      if (!marked) return this.event(EVENT.REJECTED, e[1], e[2]);
      if (!this.flow.live[SLOT.DIG]) setGoal(this, SLOT.DIG, GOAL.DIG); else this.flow.dirty[SLOT.DIG] = 1;
    } else if (type === CMD.ALARM) {
      // [layer, x, y, hold ticks]
      const c = cellAt(L, e[4] === NEST ? NEST : SURFACE, e[5], e[6]);
      if (c < 0 || this.mat[c] !== MAT.OPEN) return this.event(EVENT.REJECTED, e[1], e[2]);
      setGoal(this, SLOT.ALARM, GOAL.ALARM, c);
      this.g[G.ALARM_HOLD] = Math.max(1, Math.min(e[7], 400));
    } else if (type === CMD.RECALL) {
      this.g[G.RECALL] = e[4] ? 1 : 0;
    } else this.event(EVENT.REJECTED, e[1], e[2]);
  }

  event(type, a, b) {
    if (this.events.length >= EVENT_CAP * 3) { this.events.splice(0, 3); }
    this.events.push(type | 0, a | 0, b | 0);
  }

  drainEvents() { const e = this.events; this.events = []; return e; }

  // ---- the tick ----

  step() {
    const g = this.g;
    while (this.queue.length && this.queue[0][0] === g[G.TICK]) this.applyCommand(this.queue.shift());
    this.rebuildFields();
    this.stepWorld();
    this.buildBuckets();
    for (let i = 0; i < this.n; i++) this.stepAnt(i);
    stepScent(this);
    this.rebuildFields();
    g[G.TICK]++;
  }

  /** Rebuild dirty fields. An ant following a rebuilt field forgets its closest distance, because the
   *  distances it remembered belong to the old field. (Restore rebuilds fields without this: the
   *  restored field equals the old one, so nothing is forgotten.) */
  rebuildFields() {
    const F = this.flow;
    for (let s = 0; s < MAX_GOALS; s++) {
      if (!F.live[s] || !F.dirty[s]) continue;
      rebuild(this, s);
      for (let i = 0; i < this.n; i++) if (this.goal[i] === s) this.best[i] = INF;
    }
  }

  stepWorld() {
    for (let p = 0; p < MAX_PILES; p++) if (this.pileAmount[p] > 0) deposit(this, FIELD.FOOD, this.pileCell[p], FOOD_EMIT);
    const a = this.flow.cell[SLOT.ALARM];
    if (this.flow.live[SLOT.ALARM]) {
      if (this.g[G.ALARM_HOLD] > 0) { deposit(this, FIELD.ALARM, a, ALARM_EMIT); this.g[G.ALARM_HOLD]--; }
      else if (this.scent.cur[FIELD.ALARM][a] < ALARM_FADE) dropGoal(this, SLOT.ALARM);
    }
  }

  buildBuckets() {
    this.head.fill(-1);
    // Insert from the last ant down, so each bucket lists ants in ascending index order.
    for (let i = this.n - 1; i >= 0; i--) {
      const c = this.cellOfAnt(i);
      this.nextAnt[i] = this.head[c]; this.head[c] = i;
    }
  }

  setMode(i, mode) { this.mode[i] = mode; this.since[i] = 0; }

  stepAnt(i) {
    if (this.since[i] < 0xFFFF) this.since[i]++;
    const L = this.L, c = this.cellOfAnt(i), layer = this.layer[i], r = this.rng, A = STREAM.ants;
    let follow = -1, want = -1, speed = WALK, still = false, wander = false;
    const atHome = distAt(this, SLOT.HOME, c) === 0;

    if (this.g[G.RECALL] && layer === SURFACE) { follow = SLOT.HOME; speed = RUN; }
    else if (this.job[i] === JOB.FORAGE) {
      if (this.mode[i] === MODE.RETURN) {
        if (atHome) {
          if (this.carry[i]) { this.g[G.STORES]++; this.carry[i] = 0; }
          this.setMode(i, MODE.SEEK); this.heading[i] = (this.heading[i] + 128) & 255;
          still = true;
        } else {
          follow = SLOT.HOME;
          if (this.carry[i] && layer === SURFACE) deposit(this, FIELD.TRAIL, c, TRAIL_LAY);
        }
      } else if (layer === NEST) follow = SLOT.EXIT;
      else {
        const p = this.pileAt(c);
        if (p >= 0) {
          this.carry[i] = 1; this.mem[i] = SLOT.FOOD0 + p; this.setMode(i, MODE.RETURN);
          this.heading[i] = (this.heading[i] + 128) & 255; this.g[G.PICKED]++;
          if (--this.pileAmount[p] === 0) { dropGoal(this, SLOT.FOOD0 + p); this.event(EVENT.PILE_EMPTY, p, 0); }
          still = true;
        } else if (this.since[i] > SEEK_GIVE_UP || distAt(this, SLOT.HOME, c) > FAR) {
          this.setMode(i, MODE.RETURN); follow = SLOT.HOME; // nothing found: home, then out again
        } else {
          // Seeking, in order: the pile this ant took from last (route memory), the newest trail to its end,
          // then the three scent sensors (food smell and trail scent), then a random walk.
          const m = this.mem[i], t = this.newestTrail();
          if (m >= 0 && !this.flow.live[m]) this.mem[i] = -1;
          if (this.mem[i] >= 0 && distAt(this, m, c) !== INF) follow = m;
          else if (t >= 0 && distAt(this, t, c) > 1 && distAt(this, t, c) !== INF && this.since[i] < SEEK_GIVE_UP >> 1) follow = t;
          else { want = this.sense(i); if (want < 0) wander = true; }
        }
      }
    } else if (this.job[i] === JOB.DIG) {
      // A dig crew: at most 4 diggers per marked cell, and 24 in all, so a dig front does not jam the
      // tunnel to it. The rest wait at rest (in a game, the crew count shows why). Index order decides who
      // joins and who leaves, the same on every machine.
      const cap = Math.min(24, 4 * this.g[G.DIG_COUNT]);
      let d = this.g[G.DIG_COUNT] > 0 ? distAt(this, SLOT.DIG, c) : INF;
      if (this.mode[i] === MODE.WORK && (d === INF || this.g[G.DIG_CREW] > cap)) { this.setMode(i, MODE.REST); this.g[G.DIG_CREW]--; }
      else if (this.mode[i] !== MODE.WORK && d !== INF && this.g[G.DIG_CREW] < cap) { this.setMode(i, MODE.WORK); this.g[G.DIG_CREW]++; }
      if (this.mode[i] !== MODE.WORK) d = INF;
      if (d === 0) { this.digAt(c); still = true; }
      else if (d !== INF) follow = SLOT.DIG;
      else if (layer === SURFACE) follow = SLOT.HOME;
      else still = true;
    } else { // guard
      const d = this.flow.live[SLOT.ALARM] ? distAt(this, SLOT.ALARM, c) : INF;
      if (d !== INF && d > 2) { follow = SLOT.ALARM; speed = RUN; }
      else if (d !== INF) still = true; // at the call: hold the spot
      else if (layer === SURFACE) follow = SLOT.HOME;
      else still = true;
    }

    // A goal this ant cannot reach (walled off, or on a layer with no way through) is dropped for this
    // tick, the same way on every machine: the ant wanders instead of standing still.
    if (follow >= 0 && distAt(this, follow, c) === INF) { follow = -1; wander = true; still = false; }
    if (follow >= 0) {
      if (this.goal[i] !== follow) { this.goal[i] = follow; this.best[i] = INF; }
      const d = distAt(this, follow, c);
      if (d < this.best[i]) { this.best[i] = d; this.stall[i] = 0; }
      const n1 = nextCell(this, follow, c);
      if (n1 < 0) { still = true; }
      else if (this.link[c] === n1) { this.moveTo(i, n1); return; }
      else {
        // Aim two steps ahead when both are on this layer: ants then cut staircase corners on diagonals.
        const n2 = nextCell(this, follow, n1), aim = n2 >= 0 && this.link[n1] !== n2 ? n2 : n1;
        const [, ax, ay] = cellXY(L, aim);
        want = angleOf(ax * SUB + 128 - this.x[i], ay * SUB + 128 - this.y[i]);
      }
    } else {
      this.goal[i] = -1; this.best[i] = INF;
      if (still) this.stall[i] = 0;
      else if (c !== this.lastCell[i]) this.stall[i] = 0;
    }
    if (still) { this.stall[i] = 0; this.lastCell[i] = c; return; }

    let h = this.heading[i];
    if (want >= 0) {
      const t = turnTo(h, want);
      h = (h + (t > TURN ? TURN : t < -TURN ? -TURN : t) + below(r, A, 5) - 2) & 255;
    } else if (wander) h = (h + below(r, A, 17) - 8) & 255;
    if (++this.stall[i] > STALL_KICK) h = (h + 64 + below(r, A, 128)) & 255; // stuck: try another way
    if (this.stall[i] > this.maxStall) this.maxStall = this.stall[i];
    this.heading[i] = h;

    // Separation from ants within SEP_R in this and the neighbouring cells, capped at half the speed per
    // axis so it can bend a path but never cancel the step forward (a crowded 1-wide tunnel still flows).
    let px = 0, py = 0, seen = 0;
    const cx = this.x[i] >> 8, cy = this.y[i] >> 8;
    for (let oy = -1; oy <= 1 && seen < 12; oy++) for (let ox = -1; ox <= 1 && seen < 12; ox++) {
      const cc = cellAt(L, layer, cx + ox, cy + oy);
      if (cc < 0) continue;
      for (let j = this.head[cc]; j >= 0 && seen < 12; j = this.nextAnt[j]) {
        if (j === i) continue;
        seen++;
        const dx = this.x[i] - this.x[j], dy = this.y[i] - this.y[j];
        const adx = dx < 0 ? -dx : dx, ady = dy < 0 ? -dy : dy;
        if (adx >= SEP_R || ady >= SEP_R) continue;
        if (dx === 0 && dy === 0) { px += j < i ? 8 : -8; continue; } // same spot: split by index
        if (adx >= ady) px += dx > 0 ? SEP_R - adx : adx - SEP_R; else py += dy > 0 ? SEP_R - ady : ady - SEP_R;
      }
    }
    const cap = speed >> 1;
    px = (px * 3) >> 3; py = (py * 3) >> 3;
    px = px > cap ? cap : px < -cap ? -cap : px;
    py = py > cap ? cap : py < -cap ? -cap : py;
    const dx = ((COS[h] * speed) >> 12) + px, dy = ((SIN[h] * speed) >> 12) + py;
    if (!this.tryMove(i, dx, dy) && !this.tryMove(i, dx, 0) && !this.tryMove(i, 0, dy)) {
      this.heading[i] = (h + 32 + below(r, A, 192)) & 255;
    }
    this.lastCell[i] = c;
  }

  tryMove(i, dx, dy) {
    if (dx === 0 && dy === 0) return false;
    const layer = this.layer[i], w = widthOf(this.L, layer) * SUB, h = heightOf(this.L, layer) * SUB;
    const nx = this.x[i] + dx, ny = this.y[i] + dy;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) return false;
    const c = baseOf(this.L, layer) + (ny >> 8) * widthOf(this.L, layer) + (nx >> 8);
    if (this.mat[c] !== MAT.OPEN) return false;
    this.x[i] = nx; this.y[i] = ny;
    return true;
  }

  /** Through an entrance: to the centre of the linked cell. */
  moveTo(i, cell) {
    const [layer, x, y] = cellXY(this.L, cell);
    this.layer[i] = layer; this.x[i] = x * SUB + 128; this.y[i] = y * SUB + 128;
    this.stall[i] = 0; this.lastCell[i] = cell;
  }

  /** Three sensors ahead (left, centre, right) on trail plus food scent. A heading, or -1 when nothing is there. */
  sense(i) {
    const h = this.heading[i], layer = this.layer[i];
    const at = a => {
      const c = cellAt(this.L, layer, (this.x[i] + ((COS[a] * SENSE_AT) >> 12)) >> 8, (this.y[i] + ((SIN[a] * SENSE_AT) >> 12)) >> 8);
      const t = smell(this, FIELD.TRAIL, c);
      return t < 0 ? -1 : t + smell(this, FIELD.FOOD, c);
    };
    const l = at((h - SENSE_SIDE) & 255), m = at(h), rr = at((h + SENSE_SIDE) & 255);
    if (l < SENSE_MIN && m < SENSE_MIN && rr < SENSE_MIN) return -1;
    if (m >= l && m >= rr) return h;
    return l > rr ? (h - SENSE_SIDE) & 255 : (h + SENSE_SIDE) & 255;
  }

  pileAt(c) {
    if (c >= this.L.nestBase) return -1;
    const sw = this.L.sw, x = c % sw, y = Math.floor(c / sw);
    for (let p = 0; p < MAX_PILES; p++) {
      if (this.pileAmount[p] <= 0) continue;
      const q = this.pileCell[p], dx = (q % sw) - x, dy = Math.floor(q / sw) - y;
      if (dx >= -1 && dx <= 1 && dy >= -1 && dy <= 1) return p;
    }
    return -1;
  }

  newestTrail() {
    let best = -1;
    for (let s = SLOT.TRAIL0; s < SLOT.TRAIL0 + SLOT.TRAILS; s++) if (this.flow.live[s] && (best < 0 || this.flow.seq[s] > this.flow.seq[best])) best = s;
    return best;
  }

  digAt(c) {
    for (let k = 0; k < 4; k++) {
      const m = this.L.nb[c * 4 + k];
      if (m < 0 || !this.dig[m]) continue;
      if (++this.digWork[m] < HARDNESS[this.mat[m]]) return;
      this.mat[m] = MAT.OPEN; this.dig[m] = 0; this.digWork[m] = 0;
      this.g[G.DIG_COUNT]--; this.g[G.DUG]++;
      this.event(EVENT.DUG, m, 0);
      terrainChanged(this, m);
      this.flow.dirty[SLOT.DIG] = 1;
      if (this.g[G.DIG_COUNT] === 0) dropGoal(this, SLOT.DIG);
      return;
    }
  }

  /** Change a cell's material (tests, tools). Keeps flow fields honest. */
  setCell(c, m) {
    const was = this.mat[c] === MAT.OPEN;
    this.mat[c] = m;
    if (was !== (m === MAT.OPEN)) terrainChanged(this, c);
  }

  // ---- hashing ----

  hashes() {
    const n = this.n, F = this.flow, S = this.scent;
    let h;
    const out = {};
    h = hashInt(0x1A, n);
    for (const a of [this.x, this.y, this.layer, this.heading, this.job, this.mode, this.carry, this.mem, this.goal, this.best, this.stall, this.since, this.lastCell]) h = hashArray(h, a, n);
    out.ants = finish(h);
    h = 0x5C;
    for (let f = 0; f < FIELDS; f++) h = hashArray(h, S.cur[f]);
    out.scent = finish(h);
    h = 0x7E;
    for (const a of [this.mat, this.dig, this.digWork, this.link, this.pileCell, this.pileAmount]) h = hashArray(h, a);
    for (const v of [this.home.x, this.home.y, this.home.w, this.home.h]) h = hashInt(h, v);
    out.terrain = finish(h);
    h = 0xF1;
    for (const a of [F.kind, F.live, F.dirty, F.cell, F.seq]) h = hashArray(h, a);
    for (let s = 0; s < MAX_GOALS; s++) if (F.live[s]) h = hashArray(h, F.dist.subarray(s * this.L.n, (s + 1) * this.L.n));
    out.flow = finish(h);
    out.rng = finish(hashArray(0x22, this.rng));
    h = hashInt(0xE7, this.queue.length);
    for (const e of this.queue) h = hashArray(h, e);
    h = hashArray(h, Int32Array.from(this.events));
    out.events = finish(h);
    out.globals = finish(hashArray(0x61, this.g));
    h = 0;
    for (const k of SUBSYSTEMS) h = hashInt(h, out[k]);
    out.total = finish(h);
    out.tick = this.g[G.TICK];
    return out;
  }

  get tick() { return this.g[G.TICK]; }
}

/** Integer cells along a segment (Bresenham), both ends included. */
export function line(x0, y0, x1, y1, visit) {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, guard = 0;
  for (;;) {
    visit(x0, y0);
    if ((x0 === x1 && y0 === y1) || ++guard > 1024) return;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

/** { tick, seat, id, type, ... } to the Int32Array the queue, hash and snapshot use. */
export function encodeCommand(c) {
  const head = [c.tick, c.seat ?? 0, c.id ?? 0, c.type];
  switch (c.type) {
    case CMD.TRAIL: return Int32Array.from([...head, c.layer ?? SURFACE, c.points.length >> 1, ...c.points]);
    case CMD.DIG: return Int32Array.from([...head, c.cells.length >> 1, ...c.cells]);
    case CMD.ALARM: return Int32Array.from([...head, c.layer ?? SURFACE, c.x, c.y, c.hold ?? 100]);
    case CMD.RECALL: return Int32Array.from([...head, c.on ? 1 : 0]);
    default: return Int32Array.from(head);
  }
}

export { STREAMS };
