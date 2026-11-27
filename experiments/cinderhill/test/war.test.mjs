// The war sim: bots as acceptance. An idle colony loses, a run replays from its orders, a save carries on the same.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Sim, CG, CMD, KIND, MODE, CASTE, TEAMS, ROOM, EVENT, MAT } from '../war/sim.js';
import { Host } from '../war/host.js';
import { think, THINK_EVERY, cacheRun, breachRun, mouth } from '../war/ai.js';
import { PLUG, C } from '../war/sim.js';
import { CAMPAIGN, TRAITS, MISSIONS, MAPS, TIERS, BRANCH } from '../war/tables.js';

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
  const s = new Sim({ seed: 4, protein: 60, tiers: false });
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
  drive(a, 4800); a.drainEvents(); const before = a.g(0, CG.SUGAR) - a.g(0, CG.LOADS_S); // less the loads still on the way home
  assert.ok(a.pileAmount.every(v => v === 0), 'nothing is left outside');
  drive(a, 5400); drive(b, 5400);
  assert.equal(b.hash(), a.hash());
  assert.ok(before - (a.g(0, CG.SUGAR) - a.g(0, CG.LOADS_S)) >= Math.ceil(a.g(0, CG.ADULTS) / 10), 'two meals in thirty seconds of cold');
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

test('The Larder: a stolen load counts when it reaches home, and ten of them end the mission', () => {
  const h = new Host({ seed: 1, mission: 'larder', ai: { 0: 1, 1: 1 } }), s = h.sim;
  while (!s.result && s.tick < 9700 && s.g(0, CG.HAUL) + s.g(1, CG.HAUL) === 0) h.run(200);
  assert.ok(s.g(0, CG.HAUL) + s.g(1, CG.HAUL) > 0, 'some thief got home');
  for (const t of [0, 1]) assert.ok(s.g(t, CG.HAUL) <= s.g(t, CG.STOLEN), 'no load is hauled that was not taken');
  const b = Sim.load(JSON.parse(JSON.stringify(s.save(), (k, v) => (ArrayBuffer.isView(v) ? Array.from(v) : v))));
  assert.equal(b.hash(), s.hash());
  const t = s.g(0, CG.HAUL) ? 0 : 1; s.cg[t * CG.SIZE + CG.HAUL] = 10; s.step();
  assert.equal(s.result, 1 + t);
});

test('the campaign: the third fork offers the upgrades of the caste taken at the first', () => {
  const craft = CAMPAIGN.find(c => c.fork === 'craft');
  for (const [caste, list] of Object.entries(craft.by)) for (const id of list) assert.equal(TRAITS[id].needs, caste);
  for (const c of CAMPAIGN) if (c.mission) assert.ok(MISSIONS[c.mission], c.mission);
});

test('maps are table rows: the pass has a stone ridge with one gap, the flat has no wall', () => {
  const wallAt = (mission, y) => { const s = new Sim({ seed: 1, mission }), sw = s.L.sw; return s.mat[y * sw + (sw >> 1)]; };
  const pass = new Sim({ seed: 1, mission: 'narrows' }), sh = pass.L.sh, gap = Math.round((56 * sh) / 112);
  assert.notEqual(wallAt('narrows', 5), wallAt('narrows', gap), 'the ridge is closed away from the pass and open in it');
  assert.equal(wallAt('narrows', gap), wallAt('crossing', Math.round((28 * sh) / 112)), 'a gap is open ground, like a ford');
  assert.notEqual(wallAt('narrows', 5), wallAt('crossing', 5), 'stone, not water');
  assert.ok(MAPS.flat.wall === null && MAPS.flat.gaps.length === 0);
  for (const m of Object.values(MISSIONS)) assert.ok(MAPS[m.map], m.map);
});

test('The Narrows: the colony under siege wins at dusk, however small', () => {
  const s = new Sim({ seed: 1, mission: 'narrows', duskTick: 40 });
  for (let i = 0; i < s.n; i++) if (s.team[i] === 1 && i % 2) s.hp[i] = 0;
  while (!s.result && s.tick < 60) s.step();
  assert.equal(s.result, 2);
});

