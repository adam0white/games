// PLAYWRIGHT=<directory containing playwright> node experiments/lab/night-splitlight/check.mjs [webkit|chromium]
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { createRequire } from 'node:module';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import { answerLab, withAgent, assertNotice, assertRun, assertOffSendsNothing, assertNoLeak, waitForRuns } from '../../kit/check/lab-record.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const notesButton = resolve(root, '../workers/feedback/public/notes/button.js');
const mount = '/lab/night-splitlight/';
const shots = process.env.SHOTS || '/private/tmp/night-r5-review';
const saveKey = 'night-splitlight:plate';
const types = {
  '.css': 'text/css',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};
const allowedAsset = path => path === '/notes/button.js' || path === '/favicon.ico'
  || path.startsWith(mount) || path.startsWith('/kit/');

const playwrightDir = process.env.PLAYWRIGHT || join(homedir(), 'code/human-framework/node_modules');
const requirePlaywright = createRequire(join(resolve(playwrightDir), 'check.cjs'));
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
  try {
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (path === '/favicon.ico') {
      response.writeHead(204).end();
      return;
    }
    const file = path === '/notes/button.js'
      ? notesButton
      : resolve(root, `.${path}${path.endsWith('/') ? 'index.html' : ''}`);
    if (!allowedAsset(path) || (!file.startsWith(root + sep) && file !== notesButton)) throw new Error('unknown asset');
    const bytes = await readFile(file);
    response.writeHead(200, {
      'content-type': types[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    }).end(bytes);
  } catch {
    response.writeHead(404).end('not found');
  }
});
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const origin = `http://127.0.0.1:${server.address().port}`;
const url = origin + mount;

const state = page => page.evaluate(() => window.splitlightState?.());
const stored = page => page.evaluate(key => localStorage.getItem(key), saveKey);
async function waitUntil(sample, done, message, timeout = 20000) {
  const deadline = performance.now() + timeout;
  let value;
  do {
    value = await sample();
    if (done(value)) return;
    await sleep(50);
  } while (performance.now() < deadline);
  assert.fail(`${message}: ${JSON.stringify(value)}`);
}
const waitForScreen = (page, screen, timeout) => waitUntil(
  () => state(page), value => value?.screen === screen, `waiting for ${screen}`, timeout,
);

async function wakeDisplay(page) {
  const viewport = page.viewportSize();
  await page.bringToFront();
  await page.setViewportSize({ ...viewport, width: viewport.width + 1 });
  await sleep(150);
  await page.setViewportSize(viewport);
}

async function readyToPaint(page, name) {
  const sample = () => page.evaluate(() => window.splitlightCheckFrames);
  const check = async () => {
    const frames = await sample();
    await waitUntil(sample, count => count >= frames + 2, 'waiting for two animation frames', 4000);
  };
  try {
    await check();
  } catch (error) {
    if (name !== 'webkit' || error.name !== 'AssertionError') throw error;
    await wakeDisplay(page);
    await check();
  }
}

function contrast({ width, data }, area) {
  let low = Infinity;
  let high = -Infinity;
  for (let y = Math.ceil(area.y); y < area.y + area.height - 1; y += 3) {
    for (let x = Math.ceil(area.x); x < area.x + area.width - 1; x += 3) {
      const pixel = (y * width + x) * 4;
      if (data[pixel + 3] === 0) continue;
      const luminance = data[pixel] + data[pixel + 1] + data[pixel + 2];
      low = Math.min(low, luminance);
      high = Math.max(high, luminance);
    }
  }
  return high - low;
}

async function screenshot(page, name, step) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await readyToPaint(page, name);
    const bytes = await page.screenshot({ scale: 'css', timeout: 30000 });
    const frame = PNG.sync.read(bytes);
    const viewport = { x: 0, y: 0, width: frame.width, height: frame.height };
    const area = await page.locator('#field').boundingBox();
    if (contrast(frame, viewport) > 100 && area && contrast(frame, area) > 100) {
      await writeFile(join(shots, `night-splitlight-${name}-${step}.png`), bytes);
      return;
    }
    if (name === 'webkit') await wakeDisplay(page);
  }
  assert.fail(`${name} ${step}: screenshot remained blank`);
}

