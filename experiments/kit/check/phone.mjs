// Phone runs for the live experiments. Run before and after any change to experiments/kit/ or to a game's page:
//   node experiments/kit/check/phone.mjs            both games, WebKit iPhone 13 and Chromium Pixel 7
//   node experiments/kit/check/phone.mjs lantern webkit
// It serves this checkout the way production does (/<slug>/, the 301 from /proto/<slug>/, /notes/button.js), seeds saves in the
// formats players already have, and fails on any page error. Playwright is not a dependency of this repository:
// set PLAYWRIGHT to a directory that has it installed, or install it anywhere Node can resolve it.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import { existsSync } from 'node:fs';
import { experimentPath } from '../../../src/worker.mjs';
import { experimentRoots } from '../../../scripts/experiments.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
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
async function until(page, fn, what, ms = 8000) { try { await page.waitForFunction(fn, null, { timeout: ms }); } catch { throw new Error(`timed out waiting for: ${what}`); } }
// A finger on the canvas, as the pointer events the games listen for.
const finger = (page, sel, steps) => page.evaluate(([sel, steps]) => {
  const el = document.querySelector(sel);
  for (const [type, x, y] of steps) el.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, pressure: type === 'pointerup' ? 0 : 0.5, bubbles: true, cancelable: true }));
}, [sel, steps]);
// Lab records the page sent. Every context answers the lab endpoint itself (see the runner), so no check reaches it.
const labSent = page => page.context().labSent;
const labRuns = (page, game) => labSent(page).filter(r => r.game === game && r.kind === 'run');
const LAB_LOCAL = () => localStorage.setItem('hf-lab-send-localhost', '1'); // pages on 127.0.0.1 send only with this

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

