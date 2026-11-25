// PLAYWRIGHT=<directory containing playwright> fnm exec --using=26.12.0 node experiments/small/night-saltplate/check.mjs [webkit|chromium]
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { LEVELS, answerHandle, dailySpec } from './sim.js';
import { assertHomeLinks } from '../../kit/check/home-link.mjs';
import { answerLab, withAgent, assertNotice, assertRun, assertOffSendsNothing, assertNoLeak, waitForRuns, runRecords } from '../../kit/check/lab-record.mjs';

const mount = '/small/night-saltplate/';
const experiments = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const notesButton = resolve(experiments, '../workers/feedback/public/notes/button.js');
const shots = process.env.SHOTS || '/private/tmp/night-r6-wild';
const playwrightDir = process.env.PLAYWRIGHT || join(homedir(), 'code/human-framework/node_modules');
const require = createRequire(join(resolve(playwrightDir), 'check.cjs'));
const { chromium, devices, webkit } = require('playwright');
const profiles = [
  { name: 'webkit', engine: webkit, device: 'iPhone 13' },
  { name: 'chromium', engine: chromium, device: 'Pixel 7' },
];
const allowed = path => path === '/notes/button.js' || path === '/favicon.ico'
  || path.startsWith(mount) || path.startsWith('/kit/');
const types = {
  '.css': 'text/css',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

assert.ok(!process.argv[2] || profiles.some(({ name }) => name === process.argv[2]), 'unknown browser');
await mkdir(shots, { recursive: true });

const server = createServer(async (request, response) => {
  try {
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (path === '/favicon.ico') {
      response.writeHead(204).end();
      return;
    }
    const file = path === '/notes/button.js'
      ? notesButton
      : resolve(experiments, `.${path}${path.endsWith('/') ? 'index.html' : ''}`);
    if (!allowed(path) || (!file.startsWith(experiments + sep) && file !== notesButton)) {
      response.writeHead(404).end();
      return;
    }
    const bytes = await readFile(file);
    response.writeHead(200, {
      'content-type': types[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    }).end(bytes);
  } catch {
    if (!response.headersSent) response.writeHead(404);
    response.end('not found');
  }
});
await new Promise((done, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', done);
});
const origin = `http://127.0.0.1:${server.address().port}`;
const url = origin + mount;

const state = page => page.evaluate(() => window.saltplateState?.());
async function waitFor(page, predicate, description, timeout = 6000) {
  const deadline = performance.now() + timeout;
  let current;
  do {
    current = await state(page);
    if (current) assert.ok(Number.isFinite(current.match), `match is finite: ${JSON.stringify(current)}`);
    if (predicate(current)) return current;
    await sleep(40);
  } while (performance.now() < deadline);
  assert.fail(`${description}: ${JSON.stringify(current)}`);
}

// Every visible box in the page is inside the screen and no button's words overflow it; returns the plate width.
async function fits(page, what) {
  const fit = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('#work *')) {
      if (!el.getClientRects().length || getComputedStyle(el).visibility === 'hidden') continue;
      const box = el.getBoundingClientRect();
      if (!box.width || !box.height) continue;
      const name = el.id || el.className || el.tagName;
      if (box.bottom > innerHeight + 0.5 || box.right > innerWidth + 0.5 || box.top < -0.5 || box.left < -0.5) out.push([name, Math.round(box.top), Math.round(box.bottom)]);
      if (el.tagName === 'BUTTON' && el.scrollWidth > el.clientWidth + 1) out.push([name, 'words overflow', el.scrollWidth, el.clientWidth]);
    }
    return { out, wide: document.documentElement.scrollWidth - innerWidth, plate: document.getElementById('plate').getBoundingClientRect().width };
  });
  assert.deepEqual(fit.out, [], `${what}: everything is on the screen`);
  assert.ok(fit.wide <= 0, `${what}: no sideways scroll`);
  return fit.plate;
}

async function checkBounds(page, ids) {
  const viewport = page.viewportSize();
  for (const id of ids) {
    const control = page.locator(`#${id}`);
    assert.ok(await control.isVisible(), `${id} is visible`);
    const { x, y, width, height } = await control.boundingBox();
    assert.ok(width >= 44 && height >= 44, `${id} has a 44 × 44 CSS-pixel target`);
    assert.ok(x >= 0 && y >= 0 && x + width <= viewport.width + 0.5 && y + height <= viewport.height + 0.5,
      `${id} fits in viewport: ${JSON.stringify({ x, y, width, height, viewport })}`);
  }
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal scroll');
}

