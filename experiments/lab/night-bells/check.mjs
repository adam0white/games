// Phone acceptance checks. PLAYWRIGHT=<directory containing playwright> node check.mjs [webkit|chromium]
// Level 1 uses a page.tap smoke and synthetic touch PointerEvents in real animation time.
// Later levels explicitly use ?test=1 time advancement. No test here substitutes for a person on a phone.
// CHECK_FUNCTIONAL_ONLY=1 skips image capture for diagnosis; the default run requires every screenshot.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { answerLab, allowLocalSend, assertNotice, assertRun, assertOffSendsNothing } from '../../kit/check/lab-record.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const repo = resolve(root, '..');
const SHOTS = process.env.SHOTS || '/private/tmp/night-r3-review/bells/check';
const functionalOnly = process.env.CHECK_FUNCTIONAL_ONLY === '1';
await mkdir(SHOTS, { recursive: true });
const notesFile = join(repo, 'workers/feedback/public/notes/button.js');
const notesSource = await readFile(notesFile, 'utf8');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = path === '/notes/button.js' ? notesFile : resolve(root, '.' + path);
    if (file !== notesFile && file !== root && !file.startsWith(root + sep)) throw new Error('outside root');
    if (path.endsWith('/')) file = join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('not found');
  }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
const require = createRequire(join(resolve(process.env.PLAYWRIGHT || '/Users/abdul/code/human-framework/node_modules'), 'x.js'));
const { webkit, chromium, devices } = require('playwright');
const phones = { webkit: [webkit, devices['iPhone 13']], chromium: [chromium, devices['Pixel 7']] };
const delay = ms => new Promise(done => setTimeout(done, ms));
const snapshot = page => page.evaluate(() => window.bellsState());
const rules = st => st.s || st;
async function waitFor(page, fn, label, timeout = 15000) {
  try { await page.waitForFunction(fn, null, { timeout }); }
  catch { throw new Error(`timed out: ${label}`); }
}
async function menu(page) {
  await page.bringToFront();
  await waitFor(page, () => window.bellsState?.().screen === 'menu', 'menu');
  // Headless WebKit can open a visible page without scheduling a canvas frame.
  if (page.context().browser()?.browserType().name() === 'webkit') {
    const viewport = page.viewportSize();
    await page.setViewportSize({ ...viewport, width: viewport.width + 1 });
    await page.setViewportSize(viewport);
  }
  // The hook is installed before the first canvas paint. Let that paint reach the compositor.
  await page.evaluate(() => Promise.race([
    new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))),
    new Promise((_, reject) => setTimeout(() => reject(new Error('first canvas paint did not arrive')), 5000)),
  ]));
}
async function shot(page, name) {
  if (functionalOnly) return;
  await page.bringToFront();
  await page.screenshot({ path: join(SHOTS, name + '.png'), scale: 'css', animations: 'disabled', caret: 'hide', timeout: 45000 });
}

async function rotate(page, viewport) {
  await page.setViewportSize(viewport);
  await page.waitForFunction(({ width, height }) => {
    const s = window.bellsState();
    return s.W === width && s.H === height;
  }, viewport);
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
}

// Canvas pages can miss Playwright's consecutive-frame stability wait on a busy WebKit host.
// Check actual visibility, bounds, enabled state and hit-testing before dispatching the browser tap.
async function touch(page, selector) {
  const target = await page.locator(selector).evaluate(el => {
    const r = el.getBoundingClientRect(), style = getComputedStyle(el);
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { visible: style.display !== 'none' && style.visibility !== 'hidden', enabled: !el.disabled,
      x:r.x,y:r.y,w:r.width,h:r.height,W:innerWidth,H:innerHeight,hit:!!hit && el.contains(hit) };
  });
  assert.ok(target.visible && target.enabled, `${selector}: visible enabled control`);
  assert.ok(target.w >= 47.9 && target.h >= 47.9, `${selector}: at least 48px`);
  assert.ok(target.x >= -1 && target.y >= -1 && target.x + target.w <= target.W + 1 && target.y + target.h <= target.H + 1, `${selector}: fits viewport`);
  assert.ok(target.hit, `${selector}: receives touch at its centre`);
  await page.tap(selector, { force:true });
  // Mobile browsers retain :active briefly after touch-up; measure the resting target and capture it after release.
  await page.waitForFunction(selector => !document.querySelector(selector)?.matches(':active'), selector, { timeout:2000 });
}

