// Cinderhill's deterministic simulation core. Pure: no clock, no DOM, no floating-point Math, no locale.
// The same file runs in the page, in a Durable Object, in Node bots and in tests.
//
// One tick (20 a second, fixed):
//   1. apply the commands queued for this tick, in (tick, seat, id) order
//   2. rebuild dirty flow fields (so new goals are usable this tick), at most REBUILDS, oldest marked first
//   3. world: food piles and a held alarm lay scent
//   4. ants, in index order (separation reads a spatial hash built at the start of this step)
//   5. scent spreads and decays
//   6. rebuild dirty flow fields again; any still marked are blank, so no field is stale at the tick boundary
// The state at a tick boundary is everything hashed by hashes() and written by snapshot().

import { ANGLES, COS, SIN, angleOf, turnTo } from './math.js';
import { HARDNESS, MAT, NEST, SUB, SURFACE, baseOf, cellAt, cellXY, heightOf, makeLayout, widthOf } from './grid.js';
import { STREAM, STREAMS, below, seedStreams } from './rng.js';
import { DIAG, G, GOAL, INF, MAX_GOALS, PATH_MAX, REBUILDS, SLOT, STEP, TRAIL_OFF, backCell, backDist, distAt, dropGoal, isTrailSlot, makeFlow, markDirty, markKind, nextCell, rebuild, rebuildDirty, setGoal, terrainChanged } from './flow.js';
import { FIELD, FIELDS, deposit, makeScent, smell, stepScent } from './scent.js';
import { SUBSYSTEMS, finish, hashArray, hashInt } from './hash.js';
import { LATE_FIND_AT, WINDFALL_AT, generate, lateFind, windfall } from './world.js';
import { stepSpider } from './spider.js';
import { BROOD_MAX, C, CASTE, CASTE_HP, DAY_TICKS, FOOD, LOAD, STAGE, addBrood, fight, makeBrood, startColony, startDays, stepColony, stepDay } from './colony.js';

export const SIM_VERSION = 11; // 11: the goal manager (05-tech): 64 goal slots (a pool from slot 16), 32-bit distances, at most REBUILDS fields rebuilt per rebuild point, oldest marked first, the rest blank (ants keep their heading); same play as 10; 2: trails keep their drawn shape (a path per trail, `via` per ant); 3: eight directions; 4: the colony (colony.js); 5: days; 6: the spider, and foragers stay in under Recall; 7: crews (CMD.CREW); 8: the spec's starting values (02-spec 3.2): a porch store, a 64-cell nursery, 30 ants, fast brood, no days; 9: who goes (02-spec 6.2): crew levels (Steady by default), free foragers on the nearest trail one in three at a time, the dig as an auto job, adult starvation; 10: doors (02-spec 3.2): a 3-cell entrance in colony games, two lanes a cell at 6 ants a second, queues and jams; an ant with a load is not free
export const TICK_HZ = 20;
export { G, GOAL, SLOT, INF, STEP, DIAG, FIELD, MAT, SURFACE, NEST, SUB, SUBSYSTEMS, CASTE, CASTE_HP, FOOD, LOAD, STAGE, BROOD_MAX };

export const JOB = { FORAGE: 0, DIG: 1, GUARD: 2, NURSE: 3 }; // NURSE (sim 8): stays in the nursery
export const MODE = { SEEK: 0, RETURN: 1, WORK: 2, REST: 3 };
export const CMD = { TRAIL: 1, DIG: 2, ALARM: 3, RECALL: 4, CREW: 5 };
export const EVENT = { DUG: 1, PILE_EMPTY: 2, REJECTED: 3, LATE: 4, DUSK: 5, SPIDER: 6, PILE_NEW: 7, HOME: 8, JAM: 9 }; // DUSK: (day, won); SPIDER: (spider.js SPIDER state, slot or kills); PILE_NEW: (pile, kind); HOME (colony games): a load home (trail slot of her route or -1, kind); JAM (sim 10): (1 jammed or 0 clear, ants queued)
export const MAX_PILES = 8;
const EVENT_CAP = 1024; // events kept until the host drains them; older ones are dropped (counted in globals)

export const DEFAULTS = {
  seed: 1, sw: 256, sh: 256, nw: 192, nh: 128, ants: 500, maxAnts: 5000,
  // Per scent field (trail, food, alarm): spread D/256 per neighbour per tick, and half-life in ticks.
  // Trail: about 60 s unused (02-spec 3.2).
  spread: [6, 40, 48], halfLife: [1200, 60, 200],
  blank: false, // true: an empty map for tests (surface open, nest all clay); no world generation
  // A colony game: a queen, brood and the colony's meals (colony.js). `ants` adults, `surface` of them foragers
  // around the entrance and the rest nurses; `sugar` and `protein` loads in the porch store; `eggs`, `larvae` and
  // `pupae` brood (colony.js START says how they are aged). Off (0): the sandbox, adults only, as in M0.
  colony: 0, sugar: 0, protein: 0, eggs: 0, larvae: 0, pupae: 0, surface: 0,
  dayTicks: DAY_TICKS, // a colony game's day length (colony.js, Days); 0: no days (sim 8's colony game)
};

const WALK = 45, WALK_OFF = 32, RUN = 64; // sub-cell units per tick (02-spec 3.2): 3.5 cells a second on a trail (and in the nest), 2.5 off one on the surface, 5 running
const TURN = 32; // most a heading turns in one tick when steering toward a target
const SEP_R = 160; // separation radius in sub-cell units
const SENSE_AT = 2 * SUB, SENSE_SIDE = 28, SENSE_MIN = 2000;
const TRAIL_LAY = 60000, TRAIL_STROKE = 400000, FOOD_EMIT = 200000, ALARM_EMIT = 600000, ALARM_FADE = 5000;
const FAR = 150 * STEP; // a seeking forager this far from home (150 straight steps) goes back
const STALL_KICK = 50, KICK_EVERY = 30, KICK_FOR = 8;
const SEEK_GIVE_UP = 600; // a forager that finds nothing in 30 s goes home
const BRIDGE_MARGIN = 12;
// A free forager's route (sim 9, colony games): `via` FREE_VIA + slot while she works the nearest trail without being on
// its crew. Crew members keep `via` = the slot, so `crew` counts only them.
export const FREE_VIA = 16;
// Doors (sim 10, 02-spec 3.2): debts in twentieths of a pass; a lane passes 6 ants a second; a jam is 10 queued for 5 s.
export const PASS = 20, LANE_RATE = 6, DOOR_CELLS = 4, JAM_AT = 10, JAM_FOR = 100;
export const LEVEL_SHARE = [0, 10, 25, 50]; // percent of the outside workforce: none, Light, Steady, Surge

/** Trail k's crew size at its level for a workforce of wf, capped by what the other crews leave. */
function crewSize(sim, k, wf) {
  const g = sim.g, F = sim.flow;
  let others = 0;
  for (let j = 0; j < SLOT.TRAILS; j++) if (j !== k && F.live[SLOT.TRAIL0 + j] && g[G.WANT0 + j] > 0) others += g[G.WANT0 + j] - 1;
  const size = wf > 0 ? Math.max(1, Math.floor((wf * LEVEL_SHARE[g[G.LEVEL0 + k]] + 50) / 100)) : 0;
  return Math.max(0, Math.min(size, wf - others));
} // a stroke blocked by a closed cell is routed around inside this many cells of the gap first

