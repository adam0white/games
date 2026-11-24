// PLAYWRIGHT=<directory containing playwright> node experiments/flock/check.mjs [webkit|chromium]
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { createRequire } from 'node:module';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { leftEdge, rightEdge } from './sim.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const notesButton = resolve(root, '../workers/feedback/public/notes/button.js');
const shots = process.env.SHOTS || '/private/tmp/night-r7-flock/check';
const saveKey = 'night-flock-2:save';
const types = {
  '.css': 'text/css',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};
const allowed = pathname => pathname === '/notes/button.js' || pathname === '/favicon.ico'
  || pathname.startsWith('/flock/') || pathname.startsWith('/kit/') || pathname === '/lab/night-flock-2/';

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
  if (pathname === '/flock/check-away.html') {
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
const url = `${origin}/flock/`;
const labOrigin = 'https://human.adamwhite.work';

const state = page => page.evaluate(() => window.flockState());
const waitForScreen = (page, screen) => page.waitForFunction(
  expected => window.flockState?.().screen === expected, screen, { polling: 50 },
);
const stored = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), saveKey);
// Every load opens on the first card. Play is the only way past it.
async function enter(page, name) {
  await waitForScreen(page, 'start');
  await page.tap('#play');
  await waitForScreen(page, 'play');
  await readyToPaint(page, name);
}
// The lab endpoint is answered here. No check reaches the real one.
async function answerLab(context, pageOrigin) {
  const lab = { sent: [], tried: 0 };
  await context.route(labOrigin + '/**', async route => {
    const request = route.request();
    const cors = { 'access-control-allow-origin': pageOrigin, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'Content-Type' };
    lab.tried++;
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    assert.equal(new URL(request.url()).pathname, '/lab/api/linked', 'only the lab record address is used');
    const record = JSON.parse(gunzipSync(request.postDataBuffer()).toString());
    lab.sent.push(record);
    return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ ok: true, id: record.id }) });
  });
  return lab;
}
const runs = (lab, outcome) => lab.sent.filter(r => r.game === 'flock' && r.kind === 'run' && (!outcome || r.data.outcome === outcome));
async function sentRun(lab, outcome, count = 1) {
  for (let i = 0; i < 80 && runs(lab, outcome).length < count; i++) await sleep(50);
  assert.ok(runs(lab, outcome).length >= count, `a ${outcome} run reached the lab stand-in`);
  return runs(lab, outcome).at(-1);
}
async function inViewport(page, selector, what) {
  const box = await page.locator(selector).boundingBox();
  const viewport = page.viewportSize();
  assert.ok(box && box.width > 0 && box.height > 0 && box.x >= 0 && box.y >= 0 &&
    box.x + box.width <= viewport.width + .5 && box.y + box.height <= viewport.height + .5, what);
}

// Only the daily calendar is fixed. The animation and performance clocks
// must continue to be the native browser clocks throughout the phone check.
async function setDailyDate(page, iso) {
  await page.evaluate(iso => {
    const NativeDate = window.originalFlockDate ?? Date;
    window.originalFlockDate = NativeDate;
    if (!iso) {
      window.Date = NativeDate;
      delete window.originalFlockDate;
      return;
    }
    const timestamp = NativeDate.parse(iso);
    window.Date = class extends NativeDate {
      constructor(...args) { super(...(args.length ? args : [timestamp])); }
      static now() { return timestamp; }
    };
  }, iso);
}

async function visibleLesson(page, command) {
  const selector = '#hint-' + command + ' + .kit-hint.on .hand';
  await page.waitForFunction(selector => {
    const hand = document.querySelector(selector);
    return hand && Number(getComputedStyle(hand).opacity) > .8 &&
      Number(getComputedStyle(hand.parentElement).opacity) > .8;
  }, selector);
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
    const { data, width, height } = PNG.sync.read(bytes);
    let dark = 765, light = 0;
    for (let pixel = 0; pixel < data.length; pixel += 68) {
      if (data[pixel + 3] === 0) continue;
      const rgb = data[pixel] + data[pixel + 1] + data[pixel + 2];
      dark = Math.min(dark, rgb);
      light = Math.max(light, rgb);
    }
    // The HUD and moving animals can render while the cached hillside is missing.
    // Across the distant ridge, the sky, roof and treeline have distinct tones.
    let ridgeContrast = Infinity;
    if (await page.locator('.folio:not([inert])').count()) {
      const box = await page.locator('#field').boundingBox();
      const viewport = page.viewportSize();
      const tones = [];
      for (let i = 5; i < 95; i++) {
        const x = Math.floor((box.x + box.width * i / 100) * width / viewport.width);
        const y = Math.floor((box.y + box.height * .12) * height / viewport.height);
        const offset = (y * width + x) * 4;
        tones.push(data[offset] + data[offset + 1] + data[offset + 2]);
      }
      tones.sort((a,b) => a-b);
      ridgeContrast = tones[81] - tones[9];
    }
    if (light - dark > 100 && ridgeContrast > 24) {
      await writeFile(join(shots, `flock-${name}-${step}.png`), bytes);
      return;
    }
    await wakeDisplay(page);
    await readyToPaint(page, name);
  }
  assert.fail(`${name} ${step}: screenshot lacked the hillside or foreground contrast`);
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

