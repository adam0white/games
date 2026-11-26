// kit/lab.js input trace and run parts: a 30-minute run arrives whole and in order, and the trace never holds what a
// player typed in a text field. Each property is also run against a broken copy of lab.js (a known bad case) to show
// the check would catch it. Runs lab.js in Node with a minimal page whose events the test dispatches.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { joinRuns } from './lab-join.mjs';

const SOURCE = readFileSync(new URL('../experiments/kit/lab.js', import.meta.url), 'utf8');
const load = (source = SOURCE) => import(`data:text/javascript;base64,${Buffer.from(source + `\n//${Math.random()}`).toString('base64')}`);
const mutate = (from, to) => { assert.ok(SOURCE.includes(from), `mutation target still in lab.js: ${from}`); return SOURCE.replace(from, to); };

let clock = 1_800_000_000_000;
const realNow = Date.now;
Date.now = () => clock;

function page() {
  const store = (m = new Map()) => ({ getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) });
  const on = {}, docOn = {}, fields = [];
  const el = (tagName = 'DIV', props = {}) => {
    const e = { tagName, nodeType: 1, style: {}, children: [], attrs: {}, isConnected: true, textContent: '', listeners: {}, parent: null, ...props,
      append(...c) { for (const x of c) { if (x && typeof x === 'object') x.parent = e; e.children.push(x); } }, remove() { e.removed = true; },
      setAttribute(k, v) { e.attrs[k] = v; }, getAttribute(k) { return e.attrs[k] ?? null; },
      addEventListener(t, f) { e.listeners[t] = f; }, querySelector: () => null,
      closest(sel) { return (e.tagName === 'BUTTON' && sel.includes('button')) ? e : e.parent?.closest?.(sel) ?? null; } };
    if (['INPUT', 'TEXTAREA'].includes(tagName) || props.isContentEditable) fields.push(e);
    return e;
  };
  const body = el('BODY');
  const document = { createElement: t => el(String(t).toUpperCase()), body, documentElement: el('HTML'), visibilityState: 'visible', activeElement: body,
    addEventListener(t, f) { (docOn[t] ??= []).push(f); }, querySelectorAll: () => fields };
  const globals = {
    localStorage: store(), sessionStorage: store(),
    location: { hostname: 'play.adamwhite.work', search: '' },
    navigator: { doNotTrack: null, globalPrivacyControl: false, maxTouchPoints: 5 },
    document, innerWidth: 400, innerHeight: 800, devicePixelRatio: 3, matchMedia: q => ({ matches: q.includes('coarse') }),
    addEventListener(t, f) { (on[t] ??= []).push(f); },
  };
  for (const [k, value] of Object.entries(globals)) Object.defineProperty(globalThis, k, { value, configurable: true, writable: true });
  const fire = (type, e = {}) => { for (const f of on[type] ?? []) f({ isPrimary: true, pointerId: 1, pointerType: 'touch', target: body, ...e }); };
  const fireDoc = type => { for (const f of docOn[type] ?? []) f({}); };
  return { body, el, fire, fireDoc, document };
}

async function lab(source) {
  const seen = [], bodies = [];
  const fetch = async (_url, init) => {
    bodies.push(init.body.byteLength);
    seen.push(JSON.parse(gunzipSync(Buffer.from(init.body)).toString()));
    return { status: 200, json: async () => null };
  };
  const mod = await load(source);
  return { mod, seen, bodies, fetch };
}
const settle = async (ready = () => true) => { for (let t = 0; t < 20000; t += 20) { await new Promise(d => setTimeout(d, 20)); if (ready()) { await new Promise(d => setTimeout(d, 50)); return; } } };

// Plays 30 minutes: a finger dragging the whole time (20 Hz is sampled), a game event every second, a tap on a button
// every 10 s, the page hidden and shown at minute 12. Returns what reached the lab.
async function thirtyMinutes(source) {
  const p = page();
  const { mod, seen, bodies, fetch } = await lab(source);
  const rec = mod.lab('lantern', { fetch });
  rec.notice(p.el('DIV'));
  const retry = p.el('BUTTON', { textContent: 'Play again' }); retry.attrs['aria-label'] = 'Play again';
  p.fire('click', { target: retry }); // before the run: goes with the run, before its start
  rec.start({ night: 1 });
  p.fire('pointerdown', { clientX: 200, clientY: 400 });
  const MS = 30 * 60 * 1000;
  let events = 0, taps = 0;
  for (let t = 0; t <= MS; t += 25) {
    clock += 25;
    p.fire('pointermove', { clientX: 200 + 100 * Math.sin(t / 3000), clientY: 400 + 200 * Math.cos(t / 5000) });
    if (t % 1000 === 0) { rec.event('tick', { s: t / 1000 }); events++; }
    if (t % 10000 === 0) { p.fire('click', { target: retry }); taps++; }
    if (t === 12 * 60 * 1000) { p.document.visibilityState = 'hidden'; p.fireDoc('visibilitychange'); p.document.visibilityState = 'visible'; p.fireDoc('visibilitychange'); }
  }
  p.fire('pointerup', { clientX: 200, clientY: 400 });
  rec.end('dawn', { embers: 7 });
  await settle(() => seen.some(r => r.kind === 'events') && seen.some(r => r.data?.final));
  return { seen, bodies, events, taps, moves: MS / 50 };
}

