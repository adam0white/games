import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { ROOM, RELAY, roomName, relayMessage, roomMessage, rateWindow, seatKey } from '../src/room.mjs';
import { relay as kitRelay } from '../../../experiments/kit/room.js';
import { lockstep } from '../../../experiments/kit/lockstep.js';
import { sameMath } from '../../../experiments/kit/samemath.js';
import { createMatch, useMath } from '../../../experiments/duel/sim.js';
import { makeBot } from '../../../experiments/duel/brain.js';
import { drive, stateHash, MSG } from '../../../experiments/duel/net.js';

// Relay rooms (Thumb Duel by link) in the same Room class as the race. The class runs with stand-ins for sockets and the
// platform base class, as in room.test.mjs; the page side is the real experiments/kit/room.js relay client.
let source = await readFile(new URL('../src/index.mjs', import.meta.url), 'utf8');
source = source.replace("import { DurableObject } from 'cloudflare:workers';", 'class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }')
  .replace(/from '(\.\/[^']+)'/g, (_, p) => `from '${new URL('../src/' + p, import.meta.url).href}'`);
const { Room, handleRoom } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const NativeResponse = globalThis.Response;
globalThis.Response = class { constructor(body, init) { return init?.status === 101 ? { ...init, body } : new NativeResponse(body, init); } };
class ServerSocket {
  constructor() { this.readyState = 1; this.frames = []; this.attachment = null; this.peer = null; }
  accept() { this.accepted = true; }
  send(q) { if (this.readyState !== 1) throw new Error('closed'); this.frames.push(JSON.parse(q)); this.peer?.deliver(q); }
  close(code, reason) { if (this.readyState === 3) return; this.readyState = 3; this.closed = { code, reason }; this.peer?.serverClosed(code); }
  serializeAttachment(c) { this.attachment = structuredClone(c); }
  deserializeAttachment() { return structuredClone(this.attachment); }
}
globalThis.WebSocketPair = class { constructor() { this[0] = { server: null }; this[1] = new ServerSocket(); this[0].server = this[1]; } };
const context = () => ({ sockets: [], getWebSockets() { return this.sockets.filter(s => s.readyState === 1); }, acceptWebSocket(ws) { this.sockets.push(ws); }, storage: { setAlarm: async () => {} } });
const req = (path = '/lab-api/room/duel/ABCD', { origin = 'https://play.adamwhite.work', k } = {}) => new Request(`https://play.adamwhite.work${path}${k ? `?k=${k}` : ''}`, { headers: { ...(origin ? { Origin: origin } : {}), Upgrade: 'websocket', 'CF-Connecting-IP': '203.0.113.9' } });
const raw = (room, k) => room.fetch(req(undefined, { k })).webSocket.server;
const say = (room, ws, q) => room.webSocketMessage(ws, typeof q === 'string' ? q : JSON.stringify(q));
const settle = () => new Promise(r => setTimeout(r, 0));

test('relay paths: duel takes four-letter codes only; the race keeps open and codes', () => {
  assert.equal(roomName('/lab-api/room/duel/ABCD'), 'duel/ABCD');
  assert.equal(roomName('/lab-api/room/duel/open'), null, 'no public duel room');
  for (const p of ['/lab-api/room/duel/abcd', '/lab-api/room/duel/ABC', '/lab-api/room/duel/ABCDE', '/lab-api/room/duels/ABCD', '/lab-api/room/duel/ABCD/']) assert.equal(roomName(p), null, p);
  assert.equal(roomName('/lab-api/room/lantern-race/open'), 'lantern-race/open');
  assert.deepEqual(RELAY.duel, { sockets: 2, messages: 30, ints: 64 });
  assert.equal(ROOM.messages, 12, 'the race limit is unchanged');
});

test('relay frames: integers only, bounded, nothing else; race frames are not relay frames', () => {
  for (const d of [[0], [1, -1, 4294967295, -2147483648], Array(64).fill(1)]) assert.deepEqual(relayMessage(JSON.stringify({ t: 'r', d })), { t: 'r', d });
  for (const q of [{ t: 'r' }, { t: 'r', d: [] }, { t: 'r', d: [1.5] }, { t: 'r', d: ['1'] }, { t: 'r', d: [4294967296] }, { t: 'r', d: [-2147483649] }, { t: 'r', d: Array(65).fill(1) },
    { t: 'r', d: [1], x: 1 }, { t: 'p', x: 0, d: 0, a: 0 }, { t: 'hi', n: 'A' }, { t: 'r', d: [null] }, { t: 'r', d: [[1]] }, [1], null]) assert.equal(relayMessage(JSON.stringify(q)), null, JSON.stringify(q));
  assert.equal(relayMessage(JSON.stringify({ t: 'r', d: Array(60).fill(123456789) })), null, 'more than 200 bytes');
  assert.equal(roomMessage(JSON.stringify({ t: 'r', d: [1] })), null, 'the race does not accept relay frames');
  assert.equal(seatKey('a'.repeat(18)), 'a'.repeat(18)); for (const k of ['A'.repeat(18), 'a'.repeat(15), 'a'.repeat(41), 'a-'.repeat(9), null]) assert.equal(seatKey(k), null);
  let times = []; for (let i = 0; i < 30; i++) { const r = rateWindow(times, 500, RELAY.duel.messages); assert.equal(r.ok, true); times = r.times; }
  assert.equal(rateWindow(times, 900, RELAY.duel.messages).ok, false, 'the 31st frame in a second closes a duel socket');
});

