/** Assemble the static recorded viewer without changing any source recording. */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import framework from '@adam0white/human-framework/package.json' with { type: 'json' };

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(resolve(root, 'viewer'), dist, {
  recursive: true,
  filter: (source) => !source.endsWith('/release.json'),
});
cpSync(resolve(root, 'public/_headers'), resolve(dist, '_headers'));
cpSync(resolve(root, 'LICENSE'), resolve(dist, 'LICENSE'));
const license = readFileSync(resolve(root, 'node_modules/@adam0white/human-framework/LICENSE'), 'utf8');
const readme = readFileSync(resolve(root, 'node_modules/@adam0white/human-framework/README.md'), 'utf8');
const fdlibm = /## fdlibm notices[\s\S]*?```text\n([\s\S]*?)```/.exec(readme)?.[1];
if (!fdlibm) throw new Error('Missing published HF fdlibm notices');
writeFileSync(
  resolve(dist, 'third-party-notices.txt'),
  `Human Framework ${framework.version} (MIT)\n${license}\n\nHuman Framework fdlibm notices\n${fdlibm}`,
);
const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
writeFileSync(
  resolve(dist, 'release.json'),
  `${JSON.stringify({ app: 'island-viewer', framework: framework.version, commit: git('rev-parse', 'HEAD'), dirty: git('status', '--porcelain').length > 0 })}\n`,
);
