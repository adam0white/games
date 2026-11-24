import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../public/crumbwar/shared/config.js';
import * as P from '../public/crumbwar/shared/proto.js';
import { stepMove, byteOf, angleOf } from '../public/crumbwar/shared/move.js';
import { Predictor } from '../public/crumbwar/shared/predict.js';
import { createWorld, step, addAnt, removeAnt, setInput, addFood, ROUND_TICKS, BREAK_TICKS } from '../src/sim.mjs';
import { think, balance, pickColony, MIN_ANTS } from '../src/bots.mjs';
import * as net from '../src/net.mjs';
import { assign } from '../src/assign.mjs';
import { largestCluster, measure } from '../loadtest/bots.mjs';
import * as bots from '../src/bots.mjs';

const run = (w, n) => { for (let i = 0; i < n; i++) { for (const a of w.ants) if (a && a.bot) think(w, a); step(w); } };
const digest = w => w.ants.filter(Boolean).map(a => [a.id, a.x.toFixed(3), a.y.toFixed(3), a.hp, a.score, a.carry].join()).join(';') + '|' + w.colonyScore + '|' + w.foodCount;
// An ant placed by hand, away from every nest, unprotected, so a test controls exactly what it meets.
function put(w, colony, x, y, heading = 0) { const a = addAnt(w, colony, false, 0, 0); Object.assign(a, { x, y, heading, protectUntil: 0 }); return a; }
// A world that is already at its food target, with the food parked in a far corner: nothing new appears.
const PARKED = 150;
const quiet = seed => { const w = createWorld(seed); for (let i = 0; i < PARKED; i++) addFood(w, 3180, 1500 + i, 1); return w; };

// Fixed geometry and neutral aim noise let these tests observe the input a bot chooses.
function botScene(id = 0) {
  const w = quiet(27);
  for (let i = 0; i < id; i++) put(w, 3, 3000, 3000);
  const a = put(w, 0, 1600, 1600); a.bot = true;
  return { w, a };
}
function decide(w, a, noise = 0.5) {
  for (const ant of w.ants) if (ant) ant.move = false;
  step(w); // Publish the hand-placed ants in the ordinary spatial grid.
  w.tick += (5 - (w.tick + a.id) % 5) % 5;
  w.rand = () => noise;
  think(w, a);
  return [Math.cos(angleOf(a.angle)), Math.sin(angleOf(a.angle))];
}

test('crowd measurement finds a disk between ants and excludes dead ants', () => {
  const p = (x, y, alive = true) => ({ x, y, alive });
  assert.equal(largestCluster([]), 0);
  assert.equal(largestCluster([p(0, 0), p(0, 0), p(0, 0, false)]), 2);
  assert.equal(largestCluster([p(-40, 0), p(40, 0)]), 2, 'the closed disk includes its boundary');
  assert.equal(largestCluster([p(-40.01, 0), p(40.01, 0)]), 1);
  const triangle = [p(40, 0), p(-20, Math.sqrt(1200)), p(-20, -Math.sqrt(1200))];
  assert.equal(largestCluster(triangle), 3, 'no ant is the center of the disk containing all three');
});

test('bots leave space beside an ally and separate even from a coincident ally', () => {
  const { w, a } = botScene();
  addFood(w, 1800, 1600, 1);
  put(w, 0, 1620, 1600);
  const [dx] = decide(w, a);
  assert.ok(dx < -0.9, 'a nearby ally outweighs the food straight ahead');
  const other = botScene();
  const ally = put(other.w, 0, 1600, 1600);
  decide(other.w, other.a);
  const first = other.a.angle;
  decide(other.w, ally);
  const dot = Math.cos(angleOf(first) - angleOf(ally.angle));
  assert.ok(dot < -0.9, 'coincident ants choose opposite escape directions');
});

test('a hurt bot goes home before chasing or foraging and keeps retreating until healed', () => {
  const { w, a } = botScene();
  put(w, 1, 1660, 1600); addFood(w, 1800, 1600, 1);
  a.hp = 2;
  let [dx, dy] = decide(w, a);
  assert.ok(dx < 0 && dy < 0, 'low health takes priority over food and a beatable enemy');
  a.hp = C.TIER_HP[a.tier] - 1;
  [dx, dy] = decide(w, a);
  assert.ok(dx < 0 && dy < 0, 'partial healing does not restart a fight');
  a.hp = C.TIER_HP[a.tier];
  [dx] = decide(w, a);
  assert.ok(dx > 0, 'full healing permits the nearby fight again');
});

test('a carrier heads home and sprints away from a nearby enemy', () => {
  const { w, a } = botScene(1);
  put(w, 1, 1660, 1600);
  a.carry = 1;
  const [dx, dy] = decide(w, a);
  assert.ok(dx < 0 && dy < 0, 'carrying takes priority over the raider pursuit');
  assert.equal(a.sprint, true);
});

test('bot ids produce stable, distinct pursuit distances', () => {
  for (const [distance, expected] of [[120, [false, true, true]], [190, [false, true, false]]]) {
    const pursuit = [];
    for (let id = 0; id < 3; id++) {
      const { w, a } = botScene(id);
      put(w, 1, a.x + distance, a.y); addFood(w, 1400, 1600, 1);
      const [dx] = decide(w, a); pursuit.push(dx > 0);
      delete a.brain; // Recreating the decision state must preserve its temperament.
      const [again] = decide(w, a);
      assert.equal(again, dx);
    }
    assert.deepEqual(pursuit, expected, `pursuit at distance ${distance}`);
  }
});

test('two closer healthy allies take an ordinary duel without exposing their private plans', () => {
  const { w, a } = botScene(1);
  put(w, 1, 1795, 1600); addFood(w, 1400, 1600, 1);
  for (const x of [1740, 1760]) {
    const ally = put(w, 0, x, 1600);
    Object.defineProperty(ally, 'brain', { get() { throw new Error('private ally state was read'); } });
  }
  const [dx] = decide(w, a);
  assert.ok(dx < -0.9, 'the farther bot forages instead of joining the chase');
});

test('a healthy raider joins one ally in an even fight; wounded allies do not reserve the fight', () => {
  for (const wounded of [false, true]) {
    const { w, a } = botScene(1);
    put(w, 1, 1790, 1600); addFood(w, 1400, 1600, 1);
    for (const x of wounded ? [1740, 1760] : [1750]) {
      const ally = put(w, 0, x, 1600);
      if (wounded) ally.hp = 1;
    }
    const [dx] = decide(w, a);
    assert.ok(dx > 0.9, 'healthy ants commit despite one closer ally or retreating allies');
  }
});

test('three nearer allies take a vulnerable target; two still allow a finishing raider', () => {
  for (const count of [2, 3]) {
    const { w, a } = botScene(1);
    const foe = put(w, 1, 1800, 1600); foe.hp = 3;
    addFood(w, 1400, 1600, 1);
    for (let i = 0; i < count; i++) put(w, 0, 1740 + i * 10, 1600);
    const [dx] = decide(w, a);
    assert.equal(dx > 0, count === 2);
  }
});

test('a guard answers an enemy near its nest beyond its ordinary pursuit range', () => {
  const { w, a } = botScene(2);
  a.x = 1170; a.y = 1000;
  put(w, 1, 1350, 1000); addFood(w, 900, 1000, 1);
  const [dx] = decide(w, a);
  assert.ok(dx > 0.9, 'guard approaches the raid at distance 180');
});

test('enemy human and bot flags produce identical targeting and steering', () => {
  const angles = [];
  for (const bot of [false, true]) {
    const { w, a } = botScene(1);
    const foe = put(w, 1, 1790, 1600); foe.bot = bot; foe.carry = 1;
    decide(w, a); angles.push([a.angle, a.move, a.sprint]);
  }
  assert.deepEqual(angles[0], angles[1]);
});

