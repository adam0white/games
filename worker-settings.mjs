// Plain data shared by cloudflare.config.ts and the repository checks. It imports nothing, so the checks
// run before dependencies are installed.
export const name = 'games-static';
export const compatibilityDate = '2026-11-05';
export const domains = ['play.adamwhite.work'];
export const zone = 'adamwhite.work';
// Logs, traces and Issues for games-static. cloudflare.config.ts (the cf deploy) reads this; wrangler.jsonc (the
// rollback deploy) repeats it, and scripts/observability.test.mjs keeps the two equal. See workers/OBSERVABILITY.md.
export const observability = {
  enabled: true,
  redactQueryString: true,
  logs: { enabled: true, invocationLogs: true, headSamplingRate: 1 },
  traces: { enabled: true, headSamplingRate: 0.1 },
  issues: { enabled: true },
};
export const assets = { notFoundHandling: 'none', runWorkerFirst: true };
// Top-level paths on play.adamwhite.work that are not games or experiments: /proto/ redirects old experiment
// links (src/worker.mjs), /notes/ and /lab-api/ are other Workers' routes (workers/*/wrangler.jsonc), and
// /cdn-cgi/ is Cloudflare's. An experiment or game slug may not take one; scripts/experiments.mjs checks.
export const reservedPaths = ['proto', 'notes', 'lab-api', 'cdn-cgi', 'crumbwar'];
// Legacy per-game origins that still route to this Worker. scripts/check-redirects.mjs verifies this list
// against games.json before every build and deploy.
export const legacyRoutes = [
  'rope.adamwhite.work/*',
  'glance.adamwhite.work/*',
  'repair.adamwhite.work/sw.js',
  'murmur.adamwhite.work/*',
  'stairwell.adamwhite.work/*',
  'pass.adamwhite.work/*',
  'warren.adamwhite.work/*',
  'neighbours.adamwhite.work/*',
  'lefthand.adamwhite.work/*',
  'word.adamwhite.work/*',
];
// Hostnames of archived games (archive/README.md). This Worker answers each one with a 302 to the games shelf,
// so the games' original deployments no longer serve old builds there. A host leaves this list (and its route in
// wrangler.jsonc) to roll back; the original deployment then answers it again. validateRegistry keeps it apart
// from games.json legacy origins.
export const archivedHosts = [
  'hearsay.adamwhite.work',
  'goodhands.adamwhite.work',
  'valley.adamwhite.work',
  'commonstead.adamwhite.work',
  'child.adamwhite.work',
  'days.adamwhite.work',
  'island.adamwhite.work',
  'smoke.adamwhite.work',
];
export const archivedRoutes = archivedHosts.map(host => `${host}/*`);
// Lab pages that left /lab/ (experiments/lab/NOTES.md, archive/README.md): the name under /lab/ and where its
// old address goes. src/worker.mjs answers /lab/<name> and anything under it with a 302 that keeps the query, so
// an entry can be changed or removed later. A page folded into a game points at that game; an archived page
// points at the game it came from. scripts/redirects.test.mjs fails when a name here is still a folder in
// experiments/lab/. One thread edits this list; a builder asks for an entry.
export const labMoved = {
  // Rejected small pages with no parent game go to the lab index.
  'pisti': '/lab/',
  'night-lamp-keeper': '/lab/',
  'night-kite': '/lab/',
  'night-loaves': '/lab/',
  'hub-a': '/small/',
  'hub-b': '/small/',
  'hub-c': '/small/',
  'lantern-3d': '/lantern/',
  'lantern-spark': '/lantern/?mode=spark',
  'lantern-fp': '/lantern/',
  'lantern-song': '/lantern/',
  'lantern-echo': '/lantern/',
  'lantern-voice': '/lantern/',
  'lantern-rhythm': '/lantern/',
  'ant-nemesis': '/ant-promotion/',
  'ant-wilds': '/ant-promotion/',
  'ant-swarm': '/ant-promotion/',
  'ant-draft': '/ant-promotion/',
  'ant-draft-b': '/ant-promotion/',
  'ant-quests': '/ant-promotion/',
  'ant-nest': '/ant-promotion/',
  'ant-creatures': '/ant-promotion/?look=4',
  'ant-hide': '/ant-promotion/',
  'ant-evolve': '/ant-promotion/',
  'night-flock': '/flock/',
  'night-flock-2': '/flock/',
  'night-vine': '/vine/',
  'boat-b': '/boat/',
};
