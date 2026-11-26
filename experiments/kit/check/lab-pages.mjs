import assert from 'node:assert/strict';
import { checkDay } from './clock.mjs';

const json = JSON.stringify;
// The UTC day these pages see: their Date is pinned to the run's clock (clock.mjs, `clock: true` below).
const utcDay = checkDay;

// These saves exercise the formats already read by each page. Sharing remains off.
const saves = {
  face: { v: 1, best: 300, runs: 3, stars: [2, 1, 0, 0], sound: true },
  faceBooth: { v: 1, best: 2400, runs: 2, bestStreak: 6, photos: 40 },
  pour: { v: 1, stars: [0, 0, 0, 0, 0, 0, 0, 0], sound: true, tries: 3 },
  bells: { v: 1, stars: [2, 0, 0, 0, 0, 0, 0, 0], best: 120, sound: true, tries: 3, look: 'moon' },
  channels: { unlocked: 3, completed: false, sound: true },
  podwire: { v: 1, next: 2, complete: false, sound: true },
  rubbing: { level: 2, unlocked: 2, sound: true, ink: 'red' },
};

function pageEntry(key, value, hintKey, rest, secondary = {}) {
  const legacy = { [key]: json(value), ...secondary };
  const { hint, ...entry } = rest;
  return { seeds: { ...legacy, [hintKey]: '1' }, saveKey: key, ...entry,
    hint: { key: hintKey, delay: 3000, legacy, ...hint } };
}
function dragTouch(before, moved, points = [[150, 430], [195, 430]]) {
  return async (page, { finger, until }) => {
    const value = await page.evaluate(before);
    await finger(page, '#c', [['pointerdown', ...points[0]], ['pointermove', ...points[1]]]);
    await until(page, moved, 'touch changes game input', 4000, value);
    await finger(page, '#c', [['pointerup', ...points[1]]]);
  };
}
async function ringBell(page, { until }) {
  const count = await page.evaluate(() => {
    const { hits, misses } = window.bellsState();
    return hits + misses;
  });
  await page.tap('#pad0');
  await until(page, n => {
    const { hits, misses } = window.bellsState();
    return hits + misses === n + 1;
  }, 'one touch strikes the bell', 4000, count);
}


async function digChannel(page, { finger, until }) {
  const { remaining, cell, start, bank } = await page.evaluate(() => {
    const { state, geometry } = window.channelView();
    const bounds = document.querySelector('#garden').getBoundingClientRect();
    const point = id => [
      bounds.left + geometry.x + (id % state.cols + .5) * geometry.size,
      bounds.top + geometry.y + (Math.floor(id / state.cols) + .5) * geometry.size,
    ];
    // Both the seeded campaign garden and every daily keep this downhill bank diggable.
    const furrow = state.source + state.cols;
    const cell = furrow + state.cols;
    return { remaining: state.remaining, cell, start: point(furrow), bank: point(cell) };
  });
  await finger(page, '#garden', [['pointerdown', ...start], ['pointermove', ...bank], ['pointerup', ...bank]]);
  await until(page, ({ remaining, cell }) => {
    const { state } = window.channelView();
    return state.remaining === remaining - 1 && state.cells[cell].dug;
  }, 'one touch digs the adjacent bank', 4000, { remaining, cell });
}

async function guideDog(page, { finger, until }) {
  const { left, top, width, height } = await page.locator('#field').evaluate(el => el.getBoundingClientRect().toJSON());
  const x = left + width * .5, y = top + height * .7;
  const before = await page.evaluate(() => window.flockState().game.dog);
  await finger(page, '#field', [['pointerdown', x, y], ['pointermove', x, y - height * .1]]);
  await until(page, ({ x, y }) => {
    const { game, pressed } = window.flockState();
    return game.started && pressed && Math.hypot(game.dog.x - x, game.dog.y - y) >= 1;
  }, 'held touch moves the sheepdog', 4000, before);
  await finger(page, '#field', [['pointerup', x, y - height * .1]]);
}

export async function pointerDrag(page, start, end, { beforeMove, afterMove, flick = false } = {}) {
  const chromium = page.context().browser().browserType().name() === 'chromium';
  const session = chromium ? await page.context().newCDPSession(page) : null;
  // Timestamp the fast gesture so protocol round trips cannot turn it into a slow drag.
  const startTime = flick ? Date.now() / 1000 : null;
  const touch = (type, touchPoints, seconds) => session.send('Input.dispatchTouchEvent', {
    type, touchPoints, timestamp: startTime === null ? undefined : startTime + seconds,
  });
  try {
    // These controls use native pointer capture. WebKit exposes only single-touch taps.
    if (session) await touch('touchStart', [start], 0);
    else { await page.mouse.move(start.x, start.y); await page.mouse.down(); }
    if (beforeMove) await beforeMove();
    if (session) await touch('touchMove', [end], .04);
    else await page.mouse.move(end.x, end.y, { steps: flick ? 1 : 4 });
    if (afterMove) await afterMove();
  } finally {
    if (session) {
      try { await touch('touchEnd', [], .08); } finally { await session.detach(); }
    } else await page.mouse.up();
  }
}

