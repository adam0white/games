import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../src/worker.mjs';
import { Script, runInNewContext } from 'node:vm';
import { validateRegistry } from './lib.mjs';

const base = { source: { repository: 'https://github.com/adam0white/rope', commit: 'a'.repeat(40) }, saveSchema: 'v1' };
const games = [{ ...base, slug: 'rope', legacyOrigin: 'https://rope.adamwhite.work', redirectEnabled: true, verifiedRelease: 'b'.repeat(40) }, { ...base, slug: 'other', legacyOrigin: 'https://off.adamwhite.work', redirectEnabled: false }];
const handler = createHandler(games);
const assets = { ASSETS: { fetch: () => new Response('asset') } };
const get = url => handler.fetch(new Request(url), assets);
test('routes only enabled origins and preserves path and query', async () => {
  const response = await get('https://rope.adamwhite.work/a/b?x=1');
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), 'https://play.adamwhite.work/rope/a/b?x=1');
  assert.equal((await get('https://off.adamwhite.work/a')).status, 404);
  assert.equal((await get('https://unknown.example/a')).status, 404);
  assert.equal((await get('https://rope.adamwhite.work//evil.example/x')).headers.get('location'), 'https://play.adamwhite.work/rope//evil.example/x');
});
test('play root opens shelf and game paths reach assets', async () => {
  assert.equal((await get('https://play.adamwhite.work/')).headers.get('location'), 'https://human.adamwhite.work/games/');
  assert.equal(await (await get('https://play.adamwhite.work/rope/')).text(), 'asset');
});
test('old service worker is a same-origin non-cacheable tombstone', async () => {
  const response = await get('https://rope.adamwhite.work/sw.js');
  assert.match(response.headers.get('content-type'), /javascript/);
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.equal(response.headers.get('service-worker-allowed'), '/');
  const script = await response.text();
  assert.doesNotThrow(() => new Script(script));
  assert.match(script, /skipWaiting/); assert.match(script, /unregister/); assert.match(script, /client\.navigate/);
});
test('registry activation requires a verified owned exact origin', () => {
  const registry = { hfVersion: '4.17.0', games: [{ ...games[0] }] };
  assert.doesNotThrow(() => validateRegistry(registry));
  for (const patch of [{ verifiedRelease: undefined }, { verifiedRelease: 'bad' }, { verifiedRelease: ['b'.repeat(40)] }, { legacyOrigin: undefined }, { legacyOrigin: 'https://example.com' }, { legacyOrigin: 'https://human.adamwhite.work' }, { legacyOrigin: 'https://rope.adamwhite.work/' }, { legacyOrigin: 'https://rope.adamwhite.work:443' }, { legacyOrigin: 'http://rope.adamwhite.work' }]) {
    assert.throws(() => validateRegistry({ ...registry, games: [{ ...games[0], ...patch }] }));
  }
});
test('tombstone unregisters and navigates every matching window despite one failure', async () => {
  const response = await get('https://rope.adamwhite.work/sw.js');
  const handlers = {}, navigations = [];
  let unregistered = false, skipped = false;
  const clients = [
    { url: 'https://rope.adamwhite.work/first?x=1#memory', navigate: async url => { navigations.push(url); throw new Error('window closed'); } },
    { url: 'https://rope.adamwhite.work/second?file=1', navigate: async url => navigations.push(url) },
    { url: 'https://hearsay.adamwhite.work/foreign', navigate: async () => assert.fail('foreign window navigated') },
    { url: 'https://rope.adamwhite.work//evil.example/x', navigate: async url => navigations.push(url) },
  ];
  runInNewContext(await response.text(), { URL, self: {
    location: { origin: 'https://rope.adamwhite.work' },
    addEventListener: (name, fn) => { handlers[name] = fn; },
    skipWaiting: async () => { skipped = true; },
    registration: { unregister: async () => { unregistered = true; } },
    clients: { matchAll: async () => clients },
  } });
  let pending;
  handlers.install({ waitUntil: promise => { pending = promise; } }); await pending;
  handlers.activate({ waitUntil: promise => { pending = promise; } }); await pending;
  assert.equal(skipped, true); assert.equal(unregistered, true);
  assert.deepEqual(navigations, [
    'https://play.adamwhite.work/rope/first?x=1#memory',
    'https://play.adamwhite.work/rope/second?file=1',
    'https://play.adamwhite.work/rope//evil.example/x',
  ]);
});
