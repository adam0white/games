import { DurableObject } from 'cloudflare:workers';
import { handle, takeOne, readSpend, originAllowed } from './core.mjs';
import { handleBoard, boardTop, boardPut, boardRemove, boardStart } from './board.mjs';
import { ROOM, RELAY, roomName, roomMessage, relayMessage, rateWindow, needsRound, freshRound, freeId, gameOf, limitsOf, seatKey } from './room.mjs';
import { TABLE, tableName, tableMessage, freshTable, sit, move, again, shown } from './table.mjs';

// One instance of this class (named "global") counts model calls per UTC day for the shared daily cap.
export class DailyCounter extends DurableObject {
  take(day, cap, endpoint = 'persona') { return takeOne(this.ctx.storage.sql, day, cap, endpoint); }
  spend(day) { return readSpend(this.ctx.storage.sql, day); }
}

// One instance per game (named by the game) holds that game's shared leaderboard. See board.mjs.
export class Board extends DurableObject {
  top(limit, day) { return boardTop(this.ctx.storage.sql, limit, day); }
  put(q, now, need, day) { return boardPut(this.ctx.storage.sql, q, now, undefined, need, day); }
  remove(id, now, day) { return boardRemove(this.ctx.storage.sql, id, now, day); }
  start(r, now) { return boardStart(this.ctx.storage.sql, r, now); }
}

// One instance per <game>/<code>. An alarm handles the Ready deadline. Socket attachments carry the
// readiness and round state through hibernation and disappear when the sockets close.
export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.clients = new Map(); this.round = null;
    for (const ws of ctx.getWebSockets()) {
      const c = ws.deserializeAttachment();
      if (!c || ws.readyState !== 1) continue;
      this.clients.set(ws, c);
      if (c.round && (!this.round || c.round.start > this.round.start)) this.round = c.round;
    }
    this.clearFinishedRound(Date.now());
  }
  save(ws, c) { ws.serializeAttachment(c); }
  send(ws, q) { try { ws.send(JSON.stringify(q)); } catch { try { ws.close(1011, 'socket error'); } catch {} this.drop(ws); } }
  broadcast(q, except) { for (const ws of [...this.clients.keys()]) if (ws !== except) this.send(ws, q); }
  clearFinishedRound(now) {
    if (!this.round || !needsRound(this.round, [...this.clients.values()], now)) return;
    this.round = null;
    for (const [ws, c] of this.clients) {
      c.round = null; c.inRound = false; c.done = false;
      this.save(ws, c);
    }
  }
  startIfReady(now) {
    if (this.round) return;
    const racers = [...this.clients].filter(([, c]) => c.readyBy != null);
    if (!racers.length || (racers.length < this.clients.size && now < racers[0][1].readyBy)) return;

    const round = freshRound(crypto.getRandomValues(new Uint32Array(1))[0], now);
    this.round = round;
    for (const [ws, c] of this.clients) {
      c.round = round; c.inRound = c.readyBy != null; c.done = false; c.readyBy = null;
      this.save(ws, c);
    }
    for (const [ws] of racers) {
      if (!this.clients.has(ws)) continue;
      // Older clients ignore this frame and still accept the original round frame.
      const ids = racers.filter(([socket]) => this.clients.has(socket)).map(([, c]) => c.id);
      this.send(ws, { t: 'roster', ids });
      if (this.clients.has(ws)) this.send(ws, { t: 'round', ...round });
    }
  }
  alarm() { this.startIfReady(Date.now()); }
  drop(ws) {
    // A close can wake an evicted object after getWebSockets() has already omitted the closing socket.
    const c = this.clients.get(ws) ?? ws.deserializeAttachment(); if (!c) return;
    this.clients.delete(ws); ws.serializeAttachment(null);
    const now = Date.now();
    this.clearFinishedRound(now);
    this.broadcast({ t: 'leave', id: c.id });
    this.startIfReady(now);
  }
  fetch(request) {
    if (request.method !== 'GET') return new Response('method', { status: 405 });
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return new Response('websocket required', { status: 426 });
    const now = Date.now();
    this.clearFinishedRound(now);
    this.startIfReady(now);
    // A relay room (RELAY in room.mjs) has two seats and passes frames on; a returning seat key replaces its own stale socket.
    const url = new URL(request.url), game = gameOf(roomName(url.pathname)), relay = !!RELAY[game], key = relay ? seatKey(url.searchParams.get('k')) : null;
    if (key) for (const [old, c] of [...this.clients]) if (c.k === key) { try { old.close(4003, 'replaced'); } catch {} this.drop(old); }
    const pair = new WebSocketPair(), ws = pair[1];
    // The ninth socket (the third in a relay room) gets a WebSocket close, not an HTTP error. It never becomes a participant.
    const id = freeId([...this.clients.values()], limitsOf(game).sockets);
    if (id === null) { ws.accept(); ws.close(4001, 'room full'); return new Response(null, { status: 101, webSocket: pair[0] }); }
    const peers = [...this.clients.values()].map(c => ({ id: c.id, n: c.n }));
    this.ctx.acceptWebSocket(ws);
    const c = { id, n: 'Boat', times: [], readyBy: null, inRound: false, done: false, round: this.round };
    if (relay) { c.game = game; c.k = key; }
    this.clients.set(ws, c); this.save(ws, c);
    this.send(ws, { t: 'you', id, peers, round: this.round });
    this.broadcast({ t: 'join', id, n: c.n }, ws);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }
  webSocketMessage(ws, text) {
    const c = this.clients.get(ws); if (!c) return;
    const now = Date.now(), rate = rateWindow(c.times, now, limitsOf(c.game).messages); c.times = rate.times;
    if (!rate.ok) { ws.close(1008, 'message rate'); this.drop(ws); return; }
    this.save(ws, c);
    if (RELAY[c.game]) { const r = relayMessage(text); if (r) this.broadcast({ t: 'r', id: c.id, d: r.d }, ws); return; }
    const q = roomMessage(text); if (!q) return;
    if (q.t === 'hi') {
      c.n = q.n; this.save(ws, c); this.broadcast({ t: 'join', id: c.id, n: c.n }, ws);
    } else if (q.t === 'ready') {
      this.clearFinishedRound(now);
      this.startIfReady(now);
      if (this.round || !this.clients.has(ws) || c.readyBy != null) return;
      const deadline = [...this.clients.values()].find(client => client.readyBy != null)?.readyBy;
      c.readyBy = deadline ?? now + ROOM.readyMs;
      this.save(ws, c);
      this.startIfReady(now);
      if (deadline == null && c.readyBy != null) return this.ctx.storage.setAlarm(c.readyBy);
    } else if (!this.round || c.inRound) {
      if (q.t === 'p') this.broadcast({ ...q, id: c.id }, ws);
      else {
        if (c.inRound) {
          c.done = true; this.save(ws, c);
          this.clearFinishedRound(now);
        }
        this.broadcast({ ...q, id: c.id });
      }
    }
  }
  webSocketClose(ws, code, reason) {
    this.drop(ws);
    try { if (code >= 1000 && code < 5000 && ![1004, 1005, 1006, 1015].includes(code)) ws.close(code, reason); else ws.close(); } catch {}
  }
  webSocketError(ws) { try { ws.close(1011, 'socket error'); } catch {} this.drop(ws); }
}