async function wakeDisplay(page) {
  const viewport = page.viewportSize();
  await page.bringToFront();
  await page.setViewportSize({ ...viewport, width: viewport.width + 1 });
  await sleep(150);
  await page.setViewportSize(viewport);
}

async function readyToPaint(page, name) {
  const frames = () => page.evaluate(() => new Promise(resolve => {
    const limit = setTimeout(() => resolve(false), 2000);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      clearTimeout(limit);
      resolve(true);
    }));
  }));
  if (await frames()) return;
  if (name === 'webkit') {
    for (let attempt = 0; attempt < 3; attempt++) {
      await wakeDisplay(page);
      if (await frames()) return;
    }
  }
  assert.fail('two animation frames arrive');
}

async function screenshot(page, name, stage) {
  await readyToPaint(page, name);
  await page.screenshot({
    path: join(shots, `night-saltplate-${name}-${stage}.png`),
    scale: 'css',
    fullPage: true,
    timeout: 15000,
  });
}

async function attachAudit(context, page) {
  const errors = [];
  const unexpected = [];
  const assets = new Set();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('response', response => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  page.on('websocket', socket => unexpected.push(`WebSocket ${socket.url()}`));
  await context.route('**/*', route => {
    const request = route.request();
    const address = new URL(request.url());
    if (address.origin !== origin || request.method() !== 'GET' || !allowed(address.pathname)) {
      unexpected.push(`${request.method()} ${request.url()}`);
      return route.abort();
    }
    assets.add(address.pathname);
    return route.continue();
  });
  // The lab endpoint is answered here (registered after the catch-all, so it wins): no check reaches the real one.
  const lab = await answerLab(context, origin);
  await context.addInitScript(() => {
    if (location.protocol !== 'http:') return;
    localStorage.setItem('hf-lab-send-localhost', '1');
    const setItem = Storage.prototype.setItem;
    window.saltplateCheck = { writes: [], touches: [] };
    Storage.prototype.setItem = function (key, value) {
      if (/^(hf-lab-|night-saltplate:lab)/.test(key) && !/^hf-lab-(send-localhost|player|session:night-saltplate)$/.test(key)) window.saltplateCheck.writes.push(key);
      return setItem.call(this, key, value);
    };
    document.addEventListener('pointerdown', event => {
      if (event.target.id === 'tuner') {
        window.saltplateCheck.touches.push([event.pointerType, event.isTrusted]);
      }
    }, { capture: true });
  });
  return { errors, unexpected, assets, lab };
}

// The page records play (kit/lab.js), so the lab client's own player id and session keys are expected.
// Changed deliberately on 2026-11-24 from "no hf-lab- keys at all"; any other lab key still fails.
const recordingKey = key => key === 'hf-lab-send-localhost' || key === 'hf-lab-player' || key === 'hf-lab-session:night-saltplate';
async function checkLabStorage(page) {
  const lab = await page.evaluate(() => ({
    writes: window.saltplateCheck.writes,
    keys: [...Object.keys(localStorage), ...Object.keys(sessionStorage)]
      .filter(key => /^(hf-lab-|night-saltplate:lab)/.test(key)),
  }));
  lab.keys = lab.keys.filter(key => !recordingKey(key));
  assert.deepEqual(lab, { writes: [], keys: [] }, 'no lab storage writes or keys besides the recording ids');
}

// A played plate sends one run record under the page's name; with the switch off nothing is sent.
async function recording({ name, engine, device }) {
  const browser = await engine.launch({ headless: true, timeout: 30000 });
  try {
    const context = await browser.newContext({ ...devices[device], serviceWorkers: 'block' });
    const page = await context.newPage();
    page.setDefaultTimeout(6000);
    const { errors, unexpected, lab } = await attachAudit(context, page);
    await page.goto(withAgent(url));
    await waitFor(page, s => s?.screen === 'play', 'opening plate');
    await assertNotice(page);
    assert.equal(lab.sent.length, 0, 'nothing is sent before the plate is touched');
    await clear(page, 1);
    await waitForRuns(lab, 'night-saltplate', 1);
    const won = assertRun(lab, 'night-saltplate', { outcomes: ['won'], summaryKeys: ['level', 'match', 'cleared'] });
    assert.equal(won.data.summary.level, 1);
    assert.ok(won.data.events.some(e => e.type === 'plate-printed'), 'the printed plate is an event');
    assertNoLeak(lab, ['hf-lab']);
    await page.tap('#replay');
    await waitFor(page, s => s?.screen === 'play' && s.level === 1, 'replay opens the first plate');
    await page.tap('#pause');
    await waitFor(page, s => s?.screen === 'paused', 'paused');
    await assertOffSendsNothing(page, lab, 'night-saltplate', { play: async () => {
      await page.tap('#resume');
      await waitFor(page, s => s?.screen === 'play', 'resumed');
      await clear(page, 1);
    } });
    assert.deepEqual(unexpected, [], 'no external requests');
    assert.deepEqual(errors, [], 'no browser errors');
  } finally {
    await browser.close();
  }
}

async function tunerPoint(page, fraction) {
  const box = await page.locator('#tuner').boundingBox();
  const thumb = 32;
  return { x: box.x + thumb / 2 + fraction * (box.width - thumb), y: box.y + box.height / 2 };
}

async function tapTuner(page, { marker, fraction }) {
  const point = await tunerPoint(page, fraction);
  if (marker) {
    const notch = page.locator('#notch');
    assert.ok(await notch.isVisible(), 'the opening resonance mark is visible');
    const visible = await notch.boundingBox();
    assert.ok(visible?.width && visible?.height, 'first visible notch has a position');
    point.x = visible.x + visible.width / 2;
  }
  const touchesBefore = await page.evaluate(() => window.saltplateCheck.touches.length);
  await page.touchscreen.tap(point.x, point.y);
  const touches = await page.evaluate(previous => window.saltplateCheck.touches.slice(previous), touchesBefore);
  assert.deepEqual(touches, [['touch', true]], 'one trusted touch reaches the range');
}

// Where a point of the plate (0..1 across the engraved square) is on the screen.
async function platePoint(page, [x, y]) {
  const box = await page.locator('#plate').boundingBox();
  return { x: box.x + (29 + 342 * x) / 400 * box.width, y: box.y + (29 + 342 * y) / 400 * box.height };
}

async function clear(page, level, marker = false) {
  const start = performance.now();
  const spec = LEVELS[level - 1];
  // Plates 10, 11, 13 and 18: put the bow or the finger where the plate needs it, with one touch.
  if (spec.handle) {
    const point = await platePoint(page, answerHandle(spec));
    await page.touchscreen.tap(point.x, point.y);
    const placed = await state(page);
    assert.ok(placed.handle && Math.hypot(placed.handle[0] - answerHandle(spec)[0], placed.handle[1] - answerHandle(spec)[1]) < 0.01,
      `plate ${level}: one touch puts the ${spec.handle === 'bow' ? 'bow' : 'finger'} there: ${JSON.stringify(placed.handle)}`);
  }
  // The stiff plate: touch a little below the pitch, then slide up with the arrow keys.
  await tapTuner(page, { marker, fraction: spec.stiff ? spec.target - 0.1 : spec.target });
  if (spec.stiff) {
    await waitFor(page, s => s?.active, `plate ${level} responds to one touch`);
    for (let step = 0; step < 10; step++) { await page.keyboard.press('ArrowRight'); await sleep(40); }
  }
  const tuned = await waitFor(page, s => s?.active && (!spec.stiff || Math.abs(s.drive - spec.target) < 0.015), `plate ${level} responds to one touch`);
  assert.ok(Math.abs(tuned.drive - LEVELS[level - 1].target) < 0.015,
    `plate ${level} tunes to its expected resonance: ${tuned.drive}`);
  const released = await waitFor(page, s => s?.t > tuned.t, `plate ${level} vibrates after release`);
  assert.equal(released.drive, tuned.drive, 'drive stays tuned after release');
  const result = await waitFor(page, s => s?.screen === 'result', `plate ${level} clears from one touch`, marker ? 59000 : 15000);
  const wallSeconds = (performance.now() - start) / 1000;
  assert.ok(result.won, `plate ${level} reports a win`);
  assert.ok(result.cleared >= level, `plate ${level} is saved as cleared`);
  if (marker) assert.ok(wallSeconds < 60, 'first visible notch leads to a clear in under 60 wall seconds');
  assert.ok(await page.locator('#result.on').isVisible(), 'kit result is visible');
  assert.ok(await page.locator('#plate').isVisible(), 'plate remains visible on the result');
  const plate = await page.locator('#plate').boundingBox();
  const panel = await page.locator('#result').boundingBox();
  assert.ok(panel.y >= plate.y + plate.height - 1, 'result panel sits below the plate');
  return { level, drive: tuned.drive, matched: result.match, simulationSeconds: result.t, wallSeconds };
}

async function sweepAndHold(page, context, name) {
  const target = LEVELS[0].target;
  const start = await tunerPoint(page, 0);
  const halfway = await tunerPoint(page, target / 2);
  const finish = await tunerPoint(page, target);
  const cdp = name === 'chromium' ? await context.newCDPSession(page) : null;
  const touch = (type, point) => cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: point ? [{ ...point, id: 1 }] : [],
  });
  const move = point => cdp ? touch('touchMove', point) : page.mouse.move(point.x, point.y, { steps: 8 });
  const touchesBefore = await page.evaluate(() => window.saltplateCheck.touches.length);
  if (cdp) {
    await touch('touchStart', start);
  } else {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
  }
  let held;
  try {
    await move(halfway);
    const middle = await waitFor(page, s => s?.active && Math.abs(s.drive - target / 2) < 0.02, 'held slider sweeps through an intermediate pitch');
    assert.ok(!middle.won, 'the intermediate pitch does not finish the plate');
    await move(finish);
    held = await waitFor(page, s => s?.screen === 'result', 'plate clears with the slider still held', 15000);
    assert.ok(held.won && Math.abs(held.drive - target) < 0.015, 'the held slider clears at the resonance');
  } finally {
    if (cdp) {
      await touch('touchEnd');
      await cdp.detach();
    } else {
      await page.mouse.up();
    }
  }
  const touches = await page.evaluate(previous => window.saltplateCheck.touches.slice(previous), touchesBefore);
  const pointerType = cdp ? 'touch' : 'mouse';
  assert.deepEqual(touches, [[pointerType, true]], 'sweep uses one trusted pointer press');
  assert.deepEqual(await state(page), held, 'releasing after the result preserves it');
  assert.ok(await page.locator('#result.on').isVisible(), 'result remains visible after releasing');
  return { pointerType, drive: held.drive, simulationSeconds: held.t };
}

