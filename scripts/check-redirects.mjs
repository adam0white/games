import { readFileSync } from 'node:fs';
import { registry, head } from './context.mjs';
import { manifest, packageReleaseMetadata } from './lib.mjs';
import { validateGame } from './game.mjs';
import { verifyRedirects } from './redirect-preflight.mjs';

const commit = head();
// The current file uses strict JSON (a subset of JSONC); fail closed on parse errors.
const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
await verifyRedirects({
  registry,
  routes: config.routes,
  head: commit,
  expected: game => {
    const pkg = JSON.parse(readFileSync(`games/${game.slug}/package.json`, 'utf8'));
    const metadata = packageReleaseMetadata(pkg, file => JSON.parse(readFileSync(`games/${game.slug}/${file}`, 'utf8')));
    return manifest(registry, game, commit, false, validateGame(game, registry), pkg.version, metadata);
  },
});
