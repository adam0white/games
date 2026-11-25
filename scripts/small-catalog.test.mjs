// The small games' home (experiments/small/) shows "n / of" on a game's card. `of` lives in catalog.js; this test
// reads each game's own level count from its code and fails when the two disagree, so a game that gains levels
// cannot leave the home's count behind. It also reads a finished save of each counted game through marks.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// marks.js reads saves through kit/save.js, which uses localStorage; a plain stand-in is enough here.
const store = new Map();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k),
  clear: () => store.clear(), key: i => [...store.keys()][i] ?? null, get length() { return store.size; },
} });
const { SMALL } = await import('../experiments/small/catalog.js');
const { progress } = await import('../experiments/small/marks.js');

const lab = path => import(new URL(`../experiments/small/${path}`, import.meta.url).href);
// Where each game keeps its level count. Exported by the game wherever it is; Night Sand's BEDS has the endless
// garden as bed 0 before its ten numbered beds (night-sand/sim.js), which is how its save counts them.
const COUNTS = {
  'night-bells': async () => (await lab('night-bells/sim.js')).LEVELS,
  'night-channels': async () => (await lab('night-channels/sim.js')).GARDENS,
  'night-podwire': async () => (await lab('night-podwire/sim.js')).plates.length,
  'night-saltplate': async () => (await lab('night-saltplate/sim.js')).LEVELS.length,
  'night-sand': async () => { const { BEDS } = await lab('night-sand/sim.js'); assert.equal(BEDS[0].kind, 'garden', 'Night Sand: bed 0 is the endless garden'); return BEDS.length - 1; },
  'night-splitlight': async () => (await lab('night-splitlight/levels.js')).LEVELS.length,
  'wild-pour': async () => (await lab('wild-pour/sim.js')).LEVELS,
  'night-rubbing': async () => (await lab('night-rubbing/plates.js')).PLATES.length,
};
// Games with no fixed number of levels: the card says "Played" or "Finished", never "n / of".
const UNCOUNTED = new Set(['thankful', 'pitch', 'ring', 'wild2-face-shift']);

test('every small game with levels has the same total in the catalogue as in its own code', async () => {
  for (const game of SMALL) {
    if (UNCOUNTED.has(game.slug)) { assert.equal(game.of, undefined, `${game.slug} has no level count, so no total`); continue; }
    assert.ok(COUNTS[game.slug], `${game.slug}: say where its level count is (COUNTS) or that it has none (UNCOUNTED)`);
    const count = await COUNTS[game.slug]();
    assert.ok(Number.isInteger(count) && count > 0, `${game.slug}: a level count (${count})`);
    assert.equal(game.of, count, `${game.slug}: catalog.js says ${game.of} levels, the game has ${count}`);
  }
});

const ones = n => Array(n).fill(1);
// A save with every level done, in each game's own format (keys as in the games' main.js).
const finished = {
  'night-bells': { 'night-bells:save': { v: 1, stars: ones(8) }, 'night-bells:more': { v: 1, stars: ones(16) } },
  'night-channels': { 'night-channels:save': { unlocked: 30, completed: true }, 'night-channels:gardens': Object.fromEntries(ones(30).map((_, i) => [i + 1, 5])) },
  'night-podwire': { 'night-podwire:progress': { v: 1, next: 6, complete: true }, 'night-podwire:book': { v: 1, reached: 18, done: true } },
  'night-saltplate': { 'night-saltplate:save': { cleared: 18 } },
  'night-sand': { 'night-sand:save': { v: 1, unlocked: 10, level: 10, completed: 10 } },
  'night-splitlight': { 'night-splitlight:plate': 18, 'night-splitlight:done': '1' },
  'wild-pour': { 'wild-pour:save': { v: 1, stars: ones(8) } },
  'night-rubbing': { 'night-rubbing:save': { level: 6, unlocked: 6 }, 'night-rubbing:more': { v: 1, level: 12, unlocked: 12 }, ...Object.fromEntries(ones(12).map((_, i) => [`night-rubbing:proof:${i + 1}`, {}])) },
};
const seed = saves => { store.clear(); for (const [k, v] of Object.entries(saves)) store.set(k, typeof v === 'string' ? v : JSON.stringify(v)); };

test('a finished save reads as finished, with the full count', () => {
  for (const game of SMALL.filter(g => g.of)) {
    seed(finished[game.slug] ?? {});
    assert.deepEqual(progress(game.slug), { score: game.of, of: game.of, finished: true }, `${game.slug} finished`);
  }
});

test('partial saves count what was done, in the formats players have', () => {
  seed({ 'night-bells:save': { v: 1, stars: [2, 0, 0, 0, 0, 0, 0, 0] }, 'night-bells:more': { v: 1, stars: [1, 3, 0] } });
  assert.equal(progress('night-bells').score, 3, 'Night Bells: nights 9 on count, from their own key');
  seed({ 'night-rubbing:save': { level: 2, unlocked: 2 } });
  assert.equal(progress('night-rubbing').score, 1, 'Carbon Cabinet: one print filed');
  seed({ 'wild2-face-shift:save': { v: 1, runs: 2, stars: [1, 0, 0, 0] }, 'wild2-face-shift:booth': { v: 1, runs: 3 } });
  assert.equal(progress('wild2-face-shift').score, 5, 'Face Shift: classic and booth runs both count');
  seed({});
  for (const game of SMALL) assert.equal(progress(game.slug).score, 0, `${game.slug}: nothing saved, nothing counted`);
});
