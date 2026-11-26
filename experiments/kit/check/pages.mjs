import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { SMALL } from '../../small/catalog.js';
import { fieldPoint, pointerDrag } from './lab-pages.mjs';
import { checkDay } from './clock.mjs';

const stars = (n, first = 2) => [first, ...Array(n - 1).fill(0)];
const saved = (key, value, hint, extra = {}) => ({ [key]: JSON.stringify(value), [hint]: '1', ...extra });

// Night Vine: a tap on the field (or on the first-time hand) moves the lamp and starts growth.
async function moveVineLamp(page, { until, knob }) {
  const box = await page.locator('#field').boundingBox();
  const point = knob ? await knob.evaluate(el => {
    const { x, y, width, height } = el.getBoundingClientRect(), p = { x: x + width / 2, y: y + height / 2 };
    if (document.elementFromPoint(p.x, p.y)?.id !== 'field') throw new Error('hint is not over the field');
    return p;
  }) : { x: box.x + 270 * box.width / 360, y: box.y + 300 * box.height / 480 };
  const { lamp: before, time } = await page.evaluate(() => window.vineState());
  await page.touchscreen.tap(point.x, point.y);
  await until(page, ({ before, time }) => {
    const s = window.vineState();
    return s.started && s.time > time && Math.hypot(s.lamp.x - before.x, s.lamp.y - before.y) > 10;
  }, 'touch moves the lamp and starts growth', 8000, { before, time });
}

// Night Flock (was /lab/night-flock-2/, and keeps that page's storage keys). The dog runs to a held finger,
// lies down under a still one, and goes on an outrun after a sideways flick.
const flockSave = { v: 1, unlocked: 2, best: 31, sound: true, played: true };
const flockStars = { 1: 5 };
const flockDaily = { date: checkDay, stars: 3 }; // the page's Date is pinned to the same moment (clock.mjs)
async function driveFlock(page, { until }) {
  const at = await fieldPoint(page, 360, 520);
  const { x, y } = await page.evaluate(() => window.flockState().game.dog);
  await pointerDrag(page, at(x, y), at(x, y - 65), {
    afterMove: () => until(page, y => {
      const { game, pressed } = window.flockState();
      return game.started && pressed && game.dog.y <= y - 4;
    }, 'held drag moves the dog uphill', 4000, y),
  });
  await until(page, () => !window.flockState().pressed, 'dog releases after the drag');
}
async function commandFlock(page, { until }, command) {
  const at = await fieldPoint(page, 360, 520);
  const { dog, terrain } = await page.evaluate(() => window.flockState().game);
  const start = at(dog.x, dog.y);
  const acted = () => until(page, mode => window.flockState().game.dog.mode === mode, `dog obeys the ${command} command`, 4000, command);
  if (command === 'hold') {
    await pointerDrag(page, start, start, { beforeMove: acted });
    await acted();
    return;
  }
  const direction = Math.sign(terrain.outrun.x - dog.x);
  await pointerDrag(page, start, at(dog.x + direction * 70, dog.y - 5), { flick: true });
  await acted();
  await until(page, () => window.flockState().game.terrain.outrun.gathered, 'the dog gathers the bellwether');
}
// The lie-down lesson appears once sheep wait at the closed cross-gate, so the check first drives them there:
// short drags from the dog to a point below the lowest sheep, on the far side from the gate.
async function flockToGate(page) {
  await page.click('#play');
  const at = await fieldPoint(page, 360, 520);
  for (const end = Date.now() + 45000; Date.now() < end;) {
    const { game, picture } = await page.evaluate(() => window.flockState());
    assert.equal(game.status, 'play', 'the flock reaches the cross-gate before dark');
    if (picture === 'hold' && game.dog.mode !== 'hold') {
      // The sheep must still be waiting a moment after the finger lifts.
      await page.waitForTimeout(300);
      if (await page.evaluate(() => window.flockState().picture === 'hold')) return;
      continue;
    }
    const sheep = game.sheep.filter(s => s.status === 'field'), gate = game.terrain.gate;
    const rear = sheep.reduce((a, b) => a.y > b.y ? a : b);
    const dx = rear.x - gate.x, dy = rear.y - gate.y, far = Math.hypot(dx, dy) || 1;
    const aim = { x: Math.min(330, Math.max(30, rear.x + 18 * dx / far)), y: Math.min(505, rear.y + 18 * dy / far) };
    // Each contact is shorter than the 0.43 s a still finger needs to lay the dog down.
    await pointerDrag(page, at(game.dog.x, game.dog.y), at(aim.x, aim.y), { afterMove: () => page.waitForTimeout(220) });
  }
  assert.fail('sheep wait at the cross-gate');
}
const flockHints = ['drag', 'hold', 'outrun'].map((name, index) => ({
  name, selector: `#hint-${name} + .kit-hint`, key: `night-flock-2:hint-${name}`, canvas: '#field',
  delay: { drag: 6500, hold: 1200, outrun: 2200 }[name],
  ...(name === 'hold' ? { start: flockToGate, timing: { result: '.plate.cue-hold' } } : { timing: { start: '#play' } }),
  seed: { 'night-flock-2:save': JSON.stringify({ ...flockSave, unlocked: index + 1, played: false }) },
  input: name === 'drag' ? driveFlock : (page, checks) => commandFlock(page, checks, name),
}));

