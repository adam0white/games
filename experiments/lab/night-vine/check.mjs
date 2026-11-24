// fnm exec --using=26.12.0 node experiments/lab/night-vine/check.mjs [webkit|chromium]
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const experiments = fileURLToPath(new URL('../../', import.meta.url));
const shots = '/private/tmp/night-r5-new5';
const path = '/lab/night-vine/';
const saveKey = 'night-vine:save';
const feedback = '/notes/button.js';
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
const requirePlaywright = createRequire(join(resolve(process.env.PLAYWRIGHT ||
  join(homedir(), 'code/human-framework/node_modules')), 'check.cjs'));
const { devices, webkit, chromium } = requirePlaywright('playwright');
const profiles = [
  { name: 'webkit', engine: webkit, device: 'iPhone 13' },
  { name: 'chromium', engine: chromium, device: 'Pixel 7' },
].filter(({ name }) => !process.argv[2] || name === process.argv[2]);
assert.ok(profiles.length, 'expected webkit or chromium');

const allowed = p => p === path || p === feedback || p === '/favicon.ico' ||
  /^\/lab\/night-vine\/[\w-]+\.(js|css|html)$/.test(p) ||
  (/^\/kit\/[\w-]+\.js$/.test(p) && p !== '/kit/lab.js');
const server = createServer(async (request, response) => {
  const p = new URL(request.url, 'http://localhost').pathname;
  if (p === '/favicon.ico') return response.writeHead(204).end();
  if (!allowed(p)) return response.writeHead(404).end();
  const file = p === feedback ? resolve(experiments, '../workers/feedback/public/notes/button.js')
    : join(experiments, p, p.endsWith('/') ? 'index.html' : '');
  try {
    const data = await readFile(file);
    response.writeHead(200, { 'content-type': types[extname(file)], 'cache-control': 'no-store' }).end(data);
  } catch {
    response.writeHead(404).end();
  }
});

const state = page => page.evaluate(() => window.vineState());
const save = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), saveKey);
const screen = (page, which) => page.waitForFunction(w => window.vineState?.().screen === w, which, { polling: 50, timeout: 7000 });
const until = (page, test, value, timeout = 7000) => page.waitForFunction(test, value, { polling: 50, timeout });
async function coordinates(page) {
  const field = await page.locator('#field').boundingBox();
  assert.ok(field && field.width > 0 && field.height > 0, 'field is visible');
  assert.ok(Math.abs(field.width / field.height - 360 / 480) < 0.01, 'logical field fills the canvas');
  return ({ x, y }) => ({ x: field.x + x * field.width / 360, y: field.y + y * field.height / 480 });
}
async function tapPoint(page, world) {
  const pixel = (await coordinates(page))(world);
  await page.touchscreen.tap(pixel.x, pixel.y);
}
async function flick(page, name, from, to) {
  const map = await coordinates(page);
  const a = map(from), b = map(to);
  if (name === 'chromium') {
    const client = await page.context().newCDPSession(page);
    try {
      for (const [type, touchPoints] of [['touchStart', [a]], ['touchMove', [b]], ['touchEnd', []]]) {
        await client.send('Input.dispatchTouchEvent', { type, touchPoints });
      }
    } finally {
      await client.detach();
    }
  } else {
    // WebKit exposes trusted touch taps and a trusted mouse drag.
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y);
    await page.mouse.up();
  }
}
async function button(page, id) {
  const btn = page.locator('#' + id);
  assert.ok(await btn.isVisible(), id + ' is visible');
  const box = await btn.boundingBox(), view = page.viewportSize();
  assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= view.width + 1 &&
    box.y + box.height <= view.height + 1, id + ' fits the phone');
  await btn.tap();
}
function audit(page, origin) {
  const errors = [], external = [], unexpected = [], assets = new Set();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => errors.push('Failed ' + request.url()));
  page.on('response', response => {
    if (response.status() >= 400) errors.push(response.status() + ' ' + response.url());
    else assets.add(new URL(response.url()).pathname);
  });
  page.on('websocket', socket => unexpected.push(socket.url()));
  return { errors, external, unexpected, assets, async route(route) {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin) external.push(url.href);
    else if (request.method() !== 'GET' || !allowed(url.pathname)) unexpected.push(request.method() + ' ' + url.pathname);
    else return route.continue();
    return route.abort();
  } };
}

