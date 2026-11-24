import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const url = new URL('./sim.js', import.meta.url);
let sim = await import(url);
if (process.argv.includes('--mutate')) {
  const original = await readFile(url, 'utf8');
  const match = /export function heatAt\([^)]*\)\s*\{/;
  assert.match(original, match, 'locate the production heat field');
  const isothermal = original.replace(match, '$& return 0.6;');
  sim = await import('data:text/javascript;base64,' + Buffer.from(isothermal).toString('base64'));
}
const { createGame, step, down, move, up, cancel } = sim;
const oven = { x: 245, y: 145 };
const board = { x: 164, y: 356 };
const customer = { x: 67, y: 214 };
const guest = { x: 136, y: 216 };
const position = g => ({ x: g.x, y: g.y });
const rounded = n => n.toFixed(2);

function ticks(g, n) {
  for (let i = 0; i < n; i++) step(g);
}

function waitFor(g, ready, seconds, action) {
  for (let i = 0; !ready(g) && i < seconds * 60; i++) step(g);
  assert.ok(ready(g), action + ' on morning ' + g.level + ', seed ' + g.seed + ', stage ' + g.stage);
}

function stroke(g, from, to, frames = 18, release = true) {
  down(g, from.x, from.y);
  for (let i = 1; i <= frames; i++) {
    move(g, from.x + (to.x - from.x) * i / frames, from.y + (to.y - from.y) * i / frames);
    step(g);
  }
  if (release) up(g);
}

function knead(g) {
  for (let fold = 0; g.stage === 'knead' && fold < 30; fold++) {
    const side = fold % 2 ? 1 : -1;
    stroke(g, { x: g.x + side * 38, y: g.y - 5 }, { x: g.x - side * 33, y: g.y + 12 });
    ticks(g, 6);
  }
  assert.equal(g.stage, 'rise', 'folds move the dough into proofing');
}

function loadOven(g, point = oven) {
  stroke(g, position(g), point, 30);
  assert.equal(g.stage, 'bake', 'the oven accepts the shaped dough');
}

function shape(g) {
  waitFor(g, state => state.stage === 'shape', 30, 'dough proofs');
  stroke(g, { x: g.x - 42, y: g.y }, { x: g.x + 4, y: g.y + 6 });
  assert.ok(g.shaped, 'a tuck after proofing shapes the loaf');
}

function deliver(g, share) {
  const count = g.remaining;
  const before = g.score;
  if (share) ticks(g, 75);
  stroke(g, position(g), share ? guest : customer, 30);
  assert.equal(g.remaining, count - 1, 'one loaf leaves the board');
  assert.ok(g.score > before, 'delivery earns points');
  return g.score - before;
}

function play(level, seed) {
  const g = createGame(level, seed);
  knead(g);
  shape(g);
  loadOven(g);
  waitFor(g, s => s.brown >= 0.72, 30, 'bread turns golden');
  stroke(g, position(g), board, 24);
  assert.equal(g.stage, 'serve', 'a golden loaf can be served');
  assert.ok(g.batchSize >= 2, 'each bake supplies the counter and the last guest');
  while (g.remaining > 1) deliver(g, false);
  const sale = structuredClone(g);
  ticks(sale, 75);
  const salePoints = deliver(sale, false);
  const giftPoints = deliver(g, true);
  assert.equal(g.stage, 'done');
  assert.equal(sale.stage, 'done');
  assert.equal(g.served, g.batchSize);
  assert.ok(giftPoints > salePoints, 'the same last loaf earns more when shared');
  return { g, giftPoints, salePoints };
}

const untouched = createGame(1, 1);
ticks(untouched, 61 * 60);
assert.equal(untouched.stage, 'knead', 'waiting alone cannot finish a morning');
assert.equal(untouched.score, 0);
down(untouched, 12, 25);
move(untouched, 250, 150);
up(untouched);
assert.equal(untouched.work, 0, 'a swipe that starts off the dough does no work');