test('a guard post keeps a share of the idle soldiers inside the nest', () => {
  const run = post => {
    const s = new Sim({ seed: 4, mission: 'larder', tiers: false, traits: [['post'], []] }), L = s.L, dx = s.door[0] % L.sw;
    for (let k = 0; k < 16; k++) s.spawn(0, CASTE.MAJOR, s.door[0]);
    if (post) s.order({ team: 0, type: CMD.ROOM, kind: ROOM.POST, cells: [dx - 2, 16, dx - 1, 16, dx, 16, dx + 1, 16] }); // four cells of the queen's chamber
    for (let k = 0; k < 600; k++) s.step();
    let inside = 0; for (let i = 0; i < s.n; i++) if (s.team[i] === 0 && s.caste[i] === CASTE.MAJOR && s.layer[i] === 1) inside++;
    const b = Sim.load(JSON.parse(JSON.stringify(s.save(), (k, v) => (ArrayBuffer.isView(v) ? Array.from(v) : v))));
    for (let k = 0; k < 100; k++) { s.step(); b.step(); }
    assert.equal(b.hash(), s.hash(), 'a save carries on the same');
    return inside;
  };
  const without = run(false), withPost = run(true);
  assert.ok(without <= 2, `no post: the guard stands by the door (${without} inside)`);
  assert.ok(withPost >= 5 && withPost <= 11, `four cells: about half of sixteen inside (${withPost})`);
  assert.throws(() => { const s = new Sim({ seed: 1, mission: 'crossing' }); let why = 0; s.order({ team: 0, type: CMD.ROOM, kind: ROOM.POST, cells: [s.door[0] % s.L.sw, 16] }); s.step(); for (const e of s.drainEvents()) if (e[0] === 7) why++; if (!why && s.room[16 * s.L.nw + s.door[0] % s.L.sw] !== ROOM.POST) throw new Error('refused'); }, /refused/);
});

test('a raid sent for the store brings loads home; a raid told to hold stays out of the door', () => {
  const run = (traits, mode) => {
    const s = new Sim({ seed: 3, mission: 'crossing', tiers: false, traits: [traits, []] }), sw = s.L.sw, ed = s.door[1];
    for (let k = 0; k < 14; k++) s.spawn(0, CASTE.MAJOR, s.door[0]);
    s.order({ team: 0, type: CMD.TRAIL, kind: KIND.RAID, level: 2, mode, points: [ed % sw, Math.floor(ed / sw)] });
    let inside = 0;
    for (let k = 0; k < 2400 && !s.result; k++) { s.step(); for (let i = 0; i < s.n; i++) if (s.team[i] === 0 && s.caste[i] === CASTE.MAJOR && s.inv[i]) inside++; }
    return { mode: s.trMode[0], inside, haul: s.g(0, CG.HAUL), queen: s.g(1, CG.QUEEN_HP) };
  };
  const press = run([], 0), noNode = run([], MODE.LOOT), loot = run(['raiders'], MODE.LOOT), hold = run(['hold'], MODE.HOLD);
  assert.equal(noNode.mode, MODE.PRESS, 'without the node the raid presses');
  assert.equal(loot.mode, MODE.LOOT); assert.equal(hold.mode, MODE.HOLD);
  assert.ok(press.inside > 0 && hold.inside === 0, `a holding raid never goes in (${press.inside}, ${hold.inside})`);
  assert.ok(loot.haul >= 3 && press.haul === 0, `only soldiers sent for the store carry loads home (${loot.haul} v ${press.haul})`);
  assert.ok(loot.queen > press.queen, 'and leave the queen be');
});

test('deeds are judged by the sim from its own counts', () => {
  const s = new Sim({ seed: 1, mission: 'crossing' });
  assert.deepEqual(s.deeds(0), [false, false]);
  s.cg[CG.HAUL] = 1; assert.deepEqual(s.deeds(0), [true, false], 'a count reached is a deed done at once');
  s.cg[CG.SIZE + CG.QUEEN_HP] = 0; s.step();
  assert.equal(s.result, 1); assert.deepEqual(s.deeds(0), [true, true]); assert.deepEqual(s.deeds(1), [false, false]);
  const b = Sim.load(JSON.parse(JSON.stringify(s.save(), (k, v) => (ArrayBuffer.isView(v) ? Array.from(v) : v))));
  assert.deepEqual(b.deeds(0), [true, true], 'a save keeps how the mission ended');
  for (const m of Object.values(MISSIONS)) { assert.equal(m.deeds.length, 2); for (const d of m.deeds) assert.ok(TRAITS[d.opens], `${m.id}.${d.id} opens a known node`); }
});

// Every load lies in a cell. The totals the rest of the sim reads are the sums of the cells.
const held = (s, t) => { let a = 0, b = 0; for (const k of s.bins[t]) { a += s.binS[k]; b += s.binP[k]; } return [a, b]; };
const agrees = s => { for (let t = 0; t < TEAMS; t++) assert.deepEqual(held(s, t), [s.g(t, CG.SUGAR), s.g(t, CG.PROTEIN)], `tick ${s.tick} team ${t}`); };

test('stores: the loads in the cells add up to the totals all through a match and across a save', () => {
  for (const mission of ['crossing', 'larder']) {
    const h = new Host({ seed: 2, mission, ai: { 0: 1, 1: 2 } }), s = h.sim;
    agrees(s);
    while (!s.result && s.tick < 6000) { h.run(20); agrees(s); for (let t = 0; t < TEAMS; t++) for (const k of s.bins[t]) assert.ok(s.binS[k] <= s.binCap(t, k) && s.binP[k] <= s.binCap(t, k), 'no cell over its measure'); }
    const b = Sim.load(JSON.parse(JSON.stringify(s.save(), (k, v) => (ArrayBuffer.isView(v) ? Array.from(v) : v))));
    assert.equal(b.hash(), s.hash()); agrees(b);
  }
});