async function checkActiveControls(page, name) {
  const idle = await state(page);
  const target = LEVELS[idle.level - 1].target;
  await tapTuner(page, { fraction: target >= 0.5 ? 0.1 : 0.9 });
  const active = await waitFor(page, s => s?.active && s.t >= 0.5, 'off-target touch vibrates for half a game second');
  assert.ok(!active.won && active.progress === 0, 'off-target vibration does not clear');
  await page.tap('#pause');
  const paused = await waitFor(page, s => s?.screen === 'paused', 'pause during vibration');
  assert.ok(await page.locator('#paused.on').isVisible(), 'kit pause is visible');
  await sleep(500);
  assert.deepEqual(await state(page), paused, 'pause freezes game state');
  await checkBounds(page, ['resume', 'sound', 'look', 'restart']);
  await screenshot(page, name, '04-paused');
  await page.tap('#sound');
  await page.tap('#look');
  const settings = await state(page);
  assert.equal(settings.sound, !paused.sound, 'sound toggles');
  assert.equal(settings.look, paused.look === 'blue' ? 'oxide' : 'blue', 'look toggles');
  await page.tap('#resume');
  const resumed = await waitFor(page, s => s?.screen === 'play' && s.active && s.t > paused.t, 'resumed plate vibrates');
  assert.equal(resumed.drive, paused.drive, 'resume preserves the tuning');
  await page.tap('#pause');
  await page.tap('#restart');
  const restarted = await waitFor(page, s => s?.screen === 'play' && !s.active, 'restart returns to an untouched plate');
  assert.deepEqual(restarted, { ...idle, look: settings.look, sound: settings.sound }, 'restart preserves preferences and resets play');
  await screenshot(page, name, '05-alternate-look');
  return { pausedTime: paused.t, resumedTime: resumed.t, look: settings.look, sound: settings.sound };
}

