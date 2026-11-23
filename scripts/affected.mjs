import { appendFileSync } from 'node:fs';
import { affectedGames, phoneCheckNeeded } from './lib.mjs';
import { registry, run } from './context.mjs';
const base = process.argv[2];
if (!base) throw new Error('Base commit required');
const paths = run('git', ['diff', '--name-only', base, 'HEAD']).split('\n').filter(Boolean);
const affected = affectedGames(registry, paths);
// A pull request that changes shared code would check every game, about an hour. That run now happens once,
// on main after the merge, where the deploy waits for it. A pull request still checks a game it changes itself.
const everyGame = registry.games.length > 1 && affected.length === registry.games.length;
const games = process.env.EVENT === 'pull_request' && everyGame ? [] : affected;
const matrix = JSON.stringify(games);
const phone = phoneCheckNeeded(paths);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `games=${matrix}\ncount=${games.length}\ntotal=${registry.games.length}\nphone=${phone}\n`);
else console.log(matrix);
