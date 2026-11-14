import { readFileSync } from 'node:fs';
import { registry, head } from './context.mjs';
import { manifest, packageReleaseMetadata } from './lib.mjs';
import { validateGame } from './game.mjs';
import { verifyRedirects } from './redirect-preflight.mjs';
import { domains, legacyRoutes, zone } from '../worker-settings.mjs';

const commit = head();
// The same plain settings cloudflare.config.ts deploys, in the route shape the preflight checks.
const routes = [
  ...domains.map(pattern => ({ pattern, custom_domain: true })),
  ...legacyRoutes.map(pattern => ({ pattern, zone_name: zone })),
];
await verifyRedirects({
  registry,
  routes,
  head: commit,
  expected: game => {
    const pkg = JSON.parse(readFileSync(`games/${game.slug}/package.json`, 'utf8'));
    const metadata = packageReleaseMetadata(pkg, file => JSON.parse(readFileSync(`games/${game.slug}/${file}`, 'utf8')));
    return manifest(registry, game, commit, false, validateGame(game, registry), pkg.version, metadata);
  },
});
