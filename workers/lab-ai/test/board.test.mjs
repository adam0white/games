import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { handleBoard, validateScore, tidyName, rudeName, shownName, boardTop, boardPut, boardRemove, boardStart, BOARD, RUN } from '../src/board.mjs';

const ID = n => `player-${String(n).padStart(4, '0')}-0123456789abcdef`;
// A stand-in for ctx.storage.sql (exec returning a cursor with toArray) over a real SQLite database.
function fakeSql() {
  const db = new DatabaseSync(':memory:');
  return { db, exec: (q, ...binds) => { const st = db.prepare(q); const rows = /^\s*SELECT/i.test(q) ? st.all(...binds) : (st.run(...binds), []); return { toArray: () => rows }; } };
}
// Stand-ins for the Durable Object namespace (one object per name, each on its own SQLite), the limiter and the Cache API.
function fakeEnv({ perIp = 100, broken = false } = {}) {
  const objects = new Map(), counts = {}, keys = [];
  return {
    objects, keys,
    PER_IP: { limit: async ({ key }) => { keys.push(key); counts[key] = (counts[key] || 0) + 1; return { success: counts[key] <= perIp }; } },
    BOARD: { idFromName: n => n, get: id => { if (broken) throw new Error('down'); if (!objects.has(id)) { const sql = fakeSql(); objects.set(id, { sql, top: async l => boardTop(sql, l), put: async (q, now, need) => boardPut(sql, q, now, undefined, need), remove: async i => boardRemove(sql, i), start: async (r, now) => boardStart(sql, r, now) }); } return objects.get(id); } },
  };
}
function fakeCache() {
  const store = new Map();
  return { store, match: async req => (store.has(req.url) ? new Response(store.get(req.url)) : undefined), put: async (req, res) => { store.set(req.url, await res.text()); }, delete: async req => store.delete(req.url) };
}
const ctx = () => { const waits = []; return { waits, waitUntil: p => waits.push(p) }; };
function req(body, { method = 'POST', origin = 'https://play.adamwhite.work', type = 'application/json', path = '/lab-api/board/lantern', ip = '203.0.113.5', raw } = {}) {
  return new Request(`https://play.adamwhite.work${path}`, { method, body: method === 'POST' ? (raw ?? JSON.stringify(body)) : undefined, headers: { ...(origin ? { Origin: origin } : {}), ...(method === 'POST' ? { 'Content-Type': type } : {}), 'CF-Connecting-IP': ip } });
}
const get = (opts = {}) => req(null, { method: 'GET', origin: null, ...opts });

test('names are tidied the way the game tidies them', () => {
  assert.equal(tidyName('  Ada <b>1</b>  '), 'Ada b1b');
  assert.equal(tidyName('Çağla_Şen.x-y and more'), 'Çağla_Şen.x-y an');
  assert.equal(tidyName('a'.repeat(40)), 'a'.repeat(16));
  assert.equal(tidyName('<>!!'), ''); assert.equal(tidyName(7), ''); assert.equal(tidyName(null), '');
  assert.equal(tidyName('a\u0000\n\tb'), 'ab');
});

test('rude names are stored as Player; ordinary names pass', () => {
  for (const n of ['fuck', 'F.u_c-k you', 'sh1t', '5hit head', 'B1TCH', 'xXn1ggaXx', 'a55hole']) { assert.equal(rudeName(tidyName(n)), true, n); assert.equal(shownName(n), 'Player', n); }
  for (const n of ['Ada', 'Rio river', 'Deniz', 'Kai_7', 'Çağla', 'Otto 1234', 'Mira.x', 'Player', 'Grape', 'Essex', 'Hancock', 'Dickens']) assert.equal(shownName(n), n, n);
  assert.equal(shownName('<>'), ''); assert.deepEqual(validateScore({ id: ID(1), n: 'sh1t', s: 5 }), { id: ID(1), n: 'Player', s: 5 });
});

