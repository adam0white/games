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
const { aim, createBed, prune, shadeAt, tick, cue, CUE } = sim;
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

// ---- Players. Each sees the bed only through cue(s), the finger the page draws, at 30 ticks a second.
// careful: does what the finger shows at once. naive: waits until the page would show the finger, takes a
// second to react, and once a kind of finger has worked it does that kind as soon as the situation is back,
// without waiting for the finger again. clumsy: reacts 150 ms late, and 15% of its inputs go wrong (a tap
// lands up to 90 units off; a flick is too slow, so the page reads it as a lamp move to where it ended).
const FPS = 30, campaignSeed = level => 8731 + level * 271;
const fresh = Array.from({ length: 60 }, (_, i) => Math.imul(i + 101, 2246822519) >>> 0);
function lcg(seed) { let x = seed >>> 0 || 1; return () => (x = (Math.imul(1664525, x) + 1013904223) >>> 0) / 4294967296; }
const progress = s => s.arms.filter(a => a.grip >= 0).length + s.arms.filter(a => a.ripe).length + (s.window.reached ? 1 : 0);

function player(kind, seed) {
  const rnd = lcg(seed ^ 0x5bd1e995), learned = new Set(), seen = [];
  let idle = 0, shaded = 0, ready = 0, wait = null, last = null;
  return {
    learned,
    step(s) {
      const c = cue(s);
      seen.push(c);
      if (seen.length > 6) seen.shift();
      idle += 1 / FPS;
      shaded = c?.kind === 'flick' ? shaded + 1 / FPS : 0;
      if (kind === 'careful') return act(s, c);
      if (kind === 'clumsy') {
        // One input at most every 0.6 s, aimed at what the bed showed five ticks (about 150 ms) ago.
        const late = seen[0];
        if (!late || (last && s.time - last.at < 0.6)) return;
        if (late.kind === 'tap' && last?.kind === 'tap' && !last.missed &&
          Math.hypot(late.at.x - last.to.x, late.at.y - last.to.y) < 1) return;
        return act(s, late, rnd() < 0.15);
      }
      // naive
      if (!c) { ready = 0; return; }
      const shown = c.kind === 'flick' ? shaded >= CUE.flickAfter : idle >= CUE.tapIdle;
      ready = shown || learned.has(c.kind) ? ready + 1 / FPS : 0;
      if (ready < 1) return;
      ready = 0;
      act(s, c);
    },
    check(s) {
      if (!wait) return;
      if (wait.kind === 'tap' && progress(s) > wait.before) { learned.add('tap'); wait = null; }
      else if (wait.kind === 'flick' && s.flowers.every(f => f.shade <= 0.38)) { learned.add('flick'); wait = null; }
      else if (s.time > wait.until) wait = null;
    },
  };
  function act(s, c, wrong = false) {
    if (!c) return;
    idle = 0;
    if (c.kind === 'tap') {
      const x = c.at.x + (wrong ? (rnd() * 2 - 1) * 90 : 0), y = c.at.y + (wrong ? (rnd() * 2 - 1) * 90 : 0);
      aim(s, x, y);
      last = { kind: 'tap', to: c.at, missed: wrong, at: s.time };
      wait = { kind: 'tap', before: progress(s), until: s.time + 8 };
    } else if (wrong) {
      aim(s, c.to.x, c.to.y);
      last = { kind: 'flick', missed: true, at: s.time };
    } else {
      prune(s, c.from.x, c.from.y, c.to.x, c.to.y);
      last = { kind: 'flick', at: s.time };
      wait = { kind: 'flick', until: s.time + 3 };
    }
  }
}

function attempt(level, seed, who, limit = 120) {
  const s = createBed(level, seed);
  for (let f = 0; f < limit * FPS && s.status === 'growing'; f++) {
    who.step(s);
    tick(s);
    who.check(s);
  }
  return s;
}
const rate = (kind, level) => fresh.concat(campaignSeed(level)).filter(seed =>
  attempt(level, seed, player(kind, seed + level)).status === 'won').length / (fresh.length + 1);
const pct = r => Math.round(r * 100) + '%';

const careful = [], clumsy = [], naive = [];
for (let level = 1; level <= 10; level++) {
  careful.push(rate('careful', level));
  clumsy.push(rate('clumsy', level));
  naive.push(rate('naive', level));
}
console.log('Careful bot, 61 seeds per bed (60 fresh and the page seed):', careful.map(pct).join(' '));
console.log('Clumsy bot (150 ms late, 15% wrong inputs):', clumsy.map(pct).join(' '));
console.log('Naive bot, following only the finger:', naive.map(pct).join(' '));
careful.forEach((r, i) => assert.ok(r >= 0.85, 'no wall: the careful bot wins bed ' + (i + 1) + ' on 85% of seeds, got ' + pct(r)));
for (let level = 1; level <= 3; level++) assert.ok(clumsy[level - 1] >= 0.85, 'the clumsy bot finishes bed ' + level);

// The naive bot on the page's own beds, in order, with up to three tries a bed and what it learned kept.
let reach = 0, tries = [];
{
  const who = player('naive', 7);
  for (let level = 1; level <= 10; level++) {
    let n = 0, won = false;
    while (n < 3 && !won) { n++; won = attempt(level, campaignSeed(level), who).status === 'won'; }
    tries.push(n);
    if (!won) break;
    reach = level;
  }
  console.log('Naive bot on the page beds: reached bed', reach, 'of 10; tries per bed', tries.join(', '), '; learned', [...who.learned].join(' and '));
}
assert.ok(reach >= 3, 'a player who only follows the finger finishes the first three beds');
for (let level = 1; level <= 10; level++) {
  const who = player('careful', 1);
  assert.equal(attempt(level, campaignSeed(level), who).status, 'won', 'the careful bot finishes page bed ' + level);
}
{
  // How long a beginner has on the beds that open in shade before the first flower wilts, lamp on the window.
  const deadline = [6, 8, 10].map(level => {
    const s = createBed(level, campaignSeed(level));
    aim(s, s.window.x, s.window.y);
    advance(s, 60);
    return level + ': ' + (s.status === 'wilted' ? round(s.time) + ' s' : 'no wilt');
  });
  console.log('Time to wilt with no cut, beds', deadline.join(', '));
}
