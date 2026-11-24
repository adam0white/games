import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { select, workerNames } from '../workers/observability/watch/issues.mjs';

test('only active code faults on this project\'s Workers are selected', () => {
  const names = new Set(['games-static', 'human-framework']);
  const issue = (over = {}) => ({ id: 'a', statusUpdated: 1, service: 'games-static', type: 'exception', status: 'active', count: 3, ...over });
  assert.deepEqual(select([issue()], names), ['a:1 games-static exception 3']);
  assert.deepEqual(select([issue({ service: 'civic-records' })], names), []);
  assert.deepEqual(select([issue({ type: 'security' })], names), []);
  assert.deepEqual(select([issue({ status: 'resolved' })], names), []);
  assert.deepEqual(select([issue({ status: 'ignored' })], names), []);
  // Resolved and back again: a new key, so the watcher starts a run again.
  assert.notEqual(select([issue({ statusUpdated: 2 })], names)[0].split(' ')[0], 'a:1');
});

test('Worker names come from the configs, without the template or the archive', () => {
  const names = workerNames(fileURLToPath(new URL('..', import.meta.url)));
  for (const name of ['games-static', 'games-crumbwar', 'games-feedback', 'games-lab-ai', 'games-wai-daily', 'human-framework']) assert.ok(names.has(name), name);
  assert.ok(![...names].some(name => name.includes('<')));
  assert.ok(!names.has('smoke'));
});
