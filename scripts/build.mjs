import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { registry, run, head, clean } from './context.mjs';
import { manifest, scopedHeaders, scopedRedirects } from './lib.mjs';
import { validateGame } from './game.mjs';
if (!registry.games.length) throw new Error('Cannot build an empty game registry');
const commit = head();
if (!clean()) throw new Error('Build requires a clean checkout');
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
  writeFileSync(`${target}/release.json`, JSON.stringify(manifest(registry, game, commit, false, labVersion, JSON.parse(readFileSync(`${path}/package.json`, 'utf8')).version)) + '\n');
}
if (existsSync('dist/sw.js')) throw new Error('Root service worker forbidden');
if (headers.length) writeFileSync('dist/_headers', headers.join('\n'));
if (redirects.length) writeFileSync('dist/_redirects', redirects.join('\n'));
if (head() !== commit || !clean()) throw new Error('Source changed while building');
