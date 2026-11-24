// Phone check for Follow Me: node experiments/ducklings/check.mjs
// Serves experiments/ (so ../kit/ resolves), answers /notes/button.js with an empty script, and plays stage 1
// to the end card with touch pointer events on WebKit (iPhone 13), Chromium (Pixel 7), and Chromium 360x640. Screenshots go to $SHOTS (default: a folder in the system temp dir).
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { gunzipSync } from 'node:zlib';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '..');
const SHOTS = process.env.SHOTS || join(tmpdir(), 'ducklings-shots');
await mkdir(SHOTS, { recursive: true });
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/notes/button.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(''); }
  if (url.pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
  let file = normalize(join(root, decodeURIComponent(url.pathname)));
  if (url.pathname.endsWith('/')) file = join(file, 'index.html');
  try { if (!file.startsWith(root)) throw 0; const body = await readFile(file); res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' }); res.end(body); }
  catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;

const require = createRequire(process.env.PLAYWRIGHT ? join(resolve(process.env.PLAYWRIGHT), 'x.js') : import.meta.url);
const { webkit, chromium, devices } = require('playwright');

const sleep = ms => new Promise(done => setTimeout(done, ms));
async function until(page, fn, what, ms = 15000, arg) { try { await page.waitForFunction(fn, arg, { timeout: ms, polling: 50 }); } catch { throw new Error(`timed out waiting for: ${what}`); } }
const state = page => page.evaluate(() => window.ducklingsState());
// A finger on the canvas, as touch pointer events (the kit's phone check does the same).
const finger = (page, steps) => page.evaluate(steps => {
  const el = document.querySelector('#c');
  for (const [type, x, y, id = 7] of steps) el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: id === 7, clientX: x, clientY: y, pressure: type === 'pointerup' ? 0 : 0.5, bubbles: true, cancelable: true }));
}, steps);
const tap = (page, sel) => page.evaluate(sel => { const el = document.querySelector(sel); el.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 9, pointerType: 'touch', bubbles: true, cancelable: true })); el.click(); }, sel);

// Steer like a player: hold the finger a little below where she should go. Waiting ducklings first, then the nest.
async function drive(page, ms, shotAt) {
  const vp = page.viewportSize(), t0 = Date.now(); let down = false, shot = false;
  while (Date.now() - t0 < ms) {
    const st = await state(page);
    if (st.screen !== 'play' || !st.playing) break;
    const goal = st.waitingDucks.filter(d => d.y > st.mom.y - 0.3).sort((a, b) => Math.hypot(a.sx - st.mom.sx, a.sy - st.mom.sy) - Math.hypot(b.sx - st.mom.sx, b.sy - st.mom.sy))[0] ?? st.nest ?? { sx: st.mom.sx, sy: st.mom.sy - 200 };
    // aim from her toward the goal, at most 120 px ahead, and put the finger 70 px under that point
    const dx = goal.sx - st.mom.sx, dy = goal.sy - st.mom.sy, d = Math.hypot(dx, dy) || 1, k = Math.min(1, 120 / d);
    const x = Math.max(10, Math.min(vp.width - 10, st.mom.sx + dx * k)), y = Math.max(80, Math.min(vp.height - 10, st.mom.sy + dy * k + 70));
    await finger(page, [[down ? 'pointermove' : 'pointerdown', x, y]]); down = true;
    if (shotAt && !shot && st.t >= shotAt.t) { shot = true; await page.screenshot({ path: shotAt.path, scale: 'css' }); }
    await sleep(60);
  }
  if (down) await finger(page, [['pointerup', 0, 0]]);
}

async function assertTargets(page) {
  for (const b of await page.locator('button:visible').all()) {
    const box = await b.boundingBox();
    assert.ok(box.width >= 40 && box.height >= 40, `${await b.getAttribute('id')}: tap target is at least 40 px`);
    assert.ok(box.x >= 0 && box.x + box.width <= page.viewportSize().width, 'button fits the phone width');
  }
}

