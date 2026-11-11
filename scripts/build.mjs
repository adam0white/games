import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { registry, run, head, clean } from './context.mjs';
import { manifest, packageReleaseMetadata, scopedHeaders, scopedRedirects } from './lib.mjs';
import { validateGame } from './game.mjs';
if (!registry.games.length) throw new Error('Cannot build an empty game registry');
const commit = head();
if (!clean()) throw new Error('Build requires a clean checkout');
run('node', ['scripts/check-redirects.mjs'], { stdio: 'inherit' });
rmSync('dist', { recursive: true, force: true });
const headers = [], redirects = [];
function rejectRootWorker(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = `${dir}/${entry.name}`;
    if (entry.isDirectory()) rejectRootWorker(file);
    else if (/\.(?:js|html)$/.test(file) && /["'`]\/sw\.js(?:["'`?])/.test(readFileSync(file, 'utf8'))) throw new Error(`${file}: root service worker reference`);
  }
}
for (const game of registry.games) {
  run('git', ['merge-base', '--is-ancestor', game.source.commit, 'HEAD']);
  const path = `games/${game.slug}`;
  const labVersion = validateGame(game, registry);
  rmSync(`${path}/dist`, { recursive: true, force: true });
  run('pnpm', ['--filter', `./${path}`, 'run', 'build'], { stdio: 'inherit' });
  rejectRootWorker(`${path}/dist`);
  const target = `dist/${game.slug}`;
  mkdirSync(target, { recursive: true });
  cpSync(`${path}/dist`, target, { recursive: true });
  for (const [file, list, scope] of [['_headers', headers, scopedHeaders], ['_redirects', redirects, scopedRedirects]]) {
    const source = `${target}/${file}`;
    if (existsSync(source)) { list.push(scope(game.slug, readFileSync(source, 'utf8'))); rmSync(source); }
  }
  const pkg = JSON.parse(readFileSync(`${path}/package.json`, 'utf8'));
  const metadata = packageReleaseMetadata(pkg, file => JSON.parse(readFileSync(`${path}/${file}`, 'utf8')));
  if (metadata) {
    const built = JSON.parse(readFileSync(`${target}/release.json`, 'utf8'));
    for (const [key, value] of Object.entries(metadata)) if (built[key] !== value) throw new Error(`${game.slug}: built release metadata mismatch: ${key}`);
    if (built.commit !== commit || built.dirty !== false || built.framework !== registry.hfVersion || (metadata.concordiaUpstream !== undefined && built.hf !== registry.hfVersion) || (metadata.engine !== undefined && built.engine !== registry.hfVersion)) throw new Error(`${game.slug}: built release identity mismatch`);
  }
  writeFileSync(`${target}/release.json`, JSON.stringify(manifest(registry, game, commit, false, labVersion, pkg.version, metadata)) + '\n');
}
if (existsSync('dist/sw.js')) throw new Error('Root service worker forbidden');
if (headers.length) writeFileSync('dist/_headers', headers.join('\n'));
if (redirects.length) writeFileSync('dist/_redirects', redirects.join('\n'));
if (head() !== commit || !clean()) throw new Error('Source changed while building');
