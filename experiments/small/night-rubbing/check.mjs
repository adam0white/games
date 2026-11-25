// Run with the pinned Node version. The optional argument selects webkit or chromium.
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { assertHomeLinks } from '../../kit/check/home-link.mjs';
import { createPlate, createSheet } from './sim.js';
import { PLATES, dailySpec } from './plates.js';
import { plan, play, rate } from './plan.js';
import { answerLab, allowLocalSend, withAgent, assertNotice, assertRun, assertNoLeak, assertOffSendsNothing, waitForRuns, runRecords } from '../../kit/check/lab-record.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const path = '/small/night-rubbing/';
const away = '/rubbing-test-away';
const notes = '/notes/button.js';
const shots = process.env.SHOTS || '/private/tmp/night-r6-review/rubbing/check';
const require = createRequire(join(resolve(process.env.PLAYWRIGHT || join(homedir(), 'code/human-framework/node_modules')), 'check.cjs'));
const { chromium, devices, webkit } = require('playwright');
const profiles = [
  { name: 'webkit', engine: webkit, device: 'iPhone 13' },
  { name: 'chromium', engine: chromium, device: 'Pixel 7' }
].filter(profile => !process.argv[2] || profile.name === process.argv[2]);
assert.ok(profiles.length, 'choose webkit or chromium');
await mkdir(shots, { recursive: true });

function allowed(url) {
  return url === path || url === away || url === notes || url === '/favicon.ico'
    || /^\/small\/night-rubbing\/[\w.-]+$/.test(url)
    || /^\/kit\/(?:audio|drag|fx|hint|home|i18n|lab|music|pause|save|screens|share|stick|zoom)\.js$/.test(url);
}
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost').pathname;
  if (!allowed(url) || request.method !== 'GET') return response.writeHead(404).end();
  if (url === '/favicon.ico') return response.writeHead(204).end();
  if (url === away) return response.writeHead(200, { 'Content-Type': 'text/html' }).end('<title>Another page</title>');
  const file = url === notes ? resolve(root, '../workers/feedback/public/notes/button.js')
    : join(root, url, url === path ? 'index.html' : '');
  try {
    const data = await readFile(file);
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' }).end(data);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((done, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', done);
});
const origin = 'http://127.0.0.1:' + server.address().port;
const state = page => page.evaluate(() => window.rubbingState());
const screen = (page, value) => page.waitForFunction(name => window.rubbingState?.().screen === name, value,
  { polling: 50, timeout: 6000 });

async function controls(page, selector) {
  const viewport = page.viewportSize();
  for (const control of await page.locator(selector).all()) {
    const box = await control.boundingBox();
    assert.ok(box && box.width >= 44 && box.height >= 44, 'the control has a 44 pixel touch target');
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1
      && box.y + box.height <= viewport.height + 1, 'the touch target fits in the viewport');
  }
}

async function pointer(page, name) {
  const box = await page.locator('#field').boundingBox();
  const viewport = page.viewportSize();
  assert.ok(box?.width > 0 && box.height > 0);
  assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1
    && box.y + box.height <= viewport.height + 1, 'the full plate is visible');
  const at = (x, y) => ({ x: box.x + x / 240 * box.width, y: box.y + y / 280 * box.height });
  const cdp = name === 'chromium' ? await page.context().newCDPSession(page) : null;
  const touch = (type, touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  async function move(x, y) {
    const p = at(x, y);
    if (cdp) await touch('touchMove', [p]);
    else await page.mouse.move(p.x, p.y);
  }
  return {
    at, move,
    async down(x, y) {
      if (cdp) await touch('touchStart', [at(x, y)]);
      else { await move(x, y); await page.mouse.down(); }
    },
    up: () => cdp ? touch('touchEnd', []) : page.mouse.up(),
    close: () => cdp?.detach(),
  };
}

