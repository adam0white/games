// Phone check for Follow Me: node experiments/ducklings/check.mjs
// Serves experiments/ (so ../kit/ resolves), answers /notes/button.js with an empty script, and plays stage 1
// to the end card with real touch pointer events on WebKit (iPhone 13) and Chromium (Pixel 7), plus a small
// 360x640 phone for layout. Screenshots go to $SHOTS (default: a folder in the system temp dir).
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

const require = createRequire(process.env.PLAYWRIGHT ? join(resolve(process.env.PLAYWRIGHT), 'x.js') : '/Users/abdul/code/human-framework/node_modules/x.js');
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
    if (shotAt && !shot && st.t > shotAt.t) { shot = true; await page.screenshot({ path: shotAt.path }); }
    await sleep(60);
  }
  if (down) await finger(page, [['pointerup', 0, 0]]);
}

async function run(name, engine, device, full) {
  const browser = await engine.launch(), context = await browser.newContext({ ...device }), page = await context.newPage(), errors = [], sent = [];
  await context.route('https://human.adamwhite.work/**', async route => {
    const req = route.request(), cors = { 'access-control-allow-origin': base, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'Content-Type' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    try { sent.push(JSON.parse(gunzipSync(req.postDataBuffer()).toString())); } catch {}
    return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: '{"ok":true}' });
  });
  await page.addInitScript(() => {
    const Real = window.AudioContext || window.webkitAudioContext; if (!Real) return;
    window.audioLog = { made: 0, suspend: 0, resume: 0 };
    window.AudioContext = window.webkitAudioContext = class extends Real { constructor(...a) { super(...a); window.audioLog.made++; } suspend() { window.audioLog.suspend++; return super.suspend(); } resume() { window.audioLog.resume++; return super.resume(); } };
  });
  page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  const shot = file => page.screenshot({ path: join(SHOTS, `${name}-${file}.png`) });
  try {
    await page.goto(`${base}/ducklings/?fast=3`);
    await page.evaluate(() => localStorage.setItem('hf-lab-send-localhost', '1'));
    await page.reload();
    let st = await state(page);
    assert.equal(st.screen, 'menu', 'opens on the menu');
    assert.match(await page.textContent('#menu'), /The game lab records play/, 'lab notice on the menu');
    assert.match(await page.textContent('#play'), /Play stage 1/);
    await page.waitForTimeout(200); await shot('1-menu');
    if (!full) {
      // small phone: the menu fits and play starts; then a few seconds of stage 4 for the look
      const box = await page.locator('#play').boundingBox(); assert.ok(box && box.y + box.height <= device.viewport.height, 'Play button on screen');
      await page.goto(`${base}/ducklings/?level=4`); await page.click('#play');
      await drive(page, 6000); await shot('2-stage4');
      await tap(page, '#pause'); await page.click('#pauseMenu');
      // bikes warn often: a warning under the HUD is repeated below it
      await page.goto(`${base}/ducklings/?level=5&seed=5`); await page.click('#play');
      await drive(page, 12000, { t: 6, path: join(SHOTS, `${name}-3-stage5.png`) });
      assert.ok((await state(page)).hudPeeks > 0, 'a warning under the HUD shows below it');
      await tap(page, '#pause'); await page.click('#pauseMenu');
      assert.deepEqual(errors, [], 'page errors'); console.log(`ok   ${name}`); return true;
    }
    // Play: audio starts in the tap; stage 1 waits for the first touch with a ghost finger
    assert.equal(await page.evaluate(() => window.audioLog?.made ?? 0), 0, 'no audio before the first tap');
    await page.click('#play');
    st = await state(page);
    assert.equal(st.screen, 'play'); assert.ok(st.waiting, 'stage 1 waits for a touch'); assert.equal(st.line, 1, 'one duckling follows from the start');
    assert.equal(await page.evaluate(() => window.audioLog?.made ?? 1), 1, 'Play starts audio');
    await page.waitForTimeout(400); await shot('2-teach');
    // the first touch starts her moving toward a point above the finger
    const y0 = st.mom.y;
    await finger(page, [['pointerdown', st.mom.sx, st.mom.sy - 20]]);
    await until(page, y => window.ducklingsState().mom.y > y + 0.05, 'she swims up toward the finger', 5000, y0);
    st = await state(page); assert.ok(!st.waiting && st.t > 0, 'the sim runs after the touch');
    assert.ok(st.rollCalls >= 1, 'the first touch starts the roll call');
    await page.waitForTimeout(700); await shot('2b-rollcall');
    await finger(page, [['pointerup', st.mom.sx, st.mom.sy]]);
    // a second finger while one steers is a quack
    await finger(page, [['pointerdown', st.mom.sx, st.mom.sy + 90], ['pointerdown', 40, 300, 8], ['pointerup', 40, 300, 8]]);
    await until(page, () => window.ducklingsState().quackCool > 0, 'second finger quacks', 3000);
    await finger(page, [['pointerup', 0, 0]]);
    // pause freezes the sim; resume continues it
    await tap(page, '#pause');
    st = await state(page); assert.ok(st.paused && st.screen === 'paused', 'pause button pauses');
    const tp = st.t; await sleep(400); assert.equal((await state(page)).t, tp, 'time stands still while paused');
    await shot('3-paused');
    await page.click('#resume'); await until(page, t => window.ducklingsState().t > t + 0.2, 'resume continues', 4000, tp);
    await page.evaluate(() => dispatchEvent(new Event('blur'))); assert.ok((await state(page)).paused, 'losing focus pauses');
    await page.keyboard.press('p'); assert.ok(!(await state(page)).paused, 'P resumes');
    // play to the nest
    await drive(page, 40000, { t: 4, path: join(SHOTS, `${name}-4-play.png`) });
    await until(page, () => window.ducklingsState().screen === 'end', 'end card', 20000);
    await page.waitForTimeout(1400); await shot('5-end');
    st = await state(page);
    assert.equal(st.over, 'nest', 'stage 1 ends at the nest'); assert.ok(st.arrived >= 1, 'at least one duckling home');
    const blob = await page.evaluate(() => JSON.parse(localStorage.getItem('ducklings-save')));
    assert.ok(blob && blob.stars['1'] >= 1 && blob.opened >= 2 && blob.taught && blob.home >= 1, 'progress saved');
    await page.waitForTimeout(300);
    const runs = sent.filter(r => r.game === 'ducklings' && r.kind === 'run');
    assert.ok(runs.some(r => r.data.outcome === 'nest' && r.data.summary.stage === 1 && r.data.summary.arrived === st.arrived), 'lab run sent with its summary');
    assert.ok(runs[0].data.events.some(e => e.type === 'join'), 'join recorded');
    // reload keeps it
    await page.reload(); st = await state(page);
    assert.equal(st.opened, blob.opened, 'opened stage survives a reload'); assert.ok(st.taught, 'the lesson is not shown twice');
    assert.match(await page.textContent('#play'), /Play stage 2/, 'menu offers the next stage');
    // sound off is saved
    await page.click('#sound'); await page.reload(); assert.equal((await state(page)).sound, false, 'sound setting saved');
    await page.click('#sound');
    // a later stage mid-play for the look
    // leave each one through the pause menu, as a player would. Navigating away mid-run instead makes WebKit report
    // "Cannot load blob ... access control checks" from the kit lab's flush on hide (see NOTES.md, Kit candidates).
    const leave = async () => { await tap(page, '#pause'); await page.click('#pauseMenu'); await until(page, () => window.ducklingsState().screen === 'menu', 'back on the menu', 4000); };
    // the shared first-time hint (kit/hint.js), forced on with ?hint=hand: a finger holding and moving shows after 3 s of
    // idle play; a real touch removes it
    await page.goto(`${base}/ducklings/?hint=hand`); await page.click('#play'); await sleep(1000);
    assert.equal(await page.evaluate(() => !!document.querySelector('.kit-hint.on')), false, 'hint: not before 3 s of idle play');
    await until(page, () => !!document.querySelector('.kit-hint.on'), 'hint: shown after idle play', 8000);
    assert.equal(await page.evaluate(() => document.querySelector('.kit-hint').dataset.kind), 'hold-and-move', 'hint: a hold and move');
    st = await state(page); await finger(page, [['pointerdown', st.mom.sx, st.mom.sy + 90]]);
    assert.equal(await page.evaluate(() => document.querySelector('.kit-hint')), null, 'hint: a real touch removes it');
    await finger(page, [['pointerup', 0, 0]]); await leave();
    await page.goto(`${base}/ducklings/?level=7`); await page.click('#play'); await drive(page, 7000); await shot('6-stage7'); await leave();
    await page.goto(`${base}/ducklings/?level=5&seed=5`); await page.click('#play'); await drive(page, 9000); await shot('7-stage5'); await leave();
    await page.waitForTimeout(300);
    assert.ok(sent.some(r => r.game === 'ducklings' && r.kind === 'run' && r.data.outcome === 'left'), 'leaving mid-run is recorded');
    assert.deepEqual(errors, [], 'page errors');
    console.log(`ok   ${name}`);
    return true;
  } catch (e) {
    console.log(`FAIL ${name}: ${e.message}`); if (errors.length) console.log('     ' + errors.join('\n     '));
    await shot('fail').catch(() => {});
    return false;
  } finally { await browser.close(); }
}

const only = process.argv[2];
const runs = [
  ['webkit-iphone13', webkit, devices['iPhone 13'], true],
  ['chromium-pixel7', chromium, devices['Pixel 7'], true],
  ['chromium-360x640', chromium, { ...devices['Pixel 7'], viewport: { width: 360, height: 640 }, screen: { width: 360, height: 640 } }, false],
];
let ok = true;
for (const [name, engine, device, full] of runs) if (!only || name.includes(only)) ok = (await run(name, engine, device, full)) && ok;
server.close();
console.log(ok ? `all passed; screenshots in ${SHOTS}` : 'FAILED');
process.exit(ok ? 0 : 1);
