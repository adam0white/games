// Plain data shared by cloudflare.config.ts and the repository checks. It imports nothing, so the checks
// run before dependencies are installed.
export const name = 'games-static';
export const compatibilityDate = '2026-11-05';
export const domains = ['play.adamwhite.work'];
export const zone = 'adamwhite.work';
export const assets = { notFoundHandling: 'none', runWorkerFirst: true };
// Legacy per-game origins that still route to this Worker. scripts/check-redirects.mjs verifies this list
// against games.json before every build and deploy.
export const legacyRoutes = [
  'rope.adamwhite.work/*',
  'hearsay.adamwhite.work/*',
  'goodhands.adamwhite.work/*',
  'glance.adamwhite.work/*',
  'repair.adamwhite.work/sw.js',
  'valley.adamwhite.work/*',
  'murmur.adamwhite.work/*',
  'stairwell.adamwhite.work/*',
  'pass.adamwhite.work/*',
  'warren.adamwhite.work/*',
  'commonstead.adamwhite.work/*',
  'child.adamwhite.work/*',
  'neighbours.adamwhite.work/*',
  'lefthand.adamwhite.work/*',
  'days.adamwhite.work/*',
  'word.adamwhite.work/*',
  'smoke.adamwhite.work/*',
  'island.adamwhite.work/*',
];
