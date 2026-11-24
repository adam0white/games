import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { handle, validateQuest, cleanQuest, buildQuestMessages, GIVERS, KINDS, TARGETS, MOODS, QUEST_LIMITS, QUEST_SCHEMA, LIMITS, readSpend, takeOne } from '../src/core.mjs';

const GOOD = { giver: 'beetle', kind: 'fetch', target: 'seed', count: 3, mood: 'grumpy', variant: 0 };
const QUEST = { name: 'Old Beetle', ask: 'Bring me 3 seeds, please. My pantry echoes!', thanks: 'A feast! My pantry has stopped echoing.', scold: 'Even the moss is overtaking you!', secret: 'The oldest daisy keeps a spare sunrise under one leaf.' };
const PERSONA = { name: 'Old Scar', title: 'Keeper of the Grass', temperament: 'stalker', persistence: 2, territory: 2, lines: { rise: 'Hello, little Ant.', notice: 'Hello again.', escape: 'Come back!', kill: 'Crunch!', beaten: 'Good work!' } };
const NOW = Date.UTC(2026, 10, 23, 12), DAY = '2026-11-23';
// Real SQLite under the same cursor interface as Durable Object storage.
function fakeSql() {
  const db = new DatabaseSync(':memory:');
  return { db, exec: (q, ...binds) => { const st = db.prepare(q); const rows = /^\s*SELECT/i.test(q) ? st.all(...binds) : (st.run(...binds), []); return { toArray: () => rows }; } };
}
function fakeEnv({ ai, perIp = 100, global = 100, cap = 100 } = {}) {
  const sql = fakeSql(), calls = [], keys = [], counts = {};
  const limiter = (name, max) => ({ limit: async ({ key }) => { keys.push([name, key]); const k = name + key; counts[k] = (counts[k] || 0) + 1; return { success: counts[k] <= max }; } });
  return {
    sql, calls, keys, MODEL: '@cf/test/model', DAILY_CAP: String(cap), PER_IP: limiter('ip', perIp), GLOBAL: limiter('global', global),
    DAILY: { idFromName: n => { assert.equal(n, 'global'); return n; }, get: () => ({ take: async (...args) => takeOne(sql, ...args), spend: async day => readSpend(sql, day) }) },
    AI: { run: async (model, input, options) => { calls.push({ model, input, options }); return ai ? ai(input) : { response: input.response_format.json_schema === QUEST_SCHEMA ? QUEST : PERSONA }; } },
  };
}
const ctx = () => { const waits = []; return { waits, waitUntil: p => waits.push(p) }; };
const deps = extra => ({ now: () => NOW, ...extra });
function req(body = GOOD, { path = '/lab-api/quest', method = 'POST', origin = 'https://play.adamwhite.work', type = 'application/json', raw, ip = '203.0.113.5', length } = {}) {
  return new Request(`https://play.adamwhite.work${path}`, { method, ...(method === 'POST' || method === 'PUT' ? { body: raw ?? JSON.stringify(body) } : {}), headers: { ...(origin ? { Origin: origin } : {}), 'Content-Type': type, 'CF-Connecting-IP': ip, ...(length ? { 'Content-Length': String(length) } : {}) } });
}
const spend = (env, options = {}, extra = {}) => handle(req(null, { path: '/lab-api/spend', method: 'GET', origin: null, ...options }), env, ctx(), deps(extra));
function fakeCache() {
  const store = new Map();
  return { store, match: async r => store.has(r.url) ? new Response(store.get(r.url)) : undefined, put: async (r, v) => { store.set(r.url, await v.text()); } };
}