async function beginner(page, input, speed = 25) {
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
        await input.move(1, 180, Math.max(148, 414 - speed * game.time));
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

async function rotateIdleHint(page, name) {
  const portrait = page.viewportSize();
  const cue = '#hint-drag + .kit-hint.on';
  await page.locator(`${cue} .hand`).waitFor({ state: 'visible' });
  const drag = await page.evaluate(selector => {
    const cue = document.querySelector(selector);
    const hand = cue.querySelector('.hand');
    const animation = hand.getAnimations().find(entry => entry.animationName === 'command-drive');
    return {
      sidewaysTrack: getComputedStyle(cue.querySelector('.line')).display !== 'none',
      transforms: animation?.effect.getKeyframes().map(frame => frame.transform),
    };
  }, cue);
  assert.equal(drag.sidewaysTrack, false, 'the opening hint has no sideways route');
  assert.ok(drag.transforms?.includes('translateY(-48px)'), 'the opening hand demonstrates an uphill drag');
  const beforeRotate = await page.evaluate(() => window.flockGuideDraws);
  await page.setViewportSize({ width: portrait.height, height: portrait.width });
  await readyToPaint(page, name);
  assert.equal((await state(page)).game.time, 0, 'rotating the idle lesson does not start the clock');
  const offset = await page.evaluate(selector => {
    const cue = document.querySelector(selector).getBoundingClientRect();
    const field = document.querySelector('#field').getBoundingClientRect();
    return { x: cue.x - field.x - field.width * .5, y: cue.y - field.y - field.height * .8 };
  }, cue);
  assert.ok(Math.abs(offset.x) <= 1 && Math.abs(offset.y) <= 1,
    'the visible hint stays anchored to the landscape field');
  assert.ok(await page.evaluate(before => window.flockGuideDraws > before, beforeRotate),
    'the canvas path remains visible with the delayed hand cue');
  await screenshot(page, name, '01a-idle-landscape-hint');
  await page.setViewportSize(portrait);
  await readyToPaint(page, name);
  return offset;
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
      timerLines: lines('.daylight .smallcaps'), titleLines: lines('h1'), chapterLines: lines('#chapter') };
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

async function feedbackLayout(page, name) {
  const portrait = page.viewportSize();
  for (const [viewport, label] of [[portrait, 'portrait'], [{ width: 320, height: 568 }, 'short']]) {
    await page.setViewportSize(viewport);
    await readyToPaint(page, name);
    const overlap = await page.locator('#notes-button').evaluate(button => {
      const notes = button.getBoundingClientRect();
      return ['#pause', '#field', '#field-map'].filter(selector => {
        const box = document.querySelector(selector).getBoundingClientRect();
        return notes.left < box.right && notes.right > box.left && notes.top < box.bottom && notes.bottom > box.top;
      });
    });
    assert.deepEqual(overlap, [], `${label} feedback stays clear of field controls`);
    await screenshot(page, name, `03c-notes-${label}`);
  }
  await page.setViewportSize(portrait);
  await readyToPaint(page, name);
}

// Guide the rear flock uphill. Recover sheep near the banks and meet a wolf
// that is about to reach the flock before it drives sheep across the field.
function destination(game) {
  const sheep = game.sheep.filter(animal => animal.status === 'field');
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const { wolf } = game;
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
  const gate = [game.terrain.bridge, game.terrain.gate, game.terrain.lane]
    .find(b => b && rear.y >= b.y + b.height - .1) ?? game.gate;
  const gateDx = gate.x - x;
  const dx = Math.abs(gateDx) < 24 ? 0 : gateDx - 8 * Math.sign(gateDx);
  const dy = gate.y - 21 - y;
  const gap = (group.length > 3 ? 37 : 31) / Math.hypot(dx, dy);
  const targetY = Math.min(502, Math.max(game.gate.y + 8, y - dy * gap));
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

async function selectEvening(page, level) {
  if ((await state(page)).screen === 'end') await page.tap('#end-evenings');
  else {
    await page.tap('#pause');
    await page.tap('#evenings');
  }
  await page.getByRole('button', { name: 'Evening ' + level, exact: true }).tap();
  await waitForScreen(page, 'play');
  const { game } = await state(page);
  assert.equal(game.level, level);
  assert.equal(game.time, 0);
  return game;
}

async function flankFlick(page, name, game, direction) {
  const durations = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) game = await selectEvening(page, game.level);
    const input = await steering(page, name);
    await page.evaluate(() => { window.flockFlickDuration = null; });
    const { x, y } = game.dog;
    await input.down(1, x, y);
    await input.move(1, x + direction * 70, y - 5);
    await input.up(1);
    const elapsed = await page.evaluate(() => window.flockFlickDuration);
    assert.ok(Number.isFinite(elapsed), 'the browser delivered a full primary gesture');
    if (elapsed <= 300) return { game, input };
    // Three separate browser commands can take more than 300 ms on a busy host.
    // Retry only a slow input. A valid flick still has to work on the first try.
    durations.push(elapsed);
  }
  assert.fail('the browser delivered no flick within 300 ms: ' + durations.join(', '));
}

// Bring both teaching flocks home through the pointer layer. Letting go is
// important here: a finger still sending targets would cancel the command.
async function finishLesson(page, input, atGate) {
  let down = false, heldAtGate = false;
  const start = Date.now();
  try {
    while (Date.now() - start < 90000) {
      const { game, screen } = await state(page);
      if (screen === 'end') {
        assert.equal(game.status, 'won', `evening ${game.level}: ${game.home}/${game.required} home, ${game.lost} lost at ${game.time.toFixed(2)}s; dog ${game.dog.mode}, gate ${game.terrain.gate?.open}, gathered ${game.terrain.outrun?.gathered}`);
        assert.equal(game.home, game.sheep.length);
        assert.equal(game.lost, 0);
        return { level: game.level, seconds: game.time, home: game.home, heldAtGate };
      }
      if (game.status !== 'play' || game.terrain.outrun && !game.terrain.outrun.gathered) {
        await sleep(60);
        continue;
      }
      const gate = game.terrain.gate;
      const queue = gate && !gate.open && game.sheep.some(s => s.status === 'field' &&
        s.y > gate.y && s.y < gate.y + 19 && Math.abs(s.x - gate.x) < gate.width / 2);
      let aim = destination(game);
      if (queue && Math.hypot(game.dog.x - gate.x, game.dog.y - gate.y) < 105) {
        if (down) await input.up(1);
        down = false;
        if (atGate && !heldAtGate) await atGate(game);
        const dog = (await state(page)).game.dog;
        await input.down(1, dog.x, dog.y);
        await page.waitForFunction(() => window.flockState().game.dog.mode === 'hold');
        await input.up(1);
        await page.waitForFunction(() => window.flockState().game.terrain.gate.open, null, {timeout: 18000});
        heldAtGate = true;
        continue;
      }
      if (queue) aim = { x: gate.x, y: gate.y + 55 };
      // The last sheep may need pressure from nearly the same spot for a
      // while. If that stationary contact laid the dog down, start a new drive.
      if (down && game.dog.mode === 'hold') {
        await input.up(1);
        down = false;
      }
      if (!down) {
        await input.down(1, game.dog.x, game.dog.y);
        down = true;
      }
      await input.move(1, aim.x, aim.y);
      await sleep(65);
    }
    assert.fail('gesture lesson exceeded the phone deadline');
  } finally {
    if (down) await input.up(1);
  }
}

