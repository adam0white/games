import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const file = new URL('./sim.js', import.meta.url);
let sim = await import(file);
if (process.argv.includes('--mutate')) {
  const code = await readFile(file, 'utf8');
  const barrier = "const solid = grain < 5 ? 0 : 2;";
  assert.ok(code.includes(barrier), 'could not locate mesh collision rule');
  const broken = code.replace(barrier, 'const solid = 2;');
  sim = await import('data:text/javascript;base64,' + Buffer.from(broken).toString('base64'));
}

const { W, H, create, step, press, move, release } = sim;
function wait(s, ticks) { for (let i = 0; i < ticks && s.status === 'play'; i++) step(s); }
function stroke(s, x, y, toX, toY, ticks = 14) {
  press(s, x, y);
  for (let j = 1; j <= ticks; j++) {
    move(s, x + (toX - x) * j / ticks, y + (toY - y) * j / ticks);
    step(s);
  }
  release(s);
}

const count = cells => cells.reduce((n, val) => n + Number(val !== 0), 0);
const mass = s => count(s.cells) + s.scoop.length + s.spill.reduce((n, b) => n + b.grains.length, 0) + (s.waste || 0);
function emptyTray() {
  const s = create(3);
  s.cells.fill(0);
  s.walls.fill(0);
  for (let y = 0; y < H; y++) s.walls[y * W] = s.walls[y * W + W - 1] = 1;
  for (let x = 0; x < W; x++) s.walls[(H - 1) * W + x] = 1;
  return s;
}

// Independent test bed: equal quantities hit a level screen, with no holes around its sides.
const tray = emptyTray();
for (let x = 1; x < W - 1; x++) tray.walls[91 * W + x] = 2;
for (let x = 18; x < 48; x++) for (let y = 50; y < 60; y++) {
  tray.cells[y * W + x] = 1;
  tray.cells[y * W + x + 50] = 5;
}
wait(tray, 350);
const below = tray.cells.subarray(W * 92);
assert.equal(below.filter(g => g > 0 && g < 5).length, 0, 'the mesh retains every coarse grain');
assert.equal(below.filter(g => g >= 5).length, 300, 'all fine grains pass the mesh');
assert.equal(count(tray.cells), 600);
console.log('Horizontal mesh: 300/300 fine through, 0/300 coarse through');

function pile(colour) {
  const s = emptyTray();
  for (let y = 20; y < 100; y++) for (let x = 50; x < 60; x++) s.cells[y * W + x] = colour;
  wait(s, 1600);
  assert.equal(s.flow, 0, 'the pile comes to rest');
  assert.equal(count(s.cells), 800);
  const heights = Array.from({ length: W }, (_, x) => {
    let h = 0;
    for (let y = 1; y < H - 1; y++) if (s.cells[y * W + x]) h++;
    return h;
  });
  return { s, height: Math.max(...heights), foot: heights.filter(Boolean).length };
}
const coarse = pile(2), fine = pile(6);
assert.ok(coarse.foot > 40 && coarse.height > 14);
assert.ok(fine.foot > coarse.foot * 1.5 && fine.height < coarse.height * 0.7, 'fine grains run farther and settle flatter');
let peak = 0;
const mound = coarse.s;
press(mound, 60, H - 7);
move(mound, 22, 98);
assert.ok(mound.hand.load > 80, 'the scoop lifts part of the resting mound');
for (let i = 0; i < 60; i++) { step(mound); peak = Math.max(peak, mound.flow); }
assert.ok(peak > 30, 'a cut face avalanches before the carried sand is released');
release(mound);
wait(mound, 1200);
assert.equal(mass(mound), 800);
console.log('800-grain settled piles: coarse', coarse.foot, 'wide ×', coarse.height, 'high; fine', fine.foot, '×', fine.height, '; avalanche peak', peak, 'moves/tick');

const scores = [];
const garden = create(0, 17);
for (const x of [23, W - 1 - 23]) {
  stroke(garden, x, 81, x, 135, 27);
  wait(garden, 70);
  scores.push(garden.score);
  assert.equal(mass(garden), garden.total);
}
assert.equal(scores[0], 0);
assert.ok(scores[1] >= 96);
assert.equal(garden.status, 'play');
console.log('Garden, one stroke then its reflection:', scores, 'points; grains', garden.total);

const curved = create(0, 3);
for (const reflected of [false, true]) {
  for (let j = 0; j < 45; j++) {
    const left = 24 + 12 * Math.sin(j / 15);
    const x = reflected ? W - 1 - left : left;
    if (!j) press(curved, x, 84);
    else move(curved, x, 84 + j);
    step(curved);
  }
  release(curved);
  wait(curved, 60);
  assert.equal(curved.score, reflected ? 100 : 0);
  assert.equal(mass(curved), curved.total);
}
console.log('Mirrored curved rake strokes: 0 then 100');
for (const [offset, expected] of [[1, 90], [2, 0]]) {
  const shifted = create(0);
  stroke(shifted, 23, 81, 23, 141);
  stroke(shifted, 96 + offset, 81, 96 + offset, 141);
  step(shifted);
  assert.equal(shifted.score, expected);
}

