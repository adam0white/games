import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { validateRegistry, affectedGames, checkResults, manifest, assertFrameworkGraph, scopedHeaders, scopedRedirects, checkRelease, checkMainCI } from './lib.mjs';
const game = { slug: 'rope', source: { repository: 'https://github.com/adam0white/rope', commit: 'a'.repeat(40) }, saveSchema: 'v1' };
const registry = { hfVersion: '4.17.0', games: [game] };
test('rejects unsafe lineage and catches shared paths', () => {
  assert.throws(() => validateRegistry({ ...registry, games: [{...game, slug:'../bad'}] }));
  assert.deepEqual(affectedGames(registry, ['scripts/lib.mjs']), ['rope']);
});
test('required CI results cannot be skipped or fail', () => {
  assert.throws(() => checkResults({ tools:'success', changes:'failure', games:'success', build:'success' }, 1));
  assert.throws(() => checkResults({ tools:'success', changes:'success', games:'skipped', build:'success' }, 1));
  assert.doesNotThrow(() => checkResults({ tools:'success', changes:'success', games:'skipped', build:'skipped' }, 0));
  const actual = spawnSync(process.execPath, ['scripts/aggregate.mjs'], { env: {...process.env, TOOLS:'failure', CHANGES:'success', GAMES:'skipped', BUILD:'skipped', COUNT:'0', TOTAL:'0'} });
  assert.notEqual(actual.status, 0);
});
test('only latest successful push and ci job permit release', () => {
  const sha='b'.repeat(40);
  assert.throws(() => checkMainCI(sha, 'c'.repeat(40), [{head_sha:sha, head_branch:'main', event:'push', status:'completed', conclusion:'success'}], [{name:'ci', conclusion:'success'}]));
  assert.throws(() => checkMainCI(sha, sha, [{head_sha:sha, head_branch:'main', event:'push', status:'completed', conclusion:'success'}], [{name:'ci', status:'completed', conclusion:'skipped'}]));
  assert.doesNotThrow(() => checkMainCI(sha, sha, [{head_sha:sha, head_branch:'main', event:'push', status:'completed', conclusion:'success'}], [{name:'ci', status:'completed', conclusion:'success'}]));
});
test('rejects HF legacy aliases and transitive different versions', () => {
  assert.throws(() => assertFrameworkGraph([{ name:'@adam0white/human-framework', version:'3.0.0' }], '4.17.0'));
  assert.throws(() => assertFrameworkGraph([{ name:'@adam0white/human-framework-legacy', version:'3.0.0' }], '4.17.0'));
  assert.doesNotThrow(() => assertFrameworkGraph([{ name:'@adam0white/human-framework', version:'4.17.0' }], '4.17.0'));
});
test('headers and redirects are constrained to game prefix', () => {
  assert.match(scopedHeaders('rope', '/sw.js\n  Cache-Control: no-cache\n'), /^\/rope\/sw\.js/m);
  assert.match(scopedRedirects('rope', '/old /new 302\n'), /^\/rope\/old \/rope\/new 302/m);
  assert.throws(() => scopedHeaders('rope', '/../other\n  X: y\n'));
  assert.throws(() => scopedRedirects('rope', '/old https://evil.example 302\n'));
});
test('release rejects mismatched lineage, version or redirected response', () => {
  const expected=manifest(registry, game, 'b'.repeat(40), false, '0.5.8', '0.2.0');
  assert.equal(expected.framework, '4.17.0');
  assert.equal(expected.app, '0.2.0');
  assert.throws(() => checkRelease(expected, {...expected, hfVersion:'4.16.3'}, false));
  assert.throws(() => checkRelease(expected, expected, true));
});

test('scoped headers preserve Cloudflare removal directives', () => {
  assert.match(scopedHeaders('rope', '/assets/*\n  ! Cache-Control\n  Cache-Control: immutable\n'), /\/rope\/assets\/\*\n  ! Cache-Control/);
  assert.throws(() => scopedHeaders('rope', '/assets/*\n  ! Cache-Control injected\n'));
});
