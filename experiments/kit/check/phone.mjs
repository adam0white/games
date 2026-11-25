// Phone runs for the live experiments. Run before and after any change to experiments/kit/ or to a game's page:
//   node experiments/kit/check/phone.mjs            every registered page, WebKit iPhone 13 and Chromium Pixel 7
//   node experiments/kit/check/phone.mjs lantern webkit
// It serves this checkout the way production does (/<slug>/, the 301 from /proto/<slug>/, /notes/button.js), seeds saves in the
// formats players already have, and fails on any page error. Playwright is not a dependency of this repository:
// set PLAYWRIGHT to a directory that has it installed, or install it anywhere Node can resolve it.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { experimentPath } from '../../../src/worker.mjs';
import { experimentRoots } from '../../../scripts/experiments.mjs';
import { pages, pageRuns } from './pages.mjs';
import { labPages } from './lab-pages.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
// The notes page builds its games menu and game picker from kit/games.json, so every experiment has to be in it.
{
  const listed = new Set(JSON.parse(readFileSync(join(root, 'experiments/kit/games.json'), 'utf8')).games.map(game => game.slug));
  const missing = readdirSync(join(root, 'experiments'), { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !['kit', 'lab'].includes(entry.name) && existsSync(join(root, 'experiments', entry.name, 'index.html')) && !listed.has(entry.name))
    .map(entry => entry.name);
  assert.deepEqual(missing, [], `add these experiments to experiments/kit/games.json so testers can find them: ${missing.join(', ')}`);
}
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x'), moved = experimentPath(url.pathname);
  if (moved) { res.writeHead(301, { location: `${base}${moved}${url.search}` }); return res.end(); } // as src/worker.mjs does
  let path = normalize(decodeURIComponent(url.pathname));
  const dir = experimentRoots.find(dir => existsSync(join(root, dir, path.split('/')[1] || '.', 'index.html')));
  let file = path === '/notes/button.js' ? join(root, 'workers/feedback/public/notes/button.js') : dir ? join(root, dir, path) : null;
  if (file && path.endsWith('/')) file = join(file, 'index.html');
  try { if (!file || !file.startsWith(root)) throw 0; const body = await readFile(file); res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' }); res.end(body); }
  catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;

const require = createRequire(process.env.PLAYWRIGHT ? join(resolve(process.env.PLAYWRIGHT), 'x.js') : import.meta.url);
const { webkit, chromium, devices } = require('playwright');
const PHONES = { webkit: [webkit, devices['iPhone 13']], chromium: [chromium, devices['Pixel 7']] };

const sleep = ms => new Promise(done => setTimeout(done, ms));
async function until(page, fn, what, ms = 8000, arg = null) { try { await page.waitForFunction(fn, arg, { timeout: ms }); } catch { throw new Error(`timed out waiting for: ${what}`); } }
// A finger on the canvas, as the pointer events the games listen for.
const finger = (page, sel, steps) => page.evaluate(([sel, steps]) => {
  const el = document.querySelector(sel);
  for (const [type, x, y] of steps) el.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, pressure: type === 'pointerup' ? 0 : 0.5, bubbles: true, cancelable: true }));
}, [sel, steps]);
// Lab records the page sent. Every context answers the lab endpoint itself (see the runner), so no check reaches it.
const labSent = page => page.context().labSent;
const labRuns = (page, game) => labSent(page).filter(r => r.game === game && r.kind === 'run');
const LAB_LOCAL = () => localStorage.setItem('hf-lab-send-localhost', '1'); // pages on 127.0.0.1 send only with this
const shots = process.env.SHOTS;
if (shots) await mkdir(shots, { recursive: true });
async function shot(page, stage) {
  if (shots) await page.screenshot({ path: join(shots, `${page.context().checkName}-${stage}.png`) });
}

const hasTimedHint = g => g.timing || g.hint?.timing || g.hints?.some(hint => hint.timing);
async function observeFrames(page, ms) {
  const observed = await page.evaluate(ms => new Promise(resolve => {
    const end = performance.now() + ms;
    const timeout = setTimeout(() => resolve(false), ms + 2000);
    function sample(now) {
      if (now < end) requestAnimationFrame(sample);
      else { clearTimeout(timeout); resolve(true); }
    }
    requestAnimationFrame(() => requestAnimationFrame(sample));
  }), ms);
  assert.ok(observed, 'animation frames across the observation interval');
}

