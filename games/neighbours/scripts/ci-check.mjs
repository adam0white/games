import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = process.cwd();
const app = resolve(root, 'neighbours');
const python = process.env.PYTHON || 'python3';
const run = (command, args, options = {}) => execFileSync(command, args, { stdio: 'inherit', ...options });
const env = { ...process.env, PYTHONPATH: root, PYTHON: python, NEIGHBOURS_NATIVE_TEST: '1' };
const proof = process.env.NEIGHBOURS_PROOF_DIR || mkdtempSync(join(tmpdir(), 'neighbours-ci-'));
if (process.env.NEIGHBOURS_PROOF_DIR) mkdirSync(proof, { recursive: false });
run(python, ['-c', "import sys; assert sys.version_info[:3] == (3, 12, 13), sys.version"], { cwd: root, env });
run('node', ['scripts/prepare-runtime.mjs'], { cwd: app, env });
run('node', ['scripts/check-public-day.ts', join(proof, 'public-day')], { cwd: app, env });
run(python, ['-m', 'unittest', 'concordia.environment.engine_test', 'concordia.contrib.neighbours.engine_test', 'concordia.contrib.neighbours.bridge_test', 'concordia.contrib.neighbours.gm_director_test', 'concordia.contrib.neighbours.bench_director_test'], { cwd: root, env });
run('node', ['scripts/check-parity-public.mjs'], { cwd: app, env: { ...env, NEIGHBOURS_PARITY_PROOF_DIR: join(proof, 'parity') } });
run('node', ['scripts/check-evidence.mjs'], { cwd: app, env });
console.log(`Neighbours native proof: ${proof}`);
