import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { setTimeout as delay } from 'node:timers/promises';
import { createCase, dailyCase, observe } from './sim.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const shots = process.env.SHOTS || join(tmpdir(), 'alibi-shots');
const wordsShots = process.env.WORDS_SHOTS;
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
const wordsOnly = process.argv.includes('--words-only');
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
      reply(response, 200, mime['.js'], await readFile(new URL('../../workers/feedback/public/notes/button.js', import.meta.url)));
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
const press = (page, selector) => page.locator(selector).tap({ timeout: 30000 });
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

const tap = (page, point) => touch(page, [['pointerdown', point], ['pointerup', point]]);
async function hold(page, point) {
  await touch(page, [['pointerdown', point]]);
  await delay(620);
  await touch(page, [['pointerup', point]]);
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

async function checkMenus(page, url) {
  const findings = [];
  const expect = (ok, label) => { if (!ok) findings.push(label); };
  const visibleText = selector => page.locator(selector).innerText();
  await page.goto(url);
  await see(page, 'menu');
  expect(/hard daily.*case 14/is.test(await visibleText('#hardDaily')), 'locked mode names its unlock case');
  expect(/calendar/i.test(await visibleText('#openCalendar')), 'calendar button has a visible name');
  expect(/sound on/i.test(await visibleText('#menuSound')), 'sound state is readable');
  const targetFits = async selector => {
    const box = await page.locator(selector).first().boundingBox();
    return box && box.width >= 44 && box.height >= 44;
  };
  expect(await targetFits('#menu .lab-notice a'), 'Privacy link has a 44px touch target');
  await press(page, '#pickCase');
  expect(await targetFits('#caseGrid button'), 'case buttons have 44px touch targets');
  await press(page, '#caseMenu');
  await press(page, '#openCalendar');
  expect(/daily.*hard daily/i.test(await visibleText('#calendarHeading')), 'calendar decodes both streak symbols');
  await press(page, '#calendarMenu');
  await press(page, '#play');
  await press(page, '#pause');
  const consent = page.locator('#paused .lab-toggle input');
  await consent.uncheck();
  await press(page, '#toMenu');
  expect(/recording is off/i.test(await visibleText('#menu .lab-notice')), 'home acknowledges recording opt-out');
  await page.reload();
  await see(page, 'menu');
  expect(/recording is off/i.test(await visibleText('#menu .lab-notice')), 'recording disclosure survives reload');
  await press(page, '#play');
  await press(page, '#pause');
  await consent.check();
  await press(page, '#resume');
  const wrong = campaign.cast.filter(person => person.id !== campaign.culprit);
  for (const person of wrong.slice(0, 3)) await accuse(page, person.id);
  await see(page, 'done');
  expect(/3 wrong accusations/i.test(await page.locator('#resultArt').getAttribute('aria-label')), 'loss describes the rejected portraits');
  await press(page, '#again');
  await accuse(page, campaign.culprit);
  await press(page, '#skipReveal');
  expect(await page.locator('#next').evaluate(button => button.classList.contains('primary')), 'Next is the primary campaign action');
  await press(page, '#endMenu');
  await press(page, '#daily');
  const day = (await state(page)).day;
  await accuse(page, dailyCase(day).culprit);
  await press(page, '#skipReveal');
  const cardWords = await page.evaluate(() => {
    const drawn = [];
    const ctx = document.querySelector('#shareArt').getContext('2d');
    const drawText = ctx.fillText.bind(ctx);
    ctx.fillText = (value, ...args) => { drawn.push(value); drawText(value, ...args); };
    document.querySelector('#share').click();
    ctx.fillText = drawText;
    return drawn.join(' ');
  });
  expect(/alibi.*daily/i.test(cardWords), 'exported PNG names the game and daily mode');
  await page.evaluate(() => Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false }));
  const downloading = page.waitForEvent('download');
  await press(page, '#sendShare');
  expect((await downloading).suggestedFilename().endsWith('.png'), 'fallback initiates PNG download');
  expect(await page.locator('#shareStatus svg').isVisible() &&
    /download started/i.test(await page.locator('#shareStatus').textContent()), 'download shows an icon and announces feedback');
  assert.deepEqual(findings, [], 'cold-play menu regressions');
}

