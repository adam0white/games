/** Historical adapters and recordings retain their meaning while the default moves to HF4. */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const paths = (
  execFileSync('git', ['diff', '--name-only', 'origin/main'], { encoding: 'utf8' }) +
  '\n' +
  execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { encoding: 'utf8' })
)
  .trim()
  .split('\n')
  .filter(Boolean);
for (const path of paths) {
  if (/^src\/minds\/(hf|hf2|random|scripted|llm|llm-backends)\.ts$/.test(path)) {
    const prior = execFileSync('git', ['show', `origin/main:${path}`], { encoding: 'utf8' });
    const current = readFileSync(path, 'utf8').replaceAll(
      "from 'hfLegacy'",
      "from '@adam0white/human-framework'",
    );
    if (current !== prior) throw new Error(`Historical adapter changed beyond its package alias: ${path}`);
  }
  if (/^(test\/fixtures\/|viewer\/runs\/)/.test(path) && path !== 'viewer/runs/index.json') {
    const tracked = execFileSync('git', ['ls-tree', '--name-only', 'origin/main', '--', path], {
      encoding: 'utf8',
    }).trim();
    if (tracked) throw new Error(`Historical evidence changed: ${path}`);
  }
}
console.log('HF4 upkeep lane: historical adapter semantics and recorded evidence preserved.');