// Requirement-derived bounds. The pre-retune brain fails deaths and colony
// losses here; bite counts alone cannot pass as decisive combat.
test('six-minute seeded rooms retain food, small fights, losses and human threat', () => {
  const mean = values => values.reduce((sum, n) => sum + n, 0) / values.length;
  const floors = { 1: [102.3, 73.7, 68, 73], 12: [170.7, 154.3, 133.7, 157.7] };
  for (const people of [1, 12]) {
    const runs = [1, 7, 42].map(seed => measure(bots, people, seed));
    assert.ok(mean(runs.map(r => r.deaths)) >= 40 && mean(runs.map(r => r.deaths)) <= 80);
    for (const r of runs) {
      assert.ok(r.max <= 5 && r.crowdedPercent < 2, `${people}/${r.seed}: crowd`);
      assert.ok(r.colonyDeaths.every(n => n >= 4), `${people}/${r.seed}: colony losses`);
      assert.ok(r.foodPoints.every((n, c) => n >= floors[people][c]), `${people}/${r.seed}: food floor`);
      assert.ok(r.scoreCV <= 0.15, `${people}/${r.seed}: score CV`);
      assert.equal(r.humanNestDeaths, 0, 'human kills are bites, not nest damage');
    }
    if (people === 1) for (const r of runs) {
      assert.ok(r.humanBittenTicks >= 6, `${r.seed}: human bitten at least once per minute on average`);
      assert.ok(r.humanKilled >= 1 && r.humanKilled <= 4, `${r.seed}: human killed 1 to 4 times`);
    }
  }
});

test('a pursuing bot approaches a rear quarter and faces its target at bite range', () => {
  const { w, a } = botScene(1);
  const foe = put(w, 1, 1720, 1600, Math.PI / 2);
  let [dx, dy] = decide(w, a);
  assert.ok(dx > 0 && dy < -0.1, 'a north-facing enemy is approached from its southern rear quarter');
  foe.x = a.x + 30; foe.y = a.y; foe.heading = 0;
  [dx, dy] = decide(w, a);
  assert.ok(dx > 0.99 && Math.abs(dy) < 0.03, 'inside bite range the input faces the enemy');
});

test('bots retain the client vision square, four decisions a second and bounded aim error', () => {
  const { w, a } = botScene(1);
  addFood(w, a.x + C.VIEW, a.y + C.VIEW, 1);
  addFood(w, a.x - C.VIEW - 1, a.y, 2);
  const [dx, dy] = decide(w, a);
  assert.ok(dx > 0.6 && dy > 0.6, 'the square corner is visible and food beyond its edge is not');
  a.move = false;
  let calls = 0;
  w.rand = () => { calls++; return 0.5; };
  const frozen = [a.x, a.y, a.hp, a.stamina, a.carry];
  for (let i = 0; i < C.TICK_HZ; i++) { w.tick++; think(w, a); }
  assert.equal(calls, 4, 'aim noise is sampled only at the four decisions');
  assert.equal(a.move, true);
  assert.deepEqual([a.x, a.y, a.hp, a.stamina, a.carry], frozen, 'decisions change input without moving or healing the ant');
  assert.ok(Number.isInteger(a.angle) && a.angle >= 0 && a.angle <= 255);
  for (const noise of [0, 1]) {
    w.tick += (5 - (w.tick + a.id) % 5) % 5;
    w.rand = () => noise; think(w, a);
    const error = angleOf(a.angle) - Math.PI / 4;
    assert.ok(Math.abs(error - (noise - 0.5) * 0.35) < Math.PI / 256, 'the original aim error remains byte-quantized');
  }
});

test('the same seed and the same inputs give the same world', () => {
  const a = createWorld(7), b = createWorld(7), c = createWorld(8);
  for (const w of [a, b, c]) { balance(w); run(w, 6000); }
  assert.equal(digest(a), digest(b));
  assert.notEqual(digest(a), digest(c));
  assert.ok(a.colonyScore.reduce((s, v) => s + v) > 0, 'bots deliver food');
  assert.ok(a.ants.some(x => x && x.deaths > 0), 'bots fight');
});

test('movement stays inside the world, and sprint spends stamina', () => {
  const a = { x: 15, y: 15, heading: Math.PI, stamina: 100, tier: 0, carry: 0 };
  for (let i = 0; i < 100; i++) stepMove(a, byteOf(Math.PI * 1.25), true, true);
  assert.ok(a.x >= 10 && a.y >= 10);
  assert.ok(a.stamina < 100);
  const walk = { x: 1000, y: 1000, heading: 0, stamina: 100, tier: 0, carry: 0 }, load = { ...walk, carry: 2 }, dash = { ...walk };
  for (let i = 0; i < 20; i++) { stepMove(walk, 0, true, false); stepMove(load, 0, true, false); stepMove(dash, 0, true, true); }
  assert.ok(Math.abs(walk.x - 1000 - C.SPEED) < 1e-6);
  assert.ok(load.x < walk.x && dash.x > walk.x);
  for (let i = 0; i < 400; i++) stepMove(dash, 0, true, true);
  assert.equal(dash.stamina, 0, 'stamina runs out');
});

test('an ant picks food up, carries it home and scores for its colony', () => {
  const w = quiet(1), a = put(w, 0, 900, 900);
  addFood(w, 915, 900, 1);
  step(w);
  assert.equal(a.carry, 1);
  a.x = C.NESTS[0][0] + 10; a.y = C.NESTS[0][1];
  step(w);
  assert.deepEqual([a.carry, a.score, w.colonyScore[0]], [0, 1, 1]);
});

test('a bite lands only on an enemy in front, and two ants that face each other both bite', () => {
  const w = quiet(2), a = put(w, 0, 1600, 1600, 0), front = put(w, 1, 1620, 1600, 0), behind = put(w, 1, 1580, 1600, Math.PI), friend = put(w, 0, 1615, 1612, Math.PI / 2);
  const c = put(w, 2, 2000, 1600, 0), d = put(w, 3, 2020, 1600, Math.PI);
  step(w);
  assert.equal(front.hp, C.TIER_HP[0] - 1, 'the enemy in front is bitten');
  assert.equal(behind.hp, C.TIER_HP[0], 'the enemy behind is not');
  assert.equal(friend.hp, C.TIER_HP[0], 'a colony-mate is never bitten');
  assert.equal(a.hp, C.TIER_HP[0], 'an enemy facing away cannot bite back');
  assert.deepEqual([c.hp, d.hp], [4, 4], 'two ants facing each other both land their bite on the same tick');
  const hp = front.hp; step(w);
  assert.equal(front.hp, hp, 'a bite needs half a second to be ready again');
});

test('protection after a respawn, the safe nest and the guards', () => {
  const w = quiet(3), a = put(w, 0, 1600, 1600, 0), b = put(w, 1, 1620, 1600, Math.PI);
  b.protectUntil = 100; step(w);
  assert.deepEqual([a.hp, b.hp], [5, 5], 'a protected ant is not bitten and does not bite');
  const home = put(w, 2, C.NESTS[2][0] + 20, C.NESTS[2][1], 0), raider = put(w, 0, C.NESTS[2][0] - 5, C.NESTS[2][1], 0);
  for (let i = 0; i < 9; i++) step(w);
  assert.equal(home.hp, 5, 'an ant in its own nest is not bitten');
  assert.ok(raider.hp < 5, 'the nest hurts an enemy inside it');
});

test('a kill scores, drops the food and costs the victim a tier', () => {
  const w = quiet(4), a = put(w, 0, 1600, 1600, 0), b = put(w, 1, 1620, 1600, 0);
  b.tier = 2; b.hp = 1; b.carry = 1;
  step(w);
  assert.deepEqual([b.alive, b.tier, a.kills, a.score, w.foodCount - PARKED], [false, 1, 1, 4, 1]);
  assert.deepEqual(w.events, [[1, a.id, b.id]]);
  for (let i = 0; i < 61; i++) step(w);
  assert.ok(b.alive && Math.hypot(b.x - C.NESTS[1][0], b.y - C.NESTS[1][1]) < 50, 'it comes back at its nest');
});

test('a round ends, names a winner, rests, and starts clean', () => {
  const w = createWorld(5); balance(w);
  run(w, ROUND_TICKS);
  assert.ok(w.breakUntil > 0 && w.lastWinner >= 0);
  const frozen = [...w.colonyScore];
  run(w, BREAK_TICKS - 1);
  assert.deepEqual(w.colonyScore, frozen, 'nothing scores in the break');
  run(w, 1);
  assert.deepEqual([w.colonyScore, w.round, w.breakUntil], [[0, 0, 0, 0], 2, 0]);
});