test('validation: an id, a name and a whole score in range; nothing else', () => {
  assert.deepEqual(validateScore({ id: ID(1), n: ' Ada ', s: 120 }), { id: ID(1), n: 'Ada', s: 120 });
  assert.deepEqual(validateScore({ id: ID(1), remove: true }), { id: ID(1), remove: true });
  for (const bad of [null, [], 'x', {}, { id: 'short', n: 'Ada', s: 1 }, { id: ID(1), n: '', s: 1 }, { id: ID(1), n: '<>', s: 1 }, { id: ID(1), n: 'Ada', s: 0 }, { id: ID(1), n: 'Ada', s: 1.5 },
    { id: ID(1), n: 'Ada', s: '12' }, { id: ID(1), n: 'Ada', s: BOARD.maxScore + 1 }, { id: ID(1), n: 'Ada', s: -4 }, { id: ID(1), n: 'Ada', s: NaN }, { id: ID(1), n: 'Ada', s: 5, extra: 1 },
    { id: ID(1), n: 'Ada' }, { id: ID(1), s: 5 }, { id: ID(1), remove: 'yes' }, { id: ID(1), remove: true, s: 5 }, { id: `${ID(1)}'; DROP TABLE scores;--`, n: 'Ada', s: 5 }]) assert.equal(validateScore(bad), null, JSON.stringify(bad));
});

test('storage on real SQLite: one row per player, the best score, the newest name, places with ties', () => {
  const sql = fakeSql();
  assert.deepEqual(boardTop(sql), []);
  assert.deepEqual(boardPut(sql, { id: ID(1), n: 'Ada', s: 100 }, 1000), { ok: true, place: 1, rows: [{ n: 'Ada', s: 100 }] });
  assert.equal(boardPut(sql, { id: ID(2), n: 'Bo', s: 300 }, 2000).place, 1);
  assert.equal(boardPut(sql, { id: ID(3), n: 'Cy', s: 100 }, 3000).place, 3, 'a tie goes to the earlier run');
  // a worse run keeps the best score and takes the new name
  assert.deepEqual(boardPut(sql, { id: ID(2), n: 'Bo2', s: 50 }, 4000).rows, [{ n: 'Bo2', s: 300 }, { n: 'Ada', s: 100 }, { n: 'Cy', s: 100 }]);
  assert.equal(boardPut(sql, { id: ID(3), n: 'Cy', s: 500 }, 5000).place, 1);
  assert.equal(sql.db.prepare('SELECT COUNT(*) AS c FROM scores').get().c, 3);
  assert.ok(boardTop(sql).every(r => Object.keys(r).join() === 'n,s'), 'ids never leave');
  assert.deepEqual(boardRemove(sql, ID(3)).rows, [{ n: 'Bo2', s: 300 }, { n: 'Ada', s: 100 }]);
  assert.equal(boardRemove(sql, 'nobody-here-0123456789').ok, true);
});

test('storage: the daily cap on new players, a new day, and only the best rows are kept', () => {
  const sql = fakeSql(), day1 = Date.UTC(2026, 10, 23, 12), day2 = day1 + 86400000;
  assert.equal(boardPut(sql, { id: ID(1), n: 'A', s: 10 }, day1, 2).ok, true);
  assert.equal(boardPut(sql, { id: ID(2), n: 'B', s: 20 }, day1, 2).ok, true);
  const over = boardPut(sql, { id: ID(3), n: 'C', s: 30 }, day1, 2);
  assert.equal(over.ok, false); assert.equal(over.rows.length, 2, 'nothing was written');
  assert.equal(boardPut(sql, { id: ID(1), n: 'A', s: 40 }, day1, 2).ok, true, 'a known player still posts when the cap is reached');
  assert.equal(boardPut(sql, { id: ID(3), n: 'C', s: 30 }, day2, 2).ok, true, 'a new UTC day starts again');
  assert.equal(sql.db.prepare('SELECT COUNT(*) AS c FROM days').get().c, 1);
  const big = fakeSql();
  for (let i = 1; i <= BOARD.keep + 5; i++) boardPut(big, { id: ID(i), n: `p${i}`, s: i }, i, 1e9);
  assert.equal(big.db.prepare('SELECT COUNT(*) AS c FROM scores').get().c, BOARD.keep);
  assert.equal(big.db.prepare('SELECT MIN(s) AS m FROM scores').get().m, 6, 'the lowest rows went');
  assert.equal(boardTop(big).length, BOARD.top);
  assert.equal(boardPut(big, { id: ID(9000), n: 'low', s: 1 }, 1, 1e9).place, 0, 'a score below everything kept is not listed');
});