async function controls(page, ids) {
  const viewport = page.viewportSize();
  for (const id of ids) {
    const control = page.locator(`#${id}`);
    assert.ok(await control.isVisible(), `${id} is visible`);
    const { x, y, width, height } = await control.boundingBox();
    assert.ok(width >= 44 && height >= 44, `${id} has a 44 × 44 CSS-pixel target`);
    assert.ok(x >= 0 && y >= 0 && x + width <= viewport.width + 0.5 && y + height <= viewport.height + 0.5,
      `${id} stays within the phone viewport`);
  }
}

async function turnByTouch(page, fraction) {
  const box = await page.locator('#angle').boundingBox();
  await page.touchscreen.tap(box.x + fraction * box.width, box.y + box.height / 2);
}

async function checkHandAfterRotation(page, name) {
  const hand = page.locator('.kit-hint.on');
  await waitUntil(() => hand.count(), count => count === 1, 'waiting for the first-use hand');
  const portrait = page.viewportSize();
  await page.setViewportSize({ width: portrait.height, height: portrait.width });
  await readyToPaint(page, name);
  await controls(page, ['pause', 'angle']);
  const plateLines = await page.locator('#plate').evaluate(plate => {
    const text = document.createRange();
    text.selectNodeContents(plate);
    return text.getClientRects().length;
  });
  assert.equal(plateLines, 1, 'the plate and total stay on one line in landscape');
  const dial = await page.locator('#angle').boundingBox();
  const track = await hand.locator('.track').boundingBox();
  assert.ok(track.x >= dial.x && track.x + track.width <= dial.x + dial.width,
    'the rotated hand stays in the dial column');
  assert.ok(track.y >= dial.y && track.y + track.height <= portrait.width,
    'the landscape hand is visible beside the dial');
  await page.tap('#field');
  await page.mouse.move(dial.x + dial.width / 2, dial.y + dial.height / 2);
  assert.equal((await state(page)).started, false, 'a stationary bench tap does not turn the prism');
  assert.equal(await hand.count(), 1, 'the first-use hand survives a stationary bench tap and dial hover');
  await screenshot(page, name, '06-landscape-hint');
  await page.setViewportSize(portrait);
}

async function checkBenchEndStops(context, page, name) {
  const box = await page.locator('#field').boundingBox();
  const point = fraction => ({ x: Math.round(box.x + fraction * box.width), y: Math.round(box.y + box.height * .56) });
  const session = name === 'chromium' ? await context.newCDPSession(page) : null;
  async function move(type, fraction) {
    const { x, y } = point(fraction);
    if (session) {
      await session.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    } else if (type === 'touchStart') {
      await page.mouse.move(x, y);
      await page.mouse.down();
    } else if (type === 'touchMove') {
      await page.mouse.move(x, y);
    } else {
      await page.mouse.up();
    }
  }
  for (const [from, far, back, limit] of [[.12, .88, .83, 1], [.88, .12, .17, 0]]) {
    await move('touchStart', from);
    try {
      await move('touchMove', far);
      await waitUntil(() => state(page), value => value.position === limit, 'drag reaches the dial end stop', 2000);
      await move('touchMove', back);
      await waitUntil(() => state(page), value => value.position > 0 && value.position < 1,
        `a single reversal moves off end stop ${limit}`, 2000);
    } finally {
      await move('touchEnd', back);
    }
  }
  await session?.detach();
}