async function stroke(input, y, reverse = false) {
  const start = reverse ? 220 : 20;
  const direction = reverse ? -1 : 1;
  await input.down(start, y);
  try {
    for (let dx = 25; dx <= 200; dx += 25) await input.move(start + direction * dx, y);
  } finally {
    await input.up();
  }
}

async function printPixels(page) {
  const bytes = await page.locator('#field').evaluate(async canvas => {
    await new Promise(resolve => requestAnimationFrame(resolve));
    const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    let binary = '';
    for (let i = 0; i < data.length; i += 4096) binary += String.fromCharCode(...data.subarray(i, i + 4096));
    return btoa(binary);
  });
  return Buffer.from(bytes, 'base64');
}

// The proof packs pigment into eight bits per cell. Measure the RGB error over the whole restored sheet.
function comparePrints(before, after) {
  assert.equal(before.length, after.length);
  let sum = 0, max = 0;
  for (let i = 0; i < after.length; i++) {
    if (i % 4 === 3) continue;
    const error = Math.abs(before[i] - after[i]);
    sum += error;
    max = Math.max(max, error);
  }
  const mean = sum / (before.length * .75);
  assert.ok(max <= 2 && mean < 1, 'the recovered sheet preserves its pigment image and ink');
  return { mean, max };
}

async function rubPlate(page, input, level, capture) {
  const start = Date.now();
  const fresh = await state(page);
  assert.equal(fresh.level, level);
  assert.equal(fresh.screen, 'play');
  let rows = 0;
  let partial;
  for (let pass = 0; pass < 4; pass++) {
    for (let y = 40; y <= 245; y += 14) {
      await stroke(input, y, rows++ % 2 === 1);
      const s = await state(page);
      assert.equal(s.level, level, 'lifting the rubbing finger cannot turn the page');
      if (s.screen === 'result' || s.coverage >= s.goal) {
        await screen(page, 'result');
        const result = await state(page);
        assert.equal(result.level, level);
        assert.ok(result.coverage >= result.goal);
        assert.equal(result.unlocked, Math.min(level + 1, PLATES.length));
        const seconds = (Date.now() - start) / 1000;
        if (level === 1) {
          assert.ok(partial?.coverage > fresh.coverage, 'a partial first print appears during the strokes');
          assert.ok(seconds < 60, 'the first result must take under a minute');
        }
        await capture('plate-' + level);
        return { level, rows, seconds, coverage: result.coverage, partial: partial?.coverage };
      }
      if (level === 1 && !partial && s.coverage >= fresh.coverage + .12) {
        partial = s;
        await capture('partial');
      }
    }
  }
  assert.fail('broad strokes could not complete plate ' + level + ' ' + JSON.stringify(await state(page)));
}

// Recording: a played plate sends one run record under the page's name; with the switch off nothing is sent.
async function recording({ name, device }, browser) {
  const context = await browser.newContext(devices[device]);
  await context.route('**/*', route => {
    const r = route.request(), url = new URL(r.url());
    if (url.origin === origin && r.method() === 'GET' && allowed(url.pathname)) return route.continue();
    return route.abort();
  });
  const lab = await answerLab(context, origin);
  await allowLocalSend(context);
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  try {
    await page.goto(withAgent(origin + path));
    await screen(page, 'play');
    await assertNotice(page);
    assert.equal(lab.sent.length, 0, 'nothing is sent before a plate is rubbed');
    let input = await pointer(page, name);
    await rubPlate(page, input, 1, async () => {});
    await input.close();
    await waitForRuns(lab, 'night-rubbing', 1);
    const won = assertRun(lab, 'night-rubbing', { outcomes: ['won'], summaryKeys: ['level', 'coverage', 'unlocked'] });
    assert.equal(won.data.summary.level, 1);
    assert.ok(won.data.events.some(e => e.type === 'plate-filed'), 'the filed plate is an event');
    assertNoLeak(lab, ['rubbing-test-away']);
    await page.locator('#pause').tap();
    await screen(page, 'paused');
    await assertOffSendsNothing(page, lab, 'night-rubbing', { play: async () => {
      await page.locator('#restart').tap();
      await screen(page, 'play');
      input = await pointer(page, name);
      await rubPlate(page, input, 1, async () => {});
      await input.close();
    } });
  } finally { await context.close(); }
}

