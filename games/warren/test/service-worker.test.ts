import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { expect, it, vi } from 'vitest';

it('does not serve cached release metadata or intercept an explicit no-store read', () => {
  const handlers: Record<string, (event: unknown) => void> = {};
  const match = vi.fn(() => Promise.resolve({ oldBuild: '92b8604' }));
  vm.runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), {
    self: {
      location: new URL('https://warren.adamwhite.work/warren/sw.js'),
      addEventListener: (name: string, handler: (event: unknown) => void) => {
        handlers[name] = handler;
      },
    },
    caches: { match },
    URL,
    fetch: vi.fn(),
  });
  for (const [url, cache] of [
    ['https://warren.adamwhite.work/warren/release.json', 'default'],
    ['https://warren.adamwhite.work/warren/other.json', 'no-store'],
    ['https://warren.adamwhite.work/glance/sw.js', 'default'],
  ]) {
    const respondWith = vi.fn();
    handlers.fetch!({ request: { method: 'GET', url, cache, mode: 'cors' }, respondWith });
    expect(respondWith).not.toHaveBeenCalled();
  }
  expect(match).not.toHaveBeenCalled();
});

it('deletes only old Warren caches on activation', async () => {
  const handlers: Record<string, (event: { waitUntil(promise: Promise<unknown>): void }) => void> = {};
  const remove = vi.fn(async () => true);
  vm.runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), {
    self: {
      addEventListener: (
        name: string,
        handler: (event: { waitUntil(promise: Promise<unknown>): void }) => void,
      ) => {
        handlers[name] = handler;
      },
      clients: { claim: async () => {} },
    },
    caches: { keys: async () => ['warren-v1', 'warren-v0', 'glance-v1'], delete: remove },
  });
  let work: Promise<unknown> | undefined;
  handlers.activate!({
    waitUntil: (promise) => {
      work = promise;
    },
  });
  await work;
  expect(remove).toHaveBeenCalledExactlyOnceWith('warren-v0');
});
