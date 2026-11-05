import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../src/worker.mjs';
import { validateRegistry } from './lib.mjs';

const games = [{ slug: 'rope', legacyOrigin: 'https://old.example', redirectEnabled: true }, { slug: 'other', legacyOrigin: 'https://off.example', redirectEnabled: false }];
const handler = createHandler(games);
const assets = { ASSETS: { fetch: () => new Response('asset') } };
const get = url => handler.fetch(new Request(url), assets);
test('routes only enabled origins and preserves path and query', async () => {
  const response = await get('https://old.example/a/b?x=1');
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), 'https://play.adamwhite.work/rope/a/b?x=1');
  assert.equal((await get('https://off.example/a')).status, 404);
  assert.equal((await get('https://unknown.example/a')).status, 404);
  assert.equal((await get('https://old.example//evil.example/x')).headers.get('location'), 'https://play.adamwhite.work/rope//evil.example/x');
});
test('play root opens shelf and game paths reach assets', async () => {
  assert.equal((await get('https://play.adamwhite.work/')).headers.get('location'), 'https://human.adamwhite.work/games/');
  assert.equal(await (await get('https://play.adamwhite.work/rope/')).text(), 'asset');
});
test('old service worker is a same-origin non-cacheable tombstone', async () => {
  const response = await get('https://old.example/sw.js');
  assert.match(response.headers.get('content-type'), /javascript/);
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.equal(response.headers.get('service-worker-allowed'), '/');
  const script = await response.text();
  assert.match(script, /skipWaiting/); assert.match(script, /unregister/); assert.match(script, /client\.navigate/);
});
test('registry rejects activation until verification preflight exists', () => {
  const registry = { hfVersion: '4.17.0', games: [{ ...games[0], source: { repository: 'https://github.com/a/b', commit: 'a'.repeat(40) }, saveSchema: 'v1' }] };
  assert.throws(() => validateRegistry(registry), /activation/);
  registry.games[0].redirectEnabled = false;
  assert.doesNotThrow(() => validateRegistry(registry));
});
