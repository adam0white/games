import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { setTimeout as delay } from 'node:timers/promises';
import { createCase, dailyCase } from './sim.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const shots = process.env.SHOTS || join(tmpdir(), 'alibi-shots');
const require = createRequire(join(
  process.env.PLAYWRIGHT || join(homedir(), 'code/human-framework/node_modules'),
  'alibi-check.js',
));
const { chromium, webkit, devices } = require('playwright');
const profiles = [
  ['iphone', webkit, { ...devices['iPhone 13'], viewport: { width: 390, height: 664 } }],
  ['pixel', chromium, devices['Pixel 7']],
  ['360', chromium, {
    viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  }],
];

const profilesToRun = process.argv.find(arg => arg.startsWith('--profile='))?.split('=')[1];
const shotsOnly = process.argv.includes('--shots-only');
const seed = 391;
const campaign = createCase({ seed, level: 1 });
const labEndpoint = 'https://human.adamwhite.work/lab/api/linked';
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

function reply(response, status, contentType, body = '') {
  response.writeHead(status, { 'content-type': contentType, 'cache-control': 'no-store' });
  response.end(body);
}

const server = createServer(async (request, response) => {
  try {
    const { pathname } = new URL(request.url, 'http://localhost');
    if (pathname === '/notes/button.js') {
      reply(response, 200, mime['.js']);
      return;
    }
    if (pathname === '/favicon.ico') {
      reply(response, 204, 'image/x-icon');
      return;
    }
    const path = resolve(root, '.' + decodeURIComponent(pathname),
      pathname.endsWith('/') ? 'index.html' : '');
    if (![resolve(root, 'alibi'), resolve(root, 'kit')].some(dir => path.startsWith(dir + sep))) {
      reply(response, 404, 'text/plain');
      return;
    }
    reply(response, 200, mime[extname(path)] ?? 'application/octet-stream', await readFile(path));
  } catch {
    reply(response, 404, 'text/plain');
  }
});

async function stubLab(context, origin, records, errors) {
  await context.addInitScript(() => {
    localStorage.setItem('hf-lab-send-localhost', '1');
    localStorage.setItem('hf-lab-privacy-override:alibi', '1');
  });
  await context.route(labEndpoint, async route => {
    const request = route.request();
    const headers = {
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'Content-Type',
    };
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    try {
      assert.equal(request.method(), 'POST');
      records.push(JSON.parse(gunzipSync(request.postDataBuffer())));
    } catch (error) {
      errors.push(`Lab envelope: ${error.message}`);
    }
    await route.fulfill({ status: 200, headers, json: { ok: true } });
  });
}

const state = page => page.evaluate(() => window.alibiState());
const press = (page, selector) => page.locator(selector).click({ timeout: 5000 });
const see = (page, screen) => page.waitForFunction(
  wanted => window.alibiState?.().screen === wanted, screen, { timeout: 5000 },
);
const pauseForRender = page => page.evaluate(() => new Promise(resolveFrame => {
  requestAnimationFrame(() => requestAnimationFrame(resolveFrame));
}));

async function shot(page, profile, name) {
  await pauseForRender(page);
  await page.screenshot({ path: join(shots, `${profile}-${name}.png`), scale: 'css' });
}

async function touch(page, path) {
  await page.locator('#c').evaluate((canvas, steps) => {
    for (const [type, point] of steps) {
      canvas.dispatchEvent(new PointerEvent(type, {
        pointerType: 'touch', pointerId: 7, isPrimary: true,
        clientX: point.x, clientY: point.y,
        pressure: type === 'pointerup' || type === 'pointercancel' ? 0 : 0.5,
        buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
        bubbles: true, cancelable: true,
      }));
    }
  }, path);
}

function gesture(from, to, release = 'pointerup') {
  assert.ok(from && to, 'gesture targets exist');
  const path = [['pointerdown', from]];
  for (let n = 1; n <= 8; n++) {
    path.push(['pointermove', {
      x: from.x + (to.x - from.x) * n / 8,
      y: from.y + (to.y - from.y) * n / 8,
    }]);
  }
  path.push([release, to]);
  return path;
}

async function scrub(page, frame) {
  const before = await state(page);
  const ticks = before.points.clock.ticks;
  await touch(page, gesture(ticks[before.frame], ticks[frame]));
  await pauseForRender(page);
  return state(page);
}

async function accuse(page, suspect, release) {
  const st = await state(page);
  await touch(page, gesture(st.points.stamp, st.points.suspects[suspect], release));
  return state(page);
}

async function accuseInScene(page, suspect) {
  const st = await state(page);
  const actor = st.points.actors.find(point => point.id === suspect);
  await touch(page, gesture(st.points.stamp, actor));
}

function inView({ x, y }, { width, height }, label) {
  assert.ok(x >= 0 && y >= 0 && x < width && y < height, `${label} offscreen at ${x},${y}`);
}

