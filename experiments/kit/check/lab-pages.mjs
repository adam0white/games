import assert from 'node:assert/strict';

const json = JSON.stringify;
const now = new Date();
const localDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
const utcDay = now.toISOString().slice(0, 10);
const draftDay = now.toDateString();
const draftBDay = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

// These saves exercise the formats already read by each page. Sharing remains off.
const saves = {
  fp: { best: 24, opened: 1, runs: 3, sound: true, name: '', sharing: false, boardId: '', pendingRemove: '' },
  swarm: { v: 1, best: 24, level: 0, runs: 3, stars: [1, 0, 0, 0, 0, 0, 0, 0], sound: true, look: 'dusk', daily: { [utcDay]: 8 }, name: '', sharing: false, removePending: false, id: '' },
  quests: { v: 1, best: 3, runs: 3, sound: true, memory: { beetle: { visits: 2, failed: true, hearts: 1 }, snail: { visits: 1, failed: false, hearts: 2 } }, secrets: { 'snail-0': 'The pond is quiet.' } },
  spark: { v: 1, best: 1, stars: { 1: 2 }, played: 3 },
  creatures: { sound: true, best: 4, big: false, day: localDay, dayBest: 3 },
  draft: { best: 120, wins: 2, runs: 3, sound: true, daily: { day: draftDay, score: 80 } },
  draftB: { best: 120, bestWave: 2, sound: true, daily: { day: draftBDay, score: 80 } },
  boat: { v: 1, best: 120, stars: [2, 1, 0, 0, 0, 0], runs: 3, sound: true },
  face: { v: 1, best: 300, runs: 3, stars: [2, 1, 0, 0], sound: true },
  pour: { v: 1, stars: [0, 0, 0, 0, 0, 0, 0, 0], sound: true, tries: 3 },
  bells: { v: 1, stars: [2, 0, 0, 0, 0, 0, 0, 0], best: 120, sound: true, tries: 3, look: 'moon' },
  keeper: { v: 1, unlocked: 2, sound: true, played: true, daily: { day: localDay, score: 1400 } },
  channels: { unlocked: 3, completed: false, sound: true },
  flock: { v: 1, unlocked: 2, best: 17, sound: true, played: true },
  flock2: { v: 1, unlocked: 2, best: 31, sound: true, played: true },
  podwire: { v: 1, next: 2, complete: false, sound: true },
  kite: { v: 1, unlocked: 2, level: 2, best: 157, sound: true, look: 'copper' },
  loaves: { unlocked: 2, best: 240, sound: true },
  vine: { v: 1, unlocked: 3, level: 2, best: 7, sound: true, look: 'cobalt' },
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

async function drawKeeperRoute(page, { finger, until }) {
  const points = await page.evaluate(() => {
    const { state: { edges, nodes, keeper }, transform: { scale, ox, oy } } = window.lampState();
    const neighbor = edges.find(([a, b]) => a === keeper.node || b === keeper.node).find(id => id !== keeper.node);
    return [keeper.node, neighbor].map(id => [ox + nodes[id].x * scale, oy + nodes[id].y * scale]);
  });
  await finger(page, '#c', [['pointerdown', ...points[0]], ['pointermove', ...points[1]], ['pointerup', ...points[1]]]);
  await until(page, () => window.lampState().state.events.some(event => event.type === 'route'), 'touch commits a lamp route');
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

async function pointerDrag(page, start, end, { beforeMove, afterMove, flick = false } = {}) {
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

async function moveKiteSpool(page, { until }) {
  const { x, y, width, height } = await page.locator('#field').boundingBox();
  await page.touchscreen.tap(x + width * 220 / 360, y + height * 440 / 520);
  await until(page, () => {
    const { started, hand } = window.kiteState();
    return started && hand.x > 200;
  }, 'touch moves the kite spool right');
}

async function foldDough(page, { until }) {
  const bakery = page.locator('#bakery');
  const { x, y, work } = await bakery.evaluate(el => Object.fromEntries(
    ['x', 'y', 'work'].map(key => [key, Number(el.dataset[key])]),
  ));
  const box = await bakery.boundingBox();
  const point = (u, v) => ({ x: box.x + box.width * u / 360, y: box.y + box.height * v / 490 });
  await pointerDrag(page, point(x - 38, y + 8), point(x + 39, y - 7));
  await until(page, before => {
    const dough = document.querySelector('#bakery').dataset;
    return dough.stage === 'knead' && Number(dough.work) > before && Number(dough.time) > 0;
  }, 'drag kneads the dough', 8000, work);
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

async function steerTide(page, { until }) {
  const { point: [x, y], game: { river }, target, scale } = await page.evaluate(() => window.tideState());
  await pointerDrag(page, { x, y }, { x: x + 40, y });
  await until(page, ({ minimumTarget, minimumX }) => {
    const s = window.tideState();
    return s.target > minimumTarget && s.game.river.x > minimumX;
  }, 'drag steers the boat right', 8000, { minimumTarget: target + 24 / scale, minimumX: river.x + 4 / scale });
}

async function fieldPoint(page, width, height) {
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

const flockHints = ['drag', 'hold', 'outrun'].map((name, index) => ({
  name, selector: `#hint-${name} + .kit-hint`, key: `night-flock-2:hint-${name}`,
  delay: name === 'drag' ? 6500 : 2200, play: '#field', timing: { board: true },
  seed: { 'night-flock-2:save': json({ ...saves.flock2, unlocked: index + 1, played: false }) },
  input: name === 'drag' ? driveFlock : (page, checks) => commandFlock(page, checks, name),
}));
const flockStars = { 1: 5 };
const flockDaily = { date: utcDay, stars: 3 };

async function moveVineLamp(page, { until, knob }) {
  const at = await fieldPoint(page, 360, 480);
  const point = knob ? await hintPoint(knob) : at(270, 300);
  const { lamp: before, time } = await page.evaluate(() => window.vineState());
  await page.touchscreen.tap(point.x, point.y);
  await until(page, ({ before, time }) => {
    const s = window.vineState();
    return s.started && s.time > time && Math.hypot(s.lamp.x - before.x, s.lamp.y - before.y) > 10;
  }, 'touch moves the lamp and starts growth', 8000, { before, time });
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
const tideLegacy = { 'lantern-tide:night': '2', 'lantern-tide:sound': '1' };

export const labPages = {
  'lab/lantern-fp': pageEntry('lantern-fp-save', saves.fp, 'lantern-fp:hint', {
    menu: '#quit', sound: '#sound',
    state: () => { const s = window.lanternFPState?.(); return s && { ...s, t: s.t ?? 0, paused: !!s.paused }; },
    verify: () => { const s = window.lanternFPState(); return { screen: s.screen, best: s.best, opened: s.opened, runs: JSON.parse(localStorage.getItem('lantern-fp-save')).runs, sound: document.querySelector('#sound').textContent }; },
    expect: { screen: 'menu', best: 24, opened: 1, runs: 3, sound: 'Sound: on' },
    touch: dragTouch(() => window.lanternFPState().taps, n => window.lanternFPState().taps > n, [[90, 430], [100, 430]]),
    hint: { delay: 2500, before: () => window.lanternFPState().taps, moved: n => window.lanternFPState().taps > n,
      alive: () => { const s = window.lanternFPSim(); s.safe = 60; s.light = 1; } },
  }),
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
  'lab/ant-swarm': pageEntry('ant-swarm:save', saves.swarm, 'ant-swarm:hint', {
    menu: '#menuBack', sound: '#sound', soundOnMenu: true, changed: { 'ant-swarm:save': { runs: 1 } },
    state: () => { const s = window.swarmState?.(); return s && { ...s, t: s.time, paused: s.screen === 'paused' }; },
    verify: () => window.swarmState().save, expect: saves.swarm,
    touch: dragTouch(() => window.swarmState().paintCount, n => window.swarmState().paintCount > n),
    hint: { before: () => window.swarmState().paintCount, moved: n => window.swarmState().paintCount > n },
  }),
  'lab/ant-quests': pageEntry('ant-quests-save', saves.quests, 'ant-quests:hint', {
    prepare: page => page.route('**/lab-api/quest', route => route.fulfill({ status: 200, json: {
      name: 'Beetle', ask: 'Bring a seed.', thanks: 'Thank you.', scold: 'Try another path.', secret: 'The pond is quiet.',
    } })),
    menu: '#toMenu', sound: '#sound', changed: { 'ant-quests-save': { runs: 1 } },
    state: () => { const s = window.meadowState?.(); return s && { screen: s.mode, paused: s.mode === 'paused', t: s.s?.t ?? 0 }; },
    verify: () => window.meadowState().save, expect: saves.quests,
    touch: dragTouch(() => window.meadowState().s.player.x, n => window.meadowState().s.player.x > n),
    hint: { before: () => window.meadowState().s.player.x, moved: n => window.meadowState().s.player.x > n },
  }),
  'lab/lantern-spark': pageEntry('lantern-spark:save', saves.spark, 'lantern-spark:hint', {
    menu: '#quit', pauseDown: true,
    state: () => { const s = window.echoState?.(); return s && { ...s, paused: !!s.paused }; },
    verify: () => { const s = window.echoState(); return { best: s.best, stars: s.stars, played: JSON.parse(localStorage.getItem('lantern-spark:save')).played, sparkHint: s.sparkHint }; },
    expect: { best: 1, stars: { 1: 2 }, played: 3, sparkHint: false },
    touch: dragTouch(() => window.echoState().target, n => window.echoState().target !== n),
    hint: { delay: 1500, before: () => window.echoState().target, moved: n => window.echoState().target !== n,
      alive: () => { const s = window.echoGame().s; s.safe = 60; s.light = 1; } },
  }, { 'lantern-spark:spark': '1' }),
  'lab/ant-creatures': pageEntry('ant-creatures:v1', saves.creatures, 'ant-creatures:hint', {
    menu: '#paused .toMenu', sound: '#sound', soundOnMenu: true,
    state: () => { const a = window.__ant; return a && { screen: a.mode, paused: a.mode === 'paused', t: a.s?.t ?? 0 }; },
    verify: () => ({ ...window.__ant.save }), expect: saves.creatures,
    touch: dragTouch(() => window.__ant.s.player.x, n => window.__ant.s.player.x > n),
    hint: { moved: () => window.__ant.input.x !== 0 },
  }),
  'lab/ant-draft': pageEntry('ant-draft:save', saves.draft, 'ant-draft:hint', {
    menu: '#quit', sound: '#sound2',
    state: () => { const s = window.antDraftState?.(); return s && { ...s, screen: s.mode, paused: !!s.paused, t: s.t ?? 0 }; },
    verify: () => { const s = window.antDraftState(); return { best: s.best, runs: s.runs, daily: JSON.parse(localStorage.getItem('ant-draft:save')).daily, wins: JSON.parse(localStorage.getItem('ant-draft:save')).wins }; },
    expect: { best: 120, runs: 3, daily: saves.draft.daily, wins: 2 },
    touch: dragTouch(() => window.antDraftState().rally?.x, n => window.antDraftState().rally.x !== n, [[100, 430], [240, 430]]),
    hint: { before: () => window.antDraftState().rally.x, moved: n => window.antDraftState().rally.x !== n },
  }),
  'lab/ant-draft-b': pageEntry('ant-draft-b:save', saves.draftB, 'ant-draft-b:hint', {
    menu: '#quit', sound: '#sound2',
    state: () => { const s = window.antDraftState?.(); return s && { ...s, screen: s.mode, paused: !!s.paused, t: s.t ?? 0 }; },
    verify: () => ({ best: document.querySelector('#best').textContent, sound: document.querySelector('#sound1').textContent, save: JSON.parse(localStorage.getItem('ant-draft-b:save')) }),
    expect: { best: '120', sound: 'Sound: on', save: saves.draftB },
    touch: dragTouch(() => window.antDraftState().rally.x, n => window.antDraftState().rally.x !== n, [[100, 430], [240, 430]]),
    hint: { before: () => window.antDraftState().rally.x, moved: n => window.antDraftState().rally.x !== n },
  }),
  'lab/boat-b': pageEntry('boat-b-save', saves.boat, 'boat-b:hint', {
    menu: '#home', sound: '#sound',
    state: () => { const s = window.boatState?.(); return s && { screen: s.screen, paused: s.screen === 'paused', t: s.sim.t }; },
    verify: () => window.boatState().save, expect: saves.boat,
    touch: dragTouch(() => window.boatState().actions.ripple, n => window.boatState().actions.ripple > n),
    hint: { delay: 1800, before: () => window.boatState().actions.ripple, moved: n => window.boatState().actions.ripple > n },
  }),
  'lab/wild2-face-shift': pageEntry('wild2-face-shift:save', saves.face, 'wild2-face-shift:hint', {
    menu: '#toMenu', sound: '#sound',
    state: () => { const s = window.faceShiftState?.(); return s && { screen: s.mode, paused: s.mode === 'paused', t: s.state?.elapsed ?? 0 }; },
    verify: () => window.faceShiftState().saved, expect: saves.face,
    touch: dragTouch(() => window.faceShiftState().state.x, n => window.faceShiftState().state.x > n),
    hint: { delay: 1600, before: () => window.faceShiftState().state.x, moved: n => window.faceShiftState().state.x > n },
  }),
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
  'lab/night-lamp-keeper': pageEntry('night-lamp-keeper:save', saves.keeper, 'night-lamp-keeper:hint', {
    menu: '#quit', sound: '#sound2',
    state: () => { const s = window.lampState?.(); return s && { screen: s.screen, t: s.state?.t ?? 0 }; },
    verify: () => ({
      save: window.lampState().saved,
      evening: document.querySelector('#levels .current').textContent,
      daily: document.querySelector('#dailyBest').textContent,
    }),
    expect: { save: saves.keeper, evening: '2', daily: 'Today’s best on this device: 1400' },
    touch: drawKeeperRoute,
    hint: { delay: 4500, timing: { start: '#play' }, input: drawKeeperRoute },
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
  'lab/night-flock': pageEntry('night-flock:save', saves.flock, 'night-flock:hint', {
    startsOnBoard: true, menu: '#evenings', sound: '#sound', pausePosition: { x: 8, y: 23 },
    state: () => { const s = window.flockState?.(); return s && { screen: s.screen === 'evenings' ? 'menu' : s.screen, t: s.game.time }; },
    verify: () => ({ save: window.flockState().saved, level: window.flockState().game.level }),
    expect: { save: saves.flock, level: 2 },
    touch: guideDog,
    hint: { delay: 8500, play: '#pause', timing: { start: '#endless' }, input: guideDog,
      start: async page => { await page.click('#pause'); await page.click('#evenings'); await page.click('#endless'); } },
  }),
  'lab/night-flock-2': {
    startsOnBoard: true, sound: '#sound', saveKey: 'night-flock-2:save', pausePosition: { x: 8, y: 23 },
    seeds: {
      'night-flock-2:save': json(saves.flock2),
      'night-flock-2:stars': json(flockStars),
      'night-flock-2:daily': json(flockDaily),
      ...Object.fromEntries(flockHints.map(({ key }) => [key, '1'])),
    },
    state: () => { const s = window.flockState?.(); return s && { screen: s.screen, t: s.game.time }; },
    verify: () => {
      const { saved, stars, mode, game } = window.flockState();
      return { saved, stars, mode, level: game.level };
    },
    expect: { saved: saves.flock2, stars: flockStars, mode: 'campaign', level: 2 },
    verifyPaused: async page => {
      await page.click('#evenings');
      assert.equal(await page.textContent('#record'), 'Daily 2/3 stars · Endless · device best 31');
      await page.click('#back');
    },
    touch: driveFlock,
    hints: flockHints,
  },
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
  'lab/night-kite': pageEntry('night-kite:save', saves.kite, 'night-kite:hint', {
    startsOnBoard: true, sound: '#sound',
    state: () => window.kiteState?.(),
    verify: () => {
      const { level, unlocked, best, sound, look } = window.kiteState();
      return { level, unlocked, best, sound, look };
    },
    expect: { level: 2, unlocked: 2, best: 157, sound: true, look: 'copper' },
    touch: moveKiteSpool,
    hint: { delay: 6500, play: '#field', timing: { board: true }, input: moveKiteSpool },
  }),
  'lab/night-loaves': pageEntry('night-loaves:save', saves.loaves, 'night-loaves:hint', {
    startsOnBoard: true, sound: '#sound',
    state: () => {
      const dough = document.querySelector('#bakery')?.dataset;
      if (!dough?.stage) return null;
      const screen = document.querySelector('#paused.on, #result.on')?.id ?? 'play';
      return { screen, t: Number(dough.time) };
    },
    verify: () => [document.querySelector('#chapter').textContent, document.querySelector('#flour').textContent],
    expect: ['Morning 02 / 08', 'Milk bread'],
    verifyPaused: async page => assert.equal(await page.textContent('#record'), 'Best on this device · 240'),
    touch: foldDough,
    hint: { delay: 3800, play: '#bakery', timing: { board: true }, input: foldDough },
  }),
  'lab/night-vine': pageEntry('night-vine:save', saves.vine, 'night-vine:hint', {
    startsOnBoard: true, pause: '#pauseButton', sound: '#sound',
    state: () => {
      const s = window.vineState?.();
      return s && { screen: s.screen === 'pause' ? 'paused' : s.screen, t: s.time };
    },
    verify: () => {
      const { level, unlocked, best } = window.vineState();
      return { level, unlocked, best, look: document.body.dataset.look };
    },
    expect: { level: 2, unlocked: 3, best: 7, look: 'cobalt' },
    touch: moveVineLamp,
    hint: { delay: 3100, play: '#field', timing: { board: true }, input: moveVineLamp },
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
  'lab/lantern-tide': {
    query: 'check=1', play: '#start', sound: '#sound', soundKey: 'lantern-tide:sound', soundOff: '0',
    start: page => page.tap('#start'),
    seeds: { ...tideLegacy, 'lantern-tide:hint': '1' },
    state: () => {
      const s = window.tideState?.();
      return s && { screen: s.screen, t: s.game.river.t };
    },
    verify: () => {
      const { night, screen } = window.tideState();
      return { night, screen };
    },
    expect: { night: 2, screen: 'ready' },
    touch: steerTide,
    hint: { key: 'lantern-tide:hint', delay: 1500, timing: { start: '#start' },
      input: steerTide, legacy: tideLegacy },
  },
};
