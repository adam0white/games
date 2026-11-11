import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';

type FetchRequest = { request: Request; respondWith: (response: Promise<Response>) => void };

it('leaves the release stamp to the network even when an old stamp is cached', async () => {
  const handlers: Record<string, (event: FetchRequest) => void> = {};
  const match = vi.fn(async () => new Response('old cached content'));
  runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), {
    URL,
    self: {
      location: new URL('https://game.example/sw.js'),
      addEventListener: (type: string, handler: (event: FetchRequest) => void) => {
        handlers[type] = handler;
      },
    },
    caches: { open: async () => ({ match }) },
    fetch: vi.fn(),
  });
  const handleFetch = handlers.fetch;
  if (!handleFetch) throw new Error('The worker did not register its fetch handler.');
  for (const path of [
    '/stairwell/release.json',
    '/stairwell/release.json?recheck=1',
    '/stairwell/file/',
    '/rope/',
  ]) {
    const respondWith = vi.fn();
    handleFetch({
      request: new Request(`https://game.example${path}`, { cache: 'no-store' }),
      respondWith,
    });
    expect(respondWith, path).not.toHaveBeenCalled();
  }
  expect(match).not.toHaveBeenCalled();
  const foreign = vi.fn();
  handleFetch({
    request: new Request('https://other.example/stairwell/assets/game.js'),
    respondWith: foreign,
  });
  expect(foreign).not.toHaveBeenCalled();

  // Offline assets still use the existing cache policy.
  let response: Promise<Response> | undefined;
  handleFetch({
    request: new Request('https://game.example/stairwell/assets/game.js'),
    respondWith: (value: Promise<Response>) => {
      response = value;
    },
  });
  if (!response) throw new Error('The worker did not handle the offline asset.');
  expect(await (await response).text()).toBe('old cached content');
});

it('removes only Stairwell caches and ignores other origins', async () => {
  const handlers: Record<string, (event: { waitUntil: (promise: Promise<void>) => void }) => void> = {};
  const deleted: string[] = [];
  runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), {
    URL,
    self: {
      location: new URL('https://game.example/stairwell/sw.js'),
      clients: { claim: vi.fn() },
      addEventListener: (
        type: string,
        handler: (event: { waitUntil: (promise: Promise<void>) => void }) => void,
      ) => {
        handlers[type] = handler;
      },
    },
    caches: {
      keys: async () => ['stairwell-v1', 'stairwell-v2', 'rope-v1'],
      delete: async (key: string) => {
        deleted.push(key);
      },
    },
  });
  let activation: Promise<void> | undefined;
  handlers.activate?.({
    waitUntil: (promise) => {
      activation = promise;
    },
  });
  await activation;
  expect(deleted).toEqual(['stairwell-v1']);
});
