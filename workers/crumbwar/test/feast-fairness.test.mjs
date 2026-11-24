import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../public/crumbwar/shared/config.js';
import { MODES, rankOf } from '../public/crumbwar/shared/modes.js';
import { angleOf } from '../public/crumbwar/shared/move.js';
import { createWorld, addAnt, addFood, setInput, step } from '../src/sim.mjs';
import { think, feastSprint } from '../src/bots.mjs';

const rules = MODES.feast;
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} differs from ${b}`);
function scene() {
  const w = createWorld(71, 'feast');
  w.tick = 2;
  // Keep scheduled/random food outside the controlled encounter.
  for (let i = 0; i < 160; i++) addFood(w, 3100, 2200 + i, 1);
  return w;
}
function ant(w, bot, x = 800, y = 800, mass = 10) {
  const a = addAnt(w, 0, bot, 0, 0);
  Object.assign(a, { x, y, mass, protectUntil: 0 });
  return a;
}

test('Feast food efficiency applies to bots, for both crumbs and cakes', () => {
  for (const kind of [1, 3]) for (const bot of [false, true]) {
    const w = scene(), a = ant(w, bot);
    addFood(w, a.x, a.y, kind);
    const ticks = kind === 3 ? 60 : 1;
    for (let i = 0; i < ticks - 1; i++) step(w);
    if (kind === 3) assert.equal(a.mass, 10, 'cake does not pay before chewing completes');
    step(w);
    near(a.mass - 10, (kind === 3 ? rules.cakeGrowth : rules.crumbGrowth) * (bot ? rules.botGrowth : 1));
    assert.equal(a.delivered, 1);
  }
  assert.ok(rules.botGrowth > 0 && rules.botGrowth < 1, 'bots gain less size from the same food');
});

test('Feast food soft cap reduces both food kinds at the boundary for people and bots', () => {
  assert.ok(rules.foodAboveFactor >= 0 && rules.foodAboveFactor < 1, 'large foragers grow less from food');
  for (const kind of [1, 3]) for (const bot of [false, true]) {
    const cap = bot ? rules.botFoodSoftCap : rules.foodSoftCap;
    for (const mass of [cap - .01, cap, cap + 10]) {
      const w = scene();
      // Isolate the food boundary from shrink while a cake is being chewed.
      w.rules = { ...w.rules, shrink: 0, botShrink: 0 };
      const a = ant(w, bot, 800, 800, mass);
      addFood(w, a.x, a.y, kind);
      for (let i = 0; i < (kind === 3 ? 60 : 1); i++) step(w);
      const ordinary = (kind === 3 ? rules.cakeGrowth : rules.crumbGrowth) * (bot ? rules.botGrowth : 1);
      near(a.mass - mass, mass < cap ? ordinary : ordinary * rules.foodAboveFactor);
      assert.equal(a.delivered, 1);
    }
  }
});

test('Feast food cap uses the size after this tick shrinks it', () => {
  for (const bot of [false, true]) {
    const cap = bot ? rules.botFoodSoftCap : rules.foodSoftCap;
    const w = scene(), a = ant(w, bot, 800, 800, cap);
    const shrunken = cap - Math.max(0, cap - 16) * rules.shrink * C.DT
      - (bot ? Math.max(0, cap - rules.botShrinkAbove) * rules.botShrink * C.DT : 0);
    addFood(w, a.x, a.y, 1);
    step(w);
    assert.ok(shrunken < cap);
    near(a.mass, shrunken + rules.crumbGrowth * (bot ? rules.botGrowth : 1));
  }
});

test('Feast meal efficiency applies to bot eaters without changing victim retention', () => {
  const gains = [];
  for (const bot of [false, true]) {
    const w = scene(), eater = ant(w, bot, 800, 800, 40), victim = ant(w, false, 810, 800, 25);
    const eaterBefore = eater.mass - (eater.mass - 16) * rules.shrink * C.DT
      - (bot ? Math.max(0, eater.mass - rules.botShrinkAbove) * rules.botShrink * C.DT : 0);
    const victimBefore = victim.mass - (victim.mass - 16) * rules.shrink * C.DT;
    step(w);
    assert.equal(victim.alive, false);
    assert.equal(eater.kills, 1);
    near(victim.mass, victimBefore * rules.retain);
    const gain = eater.mass - eaterBefore;
    near(gain, victimBefore * (1 - rules.retain) * rules.gain * (bot ? rules.botGrowth : 1));
    gains.push(gain);
  }
  assert.ok(gains[0] > gains[1], 'a successful person gains more than a successful bot');
});

test('Feast extra shrink starts above the bot threshold and does not affect people', () => {
  for (const mass of [rules.botShrinkAbove - 1, rules.botShrinkAbove, rules.botShrinkAbove + 30]) {
    const masses = [];
    for (const bot of [false, true]) {
      const w = scene(), a = ant(w, bot, 800, 800, mass);
      step(w); masses.push(a.mass);
    }
    const expectedExtra = Math.max(0, mass - rules.botShrinkAbove) * rules.botShrink * C.DT;
    near(masses[0] - masses[1], expectedExtra);
    if (mass > rules.botShrinkAbove) assert.ok(masses[1] < masses[0]);
    else assert.equal(masses[0], masses[1]);
  }
});

test('Feast continuous danger permits a bounded flee burst followed by full recovery', () => {
  const w = scene(), a = ant(w, true), start = 100;
  const burst = rules.botSprintSeconds * C.TICK_HZ;
  const cycle = burst + rules.botRestSeconds * C.TICK_HZ;
  for (let offset = 0; offset < cycle * 2; offset++) {
    w.tick = start + offset;
    assert.equal(feastSprint(w, a), offset % cycle < burst, `flee tick ${offset}`);
  }
  assert.ok(burst > 0 && cycle > burst);
});

test('Feast bot input tires under continuing danger and a brief gap does not refresh its burst', () => {
  const w = scene(), a = ant(w, true, 800, 800, 30);
  const predator = ant(w, false, 800 + rules.botFleeRadius - 10, 800, 60);
  ant(w, false, 700, 800, 20); // A nearby meal must not bypass flee fatigue.
  step(w); // Publish the encounter in the spatial grid.
  w.rand = () => .5;
  const start = 5, burst = rules.botSprintSeconds * C.TICK_HZ;
  const cycle = burst + rules.botRestSeconds * C.TICK_HZ;
  for (let offset = 0; offset < cycle * 2; offset += 5) {
    w.tick = start + offset;
    // Losing sight of the threat for one decision must not erase fatigue.
    const gap = offset === 5;
    predator.protectUntil = gap ? w.tick + 1 : 0;
    think(w, a);
    assert.equal(a.sprint, gap || offset % cycle < burst, `input at flee tick ${offset}`);
    if (!gap) assert.equal(a.move, true, 'the recovering bot keeps walking away');
  }
});

test('Feast hunter chooses edible near-size prey over a closer much smaller ant', () => {
  const w = scene();
  ant(w, false, 3000, 3000); // Hunter temperament uses id 1.
  const hunter = ant(w, true, 800, 800, 60);
  ant(w, false, 740, 800, 60 / rules.botPreyRatio * .6);
  ant(w, false, 900, 800, 60 / rules.eatRatio * .9);
  addFood(w, 800, 900, 1);
  step(w);
  w.tick += (5 - (w.tick + hunter.id) % 5) % 5;
  w.rand = () => .5;
  think(w, hunter);
  assert.ok(Math.cos(angleOf(hunter.angle)) > .99, 'hunter heads east toward the near-size prey');
  assert.equal(hunter.move, true);
  assert.equal(hunter.sprint, true, 'hunting uses sprint without the flee cooldown');
});

test('Feast sprint costs the rules amount only while moving and never takes size below ten', () => {
  for (const bot of [false, true]) for (const move of [false, true]) for (const sprint of [false, true]) {
    const w = scene(), a = ant(w, bot, 800, 800, 15);
    setInput(w, a, 0, move, sprint);
    step(w);
    near(a.mass, 15 - (move && sprint ? (bot ? rules.botSprintCost : rules.sprintCost) * C.DT : 0));
  }
  const w = scene(), a = ant(w, false, 800, 800, 10);
  setInput(w, a, 0, true, true); step(w);
  assert.equal(a.mass, 10);
});

test('Feast bot flees only inside its danger radius', () => {
  for (const delta of [-.01, 0, .01]) {
    const w = scene(), a = ant(w, true, 800, 800, 20);
    ant(w, false, 800 + rules.botFleeRadius + delta, 800, 40);
    addFood(w, 800, 900, 1);
    step(w); w.tick = 20; w.rand = () => .5;
    think(w, a);
    assert.equal(a.sprint, delta < 0, `danger radius offset ${delta}`);
    if (delta < 0) assert.ok(Math.cos(angleOf(a.angle)) < -.99, 'flee away from danger');
    else assert.ok(Math.sin(angleOf(a.angle)) > .99, 'continue foraging outside danger radius');
  }
});

function field(w, count = rules.spawnPeers) {
  const peers = [];
  // Deliberately descending sizes: selection must use size order, not ant ids.
  for (let i = 0; i < count; i++) peers.push(ant(w, true, 300 + i * 80, 300, 20 + (count - i - 1) * 10));
  return peers;
}
function catchupMass(peers) {
  const sizes = peers.filter(a => a.alive).map(a => a.mass).sort((a, b) => a - b);
  return sizes[Math.floor((sizes.length - 1) * rules.spawnQuantile)] * rules.spawnMassFactor;
}

test('Feast person joins near living peers size with synchronized rank and score; bots do not', () => {
  const w = scene(), peers = field(w);
  const dead = ant(w, true, 3100, 3100, 500); dead.alive = false;
  const expected = catchupMass(peers), person = addAnt(w, 0, false, 0, 0);
  near(person.mass, expected);
  assert.equal(person.rank, rankOf(expected));
  assert.equal(person.bestRank, rankOf(expected));
  assert.equal(person.score, Math.floor(expected));
  assert.equal(person.protectUntil - w.tick, rules.protectionSeconds * C.TICK_HZ);
  const bot = addAnt(w, 0, true, 0, 0);
  assert.equal(bot.mass, 10);
  assert.equal(bot.score, 10);
});

test('Feast catchup needs enough living peers and excludes the respawning person', () => {
  const w = scene(); field(w, rules.spawnPeers - 1);
  const dead = ant(w, true, 3100, 3100, 500); dead.alive = false; dead.respawnAt = 9999;
  const person = addAnt(w, 0, false, 0, 0);
  assert.equal(person.mass, 10, 'dead peers do not satisfy the minimum field size');
  person.alive = false; person.mass = 15; person.respawnAt = w.tick + 1;
  step(w);
  assert.equal(person.mass, 15, 'a person does not count themselves toward the peer minimum');
});

test('Feast person respawn catches up without reducing retained size or best rank', () => {
  for (const retained of [15, 200]) {
    const w = scene(), peers = field(w), person = addAnt(w, 0, false, 0, 0);
    Object.assign(person, { alive: false, mass: retained, rank: 0, bestRank: 5, score: 0, respawnAt: w.tick + 1 });
    step(w);
    const expected = Math.max(retained, catchupMass(peers));
    assert.equal(person.alive, true);
    near(person.mass, expected);
    assert.equal(person.rank, rankOf(expected));
    assert.equal(person.bestRank, 5, 'previous best rank survives catchup');
    assert.equal(person.score, Math.floor(expected));
  }
  const w = scene(); field(w);
  const bot = addAnt(w, 0, true, 0, 0);
  Object.assign(bot, { alive: false, mass: 10, respawnAt: w.tick + 1 });
  step(w);
  assert.equal(bot.alive, true);
  assert.equal(bot.mass, 10, 'bots receive no catchup on respawn');
});

test('Feast new round clears every size before catchup can reuse the previous field', () => {
  const w = scene();
  // Exclude food picked up on the reset tick from this reset regression.
  w.rules = { ...w.rules, crumbGrowth: 0, cakeGrowth: 0 };
  const count = Math.max(24, rules.spawnPeers * 2 + 1);
  for (let i = 0; i < count; i++) ant(w, i >= Math.ceil(count / 2), 300 + i * 50, 300, 100);
  for (const a of w.ants) if (a) Object.assign(a, { mass: 100, rank: rankOf(100), bestRank: 5, score: 100 });
  w.tick = w.roundEnd - 1;
  step(w);
  assert.ok(w.breakUntil > w.tick);
  w.tick = w.breakUntil - 1;
  step(w);
  assert.equal(w.round, 2);
  for (const a of w.ants) if (a) {
    assert.equal(a.mass, 10, `ant ${a.id} starts at ten regardless of reset order`);
    assert.equal(a.rank, 0);
    assert.equal(a.bestRank, 0);
    assert.equal(a.score, 10);
  }
});

test('Feast join and respawn catchup respect the size cap even against a maximum-size field', () => {
  const w = scene();
  w.rules = { ...w.rules, shrink: 0, botShrink: 0 };
  for (const a of field(w)) a.mass = 500;
  const person = addAnt(w, 0, false, 0, 0);
  assert.equal(person.mass, 500);
  assert.equal(person.rank, 5);
  assert.equal(person.score, 500);
  Object.assign(person, { alive: false, mass: 10, rank: 0, score: 10, respawnAt: w.tick + 1 });
  step(w);
  assert.equal(person.alive, true);
  assert.equal(person.mass, 500);
  assert.equal(person.rank, 5);
  assert.equal(person.score, 500);
});

test('Feast fairness rules leave Classic and Rush rule objects unchanged', () => {
  assert.deepEqual(MODES.classic, { name: 'classic', id: 0, roundSeconds: 360, breakSeconds: 12, minAnts: 32, colonies: true });
  assert.deepEqual(MODES.rush, { name: 'rush', id: 2, roundSeconds: 120, breakSeconds: 8, minAnts: 32, colonies: true,
    hillRadius: 140, hillEvery: 4, frenzySeconds: 20, goalSkipSeconds: 30, crowdedAt: 120, crowdedSnapEvery: 4 });
});
