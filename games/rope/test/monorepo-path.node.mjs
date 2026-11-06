import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

test('worker installs only scoped shell and preserves other game caches', async () => {
  const handlers = {},
    deleted = [],
    added = [];
  const caches = {
    keys: async () => ['other-game-cache', 'games-rope-old'],
    delete: async (key) => deleted.push(key),
    open: async () => ({ addAll: async (paths) => added.push(...paths) }),
  };
  const self = {
    addEventListener: (name, fn) => (handlers[name] = fn),
    skipWaiting() {},
    clients: { claim() {} },
  };
  runInNewContext(readFileSync('public/sw.js', 'utf8'), { self, caches, URL });
  let promise;
  handlers.install({ waitUntil: (p) => (promise = p) });
  await promise;
  assert.ok(added.every((path) => path.startsWith('/rope/')));
  handlers.activate({ waitUntil: (p) => (promise = p) });
  await promise;
  assert.ok(!deleted.includes('other-game-cache'));
});
test('manifest remains within Rope path', () => {
  const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));
  assert.equal(manifest.scope, '/rope/');
  assert.equal(manifest.start_url, '/rope/');
  assert.ok(manifest.icons.every((icon) => icon.src.startsWith('/rope/')));
});

test('both entries include analytics and permit its endpoints', () => {
  for (const file of ['index.html', 'file/index.html']) {
    const page = readFileSync(file, 'utf8');
    assert.match(page, /https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js/);
    assert.match(page, /16c78483308e46519c2eb1ab552fe0d2/);
  }
  const headers = readFileSync('public/_headers', 'utf8');
  assert.match(headers, /static\.cloudflareinsights\.com/);
  assert.match(headers, /https:\/\/cloudflareinsights\.com/);
});

test('navigation cache keeps a clone alive and separates the file entry', async () => {
  const handlers = {},
    lifetime = [],
    writes = [];
  let releaseCache, served;
  const open = new Promise((resolve) => {
    releaseCache = resolve;
  });
  const response = new Response('fresh file entry');
  runInNewContext(readFileSync('public/sw.js', 'utf8'), {
    self: {
      location: { origin: 'https://play.adamwhite.work' },
      addEventListener: (name, fn) => {
        handlers[name] = fn;
      },
    },
    caches: { open: () => open },
    URL,
    fetch: async () => response,
  });
  handlers.fetch({
    request: { method: 'GET', url: 'https://play.adamwhite.work/rope/file/', mode: 'navigate' },
    respondWith: (promise) => {
      served = promise;
    },
    waitUntil: (promise) => {
      lifetime.push(promise);
    },
  });
  assert.equal(await (await served).text(), 'fresh file entry');
  assert.equal(lifetime.length, 1, 'navigation cache write extends worker lifetime');
  releaseCache({
    put: async (key, copy) => {
      writes.push([key, await copy.text()]);
    },
  });
  await Promise.all(lifetime);
  assert.deepEqual(writes, [['/rope/file/', 'fresh file entry']]);
});

test('service worker bypasses Rope release metadata while handling ordinary assets', async () => {
  const handlers = {};
  const self = {
    location: { origin: 'https://play.adamwhite.work' },
    addEventListener: (name, fn) => {
      handlers[name] = fn;
    },
  };
  const caches = { open: async () => ({ match: async () => undefined, put: async () => {} }) };
  runInNewContext(readFileSync('public/sw.js', 'utf8'), {
    self,
    caches,
    URL,
    fetch: async () => new Response('asset'),
  });
  let served;
  handlers.fetch({
    request: { method: 'GET', url: 'https://play.adamwhite.work/rope/release.json', mode: 'cors' },
    respondWith: (p) => {
      served = p;
    },
  });
  assert.equal(served, undefined, 'metadata is fetched directly by the browser');
  handlers.fetch({
    request: { method: 'GET', url: 'https://play.adamwhite.work/rope/icon.svg', mode: 'cors' },
    waitUntil: () => {},
    respondWith: (p) => {
      served = p;
    },
  });
  assert.equal(await (await served).text(), 'asset');
});
