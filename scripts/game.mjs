import { readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { assertFrameworkGraph, assertNoLabDependencies } from './lib.mjs';

const HF = '@adam0white/human-framework';
const CLIENT = '@adam0white/lab-client';
const KIT = '@adam0white/lab-kit';

function releaseVersion(spec, name) {
  const match = /^https:\/\/github\.com\/adam0white\/human-framework\/releases\/download\/(lab-client|lab-kit)-v(\d+\.\d+\.\d+)\/adam0white-(lab-client|lab-kit)-(\d+\.\d+\.\d+)\.tgz$/.exec(spec ?? '');
  if (!match || match[1] !== name || match[3] !== name || match[2] !== match[4]) throw new Error(`Invalid ${name} release URL`);
  return match[2];
}

function readPackage(path) {
  const resolved = realpathSync(path);
  return { path: resolved, pkg: JSON.parse(readFileSync(resolved, 'utf8')) };
}

function resolvePackage(from, name) {
  return readPackage(createRequire(from).resolve(`${name}/package.json`));
}

function rejectAliases(deps) {
  for (const [name, value] of Object.entries(deps ?? {})) {
    if (name === '@adam0white/hf-legacy' || (name !== HF && (name.startsWith(`${HF}-`) || String(value).includes(`npm:${HF}@`)))) throw new Error('HF alias forbidden');
  }
}

function checkRuntimeGraph(entry, hfVersion, seen = new Set()) {
  if (seen.has(entry.path)) return;
  seen.add(entry.path);
  const deps = { ...entry.pkg.dependencies, ...entry.pkg.optionalDependencies };
  rejectAliases(deps);
  for (const [name, value] of Object.entries(deps)) {
    if (name === HF && value !== hfVersion) throw new Error('Incorrect transitive HF pin');
    let child;
    try { child = resolvePackage(entry.path, name); } catch (error) {
      if (Object.hasOwn(entry.pkg.optionalDependencies ?? {}, name) && error.code === 'MODULE_NOT_FOUND') continue;
      throw error;
    }
    if (name === HF) assertFrameworkGraph([child.pkg], hfVersion);
    checkRuntimeGraph(child, hfVersion, seen);
  }
}

export function validateGame(game, registry) {
  const path = `games/${game.slug}`;
  const pkg = JSON.parse(readFileSync(`${path}/package.json`, 'utf8'));
  if (pkg.dependencies?.[HF] !== registry.hfVersion) throw new Error(`${game.slug}: incorrect HF pin`);
  for (const section of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) rejectAliases(pkg[section]);
  const engine = readPackage(`${path}/node_modules/${HF}/package.json`);
  assertFrameworkGraph([engine.pkg], registry.hfVersion);
  if (game.kind === 'recorded-viewer') {
    assertNoLabDependencies(pkg);
    return null;
  }
  const clientVersion = releaseVersion(pkg.dependencies?.[CLIENT], 'lab-client');
  const kitVersion = releaseVersion(pkg.dependencies?.[KIT], 'lab-kit');
  const client = readPackage(`${path}/node_modules/${CLIENT}/package.json`);
  const kit = readPackage(`${path}/node_modules/${KIT}/package.json`);
  if (client.pkg.name !== CLIENT || client.pkg.version !== clientVersion) throw new Error('Invalid installed lab client');
  if (kit.pkg.name !== KIT || kit.pkg.version !== kitVersion) throw new Error('Invalid installed lab kit');
  if (client.pkg.dependencies?.[HF] !== registry.hfVersion) throw new Error('Incorrect client HF pin');
  const peer = kit.pkg.peerDependencies?.[CLIENT];
  if (typeof peer !== 'string' || !peer.split('||').some(version => version.trim() === clientVersion)) throw new Error('Unsupported kit client peer');
  const kitClient = resolvePackage(kit.path, CLIENT);
  if (kitClient.pkg.name !== CLIENT || kitClient.pkg.version !== clientVersion) throw new Error('Incorrect kit client resolution');
  checkRuntimeGraph(client, registry.hfVersion);
  checkRuntimeGraph(kit, registry.hfVersion);
  return clientVersion;
}