// Whole and in order: every part from 0 to parts - 1 arrived once, in that order, each within the lab's limits, and
// joined they hold every game event, every sampled move and every tap, with times that never go back.
function assertWhole({ seen, bodies, events, taps, moves }) {
  const parts = seen.filter(r => r.kind === 'run');
  assert.ok(parts.length > 5, `a 30-minute run is sent in several parts, got ${parts.length}`);
  assert.deepEqual(parts.map(r => r.data.part), parts.map((_, i) => i), 'parts arrive numbered 0, 1, 2 ... in order');
  assert.ok(parts.every(r => r.runId === parts[0].runId), 'one runId');
  assert.equal(parts.filter(r => r.data.final).length, 1); assert.equal(parts.at(-1).data.parts, parts.length);
  assert.ok(parts.slice(0, -1).every(r => r.data.outcome === null), 'only the last part has the outcome');
  assert.ok(bodies.every(b => b < 250 * 1024), 'every post is under 250 KB gzip');
  assert.ok(parts.every(r => JSON.stringify(r).length < 512 * 1024), 'every record is under 512 KB of JSON');
  const [run] = joinRuns(seen);
  assert.equal(run.data.joined.complete, true);
  assert.equal(run.data.events.length, events, 'every game event');
  assert.deepEqual(run.data.events.map(e => e.data.s), run.data.events.map((_, i) => i), 'game events in order');
  const tr = run.data.trace;
  assert.equal(tr.filter(x => x[1] === 'm').length, moves, 'every sampled move');
  assert.equal(tr.filter(x => x[1] === 'b').length, taps + 1, 'every tap, and the one before the run');
  assert.ok(tr[0][0] <= 0 && tr[0][1] === 'b', 'input made before the run comes first, before its start');
  assert.ok(tr.every((x, i) => i === 0 || x[0] >= tr[i - 1][0]), 'trace times never go back');
  assert.ok(['hide', 'show', 'd', 'u'].every(k => tr.some(x => x[1] === k)), 'hide, show, down and up are in the trace');
  assert.equal(run.data.outcome, 'dawn'); assert.equal(run.data.summary.embers, 7);
  assert.equal(seen.filter(r => r.kind === 'events').length, 1, 'one events record for the dashboard');
}

test('a 30-minute run arrives whole and in order, in parts', async () => {
  assertWhole(await thirtyMinutes());
});

test('known bad case: a lab.js that skips a part number fails the whole-and-in-order check', async () => {
  const broken = mutate('run.part++;', 'run.part += run.part === 2 ? 2 : 1;');
  await assert.rejects(async () => assertWhole(await thirtyMinutes(broken)), /in order|complete/);
});

test('known bad case: the old one-record run (at most 300 events) fails it too', async () => {
  const broken = mutate('if (waiting > PART_BYTES && !run.capped) part(false);', 'if (run.events.length > 300) run.events.length = 300;');
  await assert.rejects(async () => assertWhole(await thirtyMinutes(broken)));
});

// A page put away mid-run: its part is queued, not posted (a post made as the page unloads is cancelled), and is posted
// when the page is shown again.
async function hideAndShow(source) {
  const p = page();
  const { mod, seen, fetch } = await lab(source);
  const rec = mod.lab('lantern', { fetch });
  rec.notice(p.el('DIV'));
  rec.start({ night: 1 });
  for (let i = 0; i < 20; i++) { clock += 60; p.fire('pointermove', { clientX: 100 + i, clientY: 300 }); }
  p.document.visibilityState = 'hidden'; p.fireDoc('visibilitychange');
  await settle(() => true);
  const queued = JSON.parse(globalThis.localStorage.getItem('hf-lab-kit-queue') ?? '[]');
  const whileHidden = seen.length;
  p.document.visibilityState = 'visible'; p.fireDoc('visibilitychange');
  await settle(() => seen.length > whileHidden);
  return { queued, whileHidden, seen };
}