// The strokes the careful rubber (plan.js) actually uses on a sheet, worked out in Node on the same plate and paper.
function carefulStrokes(make) {
  const s = make(), used = [];
  for (const offset of [0, 0.5, 0.25]) {
    if (s.done || s.spoiled) break;
    for (const line of plan(s, { offset })) {
      if (s.done || s.spoiled) break;
      play(s, [line]);
      used.push(line);
    }
  }
  return used;
}
async function line(input, [x0, y0, x1, y1]) {
  await input.down(x0, y0);
  try {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 10));
    for (let k = 1; k <= n; k++) await input.move(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n);
  } finally { await input.up(); }
}
async function replay(page, input, lines) {
  for (let round = 0; round < 2; round++) {
    for (const l of lines) {
      await line(input, l);
      const s = await state(page);
      if (s.screen !== 'play') return s;
    }
  }
  return state(page);
}

// Plates 7 to 12, stars, the daily plate, sharing and Turkish (2026-11-25).
async function deeper({ name, device }, browser) {
  const context = await browser.newContext(devices[device]);
  const errors = [], unexpected = [];
  await context.route('**/*', route => {
    const r = route.request(), url = new URL(r.url());
    if (url.origin === origin && r.method() === 'GET' && allowed(url.pathname)) return route.continue();
    unexpected.push(r.method() + ' ' + r.url());
    return route.abort();
  });
  const lab = await answerLab(context, origin);
  await allowLocalSend(context);
  await context.addInitScript(() => {
    if (sessionStorage.getItem('deeper-seeded')) return;
    sessionStorage.setItem('deeper-seeded', '1');
    localStorage.setItem('hf-lab-send-localhost', '1');
    // A save from before plates 7 to 12: the old page could only reach unlocked 6, with plate 6 filed.
    localStorage.setItem('night-rubbing:save', JSON.stringify({ level: 6, unlocked: 6, sound: true, ink: 'black' }));
    localStorage.setItem('night-rubbing:proof:6', JSON.stringify({ grain: 1, marks: '', coverage: 0.9, distance: 2000, red: false }));
    localStorage.setItem('night-rubbing:hint', '1');
    localStorage.setItem('kit:lang', 'en');
    window.rubbingShared = [];
  });
  await context.addInitScript(() => {
    window.rubbingShared = [];
    navigator.canShare = () => true;
    navigator.share = async data => { window.rubbingShared.push({ files: data.files?.map(file => [file.type, file.size]), text: data.text }); };
  });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  // The sheet paints on the next animation frame: wait two frames so the picture matches the state.
  const capture = async scene => {
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.screenshot({ path: join(shots, name + '-' + scene + '.png'), scale: 'css' });
  };
  const day = '2026-11-25';
  const out = {};
  try {
    await page.goto(withAgent(origin + path) + '&date=' + day);
    await screen(page, 'play');
    let s = await state(page);
    assert.equal(s.level, 6, 'the old save opens on its plate');
    assert.equal(s.unlocked, 7, 'an old save with plate 6 filed opens plate 7');
    assert.equal(await page.locator('#collection button:enabled').count(), 7);
    await controls(page, '#pause, #daily, #collection button');

    // Plate 7: the stick wears down. The old way (whole-sheet sweeps) runs out; the careful way files it.
    await page.locator('#collection button').nth(6).tap();
    await screen(page, 'play');
    s = await state(page);
    assert.equal(s.level, 7);
    assert.equal(s.kind, 'lead');
    assert.equal(await page.locator('#status').innerText(), 'The stick wears down. Rub only the fossil.');
    assert.ok(await page.locator('#lead').isVisible(), 'the stick meter shows');
    await capture('plate7-start');
    let input = await pointer(page, name);
    for (let y = 30, n = 0; y < 270 && (await state(page)).screen === 'play'; y += 15, n++) await stroke(input, y, n % 2 === 1);
    s = await state(page);
    assert.equal(s.screen, 'result');
    assert.equal(s.spoiled, 'lead', 'whole-sheet sweeps wear the stick out on plate 7');
    assert.match(await page.locator('#next').innerText(), /Try again/);
    assert.ok(s.fx.includes('spoiled-lead') && s.fx.includes('stick-low'), 'the stick running low and out answers with sound and motion');
    out.plate7Spoiled = Math.round(s.distance);
    await capture('plate7-spoiled');
    await page.locator('#next').tap();
    await screen(page, 'play');
    assert.equal((await state(page)).distance, 0, 'Try again gives a clean sheet');
    s = await replay(page, input, carefulStrokes(() => createPlate(7, 19023 + 7 * 583)));
    assert.equal(s.screen, 'result');
    assert.ok(!s.spoiled && s.stars >= 2, `the careful strokes file plate 7 with two or three stars (${s.stars})`);
    out.plate7 = { stars: s.stars, distance: Math.round(s.distance), par: s.par, lead: s.lead };
    await capture('plate7-filed');
    await controls(page, '#share, #next');
    await page.locator('#share').tap();
    await page.waitForFunction(() => window.rubbingShared.length === 1);
    const [shared] = await page.evaluate(() => window.rubbingShared);
    assert.ok(shared.files.length === 1 && shared.files[0][0] === 'image/png' && shared.files[0][1] > 20000, 'one PNG picture is shared');
    assert.match(shared.text, /Young ammonite: ★+☆* with \d+% of the stick left/);
    const saved = await page.evaluate(() => ({ save: JSON.parse(localStorage.getItem('night-rubbing:save')), more: JSON.parse(localStorage.getItem('night-rubbing:more')),
      stars: JSON.parse(localStorage.getItem('night-rubbing:stars')) }));
    assert.deepEqual(Object.keys(saved.save).sort(), ['ink', 'level', 'sound', 'unlocked'], 'the old key keeps its format');
    assert.ok(saved.save.unlocked <= 6 && saved.save.level <= 6, 'the old key stays within plates 1 to 6');
    assert.equal(saved.more.unlocked, 8);
    assert.equal(saved.stars.best[7], out.plate7.stars);

    // Plate 8 is glazed: a stroke along its level discs leaves less than the same stroke across them.
    await page.locator('#next').tap();
    await screen(page, 'play');
    assert.equal((await state(page)).kind, 'glaze');
    await line(input, [80, 160, 160, 160]);
    const along = (await state(page)).coverage;
    await page.locator('#pause').tap(); await screen(page, 'paused');
    assert.match(await page.locator('#tip').innerText(), /glazed plate/i);
    await capture('plate8-paused');
    await page.locator('#restart').tap(); await screen(page, 'play');
    await line(input, [120, 120, 120, 200]);
    const across = (await state(page)).coverage;
    assert.ok(across > along * 1.5, `on a glazed plate a stroke across the ridges marks more than one along them (${across} / ${along})`);
    out.glaze = { along, across };
    await capture('plate8-across');

    // Plate 9 sits in grit: a stroke through it smudges.
    await page.evaluate(() => localStorage.setItem('night-rubbing:more', JSON.stringify({ v: 1, level: 9, unlocked: 12 })));
    await page.reload();
    await screen(page, 'play');
    s = await state(page);
    assert.equal(s.level, 9);
    assert.equal(s.kind, 'stone');
    assert.equal(await page.locator('#collection button:enabled').count(), 12);
    await input.close();
    input = await pointer(page, name);
    await line(input, [10, 20, 230, 20]);
    s = await state(page);
    assert.ok(s.smudge > 0 && s.fx.includes('smudge'), 'a stroke through the grit smudges, and says so');
    assert.ok(await page.locator('#smudge').isVisible());
    out.smudge = s.smudge;
    await capture('plate9-smudge');
    for (const level of [10, 11, 12]) {
      await page.locator('#collection button').nth(level - 1).tap();
      await screen(page, 'play');
      await capture('plate' + level);
    }

    // The daily plate: the same for everyone on the day, filed by the careful strokes, its best kept, shared with its day.
    await page.locator('#daily').tap();
    await screen(page, 'play');
    s = await state(page);
    const spec = dailySpec(day), rated = rate(spec, spec.seed, createSheet);
    assert.equal(s.daily, day);
    assert.equal(s.kind, spec.kind);
    assert.equal(s.par, rated.par);
    await capture('daily-start');
    s = await replay(page, input, carefulStrokes(() => createSheet({ ...spec, ...rated }, spec.seed)));
    assert.equal(s.screen, 'result');
    assert.ok(s.stars >= 2 && s.dailyRecord.stars === s.stars, `the daily plate is filed (${s.stars} stars) and kept`);
    out.daily = { plate: spec.plate, kind: spec.kind, stars: s.stars };
    await capture('daily-filed');
    await page.evaluate(() => { window.rubbingShared = []; });
    await page.locator('#share').tap();
    await page.waitForFunction(() => window.rubbingShared.length === 1);
    assert.match((await page.evaluate(() => window.rubbingShared))[0].text, new RegExp('daily ' + day));
    await input.close();

    // Turkish: every string on the board and the pause card.
    await page.goto(withAgent(origin + path) + '&date=' + day + '&lang=tr');
    await screen(page, 'play');
    assert.equal((await state(page)).lang, 'tr');
    assert.equal(await page.locator('[data-i18n=eyebrow]').textContent(), 'Fosil frotajları');
    assert.equal(await page.locator('#status').innerText(), 'Sırlı ve taşlı: iki yönde, taşa değmeden', 'plate 12 teaches in Turkish');
    await page.locator('#pause').tap(); await screen(page, 'paused');
    assert.equal(await page.locator('#pause-title').innerText(), 'Frotaj durdu');
    assert.equal(await page.locator('#resume').innerText(), 'Sürmeye devam et');
    await capture('turkish-paused');
    await page.locator('#resume').tap();

    await waitForRuns(lab, 'night-rubbing', 3);
    const runs = runRecords(lab, 'night-rubbing');
    const outcomes = runs.map(r => r.data.outcome);
    assert.ok(outcomes.includes('lost') && outcomes.includes('won'), 'a spoiled plate ends lost, a filed one won: ' + outcomes);
    const filed = runs.flatMap(r => r.data.events || []).filter(e => e.type === 'plate-filed');
    assert.ok(filed.some(e => e.data?.stars >= 2), 'the filed event carries stars');
    assert.deepEqual(errors, [], 'browser errors');
    assert.deepEqual(unexpected, [], 'unexpected requests');
    console.log(JSON.stringify({ device, deeper: out }));
  } finally { await context.close(); }
}