test('stores: a thief takes from the cell she reaches, and the nearest cell with food is the one she walks to', () => {
  const s = new Sim({ seed: 3, mission: 'crossing', tiers: false, traits: [['raiders'], []] }), L = s.L, sw = L.sw, ed = s.door[1], dx = ed % sw;
  // The rival keeps its food in two places: a little on the porch, the rest in a store dug beside the queen.
  for (let x = dx + 3; x <= dx + 6; x++) for (let y = 16; y <= 18; y++) { s.mat[L.nestBase + y * L.nw + x] = MAT.OPEN; s.room[y * L.nw + x] = ROOM.STORE; }
  s.recount(); s.rebuildFields();
  const deep = s.bins[1].filter(k => Math.floor(k / L.nw) >= 16), porch = s.bins[1].filter(k => Math.floor(k / L.nw) < 16);
  for (const k of s.bins[1]) s.binS[k] = s.binP[k] = 0;
  for (const k of deep) s.binS[k] = 8; porch.slice(0, 2).forEach(k => { s.binS[k] = 3; });
  s.cg[CG.SIZE + CG.SUGAR] = deep.length * 8 + 6; s.cg[CG.SIZE + CG.PROTEIN] = 0; s.rebuildStoreFields(); agrees(s);
  for (let i = 0; i < s.n; i++) if (s.team[i] === 1) s.hp[i] = 0; // no one home: this is about where the thieves walk
  for (let k = 0; k < 12; k++) s.spawn(0, CASTE.MAJOR, s.door[0]);
  s.order({ team: 0, type: CMD.TRAIL, kind: KIND.RAID, level: 2, mode: MODE.LOOT, points: [dx, Math.floor(ed / sw)] });
  const cells = [];
  for (let k = 0; k < 3000 && s.g(0, CG.STOLEN) < 10; k++) { s.step(); const ev = s.drainEvents(); for (let j = 0; j < ev.length; j += 4) if (ev[j] === EVENT.STOLEN) cells.push((ev[j + 3] >> 1) - L.nestBase); agrees(s); }
  assert.ok(cells.length >= 8, `thieves took loads (${cells.length})`);
  const first = cells.findIndex(k => deep.includes(k));
  assert.ok(first >= 2 && cells.slice(0, first).every(k => porch.includes(k)), 'the porch is robbed first');
  assert.ok(cells.slice(first).every(k => deep.includes(k)) && cells.length - first >= 3, 'and once it is bare they walk down to the deep store');
});

test('stores: a store cell unpainted gives its loads to cells with room, and what finds none spoils', () => {
  const s = new Sim({ seed: 1, mission: 'crossing' }), L = s.L, dx = s.door[0] % L.sw;
  for (const k of s.bins[0]) s.binS[k] = 8; s.cg[CG.SUGAR] = s.bins[0].length * 8; agrees(s);
  const row = y => { const c = []; for (let x = dx - 2; x <= dx + 2; x++) c.push(x, y); return c; };
  s.order({ team: 0, type: CMD.ROOM, cells: row(4), kind: ROOM.NONE }); s.step(); agrees(s);
  assert.equal(s.g(0, CG.SUGAR), 80, 'five cells fewer: forty loads had nowhere to lie');
  for (const k of s.bins[0]) s.binS[k] = 4; s.cg[CG.SUGAR] = 40;
  s.order({ team: 0, type: CMD.ROOM, cells: row(6), kind: ROOM.NONE }); s.step(); agrees(s);
  assert.equal(s.g(0, CG.SUGAR), 40, 'with room in the row left, nothing is lost');
  // No store cell at all: the hill keeps a small heap where it was founded.
  s.order({ team: 0, type: CMD.ROOM, cells: row(5), kind: ROOM.NONE }); s.step(); agrees(s);
  assert.equal(s.g(0, CG.CAP_FOOD), 24); assert.equal(s.g(0, CG.SUGAR), 24); assert.equal(s.binS[s.store[0] - L.nestBase], 24);
});

