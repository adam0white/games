import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { ROOM, roomName, roomMessage, rateWindow, needsRound, freshRound, freeId } from '../src/room.mjs';
import { decode } from '../../../experiments/lab/lantern-race/sim.js';

// Run the class itself with socket/context stand-ins. Only the platform base class and 101 response are replaced;
// a wrangler dev smoke test exercises the real runtime separately. Import paths still point to the real modules.
let source = await readFile(new URL('../src/index.mjs', import.meta.url), 'utf8');
source = source.replace("import { DurableObject } from 'cloudflare:workers';", 'class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }')
  .replace(/from '(\.\/[^']+)'/g, (_, p) => `from '${new URL('../src/' + p, import.meta.url).href}'`);
const { Room, handleRoom, default: worker } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const NativeResponse = globalThis.Response;
globalThis.Response = class { constructor(body, init) { return init?.status === 101 ? { ...init, body } : new NativeResponse(body, init); } };
class Socket {
  constructor() { this.readyState = 1; this.frames = []; this.attachment = null; }
  accept() { this.accepted = true; }
  send(q) { if (this.broken) throw new Error('closed'); this.frames.push(JSON.parse(q)); }
  close(code, reason) { this.closed = { code, reason }; this.readyState = 3; }
  serializeAttachment(c) { this.attachment = structuredClone(c); }
  deserializeAttachment() { return structuredClone(this.attachment); }
}
globalThis.WebSocketPair = class { constructor() { this[0] = new Socket(); this[1] = new Socket(); this[0].server = this[1]; } };
const context = () => ({
  sockets: [],
  alarmAt: null,
  getWebSockets() { return this.sockets; },
  acceptWebSocket(ws) { this.sockets.push(ws); },
  get storage() { return { setAlarm: async time => { this.alarmAt = time; } }; },
});
const req = (path = '/lab-api/room/lantern-race/open', { origin = 'https://play.adamwhite.work', method = 'GET', upgrade = 'websocket', ip = '203.0.113.2' } = {}) => new Request(`https://play.adamwhite.work${path}`, { method, headers: { ...(origin ? { Origin: origin } : {}), ...(upgrade ? { Upgrade: upgrade } : {}), 'CF-Connecting-IP': ip } });
const connect = r => r.fetch(req()).webSocket.server;
const message = (r, ws, q) => r.webSocketMessage(ws, JSON.stringify(q));
const frames = (ws, t) => ws.frames.filter(q => q.t === t);

test('room paths: one game, open or four uppercase letters, exact path', () => {
  assert.equal(roomName('/lab-api/room/lantern-race/open'), 'lantern-race/open');
  assert.equal(roomName('/lab-api/room/lantern-race/ABCD'), 'lantern-race/ABCD');
  for (const path of ['/room/lantern-race/open', '/lab-api/room/lantern/open', '/lab-api/room/lantern-race/abcd', '/lab-api/room/lantern-race/ABC', '/lab-api/room/lantern-race/ABCDE', '/lab-api/room/lantern-race/AB12', '/lab-api/room/lantern-race/open/']) assert.equal(roomName(path), null, path);
});

test('text frames: strict fields and numeric bounds, names use the board cleaner', () => {
  for (const q of [{ t: 'ready' }, { t: 'p', x: -1, d: 0, a: 0 }, { t: 'p', x: 1, d: 100000, a: 1 }, { t: 'p', x: 0.2, d: 0.5, a: 1 }, { t: 'done', s: 0 }, { t: 'done', s: 1000000 }]) assert.deepEqual(roomMessage(JSON.stringify(q)), q);
  for (const [n, want] of [[' Ada <1> ', 'Ada 1'], ['', 'Boat'], ['<>', 'Boat'], ['sh1t', 'Player'], ['Çağla', 'Çağla']]) assert.deepEqual(roomMessage(JSON.stringify({ t: 'hi', n })), { t: 'hi', n: want });
  for (const q of [null, [], 1, {}, { t: 'hi' }, { t: 'hi', n: 1 }, { t: 'hi', n: 'A', id: 2 }, { t: 'ready', x: 0 }, { t: 'p', x: -1.1, d: 0, a: 1 }, { t: 'p', x: 0, d: 100001, a: 1 }, { t: 'p', x: 0, d: -1, a: 1 }, { t: 'p', x: '0', d: 0, a: 1 }, { t: 'p', x: 0, d: 0, a: true }, { t: 'p', x: 0, d: 0, a: 2 }, { t: 'done', s: -1 }, { t: 'done', s: 1000001 }, { t: 'done', s: 1.2 }, { t: 'done', s: '1' }, { t: 'round', seed: 5 }]) assert.equal(roomMessage(JSON.stringify(q)), null, JSON.stringify(q));
  for (const text of ['', '{', '{"t":"p","x":1e999,"d":0,"a":1}', ' '.repeat(201), new ArrayBuffer(4)]) assert.equal(roomMessage(text), null);
  const text = JSON.stringify({ t: 'hi', n: 'é'.repeat(95) });
  assert.ok(text.length < ROOM.bytes); assert.equal(roomMessage(text), null, 'UTF-8 bytes, not JS character count');
  assert.ok(roomMessage(JSON.stringify({ t: 'ready' }).padEnd(200)), 'exactly 200 bytes is allowed');
});

