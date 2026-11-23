/** Stamp the static viewer with the reviewed Island source, independently of its host. */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import framework from '@adam0white/human-framework/package.json' with { type: 'json' };

const root = fileURLToPath(new URL('..', import.meta.url));
const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
writeFileSync(
  resolve(root, 'viewer/release.json'),
  `${JSON.stringify({
    app: 'island-viewer',
    framework: framework.version,
    commit: git('rev-parse', 'HEAD'),
    dirty: git('status', '--porcelain').length > 0,
  })}\n`,
);
