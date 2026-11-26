import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scratch = resolve(process.env.EXILE_HF_BUILD ?? `${process.env.HOME}/code/.lab-scratch/exile-hf-build`);
const require = createRequire(resolve(scratch, 'package.json'));
const packageName = '@adam0white/human-framework';
const { version } = require(`${packageName}/package.json`);
const esbuild = require('esbuild');
if (version !== '4.17.0' || esbuild.version !== '0.28.2') {
  throw new Error('Install @adam0white/human-framework@4.17.0 and esbuild@0.28.2 in EXILE_HF_BUILD.');
}
const dir = fileURLToPath(new URL('.', import.meta.url));
const entry = require.resolve(packageName);
const mitNotice = await readFile(resolve(dirname(entry), '../LICENSE'), 'utf8');
const libm = await readFile(resolve(dirname(entry), 'core/libm.js'), 'utf8');
const fdlibmNotice = libm.match(/\/\*\s*\* fdlibm notices:[\s\S]*?\*\//)?.[0];
if (!fdlibmNotice) throw new Error('The published HF fdlibm notice is missing.');
await esbuild.build({
  absWorkingDir: dir,
  entryPoints: ['exile-hf.src.mjs'],
  outfile: 'exile-hf.js',
  alias: { [packageName]: entry },
  define: { HF_VERSION: JSON.stringify(version) },
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  banner: { js: `/*\n${mitNotice.trimEnd()}\n*/\n${fdlibmNotice}` },
});
