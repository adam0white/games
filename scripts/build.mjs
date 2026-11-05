import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { registry, run, head, clean } from './context.mjs';
import { manifest } from './lib.mjs';
if (!registry.games.length) throw new Error('Cannot build an empty game registry');
const commit = head();
if (!clean()) throw new Error('Build requires a clean checkout');
rmSync('dist', { recursive: true, force: true });
for (const game of registry.games) {
  run('git', ['merge-base', '--is-ancestor', game.source.commit, 'HEAD']);
  const path = `games/${game.slug}`;
  const pkg = JSON.parse(readFileSync(`${path}/package.json`, 'utf8'));
  if (pkg.dependencies?.['@adam0white/human-framework'] !== registry.hfVersion) throw new Error(`${game.slug}: incorrect HF pin`);
  run('pnpm', ['--dir', path, 'run', 'build'], { stdio: 'inherit' });
  const target = `dist/${game.slug}`;
  mkdirSync(target, { recursive: true });
  cpSync(`${path}/dist`, target, { recursive: true });
  writeFileSync(`${target}/release.json`, JSON.stringify(manifest(registry, game, commit, false)) + '\n');
}
if (head() !== commit || !clean()) throw new Error('Source changed while building');
