// Phone smoke test for Borrowed Time: node experiments/borrowed/check.mjs [webkit|chromium]
// Serves experiments/ on a free port, answers /notes/button.js with an empty script and the lab endpoint itself,
// and plays real three-chapter runs with touch pointer events on WebKit (iPhone 13) and Chromium (Pixel 7).
// The answers of a fixed seed, and which picture of each puzzle lies, are worked out here in Node from sim.js; the page
// never exposes either.
// Screenshots go to $SHOTS (default: a folder in the system temp directory, not the repo).
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { gunzipSync } from 'node:zlib';
import assert from 'node:assert/strict';
import { newRun, nextChapter, roleId, solvePuzzle, LIFE, WRONG, PICK, SHOW } from './sim.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = process.env.SHOTS || join(tmpdir(), 'borrowed-shots');
await mkdir(SHOTS, { recursive: true });
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/notes/button.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(''); }
  let file = join(root, normalize(decodeURIComponent(url.pathname)));
  if (url.pathname.endsWith('/')) file = join(file, 'index.html');
  try {
    if (!file.startsWith(root)) throw 0;
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' }); res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;

// $PLAYWRIGHT (a node_modules directory or the package itself) wins; then anything Node resolves from here; then the
// Human Framework checkout's node_modules, which this check used before.
const from = process.env.PLAYWRIGHT ? [resolve(process.env.PLAYWRIGHT, 'x.js')] : [import.meta.url, join(homedir(), 'code/human-framework/node_modules/x.js')];
const pw = (() => { for (const f of from) { try { return createRequire(f)('playwright'); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; } } throw new Error('playwright not found: set PLAYWRIGHT to a node_modules directory that has it'); })();
const { webkit, chromium, devices } = pw;
const PHONES = { webkit: [webkit, devices['iPhone 13']], chromium: [chromium, devices['Pixel 7']] };
const sleep = ms => new Promise(done => setTimeout(done, ms));
async function until(page, fn, what, ms = 8000, arg = null) { try { await page.waitForFunction(fn, arg, { timeout: ms }); } catch { throw new Error(`timed out waiting for: ${what}`); } }
const finger = (page, sel, steps) => page.evaluate(([sel, steps]) => {
  const el = document.querySelector(sel);
  for (const [type, x, y] of steps) el.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, pressure: type === 'pointerup' ? 0 : 0.5, bubbles: true, cancelable: true }));
}, [sel, steps]);
const tap = (page, p) => finger(page, '#c', [['pointerdown', p.x, p.y], ['pointerup', p.x, p.y]]);
const state = page => page.evaluate(() => window.borrowedState());
const shot = (page, phone, name) => page.screenshot({ scale: 'css', path: join(SHOTS, `${phone}-${name}.png`) });

// Walk to a tile by taps. A tile off screen is tapped at the edge of the view, then again once the camera follows.
// A memory passed on the way opens its puzzle: it is left for later, and the walk goes on.
async function goTo(page, tx, ty, done = st => st.player.tx === tx && st.player.ty === ty) {
  for (let i = 0; i < 14; i++) {
    let st = await state(page);
    if (done(st)) return st;
    if (st.screen === 'puzzle') {
      const puzzle = await finishPractice(page);
      await tap(page, puzzle.later);
      await until(page, () => window.borrowedState().screen === 'play', 'left for later', 3000);
      continue;
    }
    const x = st.mapX + (tx + 0.5) * st.tile;
    const y = Math.max(st.viewTop + 8, Math.min(st.viewBottom - 8, st.viewTop + (ty + 0.5) * st.tile - st.cam));
    await tap(page, { x, y });
    await until(page, () => { const s = window.borrowedState(); return !s.player.moving || s.memoryShowing || s.screen === 'puzzle'; }, 'the walk ends', 12000);
    await sleep(250); // the camera catches up
  }
  const st = await state(page);
  if (!done(st)) throw new Error(`could not walk to ${tx},${ty} (at ${st.player.tx},${st.player.ty})`);
  return st;
}
async function skipMemory(page, phone, name) {
  await until(page, () => window.borrowedState().memoryShowing, 'the memory scene');
  await sleep(700);
  if (name) await shot(page, phone, name);
  const st = await state(page);
  await tap(page, { x: 20, y: st.viewTop + 40 });
  await until(page, () => !window.borrowedState().memoryShowing, 'the memory flies to the journal', 4000);
}
async function pick(page, face) {
  const st = await state(page);
  await tap(page, st.buttons.who);
  await until(page, () => window.borrowedState().screen === 'lineup', 'the picture choice opens');
  const lu = await state(page);
  assert.equal(lu.cards.length, 6, 'six faces');
  await tap(page, lu.cards[face]);
  assert.equal((await state(page)).selected, face, 'tap selects a face');
  return lu;
}

