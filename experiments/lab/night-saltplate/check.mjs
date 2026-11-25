// PLAYWRIGHT=<directory containing playwright> fnm exec --using=26.12.0 node experiments/lab/night-saltplate/check.mjs [webkit|chromium]
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { LEVELS } from './sim.js';
import { answerLab, withAgent, assertNotice, assertRun, assertOffSendsNothing, assertNoLeak, waitForRuns } from '../../kit/check/lab-record.mjs';

const mount = '/lab/night-saltplate/';
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

async function clear(page, level, marker = false) {
  const start = performance.now();
  await tapTuner(page, { marker, fraction: LEVELS[level - 1].target });
  const tuned = await waitFor(page, s => s?.active, `plate ${level} responds to one touch`);
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

try {
  for (const profile of profiles) {
    if (process.argv[2] && process.argv[2] !== profile.name) continue;
    try {
      await run(profile);
      await recording(profile);
    } catch (error) {
      process.exitCode = 1;
      console.error(profile.name, error);
    }
  }
} finally {
  await new Promise(done => server.close(done));
}
