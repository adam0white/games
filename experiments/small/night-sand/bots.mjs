import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const file = new URL('./sim.js', import.meta.url);
let sim = await import(file);
// --mutate breaks the mesh (coarse grains pass). --mutate=hand makes the hand lose the grains it pours.
// --mutate=trickle stops a held handful from pouring until the finger lifts. Each must fail a claim below.
const mutation = process.argv.find(a => a.startsWith('--mutate'))?.split('=')[1] ?? (process.argv.includes('--mutate') ? 'mesh' : null);
if (mutation) {
  const code = await readFile(file, 'utf8');
  const cuts = {
    mesh: ["const solid = grain < 5 ? 0 : 2;", 'const solid = 2;'],
    hand: ["      const particle = grains.pop();\n      s.cells[i] = particle % 16;", "      const particle = grains.pop();\n      if (grains.length % 9 === 0) continue;\n      s.cells[i] = particle % 16;"],
    trickle: ["  if (!s.scoop.length || (h.moved < 4 && h.age < 30)) return;", "  return;"],
  };
  const [from, to] = cuts[mutation] || [];
  assert.ok(from && code.includes(from), 'could not locate the rule for mutation ' + mutation);
  const broken = code.replace(from, to);
  sim = await import('data:text/javascript;base64,' + Buffer.from(broken).toString('base64'));
  console.log('Mutation:', mutation);
}
const { W, H, create, step, press, move, release, BEDS } = sim;
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
  const s = create(4); // the sieve bed has no board, so the step does not wait for a first touch
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
// Gravity (2026-11-26): one grain dropped 150 cells lands in well under 150 ticks and speeds up on the way;
// without gravity it falls one cell a tick. Mass is kept either way.
function dropTicks(gravity) {
  const t = emptyTray(); t.gravity = gravity; t.cells[5 * W + 60] = 1; const ys = [];
  let n = 0; while (!t.cells[(H - 2) * W + 60] && n < 400) { step(t); n++; ys.push(t.cells.findIndex(g => g) / W | 0); }
  assert.equal(count(t.cells), 1, 'a falling grain is never lost or doubled');
  return { n, first: ys[0] - 5, top: Math.max(...ys.slice(1).map((y, k) => y - ys[k])) };
}
const fast = dropTicks(true), slow = dropTicks(false);
assert.equal(slow.n, H - 2 - 5, 'without gravity a grain falls one cell a tick');
assert.ok(fast.n < slow.n * 0.4 && fast.first === 1 && fast.top === sim.MAX_FALL, `with gravity it speeds up: ${fast.n} ticks against ${slow.n}`);
console.log(`Gravity: a grain falls ${H - 7} cells in ${fast.n} ticks (${slow.n} without)`);

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

// The informed player follows the moving hint: each stroke starts on sand that is there now.
function play(level, seed, settle = 60) {
  const s = create(level, seed);
  const initial = s.total;
  wait(s, settle);
  assert.equal(s.status, 'play');
  const start = s.ticks;
  for (let attempt = 0; attempt < 40 && s.status === 'play'; attempt++) {
    const h = s.hint;
    stroke(s, h.x, h.y, h.toX, h.toY);
    assert.equal(mass(s), initial, 'mass in the field, hand, pouring batches and waste');
    if (s.goal.topLine) {
      // The shut-in-time bed: wait for the sand, then follow the hint back.
      wait(s, 16);
      for (let i = 0; i < 900 && s.status === 'play' && s.progress < 0.95 && Math.abs(s.gate.x - s.goal.x) > 10; i++) step(s);
    } else wait(s, s.gate && s.kind === 'glass' ? 1000 : 120);
    assert.equal(mass(s), initial, 'mass after the pour');
  }
  wait(s, 600);
  assert.equal(s.status, 'won', 'campaign level ' + level + ', seed ' + seed);
  return s.ticks - start;
}

const seeds = [1, 17, 717, 7109, 65537];
for (let level = 1; level <= 10; level++) {
  const times = [...seeds, 553 + level * 971].map(seed => play(level, seed));
  console.log('Level', level, BEDS[level].kind, (seeds.length + 1) + '/' + (seeds.length + 1), 'won, ticks after the first touch', Math.min(...times), 'to', Math.max(...times));
}

// The verb: a press on the sand puts grains in the hand; a still hand over air pours them.
const verb = create(1, 1524);
press(verb, 60, 95);
const held = verb.scoop.length;
assert.ok(held >= 40, 'the first press gathers a visible handful');
move(verb, 30, 40);
for (let i = 0; i < 10; i++) step(verb);
const carried = verb.scoop.length;
for (let i = 0; i < 40; i++) step(verb);
assert.ok(carried >= 40 && verb.scoop.length < carried / 4, 'a hand held still over open air pours while the finger is down');
release(verb);
wait(verb, 200);
assert.equal(mass(verb), verb.total);
console.log('First press gathered', held, 'grains; a still hand poured', carried - verb.scoop.length, 'in 40 ticks');