test('bots fill the room, keep the colonies even, and leave as people join', () => {
  const w = createWorld(6); balance(w);
  const count = () => { const n = [0, 0, 0, 0], p = [0, 0, 0, 0]; for (const a of w.ants) if (a) { n[a.colony]++; if (!a.bot) p[a.colony]++; } return [n, p]; };
  assert.deepEqual(count()[0], [8, 8, 8, 8]);
  assert.equal(w.count, MIN_ANTS);
  const people = [];
  for (let i = 0; i < 30; i++) { people.push(addAnt(w, pickColony(w), false, 0, 0)); balance(w); }
  let [n, p] = count();
  assert.ok(Math.max(...p) - Math.min(...p) <= 1, 'people are spread evenly');
  assert.ok(new Set(n).size === 1 && n[0] === Math.max(MIN_ANTS / C.COLONIES, ...p), 'every colony has the same number of ants');
  for (const a of people.filter(a => a.colony === 0)) removeAnt(w, a);
  balance(w); [n, p] = count();
  assert.deepEqual([p[0], new Set(n).size], [0, 1], 'bots stand in for a colony whose people left');
});

// The check that matters for the netcode: after every snapshot, what a client holds must equal what the
// server has inside the client's square, and must hold nothing from outside it.
test('a client rebuilt from deltas matches the server, and sees nothing beyond its square', () => {
  const w = createWorld(9); balance(w);
  const me = addAnt(w, 0, true, 1, 2), view = net.newView(), ants = new Map(), food = new Map();
  let bytes = 0, snaps = 0, sawFar = 0;
  for (let t = 0; t < 1600; t++) {
    if (t === 800) { const o = w.ants.find(a => a && a !== me); removeAnt(w, o); addAnt(w, o.colony, true, 3, 4); } // an id is reused between two snapshots
    run(w, 1);
    if (t % C.SNAP_EVERY) continue;
    const msg = net.snapshot(w, me, view, 0), r = new P.Reader(msg);
    assert.equal(r.u8(), P.SNAP);
    const s = P.readSnap(r, ants, food, C.POS_Q, C.OWN_Q);
    assert.equal(r.n, msg.length, 'every byte is read');
    bytes += msg.length; snaps++;
    assert.ok(Math.abs(s.x - me.x) <= 1 / C.OWN_Q && s.alive === me.alive);
    for (const o of w.ants) {
      if (!o || o === me) continue;
      const inside = o.alive && Math.abs(o.x - me.x) <= C.VIEW && Math.abs(o.y - me.y) <= C.VIEW, got = ants.get(o.id);
      if (inside) {
        assert.ok(got, `ant ${o.id} is in the square at tick ${w.tick}`);
        assert.deepEqual([got.qx, got.qy, got.heading, got.hp, got.carry, got.tier, got.colony, got.nameA], [Math.round(o.x * C.POS_Q), Math.round(o.y * C.POS_Q), byteOf(o.heading), Math.max(0, o.hp), o.carry, o.tier, o.colony, o.nameA]);
      }
      if (got && (!o.alive || Math.abs(o.x - me.x) > C.VIEW_LEAVE || Math.abs(o.y - me.y) > C.VIEW_LEAVE)) sawFar++;
    }
    for (const [id, f] of food) assert.ok(w.fkind[id] === f.kind && Math.abs(w.fx[id] - me.x) <= C.VIEW_LEAVE + 1, 'known food exists and is near');
    for (let id = 0; id < C.MAX_FOOD; id++) if (w.fkind[id] && Math.abs(w.fx[id] - me.x) <= C.VIEW && Math.abs(w.fy[id] - me.y) <= C.VIEW && view.food[id] === w.fgen[id]) assert.ok(food.has(id));
  }
  assert.equal(sawFar, 0, 'no ant outside the square is ever known to the client');
  assert.ok(ants.size < w.count - 1, 'the square is smaller than the room');
  assert.ok(bytes / snaps < 400, `mean snapshot ${Math.round(bytes / snaps)} bytes`);
});

test('scores, welcome and events decode', () => {
  const w = createWorld(10); balance(w); run(w, 400);
  const me = w.ants.find(Boolean), ranked = w.ants.filter(Boolean).sort((a, b) => b.score - a.score);
  let r = new P.Reader(net.scores(w, ranked, me, 3)); assert.equal(r.u8(), P.SCORES);
  const s = P.readScores(r);
  assert.deepEqual([s.colony, s.people, s.ants, s.top.length, s.top[0].score, s.rank], [w.colonyScore, 3, w.count, 5, ranked[0].score, ranked.indexOf(me) + 1]);
  r = new P.Reader(net.welcome(me, 77, 0xdeadbeef, 0x1234, 'enam-0')); assert.equal(r.u8(), P.WELCOME);
  assert.deepEqual(P.readWelcome(r), { proto: C.PROTO, id: me.id, colony: me.colony, nameA: me.nameA, nameB: me.nameB, tick: 77, token: 'deadbeef00001234', room: 'enam-0' });
});

// Prediction against a real delay. Inputs reach the server `up` ticks late and snapshots reach the client
// `down` ticks late. With a steady delay the replayed position must equal what the server reaches later.
for (const [up, down] of [[0, 0], [2, 3], [5, 6]]) test(`prediction replays to the server's future position (delay ${up}+${down} ticks)`, () => {
  const w = quiet(11), a = put(w, 0, 1600, 1600, 0), view = net.newView(), p = new Predictor(), toServer = [], toClient = [], truth = [];
  let ack = 0, worst = 0, rand = createWorld(1).rand, angle = 0, move = true, sprint = false;
  Object.assign(p.me, { x: a.x, y: a.y, heading: 0, alive: true });
  for (let t = 1; t <= 600; t++) {
    if (t % 13 === 0) angle = rand() * 256 | 0;
    if (t % 47 === 0) sprint = !sprint;
    if (t % 97 === 0) move = !move;
    const out = p.step(angle, move, sprint);
    if (out) toServer.push([t + up, out]);
    while (toServer.length && toServer[0][0] <= t) { const b = toServer.shift()[1]; setInput(w, a, b[3], b[4] & 1, b[4] & 2); ack = b[1] | b[2] << 8; }
    step(w); truth[w.tick] = [a.x, a.y];
    if (t % C.SNAP_EVERY === 0) toClient.push([t + down, net.snapshot(w, a, view, ack)]);
    while (toClient.length && toClient[0][0] <= t) { const r = new P.Reader(toClient.shift()[1]); r.u8(); p.onSnap(P.readSnap(r, new Map(), new Map(), C.POS_Q, C.OWN_Q)); }
    // The server runs `up` ticks behind the client's inputs, so the client's position now is the server's `up` ticks from now.
    if (t > 40) truth.pending = (truth.pending || []).concat([[w.tick + up, p.me.x, p.me.y]]);
  }
  for (const [tick, x, y] of truth.pending) if (truth[tick]) worst = Math.max(worst, Math.hypot(x - truth[tick][0], y - truth[tick][1]));
  assert.ok(worst < 1.5, `worst error ${worst.toFixed(2)} units`);
  assert.ok(up + down === 0 || p.replayed >= up + down - 1, `replayed ${p.replayed} ticks`);
});

test('a snapshot the page cannot match to an input still lands on the server position', () => {
  const p = new Predictor(); p.me.alive = true;
  p.onSnap({ x: 500, y: 600, heading: 0, stamina: 50, tier: 1, carry: 0, alive: true, ackSeq: 999, applied: 3 });
  assert.deepEqual([p.me.x, p.me.y, p.replayed], [500, 600, 0]);
});

test('the directory packs the fullest room with space and replaces a full one', () => {
  const rooms = new Map();
  assert.equal(assign(rooms, 'weur', 4, [], 0), 'weur-0');
  rooms.get('weur-0').people = 3; rooms.set('weur-1', { people: 1, at: 0, pending: [] });
  assert.equal(assign(rooms, 'weur', 4, [], 6000), 'weur-0', 'fullest with space');
  assert.equal(assign(rooms, 'weur', 4, [], 6001), 'weur-1', 'a join on its way counts');
  rooms.get('weur-1').people = 4;
  assert.equal(assign(rooms, 'weur', 4, [], 20000), 'weur-0');
  assert.equal(assign(rooms, 'weur', 4, ['weur-0'], 30000), 'weur-2', 'a room that refused is skipped');
  assert.equal(assign(rooms, 'weur', 4, [], 30000 + 50000), 'weur-0', 'rooms that stop reporting are forgotten');
  assert.equal(rooms.size, 1);
});

