// PLAYWRIGHT=<directory containing playwright> node experiments/lab/night-kite/check.mjs [webkit|chromium]
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const shots = process.env.SHOTS || '/private/tmp/night-r4-new3';
const saveKey = 'night-kite:save';
const path = '/lab/night-kite/';
const notesButton = '/notes/button.js';
const allowed = pathname => pathname.startsWith(path) || pathname === notesButton
  || pathname === '/favicon.ico' || (pathname.startsWith('/kit/') && pathname !== '/kit/lab.js');
const requirePlaywright = createRequire(join(resolve(process.env.PLAYWRIGHT
  || join(homedir(), 'code/human-framework/node_modules')), 'check.cjs'));
const { chromium, devices, webkit } = requirePlaywright('playwright');
const profiles = [
  { name: 'webkit', engine: webkit, device: 'iPhone 13' },
  { name: 'chromium', engine: chromium, device: 'Pixel 7' },
];
const selected = profiles.filter(({ name }) => !process.argv[2] || process.argv[2] === name);
assert.ok(selected.length, 'unknown browser');
await mkdir(shots, { recursive: true });

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = createServer(async (request, response) => {
  const { pathname } = new URL(request.url, 'http://localhost');
  if (pathname === '/favicon.ico') return response.writeHead(204).end();
  try {
    const file = resolve(root, `.${decodeURIComponent(pathname)}${pathname.endsWith('/') ? 'index.html' : ''}`);
    assert.ok(allowed(pathname) && file.startsWith(root + sep));
    const asset = pathname === notesButton
      ? resolve(root, '../workers/feedback/public/notes/button.js') : file;
    const data = await readFile(asset);
    response.writeHead(200, { 'content-type': types[extname(asset)] ?? 'application/octet-stream' }).end(data);
  } catch {
    response.writeHead(404).end('not found');
  }
});
await new Promise((done, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', done);
});
const origin = `http://127.0.0.1:${server.address().port}`;
const url = origin + path;
const state = page => page.evaluate(() => window.kiteState());
const stored = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), saveKey);
const screen = (page, name) => page.waitForFunction(name => window.kiteState?.().screen === name, name, { polling: 50, timeout: 8000 });
const later = (page, target) => page.waitForFunction(target => window.kiteState().t >= target, target, { polling: 30, timeout: 5000 });

async function controls(page, ids) {
  const viewport = page.viewportSize();
  for (const id of ids) {
    const button = page.locator(`#${id}`);
    assert.ok(await button.isVisible(), `${id} is visible`);
    const { x, y, width, height } = await button.boundingBox();
    assert.ok(width >= 44 && height >= 44, `${id} has a 44 × 44 CSS-pixel target`);
    assert.ok(x >= 0 && y >= 0 && x + width <= viewport.width + 0.5 && y + height <= viewport.height + 0.5,
      `${id} stays within the viewport`);
  }
}

async function wakeDisplay(page) {
  const viewport = page.viewportSize();
  await page.bringToFront();
  await page.setViewportSize({ ...viewport, width: viewport.width + 1 });
  await sleep(150);
  await page.setViewportSize(viewport);
}

async function readyToPaint(page, name) {
  const check = async () => {
    const previous = await page.evaluate(() => window.kiteCheckFrames);
    await page.waitForFunction(n => window.kiteCheckFrames >= n + 2, previous, { polling: 50, timeout: 5000 });
  };
  try {
    await check();
  } catch (error) {
    if (name !== 'webkit' || error.name !== 'TimeoutError') throw error;
    await wakeDisplay(page);
    await check();
  }
}

async function fieldCoordinates(page) {
  const field = await page.locator('#field').boundingBox();
  assert.ok(field?.width > 0 && field.height > 0, 'the canvas has a displayed area');
  return (x, y) => ({ x: field.x + field.width * x / 360, y: field.y + field.height * y / 520 });
}

