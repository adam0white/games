// Phone smoke test for Grapevine: node experiments/grapevine/check.mjs [webkit|chromium]
// Serves experiments/ and the notes button on a free port, answers the lab endpoint locally,
// and plays real levels with touch pointer events on WebKit (iPhone 13) and Chromium (Pixel 7).
// Screenshots go to $SHOTS (default: a folder in the system temp directory, not the repo).
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { gunzipSync } from 'node:zlib';
import assert from 'node:assert/strict';
import { solve, walk, step, startState, refuse } from './sim.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = process.env.SHOTS || join(tmpdir(), 'grapevine-shots');
const WORD_SHOTS = process.env.WORD_SHOTS || join(SHOTS, 'words-grapevine');
await Promise.all([mkdir(SHOTS, { recursive: true }), mkdir(WORD_SHOTS, { recursive: true })]);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/notes/button.js') {
    const script = await readFile(join(root, '../workers/feedback/public/notes/button.js'));
    res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(script);
  }
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

const require = createRequire('/Users/abdul/code/human-framework/node_modules/x.js');
const { webkit, chromium, devices } = require(process.env.PLAYWRIGHT ? join(resolve(process.env.PLAYWRIGHT), 'playwright') : 'playwright');
const PHONES = { webkit: [webkit, devices['iPhone 13']], chromium: [chromium, devices['Pixel 7']] };
const sleep = ms => new Promise(done => setTimeout(done, ms));
async function until(page, fn, what, ms = 8000, arg = null) { try { await page.waitForFunction(fn, arg, { timeout: ms }); } catch { throw new Error(`timed out waiting for: ${what}`); } }
const finger = (page, sel, steps) => page.evaluate(([sel, steps]) => {
  const el = document.querySelector(sel);
  for (const [type, x, y] of steps) el.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, pressure: type === 'pointerup' ? 0 : 0.5, bubbles: true, cancelable: true }));
}, [sel, steps]);
const state = page => page.evaluate(() => window.grapevineState());
// A drag through villagers in order: down on the first, moves in small steps, up on the last (unless hold).
function dragSteps(nodes, route, hold = false) {
  const steps = [['pointerdown', nodes[route[0]].x, nodes[route[0]].y]];
  for (let i = 1; i < route.length; i++) {
    const a = nodes[route[i - 1]], b = nodes[route[i]];
    for (let k = 1; k <= 8; k++) steps.push(['pointermove', a.x + (b.x - a.x) * k / 8, a.y + (b.y - a.y) * k / 8]);
  }
  const end = nodes[route[route.length - 1]];
  if (!hold) steps.push(['pointerup', end.x, end.y]);
  return steps;
}
const tap = (page, p) => finger(page, '#c', [['pointerdown', p.x, p.y], ['pointerup', p.x, p.y]]);
const levelNow = async page => page.evaluate(() => JSON.parse(JSON.stringify(window.grapevineLevel())));
let colourReport = null;
const shot = (page, phone, name) => page.screenshot({ path: join(SHOTS, `${phone}-${name}.png`) });

// The shared first-time hint (kit/hint.js), forced on with ?hint=hand: a finger dragging through dots shows after 3 s of
// idle play; a real touch removes it and reaches the game.
async function firstHint(page) {
  const on = () => page.evaluate(() => !!document.querySelector('.kit-hint.on'));
  await page.goto(`${base}/grapevine/?level=4&hint=hand`); await until(page, () => window.grapevineState, 'state hook');
  await page.click('#play'); await sleep(1000);
  assert.equal(await on(), false, 'hint: not before 3 s of idle play');
  await until(page, () => !!document.querySelector('.kit-hint.on'), 'hint: shown after idle play', 8000);
  assert.equal(await page.evaluate(() => document.querySelector('.kit-hint').dataset.kind), 'path', 'hint: a path');
  assert.equal((await state(page)).touched, false);
  const vp = page.viewportSize(); await tap(page, { x: vp.width / 2, y: vp.height / 2 });
  assert.equal(await page.evaluate(() => document.querySelector('.kit-hint')), null, 'hint: a real touch removes it');
  assert.ok((await state(page)).touched, 'hint: the touch reached the game');
  await page.evaluate(() => { const el = document.querySelector('#pause'); el.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 9, pointerType: 'touch', bubbles: true, cancelable: true })); el.click(); });
  await page.click('#toMenu'); await until(page, () => window.grapevineState().screen === 'menu', 'back on the menu');
}

// The kit's first-time hint must not cover a villager (head, hat or badge) on a crowded board. Reads the real rects of
// the copy's dots and hand from the page.
async function hintClear(page, url, name, phone) {
  await page.goto(`${base}/grapevine/${url}`); await until(page, () => window.grapevineState, 'state hook');
  await page.click('#play');
  await until(page, () => !!document.querySelector('.kit-hint.on'), `hint shown on ${name}`, 9000);
  await sleep(1700); // the finger is mid-drag
  const hit = await page.evaluate(() => {
    const st = window.grapevineState(), R = st.R, parts = [...document.querySelectorAll('.kit-hint svg circle, .kit-hint .hand, .kit-hint.still .label')];
    const rects = parts.map(el => el.getBoundingClientRect()).filter(r => r.width && r.height);
    const out = [];
    for (const n of st.nodes) {
      const box = { left: n.x - R * 1.15, right: n.x + R * 1.15, top: n.y - R * 1.25, bottom: n.y + R * 1.85 };
      for (const r of rects) if (r.left < box.right && r.right > box.left && r.top < box.bottom && r.bottom > box.top) out.push(`${n.kind} at ${n.x},${n.y}`);
    }
    return { out, parts: rects.length, clear: st.hintClear };
  });
  await shot(page, phone, `hint-${name}`);
  assert.ok(hit.parts >= 5, `${name}: the hint's dots and hand are on the page`);
  assert.deepEqual(hit.out, [], `${name}: the hint covers no villager (clearance ${hit.clear})`);
  await tap(page, { x: 5, y: page.viewportSize().height / 2 });
}

