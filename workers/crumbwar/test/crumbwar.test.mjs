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

const run = (w, n) => { for (let i = 0; i < n; i++) { for (const a of w.ants) if (a && a.bot) think(w, a); step(w); } };
const digest = w => w.ants.filter(Boolean).map(a => [a.id, a.x.toFixed(3), a.y.toFixed(3), a.hp, a.score, a.carry].join()).join(';') + '|' + w.colonyScore + '|' + w.foodCount;
// An ant placed by hand, away from every nest, unprotected, so a test controls exactly what it meets.
function put(w, colony, x, y, heading = 0) { const a = addAnt(w, colony, false, 0, 0); Object.assign(a, { x, y, heading, protectUntil: 0 }); return a; }
// A world that is already at its food target, with the food parked in a far corner: nothing new appears.
const PARKED = 150;
const quiet = seed => { const w = createWorld(seed); for (let i = 0; i < PARKED; i++) addFood(w, 3180, 1500 + i, 1); return w; };

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
  assert.deepEqual(count()[0], [6, 6, 6, 6]);
  assert.equal(w.count, MIN_ANTS);
  const people = [];
  for (let i = 0; i < 30; i++) { people.push(addAnt(w, pickColony(w), false, 0, 0)); balance(w); }
  let [n, p] = count();
  assert.ok(Math.max(...p) - Math.min(...p) <= 1, 'people are spread evenly');
  assert.ok(new Set(n).size === 1 && n[0] === Math.max(...p), 'every colony has the same number of ants');
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