// Cinderhill's command-log check (pageRuns 'cinderhill orders'). Pointers are synthetic PointerEvents with their own ids;
// on Chromium a second part sends real touches through the DevTools protocol, so the browser makes the pointer events.
async function cinderhillOrders(page, { base, until }) {
  await page.goto(`${base}/notes/button.js`);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('cinderhill:hint', '1'); });
  await page.goto(`${base}/cinderhill/?ants=500`);
  await until(page, () => window.painter, 'painter script');
  await page.click('#play');
  await until(page, () => window.painter.state().screen === 'play', 'play');
  const ptr = steps => page.evaluate(steps => {
    const el = document.querySelector('#c');
    for (const [type, id, x, y, primary = id === 1] of steps) el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: primary, clientX: x, clientY: y, pressure: type === 'pointerup' || type === 'pointercancel' ? 0 : 0.5, bubbles: true, cancelable: true }));
  }, steps);
  const types = () => page.evaluate(() => window.painter.log().map(o => o.type));
  const { w, h } = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
  const cx = w / 2, cy = h / 2;
  const stroke = (id, x0, y0, dx, dy, n = 4) => Array.from({ length: n }, (_, k) => ['pointermove', id, x0 + dx * (k + 1) / n, y0 + dy * (k + 1) / n]);
  const expected = [];
  const same = async what => {
    assert.deepEqual(await types(), expected, `${what}: the command log holds only the intended orders`);
    assert.equal(await page.evaluate(() => window.painter.state().preview), 0, `${what}: no preview left`);
  };
  // A clean stroke: one trail order on lift.
  await ptr([['pointerdown', 1, cx, cy], ...stroke(1, cx, cy, 20, -120)]);
  assert.deepEqual(await types(), [], 'no order while the finger is down');
  await ptr([['pointerup', 1, cx + 20, cy - 120]]);
  expected.push('trail'); await same('a clean stroke');
  // A pinch mid-stroke, the second finger up first, then the first finger up first.
  for (const firstUp of [2, 1]) {
    await ptr([['pointerdown', 1, cx - 30, cy], ...stroke(1, cx - 30, cy, 0, -40), ['pointerdown', 2, cx + 40, cy - 40],
      ...stroke(1, cx - 30, cy - 40, -30, 20), ...stroke(2, cx + 40, cy - 40, 30, -20)]);
    const other = firstUp === 1 ? 2 : 1;
    await ptr([['pointerup', firstUp, cx, cy], ...stroke(other, cx, cy, 25, 25), ['pointerup', other, cx + 25, cy + 25]]);
    await same(`a pinch mid-stroke, finger ${firstUp} up first`);
  }
  // A two-finger pan mid-stroke.
  await ptr([['pointerdown', 1, cx, cy], ...stroke(1, cx, cy, 0, -40), ['pointerdown', 2, cx + 60, cy - 40], ...stroke(1, cx, cy - 40, 50, 50), ...stroke(2, cx + 60, cy - 40, 50, 50),
    ['pointerup', 1, cx + 50, cy + 10], ['pointerup', 2, cx + 110, cy + 10]]);
  await same('a two-finger pan mid-stroke');
  // pointercancel mid-stroke (the browser took the touch, as for a scroll or a system gesture).
  await ptr([['pointerdown', 1, cx, cy], ...stroke(1, cx, cy, -60, -60), ['pointercancel', 1, cx - 60, cy - 60]]);
  await same('pointercancel mid-stroke');
  // A layer switch mid-stroke; the lift lands on the nest.
  await ptr([['pointerdown', 1, cx, cy], ...stroke(1, cx, cy, 40, -60)]);
  await page.click('#layer'); await until(page, () => window.painter.state().layer === 1, 'the nest layer');
  await ptr([...stroke(1, cx + 40, cy - 60, 20, 20), ['pointerup', 1, cx + 60, cy - 40]]);
  await same('a layer switch mid-stroke');
  await page.click('#layer'); await until(page, () => window.painter.state().layer === 0, 'back on the surface');
  // The page loses focus mid-stroke (a call comes in); the lift arrives after Resume.
  await ptr([['pointerdown', 1, cx, cy], ...stroke(1, cx, cy, -40, -80)]);
  await page.evaluate(() => dispatchEvent(new Event('blur'))); await until(page, () => window.painter.state().paused, 'blur pauses');
  await page.click('#resume'); await until(page, () => !window.painter.state().paused, 'resume');
  await ptr([['pointerup', 1, cx - 40, cy - 80]]);
  await same('a pause mid-stroke');
  // Alarm: a quick pinch gives nothing; a still hold gives a start, and the lift its end.
  await page.click('[data-tool="alarm"]');
  await ptr([['pointerdown', 1, cx, cy], ['pointerdown', 2, cx + 50, cy + 50], ...stroke(1, cx, cy, -30, -30), ...stroke(2, cx + 50, cy + 50, 30, 30)]);
  await page.waitForTimeout(600);
  await ptr([['pointerup', 2, cx + 80, cy + 80]]); await page.waitForTimeout(600); await ptr([['pointerup', 1, cx - 30, cy - 30]]);
  await same('a pinch with the alarm tool');
  await ptr([['pointerdown', 1, cx, cy]]);
  await until(page, () => window.painter.log().length > 1, 'a still hold sounds the alarm', 4000);
  await ptr([['pointerup', 1, cx, cy]]);
  expected.push('alarm', 'alarm'); await same('an alarm hold and lift');
  // Dig on the nest: a pinch gives nothing; a stroke gives dig orders.
  await page.click('#layer'); await until(page, () => window.painter.state().layer === 1, 'the nest layer');
  await page.click('[data-tool="dig"]');
  await ptr([['pointerdown', 1, cx, cy], ...stroke(1, cx, cy, 40, 0), ['pointerdown', 2, cx + 40, cy + 60], ...stroke(1, cx + 40, cy, 20, -20), ['pointerup', 2, cx + 40, cy + 60], ['pointerup', 1, cx + 60, cy - 20]]);
  await same('a pinch with the dig tool');
  await ptr([['pointerdown', 1, cx - 60, cy], ...stroke(1, cx - 60, cy, 120, 0), ['pointerup', 1, cx + 60, cy]]);
  expected.push('dig'); await same('a dig stroke');
  await page.click('#layer'); await until(page, () => window.painter.state().layer === 0, 'back on the surface');
  await page.click('[data-tool="trail"]');
  // Hold: time stops, a stroke still gives an order, queued for the tick that has not run; Go applies it (not late).
  await page.click('#hold'); await until(page, () => window.painter.state().held, 'hold');
  const t0 = await page.evaluate(() => window.painter.state().t);
  await ptr([['pointerdown', 1, cx, cy], ...stroke(1, cx, cy, -30, -100), ['pointerup', 1, cx - 30, cy - 100]]);
  expected.push('trail'); await same('a stroke while time is held');
  await page.waitForTimeout(500);
  const heldOrder = await page.evaluate(() => ({ t: window.painter.state().t, o: window.painter.log().at(-1) }));
  assert.equal(heldOrder.t, t0, 'no tick runs while held');
  assert.equal(heldOrder.o.state, 'queued');
  assert.equal(heldOrder.o.tick, t0);
  await page.evaluate(t0 => { window.__t0 = t0; }, t0);
  await page.click('#hold'); await until(page, () => !window.painter.state().held && window.painter.state().t > window.__t0 + 1, 'Go: time runs again');
  assert.equal(await page.evaluate(() => window.painter.log().at(-1).state), 'applied', 'the held order applied, not late');
  // Real touches (Chromium only): a pinch mid-stroke, then a clean stroke.
  if (page.context().browser().browserType().name() === 'chromium') {
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([id, x, y]) => ({ id, x, y })) });
    await touch('touchStart', [[1, cx, cy]]);
    for (let k = 1; k <= 4; k++) await touch('touchMove', [[1, cx, cy - 12 * k]]);
    await touch('touchStart', [[1, cx, cy - 48], [2, cx + 50, cy]]);
    for (let k = 1; k <= 4; k++) await touch('touchMove', [[1, cx - 8 * k, cy - 48 - 8 * k], [2, cx + 50 + 8 * k, cy + 8 * k]]);
    await touch('touchEnd', [[1, cx - 32, cy - 80]]);
    for (let k = 1; k <= 3; k++) await touch('touchMove', [[1, cx - 32 + 10 * k, cy - 80]]);
    await touch('touchEnd', []);
    await same('a real two-finger pinch mid-stroke');
    await touch('touchStart', [[1, cx, cy]]);
    for (let k = 1; k <= 6; k++) await touch('touchMove', [[1, cx + 5 * k, cy - 20 * k]]);
    await touch('touchEnd', []);
    expected.push('trail'); await same('a real clean stroke');
    await cdp.detach();
  }
  await until(page, () => window.painter.log().every(o => o.state !== 'queued'), 'every order reaches the sim');
  const states = await page.evaluate(() => window.painter.log().map(o => `${o.type}:${o.state}`));
  assert.deepEqual(states, expected.map(t => `${t}:applied`), 'every order applies');
  // WebGL context loss and restore: the page keeps running and draws again.
  if (await page.evaluate(() => window.painter.state().gl)) {
    assert.ok(await page.evaluate(() => window.painter.loseContext()), 'the lose-context extension is there');
    await until(page, () => window.painter.state().glLosses === 1, 'the context is lost');
    const t = await page.evaluate(() => window.painter.state().t);
    await until(page, t => window.painter.state().t > t + 5, 'the sim runs on with no context', 8000, t);
    await page.evaluate(() => window.painter.restoreContext());
    await until(page, () => window.painter.state().glRestored === 1 && window.painter.state().gl, 'the context comes back');
    const d = await page.evaluate(() => window.painter.state().drawn);
    await until(page, d => window.painter.state().drawn > d + 3, 'frames are drawn again after the restore', 8000, d);
  }
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no sideways scroll');
}

