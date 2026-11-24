import { DurableObject } from 'cloudflare:workers';
import { handle, takeOne, readSpend, originAllowed } from './core.mjs';
import { handleBoard, boardTop, boardPut, boardRemove, boardStart } from './board.mjs';
import { ROOM, roomName, roomMessage, rateWindow, needsRound, freshRound, freeId } from './room.mjs';

// One instance of this class (named "global") counts model calls per UTC day for the shared daily cap.
export class DailyCounter extends DurableObject {
  take(day, cap, endpoint = 'persona') { return takeOne(this.ctx.storage.sql, day, cap, endpoint); }
  spend(day) { return readSpend(this.ctx.storage.sql, day); }
}

// One instance per game (named by the game) holds that game's shared leaderboard. See board.mjs.
export class Board extends DurableObject {
  top(limit, day) { return boardTop(this.ctx.storage.sql, limit, day); }
  put(q, now, need, day) { return boardPut(this.ctx.storage.sql, q, now, undefined, need, day); }
  remove(id) { return boardRemove(this.ctx.storage.sql, id); }
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
    const pair = new WebSocketPair(), ws = pair[1];
    // The ninth socket gets a WebSocket close, not an HTTP error. It never becomes a room participant.
    const id = freeId([...this.clients.values()]);
    if (id === null) { ws.accept(); ws.close(4001, 'room full'); return new Response(null, { status: 101, webSocket: pair[0] }); }
    const peers = [...this.clients.values()].map(c => ({ id: c.id, n: c.n }));
    this.ctx.acceptWebSocket(ws);
    const c = { id, n: 'Boat', times: [], readyBy: null, inRound: false, done: false, round: this.round };
    this.clients.set(ws, c); this.save(ws, c);
    this.send(ws, { t: 'you', id, peers, round: this.round });
    this.broadcast({ t: 'join', id, n: c.n }, ws);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }
  webSocketMessage(ws, text) {
    const c = this.clients.get(ws); if (!c) return;
    const now = Date.now(), rate = rateWindow(c.times, now); c.times = rate.times;
    if (!rate.ok) { ws.close(1008, 'message rate'); this.drop(ws); return; }
    this.save(ws, c);
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
      return await handle(request, env, ctx, { cache: caches.default });
    } catch {
      return new Response('{"error":"server"}', { status: 502, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    }
  },
};