async function geometry(page, label) {
  const g = await page.evaluate(() => {
    const visible = [...document.querySelectorAll('button')].filter(el => {
      const r = el.getBoundingClientRect(), c = getComputedStyle(el);
      return r.width && r.height && c.visibility !== 'hidden' && c.display !== 'none';
    });
    return {
      width: innerWidth, height: innerHeight,
      scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight,
      targets: visible.map(el => { const r = el.getBoundingClientRect(); return { id: el.id || el.getAttribute('aria-label') || el.textContent, x: r.x, y: r.y, w: r.width, h: r.height }; }),
    };
  });
  assert.ok(g.scrollWidth <= g.width + 1 && g.scrollHeight <= g.height + 1, `${label}: no page overflow (${g.scrollWidth}×${g.scrollHeight}, viewport ${g.width}×${g.height})`);
  for (const b of g.targets) {
    assert.ok(b.w >= 47.9 && b.h >= 47.9, `${label}: ${b.id} target is ${b.w}×${b.h}, minimum 48px`);
    assert.ok(b.x >= -1 && b.y >= -1 && b.x + b.w <= g.width + 1 && b.y + b.h <= g.height + 1, `${label}: ${b.id} fits viewport`);
  }
  assert.ok(g.targets.length > 0, `${label}: visible controls exist`);
  return Math.min(...g.targets.map(b => Math.min(b.w, b.h)));
}

// Normal browser touchscreen taps verify the pad and moving bell paths. Browser RPC latency is unsuitable for
// a rhythm controller, so the remainder uses synthetic touch PointerEvents inside real rAF callbacks.
// A single thumb observes the public drawing state. It never changes rules, state, or time.
async function realThumb(page, name) {
  const started = performance.now();
  let smokeTaps = 0, smokeHit = false, lastSmoke = -Infinity;
  for (let attempt = 0; attempt < 3 && !smokeHit; attempt++) {
    if (performance.now() - lastSmoke < 150) await delay(150 - (performance.now() - lastSmoke));
    const before = rules(await snapshot(page));
    await waitFor(page, () => {
      const v = window.bellsState().views[0], el = document.getElementById('pad0'), r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2), phase = v.phase % Math.PI;
      return v.ready && phase > Math.PI / 2 && phase < Math.PI - .5 * v.window * 2 * Math.PI / v.period && el.contains(hit);
    }, 'normal touchscreen strike window');
    // Bounds were checked above; the in-page wait also checks hit-testing. No extra RPC before this timed tap.
    await page.tap('#pad0', { force:true }); lastSmoke = performance.now(); smokeTaps++;
    await page.waitForFunction(before => { const st = window.bellsState(), s = st.s || st; return s.hits + s.misses > before; }, before.hits + before.misses, { timeout: 2000 });
    smokeHit = rules(await snapshot(page)).hits > before.hits;
  }
  assert.ok(smokeHit, 'normal page.tap produces a scored hit');
  let bellHit = false, bellTaps = 0;
  for (; bellTaps < 3 && !bellHit; bellTaps++) {
    const before = rules(await snapshot(page));
    const position = await page.waitForFunction(count => {
      const s = window.bellsState(), v = s.views[0], p = s.positions[0];
      const phase = v.phase % Math.PI;
      if (s.hits === count && v.ready && phase > Math.PI / 2 && phase < Math.PI - .5 * v.window * 2 * Math.PI / v.period && document.elementFromPoint(p.x, p.y).id === 'c') return p;
    }, before.hits);
    const { x, y } = await position.jsonValue();
    await page.touchscreen.tap(x, y);
    await page.waitForFunction(before => {
      const { hits, misses } = window.bellsState();
      return hits + misses > before;
    }, before.hits + before.misses, { timeout: 2000 });
    bellHit = rules(await snapshot(page)).hits > before.hits;
  }
  assert.ok(bellHit, 'normal touchscreen tap on the moving bell produces a scored hit');
  const result = await page.evaluate(async () => {
    const started = performance.now(); let lastTap = performance.now(), taps = 0, gap = Infinity, awaiting = null;
    while (performance.now() - started < 59000) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      const st = window.bellsState(), s = st.s || st, now = performance.now();
      if (st.screen === 'end') return { won: s.won, screen: st.screen, taps, minGapMs: gap, hits: s.hits, misses: s.misses, score: s.score, gameSeconds: s.t };
      if (st.screen !== 'play') throw new Error('real-time controller left play');
      if (awaiting !== null && s.hits + s.misses <= awaiting) continue;
      awaiting = null;
      const i = st.views.findIndex(v => v.ready);
      if (i < 0 || now - lastTap < 150) continue;
      const el = document.getElementById('pad' + i), r = el.getBoundingClientRect();
      const options = { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, bubbles: true, cancelable: true };
      awaiting = s.hits + s.misses;
      el.dispatchEvent(new PointerEvent('pointerdown', { ...options, pressure: .5, buttons: 1 }));
      el.dispatchEvent(new PointerEvent('pointerup', { ...options, pressure: 0, buttons: 0 }));
      gap = Math.min(gap, now - lastTap); lastTap = now; taps++;
    }
    const st = window.bellsState(), s = st.s || st;
    return { won: false, screen: st.screen, taps, hits: s.hits, misses: s.misses, score: s.score, gameSeconds: s.t };
  });
  assert.ok(result.won, `${name}: real-time pointer controller wins within a minute: ${JSON.stringify(result)}`);
  assert.ok(result.minGapMs >= 150, 'synthetic thumb leaves at least 150ms between strikes');
  return { ...result, seconds: (performance.now() - started) / 1000, smokeTaps, bellTaps, input: 'synthetic browser touch PointerEvents after native strikes on pad and bell' };
}