test('caches: each hill has the same ones in its clay, and digging one open carries it to the stores', () => {
  const s = new Sim({ seed: 5, mission: 'crossing' }), L = s.L, at = [[], []];
  for (let k = 0; k < s.cache.length; k++) if (s.cache[k]) at[s.owner(k)].push([Math.abs((k % L.nw) - (s.door[s.owner(k)] % L.sw)), Math.floor(k / L.nw), s.cache[k]].join());
  assert.equal(at[0].length, 4); assert.deepEqual(at[0].sort(), at[1].sort());
  const run = cacheRun(s, 0), k = run[run.length - 1] * L.nw + run[run.length - 2], v = s.cache[k], slot = v & 1 ? CG.PROTEIN : CG.SUGAR;
  assert.ok(run.length >= 2 && v > 0, 'the rival\'s mind finds a way to one');
  for (const b of s.bins[0]) s.binS[b] = 6; s.cg[CG.SUGAR] = s.bins[0].length * 6; agrees(s);
  s.order({ team: 0, type: CMD.DIG, cells: run });
  const before = s.g(0, slot); let found = 0;
  for (let j = 0; j < 4000 && !found; j++) { s.step(); const ev = s.drainEvents(); for (let e = 0; e < ev.length; e += 4) if (ev[e] === EVENT.FOUND && ev[e + 1] === 0) found = ev[e + 3]; }
  assert.equal(found, v); assert.equal(s.cache[k], 0); assert.equal(s.g(0, CG.FOUND), v >> 1);
  s.step(); agrees(s);
  assert.ok(s.g(0, slot) > before - 10 + (v >> 1) - 12, 'the loads are in the stores');
  assert.equal(new Sim({ seed: 5, mission: 'crossing', caches: 0 }).cache.some(x => x), false, 'a match can be set with none');
});

test('stores: a save taken after a dig mark carries on the same', () => {
  const s = new Sim({ seed: 2, mission: 'crossing' }), L = s.L, dx = s.door[0] % L.sw;
  for (let k = 0; k < 40; k++) s.step();
  s.order({ team: 0, type: CMD.DIG, cells: [dx + 3, 5, dx + 4, 5] }); s.step();
  const b = Sim.load(JSON.parse(JSON.stringify(s.save(), (k, v) => (ArrayBuffer.isView(v) ? Array.from(v) : v))));
  assert.equal(b.hash(), s.hash());
  s.take(0, 0, 1); b.take(0, 0, 1); assert.equal(b.hash(), s.hash(), 'the same cell gives up the load');
  for (let k = 0; k < 600; k++) { s.step(); b.step(); }
  assert.equal(b.hash(), s.hash());
});

// ---- The Wall: digging into the other nest ----
const copyOf = s => Sim.load(JSON.parse(JSON.stringify(s.save(), (k, v) => (ArrayBuffer.isView(v) ? Array.from(v) : v))));
const rowRun = (s, y) => { const L = s.L, cells = []; for (let x = (s.door[0] % L.sw) + 6; x <= (s.door[1] % L.sw) - 7; x++) cells.push(x, y); return cells; };

test('outside The Wall no colony marks the rival\'s ground or sends a raid under ground', () => {
  const s = new Sim({ seed: 2, mission: 'crossing' }), L = s.L, ex = s.door[1] % L.sw;
  assert.equal(s.mayBreach(0), false);
  s.order({ team: 0, type: CMD.DIG, cells: [ex + 3, 5, ex + 4, 5] }); s.step();
  assert.equal(s.g(0, CG.MARKS), 0);
  const q = s.queen[1] - L.nestBase;
  s.order({ team: 0, type: CMD.TRAIL, kind: KIND.RAID, level: 2, under: [q % L.nw, Math.floor(q / L.nw)] }); s.step();
  assert.equal(s.trLive.some(v => v), false);
  assert.equal(s.underF[0], null, 'and nothing is worked out for it');
});

test('The Wall: the wall is whole, the hills stand close, and no trail crosses', () => {
  const s = new Sim({ seed: 4, mission: 'wall' }), L = s.L, mid = L.sw >> 1;
  for (let y = 0; y < L.sh; y++) assert.equal(s.mat[y * L.sw + mid], MAT.STONE);
  assert.deepEqual([s.door[0] % L.sw, s.door[1] % L.sw], [58, 101]);
  assert.equal(s.doorF[0][s.door[1]], 0xFFFF, 'no way from one door to the other');
  assert.equal(s.linked, false);
  s.order({ team: 0, type: CMD.TRAIL, kind: KIND.RAID, level: 2, points: [s.door[1] % L.sw, Math.floor(s.door[1] / L.sw)] }); s.step();
  assert.equal(s.trLive.some(v => v), false);
});

test('The Wall: a tunnel dug across the border is heard, joins the nests, and a save in the middle carries on the same', () => {
  const s = new Sim({ seed: 4, mission: 'wall', sugar: 60 }), L = s.L, cells = rowRun(s, 12);
  s.order({ team: 0, type: CMD.DIG, cells });
  s.step(); assert.equal(s.g(0, CG.MARKS), cells.length / 2, 'marks lie on both sides of the border');
  let heard = -1, breach = -1, twin = null;
  for (let j = 0; j < 6000 && breach < 0; j++) {
    if (heard >= 0 && !twin) twin = copyOf(s);
    s.step(); if (twin) twin.step();
    const ev = s.drainEvents();
    for (let e = 0; e < ev.length; e += 4) { if (ev[e] === EVENT.HEARD && heard < 0) { heard = s.tick; assert.equal(ev[e + 1], 1); assert.equal(ev[e + 3], 0); } if (ev[e] === EVENT.BREACH) breach = s.tick; }
  }
  assert.ok(heard > 0 && breach > heard, `heard at ${heard}, through at ${breach}`);
  assert.equal(s.linked, true); assert.equal(twin.hash(), s.hash()); assert.equal(twin.linked, true);
  assert.notEqual(s.queenF[0][s.queen[1]], 0xFFFF, 'and there is a way from queen to queen');
  assert.equal(copyOf(s).linked, true, 'a loaded save knows the nests are joined');
});

