// The war sim: bots as acceptance. An idle colony loses, a run replays from its orders, a save carries on the same.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Sim, CG, CMD, KIND, CASTE, TEAMS, ROOM } from '../war/sim.js';
import { Host } from '../war/host.js';
import { think, THINK_EVERY } from '../war/ai.js';

test('an idle colony loses to the rival', () => {
  const h = new Host({ seed: 3 }).run(7200);
  assert.equal(h.sim.result, 2);
  assert.equal(h.sim.g(0, CG.LOADS_S) + h.sim.g(0, CG.LOADS_P), 0);
});

test('the same seed and orders give the same hashes; another seed does not', () => {
  const a = new Host({ seed: 5, ai: { 0: 2, 1: 1 } }).run(3000), b = new Host({ seed: 5, ai: { 0: 2, 1: 1 } }).run(3000), c = new Host({ seed: 6, ai: { 0: 2, 1: 1 } }).run(3000);
  assert.deepEqual(a.hashes, b.hashes);
  assert.notEqual(a.sim.hash(), c.sim.hash());
  // Replay: a sim with no minds, fed the logged orders, ends in the same state.
  const r = new Sim({ seed: 5 });
  for (const o of a.log) r.order(o);
  while (r.tick < a.sim.tick) r.step();
  assert.equal(r.hash(), a.sim.hash());
});

test('a save carries on exactly', () => {
  const drive = (s, to) => { while (s.tick < to && !s.result) { if (s.tick % THINK_EVERY === 0) for (let t = 0; t < TEAMS; t++) for (const o of think(s, t, 1)) s.order(o); s.step(); } return s; };
  const a = drive(new Sim({ seed: 9 }), 3300);
  const b = Sim.load(JSON.parse(JSON.stringify(a.save(), (k, v) => (ArrayBuffer.isView(v) ? Array.from(v) : v))));
  assert.equal(b.hash(), a.hash());
  drive(a, 4200); drive(b, 4200);
  assert.equal(b.hash(), a.hash());
});

test('a trail is refused when its end is closed or there is no free slot', () => {
  const s = new Sim({ seed: 1 });
  s.order({ team: 0, type: CMD.TRAIL, id: 7, points: [300, 300] }); // off the map
  for (let k = 0; k < 7; k++) s.order({ team: 0, type: CMD.TRAIL, id: 10 + k, points: [27, 49] });
  s.step();
  const ev = s.drainEvents(), rejected = [];
  for (let k = 0; k < ev.length; k += 4) if (ev[k] === 6) rejected.push(ev[k + 2]);
  assert.deepEqual(rejected, [7, 16]);
});

test('numbers win in the open and a tunnel holds', () => {
  const s = new Sim({ seed: 1, blank: true, ants: 0, eggs: 0, larvae: 0, pupae: 0, duskTick: 0 });
  for (let k = 0; k < 12; k++) s.spawn(0, CASTE.MAJOR, s.L.sw * (20 + (k >> 2)) + 72 + (k % 4));
  for (let k = 0; k < 6; k++) s.spawn(1, CASTE.MAJOR, s.L.sw * (20 + (k / 3 | 0)) + 77 + (k % 3));
  for (let k = 0; k < 400; k++) s.step();
  assert.equal(s.g(1, CG.MAJORS), 0);
  assert.ok(s.g(0, CG.MAJORS) >= 6, `twelve against six should keep six, kept ${s.g(0, CG.MAJORS)}`);
});

test('a tick stays cheap with two thousand ants', () => {
  const s = new Sim({ seed: 2, ants: 1000, sugar: 5000, protein: 500 });
  for (const t of [0, 1]) for (const o of think(s, t, 1)) s.order(o);
  for (let k = 0; k < 200; k++) s.step();
  const t0 = performance.now();
  for (let k = 0; k < 200; k++) s.step();
  const ms = (performance.now() - t0) / 200;
  assert.ok(s.n >= 2000, `ants ${s.n}`);
  assert.ok(ms < 4, `a tick took ${ms.toFixed(2)} ms`);
});

test('one trail keeps carrying until its pile is empty', () => {
  const s = new Sim({ seed: 1 });
  s.order({ team: 0, type: CMD.TRAIL, kind: KIND.FORAGE, level: 3, points: [27, 49] });
  for (let k = 0; k < 4000; k++) s.step();
  assert.ok(s.g(0, CG.LOADS_S) >= 60, `sixty loads lay there, ${s.g(0, CG.LOADS_S)} came home`);
});

test('a fight ends the same whichever colony was spawned first', () => {
  const left = order => {
    const s = new Sim({ seed: 1, blank: true, ants: 0, eggs: 0, larvae: 0, pupae: 0, duskTick: 0 });
    for (const t of order) for (let k = 0; k < 10; k++) s.spawn(t, CASTE.MAJOR, s.L.sw * (20 + (k >> 1)) + (t ? 77 + (k & 1) : 73 + (k & 1)));
    for (let k = 0; k < 600; k++) s.step();
    return s.g(0, CG.MAJORS) - s.g(1, CG.MAJORS);
  };
  const a = left([0, 1]), b = left([1, 0]);
  assert.ok(Math.sign(a) === Math.sign(b) && Math.abs(a - b) <= 3, `the same fight, spawned in the other order, ended ${a} and ${b}`);
});

