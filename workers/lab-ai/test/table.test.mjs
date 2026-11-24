import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { TABLE, tableName, tableMessage, freshTable, sit, move, again, shown } from '../src/table.mjs';
import { table as kitTable, newCode, cleanCode, linkFor, codeFromLink } from '../../../experiments/kit/room.js';

// The class itself runs here with stand-ins for sockets, storage and the platform base class, as room.test.mjs does.
// The page side is the real experiments/kit/room.js, joined to the class by a pair of in-memory sockets.
let source = await readFile(new URL('../src/index.mjs', import.meta.url), 'utf8');
source = source.replace("import { DurableObject } from 'cloudflare:workers';", 'class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }')
  .replace(/from '(\.\/[^']+)'/g, (_, p) => `from '${new URL('../src/' + p, import.meta.url).href}'`);
const { Table, handleTable } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const NativeResponse = globalThis.Response;
globalThis.Response = class { constructor(body, init) { return init?.status === 101 ? { ...init, body } : new NativeResponse(body, init); } };

class ServerSocket {
  constructor() { this.readyState = 1; this.frames = []; this.attachment = null; this.peer = null; }
  accept() {}
  send(text) { if (this.readyState !== 1) throw new Error('closed'); this.frames.push(JSON.parse(text)); this.peer?.deliver(text); }
  close(code, reason) { if (this.readyState === 3) return; this.readyState = 3; this.closed = { code, reason }; this.peer?.serverClosed(code); }
  serializeAttachment(c) { this.attachment = structuredClone(c); }
  deserializeAttachment() { return structuredClone(this.attachment); }
}
globalThis.WebSocketPair = class { constructor() { this[0] = { server: null }; this[1] = new ServerSocket(); this[0].server = this[1]; } };
const context = () => {
  const kept = new Map();
  return { sockets: [], kept, alarmAt: null, getWebSockets() { return this.sockets; }, acceptWebSocket(ws) { this.sockets.push(ws); },
    blockConcurrencyWhile: fn => fn(),
    storage: { get: async k => structuredClone(kept.get(k)), put: async (k, v) => { kept.set(k, structuredClone(v)); }, deleteAll: async () => { kept.clear(); }, setAlarm: async at => { ctx.alarmAt = at; } } };
};
let ctx;
const url = 'https://play.adamwhite.work/lab-api/table/pitch/ABCD';
const request = (path = '/lab-api/table/pitch/ABCD', { origin = 'https://play.adamwhite.work', method = 'GET', upgrade = 'websocket' } = {}) => new Request(`https://play.adamwhite.work${path}`, { method, headers: { ...(origin ? { Origin: origin } : {}), ...(upgrade ? { Upgrade: upgrade } : {}), 'CF-Connecting-IP': '203.0.113.2' } });
const settle = () => new Promise(r => setTimeout(r, 0));
async function raw(room) { const r = await room.fetch(request()); return r.webSocket.server; }
const say = (room, ws, q) => room.webSocketMessage(ws, typeof q === 'string' ? q : JSON.stringify(q));
const key = c => c.repeat(20);

// A page-side socket joined to a table object: what the browser's WebSocket would be.
function socketsFor(room) {
  return class PageSocket {
    constructor(address) {
      this.readyState = 0; this.address = address; PageSocket.made.push(this);
      room.fetch(request(new URL(address.replace(/^ws/, 'http')).pathname)).then(r => {
        this.server = r.webSocket.server; this.server.peer = this;
        if (this.readyState === 3) return;
        if (this.server.readyState === 3) { this.serverClosed(this.server.closed.code); return; }
        this.readyState = 1; this.onopen?.();
      });
    }
    send(text) { if (this.readyState !== 1) throw new Error('not open'); room.webSocketMessage(this.server, text); }
    deliver(text) { queueMicrotask(() => this.onmessage?.({ data: text })); }
    serverClosed(code) { if (this.readyState === 3) return; this.readyState = 3; queueMicrotask(() => this.onclose?.({ code })); }
    close() { if (this.readyState === 3) return; this.readyState = 3; if (this.server && this.server.readyState === 1) { this.server.readyState = 3; room.webSocketClose(this.server, 1000, ''); } }
    // The network drops: no close frame reaches the page until it notices.
    cut() { this.readyState = 3; if (this.server) { this.server.readyState = 3; room.webSocketClose(this.server, 1006, ''); } queueMicrotask(() => this.onclose?.({ code: 1006 })); }
    static made = [];
  };
}
function player(room, Socket, store, name, version = 1) {
  const seen = { states: [], moves: [], seats: [], games: [], agains: [], status: [] };
  const timers = { waits: [], setTimeout(fn, ms) { this.waits.push({ fn, ms }); return this.waits.length; }, clearTimeout() {}, run() { const w = this.waits.splice(0); for (const x of w) x.fn(); } };
  const t = kitTable({ game: 'pitch', version, name: () => name, Socket, where: { protocol: 'https:', host: 'play.adamwhite.work', href: 'https://play.adamwhite.work/lab/pitch/' }, store, timers,
    onState: s => seen.states.push(s), onMove: (s, m, i) => seen.moves.push([i, s, ...m]), onSeats: s => seen.seats.push(s), onGame: g => seen.games.push(g), onAgain: s => seen.agains.push(s), onStatus: s => seen.status.push(s) });
  return { t, seen, timers };
}
const memory = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => { m.set(k, String(v)); }, m }; };

