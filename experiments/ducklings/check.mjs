// Phone check for Follow Me: node experiments/ducklings/check.mjs
// Serves experiments/ (so ../kit/ resolves), serves the tester notes button, and plays stage 1
// to the end card with touch pointer events on WebKit (iPhone 13), Chromium (Pixel 7), and Chromium 360x640. Screenshots go to $SHOTS (default: a folder in the system temp dir).
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { gunzipSync } from 'node:zlib';
import assert from 'node:assert/strict';
import { ROUTES } from './bots.mjs';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '..');
const SHOTS = process.env.SHOTS || join(tmpdir(), 'ducklings-shots');
const WORDS_SHOTS = process.env.WORDS_SHOTS || SHOTS;
await Promise.all([mkdir(SHOTS, { recursive: true }), mkdir(WORDS_SHOTS, { recursive: true })]);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/notes/button.js') {
    const source = await readFile(resolve(root, '../workers/feedback/public/notes/button.js'));
    res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(source);
  }
  if (url.pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
  let file = normalize(join(root, decodeURIComponent(url.pathname)));
  if (url.pathname.endsWith('/')) file = join(file, 'index.html');
  try { if (!file.startsWith(root)) throw 0; const body = await readFile(file); res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' }); res.end(body); }
  catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;

const require = createRequire(process.env.PLAYWRIGHT ? join(resolve(process.env.PLAYWRIGHT), 'x.js') : import.meta.url);
const { webkit, chromium, devices } = require('playwright');

const sleep = ms => new Promise(done => setTimeout(done, ms));
async function until(page, fn, what, ms = 15000, arg) { try { await page.waitForFunction(fn, arg, { timeout: ms, polling: 50 }); } catch { throw new Error(`timed out waiting for: ${what}`); } }
const state = page => page.evaluate(() => window.ducklingsState());
// A finger on the canvas, as touch pointer events (the kit's phone check does the same).
const finger = (page, steps) => page.evaluate(steps => {
  const el = document.querySelector('#c');
  for (const [type, x, y, id = 7] of steps) el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: id === 7, clientX: x, clientY: y, pressure: type === 'pointerup' ? 0 : 0.5, bubbles: true, cancelable: true }));
}, steps);
const tap = (page, sel) => page.evaluate(sel => { const el = document.querySelector(sel); el.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 9, pointerType: 'touch', bubbles: true, cancelable: true })); el.click(); }, sel);

// Hold a finger on each authored waypoint in turn (the bots' route), then on the nest. One pond width is one viewport width.
async function follow(page, route, ms = 40000) {
  const vp = page.viewportSize(), t0 = Date.now(); let i = 0, down = false;
  while (Date.now() - t0 < ms) {
    const st = await state(page);
    if (st.screen !== 'play' || !st.playing) break;
    while (typeof route[i] === 'number') i++;
    const point = route[i];
    if (point && Math.hypot(st.mom.x - point[0], st.mom.y - point[1]) < .045) { i++; continue; }
    let dx = point ? (point[0] - st.mom.x) * vp.width : st.nest.sx - st.mom.sx;
    let dy = point ? -(point[1] - st.mom.y) * vp.width : st.nest.sy - st.mom.sy;
    const room = st.mom.sy - 90;
    if (-dy > room) { const k = room / -dy; dx *= k; dy *= k; }
    await finger(page, [[down ? 'pointermove' : 'pointerdown', st.mom.sx + dx, st.mom.sy + dy]]); down = true;
    await sleep(40);
  }
  if (down) await finger(page, [['pointerup', 0, 0]]);
}

