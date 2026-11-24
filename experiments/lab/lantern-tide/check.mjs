import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { steer } from './bots.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const shots = '/private/tmp/night-r4-tide';
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
await mkdir(shots, { recursive: true });
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
      if (held && (hearts !== view.game.river.hearts || Math.abs(target - startBoat) * view.scale / 1.3 > x * .8)) {
        await this.release();
      }
      if (!held) {
        startX = page.viewportSize().width / 2;
        startBoat = view.game.river.x;
        hearts = view.game.river.hearts;
        await event('touchStart', startX, y);
        held = true;
      }
      const next = startX + (target - startBoat) * view.scale / 1.3;
      await event('touchMove', next, y);
    },
    async release() {
      if (held) { await event('touchEnd'); held = false; }
    },
  };
}

async function crossing(page, input) {
  // Feed the normal pointer handlers. The controller has the same update rate
  // and the same lookahead as the seeded water reader in the bot check.
  const started = Date.now();
  let moves = 0, last = -1;
  try {
    while (Date.now() - started < 60000) {
      const view = await state(page);
      const { game, screen: showing } = view;
      const s = game.river;
      if (s.over) {
        await screen(page, 'end');
        assert.equal(s.over, 'dawn', `level 1 through pointer input (reached ${s.y.toFixed(2)})`);
        assert.ok(s.t < 60, 'level 1 finishes in under a simulated minute');
        assert.ok(Date.now() - started < 60000, 'level 1 finishes in under a wall-clock minute');
        assert.ok(game.rested > 0, 'an eddy relit the wick');
        return { seconds: +s.t.toFixed(2), wall: +((Date.now() - started) / 1000).toFixed(2), moves,
          embers: s.taken, lives: s.hearts, relit: +game.rested.toFixed(3) };
      }
      assert.equal(showing, 'play');
      if (s.t - last >= .097) {
        await input.drag(view, steer(game, true));
        last = s.t;
        moves++;
      }
      await sleep(35);
    }
    assert.fail('the first crossing did not end within one minute');
  } finally {
    await input.release();
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
    const frame = await page.evaluate(() => window.checkFrames);
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
    await page.addInitScript(() => {
      window.checkFrames = 0;
      requestAnimationFrame(function count() { window.checkFrames++; requestAnimationFrame(count); });
    });
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

    await page.locator('#start').tap();
    await page.locator('.kit-hint.on .knob').waitFor({ state: 'visible' });
    await shot('steering-hint');
    const input = await touchDriver(page, browserName);
    const before = await state(page);
    await input.drag(before, before.game.river.x + .12);
    await page.waitForFunction(x => window.tideState().target > x + .08, before.game.river.x);
    await input.release();
    await shot('current');
    assert.equal(await page.evaluate(() => localStorage.getItem('lantern-tide:hint')), '1');
    await page.keyboard.press('Escape');
    await screen(page, 'paused');
    const paused = (await state(page)).game.river;
    await sleep(240);
    assert.deepEqual((await state(page)).game.river, paused, 'pause freezes the river');
    await page.locator('#sound').tap();
    assert.equal(await page.locator('#sound').getAttribute('aria-pressed'), 'false');
    await shot('paused');
    await page.locator('#resume').tap();
    await page.waitForFunction(t => window.tideState().game.river.t > t, paused.t);
    await page.locator('#pause').tap();
    await page.locator('#restart').tap();
    const result = await crossing(page, input);
    assert.equal(await page.locator('#result').textContent(), 'Dawn');
    await shot('dawn');
    await page.locator('#next').tap();
    assert.equal((await state(page)).night, 2);
    assert.equal(await page.evaluate(() => localStorage.getItem('lantern-tide:night')), '2');
    await page.reload();
    await screen(page, 'ready');
    assert.equal((await state(page)).night, 2, 'the second night is saved');
    await page.locator('#start').tap();
    await page.locator('#pause').tap();
    assert.equal(await page.locator('#sound').getAttribute('aria-pressed'), 'false', 'mute is saved');
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
    console.log(`${browserName} / ${device}`, result);
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
