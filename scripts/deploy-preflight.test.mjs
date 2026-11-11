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
  assert.match(source, /checkLatestMainCI\(commit, run\);[\s\S]*check-redirects\.mjs[^\n]*\n\s*checkLatestMainCI\(commit, run\);\n\s*run\('pnpm', \['exec', 'wrangler', 'deploy'\]/);
});
