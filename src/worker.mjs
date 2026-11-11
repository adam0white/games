import registry from '../games.json' with { type: 'json' };
import { validateRegistry } from '../scripts/lib.mjs';

const PLAY = 'https://play.adamwhite.work';
const SHELF = 'https://human.adamwhite.work/games/';

export function createHandler(games) {
  validateRegistry({ hfVersion: '0.0.0', games });
  const legacy = new Map(games.filter(game => game.redirectEnabled === true && game.legacyOrigin).map(game => [game.legacyOrigin, game.slug]));
  const zoneManaged = new Set(games.filter(game => game.redirectEnabled === true && game.redirectMode === 'zone').map(game => game.legacyOrigin));
  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      if (url.origin === PLAY) {
        if (url.pathname === '/') return Response.redirect(SHELF, 302);
        if (/^\/lefthand\/engine\/game-[a-f0-9]+\.wasm$/.test(url.pathname)) {
          if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
          url.pathname += '.gz';
          const headers = new Headers(request.headers);
          headers.set('Accept-Encoding', 'identity');
          headers.delete('Range');
          headers.delete('If-Range');
          const asset = await env.ASSETS.fetch(new Request(url, { method: request.method, headers }));
          if (asset.status !== 200) return asset;
          const resultHeaders = new Headers(asset.headers);
          resultHeaders.set('Content-Type', 'application/wasm');
          resultHeaders.set('Content-Encoding', 'gzip');
          resultHeaders.set('Cache-Control', 'public, max-age=31536000, immutable, no-transform');
          resultHeaders.delete('Content-Length');
          return new Response(request.method === 'HEAD' ? null : asset.body, { status: asset.status, headers: resultHeaders, encodeBody: 'manual' });
        }
        return env.ASSETS.fetch(request);
      }
      const slug = legacy.get(url.origin);
      if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return new Response('Not found', { status: 404 });
      if (url.pathname === '/sw.js') {
        const destination = `${PLAY}/${slug}`;
        const script = `self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  await self.registration.unregister();
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  await Promise.allSettled(clients.map(async client => {
    const url = new URL(client.url);
    if (url.origin === self.location.origin) {
      await client.navigate(${JSON.stringify(destination)} + url.pathname + url.search + url.hash);
    }
  }));
})()));
`;
        return new Response(script, { headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Service-Worker-Allowed': '/' } });
      }
      if (zoneManaged.has(url.origin)) return new Response('Not found', { status: 404 });
      return Response.redirect(`${PLAY}/${slug}${url.pathname}${url.search}`, 302);
    }
  };
}
// Build and deploy preflight verify every enabled alias before upload.
export default createHandler(registry.games);
