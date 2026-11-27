// Runs the sim for the trail painter page: 20 ticks a second from the frame clock, the command log, and the
// numbers the page shows (crews, the "why" for one ant). The sim in sim/ is unchanged and pure; this file is the host.
import { Sim, JOB, MODE, CMD, EVENT, G, SLOT, MAX_PILES, SURFACE, NEST, MAT, FIELD, FREE_VIA, LEVEL_SHARE } from './sim/sim.js';
import { cellAt } from './sim/grid.js';
import { START, STAGE, dayState } from './sim/colony.js';
import { restore, snapshot } from './sim/snapshot.js';

export const TICK_MS = 50;
export const COUNTS = [500, 2000, 5000];
export const SEED = 2026;
export { JOB, MODE, CMD, SLOT, SURFACE, NEST, MAT, FIELD, G, MAX_PILES };
const NAMES = { [CMD.TRAIL]: 'trail', [CMD.DIG]: 'dig', [CMD.ALARM]: 'alarm', [CMD.RECALL]: 'recall', [CMD.CREW]: 'crew' };

export class Host {
  constructor(ants = 2000, seed = SEED, { colony = false, dayTicks } = {}) { this.log = []; this.colony = colony; this.dayTicks = dayTicks; this.reset(ants, seed); }

  /** A new colony. Jobs: 17 in 20 forage, 2 dig, 1 guards. Seven in ten foragers start on the surface near the
   *  entrance and their time out is staggered, so the page opens on a busy surface rather than one wave that leaves
   *  the nest together and gives up together. This is page setup; the sim's rules are untouched. */
  reset(ants, seed = this.seed ?? SEED) {
    this.seed = seed; this.ants = ants;
    // A colony game (?colony=1): sim 8's start (colony.js START, 02-spec 3.2) in a 192 by 64 nest, with no days unless
    // the page asks for them (?day=, dayTicks): the chapters that replace days are not built.
    const sim = (this.sim = this.colony ? new Sim({ seed, ...START, colony: 1, maxAnts: 5000, nh: 64, dayTicks: this.dayTicks || 0 }) : new Sim({ seed, ants: 0, maxAnts: Math.max(5000, ants) }));
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
    this.attach();
    this.acc = 0; this.last = null; this.terrainVersion = 1; this.ticks = 0; this.tickMs = [];
    this.homeAt = []; // [tick, trail slot, trail seq] of each load home by a trail in the last minute (route cards)
    // Days (colony.js): the dawn save of each day still open to a restart (today's, and yesterday's until the
    // player picks at dusk), and the dusk that has just happened, until the page has shown it. A dawn save is
    // { bytes, log: the order log's length then, delivered }.
    this.dawns = new Map(); this.dusk = null; this.spiderNews = []; this.pileNews = []; // spider.js and windfall events for the page: { state, arg, tick }, { pile, kind, tick }
    if (this.colony) this.saveDawn();
  }

  /** Buffers for the sim in this.sim. Sized for the cap: in a colony game ants are born (new indices) and die
   *  (later ones move down). */
  attach() {
    const A = this.sim.cfg.maxAnts;
    this.px = new Uint16Array(A); this.py = new Uint16Array(A); this.pl = new Uint8Array(A); this.pn = 0;
    this.snap();
    this.lastStores = this.sim.g[G.STORES]; this.delivered = 0;
  }

  /** Keeps today's dawn save. At a dusk it is taken when the player goes on, not at the dusk tick, so orders the
   *  page queues on the way to the card (an alarm let go) are in it and a restarted day replays them. */
  saveDawn() { this.dawns.set(this.sim.g[G.DAY], { bytes: snapshot(this.sim), log: this.log.length, delivered: this.delivered }); }

  /** Today's goal and progress (colony.js dayState), or null in the sandbox. */
  day() { return this.colony && this.sim.cfg.dayTicks > 0 ? dayState(this.sim) : null; }

  /** Back to the dawn of `day` (02-spec 6.9: the dawn save is always kept). Orders given since are gone from the
   *  sim; the log keeps them, marked. Returns false when that dawn is not kept. */
  restartDay(day) {
    const save = this.dawns.get(day);
    if (!save) return false;
    this.sim = restore(save.bytes);
    for (const [d] of this.dawns) if (d > day) this.dawns.delete(d);
    // Orders given after the save are gone; orders in the save still waiting for their tick run again.
    this.log.forEach((e, k) => { if (k >= save.log) e.state = 'undone'; else if (e.tick >= this.sim.tick) e.state = 'queued'; });
    this.attach(); this.delivered = save.delivered; this.dusk = null; this.spiderNews = []; this.pileNews = []; this.homeAt = this.homeAt.filter(h => h[0] <= this.sim.tick); this.shifted = true; this.terrainVersion++; this.acc = 0; this.last = null;
    return true;
  }

