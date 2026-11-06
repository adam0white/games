import registry from '../games.json' with { type: 'json' };
import { validateRegistry } from '../scripts/lib.mjs';

const PLAY = 'https://play.adamwhite.work';
const SHELF = 'https://human.adamwhite.work/games/';

export function createHandler(games) {
  validateRegistry({ hfVersion: '0.0.0', games });
  const legacy = new Map(games.filter(game => game.redirectEnabled === true && game.legacyOrigin).map(game => [game.legacyOrigin, game.slug]));
  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      if (url.origin === PLAY) {
        if (url.pathname === '/') return Response.redirect(SHELF, 302);
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
      return Response.redirect(`${PLAY}/${slug}${url.pathname}${url.search}`, 302);
    }
  };
}
// Build and deploy preflight verify every enabled alias before upload.
export default createHandler(registry.games);
