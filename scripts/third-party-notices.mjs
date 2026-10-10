import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

// These are the runtime packages in the browser build, including frozen replay aliases.
const installedPackages = [
  'react',
  'react-dom',
  'scheduler',
  'three',
  '@adam0white/human-framework',
  '@repair/hf-engine5',
  '@repair/hf-legacy',
];
const groups = new Map();
for (const installedName of installedPackages) {
  const directory = `node_modules/${installedName}`;
  const metadata = JSON.parse(readFileSync(`${directory}/package.json`, 'utf8'));
  const license = readFileSync(`${directory}/LICENSE`, 'utf8');
  if (!metadata.name || !metadata.version || !metadata.license || !license.trim()) {
    throw Error(`Missing third-party license metadata for ${installedName}`);
  }
  const label = `${metadata.name} ${metadata.version} (${metadata.license})`;
  const group = groups.get(license) ?? new Map();
  const sources = group.get(label) ?? [];
  sources.push(`${directory}/LICENSE`);
  group.set(label, sources);
  groups.set(license, group);
}
const notices = [
  'Third-party notices',
  '',
  'Licenses for runtime packages included in this application.',
  'Package names, versions and license texts are read from the installed packages at build time.',
  '',
];
for (const [license, packages] of groups) {
  notices.push('='.repeat(72));
  for (const [label, sources] of packages) {
    notices.push(label, ...sources.map((source) => `License source: ${source}`));
  }
  notices.push('', license, '');
}
mkdirSync('public', { recursive: true });
writeFileSync('public/third-party-notices.txt', notices.join('\n'));