// Compare opposite points on the rim. Distances survive translation and rotation.
function span(g, a, b) {
  return Math.hypot(g.nodes[a].x - g.nodes[b].x, g.nodes[a].y - g.nodes[b].y);
}
const probe = createGame(1, 19);
const left = probe.nodes.reduce((k, p, i, nodes) => p.x < nodes[k].x ? i : k, 0);
const right = probe.nodes.reduce((k, p, i, nodes) => p.x > nodes[k].x ? i : k, 0);
const initial = span(probe, left, right);
const rim = probe.nodes.map(({ x, y }) => ({ x, y }));
const displacement = i => Math.hypot(probe.nodes[i].x - rim[i].x, probe.nodes[i].y - rim[i].y);
const edge = { x: probe.nodes[left].x + 3, y: probe.nodes[left].y };
stroke(probe, edge, { x: edge.x + 38, y: edge.y + 12 }, 16, false);
const pressed = span(probe, left, right);
assert.ok(initial - pressed > 8, 'an inward press visibly shortens the diameter');
assert.ok(displacement(left) > displacement(right) + 8, 'the held side takes the crease');
assert.ok(displacement((left + 1) % rim.length) > 2, 'the fold carries adjacent skin with it');
assert.ok(probe.dust.length > 0, 'working flour releases particles');
cancel(probe);
ticks(probe, 2);
const early = span(probe, left, right);
assert.ok(initial - early > 2, 'the print of the press survives release');
ticks(probe, 150);
const recovered = span(probe, left, right);
assert.ok(Math.abs(initial - recovered) < (initial - pressed) * 0.5, 'the rim recovers over time');
console.log('Rim span in board units: rest / press / two ticks after release / settled:',
  [initial, pressed, early, recovered].map(rounded).join(' / '));

assert.equal(probe.dust.length, 0, 'the flour settles after the stroke');
const stretch = createGame(1, 19);
stroke(stretch, edge, { x: edge.x - 26, y: edge.y - 4 }, 20, false);
assert.ok(span(stretch, left, right) > initial + 8, 'an outward pull stretches the skin');
console.log('Outward pull width:', rounded(span(stretch, left, right)));

function signedArea(g) {
  return g.nodes.reduce((sum, p, i, nodes) => {
    const q = nodes[(i + 1) % nodes.length];
    return sum + p.x * q.y - q.x * p.y;
  }, 0) / 2;
}

const turn = (a, b, p) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
function cross(a, b, c, d) {
  if (Math.max(a.x, b.x) < Math.min(c.x, d.x) || Math.max(c.x, d.x) < Math.min(a.x, b.x)
    || Math.max(a.y, b.y) < Math.min(c.y, d.y) || Math.max(c.y, d.y) < Math.min(a.y, b.y)) return false;
  return turn(a, b, c) * turn(a, b, d) <= 0 && turn(c, d, a) * turn(c, d, b) <= 0;
}

function crossedSkin(nodes) {
  const n = nodes.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // first and last share an endpoint
      if (cross(nodes[i], nodes[(i + 1) % n], nodes[j], nodes[(j + 1) % n])) return true;
    }
  }
  return false;
}

// Use the same 77-unit reach as the phone check. Continue sampling while the
// thumb is still and after lift, when momentum can drive a second collapse.
let foldMin = 1, crossingFrames = 0, foldFrames = 0;
for (const level of [1, 4, 8]) {
  for (const seed of [1, 19, 50267]) {
    for (const direction of [-1, 1]) {
      const g = createGame(level, seed);
      const rest = signedArea(g);
      const x = g.x - direction * 38, y = g.y + 8;
      down(g, x, y);
      for (let frame = 1; frame <= 96; frame++) {
        if (frame <= 16) move(g, x + direction * 77 * frame / 16, y - 15 * frame / 16);
        if (frame === 37) up(g);
        step(g);
        foldMin = Math.min(foldMin, signedArea(g) / rest);
        if (crossedSkin(g.nodes)) crossingFrames++;
        foldFrames++;
      }
    }
  }
}
console.log('Hard fold minimum signed area:', (foldMin * 100).toFixed(2) + '%; frames with rim crossings:',
  crossingFrames + '/' + foldFrames);
assert.ok(foldMin >= 0.65, 'a cross-centre press retains at least 65% of the signed skin area');
assert.equal(crossingFrames, 0, 'non-adjacent skin segments stay apart throughout the fold and recovery');

