import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const shots = '/private/tmp/night-r4-new4';
const load = createRequire(join(resolve(process.env.PLAYWRIGHT || join(homedir(), 'code/human-framework/node_modules')), 'check.cjs'));
const { devices, chromium, webkit } = load('playwright');
const { PNG } = createRequire(load.resolve('playwright'))('playwright-core/lib/utilsBundle');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  try {
    let file;
    if (pathname === '/notes/button.js') file = resolve(root, '../workers/feedback/public/notes/button.js');
    else if (/^\/(lab\/night-loaves|kit)\/[\w.-]*$/.test(pathname)) {
      file = join(root, pathname, pathname.endsWith('/') ? 'index.html' : '');
    } else throw Error('unexpected path');
    const bytes = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] });
    res.end(bytes);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
const state = page => page.locator('#bakery').evaluate(el => ({ ...el.dataset }));
const stored = page => page.evaluate(() => JSON.parse(localStorage.getItem('night-loaves:save')));
const stage = (page, expected) => page.waitForFunction(s => document.querySelector('#bakery')?.dataset.stage === s, expected, { timeout: 17000, polling: 60 });

async function touchDrag(page, name) {
  const cdp = name === 'chromium' ? await page.context().newCDPSession(page) : null;
  return async (x1, y1, x2, y2, held) => {
    const box = await page.locator('#bakery').boundingBox();
    assert.ok(Math.abs(box.width / box.height - 360 / 490) < 0.015, 'canvas fits the scene');
    const point = (x, y) => ({ x: box.x + x / 360 * box.width, y: box.y + y / 490 * box.height });
    const send = (type, p) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [p] : [] });
    const start = point(x1, y1);
    if (cdp) await send('touchStart', start);
    else { await page.mouse.move(start.x, start.y); await page.mouse.down(); }
    try {
      for (let i = 1; i <= 6; i++) {
        const p = point(x1 + (x2 - x1) * i / 6, y1 + (y2 - y1) * i / 6);
        if (cdp) await send('touchMove', p);
        else await page.mouse.move(p.x, p.y);
        await sleep(28);
      }
      await sleep(80);
      if (held) await held();
    } finally {
      if (cdp) await send('touchEnd');
      else await page.mouse.up();
    }
  };
}
async function wakeDisplay(page) {
  await page.bringToFront();
  const v = page.viewportSize();
  await page.setViewportSize({ ...v, width: v.width + 1 });
  await sleep(200);
  await page.setViewportSize(v);
  await sleep(200);
}
async function photograph(page, name, scene) {
  for (let attempt = 0; attempt < 3; attempt++) {
    let bytes;
    try {
      bytes = await page.screenshot({ scale: 'css', timeout: 45000 });
    } catch (error) {
      if (error.name !== 'TimeoutError' || attempt === 2) throw error;
    }
    if (bytes) {
      const {data} = PNG.sync.read(bytes);
      const colors = new Set();
      for (let i = 0; i < data.length; i += 92) {
        if (data[i + 3] > 200) colors.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
      }
      if (colors.size > 100) {
        await writeFile(join(shots, 'night-loaves-' + name + '-' + scene + '.png'), bytes);
        return;
      }
    }
    await wakeDisplay(page);
  }
  assert.fail('blank photograph: ' + scene);
}

async function prepare(page, drag, capture) {
  let s;
  for (let i = 0; i < 20; i++) {
    s = await state(page);
    if (s.stage !== 'knead') break;
    const direction = i % 2 ? -1 : 1;
    await drag(+s.x - direction * 38, +s.y + 8, +s.x + direction * 39, +s.y - 7,
      i === 0 && capture ? () => capture('02-fold') : null);
  }
  await stage(page, 'rise');
  await stage(page, 'shape');
  s = await state(page);
  await drag(+s.x - 40, +s.y + 4, +s.x + 6, +s.y - 1);
  await page.waitForFunction(() => document.querySelector('#bakery').dataset.shaped === 'true', null, {timeout:3000});
  s = await state(page);
  await drag(+s.x, +s.y, 245, 145);
  await stage(page, 'bake');
}

