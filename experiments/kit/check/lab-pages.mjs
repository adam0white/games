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
};
