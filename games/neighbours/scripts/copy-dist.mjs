import { cpSync, readFileSync, rmSync } from 'node:fs';
const outer = JSON.parse(readFileSync('package.json', 'utf8'));
const runtime = JSON.parse(readFileSync('neighbours/package.json', 'utf8'));
for (const dependency of ['@adam0white/human-framework', '@adam0white/lab-client', '@adam0white/lab-kit']) {
  const expected = outer.dependencies?.[dependency];
  if (typeof expected !== 'string' || runtime.dependencies?.[dependency] !== expected)
    throw new Error(`Neighbours nested runtime pin mismatch: ${dependency}`);
}
rmSync('dist', { recursive: true, force: true });
cpSync('neighbours/dist', 'dist', { recursive: true });
