// The pace gate (spikes/pace-gate.mjs, 02-spec section 3.1): the ratchet's rules, and the two fixtures on one seed.
// CI runs the whole gate on 20 seeds in its own step; these check that it can fail.
import assert from 'node:assert/strict';
import test from 'node:test';
import { LINES, blocks, play, ratchet, slack } from '../spikes/pace-gate.mjs';

test('the ratchet on blocking lines: a pass that fails, a fail that gets worse by a twentieth or never happens, unrecorded progress and an unread line all fail', () => {
  const base = Object.fromEntries(LINES.map(l => [l.id, { status: 'not built', value: null }]));
  Object.assign(base, { 'first-birth': { status: 'pass', value: 15 }, 'first-delivery': { status: 'fail', value: 16 }, 'first-delivery-passive': { status: 'fail', value: 13 }, 'minute-1-deliveries': { status: 'pass', value: 39 }, 'idle-share': { status: 'pass', value: 0.1 }, 'queued-at-doors': { status: 'pass', value: 0.01 }, 'door-jams': { status: 'pass', value: 0 } });
  const now = JSON.parse(JSON.stringify(base)), r0 = (x, y) => ratchet(x, y, undefined, false); // R0: failing lines held by the baseline
  assert.deepEqual(r0(now, base), []);
  assert.equal(r0({ ...now, 'first-birth': { status: 'fail', value: 40 } }, base).length, 1, 'a passing line fails');
  assert.equal(r0({ ...now, 'first-delivery': { status: 'fail', value: 17.2 } }, base).length, 1, 'worse by more than a twentieth');
  assert.deepEqual(r0({ ...now, 'first-delivery': { status: 'fail', value: 17 } }, base), [], 'within a twentieth');
  assert.equal(r0({ ...now, 'first-delivery': { status: 'fail', value: null } }, base).length, 1, 'never happens');
  assert.equal(r0({ ...now, 'first-delivery': { status: 'pass', value: 9 } }, base).length, 1, 'progress must be recorded');
  assert.equal(r0({ ...now, 'first-birth': { status: 'not read', value: null } }, base).length, 1, 'a blocking line must be read');
  assert.deepEqual(r0({ ...now, 'gap-0-10': { status: 'fail', value: 999 } }, base), [], 'a line that does not block yet is only reported');
  assert.equal(ratchet(now, base, undefined, true).length, 2, 'from R1 step 2 a failing blocking line fails whatever its baseline');
  assert.deepEqual(slack({ ...now, 'first-delivery': { status: 'pass', value: 9 } }, base), [], 'a recorded improvement is fine');
  assert.equal(slack({ ...now, 'first-delivery': { status: 'fail', value: 30 } }, base).length, 1, 'a recorded regression is not');
  assert.equal(slack({ ...now, 'first-birth': { status: 'fail', value: 16 } }, base).length, 1, 'nor a recorded pass turned fail');
  const b13 = { ...base, 'first-birth': { status: 'pass', value: 13 } }; // 14.5 is past the slack (13.9) and within the target (15)
  assert.equal(slack({ ...now, 'first-birth': { status: 'pass', value: 14.5 } }, b13).length, 1, 'worse past the slack, no reason');
  assert.deepEqual(slack({ ...now, 'first-birth': { status: 'pass', value: 14.5, accepted: 'a reason' } }, b13), [], 'a passing line recorded worse with a reason');
  assert.equal(slack({ ...now, 'first-birth': { status: 'fail', value: 16, accepted: 'a reason' } }, b13).length, 1, 'a reason does not excuse a fail');
  assert.equal(slack({ ...now, 'first-birth': { status: 'pass', value: 150, accepted: 'a reason' } }, b13).length, 1, 'nor a value past the target recorded as a pass');
  assert.equal(slack({ ...now, 'first-birth': { status: 'pass', value: 14.5, accepted: ['a reason'] } }, b13).length, 1, 'a reason is text');
  assert.equal(slack({ ...now, 'first-birth': { status: 'pass', value: 14.5, accepted: 'a reason' } }, { ...b13, 'first-birth': { status: 'pass', value: 13, accepted: 'a reason' } }).length, 1, 'an old reason excuses nothing new');
  assert.deepEqual(LINES.filter(l => blocks(l)).map(l => l.id), ['first-delivery', 'first-delivery-passive', 'minute-1-deliveries', 'first-birth', 'idle-share', 'queued-at-doors', 'door-jams'], 'R0 to R1 step 3 with doors block on these (02 section 3.1)');
});

