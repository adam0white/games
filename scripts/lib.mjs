const sha = /^[0-9a-f]{40}$/;
export function validateRegistry(registry) {
  if (!registry || !/^\d+\.\d+\.\d+$/.test(registry.hfVersion) || !Array.isArray(registry.games)) throw new Error('Invalid registry');
  const seen = new Set();
  const origins = new Set();
  for (const game of registry.games) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(game.slug) || seen.has(game.slug)) throw new Error('Invalid or duplicate slug');
    if (!/^https:\/\/github\.com\/[^/]+\/[^/]+$/.test(game.source?.repository ?? '') || !sha.test(game.source?.commit ?? '')) throw new Error('Invalid source lineage');
    if (!game.saveSchema || typeof game.saveSchema !== 'string') throw new Error('Missing save schema');
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
export function manifest(registry, game, commit, dirty, labVersion, app) {
  validateRegistry(registry);
  if (!sha.test(commit) || dirty || !registry.games.some(g => g.slug === game.slug) || !labVersion || !app) throw new Error('Refusing unclean or invalid release');
  return { game: game.slug, commit, dirty: false, source: game.source, hfVersion: registry.hfVersion, framework: registry.hfVersion, app, frameworkLibrary: registry.hfVersion, labVersion, saveSchema: game.saveSchema };
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