test('rolling message window closes at thirteen, including across second boundaries', () => {
  let times = [];
  for (let i = 0; i < 12; i++) { const r = rateWindow(times, 999); assert.equal(r.ok, true); times = r.times; }
  assert.equal(rateWindow(times, 1001).ok, false, 'new wall-clock second does not reset a burst');
  assert.deepEqual(rateWindow(times, 1999), { ok: true, times: [1999] });
  assert.deepEqual(times, Array(12).fill(999), 'pure function does not mutate its input');
});

test('round decisions: countdown, timeout, participants done, departures, late arrivals, ids', () => {
  const round = freshRound(0xffffffff, 10000), active = [{ id: 1, inRound: true, done: false }];
  assert.deepEqual(round, { seed: 4294967295, start: 14000 });
  assert.equal(needsRound(null, active, 0), true);
  assert.equal(needsRound(round, active, 10000), false);
  assert.equal(needsRound(round, active, 164000), false);
  assert.equal(needsRound(round, active, 164001), true);
  assert.equal(needsRound(round, [{ inRound: true, done: true }, { inRound: false, done: false }], 15000), true);
  assert.equal(needsRound(round, [], 15000), true);
  assert.equal(freeId([]), 1); assert.equal(freeId([{ id: 1 }, { id: 3 }]), 2);
  assert.equal(freeId(Array.from({ length: 8 }, (_, i) => ({ id: i + 1 }))), null);
});

test('class: connect, names, rounds, relays, hibernation attachments, leave and slot reuse', () => {
  const ctx = context(); let r = new Room(ctx, {});
  const a = connect(r), b = connect(r);
  assert.deepEqual(a.frames[0], { t: 'you', id: 1, peers: [], round: null });
  assert.deepEqual(b.frames[0], { t: 'you', id: 2, peers: [{ id: 1, n: 'Boat' }], round: null });
  message(r, a, { t: 'hi', n: 'Canoe' }); assert.deepEqual(b.frames.at(-1), { t: 'join', id: 1, n: 'Canoe' });
  const before = Date.now(); message(r, a, { t: 'ready' });
  assert.equal(frames(a, 'round').length, 0, 'one Ready does not start a two-socket room');
  r = new Room(ctx, {});
  message(r, b, { t: 'ready' });
  const round = frames(a, 'round')[0]; assert.ok(round.start >= before + 4000 && round.start <= Date.now() + 4000);
  assert.ok(Number.isInteger(round.seed) && round.seed >= 0 && round.seed <= 0xffffffff);
  assert.deepEqual(frames(b, 'round')[0], round);
  assert.deepEqual(a.frames.at(-2), { t: 'roster', ids: [1, 2] });
  assert.deepEqual(decode(JSON.stringify(round)), round);
  assert.equal(decode(JSON.stringify(a.frames.at(-2))), null, 'old clients silently ignore the roster');
  message(r, b, { t: 'ready' }); assert.equal(frames(a, 'round').length, 1, 'active round cannot be reset');
  message(r, a, { t: 'p', x: -0.2, d: 42, a: 1 });
  assert.equal(frames(a, 'p').length, 0); assert.deepEqual(b.frames.at(-1), { t: 'p', id: 1, x: -0.2, d: 42, a: 1 });
  message(r, a, { t: 'done', s: 42 }); assert.deepEqual(a.frames.at(-1), { t: 'done', id: 1, s: 42 });
  assert.deepEqual(b.frames.at(-1), a.frames.at(-1));
  r = new Room(ctx, {}); // same sockets, no JS memory: restore round, names, done flags and rate windows
  assert.equal(r.clients.get(a).n, 'Canoe'); assert.equal(r.clients.get(a).done, true);
  assert.deepEqual(r.round, { seed: round.seed, start: round.start });
  const late = connect(r); assert.deepEqual(late.frames[0].round, r.round);
  message(r, late, { t: 'ready' }); assert.equal(frames(a, 'round').length, 1);
  message(r, b, { t: 'done', s: 55 });
  for (const ws of [a, b, late]) assert.equal(ws.deserializeAttachment().round, null);
  r = new Room(ctx, {});
  message(r, late, { t: 'ready' });
  assert.equal(frames(a, 'round').length, 1, 'a new round requires new Ready messages');
  message(r, a, { t: 'ready' }); message(r, b, { t: 'ready' });
  assert.equal(frames(a, 'round').length, 2);
  assert.equal(r.clients.get(late).inRound, true, 'late arrival participates in the next round');
  r.webSocketClose(b, 1000, 'bye'); assert.deepEqual(a.frames.at(-1), { t: 'leave', id: 2 });
  assert.equal(b.deserializeAttachment(), null); assert.equal(connect(r).frames[0].id, 2);
  for (const ws of [...r.clients.keys()]) r.webSocketClose(ws, 1006, '');
  assert.equal(r.round, null); assert.equal(new Room(ctx, {}).clients.size, 0);
});

