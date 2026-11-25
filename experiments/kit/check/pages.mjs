import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { SMALL } from '../../small/catalog.js';
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
// cleared (1 / 8). The rest is what the drafts left: Saltplate opened, a two-night streak up to yesterday, and
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
    assert.equal(await page.textContent('.card.night-bells .mark'), '1 / 8', 'a cleared level shows on the card');
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
    // The way back from a real game page opened from the home, as a wired game would add it (game files untouched).
    await page.click('li.now a.stop.wild-pour'); await page.waitForURL(url => url.pathname === '/lab/wild-pour/');
    await page.evaluate(async () => { const { home } = await import('/kit/home.js'); home(null, { back: ['#menu .card'] }); });
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
  await page.waitForURL(url => url.pathname === `/lab/${slug}/`);
  await page.goBack(); await until(page, () => window.smallState, 'back on the home');
}
