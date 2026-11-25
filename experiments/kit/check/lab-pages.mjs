import assert from 'node:assert/strict';

const json = JSON.stringify;
const now = new Date();
const localDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
const utcDay = now.toISOString().slice(0, 10);

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
function offlineSocket() {
  if (!location.pathname.startsWith('/lab/lantern-race/')) return;
  window.WebSocket = class {
    static OPEN = 1;
    constructor() { this.readyState = 0; queueMicrotask(() => this.onerror?.({ type: 'error' })); }
    close() { this.readyState = 3; }
    send() { throw new Error('offline race fixture cannot send'); }
  };
}
async function raceStart(page) {
  await page.addInitScript(offlineSocket);
  await page.evaluate(offlineSocket);
  await page.click('#quick');
  await page.waitForFunction(() => window.raceState().offline);
  await page.click('#ready');
  await page.waitForFunction(() => window.raceState().phase === 'race', null, { timeout: 12000 });
  assert.equal(await page.evaluate(() => window.raceState().offline), true, 'offline race uses the pausable local clock');
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

const splitlightLegacy = { 'night-splitlight:plate': '2', 'night-splitlight:sound': 'on' };

export const labPages = {
  'lab/lantern-race': {
    seeds: { 'lantern-race-best': '100000', 'lantern-race-sound': '1', 'lantern-race-name': 'Test boat', 'lantern-race-played': '1', 'lantern-race:hint': '1' },
    play: '#quick', start: raceStart, menu: '#paused .toMenu', sound: '#sound', soundKey: 'lantern-race-sound', soundOff: '0',
    state: () => { const s = window.raceState?.(); return s && { ...s, screen: s.phase === 'race' ? 'play' : s.phase, paused: s.phase === 'paused' }; },
    verify: () => ({ best: window.raceState().best, name: document.querySelector('#name').value, sound: document.querySelector('#sound').textContent, played: localStorage.getItem('lantern-race-played') }),
    expect: { best: 100000, name: 'Test boat', sound: 'Sound: on', played: '1' },
    touch: dragTouch(() => window.raceState().target, n => window.raceState().target !== n),
    hint: { key: 'lantern-race:hint', delay: 1500, start: raceStart, before: () => window.raceState().target, moved: n => window.raceState().target !== n,
      legacy: { 'lantern-race-best': '100000', 'lantern-race-sound': '1', 'lantern-race-name': 'Test boat', 'lantern-race-played': '1' } },
  },
  'lab/wild2-face-shift': pageEntry('wild2-face-shift:save', saves.face, 'wild2-face-shift:hint', {
    menu: '#toMenu', sound: '#sound',
    state: () => { const s = window.faceShiftState?.(); return s && { screen: s.mode, paused: s.mode === 'paused', t: s.state?.elapsed ?? 0 }; },
    verify: () => { const s = window.faceShiftState(); return { saved: s.saved, booth: s.booth, daily: s.daily, line: document.querySelector('#dailyLine').textContent }; },
    expect: { saved: saves.face, booth: saves.faceBooth, daily: { v: 1, day: utcDay, best: 412 }, line: 'Today: best 412' },
    touch: dragTouch(() => window.faceShiftState().state.x, n => window.faceShiftState().state.x > n),
    hint: { delay: 1600, before: () => window.faceShiftState().state.x, moved: n => window.faceShiftState().state.x > n },
  }, { 'wild2-face-shift:booth': json(saves.faceBooth), 'wild2-face-shift:daily': json({ v: 1, day: utcDay, best: 412 }) }),
  'lab/wild-pour': pageEntry('wild-pour:save', saves.pour, 'wild-pour:hint', {
    menu: '#quit', sound: '#sound2', changed: { 'wild-pour:save': { tries: 1 } },
    state: () => { const s = window.pourState?.(); return s && { ...s, paused: !!s.paused }; },
    verify: () => ({ stars: window.pourState().saved, tries: JSON.parse(localStorage.getItem('wild-pour:save')).tries, sound: document.querySelector('#sound1').textContent, daily: document.querySelector('#dailyBest').textContent }),
    expect: { stars: saves.pour.stars, tries: 3, sound: 'Sound: on', daily: `${utcDay} UTC · Best on this device: 1 from the line · 2 spilled` },
    touch: dragTouch(() => window.pourState().angle, n => window.pourState().angle > n + .02, [[140, 430], [200, 430]]),
    hint: { before: () => window.pourState().angle, moved: n => window.pourState().angle > n + .02 },
  }, { 'wild-pour:daily': json({ v: 1, day: utcDay, off: 1, spilled: 2 }) }),
  'lab/night-bells': pageEntry('night-bells:save', saves.bells, 'night-bells:hint', {
    menu: '#quit', sound: '#sound2', changed: { 'night-bells:save': { tries: 1 } },
    state: () => { const s = window.bellsState?.(); return s && { screen: s.screen, t: s.t }; },
    verify: () => ({ save: window.bellsState().saved, play: document.querySelector('#play').ariaLabel }),
    expect: { save: saves.bells, play: 'Play level 2' },
    touch: ringBell,
    hint: { delay: 1600, timing: { start: '#play' }, input: ringBell },
  }),
  'lab/night-channels': pageEntry('night-channels:save', saves.channels, 'night-channels:hint', {
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
  'lab/night-podwire': pageEntry('night-podwire:progress', saves.podwire, 'night-podwire:next-hint', {
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
  'lab/night-rubbing': pageEntry('night-rubbing:save', saves.rubbing, 'night-rubbing:hint', {
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
  'lab/night-splitlight': {
    startsOnBoard: true, sound: '#sound', soundKey: 'night-splitlight:sound', soundOff: 'off',
    seeds: { ...splitlightLegacy, 'night-splitlight:hint': '1' },
    state: () => {
      const s = window.splitlightState?.();
      return s && { screen: s.screen, t: s.elapsed };
    },
    verify: () => {
      const { level, sound } = window.splitlightState();
      return { level, sound, plate: document.querySelector('#plate').textContent };
    },
    expect: { level: 2, sound: true, plate: 'Plate 02 / 06' },
    touch: turnPrism,
    hint: { key: 'night-splitlight:hint', delay: 2200, play: '#angle', timing: { board: true },
      input: turnPrism, legacy: splitlightLegacy },
  },
};
