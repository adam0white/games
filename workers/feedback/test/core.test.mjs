import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { handleApi, readTesters, sameSecret } from '../src/core.mjs';

const TESTER = 'a'.repeat(40);
const OTHER = 'b'.repeat(40);
const STAFF = 'c'.repeat(40);

// In-memory stand-ins for D1, R2 and Workers AI, with the real migration.
function fakeEnv({ ai } = {}) {
  const sqlite = new DatabaseSync(':memory:');
  for (const file of ['0001_init.sql', '0002_questions.sql']) sqlite.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8'));
  const prepare = (sql, args = []) => ({
    bind: (...next) => prepare(sql, next),
    first: async () => sqlite.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: sqlite.prepare(sql).all(...args) }),
    run: async () => { const info = sqlite.prepare(sql).run(...args); return { meta: { last_row_id: Number(info.lastInsertRowid), changes: Number(info.changes) } }; },
  });
  const objects = new Map();
  const calls = [];
  return {
    calls, objects,
    DB: { prepare },
    LAB: {
      put: async (key, bytes) => { objects.set(key, bytes); },
      get: async key => (objects.has(key) ? { body: objects.get(key), arrayBuffer: async () => objects.get(key).buffer } : null),
      delete: async key => { objects.delete(key); },
    },
    AI: { run: async (model, input) => { calls.push({ model, input }); return (ai ?? defaultAi)(model, input); } },
    TRANSCRIBE_MODEL: 'whisper', TRANSLATE_MODEL: 'chat', STAFF_TOKEN: STAFF,
    TESTERS: JSON.stringify([{ id: 't1', token: TESTER, lang: 'tr' }, { id: 't2', token: OTHER, lang: 'en' }]),
  };
}
const defaultAi = (model, input) => (model === 'whisper'
  ? { text: ' merhaba oyun güzel ', transcription_info: { language: 'tr' } }
  : { response: `[${/into (\w+)/.exec(input.messages[0].content)[1]}] ${input.messages[1].content}` });

const call = (env, path, { token = TESTER, method = 'GET', body, type = 'application/json' } = {}) => handleApi(new Request(`https://play.adamwhite.work/notes/api/${path}`, {
  method, body: body === undefined ? undefined : (body instanceof Uint8Array ? body : JSON.stringify(body)),
  headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': type }) },
}), env);
const audio = new Uint8Array(400).fill(7);

test('a missing or wrong token gets nothing, on every path', async () => {
  const env = fakeEnv();
  for (const token of [null, 'short', 'z'.repeat(40), STAFF]) {
    for (const [path, method] of [['thread', 'GET'], ['notes', 'POST']]) {
      const response = await call(env, path, { token, method, body: method === 'POST' ? { text: 'x' } : undefined });
      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { error: 'unauthorized' });
    }
  }
  for (const token of [null, TESTER, 'z'.repeat(40)]) assert.equal((await call(env, 'staff/notes', { token })).status, 401);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM messages').first()).n, 0);
});

test('secrets: empty and malformed values admit nobody', async () => {
  assert.equal(await sameSecret('', ''), false);
  assert.equal(await sameSecret(undefined, undefined), false);
  assert.equal(await sameSecret(TESTER, TESTER), true);
  assert.deepEqual(readTesters({ TESTERS: 'not json' }), []);
  assert.deepEqual(readTesters({ TESTERS: JSON.stringify([{ id: 't1', token: 'tooshort' }]) }), []);
  const env = fakeEnv();
  env.STAFF_TOKEN = undefined;
  assert.equal((await call(env, 'staff/notes', { token: STAFF })).status, 401);
});

test('a typed note is stored with its game and build, translated, and visible only to its tester', async () => {
  const env = fakeEnv();
  const sent = await (await call(env, 'notes', { method: 'POST', body: { text: ' Fener çok güzel ', game: 'lantern', build: 'ab12cd34ef', client_id: 'client-0001' } })).json();
  assert.deepEqual({ ...sent.message, at: 0 }, { id: 1, dir: 'in', kind: 'text', game: 'lantern', body: 'Fener çok güzel', status: 'ready', at: 0, reply_to: null });
  // The same client id does not store a second note.
  await call(env, 'notes', { method: 'POST', body: { text: 'Fener çok güzel', client_id: 'client-0001' } });
  assert.equal((await (await call(env, 'thread')).json()).messages.length, 1);
  assert.equal((await (await call(env, 'thread', { token: OTHER })).json()).messages.length, 0);
  const staff = await (await call(env, 'staff/notes?unhandled=1', { token: STAFF })).json();
  assert.equal(staff.messages[0].translated, '[English] Fener çok güzel');
  assert.equal(staff.messages[0].build, 'ab12cd34ef');
  assert.equal(staff.messages[0].tester, 't1');
  assert.equal(JSON.stringify(staff).includes(TESTER), false);
});

