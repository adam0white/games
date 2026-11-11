import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

// These are the runtime packages in the browser build, installed for this restart.
const installedPackages = [
  'react',
  'react-dom',
  'scheduler',
  '@adam0white/human-framework',
  '@fontsource/dm-sans',
  '@fontsource/ibm-plex-mono',
  '@fontsource/libre-baskerville',
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
// These immutable releases declare MIT but omit the license text from their tarballs.
const sdkLicense = readFileSync('licenses/lab-sdk-MIT.txt', 'utf8');
const sdkGroup = groups.get(sdkLicense) ?? new Map();
for (const name of ['@adam0white/lab-client', '@adam0white/lab-kit']) {
  const metadata = JSON.parse(readFileSync(`node_modules/${name}/package.json`, 'utf8'));
  if (metadata.name !== name || metadata.license !== 'MIT') throw Error(`Unexpected license for ${name}`);
  sdkGroup.set(`${name} ${metadata.version} (${metadata.license})`, ['licenses/lab-sdk-MIT.txt']);
}
groups.set(sdkLicense, sdkGroup);
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