const SEED = 7;
// The run of a seed as it stands at the start of chapter k (0, 1, 2).
const chapterOf = (seed, k) => { const s = newRun(seed); for (let j = 0; j < k; j++) { s.status = 'named'; nextChapter(s); } return s; };
const truths = [0, 1, 2].map(k => chapterOf(SEED, k)), answers = truths.map(s => s.answer);
const puzzleOf = (seed, k, lock) => chapterOf(seed, k).spots.find(p => p.lock === lock).puzzle;
const correctTap = z => z.form === 'torn' ? 1 - z.liar : z.liar;
const atMemory = lock => s => s.screen === 'puzzle' || s.memoryShowing || s.spots.find(p => p.lock === lock).taken;
async function waitPuzzle(page) {
  await until(page, () => {
    const { screen, puzzle } = window.borrowedState();
    return screen === 'puzzle' && puzzle?.cards.length === 2 && !puzzle.solving;
  }, 'a puzzle opens');
  return (await state(page)).puzzle;
}
const practicePick = { lie: 0, torn: 1, signed: 0 };
async function finishPractice(page, o = {}) {
  const pz = await waitPuzzle(page);
  if (o.expected !== undefined) assert.equal(pz.practice, o.expected, `practice state for ${pz.form}`);
  if (!pz.practice) return pz;
  const before = await state(page);
  assert.equal(pz.show, null, 'practice has no paid hint');
  assert.equal(pz.later, null, 'practice has no live puzzle controls');
  const pick = practicePick[pz.form];
  if (o.shot) { await sleep(750); await o.shot(); }
  if (!pz.practiceResult) {
    await tap(page, pz.cards[1 - pick]);
    assert.equal((await state(page)).puzzle.practiceResult, false, 'a wrong practice tap is free and leaves practice open');
    await tap(page, pz.cards[pick]);
  }
  await until(page, () => window.borrowedState().puzzle?.practice === false, 'practice closes and the real puzzle opens');
  const after = await state(page);
  assert.equal(after.life, before.life, 'practice costs zero years');
  assert.equal(after.found, before.found, 'practice wins no memory');
  assert.deepEqual(after.known, before.known, 'practice teaches no facts about this life');
  assert.deepEqual(after.liesWon, before.liesWon, 'practice records no live attempts');
  return after.puzzle;
}
async function solve(page, phone, seed, k, lock, o = {}) {
  const pz = await finishPractice(page, {
    expected: o.practice,
    shot: o.shots?.practice ? () => shot(page, phone, o.shots.practice) : null,
  });
  assert.equal(pz.lock, lock, `the ${lock} puzzle is open`);
  const vp = page.viewportSize();
  assert.ok([...pz.cards, pz.later, pz.show].every(c => c.x > 20 && c.x < vp.width - 20 && c.y > 60 && c.y < vp.height - 20), 'pictures and buttons fit');
  if (o.shots?.open) await shot(page, phone, o.shots.open);
  const right = correctTap(puzzleOf(seed, k, lock));
  if (o.wrong) {
    const other = 1 - right, y0 = (await state(page)).life;
    await tap(page, pz.cards[other]);
    const st = await state(page);
    assert.ok(Math.abs(y0 - st.life - PICK) < 1e-6, `a wrong tap costs ${PICK} years`);
    assert.ok(st.puzzle.tried[other] && st.screen === 'puzzle', 'the wrong pick is marked and the puzzle stays open');
    if (o.shots?.wrong) { await sleep(200); await shot(page, phone, o.shots.wrong); }
    await tap(page, pz.cards[other]);
    assert.equal((await state(page)).life, st.life, 'repeated wrong tap is free');
  }
  if (o.show) {
    const y0 = (await state(page)).life;
    await tap(page, pz.show);
    assert.ok(Math.abs(y0 - (await state(page)).life - SHOW) < 1e-6, `Show me costs ${SHOW} years`);
    if (o.shots?.shown) await shot(page, phone, o.shots.shown);
  } else {
    await tap(page, pz.cards[right]);
    assert.equal((await state(page)).puzzle?.how, 'found', 'the correct photo solves the puzzle');
    if (o.shots?.found) await shot(page, phone, o.shots.found);
  }
  await until(page, () => window.borrowedState().memoryShowing, 'the memory shows after the puzzle');
}
// Walk to a memory and open what guards it; ends when its puzzle opens (or, without lies, its memory shows).
async function openMemory(page, seed, k, lock) {
  const t = chapterOf(seed, k), sp = t.spots.find(p => p.lock === lock);
  const fill = () => page.evaluate(() => { const s = window.borrowedSim(); s.life = Math.max(s.life, 80); });
  if (lock === 'push') {
    const b = [[0, 1], [0, -1], [1, 0], [-1, 0]].map(([dx, dy]) => ({ x: sp.x + dx, y: sp.y + dy })).find(q => t.grid[q.y * t.w + q.x] === 'B');
    await goTo(page, b.x, b.y, s => s.ready.push); await fill(); await tap(page, (await state(page)).buttons.push);
  } else if (lock === 'leap') {
    const st = await state(page);
    if (!(await page.evaluate(() => window.borrowedSim().bridge))) {
      await goTo(page, st.pad.tx, st.pad.ty, s => s.ready.leap); await fill(); await tap(page, (await state(page)).buttons.leap);
      await until(page, () => !window.borrowedState().player.moving, 'the leap lands', 4000);
    }
  } else if (lock === 'dark') {
    await goTo(page, sp.x, sp.y, s => s.ready.glow); await fill(); await tap(page, (await state(page)).buttons.glow);
  } else if (lock === 'rewind') {
    await goTo(page, sp.x, sp.y, s => s.ready.rewind); await fill(); await tap(page, (await state(page)).buttons.rewind);
    return;
  }
  await goTo(page, sp.x, sp.y, atMemory(lock));
}
const truth = truths[0];
// Name a face: tap it, then "That's me!" (or tap it again).
async function nameFace(page, face, again = false) {
  await pick(page, face);
  if (again) await tap(page, (await state(page)).cards[face]);
  else await tap(page, (await state(page)).sure);
}
// After a name in chapter 1 or 2: the chapter card, then "Go on".
async function goOn(page, phone, name) {
  await until(page, () => window.borrowedState().screen === 'chapter', 'the chapter card', 6000);
  await until(page, () => window.borrowedState().nextReady, 'the chapter button is ready');
  if (name) await shot(page, phone, name);
  const st = await state(page);
  assert.ok(st.chapterMenu, 'the chapter card has a Menu button');
  assert.ok(st.chapterControls.every(b => b.w >= 40 && b.h >= 40 && b.x >= 0 && b.y >= 0 && b.x + b.w <= page.viewportSize().width && b.y + b.h <= page.viewportSize().height), 'chapter controls fit and have 40 px tap targets');
  assert.ok(st.next, 'the chapter card has a Go on button');
  await tap(page, st.next);
  await until(page, () => window.borrowedState().screen === 'play', 'the next chapter starts', 3000);
}
const clockMoves = async (page, what) => {
  const c = (await state(page)).clock; await sleep(250);
  assert.ok((await state(page)).clock > c, `the game still runs after ${what}`);
};