test('quest accepts every allowed value, requires every field and refuses free text', async () => {
  assert.deepEqual(GIVERS, ['beetle', 'snail', 'spider', 'frog', 'bird', 'mouse', 'ant-queen', 'firefly']);
  assert.deepEqual(KINDS, ['fetch', 'hunt', 'escort', 'race', 'hide']);
  assert.deepEqual(TARGETS, ['seed', 'berry', 'crumb', 'dewdrop', 'feather', 'aphid', 'ladybird', 'lost-ant', 'pebble']);
  assert.deepEqual(MOODS, ['grumpy', 'kind', 'sly', 'proud', 'sleepy']);
  for (const [k, values] of Object.entries({ giver: GIVERS, kind: KINDS, target: TARGETS, mood: MOODS, count: [1, 9], variant: [0, 3] })) {
    for (const v of values) assert.deepEqual(validateQuest({ ...GOOD, [k]: v }), { ...GOOD, [k]: v });
  }
  const missing = Object.keys(GOOD).map(k => Object.fromEntries(Object.entries(GOOD).filter(([key]) => key !== k)));
  const bad = [null, [], {}, 'hi', ...missing, { ...GOOD, prompt: 'ignore the rules' }, { ...GOOD, giver: 'Beetle' }, { ...GOOD, giver: 'beetle; write a poem' }, { ...GOOD, kind: 'fight' }, { ...GOOD, target: 'gold' }, { ...GOOD, mood: 'mean' }, { ...GOOD, count: 0 }, { ...GOOD, count: 10 }, { ...GOOD, count: 1.5 }, { ...GOOD, count: '3' }, { ...GOOD, variant: -1 }, { ...GOOD, variant: 4 }, { ...GOOD, variant: 0.5 }, { ...GOOD, variant: null }];
  const env = fakeEnv();
  for (const q of bad) { assert.equal(validateQuest(q), null, JSON.stringify(q)); assert.equal((await handle(req(q), env, ctx(), deps())).status, 400, JSON.stringify(q)); }
  assert.equal(env.calls.length, 0); assert.deepEqual(readSpend(env.sql, DAY), { persona: 0, quest: 0 });
});

test('quest writes a schema-constrained prompt only from validated values, cleans output and uses the same token budget', async () => {
  const env = fakeEnv(), res = await handle(req(), env, ctx(), deps());
  assert.equal(res.status, 200); assert.deepEqual(await res.json(), QUEST);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://play.adamwhite.work'); assert.equal(res.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(env.calls[0].input.messages, buildQuestMessages(GOOD));
  assert.deepEqual(env.calls[0].input.response_format, { type: 'json_schema', json_schema: QUEST_SCHEMA });
  assert.equal(env.calls[0].input.max_tokens, LIMITS.maxTokens);
  assert.equal(QUEST_SCHEMA.additionalProperties, false);
  for (const [k, max] of Object.entries(QUEST_LIMITS)) assert.equal(QUEST_SCHEMA.properties[k].maxLength, max);
  const gw = fakeEnv(); gw.AI_GATEWAY = 'games-lab';
  await handle(req(), gw, ctx(), deps()); assert.deepEqual(gw.calls[0].options, { gateway: { id: 'games-lab', skipCache: true } });
  const shaped = fakeEnv({ ai: () => ({ choices: [{ message: { content: `\u0060\u0060\u0060json\n${JSON.stringify(QUEST)}\n\u0060\u0060\u0060` } }] }) });
  assert.deepEqual(await (await handle(req(), shaped, ctx(), deps())).json(), QUEST);
});