const proofing = createGame(3, 318);
knead(proofing);
const warm = structuredClone(proofing);
const cool = structuredClone(proofing);
stroke(warm, position(warm), { x: 245, y: 258 }, 24);
stroke(cool, position(cool), { x: 65, y: 407 }, 24);
assert.equal(warm.stage, 'rise');
assert.equal(cool.stage, 'rise');
const small = signedArea(warm);
const before = warm.time;
ticks(warm, 60);
ticks(cool, 60);
console.log('Proof after moving to the hearth and cold bench:', rounded(warm.proof), '/', rounded(cool.proof));
assert.ok(warm.proof > cool.proof + 0.02, 'the real heat field accelerates fermentation near the oven');
waitFor(warm, s => s.stage === 'shape', 25, 'warm dough rises');
waitFor(cool, s => s.stage === 'shape', 25, 'cool dough rises');
ticks(warm, 30);
assert.ok(signedArea(warm) > small * 1.1, 'the proofed silhouette has at least ten percent more area');
console.log('Warm / cool proof completion (s from placement):', rounded(warm.time - before - 0.5),
  '/', rounded(cool.time - before), 'area growth:', rounded(signedArea(warm) / small));

const control = createGame(1, 43);
knead(control);
shape(control);
loadOven(control);
const hot = structuredClone(control), shelf = structuredClone(control);
stroke(hot, position(hot), { x: 245, y: 145 }, 20);
stroke(shelf, position(shelf), { x: 187, y: 107 }, 20);
const hotAtStart = hot.brown, shelfAtStart = shelf.brown;
ticks(hot, 120);
ticks(shelf, 120);
const centreGain = hot.brown - hotAtStart, shelfGain = shelf.brown - shelfAtStart;
assert.ok(centreGain > shelfGain + 0.01, 'the oven centre browns the same dough faster than the outer shelf');
console.log('Two-second browning at centre / shelf:', rounded(centreGain), '/', rounded(shelfGain));
const unattended = structuredClone(control);
ticks(control, 15);
stroke(control, position(control), board);
assert.equal(control.stage, 'shape', 'a pale loaf comes back for more oven time');
assert.ok(control.shaped && control.remaining > 0);
loadOven(control);
waitFor(control, s => s.brown >= 0.72, 30, 'reloaded loaf browns');
stroke(control, position(control), board);
assert.equal(control.stage, 'serve');
const initialBatch = control.remaining;
stroke(control, position(control), guest, 20);
assert.equal(control.remaining, initialBatch, 'the guest only takes the very last loaf');
while (control.remaining > 1) deliver(control, false);
stroke(control, position(control), guest, 15);
assert.equal(control.remaining, 1, 'a handoff before the late arrival returns to the bench');
down(control, control.x, control.y);
move(control, customer.x, customer.y);
cancel(control);
assert.deepEqual(position(control), board, 'cancelling a handoff returns the loaf');
assert.equal(control.remaining, 1);
waitFor(unattended, s => s.stage === 'burnt', 35, 'unattended loaf burns');
assert.equal(unattended.score, 0);
console.log('Pale pull rebaked to', rounded(control.brown), 'and unattended bake burnt at', rounded(unattended.brown));

const seeds = [3, 51, 978, 50267, 0xa18492df];
for (const level of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 28]) {
  const runs = seeds.map(seed => play(level, seed));
  const times = runs.map(({ g }) => g.time);
  if (level === 1) {
    assert.ok(Math.max(...times) < 60, 'a single-thumb introductory batch finishes within a minute');
    assert.deepEqual(play(level, seeds[0]), runs[0], 'the same seed and gestures replay exactly');
    assert.notDeepEqual(createGame(1, seeds[0]).nodes, createGame(1, seeds[1]).nodes,
      'different seeds produce different dough');
  }
  console.log('Morning', level, runs.length + '/' + runs.length, 'complete;',
    Math.min(...times).toFixed(2) + '–' + Math.max(...times).toFixed(2) + ' s;',
    runs[0].g.batchSize, 'loaves; last gift', runs[0].giftPoints, '/ sale', runs[0].salePoints);
}