async function readyRenderer(page, g) {
  if (!hasTimedHint(g)) return;
  if (process.platform !== 'darwin' || page.context().browser().browserType().name() !== 'webkit') return;
  await page.bringToFront();
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

// Registrations name the page's own save format, state hook and controls. Keep these contracts in the page's section.
async function savedPhone(page, g) {
  if (g.prepare) await g.prepare(page);
  const state = () => page.evaluate(g.state);
  const wait = async (predicate, what) => {
    let last;
    for (let i = 0; i < 80; i++) { last = await state(); if (predicate(last)) return last; await sleep(100); }
    throw new Error(`timed out waiting for: ${what} (screen=${last?.screen}, t=${last?.t})`);
  };
  const pause = async () => {
    if (g.pauseDown) await finger(page, g.pause ?? '#pause', [['pointerdown', 0, 0]]);
    else await page.click(g.pause ?? '#pause', { position: g.pausePosition });
    await wait(s => s.paused || s.screen === 'paused', 'pause');
  };
  const play = async () => {
    if (!g.startsOnBoard) {
      if (g.start) await g.start(page); else await page.click(g.play ?? '#play');
    }
    await wait(s => s.screen === 'play', 'play');
  };
  const url = new URL(g.path, base);
  url.searchParams.set('labRunSource', 'agent');
  await page.goto(url.href);
  await until(page, g.state, 'game script');
  await page.evaluate(seeds => { for (const [k, v] of Object.entries(seeds)) localStorage.setItem(k, v); localStorage.setItem('notes.k', 'check'); }, g.seeds);
  await page.reload(); await until(page, g.state, 'game script after seeded reload');
  await readyRenderer(page, g);
  assert.deepEqual(await page.evaluate(g.verify), g.expect, 'old save: loaded by the page');
  assert.equal(await page.evaluate(() => window.audioLog.made), 0, 'no audio before the first tap');
  await noZoomed(page); await shot(page, g.startsOnBoard ? 'opening' : 'menu');
  await play();
  if (!g.startsOnBoard) assert.equal(await page.evaluate(() => window.audioLog.made), 1, 'Play starts one audio context');
  await g.touch(page, { finger, until, sleep });
  if (g.startsOnBoard) assert.equal(await page.evaluate(() => window.audioLog.made), 1, 'first input starts one audio context');
  await shot(page, 'play');
  await pause();
  const t = (await state()).t;
  await g.verifyPaused?.(page, { finger });
  if (hasTimedHint(g)) await observeFrames(page, 300); else await sleep(300);
  assert.equal((await state()).t, t, 'play state stands still while paused'); await shot(page, 'paused');
  const toggleSound = async () => {
    await page.click(g.sound);
    if (g.saveKey) assert.equal(await page.evaluate(k => JSON.parse(localStorage.getItem(k)).sound, g.saveKey), false, 'sound off saved');
    else assert.equal(await page.evaluate(k => localStorage.getItem(k), g.soundKey), g.soundOff, 'sound off saved');
  };
  if (g.sound && !g.soundOnMenu) await toggleSound();
  await page.click(g.resume ?? '#resume'); await wait(s => s.screen === 'play' && !s.paused, 'resume');
  if (g.resumeTouch) await g.touch(page, { finger, until, sleep });
  await wait(s => s.screen === 'play' && !s.paused && s.t > t, 'play state advances after resume');
  await page.evaluate(() => dispatchEvent(new Event('blur'))); await wait(s => s.paused || s.screen === 'paused', 'losing focus pauses');
  await page.keyboard.press('P'); await wait(s => s.screen === 'play' && !s.paused, 'capital P resumes');
  await page.evaluate(() => dispatchEvent(new Event('pagehide'))); await wait(s => s.paused || s.screen === 'paused', 'putting the page away pauses');
  if (g.menu) { await page.click(g.menu); await wait(s => s.screen === 'menu', 'back on the menu'); }
  if (g.sound && g.soundOnMenu) await toggleSound();
  // A setting write must keep every seeded field. Only the named run counters may advance.
  const kept = await page.evaluate(keys => Object.fromEntries(keys.map(k => [k, localStorage.getItem(k)])), Object.keys(g.seeds));
  for (const [k, v] of Object.entries(g.seeds)) {
    if (k === g.soundKey && g.sound) { assert.equal(kept[k], g.soundOff); continue; }
    if (k === g.saveKey || g.changed?.[k]) {
      const expected = JSON.parse(v), actual = JSON.parse(kept[k]);
      if (k === g.saveKey && g.sound) expected.sound = false;
      for (const [field, delta] of Object.entries(g.changed?.[k] ?? {})) expected[field] += delta;
      assert.deepEqual(actual, expected, `old save: ${k} kept after play and setting write`);
    } else assert.equal(kept[k], v, `old save: ${k} kept`);
  }
  await page.reload(); await until(page, g.state, 'game script after reload');
  await readyRenderer(page, g);
  assert.deepEqual(await page.evaluate(keys => Object.fromEntries(keys.map(k => [k, localStorage.getItem(k)])), Object.keys(kept)), kept, 'reload keeps every seeded key');
  assert.equal(await page.evaluate(() => localStorage.getItem('notes.k')), 'check', 'tester link kept');
  await play();
  if (g.startsOnBoard) await g.touch(page, { finger, until, sleep });
  assert.equal(await page.evaluate(() => window.audioLog.made), g.sound ? 0 : 1, 'sound choice survives reload');
  await pause();
  if (g.menu) await page.click(g.menu);
}

// The joystick's numbers: 55 px of travel is full speed, a dead zone of 0.15 of that, and a 70 px leash that drags the origin.
async function stickNumbers(page) {
  const input = () => page.evaluate(() => window.__ant.input), near = (a, b, what) => assert.ok(Math.abs(a - b) < 1e-9, `${what}: ${a} is not ${b}`);
  await finger(page, '#c', [['pointerdown', 150, 400], ['pointermove', 155, 400]]);
  assert.deepEqual(await input(), { x: 0, y: 0 }, 'stick: inside the dead zone does nothing');
  await finger(page, '#c', [['pointermove', 150, 409]]); near((await input()).y, 9 / 55, 'stick: just outside the dead zone');
  await finger(page, '#c', [['pointermove', 177.5, 400]]); near((await input()).x, 0.5, 'stick: half of 55 px is half speed');
  await finger(page, '#c', [['pointermove', 250, 400]]); near((await input()).x, 70 / 55, 'stick: the leash holds the origin 70 px behind');
  await finger(page, '#c', [['pointermove', 200, 400]]); near((await input()).x, 20 / 55, 'stick: the origin moved with the leash');
  await finger(page, '#c', [['pointerup', 200, 400]]); assert.deepEqual(await input(), { x: 0, y: 0 }, 'stick: lifting the finger stops');
}
// Lantern's relative drag: boat travel is finger travel times the gain (1.3), in river units; after a pause, a 12 px dead zone, then a re-anchor.
async function dragNumbers(page) {
  const state = () => page.evaluate(() => window.lanternState()), near = (a, b, what) => assert.ok(Math.abs(a - b) < 1e-9, `${what}: ${a} is not ${b}`);
  await page.evaluate(() => { const s = window.lanternSim(); s.safe = 60; s.light = 1; }); // no blow or dark ends the run, or moves the anchor, mid-check
  // The boat moves every frame, so read where it was at touch-down in the same task as the touch.
  const moved = await page.evaluate(() => { const x = window.lanternState().x, c = document.querySelector('#c'), ev = (type, cx) => c.dispatchEvent(new PointerEvent(type, { pointerId: 8, pointerType: 'touch', isPrimary: true, clientX: cx, clientY: 400, pressure: 0.5, bubbles: true }));
    ev('pointerdown', 200); ev('pointermove', 180); const t = window.lanternState().target; ev('pointerup', 180); return t - x; });
  let st = await state(); const u = st.unit; near(moved, -20 / u * 1.3, 'drag: gain 1.3'); // to the left: earlier checks steered right, so the bank is far on this side
  await finger(page, '#pause', [['pointerdown', 0, 0]]); st = await state(); assert.ok(st.paused);
  await finger(page, '#c', [['pointerdown', 200, 400], ['pointermove', 189, 400]]); assert.equal((await state()).target, st.x, 'drag: 11 px after a pause does not steer');
  await finger(page, '#c', [['pointermove', 187, 400]]); const t13 = (await state()).target;
  assert.ok(Math.abs(t13 - st.x) < 0.01, 'drag: leaving the dead zone re-anchors, it does not jump'); // a jump of 13 px would be about 0.04
  await finger(page, '#c', [['pointermove', 177, 400]]); near((await state()).target - t13, -10 / u * 1.3, 'drag: steers from the re-anchor');
  await finger(page, '#c', [['pointercancel', 177, 400], ['pointermove', 140, 400]]); near((await state()).target - t13, -10 / u * 1.3, 'drag: a cancelled finger no longer steers');
}


// No zoom (note #74, kit/zoom.js): the viewport caps the scale, no visible element is left at touch-action auto, and a double tap's default is cancelled.
async function noZoomed(page) {
  const r = await page.evaluate(() => {
    const loose = [...document.querySelectorAll('body *')].filter(el => el.getClientRects().length && getComputedStyle(el).touchAction === 'auto').map(el => el.id || el.tagName);
    const ev = new MouseEvent('dblclick', { bubbles: true, cancelable: true }); document.body.dispatchEvent(ev);
    return { meta: document.querySelector('meta[name=viewport]').content, loose, cancelled: ev.defaultPrevented };
  });
  assert.match(r.meta, /maximum-scale=1/); assert.deepEqual(r.loose, [], 'no visible element at touch-action auto'); assert.ok(r.cancelled, 'a double tap does not zoom');
}
function observeHintTiming({ board, start, result, selector = '.kit-hint' }) {
  let eligible, shown;
  const observer = new MutationObserver(() => {
    const hint = document.querySelector(selector);
    if ((board && hint) || (result && document.querySelector(result))) eligible ??= performance.now();
    if (hint?.classList.contains('on')) {
      shown = performance.now();
      observer.disconnect();
    }
  });
  if (start) document.querySelector(start).addEventListener('click', () => { eligible = performance.now(); }, { capture: true, once: true });
  observer.observe(board ? document : document.body, { childList: !!board, attributes: true, attributeFilter: ['class'], subtree: true });
  window.checkHintDelay = () => shown - eligible;
}

// The first-time help (kit/hint.js). On a fresh save: not on the menu, not before the delay, shown after it, hidden while the
// pause card covers the game, and a real press on it reaches the game (it never takes input). The press ends it for good and
// writes its key. A returning player (the game's own save, or the hint's key alone) never sees it. With reduced motion it stands
// still with words. g: path, play (the button that starts a run), resume (the pause card's button), key, delay, moved (did the
// press reach the game), alive (keep the run going while the check waits), legacy (a save in the game's existing format).
async function hinted(page, g) {
  if (g.prepare) await g.prepare(page);
  const selector = g.selector ?? '.kit-hint';
  const visible = `${selector}.on`;
  const timing = g.timing && { ...g.timing, selector };
  // These boards start counting at launch. Observe the mounted hint before navigation can finish.
  if (timing?.board) await page.addInitScript(observeHintTiming, timing);
  const on = () => page.locator(visible).count().then(Boolean);
  const waitOn = (what, ms) => until(page, sel => !!document.querySelector(sel), what, ms, visible);
  // Leave the game first: a game may save as its page goes away (Ant Promotion does), which would make this player a returning one.
  const fresh = async (seed = {}) => {
    await page.goto(`${base}/notes/button.js`);
    await page.evaluate(seed => { localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); }, { ...g.seed, ...seed });
    await page.goto(`${base}${g.path}`);
    await readyRenderer(page, g);
    await page.waitForSelector(g.play);
  };
  const play = async () => {
    if (g.start) await g.start(page, { finger, until });
    else if (!g.timing?.board) await page.click(g.play);
    if (g.alive) await page.evaluate(g.alive);
  };
  const idle = async ms => { for (let t = 0; t < ms; t += 500) { if (g.alive) await page.evaluate(g.alive); await sleep(500); } };
  await fresh();
  if (!g.timing) await sleep(g.delay + 500);
  if (!g.timing?.board) {
    assert.equal(await on(), false, 'hint: hidden before the tutorial starts');
    if (timing) await page.evaluate(observeHintTiming, timing);
  }
  await play();
  if (!g.timing) { await sleep(g.delay / 2); assert.equal(await on(), false, 'hint: not before the delay'); }
  await waitOn('hint: shown after the delay', g.delay + 8000); // CI's software WebGL draws lantern-3d at a few frames a second
  // The kit can count up to 250 ms from the frame just before the start action.
  if (g.timing) assert.ok(await page.evaluate(() => window.checkHintDelay()) >= g.delay - 250, 'hint: not before the delay');
  if (shots && g.timing) await until(page, sel => {
    const hint = document.querySelector(sel);
    return hint && getComputedStyle(hint).opacity === '1';
  }, 'hint: entrance animation finished', 8000, visible);
  await shot(page, 'hint');
  const label = page.locator(`${selector} .label`).first();
  const knob = page.locator(`${selector} .knob`).first();
  assert.equal(await label.evaluate(el => getComputedStyle(el).display), 'none', 'hint: no words while it moves');
  if (!g.timing?.result) {
    await page.evaluate(() => dispatchEvent(new Event('blur')));
    if (g.waitHintState) await until(page, sel => !document.querySelector(sel), 'hint: hidden under the pause card', 8000, visible);
    else { await sleep(200); assert.equal(await on(), false, 'hint: hidden under the pause card'); }
    await page.click(g.resume); await waitOn('hint: back after resume (a tap on a card is not play input)', 2000);
  }
  if (g.alive) await page.evaluate(g.alive);
  if (g.input) {
    assert.equal(await knob.evaluate(el => getComputedStyle(el).pointerEvents), 'none', 'hint: the overlay lets input through');
    await g.input(page, { finger, until, knob });
  } else {
    // A real press where the knob is: the page's own hit test says the game is under it, and the game moves.
    const { x, y, top } = await knob.evaluate(el => { const r = el.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2; return { x, y, top: document.elementFromPoint(x, y)?.id }; });
    assert.equal(top, (g.canvas ?? '#c').slice(1), 'hint: the game canvas is what a finger on the hint touches');
    const before = await page.evaluate(g.before ?? (() => null));
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 40, y, { steps: 4 });
    if (g.releaseInput) await page.mouse.up();
    if (g.waitInput) await until(page, g.moved, 'hint: a press on the hint reaches the game', 8000, before);
    else assert.ok(await page.evaluate(g.moved, before), 'hint: a press on the hint reaches the game');
    if (!g.releaseInput) await page.mouse.up();
  }
  assert.equal(await page.locator(selector).count(), 0, 'hint: gone on the first input');
  assert.equal(await page.evaluate(k => localStorage.getItem(k), g.key), '1', 'hint: the player is remembered');
  if (!g.timing) { await idle(g.delay + 500); assert.equal(await on(), false, 'hint: does not come back'); }
  // Returning players.
  for (const [seed, what] of [[g.legacy, 'a save in the game\'s existing format'], [{ [g.key]: '1' }, 'the hint\'s own key']]) {
    if (!seed) continue;
    await fresh(seed); await play();
    if (g.timing) assert.equal(await page.locator(selector).count(), 0, `hint: not installed for a returning player (${what})`);
    else { await idle(g.delay + 1000); assert.equal(await on(), false, `hint: never shown to a returning player (${what})`); }
  }
  // Reduced motion: a still copy with words.
  await page.emulateMedia({ reducedMotion: 'reduce' }); await fresh(); await play();
  await waitOn('hint: shown with reduced motion', g.delay + 8000);
  const pose = () => knob.evaluate(el => getComputedStyle(el).transform);
  const p0 = await pose();
  if (timing) await observeFrames(page, 400); else await sleep(400);
  assert.equal(await pose(), p0, 'hint: still with reduced motion'); assert.equal(await label.evaluate(el => getComputedStyle(el).display), 'block', 'hint: words with reduced motion');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
}
// A game that follows the house layout: #play on the menu, #pause in play, a state hook with `screen`, and a save blob.
async function started(page, slug, hook, toMenu) {
  const wait = async (fn, what) => { try { await page.waitForFunction(fn, hook, { timeout: 8000 }); } catch { throw new Error(`timed out waiting for: ${what}`); } };
  // A pause button may listen for the finger going down, so send that before the click.
  const tap = sel => page.evaluate(sel => { const el = document.querySelector(sel); el.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 9, pointerType: 'touch', bubbles: true, cancelable: true })); el.click(); }, sel);
  await page.goto(`${base}/${slug}/?labRunSource=agent`); await page.evaluate(LAB_LOCAL); await page.reload();
  await wait(hook => window[hook]?.().screen === 'menu', 'menu');
  assert.equal(await page.evaluate(() => window.audioLog?.made ?? 0), 0, 'no audio before a touch');
  await page.click('#play'); await wait(hook => window[hook]().screen !== 'menu', 'a run starts');
  await tap('#pause'); await wait(hook => window[hook]().paused === true, 'pause');
  await page.click(toMenu); await wait(hook => window[hook]().screen === 'menu', 'back on the menu');
  // The record is compressed before it is sent, so wait for it; then confirm no second run follows.
  for (let i = 0; i < 80 && !(labRuns(page, slug).length && labSent(page).some(r => r.game === slug && r.kind === 'events')); i++) await sleep(100);
  await sleep(300);
  const runs = labRuns(page, slug);
  assert.equal(labSent(page).filter(r => r.game === slug && r.kind === 'events').length, 1, 'one events record for the dashboard');
  assert.equal(runs.length, 1, 'one run sent'); assert.equal(runs[0].data.outcome, 'left'); assert.equal(runs[0].runSource, 'agent', 'labRunSource=agent marks the record');
}

