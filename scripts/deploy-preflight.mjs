import { checkMainCI } from './lib.mjs';

export function checkLatestMainCI(commit, run) {
  const runs = JSON.parse(run('gh', ['api', `repos/{owner}/{repo}/actions/workflows/ci.yml/runs?head_sha=${commit}&event=push&per_page=100`])).workflow_runs;
  const latest = runs[0];
  if (!latest) throw new Error('No CI run');
  const pages = JSON.parse(run('gh', ['api', '--paginate', '--slurp', `repos/{owner}/{repo}/actions/runs/${latest.id}/jobs?per_page=100`]));
  const remote = run('git', ['ls-remote', 'origin', 'refs/heads/main']).split(/\s/)[0];
  checkMainCI(commit, remote, [latest], pages.flatMap(p => p.jobs));
}