async function checkFirstPlay(page, url) {
  const failures = [];
  const expect = (ok, message) => { if (!ok) failures.push(message); };
  const cue = async () => {
    await pauseForRender(page);
    return page.locator('#playGuide').getAttribute('data-cue');
  };
  const touchAt = ({ x, y }) => page.touchscreen.tap(x, y);
  await page.goto(url);
  await see(page, 'menu');
  await page.locator('#play').evaluate(button => button.click());
  await pauseForRender(page);
  expect(await cue() === 'inspect', 'opening prompts portrait inspection');
  const { points } = await state(page);
  await touchAt(points.notebook);
  expect(await cue() === 'pin', 'empty notebook demonstrates how to pin evidence');
  await touchAt(points.notebook);
  await hold(page, points.suspects[0]);
  await hold(page, points.suspects[0]);
  expect(await cue() === 'duplicate', 'a duplicate pin gets a distinct cue');
  await hold(page, points.suspects[1]);
  await hold(page, points.suspects[2]);
  await hold(page, points.suspects[3]);
  expect(await cue() === 'full', 'a full notebook signals erasure');
  const erase = (await state(page)).points.notes[0].remove;
  await touchAt({ x: erase.x, y: erase.y + 21 });
  expect((await state(page)).notes.map(note => note.id).join() === '1,2', 'row-edge tap removes the intended note');
  await touchAt(points.notebook);
  const innocent = points.suspects.findIndex((_, id) => id !== campaign.culprit);
  const portrait = points.suspects[innocent];
  await touchAt({ x: portrait.x, y: portrait.y + 21.9 });
  expect((await state(page)).selected === innocent, 'portrait extends through its 44px target');
  await touchAt(portrait);
  if ((await state(page)).selected === null) await touchAt(portrait);
  expect(await cue() === 'jump', 'the claim points to its replay time');
  await scrub(page, campaign.cast[innocent].claim.beat);
  expect(await cue() === 'compare', 'at the claim time the room comparison is cued');
  // The bright ink is the raised accusation stamp. It must stay off the
  // suspect strip when the player is only comparing an honest alibi.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await delay(800);
  expect(await page.locator('#c').evaluate((canvas, strip) => {
    const ratio = canvas.width / canvas.clientWidth;
    const pixels = canvas.getContext('2d').getImageData(0, (strip.y - 34) * ratio,
      canvas.width, 119 * ratio).data;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] === 255 && pixels[i + 1] === 211 && pixels[i + 2] === 145) return false;
    }
    return true;
  }, points.suspects[0]), 'the tutorial never points an accusation stamp at a truthful portrait');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await touchAt(points.stamp);
  expect(await cue() === 'armed', 'tapping the stamp targets the portraits');
  expect((await state(page)).stars === 3, 'arming alone has no penalty');
  await touchAt(points.stamp);
  await touchAt(portrait);
  expect((await state(page)).stars === 3, 'second stamp tap cancels without charging a star');
  await touchAt(points.stamp);
  await touchAt(portrait);
  expect((await state(page)).stars === 2 && await cue() === 'wrong',
    'a chosen wrong accusation explains the lost star');
  await page.goto(url.replace('level=1', 'level=3'));
  await see(page, 'menu');
  await page.locator('#play').evaluate(button => button.click());
  await scrub(page, 1);
  expect(await cue() === 'shutter', 'the missing frame cues the claim instead');
  await page.goto(url.replace('level=1', 'level=22'));
  await see(page, 'menu');
  await page.locator('#play').evaluate(button => button.click());
  await scrub(page, createCase({ level: 22, seed }).blackoutBeat);
  expect(await cue() === 'blackout', 'blackout cues its visual sound evidence');
  await page.evaluate(() => {
    window.testTones = 0;
    const create = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function (...args) {
      window.testTones++;
      return create.apply(this, args);
    };
  });
  const current = await state(page);
  await touchAt(current.points.clock.ticks[current.frame]);
  expect(await page.evaluate(() => !window.testTones), 'an unchanged clock mark has no extra tone');
  const regular = new URL(url);
  regular.searchParams.delete('seed');
  await page.goto(regular.href);
  await see(page, 'menu');
  await page.locator('#play').evaluate(button => button.click());
  const buttons = (await state(page)).points;
  for (const id of [0, 1, 3]) {
    await touchAt(buttons.stamp);
    // The result buttons can move with localized content. Observe a stray
    // compatibility click even when the final portrait no longer covers one.
    if (id === 3) {
      await delay(1200);
      await page.evaluate(() => {
        window.lossTapClicked = false;
        document.addEventListener('click', () => { window.lossTapClicked = true; }, { capture: true, once: true });
      });
    }
    await touchAt(buttons.suspects[id]);
  }
  await delay(300);
  expect((await state(page)).screen === 'done' && await page.locator('#resultArt').isVisible(),
    'releasing the third accusation leaves the loss visible');
  expect(!await page.evaluate(() => window.lossTapClicked), 'the final tap dispatches no compatibility click');
  assert.deepEqual(failures, [], 'cold-play regressions');
}

