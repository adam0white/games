import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { registry, run, head, clean } from './context.mjs';
import { checkMainCI, checkRelease } from './lib.mjs';
if (!registry.games.length) throw new Error('Cannot deploy an empty registry');
if (!clean()) throw new Error('Deploy requires clean source');
const commit = head();
const remoteHead = () => run('git', ['ls-remote', 'origin', 'refs/heads/main']).split(/\s/)[0];
const runs = JSON.parse(run('gh', ['api', `repos/{owner}/{repo}/actions/workflows/ci.yml/runs?head_sha=${commit}&event=push&per_page=100`])).workflow_runs;
const latest = runs[0];
if (!latest) throw new Error('No CI run');
const pages = JSON.parse(run('gh', ['api', '--paginate', '--slurp', `repos/{owner}/{repo}/actions/runs/${latest.id}/jobs?per_page=100`]));
checkMainCI(commit, remoteHead(), [latest], pages.flatMap(p => p.jobs));
const temporary = mkdtempSync(join(tmpdir(), 'games-release-'));
const checkout = join(temporary, 'source');
let added = false;
try {
  run('git', ['worktree', 'add', '--detach', checkout, commit], { stdio: 'inherit' });
  added = true;
  const opts = { cwd: checkout, stdio: 'inherit', env: { ...process.env, PATH: `/opt/homebrew/opt/node@26/bin:${process.env.PATH}` } };
  run('pnpm', ['install', '--frozen-lockfile'], opts);
  run('node', ['scripts/build.mjs'], opts);
  if (remoteHead() !== commit) throw new Error('main advanced during build');
  run('pnpm', ['run', 'deploy:worker'], opts);
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
