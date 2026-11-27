// The war sim: several colonies on one hill (docs/design/colony/13-full-game.md, section 7 step 1).
//
// A second sim beside sim/ (sim 11), which bakes one home into every rule. This one keeps everything per colony from
// the start: stores, queen, brood, trails, rally point. Integers only, fixed 20 ticks a second, one order queue for
// every seat (the rival's orders go through it too), so a run replays exactly from its seed and its order log.
//
// The map: a surface (top-down) and one underground layer under all of it (side cutaway). Every colony's nest is in
// that one layer, so tunnels can meet. A door links one surface cell to one nest cell.
//
// An ant walks from cell to cell: on arriving at a cell she picks the next one from her task, usually by walking down
// a distance field (home, door, a trail, the rally point). Fighters steer straight at an enemy they can see.

import { makeLayout, cellAt, diagOpen, MAT, SURFACE, NEST } from '../sim/grid.js';
import { seedStreams, below, STREAM } from '../sim/rng.js';
import { angleOf } from '../sim/math.js';
import { hashArray, hashInt, finish } from '../sim/hash.js';
import { generate } from './world.js';

export const WAR_VERSION = 1;
export const TICK_HZ = 20;
export { MAT, SURFACE, NEST };

export const TEAMS = 2;
export const CASTE = { WORKER: 0, MAJOR: 1 };
export const CASTE_HP = [12, 40], CASTE_BITE = [2, 6], CASTE_SPEED = [45, 34], CASTE_FOOD = [1, 3]; // FOOD: protein to raise, and sugar weight when eating
export const TASK = { REST: 0, OUT: 1, BACK: 2, GUARD: 3, NURSE: 4 };
export const CARRY = { NONE: 0, SUGAR: 1, PROTEIN: 2 };
export const FOOD = { SUGAR: 0, PROTEIN: 1 };
export const STAGE = { EGG: 0, LARVA: 1, PUPA: 2 };
export const KIND = { FORAGE: 0, RAID: 1 };
export const CMD = { TRAIL: 1, ERASE: 2, CREW: 3, DIET: 4, RALLY: 5, RECALL: 6 };
// Events: [type, a, b, c].
export const EVENT = {
  HOME: 1, // team, food kind, trail
  BORN: 2, // team, caste, cell
  DIED: 3, // team, cell, caste
  PILE_EMPTY: 4, // pile
  RESULT: 5, // winner team, reason (REASON)
  REJECTED: 6, // team, order id, why (WHY)
  TRAIL: 7, // team, trail, kind: a trail was laid
  QUEEN_HIT: 8, // team, hit points left
  STOLEN: 9, // from team, by team, food kind
  DRY: 10, // team, trail: nothing left at its end
  RALLY: 11, // team, cell
};
export const REASON = { QUEEN: 1, DUSK: 2, STARVED: 3 };
export const WHY = { FULL: 1, BLOCKED: 2, LONG: 3, NONE: 4 };

export const TRAILS = 6; // per colony
export const PATH_MAX = 1024;
export const MAX_PILES = 48;
export const BROOD_MAX = 256; // all colonies together
export const OFF = 8192; // a trail field's value off the path: OFF + steps to the path
const FAR = 0xFFFF;
export const LEVEL_SHARE = [0, 10, 25, 50]; // percent of the workers: none, Light, Steady, Surge
export const RAID_SHARE = [0, 25, 50, 100]; // percent of the majors on a raid trail

// Per-colony numbers, CG.SIZE each, in sim.cg.
export const CG = {
  SUGAR: 0, PROTEIN: 1, QUEEN_HP: 2, LAY: 3, STARVE: 4, BORN: 5, DIED: 6, KILLS: 7, LOADS_S: 8, LOADS_P: 9, STOLEN: 10, LOST: 11,
  DIET: 12, RECALL: 13, RALLY_CELL: 14, RALLY_HOLD: 15, ADULTS: 16, MAJORS: 17, WORKERS: 18, RESTING: 19, LAID: 20, SEQ: 21, SIZE: 24,
};
export const C = {
  LAY_EVERY: 20, EGG_TICKS: 300, LARVA_TICKS: 500, PUPA_TICKS: 400, LARVA_STARVE: 1200, MAJOR_WAIT: 600,
  EAT_EVERY: 1200, ADULTS_PER_SUGAR: 10, STARVE_AFTER: 1200, STARVE_EVERY: 200, NURSERY: 48,
  QUEEN_HP: 800, BITE_EVERY: 10, BITE_R: 200, SEE: 3, PRESS_OPEN: 5, PRESS_TUNNEL: 2, WAIT_AT_END: 60, GUARD_R: 4,
};

export const DEFAULTS = {
  seed: 1, sw: 160, sh: 112, nw: 160, nh: 64, maxAnts: 4000,
  ants: 30, sugar: 10, protein: 5, eggs: 20, larvae: 20, pupae: 12,
  duskTick: 9600, // the mission ends here (eight minutes); 0: never
  blank: false, // an empty map for tests: no stones, creek or food
};

const est = (dx, dy) => { const ax = dx < 0 ? -dx : dx, ay = dy < 0 ? -dy : dy; return ax > ay ? ax + ((ay * 3) >> 3) : ay + ((ax * 3) >> 3); };

