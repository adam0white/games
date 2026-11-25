import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { legacyRoutes, reservedPaths } from '../worker-settings.mjs';

// Experiments are static directories, each served at /<slug>/ (a lab item at /lab/<name>/ inside lab/, a small game at /small/<name>/ inside small/).
// They live in experiments/; prototypes/ is the old name and is read the same way until it is renamed.
export const experimentRoots = ['prototypes', 'experiments'];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const directories = path => (existsSync(path) ? readdirSync(path, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name).sort() : []);

// What the build copies to dist/<slug>/. Throws when a slug would share a top-level path with a game, a
// reserved path, a legacy host's name (repair.adamwhite.work serves /smallworks/), an archived game or
// experiment, or the same slug in the other root.
export function planExperiments(cwd, registry, legacy = legacyRoutes) {
  const games = new Set([...registry.games.map(game => game.slug), ...legacy.map(route => route.split('.')[0])]);
  const archived = new Set(['games', 'prototypes'].flatMap(dir => directories(join(cwd, 'archive', dir))));
  const seen = new Map(), plan = [];
  for (const root of experimentRoots) for (const slug of directories(join(cwd, root))) {
    const from = `${root}/${slug}`;
    if (!SLUG.test(slug) || !existsSync(join(cwd, from, 'index.html'))) throw new Error(`Invalid experiment: ${from}`);
    if (seen.has(slug)) throw new Error(`Experiment ${slug} is in both ${seen.get(slug)}/ and ${root}/`);
    if (games.has(slug)) throw new Error(`Experiment ${from} collides with the game or legacy host ${slug}`);
    if (reservedPaths.includes(slug)) throw new Error(`Experiment ${from} takes the reserved path /${slug}/`);
    if (archived.has(slug)) throw new Error(`Experiment ${from} reuses the archived name ${slug}`);
    seen.set(slug, root);
    plan.push({ slug, from });
  }
  return plan;
}
