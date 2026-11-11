import { neighboursSource } from './history.mjs';
const sha = /^[0-9a-f]{40}$/;
export function validateRegistry(registry) {
  if (!registry || !/^\d+\.\d+\.\d+$/.test(registry.hfVersion) || !Array.isArray(registry.games)) throw new Error('Invalid registry');
  const seen = new Set();
  const origins = new Set();
  for (const game of registry.games) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(game.slug) || seen.has(game.slug)) throw new Error('Invalid or duplicate slug');
    if (!/^https:\/\/github\.com\/[^/]+\/[^/]+$/.test(game.source?.repository ?? '') || !sha.test(game.source?.commit ?? '')) throw new Error('Invalid source lineage');
    const history = game.source.history;
    if (game.slug === 'neighbours' && history === undefined) throw new Error('Missing retained source history');
    if (history !== undefined && (!history || game.slug !== 'neighbours' || game.source.repository !== neighboursSource.repository || game.source.commit !== neighboursSource.commit || Object.keys(history).sort().join(',') !== 'importCommit,mode,tree' || history.mode !== 'original-repository' || history.importCommit !== neighboursSource.importCommit || history.tree !== neighboursSource.tree)) throw new Error('Invalid retained source history');
    if (!game.saveSchema || typeof game.saveSchema !== 'string') throw new Error('Missing save schema');
    if (game.kind !== undefined && !['game', 'recorded-viewer'].includes(game.kind)) throw new Error('Invalid game kind');
    if (game.redirectMode !== undefined && !['worker', 'zone'].includes(game.redirectMode)) throw new Error('Invalid redirect mode');
    if (game.redirectEnabled !== undefined && typeof game.redirectEnabled !== 'boolean') throw new Error('Invalid redirect flag');
    if (game.verifiedRelease !== undefined && (typeof game.verifiedRelease !== 'string' || !sha.test(game.verifiedRelease))) throw new Error('Invalid verified release commit');
    if (game.redirectEnabled === true && (!game.legacyOrigin || !sha.test(game.verifiedRelease ?? ''))) throw new Error('Redirect activation requires an origin and verified release commit');
    if (game.legacyOrigin !== undefined) {
      let origin;
      try { origin = new URL(game.legacyOrigin); } catch { throw new Error('Invalid legacy origin'); }
      if (!/^https:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.adamwhite\.work$/.test(game.legacyOrigin) || origin.origin !== game.legacyOrigin || ['https://play.adamwhite.work', 'https://human.adamwhite.work'].includes(origin.origin) || origins.has(origin.origin)) throw new Error('Invalid or duplicate legacy origin');
      origins.add(origin.origin);
    }
    if (game.ciBrowsers !== undefined && (!Array.isArray(game.ciBrowsers) || game.ciBrowsers.some(b => !['chromium', 'chromium-headless-shell', 'webkit', 'firefox'].includes(b)))) throw new Error('Invalid CI browser');
    seen.add(game.slug);
  }
  return registry;
}
export function affectedGames(registry, paths) {
  validateRegistry(registry);
  if (paths.some(path => !path.startsWith('games/') || !registry.games.some(g => path.startsWith(`games/${g.slug}/`)))) return registry.games.map(g => g.slug);
  return registry.games.filter(g => paths.some(p => p.startsWith(`games/${g.slug}/`))).map(g => g.slug);
}
export function checkResults(results, count, total = count) {
  for (const job of ['tools', 'changes']) if (results[job] !== 'success') throw new Error(`${job} ${results[job]}`);
  if (results.games !== (count === 0 ? 'skipped' : 'success')) throw new Error(`games ${results.games}`);
  if (results.build !== (total === 0 ? 'skipped' : 'success')) throw new Error(`build ${results.build}`);
}
export function assertFrameworkGraph(packages, version) {
  const matches = packages.filter(p => /^@adam0white\/human-framework(?:$|-)/.test(p.name));
  if (!matches.some(p => p.name === '@adam0white/human-framework' && p.version === version) || matches.some(p => p.name !== '@adam0white/human-framework' || p.version !== version)) throw new Error('Installed HF graph has an incompatible version or alias');
}
export function packageReleaseMetadata(pkg, read) {
  if (pkg.releaseMetadata === undefined) return undefined;
  if (pkg.releaseMetadata !== 'release-metadata.json') throw new Error('Invalid release metadata path');
  const metadata = read(pkg.releaseMetadata);
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata) || typeof metadata.app !== 'string' || !metadata.app) throw new Error('Invalid release metadata');
  const keys = Object.keys(metadata).sort().join(',');
  const python = keys === 'app,concordiaUpstream,pyodide,pythonBundle,runtime' &&
    sha.test(metadata.concordiaUpstream ?? '') && /^[0-9a-f]{64}$/.test(metadata.pythonBundle ?? '') &&
    /^\d+\.\d+\.\d+$/.test(metadata.pyodide ?? '') && typeof metadata.runtime === 'string' && !!metadata.runtime;
  const godot = keys === 'app,engine,godot' && /^\d+\.\d+\.\d+$/.test(metadata.engine ?? '') && /^\d+\.\d+\.\d+$/.test(metadata.godot ?? '');
  if (!python && !godot) throw new Error('Invalid release metadata');
  return metadata;
}
export function manifest(registry, game, commit, dirty, labVersion, app, metadata) {
  validateRegistry(registry);
  const validLab = game.kind === 'recorded-viewer' ? labVersion === null : typeof labVersion === 'string' && /^\d+\.\d+\.\d+$/.test(labVersion);
  if (!sha.test(commit) || dirty || !registry.games.some(g => g.slug === game.slug) || !validLab || !app) throw new Error('Refusing unclean or invalid release');
  const release = { game: game.slug, commit, dirty: false, source: game.source, hfVersion: registry.hfVersion, framework: registry.hfVersion, app, frameworkLibrary: registry.hfVersion, labVersion, saveSchema: game.saveSchema };
  if (metadata !== undefined) {
    const checked = packageReleaseMetadata({ releaseMetadata: 'release-metadata.json' }, () => metadata);
    if (checked.engine !== undefined && checked.engine !== registry.hfVersion) throw new Error('Release metadata engine differs from registry HF');
    return { ...release, ...checked, ...(checked.concordiaUpstream !== undefined ? { hf: registry.hfVersion } : {}) };
  }
  return release;
}
function scope(slug, path) {
  if (!/^\/(?!\/)[^\s?#]*$/.test(path) || /(?:\.\.|%|\\)/.test(path)) throw new Error('Unsafe rule path');
  return `/${slug}${path}`;
}
export function scopedHeaders(slug, text) {
  return text.split('\n').map(line => {
    if (!line.trim() || line.trimStart().startsWith('#')) return line;
    if (/^\s/.test(line)) { if (!/^\s+!\s+[A-Za-z0-9-]+\s*$/.test(line) && !/^\s+[^\s:]+\s*:\s*[^\r\n]*$/.test(line)) throw new Error('Invalid header'); return line; }
    return scope(slug, line.trim());
  }).join('\n');
}
export function scopedRedirects(slug, text) {
  return text.split('\n').map(line => {
    if (!line.trim() || line.trimStart().startsWith('#')) return line;
    const parts = line.trim().split(/\s+/);
    if (parts.length < 2 || parts.length > 3 || (parts[2] && !/^(301|302|303|307|308|200)$/.test(parts[2]))) throw new Error('Invalid redirect');
    return [scope(slug, parts[0]), scope(slug, parts[1]), ...parts.slice(2)].join(' ');
  }).join('\n');
}
export function checkRelease(expected, actual, redirected) {
  if (redirected || JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error('Release mismatch or redirect');
}
export function checkMainCI(commit, remote, runs, jobs) {
  if (commit !== remote || !runs.some(r => r.head_sha === commit && r.head_branch === 'main' && r.event === 'push' && r.status === 'completed' && r.conclusion === 'success') || !jobs.some(j => j.name === 'ci' && j.status === 'completed' && j.conclusion === 'success')) throw new Error('Latest main CI is not green');
}

// Direct manifest declarations only. A source/build audit still establishes that
// a recorded viewer contains no bundled or transitive recording implementation.
export function assertNoLabDependencies(pkg) {
  for (const section of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    for (const [name, value] of Object.entries(pkg[section] ?? {})) {
      if (/^@adam0white\/lab-(?:client|kit)$/.test(name)
        || /^npm:@adam0white\/lab-(?:client|kit)(?:@|$)/.test(String(value))
        || /(?:lab-(?:client|kit)-v|adam0white-lab-(?:client|kit)-).*\.tgz(?:$|[?#])/.test(String(value))) throw new Error('Recorded viewer must not declare an unused Lab client');
    }
  }
}
