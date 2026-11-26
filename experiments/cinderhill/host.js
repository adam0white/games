// Runs the sim for the trail painter page: 20 ticks a second from the frame clock, the command log, and the
// numbers the page shows (crews, the "why" for one ant). The sim in sim/ is unchanged and pure; this file is the host.
import { Sim, JOB, MODE, CMD, EVENT, G, SLOT, MAX_PILES, SURFACE, NEST, MAT, FIELD } from './sim/sim.js';
import { cellAt } from './sim/grid.js';
import { START, STAGE } from './sim/colony.js';

export const TICK_MS = 50;
export const COUNTS = [500, 2000, 5000];
export const SEED = 2026;
export { JOB, MODE, CMD, SLOT, SURFACE, NEST, MAT, FIELD, G, MAX_PILES };
const NAMES = { [CMD.TRAIL]: 'trail', [CMD.DIG]: 'dig', [CMD.ALARM]: 'alarm', [CMD.RECALL]: 'recall' };

export class Host {
  constructor(ants = 2000, seed = SEED, { colony = false } = {}) { this.log = []; this.colony = colony; this.reset(ants, seed); }

  /** A new colony. Jobs: 17 in 20 forage, 2 dig, 1 guards. Seven in ten foragers start on the surface near the
   *  entrance and their time out is staggered, so the page opens on a busy surface rather than one wave that leaves
   *  the nest together and gives up together. This is page setup; the sim's rules are untouched. */
  reset(ants, seed = this.seed ?? SEED) {
    this.seed = seed; this.ants = ants;
    // A colony game (?colony=1): the queen, START's workers in her chamber, sugar and larvae; it grows by births.
    const sim = (this.sim = this.colony ? new Sim({ seed, ...START, colony: 1, maxAnts: 5000 }) : new Sim({ seed, ants: 0, maxAnts: Math.max(5000, ants) }));
    if (this.colony) ants = 0;
    let r = (seed * 2654435761) >>> 0 || 1;
    const rand = n => { r = (Math.imul(r, 1664525) + 1013904223) >>> 0; return (r >>> 8) % n; };
    const L = sim.L, ex = L.sw >> 1, ey = L.sh >> 1;
    for (let k = 0; k < ants; k++) {
      const job = k % 20 < 17 ? JOB.FORAGE : k % 20 < 19 ? JOB.DIG : JOB.GUARD, i = sim.spawn(job);
      if (job !== JOB.FORAGE) continue;
      sim.since[i] = rand(1100);
      if (k % 10 >= 7) continue;
      for (let tries = 0; tries < 30; tries++) {
        const x = ex - 14 + rand(29), y = ey - 14 + rand(29), c = cellAt(L, SURFACE, x, y);
        if (c < 0 || sim.mat[c] !== MAT.OPEN) continue;
        sim.layer[i] = SURFACE; sim.x[i] = x * 256 + 16 + rand(224); sim.y[i] = y * 256 + 16 + rand(224);
        sim.heading[i] = rand(256); sim.lastCell[i] = c;
        break;
      }
    }
    // Sized for the cap: in a colony game ants are born (new indices) and die (later ones move down).
    const A = sim.cfg.maxAnts;
    this.px = new Uint16Array(A); this.py = new Uint16Array(A); this.pl = new Uint8Array(A); this.pn = 0;
    this.snap();
    this.acc = 0; this.last = null; this.terrainVersion = 1; this.ticks = 0; this.tickMs = [];
    this.lastStores = 0; this.delivered = 0;
  }

  snap() { const s = this.sim, n = (this.pn = s.n); this.px.set(s.x.subarray(0, n)); this.py.set(s.y.subarray(0, n)); this.pl.set(s.layer.subarray(0, n)); }

  /** Steps the sim for the time since the last call (at most 4 ticks a frame). Returns the ticks run. */
  advance(now, paused) {
    if (this.last === null || paused) { this.last = now; return 0; }
    this.acc += Math.min(now - this.last, 250); this.last = now;
    let k = 0;
    while (this.acc >= TICK_MS && k < 4) { this.step(); this.acc -= TICK_MS; k++; }
    if (this.acc > TICK_MS) this.acc = TICK_MS; // a slow phone drops time rather than spiralling
    return k;
  }

  get alpha() { return Math.min(1, this.acc / TICK_MS); }
  get tick() { return this.sim.tick; }

  step() {
    this.snap();
    const t0 = performance.now();
    const died = this.sim.g[G.DIED];
    this.sim.step();
    const ms = performance.now() - t0;
    // A death moves the later ants down one index: their last positions no longer match, so draw this tick
    // without interpolation, and tell the page (its selected ant may now be another ant).
    if (this.sim.g[G.DIED] !== died) { this.pn = 0; this.shifted = true; }
    this.tickMs.push(ms); if (this.tickMs.length > 2000) this.tickMs.splice(0, 1000);
    this.ticks++;
    const ev = this.sim.drainEvents();
    for (let k = 0; k < ev.length; k += 3) {
      const type = ev[k];
      if (type === EVENT.DUG) this.terrainVersion++;
      else if (type === EVENT.REJECTED || type === EVENT.LATE) {
        const e = this.log.find(o => o.id === ev[k + 2]);
        if (e) e.state = type === EVENT.REJECTED ? 'rejected' : 'late';
      }
    }
    for (const e of this.log) if (e.state === 'queued' && e.tick < this.sim.tick) e.state = 'applied';
    const stores = this.sim.g[G.STORES];
    this.delivered += stores - this.lastStores; this.lastStores = stores;
  }