test('workers dig what is marked and the rooms raise the caps; a save mid-dig carries on', () => {
  const s = new Sim({ seed: 4, sugar: 60 }), dx = s.door[0] % s.L.sw, cells = [];
  for (let y = 7; y <= 8; y++) for (let x = 1; x <= 5; x++) cells.push(dx + x, y);
  const cap0 = s.g(0, CG.CAP_ADULTS), food0 = s.g(0, CG.CAP_FOOD), brood0 = s.g(0, CG.CAP_BROOD);
  assert.deepEqual([food0, brood0], [120, 48]);
  s.order({ team: 0, type: CMD.DIG, cells }); s.order({ team: 0, type: CMD.ROOM, cells, kind: ROOM.REST });
  s.order({ team: 0, type: CMD.DIG, id: 9, cells: [s.door[1] % s.L.sw + 3, 7] }); // the rival's earth: refused
  for (let k = 0; k < 150; k++) s.step();
  const ev = s.drainEvents(); let refused = 0;
  for (let k = 0; k < ev.length; k += 4) if (ev[k] === 6 && ev[k + 2] === 9) refused++;
  assert.equal(refused, 1);
  assert.equal(s.g(0, CG.MARKS) + (s.g(0, CG.CAP_ADULTS) - cap0) / 4, 10, 'every cell is still marked or already quarters');
  const b = Sim.load(JSON.parse(JSON.stringify(s.save(), (k, v) => (ArrayBuffer.isView(v) ? Array.from(v) : v))));
  for (let k = 0; k < 900; k++) { s.step(); b.step(); }
  assert.equal(s.g(0, CG.MARKS), 0);
  assert.equal(s.g(0, CG.CAP_ADULTS), cap0 + 40);
  assert.equal(b.hash(), s.hash());
});

test('a load that comes home to full stores is lost', () => {
  const s = new Sim({ seed: 4, sugar: 119 });
  s.order({ team: 0, type: CMD.TRAIL, kind: KIND.FORAGE, level: 3, points: [27, 49] });
  for (let k = 0; k < 1500; k++) s.step();
  assert.ok(s.g(0, CG.SUGAR) <= 120, `sugar ${s.g(0, CG.SUGAR)}`);
  const ev = s.drainEvents(); let full = 0;
  for (let k = 0; k < ev.length; k += 4) if (ev[k] === 13 && ev[k + 1] === 0) full++;
  assert.ok(full > 0, 'no load was turned away');
});

test('a mind that builds beats the same mind that does not', () => {
  let wins = 0;
  for (const seed of [2, 5, 8]) { const h = new Host({ seed, ai: { 0: 1, 1: { mood: 1, build: false } } }).run(9600); if (h.sim.result === 1) wins++; }
  assert.equal(wins, 3);
});

test('clearing takes the mark and the room off; repainting the stores spoils what no longer fits', () => {
  const s = new Sim({ seed: 4, sugar: 110 }), dx = s.door[0] % s.L.sw, k = 5 * s.L.nw + dx + 3;
  s.order({ team: 0, type: CMD.ROOM, cells: [dx + 3, 5], kind: ROOM.STORE, dig: 1 }); s.step(); s.step();
  assert.deepEqual([s.mark[k], s.room[k]], [1, ROOM.STORE]);
  s.order({ team: 0, type: CMD.ROOM, cells: [dx + 3, 5], kind: ROOM.NONE }); s.step(); s.step();
  assert.deepEqual([s.mark[k], s.room[k], s.g(0, CG.MARKS)], [0, 0, 0]);
  const porch = []; for (let y = 4; y <= 6; y++) for (let x = -2; x <= 2; x++) porch.push(dx + x, y);
  s.order({ team: 0, type: CMD.ROOM, cells: porch, kind: ROOM.REST }); s.step(); s.step();
  assert.equal(s.g(0, CG.CAP_FOOD), 24);
  assert.ok(s.g(0, CG.SUGAR) <= 24, `sugar ${s.g(0, CG.SUGAR)}`);
});

