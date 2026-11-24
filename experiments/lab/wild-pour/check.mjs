// Phone check for Pour: PLAYWRIGHT=<dir with playwright> node experiments/lab/wild-pour/check.mjs [webkit|chromium]
// Serves experiments/ on a free port, plays level 1 by real touch pointer events on WebKit (iPhone 13) and
// Chromium (Pixel 7), and fails on any page or console error. Set HEADED=1 to open a window.
// Screenshots go to $SHOTS or a new folder in the system temp directory.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, mkdir, mkdtemp } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../..');
const SHOTS = process.env.SHOTS || await mkdtemp(join(tmpdir(), 'wild-pour-check-'));
await mkdir(SHOTS, { recursive: true });
console.log(`Screenshots: ${SHOTS}`);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript' };
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
const state = page => page.evaluate(() => window.pourState());
async function until(page, fn, what, ms = 15000) { try { await page.waitForFunction(fn, null, { timeout: ms }); } catch { throw new Error(`timed out waiting for: ${what}`); } }

async function readyRenderer(page, name, headed) {
  await page.bringToFront();
  if (name !== 'webkit' || headed || process.platform !== 'darwin') return;
  const viewport = page.viewportSize();
  const framesReady = () => page.evaluate(() => new Promise(resolve => {
    const timeout = setTimeout(() => resolve(false), 2000);
    requestAnimationFrame(() => requestAnimationFrame(() => { clearTimeout(timeout); resolve(true); }));
  }));
  if (await framesReady()) return;
  // Reattach the display link, then check it at the original phone size.
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.setViewportSize({ ...viewport, width: viewport.width + 1 });
    await page.setViewportSize(viewport);
    if (await framesReady()) return;
  }
  throw new Error('timed out waiting for: headless WebKit animation frames');
}

// One pour by a thumb: press under the jug, slide right until the juice runs, ease off as the glass nears the line, lift.
async function pour(page, shot) {
  return page.evaluate(async shotAt => {
    const el = document.getElementById('c'), st = () => window.pourState();
    const send = (type, x, y) => el.dispatchEvent(new PointerEvent('pointer' + type, { pointerId: 5, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, pressure: type === 'up' ? 0 : 0.5, bubbles: true, cancelable: true }));
    const frame = () => new Promise(r => requestAnimationFrame(r));
    const s0 = st(), x0 = s0.W * 0.3, y = s0.H * 0.55, span = Math.max(120, Math.min(s0.W, 520) * 0.55);
    send('down', x0, y);
    let dx = 0, shotTaken = false, frames = 0;
    while (frames++ < 60 * 25) {
      const s = st(); if (s.over) break;
      if (s.inGlass + s.flying >= s.target - 3) break;
      const need = 1.28 + (1 - s.inJug / 80) * 0.85 + 0.1; // the tilt where juice runs, as the bots use it
      dx = Math.min(dx + 3, need / 2.4 * span);
      send('move', x0 + dx, y);
      if (!shotTaken && s.inGlass > 2) { shotTaken = true; window.__shot = true; }
      await frame();
    }
    send('up', x0 + dx, y);
  });
}

