import { readFileSync, realpathSync } from 'node:fs';
import { assertFrameworkGraph, assertNoLabDependencies } from './lib.mjs';
export function validateGame(game, registry) {
  const path = `games/${game.slug}`;
  const pkg = JSON.parse(readFileSync(`${path}/package.json`, 'utf8'));
  if (pkg.dependencies?.['@adam0white/human-framework'] !== registry.hfVersion) throw new Error(`${game.slug}: incorrect HF pin`);
  for (const section of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) for (const [name, value] of Object.entries(pkg[section] ?? {})) {
    if (name !== '@adam0white/human-framework' && (name.startsWith('@adam0white/human-framework-') || String(value).includes('npm:@adam0white/human-framework@'))) throw new Error('HF alias forbidden');
  }
  // The game's engine must resolve to the registry pin. The lab artifact retains
  // its own older-person continuity dependency; that is not a game engine route.
  const enginePath = realpathSync(`${path}/node_modules/@adam0white/human-framework/package.json`);
  const engine = JSON.parse(readFileSync(enginePath, 'utf8'));
  assertFrameworkGraph([engine], registry.hfVersion);
  if (game.kind === 'recorded-viewer') {
    assertNoLabDependencies(pkg);
    return null;
  }
  const labPath = realpathSync(`${path}/node_modules/@adam0white/lab-client/package.json`);
  const lab = JSON.parse(readFileSync(labPath, 'utf8'));
  if (lab.name !== '@adam0white/lab-client' || !lab.version) throw new Error('Invalid lab client');
  return lab.version;
}