const reach = create(1, 1524);
press(reach, 60, columnTop(reach, 60) - 12);
assert.ok(reach.scoop.length > 0, 'a press just above the surface reaches down to it');
const sky = create(1, 1524);
press(sky, 13, 22); move(sky, 46, 9); release(sky);
wait(sky, 180);
assert.equal(sky.status, 'play');
assert.equal(mass(sky), sky.total);
assert.equal(sky.lifted, 0, 'a stroke high in the sky gathers nothing');
const idle = create(1, 8);
wait(idle, 3600);
assert.equal(idle.status, 'play');

// Bed 1 must fall to a clumsy player: random drags that know nothing of the lamp.
function rng(seed) { let n = seed >>> 0 || 1; return () => (n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296; }
function surface(s, x) { for (let y = 1; y < H - 1; y++) if (s.cells[y * W + x]) return y; return H - 2; }
function clumsy(level, seed, limit = 60 * 180) {
  const s = create(level, 553 + level * 971), r = rng(seed);
  let t = 0;
  while (s.status === 'play' && t < limit) {
    let x = 2 + Math.floor(r() * (W - 4)), y;
    if (s.gate) { x = s.gate.x + (r() - 0.5) * 20; y = s.gate.y; }
    else y = r() < 0.7 ? surface(s, x) + Math.floor(r() * 10) - 2 : 10 + r() * (H - 20);
    const angle = r() * Math.PI * 2, length = 10 + r() * 50;
    const toX = x + Math.cos(angle) * length, toY = s.gate ? y : y + Math.sin(angle) * length;
    const n = 8 + Math.floor(r() * 25);
    press(s, x, y);
    for (let i = 1; i <= n && s.status === 'play'; i++) { move(s, x + (toX - x) * i / n, y + (toY - y) * i / n); step(s); t++; }
    release(s);
    const pause = 20 + Math.floor(r() * 60);
    for (let i = 0; i < pause && s.status === 'play'; i++) { step(s); t++; }
  }
  return s.status === 'won' ? t / 60 : Infinity;
}
const clumsyTimes = Array.from({ length: 15 }, (_, i) => clumsy(1, 1000 + i * 7919)).sort((a, b) => a - b);
const clumsyMedian = clumsyTimes[7];
assert.ok(clumsyMedian < 45, 'a clumsy player clears bed 1 in a median under 45 seconds');
console.log('Clumsy player, bed 1:', clumsyTimes.filter(Number.isFinite).length + '/15 won, median', clumsyMedian.toFixed(1), 's');

// Bed 3: the glass waits for the first touch; a board left open spills past the upper mark.
const untouched = create(3, 1);
wait(untouched, 2400);
assert.equal(untouched.status, 'play', 'the hourglass waits for the first touch');
const open = create(3, 1);
stroke(open, open.gate.x, open.gate.y, open.gate.x + 32, open.gate.y);
wait(open, 3000);
assert.equal(open.status, 'lost', 'a board left open spills past the upper mark');
assert.equal(open.ending, 'overfill');
assert.equal(mass(open), open.total);
console.log('Board left open on bed 3: lost (overfill) at', open.ticks, 'ticks');

// Bed 6: a stream that falls straight misses the offset lower bulb.
const miss = create(6);
press(miss, miss.gate.x, miss.gate.y);
release(miss);
wait(miss, 2400);
assert.equal(miss.status, 'lost', 'the offset lower bulb misses a straight stream');
assert.equal(mass(miss), miss.total);

// Bed 2: too much sand on the seed is not a win. The hand never lifts between handfuls,
// so the bed cannot be won on the way past the marks.
const deep = create(2, 1);
for (let k = 0; k < 12 && !(deep.goal.depth > deep.goal.maxDepth + 10); k++) {
  press(deep, 26 + (k % 3) * 6, columnTop(deep, 26 + (k % 3) * 6) + 3);
  move(deep, deep.goal.x, 70);
  for (let i = 0; i < 80; i++) step(deep);
}
release(deep);
wait(deep, 300);
assert.equal(deep.status, 'play', 'an overburied seed is not planted');
assert.ok(deep.goal.depth > deep.goal.maxDepth);
assert.equal(mass(deep), deep.total);
console.log('Overburied seed: depth', deep.goal.depth, 'over the limit', deep.goal.maxDepth, '; still in play');
function columnTop(s, x) { for (let y = 1; y < H - 1; y++) if (s.cells[y * W + x]) return y; return H - 2; }

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