  /** An order for the sim: { type: CMD.X, ...payload }. Applies at the start of the next tick. */
  order(o) {
    const id = this.log.length + 1, tick = this.sim.tick;
    const ok = this.sim.queueCommand({ tick, seat: 0, id, ...o });
    const entry = { id, tick, type: NAMES[o.type], ...o, state: ok ? 'queued' : 'late' };
    delete entry.seat;
    entry.type = NAMES[o.type];
    this.log.push(entry);
    if (o.type === CMD.DIG) this.terrainVersion++;
    return entry;
  }

  /** Counts for the HUD and the crews. Linear in ants; the page asks a few times a second. */
  stats() {
    const s = this.sim, n = s.n, slots = new Int32Array(16);
    let surface = 0, carrying = 0, foragers = 0, seeking = 0, late = 0, guards = 0, guardsAt = 0, diggers = 0;
    const newest = s.newestTrail();
    for (let i = 0; i < n; i++) {
      if (s.goal[i] >= 0) slots[s.goal[i]]++;
      const out = s.layer[i] === SURFACE;
      if (out) surface++;
      if (s.carry[i]) carrying++;
      if (s.job[i] === JOB.FORAGE) {
        foragers++;
        if (out && s.mode[i] === MODE.SEEK) { seeking++; if (s.since[i] >= 600) late++; }
      } else if (s.job[i] === JOB.GUARD) guards++; else diggers++;
    }
    const F = s.flow, trails = [];
    for (let k = 0; k < SLOT.TRAILS; k++) {
      const slot = SLOT.TRAIL0 + k; if (!F.live[slot]) continue;
      const c = F.cell[slot], crew = slots[slot];
      let why = '';
      if (slot !== newest) why = 'older';
      else if (crew === 0) why = seeking === 0 ? 'noSeekers' : late >= seeking ? 'outTooLong' : 'none';
      trails.push({ slot, x: c % s.L.sw, y: Math.floor(c / s.L.sw), crew, newest: slot === newest, why, seq: F.seq[slot] });
    }
    const alarm = F.live[SLOT.ALARM] ? { cell: F.cell[SLOT.ALARM], coming: slots[SLOT.ALARM], guards, held: s.g[G.ALARM_HOLD] } : null;
    const dig = { marked: s.g[G.DIG_COUNT], crew: s.g[G.DIG_CREW], cap: Math.min(24, 4 * s.g[G.DIG_COUNT]), diggers, dug: s.g[G.DUG] };
    const piles = [];
    for (let p = 0; p < MAX_PILES; p++) if (s.pileCell[p] >= 0) piles.push({ p, x: s.pileCell[p] % s.L.sw, y: Math.floor(s.pileCell[p] / s.L.sw), amount: s.pileAmount[p], crew: slots[SLOT.FOOD0 + p] });
    let colony = null;
    if (this.colony) {
      const B = s.brood, by = [0, 0, 0];
      for (let k = 0; k < B.n; k++) by[B.stage[k]]++;
      colony = { queen: s.g[G.QUEEN], sugar: s.g[G.SUGAR], protein: s.g[G.PROTEIN], eggs: by[STAGE.EGG], larvae: by[STAGE.LARVA], pupae: by[STAGE.PUPA], born: s.g[G.BORN], lost: s.g[G.BROOD_LOST], hungry: s.g[G.HUNGRY] };
    }
    return { ants: n, surface, carrying, foragers, seeking, trails, alarm, dig, piles, picked: s.g[G.PICKED], stores: s.g[G.STORES], recall: !!s.g[G.RECALL], tick: s.tick, colony };
  }

  /** One ant, for the inspection card: what she is, what she carries, where she is going and why. Keys for words.js. */
  inspect(i) {
    const s = this.sim;
    if (i < 0 || i >= s.n) return null;
    const job = ['forager', 'digger', 'guard'][s.job[i]], goal = s.goal[i], layer = s.layer[i];
    let to = 'none';
    if (goal === SLOT.HOME) to = 'home'; else if (goal === SLOT.EXIT) to = 'exit'; else if (goal === SLOT.DIG) to = 'dig';
    else if (goal === SLOT.ALARM) to = 'alarm'; else if (goal >= SLOT.TRAIL0 && goal < SLOT.TRAIL0 + SLOT.TRAILS) to = 'trail';
    else if (goal >= SLOT.FOOD0) to = 'food';
    let why;
    if (s.g[G.RECALL] && layer === SURFACE) why = 'recalled';
    else if (s.job[i] === JOB.FORAGE) {
      if (s.mode[i] === MODE.RETURN) why = s.carry[i] ? 'carrying' : 'gaveUp';
      else if (layer === NEST) why = 'goingOut';
      else if (to === 'trail') why = 'onTrail';
      else if (to === 'food') why = 'remembers';
      else if (s.stall[i] > 20) why = 'stuck';
      else if (s.newestTrail() >= 0 && s.since[i] >= 600) why = 'tooLongForTrail';
      else why = 'searching';
    } else if (s.job[i] === JOB.DIG) {
      if (s.mode[i] === MODE.WORK) why = to === 'dig' ? 'toDig' : 'digging';
      else why = s.g[G.DIG_COUNT] > 0 ? 'crewFull' : 'noDig';
    } else {
      if (!s.flow.live[SLOT.ALARM]) why = 'noAlarm';
      else why = to === 'alarm' ? 'toAlarm' : 'atAlarm';
    }
    return { i, job, carry: !!s.carry[i], to, why, layer, stall: s.stall[i], x: s.x[i] / 256, y: s.y[i] / 256 };
  }

  /** Mean, p95 and max of the sim's tick time so far (ms). */
  tickStats() {
    const a = this.tickMs.slice().sort((p, q) => p - q);
    if (!a.length) return null;
    return { n: a.length, mean: a.reduce((p, q) => p + q, 0) / a.length, p95: a[Math.floor(a.length * 0.95)], max: a[a.length - 1] };
  }
}
