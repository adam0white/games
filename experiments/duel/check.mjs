// Phone check for Thumb Duel: PLAYWRIGHT=<dir with playwright> node experiments/duel/check.mjs [webkit|chromium]
// Serves experiments/ on a free port and plays with real touch input on WebKit (iPhone 13) and Chromium (Pixel 7):
// on Chromium through CDP touch events (several touch points at once), on WebKit through dispatched pointer events with
// separate pointer ids. Fails on any page error, console error or failed request. Screenshots go to $SHOTS
// (default /private/tmp/night-duel). ?fast=1 shortens the 3 s countdown to 1 s; everything else is the real game.
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import assert from 'node:assert/strict';
import { KINDS } from './sim.js';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '..');
const SHOTS = process.env.SHOTS || '/private/tmp/night-duel';
await mkdir(SHOTS, { recursive: true });
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/notes/button.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(''); }
  let file = normalize(join(root, decodeURIComponent(url.pathname)));
  if (url.pathname.endsWith('/')) file = join(file, 'index.html');
  try { if (!file.startsWith(root)) throw 0; const body = await readFile(file); res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' }); res.end(body); }
  catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;

const require = createRequire(process.env.PLAYWRIGHT ? join(resolve(process.env.PLAYWRIGHT), 'x.js') : '/Users/abdul/code/human-framework/node_modules/x.js');
const { webkit, chromium, devices } = require('playwright');
const PHONES = { webkit: [webkit, devices['iPhone 13']], chromium: [chromium, devices['Pixel 7']] };
const sleep = ms => new Promise(done => setTimeout(done, ms));
let cur = null;
const state = (page = cur) => page.evaluate(() => window.duelState());
async function until(page, fn, what, ms = 15000, arg) { try { await page.waitForFunction(fn, arg, { timeout: ms }); } catch { throw new Error(`timed out waiting for: ${what}`); } }

// Fingers on the glass. Each has an id; several can be down at once.
// Chromium: CDP Input.dispatchTouchEvent: touchStart and touchMove carry every active point, touchEnd the point that lifts
// (the browser makes one pointer, with its own id, per point).
// WebKit: PointerEvents dispatched on the element under the point, each with its own pointerId.
async function fingers(page, engine) {
  const active = new Map();
  let cdp = null;
  if (engine === 'chromium') cdp = await page.context().newCDPSession(page);
  const list = () => [...active.entries()].map(([id, [x, y]]) => ({ x, y, id, radiusX: 8, radiusY: 8, force: 1 }));
  const pe = (type, id, x, y) => page.evaluate(([type, id, x, y]) => {
    const el = document.elementFromPoint(x, y) ?? document.getElementById('c');
    el.dispatchEvent(new PointerEvent('pointer' + type, { pointerId: id, pointerType: 'touch', isPrimary: false, clientX: x, clientY: y, pressure: type === 'up' ? 0 : 0.5, bubbles: true, cancelable: true, composed: true }));
  }, [type, id, x, y]);
  return {
    async down(id, x, y) { active.set(id, [x, y]); if (cdp) await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: list() }); else await pe('down', id, x, y); },
    async move(id, x, y) { active.set(id, [x, y]); if (cdp) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: list() }); else await pe('move', id, x, y); },
    // touchEnd lists the points that lift (checked: listing the ones that stay lifts those instead)
    async up(id) { const [x, y] = active.get(id); active.delete(id); if (cdp) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x, y, id, radiusX: 8, radiusY: 8 }] }); else await pe('up', id, x, y); },
    async tap(id, x, y) { await this.down(id, x, y); await this.up(id); },
    async clear() { for (const id of [...active.keys()]) await this.up(id); },
  };
}
// Board point (x across 0..1, y from -1 top to 1 bottom) to screen pixels.
const at = (st, x, y) => [st.board.bx + x * st.board.k, st.board.cy + y * st.board.k];
async function swipeByThumb(f, st, side, id) {
  const dir = side === 0 ? 1 : -1;
  await f.down(id, ...at(st, 0.5, dir * 0.77));
  await sleep(75);
  await f.move(id, ...at(st, 0.5, dir * 0.34));
  await f.up(id);
}