test('one to five people share thirty-two ants, with every bot marked', () => {
  for (let people = 1; people <= 5; people++) {
    const w = createWorld(42);
    for (let i = 0; i < people; i++) { addAnt(w, pickColony(w), false, 0, 0); balance(w); }
    assert.equal(w.count, 32);
    assert.equal(w.ants.filter(a => a?.bot).length, 32 - people);
    const me = w.ants.find(a => a && !a.bot), ants = new Map();
    step(w);
    const r = new P.Reader(net.snapshot(w, me, net.newView(), 0)); r.u8();
    P.readSnap(r, ants, new Map(), C.POS_Q, C.OWN_Q);
    for (const a of ants.values()) assert.equal(a.bot, w.ants[a.id].bot);
  }
});

test('food replenishes in the shared middle, including after a round reset', () => {
  const w = createWorld(42); balance(w);
  const check = () => {
    assert.ok(w.foodCount >= 150);
    for (let id = 0; id < C.MAX_FOOD; id++) if (w.fkind[id]) {
      assert.ok(Math.abs(w.fx[id] - C.WORLD / 2) <= 250);
      assert.ok(Math.abs(w.fy[id] - C.WORLD / 2) <= 250);
    }
  };
  for (let i = 0; i < 100; i++) step(w);
  check();
  w.tick = w.roundEnd - 1; step(w);
  w.tick = w.breakUntil - 1; step(w);
  for (let i = 0; i < 100; i++) step(w);
  check();
});

test('a bot with no visible target heads toward the public food patch', () => {
  const w = createWorld(42), a = addAnt(w, 0, true, 0, 0);
  think(w, a);
  const toward = Math.atan2(C.WORLD / 2 - a.y, C.WORLD / 2 - a.x);
  assert.ok(Math.abs(angleOf(a.angle) - toward) < 0.2);
  assert.ok(a.move);
});

// People follow the marker, then wait in the patch. This measures traffic, not fun.
test('small rooms meet enemies before twenty seconds and keep traffic in the patch', t => {
  let latestEnemy = 0, worstEmpty = 0, worstGap = 0;
  for (const seed of [1, 7, 42]) for (const people of [1, 2, 3, 4, 5]) {
    const w = createWorld(seed), humans = [];
    for (let i = 0; i < people; i++) { humans.push(addAnt(w, pickColony(w), false, 0, 0)); balance(w); }
    let firstEnemy = Infinity, empty = 0, samples = 0, longest = 0, gap = 0, bites = 0;
    for (let t = 0; t < 120 * C.TICK_HZ; t++) {
      for (const a of w.ants) if (a?.bot) think(w, a);
      for (const a of humans) {
        const dx = C.WORLD / 2 - a.x, dy = C.WORLD / 2 - a.y;
        setInput(w, a, byteOf(Math.atan2(dy, dx)), Math.hypot(dx, dy) > 50, false);
      }
      step(w);
      // Retreat can end a fight without a death. Require actual bot attacks in every scenario.
      for (const a of w.ants) if (a?.bot && a.biteAt === w.tick + 10) bites++;
      const me = humans[0];
      let others = 0;
      for (const a of w.ants) if (a && a !== me && a.alive && Math.abs(a.x - me.x) <= 550 * 390 / 844 && Math.abs(a.y - me.y) <= 550) {
        others++;
        if (a.colony !== me.colony) firstEnemy = Math.min(firstEnemy, w.tick);
      }
      if (w.tick > 20 * C.TICK_HZ) {
        samples++; if (!others) empty++;
        gap = others ? 0 : gap + 1; longest = Math.max(longest, gap);
      }
    }
    latestEnemy = Math.max(latestEnemy, firstEnemy / C.TICK_HZ);
    worstEmpty = Math.max(worstEmpty, empty / samples); worstGap = Math.max(worstGap, longest / C.TICK_HZ);
    const label = `seed ${seed}, people ${people}`;
    assert.ok(firstEnemy < 20 * C.TICK_HZ, label);
    assert.ok(empty / samples < 0.15, `${label}: empty fraction ${empty / samples}`);
    assert.ok(longest < 6 * C.TICK_HZ, `${label}: empty ticks ${longest}`);
    assert.ok(bites > 0, `${label}: bots bite`);
  }
  t.diagnostic(`Latest first enemy ${latestEnemy}s; worst empty fraction ${worstEmpty.toFixed(3)}; longest empty stretch ${worstGap}s`);
});


test('a room that shrinks clears distant food and replenishes the middle', () => {
  const w = createWorld(42), people = [];
  for (let i = 0; i < 240; i++) people.push(addAnt(w, i % C.COLONIES, false, 0, 0));
  for (let t = 0; t < 100; t++) step(w);
  assert.ok(w.fx.some((x, id) => w.fkind[id] && Math.abs(x - C.WORLD / 2) > 250));
  const me = people[0], view = net.newView(), food = new Map(), ants = new Map();
  // A client that already knows the far food must receive its removal too.
  me.x = 1600; me.y = 1600;
  let r = new P.Reader(net.snapshot(w, me, view, 0)); r.u8(); P.readSnap(r, ants, food, C.POS_Q, C.OWN_Q);
  for (const a of people.slice(1)) removeAnt(w, a);
  balance(w); step(w);
  assert.equal(w.count, 32);
  for (let id = 0; id < C.MAX_FOOD; id++) if (w.fkind[id]) assert.ok(Math.abs(w.fx[id] - 1600) <= 250 && Math.abs(w.fy[id] - 1600) <= 250);
  r = new P.Reader(net.snapshot(w, me, view, 0)); r.u8(); P.readSnap(r, ants, food, C.POS_Q, C.OWN_Q);
  for (const id of food.keys()) assert.ok(w.fkind[id], 'removed food leaves the client view');
  for (let t = 0; t < 100; t++) step(w);
  assert.ok(w.foodCount >= 150);
});

// ---- Version check at join (DECISIONS.md, "Version check") ----
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pageVerdict, mayReload, LEGACY_PROTO } from '../public/crumbwar/shared/version.js';
import { ROOM_COUNTS, delta, fold, summarize, hourOf, HOUR } from '../src/metrics.mjs';

test('the Worker reloads a page of any other version and lets a page from before the check through', () => {
  assert.equal(pageVerdict(String(C.PROTO), C.PROTO), 'ok');
  assert.equal(pageVerdict(String(C.PROTO - 1), C.PROTO), 'reload', 'an older page (cached, or open across a deploy)');
  assert.equal(pageVerdict(String(C.PROTO + 1), C.PROTO), 'reload', 'a newer page (after a rollback): the reload fetches the page now served');
  assert.equal(pageVerdict('x', C.PROTO), 'reload');
  assert.equal(pageVerdict(null, C.PROTO), 'legacy');
  assert.equal(pageVerdict('', C.PROTO), 'legacy');
});

test('a page reloads for an update once, not in a loop', () => {
  const mem = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
  const s = mem();
  assert.equal(mayReload(s, 1_000_000), true, 'first ask reloads');
  assert.equal(mayReload(s, 1_000_500), false, 'the same ask right after the reload does not');
  assert.equal(mayReload(s, 1_059_999), false);
  assert.equal(mayReload(s, 1_060_000), true, 'a later update, a minute on, reloads again');
  assert.equal(mayReload(null, 5), false, 'no storage: no reload, because nothing would stop a loop');
  assert.equal(mayReload({ getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } }, 5), false);
  assert.equal(mayReload({ getItem: () => null, setItem() {} }, 5), false, 'storage that drops writes: no reload');
  const back = mem(); back.setItem('crumbwar:reloadAt', '9000000'); // a clock that went backwards does not block for ever
  assert.equal(mayReload(back, 100), true);
});