test('quest asks must retain the count and target after clamping; natural plurals and lost ant pass', () => {
  for (const [target, word] of [['seed', 'seeds'], ['berry', 'berries'], ['crumb', 'crumbs'], ['dewdrop', 'dewdrops'], ['feather', 'feathers'], ['aphid', 'aphids'], ['ladybird', 'ladybirds'], ['lost-ant', 'lost ants'], ['pebble', 'pebbles']]) {
    assert.ok(cleanQuest({ ...QUEST, ask: `Please find 3 shiny ${word}.` }, { ...GOOD, target }), word);
  }
  assert.ok(cleanQuest({ ...QUEST, ask: 'Please guide 3 lost-ants home.' }, { ...GOOD, target: 'lost-ant' }));
  for (const ask of ['Bring me seeds!', 'Bring me 4 seeds!', 'Bring me 13 seeds!', 'Bring me 3 seedlings!', 'Bring me 3 berries!', `${'Please hurry. '.repeat(8)}Bring me 3 seeds.`]) assert.equal(cleanQuest({ ...QUEST, ask }, GOOD), null, ask);
  const out = cleanQuest({ ...QUEST, name: "Old 😀 Beetle 17 <>", thanks: 'Thank you! '.repeat(20), scold: 'You’re slow—like moss!', secret: 'A long meadow tale. '.repeat(20) }, GOOD);
  assert.ok(out); assert.equal(out.name, 'Old Beetle'); assert.equal(out.scold, "You're slow-like moss!");
  for (const [k, max] of Object.entries(QUEST_LIMITS)) assert.ok(out[k].length <= max, k);
  assert.match(out.name, /^[A-Za-z' -]+$/);
});

test('the prompt and cleaned name use the whole species word for all eight givers', () => {
  const givers = [
    ['beetle', 'beetle', 'Beetle'], ['snail', 'snail', 'Snail'],
    ['spider', 'spider', 'Spider'], ['frog', 'frog', 'Frog'],
    ['bird', 'bird', 'Bird'], ['mouse', 'mouse', 'Mouse'],
    ['ant-queen', 'ant', 'Ant Queen'], ['firefly', 'firefly', 'Firefly'],
  ];
  for (const [giver, species, fallback] of givers) {
    const q = { ...GOOD, giver };
    assert.ok(buildQuestMessages(q)[1].content.includes(`Include the word "${species}" in its name.`));
    const name = `Moss-${species.toUpperCase()}`;
    assert.deepEqual(cleanQuest({ ...QUEST, name }, q), { ...QUEST, name });
    for (const wrong of ['Old Boots', `Moss${species}`, `Queen ${species}ling`, `Moss Under the Old Stone ${species}`]) {
      assert.deepEqual(cleanQuest({ ...QUEST, name: wrong }, q), { ...QUEST, name: fallback }, wrong);
    }
  }
});

test('quest applies the persona banned-word filter to every field and rejects missing or non-text output', () => {
  for (const k of Object.keys(QUEST)) {
    assert.equal(cleanQuest({ ...QUEST, [k]: k === 'ask' ? 'Bring 3 seeds to the god.' : 'The god waits.' }, GOOD), null, k);
    assert.equal(cleanQuest({ ...QUEST, [k]: '' }, GOOD), null, k);
    assert.equal(cleanQuest({ ...QUEST, [k]: 123 }, GOOD), null, k);
  }
  for (const raw of [null, [], 'Sorry!', '{"name":', { ...QUEST, name: '!!' }]) assert.equal(cleanQuest(raw, GOOD), null);
});

test('quest refuses foreign or absent Origin, malformed and oversized bodies, and other methods', async () => {
  const env = fakeEnv();
  for (const origin of [null, 'https://evil.example', 'https://play.adamwhite.work.evil.example', 'http://localhost.evil.example']) {
    const res = await handle(req(GOOD, { origin }), env, ctx(), deps()); assert.equal(res.status, 403); assert.equal(res.headers.get('Access-Control-Allow-Origin'), null);
  }
  for (const origin of ['http://localhost', 'http://localhost:8787', 'http://127.0.0.1:8787']) assert.equal((await handle(req(GOOD, { origin }), env, ctx(), deps())).status, 200);
  for (const raw of ['{', '', 'not json']) assert.equal((await handle(req(null, { raw }), env, ctx(), deps())).status, 400);
  assert.equal((await handle(req(GOOD, { type: 'text/plain' }), env, ctx(), deps())).status, 400);
  assert.equal((await handle(req(GOOD, { length: LIMITS.body + 1 }), env, ctx(), deps())).status, 413);
  assert.equal((await handle(req(null, { raw: ' '.repeat(LIMITS.body + 1) }), env, ctx(), deps())).status, 413);
  assert.equal((await handle(req(GOOD, { method: 'PUT' }), env, ctx(), deps())).status, 405);
  assert.equal((await handle(req(GOOD, { path: '/lab-api/quest/extra' }), env, ctx(), deps())).status, 404);
  const pre = await handle(req(null, { method: 'OPTIONS' }), env, ctx(), deps()); assert.equal(pre.status, 204); assert.equal(pre.headers.get('Access-Control-Allow-Methods'), 'POST');
  assert.equal(env.calls.length, 3, 'only the localhost requests call the model');
});

test('persona and quest share the per-IP and global limits and fail closed on limiter errors', async () => {
  const persona = { event: 'rise', form: 'Wasp', playerForm: 'Ant', kills: 1 };
  const ip = fakeEnv({ perIp: 1 });
  assert.equal((await handle(req(persona, { path: '/lab-api/persona' }), ip, ctx(), deps())).status, 200);
  assert.equal((await handle(req(), ip, ctx(), deps())).status, 429);
  assert.equal((await handle(req(GOOD, { ip: '198.51.100.9' }), ip, ctx(), deps())).status, 200);
  assert.ok(ip.keys.filter(([n]) => n === 'ip').every(([, k]) => !k.includes('quest') && !k.includes('persona')));
  const all = fakeEnv({ global: 1 });
  assert.equal((await handle(req(), all, ctx(), deps())).status, 200);
  assert.equal((await handle(req(persona, { path: '/lab-api/persona', ip: 'other' }), all, ctx(), deps())).status, 429);
  for (const binding of ['PER_IP', 'GLOBAL']) {
    const broken = fakeEnv(); broken[binding] = { limit: async () => { throw new Error('down'); } };
    assert.equal((await handle(req(), broken, ctx(), deps())).status, 429); assert.equal(broken.calls.length, 0);
  }
});

test('quest cache includes every input field and a cache hit spends no call or rate limit', async () => {
  const env = fakeEnv({ perIp: 1, cap: 1 }), cache = fakeCache(), c = ctx();
  assert.equal((await handle(req(), env, c, deps({ cache }))).status, 200); await Promise.all(c.waits);
  assert.equal((await handle(req(), env, ctx(), deps({ cache }))).status, 200);
  assert.equal(env.calls.length, 1); assert.deepEqual(readSpend(env.sql, DAY), { persona: 0, quest: 1 });
  assert.equal(env.keys.length, 2, 'one per-IP and one global limiter call');
  for (const [k, v] of Object.entries({ giver: 'snail', kind: 'hunt', target: 'berry', count: 2, mood: 'kind', variant: 1 })) assert.equal((await handle(req({ ...GOOD, [k]: v }), env, ctx(), deps({ cache }))).status, 429, k);
  assert.equal(cache.store.size, 1);
});

test('quest retries a model failure or unusable output once and caches only the successful answer', async () => {
  for (const fail of [() => { throw new Error('down'); }, () => ({ response: 'No quest.' }), () => ({ response: { ...QUEST, secret: 'There will be blood!' } })]) {
    let calls = 0;
    const env = fakeEnv({ ai: () => ++calls === 1 ? fail() : { response: QUEST }, perIp: 1, global: 1, cap: 2 });
    const cache = fakeCache(), c = ctx();
    const res = await handle(req(), env, c, deps({ cache }));
    assert.equal(res.status, 200); assert.deepEqual(await res.json(), QUEST);
    await Promise.all(c.waits);
    assert.equal(env.calls.length, 2);
    assert.deepEqual(readSpend(env.sql, DAY), { persona: 0, quest: 2 });
    assert.equal(env.keys.length, 2, 'one request uses each limiter once');
    assert.equal(cache.store.size, 1);
  }
});

test('two quest failures return the original model error and neither attempt is cached', async () => {
  for (const ai of [() => { throw new Error('down'); }, () => ({ response: 'No quest.' }), () => ({ response: { ...QUEST, secret: 'There will be blood!' } })]) {
    const env = fakeEnv({ ai }), cache = fakeCache(), c = ctx();
    const res = await handle(req(), env, c, deps({ cache }));
    assert.equal(res.status, 502); assert.deepEqual(await res.json(), { error: 'model' });
    assert.equal(env.calls.length, 2);
    assert.deepEqual(readSpend(env.sql, DAY), { persona: 0, quest: 2 });
    assert.equal(c.waits.length, 0); assert.equal(cache.store.size, 0);
  }
});

test('hung quest attempts wait at most 6000 ms and 3000 ms with quota charged per invocation', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: NOW });
  const env = fakeEnv({ ai: () => new Promise(() => {}) });
  const flush = () => new Promise(resolve => setImmediate(resolve));
  let finished = false;
  const response = handle(req(), env, ctx(), deps()).then(res => { finished = true; return res; });
  await flush();
  t.mock.timers.tick(5999); await flush();
  assert.equal(env.calls.length, 1);
  assert.deepEqual(readSpend(env.sql, DAY), { persona: 0, quest: 1 });
  t.mock.timers.tick(1); await flush();
  assert.equal(env.calls.length, 2);
  assert.deepEqual(readSpend(env.sql, DAY), { persona: 0, quest: 2 });
  t.mock.timers.tick(2999); await flush();
  assert.equal(finished, false);
  t.mock.timers.tick(1);
  assert.equal((await response).status, 502);
  assert.equal(Date.now() - NOW, 9000);
});

