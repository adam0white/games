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
const shots = process.env.SHOTS || '/tmp/claude-improve-night-sand/check';
import { assertHomeLinks } from '../../kit/check/home-link.mjs';
import { answerLab, withAgent, assertNotice, assertRun, assertOffSendsNothing, assertNoLeak, waitForRuns } from '../../kit/check/lab-record.mjs';
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
  || path.startsWith('/kit/') || path === '/favicon.ico';
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
  // The lab endpoint is answered here (registered after the catch-all, so it wins): no check reaches the real one.
  const lab = await answerLab(context, origin);
  await context.addInitScript(() => {
    if (location.protocol !== 'http:') return;
    localStorage.setItem('hf-lab-send-localhost', '1');
    window.sandCheckPointers = [];
    // Stand in for the phone's share sheet: keep what the page hands over.
    window.sandShared = [];
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: data => Boolean(data?.files?.length) });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async data => {
      const file = data.files[0];
      const head = Array.from(new Uint8Array(await file.slice(0, 8).arrayBuffer()));
      window.sandShared.push({ name: file.name, type: file.type, size: file.size, text: data.text, head });
    } });
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
  page.lab = lab;
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

// The informed player: each stroke follows the live hint, which starts on sand that is there now.
async function follow(page, stroke, { strokes = 16, settle = 420 } = {}) {
  for (let n = 0; n < strokes; n++) {
    const now = await state(page);
    if (now.status !== 'play' || now.screen !== 'play') break;
    const { x, y, toX, toY } = now.hint;
    await stroke(x, y, toX, toY);
    // Let the sand come to rest and the goal hold before the next stroke, as a player watching would.
    await delay(settle);
    await page.waitForFunction(() => { const s = window.sandState(); return s.status !== 'play' || (s.flow === 0 && s.load === 0); },
      null, { polling: 40, timeout: 8000 }).catch(() => {});
    await delay(700);
  }
  await screen(page, 'result');
}

// Bed 3: open the board, wait for the lower bulb, then slide it back before the upper mark.
async function stopGlass(page, stroke) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const now = await state(page);
    if (now.status !== 'play' || now.screen !== 'play') break;
    const { x, y, toX, toY } = now.hint;
    await stroke(x, y, toX, toY, { steps: 8, dwell: 30 });
    await delay(300);
    // The hint starts at the board; far from the throat means the board is open.
    if (Math.abs((await state(page)).hint.x - 60) > 10) {
      await page.waitForFunction(() => window.sandState().status !== 'play' || window.sandState().progress >= 0.95,
        null, { polling: 20, timeout: 14000 });
    } else {
      await page.waitForFunction(() => window.sandState().screen === 'result', null, { polling: 50, timeout: 2500 }).catch(() => {});
    }
  }
  await screen(page, 'result');
}

// A played bed sends one run record under the page's name; with the switch off nothing is sent.
async function recording(profile, origin, browser, errors, requests) {
  const { name, device } = profile;
  const context = await browser.newContext({ ...devices[device], serviceWorkers: 'block' });
  const page = await instrument(context, origin, errors, requests);
  const lab = page.lab;
  await page.goto(withAgent(origin + pagePath));
  await screen(page, 'play');
  await waitForFrames(page, name);
  await assertNotice(page);
  const stroke = await controls(page, name);
  assert.equal(lab.sent.length, 0, 'nothing is sent before the bed is touched');
  await follow(page, stroke);
  await waitForRuns(lab, 'night-sand', 1);
  const won = assertRun(lab, 'night-sand', { outcomes: ['won'], summaryKeys: ['level', 'kind', 'progress', 'completed'] });
  assert.equal(won.data.summary.level, 1);
  assert.ok(won.data.events.some(e => e.type === 'bed-cleared'), 'the cleared bed is an event');
  assertNoLeak(lab, ['hf-lab']);
  await page.tap('#retry');
  await screen(page, 'play');
  await page.tap('#pause');
  await screen(page, 'paused');
  await assertOffSendsNothing(page, lab, 'night-sand', { play: async () => {
    await page.tap('#resume');
    await screen(page, 'play');
    await follow(page, stroke);
  } });
  await context.close();
}