test('the endpoint: post, read, rename, remove', async () => {
  const env = fakeEnv();
  let res = await handleBoard(get(), env, ctx()); assert.equal(res.status, 200); assert.deepEqual(await res.json(), { rows: [] });
  res = await handleBoard(req({ id: ID(1), n: 'Ada <1>', s: 9000 }), env, ctx());
  assert.equal(res.status, 200); assert.deepEqual(await res.json(), { place: 1, rows: [{ n: 'Ada 1', s: 9000 }] });
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://play.adamwhite.work'); assert.equal(res.headers.get('Cache-Control'), 'no-store');
  await handleBoard(req({ id: ID(2), n: 'Bo', s: 12 }), env, ctx());
  res = await handleBoard(get(), env, ctx()); assert.deepEqual(await res.json(), { rows: [{ n: 'Ada 1', s: 9000 }, { n: 'Bo', s: 12 }] });
  res = await handleBoard(req({ id: ID(1), remove: true }), env, ctx()); assert.deepEqual(await res.json(), { place: 0, rows: [{ n: 'Bo', s: 12 }] });
  assert.deepEqual([...env.objects.keys()], ['lantern'], 'one object, named by the game');
  assert.ok(env.keys.every(k => k === 'board:203.0.113.5'), 'the limiter is keyed apart from the persona endpoint');
  const stored = env.objects.get('lantern').sql.db.prepare('SELECT * FROM scores').all();
  assert.deepEqual(Object.keys(stored[0]).sort(), ['id', 'n', 's', 't'], 'only the id, name, score and time are stored');
  assert.ok(!JSON.stringify(stored).includes('203.0.113'), 'no address is stored');
});

test('the endpoint refuses: other paths and games, foreign origins, bad bodies, big bodies, other methods', async () => {
  const env = fakeEnv(), status = async r => (await handleBoard(r, env, ctx())).status;
  assert.equal(await status(get({ path: '/lab-api/board/' })), 404);
  assert.equal(await status(get({ path: '/lab-api/board/chess' })), 404);
  assert.equal(await status(get({ path: '/lab-api/board/lantern/x' })), 404);
  assert.equal(await status(get({ origin: 'https://evil.example' })), 403);
  assert.equal(await status(req({ id: ID(1), n: 'A', s: 5 }, { origin: 'https://evil.example' })), 403);
  assert.equal(await status(req({ id: ID(1), n: 'A', s: 5 }, { origin: null })), 403, 'a post needs the site origin');
  assert.equal(await status(req({ id: ID(1), n: 'A', s: 5 }, { origin: 'http://localhost:8788' })), 200);
  assert.equal(await status(req({ id: ID(1), n: 'A', s: 5 }, { type: 'text/plain' })), 400);
  assert.equal(await status(req(null, { raw: '{' })), 400);
  assert.equal(await status(req({ id: ID(1), n: 'A', s: 5e9 })), 400);
  assert.equal(await status(req(null, { raw: JSON.stringify({ id: ID(1), n: 'A', s: 5, pad: 'x'.repeat(400) }) })), 413);
  assert.equal(await status(new Request('https://play.adamwhite.work/lab-api/board/lantern', { method: 'DELETE', headers: { Origin: 'https://play.adamwhite.work' } })), 405);
  const pre = await handleBoard(new Request('https://play.adamwhite.work/lab-api/board/lantern', { method: 'OPTIONS', headers: { Origin: 'http://localhost:8788' } }), env, ctx());
  assert.equal(pre.status, 204); assert.equal(pre.headers.get('Access-Control-Allow-Methods'), 'GET, POST');
  assert.equal(env.objects.get('lantern').sql.db.prepare('SELECT COUNT(*) AS c FROM scores').get().c, 1, 'only the one good post was stored');
});

