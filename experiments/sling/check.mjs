// Phone acceptance: PLAYWRIGHT=<directory containing playwright> node experiments/sling/check.mjs [webkit|chromium]
// Uses real pointer gestures and the rules solver, never changes the page's simulation.
// Serves experiments/ and stubs the notes, recording and daily-board endpoints.
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import assert from 'node:assert/strict';
import { level, daily, solve, guide } from './sim.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = process.env.SHOTS || '/private/tmp/night-sling/screenshots';
await mkdir(SHOTS, { recursive: true });
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/notes/button.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(''); }
  let file = resolve(root, `.${decodeURIComponent(pathname)}`);
  if (pathname.endsWith('/')) file = join(file, 'index.html');
  try {
    assert.ok(file.startsWith(root + sep));
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
const require = createRequire(import.meta.url);
const { webkit, chromium, devices } = require(process.env.PLAYWRIGHT ? join(resolve(process.env.PLAYWRIGHT), 'playwright') : 'playwright');
const PHONES = { webkit: [webkit, devices['iPhone 13']], chromium: [chromium, devices['Pixel 7']] };
const DATE = '2026-11-23';
const sleep = ms => new Promise(done => setTimeout(done, ms));
const state = page => page.evaluate(() => window.slingState());
const shot = (page, phone, name) => page.screenshot({ path: join(SHOTS, `${phone}-${name}.png`) });
async function until(page, fn, label, timeout = 12000, arg = null) {
  try { await page.waitForFunction(fn, arg, { timeout }); }
  catch { throw new Error(`timed out: ${label}; state=${JSON.stringify(await state(page).catch(() => null))}`); }
}
async function open(browser, device) {
  const context = await browser.newContext(device), page = await context.newPage();
  const errors = [], requests = [], labSent = [];
  let fault = '';
  await context.addInitScript(() => { localStorage.setItem('hf-lab-send-localhost', '1'); });
  await context.route('**/lab-api/board/sling**', async route => {
    const req = route.request();
    requests.push({ method: req.method(), url: req.url(), body: req.postDataJSON(), fault });
    if (fault === 'offline') return route.abort('internetdisconnected');
    if (fault === '404') return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not found"}' });
    const rows = req.method() === 'POST' ? [{ n: req.postDataJSON().n, s: req.postDataJSON().s }, { n: 'Moss', s: 1200 }] : [{ n: 'Moss', s: 1200 }];
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(req.method() === 'POST' ? { place: 1, rows } : { rows }) });
  });
  await context.route('https://human.adamwhite.work/**', async route => {
    const req = route.request(), headers = { 'access-control-allow-origin': base, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'Content-Type' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const body = req.postDataBuffer();
    try { labSent.push(JSON.parse(gunzipSync(body).toString())); }
    catch { labSent.push(JSON.parse(body.toString())); }
    return route.fulfill({ status: 200, headers: { ...headers, 'content-type': 'application/json' }, body: '{"ok":true}' });
  });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => {
    const expectedNetworkError = fault && (/Failed to load resource|net::ERR_INTERNET_DISCONNECTED/i.test(m.text()) || m.location().url.includes('/lab-api/board/sling'));
    if (m.type() === 'error' && !expectedNetworkError) errors.push(m.text());
  });
  page.on('requestfailed', r => { if (!(fault && r.url().includes('/lab-api/board/sling'))) errors.push(`request failed: ${r.url()}`); });
  page.on('response', r => { if (r.status() >= 400 && !(fault && r.url().includes('/lab-api/board/sling'))) errors.push(`${r.status()} ${r.url()}`); });
  return { context, page, errors, requests, labSent, setFault(value) { fault = value; } };
}