test('the 8-second alarm starts only ready racers after reconstruction, without another client message', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 10_000 });
  const ctx = context();
  let r = new Room(ctx, {});
  const a = connect(r), b = connect(r), idle = connect(r);
  message(r, a, { t: 'ready' });
  assert.equal(ctx.alarmAt, 18_000);
  t.mock.timers.tick(3000);
  message(r, b, { t: 'ready' });
  message(r, a, { t: 'ready' });
  assert.equal(ctx.alarmAt, 18_000, 'subsequent Ready frames do not extend the deadline');
  r = new Room(ctx, {});
  t.mock.timers.tick(4999); r.alarm();
  assert.equal(frames(a, 'round').length, 0);
  t.mock.timers.tick(1); r.alarm(); r.alarm();
  assert.equal(frames(a, 'round').length, 1, 'alarm retry cannot start a duplicate');
  assert.equal(frames(a, 'round')[0].start, 22_000);
  assert.deepEqual(frames(a, 'roster'), [{ t: 'roster', ids: [1, 2] }]);
  assert.deepEqual(frames(a, 'round'), frames(b, 'round'));
  assert.equal(frames(idle, 'round').length, 0);
  assert.equal(idle.deserializeAttachment().inRound, false);
  message(r, idle, { t: 'p', x: 0, d: 1, a: 1 });
  message(r, idle, { t: 'done', s: 1 });
  assert.equal(frames(a, 'p').length, 0);
  assert.equal(frames(a, 'done').length, 0);
  message(r, a, { t: 'done', s: 2 });
  assert.notEqual(connect(r).frames[0].round, null, 'one racer remains');
  message(r, b, { t: 'done', s: 3 });
  const welcome = connect(new Room(ctx, {})).frames[0];
  assert.equal(welcome.round, null);
  assert.deepEqual(decode(JSON.stringify(welcome)), welcome);
});

test('an overdue alarm does not let a late Ready or arrival change the roster', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 10_000 });
  const r = new Room(context(), {}), a = connect(r), b = connect(r);
  message(r, a, { t: 'ready' });
  t.mock.timers.tick(8001);
  message(r, b, { t: 'ready' });
  assert.deepEqual(frames(a, 'roster'), [{ t: 'roster', ids: [1] }]);
  assert.equal(frames(b, 'round').length, 0);
  assert.equal(connect(r).frames[0].round.start, 22_001);
});

test('departures satisfy quorum, discard a departed Ready, and clear the last racer', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 10_000 });
  const ctx = context(), r = new Room(ctx, {}), a = connect(r), b = connect(r);
  message(r, a, { t: 'ready' });
  r.webSocketClose(a, 1000, '');
  t.mock.timers.tick(8000); r.alarm();
  assert.equal(frames(b, 'round').length, 0);
  const c = connect(r);
  message(r, b, { t: 'ready' });
  assert.equal(ctx.alarmAt, 26_000);
  r.webSocketClose(c, 1000, '');
  assert.equal(frames(b, 'round')[0].start, 22_000, 'the remaining ready socket starts immediately');
  const spectator = connect(r);
  r.webSocketClose(b, 1000, '');
  assert.equal(spectator.deserializeAttachment().round, null);
  assert.equal(connect(new Room(ctx, {})).frames[0].round, null);
});

test('a failed round announcement removes the departed racer from later rosters', () => {
  const r = new Room(context(), {}), a = connect(r), b = connect(r);
  message(r, a, { t: 'ready' });
  a.broken = true;
  message(r, b, { t: 'ready' });
  assert.deepEqual(b.frames.slice(-3, -1), [{ t: 'leave', id: 1 }, { t: 'roster', ids: [2] }]);
  assert.equal(frames(b, 'round').length, 1);
});

