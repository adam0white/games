import assert from 'node:assert/strict';
import { fieldPoint, pointerDrag } from './lab-pages.mjs';

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
const flockDaily = { date: new Date().toISOString().slice(0, 10), stars: 3 };
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
  },
  flock: {
    sound: '#sound', saveKey: 'night-flock-2:save', pausePosition: { x: 8, y: 23 },
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
  },
  // Night Vine (was /lab/night-vine/): the bed waits for the first touch, which places the lamp and starts growth.
  vine: {
    seeds: saved('night-vine:save', { v: 1, unlocked: 3, level: 2, best: 7, sound: true, look: 'cobalt' }, 'night-vine:hint'),
    saveKey: 'night-vine:save', startsOnBoard: true, pause: '#pauseButton', sound: '#sound',
    state: () => { const s = window.vineState?.(); return s && { screen: s.screen === 'pause' ? 'paused' : s.screen, t: s.time }; },
    verify: () => { const { level, unlocked, best } = window.vineState(); return { level, unlocked, best, look: document.body.dataset.look }; },
    expect: { level: 2, unlocked: 3, best: 7, look: 'cobalt' },
    touch: moveVineLamp,
    hint: { key: 'night-vine:hint', delay: 3100, play: '#field', timing: { board: true }, input: moveVineLamp, legacy: { 'night-vine:save': '{"v":1,"unlocked":3,"level":2,"best":7,"sound":true,"look":"cobalt"}' } },
  },
};
