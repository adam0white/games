import { readFileSync } from 'node:fs';
import { registry, head } from './context.mjs';
import { manifest, packageReleaseMetadata } from './lib.mjs';
import { validateGame } from './game.mjs';
import { verifyRedirects } from './redirect-preflight.mjs';

const commit = head();
// Read the same typed config that `cf` builds from, and present it in the route shape the preflight checks.
const { worker } = (await import('../cloudflare.config.ts')).default;
const routes = [
  ...worker.domains.map(pattern => ({ pattern, custom_domain: true })),
  ...worker.triggers.filter(trigger => trigger.type === 'fetch').map(trigger => ({ pattern: trigger.pattern, zone_name: trigger.zone })),
];
if (routes.length !== worker.domains.length + worker.triggers.length) throw new Error('Unexpected non-fetch trigger in cloudflare.config.ts');
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