async function run(name, engine, device) {
  const browser = await engine.launch();
  const context = await browser.newContext({ ...device });
  const page = await context.newPage();
  const errors = [], sent = [];
  page.setDefaultTimeout(12000);
  await context.route('https://human.adamwhite.work/**', async route => {
    const req = route.request();
    const cors = { 'access-control-allow-origin': base, 'access-control-allow-headers': 'Content-Type' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    sent.push(JSON.parse(gunzipSync(req.postDataBuffer()).toString()));
    return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: '{"ok":true}' });
  });
  await page.addInitScript(() => {
    const Real = window.AudioContext || window.webkitAudioContext;
    window.audioMade = 0;
    if (Real) window.AudioContext = window.webkitAudioContext = class extends Real {
      constructor(...args) { super(...args); window.audioMade++; }
    };
  });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  const shot = async label => {
    await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    await page.screenshot({ path: join(SHOTS, `${name}-${label}.png`), scale: 'css' });
  };
  const goto = suffix => page.goto(`${base}/ducklings/${suffix}`);
  const leave = async () => {
    await tap(page, '#pause');
    await tap(page, '#pauseMenu');
    assert.equal((await state(page)).screen, 'menu');
  };
  const end = () => until(page, () => window.ducklingsState().screen === 'end', 'end card');
  const save = () => page.evaluate(() => JSON.parse(localStorage.getItem('ducklings-save')));
  try {
    await goto('?fast=2');
    await until(page, () => window.ducklingsState?.().screen === 'menu', 'menu ready');
    if (!process.env.VISUAL_ONLY) await page.evaluate(() => localStorage.setItem('hf-lab-send-localhost', '1'));
    assert.match(await page.textContent('#menu'), /The game lab records play/);
    assert.equal(await page.evaluate(() => window.audioMade), 0);
    await assertTargets(page);
    await shot('map');
    await page.locator('#chapters button').nth(3).click();
    assert.equal(await page.locator('#nodes button:disabled').count(), 9);
    await assertTargets(page);
    await shot('river-map');
    await page.locator('#chapters button').first().click();
    assert.match(await page.textContent('#play'), /Play 1/);
    await page.click('#play');
    let st = await state(page);
    assert.equal(st.stage, 1);
    assert.ok(st.waiting && st.line === 1);
    assert.equal(await page.evaluate(() => window.audioMade), 1);
    await shot('first-swim');
    assert.ok(await page.locator('#c').evaluate(canvas => {
      const pixel = canvas.getContext('2d').getImageData(Math.floor(canvas.width * .58), Math.floor(canvas.height * .35), 1, 1).data;
      return pixel[1] > pixel[0];
    }), 'the opening pond is rendered without a hit flash');
    const y0 = st.mom.y;
    await finger(page, [['pointerdown', st.mom.sx, st.mom.sy - 20]]);
    await until(page, y => window.ducklingsState().mom.y > y + .048, 'thumb steers', 5000, y0);
    st = await state(page);
    assert.ok(st.rollCalls >= 1);
    await finger(page, [['pointerdown', 40, 300, 8], ['pointerup', 40, 300, 8], ['pointerup', 0, 0]]);
    await until(page, () => window.ducklingsState().quackCool > 0, 'second finger quacks');
    await tap(page, '#pause');
    st = await state(page);
    assert.ok(st.paused && st.screen === 'paused');
    await sleep(260);
    assert.equal((await state(page)).t, st.t, 'pause freezes simulation');
    await page.click('#resume');
    await until(page, t => window.ducklingsState().t > t + .15, 'resume continues', 4000, st.t);
    await page.evaluate(() => dispatchEvent(new Event('blur')));
    assert.ok((await state(page)).paused, 'blur pauses');
    await page.keyboard.press('p');
    await drive(page, 13000);
    await end();
    st = await state(page);
    assert.equal(st.over, 'nest');
    assert.equal(st.stars, 3);
    await sleep(550);
    await shot('home');
    await assertTargets(page);
    assert.equal((await save()).opened, 2);

    await page.click('#next');
    assert.equal((await state(page)).stage, 2);
    await shot('rescue');
    await drive(page, 14000, { t: .85, path: join(SHOTS, `${name}-mid-swim.png`) });
    await end();
    st = await state(page);
    assert.equal(st.stars, 3);
    assert.equal(st.arrived, 2);
    const blob = await save();
    assert.equal(blob.opened, 3);
    assert.equal(blob.home, 3);
    assert.deepEqual(blob.stars, { 1: 3, 2: 3 });
    await page.reload();
    assert.deepEqual(await save(), blob);
    assert.match(await page.textContent('#play'), /Play 3/);
    await page.locator('#nodes button[data-level="1"]').click();
    assert.equal((await state(page)).stage, 1, 'map replays an unlocked level');
    await leave();
    if (!process.env.VISUAL_ONLY) {
      await sleep(350);
      const runs = sent.filter(e => e.game === 'ducklings' && e.kind === 'run');
      assert.ok(runs.some(e => e.data.outcome === 'nest' && e.data.summary.stage === 2 &&
        e.data.summary.arrived === 2 && e.data.events.some(item => item.type === 'join')));
      assert.ok(runs.some(e => e.data.outcome === 'left'));
    }

    await goto('?level=5');
    await tap(page, '#play');
    assert.equal((await state(page)).lesson, 'car');
    await shot('road');
    await leave();
    await goto('?level=9');
    await tap(page, '#play');
    await shot('catnap');
    await leave();
    await goto('?level=16');
    await tap(page, '#play');
    await shot('folding-leaves');
    await leave();
    await goto('?level=20&fast=2');
    await tap(page, '#play');
    await shot('dash');
    await drive(page, 8000);
    await end();
    assert.equal((await state(page)).stars, 3, 'touch dash clears the moving current');
    assert.equal((await save()).opened, 3, 'preview did not unlock the map');

    if (!process.env.VISUAL_ONLY) {
      const legacy = { v: 1, sound: false, opened: 8, stars: {1: 2, 7: 3}, best: {1: 140}, endless: 8210, home: 56, album: {Pip: 1}, taught: true };
      await page.evaluate(old => localStorage.setItem('ducklings-save', JSON.stringify(old)), legacy);
      await goto('?hint=hand');
      assert.deepEqual(await save(), legacy);
      assert.equal((await state(page)).opened, 8);
      assert.match(await page.textContent('#endless'), /8210/);
      assert.match(await page.textContent('#sound'), /off/);
      await page.click('#sound');
      await tap(page, '#play');
      await until(page, () => document.querySelector('.kit-hint.on')?.dataset.kind === 'hold-and-move', 'shared hint');
      st = await state(page);
      await finger(page, [['pointerdown', st.mom.sx, st.mom.sy - 20]]);
      assert.equal(await page.locator('.kit-hint').count(), 0);
      await finger(page, [['pointerup', 0, 0]]);
      await leave();
      await tap(page, '#endless');
      st = await state(page);
      assert.equal(st.mode, 'endless');
      await finger(page, [['pointerdown', st.mom.sx, st.mom.sy - 90]]);
      await until(page, () => window.ducklingsState().t > 1, 'endless advances from touch');
      await shot('endless');
      await finger(page, [['pointerup', 0, 0]]);
      await leave();
      await goto('?level=20&fast=5');
      await tap(page, '#play');
      st = await state(page);
      await finger(page, [['pointerdown', st.mom.sx, st.mom.sy + 70], ['pointerup', 0, 0]]);
      await end();
      assert.equal((await state(page)).over, 'lost-all');
    }
    assert.deepEqual(errors, [], 'page errors');
    console.log(`ok   ${name}`);
    return true;
  } catch (e) {
    console.log(`FAIL ${name}: ${e.stack}`);
    if (errors.length) console.log(errors.join('\n'));
    await shot('fail').catch(() => {});
    return false;
  } finally { await browser.close(); }
}

const only = process.argv[2];
const runs = [
  ['webkit-iphone13', webkit, devices['iPhone 13']],
  ['chromium-pixel7', chromium, devices['Pixel 7']],
  ...[
    ['chromium-390x664', 390, 664],
    ['chromium-360x640', 360, 640],
  ].map(([name, width, height]) => [name, chromium, {
    ...devices['Pixel 7'], viewport: { width, height }, screen: { width, height },
  }]),
];
let ok = true;
for (const [name, engine, device] of runs) if (!only || name.includes(only)) ok = (await run(name, engine, device)) && ok;
server.close();
console.log(ok ? `all passed; screenshots in ${SHOTS}` : 'FAILED');
process.exitCode = ok ? 0 : 1;