async function clearOpening(page) {
  const start = performance.now();
  const previousTouches = await page.evaluate(() => window.splitlightCheckTouches.length);
  await turnByTouch(page, .79);
  assert.equal((await state(page)).started, true, 'a single ordinary slider tap starts play');
  assert.equal(await page.locator('.kit-hint.on').count(), 0, 'turning the dial dismisses the first-use hand');
  try {
    await waitForScreen(page, 'result', 59000);
  } catch (error) {
    throw new Error(`first plate did not clear after one tap: ${JSON.stringify(await state(page))}`, { cause: error });
  }
  const wallSeconds = (performance.now() - start) / 1000;
  const first = await state(page);
  const touches = await page.evaluate(previous => window.splitlightCheckTouches.slice(previous), previousTouches);
  assert.deepEqual(touches, [['touch', true]], 'one trusted touch on the range is sufficient');
  assert.ok(first.started && first.won && first.targets.every(target => target.lit), 'the first plate is exposed');
  assert.ok(wallSeconds < 60 && first.elapsed < 60, 'first plate is exposed in under one minute');
  assert.equal(await page.locator('#captured').textContent(), '1 / 1', 'readout shows the captured receiver');
  return { position: first.position, simulatedSeconds: first.elapsed, wallSeconds };
}

async function clearSecond(page) {
  const start = performance.now();
  const angles = [];
  // A native range thumb travels from its radius to one radius short of the far edge.
  const slider = await page.locator('#angle').boundingBox();
  const thumb = 27;
  for (const [receiver, fraction] of [[0, .55], [1, .15]]) {
    await turnByTouch(page, (thumb / 2 + fraction * (slider.width - thumb)) / slider.width);
    await waitUntil(() => state(page), value => value.targets[receiver].lit, `waiting for receiver ${receiver + 1}`);
    angles.push((await state(page)).position);
    assert.equal(await page.locator('#captured').textContent(), `${receiver + 1} / 2`);
  }
  await waitForScreen(page, 'result');
  const second = await state(page);
  assert.ok(second.won && second.targets.every(target => target.lit));
  assert.equal(Number(await stored(page)), 3, 'exposing both colors earns plate 3');
  return { angles, simulatedSeconds: second.elapsed, wallSeconds: (performance.now() - start) / 1000 };
}

async function watchRequests(context, page) {
  const errors = [];
  const outside = [];
  const lab = [];
  const assets = new Set();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('websocket', socket => lab.push(`WebSocket ${socket.url()}`));
  await context.route('**/*', async route => {
    const request = route.request();
    const address = new URL(request.url());
    if (address.origin !== origin) {
      outside.push(request.url());
      return route.abort();
    }
    const path = address.pathname;
    if (request.method() !== 'GET' || !allowedAsset(path)) {
      lab.push(`${request.method()} ${path}`);
      return route.abort();
    }
    assets.add(path);
    return route.continue();
  });
  // The lab endpoint is answered here (registered after the catch-all, so it wins): no check reaches the real one.
  const standIn = await answerLab(context, origin);
  await context.addInitScript(() => {
    if (location.protocol !== 'http:') return;
    localStorage.setItem('hf-lab-send-localhost', '1');
    const forbiddenWrite = /^(?!hf-lab-(?:send-localhost|player|session:night-splitlight)$)(hf-lab-|night-splitlight:lab)/;
    const setItem = Storage.prototype.setItem;
    window.splitlightCheckLabWrites = [];
    Storage.prototype.setItem = function (key, value) {
      if (forbiddenWrite.test(key)) window.splitlightCheckLabWrites.push(key);
      return setItem.call(this, key, value);
    };
    window.splitlightCheckFrames = 0;
    requestAnimationFrame(function countFrame() {
      window.splitlightCheckFrames++;
      requestAnimationFrame(countFrame);
    });
    window.splitlightCheckTouches = [];
    document.addEventListener('pointerdown', event => {
      if (event.target.id === 'angle') window.splitlightCheckTouches.push([event.pointerType, event.isTrusted]);
    }, { capture: true });
  });
  return { errors, outside, lab, assets, standIn };
}

// The page records play (kit/lab.js), so the lab client's player id and this page's session id are expected.
// Changed deliberately on 2026-11-24 from "no hf-lab- keys at all"; any other lab key or write still fails.
async function checkLabStorage(page) {
  assert.deepEqual(await page.evaluate(() => window.splitlightCheckLabWrites), [], 'no other lab storage writes attempted');
  assert.deepEqual(await page.evaluate(() => [...Object.keys(localStorage), ...Object.keys(sessionStorage)]
    .filter(key => !/^hf-lab-(?:send-localhost|player|session:night-splitlight)$/.test(key) && /^(hf-lab-|night-splitlight:lab)/.test(key))),
  [], 'no other lab state stored');
}

