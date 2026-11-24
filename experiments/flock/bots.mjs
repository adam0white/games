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
const { createGame, step, command, leftEdge, rightEdge, GATE, PEN, HOME_POINTS, RESCUE_POINTS } = simulation;
const { cue, steerable } = await import('./teach.js');
const FRAME = 1 / 30;

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

function sweep(game, speed = 26, x = 180) {
  return { x, y: Math.max(148, 414 - game.time * speed) };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// What the careful shepherd wants to do now. careful() acts on it directly; the clumsy bot passes it through a finger.
function intent(game, {wide = true, lie = true, park = false} = {}) {
  const {outrun, gate} = game.terrain;
  if (game.dog.mode === 'outrun') return {kind: 'wait'};
  if (outrun && !outrun.gathered && wide) return {kind: 'outrun', dir: Math.sign(outrun.x - 180)};
  if (gate && !gate.open && (lie || park)) {
    const atGate = game.sheep.some(s => s.status === 'field' && s.y < gate.y + 19 &&
      s.y > gate.y && Math.abs(s.x - gate.x) < gate.width / 2);
    if (atGate) {
      if (park) return {kind: 'run', target: {x: gate.x - 108, y: gate.y - 22}};
      if (Math.hypot(game.dog.x - gate.x, game.dog.y - gate.y) >= 110) return {kind: 'run', target: {x:gate.x, y:gate.y + 59}};
      return {kind: 'hold'};
    }
  }
  if (game.level === 1) return {kind: 'run', target: sweep(game)};
  const field = game.sheep.filter(sheep => sheep.status === 'field');
  if (!field.length) return {kind: 'wait'};
  if (game.wolf?.active || game.wolf?.phase === 'eyes' && game.wolf.age > 1.7) {
    if (field.some(animal => distance(animal, game.wolf) < 92)) return {kind: 'run', target: game.wolf};
  }
  const priority = animal => {
    const edge = Math.min(animal.x - leftEdge(animal.y), rightEdge(animal.y) - animal.x);
    return animal.y + Math.max(0, 21 - edge) * 6;
  };
  const anchor = field.reduce((best, animal) => priority(animal) > priority(best) ? animal : best);
  const group = field.filter(animal => distance(animal, anchor) < 53 && animal.y > anchor.y - 40);
  const barrier = [game.terrain.bridge, game.terrain.gate, game.terrain.lane]
    .find(b => b && anchor.y >= b.y + b.height - .1);
  return {kind: 'run', target: drive(group, barrier ?? GATE)};
}

function careful(game, options) {
  const want = intent(game, options);
  if (want.kind === 'outrun') command(game, 'outrun', want.dir);
  if (want.kind === 'hold' && game.dog.mode !== 'hold') command(game, 'hold');
  return want.kind === 'run' ? want.target : null;
}

function drive(group, gate = GATE) {
  const x = group.reduce((sum, animal) => sum + animal.x, 0) / group.length;
  const y = group.reduce((sum, animal) => sum + animal.y, 0) / group.length;
  const gateDx = gate.x - x;
  const aimX = Math.abs(gateDx) < 24 ? x : gate.x - Math.sign(gateDx) * 8;
  const aimY = gate.y - 21;
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
  // The banks give sheep a foothold from evening 2 on. A dog close behind still drives one over.
  Object.assign(game.dog, { x: edge(270) - sign * 13, y: 270 });
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
for (let level = 1; level <= 20; level++) {
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

const endless = [21, 22, 25, 28, 50].flatMap(level => seeds.map(seed => play(level, seed, careful)));
for (const [level, count] of [[21, 32], [22, 36], [25, 48], [28, 60], [50, 60]]) {
  const rounds = endless.filter(game => game.level === level);
  assert.ok(rounds.every(game => game.status === 'won' && game.home === count));
  assert.ok(rounds.every(game => game.sheep.filter(animal => animal.kind === 'ram').length === 1));
  rounds.forEach(checkPen);
  console.log(`Endless wave ${level - 20}: ${rounds.length}/${rounds.length}, ${count} sheep`);
}
console.log(`${campaign.length}/${campaign.length} campaign runs, ${endless.length}/${endless.length} sampled endless runs. Movement, timer, hazards, pen, rescue, wolf and determinism checks passed.`);

for (let level = 1; level <= 20; level++) {
  for (const seed of [level, ...Array.from({length: 16}, (_, day) => 20261124 + day)]) {
    const initial = createGame(level, seed);
    const features = [initial.terrain.gate, initial.terrain.bridge, initial.terrain.lane].filter(Boolean);
    for (const sheep of initial.sheep) {
      assert.ok(features.every(b => sheep.y <= b.y || sheep.y >= b.y + b.height ||
        (b.open !== false && Math.abs(sheep.x - b.x) < b.width / 2 - 4)), 'sheep start on pasture or inside the passage');
    }
  }
}
function specimen(n = 1) {
  const game = createGame(2, 4);
  game.sheep.length = n;
  game.leadId = 0;
  game.terrain.gate = null;
  game.started = true;
  for (const [i, s] of game.sheep.entries()) {
    Object.assign(s, {x: 180 + i * 18, y: 305, kind: 'ewe', phase: 0, eweId: -1});
  }
  return game;
}

// Keep the general boids forces identical and change only who a lamb follows.
const families = specimen(3);
Object.assign(families.sheep[0], {kind: 'lamb', eweId: 1});
families.sheep[1].x = 144;
families.sheep[2].x = 216;
const foster = structuredClone(families);
foster.sheep[0].eweId = 2;
step(families, 1);
step(foster, 1);
const familyPull = foster.sheep[0].x - families.sheep[0].x;
assert.ok(familyPull > 3, 'a lamb turns specifically toward its own ewe');

const trust = specimen(3);
trust.sheep[1].x = 141;
trust.sheep[2].x = 219;
trust.leadId = 1;
const otherBell = structuredClone(trust);
otherBell.leadId = 2;
step(trust, 1);
step(otherBell, 1);
const bellPull = otherBell.sheep[0].x - trust.sheep[0].x;
assert.ok(bellPull > .8, 'changing the bellwether changes a field ewe’s choice of direction');

const alarm = specimen(3);
alarm.sheep[0].panic = 1;
step(alarm, .18);
assert.ok(alarm.sheep[1].panic > .25 && alarm.sheep[2].panic > .08,
  'panic crosses two neighbour links beyond the source’s immediate radius');
const rest = specimen();
Object.assign(rest.dog, {x: 180, y: 332});
const standing = structuredClone(rest);
command(rest, 'hold');
step(rest, 1);
step(standing, 1);
assert.ok(rest.sheep[0].grazing && !standing.sheep[0].grazing);
assert.ok(rest.sheep[0].y > standing.sheep[0].y + 20, 'a lying dog can hold sheep on open grass');

const sight = specimen(2);
sight.sheep[1].x = 236;
sight.leadId = 1;
const mist = structuredClone(sight);
mist.weather.mist = true;
step(sight, .8);
step(mist, .8);
assert.ok(sight.sheep[0].x > mist.sheep[0].x + 4, 'mist removes a formerly visible neighbour');

const downwind = specimen();
Object.assign(downwind.dog, {x: 80, y: 305});
downwind.weather.wind = .85;
command(downwind, 'outrun', -1);
const upwind = structuredClone(downwind);
upwind.weather.wind = -.85;
step(downwind, .3);
step(upwind, .3);
const windLift = downwind.sheep[0].x - upwind.sheep[0].x;
assert.ok(windLift > .12, 'the same flank whistle turns a downwind sheep earlier');

for (const obstacle of ['lane', 'bridge']) {
  const track = specimen();
  const level = obstacle === 'lane' ? 6 : 4;
  const barrier = createGame(level).terrain[obstacle];
  track.terrain[obstacle] = barrier;
  const start = barrier.y + barrier.height + 4;
  Object.assign(track.sheep[0], {x: barrier.x - barrier.width / 2 - 23, y: start});
  Object.assign(track.dog, {x: track.sheep[0].x, y: start + 22});
  const crossing = structuredClone(track);
  crossing.sheep[0].x = crossing.dog.x = barrier.x;
  step(track, .55);
  step(crossing, .55);
  assert.ok(track.sheep[0].y >= barrier.y + barrier.height && crossing.sheep[0].y < start - 9,
    obstacle + ' stops a driven sheep outside its opening and admits one on the route');
}

const mud = specimen();
mud.terrain.bog = {x: 180, y: 305, rx: 44, ry: 58};
Object.assign(mud.dog, {x: 180, y: 330});
const dry = structuredClone(mud);
dry.terrain.bog = null;
step(mud, .6);
step(dry, .6);
const mudLag = mud.sheep[0].y - dry.sheep[0].y;
assert.ok(mudLag > 4, 'the same drive moves sheep less far in the bog');
console.log(`Family pull ${familyPull.toFixed(2)}, bell pull ${bellPull.toFixed(2)}, wind lift ${windLift.toFixed(2)}, bog lag ${mudLag.toFixed(2)} world units.`);

for (const [feature, ability] of [['outrun', 'wide'], ['gate', 'lie']]) {
  for (let level = 1; level <= 20; level++) {
    if (!createGame(level).terrain[feature]) continue;
    const runs = [...new Set([level, ...seeds])].map(seed => play(level, seed, g => careful(g, {[ability]: false})));
    console.log(`Without ${ability}, evening ${level}: ${runs.filter(g => g.status === 'won').length}/${runs.length} cleared.`);
    assert.ok(runs.every(g => g.status === 'lost' &&
      (feature === 'outrun' ? g.lost > 0 : !g.terrain.gate.open)), 'restricted policy should fail the field');
  }
}

const holdFields = [2, 7, 11, 14, 17, 20];
for (const level of holdFields) {
  const parked = play(level, level, game => careful(game, {lie: false, park: true}));
  assert.ok(parked.status === 'lost' && !parked.terrain.gate.open,
    'parking a standing dog outside flight distance cannot secure the gate');
}
console.log(`Standing dog parked outside pressure: 0/${holdFields.length} drafting gates opened.`);

function oneFlick(level, seed, contact) {
  const game = createGame(level, seed);
  const side = Math.sign(game.terrain.outrun.x - 180);
  step(game, .06, game.dog);
  step(game, contact, {x: 180 + side * 70, y: 409});
  command(game, 'outrun', side);
  step(game, 2.5);
  assert.ok(game.terrain.outrun.gathered, 'one correctly aimed flick gathers evening ' + level + ' seed ' + seed + ' after contact ' + contact);
  assert.equal(game.dog.mode, 'run', 'a finished outrun leaves the dog standing');
}
function leadFirst(game) {
  const patch = game.terrain.outrun;
  const lead = game.sheep[game.leadId];
  if (lead.status !== 'field') return careful(game, {wide: false});
  const side = Math.sign(patch.x - 180);
  const offset = side * (lead.x - 180);
  const flank = offset > 15 ? 18 : offset > -4 ? 8.82 : 4.86;
  return {x: lead.x + side * flank, y: lead.y + (offset > 30 ? 11 : 15)};
}
const wideFields = [3, 8, 12, 15, 18, 20];
for (const level of wideFields) {
  for (const seed of [level, ...seeds]) {
    for (const contact of [.10, .20, .30]) oneFlick(level, seed, contact);
  }
  const led = play(level, level, leadFirst, 1);
  assert.ok(led.status === 'lost' && !led.terrain.outrun.gathered,
    'driving the uncalled bellwether first cannot take it beyond the grazing strip');
}
console.log(`Lead-first drag: 0/${wideFields.length} outrun fields cleared.`);

const median = values => values.toSorted((a,b) => a - b)[Math.floor(values.length / 2)];
const stages = [[1,6], [7,13], [14,20]];
const farmTimes = stages.map(([first,last]) => median(campaign.filter(g => g.level >= first && g.level <= last).map(g => g.time)));
assert.ok(farmTimes[0] + 4 < farmTimes[1] && farmTimes[1] + 3 < farmTimes[2], 'each farm takes more work');
const medians = Array.from({length: 20}, (_, i) => median(campaign.filter(g => g.level === i + 1).map(g => g.time)));
const largestRise = Math.max(...medians.slice(1).map((time, i) => time - medians[i]));
assert.ok(largestRise < 16, 'one evening adds less than sixteen seconds to the median drive');
const leastMargin = Math.min(...campaign.map(g => 1 - g.time / g.limit));
assert.ok(leastMargin > .35, 'the slowest sampled clear still has over one third of its evening to spare');
const calmStars = campaign.filter(g => g.minCalm >= .78).length;
const timeStars = campaign.filter(g => g.time <= g.par).length;
const allStars = campaign.filter(g => g.minCalm >= .78 && g.time <= g.par).length;
console.log(`Farm medians ${farmTimes.map(n=>n.toFixed(2)).join(', ')} s; largest evening rise ${largestRise.toFixed(2)} s; least time left ${(leastMargin*100).toFixed(1)}%. Calm stars ${calmStars}, time stars ${timeStars}, both ${allStars} of ${campaign.length} clears.`);
assert.ok(calmStars > 4 && calmStars < campaign.length);
assert.ok(timeStars > 4 && timeStars < campaign.length);

// ---------- First-minute and finish audit (2026-11-24)
// A finger on the field, as main.js reads one: a moving contact is the dog's target, a contact kept still for
// 0.43 s once the dog has reached it is the lie-down, a quick sideways stroke is the outrun. `late` delays every
// decision by that many seconds. `wrong` is the share of half-second inputs replaced by a mistake: a touch on a
// random spot, a lie-down nobody wanted, or a flick to a random side.
function randomFrom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
function playFinger(level, seed, brain, {late = 0, wrong = 0} = {}) {
  const game = createGame(level, seed);
  const random = randomFrom(seed * 7919 + level);
  const queue = [];
  let act = {kind: 'lift'}, still = 0, slip = null, slipUntil = 0, nextInput = 0;
  for (let frame = 0; game.status === 'play' && frame <= (game.limit + 1) / FRAME; frame++) {
    const now = frame * FRAME;
    let next = brain(game, now);
    if (wrong && now >= nextInput) {
      nextInput = now + .5;
      slip = null;
      if (random() < wrong) {
        const kind = random();
        slip = kind < .5 ? {kind: 'run', x: 40 + random() * 280, y: 130 + random() * 370}
          : kind < .75 ? {kind: 'hold', x: game.dog.x, y: game.dog.y} : {kind: 'flick', dir: random() < .5 ? -1 : 1};
        slipUntil = nextInput;
        queue.push({at: now + late, action: slip});
      }
    }
    if (slip && now < slipUntil) next = null;
    else if (slip) { slip = null; act = {kind: 'lift'}; }
    if (next) queue.push({at: now + late, action: next});
    while (queue.length && queue[0].at <= now + 1e-9) {
      const {action} = queue.shift();
      if (action.kind === 'flick') { command(game, 'outrun', action.dir); act = {kind: 'lift'}; continue; }
      if (action.kind !== act.kind || action.kind === 'hold' && distance(action, act) > 8) still = 0;
      act = action;
    }
    let target = null;
    if (act.kind === 'run') target = act;
    else if (act.kind === 'hold' && game.dog.mode !== 'hold') {
      target = act;
      if (distance(act, game.dog) > 14) still = 0;
      else if ((still += FRAME) >= .43) { command(game, 'hold'); target = null; }
    }
    step(game, FRAME, steerable(game) ? target : null);
  }
  return game;
}

// Clumsy: the careful shepherd's intent through a slow, unreliable finger.
function clumsyBrain() {
  let last = -1;
  return (game, now) => {
    if (now - last < .1 - 1e-9) return null;
    last = now;
    const want = intent(game);
    if (want.kind === 'outrun') return {kind: 'flick', dir: want.dir};
    if (want.kind === 'hold') return {kind: 'hold', x: game.dog.x, y: game.dog.y};
    if (want.kind === 'run') return {kind: 'run', x: want.target.x, y: want.target.y};
    return {kind: 'lift'};
  };
}

// Naive: knows only what the screen pictures (teach.js, the same answer the page draws from). It does the pictured
// gesture one second after the picture appears. With no picture it repeats the one thing that worked on the first
// evening: a finger below the lowest sheep, moved straight uphill at the first evening's pace, again and again.
// It never aims at an opening, reads no weather and does not know what a bridge, a lane or a bog is.
function naiveBrain(react = 1) {
  let stroke = null, seen = null, since = 0, last = -1, flicked = -9;
  return (game, now) => {
    if (now - last < .1 - 1e-9) return null;
    last = now;
    const picture = cue(game), kind = picture?.kind ?? null;
    if (kind !== seen) { seen = kind; since = now; }
    const shown = now - since >= react;
    const field = game.sheep.filter(s => s.status === 'field');
    if (!field.length) return null;
    if (shown && kind === 'circle') { stroke = null; return {kind: 'lift'}; }
    if (shown && kind === 'outrun') {
      stroke = null;
      if (now - flicked < 2.5) return {kind: 'lift'};
      flicked = now;
      return {kind: 'flick', dir: picture.dir};
    }
    if (shown && ['hold', 'wolf', 'edge'].includes(kind)) {
      stroke = null;
      return {kind: kind === 'hold' ? 'hold' : 'run', x: picture.x, y: picture.y};
    }
    const low = field.reduce((a, b) => b.y > a.y ? b : a);
    if (shown && kind === 'bring') {
      // The dotted line runs from the flock to the opening: drag along it from behind the last sheep.
      const dx = picture.x - low.x, dy = picture.y - low.y, far = Math.hypot(dx, dy) || 1;
      if (!stroke?.along || stroke.done >= 80) {
        stroke = {along: true, done: 0, x: Math.min(340, Math.max(20, low.x - 40 * dx / far)), y: Math.min(505, low.y - 40 * dy / far)};
      }
      stroke.x += 2.6 * dx / far;
      stroke.y += 2.6 * dy / far;
      stroke.done += 2.6;
      return {kind: 'run', x: stroke.x, y: stroke.y};
    }
    if (!stroke || stroke.along || stroke.y <= 140) stroke = {x: low.x, y: Math.min(505, low.y + 40)};
    stroke.y -= 26 * .1;
    return {kind: 'run', x: stroke.x, y: stroke.y};
  };
}

const fresh = Array.from({length: 60}, (_, i) => 5000 + i * 37);
const share = runs => runs.filter(g => g.status === 'won').length / runs.length;
const percent = n => Math.round(n * 100) + '%';
const table = {careful: [], clumsy: [], naive: [], naiveOwn: []};
for (let level = 1; level <= 20; level++) {
  // The campaign always plays seed = level, so that seed is checked beside the sixty fresh ones.
  const own = play(level, level, careful);
  const runs = fresh.map(seed => play(level, seed, careful));
  assert.equal(own.status, 'won', `careful bot wins evening ${level} as the campaign deals it`);
  assert.ok(share(runs) >= .85, `careful bot wins evening ${level} on at least 85% of 60 fresh seeds: ${percent(share(runs))}`);
  table.careful.push(share(runs));
  const blunt = fresh.map(seed => playFinger(level, seed, clumsyBrain(), {late: .15, wrong: .15}));
  table.clumsy.push(share(blunt));
  const simple = fresh.slice(0, 20).map(seed => playFinger(level, seed, naiveBrain()));
  table.naive.push(share(simple));
  table.naiveOwn.push(playFinger(level, level, naiveBrain()));
}
console.log('Evening            ' + table.careful.map((_, i) => String(i + 1).padStart(4)).join(''));
console.log('Careful, 60 seeds  ' + table.careful.map(n => percent(n).padStart(4)).join(''));
console.log('Clumsy, 60 seeds   ' + table.clumsy.map(n => percent(n).padStart(4)).join(''));
console.log('Naive, 20 seeds    ' + table.naive.map(n => percent(n).padStart(4)).join(''));
console.log('Naive, own seed    ' + table.naiveOwn.map(g => (g.status === 'won' ? Math.round(g.time) + 's' : g.lost ? 'lost' : g.home + '/' + g.sheep.length).padStart(4)).join(' '));
const reach = table.naiveOwn.findIndex(g => g.status !== 'won');
console.log(`Naive bot, campaign as dealt: clears evenings 1 to ${reach < 0 ? 20 : reach} in a row` + (reach < 0 ? '.' : `, then fails evening ${reach + 1}.`));
// A known bad case: a player half a second late with half the inputs wrong must do visibly worse,
// or the lateness and the wrong inputs are not reaching the field.
const worse = [3, 12, 20].map(level => share(fresh.slice(0, 20).map(seed => playFinger(level, seed, clumsyBrain(), {late: .5, wrong: .5}))));
console.log('Very clumsy (500 ms late, 50% wrong), 20 seeds, evenings 3, 12, 20: ' + worse.map(percent).join(', '));
assert.ok(worse.slice(1).every((rate, i) => rate <= table.clumsy[[12, 20][i] - 1] - .2), 'a much clumsier player wins evenings 12 and 20 clearly less often');
for (let level = 1; level <= 7; level++) {
  assert.ok(table.clumsy[level - 1] >= .5, `clumsy bot (150 ms late, 15% wrong) wins evening ${level} on at least half of 60 seeds: ${percent(table.clumsy[level - 1])}`);
}
