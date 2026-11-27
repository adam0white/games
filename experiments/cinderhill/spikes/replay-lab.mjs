// Replays a Cinderhill game-lab record in Node and writes what happened in it.
// Usage: node replay-lab.mjs <record.json> [more parts.json ...] [--out=report.md] [--json=stats.json]
// A record file is the gunzipped JSON the lab stored: one record ({ v, kind: 'run', data }), its data, or an array of
// them. Parts of one long session (labrec.js rolls a run over near the kit's limits) may be in several files; they are
// joined by chain id in part order. The game is made again with host.js and every logged order, go-on and restart is
// replayed at its tick. Each 30 s sample's hash, each part's start hash and the final hash are checked: the first
// mismatch is the divergence. The report covers per-minute deliveries by food, idle and working ants, every trail (ants
// on it, trips, time to the first delivery, how it ended), digs and what they opened, alarms and recalls with their
// effect, brood and caste growth, deaths, and stalls (60 s with no delivery, no digging, no birth and no order).
import { readFileSync, writeFileSync } from 'node:fs';
import { Host } from '../host.js';
import { CMD, EVENT, FOOD, FREE_VIA, G, JOB, MAT, MODE, NEST, SIM_VERSION, SLOT, STAGE, SURFACE } from '../sim/sim.js';
import { SPIDER } from '../sim/spider.js';
import { PATH_MAX } from '../sim/flow.js';
import { cellAt } from '../sim/grid.js';
import { FORMAT } from '../labrec.js';

const MINUTE = 1200, STALL = 1200, AFTER = 200, LOOK_EVERY = 20, IDLE_FOR = 200, GAP_FOR = 5; // IDLE_FOR: 10 s (02-spec 3.1, wasted labour); GAP_FOR: a quarter second (the 1-tick refill is 1 to 2 ticks: NOTES, Who goes)

/** Records (any of the shapes above) to the parts of each chain, in order. */
export function parts(records) {
  const out = [];
  const visit = r => { if (Array.isArray(r)) return r.forEach(visit); if (!r || typeof r !== 'object') return; if (r.data && r.kind) return visit(r.data); if (r.start?.format === FORMAT) out.push(r); };
  visit(records);
  const chains = new Map();
  for (const d of out) { const k = d.start.chain; if (!chains.has(k)) chains.set(k, []); chains.get(k).push(d); }
  return [...chains.values()].map(list => { list.sort((a, b) => a.start.part - b.start.part); return list; });
}

/** Replays one chain. Returns { ok, divergence, checks, stats, report }. */
export function replayChain(chain, { stopAtDivergence = false } = {}) {
  const s0 = chain[0].start, notes = [];
  if (s0.sim !== SIM_VERSION) notes.push(`recorded on sim ${s0.sim}; this checkout is sim ${SIM_VERSION}: hashes will not match`);
  for (let k = 0; k < chain.length; k++) if (chain[k].start.part !== k + 1) notes.push(`part ${k + 1} is missing; replay stops before it`);
  const host = new Host(s0.ants, s0.seed, { colony: !!s0.colony, dayTicks: s0.dayTicks ?? undefined });
  const obs = new Observer(host);
  let divergence = null, checks = 0;
  const check = (what, tick, want) => {
    if (want === undefined || want === null) return;
    checks++;
    const got = host.sim.hashes().total;
    if (got !== want && !divergence) divergence = { what, tick, want, got };
  };
  const stepTo = t => {
    if (host.tick > t) throw new Error(`the record goes back to tick ${t} from ${host.tick} without a restart`);
    while (host.tick < t) { obs.before(); host.step(); obs.after(); }
  };
  let end = null;
  for (let k = 0; k < chain.length && chain[k].start.part === k + 1; k++) {
    const d = chain[k];
    stepTo(d.start.from); check(`part ${d.start.part} start`, d.start.from, d.start.hash);
    for (const ev of d.events ?? []) {
      if (stopAtDivergence && divergence) break;
      const x = ev.data;
      if (ev.type === 'log') for (const e of x.e) {
        stepTo(e[1]);
        if (e[0] === 'o') { const entry = host.order(e[2]); obs.order(e[2], entry); }
        else if (e[0] === 'g') { host.goOn(); obs.mark('go on', host.tick); }
        else if (e[0] === 'r') { host.restartDay(e[2]); obs.restart(e[2], host.tick); }
      }
      else if (ev.type === 'sample') { stepTo(x.at); check('sample', x.at, x.hash); obs.page(x); }
      else if (ev.type === 'hold' || ev.type === 'hide' || ev.type === 'show' || ev.type === 'error' || ev.type === 'cam') obs.pageEvent(ev.type, x);
      else if (ev.type === 'dusk') obs.mark(`dusk day ${x.day}: ${x.won ? 'won' : 'lost'}`, host.tick);
    }
    if (d.summary?.tick !== undefined) { stepTo(d.summary.tick); check(d.outcome === 'continued' ? `part ${d.start.part} end` : 'final', d.summary.tick, d.summary.hash); end = d.summary; }
  }
  obs.finish();
  const stats = obs.stats();
  return { ok: !divergence && checks > 0, divergence, checks, notes, start: s0, summary: end, stats, report: report(s0, end, divergence, checks, notes, stats, chain.length) };
}