test('the quota opening misses the first birth; brood ten times slower misses the first birth', () => {
  const ok = play('median', 1, { minutes: 1 });
  assert.ok(ok.firstBirth !== null && ok.firstBirth <= 15, `first birth ${ok.firstBirth}`);
  const quota = play('median', 1, { minutes: 1, fixture: 'quota' });
  assert.ok(quota.firstBirth === null || quota.firstBirth > 15, `quota first birth ${quota.firstBirth}`);
  const brood = play('median', 1, { minutes: 1, fixture: 'brood10' });
  assert.ok(brood.firstBirth === null || brood.firstBirth > 15, `brood x10 first birth ${brood.firstBirth}`);
  const back = play('median', 1, { minutes: 1 });
  assert.deepEqual(back, ok, 'the fixtures put the start values back');
});

test('a trail delivery on the tick an ant is born still counts as a trip', async () => {
  const { Observer } = await import('../spikes/replay-lab.mjs');
  const { G, SLOT } = await import('../sim/sim.js');
  const N = 8, arr = T => new T(N);
  const sim = {
    n: 2, tick: 0, g: new Int32Array(64), pileCell: [], pileAmount: [], brood: { n: 0 }, cfg: { maxAnts: N },
    carry: arr(Uint8Array), via: arr(Int8Array).fill(-1), mode: arr(Uint8Array), job: arr(Uint8Array), mem: arr(Int16Array), since: arr(Uint16Array), goal: arr(Int8Array), layer: arr(Uint8Array),
    flow: { live: new Uint8Array(16), seq: new Uint32Array(16) }, crew: new Uint16Array(4), mat: new Uint8Array(1),
  };
  const o = new Observer({ sim, lastEvents: [] });
  sim.flow.live[SLOT.TRAIL0] = 1; sim.flow.seq[SLOT.TRAIL0] = 1;
  o.trails.push({ slot: SLOT.TRAIL0, seq: 1, step: 0, end: -1, trips: 0, first: -1 });
  sim.carry[0] = 2; sim.via[0] = SLOT.TRAIL0;
  o.before();
  sim.carry[0] = 0; sim.n = 3; sim.g[G.BORN] = 1; sim.g[G.PROTEIN_LOADS] = 1; // home, and a birth the same tick
  o.after();
  assert.equal(o.trails[0].trips, 1, 'the delivery counts');
  assert.equal(o.trails[0].first, 1);
  assert.equal(o.firstTrailProtein, 1, 'a protein load by trail');
  assert.deepEqual(o.births, [1]);
});

