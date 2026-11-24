// Real-input check on two phones: WebKit iPhone 13 and Chromium Pixel 7. It serves experiments/ itself and plays by
// Playwright's mouse, which sends real pointer events to the page's stick; it never steps the sim or sets its state.
//   PLAYWRIGHT=/Users/abdul/code/human-framework/node_modules node experiments/lab/ant-creatures/check.mjs [webkit|chromium]
// Screenshots go to /private/tmp/night-ant-creatures/ (SHOTS to change it).
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SHOTS = process.env.SHOTS || '/private/tmp/night-ant-creatures';
await mkdir(SHOTS, { recursive: true });
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/notes/button.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(''); }
  if (url.pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
  let file = normalize(join(root, decodeURIComponent(url.pathname)));
  if (url.pathname.endsWith('/')) file = join(file, 'index.html');
  try {
    if (!file.startsWith(root + sep)) throw Error('outside experiments');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`, PAGE = `${base}/lab/ant-creatures/`;
const require = createRequire(join(resolve(process.env.PLAYWRIGHT || '/Users/abdul/code/human-framework/node_modules'), 'x.js'));
const { webkit, chromium, devices } = require('playwright');
const PHONES = { webkit: [webkit, devices['iPhone 13']], chromium: [chromium, devices['Pixel 7']] };
const sleep = ms => new Promise(done => setTimeout(done, ms));
const mode = page => page.evaluate(() => window.__ant?.mode);
const report = [];
const note = text => { report.push(text); console.log('     ' + text); };
async function until(page, fn, label, ms = 10000, arg) { try { await page.waitForFunction(fn, arg, { timeout: ms }); } catch { throw Error(`timed out waiting for ${label}`); } }
const frames = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

async function layout(page, where) { // 48 px targets, no text under 14 px, nothing off the side
  const bad = await page.evaluate(() => [...document.querySelectorAll('button')].filter(el => { const r = el.getBoundingClientRect(); return r.width && r.height && (r.width < 48 || r.height < 48); }).map(el => `${el.id || el.textContent} ${el.getBoundingClientRect().width.toFixed(0)}x${el.getBoundingClientRect().height.toFixed(0)}`));
  assert.deepEqual(bad, [], `${where}: every visible button is at least 48 px`);
  const small = await page.evaluate(() => { const out = []; const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
    while ((n = walk.nextNode())) { if (!n.textContent.trim()) continue; const el = n.parentElement, r = el.getBoundingClientRect(); if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') continue; const fs = parseFloat(getComputedStyle(el).fontSize); if (fs < 14) out.push(`${n.textContent.trim().slice(0, 20)} ${fs}px`); }
    return out; });
  assert.deepEqual(small, [], `${where}: no visible text under 14 px`);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${where}: no horizontal overflow`);
  const clipped = await page.evaluate(() => [...document.querySelectorAll('.screen.on button, .screen.on h1, .screen.on h2')].filter(el => { const r = el.getBoundingClientRect(); return r.width && (r.left < 0 || r.right > innerWidth + 1); }).map(el => el.id || el.textContent));
  assert.deepEqual(clipped, [], `${where}: nothing on the card is cut off at the sides`);
}
async function open(browser, opts) {
  const context = await browser.newContext(opts), page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror ' + e));
  page.on('console', m => { if (m.type() === 'error') errors.push('console ' + m.text()); });
  page.on('requestfailed', r => errors.push('requestfailed ' + r.url()));
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  return { context, page, errors };
}
// One look at the meadow, the way a player would decide: the direction for the stick, as a unit vector.
const decide = (page, how) => page.evaluate(how => {
  const A = window.__ant, s = A.s; if (!s) return null; const p = s.player, F = A.me(s); let vx = 0, vy = 0;
  if (how === 'reckless') { let best = null, bd = Infinity; for (const m of s.mobs) { const d = Math.hypot(m.x - p.x, m.y - p.y); if (A.powerOf(m) > F.power && d < bd) { bd = d; best = m; } } if (best) { vx = best.x - p.x; vy = best.y - p.y; } }
  else {
    for (const m of s.mobs) { const pw = A.powerOf(m), dx = m.x - p.x, dy = m.y - p.y, d = Math.hypot(dx, dy) || 1; if (pw > F.power && d < 260) { vx -= dx / d * (260 - d) / 60; vy -= dy / d * (260 - d) / 60; } }
    let best = null, bd = Infinity; for (const m of A.catchable(s)) { const d = Math.hypot(m.x - p.x, m.y - p.y); if (d < bd) { bd = d; best = m; } }
    if (best) { vx += (best.x - p.x) / bd; vy += (best.y - p.y) / bd; } else { vx += (1000 - p.x) / 1000; vy += (1000 - p.y) / 1000; }
  }
  const d = Math.hypot(vx, vy) || 1; return { x: vx / d, y: vy / d };
}, how);
// Hold a finger down and steer like a thumb: press, then move the finger 50 px from where it landed, every 120 ms.
async function steer(page, how, stop, ms, onTick) {
  const vp = page.viewportSize(), ox = vp.width / 2, oy = vp.height * 0.68, t0 = Date.now(); let down = false, maxSquash = 0;
  try {
    while (Date.now() - t0 < ms) {
      const m = await mode(page);
      if (stop(m)) break;
      if (m !== 'play') { if (down) { await page.mouse.up(); down = false; } await sleep(100); if (onTick) await onTick(m); continue; }
      if (!down) { await page.mouse.move(ox, oy); await page.mouse.down(); down = true; }
      const v = await decide(page, how); if (v) await page.mouse.move(ox + v.x * 50, oy + v.y * 50, { steps: 2 });
      const sq = await page.evaluate(() => window.__ant.meRig?.squash || 0); maxSquash = Math.max(maxSquash, sq);
      if (onTick) await onTick(m);
      await sleep(120);
    }
  } finally { if (down) await page.mouse.up(); }
  return { mode: await mode(page), secs: (Date.now() - t0) / 1000, maxSquash };
}

