import { execFileSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { validateRegistry, manifest } from './lib.mjs';

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
      const archive = pkg.dependencies?.['@adam0white/lab-client'];
      if (!/^file:vendor\/[A-Za-z0-9_.-]+\.tgz$/.test(archive ?? '')) throw new Error('Historical lab artifact must be a pinned vendor archive');
      const bytes = git('show', `${commit}:${path}/${archive.slice(5)}`);
      const lab = JSON.parse(execFileSync('tar', ['-xOzf', '-', 'package/package.json'], { input: bytes, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }));
      if (lab.name !== '@adam0white/lab-client' || !/^\d+\.\d+\.\d+$/.test(lab.version)) throw new Error('Invalid historical lab artifact');
      return manifest(registry, game, commit, false, lab.version, pkg.version);
    },
  };
}

/** Enabled aliases require a directly observed release before every build/upload. */
export async function verifyRedirects({ registry, routes, head, expected, evidence = repositoryEvidence(), fetch: fetchRelease = globalThis.fetch }) {
  validateRegistry(registry);
  const enabled = registry.games.filter(game => game.redirectEnabled === true);
  const hosts = ['play.adamwhite.work', ...enabled.map(game => new URL(game.legacyOrigin).hostname)];
  if (!Array.isArray(routes) || routes.length !== hosts.length || new Set(routes.map(route => route.pattern)).size !== hosts.length || routes.some(route => route.custom_domain !== true || !hosts.includes(route.pattern))) throw new Error('Worker routes must exactly match play and enabled legacy origins');
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