test('The Wall: a raid sent under ground goes through the breach to the queen; before the breach it is refused', () => {
  const s = new Sim({ seed: 6, mission: 'wall' }), L = s.L, q = s.queen[1] - L.nestBase, under = [q % L.nw, Math.floor(q / L.nw)];
  s.order({ team: 0, type: CMD.TRAIL, kind: KIND.RAID, level: 3, under }); s.step();
  assert.equal(s.trLive.some(v => v), false, 'no way yet');
  { // its own tunnel, across the border but not through: no strike there, and the log keeps its own copy of the cell
    const t2 = new Sim({ seed: 6, mission: 'wall' }), run = rowRun(t2, 12).slice(0, -8), tip = [run[run.length - 2], 12];
    for (let j = 0; j < run.length; j += 2) t2.mat[L.nestBase + 12 * L.nw + run[j]] = MAT.OPEN;
    t2.recount(); t2.rebuildFields(); assert.equal(t2.linked, false); assert.equal(t2.owner(12 * L.nw + tip[0]), 1);
    t2.order({ team: 0, type: CMD.TRAIL, kind: KIND.RAID, level: 2, under: tip }); tip[0] = 0; assert.equal(t2.queue[t2.queue.length - 1].under[0], run[run.length - 2]);
    t2.step(); assert.equal(t2.trLive.some(v => v), false, 'the tip is not through');
    // and the rival does not count that tunnel as a place of its own to dig from
    t2.cache[14 * L.nw + tip[0]] = 2 * 10; const cr = cacheRun(t2, 1); assert.ok(cr.length);
    assert.ok([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ax, ay]) => t2.underF[1][L.nestBase + (cr[1] + ay) * L.nw + cr[0] + ax] !== 0xFFFF), 'the dig for a cache starts beside a cell its own ants can reach');
  }
  const cells = rowRun(s, 12); for (let j = 0; j < cells.length; j += 2) s.mat[L.nestBase + cells[j + 1] * L.nw + cells[j]] = MAT.OPEN;
  s.recount(); s.rebuildFields(); assert.equal(s.linked, true);
  for (let j = 0; j < 12; j++) s.spawn(0, CASTE.MAJOR, s.store[0]);
  s.order({ team: 0, type: CMD.TRAIL, kind: KIND.RAID, level: 3, under });
  let inside = 0;
  for (let j = 0; j < 3000 && !s.result; j++) { s.step(); let now = 0; for (let i = 0; i < s.n; i++) if (s.team[i] === 0 && s.hp[i] > 0 && s.layer[i] === 1 && s.caste[i] === CASTE.MAJOR && s.owner((s.y[i] >> 8) * L.nw + (s.x[i] >> 8)) === 1) now++; inside = Math.max(inside, now); }
  assert.ok(inside >= 6, `${inside} soldiers were in the rival's ground under it`);
  assert.equal(s.result, 1, 'and the queen fell');
  assert.equal(s.why, 1);
});

test('The Wall: the rival digs for the other nest, and a guard post where a breach comes in decides the fight', { timeout: 120000 }, () => {
  // Minds alone: two steady rivals join their nests.
  const m = new Host({ seed: 2, mission: 'wall', ai: { 0: 1, 1: 1 } }); let joined = false; while (!m.sim.result && m.sim.tick < 9600) { m.run(20); joined ||= m.sim.linked; }
  assert.equal(joined, true);
  // The same strike, with and without the answer: seat 0 digs and sends every soldier through at 6000.
  const fight = guard => {
    const meek = { mood: 0, meek: true, caches: false, breach: false, plug: false };
    const h = new Host({ seed: 3, mission: 'wall', ai: { 0: meek, 1: { ...meek, guard } } }), s = h.sim, L = s.L; let sent = false, posts = 0;
    while (!s.result && s.tick < 9600) {
      if (s.tick === 600) h.order({ team: 0, type: CMD.DIG, cells: rowRun(s, 12) });
      if (s.linked && !sent && s.tick >= 6000) { sent = true; posts = s.postCells[1].length; const q = s.queen[1] - L.nestBase; h.order({ team: 0, type: CMD.TRAIL, kind: KIND.RAID, level: 3, under: [q % L.nw, Math.floor(q / L.nw)] }); }
      h.run(1);
    }
    return { why: s.why, hp: s.g(1, CG.QUEEN_HP), posts };
  };
  const open = fight(false), held = fight(true);
  // Both defenders keep the usual post in the throat of the shaft, by the door. Only one answers the breach.
  assert.equal(open.hp, 0, 'a post by the door does not stop a strike that comes through the clay: the queen falls');
  assert.equal(held.posts - open.posts, 6, 'the rival posts its guard on the six cells where the tunnel comes in');
  assert.ok(held.hp > 0, 'and with it she lives');
});

