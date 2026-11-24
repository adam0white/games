// PLAYWRIGHT=<directory containing playwright> node experiments/lab/night-flock/check.mjs [webkit|chromium]
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { createRequire } from 'node:module';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { leftEdge, rightEdge } from './sim.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const notesButton = resolve(root, '../workers/feedback/public/notes/button.js');
const shots = process.env.SHOTS || '/private/tmp/night-r4-review/flock';
const saveKey = 'night-flock:save';
const types = {
  '.css': 'text/css',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};
const allowed = pathname => pathname === '/notes/button.js' || pathname === '/favicon.ico'
  || pathname.startsWith('/lab/night-flock/') || pathname.startsWith('/kit/');

const requirePlaywright = createRequire(join(resolve(process.env.PLAYWRIGHT || join(homedir(), 'code/human-framework/node_modules')), 'check.cjs'));
const { chromium, devices, webkit } = requirePlaywright('playwright');
const fromPlaywright = createRequire(requirePlaywright.resolve('playwright'));
const { PNG } = fromPlaywright('playwright-core/lib/utilsBundle');
const profiles = [
  { name: 'webkit', engine: webkit, device: 'iPhone 13' },
  { name: 'chromium', engine: chromium, device: 'Pixel 7' },
];
assert.ok(!process.argv[2] || profiles.some(({ name }) => name === process.argv[2]), 'unknown browser');
await mkdir(shots, { recursive: true });

const server = createServer(async (request, response) => {
  const { pathname } = new URL(request.url, 'http://localhost');
  if (pathname === '/lab/night-flock/check-away.html') {
    response.writeHead(200, { 'content-type': types['.html'] });
    response.end('<!doctype html><title>Away from the field</title>');
    return;
  }
  if (pathname === '/favicon.ico') {
    response.writeHead(204);
    response.end();
    return;
  }
  try {
    const path = decodeURIComponent(pathname);
    const file = path === '/notes/button.js'
      ? notesButton
      : resolve(root, `.${path}${path.endsWith('/') ? 'index.html' : ''}`);
    if (!allowed(path) || (file !== notesButton && !file.startsWith(root + sep))) throw new Error('unknown asset');
    const data = await readFile(file);
    response.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    response.end(data);
  } catch {
    response.writeHead(404);
    response.end('not found');
  }
});
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const origin = `http://127.0.0.1:${server.address().port}`;
const url = `${origin}/lab/night-flock/`;

const state = page => page.evaluate(() => window.flockState());
const waitForScreen = (page, screen) => page.waitForFunction(
  expected => window.flockState?.().screen === expected, screen, { polling: 50 },
);
const stored = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), saveKey);

async function wakeDisplay(page) {
  const viewport = page.viewportSize();
  await page.bringToFront();
  await page.setViewportSize({ ...viewport, width: viewport.width + 1 });
  await sleep(150);
  await page.setViewportSize(viewport);
}

async function readyToPaint(page, name) {
  const check = async () => {
    const previous = await page.evaluate(() => window.flockCheckFrames);
    await page.waitForFunction(n => window.flockCheckFrames >= n + 2, previous, { polling: 50, timeout: 5000 });
  };
  if (name !== 'webkit') return check();
  // On this host WebKit can stall its display link on the first viewport.
  // A one-pixel resize wakes the link. Restore the exact profile before input.
  try {
    await check();
  } catch (error) {
    if (error.name !== 'TimeoutError') throw error;
    await wakeDisplay(page);
    await check();
  }
}

async function screenshot(page, name, step) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const bytes = await page.screenshot({ scale: name === 'webkit' ? 'css' : 'device', timeout: 90000 });
    const { data } = PNG.sync.read(bytes);
    let dark = 765, light = 0;
    for (let pixel = 0; pixel < data.length; pixel += 68) {
      if (data[pixel + 3] === 0) continue;
      const rgb = data[pixel] + data[pixel + 1] + data[pixel + 2];
      dark = Math.min(dark, rgb);
      light = Math.max(light, rgb);
    }
    if (light - dark > 100) {
      await writeFile(join(shots, `night-flock-${name}-${step}.png`), bytes);
      return;
    }
    await wakeDisplay(page);
    await readyToPaint(page, name);
  }
  assert.fail(`${name} ${step}: screenshot remained blank`);
}

