// Exercise the served page through its controls. The state hook is read-only.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const shots = '/private/tmp/night-r3-new1';
const experiments = resolve(import.meta.dirname, '../..');
const modules = process.env.PLAYWRIGHT || join(homedir(), 'code/human-framework/node_modules');
const require = createRequire(join(resolve(modules), 'check.cjs'));
const { webkit, chromium, devices } = require('playwright');
const profiles = [
  ['webkit', webkit, devices['iPhone 13']],
  ['chromium', chromium, devices['Pixel 7']],
];
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const pagePath = '/lab/night-channels/';
const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  let file;
  if (pathname === '/notes/button.js') file = resolve(experiments, '../workers/feedback/public/notes/button.js');
  else if (pathname === pagePath) file = join(import.meta.dirname, 'index.html');
  else if (/^\/(lab\/night-channels|kit)\/[\w-]+\.(js|css)$/.test(pathname)) file = join(experiments, pathname);
  try {
    if (!file) throw new Error('unserved path');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': mime[extname(file)], 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});

const view = page => page.evaluate(() => window.channelView());
const levelGeometry = s => s.cells.map(c => [c.kind, c.dug, c.height]);
const waitForPlay = page => page.waitForFunction(() => window.channelView?.().screen === 'play', null, { polling: 100 });
async function stamp(page, name) {
  const { state } = await view(page);
  const soil = state.cells.flatMap((c, i) => c.kind === 'soil' && !c.dug ? [i] : []);
  const samples = await points(page, soil);
  const png = await page.screenshot({ path: join(shots, name + '.png'), timeout: 90000, scale: 'css' });
  // Check the captured composite. WebKit once preserved water and plants while
  // dropping the terrain layer, even though the simulation was correct.
  const painted = await page.evaluate(async ({ data, samples }) => {
    const image = new Image();
    image.src = 'data:image/png;base64,' + data;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0);
    const { data: pixels } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return samples.filter(({ x, y }) => {
      const i = (Math.floor(y) * canvas.width + Math.floor(x)) * 4;
      return pixels[i] > 80 && pixels[i] > pixels[i + 1] + 10 && pixels[i] > pixels[i + 2] + 20;
    }).length;
  }, { data: png.toString('base64'), samples });
  assert.ok(soil.length >= 5 && painted >= soil.length * 0.8,
    name + ': visible soil in ' + painted + '/' + soil.length + ' dry cells');
}

async function points(page, ids) {
  const { state: s, geometry: g } = await view(page);
  const box = await page.locator('#garden').boundingBox();
  return ids.map(i => ({
    x: box.x + g.x + ((i % s.cols) + 0.5) * g.size,
    y: box.y + g.y + (Math.floor(i / s.cols) + 0.5) * g.size,
  }));
}

// Chromium can receive trusted touch gestures through its input protocol.
// WebKit receives a paced native mouse drag through the same pointer handler.
async function draw(page, session, ids) {
  const coords = await points(page, ids);
  const start = coords[0];
  if (session) await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
  else {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
  }
  let from = start;
  for (const to of coords.slice(1)) {
    for (let part = 1; part <= 4; part++) {
      const x = from.x + (to.x - from.x) * part / 4;
      const y = from.y + (to.y - from.y) * part / 4;
      if (session) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
      else await page.mouse.move(x, y);
      await delay(10);
    }
    from = to;
  }
  if (session) await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  else await page.mouse.up();
}

function adjacent(s, i) {
  const x = i % s.cols, y = Math.floor(i / s.cols), list = [];
  if (y + 1 < s.rows) list.push(i + s.cols);
  if (x > 0) list.push(i - 1);
  if (x + 1 < s.cols) list.push(i + 1);
  if (y > 0) list.push(i - s.cols);
  return list;
}