test('table paths: listed games only, four uppercase letters, exact path', () => {
  assert.deepEqual(tableName('/lab-api/table/pitch/ABCD'), { game: 'pitch', code: 'ABCD', name: 'pitch/ABCD' });
  for (const bad of ['/lab-api/table/pitch/abcd', '/lab-api/table/pitch/ABCDE', '/lab-api/table/pitch/open', '/lab-api/table/lantern-race/ABCD', '/lab-api/table/pitch/ABCD/', '/lab-api/table/constructor/ABCD', '/lab-api/room/pitch/ABCD']) assert.equal(tableName(bad), null, bad);
});

test('frames: exact fields, small integers, cleaned names, a byte limit', () => {
  assert.deepEqual(tableMessage(JSON.stringify({ t: 'hi', n: '  Ada  ', k: key('a'), v: 3 })), { t: 'hi', n: 'Ada', k: key('a'), v: 3 });
  assert.equal(tableMessage(JSON.stringify({ t: 'hi', n: '', k: key('a'), v: 1 })).n, 'Friend');
  assert.deepEqual(tableMessage(JSON.stringify({ t: 'm', i: 0, m: [1, -2, 3] })), { t: 'm', i: 0, m: [1, -2, 3] });
  assert.deepEqual(tableMessage('{"t":"again"}'), { t: 'again' });
  for (const bad of [{ t: 'hi', n: 'A', k: 'short', v: 1 }, { t: 'hi', n: 'A', k: key('a'), v: 0 }, { t: 'hi', n: 'A', k: key('a') + '!', v: 1 }, { t: 'hi', n: 'A', k: key('a'), v: 1, x: 1 },
    { t: 'm', i: -1, m: [1] }, { t: 'm', i: 0, m: [] }, { t: 'm', i: 0, m: [1.5] }, { t: 'm', i: 0, m: ['1'] }, { t: 'm', i: 0, m: Array(TABLE.ints + 1).fill(1) }, { t: 'm', i: TABLE.moves, m: [1] }, { t: 'm', i: 0, m: [TABLE.span + 1] },
    { t: 'again', x: 1 }, { t: 'other' }, [], null]) assert.equal(tableMessage(JSON.stringify(bad)), null, JSON.stringify(bad));
  assert.equal(tableMessage('not json'), null);
  assert.equal(tableMessage(JSON.stringify({ t: 'hi', n: 'é'.repeat(140), k: key('a'), v: 1 })), null, 'over the byte limit');
});

test('state: seats by key, one order of moves, a vote from every seat for another game', () => {
  const t = freshTable(2, 7, 1000);
  assert.deepEqual(sit(t, { n: 'Ada', k: key('a'), v: 1 }, [], 9, 1001), { seat: 0 });
  assert.equal(move(t, 0, { i: 0, m: [5] }, 1002), 'early', 'no moves before every seat is taken');
  assert.deepEqual(sit(t, { n: 'Ben', k: key('b'), v: 1 }, [0], 9, 1003), { seat: 1 });
  assert.deepEqual(sit(t, { n: 'Cy', k: key('c'), v: 1 }, [0, 1], 9, 1004), { refuse: 'full' });
  assert.deepEqual(sit(t, { n: 'Ada again', k: key('a'), v: 1 }, [1], 9, 1005), { seat: 0 }, 'the same key gets its seat back');
  assert.deepEqual(sit(t, { n: 'Old', k: key('b'), v: 2 }, [0], 9, 1006), { refuse: 'version' });
  assert.equal(move(t, 0, { i: 0, m: [5, 6] }, 1010), 'ok');
  assert.equal(move(t, 1, { i: 0, m: [7] }, 1011), 'stale', 'a move for a place already taken');
  assert.equal(move(t, 0, { i: 0, m: [5, 6] }, 1012), 'again', 'the same move resent');
  assert.equal(move(t, 0, { i: 0, m: [5] }, 1012), 'stale', 'a different move for the same place');
  assert.equal(move(t, 1, { i: 2, m: [7] }, 1013), 'stale', 'a move from the future');
  assert.equal(move(t, 1, { i: 1, m: [7] }, 1014), 'ok');
  assert.deepEqual(t.log, [[0, 5, 6], [1, 7]]);
  assert.deepEqual(shown(t, [1]), [{ n: 'Ada again', on: false }, { n: 'Ben', on: true }]);
  assert.ok(!JSON.stringify(shown(t, [0, 1])).includes(key('a')), 'keys are never shown');
  assert.equal(again(t, 0, 33, 1020), false); assert.equal(again(t, 0, 33, 1021), false, 'one seat cannot vote twice');
  assert.equal(again(t, 1, 44, 1022), true);
  assert.deepEqual([t.game, t.seed, t.log, t.again], [1, 44, [], []]);
  // Alone at the table with a newer page: the table starts again on that version.
  assert.deepEqual(sit(t, { n: 'Ben', k: key('b'), v: 2 }, [], 55, 1030), { seat: 0 });
  assert.deepEqual([t.v, t.game, t.seed, t.seats[1]], [2, 0, 55, null]);
});

