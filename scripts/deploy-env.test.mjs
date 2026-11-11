import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEnvironment } from './deploy-env.mjs';

test('build children retain runtime settings and never inherit upload or registry tokens', () => {
  const source = { PATH: '/runtime/bin', CI: 'true', HOME: '/session', CLOUDFLARE_API_TOKEN: 'synthetic', CLOUDFLARE_API_KEY: 'synthetic', CF_API_TOKEN: 'synthetic', CF_EMAIL: 'synthetic', CF_GLOBAL_API_KEY: 'synthetic', GH_TOKEN: 'synthetic', GITHUB_TOKEN: 'synthetic', NPM_TOKEN: 'synthetic', NODE_AUTH_TOKEN: 'synthetic' };
  const original = { ...source };
  assert.deepEqual(buildEnvironment(source), { PATH: '/runtime/bin', CI: 'true', HOME: '/session' });
  assert.deepEqual(source, original);
});