export const pages = {
  breath: {
    seeds: saved('breath-save', { v: 1, stars: { 1: 2 }, opened: 2, best: 730, daily: { '2026-11-20': 620 }, runs: 4, sound: true, look: 'paper' }, 'breath:hint'),
    saveKey: 'breath-save', sound: '#sound', menu: '#toMenu',
    state: () => { const s = window.breathState?.(); return s && { ...s, paused: s.screen === 'paused' }; },
    verify: () => { const s = window.breathState(); return [s.opened, s.best, s.sound, document.querySelector('#play').textContent]; },
    expect: [2, 730, true, 'Play level 2'],
    async touch(page, { finger }) {
      await finger(page, '#c', [['pointerdown', 150, 400]]);
      assert.equal(await page.evaluate(() => window.breathState().held), true, 'holding runs');
      await finger(page, '#c', [['pointerup', 150, 400]]);
      assert.equal(await page.evaluate(() => window.breathState().held), false, 'lifting shelters');
    },
    hint: { key: 'breath:hint', delay: 3000, moved: () => window.breathState().held, legacy: { 'breath-save': '{"v":1,"runs":4,"opened":2}' } },
  },
  matchmaker: {
    seeds: saved('matchmaker-save', { v: 1, stars: stars(20), best: 2, sound: true, reputation: [], daily: { '2026-11-20': 3 }, streak: 1, bestStreak: 3, palette: 'night' }, 'matchmaker:hint'),
    saveKey: 'matchmaker-save', sound: '#sound', menu: '#toMenu',
    state: () => { const s = window.matchmakerState?.(); return s && { ...s, t: s.clock }; },
    verify: () => { const s = window.matchmakerState(); return [s.stars, s.best, s.dailyBest, s.sound]; },
    expect: [stars(20), 2, 3, true],
    async touch(page, { finger }) {
      const [a, b] = await page.evaluate(() => { const s = window.matchmakerState(); return [s.boxes[0], s.targets[0]]; });
      await finger(page, '#game', [['pointerdown', a.x + a.w / 2, a.y + a.h / 2], ['pointermove', b.x + b.w / 2, b.y + b.h / 2], ['pointerup', b.x + b.w / 2, b.y + b.h / 2]]);
      assert.equal(await page.evaluate(() => window.matchmakerState().placements[0]), 0, 'a drag places a helper');
    },
    hint: { key: 'matchmaker:hint', delay: 2600, canvas: '#game', moved: () => document.querySelector('#game').hasPointerCapture(1), legacy: { 'matchmaker-save': '{"v":1,"sound":true}' } },
  },
  sling: {
    seeds: saved('sling-save', { v: 1, stars: stars(15), best: 840, days: { '2026-11-20': { seeds: 3, seconds: 19, score: 840 } }, sound: true, look: 'dusk', level: 1, runs: 4 }, 'sling:hint', { 'sling-name': 'seed-check', 'sling-board-id': '11111111-1111-4111-8111-111111111111' }),
    saveKey: 'sling-save', changed: { 'sling-save': { runs: 1 } }, sound: '#sound', menu: '#quit',
    state: () => { const s = window.slingState?.(); return s && { ...s, t: s.seconds, paused: s.screen === 'paused' }; },
    verify: () => window.slingState().save,
    expect: { v: 1, stars: stars(15), best: 840, days: { '2026-11-20': { seeds: 3, seconds: 19, score: 840 } }, sound: true, look: 'dusk', level: 1, runs: 4 },
    async touch(page, { finger }) {
      const n = await page.evaluate(() => window.slingState().state.seeds);
      await finger(page, '#c', [['pointerdown', 200, 400], ['pointermove', 160, 480], ['pointerup', 160, 480]]);
      assert.equal(await page.evaluate(() => window.slingState().state.seeds), n + 1, 'a pull releases a seed');
    },
    hint: { key: 'sling:hint', delay: 3000, moved: () => document.querySelector('#footer').textContent === 'Release to sling', legacy: { 'sling-save': '{"v":1,"runs":4}' } },
  },
  duel: {
    seeds: saved('duel-save', { v: 1, sound: true, matches: 4, friend: { side: 1, run: 2, best: 3 }, solo: { easy: { won: 2, run: 1, best: 2 }, medium: { won: 1, run: 0, best: 1 }, hard: { won: 0, run: 0, best: 0 } } }, 'duel:hint'),
    saveKey: 'duel-save', sound: '#sound2', menu: '#quit',
    state: () => window.duelState?.(),
    verify: () => { const s = window.duelState(); return [s.save.matches, s.save.friend, s.save.solo.easy, s.save.solo.medium, s.sound]; },
    expect: [4, { side: 1, run: 2, best: 3 }, { won: 2, run: 1, best: 2 }, { won: 1, run: 0, best: 1 }, true],
    async touch(page, { finger }) {
      await finger(page, '#c', [['pointerdown', 150, 600]]);
      assert.equal(await page.evaluate(() => window.duelState().held[0]), true, 'bottom finger held');
      await finger(page, '#c', [['pointerup', 150, 600]]);
      assert.equal(await page.evaluate(() => window.duelState().held[0]), false, 'bottom finger lifted');
    },
    hint: { key: 'duel:hint', delay: 3000, moved: () => window.duelState().held[0], legacy: { 'duel-save': '{"v":1,"matches":4}' } },
  },
  harvest: {
    seeds: saved('harvest-save', { v: 1, sound: true, stars: stars(12), best: [25, ...Array(11).fill(0)], runs: 4, daily: { '2026-11-20': 75 }, board: [{ d: '2026-11-20', k: 75 }] }, 'harvest:hint'),
    saveKey: 'harvest-save', sound: '#sound2', menu: '#quit',
    state: () => window.harvestState?.(),
    verify: () => { const s = window.harvestState(); return [s.stars, s.best, s.runs, s.board, s.sound]; },
    expect: [stars(12), [25, ...Array(11).fill(0)], 4, [{ d: '2026-11-20', k: 75 }], true],
    async touch(page, { finger, until }) {
      const p = await page.evaluate(() => { const s = window.harvestState(); return { x: s.view.ox + s.me.x * s.view.c, y: s.view.oy + s.me.y * s.view.c + s.view.lift, before: s.me.x }; });
      await finger(page, '#c', [['pointerdown', p.x, p.y], ['pointermove', p.x + 45, p.y]]);
      await until(page, x => window.harvestState().me.x > x, 'the finger walks right', 8000, p.before);
      await finger(page, '#c', [['pointerup', p.x + 45, p.y]]);
    },
    hint: { key: 'harvest:hint', delay: 3000, moved: () => window.harvestState().finger, legacy: { 'harvest-save': '{"v":1,"runs":4}' } },
    music: { button: '#music2', key: 'harvest-music', on: 'Music: on', off: 'Music: off', hook: () => window.harvestMusic?.() },
  },
  boat: {
    seeds: saved('boat-save', { v: 1, stars: { 1: 2 }, opened: 2, sound: true, daily: { '2026-11-20': 430 }, best: 430, runs: 4 }, 'boat:hint'),
    saveKey: 'boat-save', changed: { 'boat-save': { runs: 1 } }, sound: '#sound', menu: '#toMenu',
    state: () => { const s = window.boatState?.(); return s && { ...s, paused: s.screen === 'paused' }; },
    verify: () => [document.querySelector('#play').textContent, document.querySelector('#bestLine').textContent, window.boatState().sound],
    expect: ['Street 2', '★ 2 / 30  ·  Best stream 430', true],
    async touch(page, { finger }) {
      const p = await page.evaluate(() => window.boatState().boat);
      await finger(page, '#c', [['pointerdown', p.x - 60, p.y - 10], ['pointermove', p.x + 60, p.y - 10], ['pointerup', p.x + 60, p.y - 10]]);
      // The stroke is queued and becomes a ripple on the next simulation step.
      await page.waitForFunction(() => window.boatState().ripples > 0, null, { timeout: 3000 }).catch(() => assert.fail('a swipe makes a ripple'));
    },
    hint: { key: 'boat:hint', delay: 2500, releaseInput: true, before: () => window.boatState().ripples, moved: n => window.boatState().ripples > n, legacy: { 'boat-save': '{"v":1,"opened":2,"best":430}' } },
    music: { button: '#music', key: 'boat-music', on: 'Music: on', off: 'Music: off', hook: () => window.boatMusic?.() },
  },
  flock: {
    clock: true, sound: '#sound', saveKey: 'night-flock-2:save', pausePosition: { x: 8, y: 23 },
    seeds: {
      'night-flock-2:save': JSON.stringify(flockSave),
      'night-flock-2:stars': JSON.stringify(flockStars),
      'night-flock-2:daily': JSON.stringify(flockDaily),
      ...Object.fromEntries(flockHints.map(({ key }) => [key, '1'])),
    },
    state: () => { const s = window.flockState?.(); return s && { screen: s.screen, t: s.game.time }; },
    verify: () => {
      const { saved, stars, mode, game } = window.flockState();
      return { saved, stars, mode, level: game.level, play: document.querySelector('#play').textContent };
    },
    expect: { saved: flockSave, stars: flockStars, mode: 'campaign', level: 2, play: 'Play · Evening 2' },
    verifyPaused: async page => {
      await page.click('#evenings');
      assert.equal(await page.textContent('#record'), 'Daily 2/3 stars · Endless · device best 31');
      await page.click('#back');
    },
    touch: driveFlock,
    hints: flockHints,
    music: { button: '#music', key: 'night-flock-2:music', on: 'Music on', off: 'Music off', hook: () => window.flockMusic?.() },
  },
  // Night Vine (was /lab/night-vine/): the bed waits for the first touch, which places the lamp and starts growth.
  vine: {
    seeds: saved('night-vine:save', { v: 1, unlocked: 3, level: 2, best: 7, sound: true, look: 'cobalt' }, 'night-vine:hint'),
    saveKey: 'night-vine:save', startsOnBoard: true, pause: '#pauseButton', sound: '#sound',
    state: () => { const s = window.vineState?.(); return s && { screen: s.screen === 'pause' ? 'paused' : s.screen, t: s.time }; },
    verify: () => { const { level, unlocked, best } = window.vineState(); return { level, unlocked, best, look: document.body.dataset.look }; },
    expect: { level: 2, unlocked: 3, best: 7, look: 'cobalt' },
    touch: moveVineLamp,
    music: { button: '#music', key: 'night-vine:music', on: 'Music on', off: 'Music off', hook: () => window.vineMusic?.() },
    hint: { key: 'night-vine:hint', delay: 3100, play: '#field', timing: { board: true }, input: moveVineLamp, legacy: { 'night-vine:save': '{"v":1,"unlocked":3,"level":2,"best":7,"sound":true,"look":"cobalt"}' } },
  },
  // Cinderhill's trail painter: one finger on the canvas draws a trail; it becomes an order when the finger lifts.
  cinderhill: {
    seeds: saved('cinderhill:save', { v: 1, sound: true, ants: 500, tapTrail: false }, 'cinderhill:hint'),
    saveKey: 'cinderhill:save', sound: '#sound', menu: '#toMenu',
    state: () => { const s = window.painter?.state(); return s && { screen: s.screen, t: s.t, paused: s.paused }; },
    verify: () => { const s = window.painter.state(); return [s.ants, s.sound, s.tapTrail]; },
    expect: [500, true, false],
    async touch(page, { finger }) {
      const before = await page.evaluate(() => window.painter.log().length);
      const { w, h } = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
      const x = w / 2, y = h / 2;
      await finger(page, '#c', [['pointerdown', x, y], ['pointermove', x + 10, y - 30], ['pointermove', x + 20, y - 70], ['pointermove', x + 30, y - 120]]);
      assert.equal(await page.evaluate(() => window.painter.log().length), before, 'no order while the finger is down');
      assert.ok(await page.evaluate(() => window.painter.state().preview > 0), 'the stroke shows as a preview');
      await finger(page, '#c', [['pointerup', x + 30, y - 120]]);
      const log = await page.evaluate(() => window.painter.log());
      assert.deepEqual(log.slice(before).map(o => o.type), ['trail'], 'lifting the finger gives one trail order');
    },
    hint: { key: 'cinderhill:hint', delay: 3000, moved: () => window.painter.state().preview > 0, legacy: { 'cinderhill:save': '{"v":1,"sound":true,"ants":2000,"tapTrail":false}' } },
  },
};