test('bad input is refused', async () => {
  const env = fakeEnv();
  assert.equal((await call(env, 'notes', { method: 'POST', body: { text: '   ' } })).status, 400);
  assert.equal((await call(env, 'notes', { method: 'POST', body: { text: 'x'.repeat(6001) } })).status, 400);
  assert.equal((await call(env, 'notes', { method: 'POST', body: audio, type: 'video/mp4' })).status, 415);
  assert.equal((await call(env, 'notes', { method: 'POST', body: new Uint8Array(10), type: 'audio/mp4' })).status, 400);
  const odd = await (await call(env, 'notes', { method: 'POST', body: { text: 'ok', game: '../x', build: '<b>' } })).json();
  assert.equal(odd.message.game, null);
});

test('a voice note keeps its audio, then gets a transcript and an English text', async () => {
  const env = fakeEnv();
  const sent = await (await call(env, 'notes?game=ant-promotion&build=0011223344&client_id=client-0002', { method: 'POST', body: audio, type: 'audio/mp4;codecs=mp4a' })).json();
  assert.equal(sent.message.body, 'merhaba oyun güzel');
  assert.equal(sent.message.status, 'ready');
  assert.equal(env.objects.size, 1);
  assert.match([...env.objects.keys()][0], /^private\/feedback\/t1\/\d+-[0-9a-f-]+\.m4a$/);
  const [note] = (await (await call(env, 'staff/notes', { token: STAFF })).json()).messages;
  assert.deepEqual([note.lang, note.translated, note.audio, note.game], ['tr', '[English] merhaba oyun güzel', true, 'ant-promotion']);
  const played = await call(env, 'staff/audio?id=1', { token: STAFF });
  assert.equal(played.headers.get('Content-Type'), 'audio/mp4');
});

test('a failed transcription keeps the note and the audio, and a retry completes it', async () => {
  let broken = true;
  const env = fakeEnv({ ai: (model, input) => { if (broken) throw new Error('model down'); return defaultAi(model, input); } });
  const sent = await (await call(env, 'notes', { method: 'POST', body: audio, type: 'audio/webm' })).json();
  assert.deepEqual([sent.message.status, sent.message.body], ['failed', null]);
  assert.equal(env.objects.size, 1);
  const open = (await (await call(env, 'staff/notes?unhandled=1', { token: STAFF })).json()).messages;
  assert.deepEqual([open[0].status, open[0].error], ['failed', 'model down']);
  broken = false;
  const retried = await (await call(env, 'staff/retry', { token: STAFF, method: 'POST', body: { ids: [1] } })).json();
  assert.deepEqual([retried.messages[0].status, retried.messages[0].body, retried.messages[0].error], ['ready', 'merhaba oyun güzel', null]);
});

test('a reply is translated for the tester, marks notes handled, and records when it was seen', async () => {
  const env = fakeEnv();
  await call(env, 'notes', { method: 'POST', body: { text: 'Not bir' } });
  await call(env, 'notes', { method: 'POST', body: { text: 'Not iki' } });
  const reply = await (await call(env, 'staff/reply', { token: STAFF, method: 'POST', body: { tester: 't1', text: 'Thanks, fixed.', handled: [1] } })).json();
  assert.equal(reply.message.translated, '[Turkish] Thanks, fixed.');
  assert.equal(reply.message.seen_at, null);
  const open = (await (await call(env, 'staff/notes?unhandled=1', { token: STAFF })).json()).messages;
  assert.deepEqual(open.map(m => m.id), [2]);
  const thread = (await (await call(env, 'thread?after=2')).json()).messages;
  assert.deepEqual(thread.map(m => [m.dir, m.body, m.original]), [['out', '[Turkish] Thanks, fixed.', 'Thanks, fixed.']]);
  const all = (await (await call(env, 'staff/notes', { token: STAFF })).json()).messages;
  assert.equal(typeof all[2].seen_at, 'number');
  // A supplied translation is used as written; an unknown tester is refused.
  const own = await (await call(env, 'staff/reply', { token: STAFF, method: 'POST', body: { tester: 't1', text: 'Hi', translated: 'Selam' } })).json();
  assert.equal(own.message.translated, 'Selam');
  assert.equal((await call(env, 'staff/reply', { token: STAFF, method: 'POST', body: { tester: 'nobody', text: 'Hi' } })).status, 400);
  await call(env, 'staff/handled', { token: STAFF, method: 'POST', body: { ids: [2] } });
  assert.equal((await (await call(env, 'staff/notes?unhandled=1', { token: STAFF })).json()).messages.length, 0);
});

test('a reply still goes out when translation fails; delete removes rows and audio', async () => {
  const env = fakeEnv({ ai: () => { throw new Error('model down'); } });
  const reply = await (await call(env, 'staff/reply', { token: STAFF, method: 'POST', body: { tester: 't1', text: 'Hello' } })).json();
  assert.match(reply.warning, /not translated/);
  assert.equal((await (await call(env, 'thread')).json()).messages[0].body, 'Hello');
  await call(env, 'notes', { method: 'POST', body: audio, type: 'audio/mp4' });
  assert.equal(env.objects.size, 1);
  await call(env, 'staff/delete', { token: STAFF, method: 'POST', body: { ids: [1, 2] } });
  assert.equal(env.objects.size, 0);
  assert.equal((await (await call(env, 'staff/notes', { token: STAFF })).json()).messages.length, 0);
});