// A save written before this change loads unchanged, and the garden button shows on the bed.
async function oldSave(profile, origin, browser, errors, requests) {
  const context = await browser.newContext({ ...devices[profile.device], serviceWorkers: 'block' });
  await context.addInitScript(key => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem(key, JSON.stringify({ v: 1, unlocked: 6, level: 6, completed: 5, best: 81, sound: false, look: 'plum' }));
      sessionStorage.setItem('seeded', '1');
    }
  }, saveKey);
  const page = await instrument(context, origin, errors, requests);
  await page.goto(withAgent(origin + pagePath));
  await screen(page, 'play');
  const loaded = await state(page);
  assert.deepEqual([loaded.level, loaded.unlocked, loaded.completed, loaded.best, loaded.sound, loaded.look],
    [6, 6, 5, 81, false, 'plum'], 'an old save loads with every field');
  assert.ok(await page.locator('#to-garden').isVisible(), 'a player past bed 1 sees the garden button');
  const stored = await saved(page);
  assert.deepEqual(Object.keys(stored).sort(), ['best', 'completed', 'level', 'look', 'sound', 'unlocked', 'v']);
  await context.close();
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
    await page.goto(withAgent(url));
    await screen(page, 'play');
    await waitForFrames(page, name);
    await fits(page, 'field');
    await fits(page, 'pause');
    const opening = await state(page);
    assert.equal(opening.level, 1);
    assert.equal(opening.unlocked, 1);
    assert.equal(await page.locator('#to-garden').isVisible(), false, 'the garden button waits for bed 1');
    await capture(page, name, '01-lamp');
    const stroke = await controls(page, name);
    const start = performance.now();
    const openingBox = await page.locator('#field').boundingBox();
    await page.touchscreen.tap(openingBox.x + openingBox.width * .25, openingBox.y + openingBox.height * .12);
    assert.equal((await state(page)).status, 'play', 'an exploratory tap on sky leaves the lamp buried');
    assert.equal((await state(page)).lifted, 0, 'a tap high in the sky takes no sand');
    // Touch to grains in the hand, timed by the page's own clock.
    const touchToGrainsMs = await page.evaluate(h => new Promise(done => {
      const field = document.getElementById('field'), box = field.getBoundingClientRect();
      const at = { clientX: box.left + h.x * box.width / 120, clientY: box.top + h.y * box.height / 160,
        pointerId: 9, button: 0, bubbles: true, pointerType: 'touch', isPrimary: true };
      const t0 = performance.now();
      field.dispatchEvent(new PointerEvent('pointerdown', at));
      (function frame() {
        if (window.sandState().load > 0) {
          field.dispatchEvent(new PointerEvent('pointerup', at));
          return done(performance.now() - t0);
        }
        if (performance.now() - t0 > 3000) return done(Infinity);
        requestAnimationFrame(frame);
      })();
    }), opening.hint);
    assert.ok(touchToGrainsMs < 300, 'grains are in the hand within 300 ms of the touch');
    await follow(page, stroke);
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
    assert.ok(await page.locator('#to-garden').isVisible(), 'the garden is one tap away once bed 1 is cleared');
    await fits(page, 'to-garden');
    await capture(page, name, '03-seed');
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
    // Turkish, then back to English.
    await page.locator('#langs button[value="tr"]').tap();
    assert.equal((await state(page)).lang, 'tr');
    assert.equal(await page.locator('#resume').innerText().then(t => t.includes('Devam et')), true, 'the pause card reads in Turkish');
    await capture(page, name, '04-pause-tr');
    await page.locator('#langs button[value="en"]').tap();
    assert.equal((await state(page)).lang, 'en');
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
    await page.touchscreen.tap(box.x + box.width * .5, box.y + box.height * .2);
    await page.waitForFunction(() => window.sandState().tick > 0, null, { polling: 50, timeout: 4000 });
    assert.equal(await page.evaluate(() => Boolean(window.sandCheckGain)), false, 'fresh muted play leaves audio off');
    await page.mouse.move(box.x + box.width * .5, box.y + box.height * .2);
    await page.mouse.down();
    assert.equal((await state(page)).pressed, true);
    await page.keyboard.press('Escape');
    await screen(page, 'paused');
    assert.equal((await state(page)).pressed, false, 'pausing clears the captured pointer');
    await page.mouse.up();
    assert.equal((await state(page)).screen, 'paused', 'a delayed finger lift leaves pause in place');
    await tap(page, 'sound');
    await tap(page, 'resume');
    assert.equal((await state(page)).sound, true);
    // Every later goal is reached through play.
    const pourSample = await measureFrames(page, () => follow(page, stroke));
    assert.ok(pourSample.maxFlow > 0, 'poured grains move');
    assert.ok(pourSample.maxMovingGain > 0, 'moving grains raise their native Web Audio gain');
    assert.equal((await state(page)).unlocked, 3, 'the seed is covered between the marks');
    await tap(page, 'next');
    await screen(page, 'play');
    assert.equal((await state(page)).kind, 'glass');
    await capture(page, name, '05-glass');
    await stopGlass(page, stroke);
    assert.equal((await state(page)).status, 'won', 'the board shut in time fills the bulb between the marks');
    assert.equal((await state(page)).unlocked, 4);
    await tap(page, 'next');
    await screen(page, 'play');
    assert.equal((await state(page)).kind, 'sieve');
    await follow(page, stroke, { settle: 900 });
    assert.equal((await state(page)).unlocked, 5, 'the sieve sorts the sand');
    await tap(page, 'next');
    await screen(page, 'play');
    await tap(page, 'to-garden');
    await screen(page, 'play');
    assert.equal((await state(page)).level, 0);
    assert.equal((await state(page)).score, 0);
    assert.ok(await page.locator('#share').isVisible(), 'the garden offers its picture');
    await stroke(24, 80, 40, 139, { steps: 28, curve: 8 });
    const unpaired = (await state(page)).score;
    const sample = await measureFrames(page, () => stroke(95, 80, 79, 139, { steps: 28, curve: -8 }));
    const paired = await state(page);
    assert.equal(unpaired, 0, 'an isolated stroke on the left has no mirrored cells');
    assert.ok(paired.score > unpaired, 'mirroring the first rake stroke raises the symmetry score');
    assert.ok(paired.score >= 75, 'at least three quarters of a mirrored touch drawing matches');
    assert.equal(paired.best, (await saved(page)).best, 'the garden record is written locally');
    assert.ok(paired.best >= paired.score);
    // The bed is full here (about twelve thousand grains): page work per frame stays under 8 ms.
    assert.ok(sample.workP95Ms < 8 && pourSample.workP95Ms < 8, 'page work per frame under 8 ms');
    await tap(page, 'share');
    await page.waitForFunction(() => window.sandShared.length > 0, null, { polling: 50, timeout: 5000 });
    const shared = (await page.evaluate(() => window.sandShared))[0];
    assert.equal(shared.type, 'image/png');
    assert.deepEqual(shared.head.slice(0, 4), [0x89, 0x50, 0x4e, 0x47], 'the shared file is a PNG');
    assert.ok(shared.size > 4000, 'the picture holds the raked bed');
    assert.ok(shared.text.includes(String(paired.score)), 'the caption carries the score');
    await capture(page, name, '06-garden');
    // Smoothing the bed ends the garden run, which carries the share event.
    await tap(page, 'pause');
    await tap(page, 'restart');
    await screen(page, 'play');
    for (let wait = 0; wait < 30 && !page.lab.sent.some(r => r.data?.events?.some(e => e.type === 'garden-shared')); wait++) await delay(100);
    assert.ok(page.lab.sent.some(r => r.data?.events?.some(e => e.type === 'garden-shared')), 'the share is a recorded event');
    await page.reload();
    await screen(page, 'play');
    assert.equal((await state(page)).best, paired.best, 'reload preserves the garden record');
    assert.equal((await state(page)).level, 5, 'the garden preserves the campaign bed for reload');
    // Changed deliberately on 2026-11-24: the page records play now, so the lab client's player id exists; no other lab key may.
    assert.deepEqual(await page.evaluate(() => Object.keys(localStorage).filter(k =>
      k.startsWith('hf-lab-') && !['hf-lab-send-localhost', 'hf-lab-player'].includes(k))), [], 'no other play-recording keys');
    assert.ok(page.lab.sent.length > 0 && page.lab.sent.every(r => r.game === 'night-sand' && r.runSource === 'agent'), 'every record is named and marked as an agent run');
    await assertHomeLinks(context, `${origin}${pagePath}?from=small&lang=tr`, ['paused', 'result'], '‹ Küçük oyunlar');
    await context.close();
    await recording(profile, origin, browser, errors, requests);
    await oldSave(profile, origin, browser, errors, requests);

    for (const asset of [notes, ...['save', 'audio', 'pause', 'screens', 'zoom', 'hint', 'i18n'].map(n => `/kit/${n}.js`)]) {
      assert.ok(requests.has(asset), `loaded ${asset}`);
    }
    assert.deepEqual(errors, [], 'browser or network errors');
    console.log(JSON.stringify({ profile: device, touchToGrainsMs: +touchToGrainsMs.toFixed(1), firstSeconds: +firstSeconds.toFixed(2),
      oneStroke: unpaired, mirrored: paired.score, best: paired.best, shareBytes: shared.size, pourFrames: pourSample, gardenFrames: sample, errors: errors.length }));
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