async function valleyChecks(page, name) {
  await page.evaluate(key => {
    const save = JSON.parse(localStorage.getItem(key));
    localStorage.setItem(key, JSON.stringify({ ...save, unlocked: 20 }));
  }, saveKey);
  await page.goto(url);
  await enter(page, name);
  let game = await selectEvening(page, 2);
  let input = await steering(page, name);
  assert.equal((await state(page)).picture, 'bring', 'a closed cross-gate first asks for the flock');
  await screenshot(page, name, '08-bring-to-gate');
  await input.down(1, game.dog.x, game.dog.y);
  await page.waitForFunction(() => window.flockState().game.dog.mode === 'hold');
  await input.up(1);
  const held = (await state(page)).game.dog;
  await sleep(200);
  game = (await state(page)).game;
  assert.equal(game.dog.mode, 'hold', 'lifting after a hold leaves the dog down');
  assert.equal(game.dog.x, held.x);
  assert.equal(game.dog.y, held.y);
  await screenshot(page, name, '09-holding');
  await input.down(1, held.x, held.y);
  await input.move(1, held.x + 32, held.y - 55);
  await page.waitForFunction(y => window.flockState().game.dog.y < y - 4, held.y);
  await input.up(1);

  assert.equal(await page.evaluate(() => localStorage.getItem('night-flock-2:hint-hold')), null,
    'lying down away from the gate leaves the lesson open');
  let handOffset = null;
  const holdLesson = await finishLesson(page, input, async () => {
    // The lesson appears where the field asks for the press, once sheep wait at the gate.
    await page.waitForFunction(() => window.flockState().picture === 'hold', null, { polling: 30 });
    await visibleLesson(page, 'hold');
    // The hand hides under the pause card and comes back with the field.
    await page.keyboard.press('Escape');
    await waitForScreen(page, 'paused');
    await page.waitForFunction(() => !document.querySelector('#hint-hold + .kit-hint.on'), null, { timeout: 3000 });
    await page.tap('#resume');
    await waitForScreen(page, 'play');
    await page.waitForFunction(() => window.flockState().picture === 'hold', null, { polling: 30 });
    await visibleLesson(page, 'hold');
    handOffset = await page.evaluate(() => {
      const hand = document.querySelector('#hint-hold + .kit-hint').getBoundingClientRect();
      const field = document.querySelector('#field').getBoundingClientRect();
      const { gate } = window.flockState().game.terrain;
      return { x: hand.x - field.x - field.width * gate.x / 360, y: hand.y - field.y - field.height * (gate.y + 57) / 520 };
    });
    await screenshot(page, name, '08a-hold-lesson');
  });
  assert.equal(holdLesson.heldAtGate, true);
  assert.ok(handOffset && Math.abs(handOffset.x) <= 1 && Math.abs(handOffset.y) <= 1, 'the lie-down hand sits below the cross-gate');
  assert.equal(await page.evaluate(() => localStorage.getItem('night-flock-2:hint-hold')), '1',
    'lying down at the gate completes the lesson');

  game = await selectEvening(page, 3);
  await visibleLesson(page, 'outrun');
  await screenshot(page, name, '10-outrun-lesson');
  const direction = Math.sign(game.terrain.outrun.x - 180);
  await flankFlick(page, name, game, -direction);
  await page.waitForFunction(() => window.flockState().game.dog.mode === 'outrun' &&
    window.flockState().picture === 'circle', null, { polling: 20 });
  await page.waitForFunction(() => window.flockState().game.dog.mode !== 'outrun', null, { polling: 20 });
  assert.equal((await state(page)).game.terrain.outrun.gathered, false, 'the opposite flank leaves the bellwether behind');
  assert.equal(await page.evaluate(() => localStorage.getItem('night-flock-2:hint-outrun')), null,
    'an unsuccessful flick does not mark the lesson completed');
  await visibleLesson(page, 'outrun');
  await screenshot(page, name, '10a-lesson-after-wrong-flick');
  game = await selectEvening(page, 3);
  ({ game, input } = await flankFlick(page, name, game, direction));
  await page.waitForFunction(() => window.flockState().game.dog.mode === 'outrun', null, { polling: 20 });
  await screenshot(page, name, '11-outrun');
  // A finger on the field cannot call the dog off its circle.
  await input.down(1, 180, 470);
  await sleep(250);
  const circling = (await state(page)).game;
  assert.ok(circling.dog.mode === 'outrun' || circling.terrain.outrun.gathered, 'a touch during the outrun leaves it running');
  await input.up(1);
  await page.waitForFunction(x => Math.abs(window.flockState().game.dog.x - x) > 15, game.dog.x);

  const outrunLesson = await finishLesson(page, input);
  assert.equal(await page.evaluate(() => localStorage.getItem('night-flock-2:hint-outrun')), '1',
    'gathering the bellwether marks the lesson completed');

  game = await selectEvening(page, 20);
  assert.equal(game.sheep.length, 80);
  await screenshot(page, name, '12-last-evening');
  // Time the actual page callback, including catch-up ticks, painting and the HUD.
  // The first seconds contain all eighty active animals. Starting a fresh field
  // between bursts keeps arrivals and losses from reducing the workload.
  const samples = [], intervals = [];
  for (let run = 0; run < 4; run++) {
    if (run) game = await selectEvening(page, 20);
    if (run % 2) {
      const side = Math.sign(game.terrain.outrun.x - game.dog.x);
      await flankFlick(page, name, game, side);
    } else {
      input = await steering(page, name);
      await input.down(1, game.dog.x, game.dog.y);
      await input.up(1);
    }
    const beforeBurst = await state(page);
    if (run % 2) assert.equal(beforeBurst.game.dog.mode, 'outrun', 'time a working flank command');
    await page.evaluate(() => { window.frameProbe = []; });
    await page.waitForFunction(() => window.frameProbe.length >= 20, null, {polling: 30});
    const burst = await page.evaluate(() => {
      const rows = window.frameProbe;
      window.frameProbe = null;
      return rows;
    });
    const { game: finish, screen } = await state(page);
    assert.equal(screen, 'play');
    assert.equal(finish.status, 'play');
    assert.ok(finish.time > beforeBurst.game.time + .1 && finish.sheep.every(sheep => sheep.status === 'field'),
      'every timed frame advances a full flock');
    samples.push(...burst.map(([, cost]) => cost));
    intervals.push(...burst.slice(1).map(([now], index) => now - burst[index][0]));
  }
  const quantiles = values => {
    values.sort((a, b) => a - b);
    return { p95: values[Math.ceil(values.length * .95) - 1], max: values.at(-1) };
  };
  const timing = { sheep: 80, frames: samples.length, callbackMs: quantiles(samples), intervalMs: quantiles(intervals) };
  console.log(name + ' frame timings ' + JSON.stringify(timing));
  assert.ok(timing.callbackMs.max < 16.7, 'full-flock game callback fits in 16.7 ms');
  return { timing, holdLesson, outrunLesson };
}