export class Sim {
  constructor(options = {}) {
    const cfg = { ...DEFAULTS, ...options };
    // The day length is hashed and snapshotted as a 32-bit integer: anything else would restore as another value.
    if (!Number.isInteger(cfg.dayTicks) || cfg.dayTicks < 0 || cfg.dayTicks > 0x7fffffff) throw new RangeError(`dayTicks must be an integer from 0 (no days) to 2^31 - 1, not ${cfg.dayTicks}`);
    cfg.spread = cfg.spread.slice(); cfg.halfLife = cfg.halfLife.slice(); // the sim's own copies: hashed and snapshotted
    this.cfg = cfg;
    const L = (this.L = makeLayout(cfg)), n = L.n, A = cfg.maxAnts;
    this.mat = new Uint8Array(n);
    this.dig = new Uint8Array(n); // 1: marked for digging
    this.digWork = new Uint8Array(n); // digging done so far on a marked cell
    this.link = new Int32Array(n).fill(-1);
    this.pileCell = new Int32Array(MAX_PILES).fill(-1);
    this.pileAmount = new Int32Array(MAX_PILES);
    this.pileKind = new Uint8Array(MAX_PILES); // FOOD.SUGAR or FOOD.PROTEIN
    this.home = { x: 0, y: 0, w: 1, h: 1 };
    this.nursery = null; // where brood lies and nurses stay (colony.js nursery); null: the home chamber
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
    this.best = new Uint32Array(A); // closest distance to that goal so far (32-bit with the fields, sim 11)
    this.stall = new Uint16Array(A); // ticks without progress
    this.since = new Uint16Array(A); // ticks in the current mode (saturates)
    this.lastCell = new Int32Array(A);
    this.via = new Int8Array(A); // trail slot that led this forager out (her route), or -1; -2: a carrier whose trail was replaced on her way home (she still came by trail: the day 1 goal counts her load)
    this.caste = new Uint8Array(A); // CASTE (colony.js): worker or major
    this.hp = new Uint8Array(A); // hit points; 0 is removed at the end of the tick
    this.team = new Uint8Array(A); // 0 the player's colony; others for fights to come
    this.cool = new Uint8Array(A); // ticks until this ant can bite again (colony.js fight)
    this.brood = makeBrood();
    this.anyDead = false; // an ant is at 0 hit points: removed at the end of the tick (restore recomputes it)
    // Spatial hash (rebuilt every tick from positions; not state).
    this.head = new Int32Array(n); this.nextAnt = new Int32Array(A);
    // Scratch for building a trail's path (not state).
    this.pathAt = new Int32Array(L.nestBase).fill(-1); this.seen = new Int32Array(L.nestBase); this.prev = new Int32Array(L.nestBase);
    this.seenMark = 0; this.pathBuf = new Int32Array(PATH_MAX);
    this.crew = new Int32Array(SLOT.TRAILS); // per tick: living foragers whose route is each trail (from `via`; not state)
    this.freeAll = 0; this.freeOut = 0; // per tick, colony games: free foragers, and those of them not resting (not state)
    this.queued = new Uint8Array(A); // per tick, colony games: 1 for an ant waiting at a door lane this tick (not state; for the HUD and the observer)
    this.doorCells = null; // the surface cells with a link, in cell order: each has two lanes (worked out on the first colony tick; links do not change in play)
    this.queue = []; // pending commands, each an Int32Array [tick, seat, id, type, ...payload], sorted
    this.events = []; // [type, a, b] triples not yet drained
    this.maxStall = 0; // a counter for tests and bots; not state
    if (options.restoring) return;
    if (!cfg.blank) generate(this);
    else { this.mat.fill(MAT.OPEN, 0, L.nestBase); this.mat.fill(MAT.CLAY, L.nestBase); }
    this.startGoals();
    if (!cfg.colony) for (let i = 0; i < cfg.ants; i++) this.spawn(i % 20 < 12 ? JOB.FORAGE : i % 20 < 17 ? JOB.DIG : JOB.GUARD);
    else {
      startColony(this);
      if (cfg.dayTicks > 0) startDays(this);
    }
    rebuildDirty(this, Infinity); // every field exact before the first tick
  }

  startGoals() {
    setGoal(this, SLOT.HOME, GOAL.HOME);
    setGoal(this, SLOT.EXIT, GOAL.EXIT);
    for (let p = 0; p < MAX_PILES; p++) if (this.pileAmount[p] > 0) setGoal(this, SLOT.FOOD0 + p, GOAL.FOOD, this.pileCell[p]);
  }

