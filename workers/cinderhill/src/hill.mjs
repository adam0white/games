// The hill room: lockstep ordering for 2 to 4 players (docs/design/colony/05-tech.md, "Room protocol").
// No Cloudflare imports, so Node tests can drive it with node:sqlite and a fake clock (test/hill.test.mjs).
// room.mjs wraps it in a Durable Object.
//
// - The room seals ticks on its own 20 Hz clock and never waits for a client. A command goes into the
//   tick the client asked for, or the next open tick if that one is sealed.
// - Commands carry (seat, id). A repeat of a stored or pending (seat, id) is acknowledged again and dropped.
// - Durable before acknowledged: a tick's commands and the sealed mark commit in one SQLite transaction
//   before the ack and the broadcast. The mark is a lease: it is written as "sealed through T + LEASE".
//   No tick at or below the mark ever gets a command after a restart, so the room may broadcast empty
//   ticks up to the mark without a write each. One write a second instead of twenty (NOTES.md).
// - Role: relay (orders commands, compares client hashes) or authority (also runs the sim and compares
//   every client hash with its own). Set when the room is made, only where env.DEBUG_ROLES is "1".
import { PROTO, HZ, TICK_MS, HASH_EVERY, SEATS, encodeSealed } from './protocol.mjs';
import { Sim, SIM_VERSION, encodeCommand } from '../../../experiments/cinderhill/sim/sim.js';
import { snapshot, restore } from '../../../experiments/cinderhill/sim/snapshot.js';

export const LEASE = HZ; // ticks the sealed mark runs ahead of the last broadcast tick
export const CHECKPOINT_EVERY = 30 * HZ; // authority: a sim checkpoint every 30 s
const MAX_BATCH = 2 * HZ; // a late timer seals at most 2 s of ticks at once; beyond that the clock slips
const AHEAD = 10 * HZ; // a command may ask for a tick at most 10 s ahead
const STOP_AFTER = 5000; // ms with no socket before the clock stops
const KEEP_HASHES = 30; // seconds of hashes kept for comparison

const int = v => (Number.isInteger(v) && v >= -0x80000000 && v <= 0x7fffffff ? v : null);
const ints = (a, max) => (Array.isArray(a) && a.length <= max && a.length % 2 === 0 && a.every(v => int(v) !== null) ? a : null);

/** A client's order to the sim's encoding, or null. Only the sim's five command types, with bounded sizes. */
export function cleanCommand(cmd, tick, seat, id) {
  if (!cmd || typeof cmd !== 'object') return null;
  const base = { tick, seat, id, type: cmd.type };
  if (cmd.type === 1) { const p = ints(cmd.points, 128); return p && p.length >= 2 ? encodeCommand({ ...base, layer: int(cmd.layer) ?? 0, points: p }) : null; }
  if (cmd.type === 2) { const c = ints(cmd.cells, 512); return c && c.length >= 2 ? encodeCommand({ ...base, cells: c }) : null; }
  if (cmd.type === 3) { const [l, x, y, h] = [cmd.layer ?? 0, cmd.x, cmd.y, cmd.hold ?? 100].map(int); return [l, x, y, h].includes(null) ? null : encodeCommand({ ...base, layer: l, x, y, hold: h }); }
  if (cmd.type === 4) return encodeCommand({ ...base, on: !!cmd.on });
  if (cmd.type === 5) { const seq = cmd.seq, d = int(cmd.delta); return Number.isInteger(seq) && seq >= 0 && seq <= 0xffffffff && d !== null && d !== 0 ? encodeCommand({ ...base, seq, delta: Math.max(-64, Math.min(64, d)) }) : null; } // crews
  return null;
}

