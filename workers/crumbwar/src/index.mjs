// The front door. It serves nothing itself: the page is static (public/), and this code only chooses a room
// for a WebSocket and hands the socket to that room's Durable Object.
export { Room } from './room.mjs';
export { Directory } from './directory.mjs';

const HINTS = { NA: 'enam', SA: 'sam', EU: 'weur', AF: 'afr', AS: 'apac', OC: 'oc' };
// A room is named <region>-<n>. A load test room (lt-<name>) has no region in its name; an unknown hint is an error on Cloudflare.
const REGIONS = new Set(Object.values(HINTS));
// The page and the socket share a host, so the Origin a browser sends must name the host that was asked for.
// (wrangler dev rewrites both to the route's host, so the same rule holds locally.)
const sameSite = (origin, url) => { try { return new URL(origin).host === url.host; } catch { return false; } };

function same(a, b) { // compares every character, so the time taken does not reveal a prefix
  if (typeof a !== 'string' || typeof b !== 'string' || !b || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// Counts for Analytics Engine: what happened to a join, and where it came from (a continent, never an address).
const count = (env, kind, what, where) => { try { env.METRICS?.writeDataPoint({ indexes: [kind], blobs: [kind, what, where || ''], doubles: [1] }); } catch {} };

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
    // The watch job reads this. It needs no key: an alert names a room, a head count and a tick rate, nothing about a
    // player, and only the last six hours are shown. Alerts from load test rooms are shown to the load test key only.
    if (url.pathname === '/crumbwar/api/health') {
      const alerts = await env.DIRECTORY.getByName('alerts').alerts(Date.now() - 6 * 3600_000, trusted);
      return Response.json({ now: Date.now(), alerts }, { headers: { 'Cache-Control': trusted ? 'no-store' : 'public, max-age=60' } });
    }
    if (url.pathname !== '/crumbwar/play') return new Response('not found', { status: 404 });
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('expected a WebSocket', { status: 426 });
    // A browser on another site sends that site's Origin. Refuse it, so nobody can embed the game's sockets.
    const where = request.cf?.continent || '';
    if (!trusted && !sameSite(request.headers.get('Origin'), url)) { count(env, 'join', 'forbidden', where); return new Response('forbidden', { status: 403 }); }
    const hint = HINTS[where] ?? 'enam', cap = Number(env.HUMAN_CAP || 60);
    const ip = request.headers.get('CF-Connecting-IP') || 'local';
    // Joins from one address are limited before the directory or any room does work. The count is kept per
    // Cloudflare location and is approximate (Cloudflare documentation). If the limiter fails, the join goes on.
    if (!trusted && env.JOIN_LIMIT) {
      let ok = true;
      try { ok = (await env.JOIN_LIMIT.limit({ key: ip })).success; } catch {}
      if (!ok) { count(env, 'join', 'limited', where); return new Response('too many joins, wait a minute', { status: 429, headers: { 'Retry-After': '30' } }); }
    }
    const resume = /^[0-9a-f]{16}$/.test(q.get('resume') || '') ? q.get('resume') : '';
    const join = (name, extra = '') => env.ROOM.get(env.ROOM.idFromName(name), { locationHint: REGIONS.has(name.split('-')[0]) ? name.split('-')[0] : hint })
      .fetch(new Request(`https://room/?name=${name}&ip=${encodeURIComponent(ip)}${trusted ? '&trusted=1' : ''}${resume ? '&resume=' + resume : ''}${extra}`, request));
    // A load test names its own room and size. Those rooms are never offered to anyone else.
    if (trusted && /^lt-[a-z0-9]{1,16}$/.test(q.get('room') || '')) return join(q.get('room'), (/^\d{1,3}$/.test(q.get('cap') || '') ? '&cap=' + q.get('cap') : '') + (/^\d{1,3}$/.test(q.get('burn') || '') ? '&burn=' + q.get('burn') : ''));
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