test('The Wall: the rival\'s dig is a way through the clay, and the mouth is on the defender\'s side', () => {
  const s = new Sim({ seed: 1, mission: 'wall' }), L = s.L;
  for (const aim of [0, 1, 2]) { const run = breachRun(s, 0, 1, aim); assert.ok(run.length >= 40 && run.length <= 2 * 60, `aim ${aim}: ${run.length / 2} cells`); for (let j = 0; j < run.length; j += 2) assert.equal(s.mat[L.nestBase + run[j + 1] * L.nw + run[j]], MAT.CLAY); }
  assert.deepEqual(mouth(s, 1, 0, 6), []);
  { const run = breachRun(s, 0, 1), j = run.length - 6, k = run[j + 1] * L.nw + run[j]; s.mark[k] = 2; const round = breachRun(s, 0, 1); assert.ok(round.length); for (let i = 0; i < round.length; i += 2) assert.notEqual(round[i + 1] * L.nw + round[i], k, 'goes round clay the rival has marked'); s.mark[k] = 0; }
  const cells = rowRun(s, 12); for (let j = 0; j < cells.length; j += 2) s.mat[L.nestBase + cells[j + 1] * L.nw + cells[j]] = MAT.OPEN;
  s.recount(); s.rebuildFields();
  const at = mouth(s, 1, 0, 6); assert.equal(at.length, 12);
  for (let j = 0; j < at.length; j += 2) { assert.equal(at[j + 1], 12); assert.equal(s.owner(12 * L.nw + at[j]), 1); assert.equal(s.room[12 * L.nw + at[j]], 0); }
  assert.deepEqual(breachRun(s, 0, 1), [], 'joined: nothing more to dig');
  // A tunnel that comes straight into a room: the post goes on the way on from that room, not nowhere.
  for (let j = 0; j < cells.length; j += 2) { const k = cells[j + 1] * L.nw + cells[j]; if (s.owner(k) === 1) s.room[k] = ROOM.NURSERY; }
  const on = mouth(s, 1, 0, 6); assert.ok(on.length >= 2, 'a post beyond the room');
  for (let j = 0; j < on.length; j += 2) { const k = on[j + 1] * L.nw + on[j]; assert.equal(s.owner(k), 1); assert.equal(s.room[k], 0); assert.equal(s.mat[L.nestBase + k], MAT.OPEN); }
});

test('The Wall: on its own ground a colony takes a rival\'s dig mark over, so a mark cannot block its rooms', () => {
  const s = new Sim({ seed: 1, mission: 'wall' }), L = s.L, ex = s.door[1] % L.sw, cells = [ex - 8, 12, ex - 9, 12];
  s.order({ team: 0, type: CMD.DIG, cells }); s.step();
  assert.equal(s.g(0, CG.MARKS), 2);
  s.order({ team: 1, type: CMD.ROOM, kind: ROOM.NURSERY, dig: 1, cells }); s.step();
  assert.equal(s.g(0, CG.MARKS), 0); assert.equal(s.g(1, CG.MARKS), 2);
  assert.equal(s.room[12 * L.nw + ex - 8], ROOM.NURSERY);
  // And the digger's own unmark takes off only its own marks, there or at home.
  s.order({ team: 0, type: CMD.DIG, on: 0, cells }); s.step();
  assert.equal(s.g(1, CG.MARKS), 2);
});

