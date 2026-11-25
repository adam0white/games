import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../src/worker.mjs';
import { isProbe } from '../src/probe.mjs';
import registry from '../games.json' with { type: 'json' };
import { planExperiments } from './experiments.mjs';

const top = [...registry.games.map(game => game.slug), ...planExperiments('.', registry).map(entry => entry.slug)];
const call = async (path, topLevel) => {
  let passed = false;
  const env = { ASSETS: { fetch: async () => { passed = true; return new Response('asset'); } } };
  const response = await createHandler(registry.games, [], topLevel).fetch(new Request(`https://play.adamwhite.work${path}`), env);
  return { status: response.status, passed };
};
// Paths from the scans Cloudflare reported on 2026-11-24 and 2026-11-25, one or more per issue.
const anywhere = ['/.env', '/rope/.env', '/%2eenv', '/%2f%2eaws%2fcredentials', '/%252eenv', '/.git/config', '/.git-credentials', '/.gitlab-ci.yml', '/.svn/wc.db', '/.DS_Store', '/.vscode/sftp.json', '/@fs/root/.aws/credentials', '/wp-login.php', '/admin/phpinfo.php', '/elmah.axd', '/dump.sql.gz', '/config.php.bak', '/secrets.yml', '/web.config', '/log/production.log', '/sendgrid.env'];
const unknownTop = ['/actuator/env', '/actuator/heapdump', '/telescope/requests', '/_ignition/health-check', '/_profiler/phpinfo', '/symfony/_profiler/phpinfo', '/credentials.json', '/debug/vars', '/api/actuator/env'];
test('scanner probes get a 404 from the Worker and never reach the assets', async () => {
  for (const path of anywhere) for (const list of [null, top]) assert.deepEqual(await call(path, list), { status: 404, passed: false }, path);
  for (const path of unknownTop) assert.deepEqual(await call(path, top), { status: 404, passed: false }, path);
});
test('real paths still reach the assets', async () => {
  for (const path of ['/rope/', '/rope', '/rope/release.json', '/lantern/?x=1', '/lab/', '/small/night-sand/words.js', '/kit/save.js', '/lefthand/engine/game-abcd.js', '/rope/a%20b.png', '/rope/bad%zz.js', '/.well-known/security.txt']) assert.equal((await call(path, top)).passed, true, path);
  // Without the list (Wrangler rollback) an unknown top-level path passes as before.
  assert.equal((await call('/protocol/', null)).passed, true);
  assert.equal((await call('/protocol/', top)).passed, false);
});
test('old redirects still win', async () => {
  assert.equal((await call('/proto/lantern/', top)).status, 301);
  assert.equal((await call('/lab/thankful/', top)).status, 302);
  assert.equal(isProbe('/', top), false);
});
