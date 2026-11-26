import { appendFileSync } from 'node:fs';
import { affectedGames, phoneChecks } from './lib.mjs';
import { registry, run } from './context.mjs';
const base = process.argv[2];
if (!base) throw new Error('Base commit required');
const paths = run('git', ['diff', '--name-only', base, 'HEAD']).split('\n').filter(Boolean);
const affected = affectedGames(registry, paths);
// A pull request that changes shared code would check every game, about an hour. That run happens nightly
// instead. A pull request still checks a game it changes itself.
const everyGame = registry.games.length > 1 && affected.length === registry.games.length;
// The run on main after a merge checks no game and no phone: the pull request already checked what it changed,
// and Deploy waits for this run. Every game and every phone check run nightly and by hand (schedule, workflow_dispatch).
const push = process.env.EVENT === 'push';
const games = push || (process.env.EVENT === 'pull_request' && everyGame) ? [] : affected;
const matrix = JSON.stringify(games);
const every = process.env.EVENT === 'schedule' || process.env.EVENT === 'workflow_dispatch';
const phoneOnly = push ? '' : every ? 'all' : phoneChecks(paths);
// Slow suites that only a few paths reach. Nightly and by hand they always run.
const touched = prefixes => every || paths.some(path => prefixes.some(prefix => path.startsWith(prefix)));
const cinderhill = touched(['experiments/cinderhill/', 'workers/cinderhill/']);
const workers = touched(['workers/', 'experiments/cinderhill/', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml']);
const phone = phoneOnly !== '';
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `games=${matrix}\ncount=${games.length}\ntotal=${registry.games.length}\nphone=${phone}\nphoneOnly=${phoneOnly}\ncinderhill=${cinderhill}\nworkers=${workers}\n`);
else console.log(matrix);