test('quest bypasses legacy cached names and caches the species fallback without a retry', async () => {
  const old = { ...QUEST, name: 'Old Boots' };
  const env = fakeEnv({ ai: () => ({ response: old }), cap: 1 });
  const cache = fakeCache(), c = ctx();
  cache.store.set('https://games-lab-ai.cache/quest/v1/beetle/fetch/seed/3/grumpy/0', JSON.stringify(old));
  const expected = { ...QUEST, name: 'Beetle' };
  assert.deepEqual(await (await handle(req(), env, c, deps({ cache }))).json(), expected);
  await Promise.all(c.waits);
  assert.deepEqual(await (await handle(req(), env, ctx(), deps({ cache }))).json(), expected);
  assert.equal(env.calls.length, 1);
  assert.deepEqual(readSpend(env.sql, DAY), { persona: 0, quest: 1 });
});

test('a missing inference binding does not consume daily allowance', async () => {
  const env = fakeEnv();
  delete env.AI;
  const res = await handle(req(), env, ctx(), deps());
  assert.equal(res.status, 502); assert.deepEqual(await res.json(), { error: 'model' });
  assert.deepEqual(readSpend(env.sql, DAY), { persona: 0, quest: 0 });
});

test('one shared daily cap counts both endpoints, including failures, and resets at UTC midnight', async () => {
  const env = fakeEnv({ cap: 2 }), persona = { event: 'rise', form: 'Ant', playerForm: 'Ant', kills: 1 };
  assert.equal((await handle(req(persona, { path: '/lab-api/persona' }), env, ctx(), deps())).status, 200);
  env.AI.run = async () => { env.calls.push({}); throw new Error('down'); };
  const failed = await handle(req(), env, ctx(), deps());
  assert.equal(failed.status, 502); assert.deepEqual(await failed.json(), { error: 'model' });
  assert.deepEqual(await (await spend(env)).json(), { day: DAY, calls: { persona: 1, quest: 1 }, cap: 2 });
  assert.equal((await handle(req(), env, ctx(), deps())).status, 503); assert.equal(env.calls.length, 2);
  assert.equal((await handle(req(), env, ctx(), deps({ now: () => NOW + 86400000 }))).status, 502);
  assert.deepEqual(readSpend(env.sql, '2026-11-24'), { persona: 0, quest: 2 });
  assert.deepEqual(env.sql.exec('SELECT day, n FROM days').toArray().map(r => ({ ...r })), [{ day: '2026-11-24', n: 2 }]);
  assert.deepEqual(env.sql.exec('SELECT day, persona, quest FROM calls').toArray().map(r => ({ ...r })), [{ day: '2026-11-24', persona: 0, quest: 2 }]);
});