async function run({ name, engine, device }) {
  const browser = await engine.launch({ headless: true, timeout: 30000 });
  try {
    const context = await browser.newContext({ ...devices[device], serviceWorkers: 'block' });
    const page = await context.newPage();
    page.setDefaultTimeout(6000);
    page.setDefaultNavigationTimeout(15000);
    const { errors, unexpected, assets, lab } = await attachAudit(context, page);
    if (name === 'webkit') await wakeDisplay(page);
    await page.goto(withAgent(url));
    await readyToPaint(page, name);
    const opening = await waitFor(page, s => s?.screen === 'play', 'opening plate');
    assert.equal(opening.level, 1);
    assert.equal(opening.cleared, 0);
    assert.equal(opening.active, false);
    assert.equal(opening.t, 0);
    assert.equal(opening.progress, 0);
    assert.equal(opening.won, false);
    assert.ok(await page.locator('#work').isVisible());
    assert.ok((await page.locator('#level-name').textContent()).trim());
    assert.deepEqual(await page.locator('#tuner').evaluate(control => [control.type, control.min, control.max, control.step]),
      ['range', '0', '1000', '1']);
    const plate = await page.locator('#plate').boundingBox();
    assert.ok(Math.abs(plate.width - plate.height) < 1, 'plate has a square display area');
    await sleep(650);
    assert.deepEqual(await state(page), opening, 'untouched plate stays idle');
    await checkBounds(page, ['tuner', 'pause']);
    await screenshot(page, name, '01-idle');

    const portrait = page.viewportSize();
    await page.setViewportSize({ width: portrait.height, height: portrait.width });
    await checkBounds(page, ['tuner', 'pause']);
    await screenshot(page, name, '02-landscape');
    await page.setViewportSize(portrait);
    await readyToPaint(page, name);
    const levels = [await clear(page, 1, true)];
    await screenshot(page, name, '03-first-result');
    await page.tap('#replay');
    const replay = await waitFor(page, s => s?.screen === 'play' && s.level === 1, 'replay opens the first plate');
    assert.ok(!replay.active && !replay.won && replay.cleared === 1, 'replay resets play and preserves the clear');
    const sweep = await sweepAndHold(page, context, name);
    await page.tap('#next');
    await waitFor(page, s => s?.screen === 'play' && s.level === 2, 'next opens plate 2 after the first clear');
    await checkLabStorage(page);
    await page.reload();
    await waitFor(page, s => s?.screen === 'play' && s.level === 2 && s.cleared === 1, 'reload opens the next uncleared plate');
    await readyToPaint(page, name);
    const controls = await checkActiveControls(page, name);

    for (let level = 2; level <= LEVELS.length; level++) {
      const current = await waitFor(page, s => s?.screen === 'play' && s.level === level, `plate ${level} opens`);
      assert.ok(!current.active && !current.won && current.t === 0, `plate ${level} opens untouched`);
      levels.push(await clear(page, level));
      if (level === LEVELS.length) await screenshot(page, name, '06-last-result');
      await page.tap('#next');
    }
    const wrapped = await waitFor(page, s => s?.screen === 'play' && s.level === 1, 'next wraps after the last plate');
    assert.equal(wrapped.cleared, LEVELS.length, 'wrapping preserves all completed plates');
    await checkLabStorage(page);
    await page.reload();
    const stored = await waitFor(page, s => s?.screen === 'play' && s.level === 1, 'completed save reopens plate 1');
    assert.equal(stored.cleared, LEVELS.length, 'all clears survive reload');
    assert.equal(stored.look, controls.look, 'look survives reload');
    assert.equal(stored.sound, controls.sound, 'sound survives reload');
    assert.ok(assets.has('/notes/button.js'), 'the real notes button script loaded');
    assert.deepEqual(unexpected, [], 'no external or telemetry requests');
    assert.deepEqual(errors, [], 'no browser errors');
    assert.ok(lab.sent.length > 0 && lab.sent.every(r => r.game === 'night-saltplate' && r.runSource === 'agent'), 'tried ' + lab.tried + ' every record is named: ' + JSON.stringify(lab.sent.map(r => [r.game, r.kind, r.runSource])));
    console.log(JSON.stringify({
      browser: name, device, levels, sweep, controls, savedClears: stored.cleared,
      browserErrors: errors.length, externalOrTelemetryRequests: unexpected.length, labWrites: 0,
    }));
  } finally {
    await browser.close();
  }
}

