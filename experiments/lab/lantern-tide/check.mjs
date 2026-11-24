import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { ride, steer } from './bots.mjs';
import { DT, SECOND_SEED } from './sim.js';

const delayed = ride(SECOND_SEED, true, 2, 1);
assert.equal(delayed.over, 'dawn', 'the last night tolerates a 100 ms steering delay');
console.log('Night 2 with 100 ms steering delay:', +delayed.t.toFixed(2), 's');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const shots = await mkdtemp(join(tmpdir(), 'lantern-tide-check-'));
console.log('Screenshots:', shots);
const prefix = '/lab/lantern-tide/';
const fallback = join(homedir(), 'code/human-framework/node_modules');
const requirePlaywright = createRequire(join(resolve(process.env.PLAYWRIGHT || fallback), 'check.cjs'));
const { chromium, devices, webkit } = requirePlaywright('playwright');
const { PNG } = createRequire(requirePlaywright.resolve('playwright'))('playwright-core/lib/utilsBundle');
const profiles = [
  ['webkit', webkit, 'iPhone 13'],
  ['chromium', chromium, 'Pixel 7'],
];
const types = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.css': 'text/css' };
const allowed = /^(?:\/lab\/lantern-tide\/|\/kit\/)[\w.-]+$|^\/lantern\/sim\.js$|^\/notes\/button\.js$/;
const notes = resolve(root, '../workers/feedback/public/notes/button.js');
const server = createServer(async (request, response) => {
  const { pathname } = new URL(request.url, 'http://localhost');
  const path = pathname === prefix ? pathname + 'index.html' : pathname;
  if (path === '/favicon.ico') { response.writeHead(204).end(); return; }
  try {
    if (!allowed.test(path)) throw new Error('unknown asset');
    const data = await readFile(path === '/notes/button.js' ? notes : join(root, path));
    response.writeHead(200, { 'content-type': types[extname(path)], 'cache-control': 'no-store' }).end(data);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
const url = `http://127.0.0.1:${server.address().port}${prefix}`;
const state = page => page.evaluate(() => window.tideState());
const screen = (page, expected) => page.waitForFunction(name => window.tideState?.().screen === name, expected, { polling: 40 });

async function touchDriver(page, browser) {
  const session = browser === 'chromium' ? await page.context().newCDPSession(page) : null;
  const event = (type, x, y) => session.send('Input.dispatchTouchEvent', {
    type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
  });
  let held = false, startX, startBoat, hearts;
  return {
    async drag(view, target) {
      const [x, y] = view.point;
      if (!session) return page.mouse.move(x + (target - view.game.river.x) * view.scale, y);
      // A hit re-anchors the shared drag. Begin a fresh gesture there.
      if (held && (hearts !== view.game.river.hearts || Math.abs(target - startBoat) * view.scale / 1.3 > startX * .8)) {
        await this.release();
      }
      if (!held) {
        await page.evaluate(() => { window.checkTouchAnchor = null; });
        await event('touchStart', page.viewportSize().width / 2, y);
        held = true;
        const anchor = await page.waitForFunction(() => window.checkTouchAnchor, null, { polling: 10, timeout: 2000 });
        ({ x: startX, boat: startBoat, hearts } = await anchor.jsonValue());
        await anchor.dispose();
      }
      const next = startX + (target - startBoat) * view.scale / 1.3;
      await event('touchMove', next, y);
    },
    async release() {
      if (held) { await event('touchEnd'); held = false; }
    },
  };
}

function advanceAfterSteering(page, desired, tolerance) {
  return page.evaluate(async ({ desired, tolerance }) => {
    const aimed = () => Math.abs(window.tideState().target - desired) <= tolerance;
    if (!aimed()) {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          window.removeEventListener('pointermove', received);
          reject(new Error(`canvas did not receive steering target ${desired}`));
        }, 2000);
        function received(event) {
          if (!event.isTrusted || event.target.id !== 'river' || !aimed()) return;
          clearTimeout(timeout);
          window.removeEventListener('pointermove', received);
          resolve();
        }
        window.addEventListener('pointermove', received);
      });
    }
    window.checkClock.advance(1);
    return window.tideState();
  }, { desired, tolerance });
}

