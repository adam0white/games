// Run with the pinned Node version. An optional argument selects webkit or chromium.
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const experiments = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const pagePath = '/lab/night-sand/';
const saveKey = 'night-sand:save';
const shots = process.env.SHOTS || '/private/tmp/night-r6-new6';
const notes = '/notes/button.js';
const require = createRequire(join(resolve(process.env.PLAYWRIGHT ||
  join(homedir(), 'code/human-framework/node_modules')), 'check.cjs'));
const { chromium, devices, webkit } = require('playwright');
const profiles = [
  { name: 'webkit', device: 'iPhone 13', engine: webkit },
  { name: 'chromium', device: 'Pixel 7', engine: chromium },
].filter(profile => !process.argv[2] || process.argv[2] === profile.name);
assert.ok(profiles.length, 'select webkit or chromium');
const contentTypes = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css' };
const allowed = path => path === notes || path.startsWith(pagePath)
  || (path.startsWith('/kit/') && path !== '/kit/lab.js') || path === '/favicon.ico';
const server = createServer(async (request, response) => {
  const { pathname } = new URL(request.url, 'http://localhost');
  if (pathname === '/favicon.ico') return response.writeHead(204).end();
  try {
    assert.ok(allowed(pathname));
    let file = resolve(experiments, '.' + decodeURIComponent(pathname));
    assert.ok(file.startsWith(experiments + sep));
    if (pathname.endsWith('/')) file = join(file, 'index.html');
    if (pathname === notes) file = resolve(experiments, '../workers/feedback/public/notes/button.js');
    const body = await readFile(file);
    response.writeHead(200, { 'content-type': contentTypes[extname(file)] }).end(body);
  } catch {
    response.writeHead(404).end();
  }
});

const state = page => page.evaluate(() => window.sandState());
const saved = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), saveKey);
const screen = (page, expected) => page.waitForFunction(expected => window.sandState?.().screen === expected,
  expected, { polling: 40, timeout: 9000 });
const tap = (page, id) => page.locator('#' + id).tap({ timeout: 5000 });
const capture = (page, name, scene) => page.screenshot({
  path: join(shots, `night-sand-${name}-${scene}.png`), scale: 'css',
});

async function fits(page, id) {
  const box = await page.locator('#' + id).boundingBox();
  const { width, height } = page.viewportSize();
  assert.ok(box && box.x >= -0.5 && box.y >= -0.5 && box.x + box.width <= width + 0.5
    && box.y + box.height <= height + 0.5, id + ' fits the viewport');
}

async function waitForFrames(page, name) {
  const painted = () => page.evaluate(() => new Promise(resolve => {
    const timer = setTimeout(() => resolve(false), 1500);
    requestAnimationFrame(() => requestAnimationFrame(() => { clearTimeout(timer); resolve(true); }));
  }));
  await page.bringToFront();
  if (await painted()) return;
  assert.equal(name, 'webkit', 'animation frames run');
  const size = page.viewportSize();
  await page.setViewportSize({ ...size, width: size.width + 1 });
  await delay(100);
  await page.setViewportSize(size);
  assert.ok(await painted(), 'animation frames run at the original simulated phone size');
}

// Chromium exposes trusted continuous touch. WebKit exposes trusted taps and mouse drags.
async function controls(page, name) {
  const session = name === 'chromium' ? await page.context().newCDPSession(page) : null;
  return async function stroke(x1, y1, x2, y2, { steps = 15, dwell = 60, curve = 0 } = {}) {
    const box = await page.locator('#field').boundingBox();
    const point = (x, y) => ({ x: box.x + x * box.width / 120, y: box.y + y * box.height / 160 });
    const dispatch = (type, touchPoints) => session.send('Input.dispatchTouchEvent', { type, touchPoints });
    const start = point(x1, y1);
    if (session) await dispatch('touchStart', [start]);
    else {
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
    }
    try {
      await delay(dwell);
      for (let n = 1; n <= steps; n++) {
        const fraction = n / steps;
        const p = point(x1 + (x2 - x1) * fraction + curve * Math.sin(2 * Math.PI * fraction),
          y1 + (y2 - y1) * fraction);
        if (session) await dispatch('touchMove', [p]);
        else await page.mouse.move(p.x, p.y);
        await delay(12);
      }
    } finally {
      if (session) await dispatch('touchEnd', []);
      else await page.mouse.up();
    }
  };
}