// Chapters 2 and 3: an old finished save opens chapter 2; each new kind of path or villager is learnt on its level, by
// touch, with the wrong way refused; loops can be tapped; the end of a chapter has its card; the daily village keeps
// hops and a streak and can be shared.
async function chapters(page, phone) {
  const old = { v: 1, sound: true, best: Object.fromEntries(Array.from({ length: 30 }, (_, i) => [i + 1, 3])), opened: 31, daily: { '2026-11-20': 2 } };
  await page.goto(`${base}/grapevine/?labRunSource=agent`);
  await page.evaluate(o => { localStorage.clear(); localStorage.setItem('grapevine-save', JSON.stringify(o)); }, old);
  await page.reload(); await until(page, () => window.grapevineState, 'state hook');
  let st = await state(page);
  assert.equal(st.opened, 31, 'old save: progress kept'); assert.equal(st.tab, 1, 'old finished save opens on chapter 2');
  assert.match(await page.textContent('#play'), /Play 31/);
  assert.match(await page.textContent('#tabs'), /90\/90/, 'chapter 1 stars on its tab');
  await page.locator('#tabs button').nth(0).tap();
  assert.equal(await page.textContent('#play'), 'Play 1', 'Play follows the selected finished chapter');
  await page.locator('#tabs button').nth(1).tap();
  assert.equal(await page.textContent('#play'), 'Play 31');
  await sleep(300); await shot(page, phone, 'c1-menu-chapter2');

  // 31, one way: the lane from the listener refuses a route that runs against it.
  await page.click('#play'); st = await state(page); assert.equal(st.level, 31); assert.equal(st.chapter, 2);
  let lv = await levelNow(page), best = solve(lv).best;
  await sleep(500); await shot(page, phone, 'c2-level31-oneway');
  const against = lv.edges.find(e => e[2] === 1); // [a, b, 1]: a to b only
  const into = [lv.from, against[1]];
  assert.equal(typeof step(lv, startState(lv), against[1]), 'object', 'level 31: the teller reaches the end of the lane');
  await finger(page, '#c', dragSteps(st.nodes, [...into, against[0]]));
  st = await state(page); assert.deepEqual(st.route, into, 'a drag against a one-way lane stops at it');
  await sleep(150); await shot(page, phone, 'c3-level31-refused');
  await tap(page, st.nodes[lv.from]);
  await finger(page, '#c', dragSteps(st.nodes, best));
  await until(page, () => window.grapevineState().screen === 'done', 'level 31 solved');

  // 36, the bell: a shut gate refuses; after the bell rings it opens.
  await page.click('#next'); st = await state(page); assert.equal(st.level, 32, 'Next goes on to 32');
  await page.goto(`${base}/grapevine/?level=36`); await until(page, () => window.grapevineState, 'state hook');
  await page.click('#play'); st = await state(page); lv = await levelNow(page); best = solve(lv).best;
  await sleep(500); await shot(page, phone, 'c4-level36-bell');
  const gate = lv.edges.findIndex(e => e[2] === 3), [ga, gb] = lv.edges[gate], gateNear = [ga, gb].find(v => v !== lv.to), bell = lv.nodes.findIndex(n => n.kind === 'bell');
  await finger(page, '#c', dragSteps(st.nodes, [lv.from, gateNear, lv.to]));
  st = await state(page); assert.deepEqual(st.route, [lv.from, gateNear], 'a shut gate stops the drag');
  assert.equal(st.gates[gate], 0, 'the gate is shut');
  await tap(page, st.nodes[lv.from]);
  await finger(page, '#c', dragSteps(st.nodes, best, true));
  st = await state(page); assert.ok(best.includes(bell), 'the best route rings the bell'); assert.equal(st.phase, 1, 'the bell rang');
  await sleep(500); st = await state(page); assert.equal(st.gates[gate], 1, 'the gate swung open');
  await shot(page, phone, 'c5-level36-open');
  await finger(page, '#c', [['pointerup', st.nodes[lv.to].x, st.nodes[lv.to].y]]);
  await until(page, () => window.grapevineState().screen === 'done', 'level 36 solved');

  // 46, the keeper: hands on the news they hold and keeps the new.
  await page.goto(`${base}/grapevine/?level=46`); await until(page, () => window.grapevineState, 'state hook');
  await page.click('#play'); st = await state(page); lv = await levelNow(page); best = solve(lv).best;
  assert.equal(st.chapter, 3);
  await sleep(500); await shot(page, phone, 'c6-level46-keeper');
  await finger(page, '#c', dragSteps(st.nodes, best.slice(0, -1), true));
  st = await state(page); assert.deepEqual(st.memo[0], lv.start, 'the keeper now holds the teller\'s news');
  await sleep(200); await shot(page, phone, 'c7-level46-midroute');
  await finger(page, '#c', [['pointerup', st.nodes[best[best.length - 2]].x, st.nodes[best[best.length - 2]].y]]);

  // Routes that loop back through a villager can be made by taps alone.
  for (const n of [34, 40, 50]) {
    await page.goto(`${base}/grapevine/?level=${n}`); await until(page, () => window.grapevineState, 'state hook');
    await page.click('#play'); st = await state(page); lv = await levelNow(page); best = solve(lv).best;
    assert.ok(new Set(best).size < best.length, `level ${n}: the best route loops`);
    for (const v of best.slice(1)) await tap(page, st.nodes[v]);
    assert.deepEqual((await state(page)).route, best, `level ${n}: taps drew the looping route`);
    await until(page, () => window.grapevineState().screen === 'done', `level ${n} solved by taps`);
    assert.equal((await state(page)).stars, 3);
  }

  // The end of a chapter: its own card, with the next button on screen.
  await page.goto(`${base}/grapevine/?level=45`); await until(page, () => window.grapevineState, 'state hook');
  await page.click('#play'); st = await state(page); lv = await levelNow(page); best = solve(lv).best;
  await sleep(400); await shot(page, phone, 'c8-level45-winter');
  await finger(page, '#c', dragSteps(st.nodes, best));
  await until(page, () => window.grapevineState().screen === 'done', 'level 45 solved');
  await sleep(1500);
  assert.equal((await state(page)).payoff, 2); assert.match(await page.textContent('#doneTitle'), /Chapter done/);
  const nb = await page.locator('#next').boundingBox(), vp = page.viewportSize();
  assert.ok(nb.y + nb.height <= vp.height, 'Next chapter is on screen'); assert.match(await page.textContent('#next'), /Next chapter/);
  await shot(page, phone, 'c9-chapter2-done');
  await page.click('#next'); assert.equal((await state(page)).level, 46);
  await page.goto(`${base}/grapevine/?level=60`); await until(page, () => window.grapevineState, 'state hook');
  await page.click('#play'); await sleep(400); await shot(page, phone, 'c10-level60-autumn');

  // The daily village at the newest tier: hops, streak and share.
  await page.goto(`${base}/grapevine/?tier=3`); await until(page, () => window.grapevineState, 'state hook');
  await page.click('#daily'); st = await state(page); lv = await levelNow(page); best = solve(lv).best;
  assert.equal(st.tier, 3); assert.equal(st.chapter, lv.tier !== undefined ? [1, 2, 2, 3][lv.tier] : 3);
  await sleep(300); await shot(page, phone, 'c11-daily-tier3');
  await finger(page, '#c', dragSteps(st.nodes, best));
  await until(page, () => window.grapevineState().screen === 'done', 'daily solved', 15000);
  await sleep(1800);
  st = await state(page);
  assert.equal(st.dailyHops, best.length - 1, 'fewest hops today saved'); assert.equal(st.streak, 1); assert.equal(st.bestStreak, 1);
  assert.match(st.shareText, /^Grapevine, Daily village/); assert.match(st.shareText, /Psst!.*Heard it!/);
  await shot(page, phone, 'c12-daily-done');
  const nb2 = await page.locator('#again').boundingBox();
  assert.ok(nb2.y + nb2.height <= vp.height, 'the daily card fits');
  // Preview works even when a native sheet is cancelled or clipboard access is denied.
  await page.click('#share');
  const preview = page.locator('#postcardDialog');
  assert.ok(await preview.isVisible(), 'share: a tap opens the visible postcard');
  const picture = preview.locator('canvas');
  const bounds = await picture.boundingBox();
  assert.ok(bounds?.width >= 250 && bounds.height >= 140, 'share: preview large enough to read');
  const titleSize = await picture.evaluate(c => {
    const ctx = c.getContext('2d');
    return 16 * c.getBoundingClientRect().width * ctx.getTransform().a / c.width;
  });
  assert.ok(titleSize >= 14, `postcard date and village render at least 14 CSS pixels (${titleSize})`);
  await page.evaluate(() => {
    window.__shared = [];
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: d => !!d.files });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async d => {
      window.__shared.push({ text: d.text, files: (d.files || []).map(f => ({ type: f.type, size: f.size })) });
    } });
  });
  await page.click('#sendCard');
  const handed = await page.evaluate(() => window.__shared);
  assert.equal(handed.length, 1); assert.equal(handed[0].files[0]?.type, 'image/png');
  assert.ok(handed[0].files[0].size > 10000); assert.match(handed[0].text, /Heard it!/);
  assert.equal(await page.textContent('#shareStatus'), 'Card shared.');
  await page.evaluate(() => Object.defineProperty(navigator, 'share', { configurable: true, value: async () => {
    throw new DOMException('Cancelled', 'AbortError');
  } }));
  await page.click('#sendCard');
  assert.equal(await page.textContent('#shareStatus'), 'Sharing cancelled.');
  await page.click('#backToResult');
  assert.equal(await preview.isVisible(), false);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async t => { window.__copied = t; } } });
  });
  await page.click('#share');
  assert.equal(await page.textContent('#sendCard'), 'Copy result');
  await page.click('#sendCard');
  assert.equal(await page.textContent('#shareStatus'), 'Result copied.');
  assert.match(await page.evaluate(() => window.__copied), /Psst!.*Heard it!/);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }));
  await page.click('#sendCard');
  assert.ok(await page.locator('#manualShare').isVisible(), 'clipboard denied: player can select the result');
  assert.equal(await page.inputValue('#manualShare'), (await state(page)).shareText);
  await page.click('#backToResult');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'share', 'back returns focus to result');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('grapevine-save')));
  assert.equal(saved.dailyTier[Object.keys(saved.dailyHops)[0]], undefined, '?tier= does not pin');
  assert.ok(saved.opened >= 31, 'progress kept'); assert.equal(saved.daily['2026-11-20'], 2, 'an old daily entry kept');
  assert.equal(saved.best[1], 3, 'old stars kept');

  // Streaks: two solved days before today show on the menu; a gap breaks the run.
  const day = k => { const d = new Date(); d.setDate(d.getDate() - k); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  await page.evaluate(([a, b, c]) => { const s = JSON.parse(localStorage.getItem('grapevine-save')); s.daily = { [a]: 3, [b]: 1, [c]: 2 }; localStorage.setItem('grapevine-save', JSON.stringify(s)); }, [day(1), day(2), day(4)]);
  await page.goto(`${base}/grapevine/`); await until(page, () => window.grapevineState, 'state hook');
  assert.equal((await state(page)).streak, 2, 'yesterday and the day before: a streak of 2');
  assert.match(await page.locator('#daily').getAttribute('aria-label'), /2 days/);
  assert.match(await page.textContent('#daily'), /🔥 2/);
  await page.evaluate(([a, c]) => { const s = JSON.parse(localStorage.getItem('grapevine-save')); s.daily = { [a]: 3, [c]: 2 }; localStorage.setItem('grapevine-save', JSON.stringify(s)); }, [day(1), day(3)]);
  await page.reload(); await until(page, () => window.grapevineState, 'state hook');
  assert.equal((await state(page)).streak, 1, 'a gap breaks the streak');

  // A six-villager route on a narrow phone: the strip has room for every villager.
  await page.goto(`${base}/grapevine/?level=33`); await until(page, () => window.grapevineState, 'state hook');
  await page.click('#play'); st = await state(page); lv = await levelNow(page); best = solve(lv).best;
  await finger(page, '#c', dragSteps(st.nodes, best));
  await until(page, () => window.grapevineState().screen === 'done', 'level 33 solved');
  await sleep(1800); await shot(page, phone, 'c14-level33-strip');
  const fit = await page.evaluate(n => { const c = document.querySelector('#strip'), w = c.getBoundingClientRect().width, h = c.getBoundingClientRect().height; const rows = Math.min(76, w / n) < 54 ? 2 : 1; return { rows, h }; }, best.length);
  assert.ok(fit.h >= fit.rows * 100, `strip tall enough for ${fit.rows} row(s) (${fit.h} px)`);

  // The share card itself, drawn for a long route (two rows) so its layout can be looked at.
  await page.goto(`${base}/grapevine/?level=40`); await until(page, () => window.grapevineState, 'state hook');
  await page.click('#play'); st = await state(page); lv = await levelNow(page); best = solve(lv).best;
  await finger(page, '#c', dragSteps(st.nodes, best));
  await until(page, () => window.grapevineState().screen === 'done', 'level 40 solved');
  await sleep(2200); await shot(page, phone, 'c13-level40-strip');

  // The first-time hint on crowded boards.
  await page.evaluate(() => localStorage.clear());
  for (const [url, name] of [['?level=1&hint=hand', 'level1'], ['?level=2&hint=hand', 'level2'], ['?level=3&hint=hand', 'level3'], ['?level=30&hint=hand', 'level30'], ['?level=52&hint=hand', 'level52'], ['?level=20&hint=hand', 'level20'], ['?tier=3&hint=hand', 'daily']]) {
    if (name === 'daily') {
      await page.goto(`${base}/grapevine/${url}`); await until(page, () => window.grapevineState, 'state hook');
      await page.click('#daily');
      await until(page, () => !!document.querySelector('.kit-hint.on'), 'hint on the daily village', 9000); await sleep(1700);
      const hit = await page.evaluate(() => {
        const st = window.grapevineState(), R = st.R, rects = [...document.querySelectorAll('.kit-hint svg circle, .kit-hint .hand')].map(el => el.getBoundingClientRect());
        return st.nodes.filter(n => rects.some(r => r.left < n.x + R * 1.15 && r.right > n.x - R * 1.15 && r.top < n.y + R * 1.85 && r.bottom > n.y - R * 1.25)).map(n => n.kind);
      });
      await shot(page, phone, 'hint-daily');
      assert.deepEqual(hit, [], 'daily: the hint covers no villager');
    } else await hintClear(page, url, name, phone);
  }
}

