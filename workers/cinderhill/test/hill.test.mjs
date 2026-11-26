// The hill room's protocol in Node: node:sqlite stands in for the Durable Object's SQLite, a fake clock for
// the timer, and plain objects for sockets. A restart is a new Hill over the same database file, which is
// what a Durable Object gets after an eviction or a deploy. test/workerd.test.mjs repeats the restart in workerd.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { Hill, LEASE } from '../src/hill.mjs';
import { PROTO, decodeSealed } from '../src/protocol.mjs';
import { G, Sim, SIM_VERSION } from '../../../experiments/cinderhill/sim/sim.js';

function world() {
  const db = new DatabaseSync(':memory:');
  const clock = { t: 1000, timers: [] };
  return { db, clock };
}

function room(w, env = { DEBUG_ROLES: '1' }) {
  const sockets = [];
  const sql = { exec: (q, ...p) => { const rows = w.db.prepare(q).all(...p); return { toArray: () => rows, one: () => rows[0] }; } };
  const ctx = {
    storage: { sql, transactionSync: f => { w.db.exec('BEGIN'); try { const r = f(); w.db.exec('COMMIT'); return r; } catch (e) { w.db.exec('ROLLBACK'); throw e; } } },
    acceptWebSocket: ws => sockets.push(ws),
    getWebSockets: () => sockets.filter(s => s.open),
    id: { toString: () => 'test' },
  };
  w.clock.timers = [];
  const hill = new Hill(ctx, env, { now: () => w.clock.t, setInterval: f => { w.clock.timers.push(f); return f; }, clearInterval: f => { w.clock.timers = w.clock.timers.filter(x => x !== f); } });
  hill.sockets = sockets;
  return hill;
}

/** A fake player: its socket, what it received, and a sim that follows the sealed frames. */
function player(hill, w, q, sim = null) {
  let attachment;
  const p = { got: [], acks: [], text: [], closed: null, sim, hashes: new Map() };
  const server = {
    open: true,
    send: d => {
      if (typeof d === 'string') { const m = JSON.parse(d); p.text.push(m); if (m.t === 'ack') p.acks.push(m); if (m.t === 'welcome') { p.welcome = m; p.sim ??= new Sim({ seed: m.seed, ants: m.ants }); } return; }
      const f = decodeSealed(d); p.got.push(f);
      p.onFrame?.(f);
      for (const c of f.commands) p.sim.queueCommand(c);
      while (p.sim.tick <= f.through) { p.sim.step(); if (p.sim.tick % 20 === 0) p.hashes.set(p.sim.tick, p.sim.hashes().total | 0); p.sim.drainEvents(); }
    },
    close: (code, why) => { server.open = false; p.closed = { code, why }; },
    serializeAttachment: a => { attachment = a; },
    deserializeAttachment: () => attachment,
  };
  const qs = new URLSearchParams({ proto: PROTO, sim: SIM_VERSION, ...q });
  hill.join(new Request(`https://x/room/abcd/ws?${qs}`), () => ({ 0: {}, 1: server }));
  p.ws = server;
  p.say = m => hill.message(server, JSON.stringify(m));
  p.hash = () => { for (const [tick, h] of p.hashes) hill.message(server, JSON.stringify({ t: 'hash', tick, h })); p.hashes.clear(); };
  return p;
}

const advance = (w, ms) => { for (let k = 0; k < ms; k += 50) { w.clock.t += 50; for (const f of w.clock.timers.slice()) f(); } };
const trail = (n) => ({ type: 1, layer: 0, points: [128, 128, 128 + n, 120] });
// Globalize Response for status 101 in Node (Node refuses 101).
globalThis.Response = class { constructor(body, init) { this.status = init?.status; this.webSocket = init?.webSocket; } };

test('a mismatched protocol or sim version is refused with 4005', () => {
  const w = world(), hill = room(w);
  const p = player(hill, w, { proto: PROTO + 1 });
  assert.equal(p.closed.code, 4005);
  const q = player(hill, w, { sim: SIM_VERSION + 1 });
  assert.equal(q.closed.code, 4005);
});

