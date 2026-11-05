import { readFileSync } from 'node:fs';
import { registry, run } from './context.mjs';
const game = registry.games.find(g => g.slug === process.argv[2]);
if (!game) throw new Error('Unregistered game');
run('git', ['merge-base', '--is-ancestor', game.source.commit, 'HEAD']);
const path = `games/${game.slug}`;
const pkg = JSON.parse(readFileSync(`${path}/package.json`, 'utf8'));
if (pkg.dependencies?.['@adam0white/human-framework'] !== registry.hfVersion) throw new Error(`${game.slug}: incorrect HF pin`);
run('pnpm', ['--dir', path, 'run', 'check'], { stdio: 'inherit' });