// The Ant Promotion lab variants share the main game's save shape, joystick and cards. extra: the variant's own save fields.
async function antLab(page, slug, query, extra, checkExtra) {
  const KEY = `${slug}:v1`;
  const mode = () => page.evaluate(() => window.__ant.mode);
  const saved = () => page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
  await page.goto(`${base}/lab/${slug}/${query}`); await until(page, () => window.__ant, 'game script');
  // A save in the format players already have: a level-2 animal, a skin, the soft look.
  const stack = await page.evaluate(() => { const F = window.__ant.FORMS; return [F.findIndex(f => f && f.level === 1), F.findIndex(f => f && f.level === 2)]; });
  await page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [KEY, { skin: { c: '#c0271f', p: 'stripes' }, stack, xp: 3, sound: true, look: 2, ...extra }]);
  await page.reload(); await until(page, () => window.__ant, 'game script');
  assert.match(await page.textContent('#continue'), /^Continue as /, 'old save: continues'); assert.match(await page.textContent('#look'), /^Look: /);
  assert.equal(await page.textContent('#sound'), 'Sound: on'); await checkExtra();
  assert.equal(await page.evaluate(() => window.audioLog.made), 0, 'no audio before the first tap');
  await page.click('#continue'); assert.equal(await mode(), 'play');
  assert.equal(await page.evaluate(() => window.audioLog.made), 1, 'Play starts audio');
  assert.equal(await page.evaluate(() => window.__ant.level(window.__ant.s)), 2, 'old save: level'); assert.equal(await page.evaluate(() => window.__ant.s.player.xp), 3, 'old save: xp');
  await stickNumbers(page);
  // Walk by dragging.
  const x0 = await page.evaluate(() => window.__ant.s.player.x);
  await finger(page, '#c', [['pointerdown', 150, 400], ['pointermove', 215, 400]]);
  await page.waitForFunction(x => window.__ant.s.player.x > x + 5, x0);
  await finger(page, '#c', [['pointerup', 215, 400]]);
  // Pause by the button and by P; time stands still while paused.
  await page.click('#pause'); assert.equal(await mode(), 'paused');
  const t0 = await page.evaluate(() => window.__ant.s.t); await sleep(300); assert.equal(await page.evaluate(() => window.__ant.s.t), t0, 'time stands still while paused');
  await page.click('#resume'); assert.equal(await mode(), 'play');
  await page.keyboard.press('p'); assert.equal(await mode(), 'paused'); await page.keyboard.press('p'); assert.equal(await mode(), 'play');
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); delete document.hidden; });
  assert.equal(await mode(), 'paused', 'hiding the page pauses'); await page.click('#resume');
  // From the kit (pause.js): losing focus and putting the page away pause too, and capital P is a pause key.
  await page.evaluate(() => dispatchEvent(new Event('blur'))); assert.equal(await mode(), 'paused', 'losing focus pauses'); await page.keyboard.press('P'); assert.equal(await mode(), 'play', 'capital P resumes');
  await page.evaluate(() => dispatchEvent(new Event('pagehide'))); assert.equal(await mode(), 'paused', 'putting the page away pauses'); await page.click('#resume');
  assert.equal(await page.evaluate(() => window.audioLog.made), 1, 'one audio context for the whole run');
  // Leaving for the menu keeps the animal; a reload keeps all of it.
  await page.click('#pause'); await page.click('#paused .toMenu'); assert.equal(await mode(), 'menu');
  const before = await saved(); assert.equal(before.stack.length, 2); assert.equal(before.skin.c, '#c0271f'); assert.equal(before.look, 2);
  for (const k of Object.keys(extra)) assert.deepEqual(before[k], extra[k], `old save: ${k} kept`);
  await page.reload(); await until(page, () => window.__ant, 'game script');
  assert.deepEqual(await saved(), before, 'reload keeps the save'); assert.match(await page.textContent('#continue'), /^Continue as /);
  // Sound off is kept, and then no audio is started.
  await page.click('#sound'); assert.equal(await page.textContent('#sound'), 'Sound: off'); assert.equal((await saved()).sound, false);
  await page.reload(); await until(page, () => window.__ant, 'game script'); assert.equal(await page.textContent('#sound'), 'Sound: off');
  await page.click('#continue'); await page.click('#pause'); assert.equal(await page.evaluate(() => window.audioLog.made), 0, 'sound off: no audio is started');
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
    const state = () => page.evaluate(() => window.lanternState());
    const audioLog = () => page.evaluate(() => window.audioLog);
    const saved = () => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('lantern-')).map(k => [k, localStorage.getItem(k)])));
    // A save in the format players already have.
    await page.goto(`${base}/lantern/`);
    await page.evaluate(LAB_LOCAL);
    await page.evaluate(() => { localStorage.setItem('lantern-night', '3'); localStorage.setItem('lantern-bank', '120'); localStorage.setItem('lantern-owned', '["red"]'); localStorage.setItem('lantern-worn', '{"boat":"red"}'); localStorage.setItem('lantern-best-3', '40'); localStorage.setItem('lantern-best-endless', '55'); localStorage.setItem('lantern-best-tower', '4'); localStorage.setItem('lantern-stats', '{"red":1}'); localStorage.setItem('lantern-off', '[]'); localStorage.setItem('lantern-best-level', '0'); localStorage.setItem('lantern-tower-at', '1'); localStorage.setItem('lantern-rebirths', '0'); localStorage.setItem('lantern-crash', '[]'); localStorage.setItem('notes.k', 'check'); });
    await page.reload();
    let st = await state();
    assert.equal(st.opened, 3, 'old save: opened night'); assert.equal(st.bank, 120, 'old save: bank'); assert.ok(st.owned.includes('red'), 'old save: owned'); assert.equal(st.worn.boat, 'red', 'old save: worn');
    assert.equal(await page.textContent('#play'), 'Play night 3'); assert.match(await page.textContent('#about'), /Best 40%/);
    assert.deepEqual(st.board.map(r => r.s), [55], 'old save: the endless best starts the leaderboard'); assert.deepEqual(st.winOn, []);
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
    await page.click('[data-item="boost"]'); assert.equal((await saved())['lantern-off'], '["boost"]'); assert.ok((await state()).owned.includes('boost'), 'switched off, still owned');
    await page.click('.back'); assert.match(await page.textContent('#ready'), /Hearts 1/, 'the menu shows the stats ready for the next run');
    await page.click('#play'); st = await state(); assert.equal(st.hearts, 2, 'the stat is on for this run'); assert.ok(!st.on.includes('boost'), 'a switched-off ability is not in the river');
    assert.equal((await saved())['lantern-stats'], '{}', 'the stat is used up when the run starts');
    await page.evaluate(() => { window.lanternSim().light = 0.0001; }); await until(page, () => !window.lanternState().playing, 'stat run ends');
    await until(page, () => window.lanternState().screen === 'card', 'end card'); await page.click('#toMenu');
    assert.equal(await page.textContent('#ready'), '', 'no stats left after the run');
    // Tower of 50 levels (2026-11-23): after a level, climb on or stop; the best level is kept under lantern-best-level.
    // The next climb goes on where the last left off, saved under lantern-tower-at (note #73); a new climb from level 1 is one tap.
    await page.click('#tower'); assert.equal((await state()).climb, 1, 'a first climb starts at level 1'); assert.equal(await page.isVisible('#anew'), false);
    await page.evaluate(() => { const s = window.lanternSim(); s.y = 77.9; s.safe = 99; }); await until(page, () => window.lanternState().screen === 'card', 'level card', 12000);
    assert.match(await page.textContent('#title'), /Level 1 cleared/); assert.equal(await page.textContent('#toMenu'), 'Stop'); assert.equal((await saved())['lantern-best-level'], '1'); assert.equal((await saved())['lantern-tower-at'], '2');
    await page.click('#go'); st = await state(); assert.equal(st.climb, 2, 'climb on goes to level 2'); assert.ok(st.playing);
    await page.evaluate(() => { window.lanternSim().light = 0.0001; }); await until(page, () => window.lanternState().screen === 'card', 'lost card');
    assert.match(await page.textContent('#line'), /Best 1 of 50\. Your climb goes on from level 2/); assert.equal(await page.textContent('#go'), 'Try level 2 again');
    await page.click('#go'); assert.equal((await state()).climb, 2, 'after a loss the level is tried again');
    await finger(page, '#pause', [['pointerdown', 0, 0]]); await page.click('#toMenu'); assert.match(await page.textContent('#tower'), /go on at level 2/);
    await page.click('#tower'); assert.equal((await state()).climb, 2, 'the menu climb goes on at level 2');
    await finger(page, '#pause', [['pointerdown', 0, 0]]); await page.click('#toMenu');
    await page.click('#anew'); assert.equal((await state()).screen, 'menu', 'one tap on new climb only asks'); assert.equal((await saved())['lantern-tower-at'], '2');
    await page.click('#anew'); assert.equal((await state()).climb, 1, 'a new climb starts at level 1'); assert.equal((await saved())['lantern-tower-at'], '1');
    await finger(page, '#pause', [['pointerdown', 0, 0]]); await page.click('#toMenu'); assert.equal(await page.isVisible('#anew'), false);
    // Sector 2 (note #73): level 50 cleared opens 50 more levels, numbered 51 to 100 inside and shown as "sector 2, level N".
    await page.evaluate(() => localStorage.setItem('lantern-tower-at', '50')); await page.reload();
    await page.click('#tower'); assert.equal((await state()).climb, 50);
    await page.evaluate(() => { const s = window.lanternSim(); s.y = 77.9; s.safe = 99; }); await until(page, () => window.lanternState().screen === 'card', 'sector card', 12000);
    assert.equal(await page.textContent('#title'), 'Sector 1 cleared'); assert.equal(await page.textContent('#go'), 'Climb on to sector 2');
    await page.click('#go'); assert.equal((await state()).climb, 51, 'sector 2 is climb 51');
    await page.evaluate(() => { window.lanternSim().light = 0.0001; }); await until(page, () => window.lanternState().screen === 'card', 'sector 2 lost card');
    assert.match(await page.textContent('#line'), /Best 50 of 50\. Your climb goes on from sector 2, level 1/);
    await page.click('#toMenu'); assert.match(await page.textContent('#tower'), /go on at sector 2, level 1/);
    await page.click('#anew'); await page.click('#anew'); await finger(page, '#pause', [['pointerdown', 0, 0]]); await page.click('#toMenu');
    // 50 nights (note #73): the tester tool opens them all; night 50 is the last.
    await page.click('#toShop'); await page.click('[data-test="nights"]'); await page.click('.back');
    assert.equal(await page.textContent('#play'), 'Play night 50'); assert.match(await page.textContent('#about'), /This is the last night/);
    await page.click('#less'); assert.doesNotMatch(await page.textContent('#about'), /last night/);
    // Rebirth (note #73): a goal until everything is found and all 50 nights are open; then two taps start over with 25% more embers for good.
    await page.click('#toShop'); assert.equal(await page.isVisible('#rebirth'), false, 'no rebirth before everything is found'); assert.match(await page.textContent('#packs'), /Find everything \(\d+ of 33\)/);
    await page.click('[data-test="all"]'); await page.click('[data-test="nights"]');
    await page.click('#rebirth'); assert.equal((await state()).reborn, 0, 'one tap is not a rebirth'); await page.click('#rebirth');
    st = await state(); assert.equal(st.reborn, 1); assert.equal(st.bank, 0); assert.equal(st.opened, 1); assert.deepEqual(st.owned.sort(), ['amber', 'blue', 'boost', 'oak']);
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
    const abilitiesOn = async () => { const s = await saved(), off = JSON.parse(s['lantern-off'] || '[]'); return ['boost', 'slow', 'size', 'magnet', 'flare'].filter(k => !off.includes(k)); };
    assert.equal((await abilitiesOn()).length, 2, 'finding every ability leaves two on');
    const offOne = (await page.evaluate(() => JSON.parse(localStorage.getItem("lantern-off"))))[0];
    await page.click(`[data-item="${offOne}"]`); assert.match(await page.textContent('#got'), /Only 2 abilities at a time/); assert.equal((await abilitiesOn()).length, 2);
    for (const id of ['burst', 'freeze', 'ghost']) await page.click(`[data-item="${id}"]`);
    await page.click('[data-item="bolt"]'); assert.match(await page.textContent('#got'), /Only 3 crashes at a time/); assert.deepEqual(JSON.parse((await saved())['lantern-crash']), ['burst', 'freeze', 'ghost']);
    await page.click('[data-item="ghost"]'); await page.click('[data-item="freeze"]'); assert.deepEqual(JSON.parse((await saved())['lantern-crash']), ['burst']);
    await page.click('.back'); await page.click('#play'); await page.evaluate(() => { const s = window.lanternSim(); s.hearts = 1; s.shield = 0; s.safe = 0; s.x = 5; });
    await until(page, () => window.lanternState().crash === 'burst', 'a crash plays the crash switched on');
    await until(page, () => window.lanternState().screen === 'card', 'crash card'); await page.click('#toMenu');
    // The victory pack (note #96): up to three on, and dawn plays one of them. lantern-win is a JSON list of ids.
    await page.click('#toShop');
    for (const id of ['vfire', 'vlamp', 'vbird']) await page.click(`[data-item="${id}"]`);
    await page.click('[data-item="vbow"]'); assert.match(await page.textContent('#got'), /Only 3 victories at a time/); assert.deepEqual(JSON.parse((await saved())['lantern-win']), ['vfire', 'vlamp', 'vbird']);
    await page.click('[data-item="vlamp"]'); await page.click('[data-item="vbird"]'); assert.deepEqual(JSON.parse((await saved())['lantern-win']), ['vfire']);
    await page.click('.back'); await page.click('#play'); await page.evaluate(() => { const s = window.lanternSim(); s.safe = 99; s.bonus = 1000; });
    await until(page, () => window.lanternState().win === 'vfire', 'dawn plays the victory switched on');
    await until(page, () => window.lanternState().screen === 'card', 'dawn card'); await page.click('#toMenu');
    // The leaderboard on this phone (note #96): a name, and an endless run that beats the best goes to the top. Nothing of it is sent.
    await sleep(400); await page.evaluate(() => localStorage.removeItem('hf-lab-recording-off')); await page.reload(); // recording back on, so the check below can see what is sent
    const sentBefore = labSent(page).length;
    await page.click('#toBoard'); assert.equal(await page.isVisible('#name'), true); assert.match(await page.textContent('#rows'), /^1No name55/);
    await page.fill('#name', ' Rio <b>river</b>'); assert.equal((await saved())['lantern-name'], 'Rio <b>river</b', 'the name is trimmed and kept to 16 characters');
    await page.keyboard.press('p'); assert.equal((await state()).screen, 'board', 'typing P in the name does not pause or play');
    await page.click('#boardPlay'); assert.equal((await state()).endless, true);
    await page.evaluate(() => { const s = window.lanternSim(); s.extra = 900; s.light = 0.0001; s.warm = 0; });
    await until(page, () => window.lanternState().screen === 'card' && !window.lanternState().playing, 'endless run ends');
    assert.match(await page.textContent('#line'), /Number 1 on this phone's leaderboard/);
    st = await state(); assert.equal(st.board.length, 2); assert.equal(st.board[0].n, 'Rio <b>river</b'); assert.ok(st.board[0].s >= 900);
    await page.click('#toMenu'); await page.click('#toBoard');
    assert.equal(await page.locator('#rows li.me .n').textContent(), 'Rio <b>river</b', 'the name is shown as text'); assert.equal(await page.locator('#rows b').count(), 0, 'no markup from the name');
    await sleep(300); const sent = labSent(page).slice(sentBefore); assert.ok(sent.some(r => r.kind === 'run' && r.data.summary?.score >= 900), 'the endless run was recorded');
    assert.ok(!JSON.stringify(sent).includes('Rio'), 'the name is not sent to the lab');
    await sleep(400); await page.reload(); st = await state(); assert.equal(st.name, 'Rio <b>river</b'); assert.equal(st.board.length, 2, 'the board is kept');
    await page.evaluate(() => localStorage.setItem('hf-lab-recording-off', '1')); await page.reload(); // recording off again, as the steps below expect
    // A look on the whole screen (note #73): tapping an owned boat wears it and hides every button; a tap brings the shop back.
    await page.click('#toShop'); await page.click('[data-item="red"]'); st = await state();
    assert.equal(st.looking, 'boat'); assert.equal(st.worn.boat, 'red'); assert.equal(await page.isVisible('#shop'), false, 'the shop hides'); assert.equal(await page.isVisible('#notes-button'), false, 'the notes button hides');
    const y0 = (await state()).y; await page.waitForFunction(y => window.lanternSim().y > y + 0.05, y0);
    await page.click('#look'); st = await state(); assert.equal(st.looking, ''); assert.equal(st.screen, 'shop'); assert.equal(await page.isVisible('#shop'), true, 'the shop comes back');
    // Erase everything (note #73, tester tools): two taps; every lantern- key goes and nothing else.
    await page.click('[data-test="reset"]'); assert.ok(Object.keys(await saved()).length > 3, 'one tap erases nothing');
    await Promise.all([page.waitForEvent('load'), page.click('[data-test="reset"]')]);
    assert.deepEqual(await saved(), {}, 'every lantern- key is gone'); assert.equal(await page.evaluate(() => localStorage.getItem('notes.k')), 'check', 'the tester link stays');
    st = await state(); assert.equal(st.bank, 0); assert.equal(st.opened, 1);
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
    await page.evaluate(([k, stack]) => { localStorage.setItem(k, JSON.stringify({ skin: { c: '#c0271f', p: 'stripes' }, stack, xp: 3, sound: true, look: 2 })); localStorage.setItem('notes.k', 'check'); }, [KEY, stack]);
    await page.reload(); await until(page, () => window.__ant, 'game script');
    assert.match(await page.textContent('#continue'), /^Continue as /, 'old save: continues'); assert.equal(await page.textContent('#rules'), 'Rules: Wild', 'Wild is the default (note #88)'); assert.match(await page.textContent('#look'), /^Look: /);
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
  },
  // The three games of 2026-11-23. Each has its own full check (experiments/<slug>/check.mjs); this is the shared part:
  // the page loads through the kit with no error, a run starts from Play, pause holds it, and leaving for the menu
  // sends one lab record marked as an agent run. Run a game's own check after changing that game.
  grapevine: page => started(page, 'grapevine', 'grapevineState', '#toMenu'),
  ducklings: page => started(page, 'ducklings', 'ducklingsState', '#pauseMenu'),
  fixit: page => started(page, 'fixit', 'fixitState', '#quit'),
  // Lab pages (/lab/<name>/): an old save survives, a finger steers, pause stops time, one audio context after the first tap.
  'lab/ant-nemesis': page => antLab(page, 'ant-nemesis', '?ai=0', { nem: null, trophies: [{ name: 'Old Scar the Beetle' }], gens: 1 }, async () => {
    assert.match(await page.textContent('#trophies'), /Old Scar the Beetle/, 'old save: trophies');
  }),
  'lab/ant-wilds': page => antLab(page, 'ant-wilds', '', {}, async () => {}),
  async 'lab/ant-nest'(page) {
    const KEY = 'ant-nest:v1', nest = () => page.evaluate(() => { const n = window.__nest; return { mode: n.mode, t: n.s?.t, marks: n.s ? n.s.mark.reduce((a, b) => a + b, 0) : 0 }; });
    await page.goto(`${base}/lab/ant-nest/`); await until(page, () => window.__nest, 'game script');
    await page.evaluate(k => localStorage.setItem(k, JSON.stringify({ best: 42 })), KEY);
    await page.reload(); await until(page, () => window.__nest, 'game script');
    assert.equal(await page.textContent('#bestLine'), 'Best score: 42', 'old save: best');
    assert.equal(await page.evaluate(() => window.audioLog.made), 0, 'no audio before the first tap');
    await page.click('#play'); assert.equal((await nest()).mode, 'play');
    assert.equal(await page.evaluate(() => window.audioLog.made), 1, 'Play starts audio');
    // A finger dragged across the soil marks it for digging.
    const { ox, oy, cell } = await page.evaluate(() => window.__nest.layout), row = oy + 3.5 * cell;
    await finger(page, '#c', [['pointerdown', ox + 0.5 * cell, row], ...[1, 2, 3, 4, 5, 6, 7].map(i => ['pointermove', ox + (i + 0.5) * cell, row]), ['pointerup', ox + 7.5 * cell, row]]);
    assert.ok((await nest()).marks > 0, 'a drag marks soil');
    // Pause by the button and by P; time stands still while paused.
    await page.click('#pause'); assert.equal((await nest()).mode, 'paused');
    const t0 = (await nest()).t; await sleep(300); assert.equal((await nest()).t, t0, 'time stands still while paused');
    await page.click('#resume'); assert.equal((await nest()).mode, 'play');
    await page.waitForFunction(t => window.__nest.s.t > t, t0);
    await page.keyboard.press('p'); assert.equal((await nest()).mode, 'paused'); await page.keyboard.press('p'); assert.equal((await nest()).mode, 'play');
    // From the kit (pause.js): losing focus and putting the page away pause too, and capital P is a pause key.
    await page.evaluate(() => dispatchEvent(new Event('blur'))); assert.equal((await nest()).mode, 'paused', 'losing focus pauses'); await page.keyboard.press('P'); assert.equal((await nest()).mode, 'play', 'capital P resumes');
    await page.evaluate(() => dispatchEvent(new Event('pagehide'))); assert.equal((await nest()).mode, 'paused', 'putting the page away pauses'); await page.click('#resume');
    // A round ends; the best is kept across a reload.
    await page.evaluate(() => window.__nest.skipTo(1e9)); await until(page, () => window.__nest.mode === 'end', 'end card');
    await page.reload(); await until(page, () => window.__nest, 'game script');
    assert.ok(JSON.parse(await page.evaluate(k => localStorage.getItem(k), KEY)).best >= 42, 'best kept'); assert.match(await page.textContent('#bestLine'), /^Best score: \d+$/);
    assert.equal(await page.evaluate(() => window.audioLog.made), 0, 'no audio before the first tap after a reload');
    await page.click('#sound'); assert.equal(await page.textContent('#sound'), 'Sound: off');
    await page.click('#play'); await page.click('#pause'); assert.equal(await page.evaluate(() => window.audioLog.made), 0, 'sound off: no audio is started');
  },
  async 'lab/lantern-3d'(page) {
    const state = () => page.evaluate(() => window.lanternState());
    await page.goto(`${base}/lab/lantern-3d/?night=2`);
    await until(page, () => window.lanternState, 'game script (needs WebGL2)');
    assert.equal(await page.textContent('#play'), 'Play night 2');
    assert.equal(await page.evaluate(() => window.audioLog.made), 0, 'no audio before the first tap');
    await page.click('#play'); let st = await state();
    assert.ok(st.playing && st.screen === 'play', 'play starts'); assert.equal(await page.evaluate(() => window.audioLog.made), 1, 'Play starts audio');
    // Steer by a relative drag; a tap alone does not steer.
    const x0 = st.target;
    await finger(page, '#c', [['pointerdown', 40, 400], ['pointerup', 40, 400]]);
    assert.equal((await state()).target, x0, 'a tap does not steer');
    await finger(page, '#c', [['pointerdown', 200, 400], ['pointermove', 230, 400]]);
    assert.ok((await state()).target > x0, 'a drag to the right steers right');
    await finger(page, '#c', [['pointerup', 230, 400]]);
    // Pause by the button, resume by the card, P and Escape; time stands still while paused.
    await finger(page, '#pause', [['pointerdown', 0, 0]]);
    st = await state(); assert.ok(st.paused && st.screen === 'card', 'pause button pauses');
    assert.equal(await page.evaluate(() => window.audioLog.suspend), 1, 'pause silences audio');
    await sleep(300); assert.equal((await state()).t, st.t, 'time stands still while paused');
    await page.click('#go'); await until(page, () => !window.lanternState().paused, 'resume');
    const t1 = (await state()).t; await page.waitForFunction(t => window.lanternState().t > t, t1);
    await page.keyboard.press('p'); assert.ok((await state()).paused, 'P pauses'); await page.keyboard.press('Escape'); assert.ok(!(await state()).paused, 'Escape resumes');
    await page.evaluate(() => dispatchEvent(new Event('blur'))); assert.ok((await state()).paused, 'losing focus pauses'); await page.keyboard.press('p');
    // The touch that ends a pause does not steer until the finger has moved a clear distance.
    await finger(page, '#pause', [['pointerdown', 0, 0]]); const x1 = (await state()).x;
    await finger(page, '#c', [['pointerdown', 200, 400], ['pointermove', 205, 400], ['pointermove', 210, 400]]);
    st = await state(); assert.ok(!st.paused, 'a touch resumes'); assert.equal(st.target, x1, 'jitter after a pause does not steer');
    await finger(page, '#c', [['pointerup', 210, 400]]);
    await dragNumbers(page); await finger(page, '#c', [['pointerup', 140, 400]]);
    assert.equal(await page.evaluate(() => window.audioLog.made), 1, 'one audio context for the whole run');
    // The run ends with an end card; the page keeps nothing in storage, so a reload starts clean.
    await page.evaluate(() => { window.lanternSim().light = 0.0001; });
    await until(page, () => window.lanternState().screen === 'card' && !window.lanternState().playing, 'end card');
    assert.deepEqual(await page.evaluate(() => Object.keys(localStorage).filter(k => k !== 'notes.k')), [], 'no saved keys');
    await page.reload(); await until(page, () => window.lanternState, 'game script'); assert.equal((await state()).screen, 'menu');
  },
  // Old /proto/ links move to the top level with their query; the new URL plays to its first frame.
  async 'old links'(page) {
    const response = await page.goto(`${base}/proto/lantern/?x=1`);
    assert.equal(page.url(), `${base}/lantern/?x=1`, 'redirected with the query');
    assert.equal((await response.request().redirectedFrom().response()).status(), 301, 'a permanent redirect');
    await page.click('#play'); const t = (await page.evaluate(() => window.lanternState())).t;
    await page.waitForFunction(t => window.lanternState().playing && window.lanternState().t > t, t);
    await page.goto(`${base}/proto/lab/`); assert.equal(page.url(), `${base}/lab/`, 'lab index');
    await page.goto(`${base}/proto/`); assert.equal(page.url(), `${base}/lab/`, '/proto/ goes to the lab index');
  },
  // The lab is down: every send fails, and the game plays on with no page error.
  async 'lab down'(page) {
    page.context().labDown = true;
    await page.goto(`${base}/lantern/`); await page.evaluate(LAB_LOCAL); await page.reload();
    await page.click('#play'); await page.evaluate(() => { window.lanternSim().light = 0.0001; });
    await until(page, () => window.lanternState().screen === 'card' && !window.lanternState().playing, 'end card');
    await page.click('#go'); assert.ok((await page.evaluate(() => window.lanternState())).playing, 'plays on');
    assert.ok(page.context().labTried > 0, 'a send was tried');
  },
  // The page is put away and left while a record is still being compressed: no page error (WebKit raised one).
  async 'leaving mid-run'(page) {
    await page.goto(`${base}/lantern/`); await page.evaluate(LAB_LOCAL); await page.reload();
    await page.click('#play');
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
      await page.goto(`${base}/kit/`); await sleep(300);
      await page.goto(`${base}/lantern/`); await page.click('#play');
    }
  },
};

const [onlyGame, onlyPhone] = process.argv.slice(2);
let failed = 0;
for (const [phone, [engine, device]] of Object.entries(PHONES)) {
  if (onlyPhone && onlyPhone !== phone) continue;
  const browser = await engine.launch();
  for (const [game, run] of Object.entries(GAMES)) {
    if (onlyGame && onlyGame !== 'all' && onlyGame !== game) continue;
    const context = await browser.newContext({ ...device }), page = await context.newPage(), errors = [];
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
    try { await run(page); assert.deepEqual(errors.filter(e => !(context.labDown && /human\.adamwhite\.work|Load failed|Failed to fetch|ERR_CONNECTION_REFUSED/.test(e))), [], 'page errors'); console.log(`ok   ${game} on ${phone}`); }
    catch (e) { failed++; console.log(`FAIL ${game} on ${phone}: ${e.message}`); if (errors.length) console.log('     ' + errors.join('\n     ')); }
    await context.close();
  }
  await browser.close();
}
server.close();
process.exit(failed ? 1 : 0);