async function run(name) {
  const [type, device] = PHONES[name];
  const headed = process.env.HEADED === '1';
  // macOS WebKit can stop scheduling frames when the display sleeps, even headless.
  const awake = name === 'webkit' && process.platform === 'darwin'
    ? spawn('/usr/bin/caffeinate', ['-diu', '-t', '180'], { stdio: 'ignore' })
    : null;
  let browser;
  try {
  browser = await type.launch({ headless: !headed });
  const ctx = await browser.newContext({ ...device });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  await page.goto(`${base}/lab/wild-pour/?seed=3&perf=1`);
  await until(page, () => window.pourState && window.pourState().screen === 'menu', 'menu');
  await readyRenderer(page, name, headed);
  const boot = await page.evaluate(() => new Promise(resolve => {
    let frames = 0, done = false;
    const tick = () => { frames++; if (!done) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    setTimeout(() => { done = true; resolve({frames, visibility:document.visibilityState, focused:document.hasFocus()}); }, 500);
  }));
  console.log(`${name}: renderer startup ${JSON.stringify(boot)}, errors ${JSON.stringify(errors)}`);
  await page.screenshot({ path: join(SHOTS, `${name}-1-menu.png`) });
  let st = await state(page);
  assert.ok(st.minTouchPx >= 48, `menu touch targets ${st.minTouchPx.toFixed(0)} px`);

  await page.evaluate(() => document.getElementById('play').addEventListener('click', () => { window.__started = window.pourState(); }, {once:true}));
  await page.tap('#play');
  st = await state(page);
  assert.ok(st.playing && st.level === 1, 'Play starts level 1');
  assert.equal(await page.evaluate(() => window.__started.remaining), 30, 'clock starts at exactly 30 seconds in the Play event');
  assert.ok(st.jugClearance >= 0, `whole jug rotation clears HUD by ${st.jugClearance.toFixed(2)}px`);
  // Doing nothing pours nothing, and after 3 s the kit's finger hint shows how to tip.
  await sleep(3600);
  st = await state(page);
  assert.equal(st.inJug, 80, 'the jug stays full with no touch');
  await page.screenshot({ path: join(SHOTS, `${name}-2-hint.png`) });

  let won = false;
  for (let attempt = 0; attempt < 3 && !won; attempt++) {
    const p = pour(page);
    await until(page, () => window.__shot || window.pourState().over, 'juice in the glass', 20000);
    await page.screenshot({ path: join(SHOTS, `${name}-2-pouring.png`) });
    await p;
    await until(page, () => window.pourState().screen === 'end', 'end card', 20000);
    st = await state(page);
    console.log(`${name}: attempt ${attempt + 1}: ${st.won ? 'won' : 'lost'} (${st.why}), ${st.inGlass} in the glass for ${st.target}, ${st.spilled} spilled, ${st.stars} stars`);
    await sleep(300);
    await page.screenshot({ path: join(SHOTS, `${name}-3-end-${attempt + 1}.png`) });
    won = st.won;
    if (!won) { await page.evaluate(() => { window.__shot = false; }); await page.tap('#retry'); }
  }
  assert.ok(won, 'a thumb wins level 1 within three tries');
  st = await state(page);
  assert.ok(st.saved[0] >= 1, 'stars saved');

  // Next, then pause and go on, then back to the menu where level 2 is open.
  await page.tap('#next');
  st = await state(page);
  assert.ok(st.playing && st.level === 2, 'Next starts level 2');
  await page.tap('#pause');
  st = await state(page); assert.ok(st.paused, 'pause button pauses');
  const t = st.t, remaining = st.remaining; await sleep(400); assert.equal((await state(page)).t, t, 'paused: time stands still');
  assert.equal((await state(page)).remaining, remaining, 'pause freezes visible countdown');
  await page.tap('#resume'); await sleep(300);
  assert.ok((await state(page)).t > t, 'go on: time runs');
  await page.tap('#pause'); await page.tap('#quit');
  st = await state(page); assert.equal(st.screen, 'menu', 'menu after quit');
  assert.equal(await page.locator('#levels button:not([disabled])').count(), 2, 'level 2 is open on the menu');
  await page.reload();
  await until(page, () => window.pourState && window.pourState().screen === 'menu', 'menu after reload');
  await readyRenderer(page, name, headed);
  st = await state(page); assert.ok(st.saved[0] >= 1, 'stars survive a reload');

  // Profile the actual animation loop separately from screenshot capture and automation.
  await page.tap('#play');
  await sleep(1000);
  const before = await page.evaluate(() => window.pourPerf().intervals.length);
  await sleep(5000);
  const perf = await page.evaluate(start => {
    const p = window.pourPerf(), summarize = a => {
      const sorted = a.slice().sort((a,b) => a-b);
      return { count: a.length, mean: a.reduce((x,y) => x+y,0)/a.length,
        p95: sorted[Math.floor(sorted.length*.95)], max: sorted.at(-1) };
    };
    return { interval: summarize(p.intervals.slice(start)), work: summarize(p.work.slice(start)) };
  }, before);
  console.log(`${name}: frame profile ${JSON.stringify(perf)}`);
  assert.ok(perf.interval.count >= 250, 'at least 250 frames in five seconds');
  assert.ok(perf.work.p95 < 16.67, 'p95 simulation and render work fits 60fps budget');
  assert.ok(perf.interval.mean < 18, 'mean frame interval sustains near 60fps');
  // Full tilt must remain below both the dots and clock, including the handle stroke.
  await page.evaluate(() => {
    const c = document.getElementById('c');
    for (const [type,x] of [['pointerdown',80],['pointermove',360]])
      c.dispatchEvent(new PointerEvent(type,{pointerId:8,pointerType:'touch',clientX:x,clientY:400,bubbles:true}));
  });
  await until(page, () => window.pourState().angle >= 2.39, 'full tilt');
  await page.screenshot({ path: join(SHOTS, `${name}-4-full-tilt.png`) });
  assert.ok((await state(page)).jugClearance >= 0, 'full tilt clears HUD');
  await page.evaluate(() => document.getElementById('c').dispatchEvent(new PointerEvent('pointerup', {pointerId:8,pointerType:'touch',bubbles:true})));
  if ((await state(page)).over) {
    await until(page, () => window.pourState().screen === 'end', 'full tilt result');
    await page.tap('#toMenu');
  } else { await page.tap('#pause'); await page.tap('#quit'); }

  // Daily retries share seed, do not award campaign stars, and retain the device best.
  const campaign = (await state(page)).saved;
  await page.tap('#daily');
  const dailyStart = await state(page);
  assert.ok(dailyStart.daily && dailyStart.level === 1, 'daily starts');
  const activeStart = await page.evaluate(() => window.pourPerf().intervals.length);
  await pour(page);
  await until(page, () => window.pourState().screen === 'end', 'daily result', 35000);
  const active = await page.evaluate(start => {
    const p = window.pourPerf(), stats = data => {
      const a = data.slice(start), sorted = a.slice().sort((x,y) => x-y);
      return {count:a.length,mean:a.reduce((x,y)=>x+y,0)/a.length,p95:sorted[Math.floor(a.length*.95)],max:sorted.at(-1)};
    };
    return {interval:stats(p.intervals),work:stats(p.work)};
  }, activeStart);
  console.log(`${name}: active pour profile ${JSON.stringify(active)}`);
  assert.ok(active.interval.count >= 120, 'at least two seconds of active pour measured');
  assert.ok(active.work.p95 < 16.67, 'active pour p95 work fits 60fps budget');
  assert.ok(active.interval.mean < 18, 'active pour mean interval sustains near 60fps');
  const dailyEnd = await state(page);
  assert.ok(dailyEnd.won, 'daily touch pour wins');
  assert.equal(dailyEnd.daily.best.off, Math.abs(dailyEnd.inGlass - dailyEnd.target), 'daily precision saved');
  assert.equal(dailyEnd.daily.best.spilled, dailyEnd.spilled, 'daily spills saved');
  assert.deepEqual(dailyEnd.saved, campaign, 'daily leaves campaign stars unchanged');
  assert.equal(await page.locator('#next').isVisible(), false, 'daily has no campaign Next');
  await page.screenshot({ path: join(SHOTS, `${name}-5-daily.png`) });
  await page.tap('#retry');
  const retry = await state(page);
  assert.equal(retry.seed, dailyStart.seed, 'daily retry keeps seed');
  assert.equal(retry.daily.day, dailyStart.daily.day, 'daily retry keeps day');
  await page.reload();
  await until(page, () => window.pourState?.().screen === 'menu', 'daily reload');
  await readyRenderer(page, name, headed);
  assert.ok((await page.locator('#dailyBest').textContent()).includes(`${dailyEnd.daily.best.off} from the line`), 'device best survives reload');
  await page.tap('#daily');
  assert.deepEqual((await state(page)).daily.best, dailyEnd.daily.best, 'reload preserves exact daily best');
  console.log(`${name}: daily ${dailyEnd.inGlass}/${dailyEnd.target}, ${dailyEnd.spilled} spilled; clearance ${retry.jugClearance.toFixed(2)}px`);

  assert.deepEqual(errors, [], 'no page or console errors');
  console.log(`${name}: ok`);
  } finally { try { await browser?.close(); } finally { awake?.kill(); } }
}

const which = process.argv[2] ? [process.argv[2]] : ['webkit', 'chromium'];
let failed = 0;
for (const name of which) { try { await run(name); } catch (e) { failed++; console.log(`${name}: FAIL ${e.message}`); } }
server.close();
process.exit(failed ? 1 : 0);
