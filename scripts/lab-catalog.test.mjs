// The lab page (/lab/) and the experiments page (/experiments/) show the lists in experiments/experiments/catalog.js.
// This test fails when a served folder is on no list (Exile was left off the lab page until 2026-11-28), when a
// listed address has no folder, or when a game is listed twice.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { MAIN, EXPERIMENTS, TRIALS, SMALL_HOME, EXPERIMENTS_HOME } from '../experiments/experiments/catalog.js';
import { reservedPaths } from '../worker-settings.mjs';

const root = new URL('../experiments/', import.meta.url);
const folders = path => readdirSync(new URL(path, root), { withFileTypes: true }).filter(e => e.isDirectory() && existsSync(new URL(`${path}${e.name}/index.html`, root))).map(e => e.name);
const listed = [...MAIN, ...EXPERIMENTS, ...TRIALS].map(([href]) => href);
// Folders that are pages of the lab itself, not games: shared code, the lab page, and the two homes.
const OWN = ['kit', 'lab', SMALL_HOME.replaceAll('/', ''), EXPERIMENTS_HOME.replaceAll('/', '')];

test('every experiment folder is on the lab page or the experiments page', () => {
  const missing = [
    ...folders('').filter(name => !OWN.includes(name)).map(name => `/${name}/`),
    ...folders('lab/').map(name => `/lab/${name}/`),
  ].filter(href => !listed.includes(href));
  assert.deepEqual(missing, [], `add to experiments/experiments/catalog.js: ${missing.join(', ')}`);
});

test('every listed address is a folder here or a Worker route, and is listed once', () => {
  assert.equal(new Set(listed).size, listed.length, 'an address is listed twice');
  for (const [href, title, line] of [...MAIN, ...EXPERIMENTS, ...TRIALS]) {
    assert.match(href, /^\/(lab\/)?[a-z0-9-]+\/$/, href);
    assert.ok(title && line, `${href} has a title and a line`);
    const slug = href.slice(1, -1);
    assert.ok(existsSync(new URL(`${slug}/index.html`, root)) || reservedPaths.includes(slug), `${href} has no folder in experiments/ and is not a Worker route`);
  }
  for (const [href] of MAIN) assert.equal(href.startsWith('/lab/'), false, `${href}: a main game is not a lab trial`);
  for (const [href] of TRIALS) assert.ok(href.startsWith('/lab/'), `${href}: a trial lives under /lab/`);
  for (const trial of TRIALS) assert.ok(MAIN.some(([, title]) => title === trial[3]), `${trial[0]}: its parent "${trial[3]}" is a main game`);
});