// The house rules from kit/check/phone.mjs: no zoom, and Play, pause, Menu sends one run ('left') and one events record.
async function houseRules(page) {
  const sent = page.context().labSent;
  await page.goto(`${base}/borrowed/?labRunSource=agent`);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('hf-lab-send-localhost', '1'); });
  await page.reload();
  await until(page, () => window.borrowedState?.().screen === 'menu', 'menu');
  const r = await page.evaluate(() => {
    const loose = [...document.querySelectorAll('body *')].filter(el => el.getClientRects().length && getComputedStyle(el).touchAction === 'auto').map(el => el.id || el.tagName);
    const ev = new MouseEvent('dblclick', { bubbles: true, cancelable: true }); document.body.dispatchEvent(ev);
    return { meta: document.querySelector('meta[name=viewport]').content, loose, cancelled: ev.defaultPrevented };
  });
  assert.match(r.meta, /maximum-scale=1/); assert.deepEqual(r.loose, [], 'no visible element at touch-action auto'); assert.ok(r.cancelled, 'a double tap does not zoom');
  assert.equal(await page.evaluate(() => window.audioLog.made), 0, 'no audio before a touch');
  await page.click('#play'); await until(page, () => window.borrowedState().screen !== 'menu', 'a run starts');
  assert.equal(await page.evaluate(() => window.audioLog.made), 1, 'Play starts audio');
  await page.evaluate(() => { const el = document.querySelector('#pause'); el.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 9, pointerType: 'touch', bubbles: true, cancelable: true })); el.click(); });
  await until(page, () => window.borrowedState().paused === true, 'pause');
  await page.click('#toMenu'); await until(page, () => window.borrowedState().screen === 'menu', 'back on the menu');
  for (let i = 0; i < 80 && !(sent.some(r => r.game === 'borrowed' && r.kind === 'run') && sent.some(r => r.game === 'borrowed' && r.kind === 'events')); i++) await sleep(100);
  await sleep(300);
  assert.equal(sent.filter(r => r.game === 'borrowed' && r.kind === 'events').length, 1, 'one events record');
  const runs = sent.filter(r => r.game === 'borrowed' && r.kind === 'run');
  assert.equal(runs.length, 1, 'one run sent'); assert.equal(runs[0].data.outcome, 'left'); assert.equal(runs[0].runSource, 'agent');
  sent.length = 0;
}

// The shared first-time hint (kit/hint.js), forced on with ?hint=hand: a finger tapping shows after 3 s of idle play, above
// the ability bar; a real tap on the island removes it and reaches the game.
async function firstHint(page) {
  const on = () => page.evaluate(() => !!document.querySelector('.kit-hint.on'));
  await page.goto(`${base}/borrowed/?seed=${SEED}&hint=hand`); await until(page, () => window.borrowedState?.().screen === 'menu', 'menu');
  await page.click('#play'); await sleep(1000);
  assert.equal(await on(), false, 'hint: not before 3 s of idle play');
  await until(page, () => !!document.querySelector('.kit-hint.on'), 'hint: shown after idle play', 8000);
  assert.equal(await page.evaluate(() => document.querySelector('.kit-hint').dataset.kind), 'tap', 'hint: a tap');
  const p = await page.evaluate(() => { const r = document.querySelector('.kit-hint .knob').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  assert.ok(p.y < (await state(page)).buttons.who.y - 42 - 90, 'hint: the finger stays above the ability bar');
  await tap(page, p);
  assert.equal(await page.evaluate(() => document.querySelector('.kit-hint')), null, 'hint: a real tap removes it');
  assert.ok((await state(page)).touched, 'hint: the tap reached the game');
  await page.evaluate(() => { const el = document.querySelector('#pause'); el.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 9, pointerType: 'touch', bubbles: true, cancelable: true })); el.click(); });
  await page.click('#toMenu'); await until(page, () => window.borrowedState().screen === 'menu', 'back on the menu');
}

// Push, Leap and Rewind in the browser, with their effects drawn. The candle is topped up between them.
async function abilityTour(page, phone) {
  const fill = () => page.evaluate(L => { window.borrowedSim().life = L; }, LIFE);
  const truth = truths[1]; // the grown-up's island has every lock
  const pushSpot = truth.spots.find(p => p.lock === 'push');
  const boulder = [[0, 1], [0, -1], [1, 0], [-1, 0]].map(([dx, dy]) => ({ x: pushSpot.x + dx, y: pushSpot.y + dy })).find(b => truth.grid[b.y * truth.w + b.x] === 'B');
  assert.ok(boulder, 'a boulder guards the push memory');
  let st = await state(page);
  // Push
  await goTo(page, boulder.x, boulder.y, s => s.ready.push);
  await fill(); st = await state(page);
  await tap(page, st.buttons.push);
  assert.ok((await state(page)).years <= LIFE - 13, 'Push costs 13 years');
  await sleep(120); await shot(page, phone, '13-push');
  await clockMoves(page, 'Push');
  await goTo(page, pushSpot.x, pushSpot.y, atMemory('push'));
  await solve(page, phone, SEED, 1, 'push', { show: true, shots: { shown: '13b-puzzle-shown' } });
  await skipMemory(page, phone, null);
  // Leap
  st = await state(page);
  await goTo(page, st.pad.tx, st.pad.ty, s => s.ready.leap);
  await fill(); st = await state(page);
  await tap(page, st.buttons.leap);
  assert.ok((await state(page)).years <= LIFE - 16, 'Leap costs 16 years');
  await sleep(200); await shot(page, phone, '14-leap');
  await until(page, () => !window.borrowedState().player.moving, 'the leap lands', 4000);
  await clockMoves(page, 'Leap');
  const leapSpot = st.spots.find(p => p.lock === 'leap');
  await goTo(page, leapSpot.tx, leapSpot.ty, atMemory('leap'));
  // Later: the memory waits, marked on the island; a tap on your own tile opens it again
  let pzl = await waitPuzzle(page);
  await tap(page, pzl.later);
  st = await state(page);
  assert.equal(st.screen, 'play', 'Later closes the puzzle');
  assert.deepEqual(st.waiting, ['leap'], 'the leap memory waits');
  await sleep(400); await shot(page, phone, '14b-later');
  await clockMoves(page, 'Later');
  await tap(page, st.player);
  await solve(page, phone, SEED, 1, 'leap', {});
  await skipMemory(page, phone, null);
  await sleep(700); await shot(page, phone, '15-bridge');
  // Rewind
  const mirror = st.spots.find(p => p.lock === 'rewind');
  await goTo(page, mirror.tx, mirror.ty, s => s.ready.rewind);
  await fill(); st = await state(page);
  await tap(page, st.buttons.rewind);
  assert.ok((await state(page)).years <= LIFE - 20, 'Rewind costs 20 years');
  await solve(page, phone, SEED, 1, 'rewind', { shots: { open: '16a-puzzle-mirror' } });
  await skipMemory(page, phone, '16-rewind-memory');
  await sleep(600); await shot(page, phone, '17-mirror-mended');
  await clockMoves(page, 'Rewind');
  st = await state(page);
  assert.equal(st.found, 3, 'three memories from the three locks');
  assert.equal(st.liesWon.shown, 1, 'one memory bought');
  assert.equal(st.chapter, 1);
  await finger(page, '#pause', [['pointerdown', 0, 0]]);
  await page.click('#toMenu');
  await until(page, () => window.borrowedState().screen === 'menu', 'back on the menu');
}

