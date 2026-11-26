// The pace gate (spikes/pace-gate.mjs, 02-spec section 3.1): the ratchet's rules, and the two fixtures on one seed.
// CI runs the whole gate on 20 seeds in its own step; these check that it can fail.
import assert from 'node:assert/strict';
import test from 'node:test';
import { LINES, blocks, play, ratchet, slack } from '../spikes/pace-gate.mjs';

test('the ratchet on blocking lines: a pass that fails, a fail that gets worse by a twentieth or never happens, unrecorded progress and an unread line all fail', () => {
  const base = Object.fromEntries(LINES.map(l => [l.id, { status: 'not built', value: null }]));
  Object.assign(base, { 'first-birth': { status: 'pass', value: 15 }, 'first-delivery': { status: 'fail', value: 16 }, 'first-delivery-passive': { status: 'fail', value: 13 }, 'minute-1-deliveries': { status: 'pass', value: 39 } });
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
  assert.deepEqual(LINES.filter(l => blocks(l)).map(l => l.id), ['first-delivery', 'first-delivery-passive', 'minute-1-deliveries', 'first-birth'], 'R0 and R1 step 2 block on these (02 section 3.1)');
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
