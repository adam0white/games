import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';
import { fileEntry } from '../../src/entry.ts';

it('recognizes only the scoped file route without native entry', () => {
  expect(fileEntry('', '/valley/file/')).toBe('file');
  expect(fileEntry('', '/valley/file')).toBe('file');
  expect(fileEntry('', '/valley/')).toBe('native');
  expect(fileEntry('?file=1', '/valley/')).toBe('file');
  expect(fileEntry('?file=0', '/valley/')).toBe('invalid');
});

it('keeps worker requests and cache cleanup inside Valley', async () => {
  const handlers = new Map<string, (event: unknown) => void>();
  const deleted: string[] = [];
  const self = {
    location: { origin: 'https://play.adamwhite.work' },
    addEventListener: (name: string, callback: (event: unknown) => void) => handlers.set(name, callback),
    clients: { claim: vi.fn() },
    skipWaiting: vi.fn(),
  };
  const caches = {
    keys: async () => ['valley-v1', 'valley-v2', 'rope-v1'],
    delete: async (key: string) => deleted.push(key),
    open: async () => ({ match: vi.fn(), put: vi.fn(), addAll: vi.fn() }),
  };
  runInNewContext(readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8'), {
    self,
    caches,
    URL,
    fetch: vi.fn(),
  });
  let activation: Promise<void> | undefined;
  handlers.get('activate')?.({
    waitUntil: (promise: Promise<void>) => {
      activation = promise;
    },
  });
  await activation;
  expect(deleted).toEqual(['valley-v1']);
  for (const url of [
    'https://play.adamwhite.work/rope/',
    'https://other.example/valley/icon.svg',
    'https://play.adamwhite.work/valley/release.json',
    'https://play.adamwhite.work/valley/file/',
  ]) {
    const respondWith = vi.fn();
    handlers.get('fetch')?.({ request: { method: 'GET', url, mode: 'navigate' }, respondWith });
    expect(respondWith).not.toHaveBeenCalled();
  }
});
