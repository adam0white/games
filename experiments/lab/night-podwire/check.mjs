// Exercise the game through the board and its buttons. The view exposes observations only.
import { answerLab, assertNotice, assertRun, assertOffSendsNothing, waitForRuns } from '../../kit/check/lab-record.mjs';
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
const progressKey = 'night-podwire:progress', bookKey = 'night-podwire:book', dayKey = 'night-podwire:daily';
const shots = process.env.SHOTS || '/private/tmp/night-r4-review/podwire';
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
// Every save this page writes: the shipped progress key and the two new ones.
const clearSaves = page => page.evaluate(keys => keys.forEach(k => localStorage.removeItem(k)), [progressKey, bookKey, dayKey]);

// A player who only copies the drawn finger: find the cue's target dot (the lowest blush-red pixels under the
// wire) on the canvas itself, grab the wire above it and pull down to it.
async function copyDrawnFinger(page) {
  const handle = await page.waitForFunction(() => {
    const board = document.querySelector('#board'), c = board.getContext('2d');
    const { width, height } = board, data = c.getImageData(0, 0, width, height).data;
    const sx = width / 360, sy = height / 380;
    let best = null;
    for (let wy = 262; wy < 372; wy += .5) for (let wx = 30; wx < 330; wx += .5) {
      const i = (Math.round(wy * sy) * width + Math.round(wx * sx)) * 4;
      if (Math.abs(data[i] - 0xb6) < 26 && Math.abs(data[i + 1] - 0x51) < 26 && Math.abs(data[i + 2] - 0x32) < 26) best = { x: wx, y: wy };
    }
    return best;
  }, null, { polling: 100, timeout: 30_000 });
  return handle.jsonValue();
}

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
        ((path.startsWith(route) || path.startsWith('/kit/')) && /\.(?:css|js)$/.test(path));
      if (url.origin !== base || request.method() !== 'GET' || !allowed) {
        unapproved.push(request.method() + ' ' + url.href);
        return handler.abort();
      }
      assets.add(path);
      return handler.continue();
    });
    // The lab endpoint is answered here (registered after the catch-all, so it takes lab requests first).
    const lab = await answerLab(context, base);
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
    // Changed on purpose: plates VII-XVIII follow plate VI, so Next goes on instead of back to plate I.
    await page.tap('#next');
    await ready(page);
    assert.equal((await view(page)).level, 7, 'next after plate VI opens plate VII');
    await page.reload();
    await ready(page);
    assert.equal((await view(page)).level, 7, 'the book of plates keeps plate VII after reload');

    // A save from before the eighteen plates (only the shipped key) loads and continues at plate VII.
    await page.evaluate(([key, book]) => { localStorage.setItem(key, JSON.stringify({ v: 1, next: 6, complete: true, sound: true })); localStorage.removeItem(book); }, [progressKey, bookKey]);
    await page.reload();
    await ready(page);
    assert.equal((await view(page)).level, 7, 'an old finished save continues at plate VII');
    assert.equal(await page.locator('#marks .done').count(), 6, 'an old finished save shows six plates done');
    // VII: a pull at the drawn grip sounds the second harmonic and opens the tuned pod.
    const seventh = await view(page);
    assert.equal(seventh.pods[0].type, 'tuned');
    await hand.pull(100, 118);
    await hand.release();
    await page.waitForFunction(() => window.podwireView().screen === 'won', null, { timeout: 20_000 });
    assert.match(await page.locator('#count').innerText(), /1 pluck · par 1/);
    await shot(page, name + '-plate-7-end');
    // XVII: a tap on the brass peg clamps the wire; a pull left of it leaves the right side still.
    await page.evaluate(book => localStorage.setItem(book, JSON.stringify({ v: 1, reached: 17, done: false, best: {} })), bookKey);
    await page.reload();
    await ready(page);
    assert.equal((await view(page)).level, 17);
    const peg = (await view(page)).frets[0];
    await page.tap('#board', { position: await page.evaluate(([x]) => { const r = document.querySelector('#board').getBoundingClientRect(); return { x: r.width * x / 360, y: r.height * 304 / 380 }; }, [peg.x]) });
    assert.equal((await view(page)).frets[0].on, true, 'a tap on the peg clamps the wire');
    await hand.pull(84, 118);
    await hand.release();
    assert.equal((await view(page)).plucks, 1, 'the pull beside the clamped fret plucks');
    let farSide = 0, nearSide = 0;
    for (let k = 0; k < 10; k++) {
      await delay(120);
      const wire = (await view(page)).wire;
      farSide = Math.max(farSide, ...wire.slice(28, 52).map(Math.abs));
      nearSide = Math.max(nearSide, ...wire.slice(1, 26).map(Math.abs));
    }
    assert.ok(nearSide > 10, 'the near side rings (' + nearSide + ')');
    assert.ok(farSide < 1, 'the wire beyond the clamped fret stays still (' + farSide + ')');
    await shot(page, name + '-plate-17-fret');
    // The language switch on the pause card turns the plate heading Turkish and back.
    await page.tap('#pause');
    await page.tap('#lang');
    assert.match(await page.locator('#number').innerText(), /Levha XVII \/ XVIII/i);
    assert.equal((await view(page)).lang, 'tr');
    await shot(page, name + '-09-paused-tr');
    await page.tap('#lang');
    assert.match(await page.locator('#number').innerText(), /Plate XVII of XVIII/i);
    await page.tap('#resume');

    // Today's plate: the same plate and par for everyone on a date; the result can be shared.
    await page.goto(base + route + '?daily&date=2026-12-04');
    await ready(page);
    const day = await view(page);
    assert.deepEqual([day.mode, day.level], ['daily', 8], 'the daily plate for 2026-12-04 is plate VIII for everyone');
    await page.waitForFunction(() => window.podwireView().par !== null, null, { timeout: 30_000 });
    assert.equal((await view(page)).par, 1, 'the daily par is worked out in the page');
    await hand.pull(74, 118);
    await hand.release();
    await page.waitForFunction(() => window.podwireView().screen === 'won', null, { timeout: 20_000 });
    assert.match(await page.locator('#count').innerText(), /1 pluck · par 1/);
    assert.equal(await page.locator('#share').isVisible(), true);
    await shot(page, name + '-10-daily-end');
    await page.tap('#share');
    await page.waitForFunction(() => document.querySelector('#status').textContent !== '');
    const daySaved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), dayKey);
    assert.deepEqual(daySaved.days['2026-12-04'], { plucks: 1, par: 1 });
    assert.match(await page.locator('#today').innerText(), /✓/);
    // A second go at today's plate is practice: the first result stands.
    await page.tap('#next');
    await ready(page);
    assert.equal((await view(page)).mode, 'plates', 'Plates leaves today\'s plate');
    await page.tap('#today');
    await ready(page);
    assert.equal((await view(page)).mode, 'daily');
    await hand.pull(74, 118);
    await hand.release();
    await page.waitForFunction(() => window.podwireView().screen === 'won', null, { timeout: 20_000 });
    assert.match(await page.locator('#status').innerText(), /first result today stands/);
    assert.deepEqual((await page.evaluate(key => JSON.parse(localStorage.getItem(key)), dayKey)).days['2026-12-04'], { plucks: 1, par: 1 });

    // The first ten seconds, played only from the picture: copy the drawn finger's target on a fresh save.
    await clearSaves(page);
    const fresh = performance.now();
    await page.goto(base + route);
    if (name === 'webkit') await wakeDisplay(page);
    await ready(page);
    const target = await copyDrawnFinger(page);
    assert.ok(target, 'the drawn target can be found on the canvas');
    await hand.pull(target.x, target.y - 6);
    await hand.release();
    await page.waitForFunction(() => window.podwireView().opened > 0, null, { timeout: 30_000 });
    const copySeconds = (performance.now() - fresh) / 1000;
    console.log(name, 'copying the drawn finger opened the first pod after', copySeconds.toFixed(1), 's at', JSON.stringify(target));

    await page.evaluate(([key, book]) => { localStorage.setItem(key, '{invalid'); localStorage.setItem(book, '{invalid'); }, [progressKey, bookKey]);
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
    await clearSaves(page);

    // Play recording: the notice is on the page before the first pull; a won plate sends one run record under
    // 'night-podwire'; with the switch off in the pause card the next plate sends nothing.
    assert.equal(lab.sent.length, 0, 'nothing was sent by the checks above (nothing sends from localhost unless allowed)');
    await page.evaluate(() => localStorage.setItem('hf-lab-send-localhost', '1'));
    await page.goto(base + route + '?labRunSource=agent');
    await ready(page);
    await assertNotice(page);
    assert.equal(lab.sent.length, 0, 'nothing is sent before the first pull');
    await hand.pull();
    await hand.release();
    await page.waitForFunction(() => window.podwireView().screen === 'won');
    await waitForRuns(lab, 'night-podwire', 1);
    const recorded = assertRun(lab, 'night-podwire', { outcomes: ['won'], summaryKeys: ['plate', 'plucks', 'opened'] });
    assert.deepEqual(recorded.data.events.map(e => e.type), ['plate-complete']);
    assert.equal(recorded.data.summary.mode, 'plates');
    // The daily plate is recorded the same way, marked with its mode and par.
    await page.goto(base + route + '?labRunSource=agent&daily&date=2026-12-04');
    await ready(page);
    await page.waitForFunction(() => window.podwireView().par !== null, null, { timeout: 30_000 });
    await hand.pull(74, 118);
    await hand.release();
    await page.waitForFunction(() => window.podwireView().screen === 'won', null, { timeout: 20_000 });
    await waitForRuns(lab, 'night-podwire', 2);
    const dailyRun = assertRun(lab, 'night-podwire', { outcomes: ['won'], count: 2, summaryKeys: ['plate', 'plucks', 'mode', 'par'] });
    assert.deepEqual([dailyRun.data.summary.mode, dailyRun.data.summary.plate, dailyRun.data.summary.par], ['daily', 8, 1]);
    await clearSaves(page);
    await page.goto(base + route + '?labRunSource=agent');
    await page.reload();
    await ready(page);
    await page.tap('#pause');
    await assertOffSendsNothing(page, lab, 'night-podwire', { play: async () => {
      await page.tap('#resume');
      await hand.pull();
      await hand.release();
      await page.waitForFunction(() => window.podwireView().screen === 'won');
    } });
    await clearSaves(page);
    await page.evaluate(() => localStorage.removeItem('hf-lab-recording-off'));

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
    // Frame budget at 390x844 on both engines: today's par being worked out inside the frame, then a ringing wire.
    const budgetContext = await browser.newContext({ ...profile, viewport: { width: 390, height: 844 } });
    const budget = await budgetContext.newPage();
    await budget.addInitScript(() => {
      const requestFrame = window.requestAnimationFrame.bind(window);
      window.checkFrames = { work: [] };
      window.requestAnimationFrame = callback => callback.name !== 'frame' ? requestFrame(callback)
        : requestFrame(now => { const began = performance.now(); callback(now); window.checkFrames.work.push(performance.now() - began); });
    });
    await budget.goto(base + route + '?daily&date=2026-11-27');
    if (name === 'webkit') await wakeDisplay(budget);
    await ready(budget);
    await budget.waitForFunction(() => window.podwireView().par !== null, null, { timeout: 30_000 });
    const budgetHand = await finger(budget, name);
    await budgetHand.pull(186, 118);
    await budgetHand.release();
    await delay(3000);
    const budgetFrames = timingSummary((await budget.evaluate(() => window.checkFrames.work)).slice(5));
    await budgetContext.close();
    assert.ok(budgetFrames.p95 < 8, 'page work per frame at 390x844 stays under 8 ms (p95 ' + budgetFrames.p95 + ')');

    console.log(name, JSON.stringify({ budget390x844: budgetFrames, firstWinSeconds: +seconds.toFixed(3), plucks: won.plucks,
      opened: won.opened, total: won.total, campaignPlucks: campaign,
      portraitBoardWidth: +portraitBoard.width.toFixed(2), landscapeBoardWidth: +landscapeBoard.width.toFixed(2),
      openingTiming: { work: timingSummary(openingFrames.work), intervals: timingSummary(openingFrames.intervals) },
      laterTiming: { work: timingSummary(laterFrames.work), intervals: timingSummary(laterFrames.intervals) },
      copySeconds: +copySeconds.toFixed(1), errors: errors.length, unexpectedRequests: unapproved.length }));
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