async function controls(page, ids) {
  for (const id of ids) {
    const button = page.locator(`#${id}`);
    assert.ok(await button.isVisible(), `${id} is visible`);
    const { x, y, width, height } = await button.boundingBox();
    assert.ok(width >= 44 && height >= 44, `${id} has a 44 × 44 CSS-pixel target`);
    const viewport = page.viewportSize();
    assert.ok(x >= 0 && y >= 0 && x + width <= viewport.width + 0.5 && y + height <= viewport.height + 0.5,
      `${id} stays within the viewport`);
  }
}

// Chromium sends trusted touch gestures to the browser. Playwright WebKit exposes touch taps,
// so its sustained primary gesture uses the trusted mouse and its secondary finger uses PointerEvents.
async function steering(page, name) {
  const cdp = name === 'chromium' ? await page.context().newCDPSession(page) : null;
  const field = await page.locator('#field').boundingBox();
  assert.ok(field.width > 0 && field.height > 0, 'the field has a displayed area');
  assert.ok(Math.abs(field.width / field.height - 360 / 520) <= 0.01, 'the field keeps world proportions');
  const point = (id, x, y) => ({ id, x: field.x + field.width * x / 360, y: field.y + field.height * y / 520 });
  const active = new Map();
  const touch = (type, touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  const secondary = (type, { id, x, y }) => page.evaluate(({ type, id, x, y }) => {
    const element = document.elementFromPoint(x, y);
    if (element?.id !== 'field') throw new Error('secondary pointer is outside the field');
    element.dispatchEvent(new PointerEvent(type, {
      pointerId: id, pointerType: 'touch', isPrimary: false, clientX: x, clientY: y,
      buttons: type === 'pointerup' ? 0 : 1, bubbles: true, cancelable: true,
    }));
  }, { type, id, x, y });
  return {
    async down(id, x, y) {
      const next = point(id, x, y);
      active.set(id, next);
      if (cdp) return touch('touchStart', [...active.values()]);
      if (id !== 1) return secondary('pointerdown', next);
      await page.mouse.move(next.x, next.y);
      await page.mouse.down();
    },
    async move(id, x, y) {
      assert.ok(active.has(id), `pointer ${id} is down`);
      const next = point(id, x, y);
      active.set(id, next);
      if (cdp) return touch('touchMove', [...active.values()]);
      if (id !== 1) return secondary('pointermove', next);
      await page.mouse.move(next.x, next.y);
    },
    async up(id) {
      const last = active.get(id);
      assert.ok(last, `pointer ${id} is down`);
      active.delete(id);
      if (cdp) return touch('touchEnd', active.size ? [last] : []);
      if (id !== 1) return secondary('pointerup', last);
      await page.mouse.up();
    },
  };
}

async function beginner(page, input) {
  const started = Date.now();
  await input.down(1, 180, 414);
  try {
    let moves = 0;
    while (Date.now() - started < 60000) {
      const view = await state(page);
      const { game } = view;
      if (view.screen === 'end') {
        assert.equal(game.status, 'won', 'a straight upward drag wins evening 1');
        assert.equal(game.home, 12, 'all beginner sheep are home');
        assert.equal(game.lost, 0, 'no beginner sheep lost');
        assert.ok(game.time < 60, 'evening 1 finishes in under a simulated minute');
        assert.equal(await page.locator('#home').textContent(), '12', 'the fold tally shows the arrivals');
        return { seconds: game.time, wallSeconds: (Date.now() - started) / 1000, home: game.home, lost: game.lost, score: game.score, moves };
      }
      if (game.status === 'play') {
        assert.equal(view.pressed, true, 'the drag remains active');
        await input.move(1, 180, Math.max(148, 414 - 25 * game.time));
        moves++;
      }
      await sleep(60);
    }
    assert.fail('evening 1 did not finish within a wall-clock minute');
  } finally {
    await input.up(1);
  }
}

async function pauseAndRelease(page, input, name) {
  const initial = await state(page);
  const { x, y } = initial.game.dog;
  await input.down(1, x, y);
  await input.down(2, 320, 380);
  await input.move(2, 320, 430);
  await sleep(150);
  const afterSecondary = await state(page);
  assert.ok(Math.hypot(afterSecondary.game.dog.x - x, afterSecondary.game.dog.y - y) < 2,
    'a secondary pointer cannot redirect the dog');
  await input.up(2);
  assert.equal((await state(page)).pressed, true, 'a secondary pointer cannot release the primary');
  await input.move(1, x + 75, y);
  await page.waitForFunction(from => window.flockState().game.dog.x > from + 4, x, { polling: 30 });
  await page.keyboard.press('Escape');
  await waitForScreen(page, 'paused');
  const paused = await state(page);
  assert.equal(paused.pressed, false, 'pausing clears active steering');
  await input.move(1, x - 75, y);
  await sleep(300);
  assert.deepEqual((await state(page)).game, paused.game, 'pause freezes the simulation');
  await input.up(1);
  await controls(page, ['resume', 'evenings', 'sound']);
  await screenshot(page, name, '03-paused');
  await page.tap('#resume');
  await page.waitForFunction(time => window.flockState().game.time > time, paused.game.time, { polling: 30 });
  const resumed = await state(page);
  assert.equal(resumed.screen, 'play', 'resume returns to the field');
  assert.equal(resumed.pressed, false, 'resume waits for a fresh pointer');
  await input.down(1, resumed.game.dog.x + 100, resumed.game.dog.y);
  await page.waitForFunction(from => window.flockState().game.dog.x > from + 4, resumed.game.dog.x, { polling: 30 });
  await input.up(1);
  const released = await state(page);
  assert.equal(released.pressed, false, 'lifting clears steering');
  await page.waitForFunction(time => window.flockState().game.time > time + 0.15, released.game.time, { polling: 30 });
  assert.equal((await state(page)).game.dog.x, released.game.dog.x, 'the dog stops at release');
  return afterSecondary.game.time;
}

async function rotateDuringSteering(page, input, name) {
  const portrait = page.viewportSize();
  const { x, y } = (await state(page)).game.dog;
  await input.down(1, x - 80, y - 55);
  assert.equal((await state(page)).pressed, true, 'the pre-rotation gesture is active');
  await page.setViewportSize({ width: portrait.height, height: portrait.width });
  await waitForScreen(page, 'paused');
  const paused = await state(page);
  assert.equal(paused.pressed, false, 'rotating cancels the old contact');
  await input.up(1);
  await readyToPaint(page, name);
  assert.deepEqual((await state(page)).game, paused.game, 'orientation pause holds the field still');
  await controls(page, ['resume', 'evenings', 'sound']);
  await screenshot(page, name, '03a-rotated-pause');
  await page.tap('#resume');
  await waitForScreen(page, 'play');
  assert.equal((await state(page)).pressed, false, 'the old drag does not resume in landscape');

  const layout = await page.evaluate(() => {
    const box = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
    const lines = selector => {
      const element = document.querySelector(selector);
      return Math.round(element.getBoundingClientRect().height / parseFloat(getComputedStyle(element).lineHeight));
    };
    return { field: box('#field'), tally: box('.measure'), daylight: box('.daylight'),
      timerLines: lines('.dusk-label .smallcaps'), titleLines: lines('h1'), chapterLines: lines('#chapter') };
  });
  assert.equal(layout.timerLines, 1, 'the landscape countdown label stays on one line');
  assert.equal(layout.titleLines, 1, 'the landscape title stays on one line');
  assert.equal(layout.chapterLines, 1, 'the landscape evening number stays on one line');
  assert.ok(layout.tally.bottom <= layout.daylight.top, 'the landscape tally has a row above the countdown');
  assert.ok(layout.field.top >= 0 && layout.field.bottom <= portrait.width, 'the full landscape field fits vertically');
  const landscape = await steering(page, name);
  await landscape.down(1, x - 90, y);
  await page.waitForFunction(from => window.flockState().game.dog.x < from - 4, paused.game.dog.x, { polling: 30 });
  await landscape.up(1);
  await screenshot(page, name, '03b-landscape-field');
  await page.setViewportSize(portrait);
  await waitForScreen(page, 'paused');
  await page.tap('#evenings');
  await page.getByRole('button', { name: 'Evening 1', exact: true }).tap();
  const retried = await state(page);
  assert.equal(retried.game.level, 1, 'the current evening can be selected again mid-run');
  assert.equal(retried.game.time, 0, 'selecting the current evening starts it over');
  return { width: layout.field.width, height: layout.field.height };
}

// Guide the rear flock uphill. Recover sheep near the banks and meet a wolf
// that is about to reach the flock before it drives sheep across the field.
function destination(game) {
  const sheep = game.sheep.filter(animal => animal.status === 'field');
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const { wolf, gate } = game;
  if (wolf && (wolf.active || wolf.phase === 'eyes' && wolf.age > 1.7)
      && sheep.some(animal => distance(animal, wolf) < 92)) return wolf;
  const priority = animal => {
    const bank = Math.min(animal.x - leftEdge(animal.y), rightEdge(animal.y) - animal.x);
    return animal.y + 6 * Math.max(0, 21 - bank);
  };
  const rear = sheep.reduce((a, b) => priority(a) > priority(b) ? a : b);
  const group = sheep.filter(animal => distance(animal, rear) < 53 && animal.y > rear.y - 40);
  const x = group.reduce((sum, animal) => sum + animal.x, 0) / group.length;
  const y = group.reduce((sum, animal) => sum + animal.y, 0) / group.length;
  const gateDx = gate.x - x;
  const dx = Math.abs(gateDx) < 24 ? 0 : gateDx - 8 * Math.sign(gateDx);
  const dy = gate.y - 21 - y;
  const gap = (group.length > 3 ? 37 : 31) / Math.hypot(dx, dy);
  const targetY = Math.min(502, Math.max(gate.y + 8, y - dy * gap));
  return { x: Math.min(359, Math.max(1, x - dx * gap)), y: targetY };
}

async function playWave(page, input, carried, finishWave) {
  const entry = await state(page);
  const { dog, seed, sheep } = entry.game;
  const count = sheep.length;
  let firstArrival = null;
  await input.down(1, dog.x, dog.y);
  try {
    const end = Date.now() + (finishWave ? 150000 : 50000);
    while (Date.now() < end) {
      const { game, saved, screen, wave } = await state(page);
      assert.equal(saved.best, carried + game.home, 'endless best counts all sheep home across both waves');
      if (!firstArrival && game.home > 0) {
        assert.equal(game.status, 'play', 'best updates while the wave is still running');
        assert.ok((await stored(page)).best >= saved.best, 'the new best is in persistent storage');
        firstArrival = { seconds: game.time, home: game.home, best: saved.best };
        if (!finishWave) return { wave, seed, sheep: count, firstArrival };
      }
      assert.notEqual(game.status, 'lost', `wave ${wave}, seed ${seed}: ${game.home} home, ${game.lost} lost at ${game.time.toFixed(2)}s`);
      if (screen === 'end') {
        assert.equal(game.status, 'won');
        assert.equal(game.home, count);
        return { wave, seed, sheep: count, firstArrival, seconds: game.time, best: saved.best };
      }
      if (game.status === 'play') {
        const { x, y } = destination(game);
        await input.move(1, x, y);
      }
      await sleep(75);
    }
    assert.fail(`endless wave ${entry.wave}, seed ${seed}: no required result before the wall-clock deadline`);
  } finally {
    await input.up(1);
  }
}

async function run({ name, engine, device }) {
  const profile = devices[device];
  const browser = await engine.launch({ timeout: 45000 });
  try {
    const context = await browser.newContext(profile);
    const page = await context.newPage();
    const errors = [];
    const outside = [];
    const telemetry = [];
    const assets = new Set();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    page.on('requestfailed', request => errors.push(`failed ${request.url()}: ${request.failure()?.errorText}`));
    page.on('websocket', socket => telemetry.push(`WebSocket ${socket.url()}`));
    await context.route('**/*', async route => {
      const request = route.request();
      const { pathname, origin: requestOrigin } = new URL(request.url());
      if (requestOrigin !== origin) {
        outside.push(request.url());
        return route.abort();
      }
      if (request.method() !== 'GET' || !allowed(pathname) || pathname === '/kit/lab.js') {
        telemetry.push(`${request.method()} ${pathname}`);
        return route.abort();
      }
      assets.add(pathname);
      return route.continue();
    });
    await context.addInitScript(() => {
      if (location.protocol !== 'http:') return;
      localStorage.setItem('hf-lab-send-localhost', '1');
      window.flockCheckFrames = 0;
      window.flockGuideDraws = 0;
      window.flockGuideMinAlpha = 1;
      const setLineDash = CanvasRenderingContext2D.prototype.setLineDash;
      CanvasRenderingContext2D.prototype.setLineDash = function (segments) {
        if (this.canvas.id === 'field' && segments[0] === 1 && segments[1] === 6) {
          window.flockGuideDraws++;
          window.flockGuideMinAlpha = Math.min(window.flockGuideMinAlpha, this.globalAlpha);
        }
        return setLineDash.call(this, segments);
      };
      requestAnimationFrame(function countFrame() {
        window.flockCheckFrames++;
        requestAnimationFrame(countFrame);
      });
      window.flockCheckPointers = [];
      document.addEventListener('pointerdown', event => {
        if (event.target.id === 'field') window.flockCheckPointers.push([event.pointerType, event.isTrusted, event.isPrimary]);
      }, { capture: true });
    });
    // The first WebKit viewport can stall before its first animation frame on this host.
    if (name === 'webkit') {
      await page.goto('about:blank');
      await wakeDisplay(page);
    }
    await page.goto(url);
    await page.bringToFront();
    await waitForScreen(page, 'play');
    await readyToPaint(page, name);
    await controls(page, ['pause']);
    await sleep(3300);
    const initial = await state(page);
    assert.equal(initial.mode, 'campaign');
    assert.equal(initial.game.level, 1, 'a fresh save opens evening 1');
    assert.equal(initial.game.sheep.length, 12, 'evening 1 starts with twelve sheep');
    assert.equal(initial.game.time, 0, 'the evening starts on first input');
    assert.equal(initial.saved.unlocked, 1);
    assert.ok(await page.evaluate(() => window.flockGuideDraws > 0 && window.flockGuideMinAlpha >= 0.62),
      'the uphill route remains visible through the animated hand cycle');
    await screenshot(page, name, '01-first-evening');
    let input = await steering(page, name);
    const first = await beginner(page, input);
    await controls(page, ['next', 'retry', 'end-evenings']);
    await screenshot(page, name, '02-first-result');
    const won = await state(page);
    assert.equal(won.saved.unlocked, 2, 'winning evening 1 unlocks evening 2');
    assert.equal((await stored(page)).unlocked, 2);
    await page.tap('#retry');
    const retried = await state(page);
    assert.equal(retried.game.level, 1, 'retry keeps the current evening');
    assert.equal(retried.game.home, 0, 'retry resets arrivals');
    assert.equal(retried.game.time, 0, 'retry waits for input');
    const field = await page.locator('#field').boundingBox();
    await page.locator('#field').tap({ position: { x: field.width / 2, y: field.height * 414 / 520 } });
    const afterTap = await state(page);
    assert.ok(afterTap.game.started && !afterTap.pressed, 'a brief touch starts the field without a held gesture');
    const guideDraws = await page.evaluate(() => window.flockGuideDraws);
    await page.waitForFunction(n => window.flockGuideDraws > n + 1, guideDraws, { polling: 50, timeout: 5000 });
    await screenshot(page, name, '02a-guide-after-tap');
    const secondaryAt = await pauseAndRelease(page, input, name);
    const afterDrag = await page.evaluate(() => window.flockGuideDraws);
    await readyToPaint(page, name);
    assert.equal(await page.evaluate(() => window.flockGuideDraws), afterDrag, 'the guide stops after a steering drag');
    const pointers = await page.evaluate(() => window.flockCheckPointers);
    assert.ok(pointers.some(([type, trusted, primary]) => type === (name === 'webkit' ? 'mouse' : 'touch') && trusted && primary),
      'primary steering uses trusted browser input');
    assert.ok(pointers.some(([type, trusted, primary]) => type === 'touch' && trusted === (name === 'chromium') && !primary),
      'a distinct non-primary touch reached the field');
    const landscape = await rotateDuringSteering(page, input, name);

    await page.locator('#field').tap();
    const leaving = await state(page);
    assert.ok(leaving.game.time > 0, 'leaving interrupts a running evening');
    await page.goto(new URL('check-away.html', url).href);
    await page.goBack();
    await readyToPaint(page, name);
    const returned = await state(page);
    assert.ok(returned.screen === 'paused' || returned.game.level === 2 && returned.game.time === 0,
      'browser Back restores a paused field or reloads the highest unlocked evening');
    if (returned.screen === 'paused') await page.tap('#resume');
    if (!(await state(page)).game.started) await page.locator('#field').tap();
    assert.ok((await state(page)).game.time > 0, 'reload interrupts a running evening');

    await page.reload();
    await waitForScreen(page, 'play');
    await readyToPaint(page, name);
    assert.equal((await state(page)).game.level, 2, 'reload opens the highest unlocked evening');
    assert.equal((await state(page)).game.time, 0, 'reload clears the in-progress clock');
    await page.tap('#pause');
    await waitForScreen(page, 'paused');
    const soundOn = (await state(page)).saved.sound;
    await page.tap('#sound');
    assert.equal((await stored(page)).sound, !soundOn, 'sound preference saves');
    await page.tap('#evenings');
    await waitForScreen(page, 'evenings');
    await controls(page, ['endless', 'back']);
    assert.equal(await page.locator('#levels button:enabled').count(), 2, 'the menu offers the two unlocked evenings');
    await screenshot(page, name, '04-evenings');
    // Fix the single random draw that chooses the run seed for the playback.
    // The game simulates both waves normally from that seed and pointer input.
    await page.evaluate(() => {
      Object.defineProperty(crypto, 'getRandomValues', { configurable: true, value: array => {
        delete crypto.getRandomValues;
        array[0] = (1 - 2654435761) >>> 0;
        return array;
      } });
    });
    await page.tap('#endless');
    await waitForScreen(page, 'play');
    const endless = await state(page);
    assert.equal(endless.mode, 'endless');
    assert.equal(endless.wave, 1);
    assert.equal(endless.game.seed, 1, 'the endless playback uses the known seed');
    assert.equal(endless.game.sheep.length, 32, 'the first endless field has 32 sheep');
    await screenshot(page, name, '05-endless-field');
    input = await steering(page, name);
    const firstWave = await playWave(page, input, 0, true);
    await controls(page, ['next', 'retry', 'end-evenings']);
    await screenshot(page, name, '06-endless-first-result');
    await page.tap('#next');
    const second = await state(page);
    assert.equal(second.mode, 'endless');
    assert.equal(second.wave, 2);
    assert.equal(second.game.sheep.length, 36, 'the second wave adds four sheep');
    assert.equal(second.game.home, 0, 'the second wave starts with an empty fold');
    assert.equal(second.saved.best, 32, 'the endless count survives the change of wave');
    const secondWave = await playWave(page, input, 32, false);
    await page.tap('#pause');
    await waitForScreen(page, 'paused');
    const bestBeforeReload = (await state(page)).saved.best;
    await page.reload();
    await waitForScreen(page, 'play');
    await readyToPaint(page, name);
    assert.equal((await state(page)).saved.best, bestBeforeReload, 'endless best survives reload');
    assert.deepEqual(await stored(page), {
      v: 1, unlocked: 2, best: bestBeforeReload, sound: !soundOn, played: true,
    }, 'compatible save shape and persisted values');
    await page.tap('#pause');
    await page.tap('#evenings');
    assert.match(await page.locator('#record').textContent(), new RegExp(`\\b${bestBeforeReload}\\b`),
      'the menu displays the persisted endless best');

    // A progressed save opens evening ten for the second look and wolf warning.
    await page.evaluate(key => {
      const save = JSON.parse(localStorage.getItem(key));
      localStorage.setItem(key, JSON.stringify({ ...save, unlocked: 10 }));
    }, saveKey);
    await page.goto(`${url}?look=heather`);
    await waitForScreen(page, 'play');
    await readyToPaint(page, name);
    const late = (await state(page)).game;
    assert.equal(late.level, 10);
    assert.equal(late.seed, 10);
    assert.equal(late.sheep.length, 60);
    input = await steering(page, name);
    await input.down(1, late.dog.x, late.dog.y);
    await input.up(1);
    await page.waitForFunction(() => window.flockState().game.wolf?.phase === 'eyes', null, { polling: 30 });
    const warningAt = (await state(page)).game.time;
    await screenshot(page, name, '07-heather-wolf');
    assert.ok(assets.has('/notes/button.js'), 'the real notes button was served');
    assert.deepEqual(await page.evaluate(() => Object.keys(localStorage).filter(key =>
      key.startsWith('hf-lab-') && key !== 'hf-lab-send-localhost')), [], 'no lab player or telemetry state');
    assert.deepEqual(errors, [], 'browser errors');
    assert.deepEqual(outside, [], 'external requests');
    assert.deepEqual(telemetry, [], 'telemetry requests');
    console.log(JSON.stringify({ browser: name, device, first, secondaryAt, landscape, firstWave, secondWave, bestBeforeReload, warningAt,
      errors: errors.length, externalRequests: outside.length, telemetry: telemetry.length }));
    await context.close();
  } finally {
    await browser.close();
  }
}

try {
  for (const profile of profiles) {
    if (process.argv[2] && process.argv[2] !== profile.name) continue;
    try {
      await run(profile);
    } catch (error) {
      process.exitCode = 1;
      console.error(profile.name, error);
    }
  }
} finally {
  await new Promise(resolve => server.close(resolve));
}