async function bakeBatch(page, drag, capture) {
  const began = Date.now();
  await prepare(page, drag, capture);
  let s;
  if (capture) await capture('03-oven');
  await page.waitForFunction(() => +document.querySelector('#bakery').dataset.brown >= 0.70, null, {polling: 35, timeout: 18000});
  s = await state(page);
  await drag(+s.x, +s.y, 163, 354);
  await stage(page, 'serve');
  let paid = 0;
  let gift = 0;
  s = await state(page);
  const loafCount = +s.remaining;
  for (let i = 0; i < loafCount; i++) {
    const last = i === loafCount - 1;
    if (last) {
      const arrival = +s.time + 1.3;
      await page.waitForFunction(t => +document.querySelector('#bakery').dataset.time >= t, arrival, {polling: 50, timeout: 8000});
      if (capture) await capture('04-last-loaf');
    }
    s = await state(page);
    await drag(+s.x, +s.y, last ? 136 : 67, last ? 216 : 214);
    await page.waitForFunction(n => +document.querySelector('#bakery').dataset.remaining === n - 1, +s.remaining, {timeout:3000});
    const after = await state(page);
    assert.equal(+after.remaining, +s.remaining - 1, 'a hand received one loaf');
    if (last) gift = +after.score - +s.score;
    else paid = +after.score - +s.score;
    s = after;
  }
  await stage(page, 'done');
  assert.ok(gift > paid && paid > 0, 'the last loaf earns more when given away');
  return {wall: (Date.now() - began) / 1000, simulated: +s.time, score: +s.score, loaves: loafCount, paid, gift};
}

await mkdir(shots, {recursive: true});
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const origin = 'http://127.0.0.1:' + server.address().port;
const profiles = { webkit: [webkit, 'iPhone 13'], chromium: [chromium, 'Pixel 7'] };
const selection = process.argv[2] ? [process.argv[2]] : Object.keys(profiles);
try {
  for (const name of selection) {
    const [engine, device] = profiles[name];
    const browser = await engine.launch({headless:true});
    try {
      const context = await browser.newContext(devices[device]);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(String(e)));
      page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
      await context.route('**/*', route => {
        const u = new URL(route.request().url());
        if (u.origin === origin && route.request().method() === 'GET' &&
            (u.pathname.startsWith('/lab/night-loaves/') || u.pathname.startsWith('/kit/') || u.pathname === '/notes/button.js')) return route.continue();
        errors.push('unexpected request ' + u);
        return route.abort();
      });
      if (name === 'webkit') {
        await page.goto('about:blank');
        await wakeDisplay(page);
      }
      await page.goto(origin + '/lab/night-loaves/');
      await page.bringToFront();
      if (name === 'webkit') await wakeDisplay(page);
      await stage(page, 'knead');
      const capture = scene => photograph(page, name, scene);
      await capture('01-opening');
      const drag = await touchDrag(page, name);
      // Capturing the GPU surface can block input on a loaded host. Time ordinary play,
      // then repeat the same morning for the three mid-gesture photographs.
      const morning = await bakeBatch(page, drag);
      console.log(name, 'first morning', JSON.stringify(morning));
      assert.equal(morning.loaves, 2);
      assert.ok(morning.wall < 60, 'first morning wall seconds: ' + morning.wall);
      await page.locator('#next').waitFor({state:'visible'});
      await capture('05-result');
      assert.equal((await stored(page)).unlocked, 2);
      await page.tap('#retry');
      await stage(page, 'knead');
      await bakeBatch(page, drag, capture);
      await page.locator('#next').waitFor({state:'visible'});
      await page.tap('#next');
      await stage(page, 'knead');
      await page.tap('#pause');
      await page.locator('#resume').waitFor({state:'visible'});
      const paused = await state(page);
      await sleep(420);
      assert.deepEqual(await state(page), paused, 'pause freezes the scene');
      await page.tap('#sound');
      await page.tap('#resume');
      await page.tap('#pause');
      await page.tap('#endless');
      await stage(page, 'knead');
      const endless = await bakeBatch(page, drag);
      await page.locator('#next').waitFor({state:'visible'});
      const best = (await stored(page)).best;
      assert.equal(best, endless.score, 'the first endless score is the device best');
      await page.tap('#next');
      await stage(page, 'knead');
      await page.reload();
      await stage(page, 'knead');
      assert.equal((await stored(page)).best, best);
      await prepare(page, drag);
      await stage(page, 'burnt');
      await page.tap('#retry');
      await stage(page, 'knead');
      assert.equal((await stored(page)).best, best, 'burning a batch preserves the device best');
      assert.deepEqual(errors, [], 'page errors, failed responses and unexpected requests');
      console.log(JSON.stringify({name, morning, endless, best, errors:errors.length}));
    } finally { await browser.close(); }
  }
} finally { server.close(); }