// One instance per <game>/<code>: a friends' table for a turn-based game. Unlike Room, this one writes to storage:
// the seats (a random key and a cleaned name each), the seed and the list of moves, so a player who drops gets the game back.
// An alarm deletes all of it after TABLE.idleMs without a move or a join. No address is stored and nothing is logged.
export class Table extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.table = null;
    this.ready = ctx.blockConcurrencyWhile(async () => { this.table = (await ctx.storage.get('table')) ?? null; });
  }
  seed() { return crypto.getRandomValues(new Uint32Array(1))[0]; }
  sockets() { return this.ctx.getWebSockets().filter(ws => ws.readyState === 1); }
  on() { return [...new Set(this.sockets().map(ws => ws.deserializeAttachment()?.seat).filter(seat => Number.isInteger(seat)))]; }
  send(ws, q) { try { ws.send(JSON.stringify(q)); } catch { try { ws.close(1011, 'socket error'); } catch {} } }
  broadcast(q) { for (const ws of this.sockets()) if (Number.isInteger(ws.deserializeAttachment()?.seat)) this.send(ws, q); }
  async keep(now) { await this.ctx.storage.put('table', this.table); await this.ctx.storage.setAlarm(now + TABLE.idleMs); }
  async fetch(request) {
    if (request.method !== 'GET') return new Response('method', { status: 405 });
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return new Response('websocket required', { status: 426 });
    const named = tableName(new URL(request.url).pathname);
    if (!named) return new Response('not found', { status: 404 });
    const pair = new WebSocketPair(), ws = pair[1];
    // Seats are few, but a page may reconnect before its old socket has closed. Sixteen sockets is far above any honest use.
    if (this.sockets().length >= 16) { ws.accept(); ws.close(4001, 'full'); return new Response(null, { status: 101, webSocket: pair[0] }); }
    this.ctx.acceptWebSocket(ws);
    ws.serializeAttachment({ game: named.game, seat: null, times: [] });
    return new Response(null, { status: 101, webSocket: pair[0] });
  }
  async webSocketMessage(ws, text) {
    await this.ready;
    const c = ws.deserializeAttachment(); if (!c) return;
    const now = Date.now(), rate = rateWindow(c.times, now); c.times = rate.times; ws.serializeAttachment(c);
    if (!rate.ok) { ws.close(1008, 'message rate'); return; }
    const q = tableMessage(text); if (!q) return;
    if (q.t === 'hi') {
      this.table ??= freshTable(TABLE.games[c.game].seats, this.seed(), now);
      const got = sit(this.table, q, this.on(), this.seed(), now);
      if (got.refuse) { this.send(ws, { t: 'no', why: got.refuse }); ws.close(got.refuse === 'full' ? 4001 : 4002, got.refuse); return; }
      // One socket per seat: a second tab or a reconnect takes the seat over and the older socket is closed.
      for (const other of this.sockets()) if (other !== ws && other.deserializeAttachment()?.seat === got.seat) { other.serializeAttachment(null); try { other.close(4003, 'moved'); } catch {} }
      c.seat = got.seat; ws.serializeAttachment(c);
      await this.keep(now);
      const t = this.table, seats = shown(t, this.on());
      this.send(ws, { t: 'you', seat: got.seat, v: t.v, game: t.game, seed: t.seed, seats, log: t.log, again: t.again });
      this.broadcast({ t: 'seats', seats });
      return;
    }
    if (!Number.isInteger(c.seat) || !this.table) return;
    if (q.t === 'm') {
      const result = move(this.table, c.seat, q, now);
      if (result === 'ok') { await this.keep(now); this.broadcast({ t: 'm', i: q.i, s: c.seat, m: q.m }); }
      // A page that is behind, or ahead of the table, gets the whole list again and replaces what it has.
      else if (result === 'stale' || result === 'long') { const t = this.table; this.send(ws, { t: 'you', seat: c.seat, v: t.v, game: t.game, seed: t.seed, seats: shown(t, this.on()), log: t.log, again: t.again }); }
    } else if (q.t === 'again') {
      const started = again(this.table, c.seat, this.seed(), now);
      await this.keep(now);
      if (started) this.broadcast({ t: 'game', game: this.table.game, seed: this.table.seed });
      else this.broadcast({ t: 'again', s: c.seat });
    }
  }
  async left(ws) {
    await this.ready;
    const c = ws.deserializeAttachment(); ws.serializeAttachment(null);
    if (!c || !Number.isInteger(c.seat) || !this.table) return;
    // The seat stays the player's own; only its light goes out. The socket that is closing is no longer counted.
    const on = [...new Set(this.sockets().filter(other => other !== ws).map(other => other.deserializeAttachment()?.seat).filter(seat => Number.isInteger(seat)))];
    for (const other of this.sockets()) if (other !== ws && Number.isInteger(other.deserializeAttachment()?.seat)) this.send(other, { t: 'seats', seats: shown(this.table, on) });
  }
  async webSocketClose(ws, code, reason) {
    await this.left(ws);
    try { if (code >= 1000 && code < 5000 && ![1004, 1005, 1006, 1015].includes(code)) ws.close(code, reason); else ws.close(); } catch {}
  }
  async webSocketError(ws) { try { ws.close(1011, 'socket error'); } catch {} await this.left(ws); }
  async alarm() {
    await this.ready;
    const now = Date.now();
    if (this.table && now - this.table.touched < TABLE.idleMs) { await this.ctx.storage.setAlarm(this.table.touched + TABLE.idleMs); return; }
    for (const ws of this.sockets()) { try { ws.close(4004, 'table closed'); } catch {} }
    this.table = null; await this.ctx.storage.deleteAll();
  }
}