test('The Wall: a plug packs a tunnel shut; it is slow and dear to dig out, and cannot wall the queen in', () => {
  const s = new Sim({ seed: 5, mission: 'wall', sugar: 60 }), L = s.L, cells = rowRun(s, 12);
  for (let j = 0; j < cells.length; j += 2) s.mat[L.nestBase + 12 * L.nw + cells[j]] = MAT.OPEN;
  s.recount(); s.rebuildFields(); assert.equal(s.linked, true);
  const mine = []; for (let j = 0; j < cells.length; j += 2) if (s.owner(12 * L.nw + cells[j]) === 1) mine.push(cells[j]);
  const x = mine[2], k = 12 * L.nw + x, sugar = s.g(1, CG.SUGAR);
  // not the rival's to pack, not the shaft, not a room
  s.order({ team: 0, type: CMD.FILL, cells: [x, 12] }); s.step(); assert.equal(s.mat[L.nestBase + k], MAT.OPEN);
  const dx = s.door[1] % L.sw; s.order({ team: 1, type: CMD.FILL, cells: [dx, 8] }); s.step(); assert.equal(s.mat[L.nestBase + 8 * L.nw + dx], MAT.OPEN, 'the shaft to the door stays open');
  s.order({ team: 1, type: CMD.FILL, cells: [dx, 11] }); s.step(); assert.equal(s.mat[L.nestBase + 11 * L.nw + dx], MAT.OPEN, 'a room cell is not packed');
  s.order({ team: 1, type: CMD.FILL, cells: [x, 12] }); s.step();
  assert.equal(s.mat[L.nestBase + k], MAT.CLAY); assert.equal(s.room[k], PLUG); assert.equal(s.linked, false); assert.equal(s.g(1, CG.SUGAR), sugar - C.PLUG_SUGAR);
  const twin = copyOf(s); assert.equal(twin.hash(), s.hash()); assert.equal(twin.room[k], PLUG);
  // Seat 0 digs it out: it takes far longer than clay, and costs more.
  const before = s.g(0, CG.SUGAR), eaten = () => 0; void eaten;
  s.order({ team: 0, type: CMD.DIG, cells: [x, 12] }); let t0 = s.tick, open = -1;
  for (let j = 0; j < 4000 && open < 0; j++) { s.step(); if (s.mat[L.nestBase + k] === MAT.OPEN) open = s.tick - t0; }
  assert.ok(open >= C.DIG_TICKS * C.PLUG_SLOW, `dug out in ${open} ticks`); assert.equal(s.room[k], 0); assert.equal(s.linked, true);
  // no more than a few at once
  // with the rival's diggers at the face, no packing it again
  s.order({ team: 1, type: CMD.FILL, cells: [mine[3], 12] }); s.step(); assert.equal(s.mat[L.nestBase + 12 * L.nw + mine[3]], MAT.OPEN, 'not in their faces');
  // no more than a few at once
  for (let j = 0; j < 6; j++) twin.order({ team: 1, type: CMD.FILL, cells: [mine[j], 12] }); twin.step();
  let n = 0; for (const mx of mine) if (twin.room[12 * L.nw + mx] === PLUG) n++; assert.equal(n, C.PLUGS_MAX);
});

test('Sappers: a colony with the node may dig for the other nest on any ground; one without may not', () => {
  const s = new Sim({ seed: 3, mission: 'crossing', tiers: false, traits: [['sappers'], []] }), L = s.L;
  assert.equal(s.mayBreach(0), true); assert.equal(s.mayBreach(1), false); assert.equal(s.mayPlug(), true);
  const x = L.nw - 20; s.order({ team: 0, type: CMD.DIG, cells: [x, 20] }); s.order({ team: 1, type: CMD.DIG, cells: [20, 20] }); s.step();
  assert.equal(s.mark[20 * L.nw + x], 1); assert.equal(s.mark[20 * L.nw + 20], 0);
  assert.equal(new Sim({ seed: 3, mission: 'crossing' }).mayPlug(), false);
});

test('Growth: the chamber grows for seeds and a pause in laying; the first growth takes a branch', () => {
  const s = new Sim({ seed: 4, mission: 'crossing', tiers: true, sugar: 100 }), L = s.L, row = TIERS.grow[0];
  const off = new Sim({ seed: 4, mission: 'crossing', sugar: 100, tiers: false }); off.order({ team: 0, type: CMD.GROW, branch: BRANCH.WAR }); off.step(); assert.equal(off.g(0, CG.GROW), 0, 'not without tiers');
  s.order({ team: 0, type: CMD.GROW }); s.step(); assert.equal(s.g(0, CG.GROW), 0, 'the first growth needs a branch');
  const sugar = s.g(0, CG.SUGAR), open = () => { let n = 0; for (let k = 0; k < L.nw * L.nh; k++) if (s.owner(k) === 0 && s.mat[L.nestBase + k] === MAT.OPEN) n++; return n; }, was = open();
  s.order({ team: 0, type: CMD.GROW, branch: BRANCH.DEEP }); s.step();
  assert.equal(s.g(0, CG.SUGAR), sugar - row.sugar); assert.equal(s.g(0, CG.BRANCH), BRANCH.DEEP); assert.ok(s.g(0, CG.GROW) > 0);
  s.order({ team: 0, type: CMD.GROW }); s.step(); assert.equal(s.g(0, CG.TIER), 0, 'one growth at a time');
  // she lays nothing while it is done
  const mid = copyOf(s); assert.equal(mid.hash(), s.hash());
  let told = null; while (s.g(0, CG.GROW) > 0) { s.step(); mid.step(); const ev = s.drainEvents(); assert.equal(ev.length % 4, 0); for (let k = 0; k < ev.length; k += 4) if (ev[k] === EVENT.TIER) told = ev.slice(k, k + 4); }
  assert.deepEqual(told, [EVENT.TIER, 0, 2, BRANCH.DEEP]);
  assert.equal(mid.hash(), s.hash(), 'a save in the middle of a growth carries on the same');
  assert.equal(s.g(0, CG.TIER), 1); assert.ok(open() > was, 'the chamber is wider'); assert.ok(s.stat[0].pupa < s.stat[1].pupa);
  assert.equal(s.g(1, CG.TIER), 0);
  const again = copyOf(s); assert.equal(again.stat[0].pupa, s.stat[0].pupa, 'a save keeps what the colony grew into'); assert.equal(again.hash(), s.hash());
  // the second growth takes no branch, and there is no third
  s.order({ team: 0, type: CMD.GROW }); for (let j = 0; j < TIERS.grow[1].ticks + 2; j++) s.step();
  assert.equal(s.g(0, CG.TIER), 2); assert.equal(s.g(0, CG.BRANCH), BRANCH.DEEP);
  const left = s.g(0, CG.SUGAR); s.order({ team: 0, type: CMD.GROW }); s.step(); assert.equal(s.g(0, CG.SUGAR), left); assert.equal(s.g(0, CG.GROW), 0);
  // a poor hill cannot
  const poor = new Sim({ seed: 4, mission: 'crossing', tiers: true, sugar: row.sugar }); poor.order({ team: 0, type: CMD.GROW, branch: BRANCH.WAR }); poor.step(); assert.equal(poor.g(0, CG.GROW), 0);
});

