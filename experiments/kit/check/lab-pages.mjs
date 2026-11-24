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
  podwire: { v: 1, next: 2, complete: false, sound: true },
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

async function pluckWire(page, { until }, depth = 12) {
  const { zones, plucks } = await page.evaluate(() => window.podwireView());
  const [low, high] = zones[0];
  const { left, top, width, height } = await page.locator('#board').evaluate(el => el.getBoundingClientRect().toJSON());
  const x = left + width * (low + high) / 720, y = top + height * 250 / 380;
  const endY = y + height * depth / 380;
  const chromium = page.context().browser().browserType().name() === 'chromium';
  const session = chromium ? await page.context().newCDPSession(page) : null;
  const touch = (type, touchPoints) => session.send('Input.dispatchTouchEvent', { type, touchPoints });
  try {
    // The wire uses native pointer capture. WebKit exposes only single-touch taps.
    if (session) await touch('touchStart', [{ x, y }]);
    else { await page.mouse.move(x, y); await page.mouse.down(); }
    await until(page, () => window.podwireView().grip !== null, 'pointer grips the wire');
    if (session) await touch('touchMove', [{ x, y: endY }]);
    else await page.mouse.move(x, endY, { steps: 4 });
  } finally {
    if (session) {
      try { await touch('touchEnd', []); } finally { await session.detach(); }
    } else await page.mouse.up();
  }
  await until(page, n => window.podwireView().plucks === n + 1, 'releasing the wire plucks it', 4000, plucks);
}

async function openFirstPod(page, checks) {
  await checks.until(page, () => window.podwireView?.().screen === 'play', 'first plate is ready');
  if (await page.evaluate(() => window.podwireView().level) !== 1) return;
  await pluckWire(page, checks, 83);
  await checks.until(page, () => window.podwireView().screen === 'won', 'first pod opens');
}

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
};