test('a colony picks one caste, once, from the mission list, and raises it', () => {
  const s = new Sim({ seed: 4, protein: 60 });
  s.order({ team: 0, type: CMD.PICK, id: 1, caste: CASTE.MAJOR }); // not on the list
  s.order({ team: 0, type: CMD.PICK, id: 2, caste: CASTE.SPITTER });
  s.order({ team: 0, type: CMD.PICK, id: 3, caste: CASTE.WARDEN }); // already chosen
  s.order({ team: 0, type: CMD.DIET, share: 1, special: 2 });
  s.order({ team: 1, type: CMD.DIET, share: 1, special: 2 }); // no caste chosen: no share
  for (let k = 0; k < 2400; k++) s.step();
  const ev = s.drainEvents(), refused = [];
  for (let k = 0; k < ev.length; k += 4) if (ev[k] === 6) refused.push(ev[k + 2]);
  assert.deepEqual(refused, [1, 3]);
  assert.deepEqual([s.g(0, CG.PICK), s.g(0, CG.DIET2), s.g(1, CG.DIET2)], [CASTE.SPITTER, 2, 0]);
  let spitters = 0; for (let i = 0; i < s.n; i++) if (s.team[i] === 0 && s.caste[i] === CASTE.SPITTER) spitters++;
  assert.ok(spitters > 0 && spitters === s.g(0, CG.SPECIALS), `spitters ${spitters}`);
  assert.equal(s.g(1, CG.SPECIALS), 0);
});

test('a spitter hits from two cells away, and not through earth', () => {
  const fight = wall => {
    const s = new Sim({ seed: 1, blank: true, ants: 0, eggs: 0, larvae: 0, pupae: 0, duskTick: 0 }), row = s.L.sw * 20;
    if (wall) s.mat[row + 71] = 4; // a stone between them
    const a = s.spawn(0, CASTE.SPITTER, row + 70), b = s.spawn(1, CASTE.WORKER, row + 72);
    s.task[a] = s.task[b] = 0; s.buildBuckets(); s.fight();
    return s.hp[b];
  };
  assert.ok(fight(false) < 12, 'the spit should land');
  assert.equal(fight(true), 12);
});

test('First Frost: the frost takes the food outside, the cold eats faster, and a save across it carries on', () => {
  const drive = (s, to) => { while (s.tick < to && !s.result) { if (s.tick % THINK_EVERY === 0) for (let t = 0; t < TEAMS; t++) for (const o of think(s, t, 0)) s.order(o); s.step(); } return s; };
  const a = drive(new Sim({ seed: 4, mission: 'frost' }), 4700);
  assert.ok(a.pileAmount.some(v => v > 0), 'food lies outside before the frost');
  const b = Sim.load(JSON.parse(JSON.stringify(a.save(), (k, v) => (ArrayBuffer.isView(v) ? Array.from(v) : v))));
  drive(a, 4800); a.drainEvents(); const before = a.g(0, CG.SUGAR);
  assert.ok(a.pileAmount.every(v => v === 0), 'nothing is left outside');
  drive(a, 5400); drive(b, 5400);
  assert.equal(b.hash(), a.hash());
  assert.ok(before - a.g(0, CG.SUGAR) >= Math.ceil(a.g(0, CG.ADULTS) / 10), 'two meals in thirty seconds of cold');
});

test('First Frost: a mind that stores for the winter ends larger than one that does not dig stores', () => {
  for (const seed of [1, 2, 3]) {
    const h = new Host({ seed, mission: 'frost', swap: seed % 2 === 0, ai: { 0: 0, 1: { mood: 0, rooms: [ROOM.NURSERY, ROOM.REST] } } }).run(12000);
    assert.equal(h.sim.result, 1, `seed ${seed}`);
  }
});

test('a colony can start smaller than its rival', () => {
  const s = new Sim({ seed: 1, antsBy: [22, 30] });
  s.census();
  assert.deepEqual([s.g(0, CG.ADULTS), s.g(1, CG.ADULTS)], [22, 30]);
});

test('The Stones: a stone pays the colony with more ants beside it, and points end the mission', () => {
  const s = new Sim({ seed: 2, mission: 'stones' });
  assert.equal(s.sites.length, 4);
  const sw = s.L.sw, c = s.sites[2], put = (t, n) => { for (let k = 0; k < n; k++) { const i = s.spawn(t, CASTE.MAJOR, c); s.task[i] = 0; } };
  put(0, 2); for (let k = 0; k < 20; k++) s.step();
  assert.equal(s.siteHold[2], -1, 'two ants are not enough');
  put(0, 4); for (let k = 0; k < 20; k++) s.step();
  assert.equal(s.siteHold[2], 0);
  assert.ok(s.g(0, CG.POINTS) >= 1 && s.g(1, CG.POINTS) === 0);
  const b = Sim.load(JSON.parse(JSON.stringify(s.save(), (k, v) => (ArrayBuffer.isView(v) ? Array.from(v) : v))));
  assert.equal(b.hash(), s.hash()); assert.equal(b.siteHold[2], 0); assert.equal(b.sites[2], c);
  s.cg[CG.POINTS] = 399; put(0, 4); for (let k = 0; k < 20 && !s.result; k++) s.step();
  assert.equal(s.result, 1);
  void sw;
});

test('The Stones: a mind that holds more stones beats one that holds fewer', () => {
  for (const seed of [1, 2]) {
    const h = new Host({ seed, mission: 'stones', swap: seed % 2 === 0, ai: { 0: 1, 1: 0 } }).run(12000);
    assert.equal(h.sim.result, 1, `seed ${seed}`);
  }
});
