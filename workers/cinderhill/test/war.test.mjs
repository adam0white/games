// The war build through the room, in Node: machine players whose orders travel the wire as a person's would,
// a page that joins late, and a page that loses an order (the room must notice).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { Hill } from '../src/hill.mjs';
import { PROTO, decodeSealed } from '../src/protocol.mjs';
import { Host } from '../../../experiments/cinderhill/war/host.js';
import { NetHost, WIRE, encodeOrder, decodeOrder, roomSim } from '../../../experiments/cinderhill/war/wire.js';

globalThis.Response = class { constructor(body, init) { this.status = init?.status; this.webSocket = init?.webSocket; } };
function room() {
  const db = new DatabaseSync(':memory:'), clock = { t: 1000, timers: [] }, sockets = [];
  const sql = { exec: (q, ...p) => { const rows = db.prepare(q).all(...p); return { toArray: () => rows, one: () => rows[0] }; } };
  const ctx = { storage: { sql, transactionSync: f => { db.exec('BEGIN'); try { const r = f(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } } }, acceptWebSocket: ws => sockets.push(ws), getWebSockets: () => sockets.filter(s => s.open), id: { toString: () => 'test' } };
  const hill = new Hill(ctx, {}, { now: () => clock.t, setInterval: f => { clock.timers.push(f); return f; }, clearInterval: f => { clock.timers = clock.timers.filter(x => x !== f); } });
  const advance = ms => { for (let k = 0; k < ms; k += 50) { clock.t += 50; for (const f of clock.timers.slice()) f(); } };
  return { hill, advance };
}
/** A page: a NetHost joined to the room. `lose` drops the nth order it is handed (a broken page). */
function page(hill, { team = 0, bot = null, sim = WIRE, lose = 0 } = {}) {
  let n = 0, server = null;
  const p = { desync: 0, closed: null, text: [], token: '' };
  p.net = new NetHost({ seed: 77, mission: 'crossing', ai: {} }, { send: text => { if (server?.open) hill.message(server, text); }, team, bot });
  /** Join, or join again after a drop with the seat's token and the next tick this page needs. */
  p.join = () => {
    let attachment; const mine = server = {
      open: true,
      send: d => {
        if (mine !== server) return;
        if (typeof d === 'string') { const m = JSON.parse(d); p.text.push(m); if (m.t === 'welcome') { p.token = m.token; p.net.welcome(m); } else if (m.t === 'ack') p.net.ack(m); else if (m.t === 'desync') p.desync++; return; }
        const f = decodeSealed(d);
        if (lose) f.commands = f.commands.filter(c => c[3] <= 0 || ++n !== lose);
        p.net.sealed(f); p.net.run(1e6);
      },
      close: (code, why) => { mine.open = false; p.closed = { code, why }; },
      serializeAttachment: a => { attachment = a; }, deserializeAttachment: () => attachment,
    };
    hill.join(new Request(`https://x/room/abcd/ws?${new URLSearchParams({ proto: PROTO, game: 'war', sim, seed: 77, have: p.net.have, ...(p.token ? { token: p.token } : {}) })}`), () => ({ 0: {}, 1: server }));
  };
  p.drop = () => { server.open = false; };
  p.join();
  return p;
}

test('an order survives the wire: every field and list comes back as it went', () => {
  const o = { type: 8, team: 1, kind: 3, dig: 1, cells: [4, 5, 6, 7], on: false, x: -3 };
  assert.deepEqual(decodeOrder(encodeOrder(o)), { ...o, on: 0 });
  assert.deepEqual(decodeOrder(encodeOrder({ type: 1, points: [1, 2, 3, 4], under: [] })), { type: 1, points: [1, 2, 3, 4], under: [] });
});

test('two machine players in a room stay identical for five minutes, and a late page catches up to them', () => {
  const { hill, advance } = room();
  const a = page(hill, { team: 0, bot: { team: 0, mind: 2 } }), b = page(hill, { team: 1, bot: { team: 1, mind: 1 } });
  advance(500); assert.equal(a.net.started, false, 'the lobby holds the sim');
  assert.equal(a.net.seats.size, 2); a.net.begin(); advance(3000 * 50);
  const late = page(hill, { team: 0 }); advance(3000 * 50);
  const s = hill.stats();
  assert.ok(a.net.sim.tick > 5900, `ran ${a.net.sim.tick}`);
  assert.ok(a.net.log.length + 0 >= 0 && s.cmds > 20, `orders through the room: ${s.cmds}`);
  assert.equal(s.mismatches, 0); assert.ok(s.compared > 200, `hashes compared: ${s.compared}`);
  assert.equal(a.net.sim.hash(), b.net.sim.hash()); assert.equal(late.net.sim.tick, a.net.sim.tick); assert.equal(late.net.sim.hash(), a.net.sim.hash());
  assert.ok(a.net.sim.g(0, 2) + a.net.sim.g(1, 2) >= 0);
});

test('a page that loses one order is told it has drifted', () => {
  const { hill, advance } = room();
  const a = page(hill, { team: 0, bot: { team: 0, mind: 2 } }), b = page(hill, { team: 1, lose: 3 });
  a.net.begin(); advance(1500 * 50);
  assert.ok(hill.stats().mismatches > 0, 'the room saw the difference'); assert.ok(a.desync + b.desync > 0);
  assert.notEqual(a.net.sim.hash(), b.net.sim.hash());
});

test('a page of another version, or of the other game, is sent away', () => {
  const { hill } = room();
  page(hill); const old = page(hill, { sim: WIRE + 1 });
  assert.equal(old.closed?.code, 4005);
});

test('a page that drops and comes back keeps its seat, and an order sent while it was away lands once', () => {
  const { hill, advance } = room();
  const a = page(hill, { team: 0, bot: { team: 0, mind: 2 } }), b = page(hill, { team: 1 });
  a.net.begin(); advance(400 * 50);
  const seat = b.net.seat; b.drop(); advance(100 * 50);
  assert.ok(a.net.sim.tick > b.net.sim.tick + 90, 'the room did not wait');
  b.net.order({ type: 4, team: 1, level: 2 }); /* typed while offline: kept, sent after the next welcome */
  const from = () => hill.log().commands.filter(c => c[1] === seat && c[3] > 0).length, before = from(); b.join(); advance(300 * 50);
  assert.equal(b.net.seat, seat); assert.equal(from(), before + 1, 'the order went through once');
  assert.equal(b.net.sim.tick, a.net.sim.tick); assert.equal(b.net.sim.hash(), a.net.sim.hash());
  assert.equal(hill.stats().mismatches, 0); assert.equal(a.desync + b.desync, 0);
});

test('a link with other rules cannot share the room', () => {
  const { hill } = room();
  const rules = { mission: 'crossing', bot: 2 };
  assert.notEqual(roomSim(rules), roomSim({ mission: 'crossing' })); assert.notEqual(roomSim(rules), roomSim({ mission: 'summer', bot: 2 })); assert.notEqual(roomSim(rules), roomSim({ ...rules, botSide: 0 }));
  const first = page(hill, { sim: roomSim(rules) }), same = page(hill, { sim: roomSim({ ...rules, botSide: 1 }) }), other = page(hill, { sim: roomSim({ mission: 'crossing' }) });
  assert.equal(first.closed, null); assert.equal(same.closed, null); assert.equal(other.closed?.code, 4005);
});

test('the same orders played without a room give the same hill (the wire changes nothing)', () => {
  const { hill, advance } = room();
  const a = page(hill, { team: 0, bot: { team: 0, mind: 2 } }); page(hill, { team: 1, bot: { team: 1, mind: 0 } });
  a.net.begin(); advance(2000 * 50);
  const direct = new Host({ seed: 77, mission: 'crossing', ai: {} }), log = hill.log().commands;
  const rows = (Array.isArray(log) ? log : []).map(c => Array.from(c));
  const startAt = a.net.startAt; let k = 0;
  const orders = rows.filter(c => c[3] > 0 && c[0] > startAt).sort((x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2]);
  while (direct.sim.tick < a.net.sim.tick) { const r = startAt + 1 + direct.sim.tick; while (k < orders.length && orders[k][0] === r) { const c = orders[k++]; direct.sim.order({ ...decodeOrder(c, 3), id: c[2] * 4 + c[1], tick: direct.sim.tick }); } direct.tick(); }
  assert.ok(orders.length > 10, `orders in the room's log: ${orders.length}`);
  assert.equal(direct.sim.hash(), a.net.sim.hash());
});
