// Phone smoke test for Fix-It Stall: node experiments/fixit/check.mjs [webkit|chromium]
// Serves experiments/ on a free port, plays with real touch pointer events on WebKit (iPhone 13) and Chromium (Pixel 7),
// and fails on any page or console error. Screenshots go to $SHOTS (default: a folder in the OS temp directory).
// Levels are played to their end; the open and daily stalls are shortened with ?day= where a whole shift is played.
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { gunzipSync } from 'node:zlib';
import assert from 'node:assert/strict';
import { plan, SKILLS } from './moves.js';
import { KINDS } from './sim.js';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '..');
const SHOTS = process.env.SHOTS || join(tmpdir(), 'fixit-shots'); // the build brief sets SHOTS to a scratch folder
await mkdir(SHOTS, { recursive: true });
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
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

const require = createRequire(process.env.PLAYWRIGHT ? join(resolve(process.env.PLAYWRIGHT), 'x.js') : '/Users/abdul/code/human-framework/node_modules/x.js');
const { webkit, chromium, devices } = require('playwright');
const PHONES = { webkit: [webkit, devices['iPhone 13']], chromium: [chromium, devices['Pixel 7']] };
const sleep = ms => new Promise(done => setTimeout(done, ms));
async function until(page, fn, what, ms = 10000, arg) { try { await page.waitForFunction(fn, arg, { timeout: ms }); } catch { throw new Error(`timed out waiting for: ${what}`); } }
let cur = null; // the page under test
const state = (page = cur) => page.evaluate(() => window.fixitState());
const SKILL = { ...SKILLS.competent, react: 0 };

// Do the job on the bench with real touch pointer events, one step per animation frame, the way a thumb would.
// The path comes from moves.js, built from the job's own guide; if the job is not done when the path ends, plan again.
async function doJob(page, label, pointerType = 'touch') {
  const st0 = await state();
  const job = st0.job;
  for (let tries = 0; tries < 15; tries++) {
    const st = await state();
    if (st.job !== job || st.over || st.phase !== 'work' || !st.guide) break;
    const steps = plan(st.guide, SKILL, [50, 110]).map(p => p && { type: p.type, x: st.box.x + p.x * st.box.unit, y: st.box.y + p.y * st.box.unit });
    await page.evaluate(async ([steps, job, stepN, pointerType]) => {
      const el = document.getElementById('c'); let last = null;
      const send = (type, x, y) => el.dispatchEvent(new PointerEvent('pointer' + type, { pointerId: 7, pointerType, isPrimary: true, clientX: x, clientY: y, pressure: type === 'up' ? 0 : 0.5, bubbles: true, cancelable: true }));
      for (const p of steps) {
        if (p) { send(p.type, p.x, p.y); last = p; }
        await new Promise(r => requestAnimationFrame(r));
        const s = window.fixitState();
        if (s.job !== job || s.step !== stepN || s.phase !== 'work') { if (last && last.type !== 'up') send('up', last.x, last.y); return; }
      }
      if (last && last.type !== 'up') send('up', last.x, last.y);
    }, [steps, job, st.step, pointerType]);
  }
  const done = await state();
  return done;
}
// Do the job with the keyboard: hold Space until the job is done, then let go.
async function keyJob(page, label) {
  const before = await state();
  await page.keyboard.down('Space');
  try { await until(page, ([job, step]) => { const s = window.fixitState(); return s.job !== job || s.step !== step || s.phase !== 'work' || s.over; }, `${label} by keyboard`, 15000, [before.job, before.step]); }
  finally { await page.keyboard.up('Space'); }
}
async function playJob(page, label, pointerType) {
  const before = await state();
  if (pointerType === 'keyboard') { for (let i = 0; i < 3; i++) { const s = await state(); if (s.job !== before.job || s.phase !== 'work' || s.over) break; await keyJob(page, label); } }
  else await doJob(page, label, pointerType);
  await until(page, ([job]) => { const s = window.fixitState(); return s.job !== job || s.over || s.screen === 'end'; }, `job ${label} to finish`, 15000, [before.job]);
  const after = await state();
  assert.ok(after.served + after.lost > before.served + before.lost || after.over, `${label}: job finished`);
  assert.equal(after.lost, before.lost, `${label}: done before the customer walked off`);
  return after;
}