function play(level, seed, offset = 0, settle = 90) {
  const s = create(level, seed);
  const initial = s.total;
  wait(s, settle);
  assert.equal(s.status, 'play');
  const start = s.ticks;
  for (let attempt = 0; attempt < 25 && s.status === 'play'; attempt++) {
    const h = s.hint;
    const variation = s.kind === 'sieve' ? (attempt % 3 - 1) * 8 : offset;
    if (s.kind === 'seed' && s.goal.depth > s.goal.maxDepth) {
      const { x, y, depth } = s.goal;
      stroke(s, x, Math.floor(y - depth) + 3, h.x, h.y - 15);
    } else {
      stroke(s, h.x + variation, h.y + offset, h.toX + offset, h.toY);
    }
    assert.equal(mass(s), initial, 'mass in the field, scoop, pouring batches and waste');
    wait(s, s.kind === 'glass' ? 1000 : 240);
    assert.equal(mass(s), initial, 'mass after the pour');
  }
  assert.equal(s.status, 'won', 'campaign level ' + level + ', seed ' + seed);
  return s.ticks - start;
}

const seeds = [1, 17, 717, 7109, 65537, 0xffffffff];
for (let level = 1; level <= 10; level++) {
  const times = seeds.map(seed => play(level, seed));
  console.log('Level', level, seeds.length + '/' + seeds.length, 'won, ticks after touch', Math.min(...times), 'to', Math.max(...times));
}
const builtIn = Array.from({ length: 10 }, (_, i) => play(i + 1, 553 + (i + 1) * 971, 0, 0));
console.log('All ten built-in opening states; ticks:', builtIn.join(', '));
const openings = [-5, -3, 0, 3, 5].map(offset => play(1, 43, offset));
assert.ok(Math.max(...openings) < 3600, 'wordless first swipe clears within one simulated minute');
console.log('Opening offsets −5..+5: 5/5 finished in', Math.min(...openings), 'to', Math.max(...openings), 'ticks');

let bailWins = 0;
for (const x of [50, 55, 60, 65, 70]) {
  for (const y of [84, 87, 90]) {
    const s = create(1, 1524);
    stroke(s, x, y, x + 29, y - 20);
    wait(s, 180);
    assert.equal(s.status, 'won', 'a stroke begun on the visible bail uncovers the lamp');
    assert.equal(mass(s), s.total);
    bailWins++;
  }
}
console.log('Bail grips: ' + bailWins + '/15 uncover the lamp');
const sky = create(1, 1524);
stroke(sky, 13, 22, 46, 9);
wait(sky, 180);
assert.equal(sky.status, 'play');
assert.equal(sky.progress, 0);

const idle = create(1, 8);
wait(idle, 3600);
assert.equal(idle.status, 'play');
assert.equal(idle.progress, 0);
const blocked = create(2, 1);
press(blocked, 60, 96);
release(blocked);
wait(blocked, 2400);
assert.equal(blocked.status, 'lost', 'an untouched gate after the clock starts spills the charge');
assert.equal(count(blocked.cells.subarray(0, (blocked.goal.neckY + 1) * W)), 0);
assert.equal(mass(blocked), blocked.total);
console.log('Idle opening: 3600 ticks, 0 exposed. Closed gate lost at', blocked.ticks, 'ticks;', blocked.waste, 'grains in waste');

const late = create(2, 31);
press(late, late.gate.x, late.gate.y);
release(late);
wait(late, 1226);
press(late, late.hint.x, late.hint.y);
move(late, late.hint.toX, late.hint.toY);
release(late);
wait(late, 200);
assert.equal(late.status, 'lost', 'a lower bulb reaching the line after the upper bulb empties is too late');
assert.equal(count(late.cells.subarray(0, (late.goal.neckY + 1) * W)), 0, 'upper empty on the terminal tick');
console.log('Late gate release lost at', late.ticks, 'ticks');

for (const level of [6, 9]) {
  const miss = create(level);
  press(miss, miss.gate.x, miss.gate.y);
  release(miss);
  wait(miss, 2400);
  assert.equal(miss.status, 'lost', 'the offset lower bulb misses a straight stream');
  assert.equal(mass(miss), miss.total);
}

const deep = create(7, 1);
wait(deep, 180);
for (let k = 0; k < 3; k++) { stroke(deep, 88, 96 + 4 * k, 39, 113, 1); wait(deep, 10); }
wait(deep, 200);
assert.equal(deep.status, 'play');
const tooDeep = deep.goal.depth;
assert.ok(tooDeep > deep.goal.maxDepth);
stroke(deep, 39, Math.floor(143 - tooDeep) + 3, 80, 70);
wait(deep, 180);
if (deep.status === 'play') {
  stroke(deep, 82, 98, 39, 115);
  wait(deep, 180);
}
assert.equal(deep.status, 'won', 'an overly buried seed can be uncovered and replanted');
console.log('Overburied seed recovered:', tooDeep, 'to', deep.goal.depth, 'cells of cover');

function replay(seed) {
  const s = create(3, seed);
  stroke(s, 21, 78, 67, 70);
  wait(s, 165);
  return s;
}
const replayed = replay(19);
assert.deepEqual(replay(19), replayed);
assert.notDeepEqual(replay(20).cells, replayed.cells);
console.log('Same-seed replay matches every state field; adjacent seed differs.');