// Read the painted indicators themselves. A corrected route can coexist with stale canvas feedback.
async function boardInk(page, region, rgb) {
  return page.evaluate(([region, rgb]) => {
    const canvas = document.querySelector('#c'), ctx = canvas.getContext('2d');
    const scale = canvas.width / canvas.clientWidth, middle = canvas.clientWidth / 2;
    const box = Array.isArray(region) ? region :
      region === 'check' ? [middle - 12, 20, 24, 25] : [0, 80, canvas.clientWidth, 90];
    const data = ctx.getImageData(...box.map(n => Math.round(n * scale))).data;
    for (let i = 0; i < data.length; i += 4) {
      if (rgb.every((c, k) => data[i + k] === c)) return true;
    }
    return false;
  }, [region, rgb]);
}

async function boardFeedback(page) {
  const accessibleCue = () => page.textContent('#boardCue');
  const painted = () => page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  const misses = [];
  const expect = (condition, message) => { if (!condition) misses.push(message); };
  const gold = [255, 224, 122], plate = [69, 51, 80], cream = [255, 244, 220];
  const near = ({ x, y }) => [x - 43, y - 43, 86, 86];
  const center = page.viewportSize().width / 2;
  await page.goto(`${base}/grapevine/?level=1`);
  await page.click('#play');
  let st = await state(page);
  const painter = st.nodes.find(n => n.kind === 'paint');
  await painted();
  expect(await boardInk(page, near(painter), gold), 'first tap rings the red hat on the board');
  expect(/Tap.*red hat/i.test(await accessibleCue()), 'screen reader instruction identifies the red hat');
  await tap(page, st.nodes[st.from]); // a plausible first touch should not dismiss the instruction
  await painted();
  expect(await boardInk(page, near(painter), gold), 'painter highlight survives tapping the teller');
  await tap(page, painter);
  await painted();
  expect(await boardInk(page, near(st.nodes[st.to]), gold), 'next tap rings the listener');
  expect(await boardInk(page, [center - 44, 88, 88, 31], plate), 'the colour change has a before-and-after plate');
  expect(/tap.*listener/i.test(await accessibleCue()), 'screen reader instruction identifies the listener');
  await tap(page, st.nodes[st.to]);
  await until(page, () => window.grapevineState().hop > 0.05, 'sending has painted a frame');
  expect(await boardInk(page, 'check', [127, 224, 122]), 'the HUD keeps the match during delivery');

  await page.goto(`${base}/grapevine/?level=2`);
  await page.click('#play');
  st = await state(page);
  const lv = await levelNow(page);
  await painted();
  expect(await boardInk(page, [center + 13, 11, 42, 43], gold), 'the second village highlights the wanted HUD token');
  const wrong = lv.nodes.findIndex(n => n.kind === 'paint' && n.arg !== lv.want.c);
  await tap(page, st.nodes[wrong]); await tap(page, st.nodes[lv.to]);
  await until(page, () => window.grapevineState().result === 'wrong', 'wrong delivery');
  await painted();
  expect(await boardInk(page, near(st.nodes[st.from]), gold), 'wrong delivery rings the teller for a legal retry');
  expect(await boardInk(page, [st.nodes[st.from].x - 60, st.nodes[st.from].y - 4, 36, 38], plate), 'wrong delivery puts a reset icon by the teller');
  expect(/tap.*teller.*again/i.test(await accessibleCue()), 'screen reader instruction explains the retry');
  const red = [232, 40, 59];
  expect(await boardInk(page, 'bubble', red), 'wrong delivery marks the rejected message');
  await tap(page, st.nodes[st.from]); await sleep(100);
  expect(!await boardInk(page, 'bubble', red), 'editing clears the rejected message');
  await page.goto(`${base}/grapevine/?level=10`);
  await page.click('#play');
  st = await state(page);
  const swapRoute = solve(await levelNow(page)).best;
  await tap(page, st.nodes[swapRoute[1]]);
  await painted();
  expect(await boardInk(page, [center - 88, 88, 176, 31], plate), 'the swap shows an enlarged pair and a before-and-after');
  expect(await boardInk(page, [center + 35, 102, 6, 2], cream), 'a changed token has an arrow between the two tokens');
  expect(/Swaps circles and squares/i.test(await accessibleCue()), 'the accessible cue names the two shapes');
  await tap(page, st.nodes[swapRoute[2]]);
  await tap(page, st.nodes[swapRoute[3]]);
  await painted();
  expect(!await boardInk(page, [center + 35, 102, 6, 2], cream)
    && await boardInk(page, [center + 35, 99, 6, 2], cream), 'an unchanged token has an equals sign in place of the arrow');
  expect(/only triangles and stars swap/i.test(await accessibleCue()), 'accessible cue explains the swap restriction');
  await tap(page, st.nodes[swapRoute[4]]);
  await until(page, () => window.grapevineState().screen === 'done', 'swap route solved');
  expect((await state(page)).shareText.includes('Swapsies! → Less! → No change → Heard it!'),
    'receipt distinguishes a changed shape from a villager who passed the same shape');
  assert.deepEqual(misses, [], 'board feedback');
}