// Quit to the menu and let the lab record leave before the next navigation (WebKit logs an error for a
// record still being compressed when the page goes away).
async function leave(page) { await page.click('#pause'); await page.click('#quit'); await sleep(300); }
// A level opens on its goal card with the sim waiting; a tap on the canvas starts it.
async function startLevel(page) {
  await until(page, () => window.fixitState().card > 0, 'the goal card');
  const st = await state(page);
  await page.evaluate(([x, y]) => { const el = document.getElementById('c'); for (const t of ['down', 'up']) el.dispatchEvent(new PointerEvent('pointer' + t, { pointerId: 2, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true })); }, [st.box.x + 50 * st.box.unit, st.box.y + 50 * st.box.unit]);
  await until(page, () => window.fixitState().card === 0, 'the goal card to go');
}
// Play every customer until the level or shift ends.
async function playOut(page, label, shot) {
  for (let i = 0; i < 60; i++) {
    const st = await state(page);
    if (st.over || st.screen === 'end') break;
    if (st.phase !== 'work') { await sleep(80); continue; }
    if (shot && st.served === 3) { await sleep(200); await page.screenshot({ path: shot }); shot = null; }
    await playJob(page, `${label} ${st.kind}`);
  }
  await until(page, () => window.fixitState().screen === 'end', `${label}: the end card`, 15000);
  await sleep(250);
  return state(page);
}
const runs = (ctx, outcome) => ctx.labSent.filter(r => r.game === 'fixit' && r.kind === 'run' && (!outcome || r.data.outcome === outcome));
const levelsUpTo = n => Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, 1]));

