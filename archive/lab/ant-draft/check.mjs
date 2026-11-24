// Phone check for Ant Draft: node experiments/lab/ant-draft/check.mjs [webkit|chromium]
// Serves experiments/ on a free port and plays with touch pointer events on WebKit (iPhone 13) and Chromium (Pixel 7).
// Run A (?waves=1): menu, the beginner hint, steer the swarm through a wave, the win card.
// Run B (?waves=3&hp=8): clear wave 1, take a card by a real tap, leave the flag in a corner so the weak queen falls,
// then the loss card must show the held card and Again must start wave 1 with no menu between.
// Fails on any page error or console error. Screenshots go to $SHOTS (default /private/tmp/night-ant-draft).
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../..');
const SHOTS = process.env.SHOTS || '/private/tmp/night-ant-draft';
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
const state = page => page.evaluate(() => window.antDraftState());
async function until(page, fn, what, ms = 15000, arg) { try { await page.waitForFunction(fn, arg, { timeout: ms }); } catch { throw new Error(`timed out waiting for: ${what} (state ${JSON.stringify(await state(page))})`); } }

// Steer as a thumb would: touch down, then move the finger so the flag sits on the most dangerous enemy, until `stop` holds.
// With `corner`, hold the finger in the top left corner instead (a player who is not defending).
function steer(page, { ms, corner = false, untilPhase = true }) {
  return page.evaluate(async ({ ms, corner, untilPhase }) => {
    const el = document.getElementById('c'), t0 = performance.now(); let down = false, last = { x: 60, y: 120 }, frames = 0, slow = 0, prev = t0, maxAimError = 0;
    const send = (type, p) => el.dispatchEvent(new PointerEvent('pointer' + type, { pointerId: 5, pointerType: 'touch', isPrimary: true, clientX: p.x, clientY: p.y, pressure: type === 'up' ? 0 : 0.5, bubbles: true, cancelable: true }));
    while (performance.now() - t0 < ms) {
      const st = window.antDraftState();
      if (untilPhase && (st.mode !== 'play' || st.phase !== 'fight')) break;
      const p = corner || !st.aim ? { x: 40, y: 90 + st.lift } : { x: st.aim.x, y: st.aim.y + st.lift };
      if (!down) { send('down', p); down = true; } else if (frames % 4 === 0) send('move', p);
      if (!corner && st.aim && frames % 4 === 0) maxAimError = Math.max(maxAimError, Math.abs(window.antDraftState().rally.x - p.x));
      last = p; frames++;
      await new Promise(r => requestAnimationFrame(r));
      const now = performance.now(); if (now - prev > 50) slow++; prev = now;
    }
    if (down) send('up', last);
    return { frames, slow, maxAimError, ms: performance.now() - t0 };
  }, { ms, corner, untilPhase });
}