// Drag toward visible points in the pond. Waiting ducklings first, then the nest.
async function drive(page, ms) {
  const vp = page.viewportSize(), t0 = Date.now(); let down = false;
  while (Date.now() - t0 < ms) {
    const st = await state(page);
    if (st.screen !== 'play' || !st.playing) break;
    const goal = st.waitingDucks.filter(d => d.y > st.mom.y - 0.3).sort((a, b) => Math.hypot(a.sx - st.mom.sx, a.sy - st.mom.sy) - Math.hypot(b.sx - st.mom.sx, b.sy - st.mom.sy))[0] ?? st.nest ?? { sx: st.mom.sx, sy: st.mom.sy - 200 };
    // Aim at most 120 px ahead so the path can follow the scrolling pond.
    const dx = goal.sx - st.mom.sx, dy = goal.sy - st.mom.sy, d = Math.hypot(dx, dy) || 1, k = Math.min(1, 120 / d);
    const x = Math.max(10, Math.min(vp.width - 10, st.mom.sx + dx * k)), y = Math.max(80, Math.min(vp.height - 10, st.mom.sy + dy * k));
    await finger(page, [[down ? 'pointermove' : 'pointerdown', x, y]]); down = true;
    await sleep(60);
  }
  if (down) await finger(page, [['pointerup', 0, 0]]);
}

async function assertTargets(page) {
  const targets = await page.locator('button:visible, .lab-notice a:visible, #labSwitch label:visible').evaluateAll(elements =>
    elements.map(el => ({ label: el.textContent, box: el.getBoundingClientRect().toJSON() })));
  assert.ok(targets.length, 'the screen has interactive controls');
  for (const { label, box } of targets) {
    assert.ok(box.width >= 44 && box.height >= 44, `${label}: ${box.width} × ${box.height}, expected at least 44 px`);
    assert.ok(box.left >= 0 && box.right <= page.viewportSize().width, 'control fits the phone width');
  }
}