async function run(page, phone) {
  cur = page;
  const ctx = page.context();
  await page.goto(`${base}/fixit/`);
  await page.evaluate(() => localStorage.setItem('hf-lab-send-localhost', '1'));
  await page.reload();
  await until(page, () => window.fixitState && window.fixitState().screen === 'menu', 'menu');
  assert.match(await page.textContent('#menu'), /The game lab records play/, 'lab notice on the menu');
  // The map: 32 numbered levels, level 1 marked next, the rest locked; no open or daily stall yet.
  assert.equal(await page.locator('.lv').count(), 32, 'the map shows 32 levels');
  assert.ok(await page.locator('.lv.next[data-level="1"]').count() === 1 && await page.locator('.lv[data-level="2"]').isDisabled(), 'level 1 next, level 2 locked');
  assert.ok(!(await page.isVisible('#open')) && !(await page.isVisible('#daily')), 'no open or daily stall on a new save');
  assert.match(await page.textContent('#play'), /level 1/, 'Play names the next level');
  await sleep(200);
  await page.screenshot({ path: join(SHOTS, `${phone}-1-map.png`) });

  // Level 1: the goal card, the sim waiting behind it, then a tap starts it.
  await page.click('#play');
  let st = await state();
  assert.ok(st.playing && st.screen === 'play' && st.mode === 'level' && st.level === 1, 'Play starts level 1');
  assert.equal(st.kind, 'screw', 'level 1 teaches the screw');
  assert.ok(st.minTouchPx >= 44, `smallest touch target ${st.minTouchPx.toFixed(0)} px`);
  await sleep(500);
  st = await state();
  assert.ok(st.card > 0 && st.t === 0, 'the sim waits behind the goal card');
  await page.screenshot({ path: join(SHOTS, `${phone}-2-goal-card.png`) });
  await startLevel(page);
  await sleep(500);
  assert.equal((await state()).hint, 1, 'the ghost finger shows on the first job');
  // A tap beside the job is answered (sound and a ripple) and does no harm.
  st = await state();
  await page.evaluate(([x, y]) => { const el = document.getElementById('c'); for (const t of ['down', 'up']) el.dispatchEvent(new PointerEvent('pointer' + t, { pointerId: 3, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true })); }, [st.box.x + 2 * st.box.unit, st.box.y + 98 * st.box.unit]);
  // Pause by the button freezes the sim; Keep going resumes it. Losing focus pauses; P resumes.
  await page.click('#pause');
  st = await state(); assert.ok(st.paused && st.screen === 'paused', 'pause button pauses');
  await sleep(300); assert.equal((await state()).t, st.t, 'time stands still while paused');
  await page.click('#resume');
  await until(page, t => window.fixitState().t > t, 'time moves after resume', 3000, st.t);
  await page.evaluate(() => dispatchEvent(new Event('blur')));
  assert.ok((await state()).paused, 'losing focus pauses');
  await page.keyboard.press('p');
  assert.ok(!(await state()).paused, 'P resumes');
  // Play it out, watching every frame that no two people overlap and the goal counts up.
  await page.evaluate(() => {
    window.__gap = Infinity; window.__alpha = []; window.__words = []; window.__have = [];
    const f = () => {
      const st = window.fixitState(), p = st.people;
      for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) window.__gap = Math.min(window.__gap, Math.abs(p[i].x - p[j].x) - 1.5 * (p[i].R + p[j].R));
      if (st.playing && window.__alpha.length < 400) window.__alpha.push(st.alpha);
      if (st.word && !window.__words.includes(st.word)) window.__words.push(st.word);
      const h = st.goal?.parts[0]?.have; if (h !== undefined && h !== window.__have.at(-1)) window.__have.push(h);
      if (st.screen !== 'end') requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  });
  st = await playOut(page, 'level 1', join(SHOTS, `${phone}-3-level-hud.png`));
  assert.ok(st.cleared && st.stars >= 1 && st.over === 'clear', `level 1 cleared with ${st.stars} stars`);
  const gap = await page.evaluate(() => window.__gap), alphas = await page.evaluate(() => window.__alpha), have = await page.evaluate(() => window.__have);
  assert.ok(gap >= 0, `people never overlap (closest bodies ${gap.toFixed(1)} px apart)`);
  assert.ok(alphas.length > 50 && alphas.every(a => a >= 0 && a <= 1), 'drawing blends between ticks by a fraction in 0..1');
  assert.deepEqual(have, [0, 1, 2, 3, 4, 5, 6], 'the goal counter counts each fix');
  assert.match(await page.textContent('#endTitle'), /Level 1 cleared/, 'the cleared card');
  assert.ok(await page.isVisible('#next'), 'Next level on the cleared card');
  assert.equal(st.levels[1], st.stars, 'stars saved');
  assert.equal(st.bank, st.coins + st.stars * 5, 'coins and the star bonus banked');
  await page.screenshot({ path: join(SHOTS, `${phone}-4-cleared.png`) });
  await sleep(300);
  const r1 = runs(ctx, 'closed');
  assert.equal(r1.length, 1, 'the level sent once, as closed');
  assert.ok(r1[0].data.summary.level === 1 && r1[0].data.summary.cleared === true && r1[0].data.summary.stars === st.stars, 'the run summary names the level, the clear and the stars');
  assert.ok(r1[0].data.events.filter(e => e.type === 'repair').length >= 6, 'repairs recorded');

  // Next: level 2 with its goal card; then pause and Menu keeps the coins and sends 'left'.
  await page.click('#next');
  st = await state();
  assert.ok(st.level === 2 && st.card > 0 && st.kind === 'pin', 'Next starts level 2, which teaches the pin');
  await startLevel(page);
  await playJob(page, 'level 2 pin');
  const before = await state(); assert.ok(before.coins > 0, 'coins earned before leaving');
  await page.click('#pause'); await page.click('#quit');
  st = await state();
  assert.equal(st.screen, 'menu', 'Menu from the pause card');
  assert.equal(st.bank, before.bank + before.coins, 'Menu keeps the coins of the level (note #150)');
  assert.ok(!st.levels[2], 'a level left early is not cleared');
  assert.equal(await page.textContent('#bank'), String(st.bank), 'the menu shows the kept coins');
  await sleep(300);
  assert.equal(runs(ctx).at(-1).data.outcome, 'left', 'quitting is sent as left');
  assert.equal(await page.locator('.lv.next[data-level="2"]').count(), 1, 'level 2 is next on the map');
  // The save survives a reload.
  const blob = await page.evaluate(() => localStorage.getItem('fixit-save'));
  await page.reload();
  await until(page, () => window.fixitState && window.fixitState().screen === 'menu', 'menu after reload');
  assert.equal(await page.evaluate(() => localStorage.getItem('fixit-save')), blob, 'save blob unchanged by a reload');
  assert.ok((await state()).levels[1] >= 1, 'stars kept across a reload');

  // A failed level: level 19 asks that nobody walks off; with hands off the first customer does. One tap restarts it.
  await setSave(page, { levels: levelsUpTo(18), bank: 0 });
  await page.reload();
  await page.click('.lv[data-level="19"]');
  st = await state(); assert.equal(st.level, 19, 'a map tile starts its level');
  await startLevel(page);
  await until(page, () => window.fixitState().screen === 'end', 'level 19 to fail', 20000);
  await sleep(300);
  st = await state();
  assert.ok(!st.cleared && st.over === 'lost' && !st.levels[19], 'level 19 failed');
  assert.equal(await page.textContent('#endTitle'), 'Someone walked off', 'the failed card says why');
  assert.ok(!(await page.isVisible('#next')) && (await page.getAttribute('#again', 'class')) === 'main', 'Try again is the main button, no Next');
  await page.screenshot({ path: join(SHOTS, `${phone}-5-failed.png`) });
  await page.click('#again');
  st = await state();
  assert.ok(st.playing && st.level === 19 && st.card > 0, 'one tap restarts the level');
  await sleep(200);
  const fail = runs(ctx, 'closed').at(-1);
  assert.ok(fail.data.summary.level === 19 && fail.data.summary.cleared === false && fail.data.summary.why === 'lost', 'the failed level is sent as closed, not cleared');
  await leave(page);

  // Every job, forced with ?only= (the open stall with one job), done once with real pointer events.
  for (const kind of KINDS) {
    await page.goto(`${base}/fixit/?seed=3&only=${kind}`);
    await page.click('#play');
    st = await state();
    assert.ok(st.kind === kind && st.mode === 'open' && st.card === 0, `only=${kind}`);
    if (['oil', 'zip', 'spring', 'thread'].includes(kind)) { await sleep(400); await page.screenshot({ path: join(SHOTS, `${phone}-job-${kind}.png`) }); }
    await playJob(page, kind);
    await leave(page);
  }

  // The open stall: shown after level 8 (or an old shift). Leaving after four repairs keeps a new job; fewer does not (note #150).
  for (const [jobs, want] of [[1, 3], [4, 4]]) {
    await page.goto(`${base}/fixit/?seed=7&day=200&two=0`); await setSave(page, { shifts: 1 }); await page.reload();
    await page.click('#open');
    assert.equal((await state()).mode, 'open', 'the open stall');
    for (let i = 0; i < 12; i++) { st = await state(); if (st.served >= jobs) break; if (st.phase !== 'work') { await sleep(100); continue; } await playJob(page, `open stall ${st.kind}`); }
    st = await state(); assert.ok(st.served >= jobs && st.playing, `${jobs} fixed and still in the shift`);
    await leave(page); assert.equal((await state()).unlocked.length, want, `left after ${jobs}: ${want} jobs`);
  }
  // A two-repair job.
  await page.goto(`${base}/fixit/?seed=4&two=1&ramp=3`); await setSave(page, { shifts: 1 }); await page.reload();
  await page.click('#open');
  st = await state();
  assert.equal(st.steps, 2, 'a job with two repairs');
  await playJob(page, `two: ${st.customer.kinds.join('+')}`);
  await leave(page);
  // A golden customer (?golden=1 makes every customer golden): two repairs, four times the pay.
  await page.goto(`${base}/fixit/?seed=8&golden=1&ramp=1`);
  await page.click('#open');
  st = await state();
  assert.ok(st.golden && st.customer.golden && st.steps === 2, 'a golden customer brings two repairs');
  const coins0 = st.coins;
  await playJob(page, `golden ${st.customer.kinds.join('+')}`);
  st = await state();
  assert.ok(st.coins - coins0 >= 16, `a golden job pays four times over (${st.coins - coins0} coins)`);
  await leave(page);

  // An old save from before the map: coins and shop kept, the levels that teach its jobs done, once.
  await setSave(page, { v: 1, bank: 321, best: 88, shifts: 4, served: 40, unlocked: ['screw', 'pin', 'dent', 'wheel', 'rub', 'clock'], owned: ['teal', 'copper'], awning: 'copper', sound: true, days: {} });
  await page.goto(`${base}/fixit/`);
  st = await state();
  assert.deepEqual([st.bank, st.awning, st.migrated, st.next], [321, 'copper', 4, 5], 'old save: coins and awning kept, levels 1 to 4 done, level 5 next');
  assert.deepEqual(st.levels, { 1: 1, 2: 1, 3: 1, 4: 1 }, 'old save: one star each');
  assert.ok(st.openStall && st.dailyOpen && await page.isVisible('#open'), 'old save: the open and daily stalls stay open');
  assert.match(await page.textContent('#migrated'), /levels 1 to 4/, 'the menu says what was carried over');
  await page.screenshot({ path: join(SHOTS, `${phone}-6-old-save.png`) });
  await page.reload();
  st = await state();
  assert.ok(st.migrated === 0 && st.levels[4] === 1 && st.bank === 321, 'the carry-over happens once and is saved');
  await setSave(page, { v: 1, bank: 0, shifts: 0, sound: true });
  await page.reload();
  assert.deepEqual((await state()).levels, {}, 'an unplayed old save starts at level 1');

  // The shop: buy the cheapest thing; it is kept.
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('fixit-save')); s.bank = 500; localStorage.setItem('fixit-save', JSON.stringify(s)); });
  await page.goto(`${base}/fixit/`);
  await page.click('#toShop');
  await page.click('[data-item="copper"]');
  st = await state();
  assert.ok(st.owned.includes('copper') && st.awning === 'copper' && st.bank === 450, 'awning bought and in use');
  await page.click('[data-item="cat"]');
  await sleep(300);
  await page.screenshot({ path: join(SHOTS, `${phone}-7-shop.png`) });
  await page.reload();
  st = await state();
  assert.ok(st.owned.includes('copper') && st.owned.includes('cat') && st.bank === 170, 'purchases saved');
  const buys = ctx.labSent.filter(r => r.game === 'fixit' && r.data?.outcome === 'between-runs').map(r => r.data.events[0]);
  assert.deepEqual(buys.map(e => e.data.item), ['copper', 'cat'], 'purchases recorded');
  await page.click('#sound1');
  assert.equal((await state()).sound, false);
  await page.reload();
  assert.equal(await page.textContent('#sound1'), 'Sound: off', 'sound setting kept');
}

