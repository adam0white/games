// The war sim: bots as acceptance. An idle colony loses, a run replays from its orders, a save carries on the same.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Sim, CG, CMD, KIND, CASTE, TEAMS } from '../war/sim.js';
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
