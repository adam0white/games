// Real-input phone check. Serves experiments/, never edits the simulation or its clock.
// PLAYWRIGHT=/Users/abdul/code/human-framework/node_modules node experiments/lab/ant-swarm/check.mjs [webkit|chromium]
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import assert from 'node:assert/strict';
import { LEVELS } from './sim.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SHOTS = process.env.SHOTS || '/private/tmp/night-ant-swarm';
await mkdir(SHOTS, { recursive: true });
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/notes/button.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(''); }
  if (url.pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
  let file = normalize(join(root, decodeURIComponent(url.pathname)));
  if (url.pathname.endsWith('/')) file = join(file, 'index.html');
  try {
    if (!file.startsWith(root + sep)) throw Error('outside experiments');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
const require = createRequire(join(resolve(process.env.PLAYWRIGHT || '/Users/abdul/code/human-framework/node_modules'), 'x.js'));
const { webkit, chromium, devices } = require('playwright');
const PHONES = { webkit: [webkit, devices['iPhone 13']], chromium: [chromium, devices['Pixel 7']] };
const sleep = ms => new Promise(done => setTimeout(done, ms));
const state = page => page.evaluate(() => window.swarmState());
async function until(page, predicate, label, ms = 10000, arg) {
  try { await page.waitForFunction(predicate, arg, { timeout: ms }); }
  catch { throw Error(`timed out waiting for ${label}`); }
}
async function targets(page) {
  const bad = await page.evaluate(() => [...document.querySelectorAll('button,input')].filter(el => {
    const r = el.getBoundingClientRect(); return r.width && r.height && getComputedStyle(el).visibility !== 'hidden' && (r.width < 48 || r.height < 48);
  }).map(el => ({ id: el.id, w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height })));
  assert.deepEqual(bad, [], 'all visible buttons and inputs are at least 48 px');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal overflow');
}
async function open(browser, device) {
  const context = await browser.newContext(device), page = await context.newPage();
  const errors = [], pageErrors = [], requests = [], board = { mode: 'ok', calls: [] };
  await context.route('**/lab-api/board/ant-swarm', async route => {
    const req = route.request();
    board.calls.push({ method: req.method(), body: req.postData() ? JSON.parse(req.postData()) : null });
    if (board.mode === 'postfail' && req.method() === 'POST') return route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
    if (board.mode === '404') return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    if (board.mode === 'offline') return route.abort('internetdisconnected');
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rows: [{ n: 'Moss', s: 12 }], place: 1 }) });
  });
  page.on('pageerror', e => { errors.push(String(e)); pageErrors.push(String(e)); });
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', req => requests.push(req.url()));
  return { context, page, errors, pageErrors, requests, board };
}
// Playwright's mouse emits real browser pointer events even in a phone context. Every move waits a frame-sized interval.
// This is a painted path, not a simulation shortcut. No inputs are made through the state inspection function.
async function paint(page) {
  const s = await state(page);
  const path = s.path?.length ? s.path : [s.home, s.food];
  assert.ok(path.length >= 2 && path.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)), 'inspectable route points');
  const pts = path.map(p => ({ x: s.view.x + p.x * s.view.scale, y: s.view.y + p.y * s.view.scale }));
  await page.mouse.move(pts[0].x, pts[0].y); await page.mouse.down();
  try {
    for (let k = 1; k < pts.length; k++) {
      const a = pts[k - 1], b = pts[k], steps = Math.max(4, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 10));
      for (let i = 1; i <= steps; i++) {
        await page.mouse.move(a.x + (b.x - a.x) * i / steps, a.y + (b.y - a.y) * i / steps);
        await sleep(16);
        if ((await state(page)).screen !== 'play') return;
      }
    }
  } finally { await page.mouse.up(); }
}
async function performanceSample(page, duration = 1500) {
  return page.evaluate(ms => new Promise(done => {
    const intervals = []; let start, last;
    function tick(t) {
      if (start === undefined) start = last = t;
      else { intervals.push(t - last); last = t; }
      if (t - start < ms) requestAnimationFrame(tick);
      else { intervals.sort((a, b) => a - b); done({ frames: intervals.length, mean: intervals.reduce((a, b) => a + b, 0) / intervals.length, p95: intervals[Math.floor(intervals.length * .95)] }); }
    }
    requestAnimationFrame(tick);
  }), duration);
}
async function run(browser, device, phone) {
  const { context, page, errors, pageErrors, requests, board } = await open(browser, device);
  try {
    await page.goto(`${base}/lab/ant-swarm/?seed=7`);
    await until(page, () => typeof window.swarmState === 'function' && window.swarmState().screen === 'menu', 'menu');
    await targets(page);
    assert.equal(board.calls.length, 0, 'board does not send on page load');
    await page.screenshot({ path: join(SHOTS, `${phone}-1-menu.png`) });
    await page.click('#play');
    await until(page, () => window.swarmState().screen === 'play', 'play');
    let s = await state(page);
    assert.equal(s.level, 0, 'first level starts');
    assert.ok(s.count >= 300 && s.count <= 1500, `population bounded: ${s.count}`);
    await targets(page);
    // A new player sees the kit's path hint before touching the meadow.
    await until(page, () => !!document.querySelector('.kit-hint.on'), 'beginner path hint', 5000);
    assert.equal(await page.evaluate(() => localStorage.getItem('ant-swarm:hint')), null, 'Play tap does not consume the hint');
    await page.click('#pause');
    s = await state(page); assert.equal(s.screen, 'paused', 'pause button');
    await targets(page); const frozen = s.time;
    await sleep(300); assert.equal((await state(page)).time, frozen, 'pause freezes simulation time');
    for (const look of ['moss', 'dusk', 'clay']) {
      await page.click(`[data-look="${look}"]`);
      assert.equal((await state(page)).save.look, look, `${look} palette selected`);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      // Hide the pause card only for this still capture; the simulation remains paused.
      await page.screenshot({ path: join(SHOTS, `${phone}-look-${look}.png`), style: '#paused { visibility: hidden !important; }' });
      assert.equal((await state(page)).time, frozen, 'palette selection preserves pause');
    }
    await page.click('[data-look="moss"]');
    await page.click('#resume');
    await until(page, t => window.swarmState().time > t, 'resume advances time', 3000, frozen);
    await page.evaluate(() => dispatchEvent(new Event('blur')));
    assert.equal((await state(page)).screen, 'paused', 'blur pauses');
    await page.click('#resume');
    const perf = await performanceSample(page);
    const before = (await state(page)).paintCount;
    await paint(page);
    assert.ok((await state(page)).paintCount > before, 'real pointer drag paints scent');
    assert.equal(await page.evaluate(() => localStorage.getItem('ant-swarm:hint')), '1', 'meadow input saves hint completion');
    await page.screenshot({ path: join(SHOTS, `${phone}-2-mid-play.png`) });
    const start = Date.now();
    while ((await state(page)).screen === 'play' && Date.now() - start < 50000) { await paint(page); await sleep(120); }
    s = await state(page);
    assert.equal(s.screen, 'end', `level completed by real pointer input: ${JSON.stringify(s)}`);
    assert.ok(s.delivered >= s.goal, `goal met: ${s.delivered}/${s.goal}`);
    assert.ok(s.best > 0, 'best score saved');
    await targets(page); await sleep(300);
    await page.screenshot({ path: join(SHOTS, `${phone}-3-end.png`) });
    // Headless scheduling is noisy. These gates catch a stalled renderer; they do not establish physical-phone 60fps.
    assert.ok(s.frames.cpuMean < 20, `simulation and drawing CPU under budget after adaptation: ${s.frames.cpuMean.toFixed(2)} ms`);
    assert.ok(perf.mean <= 35 && perf.p95 <= 60, `responsive animation after renderer adaptation: ${JSON.stringify(perf)}`);
    const best = s.best, endStats = { delivered: s.delivered, goal: s.goal, time: s.time, count: s.count, renderer: s.renderer, gameFrames: s.frames, raf: perf };
    assert.equal(board.calls.length, 0, 'winning never posts a score before opt in');
    const population = s.population;
    await page.click('#next');
    s = await state(page);
    assert.equal(s.screen, 'play', 'Next starts another meadow');
    assert.equal(s.level, 1, 'Next advances one meadow');
    assert.equal(s.initialAnts, population, 'the grown colony carries into the next meadow');
    assert.equal(s.count, Math.min(population, s.antLimit), 'next meadow respects the device ant ceiling');
    assert.ok(s.goal > 0 && s.goal <= Math.round(LEVELS[1].goal * s.initialAnts / 600), 'next goal is positive and bounded by the grown colony capacity');
    if (s.antLimit >= 600) assert.ok(s.goal >= LEVELS[1].goal, `uncapped next colony goal meets its base: ${s.goal}`);
    else assert.ok(s.goal < LEVELS[1].goal, `small device colony has a normalized goal: ${s.goal}`);
    endStats.progression = { carriedPopulation: population, nextInitialAnts: s.initialAnts, nextGoal: s.goal };
    await page.click('#pause'); await page.click('#restart');
    s = await state(page);
    assert.equal(s.screen, 'play', 'one tap restarts the paused meadow');
    assert.equal(s.level, 1, 'restart keeps the meadow');
    assert.equal(s.initialAnts, population, 'restart keeps the meadow starting population');
    await page.click('#pause');
    await page.reload();
    await until(page, () => window.swarmState?.().screen === 'menu', 'reload menu');
    assert.ok((await state(page)).best >= best, 'best survives reload');
    assert.equal(await page.evaluate(() => localStorage.getItem('ant-swarm:hint')), '1', 'hint save survives reload');
    await page.click('#boardOpen');
    await until(page, () => window.swarmState().screen === 'board', 'board');
    await until(page, () => !document.querySelector('#share').hidden && !document.querySelector('#share').disabled, 'shared board loaded');
    assert.equal(board.calls.filter(r => r.method === 'GET').length, 1, 'opening the board fetches it');
    assert.equal(board.calls.filter(r => r.method === 'POST').length, 0, 'opening board never shares');
    await targets(page);
    await page.fill('#name', '  Moss<> & Very Long Name  '); await page.locator('#name').blur();
    await page.click('#share');
    await until(page, () => /shared|sharing|stop/i.test(document.querySelector('#share').textContent), 'sharing state');
    await sleep(150);
    const post = board.calls.find(r => r.method === 'POST' && !r.body.remove)?.body;
    assert.ok(post && post.id && post.s >= best, 'Share posts identity and best score');
    assert.ok(typeof post.n === 'string' && post.n.length <= 16 && !/[<>]/.test(post.n), `shared name is sanitized: ${post.n}`);
    await page.screenshot({ path: join(SHOTS, `${phone}-4-board.png`) });
    await page.click('#share');
    await until(page, () => /share my best/i.test(document.querySelector('#share').textContent), 'sharing removed');
    await sleep(100);
    assert.ok(board.calls.some(r => r.method === 'POST' && r.body.remove === true && r.body.id === post.id), 'Stop sharing removes the same random identity');
    await page.click('#boardBack');
    assert.equal((await state(page)).screen, 'menu', 'board closes');
    assert.ok(!requests.some(url => /human\.adamwhite\.work|lab\/api\/linked/.test(url)), 'lab page never records play');
    assert.deepEqual(errors, [], 'zero page and console errors');
    // Fault injection: a refused POST must never look acknowledged, and removal must keep its retry identity.
    await page.click('#boardOpen');
    await until(page, () => !document.querySelector('#share').hidden && !document.querySelector('#share').disabled, 'board reopened');
    await page.fill('#name', 'Moss'); await page.locator('#name').blur();
    board.mode = 'postfail'; await page.click('#share');
    await until(page, () => /Score not sent/.test(document.querySelector('#boardStatus').textContent), 'failed share message');
    s = await state(page); assert.equal(s.save.sharing, false, 'failed POST never claims sharing');
    const retryId = s.save.id; assert.ok(retryId, 'failed share keeps the retry identity');
    board.mode = 'ok'; await page.click('#share');
    await until(page, () => window.swarmState().save.sharing === true, 'share retry acknowledgement');
    assert.equal((await state(page)).save.id, retryId, 'share retry uses the same identity');
    board.mode = 'postfail'; await page.click('#share');
    await until(page, () => /Removal not sent/.test(document.querySelector('#boardStatus').textContent), 'failed removal message');
    s = await state(page); assert.equal(s.save.sharing, false, 'Stop sharing withdraws consent even when removal fails');
    assert.equal(s.save.removePending, true, 'failed removal stays pending');
    assert.equal(s.save.id, retryId, 'failed removal keeps the retry identity');
    assert.equal(await page.textContent('#share'), 'Retry removal', 'failed removal offers the correct retry');
    board.mode = 'ok'; await page.click('#share');
    await until(page, () => { const save = window.swarmState().save; return save.sharing === false && save.removePending === false && save.id === ''; }, 'removal retry acknowledgement');
    assert.equal((await state(page)).save.id, '', 'acknowledged removal clears the identity');
    assert.equal((await state(page)).save.removePending, false, 'acknowledged removal clears the pending flag');
    assert.deepEqual(pageErrors, [], 'no unhandled errors during board POST failures');
    assert.deepEqual(errors.filter(e => !/Failed to load resource|500/i.test(e)), [], 'only expected POST failure network messages');
    console.log(`ok ant-swarm ${phone}: share/removal 500 failures and retries acknowledged correctly`);
    console.log(`ok ant-swarm ${phone}: ${JSON.stringify(endStats)}`);
  } catch (e) {
    try { await page.screenshot({ path: join(SHOTS, `${phone}-FAIL.png`) }); console.error('state:', JSON.stringify(await state(page))); } catch {}
    if (errors.length) console.error('page errors:', errors);
    throw e;
  } finally { await context.close(); }
}
// Absent/offline board remains optional; verify both failure modes in a fresh context without an opted-in identity.
async function unavailableBoard(browser, device, phone, mode) {
  const { context, page, errors, pageErrors, board } = await open(browser, device);
  try {
    board.mode = mode;
    await page.goto(`${base}/lab/ant-swarm/`);
    await until(page, () => window.swarmState?.().screen === 'menu', 'offline menu');
    await page.click('#boardOpen'); await sleep(500);
    assert.equal((await state(page)).screen, 'board', `${mode} board remains usable`);
    assert.equal(board.calls.filter(c => c.method === 'POST').length, 0, 'absent board never posts');
    await page.click('#boardBack'); await page.click('#play');
    assert.equal((await state(page)).screen, 'play', `game works with board ${mode}`);
    // Browsers log an expected fetch network failure. It must be only the intentionally unavailable board.
    assert.deepEqual(pageErrors, [], `no unhandled page errors with board ${mode}`);
    const unexpected = errors.filter(e => !/Failed to load resource|net::ERR_INTERNET_DISCONNECTED|404|Load failed/i.test(e));
    assert.deepEqual(unexpected, [], `no unhandled errors with board ${mode}`);
    console.log(`ok ant-swarm ${phone}: board ${mode} handled (${errors.length} expected network console messages)`);
  } finally { await context.close(); }
}
async function canvasSmall(browser, phone) {
  const { context, page, errors } = await open(browser, { viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  try {
    await page.goto(`${base}/lab/ant-swarm/?renderer=canvas&level=7&seed=7`);
    await until(page, () => window.swarmState?.().screen === 'menu', 'small fallback menu');
    await targets(page); await page.click('#play'); await sleep(1000);
    const s = await state(page); assert.equal(s.renderer, 'canvas2d', 'Canvas2D fallback selected');
    assert.equal(s.level, 7, 'late meadow can be inspected');
    await targets(page); const perf = await performanceSample(page, 1200);
    await paint(page);
    const beforeKeys = (await state(page)).paintCount;
    await page.keyboard.down('Space'); await page.keyboard.down('ArrowRight'); await sleep(180);
    await page.keyboard.up('ArrowRight'); await page.keyboard.up('Space');
    assert.ok((await state(page)).paintCount > beforeKeys, 'Space and arrow keys paint scent');
    await page.screenshot({ path: join(SHOTS, `${phone}-5-canvas-small.png`) });
    assert.deepEqual(errors, [], 'zero fallback errors');
    console.log(`ok ant-swarm ${phone}: 360x640 Canvas2D level 8 ${JSON.stringify({ count: s.count, gameFrames: (await state(page)).frames, raf: perf })}`);
  } finally { await context.close(); }
}
async function dailyMeadow(browser, device, phone) {
  const { context, page, errors, board } = await open(browser, device);
  try {
    await page.goto(`${base}/lab/ant-swarm/?seed=123`);
    await until(page, () => window.swarmState?.().screen === 'menu', 'daily fixture menu');
    // A persisted completed campaign, through the actual kit storage functions. No live simulation state changes.
    await page.evaluate(async () => {
      const { readJson, writeJson } = await import('/kit/save.js');
      writeJson('ant-swarm:save', { ...readJson('ant-swarm:save', {}), level: 8, runs: 1 });
    });
    await page.reload(); await page.click('#daily');
    const expectedSeed = await page.evaluate(() => Number(new Date().toISOString().slice(0, 10).replaceAll('-', '')));
    let s = await state(page);
    assert.equal(s.screen, 'play', 'Daily starts a meadow');
    assert.equal(s.endless, true, 'Daily enters endless mode');
    assert.equal(s.seed, expectedSeed, 'Daily uses the UTC date rather than the query seed');
    assert.equal(s.dailySeed, expectedSeed, 'daily seed is shared for the UTC date');
    assert.equal(s.initialAnts, 600, 'Daily resets the colony to 600 for the shared seed');
    const path = s.path;
    await page.click('#pause'); await page.click('#menuBack'); await page.click('#daily');
    s = await state(page);
    assert.equal(s.seed, expectedSeed, 'the same date restarts the same daily seed');
    assert.equal(s.initialAnts, 600, 'a repeated Daily still starts at 600');
    assert.deepEqual(s.path, path, 'a repeated Daily starts with the same route');
    assert.deepEqual(board.calls, [], 'Daily sends no board requests without opt in');
    assert.deepEqual(errors, [], 'zero daily page and console errors');
    console.log(`ok ant-swarm ${phone}: daily seed ${s.seed}, initial population ${s.initialAnts}, no network sharing`);
  } finally { await context.close(); }
}
async function slowDevice(browser, phone) {
  const { context, page, errors } = await open(browser, { viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true });
  try {
    // Delay scheduling only. The simulation and its fixed-step rules remain unchanged.
    await context.addInitScript(() => {
      const nativeFrame = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = callback => nativeFrame(() => setTimeout(() => callback(performance.now()), 30));
    });
    await page.goto(`${base}/lab/ant-swarm/?renderer=canvas&level=7&seed=7`);
    await until(page, () => window.swarmState?.().screen === 'menu', 'slow device menu');
    await page.click('#play');
    const initial = await state(page);
    assert.ok(initial.antLimit >= 600, 'adaptation starts with a full colony budget');
    await until(page, () => window.swarmState().antLimit < 600, 'slow frame population adaptation', 22000);
    const s = await state(page);
    assert.ok(s.count >= 300 && s.count <= s.antLimit && s.antLimit < initial.antLimit, 'slow device preserves at least 300 ants and lowers its ceiling');
    assert.deepEqual(errors, [], 'zero slow device errors');
    console.log(`ok ant-swarm ${phone}: injected +30ms rAF population adaptation ${initial.antLimit}→${s.antLimit}, count ${s.count}, frames ${JSON.stringify(s.frames)}`);
  } finally { await context.close(); }
}
let failed = 0;
try {
  for (const [phone, [engine, device]] of Object.entries(PHONES)) {
    if (process.argv[2] && process.argv[2] !== phone) continue;
    const browser = await engine.launch();
    try { await run(browser, device, phone); await unavailableBoard(browser, device, phone, '404'); await unavailableBoard(browser, device, phone, 'offline'); await canvasSmall(browser, phone); await dailyMeadow(browser, device, phone); if (phone === 'chromium') await slowDevice(browser, phone); }
    catch (e) { failed++; console.error(`FAIL ant-swarm ${phone}: ${e.stack}`); }
    finally { await browser.close(); }
  }
} finally { await new Promise(done => server.close(done)); }
console.log(`Screenshots: ${SHOTS}`);
process.exitCode = failed ? 1 : 0;
