import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkLatestMainCI } from './deploy-preflight.mjs';

test('each preflight re-reads main, latest push run and its jobs', () => {
  const sha = 'a'.repeat(40);
  let conclusion = 'success';
  const calls = [];
  const run = (command, args) => {
    calls.push([command, ...args]);
    if (command === 'git') return `${sha}\trefs/heads/main`;
    if (args.at(-1).includes('/jobs?')) return JSON.stringify([{ jobs: [{ name: 'ci', status: 'completed', conclusion: 'success' }] }]);
    return JSON.stringify({ workflow_runs: [{ id: 42, head_sha: sha, head_branch: 'main', event: 'push', status: 'completed', conclusion }] });
  };
  checkLatestMainCI(sha, run);
  conclusion = 'failure';
  assert.throws(() => checkLatestMainCI(sha, run), /CI is not green/);
  assert.equal(calls.filter(([command]) => command === 'git').length, 2);
  assert.equal(calls.filter(call => call.at(-1).includes('/jobs?')).length, 2);
});

test('deployment checks latest CI again after redirects immediately before upload', () => {
  const source = readFileSync('scripts/deploy.mjs', 'utf8');
  assert.match(source, /checkLatestMainCI\(commit, run\);[\s\S]*check-redirects\.mjs[\s\S]*retainDeployBundle\([\s\S]*checkLatestMainCI\(commit, run\);\n\s*\/\/[^\n]*\n\s*if \(bundle\) verifyDeployBundle\(\{ dist: uploaded[^\n]*\n\s*\/\/[^\n]*\n\s*if \(process\.env\.GAMES_DEPLOYER === 'wrangler'\) run\('pnpm', \['exec', 'wrangler', 'deploy'\][^\n]*\n\s*else run\('pnpm', \['exec', 'cf', 'deploy', '--prebuilt', '--mode', 'production'\]/);
});

test('the Wrangler rollback config matches the cf config', async () => {
  const legacy = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
  const settings = await import('../worker-settings.mjs');
  assert.equal(legacy.name, settings.name);
  assert.equal(legacy.compatibility_date, settings.compatibilityDate);
  assert.deepEqual(legacy.routes.filter(route => route.custom_domain).map(route => route.pattern), settings.domains);
  assert.deepEqual(legacy.routes.filter(route => !route.custom_domain).map(route => [route.pattern, route.zone_name]), settings.legacyRoutes.map(pattern => [pattern, settings.zone]));
  assert.deepEqual([legacy.assets.run_worker_first, legacy.assets.not_found_handling], [settings.assets.runWorkerFirst, settings.assets.notFoundHandling]);
  // cloudflare.config.ts must take these values from worker-settings.mjs, not restate them.
  const config = readFileSync('cloudflare.config.ts', 'utf8');
  assert.match(config, /import \{ assets, compatibilityDate, domains, legacyRoutes, name, zone \} from "\.\/worker-settings\.mjs";/);
  assert.match(config, /triggers: legacyRoutes\.map\(\(pattern\) => triggers\.fetch\(\{ pattern, zone \}\)\),/);
});
