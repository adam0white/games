import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const tests = readdirSync('scripts').filter(name => name.endsWith('.test.mjs')).sort().map(name => `scripts/${name}`);
execFileSync(process.execPath, ['--test', ...tests], { stdio: 'inherit' });
const { games } = JSON.parse(readFileSync('games.json', 'utf8'));
for (const game of games) {
  execFileSync(process.execPath, ['scripts/check-game.mjs', game.slug], { stdio: 'inherit' });
}
