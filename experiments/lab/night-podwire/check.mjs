// Exercise the game through the board and its buttons. The view exposes observations only.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const experiments = resolve(here, '../..');
const route = '/lab/night-podwire/';
const progressKey = 'night-podwire:progress';
const shots = '/private/tmp/night-r4-review/podwire';
const modules = process.env.PLAYWRIGHT || join(homedir(), 'code/human-framework/node_modules');
const require = createRequire(join(resolve(modules), 'check.cjs'));
const { webkit, chromium, devices } = require('playwright');
const browserRequire = createRequire(require.resolve('playwright/package.json'));
const { PNG } = browserRequire('playwright-core/lib/utilsBundle');
const profiles = { webkit: [webkit, devices['iPhone 13']], chromium: [chromium, devices['Pixel 7']] };

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  let file;
  if (pathname === '/notes/button.js') file = resolve(experiments, '../workers/feedback/public/notes/button.js');
  else if (pathname.startsWith(route) || pathname.startsWith('/kit/')) {
    file = join(experiments, pathname, pathname.endsWith('/') ? 'index.html' : '');
  }
  try {
    if (!file) throw new Error('Unknown path');
    const body = await readFile(file);
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end();
  }
});

const view = page => page.evaluate(() => window.podwireView());
const boardRect = page => page.evaluate(() => document.querySelector('#board').getBoundingClientRect().toJSON());

async function wakeDisplay(page) {
  const viewport = page.viewportSize();
  await page.setViewportSize({ ...viewport, width: viewport.width + 1 });
  await delay(150);
  await page.setViewportSize(viewport);
}

async function shot(page, name) {
  // WebKit can return a blank compositor frame even after the board has drawn.
  // Validate the screenshot itself before keeping it as visual evidence.
  for (let attempt = 0; attempt < 3; attempt++) {
    const board = await boardRect(page);
    const bytes = await page.screenshot({ timeout: 90_000 });
    const image = PNG.sync.read(bytes);
    const scale = image.width / page.viewportSize().width;
    const sample = (x, y) => {
      const px = Math.floor((board.x + board.width * x) * scale);
      const py = Math.floor((board.y + board.height * y) * scale);
      return (py * image.width + px) * 4;
    };
    const paper = sample(.01, .01);
    let contrasting = 0;
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const i = sample((x + .5) / 64, (y + .5) / 64);
        const distance = [0, 1, 2].reduce((sum, k) => sum + Math.abs(image.data[i + k] - image.data[paper + k]), 0);
        if (distance > 50) contrasting++;
      }
    }
    if (contrasting >= 50) {
      await writeFile(join(shots, name + '.png'), bytes);
      return;
    }
    // Reattach the display link after a blank frame, then restore the exact profile.
    await wakeDisplay(page);
    await delay(200);
  }
  throw new Error(name + ': captured board is blank');
}
const ready = page => page.waitForFunction(() => window.podwireView?.().screen === 'play', null, { polling: 100 });

function timingSummary(samples) {
  samples.sort((a, b) => a - b);
  return { frames: samples.length, p95: +samples[Math.floor((samples.length - 1) * .95)].toFixed(2),
    max: +samples.at(-1).toFixed(2), over16_7ms: samples.filter(ms => ms > 16.7).length };
}

async function wirePoint(page, x, y) {
  const board = await boardRect(page);
  assert.ok(board.width > 0 && board.height > 0, 'board is visible');
  return { x: board.x + board.width * x / 360, y: board.y + board.height * y / 380 };
}

