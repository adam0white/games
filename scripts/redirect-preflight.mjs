import { execFileSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { validateRegistry, manifest, assertNoLabDependencies, packageReleaseMetadata } from './lib.mjs';

const PLAY = 'https://play.adamwhite.work';
const SHA = /^[0-9a-f]{40}$/;

/** Read committed evidence only. No fetch, checkout, route or account mutation. */
export function repositoryEvidence(cwd = process.cwd()) {
  const git = (...args) => execFileSync('git', args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
  const read = (commit, path) => JSON.parse(git('show', `${commit}:${path}`).toString('utf8'));
  return {
    registry: commit => validateRegistry(read(commit, 'games.json')),
    ancestor(commit, head) {
      if (!SHA.test(commit)) return false;
      try { git('cat-file', '-e', `${commit}^{commit}`); git('merge-base', '--is-ancestor', commit, head); return true; } catch { return false; }
    },
    unchanged(commit, head, slug) {
      try { git('diff', '--quiet', commit, head, '--', `games/${slug}`); return true; } catch { return false; }
    },
    release(commit, registry, game) {
      const path = `games/${game.slug}`;
      const pkg = read(commit, `${path}/package.json`);
      if (pkg.dependencies?.['@adam0white/human-framework'] !== registry.hfVersion) throw new Error('Historical game HF pin mismatch');
      const metadata = packageReleaseMetadata(pkg, file => read(commit, `${path}/${file}`));
      if (game.kind === 'recorded-viewer') {
        assertNoLabDependencies(pkg);
        return manifest(registry, game, commit, false, null, pkg.version, metadata);
      }
      const archive = pkg.dependencies?.['@adam0white/lab-client'];
      // Public artifact bytes are qualified during adoption and the clean build.
      // Here read only the committed immutable URL, without a network dependency.
      const publicPin = /^https:\/\/github\.com\/adam0white\/human-framework\/releases\/download\/lab-client-v(\d+\.\d+\.\d+)\/adam0white-lab-client-\1\.tgz$/.exec(archive ?? '');
      let lab;
      if (publicPin) lab = { name: '@adam0white/lab-client', version: publicPin[1] };
      else {
        if (!/^file:vendor\/[A-Za-z0-9_.-]+\.tgz$/.test(archive ?? '')) throw new Error('Historical lab artifact must be an exact public URL or pinned vendor archive');
        const bytes = git('show', `${commit}:${path}/${archive.slice(5)}`);
        lab = JSON.parse(execFileSync('tar', ['-xOzf', '-', 'package/package.json'], { input: bytes, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }));
      }
      if (lab.name !== '@adam0white/lab-client' || !/^\d+\.\d+\.\d+$/.test(lab.version)) throw new Error('Invalid historical lab artifact');
      return manifest(registry, game, commit, false, lab.version, pkg.version, metadata);
    },
  };
}

/** Enabled aliases require a directly observed release before every build/upload. */
export async function verifyRedirects({ registry, routes, head, expected, evidence = repositoryEvidence(), fetch: fetchRelease = globalThis.fetch }) {
  validateRegistry(registry);
  const enabled = registry.games.filter(game => game.redirectEnabled === true);
  const legacyPatterns = enabled.map(game => `${new URL(game.legacyOrigin).hostname}/${game.redirectMode === 'zone' ? 'sw.js' : '*'}`);
  const matchesRoute = route => {
    if (!route || typeof route !== 'object') return false;
    if (route.pattern === 'play.adamwhite.work') {
      return route.custom_domain === true && Object.keys(route).every(key => ['pattern', 'custom_domain'].includes(key));
    }
    return legacyPatterns.includes(route.pattern)
      && route.zone_name === 'adamwhite.work'
      && (route.custom_domain === undefined || route.custom_domain === false)
      && Object.keys(route).every(key => ['pattern', 'zone_name', 'custom_domain'].includes(key));
  };
  if (!Array.isArray(routes) || routes.length !== legacyPatterns.length + 1 || !routes.every(matchesRoute) || new Set(routes.map(route => route.pattern)).size !== routes.length) throw new Error('Worker routes must be the play custom domain and exact enabled legacy zone routes');
  for (const game of enabled) {
    if (!evidence.ancestor(game.verifiedRelease, head)) throw new Error(`${game.slug}: recorded verification commit is not a known ancestor`);
    const url = `${PLAY}/${game.slug}/release.json`;
    const response = await fetchRelease(url, { redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(15_000) });
    if (!response.ok || response.status >= 300 || response.redirected || response.url !== url) throw new Error(`${game.slug}: release fetch failed or redirected`);
    const live = await response.json();
    if (!live || !SHA.test(live.commit ?? '') || live.dirty !== false || !evidence.ancestor(live.commit, head)) throw new Error(`${game.slug}: live release commit is not a clean known ancestor`);
    const liveRegistry = evidence.registry(live.commit);
    const liveGame = liveRegistry.games.find(candidate => candidate.slug === game.slug);
    if (!liveGame || !isDeepStrictEqual(live, evidence.release(live.commit, liveRegistry, liveGame))) throw new Error(`${game.slug}: live release metadata does not match committed source`);
    if (!evidence.ancestor(game.verifiedRelease, live.commit)) throw new Error(`${game.slug}: live release predates recorded verification`);
    if (liveGame.redirectEnabled === true && liveGame.legacyOrigin === game.legacyOrigin) {
      if (liveGame.verifiedRelease !== game.verifiedRelease) throw new Error(`${game.slug}: active alias must retain recorded verification`);
    } else {
      if (game.verifiedRelease !== live.commit) throw new Error(`${game.slug}: initial verification must name the live release`);
      if (!evidence.unchanged(live.commit, head, game.slug)) throw new Error(`${game.slug}: game files changed before initial activation`);
      if (!isDeepStrictEqual(live, { ...expected(game), commit: live.commit })) throw new Error(`${game.slug}: initial activation requires the full current release metadata`);
    }
  }
}