async function phone(name) {
  const [type, device] = PHONES[name], browser = await type.launch();
  const { context, page, errors } = await open(browser, device);
  try {
    await page.goto(PAGE + '?seed=11');
    await until(page, () => window.__ant?.mode === 'menu', 'menu');
    await sleep(600); await layout(page, `${name} menu`);
    await page.screenshot({ path: join(SHOTS, `${name}-1-menu.png`) });
    await page.click('#play');
    await until(page, () => window.__ant.mode === 'play', 'play');
    await until(page, () => !!document.querySelector('.kit-hint.on, [class*="hint"].on'), 'the stick hint for a new player', 6000).then(() => note(`${name}: the stick hint shows to a new player who does not touch`), () => note(`${name}: hint element not found by class (unverified)`));
    await layout(page, `${name} play`);
    // pause freezes the run
    await page.click('#pause'); assert.equal(await mode(page), 'paused', 'the pause button pauses');
    const t1 = await page.evaluate(() => window.__ant.s.t); await sleep(400); assert.equal(await page.evaluate(() => window.__ant.s.t), t1, 'paused time stands still');
    await layout(page, `${name} paused`);
    await page.click('#resume'); assert.equal(await mode(page), 'play');
    // play to the first promotion by real pointer input
    let shot = false;
    const r1 = await steer(page, 'careful', m => m === 'evolve', 150000, async m => {
      if (m === 'dead') await page.click('#goOn');
      if (!shot && m === 'play' && (await page.evaluate(() => window.__ant.s.eaten)) >= 2) { shot = true; await page.screenshot({ path: join(SHOTS, `${name}-2-play.png`) }); }
    });
    assert.equal(r1.mode, 'evolve', `${name}: promoted by stick play (ended in ${r1.mode})`);
    const st = await page.evaluate(() => { const A = window.__ant, s = A.s; return { eaten: s.eaten, mobs: s.mobs.length, rigs: A.rigs.size, ids: s.mobs.every(m => A.rigs.has(m.id)), drawn: A.drawn, me: !!A.meRig }; });
    assert.ok(st.ids && st.rigs === st.mobs && st.me, `a rig for every animal: ${st.rigs} rigs, ${st.mobs} animals`);
    assert.ok(r1.maxSquash > 0, 'the player squashes on a bite');
    note(`${name}: stick play reached the first promotion in ${r1.secs.toFixed(0)} s, ${st.eaten} eaten, ${st.rigs} rigs live, ${st.drawn} creatures drawn in the last frame, bite squash seen ${r1.maxSquash.toFixed(2)}`);
    if (!shot) await page.screenshot({ path: join(SHOTS, `${name}-2-play.png`) });
    await layout(page, `${name} promotion`);
    await page.screenshot({ path: join(SHOTS, `${name}-3-promotion.png`) });
    await page.click('.opt');
    assert.equal(await page.evaluate(() => [window.__ant.mode, window.__ant.level(window.__ant.s)].join()), 'play,2', 'picking an animal goes on at level 2');
    await sleep(500); await page.screenshot({ path: join(SHOTS, `${name}-4-level2.png`) });
    // a reckless thumb until the run is over: three deaths
    let deadShot = false;
    const r2 = await steer(page, 'reckless', m => m === 'over', 150000, async m => {
      if (m === 'dead') { if (!deadShot) { deadShot = true; await layout(page, `${name} dead card`); await page.screenshot({ path: join(SHOTS, `${name}-5-dead.png`) }); } await page.click('#goOn'); }
    });
    assert.equal(r2.mode, 'over', `${name}: three deaths end the run (ended in ${r2.mode})`);
    await sleep(300); await layout(page, `${name} end card`);
    await page.screenshot({ path: join(SHOTS, `${name}-6-end.png`) });
    const best = await page.evaluate(() => JSON.parse(localStorage.getItem('ant-creatures:v1')));
    assert.ok(best.best >= 2 && best.dayBest >= 2, `best level saved on the device (${best.best})`);
    note(`${name}: reckless play ended the run in ${r2.secs.toFixed(0)} s; saved best level ${best.best}`);
    await page.click('#again');
    assert.equal(await page.evaluate(() => [window.__ant.mode, window.__ant.lives, window.__ant.level(window.__ant.s)].join()), 'play,3,1', 'one tap starts a new run');
    // the zoo
    await page.click('#pause'); await page.click('#paused .toMenu'); assert.equal(await mode(page), 'menu');
    await page.click('#toZoo'); await until(page, () => window.__ant.mode === 'zoo', 'zoo');
    await sleep(800); await layout(page, `${name} zoo`);
    await page.screenshot({ path: join(SHOTS, `${name}-7-zoo.png`) });
    const at = await page.evaluate(() => { const A = window.__ant, p = A.pens[0], b = A.penBox(0); return { x: b.x + b.w / 2 + p.x * p.k, y: b.y + 26 + b.h / 2 + p.y * p.k }; });
    await page.mouse.click(at.x, at.y);
    const poked = await page.evaluate(() => ({ n: window.__ant.pens[0].poked, sq: window.__ant.pens[0].c.squash }));
    assert.ok(poked.n === 1 && poked.sq > 0.5, `a tap on the animal pokes it (${JSON.stringify(poked)})`);
    // lead the animal in pen 1: hold a finger on the far side of its pen from it
    const px = () => page.evaluate(() => { const A = window.__ant, p = A.pens[1], b = A.penBox(1), ox = b.x + b.w / 2, oy = b.y + 26 + b.h / 2, g = p.goal || { x: p.x, y: p.y }; return { ax: ox + p.x * p.k, ay: oy + p.y * p.k, gx: ox + g.x * p.k, gy: oy + g.y * p.k, b }; });
    const p0 = await px(), tx = p0.ax > p0.b.x + p0.b.w / 2 ? p0.b.x + p0.b.w * 0.12 : p0.b.x + p0.b.w * 0.88, ty = p0.ay > p0.b.y + 26 + p0.b.h / 2 ? p0.b.y + 40 : p0.b.y + 26 + p0.b.h - 12;
    await page.mouse.move(tx, ty); await page.mouse.down(); await sleep(150);
    const p1 = await px(), d0 = Math.hypot(p1.gx - p1.ax, p1.gy - p1.ay); await sleep(2500);
    const p2 = await px(), d1 = Math.hypot(p2.gx - p2.ax, p2.gy - p2.ay), toward = Math.hypot(p2.gx - tx, p2.gy - ty) < Math.hypot(p1.ax - tx, p1.ay - ty);
    await page.mouse.up();
    assert.ok(d0 > 20 && d1 < d0 * 0.5 && toward, `the animal follows the finger: ${d0.toFixed(0)} px from where it heads, then ${d1.toFixed(0)} px`);
    const lead = { d0 };
    note(`${name}: zoo poke squashes the animal; a held finger brought one from ${lead.d0.toFixed(0)} px to ${d1.toFixed(0)} px of its goal (the finger, kept inside the pen) in 2.5 s`);
    await page.evaluate(() => { document.getElementById('zoo').scrollTop = 1800; }); await sleep(600);
    await page.screenshot({ path: join(SHOTS, `${name}-8-zoo-scrolled.png`) });
    await page.click('#zooSize'); await sleep(600);
    await page.screenshot({ path: join(SHOTS, `${name}-9-zoo-gamesize.png`) });
    await page.click('#zooSize'); await page.click('#zooBack'); assert.equal(await mode(page), 'menu', 'back from the zoo');
    // 40 animals: frame interval and the page's own work per frame
    await page.goto(PAGE + '?bench=40'); await sleep(1500);
    await page.evaluate(() => { window.__ant.bench.gaps.length = 0; window.__ant.bench.cpu.length = 0; }); await sleep(4000);
    const b = await page.evaluate(() => { const B = window.__ant.bench, q = (a, k) => [...a].sort((x, y) => x - y)[Math.floor(a.length * k)]; return { drawn: B.drawn, n: B.gaps.length, gap: B.gaps.reduce((a, b) => a + b, 0) / B.gaps.length, gap95: q(B.gaps, 0.95), cpu: B.cpu.reduce((a, b) => a + b, 0) / B.cpu.length, cpu95: q(B.cpu, 0.95), dpr: devicePixelRatio }; });
    await page.screenshot({ path: join(SHOTS, `${name}-10-bench40.png`) });
    note(`${name}: 40 animals at dpr ${b.dpr}: ${b.n} frames in 4 s, mean frame ${b.gap.toFixed(1)} ms (${(1000 / b.gap).toFixed(0)} fps), p95 ${b.gap95.toFixed(1)} ms; page work per frame mean ${b.cpu.toFixed(1)} ms, p95 ${b.cpu95.toFixed(1)} ms`);
    assert.equal(b.drawn, 40, '40 creatures drawn');
    assert.ok(b.gap < 17.5 && b.cpu95 < 12, `60 fps with 40 animals: mean frame ${b.gap.toFixed(1)} ms, work p95 ${b.cpu95.toFixed(1)} ms`);
    assert.deepEqual(errors, [], `${name}: no page errors, console errors or failed requests`);
    note(`${name}: 0 page errors, 0 console errors, 0 failed requests`);
  } finally { await context.close(); await browser.close(); }
}