const tidy = text => text.normalize('NFC').trim().replace(/\s+/gu, ' ');
const escapePattern = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const copyPattern = copy => new RegExp(`^${tidy(copy).split(/\{\w+\}/).map(escapePattern).join('.+?')}$`, 'iu');
// Which shown strings are English table entries and not Turkish ones.
function englishCopy(tables) {
  assert.deepEqual(Object.keys(tables.en).sort(), Object.keys(tables.tr).sort(), 'English and Turkish have identical keys');
  for (const [key, en] of Object.entries(tables.en)) {
    const tr = tables.tr[key];
    assert.ok(en.trim() && tr.trim(), `${key} has copy in both languages`);
    const fields = copy => [...new Set(copy.match(/\{\w+\}/g))].sort();
    assert.deepEqual(fields(en), fields(tr), `${key} interpolates the same fields`);
  }
  const en = Object.values(tables.en).filter(copy => /[a-z]{2,}/i.test(copy.replace(/\{\w+\}/g, ''))).map(copyPattern);
  const tr = Object.values(tables.tr).map(copyPattern);
  const untranslated = value => en.some(pattern => pattern.test(value)) && !tr.some(pattern => pattern.test(value));
  const sentences = new Intl.Segmenter('en', { granularity: 'sentence' });
  const pieces = text => [text, ...text.split(/\s+(?:·|\/)\s+/u), ...Array.from(sentences.segment(text), part => part.segment)];
  return values => [...new Set(values.flatMap(pieces).map(tidy))].filter(untranslated);
}
// Every string a player can see or hear read out: text nodes, labels, and words painted on a canvas.
async function screenCopy(page) {
  return page.evaluate(() => {
    const all = [document.title, ...window.paintedText];
    for (const el of document.querySelectorAll('body *')) {
      if (!el.getClientRects().length || getComputedStyle(el).visibility !== 'visible') continue;
      for (const node of el.childNodes) if (node.nodeType === Node.TEXT_NODE) all.push(node.textContent);
      for (const attr of ['aria-label', 'aria-description', 'alt', 'title', 'placeholder']) {
        if (el.hasAttribute(attr)) all.push(el.getAttribute(attr));
      }
    }
    window.paintedText.clear();
    return all;
  });
}
// The card on top, or the field page, fits the viewport, and no button cuts its label.
async function overflow(page) {
  return page.evaluate(() => {
    const failures = [], epsilon = 2;
    const name = el => el.id ? `#${el.id}` : `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`;
    const outside = (a, b, min, max) => a < min - epsilon || b > max + epsilon;
    if (document.documentElement.scrollWidth > innerWidth + epsilon) failures.push('document scrolls horizontally');
    const top = document.querySelector('.sheet.on') ?? document.querySelector('.folio');
    for (const el of top.querySelectorAll('*')) {
      if (el instanceof SVGElement && el.ownerSVGElement || !el.getClientRects().length || el.closest('.kit-hint')) continue;
      const rect = el.getBoundingClientRect(), style = getComputedStyle(el);
      if (style.visibility !== 'visible') continue;
      if (outside(rect.left, rect.right, 0, innerWidth)) failures.push(`${name(el)} exceeds viewport width`);
      if (outside(rect.top, rect.bottom, 0, innerHeight)) failures.push(`${name(el)} exceeds viewport height`);
      if (el.clientWidth && el.scrollWidth > el.clientWidth + epsilon && /hidden|clip|auto|scroll/.test(style.overflowX)) {
        failures.push(`${name(el)} clips content horizontally`);
      }
      // Words stay inside the card or the page column, not only inside the viewport.
      if ([...el.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim())) {
        const frame = (top.querySelector('.card') ?? top).getBoundingClientRect(), range = document.createRange();
        range.selectNodeContents(el);
        for (const line of range.getClientRects()) {
          if (outside(line.left, line.right, frame.left, frame.right)) failures.push(`${name(el)} words leave their column`);
        }
      }
      if (el instanceof HTMLButtonElement) {
        const range = document.createRange();
        range.selectNodeContents(el);
        for (const childRect of range.getClientRects()) {
          if (outside(childRect.left, childRect.right, rect.left, rect.right)) failures.push(`${name(el)} clips its label`);
        }
      }
    }
    return [...new Set(failures)];
  });
}

