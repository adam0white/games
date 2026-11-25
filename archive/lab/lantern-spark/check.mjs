// Phone check for Lantern: Spark: PLAYWRIGHT=<dir with playwright> node experiments/lab/lantern-spark/check.mjs [webkit|chromium]
// Serves experiments/ on a free port and plays night 1 by real pointer input on WebKit (iPhone 13) and Chromium (Pixel 7):
// one finger steers, a second finger strikes a spark, the spark button is tapped, a pilot finger steers to dawn. Fails on any
// page error, console error or failed request. Screenshots go to /private/tmp/night-lantern-spark/ (or $SHOTS).
// ?fast=3 runs the river three times faster so a night fits in the check; ?seed=7 fixes the river.
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { TIN } from './sim.js';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../..');
const SHOTS = process.env.SHOTS || '/private/tmp/night-lantern-spark';
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
const require = createRequire(join(resolve(process.env.PLAYWRIGHT || '/Users/abdul/code/human-framework/node_modules'), 'x.js'));
const { webkit, chromium, devices } = require('playwright');
const PHONES = { webkit: [webkit, devices['iPhone 13']], chromium: [chromium, devices['Pixel 7']] };
const sleep = ms => new Promise(done => setTimeout(done, ms));
async function until(page, fn, what, ms = 10000, arg) { try { await page.waitForFunction(fn, arg, { timeout: ms }); } catch { throw new Error(`timed out waiting for: ${what}`); } }
const state = page => page.evaluate(() => window.echoState());
const SEED = 7, URL0 = `${base}/lab/lantern-spark/?seed=${SEED}&fast=3`;

// Touch pointer events on the canvas, as a finger makes them.
const touch = (page, type, id, x, y) => page.evaluate(([type, id, x, y]) => document.getElementById('c').dispatchEvent(new PointerEvent('pointer' + type, { pointerId: id, pointerType: 'touch', isPrimary: id === 1, clientX: x, clientY: y, pressure: type === 'up' ? 0 : 0.5, bubbles: true, cancelable: true })), [type, id, x, y]);

// The pilot: a finger held on the river that slides to where a planner says, the way a thumb steers (kit drag.js: travel
// times gain over the river's width), and a tap on the spark button every three seconds. It seeks visible embers to refill the scarce tin. The planner reads the river (it is a
// test of the page, not of skill): it holds each candidate x for 0.6 s at Lantern's own lateral limit and keeps the clearest.
async function pilot(page) {
  await page.evaluate(async () => {
    const L = await import('/lantern/sim.js'), E = await import('/lab/lantern-spark/sim.js');
    const el = document.getElementById('c'), btn = document.getElementById('spark'), gain = 1.3;
    const send = (type, x, y) => el.dispatchEvent(new PointerEvent('pointer' + type, { pointerId: 5, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, pressure: type === 'up' ? 0 : 0.5, bubbles: true, cancelable: true }));
    function plan(e) {
      const s = e.s, embers = E.view(e).embers;
      const v = L.speed(s), lat = 0.95 * L.nightPace(s.stage), b = L.boat(s), c0 = L.centre(s, s.y + 0.2), h0 = L.half(s, s.y + 0.2) - b;
      const obs = s.rocks.filter(k => k.on).map(k => ({ lo: k.x0 - k.a - k.len, hi: k.x0 + k.a + k.len, y: k.y, rad: k.rad }));
      let best = s.x, top = -Infinity;
      for (let i = 0; i <= 30; i++) {
        const x = c0 - h0 + 0.01 + (2 * h0 - 0.02) * i / 30; let clear = 0.08, bx = s.x;
        for (let t = 0.05; t <= 0.6; t += 0.05) {
          bx += Math.max(-lat * 0.05, Math.min(lat * 0.05, x - bx)); const by = s.y + v * t, c = L.centre(s, by);
          clear = Math.min(clear, (L.half(s, by) - b - Math.abs(bx - c)) * 2 + 0.02);
          for (const o of obs) { const dy = Math.abs(o.y - by); if (dy > 0.15) continue; clear = Math.min(clear, (Math.hypot(Math.max(0, o.lo - bx, bx - o.hi), dy) - o.rad - b) * (1.5 - 0.5 * t / 0.6)); }
        }
        let score = clear * 10 - Math.abs(x - s.x) * 0.3 - Math.abs(x - c0) * 0.2;
        for (const p of embers) { const dy = p.y - s.y; if (p.kind === 'ember' && dy > 0 && dy < 1) score += Math.max(0, 0.08 - Math.abs(p.x - x)) * 2 / (0.3 + dy); }
        if (score > top) { top = score; best = x; }
      }
      return best;
    }
    let down = false, x0 = 0, from = 0, fx = 0, hearts = 0, lastSpark = 0;
    window.__pilot = { sparks: 0, moves: 0 };
    const f = () => {
      const st = window.echoState(), e = window.echoGame();
      if (st.screen !== 'play' || e.s.over) { if (down) send('up', fx, innerHeight * 0.85); return; }
      if (!down || st.hearts !== hearts) { // touch down, or re-anchor after a blow (the page rebases the steering then)
        if (!down) { x0 = fx = innerWidth / 2; send('down', x0, innerHeight * 0.85); down = true; } else x0 = fx;
        from = e.s.x; hearts = st.hearts;
      }
      fx = x0 + (plan(e) - from) * st.unit / gain; send('move', fx, innerHeight * 0.85); window.__pilot.moves++;
      if (e.s.t - lastSpark > 3 && e.tin > 0) { lastSpark = e.s.t; btn.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 9, pointerType: 'touch', bubbles: true, cancelable: true })); window.__pilot.sparks++; }
      requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  });
}