async function small() { // the smallest phone, and a desktop with mouse and keys
  const browser = await chromium.launch();
  try {
    const a = await open(browser, { viewport: { width: 360, height: 640 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await a.page.goto(PAGE); await until(a.page, () => window.__ant?.mode === 'menu', 'menu'); await sleep(400);
    await layout(a.page, '360x640 menu'); await a.page.screenshot({ path: join(SHOTS, 'small-menu.png') });
    const fits = await a.page.evaluate(() => { const r = document.querySelector('#menu > div').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; });
    assert.ok(fits, '360x640: the whole menu fits without scrolling');
    await a.page.click('#play'); await sleep(800); await layout(a.page, '360x640 play'); await a.page.screenshot({ path: join(SHOTS, 'small-play.png') });
    await a.page.click('#pause'); await a.page.click('#paused .toMenu'); await a.page.click('#toZoo'); await sleep(600); await layout(a.page, '360x640 zoo');
    await a.page.screenshot({ path: join(SHOTS, 'small-zoo.png') });
    assert.deepEqual(a.errors, [], '360x640: no errors');
    await a.context.close();
    const d = await open(browser, { viewport: { width: 1280, height: 800 } });
    await d.page.goto(PAGE + '?seed=5'); await until(d.page, () => window.__ant?.mode === 'menu', 'menu'); await sleep(300);
    await d.page.screenshot({ path: join(SHOTS, 'desktop-menu.png') });
    await d.page.click('#play'); const x0 = await d.page.evaluate(() => window.__ant.s.player.x);
    await d.page.keyboard.down('ArrowRight'); await sleep(700); await d.page.keyboard.up('ArrowRight');
    const x1 = await d.page.evaluate(() => window.__ant.s.player.x);
    assert.ok(x1 > x0 + 30, `desktop: the arrow key walks (${x0.toFixed(0)} to ${x1.toFixed(0)})`);
    await d.page.keyboard.press('p'); assert.equal(await mode(d.page), 'paused', 'P pauses');
    await d.page.keyboard.press('p'); assert.equal(await mode(d.page), 'play', 'P resumes');
    await d.page.screenshot({ path: join(SHOTS, 'desktop-play.png') });
    await d.page.setViewportSize({ width: 1200, height: 1500 }); await d.page.goto(PAGE + '?sheet=1'); await sleep(800);
    await d.page.screenshot({ path: join(SHOTS, 'sheet.png') });
    assert.deepEqual(d.errors, [], 'desktop: no errors');
    note('360x640 menu, play and zoo fit with 48 px targets and 14 px text; desktop arrow keys walk and P pauses; sheet.png has all 55 species');
  } finally { await browser.close(); }
}

const only = process.argv[2];
let failed = 0;
for (const name of only ? [only] : ['webkit', 'chromium']) {
  try { await phone(name); console.log(`ok   ${name}`); } catch (e) { failed++; console.log(`FAIL ${name}: ${e.message}`); }
}
if (!only) { try { await small(); console.log('ok   small phone and desktop'); } catch (e) { failed++; console.log(`FAIL small/desktop: ${e.message}`); } }
server.close();
console.log(failed ? `${failed} part(s) FAILED; screenshots in ${SHOTS}` : `all parts pass; screenshots in ${SHOTS}`);
process.exit(failed ? 1 : 0);
