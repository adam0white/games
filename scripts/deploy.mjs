import { registry, run, head, clean } from './context.mjs';
if (!registry.games.length) throw new Error('Cannot deploy an empty registry');
if (!clean()) throw new Error('Deploy requires clean source');
const commit = head();
const runs = JSON.parse(run('gh', ['api', `repos/{owner}/{repo}/actions/workflows/ci.yml/runs?head_sha=${commit}&event=push&per_page=100`]));
if (!runs.workflow_runs.some(r => r.head_sha === commit && r.head_branch === 'main' && r.status === 'completed' && r.conclusion === 'success')) throw new Error('No successful main CI on exact commit');
const origin = process.env.GAMES_ORIGIN;
if (!origin || !origin.startsWith('https://')) throw new Error('GAMES_ORIGIN must be HTTPS');
run('node', ['scripts/build.mjs'], { stdio: 'inherit' });
run('pnpm', ['run', 'deploy:worker'], { stdio: 'inherit' });
for (const game of registry.games) {
  const response = await fetch(`${origin}/${game.slug}/release.json`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${game.slug}: release fetch failed`);
  const release = await response.json();
  if (release.commit !== commit || release.dirty !== false || release.game !== game.slug || release.hfVersion !== registry.hfVersion || JSON.stringify(release.source) !== JSON.stringify(game.source)) throw new Error(`${game.slug}: release mismatch`);
}
