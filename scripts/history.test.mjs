import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { assertSourceHistory, neighboursSource } from './history.mjs';
import { validateRegistry } from './lib.mjs';

test('source custody requires real ancestry and the exact imported tree', () => {
  const dir = mkdtempSync(join(tmpdir(), 'games-history-'));
  const run = (cmd, args) => execFileSync(cmd, args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try {
    run('git', ['init', '-q']);
    run('git', ['config', 'user.name', 'Test']);
    run('git', ['config', 'user.email', 'test@example.invalid']);
    mkdirSync(join(dir, 'games/neighbours'), { recursive: true });
    writeFileSync(join(dir, 'games/neighbours/source'), 'qualified source');
    run('git', ['add', '.']);
    run('git', ['-c', 'commit.gpgsign=false', 'commit', '-qm', 'fixture']);
    const commit = run('git', ['rev-parse', 'HEAD']);
    const tree = run('git', ['rev-parse', 'HEAD:games/neighbours']);
    const cousin = execFileSync('git', ['-c', 'commit.gpgsign=false', 'commit-tree', run('git', ['rev-parse', 'HEAD^{tree}'])], { cwd: dir, input: 'unrelated fixture\n', encoding: 'utf8' }).trim();
    const game = { slug: 'neighbours', source: { commit } };
    assertSourceHistory(game, run);
    assert.throws(() => assertSourceHistory({ ...game, source: { commit: '0'.repeat(40) } }, run));
    game.source.history = { mode: 'original-repository', importCommit: commit, tree };
    assertSourceHistory(game, run);
    assert.throws(() => assertSourceHistory({ ...game, source: { history: { ...game.source.history, importCommit: cousin } } }, run));
    assert.throws(() => assertSourceHistory({ ...game, source: { history: { ...game.source.history, importCommit: '0'.repeat(40) } } }, run));
    assert.throws(() => assertSourceHistory({ ...game, source: { history: { ...game.source.history, tree: '0'.repeat(40) } } }, run), /tree mismatch/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the explicit retained-repository exception is limited to Neighbours', () => {
  const source = { repository: neighboursSource.repository, commit: neighboursSource.commit, history: { mode: 'original-repository', importCommit: neighboursSource.importCommit, tree: neighboursSource.tree } };
  const registry = { hfVersion: '4.17.0', games: [{ slug: 'neighbours', source, saveSchema: 'v1' }] };
  validateRegistry(registry);
  for (const history of [{ ...source.history, mode: 'anything' }, { ...source.history, importCommit: 'bad' }, { ...source.history, tree: 'bad' }]) {
    assert.throws(() => validateRegistry({ ...registry, games: [{ ...registry.games[0], source: { ...source, history } }] }), /history/);
  }
  assert.throws(() => validateRegistry({ ...registry, games: [{ ...registry.games[0], source: { ...source, commit: 'a'.repeat(40) } }] }), /history/);
  assert.throws(() => validateRegistry({ ...registry, games: [{ ...registry.games[0], source: { ...source, history: { ...source.history, importCommit: 'b'.repeat(40), tree: 'c'.repeat(40) } } }] }), /history/);
  assert.throws(() => validateRegistry({ ...registry, games: [{ ...registry.games[0], slug: 'other' }] }), /history/);
  assert.throws(() => validateRegistry({ ...registry, games: [{ ...registry.games[0], source: { ...source, repository: 'https://github.com/other/repo' } }] }), /history/);
});