test('the endpoint: the per-address limit, a limiter error and a broken board all refuse; reads are cached and a post clears the cache', async () => {
  const env = fakeEnv({ perIp: 2 });
  for (const want of [200, 200, 429]) assert.equal((await handleBoard(req({ id: ID(1), n: 'A', s: 5 }), env, ctx())).status, want);
  assert.equal((await handleBoard(req({ id: ID(1), n: 'A', s: 5 }, { ip: '198.51.100.9' }), env, ctx())).status, 200, 'another address is not held back');
  const bad = fakeEnv(); bad.PER_IP = { limit: async () => { throw new Error('x'); } };
  assert.equal((await handleBoard(req({ id: ID(1), n: 'A', s: 5 }), bad, ctx())).status, 429);
  const down = fakeEnv({ broken: true });
  assert.equal((await handleBoard(get(), down, ctx())).status, 503); assert.equal((await handleBoard(req({ id: ID(1), n: 'A', s: 5 }), down, ctx())).status, 503);
  const cache = fakeCache(), c = ctx(), e = fakeEnv();
  await handleBoard(req({ id: ID(1), n: 'A', s: 5 }), e, c, { cache });
  await handleBoard(get(), e, c, { cache }); await Promise.all(c.waits); assert.equal(cache.store.size, 1);
  e.objects.get('lantern').top = async () => { throw new Error('must not be called'); };
  assert.deepEqual(await (await handleBoard(get(), e, c, { cache })).json(), { rows: [{ n: 'A', s: 5 }] }, 'answered from the cache');
  await handleBoard(req({ id: ID(2), n: 'B', s: 9 }), e, c, { cache }); await Promise.all(c.waits); assert.equal(cache.store.size, 0, 'a post clears the cached read');
});

test('run tickets, storage: a score needs the time it claims; a ticket works once; old tickets go; a full table refuses', () => {
  const sql = fakeSql(), t0 = 1_800_000_000_000, R = n => `run-${String(n).padStart(20, '0')}`;
  assert.deepEqual(validateScore({ start: true, r: R(1) }), { start: true, r: R(1) });
  assert.equal(validateScore({ start: true, r: 'short' }), null); assert.equal(validateScore({ start: true, r: R(1), id: ID(1) }), null);
  assert.deepEqual(validateScore({ id: ID(1), n: 'Ada', s: 5, r: R(1) }), { id: ID(1), n: 'Ada', s: 5, r: R(1) });
  assert.equal(validateScore({ id: ID(1), n: 'Ada', s: 5, r: 7 }), null); assert.equal(validateScore({ id: ID(1), n: 'Ada', s: 5, x: 1 }), null);
  assert.equal(boardStart(sql, R(1), t0).ok, true);
  // Ten seconds allow 10 * 18 + 50 = 230 points.
  let out = boardPut(sql, { id: ID(1), n: 'Ada', s: 231, r: R(1) }, t0 + 10_000);
  assert.deepEqual([out.ok, out.why], [false, 'run']); assert.deepEqual(boardTop(sql), [], 'a refused score writes nothing');
  out = boardPut(sql, { id: ID(1), n: 'Ada', s: 230, r: R(1) }, t0 + 10_000); assert.equal(out.ok, true); assert.equal(out.place, 1);
  out = boardPut(sql, { id: ID(1), n: 'Eve', s: 1, r: R(1) }, t0 + 99_000);
  assert.equal(out.why, 'run', 'a used ticket is gone'); assert.deepEqual(boardTop(sql), [{ n: 'Ada', s: 230 }], 'and a refused post does not rename');
  assert.equal(boardPut(sql, { id: ID(2), n: 'Bo', s: 1, r: R(9) }, t0).why, 'run', 'an unknown ticket');
  boardStart(sql, R(2), t0); assert.equal(boardPut(sql, { id: ID(2), n: 'Bo', s: 1, r: R(2) }, t0 - 5).why, 'run', 'a clock that ran backwards');
  // Without a ticket: accepted for a game outside RUN.need, refused for one inside it.
  assert.deepEqual(RUN.need, []);
  assert.equal(boardPut(sql, { id: ID(3), n: 'Cy', s: 77 }, t0).ok, true);
  assert.equal(boardPut(sql, { id: ID(4), n: 'Di', s: 77 }, t0, BOARD.dailyNew, true).why, 'run');
  // The first start after six hours removes the old tickets.
  boardStart(sql, R(3), t0 + RUN.hours * 3600_000 + 1);
  assert.deepEqual(sql.db.prepare('SELECT r FROM runs').all().map(x => x.r), [R(3)]);
  assert.deepEqual(Object.keys(sql.db.prepare('SELECT * FROM runs').all()[0]).sort(), ['r', 't'], 'a ticket holds the run id and a time only');
  const keep = RUN.keep; RUN.keep = 2;
  try { assert.equal(boardStart(sql, R(4), t0 + RUN.hours * 3600_000 + 2).ok, true); assert.equal(boardStart(sql, R(5), t0 + RUN.hours * 3600_000 + 3).ok, false); } finally { RUN.keep = keep; }
});