test('the directory does not offer a room of another protocol to new people', () => {
  const rooms = new Map([['enam-0', { people: 30, at: 0, pending: [], proto: C.PROTO + 1 }], ['enam-1', { people: 5, at: 0, pending: [], proto: C.PROTO }]]);
  assert.equal(assign(rooms, 'enam', 58, [], 1000, C.PROTO), 'enam-1', 'the fuller room runs other code, so the other one is chosen');
  // The known bad case: without the filter the old room wins, because it is the fullest.
  assert.equal(assign(new Map([['enam-0', { people: 30, at: 0, pending: [], proto: C.PROTO + 1 }]]), 'enam', 58, [], 1000), 'enam-0');
  // A room that never reported a protocol is from before the check and ran LEGACY_PROTO.
  const legacy = new Map([['enam-0', { people: 10, at: 0, pending: [] }]]);
  assert.equal(assign(legacy, 'enam', 58, [], 1000, LEGACY_PROTO), 'enam-0');
  assert.equal(assign(legacy, 'enam', 58, [], 1000, LEGACY_PROTO + 1), 'enam-1', 'a new name is opened, not the old room');
  assert.equal(legacy.get('enam-1').proto, LEGACY_PROTO + 1, 'a room opened by the directory is listed with the asking protocol');
});

// The page and the server mix only if these files agree. When one changes, decide whether a page and a room of
// the two versions can still play together. If not, raise PROTO in config.js. Then record the new fingerprint here.
test('a change to the wire format or the shared constants is a decision about PROTO', () => {
  const files = ['public/crumbwar/shared/config.js', 'public/crumbwar/shared/proto.js', 'public/crumbwar/shared/move.js', 'public/crumbwar/shared/predict.js', 'src/net.mjs', 'public/crumbwar/shared/modes.js'];
  const h = createHash('sha256');
  for (const f of files) h.update(f).update('\0').update(readFileSync(new URL('../' + f, import.meta.url))).update('\0');
  const now = [C.PROTO, h.digest('hex').slice(0, 16)];
  assert.deepEqual(now, PROTO_FINGERPRINT, `shared code changed. Bump PROTO if old pages and new rooms (or the reverse) cannot play together, then set PROTO_FINGERPRINT to ${JSON.stringify(now)}`);
});
const PROTO_FINGERPRINT = [3, '0ef04c51a20ccc13'];

test('kick and refusal counters fold into hourly totals', () => {
  const room = readFileSync(new URL('../src/room.mjs', import.meta.url), 'utf8');
  const used = new Set([...room.matchAll(/'(kick[A-Z]\w+|refused[A-Z]\w+|sendFailed|closedByClient|socketErrors)'|stat\.(kick[A-Z]\w+|refused[A-Z]\w+|sendFailed|closedByClient|socketErrors)/g)].map(m => m[1] || m[2]));
  assert.ok(used.size >= 13, `room.mjs counts ${[...used]}`);
  for (const k of used) assert.ok(ROOM_COUNTS.includes(k), `${k} is a counter the room reports`);
  const stat = Object.fromEntries(ROOM_COUNTS.map(k => [k, 0])), sent = {};
  stat.joins = 3; stat.kickNoPing = 1;
  assert.deepEqual(delta(stat, sent), { joins: 3, kickNoPing: 1 });
  stat.joins = 4;
  assert.deepEqual(delta(stat, sent), { joins: 1 }, 'only the change since the last report');
  const t = {};
  fold(t, { joins: 2, peakPeople: 7, roomMinutes: 1 }); fold(t, { joins: 1, peakPeople: 5, roomMinutes: 1, bad: -1, 'x y': 3, worse: 'a' });
  assert.deepEqual(t, { joins: 3, peakPeople: 7, roomMinutes: 2 }, 'sums add, peaks keep the largest, bad input is dropped');
  const h0 = hourOf(Date.UTC(2026, 10, 24, 5, 30)), h1 = h0 + HOUR;
  const s = summarize({ enam: [{ hour: h0, key: 'joins', v: 2 }, { hour: h1, key: 'joins', v: 1 }, { hour: h1, key: 'peakPeople', v: 4 }], weur: [{ hour: h1, key: 'peakPeople', v: 9 }], lt: [{ hour: h1, key: 'joins', v: 50 }], sam: [] });
  assert.deepEqual(s.regions.enam, [{ hour: new Date(h1).toISOString(), joins: 1, peakPeople: 4 }, { hour: new Date(h0).toISOString(), joins: 2 }]);
  assert.deepEqual(s.totals, { joins: 3, peakPeople: 9 }, 'load test rooms stay out of the totals');
  assert.equal(s.regions.sam, undefined);
});

// Feast acceptance is expressed as observable outcomes, independent of bot policy.
import { RANKS, RANK_AT, rankOf, GRASS, inGrass, MODES } from '../public/crumbwar/shared/modes.js';
const FEAST = MODES.feast;
const feastScene = (seed = 71) => { const w = createWorld(seed, 'feast'); w.tick = 2; for (let i = 0; i < 160; i++) addFood(w, 3100, 2200 + i, 1); return w; };
const stillSteps = (w, n) => { for (let i = 0; i < n; i++) step(w); };
const closeTo = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);

test('feast: size ratio controls eating from every direction, without colony allies', () => {
  for (const theta of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const w = feastScene(), large = put(w, 0, 800, 800, 0), small = put(w, 0, 800 + 15 * Math.cos(theta), 800 + 15 * Math.sin(theta), theta);
    large.mass = 15; small.mass = 12; // Exact 1.25 boundary, below shrink threshold.
    step(w);
    assert.equal(small.alive, false, `contact at ${theta} radians eats`);
    assert.equal(large.kills, 1);
    assert.equal(w.colonyScore.reduce((a, b) => a + b), 0);
  }
  const w = feastScene(), a = put(w, 0, 800, 800), b = put(w, 0, 810, 800);
  a.mass = 14.99; b.mass = 12; step(w);
  assert.ok(a.alive && b.alive, 'below 1.25 neither ant is eaten');
});

test('feast: protection blocks eating by either participant and grass blocks contact', () => {
  for (const protect of ['large', 'small', 'none']) {
    const w = feastScene(), [gx, gy] = GRASS[0];
    const x = protect === 'none' ? gx : 800, y = protect === 'none' ? gy : 800;
    const large = put(w, 0, x, y), small = put(w, 0, x + 10, y);
    large.mass = 50; small.mass = 12;
    if (protect === 'large') large.protectUntil = w.tick + 10;
    if (protect === 'small') small.protectUntil = w.tick + 10;
    step(w);
    assert.ok(large.alive && small.alive, protect);
  }
});

test('feast: grass never contains food, including direct additions and Queen trails', () => {
  const w = feastScene();
  for (const [x, y] of GRASS) assert.equal(addFood(w, x, y, 1), -1, 'grass rejects food');
  const [gx, gy, radius] = GRASS[0], queen = put(w, 0, gx + radius + 10, gy, 0);
  queen.mass = 90; queen.rank = 5; w.tick = 39; step(w);
  for (let id = 0; id < C.MAX_FOOD; id++) if (w.fkind[id]) assert.equal(inGrass(w.fx[id], w.fy[id]), false, 'trail and cluster food stay outside grass');
});

test('feast: eaten ants retain sixty percent, return in two seconds, and avoid predators', () => {
  const w = feastScene(), predator = put(w, 0, 800, 800), victim = put(w, 0, 810, 800);
  predator.mass = 60; victim.mass = 30;
  step(w);
  const before = 30 - (30 - 16) * FEAST.shrink * C.DT;
  closeTo(victim.mass, before * .6);
  closeTo(predator.mass, 60 - (60 - 16) * FEAST.shrink * C.DT + before * .4 * FEAST.gain);
  assert.equal(victim.respawnAt - w.tick, 2 * C.TICK_HZ);
  const retained = victim.mass;
  predator.x = 1600; predator.y = 1600;
  stillSteps(w, 2 * C.TICK_HZ - 1); assert.equal(victim.alive, false);
  step(w); assert.equal(victim.alive, true);
  closeTo(victim.mass, retained);
  assert.equal(victim.protectUntil - w.tick, 4 * C.TICK_HZ);
  assert.ok(Math.hypot(victim.x - predator.x, victim.y - predator.y) > 500, 'respawn is far from the dangerous ant');
  const low = feastScene(), eater = put(low, 0, 800, 800), egg = put(low, 0, 810, 800); eater.mass = 20;
  step(low); assert.equal(egg.mass, 10, 'retention has a ten-size floor');
});

