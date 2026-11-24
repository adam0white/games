import { test } from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

// No server runs. Cloudflare's DurableObject base is replaced; routing and room code are real.
test('mode routing, protocol guards, metrics isolation and same-round recovery', async () => {
  const root = new URL('../', import.meta.url).pathname;
  let source = fs.readFileSync(root + 'src/index.mjs', 'utf8');
  source = source.replace(/export \{ (Room|Directory) \} from '[^']+';\n/g, '').replace(/from '([^']+)';/g, (_, spec) => `from '${pathToFileURL(root + 'src/' + spec).href}';`);
  const worker = (await import('data:text/javascript,' + encodeURIComponent(source))).default;
  const calls = [], points = [];
  const env = { LOADTEST_KEY: 'test-key', METRICS: { writeDataPoint: x => points.push(x) }, ROOM: {
   idFromName: name => name,
   get: name => ({ fetch: async req => { calls.push(['room', name, new URL(req.url).searchParams]); return new Response('joined'); } }),
   getByName: name => ({ stats: async () => { calls.push(['stats', name]); return {}; } }),
  }, DIRECTORY: { getByName: name => ({
   assign: async () => { calls.push(['dir', name]); return 'enam-0'; },
   metrics: async () => { calls.push(['metrics', name]); return []; },
   list: async () => { calls.push(['list', name]); return []; },
   report: async () => {},
  }) } };
  const ctx = { waitUntil: p => p };
  for (const mode of ['classic', 'feast', 'rush']) {
   calls.length = 0;
   let r = await worker.fetch(new Request(`https://game.test/crumbwar/play?mode=${mode}&lt=test-key`, { headers: { Upgrade: 'websocket' } }), env, ctx);
   assert.equal(r.status, 200);
   assert.deepEqual(calls[0], ['dir', mode === 'classic' ? 'dir:enam' : `dir:${mode}:enam`]);
   assert.equal(calls[1][1], mode === 'classic' ? 'enam-0' : `${mode}:enam-0`);
   assert.equal(calls[1][2].get('name'), 'enam-0');
   assert.equal(calls[1][2].get('mode'), mode);
   calls.length = 0;
   r = await worker.fetch(new Request(`https://game.test/crumbwar/api/metrics?mode=${mode}&lt=test-key`), env, ctx);
   assert.equal((await r.json()).mode, mode);
   assert.equal(calls.length, 7);
   assert.ok(calls.every(([, name]) => mode === 'classic' ? /^dir:[a-z]+$/.test(name) : name.startsWith(`dir:${mode}:`)));
   calls.length = 0;
   await worker.fetch(new Request(`https://game.test/crumbwar/api/status?mode=${mode}&lt=test-key&room=enam-0`), env, ctx);
   assert.equal(calls[0][1], mode === 'classic' ? 'enam-0' : `${mode}:enam-0`);
  }
  calls.length = 0;
  const bad = await worker.fetch(new Request('https://game.test/crumbwar/play?mode=unknown', { headers: { Upgrade: 'websocket' } }), env, ctx);
  assert.equal(bad.status, 400);
  assert.equal(calls.length, 0);
  
  let roomSource = fs.readFileSync(root + 'src/room.mjs', 'utf8').replace("import { DurableObject } from 'cloudflare:workers';", 'class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }').replace(/from '([^']+)';/g, (_, spec) => `from '${pathToFileURL(root + 'src/' + spec).href}';`);
  const { Room } = await import('data:text/javascript,' + encodeURIComponent(roomSource));
  const sqlCalls = [];
  const roomCtx = { getWebSockets: () => [], waitUntil: p => p, storage: { sql: { exec: (...args) => { sqlCalls.push(args); return { toArray: () => [] }; } } } };
  const reports = [];
  const roomEnv = { DIRECTORY: { getByName: name => ({ report: async (...args) => reports.push([name, ...args]) }) } };
  const { PROTO } = await import(pathToFileURL(root + 'public/crumbwar/shared/config.js'));
  for (const mode of ['classic', 'feast', 'rush']) {
   const room = new Room(roomCtx, roomEnv);
   const rejected = await room.fetch(new Request(`https://room/?mode=${mode}&name=enam-0&v=${PROTO + 1}`));
   assert.equal(rejected.status, 421);
   assert.equal(room.mode, mode);
   assert.equal(reports.at(-1)[0], mode === 'classic' ? 'dir:enam' : `dir:${mode}:enam`);
   assert.equal(reports.at(-1)[1], 'enam-0');
   assert.equal((await room.fetch(new Request(`https://room/?mode=${mode === 'classic' ? 'feast' : 'classic'}`))).status, 421);
   assert.equal((await room.fetch(new Request('https://room/?mode=unknown'))).status, 400);
  }
  
  const sim = await import(pathToFileURL(root + 'src/sim.mjs'));
  const ghostRoom = new Room(roomCtx, roomEnv);
  ghostRoom.mode = 'feast'; ghostRoom.name = 'enam-0'; ghostRoom.world = sim.createWorld(19, 'feast');
  const ant = sim.addAnt(ghostRoom.world, 0, false, 1, 2);
  Object.assign(ant, { mass: 40, rank: 3, bestRank: 4, goal: { kind: 'deliver', progress: 2 } });
  const socket = {};
  ghostRoom.clients.set(socket, { ant, token: 'resume-token' });
  ghostRoom.drop(socket);
  const ghost = ghostRoom.ghosts.get('resume-token');
  assert.deepEqual([ghost.keep.mass, ghost.keep.rank, ghost.keep.bestRank], [40, 3, 4]);
  assert.notEqual(ghost.keep.goal, ant.goal, 'ghost copies mutable progress');
  ghostRoom.world.round++;
  const oldRound = await ghostRoom.fetch(new Request('https://room/?mode=feast&name=enam-0&explicit=1&resume=resume-token'));
  assert.equal(oldRound.status, 410, 'old round progress cannot resume into the new round');
});
