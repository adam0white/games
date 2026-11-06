import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { validateRegistry } from './lib.mjs';
export const registry = validateRegistry(JSON.parse(readFileSync('games.json', 'utf8')));
export const run = (cmd, args, options = {}) => (execFileSync(cmd, args, { encoding: 'utf8', ...options }) ?? '').trim();
export const head = () => run('git', ['rev-parse', 'HEAD']);
export const clean = () => !run('git', ['status', '--porcelain', '--untracked-files=normal']);