test('the route: origin, method, upgrade and its own limiter', async () => {
  const env = { TABLE_JOIN: { limit: async () => ({ success: true }) }, TABLE: { idFromName: n => n, get: n => ({ fetch: async () => new NativeResponse('reached ' + n) }) } };
  assert.equal(await (await handleTable(request(), env)).text(), 'reached pitch/ABCD');
  assert.equal((await handleTable(request('/lab-api/table/nope/ABCD'), env)).status, 404);
  assert.equal((await handleTable(request(undefined, { origin: 'https://evil.example' }), env)).status, 403);
  assert.equal((await handleTable(request(undefined, { method: 'POST' }), env)).status, 405);
  assert.equal((await handleTable(request(undefined, { upgrade: '' }), env)).status, 426);
  assert.equal((await handleTable(request(), { ...env, TABLE_JOIN: { limit: async () => ({ success: false }) } })).status, 429);
  assert.equal((await handleTable(request(), { ...env, TABLE_JOIN: { limit: async () => { throw new Error('down'); } } })).status, 429);
});

test('two friends: join, play in one order, drop, come back with the whole game, play again', async () => {
  ctx = context(); const room = new Table(ctx, {}); const Socket = socketsFor(room);
  const adaStore = memory(), benStore = memory();
  const ada = player(room, Socket, adaStore, 'Ada'), ben = player(room, Socket, benStore, 'Ben');
  assert.equal(ada.t.open('abcd'), true); await settle(); await settle();
  assert.equal(ada.seen.states.at(-1).seat, 0);
  assert.deepEqual(ada.seen.states.at(-1).seats, [{ n: 'Ada', on: true }, null]);
  assert.equal(ada.t.move([1]), true); await settle();
  assert.deepEqual(ada.seen.moves, [], 'a move before the second player sits is not accepted');
  ada.t.leave(); await settle();
  const ada2 = player(room, Socket, adaStore, 'Ada'); ada2.t.open('ABCD'); await settle(); await settle();
  assert.equal(ada2.seen.states.at(-1).seat, 0, 'the saved key keeps the seat');
  ben.t.open('ABCD'); await settle(); await settle();
  assert.equal(ben.seen.states.at(-1).seat, 1);
  assert.deepEqual(ada2.seen.seats.at(-1), [{ n: 'Ada', on: true }, { n: 'Ben', on: true }]);
  assert.equal(ada2.seen.states.at(-1).seed, ben.seen.states.at(-1).seed);

  assert.equal(ada2.t.move([3, 4]), true); assert.equal(ada2.t.move([9]), false, 'one move at a time');
  await settle(); await settle();
  assert.deepEqual(ada2.seen.moves, [[0, 0, 3, 4]], 'the sender applies its own move from the echo');
  assert.deepEqual(ben.seen.moves, [[0, 0, 3, 4]]);
  ben.t.move([5]); await settle(); await settle();
  assert.deepEqual(ada2.seen.moves, ben.seen.moves);

  // Ben's phone loses the network. Ada sees the light go out and plays on; Ben returns and gets everything.
  Socket.made.at(-1).cut(); await settle(); await settle();
  assert.deepEqual(ada2.seen.seats.at(-1), [{ n: 'Ada', on: true }, { n: 'Ben', on: false }]);
  assert.equal(ben.seen.status.at(-1), 'waiting');
  ada2.t.move([6]); await settle();
  ben.timers.run(); await settle(); await settle();
  assert.equal(ben.seen.status.at(-1), 'live');
  assert.deepEqual(ben.seen.states.at(-1).log, [[0, 3, 4], [1, 5], [0, 6]]);
  assert.equal(ben.seen.states.at(-1).seat, 1);
  assert.deepEqual(ada2.seen.seats.at(-1), [{ n: 'Ada', on: true }, { n: 'Ben', on: true }]);
  ben.t.move([7]); await settle(); await settle();
  assert.deepEqual(ada2.seen.moves.at(-1), [3, 1, 7]);

  // A third person with the code is told the table is full and is not let in.
  const cy = player(room, Socket, memory(), 'Cy'); cy.t.open('ABCD'); await settle(); await settle(); await settle();
  assert.equal(cy.seen.status.at(-1), 'full'); assert.equal(cy.seen.states.length, 0);
  // A page with other rules is refused while the two are playing.
  const old = player(room, Socket, adaStore, 'Ada', 2); old.t.open('ABCD'); await settle(); await settle(); await settle();
  assert.equal(old.seen.status.at(-1), 'version');
  // A stolen code without the key cannot take a seat; the key never appears in any frame sent to a page.
  for (const ws of ctx.sockets) assert.ok(!JSON.stringify(ws.frames).includes(adaStore.getItem('kit-room:pitch:ABCD')), 'no key in any frame');

  // The whole table survives the object being put away: a new instance reads it from storage.
  const woken = new Table(ctx, {}); await woken.ready;
  assert.deepEqual(woken.table.log, [[0, 3, 4], [1, 5], [0, 6], [1, 7]]);

  ada2.t.again(); await settle(); assert.deepEqual(ben.seen.agains, [0]);
  ben.t.again(); await settle(); await settle();
  assert.equal(ada2.seen.games.at(-1).game, 1); assert.deepEqual(ada2.seen.games.at(-1), ben.seen.games.at(-1));
  ada2.t.move([1]); await settle(); await settle();
  assert.deepEqual(ben.seen.moves.at(-1), [0, 0, 1], 'the new game counts moves from zero');
});