// A browser context that captures lab records and collects every page error, console error and failed request.
async function open(browser, options) {
  const context = await browser.newContext(options), page = await context.newPage(), errors = [];
  context.labSent = [];
  await context.route('https://human.adamwhite.work/**', async route => {
    const req = route.request(), cors = { 'access-control-allow-origin': base, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'Content-Type' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const record = JSON.parse(gunzipSync(req.postDataBuffer()).toString()); context.labSent.push(record);
    return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ ok: true, id: record.id }) });
  });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('requestfailed', r => errors.push(`request failed: ${r.url()}`));
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  cur = page;
  return { context, page, errors };
}
const setSave = (page, blob) => page.evaluate(b => { localStorage.setItem('fixit-save', JSON.stringify(b)); localStorage.setItem('hf-lab-send-localhost', '1'); }, blob);

// A small screen, 360 x 640: the map, a goal card, each new job, a cleared card and a failed card.
async function small(browser) {
  const { context, page, errors } = await open(browser, { viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(`${base}/fixit/`);
  await setSave(page, { owned: ['teal', 'cat', 'lights', 'radio', 'charm'], awning: 'teal', sound: false, levels: { ...levelsUpTo(13), 1: 3, 2: 3, 3: 2, 5: 3 } });
  await page.reload();
  await page.screenshot({ path: join(SHOTS, 'small-1-map.png') });
  await page.click('#play');
  let st = await state(page);
  assert.ok(st.level === 14 && st.minTouchPx >= 44, `360 px wide: level 14, smallest touch target ${st.minTouchPx.toFixed(0)} px`);
  assert.equal(st.hearts, 4, 'the horseshoe gives a fourth heart');
  await sleep(400);
  await page.screenshot({ path: join(SHOTS, 'small-2-goal-card.png') });
  await startLevel(page);
  await sleep(300);
  await page.screenshot({ path: join(SHOTS, 'small-3-thread.png') });
  await leave(page);
  for (const kind of ['oil', 'zip', 'spring']) {
    await page.goto(`${base}/fixit/?seed=3&only=${kind}`);
    await page.click('#play'); await sleep(500);
    await page.screenshot({ path: join(SHOTS, `small-job-${kind}.png`) });
    await leave(page);
  }
  await page.goto(`${base}/fixit/?level=1`);
  await page.click('#play'); await startLevel(page);
  await playOut(page, 'small level 1');
  await page.screenshot({ path: join(SHOTS, 'small-4-cleared.png') });
  await page.goto(`${base}/fixit/?level=19`);
  await setSave(page, { levels: levelsUpTo(18), sound: false });
  await page.reload();
  await page.click('#play'); await startLevel(page);
  await until(page, () => window.fixitState().screen === 'end', 'level 19 to fail', 20000);
  await sleep(300);
  await page.screenshot({ path: join(SHOTS, 'small-5-failed.png') });
  assert.deepEqual(errors, [], 'page errors on the small screen');
  await context.close();
}

// A later shift on a phone with reduced motion and the radio on: the hint rules for a familiar job, the regular
// and the silly things on their object, then no more touches until the customers walk off and the hearts run out.
async function lateShift(browser, device) {
  const { context, page, errors } = await open(browser, { ...device, reducedMotion: 'reduce' });
  await page.goto(`${base}/fixit/`);
  const seen = Object.fromEntries(KINDS.map(k => [k, 5]));
  await setSave(page, { shifts: 3, sound: true, regular: 4, seen, unlocked: KINDS, owned: ['teal', 'radio', 'charm', 'cat'], awning: 'teal' });
  await page.goto(`${base}/fixit/?seed=5&ramp=5&day=200&two=0`);
  await page.click('#open');
  let st = await state();
  assert.equal(st.hearts, 4, 'four hearts with the horseshoe');
  await sleep(300);
  assert.equal((await state()).hint, 0, 'no hint at first on a job seen many times');
  await until(page, () => window.fixitState().hint === 0.5, 'a faint hint after 1.5 s without progress', 4000);
  for (let i = 0; i < 12; i++) {
    st = await state();
    if (st.customer.regular) break;
    if (st.phase !== 'work') { await sleep(100); continue; }
    await playJob(page, `late ${st.kind}`);
  }
  st = await state();
  assert.ok(st.customer.regular, 'the regular comes as the sixth customer');
  await until(page, () => window.fixitState().phase === 'work', 'the regular\'s job');
  await sleep(400);
  await page.screenshot({ path: join(SHOTS, 'regular.png') });
  await playJob(page, 'the regular');
  st = await state();
  const lostBefore = st.lost;
  assert.equal(lostBefore, 0);
  // Hands off: every customer from here walks off.
  await until(page, () => window.fixitState().screen === 'end', 'the hearts to run out', 90000);
  st = await state();
  assert.equal(st.lost, 4, 'four customers walked off');
  assert.equal(await page.textContent('#endTitle'), 'Out of hearts', 'end card title for hearts');
  await page.screenshot({ path: join(SHOTS, 'hearts-end.png') });
  await sleep(300);
  const run = context.labSent.filter(r => r.game === 'fixit' && r.kind === 'run' && r.data.outcome === 'closed').at(-1);
  assert.equal(run?.data.summary.why, 'hearts', 'the lab run says the hearts ran out');
  assert.ok(run.data.events.some(e => e.type === 'repair' && e.data.ok === false), 'lost repairs are recorded');
  await page.reload();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('fixit-save')).regular), 5, 'the regular\'s visit is saved');
  assert.deepEqual(errors, [], 'page errors in the late shift');
  await context.close();
}