async function pluckWire(page, { until }, depth = 12) {
  const { zones, plucks } = await page.evaluate(() => window.podwireView());
  const [low, high] = zones[0];
  const { left, top, width, height } = await page.locator('#board').evaluate(el => el.getBoundingClientRect().toJSON());
  const x = left + width * (low + high) / 720, y = top + height * 250 / 380;
  await pointerDrag(page, { x, y }, { x, y: y + height * depth / 380 }, {
    beforeMove: () => until(page, () => window.podwireView().grip !== null, 'pointer grips the wire'),
  });
  await until(page, n => window.podwireView().plucks === n + 1, 'releasing the wire plucks it', 4000, plucks);
}

async function openFirstPod(page, checks) {
  await checks.until(page, () => window.podwireView?.().screen === 'play', 'first plate is ready');
  if (await page.evaluate(() => window.podwireView().level) !== 1) return;
  await pluckWire(page, checks, 83);
  await checks.until(page, () => window.podwireView().screen === 'won', 'first pod opens');
}



async function turnPrism(page, { until }) {
  const { x, y, width, height } = await page.locator('#angle').boundingBox();
  const previous = await page.evaluate(() => window.splitlightState().position);
  await page.touchscreen.tap(x + width * .12, y + height / 2);
  await until(page, position => {
    const s = window.splitlightState();
    return s.started && s.position !== position && s.elapsed > 0;
  }, 'touch turns the prism and starts exposure', 8000, previous);
}

export async function fieldPoint(page, width, height) {
  const box = await page.locator('#field').boundingBox();
  return (x, y) => ({ x: box.x + x * box.width / width, y: box.y + y * box.height / height });
}

async function hintPoint(knob) {
  return knob.evaluate(el => {
    const { x, y, width, height } = el.getBoundingClientRect();
    const point = { x: x + width / 2, y: y + height / 2 };
    if (document.elementFromPoint(point.x, point.y)?.id !== 'field') throw new Error('hint is not over the field');
    return point;
  });
}

async function rubPlate(page, { until, knob }) {
  const at = await fieldPoint(page, 240, 280);
  const start = knob ? await hintPoint(knob) : at(20, 140);
  const end = at(220, 140);
  const { coverage, distance } = await page.evaluate(() => window.rubbingState());
  await pointerDrag(page, start, end);
  await until(page, before => {
    const s = window.rubbingState();
    return s.distance > before.distance && s.coverage > before.coverage;
  }, 'stroke transfers pigment', 8000, { coverage, distance });
}

// On Linux Chromium the first touch tap after a scripted touch drag can arrive without its click (reproduced in the
// Playwright image: the same tap lands when repeated). Tap again once if the control did not respond; two silent
// taps still fail the check.
async function tapUntil(page, selector, done, what, until) {
  await page.tap(selector);
  try { await until(page, done, what, 1500); } catch { await page.tap(selector); await until(page, done, what); }
}

async function drawBattleTrail(page, { until }) {
  const [start, end] = await page.evaluate(() => {
    const { point } = window.battleState();
    return [point(7, 18), point(2, 11)];
  });
  await pointerDrag(page, start, end);
  await until(page, () => {
    const s = window.battleState();
    return s.trail.length >= 2 && s.marching > 0;
  }, 'a stroke dispatches ants along its trail');
}

const splitlightLegacy = { 'night-splitlight:plate': '2', 'night-splitlight:sound': 'on' };

