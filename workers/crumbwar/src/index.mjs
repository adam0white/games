// The front door. It serves nothing itself: the page is static (public/), and this code only chooses a room
// for a WebSocket and hands the socket to that room's Durable Object.
export { Room } from './room.mjs';
export { Directory } from './directory.mjs';

const HINTS = { NA: 'enam', SA: 'sam', EU: 'weur', AF: 'afr', AS: 'apac', OC: 'oc' };
// The page and the socket share a host, so the Origin a browser sends must name the host that was asked for.
// (wrangler dev rewrites both to the route's host, so the same rule holds locally.)
const sameSite = (origin, url) => { try { return new URL(origin).host === url.host; } catch { return false; } };

function same(a, b) { // compares every character, so the time taken does not reveal a prefix
  if (typeof a !== 'string' || typeof b !== 'string' || !b || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url), q = url.searchParams, trusted = same(q.get('lt'), env.LOADTEST_KEY);
    if (url.pathname === '/crumbwar') return Response.redirect(url.origin + '/crumbwar/', 301);
    if (url.pathname === '/crumbwar/api/status') {
      if (!trusted) return new Response('not found', { status: 404 });
      const region = q.get('region') || 'enam';
      const body = q.get('room') ? await env.ROOM.getByName(q.get('room')).stats() : await env.DIRECTORY.getByName('dir:' + region).list();
      return Response.json(body, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (url.pathname !== '/crumbwar/play') return new Response('not found', { status: 404 });
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('expected a WebSocket', { status: 426 });
    // A browser on another site sends that site's Origin. Refuse it, so nobody can embed the game's sockets.
    if (!trusted && !sameSite(request.headers.get('Origin'), url)) return new Response('forbidden', { status: 403 });
    const hint = HINTS[request.cf?.continent] ?? 'enam', cap = Number(env.HUMAN_CAP || 60);
    const ip = request.headers.get('CF-Connecting-IP') || 'local', resume = /^[0-9a-f]{16}$/.test(q.get('resume') || '') ? q.get('resume') : '';
    const join = (name, extra = '') => env.ROOM.get(env.ROOM.idFromName(name), { locationHint: name.split('-')[0] })
      .fetch(new Request(`https://room/?name=${name}&ip=${encodeURIComponent(ip)}${trusted ? '&trusted=1' : ''}${resume ? '&resume=' + resume : ''}${extra}`, request));
    // A load test names its own room and size. Those rooms are never offered to anyone else.
    if (trusted && /^lt-[a-z0-9]{1,16}$/.test(q.get('room') || '')) return join(q.get('room'), /^\d{1,3}$/.test(q.get('cap') || '') ? '&cap=' + q.get('cap') : '');
    // Coming back after a dropped connection: the same room, if it still remembers the token.
    const back = q.get('room') || '';
    if (resume && /^[a-z]{2,5}-\d{1,3}$/.test(back)) { const r = await join(back, '&explicit=1'); if (r.status === 101) return r; }
    const dir = env.DIRECTORY.getByName('dir:' + hint), tried = [];
    for (let i = 0; i < 3; i++) {
      const name = await dir.assign(hint, cap - 2, tried), r = await join(name);
      if (r.status !== 409) return r;
      tried.push(name);
    }
    return new Response('busy', { status: 503 });
  },
};
