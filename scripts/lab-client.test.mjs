// kit/lab.js when the lab refuses or cannot be reached: the page says so, the record is kept in a bounded queue and
// sent again later, and switching recording off empties the queue. Runs lab.js in Node with a minimal page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';

function page() {
  const store = (m = new Map()) => ({ getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m });
  const el = () => {
    const e = { style: {}, children: [], attrs: {}, isConnected: true, textContent: '', listeners: {},
      append(...c) { e.children.push(...c); }, remove() { e.removed = true; }, setAttribute(k, v) { e.attrs[k] = v; },
      addEventListener(t, f) { e.listeners[t] = f; }, querySelector: () => null };
    return e;
  };
  const body = el();
  const globals = {
    localStorage: store(), sessionStorage: store(),
    location: { hostname: 'play.adamwhite.work', search: '' },
    navigator: { doNotTrack: null, globalPrivacyControl: false },
    document: { createElement: el, body, documentElement: el(), visibilityState: 'visible' },
    addEventListener() {}, innerWidth: 400,
  };
  // Node has its own navigator and localStorage getters; replace them for this test file only.
  for (const [k, value] of Object.entries(globals)) Object.defineProperty(globalThis, k, { value, configurable: true, writable: true });
  return body;
}
// Sends are asynchronous (gzip, then the fake fetch); wait until the expected state, up to 5 s on a busy machine.
const settle = async (ready = () => true) => { for (let t = 0; t < 5000; t += 10) { await new Promise(done => setTimeout(done, 10)); if (ready()) { await new Promise(done => setTimeout(done, 30)); return; } } };
const warnings = body => body.children.filter(c => c.className === 'lab-warning' && !c.removed).map(c => c.textContent);

async function server(answers) {
  const seen = [];
  const fetch = async (_url, init) => {
    const record = JSON.parse(gunzipSync(Buffer.from(init.body)).toString());
    seen.push(record);
    const [status, error] = answers(record, seen.length);
    if (status === 'throw') throw new TypeError('Failed to fetch');
    return { status, json: async () => (error ? { error } : null) };
  };
  return { seen, fetch };
}

test('a refused record shows its reason, is queued, and is sent again once the lab accepts it', async () => {
  const body = page();
  const { lab, QUEUE_MAX } = await import(`../experiments/kit/lab.js?${Math.random()}`);
  let fixed = false;
  const lab1 = await server(() => (fixed ? [200] : [400, 'bad game']));
  const rec = lab('cinderhill', { fetch: lab1.fetch });
  rec.notice(document.createElement('div'));
  rec.start({ ants: 1 }); rec.end('left', {});
  await settle(() => JSON.parse(localStorage.getItem('hf-lab-kit-queue') ?? '[]').length === 2);
  assert.deepEqual(warnings(body), ['Lab not recording: bad game']);
  const queued = JSON.parse(localStorage.getItem('hf-lab-kit-queue'));
  assert.deepEqual(queued.map(x => x.r.kind).sort(), ['events', 'run']);
  assert.equal(rec.sent, 0);

  // Later the lab knows the slug: the next page sends the queue when its notice is shown.
  fixed = true;
  const rec2 = lab('cinderhill', { fetch: lab1.fetch });
  rec2.notice(document.createElement('div'));
  await settle(() => rec2.sent === 2);
  assert.equal(localStorage.getItem('hf-lab-kit-queue'), null, 'queue emptied');
  assert.equal(rec2.sent, 2);
  const ids = lab1.seen.map(r => r.id);
  assert.deepEqual(new Set(ids.slice(2)), new Set(ids.slice(0, 2)), 'the same records, same ids');
  assert.ok(QUEUE_MAX >= 20);
});

test('a network failure queues too; the queue stays bounded; switching off empties it', async () => {
  const body = page();
  const { lab, QUEUE_MAX } = await import(`../experiments/kit/lab.js?${Math.random()}`);
  const lab1 = await server(() => ['throw']);
  const rec = lab('lantern', { fetch: lab1.fetch });
  rec.notice(document.createElement('div'));
  const pause = document.createElement('div');
  rec.toggle(pause);
  for (let i = 0; i < QUEUE_MAX + 10; i++) rec.event('buy', { i });
  await settle(() => lab1.seen.length === QUEUE_MAX + 10);
  assert.deepEqual(warnings(body), ['Lab not recording: network']);
  assert.equal(JSON.parse(localStorage.getItem('hf-lab-kit-queue')).length, QUEUE_MAX);

  const input = pause.children[0].children[0];
  input.checked = false; input.listeners.change();
  assert.equal(localStorage.getItem('hf-lab-kit-queue'), null);
  assert.deepEqual(warnings(body), []);
});

test('a record the lab drops for a privacy signal is not queued but is shown', async () => {
  const body = page();
  const { lab } = await import(`../experiments/kit/lab.js?${Math.random()}`);
  const lab1 = await server(() => [204]);
  const rec = lab('lantern', { fetch: lab1.fetch });
  rec.notice(document.createElement('div'));
  rec.start({}); rec.end('dawn', {});
  await settle(() => lab1.seen.length === 2);
  assert.deepEqual(warnings(body), ['Lab not recording: privacy-signal']);
  assert.equal(localStorage.getItem('hf-lab-kit-queue'), null);
});

test('a privacy signal without the tick says so instead of recording nothing silently; the tick clears it', async () => {
  const body = page();
  navigator.globalPrivacyControl = true;
  const { lab } = await import(`../experiments/kit/lab.js?${Math.random()}`);
  const lab1 = await server(() => [200]);
  const rec = lab('cinderhill-battle', { fetch: lab1.fetch });
  rec.notice(document.createElement('div'));
  const pause = document.createElement('div');
  rec.toggle(pause);
  rec.start({}); rec.end('quit', {});
  await settle();
  assert.equal(lab1.seen.length, 0, 'nothing sent without the tick');
  assert.deepEqual(warnings(body), ['Lab not recording: privacy-signal (tick the switch to record)']);
  const input = pause.children[0].children[0];
  input.checked = true; input.listeners.change();
  assert.deepEqual(warnings(body), []);
  rec.start({}); rec.end('quit', {});
  await settle(() => rec.sent === 2);
  assert.equal(rec.sent, 2);
  assert.equal(lab1.seen.length, 2, 'each record sent once');
  assert.ok(lab1.seen.every(r => r.privacyOverride === true));
});

test('a record is queued before it is sent, so a page closed before the answer keeps it', async () => {
  page();
  const { lab } = await import(`../experiments/kit/lab.js?${Math.random()}`);
  const rec = lab('lantern', { fetch: () => new Promise(() => {}) });
  rec.notice(document.createElement('div'));
  rec.start({}); rec.end('dawn', {});
  await settle(() => JSON.parse(localStorage.getItem('hf-lab-kit-queue') ?? '[]').length === 2);
  assert.equal(JSON.parse(localStorage.getItem('hf-lab-kit-queue')).length, 2);
});