async function run(page, phone) {
  const sent = page.context().labSent;
  await page.goto(`${base}/grapevine/?labRunSource=agent`);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('hf-lab-send-localhost', '1'); });
  await page.reload();
  await until(page, () => window.grapevineState, 'state hook');
  let st = await state(page);
  assert.equal(st.screen, 'menu', 'starts on the menu');
  assert.match(await page.textContent('#menu'), /The game lab records play/, 'lab notice on the menu');
  await sleep(400); await shot(page, phone, '1-menu');

  // Level 1 by a real drag, with pause and resume in the middle of the send.
  await page.click('#play');
  st = await state(page);
  assert.equal(st.screen, 'play'); assert.equal(st.level, 1);
  let lv = await levelNow(page), best = solve(lv).best;
  await sleep(700); await shot(page, phone, '2-level1-tutorial');
  await finger(page, '#c', dragSteps(st.nodes, best));
  st = await state(page);
  assert.ok(st.sending, 'releasing on the listener sends the message');
  assert.deepEqual(st.route, best, 'the drag drew the route');
  await until(page, () => window.grapevineState().hop >= 0.4, 'the message is moving');
  await shot(page, phone, '2b-sending');
  await finger(page, '#pause', [['pointerdown', 0, 0]]);
  st = await state(page); assert.ok(st.paused, 'pause button pauses');
  const hop = st.hop; await sleep(350);
  assert.equal((await state(page)).hop, hop, 'the message stands still while paused');
  await page.click('#resume');
  await until(page, h => window.grapevineState().hop > h || window.grapevineState().screen === 'done' || window.grapevineState().result, 'the message moves again', 4000, hop);
  await until(page, () => window.grapevineState().screen === 'done', 'end card');
  st = await state(page);
  assert.equal(st.result, 'won'); assert.equal(st.stars, 3, 'shortest route: three stars');
  await sleep(1200); await shot(page, phone, '4-end-card');
  const legibility = await page.evaluate(async () => {
    const { change } = await import('./art.js');
    const cv = document.createElement('canvas');
    cv.width = 48; cv.height = 20;
    const g = cv.getContext('2d');
    const inkRows = [5, 6].map(id => {
      g.clearRect(0, 0, 48, 20);
      change(g, id, 24, 10, 44, 18);
      const pixels = g.getImageData(0, 0, 48, 20).data;
      let rows = 0;
      for (let y = 0; y < 20; y++) {
        if (pixels.slice(y * 48 * 4, (y + 1) * 48 * 4).some((a, i) => i % 4 === 3 && a >= 128)) rows++;
      }
      return rows;
    });
    const strip = document.querySelector('#strip');
    const { data } = strip.getContext('2d').getImageData(0, Math.floor(strip.height / 2), strip.width, 1);
    const solidWidth = [...data].filter((a, i) => i % 4 === 3 && a === 255).length / (strip.width / strip.clientWidth);
    return { inkRows, solidWidth };
  });
  assert.ok(legibility.inkRows.every(h => h >= 10) && legibility.solidWidth >= 160,
    `count marks need ten legible rows; three comic cells need opaque backs: ${JSON.stringify(legibility)}`);

  // Level 2 by taps: first a wrong route (the listener is puzzled), then the right one.
  await page.click('#next');
  st = await state(page); assert.equal(st.level, 2);
  await sleep(500); await shot(page, phone, '2c-level2-tutorial');
  lv = await levelNow(page); best = solve(lv).best;
  const wrongMid = lv.edges.flat().find(v => v !== lv.from && v !== lv.to && !best.includes(v) && lv.edges.some(e => e.includes(v) && e.includes(lv.to)));
  for (const v of [wrongMid, lv.to]) await tap(page, st.nodes[v]);
  await until(page, () => window.grapevineState().result === 'wrong', 'wrong message arrives', 6000);
  await sleep(300); await shot(page, phone, '3-wrong');
  st = await state(page); assert.equal(st.fails, 1);
  await tap(page, st.nodes[lv.from]); // tapping the teller starts over
  assert.equal((await state(page)).route.length, 1, 'tap on the teller clears the route');
  for (const v of best.slice(1)) await tap(page, st.nodes[v]);
  await until(page, () => window.grapevineState().screen === 'done', 'level 2 solved by taps');

  // Losing the screen pauses; P resumes.
  await page.click('#next'); st = await state(page); assert.equal(st.level, 3);
  await page.evaluate(() => dispatchEvent(new Event('blur')));
  assert.ok((await state(page)).paused, 'losing focus pauses');
  await page.keyboard.press('p'); assert.ok(!(await state(page)).paused, 'P resumes');
  await sleep(500); await shot(page, phone, '2d-level3-tutorial');

  // Three wrong sends on level 3 bring the hint; each press shows one more hop of a best route.
  lv = await levelNow(page); best = solve(lv).best;
  const short = [lv.from, ...lv.edges.filter(e => e.includes(lv.from)).map(e => e[0] === lv.from ? e[1] : e[0]).filter(v => lv.edges.some(e => e.includes(v) && e.includes(lv.to))).slice(0, 1), lv.to];
  assert.ok(!walk(lv, short).correct, 'level 3: the short way is wrong');
  for (let i = 0; i < 3; i++) {
    await finger(page, '#c', dragSteps(st.nodes, short));
    await until(page, n => window.grapevineState().fails === n, 'a wrong send', 6000, i + 1);
  }
  st = await state(page); assert.ok(st.hintShown, 'hint offered after three wrong sends');
  await page.click('#hint', { force: true }); st = await state(page);
  assert.deepEqual(st.route, best.slice(0, 2), 'the hint shows the first hop');
  await page.click('#hint', { force: true }); st = await state(page);
  assert.deepEqual(st.route, best.slice(0, 3), 'the next press shows the next hop');
  await finger(page, '#c', dragSteps(st.nodes, [best[2], best[3]]));
  await until(page, () => window.grapevineState().screen === 'done', 'level 3 solved after hints');

  // The save survives a reload: three levels open plus the fourth, stars on the grid.
  await page.reload(); await until(page, () => window.grapevineState, 'state hook');
  st = await state(page);
  assert.equal(st.opened, 4, 'progress saved');
  const blob = await page.evaluate(() => JSON.parse(localStorage.getItem('grapevine-save')));
  assert.deepEqual(blob.best, { 1: 3, 2: 3, 3: 3 });
  assert.match(await page.textContent('#play'), /Play 4/);
  await shot(page, phone, '5-menu-progress');

  // A later level mid-route, for a picture of a busy village.
  await page.goto(`${base}/grapevine/?level=14&labRunSource=agent`);
  await until(page, () => window.grapevineState, 'state hook');
  await page.click('#play'); st = await state(page); assert.equal(st.level, 14);
  lv = await levelNow(page); best = solve(lv).best;
  await finger(page, '#c', dragSteps(st.nodes, best.slice(0, 4), true));
  assert.deepEqual((await state(page)).route, best.slice(0, 4), 'drag on a later level');
  await sleep(300); await shot(page, phone, '6-level14-midroute');
  await finger(page, '#c', [['pointerup', st.nodes[best[3]].x, st.nodes[best[3]].y]]);

  // The daily village: generated and solved in the browser.
  await finger(page, '#pause', [['pointerdown', 0, 0]]);
  await page.click('#toMenu'); await page.click('#daily');
  st = await state(page); assert.equal(st.mode, 'daily'); assert.ok(st.min >= 4, 'daily village has a real route');
  await sleep(300); await shot(page, phone, '7-daily');
  lv = await levelNow(page); best = solve(lv).best;
  await finger(page, '#c', dragSteps(st.nodes, best));
  await until(page, () => window.grapevineState().screen === 'done', 'daily solved', 15000);
  const daily = await page.evaluate(() => JSON.parse(localStorage.getItem('grapevine-save')).daily);
  assert.equal(Object.values(daily)[0], 3, 'daily stars saved');

  // Lab recording: solved runs with their summary; a left run when the player went to the menu.
  await sleep(400);
  const runs = sent.filter(r => r.game === 'grapevine' && r.kind === 'run');
  const outcomes = runs.map(r => r.data.outcome);
  assert.ok(outcomes.filter(o => o === 'solved').length >= 4, `solved runs sent (${outcomes})`);
  assert.ok(outcomes.includes('left'), 'leaving a level is sent');
  const first = runs.find(r => r.data.outcome === 'solved');
  assert.equal(first.data.start.level, 1); assert.equal(first.data.summary.stars, 3);
  assert.ok(first.data.events.some(e => e.type === 'send' && e.data.ok === true), 'send event recorded');
  assert.ok(runs.some(r => r.data.events.some(e => e.type === 'hint')), 'hint event recorded');
  assert.ok(runs.every(r => r.runSource === 'agent'));
}

