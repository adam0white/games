// Phone check for Harvest Morning: node experiments/harvest/check.mjs [webkit|chromium]
// Serves experiments/ on a free port and plays with real touch pointer events on WebKit (iPhone 13) and Chromium (Pixel 7).
// The finger is steered by the careful bot from brain.js, which reads the live rules state each animation frame;
// every move reaches the game as a PointerEvent on the canvas, so the page's own input code does the work.
// Fails on any page or console error. Screenshots go to $SHOTS (default /private/tmp/night-harvest/).
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '..');
const SHOTS = process.env.SHOTS || '/private/tmp/night-harvest';
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
async function until(page, fn, what, ms = 10000, arg) { try { await page.waitForFunction(fn, arg, { timeout: ms }); } catch { throw new Error(`timed out waiting for: ${what}`); } }
let cur = null;
const state = (page = cur) => page.evaluate(() => window.harvestState());

// A real tap on a point of the canvas.
const tap = (page, x, y, pointerType = 'touch') => page.evaluate(([x, y, pointerType]) => {
  const el = document.getElementById('c');
  for (const t of ['down', 'up']) el.dispatchEvent(new PointerEvent('pointer' + t, { pointerId: 5, pointerType, isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true }));
}, [x, y, pointerType]);
const tapSlot = async (page, id) => { const st = await state(page), r = st.slots.find(q => q.id === id); assert.ok(r, `slot ${id} shown`); await tap(page, r.x + r.w / 2, r.y + r.h / 2); };

