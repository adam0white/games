import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateGame } from './game.mjs';
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

test('Godot release metadata preserves its runtime version and refuses a different HF engine', () => {
  const metadata = { app: 'lefthand', engine: '4.17.0', godot: '4.7.2' };
  const release = manifest(registry, game, 'b'.repeat(40), false, '0.5.17', '0.1.0', metadata);
  assert.equal(release.app, 'lefthand');
  assert.equal(release.godot, '4.7.2');
  assert.equal(release.engine, registry.hfVersion);
  assert.deepEqual(release.source, game.source);
  assert.throws(() => manifest(registry, game, 'b'.repeat(40), false, '0.5.17', '0.1.0', { ...metadata, engine: '4.16.3' }), /engine/i);
  assert.throws(() => manifest(registry, game, 'b'.repeat(40), false, '0.5.17', '0.1.0', { ...metadata, godot: 'latest' }), /metadata/i);
  assert.throws(() => manifest(registry, game, 'b'.repeat(40), false, '0.5.17', '0.1.0', { ...metadata, commit: 'c'.repeat(40) }), /metadata/i);
});

test('scoped headers preserve Cloudflare removal directives', () => {
  assert.match(scopedHeaders('rope', '/assets/*\n  ! Cache-Control\n  Cache-Control: immutable\n'), /\/rope\/assets\/\*\n  ! Cache-Control/);
  assert.throws(() => scopedHeaders('rope', '/assets/*\n  ! Cache-Control injected\n'));
});

test('recorded viewers explicitly omit a Lab client without weakening game manifests', () => {
  const viewer = { ...game, slug: 'island', kind: 'recorded-viewer' };
  const viewers = { ...registry, games: [viewer] };
  assert.equal(manifest(viewers, viewer, 'b'.repeat(40), false, null, '0.1.0').labVersion, null);
  assert.throws(() => manifest(registry, game, 'b'.repeat(40), false, null, '0.1.0'));
  assert.throws(() => manifest(viewers, viewer, 'b'.repeat(40), false, '0.5.17', '0.1.0'));
  assert.throws(() => validateRegistry({ ...registry, games: [{ ...game, kind: 'unknown' }] }));
});

test('a recorded viewer still requires the exact npm HF game engine and forbids aliases', () => {
  const cwd = process.cwd(), root = mkdtempSync(join(tmpdir(), 'viewer-graph-'));
  const viewer = { ...game, slug: 'island', kind: 'recorded-viewer' };
  const viewers = { ...registry, games: [viewer] };
  const deps = { '@adam0white/human-framework': '4.17.0' };
  mkdirSync(join(root, 'games/island/node_modules/@adam0white/human-framework'), { recursive: true });
  writeFileSync(join(root, 'games/island/node_modules/@adam0white/human-framework/package.json'), JSON.stringify({ name: '@adam0white/human-framework', version: '4.17.0' }));
  const pkg = () => writeFileSync(join(root, 'games/island/package.json'), JSON.stringify({ dependencies: deps }));
  try {
    process.chdir(root); pkg();
    assert.equal(validateGame(viewer, viewers), null);
    assert.throws(() => validateGame({ ...viewer, kind: 'game' }, viewers));
    deps.hfLegacy = 'npm:@adam0white/human-framework@2.9.0'; pkg();
    assert.throws(() => validateGame(viewer, viewers), /alias/i);
    delete deps.hfLegacy; deps['@adam0white/human-framework'] = '3.0.0'; pkg();
    assert.throws(() => validateGame(viewer, viewers), /pin/i);
    deps['@adam0white/human-framework'] = '4.17.0'; deps['@adam0white/lab-client'] = '0.5.17'; pkg();
    assert.throws(() => validateGame(viewer, viewers), /unused Lab/i);
    delete deps['@adam0white/lab-client']; deps.alias = 'npm:@adam0white/lab-client@0.5.17'; pkg();
    assert.throws(() => validateGame(viewer, viewers), /unused Lab/i);
  } finally { process.chdir(cwd); rmSync(root, { recursive: true, force: true }); }
});

test('Neighbours cannot stamp a different nested runtime SDK as the outer game version', () => {
  const cwd = process.cwd(), fixture = mkdtempSync(join(tmpdir(), 'neighbours-runtime-pins-'));
  const script = join(cwd, 'games/neighbours/scripts/copy-dist.mjs');
  const dependencies = { '@adam0white/human-framework': '4.17.0', '@adam0white/lab-client': 'client18', '@adam0white/lab-kit': 'kit35' };
  const write = (path, value) => writeFileSync(join(fixture, path), JSON.stringify(value));
  try {
    mkdirSync(join(fixture, 'neighbours/dist'), { recursive: true });
    mkdirSync(join(fixture, 'dist'));
    write('dist/previous.json', { retain: true });
    write('neighbours/dist/current.json', { built: true });
    write('package.json', { dependencies });
    write('neighbours/package.json', { dependencies: { ...dependencies, '@adam0white/lab-client': 'client17' } });
    const refused = spawnSync(process.execPath, [script], { cwd: fixture, encoding: 'utf8' });
    assert.notEqual(refused.status, 0, 'A stale nested client must refuse before copying');
    assert.match(refused.stderr, /nested runtime pin mismatch.*lab-client/i);
    assert.deepEqual(JSON.parse(readFileSync(join(fixture, 'dist/previous.json'), 'utf8')), { retain: true });
    write('neighbours/package.json', { dependencies });
    const accepted = spawnSync(process.execPath, [script], { cwd: fixture, encoding: 'utf8' });
    assert.equal(accepted.status, 0, accepted.stderr);
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});
