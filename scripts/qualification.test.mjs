import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { qualificationScripts } from './qualification.mjs';

function qualify(lane, check) {
  const dir = mkdtempSync(join(tmpdir(), 'games-qualification-'));
  try {
    mkdirSync(join(dir, 'scripts'));
    mkdirSync(join(dir, 'games/fixture'), { recursive: true });
    writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
    for (const file of ['check-game.mjs', 'qualification.mjs', 'history.mjs']) {
      if (existsSync(new URL(file, import.meta.url))) copyFileSync(new URL(file, import.meta.url), join(dir, 'scripts', file));
    }
    writeFileSync(join(dir, 'scripts/game.mjs'), 'export function validateGame() {}');
    writeFileSync(join(dir, 'scripts/context.mjs'), `
      import { execFileSync } from 'node:child_process';
      export const registry = { games: [{ slug: 'fixture', source: { commit: 'source' } }] };
      export function run(command, args) {
        if (command === 'git') return '';
        if (command !== 'pnpm' || args[0] !== '--filter' || args[2] !== 'run') throw Error('Unexpected command');
        execFileSync('npm', ['run', args[3]], { cwd: 'games/fixture', stdio: 'pipe' });
      }
    `);
    const marker = name => `node -e "require('node:fs').appendFileSync('calls', '${name}\\n')"`;
    writeFileSync(join(dir, 'games/fixture/package.json'), JSON.stringify({ scripts: {
      'check:lane': lane,
      check,
      lint: marker('lint'),
      test: marker('test'),
      'ci:check': marker('extra'),
    } }));
    execFileSync(process.execPath, ['scripts/check-game.mjs', 'fixture'], { cwd: dir, stdio: 'pipe' });
    return readFileSync(join(dir, 'games/fixture/calls'), 'utf8').trim().split('\n');
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('a lane invoking the real test script does not execute its body twice', () => {
  assert.deepEqual(qualify('npm run check', 'npm run lint && npm test'), ['lint', 'test', 'extra']);
});

test('quoted test-like text never substitutes for executing the real test body', () => {
  assert.deepEqual(qualify("printf 'ignore && npm test && ignore'"), ['test', 'extra']);
});

test('unknown compound shell commands retain the explicit test call', () => {
  assert.deepEqual(qualify("npm test && printf tail"), ['test', 'test', 'extra']);
});

test('all current games retain their suite and extra gates', () => {
  const duplicates = new Set(['glance', 'warren', 'child', 'days', 'word']);
  const registry = JSON.parse(readFileSync(new URL('../games.json', import.meta.url)));
  for (const game of registry.games) {
    const pkg = JSON.parse(readFileSync(new URL(`../games/${game.slug}/package.json`, import.meta.url)));
    assert.deepEqual(qualificationScripts(pkg), ['check:lane',
      ...(!duplicates.has(game.slug) ? ['test'] : []), ...(pkg.scripts['ci:check'] ? ['ci:check'] : [])], game.slug);
  }
});

test('script cycles and test-like aliases cannot replace an actual test invocation', () => {
  for (const lane of ['npm run loop', 'pnpm test:setup']) {
    assert.deepEqual(qualificationScripts({ scripts: { 'check:lane': lane, loop: 'npm run loop', 'test:setup': 'printf test', test: 'node test.mjs' } }), ['check:lane', 'test']);
  }
});