// Play with a finger steered by the careful bot until `stop` (a page-side predicate source) is true or the morning ends.
// Each animation frame: ask the bot where to go, then send a pointer down, move or up there (touch: aimed 34 px low,
// the way a thumb holds below the spot it wants). A blunt scythe is answered by tapping the Sharpen slot.
async function drive(page, { stopAt = null, ms = 60000 } = {}) {
  await page.evaluate(async ([stopAt, ms]) => {
    const { careful } = await import('/harvest/brain.js');
    const brain = careful(), el = document.getElementById('c'), t0 = performance.now();
    let down = false;
    const send = (type, x, y) => el.dispatchEvent(new PointerEvent('pointer' + type, { pointerId: 9, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true }));
    const inSlot = (st, x, y) => st.slots.some(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
    let last = { x: 0, y: 0 };
    for (;;) {
      await new Promise(r => requestAnimationFrame(r));
      const st = window.harvestState(), s = window.harvestSim();
      if (st.screen !== 'play' || st.over || (stopAt !== null && st.t >= stopAt) || performance.now() - t0 > ms) break;
      if (st.paused) continue;
      const out = brain(s), v = st.view;
      if (out && out.whet) {
        if (down) { send('up', last.x, last.y); down = false; }
        const w = st.slots.find(r => r.id === 'whet');
        if (w) for (const t of ['down', 'up']) el.dispatchEvent(new PointerEvent('pointer' + t, { pointerId: 4, pointerType: 'touch', isPrimary: true, clientX: w.x + w.w / 2, clientY: w.y + w.h / 2, bubbles: true }));
        continue;
      }
      if (!out) { if (down) { send('up', last.x, last.y); down = false; } continue; }
      const x = v.ox + out.x * v.c, y = v.oy + out.y * v.c + v.lift;
      if (!down) {
        // put the thumb down just below the farmer (never on a neighbour), then slide to the goal
        const fx = v.ox + s.me.x * v.c, fy = v.oy + s.me.y * v.c + v.lift;
        const sy = inSlot(st, fx, fy) ? v.oy + s.me.y * v.c : fy;
        send('down', fx, sy); down = true;
      }
      send('move', x, y); last = { x, y };
    }
    if (down) send('up', last.x, last.y);
  }, [stopAt, ms]);
}
async function leave(page) { await page.click('#pause'); await page.click('#quit'); await sleep(300); }

async function open(browser, options) {
  const context = await browser.newContext(options), page = await context.newPage(), errors = [];
  await page.bringToFront();
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
  cur = page;
  return { context, page, errors };
}
const setSave = (page, blob) => page.evaluate(b => { localStorage.setItem('harvest-save', JSON.stringify(b)); localStorage.setItem('hf-lab-send-localhost', '1'); }, blob);
const blank = (n = 12) => Array(n).fill(0);

// Every new morning starts in the foreground and must produce a running frame before input checks.
async function startGame(page, selector = '#play') {
  await page.bringToFront();
  await page.click(selector);
  await until(page, () => { const st = window.harvestState(); return st.screen === 'play' && st.playing && !st.paused && st.t > 0.05; }, `first drawn game frame after ${selector}`);
}

// Reference requirement: an untouched field must contain visible golden ears, not bare soil.
async function visibleWheat(page) {
  await until(page, () => window.harvestState().t > 0.05, 'first drawn game frame');
  const result = await page.evaluate(() => {
    const st = window.harvestState(), cv = document.getElementById('c'), q = cv.getContext('2d'), scale = cv.width / st.view.W;
    const x = Math.ceil(st.view.ox * scale), y = Math.ceil(st.view.oy * scale), w = Math.floor(st.cols * st.view.c * scale), h = Math.floor(st.rows * st.view.c * scale / 4);
    const data = q.getImageData(x, y, w, h).data;
    let gold = 0;
    // Golden ears survive the darkest storm tint; soil, stubble and white canvas must fail.
    const isGold = (r, g, b) => r > 150 && g > 110 && r > 1.1 * g && r > 2.3 * b;
    for (let i = 0; i < data.length; i += 4) if (isGold(data[i], data[i + 1], data[i + 2])) gold++;
    return { gold, controls: [[240,194,79], [178,143,68], [160,131,67], [176,136,80], [216,182,114], [255,255,255]].map(rgb => isGold(...rgb)) };
  });
  assert.deepEqual(result.controls, [true, true, true, false, false, false], 'gold classifier accepts dry and storm ears, rejects soil, stubble and white');
  assert.ok(result.gold > 50, `standing field visibly contains golden wheat (${result.gold} pixels)`);
}

async function firstMorning(page, phone, labSent) {
  await page.goto(`${base}/harvest/?seed=7`);
  await page.evaluate(() => localStorage.setItem('hf-lab-send-localhost', '1'));
  await page.reload();
  await until(page, () => window.harvestState && window.harvestState().screen === 'menu', 'menu');
  assert.match(await page.textContent('#menu'), /The game lab records play/, 'lab notice on the menu');
  assert.ok(!(await page.isVisible('#daily')), 'a first visit shows only Play');
  await sleep(300);
  await page.screenshot({ path: join(SHOTS, `${phone}-1-menu.png`) });

  // Field 1: wait without touching; the ghost finger shows how to hold and move.
  await page.bringToFront();
  await startGame(page);
  let st = await state();
  assert.ok(st.playing && st.screen === 'play' && st.level === 1, 'Play starts field 1');
  await until(page, () => window.harvestState().hint, 'the hold-and-move hint after 3 s idle', 6000);
  await visibleWheat(page);
  await page.screenshot({ path: join(SHOTS, `${phone}-2-hint.png`) });
  // A touch ends the hint for good.
  await drive(page, { stopAt: (await state()).t + 1.5 });
  st = await state();
  assert.ok(!st.hint && await page.evaluate(() => localStorage.getItem('harvest:hint')) === '1', 'touching ends the hint and remembers it');

  // Mid-play: cutting, a sheaf on the back.
  await drive(page, { stopAt: 9 });
  st = await state();
  assert.ok(st.cart > 0 || st.me.carryN > 0, `grain gathered by touch (cart ${st.cart}, carrying ${st.me.carryN})`);
  await page.screenshot({ path: join(SHOTS, `${phone}-3-mid.png`) });
  const t0 = st.t;

  // Pause freezes the morning; Keep going resumes; losing focus pauses; P resumes.
  await page.click('#pause');
  st = await state(); assert.ok(st.paused && (await page.isVisible('#paused')), 'pause button pauses');
  await sleep(300); assert.equal((await state()).t, st.t, 'time stands still while paused');
  await page.click('#resume');
  await until(page, t => window.harvestState().t > t, 'time moves after resume', 3000, st.t);
  await page.evaluate(() => dispatchEvent(new Event('blur')));
  assert.ok((await state()).paused, 'losing focus pauses');
  await page.keyboard.press('p');
  assert.ok(!(await state()).paused, 'P resumes');
  assert.ok((await state()).t >= t0);

  await drive(page, { ms: 90000 });
  await until(page, () => window.harvestState().screen === 'end', 'end card', 8000);
  st = await state();
  assert.ok(st.result.passed && st.result.stars >= 1, `field 1 passed by touch: kept ${st.result.kept}, ${st.result.stars} stars, in ${st.t.toFixed(0)} s`);
  console.log(`     ${phone}: field 1 by touch kept ${st.result.kept} (${st.result.stars} stars, ${st.result.why}) in ${st.t.toFixed(0)} s`);
  await sleep(1400); // the stars come in one by one
  await page.screenshot({ path: join(SHOTS, `${phone}-4-end.png`) });
  assert.ok(await page.isVisible('#next'), 'Next field offered after a win');
  assert.equal(st.stars[0], st.result.stars, 'stars saved');

  // The save survives a reload, and the menu now offers the next field and today's field.
  const blob = await page.evaluate(() => localStorage.getItem('harvest-save'));
  await page.reload();
  await until(page, () => window.harvestState && window.harvestState().screen === 'menu', 'menu after reload');
  assert.equal(await page.evaluate(() => localStorage.getItem('harvest-save')), blob, 'save unchanged by a reload');
  assert.match(await page.textContent('#play'), /Field 2/, 'Play goes on to field 2');
  assert.ok(await page.isVisible('#daily'), "today's field offered after the first win");
  await sleep(300);
  const runs = labSent.filter(r => r.game === 'harvest' && r.kind === 'run' && ['cleared', 'rain'].includes(r.data.outcome));
  assert.equal(runs.length, 1, 'the finished morning sent once to the lab');
  assert.ok(runs[0].data.summary.kept === st.result.kept, 'lab summary has the kept grain');

  // One tap restarts: the field picker, then field 1 again.
  await page.click('#fields');
  assert.equal(await page.locator('#grid button:not([disabled])').count(), 2, 'fields 1 and 2 open, the rest locked');
  await startGame(page, '#grid button[data-level="1"]');
  assert.equal((await state()).level, 1, 'field 1 from the picker');
  await leave(page);
}

// Field 3: hire the strong one by a real tap, work a little, then stop early and see the ledger.
async function hiring(browser, device, phone) {
  const { context, page, errors } = await open(browser, { ...device });
  await page.goto(`${base}/harvest/?level=3&seed=5`);
  await setSave(page, { v: 1, stars: [3, 3, ...blank(10)], best: blank() });
  await page.evaluate(() => localStorage.setItem('harvest:hint', '1'));
  await page.reload();
  await startGame(page);
  let st = await state();
  assert.equal(st.level, 3);
  assert.ok(st.minTouch >= 48, `smallest neighbour slot ${st.minTouch?.toFixed(0)} px`);
  await sleep(800);
  await tapSlot(page, 'strong');
  st = await state();
  assert.ok(st.helpers.strong.hired, 'a tap hires the strong one');
  await tapSlot(page, 'strong');
  assert.ok((await state()).helpers.strong.hired, 'a quick second tap does not send him home');
  await drive(page, { stopAt: 25 });
  await page.screenshot({ path: join(SHOTS, `${phone}-5-hired.png`) });
  await page.click('#pause');
  await page.click('#stopHere');
  await until(page, () => window.harvestState().screen === 'end', 'end card after Stop here', 6000);
  st = await state();
  assert.equal(st.result.why, 'stopped');
  assert.ok(st.result.each.strong > 0 && st.result.each.strong < 22, `the strong one paid for part of a morning: ${st.result.each.strong}`);
  assert.equal(st.result.kept, Math.max(0, st.result.cart - st.result.pay + st.result.bonus), 'kept = cart - pay + bonus');
  assert.match(await page.textContent('#ledger'), /Strong one/, 'the ledger names the strong one');
  await sleep(1200);
  await page.screenshot({ path: join(SHOTS, `${phone}-6-stopped.png`) });
  await startGame(page, '#again');
  assert.equal((await state()).level, 3, 'one tap plays again');
  await leave(page);
  await sleep(300);
  assert.ok(context.labSent.some(r => r.game === 'harvest' && r.kind === 'run' && r.data.outcome === 'stopped' && r.data.events.some(e => e.type === 'hire')), 'the stopped morning and the hire sent to the lab');
  assert.deepEqual(errors, [], 'page errors on field 3');
  await context.close();
}

// Today's field: the same field for everyone on a date, the device best, the device board.
async function today(browser, device, phone) {
  const { context, page, errors } = await open(browser, { ...device });
  await page.goto(`${base}/harvest/?date=2026-11-20&time=25`);
  await setSave(page, { v: 1, stars: [2, ...blank(11)], best: blank(), daily: { '2026-11-19': 40, junk: 'x' }, board: [{ d: '2026-11-19', k: 40, n: 1 }] });
  await page.evaluate(() => localStorage.setItem('harvest:hint', '1'));
  await page.reload();
  await startGame(page, '#daily');
  const a = await state(), dig = await page.evaluate(() => { const s = window.harvestSim(); return [s.cols, s.rows, Array.from(s.st).join('')]; });
  assert.ok(a.daily && a.today === '2026-11-20', "today's field starts");
  await leave(page);
  await startGame(page, '#daily');
  assert.deepEqual(await page.evaluate(() => { const s = window.harvestSim(); return [s.cols, s.rows, Array.from(s.st).join('')]; }), dig, 'the same date gives the same field');
  await sleep(2600);
  await page.screenshot({ path: join(SHOTS, `${phone}-7-today.png`) });
  await drive(page, { ms: 60000 });
  await until(page, () => window.harvestState().screen === 'end', "today's end card", 10000);
  const end = await state();
  assert.equal(end.dailyBest, Math.max(end.result.kept, 0), "today's best saved");
  assert.equal(end.board.length, 2, 'the board holds the old and the new morning');
  assert.match(await page.textContent('#end'), /Today's field/);
  await sleep(500);
  await page.screenshot({ path: join(SHOTS, `${phone}-8-today-end.png`) });
  await page.click('#toMenu');
  assert.match(await page.textContent('#menuLine'), new RegExp(`today's best ${end.dailyBest}`), "the menu shows today's best");
  const saved = JSON.parse(await page.evaluate(() => localStorage.getItem('harvest-save')));
  assert.deepEqual(Object.keys(saved.daily).sort(), ['2026-11-19', '2026-11-20'], 'a bad daily entry is dropped');
  await page.goto(`${base}/harvest/?date=2026-11-21`);
  await startGame(page, '#daily');
  assert.notDeepEqual(await page.evaluate(() => { const s = window.harvestSim(); return [s.cols, s.rows, Array.from(s.st).join('')]; }), dig, 'another date gives another field');
  await leave(page);
  assert.deepEqual(errors, [], "page errors on today's field");
  await context.close();
}

// Leave wheat standing through a short morning: rain must visibly reach it on both phones.
async function rain(browser, device, phone, reducedMotion = 'no-preference') {
  const { context, page, errors } = await open(browser, { ...device, reducedMotion });
  await page.goto(`${base}/harvest/?seed=7&time=3&hint=0`);
  await page.bringToFront();
  await startGame(page);
  await visibleWheat(page);
  await until(page, () => { const v = window.harvestState(); return v.t >= v.time + 2.5; }, 'rain crossing standing wheat');
  // Freeze the view before screenshot encoding can let the front cross another column.
  await page.click('#pause');
  await page.locator('#paused').evaluate(el => { el.style.visibility = 'hidden'; });
  const st = await state();
  assert.ok(st.rainWheat >= 5, `standing wheat keeps visible soaked stalks (${st.rainWheat} cells)`);
  const wet = await page.evaluate(() => { const s = window.harvestSim(); return { front: s.front, soaked: s.stats.soaked, standing: Array.from(s.st).filter(v => v === 1).length }; });
  assert.ok(wet.front > 0 && wet.front < st.cols && wet.soaked >= st.rainWheat && wet.standing > 0, 'rain has wet wheat behind it and standing wheat ahead');
  await page.screenshot({ path: join(SHOTS, `${phone}-rain${reducedMotion === 'reduce' ? '-reduced' : ''}.png`) });
  console.log(`     ${phone}: rain reached ${st.rainWheat} standing cells, ${wet.standing} still standing${reducedMotion === 'reduce' ? ' (reduced motion)' : ''}`);
  assert.deepEqual(errors, [], 'page errors during rain');
  await context.close();
}

// 360 x 640: the last field, every slot, nothing too small.
async function small(browser) {
  const { context, page, errors } = await open(browser, { viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(`${base}/harvest/?level=12&seed=4`);
  await setSave(page, { v: 1, stars: [...Array(11).fill(1), 0], best: blank() });
  await page.evaluate(() => localStorage.setItem('harvest:hint', '1'));
  await page.reload();
  await page.screenshot({ path: join(SHOTS, 'small-360-menu.png') });
  await startGame(page);
  await drive(page, { stopAt: 12 });
  const st = await state();
  assert.equal(st.slots.length, 5, 'four neighbours and the whetstone');
  assert.ok(st.minTouch >= 48, `360 px wide: smallest slot ${st.minTouch.toFixed(0)} px`);
  const fieldBottom = st.view.oy + (st.rows + 1.7) * st.view.c;
  assert.ok(fieldBottom <= st.view.vergeTop + 1, `the lane ends above the verge (${fieldBottom.toFixed(0)} <= ${st.view.vergeTop.toFixed(0)})`);
  assert.ok(st.view.ox >= 0 && st.view.ox + st.cols * st.view.c <= 360, 'the field fits the width');
  await page.screenshot({ path: join(SHOTS, 'small-360-field12.png') });
  await leave(page);
  assert.deepEqual(errors, [], 'page errors on the small screen');
  await context.close();
}

// Desktop: mouse to hold and move, keys to walk, 1 to hire, Space to sharpen, Escape to pause.
async function desktop(browser) {
  const { context, page, errors } = await open(browser, { viewport: { width: 1280, height: 800 } });
  await page.goto(`${base}/harvest/?level=3&seed=2`);
  await setSave(page, { v: 1, stars: [1, 1, ...blank(10)], best: blank() });
  await page.reload();
  assert.ok(await page.isVisible('.desk'), 'the mouse and keys line shows on desktop');
  await page.bringToFront();
  await startGame(page);
  await until(page, () => window.harvestState().t > 0.05, 'desktop first drawn game frame');
  let st = await state();
  const v = st.view, me0 = st.me;
  await page.mouse.move(v.ox + me0.x * v.c, v.oy + me0.y * v.c);
  await page.mouse.down();
  await page.mouse.move(v.ox + (me0.x - 2) * v.c, v.oy + (me0.y - 3) * v.c, { steps: 5 });
  // The rule advances in fixed simulation steps; host rendering load must not shorten the held input.
  await until(page, t => window.harvestState().t >= t + 0.9, '0.9 game seconds with the mouse held', 10000, st.t);
  await page.mouse.up();
  st = await state();
  assert.ok(st.me.y < me0.y - 1, `mouse drag moves the farmer (${me0.y.toFixed(1)} to ${st.me.y.toFixed(1)})`);
  const y1 = st.me.x;
  await page.keyboard.down('ArrowRight');
  await until(page, t => window.harvestState().t >= t + 0.7, '0.7 game seconds with the arrow held', 10000, st.t);
  await page.keyboard.up('ArrowRight');
  assert.ok((await state()).me.x > y1 + 0.8, 'the arrow key walks right');
  await page.keyboard.press('1');
  assert.ok((await state()).helpers.strong.hired, 'key 1 hires the first neighbour');
  await page.keyboard.press('Escape');
  assert.ok((await state()).paused, 'Escape pauses');
  await page.keyboard.press('Escape');
  assert.ok(!(await state()).paused, 'Escape resumes');
  await page.screenshot({ path: join(SHOTS, 'desktop.png') });
  await leave(page);
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
    await firstMorning(page, phone, context.labSent);
    assert.deepEqual(errors, [], 'page errors');
    await context.close();
    await hiring(browser, device, phone);
    await today(browser, device, phone);
    await rain(browser, device, phone);
    if (phone === 'chromium') await rain(browser, device, phone, 'reduce');
    if (phone === 'chromium') { await small(browser); await desktop(browser); }
    console.log(`ok   harvest on ${phone} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  } catch (e) {
    failed++;
    console.log(`FAIL harvest on ${phone}: ${e.message}`);
    if (errors.length) console.log('     ' + errors.join('\n     '));
    try { console.log('     state: ' + JSON.stringify(await state()).slice(0, 1500)); } catch {}
    try { await cur.screenshot({ path: join(SHOTS, `${phone}-FAIL.png`) }); } catch {}
  }
  await browser.close();
}
server.close();
console.log(`screenshots in ${SHOTS}`);
process.exit(failed ? 1 : 0);