test('spend returns only current-day aggregate counts, permits same-site reads, and fails closed', async () => {
  const env = fakeEnv();
  const res = await spend(env); assert.equal(res.status, 200); assert.equal(res.headers.get('Cache-Control'), 'no-store'); assert.deepEqual(await res.json(), { day: DAY, calls: { persona: 0, quest: 0 }, cap: 100 });
  assert.equal((await spend(env, { origin: 'http://localhost:8787' })).headers.get('Access-Control-Allow-Origin'), 'http://localhost:8787');
  assert.equal((await spend(env, { origin: 'https://evil.example' })).status, 403);
  assert.equal((await spend(env, { method: 'POST', origin: 'https://play.adamwhite.work' })).status, 405);
  const pre = await spend(env, { method: 'OPTIONS', origin: 'http://localhost:8787' }); assert.equal(pre.status, 204); assert.equal(pre.headers.get('Access-Control-Allow-Methods'), 'GET');
  assert.equal(env.calls.length, 0); assert.equal(env.keys.length, 0, 'reading counts does not consume model rate limits');
  env.DAILY.get = () => { throw new Error('down'); };
  assert.equal((await spend(env)).status, 503); assert.equal((await handle(req(), env, ctx(), deps())).status, 503); assert.equal(env.calls.length, 0);
});

test('spend on real SQLite preserves legacy days and the cap while backfilling persona calls once', () => {
  const sql = fakeSql();
  sql.exec('CREATE TABLE days (day TEXT PRIMARY KEY, n INTEGER NOT NULL)'); sql.exec('INSERT INTO days (day, n) VALUES (?, ?)', DAY, 4);
  assert.deepEqual(readSpend(sql, DAY), { persona: 4, quest: 0 });
  assert.deepEqual(takeOne(sql, DAY, 6, 'quest'), { ok: true, n: 5 });
  assert.deepEqual(takeOne(sql, DAY, 6), { ok: true, n: 6 });
  assert.deepEqual(takeOne(sql, DAY, 6, 'quest'), { ok: false, n: 6 });
  for (let i = 0; i < 3; i++) assert.deepEqual(readSpend(sql, DAY), { persona: 5, quest: 1 });
  assert.deepEqual(readSpend(sql, '2026-11-24'), { persona: 0, quest: 0 });
  assert.throws(() => takeOne(sql, DAY, 100, 'unknown'), /endpoint/);
  assert.deepEqual(sql.exec('SELECT day, n FROM days').toArray().map(r => ({ ...r })), [{ day: DAY, n: 6 }]);
});
