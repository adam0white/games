// The hill room as a Durable Object: SQLite storage, hibernatable WebSockets (ctx.acceptWebSocket).
// All behaviour is in hill.mjs. A room whose clock runs cannot hibernate (a timer keeps it in memory);
// the clock stops 5 s after the last socket closes, and the object can then hibernate or be evicted.
import { DurableObject } from 'cloudflare:workers';
import { Hill } from './hill.mjs';

export class HillRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => { this.hill = new Hill(ctx, env); });
  }
  async fetch(request) { return this.hill.join(request); }
  async webSocketMessage(ws, data) { this.hill.message(ws, data); }
  async webSocketClose(ws, code) { try { ws.close(code === 1005 || code === 1006 ? 1000 : code, 'bye'); } catch {} this.hill.close(); }
  async webSocketError() { this.hill.close(); }
  async stats() { return this.hill.stats(); }
  async log() { return this.hill.log(); }
}