async function run(page, phone) {
  page.setDefaultTimeout(60000);
  await page.goto(URL0);
  await until(page, () => window.echoState && window.echoState().screen === 'menu', 'menu');
  await sleep(400);
  await page.screenshot({ path: join(SHOTS, `${phone}-1-menu.png`) });
  const sizes = await page.evaluate(() => [...document.querySelectorAll('button')].filter(b => b.offsetParent).map(b => Math.min(b.offsetWidth, b.offsetHeight)));
  assert.ok(Math.min(...sizes) >= 48, `menu touch targets at least 48 px (${Math.min(...sizes)})`);
  const fonts = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(n => n.offsetParent && n.childNodes.length && [...n.childNodes].some(c => c.nodeType === 3 && c.textContent.trim())).map(n => parseFloat(getComputedStyle(n).fontSize)));
  assert.ok(Math.min(...fonts) >= 14, `no text under 14 px on the menu (${Math.min(...fonts)})`);

  // Capture startup within the real click task, before a loaded host can advance past the opening ring.
  await page.evaluate(() => document.getElementById('play').addEventListener('click', () => { window.__opened = window.echoState(); window.echoGame().s.safe = 1e9; }, { once: true }));
  await page.tap('#play');
  let st = await page.evaluate(() => window.__opened);
  assert.ok(st.playing && st.screen === 'play' && st.night === 1, 'Play starts night 1');
  assert.equal(st.tin, TIN, `the tin starts at ${TIN}`);
  assert.ok(st.rings >= 1, 'the night opens with a free spark');
  assert.ok(st.sparkHint, 'the spark button pulses before its first use');
  const btn = await page.evaluate(() => { const r = document.getElementById('spark').getBoundingClientRect(); return { w: r.width, h: r.height, right: innerWidth - r.right, bottom: innerHeight - r.bottom }; });
  assert.ok(btn.w >= 48 && btn.h >= 48 && btn.right >= 0 && btn.bottom >= 0, `spark button ${btn.w} px, on screen`);

  // One finger steers; a second finger strikes a spark and does not take the steering.
  const cx = st.W / 2, cy = st.H * 0.85, dir = (st.c + st.h) - st.x > st.x - (st.c - st.h) ? 1 : -1; // toward the side of the river with more room
  const tgt0 = (await state(page)).target;
  await touch(page, 'down', 1, cx, cy);
  await touch(page, 'move', 1, cx + 20 * dir, cy); await touch(page, 'move', 1, cx + 40 * dir, cy);
  st = await state(page);
  assert.ok((st.target - tgt0) * dir > 0.05, `one finger steers (target ${tgt0.toFixed(3)} to ${st.target.toFixed(3)})`);
  const used0 = st.used;
  await touch(page, 'down', 2, cx - 100 * dir, cy - 200);
  await until(page, used => window.echoState().used === used + 1, 'a second finger strikes a spark', 3000, used0);
  await touch(page, 'move', 2, cx - 160 * dir, cy - 200); // the second finger moving must not steer
  const afterTwo = await state(page);
  assert.equal(afterTwo.target, st.target, 'the second finger does not steer (the target stays where the first finger put it)');
  await touch(page, 'up', 2, cx - 160 * dir, cy - 200);
  await touch(page, 'move', 1, cx - 10 * dir, cy);
  st = await state(page);
  assert.ok((afterTwo.target - st.target) * dir > 0.05, `the first finger still steers after the second lifts (${afterTwo.target.toFixed(3)} to ${st.target.toFixed(3)})`);
  await touch(page, 'up', 1, cx - 10 * dir, cy);
  assert.ok(!st.sparkHint, 'the pulse stops after the first spark');

  // A real tap on the spark button.
  const used1 = st.used;
  await page.tap('#spark');
  await until(page, used => window.echoState().used === used + 1, 'the spark button strikes a spark', 3000, used1);
  await sleep(250);
  await page.screenshot({ path: join(SHOTS, `${phone}-2-spark.png`) });

  // Pause by the button, then go on.
  await page.tap('#pause');
  st = await state(page); assert.ok(st.paused && st.screen === 'paused', 'the pause button pauses');
  await sleep(300); assert.equal((await state(page)).t, st.t, 'time stands still while paused');
  await page.screenshot({ path: join(SHOTS, `${phone}-3-paused.png`) });
  await page.tap('#resume');
  await until(page, t => window.echoState().t > t, 'time moves after Go on', 3000, st.t);

  // Input assertions run without collisions resetting the drag anchor between automation calls.
  // Start a fresh river without that protection for the full pointer pilot and its dawn assertion.
  await page.tap('#pause'); await page.tap('#quit'); await page.tap('#play');
  assert.ok((await state(page)).hearts === 3 && (await page.evaluate(() => window.echoGame().s.safe)) < 2, 'the dawn pilot starts a fresh, unprotected river');
  await pilot(page);
  let mid = false;
  for (let i = 0; i < 400; i++) {
    st = await state(page);
    if (st.over) break;
    if (!mid && st.reach > 0.45) { mid = true; await page.screenshot({ path: join(SHOTS, `${phone}-4-mid.png`) }); }
    await sleep(150);
  }
  st = await state(page);
  assert.equal(st.over, 'dawn', `the pilot reaches dawn on night 1 (ended: ${st.over} at ${Math.round(st.reach * 100)}%)`);
  const pilotStats = await page.evaluate(() => window.__pilot);
  assert.ok(pilotStats.moves > 200 && pilotStats.sparks > 10, `the pilot steered and sparked (${pilotStats.moves} moves, ${pilotStats.sparks} sparks)`);
  await sleep(1200);
  await page.screenshot({ path: join(SHOTS, `${phone}-5-dawn.png`) });
  await until(page, () => window.echoState().screen === 'end', 'end card', 6000);
  await sleep(400);
  await page.screenshot({ path: join(SHOTS, `${phone}-6-end.png`) });
  assert.equal(await page.textContent('#endTitle'), 'Dawn');
  st = await state(page);
  assert.equal(st.best, 2, 'night 2 opens');
  assert.ok(st.stars[1] >= 1, 'stars for night 1 saved');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('lantern-spark:save')));
  assert.ok(saved.best === 2 && saved.stars['1'] >= 1 && saved.played === 1, 'the save holds best, stars and runs');

  // One tap starts the next night; a blow and a wreck end it.
  await page.tap('#again');
  st = await state(page);
  assert.ok(st.playing && st.night === 2, 'one tap plays night 2');
  await until(page, () => window.echoState().over, 'night 2 to end with no steering', 60000);
  await until(page, () => window.echoState().screen === 'end', 'the wreck card', 5000);
  assert.equal(await page.textContent('#endTitle'), 'Wrecked');
  await sleep(300);
  await page.screenshot({ path: join(SHOTS, `${phone}-7-wrecked.png`) });
  await page.tap('#toMenu');
  assert.equal((await state(page)).screen, 'menu');
  await page.reload();
  await until(page, () => window.echoState && window.echoState().screen === 'menu', 'menu after reload');
  st = await state(page);
  assert.ok(st.best === 2 && st.night === 2, 'the menu offers night 2 after a reload');
  assert.match(await page.textContent('#play'), /night 2/);
  await page.screenshot({ path: join(SHOTS, `${phone}-8-menu-after.png`) });
}