// A new player with a Turkish link: every screen of the first evening, the recording switch, and a small phone.
// A first-time player inside the page: it reads only what teach.js pictures and answers with the pictured gesture
// one second later (the naive bot of bots.mjs, through real pointer events). It stops when the evening ends.
function followPictures(page) {
  return page.evaluate(async () => {
    const { cue } = await import('/flock/teach.js');
    const field = document.querySelector('#field');
    let down = false, stroke = null, seen = null, since = 0, flicked = -9, pressing = false;
    const send = (type, x, y) => {
      const r = field.getBoundingClientRect();
      field.dispatchEvent(new PointerEvent(type, {
        pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1,
        clientX: r.left + r.width * x / 360, clientY: r.top + r.height * y / 520, bubbles: true, cancelable: true,
      }));
    };
    const at = { x: 180, y: 400 };
    const go = (x, y) => { send(down ? 'pointermove' : 'pointerdown', x, y); down = true; at.x = x; at.y = y; };
    const lift = () => { if (down) send('pointerup', at.x, at.y); down = false; };
    const timer = setInterval(() => {
      const { game, screen } = window.flockState();
      if (screen !== 'play' || game.status !== 'play') { lift(); if (screen === 'end') clearInterval(timer); return; }
      const now = performance.now() / 1000;
      const picture = cue(game), kind = picture?.kind ?? null;
      if (kind !== seen) { seen = kind; since = now; }
      const shown = now - since >= 1;
      const sheep = game.sheep.filter(s => s.status === 'field');
      if (!sheep.length) return;
      if (kind !== 'hold') pressing = false;
      if (shown && kind === 'circle') { stroke = null; return lift(); }
      if (shown && kind === 'outrun') {
        stroke = null;
        lift();
        if (now - flicked < 2.5) return;
        flicked = now;
        send('pointerdown', game.dog.x, game.dog.y);
        send('pointermove', game.dog.x + picture.dir * 70, game.dog.y - 5);
        send('pointerup', game.dog.x + picture.dir * 70, game.dog.y - 5);
        return;
      }
      if (shown && kind === 'hold') {
        stroke = null;
        if (pressing) return;
        lift();
        go(game.dog.x, game.dog.y);
        go(picture.x, picture.y);
        pressing = true;
        return;
      }
      if (shown && (kind === 'wolf' || kind === 'edge')) { stroke = null; return go(picture.x, picture.y); }
      const low = sheep.reduce((a, b) => b.y > a.y ? b : a);
      if (shown && kind === 'bring') {
        const dx = picture.x - low.x, dy = picture.y - low.y, far = Math.hypot(dx, dy) || 1;
        if (!stroke?.along || stroke.done >= 80) {
          lift();
          stroke = { along: true, done: 0, x: Math.min(340, Math.max(20, low.x - 40 * dx / far)), y: Math.min(505, low.y - 40 * dy / far) };
        }
        stroke.x += 2.6 * dx / far;
        stroke.y += 2.6 * dy / far;
        stroke.done += 2.6;
        return go(stroke.x, stroke.y);
      }
      if (!stroke || stroke.along || stroke.y <= 140) { lift(); stroke = { x: low.x, y: Math.min(505, low.y + 40) }; }
      stroke.y -= 2.6;
      go(stroke.x, stroke.y);
    }, 100);
  });
}

