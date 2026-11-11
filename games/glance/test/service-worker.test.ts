import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';
import { required } from './required.ts';

type FetchEvent = { request: Request; respondWith: (response: Promise<Response>) => void };

function worker() {
  const handlers: Record<string, (event: FetchEvent) => void> = {};
  runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), {
    URL,
    self: {
      location: new URL('https://play.adamwhite.work/glance/sw.js'),
      addEventListener: (type: string, handler: (event: FetchEvent) => void) => {
        handlers[type] = handler;
      },
    },
    caches: {
      match: async () => undefined,
      open: async () => ({ put: async () => {}, match: async () => undefined }),
    },
    fetch: async () => new Response('asset'),
  });
  return required(handlers.fetch);
}

it('leaves cross-origin GETs to the browser instead of intercepting their CORS and integrity handling', () => {
  const fetch = worker();
  for (const url of [
    'https://static.cloudflareinsights.com/beacon.min.js/version',
    'https://fonts.gstatic.com/font.woff2',
    'https://human.adamwhite.work/lab/api/linked',
  ]) {
    let intercepted = false;
    fetch({
      request: new Request(url),
      respondWith: () => {
        intercepted = true;
      },
    });
    expect(intercepted, url).toBe(false);
  }
});

it('continues to cache same-origin game assets for offline play', async () => {
  let response: Promise<Response> | undefined;
  worker()({
    request: new Request('https://play.adamwhite.work/glance/assets/game.js'),
    respondWith: (value: Promise<Response>) => {
      response = value;
    },
  });
  expect(response).toBeDefined();
  expect(await (await required(response)).text()).toBe('asset');
});

it('does not intercept a different game on the shared origin', () => {
  const respondWith = vi.fn();
  worker()({ request: new Request('https://play.adamwhite.work/rope/assets/game.js'), respondWith });
  expect(respondWith).not.toHaveBeenCalled();
});