test('colony trips come from the HOME events: a load home by a replaced trail counts for no trail', async () => {
  const { Observer } = await import('../spikes/replay-lab.mjs');
  const { EVENT, FOOD, G, SLOT } = await import('../sim/sim.js');
  const N = 8, arr = T => new T(N);
  const sim = {
    n: 2, tick: 0, g: new Int32Array(64), pileCell: [], pileAmount: [], brood: { n: 0 }, cfg: { maxAnts: N, colony: 1 },
    carry: arr(Uint8Array), via: arr(Int8Array).fill(-1), mode: arr(Uint8Array), job: arr(Uint8Array), mem: arr(Int16Array), since: arr(Uint16Array), goal: arr(Int8Array), layer: arr(Uint8Array),
    flow: { live: new Uint8Array(16), seq: new Uint32Array(16) }, crew: new Uint16Array(4), mat: new Uint8Array(1),
  };
  const host = { sim, lastEvents: [] }, o = new Observer(host);
  // Her trail (seq 1) was replaced in its slot (seq 2) on her way home; the sim reports her load with slot -1.
  sim.flow.live[SLOT.TRAIL0] = 1; sim.flow.seq[SLOT.TRAIL0] = 2;
  o.trails.push({ slot: SLOT.TRAIL0, seq: 2, step: 0, end: -1, trips: 0, first: -1 });
  sim.carry[0] = 1; sim.via[0] = SLOT.TRAIL0;
  o.before();
  sim.carry[0] = 0; sim.g[G.SUGAR_LOADS] = 1; host.lastEvents = [[EVENT.HOME, -1, FOOD.SUGAR]];
  o.after();
  assert.equal(o.trails[0].trips, 0, 'not credited to the replacement');
  // A load home by the trail in the slot now counts, protein too.
  sim.carry[1] = 2; sim.via[1] = SLOT.TRAIL0;
  o.before();
  sim.carry[1] = 0; sim.g[G.PROTEIN_LOADS] = 1; host.lastEvents = [[EVENT.HOME, SLOT.TRAIL0, FOOD.PROTEIN]];
  o.after();
  assert.equal(o.trails[0].trips, 1);
  assert.equal(o.firstTrailProtein, 2);
  // A restart keeps a trail the restored game still has, and closes one it does not.
  o.trails.push({ slot: SLOT.TRAIL0 + 1, seq: 3, step: 2, end: -1, trips: 0, first: -1 });
  o.restart(1, 0);
  assert.equal(o.trails[0].end, -1, 'live in the restored game: plays on');
  assert.equal(o.trails[1].how, 'restart', 'not in it: closed');
});

test('wasted labour: crews that never draw on resting ants leave a gap while a third of the colony idles', async () => {
  const { MODE, Sim } = await import('../sim/sim.js');
  const ok = play('median', 1, { minutes: 3 });
  assert.ok(ok.idleMax <= 0.15, `idle share ${ok.idleMax}`);
  const who = Sim.prototype.whoGoes;
  // The planted fault: a resting free ant stays resting, so a crew short of its size is never filled from the door.
  Sim.prototype.whoGoes = function (i, c, layer, atHome) {
    if (this.mode[i] === MODE.REST && this.via[i] < 0 && atHome) { const o = this.o ?? (this.o = {}); o.follow = -1; o.want = -1; o.still = true; o.wander = false; o.slow = false; return o; }
    return who.call(this, i, c, layer, atHome);
  };
  try {
    const bad = play('median', 1, { minutes: 3 });
    assert.ok(bad.idleMax > 0.15, `planted fault: idle share ${bad.idleMax}`);
  } finally { Sim.prototype.whoGoes = who; }
});

test('wasted labour: ants walking in to take a dig are not idle', async () => {
  const { Observer } = await import('../spikes/replay-lab.mjs');
  const { Host } = await import('../host.js');
  const { CMD, MAT, NEST } = await import('../sim/sim.js');
  const { cellAt } = await import('../sim/grid.js');
  const h = new Host(0, 1, { colony: true }), s = h.sim, H = s.home, obs = new Observer(h), cells = [];
  for (let y = H.y; y < H.y + H.h; y++) for (let x = H.x + H.w; x < H.x + H.w + 3; x++) if (s.mat[cellAt(s.L, NEST, x, y)] !== MAT.OPEN) cells.push(x, y);
  const step = () => { obs.before(); h.step(); obs.after(); };
  while (s.tick < 230) step(); // the opening foragers have rested 11 s
  obs.order({ type: CMD.DIG, cells }, h.order({ type: CMD.DIG, cells }));
  while (s.tick < 330) step();
  assert.ok(obs.idleMax <= 0.15, `idle share ${obs.idleMax}`);
});
