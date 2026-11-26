// Cinderhill friends' hill: the room spike (S1 deployed, roadmap 04). Routes, all under /room/<code>/:
//   ws      WebSocket join; query proto, sim, have, token (and role, ants, seed where DEBUG_ROLES is "1")
//   stats   the room's counters (JSON)
//   log     the room's whole command log, only where DEBUG_ROLES is "1"
//   bench   runs ?ticks= ticks of a fresh sim with ?ants= ants in one call, only where DEBUG_ROLES is "1" (read its CPU in wrangler tail)
// One Durable Object per room code (getByName). Joins are rate limited per address, as in Crumbwar.
export { HillRoom } from './room.mjs';

const CODE = /^[a-z0-9]{4,24}$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') return Response.json({ ok: true, version: env.VERSION?.id ?? 'local' });
    const m = url.pathname.match(/^\/room\/([^/]+)\/(ws|stats|log|bench)$/);
    if (!m || !CODE.test(m[1])) return new Response('not found', { status: 404 });
    const room = env.ROOM.getByName(`hill:${m[1]}`);
    if (m[2] === 'stats') return Response.json(await room.stats());
    if (m[2] === 'log' || m[2] === 'bench') {
      if (env.DEBUG_ROLES !== '1') return new Response('not found', { status: 404 });
      return Response.json(m[2] === 'log' ? await room.log() : await room.bench(Number(url.searchParams.get('ants')), Number(url.searchParams.get('ticks'))));
    }
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('expected a WebSocket', { status: 426 });
    if (env.JOIN_LIMIT) {
      let ok = true;
      try { ok = (await env.JOIN_LIMIT.limit({ key: request.headers.get('cf-connecting-ip') || 'unknown' })).success; } catch (e) { console.error(e); }
      if (!ok) return new Response('too many joins, wait a minute', { status: 429, headers: { 'Retry-After': '30' } });
    }
    return room.fetch(request);
  },
};