// A player can see the beds, rocks, sand and trenches. Join the nearest missing
// bed with the fewest new cuts, preferring soil and short routes in a tie.
function dailyRoutes(s) {
  const connected = new Set([s.source]);
  const plans = [];
  while (s.beds.some(i => !connected.has(i))) {
    const costs = new Map([...connected].map(i => [i, 0]));
    const queue = [...connected];
    const parent = new Map();
    let target;
    while (queue.length) {
      queue.sort((a, b) => costs.get(b) - costs.get(a));
      const i = queue.pop();
      if (!connected.has(i) && s.beds.includes(i)) { target = i; break; }
      for (const n of adjacent(s, i)) {
        const cell = s.cells[n];
        if (cell.kind === 'rock') continue;
        const cut = !cell.dug && (cell.kind === 'sand' || cell.kind === 'soil');
        const cost = costs.get(i) + 1 + (cut ? 1000 : 0) + (cell.kind === 'sand' ? 30 : 0);
        if (cost < (costs.get(n) ?? Infinity)) {
          costs.set(n, cost);
          parent.set(n, i);
          if (!queue.includes(n)) queue.push(n);
        }
      }
    }
    assert.notEqual(target, undefined, 'every daily bed is reachable');
    const path = [target];
    while (parent.has(path.at(-1))) path.push(parent.get(path.at(-1)));
    path.forEach(i => connected.add(i));
    plans.push(path.reverse());
  }
  return plans;
}

async function checkRelease(page, initial) {
  const soil = initial.cells.flatMap((c, i) => c.kind === 'soil' && !c.dug ? [i] : []);
  assert.ok(soil.length >= 3);
  const positions = await points(page, soil.slice(0, 3));
  const remaining = await page.evaluate(coords => {
    const canvas = document.querySelector('#garden');
    const send = (type, id, i) => canvas.dispatchEvent(new PointerEvent(type, {
      pointerId: id, pointerType: 'touch', isPrimary: id === 11, bubbles: true,
      clientX: coords[i].x, clientY: coords[i].y, buttons: type === 'pointercancel' ? 0 : 1,
    }));
    send('pointerdown', 11, 0);
    const first = window.channelView().state.remaining;
    send('pointerdown', 22, 1);
    send('pointermove', 22, 2);
    const secondary = window.channelView().state.remaining;
    send('pointercancel', 11, 0);
    send('pointermove', 11, 1);
    send('pointerup', 22, 2);
    return [first, secondary, window.channelView().state.remaining];
  }, positions);
  assert.deepEqual(remaining, Array(3).fill(initial.budget - 1), 'secondary and cancelled pointers leave soil alone');
}