async function run({ name, engine, device }) {
  const browser = await engine.launch({ headless: true });
  try {
    const context = await browser.newContext(devices[device]);
    const unexpected = [];
    const errors = [];
    const requests = new Set();
    await context.route('**/*', route => {
      const r = route.request();
      const url = new URL(r.url());
      if (url.origin !== origin || r.method() !== 'GET' || !allowed(url.pathname)) {
        unexpected.push(r.method() + ' ' + r.url());
        return route.abort();
      }
      requests.add(url.pathname);
      return route.continue();
    });
    const lab = await answerLab(context, origin);
    await context.addInitScript(() => {
      // The kit otherwise suppresses telemetry on localhost. Exercise its production setting.
      localStorage.setItem('hf-lab-send-localhost', '1');
      window.strokeInputTypes = {};
      document.addEventListener('pointermove', event => {
        if (event.target.id === 'field' && event.isTrusted && event.isPrimary && event.buttons) {
          window.strokeInputTypes[event.pointerType] = true;
        }
      }, true);
    });
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
    page.on('requestfailed', r => errors.push(r.url() + ' ' + r.failure()?.errorText));
    page.on('websocket', s => unexpected.push(s.url()));
    const capture = scene => page.screenshot({ path: join(shots, name + '-' + scene + '.png'), scale: 'css' });
    const tap = id => page.locator('#' + id).tap();
    const portrait = page.viewportSize();
    const rotate = () => page.setViewportSize({ width: portrait.height, height: portrait.width });
    const restorePortrait = () => page.setViewportSize(portrait);

    await page.goto(withAgent(origin + path));
    await screen(page, 'play');
    const fresh = await state(page);
    assert.equal(fresh.level, 1);
    assert.equal(fresh.unlocked, 1);
    assert.equal(await page.locator('#notes-button').count(), 0, 'fresh players see the public game');
    await controls(page, '#pause, #collection button');
    assert.equal(await page.locator('#collection button:enabled').count(), 1);
    await capture('opening');
    await page.locator('.kit-hint.on').waitFor({ state: 'attached' });
    await rotate();
    const track = await page.locator('.kit-hint .track').boundingBox();
    const rotatedSheet = await page.locator('#field').boundingBox();
    assert.ok(track && rotatedSheet && track.x >= rotatedSheet.x
      && track.x + track.width <= rotatedSheet.x + rotatedSheet.width
      && track.y >= rotatedSheet.y && track.y + track.height <= rotatedSheet.y + rotatedSheet.height,
      'the first-use demo stays on the sheet after rotation');
    await capture('landscape-hint');
    await restorePortrait();
    let input = await pointer(page, name);
    const center = input.at(120, 140);
    await page.touchscreen.tap(center.x, center.y);
    await input.down(120, 140);
    await sleep(400);
    await input.up();
    assert.equal((await state(page)).coverage, fresh.coverage, 'stationary contact deposits no pigment');
    assert.equal((await state(page)).distance, fresh.distance, 'stationary contact is not a stroke');
    assert.equal(await page.locator('#status').innerText(), 'Rub across the fossil',
      'a stationary first touch does not remove the instruction');

    const results = [await rubPlate(page, input, 1, capture)];
    const originalPrint = await printPixels(page);
    const kind = name === 'webkit' ? 'mouse' : 'touch';
    assert.equal(await page.evaluate(k => window.strokeInputTypes[k], kind), true, 'rubbing uses trusted input');
    await controls(page, '#next');
    await tap('next');
    await screen(page, 'play');
    assert.equal((await state(page)).level, 2);
    await input.close();
    input = await pointer(page, name);
    const clean = await state(page);
    await stroke(input, 140);
    const rubbed = await state(page);
    assert.ok(rubbed.distance > clean.distance && rubbed.coverage > clean.coverage, 'one stroke leaves a mark');
    assert.equal(await page.locator('#status').innerText(), 'Taking an impression');
    await input.down(156, 84);
    await rotate();
    await page.evaluate(() => new Promise(requestAnimationFrame));
    await input.move(158, 84);
    await input.up();
    assert.deepEqual(await state(page), rubbed, 'rotation ends an active stroke without marking the sheet');
    await input.close();
    await controls(page, '#pause, #collection button');
    assert.equal(await page.evaluate(() => document.documentElement.scrollHeight), portrait.width,
      'the cabinet fits in the rotated viewport');
    input = await pointer(page, name);
    const beforeLandscapeStroke = await printPixels(page);
    await stroke(input, 100);
    const rotated = await state(page);
    assert.ok(rotated.distance > rubbed.distance, 'a rotated sheet accepts strokes');
    const afterLandscapeStroke = await printPixels(page);
    // The fern's contact radius is 28, with two pixels allowed for input rounding.
    const firstRow = 70 * 240 * 4;
    const rowAfterLast = 131 * 240 * 4;
    assert.ok(!beforeLandscapeStroke.subarray(firstRow, rowAfterLast).equals(afterLandscapeStroke.subarray(firstRow, rowAfterLast))
      && beforeLandscapeStroke.subarray(0, firstRow).equals(afterLandscapeStroke.subarray(0, firstRow))
      && beforeLandscapeStroke.subarray(rowAfterLast).equals(afterLandscapeStroke.subarray(rowAfterLast)),
      'the rotated stroke marks the rows under the pencil');
    await capture('landscape');
    await tap('pause');
    await screen(page, 'paused');
    const paused = await state(page);
    await controls(page, '#paused button');
    assert.match(await page.locator('#paused p').innerText(), /pale ridges, including the tips/);
    await sleep(350);
    assert.equal((await state(page)).coverage, paused.coverage);
    assert.equal((await state(page)).distance, paused.distance);
    assert.equal(await page.locator('#resume').evaluate(button => button === document.activeElement), true);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    const muted = (await state(page)).sound;
    assert.equal(muted, !paused.sound);
    assert.equal(await page.locator('#sound').evaluate(button => button === document.activeElement), true,
      'toggling sound keeps keyboard focus on the switch');
    const previousInk = await page.locator('#ink').innerText();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    assert.notEqual(await page.locator('#ink').innerText(), previousInk);
    assert.equal(await page.locator('#ink').evaluate(button => button === document.activeElement), true,
      'toggling medium keeps keyboard focus on the switch');
    await capture('landscape-paused');
    await restorePortrait();
    await capture('paused');
    await tap('resume');
    await screen(page, 'play');
    assert.equal(await page.locator('#field').evaluate(canvas => canvas === document.activeElement), true);
    assert.equal((await state(page)).coverage, rotated.coverage);
    await tap('pause');
    await screen(page, 'paused');
    await tap('restart');
    await screen(page, 'play');
    assert.equal((await state(page)).level, 2);
    assert.equal((await state(page)).coverage, clean.coverage);
    assert.equal((await state(page)).distance, clean.distance);
    await input.close();
    input = await pointer(page, name);
    await stroke(input, 140);
    assert.ok((await state(page)).distance > 0, 'reload is tested with an unfinished print');
    await capture('before-reload');
    await input.close();
    await page.evaluate(() => localStorage.setItem('notes.k', 'local-phone-check'));
    await page.reload();
    await screen(page, 'play');
    const reloaded = await state(page);
    assert.equal(reloaded.level, 2);
    assert.equal(reloaded.unlocked, 2);
    assert.equal(reloaded.sound, muted);
    assert.equal(reloaded.distance, 0, 'an unfinished print restarts on reload');
    await capture('after-reload');
    await page.waitForFunction(() => {
      const button = document.getElementById('notes-button');
      return button?.pathname === '/notes/' && /^\?game=small&build=[a-f0-9]{10}$/.test(button.search);
    }, null, { polling: 50 });
    assert.ok(await page.locator('#notes-button').isVisible(), 'a tester can reach feedback');

    for (let level = 2; level <= 6; level++) {
      input = await pointer(page, name);
      results.push(await rubPlate(page, input, level, capture));
      await input.close();
      if (level < 6) {
        await tap('next');
        await screen(page, 'play');
      }
    }
    // Changed on purpose (2026-11-25): filing plate 6 now opens plate 7 of twelve.
    assert.equal(await page.locator('#collection button:enabled').count(), 7, 'every filed plate and the next can be selected');
    const finalPrint = await printPixels(page);
    await rotate();
    await controls(page, '#pause, #next, #collection button');
    assert.ok(await page.locator('#next').evaluate(button => {
      const label = new Range();
      label.selectNode(button.firstChild);
      const words = label.getBoundingClientRect();
      const arrow = button.querySelector('b').getBoundingClientRect();
      return Math.abs(words.top - arrow.top) < words.height;
    }), 'the last-plate button fits its label and arrow on one line');
    await pointer(page, name).then(input => input.close());
    await capture('landscape-final');
    await restorePortrait();
    await page.reload();
    await screen(page, 'result');
    const finalPrintError = comparePrints(finalPrint, await printPixels(page));
    assert.equal((await state(page)).level, 6, 'the finished last plate survives reload');
    await page.evaluate(() => addEventListener('pagehide', () => {
      sessionStorage.setItem('rubbing-test-departure', window.rubbingState().screen);
    }, { once: true }));
    await page.goto(origin + away);
    assert.equal(await page.evaluate(() => sessionStorage.getItem('rubbing-test-departure')), 'paused',
      'leaving the game pauses the print');
    await page.goBack();
    await page.waitForFunction(() => ['paused', 'result'].includes(window.rubbingState?.().screen));
    if ((await state(page)).screen === 'paused') await tap('resume');
    await screen(page, 'result');
    assert.equal((await state(page)).level, 6, 'the finished last plate survives leaving and returning');
    comparePrints(finalPrint, await printPixels(page));
    await capture('returned');
    await page.locator('#collection button').first().tap();
    await screen(page, 'result');
    const filed = await state(page);
    assert.equal(filed.level, 1);
    assert.equal(filed.coverage, results[0].coverage);
    const firstRestored = await printPixels(page);
    const firstPrintError = comparePrints(originalPrint, firstRestored);
    input = await pointer(page, name);
    for (let i = 0; i < 4; i++) await stroke(input, 205, i % 2 === 1);
    await input.close();
    const retouched = await state(page);
    assert.equal(retouched.screen, 'result');
    assert.equal(retouched.level, 1);
    assert.ok(retouched.distance > filed.distance, 'a filed print accepts further strokes');
    const retouchedPixels = await printPixels(page);
    let darkenedHingePixels = 0;
    for (let y = 195; y < 216; y++) {
      for (let x = 90; x < 150; x++) {
        const redChannel = (y * 240 + x) * 4;
        if (firstRestored[redChannel] - retouchedPixels[redChannel] > 3) darkenedHingePixels++;
      }
    }
    assert.ok(darkenedHingePixels > 100, 'retouching leaves a visible mark at the scallop hinge');
    await page.reload();
    await screen(page, 'result');
    assert.equal((await state(page)).distance, retouched.distance);
    const retouchError = comparePrints(retouchedPixels, await printPixels(page));
    await capture('retouched');
    assert.ok(requests.has(notes), 'feedback button script loaded');
    // The page now records play (kit/lab.js), so the player id exists; no other recording key may.
    assert.deepEqual(await page.evaluate(() => Object.keys(localStorage).filter(key =>
      key.startsWith('hf-lab-') && !['hf-lab-send-localhost', 'hf-lab-player'].includes(key))), [], 'no other recording keys');
    assert.ok(lab.sent.every(r => r.game === 'night-rubbing' && r.runSource === 'agent'), 'every record is named and marked as an agent run');
    // Changed on purpose (2026-11-25): the page now plays in Turkish, so asked for Turkish the way back is Turkish too.
    await assertHomeLinks(context, `${origin}${path}?from=small&lang=tr`, ['paused', 'cabinet'], '‹ Küçük oyunlar');
    await context.addInitScript(() => localStorage.setItem('kit:lang', 'en'));
    assert.deepEqual(errors, [], 'browser and resource errors');
    assert.deepEqual(unexpected, [], 'external requests or recording');
    await recording({ name, engine, device }, browser);
    await deeper({ name, engine, device }, browser);
    console.log(JSON.stringify({ device, input: kind, results, firstPrintError, finalPrintError, darkenedHingePixels, retouchError, errorCount: errors.length, unexpectedRequests: unexpected.length }));
  } finally {
    await browser.close();
  }
}

try {
  for (const profile of profiles) {
    try { await run(profile); }
    catch (error) { process.exitCode = 1; console.error(profile.name, error); }
  }
} finally {
  await new Promise(done => server.close(done));
}
