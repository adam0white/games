import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';

type WorkerFetch = {
  request: { method: string; url: string; mode: string };
  respondWith: (response: Promise<Response>) => void;
};

it('keeps the last good shell when a navigation returns an error', async () => {
  const handlers = new Map<string, (event: WorkerFetch) => void>();
  const entries = new Map<string, Response>([['/murmur/', new Response('good shell', { status: 200 })]]);
  const cache = {
    match: async (key: string) => entries.get(key),
    put: async (key: string, response: Response) => {
      entries.set(key, response);
    },
  };
  const fetch = vi.fn(async () => new Response('missing', { status: 404 }));
  runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), {
    URL,
    self: {
      location: { origin: 'https://play.adamwhite.work' },
      addEventListener: (name: string, fn: (event: WorkerFetch) => void) => handlers.set(name, fn),
    },
    caches: { open: async () => cache },
    fetch,
  });
  let response: Promise<Response> | undefined;
  const handleFetch = handlers.get('fetch');
  if (!handleFetch) throw new Error('Worker fetch handler missing');
  handleFetch({
    request: { method: 'GET', url: 'https://play.adamwhite.work/murmur/missing/', mode: 'navigate' },
    respondWith: (p: Promise<Response>) => {
      response = p;
    },
  });
  if (!response) throw new Error('Navigation was not handled');
  expect((await response).status).toBe(404);
  await vi.waitFor(() => expect(entries.get('/murmur/')?.status).toBe(200));
  expect(await entries.get('/murmur/')?.text()).toBe('good shell');
  expect(fetch).toHaveBeenCalledOnce();
});
