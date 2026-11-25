// PLAYWRIGHT=<directory containing playwright> node experiments/small/night-splitlight/check.mjs [webkit|chromium]
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
const mount = '/small/night-splitlight/';
// The daily checks use the real date, so today's save rules apply; PAST is the day before.
const DAY = new Date().toISOString().slice(0, 10);
const PAST = new Date(Date.parse(DAY) - 864e5).toISOString().slice(0, 10);
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

// Plate 2 follows the chord rule (changed deliberately on 2026-11-24): both receivers must be fed at one setting, so
// one tap at the hidden answer clears it, and a tap that feeds only one colour does not.
async function clearSecond(page) {
  const start = performance.now();
  const slider = await page.locator('#angle').boundingBox();
  const thumb = 27;
  const at = fraction => (thumb / 2 + fraction * (slider.width - thumb)) / slider.width;
  await turnByTouch(page, at(.55));
  await sleep(900);
  const partial = await state(page);
  assert.ok(!partial.won && partial.charge === 0, 'one colour alone does not expose a chord plate');
  const [answer] = await page.evaluate(() => window.splitlightAnswer());
  await turnByTouch(page, at(answer));
  await waitForScreen(page, 'result');
  const second = await state(page);
  assert.ok(second.won && second.targets.every(target => target.lit));
  assert.equal(await page.locator('#captured').textContent(), '2 / 2');
  assert.equal(Number(await stored(page)), 3, 'exposing both colors earns plate 3');
  return { position: second.position, turns: second.turns, par: second.par, simulatedSeconds: second.elapsed, wallSeconds: (performance.now() - start) / 1000 };
}

