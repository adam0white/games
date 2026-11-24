// The front door. It serves nothing itself: the page is static (public/), and this code only chooses a room
// for a WebSocket and hands the socket to that room's Durable Object.
export { Room } from './room.mjs';
export { Directory } from './directory.mjs';
import { PROTO } from '../public/crumbwar/shared/config.js';
import { pageVerdict, UPDATE_CODE, STALE_ROOM_STATUS } from '../public/crumbwar/shared/version.js';
import { summarize, HOUR, KEEP_HOURS, hourOf } from './metrics.mjs';

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

// Joins refused here, before any room is asked, are also counted for the hourly totals. They are kept in this
// isolate and sent to the region's directory at most once a minute, so a flood of refused joins buys at most one
// Durable Object write a minute per isolate. Counts still held when the isolate ends are lost; Analytics Engine
// has the exact numbers.
const held = new Map();
let sentAt = 0;
function refuse(env, ctx, region, key) {
  const c = held.get(region) ?? held.set(region, {}).get(region);
  c[key] = (c[key] || 0) + 1;
  flush(env, ctx);
}
function flush(env, ctx) {
  if (!held.size || Date.now() - sentAt < 60_000 || !ctx) return;
  sentAt = Date.now();
  for (const [region, counts] of held) ctx.waitUntil(env.DIRECTORY.getByName('dir:' + region).report('', 0, undefined, counts).catch(() => {}));
  held.clear();
}

// A page that is not the version this Worker serves is told so on an open socket, because a browser shows a
// refused upgrade only as 1006. The page reloads once (shared/version.js).
function closeWith(code, why) {
  const pair = new WebSocketPair();
  pair[1].accept(); pair[1].close(code, why);
  return new Response(null, { status: 101, webSocket: pair[0] });
}

export default {
  async fetch(request, env, ctx) {
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
    // Hourly totals for the last 14 days (or ?hours=N), per region, from each regional directory. Numbers only.
    // `lt` holds load test rooms and is left out of the totals. Same key check as the status call.
    if (url.pathname === '/crumbwar/api/metrics') {
      if (!trusted) return new Response('not found', { status: 404 });
      const hours = Math.min(KEEP_HOURS, Math.max(1, Number(q.get('hours')) || KEEP_HOURS)), since = hourOf(Date.now()) - (hours - 1) * HOUR, byRegion = {};
      await Promise.all([...REGIONS, 'lt'].map(async r => { byRegion[r] = await env.DIRECTORY.getByName('dir:' + r).metrics(since).catch(() => []); }));
      return Response.json({ now: Date.now(), hours, protocol: PROTO, ...summarize(byRegion) }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (url.pathname !== '/crumbwar/play') return new Response('not found', { status: 404 });
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('expected a WebSocket', { status: 426 });
    // A browser on another site sends that site's Origin. Refuse it, so nobody can embed the game's sockets.
    const where = request.cf?.continent || '';
    const hint = HINTS[where] ?? 'enam', cap = Number(env.HUMAN_CAP || 60);
    flush(env, ctx);
    if (!trusted && !sameSite(request.headers.get('Origin'), url)) { count(env, 'join', 'forbidden', where); refuse(env, ctx, hint, 'refusedForbidden'); return new Response('forbidden', { status: 403 }); }
    // Version check, page side: before the rate limit, so the reload that follows is the join that counts.
    if (pageVerdict(q.get('v'), PROTO) === 'reload') { count(env, 'join', 'stale-page', where); refuse(env, ctx, hint, 'refusedStalePage'); return closeWith(UPDATE_CODE, 'game updated'); }
    const ip = request.headers.get('CF-Connecting-IP') || 'local';
    // Joins from one address are limited before the directory or any room does work. The count is kept per
    // Cloudflare location and is approximate (Cloudflare documentation). If the limiter fails, the join goes on.
    if (!trusted && env.JOIN_LIMIT) {
      let ok = true;
      try { ok = (await env.JOIN_LIMIT.limit({ key: ip })).success; } catch {}
      if (!ok) { count(env, 'join', 'limited', where); refuse(env, ctx, hint, 'refusedLimited'); return new Response('too many joins, wait a minute', { status: 429, headers: { 'Retry-After': '30' } }); }
    }
    const resume = /^[0-9a-f]{16}$/.test(q.get('resume') || '') ? q.get('resume') : '';
    const join = (name, extra = '') => env.ROOM.get(env.ROOM.idFromName(name), { locationHint: REGIONS.has(name.split('-')[0]) ? name.split('-')[0] : hint })
      .fetch(new Request(`https://room/?name=${name}&v=${PROTO}&ip=${encodeURIComponent(ip)}${trusted ? '&trusted=1' : ''}${resume ? '&resume=' + resume : ''}${extra}`, request));
    // A load test names its own room and size. Those rooms are never offered to anyone else.
    if (trusted && /^lt-[a-z0-9]{1,16}$/.test(q.get('room') || '')) return join(q.get('room'), (/^\d{1,3}$/.test(q.get('cap') || '') ? '&cap=' + q.get('cap') : '') + (/^\d{1,3}$/.test(q.get('burn') || '') ? '&burn=' + q.get('burn') : ''));
    // Coming back after a dropped connection: the same room, if it still remembers the token.
    // `avoid`: a page that met a room of another protocol (one from before rooms could refuse) asks not to be sent there again.
    const back = q.get('room') || '', avoid = /^[a-z]{2,5}-\d{1,3}$/.test(q.get('avoid') || '') ? q.get('avoid') : '';
    if (resume && back !== avoid && /^[a-z]{2,5}-\d{1,3}$/.test(back)) { const r = await join(back, '&explicit=1'); if (r.status === 101) return r; }
    const dir = env.DIRECTORY.getByName('dir:' + hint), tried = avoid ? [avoid] : [];
    for (let i = 0; i < 3; i++) {
      const name = await dir.assign(hint, cap - 2, tried, PROTO), r = await join(name);
      // 409: full. 421: the room runs another protocol (old code after a deploy); its players stay, new ones go elsewhere.
      if (r.status !== 409 && r.status !== STALE_ROOM_STATUS) return r;
      tried.push(name);
    }
    refuse(env, ctx, hint, 'refusedBusy');
    return new Response('busy', { status: 503 });
  },
};
