// Cinderhill's game-lab record (kit/lab.js public API only): a full replay of the game, plus what only the page knows.
//
// Start (rec.start): format, chain id and part, mode, look, ants, seed, SIM_VERSION, snapshot format, colony and day
//   length, viewport. With these a Host is made again exactly (host.js).
// Events (rec.event), in the order they happened:
//   log      the replay stream, batched: ['o', tick, order] for every host.order, ['g', tick] for go on after a dusk,
//            ['r', tick, day] for a day restarted from its dawn save. Replaying them through a Host in order is the game.
//   sample   every 30 s of play (600 ticks): tick, the sim's total hash, ants by caste, sugar, protein, brood by stage,
//            loads delivered, frames a second at p50 and p95 over the window, ms held, and the camera.
//   cam      the camera after it settles (1 s without a change), at most one each 5 s.
//   hold     each Hold with its length.  hide, show  the page put away and back.  error  a script error (10 at most).
//   dusk, dawn, restart  as before (the page sends these itself).
// Summary (rec.end): totals, orders by type, holds, the longest play with no order, and the final tick and hash.
// The kit keeps a run to 300 events and 96 KB (kit/lab.js MAX_EVENTS, MAX_BYTES; 4,096 characters an event). Near
// either, the run ends as 'continued' and a new part of the same chain starts where it stopped, so a long session is
// several records that spikes/replay-lab.mjs joins.
import { CMD, G, SIM_VERSION, STAGE, SURFACE } from './sim/sim.js';
import { SNAPSHOT_VERSION } from './sim/snapshot.js';

export const FORMAT = 'cinderhill-replay/1', SAMPLE_TICKS = 600;
export const LIMITS = { events: 300, bytes: 96 * 1024, event: 4096 }; // kit/lab.js; test/labrec.test.mjs reads them from it
const NAME = { [CMD.TRAIL]: 'trail', [CMD.DIG]: 'dig', [CMD.ALARM]: 'alarm', [CMD.RECALL]: 'recall' };
const hex = () => { const b = new Uint8Array(8); crypto.getRandomValues(b); return [...b].map(x => x.toString(16).padStart(2, '0')).join(''); };

export class LabRecord {
  /** rec: kit lab(); limits for a part (tests make them small). */
  constructor(rec, { rollEvents = 270, rollBytes = 80 * 1024, batch = 3000 } = {}) {
    this.rec = rec; this.roll = { events: rollEvents, bytes: rollBytes }; this.batchChars = batch;
    this.host = null; this.open = false;
  }

  /** A new game on this host: { mode, look, viewport }. Ends a run still open. */
  start(host, { mode, look, viewport } = {}) {
    if (this.open) this.end('left');
    this.host = host; this.chain = hex(); this.part = 1;
    this.info = { format: FORMAT, chain: this.chain, mode: mode ?? (host.colony ? 'colony' : 'sandbox'), look: look ?? 'default', ants: host.ants, seed: host.seed, sim: SIM_VERSION, snap: SNAPSHOT_VERSION, colony: host.colony ? 1 : 0, dayTicks: host.colony ? host.sim.cfg.dayTicks : null, vp: viewport ?? null };
    this.byType = {}; this.holds = 0; this.heldTotal = 0; this.errors = 0; this.longestIdle = 0; this.lastOrder = host.ticks; this.startTicks = host.ticks;
    this.begin();
  }

  begin() {
    this.rollDue = false; this.buf = []; this.bufChars = 0; this.count = 0; this.bytes = 0; this.dt = []; this.heldMs = 0; this.holdFrom = this.holdFrom ?? null;
    this.nextSample = this.host.tick - (this.host.tick % SAMPLE_TICKS) + SAMPLE_TICKS; this.cam = null; this.camSent = null; this.camAt = -1e9; this.camNow = null;
    this.rec.start({ ...this.info, part: this.part, from: this.host.tick, hash: this.host.sim.hashes().total });
    this.open = true;
  }

  // ---- the replay stream ----
  push(entry) {
    if (!this.open) return;
    const chars = JSON.stringify(entry).length;
    if (this.bufChars + chars > this.batchChars) this.flushLog();
    this.buf.push(entry); this.bufChars += chars + 1;
  }
  flushLog() { if (!this.open || !this.buf?.length) return; const e = this.buf; this.buf = []; this.bufChars = 0; this.emit('log', { e }); }

  /** host.order's arguments and its log entry. */
  order(o, entry) {
    if (!this.open) return;
    const t = this.host.ticks, gap = t - this.lastOrder; if (gap > this.longestIdle) this.longestIdle = gap; this.lastOrder = t;
    const name = NAME[o.type] ?? String(o.type); this.byType[name] = (this.byType[name] ?? 0) + 1;
    this.push(['o', entry.tick, o]);
  }
  goOn() { this.push(['g', this.host.tick]); }
  /** After host.restartDay(day); tickBefore is the tick it was called at. Samples go on from the restored tick. */
  restart(day, tickBefore) { this.push(['r', tickBefore, day]); this.nextSample = this.host.tick - (this.host.tick % SAMPLE_TICKS) + SAMPLE_TICKS; }