async function run(page, phone) {
  const sent = page.context().labSent;
  await houseRules(page);
  await page.goto(`${base}/borrowed/?seed=${SEED}&labRunSource=agent`);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('hf-lab-send-localhost', '1'); });
  await page.reload();
  await until(page, () => window.borrowedState && window.borrowedState().screen === 'menu', 'state hook on the menu');
  assert.match(await page.textContent('#menu'), /The game lab records play/, 'lab notice on the menu');
  assert.equal(await page.evaluate(() => window.audioLog.made), 0, 'no sound before a touch');
  await sleep(500); await shot(page, phone, '1-menu');

  // Run 1, chapter 1: the free memory, a pause mid-walk, the dark memory by Light, then the right face.
  await page.click('#play');
  let st = await state(page);
  assert.equal(st.screen, 'play'); assert.equal(st.seed, SEED); assert.equal(st.years, LIFE); assert.equal(st.chapter, 0);
  await sleep(600); await shot(page, phone, '2-start-hint');
  const free = st.spots.find(p => p.lock === 'free'), dark = st.spots.find(p => p.lock === 'dark');
  assert.ok(!st.spots.some(p => p.lock === 'rewind'), 'the child has no mirror');
  await goTo(page, free.tx, free.ty, atMemory('free'));
  // the first puzzle of a first run: the ghost finger teaches it
  await solve(page, phone, SEED, 0, 'free', { practice: true, shots: { practice: '3a-puzzle-teach', found: '3b-puzzle-found' } });
  await skipMemory(page, phone, '3-memory');
  st = await state(page);
  assert.equal(st.found, 1, 'the free memory is found');
  assert.equal(st.taught & 1, 1, 'the island hand is taught');
  assert.equal(st.practice, 1, 'the first practice pair is done');
  assert.ok(st.candidates.length >= 1 && st.candidates.length < 6, 'the first memory narrows the portraits');
  assert.ok(st.known.filter(v => v !== null).length >= 1, 'a kind is known');

  // pause while walking: time and place stand still, then go on
  const far = { x: st.mapX + (dark.tx + 0.5) * st.tile, y: Math.max(st.viewTop + 8, Math.min(st.viewBottom - 8, st.viewTop + (dark.ty + 0.5) * st.tile - st.cam)) };
  await tap(page, far);
  await until(page, () => window.borrowedState().player.moving, 'walking');
  await finger(page, '#pause', [['pointerdown', 0, 0]]);
  st = await state(page); assert.ok(st.paused, 'pause button pauses');
  assert.ok(await page.isVisible('#toMenu'), 'pause card has a Menu button');
  assert.match(await page.textContent('#paused'), /Each right name: 100.*10 ÷ 3/, 'pause explains scoring');
  await sleep(400);
  const frozen = await state(page);
  assert.equal(frozen.t, st.t, 'time stands still while paused');
  assert.deepEqual(frozen.player, st.player, 'the player stands still while paused');
  await shot(page, phone, '4-paused');
  await page.click('#resume');
  await until(page, t => window.borrowedState().t > t, 'time runs again', 4000, st.t);
  const before = (await state(page)).years;
  await goTo(page, dark.tx, dark.ty, s => Math.abs(s.player.tx - dark.tx) + Math.abs(s.player.ty - dark.ty) <= 1 && s.ready.glow);
  st = await state(page);
  assert.ok(st.ready.glow, 'Light is ready by the dark patch');
  await sleep(300); await shot(page, phone, '5-light-ready');
  await tap(page, st.buttons.glow);
  st = await state(page);
  assert.ok(st.years <= before - 10, `Light costs ten years (${before} -> ${st.years})`);
  assert.ok(st.spots.find(p => p.lock === 'dark').open, 'the dark memory is lit');
  await goTo(page, dark.tx, dark.ty, atMemory('dark'));
  // a clue puzzle: a wrong tap first
  await solve(page, phone, SEED, 0, 'dark', { wrong: true, shots: { open: '5a-puzzle-clue', wrong: '5b-puzzle-wrong' } });
  await skipMemory(page, phone, null);
  assert.equal((await state(page)).found, 2, 'the dark memory is found');
  // a tap on an ability with nothing to use it on costs nothing
  const cheap = (await state(page)).years;
  st = await state(page);
  const idle = ['leap', 'rewind', 'push'].find(id => !st.ready[id]);
  await tap(page, st.buttons[idle]);
  assert.ok((await state(page)).years >= cheap, 'a useless ability tap costs nothing');
  await pick(page, answers[0]);
  await sleep(300); await shot(page, phone, '6-lineup');
  await tap(page, (await state(page)).sure);
  await until(page, () => window.borrowedState().outcome === 'right', 'named right');
  await sleep(1200); await shot(page, phone, '6b-reveal');
  const carried = (await state(page)).years;
  await goOn(page, phone, '7-chapter-card');
  st = await state(page);
  assert.equal(st.chapter, 1, 'chapter 2'); assert.equal(st.years, carried, 'the years carry over');
  assert.deepEqual(st.chapters.map(c => c.right), [true]);
  assert.ok(st.spots.some(p => p.lock === 'rewind'), 'the grown-up has the mirror');
  await sleep(300); await shot(page, phone, '7b-chapter-2');
  // Chapter 2: a wrong name at once (double tap) costs WRONG years and the chapter, not the run.
  const y2 = st.years;
  await nameFace(page, (answers[1] + 1) % 6, true);
  await until(page, () => window.borrowedState().outcome === 'wrong', 'named wrong');
  st = await state(page);
  assert.ok(st.years <= y2 - WRONG && st.years >= y2 - WRONG - 1, `a wrong name costs ${WRONG} years (${y2} -> ${st.years})`);
  assert.equal(st.status, 'named', 'the run goes on');
  await sleep(900); await shot(page, phone, '8-wrong');
  await goOn(page, phone, null);
  st = await state(page);
  assert.equal(st.chapter, 2, 'chapter 3');
  assert.ok(!st.spots.some(p => p.lock === 'free'), 'the old one has no free memory');
  assert.equal(new Set(st.spots.filter(p => p.lock !== 'rewind').flatMap(p => p.dims)).size, 4, 'all four kinds are available without Rewind');
  await sleep(300); await shot(page, phone, '8b-chapter-3');
  await nameFace(page, answers[2]);
  await until(page, () => window.borrowedState().screen === 'done', 'end card');
  st = await state(page);
  assert.equal(st.status, 'mistaken'); assert.deepEqual(st.chapters.map(c => c.right), [true, false, true]);
  const partialScore = 200 + Math.floor(st.years * 10 * 2 / 3);
  assert.equal(st.score, partialScore, 'two selves keep two thirds of the years bonus');
  assert.equal(st.best, partialScore);
  assert.match(await page.textContent('#doneChose'), /years left.*year points/, 'the year bonus is explained after a wrong name');
  assert.match(await page.textContent('#doneTitle'), /mostly/);
  assert.match(await page.textContent('#doneChose'), /1 wrong name/);
  await sleep(500); await shot(page, phone, '9-end-mistaken');
  assert.equal(await page.evaluate(() => window.audioLog.made), 1, 'one audio context for the whole run');

  // Run 2: all three named right at once.
  await page.click('#again');
  st = await state(page); assert.equal(st.screen, 'play'); assert.equal(st.years, LIFE); assert.equal(st.chapter, 0);
  for (let k = 0; k < 3; k++) {
    await nameFace(page, answers[k], k === 1);
    if (k < 2) await goOn(page, phone, null);
  }
  await until(page, () => window.borrowedState().screen === 'done', 'end card after three names');
  st = await state(page);
  assert.equal(st.status, 'remembered');
  assert.ok(st.score > 300 && st.best === st.score, `three selves and the years left (${st.score})`);
  assert.match(await page.textContent('#doneTitle'), /remember your life/);
  await sleep(600); await shot(page, phone, '10-end-remembered');

  // Run 3: the candle burns out in chapter 1.
  await page.click('#again');
  await page.evaluate(() => { window.borrowedSim().life = 0.3; });
  await until(page, () => window.borrowedState().outcome === 'faded', 'faded');
  await sleep(1500); await shot(page, phone, '11-faded');
  await until(page, () => window.borrowedState().screen === 'done', 'end card after fading');
  assert.equal((await state(page)).status, 'faded');

  // Run 4: leave through the pause card; then losing the screen pauses and P resumes.
  await page.click('#again');
  await page.evaluate(() => dispatchEvent(new Event('blur')));
  assert.ok((await state(page)).paused, 'losing focus pauses');
  await page.keyboard.press('p'); assert.ok(!(await state(page)).paused, 'P resumes');
  await finger(page, '#pause', [['pointerdown', 0, 0]]);
  await page.click('#toMenu');
  await until(page, () => window.borrowedState().screen === 'menu', 'back on the menu');
  for (let i = 0; i < 40 && !sent.some(r => r.kind === 'run' && r.data.outcome === 'left'); i++) await sleep(100);

  // The save survives a reload.
  await page.reload();
  await until(page, () => window.borrowedState && window.borrowedState().screen === 'menu', 'state hook after reload');
  st = await state(page);
  const roles = new Set(truths.map(s => roleId(s.faces[s.answer]))).size;
  assert.ok(st.best > 300, 'best saved'); assert.equal(st.gallery, roles, 'gallery saved'); assert.equal(st.runs, 3, 'runs saved');
  const blob = await page.evaluate(() => JSON.parse(localStorage.getItem('borrowed-save')));
  assert.equal(Object.keys(blob.gallery).length, roles); assert.equal(blob.v, 1);
  assert.match(await page.textContent('#bestLine'), new RegExp(`Found ${roles} of 16`));
  await sleep(300); await shot(page, phone, '12-menu-after');

  // Run 5: chapter 1 named, then Push, Leap and Rewind on the grown-up's island; then leave.
  await page.click('#play');
  await nameFace(page, answers[0]);
  await goOn(page, phone, null);
  await abilityTour(page, phone);

  // Lab recording: one run per outcome.
  await sleep(400);
  const runs = sent.filter(r => r.game === 'borrowed' && r.kind === 'run');
  const outcomes = runs.map(r => r.data.outcome);
  for (const o of ['remembered', 'mistaken', 'faded', 'left']) assert.ok(outcomes.includes(o), `${o} run sent (${outcomes})`);
  assert.equal(runs.length, 5, `five runs (${outcomes})`);
  const first = runs.find(r => r.data.outcome === 'mistaken');
  assert.equal(first.data.start.seed, SEED);
  assert.equal(first.data.summary.score, partialScore);
  assert.deepEqual(first.data.summary.chapters.map(c => c.right), [true, false, true], 'per-chapter results in the summary');
  assert.equal(first.data.events.filter(e => e.type === 'chapter').length, 3, 'a chapter event for each chapter');
  assert.ok(first.data.events.some(e => e.type === 'memory'), 'memory events recorded');
  assert.ok(first.data.events.some(e => e.type === 'puzzle') && first.data.events.some(e => e.type === 'pick' && e.data.right === false) && first.data.events.some(e => e.type === 'pick' && e.data.right === true), 'puzzle and pick events recorded');
  assert.equal(first.data.summary.lies.wrong, 1, 'the run summary counts the wrong tap');
  assert.ok(first.data.events.some(e => e.type === 'ability'), 'ability event recorded');
  const all = runs.find(r => r.data.outcome === 'remembered');
  assert.ok(all.data.summary.score > 300 && all.data.summary.right === 3);
  assert.ok(runs.every(r => r.runSource === 'agent'));
  assert.ok(runs.every(r => r.data.events.length < 300), 'events stay sparse');

  // A chapter card can leave the run and reports exactly one left outcome.
  const leftBefore = sent.filter(r => r.kind === 'run' && r.data.outcome === 'left').length;
  await page.click('#play'); await nameFace(page, answers[0]);
  await until(page, () => window.borrowedState().screen === 'chapter' && window.borrowedState().chapterMenu && window.borrowedState().nextReady, 'chapter Menu');
  await shot(page, phone, '18-chapter-exit');
  await tap(page, (await state(page)).chapterMenu);
  assert.equal((await state(page)).screen, 'menu', 'Menu leaves the chapter card');
  await until(page, () => window.borrowedState().screen === 'menu', 'menu after chapter exit');
  for (let i = 0; i < 40 && sent.filter(r => r.kind === 'run' && r.data.outcome === 'left').length === leftBefore; i++) await sleep(100);
  assert.equal(sent.filter(r => r.kind === 'run' && r.data.outcome === 'left').length, leftBefore + 1, 'chapter exit sends one left run');

  // Lethal Rewind emits a memory and fading together; only the fading scene may remain.
  await page.click('#play'); await nameFace(page, answers[0]); await goOn(page, phone, null);
  await page.evaluate(() => { const s = window.borrowedSim(), p = s.spots.find(p => p.lock === 'rewind'); s.px = p.x + 0.5; s.py = p.y + 0.5; s.path = []; s.life = 19; });
  await tap(page, (await state(page)).buttons.rewind);
  await until(page, () => window.borrowedState().outcome === 'faded', 'lethal Rewind fades');
  assert.equal((await state(page)).memoryShowing, false, 'a lethal Rewind does not leave a memory overlay');
  assert.equal((await state(page)).puzzle, null, 'a lethal Rewind opens no puzzle');
  await until(page, () => window.borrowedState().screen === 'done', 'end card after lethal Rewind');
  // A wrong tap that empties the candle, and a Show me that does: both fade, with no puzzle left over.
  for (const how of ['wrong', 'show']) {
    await page.click('#again');
    await page.evaluate(() => { window.borrowedSim().life = 4; });
    const f = (await state(page)).spots.find(p => p.lock === 'free');
    await goTo(page, f.tx, f.ty, atMemory('free'));
    const pz = await finishPractice(page), liar = puzzleOf(SEED, 0, 'free').liar;
    await tap(page, how === 'wrong' ? pz.cards[1 - liar] : pz.show);
    await until(page, () => window.borrowedState().outcome === 'faded', `a lethal ${how} fades`);
    assert.equal((await state(page)).puzzle, null, 'no puzzle over the fading scene');
    await until(page, () => window.borrowedState().screen === 'done', `end card after a lethal ${how}`);
  }
}

