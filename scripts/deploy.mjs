import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { verifyLiveRelease } from './verify-live-release.mjs';

const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit' });
const dryRun = process.argv.includes('--dry-run');
if (!dryRun && execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()) {
  throw Error('Commit the verified build before public deployment');
}
run('npm', ['run', 'check']);
run('npx', ['--no-install', 'wrangler', 'deploy', '--dry-run']);
if (!dryRun) {
  run('npx', ['--no-install', 'wrangler', 'deploy']);
  const local = JSON.parse(readFileSync('dist/release.json', 'utf8'));
  const live = await verifyLiveRelease(local);
  console.log(`Verified https://repair.adamwhite.work at ${live.commit}`);
}
