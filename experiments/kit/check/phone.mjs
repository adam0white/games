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
    await page.evaluate(() => { localStorage.setItem('lantern-night', '3'); localStorage.setItem('lantern-bank', '120'); localStorage.setItem('lantern-owned', '["red"]'); localStorage.setItem('lantern-worn', '{"boat":"red"}'); localStorage.setItem('lantern-best-3', '40'); localStorage.setItem('lantern-best-endless', '55'); localStorage.setItem('lantern-best-tower', '4'); localStorage.setItem('lantern-stats', '{"red":1}'); localStorage.setItem('notes.k', 'check'); });
    await page.reload();
    let st = await state();
    assert.equal(st.opened, 3, 'old save: opened night'); assert.equal(st.bank, 120, 'old save: bank'); assert.ok(st.owned.includes('red'), 'old save: owned'); assert.equal(st.worn.boat, 'red', 'old save: worn');
    assert.equal(await page.textContent('#play'), 'Play night 3'); assert.match(await page.textContent('#about'), /Best 40%/);
    await until(page, () => document.getElementById('notes-button'), 'notes button');
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
    assert.match(await page.textContent('#continue'), /^Continue as /, 'old save: continues'); assert.match(await page.textContent('#look'), /^Look: /);
    await until(page, () => document.getElementById('notes-button'), 'notes button');
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
    // Pause by the button, by P, and when the page is hidden.
    await page.click('#pause'); assert.equal(await mode(), 'paused');
    const t0 = await page.evaluate(() => window.__ant.s.t); await sleep(300); assert.equal(await page.evaluate(() => window.__ant.s.t), t0, 'time stands still while paused');
    await page.click('#resume'); assert.equal(await mode(), 'play');
    await page.keyboard.press('p'); assert.equal(await mode(), 'paused'); await page.keyboard.press('p'); assert.equal(await mode(), 'play');
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); delete document.hidden; });
    assert.equal(await mode(), 'paused', 'hiding the page pauses'); await page.click('#resume');
    await page.evaluate(() => dispatchEvent(new Event('blur'))); assert.equal(await mode(), 'paused', 'losing focus pauses'); await page.keyboard.press('P'); assert.equal(await mode(), 'play', 'capital P resumes');
    // Death costs one level and is saved at once.
    await page.evaluate(() => { const { s, FORMS, me } = window.__ant, p = s.player, m = s.mobs.find(m => FORMS[m.f].power > me(s).power); p.safe = 0; p.x = m.x; p.y = m.y; });
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