async function runCampaign(page, profile, url) {
  await page.goto(url);
  await see(page, 'menu');
  await checkFit(page);
  assert.ok(await page.locator('#menu .lab-notice').isVisible(), 'recording notice visible on menu');
  assert.ok(await page.locator('#hardDaily').isDisabled(), 'Hard Daily starts locked');
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
    await hold(page, suspect);
    await scrub(page, last);
    const interrupted = await state(page);
    await page.reload();
    assert.equal((await state(page)).screen, 'paused', 'reload offers to resume the interrupted investigation');
    await press(page, '#resume');
    const restored = await state(page);
    for (const field of ['frame', 'selected', 'notes', 'notebook', 'stars']) {
      assert.deepEqual(restored[field], interrupted[field], `reload restores ${field}`);
    }
    assert.equal((await accuse(page, wrong[0])).stars, 2, 'reload preserves rejected suspects');
    await scrub(page, 0);
  }

  await accuseInScene(page, campaign.culprit);
  await see(page, 'reveal');
  await page.waitForFunction(() => window.alibiState().revealStage === 2);
  await delay(300);
  await shot(page, profile, 'reveal');
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
  assert.ok(await page.locator('#share').isHidden(), 'lost run has no share score');
  await press(page, '#again');
  await see(page, 'play');
  assert.equal((await state(page)).stars, 3, 'retry starts with three stars');
  await press(page, '#pause');
  await press(page, '#toMenu');
  await see(page, 'menu');
}

async function runNotebook(page, profile, url) {
  await page.goto(url.replace('level=1', 'level=8'));
  await press(page, '#play');
  await see(page, 'play');
  const opening = await state(page);
  const from = opening.points.clock.ticks[2];
  const to = opening.points.clock.ticks[3];
  await touch(page, [['pointerdown', from], ['pointermove', { x: (from.x + to.x) / 2, y: from.y }]]);
  const middle = await state(page);
  assert.ok(Math.abs(middle.time - 2.5) < 1e-9, 'scrub retains fractional time while held');
  await touch(page, [['pointerup', to]]);
  const final = await state(page);
  const start = await scrub(page, 2);
  const intermediate = middle.points.actors.find(sample => {
    const a = start.points.actors.find(actor => actor.id === sample.id);
    const b = final.points.actors.find(actor => actor.id === sample.id);
    return Math.hypot(a.x - sample.x, a.y - sample.y) > 1 && Math.hypot(b.x - sample.x, b.y - sample.y) > 1;
  });
  assert.ok(intermediate, 'a suspect walks through an intermediate position');

  await touch(page, [['pointerdown', start.points.suspects[0]], ['pointercancel', start.points.suspects[0]]]);
  assert.deepEqual((await state(page)).notes, [], 'cancelled hold has no effect');
  await hold(page, start.points.suspects[0]);
  let st = await state(page);
  const replay = createCase({ level: 8, seed });
  const room = observe(replay, 2).actors.find(actor => actor.portrait === 0).room;
  assert.deepEqual(st.notes[0], { id: 0, room, beat: 2, claim: false }, 'hold records a visible room and mark');
  assert.equal(st.selected, null, 'hold does not toggle the alibi');
  await hold(page, st.points.suspects[0]);
  assert.equal((await state(page)).notes.length, 1, 'duplicate pins use one slot');
  await hold(page, st.points.suspects[1]);
  await hold(page, st.points.suspects[2]);
  await hold(page, st.points.suspects[3]);
  st = await state(page);
  assert.equal(st.notes.length, 3, 'notebook holds three notes');
  await shot(page, profile, 'notebook');
  await tap(page, st.points.notes[1].remove);
  assert.deepEqual((await state(page)).notes.map(note => note.id), [0, 2], 'a pin can be removed');
  await scrub(page, 4);
  await tap(page, (await state(page)).points.notes[0]);
  st = await state(page);
  assert.equal(st.frame, 2, 'pin returns to its captured clock mark');
  assert.equal(st.notebook, false);

  await press(page, '#pause');
  await press(page, '#toMenu');
  await press(page, '#play');
  await see(page, 'play');
  assert.deepEqual((await state(page)).notes, [], 'a new run clears the notebook');
  await accuse(page, replay.culprit);
  await see(page, 'reveal');
  await press(page, '#skipReveal');
  await see(page, 'done');
  await press(page, '#endMenu');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('alibi-save')).level), 2,
    'out-of-order test case does not advance the campaign');
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
  await delay(1150);
  await accuse(page, expected.culprit);
  await see(page, 'reveal');
  await press(page, '#skipReveal');
  await see(page, 'done');
  const end = await state(page);
  assert.equal(end.outcome, 'solved');
  assert.equal(end.streak, 1, 'daily solve starts the streak');
  assert.ok(end.solvedSeconds >= 1, 'share time includes active play');

  await press(page, '#share');
  assert.ok(await page.locator('#closeShare').isVisible(), 'share card opens');
  assert.match(await page.locator('#shareArt').getAttribute('aria-label'), /^Alibi · Daily\. November 24, 2026\. 3 stars\. Time 0:\d\d\.$/);
  const png = await page.locator('#shareArt').evaluate(canvas => canvas.toDataURL());
  assert.ok(png.startsWith('data:image/png;base64,') && png.length > 1000, 'share preview exports PNG pixels');
  await shot(page, profile, 'daily-share');
  await press(page, '#closeShare');
  await page.reload();
  await see(page, 'menu');
  assert.equal((await state(page)).streak, 1, 'daily streak survived reload');
  await press(page, '#daily');
  await see(page, 'play');
  assert.equal((await state(page)).day, first.day);
  await accuse(page, expected.culprit);
  await see(page, 'reveal');
  await press(page, '#skipReveal');
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
    await see(page, 'reveal');
    await press(page, '#skipReveal');
    await see(page, 'done');
    assert.equal((await state(page)).streak, streak, `daily streak after ${day}`);
  }
}