async function instrument(context, origin, errors, requests) {
  await context.route('**/*', route => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() !== 'GET' || url.origin !== origin || !allowed(url.pathname)) {
      errors.push(`unexpected ${request.method()} ${url}`);
      return route.abort();
    }
    requests.add(url.pathname);
    return route.continue();
  });
  await context.addInitScript(() => {
    if (location.protocol !== 'http:') return;
    localStorage.setItem('hf-lab-send-localhost', '1');
    window.sandCheckPointers = [];
    document.addEventListener('pointerdown', event => {
      if (event.target.id === 'field') window.sandCheckPointers.push({ type: event.pointerType, trusted: event.isTrusted });
    }, true);
    // Observe the native master gain of the grain loop without changing its signal path.
    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function(destination, ...ports) {
      if (!window.sandCheckGain && this instanceof GainNode && destination === this.context.destination) {
        window.sandCheckGain = this.gain;
      }
      return connect.call(this, destination, ...ports);
    };
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  page.on('requestfailed', request => errors.push('failed ' + request.url()));
  page.on('websocket', socket => errors.push('unexpected socket ' + socket.url()));
  return page;
}

async function measureFrames(page, whilePlaying) {
  const finished = page.evaluate(() => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('display stopped during sample')), 8000);
    let previous = 0;
    const intervals = [];
    const costs = [];
    const movingCosts = [];
    let maxFlow = 0;
    let maxMovingGain = 0;
    function frame(now) {
      if (!previous) {
        previous = now;
        return requestAnimationFrame(frame);
      }
      intervals.push(now - previous);
      previous = now;
      const reading = window.sandState();
      maxFlow = Math.max(maxFlow, reading.flow);
      if (reading.status === 'play' && reading.flow > 0) {
        movingCosts.push(reading.frameCost);
        maxMovingGain = Math.max(maxMovingGain, window.sandCheckGain?.value ?? 0);
      }
      costs.push(reading.frameCost);
      if (intervals.length < 90) return requestAnimationFrame(frame);
      clearTimeout(timer);
      intervals.sort((a, b) => a - b);
      costs.sort((a, b) => a - b);
      movingCosts.sort((a, b) => a - b);
      resolve({ frames: intervals.length, medianMs: intervals[45], p95Ms: intervals[85],
        workMedianMs: costs[45], workP95Ms: costs[85], movingFrames: movingCosts.length,
        movingWorkP95Ms: movingCosts[Math.floor(movingCosts.length * .95)] ?? 0, maxFlow, maxMovingGain });
    }
    requestAnimationFrame(frame);
  }));
  const [sample] = await Promise.all([finished, whilePlaying()]);
  return sample;
}

