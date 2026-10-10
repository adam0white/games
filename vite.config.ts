import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Share a frozen engine only while it is the exact same published artifact.
// A future current-package upgrade must leave historical replay code separate.
function identicalPublishedEngine(): boolean {
  const current = '@adam0white/human-framework';
  const frozen = '@repair/hf-engine5';
  try {
    const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
    const a = lock.packages[`node_modules/${current}`];
    const b = lock.packages[`node_modules/${frozen}`];
    if (
      !a ||
      !b ||
      !/^\d+\.\d+\.\d+$/.test(a.version) ||
      a.version !== b.version ||
      !/^sha512-[A-Za-z0-9+/]+=*$/.test(a.integrity ?? '') ||
      a.integrity !== b.integrity ||
      a.resolved !== b.resolved ||
      a.resolved !== `https://registry.npmjs.org/${current}/-/human-framework-${a.version}.tgz` ||
      lock.packages[''].dependencies[current] !== a.version ||
      lock.packages[''].dependencies[frozen] !== `npm:${current}@${a.version}`
    ) {
      return false;
    }
    for (const name of [current, frozen]) {
      const manifest = JSON.parse(readFileSync(`node_modules/${name}/package.json`, 'utf8'));
      if (manifest.name !== current || manifest.version !== a.version) return false;
    }
    // Also reject locally modified installed packages, even with an unchanged lock.
    const digest = (directory: string): string => {
      const hash = createHash('sha256');
      for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
        left.name.localeCompare(right.name),
      )) {
        hash.update(entry.name);
        const path = resolve(directory, entry.name);
        hash.update(entry.isDirectory() ? digest(path) : readFileSync(path));
      }
      return hash.digest('hex');
    };
    return digest(`node_modules/${current}`) === digest(`node_modules/${frozen}`);
  } catch {
    // Missing or unverifiable provenance preserves the frozen engine by default.
    return false;
  }
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: identicalPublishedEngine()
      ? [
          {
            find: /^@repair\/hf-engine5$/,
            replacement: resolve(
              process.cwd(),
              'node_modules/@adam0white/human-framework/dist/index.js',
            ),
          },
        ]
      : [],
  },
  server: { watch: { ignored: [resolve(process.cwd(), '.worktrees/**')] } },
  test: {
    include: ['tests/**/*.test.ts'],
    // Full public stories include four school years of actual actor work and
    // exact replay. Measured runs take 5–9 seconds; their assertions stay intact.
    testTimeout: 20_000,
  },
});