test('Growth: laying stops while the chamber grows', () => {
  const run = grow => { const s = new Sim({ seed: 4, mission: 'crossing', tiers: true, sugar: 100, eggs: 0, larvae: 0, pupae: 0 }); if (grow) s.order({ team: 0, type: CMD.GROW, branch: BRANCH.WAR }); for (let j = 0; j < 200; j++) s.step(); let n = 0; for (let b = 0; b < s.bn; b++) if (s.bTeam[b] === 0) n++; return n; };
  assert.equal(run(true), 0); assert.ok(run(false) > 5);
});

test('Growth: a branch opens its own things at the first growth, and the other branch\'s at the second', () => {
  const mk = () => new Sim({ seed: 4, mission: 'crossing', tiers: true, sugar: 200, traits: [['post', 'raiders', 'sappers'], ['post', 'raiders', 'sappers']] });
  const grow = (s, t, br) => { s.order({ team: t, type: CMD.GROW, branch: br }); const at = s.g(t, CG.TIER); for (let j = 0; j < 2000 && s.g(t, CG.TIER) === at; j++) s.step(); };
  const s = mk(), has = t => [s.mayPick(t), s.mayRoom(t, ROOM.POST), !!s.has(t, 'loot'), s.mayBreach(t)];
  assert.deepEqual(has(0), [false, false, false, false]); assert.equal(s.mayRoom(0, ROOM.STORE), true);
  s.order({ team: 0, type: CMD.PICK, caste: CASTE.SPITTER }); s.step(); assert.equal(s.g(0, CG.PICK), 0, 'no third caste at tier 1');
  grow(s, 0, BRANCH.WAR); grow(s, 1, BRANCH.DEEP);
  assert.deepEqual(has(0), [true, false, true, false]); assert.deepEqual(has(1), [false, true, false, false]);
  s.order({ team: 0, type: CMD.PICK, caste: CASTE.SPITTER }); s.order({ team: 1, type: CMD.PICK, caste: CASTE.WARDEN }); s.step(); assert.equal(s.g(0, CG.PICK), CASTE.SPITTER); assert.equal(s.g(1, CG.PICK), 0);
  assert.ok(s.stat[0].hp[CASTE.MAJOR] > s.stat[1].hp[CASTE.MAJOR], 'war: tougher soldiers'); assert.ok(s.stat[1].pupa < s.stat[0].pupa, 'deep: brood hatches sooner');
  grow(s, 0); grow(s, 1);
  assert.deepEqual(has(0), [true, true, true, true]); assert.deepEqual(has(1), [true, true, true, true]);
  assert.equal(s.stat[0].hp[CASTE.MAJOR], s.stat[1].hp[CASTE.MAJOR]);
  // without tiers the nodes are open from the start, as before
  const old = new Sim({ seed: 4, mission: 'crossing', tiers: false, traits: [['post', 'raiders', 'sappers'], []] });
  assert.equal(old.mayRoom(0, ROOM.POST), true); assert.equal(!!old.has(0, 'loot'), true); assert.equal(old.mayBreach(0), true); assert.equal(old.mayPick(0), true);
});

test('Growth: a deep hill\'s stores and quarters hold more in the same cells', () => {
  const s = new Sim({ seed: 4, mission: 'crossing', tiers: true, sugar: 100 }), L = s.L, dx = s.door[0] % L.sw;
  const cells = []; for (let x = 1; x <= 4; x++) cells.push(dx + x, 8); s.order({ team: 0, type: CMD.ROOM, cells, kind: ROOM.REST, dig: true });
  for (let j = 0; j < 3000; j++) s.step();
  const before = s.g(0, CG.CAP_ADULTS) - s.stat[0].house; assert.ok(before > 0, 'quarters dug');
  s.order({ team: 0, type: CMD.GROW, branch: BRANCH.DEEP }); for (let j = 0; j < TIERS.grow[0].ticks + 2; j++) s.step();
  assert.equal(s.g(0, CG.CAP_ADULTS) - s.stat[0].house, (before / 4) * TIERS.widePer[ROOM.REST]);
});
