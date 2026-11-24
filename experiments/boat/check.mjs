// Phone check for Paper Boat. Serves experiments/ itself; plays by real pointer input; no external request leaves the machine.
// PLAYWRIGHT=/Users/abdul/code/human-framework/node_modules node experiments/boat/check.mjs [webkit|chromium]
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve, join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import assert from 'node:assert/strict';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), shots = '/private/tmp/night-boat';
await mkdir(shots, { recursive: true });
const server = createServer(async (req, res) => {
  const u = new URL(req.url, 'http://local');
  if (u.pathname === '/notes/button.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end('/* notes UI belongs to the deployed host */'); }
  if (u.pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
  let file = resolve(root, '.' + decodeURIComponent(u.pathname));
  if (u.pathname.endsWith('/')) file = join(file, 'index.html');
  try {
    assert.ok(file.startsWith(root + sep));
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript' }[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(data);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
const require = createRequire(join(resolve(process.env.PLAYWRIGHT || '/Users/abdul/code/human-framework/node_modules'), 'x.js'));
const { webkit, chromium, devices } = require('playwright');
const state = (page) => page.evaluate(() => window.boatState());
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
async function bounds(page) {
  await sleep(400); // cards pop in over 0.32 s
  const bad = await page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => b.getBoundingClientRect().width && b.getBoundingClientRect().height).filter((b) => {
    const r = b.getBoundingClientRect();
    return r.width < 48 || r.height < 48 || r.x < 0 || r.y < 0 || r.right > innerWidth + 0.1 || r.bottom > innerHeight + 0.1;
  }).map((b) => b.id || b.textContent));
  assert.deepEqual(bad, [], 'visible touch targets at least 48px and on screen');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no horizontal overflow');
  const small = await page.evaluate(() => [...document.querySelectorAll('.screen.on *')].filter((el) => el.children.length === 0 && el.textContent.trim() && parseFloat(getComputedStyle(el).fontSize) < 14).map((el) => el.textContent.trim().slice(0, 30)));
  assert.deepEqual(small, [], 'no text under 14px');
}
async function swipe(page, x, y, ex, ey) {
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move((x + ex) / 2, (y + ey) / 2); await page.mouse.move(ex, ey); await page.mouse.up();
}
// Plays the run in the page with the careful policy's advice, delivered as real mouse gestures on the canvas.
async function playOut(page, name, shot, limitMs = 120000) {
  const input = { swipes: 0, taps: 0 }, deadline = Date.now() + limitMs;
  let mid = false;
  while ((await state(page)).screen === 'play') {
    assert.ok(Date.now() < deadline, 'run ends within the wall-time limit');
    const a = await page.evaluate(() => window.boatAdvice());
    if (a?.k === 'ripple') { await swipe(page, a.x, a.y, a.ex, a.ey); input.swipes++; await sleep(330); }
    else if (a?.k === 'pebble') { await page.mouse.click(a.x, a.y); input.taps++; await sleep(330); }
    else await sleep(110);
    if (shot && !mid && (await state(page)).y > 2.3) { await page.screenshot({ path: join(shots, `${name}-${shot}.png`) }); mid = true; }
  }
  return input;
}
let failed = 0;
try {
  for (const [name, engine, device] of [['webkit', webkit, devices['iPhone 13']], ['chromium', chromium, devices['Pixel 7']]]) {
    if (process.argv[2] && process.argv[2] !== name) continue;
    const browser = await engine.launch();
    const ctx = await browser.newContext({ ...device });
    const page = await ctx.newPage(), errors = [], records = [];
    page.on('pageerror', (e) => errors.push(`page: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('requestfailed', (r) => errors.push(`request: ${r.url()}`));
    page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
    await ctx.route('https://human.adamwhite.work/**', async (route) => {
      const req = route.request(), headers = { 'access-control-allow-origin': base, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'Content-Type' };
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      records.push(JSON.parse(gunzipSync(req.postDataBuffer()).toString()));
      await route.fulfill({ status: 200, headers: { ...headers, 'content-type': 'application/json' }, body: '{"ok":true}' });
    });
    try {
      await page.goto(`${base}/boat/?seed=5&labRunSource=agent`);
      await page.waitForFunction(() => window.boatState);
      await page.evaluate(() => localStorage.setItem('hf-lab-send-localhost', '1'));
      await page.reload();
      await page.waitForFunction(() => window.boatState);
      assert.match(await page.textContent('#menu'), /The game lab records play/);
      assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('menuMore')).display), 'none', 'a first visit sees only Play');
      await bounds(page);
      await sleep(500);
      await page.screenshot({ path: join(shots, `${name}-menu.png`) });
      await page.click('#play');
      let st = await state(page);
      assert.equal(st.screen, 'play');
      assert.equal(st.level, 1);
      await bounds(page);
      await sleep(600);
      const drift = await state(page);
      assert.ok(drift.y > st.y, 'the current carries the boat without any touch');
      // One real swipe to the right, beside the boat: a ripple appears and the boat is pushed right.
      await swipe(page, drift.boat.x - 70, drift.boat.y - 10, drift.boat.x + 50, drift.boat.y - 10);
      await sleep(80);
      assert.ok((await state(page)).ripples >= 1, 'a swipe makes a ripple');
      await sleep(900);
      const pushed = await state(page);
      assert.ok(pushed.x > drift.x + 0.1, `the ripple pushed the boat right (${drift.x.toFixed(2)} to ${pushed.x.toFixed(2)})`);
      // One real tap: a pebble.
      await page.mouse.click(pushed.boat.x - 60, pushed.boat.y - 120);
      await sleep(80);
      assert.equal((await state(page)).stones, 1, 'a tap drops a pebble');
      await page.click('#pause');
      const paused = await state(page);
      assert.equal(paused.screen, 'paused');
      await bounds(page);
      await sleep(250);
      assert.equal((await state(page)).tick, paused.tick, 'pause freezes the stream');
      await page.click('#resume');
      await page.evaluate(() => dispatchEvent(new Event('blur')));
      assert.equal((await state(page)).screen, 'paused', 'losing the screen pauses');
      await page.keyboard.press('P');
      assert.equal((await state(page)).screen, 'play');
      const input = await playOut(page, name, 'mid-play');
      const done = await state(page);
      assert.equal(done.over, 'win', 'street 1 finished by real pointer input');
      assert.ok(done.riders >= 1 && done.stars >= 1, 'passengers delivered and stars given');
      assert.ok(done.t < 60, `street 1 takes under a minute (${done.t.toFixed(1)}s)`);
      assert.ok(input.swipes >= 2, 'several swipes were made');
      assert.ok(done.fx > 0, 'actions and the win emit particles');
      await bounds(page);
      await sleep(700);
      await page.screenshot({ path: join(shots, `${name}-end.png`) });
      const blob = await page.evaluate(() => localStorage.getItem('boat-save'));
      const saved = JSON.parse(blob);
      assert.ok(saved.stars['1'] >= 1 && saved.opened === 2, 'stars saved and street 2 opened');
      await sleep(400);
      const runs = records.filter((r) => r.game === 'boat' && r.kind === 'run' && r.data.outcome === 'win');
      assert.equal(runs.length, 1, 'one lab record of the finished street');
      assert.equal(runs[0].runSource, 'agent');
      assert.ok(runs[0].data.events.some((e) => e.type === 'pickup'), 'pickup recorded');
      // Street 2, untouched: the drain takes the boat and the card offers a one-tap retry.
      await page.click('#next');
      assert.equal((await state(page)).level, 2);
      await page.waitForFunction(() => window.boatState().screen === 'end', undefined, { timeout: 40000 });
      const lost = await state(page);
      assert.equal(lost.over, 'drain', 'street 2 untouched ends in the drain');
      assert.equal(await page.isVisible('#next'), false, 'no Next after a loss');
      await bounds(page);
      await sleep(500);
      await page.screenshot({ path: join(shots, `${name}-lost.png`) });
      await page.click('#again');
      st = await state(page);
      assert.ok(st.screen === 'play' && st.level === 2 && st.t < 0.5, 'Retry restarts in one tap');
      await page.click('#pause');
      await page.click('#toMenu');
      await page.reload();
      await page.waitForFunction(() => window.boatState);
      assert.equal(await page.evaluate(() => localStorage.getItem('boat-save')), JSON.stringify({ ...JSON.parse(blob), ...JSON.parse(await page.evaluate(() => localStorage.getItem('boat-save'))) }), 'save survives reload');
      assert.ok(JSON.parse(await page.evaluate(() => localStorage.getItem('boat-save'))).stars['1'] >= 1);
      await bounds(page);
      await page.screenshot({ path: join(shots, `${name}-menu-returning.png`) });
      await page.click('#choose');
      await bounds(page);
      await page.screenshot({ path: join(shots, `${name}-streets.png`) });
      await page.click('#selectBack');
      // The daily stream.
      await page.click('#daily');
      const d = await state(page);
      assert.equal(d.daily, true);
      assert.equal(d.seed, 5, 'the seed in the address is used');
      await playOut(page, name, 'daily', 25000).catch(() => {});
      await page.screenshot({ path: join(shots, `${name}-daily.png`) });
      if ((await state(page)).screen === 'play') { await page.click('#pause'); await page.click('#restart'); }
      else { await sleep(300); await page.screenshot({ path: join(shots, `${name}-daily-end.png`) }); await page.click('#next'); }
      const again = await state(page);
      assert.ok(again.daily && again.seed === 5, 'restart keeps the same daily stream');
      const s2 = JSON.parse(await page.evaluate(() => localStorage.getItem('boat-save')));
      assert.ok(s2.best > 0 && Object.values(s2.daily)[0] > 0, 'daily score and best saved on the device');
      await page.click('#pause');
      await page.click('#sound');
      assert.equal((await state(page)).sound, false);
      await page.click('#toMenu');
      // Small phone and desktop.
      await page.setViewportSize({ width: 360, height: 640 });
      await sleep(300);
      await bounds(page);
      await page.screenshot({ path: join(shots, `${name}-360-menu.png`) });
      await page.click('#choose');
      await bounds(page);
      await page.click('#levels button');
      await sleep(900);
      await bounds(page);
      await page.screenshot({ path: join(shots, `${name}-360-play.png`) });
      await page.click('#pause');
      await bounds(page);
      await page.screenshot({ path: join(shots, `${name}-360-pause.png`) });
      await page.click('#toMenu');
      await page.setViewportSize({ width: 1280, height: 800 });
      await sleep(300);
      await page.click('#choose');
      await page.click('#levels button');
      await sleep(300);
      const k0 = await state(page);
      await page.keyboard.press('ArrowRight');
      await sleep(900);
      const k1 = await state(page);
      assert.ok(k1.x > k0.x + 0.1, 'desktop: the arrow key pushes the boat');
      await page.keyboard.press('Space');
      await sleep(100);
      assert.equal((await state(page)).stones, 1, 'desktop: space drops a pebble');
      await page.screenshot({ path: join(shots, `${name}-desktop.png`) });
      await page.keyboard.press('Escape');
      assert.equal((await state(page)).screen, 'paused');
      await page.click('#toMenu');
      await page.reload();
      await page.waitForFunction(() => window.boatState);
      assert.equal((await state(page)).sound, false, 'sound setting persists');
      await sleep(300);
      assert.deepEqual(errors, [], 'zero page, console, request and HTTP errors');
      console.log(`PASS ${name}: street 1 won in ${done.t.toFixed(1)}s with ${done.riders} passengers, ${done.stars} stars, ${input.swipes} swipes and ${input.taps} taps by real pointer input; street 2 untouched lost to the drain; save, daily, pause, keyboard, 360px and desktop pass; 0 page/console errors`);
    } catch (e) {
      failed++;
      console.error(`FAIL ${name}:`, e);
      console.error(errors);
      await page.screenshot({ path: join(shots, `${name}-failure.png`) }).catch(() => {});
    } finally {
      await ctx.close();
      await browser.close();
    }
  }
} finally {
  await new Promise((done) => server.close(done));
}
process.exitCode = failed ? 1 : 0;
