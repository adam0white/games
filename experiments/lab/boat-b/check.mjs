// Real-pointer checks: PLAYWRIGHT=/path/to/node_modules node experiments/lab/boat-b/check.mjs [webkit|chromium]
// Add --journey for a separate Chromium pass through all six streets.
// Normal game speed and rules. No test-only simulation changes or saved progress injection.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { guide } from './sim.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const shots = '/private/tmp/night-boat-b';
await mkdir(shots, { recursive: true });
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/notes/button.js') {
    res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(''); return;
  }
  if (url.pathname === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  try {
    let file = resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(root + sep)) throw new Error('outside root');
    if (url.pathname.endsWith('/')) file = join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
const require = createRequire(join(resolve(process.env.PLAYWRIGHT || '/Users/abdul/code/human-framework/node_modules'), 'x.js'));
const { webkit, chromium, devices } = require('playwright');
const phones = { webkit: [webkit, devices['iPhone 13']], chromium: [chromium, devices['Pixel 7']] };
const state = page => page.evaluate(() => window.boatState());
const wait = ms => new Promise(done => setTimeout(done, ms));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
async function until(page, fn, name, timeout = 5000, arg) {
  try { await page.waitForFunction(fn, arg, { timeout }); }
  catch { throw new Error(`timed out: ${name}`); }
}
async function open(browser, options) {
  const context = await browser.newContext(options);
  const page = await context.newPage(), errors = [], external = [];
  await context.route('**/*', async route => {
    if (!route.request().url().startsWith(base + '/')) { external.push(route.request().url()); await route.abort(); }
    else await route.continue();
  });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('requestfailed', req => errors.push(`request failed: ${req.url()}`));
  page.on('response', response => { if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${response.url()}`); });
  await page.goto(`${base}/lab/boat-b/`);
  await until(page, () => window.boatState?.().screen === 'menu', 'menu');
  return { context, page, errors, external };
}
async function layout(page, where) {
  const result = await page.evaluate(() => ({
    width: innerWidth, height: innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    buttons: [...document.querySelectorAll('button')].filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden').map(el => {
      const r = el.getBoundingClientRect(); return { id: el.id, x: r.x, y: r.y, w: r.width, h: r.height };
    }),
  }));
  assert.ok(result.scrollWidth <= result.width + 1, `${where}: no horizontal overflow`);
  assert.ok(result.scrollHeight <= result.height + 1, `${where}: no vertical overflow`);
  for (const b of result.buttons) {
    assert.ok(b.w >= 48 && b.h >= 48, `${where}: ${b.id} touch target ${b.w}×${b.h}`);
    assert.ok(b.x >= -1 && b.y >= -1 && b.x + b.w <= result.width + 1 && b.y + b.h <= result.height + 1, `${where}: ${b.id} fits`);
  }
}
function pixel(st, x, y) {
  return { x: st.layout.left + x * st.layout.scale, y: st.layout.boatY - (y - st.sim.boat.y) * st.layout.scale };
}
async function swipe(page, st, steps = 7) {
  if (st.sim.status !== 'play') return;
  const boat = st.sim.boat;
  const target = guide(st.sim);
  const dx = clamp((target - boat.x) * 1.15 - boat.vx * .28, -20, 20);
  if (Math.abs(dx) < 1.5) return;
  await dragWater(page, st, dx, steps);
}
async function dragWater(page, st, dx, steps = 7) {
  // A short horizontal ripple just ahead of the boat.
  const p = pixel(st, st.sim.boat.x, st.sim.boat.y + 2);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + dx * st.layout.scale, p.y, { steps });
  await page.mouse.up();
}
async function restart(page) {
  await page.locator('#pause').tap();
  await page.locator('#restart').tap();
  assert.equal((await state(page)).screen, 'play', 'pause-card restart starts immediately');
}
async function runPhone(browser, device, name) {
  const { context, page, errors, external } = await open(browser, device);
  try {
    await layout(page, `${name} menu`);
    await page.screenshot({ path: join(shots, `${name}-menu.png`) });
    await page.locator('#play').tap();
    await until(page, () => window.boatState().screen === 'play', 'play starts');
    let st = await state(page);
    assert.equal(st.sim.level, 0, 'first street starts at level 0');
    await layout(page, `${name} play`);
    // Pause freezes the rule clock and blur triggers the same pause path.
    await page.locator('#pause').tap();
    st = await state(page);
    assert.equal(st.screen, 'paused');
    await wait(250);
    assert.equal((await state(page)).sim.t, st.sim.t, 'pause freezes simulation');
    await layout(page, `${name} pause`);
    await page.locator('#resume').tap();
    await until(page, t => window.boatState().sim.t > t, 'resume advances', 3000, st.sim.t);
    await page.evaluate(() => dispatchEvent(new Event('blur')));
    assert.equal((await state(page)).screen, 'paused', 'blur pauses');
    await page.locator('#resume').tap();
    // Independent directional probes: pointer actions must bend the current and move the boat.
    // Street 1 also tolerates idle play, so winning alone would not establish input wiring.
    const xBefore = (await state(page)).sim.boat.x;
    await dragWater(page, await state(page), 12);
    await dragWater(page, await state(page), 12);
    await wait(300);
    assert.ok((await state(page)).sim.boat.x > xBefore + 2, 'rightward ripples move the boat right');
    await wait(850); // allow the first ripples to dissipate before the opposite-direction probe
    const leftBefore = (await state(page)).sim.boat.x;
    await dragWater(page, await state(page), -12);
    await dragWater(page, await state(page), -12);
    await wait(300);
    st = await state(page);
    assert.ok(st.sim.boat.x < leftBefore - 2 && st.sim.boat.vx < 0, 'leftward ripples move the boat left');
    await restart(page);
    st = await state(page);
    const pebbleBefore = st.sim.boat.x;
    let p = pixel(st, st.sim.boat.x - 14, st.sim.boat.y + 2);
    await page.touchscreen.tap(p.x, p.y);
    await wait(400);
    st = await state(page);
    assert.ok(st.sim.boat.x > pebbleBefore + 2 && st.sim.boat.vx > 0, 'touch pebble pushes the boat away');
    await restart(page);
    st = await state(page);
    const touchBefore = st.sim.boat.x;
    p = pixel(st, st.sim.boat.x, st.sim.boat.y + 2);
    // WebKit has no Playwright touchscreen.move. This specifically checks the touch-pointer binding;
    // the full level below uses trusted mouse drags and touchscreen taps, not dispatched events.
    await page.evaluate(({ x, y, dx }) => {
      const canvas = document.querySelector('#c');
      for (const [type, px] of [['pointerdown', x], ['pointermove', x + dx], ['pointerup', x + dx]]) {
        canvas.dispatchEvent(new PointerEvent(type, { pointerId: 91, pointerType: 'touch', isPrimary: true, clientX: px, clientY: y, bubbles: true, cancelable: true }));
      }
    }, { ...p, dx: 12 * st.layout.scale });
    await wait(400);
    assert.ok((await state(page)).sim.boat.x > touchBefore + 2, 'touch-pointer drag moves the boat');
    await restart(page);
    // Start the measured normal street fresh after the control probes.
    st = await state(page);
    p = pixel(st, st.sim.boat.x - 22, st.sim.boat.y + 5);
    await page.touchscreen.tap(p.x, p.y);
    const began = Date.now(); let mid = false;
    while (Date.now() - began < 55000) {
      st = await state(page);
      if (st.screen === 'end') break;
      assert.equal(st.screen, 'play', 'run stays in play');
      await swipe(page, st);
      if (!mid && st.sim.t > 6) {
        const dry = await page.evaluate(() => document.querySelector('#dry').getBoundingClientRect().width / document.querySelector('.meter').getBoundingClientRect().width);
        assert.ok(Math.abs(dry - (1 - st.sim.boat.soak / 100)) < .1, 'dry paper meter tracks remaining paper');
        await page.screenshot({ path: join(shots, `${name}-mid-play.png`) }); mid = true;
      }
      await wait(110);
    }
    st = await state(page);
    assert.equal(st.screen, 'end', 'street finishes within one minute');
    assert.equal(st.sim.status, 'won', 'real pointer play delivers the boat');
    assert.ok(mid, 'mid-play screenshot captured');
    assert.ok(st.actions.ripple > 0 && st.actions.pebble > 0, 'both ripple and pebble inputs handled');
    assert.ok(st.save.stars[0] > 0 && st.save.best > 0, 'progress and best saved');
    const audioState = typeof st.audio === 'string' ? st.audio : st.audio?.state;
    assert.ok(audioState && audioState !== 'unavailable', 'user gesture creates an audio context');
    await wait(450);
    await layout(page, `${name} end`);
    await page.screenshot({ path: join(shots, `${name}-end.png`) });
    const completed = structuredClone(st.save);
    await page.locator('#again').tap();
    st = await state(page);
    assert.equal(st.screen, 'play', 'one tap restarts');
    assert.equal(st.sim.level, 0, 'restart keeps street');
    assert.ok(st.sim.t < 1, 'restart resets clock');
    await page.locator('#pause').tap();
    const soundBefore = (await state(page)).save.sound;
    await page.locator('#sound').tap();
    assert.equal((await state(page)).save.sound, !soundBefore, 'sound toggles');
    await page.reload();
    await until(page, () => window.boatState?.().screen === 'menu', 'reload menu');
    st = await state(page);
    assert.deepEqual(st.save.stars, completed.stars, 'stars survive reload');
    assert.equal(st.save.best, completed.best, 'best survives reload');
    assert.equal(st.save.sound, !soundBefore, 'sound choice survives reload');
    assert.deepEqual(external, [], 'no telemetry or other external requests');
    assert.deepEqual(errors, [], 'zero page, console, HTTP or request errors');
    console.log(`PASS ${name}: street 1 won at ${completed.best} best; pointer ripple+pebble; pause/blur; reload; 0 errors`);
  } catch (error) {
    try { await page.screenshot({ path: join(shots, `${name}-FAIL.png`) }); console.error('State:', JSON.stringify(await state(page))); } catch {}
    if (errors.length) console.error(errors.join('\n'));
    throw error;
  } finally { await context.close(); }
}
async function smallAndDesktop(browser) {
  for (const [name, options] of [
    ['small-360', { viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
    ['desktop', { viewport: { width: 1280, height: 800 } }],
  ]) {
    const { context, page, errors, external } = await open(browser, options);
    try {
      await layout(page, `${name} menu`);
      await page.click('#play');
      await layout(page, `${name} play`);
      const before = (await state(page)).actions.ripple;
      await page.keyboard.down('ArrowRight');
      await wait(260);
      await page.keyboard.up('ArrowRight');
      await page.keyboard.press('Space');
      await wait(150);
      const after = await state(page);
      assert.ok(after.actions.ripple > before && after.actions.pebble > 0, `${name}: keyboard ripple and pebble`);
      await page.screenshot({ path: join(shots, `${name}.png`) });
      await page.click('#pause');
      await layout(page, `${name} pause`);
      assert.deepEqual(external, []);
      assert.deepEqual(errors, []);
      console.log(`PASS ${name}: layout, 48px targets, keyboard, 0 errors`);
    } finally { await context.close(); }
  }
}
// Optional complete journey: no time acceleration or state injection. Guide policy uses rapid short strokes;
// the slower seven-point phone drag policy won streets 1–4 but lost street 5 (two hits at 12.42s).
async function runJourney(browser) {
  const { context, page, errors, external } = await open(browser, devices['Pixel 7']);
  try {
    await page.locator('#play').tap();
    for (let level = 0; level < 6; level++) {
      assert.equal((await state(page)).sim.level, level, `Next starts street ${level + 1}`);
      const began = Date.now(); let art = false;
      while (Date.now() - began < 75000) {
        const st = await state(page);
        if (st.screen === 'end') break;
        assert.equal(st.screen, 'play');
        await swipe(page, st, 1);
        if (!art && st.sim.t > 7 && [2, 3].includes(level)) {
          await page.screenshot({ path: join(shots, `journey-street-${level + 1}.png`) }); art = true;
        }
        await wait(70);
      }
      const st = await state(page);
      assert.equal(st.screen, 'end', `street ${level + 1} reaches end`);
      assert.equal(st.sim.status, 'won', `street ${level + 1} won by real pointer control`);
      assert.equal(st.sim.level, level, 'pointer input did not skip the end card');
      console.log(`PASS journey street ${level + 1}: ${st.sim.t.toFixed(2)}s, ${st.sim.stars} stars, ${st.sim.rescued} passengers, ${st.sim.hits} hits`);
      await layout(page, `journey end ${level + 1}`);
      if (level < 5) await page.locator('#next').tap();
      else await page.screenshot({ path: join(shots, 'journey-street-6-end.png') });
    }
    const end = await state(page);
    assert.ok(end.save.stars.every(stars => stars > 0), 'all six streets saved');
    assert.deepEqual(errors, [], 'journey: zero browser errors');
    assert.deepEqual(external, [], 'journey: no external requests');
    console.log(`PASS full journey: ${end.save.stars.reduce((a, b) => a + b, 0)}/18 saved stars, 0 errors`);
  } catch (error) {
    try { await page.screenshot({ path: join(shots, 'journey-FAIL.png') }); console.error('Journey state:', JSON.stringify(await state(page))); } catch {}
    if (errors.length) console.error(errors.join('\n'));
    throw error;
  } finally { await context.close(); }
}
const journey = process.argv.includes('--journey');
const only = process.argv.slice(2).find(arg => arg === 'webkit' || arg === 'chromium');
let failures = 0;
try {
  for (const [name, [engine, device]] of Object.entries(phones)) {
    if ((only && only !== name) || (journey && name !== 'chromium')) continue;
    let browser;
    try {
      browser = await engine.launch();
      if (journey) await runJourney(browser);
      else {
        await runPhone(browser, device, name);
        if (name === 'chromium') await smallAndDesktop(browser);
      }
    } catch (error) { failures++; console.error(`FAIL ${name}: ${error.stack}`); }
    finally { await browser?.close(); }
  }
} finally { await new Promise(done => server.close(done)); }
console.log(`Screenshots: ${shots}`);
process.exitCode = failures ? 1 : 0;
