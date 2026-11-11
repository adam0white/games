/** Historical Island source and recordings remain byte-identical to the imported public commit. */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const source = '736c4b4a74adbac62633bd69ffd0e093e63df69e';
const original = (path: string) => execFileSync('git', ['show', `${source}:${path}`]);
const repository = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const entries = execFileSync(
  'git',
  ['ls-tree', '-r', '--name-only', source, '--', 'viewer/runs', 'test/fixtures'],
  { cwd: repository, encoding: 'utf8' },
)
  .trim()
  .split('\n')
  .filter(Boolean);
if (entries.length === 0) throw new Error('No historical evidence found');
for (const path of entries) {
  if (!original(path).equals(readFileSync(path))) throw new Error(`Historical evidence changed: ${path}`);
}
for (const path of [
  'src/minds/hf.ts',
  'src/minds/hf2.ts',
  'test/hf.test.ts',
  'test/hf2.test.ts',
  'test/hf3.test.ts',
  'test/run.test.ts',
]) {
  if (!original(path).equals(readFileSync(`archive/historical/${path}.txt`)))
    throw new Error(`Historical source changed: ${path}`);
}
console.log(
  `Historical custody passed: ${entries.length} recorded files and six archived source/test files.`,
);