// Only the explicit test build exposes advancement. Synthetic pad events exercise the actual input
// queue and finish/save UI. This is accelerated validation, not evidence of real-time playability.
async function acceleratedWin(page, level) {
  const before = performance.now();
  const result = await page.evaluate(() => {
    let taps = 0, last = -Infinity, previousSwingHarmony = false, harmoniesOffApex = 0;
    for (let n = 0; n < 72000; n++) {
      const st = window.bellsState(), s = st.s || st;
      if (s.events.some(e => e.type === 'harmony')) {
        const atApex = s.bells.every(b => {
          if (b.free) return true; // a bell with no rope is not rung and not part of a harmony
          const distance = Math.abs(b.phase - Math.round(b.phase / Math.PI) * Math.PI);
          return distance / b.omega <= s.window + 1e-10;
        });
        if (!atApex) harmoniesOffApex++;
        if (s.bells.some(b => s.t - b.lastGood >= .65)) previousSwingHarmony = true;
      }
      if (st.screen === 'end') return { won: s.won, taps, simulationSeconds: s.t, hits: s.hits, misses: s.misses, harmony: s.harmony, previousSwingHarmony, harmoniesOffApex };
      const ready = st.views.map((v, i) => ({ ...v, i })).filter(v => v.ready).sort((a, b) => a.energy - b.energy);
      if (ready.length && s.t - last >= .15) {
        const el = document.getElementById('pad' + ready[0].i), r = el.getBoundingClientRect();
        const options = { pointerId: 9, pointerType: 'touch', isPrimary: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, bubbles: true, cancelable: true };
        el.dispatchEvent(new PointerEvent('pointerdown', { ...options, pressure: .5, buttons: 1 }));
        el.dispatchEvent(new PointerEvent('pointerup', { ...options, pressure: 0, buttons: 0 }));
        last = s.t; taps++;
      }
      window.bellsAdvance(1 / 120);
    }
    return { won: false, taps, stalled: true };
  });
  assert.ok(result.won, `accelerated level ${level} wins: ${JSON.stringify(result)}`);
  assert.equal(result.harmoniesOffApex, 0, `level ${level} harmony requires a real apex overlap`);
  if (level === 7) assert.ok(result.previousSwingHarmony, 'level 7 accepts a prior-swing strike at a three-bell overlap');
  return { level, ...result, wallSeconds: (performance.now() - before) / 1000 };
}

async function harmonyGate(page) {
  const cue = page.locator('#objective');
  assert.match(await cue.textContent(), /each bell.*swings line up/, 'level 2 explains how to achieve harmony');
  assert.ok(await cue.isVisible(), 'level 2 shows the unmet harmony goal');
  const result = await page.evaluate(async () => {
    for (let n = 0; n < 4800; n++) {
      const st = window.bellsState();
      if (st.screen !== 'play' || st.lights > st.target) break;
      if (st.views[0].ready) window.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }));
      window.bellsAdvance(1 / 120);
    }
    // Observe the text sent to the canvas after accumulating excess lights.
    const paint = CanvasRenderingContext2D.prototype.fillText;
    const counts = [];
    CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
      if (/^\d+ \/ \d+$/.test(text)) counts.push(text);
      return paint.call(this, text, ...args);
    };
    try {
      await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
      return { st: window.bellsState(), counts };
    } finally { CanvasRenderingContext2D.prototype.fillText = paint; }
  });
  assert.equal(result.st.screen, 'play', 'lights alone cannot finish a multi-bell level');
  assert.equal(result.st.harmony, 0, 'ringing one bell cannot produce harmony');
  assert.ok(result.st.lights > result.st.target, 'one bell can earn more lights than the display target');
  assert.ok(result.counts.length && result.counts.every(text => text === `${result.st.target} / ${result.st.target}`), 'painted progress caps at its target');
  assert.ok(await cue.isVisible(), 'the unmet harmony cue stays visible with a full progress bar');
}

function validSave(saved) {
  assert.equal(saved.v, 1, 'save format version');
  assert.equal(saved.stars.length, 8, 'eight campaign star slots');
  assert.ok(saved.stars.every(n => Number.isInteger(n) && n >= 0 && n <= 3), 'valid campaign stars');
  assert.ok(Number.isFinite(saved.best) && saved.best >= 0, 'finite nonnegative endless best');
  assert.equal(typeof saved.sound, 'boolean', 'boolean sound preference');
  assert.ok(Number.isFinite(saved.tries) && saved.tries >= 0, 'valid tries');
  assert.ok(['amber', 'moon', 'rose'].includes(saved.look), 'known palette');
}

