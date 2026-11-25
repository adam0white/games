import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../src/worker.mjs';
import { Script, runInNewContext } from 'node:vm';
import { validateRegistry } from './lib.mjs';
import { archivedHosts, labMoved } from '../worker-settings.mjs';
import { existsSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';

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
test('old experiment links move permanently to the top level and keep the query', async () => {
  const cases = {
    '/proto/lantern/?x=1': '/lantern/?x=1', '/proto/lantern/': '/lantern/', '/proto/kit/save.js': '/kit/save.js',
    '/proto/lab/thankful/?a=b&c=d': '/lab/thankful/?a=b&c=d', '/proto/': '/lab/', '/proto': '/lab/', '/proto?x=1': '/lab/?x=1',
    '/proto//evil.example/x': '//evil.example/x',
  };
  for (const [from, to] of Object.entries(cases)) {
    const response = await get(`https://play.adamwhite.work${from}`);
    assert.equal(response.status, 301, from);
    assert.equal(response.headers.get('location'), `https://play.adamwhite.work${to}`, from);
  }
  // Only the exact /proto segment moves; new paths and look-alikes reach the assets.
  for (const path of ['/lantern/', '/lab/thankful/', '/kit/save.js', '/protocol/', '/proto-x/']) assert.equal(await (await get(`https://play.adamwhite.work${path}`)).text(), 'asset', path);
  // Another origin never gets this redirect.
  assert.equal((await get('https://rope.adamwhite.work/proto/lantern/')).headers.get('location'), 'https://play.adamwhite.work/rope/proto/lantern/');
});
test('a lab page that left the lab sends its old address on, with the query, by a 302', async () => {
  const cases = {
    '/lab/night-vine/?lang=tr': '/vine/?lang=tr', '/lab/ant-creatures/?lang=tr': '/ant-promotion/?look=4&lang=tr', '/lab/ant-creatures/': '/ant-promotion/?look=4', '/lab/night-flock-2/': '/flock/', '/lab/night-flock-2': '/flock/',
    '/lab/lantern-echo/echo.js': '/lantern/', '/lab/ant-nest/?a=b&c=d': '/ant-promotion/?a=b&c=d', '/lab/boat-b/': '/boat/',
  };
  for (const [from, to] of Object.entries(cases)) {
    const response = await get(`https://play.adamwhite.work${from}`);
    assert.equal(response.status, 302, from);
    assert.equal(response.headers.get('location'), `https://play.adamwhite.work${to}`, from);
  }
  // Pages still in the lab, the lab index and look-alike names reach the assets.
  for (const path of ['/lab/', '/lab', '/lab/thankful/', '/lab/night-vines/', '/lab/night-vine-x/a.js', '/labs/night-vine/', '/flock/lab/night-vine/']) assert.equal(await (await get(`https://play.adamwhite.work${path}`)).text(), 'asset', path);
  // Every target is a plain path on this site, and no moved name is still a folder in the lab.
  for (const [name, to] of Object.entries(labMoved)) {
    assert.match(to, /^\/[a-z0-9-]+\/(?:\?[a-z0-9=&-]+)?$/, name);
    assert.equal(existsSync(new URL(`../experiments/lab/${name}`, import.meta.url)), false, `${name} is in labMoved and still in experiments/lab`);
  }
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

test('zone-managed aliases serve only their old worker retirement response', async () => {
  const managed = createHandler([{ ...games[0], redirectMode: 'zone' }]);
  assert.equal((await managed.fetch(new Request('https://rope.adamwhite.work/experiments/'), assets)).status, 404);
  assert.equal((await managed.fetch(new Request('https://rope.adamwhite.work/'), assets)).status, 404);
  const response = await managed.fetch(new Request('https://rope.adamwhite.work/sw.js?update=1'), assets);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /unregister/);
  assert.throws(() => validateRegistry({ hfVersion: '4.17.0', games: [{ ...games[0], redirectMode: 'unknown' }] }), /mode/i);
});


test('Lefthand serves one precompressed WASM layer only on its scoped engine route', async () => {
  const compressed = gzipSync(Buffer.from([0, 97, 115, 109]));
  const seen = [];
  const env = { ASSETS: { fetch: async request => { seen.push(request); return new Response(compressed, { headers: { 'Content-Length': String(compressed.length) } }); } } };
  const response = await handler.fetch(new Request('https://play.adamwhite.work/lefthand/engine/game-abcd.wasm?x=1', { headers: { Range: 'bytes=0-2', 'If-Range': 'x' } }), env);
  assert.equal(new URL(seen[0].url).pathname, '/lefthand/engine/game-abcd.wasm.gz');
  assert.equal(new URL(seen[0].url).search, '?x=1');
  assert.equal(seen[0].headers.get('Accept-Encoding'), 'identity');
  assert.equal(seen[0].headers.has('Range'), false);
  assert.equal(seen[0].headers.has('If-Range'), false);
  assert.equal(response.headers.get('Content-Encoding'), 'gzip');
  assert.equal(response.headers.get('Content-Type'), 'application/wasm');
  assert.match(response.headers.get('Cache-Control'), /immutable, no-transform/);
  assert.equal(response.headers.has('Content-Length'), false);
  assert.deepEqual(gunzipSync(Buffer.from(await response.arrayBuffer())), Buffer.from([0, 97, 115, 109]));
  const head = await handler.fetch(new Request('https://play.adamwhite.work/lefthand/engine/game-abcd.wasm', { method: 'HEAD' }), env);
  assert.equal(head.body, null);
  assert.equal((await handler.fetch(new Request('https://play.adamwhite.work/lefthand/engine/game-abcd.wasm', { method: 'POST' }), env)).status, 405);
  const missing = new Response('missing', { status: 404 });
  assert.equal(await handler.fetch(new Request('https://play.adamwhite.work/lefthand/engine/game-abcd.wasm'), { ASSETS: { fetch: async () => missing } }), missing);
  const untouched = [];
  const other = { ASSETS: { fetch: async request => { untouched.push(new URL(request.url).pathname); return new Response('other'); } } };
  for (const path of ['/other/engine/game-abcd.wasm', '/lefthand/engine/game-ABCD.wasm', '/lefthand/engine/../game-abcd.wasm', '/lefthand/engine/game-abcd.js']) await handler.fetch(new Request(`https://play.adamwhite.work${path}`), other);
  assert.deepEqual(untouched, ['/other/engine/game-abcd.wasm', '/lefthand/engine/game-ABCD.wasm', '/lefthand/game-abcd.wasm', '/lefthand/engine/game-abcd.js']);
});

test('archived game hosts send every path and query to the shelf with a 302', async () => {
  const real = createHandler(games);
  assert.ok(archivedHosts.length > 0);
  for (const host of archivedHosts) {
    for (const path of ['/', '/a/b?x=1&y=2', '/sw.js', '/release.json', '//evil.example/x', '/proto/lantern/']) {
      for (const method of ['GET', 'HEAD', 'POST']) {
        const response = await real.fetch(new Request(`https://${host}${path}`, { method }), assets);
        assert.equal(response.status, 302, `${method} ${host}${path}`);
        assert.equal(response.headers.get('location'), 'https://human.adamwhite.work/games/', `${method} ${host}${path}`);
      }
    }
  }
  // A live legacy host still goes to its game, and play.adamwhite.work is unchanged.
  const stairwell = createHandler([{ ...base, slug: 'stairwell', legacyOrigin: 'https://stairwell.adamwhite.work', redirectEnabled: true, verifiedRelease: 'b'.repeat(40) }]);
  const old = await stairwell.fetch(new Request('https://stairwell.adamwhite.work/a?x=1'), assets);
  assert.equal(old.status, 302);
  assert.equal(old.headers.get('location'), 'https://play.adamwhite.work/stairwell/a?x=1');
  assert.equal(await (await stairwell.fetch(new Request('https://play.adamwhite.work/stairwell/'), assets)).text(), 'asset');
  assert.equal((await stairwell.fetch(new Request('https://play.adamwhite.work/'), assets)).headers.get('location'), 'https://human.adamwhite.work/games/');
  // Look-alike hosts are not archived, and removing a host from the list is the rollback: the Worker then has
  // nothing to say about it.
  const fixture = createHandler(games, ['old.adamwhite.work', 'gone.adamwhite.work']);
  assert.equal((await fixture.fetch(new Request('https://old.adamwhite.work/x?y=1'), assets)).headers.get('location'), 'https://human.adamwhite.work/games/');
  assert.equal((await fixture.fetch(new Request('https://old.adamwhite.work.evil.example/'), assets)).status, 404);
  assert.equal((await fixture.fetch(new Request('https://x.old.adamwhite.work/'), assets)).status, 404);
  const rolledBack = createHandler(games, ['gone.adamwhite.work']);
  assert.equal((await rolledBack.fetch(new Request('https://old.adamwhite.work/'), assets)).status, 404);
  assert.equal((await rolledBack.fetch(new Request('https://gone.adamwhite.work/'), assets)).status, 302);
});
test('a games.json legacy origin cannot also be an archived host', () => {
  const revived = { hfVersion: '4.17.0', games: [{ ...base, slug: 'old', legacyOrigin: 'https://old.adamwhite.work', redirectEnabled: true, verifiedRelease: 'b'.repeat(40) }] };
  assert.throws(() => validateRegistry(revived, ['old.adamwhite.work']), /archived host/);
  assert.throws(() => createHandler(revived.games, ['old.adamwhite.work']), /archived host/);
  assert.doesNotThrow(() => validateRegistry(revived, []));
  // The real list and the real registry agree.
  for (const host of archivedHosts) assert.throws(() => validateRegistry({ hfVersion: '4.17.0', games: [{ ...revived.games[0], legacyOrigin: `https://${host}` }] }), /archived host/, host);
});