test('run tickets, the endpoint: a start, a score in time, a score too soon; starts are limited apart and leave the cache alone', async () => {
  const env = fakeEnv({ perIp: 2 }), cache = fakeCache(), R = n => `run-${String(n).padStart(20, '0')}`;
  let now = 1_800_000_000_000; const deps = { cache, now: () => now };
  let c = ctx(); await handleBoard(get(), env, c, deps); await Promise.all(c.waits); assert.equal(cache.store.size, 1);
  let res = await handleBoard(req({ start: true, r: R(1) }), env, ctx(), deps);
  assert.equal(res.status, 200); assert.deepEqual(await res.json(), { ok: true }); assert.equal(cache.store.size, 1, 'a start leaves the cache');
  res = await handleBoard(req({ id: ID(1), n: 'Ada', s: 5000, r: R(1) }), env, c = ctx(), deps);
  assert.equal(res.status, 422); assert.deepEqual(await res.json(), { error: 'run' }); await Promise.all(c.waits); assert.equal(cache.store.size, 1, 'a refusal leaves the cache');
  now += 60_000;
  res = await handleBoard(req({ id: ID(1), n: 'Ada', s: 1100, r: R(1) }), env, ctx(), deps);
  assert.equal(res.status, 200); assert.deepEqual(await res.json(), { place: 1, rows: [{ n: 'Ada', s: 1100 }] });
  assert.deepEqual(env.keys.slice(-3), ['boardrun:203.0.113.5', 'board:203.0.113.5', 'board:203.0.113.5']);
  assert.equal((await handleBoard(req({ start: true, r: R(2) }), env, ctx(), deps)).status, 200);
  assert.equal((await handleBoard(req({ start: true, r: R(3) }), env, ctx(), deps)).status, 429, 'the third start in the window');
  assert.equal((await handleBoard(req({ start: true, r: R(4) }, { origin: 'https://evil.example' }), env, ctx(), deps)).status, 403);
  const open = fakeEnv(); assert.equal((await handleBoard(req({ id: ID(5), n: 'Old', s: 9 }), open, ctx(), deps)).status, 200, 'an old page, no ticket: accepted');
  RUN.need.push('lantern'); try { assert.equal((await handleBoard(req({ id: ID(6), n: 'Old', s: 9 }), open, ctx(), deps)).status, 422, 'refused once the game needs tickets'); } finally { RUN.need.length = 0; }
});
