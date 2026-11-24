import assert from 'node:assert/strict';

const stars = (n, first = 2) => [first, ...Array(n - 1).fill(0)];
const saved = (key, value, hint, extra = {}) => ({ [key]: JSON.stringify(value), [hint]: '1', ...extra });

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
      assert.ok(await page.evaluate(() => window.boatState().ripples > 0), 'a swipe makes a ripple');
    },
    hint: { key: 'boat:hint', delay: 2500, releaseInput: true, before: () => window.boatState().ripples, moved: n => window.boatState().ripples > n, legacy: { 'boat-save': '{"v":1,"opened":2,"best":430}' } },
  },
};