test('the daily limit stops a flood', async () => {
  const env = fakeEnv();
  const insert = env.DB.prepare("INSERT INTO messages (tester, dir, kind, body, status, created_at) VALUES ('t1', 'in', 'text', 'x', 'ready', ?)");
  for (let i = 0; i < 150; i++) await insert.bind(Date.now()).run();
  assert.equal((await call(env, 'notes', { method: 'POST', body: { text: 'one more' } })).status, 429);
  assert.equal((await call(env, 'notes', { token: OTHER, method: 'POST', body: { text: 'other tester' } })).status, 200);
});

test('a reply link may point at an experiment in the new or the old URL shape, and nowhere else', async () => {
  const env = fakeEnv();
  const links = { '/lantern/': '/lantern/', '/lantern/?night=6': '/lantern/?night=6', '/lab/ant-nest/': '/lab/ant-nest/', '/proto/lantern/': '/proto/lantern/', '/proto/lab/ant-nest/': '/proto/lab/ant-nest/',
    '//evil.example/': null, 'https://evil.example/': null, '/lantern/x.js': null, '/a/b/c/': null, '/../lantern/': null, '/lantern': null };
  for (const link of Object.keys(links)) await call(env, 'staff/reply', { token: STAFF, method: 'POST', body: { tester: 't1', text: 'x', translate: false, link } });
  const thread = await (await call(env, 'thread')).json();
  assert.deepEqual(thread.messages.map(m => m.link), Object.values(links));
});

test('a question carries choices and a link; an answer is tied to it and marks it answered', async () => {
  const env = fakeEnv();
  const asked = await (await call(env, 'staff/reply', { token: STAFF, method: 'POST', body: { tester: 't1', text: 'Is night 6 too hard?', translated: '6. gece çok mu zor?', game: 'lantern', ask: true, choices: ['Kolay', 'Tam kararında', 'Çok zor', ''], link: '/proto/lantern/?night=6' } })).json();
  assert.equal(asked.message.ask, true);
  assert.deepEqual(asked.message.choices, ['Kolay', 'Tam kararında', 'Çok zor']);
  let thread = await (await call(env, 'thread')).json();
  assert.deepEqual({ ...thread.messages[0], at: 0 }, { id: 1, dir: 'out', game: 'lantern', body: '6. gece çok mu zor?', original: 'Is night 6 too hard?', at: 0, link: '/proto/lantern/?night=6', image: false, ask: true, choices: ['Kolay', 'Tam kararında', 'Çok zor'], answered: false, closed: false });
  const answer = await (await call(env, 'notes', { method: 'POST', body: { text: 'Çok zor', reply_to: 1 } })).json();
  assert.equal(answer.message.reply_to, 1);
  assert.equal(answer.message.game, 'lantern');
  thread = await (await call(env, 'thread')).json();
  assert.equal(thread.messages[0].answered, true);
  const staff = await (await call(env, 'staff/notes?unhandled=1', { token: STAFF })).json();
  assert.equal(staff.messages[0].reply_to, 1);
  // Another tester cannot answer it, and a plain reply is not a question.
  const other = await (await call(env, 'notes', { token: OTHER, method: 'POST', body: { text: 'hi', reply_to: 1 } })).json();
  assert.equal(other.message.reply_to, null);
  await call(env, 'staff/reply', { token: STAFF, method: 'POST', body: { tester: 't1', text: 'Thanks', translate: false } });
  const plain = await (await call(env, 'notes', { method: 'POST', body: { text: 'ok', reply_to: 4 } })).json();
  assert.equal(plain.message.reply_to, null);
  await call(env, 'staff/close', { token: STAFF, method: 'POST', body: { ids: [1] } });
  assert.equal((await (await call(env, 'thread')).json()).messages[0].closed, true);
});

test('a reply can skip translation, refuses an outside link, and serves its image only to its tester', async () => {
  const env = fakeEnv();
  const png = Buffer.from(new Uint8Array(120).fill(9)).toString('base64');
  const sent = await (await call(env, 'staff/reply', { token: STAFF, method: 'POST', body: { tester: 't1', text: 'Here is the new boat', translate: false, link: 'https://evil.example/', image: { type: 'image/png', data: png } } })).json();
  assert.equal(sent.message.translated, null);
  assert.equal(sent.message.link, null);
  assert.equal(sent.message.image, true);
  assert.equal(env.calls.length, 0);
  const thread = await (await call(env, 'thread')).json();
  assert.equal(thread.messages[0].body, 'Here is the new boat');
  assert.equal(thread.messages[0].original, null);
  const image = await call(env, 'image?id=1');
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('Content-Type'), 'image/png');
  assert.equal((await call(env, 'image?id=1', { token: OTHER })).status, 404);
  assert.equal((await call(env, 'staff/reply', { token: STAFF, method: 'POST', body: { tester: 't1', text: 'x', image: { type: 'image/svg+xml', data: png } } })).status, 400);
  await call(env, 'staff/delete', { token: STAFF, method: 'POST', body: { ids: [1] } });
  assert.equal(env.objects.size, 0);
});