// Tables have their own, looser limit: friends on one Wi-Fi share an address, and a phone reconnects whenever it wakes.
export async function handleTable(request, env) {
  const named = tableName(new URL(request.url).pathname);
  if (!named) return new Response('not found', { status: 404 });
  if (!originAllowed(request.headers.get('Origin'))) return new Response('origin', { status: 403 });
  if (request.method !== 'GET') return new Response('method', { status: 405 });
  if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return new Response('websocket required', { status: 426 });
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  try { if (!(await env.TABLE_JOIN.limit({ key: `table:${ip}` })).success) return new Response('busy', { status: 429 }); } catch { return new Response('busy', { status: 429 }); }
  try { return await env.TABLE.get(env.TABLE.idFromName(named.name)).fetch(request); } catch { return new Response('table', { status: 503 }); }
}

// Validate before touching the room. Address keys stay in the limiter; no address reaches a room attachment.
export async function handleRoom(request, env) {
  const name = roomName(new URL(request.url).pathname);
  if (!name) return new Response('not found', { status: 404 });
  if (!originAllowed(request.headers.get('Origin'))) return new Response('origin', { status: 403 });
  if (request.method !== 'GET') return new Response('method', { status: 405 });
  if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return new Response('websocket required', { status: 426 });
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  try { if (!(await env.PER_IP.limit({ key: `room:${ip}` })).success) return new Response('busy', { status: 429 }); } catch { return new Response('busy', { status: 429 }); }
  try { return await env.ROOM.get(env.ROOM.idFromName(name)).fetch(request); } catch { return new Response('room', { status: 503 }); }
}

export default {
  async fetch(request, env, ctx) {
    try {
      const path = new URL(request.url).pathname;
      if (path.startsWith('/lab-api/board/')) return await handleBoard(request, env, ctx, { cache: caches.default });
      if (path.startsWith('/lab-api/room/')) return await handleRoom(request, env);
      if (path.startsWith('/lab-api/table/')) return await handleTable(request, env);
      return await handle(request, env, ctx, { cache: caches.default });
    } catch {
      return new Response('{"error":"server"}', { status: 502, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    }
  },
};
