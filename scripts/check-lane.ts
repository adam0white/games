/** This task owns a new HF4 arm. Historical adapters and fixture bytes stay immutable. */
import { execFileSync } from 'node:child_process';

const paths = (
  execFileSync('git', ['diff', '--name-only', 'origin/main'], { encoding: 'utf8' }) +
  '\n' +
  execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { encoding: 'utf8' })
)
  .trim()
  .split('\n');
const protectedPath =
  /^(src\/minds\/(hf|hf2|random|scripted|llm|llm-backends)\.ts|test\/fixtures\/|viewer\/runs\/|pnpm-workspace\.yaml)/;
const violations = paths.filter((path) => protectedPath.test(path));
if (violations.length) throw new Error(`Outside HF4 lane: ${violations.join(', ')}`);
console.log('HF4 lane: historical adapters, recordings and dependency policy unchanged.');