// Middle and late game audit. A hop that changes nothing (a grump at one, an exaggerator at three, a parrot
// with nothing to repeat) shows the same before-and-after plate as the swap, with a short reason; a finished
// game points the menu and the last card at a village that still lacks stars.
async function lateGame(page) {
  const misses = [];
  const expect = (condition, message) => { if (!condition) misses.push(message); };
  const plate = [69, 51, 80], center = page.viewportSize().width / 2;
  const painted = () => page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  for (const [n, kind, cue] of [[11, 'less', /one is the least/i], [17, 'more', /three is the most/i], [25, 'parrot', /nothing to repeat/i]]) {
    await page.goto(`${base}/grapevine/?level=${n}`); await page.click('#play');
    const st = await state(page), lv = await levelNow(page), best = solve(lv).best, run = walk(lv, best);
    const k = best.findIndex((v, i) => i > 0 && lv.nodes[v].kind === kind && JSON.stringify(run.msgs[i]) === JSON.stringify(run.msgs[i - 1]));
    expect(k > 0, `level ${n}: the shortest route has a ${kind} who changes nothing`);
    if (k <= 0) continue;
    for (let i = 1; i <= k; i++) await tap(page, st.nodes[best[i]]);
    await painted();
    expect(cue.test(await page.textContent('#boardCue')), `level ${n}: the cue says why the ${kind} changed nothing`);
    expect(await boardInk(page, [center - 88, 88, 176, 31], plate), `level ${n}: a before-and-after plate shows the unchanged news`);
  }
  // The hard-hat shaper and the colour swapper get the same picture plate as the swap, with a sentence.
  for (const [n, kind, cue] of [[13, 'carve', /any shape/i], [16, 'flip', /red and green/i]]) {
    await page.goto(`${base}/grapevine/?level=${n}`); await page.click('#play');
    const st = await state(page), lv = await levelNow(page), best = solve(lv).best;
    const k = best.findIndex(v => lv.nodes[v].kind === kind);
    expect(k > 0, `level ${n}: the shortest route meets a ${kind}`);
    if (k <= 0) continue;
    for (let i = 1; i <= k; i++) await tap(page, st.nodes[best[i]]);
    await painted();
    expect(cue.test(await page.textContent('#boardCue')), `level ${n}: the cue says what the ${kind} does`);
    expect(await boardInk(page, [center - 88, 88, 176, 31], plate), `level ${n}: the ${kind} has a before-and-after plate`);
  }
  // The bow who will not take red news says so when refused (search a short route that arrives next to her with red).
  {
    await page.goto(`${base}/grapevine/?level=19`); await page.click('#play');
    const st = await state(page), lv = await levelNow(page), bow = lv.nodes.findIndex(v => v.kind === 'timid');
    let found = null, queue = [[lv.from]];
    while (queue.length && !found) {
      const r = queue.shift(), run = walk(lv, r);
      if (!run.valid || r.length > 5) continue;
      if (refuse(lv, run.state, bow) === 'red') { found = r; break; }
      lv.nodes.forEach((_, v) => { if (!refuse(lv, run.state, v) && v !== lv.to) queue.push([...r, v]); });
    }
    expect(!!found, 'level 19: a short route brings red news next to the bow');
    if (found) {
      for (const v of found.slice(1)) await tap(page, st.nodes[v]);
      await tap(page, st.nodes[bow]);
      expect(/red news/i.test(await page.textContent('#boardCue')), 'level 19: the cue says the bow will not take red news');
    }
  }
  // Everything open, two villages short of three stars: the menu and the last card both point at the first one.
  const best = {}; for (let n = 1; n <= 60; n++) best[n] = 3; best[45] = 2; best[59] = 2;
  await page.goto(`${base}/grapevine/`);
  const before = await page.evaluate(() => localStorage.getItem('grapevine-save'));
  await page.evaluate(best => localStorage.setItem('grapevine-save', JSON.stringify({ v: 1, sound: true, best, opened: 61, daily: {} })), best);
  await page.reload(); await until(page, () => window.grapevineState, 'state hook');
  expect(/45/.test(await page.textContent('#play')), `menu after the last village points at village 45 (${await page.textContent('#play')})`);
  // The chase label shares a row with the daily button, so it must stay on one line in every language.
  const langBefore = await page.evaluate(() => localStorage.getItem('kit:lang'));
  for (const lang of ['tr', 'en']) {
    await page.goto(`${base}/grapevine/?lang=${lang}`); await until(page, () => window.grapevineState, 'state hook');
    const lines = await page.evaluate(() => {
      const el = document.getElementById('play'), r = document.createRange(); r.selectNodeContents(el);
      const half = parseFloat(getComputedStyle(el).fontSize) / 2, mids = [];
      for (const b of r.getClientRects()) if (b.width > 1 && !mids.some(m => Math.abs(m - (b.top + b.bottom) / 2) < half)) mids.push((b.top + b.bottom) / 2);
      return mids.length;
    });
    expect(lines === 1, `${lang}: the chase label fits on one line (${lines} lines: ${await page.textContent('#play')})`);
  }
  await page.evaluate(v => { if (v === null) localStorage.removeItem('kit:lang'); else localStorage.setItem('kit:lang', v); }, langBefore);
  await page.goto(`${base}/grapevine/`); await until(page, () => window.grapevineState, 'state hook');
  await page.click('#play');
  expect((await state(page)).level === 45, 'the play button starts village 45');
  await page.goto(`${base}/grapevine/?level=60`); await until(page, () => window.grapevineState, 'state hook');
  await page.click('#play');
  const st = await state(page), lv = await levelNow(page);
  await finger(page, '#c', dragSteps(st.nodes, solve(lv).best));
  await until(page, () => window.grapevineState().screen === 'done', 'level 60 solved');
  await sleep(1200);
  expect(!(await page.locator('#next').isDisabled()), 'the last card has a live button');
  expect(/45/.test(await page.textContent('#next')), `the last card points at village 45 (${await page.textContent('#next')})`);
  if (!(await page.locator('#next').isDisabled())) { await page.click('#next'); expect((await state(page)).level === 45, 'the last card starts village 45'); }
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('grapevine-save')));
  expect(saved.best[45] === 2 && saved.best[60] === 3 && saved.opened === 61, 'the save keeps its stars and progress');
  // Put the earlier save back, so the checks after this one start where they expect.
  await page.goto(`${base}/grapevine/`);
  await page.evaluate(before => { if (before === null) localStorage.removeItem('grapevine-save'); else localStorage.setItem('grapevine-save', before); }, before);
  assert.deepEqual(misses, [], 'middle and late game');
}