async function open(browser, options) {
  const context = await browser.newContext(options), page = await context.newPage(), errors = [];
  context.labSent = [];
  await context.route('https://human.adamwhite.work/**', async route => {
    const req = route.request(), cors = { 'access-control-allow-origin': base, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'Content-Type' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const record = JSON.parse(gunzipSync(req.postDataBuffer()).toString()); context.labSent.push(record);
    return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ ok: true, id: record.id }) });
  });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('requestfailed', r => errors.push(`request failed: ${r.url()}`));
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  // Every pointer event the canvas sees, to show which ids came and went.
  await page.addInitScript(() => { window.__ptr = []; addEventListener('DOMContentLoaded', () => { const c = document.getElementById('c'); for (const t of ['pointerdown', 'pointerup', 'pointercancel']) c.addEventListener(t, e => window.__ptr.push([t, e.pointerId])); }); });
  cur = page;
  return { context, page, errors };
}
const localSend = page => page.evaluate(() => localStorage.setItem('hf-lab-send-localhost', '1'));

// A solo match against the easy bot, played by one thumb through real touch input, duel by duel the way a person would:
// tap fast at tug, tap when the lantern lights, tap when the firefly is on this side, repeat the lights, hold at sumo,
// hold and let go to keep the drop in the middle, chase the seed with the paddle. Returns the final state.
const PADXY = [[0.29, 0.36], [0.71, 0.36], [0.29, 0.72], [0.71, 0.72]];
async function soloByThumb(page, f, label, shot) {
  let st = await state(), taps = 0, mid = false, down = false, kind = null, tapped = -1, lastSwipe = 0;
  const t0 = Date.now();
  const hold = async (want, x, y) => { if (want && !down) { await f.down(1, x, y); down = true; } else if (!want && down) { await f.up(1); down = false; } };
  while (st.screen === 'play' && Date.now() - t0 < 150000) {
    if (st.kind !== kind || st.phase !== 'play') { if (down) await hold(false); kind = st.kind; }
    if (st.phase === 'play' && st.d) {
      const d = st.d, [cx, cy] = at(st, 0.5, 0.6);
      if (kind === 'tug') { await f.tap(2 + (taps++ % 4), cx + (taps % 3 - 1) * 30, cy); }
      else if (kind === 'draw') { if (d.st === 'lit' && tapped !== d.flashes) { tapped = d.flashes; await f.tap(2, cx, cy); } }
      else if (kind === 'catch') { if (d.mode !== 'hidden' && d.y > 0.06 && d.stun[0] <= 0) await f.tap(2, cx, cy); }
      else if (kind === 'memory') { if (d.st === 'answer' && !d.out[0] && d.idx[0] < d.seq.length) { const [x, y] = PADXY[d.seq[d.idx[0]]]; await f.tap(2, ...at(st, x, y)); } }
      else if (kind === 'sumo') await hold(true, cx, cy);
      else if (kind === 'balance') await hold(d.x[0] + d.v[0] * 0.35 < 0, cx, cy);
      else if (kind === 'swipe' && Date.now() - lastSwipe >= 230) {
        await swipeByThumb(f, st, 0, 1); lastSwipe = Date.now();
      } else if (kind === 'launch') {
        const target = d.targets[d.shots[0]];
        if (target !== undefined) await hold(d.charge[0] < target, cx, cy);
      }
      else if (kind === 'hockey') {
        const pk = d.puck, tx = pk.x + (pk.x < 0.5 ? 0.03 : -0.03), ty = pk.y > -0.05 ? pk.y + 0.12 : 0.75;
        const [x, y] = at(st, tx, Math.max(0.1, ty));
        if (!down) { await f.down(1, x, y); down = true; } else await f.move(1, x, y);
      }
      if (!mid && shot && kind === 'tug' && Math.abs(d.p) > 0.3) { await page.screenshot({ path: join(SHOTS, shot) }); mid = true; }
    }
    await sleep(kind === 'tug' ? 60 : 25);
    st = await state();
  }
  if (down) await hold(false);
  assert.equal(st.screen, 'end', `${label}: the match reaches the end card`);
  return st;
}

