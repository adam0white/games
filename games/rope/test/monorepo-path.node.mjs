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