export class Sim {
  constructor(options = {}) {
    const cfg = (this.cfg = { ...DEFAULTS, ...options });
    const L = (this.L = makeLayout(cfg)), n = L.n, A = cfg.maxAnts;
    this.tick = 0;
    this.result = 0; // 0: running; else 1 + the winning team
    this.rng = seedStreams(cfg.seed);
    this.mat = new Uint8Array(n);
    this.link = new Int32Array(n).fill(-1);
    // Per colony, fixed by the map: the door (surface cell), the store and the queen (nest cells), the nursery rectangle.
    this.door = new Int32Array(TEAMS).fill(-1); this.store = new Int32Array(TEAMS).fill(-1); this.queen = new Int32Array(TEAMS).fill(-1);
    this.nursery = []; // per team { x, y, w, h } in nest cells
    this.cg = new Int32Array(TEAMS * CG.SIZE);
    // Food piles.
    this.pileCell = new Int32Array(MAX_PILES).fill(-1); this.pileAmount = new Int32Array(MAX_PILES); this.pileKind = new Uint8Array(MAX_PILES);
    // Ants.
    this.n = 0;
    this.x = new Uint16Array(A); this.y = new Uint16Array(A); this.layer = new Uint8Array(A); this.heading = new Uint8Array(A);
    this.team = new Uint8Array(A); this.caste = new Uint8Array(A); this.hp = new Uint8Array(A); this.task = new Uint8Array(A);
    this.carry = new Uint8Array(A); this.tr = new Int8Array(A).fill(-1); this.cool = new Uint8Array(A); this.press = new Uint8Array(A);
    this.to = new Int32Array(A).fill(-1); this.tx = new Uint16Array(A); this.ty = new Uint16Array(A);
    this.since = new Uint16Array(A); this.inv = new Uint8Array(A); // inv: 1 while she is inside an enemy's nest run
    this.id = new Int32Array(A); this.nextId = 1;
    // Brood, all colonies in one pool.
    this.bn = 0;
    this.bTeam = new Uint8Array(BROOD_MAX); this.bStage = new Uint8Array(BROOD_MAX); this.bAge = new Uint16Array(BROOD_MAX);
    this.bFed = new Uint8Array(BROOD_MAX); this.bHunger = new Uint16Array(BROOD_MAX); this.bCell = new Int32Array(BROOD_MAX); this.bMajor = new Uint8Array(BROOD_MAX);
    // Trails: TEAMS * TRAILS slots.
    const T = TEAMS * TRAILS;
    this.trLive = new Uint8Array(T); this.trKind = new Uint8Array(T); this.trLevel = new Uint8Array(T); this.trDry = new Uint8Array(T);
    this.trLen = new Int32Array(T); this.trSeq = new Int32Array(T); this.trPath = new Int32Array(T * PATH_MAX);
    // Derived (rebuilt from the state above; not hashed): distance fields, counts, the spatial hash.
    this.trF = Array.from({ length: T }, () => null);
    this.homeF = Array.from({ length: TEAMS }, () => new Uint16Array(n)); this.doorF = Array.from({ length: TEAMS }, () => new Uint16Array(n));
    this.queenF = Array.from({ length: TEAMS }, () => new Uint16Array(n)); this.rallyF = Array.from({ length: TEAMS }, () => null);
    this.crew = new Int32Array(T); this.want = new Int32Array(T);
    this.head = new Int32Array(n).fill(-1); this.nextAnt = new Int32Array(A); this.occ = new Uint8Array(n);
    this.bq = new Int32Array(n); this.prev = new Int32Array(n);
    this.queue = []; this.events = []; this.anyDead = false;
    if (options.restoring) return;
    if (cfg.blank) { this.mat.fill(MAT.OPEN, 0, L.nestBase); this.mat.fill(MAT.CLAY, L.nestBase); }
    generate(this);
    for (let t = 0; t < TEAMS; t++) this.startColony(t);
    this.rebuildFields();
  }

  g(t, k) { return this.cg[t * CG.SIZE + k]; }

  startColony(t) {
    const cfg = this.cfg, o = t * CG.SIZE, cg = this.cg;
    cg[o + CG.SUGAR] = cfg.sugar; cg[o + CG.PROTEIN] = cfg.protein; cg[o + CG.QUEEN_HP] = C.QUEEN_HP; cg[o + CG.DIET] = 0; cg[o + CG.RALLY_CELL] = -1;
    for (let k = 0; k < cfg.ants; k++) {
      const i = this.spawn(t, CASTE.WORKER, k % 10 === 9 ? this.nurseryCell(t) : this.store[t]);
      if (i >= 0 && k % 10 === 9) this.task[i] = TASK.NURSE;
    }
    for (let k = 0; k < cfg.pupae; k++) { const b = this.addBrood(t, STAGE.PUPA); if (b >= 0) this.bAge[b] = Math.max(0, C.PUPA_TICKS - 20 * (8 + 3 * k)); }
    for (let k = 0; k < cfg.larvae; k++) { const b = this.addBrood(t, STAGE.LARVA); if (b >= 0) this.bAge[b] = this.bHunger[b] = Math.floor((400 * k) / Math.max(1, cfg.larvae)); }
    for (let k = 0; k < cfg.eggs; k++) { const b = this.addBrood(t, STAGE.EGG); if (b >= 0) this.bAge[b] = Math.floor((200 * k) / Math.max(1, cfg.eggs)); }
  }

  nurseryCell(t) {
    const h = this.nursery[t];
    for (let tries = 0; tries < 8; tries++) {
      const c = cellAt(this.L, NEST, h.x + below(this.rng, STREAM.spare, h.w), h.y + below(this.rng, STREAM.spare, h.h));
      if (c >= 0 && this.mat[c] === MAT.OPEN) return c;
    }
    return this.store[t];
  }

  addBrood(t, stage) {
    if (this.bn >= BROOD_MAX) return -1;
    const k = this.bn++, laid = this.cg[t * CG.SIZE + CG.LAID]++;
    this.bTeam[k] = t; this.bStage[k] = stage; this.bAge[k] = 0; this.bFed[k] = 0; this.bHunger[k] = 0; this.bCell[k] = this.nurseryCell(t);
    this.bMajor[k] = (laid & 3) < this.cg[t * CG.SIZE + CG.DIET] ? 1 : 0; // the diet: this many larvae in four are fed to be majors
    return k;
  }

  spawn(team, caste, cell) {
    if (this.n >= this.cfg.maxAnts || cell < 0) return -1;
    const i = this.n++, L = this.L, nest = cell >= L.nestBase, w = nest ? L.nw : L.sw, k = nest ? cell - L.nestBase : cell;
    this.x[i] = ((k % w) << 8) + 128; this.y[i] = (Math.floor(k / w) << 8) + 128; this.layer[i] = nest ? NEST : SURFACE; this.heading[i] = below(this.rng, STREAM.ants, 256);
    this.team[i] = team; this.caste[i] = caste; this.hp[i] = CASTE_HP[caste]; this.task[i] = caste === CASTE.MAJOR ? TASK.GUARD : TASK.BACK;
    this.carry[i] = 0; this.tr[i] = -1; this.cool[i] = 0; this.press[i] = 0; this.to[i] = -1; this.since[i] = 0; this.inv[i] = 0; this.id[i] = this.nextId++;
    return i;
  }

  cellOf(i) { return cellAt(this.L, this.layer[i], this.x[i] >> 8, this.y[i] >> 8); }

  event(type, a = 0, b = 0, c = 0) { if (this.events.length < 4096) this.events.push(type, a, b, c); }
  drainEvents() { const e = this.events; this.events = []; return e; }

  // ---- Orders ----

  /** Queue an order: { team, type, id?, tick?, ... }. It applies at the start of its tick (the next one by default). */
  order(o) {
    const e = { ...o, tick: Math.max(o.tick ?? this.tick, this.tick) };
    let at = this.queue.length;
    while (at > 0 && this.queue[at - 1].tick > e.tick) at--;
    this.queue.splice(at, 0, e);
    return e;
  }