// Select a flower, then pull from clear space. The move and release are browser mouse events,
// which produce trusted PointerEvents even in the phone contexts.
async function readyGuide(page) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const st = await state(page), move = guide(st.state);
    assert.ok(move, 'current garden has a route');
    if (!move.wait) return move;
    await until(page, tick => window.slingState().state.tick >= tick, 'a usable gust arrives', 7000, st.state.tick + move.wait);
  }
  throw new Error('no launchable wind phase after eight waits');
}
async function pull(page, move, preview = null, retry = 0) {
  const st = await state(page), flower = st.state.flowers[move.from];
  assert.ok(flower, `flower ${move.from} exists`);
  const point = p => ({ x: st.map.x + p.x * st.map.scale, y: st.map.y + p.y * st.map.scale });
  const f = point(flower);
  await page.mouse.click(f.x, f.y);
  const start = point({ x: 180, y: 460 });
  const end = { x: start.x + move.dx * st.map.scale, y: start.y + move.dy * st.map.scale };
  const viewport = page.viewportSize();
  assert.ok(end.x > 0 && end.x < viewport.width && end.y > 0 && end.y < viewport.height, 'pull release stays on screen');
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  if (preview) await preview();
  // Account for the wind at the actual release time. Rules run in Node against
  // a read-only snapshot; the page still receives only real pointer input.
  if (st.state.level.wind) {
    const adjusted = await readyGuide(page);
    if (adjusted.from !== move.from) {
      assert.ok(retry < 5, 'wind guidance settles on a launch flower');
      await page.evaluate(() => document.querySelector('#c').dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, pointerType: 'mouse', bubbles: true })));
      await page.mouse.up();
      return pull(page, adjusted, null, retry + 1);
    }
    await page.mouse.move(start.x + adjusted.dx * st.map.scale, start.y + adjusted.dy * st.map.scale);
  }
  await page.mouse.up();
}
async function finish(page, definition, phone, name) {
  const solution = solve(definition);
  assert.ok(solution?.shots?.length, 'rules solver supplies a route');
  let i = 0;
  for (let attempt = 0; attempt < solution.par + 6; attempt++) {
    const before = await state(page);
    if (before.screen === 'done' || before.state.status === 'won') break;
    assert.ok(!before.state.seed, 'previous seed settled before the next pull');
    const liveMove = await readyGuide(page);
    await pull(page, liveMove, i === 0 && name ? () => shot(page, phone, `${name}-aim`) : null);
    await until(page, () => { const s = window.slingState(); return s.screen === 'done' || !s.state.seed; }, 'launched seed settles', 16000);
    const after = await state(page);
    assert.equal(after.state.seeds, before.state.seeds + 1, 'one real pull spends one seed');
    assert.ok(after.state.flowers.length >= before.state.flowers.length, 'grown flowers persist after every flight');
    i++;
  }
  await until(page, () => window.slingState().screen === 'done', 'solved garden reaches its end card', 3000);
  const st = await state(page);
  assert.ok(await page.isVisible('#done'), 'end card visible');
  assert.ok(st.score > 0, 'a completed garden earns a score');
  const targets = st.state.level.platforms.map((p, index) => p.target ? index : null).filter(index => index !== null);
  assert.ok(targets.every(index => st.state.flowers.some(f => f.platform === index)), 'real pointer throws grew every required flower');
  console.log(`result ${phone} ${name || 'daily-replay'}: ${st.state.seeds} seeds, par ${st.par}, ${Math.floor(st.seconds)} seconds`);
  const layout = await page.evaluate(() => {
    const card = document.querySelector('#done > .card'), rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; };
    return { scrollTop: card.scrollTop, screenScrollTop: document.querySelector('#done').scrollTop, height: innerHeight, date: rect('#doneKicker'), title: rect('#done h2'), stars: rect('#stars'), starsText: document.querySelector('#stars').textContent, again: rect('#again'), menu: rect('#doneMenu') };
  });
  const expectedStars = Math.max(0, 3 - Math.max(0, st.state.seeds - st.par));
  assert.equal(layout.starsText, '★'.repeat(expectedStars) + '☆'.repeat(3 - expectedStars), 'end card displays earned stars');
  for (const id of ['date', 'title', 'stars', 'again', 'menu']) assert.ok(layout[id].top >= 0 && layout[id].bottom <= layout.height, `${id} is visible at the win celebration: ${JSON.stringify(layout)}`);
  if (name) { console.log(`layout ${phone} ${name}: ${JSON.stringify(layout)}`); await shot(page, phone, `${name}-end`); }
  return st;
}
async function menu(page) {
  await page.goto(`${base}/sling/?level=1&date=${DATE}&labRunSource=agent`);
  await until(page, () => window.slingState?.().screen === 'menu', 'menu');
}
async function run(test, phone) {
  const { page, requests, errors, labSent } = test;
  await menu(page);
  assert.match(await page.textContent('#menu'), /The game lab records play/, 'recording notice precedes play');
  assert.equal(requests.length, 0, 'menu sends no board request');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'menu has no horizontal scroll');
  await shot(page, phone, '1-menu');
  await page.click('#play');
  let st = await state(page);
  assert.equal(st.screen, 'play'); assert.equal(st.daily, false); assert.equal(st.levelIndex, 0);
  await shot(page, phone, '2-level-mid');

  // A held pull is cancelled by pausing. Releasing it cannot launch a seed on resume.
  const first = solve(level(0)).shots[0];
  const f = st.state.flowers[first.from], scale = st.map.scale;
  await page.mouse.click(st.map.x + f.x * scale, st.map.y + f.y * scale);
  const start = { x: st.map.x + 180 * scale, y: st.map.y + 300 * scale };
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  await page.mouse.move(start.x + first.dx * scale, start.y + first.dy * scale, { steps: 4 });
  await page.keyboard.press('p'); await page.mouse.up();
  st = await state(page);
  assert.ok(['pause', 'paused'].includes(st.screen), 'P pauses a held pull');
  const frozen = JSON.stringify(st.state), seconds = st.seconds;
  await sleep(250);
  assert.equal(JSON.stringify((await state(page)).state), frozen, 'pause freezes the simulation');
  assert.equal((await state(page)).seconds, seconds, 'pause freezes the score clock');
  await shot(page, phone, '3-paused');
  await page.click('#resume');
  assert.ok(!(await state(page)).state.seed, 'release of a paused pull did not launch');
  await page.click('#pause'); await page.click('#retry');
  assert.equal((await state(page)).screen, 'play', 'Retry restarts the level');
  await pull(page, first, () => page.evaluate(() => document.querySelector('#c').dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, pointerType: 'mouse', bubbles: true, cancelable: true }))));
  assert.equal((await state(page)).state.seeds, 0, 'pointer cancellation never spends a seed');
  assert.ok(!(await state(page)).state.seed, 'pointer cancellation never launches');
  await finish(page, level(0), phone, '4-level');
  assert.equal(requests.length, 0, 'ordinary levels never fetch or post the daily board');
  await page.click('#again');
  assert.equal((await state(page)).levelIndex, 0, 'Replay repeats the same level');
  await page.click('#pause'); await page.click('#quit');
  assert.equal((await state(page)).screen, 'menu', 'Quit returns to the menu');

  await page.click('#daily');
  st = await state(page); assert.equal(st.daily, true); assert.equal(st.date, DATE);
  assert.equal(requests.length, 0, 'starting a daily run sends no board request');
  assert.equal(await page.evaluate(() => localStorage.getItem('sling-board-id')), null, 'no board identity before Share');
  await shot(page, phone, '5-daily-mid');
  st = await finish(page, daily(DATE), phone, '6-daily');
  await until(page, () => document.querySelector('#rows').textContent.includes('Moss'), 'daily board rows');
  assert.equal(requests.filter(r => r.method === 'GET').length, 1, 'one board read after daily completion');
  assert.equal(requests.filter(r => r.method === 'POST').length, 0, 'completion never automatically shares');
  assert.equal(await page.evaluate(() => localStorage.getItem('sling-board-id')), null, 'daily win creates no board identity');
  assert.equal(await page.getAttribute('#name', 'maxlength'), '16', 'board names have a sixteen-character limit');
  assert.ok(st.save.days[DATE]?.score > 0, 'daily result stored locally');
  await page.fill('#name', '🌱🌱'); await page.click('#share');
  await until(page, () => /name|letter|number/i.test(document.querySelector('#boardStatus').textContent), 'emoji-only name gets a validation message');
  assert.equal(requests.filter(r => r.method === 'POST').length, 0, 'an empty normalized name sends no POST');
  assert.equal(await page.evaluate(() => localStorage.getItem('sling-board-id')), null, 'an invalid name creates no board identity');
  await page.fill('#name', '  Ｆｅｒｎ 🌱  '); await page.click('#share');
  await until(page, () => document.querySelector('#rows').textContent.includes('Fern'), 'explicitly shared row');
  const posts = requests.filter(r => r.method === 'POST');
  assert.equal(posts.length, 1, 'one explicit Share makes one POST');
  assert.deepEqual(Object.keys(posts[0].body).sort(), ['id', 'n', 's'], 'the board sends only identity, chosen name and score');
  assert.equal(await page.inputValue('#name'), 'Fern', 'the input shows the canonical shared name');
  assert.equal(posts[0].body.n, 'Fern'); assert.equal(posts[0].body.s, st.score);
  assert.match(posts[0].body.id, /^[0-9a-f-]{36}$/i, 'board identity is a UUID');
  assert.equal(await page.evaluate(() => localStorage.getItem('sling-board-id')), posts[0].body.id);
  assert.equal(await page.evaluate(() => localStorage.getItem('sling-name')), 'Fern');
  await shot(page, phone, '7-daily-shared');
  await page.click('#doneMenu'); await page.reload();
  await until(page, () => window.slingState?.().screen === 'menu', 'menu after reload');
  assert.ok((await state(page)).save.days[DATE]?.score > 0, 'daily history survives reload');
  assert.deepEqual(errors, [], 'normal endpoint produces no page, console or network errors');

  // Both failure modes remain usable. These requests intentionally fail, so their browser network
  // diagnostics are expected; page exceptions and unrelated failures remain errors.
  for (const fault of ['404', 'offline']) {
    test.setFault(fault);
    await page.click('#daily'); await finish(page, daily(DATE), phone, null);
    await until(page, () => /offline|unavailable|couldn.t|could not|cannot|not available|try again/i.test(document.querySelector('#boardStatus').textContent), `${fault} board has a readable unavailable state`);
    const count = requests.filter(r => r.method === 'POST').length;
    await page.click('#share');
    await until(page, () => /offline|unavailable|couldn.t|could not|cannot|not available|try again/i.test(document.querySelector('#boardStatus').textContent), `${fault} share failure is readable`);
    assert.equal(requests.filter(r => r.method === 'POST').length, count + 1, 'one failed share is not retried automatically');
    await sleep(250);
    assert.equal(requests.filter(r => r.method === 'POST').length, count + 1, 'failed share stays without automatic retry');
    await shot(page, phone, `8-board-${fault}`); await page.click('#doneMenu');
  }
  await sleep(300);
  assert.ok(labSent.some(r => r.game === 'sling' && r.kind === 'run'), 'recording endpoint received a run');
  assert.deepEqual(errors, [], 'no page exception or unrelated failure during board outages');
}
async function extraSmoke(browser) {
  for (const [name, device] of [
    ['small', { viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
    ['desktop', { viewport: { width: 1280, height: 800 } }],
  ]) {
    const test = await open(browser, device), { page } = test;
    try {
      await menu(page);
      const play = await page.locator('#play').boundingBox();
      assert.ok(play.y >= 0 && play.y + play.height <= device.viewport.height, `${name}: Play is visible`);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: no horizontal scroll`);
      await shot(page, name, '1-menu'); await page.click('#play');
      const st = await state(page);
      assert.ok(st.map.x >= 0 && st.map.x + 360 * st.map.scale <= device.viewport.width, `${name}: garden fits across`);
      await shot(page, name, '2-mid');
      if (name === 'desktop') {
        // Start with the documented keyboard aim, change it by the documented 3-unit keys,
        // and verify a seed actually completes the first garden through the real rules.
        const move = solve(level(0)).shots[0];
        const adjust = async (delta, positive, negative) => { for (let n = 0; n < Math.abs(Math.round(delta / 3)); n++) await page.keyboard.press(delta > 0 ? positive : negative); };
        await adjust(move.dx + 44, 'ArrowLeft', 'ArrowRight');
        await adjust(move.dy - 80, 'ArrowUp', 'ArrowDown');
        await page.keyboard.press('Space');
        await until(page, () => window.slingState().screen === 'done', 'desktop keyboard completes garden', 16000);
        await shot(page, name, '3-end');
        await page.click('#next');
        assert.equal((await state(page)).levelIndex, 1, 'Next opens garden two');
        await pull(page, guide((await state(page)).state));
        await until(page, () => !window.slingState().state.seed, 'garden two first flower', 16000);
        const grown = await state(page);
        assert.ok(grown.state.flowers.length > 1, 'a second flower grew');
        await page.keyboard.press('Tab');
        assert.equal((await state(page)).state.selected, (grown.state.selected + 1) % grown.state.flowers.length, 'Tab cycles grown flowers');
        await page.keyboard.press('Escape');
      } else await page.click('#pause');
      await shot(page, name, '4-paused');
      const card = await page.locator('#paused > div').boundingBox();
      assert.ok(card.y >= 0 && card.y + card.height <= device.viewport.height + 1, `${name}: pause card fits`);
      await page.click('#quit'); await sleep(300);
      assert.deepEqual(test.errors, [], `${name}: no page, console or network errors`);
      console.log(`ok   sling on ${name} ${device.viewport.width}x${device.viewport.height}`);
    } finally { await test.context.close(); }
  }
}
async function lilySmoke(test, phone) {
  const { page } = test;
  await page.goto(`${base}/sling/?level=7&date=${DATE}&labRunSource=agent`);
  await until(page, () => window.slingState?.().screen === 'menu', 'lily lesson menu');
  await page.click('#play');
  const st = await state(page), platforms = st.state.level.platforms;
  const lily = platforms.find(p => p.type === 'lily');
  assert.ok(lily && platforms.some(p => p.type === 'water' && p.x <= lily.x && p.x + p.w >= lily.x + lily.w && Math.abs(p.y - lily.y) <= 12), 'lesson seven shows the lily above water');
  await shot(page, phone, '9-lily-on-water');
  await page.click('#pause'); await page.click('#quit'); await sleep(300);
  assert.deepEqual(test.errors, [], 'lily lesson has no page, console or network errors');
  console.log(`ok   sling lily lesson on ${phone}`);
}
// Review regressions: a pause during the win delay must not drop the win, and replaying an early
// garden must not move the Play button back.
async function reviewSmoke(test, phone) {
  const { page } = test;
  await page.goto(`${base}/sling/?hint=0&labRunSource=agent`);
  await page.evaluate(() => localStorage.setItem('sling-save', JSON.stringify({ stars: [3, 3, 3, 3, 3, 3, 3, 3, 0, 0, 0, 0, 0, 0, 0], level: 8, runs: 9 })));
  await page.reload();
  await until(page, () => window.slingState?.().screen === 'menu', 'review menu');
  await page.click('#gardens'); await page.click('#levelPicker button:nth-child(1)');
  const shotOne = solve(level(0)).shots[0], st = await state(page);
  await page.evaluate(([dx, dy]) => { const c = document.getElementById('c'), fire = (type, x, y) => c.dispatchEvent(new PointerEvent(type, { pointerId: 7, clientX: x, clientY: y, bubbles: true, cancelable: true, pointerType: 'touch' })); fire('pointerdown', 200, 300); fire('pointermove', 200 + dx, 300 + dy); fire('pointerup', 200 + dx, 300 + dy); }, [shotOne.dx * st.map.scale, shotOne.dy * st.map.scale]);
  await until(page, () => window.slingState().state.status === 'won', 'review garden one won');
  await page.evaluate(() => document.getElementById('pause').click());
  assert.notEqual((await state(page)).screen, 'paused', 'pause during the win delay does not open the pause card');
  await until(page, () => window.slingState().screen === 'done', 'review done card');
  assert.equal((await state(page)).save.level, 8, 'replaying garden 1 keeps the saved next garden');
  const sizes = await page.evaluate(() => { document.getElementById('doneMenu').click(); return ['daily', 'gardens'].map(id => document.getElementById(id).getBoundingClientRect().height); });
  assert.equal(sizes[0], sizes[1], 'menu row buttons have one height');
  console.log(`ok   sling review regressions on ${phone}`);
}
let failed = 0;
try {
  for (const [phone, [engine, device]] of Object.entries(PHONES)) {
    const only = process.argv.slice(2).find(arg => !arg.startsWith('--'));
    if (only && only !== phone) continue;
    const browser = await engine.launch();
    const test = await open(browser, device);
    try {
      if (!process.argv.includes('--lily')) { await run(test, phone); console.log(`ok   sling on ${phone}`); if (phone === 'chromium') await extraSmoke(browser); }
      await lilySmoke(test, phone);
      await reviewSmoke(test, phone);
    }
    catch (e) { failed++; console.error(`FAIL sling on ${phone}: ${e.stack}`); if (test.errors.length) console.error(test.errors.join('\n')); await shot(test.page, phone, 'failure').catch(() => {}); }
    finally { await test.context.close(); await browser.close(); }
  }
} finally { await new Promise(done => server.close(done)); }
console.log(`screenshots in ${SHOTS}`);
process.exitCode = failed ? 1 : 0;