const GAMES = {
  async kit(page) {
    await page.goto(`${base}/kit/`);
    await until(page, () => window.kitResults, 'self-test');
    const bad = (await page.evaluate(() => window.kitResults)).filter(r => !r.ok).map(r => r.name);
    assert.deepEqual(bad, [], 'kit self-test');
  },
  async lantern(page) {
    const ABILITY = ['boost', 'slow', 'size', 'magnet', 'flare', 'heart', 'shield'];
    const state = () => page.evaluate(() => window.lanternState());
    // Since note #112 a tap on an owned thing shows it on the whole screen; the button under its pack switches it.
    const pick = async (page, id) => { await page.click(`[data-item="${id}"]`); await page.click('#look'); await page.click(`[data-switch="${id}"]`); };
    const audioLog = () => page.evaluate(() => window.audioLog);
    const saved = () => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('lantern-')).map(k => [k, localStorage.getItem(k)])));
    // A save in the format players already have.
    await page.goto(`${base}/lantern/`);
    await page.evaluate(LAB_LOCAL);
    await page.evaluate(() => { localStorage.setItem('lantern-night', '3'); localStorage.setItem('lantern-bank', '120'); localStorage.setItem('lantern-owned', '["red"]'); localStorage.setItem('lantern-worn', '{"boat":"red"}'); localStorage.setItem('lantern-best-3', '40'); localStorage.setItem('lantern-best-endless', '55'); localStorage.setItem('lantern-best-tower', '4'); localStorage.setItem('lantern-stats', '{"red":1}'); localStorage.setItem('lantern-off', '[]'); localStorage.setItem('lantern-best-level', '0'); localStorage.setItem('lantern-tower-at', '1'); localStorage.setItem('lantern-rebirths', '0'); localStorage.setItem('lantern-crash', '[]'); localStorage.setItem('lantern-hint', '1'); localStorage.setItem('notes.k', 'check'); localStorage.removeItem('lantern-start'); }); // the first visit above wrote a new player's lantern-start; this save is from before that key
    await page.reload();
    // One drawing error must not freeze the game: the next frame is asked for before this one draws.
    page.context().badFrame = true; // the error below is meant, so it is not a page error
    const framesAfter = await page.evaluate(async () => {
      const C = CanvasRenderingContext2D.prototype, fill = C.fillRect; let thrown = false, n = 0;
      C.fillRect = function (...a) { if (!thrown) { thrown = true; throw new Error('lab check: one bad frame'); } return fill.apply(this, a); };
      for (let i = 0; i < 100 && !thrown; i++) await new Promise(done => setTimeout(done, 50)); C.fillRect = fill; // headless WebKit draws about two frames a second
      const raf = window.requestAnimationFrame; window.requestAnimationFrame = f => { n++; return raf(f); };
      for (let i = 0; i < 100 && !n; i++) await new Promise(done => setTimeout(done, 50)); window.requestAnimationFrame = raf; return thrown ? n : -1;
    });
    assert.ok(framesAfter > 0, `frames go on after a drawing error (${framesAfter})`);
    let st = await state();
    assert.equal(st.opened, 3, 'old save: opened night'); assert.equal(st.bank, 120, 'old save: bank'); assert.ok(st.owned.includes('red'), 'old save: owned'); assert.equal(st.worn.boat, 'red', 'old save: worn');
    assert.equal(await page.textContent('#play'), 'Play night 3'); assert.match(await page.textContent('#about'), /Best 40%/);
    assert.deepEqual(st.board.map(r => r.s), [55], 'old save: the endless best starts the leaderboard'); assert.deepEqual(st.winOn, []);
    assert.equal(st.start, 'boost', 'old save: a player from before lantern-start keeps Boost'); assert.ok(st.owned.includes('boost')); assert.equal((await saved())['lantern-start'], 'boost');
    await until(page, () => document.getElementById('notes-button'), 'notes button');
    await noZoomed(page);
    // Play, steer by a relative drag, and a tap alone does not steer.
    assert.equal((await audioLog()).made, 0, 'no audio before the first tap');
    await page.click('#play'); st = await state();
    assert.equal((await audioLog()).made, 1, 'Play starts audio');
    assert.ok(st.playing && st.screen === 'play', 'play starts');
    const x0 = st.target;
    await finger(page, '#c', [['pointerdown', 40, 400], ['pointerup', 40, 400]]);
    assert.equal((await state()).target, x0, 'a tap does not steer');
    await finger(page, '#c', [['pointerdown', 200, 400], ['pointermove', 230, 400]]);
    assert.ok((await state()).target > x0, 'a drag to the right steers right');
    await finger(page, '#c', [['pointerup', 230, 400]]);
    // Pause by the button, resume by the card; pause when the page loses the screen.
    await finger(page, '#pause', [['pointerdown', 0, 0]]);
    st = await state(); assert.ok(st.paused && st.screen === 'card', 'pause button pauses');
    assert.equal((await audioLog()).suspend, 1, 'pause silences audio');
    await sleep(300); assert.equal((await state()).t, st.t, 'time stands still while paused');
    await page.click('#go'); await until(page, () => !window.lanternState().paused, 'resume');
    const t1 = (await state()).t; await page.waitForFunction(t => window.lanternState().t > t, t1);
    await page.evaluate(() => dispatchEvent(new Event('blur')));
    assert.ok((await state()).paused, 'losing focus pauses');
    await page.keyboard.press('p'); assert.ok(!(await state()).paused, 'P resumes');
    await page.evaluate(() => dispatchEvent(new Event('pagehide'))); assert.ok((await state()).paused, 'putting the page away pauses'); await page.keyboard.press('Escape'); assert.ok(!(await state()).paused, 'Escape resumes');
    await dragNumbers(page); await finger(page, '#c', [['pointerup', 140, 400]]);
    assert.equal((await audioLog()).made, 1, 'one audio context for the whole run');
    // The run ends; its embers go to the bank and to storage.
    await page.evaluate(() => { const s = window.lanternSim(); s.taken = 7; s.hearts = 1; s.light = 0.0001; });
    await until(page, () => window.lanternState().screen === 'card' && !window.lanternState().playing, 'end card');
    st = await state(); assert.equal(st.bank, 127, 'embers banked'); assert.equal((await saved())['lantern-bank'], '127');
    // Shop: a pack costs 50 and gives one new thing, which is put on.
    await page.click('#toMenu'); await page.click('#toShop');
    await page.click('[data-pack="water"]'); st = await state();
    assert.equal(st.bank, 77, 'pack paid for'); assert.equal(st.owned.length, 6, 'pack gave one thing'); assert.notEqual(st.worn.water, 'blue', 'new thing is on');
    // Reload keeps all of it.
    await sleep(300); // let the purchase record leave before the reload
    const before = st; await page.reload(); st = await state();
    assert.equal(st.bank, before.bank); assert.deepEqual(st.owned.sort(), before.owned.sort()); assert.deepEqual(st.worn, before.worn); assert.equal(st.opened, 3);
    // Lab recording: the notice is on the menu, the ended run was sent with its outcome, the purchase rides with the next run.
    assert.match(await page.textContent('#menu'), /The game lab records play, links it to other lab play on this device, and keeps it for 180 days\. Turn recording off in the pause menu\. Privacy/);
    let runs = labRuns(page, 'lantern'); assert.equal(runs.length, 2, 'the run and the purchase sent');
    assert.equal(runs[0].data.outcome, 'dark'); assert.equal(runs[0].data.summary.embers, 7); assert.equal(runs[0].data.start.night, 3);
    assert.ok(labSent(page).some(r => r.game === 'lantern' && r.kind === 'events' && r.runId === runs[0].runId), 'events record for the dashboard');
    assert.ok(!runs[0].runSource, 'a person\'s run is not marked as an agent run');
    await page.click('#play'); await page.evaluate(() => { const s = window.lanternSim(); s.light = 0.0001; });
    await until(page, () => !window.lanternState().playing, 'second run ends'); await sleep(300);
    runs = labRuns(page, 'lantern'); assert.equal(runs.length, 3); assert.equal(runs[1].data.outcome, 'between-runs');
    assert.equal(runs[1].data.events[0].type, 'buy', 'purchase recorded'); assert.equal(runs[1].data.events[0].data.pack, 'water'); assert.equal(runs[2].data.outcome, 'dark');
    // The switch on the pause card turns recording off for this origin and drops the player id; nothing more is sent.
    await until(page, () => window.lanternState().screen === 'card', 'end card'); await page.click('#go');
    await finger(page, '#pause', [['pointerdown', 0, 0]]); await until(page, () => window.lanternState().paused, 'paused');
    await page.uncheck('.lab-toggle input');
    assert.equal(await page.evaluate(() => localStorage.getItem('hf-lab-recording-off')), '1'); assert.equal(await page.evaluate(() => localStorage.getItem('hf-lab-player')), null);
    await page.click('#go'); await page.evaluate(() => { window.lanternSim().light = 0.0001; }); await until(page, () => !window.lanternState().playing, 'third run ends'); await sleep(300);
    assert.equal(labRuns(page, 'lantern').length, 3, 'nothing is sent while recording is off');
    await page.reload(); await page.click('#play'); await finger(page, '#pause', [['pointerdown', 0, 0]]);
    assert.equal(await page.isChecked('.lab-toggle input'), false, 'the switch stays off after a reload');
    // Stats last one run (2026-11-23): bought for the next run, shown on the menu, used up when it starts. lantern-stats keeps its format.
    await page.click('#toMenu'); await page.click('#toShop');
    assert.match(await page.textContent('#packs'), /stats last one run/i, 'the shop warns that stats last one run');
    // Tester tools show only where the notes button is (a tester's browser).
    const bank0 = (await state()).bank; await page.click('[data-test="embers"]'); assert.equal((await state()).bank, bank0 + 500, 'tester tool adds embers');
    await page.click('[data-stat="hearts"]'); st = await state(); assert.equal(st.bank, bank0 + 500 - 15, 'a stat level costs 15'); assert.equal(JSON.parse((await saved())['lantern-stats']).hearts, 1);
    // An ability switched off stays owned and is kept out of the river; the choice is saved under lantern-off.
    await pick(page, 'boost'); assert.equal((await saved())['lantern-off'], '["boost"]'); assert.ok((await state()).owned.includes('boost'), 'switched off, still owned');
    await page.click('.back'); assert.match(await page.textContent('#ready'), /Hearts 1/, 'the menu shows the stats ready for the next run');
    // No stats on the endless river (notes #119 and #120): an endless run neither uses them nor spends them, and the shop and menu say so.
    assert.match(await page.textContent('#ready'), /Not for the endless river/); assert.match(await page.textContent('#packs'), /never work on the endless river/);
    await page.click('#toModes'); await page.click('#endless'); st = await state(); assert.ok(st.endless && st.playing); assert.equal(st.hearts, 1, 'no stats on the endless river');
    assert.equal(JSON.parse((await saved())['lantern-stats']).hearts, 1, 'the endless river does not spend stats');
    await page.evaluate(() => { const s = window.lanternSim(); s.t = -1; s.extra = 0; s.light = 0.0001; s.warm = 0; }); // a score of 0 stays off the leaderboard
    await until(page, () => window.lanternState().screen === 'card' && !window.lanternState().playing, 'endless run without stats ends'); await page.click('#toMenu');
    assert.match(await page.textContent('#ready'), /Hearts 1/, 'the stat still waits after an endless run');
    await page.click('#play'); st = await state(); assert.equal(st.hearts, 2, 'the stat is on for this run'); assert.ok(!st.on.includes('boost'), 'a switched-off ability is not in the river');
    assert.equal((await saved())['lantern-stats'], '{}', 'the stat is used up when the run starts');
    await page.evaluate(() => { window.lanternSim().light = 0.0001; }); await until(page, () => !window.lanternState().playing, 'stat run ends');
    await until(page, () => window.lanternState().screen === 'card', 'end card'); await page.click('#toMenu');
    assert.equal(await page.textContent('#ready'), '', 'no stats left after the run');
    // Tower of 50 levels (2026-11-23): after a level, climb on or stop; the best level is kept under lantern-best-level.
    // The next climb goes on where the last left off, saved under lantern-tower-at (note #73); a new climb from level 1 is one tap.
    await page.click('#toModes'); assert.equal(await page.isVisible('#tower'), true); assert.equal(await page.isVisible('#anew'), false); await page.click('#tower'); assert.equal((await state()).climb, 1, 'a first climb starts at level 1');
    await page.evaluate(() => { const s = window.lanternSim(); s.y = 77.9; s.safe = 99; }); await until(page, () => window.lanternState().screen === 'card', 'level card', 12000);
    assert.match(await page.textContent('#title'), /Level 1 cleared/); assert.equal(await page.textContent('#toMenu'), 'Stop'); assert.equal((await saved())['lantern-best-level'], '1'); assert.equal((await saved())['lantern-tower-at'], '2');
    await page.click('#go'); st = await state(); assert.equal(st.climb, 2, 'climb on goes to level 2'); assert.ok(st.playing);
    await page.evaluate(() => { window.lanternSim().light = 0.0001; }); await until(page, () => window.lanternState().screen === 'card', 'lost card');
    assert.match(await page.textContent('#line'), /Best 1 of 50\. Your climb goes on from level 2/); assert.equal(await page.textContent('#go'), 'Try level 2 again');
    await page.click('#go'); assert.equal((await state()).climb, 2, 'after a loss the level is tried again');
    await finger(page, '#pause', [['pointerdown', 0, 0]]); await page.click('#toMenu'); assert.match(await page.textContent('#tower'), /go on at level 2/);
    await page.click('#toModes'); await page.click('#tower'); assert.equal((await state()).climb, 2, 'the menu climb goes on at level 2');
    // A lost level is tried again three floors below the floor reached, saved under lantern-tower-floor (note #142).
    const fromFloor = () => page.evaluate(() => { const s = window.lanternSim(); return { floor: Math.floor(window.lanternState().progress * 10), clear: s.rocks.every(k => k.y0 > s.y + 1.5), climb: s.climb }; });
    await page.evaluate(() => { const s = window.lanternSim(); s.y = 7 * 7.8 + 0.5; s.rocks = []; s.next = s.y + 2; }); await sleep(300);
    await page.evaluate(() => { window.lanternSim().light = 0.0001; }); await until(page, () => window.lanternState().screen === 'card', 'lost card on floor 7');
    assert.match(await page.textContent('#line'), /goes on from level 2, floor 4: three floors below floor 7/); assert.equal(await page.textContent('#go'), 'Try again from floor 4'); assert.equal((await saved())['lantern-tower-floor'], '4');
    await page.click('#go'); assert.deepEqual(await fromFloor(), { floor: 4, clear: true, climb: 2 }, 'the try starts on floor 4 with open water ahead');
    await finger(page, '#pause', [['pointerdown', 0, 0]]); await page.click('#toMenu'); assert.match(await page.textContent('#tower'), /go on at level 2, floor 4/);
    await page.click('#toModes'); await page.click('#tower'); assert.deepEqual(await fromFloor(), { floor: 4, clear: true, climb: 2 }, 'the menu climb starts on floor 4 too');
    await finger(page, '#pause', [['pointerdown', 0, 0]]); await page.click('#toMenu');
    await page.click('#toModes'); await page.click('#anew'); assert.equal((await state()).screen, 'modes', 'one tap on new climb only asks'); assert.equal((await saved())['lantern-tower-at'], '2');
    await page.click('#anew'); assert.equal((await state()).climb, 1, 'a new climb starts at level 1'); assert.equal((await saved())['lantern-tower-at'], '1'); assert.equal((await saved())['lantern-tower-floor'], '0'); assert.equal((await fromFloor()).floor, 0, 'a new climb starts at the bottom');
    await finger(page, '#pause', [['pointerdown', 0, 0]]); await page.click('#toMenu'); await page.click('#toModes'); assert.equal(await page.isVisible('#anew'), false); await page.click('#modes .back');
    // Sector 2 (note #73): level 50 cleared opens 50 more levels, numbered 51 to 100 inside and shown as "sector 2, level N".
    await page.evaluate(() => { localStorage.setItem('lantern-tower-at', '50'); localStorage.setItem('lantern-tower-floor', '5'); }); await page.reload();
    await page.click('#toModes'); await page.click('#tower'); assert.equal((await state()).climb, 50);
    await page.evaluate(() => { const s = window.lanternSim(); s.y = 77.9; s.safe = 99; }); await until(page, () => window.lanternState().screen === 'card', 'sector card', 12000);
    assert.equal(await page.textContent('#title'), 'Sector 1 cleared'); assert.equal(await page.textContent('#go'), 'Climb on to sector 2'); assert.equal((await saved())['lantern-tower-floor'], '0', 'a cleared level clears the start floor');
    await page.click('#go'); assert.equal((await state()).climb, 51, 'sector 2 is climb 51');
    await page.evaluate(() => { window.lanternSim().light = 0.0001; }); await until(page, () => window.lanternState().screen === 'card', 'sector 2 lost card');
    assert.match(await page.textContent('#line'), /Best 50 of 50\. Your climb goes on from sector 2, level 1/);
    await page.click('#toMenu'); assert.match(await page.textContent('#tower'), /go on at sector 2, level 1/);
    await page.click('#toModes'); await page.click('#anew'); await page.click('#anew'); await finger(page, '#pause', [['pointerdown', 0, 0]]); await page.click('#toMenu');
    // 50 nights (note #73): the tester tool opens them all; night 50 is the last.
    await page.click('#toShop'); await page.click('[data-test="nights"]'); await page.click('.back');
    assert.equal(await page.textContent('#play'), 'Play night 50'); assert.match(await page.textContent('#about'), /This is the last night/);
    await page.click('#less'); assert.doesNotMatch(await page.textContent('#about'), /last night/);
    // Rebirth (note #73): a goal until everything is found and all 50 nights are open; then two taps start over with 25% more embers for good.
    await page.click('#toShop'); assert.equal(await page.isVisible('#rebirth'), false, 'no rebirth before everything is found'); assert.match(await page.textContent('#packs'), /Find everything \(\d+ of 35\)/);
    await page.click('[data-test="all"]'); await page.click('[data-test="nights"]');
    await page.click('#rebirth'); assert.equal((await state()).reborn, 0, 'one tap is not a rebirth'); await page.click('#rebirth');
    st = await state(); assert.equal(st.reborn, 1); assert.equal(st.bank, 0); assert.equal(st.opened, 1);
    // A rebirth starts with one ability at random (note #122), saved under lantern-start and not in lantern-owned.
    assert.ok(ABILITY.includes(st.start), 'a random first ability'); assert.deepEqual(st.owned.sort(), ['amber', 'blue', 'oak', st.start].sort()); assert.equal((await saved())['lantern-start'], st.start);
    assert.equal((await saved())['lantern-rebirths'], '1'); assert.equal((await saved())['lantern-owned'], '[]'); assert.equal((await saved())['lantern-night'], '1');
    await page.click('.back'); assert.match(await page.textContent('#stars'), /★/);
    // Reborn nights run faster and pay more at dawn (answer to question #79).
    assert.match(await page.textContent('#about'), /Reborn night: 6% faster, \+10 embers at dawn/);
    await page.click('#play'); assert.equal(await page.evaluate(() => window.lanternSim().hard), 1.06, 'a reborn night runs 6% faster');
    // The force field (answer to question #72): a blue pickup pushes a rock out of the way for a few seconds; no heart is lost.
    await page.evaluate(() => { const s = window.lanternSim(); s.embers.push({ x: s.x, y: s.y, got: false, kind: 'shield' }); });
    await until(page, () => window.lanternState().field > 3, 'the force field is on');
    const pushed = await page.evaluate(() => { const s = window.lanternSim(), k = { x: s.x, x0: s.x, y: s.y + 0.02, y0: s.y + 0.02, rad: 0.03, kind: '', len: 0, on: true, a: 0, w: 0, b: 0, wy: 0, ph: 0, phy: 0, vy: 0, ice: false, grazed: false }; s.rocks.push(k); window.__rock = k; return [s.hearts, k.x0]; });
    await sleep(500); const after = await page.evaluate(() => [window.lanternSim().hearts, window.__rock.x0, window.lanternState().playing]);
    assert.equal(after[0], pushed[0], 'no heart lost inside the field'); assert.ok(Math.abs(after[1] - pushed[1]) > 0.03, 'the rock was pushed aside'); assert.ok(after[2], 'still playing');
    await page.evaluate(() => { const s = window.lanternSim(); s.taken = 4; s.light = 0.0001; s.warm = 0; });
    await until(page, () => window.lanternState().screen === 'card' && !window.lanternState().playing, 'reborn run ends'); assert.equal((await state()).bank, 5, '4 embers bank as 5 after one rebirth');
    await page.click('#toMenu'); await page.evaluate(() => localStorage.setItem('lantern-owned', '["red"]')); await page.reload(); // the look check below wears the red canoe
    // Two abilities at a time and the crash pack (note #75). lantern-off and lantern-crash are JSON lists of ids.
    await page.click('#toShop'); await page.click('[data-test="all"]');
    const abilitiesOn = async () => { const s = await saved(), off = JSON.parse(s['lantern-off'] || '[]'); return ABILITY.filter(k => !off.includes(k)); };
    assert.equal((await abilitiesOn()).length, 2, 'finding every ability leaves two on');
    const offOne = (await page.evaluate(() => JSON.parse(localStorage.getItem("lantern-off"))))[0];
    await pick(page, offOne); assert.match(await page.textContent('#got'), /Only 2 abilities at a time/); assert.equal((await abilitiesOn()).length, 2);
    for (const id of ['burst', 'freeze', 'ghost']) await pick(page, id);
    await pick(page, 'bolt'); assert.match(await page.textContent('#got'), /Only 3 crashes at a time/); assert.deepEqual(JSON.parse((await saved())['lantern-crash']), ['burst', 'freeze', 'ghost']);
    await pick(page, 'ghost'); await pick(page, 'freeze'); assert.deepEqual(JSON.parse((await saved())['lantern-crash']), ['burst']);
    await page.click('.back'); await page.click('#play'); await page.evaluate(() => { const s = window.lanternSim(); s.hearts = 1; s.shield = 0; s.safe = 0; s.x = 5; });
    await until(page, () => window.lanternState().crash === 'burst', 'a crash plays the crash switched on');
    await until(page, () => window.lanternState().screen === 'card', 'crash card'); await page.click('#toMenu');
    // The victory pack (note #96): up to three on, and dawn plays one of them. lantern-win is a JSON list of ids.
    await page.click('#toShop');
    for (const id of ['vfire', 'vlamp', 'vbird']) await pick(page, id);
    await pick(page, 'vbow'); assert.match(await page.textContent('#got'), /Only 3 victories at a time/); assert.deepEqual(JSON.parse((await saved())['lantern-win']), ['vfire', 'vlamp', 'vbird']);
    await pick(page, 'vlamp'); await pick(page, 'vbird'); assert.deepEqual(JSON.parse((await saved())['lantern-win']), ['vfire']);
    await page.click('.back'); await page.click('#play'); await page.evaluate(() => { const s = window.lanternSim(); s.safe = 99; s.bonus = 1000; });
    await until(page, () => window.lanternState().win === 'vfire', 'dawn plays the victory switched on');
    await until(page, () => window.lanternState().screen === 'card', 'dawn card'); await page.click('#toMenu');
    // The leaderboard on this phone (note #96): a name, and an endless run that beats the best goes to the top. Nothing of it is sent.
    await sleep(400); await page.evaluate(() => localStorage.removeItem('hf-lab-recording-off')); await page.reload(); // recording back on, so the check below can see what is sent
    const sentBefore = labSent(page).length;
    // The shared board (workers/lab-ai) is played by a stand-in here. mode: ok answers, 401 and html are bad answers, hang never answers.
    const posts = [], starts = [], kept = new Map([['zed', { n: 'Zed', s: 99999 }]]); let mode = 'ok';
    const listed = () => [...kept.values()].sort((x, y) => y.s - x.s);
    await page.route('**/lab-api/board/lantern', async route => {
      const r = route.request();
      if (mode === 'hang') return;
      if (mode === '401') return route.fulfill({ status: 401, contentType: 'application/json', body: '{"rows":[{"n":"Bad","s":5}]}' });
      if (mode === 'html') return route.fulfill({ status: 200, contentType: 'text/html', body: '<html>not found</html>' });
      if (r.method() !== 'POST') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rows: listed() }) });
      const b = r.postDataJSON(); if (b.start) { starts.push(b); return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); }
      posts.push(b); if (b.remove) kept.delete(b.id); else kept.set(b.id, { n: b.n, s: Math.max(b.s, kept.get(b.id)?.s ?? 0) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ place: b.remove ? 0 : listed().indexOf(kept.get(b.id)) + 1, rows: listed() }) });
    });
    await page.click('#toBoard'); await until(page, () => window.lanternState().shared >= 0, 'the shared board answers'); await page.click('#tabPhone'); assert.equal(await page.isVisible('#name'), true); assert.match(await page.textContent('#rows'), /^1No name55/);
    await page.fill('#name', ' Rio <b>river</b>'); assert.equal((await saved())['lantern-name'], 'Rio <b>river</b', 'the name is trimmed and kept to 16 characters');
    await page.keyboard.press('p'); assert.equal((await state()).screen, 'board', 'typing P in the name does not pause or play');
    await page.click('#boardPlay'); assert.equal((await state()).endless, true);
    await page.evaluate(() => { const s = window.lanternSim(); s.extra = 900; s.light = 0.0001; s.warm = 0; });
    await until(page, () => window.lanternState().screen === 'card' && !window.lanternState().playing, 'endless run ends');
    assert.match(await page.textContent('#line'), /Number 1 on this phone's leaderboard/);
    st = await state(); assert.equal(st.board.length, 2); assert.equal(st.board[0].n, 'Rio <b>river</b'); assert.ok(st.board[0].s >= 900);
    assert.equal(await page.isVisible('#ask'), true, 'the card asks once about showing scores to everyone'); assert.equal(await page.inputValue('#askName'), 'Rio <b>river</b'); assert.equal((await saved())['lantern-share'], undefined, 'a name alone is not a yes');
    await page.click('#toMenu'); await page.click('#toBoard'); await until(page, () => window.lanternState().shared >= 0, 'the shared board answers'); await page.click('#tabPhone');
    assert.equal(await page.locator('#rows li.me .n').textContent(), 'Rio <b>river</b', 'the name is shown as text'); assert.equal(await page.locator('#rows b').count(), 0, 'no markup from the name');
    await sleep(300); const sent = labSent(page).slice(sentBefore); assert.ok(sent.some(r => r.kind === 'run' && r.data.summary?.score >= 900), 'the endless run was recorded');
    assert.ok(!JSON.stringify(sent).includes('Rio'), 'the name is not sent to the lab');
    // The shared board. That run sent nothing: sharing is off until the player says yes (note #155); the card asks once. Every bad answer leaves the phone's own board.
    assert.equal(posts.length, 0, 'no score is sent before the player says yes'); await page.click('#board .back');
    const openBoard = async () => { const n = (await state()).asked; await page.click('#toBoard'); await until(page, n => window.lanternState().asked > n, 'the shared board answered or was given up', 9000, n); };
    page.context().boardBad = true; // the bad answers below are meant, so their network errors are not page errors
    for (const m of ['401', 'html', 'hang']) {
      mode = m; await openBoard(); st = await state(); assert.equal(st.shared, -1, `${m}: no shared rows`); assert.equal(await page.isVisible('#tabs'), false, `${m}: no tabs`); assert.equal(await page.isVisible('#share'), false, `${m}: no tick`);
      assert.match(await page.textContent('#rows'), /Rio/, `${m}: the phone's board shows`); assert.match(await page.textContent('#boardHint'), /stay on this phone/); await page.click('#board .back');
    }
    mode = 'ok'; await openBoard(); assert.equal(await page.isVisible('#tabs'), true, 'tabs when the shared board answers'); assert.match(await page.textContent('#rows'), /Zed/, 'all players come first');
    // The daily board's stand-in (Today's river, below). Stopping sharing posts a removal to it too.
    const dposts = [], dstarts = [], dkept = new Map([['day', { n: 'Day', s: 77777 }]]), dlisted = () => [...dkept.values()].sort((x, y) => y.s - x.s);
    await page.route('**/lab-api/board/lantern-daily', async route => {
      const r = route.request(); if (r.method() !== 'POST') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rows: dlisted() }) });
      const b = r.postDataJSON(); if (b.start) { dstarts.push(b); return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); }
      dposts.push(b); if (b.remove) dkept.delete(b.id); else dkept.set(b.id, { n: b.n, s: Math.max(b.s, dkept.get(b.id)?.s ?? 0) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ place: b.remove ? 0 : dlisted().indexOf(dkept.get(b.id)) + 1, rows: dlisted() }) });
    });
    await page.click('#tabAll'); assert.match(await page.textContent('#rows'), /Zed99999/); assert.doesNotMatch(await page.textContent('#rows'), /Rio/); assert.match(await page.textContent('#shareNote'), /A tick sends your name and your score .* and a signal when a run starts/);
    // The yes sends nothing by itself. A score goes up with a run ticket: the page tells the server when a sharing player's endless run starts.
    assert.equal(starts.length, 0, 'no ticket is asked for before the yes');
    await page.check('#share'); await until(page, () => /from now on goes up by itself/.test(document.querySelector('#shareNote').textContent), 'the tick is kept'); await sleep(300);
    assert.equal(posts.length, 0, 'the yes sends no old score'); assert.equal(starts.length, 0); assert.equal((await saved())['lantern-share'], '1'); assert.equal(await page.isChecked('#share'), true);
    await page.click('#boardPlay'); await until(page, () => window.lanternState().playing, 'the run starts'); for (let i = 0; i < 40 && starts.length < 1; i++) await sleep(50);
    assert.equal(starts.length, 1, 'the run asks for a ticket'); assert.deepEqual(Object.keys(starts[0]).sort(), ['r', 'start']); assert.match(starts[0].r, /^[A-Za-z0-9-]{20,64}$/);
    await page.evaluate(() => { const s = window.lanternSim(); s.extra = 40; s.light = 0.0001; s.warm = 0; });
    await until(page, () => window.lanternState().screen === 'card' && !window.lanternState().playing, 'second endless run ends');
    await until(page, () => /of all players/.test(document.querySelector('#sub').textContent), 'the card says the place among all players'); await page.click('#toMenu');
    assert.equal(posts.length, 1, 'after one yes, a run is sent by itself'); assert.deepEqual(Object.keys(posts[0]).sort(), ['id', 'n', 'r', 's'], 'only the id, the name, the score and the run ticket are sent');
    assert.equal(posts[0].n, 'Rio <b>river</b'); assert.ok(posts[0].s < 900, 'the run, not the old best'); assert.match(posts[0].id, /^[A-Za-z0-9-]{20,64}$/); assert.equal(posts[0].r, starts[0].r); assert.notEqual(posts[0].r, posts[0].id);
    await openBoard(); await page.click('#tabAll'); assert.match(await page.textContent('#rows li.me'), /^2Rio/); assert.equal(await page.locator('#rows b').count(), 0, 'no markup from a shared name');
    await page.uncheck('#share'); for (let i = 0; i < 40 && posts.length < 2; i++) await sleep(50);
    assert.deepEqual(posts[1], { id: posts[0].id, remove: true }, 'stop sharing takes the row away'); assert.equal((await saved())['lantern-share'], ''); assert.equal((await saved())['lantern-board-id'], '');
    await until(page, () => !/Rio/.test(document.querySelector('#rows').textContent), 'the row is gone'); assert.ok(!JSON.stringify(labSent(page)).includes(posts[0].id), 'the board id is not sent to the lab');
    // A no is kept: the next run asks nothing and sends nothing. Yes on the card (a player who has not chosen) sends nothing yet: that run had no ticket.
    const endlessRun = async () => { await page.evaluate(() => { const s = window.lanternSim(); s.extra = 30; s.light = 0.0001; s.warm = 0; }); await until(page, () => window.lanternState().screen === 'card' && !window.lanternState().playing, 'an endless run ends'); };
    await page.click('#boardPlay'); await endlessRun(); await sleep(300); assert.equal(await page.isVisible('#ask'), false, 'no second question after a no'); assert.equal(posts.length, 2, 'nothing is sent after a no'); assert.equal(starts.length, 1, 'and no ticket is asked for'); await page.click('#toMenu');
    await page.evaluate(() => { localStorage.removeItem('lantern-share'); localStorage.removeItem('lantern-board-id'); localStorage.removeItem('lantern-name'); }); await page.reload();
    await page.click('#toModes'); await page.click('#endless'); await endlessRun(); assert.equal(await page.isVisible('#askYes'), true); await page.click('#askYes'); assert.match(await page.textContent('#askNote'), /Type a name first/); assert.equal(posts.length, 2, 'no name, nothing sent');
    await page.fill('#askName', 'Rio'); await page.click('#askYes'); await until(page, () => /Your next run goes up/.test(document.querySelector('#sub').textContent), 'the card says the next run goes up'); assert.equal(posts.length, 2); assert.equal(starts.length, 1); assert.equal(await page.isVisible('#ask'), false); assert.equal((await saved())['lantern-share'], '1');
    await page.click('#toMenu'); await openBoard(); await page.uncheck('#share'); for (let i = 0; i < 40 && posts.length < 3; i++) await sleep(50); assert.equal(posts.length, 3); await page.click('#board .back');
    await page.evaluate(() => localStorage.setItem('lantern-name', 'Rio <b>river</b')); // as the lines below expect
    // Today's river: the same seed for the whole UTC day, its own shared board, and nothing on the endless boards.
    const d0 = dposts.length; assert.ok(dposts.every(b => b.remove === true), 'only removals reached the daily board so far');
    const rows0 = (await state()).board.length, best0 = (await saved())['lantern-best-endless'], seedNow = () => page.evaluate(() => window.lanternSim().seed);
    await page.click('#toModes'); await page.click('#daily'); assert.equal((await state()).daily, true, 'daily on from the menu'); const seed1 = await seedNow(); await endlessRun();
    assert.match(await page.textContent('#line'), /Today's river: your best today is \d+/); assert.equal(dposts.length - d0 + dstarts.length, 0, 'not sharing: nothing is sent');
    const kept1 = JSON.parse((await saved())['lantern-daily']); assert.match(kept1.d, /^\d{4}-\d\d-\d\d$/); assert.ok(kept1.s >= 30);
    assert.equal((await state()).board.length, rows0, 'a daily run stays off the phone\'s endless board'); assert.equal((await saved())['lantern-best-endless'], best0);
    await page.click('#go'); assert.equal(await seedNow(), seed1, 'the same river again'); assert.equal((await state()).daily, true, 'daily kept on play again'); await endlessRun(); await page.click('#toMenu');
    await page.click('#toModes'); await page.click('#endless'); assert.notEqual(await seedNow(), seed1, 'the endless river is a new river'); assert.equal((await state()).daily, false);
    await page.evaluate(() => { const s = window.lanternSim(); s.t = -1; s.extra = 0; s.light = 0.0001; s.warm = 0; }); await until(page, () => window.lanternState().screen === 'card' && !window.lanternState().playing, 'a run of 0 ends'); await page.click('#toMenu'); // 0 stays off the board
    await openBoard(); await page.check('#share'); await page.click('#tabDay'); await until(page, () => /Day77777/.test(document.querySelector('#rows').textContent), 'today\'s board'); assert.match(await page.textContent('#boardHint'), /same river for every player/);
    const mainSent = posts.length; await page.click('#boardPlay'); assert.equal((await state()).daily, true, 'daily on from the Today tab'); assert.equal(await seedNow(), seed1); for (let i = 0; i < 40 && dstarts.length < 1; i++) await sleep(50);
    await endlessRun(); await until(page, () => /Number 2 today among all players/.test(document.querySelector('#sub').textContent), 'the place on today\'s board');
    assert.equal(dposts.length, d0 + 1); assert.equal(dposts[d0].r, dstarts[0].r); assert.equal(posts.length, mainSent, 'nothing goes to the endless board');
    await page.click('#toMenu'); await openBoard(); await page.uncheck('#share'); for (let i = 0; i < 40 && dposts.length < d0 + 2; i++) await sleep(50);
    assert.deepEqual(dposts[d0 + 1], { id: dposts[d0].id, remove: true }, 'stop sharing takes the row off today\'s board too'); await page.click('#board .back');
    await page.unroute('**/lab-api/board/lantern-daily');
    await page.unroute('**/lab-api/board/lantern');
    // The Music switch (the score from the lab's Lantern Song): on at first, kept when turned off, and the same switch on the menu and the card.
    assert.equal((await state()).music, true); assert.equal(await page.textContent('#menu button.music'), 'Music: on');
    await page.click('#menu button.music'); assert.equal((await state()).music, false); assert.equal((await saved())['lantern-music'], '0'); assert.equal(await page.textContent('#card button.music'), 'Music: off');
    await page.reload(); assert.equal((await state()).music, false, 'off is kept'); await page.click('#menu button.music'); assert.equal((await saved())['lantern-music'], '1'); assert.equal((await state()).music, true);
    await sleep(400); await page.reload(); st = await state(); assert.equal(st.name, 'Rio <b>river</b'); assert.equal(st.board.length, 5, 'the board is kept');
    await page.evaluate(() => localStorage.setItem('hf-lab-recording-off', '1')); await page.reload(); // recording off again, as the steps below expect
    // Views (notes #158, #159): 2D, 3D and first person, saved under lantern-view. First person steers by pressing a side; a drag does not.
    assert.equal((await state()).view, '2d', 'a save without lantern-view is 2D'); assert.equal((await saved())['lantern-view'], undefined);
    await page.route('**/view3d.js*', r => r.abort()); page.context().viewBad = true; await page.click('#toView'); await page.click('[data-view="3d"]'); await until(page, () => !document.querySelector('#perspective .viewNote').hidden, 'a failed 3D load says so'); assert.equal((await state()).view, '2d', 'no 3D: the river stays 2D'); await page.unroute('**/view3d.js*');
    await page.reload(); await page.click('#toView'); await page.click('[data-view="3d"]'); await until(page, () => window.lanternState().view === '3d' && window.lanternState().viewReady, '3D starts', 20000); assert.equal((await saved())['lantern-view'], '3d'); assert.equal(await page.isDisabled('[data-steer="tilt"]'), true, 'tilt is for first person'); await page.click('#perspective .back');
    await page.click('#play'); await page.evaluate(() => { const s = window.lanternSim(); s.safe = 60; s.light = 1; }); const v0 = (await state()).target;
    await finger(page, '#c', [['pointerdown', 200, 400], ['pointermove', 215, 400]]); assert.ok((await state()).target > v0, '3D steers by a drag'); await finger(page, '#c', [['pointerup', 215, 400]]);
    await finger(page, '#pause', [['pointerdown', 0, 0]]); assert.equal(await page.isVisible('#viewNext'), true, 'the pause card changes the view'); await page.click('#viewNext'); assert.equal((await state()).view, 'first'); assert.equal((await saved())['lantern-view'], 'first');
    await page.click('#go'); await page.evaluate(() => { const s = window.lanternSim(); s.safe = 60; s.light = 1; });
    for (const [x, sign] of [[40, -1], [340, 1]]) {
      await page.evaluate(() => { const s = window.lanternSim(); s.x = 0.5; s.rocks = []; s.safe = 60; }); await finger(page, '#c', [['pointerdown', x, 600]]);
      await until(page, g => Math.sign(window.lanternState().x - 0.5) === g && Math.abs(window.lanternState().x - 0.5) > 0.02, `a press steers (${sign})`, 8000, sign); await finger(page, '#c', [['pointerup', x, 600]]); await sleep(400);
    }
    await finger(page, '#c', [['pointerdown', 100, 600]]); await finger(page, '#c', [['pointermove', 300, 600]]); await until(page, () => window.lanternState().target < window.lanternState().x + 1e-6, 'a press that slides stays a press on the side it began'); await finger(page, '#c', [['pointerup', 300, 600]]);
    // Note #203: a short press is a small step, the boat stops when the finger lifts, a held press does not cross into the bank, and leaning the phone steers.
    const calm = () => page.evaluate(() => { const s = window.lanternSim(); s.rocks = []; s.safe = 0; s.light = 1; s.x = window.lanternCentre(); });
    const presses = await page.evaluate(() => window.lanternTicks([[8, 1], [30, 0]])); assert.ok(presses.step > 0.002 && presses.step < 0.05, `a short press is a small step (${presses.step})`); assert.ok(presses.last < 0.002, `the boat stops after the finger lifts (${presses.last})`);
    const held = await page.evaluate(() => window.lanternTicks([[240, 1]])); assert.equal(held.hearts, 0, 'a held press does not push the boat into the bank');
    // A phone that says no, then (after a reload) one that says yes.
    const answer = a => page.evaluate(a => { if (window.DeviceOrientationEvent) DeviceOrientationEvent.requestPermission = () => Promise.resolve(a); }, a);
    const lean = (gamma, beta = 45) => page.evaluate(([g, b]) => { for (let i = 0; i < 3; i++) dispatchEvent(Object.assign(new Event('deviceorientation'), { beta: b, gamma: g })); }, [gamma, beta]);
    await finger(page, '#pause', [['pointerdown', 0, 0]]); assert.equal(await page.isVisible('#card button.steer'), true, 'the pause card changes the steering'); await page.click('#card button.steer'); assert.equal((await saved())['lantern-steer'], 'press'); await page.click('#card button.steer'); assert.equal((await saved())['lantern-steer'], 'slide', 'sliding a finger is the third way (note #239)');
    await page.click('#go'); await until(page, () => !window.lanternState().paused, 'resume to slide'); { const to = await page.evaluate(() => { const s = window.lanternSim(), c = document.querySelector('#c'), ev = (type, x) => c.dispatchEvent(new PointerEvent(type, { pointerId: 6, pointerType: 'touch', clientX: x, clientY: 500, bubbles: true })); s.safe = 60; s.light = 1; s.hearts = 3; window.lanternTicks([[1, 0]]); const x = s.x; ev('pointerdown', 100); ev('pointermove', 160); const t = window.lanternState().target; ev('pointerup', 160); return t - x; }); assert.ok(to > 0.02, `a slide steers first person: ${to}`); }
    await finger(page, '#pause', [['pointerdown', 0, 0]]); await page.click('#card button.steer'); assert.equal((await saved())['lantern-steer'], 'tilt');
    await page.reload(); await until(page, () => window.lanternState().view === 'first', 'first person after a reload'); await answer('denied'); await page.click('#play'); await lean(25); assert.equal((await state()).tilting, false, 'no permission: no tilt');
    assert.ok((await page.evaluate(() => window.lanternTicks([[8, -1]]))).step > 0.002, 'no permission: pressing still steers');
    await page.reload(); await until(page, () => window.lanternState().view === 'first', 'first person after a reload'); await answer('granted'); await page.click('#play'); await until(page, () => window.lanternState().playing, 'play'); await page.evaluate(() => { window.lanternSim().safe = 60; }); await lean(0); await lean(0); assert.equal((await state()).tilting, true, 'readings turn tilt on');
    for (const sign of [-1, 1]) { await calm(); await lean(sign * 25); await until(page, g => { for (let i = 0; i < 2; i++) dispatchEvent(Object.assign(new Event('deviceorientation'), { beta: 45, gamma: g * 25 })); return Math.sign(window.lanternState().slide) === g; }, `leaning steers (${sign})`, 8000, sign); }
    await until(page, () => { dispatchEvent(Object.assign(new Event('deviceorientation'), { beta: 45, gamma: 0 })); return window.lanternState().slide === 0; }, 'level stops the boat');
    await sleep(1700); assert.equal((await state()).tilting, false, 'no readings: pressing steers again');
    await page.reload(); await until(page, () => window.lanternState().view === 'first', 'the view is kept'); await page.click('#toView'); await page.click('[data-view="2d"]'); assert.equal((await state()).view, '2d'); await page.click('#perspective .back');
    // A look on the whole screen (notes #73 and #112): tapping an owned boat shows it and hides every button; a tap brings the shop back,
    // and the button under the pack wears it.
    await page.click('#toShop'); await page.click('[data-item="red"]'); st = await state();
    assert.equal(st.looking, 'boat'); assert.equal(st.peek, 'red'); assert.equal(st.worn.boat, 'oak', 'showing a boat does not wear it'); assert.equal(await page.isVisible('#shop'), false, 'the shop hides'); assert.equal(await page.isVisible('#notes-button'), false, 'the notes button hides');
    const y0 = (await state()).y; await page.waitForFunction(y => window.lanternSim().y > y + 0.05, y0);
    await page.click('#look'); st = await state(); assert.equal(st.looking, ''); assert.equal(st.screen, 'shop'); assert.equal(await page.isVisible('#shop'), true, 'the shop comes back');
    await page.click('[data-switch="red"]'); assert.equal((await state()).worn.boat, 'red', 'Use it wears the boat'); assert.equal(await page.isDisabled('[data-switch="red"]'), true);
    // Crashes, victories and abilities play on the whole screen (note #112), over and over, change nothing and send nothing.
    for (const [id, field] of [['bolt', 'crash'], ['vbow', 'win']]) {
      const before = await saved(); await page.locator(`[data-item="${id}"]`).scrollIntoViewIfNeeded(); const top = await page.evaluate(() => document.querySelector('#shop > div').scrollTop);
      await page.click(`[data-item="${id}"]`); assert.equal(await page.isVisible('#shop'), false);
      await until(page, x => window.lanternState()[x[1]] === x[0], `${id} plays in the shop`, 4000, [id, field]);
      await until(page, x => window.lanternState()[x[1]] !== x[0], `${id} ends`, 5000, [id, field]); await until(page, x => window.lanternState()[x[1]] === x[0], `${id} plays again`, 5000, [id, field]);
      await page.click('#look'); st = await state(); assert.equal(st.crash, null, 'no wreck is left after a look'); assert.equal(st.win, null);
      assert.deepEqual(await saved(), before, 'showing changes no save'); assert.ok(Math.abs(await page.evaluate(() => document.querySelector('#shop > div').scrollTop) - top) < 2, 'the shop comes back where it was');
    }
    // Each ability is shown doing its work (note #123): staged on a short real river, by the clock. Nothing is saved or sent.
    const saves0 = await saved(), sent0 = labSent(page).length;
    for (const [id, done, what] of [
      ['boost', () => window.lanternSim().boost > 0 && window.lanternSim().y > 2.1, 'boost: taken, and the boat passes the rock in its path'],
      ['slow', () => window.lanternSim().slow > 0, 'slow water taken'],
      ['size', () => window.lanternSim().size > 0 && !window.lanternSim().big, 'a smaller boat'],
      ['magnet', () => window.lanternSim().taken >= 3, 'the magnet pulls embers that were out of reach'],
      ['flare', () => window.lanternSim().flare > 0 && window.lanternSim().light === 1, 'the flare fills a low flame'],
      ['shield', () => window.lanternSim().rocks.some(k => k.pushed), 'the force field pushes a rock aside'],
      ['heart', () => window.__hearts2 && window.lanternSim().hearts === 1 && !window.lanternSim().over, 'the heart is taken, then takes the hit'],
    ]) {
      await page.evaluate(() => { window.__hearts2 = false; });
      await page.locator(`[data-item="${id}"]`).scrollIntoViewIfNeeded(); await page.click(`[data-item="${id}"]`);
      assert.equal((await state()).scene, id); if (id === 'flare') assert.ok((await state()).light < 0.3, 'the flare starts on a low flame');
      if (id === 'heart') await until(page, () => (window.__hearts2 = window.__hearts2 || window.lanternSim().hearts === 2), 'the heart is taken', 6000);
      await until(page, done, what, 8000); await page.click('#look');
    }
    assert.deepEqual(await saved(), saves0, 'showing an ability changes no save'); assert.equal(labSent(page).length, sent0, 'showing an ability sends nothing');
    // Erase everything (note #73, tester tools): two taps; every lantern- key goes and nothing else.
    await page.click('[data-test="reset"]'); assert.ok(Object.keys(await saved()).length > 3, 'one tap erases nothing');
    await Promise.all([page.waitForEvent('load'), page.click('[data-test="reset"]')]);
    const fresh = await saved(); assert.deepEqual(Object.keys(fresh), ['lantern-start'], 'every lantern- key is gone; a new player gets a first ability');
    assert.ok(ABILITY.includes(fresh['lantern-start'])); assert.ok((await state()).owned.includes(fresh['lantern-start']), 'a new player owns the first ability'); assert.equal(await page.evaluate(() => localStorage.getItem('notes.k')), 'check', 'the tester link stays');
    st = await state(); assert.equal(st.bank, 0); assert.equal(st.opened, 1);
    // Turkish: ?lang=tr draws the menu in Turkish; the globe button brings English back without a reload.
    await page.goto(`${base}/lantern/?lang=tr`);
    await until(page, () => document.querySelector('#menu h1').textContent === 'Fener', 'the Turkish menu');
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'tr');
    assert.equal(await page.textContent('#toShop b'), 'Mağaza'); assert.equal(await page.textContent('#toBoard'), 'Sıralama');
    await page.click('#toModes'); assert.deepEqual(await page.$$eval('#modes a.mode', as => as.map(a => a.getAttribute('href'))), ['/lab/lantern-race/', '/lab/lantern-spark/'], 'the other modes are one tap away'); await page.click('#modes .back');
    await page.click('#menuLanguage');
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'en');
    assert.equal(await page.textContent('#menu h1'), 'Lantern'); assert.equal(await page.textContent('#toShop b'), 'Shop');
    // The tutorial (note #236): offered once on a fresh save, always under "How to play"; it pays, scores and unlocks nothing.
    { const kept = await saved(); await page.click('#toTutor'); assert.equal((await state()).tutor, 0, 'How to play starts the tutorial'); await until(page, () => /steer/.test(document.querySelector('#tip').textContent), 'the first step says how to steer');
      await page.evaluate(() => { const s = window.lanternSim(); s.hearts = 1; s.light = 0.0001; }); await sleep(600); assert.equal((await state()).playing, true, 'nobody loses in the tutorial');
      await finger(page, '#pause', [['pointerdown', 0, 0]]); await page.click('#toMenu'); assert.equal((await state()).tutor, -1); const now = await saved(); for (const k of ['lantern-bank', 'lantern-night', 'lantern-best-1', 'lantern-stats']) assert.equal(now[k], kept[k], k + ' is untouched by the tutorial');
      await page.evaluate(() => { for (const k of ['lantern-bank', 'lantern-night', 'lantern-tutorial']) localStorage.removeItem(k); }); await page.reload(); await page.click('#play'); assert.equal((await state()).screen, 'tutor', 'a first-time player is asked'); await page.click('#tutorNo'); assert.equal((await state()).playing, true, 'skip plays at once'); assert.equal((await saved())['lantern-tutorial'], '1');
      await page.reload(); await page.click('#play'); assert.equal((await state()).playing, true, 'asked only once'); await page.evaluate(k => { localStorage.clear(); for (const [a, b] of Object.entries(k)) localStorage.setItem(a, b); }, kept); await page.reload(); }
    await page.evaluate(() => localStorage.removeItem('kit:lang'));
  },
  async 'ant-promotion'(page) {
    const KEY = 'ant-promotion:v1';
    const mode = () => page.evaluate(() => window.__ant.mode);
    const saved = () => page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
    await page.goto(`${base}/ant-promotion/?labRunSource=agent`);
    await until(page, () => window.__ant, 'game script');
    await page.evaluate(LAB_LOCAL);
    // A save in the format players already have: a level-2 animal, a skin, the soft look.
    const stack = await page.evaluate(() => { const F = window.__ant.FORMS; return [F.findIndex(f => f && f.level === 1), F.findIndex(f => f && f.level === 2)]; });
    await page.evaluate(([k, stack]) => { localStorage.setItem(k, JSON.stringify({ skin: { c: '#c0271f', p: 'stripes' }, stack, xp: 3, sound: true, look: 2 })); localStorage.setItem('ant-promotion:hint', '1'); localStorage.setItem('notes.k', 'check'); }, [KEY, stack]);
    await page.reload(); await until(page, () => window.__ant, 'game script');
    assert.match(await page.textContent('#continue'), /^Continue as /, 'old save: continues'); assert.equal(await page.textContent('#rules'), 'Rules: Wild', 'Wild is the default (note #88)'); assert.equal(await page.textContent('#look'), 'Look: Soft', 'old save: look 2 is still Soft');
    await until(page, () => document.getElementById('notes-button'), 'notes button');
    await noZoomed(page);
    assert.equal(await page.evaluate(() => window.audioLog.made), 0, 'no audio before the first tap');
    assert.notEqual(await page.evaluate(() => navigator.audioSession.type), 'playback', 'no audio session is asked for before the first tap');
    await page.click('#continue'); assert.equal(await mode(), 'play');
    assert.equal(await page.evaluate(() => window.audioLog.made), 1, 'Play starts audio');
    assert.equal(await page.evaluate(() => navigator.audioSession.type), 'playback', 'sound plays through the iPhone silent switch (note #80)');
    assert.equal(await page.evaluate(() => window.__ant.level(window.__ant.s)), 2, 'old save: level'); assert.equal(await page.evaluate(() => window.__ant.s.player.xp), 3, 'old save: xp');
    await stickNumbers(page);
    // Walk by dragging.
    const x0 = await page.evaluate(() => window.__ant.s.player.x);
    await finger(page, '#c', [['pointerdown', 150, 400], ['pointermove', 215, 400]]);
    await page.waitForFunction(x => window.__ant.s.player.x > x + 5, x0);
    await finger(page, '#c', [['pointerup', 215, 400]]);
    // Food arrow (note #89): with no food on the screen a green arrow points to the nearest; with food in view there is none.
    await page.evaluate(() => { const { s, powerOf, me } = window.__ant, p = s.player; s.mobs.filter(m => powerOf(m) < me(s).power).forEach((m, i) => { m.x = p.x + 700 + i * 40; m.y = p.y; }); });
    await until(page, () => window.__ant.arrowTo !== null, 'green food arrow');
    assert.ok(await page.evaluate(() => { const { s, powerOf, me, arrowTo } = window.__ant, m = s.mobs.find(m => m.id === arrowTo); return m && powerOf(m) < me(s).power; }), 'the arrow points to food');
    await page.evaluate(() => { const { s, arrowTo } = window.__ant, m = s.mobs.find(m => m.id === arrowTo); m.x = s.player.x + 40; m.y = s.player.y; }); // the food the arrow points at now
    await until(page, () => window.__ant.arrowTo === null, 'no arrow with food in view');
    // Pause by the button, by P, and when the page is hidden.
    await page.click('#pause'); assert.equal(await mode(), 'paused');
    const t0 = await page.evaluate(() => window.__ant.s.t); await sleep(300); assert.equal(await page.evaluate(() => window.__ant.s.t), t0, 'time stands still while paused');
    await page.click('#resume'); assert.equal(await mode(), 'play');
    await page.keyboard.press('p'); assert.equal(await mode(), 'paused'); await page.keyboard.press('p'); assert.equal(await mode(), 'play');
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); delete document.hidden; });
    assert.equal(await mode(), 'paused', 'hiding the page pauses'); await page.click('#resume');
    await page.evaluate(() => dispatchEvent(new Event('blur'))); assert.equal(await mode(), 'paused', 'losing focus pauses'); await page.keyboard.press('P'); assert.equal(await mode(), 'play', 'capital P resumes');
    // Death costs one level and is saved at once.
    await page.evaluate(() => { const { s, FORMS, me } = window.__ant, p = s.player, m = s.mobs.find(m => FORMS[m.f].power > me(s).power); p.safe = 0; p.hideAt = 1e9; p.x = m.x; p.y = m.y; }); // no Wild hide
    await until(page, () => window.__ant.mode === 'dead', 'death card');
    assert.equal((await saved()).stack.length, 1, 'death saved');
    await page.click('#goOn'); assert.equal(await mode(), 'play');
    await page.click('#pause'); await page.click('#paused .toMenu'); assert.equal(await mode(), 'menu');
    // The animal book says how each animal you have been sees (note #148), and no message from play shows through it.
    await page.click('#toBook'); assert.match(await page.textContent('#pages'), /Sees: /, 'the book says how an animal sees'); assert.ok(!await page.evaluate(() => document.getElementById('say').classList.contains('on')), 'no play message over the book'); await page.click('#book .back');
    // Skin and sound choices are kept.
    await page.click('#toSkins'); await page.click('#colours button:nth-child(4)'); await page.click('#skins .back');
    const sound = await page.textContent('#sound'); await page.click('#sound'); assert.notEqual(await page.textContent('#sound'), sound);
    const before = await saved(); assert.equal(before.skin.c, '#d6b21c'); assert.equal(before.sound, false); assert.equal(before.look, 2);
    await page.reload(); await until(page, () => window.__ant, 'game script');
    assert.deepEqual(await saved(), before); assert.equal(await page.textContent('#sound'), 'Sound: off');
    await page.click('#continue'); await page.click('#pause'); assert.equal(await page.evaluate(() => window.audioLog.made), 0, 'sound off: no audio is started');
    // Lab recording: a death ends a life with its outcome; leaving for the menu ends the next one; an agent run is marked.
    const runs = labRuns(page, 'ant-promotion');
    assert.deepEqual(runs.map(r => r.data.outcome), ['died', 'menu', 'between-runs'], 'two lives and a skin choice sent');
    assert.equal(runs[0].data.summary.level, 2); assert.equal(runs[0].data.start.how, 'continue');
    assert.ok(runs.every(r => r.runSource === 'agent'), 'labRunSource=agent marks the records');
    assert.deepEqual(runs[2].data.events[0].data, { c: '#d6b21c', p: 'stripes' }, 'the skin choice');
    // A promotion sends a beam of light up into the sky (note #101).
    await page.click('#resume'); assert.equal(await page.evaluate(() => window.__ant.beam), 0, 'no beam before a promotion');
    await page.evaluate(() => { window.__ant.s.player.xp = 999; });
    await until(page, () => window.__ant.mode === 'evolve', 'promotion card');
    await page.click('#opts .opt'); assert.equal(await mode(), 'play');
    assert.ok(await page.evaluate(() => window.__ant.beam) > 0.5, 'a promotion starts the light beam');
    await page.evaluate(() => { window.__ant.s.player.safe = 99; }); // nothing may eat the player while the beam plays out
    await until(page, () => window.__ant.beam < 0.9, 'the beam fades', 8000); assert.equal(await mode(), 'play'); // headless WebKit draws few frames, so only the start of the fade is waited for
    // Old top animals come back as hunters (note #201): a climb to the top, then an Ant again. A save without `old`, or with a bad one, plays on.
    assert.deepEqual(await page.evaluate(() => window.__ant.save.old), [], 'a save from before has no old animals');
    if (await mode() !== 'menu') { if (await mode() === 'play') await page.click('#pause'); await page.click('.screen.on .toMenu'); } // the menu: leaving the page now saves nothing over what is set here
    const kept = await page.evaluate(k => localStorage.getItem(k), KEY);
    const ladder = await page.evaluate(() => { const st = [3]; while (st.length < 18) st.push(window.__ant.FORMS.find(f => f.level === st.length + 1).id); return st; });
    await page.evaluate(([k, st]) => localStorage.setItem(k, JSON.stringify({ skin: { c: '#3a2a22', p: 'plain' }, stack: st, xp: 0, sound: true, look: 1, wild: false, old: 'junk' })), [KEY, ladder]);
    await page.reload(); await page.click('#continue');
    await page.evaluate(() => { window.__ant.s.player.safe = 9; window.__ant.s.player.xp = 999; }); await until(page, () => window.__ant.mode === 'win', 'the winning card'); await page.click('#winNew');
    assert.deepEqual(await page.evaluate(() => [window.__ant.level(window.__ant.s), window.__ant.save.old, window.__ant.s.mobs.filter(m => m.old).map(m => m.f)]), [1, ladder.slice(-3), ladder.slice(-3)], 'the top three come back');
    await page.evaluate(() => { window.__ant.s.player.safe = 0; window.__ant.s.oldAt = window.__ant.s.t + 0.05; }); await until(page, () => (window.__ant.s.oldHunts || 0) > 0, 'one of them hunts');
    await page.evaluate(() => { const s = window.__ant.s, m = s.mobs.find(o => o.old); Object.assign(m, { x: s.player.x + 130, y: s.player.y, a: Math.PI, hunt: 6, alert: true, skillCd: 0, tire: 0 }); s.mobs = [m]; s.player.safe = 0; }); await until(page, () => (window.__ant.s.oldSkills || 0) > 0, 'it uses its skill');
    await page.click('#pause'); await page.click('#paused .toMenu'); await page.reload(); assert.equal(await page.evaluate(() => window.__ant.save.old.length), 3, 'they are kept in the save');
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, kept]); await page.reload(); await page.click('#continue');
    // The Living look (look 4, from the lab page ant-creatures): chosen with the Look button, every animal on a rig; a death
    // and going on in it; then the button goes round to the look the player had, and the save keeps it.
    const lookWas = (await saved()).look, toMenu = async () => { if (await mode() === 'play') await page.click('#pause'); await page.click('.screen.on .toMenu'); assert.equal(await mode(), 'menu'); };
    const lookTo = async want => { for (let i = 0; i < 6 && await page.textContent('#look') !== `Look: ${want}`; i++) await page.click('#look'); assert.equal(await page.textContent('#look'), `Look: ${want}`); };
    await toMenu(); await lookTo('Living'); assert.equal((await saved()).look, 4, 'Living is saved as look 4');
    await page.click('#continue'); assert.equal(await mode(), 'play');
    await until(page, () => window.__ant.living && window.__ant.living.stat.drawn > 3 && window.__ant.living.rig(null), 'living bodies drawn');
    await page.evaluate(() => { const { s, FORMS, me } = window.__ant, p = s.player, m = s.mobs.find(m => FORMS[m.f].power > me(s).power); p.safe = 0; p.hideAt = 1e9; p.x = m.x; p.y = m.y; });
    await until(page, () => window.__ant.mode === 'dead', 'death card in Living');
    await page.click('#goOn'); assert.equal(await mode(), 'play');
    await until(page, () => window.__ant.living && window.__ant.living.stat.drawn > 3 && window.__ant.living.rig(null), 'living bodies after a death');
    await toMenu(); await lookTo(['Flat', 'Cartoon', 'Soft', '3D', 'Living'][lookWas]); assert.equal((await saved()).look, lookWas, 'the look goes back round');
    await page.click('#continue'); assert.equal(await page.evaluate(() => window.__ant.living), null, 'no rigs in the other looks');
  },
  // The three games of 2026-11-23. Each has its own full check (experiments/<slug>/check.mjs); this is the shared part:
  // the page loads through the kit with no error, a run starts from Play, pause holds it, and leaving for the menu
  // sends one lab record marked as an agent run. Run a game's own check after changing that game.
  grapevine: page => started(page, 'grapevine', 'grapevineState', '#toMenu'),
  ducklings: page => started(page, 'ducklings', 'ducklingsState', '#pauseMenu'),
  async fixit(page) {
    await started(page, 'fixit', 'fixitState', '#quit');
    // A friend's link: the race is offered, won and lost, offers a link of its own, and saves nothing for a level not opened yet.
    const link = await page.evaluate(async () => { const L = await import('./levels.js'), n = L.levelDef(8).goal.fix; return L.raceText(8, Array.from({ length: n }, (_, i) => (i + 1) * 4)); });
    const race = async lang => {
      await page.goto(`${base}/fixit/?labRunSource=agent&lang=${lang}&race=${link}`); await until(page, () => window.fixitState && document.querySelector('#raceFriend') && !document.querySelector('#raceFriend').hidden, 'the race is on the menu');
      await page.evaluate(() => { window.copied = ''; Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); Object.defineProperty(navigator, 'clipboard', { value: { writeText: async t => { window.copied = t; } }, configurable: true }); });
      await page.click('#raceFriend'); await until(page, () => window.fixitState().level === 8 && window.fixitState().card, 'the goal card of the race'); await page.click('#startLevel');
    };
    const levels = () => page.evaluate(() => JSON.stringify(Object.entries(localStorage).filter(([k]) => k.startsWith('fixit')).map(([, v]) => { try { return JSON.parse(v).levels; } catch { return null; } })));
    await race('en'); const before = await levels();
    await page.evaluate(() => { const s = window.fixitSim(); s.served = s.lv.goal.fix - 1; s.times = Array.from({ length: s.served }, (_, i) => (i + 1) * 0.5); s.clock = 10; Object.defineProperty(s.rep, 'p', { get: () => 1, set() {} }); });
    await until(page, () => window.fixitState().screen === 'end', 'the race is won'); assert.equal(await page.textContent('#endTitle'), 'You beat your friend!'); assert.equal(await levels(), before, 'a race on a level not opened yet saves no stars');
    await page.click('#challenge'); await until(page, () => window.copied, 'the challenge is copied');
    const mine = await page.evaluate(async () => { const L = await import('./levels.js'); return [window.copied, L.raceFrom(new URL(window.copied).searchParams.get('race'))]; }); assert.equal(mine[1].n, 8); assert.ok(Math.abs(mine[1].times.at(-1) - 10) < 0.3, 'the link carries this run');
    await race('tr'); await page.evaluate(() => { window.fixitSim().clock = window.fixitSim().rival.ghost.at(-1); });
    await until(page, () => window.fixitState().screen === 'end', 'the race is lost'); assert.equal(await page.textContent('#endTitle'), 'Arkadaşın daha hızlıydı'); assert.ok(await page.isHidden('#raceRow'), 'a lost race offers no link');
    await page.goto(`${base}/fixit/?labRunSource=agent&lang=en&race=8.nonsense`); await until(page, () => window.fixitState, 'a broken link'); assert.ok(await page.isHidden('#raceFriend'), 'a broken link is ignored');
    // the rival of a race level: it hurries when the player leads, makes mistakes, and stands on the bar
    await page.goto(`${base}/fixit/?labRunSource=agent&lang=en&level=8`); await page.click('#play'); await page.click('#startLevel'); await page.evaluate(() => { window.fixitSim().served = 5; });
    await until(page, () => window.fixitSim().rival.hurry, 'the rival speeds up'); await page.evaluate(() => { const s = window.fixitSim(); s.rival.next = s.clock; }); await until(page, () => window.fixitSim().rival.gag, 'it makes a mistake');
  },
  borrowed: page => started(page, 'borrowed', 'borrowedState', '#toMenu'),
  alibi: page => started(page, 'alibi', 'alibiState', '#toMenu'),
  nightshift: page => started(page, 'nightshift', 'nightshiftState', '#toMenu'),
  // Lab pages (/lab/<name>/): an old save survives, a finger steers, pause stops time, one audio context after the first tap.
  async 'lab/thankful'(page) {
    const KEY = 'thankful:v1';
    await page.goto(`${base}/lab/thankful/?day=2026-11-23`); await until(page, () => window.__thankful, 'game script');
    await page.evaluate(k => localStorage.setItem(k, JSON.stringify({ v: 1, days: { '2026-11-21': [{ k: 'bread' }, { k: 'water' }], '2026-11-22': [{ k: 'home' }, { k: 'family' }, { k: 'friend' }] }, look: 'sky', sound: true })), KEY);
    await page.reload(); await until(page, () => window.__thankful?.lights.length === 5, 'five old lights');
    assert.equal(await page.evaluate(() => window.__thankful.lights.length), 5, 'old save: five lights survive reload');
    assert.equal(await page.evaluate(() => window.audioLog.made), 0, 'no audio before the first tap');
    await page.click('[data-kind="bread"]');
    assert.equal(await page.evaluate(() => window.audioLog.made), 1, 'first tap starts audio');
    await page.click('[data-kind="water"]'); await page.click('[data-kind="home"]');
    assert.equal(await page.textContent('#line'), 'Today is in your sky.', 'three taps finish today');
    assert.equal(await page.evaluate(() => window.__thankful.state.days['2026-11-23'].length), 3, 'today has three lights');
    assert.equal(await page.evaluate(() => window.__thankful.give('friend')), false, 'a fourth thanks is refused');
    assert.equal(await page.evaluate(() => window.__thankful.state.days['2026-11-23'].length), 3, 'the fourth thanks did not change today');
    const picture = await page.evaluate(() => window.__thankful.picture());
    assert.equal(picture.width, 1080); assert.equal(picture.height, 1350); assert.ok(picture.bytes > 20000, 'picture has PNG image data');
  },
  async 'lab/pitch'(page) {
    // Paper Pitch: an old save survives, a tap on a pulsing point draws a line, leaving the page pauses.
    await page.goto(`${base}/notes/button.js`); await page.evaluate(() => { localStorage.clear(); localStorage.setItem('pitch:v1', '{"played":1,"level":1,"lossStreak":0,"wins":1,"sound":true,"daily":{}}'); localStorage.setItem('pitch:hint', '1'); });
    await page.goto(`${base}/lab/pitch/`); await until(page, () => window.__pitch?.ready, 'game script');
    const kept = await page.evaluate(() => window.__pitch.save());
    assert.equal(kept.played, 1, 'old save: games played survive'); assert.equal(kept.wins, 1, 'old save: wins survive'); assert.equal(kept.level, 1, 'old save: level survives');
    await page.click('#play'); await until(page, () => window.__pitch.canTap, 'the player may move');
    const at = await page.evaluate(() => window.__pitch.legal[0]);
    await page.mouse.click(at.sx, at.sy); await until(page, () => window.__pitch.segments > 0, 'a tap on a legal point draws a line');
    await page.evaluate(() => dispatchEvent(new Event('blur'))); await until(page, () => window.__pitch.paused, 'leaving the page pauses');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no sideways scroll');
  },
  async 'lab/ring'(page) {
    // Firefly Ring: an old save survives, a dragged finger lays thread, leaving the page pauses.
    await page.goto(`${base}/notes/button.js`); await page.evaluate(() => { localStorage.clear(); localStorage.setItem('ring:v1', '{"v":1,"sound":true,"nights":2,"dawns":1,"best":412,"bestRing":16,"endless":false,"endlessBest":0,"daily":{}}'); localStorage.setItem('ring:hint', '1'); });
    await page.goto(`${base}/lab/ring/`); await until(page, () => window.__ring, 'game script');
    const kept = await page.evaluate(() => window.__ring.save());
    assert.equal(kept.best, 412, 'old save: best score survives'); assert.equal(kept.nights, 2, 'old save: nights survive'); assert.equal(kept.bestRing, 16, 'old save: best ring survives');
    await page.click('#play'); await until(page, () => window.__ring.phase === 'play', 'the night is in play', 8000);
    const box = await page.evaluate(() => { const r = document.getElementById('c').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height * 0.6 }; });
    await page.mouse.move(box.x, box.y); await page.mouse.down(); await page.mouse.move(box.x + 60, box.y + 20, { steps: 8 });
    await until(page, () => window.__ring.threadPoints > 0, 'a dragged finger lays thread'); await page.mouse.up();
    await page.evaluate(() => dispatchEvent(new Event('blur'))); await until(page, () => window.__ring.mode !== 'play', 'leaving the page pauses');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no sideways scroll');
  },
  // The first-time help (kit/hint.js) on each page that uses it.
  'hint ant-promotion': page => hinted(page, { path: '/ant-promotion/', play: '#continue', resume: '#resume', key: 'ant-promotion:hint', delay: 3000, moved: () => window.__ant.input.x > 0, legacy: { 'ant-promotion:v1': '{"skin":{"c":"#c0271f","p":"stripes"},"xp":0,"sound":true,"look":2}' } }),
  'hint lantern': page => hinted(page, { path: '/lantern/', play: '#play', resume: '#go', key: 'lantern-hint', seed: { 'lantern-tutorial': '1' }, delay: 1500, before: () => window.lanternState().target, moved: t => window.lanternState().target !== t, alive: () => { const s = window.lanternSim(); s.safe = 60; s.light = 1; }, legacy: { 'lantern-bank': '120', 'lantern-night': '3' } }),
  'hint borrowed': page => hinted(page, { path: '/borrowed/', play: '#play', resume: '#resume', key: 'borrowed:hint', delay: 3000, moved: () => window.borrowedState().touched, legacy: { 'borrowed-save': '{"v":1,"sound":true,"best":530,"runs":4,"gallery":{"busker":1},"daily":{},"taught":1}' } }),
  'hint ducklings': page => hinted(page, { path: '/ducklings/', play: '#play', resume: '#resume', key: 'ducklings:hint', delay: 3000, before: () => window.ducklingsState().rollCalls, moved: n => window.ducklingsState().rollCalls > n, legacy: { 'ducklings-save': '{"v":1,"sound":true,"opened":2,"stars":{"1":2},"best":{"1":140},"endless":0,"home":2,"album":{},"taught":true}' } }),
  'hint grapevine': page => hinted(page, { path: '/grapevine/', play: '#play', resume: '#resume', key: 'grapevine:hint', delay: 3000, moved: () => window.grapevineState().touched, legacy: { 'grapevine-save': '{"v":1,"sound":true,"best":{"1":3},"opened":2,"daily":{}}' } }),
  // Paper Pitch acts when the finger lifts (a press may become a drag from the ball), so it has its own first-time help check: `hinted` asserts before the lift.
  async 'hint lab/pitch'(page) {
    const on = () => page.evaluate(() => !!document.querySelector('.kit-hint.on'));
    await page.goto(`${base}/notes/button.js`); await page.evaluate(() => localStorage.clear());
    await page.goto(`${base}/lab/pitch/`); await page.waitForSelector('#play'); await sleep(3500); assert.equal(await on(), false, 'hint: not on the menu');
    await page.click('#play'); await until(page, () => !!document.querySelector('.kit-hint.on'), 'hint: shown after the delay', 11000);
    const { x, y, top } = await page.evaluate(() => { const r = document.querySelector('.kit-hint .knob').getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2; return { x, y, top: document.elementFromPoint(x, y)?.id }; });
    assert.equal(top, 'c', 'hint: the game canvas is what a finger on the hint touches');
    await page.mouse.click(x, y); await until(page, () => window.__pitch.segments > 0, 'hint: a tap where the hint points draws a line', 3000);
    assert.equal(await page.evaluate(() => document.querySelector('.kit-hint')), null, 'hint: gone on the first input');
    assert.equal(await page.evaluate(() => localStorage.getItem('pitch:hint')), '1', 'hint: the player is remembered');
    await page.goto(`${base}/notes/button.js`); await page.evaluate(() => { localStorage.clear(); localStorage.setItem('pitch:v1', '{"played":1,"level":1,"lossStreak":0,"wins":1,"sound":true,"daily":{}}'); });
    await page.goto(`${base}/lab/pitch/`); await page.click('#play'); await sleep(4500); assert.equal(await on(), false, 'hint: never shown to a returning player');
  },
  'hint lab/ring': page => hinted(page, { path: '/lab/ring/', play: '#play', resume: '#resume', key: 'ring:hint', delay: 3000, before: () => window.__ring.threadPoints, moved: n => window.__ring.threadPoints > n || window.__ring.fingerDown, legacy: { 'ring:v1': '{"v":1,"sound":true,"nights":2,"dawns":1,"best":412,"bestRing":16,"endless":false,"endlessBest":0,"daily":{}}' } }),
  // Old /proto/ links move to the top level with their query; the new URL plays to its first frame.
  async 'old links'(page) {
    const response = await page.goto(`${base}/proto/lantern/?x=1`);
    assert.equal(page.url(), `${base}/lantern/?x=1`, 'redirected with the query');
    assert.equal((await response.request().redirectedFrom().response()).status(), 301, 'a permanent redirect');
    await page.click('#play'); await page.click('#tutorNo'); const t = (await page.evaluate(() => window.lanternState())).t;
    await page.waitForFunction(t => window.lanternState().playing && window.lanternState().t > t, t);
    await page.goto(`${base}/proto/lab/`); assert.equal(page.url(), `${base}/lab/`, 'lab index');
    await page.goto(`${base}/proto/`); assert.equal(page.url(), `${base}/lab/`, '/proto/ goes to the lab index');
  },
  // The lab is down: every send fails, and the game plays on with no page error.
  async 'lab down'(page) {
    page.context().labDown = true;
    await page.goto(`${base}/lantern/`); await page.evaluate(LAB_LOCAL); await page.reload();
    await page.click('#play'); await page.click('#tutorNo'); await page.evaluate(() => { window.lanternSim().light = 0.0001; });
    await until(page, () => window.lanternState().screen === 'card' && !window.lanternState().playing, 'end card');
    await page.click('#go'); assert.ok((await page.evaluate(() => window.lanternState())).playing, 'plays on');
    assert.ok(page.context().labTried > 0, 'a send was tried');
  },
  // The page is put away and left while a record is still being compressed: no page error (WebKit raised one).
  async 'leaving mid-run'(page) {
    await page.goto(`${base}/lantern/`); await page.evaluate(LAB_LOCAL); await page.reload();
    await page.click('#play'); await page.click('#tutorNo');
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
      await page.goto(`${base}/kit/`); await sleep(300);
      await page.goto(`${base}/lantern/`); await page.click('#play');
    }
  },
};