test('feast: excess size shrinks, small ants move faster, and sprint costs size', () => {
  const w = feastScene(), large = put(w, 0, 800, 800), small = put(w, 0, 400, 400);
  large.mass = 60; stillSteps(w, 20);
  assert.ok(large.mass < 60 && large.mass > 59, 'decay is gradual');
  const base = { mode: 'feast', mass: 10, x: 400, y: 400, heading: 0, tier: 0, carry: 0, stamina: 100 };
  const light = { ...base }, heavy = { ...base, mass: 80 };
  stepMove(light, 0, true, false); stepMove(heavy, 0, true, false);
  assert.ok(light.x > heavy.x, 'small ants can outrun big ants');
  small.mass = 15; setInput(w, small, 0, true, true); const stamina = small.stamina;
  step(w); closeTo(small.mass, 15 - FEAST.sprintCost * C.DT); assert.equal(small.stamina, stamina);
});

test('feast: cake needs sixty uninterrupted nearby ticks and is worth its cake growth', () => {
  const w = feastScene(), a = put(w, 0, 800, 800), cake = addFood(w, 800, 800, 3);
  stillSteps(w, 59); assert.equal(w.fkind[cake], 3); assert.equal(a.mass, 10);
  step(w); assert.equal(w.fkind[cake], 0); assert.equal(a.mass, 10 + FEAST.cakeGrowth);
  const next = addFood(w, 800, 800, 3); stillSteps(w, 30); a.x = 900; step(w); a.x = 800; stillSteps(w, 30);
  assert.equal(w.fkind[next], 3, 'leaving resets chewing progress');
});