// Desktop: a wide window, a mouse, no touch. Every job by mouse, and every job by keyboard (hold Space).
async function desktop(browser) {
  const { context, page, errors } = await open(browser, { viewport: { width: 1280, height: 800 } });
  await page.goto(`${base}/fixit/`);
  await setSave(page, { shifts: 2, seen: Object.fromEntries(KINDS.map(k => [k, 1])) });
  for (const how of ['mouse', 'keyboard']) for (const kind of KINDS) {
    await page.goto(`${base}/fixit/?seed=3&only=${kind}`);
    if (how === 'mouse' && kind === 'screw') assert.ok(await page.isVisible('text=hold Space'), 'the menu says how to play with a mouse or keyboard');
    await page.click('#play');
    const st = await state();
    assert.ok(st.minTouchPx >= 44);
    if (kind === 'clock' && how === 'mouse') { await sleep(500); await page.screenshot({ path: join(SHOTS, 'desktop.png') }); }
    await playJob(page, `${kind} by ${how}`, how);
    if (kind === 'sew' && how === 'keyboard') await page.screenshot({ path: join(SHOTS, 'desktop-keyboard-sew.png') });
    await leave(page);
  }
  // Space held through the end of a shift (the key repeating) must not start the next one from the end card.
  await page.goto(`${base}/fixit/?seed=3&only=chain&day=5`);
  await page.click('#play');
  await page.keyboard.down('Space');
  await until(page, () => window.fixitState().screen === 'end', 'the short shift to end with Space held', 15000);
  for (let i = 0; i < 4; i++) { await page.keyboard.down('Space'); await sleep(250); } // Playwright sends these as repeats
  await page.keyboard.up('Space');
  await sleep(300);
  assert.equal((await state()).screen, 'end', 'a held Space does not skip the end card');
  // Pausing with Space held lifts the keyboard's finger.
  await page.goto(`${base}/fixit/?seed=3&only=glue`);
  await page.click('#play');
  await page.keyboard.down('Space');
  await until(page, () => window.fixitState().keyboard && window.fixitState().p > 0, 'the glue job under way by keyboard');
  await page.keyboard.press('p');
  await page.keyboard.up('Space');
  assert.ok(!(await state()).keyboard, 'pause lets go of the keyboard finger');
  await page.click('#resume');
  const p0 = (await state()).p; await sleep(1500);
  assert.ok((await state()).p <= p0 + 0.01, 'nothing carries on after resume without a key held');
  await leave(page);
  assert.deepEqual(errors, [], 'page errors on desktop');
  await context.close();
}

