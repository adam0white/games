import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { Compiler } from 'inkjs/compiler/Compiler';

// Ink functions bound by the game must be read-only: Ink may evaluate them twice.
const source = readFileSync(new URL('../src/story.ink', import.meta.url), 'utf8');
const compiler = new Compiler(source);
const story = compiler.Compile();
if (compiler.errors.length > 0) throw new Error(compiler.errors.join('\n'));
const compiled = story.ToJson();
if (typeof compiled !== 'string') throw new Error('Ink compiler produced no story JSON.');
writeFileSync(new URL('../src/story.json', import.meta.url), compiled);

if (!process.argv.includes('--story-only')) {
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim().length > 0;
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const framework = manifest.dependencies['@adam0white/human-framework'];
  writeFileSync(
    new URL('../public/release.json', import.meta.url),
    `${JSON.stringify({ commit, dirty, framework, app: manifest.version, builtAt: new Date().toISOString() }, null, 2)}\n`,
  );
}