async function run(page, phone, engine) {
  const f = await fingers(page, engine);
  await page.goto(`${base}/duel/?seed=7`);
  await localSend(page);
  await page.reload();
  await until(page, () => window.duelState && window.duelState().screen === 'menu', 'menu');
  assert.match(await page.textContent('#menu'), /The game lab records play/, 'lab notice on the menu');
  const lines = await page.$$eval('#menu .card > p:not(:has(button)):not([class*="lab"])', ps => ps.filter(p => p.offsetParent && p.textContent.trim()).length);
  assert.equal(lines, 1, 'the first screen shows one short line');
  let st = await state();
  assert.ok(st.minTouchPx >= 48, `menu touch targets at least 48 px (${st.minTouchPx.toFixed(0)})`);
  await sleep(300);
  await page.screenshot({ path: join(SHOTS, `${phone}-1-menu.png`) });
  await page.click('#toSolo');
  assert.ok(await page.isDisabled('[data-level="medium"]'), 'medium is locked before easy is beaten');
  await page.screenshot({ path: join(SHOTS, `${phone}-1b-levels.png`) });

  // 1. A first-ever match against the easy bot, by thumb taps. It opens with tug of war; the countdown shows the picture.
  await page.click('[data-level="easy"]');
  st = await state();
  assert.ok(st.screen === 'play' && st.solo === 'easy' && st.phase === 'intro', 'solo match starts with a countdown');
  assert.equal(st.kind, 'tug', 'a first-ever match opens with tug of war');
  await sleep(1300);
  await page.screenshot({ path: join(SHOTS, `${phone}-2-countdown.png`) });
  await until(page, () => window.duelState().phase === 'play', 'the first duel starts');
  assert.equal(await page.evaluate(() => localStorage.getItem('duel:hint')), null, 'no hint key before any input');
  await until(page, () => document.querySelector('#hint-bottom .kit-hint.on'), 'the first duel shows the solo hint');
  assert.equal(await page.locator('#hint-top .kit-hint.on').count(), 0, 'the bot seat does not show a hint');
  st = await soloByThumb(page, f, 'solo vs easy', `${phone}-3-mid-tug.png`);
  assert.equal(await page.evaluate(() => localStorage.getItem('duel:hint')), '1', 'the first tap in play retires the hint');
  assert.equal(st.winner, 0, `the thumb beats the easy bot (${st.score.join('-')}, duels ${st.duels.map(d => d.kind).join(' ')})`);
  assert.equal(st.save.solo.easy.won, 1, 'the win is saved');
  await sleep(700);
  await page.screenshot({ path: join(SHOTS, `${phone}-4-end-solo.png`) });
  assert.ok(await page.isVisible('#re0'), 'rematch button on the bottom');
  await sleep(300);
  const runs = page.context().labSent.filter(r => r.game === 'duel' && r.kind === 'run' && r.data.outcome === 'won');
  assert.equal(runs.length, 1, 'the match was sent to the lab once, as won');
  const duelsSent = runs[0].data.events.filter(e => e.type === 'duel');
  assert.ok(duelsSent.length >= 3 && duelsSent.every(e => KINDS.includes(e.data.kind) && [0, 1, -1].includes(e.data.winner) && e.data.ms > 0 && e.data.solo === true), 'each duel recorded with kind, winner, duration and solo');

  // 2. Solo rematch: the bot's side is always ready, so one tap starts it.
  await page.click('#re0');
  await until(page, () => window.duelState().screen === 'play', 'solo rematch starts with one tap', 3000);
  await page.click('#pause'); assert.ok((await state()).paused, 'pause button pauses');
  const tp = (await state()).t; await sleep(400); assert.equal((await state()).t, tp, 'time stands still while paused');
  await page.click('#resume');
  await until(page, t => window.duelState().t > t, 'time moves after resume', 3000, tp);
  await page.evaluate(() => dispatchEvent(new Event('blur')));
  assert.ok((await state()).paused, 'losing focus pauses');
  await page.click('#quit');
  st = await state();
  assert.equal(st.screen, 'menu', 'Menu from the pause card');
  await page.click('#toSolo');
  assert.ok(!(await page.isDisabled('[data-level="medium"]')), 'beating easy opens medium');
  await page.click('#solo .back');

  // 3. Two players, two thumbs at once: tug of war, both tapping together; the bottom taps twice as often.
  await page.goto(`${base}/duel/?seed=11&only=tug&fast=1&hint=hand`);
  await page.click('#play');
  await until(page, () => window.duelState().phase === 'play', 'friend tug starts');
  await until(page, () => document.querySelectorAll('.hint-side .kit-hint.on').length === 2, 'both players see the tap hint');
  const mirror = await page.evaluate(() => {
    const bottom = document.querySelector('#hint-bottom .kit-hint').getBoundingClientRect();
    const top = document.querySelector('#hint-top .kit-hint').getBoundingClientRect();
    const rotate = new DOMMatrix(getComputedStyle(document.getElementById('hint-top')).transform);
    return { centered: Math.abs(top.x - bottom.x) < 1, mirrored: Math.abs(top.y + bottom.y - innerHeight) < 2, above: top.y < innerHeight / 2, flipped: rotate.a === -1 && rotate.d === -1 };
  });
  assert.deepEqual(mirror, { centered: true, mirrored: true, above: true, flipped: true }, 'the top hint mirrors position and orientation');
  await sleep(600);
  await page.screenshot({ path: join(SHOTS, `${phone}-two-tap-hints.png`) });
  st = await state();
  await f.tap(10, ...at(st, 0.5, 0.6));
  assert.equal(await page.locator('.hint-side .kit-hint').count(), 0, 'the first tap retires both copies of the shared hint');
  await f.tap(20, ...at(st, 0.5, -0.6));
  let n = 0, shot = false;
  for (let guard = 0; guard < 400; guard++) {
    st = await state();
    if (st.screen !== 'play') break;
    if (st.phase !== 'play') { await sleep(100); continue; }
    const [bx0, by0] = at(st, 0.4, 0.6), [tx0, ty0] = at(st, 0.6, -0.6);
    await f.down(10, bx0, by0); await f.down(20, tx0, ty0);        // both down together
    await f.up(10); await f.up(20);
    await f.tap(11, bx0 + 20, by0 + 10);                             // and the bottom once more
    n++;
    if (!shot && n === 12) { await page.screenshot({ path: join(SHOTS, `${phone}-5-two-thumbs-tug.png`) }); shot = true; }
    await sleep(60);
  }
  st = await state();
  assert.equal(st.screen, 'end', 'the two-player match ends');
  assert.equal(st.winner, 0, `the faster thumb wins every duel (${st.score.join('-')})`);
  const ptr = await page.evaluate(() => window.__ptr);
  const downs = new Set(ptr.filter(p => p[0] === 'pointerdown').map(p => p[1]));
  assert.ok(downs.size >= 3, `separate pointer ids reached the page (${[...downs].join(', ')})`);
  await sleep(500);
  await page.screenshot({ path: join(SHOTS, `${phone}-6-end-friends.png`) });
  // Both must tap Rematch.
  await page.click('#re0');
  await sleep(400);
  assert.equal((await state()).screen, 'end', 'one rematch tap is not enough with a friend');
  assert.deepEqual((await state()).ready, [true, false]);
  await page.screenshot({ path: join(SHOTS, `${phone}-7-one-ready.png`) });
  await page.click('#re1');
  await until(page, () => window.duelState().screen === 'play', 'both rematch taps start a new match', 3000);
  assert.equal((await state()).matchNo, 2, 'the rematch is the second match since the page loaded');
  assert.equal((await state()).save.friend.run, 1, 'the bottom side has one win in a row');

  // 4. Hold and tap at once: sumo. The top holds; the bottom taps and lets go; the top must still be holding.
  await page.goto(`${base}/duel/?seed=5&only=sumo&fast=1`);
  await page.click('#play');
  await until(page, () => window.duelState().phase === 'play', 'sumo starts');
  st = await state();
  const [sx0, sy0] = at(st, 0.5, -0.6), [sx1, sy1] = at(st, 0.5, 0.6);
  await f.down(30, sx0, sy0);
  await sleep(150);
  await f.tap(31, sx1, sy1);
  await sleep(100);
  st = await state();
  assert.deepEqual(st.held, [false, true], 'after the bottom lets go, the top finger still holds');
  assert.ok(st.d.held[1] && !st.d.held[0], 'the top beetle pushes, the bottom one does not');
  await f.down(32, sx1, sy1); await sleep(400);
  st = await state();
  assert.ok(st.d.held[0] && st.d.held[1], 'both beetles push with two fingers down');
  await page.screenshot({ path: join(SHOTS, `${phone}-8-sumo-both-hold.png`) });
  await f.up(30); await sleep(100);
  st = await state();
  assert.deepEqual(st.held, [true, false], 'lifting the top finger frees only the top');
  await f.clear();

  // 5. Two paddles dragged at once to different places; a top finger that wanders into the bottom half stays the top's.
  await page.goto(`${base}/duel/?seed=5&only=hockey&fast=1`);
  await page.click('#play');
  await until(page, () => window.duelState().phase === 'play', 'hockey starts');
  st = await state();
  const B0 = at(st, 0.5, 0.78), T0 = at(st, 0.5, -0.78), B1 = at(st, 0.25, 0.55), T1 = at(st, 0.75, -0.45);
  await f.down(40, ...B0); await f.down(41, ...T0);
  for (let i = 1; i <= 10; i++) {
    await f.move(40, B0[0] + (B1[0] - B0[0]) * i / 10, B0[1] + (B1[1] - B0[1]) * i / 10);
    await f.move(41, T0[0] + (T1[0] - T0[0]) * i / 10, T0[1] + (T1[1] - T0[1]) * i / 10);
    await sleep(16);
  }
  await sleep(300);
  st = await state();
  const near = (p, x, y) => Math.hypot(p.x - x, p.y - y) < 0.05;
  assert.ok(near(st.d.pads[0], 0.25, 0.55) && near(st.d.pads[1], 0.75, -0.45), `each paddle follows its own finger (bottom ${st.d.pads[0].x.toFixed(2)},${st.d.pads[0].y.toFixed(2)} top ${st.d.pads[1].x.toFixed(2)},${st.d.pads[1].y.toFixed(2)})`);
  await page.screenshot({ path: join(SHOTS, `${phone}-9-hockey-two-paddles.png`) });
  // The top finger crosses into the bottom half: the top paddle stops at the middle, the bottom paddle stays put.
  const T2 = at(st, 0.75, 0.4);
  for (let i = 1; i <= 8; i++) { await f.move(41, T1[0] + (T2[0] - T1[0]) * i / 8, T1[1] + (T2[1] - T1[1]) * i / 8); await sleep(16); }
  await sleep(300);
  st = await state();
  assert.ok(st.d.pads[1].y < 0 && near(st.d.pads[0], 0.25, 0.55), `a top finger in the bottom half moves only the top paddle, to the middle (top y ${st.d.pads[1].y.toFixed(2)})`);
  assert.equal(st.pointers.find(p => p.id === 41 || p.side === 1)?.side, 1, 'that finger still belongs to the top');
  // The bottom finger lifts; the top keeps control.
  await f.up(40);
  const T3 = at(st, 0.3, -0.5);
  for (let i = 1; i <= 8; i++) { await f.move(41, T2[0] + (T3[0] - T2[0]) * i / 8, T2[1] + (T3[1] - T2[1]) * i / 8); await sleep(16); }
  await sleep(300);
  st = await state();
  assert.ok(near(st.d.pads[1], 0.3, -0.5) && near(st.d.pads[0], 0.25, 0.55), 'after the bottom lets go, the top still steers its own paddle');
  await f.clear();

  // 6. Every duel, forced with ?only=, a few seconds of play with both thumbs; screenshots of each.
  for (const kind of KINDS) {
    await page.goto(`${base}/duel/?seed=21&only=${kind}&fast=1`);
    await page.click('#play');
    if (phone === 'webkit' || kind === 'swipe' || kind === 'launch') { await sleep(500); await page.screenshot({ path: join(SHOTS, `${phone}-intro-${kind}.png`) }); }
    await until(page, () => window.duelState().phase === 'play', `${kind} starts`);
    st = await state();
    assert.ok(st.minTouchPx >= 48, `${kind}: touch targets at least 48 px (${st.minTouchPx.toFixed(0)})`);
    if (kind === 'swipe') {
      await f.tap(64, ...at(st, 0.5, 0.77));
      await f.down(65, ...at(st, 0.5, -0.77));
      await sleep(550);
      await f.move(65, ...at(st, 0.5, -0.34));
      await f.up(65);
      await until(page, t => window.duelState().t > t + 0.05, 'swipe inputs reach the simulation', 3000, (await state()).t);
      assert.deepEqual((await state()).d.strokes, [0, 0], 'the race rejects a tap and a slow drag');
      await swipeByThumb(f, st, 0, 64);
      await swipeByThumb(f, st, 1, 65);
      await until(page, () => window.duelState().d.strokes.every(n => n === 1), 'a flick toward center scores for each seat');
      await sleep(200);
      await swipeByThumb(f, st, 0, 64);
      await until(page, () => window.duelState().d.strokes[0] === 2, 'a second bottom flick advances only its racer');
      assert.deepEqual((await state()).d.strokes, [2, 1]);
      await page.screenshot({ path: join(SHOTS, `${phone}-play-swipe.png`) });
    } else if (kind === 'launch') {
      await f.tap(66, ...at(st, 0.22, 0.73));
      await f.down(66, ...at(st, 0.22, 0.73));
      await sleep(220);
      await f.down(67, ...at(st, 0.78, -0.73));
      await until(page, () => window.duelState().d.charge[0] >= 0.6, 'the meter fills under a held thumb');
      assert.deepEqual((await state()).d.shots, [0, 0], 'tapping and holding do not score before release');
      await page.screenshot({ path: join(SHOTS, `${phone}-play-launch.png`) });
      await until(page, () => { const d = window.duelState().d; return d.charge[0] >= d.targets[0] - 0.05; }, 'bottom reaches the target mark');
      await f.up(66);
      await until(page, () => window.duelState().d.shots[0] === 1, 'bottom releases one shot');
      assert.equal((await state()).d.shots[1], 0, 'top keeps holding while bottom releases');
      await until(page, () => { const d = window.duelState().d; return d.charge[1] >= d.targets[0] - 0.05; }, 'top reaches the target mark');
      await f.up(67);
      await until(page, () => window.duelState().d.shots[1] === 1, 'top releases one shot');
      assert.ok((await state()).d.scores.every(points => points >= 60), 'each thumb scores by releasing near the mark');
      await page.screenshot({ path: join(SHOTS, `${phone}-scored-launch.png`) });
      await f.down(66, ...at(st, 0.5, 0.75));
      await until(page, () => window.duelState().d.charge[0] >= 0.2, 'bottom starts another hold');
      await page.click('#pause'); await page.click('#resume');
      await f.up(66);
      await until(page, () => window.duelState().d.charge[0] === 0, 'pause clears the unfinished hold');
      assert.deepEqual((await state()).d.shots, [1, 1], 'lifting after a pause cannot fire the interrupted shot');
    } else {
      const t0 = Date.now();
      let i = 0;
      while (Date.now() - t0 < 3500) {
        st = await state(); if (st.phase !== 'play') break;
        if (kind === 'memory' && st.d.st === 'answer') {
          const P0 = [[0.29, 0.36], [0.71, 0.36], [0.29, 0.72], [0.71, 0.72]];
          const want = st.d.seq[st.d.idx[0]];
          if (want !== undefined && !st.d.out[0]) await f.tap(50, ...at(st, P0[want][0], P0[want][1]));
        } else if (kind === 'sumo' || kind === 'balance') { if (i % 6 === 0) await f.down(51, ...at(st, 0.5, 0.6)); if (i % 6 === 3) await f.up(51); }
        else if (kind === 'hockey') { const pk = st.d.puck; await f.down(52, ...at(st, pk.x, Math.max(0.15, pk.y + 0.1))); }
        else await f.tap(53, ...at(st, 0.5, 0.6));
        if (i === 8) await page.screenshot({ path: join(SHOTS, `${phone}-play-${kind}.png`) });
        i++; await sleep(90);
      }
    }
    await f.clear();
    await page.click('#pause'); await page.click('#quit');
    await sleep(200);
  }
  // A memory duel answered correctly by thumb wins the round.
  await page.goto(`${base}/duel/?seed=9&only=memory&fast=1`);
  await page.click('#toSolo'); await page.click('[data-level="easy"]');
  for (let guard = 0; guard < 300; guard++) {
    st = await state();
    if (st.phase === 'result' || st.screen !== 'play') break;
    if (st.phase === 'play' && st.d.st === 'answer' && !st.d.out[0] && st.d.idx[0] < st.d.seq.length) {
      const P0 = [[0.29, 0.36], [0.71, 0.36], [0.29, 0.72], [0.71, 0.72]], want = st.d.seq[st.d.idx[0]];
      await f.tap(60, ...at(st, P0[want][0], P0[want][1]));
    }
    await sleep(60);
  }
  st = await state();
  assert.equal(st.duels[0]?.winner, 0, 'repeating the lights by thumb wins the memory duel against the easy bot');
}