async function menuAndReload(page) {
  await page.goto(base + '/grapevine/?level=3');
  await until(page, () => window.grapevineState, 'village menu');
  const issues = [];
  const smallTargets = await page.locator('#menu button, #menu a').evaluateAll(nodes => nodes.filter(el => {
    const { width, height } = el.getBoundingClientRect();
    return width < 44 || height < 44;
  }).map(el => el.textContent));
  assert.deepEqual(smallTargets, [], 'menu touch targets span at least 44 CSS pixels');
  const footer = await page.locator('#menu .lab-notice').boundingBox();
  if (footer.y + footer.height > page.viewportSize().height) issues.push('recording notice is clipped');
  await page.locator('#tabs button').nth(1).tap();
  if (!/30 ✓ → 🔓/.test(await page.textContent('#unlockCue'))
    || !/Finish village 30/.test(await page.textContent('#unlockStatus'))) issues.push('Winter unlock condition missing');
  await page.click('#play');
  const st = await state(page), lv = await levelNow(page), nextHop = solve(lv).best[1];
  await page.touchscreen.tap(st.nodes[nextHop].x, st.nodes[nextHop].y);
  await page.reload();
  await until(page, () => window.grapevineState, 'reloaded village');
  const restored = await state(page);
  if (restored.screen !== 'paused' || restored.level !== 3 || restored.route.join() !== [lv.from, nextHop].join()) issues.push('reload lost the route');
  if (restored.paused) {
    const target = await page.locator('#paused label').boundingBox();
    if (target.height < 44) issues.push('recording toggle below 44px');
    await page.click('#toMenu');
    await page.reload();
    assert.equal((await state(page)).screen, 'menu', 'explicitly leaving discards the route');
  } else {
    await page.click('#play');
    await page.locator('#pause').tap();
    if ((await page.locator('#paused label').boundingBox()).height < 44) issues.push('recording toggle below 44px');
  }
  assert.deepEqual(issues, []);
}

// Read rendered text, accessible labels and text drawn on the visible canvases.
async function localeSurface(page) {
  return page.evaluate(() => {
    const parts = [document.title], overflow = [];
    const drawn = window.__grapevineDrawnText;
    const roots = [document.body, ...document.body.querySelectorAll('*')];
    const visible = el => el.getClientRects().length && getComputedStyle(el).visibility === 'visible';
    for (const el of roots.filter(visible)) {
      for (const attr of ['aria-label', 'title', 'alt', 'placeholder']) {
        if (el.hasAttribute(attr)) parts.push(el.getAttribute(attr));
      }
      for (const node of el.childNodes) if (node.nodeType === Node.TEXT_NODE) parts.push(node.textContent);
      if (el instanceof HTMLTextAreaElement) parts.push(el.value);
      if (el instanceof HTMLCanvasElement) parts.push(...(drawn.get(el) ?? []));
      if (el.namespaceURI !== 'http://www.w3.org/1999/xhtml' || el.closest('[hidden]')) continue;
      const style = getComputedStyle(el);
      if (style.clip !== 'auto' || style.clipPath === 'inset(50%)') continue;
      const { left, right, top, bottom, width, height } = el.getBoundingClientRect();
      if (!width || !height) continue;
      const label = el.id ? `#${el.id}` : el.className || el.localName;
      if (left < -2 || top < -2 || right > innerWidth + 2 || bottom > innerHeight + 2) {
        overflow.push(`${label} [${[left, top, right, bottom].map(Math.round).join(', ')}]`);
      }
      if (el.matches('.screen > div, dialog') && (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2)) {
        overflow.push(`${label} has clipped content`);
      }
    }
    if (document.documentElement.scrollWidth > innerWidth + 2) overflow.push('horizontal page scroll');
    return { parts: parts.map(part => part.replace(/\s+/gu, ' ').trim()).filter(Boolean), overflow };
  });
}

function englishText(tables) {
  const turkish = new Set(Object.values(tables.tr));
  return Object.entries(tables.en).flatMap(([key, value]) => {
    const template = value.replace(/\s+/gu, ' ').trim();
    const literal = template.replace(/\{\w+\}/gu, '');
    if (!/\p{L}/u.test(literal) || turkish.has(value)) return [];
    const pattern = template.split(/(\{\w+\})/u).map(part => /^\{\w+\}$/u.test(part) ? '.+?' : RegExp.escape(part)).join('');
    // Check full labels and sentences embedded in a longer aria-label or share result.
    return [[key, new RegExp(literal.trim().includes(' ') ? `(?<![\\p{L}\\p{N}])${pattern}(?![\\p{L}\\p{N}])` : `^${pattern}$`, 'u')]];
  });
}