  // ---- what only the page knows ----
  frame(dtMs) { if (this.open && this.dt.length < 4000) this.dt.push(dtMs); }
  camera(layer, c, nowMs) {
    if (!this.open) return;
    const now = [layer, Math.round(c.x * 10) / 10, Math.round(c.y * 10) / 10, Math.round(c.z * 100) / 100], key = now.join();
    if (key !== this.camNow?.key) { this.camNow = { key, since: nowMs, v: now }; return; }
    this.cam = now;
    if (nowMs - this.camNow.since >= 1000 && key !== this.camSent && nowMs - this.camAt >= 5000) { this.camSent = key; this.camAt = nowMs; this.emit('cam', { at: this.host.tick, c: now }); }
  }
  hold(on, nowMs) {
    if (on && this.holdFrom === null) this.holdFrom = nowMs;
    else if (!on && this.holdFrom !== null) {
      const ms = Math.round(nowMs - this.holdFrom); this.holdFrom = null; this.heldMs += ms; this.holds++; this.heldTotal += ms;
      this.emit('hold', { at: this.host.tick, ms });
    }
  }
  visible(shown) { this.flushLog(); this.emit(shown ? 'show' : 'hide', { at: this.host?.tick ?? 0 }); }
  error(message) { if (this.errors++ < 10) this.emit('error', { at: this.host?.tick ?? 0, m: String(message).slice(0, 300) }); }
  event(type, data) { this.emit(type, data); }

  /** After the host advanced. */
  tick() {
    if (this.rollDue && this.open) { this.rollDue = false; this.rollOver(); } // between frames: every action so far is logged
    if (this.open && this.host.tick >= this.nextSample) { this.sample(); this.nextSample = this.host.tick - (this.host.tick % SAMPLE_TICKS) + SAMPLE_TICKS; }
  }

  sample() {
    this.flushLog(); // the stream up to this tick comes before the hash that checks it
    const h = this.host, s = h.sim, b = [0, 0, 0];
    for (let k = 0; k < (s.brood?.n ?? 0); k++) b[s.brood.stage[k]]++;
    let majors = 0; for (let i = 0; i < s.n; i++) if (s.caste[i] & 1) majors++;
    const f = this.fps(); this.dt = [];
    const held = this.heldMs; this.heldMs = 0;
    this.emit('sample', { at: s.tick, hash: s.hashes().total, w: s.n - majors, m: majors, s: s.g[G.SUGAR], p: s.g[G.PROTEIN], b: [b[STAGE.EGG], b[STAGE.LARVA], b[STAGE.PUPA]], d: s.g[G.STORES], f, h: held + (this.holdFrom !== null ? 1 : 0), c: this.cam });
  }
  fps() {
    if (!this.dt.length) return null;
    const a = this.dt.slice().sort((x, y) => x - y), q = f => a[Math.min(a.length - 1, Math.floor(a.length * f))];
    return [Math.round(1000 / Math.max(1, q(0.5))), Math.round(1000 / Math.max(1, q(0.95)))];
  }

  emit(type, data) {
    if (!this.open) return;
    this.rec.event(type, data);
    this.count++; this.bytes += JSON.stringify(data ?? null).length + 40;
    if (this.count >= this.roll.events || this.bytes >= this.roll.bytes) this.rollDue = true; // done at the next tick()
  }

  /** The part is near the kit's limits: end it and go on in a new part of the same chain. Only from tick(), so the
   *  new part starts from a state the previous parts' streams reach. */
  rollOver() {
    this.open = false;
    const s = this.host.sim;
    this.rec.end('continued', { tick: s.tick, hash: s.hashes().total, part: this.part });
    this.part++; this.begin();
  }

  summary() {
    const h = this.host, s = h.sim, gap = h.ticks - this.lastOrder; if (gap > this.longestIdle) this.longestIdle = gap;
    let majors = 0; for (let i = 0; i < s.n; i++) if (s.caste[i] & 1) majors++;
    return { tick: s.tick, hash: s.hashes().total, part: this.part, ticks: h.ticks - this.startTicks, orders: this.byType, delivered: s.g[G.STORES], workers: s.n - majors, majors, sugar: s.g[G.SUGAR], protein: s.g[G.PROTEIN],
      brood: s.brood?.n ?? 0, holds: this.holds, heldMs: this.heldTotal, idleTicks: this.longestIdle, daysWon: s.cfg.colony ? s.g[G.DAYS_WON] : null, day: s.cfg.colony ? s.g[G.DAY] : null, errors: this.errors };
  }

  /** The game ends (outcome: 'left', ...). */
  end(outcome) {
    if (!this.open) return;
    this.flushLog();
    const sum = this.summary(); this.open = false;
    this.rec.end(outcome, sum);
  }
}