async function run(name, engine, profile, origin) {
  const browser = await engine.launch();
  try {
    const context = await browser.newContext({ ...profile, timezoneId: 'America/Chicago' });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    const session = name === 'chromium' ? await context.newCDPSession(page) : null;
    const errors = [], outside = [], telemetry = [], failed = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('response', r => { if (r.status() >= 400) failed.push([r.url(), r.status()]); });
    await context.route('**/*', route => {
      const { origin: host, pathname } = new URL(route.request().url());
      if (host !== origin) { outside.push(host); return route.abort(); }
      if (pathname === '/kit/lab.js' || route.request().method() !== 'GET') telemetry.push(pathname);
      return route.continue();
    });
    // Fixed calendar date; browser timers, animation frames and physics run in real time.
    await page.clock.setFixedTime(new Date('2026-11-24T18:00:00Z'));
    if (name === 'webkit') {
      await page.setViewportSize({ ...profile.viewport, width: profile.viewport.width + 1 });
      await delay(150);
      await page.setViewportSize(profile.viewport);
      await page.waitForFunction(() => true);
    }
    const url = origin + pagePath;
    const entered = performance.now();
    await page.goto(url);
    await page.bringToFront();
    try {
      await waitForPlay(page);
    } catch (error) {
      const startup = await page.evaluate(() => ({
        ready: document.readyState, visible: document.visibilityState, screen: window.channelView?.().screen
      }));
      throw new Error('Opening garden failed: ' + JSON.stringify({ startup, errors, failed }), { cause: error });
    }
    const first = await view(page);
    assert.equal(first.level, 1);
    assert.equal(first.unlocked, 1);
    assert.ok(first.geometry.size >= 32, 'board cells are at least 32 CSS px on this profile');
    assert.match(await page.locator('meta[name=viewport]').getAttribute('content'), /maximum-scale=1/);
    await page.waitForFunction(() => window.channelView().state.ticks >= 45);
    await stamp(page, name + '-01-spring');
    // The first garden presents a spring and a single seedbed on the same line.
    const bed = first.state.beds[0], spring = first.state.source;
    assert.equal(spring % first.state.cols, bed % first.state.cols);
    await draw(page, session, [spring, bed]);
    await page.waitForFunction(() => {
      const { cells, beds } = window.channelView().state;
      return cells[beds[0]].growth >= 0.5 && cells[beds[0]].growth < 1;
    });
    await stamp(page, name + '-02-sprout');
    await page.waitForFunction(() => window.channelView().screen === 'won', null, { timeout: 55000 });
    const firstSeconds = (performance.now() - entered) / 1000;
    assert.ok(firstSeconds < 60, 'the opening stroke brings a flower in under a minute');
    const finished = await view(page);
    assert.equal(finished.state.budget - finished.state.remaining, 3, 'one swipe cut all three dry cells');
    assert.equal(finished.state.cells[bed].growth, 1);
    assert.equal(finished.unlocked, 2);
    await stamp(page, name + '-03-flower');

    await page.tap('#next');
    const second = await view(page);
    assert.equal(second.level, 2);
    await checkRelease(page, second.state);
    await page.tap('#retry');
    assert.deepEqual(levelGeometry((await view(page)).state), levelGeometry(second.state), 'retry restores the original cuts and heights');
    assert.equal((await view(page)).state.remaining, second.state.budget);
    const rock = second.state.cells.findIndex(c => c.kind === 'rock');
    assert.ok(rock >= 0);
    const [r] = await points(page, [rock]);
    await page.touchscreen.tap(r.x, r.y);
    assert.equal((await view(page)).state.remaining, second.state.budget, 'touching rock costs no cuts');
    await page.tap('#pause');
    const paused = await view(page);
    assert.equal(paused.screen, 'paused');
    await delay(350);
    assert.equal((await view(page)).state.ticks, paused.state.ticks);
    const toggle = page.locator('#sound');
    const soundBefore = await toggle.getAttribute('aria-pressed');
    await toggle.tap();
    assert.notEqual(await toggle.getAttribute('aria-pressed'), soundBefore);
    await page.tap('#resume');
    await page.waitForFunction(ticks => window.channelView().state.ticks > ticks, paused.state.ticks);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    assert.equal((await view(page)).screen, 'paused');
    await page.tap('#gardens');
    assert.equal((await view(page)).screen, 'selection');
    assert.equal(await page.locator('#levels button').count(), 10, 'all ten gardens have entries');
    assert.equal(await page.locator('#levels button:enabled').count(), 2, 'only the first two gardens are unlocked');
    await page.tap('#return');
    const bank = second.state.cells.flatMap((c, i) => c.kind === 'soil' && !c.dug ? [i] : []);
    const taps = await points(page, bank.slice(-second.state.budget - 1));
    for (const point of taps) await page.touchscreen.tap(point.x, point.y);
    const exhausted = (await view(page)).state;
    assert.equal(exhausted.remaining, 0);
    assert.equal(exhausted.cells.filter(c => c.dug).length, second.state.cells.filter(c => c.dug).length + second.state.budget);
    assert.equal(exhausted.won, false, 'disconnected cuts exhaust the budget without flowers');
    assert.match(await page.locator('#result').innerText(), /Isolated bed/);
    await page.tap('#retry');
    assert.deepEqual(levelGeometry((await view(page)).state), levelGeometry(second.state));

    await page.goto(url + '?look=clay');
    await waitForPlay(page);
    assert.equal((await view(page)).unlocked, 2, 'reloading keeps campaign progress');
    assert.equal(await page.locator('html').getAttribute('data-look'), 'clay');
    await page.tap('#daily');
    let daily = await view(page);
    assert.equal(daily.day, '2026-11-24');
    const dailyMap = levelGeometry(daily.state);
    const routes = dailyRoutes(daily.state);
    await stamp(page, name + '-04-daily-clay');
    for (const ids of routes) await draw(page, session, ids);
    await page.waitForFunction(() => window.channelView().screen === 'won', null, { timeout: 60000 });
    daily = await view(page);
    const digs = daily.state.budget - daily.state.remaining;
    assert.equal(daily.best, digs, 'the saved daily best counts spent digs');
    await stamp(page, name + '-05-daily-flower');
    await page.reload();
    await page.waitForFunction(() => !!window.channelView);
    if (!(await view(page)).day) await page.tap('#daily');
    assert.deepEqual(levelGeometry((await view(page)).state), dailyMap, 'daily layout repeats after reload');
    assert.equal((await view(page)).best, digs, 'device keeps the daily best');
    // Replant a valid daily solution with one extra isolated cut. A worse result
    // must leave the existing best intact.
    const used = new Set(routes.flat());
    const extra = daily.state.cells.findIndex((c, i) => !used.has(i) && c.kind === 'soil' &&
      adjacent(daily.state, i).every(n => !used.has(n)));
    assert.ok(extra >= 0 && digs < daily.state.budget, 'fixture has a spare cut away from the water');
    await draw(page, session, [extra]);
    for (const ids of routes) await draw(page, session, ids);
    await page.waitForFunction(() => window.channelView().screen === 'won', null, { timeout: 60000 });
    const worse = await view(page);
    assert.equal(worse.state.budget - worse.state.remaining, digs + 1);
    assert.equal(worse.best, digs, 'best survives a worse replay');
    await page.reload();
    await waitForPlay(page);
    await page.tap('#daily');
    assert.equal((await view(page)).best, digs, 'reloading after the worse replay keeps the cheaper result');
    await page.clock.setFixedTime(new Date('2026-11-25T18:00:00Z'));
    await page.reload();
    await page.waitForFunction(() => !!window.channelView);
    if (!(await view(page)).day) await page.tap('#daily');
    const tomorrow = await view(page);
    assert.equal(tomorrow.day, '2026-11-25');
    assert.equal(tomorrow.best, null);
    assert.notDeepEqual(levelGeometry(tomorrow.state), dailyMap);
    assert.equal(await page.locator('#notes-button').count(), 0);
    await page.evaluate(() => localStorage.setItem('notes.k', 'check'));
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#notes-button')?.href.includes('build='));
    assert.deepEqual(errors, [], 'browser errors');
    assert.deepEqual(failed, [], 'failed asset responses');
    assert.deepEqual(outside, [], 'outside requests');
    assert.deepEqual(telemetry, [], 'telemetry or outbound writes');
    console.log(JSON.stringify({ name, firstSeconds: +firstSeconds.toFixed(2), firstDigs: 3,
      dailyDigs: digs, replayDigs: digs + 1, dailyBeds: daily.state.beds.length, dailyBudget: daily.state.budget,
      cellPx: +first.geometry.size.toFixed(1), screenshots: 5, errors: errors.length, outside: outside.length }));
  } finally {
    await browser.close();
  }
}

const selected = process.argv[2];
if (selected && !profiles.some(([name]) => name === selected)) throw new Error('Expected webkit or chromium');
await mkdir(shots, { recursive: true });
await new Promise(done => server.listen(0, '127.0.0.1', done));
try {
  for (const [name, engine, profile] of profiles) {
    if (selected && selected !== name) continue;
    try {
      await run(name, engine, profile, 'http://127.0.0.1:' + server.address().port);
    } catch (error) {
      process.exitCode = 1;
      console.error(name, error);
    }
  }
} finally {
  await new Promise(done => server.close(done));
}