  apply(o) {
    const t = o.team | 0, cg = this.cg, base = t * CG.SIZE;
    if (t < 0 || t >= TEAMS) return;
    const no = why => this.event(EVENT.REJECTED, t, o.id | 0, why);
    if (o.type === CMD.TRAIL) {
      let k = -1;
      for (let j = 0; j < TRAILS && k < 0; j++) if (!this.trLive[t * TRAILS + j]) k = j;
      if (k < 0) return no(WHY.FULL);
      const s = t * TRAILS + k, len = this.buildPath(t, o.points || [], s * PATH_MAX);
      if (len < 0) return no(len === -2 ? WHY.LONG : WHY.BLOCKED);
      this.trLive[s] = 1; this.trKind[s] = o.kind === KIND.RAID ? KIND.RAID : KIND.FORAGE; this.trLevel[s] = o.level >= 1 && o.level <= 3 ? o.level : 2;
      this.trLen[s] = len; this.trSeq[s] = ++cg[base + CG.SEQ]; this.trDry[s] = 0;
      this.buildTrailField(s);
      this.event(EVENT.TRAIL, t, k, this.trKind[s]);
    } else if (o.type === CMD.ERASE) {
      const s = t * TRAILS + (o.trail | 0);
      if (!(o.trail >= 0 && o.trail < TRAILS) || !this.trLive[s]) return no(WHY.NONE);
      this.trLive[s] = 0; this.trF[s] = null;
    } else if (o.type === CMD.CREW) {
      const s = t * TRAILS + (o.trail | 0);
      if (!(o.trail >= 0 && o.trail < TRAILS) || !this.trLive[s]) return no(WHY.NONE);
      if (o.level >= 0 && o.level <= 3) this.trLevel[s] = o.level;
      if (o.kind === KIND.RAID || o.kind === KIND.FORAGE) this.trKind[s] = o.kind;
    } else if (o.type === CMD.DIET) {
      cg[base + CG.DIET] = Math.max(0, Math.min(4, o.share | 0));
    } else if (o.type === CMD.RALLY) {
      const c = this.snap(o.x | 0, o.y | 0);
      if (c < 0 || o.hold <= 0) { cg[base + CG.RALLY_CELL] = -1; cg[base + CG.RALLY_HOLD] = 0; this.rallyF[t] = null; return; }
      cg[base + CG.RALLY_CELL] = c; cg[base + CG.RALLY_HOLD] = Math.min(o.hold | 0, 2400);
      this.rallyF[t] = this.field(this.rallyF[t], [c]);
      this.event(EVENT.RALLY, t, c);
    } else if (o.type === CMD.RECALL) cg[base + CG.RECALL] = o.on ? 1 : 0;
  }

