// Phone smoke test for Grapevine: node experiments/grapevine/check.mjs [webkit|chromium]
// Serves experiments/ on a free port, answers /notes/button.js with an empty script and the lab endpoint
// itself, and plays real levels with touch pointer events on WebKit (iPhone 13) and Chromium (Pixel 7).
// Screenshots go to $SHOTS (default: a folder in the system temp directory, not the repo).
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { gunzipSync } from 'node:zlib';
import assert from 'node:assert/strict';
import { solve, walk } from './sim.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = process.env.SHOTS || join(tmpdir(), 'grapevine-shots');
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
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  try {
    await run(page, phone);
    await firstHint(page);
    assert.deepEqual(errors, [], 'page errors');
    console.log(`ok   grapevine on ${phone}`);
  } catch (e) {
    failed++;
    console.log(`FAIL grapevine on ${phone}: ${e.message}`);
    if (errors.length) console.log('     ' + errors.join('\n     '));
    await shot(page, phone, 'fail').catch(() => {});
  }
  await context.close();
  // The small phone: 360 x 640. The menu fits without sideways scroll; a nine-villager level fits on screen.
  if (phone === 'chromium') {
    const small = await browser.newContext({ viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const p2 = await small.newPage(), errs = [];
    p2.on('pageerror', e => errs.push(String(e))); p2.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    try {
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
      assert.deepEqual(errs, []);
      console.log('ok   grapevine on chromium 360x640');
    } catch (e) { failed++; console.log(`FAIL grapevine on chromium 360x640: ${e.message}`); }
    await small.close();
    // Colour cues: every colour carries a mark, so the four stay apart for red-green colour blindness and in grey.
    // Draws tokens and painter badges with art.js, then simulates deuteranopia (the Machado 2009 matrix, full
    // severity, applied in linear RGB) and greyscale on the pixels, and compares every pair of colours.
    const cb = await browser.newContext({ viewport: { width: 420, height: 560 }, deviceScaleFactor: 2 });
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
    const desk = await browser.newContext({ viewport: { width: 1280, height: 800 } });
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
process.exit(failed ? 1 : 0);
