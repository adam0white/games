import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { planExperiments } from './experiments.mjs';
import { validateRegistry } from './lib.mjs';
import { reservedPaths } from '../worker-settings.mjs';

const registry = { games: [{ slug: 'rope' }, { slug: 'word' }] };
function checkout(t, pages) {
  const dir = mkdtempSync(join(tmpdir(), 'experiments-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const page of pages) { mkdirSync(join(dir, page, '..'), { recursive: true }); writeFileSync(join(dir, page), ''); }
  return dir;
}

test('experiments in both prototypes/ and experiments/ are all built at the top level', t => {
  const dir = checkout(t, ['prototypes/lantern/index.html', 'prototypes/lab/index.html', 'prototypes/lab/ant-nest/index.html', 'experiments/kit/index.html', 'prototypes/NOTES.md']);
  assert.deepEqual(planExperiments(dir, registry), [{ slug: 'lab', from: 'prototypes/lab' }, { slug: 'lantern', from: 'prototypes/lantern' }, { slug: 'kit', from: 'experiments/kit' }]);
  assert.deepEqual(planExperiments(checkout(t, ['experiments/lantern/index.html']), registry), [{ slug: 'lantern', from: 'experiments/lantern' }], 'experiments/ alone');
  assert.deepEqual(planExperiments(checkout(t, []), registry), [], 'neither');
});

test('a slug may not collide with the other root, a game, a reserved path or an archived name', t => {
  const fails = (pages, pattern) => assert.throws(() => planExperiments(checkout(t, pages), registry), pattern);
  fails(['prototypes/lantern/index.html', 'experiments/lantern/index.html'], /lantern is in both prototypes\/ and experiments\//);
  fails(['experiments/rope/index.html'], /collides with the game at \/rope\//);
  for (const slug of reservedPaths) fails([`experiments/${slug}/index.html`], /reserved path/);
  fails(['archive/games/hearsay/package.json', 'experiments/hearsay/index.html'], /archived name hearsay/);
  fails(['archive/prototypes/long-road/index.html', 'prototypes/long-road/index.html'], /archived name long-road/);
  fails(['experiments/Lantern/index.html'], /Invalid experiment/);
  fails(['experiments/lantern/game.js'], /Invalid experiment: experiments\/lantern/);
});

test('the real checkout plans without a collision, and a game slug may not take a reserved path', () => {
  const real = JSON.parse(readFileSync(new URL('../games.json', import.meta.url), 'utf8'));
  assert.ok(planExperiments(new URL('..', import.meta.url).pathname, real).some(e => e.slug === 'kit'));
  const game = real.games[0];
  for (const slug of reservedPaths) assert.throws(() => validateRegistry({ ...real, games: [{ ...game, slug }] }), /Invalid or duplicate slug/);
});

test('every other Worker route on play.adamwhite.work is a reserved path', () => {
  const workers = new URL('../workers/', import.meta.url);
  const segments = readdirSync(workers, { withFileTypes: true }).filter(e => e.isDirectory()).flatMap(e => {
    let text; try { text = readFileSync(new URL(`${e.name}/wrangler.jsonc`, workers), 'utf8'); } catch { return []; }
    return [...text.matchAll(/"pattern"\s*:\s*"play\.adamwhite\.work\/([^/"*]+)/g)].map(m => m[1]);
  });
  assert.ok(segments.includes('notes') && segments.includes('lab-api'), 'routes found');
  for (const segment of segments) assert.ok(reservedPaths.includes(segment), `/${segment} is routed to another Worker but not reserved`);
});
