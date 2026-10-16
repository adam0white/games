import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { verifyLiveRelease } from './verify-live-release.mjs';

const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit' });
const dryRun = process.argv.includes('--dry-run');
if (!dryRun && execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()) {
  throw Error('Commit the verified build before public deployment');
}
run('npm', ['run', 'check']);
run('node', ['scripts/build-archives.mjs']);
run('npx', ['--no-install', 'wrangler', 'deploy', '--dry-run']);
if (!dryRun) {
  run('npx', ['--no-install', 'wrangler', 'deploy']);
  const local = JSON.parse(readFileSync('dist/release.json', 'utf8'));
  const live = await verifyLiveRelease(local);
  console.log(`Verified https://repair.adamwhite.work at ${live.commit}`);
  for (const slug of ['small-works', 'repair-campaign']) {
    const base = `https://repair.adamwhite.work/experiments/${slug}/`;
    const expected = JSON.parse(readFileSync(`dist/experiments/${slug}/archive.json`, 'utf8'));
    const response = await fetch(`${base}archive.json`, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (!response.ok || JSON.stringify(await response.json()) !== JSON.stringify(expected)) {
      throw Error(`Published archive manifest mismatch: ${slug}`);
    }
    const page = await fetch(base, { signal: AbortSignal.timeout(15000) });
    if (!page.ok || !(await page.text()).includes(`/experiments/${slug}/assets/`)) {
      throw Error(`Published archive page missing: ${slug}`);
    }
    console.log(`Verified archived ${slug} at ${expected.sourceCommit}`);
  }
}