async function runHardDaily(page, profile, url) {
  await page.clock.setFixedTime(new Date('2026-11-28T12:00:00Z'));
  const campaign = new URL(url);
  campaign.searchParams.delete('level');
  await page.evaluate(() => localStorage.setItem('alibi-save', JSON.stringify({
    level: 14, stars: { 1: 3 }, sound: false, daily: { last: '2026-11-27', streak: 2, best: 2 },
  })));
  await page.goto(campaign.href);
  await see(page, 'menu');
  assert.ok(await page.locator('#hardDaily').isDisabled(), 'legacy save at case 14 has not finished chapter 2');
  await press(page, '#openCalendar');
  const marker = (date, label) => page.locator(`#calendarGrid [data-day="${date}"]`, { hasText: label });
  assert.equal(await marker('2026-11-26', '✦').count(), 1, 'legacy streak implies the preceding date');
  await press(page, '#calendarMenu');
  await press(page, '#play');
  await see(page, 'play');
  assert.equal((await state(page)).level, 14);
  await accuse(page, createCase({ seed, level: 14 }).culprit);
  await see(page, 'reveal');
  await press(page, '#skipReveal');
  await press(page, '#endMenu');
  await press(page, '#hardDaily');
  await see(page, 'play');
  let st = await state(page);
  assert.equal(st.hard, true);
  assert.equal(st.points.clock.ticks.length, 12);
  const c = dailyCase(st.day, true);
  await scrub(page, c.blackoutBeat);
  assert.deepEqual((await state(page)).points.actors, [], 'blackout shows only sound evidence');
  await shot(page, profile, 'hard-blackout');
  await delay(1050);
  await accuse(page, c.culprit);
  await see(page, 'reveal');
  await press(page, '#skipReveal');
  await press(page, '#share');
  assert.match(await page.locator('#shareArt').getAttribute('aria-label'), /Hard Daily/);
  await shot(page, profile, 'hard-share');
  await press(page, '#closeShare');
  await press(page, '#endMenu');
  await press(page, '#openCalendar');
  assert.equal(await marker('2026-11-28', '◆').count(), 1, 'Hard Daily gets its own calendar mark');
  await shot(page, profile, 'calendar');
  const profileState = await page.evaluate(() => JSON.parse(localStorage.getItem('alibi-save')));
  assert.equal(profileState.sound, false, 'legacy sound setting survives save');
  assert.equal(profileState.hardDaily.streak, 1);
  assert.equal(profileState.daily.streak, 2, 'hard and standard streaks are independent');

  await page.evaluate(() => localStorage.setItem('alibi-save', JSON.stringify({ level: 21, stars: { 21: 3 } })));
  await page.reload();
  await see(page, 'menu');
  await press(page, '#play');
  st = await state(page);
  assert.equal(st.level, 22, 'completed legacy campaign opens its first new case');
}

async function runAdvanced(page, profile, url) {
  for (const [level, name, frame] of [[3, 'shutter', 1], [8, 'bakery', 4], [15, 'ship', 5], [22, 'greenhouse', 4]]) {
    await page.goto(url.replace('level=1', `level=${level}`));
    await press(page, '#play');
    await see(page, 'play');
    await checkFit(page);
    await scrub(page, frame);
    await shot(page, profile, name);
  }
}

// Count canvas fills and strokes per style in the last complete frame, so a
// check can see which training marks a case draws.
function countDraws() {
  let now = {};
  let last = -1;
  window.alibiDraws = {};
  const frame = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = callback => frame(time => {
    if (time !== last) {
      window.alibiDraws = now;
      now = {};
      last = time;
    }
    callback(time);
  });
  const proto = CanvasRenderingContext2D.prototype;
  for (const kind of ['fill', 'stroke']) {
    const original = proto[kind];
    proto[kind] = function (...args) {
      const key = kind === 'fill' ? `fill|${this.fillStyle}` : `stroke|${this.strokeStyle}|${this.lineWidth}`;
      now[key] = (now[key] || 0) + 1;
      return original.apply(this, args);
    };
  }
}

