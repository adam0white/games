import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

test('root check runs tests and every registry game in order and propagates failures', t => {
  const dir = mkdtempSync(join(tmpdir(), 'games-check-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, 'scripts'));
  const script = resolve('scripts/check-all.mjs');
  assert.equal(requireExists(script), true, 'root check orchestrator exists');
  copyFileSync(script, join(dir, 'scripts/check-all.mjs'));
  writeFileSync(join(dir, 'games.json'), JSON.stringify({ games: [{slug:'one'}, {slug:'two'}, {slug:'three'}] }));
  writeFileSync(join(dir, 'scripts/check-game.mjs'), `import {appendFileSync} from 'node:fs'; appendFileSync('calls', process.argv[2]+'\\n'); if (process.env.FAIL_GAME === process.argv[2]) process.exit(7);`);
  writeFileSync(join(dir, 'scripts/example.test.mjs'), `import test from 'node:test'; import {appendFileSync} from 'node:fs'; test('fixture', () => { appendFileSync('calls', 'root tests\\n'); if (process.env.FAIL_ROOT) throw Error('root failed'); });`);
  const run = env => { const childEnv = {...process.env, ...env}; delete childEnv.NODE_TEST_CONTEXT; return spawnSync(process.execPath, ['scripts/check-all.mjs'], {cwd:dir, env:childEnv, encoding:'utf8'}); };
  assert.equal(run({}).status, 0);
  assert.equal(readFileSync(join(dir,'calls'),'utf8'), 'root tests\none\ntwo\nthree\n');
  writeFileSync(join(dir,'calls'), '');
  assert.notEqual(run({FAIL_GAME:'two'}).status, 0);
  assert.equal(readFileSync(join(dir,'calls'),'utf8'), 'root tests\none\ntwo\n');
  writeFileSync(join(dir,'calls'), '');
  assert.notEqual(run({FAIL_ROOT:'1'}).status, 0);
  assert.equal(readFileSync(join(dir,'calls'),'utf8'), 'root tests\n');
});
function requireExists(path) { try { readFileSync(path); return true; } catch { return false; } }
