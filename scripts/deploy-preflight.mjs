import { checkMainCI } from './lib.mjs';

export function checkLatestMainCI(commit, run) {
  const runs = JSON.parse(run('gh', ['api', `repos/{owner}/{repo}/actions/workflows/ci.yml/runs?head_sha=${commit}&event=push&per_page=100`])).workflow_runs;
  const latest = runs[0];
  if (!latest) throw new Error('No CI run');
  const pages = JSON.parse(run('gh', ['api', '--paginate', '--slurp', `repos/{owner}/{repo}/actions/runs/${latest.id}/jobs?per_page=100`]));
  const remote = run('git', ['ls-remote', 'origin', 'refs/heads/main']).split(/\s/)[0];
  // Main may have moved on while this commit's run finished. The commit still deploys when main contains it:
  // requiring it to be the newest commit left nothing deployed on a night of merges a few minutes apart.
  // Deploy runs one at a time in the order their CI runs finished, so an older commit never lands after a newer one.
  const onMain = remote === commit || JSON.parse(run('gh', ['api', `repos/{owner}/{repo}/compare/${commit}...${remote}`])).status === 'ahead';
  checkMainCI(commit, onMain ? commit : remote, [latest], pages.flatMap(p => p.jobs));
}
