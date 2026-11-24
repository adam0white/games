import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { gunzipSync } from 'node:zlib';
import { WIDTH, HEIGHT, LIFT, FUSE, REST, dailyNight, targetFor } from './sim.js';

const require = createRequire(process.env.PLAYWRIGHT ? join(resolve(process.env.PLAYWRIGHT), 'x.js') : import.meta.url);
const { chromium, webkit, devices } = require('playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const shots = process.env.SHOTS ?? join(tmpdir(), 'nightshift-shots');
const visual = process.argv.includes('--visual');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path === '/notes/button.js' || path === '/favicon.ico') {
    res.writeHead(200, { 'content-type': 'text/javascript' });
    return res.end('');
  }
  const file = resolve(root, '.' + path + (path.endsWith('/') ? 'index.html' : ''));
  try {
    if (!file.startsWith(root)) throw new Error('outside experiment root');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)], 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}/nightshift/`;
const state = page => page.evaluate(() => window.nightshiftState());
const save = page => page.evaluate(() => JSON.parse(localStorage.getItem('nightshift-save')));
const tick = (page, ms) => page.clock.runFor(ms);
const capture = (page, name, suffix) => page.screenshot({ path: join(shots, `${name}-${suffix}.png`), scale: 'css', timeout: 15000 });

async function open(page, query = '') {
  await page.goto(base + '?labRunSource=agent' + query);
  await page.waitForFunction(() => typeof window.nightshiftState === 'function');
  assert.equal((await state(page)).screen, 'menu');
}

async function finger(page, action, aim = REST, lift = LIFT) {
  await page.locator('#floor').evaluate((el, { action, aim, width, height, lift }) => {
    const bounds = el.getBoundingClientRect();
    el.dispatchEvent(new PointerEvent(action, {
      pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0, buttons: action === 'pointerup' ? 0 : 1,
      clientX: bounds.x + aim.x * bounds.width / width,
      clientY: bounds.y + (aim.y + lift) * bounds.height / height,
      bubbles: true, cancelable: true,
    }));
  }, { action, aim, width: WIDTH, height: HEIGHT, lift });
}

async function drive(page, options = {}) {
  await finger(page, 'pointerdown');
  let lock = null;
  let shot = false;
  for (let i = 0; i < 230; i++) {
    const s = await state(page);
    if (s.screen === 'result') break;
    assert.equal(s.screen, 'play');
    const active = s.actors.filter(a => a.state === 'roam' && a.kind !== 'shy')
      .sort((a, b) => b.progress - a.progress);
    const a = active.find(other => other.id === lock) ?? active[0];
    lock = a?.id ?? null;
    const aim = s.level === 13 || s.level === 15 || s.level >= 17
      ? !s.fused && s.time < 2.5 ? FUSE : a && targetFor(a)
      : a && targetFor(a);
    await finger(page, 'pointermove', aim ?? REST);
    await tick(page, 340);
    if (options.mid && !shot && (await state(page)).actors.some(actor => actor.lit && actor.hold > .25)) {
      await capture(page, options.mid, 'play');
      shot = true;
    }
  }
  const end = await state(page);
  assert.ok(!options.mid || shot, 'the beam held an exhibit for the screenshot');
  assert.equal(end.screen, 'result');
  assert.equal(end.outcome, 'dawn');
  assert.ok(end.returned >= 3, 'a touch-driven win returned exhibits');
}

async function checkLessonCues(page) {
  await open(page, '&level=13');
  if (await page.locator('#menuSound').getAttribute('aria-pressed') === 'false') await page.tap('#menuSound');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const mirrorTargets = await page.evaluate(async () => {
    const { renderer } = await import('./art.js');
    const { create, CASE, LIFT, reflection } = await import('./sim.js');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const draw = renderer(canvas);
    const lineTo = ctx.lineTo.bind(ctx);
    let finger;
    ctx.lineTo = (x, y) => {
      // Read the endpoint of the dashed finger path shown to the player.
      if (ctx.getLineDash()[0] === 2) finger = { x, y };
      lineTo(x, y);
    };
    return [CASE.y + 8, CASE.y - 18].map(y => {
      const s = create({ level: 7 });
      const actor = s.actors[2];
      actor.y = y;
      actor.state = 'roam';
      s.time = 2;
      draw.draw(s, 1, 0, [], true, true);
      const beam = { x: finger.x, y: finger.y - LIFT };
      const light = y >= CASE.y ? reflection(beam) : beam;
      return light && Math.hypot(light.x - actor.x, light.y - actor.y);
    });
  });
  await page.locator('#floor').evaluate(canvas => {
    const ctx = canvas.getContext('2d');
    const ellipse = ctx.ellipse.bind(ctx);
    const fill = ctx.fill.bind(ctx);
    const move = ctx.moveTo.bind(ctx);
    let pathStart;
    window.visibleCues = { prints: 0, repairSparks: 0 };
    ctx.ellipse = (x, y, rx, ry, ...args) => {
      // Feet are small ellipses in floor coordinates, beneath the moving exhibit.
      if (x > 40 && y > 100 && y < 535 && rx < 5 && ry > rx) window.visibleCues.prints++;
      ellipse(x, y, rx, ry, ...args);
    };
    ctx.moveTo = (x, y) => { pathStart = { x, y }; move(x, y); };
    ctx.fill = (...args) => {
      if (ctx.fillStyle === '#fff1cc' && pathStart?.x > 210 && pathStart.x < 290 &&
          pathStart.y > 520 && pathStart.y < 565) window.visibleCues.repairSparks++;
      fill(...args);
      pathStart = null;
    };
  });
  await page.tap('#play');
  await finger(page, 'pointerdown', FUSE, 0);
  await tick(page, 1800);
  assert.ok((await state(page)).fused, 'pressing the fuse itself repairs it');
  await finger(page, 'pointerup');
  await tick(page, 3500);
  const cues = await page.evaluate(() => ({ ...window.visibleCues, footsteps: window.audioCounts.pans }));
  assert.ok(cues.footsteps > 0, 'a footstep actually played');
  assert.deepEqual([
    mirrorTargets.every(error => error !== null && error < 2), cues.prints > 0, cues.repairSparks > 0,
  ], [true, true, true], 'mirror directs the finger into the case then onto the runner; reduced-motion steps remain visible; repair stars surround the fuse');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
}

async function inspectVisual(page, name) {
  await open(page);
  await capture(page, name, 'menu');
  await page.tap('#play');
  await tick(page, 1200);
  await capture(page, name, 'lesson');
  const s = await state(page);
  await finger(page, 'pointerdown', s.actors[0]);
  await tick(page, 690);
  await capture(page, name, 'play');
  await open(page, '&level=7');
  await page.tap('#play');
  await tick(page, 1310);
  const subject = (await state(page)).actors[2];
  await finger(page, 'pointerdown', targetFor(subject));
  await tick(page, 835);
  await capture(page, name, 'mirror');
  await open(page, '&level=14');
  await page.tap('#play');
  await tick(page, 1230);
  await capture(page, name, 'stair');
}

async function checkFirstShift(page) {
  await open(page);
  const privacy = await page.getByRole('link', { name: 'Privacy' }).boundingBox();
  await page.tap('#play');
  await tick(page, 6500);
  const opening = await state(page);
  const problems = [];
  if (privacy.width < 44 || privacy.height < 44) problems.push('Privacy hit target below 44px');
  if (opening.screen !== 'play' || opening.escapes !== 0 || opening.time > 2) {
    problems.push('first shift ran before the first aim');
  }
  const caption = page.locator('#shiftCaption');
  if (!await caption.count() || !/tap/i.test(await caption.innerText())) problems.push('missing in-play aim instruction');
  if (opening.screen !== 'play') await page.tap('#again');
  const { width, height } = await page.locator('#floor').boundingBox();
  await page.touchscreen.tap(Math.round(width / 2), Math.round(height / 2));
  const aimed = await state(page);
  if (Math.abs(aimed.aim.y - HEIGHT / 2) >= 2) problems.push('quick tap misses its location');
  await tick(page, 2000);
  if (opening.screen === 'play') assert.ok((await state(page)).time > opening.time + 1);
  await page.tap('#pause');
  if (!/three escapes/i.test(await page.locator('#paused').innerText())) problems.push('pause lacks rules');
  for (const [level, cue] of [[4, /twin/i], [7, /mirror/i], [8, /dark/i]]) {
    await open(page, '&level=' + level);
    await page.tap('#play');
    if (!await caption.count() || !cue.test(await caption.innerText())) {
      problems.push('missing rule for night ' + level);
      continue;
    }
    const bounds = await caption.boundingBox();
    assert.ok(bounds.y + bounds.height <= height + 1, 'caption fits the phone');
  }
  assert.deepEqual(problems, []);
}

async function holdThroughLoss(page) {
  const touch = await page.context().newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 232, y: 490 }] });
  await tick(page, 45000);
  assert.equal((await state(page)).screen, 'result');
  const menu = await page.locator('#resultMenu').boundingBox();
  assert.ok(menu.x <= 232 && menu.x + menu.width >= 232 && menu.y <= 490 && menu.y + menu.height >= 490);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await tick(page, 400);
  assert.equal((await state(page)).screen, 'result', 'lifting a finger used on the floor must leave the result open');
  await touch.detach();
}

async function run(page, name, records) {
  await open(page);
  await capture(page, name, 'menu');
  await page.tap('#play');
  assert.equal((await state(page)).level, 1);
  assert.equal((await state(page)).screen, 'play');
  await tick(page, 1150);
  await capture(page, name, 'lesson');
  await tick(page, 2200);
  assert.ok(await page.locator('.kit-hint.on').count(), 'kit idle hint shows during play');
  const captionTop = (await page.locator('#shiftCaption').boundingBox()).y;
  for (let sample = 0; sample < 12; sample++) {
    const bottom = await page.locator('.kit-hint.on .hand').evaluate(hand => hand.getBoundingClientRect().bottom);
    assert.ok(bottom <= captionTop, `kit hand ends at ${bottom}, above the caption at ${captionTop}`);
    await tick(page, 125);
  }
  await capture(page, name, 'idle-hint');
  await page.tap('#pause');
  assert.ok((await state(page)).paused);
  const pausedAt = (await state(page)).tick;
  await tick(page, 5000);
  assert.equal((await state(page)).tick, pausedAt);
  await capture(page, name, 'pause');
  await page.tap('#resume');
  await page.touchscreen.tap(80, 220);
  await tick(page, 260);
  assert.ok((await state(page)).tick > pausedAt);
  await drive(page, { mid: name });
  assert.equal(await page.textContent('#outcome'), 'Dawn');
  assert.equal((await save(page)).unlocked, 2);
  assert.ok(await page.evaluate(() => window.audioCounts.pans >= 1 && window.audioCounts.tones >= 1), 'audio schedules stereo footsteps and notes');
  await capture(page, name, 'dawn');
  await page.tap('#again');
  assert.equal((await state(page)).level, 2);
  await page.tap('#pause');
  await page.tap('#toMenu');
  assert.equal((await state(page)).screen, 'menu');
  await page.tap('#menuSound');
  assert.equal((await save(page)).sound, false);

  const storySave = await save(page);
  await page.reload();
  await page.waitForFunction(() => window.nightshiftState);
  assert.deepEqual(await save(page), storySave);
  assert.equal(await page.textContent('#menuSound'), 'Sound off');
  await page.tap('#play');
  await tick(page, 43500);
  const lost = await state(page);
  assert.equal(lost.outcome, 'escaped');
  assert.equal(lost.escapes, 3);
  assert.equal(lost.screen, 'result');
  const bearVisible = await page.evaluate(() => {
    // Both night posters use this portrait. The escaping cat must leave its face visible.
    const face = id => document.getElementById(id).getContext('2d').getImageData(330, 258, 52, 40).data;
    const menu = face('poster');
    return face('resultPoster').every((value, i) => value === menu[i]);
  });
  assert.ok(bearVisible, 'the cat leaves the poster bear’s face visible');
  const lossText = await page.locator('#result').innerText();
  assert.ok(lossText.includes('3 escaped') && lossText.includes('0 stars'), 'loss explains the three escapes and zero stars');
  await capture(page, name, 'escaped');
  await page.tap('#resultMenu');

  await page.tap('#daily');
  const daily = await state(page);
  assert.equal(daily.mode, 'daily');
  assert.equal(daily.day, '2026-11-24');
  assert.deepEqual({ level: daily.level, seed: daily.seed }, dailyNight(daily.day));
  await drive(page);
  assert.deepEqual((await save(page)).daily, { date: daily.day, streak: 1 });
  await page.locator('#dailyPoster').evaluate(el => {
    window.cardLabels = [];
    const ctx = el.getContext('2d');
    const original = ctx.fillText.bind(ctx);
    ctx.fillText = (label, ...args) => {
      window.cardLabels.push(String(label));
      original(label, ...args);
    };
  });
  const dailyEscapes = (await state(page)).escapes;
  await page.tap('#share');
  assert.equal((await state(page)).screen, 'shareCard');
  await page.waitForFunction(() => !document.querySelector('#saveCard').disabled);
  assert.match(await page.locator('#dailyPoster').evaluate(el => el.toDataURL()), /^data:image\/png/);
  const labels = (await page.evaluate(() => window.cardLabels)).join(' ');
  for (const label of ['Tiptoe Museum', 'Daily', daily.day, `${dailyEscapes} escaped`, 'Streak 1']) {
    assert.ok(labels.includes(label), `exported image includes ${label}`);
  }
  assert.ok((await page.locator('#dailyPoster').getAttribute('aria-label')).includes(daily.day), 'share preview describes this dated result');
  await capture(page, name, 'daily');
  if (name === 'small-360') {
    const [download] = await Promise.all([page.waitForEvent('download'), page.tap('#saveCard')]);
    assert.match(await page.locator('#shareCard').innerText(), /Download started/, 'download gives visible feedback');
    assert.equal(download.suggestedFilename(), 'nightshift-2026-11-24.png');
    const file = await readFile(await download.path());
    assert.deepEqual([...file.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  }
  await page.tap('#closeShare');
  await page.tap('#resultMenu');
  await page.reload();
  await page.waitForFunction(() => window.nightshiftState);
  assert.equal(await page.textContent('#streak'), '✦ 1');
  await page.tap('#daily');
  const replay = await state(page);
  assert.equal(replay.seed, daily.seed);
  assert.equal(replay.level, daily.level);
  await page.tap('#pause');
  await page.tap('#toMenu');

  await page.tap('#long');
  assert.equal((await state(page)).mode, 'long');
  await tick(page, 2840);
  await page.tap('#pause');
  await page.tap('#toMenu');
  assert.ok((await save(page)).best >= 2);
  await page.tap('#long');
  await tick(page, 5600);
  const seconds = Math.floor((await state(page)).time);
  assert.ok(seconds >= 5);
  await page.reload();
  await page.waitForFunction(() => window.nightshiftState);
  assert.ok((await save(page)).best >= seconds, 'reload preserves the Long Night survival record');
  await page.tap('#long');
  if (name === 'small-360') await holdThroughLoss(page);
  else await tick(page, 45000);
  assert.equal((await state(page)).outcome, 'escaped');
  const longResult = await page.locator('#result').innerText();
  assert.ok(longResult.includes('Survived') && longResult.includes('Best'), 'Long Night distinguishes survival time and personal best');
  assert.equal(await page.evaluate(() => Object.keys(localStorage).filter(key => key.includes('nightshift') && key.endsWith('-save')).length), 1);
  for (const outcome of ['dawn', 'escaped', 'left']) {
    assert.ok(records.some(r => r.kind === 'run' && r.data.outcome === outcome && r.game === 'nightshift' && r.runSource === 'agent'), `mocked lab run contains ${outcome}`);
  }
}

const profiles = [
  ['iphone13-390', webkit, devices['iPhone 13'], { width: 390, height: 664 }],
  ['pixel7', chromium, devices['Pixel 7']],
  ['small-360', chromium, devices['Pixel 7'], { width: 360, height: 640 }],
].filter(([name]) => !visual || name !== 'pixel7')
  .filter(([name]) => !process.env.NIGHTSHIFT_PROFILE || process.env.NIGHTSHIFT_PROFILE === name);

await mkdir(shots, { recursive: true });
try {
  assert.ok(profiles.length, 'select a known profile');
  for (const [name, engine, device, viewport] of profiles) {
    const browser = await engine.launch();
    try {
      const context = await browser.newContext({ ...device, ...(viewport && { viewport }) });
      const records = [];
      await context.route('https://human.adamwhite.work/lab/api/linked', async route => {
        const request = route.request();
        if (request.method() === 'POST') records.push(JSON.parse(gunzipSync(request.postDataBuffer()).toString('utf8')));
        await route.fulfill({
          status: 200,
          headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': '*' },
          body: 'ok',
        });
      });
      await context.addInitScript(({ disableShare }) => {
        if (disableShare) Object.defineProperty(navigator, 'canShare', { value: () => false });
        if (location.protocol === 'about:') return;
        localStorage.setItem('hf-lab-send-localhost', '1');
        window.audioCounts = { pans: 0, tones: 0 };
        const proto = (window.AudioContext || window.webkitAudioContext)?.prototype;
        for (const [method, count] of [['createStereoPanner', 'pans'], ['createOscillator', 'tones']]) {
          const original = proto?.[method];
          if (original) proto[method] = function (...args) {
            window.audioCounts[count]++;
            return original.apply(this, args);
          };
        }
      }, { disableShare: name === 'small-360' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
      await page.clock.install({ time: new Date('2026-11-24T17:00:00Z') });
      if (visual) await inspectVisual(page, name);
      else {
        await checkFirstShift(page);
        await page.evaluate(() => localStorage.clear());
        await run(page, name, records);
        await checkLessonCues(page);
      }
      assert.deepEqual(errors, []);
      console.log(`PASS ${name} ${JSON.stringify(page.viewportSize())} · ${visual ? 'screenshots' : 'menu, touch win, idle loss, pause, menu, audio nodes, reload, daily, share preview, long best, mocked lab'}`);
    } finally {
      await browser.close();
    }
  }
} finally {
  await new Promise(done => server.close(done));
}