// A played plate sends one run record under the page's name; with the switch off nothing is sent.
async function recording({ name, engine, device }) {
  const browser = await engine.launch({ headless: true, timeout: 45000 });
  try {
    const context = await browser.newContext(devices[device]);
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    page.setDefaultNavigationTimeout(30000);
    const { errors, outside, lab, standIn } = await watchRequests(context, page);
    if (name === 'webkit') { await page.goto('about:blank'); await wakeDisplay(page); }
    await page.goto(withAgent(url));
    await waitForScreen(page, 'play');
    await readyToPaint(page, name);
    await assertNotice(page);
    assert.equal(standIn.sent.length, 0, 'nothing is sent before the dial is turned');
    await clearOpening(page);
    await waitForRuns(standIn, 'night-splitlight', 1);
    const won = assertRun(standIn, 'night-splitlight', { outcomes: ['won'], summaryKeys: ['level', 'captured', 'targets', 'seconds'] });
    assert.equal(won.data.summary.level, 1);
    assert.ok(won.data.events.some(e => e.type === 'plate-exposed'), 'the exposed plate is an event');
    assertNoLeak(standIn, ['hf-lab']);
    await page.tap('#again');
    await waitForScreen(page, 'play');
    await page.tap('#pause');
    await waitForScreen(page, 'paused');
    await assertOffSendsNothing(page, standIn, 'night-splitlight', { play: async () => {
      await page.tap('#resume');
      await waitForScreen(page, 'play');
      await clearOpening(page);
    } });
    assert.deepEqual([errors, outside, lab], [[], [], []], 'no errors, external requests or stray lab requests');
  } finally {
    await browser.close();
  }
}