test('feast: rank thresholds, promotion, best rank and size reset survive a full round', () => {
  assert.deepEqual(RANKS, ['Egg', 'Worker', 'Forager', 'Soldier', 'Major', 'Queen']);
  assert.deepEqual([10, 16, 28, 46, 75, 120].map(rankOf), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual([15.99, 27.99, 45.99, 74.99, 119.99].map(rankOf), [0, 1, 2, 3, 4]);
  const w = feastScene(), a = put(w, 0, 800, 800); a.mass = RANK_AT[1] - FEAST.crumbGrowth; addFood(w, 800, 800, 1); step(w);
  assert.deepEqual([a.rank, a.bestRank], [1, 1]);
  a.mass = 11; step(w); assert.deepEqual([a.rank, a.bestRank], [0, 1]);
  assert.equal(w.roundEnd, 240 * C.TICK_HZ);
  w.tick = w.roundEnd - 1; setInput(w, a, 0, true, true); const state = [a.x, a.y, a.mass]; step(w);
  assert.deepEqual([a.x, a.y, a.mass], state, 'the round-end tick is already in the break');
  assert.equal(w.breakUntil - w.tick, 10 * C.TICK_HZ);
  const predator = put(w, 0, a.x + 10, a.y); predator.mass = 80;
  const dead = put(w, 0, 900, 900); dead.alive = false; dead.respawnAt = w.tick + 1;
  stillSteps(w, 10 * C.TICK_HZ - 1);
  assert.deepEqual([a.x, a.y, a.mass], state, 'movement and size freeze throughout break');
  assert.equal(dead.alive, false, 'respawns wait until the break ends');
  assert.equal(a.alive, true, 'a touching predator cannot eat during the break');
  step(w); assert.deepEqual([w.round, w.breakUntil, a.mass, a.rank, a.bestRank], [2, 0, 10, 0, 0]);
});

test('feast: seeded clusters move, cake appears, and no generated food enters grass', () => {
  const w = createWorld(83, 'feast'), twin = createWorld(83, 'feast');
  step(w); step(twin); assert.deepEqual(w.feature, twin.feature); const initial = { ...w.feature };
  stillSteps(w, 499); stillSteps(twin, 499);
  assert.deepEqual(w.feature, twin.feature); assert.notDeepEqual(w.feature, initial);
  stillSteps(w, 500); assert.equal(w.feature.kind, 3);
  assert.ok(w.fkind.includes(3), 'scheduled cake exists');
  for (let id = 0; id < C.MAX_FOOD; id++) if (w.fkind[id]) assert.equal(inGrass(w.fx[id], w.fy[id]), false);
});

test('feast: bots fill twenty-four ants and snapshots preserve labels, size deltas and own ranks', () => {
  const w = createWorld(93, 'feast'), me = put(w, 0, 800, 800); balance(w);
  assert.equal(w.count, 24); assert.equal(w.ants.filter(a => a?.bot).length, 23);
  const other = w.ants.find(a => a?.bot); Object.assign(other, { x: 900, y: 800, mass: 42, protectUntil: 1000 }); me.protectUntil = 1000;
  const view = net.newView(), ants = new Map(), food = new Map();
  const snap = () => { const msg = net.snapshot(w, me, view, 0), r = new P.Reader(msg); assert.equal(r.u8(), P.SNAP); const s = P.readSnap(r, ants, food, C.POS_Q, C.OWN_Q); assert.equal(r.n, msg.length); return s; };
  step(w); const first = snap(); assert.equal(ants.get(other.id).bot, true); assert.ok(Number.isInteger(ants.get(other.id).mass) && Math.abs(ants.get(other.id).mass - other.mass) < 1, 'other ant sizes use integer precision');
  assert.deepEqual([first.mode, first.rank, first.bestRank], [1, me.rank, me.bestRank]);
  other.mass = 49; step(w); snap(); assert.ok(Number.isInteger(ants.get(other.id).mass) && Math.abs(ants.get(other.id).mass - other.mass) < 1, 'other ant sizes use integer precision');
  other.x = 3100; other.y = 3100; step(w); snap(); assert.equal(ants.has(other.id), false);
  const wr = new P.Reader(net.welcome(me, 77, 1, 2, 'enam-0', 'feast')); wr.u8(); assert.equal(P.readWelcome(wr).mode, 1);
  const ranked = w.ants.filter(Boolean).sort((a, b) => b.score - a.score), sr = new P.Reader(net.scores(w, ranked, me, 1)); sr.u8(); const s = P.readScores(sr);
  assert.deepEqual([s.mode, s.bestRank, s.delivered, s.kills, s.deaths], [1, me.bestRank, me.delivered, me.kills, me.deaths]);
  assert.equal(sr.n, sr.v.byteLength);
});

const rushScene = (seed = 101) => { const w = createWorld(seed, 'rush'); w.tick = 2; for (let i = 0; i < 160; i++) addFood(w, 3100, 2200 + i, 1); return w; };

test('rush: two-minute rounds freeze for eight seconds then reset all progress', () => {
  const w = rushScene(), a = put(w, 0, 800, 800);
  Object.assign(a, { score: 17, deliveries: 4, goal: 2, goalIndex: 2, goalProgress: 1, participation: 31, boostUntil: 9999, shieldUntil: 9999 });
  w.colonyScore = [3, 9, 6, 2]; assert.equal(w.roundEnd, 120 * C.TICK_HZ);
  w.tick = w.roundEnd - 1; setInput(w, a, 0, true, false); step(w);
  assert.equal(w.lastWinner, 1); assert.equal(w.breakUntil - w.tick, 8 * C.TICK_HZ);
  const frozen = [a.x, a.y, a.score, ...w.colonyScore]; stillSteps(w, 8 * C.TICK_HZ - 1);
  assert.deepEqual([a.x, a.y, a.score, ...w.colonyScore], frozen);
  step(w);
  assert.deepEqual([w.round, w.breakUntil, a.score, a.deliveries, a.goal, a.goalProgress, a.participation, a.boostUntil, a.shieldUntil], [2, 0, 0, 0, 0, 0, 0, 0, 0]);
});

test('rush: golden crumb has a marker, is worth five at home and clears its marker on pickup', () => {
  const w = createWorld(111, 'rush'); step(w);
  const id = w.goldenId; assert.ok(id >= 0); assert.equal(w.fkind[id], 2);
  assert.deepEqual(w.feature, { x: w.feature.x, y: w.feature.y, kind: 2 });
  closeTo(w.fx[id], w.feature.x, .001); closeTo(w.fy[id], w.feature.y, .001);
  const a = put(w, 0, w.fx[id], w.fy[id]); step(w);
  assert.equal(a.carry, 2); assert.equal(a.participation & 2, 2); assert.equal(w.goldenId, -1); assert.equal(w.feature.kind, 5);
  [a.x, a.y] = C.NESTS[0]; step(w);
  assert.deepEqual([a.carry, a.score, a.delivered, w.colonyScore[0]], [0, 5, 5, 5]);
});

test('rush: seeds grant six-second speed and shield effects without taking the carry slot', () => {
  for (const kind of [3, 4]) {
    const w = rushScene(), a = put(w, 0, 800, 800); addFood(w, 800, 800, kind); step(w);
    assert.equal(a.carry, 0); assert.equal(a.participation & 4, 4); assert.equal(a.score, 1);
    assert.equal((kind === 3 ? a.boostUntil : a.shieldUntil) - w.tick, 6 * C.TICK_HZ);
    if (kind === 3) {
      const start = a.x; setInput(w, a, 0, true, false); step(w); closeTo(a.x - start, C.SPEED * C.DT * 1.3);
      w.tick = a.boostUntil - 1; const old = a.x; step(w); closeTo(a.x - old, C.SPEED * C.DT);
    } else {
      const attacker = put(w, 1, 780, 800, 0); step(w); assert.equal(a.hp, 5, 'shield stops a bite');
      w.tick = a.shieldUntil - 1; attacker.biteAt = 0; step(w); assert.equal(a.hp, 4, 'shield expires at its deadline');
    }
  }
});

test('rush: the hill pays its unique majority every four seconds and never pays a tie', () => {
  const w = rushScene(), a = put(w, 0, 1550, 1600), b = put(w, 0, 1650, 1600), enemy = put(w, 1, 1600, 1500);
  for (const ant of [a, b, enemy]) { ant.protectUntil = 10000; ant.goal = -1; }
  const outside = put(w, 2, 1741, 1600); outside.protectUntil = 10000; outside.goal = -1;
  w.tick = 78; step(w); assert.equal(w.colonyScore[0], 0); step(w);
  assert.deepEqual(w.colonyScore, [2, 0, 0, 0]); assert.deepEqual([a.score, b.score, enemy.score, outside.score], [2, 2, 0, 0]);
  assert.equal(a.participation & 8, 8); assert.equal(outside.participation & 8, 0);
  b.x = 2000; b.y = 2000; w.tick = 159; step(w); assert.deepEqual(w.colonyScore, [2, 0, 0, 0], 'one against one is unpaid');
});

test('rush: personal goals award five points, track only their task and advance in order', () => {
  const w = rushScene(), a = put(w, 0, ...C.NESTS[0]);
  for (let i = 0; i < 2; i++) { a.carry = 1; step(w); }
  assert.deepEqual([a.goal, a.goalProgress, a.score], [0, 2, 2]);
  a.carry = 1; step(w); assert.deepEqual([a.goal, a.goalProgress, a.score, w.colonyScore[0]], [1, 0, 8, 8]);
  a.x = 1600; a.y = 1600; a.protectUntil = 10000; a.goalProgress = 0;
  stillSteps(w, 99); assert.deepEqual([a.goal, a.goalProgress], [1, 99]);
  step(w); assert.deepEqual([a.goal, a.goalProgress], [2, 0]);
  const beforeGold = a.score; a.x = 800; a.y = 800; addFood(w, 800, 800, 2); step(w);
  assert.deepEqual([a.goal, a.goalProgress, a.score], [3, 0, beforeGold + 5]);
  a.carry = 0; a.protectUntil = 0; a.x = 800; a.y = 800; a.heading = 0;
  const carrier = put(w, 1, 820, 800); carrier.carry = 1;
  const beforeBite = a.score; step(w); assert.deepEqual([a.goal, a.goalProgress, a.goalIndex, a.score], [0, 0, 4, beforeBite + 5]);
  const bot = put(w, 0, ...C.NESTS[0]); bot.bot = true; bot.carry = 1; bot.goalProgress = 2; step(w);
  assert.equal(bot.score, 1, 'bots get deliveries but no goal rewards'); assert.equal(bot.goalProgress, 2);
});

test('rush: frenzy doubles deliveries, seeds, hill payments, kills and goal rewards', () => {
  for (const frenzy of [false, true]) {
    const multiplier = frenzy ? 2 : 1;
    const w = rushScene(); w.tick = frenzy ? 2000 : 100;
    const a = put(w, 0, ...C.NESTS[0]); a.carry = 1; a.goalProgress = 2; step(w);
    assert.equal(a.score, 6 * multiplier, 'delivery plus goal');
    assert.equal(w.colonyScore[0], 6 * multiplier);
    a.x = 800; a.y = 800; addFood(w, 800, 800, 3); const beforeSeed = a.score; step(w);
    assert.equal(a.score - beforeSeed, multiplier, 'seed');
    a.x = 1600; a.y = 1600; a.goal = -1; w.tick = frenzy ? 2079 : 159;
    const beforeHill = a.score; step(w); assert.equal(a.score - beforeHill, 2 * multiplier, 'hill');
    a.x = 800; a.y = 800; a.heading = 0; a.protectUntil = 0; a.goal = 3; a.goalProgress = 0;
    const victim = put(w, 1, 820, 800); victim.carry = 1; victim.hp = 1;
    const beforeKill = a.score; step(w); assert.equal(a.score - beforeKill, 7 * multiplier, 'kill plus carrier goal');
    assert.equal(a.participation & 16, frenzy ? 16 : 0);
  }
});

test('rush: timed golden crumbs and seeds replay from round seed despite unrelated random draws', () => {
  for (const seed of [1, 7, 42]) {
    const a = createWorld(seed, 'rush'), b = createWorld(seed, 'rush');
    for (let tick = 1; tick <= 800; tick++) {
      for (let i = 0; i < 13; i++) b.rand();
      step(a); step(b);
      if (tick === 1 || tick % 240 === 0 || tick % 400 === 0) {
        assert.deepEqual(a.feature, b.feature, `seed ${seed}, tick ${tick}`);
        const special = w => Array.from(w.fkind, (kind, id) => kind >= 2 ? [kind, +w.fx[id].toFixed(2), +w.fy[id].toFixed(2)] : null).filter(Boolean).filter(([kind]) => kind >= 3);
        assert.deepEqual(special(a), special(b), 'seed positions do not depend on bot RNG');
      }
    }
  }
});

test('rush: own goals, power timers, participation, results and awards decode fully', () => {
  const w = rushScene(), me = put(w, 0, 800, 800), bestDelivery = put(w, 1, 1000, 1000), bestBiter = put(w, 2, 1200, 1000);
  Object.assign(me, { goal: 2, goalProgress: 1, boostUntil: w.tick + 120, shieldUntil: w.tick + 90, participation: 31, delivered: 9, roundDelivered: 9, kills: 2, deaths: 1 });
  Object.assign(bestDelivery, { deliveries: 12, nameA: 3, nameB: 4 }); Object.assign(bestBiter, { kills: 8, nameA: 5, nameB: 6 });
  let r = new P.Reader(net.snapshot(w, me, net.newView(), 0)); assert.equal(r.u8(), P.SNAP); const s = P.readSnap(r, new Map(), new Map(), C.POS_Q, C.OWN_Q);
  assert.deepEqual([s.mode, s.goal, s.goalProgress, s.boostLeft, s.shieldLeft, s.participation], [2, 2, 1, 120, 90, 31]); assert.equal(r.n, r.v.byteLength);
  w.breakUntil = w.tick + 160; w.lastWinner = 1; w.colonyScore = [9, 20, 12, 0];
  r = new P.Reader(net.scores(w, w.ants.filter(Boolean), me, 3)); r.u8(); const scores = P.readScores(r);
  assert.deepEqual([scores.mode, scores.inBreak, scores.left, scores.delivered, scores.kills, scores.deaths], [2, true, 8, 9, 2, 1]);
  assert.deepEqual(scores.awards, [{ nameA: 3, nameB: 4, count: 12 }, { nameA: 5, nameB: 6, count: 8 }]); assert.equal(r.n, r.v.byteLength);
});

test('rush: bots return carried golden food, prefer a visible golden crumb and ignore hidden food', () => {
  const w = rushScene(), a = put(w, 0, 800, 800); a.bot = true; a.carry = 2;
  let [dx, dy] = decide(w, a); const towardHome = C.NESTS[0].map((v, i) => v - [a.x, a.y][i]);
  assert.ok(dx * towardHome[0] + dy * towardHome[1] > 0);
  a.carry = 0; addFood(w, 900, 800, 2); addFood(w, 800, 700, 1);
  [dx, dy] = decide(w, a); assert.ok(dx > .9 && Math.abs(dy) < .1, 'visible golden crumb wins over equal-distance regular food');
  const hidden = rushScene(), lone = put(hidden, 0, 800, 800); lone.bot = true; addFood(hidden, 100, 100, 2);
  [dx, dy] = decide(hidden, lone); assert.ok(dx > 0 && dy > 0, 'outside vision cannot steer bot toward hidden food');
});

test('rush: a simple visible-food forager scores within fifteen seconds in every fixed seed', t => {
  const times = [];
  for (const seed of [1, 7, 42]) {
    const w = createWorld(seed, 'rush'), me = addAnt(w, pickColony(w), false, 0, 0); balance(w);
    let first = Infinity;
    for (let tick = 0; tick < 15 * C.TICK_HZ; tick++) {
      for (const a of w.ants) if (a?.bot) think(w, a);
      if (tick % 5 === 0 && me.alive) {
        let [x, y] = me.carry ? C.NESTS[me.colony] : [1600, 1600], nearest = Infinity;
        if (!me.carry) for (let id = 0; id < C.MAX_FOOD; id++) if (w.fkind[id] && Math.abs(w.fx[id] - me.x) <= C.VIEW && Math.abs(w.fy[id] - me.y) <= C.VIEW) {
          const d = (w.fx[id] - me.x) ** 2 + (w.fy[id] - me.y) ** 2;
          if (d < nearest) { nearest = d; x = w.fx[id]; y = w.fy[id]; }
        }
        setInput(w, me, byteOf(Math.atan2(y - me.y, x - me.x)), true, false);
      }
      step(w);
      if (me.score > 0) { first = w.tick / C.TICK_HZ; break; }
    }
    assert.ok(first <= 15, `seed ${seed}: first score ${first} seconds`); times.push(first);
  }
  t.diagnostic(`Rush first score seconds for seeds1/7/42: ${times.join('/')}`);
});

test('rush: a frenzy goal completion alone marks frenzy participation', () => {
  const w = rushScene(), a = put(w, 0, 1600, 1600);
  w.tick = 2000; a.goal = 1; a.goalProgress = 99; a.goalIndex = 1;
  step(w); assert.equal(a.score, 10); assert.equal(a.participation & 16, 16);
});

test('rush: an unfinished goal moves on after its time without a reward', () => {
  const w = rushScene(), a = put(w, 0, 900, 900);
  w.tick = 2000; a.goal = 2; a.goalIndex = 2; a.goalProgress = 0; a.goalSince = w.tick - MODES.rush.goalSkipSeconds * C.TICK_HZ + 1;
  const before = a.score; step(w); assert.deepEqual([a.goal, a.goalIndex, a.score], [3, 3, before]);
  a.goalSince = w.tick - 10; step(w); assert.equal(a.goal, 3);
});

test('rush: end-of-round delivered points survive death and reset only at the next round', () => {
  const w = rushScene(), a = put(w, 0, ...C.NESTS[0]); a.carry = 2; step(w);
  assert.deepEqual([a.delivered, a.roundDelivered], [5, 5]);
  a.x = 820; a.y = 800; a.hp = 1; const enemy = put(w, 1, 800, 800); step(w);
  assert.equal(a.alive, false); assert.deepEqual([a.delivered, a.roundDelivered], [0, 5]);
  let r = new P.Reader(net.scores(w, [a, enemy], a, 2)); r.u8(); assert.equal(P.readScores(r).delivered, 5);
  w.tick = w.roundEnd - 1; step(w); w.tick = w.breakUntil - 1; step(w); assert.equal(a.roundDelivered, 0);
});

test('rush: random replenishment never adds unannounced sugar beside the scheduled golden crumb', () => {
  for (const seed of [1, 7, 42]) {
    const w = createWorld(seed, 'rush');
    for (let tick = 0; tick < 300; tick++) step(w);
    assert.deepEqual(Array.from(w.fkind, (kind, id) => kind === 2 ? id : -1).filter(id => id >= 0), [w.goldenId]);
  }
});

test('feast: simultaneous eating chains preserve the same outcome under ant-id permutation', () => {
  const outcomes = [];
  for (const order of [[0, 1, 2], [2, 1, 0]]) {
    const w = feastScene(); w.tick = 100; const roles = [];
    for (const role of order) { const a = put(w, 0, 900 + 25 * role, 900); a.mass = [100, 70, 50][role]; roles[role] = a; }
    step(w); outcomes.push(roles.map(a => [a.alive, a.mass, a.kills, a.deaths]));
  }
  assert.deepEqual(outcomes[0], outcomes[1], 'geometry and size decide, not ant ids');
});

test('new modes: reset tick has no scheduled food and age one fires only one starter event', () => {
  for (const mode of ['feast', 'rush']) {
    const w = createWorld(131, mode); step(w);
    w.tick = w.roundEnd - 1; step(w); w.tick = w.breakUntil - 1; step(w);
    assert.equal(w.tick - w.roundStart, 0); assert.equal(w.foodCount, 0, `${mode}: reset is empty`);
    step(w); assert.equal(w.tick - w.roundStart, 1);
    const count = kind => w.fkind.filter(k => k === kind).length;
    if (mode === 'feast') { assert.ok(count(1) > 0); assert.equal(count(3), 0, 'first cake waits until fifty seconds'); }
    else { assert.equal(count(2), 1, 'one golden crumb'); assert.equal(count(3) + count(4), 8, 'one eight-seed starter event'); }
  }
});

test('net: two observers receive identical shared-ant state and fresh deltas across ticks and id reuse', () => {
  for (const mode of ['classic', 'feast', 'rush']) {
    const w = createWorld(141, mode), one = put(w, 0, 800, 800), two = put(w, 0, 810, 800);
    let target = put(w, 1, 900, 800); target.mass = 42; target.bot = true;
    for (const a of [one, two, target]) a.protectUntil = 10000;
    const views = [net.newView(), net.newView()], known = [new Map(), new Map()];
    for (let tick = 0; tick < 3; tick++) {
      if (tick === 1) { target.x += 9; target.mass = 49; target.hp = 3; }
      if (tick === 2) { removeAnt(w, target); target = put(w, 1, 920, 810); Object.assign(target, { mass: 60, bot: false, nameA: 7, nameB: 8, protectUntil: 10000 }); }
      step(w);
      for (let i = 0; i < 2; i++) {
        const r = new P.Reader(net.snapshot(w, [one, two][i], views[i], i)); r.u8(); P.readSnap(r, known[i], new Map(), C.POS_Q, C.OWN_Q); assert.equal(r.n, r.v.byteLength);
      }
      assert.deepEqual(known[0].get(target.id), known[1].get(target.id), `${mode}, tick ${tick}: both observers agree`);
      const got = known[0].get(target.id);
      assert.equal(got.x, Math.round(target.x * C.POS_Q) / C.POS_Q);
      assert.deepEqual([got.hp, got.bot, got.nameA, got.nameB], [target.hp, target.bot, target.nameA, target.nameB]);
      if (mode === 'feast') assert.ok(Math.abs(got.mass - target.mass) < 1);
    }
  }
});

import { getMode, snapshotEvery } from '../public/crumbwar/shared/modes.js';
test('snapshot policy: dense Feast and Rush drop to five Hz, simulation stays twenty Hz', () => {
  assert.equal(snapshotEvery(getMode('rush'), 120), 2);
  assert.equal(snapshotEvery(getMode('rush'), 121), 4);
  assert.equal(snapshotEvery(getMode('classic'), 240), 2);
  assert.equal(snapshotEvery(getMode('feast'), 48), 2);
  assert.equal(snapshotEvery(getMode('feast'), 49), 4);
  assert.equal(snapshotEvery(getMode('feast'), 240), 4);
  assert.equal(C.TICK_HZ, 20);
  for (const mode of ['classic', 'feast', 'rush']) {
    const w = createWorld(151, mode); stillSteps(w, 20); assert.equal(w.tick, 20);
  }
});