test('class: two seats, frames pass to the other seat only, a third socket is refused, leave is announced', () => {
  const ctx = context(), r = new Room(ctx, {});
  const a = raw(r, 'a'.repeat(18)), b = raw(r, 'b'.repeat(18));
  assert.deepEqual(a.frames[0], { t: 'you', id: 1, peers: [], round: null });
  assert.deepEqual(b.frames[0], { t: 'you', id: 2, peers: [{ id: 1, n: 'Boat' }], round: null });
  assert.deepEqual(a.frames.at(-1), { t: 'join', id: 2, n: 'Boat' });
  const third = raw(r, 'c'.repeat(18)); assert.equal(third.closed.code, 4001); assert.equal(r.clients.size, 2);
  say(r, a, { t: 'r', d: [1, 2, 3] });
  assert.deepEqual(b.frames.at(-1), { t: 'r', id: 1, d: [1, 2, 3] }); assert.equal(a.frames.filter(q => q.t === 'r').length, 0, 'no echo');
  for (const q of [{ t: 'hi', n: 'Ada' }, { t: 'ready' }, { t: 'p', x: 0, d: 0, a: 0 }, { t: 'done', s: 1 }, '{', { t: 'r', d: [0.5] }]) say(r, a, q);
  assert.equal(b.frames.length, 2, 'race frames and bad frames are not passed on in a duel room');
  assert.equal(r.round, null, 'a duel room never starts a race round');
  assert.equal(a.deserializeAttachment().k, 'a'.repeat(18)); assert.equal(a.deserializeAttachment().game, 'duel');
  const woken = new Room(ctx, {}); say(woken, a, { t: 'r', d: [9] }); assert.deepEqual(b.frames.at(-1), { t: 'r', id: 1, d: [9] }, 'relaying survives hibernation');
  woken.webSocketClose(b, 1000, ''); assert.deepEqual(a.frames.at(-1), { t: 'leave', id: 2 });
});

test('class: the same seat key replaces its own stale socket instead of finding the room full', () => {
  const r = new Room(context(), {});
  const a = raw(r, 'a'.repeat(18)), b = raw(r, 'b'.repeat(18));
  const again = raw(r, 'b'.repeat(18));
  assert.equal(b.closed.code, 4003, 'the stale socket is closed'); assert.equal(again.closed, undefined);
  assert.equal(r.clients.size, 2); assert.equal(again.frames[0].id, 2);
  assert.deepEqual(a.frames.slice(-2), [{ t: 'leave', id: 2 }, { t: 'join', id: 2, n: 'Boat' }]);
  const nokey = raw(r); assert.equal(nokey.closed.code, 4001, 'no key, no replacement');
});

test('class: more than 30 frames in a second closes a duel socket; 30 do not', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 50_000 });
  const r = new Room(context(), {}), a = raw(r, 'a'.repeat(18)), b = raw(r, 'b'.repeat(18));
  for (let i = 0; i < 30; i++) say(r, a, { t: 'r', d: [i] });
  assert.equal(a.closed, undefined); assert.equal(b.frames.filter(q => q.t === 'r').length, 30);
  t.mock.timers.tick(999); say(r, a, { t: 'r', d: [30] }); assert.equal(a.closed.code, 1008);
});

test('routing: duel codes reach their own object through the same limiter; open and other games do not', async () => {
  const names = [], keys = [];
  const env = { PER_IP: { limit: async ({ key }) => { keys.push(key); return { success: true }; } }, ROOM: { idFromName: n => { names.push(n); return n; }, get: name => ({ fetch: async () => new NativeResponse(name) }) } };
  assert.equal((await handleRoom(req('/lab-api/room/duel/open'), env)).status, 404);
  assert.equal((await handleRoom(req(undefined, { origin: 'https://evil.example' }), env)).status, 403);
  assert.equal((await handleRoom(req(undefined, { k: 'a'.repeat(18) }), env)).status, 200);
  assert.deepEqual(names, ['duel/ABCD']); assert.deepEqual(keys, ['room:203.0.113.9']);
});