async function run({ name, engine, device }) {
  const browser = await engine.launch({ headless: true, timeout: 45000 });
  try {
    const context = await browser.newContext(devices[device]);
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    page.setDefaultNavigationTimeout(30000);
    const { errors, outside, lab, assets } = await watchRequests(context, page);
    if (name === 'webkit') {
      await page.goto('about:blank');
      await wakeDisplay(page);
    }
    await page.goto(withAgent(url));
    await waitForScreen(page, 'play');
    await readyToPaint(page, name);
    await controls(page, ['pause', 'angle']);
    const fresh = await state(page);
    assert.equal(fresh.level, 1, 'a new device opens the first plate');
    await sleep(850);
    const idle = await state(page);
    assert.equal(idle.elapsed, 0, 'the untouched plate has no elapsed play time');
    assert.equal(idle.started, false, 'the untouched plate is not started');
    assert.equal(idle.won, false, 'the untouched plate is not solved');
    assert.ok(idle.targets.every(target => target.charge === 0 && !target.lit), 'the untouched receivers stay empty');
    await screenshot(page, name, '01-first-plate');
    await checkHandAfterRotation(page, name);

    const first = await clearOpening(page);
    assert.equal(Number(await stored(page)), 2, 'exposing plate 1 earns plate 2 in storage');
    const result = page.locator('#result');
    assert.ok(await result.isVisible(), 'the first result is visible');
    await controls(page, ['next', 'again']);
    await screenshot(page, name, '02-first-result');
    await page.tap('#next');
    await waitForScreen(page, 'play');
    const second = await state(page);
    assert.equal(second.level, 2, 'the earned next plate opens');
    assert.equal(second.targets.length, 2, 'plate 2 has two receivers');
    assert.ok(!second.started && !second.won && second.elapsed === 0, 'plate 2 starts untouched');

    await turnByTouch(page, .12);
    await waitUntil(() => state(page), value => value.elapsed >= .1, 'waiting for play to advance');
    await page.tap('#pause');
    await waitForScreen(page, 'paused');
    const paused = await state(page);
    await sleep(600);
    assert.deepEqual(await state(page), paused, 'pause freezes the clock, dial and receivers');
    await controls(page, ['resume', 'restart', 'sound', 'first']);
    await page.tap('#sound');
    const sound = (await state(page)).sound;
    assert.equal(sound, !paused.sound, 'the sound toggle changes the preference');
    await page.tap('#resume');
    await waitForScreen(page, 'play');
    await waitUntil(() => state(page), value => value.elapsed > paused.elapsed, 'waiting for play to resume');
    const resumed = await state(page);
    assert.equal(resumed.sound, sound, 'resume keeps the sound preference');
    assert.equal(resumed.position, paused.position, 'resume keeps the prism position');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'angle', 'resume restores dial focus');
    await page.tap('#pause');
    await page.tap('#restart');
    await waitForScreen(page, 'play');
    const restarted = await state(page);
    assert.equal(restarted.sound, sound, 'restart keeps the sound preference');
    assert.deepEqual(restarted, { ...second, sound }, 'restart resets the same plate');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'angle', 'restart restores dial focus');
    await screenshot(page, name, '03-second-plate');
    await page.keyboard.press('ArrowRight');
    assert.ok((await state(page)).position > restarted.position, 'the dial responds to the next keyboard action');
    await checkBenchEndStops(context, page, name);
    await checkLabStorage(page);

    await page.reload();
    await waitForScreen(page, 'play');
    const reloaded = await state(page);
    assert.equal(reloaded.level, 2, 'reload opens the highest unlocked plate');
    assert.equal(reloaded.sound, sound, 'reload keeps the sound preference');
    await page.tap('#pause');
    await page.tap('#first');
    await waitForScreen(page, 'play');
    const replay = await state(page);
    assert.equal(replay.level, 1, 'pause offers a replay of the first plate');
    assert.ok(!replay.started && !replay.won, 'replay resets the first plate');
    assert.equal(replay.sound, sound, 'replay keeps the sound preference');
    assert.equal(Number(await stored(page)), 2, 'replay preserves the unlocked plate');
    await checkLabStorage(page);

    await page.goto(`${url}?look=oxide&labRunSource=agent`);
    await waitForScreen(page, 'play');
    assert.equal((await state(page)).level, 2, 'the alternate look loads the same saved progress');
    assert.equal(await page.locator('html').getAttribute('data-look'), 'oxide', 'the alternate look is selected');
    await screenshot(page, name, '04-oxide-second-plate');
    const colors = await clearSecond(page);
    await page.tap('#next');
    await waitForScreen(page, 'play');
    assert.equal((await state(page)).level, 3, 'the earned third plate opens');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'angle', 'advancing restores dial focus');
    await page.tap('#pause');
    await page.tap('#first');
    await waitForScreen(page, 'play');
    await screenshot(page, name, '05-oxide-first-plate');
    const oxideFirst = await clearOpening(page);
    assert.equal(Number(await stored(page)), 3, 'clearing a replay preserves the highest unlocked plate');
    await checkLabStorage(page);
    assert.ok(assets.has('/notes/button.js'), 'the real feedback button script loaded');
    assert.deepEqual(errors, [], 'browser errors');
    assert.deepEqual(outside, [], 'external requests');
    assert.deepEqual(lab, [], 'lab requests and writes');
    console.log(JSON.stringify({
      browser: name, device, first, colors, oxideFirst,
      pauseElapsed: paused.elapsed, resumedElapsed: resumed.elapsed, savedPlate: Number(await stored(page)),
      sound, browserErrors: errors.length, externalRequests: outside.length, labRequests: lab.length, labWrites: 0,
    }));
  } finally {
    await browser.close();
  }
}

try {
  for (const profile of profiles) {
    if (process.argv[2] && profile.name !== process.argv[2]) continue;
    try {
      await run(profile);
      await recording(profile);
    } catch (error) {
      process.exitCode = 1;
      console.error(profile.name, error);
    }
  }
} finally {
  await new Promise(resolve => server.close(resolve));
}