async function run(profile, origin) {
  const { name, engine, device } = profile;
  const browser = await engine.launch({ headless: true });
  const errors = [];
  const requests = new Set();
  try {
    const context = await browser.newContext({ ...devices[device], serviceWorkers: 'block' });
    const page = await instrument(context, origin, errors, requests);
    const url = origin + pagePath;
    await page.goto(url);
    await screen(page, 'play');
    await waitForFrames(page, name);
    await fits(page, 'field');
    await fits(page, 'pause');
    const opening = await state(page);
    assert.equal(opening.level, 1);
    assert.equal(opening.unlocked, 1);
    await capture(page, name, '01-lamp');
    const stroke = await controls(page, name);
    const start = performance.now();
    const openingBox = await page.locator('#field').boundingBox();
    await page.touchscreen.tap(openingBox.x + openingBox.width * .25, openingBox.y + openingBox.height * .16);
    assert.equal((await state(page)).status, 'play', 'an exploratory tap on sky leaves the lamp buried');
    const { x, y, toX, toY } = opening.hint;
    for (const offset of [0, -4, 4, 0, -6, 6, 0, -3, 3]) {
      if ((await state(page)).status !== 'play') break;
      await stroke(x + offset, y, toX, toY);
      await delay(260);
    }
    await screen(page, 'result');
    const firstSeconds = (performance.now() - start) / 1000;
    assert.ok(firstSeconds < 60, 'the first lamp is uncovered in under one minute');
    assert.equal((await state(page)).unlocked, 2, 'the level result unlocks the second level');
    assert.equal((await saved(page)).unlocked, 2);
    assert.ok(await page.evaluate(type => window.sandCheckPointers.some(p => p.type === type && p.trusted),
      name === 'webkit' ? 'mouse' : 'touch'), 'the browser delivered a trusted gesture to the field');
    await capture(page, name, '02-uncovered');
    assert.equal(await page.locator('#result-title').innerText(), 'Lamp uncovered');
    await fits(page, 'next');
    await fits(page, 'retry');
    await tap(page, 'next');
    await screen(page, 'play');
    assert.equal((await state(page)).level, 2);
    await capture(page, name, '03-hourglass');
    await tap(page, 'pause');
    await screen(page, 'paused');
    const paused = await state(page);
    await delay(250);
    assert.equal((await state(page)).tick, paused.tick, 'the simulation clock stops while paused');
    const before = await saved(page);
    await tap(page, 'sound');
    await tap(page, 'look');
    const after = await saved(page);
    assert.equal(after.sound, !before.sound);
    assert.notEqual(before.look, after.look);
    await tap(page, 'book');
    await screen(page, 'book');
    assert.equal(await page.locator('[id^="level-"]').count(), 10);
    assert.ok(await page.locator('#level-1').isEnabled());
    assert.ok(await page.locator('#level-2').isEnabled());
    assert.ok(await page.locator('#level-3').isDisabled());
    await tap(page, 'back');
    await screen(page, 'paused');
    await tap(page, 'resume');
    await screen(page, 'play');
    await page.reload();
    await screen(page, 'play');
    const reload = await state(page);
    assert.equal(reload.level, 2);
    assert.equal(reload.unlocked, 2);
    assert.equal(reload.look, after.look);
    assert.equal(reload.sound, after.sound);
    const box = await page.locator('#field').boundingBox();
    await page.touchscreen.tap(box.x + box.width * .5, box.y + box.height * .6);
    await page.waitForFunction(() => window.sandState().tick > 0, null, { polling: 50, timeout: 4000 });
    assert.equal(await page.evaluate(() => Boolean(window.sandCheckGain)), false, 'fresh muted play leaves audio off');
    await page.mouse.move(box.x + box.width * .5, box.y + box.height * .6);
    await page.mouse.down();
    assert.equal((await state(page)).pressed, true);
    await page.keyboard.press('Escape');
    await screen(page, 'paused');
    assert.equal((await state(page)).pressed, false, 'pausing clears the captured board pointer');
    await page.mouse.up();
    assert.equal((await state(page)).screen, 'paused', 'a delayed finger lift leaves pause in place');
    await tap(page, 'sound');
    await tap(page, 'resume');
    assert.equal((await state(page)).sound, true);
    // Continue from the genuine saved unlock. Every later goal is reached through play.
    const openingStroke = async () => {
      const { x, y, toX, toY } = (await state(page)).hint;
      await stroke(x, y, toX, toY);
    };
    const pourSample = await measureFrames(page, openingStroke);
    assert.ok(pourSample.maxFlow > 0, 'opening the board releases moving grains');
    assert.ok(pourSample.maxMovingGain > 0, 'moving grains raise their native Web Audio gain');
    await screen(page, 'result');
    assert.equal((await state(page)).unlocked, 3, 'the lower bulb reached its line');
    for (const [level, kind] of [[3, 'sieve'], [4, 'seed']]) {
      await tap(page, 'next');
      await screen(page, 'play');
      assert.equal((await state(page)).level, level);
      assert.equal((await state(page)).kind, kind);
      await capture(page, name, `0${level + 1}-${kind}`);
      for (let attempt = 0; attempt < 3; attempt++) {
        const beforeStroke = await state(page);
        if (beforeStroke.status !== 'play' || beforeStroke.screen === 'result') break;
        await openingStroke();
        // Wait for the poured grains to reach the receiver before adding another scoop.
        await page.waitForFunction(start => {
          const s = window.sandState();
          return s.status !== 'play' || s.tick >= start + 280;
        }, beforeStroke.tick, { polling: 60, timeout: 14000 });
      }
      await screen(page, 'result');
      assert.equal((await state(page)).unlocked, level + 1, kind + ' goal unlocks the next level');
    }
    await tap(page, 'next');
    await screen(page, 'play');
    await tap(page, 'pause');
    await tap(page, 'garden');
    await screen(page, 'play');
    assert.equal((await state(page)).level, 0);
    assert.equal((await state(page)).score, 0);
    await stroke(24, 80, 40, 139, { steps: 28, curve: 8 });
    const unpaired = (await state(page)).score;
    const sample = await measureFrames(page, () => stroke(95, 80, 79, 139, { steps: 28, curve: -8 }));
    const paired = await state(page);
    assert.equal(unpaired, 0, 'an isolated stroke on the left has no mirrored cells');
    assert.ok(paired.score > unpaired, 'mirroring the first rake stroke raises the symmetry score');
    assert.ok(paired.score >= 75, 'at least three quarters of a mirrored touch drawing matches');
    assert.equal(paired.best, (await saved(page)).best, 'the garden record is written locally');
    assert.ok(paired.best >= paired.score);
    await capture(page, name, '06-garden');
    await page.reload();
    await screen(page, 'play');
    assert.equal((await state(page)).best, paired.best, 'reload preserves the garden record');
    assert.equal((await state(page)).level, 5, 'the garden preserves the campaign bed for reload');
    assert.deepEqual(await page.evaluate(() => Object.keys(localStorage).filter(k =>
      k.startsWith('hf-lab-') && k !== 'hf-lab-send-localhost')), [], 'no play-recording identity');
    await context.close();

    for (const asset of [notes, ...['save', 'audio', 'pause', 'screens', 'zoom', 'hint'].map(n => `/kit/${n}.js`)]) {
      assert.ok(requests.has(asset), `loaded ${asset}`);
    }
    assert.deepEqual(errors, [], 'browser or network errors');
    console.log(JSON.stringify({ profile: device, firstSeconds: +firstSeconds.toFixed(2),
      oneStroke: unpaired, mirrored: paired.score, best: paired.best, pourFrames: pourSample, gardenFrames: sample, errors: errors.length }));
  } finally {
    await browser.close();
  }
}

await mkdir(shots, { recursive: true });
await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
const origin = `http://127.0.0.1:${server.address().port}`;
try {
  for (const profile of profiles) {
    try {
      await run(profile, origin);
    } catch (error) {
      process.exitCode = 1;
      console.error(profile.name, error);
    }
  }
} finally {
  await new Promise(done => server.close(done));
}