async function crossing(page, input, night, browserName, launch) {
  const started = Date.now();
  const margin = night === 2 ? { bankMargin: .038, rockMargin: .055, samples: 15 } : undefined;
  let moves = 0, batches = 0;
  // Hold frames until the normal pointer handler has received the command.
  await page.evaluate(() => window.checkClock.hold());
  try {
    await launch();
    let lastFrame = Date.now();
    let view = await state(page);
    while (Date.now() - started < 60000) {
      assert.equal(view.night, night, 'the pointer crossing starts on the requested night');
      const { game, screen: showing } = view;
      const s = game.river;
      if (s.over) {
        if (s.over === 'dawn' && night === 1) {
          assert.equal(await page.evaluate(() => localStorage.getItem('lantern-tide:night')), '2',
            'the unlock is saved at dawn, before the result card');
        }
        if (night === 1) await sleep(650);
        await page.evaluate(() => window.checkClock.advance(7));
        await screen(page, 'end');
        assert.equal(s.over, 'dawn', `night ${night} through pointer input (reached ${s.y.toFixed(2)})`);
        assert.ok(s.t < 60, `night ${night} finishes in under a simulated minute`);
        assert.ok(Date.now() - started < 60000, `night ${night} finishes in under a wall-clock minute`);
        assert.ok(game.rested > 0, 'an eddy relit the wick');
        return { seconds: +s.t.toFixed(2), wall: +((Date.now() - started) / 1000).toFixed(2), moves,
          embers: s.taken, lives: s.hearts, relit: +game.rested.toFixed(3) };
      }
      assert.equal(showing, 'play');
      assert.equal(Math.round(s.t / DT), batches * 6, 'steering samples are six ticks apart');
      const desired = steer(game, true, margin);
      // Below one CSS pixel of input travel, keep the previous target.
      const tolerance = (browserName === 'chromium' ? 1.3 : 1) / view.scale;
      if (Math.abs(view.target - desired) > tolerance) {
        await input.drag(view, desired);
        moves++;
      }
      // Keep the opening at real-time pace while allowing slow input to arrive.
      const wait = lastFrame + 100 - Date.now();
      if (night === 1 && wait > 0) await sleep(wait);
      lastFrame = Date.now();
      view = await advanceAfterSteering(page, desired, tolerance);
      batches++;
    }
    assert.fail(`night ${night} did not end within one minute`);
  } finally {
    try {
      await input.release();
    } finally {
      await page.evaluate(() => window.checkClock.resume());
    }
  }
}

async function wakeDisplay(page) {
  const viewport = page.viewportSize();
  await page.bringToFront();
  await page.setViewportSize({ ...viewport, width: viewport.width + 1 });
  await sleep(150);
  await page.setViewportSize(viewport);
}

async function paint(page, browserName) {
  const nextFrame = async () => {
    const frame = await page.evaluate(() => {
      const count = window.checkFrames;
      if (window.checkClock.held()) window.checkClock.advance(2);
      return count;
    });
    await page.waitForFunction(n => window.checkFrames >= n + 2, frame, { polling: 40, timeout: 4000 });
  };
  try {
    await nextFrame();
  } catch (error) {
    if (browserName !== 'webkit' || error.name !== 'TimeoutError') throw error;
    // The headless WebKit display link can stall at the first viewport.
    await wakeDisplay(page);
    await nextFrame();
  }
}

async function screenshot(page, browserName, name) {
  for (let attempt = 0; attempt < 3; attempt++) {
    let bytes;
    try {
      bytes = await page.screenshot({ scale: 'css', fullPage: browserName === 'webkit', timeout: 12000 });
    } catch (error) {
      if (browserName !== 'webkit' || error.name !== 'TimeoutError' || attempt === 2) throw error;
      await wakeDisplay(page);
      await paint(page, browserName);
      continue;
    }
    const { data } = PNG.sync.read(bytes);
    let dark = 765, light = 0;
    for (let i = 0; i < data.length; i += 68) {
      const brightness = data[i] + data[i + 1] + data[i + 2];
      dark = Math.min(dark, brightness);
      light = Math.max(light, brightness);
    }
    if (light - dark > 100) {
      await writeFile(join(shots, `${browserName}-${name}.png`), bytes);
      return;
    }
    await wakeDisplay(page);
    await paint(page, browserName);
  }
  assert.fail(`${browserName} ${name}: screenshot remained blank`);
}

