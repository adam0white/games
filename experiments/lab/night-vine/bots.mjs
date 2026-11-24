import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = new URL('./sim.js', import.meta.url);
let sim = await import(source);
if (process.argv.includes('--mutate')) {
  const normal = 'const dx = s.lamp.x - tip.x;';
  const reversed = 'const dx = tip.x - s.lamp.x;';
  const code = await readFile(source, 'utf8');
  assert.ok(code.includes(normal), 'phototropism mutation target exists');
  sim = await import('data:text/javascript;base64,' + Buffer.from(code.replace(normal, reversed)).toString('base64'));
}
const { aim, createBed, prune, shadeAt, tick } = sim;
const seeds = Array.from({ length: 24 }, (_, i) => Math.imul(i + 1, 2654435761) >>> 0);
const round = n => Number(n.toFixed(2));

function advance(s, seconds, stop = () => false) {
  for (let i = 0; i < Math.round(seconds * 30) && s.status === 'growing' && !stop(s); i++) tick(s);
}

function harvest(level, seed, endless = false, trim = true) {
  const s = createBed(level, seed, endless);
  for (let frame = 0; frame < 90 * 30 && s.status === 'growing'; frame++) {
    // Follow the markers. Cut across an overhanging bough if its flower darkens.
    if (trim && frame % 30 === 0) {
      for (const f of s.flowers) {
        if (f.stress < 0.25 || f.shade < 0.65) continue;
        const cutX = f.x + 38 * Math.sign(s.nodes[0].x - f.x);
        prune(s, cutX, 353, cutX, 408);
      }
    }
    const target = s.arms.find(arm => !arm.ripe) || s.window;
    aim(s, target.x, target.y);
    tick(s);
  }
  return s;
}

function checkTree(s) {
  s.nodes.forEach((n, i) => {
    assert.ok(Number.isFinite(n.x) && Number.isFinite(n.y));
    assert.ok(n.x >= 0 && n.x <= 360 && n.y >= 0 && n.y <= 440);
    assert.ok(i === 0 ? n.parent === -1 : n.parent >= 0 && n.parent < i);
    if (n.alive && i > 0) assert.ok(s.nodes[n.parent].alive, 'a living shoot connects to its root');
  });
  for (const t of s.tips) assert.ok(s.nodes[t.node].alive, 'a growing tip has living wood');
  for (const a of s.arms) {
    if (a.grip !== -1) {
      const n = s.nodes[a.grip];
      assert.ok(n.alive && Math.hypot(a.x - n.x, a.y - n.y) <= 25, 'tendril contacts its eye');
    }
    if (a.ripe) assert.ok(a.grip >= 0 && a.fruit === 1, 'ripe fruit hangs from an attached shoot');
  }
}

const left = createBed(1, 41), right = createBed(1, 41);
aim(left, 30, 190);
aim(right, 320, 190);
advance(left, 2.5);
advance(right, 2.5);
assert.ok(right.tips[0].x - left.tips[0].x > 50, 'tips bend toward opposing lamps');
const parked = createBed(1, 41);
advance(parked, 60);
assert.equal(parked.status, 'growing', 'an unattended lamp cannot finish the first bed');

const offsets = [-14, -7, 0, 7, 14];
const first = [];
for (const dx of offsets) for (const dy of offsets) {
  const s = createBed(1, 41);
  aim(s, s.window.x + dx, s.window.y + dy);
  advance(s, 59);
  if (s.status === 'won') first.push(s.time);
}
assert.ok(first.length >= 22, 'a thumb landing around the first window can finish in under a minute');
console.log('Opening taps in a 28 by 28 square:', first.length, '/ 25; slowest', round(Math.max(...first)), 's');
console.log('Opposing lamps, 2.5 s:', round(right.tips[0].x - left.tips[0].x), 'units apart');