async function localizedScreens(browser, device, phone) {
  for (const lang of ['en', 'tr']) {
    const context = await browser.newContext({ ...device, locale: 'en-US' });
    const errors = [];
    try {
      await context.addInitScript(() => {
        localStorage.setItem('notes.k', 'local-check');
        const drawn = window.__grapevineDrawnText = new WeakMap();
        for (const method of ['fillText', 'strokeText']) {
          const original = CanvasRenderingContext2D.prototype[method];
          CanvasRenderingContext2D.prototype[method] = function (...args) {
            if (!drawn.has(this.canvas)) drawn.set(this.canvas, new Set());
            drawn.get(this.canvas).add(String(args[0]));
            return original.apply(this, args);
          };
        }
      });
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(String(e)));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      const go = async (options = { hint: '0' }) => {
        const query = new URLSearchParams({ lang, ...options });
        await page.goto(`${base}/grapevine/?${query}`);
        await until(page, () => window.grapevineState, 'localized state hook');
      };
      await go();
      const tables = await page.evaluate(async () => (await import('./words.js')).tables);
      assert.deepEqual(Object.keys(tables.en).sort(), Object.keys(tables.tr).sort(), 'English and Turkish keys match');
      for (const key of Object.keys(tables.en)) {
        for (const table of [tables.en, tables.tr]) assert.ok(table[key].trim(), `nonempty translation: ${key}`);
        const fields = text => [...new Set(text.match(/\{\w+\}/gu) ?? [])].sort();
        assert.deepEqual(fields(tables.en[key]), fields(tables.tr[key]), `translation keeps substitution fields: ${key}`);
      }
      const english = englishText(tables);
      const take = async name => {
        // Wait for the canvas and the browser compositor after switching screens.
        await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
        await sleep(120);
        assert.equal(await page.locator('html').getAttribute('lang'), lang, `${name}: document language`);
        const path = join(lang === 'tr' ? WORD_SHOTS : SHOTS, `${phone}-${lang}-${name}.png`);
        await page.screenshot({ path, animations: 'disabled' });
        const { parts, overflow } = await localeSurface(page);
        assert.deepEqual(overflow, [], `${phone} ${lang} ${name}: elements fit the viewport`);
        if (lang === 'tr') {
          const leftovers = parts.flatMap(part => english.filter(([, pattern]) => pattern.test(part)).map(([key]) => ({ key, part })));
          assert.deepEqual(leftovers, [], `${name}: English text from the table`);
        }
      };
      const globe = async (where, code) => {
        const button = page.locator(`#language-${where}`), box = await button.boundingBox();
        assert.ok(box?.width >= 44 && box?.height >= 44, `${where}: language control is at least 44 px`);
        assert.equal(await button.locator('.language-code').textContent(), code);
        return button;
      };
      const finish = async (route, st) => {
        for (const v of route.slice(1)) await tap(page, st.nodes[v]);
        await until(page, () => window.grapevineState().screen === 'done', 'localized end card');
        await until(page, () => document.querySelectorAll('#stars .on').length === 3, 'stars finished appearing');
      };

      await take('menu');
      assert.equal(await page.locator('#notes-button').getAttribute('aria-label'), tables[lang].notes);
      const menuGlobe = await globe('menu', lang.toUpperCase());
      if (lang === 'tr') {
        await menuGlobe.tap();
        assert.equal(await page.locator('html').getAttribute('lang'), 'en');
        assert.equal(await page.locator('#notes-button').getAttribute('aria-label'), tables.en.notes);
        await page.reload();
        await until(page, () => window.grapevineState, 'reload with the changed language in the address');
        await globe('menu', 'EN');
        await page.evaluate(() => {
          const url = new URL(location.href);
          url.searchParams.delete('lang');
          history.replaceState(history.state, '', url);
        });
        await menuGlobe.tap();
        assert.equal(await page.locator('html').getAttribute('lang'), 'tr');
        await page.reload();
        await until(page, () => window.grapevineState, 'reload without a language query');
        assert.equal(new URL(page.url()).searchParams.get('lang'), null);
        assert.equal(await page.locator('html').getAttribute('lang'), 'tr', 'language choice remembered on reload');
        await globe('menu', 'TR');
      }
      await page.locator('#tabs button').nth(1).tap();
      await take('locked-chapter');

      await page.locator('#play').tap();
      let st = await state(page);
      assert.equal(st.level, 1);
      await sleep(450);
      await take('level1-teaching');
      await tap(page, st.nodes.find(node => node.kind === 'paint'));
      await sleep(450);
      await take('level1-after-painter');
      await page.locator('#pause').tap();
      await take('pause');
      const pauseGlobe = await globe('pause', lang.toUpperCase());
      if (lang === 'tr') {
        const before = await state(page);
        await pauseGlobe.tap();
        assert.equal(await page.locator('html').getAttribute('lang'), 'en');
        assert.deepEqual((await state(page)).route, before.route);
        assert.ok((await state(page)).paused, 'language switch keeps the pause screen');
        await pauseGlobe.tap();
        assert.equal(await page.locator('html').getAttribute('lang'), 'tr');
      }
      await page.locator('#resume').tap();
      await tap(page, st.nodes[st.to]);
      await until(page, () => document.querySelectorAll('#done.on #stars .on').length === 3, 'first win finished appearing');
      await take('win');
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied'); } } });
      });
      await page.locator('#share').tap();
      await take('postcard');
      await page.locator('#sendCard').tap();
      await until(page, () => !document.querySelector('#manualShare').hidden, 'manual share fallback');
      await take('postcard-copy');
      await page.locator('#backToResult').tap();

      await page.locator('#next').tap();
      st = await state(page);
      await take('level2-goal');
      const lv2 = await levelNow(page);
      const wrong = lv2.nodes.findIndex(n => n.kind === 'paint' && n.arg !== lv2.want.c);
      await tap(page, st.nodes[wrong]);
      await tap(page, st.nodes[st.to]);
      await until(page, () => window.grapevineState().result === 'wrong', 'localized loss');
      await sleep(350);
      await take('loss');
      await go({ level: '3', hint: '0' });
      await page.locator('#play').tap();
      await take('level3-goal');

      await go({ level: '10', hint: '0' });
      await page.locator('#play').tap();
      st = await state(page);
      const swapRoute = solve(await levelNow(page)).best;
      await tap(page, st.nodes[swapRoute[1]]);
      await take('swap');
      for (const v of swapRoute.slice(2, 4)) await tap(page, st.nodes[v]);
      await take('swap-unchanged');

      await page.emulateMedia({ reducedMotion: 'reduce' });
      await go({ hint: 'hand' });
      await page.locator('#play').tap();
      await until(page, () => !!document.querySelector('.kit-hint.on.still'), 'localized reduced-motion hint');
      await take('still-hint');
      await page.emulateMedia({ reducedMotion: 'no-preference' });

      await page.evaluate(() => {
        const save = JSON.parse(localStorage.getItem('grapevine-save'));
        save.opened = 60;
        localStorage.setItem('grapevine-save', JSON.stringify(save));
      });
      await go({ tier: '3', hint: '0' });
      await take('unlocked-autumn');
      await page.locator('#tabs button').nth(1).tap();
      await take('unlocked-winter');
      await page.locator('#daily').tap();
      await take('daily-board');
      await finish(solve(await levelNow(page)).best, await state(page));
      await take('daily-win');
      await page.locator('#share').tap();
      const daily = await page.evaluate(() => {
        const key = Object.keys(JSON.parse(localStorage.getItem('grapevine-save')).daily)[0];
        const date = new Intl.DateTimeFormat(document.documentElement.lang, { dateStyle: 'medium' }).format(new Date(`${key}T12:00:00`));
        const card = document.querySelector('#cardPreview canvas');
        return { date, drawn: [...window.__grapevineDrawnText.get(card)], shareText: window.grapevineState().shareText };
      });
      const where = tables[lang].dailyDate.replace('{date}', daily.date);
      assert.ok(daily.drawn.includes(where) && daily.shareText.includes(where), 'daily date follows the chosen language');
      await take('daily-postcard');

      for (const [level, name] of [['45', 'chapter-win'], ['60', 'campaign-win']]) {
        await go({ level, hint: '0' });
        await page.locator('#play').tap();
        await finish(solve(await levelNow(page)).best, await state(page));
        await take(name);
      }
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied'); } } });
      });
      await page.locator('#share').tap();
      await page.locator('#sendCard').tap();
      await until(page, () => !document.querySelector('#manualShare').hidden, 'manual copy from a long card');
      await take('campaign-postcard-copy');
      assert.deepEqual(errors, [], `${lang}: page errors`);
    } finally {
      await context.close();
    }
  }
}

