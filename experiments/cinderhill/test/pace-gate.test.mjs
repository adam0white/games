// The pace gate (spikes/pace-gate.mjs, 02-spec section 3.1): the ratchet's rules, and the two fixtures on one seed.
// CI runs the whole gate on 20 seeds in its own step; these check that it can fail.
import assert from 'node:assert/strict';
import test from 'node:test';
import { LINES, blocks, play, ratchet } from '../spikes/pace-gate.mjs';

test('the ratchet on blocking lines: a pass that fails, a fail that gets worse or never happens, unrecorded progress and an unread line all fail', () => {
  const base = Object.fromEntries(LINES.map(l => [l.id, { status: 'not built', value: null }]));
  Object.assign(base, { 'first-birth': { status: 'pass', value: 15 }, 'first-delivery': { status: 'fail', value: 16 }, 'first-delivery-passive': { status: 'fail', value: 13 }, 'minute-1-deliveries': { status: 'pass', value: 39 } });
  const now = JSON.parse(JSON.stringify(base));
  assert.deepEqual(ratchet(now, base), []);
  assert.equal(ratchet({ ...now, 'first-birth': { status: 'fail', value: 40 } }, base).length, 1, 'a passing line fails');
  assert.equal(ratchet({ ...now, 'first-delivery': { status: 'fail', value: 30 } }, base).length, 1, 'worse by more than a tenth');
  assert.deepEqual(ratchet({ ...now, 'first-delivery': { status: 'fail', value: 17 } }, base), [], 'within a tenth');
  assert.equal(ratchet({ ...now, 'first-delivery': { status: 'fail', value: null } }, base).length, 1, 'never happens');
  assert.equal(ratchet({ ...now, 'first-delivery': { status: 'pass', value: 9 } }, base).length, 1, 'progress must be recorded');
  assert.equal(ratchet({ ...now, 'first-birth': { status: 'not read', value: null } }, base).length, 1, 'a blocking line must be read');
  assert.deepEqual(ratchet({ ...now, 'gap-0-10': { status: 'fail', value: 999 } }, base), [], 'a line that does not block yet is only reported');
  assert.deepEqual(LINES.filter(l => blocks(l)).map(l => l.id), ['first-delivery', 'first-delivery-passive', 'minute-1-deliveries', 'first-birth'], 'R0 blocks on these (02 section 3.1)');
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