// A player heads to the dependent memory too early, returns with the clue, then closes both signed memories.
async function puzzleTour(page, tag, seed) {
  await page.goto(`${base}/borrowed/?seed=${seed}`);
  await page.evaluate(() => localStorage.clear());
  await page.reload(); await until(page, () => window.borrowedState?.().screen === 'menu', 'menu');
  await page.click('#play');
  const decks = [0, 1, 2].map(k => chapterOf(seed, k));
  async function visit(k, lock, options) {
    await openMemory(page, seed, k, lock);
    await solve(page, tag, seed, k, lock, options);
    await skipMemory(page, tag, null);
  }

  await visit(0, 'free', { practice: true, shots: { practice: 'p1-practice' } });
  await visit(0, 'dark', { wrong: true, shots: { wrong: 'p2-wrong-tap' } });
  await nameFace(page, decks[0].answer); await goOn(page, tag, null);
  await visit(1, 'free');
  const grown = decks[1], dark = puzzleOf(seed, 1, 'dark');
  assert.equal(solvePuzzle(grown.faces, (await state(page)).known, dark), -1, 'entry alone leaves two explanations');
  await openMemory(page, seed, 1, 'dark');
  await tap(page, (await waitPuzzle(page)).later);
  await until(page, () => window.borrowedState().screen === 'play', 'Later closes the dark memory');
  assert.ok((await state(page)).waiting.includes('dark'), 'the dark memory waits');
  await shot(page, tag, 'p3-later');
  await visit(1, 'push', { practice: true, wrong: true, shots: { open: 'p4-torn-paper' } });
  assert.equal(solvePuzzle(grown.faces, (await state(page)).known, dark), dark.liar, 'the new fact settles the dependent memory');
  const darkSpot = grown.spots.find(p => p.lock === 'dark');
  await goTo(page, darkSpot.x, darkSpot.y, atMemory('dark'));
  await finger(page, '#pause', [['pointerdown', 0, 0]]);
  await until(page, () => window.borrowedState().paused, 'pause on a puzzle');
  const life = (await state(page)).life;
  await sleep(250);
  assert.equal((await state(page)).life, life);
  await page.keyboard.press('p');
  assert.equal((await state(page)).puzzle.lock, 'dark', 'the same puzzle resumes');
  await solve(page, tag, seed, 1, 'dark', { shots: { open: 'p5-chained-photos' } });
  await skipMemory(page, tag, null);
  await nameFace(page, grown.answer); await goOn(page, tag, null);

  await visit(2, 'push');
  const before = await state(page);
  const old = decks[2], signed = puzzleOf(seed, 2, 'dark');
  assert.equal(solvePuzzle(old.faces, before.known, signed), -1, 'old entry does not settle the dependent memory');
  await visit(2, 'leap', { practice: true, shots: { practice: 'p6-seal-practice' } });
  const seals = await page.evaluate(() => window.borrowedSim().exposed);
  assert.equal(seals.length, 1, 'the first liar leaves an exposed seal');
  assert.equal(solvePuzzle(old.faces, before.known, signed, seals), signed.liar, 'the recurring seal alone supplies the missing evidence');
  await visit(2, 'dark', { practice: false, shots: { open: 'p7-recurring-seal' } });
  assert.deepEqual(await page.evaluate(() => window.borrowedSim().exposed), seals, 'the repeated seal is kept once');
  await nameFace(page, old.answer);
  await until(page, () => window.borrowedState().screen === 'done', 'remembered end');
  assert.equal((await state(page)).status, 'remembered');
  await shot(page, tag, 'p8-end-album');
  await page.click('#doneAlbum');
  await shot(page, tag, 'p9-album');
  assert.equal(await page.textContent('#albumCount'), '1 / 1');

  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('borrowed-save')));
  const { album, practice, taught } = await saved();
  assert.equal(practice, 7);
  assert.equal(taught, 1);
  assert.deepEqual(album[0].chapters.map(c => c.photos.length), [2, 3, 3], 'album has a true print for each recovered memory');
  album[0].chapters.forEach((chapter, k) => {
    const answer = decks[k].faces[decks[k].answer];
    assert.deepEqual(chapter.portrait, answer);
    assert.ok(chapter.photos.every(p => p.dims.every((d, i) => p.vals[i] === answer[d])));
  });
  await page.reload(); await until(page, () => window.borrowedState?.().screen === 'menu', 'menu after reload');
  assert.deepEqual((await saved()).album, album);
  await page.click('#menuAlbum');
  assert.equal(await page.textContent('#albumCount'), '1 / 1');
  await page.click('#albumBack');
  await page.click('#play');
  await openMemory(page, seed, 0, 'free');
  assert.equal((await waitPuzzle(page)).practice, false, 'practice stays complete after reload');
  await finger(page, '#pause', [['pointerdown', 0, 0]]);
  await page.click('#toMenu');
  assert.equal((await state(page)).puzzle, null, 'Menu leaves no puzzle open');
  const next = (await saved()).album;
  assert.deepEqual(next[0], album[0], 'a second run keeps the first album page');
  assert.equal(next[1].outcome, 'left');
  assert.equal(next[1].chapters[0].portrait, null, 'an unnamed face is not added to the album');
  await page.click('#menuAlbum');
  assert.equal(await page.textContent('#albumCount'), '2 / 2');
  await page.click('#albumPrev');
  assert.equal(await page.textContent('#albumCount'), '1 / 2');
  await page.click('#albumNext');
  await page.click('#albumBack');
}

