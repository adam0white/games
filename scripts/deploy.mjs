import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { registry, run, head, clean } from './context.mjs';
import { checkRelease } from './lib.mjs';
import { checkLatestMainCI } from './deploy-preflight.mjs';
import { buildEnvironment } from './deploy-env.mjs';
import { retainDeployBundle, verifyDeployBundle } from './deploy-bundle.mjs';
if (!registry.games.length) throw new Error('Cannot deploy an empty registry');
if (!clean()) throw new Error('Deploy requires clean source');
const commit = head();
checkLatestMainCI(commit, run);
const temporary = mkdtempSync(join(tmpdir(), 'games-release-'));
const checkout = join(temporary, 'source');
let added = false;
try {
  run('git', ['worktree', 'add', '--detach', checkout, commit], { stdio: 'inherit' });
  added = true;
  const opts = { cwd: checkout, stdio: 'inherit', env: buildEnvironment(process.env) };
  run('pnpm', ['install', '--frozen-lockfile'], opts);
  run('node', ['scripts/build.mjs'], opts);
  run('node', ['scripts/check-redirects.mjs'], opts);
  const bundle = process.env.GAMES_DEPLOY_BUNDLE_DIR === undefined ? null : retainDeployBundle({ checkout, dist: join(checkout, 'dist'), output: process.env.GAMES_DEPLOY_BUNDLE_DIR, sourceRoot: process.cwd(), commit, slugs: registry.games.map(game => game.slug) });
  // Repeat the live preflight immediately before upload, after the full build.
  checkLatestMainCI(commit, run);
  run('pnpm', ['exec', 'wrangler', 'deploy'], { ...opts, env: process.env });
  if (bundle) verifyDeployBundle({ dist: join(checkout, 'dist'), output: process.env.GAMES_DEPLOY_BUNDLE_DIR, receipt: bundle });
  for (const game of registry.games) {
    const expected = JSON.parse(readFileSync(join(checkout, 'dist', game.slug, 'release.json'), 'utf8'));
    const url = `https://play.adamwhite.work/${game.slug}/release.json`;
    const response = await fetch(url, { cache: 'no-store', redirect: 'manual' });
    if (!response.ok || response.url !== url) throw new Error(`${game.slug}: release fetch failed`);
    checkRelease(expected, await response.json(), response.redirected || response.status >= 300);
  }
} finally {
  if (added) run('git', ['worktree', 'remove', '--force', checkout], { stdio: 'inherit' });
  rmSync(temporary, { recursive: true, force: true });
}