test('ticks seal on the clock with no client input, about 20 a second', () => {
  const w = world(), hill = room(w), p = player(hill, w, {});
  advance(w, 10_000);
  assert.ok(Math.abs(hill.sealed - 199) <= 1, `sealed ${hill.sealed}`);
  assert.equal(p.got.at(-1).through, hill.sealed);
});

test('a repeated command id is applied once and acknowledged again', () => {
  const w = world(), hill = room(w), p = player(hill, w, {});
  advance(w, 500);
  const msg = { t: 'cmd', id: 7, tick: hill.sealed + 3, cmd: trail(5) };
  p.say(msg); p.say(msg); // a copy while pending
  advance(w, 500);
  p.say(msg); // a copy after it is stored
  advance(w, 100);
  const rows = w.db.prepare('SELECT seat, id, tick FROM orders').all();
  assert.equal(rows.length, 1);
  assert.equal(p.acks.length, 2);
  assert.equal(p.acks[1].dup, true);
  assert.equal(p.acks[0].tick, p.acks[1].tick);
  assert.equal(p.got.flatMap(f => f.commands).length, 1);
  assert.equal(hill.stats().dups, 2);
});

test('a late command goes into the next open tick', () => {
  const w = world(), hill = room(w), p = player(hill, w, {});
  advance(w, 1000);
  p.say({ t: 'cmd', id: 1, tick: 3, cmd: trail(2) });
  const due = hill.sealed + 1;
  advance(w, 50);
  assert.equal(p.acks[0].tick, due);
  assert.equal(hill.stats().late, 1);
});

test('durable before acknowledged: the row and a covering mark exist when the ack and frame go out', () => {
  const w = world(), hill = room(w), p = player(hill, w, {});
  const checks = [];
  p.onFrame = f => {
    const mark = w.db.prepare(`SELECT v FROM meta WHERE k = 'mark'`).get()?.v ?? -1;
    checks.push(mark >= f.through);
    for (const c of f.commands) checks.push(!!w.db.prepare('SELECT 1 FROM orders WHERE seat = ? AND id = ?').get(c[1], c[2]));
  };
  advance(w, 300);
  for (let k = 1; k <= 20; k++) { p.say({ t: 'cmd', id: k, tick: hill.sealed + 1 + (k % 3), cmd: trail(k) }); advance(w, 150); }
  assert.ok(checks.length > 20 && checks.every(Boolean));
  // The mark is written about once a second, not every tick.
  assert.ok(hill.stats().markWrites < 0.2 * hill.sealed + 25, `mark writes ${hill.stats().markWrites} for ${hill.sealed} ticks`);
});

test('restart: the room resumes from SQLite, players catch up, each command is applied once, hashes agree', () => {
  const w = world();
  let hill = room(w);
  const a = player(hill, w, { role: 'authority', ants: 300 }), b = player(hill, w, {});
  assert.equal(a.welcome.role, 'authority');
  for (let k = 1; k <= 12; k++) { a.say({ t: 'cmd', id: k, tick: hill.sealed + 2, cmd: trail(k) }); b.say({ t: 'cmd', id: k, tick: hill.sealed + 2, cmd: trail(-k) }); advance(w, 250); a.hash(); b.hash(); }
  // One command sent but not yet sealed when the room dies: never acknowledged, so the player resends it.
  a.say({ t: 'cmd', id: 13, tick: hill.sealed + 5, cmd: trail(13) });
  const before = hill.sealed;
  assert.equal(hill.stats().mismatches, 0);
  assert.ok(hill.stats().compared >= 4);
  // Crash: no stop(), no checkpoint; the sockets close.
  a.ws.open = false; b.ws.open = false;
  w.clock.t += 20_000;
  hill = room(w);
  assert.ok(hill.sealed >= before && hill.sealed <= before + LEASE, `resumed at ${hill.sealed}, last broadcast ${before}`);
  assert.equal(hill.boots, 1);
  // The players keep their sims across the reconnect and say which tick they need next.
  const a2 = player(hill, w, { token: a.welcome.token, have: a.sim.tick }, a.sim), b2 = player(hill, w, { token: b.welcome.token, have: b.sim.tick }, b.sim);
  assert.equal(a2.welcome.seat, a.welcome.seat);
  assert.equal(b2.welcome.seat, b.welcome.seat);
  a2.say({ t: 'cmd', id: 13, tick: 0, cmd: trail(13) }); // resent
  a2.say({ t: 'cmd', id: 5, tick: 0, cmd: trail(5) }); // already stored before the crash: dropped
  advance(w, 3000);
  const ids = w.db.prepare('SELECT seat, id FROM orders').all().map(r => `${r.seat}:${r.id}`);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.length, 25);
  assert.ok(a2.acks.some(x => x.id === 5 && x.dup));
  assert.ok(a2.acks.some(x => x.id === 13 && !x.dup));
  assert.ok(hill.stats().replayed > 0);
  a2.hash(); b2.hash();
  assert.ok(hill.stats().compared > 0);
  assert.equal(hill.stats().mismatches, 0);
  // An independent replay of the stored log reaches the same state as both players.
  const ref = new Sim({ seed: 2026, ants: 300 }), log = w.db.prepare('SELECT body FROM orders ORDER BY tick, seat, id').all().map(r => new Int32Array(new Uint8Array(r.body).slice().buffer));
  let at = 0;
  while (ref.tick < a.sim.tick) { while (at < log.length && log[at][0] === ref.tick) ref.queueCommand(log[at++]); ref.step(); ref.drainEvents(); }
  assert.equal(ref.hashes().total, a.sim.hashes().total);
  assert.equal(a.sim.tick, b.sim.tick);
  assert.equal(a.sim.hashes().total, b.sim.hashes().total);
});

