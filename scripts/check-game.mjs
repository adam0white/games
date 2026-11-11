import { readFileSync } from 'node:fs';
import { registry, run } from './context.mjs';
import { validateGame } from './game.mjs';
import { qualificationScripts } from './qualification.mjs';
const game = registry.games.find(g => g.slug === process.argv[2]);
if (!game) throw new Error('Unregistered game');
run('git', ['merge-base', '--is-ancestor', game.source.commit, 'HEAD']);
validateGame(game, registry);
const pkg = JSON.parse(readFileSync(`games/${game.slug}/package.json`, 'utf8'));
for (const script of qualificationScripts(pkg)) {
  run('pnpm', ['--filter', `./games/${game.slug}`, 'run', script], { stdio: 'inherit' });
}
