// Real phone taps against the page, never writes to the exposed Lantern simulation.
// Serves experiments/ so /kit/ and /lantern/sim.js have their production paths.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { TAP_STEP } from './sim.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SHOTS = process.env.SHOTS || '/private/tmp/night-lantern-fp';
await mkdir(SHOTS, { recursive: true });
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://local');
  if (url.pathname === '/notes/button.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); return res.end(''); }
  if (url.pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
  try {
    let file = resolve(ROOT, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(ROOT + sep)) throw new Error('outside root');
    if (url.pathname.endsWith('/')) file = join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const BASE = `http://127.0.0.1:${server.address().port}`;
const require = createRequire(join(resolve(process.env.PLAYWRIGHT || '/Users/abdul/code/human-framework/node_modules'), 'x.js'));
const { chromium, webkit, devices } = require('playwright');
const phones = { webkit: [webkit, devices['iPhone 13']], chromium: [chromium, devices['Pixel 7']] };
const sleep = ms => new Promise(done => setTimeout(done, ms));
const state = page => page.evaluate(() => window.lanternFPState());
async function shot(page, label) {
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await page.screenshot({ path: join(SHOTS, `${label}.png`), timeout: 15000 }); }
    catch (error) { if (attempt === 2 || !String(error).includes('Unable to capture screenshot')) throw error; await sleep(200); }
  }
}
async function tapElement(page, selector) {
  const p = await page.evaluate(sel => { const el = document.querySelector(sel), r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, width: r.width, height: r.height }; }, selector);
  assert.ok(p.width > 0 && p.height > 0, `${selector} is visible`);
  await page.touchscreen.tap(p.x, p.y);
}
const waitState = (page, fn, arg, timeout = 30000) => page.waitForFunction(fn, arg, { timeout });