test('a part made as the page is hidden is queued, and posted only when the page is back', async () => {
  const { queued, whileHidden, seen } = await hideAndShow();
  assert.equal(whileHidden, 0, 'nothing is posted while the page is going away');
  assert.equal(queued.length, 1, 'the part is in the queue'); assert.equal(queued[0].r.data.part, 0);
  assert.deepEqual(seen.map(r => [r.kind, r.data.part]), [['run', 0]], 'posted once the page is shown');
  assert.equal(globalThis.localStorage.getItem('hf-lab-kit-queue'), null, 'and taken off the queue');
});

// The run ends while the page is hidden: its last part waits behind the held one, so the parts arrive 0 then 1.
async function endWhileHidden(source) {
  const p = page();
  const { mod, seen, fetch } = await lab(source);
  const rec = mod.lab('lantern', { fetch });
  rec.notice(p.el('DIV'));
  rec.start({ night: 1 });
  clock += 60; p.fire('pointermove', { clientX: 100, clientY: 300 });
  p.document.visibilityState = 'hidden'; p.fireDoc('visibilitychange');
  rec.end('bank', {});
  await settle(() => true);
  const whileHidden = seen.filter(r => r.kind === 'run').length;
  p.document.visibilityState = 'visible'; p.fireDoc('visibilitychange');
  await settle(() => seen.filter(r => r.kind === 'run').length >= 2);
  return { whileHidden, order: seen.filter(r => r.kind === 'run').map(r => r.data.part) };
}

test('a run that ends while the page is hidden still sends its parts in order', async () => {
  const { whileHidden, order } = await endWhileHidden();
  assert.equal(whileHidden, 0, 'no part is posted while the page is hidden');
  assert.deepEqual(order, [0, 1], 'parts in order');
});

test('known bad case: a lab.js that lets the last part pass the held one fails it', async () => {
  const broken = mutate(' || (!again && held.some(h => h.kind === r.kind && h.runId === r.runId))', '');
  await assert.rejects(async () => { const { order } = await endWhileHidden(broken); assert.deepEqual(order, [0, 1], 'parts in order'); }, /in order/);
});

test('known bad case: a lab.js that posts the part as the page is hidden fails it', async () => {
  const broken = mutate('if (holding || (!again && held.some(h => h.kind === r.kind && h.runId === r.runId))) { held.push(r); return Promise.resolve(); }', '');
  await assert.rejects(async () => { const { queued, whileHidden, seen } = await hideAndShow(broken); assert.equal(whileHidden, 0, 'nothing is posted while the page is going away'); }, /going away/);
});

// A game that keeps its own records within MAX_EVENTS and MAX_BYTES (Cinderhill's replay record, labrec.js) gets its
// events whole in the run's last record, and that is the only record of the run naming its start; the trace goes in parts.
async function withinLimits(source) {
  const p = page();
  const { mod, seen, fetch } = await lab(source);
  const rec = mod.lab('cinderhill', { fetch });
  rec.notice(p.el('DIV'));
  rec.start({ format: 'cinderhill-replay/1', chain: 'c1', part: 1 });
  for (let t = 0, n = 0; t < 10 * 60 * 1000; t += 25) {
    clock += 25; p.fire('pointermove', { clientX: 200 + (t % 97), clientY: 400 });
    if (t % 2400 === 0 && n < 250) rec.event('log', { e: [['o', n, 'x'.repeat(200)]] }), n++;
  }
  rec.end('continued', { tick: 1 });
  await settle(() => seen.some(r => r.kind === 'events') && seen.some(r => r.data?.final));
  return seen.filter(r => r.kind === 'run');
}

test('a run within the event limits keeps its events whole in its last record, the only one naming its start', async () => {
  const runs = await withinLimits();
  assert.ok(runs.length > 1, `the trace went in parts: ${runs.length}`);
  const withStart = runs.filter(r => r.data.start?.format === 'cinderhill-replay/1');
  assert.equal(withStart.length, 1, 'one record of the run names its start');
  assert.equal(withStart[0].data.final, true); assert.equal(withStart[0].data.events.length, 250, 'every event in it');
  assert.ok(runs.filter(r => !r.data.final).every(r => r.data.events.length === 0), 'the other parts carry only trace');
  assert.equal(joinRuns(runs)[0].data.start.chain, 'c1', 'joined, the run has its start');
});

