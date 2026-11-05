import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRegistry, affectedGames, checkResults, manifest } from './lib.mjs';
const registry = { hfVersion: '4.17.0', games: [{ slug: 'rope', source: { repository: 'https://github.com/adam0white/rope', commit: 'a'.repeat(40) } }, { slug: 'pass', source: { repository: 'https://github.com/adam0white/pass', commit: 'b'.repeat(40) } }] };
test('rejects unsafe and duplicate slugs and malformed lineage', () => {
  assert.throws(() => validateRegistry({ ...registry, games: [registry.games[0], registry.games[0]] }));
  assert.throws(() => validateRegistry({ ...registry, games: [{ ...registry.games[0], slug: '../escape' }] }));
  assert.throws(() => validateRegistry({ ...registry, games: [{ ...registry.games[0], source: { repository: 'x', commit: 'bad' } }] }));
});
test('shared changes affect every game; game changes affect only their game', () => {
  assert.deepEqual(affectedGames(registry, ['scripts/lib.mjs']), ['rope', 'pass']);
  assert.deepEqual(affectedGames(registry, ['games/rope/src/a.ts']), ['rope']);
});
test('aggregate rejects missing, failed and skipped required jobs', () => {
  for (const results of [{}, { rope: 'failure' }, { rope: 'skipped' }]) assert.throws(() => checkResults(['rope'], results));
  assert.doesNotThrow(() => checkResults(['rope'], { rope: 'success' }));
});
test('manifest refuses dirty or incomplete builds', () => {
  assert.throws(() => manifest(registry, registry.games[0], 'c'.repeat(40), true));
  assert.throws(() => manifest(registry, registry.games[0], 'x', false));
  assert.equal(manifest(registry, registry.games[0], 'c'.repeat(40), false).source.commit, 'a'.repeat(40));
});
