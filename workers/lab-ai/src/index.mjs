import { DurableObject } from 'cloudflare:workers';
import { handle, takeOne } from './core.mjs';
import { handleBoard, boardTop, boardPut, boardRemove, boardStart } from './board.mjs';

// One instance of this class (named "global") counts model calls per UTC day for the daily cap.
export class DailyCounter extends DurableObject {
  take(day, cap) { return takeOne(this.ctx.storage.sql, day, cap); }
}

// One instance per game (named by the game) holds that game's shared leaderboard. See board.mjs.
export class Board extends DurableObject {
  top(limit, day) { return boardTop(this.ctx.storage.sql, limit, day); }
  put(q, now, need, day) { return boardPut(this.ctx.storage.sql, q, now, undefined, need, day); }
  remove(id) { return boardRemove(this.ctx.storage.sql, id); }
  start(r, now) { return boardStart(this.ctx.storage.sql, r, now); }
}

// /lab-api/persona and /lab-api/board/<game> do something; nothing else does. Any error gives a 502 so the page keeps its offline persona.
export default {
  async fetch(request, env, ctx) {
    try {
      if (new URL(request.url).pathname.startsWith('/lab-api/board/')) return await handleBoard(request, env, ctx, { cache: caches.default });
      return await handle(request, env, ctx, { cache: caches.default });
    } catch {
      return new Response('{"error":"server"}', { status: 502, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    }
  },
};
