import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const mutation = process.argv.includes('--mutate');
const source = new URL('./sim.js', import.meta.url);
let simulation = await import(source);
if (mutation) {
  const normal = 'vy += dogY * force;';
  const broken = 'vy -= dogY * force;';
  const code = await readFile(source, 'utf8');
  assert.ok(code.includes(normal), 'mutation target exists');
  simulation = await import('data:text/javascript;base64,' + Buffer.from(code.replace(normal, broken)).toString('base64'));
}
const { createGame, step, leftEdge, rightEdge, GATE, PEN, HOME_POINTS, RESCUE_POINTS } = simulation;
const FRAME = 1 / 30;

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

function sweep(game, speed = 26, x = 180) {
  return { x, y: Math.max(148, 414 - game.time * speed) };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function careful(game) {
  if (game.level === 1) return sweep(game);
  const field = game.sheep.filter(sheep => sheep.status === 'field');
  if (!field.length) return null;
  if (game.wolf?.active || game.wolf?.phase === 'eyes' && game.wolf.age > 1.7) {
    if (field.some(animal => distance(animal, game.wolf) < 92)) return game.wolf;
  }
  const priority = animal => {
    const edge = Math.min(animal.x - leftEdge(animal.y), rightEdge(animal.y) - animal.x);
    return animal.y + Math.max(0, 21 - edge) * 6;
  };
  const anchor = field.reduce((best, animal) => priority(animal) > priority(best) ? animal : best);
  const group = field.filter(animal => distance(animal, anchor) < 53 && animal.y > anchor.y - 40);
  return drive(group);
}

function drive(group) {
  const x = group.reduce((sum, animal) => sum + animal.x, 0) / group.length;
  const y = group.reduce((sum, animal) => sum + animal.y, 0) / group.length;
  const gateDx = GATE.x - x;
  const aimX = Math.abs(gateDx) < 24 ? x : GATE.x - Math.sign(gateDx) * 8;
  const aimY = GATE.y - 21;
  const dx = aimX - x;
  const dy = aimY - y;
  const length = Math.hypot(dx, dy);
  const offset = group.length > 3 ? 37 : 31;
  const goalY = clamp(y - dy / length * offset, GATE.y + 8, 502);
  const goalX = clamp(x - dx / length * offset, leftEdge(goalY) - 25, rightEdge(goalY) + 25);
  return { x: goalX, y: goalY };
}

function bulk(game) {
  if (game.level === 1) return sweep(game);
  const field = game.sheep.filter(animal => animal.status === 'field' && !animal.stray);
  const groups = field.map(anchor => field.filter(animal => distance(animal, anchor) < 49));
  const biggest = groups.reduce((best, group) => group.length > best.length ? group : best, []);
  return biggest.length > 2 ? drive(biggest) : null;
}

function play(level, seed, policy, pace = 3) {
  const game = createGame(level, seed);
  let target = game.dog;
  for (let frame = 0; game.status === 'play' && frame <= (game.limit + 1) / FRAME; frame++) {
    if (frame % pace === 0) target = policy(game);
    step(game, FRAME, target);
  }
  return game;
}

function penCount(game) {
  return game.sheep.filter(animal => animal.status === 'home').length;
}

function checkPen(game) {
  assert.equal(penCount(game), game.home);
  assert.equal(game.sheep.filter(animal => animal.status === 'lost').length, game.lost);
  assert.equal(game.sheep.filter(animal => animal.rescued).length, game.rescued);
  assert.equal(game.score, game.home * HOME_POINTS + game.rescued * RESCUE_POINTS);
  for (const animal of game.sheep) {
    assert.ok(Number.isFinite(animal.x) && Number.isFinite(animal.y), 'animal stays in finite world coordinates');
    if (animal.status === 'home') {
      assert.ok(animal.x > PEN.left && animal.x < PEN.right && animal.y > PEN.top && animal.y < PEN.bottom);
      assert.equal(animal.vx, 0);
      assert.equal(animal.vy, 0);
      assert.ok(animal.homeAt <= game.time);
    }
  }
}

const waiting = createGame(1, 1);
step(waiting, 65, null);
assert.equal(waiting.time, 0, 'the timer waits for first touch');
assert.equal(waiting.started, false);
assert.equal(waiting.status, 'play');
step(waiting, FRAME, waiting.dog);
assert.equal(waiting.started, true);
step(waiting, waiting.limit, null);
assert.equal(waiting.status, 'lost', 'touching once and leaving the dog there times out');
assert.equal(waiting.time, waiting.limit);
assert.equal(waiting.home, 0);

const tutorial = play(1, 1, sweep);
assert.equal(tutorial.home, 12, 'a straight upward drag from behind pens the whole first flock');
assert.equal(tutorial.status, 'won');
assert.ok(tutorial.time < 15, 'the straight tutorial takes under 15 seconds');
assert.deepEqual(play(1, 1, sweep), tutorial, 'equal seed and targets produce equal final state');
step(tutorial, 3, { x: 80, y: 430 });
assert.deepEqual(play(1, 1, sweep), tutorial, 'a clear freezes the simulation');
assert.notDeepEqual(createGame(1, 1).sheep, createGame(1, 2).sheep);
checkPen(tutorial);

function singleSheep(kind, dogY) {
  const game = createGame(2, 20);
  game.sheep.length = 1;
  Object.assign(game.sheep[0], { x: 180, y: 305, kind });
  Object.assign(game.dog, { x: 180, y: dogY });
  step(game, 1, { x: 180, y: dogY });
  return game.sheep[0];
}

const ewe = singleSheep('ewe', 360);
const lamb = singleSheep('lamb', 360);
const ram = singleSheep('ram', 360);
const closeRam = singleSheep('ram', 331);
assert.ok(ewe.y < lamb.y - 8, 'the lamb visibly lags when pushed alongside an ewe');
assert.ok(lamb.y < ram.y - 3, 'the ram ignores pressure that already moves the lamb');
assert.ok(closeRam.y < ram.y - 22, 'the dog can move the ram at closer range');

const together = createGame(2);
together.sheep.length = 2;
Object.assign(together.sheep[0], { x: 160, y: 255, phase: 0, kind: 'ewe' });
Object.assign(together.sheep[1], { x: 207, y: 255, phase: Math.PI, kind: 'ewe' });
const apart = structuredClone(together);
apart.sheep[1].x = 240;
step(together, 1, together.dog);
step(apart, 1, apart.dog);
assert.ok(together.sheep[0].x > apart.sheep[0].x + 8, 'nearby sheep attract one another within sight');

for (const [hazard, edge, sign] of [['woods', leftEdge, -1], ['stream', rightEdge, 1]]) {
  const game = createGame(2, 4);
  const animal = game.sheep[0];
  Object.assign(animal, { x: edge(270) - sign * 2, y: 270, kind: 'ewe' });
  Object.assign(game.dog, { x: edge(270) - sign * 24, y: 270 });
  step(game, 0.35, { ...game.dog });
  assert.equal(animal.status, 'field', 'a sheep can be brought back just after crossing a bank');
  assert.ok(animal.hazardFor > 0 && animal.stray);
  const rescue = structuredClone(game);
  const outside = { x: edge(270) + sign * 25, y: 270 };
  step(rescue, 0.5, outside);
  assert.equal(rescue.sheep[0].status, 'field', 'the dog can get beyond the bank to drive a sheep inland');
  step(rescue, 0.8, outside);
  assert.equal(rescue.sheep[0].hazardFor, 0);
  assert.ok(rescue.sheep[0].stray, 'a saved stray keeps its rescue mark until home');

  step(game, 1.35, { ...game.dog });
  assert.equal(animal.status, 'lost');
  assert.equal(animal.lostTo, hazard);
  assert.equal(game.status, 'lost', 'one sheep lost ends the run');
  checkPen(game);
}

const closedFence = createGame(1);
closedFence.sheep.length = 1;
Object.assign(closedFence.sheep[0], { x: 105, y: 131, vy: -41 });
Object.assign(closedFence.dog, { x: 105, y: 157 });
step(closedFence, 0.7, { x: 105, y: 157 });
assert.equal(closedFence.home, 0, 'sheep cannot cross the fence outside the opening');
assert.equal(closedFence.sheep[0].y, GATE.y);

const risk = createGame(4, 4);
const stationary = { x: 260, y: 470 };
for (let i = 0; i < 500 && !risk.wolf; i++) step(risk, FRAME, stationary);
assert.equal(risk.wolf?.phase, 'eyes', 'eyes appear at the forest before the wolf runs');
assert.ok(risk.wolf.x < leftEdge(risk.wolf.y));
risk.sheep.length = 2;
const flank = risk.wolf.y;
const front = risk.wolf.x + 68;
Object.assign(risk.sheep[0], { x: front, y: flank - 24, vx: 0, vy: 0, kind: 'ewe' });
Object.assign(risk.sheep[1], { x: front, y: flank + 24, vx: 0, vy: 0, kind: 'ewe' });
const control = structuredClone(risk);
control.wolf = null;
control.nextWolf = Infinity;
step(risk, 0.7, stationary);
step(control, 0.7, stationary);
assert.deepEqual(risk.sheep, control.sheep, 'eyes alone do not change animal motion');
// Sample late in the crossing after the two ewes have had time to diverge.
step(risk, 4.9, stationary);
step(control, 4.9, stationary);
assert.equal(risk.wolf?.phase, 'run');
const spread = distance(...risk.sheep);
const controlSpread = distance(...control.sheep);
assert.ok(spread > controlSpread + 15, 'the active wolf scatters nearby sheep');
assert.ok(risk.sheep.every((animal, i) => animal.panic > 0 && animal.x > control.sheep[i].x + 20));
console.log(`Wolf crossing at ${risk.wolf.age.toFixed(1)} s: ${spread.toFixed(2)} units apart vs ${controlSpread.toFixed(2)} without a wolf.`);
const uninterrupted = structuredClone(risk);
const threat = { x: risk.wolf.x, y: risk.wolf.y };
step(risk, 0.65, threat);
step(uninterrupted, 0.65, stationary);
assert.equal(uninterrupted.wolf?.phase, 'run', 'the wolf would still be running without the dog');
assert.equal(risk.wolf?.phase, 'leave', 'the dog ends the crossing early');

const tutorialSeeds = [1, 2, 3, 4, 5, 23, 55, 100, 846];
for (const speed of [10, 26, 80, 200]) {
  const runs = tutorialSeeds.map(seed => play(1, seed, game => sweep(game, speed), 1));
  assert.ok(runs.every(game => game.status === 'won' && game.home === 12), `the tutorial drive works at ${speed} units/s`);
  const times = runs.map(game => game.time);
  console.log(`Tutorial drag at ${speed} units/s: ${runs.length}/${runs.length}, ${Math.min(...times).toFixed(1)}–${Math.max(...times).toFixed(1)} s`);
}
const side = createGame(1);
step(side, 0.2, { x: 250, y: 414 });
assert.ok(side.dog.x > 210, 'the tutorial still allows fast sideways movement');
const later = createGame(2);
step(later, 0.2, { x: 180, y: 148 });
assert.ok(later.dog.y < 384, 'the later dog keeps its full uphill speed');

const campaign = [];
const seeds = [1, 23, 55, 846];
for (let level = 1; level <= 10; level++) {
  const rounds = [...new Set([level, ...seeds])].map(seed => play(level, seed, careful));
  assert.ok(rounds.every(game => game.status === 'won'), `careful bot should win level ${level} on all tested seeds`);
  assert.ok(rounds.every(game => game.sheep.filter(animal => animal.kind === 'ram').length === (level >= 3 ? 1 : 0)));
  rounds.forEach(checkPen);
  campaign.push(...rounds);
  const times = rounds.map(game => game.time);
  console.log(`Level ${level}: ${rounds.length}/${rounds.length}, ${rounds[0].home} sheep, ${Math.min(...times).toFixed(1)}–${Math.max(...times).toFixed(1)} s`);
}

const herd = play(5, 5, careful);
const ordinary = play(5, 5, bulk);
assert.equal(herd.rescued, 1, 'the careful run retrieves the lone sheep on the far bank');
assert.ok(ordinary.home >= 10 && ordinary.rescued === 0, 'the bulk run collects the flock without retrieving the stray');
assert.ok(RESCUE_POINTS > 60 * HOME_POINTS, 'one rescue is worth more than the largest ordinary flock');
assert.ok(RESCUE_POINTS > 99 * HOME_POINTS, 'one rescue exceeds 99 ordinary arrivals');
assert.ok(herd.score >= ordinary.score + RESCUE_POINTS);
console.log(`Level 5 rescue: ${herd.home}/${herd.sheep.length}, ${herd.rescued} rescued, ${herd.score} points. Bulk: ${ordinary.home}/${ordinary.sheep.length}, ${ordinary.score} points.`);

const endless = [11, 12, 15, 18, 40].flatMap(level => seeds.map(seed => play(level, seed, careful)));
for (const [level, count] of [[11, 32], [12, 36], [15, 48], [18, 60], [40, 60]]) {
  const rounds = endless.filter(game => game.level === level);
  assert.ok(rounds.every(game => game.status === 'won' && game.home === count));
  assert.ok(rounds.every(game => game.sheep.filter(animal => animal.kind === 'ram').length === 1));
  rounds.forEach(checkPen);
  console.log(`Endless wave ${level - 10}: ${rounds.length}/${rounds.length}, ${count} sheep`);
}
console.log(`${campaign.length}/${campaign.length} campaign runs, ${endless.length}/${endless.length} sampled endless runs. Movement, timer, hazards, pen, rescue, wolf and determinism checks passed.`);
