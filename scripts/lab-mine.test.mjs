import { test } from 'node:test';
import assert from 'node:assert/strict';
import { settings } from './lab-mine.mjs';

const run = (player, started, events, start = null) => ({ player, at: started, data: { started, start, events } });
const set = (t, name, from, to) => ({ t, type: 'setting', data: { name, from, to } });

test('settings: changers, changes, last pick per player, runs per value', () => {
  const runs = [
    run('a', 1000, [set(10, 'look', 'diner', 'comic'), set(20, 'look', 'comic', 'storybook')], { look: 'diner' }),
    run('b', 2000, [set(5, 'look', 'diner', 'comic')], { look: 'diner' }),
    run('a', 3000, [], { look: 'storybook' }),
  ];
  const between = [run('c', 500, [set(0, 'sound', true, false)])];
  const out = settings(runs, between);
  assert.deepEqual(out.map(x => x.name), ['look', 'sound']);
  const look = out[0];
  assert.equal(look.changers, 2);
  assert.equal(look.changes, 3);
  assert.deepEqual(look.finalPick.sort(), [['comic', 1], ['storybook', 1]]);
  assert.deepEqual(look.runsWith, [['diner', 2], ['storybook', 1]]);
  assert.equal(out[1].changers, 1);
});

test('settings: nothing to report without setting events', () => {
  assert.deepEqual(settings([run('a', 0, [{ t: 0, type: 'serve', data: {} }])], []), []);
});