async function checkFit(page) {
  const viewport = page.viewportSize();
  const doc = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
  }));
  assert.ok(doc.width <= viewport.width + 1, 'page fits horizontally');
  assert.ok(doc.height <= viewport.height + 1, 'page fits vertically');
  const st = await state(page);
  if (st.screen === 'play') {
    inView(st.points.stamp, viewport, 'stamp');
    for (const tick of st.points.clock.ticks) inView(tick, viewport, 'clock tick');
    for (const suspect of st.points.suspects) inView(suspect, viewport, 'suspect');
  }
}

async function checkSent(records) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline && !['solved', 'wrong', 'left'].every(outcome =>
    records.some(record => record.kind === 'run' && record.data.outcome === outcome &&
      records.some(other => other.kind === 'events' && other.runId === record.runId)))) {
    await delay(30);
  }
  for (const outcome of ['solved', 'wrong', 'left']) {
    const record = records.find(record => record.kind === 'run' && record.data.outcome === outcome);
    assert.ok(record, `captured lab outcome ${outcome}`);
    assert.equal(record.game, 'alibi');
    assert.equal(record.runSource, 'agent');
    assert.equal(record.v, 2);
    assert.equal(record.data.format, 'kit-lab/1');
    assert.ok(record.data.events.length < 300);
    assert.ok(records.some(other => other.kind === 'events' && other.runId === record.runId),
      `captured lab event wrapper for ${outcome}`);
  }
}