/** Watches the replay tick by tick. Also used live by the pace gate's bots (pace-gate.mjs), on the same Host calls.
 *  For the pace gate (02-spec 3.1) it keeps births, decision events and the idle share:
 *  - births: the play step of each birth (G.BORN going up). deliveries: the steps with a load home, first 2 min.
 *  - decisions: { step, what } for each decision event the current build has: a new source seen (the piles there at
 *    the start, then each new pile), a source empty, a threat telegraphed (the spider's warning), a threat arrived (it hunts) and resolved
 *    (it leaves), and brood short of protein (larvae waiting and no protein in store, each time it starts).
 *    The spec's other kinds (room full, rain, route jammed, build offered, sprout) are not built.
 *  - idle: at each look, the share of adults that are idle while some job has a gap. Idle: a forager with no load,
 *    no route (no crew trail, no free trail) and no goal (02-spec 3.1: one walking in to the dig is not idle) who has rested, or searched with no remembered pile and no find,
 *    for IDLE_FOR ticks (her search timer; resting does not reset it), or a digger resting
 *    for IDLE_FOR ticks. A gap (hasGap), once it has lasted GAP_FOR ticks: a live trail
 *    with no crew size or short of it, or marked dig cells with room in the dig crew. */
export class Observer {
  constructor(host) {
    this.h = host; this.steps = 0; this.minutes = []; this.trails = []; this.digs = []; this.alarms = []; this.recalls = []; this.marks = []; this.stalls = [];
    this.pageData = { samples: 0, fps: [], holds: [], hides: 0, errors: [], cams: 0 };
    this.prevCarry = new Uint8Array(0); this.prevVia = new Int8Array(0); this.prevN = 0;
    this.lastChange = 0; this.lastKey = ''; this.lastOrderStep = 0; this.pendingTrails = [];
    this.births = []; this.decisions = []; this.idleMax = 0; this.idleSum = 0; this.idleLooks = 0; this.firstOrder = -1; this.hungry = false; this.bornSeen = this.s.g[G.BORN]; this.deliveries = []; this.firstTrailProtein = -1; this.queuedSum = 0; this.outsideSum = 0; this.queuedMax = 0; this.jams = 0; this.loadsSeen = this.s.g[G.SUGAR_LOADS] + this.s.g[G.PROTEIN_LOADS];
    this.newMinute();
    for (let p = 0; p < this.s.pileCell.length; p++) if (this.s.pileCell[p] >= 0 && this.s.pileAmount[p] > 0) { this.decisions.push({ step: 0, what: 'new source' }); break; }
  }
  get s() { return this.h.sim; }
  newMinute() {
    const g = this.s.g;
    this.cur = { from: this.steps, tick: this.s.tick, sugar0: g[G.SUGAR_LOADS], protein0: g[G.PROTEIN_LOADS], died0: g[G.DIED], born0: g[G.BORN], lost0: g[G.BROOD_LOST], dug0: g[G.DUG], idle: 0, working: 0, other: 0, queued: 0, looks: 0 };
  }
  before() {
    const s = this.s, n = s.n;
    if (this.prevCarry.length < n) { this.prevCarry = new Uint8Array(s.cfg.maxAnts); this.prevVia = new Int8Array(s.cfg.maxAnts); }
    this.prevCarry.set(s.carry.subarray(0, n)); this.prevVia.set(s.via.subarray(0, n)); this.prevN = n; this.died = s.g[G.DIED];
  }
  after() {
    const s = this.s, g = s.g; this.steps++;
    if (g[G.BORN] < this.bornSeen) this.bornSeen = g[G.BORN]; // a restart rolled the counters back
    for (; this.bornSeen < g[G.BORN]; this.bornSeen++) this.births.push(this.steps);
    const loads = g[G.SUGAR_LOADS] + g[G.PROTEIN_LOADS]; if (loads < this.loadsSeen) this.loadsSeen = loads;
    if (loads > this.loadsSeen && this.steps <= 2 * MINUTE) this.deliveries.push(this.steps); this.loadsSeen = loads; // the first 2 min, for the quiet-stretch line
    for (const e of this.h.lastEvents ?? []) {
      const what = e[0] === EVENT.PILE_NEW ? 'new source' : e[0] === EVENT.PILE_EMPTY ? 'source empty' : e[0] === EVENT.SPIDER && e[1] === SPIDER.WARN ? 'threat telegraphed' : e[0] === EVENT.SPIDER && e[1] === SPIDER.HUNT ? 'threat arrived' : e[0] === EVENT.SPIDER && e[1] === SPIDER.LEFT ? 'threat resolved' : e[0] === EVENT.JAM && e[1] === 1 ? 'route jammed' : null;
      if (e[0] === EVENT.JAM && e[1] === 1) this.jams++;
      if (what) this.decisions.push({ step: this.steps, what });
    }
    let larvae = 0; for (let k = 0; k < (s.brood?.n ?? 0); k++) if (s.brood.stage[k] === STAGE.LARVA) larvae++;
    const hungry = larvae > 0 && g[G.PROTEIN] <= 0;
    if (hungry && !this.hungry) this.decisions.push({ step: this.steps, what: 'brood short of protein' });
    this.hungry = hungry;
    // A trail applied this tick: the newest trail's sequence number changed.
    const done = this.pendingTrails.filter(p => p.entry.state !== 'queued');
    if (done.length) { this.pendingTrails = this.pendingTrails.filter(p => p.entry.state === 'queued'); this.trailsApplied(done); }
    // Trips: an ant that carried with a trail route and carries nothing now, when no death renumbered the ants.
    // Births append new ants after the old ones, so they renumber no one.
    // A colony game (sim 9) says which trail each load came home by (EVENT.HOME): the trail in that slot now, or -1
    // when her trail was replaced on the way; that holds on a tick with a death too.
    if (s.cfg?.colony && SIM_VERSION >= 9) {
      for (const e of this.h.lastEvents ?? []) if (e[0] === EVENT.HOME && e[1] >= 0) {
        const t = this.liveTrail(e[1]);
        if (t && t.seq === s.flow.seq[e[1]]) { t.trips++; if (t.first < 0) t.first = this.steps - t.step; if (e[2] === FOOD.PROTEIN && this.firstTrailProtein < 0) this.firstTrailProtein = this.steps; }
      }
    } else if (g[G.DIED] === this.died && s.n >= this.prevN) {
      for (let i = 0; i < this.prevN; i++) if (this.prevCarry[i] && !s.carry[i]) {
        const v = this.prevVia[i], t = v >= FREE_VIA ? this.liveTrail(v - FREE_VIA) : v >= 0 ? this.liveTrail(v) : null; // a free forager's load counts for the trail she worked
        if (t) { t.trips++; if (t.first < 0) t.first = this.steps - t.step; if (this.prevCarry[i] === 2 && this.firstTrailProtein < 0) this.firstTrailProtein = this.steps; }
      }
    } else this.unattributed = (this.unattributed ?? 0) + 1;
    for (const t of this.trails) if (t.end < 0 && (!s.flow.live[t.slot] || s.flow.seq[t.slot] !== t.seq)) { t.end = this.steps; t.how = s.flow.live[t.slot] ? 'replaced' : 'dropped'; }
    this.gapRun = this.hasGap() ? (this.gapRun ?? 0) + 1 : 0;
    if (this.steps % LOOK_EVERY === 0) this.look();
    for (const d of this.digs) if (d.done < 0) { const open = d.cells.filter(c => s.mat[c] === MAT.OPEN).length; if (open > d.open) { d.open = open; if (d.first < 0) d.first = this.steps - d.step; } if (open === d.cells.length) d.done = this.steps - d.step; }
    for (const a of this.alarms) if (this.steps - a.step === AFTER && a.cell >= 0) a.near = this.near(a.cell, 6);
    for (const r of this.recalls) {
      const dt = this.steps - r.step;
      if (dt === AFTER) r.after = this.surface();
      if (r.on && r.clear < 0 && this.surface() <= Math.floor(r.before / 10)) r.clear = dt;
    }
    const key = `${g[G.STORES]},${g[G.DUG]},${g[G.BORN]},${this.lastOrderStep}`;
    if (key !== this.lastKey) { if (this.steps - this.lastChange >= STALL) this.stalls.push({ from: this.lastChange, to: this.steps, tick: s.tick }); this.lastKey = key; this.lastChange = this.steps; }
    if (this.steps - this.cur.from >= MINUTE) this.closeMinute();
  }
  look() {
    const s = this.s; let idle = 0, working = 0, other = 0;
    const queued = s.queued;
    let q = 0, outside = 0;
    for (let i = 0; i < s.n; i++) {
      if (s.layer[i] === SURFACE) outside++;
      if (queued?.[i]) { q++; if (s.layer[i] !== SURFACE) outside++; continue; } // queued at a door: counted apart (02-spec 3.1), not idle
      if (s.carry[i] || s.mode[i] === MODE.WORK || s.via[i] >= 0 || s.goal[i] === SLOT.ALARM) working++;
      else if (s.mode[i] === MODE.REST || (s.mode[i] === MODE.SEEK && s.since[i] >= 600)) idle++;
      else other++;
    }
    this.cur.idle += idle; this.cur.working += working; this.cur.other += other; this.cur.queued += q; this.cur.looks++;
    // Queued at doors, outside a jam (02-spec 3.1): ants waiting at a door lane over the ants out or waiting to go out
    // (on the surface, or queued inside), summed over the looks.
    if (!s.g[G.JAMMED]) { this.queuedSum += q; this.outsideSum += outside; if (outside && q / outside > this.queuedMax) this.queuedMax = q / outside; }
    // The pace gate's idle share (02-spec 3.1): idle for IDLE_FOR ticks while some job has a gap.
    const gap = this.gapRun >= GAP_FOR;
    let wasted = 0;
    if (gap) for (let i = 0; i < s.n; i++) if (!queued?.[i] && ((s.job[i] === JOB.FORAGE && !s.carry[i] && s.via[i] < 0 && s.goal[i] < 0 && (s.mode[i] === MODE.REST || (s.mode[i] === MODE.SEEK && s.mem[i] < 0)) && s.since[i] >= IDLE_FOR) || (s.job[i] === JOB.DIG && (s.mode[i] === MODE.REST || (s.mode[i] === MODE.SEEK && s.g[G.DIG_COUNT] === 0)) && s.since[i] >= IDLE_FOR))) wasted++;
    const share = s.n ? wasted / s.n : 0;
    if (share > this.idleMax) this.idleMax = share;
    this.idleSum += share; this.idleLooks++;
    for (const t of this.trails) if (t.end < 0) { const on = this.count(i => s.via[i] === t.slot); t.onSum += on; t.looks++; if (on > t.onMax) t.onMax = on; }
  }
  /** A job short of hands: a live trail with no crew size or short of it, or marked dig cells with room in the dig
   *  crew. The idle line counts it once it has lasted GAP_FOR ticks: a crew member who gives up leaves her crew one
   *  short until a resting ant takes her place on the next tick, and that is not a job waiting for hands. */
  hasGap() {
    const s = this.s, F = s.flow;
    if (s.g[G.DIG_COUNT] > 0 && s.g[G.DIG_CREW] < Math.min(24, 4 * s.g[G.DIG_COUNT])) return true;
    for (let k = 0; k < SLOT.TRAILS; k++) if (F.live[SLOT.TRAIL0 + k]) { const w = s.g[G.WANT0 + k]; if (w === 0 || s.crew[k] < w - 1) return true; }
    return false;
  }
  closeMinute() {
    const s = this.s, g = s.g, c = this.cur, b = [0, 0, 0];
    for (let k = 0; k < (s.brood?.n ?? 0); k++) b[s.brood.stage[k]]++;
    let majors = 0; for (let i = 0; i < s.n; i++) if (s.caste[i] & 1) majors++;
    const L = Math.max(1, c.looks);
    this.minutes.push({ minute: this.minutes.length + 1, tick: s.tick, sugar: g[G.SUGAR_LOADS] - c.sugar0, protein: g[G.PROTEIN_LOADS] - c.protein0, idle: Math.round(c.idle / L), working: Math.round(c.working / L), other: Math.round(c.other / L), queued: Math.round(c.queued / L),
      workers: s.n - majors, majors, eggs: b[STAGE.EGG], larvae: b[STAGE.LARVA], pupae: b[STAGE.PUPA], born: g[G.BORN] - c.born0, died: g[G.DIED] - c.died0, broodLost: g[G.BROOD_LOST] - c.lost0, dug: g[G.DUG] - c.dug0, sugarStore: g[G.SUGAR], proteinStore: g[G.PROTEIN] });
    this.newMinute();
  }
  order(o, entry) {
    const s = this.s; this.lastOrderStep = this.steps; if (this.firstOrder < 0) this.firstOrder = this.steps;
    if (o.type === CMD.TRAIL) this.pendingTrails.push({ o, entry, step: this.steps });
    else if (o.type === CMD.DIG) { const cells = []; for (let k = 0; k + 1 < o.cells.length; k += 2) { const c = cellAt(s.L, NEST, o.cells[k], o.cells[k + 1]); if (c >= 0) cells.push(c); } this.digs.push({ tick: s.tick, step: this.steps, cells, already: cells.filter(c => s.mat[c] === MAT.OPEN).length, open: 0, first: -1, done: -1, state: entry.state }); }
    else if (o.type === CMD.ALARM) { const cell = cellAt(s.L, o.layer ?? SURFACE, o.x, o.y); this.alarms.push({ tick: s.tick, step: this.steps, cell, layer: o.layer ?? SURFACE, before: cell >= 0 ? this.near(cell, 6) : 0, near: -1, state: entry.state }); }
    else if (o.type === CMD.RECALL) this.recalls.push({ tick: s.tick, step: this.steps, on: o.on ? 1 : 0, before: this.surface(), after: -1, clear: -1 });
  }
  /** Trails applied this tick, in order given: the applied ones took the newest live trail slots, oldest first. */
  trailsApplied(list) {
    const s = this.s, F = s.flow, applied = list.filter(p => p.entry.state === 'applied');
    for (const p of list) if (p.entry.state !== 'applied') this.trails.push({ tick: s.tick, step: p.step, state: p.entry.state, slot: -1, seq: -1, len: 0, food: -1, trips: 0, first: -1, end: p.step, how: p.entry.state, onSum: 0, looks: 0, onMax: 0 });
    const slots = []; for (let k = 0; k < SLOT.TRAILS; k++) if (F.live[SLOT.TRAIL0 + k]) slots.push(SLOT.TRAIL0 + k);
    slots.sort((a, b) => F.seq[a] - F.seq[b]);
    const mine = slots.slice(-applied.length), w = s.L.sw;
    applied.forEach((p, k) => {
      const slot = mine[k - (applied.length - mine.length)]; if (slot === undefined) return;
      const t = slot - SLOT.TRAIL0, len = Math.min(F.pathLen[t], PATH_MAX), endCell = F.path[t * PATH_MAX + len - 1];
      let food = -1;
      for (let q = 0; q < s.pileCell.length; q++) { const c = s.pileCell[q]; if (c >= 0 && s.pileAmount[q] > 0 && Math.abs(c % w - endCell % w) <= 2 && Math.abs(Math.floor(c / w) - Math.floor(endCell / w)) <= 2) food = s.pileKind[q]; }
      this.trails.push({ tick: s.tick, step: p.step, state: 'applied', slot, seq: F.seq[slot], len, food, trips: 0, first: -1, end: -1, how: '', onSum: 0, looks: 0, onMax: 0 });
    });
  }
  liveTrail(slot) { for (let k = this.trails.length - 1; k >= 0; k--) { const t = this.trails[k]; if (t.slot === slot && t.end < 0) return t; } return null; }
  /** A restart closes the trails the restored game does not have; one live in it with the same sequence number plays on. */
  restart(day, tick) {
    this.marks.push({ step: this.steps, tick, what: `restart day ${day}` });
    const F = this.s.flow;
    for (const t of this.trails) if (t.end < 0 && !(F.live[t.slot] && F.seq[t.slot] === t.seq)) { t.end = this.steps; t.how = 'restart'; }
  }
  mark(what, tick) { this.marks.push({ step: this.steps, tick, what }); }
  page(x) { this.pageData.samples++; if (x.f) this.pageData.fps.push(x.f); }
  pageEvent(type, x) { const p = this.pageData; if (type === 'hold') p.holds.push(x.ms); else if (type === 'hide') p.hides++; else if (type === 'error') p.errors.push(x.m); else if (type === 'cam') p.cams++; }
  finish() { if (this.steps > this.cur.from) this.closeMinute(); if (this.steps - this.lastChange >= STALL) this.stalls.push({ from: this.lastChange, to: this.steps, tick: this.s.tick }); for (const t of this.trails) if (t.end < 0) t.how = 'live at the end'; }
  count(f) { let n = 0; for (let i = 0; i < this.s.n; i++) if (f(i)) n++; return n; }
  surface() { const s = this.s; return this.count(i => s.layer[i] === SURFACE); }
  near(cell, r) {
    const s = this.s, L = s.L, nest = cell >= L.nestBase, w = nest ? L.nw : L.sw, base = nest ? L.nestBase : 0, cx = (cell - base) % w, cy = Math.floor((cell - base) / w), layer = nest ? NEST : SURFACE;
    return this.count(i => s.layer[i] === layer && Math.abs((s.x[i] >> 8) - cx) <= r && Math.abs((s.y[i] >> 8) - cy) <= r);
  }
  stats() {
    return { steps: this.steps, minutes: this.minutes, trails: this.trails.map(({ onSum, looks, ...t }) => ({ ...t, onMean: looks ? Math.round(onSum / looks * 10) / 10 : 0, ticks: (t.end < 0 ? this.steps : t.end) - t.step })),
      digs: this.digs.map(({ cells, ...d }) => ({ ...d, cells: cells.length })), alarms: this.alarms, recalls: this.recalls, stalls: this.stalls, marks: this.marks, page: this.pageData, unattributedTicks: this.unattributed ?? 0,
      births: this.births, decisions: this.decisions, idleMax: this.idleMax, idleMean: this.idleLooks ? this.idleSum / this.idleLooks : 0, firstOrder: this.firstOrder, deliveries: this.deliveries, firstTrailProtein: this.firstTrailProtein,
      queuedShare: this.outsideSum ? this.queuedSum / this.outsideSum : 0, queuedMax: this.queuedMax, jams: this.jams };
  }
}