const maxima = [], untrimmedLosses = [];
for (let level = 1; level <= 10; level++) {
  let slowest = 0, losses = 0;
  for (const seed of seeds) {
    const s = harvest(level, seed);
    checkTree(s);
    assert.equal(s.status, 'won', 'careful bot finishes bed ' + level + ' on seed ' + seed);
    assert.ok(s.window.reached && s.arms.every(a => a.ripe));
    assert.ok(!s.flowers.some(f => f.stress >= 1));
    assert.ok(s.nodes.some((n, i) => i > 14 && n.depth > 0 && n.leaf), 'new laterals put out leaves');
    slowest = Math.max(slowest, s.time);
    if ([6, 8, 10].includes(level)) {
      const untrimmed = harvest(level, seed, false, false);
      if (untrimmed.status === 'wilted') losses++;
    }
  }
  maxima.push(round(slowest));
  if ([6, 8, 10].includes(level)) {
    assert.equal(losses, seeds.length, 'an untrimmed canopy wilts a neighbour in bed ' + level);
    untrimmedLosses.push(losses);
  }
}
console.log('Campaign:', seeds.length, 'wins per bed; slowest seconds:', maxima.join(', '));
console.log('Following the same marks without pruning; wilts in beds 6, 8, 10:', untrimmedLosses.join(', '));

const fruit = createBed(2, 41), arm = fruit.arms[0];
const wood = fruit.nodes.map(n => [n.x, n.y]);
aim(fruit, arm.x, arm.y);
advance(fruit, 30, () => arm.grip >= 0);
assert.ok(arm.grip >= 0 && !arm.ripe, 'the tendril catches before the grapes ripen');
for (const [i, [x, y]] of wood.entries()) assert.deepEqual([fruit.nodes[i].x, fruit.nodes[i].y], [x, y]);
aim(fruit, 35, 55);
const bud = arm.fruit;
advance(fruit, 2);
assert.equal(arm.fruit, bud, 'a distant lamp cannot ripen the grapes');
aim(fruit, arm.x, arm.y);
advance(fruit, 3, () => arm.ripe);
assert.ok(arm.ripe && fruit.status === 'growing', 'ripe grapes still require reaching the window');
assert.equal(prune(fruit, 100, 363, 105, 363), 0, 'a tap does not prune');
const removed = prune(fruit, 24, 365, 337, 365);
assert.ok(removed > 0);
checkTree(fruit);
assert.ok(!arm.ripe && arm.grip === -1 && arm.fruit === 0, 'cut wood loses its tendril and fruit');
aim(fruit, arm.x, arm.y);
advance(fruit, 30, () => arm.ripe);
assert.ok(arm.ripe, 'a new shoot can recover the same trellis');
aim(fruit, fruit.window.x, fruit.window.y);
advance(fruit, 30);
assert.equal(fruit.status, 'won', 'even a low cut supports a full harvest');
console.log('Low flick removed', removed, 'segments; regrown bed finished at', round(fruit.time), 's');

const canopy = createBed(6, 41), flower = canopy.flowers[0];
const shadeBefore = shadeAt(canopy, flower.x, flower.y);
assert.equal(shadeAt(canopy, flower.x, 20), 0, 'leaves do not shade a point above the canopy');
prune(canopy, 226, 353, 226, 408);
const shadeAfter = shadeAt(canopy, flower.x, flower.y);
assert.ok(shadeBefore > 0.75 && shadeAfter < 0.25, 'clearing overhead leaves restores light to the flower');
const stressed = flower.stress;
advance(canopy, 3);
assert.ok(flower.stress < stressed, 'a lit flower recovers');
console.log('Flower shade before and after a flick:', round(shadeBefore), round(shadeAfter));

const spans = [];
for (let span = 1; span <= 12; span++) {
  for (const seed of seeds) {
    const s = harvest(span, (seed + span) >>> 0, true);
    assert.equal(s.status, 'won', 'endless span ' + span + ' on seed ' + seed);
    checkTree(s);
    spans.push(s.time);
  }
}
console.log('Endless:', spans.length, 'spans harvested;', round(Math.min(...spans)), 'to', round(Math.max(...spans)), 's');
const replay = harvest(7, 65537);
assert.deepEqual(replay, harvest(7, 65537), 'identical seed and input reproduce the whole vine');
assert.notDeepEqual(replay.nodes, harvest(7, 65538).nodes, 'the seed changes branching');
console.log('Deterministic replay matched. A different seed grew a different vine.');