test('known bad case: a lab.js that names the start in every part fails it', async () => {
  const broken = mutate('start: final ? run.info : null', 'start: run.info');
  await assert.rejects(async () => { const runs = await withinLimits(broken); assert.equal(runs.filter(r => r.data.start?.format === 'cinderhill-replay/1').length, 1, 'one record of the run names its start'); }, /names its start/);
});

// Typing in a name field, a text area and an editable line, then tapping a button whose words repeat the name.
async function typing(source) {
  const p = page();
  const { mod, seen, fetch } = await lab(source);
  const rec = mod.lab('pitch', { fetch });
  rec.notice(p.el('DIV'));
  rec.start({});
  const name = p.el('INPUT', { type: 'text', value: '' }), area = p.el('TEXTAREA', { value: '' }), line = p.el('DIV', { isContentEditable: true });
  const secret = 'Zelda Quokka';
  for (const field of [name, area, line]) {
    p.document.activeElement = field;
    for (const ch of secret) {
      const code = ch === ' ' ? 'Space' : `Key${ch.toUpperCase()}`;
      p.fire('keydown', { target: field, key: ch, code }); p.fire('keyup', { target: field, key: ch, code });
      if (field === line) field.textContent += ch; else field.value += ch;
    }
  }
  p.document.activeElement = p.body;
  const go = p.el('BUTTON', { id: 'join', textContent: `Join ${secret}` });
  p.fire('click', { target: go });
  p.fire('keydown', { target: p.body, key: 'ArrowLeft', code: 'ArrowLeft' });
  p.fire('error', { message: 'boom at https://play.adamwhite.work/pitch/?room=QWER7', error: { stack: 'Error: boom\n at f (https://play.adamwhite.work/pitch/main.js?room=QWER7:3:9)' } });
  rec.end('quit', {});
  await settle(() => seen.some(r => r.kind === 'events'));
  return { seen, secret };
}

function assertNoText({ seen, secret }) {
  const text = JSON.stringify(seen);
  const [run] = joinRuns(seen), tr = run.data.trace;
  assert.equal(tr.filter(x => x[1] === 'kf').length, secret.length * 3, 'each key in a field is recorded only as a key press');
  assert.equal(tr.filter(x => x[1] === 'k' || x[1] === 'K').map(x => x[2]).join(), 'ArrowLeft', 'keys outside fields by their code; none from the fields');
  for (const part of [secret, ...secret.split(' '), 'KeyZ', 'KeyQ', 'Zelda', 'QWER7', 'room=', 'play.adamwhite.work']) assert.ok(!text.includes(part), `"${part}" is not sent`);
  const tap = tr.find(x => x[1] === 'b');
  assert.deepEqual(tap.slice(2), ['Join …', 'join'], 'the button by its words, with the typed name cut out, and its id');
  const err = tr.find(x => x[1] === 'err');
  assert.equal(err[3], 'boom at /pitch/'); assert.match(err[4], /\/pitch\/main\.js/);
}

test('the input trace never contains what was typed in a text field', async () => {
  assertNoText(await typing());
});

test('known bad case: a lab.js that records key codes inside fields fails the no-text check', async () => {
  const broken = mutate("if (isField(e.target) || isField(document.activeElement)) return put('kf');", '');
  await assert.rejects(async () => assertNoText(await typing(broken)), /key|not sent/);
});

test('nothing is traced before the notice or while recording is off, and switching off forgets the buffers', async () => {
  const p = page();
  const { mod, seen, fetch } = await lab();
  const rec = mod.lab('lantern', { fetch });
  p.fire('pointerdown', { clientX: 1, clientY: 1 }); // no listeners yet
  rec.notice(p.el('DIV'));
  const pause = p.el('DIV'); rec.toggle(pause);
  rec.start({});
  p.fire('pointerdown', { clientX: 10, clientY: 10 });
  const input = pause.children[0].children[0];
  input.checked = false; input.listeners.change();
  p.fire('pointerdown', { clientX: 20, clientY: 20 });
  input.checked = true; input.listeners.change();
  p.fire('pointerdown', { clientX: 40, clientY: 40 });
  rec.end('dawn', {});
  await settle(() => seen.some(r => r.kind === 'events'));
  const [run] = joinRuns(seen);
  assert.deepEqual(run.data.trace.filter(x => x[1] === 'd').map(x => x[2]), [100], 'only the press made after recording came back on');
  assert.equal(run.data.env.device, 'phone');
});

test.after(() => { Date.now = realNow; });