async function draws(page, key) {
  await pauseForRender(page);
  await pauseForRender(page);
  return page.evaluate(([kind, color, width]) => {
    const probe = document.createElement('canvas').getContext('2d');
    probe.fillStyle = color;
    const style = probe.fillStyle;
    // Canvas stores line widths as 32-bit floats.
    return Object.entries(window.alibiDraws).filter(([drawn]) => {
      const [k, s, w] = drawn.split('|');
      return k === kind && s === style && (kind === 'fill' || Math.abs(w - width) < .001);
    }).reduce((sum, [, n]) => sum + n, 0);
  }, key);
}

// Training marks retire after their lesson: the circle on the chosen suspect
// after chapter I, the sound bracket after the blackout lesson. Picture tags
// name the animal under each mask in the mask lesson only.
async function checkGuides(page, url) {
  await page.addInitScript(countDraws);
  const open = async level => {
    await page.goto(url.replace('level=1', `level=${level}`));
    await see(page, 'menu');
    await page.locator('#play').evaluate(button => button.click());
    await see(page, 'play');
  };
  const choose = async id => tap(page, (await state(page)).points.suspects[id]);
  const halo = ['fill', '#fff0bb50'];
  const tag = ['fill', '#fff4e0'];
  const cream = ['stroke', '#fff1ce', 2.1];
  await open(1);
  await choose(1);
  assert.ok(await draws(page, halo) > 0, 'chapter I circles the chosen suspect in the scene');
  await open(16);
  await choose(1);
  assert.equal(await draws(page, halo), 0, 'chapter III leaves the chosen suspect unmarked in the scene');
  for (const [level, shown] of [[15, true], [16, false]]) {
    await open(level);
    for (const beat of [3, 5]) {
      await scrub(page, beat);
      const tags = await draws(page, tag);
      assert.equal(tags > 0, shown, `case ${level} mask tags at mark ${beat + 1}`);
    }
    await scrub(page, 4);
    assert.equal(await draws(page, tag), 0, `case ${level} has no mask tags between mask changes`);
  }
  // A player who has not reached the mask lesson meets masks first in the
  // Daily, so the Daily shows the tags until the campaign teaches them.
  // bots.mjs asserts that every Daily puts its masks on at mark 4.
  for (const [level, shown] of [[5, true], [20, false]]) {
    await page.evaluate(level => localStorage.setItem('alibi-save', JSON.stringify({ level, campaignVersion: 2, stars: {} })), level);
    await page.goto(url.replace('level=1', 'level=0'));
    await see(page, 'menu');
    await press(page, '#daily');
    await see(page, 'play');
    await scrub(page, 3);
    assert.equal(await draws(page, tag) > 0, shown, `Daily mask tags for a player at case ${level}`);
  }
  const bracket = {};
  for (const level of [22, 23]) {
    await open(level);
    await scrub(page, createCase({ level }).blackoutBeat);
    const before = await draws(page, cream);
    await choose(0);
    bracket[level] = await draws(page, cream) - before;
  }
  assert.equal(bracket[22] - bracket[23], 4, `the sound bracket shows in the blackout lesson only: ${JSON.stringify(bracket)}`);
}

// WCAG relative-luminance contrast of two computed CSS colors.
function contrast(a, b) {
  const lum = color => {
    const [r, g, b] = color.match(/[\d.]+/g).slice(0, 3).map(v => {
      const c = v / 255;
      return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
    });
    return .2126 * r + .7152 * g + .0722 * b;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + .05) / (lo + .05);
}