// Every new page has its own save seed, controls and first-time help contract beside its registration.
for (const [slug, g] of Object.entries({ ...pages, ...labPages })) {
  const path = `/${slug}/${g.query ? `?${g.query}` : ''}`;
  GAMES[slug] = page => savedPhone(page, { ...g, path });
  for (const hint of g.hints ?? (g.hint ? [g.hint] : [])) {
    const name = hint.name ? `hint ${slug} ${hint.name}` : `hint ${slug}`;
    GAMES[name] = page => hinted(page, { path, play: g.play ?? '#play', resume: g.resume ?? '#resume', prepare: g.prepare, start: g.start, waitInput: true, waitHintState: true, ...hint });
  }
}

for (const [slug, run] of Object.entries(pageRuns)) GAMES[slug] = page => run(page, { base, until }); // pages that are not games: the small games' home

const [onlyGame, onlyPhone] = process.argv.slice(2);
// The first argument is 'all' or a comma list of experiments. An experiment's name picks its own check, its
// first-time help check, and for Lantern the three checks below that play Lantern.
const WITH = { lantern: ['old links', 'lab down', 'leaving mid-run'] };
const picked = game => !onlyGame || onlyGame === 'all' || onlyGame.split(',').some(only => game === only || game === `hint ${only}` || game.startsWith(`hint ${only} `) || WITH[only]?.includes(game));
// A check that never answers becomes a FAIL line naming it, not a job that runs until its time limit.
const within = (p, ms, what) => { let t; return Promise.race([p, new Promise((_, no) => { t = setTimeout(() => no(new Error(`no answer in ${ms / 1000}s: ${what}`)), ms); })]).finally(() => clearTimeout(t)); };
let failed = 0;
for (const [phone, [engine, device]] of Object.entries(PHONES)) {
  if (onlyPhone && onlyPhone !== phone) continue;
  // Headless macOS WebKit still needs a display link to schedule animation frames.
  const awake = phone === 'webkit' && process.platform === 'darwin'
    && Object.entries(labPages).some(([slug, g]) => hasTimedHint(g) && (picked(slug)
      || (g.hints ? g.hints.some(hint => picked(`hint ${slug} ${hint.name}`)) : picked(`hint ${slug}`))))
    ? spawn('/usr/bin/caffeinate', ['-diu', '-w', String(process.pid)], { stdio: 'ignore' })
    : null;
  awake?.unref();
  let browser = await engine.launch();
  for (const [game, run] of Object.entries(GAMES)) {
    if (!picked(game)) continue;
    const context = await browser.newContext({ ...device }), page = await context.newPage(), errors = [];
    context.checkName = `${phone}-${game.replaceAll(/[^a-z0-9-]/gi, '-')}`;
    // Answer the lab endpoint here, so no check ever reaches it. Records are kept for the assertions.
    context.labSent = []; context.labTried = 0;
    await context.route('https://human.adamwhite.work/**', async route => {
      const req = route.request(), cors = { 'access-control-allow-origin': base, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'Content-Type' };
      context.labTried++;
      if (context.labDown) return route.abort('connectionrefused');
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      const record = JSON.parse(gunzipSync(req.postDataBuffer()).toString()); context.labSent.push(record);
      return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ ok: true, id: record.id }) });
    });
    // Count audio contexts and their suspend and resume calls, so the checks can see what the sound code did.
    await page.addInitScript(() => {
      const Real = window.AudioContext || window.webkitAudioContext; if (!Real) return;
      window.audioLog = { made: 0, suspend: 0, resume: 0 };
      if (!navigator.audioSession) Object.defineProperty(navigator, 'audioSession', { value: { type: 'auto' }, configurable: true }); // a stand-in where the browser has none
      window.AudioContext = window.webkitAudioContext = class extends Real {
        constructor(...a) { super(...a); window.audioLog.made++; }
        suspend() { window.audioLog.suspend++; return super.suspend(); }
        resume() { window.audioLog.resume++; return super.resume(); }
      };
    });
    page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('requestfailed', r => errors.push(`request failed: ${r.url()}`)); page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    // Lantern's check is the longest: its seven ability showings (note #123) took it past 150 s on WebKit.
    try { await within(run(page), game === 'lantern' ? 240000 : 150000, 'the whole check'); assert.deepEqual(errors.filter(e => !(context.labDown && /human\.adamwhite\.work|Load failed|Failed to fetch|ERR_CONNECTION_REFUSED/.test(e))).filter(e => !(context.boardBad && /\/lab-api\/board\/|status of 401/.test(e))).filter(e => !(context.badFrame && /lab check: one bad frame/.test(e))).filter(e => !(context.viewBad && /view3d\.js|net::ERR_FAILED|Failed to load resource|Importing a module/.test(e))), [], 'page errors'); console.log(`ok   ${game} on ${phone}`); }
    catch (e) { failed++; console.log(`FAIL ${game} on ${phone}: ${e.message}`); if (process.env.CHECK_STACK) console.log(e.stack); if (errors.length) console.log('     ' + errors.join('\n     ')); await shot(page, 'failure').catch(() => {}); }
    try { await within(context.close(), 15000, 'closing the page'); }
    catch (e) { console.log(`     ${e.message}; starting the browser again`); browser.close().catch(() => {}); browser = await engine.launch(); }
  }
  await within(browser.close(), 15000, 'closing the browser').catch(() => {});
  awake?.kill();
}
server.close();
process.exit(failed ? 1 : 0);
