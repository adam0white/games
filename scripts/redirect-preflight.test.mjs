import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { verifyRedirects, repositoryEvidence } from './redirect-preflight.mjs';
import { manifest } from './lib.mjs';

const OLD = 'https://rope.adamwhite.work';
const PLAY = 'https://play.adamwhite.work';
const routes = [{ pattern: 'play.adamwhite.work', custom_domain: true }, { pattern: 'rope.adamwhite.work/*', zone_name: 'adamwhite.work' }];
function fixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'redirect-preflight-test-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  git('init', '-q', '-b', 'main'); git('config', 'user.email', 'test@example.invalid'); git('config', 'user.name', 'Fixture');
  const game = { slug: 'rope', source: { repository: 'https://github.com/adam0white/rope', commit: 'a'.repeat(40) }, saveSchema: 'rope/1', legacyOrigin: OLD, redirectEnabled: false };
  const registry = { hfVersion: '4.17.0', games: [game] };
  mkdirSync(join(cwd, 'games/rope/vendor'), { recursive: true });
  mkdirSync(join(cwd, 'package'));
  writeFileSync(join(cwd, 'package/package.json'), JSON.stringify({ name: '@adam0white/lab-client', version: '0.5.16' }));
  execFileSync('tar', ['-czf', 'games/rope/vendor/client.tgz', 'package/package.json'], { cwd });
  rmSync(join(cwd, 'package'), { recursive: true });
  writeFileSync(join(cwd, 'games/rope/package.json'), JSON.stringify({ name: 'rope', version: '1.0.0', dependencies: { '@adam0white/human-framework': '4.17.0', '@adam0white/lab-client': 'file:vendor/client.tgz' } }));
  writeFileSync(join(cwd, 'games/rope/main.js'), 'initial');
  function commit() {
    writeFileSync(join(cwd, 'games.json'), JSON.stringify(registry)); git('add', '.');
    let parent = ''; try { parent = `parent ${git('rev-parse', 'HEAD')}\n`; } catch {}
    // Synthetic commit objects avoid requiring signing keys in CI. Production signing is untouched.
    const object = `tree ${git('write-tree')}\n${parent}author Fixture <test@example.invalid> 1700000000 +0000\ncommitter Fixture <test@example.invalid> 1700000000 +0000\n\nfixture\n`;
    const sha = execFileSync('git', ['hash-object', '-t', 'commit', '-w', '--stdin'], { cwd, input: object, encoding: 'utf8' }).trim();
    git('update-ref', 'HEAD', sha); return sha;
  }
  const liveCommit = commit();
  game.redirectEnabled = true; game.verifiedRelease = liveCommit;
  let head = commit();
  const live = manifest(registry, game, liveCommit, false, '0.5.16', '1.0.0');
  const fetches = [];
  const args = () => ({ registry, routes, head, evidence: repositoryEvidence(cwd), expected: () => manifest(registry, game, head, false, '0.5.16', JSON.parse(execFileSync('git', ['show', `${head}:games/rope/package.json`], { cwd, encoding: 'utf8' })).version), fetch: async (url, options) => { fetches.push({ url, options }); return { ok: true, status: 200, url, redirected: false, json: async () => structuredClone(live) }; } });
  return { cwd, git, registry, game, live, liveCommit, args, fetches, commit, setHead: value => { head = value; } };
}
test('initial activation requires direct verified live release and exact configured host', async t => {
  const f = fixture(t);
  await verifyRedirects(f.args());
  assert.equal(f.fetches.length, 1);
  assert.equal(f.fetches[0].url, `${PLAY}/rope/release.json`);
  assert.equal(f.fetches[0].options.redirect, 'manual');
  await verifyRedirects({ ...f.args(), routes: [routes[0], { ...routes[1], custom_domain: false }] });
  for (const invalid of [
    { pattern: 'rope.adamwhite.work', custom_domain: true },
    { ...routes[1], custom_domain: true },
    { ...routes[1], zone_name: 'other.work' },
    { pattern: 'rope.adamwhite.work/*' },
    { ...routes[1], pattern: '*.adamwhite.work/*' },
    { ...routes[1], pattern: 'rope.adamwhite.work/only/*' },
  ]) {
    await assert.rejects(verifyRedirects({ ...f.args(), routes: [routes[0], invalid] }), /route/i);
  }
  await assert.rejects(verifyRedirects({ ...f.args(), routes: [{ pattern: 'play.adamwhite.work/*', zone_name: 'adamwhite.work' }, routes[1]] }), /route/i);
  await assert.rejects(verifyRedirects({ ...f.args(), routes: routes.slice(0, 1) }), /route/i);
  await assert.rejects(verifyRedirects({ ...f.args(), routes: [...routes, { pattern: '*.adamwhite.work', custom_domain: true }] }), /route/i);
});
test('inactive aliases never fetch and cannot have live routes', async t => {
  const f = fixture(t); f.game.redirectEnabled = false;
  await verifyRedirects({ ...f.args(), routes: routes.slice(0, 1) });
  assert.equal(f.fetches.length, 0);
  await assert.rejects(verifyRedirects(f.args()), /route/i);
});
test('activation rejects redirects, wrong game, hash, dirty, source and version', async t => {
  const f = fixture(t);
  for (const patch of [{ game: 'other' }, { commit: 'invalid' }, { dirty: true }, { source: { ...f.game.source, commit: 'b'.repeat(40) } }, { hfVersion: '4.16.0' }, { app: '2.0.0' }, { labVersion: '0.1.0' }]) {
    await assert.rejects(verifyRedirects({ ...f.args(), fetch: async url => ({ ok: true, status: 200, url, redirected: false, json: async () => ({ ...f.live, ...patch }) }) }));
  }
  for (const response of [{ ok: false, status: 302 }, { ok: true, status: 200, redirected: true }, { ok: true, status: 200, url: 'https://other.invalid' }]) {
    await assert.rejects(verifyRedirects({ ...f.args(), fetch: async url => ({ url, ...response, json: async () => f.live }) }), /release|redirect/i);
  }
});
test('unknown or nonancestor verification and live commits fail closed', async t => {
  const f = fixture(t);
  f.game.verifiedRelease = 'b'.repeat(40);
  await assert.rejects(verifyRedirects(f.args()), /ancestor|commit/i);
  f.game.verifiedRelease = f.liveCommit;
  f.live.commit = 'c'.repeat(40);
  await assert.rejects(verifyRedirects(f.args()), /ancestor|commit/i);
  f.git('checkout', '-qb', 'unrelated', f.liveCommit);
  writeFileSync(join(f.cwd, 'other'), 'other');
  const other = f.commit();
  f.git('checkout', 'main');
  f.live.commit = other;
  await assert.rejects(verifyRedirects(f.args()), /ancestor|commit/i);
  f.live.commit = f.liveCommit; f.game.verifiedRelease = other;
  await assert.rejects(verifyRedirects(f.args()), /ancestor|commit/i);
});
test('first activation rejects game changes after the live release', async t => {
  const f = fixture(t);
  writeFileSync(join(f.cwd, 'games/rope/main.js'), 'changed'); f.setHead(f.commit());
  await assert.rejects(verifyRedirects(f.args()), /changed|unchanged/i);
});
test('already active aliases retain verification and allow later game upgrades', async t => {
  const f = fixture(t);
  const activeCommit = f.git('rev-parse', 'HEAD');
  f.live.commit = activeCommit;
  writeFileSync(join(f.cwd, 'games/rope/main.js'), 'upgraded');
  f.registry.hfVersion = '4.18.0';
  writeFileSync(join(f.cwd, 'games/rope/package.json'), JSON.stringify({ name: 'rope', version: '2.0.0', dependencies: { '@adam0white/human-framework': '4.18.0', '@adam0white/lab-client': 'file:vendor/client.tgz' } }));
  f.setHead(f.commit());
  await verifyRedirects(f.args());
  f.game.verifiedRelease = activeCommit;
  await assert.rejects(verifyRedirects(f.args()), /verification|record/i);
});

test('first activation rejects a new shared engine version even with unchanged game files', async t => {
  const f = fixture(t);
  f.registry.hfVersion = '4.18.0'; f.setHead(f.commit());
  await assert.rejects(verifyRedirects(f.args()), /full current release metadata/i);
});

test('historical release reads exact public SDK pins and rejects ambiguous URLs', t => {
  const f = fixture(t);
  const url = 'https://github.com/adam0white/human-framework/releases/download/lab-client-v0.5.16/adam0white-lab-client-0.5.16.tgz';
  const release = value => {
    writeFileSync(join(f.cwd, 'games/rope/package.json'), JSON.stringify({ version: '1.0.0', dependencies: { '@adam0white/human-framework': '4.17.0', '@adam0white/lab-client': value } }));
    const sha = f.commit();
    return repositoryEvidence(f.cwd).release(sha, f.registry, f.game);
  };
  assert.equal(release(url).labVersion, '0.5.16');
  for (const invalid of [url.replace('github.com', 'example.com'), url.replace('/lab-client-v0.5.16/', '/lab-client-v0.5.15/'), `${url}?download=1`, url.replace('https:', 'http:')]) assert.throws(() => release(invalid), /artifact/i);
});