async function run({ engine, name, device }, origin) {
  const browser = await engine.launch({ headless: true });
  try {
    const context = await browser.newContext(devices[device]);
    const page = await context.newPage();
    const traffic = audit(page, origin);
    await context.route('**/*', traffic.route);
    await page.addInitScript(() => {
      if (location.protocol !== 'http:') return;
      localStorage.setItem('hf-lab-send-localhost', '1');
      window.vinePointers = [];
      document.addEventListener('pointerdown', event => {
        if (event.target.id === 'field') window.vinePointers.push([event.pointerType, event.isTrusted, event.isPrimary]);
      }, true);
    });
    await page.goto(origin + path);
    await screen(page, 'play');
    const capture = label => page.screenshot({ path: join(shots, 'vine-' + name + '-' + label + '.png'), scale: 'css' });
    const first = await state(page);
    assert.equal(first.level, 1);
    assert.equal(first.started, false);
    await capture('01-opening');
    await sleep(3300);
    assert.equal((await state(page)).time, 0, 'the opening waits for a finger');
    const start = performance.now();
    await tapPoint(page, first.window);
    await until(page, () => window.vineState().time >= 1, null);
    const growing = await state(page);
    assert.ok(growing.started);
    assert.ok(growing.nodes.length > first.nodes.length, 'touch starts growth');
    await capture('02-growing');
    await until(page, () => window.vineState().screen === 'result', null, Math.max(1, 59500 - (performance.now() - start)));
    const firstWall = (performance.now() - start) / 1000;
    const result = await state(page);
    assert.equal(result.status, 'won');
    assert.ok(result.time > 0 && result.time < 60 && firstWall < 60, 'level one completes within one real minute');
    assert.deepEqual(await page.evaluate(() => window.vinePointers), [['touch', true, true]], 'single trusted touch');
    assert.equal((await save(page)).unlocked, 2);
    await capture('03-window');
    await button(page, 'next');
    await screen(page, 'play');
    const second = await state(page);
    assert.equal(second.level, 2);
    assert.ok(second.arms.length > 0);
    await tapPoint(page, second.arms[0]);
    await until(page, () => window.vineState().time >= 0.6, null);
    await button(page, 'pauseButton');
    await screen(page, 'pause');
    const paused = await state(page);
    await sleep(400);
    assert.deepEqual(await state(page), paused, 'pause freezes the bed');
    const before = await save(page);
    await button(page, 'sound');
    await button(page, 'ink');
    const after = await save(page);
    assert.equal(after.sound, !before.sound);
    assert.notEqual(after.look, before.look);
    await capture('04-pause');
    await button(page, 'resume');
    await until(page, () => window.vineState().time > 1.2, null);
    for (let i = 0; i < second.arms.length; i++) {
      const arm = (await state(page)).arms[i];
      await tapPoint(page, arm);
      await until(page, i => window.vineState().arms[i].ripe, i, 60000);
    }
    const fruit = await state(page);
    await tapPoint(page, second.window);
    await until(page, t => window.vineState().time > t + 0.4, fruit.time);
    await capture('05-grapes');
    await until(page, () => window.vineState().screen === 'result', null, 60000);
    const harvest = await state(page);
    assert.equal(harvest.status, 'won');
    assert.equal((await save(page)).unlocked, 3);
    await button(page, 'next');
    await screen(page, 'play');
    const third = await state(page);
    assert.equal(third.level, 3);
    assert.equal(third.flowers.length, 1);
    await tapPoint(page, { x: third.flowers[0].x - 23, y: 255 });
    await until(page, () => window.vineState().flowers[0].shade >= 0.45, null, 20000);
    const beforeCut = await state(page);
    await capture('06-shade');
    const cutNode = beforeCut.nodes.filter(n => n.alive && n.depth === 0)
      .sort((a, b) => Math.abs(a.y - 365) - Math.abs(b.y - 365))[0];
    assert.ok(cutNode, 'reachable wood above the main fork');
    await flick(page, name, { x: cutNode.x - 38, y: cutNode.y }, { x: cutNode.x + 38, y: cutNode.y });
    await until(page, n => window.vineState().cuts > n, beforeCut.cuts);
    await until(page, () => window.vineState().flowers[0].shade < 0.15, null);
    const cut = await state(page);
    assert.ok(cut.nodes.filter(n => !n.alive).length > beforeCut.nodes.filter(n => !n.alive).length, 'flick detaches wood');
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await screen(page, 'pause');
    await button(page, 'endless');
    await screen(page, 'play');
    const arbour = await state(page);
    assert.ok(arbour.endless);
    assert.equal(arbour.score, 0);
    assert.ok(arbour.flowers.length > 0);
    for (let i = 0; i < arbour.arms.length; i++) {
      await tapPoint(page, (await state(page)).arms[i]);
      await until(page, i => window.vineState().arms[i].ripe, i, 65000);
    }
    await tapPoint(page, arbour.window);
    await capture('07-arbour');
    await until(page, () => window.vineState().best > 0, null, 65000);
    const best = (await state(page)).best;
    assert.equal((await save(page)).best, best);
    await page.reload();
    await screen(page, 'play');
    const restored = await state(page);
    assert.equal(restored.best, best);
    assert.equal(restored.unlocked, 3);
    const stored = await save(page);
    assert.equal(stored.best, best);
    assert.equal(stored.sound, after.sound);
    assert.equal(stored.look, after.look);
    assert.equal(stored.v, 1);
    assert.equal(await page.evaluate(() => localStorage.getItem('night-vine:hint')), '1');
    assert.deepEqual(await page.evaluate(() => Object.keys(localStorage).filter(k =>
      k.startsWith('hf-lab-') && k !== 'hf-lab-send-localhost')), []);
    for (const file of ['save', 'audio', 'pause', 'zoom', 'screens', 'hint']) {
      assert.ok(traffic.assets.has('/kit/' + file + '.js'), 'uses kit/' + file);
    }
    assert.ok(traffic.assets.has(feedback), 'loads the feedback button');
    for (const key of ['errors', 'external', 'unexpected']) assert.deepEqual(traffic[key], [], key);
    console.log(JSON.stringify({ device, firstSeconds: result.time, firstWallSeconds: firstWall,
      firstNodes: result.nodes.length, fruitAt: fruit.time, secondSeconds: harvest.time,
      cuts: cut.cuts, detachedNodes: cut.nodes.filter(n => !n.alive).length,
      shadeBefore: beforeCut.flowers[0].shade, shadeAfter: cut.flowers[0].shade, best, errors: 0, external: 0, telemetry: 0 }));
  } finally {
    await browser.close();
  }
}
await mkdir(shots, { recursive: true });
await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
try {
  const origin = 'http://127.0.0.1:' + server.address().port;
  for (const profile of profiles) {
    try { await run(profile, origin); }
    catch (error) { console.error(profile.device, error); process.exitCode = 1; }
  }
} finally {
  await new Promise(done => server.close(done));
}