// The home for the small games (/small/). It is not a game, so it has its own run instead of the save, pause and touch
// contract: both languages, every game link is a page in this checkout and says it came from the home, marks and a
// streak made on the three draft homes carry over, the home never writes a game's own keys, a game opened from it
// comes back with the browser's back, tonight's result card and streak, the first-visit card, and kit/home.js.
const checkoutRoot = new URL('../../../', import.meta.url);
export function linkTarget(href) {
  const path = new URL(href, 'http://x').pathname;
  const file = path.startsWith('/crumbwar/') ? `workers/crumbwar/public${path}index.html` : `experiments${path}index.html`;
  return existsSync(new URL(file, checkoutRoot)) ? file : null;
}
const json = JSON.stringify;
// 2026-11-24: today's pick is Podwire; tonight is Pour, Night Sand, Thankful Garden. Night Bells has one level
// cleared (1 / 24). The rest is what the drafts left: Saltplate opened, a two-night streak up to yesterday, and
// tonight's first stop opened on a draft (no time, so a win reported later can never be counted for it).
const DAY = '2026-11-24';
const smallSeed = {
  'night-bells:save': json({ v: 1, stars: [2, 0, 0, 0, 0, 0, 0, 0], best: 0, sound: true, tries: 1, look: 'amber' }), 'night-bells:hint': '1',
  'hub:opened': json({ 'night-saltplate': '2026-11-20', 'wild-pour': DAY }),
  'hub:c:streak': json({ last: '2026-11-23', run: 2, best: 2 }),
  'hub:c:night': json({ day: DAY, stops: { 'wild-pour': { before: 0 } } }),
  'hf-lab-send-localhost': '1',
};
const smallState = page => page.evaluate(() => window.smallState());
async function smallGo(page, until, base, query = `?lang=en&day=${DAY}`) { await page.goto(`${base}/small/${query}`); await until(page, () => window.smallState, 'home script'); }
export const pageRuns = {
  // Cinderhill's determinism check: the browser runs a short fixed game and must reach the hash Node computes
  // (experiments/cinderhill/quick.js). Then the long run a phone player sends as one line (S2's 12,000 ticks).
  async 'cinderhill check'(page, { base, until }) {
    await page.goto(`${base}/cinderhill/check.html`);
    await page.click('#run');
    await until(page, () => window.cinderhill?.state().result, 'the determinism check finishes', 60000);
    const r = await page.evaluate(() => window.cinderhill.state().result);
    assert.ok(r.same, `this browser's total hash ${r.total} at tick ${r.tick} is not Node's`);
    await page.click('#long');
    await until(page, () => window.cinderhill.state().long, 'the long check finishes', 180000);
    const l = await page.evaluate(() => window.cinderhill.state().long);
    assert.ok(l.same, `the long run's total ${l.total} at tick ${l.tick} is not Node's`);
    assert.match(await page.textContent('#report'), /long SAME/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no sideways scroll');
  },
  // The trail painter's touch rules (02-spec 6.4): a stroke is a local preview and becomes one order when the finger
  // lifts; a second finger, a pointercancel, a layer switch or a pause ends it with no order. Every gesture below that
  // should give no order is followed by a check that the command log did not grow. Then a WebGL context loss and restore.
  'cinderhill orders': cinderhillOrders,
  // The painter's HUD on a narrow phone in Turkish with 5,000 ants and the frame sampler on (?fps=1): no two of the
  // stats line, the crew line, the sampler, the top buttons and the tool strip overlap (owner feedback, 2026-11-26:
  // the sampler covered the other panes on an Android phone).
  async 'cinderhill hud'(page, { base, until }) {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(`${base}/notes/button.js`);
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('cinderhill:hint', '1'); });
    await page.goto(`${base}/cinderhill/?fps=1&ants=5000&lang=tr`);
    await until(page, () => window.painter, 'painter script');
    await page.click('#play');
    await until(page, () => window.painter.state().screen === 'play', 'play');
    // A trail from the middle of the screen, so the crew line has something to say.
    await page.evaluate(() => {
      const el = document.querySelector('#c'), x = innerWidth / 2, y = innerHeight / 2;
      for (const [type, dx, dy] of [['pointerdown', 0, 0], ['pointermove', 20, -20], ['pointermove', 40, -40], ['pointermove', 60, -60], ['pointerup', 60, -60]]) el.dispatchEvent(new PointerEvent(type, { pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: x + dx, clientY: y + dy, pressure: type === 'pointerup' ? 0 : 0.5, bubbles: true, cancelable: true }));
    });
    await until(page, () => document.querySelector('#fps').textContent.includes('fps') && document.querySelector('#crew').textContent.length > 0, 'the sampler and the crew line show', 20000);
    const boxes = await page.evaluate(() => ['#stats', '#crew', '#fps', '#top', '#tools'].map(sel => {
      const r = document.querySelector(sel).getBoundingClientRect();
      return { sel, x0: r.left, y0: r.top, x1: r.right, y1: r.bottom, w: r.width };
    }));
    for (const b of boxes) assert.ok(b.w > 0, `${b.sel} shows`);
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j], over = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0.5 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 0.5;
      assert.ok(!over, `${a.sel} overlaps ${b.sel}: ${JSON.stringify([a, b])}`);
    }
  },
  // ?colony=1: a colony game. The HUD shows sugar, protein and brood in Turkish; the count buttons are hidden and
  // the saved ant count is left alone; the nest view draws the queen and brood (the overlay is not blank there).
  async 'cinderhill colony'(page, { base, until }) {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(`${base}/notes/button.js`);
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('cinderhill:hint', '1'); localStorage.setItem('cinderhill:save', JSON.stringify({ v: 1, sound: true, ants: 500, tapTrail: false })); });
    await page.goto(`${base}/cinderhill/?colony=1&lang=tr`);
    await until(page, () => window.painter, 'painter script');
    assert.ok(await page.evaluate(() => [...document.querySelectorAll('.counts')].every(el => el.hidden)), 'no ant count buttons');
    await page.click('#play');
    await until(page, () => window.painter.state().dayCard === 'dawn', 'the dawn card');
    await page.click('#dayGo');
    await until(page, () => window.painter.state().screen === 'play', 'play');
    await until(page, () => /şeker/.test(document.querySelector('#stats').textContent), 'the colony line', 10000);
    const st = await page.evaluate(() => window.painter.stats());
    assert.equal(st.ants, 20);
    assert.equal(st.colony.queen, 1);
    assert.equal(st.colony.larvae, 4);
    assert.match(await page.textContent('#stats'), /20 karınca · \d+ şeker · 0 protein · yavrular: \d+ yumurta, 4 larva, 0 pupa/);
    await page.evaluate(() => window.painter.setLayer(1));
    await until(page, () => window.painter.state().layer === 1, 'nest view');
    // Each brood item is drawn inside its own cell: some overlay pixel in that cell's square is painted.
    const missing = await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(() => {
      const c = document.querySelector('#c'), g = c.getContext('2d'), k = c.width / innerWidth, out = [];
      for (const [x, y] of window.painter.brood()) {
        const a = window.painter.toScreen(x, y), b = window.painter.toScreen(x + 1, y + 1);
        const w = Math.max(1, Math.round((b.x - a.x) * k)), h = Math.max(1, Math.round((b.y - a.y) * k));
        const d = g.getImageData(Math.round(a.x * k), Math.round(a.y * k), w, h).data;
        let any = false; for (let i = 3; i < d.length; i += 4) if (d[i]) { any = true; break; }
        if (!any) out.push([x, y]);
      }
      done(out);
    }))));
    assert.ok((await page.evaluate(() => window.painter.brood().length)) >= 4, 'the four larvae are there');
    assert.deepEqual(missing, [], 'every brood item is drawn in its cell');
    assert.deepEqual(JSON.parse(await page.evaluate(() => localStorage.getItem('cinderhill:save'))).ants, 500, 'the saved count is untouched');
  },
  // Days (02-spec 6.9) with a 200-tick day: the dawn card shows the goal; at dusk time stops on the dusk card; a restart
  // goes back to the dawn save (tick 0, the same hash); going on starts day 2 with the eased goal after a missed day.
  async 'cinderhill days'(page, { base, until }) {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(`${base}/notes/button.js`);
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('cinderhill:hint', '1'); });
    await page.goto(`${base}/cinderhill/?colony=1&day=200&labRunSource=agent`);
    await until(page, () => window.painter, 'painter script');
    const dawnHash = await page.evaluate(() => window.painter.hashes().total);
    await page.click('#play');
    await until(page, () => window.painter.state().dayCard === 'dawn', 'the dawn card');
    assert.match(await page.textContent('#dayGoal'), /40 loads of food along your trails/);
    assert.equal(await page.evaluate(() => window.painter.state().t), 0, 'no time passes on the dawn card');
    await page.click('#dayGo');
    await until(page, () => window.painter.state().screen === 'play', 'play');
    await until(page, () => /Day 1 · 0 of 40 loads on your trails · dusk in/.test(document.querySelector('#goal').textContent), 'the goal line');
    await until(page, () => window.painter.state().dayCard === 'dusk', 'the dusk card', 30000);
    assert.match(await page.textContent('#dayResult'), /Goal missed/);
    assert.match(await page.textContent('#dayNote'), /Tomorrow: Dig 30 cells of soil/);
    const t0 = await page.evaluate(() => window.painter.state().t);
    assert.equal(t0, 200);
    await page.waitForTimeout(600);
    assert.equal(await page.evaluate(() => window.painter.state().t), t0, 'time stops at dusk');
    assert.deepEqual(await page.evaluate(() => window.painter.dawns()), [1], 'the next dawn is saved when the player goes on');
    await page.click('#dayRestart');
    await until(page, () => window.painter.state().dayCard === 'dawn', 'the dawn card after a restart');
    assert.equal(await page.evaluate(() => window.painter.state().t), 0, 'back at dawn');
    assert.equal(await page.evaluate(() => window.painter.hashes().total), dawnHash, 'the dawn save, hash for hash');
    await page.click('#dayGo');
    await until(page, () => window.painter.state().dayCard === 'dusk', 'dusk again', 30000);
    await page.click('#dayGo');
    await until(page, () => window.painter.state().dayCard === 'dawn', 'the dawn of day 2');
    assert.match(await page.textContent('#dayHead'), /Dawn, day 2/);
    assert.match(await page.textContent('#dayNote'), /a quarter smaller/);
    await page.click('#dayGo');
    await until(page, () => window.painter.state().screen === 'play' && window.painter.day().day === 2, 'day 2 in play');
    assert.deepEqual(await page.evaluate(() => window.painter.dawns()), [2], 'yesterday\'s dawn is let go');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no sideways scroll');
  },
  async small(page, { base, until }) {
    const gameKeys = () => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => !/^(hub:|kit:|hf-lab-)/.test(k)).map(k => [k, localStorage.getItem(k)])));
    await page.goto(`${base}/notes/button.js`);
    await page.evaluate(seed => { localStorage.clear(); sessionStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); }, smallSeed);
    await smallGo(page, until, base);
    const before = await gameKeys();
    let state = await smallState(page);
    assert.equal(state.lang, 'en');
    assert.deepEqual(state.three, ['wild-pour', 'night-sand', 'thankful'], 'tonight is seeded by the day');
    assert.equal(state.pick, 'night-podwire', 'so is the pick');
    assert.deepEqual(state.three.map(slug => SMALL.find(game => game.slug === slug).kind), ['quick', 'think', 'calm'], 'one of each kind');
    assert.ok(!state.three.includes(state.pick), 'the pick is not one of tonight’s three');
    assert.deepEqual(state.links.filter(l => l.where === 'deck').map(l => l.slug).sort(), SMALL.map(game => game.slug).sort(), 'the deck has every small game');
    for (const { href } of state.links) {
      assert.match(href, /\?from=small$/, `${href} says it came from the home`);
      assert.ok(linkTarget(href), `${href} is a page in this checkout`);
    }
    // What the drafts left carries over.
    assert.equal(state.run, '2 nights in a row so far', 'a streak from the drafts carries over');
    assert.equal(await page.getAttribute('#stops li:nth-child(1)', 'class'), 'opened', 'a stop opened on a draft stays opened');
    assert.equal(await page.getAttribute('#stops li:nth-child(2)', 'class'), 'now', 'the next stop is the one to play');
    assert.equal(await page.textContent('.card.night-saltplate .mark'), 'Opened', 'a game opened from a draft is marked');
    assert.equal(await page.textContent('.card.night-bells .mark'), `1 / ${SMALL.find(game => game.slug === 'night-bells').of}`, 'a cleared level shows on the card, out of the game\'s 24 nights');
    assert.equal(SMALL.find(game => game.slug === 'night-bells').of, 24);
    assert.equal(state.intro, false, 'no first-visit card for a player who has played a night');
    // Both languages.
    const noSideways = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    assert.equal(await noSideways(), true, 'no sideways scroll in English');
    const title = await page.textContent('h1');
    await page.click('#lang'); await until(page, () => document.documentElement.lang === 'tr', 'Turkish');
    assert.notEqual(await page.textContent('h1'), title, 'the title is Turkish');
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('[data-i18n]')].filter(el => !el.textContent.trim()).length), 0, 'every string filled in Turkish');
    assert.equal(await noSideways(), true, 'no sideways scroll in Turkish');
    await page.reload(); await until(page, () => window.smallState?.().lang === 'tr', 'Turkish is remembered');
    await page.click('#lang'); await until(page, () => document.documentElement.lang === 'en', 'English again');
    // Taken before a game is opened: the games themselves write their own keys once they load.
    assert.deepEqual(await gameKeys(), before, 'the home wrote no game key');
    // The deck: opens on today's pick; the arrows move it; a side card's tap brings it to the middle and opens nothing.
    assert.equal(state.at, 0, 'the deck opens on today’s pick'); assert.ok(await page.isVisible('.card:first-child .pickTag'));
    await page.click('#next'); await until(page, () => window.smallState().at === 1, 'next card');
    await page.waitForTimeout(500);
    // The edge of the next card that shows at the right of the deck, tapped where it is (no scrolling into view first).
    await page.evaluate(() => document.getElementById('deck').scrollIntoView({ block: 'center' })); await page.waitForTimeout(200);
    const edge = await page.evaluate(() => { const d = document.getElementById('deck').getBoundingClientRect(), c = document.querySelector('.card[data-i="2"]').getBoundingClientRect(); return { x: Math.min(d.right, c.right) - 10, y: c.top + c.height * .8, seen: c.left < d.right }; });
    assert.ok(edge.seen, 'the next card shows at the edge of the deck');
    await page.touchscreen.tap(edge.x, edge.y); await until(page, () => window.smallState().at === 2, 'a side card comes to the middle');
    assert.equal(new URL(page.url()).pathname, '/small/', 'a side card’s tap opens nothing');
    await page.click('#surprise'); await until(page, () => window.smallState().at !== 2, 'surprise moves the deck', 4000);
    await page.waitForTimeout(700);
    const slug = await page.evaluate(() => document.querySelectorAll('.card')[window.smallState().at].classList[1]);
    await smallOpen(page, until, `.card.${slug} a.play`, slug);
    await until(page, s => document.querySelector(`.card.${s} .mark`).textContent !== 'New', 'the opened game is marked after back', 4000, slug);
    // Two quick taps on an arrow, the second while the deck still glides from the first: two cards on, and the deck
    // comes to rest on that card (a glide used to move `at` back to the card it was passing, and WebKit could drop the
    // second smooth scroll).
    await page.evaluate(() => document.getElementById('deck').scrollIntoView({ block: 'center' }));
    const twice = await page.evaluate(() => new Promise(done => {
      const from = window.smallState().at, way = from > 5 ? 'prev' : 'next';
      document.getElementById(way).click(); setTimeout(() => { document.getElementById(way).click(); done(from + (way === 'next' ? 2 : -2)); }, 60);
    }));
    await until(page, n => { const d = document.getElementById('deck'), c = document.querySelectorAll('.card')[n]; return window.smallState().at === n && Math.abs(d.scrollLeft - (c.offsetLeft - (d.clientWidth - c.offsetWidth) / 2)) <= 2; }, 'two quick arrow taps land two cards on', 4000, twice);
    await page.waitForTimeout(400);
    assert.equal((await smallState(page)).at, twice, 'and stay there');
    // Tonight: play the other two stops.
    for (const [i, stop] of [[2, 'night-sand'], [3, 'thankful']]) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await smallOpen(page, until, `li.now a.stop.${stop}`, stop);
      await until(page, n => document.querySelector(`#stops li:nth-child(${n})`).className === 'opened', 'the stop is marked after back', 4000, i);
    }
    await page.waitForSelector('.result');
    state = await smallState(page);
    assert.equal(state.signs, '○○○');
    assert.equal(await page.textContent('.result .big'), 'You played all three.');
    assert.match(await page.textContent('.result'), /3 nights in a row · Best: 3/, 'the streak goes on from the drafts');
    await until(page, () => window.smallState().picture, 'the share picture is made', 8000);
    const picture = await page.evaluate(() => window.smallPicture());
    assert.ok(picture.startsWith('data:image/png') && picture.length > 40000, `a share picture (${picture.length} bytes as text)`);
    const sent = () => page.context().labSent.filter(r => r.game === 'small');
    for (let i = 0; i < 60 && !sent().some(r => r.kind === 'run'); i++) await page.waitForTimeout(100);
    assert.ok(sent().some(r => r.kind === 'run' && JSON.stringify(r).includes('night-done')), 'the finished night is recorded under small');
    // Safari often restores the home from the back-forward cache; the page must read the saves again on pageshow.
    await page.evaluate(() => { const n = JSON.parse(localStorage.getItem('hub:c:night')); n.stops['night-sand'].before = -1; localStorage.setItem('hub:c:night', JSON.stringify(n)); });
    await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
    await until(page, () => document.querySelector('#stops li:nth-child(2) .lamp').textContent === '✦', 'a page restored from the cache redraws its marks');
    // kit/home.js, as a wired game would use it. Opened without ?from=small: no link back.
    await page.goto(`${base}/kit/`);
    assert.equal(await page.evaluate(async () => { const { home } = await import('/kit/home.js'); const d = document.createElement('div'); document.body.append(d); home(null, { back: [d] }); return d.children.length; }), 0, 'no back link when not opened from the home');
    await page.goto(`${base}/kit/?from=small`);
    const back = await page.evaluate(async () => {
      const { home } = await import('/kit/home.js'); const d = document.createElement('div'); document.body.append(d);
      const ends = []; const rec = home({ end: (o) => ends.push(o), start() {}, event() {} }, { back: [d], slug: 'thankful' });
      rec.end('won', { n: 1 });
      home(null, { slug: 'wild-pour' }).end('won'); // tonight's first stop was opened on a draft, with no time
      return { href: d.querySelector('a.kit-home')?.getAttribute('href'), ends, results: JSON.parse(localStorage.getItem('hub:results')) };
    });
    assert.equal(back.href, '/small/', 'opened from the home: a link back');
    assert.deepEqual(back.ends, ['won'], 'the game’s own recorder still gets the end');
    assert.equal(back.results.thankful.wins, 1);
    await smallGo(page, until, base);
    assert.equal((await smallState(page)).signs, '○✦★', 'a win reported by a game shows on tonight’s three; a draft stop never counts a win');
    assert.equal(await page.textContent('.result .big'), 'You won 1 of 3.');
    // The first-visit card: shown to a new player, gone after Start and after a reload.
    await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('hub:')) localStorage.removeItem(k); });
    await smallGo(page, until, base);
    assert.equal((await smallState(page)).intro, true, 'a new player sees the first-visit card');
    await page.waitForTimeout(2400); await page.click('#introOk');
    await until(page, () => !window.smallState().intro, 'Start hides it');
    await page.reload(); await until(page, () => window.smallState && !window.smallState().intro, 'and it stays hidden');
    // The way back from a real game page opened from the home: Pour adds it itself (kit/home.js, since 2026-11-25).
    await page.click('li.now a.stop.wild-pour'); await page.waitForURL(url => url.pathname === '/small/wild-pour/');
    await until(page, () => document.querySelector('#menu .card a.kit-home'), 'Pour shows its own way back');
    assert.equal(await page.evaluate(() => document.querySelectorAll('a.kit-home').length), 2, 'Pour has the way back on its menu and end cards, once each');
    assert.equal(await page.isVisible('#menu .card a.kit-home'), true, 'the back link shows on the game’s menu card');
    await page.locator('#menu .card').screenshot({ path: `/tmp/claude-small-games-home/${page.context().checkName}-back-link.png` }).catch(() => {});
    await page.tap('#menu .card a.kit-home');
    await page.waitForURL(url => url.pathname === '/small/'); await until(page, () => window.smallState, 'back on the home by the link');
    assert.equal(new URL(page.url()).searchParams.get('day'), DAY, 'the link went back in history (the home keeps its address and place)');
    assert.equal(await page.getAttribute('#stops li:nth-child(1)', 'class'), 'opened', 'the home shows the stop opened');
  },
};
async function smallOpen(page, until, selector, slug) {
  await page.click(selector);
  await page.waitForURL(url => url.pathname === `/small/${slug}/`);
  await page.goBack(); await until(page, () => window.smallState, 'back on the home');
}