export const labPages = {
  'small/wild2-face-shift': pageEntry('wild2-face-shift:save', saves.face, 'wild2-face-shift:hint', {
    // Opens on the first sitter (2026-11-26); the run starts with the first touch on the face.
    clock: true, startsOnBoard: true, menu: '#toMenu', sound: '#sound',
    state: () => { const s = window.faceShiftState?.(); return s && { screen: s.mode, paused: s.mode === 'paused', t: s.state?.elapsed ?? 0 }; },
    verify: () => { const s = window.faceShiftState(); return { saved: s.saved, booth: s.booth, daily: s.daily, line: document.querySelector('#dailyLine').textContent }; },
    expect: { saved: saves.face, booth: saves.faceBooth, daily: { v: 1, day: utcDay, best: 412 }, line: 'Today: best 412' },
    touch: dragTouch(() => window.faceShiftState().state.x, n => window.faceShiftState().state.x > n),
    hint: { delay: 1600, play: '#c', timing: { board: true }, before: () => window.faceShiftState().state.x, moved: n => window.faceShiftState().state.x > n },
  }, { 'wild2-face-shift:booth': json(saves.faceBooth), 'wild2-face-shift:daily': json({ v: 1, day: utcDay, best: 412 }) }),
  'small/wild-pour': pageEntry('wild-pour:save', saves.pour, 'wild-pour:hint', {
    clock: true, menu: '#quit', sound: '#sound2', changed: { 'wild-pour:save': { tries: 1 } },
    state: () => { const s = window.pourState?.(); return s && { ...s, paused: !!s.paused }; },
    verify: () => ({ stars: window.pourState().saved, tries: JSON.parse(localStorage.getItem('wild-pour:save')).tries, sound: document.querySelector('#sound1').textContent, daily: document.querySelector('#dailyBest').textContent }),
    expect: { stars: saves.pour.stars, tries: 3, sound: 'Sound: on', daily: `${utcDay} UTC · Best on this device: 1 from the line · 2 spilled` },
    touch: dragTouch(() => window.pourState().angle, n => window.pourState().angle > n + .02, [[140, 430], [200, 430]]),
    hint: { before: () => window.pourState().angle, moved: n => window.pourState().angle > n + .02 },
  }, { 'wild-pour:daily': json({ v: 1, day: utcDay, off: 1, spilled: 2 }) }),
  'small/night-bells': pageEntry('night-bells:save', saves.bells, 'night-bells:hint', {
    menu: '#quit', sound: '#sound2', changed: { 'night-bells:save': { tries: 1 } },
    state: () => { const s = window.bellsState?.(); return s && { screen: s.screen, t: s.t }; },
    verify: () => ({ save: window.bellsState().saved, play: document.querySelector('#play').ariaLabel }),
    expect: { save: saves.bells, play: 'Play level 2' },
    touch: ringBell,
    hint: { delay: 1600, timing: { start: '#play' }, input: ringBell },
  }),
  'small/night-channels': pageEntry('night-channels:save', saves.channels, 'night-channels:hint', {
    startsOnBoard: true, menu: '#gardens', sound: '#sound',
    state: () => { const s = window.channelView?.(); return s && { screen: s.screen === 'selection' ? 'menu' : s.screen, t: s.state.ticks }; },
    verify: () => {
      const s = window.channelView();
      return { level: s.level, unlocked: s.unlocked, sound: document.querySelector('#sound').getAttribute('aria-pressed') };
    },
    expect: { level: 3, unlocked: 3, sound: 'true' },
    touch: digChannel,
    hint: { delay: 4000, play: '#openList', timing: { start: '#pickDaily' }, input: digChannel,
      start: async page => { await page.click('#openList'); await page.click('#pickDaily'); } },
  }),
  'small/night-podwire': pageEntry('night-podwire:progress', saves.podwire, 'night-podwire:next-hint', {
    startsOnBoard: true, sound: '#sound',
    state: () => { const s = window.podwireView?.(); return s && { screen: s.screen, t: s.time }; },
    verify: () => {
      const s = window.podwireView();
      return { level: s.level, sound: s.sound, completed: document.querySelectorAll('#marks .done').length };
    },
    expect: { level: 2, sound: true, completed: 1 },
    touch: pluckWire,
    hint: { delay: 5500, play: '#board', timing: { result: '#won.on' }, start: openFirstPod,
      input: async (page, { until }) => {
        await page.tap('#next');
        await until(page, () => window.podwireView().level === 2 && window.podwireView().screen === 'play', 'Next opens the second plate');
      } },
  }),
  'small/night-rubbing': pageEntry('night-rubbing:save', saves.rubbing, 'night-rubbing:hint', {
    startsOnBoard: true, sound: '#sound', resumeTouch: true,
    state: () => {
      const s = window.rubbingState?.();
      return s && { screen: s.screen, t: s.distance };
    },
    verify: () => {
      const { level, unlocked, sound } = window.rubbingState();
      return { level, unlocked, sound, ink: document.querySelector('#ink').textContent };
    },
    expect: { level: 2, unlocked: 2, sound: true, ink: 'Red chalk' },
    verifyPaused: async (page, { finger }) => {
      const at = await fieldPoint(page, 240, 280);
      const start = at(20, 170), end = at(220, 170);
      const before = await page.evaluate(() => window.rubbingState());
      await finger(page, '#field', [['pointerdown', start.x, start.y], ['pointermove', end.x, end.y], ['pointerup', end.x, end.y]]);
      assert.deepEqual(await page.evaluate(() => window.rubbingState()), before, 'a paused stroke changes no pigment or distance');
    },
    touch: rubPlate,
    hint: { delay: 2200, play: '#field', timing: { board: true }, input: rubPlate },
  }),
  'small/night-splitlight': {
    startsOnBoard: true, sound: '#sound', soundKey: 'night-splitlight:sound', soundOff: 'off',
    // :best, :daily, :done and :parts were added on 2026-11-24 with the 18-plate bench; they are seeded so a save that
    // has them must survive too.
    seeds: { ...splitlightLegacy, 'night-splitlight:hint': '1', 'night-splitlight:best': '{"1":1}', 'night-splitlight:parts': '1',
      'night-splitlight:daily': '{"day":"2026-11-23","turns":3,"par":2,"seconds":9.5}' },
    state: () => {
      const s = window.splitlightState?.();
      return s && { screen: s.screen, t: s.elapsed };
    },
    verify: () => {
      const { level, sound } = window.splitlightState();
      const today = document.querySelector('#daily').getBoundingClientRect();
      return { level, sound, plate: document.querySelector('#plate').textContent, best: localStorage.getItem('night-splitlight:best'),
        todayButton: today.width >= 44 && today.height >= 44 && today.right <= innerWidth };
    },
    // 'Plate 02 / 06' until 2026-11-24, when the page grew to 18 plates (deliberate; see the page's NOTES).
    expect: { level: 2, sound: true, plate: 'Plate 02 / 18', best: '{"1":1}', todayButton: true },
    touch: turnPrism,
    hint: { key: 'night-splitlight:hint', delay: 2200, play: '#angle', timing: { board: true },
      input: turnPrism, legacy: splitlightLegacy },
  },
  // Cinderhill's tournament toy (lab page, unlisted): a seeded save survives, Send wave walks ants out, pause stops the contest.
  'lab/cinderhill-tournament': {
    sound: '#sound', saveKey: 'cinderhill-tournament:save',
    seeds: { 'cinderhill-tournament:save': JSON.stringify({ v: 1, sound: true, foe: 'jarkeepers', played: 2, won: { jarkeepers: 1 } }), 'cinderhill-tournament:hint': '1' },
    state: () => { const s = window.tournamentState?.(); return s && { screen: s.screen, t: s.t, paused: s.paused }; },
    verify: () => { const s = window.tournamentState(); return { foe: s.foe, played: s.played, sound: s.sound,
      picked: document.querySelector('#foes [aria-pressed=true]')?.dataset.foe, buttons: [...document.querySelectorAll('#foes button')].every(b => b.getBoundingClientRect().height >= 44) }; },
    expect: { foe: 'jarkeepers', played: 2, sound: true, picked: 'jarkeepers', buttons: true },
    touch: async (page, { until }) => {
      const before = await page.evaluate(() => window.tournamentState().me);
      assert.equal(before.out + before.edge + before.ring, 0, 'nobody has left the nest yet');
      const box = await page.locator('#send').boundingBox();
      assert.ok(box.height >= 56 && box.width >= 96, `Send wave is a big target (${box.width} by ${box.height})`);
      await page.tap('#send');
      await until(page, () => { const m = window.tournamentState().me; return m.out + m.edge + m.ring === 10; }, 'Send wave walks ten ants out', 4000);
      await page.tap('#hold');
      await until(page, () => { const m = window.tournamentState().me; return m.out + m.edge === 0; }, 'Hold calls them back', 4000);
    },
  },
  'lab/cinderhill-battle': pageEntry('cinderhill-battle:save', { v: 1, foe: 'jarkeepers', played: 2, sound: true }, 'cinderhill-battle:hint', {
    sound: '#sound', menu: '#quit',
    state: () => { const s = window.battleState?.(); return s && { screen: s.screen, t: s.t, paused: s.paused }; },
    verify: () => {
      const { foe, played, sound } = window.battleState();
      return { foe, played, sound, picked: document.querySelector('#foes [aria-pressed=true]')?.dataset.foe };
    },
    expect: { foe: 'jarkeepers', played: 2, sound: true, picked: 'jarkeepers' },
    touch: async (page, checks) => {
      await drawBattleTrail(page, checks);
      await tapUntil(page, '#alarm', () => document.querySelector('#alarm').getAttribute('aria-pressed') === 'true', 'Alarm is the chosen order', checks.until);
      const spot = await page.evaluate(() => window.battleState().point(7, 13));
      await pointerDrag(page, spot, spot, {
        beforeMove: () => checks.until(page, () => window.battleState().alarm >= 0, 'holding an Alarm spot calls guards'),
      });
      await tapUntil(page, '#recall', () => {
        const s = window.battleState();
        return s.trail.length === 0 && s.alarm < 0 && s.marching === 0;
      }, 'recall clears attack and Alarm orders', checks.until);
    },
    hint: { timing: { start: '#play' }, input: drawBattleTrail },
  }),
};