// Chromium provides native multi-step touch input through its debugging protocol.
// In WebKit a native mouse drag exercises browser hit testing and pointer capture.
async function finger(page, engine) {
  const session = engine === 'chromium' ? await page.context().newCDPSession(page) : null;
  let position;
  async function touch(type, points) {
    await session.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  }
  return {
    async pull(x = 180, depth = 83) {
      const wire = (await view(page)).wire;
      const node = (x - 24) / 6;
      const left = Math.floor(node);
      const height = wire[left] + (wire[left + 1] - wire[left]) * (node - left);
      position = await wirePoint(page, x, 250 + height);
      const bottom = await wirePoint(page, x, 250 + depth);
      if (session) {
        await touch('touchStart', [position]);
        for (let i = 1; i <= 8; i++) {
          await touch('touchMove', [{ x: position.x, y: position.y + (bottom.y - position.y) * i / 8 }]);
        }
      } else {
        await page.mouse.move(position.x, position.y);
        await page.mouse.down();
        await page.mouse.move(bottom.x, bottom.y, { steps: 8 });
      }
      position = bottom;
      assert.ok(Number.isInteger((await view(page)).grip), 'the string is held before release');
    },
    async release() {
      if (session) await touch('touchEnd', []);
      else await page.mouse.up();
    },
    async cancel() {
      if (session) await touch('touchCancel', []);
      else {
        // WebKit exposes no native cancel command. Cancel the captured mouse pointer.
        await page.locator('#board').dispatchEvent('pointercancel', {
          pointerId: await page.evaluate(() => window.checkPointerId), pointerType: 'mouse',
          isPrimary: true, clientX: position.x, clientY: position.y
        });
        await page.mouse.up();
      }
    }
  };
}

