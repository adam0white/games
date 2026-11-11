export const neighboursSource = Object.freeze({
  repository: 'https://github.com/adam0white/concordia',
  commit: 'ec3c015fda5afb0854c07f61d901107dad644ddb',
  importCommit: 'e99d8771a8bc0a752b00e7f1499a23833f7f1a46',
  tree: '59e20f83c4ba6353431ad42d5eb0f1a5460994e4',
});

// Original Neighbours history stays in Concordia under the coordinator's
// 2026-11-11 signed-import ruling. All other sources retain exact ancestry.
export function assertSourceHistory(game, run) {
  const history = game.source.history;
  if (!history) {
    run('git', ['merge-base', '--is-ancestor', game.source.commit, 'HEAD']);
    return;
  }
  run('git', ['merge-base', '--is-ancestor', history.importCommit, 'HEAD']);
  const tree = run('git', ['rev-parse', `${history.importCommit}:games/${game.slug}`]);
  if (tree !== history.tree) throw new Error(`${game.slug}: signed import tree mismatch`);
}
