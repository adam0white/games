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
const shot = (page, phone, name) => page.screenshot({ path: join(SHOTS, `${phone}-${name}.png`) });

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
      assert.deepEqual(errs3, []);
      console.log('ok   grapevine on chromium desktop 1280x800');
    } catch (e) { failed++; console.log(`FAIL grapevine on chromium desktop: ${e.message}`); }
    await desk.close();
  }
  await browser.close();
}
server.close();
console.log(`screenshots in ${SHOTS}`);
process.exit(failed ? 1 : 0);