  /** A new ant in the home chamber, or in nest cell `cell` (a hatching pupa). Returns its index or -1 at the cap. */
  spawn(job, caste = CASTE.WORKER, team = 0, cell = -1) {
    if (this.n >= this.cfg.maxAnts) return -1;
    const i = this.n++, h = this.home, r = this.rng, A = STREAM.ants;
    if (cell >= 0) {
      const [layer, cx, cy] = cellXY(this.L, cell);
      this.layer[i] = layer; this.x[i] = cx * SUB + 128; this.y[i] = cy * SUB + 128;
    } else {
      this.layer[i] = NEST;
      // Inside the nest even where the chamber runs past its edge (same draws either way).
      const cx = h.x + below(r, A, h.w), cy = h.y + below(r, A, h.h), L = this.L;
      this.x[i] = (cx < 0 ? 0 : cx >= L.nw ? L.nw - 1 : cx) * SUB + 128;
      this.y[i] = (cy < 0 ? 0 : cy >= L.nh ? L.nh - 1 : cy) * SUB + 128;
    }
    this.heading[i] = below(r, A, ANGLES);
    this.caste[i] = caste; this.hp[i] = CASTE_HP[caste & 1]; this.team[i] = team; this.cool[i] = 0;
    this.job[i] = job; this.mode[i] = MODE.SEEK; this.carry[i] = 0; this.mem[i] = -1; this.goal[i] = -1; this.via[i] = -1;
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
      // [layer, count, x0, y0, x1, y1, ...]: a stroke on the surface, from the nest end to the far end.
      // It becomes an ordered path of open cells (trailPath); scent goes along it, and the trail's field
      // leads ants along the path in the drawn order, not straight to its end.
      const count = Math.min(e[5], 64);
      if (e[4] !== SURFACE || count < 1) return this.event(EVENT.REJECTED, e[1], e[2]);
      // Replace the oldest trail goal (lowest creation number) when all four are live.
      let slot = -1;
      for (let s = SLOT.TRAIL0; s < SLOT.TRAIL0 + SLOT.TRAILS; s++) if (!this.flow.live[s]) { slot = s; break; }
      if (slot < 0) {
        slot = SLOT.TRAIL0;
        for (let s = SLOT.TRAIL0 + 1; s < SLOT.TRAIL0 + SLOT.TRAILS; s++) if (this.flow.seq[s] < this.flow.seq[slot]) slot = s;
      }
      // Built in scratch first: a rejected stroke must leave the trail in that slot as it was.
      const F = this.flow, k = slot - SLOT.TRAIL0, len = this.trailPath(e, count, this.pathBuf, 0);
      if (len < 1) return this.event(EVENT.REJECTED, e[1], e[2]);
      F.path.set(this.pathBuf, k * PATH_MAX);
      F.pathLen[k] = len;
      for (let j = 0; j < len; j++) deposit(this, FIELD.TRAIL, F.path[k * PATH_MAX + j], TRAIL_STROKE);
      // A route on the replaced trail is gone, and so is progress on it: `best` starts again on the new path.
      for (let i = 0; i < this.n; i++) { if (this.via[i] === slot) this.via[i] = this.carry[i] ? -2 : -1; if (this.goal[i] === slot) this.goal[i] = -1; }
      this.g[G.WANT0 + k] = 0; // a new trail starts with no crew size (the sandbox), or Steady (a colony game, sim 9)
      this.g[G.LEVEL0 + k] = 0;
      for (let i = 0; i < this.n; i++) if (this.via[i] === FREE_VIA + slot) this.via[i] = this.carry[i] ? -2 : -1;
      setGoal(this, slot, GOAL.TRAIL, F.path[k * PATH_MAX + len - 1]);
      if (this.cfg.colony) this.setLevel(k, 2);
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
      if (!this.flow.live[SLOT.DIG]) setGoal(this, SLOT.DIG, GOAL.DIG);
      markKind(this, GOAL.DIG); // every DIG field, pool ones too, reads these marks
    } else if (type === CMD.ALARM) {
      // [layer, x, y, hold ticks]
      const c = cellAt(L, e[4] === NEST ? NEST : SURFACE, e[5], e[6]);
      if (c < 0 || this.mat[c] !== MAT.OPEN) return this.event(EVENT.REJECTED, e[1], e[2]);
      setGoal(this, SLOT.ALARM, GOAL.ALARM, c);
      this.g[G.ALARM_HOLD] = Math.max(1, Math.min(e[7], 400));
    } else if (type === CMD.RECALL) {
      this.g[G.RECALL] = e[4] ? 1 : 0;
    } else if (type === CMD.CREW) {
      // [trail seq, change] (seq 0: the newest trail; a trail's seq is never 0): the trail with that creation number wants `change` more ants (or fewer). From "as many as
      // come" the count starts at the ants on it now. Seekers join a trail short of its crew; one over it is sent home.
      // [trail seq, change, level] (sim 9): a level of 1 to 3 (Light, Steady, Surge) sets the crew to that share of the
      // outside workforce (setLevel) and the change is ignored; otherwise the change sets a count and clears the level.
      const F = this.flow, delta = e.length < 6 ? 0 : Math.max(-64, Math.min(64, e[5])), level = e.length < 7 ? 0 : e[6];
      let slot = -1;
      if (e[4] === 0) slot = this.newestTrail();
      else for (let s = SLOT.TRAIL0; s < SLOT.TRAIL0 + SLOT.TRAILS; s++) if (F.live[s] && F.seq[s] === (e[4] >>> 0)) slot = s;
      if (slot >= 0 && level >= 1 && level <= 3 && this.cfg.colony) return this.setLevel(slot - SLOT.TRAIL0, level);
      if (level !== 0) return this.event(EVENT.REJECTED, e[1], e[2]); // a level outside 1 to 3, or in the sandbox
      if (slot < 0 || delta === 0 || e.length < 6) return this.event(EVENT.REJECTED, e[1], e[2]);
      const k = slot - SLOT.TRAIL0, w = this.g[G.WANT0 + k];
      this.g[G.LEVEL0 + k] = 0;
      let base = w - 1;
      if (w === 0) { base = 0; for (let i = 0; i < this.n; i++) if (this.hp[i] > 0 && this.job[i] === JOB.FORAGE && this.via[i] === slot) base++; }
      this.g[G.WANT0 + k] = Math.max(0, Math.min(9999, base + delta)) + 1;
      if (this.cfg.colony) { this.g[G.WORKFORCE] = 0; this.resizeCrews(); } // the levelled crews take up what a count gives back, or give way
    } else this.event(EVENT.REJECTED, e[1], e[2]);
  }

  /** The stroke in command `e` as an ordered path of open surface cells, written to out[at ..]; returns its
   *  length (0: nothing walkable). Steps are 8-connected with the corner rule (a diagonal step whose side
   *  cells are not both open goes through an open side cell), as ants and fields move. Stroke cells that are closed, or that no ant can reach from home, are left
   *  out, and the gap they leave is bridged by the shortest way around: first inside a box of
   *  BRIDGE_MARGIN cells around the gap, then over the whole surface; a cell no bridge reaches is skipped.
   *  Where the path comes back to a cell it already holds, the loop is cut out (loop erasure), so each
   *  cell appears once and the field has one value per cell. At most PATH_MAX cells. */
  trailPath(e, count, out, at) {
    const L = this.L, sw = L.sw, pos = this.pathAt;
    let len = 0;
    const append = c => {
      if (len >= PATH_MAX) return;
      const j = pos[c];
      if (j >= 0) { for (let q = j + 1; q < len; q++) pos[out[at + q]] = -1; len = j + 1; return; }
      pos[c] = len; out[at + len++] = c;
    };
    const walkable = (x, y) => {
      const c = cellAt(L, SURFACE, x, y);
      return c >= 0 && this.mat[c] === MAT.OPEN && distAt(this, SLOT.HOME, c) !== INF ? c : -1;
    };
    const visit = (x, y) => {
      const c = walkable(x, y);
      if (c < 0 || (len && out[at + len - 1] === c)) return;
      if (len === 0) { append(c); return; }
      const last = out[at + len - 1], lx = last % sw, ly = (last - lx) / sw;
      const adx = x > lx ? x - lx : lx - x, ady = y > ly ? y - ly : ly - y;
      if (adx + ady === 1) { append(c); return; }
      if (adx === 1 && ady === 1) {
        // A diagonal step is taken as one step when both side cells are open (the corner rule ants and fields
        // keep); with one side closed it goes through the open side; with both closed it is bridged.
        const s1 = walkable(x, ly), s2 = walkable(lx, y);
        if (s1 >= 0 && s2 >= 0 && this.mat[s1] === MAT.OPEN && this.mat[s2] === MAT.OPEN) { append(c); return; }
        const side = s1 >= 0 ? s1 : s2;
        if (side >= 0) { append(side); append(c); return; }
      }
      this.bridge(last, c, append) || this.bridge(last, c, append, true);
    };
    for (let k = 0; k < count && len < PATH_MAX; k++) {
      const x0 = e[6 + 2 * k], y0 = e[7 + 2 * k];
      const x1 = k + 1 < count ? e[8 + 2 * k] : x0, y1 = k + 1 < count ? e[9 + 2 * k] : y0;
      line(x0, y0, x1, y1, visit); // a joint is visited twice; visit skips the repeat
    }
    for (let j = 0; j < len; j++) pos[out[at + j]] = -1;
    out.fill(0, at + len, at + PATH_MAX);
    return len;
  }

  /** Shortest 4-connected way over open surface cells from `a` to `b`, handed to `append` without `a`.
   *  Inside a box around both unless `wide`. Fixed neighbour order, so the same way on every machine. */
  bridge(a, b, append, wide = false) {
    const L = this.L, sw = L.sw, nb = L.nb, q = this.flow.queue, seen = this.seen, prev = this.prev;
    const mark = ++this.seenMark;
    const ax = a % sw, ay = (a - ax) / sw, bx = b % sw, by = (b - bx) / sw;
    const x0 = wide ? 0 : Math.min(ax, bx) - BRIDGE_MARGIN, x1 = wide ? sw - 1 : Math.max(ax, bx) + BRIDGE_MARGIN;
    const y0 = wide ? 0 : Math.min(ay, by) - BRIDGE_MARGIN, y1 = wide ? L.sh - 1 : Math.max(ay, by) + BRIDGE_MARGIN;
    let head = 0, tail = 0;
    seen[a] = mark; q[tail++] = a;
    while (head < tail && seen[b] !== mark) {
      const c = q[head++];
      for (let k = 0; k < 4; k++) {
        const m = nb[c * 4 + k];
        if (m < 0 || seen[m] === mark || this.mat[m] !== MAT.OPEN) continue;
        const mx = m % sw, my = (m - mx) / sw;
        if (mx < x0 || mx > x1 || my < y0 || my > y1) continue;
        seen[m] = mark; prev[m] = c; q[tail++] = m;
      }
    }
    if (seen[b] !== mark) return false;
    // Walk back from b to a, then hand the cells over start first (the queue is free again here).
    let k = 0;
    for (let c = b; c !== a; c = prev[c]) q[k++] = c;
    while (k > 0) append(q[--k]);
    return true;
  }

  event(type, a, b) {
    if (this.events.length >= EVENT_CAP * 3) { this.events.splice(0, 3); }
    this.events.push(type | 0, a | 0, b | 0);
  }

  drainEvents() { const e = this.events; this.events = []; return e; }

  /** The outside workforce (02-spec 3.2 Crews): living adults of the colony's team not nursing and not digging,
   *  including ants already on crews. */
  workforce() {
    let n = 0;
    for (let i = 0; i < this.n; i++) if (this.hp[i] > 0 && this.team[i] === 0 && (this.job[i] === JOB.FORAGE || this.job[i] === JOB.GUARD)) n++;
    return n;
  }

  /** Set trail k's crew level (1 Light, 2 Steady, 3 Surge), and work out every level's size from the workforce now,
   *  oldest trail first. More than the whole workforce over all crews: the newer crews get what is left (their cards
   *  say no free foragers). */
  setLevel(k, level) {
    this.g[G.LEVEL0 + k] = level;
    this.g[G.WORKFORCE] = 0; // a level order works every level's size out again from the workforce now
    this.resizeCrews();
  }

  /** Once a tick (colony games): when the outside workforce has changed by 10% since the levels' sizes were last
   *  worked out, work them out again, oldest trail first. */
  resizeCrews() {
    const g = this.g, F = this.flow;
    let any = false;
    for (let k = 0; k < SLOT.TRAILS; k++) if (g[G.LEVEL0 + k] && F.live[SLOT.TRAIL0 + k]) any = true;
    if (!any) return;
    const wf = this.workforce(), was = g[G.WORKFORCE];
    if (was && Math.abs(wf - was) * 10 < was) return;
    g[G.WORKFORCE] = wf;
    const order = [];
    for (let k = 0; k < SLOT.TRAILS; k++) if (g[G.LEVEL0 + k] && F.live[SLOT.TRAIL0 + k]) { order.push(k); g[G.WANT0 + k] = 1; }
    order.sort((a, b) => F.seq[SLOT.TRAIL0 + a] - F.seq[SLOT.TRAIL0 + b]);
    for (const k of order) g[G.WANT0 + k] = crewSize(this, k, wf) + 1;
  }

  /** Crew sizes on each trail and, in colony games, the free foragers and those of them not resting. */
  census() {
    this.crew.fill(0); this.freeAll = 0; this.freeOut = 0;
    for (let i = 0; i < this.n; i++) {
      if (this.hp[i] === 0 || this.job[i] !== JOB.FORAGE) continue;
      if (isTrailSlot(this.via[i])) this.crew[this.via[i] - SLOT.TRAIL0]++;
      else if (this.cfg.colony && !this.carry[i]) { this.freeAll++; if (this.mode[i] !== MODE.REST) this.freeOut++; } // free: no crew and no load (6.2)
    }
  }

  // ---- the tick ----

  step() {
    const g = this.g;
    while (this.queue.length && this.queue[0][0] === g[G.TICK]) this.applyCommand(this.queue.shift());
    if (this.cfg.colony) {
      const T = this.cfg.dayTicks, news = (p, kind) => this.event(EVENT.PILE_NEW, p, kind);
      if (T > 0) { const inDay = g[G.TICK] % T; for (const k of WINDFALL_AT) if (inDay === Math.floor((T * k) / 20) && T >= 20) windfall(this, G, setGoal, SLOT.FOOD0, GOAL.FOOD, news); }
      else if (g[G.TICK] === LATE_FIND_AT) lateFind(this, setGoal, SLOT.FOOD0, GOAL.FOOD, news); // the third pile at 2:00 (02-spec 3.2)
    }
    this.rebuildFields();
    this.stepWorld();
    if (this.cfg.colony) stepColony(this);
    this.buildBuckets();
    if (this.cfg.colony) this.resizeCrews();
    this.census();
    if (this.cfg.colony) this.openLanes();
    for (let i = 0; i < this.n; i++) this.stepAnt(i);
    fight(this);
    if (this.cfg.colony && this.cfg.dayTicks > 0) stepSpider(this, EVENT.SPIDER); // the spider comes by day (chapter 3 in the spec)
    if (this.anyDead) { this.removeDead(); this.census(); } // the counts are read between ticks too (route cards, the observer)
    if (this.cfg.colony) this.judgeJam(); // after the deaths: a queued ant killed this tick no longer waits
    stepScent(this);
    if (this.cfg.colony && this.cfg.dayTicks > 0) stepDay(this, EVENT.DUSK);
    // The last rebuild point comes after dusk (sim 11), so no field is marked and still exact at the tick boundary:
    // a snapshot rebuilds only clean fields, and a marked one is blank on both sides.
    this.rebuildFields();
    g[G.TICK]++;
  }

  /** Rebuild dirty fields. An ant following a rebuilt field forgets its closest distance, because the
   *  distances it remembered belong to the old field. (Restore rebuilds fields without this: the
   *  restored field equals the old one, so nothing is forgotten.) */
  rebuildFields() {
    rebuildDirty(this, REBUILDS, s => { for (let i = 0; i < this.n; i++) if (this.goal[i] === s) this.best[i] = INF; });
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

  /** Doors (sim 10, 02-spec 3.2): once a colony tick, before the ants move, every lane pays off LANE_RATE twentieths
   *  of its debt (6 passes a second at 20 ticks a second) and the queue count starts again. */
  openLanes() {
    const g = this.g;
    if (!this.doorCells) { const d = []; for (let c = 0; c < this.L.nestBase; c++) if (this.link[c] >= 0) d.push(c); this.doorCells = Int32Array.from(d); }
    for (let k = 0; k < 2 * DOOR_CELLS; k++) g[G.LANE0 + k] = g[G.LANE0 + k] > LANE_RATE ? g[G.LANE0 + k] - LANE_RATE : 0;
    g[G.QUEUED] = 0; this.queued.fill(0, 0, this.n);
  }

  /** Ant i at door cell c (either side) would cross. A lane with a debt of PASS or less lets her through and takes on
   *  PASS more; otherwise she queues. Under Recall the way in is not limited (the ants crossing are at the door, so
   *  within 2 cells of it: 02-spec 3.2 Recall). Entrance cells past DOOR_CELLS are not limited. */
  passDoor(i, c, layer) {
    const g = this.g, top = layer === SURFACE ? c : this.link[c], inward = layer === SURFACE ? 1 : 0;
    if (inward && g[G.RECALL]) return true;
    const D = this.doorCells;
    let k = -1;
    for (let j = 0; j < D.length && j < DOOR_CELLS; j++) if (D[j] === top) k = j;
    if (k < 0) return true;
    const lane = G.LANE0 + 2 * k + inward;
    if (g[lane] <= PASS) { g[lane] += PASS; return true; }
    if (!this.queued[i]) { this.queued[i] = 1; g[G.QUEUED]++; }
    return false;
  }

  /** After the ants move: a door is jammed once JAM_AT or more ants have queued at it for JAM_FOR ticks (02-spec 3.2),
   *  and clear when the queue drops below JAM_AT. One door for now: the colony's entrance (a second door is chapter 4). */
  judgeJam() {
    const g = this.g;
    if (g[G.QUEUED] >= JAM_AT) {
      if (g[G.JAM_RUN] < 0x7FFFFFFF) g[G.JAM_RUN]++;
      if (g[G.JAM_RUN] === JAM_FOR) { g[G.JAMMED] = 1; g[G.JAMS]++; this.event(EVENT.JAM, 1, g[G.QUEUED]); }
    } else {
      if (g[G.JAMMED]) { g[G.JAMMED] = 0; this.event(EVENT.JAM, 0, g[G.QUEUED]); }
      g[G.JAM_RUN] = 0;
    }
  }

  /** Every per-ant array, in hash order. */
  antArrays() {
    return [this.x, this.y, this.layer, this.heading, this.job, this.mode, this.carry, this.mem, this.goal, this.best, this.stall, this.since, this.lastCell, this.via, this.caste, this.hp, this.team, this.cool];
  }

  /** Remove the ants at 0 hit points, keeping the others in index order (a stable compaction). */
  removeDead() {
    const arrays = this.antArrays();
    let w = 0;
    for (let i = 0; i < this.n; i++) {
      if (this.hp[i] === 0) { if (this.job[i] === JOB.DIG && this.mode[i] === MODE.WORK) this.g[G.DIG_CREW]--; if (this.queued[i]) this.g[G.QUEUED]--; continue; } // her place in the dig crew (or the door queue) frees up
      if (w !== i) { for (const a of arrays) a[w] = a[i]; this.queued[w] = this.queued[i]; }
      w++;
    }
    this.n = w; this.anyDead = false;
  }

  stepAnt(i) {
    if (this.hp[i] === 0) return; // bitten to death this tick; removed at its end
    if (this.since[i] < 0xFFFF) this.since[i]++;
    const L = this.L, c = this.cellOfAnt(i), layer = this.layer[i], r = this.rng, A = STREAM.ants;
    let follow = -1, want = -1, speed = WALK, still = false, wander = false, back = false, slow = false;
    const atHome = distAt(this, SLOT.HOME, c) === 0;

    if (this.g[G.RECALL] && layer === SURFACE) { follow = SLOT.HOME; speed = RUN; }
    else if (this.job[i] === JOB.FORAGE) {
      if (this.mode[i] === MODE.RETURN) {
        if (atHome) {
          if (this.carry[i]) {
            this.g[G.STORES]++;
            const kind = this.carry[i] === 2 ? FOOD.PROTEIN : FOOD.SUGAR;
            this.g[kind === FOOD.PROTEIN ? G.PROTEIN_LOADS : G.SUGAR_LOADS]++;
            if (this.via[i] !== -1) this.g[G.TRAIL_LOADS]++; // her trip used a trail (the day 1 goal)
            if (this.cfg.colony) { const v = this.via[i]; this.event(EVENT.HOME, isTrailSlot(v) ? v : v >= FREE_VIA ? v - FREE_VIA : -1, kind); } // loads a minute on the route card
            if (this.via[i] === -2 || this.via[i] >= FREE_VIA) this.via[i] = -1; // a free forager picks the nearest trail again
            this.g[kind === FOOD.PROTEIN ? G.PROTEIN : G.SUGAR] += LOAD[kind];
            if (kind === FOOD.SUGAR) this.g[G.STARVE] = 0; // sugar home ends the starving, even if the colony eats it before the next check
            this.carry[i] = 0;
            if (this.cfg.colony && !isTrailSlot(this.via[i])) { this.freeAll++; this.freeOut++; } // unloaded, off any crew: free again, and out (SEEK) until who-goes says
          }
          this.setMode(i, MODE.SEEK); this.heading[i] = (this.heading[i] + 128) & 255;
          still = true;
        } else {
          follow = SLOT.HOME;
          // A carrier that came out on a trail walks it back to its start, then takes the way home. Once she
          // follows home she keeps to it for this trip, so she does not turn back at the trail's start.
          const v = this.via[i] >= FREE_VIA ? this.via[i] - FREE_VIA : this.via[i];
          if (this.via[i] >= FREE_VIA) slow = true; // a free forager walks at off-trail speed, on the trail too
          if (this.carry[i] && layer === SURFACE && v >= 0 && this.goal[i] !== SLOT.HOME) {
            // A trail waiting for its rebuild is not a reason to give it up for the trip: she keeps her heading.
            if (this.flow.blank[v]) { follow = v; back = true; }
            else { const bd = backDist(this, v, c); if (bd !== INF && bd > 0) { follow = v; back = true; } }
          }
          if (this.carry[i] && layer === SURFACE) deposit(this, FIELD.TRAIL, c, TRAIL_LAY);
        }
      } else if (this.cfg.colony) {
        const o = this.whoGoes(i, c, layer, atHome);
        follow = o.follow; want = o.want; still = o.still; wander = o.wander; slow = o.slow;
      } else if (layer === NEST) { if (this.g[G.RECALL]) { still = true; this.since[i] = 0; } else follow = SLOT.EXIT; } // under Recall foragers stay in, and their search starts when they go out
      else {
        const p = this.pileAt(c), vv = this.via[i];
        const over = isTrailSlot(vv) && this.flow.live[vv] && this.g[G.WANT0 + vv - SLOT.TRAIL0] > 0 && this.crew[vv - SLOT.TRAIL0] >= this.g[G.WANT0 + vv - SLOT.TRAIL0];
        if (p >= 0 && !over) {
          this.carry[i] = this.cfg.colony && this.pileKind[p] === FOOD.PROTEIN ? 2 : 1; /* the sandbox carries one kind */ this.mem[i] = SLOT.FOOD0 + p; this.setMode(i, MODE.RETURN); // `via` stays: her route
          this.heading[i] = (this.heading[i] + 128) & 255; this.g[G.PICKED]++;
          if (--this.pileAmount[p] === 0) { dropGoal(this, SLOT.FOOD0 + p); this.event(EVENT.PILE_EMPTY, p, 0); }
          still = true;
        } else if (this.since[i] > SEEK_GIVE_UP || (!this.flow.blank[SLOT.HOME] && distAt(this, SLOT.HOME, c) > FAR)) { // a blank home field is not "far"
          if (isTrailSlot(this.via[i])) this.crew[this.via[i] - SLOT.TRAIL0]--; // she leaves her crew now, not next tick
          this.setMode(i, MODE.RETURN); follow = SLOT.HOME; this.via[i] = -1; // nothing found: home, then out again
        } else {
          // Seeking, in order: the trail that led this ant out before (her route), the pile she took from last
          // (route memory), the newest trail along its drawn shape, then the three scent sensors (food smell
          // and trail scent), then a random walk. A trail is followed until its end is a step away.
          const m = this.mem[i], t = this.newestTrail();
          if (m >= 0 && !this.flow.live[m]) this.mem[i] = -1;
          if (this.via[i] >= 0 && !(isTrailSlot(this.via[i]) && this.flow.live[this.via[i]])) this.via[i] = -1;
          if (this.via[i] >= 0 && distAt(this, this.via[i], c) === INF) { this.crew[this.via[i] - SLOT.TRAIL0]--; this.via[i] = -1; } // her route cannot be reached from here: she frees her place
          let v = this.via[i];
          // Crews: an ant over her trail's crew size leaves it and goes home (then out again, free).
          if (v >= 0 && this.g[G.WANT0 + v - SLOT.TRAIL0] > 0 && this.crew[v - SLOT.TRAIL0] >= this.g[G.WANT0 + v - SLOT.TRAIL0]) {
            this.crew[v - SLOT.TRAIL0]--; this.via[i] = -1; this.mem[i] = -1; v = -1;
            this.setMode(i, MODE.RETURN); follow = SLOT.HOME;
          } else {
          // A free ant, or one on a trail without a crew size, joins the nearest trail short of its crew (ties: the
          // lower slot). So plus moves ants from free work and from unsized trails, never from another crew. Nearest
          // is by distance to the trail's path (0 on it; a path cell's own value is the steps left along it).
          let short = -1, ds = INF;
          if (v < 0 || this.g[G.WANT0 + v - SLOT.TRAIL0] === 0) for (let s = SLOT.TRAIL0; s < SLOT.TRAIL0 + SLOT.TRAILS; s++) {
            const w = this.g[G.WANT0 + s - SLOT.TRAIL0];
            if (s === v || !this.flow.live[s] || w === 0 || this.crew[s - SLOT.TRAIL0] >= w - 1) continue;
            const d = distAt(this, s, c); if (d === INF) continue;
            const off = d < TRAIL_OFF ? 0 : d - TRAIL_OFF;
            if (off < ds) { ds = off; short = s; }
          }
          const tAuto = t >= 0 && this.g[G.WANT0 + t - SLOT.TRAIL0] === 0; // the newest trail recruits only without a crew size
          const dv = v >= 0 ? distAt(this, v, c) : INF, dt = tAuto ? distAt(this, t, c) : INF;
          if (short >= 0) { if (v >= 0) this.crew[v - SLOT.TRAIL0]--; v = short; this.via[i] = short; this.crew[short - SLOT.TRAIL0]++; }
          const dv2 = short >= 0 ? distAt(this, short, c) : dv;
          if (short >= 0 && dv2 <= 1) { want = this.sense(i); if (want < 0) wander = true; } // she joined at the trail's end: the food is here
          else if (short >= 0) follow = short;
          else if (dv > 1 && dv !== INF) follow = v;
          else if (v < 0 && this.mem[i] >= 0 && distAt(this, m, c) !== INF) follow = m;
          else if (v < 0 && dt > 1 && dt !== INF && (this.since[i] < SEEK_GIVE_UP >> 1 || this.goal[i] === t)) { follow = t; this.via[i] = t; this.crew[t - SLOT.TRAIL0]++; }
          else { want = this.sense(i); if (want < 0) wander = true; }
          }
        }
      }
    } else if (this.job[i] === JOB.NURSE) {
      // Nurses (sim 8) stay with the brood. Feeding is the colony's store (colony.js); they are not drawn carrying.
      if (layer === SURFACE) follow = SLOT.HOME; else still = true;
    } else if (this.job[i] === JOB.DIG) {
      // A dig crew: at most 4 diggers per marked cell, and 24 in all, so a dig front does not jam the
      // tunnel to it. The rest wait at rest (in a game, the crew count shows why). Index order decides who
      // joins and who leaves, the same on every machine.
      const cap = Math.min(24, 4 * this.g[G.DIG_COUNT]);
      let d = this.g[G.DIG_COUNT] > 0 ? distAt(this, SLOT.DIG, c) : INF;
      if (this.mode[i] === MODE.WORK && (d === INF || this.g[G.DIG_CREW] > cap)) { this.setMode(i, MODE.REST); this.g[G.DIG_CREW]--; }
      else if (this.mode[i] !== MODE.WORK && d !== INF && this.g[G.DIG_CREW] < cap) { this.setMode(i, MODE.WORK); this.g[G.DIG_CREW]++; }
      if (this.mode[i] !== MODE.WORK) {
        d = INF;
        if (this.cfg.colony) { this.job[i] = JOB.FORAGE; this.setMode(i, MODE.REST); this.freeAll++; } // an auto job (sim 9): no work, she is free again
      }
      if (d === 0) { this.digAt(c); still = true; }
      else if (d !== INF) follow = SLOT.DIG;
      else if (layer === SURFACE) follow = SLOT.HOME;
      else still = true;
    } else { // guard
      const d = this.flow.live[SLOT.ALARM] ? distAt(this, SLOT.ALARM, c) : INF;
      if (d !== INF && this.g[G.RECALL] && layer === NEST && this.flow.cell[SLOT.ALARM] < this.L.nestBase) still = true; // Recall keeps guards in too
      else if (d !== INF && d > 2 * STEP) { follow = SLOT.ALARM; speed = RUN; }
      else if (d !== INF) still = true; // at the call: hold the spot
      else if (layer === SURFACE) follow = SLOT.HOME;
      else still = true;
    }

    // A goal this ant cannot reach (walled off, or on a layer with no way through) is dropped for this
    // tick, the same way on every machine: the ant wanders instead of standing still.
    let hold = false; // on a blank field: no turn, and the stall count waits too (no kick from a field's wait)
    if (follow >= 0 && this.flow.blank[follow]) { follow = -1; want = -1; wander = false; hold = true; } // blank until its rebuild (sim 11): she keeps her heading
    else if (follow >= 0 && distAt(this, follow, c) === INF) { follow = -1; wander = true; still = false; }
    if (follow >= 0) {
      if (this.goal[i] !== follow) { this.goal[i] = follow; this.best[i] = INF; }
      // `back`: walking a trail toward its start (a carrier on her way home).
      const d = back ? backDist(this, follow, c) : distAt(this, follow, c);
      if (d < this.best[i]) { this.best[i] = d; this.stall[i] = 0; }
      // Off a trail's path (pushed aside in a crowd) the value is not progress along it: there, a new cell
      // counts as progress, and `best` keeps the place reached on the path.
      else if (d >= TRAIL_OFF && d !== INF && isTrailSlot(follow) && c !== this.lastCell[i]) this.stall[i] = 0;
      const n1 = back ? backCell(this, follow, c) : nextCell(this, follow, c);
      // A trail path broken by a cell closed after it was drawn leaves a dead end: wander off it.
      if (n1 < 0) { if (isTrailSlot(follow) && d !== 0) wander = true; else still = true; }
      else if (this.link[c] === n1) { if (!this.cfg.colony || this.passDoor(i, c, layer)) { this.moveTo(i, n1); return; } still = true; } // a door lane with no room: she waits her turn
      else {
        // Aim two steps ahead when both are on this layer: ants then cut staircase corners on diagonals. On a
        // drawn bend that doubles back within one cell this cuts the bend too (measured: a lone ant passes 1.04
        // cells from the bend cell's centre). Aiming one step there cost 4 KB of S4 snapshot at 24,000 ticks
        // (60.6 to 64.9 KB, over the 64 KB line), so it is not done (sim/SPIKES.md, "Eight directions").
        const n2 = back ? backCell(this, follow, n1) : nextCell(this, follow, n1), aim = n2 >= 0 && this.link[n1] !== n2 ? n2 : n1;
        const [, ax, ay] = cellXY(L, aim);
        want = angleOf(ax * SUB + 128 - this.x[i], ay * SUB + 128 - this.y[i]);
      }
    } else {
      this.goal[i] = -1; this.best[i] = INF;
      if (still) this.stall[i] = 0;
      else if (c !== this.lastCell[i]) this.stall[i] = 0;
    }
    if (still) { this.stall[i] = 0; this.lastCell[i] = c; return; }
    if (layer === SURFACE && speed === WALK && (slow || !(isTrailSlot(follow) && distAt(this, follow, c) < TRAIL_OFF))) speed = WALK_OFF; // off a trail's path on the surface, or a free forager: 2.5 cells a second
    if (this.cfg.colony && this.g[G.SUGAR] === 0 && this.team[i] === 0) speed >>= 1; // starving: half speed (02-spec 3.2)

    // Stuck (no progress for STALL_KICK ticks): turn a random way and wander for KICK_FOR ticks, then steer
    // again; repeat every KICK_EVERY ticks while still stuck. Steering again between kicks lets an ant that a
    // crowd pushed back find its way once the crowd thins (a kick every tick was a random walk for good).
    let h = this.heading[i];
    const st = hold ? 0 : this.stall[i] < 65535 ? ++this.stall[i] : (this.stall[i] = STALL_KICK + 1), phase = st > STALL_KICK ? (st - STALL_KICK - 1) % KICK_EVERY : -1;
    if (phase === 0) h = (h + 64 + below(r, A, 128)) & 255;
    else if (phase > 0 && phase < KICK_FOR) h = (h + below(r, A, 17) - 8) & 255;
    else if (want >= 0) {
      const t = turnTo(h, want);
      h = (h + (t > TURN ? TURN : t < -TURN ? -TURN : t) + below(r, A, 5) - 2) & 255;
    } else if (wander) h = (h + below(r, A, 17) - 8) & 255;
    if (st > this.maxStall) this.maxStall = st;
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
        // Away from the other ant along the line between them (any direction, not only the axes): the push is
        // SEP_R less the distance, shared between the axes in proportion to the gaps. The distance is the
        // integer estimate max + 3/8 min (within 3% of the true distance at 45 degrees, exact on an axis).
        const far = adx > ady ? adx + ((ady * 3) >> 3) : ady + ((adx * 3) >> 3), k = SEP_R - far;
        if (k <= 0) continue;
        px += Math.trunc((dx * k) / far); py += Math.trunc((dy * k) / far);
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
    const base = baseOf(this.L, layer), lw = widthOf(this.L, layer), ox = this.x[i] >> 8, oy = this.y[i] >> 8;
    const c = base + (ny >> 8) * lw + (nx >> 8);
    if (this.mat[c] !== MAT.OPEN) return false;
    // Crossing straight into a diagonal cell passes the shared corner point. With both side cells closed that
    // is squeezing between two walls that touch at a corner, which no ant may do. With one side open, the
    // step only grazes a wall's corner and is allowed (forbidding it jams crowds at tunnel mouths).
    if ((nx >> 8) !== ox && (ny >> 8) !== oy && this.mat[base + oy * lw + (nx >> 8)] !== MAT.OPEN && this.mat[base + (ny >> 8) * lw + ox] !== MAT.OPEN) return false;
    this.x[i] = nx; this.y[i] = ny;
    return true;
  }

  /** Through an entrance: to the centre of the linked cell. */
  moveTo(i, cell) {
    const [layer, x, y] = cellXY(this.L, cell);
    this.layer[i] = layer; this.x[i] = x * SUB + 128; this.y[i] = y * SUB + 128;
    this.stall[i] = 0; this.lastCell[i] = cell;
  }

  /** Who goes (sim 9, 02-spec 6.2), for a colony game's forager that is not carrying home. In order: Recall (an ant in
   *  the nest stays in; one outside was sent home before this); a crew keeps its ants (one over its size leaves it); a
   *  free ant joins the nearest crew short of its size; a free ant in the nest takes the dig while marked cells lack
   *  diggers (one resting outside walks in for it); then free foraging: only on the nearest drawn trail, one free ant in three at a time (the rest rest by the
   *  door), at off-trail speed. Not built yet: free ants turning back at a telegraphed threat (the bird, R1 step 5).
   *  Returns the scratch object `this.o`: { follow, want, still, wander, slow }. */
  whoGoes(i, c, layer, atHome) {
    const g = this.g, F = this.flow, o = this.o ?? (this.o = {});
    o.follow = -1; o.want = -1; o.still = false; o.wander = false; o.slow = false;
    if (g[G.RECALL] && layer === NEST) { o.still = true; this.since[i] = 0; return o; }
    let v = this.via[i];
    const resting = this.mode[i] === MODE.REST;
    if (v >= FREE_VIA && !F.live[v - FREE_VIA]) v = this.via[i] = -1;
    if (isTrailSlot(v)) {
      const k = v - SLOT.TRAIL0, w = g[G.WANT0 + k];
      if (!F.live[v] || w === 0 || this.crew[k] > w - 1) { this.crew[k]--; v = this.via[i] = -1; this.freeAll++; if (!resting) this.freeOut++; } // off the crew: free
    }
    if (!isTrailSlot(v)) {
      let short = -1, ds = INF;
      for (let s = SLOT.TRAIL0; s < SLOT.TRAIL0 + SLOT.TRAILS; s++) {
        const w = g[G.WANT0 + s - SLOT.TRAIL0];
        if (!F.live[s] || w === 0 || this.crew[s - SLOT.TRAIL0] >= w - 1) continue;
        const d = layer === SURFACE ? distAt(this, s, c) : 0; if (d === INF) continue;
        const off = d < TRAIL_OFF ? 0 : d - TRAIL_OFF;
        if (off < ds) { ds = off; short = s; }
      }
      if (short >= 0) {
        this.freeAll--; if (!resting) this.freeOut--;
        v = this.via[i] = short; this.crew[short - SLOT.TRAIL0]++;
        if (resting) this.setMode(i, MODE.SEEK);
      }
    }
    if (isTrailSlot(v)) {
      if (layer === NEST) { o.follow = SLOT.EXIT; return o; }
      return this.forageOn(i, c, v, false, o);
    }
    // Free. The dig, while marked cells lack diggers (an auto job: back to free when there is none).
    const cap = Math.min(24, 4 * g[G.DIG_COUNT]);
    if (layer === NEST && g[G.DIG_COUNT] > 0 && g[G.DIG_CREW] < cap && distAt(this, SLOT.DIG, c) !== INF) {
      this.freeAll--; if (!resting) this.freeOut--;
      this.job[i] = JOB.DIG; this.setMode(i, MODE.WORK); g[G.DIG_CREW]++; this.via[i] = -1;
      o.follow = SLOT.DIG; return o;
    }
    if (layer === SURFACE && resting && g[G.DIG_COUNT] > 0 && g[G.DIG_CREW] < cap) { o.follow = SLOT.HOME; return o; } // resting outside: walk in to the dig
    const quota = Math.floor((this.freeAll + 2) / 3);
    let trail = false;
    for (let s = SLOT.TRAIL0; s < SLOT.TRAIL0 + SLOT.TRAILS; s++) if (F.live[s]) trail = true;
    if (resting && trail && this.freeOut < quota) { this.setMode(i, MODE.SEEK); this.freeOut++; }
    else if (!resting && (!trail || this.freeOut > quota)) { this.setMode(i, MODE.REST); this.freeOut--; if (this.via[i] >= FREE_VIA) this.via[i] = -1; } // over the third (a crew cut frees many at once): back to the door
    if (this.mode[i] === MODE.REST) {
      // Resting by the door: in the porch, or on the surface within 3 steps of the entrance; otherwise walk home.
      if (atHome || (layer === SURFACE && distAt(this, SLOT.EXIT, c) <= 3 * STEP)) o.still = true; else o.follow = SLOT.HOME; // `since` runs on: the idle line reads it
      return o;
    }
    if (layer === NEST) { o.follow = SLOT.EXIT; return o; }
    let t = -1, dt = INF;
    for (let s = SLOT.TRAIL0; s < SLOT.TRAIL0 + SLOT.TRAILS; s++) {
      if (!F.live[s]) continue;
      const d = distAt(this, s, c); if (d === INF) continue;
      const off = d < TRAIL_OFF ? 0 : d - TRAIL_OFF;
      // Equally near (trails drawn from the same door): the shorter trail, the nearer food.
      if (off < dt || (off === dt && t >= 0 && F.pathLen[s - SLOT.TRAIL0] < F.pathLen[t - SLOT.TRAIL0])) { dt = off; t = s; }
    }
    if (t < 0) { this.setMode(i, MODE.RETURN); this.via[i] = -1; o.follow = SLOT.HOME; return o; }
    this.via[i] = FREE_VIA + t;
    return this.forageOn(i, c, t, true, o);
  }

  /** A forager on the surface working trail `slot`: picks up at a pile, gives up after SEEK_GIVE_UP, follows the
   *  trail to its end and searches by scent there. `free`: walks at off-trail speed. */
  forageOn(i, c, slot, free, o) {
    o.slow = free;
    const p = this.pileAt(c);
    if (p >= 0) {
      this.carry[i] = this.pileKind[p] === FOOD.PROTEIN ? 2 : 1; this.mem[i] = SLOT.FOOD0 + p; this.setMode(i, MODE.RETURN);
      if (free) { this.freeAll--; this.freeOut--; } // a load: no longer free (6.2)
      this.heading[i] = (this.heading[i] + 128) & 255; this.g[G.PICKED]++;
      if (--this.pileAmount[p] === 0) { dropGoal(this, SLOT.FOOD0 + p); this.event(EVENT.PILE_EMPTY, p, 0); }
      o.still = true; return o;
    }
    if (this.since[i] > SEEK_GIVE_UP || (!this.flow.blank[SLOT.HOME] && distAt(this, SLOT.HOME, c) > FAR)) { // a blank home field is not "far"
      if (!free) { this.crew[slot - SLOT.TRAIL0]--; this.freeAll++; this.freeOut++; } // she leaves her crew now, not next tick (and rejoins at home)
      this.setMode(i, MODE.RETURN); this.via[i] = -1; o.follow = SLOT.HOME; return o; // nothing found: home
    }
    if (distAt(this, slot, c) <= 1) { o.want = this.sense(i); if (o.want < 0) o.wander = true; } // at the trail's end: the food is near
    else o.follow = slot;
    return o;
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
      markKind(this, GOAL.DIG);
      if (this.g[G.DIG_COUNT] === 0) dropGoal(this, SLOT.DIG);
      return;
    }
  }

  /** Change a cell's material (tests, tools). Keeps flow fields honest. */
  setCell(c, m) {
    const was = this.mat[c] === MAT.OPEN;
    this.mat[c] = m;
    if (was !== (m === MAT.OPEN)) { terrainChanged(this, c); this.rebuildAll(); } // between ticks: no field left marked at the boundary
  }

  /** Rebuild every marked field now (between ticks: tools and tests), forgetting followers' closest distances. */
  rebuildAll() {
    rebuildDirty(this, Infinity, s => { for (let i = 0; i < this.n; i++) if (this.goal[i] === s) this.best[i] = INF; });
  }

  // ---- hashing ----

  hashes() {
    const n = this.n, F = this.flow, S = this.scent;
    let h;
    const out = {};
    h = hashInt(0x1A, n);
    for (const a of this.antArrays()) h = hashArray(h, a, n);
    const B = this.brood;
    h = hashInt(h, B.n);
    for (const a of [B.stage, B.age, B.fed, B.hunger, B.cell]) h = hashArray(h, a, B.n);
    out.ants = finish(h);
    h = 0x5C;
    for (let f = 0; f < FIELDS; f++) h = hashArray(h, S.cur[f]);
    out.scent = finish(h);
    h = 0x7E;
    for (const a of [this.mat, this.dig, this.digWork, this.link, this.pileCell, this.pileAmount, this.pileKind]) h = hashArray(h, a);
    const r = this.nursery ?? this.home;
    for (const v of [this.home.x, this.home.y, this.home.w, this.home.h, r.x, r.y, r.w, r.h]) h = hashInt(h, v);
    out.terrain = finish(h);
    h = 0xF1;
    for (const a of [F.kind, F.live, F.dirty, F.cell, F.seq]) h = hashArray(h, a);
    for (let s = 0; s < MAX_GOALS; s++) if (F.live[s] && !F.dirty[s]) h = hashArray(h, F.dist[s]); // a marked field is blank at a tick boundary
    h = hashArray(h, F.pathLen);
    for (let k = 0; k < SLOT.TRAILS; k++) h = hashArray(h, F.path.subarray(k * PATH_MAX, k * PATH_MAX + Math.min(F.pathLen[k], PATH_MAX)));
    out.flow = finish(h);
    out.rng = finish(hashArray(0x22, this.rng));
    h = hashInt(0xE7, this.queue.length);
    for (const e of this.queue) h = hashArray(h, e);
    h = hashArray(h, Int32Array.from(this.events));
    out.events = finish(h);
    // Globals, and the settings that steer later ticks (layer sizes, the population cap, colony mode, scent).
    const c = this.cfg;
    out.globals = finish(hashArray(hashArray(0x61, this.g), Int32Array.from([c.sw, c.sh, c.nw, c.nh, c.maxAnts, c.colony ? 1 : 0, c.dayTicks, ...c.spread, ...c.halfLife])));
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
    case CMD.CREW: { // clamped before it can wrap; a level (sim 9) only when given, so older records encode as before
      const d = Number(c.delta), v = Number.isFinite(d) ? Math.max(-64, Math.min(64, Math.trunc(d))) : 0, lv = typeof c.level === 'number' ? c.level : NaN;
      return Int32Array.from(Number.isInteger(lv) && lv >= 1 && lv <= 3 ? [...head, c.seq >>> 0, v, Math.trunc(lv)] : [...head, c.seq >>> 0, v]);
    }
    default: return Int32Array.from(head);
  }
}

export { STREAMS };
