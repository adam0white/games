import { readFileSync } from 'node:fs';
import { registry, run } from './context.mjs';
import { validateGame } from './game.mjs';
const game = registry.games.find(g => g.slug === process.argv[2]);
if (!game) throw new Error('Unregistered game');
run('git', ['merge-base', '--is-ancestor', game.source.commit, 'HEAD']);
validateGame(game, registry);
run('pnpm', ['--filter', `./games/${game.slug}`, 'run', 'check:lane'], { stdio: 'inherit' });
run('pnpm', ['--filter', `./games/${game.slug}`, 'run', 'test'], { stdio: 'inherit' });

const pkg = JSON.parse(readFileSync(`games/${game.slug}/package.json`, 'utf8'));
if (pkg.scripts?.['ci:check']) run('pnpm', ['--filter', `./games/${game.slug}`, 'run', 'ci:check'], { stdio: 'inherit' });