test('authority: a client with a different state is reported', () => {
  const w = world(), hill = room(w), a = player(hill, w, { role: 'authority', ants: 200 });
  advance(w, 1100);
  a.sim.g[G.STORES] += 1; // a client state the room never had. (A flipped low bit of a position can die out: at this seed it did 8 ticks later while the ant walked freely with the same heading, most likely because the integer separation push from a neighbour moved by one unit the other way.)
  advance(w, 1100);
  a.hash();
  assert.ok(hill.stats().mismatches >= 1);
  assert.ok(a.text.some(m => m.t === 'desync'));
});

test('relay: two clients that disagree are reported; a full room refuses a fifth seat', () => {
  const w = world(), hill = room(w), a = player(hill, w, {}), b = player(hill, w, {});
  assert.equal(a.welcome.role, 'relay');
  advance(w, 1100);
  b.sim.x[1] ^= 4;
  advance(w, 1100);
  a.hash(); b.hash();
  assert.ok(hill.stats().mismatches >= 1);
  player(hill, w, {}); player(hill, w, {});
  assert.equal(player(hill, w, {}).closed.code, 4001);
});

test('without DEBUG_ROLES a room is always a relay', () => {
  const w = world(), hill = room(w, { DEBUG_ROLES: '0' }), a = player(hill, w, { role: 'authority' });
  assert.equal(a.welcome.role, 'relay');
});

test('the clock stops 5 s after the last socket closes, and starts again on a join', () => {
  const w = world(), hill = room(w), a = player(hill, w, {});
  advance(w, 1000);
  a.ws.open = false;
  advance(w, 6000);
  assert.equal(hill.stats().ticking, false);
  const sealed = hill.sealed;
  advance(w, 2000);
  assert.equal(hill.sealed, sealed);
  player(hill, w, { token: a.welcome.token, have: 0 });
  advance(w, 1000);
  assert.ok(hill.sealed > sealed);
});

test('a crew order (type 5) is acknowledged and sealed; a malformed one is refused', () => {
  const w = world(), hill = room(w), p = player(hill, w, {});
  advance(w, 500);
  p.say({ t: 'cmd', id: 1, tick: hill.sealed + 3, cmd: { type: 5, seq: 0, delta: 3 } });
  p.say({ t: 'cmd', id: 2, tick: hill.sealed + 3, cmd: { type: 5, seq: 0 } }); // no delta
  p.say({ t: 'cmd', id: 3, tick: hill.sealed + 3, cmd: { type: 5, seq: 0, delta: 0 } }); // the sim rejects a zero change
  advance(w, 500);
  assert.equal(p.acks.filter(a => a.id === 1).length, 1);
  const sealed = p.got.flatMap(f => f.commands);
  assert.equal(sealed.length, 1);
  assert.equal(sealed[0][3], 5);
  assert.equal(hill.stats().bad, 2);
});