// The long goal is visible: star totals in the picker and on each campaign
// result, a line at each chapter end, and a finale after the last case.
async function checkProgress(page, profile, url) {
  const campaign = new URL(url);
  campaign.searchParams.delete('level');
  const begin = async (level, stars) => {
    await page.goto(campaign.href);
    await page.evaluate(([level, stars]) => localStorage.setItem('alibi-save', JSON.stringify({
      level, campaignVersion: 2, stars, sound: false,
    })), [level, stars]);
    await page.reload();
    await see(page, 'menu');
  };
  const solve = async level => {
    await press(page, '#play');
    await see(page, 'play');
    assert.equal((await state(page)).level, level);
    await accuse(page, createCase({ seed, level }).culprit);
    await see(page, 'reveal');
    await press(page, '#skipReveal');
    await see(page, 'done');
    return page.locator('#goal').innerText();
  };

  await begin(36, { 1: 3, 2: 2, 36: 3 });
  await press(page, '#pickCase');
  await see(page, 'cases');
  assert.equal(await page.locator('#caseStars').innerText(), 'Stars 8 of 108');
  const current = page.locator('#caseGrid button.primary');
  assert.equal(await current.locator('span').innerText(), '★★★');
  const [ink, paper] = await current.evaluate(button => [
    getComputedStyle(button.querySelector('span')).color, getComputedStyle(button).backgroundColor,
  ]);
  const ratio = contrast(ink, paper);
  assert.ok(ratio >= 4.5, `stars on the current case read at ${ratio.toFixed(2)}:1`);
  await shot(page, profile, 'picker-stars');
  await press(page, '#caseMenu');
  assert.match(await solve(36), /All 36 cases solved\.[\s\S]*Stars 8 of 108/);
  await shot(page, profile, 'finale');

  // A tab checkpoint is rebuilt from seed and level. One that already rejected
  // the current liar (written before the liar changed) must not resume.
  const liar = createCase({ seed, level: 16 }).culprit;
  for (const [rejected, resumes] of [[[liar], false], [[(liar + 1) % 6], true]]) {
    await page.goto(url.replace('level=1', 'level=16'));
    await see(page, 'menu');
    // The game clears the checkpoint on leaving the menu; this listener runs after it.
    await page.evaluate(rejected => addEventListener('pagehide', () => sessionStorage.setItem('alibi-save', JSON.stringify({
      version: 1, seed: 391, level: 16, daily: false, hard: false, day: '2026-11-24', frame: 0, selected: null,
      rejected, notes: [], notebook: false, seen: [], scrolled: [], elapsed: 0,
    }))), rejected);
    await page.reload();
    await pauseForRender(page);
    assert.equal((await state(page)).screen !== 'menu', resumes, `checkpoint with rejected ${rejected} resumes: ${resumes}`);
  }

  await begin(7, { 7: 1 });
  assert.match(await solve(7), /^Chapter 1 solved\.\s+Stars 3 of 108$/);
  await begin(14, {});
  assert.match(await solve(14), /^Chapter 2 solved\. Hard Daily is open\.\s+Stars 3 of 108$/);
  await begin(9, {});
  assert.equal(await solve(9), 'Stars 3 of 108', 'a mid-chapter case shows only the star total');
}