// The 2026-11-24 additions: the daily bench and its share line, part chips, the chord, Turkish, the way back to the
// small games, and no scrolling at 320 × 568 in any of those states.
async function noScroll(page, where) {
  const extra = await page.evaluate(() => [document.documentElement.scrollWidth - innerWidth, document.documentElement.scrollHeight - innerHeight]);
  if (extra.some(n => n > 0)) await page.screenshot({ path: join(shots, `night-splitlight-scroll-${where.replaceAll(/\W+/g, '-')}.png`), fullPage: true });
  assert.deepEqual(extra.map(n => Math.max(0, n)), [0, 0], `nothing scrolls at 320 × 568: ${where}`);
}
async function solveByAnswer(page) {
  const answer = await page.evaluate(() => window.splitlightAnswer());
  for (let i = 0; i < answer.length; i++) {
    if (answer.length > 1) await page.tap(`#parts .chip[data-control="${i}"]`);
    const box = await page.locator('#angle').boundingBox();
    const thumb = 27;
    await page.touchscreen.tap(box.x + thumb / 2 + answer[i] * (box.width - thumb), box.y + box.height / 2);
    await sleep(120);
  }
  await waitForScreen(page, 'result');
  return state(page);
}
async function extras({ name, engine, device }) {
  const browser = await engine.launch({ headless: true, timeout: 45000 });
  try {
    const context = await browser.newContext({ ...devices[device], viewport: { width: 320, height: 568 } });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const { errors, outside, lab } = await watchRequests(context, page);
    await context.addInitScript(() => {
      window.splitlightCheckTones = [];
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      const make = Context.prototype.createOscillator;
      Context.prototype.createOscillator = function () {
        const o = make.call(this), set = o.frequency.setValueAtTime.bind(o.frequency);
        o.frequency.setValueAtTime = (f, t) => { window.splitlightCheckTones.push(f); return set(f, t); };
        return o;
      };
      if (location.protocol === 'http:') localStorage.setItem('night-splitlight:hint', '1');
    });
    if (name === 'webkit') { await page.goto('about:blank'); await wakeDisplay(page); }
    await page.goto(withAgent(`${url}?from=small&daily&day=${DAY}`));
    await waitForScreen(page, 'play');
    const daily = await state(page);
    assert.equal(daily.mode, 'daily'); assert.equal(daily.day, DAY); assert.equal(daily.par, 2, 'the daily bench has par 2');
    assert.equal(await page.locator('#parts .chip').count(), 2, 'two parts, two chips');
    await controls(page, ['pause', 'angle', 'daily']);
    for (const chip of await page.locator('#parts .chip').all()) {
      const box = await chip.boundingBox();
      assert.ok(box.width >= 44 && box.height >= 44, 'each part chip has a 44 × 44 target');
    }
    const canvasBefore = await page.locator('#field').boundingBox();
    await noScroll(page, 'daily bench');
    await screenshot(page, name, '07-daily');
    // Same day, same bench: a second load gives the same receivers.
    const again = await context.newPage();
    await again.goto(withAgent(`${url}?daily&day=${DAY}`));
    await waitForScreen(again, 'play');
    assert.deepEqual((await state(again)).targets.map(t => t.angle), daily.targets.map(t => t.angle), 'the daily bench is the same for everyone on a day');
    await again.close();
    // Unlock audio with a tap, then solve; the chord sounds every receiver's pitch.
    await page.evaluate(() => { window.splitlightCheckTones.length = 0; });
    const won = await solveByAnswer(page);
    assert.ok(won.won && won.turns === 2, 'the daily bench is solved in two turns: ' + won.turns);
    await waitUntil(() => page.evaluate(() => window.splitlightChord), chord => chord?.length >= 2, 'waiting for the chord');
    const chord = await page.evaluate(() => window.splitlightChord);
    const tones = await page.evaluate(() => window.splitlightCheckTones);
    for (const f of chord) assert.ok(tones.some(t => Math.abs(t - f) < .01), `the chord plays ${f} Hz`);
    assert.ok(await page.locator('#share').isVisible(), 'the daily result offers sharing');
    assert.ok(await page.locator('#result .kit-home').isVisible(), 'a visit from the small games gets the way back');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('night-splitlight:daily')));
    assert.equal(saved.day, DAY); assert.equal(saved.turns, 2);
    const home = await page.evaluate(() => JSON.parse(localStorage.getItem('hub:results') || '{}')['night-splitlight']);
    assert.ok(home?.wins >= 1, 'the small games home hears about the win');
    const line = await page.evaluate(() => window.splitlightShareLine());
    assert.match(line, new RegExp(`^Splitlight ${DAY}: 2 turns, par 2, [\\d.]+ s \\S+$`, 'u'), 'the share line: ' + line);
    const link = await page.evaluate(() => window.splitlightShareUrl());
    assert.ok(link.endsWith(`/small/night-splitlight/?daily&day=${DAY}`), 'the shared link opens the same bench: ' + link);
    await noScroll(page, 'daily result with the way back');
    await screenshot(page, name, '08-daily-result');
    // A shared link to another day plays that day's bench but leaves today's saved result alone.
    const past = await context.newPage();
    await past.goto(withAgent(`${url}?daily&day=${PAST}`));
    await waitForScreen(past, 'play');
    assert.equal((await state(past)).day, PAST);
    assert.match(await past.locator('#plate').textContent(), /^Shared/, 'a past day is not called today');
    assert.ok((await solveByAnswer(past)).won, 'the shared past bench can be solved');
    const kept = await past.evaluate(() => JSON.parse(localStorage.getItem('night-splitlight:daily')));
    assert.equal(kept.day, DAY, 'a past bench does not replace today\'s result'); assert.equal(kept.turns, 2);
    await past.close();
    // Back to the plates; plate 8 has two parts. Turkish throughout, then back to English.
    await page.tap('#next');
    await waitForScreen(page, 'play');
    await page.evaluate(() => { localStorage.setItem('night-splitlight:plate', '8'); });
    await page.goto(withAgent(url)); // the tab remembers it came from the small games
    await waitForScreen(page, 'play');
    assert.equal((await state(page)).level, 8);
    assert.equal(await page.locator('#parts .chip').count(), 2);
    await page.tap('#pause');
    await page.tap('#lang');
    assert.match(await page.locator('#plate').textContent(), /^Levha 08 \/ 18$/, 'Turkish plate line');
    assert.equal(await page.locator('#paused .kit-home').count(), 1, 'the pause card keeps the way back');
    await noScroll(page, 'Turkish pause card');
    await page.tap('#resume');
    await waitForScreen(page, 'play');
    await noScroll(page, 'Turkish plate with two parts');
    const canvasAfter = await page.locator('#field').boundingBox();
    assert.ok(canvasAfter.height >= canvasBefore.height - 1, 'chips and labels do not shrink the bench');
    await screenshot(page, name, '09-turkish-parts');
    const tr = await solveByAnswer(page);
    assert.ok(tr.won);
    await noScroll(page, 'Turkish result');
    await page.tap('#pause').catch(() => {});
    await page.evaluate(() => localStorage.setItem('kit:lang', 'en'));
    assert.deepEqual([errors, outside, lab], [[], [], []], 'no errors, external requests or stray lab requests');
    console.log(JSON.stringify({ browser: name, extras: 'ok', daily: { par: daily.par, turns: won.turns }, chord, line }));
  } finally {
    await browser.close();
  }
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
      await extras(profile);
    } catch (error) {
      process.exitCode = 1;
      console.error(profile.name, error);
    }
  }
} finally {
  await new Promise(resolve => server.close(resolve));
}
