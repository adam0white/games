import { readFileSync } from 'node:fs';
import { registry, run } from './context.mjs';
const game = registry.games.find(g => g.slug === process.argv[2]);
if (!game) throw new Error('Unregistered game');
if (game.ciBrowsers?.length) {
  const pkg = JSON.parse(readFileSync(`games/${game.slug}/package.json`, 'utf8'));
  const tool = pkg.devDependencies?.['playwright-core'] ? 'playwright-core' : 'playwright';
  run('pnpm', ['--filter', `./games/${game.slug}`, 'exec', tool, 'install', '--with-deps', ...game.ciBrowsers], { stdio: 'inherit' });
}