async function checkLanguages(page, profile, url) {
  const day = '2026-11-24';
  const date = new Date(`${day}T12:00:00Z`);
  await page.addInitScript(() => {
    localStorage.setItem('notes.k', 'check');
    window.drawnWords = {};
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (value, ...args) {
      const words = window.drawnWords[this.canvas.id] ??= new Set();
      words.add(String(value));
      return fillText.call(this, value, ...args);
    };
  });
  await page.goto(url.replace('lang=en', 'lang=tr') + '&hint=0');
  await see(page, 'menu');
  const { en, tr } = await page.evaluate(async () => (await import('/alibi/words.js')).tables);
  assert.deepEqual(Object.keys(tr).sort(), Object.keys(en).sort(), 'both languages have every key');
  for (const [key, value] of Object.entries(en)) {
    const fields = text => (text.match(/\{\w+\}/g) ?? []).sort();
    assert.ok(value.trim() && tr[key].trim(), `${key}: nonempty translations`);
    assert.deepEqual(fields(tr[key]), fields(value), `${key}: the same interpolation fields`);
  }
  const regexEscape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const foreign = Object.entries(en).flatMap(([key, value]) => {
    if (value === tr[key] || !/[a-z]{2,}/i.test(value.replace(/\{\w+\}/g, ''))) return [];
    const pattern = value.split(/\{\w+\}/).map(regexEscape).join('.+?');
    return [new RegExp(`(?<![\\p{L}\\p{N}])${pattern}(?![\\p{L}\\p{N}])`, 'iu')];
  });
  const capture = async (language, name) => {
    await pauseForRender(page);
    const { overflow, phrases, canvas, current } = await page.evaluate(() => {
      const overflow = [];
      const screen = window.alibiState().screen;
      const phrases = [document.title];
      const elements = [document.querySelector('#stage'), ...document.querySelectorAll('#stage *, #notes-button')];
      for (const el of elements) {
        const bounds = el.getBoundingClientRect();
        if (!el.getClientRects().length || getComputedStyle(el).visibility === 'hidden') continue;
        if (el.getAttribute('aria-label')) phrases.push(el.getAttribute('aria-label'));
        if (el.title) phrases.push(el.title);
        const content = [...el.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join(' ').trim();
        if (content) phrases.push(content);
        if (el.matches('.sr-only') || !bounds.width || !bounds.height) continue;
        if (bounds.left < -.5 || bounds.top < -.5 || bounds.right > innerWidth + .5 || bounds.bottom > innerHeight + .5 ||
          (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1)) overflow.push(el.id || el.className || el.tagName);
      }
      const canvas = [...(window.drawnWords.c ?? [])];
      if (screen === 'done') canvas.push(...(window.drawnWords.resultArt ?? []));
      if (screen === 'sharing') canvas.push(...(window.drawnWords.shareArt ?? []));
      window.drawnWords = {};
      return { overflow, phrases, canvas, current: document.documentElement.lang };
    });
    assert.equal(current, language, name);
    assert.deepEqual(overflow, [], `${language} ${name}: nothing clips or leaves the viewport`);
    if (language === 'tr') {
      const normalized = [...phrases, ...canvas].map(phrase => phrase.trim().replace(/\s+/g, ' '));
      assert.deepEqual(normalized.filter(phrase => foreign.some(pattern => pattern.test(phrase))), [], `${name}: no English DOM, canvas or accessible copy`);
    }
    if (wordsShots && profile !== 'pixel') {
      await page.screenshot({ path: join(wordsShots, `${profile}-${language}-${name}.png`), scale: 'css' });
    }
    return canvas;
  };
  const tapClaim = async () => {
    const { x, y } = await page.locator('#c').evaluate(canvas => {
      const box = canvas.getBoundingClientRect();
      const scale = Math.min(box.width / 360, box.height / 640);
      return { x: box.left + box.width / 2, y: box.top + (box.height - 640 * scale) / 2 + 85 * scale };
    });
    await page.touchscreen.tap(x, y);
  };

  assert.equal(await page.locator('#menuLanguage span').textContent(), 'TR', 'URL selects Turkish');
  assert.equal(await page.locator('#notes-button').getAttribute('aria-label'), tr.notes);
  await press(page, '#menuLanguage');
  await page.reload();
  await see(page, 'menu');
  assert.equal(await page.locator('#menuLanguage span').textContent(), 'EN', 'menu choice survives reload after a URL override');
  await press(page, '#play');
  await press(page, '#pause');
  const before = await state(page);
  await press(page, '#pauseLanguage');
  assert.deepEqual(await state(page), before, 'switching language leaves the investigation paused and intact');
  await page.reload();
  await see(page, 'paused');
  assert.equal(await page.locator('#pauseLanguage span').textContent(), 'TR', 'pause choice survives reload');
  await press(page, '#toMenu');
  await press(page, '#menuLanguage');
  await page.clock.setFixedTime(date);

  for (const [language, table] of [['en', en], ['tr', tr]]) {
    for (const id of ['menuLanguage', 'pauseLanguage']) {
      if (id === 'pauseLanguage') { await press(page, '#play'); await press(page, '#pause'); }
      const box = await page.locator(`#${id}`).boundingBox();
      assert.ok(box.width >= 44 && box.height >= 44, `${id} has a 44px target`);
      if (id === 'pauseLanguage') { await capture(language, 'pause'); await press(page, '#toMenu'); }
    }
    await capture(language, 'menu');
    await press(page, '#pickCase');
    await capture(language, 'cases');
    await press(page, '#caseMenu');
    await press(page, '#openCalendar');
    await capture(language, 'calendar');
    await press(page, '#calendarMenu');
    await press(page, '#play');
    const { points } = await state(page);
    const innocent = campaign.cast.find(person => person.id !== campaign.culprit);
    assert.ok((await capture(language, 'first-level')).includes(table.objective), 'opening objective is painted on canvas');
    await tap(page, points.suspects[innocent.id]);
    await capture(language, 'alibi-time');
    await tapClaim();
    assert.equal((await state(page)).frame, innocent.claim.beat, 'tapping the highlighted claim visits its time');
    assert.ok((await capture(language, 'teaching')).includes('≠'), 'the comparison shows the general accusation rule');
    await tap(page, points.notebook);
    await capture(language, 'notebook-empty');
    await hold(page, points.suspects[innocent.id]);
    await capture(language, 'notebook-note');
    await tap(page, points.notebook);
    await tap(page, points.stamp);
    assert.ok((await capture(language, 'armed')).includes(table.cancel), 'armed stamp paints the localized cancel action');
    await tap(page, points.suspects[innocent.id]);
    assert.ok((await capture(language, 'wrong')).includes('='), 'wrong accusation shows a matching alibi');
    await accuse(page, campaign.culprit);
    await see(page, 'reveal');
    await capture(language, 'reveal');
    await press(page, '#skipReveal');
    await capture(language, 'win');
    await press(page, '#again');
    for (const person of campaign.cast.filter(person => person.id !== campaign.culprit).slice(0, 3)) await accuse(page, person.id);
    assert.equal((await state(page)).outcome, 'wrong');
    assert.ok((await capture(language, 'loss')).includes('='), 'loss models a same-time comparison');
    await press(page, '#endMenu');

    await press(page, '#daily');
    await accuse(page, dailyCase(day).culprit);
    await see(page, 'reveal');
    await press(page, '#skipReveal');
    await press(page, '#share');
    const pngText = await capture(language, 'daily-share');
    assert.ok(pngText.includes(`${table.title} · ${table.daily}`), 'export draws the localized title');
    const localizedDate = new Intl.DateTimeFormat(language, { dateStyle: 'long', timeZone: 'UTC' }).format(date);
    assert.ok(pngText.some(text => text.startsWith(localizedDate)), 'export draws the localized date');
    await press(page, '#closeShare');
    await press(page, '#endMenu');

    const advancedUrl = new URL(page.url());
    advancedUrl.searchParams.set('level', '3');
    await page.goto(advancedUrl.href);
    await press(page, '#play');
    await scrub(page, 1);
    await capture(language, 'shutter');
    await press(page, '#pause');
    await press(page, '#toMenu');
    await page.evaluate(() => {
      const profile = JSON.parse(localStorage.getItem('alibi-save'));
      localStorage.setItem('alibi-save', JSON.stringify({ ...profile, level: 15 }));
    });
    await page.reload();
    await press(page, '#hardDaily');
    const hardCase = dailyCase(day, true);
    await scrub(page, hardCase.blackoutBeat);
    const staggered = hardCase.cast.find(person => person.claim.beat !== hardCase.blackoutBeat);
    await tap(page, (await state(page)).points.suspects[staggered.id]);
    assert.ok(!(await capture(language, 'blackout')).includes('≠'), 'a different-time blackout does not teach accusation');
    await tapClaim();
    assert.equal((await state(page)).frame, staggered.claim.beat);
    await accuse(page, hardCase.culprit);
    await see(page, 'reveal');
    await press(page, '#skipReveal');
    await press(page, '#share');
    assert.ok((await capture(language, 'hard-share')).includes(`${table.title} · ${table.hardDaily}`));
    await press(page, '#closeShare');
    await press(page, '#endMenu');

    if (language === 'en') {
      await page.goto(url.replace('&lang=en', '') + '&hint=0');
      await see(page, 'menu');
      await press(page, '#menuLanguage');
      await page.evaluate(() => localStorage.removeItem('alibi-save'));
      await page.reload();
      await see(page, 'menu');
    }
  }
}

async function runProfile(profile, engine, device, origin) {
  const browser = await engine.launch();
  try {
    const url = `${origin}/alibi/?seed=${seed}&level=1&labRunSource=agent&lang=en`;
    if (!shotsOnly) {
      const languageContext = await browser.newContext(device);
      try {
        const errors = [];
        await stubLab(languageContext, origin, [], errors);
        const page = await languageContext.newPage();
        page.on('pageerror', error => errors.push(error.message));
        await checkLanguages(page, profile, url);
        assert.deepEqual(errors, [], 'localization browser errors');
        console.log(`PASS ${profile} English and Turkish ${device.viewport.width}×${device.viewport.height}`);
      } finally {
        await languageContext.close();
      }
    }
    if (wordsOnly) return;
    if (!shotsOnly) {
      const guideContext = await browser.newContext(device);
      try {
        const errors = [];
        await stubLab(guideContext, origin, [], errors);
        const page = await guideContext.newPage();
        page.on('pageerror', error => errors.push(error.message));
        await checkGuides(page, url);
        assert.deepEqual(errors, [], 'guide browser errors');
        await checkProgress(page, profile, url);
        console.log(`PASS ${profile} training marks retire after their lessons; star totals, chapter ends and finale show`);
      } finally {
        await guideContext.close();
      }
    }
    if (!shotsOnly) {
      const menuContext = await browser.newContext(device);
      try {
        await stubLab(menuContext, origin, [], []);
        await checkMenus(await menuContext.newPage(), url);
      } finally {
        await menuContext.close();
      }
    }
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
    try {
      if (!shotsOnly) await checkFirstPlay(page, url);
      await runCampaign(page, profile, url);
      if (!shotsOnly) {
        await runNotebook(page, profile, url);
        await runDaily(page, profile);
        await runHardDaily(page, profile, url);
        await checkSent(records);
      }
      if (shotsOnly || process.argv.includes('--advanced-shots')) {
        await runAdvanced(page, profile, url);
      }
      assert.deepEqual(errors, [], 'browser errors');
      console.log(`PASS ${profile} ${device.viewport.width}×${device.viewport.height}`, shotsOnly
        ? 'menu, replay, solved and advanced screenshots'
        : 'controls, walking, accusations, reveal, notebook, pause, legacy saves, daily and hard daily, calendar, PNG, mocked lab outcomes');
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
if (wordsShots) await mkdir(wordsShots, { recursive: true });
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