async function turkish(browser, profile, name) {
  const report = {};
  for (const size of [profile.viewport, { width: 320, height: 568 }]) {
    const context = await browser.newContext({ ...profile, viewport: size });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    const lab = await answerLab(context, origin);
    await context.addInitScript(() => {
      if (location.protocol !== 'http:') return;
      localStorage.setItem('hf-lab-send-localhost', '1');
      localStorage.setItem('notes.k', 'phone-check');
      window.flockCheckFrames = 0;
      requestAnimationFrame(function countFrame() {
        window.flockCheckFrames++;
        requestAnimationFrame(countFrame);
      });
      window.paintedText = new Set();
      for (const method of ['fillText', 'strokeText']) {
        const paint = CanvasRenderingContext2D.prototype[method];
        CanvasRenderingContext2D.prototype[method] = function (value, ...args) {
          if (this.globalAlpha > 0) window.paintedText.add(String(value));
          return paint.call(this, value, ...args);
        };
      }
    });
    try {
      if (name === 'webkit') {
        await page.goto('about:blank');
        await wakeDisplay(page);
      }
      // The old lab address hands the visitor on, with the link's settings.
      await page.goto(`${origin}/lab/night-flock-2/?lang=tr&look=pine`);
      await page.waitForURL(`${url}?lang=tr&look=pine`);
      await page.bringToFront();
      await waitForScreen(page, 'start');
      const tables = await page.evaluate(async () => (await import('/flock/words.js')).tables);
      const leaked = englishCopy(tables);
      assert.deepEqual(leaked(['Paused', 'Try again', 'Gece Sürüsü', 'Mola']), ['Paused', 'Try again'], 'the English detector finds English and passes Turkish');
      const label = `${size.width}x${size.height}`;
      const capture = async stage => {
        await page.screenshot({ path: join(shots, `flock-${name}-tr-${label}-${stage}.png`) });
        assert.equal(await page.locator('html').getAttribute('lang'), 'tr', `${stage}: document language`);
        assert.deepEqual(await overflow(page), [], `Turkish ${label} ${stage}: content fits the viewport`);
        assert.deepEqual(leaked(await screenCopy(page)), [], `Turkish ${label} ${stage}: no English left`);
      };
      await inViewport(page, '#start .lab-notice', `Turkish ${label}: the recording notice is inside the viewport`);
      await controls(page, ['play', 'lang-start']);
      const clearOfNotes = async id => {
        const [a, b] = await Promise.all([page.locator('#notes-button').boundingBox(), page.locator(`#${id}`).boundingBox()]);
        assert.ok(a && b, 'the tester notes button and the language button are on the page');
        assert.ok(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y,
          `Turkish ${label}: #${id} is clear of the tester notes button`);
      };
      await clearOfNotes('lang-start');
      assert.equal(await page.locator('#notes-button').getAttribute('aria-label'), tables.tr.notes);
      assert.equal(await page.locator('#play').textContent(), tables.tr.playEvening.replace('{n}', '1'));
      await capture('1-start');
      assert.equal(lab.tried, 0, 'nothing is sent from the first card');
      await enter(page, name);
      await visibleLesson(page, 'drag');
      await capture('2-field');
      assert.equal(lab.tried, 0, 'nothing is sent before the first touch');
      let input = await steering(page, name);
      await beginner(page, input);
      await sleep(900);
      await capture('3-result');
      const run = await sentRun(lab, 'won');
      assert.equal(run.data.start.lang, 'tr');
      assert.equal(run.data.start.level, 1);
      if (size.height < 600) {
        // Let the light run out once: the other ending of an evening.
        await page.tap('#retry');
        await waitForScreen(page, 'play');
        const field = await page.locator('#field').boundingBox();
        await page.locator('#field').tap({ position: { x: field.width * .9, y: field.height * .95 } });
        await page.waitForFunction(() => window.flockState().screen === 'end', null, { timeout: 75000, polling: 200 });
        const night = await state(page);
        assert.equal(night.game.status, 'lost');
        assert.equal(night.game.lost, 0, 'no sheep was lost: the light ran out');
        await sleep(700);
        await capture('3a-dark');
        assert.equal(await page.locator('#end-title').textContent(), tables.tr.night);
        assert.ok(await page.locator('#next').isHidden(), 'no next evening after a loss');
        assert.ok(await page.locator('#retry').evaluate(button => button.classList.contains('primary') && document.activeElement === button),
          'Try again is the main, focused button after a loss');
        const dark = await sentRun(lab, 'dark');
        assert.equal(dark.data.summary.home, night.game.home);
        await page.tap('#end-evenings');
        await waitForScreen(page, 'evenings');
        await page.getByRole('button', { name: tables.tr.eveningShort.replace('{n}', '2'), exact: true }).tap();
      } else await page.tap('#next');
      await waitForScreen(page, 'play');
      await readyToPaint(page, name);
      assert.equal((await state(page)).game.level, 2);
      assert.equal((await state(page)).picture, 'bring', 'evening 2 pictures where the flock goes');
      await capture('4-evening-2');
      await page.tap('#pause');
      await waitForScreen(page, 'paused');
      await controls(page, ['resume', 'evenings', 'sound', 'lang-pause']);
      await clearOfNotes('lang-pause');
      await capture('5-pause');
      if (size.height < 600) {
        // The last evening, played to its end by following only what the field pictures.
        await page.evaluate(() => {
          const save = JSON.parse(localStorage.getItem('night-flock-2:save'));
          localStorage.setItem('night-flock-2:save', JSON.stringify({ ...save, unlocked: 20 }));
        });
        await page.goto(`${url}?lang=tr`);
        await waitForScreen(page, 'start');
        await enter(page, name);
        await page.tap('#pause');
        await page.tap('#evenings');
        await page.getByRole('button', { name: tables.tr.eveningShort.replace('{n}', '20'), exact: true }).tap();
        await waitForScreen(page, 'play');
        await followPictures(page);
        await sleep(2500);
        await page.screenshot({ path: join(shots, `flock-${name}-tr-${label}-6a-evening-20-line.png`) });
        await page.waitForFunction(() => window.flockState().screen === 'end', null, { timeout: 140000, polling: 200 });
        const last = await state(page);
        assert.equal(last.game.status, 'won', `following the pictures wins evening 20: ${last.game.home}/${last.game.sheep.length} home, ${last.game.lost} lost at ${last.game.time.toFixed(1)} s`);
        await sleep(900);
        await capture('7-finale');
        assert.ok(await page.locator('#end').evaluate(card => card.classList.contains('finale')));
        assert.equal(await page.locator('#end-title').textContent(), tables.tr.finale);
        assert.equal(await page.locator('#end-line').textContent(), tables.tr.finaleLine);
        assert.match(await page.locator('#end-score').textContent(), /★ \d+ \/ 60/);
        assert.equal(await page.locator('#next').textContent(), tables.tr.endless);
        const final = await sentRun(lab, 'won', 2);
        assert.equal(final.data.start.level, 20);
        report.finale = { seconds: last.game.time, home: last.game.home };
        await page.tap('#end-evenings');
        await waitForScreen(page, 'evenings');
        await page.getByRole('button', { name: tables.tr.eveningShort.replace('{n}', '2'), exact: true }).tap();
        await waitForScreen(page, 'play');
        await page.tap('#pause');
        await waitForScreen(page, 'paused');
      }
      // Recording off: the notice says so, and the next evening sends nothing.
      const sentBefore = lab.sent.length;
      await page.locator('#paused .lab-toggle input').uncheck();
      assert.equal(await page.evaluate(() => localStorage.getItem('hf-lab-recording-off')), '1');
      assert.equal(await page.evaluate(() => localStorage.getItem('hf-lab-player')), null, 'switching off forgets the player number');
      assert.equal(tidy(await page.locator('#start .lab-notice').evaluate(p => p.firstChild.data)), tables.tr.recordingOff);
      await page.tap('#evenings');
      await waitForScreen(page, 'evenings');
      await capture('6-map');
      await page.getByRole('button', { name: tables.tr.eveningShort.replace('{n}', '1'), exact: true }).tap();
      await waitForScreen(page, 'play');
      input = await steering(page, name);
      await beginner(page, input);
      await sleep(600);
      assert.equal(lab.sent.length, sentBefore, 'no record leaves with recording off');
      assert.equal((await state(page)).recording, false);
      // The switch on the pause card changes the words in place and keeps the link consistent.
      await page.tap('#retry');
      await waitForScreen(page, 'play');
      await page.tap('#pause');
      await waitForScreen(page, 'paused');
      await page.tap('#lang-pause');
      assert.equal(await page.locator('html').getAttribute('lang'), 'en');
      assert.equal(await page.locator('#pause-title').textContent(), tables.en.paused);
      assert.equal(new URL(page.url()).searchParams.get('lang'), 'en');
      assert.deepEqual(await overflow(page), [], `English ${label} pause card fits`);
      await page.goto(url);
      await waitForScreen(page, 'start');
      assert.equal(await page.locator('html').getAttribute('lang'), 'en', 'the chosen language is remembered without the link');
      assert.deepEqual(await overflow(page), [], `English ${label} first card fits`);
      await page.screenshot({ path: join(shots, `flock-${name}-en-${label}-1-start.png`) });
      assert.deepEqual(errors, [], 'browser errors in the Turkish pass');
      report[label] = { runs: runs(lab).length };
    } finally {
      await context.close();
    }
  }
  return report;
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
      if (requestOrigin === labOrigin) return route.fallback();
      if (requestOrigin !== origin) {
        outside.push(request.url());
        return route.abort();
      }
      if (request.method() !== 'GET' || !allowed(pathname)) {
        telemetry.push(`${request.method()} ${pathname}`);
        return route.abort();
      }
      assets.add(pathname);
      return route.continue();
    });
    const lab = await answerLab(context, origin);
    await context.addInitScript(() => {
      if (location.protocol !== 'http:') return;
      localStorage.setItem('hf-lab-send-localhost', '1');
      const raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = callback => {
        if (callback.name !== 'frame') return raf(callback);
        return raf(now => {
          const start = performance.now();
          callback(now);
          if (window.frameProbe) window.frameProbe.push([now, performance.now() - start]);
        });
      };
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
      let pressedAt;
      document.addEventListener('pointerdown', event => {
        if (event.target.id !== 'field') return;
        window.flockCheckPointers.push([event.pointerType, event.isTrusted, event.isPrimary]);
        if (event.isPrimary && event.isTrusted) pressedAt = event.timeStamp;
      }, { capture: true });
      document.addEventListener('pointerup', event => {
        if (event.target.id === 'field' && event.isPrimary && event.isTrusted) {
          window.flockFlickDuration = event.timeStamp - pressedAt;
        }
      }, { capture: true });
    });
    // The first WebKit viewport can stall before its first animation frame on this host.
    if (name === 'webkit') {
      await page.goto('about:blank');
      await wakeDisplay(page);
    }
    await page.goto(url);
    await page.bringToFront();
    await waitForScreen(page, 'start');
    await controls(page, ['play', 'lang-start']);
    await inViewport(page, '#start .lab-notice', 'the recording notice is on the first card, inside the viewport');
    assert.equal((await state(page)).recording, true, 'recording is allowed once the notice is on the page');
    await page.screenshot({ path: join(shots, `flock-${name}-00-start.png`) });
    await enter(page, name);
    await controls(page, ['pause']);
    await sleep(3300);
    const initial = await state(page);
    assert.equal(initial.mode, 'campaign');
    assert.equal(initial.game.level, 1, 'a fresh save opens evening 1');
    assert.equal(initial.game.sheep.length, 12, 'evening 1 starts with twelve sheep');
    assert.equal(initial.game.time, 0, 'the evening starts on first input');
    assert.equal(initial.saved.unlocked, 1);
    assert.ok(await page.evaluate(() => {
      const status = document.querySelector('.field-status').getBoundingClientRect();
      return status.bottom <= innerHeight && document.querySelector('header').getBoundingClientRect().top >= 0;
    }), 'the opening field and status fit the portrait viewport');
    assert.ok(await page.evaluate(() => window.flockGuideDraws > 0 && window.flockGuideMinAlpha >= 0.62),
      'the uphill route remains visible through the animated hand cycle');
    await screenshot(page, name, '01-first-evening');
    const idleHintOffset = await rotateIdleHint(page, name);
    assert.equal(lab.tried, 0, 'nothing is sent before the first touch on the field');
    assert.equal(await page.evaluate(() => localStorage.getItem('hf-lab-player')), null, 'no player number before the first run');
    let input = await steering(page, name);
    const first = await beginner(page, input);
    const firstRun = await sentRun(lab, 'won');
    assert.equal(firstRun.data.start.level, 1, 'the run names its evening');
    assert.equal(firstRun.data.start.mode, 'campaign');
    assert.equal(firstRun.data.summary.home, 12, 'the run summary counts the fold');
    assert.equal(firstRun.data.summary.stars, 3);
    await controls(page, ['next', 'retry', 'end-evenings']);
    await screenshot(page, name, '02-first-result');
    const won = await state(page);
    assert.equal(won.saved.unlocked, 2, 'winning evening 1 unlocks evening 2');
    assert.equal((await stored(page)).unlocked, 2);
    assert.ok(await page.locator('#stars').isVisible(), 'result explains the star awards');
    const openingStars = await page.evaluate(() => JSON.parse(localStorage.getItem('night-flock-2:stars'))[1]);
    assert.equal(openingStars, 7, 'the calm, quick opening drive earns all three stars');
    await page.tap('#retry');
    const slow = await beginner(page, input, 10);
    const lateDrive = (await state(page)).game;
    assert.ok(slow.seconds > lateDrive.par && lateDrive.minCalm >= .78);
    assert.equal(await page.locator('#stars .earned').count(), 2, 'a safe, calm drive after par earns two stars');
    assert.ok(!await page.locator('#stars .earned').filter({ hasText: 'Under par' }).count());
    assert.equal((await state(page)).stars[1], 7, 'replaying after par preserves the earlier time star');
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
    const afterWrongDrag = await page.evaluate(() => window.flockGuideDraws);
    await page.waitForFunction(n => window.flockGuideDraws > n + 1, afterWrongDrag, { polling: 50, timeout: 5000 });
    await screenshot(page, name, '02b-guide-after-sideways-drag');
    const dog = (await state(page)).game.dog;
    await input.down(1, dog.x, dog.y);
    await input.move(1, dog.x, dog.y - 33);
    await input.up(1);
    const afterUphill = await page.evaluate(() => window.flockGuideDraws);
    await readyToPaint(page, name);
    assert.equal(await page.evaluate(() => window.flockGuideDraws), afterUphill, 'the guide stops after an uphill drag');
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
    assert.ok(returned.screen === 'paused' || returned.screen === 'start' && returned.game.level === 2 && returned.game.time === 0,
      'browser Back restores a paused field or reloads the highest unlocked evening');
    if (returned.screen === 'paused') await page.tap('#resume');
    else await enter(page, name);
    if (!(await state(page)).game.started) await page.locator('#field').tap();
    assert.ok((await state(page)).game.time > 0, 'reload interrupts a running evening');

    await page.evaluate(() => localStorage.setItem('notes.k', 'phone-check'));
    await page.reload();
    await waitForScreen(page, 'start');
    assert.equal(await page.locator('#play').textContent(), 'Play · Evening 2', 'the first card names the evening it opens');
    await enter(page, name);
    assert.equal((await state(page)).game.level, 2, 'reload opens the highest unlocked evening');
    assert.equal((await state(page)).game.time, 0, 'reload clears the in-progress clock');
    await feedbackLayout(page, name);
    await page.tap('#pause');
    await waitForScreen(page, 'paused');
    const soundOn = (await state(page)).saved.sound;
    await page.tap('#sound');
    assert.equal((await stored(page)).sound, !soundOn, 'sound preference saves');
    await page.tap('#evenings');
    await waitForScreen(page, 'evenings');
    await controls(page, ['endless', 'daily', 'back']);
    assert.match(await page.getByRole('button', {name: 'Evening 1', exact: true}).getAttribute('aria-description'), /3 of 3/);
    assert.equal(await page.locator('#levels button').count(), 20, 'all valley evenings appear on the map');
    assert.equal(await page.locator('#levels button:enabled').count(), 2, 'the menu offers the two unlocked evenings');
    await screenshot(page, name, '04-evenings');
    await setDailyDate(page, '2026-12-01T23:59:00Z');
    await page.tap('#daily');
    await waitForScreen(page, 'play');
    const daily = await state(page);
    assert.equal(daily.mode, 'daily');
    assert.equal(daily.saved.unlocked, 2);
    await screenshot(page, name, '04a-daily');
    await page.tap('#pause');
    await page.tap('#evenings');
    await page.tap('#daily');
    const sameDaily = await state(page);
    assert.equal(sameDaily.game.seed, daily.game.seed, 'retrying the daily keeps the same seed');
    assert.deepEqual(sameDaily.game.sheep, daily.game.sheep, 'daily starts with the same flock');
    assert.equal(daily.game.level, 4);
    const dailyResult = await finishLesson(page, await steering(page, name));
    assert.equal(dailyResult.home, daily.game.sheep.length);
    const afterDaily = await state(page);
    assert.equal(afterDaily.saved.unlocked, 2, 'a high daily clear cannot unlock a campaign evening');
    assert.equal(afterDaily.stars[daily.game.level], undefined, 'daily stars are separate from the campaign');
    const dailyRecord = await page.evaluate(() => JSON.parse(localStorage.getItem('night-flock-2:daily')));
    assert.equal(dailyRecord.date, '2026-12-01');
    assert.ok(dailyRecord.stars & 1, 'daily record includes the no-loss star');
    await page.tap('#end-evenings');
    assert.match(await page.locator('#record').textContent(), /Daily [1-3]\/3/);
    await setDailyDate(page, '2026-12-02T00:01:00Z');
    await page.tap('#daily');
    assert.notEqual((await state(page)).game.seed, daily.game.seed, 'UTC midnight brings a different daily');
    await page.tap('#pause');
    await page.tap('#evenings');
    await setDailyDate(page, null);
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
    await enter(page, name);
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
    await enter(page, name);
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
    const newFields = await valleyChecks(page, name);
    assert.ok(assets.has('/notes/button.js'), 'the real notes button was served');
    assert.ok(runs(lab).every(r => Number.isInteger(r.data.start?.level) && typeof r.data.start.mode === 'string'),
      'every recorded run names its evening and mode');
    assert.ok(runs(lab, 'left').length > 0, 'an evening abandoned from the map is recorded as left');
    assert.deepEqual(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('night-flock:'))), [],
      'the original flock keeps its own storage namespace');
    assert.deepEqual(errors, [], 'browser errors');
    assert.deepEqual(outside, [], 'external requests');
    assert.deepEqual(telemetry, [], 'telemetry requests');
    console.log(JSON.stringify({ browser: name, device, first, slow, secondaryAt, landscape, idleHintOffset, firstWave, secondWave, bestBeforeReload, warningAt, dailySeed: daily.game.seed, dailyResult, dailyStars: dailyRecord.stars, newFields,
      errors: errors.length, externalRequests: outside.length, telemetry: telemetry.length, runsSent: runs(lab).length }));
    await context.close();
    const words = await turkish(browser, profile, name);
    console.log(JSON.stringify({ browser: name, words }));
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