// WebKit exposes touch taps. Use its trusted mouse for the sustained gesture,
// and Chromium's trusted touch stream where supported.
async function steering(page, name) {
  const cdp = name === 'chromium' ? await page.context().newCDPSession(page) : null;
  const point = await fieldCoordinates(page);
  const touch = (type, touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  const mouse = (x, y) => page.mouse.move(...Object.values(point(x, y)));
  return {
    async down(x, y) {
      if (cdp) return touch('touchStart', [point(x, y)]);
      await mouse(x, y);
      await page.mouse.down();
    },
    move(x, y) {
      return cdp ? touch('touchMove', [point(x, y)]) : mouse(x, y);
    },
    up() {
      return cdp ? touch('touchEnd', []) : page.mouse.up();
    },
  };
}

const awaitFirstResult = page => page.waitForFunction(() => window.kiteState().screen === 'result', null, {
  polling: 50, timeout: 59000,
});

async function firstResult(page, start) {
  const result = await state(page);
  assert.equal(result.done, result.total, 'level one clears all objectives');
  const wallSeconds = (Date.now() - start) / 1000;
  assert.ok(result.t > 0 && result.t < 60 && wallSeconds < 60, 'level one completes in under one minute');
  return { seconds: result.t, wallSeconds };
}

// Follow each visible objective through the spool, allowing offset for line tension.
async function followGoals(page, input, complete, observe = async () => {}) {
  const destination = ({ goal }) => [goal.x, 520 - (488 - goal.y - 8 - 120) / 0.62];
  await input.down(...destination(await state(page)));
  try {
    const deadline = Date.now() + 18000;
    while (Date.now() < deadline) {
      const flight = await state(page);
      if (complete(flight)) return flight;
      assert.equal(flight.screen, 'play', `flight ${flight.level} ended at goal ${flight.done}: ${flight.status}`);
      await input.move(...destination(flight));
      await observe(flight);
      await sleep(50);
    }
    assert.fail('visible goal was unreachable through pointer steering');
  } finally {
    await input.up();
  }
}

async function run({ name, engine, device }) {
  const browser = await engine.launch({ timeout: 45000 });
  try {
    const context = await browser.newContext(devices[device]);
    const page = await context.newPage();
    const errors = [];
    const outside = [];
    const telemetry = [];
    page.on('pageerror', error => { errors.push(error.message); console.error(name, error.message); });
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    page.on('requestfailed', request => errors.push(`failed ${request.url()}: ${request.failure()?.errorText}`));
    page.on('websocket', socket => telemetry.push(`WebSocket ${socket.url()}`));
    await context.route('**/*', async route => {
      const request = route.request();
      const requestUrl = new URL(request.url());
      if (requestUrl.origin !== origin) {
        outside.push(request.url());
        return route.abort();
      }
      if (request.method() !== 'GET' || !allowed(requestUrl.pathname)) {
        telemetry.push(`${request.method()} ${requestUrl.pathname}`);
        return route.abort();
      }
      return route.continue();
    });
    await context.addInitScript(() => {
      if (location.protocol !== 'http:') return;
      localStorage.setItem('hf-lab-send-localhost', '1');
      window.kiteCheckFrames = 0;
      requestAnimationFrame(function countFrame() {
        window.kiteCheckFrames++;
        requestAnimationFrame(countFrame);
      });
      window.kiteCheckPointers = [];
      document.addEventListener('pointerdown', event => {
        if (event.target.id === 'field') window.kiteCheckPointers.push([event.pointerType, event.isTrusted, event.isPrimary]);
      }, { capture: true });
    });
    if (name === 'webkit') {
      await page.goto('about:blank');
      await wakeDisplay(page);
    }
    await page.goto(url);
    await screen(page, 'play');
    await readyToPaint(page, name);
    const capture = scene => page.screenshot({
      path: join(shots, `night-kite-${name}-${scene}.png`),
      scale: name === 'webkit' ? 'css' : 'device', timeout: 30000,
    });
    await controls(page, ['pause']);
    await sleep(3200);
    const opening = await state(page);
    assert.equal(opening.level, 1);
    assert.equal(opening.unlocked, 1);
    assert.equal(opening.started, false);
    assert.equal(opening.t, 0);
    await capture('01-opening');
    let input = await steering(page, name);
    const firstStart = Date.now();
    await input.down(180, 440);
    try {
      await input.move(245, 399);
      await awaitFirstResult(page);
    } finally {
      await input.up();
    }
    const first = await firstResult(page, firstStart);
    const pointers = await page.evaluate(() => window.kiteCheckPointers);
    assert.ok(pointers.some(([type, trusted, primary]) =>
      type === (name === 'webkit' ? 'mouse' : 'touch') && trusted && primary), 'steering uses trusted browser input');
    assert.equal((await state(page)).unlocked, 2);
    assert.equal((await stored(page)).unlocked, 2);
    await controls(page, ['next', 'retry']);
    await capture('02-first-result');
    await page.tap('#retry');
    await screen(page, 'play');
    const retry = await state(page);
    assert.equal(retry.level, 1);
    assert.equal(retry.t, 0);
    assert.equal(retry.started, false);
    const point = await fieldCoordinates(page);
    const { x, y } = point(retry.goal.x, retry.goal.y);
    const tapStart = Date.now();
    await page.touchscreen.tap(x, y);
    await awaitFirstResult(page);
    const firstTap = await firstResult(page, tapStart);
    assert.deepEqual(await page.evaluate(() => window.kiteCheckPointers.at(-1)), ['touch', true, true],
      'the retry receives a trusted primary touch on the canvas');
    await page.tap('#next');
    await screen(page, 'play');
    const second = await state(page);
    assert.equal(second.level, 2);
    assert.equal(second.t, 0);
    input = await steering(page, name);
    await input.down(180, 330);
    await later(page, 0.35);
    const paidOut = await state(page);
    assert.ok(paidOut.line > second.line, 'upward finger motion pays out line');
    await input.move(180, 505);
    await later(page, paidOut.t + 0.35);
    const reeledIn = await state(page);
    assert.ok(reeledIn.line < paidOut.line, 'downward finger motion reels in line');
    await input.up();
    await page.tap('#pause');
    await screen(page, 'paused');
    const paused = await state(page);
    await sleep(500);
    assert.deepEqual(await state(page), paused, 'pause freezes the exposed simulation state');
    await controls(page, ['resume', 'chart-open', 'look', 'sound']);
    await capture('03-paused');
    await page.tap('#resume');
    await screen(page, 'play');
    await later(page, paused.t + 0.15);
    await page.tap('#pause');
    await screen(page, 'paused');
    const previousSave = await stored(page);
    await page.tap('#sound');
    assert.equal((await stored(page)).sound, !previousSave.sound);
    await page.tap('#look');
    const look = (await stored(page)).look;
    assert.notEqual(look, previousSave.look);
    await page.tap('#chart-open');
    await screen(page, 'chart');
    await controls(page, ['endless', 'chart-back']);
    assert.equal(await page.locator('#levels button:enabled').count(), 2);
    await capture('04-chart');
    await page.tap('#chart-back');
    await screen(page, 'paused');
    await page.tap('#chart-open');
    await screen(page, 'chart');
    await page.locator('#levels [data-level="2"]').tap();
    await screen(page, 'play');
    const lateFlights = [];
    for (const level of [2, 3, 4, 5]) {
      assert.equal((await state(page)).level, level);
      let pickedUp = false;
      let sawSquall = false;
      input = await steering(page, name);
      const result = await followGoals(page, input, flight => flight.screen === 'result', async flight => {
        if (level === 3 && flight.goal.carrying && !pickedUp) {
          pickedUp = true;
          assert.equal(flight.done, 0, 'pickup alone cannot complete the delivery');
          await capture('05-lantern-return');
        }
        if (level === 5 && flight.goal.progress > 0.1 && flight.storm > 0.1 && !sawSquall) {
          sawSquall = true;
          await capture('06-squall');
        }
      });
      assert.equal(result.done, result.total, `flight ${level} clears all objectives`);
      if (level === 3) assert.ok(pickedUp, 'the lantern is visibly carried before delivery');
      if (level === 5) assert.ok(sawSquall, 'the wind rises during the timed hold');
      lateFlights.push(result.t);
      if (level < 5) {
        await page.tap('#next');
        await screen(page, 'play');
      }
    }
    assert.equal((await state(page)).screen, 'result', 'releasing the flight pointer keeps the result card open');
    await page.tap('#result-chart', { timeout: 4000 });
    await screen(page, 'chart');
    assert.equal(await page.locator('#levels button:enabled').count(), 6);
    await page.tap('#endless');
    await screen(page, 'play');
    input = await steering(page, name);
    assert.equal((await state(page)).level, 0);
    assert.equal((await state(page)).score, 0);
    const scored = await followGoals(page, input, flight => flight.score > 0);
    assert.equal(scored.screen, 'play');
    assert.equal(scored.best, scored.score);
    const best = scored.best;
    assert.equal((await stored(page)).best, best, 'best updates during flight');
    await capture('07-endless');
    await page.tap('#pause');
    await screen(page, 'paused');
    await controls(page, ['finish']);
    await page.tap('#finish');
    await screen(page, 'result');
    assert.ok((await state(page)).best >= best);
    const beforeReload = await stored(page);
    await page.reload();
    await screen(page, 'play');
    await readyToPaint(page, name);
    assert.equal((await state(page)).best, beforeReload.best);
    assert.equal((await state(page)).unlocked, 6);
    assert.deepEqual(await stored(page), beforeReload);
    assert.equal(beforeReload.v, 1);
    assert.deepEqual(await page.evaluate(() => Object.keys(localStorage)
      .filter(key => key.startsWith('hf-lab-') && key !== 'hf-lab-send-localhost')), []);
    assert.deepEqual(errors, [], 'browser errors');
    assert.deepEqual(outside, [], 'external requests');
    assert.deepEqual(telemetry, [], 'telemetry requests');
    console.log(JSON.stringify({ browser: name, device, first, firstTap, lateFlights, paidOut: paidOut.line, reeledIn: reeledIn.line,
      best: beforeReload.best, errors: errors.length, externalRequests: outside.length, telemetry: telemetry.length }));
  } finally {
    await browser.close();
  }
}

try {
  for (const profile of selected) {
    try {
      await run(profile);
    } catch (error) {
      process.exitCode = 1;
      console.error(profile.name, error);
    }
  }
} finally {
  await new Promise(done => server.close(done));
}