export class Hill {
  constructor(ctx, env, deps = {}) {
    this.ctx = ctx; this.env = env ?? {};
    this.now = deps.now ?? (() => Date.now());
    this.every = deps.setInterval ?? ((f, ms) => setInterval(f, ms));
    this.stopEvery = deps.clearInterval ?? (h => clearInterval(h));
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v)`);
    // One row written per command: the key is the order the sim applies them in, with no second index.
    // Repeats are found in memory (`stored`, loaded here), so (seat, id) needs no index of its own.
    this.sql.exec(`CREATE TABLE IF NOT EXISTS orders (tick INTEGER, seat INTEGER, id INTEGER, body BLOB, PRIMARY KEY (tick, seat, id)) WITHOUT ROWID`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS seats (seat INTEGER PRIMARY KEY, token TEXT)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS checkpoint (one INTEGER PRIMARY KEY, tick INTEGER, sim INTEGER, bytes BLOB)`);
    const meta = Object.fromEntries(this.sql.exec(`SELECT k, v FROM meta`).toArray().map(r => [r.k, r.v]));
    this.cfg = meta.cfg ? JSON.parse(meta.cfg) : null; // { seed, ants, role }
    this.mark = meta.mark ?? -1; // durable: every tick <= mark is sealed
    this.sealed = this.mark; // the last tick broadcast (after a restart, the mark)
    this.boots = (meta.boots ?? 0) + (this.cfg ? 1 : 0);
    if (this.cfg) this.sql.exec(`INSERT OR REPLACE INTO meta VALUES ('boots', ?)`, this.boots);
    this.stored = new Map(this.sql.exec(`SELECT seat, id, tick FROM orders`).toArray().map(r => [`${r.seat}:${r.id}`, r.tick]));
    this.pending = []; // [tick, encoded command, socket]
    this.pendingKeys = new Set();
    this.timer = null; this.emptySince = 0;
    this.sim = null; this.ownHash = new Map(); this.seen = new Map(); // tick -> hash
    this.stat = { joins: 0, refused: 0, cmds: 0, dups: 0, late: 0, bad: 0, hashes: 0, compared: 0, mismatches: 0, firstMismatch: null, slips: 0, catchUpTicks: 0, checkpoints: 0, checkpointBytes: 0, restoredFrom: null, replayed: 0, markWrites: 0 };
  }

  // ---- joining ----

  /** Handle the WebSocket upgrade. Returns a Response. */
  join(request, makePair = () => new WebSocketPair()) {
    const q = new URL(request.url).searchParams;
    const pair = makePair(), [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    const refuse = (code, why) => { this.stat.refused++; server.close(code, why); return new Response(null, { status: 101, webSocket: client }); };
    if (Number(q.get('proto')) !== PROTO || Number(q.get('sim')) !== SIM_VERSION) {
      server.send(JSON.stringify({ t: 'reload', proto: PROTO, sim: SIM_VERSION }));
      return refuse(4005, 'version');
    }
    if (!this.cfg) {
      const debug = this.env.DEBUG_ROLES === '1';
      const role = debug && q.get('role') === 'authority' ? 'authority' : 'relay';
      const ants = Math.max(0, Math.min(5000, Number(q.get('ants')) | 0 || 2000));
      const seed = (Number(q.get('seed')) >>> 0) || 2026;
      this.cfg = { seed, ants, role };
      this.sql.exec(`INSERT OR REPLACE INTO meta VALUES ('cfg', ?)`, JSON.stringify(this.cfg));
    }
    // A seat: the token from an earlier join, or the next free seat.
    const token = /^[0-9a-f]{16}$/.test(q.get('token') || '') ? q.get('token') : '';
    let seat = token ? this.sql.exec(`SELECT seat FROM seats WHERE token = ?`, token).toArray()[0]?.seat : undefined;
    let mine = token;
    if (seat === undefined) {
      const taken = this.sql.exec(`SELECT count(*) AS n FROM seats`).one().n;
      if (taken >= SEATS) return refuse(4001, 'full');
      seat = taken;
      mine = [...crypto.getRandomValues(new Uint8Array(8))].map(b => b.toString(16).padStart(2, '0')).join('');
      this.sql.exec(`INSERT INTO seats VALUES (?, ?)`, seat, mine);
    }
    server.serializeAttachment({ seat });
    this.stat.joins++;
    this.start();
    server.send(JSON.stringify({ t: 'welcome', proto: PROTO, sim: SIM_VERSION, ...this.cfg, seat, token: mine, sealed: this.sealed, boots: this.boots, version: this.env.VERSION?.id ?? 'local', object: this.ctx.id?.toString?.() ?? '' }));
    // Catch-up: everything sealed from the client's next tick on.
    const have = Math.max(0, Number(q.get('have')) | 0);
    if (this.sealed >= have) {
      const rows = this.sql.exec(`SELECT body FROM orders WHERE tick >= ? AND tick <= ? ORDER BY tick, seat, id`, have, this.sealed).toArray();
      server.send(encodeSealed(this.sealed, rows.map(r => new Int32Array(new Uint8Array(r.body).slice().buffer))));
      this.stat.catchUpTicks += this.sealed - have + 1;
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  // ---- the clock ----

  start() {
    this.emptySince = 0;
    if (this.timer) return;
    if (this.cfg.role === 'authority' && !this.sim) this.loadSim();
    this.anchorAt = this.now(); this.anchorTick = this.sealed + 1;
    this.timer = this.every(() => this.pump(), TICK_MS);
  }

  stop() {
    if (this.timer) this.stopEvery(this.timer);
    this.timer = null;
    if (this.sim) { this.checkpoint(); this.sim = null; this.ownHash.clear(); }
  }

  /** Seal every tick that is due. Runs on the timer and on every incoming message (whose clock is fresh). */
  pump() {
    if (!this.timer) return;
    const now = this.now();
    if (this.ctx.getWebSockets().length === 0) {
      if (!this.emptySince) this.emptySince = now;
      else if (now - this.emptySince > STOP_AFTER) return this.stop();
    } else this.emptySince = 0;
    let due = this.anchorTick + Math.floor((now - this.anchorAt) / TICK_MS) - 1;
    if (due - this.sealed > MAX_BATCH) { this.stat.slips++; this.anchorTick += due - this.sealed - MAX_BATCH; due = this.sealed + MAX_BATCH; }
    while (this.sealed < due) this.seal(this.sealed + 1);
  }

  seal(t) {
    const mine = [], keep = [];
    for (const p of this.pending) (p[0] <= t ? mine : keep).push(p);
    this.pending = keep;
    const cmds = mine.map(([, c]) => { c[0] = t; return c; }).sort((a, b) => a[1] - b[1] || a[2] - b[2]);
    // The mark is written only when it must move; a command in a tick the mark already covers commits alone.
    if (cmds.length || t > this.mark) {
      const mark = t > this.mark ? t + LEASE : this.mark;
      this.ctx.storage.transactionSync(() => {
        for (const c of cmds) this.sql.exec(`INSERT INTO orders VALUES (?, ?, ?, ?)`, t, c[1], c[2], new Uint8Array(c.buffer, c.byteOffset, c.byteLength));
        if (mark !== this.mark) this.sql.exec(`INSERT OR REPLACE INTO meta VALUES ('mark', ?)`, mark);
      });
      for (const c of cmds) this.stored.set(`${c[1]}:${c[2]}`, t);
      if (mark !== this.mark) this.stat.markWrites++;
      this.mark = mark;
    }
    this.sealed = t;
    for (const [, c, ws] of mine) { this.pendingKeys.delete(`${c[1]}:${c[2]}`); this.send(ws, JSON.stringify({ t: 'ack', id: c[2], tick: t })); }
    const frame = encodeSealed(t, cmds);
    for (const ws of this.ctx.getWebSockets()) this.send(ws, frame);
    if (this.sim) this.stepSim(t, cmds);
  }

  send(ws, data) { try { ws.send(data); } catch { /* closed; the close handler cleans up */ } }

  // ---- messages ----

  message(ws, data) {
    this.pump();
    let m;
    try { m = typeof data === 'string' && data.length < 4096 ? JSON.parse(data) : null; } catch { m = null; }
    const seat = ws.deserializeAttachment()?.seat;
    if (!m || seat === undefined) { this.stat.bad++; return; }
    if (m.t === 'cmd') return this.command(ws, seat, m);
    if (m.t === 'hash') return this.hash(ws, seat, m);
    this.stat.bad++;
  }

  command(ws, seat, m) {
    const id = int(m.id);
    if (id === null || id < 1) { this.stat.bad++; return; }
    const key = `${seat}:${id}`;
    if (this.pendingKeys.has(key)) { this.stat.dups++; return; } // acked when its tick seals
    const stored = this.stored.get(key);
    if (stored !== undefined) { this.stat.dups++; return this.send(ws, JSON.stringify({ t: 'ack', id, tick: stored, dup: true })); }
    let tick = int(m.tick) ?? 0;
    if (tick <= this.sealed) { tick = this.sealed + 1; this.stat.late++; }
    if (tick > this.sealed + AHEAD) { this.stat.bad++; return; }
    const c = cleanCommand(m.cmd, tick, seat, id);
    if (!c) { this.stat.bad++; return; }
    this.pending.push([tick, c, ws]); this.pendingKeys.add(key); this.stat.cmds++;
  }

  hash(ws, seat, m) {
    const tick = int(m.tick), h = Number.isInteger(m.h) ? m.h | 0 : null;
    if (tick === null || h === null || tick % HASH_EVERY) { this.stat.bad++; return; }
    this.stat.hashes++;
    const ref = this.cfg.role === 'authority' ? this.ownHash.get(tick) : this.seen.get(tick);
    if (ref === undefined) {
      if (this.cfg.role !== 'authority') { this.seen.set(tick, h); this.trim(this.seen, tick); }
      return;
    }
    this.stat.compared++;
    if (ref !== h) {
      this.stat.mismatches++;
      if (!this.stat.firstMismatch) { this.stat.firstMismatch = { tick, seat }; console.error(JSON.stringify({ event: 'desync', tick, seat, role: this.cfg.role })); }
      this.send(ws, JSON.stringify({ t: 'desync', tick }));
    }
  }

  trim(map, tick) { for (const k of map.keys()) if (k < tick - KEEP_HASHES * HZ) map.delete(k); else break; }

  close() { this.pump(); }

  // ---- authority ----

  /** Restore the last checkpoint (or start fresh) and replay the stored commands up to the sealed tick. */
  loadSim() {
    const cp = this.sql.exec(`SELECT tick, sim, bytes FROM checkpoint WHERE one = 1`).toArray()[0];
    let sim = null;
    if (cp && cp.sim === SIM_VERSION) { try { sim = restore(new Uint8Array(cp.bytes)); this.stat.restoredFrom = cp.tick; } catch (e) { console.error(e); } }
    sim ??= new Sim({ seed: this.cfg.seed, ants: this.cfg.ants });
    const rows = this.sql.exec(`SELECT body FROM orders WHERE tick >= ? AND tick <= ? ORDER BY tick, seat, id`, sim.tick, this.sealed).toArray();
    const cmds = rows.map(r => new Int32Array(new Uint8Array(r.body).slice().buffer));
    let at = 0;
    // Each tick's commands are queued just before that tick, as live: the pending queue is part of the hash.
    while (sim.tick <= this.sealed) { while (at < cmds.length && cmds[at][0] === sim.tick) sim.queueCommand(cmds[at++]); sim.step(); this.stat.replayed++; if (sim.tick % HASH_EVERY === 0 && this.sealed - sim.tick < KEEP_HASHES * HZ) this.ownHash.set(sim.tick, sim.hashes().total | 0); sim.drainEvents(); }
    this.sim = sim;
  }

  stepSim(t, cmds) {
    const sim = this.sim;
    if (sim.tick !== t) { console.error(JSON.stringify({ event: 'sim_behind', simTick: sim.tick, t })); this.loadSim(); return; }
    for (const c of cmds) sim.queueCommand(c);
    sim.step();
    if (sim.tick % HASH_EVERY === 0) { this.ownHash.set(sim.tick, sim.hashes().total | 0); this.trim(this.ownHash, sim.tick); }
    sim.drainEvents();
    if (sim.tick % CHECKPOINT_EVERY === 0) this.checkpoint();
  }

  checkpoint() {
    if (!this.sim) return;
    const bytes = snapshot(this.sim);
    this.sql.exec(`INSERT OR REPLACE INTO checkpoint VALUES (1, ?, ?, ?)`, this.sim.tick, SIM_VERSION, bytes);
    this.stat.checkpoints++; this.stat.checkpointBytes = bytes.length;
  }

  // ---- reading ----

  stats() {
    return { ...this.stat, cfg: this.cfg, sealed: this.sealed, mark: this.mark, boots: this.boots, ticking: !!this.timer, sockets: this.ctx.getWebSockets().length, version: this.env.VERSION?.id ?? 'local', object: this.ctx.id?.toString?.() ?? '' };
  }

  /** Debug only: run a fresh sim for `ticks` ticks inside one call, so the call's CPU time (wrangler tail,
   *  `cpuTime`) is the deployed cost of that many ticks. The clock does not advance during computation. */
  bench(ants, ticks) {
    const sim = new Sim({ seed: 2026, ants: Math.max(0, Math.min(5000, ants | 0)) });
    for (let k = 0; k < Math.min(2000, ticks | 0); k++) { sim.step(); if (sim.tick % HASH_EVERY === 0) sim.hashes(); sim.drainEvents(); }
    return { ants: sim.n, ticks: sim.tick };
  }

  /** The whole command log (debug only): for checking a run offline. */
  log() {
    const commands = this.sql.exec(`SELECT body FROM orders ORDER BY tick, seat, id`).toArray().map(r => Array.from(new Int32Array(new Uint8Array(r.body).slice().buffer)));
    return { cfg: this.cfg, sealed: this.sealed, commands };
  }
}