// The daily stall: the same queue for everyone on a date, all jobs, and the day's best kept.
async function dailyStall(browser, device) {
  const { context, page, errors } = await open(browser, { ...device });
  await page.goto(`${base}/fixit/?date=2026-11-20&day=12`);
  await setSave(page, { shifts: 0 });
  await page.reload();
  assert.ok(!(await page.isVisible('#daily')), 'no daily stall on a new save');
  await setSave(page, { levels: levelsUpTo(3) });
  await page.reload();
  assert.ok(await page.isVisible('#daily'), 'the daily stall shows after level 3');
  await setSave(page, { shifts: 1, bank: 10, days: { '2026-11-19': 40, 'junk': 'x' } });
  await page.reload();
  assert.ok(await page.isVisible('#daily'), 'the daily stall shows after the first shift');
  await page.click('#daily');
  const a = await state();
  assert.ok(a.daily && a.today === '2026-11-20' && a.hearts === 3, 'daily stall starts');
  assert.deepEqual(a.days, { '2026-11-19': 40 }, 'old day kept, a bad entry dropped');
  await leave(page);
  await page.click('#daily');
  const b = await state();
  assert.deepEqual([b.customer.kinds, b.queue], [a.customer.kinds, a.queue], 'the same date gives the same queue');
  await sleep(400);
  await page.screenshot({ path: join(SHOTS, 'daily.png') });
  for (let i = 0; i < 20; i++) {
    const st = await state();
    if (st.over || st.screen === 'end') break;
    if (st.phase !== 'work') { await sleep(100); continue; }
    await playJob(page, `daily ${st.kind}`);
  }
  await until(page, () => window.fixitState().screen === 'end', 'daily end card');
  const end = await state();
  assert.equal(end.days['2026-11-20'], end.coins, 'the day\'s best is saved');
  assert.equal(end.bank, 10 + end.coins, 'daily coins are banked');
  assert.match(await page.textContent('#end'), /Daily stall/, 'the end card names the daily stall');
  await page.screenshot({ path: join(SHOTS, 'daily-end.png') });
  await sleep(300);
  const run = context.labSent.filter(r => r.game === 'fixit' && r.kind === 'run' && r.data.outcome === 'closed').at(-1);
  assert.equal(run?.data.summary.daily, '2026-11-20', 'the lab run names the day');
  await page.click('#toMenu');
  assert.match(await page.textContent('#dailyLine'), new RegExp(`best ${end.coins}`), 'the menu shows today\'s best');
  await page.goto(`${base}/fixit/?date=2026-11-21`);
  await page.click('#daily');
  const c = await state();
  assert.notDeepEqual([c.customer.kinds, c.queue], [a.customer.kinds, a.queue], 'another date gives another queue');
  await leave(page);
  assert.deepEqual(errors, [], 'page errors in the daily stall');
  await context.close();
}

const only = process.argv[2];
let failed = 0;
for (const [phone, [engine, device]] of Object.entries(PHONES)) {
  if (only && only !== phone) continue;
  const browser = await engine.launch();
  const { context, page, errors } = await open(browser, { ...device });
  const t0 = Date.now();
  try {
    await run(page, phone);
    assert.deepEqual(errors, [], 'page errors');
    await context.close();
    await lateShift(browser, device);
    await dailyStall(browser, device);
    if (phone === 'chromium') { await small(browser); await desktop(browser); }
    console.log(`ok   fixit on ${phone} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  } catch (e) {
    failed++;
    console.log(`FAIL fixit on ${phone}: ${e.message}`);
    if (errors.length) console.log('     ' + errors.join('\n     '));
    try { console.log('     state: ' + JSON.stringify(await state())); } catch {}
    try { await cur.screenshot({ path: join(SHOTS, `${phone}-FAIL.png`) }); } catch {}
  }
  await browser.close();
}
server.close();
console.log(`screenshots in ${SHOTS}`);
process.exit(failed ? 1 : 0);