async function runPhone(name) {
  const [type, device] = PHONES[name], browser = await type.launch(), errors = [], out = {};
  try {
    const context = await browser.newContext({ ...device });
    const open = async query => { const page = await context.newPage(); page.on('pageerror', e => errors.push(`pageerror: ${e.message}`)); page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); }); await page.goto(`${base}/lab/ant-draft/${query}`); await until(page, () => !!window.antDraftState, 'the page to load'); await page.bringToFront(); await page.evaluate(() => { window.__reviewPainted = false; requestAnimationFrame(() => requestAnimationFrame(() => { window.__reviewPainted = true; })); }); await page.waitForFunction(() => window.__reviewPainted, null, { timeout: 10000 }); return page; };

    // ---- Run A: menu, hint, a won run ----
    let page = await open('?waves=1&seed=11');
    assert.equal((await state(page)).mode, 'menu');
    const menu = await page.evaluate(() => { const b = document.getElementById('play').getBoundingClientRect(), words = document.querySelector('#menu .sub').textContent.trim().split(/\s+/).length; return { w: b.width, h: b.height, words, overflow: document.documentElement.scrollWidth > innerWidth, title: document.querySelector('#menu h1').textContent }; });
    assert.ok(menu.h >= 48 && menu.w >= 48, 'Play is a big target'); assert.ok(menu.words <= 8, 'one short line'); assert.ok(!menu.overflow, 'no sideways scroll'); assert.equal(menu.title, 'Ant Draft');
    await page.screenshot({ path: join(SHOTS, `${name}-1-menu.png`) });
    await page.tap('#play');
    await until(page, () => window.antDraftState().mode === 'play' && window.antDraftState().phase === 'fight', 'play to start');
    await until(page, () => window.antDraftState().hint === true, 'the beginner hint after 3 s without a touch', 8000);
    await page.screenshot({ path: join(SHOTS, `${name}-2-hint.png`) });
    const s1 = await steer(page, { ms: 5000, untilPhase: false });
    const mid = await state(page);
    assert.equal(mid.hint, false, 'the hint leaves on the first touch');
    assert.ok(s1.maxAimError < 0.01, `flag follows each dispatched finger position: error ${s1.maxAimError}`);
    out.frames = `${s1.frames} frames in ${Math.round(s1.ms)} ms, ${s1.slow} over 50 ms`;
    assert.ok(s1.frames / (s1.ms / 1000) > Number(process.env.MIN_FPS || 25), `frame rate while fighting: ${out.frames}`);
    await page.screenshot({ path: join(SHOTS, `${name}-3-fight.png`) });
    await steer(page, { ms: 60000 });
    await until(page, () => window.antDraftState().mode === 'end', 'the win card');
    const won = await state(page);
    assert.equal(won.phase, 'won'); assert.ok(won.kills >= 6, 'six aphids eaten');
    assert.equal(await page.textContent('#endTitle'), 'The queen is safe!');
    await page.screenshot({ path: join(SHOTS, `${name}-4-win.png`) });
    await page.close();

    // ---- Run B: draft a card, lose, see the card, retry at once ----
    page = await open('?waves=3&hp=8&seed=5');
    await page.tap('#play');
    await until(page, () => window.antDraftState().phase === 'fight', 'play to start');
    await steer(page, { ms: 60000 });
    await until(page, () => window.antDraftState().mode === 'draft', 'the draft after wave 1');
    await sleep(700);
    const draft = await page.evaluate(() => [...document.querySelectorAll('.offer')].map(b => { const r = b.getBoundingClientRect(), sp = b.querySelector('span'); return { id: b.dataset.card, w: r.width, h: r.height, left: r.left, right: r.right, words: sp.textContent.trim().split(/\s+/).length, font: parseFloat(getComputedStyle(sp).fontSize), icon: b.querySelector('canvas').getBoundingClientRect().height, iconFirst: b.firstElementChild.tagName === 'CANVAS' }; }));
    assert.equal(draft.length, 3, 'three cards');
    assert.equal(new Set(draft.map(d => d.id)).size, 3, 'three different cards');
    for (const d of draft) { assert.ok(d.words <= 5, `${d.id}: at most five words`); assert.ok(d.font >= 14, `${d.id}: text at least 14 px`); assert.ok(d.w >= 48 && d.h >= 48, `${d.id}: big target`); assert.ok(d.iconFirst && d.icon >= 56, `${d.id}: icon first`); assert.ok(d.left >= 0 && d.right <= device.viewport.width + 0.5, `${d.id}: inside the screen`); }
    await page.screenshot({ path: join(SHOTS, `${name}-5-draft.png`) });
    await page.tap('.offer:nth-child(2)');
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await sleep(500); assert.equal((await state(page)).paused, true, 'leaving during card animation pauses the next wave');
    await page.tap('#resume');
    await until(page, () => window.antDraftState().mode === 'play' && window.antDraftState().wave === 1, 'wave 2 after the pick');
    const picked = await state(page);
    assert.deepEqual(picked.picks, [draft[1].id]); assert.equal(picked.cards[draft[1].id], 1);
    await steer(page, { ms: 90000, corner: true });
    await until(page, () => window.antDraftState().mode === 'end', 'the loss card');
    const lost = await state(page);
    assert.equal(lost.phase, 'lost');
    assert.equal(await page.textContent('#endTitle'), 'The nest fell');
    const chips = await page.evaluate(() => [...document.querySelectorAll('#held .chip')].map(c => ({ id: c.dataset.card, on: c.querySelectorAll('.pips i.on').length, w: c.getBoundingClientRect().width })));
    assert.deepEqual(chips.map(c => c.id), [draft[1].id], 'the loss card shows the card that was held'); assert.equal(chips[0].on, 1);
    const again = await page.evaluate(() => { const r = document.getElementById('again').getBoundingClientRect(); return { h: r.height, bottom: r.bottom, vh: innerHeight }; });
    assert.ok(again.h >= 48 && again.bottom <= again.vh, 'Again is on screen without scrolling');
    await page.screenshot({ path: join(SHOTS, `${name}-6-loss.png`) });
    await page.tap('#again');
    await sleep(250);
    const re = await state(page);
    assert.equal(re.mode, 'play'); assert.equal(re.phase, 'fight'); assert.equal(re.wave, 0); assert.deepEqual(re.picks, []); assert.equal(re.runs, 2, "both finished runs were saved");
    assert.equal(await page.evaluate(() => document.querySelectorAll('.screen.on').length), 0, 'no card between a loss and the next run');
    // Pause by the button, and resume.
    await page.tap('#pause'); assert.equal((await state(page)).paused, true); const t1 = (await state(page)).t; await sleep(300); assert.equal((await state(page)).t, t1, 'time stands still while paused');
    await page.tap('#resume'); await sleep(200); assert.ok((await state(page)).t > t1, 'time runs again');
    await page.close();

    // ---- Run C (tester note #207): first Play asks about the tutorial, the tutorial plays to the end, then level 1, the level list, numbers and bars ----
    await context.clearCookies(); const fresh = await browser.newContext({ ...device }); page = await fresh.newPage();
    page.on('pageerror', e => errors.push(`pageerror: ${e.message}`)); page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    await page.goto(`${base}/lab/ant-draft/?seed=3`); await until(page, () => !!window.antDraftState, 'load');
    await page.tap('#play'); await until(page, () => window.antDraftState().mode === 'ask', 'the first-time question');
    await page.screenshot({ path: join(SHOTS, `${name}-7-ask.png`) });
    await page.tap('#askYes'); await until(page, () => window.antDraftState().cur === 0 && window.antDraftState().phase === 'fight', 'the tutorial');
    await sleep(900); assert.match((await state(page)).tip, /Drag anywhere/); await page.screenshot({ path: join(SHOTS, `${name}-8-tutorial.png`) });
    for (let i = 0; i < 2; i++) { await steer(page, { ms: 60000 }); await until(page, () => window.antDraftState().mode === 'draft', `tutorial draft ${i + 1}`); await sleep(500); await page.tap('.offer:nth-child(1)'); await until(page, n => window.antDraftState().mode === 'play' && window.antDraftState().wave === n, 'next step', 5000, i + 1); }
    await steer(page, { ms: 60000 }); await until(page, () => window.antDraftState().mode === 'end', 'the end of the tutorial');
    assert.equal(await page.textContent('#endTitle'), 'You are ready!'); assert.ok((await state(page)).hitsShown > 5, 'damage numbers were shown');
    await page.screenshot({ path: join(SHOTS, `${name}-9-ready.png`) });
    await page.tap('#again'); await until(page, () => window.antDraftState().cur === 1, 'level 1 after the tutorial');
    await steer(page, { ms: 6000, untilPhase: false }); await page.screenshot({ path: join(SHOTS, `${name}-10-level.png`) });
    const lvl = await state(page); assert.ok(lvl.peak > 0 && lvl.swarm <= lvl.peak, 'the swarm bar has a full mark');
    for (let w = 0; w < 3; w++) { await steer(page, { ms: 60000 }); if (w < 2) { await until(page, () => window.antDraftState().mode === 'draft', 'level draft'); await sleep(500); await page.tap('.offer:nth-child(2)'); await until(page, n => window.antDraftState().mode === 'play' && window.antDraftState().wave === n, 'next wave', 5000, w + 1); } }
    await until(page, () => window.antDraftState().mode === 'end', 'level 1 cleared'); assert.equal(await page.textContent('#again'), 'Next level');
    await page.screenshot({ path: join(SHOTS, `${name}-11-cleared.png`) });
    await page.tap('#toMenu'); await page.tap('#toLevels'); await sleep(200);
    assert.deepEqual(await page.evaluate(() => [document.querySelectorAll('.lv').length, document.querySelectorAll('.lv:not(:disabled)').length]), [50, 2], 'fifty levels, two open');
    await page.screenshot({ path: join(SHOTS, `${name}-12-levels.png`) });
    await page.reload(); await until(page, () => !!window.antDraftState, 'reload'); assert.equal((await state(page)).open, 2, 'the open level is kept'); assert.equal(await page.textContent('#play'), 'Level 2');
    await page.close(); await fresh.close();
    assert.deepEqual(errors, [], 'no page or console errors');
    console.log(`ok   ${name}: menu, hint, win, draft (${draft.map(d => d.id).join(' ')}), loss shows ${chips[0].id}, instant retry, pause; ${out.frames}`);
  } finally { await browser.close(); }
}

const which = process.argv[2] ? [process.argv[2]] : ['webkit', 'chromium'];
let bad = 0;
for (const name of which) { try { await runPhone(name); } catch (e) { bad++; console.log(`FAIL ${name}: ${e.message}`); } }
server.close();
console.log(bad ? `${bad} phone(s) FAILED` : `all phones passed; screenshots in ${SHOTS}`);
process.exit(bad ? 1 : 0);