const only = process.argv[2];
let failed = 0;
for (const [phone, [engine, device]] of Object.entries(PHONES)) {
  if (only && only !== phone) continue;
  const browser = await engine.launch();
  const context = await browser.newContext({ ...device, locale: 'en-US' }), page = await context.newPage(), errors = [];
  context.labSent = [];
  await context.route('https://human.adamwhite.work/**', async route => {
    const req = route.request(), cors = { 'access-control-allow-origin': base, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'Content-Type' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    context.labSent.push(JSON.parse(gunzipSync(req.postDataBuffer()).toString()));
    return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: '{"ok":true}' });
  });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  try {
    await boardFeedback(page);
    await lateGame(page);
    await menuAndReload(page);
    await run(page, phone);
    await firstHint(page);
    await chapters(page, phone);
    assert.deepEqual(errors, [], 'page errors');
    console.log(`ok   grapevine on ${phone}`);
  } catch (e) {
    failed++;
    console.log(`FAIL grapevine on ${phone}: ${e.message}`);
    if (errors.length) console.log('     ' + errors.join('\n     '));
    await shot(page, phone, 'fail').catch(() => {});
  }
  await context.close();
  const compact = { viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
  const localePhone = phone === 'webkit' ? 'webkit-iphone13' : 'chromium-360x640';
  try {
    await localizedScreens(browser, phone === 'webkit' ? device : compact, localePhone);
    console.log(`ok   English and Turkish screens on ${localePhone}`);
  } catch (e) { failed++; console.log(`FAIL localized screens on ${localePhone}: ${e.message}`); }
  // The small phone: 360 x 640. The menu fits without sideways scroll; a nine-villager level fits on screen.
  if (phone === 'chromium') {
    const small = await browser.newContext({ ...compact, locale: 'en-US' });
    const p2 = await small.newPage(), errs = [];
    p2.on('pageerror', e => errs.push(String(e))); p2.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    try {
      await menuAndReload(p2);
      await p2.goto(`${base}/grapevine/?level=30`); await until(p2, () => window.grapevineState, 'state hook');
      assert.ok(await p2.evaluate(() => document.documentElement.scrollWidth <= 360), 'no sideways scroll');
      const play = await p2.locator('#play').boundingBox(); assert.ok(play.y + play.height <= 640, 'Play is on screen');
      await shot(p2, 'small', '1-menu');
      await p2.click('#play'); const st = await state(p2);
      assert.ok(st.nodes.every(n => n.x > 20 && n.x < 340 && n.y > 130 && n.y < 600), 'every villager on screen');
      await sleep(300); await shot(p2, 'small', '2-level30');
      // The parrot level, with the route past the parrot: its badge shows the change it copies.
      await p2.goto(`${base}/grapevine/?level=25`); await until(p2, () => window.grapevineState, 'state hook');
      await p2.click('#play'); const s25 = await state(p2), lv25 = await levelNow(p2), b25 = solve(lv25).best;
      await finger(p2, '#c', dragSteps(s25.nodes, b25.slice(0, -1), true));
      await sleep(300); await shot(p2, 'small', '3-level25-parrot');
      await p2.evaluate(() => localStorage.clear());
      await chapters(p2, 'small');
      assert.deepEqual(errs, []);
      console.log('ok   grapevine on chromium 360x640');
    } catch (e) { failed++; console.log(`FAIL grapevine on chromium 360x640: ${e.message}`); }
    await small.close();
    // Colour cues: every colour carries a mark, so the four stay apart for red-green colour blindness and in grey.
    // Draws tokens and painter badges with art.js, then simulates deuteranopia (the Machado 2009 matrix, full
    // severity, applied in linear RGB) and greyscale on the pixels, and compares every pair of colours.
    const cb = await browser.newContext({ viewport: { width: 420, height: 560 }, deviceScaleFactor: 2, locale: 'en-US' });
    const p4 = await cb.newPage(), errs4 = [];
    p4.on('pageerror', e => errs4.push(String(e))); p4.on('console', m => { if (m.type() === 'error') errs4.push(m.text()); });
    try {
      await p4.goto(`${base}/grapevine/`); await until(p4, () => window.grapevineState, 'state hook');
      const result = await p4.evaluate(async () => {
        const art = await import('./art.js');
        const S = 2, cell = 100;
        const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
        const enc = v => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
        const M = [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]];
        const views = {
          normal: (r, g, b) => [r, g, b],
          deuteranopia: (r, g, b) => { const L = [lin(r), lin(g), lin(b)]; return M.map(row => enc(Math.min(1, Math.max(0, row[0] * L[0] + row[1] * L[1] + row[2] * L[2])))); },
          grey: (r, g, b) => { const y = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); const v = enc(y); return [v, v, v]; },
        };
        // one canvas per colour: a single circle token, the same for all four but the colour
        const one = c => {
          const cv = document.createElement('canvas'); cv.width = cv.height = cell * S; const g = cv.getContext('2d'); g.scale(S, S);
          g.fillStyle = '#3b2a5c'; g.fillRect(0, 0, cell, cell);
          art.token(g, { s: 0, c, n: 1 }, cell / 2, cell / 2, 40);
          return g.getImageData(0, 0, cv.width, cv.height).data;
        };
        const raw = [0, 1, 2, 3].map(one), out = {};
        for (const [name, f] of Object.entries(views)) {
          const imgs = raw.map(d => { const o = new Float32Array(d.length / 4 * 3); for (let i = 0, j = 0; i < d.length; i += 4, j += 3) { const v = f(d[i], d[i + 1], d[i + 2]); o[j] = v[0]; o[j + 1] = v[1]; o[j + 2] = v[2]; } return o; });
          // for each pair: the share of the coloured shape (radius 22 around the middle) whose colour differs
          // by more than 40 (of 255) in some channel
          const pairs = {}, side = cell * S, mid = side / 2, rad = 22 * S;
          for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
            let n = 0, all = 0; const A = imgs[a], B = imgs[b];
            for (let i = 0, k = 0; i < A.length; i += 3, k++) {
              if (Math.hypot(k % side - mid, Math.floor(k / side) - mid) > rad) continue;
              all++;
              if (Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])) > 40) n++;
            }
            pairs[`${a}-${b}`] = n / all;
          }
          out[name] = pairs;
        }
        // a sheet for the eye: tokens of each colour in four shapes and counts, and the painter badges, in three views
        const sheet = document.createElement('canvas'); const SW = 400, SH = 520;
        sheet.width = SW * S; sheet.height = SH * S; sheet.style.cssText = `position:fixed;left:10px;top:20px;width:${SW}px;height:${SH}px;z-index:99`;
        const sg = sheet.getContext('2d'); sg.scale(S, S); sg.fillStyle = '#3b2a5c'; sg.fillRect(0, 0, SW, SH);
        const drawSet = (g, y0) => {
          g.fillStyle = '#3b2a5c'; g.fillRect(0, y0, SW, 180);
          for (let c = 0; c < 4; c++) {
            const x = 50 + c * 100;
            art.token(g, { s: 0, c, n: 1 }, x - 22, y0 + 32, 22);
            art.token(g, { s: 3, c, n: 1 }, x + 22, y0 + 32, 22);
            art.token(g, { s: 2, c, n: 2 }, x - 22, y0 + 80, 22);
            art.token(g, { s: 1, c, n: 3 }, x + 22, y0 + 80, 22);
            art.badge(g, { kind: 'paint', arg: c }, x, y0 + 130, 60, 26);
          }
        };
        drawSet(sg, 0);
        const base = sg.getImageData(0, 0, SW * S, 160 * S);
        [['deuteranopia', 180], ['grey', 360]].forEach(([name, y0]) => {
          const d = new ImageData(new Uint8ClampedArray(base.data), base.width, base.height);
          for (let i = 0; i < d.data.length; i += 4) { const v = views[name](d.data[i], d.data[i + 1], d.data[i + 2]); d.data[i] = v[0]; d.data[i + 1] = v[1]; d.data[i + 2] = v[2]; }
          sg.putImageData(d, 0, y0 * S);
        });
        sg.fillStyle = '#fff4dc'; sg.font = '12px sans-serif';
        sg.fillText('normal', 4, 156); sg.fillText('deuteranopia (simulated)', 4, 336); sg.fillText('greyscale', 4, 516);
        document.body.append(sheet);
        return out;
      });
      await sleep(100); await p4.screenshot({ path: join(SHOTS, 'colour-cues.png'), clip: { x: 10, y: 20, width: 400, height: 520 } });
      for (const view of ['deuteranopia', 'grey']) for (const [pair, share] of Object.entries(result[view]))
        assert.ok(share > 0.03, `${view}: colours ${pair} differ on ${(100 * share).toFixed(1)}% of a token's shape`);
      assert.deepEqual(errs4, []);
      const worst = view => Math.min(...Object.values(result[view])) * 100;
      console.log(`ok   grapevine colour cues: least different pair covers ${worst('deuteranopia').toFixed(1)}% of a token's shape under deuteranopia, ${worst('grey').toFixed(1)}% in grey`);
      colourReport = result;
    } catch (e) { failed++; console.log(`FAIL grapevine colour cues: ${e.message}`); }
    await cb.close();
    // Desktop: 1280 x 800 with a mouse. The menu fits, and level 1 is solved by a mouse drag.
    const desk = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'en-US' });
    const p3 = await desk.newPage(), errs3 = [];
    p3.on('pageerror', e => errs3.push(String(e))); p3.on('console', m => { if (m.type() === 'error') errs3.push(m.text()); });
    try {
      await p3.goto(`${base}/grapevine/?level=1`); await until(p3, () => window.grapevineState, 'state hook');
      await shot(p3, 'desktop', '1-menu');
      await p3.click('#play'); const sd = await state(p3), lvd = await levelNow(p3), route = solve(lvd).best;
      const at = v => sd.nodes[v];
      await p3.mouse.move(at(route[0]).x, at(route[0]).y); await p3.mouse.down();
      for (const v of route.slice(1)) await p3.mouse.move(at(v).x, at(v).y, { steps: 12 });
      await sleep(100); await shot(p3, 'desktop', '2-level1');
      await p3.mouse.up();
      await until(p3, () => window.grapevineState().result === 'won', 'desktop win');
      await p3.goto(`${base}/grapevine/?level=29`); await until(p3, () => window.grapevineState, 'state hook');
      await p3.click('#play'); const s29 = await state(p3);
      assert.ok(s29.nodes.every(n => Math.abs(n.x - 640) <= 300), 'the board stays a phone-wide column on desktop');
      await sleep(300); await shot(p3, 'desktop', '3-level29');
      for (const n of [45, 60]) { // the wide street in winter and in autumn
        await p3.goto(`${base}/grapevine/?level=${n}`); await until(p3, () => window.grapevineState, 'state hook');
        await p3.click('#play'); const sn = await state(p3);
        assert.ok(sn.nodes.every(q => Math.abs(q.x - 640) <= 300), `level ${n}: a phone-wide column`);
        await sleep(400); await shot(p3, 'desktop', `4-level${n}`);
      }
      assert.deepEqual(errs3, []);
      console.log('ok   grapevine on chromium desktop 1280x800');
    } catch (e) { failed++; console.log(`FAIL grapevine on chromium desktop: ${e.message}`); }
    await desk.close();
  }
  await browser.close();
}
server.close();
if (colourReport && process.env.VERBOSE) console.log(JSON.stringify(colourReport));
console.log(`screenshots in ${SHOTS}`);
console.log(`Turkish screenshots in ${WORD_SHOTS}`);
process.exit(failed ? 1 : 0);