test('a move sent while the table could not be reached goes out again, once', async () => {
  ctx = context(); const room = new Table(ctx, {}); const Socket = socketsFor(room);
  const ada = player(room, Socket, memory(), 'Ada'), ben = player(room, Socket, memory(), 'Ben');
  ada.t.open('WXYZ'); await settle(); await settle(); ben.t.open('WXYZ'); await settle(); await settle();
  const adaSocket = Socket.made[0]; adaSocket.cut(); await settle();
  assert.equal(ada.t.move([8]), true, 'kept while offline'); assert.equal(ada.t.waiting, true);
  ada.timers.run(); await settle(); await settle(); await settle();
  assert.deepEqual(ben.seen.moves, [[0, 0, 8]]);
  assert.equal(ada.t.waiting, false);
  assert.equal(ctx.kept.get('table').log.length, 1, 'not added twice');
  // The same seat opened in a second tab takes over; the first is told and stops.
  const tab = kitTable({ game: 'pitch', version: 1, name: () => 'Ada', Socket, where: { protocol: 'https:', host: 'x', href: 'https://x/' }, store: ada.t && { getItem: () => ctx.kept.get('table').seats[0].k, setItem() {} }, timers: ada.timers });
  tab.open('WXYZ'); await settle(); await settle(); await settle();
  assert.equal(ada.seen.status.at(-1), 'closed');
});

test('limits: a flood closes the socket, and an idle table is deleted by its alarm', async () => {
  ctx = context(); const room = new Table(ctx, {});
  const ws = await raw(room); await say(room, ws, { t: 'hi', n: 'Ada', k: key('a'), v: 1 });
  assert.equal(ws.frames[0].t, 'you'); assert.ok(ctx.alarmAt > Date.now() + TABLE.idleMs - 5000);
  for (let i = 0; i < TABLE.messages + 2; i++) await say(room, ws, 'junk');
  assert.equal(ws.closed.code, 1008);
  room.table.touched = Date.now() - TABLE.idleMs - 1;
  await room.alarm();
  assert.equal(ctx.kept.size, 0); assert.equal(room.table, null);
  // An alarm that fires early (a move came since) only sets itself again.
  const ws2 = await raw(room); await say(room, ws2, { t: 'hi', n: 'Ada', k: key('a'), v: 1 }); ctx.alarmAt = null;
  await room.alarm(); assert.ok(ctx.alarmAt); assert.equal(ctx.kept.size, 1);
});

test('codes and links', () => {
  for (let i = 0; i < 50; i++) assert.match(newCode(), /^[A-HJ-NP-Z]{4}$/);
  assert.equal(cleanCode(' ab-cd '), 'ABCD'); assert.equal(cleanCode('abc'), ''); assert.equal(cleanCode('ab1cd'), 'ABCD');
  const where = { href: 'https://play.adamwhite.work/lab/pitch/?look=1#x' };
  assert.equal(linkFor('ABCD', where), 'https://play.adamwhite.work/lab/pitch/?room=ABCD');
  assert.equal(codeFromLink({ href: 'https://play.adamwhite.work/lab/pitch/?room=abcd' }), 'ABCD');
  assert.equal(codeFromLink({ href: 'https://play.adamwhite.work/lab/pitch/' }), '');
});