const sec = steps => `${(steps / 20).toFixed(0)} s`;
function report(s0, end, divergence, checks, notes, st, parts) {
  const L = [];
  L.push(`# Cinderhill lab record: ${s0.mode}, seed ${s0.seed}, ${s0.ants} ants${s0.colony ? `, days of ${s0.dayTicks} ticks` : ''}`);
  L.push('', `Sim ${s0.sim}, snapshot format ${s0.snap}, look ${s0.look}, viewport ${JSON.stringify(s0.vp)}, ${parts} part(s), ${sec(st.steps)} of play replayed.`);
  L.push('', divergence ? `**Replay diverged** at ${divergence.what}, tick ${divergence.tick}: the record says ${divergence.want}, the replay ${divergence.got}. Everything below is from the replay and may not be the game played.` : `**Replay matches**: ${checks} hash checks, all equal.`);
  for (const n of notes) L.push(`- ${n}`);
  if (end) L.push('', `Final: tick ${end.tick}, ${end.workers} workers, ${end.majors} majors, ${end.delivered} loads home, sugar ${end.sugar}, protein ${end.protein}, brood ${end.brood}; orders ${JSON.stringify(end.orders)}; longest play with no order ${sec(end.idleTicks)}${end.daysWon !== null ? `; day ${end.day}, days won ${end.daysWon}` : ''}.`);
  L.push('', '## Per minute', '', '| Min | Tick | Sugar loads | Protein loads | Working | Idle | Other | Queued | Workers | Majors | Eggs / larvae / pupae | Born | Died | Brood lost | Dug |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const m of st.minutes) L.push(`| ${m.minute} | ${m.tick} | ${m.sugar} | ${m.protein} | ${m.working} | ${m.idle} | ${m.other} | ${m.queued ?? 0} | ${m.workers} | ${m.majors} | ${m.eggs} / ${m.larvae} / ${m.pupae} | ${m.born} | ${m.died} | ${m.broodLost} | ${m.dug} |`);
  L.push('', 'Working: carrying, on a trail route, digging or answering an alarm. Idle: resting, or seeking for over 30 s. Queued: waiting at a door lane (counted apart).');
  L.push('', '## Trails', '', '| # | Tick | Length | Ends at | Ants on it, mean / most | Trips | First delivery after | Lasted | Ended |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  st.trails.forEach((t, k) => L.push(`| ${k + 1} | ${t.tick} | ${t.len} | ${t.food < 0 ? 'no food' : t.food === FOOD.PROTEIN ? 'protein' : 'sugar'} | ${t.onMean} / ${t.onMax} | ${t.trips} | ${t.first < 0 ? 'never' : sec(t.first)} | ${sec(t.ticks)} | ${t.how || t.state} |`));
  if (st.unattributedTicks) L.push('', `Trips are not counted on the ${st.unattributedTicks} ticks where an ant died (the ants renumber).`);
  L.push('', '## Digs', '', '| # | Tick | Cells marked | Already open | Dug | First cell after | All dug after | State |', '| --- | --- | --- | --- | --- | --- | --- | --- |');
  st.digs.forEach((d, k) => L.push(`| ${k + 1} | ${d.tick} | ${d.cells} | ${d.already} | ${d.open} | ${d.first < 0 ? '-' : sec(d.first)} | ${d.done < 0 ? 'not finished' : sec(d.done)} | ${d.state} |`));
  L.push('', '## Alarms', '', '| # | Tick | Layer | Ants within 6 cells: at the order / 10 s later | State |', '| --- | --- | --- | --- | --- |');
  st.alarms.forEach((a, k) => L.push(`| ${k + 1} | ${a.tick} | ${a.layer === NEST ? 'nest' : 'surface'} | ${a.before} / ${a.near} | ${a.state} |`));
  L.push('', '## Recalls', '', '| # | Tick | On | Ants on the surface: at the order / 10 s later | Surface down to a tenth after |', '| --- | --- | --- | --- | --- |');
  st.recalls.forEach((r, k) => L.push(`| ${k + 1} | ${r.tick} | ${r.on ? 'on' : 'off'} | ${r.before} / ${r.after} | ${r.on ? (r.clear < 0 ? 'never' : sec(r.clear)) : '-'} |`));
  L.push('', '## Stalls (60 s or more with no delivery, digging, birth or order)', '');
  if (!st.stalls.length) L.push('None.'); else for (const x of st.stalls) L.push(`- ${sec(x.to - x.from)} from ${sec(x.from)} of play (until tick ${x.tick})`);
  L.push('', '## Days and restarts', '');
  if (!st.marks.length) L.push('None.'); else for (const m of st.marks) L.push(`- ${sec(m.step)} of play, tick ${m.tick}: ${m.what}`);
  const p = st.page, fps50 = p.fps.map(f => f[0]).sort((a, b) => a - b), fps95 = p.fps.map(f => f[1]).sort((a, b) => a - b);
  L.push('', '## The page', '', `${p.samples} samples; frames a second, median of the 30 s medians ${fps50.length ? fps50[fps50.length >> 1] : '-'}, worst 30 s p95 ${fps95.length ? fps95[0] : '-'}; ${p.holds.length} holds (${p.holds.reduce((a, b) => a + b, 0)} ms); ${p.hides} times put away; ${p.cams} camera moves; ${p.errors.length} script errors${p.errors.length ? ': ' + p.errors.slice(0, 3).join(' | ') : ''}.`);
  return L.join('\n') + '\n';
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), files = args.filter(a => !a.startsWith('--')), opt = k => args.find(a => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
  if (!files.length) { console.error('Usage: node replay-lab.mjs <record.json> [...] [--out=report.md] [--json=stats.json]'); process.exit(2); }
  const chains = parts(files.map(f => JSON.parse(readFileSync(f, 'utf8'))));
  if (!chains.length) { console.error(`no ${FORMAT} record in ${files.join(', ')}`); process.exit(1); }
  const results = chains.map(replayChain), text = results.map(r => r.report).join('\n');
  if (opt('out')) writeFileSync(opt('out'), text); else process.stdout.write(text);
  if (opt('json')) writeFileSync(opt('json'), JSON.stringify(results.map(({ report, ...r }) => r), null, 1));
  process.exitCode = results.every(r => r.ok) ? 0 : 1;
}