// The page side: the real kit relay client and the real kit lockstep, two phones and the real Room class between them.
function pageSocketsFor(room) {
  return class PageSocket {
    constructor(address) {
      this.readyState = 0; this.address = address; PageSocket.made.push(this);
      const u = new URL(address.replace(/^ws/, 'http'));
      Promise.resolve(room.fetch(req(u.pathname, { k: u.searchParams.get('k') }))).then(r => {
        this.server = r.webSocket.server; this.server.peer = this;
        if (this.readyState === 3) return;
        if (this.server.readyState === 3) { this.serverClosed(this.server.closed.code); return; }
        this.readyState = 1; this.onopen?.();
        for (const q of this.server.frames) this.deliver(JSON.stringify(q));
      });
    }
    send(text) { if (this.readyState !== 1) throw new Error('not open'); room.webSocketMessage(this.server, text); }
    deliver(text) { if (this.readyState === 1) queueMicrotask(() => this.onmessage?.({ data: text })); }
    serverClosed(code) { if (this.readyState === 3) return; this.readyState = 3; queueMicrotask(() => this.onclose?.({ code })); }
    close() { if (this.readyState === 3) return; this.readyState = 3; if (this.server?.readyState === 1) { this.server.readyState = 3; room.webSocketClose(this.server, 1000, ''); } }
    cut() { this.readyState = 3; queueMicrotask(() => this.onclose?.({ code: 1006 })); } // the server does not hear it: its socket goes stale
    static made = [];
  };
}
const memory = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => { m.set(k, String(v)); } }; };
const timers = () => ({ waits: [], setTimeout(fn) { this.waits.push(fn); return this.waits.length; }, clearTimeout() {}, run() { for (const fn of this.waits.splice(0)) fn(); } });

test('two phones play one seeded duel through the relay, lose the line, take their seats back and finish identical', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: 1_000_000 });
  const room = new Room(context(), {}), Socket = pageSocketsFor(room), where = { protocol: 'https:', host: 'play.adamwhite.work' };
  useMath(sameMath);
  const phones = [0, 1].map(me => {
    const p = { me, s: createMatch({ seed: 99, only: 'tug', intro: 0.2, result: 0.2 }), ls: lockstep({ id: 1, delay: 6 }), bot: makeBot('medium', me + 3), acc: 0, hashes: [], status: [], peers: [], clock: timers() };
    p.onTick = () => { p.s.events.length = 0; p.hashes.push(stateHash(p.s)); };
    p.r = kitRelay({ game: 'duel', Socket, where, store: memory(), timers: p.clock, onFrame: d => { if (d[0] === MSG.input) p.ls.receive(d.slice(1), now); }, onPeer: h => { p.peers.push(h); if (h) p.ls.resend(); }, onStatus: s => p.status.push(s) });
    return p;
  });
  let now = 0;
  phones[0].r.open('WXYZ'); await settle(); phones[1].r.open('WXYZ'); await settle();
  assert.deepEqual(phones.map(p => p.status.at(-1)), ['live', 'live']); assert.deepEqual(phones.map(p => p.peers.at(-1)), [true, true]);
  const frame = async () => {
    now += 1000 / 60; t.mock.timers.tick(1000 / 60);
    for (const p of phones) {
      const r = drive(p, p.acc + 1 / 60, () => p.bot.act(p.s, p.me)); p.acc = r.acc;
      if (Math.round(now) % 50 < 17) { const f = p.ls.frame(now); if (f) p.r.send([MSG.input, ...f]); }
    }
    await settle();
  };
  for (let i = 0; i < 240; i++) await frame();
  const before = phones[1].ls.tick;
  Socket.made.at(-1).cut();                          // phone 2's network drops; the server still holds its old socket
  await settle(); assert.equal(phones[1].status.at(-1), 'waiting');
  for (let i = 0; i < 60; i++) await frame();        // phone 1 runs out of phone 2's inputs and waits
  assert.ok(phones[0].ls.tick - before <= 12, 'the other phone stalls instead of guessing');
  phones[1].clock.run(); await settle();             // the retry: the seat key takes the stale seat back
  assert.equal(phones[1].status.at(-1), 'live');
  phones[1].ls.resend();
  for (let i = 0; i < 9000 && !(phones[0].s.over && phones[1].s.over); i++) await frame();
  useMath(Math);
  assert.ok(phones[0].s.over && phones[1].s.over, 'the match finished on both phones ' + JSON.stringify(phones.map(p => [p.ls.stats, p.status, p.s.duels.length, p.s.t])));
  assert.deepEqual(phones[0].hashes, phones[1].hashes, 'identical tick for tick');
  assert.deepEqual(phones[0].s.duels, phones[1].s.duels);
  assert.deepEqual(phones.map(p => p.ls.mismatch), [null, null]);
  for (const ws of room.ctx.sockets) for (const q of ws.frames) assert.ok(!JSON.stringify(q).includes('aaaa') && !('k' in q), 'no seat key in any frame');
});
