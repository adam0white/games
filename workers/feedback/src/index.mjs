import { handleApi } from './core.mjs';

// Static files under /notes are served by the assets layer before this runs. Only /notes/api/* reaches it.
export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith('/notes/api/')) {
      try {
        // A note is processed while its request is open. If the phone drops the connection, the work
        // still gets a short grace period; anything left 'pending' is finished by a staff retry.
        const response = handleApi(request, env);
        ctx.waitUntil(response.catch(() => {}));
        return await response;
      } catch {
        return new Response('{"error":"server"}', { status: 500, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
      }
    }
    return env.ASSETS.fetch(request);
  },
};