async function run(name) {
  assert.ok(phones[name], `unknown browser ${name}`);
  const [type, device] = phones[name];
  const browser = await type.launch();
  const errors = [], requests = [], contexts = [];
  const context = async (init, route = '') => {
    const ctx = await browser.newContext({ ...device }); contexts.push(ctx);
    await ctx.route('**/*', async r => {
      const req = r.request(), url = new URL(req.url());
      requests.push({ url: req.url(), method: req.method() });
      if (url.origin !== base) { errors.push(`outbound request: ${req.method()} ${req.url()}`); await r.abort(); }
      else await r.continue();
    });
    ctx.lab = await answerLab(ctx, base); // registered after the catch-all, so it takes lab requests first; no check reaches the real endpoint
    if (init) await ctx.addInitScript(init);
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(`console: ${msg.text()}`); });
    page.on('requestfailed', req => errors.push(`requestfailed: ${req.url()} ${req.failure()?.errorText}`));
    page.on('response', res => { if (res.status() >= 400) errors.push(`HTTP ${res.status()}: ${res.url()}`); });
    await page.goto(`${base}/lab/night-bells/${route}`);
    await menu(page);
    return page;
  };
  try {
    const page = await context(null, '?look=amber&test=1');
    const notes = await page.request.get(`${base}/notes/button.js`);
    assert.equal(await notes.text(), notesSource, 'server uses the actual shared notes button');
    assert.equal(await page.locator('#levels button').count(), 8, 'eight campaign levels');
    assert.equal(await page.locator('#levels button:not([disabled])').count(), 1, 'fresh campaign unlocks level 1 only');
    let minTouch = await geometry(page, 'menu');
    assert.ok((await snapshot(page)).minTouchPx >= 48, 'reported minimum touch target is at least 48px');
    assert.equal((await snapshot(page)).saved.look, 'amber', 'query selects amber');
    for (const look of ['amber', 'moon', 'rose']) {
      await touch(page, `#looks button[data-look='${look}']`);
      assert.equal((await snapshot(page)).saved.look, look, `palette control selects ${look}`);
      await geometry(page, `${look} menu`);
      await shot(page, `${name}-1-menu-${look}`);
    }
    await touch(page, "#looks button[data-look='amber']");

    const portrait = device.viewport, landscape = { width: portrait.height, height: portrait.width };
    await rotate(page, landscape);
    minTouch = Math.min(minTouch, await geometry(page, 'landscape menu'));
    const card = await page.locator('#menu .card').boundingBox();
    assert.ok((await snapshot(page)).gallery.right < card.x, 'landscape menu art clears the controls');
    await shot(page, `${name}-0-landscape-menu`);
    await touch(page, '#endless');
    await delay(1800);
    assert.equal(await page.locator('.kit-hint.on').count(), 0, 'endless never shows the first campaign hint');
    await page.touchscreen.tap(landscape.width / 2, (await snapshot(page)).pads[1].y);
    await touch(page, '#pause'); await touch(page, '#quit');
    await touch(page, '#play');
    await waitFor(page, () => document.querySelector('.kit-hint.on'), 'first campaign hint after trying endless');
    let st = await snapshot(page);
    assert.ok(st.H - st.hintBottom >= 5, 'landscape teaching hand fits with its finger lifted');
    assert.ok(st.gallery.ringerX - 14 >= st.gallery.left, 'landscape ringer stays on the gallery');
    assert.ok(st.positions.every(p => p.lowest <= st.gallery.y), 'landscape bells clear the gallery at the bottom of their swing');
    minTouch = Math.min(minTouch, await geometry(page, 'landscape play'));
    const p = st.pads[0];
    await page.touchscreen.tap(p.x + 130, p.y - 165);
    await page.waitForFunction(t => window.bellsState().t > t + .15, st.t);
    st = await snapshot(page);
    assert.equal(st.hits + st.misses, 0, 'open space beside a moving bell does not count as an attempt');
    assert.equal(await page.locator('.kit-hint.on').count(), 1, 'open-space tap does not dismiss first-time help');
    await shot(page, `${name}-0-landscape-hint`);
    await rotate(page, portrait);
    await page.reload(); await menu(page);
    assert.equal(await page.locator('#levels button:not([disabled])').count(), 1, 'mid-level reload preserves the unlock boundary');

    const firstStarted = performance.now();
    await touch(page, '#play');
    st = await snapshot(page);
    assert.equal(st.screen, 'play', 'Play starts play'); assert.equal(rules(st).level, 1, 'Play starts level 1');
    assert.equal(rules(st).endless, false, 'Play starts campaign');
    assert.equal(st.views.length, 1, 'first level has one bell');
    minTouch = Math.min(minTouch, await geometry(page, 'play'));
    await delay(3300);
    st = await snapshot(page);
    assert.equal(rules(st).hits, 0, 'idle play generates no hits');
    assert.equal(rules(st).misses, 0, 'idle play generates no misses');
    assert.equal(await page.locator('.kit-hint.on').count(), 1, 'first-time hint returns after reloading before the first attempt');
    await shot(page, `${name}-2-idle-hint`);
    const realtime = await realThumb(page, name);
    realtime.totalSeconds = (performance.now() - firstStarted) / 1000;
    assert.ok(realtime.totalSeconds < 60, `first campaign level completes within a minute including idle help (${realtime.totalSeconds.toFixed(2)}s)`);
    await shot(page, `${name}-3-victory`);
    st = await snapshot(page); validSave(st.saved);
    assert.ok(st.saved.stars[0] >= 1, 'first victory saves campaign stars');
    assert.equal(await page.locator('.kit-hint.on').count(), 0, 'real input dismisses hint');
    await geometry(page, 'victory');
    console.log(`${name}: REAL-TIME POINTER level 1 ${JSON.stringify(realtime)}; minimum control ${minTouch.toFixed(1)}px`);

    await touch(page, '#next');
    st = await snapshot(page); assert.equal(rules(st).level, 2, 'Next opens level 2');
    await touch(page, '#pause'); st = await snapshot(page); assert.equal(st.screen, 'paused', 'Pause opens card');
    const pausedRules = rules(st);
    await delay(350);
    const frozen = rules(await snapshot(page));
    assert.equal(frozen.t, pausedRules.t, 'paused simulation time freezes');
    assert.deepEqual(frozen.bells, pausedRules.bells, 'paused bell state freezes');
    await geometry(page, 'pause');
    await touch(page, '#resume'); await delay(180);
    assert.ok(rules(await snapshot(page)).t > pausedRules.t, 'Resume advances time');
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    assert.equal((await snapshot(page)).screen, 'paused', 'window blur pauses');
    await touch(page, '#quit'); await menu(page);
    assert.equal(await page.locator('#levels button:not([disabled])').count(), 2, 'victory unlocks level 2 only');
    const save1 = (await snapshot(page)).saved;
    await page.reload(); await menu(page);
    assert.deepEqual((await snapshot(page)).saved, save1, 'campaign save survives menu and reload');

    // Returned snapshots are copies. Consumers cannot alter the running rules or save.
    await page.evaluate(() => { const st = window.bellsState(); st.saved.stars[7] = 3; if (st.s) st.s.hits = 99999; else st.hits = 99999; });
    assert.equal((await snapshot(page)).saved.stars[7], 0, 'snapshot cannot unlock campaign levels');
    assert.notEqual(rules(await snapshot(page)).hits, 99999, 'snapshot cannot alter rules');
    await touch(page, '#sound1'); const sound = (await snapshot(page)).saved.sound;
    assert.notEqual(sound, save1.sound, 'menu sound button changes preference');
    await touch(page, "#levels button[data-level='2']");
    await touch(page, '#pause'); await touch(page, '#sound2');
    assert.equal((await snapshot(page)).saved.sound, save1.sound, 'pause sound button shares preference');
    await touch(page, '#resume');

    const accelerated = [];
    for (let level = 2; level <= 8; level++) {
      assert.equal(rules(await snapshot(page)).level, level, 'campaign advances sequentially');
      if (level === 2) await harmonyGate(page);
      accelerated.push(await acceleratedWin(page, level));
      assert.equal(await page.locator('#objective').isVisible(), false, 'harmony cue hides on the result card');
      validSave((await snapshot(page)).saved);
      assert.ok((await snapshot(page)).saved.stars[level - 1] > 0, `level ${level} stars saved`);
      await touch(page, '#next');
    }
    // Nights 9-24 (new): each one is won by the same accelerated controller; their stars live in a new key.
    assert.equal(rules(await snapshot(page)).level, 9, 'night 8 leads on to night 9');
    for (let level = 9; level <= 24; level++) {
      assert.equal(rules(await snapshot(page)).level, level, 'campaign advances sequentially');
      assert.ok((await snapshot(page)).cue.length > 0, `night ${level} explains its idea`);
      accelerated.push(await acceleratedWin(page, level));
      const after = await snapshot(page);
      validSave(after.saved);
      assert.ok(after.more.stars[level - 9] > 0, `night ${level} stars saved in the new key`);
      if (level === 9) await shot(page, `${name}-3b-night-9-won`);
      if (level < 24) await touch(page, '#next');
    }
    console.log(`${name}: ACCELERATED test-only campaign ${JSON.stringify(accelerated)}`);
    assert.match(await page.locator('#next').textContent(), /Endless/, 'final primary action offers endless');
    await touch(page, '#next'); assert.ok(rules(await snapshot(page)).endless, 'final primary action starts endless');
    await touch(page, '#pause'); await touch(page, '#quit'); await menu(page);
    assert.equal(await page.locator('#levels button:not([disabled])').count(), 8, 'all eight nights of the last chapter unlocked');
    assert.equal(await page.locator('#chapters button:not([disabled])').count(), 3, 'all three chapters open');
    await touch(page, '#chapters button[data-chapter="1"]');
    assert.equal(await page.locator('#levels button:not([disabled])').count(), 8, 'all eight levels unlocked');

    // Screenshot actual play under each palette. The palette changes the drawing, not campaign rules.
    for (const look of ['amber', 'moon', 'rose']) {
      await touch(page, `#looks button[data-look='${look}']`);
      assert.equal((await snapshot(page)).saved.look, look, `palette choice saves ${look}`);
      await touch(page, '#play'); await delay(300); await shot(page, `${name}-4-playing-${look}`);
      await geometry(page, `${look} play`); await touch(page, '#pause'); await touch(page, '#quit');
    }

    const campaign = (await snapshot(page)).saved.stars;
    await touch(page, '#endless'); st = await snapshot(page);
    assert.ok(rules(st).endless, 'Endless starts endless rules');
    await page.evaluate(() => {
      let last = -Infinity;
      for (let n = 0; n < 12000; n++) {
        const st = window.bellsState(), s = st.s || st;
        if (s.hits >= 6 || st.screen !== 'play') return;
        const i = st.views.findIndex(v => v.ready);
        if (i >= 0 && s.t - last >= .15) {
          const el = document.getElementById('pad' + i), r = el.getBoundingClientRect();
          const options = { pointerId: 10, pointerType: 'touch', isPrimary: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, bubbles: true, cancelable: true };
          el.dispatchEvent(new PointerEvent('pointerdown', { ...options, pressure: .5, buttons: 1 }));
          el.dispatchEvent(new PointerEvent('pointerup', { ...options, pressure: 0, buttons: 0 }));
          last = s.t;
        }
        window.bellsAdvance(1 / 120);
      }
    });
    assert.ok(rules(await snapshot(page)).hits >= 6, 'accelerated endless has six scored pad events before idle loss');
    await page.evaluate(() => { for (let n = 0; n < 24000 && window.bellsState().screen === 'play'; n++) window.bellsAdvance(1 / 120); });
    st = await snapshot(page); assert.equal(st.screen, 'end', 'idle endless run eventually ends');
    assert.equal(rules(st).won, false, 'idle endless ends without campaign victory');
    assert.equal(st.saved.best, rules(st).score, 'first completed endless run saves its exact score');
    assert.ok(st.saved.best > 0, 'endless best is positive');
    assert.deepEqual(st.saved.stars, campaign, 'endless preserves campaign stars');
    assert.match(await page.locator('#next').textContent(), /Try again/, 'endless primary action offers a retry');
    await shot(page, `${name}-5-endless-result`);
    const best = st.saved.best;
    assert.equal(await page.locator('#retry').isVisible(), false, 'a lost run has one retry button, the primary one');
    await touch(page, '#next'); assert.ok(rules(await snapshot(page)).endless, 'Retry retains endless mode');
    assert.equal(rules(await snapshot(page)).score, 0, 'Retry resets score');
    await page.evaluate(() => { for (let n = 0; n < 24000 && window.bellsState().screen === 'play'; n++) window.bellsAdvance(1 / 120); });
    st = await snapshot(page);
    assert.equal(st.screen, 'end', 'second idle endless run completes');
    assert.ok(rules(st).score < best, 'second endless result is below the saved best');
    assert.equal(st.saved.best, best, 'a completed lower score cannot overwrite the endless best');
    await page.reload(); await menu(page); assert.equal((await snapshot(page)).saved.best, best, 'endless best survives reload');

    const stored = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
    const saveKey = Object.keys(stored).find(key => { try { const s = JSON.parse(stored[key]); return s?.v === 1 && Array.isArray(s.stars) && s.stars.length === 8; } catch { return false; } });
    assert.ok(saveKey, 'campaign uses a discoverable device save');
    for (const [label, value] of [
      ['corrupt', '{bad json'],
      ['invalid', JSON.stringify({ v: 1, stars: [99, -1, '3', null], best: -100, sound: 'yes', tries: -1, look: 'missing' })],
      ['future-version', JSON.stringify({ v: 999, stars: Array(8).fill(3), best: 999, sound: true, tries: 0, look: 'amber' })],
    ]) {
      const p = await context(`localStorage.setItem(${JSON.stringify(saveKey)}, ${JSON.stringify(value)});`, '?test=1');
      validSave((await snapshot(p)).saved);
      await touch(p, '#play'); assert.equal((await snapshot(p)).screen, 'play', `${label} save still plays`);
      await p.close();
    }
    const blocked = await context(() => {
      Storage.prototype.getItem = () => { throw new DOMException('Blocked', 'SecurityError'); };
      Storage.prototype.setItem = () => { throw new DOMException('Blocked', 'SecurityError'); };
      Storage.prototype.removeItem = () => { throw new DOMException('Blocked', 'SecurityError'); };
    }, '?test=1');
    validSave((await snapshot(blocked)).saved);
    await touch(blocked, '#sound1'); await touch(blocked, '#play');
    assert.equal((await snapshot(blocked)).screen, 'play', 'blocked storage remains playable');
    await touch(blocked, '#pause'); await touch(blocked, '#quit'); await blocked.reload(); await menu(blocked);
    await blocked.close();

    const publicPage = await context(null, '');
    assert.equal(await publicPage.evaluate(() => typeof window.bellsAdvance), 'undefined', 'public page does not expose time advancement');
    await publicPage.emulateMedia({ reducedMotion: 'reduce' });
    await publicPage.reload(); await menu(publicPage);
    await touch(publicPage, '#play');
    await waitFor(publicPage, () => document.querySelector('.kit-hint.on.still'), 'reduced-motion hint');
    const checkStillHint = () => publicPage.evaluate(() => {
      const r = document.querySelector('.kit-hint.on.still').getBoundingClientRect(), p = window.bellsState().pads[0];
      return Math.hypot(r.x - p.x, r.y - p.y);
    });
    assert.ok(await checkStillHint() < 1, 'still hint is centred over the portrait pad');
    await rotate(publicPage, landscape);
    assert.ok(await checkStillHint() < 1, 'visible still hint moves to the landscape pad on rotation');
    await shot(publicPage, `${name}-6-landscape-reduced-motion`);
    await publicPage.close();
    // Separate query contexts keep palette validation independent of the campaign's saved choice.
    for (const look of ['moon', 'rose']) {
      const palettePage = await context(null, `?look=${look}&test=1`);
      assert.equal((await snapshot(palettePage)).saved.look, look, `query selects ${look}`);
      await geometry(palettePage, `${look} menu`);
      await palettePage.context().close();
    }
    console.log(`${name}: three palette menus ${functionalOnly ? 'checked (capture skipped: functional-only mode)' : 'captured'}`);
    // Daily peal, Turkish and the small-games home: one seed and one idea per day for everyone, a picture to share,
    // a back link and a result for the home, and nothing scrolls on a 320x568 phone.
    {
      const dp = await context(() => { try { localStorage.setItem('hf-lab-send-localhost', '1'); } catch {} }, '?test=1&day=2026-11-24&lang=tr&from=small&labRunSource=agent');
      assert.equal(await dp.evaluate(() => document.documentElement.lang), 'tr', 'lang=tr turns the page Turkish');
      assert.equal(await dp.locator('#daily').textContent(), 'Günün çanları', 'Turkish daily button');
      assert.equal(await dp.locator('#menu .kit-home').count(), 1, 'opened from the home: back link on the menu');
      const fits = async label => { const r = await dp.evaluate(() => [...document.querySelectorAll('.screen.on')].map(el => ({ id: el.id, over: el.scrollHeight - el.clientHeight })).concat([{ id: 'page', over: document.documentElement.scrollHeight - innerHeight }])); for (const x of r) assert.ok(x.over <= 0, `${label}: ${x.id} does not scroll (${x.over}px)`); };
      await dp.setViewportSize({ width: 320, height: 568 }); await delay(200);
      await fits('320x568 Turkish menu'); await geometry(dp, '320x568 Turkish menu'); await shot(dp, `${name}-7-tr-320-menu`);
      const before = (await snapshot(dp)).saved;
      await touch(dp, '#daily');
      let d = await snapshot(dp);
      assert.equal(rules(d).daily, '2026-11-24', 'daily peal of the asked day');
      assert.ok(d.cue.startsWith('Günün çanları'), 'daily idea is shown in Turkish');
      const seed = rules(d).seed, idea = rules(d).idea;
      await touch(dp, '#pause'); await fits('320x568 Turkish pause'); await touch(dp, '#resume');
      const daily = await acceleratedWin(dp, 'daily');
      d = await snapshot(dp);
      assert.equal(d.dailySave.plays, 1, 'daily play counted'); assert.ok(d.dailySave.best > 0, 'daily best saved');
      assert.equal(d.dailySave.peal.length, rules(d).hits, 'every strike of the peal is kept for the picture');
      // Sound and music on: every strike's pitch is a note of the kit/music.js bell chord, not the fixed fallback.
      assert.ok(d.saved.sound && d.music, 'daily played with sound and music on'); assert.deepEqual(d.voices, { music: d.strikes }, 'every strike takes its pitch from kit/music.js');
      assert.deepEqual(d.saved, { ...before, tries: before.tries + 1 }, 'the daily peal changes nothing in the old save but tries');
      assert.ok(await dp.locator('#share').isVisible(), 'daily result offers Share'); assert.equal((await dp.locator('#share').textContent()).trim(), 'Paylaş', 'Share is in Turkish');
      assert.ok(await dp.locator('#replay').isVisible(), 'a won run can play its tune again');
      await waitFor(dp, () => window.bellsState().picture, 'daily share picture drawn');
      const png = await dp.evaluate(() => window.bellsPicture());
      const size = await dp.evaluate(src => new Promise(ok => { const i = new Image(); i.onload = () => ok([i.width, i.height]); i.src = src; }), png);
      assert.deepEqual(size, [1080, 1350], 'share picture is 1080x1350');
      assert.equal(await dp.locator('#end .kit-home').count(), 1, 'back link on the result card');
      await fits('320x568 Turkish daily result'); await shot(dp, `${name}-8-tr-320-daily-result`);
      const home = await dp.evaluate(() => JSON.parse(localStorage.getItem('hub:results') || '{}')['night-bells']);
      assert.ok(home && home.runs >= 1, 'the home learns the result');
      const run = assertRun(dp.context().lab, 'night-bells', { outcomes: ['won'], summaryKeys: ['level', 'endless', 'hits', 'score'] });
      assert.equal(run.data.summary.daily, '2026-11-24'); assert.ok(run.data.events.some(e => e.type === 'daily-finished'), 'daily run records daily-finished');
      console.log(`${name}: DAILY ${idea} seed ${seed} ${JSON.stringify(daily)}`);
      await touch(dp, '#toMenu'); await menu(dp); await fits('320x568 Turkish menu after daily');
      await dp.context().close();
      // Same day on a fresh device: the same seed and idea. Another day: another seed.
      for (const [day, same] of [['2026-11-24', true], ['2026-11-25', false]]) {
        const other = await context(null, `?test=1&day=${day}`);
        await touch(other, '#daily'); const o = rules(await snapshot(other));
        if (same) { assert.equal(o.seed, seed, 'same day, same seed'); assert.equal(o.idea, idea, 'same day, same idea'); }
        else assert.notEqual(o.seed, seed, 'another day, another seed');
        await other.context().close();
      }
    }
    // Play recording: the notice is on the menu before Play; a played run sends one record under 'night-bells';
    // with the switch off in the pause card the next run sends nothing.
    {
      const recPage = await context(() => { try { localStorage.setItem('hf-lab-send-localhost', '1'); } catch {} }, '?look=amber&test=1&labRunSource=agent');
      const lab = recPage.context().lab, advance = () => recPage.evaluate(() => { for (let n = 0; n < 24000 && window.bellsState().screen === 'play'; n++) window.bellsAdvance(1 / 120); });
      await assertNotice(recPage, '#play');
      assert.equal(lab.sent.length, 0, 'nothing is sent before Play');
      await touch(recPage, '#endless'); await advance();
      await waitFor(recPage, () => window.bellsState().screen === 'end', 'endless run ended');
      await delay(600);
      const run = assertRun(lab, 'night-bells', { outcomes: ['lost', 'won'], summaryKeys: ['level', 'endless', 'hits', 'score'] });
      assert.equal(run.data.summary.endless, true); assert.ok(run.data.events.some(e => e.type === 'endless-finished'));
      await touch(recPage, '#next'); await touch(recPage, '#pause');
      await assertOffSendsNothing(recPage, lab, 'night-bells', { play: async () => { await touch(recPage, '#resume'); await advance(); await waitFor(recPage, () => window.bellsState().screen === 'end', 'second run ended'); } });
      console.log(`${name}: play recording sent ${lab.sent.length} records and nothing more once switched off`);
    }
    assert.ok(requests.some(r => r.url.endsWith('/notes/button.js')), 'page loads actual notes button script');
    assert.ok(requests.every(r => r.method === 'GET' && new URL(r.url).origin === base), 'no telemetry, writes, or outbound requests');
    assert.deepEqual(errors, [], 'no page, console, HTTP, or request errors');
    console.log(`${name}: PASS${functionalOnly ? ' FUNCTIONAL ONLY' : ''} pause/resume/blur, save/reload, 24 levels, daily peal, Turkish 320x568, endless best ${best}, invalid/corrupt/blocked storage; ${requests.length} same-origin GETs only; ${functionalOnly ? 'screenshots skipped' : `screenshots ${SHOTS}`}`);
  } catch (error) {
    if (errors.length) console.error(`${name}: captured errors ${JSON.stringify(errors)}`);
    throw error;
  } finally {
    await Promise.allSettled(contexts.map(ctx => ctx.close()));
    await browser.close();
  }
}

let failed = 0;
try {
  const names = process.argv[2] ? [process.argv[2]] : ['webkit', 'chromium'];
  for (const name of names) {
    try { await run(name); }
    catch (error) { failed++; console.error(`${name}: FAIL ${error.stack || error}`); }
  }
} finally { await new Promise(done => server.close(done)); }
process.exitCode = failed ? 1 : 0;