// A small screen and a desktop window with a mouse and the keyboard.
async function small(browser) {
  const { context, page, errors } = await open(browser, { viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(`${base}/duel/`);
  await sleep(300);
  await page.screenshot({ path: join(SHOTS, 'small-360-menu.png') });
  await page.goto(`${base}/duel/?seed=4&only=memory&fast=1`);
  await page.click('#play');
  await until(page, () => window.duelState().phase === 'play', 'small memory');
  await sleep(1200);
  const st = await state(page);
  assert.ok(st.minTouchPx >= 48, `360 px: touch targets at least 48 px (${st.minTouchPx.toFixed(0)})`);
  await page.screenshot({ path: join(SHOTS, 'small-360-memory.png') });
  await page.click('#pause'); await page.click('#quit');
  assert.deepEqual(errors, [], 'page errors on the small screen');
  await context.close();
}
async function desktop(browser) {
  const { context, page, errors } = await open(browser, { viewport: { width: 1280, height: 800 } });
  await page.goto(`${base}/duel/?seed=3&only=tug&fast=1`);
  assert.ok(await page.isVisible('text=Space is your thumb'), 'the menu tells a computer player about the keyboard');
  await page.click('#toSolo'); await page.click('[data-level="easy"]');
  await until(page, () => window.duelState().phase === 'play', 'desktop tug starts');
  for (let i = 0; i < 400; i++) { const st = await state(page); if (st.screen !== 'play') break; if (st.phase === 'play') await page.keyboard.press('Space'); await sleep(60); }
  const st = await state(page);
  assert.equal(st.screen, 'end', 'the keyboard plays a match to the end');
  assert.equal(st.winner, 0, 'Space taps beat the easy bot at tug');
  await sleep(500);
  await page.screenshot({ path: join(SHOTS, 'desktop-end.png') });
  // the mouse drags a paddle
  await page.goto(`${base}/duel/?seed=3&only=hockey&fast=1`);
  await page.click('#play');
  await until(page, () => window.duelState().phase === 'play', 'desktop hockey');
  const s0 = await state(page), [x0, y0] = at(s0, 0.5, 0.78), [x1, y1] = at(s0, 0.3, 0.5);
  await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move(x1, y1, { steps: 10 }); await sleep(300);
  const s1 = await state(page);
  assert.ok(Math.hypot(s1.d.pads[0].x - 0.3, s1.d.pads[0].y - 0.5) < 0.05, 'the mouse drags the bottom paddle');
  await page.screenshot({ path: join(SHOTS, 'desktop-hockey.png') });
  await page.mouse.up();
  await page.goto(`${base}/duel/?seed=3&only=swipe&fast=1`);
  await page.click('#play');
  await until(page, () => window.duelState().phase === 'play', 'desktop swipe');
  await page.keyboard.press('ArrowUp');
  await until(page, () => window.duelState().d.strokes[0] === 1, 'ArrowUp scores a swipe');
  await page.goto(`${base}/duel/?seed=3&only=launch&fast=1`);
  await page.click('#play');
  await until(page, () => window.duelState().phase === 'play', 'desktop launch');
  await page.keyboard.down('Space');
  await until(page, () => { const d = window.duelState().d; return d.charge[0] >= d.targets[0] - 0.05; }, 'Space charges the launch');
  await page.keyboard.up('Space');
  await until(page, () => window.duelState().d.scores[0] >= 60, 'releasing Space scores the launch');
  assert.deepEqual(errors, [], 'page errors on desktop');
  await context.close();
}

const only = process.argv[2];
let failed = 0;
for (const [phone, [engine, device]] of Object.entries(PHONES)) {
  if (only && only !== phone) continue;
  const browser = await engine.launch();
  const { context, page, errors } = await open(browser, { ...device });
  const t0 = Date.now();
  try {
    await run(page, phone, phone);
    assert.deepEqual(errors, [], 'page errors');
    await context.close();
    if (phone === 'chromium') { await small(browser); await desktop(browser); }
    console.log(`ok   duel on ${phone} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  } catch (e) {
    failed++;
    console.log(`FAIL duel on ${phone}: ${e.message}`);
    if (errors.length) console.log('     ' + errors.join('\n     '));
    try { const st = await state(); console.log('     state: ' + JSON.stringify({ ...st, d: undefined, save: undefined })); } catch {}
    try { await cur.screenshot({ path: join(SHOTS, `${phone}-FAIL.png`) }); } catch {}
  }
  await browser.close();
}
server.close();
console.log(`screenshots in ${SHOTS}`);
process.exit(failed ? 1 : 0);
