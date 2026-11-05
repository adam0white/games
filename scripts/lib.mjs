const sha = /^[0-9a-f]{40}$/;
export function validateRegistry(registry) {
  if (!registry || !/^\d+\.\d+\.\d+$/.test(registry.hfVersion) || !Array.isArray(registry.games)) throw new Error('Invalid registry');
  const seen = new Set();
  for (const game of registry.games) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(game.slug) || seen.has(game.slug)) throw new Error('Invalid or duplicate slug');
    if (!/^https:\/\/github\.com\/[^/]+\/[^/]+$/.test(game.source?.repository ?? '') || !sha.test(game.source?.commit ?? '')) throw new Error('Invalid source lineage');
    seen.add(game.slug);
  }
  return registry;
}
export function affectedGames(registry, paths) {
  validateRegistry(registry);
  if (paths.some(path => !path.startsWith('games/'))) return registry.games.map(g => g.slug);
  return registry.games.filter(g => paths.some(p => p.startsWith(`games/${g.slug}/`))).map(g => g.slug);
}
export function checkResults(required, results) {
  for (const name of required) if (results[name] !== 'success') throw new Error(`Required check ${name}: ${results[name] ?? 'missing'}`);
}
export function manifest(registry, game, commit, dirty) {
  validateRegistry(registry);
  if (!sha.test(commit) || dirty || !registry.games.some(g => g.slug === game.slug)) throw new Error('Refusing unclean or invalid release');
  return { game: game.slug, commit, dirty: false, source: game.source, hfVersion: registry.hfVersion };
}
