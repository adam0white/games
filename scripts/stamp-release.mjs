import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const packageInfo = JSON.parse(readFileSync('package.json', 'utf8'));
const human = JSON.parse(readFileSync('node_modules/@adam0white/human-framework/package.json', 'utf8'));
const engine = /const ENGINE = '([^']+)'/.exec(readFileSync('src/game/engine.ts', 'utf8'))?.[1];
if (!engine) throw Error('Missing game engine version');
mkdirSync('public', { recursive: true });
writeFileSync('public/release.json', JSON.stringify({
  commit: git('rev-parse', 'HEAD'),
  dirty: Boolean(git('status', '--porcelain')),
  game: packageInfo.version,
  framework: human.version,
  engine,
}, null, 2) + '\n');
