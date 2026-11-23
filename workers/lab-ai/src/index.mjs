import { DurableObject } from 'cloudflare:workers';
import { handle, takeOne } from './core.mjs';

// One instance of this class (named "global") counts model calls per UTC day for the daily cap.
export class DailyCounter extends DurableObject {
  take(day, cap) { return takeOne(this.ctx.storage.sql, day, cap); }
}

// Only /lab-api/persona does anything. Any error gives a 502 so the page keeps its offline persona.
export default {
  async fetch(request, env, ctx) {
    try {
      return await handle(request, env, ctx, { cache: caches.default });
    } catch {
      return new Response('{"error":"server"}', { status: 502, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    }
  },
};