async function localizedScreens(page, goto, shot) {
  await page.evaluate(() => {
    localStorage.removeItem('ducklings-save');
    localStorage.removeItem('ducklings:hint');
    localStorage.removeItem('hf-lab-send-localhost');
  });
  await goto('?fast=2', 'tr');
  const tables = await page.evaluate(async () => (await import('/ducklings/words.js')).tables);
  assert.deepEqual(Object.keys(tables.en).sort(), Object.keys(tables.tr).sort(), 'identical translation keys');
  const slots = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
  for (const key of Object.keys(tables.en)) {
    assert.ok(tables.tr[key].trim(), `empty Turkish translation for ${key}`);
    assert.deepEqual(slots(tables.tr[key]), slots(tables.en[key]), `template parameters match for ${key}`);
  }

  async function capture(lang, name) {
    assert.equal(await page.locator('html').getAttribute('lang'), lang);
    if (name === 'win' || name === 'loss') {
      await page.locator('#endStars span').last().evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
    }
    await shot(`${lang}-${name}`, lang === 'tr' && ['menu', 'first-lesson', 'pause', 'win', 'loss'].includes(name) ? WORDS_SHOTS : SHOTS);
    const findings = await page.evaluate(({ en, tr, lang }) => {
      const escapes = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const english = Object.values(en).filter(value => !Object.values(tr).includes(value)).map(value =>
        new RegExp('^' + value.split(/(\{\w+\})/).map(part => part.startsWith('{') ? '.+?' : escapes(part)).join('') + '$', 'iu'));
      const overflow = [], untranslated = [];
      const visible = el => {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return false;
        for (let n = el; n; n = n.parentElement) {
          const style = getComputedStyle(n);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
        }
        return true;
      };
      const text = value => {
        value = value?.trim();
        if (value && lang === 'tr' && english.some(re => re.test(value))) untranslated.push(value);
      };
      for (const el of document.body.querySelectorAll('*')) {
        if (!visible(el) || (el instanceof SVGElement && el.ownerSVGElement)) continue;
        const box = el.getBoundingClientRect();
        const containsCopy = !el.closest('.kit-hint .knob, .kit-hint .hand, .screen-reader');
        if (box.left < -.5 || box.top < -.5 || box.right > innerWidth + .5 || box.bottom > innerHeight + .5 ||
          (containsCopy && el.clientWidth && el.scrollWidth > el.clientWidth + 1) ||
          (containsCopy && el.clientHeight && el.scrollHeight > el.clientHeight + 1)) {
          overflow.push(`${el.id || el.className || el.tagName} ${[box.x, box.y, box.width, box.height].map(Math.round).join(',')}`);
        }
        if (!el.closest('[aria-hidden=true]')) {
          text(el.getAttribute('aria-label'));
          text(el.getAttribute('title'));
          for (const child of el.childNodes) if (child.nodeType === Node.TEXT_NODE) text(child.textContent);
        }
      }
      text(document.title);
      for (const line of window.ducklingsCanvasText) text(line);
      return { untranslated, overflow };
    }, { ...tables, lang });
    assert.deepEqual(findings.untranslated, [], `English leaked into ${lang} ${name}`);
    assert.deepEqual(findings.overflow, [], `${lang} ${name} fits the viewport`);
    await assertTargets(page);
  }

  await capture('tr', 'menu');
  for (const [index, chapter] of ['road', 'garden', 'river'].entries()) {
    await page.locator('#chapters button').nth(index + 1).tap();
    await capture('tr', `map-${chapter}`);
  }
  await page.locator('#chapters button').first().tap();
  await page.locator('#menuLanguage').tap();
  assert.equal(await page.locator('html').getAttribute('lang'), 'en', 'menu switches immediately');
  assert.equal(new URL(page.url()).searchParams.get('fast'), '2');
  assert.equal(new URL(page.url()).searchParams.has('lang'), false);
  await page.reload();
  await capture('en', 'menu');
  for (const [index, chapter] of ['road', 'garden', 'river'].entries()) {
    await page.locator('#chapters button').nth(index + 1).tap();
    await capture('en', `map-${chapter}`);
  }
  await page.locator('#chapters button').first().tap();
  for (const lang of ['en', 'tr']) {
    await goto('?fast=2', lang);
    await page.locator('#chapters button').first().tap();
    await page.locator('#nodes button[data-level="1"]').tap();
    await capture(lang, 'first-lesson');
    await tap(page, '#pause');
    await capture(lang, 'pause');
    if (lang === 'en') {
      await page.locator('#pauseLanguage').tap();
      assert.equal(await page.locator('html').getAttribute('lang'), 'tr');
      assert.equal(await page.textContent('#resume'), tables.tr.resume);
      assert.ok((await state(page)).paused);
      await page.reload();
      assert.equal(await page.locator('html').getAttribute('lang'), 'tr', 'Turkish persists on reload');
      await goto('?fast=2', 'en');
      await page.locator('#nodes button[data-level="1"]').tap();
    } else {
      await page.locator('#resume').tap();
    }
    const { nest } = await state(page);
    await page.touchscreen.tap(Math.round(nest.sx), Math.round(nest.sy));
    await until(page, () => window.ducklingsState().screen === 'end', 'one nest tap clears the first level');
    assert.equal((await state(page)).over, 'nest');
    await until(page, () => document.querySelectorAll('#endStars .got').length === 3, 'star reveal');
    await capture(lang, 'win');
    await goto('?level=20&fast=4', lang);
    await page.locator('#play').tap();
    await capture(lang, 'timed');
    const { mom } = await state(page);
    await page.touchscreen.tap(Math.round(mom.sx), Math.round(mom.sy + 55));
    await until(page, () => window.ducklingsState().screen === 'end', 'time loss');
    await until(page, () => document.querySelectorAll('#endStars .in').length === 3, 'loss star reveal');
    assert.equal((await state(page)).over, 'lost-all');
    await capture(lang, 'loss');

    await goto('?level=2', lang);
    await page.locator('#play').tap();
    await until(page, () => document.querySelector('#peep:not([hidden]) svg'), 'rescue call');
    await capture(lang, 'rescue');

    await goto('?level=5', lang);
    await page.locator('#play').tap();
    await capture(lang, 'road-curb');

    await page.evaluate(() => {
      const save = JSON.parse(localStorage.getItem('ducklings-save'));
      localStorage.setItem('ducklings-save', JSON.stringify({ ...save, opened: 8, endless: 8210 }));
    });
    await goto('?seed=4242&fast=5', lang);
    assert.match(await page.textContent('#endless'), lang === 'tr' ? /8\.210/ : /8,210/);
    await page.locator('#endless').tap();
    await capture(lang, 'endless-open');
    const start = (await state(page)).mom;
    await page.touchscreen.tap(Math.round(start.sx), Math.round(start.sy - 90));
    await until(page, () => document.querySelector('#flockHud.low'), 'low sunlight');
    await capture(lang, 'endless-low');
    await until(page, () => window.ducklingsState().screen === 'end', 'Endless result');
    await capture(lang, 'endless-result');
  }

  await page.evaluate(() => localStorage.setItem('notes.k', 'check'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await goto('?hint=hand', 'tr');
  assert.equal(await page.locator('#notes-button').getAttribute('aria-label'), tables.tr.notes);
  await page.locator('#chapters button').first().tap();
  await page.locator('#nodes button[data-level="1"]').tap();
  await until(page, () => document.querySelector('.kit-hint.on'), 'still shared hint');
  assert.equal(await page.locator('.kit-hint .label').innerText(), tables.tr.hint);
  await capture('tr', 'reduced-motion');
}

async function run(name, engine, device, localizationOnly = false) {
  const browser = await engine.launch();
  const context = await browser.newContext({ ...device, locale: 'en-US' });
  const page = await context.newPage();
  const errors = [], sent = [];
  page.setDefaultTimeout(12000);
  await context.route('https://human.adamwhite.work/**', async route => {
    const req = route.request();
    const cors = { 'access-control-allow-origin': base, 'access-control-allow-headers': 'Content-Type' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    sent.push(JSON.parse(gunzipSync(req.postDataBuffer()).toString()));
    return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: '{"ok":true}' });
  });
  await page.addInitScript(() => {
    window.ducklingsCanvasText = new Set();
    for (const key of ['fillText', 'strokeText']) {
      const draw = CanvasRenderingContext2D.prototype[key];
      CanvasRenderingContext2D.prototype[key] = function (value, ...args) {
        window.ducklingsCanvasText.add(String(value));
        return draw.call(this, value, ...args);
      };
    }
    const Real = window.AudioContext || window.webkitAudioContext;
    window.audioMade = 0;
    if (Real) window.AudioContext = window.webkitAudioContext = class extends Real {
      constructor(...args) { super(...args); window.audioMade++; }
    };
  });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  const shot = async (label, folder = SHOTS) => {
    await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    await page.screenshot({ path: join(folder, `${name}-${label}.png`), scale: 'css' });
  };
  const goto = (suffix = '', lang = 'en') => {
    const url = new URL(`/ducklings/${suffix}`, base);
    if (lang) url.searchParams.set('lang', lang);
    return page.goto(url.href);
  };
  const leave = async () => {
    await tap(page, '#pause');
    await tap(page, '#pauseMenu');
    assert.equal((await state(page)).screen, 'menu');
  };
  const end = () => until(page, () => window.ducklingsState().screen === 'end', 'end card');
  const save = () => page.evaluate(() => JSON.parse(localStorage.getItem('ducklings-save')));
  try {
    await goto('?fast=2');
    await until(page, () => window.ducklingsState?.().screen === 'menu', 'menu ready');
    if (localizationOnly) {
      await localizedScreens(page, goto, shot);
      assert.deepEqual(errors, [], 'page errors');
      console.log(`ok   ${name} (both languages and layouts)`);
      return true;
    }
    if (!process.env.VISUAL_ONLY) await page.evaluate(() => localStorage.setItem('hf-lab-send-localhost', '1'));
    assert.match(await page.textContent('#menu'), /The game lab records play/);
    assert.equal(await page.evaluate(() => window.audioMade), 0);
    await assertTargets(page);
    const firstNode = await page.locator('[data-level="1"]').boundingBox();
    const fourthNode = await page.locator('[data-level="4"]').boundingBox();
    assert.equal(fourthNode.y, firstNode.y, 'the four pond stages form one continuous row');
    await shot('map');
    await page.locator('#chapters button').nth(3).click();
    assert.equal(await page.locator('#nodes button:disabled').count(), 9);
    assert.match(await page.textContent('#play'), /Pond.*1/, 'locked chapter names the actual destination');
    await assertTargets(page);
    await shot('river-map');
    await page.locator('#chapters button').first().click();
    assert.match(await page.textContent('#play'), /Play 1/);
    await page.click('#play');
    let st = await state(page);
    assert.equal(st.stage, 1);
    assert.ok(st.waiting && st.line === 1);
    assert.equal(await page.evaluate(() => window.audioMade), 1);
    await shot('first-swim');
    assert.ok(await page.locator('#c').evaluate(canvas => {
      // This patch is open water away from the hearts, the nest and the flock.
      const g = canvas.getContext('2d');
      const pixel = g.getImageData(Math.floor(canvas.width * .22), Math.floor(canvas.height * .01), 1, 1).data;
      return pixel[1] - pixel[0] > 35;
    }), 'water at the top keeps its colour outside HUD badges');
    assert.ok(await page.locator('#c').evaluate(canvas => {
      const pixel = canvas.getContext('2d').getImageData(Math.floor(canvas.width * .58), Math.floor(canvas.height * .35), 1, 1).data;
      return pixel[1] > pixel[0];
    }), 'the opening pond is rendered without a hit flash');
    assert.match(await page.textContent('#guideLabel'), /Tap the nest.*drag to steer/s);
    assert.ok(await page.locator('#c').evaluate(canvas => {
      const { nest } = window.ducklingsState(), scale = canvas.width / innerWidth;
      const g = canvas.getContext('2d');
      return [-13, 13].some(dx => {
        const [r, green, b] = g.getImageData(Math.round((nest.sx + dx) * scale), Math.round(nest.sy * scale), 1, 1).data;
        return r > 245 && green > 230 && b > 170;
      });
    }), 'the first tap ring is drawn on the real nest');
    const y0 = st.mom.y;
    await finger(page, [['pointerdown', st.mom.sx, st.mom.sy - 45]]);
    await until(page, y => window.ducklingsState().mom.y > y + .048, 'thumb steers', 5000, y0);
    st = await state(page);
    assert.ok(st.rollCalls >= 1);
    assert.match(await page.locator('#quack').getAttribute('aria-label'), /call the flock closer/);
    assert.equal(await page.locator('#quackDemo .icon').count(), 3);
    await finger(page, [['pointerdown', 40, 300, 8], ['pointerup', 40, 300, 8], ['pointerup', 0, 0]]);
    await until(page, () => window.ducklingsState().quackCool > 0, 'second finger quacks');
    await tap(page, '#pause');
    st = await state(page);
    assert.ok(st.paused && st.screen === 'paused');
    await assertTargets(page);
    assert.match(await page.textContent('#pauseMenu'), /leave/i, 'leaving the swim is explicit');
    await shot('paused');
    await sleep(260);
    assert.equal((await state(page)).t, st.t, 'pause freezes simulation');
    await page.click('#resume');
    await until(page, t => window.ducklingsState().t > t + .15, 'resume continues', 4000, st.t);
    await page.evaluate(() => dispatchEvent(new Event('blur')));
    assert.ok((await state(page)).paused, 'blur pauses');
    await page.keyboard.press('p');
    await drive(page, 13000);
    await end();
    st = await state(page);
    assert.equal(st.over, 'nest');
    assert.equal(st.stars, 3);
    await sleep(550);
    await shot('home');
    await assertTargets(page);
    assert.equal((await save()).opened, 2);
    const nextBox = await page.locator('#next').boundingBox();
    assert.ok(Math.abs(nextBox.x + nextBox.width / 2 - page.viewportSize().width / 2) <= 1, 'Next is centered in the postcard');
    const mapPage = await context.newPage();
    await mapPage.goto(base + '/ducklings/?lang=en');
    assert.equal(await mapPage.locator('#album').getAttribute('aria-label'), '1 duckling home');
    await mapPage.close();

    await page.click('#next');
    assert.equal((await state(page)).stage, 2);
    await until(page, () => document.querySelector('#peep:not([hidden]) svg'), 'the waiting duck shows a sound wave');
    await shot('rescue');
    st = await state(page);
    const duck = st.waitingDucks[0];
    await page.touchscreen.tap(Math.round(duck.sx), Math.round(duck.sy));
    await until(page, () => window.ducklingsState().line === 2, 'tap directly on the waiting duckling to rescue it', 6000);
    await until(page, () => window.ducklingsState().t > 3, 'camera has scrolled after rescue');
    st = await state(page);
    assert.ok(Math.abs(st.mom.y - duck.y) < .025, 'camera scroll keeps a single tap aimed at the same pond location');
    if (st.nest.sy < 0) {
      assert.equal(await page.locator('#nestDirection:visible').getAttribute('aria-label'), 'Nest ahead', 'show the route once the nest is above the screen');
    }
    await shot('mid-swim');
    await drive(page, 14000);
    await end();
    st = await state(page);
    assert.equal(st.stars, 3);
    assert.equal(st.arrived, 2);
    const blob = await save();
    assert.equal(blob.opened, 3);
    assert.equal(blob.home, 3);
    assert.deepEqual(blob.stars, { 1: 3, 2: 3 });
    await page.reload();
    assert.deepEqual(await save(), blob);
    assert.match(await page.textContent('#play'), /Play 3/);
    await page.locator('#nodes button[data-level="1"]').click();
    assert.equal((await state(page)).stage, 1, 'map replays an unlocked level');
    await leave();
    if (!process.env.VISUAL_ONLY) {
      await sleep(350);
      const runs = sent.filter(e => e.game === 'ducklings' && e.kind === 'run');
      assert.ok(runs.some(e => e.data.outcome === 'nest' && e.data.summary.stage === 2 &&
        e.data.summary.arrived === 2 && e.data.events.some(item => item.type === 'join')));
      assert.ok(runs.some(e => e.data.outcome === 'left'));
    }

    // A campaign minimum can differ from both the whole flock and the number following.
    for (const [level, flock, goal] of [
      [4, ['1 following', '3 waiting'], 'Bring 3 of 4 home'],
      [6, ['3 following'], 'Bring 2 of 3 home'],
    ]) {
      await goto(`?level=${level}`);
      await tap(page, '#play');
      await shot(`goal-${level}`);
      assert.deepEqual(await page.locator('#flockCount .stat:not(.goal)').evaluateAll(els => els.map(el => el.getAttribute('aria-label'))), flock);
      assert.equal(await page.locator('#flockCount .goal').getAttribute('aria-label'), goal);
      assert.match(await page.locator('#flockCount .goal').innerText(), /^≥[23]$/);
      assert.equal(await page.locator('#flockCount .goal.met').count(), 0, 'following birds are not counted as home');
      await leave();
    }

    await goto('?level=4');
    await tap(page, '#play');
    await shot('reed-pockets');
    // Sample the middle of the expected dotted guide, away from the duck and the hand.
    const pathLeadsToDuck = await page.evaluate(() => {
      const st = window.ducklingsState(), duck = st.waitingDucks[0];
      const canvas = document.querySelector('#c'), ctx = canvas.getContext('2d');
      const scale = canvas.width / innerWidth;
      for (let t = .22; t < .45; t += .005) {
        const x = Math.round((st.mom.sx + (duck.sx - st.mom.sx) * t) * scale);
        const y = Math.round((st.mom.sy + (duck.sy - st.mom.sy) * t) * scale);
        const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
        if (r > 245 && g > 235 && b < 230) return true;
      }
      return false;
    });
    assert.ok(pathLeadsToDuck, 'the opening guide leads to the first calling duckling in Reed pockets');
    await leave();
    await goto('?level=5');
    await tap(page, '#play');
    assert.equal((await state(page)).lesson, 'car');
    await shot('road');
    assert.match(await page.textContent('#guideLabel'), /ring.*curb/);
    st = await state(page);
    const curbY = st.mom.sy - .48 * page.viewportSize().width;
    await page.touchscreen.tap(Math.round(st.mom.sx), Math.round(curbY));
    await until(page, () => document.querySelector('#guideLabel').textContent.includes('Wait for the car'), 'car wait cue');
    await shot('road-wait');
    await until(page, () => document.querySelector('#guideLabel').textContent.includes('far bank'), 'car passed and the whole flock has time to cross');
    await shot('road-crossing');
    st = await state(page);
    const bankY = st.mom.sy - (1.26 - st.mom.y) * page.viewportSize().width;
    await page.touchscreen.tap(Math.round(st.mom.sx), Math.round(bankY));
    await until(page, () => document.querySelector('#guideLabel').textContent.includes('last duckling'), 'tail cue during the crossing');
    await until(page, () => window.ducklingsState().mom.y > 1.25 &&
      document.querySelector('#guideLabel').hidden, 'tail clears the road');
    const crossed = await state(page);
    assert.equal(crossed.line, 2);
    assert.equal(crossed.hearts, 3);
    await leave();
    await goto('?level=5&fast=4');
    await tap(page, '#play');
    st = await state(page);
    await page.touchscreen.tap(Math.round(st.mom.sx), Math.round(st.mom.sy - .48 * page.viewportSize().width));
    await until(page, () => {
      const st = window.ducklingsState();
      return st.t > 5.8 && st.t < 6.05 && document.querySelector('#guideLabel').textContent.includes('Wait for the car');
    }, 'late gap does not advertise a crossing');
    await leave();
    await goto('?level=9');
    await tap(page, '#play');
    await shot('catnap');
    await leave();
    await goto('?level=16');
    await tap(page, '#play');
    await shot('folding-leaves');
    await leave();
    await goto('?level=20&fast=2');
    await tap(page, '#play');
    await shot('dash');
    await drive(page, 8000);
    await end();
    assert.equal((await state(page)).stars, 3, 'touch dash clears the moving current');
    assert.equal((await save()).opened, 3, 'preview did not unlock the map');

    // Middle and late game audit. A clock loss names the input that beats the clock.
    await goto('?level=20&fast=5');
    await tap(page, '#play');
    st = await state(page);
    await page.touchscreen.tap(Math.round(st.mom.sx), Math.round(st.mom.sy - 60));
    await end();
    assert.equal((await state(page)).why, 'dusk');
    assert.match(await page.locator('#starTip .hold').getAttribute('aria-label'), /finger down ahead/, 'a clock loss shows the held-finger tip');
    await shot('clock-tip');
    // Retry from the pause menu restarts the same swim.
    await goto('?level=10');
    await tap(page, '#play');
    st = await state(page);
    await finger(page, [['pointerdown', st.mom.sx, st.mom.sy - 60]]);
    await until(page, () => window.ducklingsState().t > 1, 'swim before retry');
    await finger(page, [['pointerup', 0, 0]]);
    await tap(page, '#pause');
    await assertTargets(page);
    await shot('pause-retry');
    await tap(page, '#pauseRetry');
    st = await state(page);
    assert.ok(st.screen === 'play' && !st.paused && st.stage === 10 && st.t < .5 && st.waiting, 'pause retry restarts the same swim');
    await leave();
    // The last stage of a chapter names the next chapter, and the last nest opens the endless pond.
    const kept = await save();
    await page.evaluate(old => localStorage.setItem('ducklings-save', JSON.stringify({ ...old, opened: 24 })), kept);
    await goto('?level=4');
    await tap(page, '#play');
    await follow(page, ROUTES[4]);
    await end();
    assert.equal((await state(page)).over, 'nest');
    assert.equal(await page.textContent('#next'), 'Next: Road', 'the chapter card names the next chapter');
    await goto('?level=24');
    await tap(page, '#play');
    await follow(page, ROUTES[24]);
    await end();
    assert.equal((await state(page)).over, 'nest', 'the last stage is won by its route');
    await until(page, () => getComputedStyle(document.querySelector('#endlessNext')).display !== 'none', 'the last nest offers the endless pond');
    await assertTargets(page);
    await shot('trail-complete');
    await tap(page, '#endlessNext');
    assert.equal((await state(page)).mode, 'endless', 'the endless button starts the endless pond');
    await leave();
    await page.evaluate(old => localStorage.setItem('ducklings-save', JSON.stringify(old)), kept);

    if (!process.env.VISUAL_ONLY) {
      const legacy = { v: 1, sound: false, opened: 8, stars: {1: 2, 7: 3}, best: {1: 140}, endless: 8210, home: 56, album: {Pip: 1}, taught: true };
      await page.evaluate(old => localStorage.setItem('ducklings-save', JSON.stringify(old)), legacy);
      await goto('?hint=hand');
      assert.deepEqual(await save(), legacy);
      assert.equal((await state(page)).opened, 8);
      assert.match(await page.textContent('#endless'), /8,210/);
      assert.match(await page.textContent('#sound'), /off/);
      await page.click('#sound');
      await tap(page, '#play');
      await until(page, () => document.querySelector('.kit-hint.on')?.dataset.kind === 'hold-and-move', 'shared hint');
      st = await state(page);
      await finger(page, [['pointerdown', st.mom.sx, st.mom.sy - 20]]);
      assert.equal(await page.locator('.kit-hint').count(), 0);
      await finger(page, [['pointerup', 0, 0]]);
      await leave();
      await goto('?fast=4');
      await tap(page, '#endless');
      st = await state(page);
      assert.equal(st.mode, 'endless');
      await finger(page, [['pointerdown', st.mom.sx, st.mom.sy - 90]]);
      await until(page, () => window.ducklingsState().t > 1, 'endless advances from touch');
      assert.match(await page.locator('#sunRule:visible').getAttribute('aria-label'), /Cross sun pads for light/);
      await shot('endless');
      await finger(page, [['pointerup', 0, 0]]);
      const lowLightHeight = await page.waitForFunction(() => {
        if (!document.querySelector('#flockHud').classList.contains('low')) return false;
        const meter = document.querySelector('#lightMeter').getBoundingClientRect();
        const cue = document.querySelector('#sunRule').getBoundingClientRect();
        return cue.top >= meter.bottom && meter.width > 0;
      }, null, { timeout: 30000 });
      assert.ok(await lowLightHeight.jsonValue(), 'low-light HUD clears the sunlight meter');
      await shot('low-light');
      await end();
      assert.match(await page.locator('#endLine [role=img]').first().getAttribute('aria-label'), /Sun pads crossed: 0/);
      await goto('?level=20&fast=5');
      await tap(page, '#play');
      st = await state(page);
      await finger(page, [['pointerdown', st.mom.sx, st.mom.sy + 70], ['pointerup', 0, 0]]);
      await end();
      assert.equal((await state(page)).over, 'lost-all');
      await shot('loss');
    }

    if (name === 'webkit-iphone13' || name === 'chromium-360x640') {
      await localizedScreens(page, goto, shot);
    }
    assert.deepEqual(errors, [], 'page errors');
    console.log(`ok   ${name}`);
    return true;
  } catch (e) {
    console.log(`FAIL ${name}: ${e.stack}`);
    if (errors.length) console.log(errors.join('\n'));
    await page.screenshot({ path: join(SHOTS, name + '-fail.png'), scale: 'css', timeout: 5000 }).catch(() => {});
    return false;
  } finally { await browser.close(); }
}

const only = process.argv[2];
const runs = [
  ['webkit-iphone13', webkit, devices['iPhone 13']],
  ['chromium-pixel7', chromium, devices['Pixel 7']],
  ...[
    ['chromium-390x664', 390, 664],
    ['chromium-360x640', 360, 640],
  ].map(([name, width, height]) => [name, chromium, {
    ...devices['Pixel 7'], viewport: { width, height }, screen: { width, height },
  }]),
  ['webkit-390x844', webkit, { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } }, true],
];
let ok = true;
for (const [name, engine, device, localizationOnly] of runs) {
  if (!only || name.includes(only)) ok = (await run(name, engine, device, localizationOnly)) && ok;
}
server.close();
console.log(ok ? `all passed; screenshots in ${SHOTS}` : 'FAILED');
process.exitCode = ok ? 0 : 1;