// Losing focus pauses; Space strikes a spark on a keyboard; a mouse click strikes one too.
async function desktop(browser, errors) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } }), page = await context.newPage();
  listen(page, errors);
  await page.goto(URL0); await until(page, () => window.echoState && window.echoState().screen === 'menu', 'menu');
  // Protect this input-only fixture from collisions between automation calls.
  await page.evaluate(() => addEventListener('keydown', () => { window.echoGame().s.safe = 1e9; }, { once: true }));
  await page.keyboard.press('Enter');
  let st = await state(page); assert.ok(st.playing, 'Enter plays');
  await page.keyboard.press(' ');
  await until(page, () => window.echoState().used === 1, 'Space strikes a spark', 3000);
  await page.mouse.move(640, 500); await page.mouse.down(); await page.mouse.up();
  await until(page, () => window.echoState().used === 2, 'a mouse click strikes a spark', 3000);
  await sleep(300);
  await page.screenshot({ path: join(SHOTS, 'desktop.png') });
  await page.evaluate(() => dispatchEvent(new Event('blur')));
  assert.ok((await state(page)).paused, 'losing focus pauses');
  await page.keyboard.press('p');
  assert.ok(!(await state(page)).paused, 'P goes on');
  await context.close();
}
async function small(browser, errors) {
  const context = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }), page = await context.newPage();
  listen(page, errors);
  await page.goto(URL0); await until(page, () => window.echoState && window.echoState().screen === 'menu', 'menu');
  await page.screenshot({ path: join(SHOTS, 'small-360-menu.png') });
  await page.tap('#play');
  await until(page, () => document.querySelector('.kit-hint.on'), 'the first-run drag hint at 360 px');
  await sleep(650);
  const hintGap = await page.evaluate(() => {
    const hint = document.querySelector('.kit-hint.on'), spark = document.getElementById('spark').getBoundingClientRect();
    const parts = [...hint.querySelectorAll('.track, .knob, .hand, .label')].filter(el => getComputedStyle(el).display !== 'none');
    return spark.top - Math.max(...parts.map(el => el.getBoundingClientRect().bottom));
  });
  assert.ok(hintGap >= 16, `the first-run drag hint clears the spark button at 360 px (${hintGap.toFixed(1)} px)`);
  console.log(`     360 px hint-to-spark gap: ${hintGap.toFixed(1)} px`);
  await page.screenshot({ path: join(SHOTS, 'small-360-hint.png') });
  await page.tap('#spark'); await sleep(400);
  await page.screenshot({ path: join(SHOTS, 'small-360-play.png') });
  const over = await page.evaluate(() => { const a = document.getElementById('spark').getBoundingClientRect(), b = document.getElementById('hud').getBoundingClientRect(); return a.right <= innerWidth && a.bottom <= innerHeight && b.bottom < a.top; });
  assert.ok(over, 'the spark button and HUD fit at 360 x 640');
  await context.close();
}
function listen(page, errors) {
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('requestfailed', r => errors.push(`request failed: ${r.url()}`));
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
}

const only = process.argv[2];
let failed = 0;
for (const [phone, [engine, device]] of Object.entries(PHONES)) {
  if (only && only !== phone) continue;
  const browser = await engine.launch(), errors = [];
  const context = await browser.newContext({ ...device }), page = await context.newPage();
  listen(page, errors);
  const t0 = Date.now();
  try {
    await run(page, phone);
    if (phone === 'chromium') { await small(browser, errors); await desktop(browser, errors); }
    assert.deepEqual(errors, [], 'page and console errors');
    console.log(`ok   lantern-spark on ${phone} (${((Date.now() - t0) / 1000).toFixed(0)} s, 0 page or console errors)`);
  } catch (e) {
    failed++;
    console.log(`FAIL lantern-spark on ${phone}: ${e.message}`);
    if (errors.length) console.log('     ' + errors.join('\n     '));
    try { console.log('     state: ' + JSON.stringify(await state(page))); } catch {}
    try { await page.screenshot({ path: join(SHOTS, `${phone}-FAIL.png`) }); } catch {}
  }
  await browser.close();
}
server.close();
console.log(`screenshots in ${SHOTS}`);
process.exit(failed ? 1 : 0);