test('class: room full, invalid frames ignored, rate survives wake, failed sockets leave once', () => {
  const ctx = context(); let r = new Room(ctx, {});
  const sockets = Array.from({ length: 8 }, () => connect(r));
  const ninth = connect(r); assert.equal(ninth.closed.code, 4001); assert.equal(r.clients.size, 8);
  const a = sockets[0], b = sockets[1], n = b.frames.length;
  for (let i = 0; i < 12; i++) r.webSocketMessage(a, i % 2 ? new ArrayBuffer(1) : '{');
  assert.equal(a.closed, undefined); assert.equal(b.frames.length, n, 'invalid frames were not relayed');
  r = new Room(ctx, {}); r.webSocketMessage(a, '{'); assert.equal(a.closed.code, 1008);
  assert.deepEqual(b.frames.at(-1), { t: 'leave', id: 1 });
  const left = frames(b, 'leave').length; r.webSocketClose(a, 1008, ''); assert.equal(frames(b, 'leave').length, left);
  sockets[2].broken = true; message(r, b, { t: 'p', x: 0, d: 1, a: 1 });
  assert.equal(r.clients.has(sockets[2]), false);
  r.webSocketError(b); assert.equal(b.closed.code, 1011); assert.equal(r.clients.has(b), false);
});

test('routing: origin, upgrade, per-IP guard, distinct objects, namespace failures', async () => {
  const names = [], keys = [], forwarded = [];
  const env = { PER_IP: { limit: async ({ key }) => { keys.push(key); return { success: true }; } }, ROOM: { idFromName: n => { names.push(n); return n; }, get: name => ({ fetch: async request => { forwarded.push(request); return new NativeResponse(name); } }) } };
  for (const [request, code] of [[req('/lab-api/room/no/open'), 404], [req(undefined, { origin: null }), 403], [req(undefined, { origin: 'https://evil.example' }), 403], [req(undefined, { origin: 'http://localhost.evil.example' }), 403], [req(undefined, { method: 'POST' }), 405], [req(undefined, { upgrade: null }), 426]]) assert.equal((await handleRoom(request, env)).status, code);
  assert.equal(names.length, 0); assert.equal(keys.length, 0, 'invalid upgrades do not touch limiters or objects');
  for (const code of ['open', 'ABCD']) assert.equal((await handleRoom(req(`/lab-api/room/lantern-race/${code}`, { origin: 'http://localhost:8787' }), env)).status, 200);
  assert.deepEqual(names, ['lantern-race/open', 'lantern-race/ABCD']); assert.deepEqual(keys, ['room:203.0.113.2', 'room:203.0.113.2']);
  assert.equal(forwarded.length, 2);
  env.PER_IP.limit = async () => ({ success: false }); assert.equal((await handleRoom(req(), env)).status, 429);
  env.PER_IP.limit = async () => { throw new Error('down'); }; assert.equal((await handleRoom(req(), env)).status, 429);
  env.PER_IP.limit = async () => ({ success: true }); env.ROOM.get = () => { throw new Error('down'); };
  assert.equal((await handleRoom(req(), env)).status, 503);
  assert.equal((await worker.fetch(req(), env, {})).status, 503, 'front door dispatches to room');
});

// The close event may be the first event after hibernation; the runtime can omit that socket from its list.
test('a close waking a room still announces leave exactly once, even if the runtime omitted the socket', () => {
  const ctx = context(); let r = new Room(ctx, {});
  const a = connect(r), b = connect(r); message(r, a, { t: 'hi', n: 'Ada' });
  a.readyState = 3; ctx.sockets = [b]; r = new Room(ctx, {});
  assert.equal(r.clients.has(a), false); r.webSocketClose(a, 1000, 'bye');
  assert.deepEqual(b.frames.at(-1), { t: 'leave', id: 1 });
  const n = b.frames.length; r.webSocketClose(a, 1000, 'bye'); assert.equal(b.frames.length, n);
  assert.equal(a.deserializeAttachment(), null);
});

test('done reports reach everyone even outside a round; only participants affect completion', () => {
  const r = new Room(context(), {}), a = connect(r), b = connect(r);
  message(r, a, { t: 'done', s: 7 });
  assert.deepEqual(a.frames.at(-1), { t: 'done', id: 1, s: 7 }); assert.deepEqual(b.frames.at(-1), a.frames.at(-1));
  assert.equal(r.clients.get(a).done, false);
  message(r, a, { t: 'ready' }); message(r, b, { t: 'ready' });
  const late = connect(r); message(r, late, { t: 'done', s: 9 });
  assert.equal(r.clients.get(late).done, false);
  assert.equal(frames(a, 'done').length, 1, 'spectator score is not relayed into an active race');
  assert.notEqual(r.round, null);
});