async function run(name, base) {
  const [engine, profile] = profiles[name];
  const browser = await engine.launch();
  try {
    console.log(name, 'starting');
    const context = await browser.newContext(profile);
    const errors = [], unapproved = [], assets = new Set();
    // Block unexpected requests before transmission, then fail the check.
    await context.route('**/*', async handler => {
      const request = handler.request(), url = new URL(request.url());
      const path = url.pathname;
      const allowed = path === route || path === '/notes/button.js' ||
        ((path.startsWith(route) || path.startsWith('/kit/')) && /\.(?:css|js)$/.test(path) && !path.endsWith('/lab.js'));
      if (url.origin !== base || request.method() !== 'GET' || !allowed) {
        unapproved.push(request.method() + ' ' + url.href);
        return handler.abort();
      }
      assets.add(path);
      return handler.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('response', response => { if (response.status() >= 400) errors.push(response.url() + ' ' + response.status()); });
    await page.addInitScript(() => {
      document.addEventListener('pointerdown', e => { window.checkPointerId = e.pointerId; }, true);
      const requestFrame = window.requestAnimationFrame.bind(window);
      let last;
      window.checkFrames = { work: [], intervals: [] };
      window.requestAnimationFrame = callback => {
        if (callback.name !== 'frame') return requestFrame(callback);
        return requestFrame(now => {
          const began = performance.now();
          callback(now);
          window.checkFrames.work.push(performance.now() - began);
          if (last !== undefined) window.checkFrames.intervals.push(now - last);
          last = now;
        });
      };
    });
    if (name === 'webkit') {
      // Wake the display link on this test host and restore the exact device viewport.
      await wakeDisplay(page);
    }
    const started = performance.now();
    await page.goto(base + route);
    if (name === 'webkit') await wakeDisplay(page);
    await ready(page);
    const hand = await finger(page, name);
    await page.waitForFunction(() => window.podwireView().cue);
    const start = await view(page);
    assert.deepEqual([start.level, start.opened, start.plucks], [1, 0, 0]);
    assert.match(await page.locator('meta[name=viewport]').getAttribute('content'), /maximum-scale=1/);
    await shot(page, name + '-01-opening');
    await hand.pull(180, 44);
    assert.equal((await view(page)).opened, 0, 'holding alone must not open a pod');
    await shot(page, name + '-02-held');
    await hand.release();
    await page.waitForFunction(() => window.podwireView().screen === 'won', null, { timeout: 60_000 });
    const seconds = (performance.now() - started) / 1000;
    const won = await view(page);
    assert.ok(seconds < 60, 'first win within sixty seconds of navigation');
    assert.equal(won.opened, won.total);
    assert.equal(won.plucks, 1);
    await shot(page, name + '-03-opened');
    console.log(name, 'first plate opened');
    const openingFrames = await page.evaluate(() => window.checkFrames);

    await page.tap('#next');
    await ready(page);
    assert.equal((await view(page)).level, 2, 'next starts the second level');
    await page.reload();
    await ready(page);
    assert.equal((await view(page)).level, 2, 'reload restores level two');
    await page.goto(base + route + '?look=blueprint');
    await ready(page);
    await shot(page, name + '-04-blueprint');

    // A shallow pluck in the left sleeve cannot reach the high pod on the right.
    await hand.pull(99, 12);
    await hand.release();
    assert.equal((await view(page)).plucks, 1);
    await page.tap('#pause');
    const paused = await view(page);
    assert.equal(paused.screen, 'paused');
    await shot(page, name + '-06-paused');
    await delay(300);
    assert.equal((await view(page)).time, paused.time, 'pause freezes the wire');
    await page.tap('#sound');
    assert.equal((await view(page)).sound, !paused.sound, 'sound switch works');
    await page.tap('#resume');
    await page.waitForFunction(t => window.podwireView().time > t, paused.time);
    await page.evaluate(() => dispatchEvent(new Event('blur')));
    assert.equal((await view(page)).screen, 'paused', 'leaving the page pauses play');
    await page.tap('#retry');
    await ready(page);
    assert.deepEqual([(await view(page)).level, (await view(page)).plucks], [2, 0]);
    await page.goto('about:blank');
    await page.goBack();
    await page.waitForFunction(() => window.podwireView?.().level === 2, null, { polling: 100 });
    if ((await view(page)).screen === 'paused') await page.tap('#resume');
    await ready(page);
    assert.equal((await view(page)).plucks, 0, 'returning to the game preserves the unlocked plate');
    await page.reload();
    await ready(page);
    assert.equal((await view(page)).sound, !paused.sound, 'sound preference survives reload');

    // A rotation changes the coordinate system of a held finger.
    const portrait = page.viewportSize();
    const portraitBoard = await boardRect(page);
    const landscape = devices[name === 'webkit' ? 'iPhone 13 landscape' : 'Pixel 7 landscape'].viewport;
    await hand.pull(99, 64);
    await page.setViewportSize(landscape);
    await page.waitForFunction(() => window.podwireView().grip === null, null, { polling: 100 });
    await hand.release();
    const landscapeBoard = await boardRect(page);
    assert.ok(landscapeBoard.height >= landscape.height - 24, 'landscape uses the screen height for the playable wire');
    assert.ok(landscapeBoard.y + landscapeBoard.height <= landscape.height, 'landscape board fits on screen');
    assert.deepEqual([(await view(page)).plucks, (await view(page)).opened], [0, 0],
      'rotating and lifting cannot release an accidental pluck');
    await shot(page, name + '-07-rotated');
    await hand.pull(99);
    await hand.release();
    await page.waitForFunction(() => window.podwireView().screen === 'won');
    assert.equal((await view(page)).plucks, 1, 'one deep pluck opens the remote pod');
    await shot(page, name + '-08-rotated-win');
    await page.setViewportSize(portrait);

    const campaign = [won.plucks, (await view(page)).plucks];
    for (let level = 3; level <= 6; level++) {
      await page.tap('#next');
      await ready(page);
      const plate = await view(page);
      assert.equal(plate.level, level);
      await shot(page, name + '-plate-' + level + '-start');
      if (level === 4) {
        await hand.pull(267, 86);
        await hand.release();
        await page.waitForFunction(() => window.podwireView().opened === 1);
        await shot(page, name + '-plate-4-partial');
        await page.reload();
        await ready(page);
        const replay = await view(page);
        assert.deepEqual([replay.level, replay.opened, replay.plucks], [4, 0, 0],
          'reload mid-plate restarts that attempt and keeps the unlocked plate');
      }
      // Pull each marked sleeve to y=368. Even if the wire has drifted across
      // the touch tolerance while the finger lands, this reaches full tension.
      for (const [low, high] of plate.zones) {
        await hand.pull((low + high) / 2, 118);
        await hand.release();
        const released = (await view(page)).time;
        await page.waitForFunction(t => {
          const state = window.podwireView();
          return state.screen === 'won' || state.time >= t + 1.5;
        }, released);
        if ((await view(page)).opened === plate.total) break;
        if (high !== plate.zones.at(-1)[1]) {
          // A host scheduling delay can otherwise move the struck wire away
          // between sampling its position and the browser delivering pointerdown.
          // Let the free wave decay before the next native grab.
          await page.waitForFunction(t => {
            const state = window.podwireView();
            return state.time >= t + 7.5 && state.wire.every(y => Math.abs(y) < 12);
          }, released, { timeout: 90_000 });
        }
      }
      assert.equal((await view(page)).opened, plate.total, 'plate ' + level + ' must open after its sleeves are plucked');
      await page.waitForFunction(() => window.podwireView().screen === 'won');
      const finished = await view(page);
      assert.equal(finished.opened, plate.total);
      campaign.push(finished.plucks);
      await shot(page, name + '-plate-' + level + '-end');
      console.log(name, 'plate', level, 'opened');
    }
    await shot(page, name + '-05-collection');
    const laterFrames = await page.evaluate(() => window.checkFrames);
    const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), progressKey);
    assert.equal(saved.complete, true, 'collecting every plate persists completion');
    assert.equal(saved.next, 6);
    await page.tap('#next');
    await ready(page);
    assert.equal((await view(page)).level, 1, 'play again returns to the first plate');
    await page.reload();
    await ready(page);
    assert.equal((await view(page)).level, 6, 'a finished collection retains the last plate after reload');

    await page.evaluate(key => localStorage.setItem(key, '{invalid'), progressKey);
    await page.reload();
    await ready(page);
    assert.equal((await view(page)).level, 1, 'invalid save recovers');
    const reverse = await page.evaluate(async () => {
      const { create, grab, pull, release, tick, at, BASE } = await import('./sim.js');
      const state = create(2, 834);
      const x = 99;
      grab(state, x, BASE);
      pull(state, BASE + 12);
      release(state);
      for (let i = 0; i < 6; i++) tick(state);
      const height = at(state, x);
      const previous = state.u.slice();
      grab(state, x, BASE + height);
      pull(state, BASE + height);
      return { height, released: release(state), plucks: state.plucks, restored: state.u.every((y, i) => y === previous[i]) };
    });
    assert.ok(reverse.height > 5, 'tap fixture starts on the downward deflection of the ringing wire');
    assert.deepEqual([reverse.released, reverse.plucks, reverse.restored], [false, 1, true],
      'a tap on the displaced wire neither plucks nor absorbs the previous wave');
    await hand.pull();
    await hand.cancel();
    const cancelled = await view(page);
    assert.deepEqual([cancelled.grip, cancelled.plucks], [null, 0]);
    await page.waitForFunction(t => window.podwireView().time > t + 0.8, cancelled.time);
    assert.equal((await view(page)).opened, 0, 'cancelled pull produces no seed burst');

    await page.tap('#pause');
    await page.evaluate(key => localStorage.setItem(key, JSON.stringify({ v: 1, next: 6, complete: true, sound: false })), progressKey);
    await page.tap('#sound');
    assert.deepEqual(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), progressKey),
      { v: 1, next: 6, complete: true, sound: true }, 'a stale tab sound tap preserves newer progress and toggles current sound');
    await page.evaluate(key => localStorage.removeItem(key), progressKey);

    // A blocked write still permits play and progression for this visit.
    await page.addInitScript(() => {
      Storage.prototype.setItem = () => { throw new DOMException('Store blocked', 'SecurityError'); };
    });
    await page.reload();
    await ready(page);
    await hand.pull();
    await hand.release();
    await page.waitForFunction(() => window.podwireView().screen === 'won');
    await page.tap('#next');
    await ready(page);
    assert.equal((await view(page)).level, 2);
    assert.match(await page.locator('#status').innerText(), /this visit/i, 'failed persistence is visible');
    assert.ok(assets.has('/notes/button.js'), 'tester notes script loaded');
    assert.deepEqual(errors, [], 'browser errors');
    assert.deepEqual(unapproved, [], 'unexpected requests');
    console.log(name, JSON.stringify({ firstWinSeconds: +seconds.toFixed(3), plucks: won.plucks,
      opened: won.opened, total: won.total, campaignPlucks: campaign,
      portraitBoardWidth: +portraitBoard.width.toFixed(2), landscapeBoardWidth: +landscapeBoard.width.toFixed(2),
      openingTiming: { work: timingSummary(openingFrames.work), intervals: timingSummary(openingFrames.intervals) },
      laterTiming: { work: timingSummary(laterFrames.work), intervals: timingSummary(laterFrames.intervals) },
      errors: errors.length, unexpectedRequests: unapproved.length }));
  } finally {
    await browser.close();
  }
}

const selected = process.argv.slice(2);
for (const name of selected) assert.ok(Object.hasOwn(profiles, name), 'unknown phone profile ' + name);
await mkdir(shots, { recursive: true });
await new Promise(done => server.listen(0, '127.0.0.1', done));
try {
  const base = 'http://127.0.0.1:' + server.address().port;
  for (const name of selected.length ? selected : Object.keys(profiles)) await run(name, base);
} finally {
  await new Promise(done => server.close(done));
}