  /** The player chose to go on after a dusk: yesterday's dawn is no longer offered. */
  goOn() {
    const today = this.sim.g[G.DAY];
    for (const [d] of this.dawns) if (d < today) this.dawns.delete(d);
    this.saveDawn(); this.dusk = null;
  }

  snap() { const s = this.sim, n = (this.pn = s.n); this.px.set(s.x.subarray(0, n)); this.py.set(s.y.subarray(0, n)); this.pl.set(s.layer.subarray(0, n)); }

  /** Steps the sim for the time since the last call (at most 4 ticks a frame, times the view speed). Returns the
   *  ticks run. `speed` (1, 2 or 4) is the page's view speed: more ticks per second of the same sim, so it changes
   *  no hash and needs nothing from a room (solo play only). */
  advance(now, paused) {
    if (this.last === null || paused || this.dusk) { this.last = now; return 0; }
    const x = this.speed ?? 1;
    this.acc += Math.min(now - this.last, 250) * x; this.last = now;
    let k = 0;
    while (this.acc >= TICK_MS && k < 4 * x && !this.dusk) { this.step(); this.acc -= TICK_MS; k++; }
    if (this.dusk) this.acc = 0; // time stops at dusk until the page moves on
    if (this.acc > TICK_MS) this.acc = TICK_MS; // a slow phone drops time rather than spiralling
    return k;
  }

  get alpha() { return Math.min(1, this.acc / TICK_MS); }
  get tick() { return this.sim.tick; }