const only = process.argv[2];
let failed = 0;
for (const [phone, [engine, device]] of Object.entries(PHONES)) {
  if (only && only !== phone) continue;
  const browser = await engine.launch();
  const context = await browser.newContext({ ...device }), page = await context.newPage(), errors = [];
  context.labSent = [];
  await context.route('https://human.adamwhite.work/**', async route => {
    const req = route.request(), cors = { 'access-control-allow-origin': base, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'Content-Type' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    context.labSent.push(JSON.parse(gunzipSync(req.postDataBuffer()).toString()));
    return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: '{"ok":true}' });
  });
  await page.addInitScript(() => {
    const Real = window.AudioContext || window.webkitAudioContext; if (!Real) return;
    window.audioLog = { made: 0, suspend: 0, resume: 0 };
    window.AudioContext = window.webkitAudioContext = class extends Real {
      constructor(...a) { super(...a); window.audioLog.made++; }
      suspend() { window.audioLog.suspend++; return super.suspend(); }
      resume() { window.audioLog.resume++; return super.resume(); }
    };
  });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  try {
    await run(page, phone);
    await firstHint(page);
    if (phone === 'webkit') await puzzleTour(page, phone, 28);
    assert.deepEqual(errors, [], 'page errors');
    console.log(`ok   borrowed on ${phone}`);
  } catch (e) {
    failed++;
    console.log(`FAIL borrowed on ${phone}: ${e.message}`);
    if (errors.length) console.log('     ' + errors.join('\n     '));
    await shot(page, phone, 'fail').catch(() => {});
  }
  await context.close();
  if (phone === 'chromium') {
    // The small phone, 360 x 640, then 390 x 844. The menu fits; the island, the bar and the six faces fit on screen.
    for (const [vw, vh] of [[360, 640], [390, 844]]) {
    const tag = vw === 360 ? 'small' : `${vw}x${vh}`;
    const small = await browser.newContext({ viewport: { width: vw, height: vh }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const p2 = await small.newPage(), errs = [];
    p2.on('pageerror', e => errs.push(String(e))); p2.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    try {
      await p2.goto(`${base}/borrowed/?seed=11`); await until(p2, () => window.borrowedState, 'state hook');
      assert.ok(await p2.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll');
      const play = await p2.locator('#play').boundingBox(); assert.ok(play.y + play.height <= vh, 'Play is on screen');
      await sleep(300); await shot(p2, tag, '1-menu');
      await p2.click('#play'); let st = await state(p2);
      assert.ok(Object.values(st.buttons).every(b => b.x > 0 && b.x < vw && b.y < vh), 'the bar is on screen');
      assert.ok(st.mapX >= 0 && st.mapX + 7 * st.tile <= vw, 'the island fits across');
      await sleep(500); await shot(p2, tag, '2-play');
      await finger(p2, '#pause', [['pointerdown', 0, 0]]);
      assert.ok((await state(p2)).paused, 'pause on the small phone');
      await sleep(300); await shot(p2, tag, '2a-paused');
      await p2.click('#resume');
      // the free memory and its portrait strip
      const freeSpot = st.spots.find(p => p.lock === 'free');
      await goTo(p2, freeSpot.tx, freeSpot.ty, atMemory('free'));
      await solve(p2, tag, 11, 0, 'free', { practice: true });
      await skipMemory(p2, tag, '2b-memory');
      const small = [0, 1, 2].map(k => chapterOf(11, k).answer);
      await pick(p2, small[0]);
      st = await state(p2);
      assert.ok(st.cards.every(c => c.y > 100 && c.y < vh - 50), 'every face on screen');
      assert.ok(st.sure.y < vh && st.back.y < vh, 'the lineup buttons on screen');
      await sleep(300); await shot(p2, tag, '3-lineup-child');
      await tap(p2, st.sure);
      await goOn(p2, tag, '4-chapter-card');
      await pick(p2, small[1]);
      await sleep(300); await shot(p2, tag, '5-lineup-grown');
      await tap(p2, (await state(p2)).sure);
      await goOn(p2, tag, '5b-chapter-3-card');
      await pick(p2, small[2]);
      await sleep(300); await shot(p2, tag, '6-lineup-old');
      await tap(p2, (await state(p2)).sure);
      await until(p2, () => window.borrowedState().screen === 'done', 'small end card');
      const box = await p2.locator('#done > div').boundingBox();
      assert.ok(box.y >= 0 && box.y + box.height <= vh, `end card fits (${Math.round(box.y)} + ${Math.round(box.height)})`);
      await sleep(500); await shot(p2, tag, '7-end');
      // Faces that differ only by the held thing (key against flower): seed 2, the old chapter, faces 3 and 4.
      const two = [0, 1, 2].map(k => chapterOf(2, k));
      assert.equal(two[2].faces[3].filter((v, d) => v !== two[2].faces[4][d]).length, 1, 'seed 2 has a tool-only pair');
      await p2.goto(`${base}/borrowed/?seed=2`); await until(p2, () => window.borrowedState?.().screen === 'menu', 'menu');
      await p2.click('#play');
      for (let k = 0; k < 2; k++) { await nameFace(p2, two[k].answer); await goOn(p2, tag, null); }
      await pick(p2, 3);
      await sleep(300); await shot(p2, tag, '8-key-flower');
      // a wrong name: the end card with its year-points line still fits
      if (two[2].answer === 3) { await tap(p2, (await state(p2)).cards[4]); }
      await tap(p2, (await state(p2)).sure);
      await until(p2, () => window.borrowedState().screen === 'done', 'mistaken end card');
      assert.equal((await state(p2)).status, 'mistaken');
      const mbox = await p2.locator('#done > div').boundingBox();
      assert.ok(mbox.y >= 0 && mbox.y + mbox.height <= vh, `mistaken end card fits (${Math.round(mbox.y)} + ${Math.round(mbox.height)})`);
      await sleep(500); await shot(p2, tag, '9-end-mistaken');
      // A save from round 1 (one island a run) still loads.
      await p2.evaluate(() => localStorage.setItem('borrowed-save', JSON.stringify({ v: 1, sound: false, best: 530, runs: 4, gallery: { 5: 2, 9: 1 }, daily: {}, taught: 1 })));
      await p2.goto(`${base}/borrowed/`); await until(p2, () => window.borrowedState?.().screen === 'menu', 'menu after an old save');
      st = await state(p2);
      assert.equal(st.album, 0, 'an old save starts with an empty album');
      assert.equal(st.practice, 0, 'an old save starts with unplayed practice');
      assert.equal(st.taught, 1, 'the old island teaching bit survives');
      assert.ok(st.best === 530 && st.gallery === 2 && st.runs === 4 && st.sound === false, 'a round-1 save is read');
      assert.match(await p2.textContent('#bestLine'), /Found 2 of 16 · Best 530/);
      await p2.click('#play'); assert.equal((await state(p2)).screen, 'play', 'Play starts after an old save');
      await p2.goto(`${base}/borrowed/`); await until(p2, () => window.borrowedState, 'state hook');
      await p2.click('#daily');
      st = await state(p2); assert.ok(st.daily && st.screen === 'play', 'Daily starts a run');
      const d = new Date(), daily = (await import('./sim.js')).dailySeed(d.getFullYear(), d.getMonth() + 1, d.getDate());
      assert.equal(st.seed, daily, 'the daily seed comes from the date');
      await puzzleTour(p2, tag, 28);
      assert.deepEqual(errs, []);
      console.log(`ok   borrowed on chromium ${vw}x${vh}`);
    } catch (e) { failed++; console.log(`FAIL borrowed on chromium ${vw}x${vh}: ${e.message}`); await shot(p2, tag, 'fail').catch(() => {}); }
    await small.close();
    }
    // Desktop: 1280 x 800 with a mouse and keys. Arrow keys walk, 1 to 4 use abilities, Enter opens the lineup.
    const desk = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const p3 = await desk.newPage(), errs3 = [];
    p3.on('pageerror', e => errs3.push(String(e))); p3.on('console', m => { if (m.type() === 'error') errs3.push(m.text()); });
    try {
      await p3.goto(`${base}/borrowed/?seed=${SEED}`); await until(p3, () => window.borrowedState, 'state hook');
      await sleep(300); await shot(p3, 'desktop', '1-menu');
      await p3.click('#play');
      let st = await state(p3);
      const start = { ...st.player };
      for (const k of ['ArrowUp', 'ArrowLeft', 'ArrowRight', 'ArrowDown']) {
        await p3.keyboard.press(k);
        await until(p3, () => !window.borrowedState().player.moving, 'a key step ends', 3000);
        if ((await state(p3)).player.tx !== start.tx || (await state(p3)).player.ty !== start.ty) break;
      }
      st = await state(p3);
      assert.ok(st.player.tx !== start.tx || st.player.ty !== start.ty || st.memoryShowing, 'arrow keys walk');
      // a mouse click walks too
      const free = st.spots.find(p => p.lock === 'free');
      await p3.mouse.click(free.x, free.y);
      await until(p3, () => window.borrowedState().screen === 'puzzle', 'mouse walk to the free memory opens its puzzle', 8000);
      await waitPuzzle(p3);
      await p3.keyboard.press('1');
      await until(p3, () => window.borrowedState().puzzle?.practice === false, 'the key finishes practice');
      await p3.keyboard.press(String(correctTap(puzzleOf(SEED, 0, 'free')) + 1));
      await until(p3, () => window.borrowedState().memoryShowing, 'the key finds the lie', 4000);
      await p3.keyboard.press(' '); // skips the memory scene
      await until(p3, () => !window.borrowedState().memoryShowing, 'memory skipped by key', 3000);
      await sleep(300); await shot(p3, 'desktop', '2-play');
      await p3.keyboard.press('Enter');
      assert.equal((await state(p3)).screen, 'lineup', 'Enter opens the lineup');
      for (let i = 0; i <= answers[0]; i++) await p3.keyboard.press('ArrowRight');
      assert.equal((await state(p3)).selected, answers[0], 'arrows choose a face');
      await p3.keyboard.press('Enter');
      for (let k = 1; k < 3; k++) {
        await until(p3, () => window.borrowedState().screen === 'chapter', 'desktop chapter card', 6000);
        await sleep(700); await p3.keyboard.press('Enter');
        await until(p3, () => window.borrowedState().screen === 'play', 'Enter goes on', 3000);
        await p3.keyboard.press('Enter');
        for (let i = 0; i <= answers[k]; i++) await p3.keyboard.press('ArrowRight');
        await p3.keyboard.press('Enter');
      }
      await until(p3, () => window.borrowedState().screen === 'done', 'desktop end card');
      assert.equal((await state(p3)).status, 'remembered');
      const box = await p3.locator('#done > div').boundingBox();
      assert.ok(box.y >= 0 && box.y + box.height <= 800, 'end card fits');
      await sleep(500); await shot(p3, 'desktop', '3-end');
      // ?lies=0: the old game, a memory is yours as you reach it
      await p3.goto(`${base}/borrowed/?seed=${SEED}&lies=0`); await until(p3, () => window.borrowedState?.().screen === 'menu', 'menu with lies=0');
      await p3.click('#play');
      st = await state(p3);
      assert.equal(st.lies, false, 'lies=0 turns the puzzles off');
      const f0 = st.spots.find(p => p.lock === 'free');
      assert.equal(f0.dims.length, 1, 'without lies the free memory holds one kind');
      await p3.mouse.click(f0.x, f0.y);
      await until(p3, () => window.borrowedState().memoryShowing, 'without lies the memory shows on arrival', 8000);
      assert.equal((await state(p3)).puzzle, null, 'no puzzle without lies');
      await sleep(300); await shot(p3, 'desktop', '4-lies-off');
      assert.deepEqual(errs3, []);
      console.log('ok   borrowed on chromium desktop 1280x800');
    } catch (e) { failed++; console.log(`FAIL borrowed on chromium desktop: ${e.message}`); if (errs3.length) console.log('     ' + errs3.join('\n     ')); await shot(p3, 'desktop', 'fail').catch(() => {}); }
    await desk.close();
  }
  await browser.close();
}
server.close();
console.log(`screenshots in ${SHOTS}`);
process.exit(failed ? 1 : 0);