// The additions of 2026-11-24: an old save opens the new plates, the daily figure, the instrument,
// pictures, the plate list, Turkish, the layout on short phones, and the page's work per frame.
async function extras({ name, engine, device }) {
  const browser = await engine.launch({ headless: true, timeout: 30000 });
  try {
    const context = await browser.newContext({ ...devices[device], serviceWorkers: 'block' });
    await context.addInitScript(() => {
      window.saltplateShared = [];
      navigator.canShare = () => true;
      navigator.share = async data => { window.saltplateShared.push({ files: data.files?.map(file => [file.type, file.size]), text: data.text }); };
    });
    const page = await context.newPage();
    page.setDefaultTimeout(6000);
    const { errors, unexpected, lab } = await attachAudit(context, page);
    if (name === 'webkit') await wakeDisplay(page);
    const day = '2026-11-24';
    const at = query => withAgent(url) + '&hint=0&date=' + day + query;

    // A save from before the twelve new plates (six cleared) opens plate 7, and keeps its format.
    await page.goto(at(''));
    await page.evaluate(() => localStorage.setItem('night-saltplate:save', JSON.stringify({ v: 1, cleared: 6, look: 'oxide', sound: false })));
    await page.reload();
    const seventh = await waitFor(page, s => s?.screen === 'play', 'old save opens');
    assert.deepEqual([seventh.level, seventh.cleared, seventh.look, seventh.sound], [7, 6, 'oxide', false], 'a six-plate save opens plate 7 with its settings');
    await readyToPaint(page, name);
    await checkBounds(page, ['tuner', 'pause', 'daily', 'free']);
    await screenshot(page, name, '07-old-save-plate-7');
    await clear(page, 7);
    assert.deepEqual(JSON.parse(await page.evaluate(() => localStorage.getItem('night-saltplate:save'))), { v: 1, cleared: 7, look: 'oxide', sound: false },
      'the save keeps its first format');

    // The daily figure: the same for everyone on the day, timed, best kept under its own key, shared as a picture.
    await page.tap('#daily');
    const daily = dailySpec(day);
    const opened = await waitFor(page, s => s?.screen === 'play' && s.mode === 'daily', 'the daily figure opens');
    assert.ok(!opened.active && opened.t === 0, 'the daily figure opens untouched');
    assert.match(await page.locator('#number').textContent(), new RegExp(day), 'the daily caption names the day');
    await tapTuner(page, { fraction: daily.target });
    const printed = await waitFor(page, s => s?.screen === 'result' && s.won, 'the daily figure prints', 15000);
    const record = JSON.parse(await page.evaluate(() => localStorage.getItem('night-saltplate:daily')));
    assert.deepEqual([record.v, record.day, record.tries], [1, day, 1], 'the daily record is kept under its own key');
    assert.ok(Math.abs(record.best - printed.t) < 0.11, `the best time is the print time: ${record.best} ${printed.t}`);
    assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem('night-saltplate:save'))).cleared, 7, 'the daily figure leaves the plate save alone');
    await screenshot(page, name, '08-daily-result');
    await page.tap('#share');
    await page.waitForFunction(() => window.saltplateShared.length === 1);
    const [shared] = await page.evaluate(() => window.saltplateShared);
    assert.ok(shared.files.length === 1 && shared.files[0][0] === 'image/png' && shared.files[0][1] > 20000, 'one PNG picture is shared');
    assert.match(shared.text, new RegExp(`${day}.* in ${printed.t.toFixed(1)} s`), 'the shared words carry the day and the time');
    await waitForRuns(lab, 'night-saltplate', 2);
    const dailyRun = assertRun(lab, 'night-saltplate', { outcomes: ['won'], count: 2, summaryKeys: ['mode', 'day'] });
    assert.equal(dailyRun.data.summary.mode, 'daily', 'the daily run is recorded as daily');
    assert.ok(dailyRun.data.events.some(event => event.type === 'daily-printed'), 'the daily print is an event');

    // The instrument: any shape, any pitch, the bow where the finger is; it never ends.
    await page.tap('#free');
    await waitFor(page, s => s?.screen === 'play' && s.mode === 'free', 'the instrument opens');
    const bow = await platePoint(page, [0.3, 0.3]);
    await page.touchscreen.tap(bow.x, bow.y);
    const bowed = await waitFor(page, s => s?.active && s.handle, 'a touch on the plate bows it');
    assert.ok(Math.abs(bowed.handle[0] - 0.3) < 0.01 && Math.abs(bowed.handle[1] - 0.3) < 0.01, 'the bow is where the touch was');
    await tapTuner(page, { fraction: 0.62 });
    await sleep(1200);
    const ringing = await state(page);
    assert.ok(ringing.active && !ringing.won && ringing.screen === 'play', 'the instrument rings on');
    await page.tap('#shape');
    await waitFor(page, s => s?.mode === 'free', 'shape changes');
    assert.deepEqual(JSON.parse(await page.evaluate(() => localStorage.getItem('night-saltplate:free'))), { v: 1, shape: 'disk' }, 'the shape is kept under its own key');
    await tapTuner(page, { fraction: 0.45 });
    await sleep(1500);
    await checkBounds(page, ['shape', 'picture', 'resalt', 'home']);
    await screenshot(page, name, '09-instrument');
    await page.tap('#picture');
    await page.waitForFunction(() => window.saltplateShared.length === 2);
    assert.match((await page.evaluate(() => window.saltplateShared[1].text)), /\d+ Hz/, 'the instrument picture names its pitch');

    // The plate list: cleared plates and the next one open, the rest closed.
    await page.tap('#pause');
    await waitFor(page, s => s?.screen === 'paused', 'paused');
    await page.tap('#to-plates');
    await waitFor(page, s => s?.screen === 'chooser', 'the plate list opens');
    assert.deepEqual(await page.locator('#plate-list button').evaluateAll(buttons => [buttons.length, buttons.filter(b => !b.disabled).length]), [LEVELS.length, 8],
      'eighteen plates listed; seven cleared and the eighth open');
    await screenshot(page, name, '10-plate-list');
    await page.locator('#plate-list button').nth(1).tap();
    await waitFor(page, s => s?.screen === 'play' && s.mode === 'plates' && s.level === 2, 'a listed plate opens');
    // Leaving the instrument for a plate ends its run as an instrument run, on the shape it was played on.
    await waitForRuns(lab, 'night-saltplate', 4);
    const freeRuns = runRecords(lab, 'night-saltplate').filter(r => r.data.outcome !== 'between-runs').slice(2);
    assert.deepEqual(freeRuns.map(r => [r.data.outcome, r.data.summary.mode, r.data.summary.shape, r.data.summary.pictures]),
      [['quit', 'free', 'square', 0], ['quit', 'free', 'disk', 1]], 'each instrument visit is recorded as the instrument, with its shape');
    assert.ok(freeRuns[1].data.events.some(event => event.type === 'picture'), 'the instrument picture is an event');

    // Turkish: every string through words.js.
    await page.tap('#pause');
    await page.tap('#lang');
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'tr');
    assert.equal(await page.locator('#resume').textContent(), 'Devam');
    await page.tap('#resume');
    assert.equal(await page.locator('#level-name').textContent(), 'Köşegen', 'the plate name is Turkish');
    await screenshot(page, name, '11-turkish');
    await page.tap('#pause');
    await page.tap('#lang');
    await page.tap('#resume');

    // Every box on the page is inside the screen (#work hides its overflow, so a scroll height
    // alone would not see a clipped control), from a 320 x 568 phone up, and the plate takes what is left.
    const portrait = page.viewportSize();
    const sizes = [];
    for (const [width, height] of [[320, 568], [375, 667], [390, 844]]) {
      await page.setViewportSize({ width, height });
      await sleep(120);
      const plate = await fits(page, `${width} x ${height}`);
      sizes.push(`${width}x${height} plate ${Math.round(plate)}`);
    }
    assert.ok(Number(sizes[0].split(' ').at(-1)) >= 250, `the plate fills a 320 x 568 phone: ${sizes[0]}`);

    // The longest words: Turkish at 320 x 568 on the plates with the longest idea lines, the plate
    // with two gauges, and a Turkish result card with its three buttons. The plate keeps its size
    // when the print appears.
    await page.setViewportSize({ width: 320, height: 568 });
    await page.evaluate(() => localStorage.setItem('night-saltplate:save', JSON.stringify({ v: 1, cleared: 17, look: 'blue', sound: true })));
    await page.goto(at('&lang=tr'));
    await waitFor(page, s => s?.screen === 'play' && s.level === 18 && s.lang === 'tr', 'Turkish, plate 18');
    const turkish = [];
    for (const level of [10, 13, 15, 17, 18]) {
      await page.tap('#pause');
      await page.tap('#to-plates');
      await waitFor(page, s => s?.screen === 'chooser', 'the plate list opens');
      await page.locator('#plate-list button').nth(level - 1).tap();
      await waitFor(page, s => s?.screen === 'play' && s.level === level, `plate ${level} opens`);
      turkish.push(`${level}:${Math.round(await fits(page, `Turkish plate ${level}`))}`);
      if (level === 17) {
        await tapTuner(page, { fraction: 0.1 });
        await sleep(300);
        assert.ok(await page.locator('#salt-gauge').isVisible(), 'the salt gauge shows on plate 17');
        await fits(page, 'Turkish plate 17 with two gauges');
        await screenshot(page, name, '12-turkish-320-two-gauges');
      }
    }
    await page.tap('#pause');
    await page.tap('#to-plates');
    await page.locator('#plate-list button').nth(1).tap();
    await waitFor(page, s => s?.screen === 'play' && s.level === 2, 'plate 2 opens');
    const before = await fits(page, 'Turkish plate 2');
    await clear(page, 2);
    await sleep(400);
    const after = await fits(page, 'Turkish result card');
    assert.ok(Math.abs(after - before) < 1, `the plate keeps its size when the print appears: ${before} ${after}`);
    for (const id of ['next', 'replay', 'share']) assert.ok(await page.locator('#' + id).isVisible(), `${id} shows on the result card`);
    await checkBounds(page, ['next', 'replay', 'share']);
    await screenshot(page, name, '13-turkish-320-result');
    await page.evaluate(() => localStorage.setItem('kit:lang', 'en'));

    // Page work per frame at 390 x 844 with the most grains (the Powder plate: 700).
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => localStorage.setItem('night-saltplate:save', JSON.stringify({ v: 1, cleared: 15, look: 'blue', sound: true })));
    await page.goto(at(''));
    await waitFor(page, s => s?.screen === 'play' && s.level === 16, 'the Powder plate opens');
    await readyToPaint(page, name);
    await tapTuner(page, { fraction: 0.3 });
    await page.evaluate(() => window.saltplatePerfReset());
    await sleep(2500);
    const perf = await page.evaluate(() => window.saltplatePerf());
    assert.ok(perf.grains === 700 && perf.frames > 60, `frames measured with every grain: ${JSON.stringify(perf)}`);
    assert.ok(perf.p95 < 8, `page work per frame under 8 ms: ${JSON.stringify(perf)}`);
    await page.setViewportSize(portrait);
    await assertHomeLinks(context, `${url}?from=small&lang=tr`, ['paused', 'result'], '‹ Küçük oyunlar');

    assert.deepEqual(unexpected, [], 'no external requests');
    assert.deepEqual(errors, [], 'no browser errors');
    console.log(JSON.stringify({ browser: name, extras: { daily: daily.shape + ':' + daily.mode, dailySeconds: printed.t, sizes, turkish, perf } }));
  } finally {
    await browser.close();
  }
}

try {
  for (const profile of profiles) {
    if (process.argv[2] && process.argv[2] !== profile.name) continue;
    try {
      await run(profile);
      await recording(profile);
      await extras(profile);
    } catch (error) {
      process.exitCode = 1;
      console.error(profile.name, error);
    }
  }
} finally {
  await new Promise(done => server.close(done));
}