  /** The open surface cell at or nearest (x, y) within two cells, or -1. */
  snap(x, y) {
    let best = -1, bd = 99;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const c = cellAt(this.L, SURFACE, x + dx, y + dy), d = Math.abs(dx) + Math.abs(dy);
      if (c >= 0 && this.mat[c] === MAT.OPEN && d < bd) { best = c; bd = d; }
    }
    return best;
  }

  /** A trail's path into trPath at `at`: from the colony's door by the shortest way to the first point, then through
   *  the points, around anything closed. Returns its length; -1 blocked, -2 too long. */
  buildPath(t, points, at) {
    const P = this.trPath, sw = this.L.sw;
    let len = 0, prev = this.door[t];
    P[at + len++] = prev;
    for (let j = 0; j + 1 < points.length; j += 2) {
      const c = this.snap(points[j] | 0, points[j + 1] | 0);
      if (c < 0) { if (j + 2 >= points.length) return -1; continue; } // a closed point in the middle is skipped; a closed end refuses the trail
      if (c === prev) continue;
      const px = prev % sw, py = Math.floor(prev / sw), cx = c % sw, cy = Math.floor(c / sw);
      const start = len;
      let ok = Math.max(Math.abs(cx - px), Math.abs(cy - py)) <= (j === 0 ? 3 : 64); // the first point: straight only when it is by the door
      if (ok) {
        // A straight run of cells; a diagonal step with a closed side takes the open side first.
        let x = px, y = py, last = prev;
        const dx = Math.abs(cx - px), dy = Math.abs(cy - py), sx = px < cx ? 1 : -1, sy = py < cy ? 1 : -1;
        let err = dx - dy;
        while (ok && (x !== cx || y !== cy)) {
          const e2 = 2 * err; let nx = x, ny = y;
          if (e2 > -dy) { err -= dy; nx += sx; }
          if (e2 < dx) { err += dx; ny += sy; }
          const nc = ny * sw + nx;
          if (this.mat[nc] !== MAT.OPEN) { ok = false; break; }
          if (nx !== x && ny !== y) {
            const a = y * sw + nx, b = ny * sw + x, ao = this.mat[a] === MAT.OPEN, bo = this.mat[b] === MAT.OPEN;
            if (!ao && !bo) { ok = false; break; }
            if (!(ao && bo)) { if (len >= PATH_MAX) return -2; P[at + len++] = ao ? a : b; }
          }
          if (len >= PATH_MAX) return -2;
          P[at + len++] = nc; x = nx; y = ny; last = nc;
        }
        if (!ok) len = start;
      }
      if (!ok) {
        const got = this.route(prev, c, at + len, PATH_MAX - len);
        if (got < 0) return got;
        len += got;
      }
      prev = c;
    }
    return len > 1 ? len : -1;
  }

  /** The shortest walk from a to b on the surface, written after a (not including it). Returns its length; -1 none, -2 too long. */
  route(a, b, at, room) {
    const L = this.L, q = this.bq, prev = this.prev, mat = this.mat;
    prev.fill(-1, 0, L.nestBase);
    let qh = 0, qt = 0;
    q[qt++] = a; prev[a] = a;
    while (qh < qt && prev[b] < 0) {
      const c = q[qh++];
      for (let k = 0; k < 8; k++) {
        const m = k < 4 ? L.nb[c * 4 + k] : diagOpen(L, mat, c, k - 4);
        if (m < 0 || m >= L.nestBase || mat[m] !== MAT.OPEN || prev[m] >= 0) continue;
        prev[m] = c; q[qt++] = m;
      }
    }
    if (prev[b] < 0) return -1;
    let steps = 0;
    for (let c = b; c !== a; c = prev[c]) steps++;
    if (steps > room) return -2;
    let c = b;
    for (let j = steps - 1; j >= 0; j--) { this.trPath[at + j] = c; c = prev[c]; }
    return steps;
  }

  // ---- Fields ----

  /** Steps to the nearest source over open cells (four ways and through doors), FAR where there is no way. */
  field(out, sources) {
    const L = this.L, n = L.n, mat = this.mat, q = this.bq, link = this.link, nb = L.nb;
    const d = out || new Uint16Array(n);
    d.fill(FAR);
    let qh = 0, qt = 0;
    for (const s of sources) if (s >= 0 && d[s] === FAR) { d[s] = 0; q[qt++] = s; }
    while (qh < qt) {
      const c = q[qh++], v = d[c] + 1;
      for (let k = 0; k < 4; k++) { const m = nb[c * 4 + k]; if (m >= 0 && d[m] === FAR && mat[m] === MAT.OPEN) { d[m] = v; q[qt++] = m; } }
      const m = link[c];
      if (m >= 0 && d[m] === FAR && mat[m] === MAT.OPEN) { d[m] = v; q[qt++] = m; }
    }
    return d;
  }

  buildTrailField(s) {
    const len = this.trLen[s], at = s * PATH_MAX, P = this.trPath;
    const d = (this.trF[s] = this.field(this.trF[s], P.subarray(at, at + len)));
    for (let c = 0; c < d.length; c++) if (d[c] !== FAR) d[c] = Math.min(FAR - 1, d[c] + OFF);
    for (let j = 0; j < len; j++) { const c = P[at + j], left = len - 1 - j; if (d[c] >= OFF || left < d[c]) d[c] = left; } // on the path: steps left to its end
  }

  rebuildFields() {
    for (let t = 0; t < TEAMS; t++) {
      this.field(this.homeF[t], [this.store[t]]); this.field(this.doorF[t], [this.door[t]]); this.field(this.queenF[t], [this.queen[t]]);
      const r = this.cg[t * CG.SIZE + CG.RALLY_CELL];
      this.rallyF[t] = r >= 0 ? this.field(this.rallyF[t], [r]) : null;
    }
    for (let s = 0; s < TEAMS * TRAILS; s++) if (this.trLive[s]) this.buildTrailField(s); else this.trF[s] = null;
  }

  /** The neighbour of c to step to: the lowest value of F (up: the highest value under OFF), among open cells four ways, the
   *  door, and diagonals that cut no corner. Ties go to the first found. -1: nowhere better. */
  next(F, c, up = false) {
    const L = this.L, mat = this.mat, cur = F[c];
    let best = -1, bv = cur;
    for (let k = 0; k < 9; k++) {
      const m = k < 4 ? L.nb[c * 4 + k] : k < 8 ? diagOpen(L, mat, c, k - 4) : this.link[c];
      if (m < 0 || mat[m] !== MAT.OPEN) continue;
      const v = F[m];
      if (up ? v < OFF && v > bv : v < bv) { best = m; bv = v; }
    }
    return best;
  }

  // ---- The tick ----

  step() {
    while (this.queue.length && this.queue[0].tick <= this.tick) this.apply(this.queue.shift());
    this.census();
    this.stepColonies();
    this.buildBuckets();
    if ((this.tick % C.BITE_EVERY) === 0) this.press.fill(0, 0, this.n);
    for (let i = 0; i < this.n; i++) this.stepAnt(i);
    this.fight();
    if (this.anyDead) this.removeDead();
    if (this.tick % 50 === 49) this.checkTrails();
    this.judge();
    this.tick++;
  }

  census() {
    const cg = this.cg, crew = this.crew.fill(0);
    for (let t = 0; t < TEAMS; t++) { const o = t * CG.SIZE; cg[o + CG.ADULTS] = cg[o + CG.MAJORS] = cg[o + CG.WORKERS] = cg[o + CG.RESTING] = 0; }
    for (let i = 0; i < this.n; i++) {
      if (this.hp[i] === 0) continue;
      const t = this.team[i], o = t * CG.SIZE;
      cg[o + CG.ADULTS]++;
      if (this.caste[i] === CASTE.MAJOR) cg[o + CG.MAJORS]++; else if (this.task[i] !== TASK.NURSE) cg[o + CG.WORKERS]++;
      if (this.task[i] === TASK.REST) cg[o + CG.RESTING]++;
      if (this.tr[i] >= 0) crew[t * TRAILS + this.tr[i]]++;
    }
    for (let t = 0; t < TEAMS; t++) {
      const o = t * CG.SIZE; let left = cg[o + CG.WORKERS], fight = cg[o + CG.MAJORS];
      for (let k = 0; k < TRAILS; k++) {
        const s = t * TRAILS + k; let w = 0;
        if (this.trLive[s] && !this.trDry[s] && this.trLevel[s]) {
          if (this.trKind[s] === KIND.FORAGE) { w = Math.min(left, Math.max(1, Math.floor((cg[o + CG.WORKERS] * LEVEL_SHARE[this.trLevel[s]] + 50) / 100))); left -= w; }
          else { w = Math.min(fight, Math.max(1, Math.floor((cg[o + CG.MAJORS] * RAID_SHARE[this.trLevel[s]] + 50) / 100))); fight -= w; if (this.trLevel[s] === 3) { const x = Math.min(left, cg[o + CG.WORKERS] >> 2); w += x; left -= x; } }
        }
        this.want[s] = w;
      }
    }
  }

  stepColonies() {
    const cg = this.cg;
    // Brood.
    const fedThisTick = [false, false, false, false];
    // Meat is kept back for a larva waiting on the major diet, so a slow trickle still raises soldiers.
    const held = [0, 0, 0, 0];
    for (let k = 0; k < this.bn; k++) if (this.bStage[k] === STAGE.LARVA && this.bMajor[k] && this.bFed[k] === 0 && this.bHunger[k] < C.MAJOR_WAIT) held[this.bTeam[k]] = CASTE_FOOD[CASTE.MAJOR];
    let w = 0;
    for (let k = 0; k < this.bn; k++) {
      const t = this.bTeam[k], o = t * CG.SIZE;
      let keep = cg[o + CG.QUEEN_HP] > 0, stage = this.bStage[k];
      if (this.bAge[k] < 0xFFFF) this.bAge[k]++;
      const age = this.bAge[k];
      if (stage === STAGE.EGG) { if (age >= C.EGG_TICKS) { stage = STAGE.LARVA; this.bAge[k] = 0; } }
      else if (stage === STAGE.LARVA) {
        if (this.bFed[k] === 0 && !fedThisTick[t] && cg[o + CG.PROTEIN] > 0) {
          // A larva on the major diet waits for three loads; after MAJOR_WAIT hungry she takes one and grows up a worker.
          const major = this.bMajor[k] && cg[o + CG.PROTEIN] >= CASTE_FOOD[CASTE.MAJOR];
          if (major || ((!this.bMajor[k] || this.bHunger[k] >= C.MAJOR_WAIT) && cg[o + CG.PROTEIN] > held[t])) {
            const meal = major ? CASTE_FOOD[CASTE.MAJOR] : 1;
            cg[o + CG.PROTEIN] -= meal; this.bFed[k] = meal; this.bHunger[k] = 0; fedThisTick[t] = true;
          } else this.bHunger[k]++;
        } else if (this.bFed[k] === 0 && this.bHunger[k] < 0xFFFF) this.bHunger[k]++;
        if (this.bHunger[k] >= C.LARVA_STARVE) keep = false;
        else if (this.bFed[k] > 0 && age >= C.LARVA_TICKS) { stage = STAGE.PUPA; this.bAge[k] = 0; }
      } else if (age >= C.PUPA_TICKS) {
        const caste = this.bFed[k] >= CASTE_FOOD[CASTE.MAJOR] ? CASTE.MAJOR : CASTE.WORKER;
        const i = this.spawn(t, caste, this.bCell[k]);
        if (i >= 0) { keep = false; const born = cg[o + CG.BORN]++; if (caste === CASTE.WORKER && born % 10 === 9) this.task[i] = TASK.NURSE; this.event(EVENT.BORN, t, caste, this.bCell[k]); }
      }
      this.bStage[k] = stage;
      if (!keep) continue;
      if (w !== k) { this.bTeam[w] = this.bTeam[k]; this.bStage[w] = this.bStage[k]; this.bAge[w] = this.bAge[k]; this.bFed[w] = this.bFed[k]; this.bHunger[w] = this.bHunger[k]; this.bCell[w] = this.bCell[k]; this.bMajor[w] = this.bMajor[k]; }
      w++;
    }
    this.bn = w;
    const count = [0, 0, 0, 0];
    for (let k = 0; k < this.bn; k++) count[this.bTeam[k]]++;
    for (let t = 0; t < TEAMS; t++) {
      const o = t * CG.SIZE;
      if (cg[o + CG.QUEEN_HP] <= 0) continue;
      if (cg[o + CG.LAY] > 0) cg[o + CG.LAY]--;
      if (cg[o + CG.LAY] === 0 && cg[o + CG.SUGAR] > 0 && count[t] < C.NURSERY && this.n + this.bn < this.cfg.maxAnts) { if (this.addBrood(t, STAGE.EGG) >= 0) cg[o + CG.LAY] = C.LAY_EVERY; }
      // Meals: a major eats as three.
      if (this.tick % C.EAT_EVERY === C.EAT_EVERY - 1) {
        const mouths = cg[o + CG.ADULTS] + 2 * cg[o + CG.MAJORS], need = Math.floor((mouths + C.ADULTS_PER_SUGAR - 1) / C.ADULTS_PER_SUGAR);
        cg[o + CG.SUGAR] = Math.max(0, cg[o + CG.SUGAR] - need);
      }
      // Starving: after a minute at no sugar the oldest die, one in a hundred every ten seconds.
      if (cg[o + CG.SUGAR] > 0) cg[o + CG.STARVE] = 0;
      else {
        const s = ++cg[o + CG.STARVE] - C.STARVE_AFTER;
        if (s >= 0 && s % C.STARVE_EVERY === 0) {
          let kill = Math.max(1, Math.floor(cg[o + CG.ADULTS] / 100));
          if (cg[o + CG.ADULTS] === 0) cg[o + CG.QUEEN_HP] = 0;
          for (let i = 0; i < this.n && kill > 0; i++) if (this.hp[i] > 0 && this.team[i] === t) { this.hurt(i, 255, -1); kill--; }
        }
      }
      if (cg[o + CG.RALLY_HOLD] > 0 && --cg[o + CG.RALLY_HOLD] === 0) { cg[o + CG.RALLY_CELL] = -1; this.rallyF[t] = null; }
    }
  }

  buildBuckets() {
    this.head.fill(-1); this.occ.fill(0);
    for (let i = this.n - 1; i >= 0; i--) {
      if (this.hp[i] === 0) continue;
      const c = this.cellOf(i);
      this.nextAnt[i] = this.head[c]; this.head[c] = i; this.occ[c] |= 1 << this.team[i];
    }
  }

  /** The nearest living enemy within r cells on her layer, or -1 (ties: the first found in reading order). */
  enemyNear(i, r) {
    const L = this.L, layer = this.layer[i], cx = this.x[i] >> 8, cy = this.y[i] >> 8, mine = 1 << this.team[i];
    let best = -1, bd = 1 << 30;
    for (let oy = -r; oy <= r; oy++) for (let ox = -r; ox <= r; ox++) {
      const c = cellAt(L, layer, cx + ox, cy + oy);
      if (c < 0 || !(this.occ[c] & ~mine)) continue;
      for (let j = this.head[c]; j >= 0; j = this.nextAnt[j]) {
        if (this.team[j] === this.team[i] || this.hp[j] === 0) continue;
        const d = est(this.x[i] - this.x[j], this.y[i] - this.y[j]);
        if (d < bd) { bd = d; best = j; }
      }
    }
    return best;
  }

  stepAnt(i) {
    if (this.hp[i] === 0) return;
    if (this.since[i] < 0xFFFF) this.since[i]++;
    const t = this.team[i], o = t * CG.SIZE, cg = this.cg, c = this.cellOf(i);
    const tr = this.tr[i], s = tr >= 0 ? t * TRAILS + tr : -1;
    const fighter = this.caste[i] === CASTE.MAJOR || (s >= 0 && this.trKind[s] === KIND.RAID);
    // Fighters go straight at an enemy they can see, unless they carry something home.
    if (fighter && !this.carry[i]) {
      const e = this.enemyNear(i, C.SEE);
      if (e >= 0 && !(cg[o + CG.RECALL] && this.layer[i] === SURFACE)) {
        // Straight at her, unless a stone is in the way: then she walks on by her task and meets her round it.
        const x0 = this.x[i], y0 = this.y[i];
        this.steer(i, this.x[e], this.y[e], C.BITE_R - 40);
        if (this.x[i] !== x0 || this.y[i] !== y0 || est(this.x[e] - x0, this.y[e] - y0) <= C.BITE_R) { this.to[i] = -1; this.since[i] = 0; return; }
      }
    }
    if (this.to[i] >= 0 && this.mat[this.to[i]] !== MAT.OPEN) this.to[i] = -1;
    if (this.to[i] < 0 || (this.x[i] === this.tx[i] && this.y[i] === this.ty[i])) {
      const nc = this.decide(i, c, t, o, s);
      if (nc >= 0 && nc !== c && this.link[c] === nc) {
        // Through the door: she is on the other layer at once.
        const L = this.L, nest = nc >= L.nestBase, w = nest ? L.nw : L.sw, k = nest ? nc - L.nestBase : nc;
        this.layer[i] = nest ? NEST : SURFACE; this.x[i] = ((k % w) << 8) + 128; this.y[i] = (Math.floor(k / w) << 8) + 128; this.to[i] = -1;
        return;
      }
      this.aim(i, c, nc < 0 ? c : nc);
    }
    this.walk(i);
  }

  /** Set her target point in cell nc: its centre, moved to the right of her direction of travel so two streams pass. */
  aim(i, c, nc) {
    const L = this.L, nest = nc >= L.nestBase, w = nest ? L.nw : L.sw, k = nest ? nc - L.nestBase : nc, k0 = nest ? c - L.nestBase : c;
    const dx = (k % w) - (k0 % w), dy = Math.floor(k / w) - Math.floor(k0 / w), lane = 30 + (this.id[i] % 5) * 12;
    this.to[i] = nc;
    this.tx[i] = ((k % w) << 8) + 128 - dy * lane; this.ty[i] = (Math.floor(k / w) << 8) + 128 + dx * lane;
  }

  walk(i) { this.steer(i, this.tx[i], this.ty[i], 0); }

  /** Move toward (px, py) at her speed, stopping `keep` short of it and never into a closed cell. */
  steer(i, px, py, keep) {
    const dx = px - this.x[i], dy = py - this.y[i], d = est(dx, dy);
    if (d <= keep) return;
    const sp = Math.min(CASTE_SPEED[this.caste[i]], d - keep);
    this.heading[i] = angleOf(dx, dy);
    let nx, ny;
    if (d <= sp) { nx = px; ny = py; } else { nx = this.x[i] + Math.trunc((dx * sp) / d); ny = this.y[i] + Math.trunc((dy * sp) / d); }
    const nc = cellAt(this.L, this.layer[i], nx >> 8, ny >> 8);
    if (nc < 0 || this.mat[nc] !== MAT.OPEN) { this.to[i] = -1; return; }
    this.x[i] = nx; this.y[i] = ny;
  }

  /** Her next cell, by task. Called when she stands on her last target. */
  decide(i, c, t, o, s) {
    const cg = this.cg, task = this.task[i], home = this.homeF[t];
    const recall = cg[o + CG.RECALL] === 1;
    if (task === TASK.NURSE) { const h = this.nursery[t]; return this.mill(i, c, m => { const k = m - this.L.nestBase, x = k % this.L.nw, y = Math.floor(k / this.L.nw); return m >= this.L.nestBase && x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h; }, 24); }
    if (this.inv[i]) return this.invade(i, c, t);
    if (task === TASK.OUT) {
      if (s < 0 || !this.trLive[s] || recall) { this.task[i] = TASK.BACK; this.tr[i] = -1; return this.next(home, c); }
      const F = this.trF[s], v = F[c];
      if (v === 0) return this.atEnd(i, c, t, s);
      const m = this.next(F, c);
      if (m < 0) { this.task[i] = TASK.BACK; return this.next(home, c); }
      return m;
    }
    if (task === TASK.BACK) {
      if (home[c] <= 1 && this.layer[i] === NEST) {
        const kind = this.carry[i];
        if (kind) {
          const food = kind === CARRY.PROTEIN ? FOOD.PROTEIN : FOOD.SUGAR;
          cg[o + (food === FOOD.PROTEIN ? CG.PROTEIN : CG.SUGAR)]++; cg[o + (food === FOOD.PROTEIN ? CG.LOADS_P : CG.LOADS_S)]++;
          this.carry[i] = 0; this.event(EVENT.HOME, t, food, this.tr[i]);
        }
        // Home: she leaves her crew, so a trail's count is of ants at work and the next free ant can take the place.
        if (this.tr[i] >= 0) { const q = t * TRAILS + this.tr[i]; if (this.crew[q] > 0) this.crew[q]--; this.tr[i] = -1; }
        this.task[i] = this.caste[i] === CASTE.MAJOR ? TASK.GUARD : TASK.REST; this.since[i] = 0;
        return this.assign(i, c, t, o);
      }
      // A carrier who came by a trail walks it back to its start, so a trail is one stream both ways.
      if (s >= 0 && this.trLive[s] && this.layer[i] === SURFACE) { const F = this.trF[s]; if (F[c] < OFF) { const m = this.next(F, c, true); if (m >= 0) return m; } }
      return this.next(home, c);
    }
    if (task === TASK.GUARD) {
      if (recall) { if (home[c] <= 2 && this.layer[i] === NEST) return this.mill(i, c, m => home[m] <= 3, 40); return this.next(home, c); }
      const r = this.assign(i, c, t, o);
      if (this.task[i] !== TASK.GUARD) return r;
      const R = this.rallyF[t];
      if (R) return R[c] > 2 ? this.next(R, c) : this.mill(i, c, m => R[m] <= 3, 12);
      const D = this.doorF[t];
      return D[c] > C.GUARD_R || this.layer[i] === NEST ? this.next(D, c) : this.mill(i, c, m => D[m] <= C.GUARD_R && m < this.L.nestBase, 30);
    }
    // REST: by the store, until a trail wants her. A share of the resting answer a rally.
    if (home[c] > 3 || this.layer[i] !== NEST) { const R = this.rallyF[t]; if (R && !recall && (this.id[i] & 3) === 0) return R[c] > 2 ? this.next(R, c) : this.mill(i, c, m => R[m] <= 3, 12); return this.next(home, c); }
    const r = this.assign(i, c, t, o);
    if (this.task[i] !== TASK.REST) return r;
    const R = this.rallyF[t];
    if (R && !recall && (this.id[i] & 3) === 0) return this.next(R, c);
    return this.mill(i, c, m => home[m] <= 3, 40);
  }

  /** Stand, and now and then step to a neighbour cell that passes `ok`. */
  mill(i, c, ok, every) {
    if (below(this.rng, STREAM.ants, every) !== 0) return c;
    const L = this.L, k = below(this.rng, STREAM.ants, 4), m = L.nb[c * 4 + k];
    return m >= 0 && this.mat[m] === MAT.OPEN && ok(m) ? m : c;
  }

  /** Give a free ant at home a trail that is short of its crew (the largest gap first). Returns her next cell. */
  assign(i, c, t, o) {
    if (this.cg[o + CG.RECALL]) return c;
    const major = this.caste[i] === CASTE.MAJOR;
    let best = -1, gap = 0;
    for (let k = 0; k < TRAILS; k++) {
      const s = t * TRAILS + k;
      if (!this.trLive[s] || this.trDry[s]) continue;
      const raid = this.trKind[s] === KIND.RAID;
      if (major ? !raid : raid && this.trLevel[s] < 3) continue;
      const g = this.want[s] - this.crew[s];
      if (g > gap) { gap = g; best = k; }
    }
    if (best < 0) return c;
    this.tr[i] = best; this.crew[t * TRAILS + best]++; this.task[i] = TASK.OUT; this.since[i] = 0;
    return this.next(this.trF[t * TRAILS + best], c);
  }

  /** At her trail's end. A forager takes a load; a raider holds, or goes in through an enemy door close by. */
  atEnd(i, c, t, s) {
    const raid = this.trKind[s] === KIND.RAID;
    if (this.crew[s] > this.want[s] + 1) { this.crew[s]--; this.tr[i] = -1; this.task[i] = TASK.BACK; return this.next(this.homeF[t], c); }
    if (this.caste[i] === CASTE.WORKER) {
      const p = this.pileNear(c);
      if (p >= 0) {
        this.carry[i] = this.pileKind[p] === FOOD.PROTEIN ? CARRY.PROTEIN : CARRY.SUGAR;
        if (--this.pileAmount[p] === 0) { this.event(EVENT.PILE_EMPTY, p); this.pileCell[p] = -1; }
        this.task[i] = TASK.BACK; this.since[i] = 0;
        return c;
      }
    }
    if (raid) {
      for (let e = 0; e < TEAMS; e++) if (e !== t && this.cg[e * CG.SIZE + CG.QUEEN_HP] > 0 && this.doorF[e][c] <= 4) { this.inv[i] = 1 + e; return this.invade(i, c, t); }
      return this.mill(i, c, m => this.trF[s] && this.trF[s][m] <= 2, 16);
    }
    if (this.since[i] > C.WAIT_AT_END) { this.task[i] = TASK.BACK; this.tr[i] = -1; return this.next(this.homeF[t], c); }
    return this.mill(i, c, m => this.trF[s][m] <= 1, 8);
  }

  /** Inside an enemy's nest: a worker goes to the store, takes a load and leaves; a major goes for the queen. */
  invade(i, c, t) {
    const e = this.inv[i] - 1, eo = e * CG.SIZE, cg = this.cg, s = this.tr[i] >= 0 ? t * TRAILS + this.tr[i] : -1;
    if (s < 0 || !this.trLive[s] || cg[t * CG.SIZE + CG.RECALL] || cg[eo + CG.QUEEN_HP] <= 0) { this.inv[i] = 0; this.task[i] = TASK.BACK; return this.next(this.homeF[t], c); }
    if (this.caste[i] === CASTE.WORKER) {
      const F = this.homeF[e];
      if (F[c] <= 1 && this.layer[i] === NEST) {
        const kind = cg[eo + CG.PROTEIN] > cg[eo + CG.SUGAR] ? FOOD.PROTEIN : FOOD.SUGAR, k = eo + (kind === FOOD.PROTEIN ? CG.PROTEIN : CG.SUGAR);
        if (cg[k] > 0) { cg[k]--; cg[eo + CG.LOST]++; cg[t * CG.SIZE + CG.STOLEN]++; this.carry[i] = kind === FOOD.PROTEIN ? CARRY.PROTEIN : CARRY.SUGAR; this.event(EVENT.STOLEN, e, t, kind); }
        this.inv[i] = 0; this.task[i] = TASK.BACK;
        return this.next(this.homeF[t], c);
      }
      const m = this.next(F, c); return m < 0 ? c : m;
    }
    const Q = this.queenF[e];
    if (Q[c] <= 1) return c;
    const m = this.next(Q, c); return m < 0 ? c : m;
  }

  /** A pile with food within two cells of c, or -1 (the nearest; ties: the lower index). */
  pileNear(c) {
    if (c >= this.L.nestBase) return -1;
    const sw = this.L.sw, x = c % sw, y = Math.floor(c / sw);
    let best = -1, bd = 99;
    for (let p = 0; p < MAX_PILES; p++) {
      if (this.pileAmount[p] <= 0) continue;
      const pc = this.pileCell[p], d = Math.max(Math.abs((pc % sw) - x), Math.abs(Math.floor(pc / sw) - y));
      if (d <= 2 && d < bd) { bd = d; best = p; }
    }
    return best;
  }

  /** Add food at a surface cell: to a pile of that kind within a cell, or as a new pile. */
  drop(c, kind, amount) {
    const sw = this.L.sw, x = c % sw, y = Math.floor(c / sw);
    let free = -1;
    for (let p = 0; p < MAX_PILES; p++) {
      if (this.pileAmount[p] <= 0) { if (free < 0) free = p; continue; }
      const pc = this.pileCell[p];
      if (this.pileKind[p] === kind && Math.abs((pc % sw) - x) <= 1 && Math.abs(Math.floor(pc / sw) - y) <= 1) { this.pileAmount[p] += amount; return p; }
    }
    if (free >= 0) { this.pileCell[free] = c; this.pileKind[free] = kind; this.pileAmount[free] = amount; }
    return free;
  }

  hurt(i, amount, by) {
    const hp = this.hp[i];
    if (hp === 0) return;
    this.hp[i] = hp > amount ? hp - amount : 0;
    if (this.hp[i] === 0) {
      const t = this.team[i];
      this.cg[t * CG.SIZE + CG.DIED]++; this.anyDead = true;
      if (by >= 0) this.cg[by * CG.SIZE + CG.KILLS]++;
      const c = this.cellOf(i);
      this.event(EVENT.DIED, t, c, this.caste[i]);
      if (by >= 0 && c < this.L.nestBase) this.drop(c, FOOD.PROTEIN, 1); // the dead are food
    }
  }

  /** Bites: an ant whose wait is over bites the nearest enemy she touches. An ant takes at most PRESS bites in each
   *  window of BITE_EVERY ticks: five in the open, two in a tunnel, so numbers win outside and a narrow way holds. */
  fight() {
    const L = this.L, cg = this.cg, n = this.n;
    // Every bite of a tick lands together, and the scan runs forward and back by turns, so neither colony strikes first.
    const dmg = this.dmg ?? (this.dmg = new Uint16Array(this.cfg.maxAnts)), by = this.dmgBy ?? (this.dmgBy = new Uint8Array(this.cfg.maxAnts));
    let any = false;
    const fwd = (this.tick & 1) === 0;
    for (let q = 0; q < n; q++) {
      const i = fwd ? q : n - 1 - q;
      if (this.cool[i]) { this.cool[i]--; continue; }
      if (this.hp[i] === 0) continue;
      const t = this.team[i], mine = 1 << t, layer = this.layer[i], cx = this.x[i] >> 8, cy = this.y[i] >> 8, cap = layer === NEST ? C.PRESS_TUNNEL : C.PRESS_OPEN;
      let target = -1, bd = C.BITE_R;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const cc = cellAt(L, layer, cx + ox, cy + oy);
        if (cc < 0 || !(this.occ[cc] & ~mine)) continue;
        for (let j = this.head[cc]; j >= 0; j = this.nextAnt[j]) {
          if (this.team[j] === t || this.hp[j] === 0 || this.press[j] >= cap) continue;
          const d = est(this.x[i] - this.x[j], this.y[i] - this.y[j]);
          if (d < bd) { bd = d; target = j; }
        }
      }
      if (target >= 0) { this.press[target]++; dmg[target] += CASTE_BITE[this.caste[i]]; by[target] = t; any = true; this.cool[i] = C.BITE_EVERY; continue; }
      // No ant to bite: an enemy queen within a cell.
      if (layer === NEST) for (let e = 0; e < TEAMS; e++) {
        if (e === t || cg[e * CG.SIZE + CG.QUEEN_HP] <= 0 || this.queenF[e][this.cellOf(i)] > 1) continue;
        const hp = (cg[e * CG.SIZE + CG.QUEEN_HP] = Math.max(0, cg[e * CG.SIZE + CG.QUEEN_HP] - CASTE_BITE[this.caste[i]]));
        this.cool[i] = C.BITE_EVERY; this.event(EVENT.QUEEN_HIT, e, hp); break;
      }
    }
    if (any) for (let i = 0; i < n; i++) if (dmg[i]) { if (this.hp[i] > 0) this.hurt(i, dmg[i], by[i]); dmg[i] = 0; }
  }

  removeDead() {
    const keys = ['x', 'y', 'layer', 'heading', 'team', 'caste', 'hp', 'task', 'carry', 'tr', 'cool', 'press', 'to', 'tx', 'ty', 'since', 'inv', 'id'];
    let w = 0;
    for (let i = 0; i < this.n; i++) {
      if (this.hp[i] === 0) continue;
      if (w !== i) for (const k of keys) this[k][w] = this[k][i];
      w++;
    }
    this.n = w; this.anyDead = false;
  }

  /** A forage trail is dry when no food lies within two cells of its end; its crew is released until food appears. */
  checkTrails() {
    for (let s = 0; s < TEAMS * TRAILS; s++) {
      if (!this.trLive[s] || this.trKind[s] !== KIND.FORAGE) continue;
      const dry = this.pileNear(this.trPath[s * PATH_MAX + this.trLen[s] - 1]) < 0 ? 1 : 0;
      if (dry && !this.trDry[s]) this.event(EVENT.DRY, Math.floor(s / TRAILS), s % TRAILS);
      this.trDry[s] = dry;
    }
  }

  /** The mission: a colony whose queen dies loses at once; at dusk the colony with more adults wins (a tie goes to team 0). */
  judge() {
    if (this.result) return;
    const cg = this.cg;
    let alive = 0, last = -1;
    for (let t = 0; t < TEAMS; t++) if (cg[t * CG.SIZE + CG.QUEEN_HP] > 0) { alive++; last = t; }
    if (alive <= 1) { this.result = 1 + Math.max(0, last); this.event(EVENT.RESULT, Math.max(0, last), REASON.QUEEN); return; }
    if (this.cfg.duskTick > 0 && this.tick + 1 >= this.cfg.duskTick) {
      let best = 0;
      for (let t = 1; t < TEAMS; t++) if (cg[t * CG.SIZE + CG.ADULTS] > cg[best * CG.SIZE + CG.ADULTS]) best = t;
      this.result = 1 + best; this.event(EVENT.RESULT, best, REASON.DUSK);
    }
  }

  // ---- Hash and save ----

  stateArrays() {
    const n = this.n, b = this.bn;
    return [
      ['mat', this.mat], ['cg', this.cg], ['rng', this.rng], ['pileCell', this.pileCell], ['pileAmount', this.pileAmount], ['pileKind', this.pileKind],
      ...['x', 'y', 'layer', 'heading', 'team', 'caste', 'hp', 'task', 'carry', 'tr', 'cool', 'press', 'to', 'tx', 'ty', 'since', 'inv', 'id'].map(k => [k, this[k], n]),
      ...['bTeam', 'bStage', 'bAge', 'bFed', 'bHunger', 'bCell', 'bMajor'].map(k => [k, this[k], b]),
      ['trLive', this.trLive], ['trKind', this.trKind], ['trLevel', this.trLevel], ['trDry', this.trDry], ['trLen', this.trLen], ['trSeq', this.trSeq], ['trPath', this.trPath],
    ];
  }

  hash() {
    let h = hashInt(0x9747B28C, this.tick);
    h = hashInt(h, this.n); h = hashInt(h, this.bn); h = hashInt(h, this.result); h = hashInt(h, this.nextId);
    for (const [, a, len] of this.stateArrays()) h = hashArray(h, a, len ?? a.length);
    return finish(h);
  }

  /** Everything needed to carry on from here: plain copies of the state arrays. Queued orders are not saved. */
  save() {
    const out = { v: WAR_VERSION, cfg: { ...this.cfg }, tick: this.tick, n: this.n, bn: this.bn, result: this.result, nextId: this.nextId, a: {} };
    for (const [k, a, len] of this.stateArrays()) out.a[k] = a.slice(0, len ?? a.length);
    return out;
  }

  static load(s) {
    if (s.v !== WAR_VERSION) throw new Error(`save is version ${s.v}, this sim is ${WAR_VERSION}`);
    const sim = new Sim({ ...s.cfg, restoring: true });
    delete sim.cfg.restoring;
    generate(sim, true); // the fixed layout (doors, stores, rooms); the terrain itself comes from the save
    sim.tick = s.tick; sim.n = s.n; sim.bn = s.bn; sim.result = s.result; sim.nextId = s.nextId;
    for (const k of Object.keys(s.a)) sim[k].set(s.a[k]);
    sim.rebuildFields();
    return sim;
  }
}