async function runCampaign(page, profile, url) {
  await page.goto(url);
  await see(page, 'menu');
  await checkFit(page);
  assert.ok(await page.locator('#menu .lab-notice').isVisible(), 'recording notice visible on menu');
  await shot(page, profile, 'menu');

  await press(page, '#play');
  await see(page, 'play');
  const opening = await state(page);
  assert.equal(opening.level, 1);
  assert.equal(opening.stars, 3);
  assert.equal(opening.paused, false);
  await checkFit(page);
  await shot(page, profile, 'opening');
  const last = opening.points.clock.ticks.length - 1;
  const wrong = opening.points.suspects.map((_, id) => id).filter(id => id !== campaign.culprit);
  const final = await scrub(page, last);
  assert.equal(final.frame, last, 'clock advances');
  assert.notEqual(final.time, opening.time, 'the replay changes time when scrubbed');
  assert.notDeepEqual(final.points.actors, opening.points.actors, 'scene changes with replay');
  const st = await scrub(page, campaign.incident);
  const suspect = st.points.suspects[wrong[0]];
  await touch(page, [['pointerdown', suspect], ['pointerup', suspect]]);
  assert.equal((await state(page)).selected, wrong[0], 'portrait tap opens its alibi');
  await shot(page, profile, 'replay');

  if (!shotsOnly) {
    await press(page, '#pause');
    await see(page, 'paused');
    assert.equal((await state(page)).paused, true);
    assert.ok(await page.locator('#paused .lab-toggle').isVisible(), 'recording toggle visible on pause');
    await scrub(page, 0);
    assert.equal((await state(page)).time, st.time, 'clock stays put while paused');
    await press(page, '#resume');
    await see(page, 'play');
    assert.equal((await state(page)).paused, false);
    assert.equal((await scrub(page, 0)).frame, 0, 'clock rewinds on resume');

    assert.equal((await accuse(page, wrong[0], 'pointercancel')).stars, 3,
      'interrupted stamp costs no star');
    assert.equal((await accuse(page, wrong[0])).stars, 2, 'wrong accusation takes a star');
    assert.equal((await state(page)).screen, 'play', 'wrong accusation with stars left continues');
  }

  await accuseInScene(page, campaign.culprit);
  await see(page, 'done');
  assert.equal((await state(page)).outcome, 'solved');
  await shot(page, profile, 'solved');
  if (shotsOnly) return;

  const saved = await page.evaluate(() => localStorage.getItem('alibi-save'));
  assert.ok(saved && JSON.parse(saved), 'game wrote its save blob');
  assert.deepEqual(await page.evaluate(() => Object.keys(localStorage)
    .filter(key => key.startsWith('alibi') && /^[{\[]/.test(localStorage.getItem(key)))),
  ['alibi-save'], 'one game save blob');
  await page.reload();
  await see(page, 'menu');
  assert.equal(await page.evaluate(() => localStorage.getItem('alibi-save')), saved, 'save survived reload');

  const campaignUrl = new URL(url);
  campaignUrl.searchParams.delete('level');
  await page.goto(campaignUrl.href);
  await see(page, 'menu');
  await press(page, '#play');
  await see(page, 'play');
  const losing = await state(page);
  assert.equal(losing.level, 2, 'Play opened the unlocked case from the save');
  const losingCase = createCase({ seed, level: losing.level });
  const mismatches = losing.points.suspects.map((_, id) => id).filter(id => id !== losingCase.culprit);
  for (const [index, suspectId] of mismatches.slice(0, 3).entries()) {
    assert.equal((await accuse(page, suspectId)).stars, 2 - index, 'each wrong costs one star');
  }
  await see(page, 'done');
  assert.equal((await state(page)).outcome, 'wrong', 'zero stars ends case');
  await press(page, '#again');
  await see(page, 'play');
  assert.equal((await state(page)).stars, 3, 'retry starts with three stars');
  await press(page, '#pause');
  await press(page, '#toMenu');
  await see(page, 'menu');
}

async function runDaily(page, profile) {
  await page.clock.setFixedTime(new Date('2026-11-24T12:00:00Z'));
  await page.reload();
  await see(page, 'menu');
  await press(page, '#daily');
  await see(page, 'play');
  const first = await state(page);
  assert.equal(first.daily, true);
  assert.equal(first.day, '2026-11-24');
  const expected = dailyCase(first.day);
  assert.equal(first.points.suspects.length, expected.cast.length, 'daily cast matches the day seed');
  await checkFit(page);
  await accuse(page, expected.culprit);
  await see(page, 'done');
  const end = await state(page);
  assert.equal(end.outcome, 'solved');
  assert.equal(end.streak, 1, 'daily solve starts the streak');

  await press(page, '#share');
  assert.ok(await page.locator('#closeShare').isVisible(), 'share card opens');
  await shot(page, profile, 'daily-share');
  await press(page, '#closeShare');
  await page.reload();
  await see(page, 'menu');
  assert.equal((await state(page)).streak, 1, 'daily streak survived reload');
  await press(page, '#daily');
  await see(page, 'play');
  assert.equal((await state(page)).day, first.day);
  await accuse(page, expected.culprit);
  await see(page, 'done');
  assert.equal((await state(page)).streak, 1, 'replaying today does not increment the streak');

  for (const [day, streak] of [['2026-11-25', 2], ['2026-11-27', 1]]) {
    await page.clock.setFixedTime(new Date(day + 'T12:00:00Z'));
    await page.reload();
    await see(page, 'menu');
    await press(page, '#daily');
    await see(page, 'play');
    assert.equal((await state(page)).day, day);
    await accuse(page, dailyCase(day).culprit);
    await see(page, 'done');
    assert.equal((await state(page)).streak, streak, `daily streak after ${day}`);
  }
}

async function runAdvanced(page, profile, url) {
  if (profile === 'pixel') return;
  await page.goto(url.replace('level=1', 'level=21'));
  await see(page, 'menu');
  await press(page, '#play');
  await see(page, 'play');
  const st = await state(page);
  assert.equal(st.level, 21);
  await checkFit(page);
  await shot(page, profile, 'advanced');
  for (let frame = 1; frame < st.points.clock.ticks.length; frame++) {
    await scrub(page, frame);
    await shot(page, profile, `advanced-${String(frame).padStart(2, '0')}`);
  }
}

async function runProfile(profile, engine, device, origin) {
  const browser = await engine.launch();
  try {
    const context = await browser.newContext(device);
    const records = [];
    const errors = [];
    await stubLab(context, origin, records, errors);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('response', response => {
      if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    });
    const url = `${origin}/alibi/?seed=${seed}&level=1&labRunSource=agent`;
    try {
      await runCampaign(page, profile, url);
      if (!shotsOnly) {
        await runDaily(page, profile);
        await checkSent(records);
      }
      if (shotsOnly || process.argv.includes('--advanced-shots')) {
        await runAdvanced(page, profile, url);
      }
      assert.deepEqual(errors, [], 'browser errors');
      console.log(`PASS ${profile} ${device.viewport.width}×${device.viewport.height}`, shotsOnly
        ? 'menu, replay, solved and advanced screenshots'
        : 'menu, clock, alibi, cancel, correct and wrong stamps, pause, menu, saved progress, daily, share, mocked lab outcomes');
    } catch (error) {
      await shot(page, profile, 'failure').catch(() => {});
      if (errors.length) console.error(errors.join('\n'));
      throw error;
    }
  } finally {
    await browser.close();
  }
}

await mkdir(shots, { recursive: true });
await new Promise((listen, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', listen);
});
try {
  const origin = `http://127.0.0.1:${server.address().port}`;
  const selected = profiles.filter(([id]) => !profilesToRun || id === profilesToRun);
  assert.ok(selected.length, 'choose profile iphone, pixel or 360');
  for (const profile of selected) {
    try {
      await runProfile(...profile, origin);
    } catch (error) {
      console.error(`FAIL ${profile[0]}`, error);
      process.exitCode = 1;
    }
  }
  console.log(`Screenshots in ${shots}`);
} finally {
  server.close();
}