  step() {
    this.snap();
    const t0 = performance.now();
    const died = this.sim.anyDead ? -1 : this.sim.g[G.DIED]; // a death may already be pending (hurt between ticks)
    this.sim.step();
    const ms = performance.now() - t0;
    // A death moves the later ants down one index: their last positions no longer match, so draw this tick
    // without interpolation, and tell the page (its selected ant may now be another ant).
    if (this.sim.g[G.DIED] !== died) { this.pn = 0; this.shifted = true; }
    this.tickMs.push(ms); if (this.tickMs.length > 2000) this.tickMs.splice(0, 1000);
    this.ticks++;
    const ev = this.sim.drainEvents();
    this.lastEvents = [];
    for (let k = 0; k < ev.length; k += 3) {
      const type = ev[k];
      this.lastEvents.push([type, ev[k + 1], ev[k + 2]]);
      if (type === EVENT.HOME) { if (ev[k + 1] >= 0) this.homeAt.push([this.sim.tick, ev[k + 1], this.sim.flow.seq[ev[k + 1]]]); continue; }
      if (type === EVENT.PILE_NEW) this.pileNews.push({ pile: ev[k + 1], kind: ev[k + 2], tick: this.sim.tick });
      if (type === EVENT.DUG) this.terrainVersion++;
      else if (type === EVENT.SPIDER) this.spiderNews.push({ state: ev[k + 1], arg: ev[k + 2], tick: this.sim.tick });
      else if (type === EVENT.DUSK) {
        // The sim is now at the next dawn: what the page shows on the dusk card (its save is taken at goOn).
        const s = this.sim, d = ev[k + 1];
        this.dusk = { day: d, won: !!ev[k + 2], goal: s.lastDusk, ants: s.n, sugar: s.g[G.SUGAR], protein: s.g[G.PROTEIN], born: s.g[G.BORN], lost: s.g[G.BROOD_LOST], next: dayState(s) };
      }
      else if (type === EVENT.REJECTED || type === EVENT.LATE) {
        const e = this.log.find(o => o.id === ev[k + 2]);
        if (e) e.state = type === EVENT.REJECTED ? 'rejected' : 'late';
      }
    }
    for (const e of this.log) if (e.state === 'queued' && e.tick < this.sim.tick) e.state = 'applied';
    while (this.homeAt.length && this.homeAt[0][0] <= this.sim.tick - 1200) this.homeAt.shift();
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
    const onIt = new Int32Array(SLOT.TRAILS), freeOn = new Int32Array(SLOT.TRAILS);
    let resting = 0;
    for (let i = 0; i < n; i++) {
      if (s.goal[i] >= 0) slots[s.goal[i]]++;
      if (s.hp[i] > 0 && s.job[i] === JOB.FORAGE && s.via[i] >= SLOT.TRAIL0 && s.via[i] < SLOT.TRAIL0 + SLOT.TRAILS) onIt[s.via[i] - SLOT.TRAIL0]++;
      if (s.hp[i] > 0 && s.job[i] === JOB.FORAGE && s.via[i] >= FREE_VIA && s.mode[i] !== MODE.REST) freeOn[s.via[i] - FREE_VIA - SLOT.TRAIL0]++;
      if (this.colony && s.hp[i] > 0 && s.job[i] === JOB.FORAGE && s.mode[i] === MODE.REST && s.goal[i] < 0) resting++; // at the door, not walking back to it
      const out = s.layer[i] === SURFACE;
      if (out) surface++;
      if (s.carry[i]) carrying++;
      if (s.job[i] === JOB.FORAGE) {
        foragers++;
        if (out && s.mode[i] === MODE.SEEK) { seeking++; if (s.since[i] >= 300) late++; } // past half of SEEK_GIVE_UP (sim.js): too late to take the newest trail
      } else if (s.job[i] === JOB.GUARD) guards++; else if (s.job[i] === JOB.DIG) diggers++;
    }
    const F = s.flow, trails = [];
    for (let k = 0; k < SLOT.TRAILS; k++) {
      const slot = SLOT.TRAIL0 + k; if (!F.live[slot]) continue;
      const c = F.cell[slot], crew = slots[slot], w = s.g[G.WANT0 + k]; // w: crew size plus one; 0: none
      let why = '';
      if (this.colony) {
        // Who goes (sim 9): a crew short of its size has a reason when no free ant is left to fill it.
                // A level whose share the older crews have taken, wholly or in part, says so too.
        const lv = s.g[G.LEVEL0 + k], wf = s.g[G.WORKFORCE], share = lv && wf > 0 ? Math.max(1, Math.floor((wf * LEVEL_SHARE[lv] + 50) / 100)) : 0;
        if (w && ((lv && w - 1 < share) || (onIt[k] < w - 1 && s.freeAll === 0))) why = 'noFree';
        if (s.g[G.JAMMED]) why = 'jammed'; // sim 10: the door holds every route up (one door for now)
      } else if (slot !== newest && !w && onIt[k] === 0) why = 'older'; // no crew size and no one on it: free ants go to the newest
      else if (crew === 0) why = seeking === 0 ? 'noSeekers' : late >= seeking ? 'outTooLong' : 'none';
      // Loads a minute: those home by this trail in the last minute (or since it was drawn, scaled to a minute).
      const loads = this.homeAt.reduce((a, h) => a + (h[1] === slot && h[2] === F.seq[slot] ? 1 : 0), 0);
      trails.push({ slot, x: c % s.L.sw, y: Math.floor(c / s.L.sw), crew, on: onIt[k], free: freeOn[k], want: w ? w - 1 : null, level: s.g[G.LEVEL0 + k], loads, newest: slot === newest, why, seq: F.seq[slot] });
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
    return { ants: n, surface, carrying, foragers, seeking, resting, queued: this.colony ? s.g[G.QUEUED] : 0, jammed: this.colony && !!s.g[G.JAMMED], trails, alarm, dig, piles, picked: s.g[G.PICKED], stores: s.g[G.STORES], recall: !!s.g[G.RECALL], tick: s.tick, colony };
  }

  /** One ant, for the inspection card: what she is, what she carries, where she is going and why. Keys for words.js. */
  inspect(i) {
    const s = this.sim;
    if (i < 0 || i >= s.n) return null;
    const job = ['forager', 'digger', 'guard', 'nurse'][s.job[i]], goal = s.goal[i], layer = s.layer[i];
    let to = 'none';
    if (goal === SLOT.HOME) to = 'home'; else if (goal === SLOT.EXIT) to = 'exit'; else if (goal === SLOT.DIG) to = 'dig';
    else if (goal === SLOT.ALARM) to = 'alarm'; else if (goal >= SLOT.TRAIL0 && goal < SLOT.TRAIL0 + SLOT.TRAILS) to = 'trail';
    else if (goal >= SLOT.FOOD0) to = 'food';
    let why;
    if (s.g[G.RECALL] && layer === SURFACE) why = 'recalled';
    else if (s.job[i] === JOB.FORAGE) {
      if (s.queued[i]) why = 'queued'; // waiting at a door lane (sim 10)
      else if (s.mode[i] === MODE.REST) why = goal >= 0 ? 'toRest' : 'resting'; // free: walking back to the door, or by it (sim 9)
      else if (s.mode[i] === MODE.RETURN) why = s.carry[i] ? 'carrying' : 'gaveUp';
      else if (layer === NEST) why = s.g[G.RECALL] ? 'waitingIn' : 'goingOut';
      else if (to === 'trail') why = 'onTrail';
      else if (to === 'food') why = 'remembers';
      else if (s.stall[i] > 20) why = 'stuck';
      else if (s.newestTrail() >= 0 && s.since[i] >= 300) why = 'tooLongForTrail';
      else why = 'searching';
    } else if (s.job[i] === JOB.DIG) {
      if (s.mode[i] === MODE.WORK) why = to === 'dig' ? 'toDig' : 'digging';
      else why = s.g[G.DIG_COUNT] > 0 ? 'crewFull' : 'noDig';
    } else if (s.job[i] === JOB.NURSE) why = 'nursing';
    else {
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