async function check(engine, browserName, device) {
  const awake = browserName === 'webkit' && process.platform === 'darwin'
    ? spawn('/usr/bin/caffeinate', ['-diu', '-w', String(process.pid)], { stdio: 'ignore' })
    : null;
  let browser;
  try {
    browser = await engine.launch({ headless: true });
    const context = await browser.newContext(devices[device]);
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    await page.addInitScript(frameMs => {
      const nativeFrame = window.requestAnimationFrame.bind(window);
      let time, previous, held = false, nextId = 0;
      const callbacks = new Map();
      window.requestAnimationFrame = callback => {
        callbacks.set(++nextId, callback);
        return nextId;
      };
      window.cancelAnimationFrame = id => { callbacks.delete(id); };
      function frame(at) {
        time = at;
        for (const id of [...callbacks.keys()]) {
          const callback = callbacks.get(id);
          callbacks.delete(id);
          callback?.(at);
        }
      }
      nativeFrame(function pump(now) {
        nativeFrame(pump);
        if (!held) frame(time === undefined ? now : time + (now - previous));
        previous = now;
      });
      window.checkClock = {
        held() { return held; },
        hold() { held = true; },
        advance(count) {
          for (let i = 0; i < count; i++) frame(time + frameMs);
        },
        resume() { held = false; },
      };

      window.checkFrames = 0;
      requestAnimationFrame(function count() { window.checkFrames++; requestAnimationFrame(count); });
      window.checkRiverPaints = null;
      const { fillRect } = CanvasRenderingContext2D.prototype;
      CanvasRenderingContext2D.prototype.fillRect = function (x, y, width, height) {
        if (window.checkRiverPaints !== null && this.canvas.id === 'river' && x === 0 && y === 0
            && width === this.canvas.clientWidth && height === this.canvas.clientHeight) {
          window.checkRiverPaints++;
        }
        return fillRect.call(this, x, y, width, height);
      };
      // The kit anchors at pointerdown. The boat may move between a host poll and touch dispatch.
      addEventListener('pointerdown', event => {
        if (!event.isTrusted || !event.isPrimary || event.pointerType !== 'touch' || event.target.id !== 'river') return;
        const { x, hearts } = window.tideState().game.river;
        window.checkTouchAnchor = { x: event.clientX, boat: x, hearts };
      }, true);
    }, DT * 6000 + .000001); // Hit the game's 100 ms frame cap despite timestamp rounding.
    const bad = [], outside = [];
    page.on('pageerror', error => bad.push(error.message));
    page.on('response', response => { if (response.status() >= 400) bad.push(response.status() + ' ' + response.url()); });
    page.on('request', request => { if (!request.url().startsWith(new URL(url).origin + '/')) outside.push(request.url()); });
    const shot = name => screenshot(page, browserName, name);
    await page.goto(url + '?check=1&look=mauve');
    await screen(page, 'ready');
    await paint(page, browserName);
    assert.equal((await state(page)).look, 'mauve');
    await shot('mauve');
    await page.goto(url + '?check=1');
    await screen(page, 'ready');
    await paint(page, browserName);
    const button = await page.locator('#start').boundingBox();
    const viewport = page.viewportSize();
    assert.ok(button && button.width >= 44 && button.y + button.height < viewport.height, 'launch fits the phone');
    assert.equal(await page.locator('#notes-button').count(), 0, 'feedback is private by default');
    await shot('opening');
    assert.equal((await state(page)).game.river.t, 0, 'the river waits for the player');

    const landscape = { width: viewport.height, height: viewport.width };
    await page.setViewportSize(landscape);
    await paint(page, browserName);
    const title = await page.locator('#title').boundingBox();
    assert.ok(title.y + title.height + 24 <= (await state(page)).point[1], 'the landscape title clears the lantern');
    await shot('landscape-opening');
    await page.setViewportSize({ width: 568, height: 280 });
    const shortLaunch = await page.locator('#start').boundingBox();
    assert.ok(shortLaunch.y + shortLaunch.height <= 272, 'the launch button fits a short landscape viewport');
    await shot('short-landscape-opening');
    await page.setViewportSize(viewport);
    await paint(page, browserName);

    // Keep the live scene from drifting while capturing the hint and drag.
    await page.evaluate(() => window.checkClock.hold());
    await page.locator('#start').tap();
    await page.touchscreen.tap(viewport.width / 2, viewport.height * .8);
    assert.equal(await page.evaluate(() => localStorage.getItem('lantern-tide:hint')), null,
      'a stationary tap does not count as steering');
    await page.evaluate(() => window.checkClock.advance(16));
    await page.locator('.kit-hint.on .knob').waitFor({ state: 'visible' });
    await shot('steering-hint');
    const input = await touchDriver(page, browserName);
    const before = await state(page);
    await input.drag(before, before.game.river.x + .12);
    await page.waitForFunction(x => window.tideState().target > x + .08, before.game.river.x);
    await page.evaluate(() => {
      addEventListener('resize', () => {
        const { game, target } = window.tideState();
        window.checkResize = [target, game.river.x];
      }, { once: true });
    });
    await page.setViewportSize(landscape);
    await page.waitForFunction(() => window.checkResize, null, { polling: 40 });
    const [rotatedTarget, rotatedBoat] = await page.evaluate(() => window.checkResize);
    assert.equal(rotatedTarget, rotatedBoat, 'rotation releases the old steering target');
    await input.release();
    await page.setViewportSize(viewport);
    await paint(page, browserName);
    await shot('current');
    assert.equal(await page.evaluate(() => localStorage.getItem('lantern-tide:hint')), '1');
    await page.keyboard.press('Escape');
    await screen(page, 'paused');
    await page.evaluate(() => window.checkClock.resume());
    const paused = (await state(page)).game.river;
    const pausedPaints = await page.evaluate(() => (window.checkRiverPaints = 0));
    await sleep(240);
    assert.deepEqual((await state(page)).game.river, paused, 'pause freezes the river');
    assert.equal(await page.evaluate(() => window.checkRiverPaints), pausedPaints, 'the paused canvas does not repaint');
    await page.locator('#sound').tap();
    assert.equal(await page.locator('#sound').getAttribute('aria-pressed'), 'false');
    await shot('paused');
    await page.setViewportSize(landscape);
    await paint(page, browserName);
    assert.ok(await page.evaluate(() => window.checkRiverPaints) > pausedPaints, 'rotation repaints the paused river');
    await page.evaluate(() => { window.checkRiverPaints = null; });
    assert.deepEqual((await state(page)).game.river, paused, 'rotation preserves the paused simulation');
    await shot('landscape-paused');
    await page.setViewportSize(viewport);
    await page.locator('#resume').tap();
    await page.waitForFunction(t => window.tideState().game.river.t > t, paused.t);
    await page.evaluate(() => {
      addEventListener('pagehide', () => sessionStorage.setItem('lantern-tide:check-left', window.tideState().screen), { once: true });
    });
    await page.goto(url + '?check=1&look=mauve');
    assert.equal(await page.evaluate(() => sessionStorage.getItem('lantern-tide:check-left')), 'paused',
      'leaving the page through navigation pauses live play');
    await page.goBack();
    if ((await state(page)).screen === 'ready') await page.locator('#start').tap();
    else await page.locator('#resume').tap();
    await page.locator('#pause').tap();
    const result = await crossing(page, input, 1, browserName, () => page.locator('#restart').tap());
    assert.equal(await page.locator('#result').textContent(), 'Dawn');
    await shot('dawn');
    await page.locator('#next').tap();
    assert.equal((await state(page)).night, 2);
    assert.equal(await page.evaluate(() => localStorage.getItem('lantern-tide:night')), '2');
    await page.waitForFunction(() => window.tideState().game.river.t >= .3);
    await page.reload();
    await screen(page, 'ready');
    assert.equal((await state(page)).night, 2, 'the second night is saved');
    assert.equal((await state(page)).game.river.t, 0, 'reloading mid-crossing restarts at launch');
    await page.locator('#start').tap();
    await page.locator('#pause').tap();
    assert.equal(await page.locator('#sound').getAttribute('aria-pressed'), 'false', 'mute is saved');
    await page.locator('#other-night').tap();
    assert.equal((await state(page)).night, 1, 'the opening remains playable after unlocking night 2');
    assert.equal(await page.evaluate(() => localStorage.getItem('lantern-tide:night')), '2', 'replaying preserves the unlock');
    await page.locator('#pause').tap();
    const second = await crossing(page, input, 2, browserName, () => page.getByRole('button', { name: 'Sail second night' }).tap());
    assert.equal(await page.locator('#result').textContent(), 'Dawn');
    assert.ok(await page.locator('#next').isHidden(), 'the last night has no further level');
    await shot('last-dawn');
    await page.locator('#again').tap();
    assert.equal((await state(page)).night, 2, 'sail again repeats the last night');
    await screen(page, 'end');
    assert.equal(await page.locator('#again').textContent(), 'Try again', 'a loss offers a retry');
    await shot('lost');
    await page.locator('#again').tap();
    await screen(page, 'play');
    assert.equal((await state(page)).night, 2, 'retry repeats the lost night');
    await page.goto(url + '?check=1&tide=0');
    await screen(page, 'ready');
    assert.equal((await state(page)).game.tide, false);
    await page.evaluate(() => localStorage.setItem('notes.k', 'test'));
    await page.reload();
    const feedback = new URL(await page.locator('#notes-button').getAttribute('href'), url);
    assert.equal(feedback.pathname, '/notes/');
    assert.equal(feedback.searchParams.get('game'), 'lab');
    assert.deepEqual(bad, []);
    assert.deepEqual(outside, [], 'no outside requests in play');
    console.log(`${browserName} / ${device}`, { first: result, second });
  } finally {
    await browser?.close();
    awake?.kill();
  }
}

try {
  const filter = process.argv[2];
  assert.ok(!filter || profiles.some(([name]) => name === filter), 'expected webkit or chromium');
  for (const [name, engine, device] of profiles) {
    if (!filter || name === filter) await check(engine, name, device);
  }
} finally {
  await new Promise(done => server.close(done));
}