async function open(browser, options, boardMode = 'ok', noGL = false) {
  const context = await browser.newContext(options), page = await context.newPage();
  const errors = [], expectedNetwork = [], posts = [], requests = [];
  if (noGL) await context.addInitScript(mode => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(kind, ...args) { if (kind === 'webgl2') { if (mode === 'throw') throw new Error('Injected WebGL initialization failure'); return null; } return original.call(this, kind, ...args); };
  }, noGL);
  let boardId = '';
  await context.route('**/lab-api/board/lantern-fp', async route => {
    const req = route.request(); requests.push(req.method());
    if (boardMode === 'offline') return route.abort('internetdisconnected');
    if (boardMode === '404') return route.fulfill({ status: 404, body: 'not found' });
    let rows = [{ n: 'Riverboat', s: 7800, d: '2026-11-23' }];
    if (req.method() === 'POST') {
      const body = req.postDataJSON(); posts.push(body);
      if (!body.remove) { boardId = body.id; rows = [{ n: body.n, s: body.s, d: '2026-11-23' }, ...rows]; }
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, rows, place: boardId ? 1 : 0 }) });
  });
  await context.route('https://human.adamwhite.work/**', route => { errors.push('LAB page attempted recording'); return route.abort(); });
  page.on('pageerror', error => errors.push(`page: ${error.message}`));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (boardMode !== 'ok' && /Failed to load resource|net::ERR_|Load failed|404|Internet connection/i.test(text)) expectedNetwork.push(text);
    else errors.push(`console: ${text}`);
  });
  page.on('requestfailed', req => { if (!req.url().includes('/lab-api/board/lantern-fp') || boardMode === 'ok') errors.push(`request: ${req.url()}`); });
  return { context, page, errors, expectedNetwork, posts, requests };
}
async function menu(page, query = '') {
  await page.goto(`${BASE}/lab/lantern-fp/${query}`);
  await waitState(page, () => window.lanternFPState?.().screen === 'menu');
}
async function noOverflow(page) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 1), 'page fits viewport');
  const small = await page.evaluate(() => [...document.querySelectorAll('button,input,nav a')].filter(e => e.getClientRects().length).map(e => ({ id: e.id || e.textContent, h: e.getBoundingClientRect().height, w: e.getBoundingClientRect().width })).filter(r => r.h < 47.5 || r.w < 47.5));
  assert.deepEqual(small, [], 'visible controls have 48 px touch targets');
}
async function testControls(page, label) {
  await menu(page, '?seed=7');
  await noOverflow(page);
  for (const href of ['/lantern/', '/lab/lantern-3d/', '/lab/lantern-fp/']) assert.ok(await page.locator(`#menu a[href="${href}"]`).count(), `menu variant ${href}`);
  await shot(page, `${label}-1-menu`);
  await tapElement(page, '#play');
  await waitState(page, () => window.lanternFPState().playing);
  await page.waitForFunction(() => !!document.querySelector('.kit-hint.on'), null, { timeout: 3500 });
  assert.equal(await page.locator('.kit-hint').getAttribute('data-kind'), 'tap', 'beginner hint demonstrates the real tap control');
  const v = page.viewportSize(), y = v.height * 0.72;
  let before = await state(page);
  await page.touchscreen.tap(v.width * 0.24, y);
  let after = await state(page);
  assert.ok(after.target < before.target, 'left-half tap moves target left');
  assert.ok(after.taps > before.taps, 'left tap counted');
  before = after;
  await page.touchscreen.tap(v.width * 0.76, y);
  after = await state(page); assert.ok(after.target > before.target, 'right-half tap moves target right');
  // A press has one side; moving the pointer across the river must not change it into drag steering.
  await page.mouse.move(v.width * 0.24, y); before = await state(page);
  await page.mouse.down(); await page.mouse.move(v.width * 0.76, y); await page.mouse.up();
  after = await state(page); assert.ok(after.target < before.target, 'moving a press across halves keeps its original left direction');
  before = after;
  await page.mouse.move(v.width * 0.76, y); await page.mouse.down(); await waitState(page, taps => window.lanternFPState().taps >= taps + 2, before.taps, 10000); await page.mouse.up();
  after = await state(page); assert.ok(after.target >= before.target + TAP_STEP * 2 - 1e-10, 'holding right repeats tap steps');
  await tapElement(page, '#pause'); before = await state(page); assert.ok(before.paused, 'pause button');
  await sleep(250); assert.equal((await state(page)).t, before.t, 'pause freezes rules');
  await noOverflow(page); await tapElement(page, '#resume');
  await waitState(page, t => window.lanternFPState().t > t, before.t);
  await page.evaluate(() => dispatchEvent(new Event('blur'))); assert.ok((await state(page)).paused, 'blur pauses');
  await page.keyboard.press('p'); assert.equal((await state(page)).paused, false, 'P resumes');
  before = await state(page); await page.keyboard.press('ArrowLeft'); after = await state(page);
  assert.ok(after.target < before.target, 'desktop arrow steers');
  await tapElement(page, '#pause'); await tapElement(page, '#quit');
  assert.equal((await state(page)).screen, 'menu', 'quit returns to menu');
}
// Regression: seed36 with cap3/every10ticks hits rock at y47.9458815.
// Cap16 was checked independently at every fixed cadence1..15ticks: all dawn.
// This policy checks rendered end-to-end play; bots.mjs measures achievable control difficulty.
async function playDawn(page, label) {
  // Like Fix-It's phone check, send touch PointerEvents through the actual input handlers
  // in bursts of at most sixteen per animation frame (target convergence; the sim retains its speed cap). Browser transport latency must not become bot reaction time.
  // The first controls test uses native touchscreen.tap; this complete night never writes sim state.
  await menu(page, '?seed=36&speed=2&hint=0');
  await tapElement(page, '#play');
  await page.evaluate(async () => {
    const { centre, half, sight } = await import('/lantern/sim.js');
    const { TAP_STEP } = await import('/lab/lantern-fp/sim.js');
    const canvas = document.querySelector('#c');
    window.__phonePolicy = { taps: 0, maxBurst: 0, done: false };
    function move() {
      const s = window.lanternFPSim(), ui = window.lanternFPState();
      if (s.over) { window.__phonePolicy.done = true; return; }
      if (!ui.paused) {
        const see = sight(s), c = centre(s, s.y + 0.2), h = half(s, s.y + 0.2);
        let best = s.x, bestScore = -Infinity;
        for (let i = 0; i <= 24; i++) {
          const x = c - h + 0.04 + (2 * h - 0.08) * i / 24;
          let q = -Math.abs(x - s.x) * 0.6 - Math.abs(x - c) * 0.3;
          for (const k of s.rocks) {
            const dy = k.y - s.y;
            if (dy > -0.03 && dy < see) {
              const gap = Math.max(0, Math.abs(k.x - x) - k.len) - k.rad - 0.03;
              if (gap < 0.03) q -= (0.03 - gap) * 60 / (0.15 + dy);
            }
          }
          if (q > bestScore) { bestScore = q; best = x; }
        }
        const dx = best - ui.target;
        const burst = Math.min(16, Math.round(Math.abs(dx) / TAP_STEP));
        window.__phonePolicy.maxBurst = Math.max(window.__phonePolicy.maxBurst, burst);
        for (let n = 0; n < burst; n++) {
          const x = innerWidth * (dx < 0 ? 0.24 : 0.76), y = innerHeight * 0.72;
          for (const type of ['pointerdown', 'pointerup']) canvas.dispatchEvent(new PointerEvent(type, { pointerId: 71, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, pressure: type === 'pointerup' ? 0 : 0.5, bubbles: true, cancelable: true }));
          window.__phonePolicy.taps++;
        }
      }
      requestAnimationFrame(move);
    }
    requestAnimationFrame(move);
  });
  let middle = false;
  const deadline = Date.now() + 600000;
  while (Date.now() < deadline) {
    const st = await state(page);
    if (st.over) break;
    if (!middle && st.y > 20) { await shot(page, `${label}-2-mid-play`); middle = true; }
    await sleep(100);
  }
  const ended = await state(page);
  assert.equal(ended.over, 'dawn', `careful bounded-burst touch-event policy reaches dawn, got ${ended.over}`);
  await waitState(page, () => window.lanternFPState().screen === 'end', null, 10000);
  await sleep(1100); // measure settled touch targets after the celebration squash
  await noOverflow(page); await shot(page, `${label}-3-end`);
  const { taps, maxBurst } = await page.evaluate(() => window.__phonePolicy);
  assert.ok(maxBurst <= 16, 'touch burst cap');
  console.log(`     ${label} largest touch burst: ${maxBurst}`);
  assert.ok(taps > 20, `${taps} touch steering taps`);
  const saved = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([k]) => k.startsWith('lantern-fp'))));
  assert.ok(Object.keys(saved).length, 'game writes a device save');
  await page.reload(); await waitState(page, () => window.lanternFPState?.().screen === 'menu');
  const reloaded = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([k]) => k.startsWith('lantern-fp'))));
  assert.deepEqual(reloaded, saved, 'save survives reload');
  return taps;
}
async function board(test, mode = 'ok') {
  const { page, requests, posts } = test;
  assert.equal(posts.length, 0, 'no board POST before consent');
  await tapElement(page, '#toBoard');
  await waitState(page, () => window.lanternFPState().screen === 'board');
  await sleep(200); assert.ok(requests.includes('GET'), 'opening board fetches shared rows');
  assert.equal(posts.length, 0, 'opening board does not share');
  if (mode !== 'ok') { assert.ok(await page.locator('#boardBack').isVisible(), 'unavailable board still has a way back'); await tapElement(page, '#boardBack'); return; }
  await page.locator('#shareName').fill('Nightboat');
  assert.equal(posts.length, 0, 'typing name stays local');
  await tapElement(page, '#share');
  await waitState(page, () => /Stop sharing/i.test(document.querySelector('#share').textContent));
  for (let n = 0; n < 30 && posts.length === 0; n++) await sleep(50);
  assert.equal(posts.length, 1, 'one explicit Share sends one row');
  assert.ok(typeof posts[0].id === 'string' && posts[0].id.length > 10, 'random board id');
  assert.equal(posts[0].n, 'Nightboat'); assert.ok(Number.isFinite(posts[0].s) && posts[0].s > 0, 'positive score');
  assert.deepEqual(Object.keys(posts[0]).sort(), ['id', 'n', 's'], 'least-data board payload');
  await tapElement(page, '#share');
  for (let n = 0; n < 30 && posts.length < 2; n++) await sleep(50);
  assert.deepEqual(posts[1], { id: posts[0].id, remove: true }, 'Stop sharing removes the same row');
  await tapElement(page, '#boardBack');
}
const priorConsent = { best: 100, opened: 1, runs: 1, sound: false, name: 'Nightboat', sharing: true, boardId: '7e7ed383-3426-4c62-961d-a558de18798f', pendingRemove: '' };
async function consentFixture(page) {
  await menu(page, '?seed=0&speed=4');
  await page.evaluate(save => localStorage.setItem('lantern-fp-save', JSON.stringify(save)), priorConsent);
  await page.reload(); await waitState(page, () => window.lanternFPState?.().screen === 'menu');
}
async function boardRace(browser, device, label) {
  const t = await open(browser, device), processed = [], arrived = [];
  let releaseScore; const gate = new Promise(done => { releaseScore = done; });
  await t.page.route('**/lab-api/board/lantern-fp', async route => {
    const req = route.request();
    if (req.method() === 'POST') {
      const body = req.postDataJSON(); arrived.push(body);
      if (!body.remove) await gate;
      processed.push(body.remove ? 'remove' : 'score');
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rows: [], place: 0 }) });
  });
  try {
    await consentFixture(t.page); await tapElement(t.page, '#play');
    const v = t.page.viewportSize(); await t.page.mouse.move(v.width * 0.8, v.height * 0.72); await t.page.mouse.down();
    await waitState(t.page, () => !!window.lanternFPState().over, null, 15000); await t.page.mouse.up();
    for (let i = 0; i < 30 && !arrived.length; i++) await sleep(20);
    assert.equal(arrived.length, 1, 'prior consent permits one automatic end-of-run score write');
    await tapElement(t.page, '#endBoard'); await waitState(t.page, () => window.lanternFPState().screen === 'board');
    await tapElement(t.page, '#share'); await sleep(100);
    assert.deepEqual(processed, [], 'Stop removal waits while the older score write is held');
    assert.equal(arrived.length, 1, 'removal has not overtaken the held score write');
    releaseScore();
    for (let i = 0; i < 80 && processed.length < 2; i++) await sleep(25);
    assert.deepEqual(processed, ['score', 'remove'], 'server processes score then removal');
    assert.deepEqual(arrived[1], { id: priorConsent.boardId, remove: true }, 'removal uses the original shared id');
    assert.equal((await state(t.page)).sharing, false);
    assert.deepEqual(t.errors, [], 'zero errors in delayed-score removal race');
    console.log(`ok   ${label} board race: held score resolves before removal`);
  } finally { releaseScore(); await t.context.close(); }
}
async function removalRetry(browser, device, label) {
  const t = await open(browser, device, '404'), removals = [];
  await t.page.route('**/lab-api/board/lantern-fp', async route => {
    const req = route.request();
    if (req.method() === 'POST') {
      const body = req.postDataJSON(); removals.push(body);
      if (removals.length === 1) return route.fulfill({ status: 404, body: 'not found' });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rows: [], place: 0 }) });
  });
  try {
    await consentFixture(t.page); await tapElement(t.page, '#toBoard');
    await tapElement(t.page, '#share');
    await t.page.waitForFunction(() => !document.querySelector('#share').disabled && document.querySelector('#share').textContent === 'Retry removal');
    assert.match(await t.page.locator('#boardStatus').innerText(), /removal unconfirmed/i);
    let save = await t.page.evaluate(() => JSON.parse(localStorage.getItem('lantern-fp-save')));
    assert.equal(save.sharing, false); assert.equal(save.boardId, ''); assert.equal(save.pendingRemove, priorConsent.boardId, 'failed deletion keeps only its opaque id for explicit retry');
    await t.page.reload(); await waitState(t.page, () => window.lanternFPState?.().screen === 'menu');
    await tapElement(t.page, '#toBoard'); await sleep(100);
    assert.equal(removals.length, 1, 'reload does not retry removal without a choice');
    await tapElement(t.page, '#share');
    await t.page.waitForFunction(() => !document.querySelector('#share').disabled && document.querySelector('#share').textContent === 'Share');
    assert.deepEqual(removals, [{ id: priorConsent.boardId, remove: true }, { id: priorConsent.boardId, remove: true }], 'explicit retry removes the same row');
    save = await t.page.evaluate(() => JSON.parse(localStorage.getItem('lantern-fp-save')));
    assert.equal(save.pendingRemove, ''); assert.equal(save.sharing, false);
    assert.deepEqual(t.errors, [], 'no application errors after failed removal and retry');
    console.log(`ok   ${label} board removal retry: failed id persisted, explicit retry cleared it; ${t.expectedNetwork.length} expected browser network diagnostics`);
  } finally { await t.context.close(); }
}
async function noGL(browser, device, label, throwing = false) {
  const t = await open(browser, device, 'ok', throwing ? 'throw' : true);
  await t.page.goto(`${BASE}/lab/lantern-fp/`);
  await t.page.locator('#nogl').waitFor({ state: 'visible' });
  assert.match(await t.page.locator('#nogl').innerText(), /WebGL2/i);
  assert.equal(await t.page.locator('#nogl a').getAttribute('href'), '/lantern/');
  const link = await t.page.locator('#nogl a').boundingBox(); assert.ok(link.height >= 48 && link.width >= 48, '2D fallback has a 48 px target');
  await shot(t.page, `${label}-${throwing ? '5-webgl-init-throw' : '4-no-webgl2'}`); assert.deepEqual(t.errors, []); await t.context.close();
}
let failed = 0;
try {
  for (const [label, [engine, device]] of Object.entries(phones)) {
    const chosen = process.argv.find(arg => ['webkit', 'chromium'].includes(arg));
    if (chosen && chosen !== label) continue;
    const browser = await engine.launch(); let active;
    try {
      if (process.argv.includes('--controls-only')) { active = await open(browser, device); await testControls(active.page, label); assert.deepEqual(active.errors, []); await active.context.close(); console.log(`ok   ${label} native controls: tap, hold, ignored drag, keyboard, pause, hint; zero errors`); continue; }
      if (process.argv.includes('--gl-only')) { await noGL(browser, device, label); await noGL(browser, device, label, true); console.log(`ok   ${label} no-WebGL2 and thrown initialization: zero page/console errors`); continue; }
      if (process.argv.includes('--board-only')) { await boardRace(browser, device, label); await removalRetry(browser, device, label); continue; }
      active = await open(browser, device);
      await testControls(active.page, label);
      const taps = await playDawn(active.page, label);
      console.log(`ok   ${label} natural dawn: ${taps} touch-event taps`);
      await board(active);
      assert.deepEqual(active.errors, [], `${label}: zero page and console errors`);
      await active.context.close();
      await boardRace(browser, device, label);
      await removalRetry(browser, device, label);
      for (const mode of ['404', 'offline']) {
        active = await open(browser, device, mode); await menu(active.page); await board(active, mode);
        assert.deepEqual(active.errors, [], `${label} ${mode}: no application errors`);
        console.log(`ok   ${label} board ${mode}: ${active.expectedNetwork.length} expected browser network diagnostics`);
        await active.context.close();
      }
      await noGL(browser, device, label);
      await noGL(browser, device, label, true);
      if (label === 'chromium') {
        for (const [suffix, options] of [['360', { viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true }], ['desktop', { viewport: { width: 1280, height: 800 }, hasTouch: true }]]) {
          active = await open(browser, options); await menu(active.page); await noOverflow(active.page); await tapElement(active.page, '#play'); await sleep(100); await shot(active.page, `${label}-${suffix}`);
          await tapElement(active.page, '#pause'); await noOverflow(active.page); assert.deepEqual(active.errors, []); await active.context.close();
        }
      }
      console.log(`ok   Lantern: First Person ${label}: dawn, ${taps} touch-event taps; zero page/console errors; controls, pause, save, opt-in board, no-WebGL2`);
    } catch (error) {
      failed++; console.error(`FAIL ${label}: ${error.stack}`);
      if (active) { console.error(active.errors); try { console.error(await state(active.page)); await shot(active.page, `${label}-FAIL`); } catch {} }
    } finally { await browser.close(); }
  }
} finally { await new Promise(done => server.close(done)); }
console.log(`Screenshots: ${SHOTS}`);
process.exitCode = failed ? 1 : 0;
