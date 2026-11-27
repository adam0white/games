// Builds a copy of one experiment that runs on another site (itch.io, Newgrounds, a portal): a folder with index.html at
// its root, and a zip of it. The copy asks this site for nothing.
//
//   node scripts/portal-zip.mjs lantern                 dist/portal/lantern-itch/ and dist/portal/lantern-itch.zip
//   node scripts/portal-zip.mjs lantern --portal=strict  for a portal that allows no links out (the page then offers none)
//   node scripts/portal-zip.mjs lantern --no-zip          the folder only
//
// What it does: copies experiments/<slug>/ (code and pictures only) to the root and experiments/kit/*.js to kit/, rewrites
// the '../kit/' imports to match, drops the tester notes script, and sets window.PORTAL before the page's own script.
// The page and kit/lab.js read window.PORTAL and switch off everything that needs this site (docs/publishing.md).
// It fails when a relative import in the copy points at a file that is not there, or when an address of this site's
// services (/lab-api/, /notes/, /lab/api/) is left in index.html outside the code PORTAL switches off.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const KEEP = new Set(['.html', '.js', '.css', '.json', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.mp3', '.ogg', '.wav', '.woff2', '.glb', '.ktx2', '.txt']);
const SKIP = /(^|\/)(NOTES\.md|share\.jpg|bots\.mjs|.*\.mjs|.*\.test\.js|check)(\/|$)/;
export const PORTALS = ['itch', 'strict'];

function files(dir, base = dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const at = join(dir, e.name);
    return e.isDirectory() ? files(at, base) : [relative(base, at)];
  });
}

// The imports of a module or page: static, dynamic and <script src>. Good enough for this repo's hand-written modules.
export function imports(text) {
  const out = []; text = text.replace(/^\s*\/\/.*$/gm, ''); // a comment line may show an import as an example
  for (const m of text.matchAll(/(?:from\s*|import\s*\(\s*|import\s+)(['"])(\.{1,2}\/[^'"]+)\1/g)) out.push(m[2]);
  for (const m of text.matchAll(/<script[^>]*\ssrc=(['"])([^'"]+)\1/g)) out.push(m[2]);
  return out;
}

export function build({ slug, portal = 'itch', root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), out = join(root, 'dist', 'portal', `${slug}-${portal}`) }) {
  if (!/^[a-z0-9-]{1,40}$/.test(slug)) throw new Error(`not an experiment name: ${slug}`);
  if (!PORTALS.includes(portal)) throw new Error(`portal must be one of ${PORTALS.join(', ')}`);
  const from = join(root, 'experiments', slug), kit = join(root, 'experiments', 'kit');
  if (!existsSync(join(from, 'index.html'))) throw new Error(`no experiments/${slug}/index.html`);
  rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
  const copied = [];
  for (const f of files(from)) {
    if (SKIP.test(f) || !KEEP.has(extname(f))) continue;
    const depth = f.split('/').length - 1; // modes/race.js is one folder down: its '../../kit/' becomes '../kit/'
    let body = readFileSync(join(from, f));
    if (['.html', '.js'].includes(extname(f))) {
      let text = body.toString('utf8').replaceAll(`${'../'.repeat(depth + 1)}kit/`, depth ? `${'../'.repeat(depth)}kit/` : './kit/');
      if (f === 'index.html') {
        text = text.replace(/^<script src="\/notes\/button\.js"[^>]*><\/script>\n?/m, '');
        if (!/<script type="module">/.test(text)) throw new Error('index.html has no module script to set PORTAL before');
        text = text.replace('<script type="module">', `<script>window.PORTAL = ${JSON.stringify(portal)};</script>\n<script type="module">`);
        text = text.replace(/^<link rel="canonical"[^>]*>\n?/m, '');
      }
      body = Buffer.from(text);
    }
    mkdirSync(dirname(join(out, f)), { recursive: true }); writeFileSync(join(out, f), body); copied.push(f);
  }
  for (const f of readdirSync(kit)) if (extname(f) === '.js') { mkdirSync(join(out, 'kit'), { recursive: true }); cpSync(join(kit, f), join(out, 'kit', f)); copied.push(`kit/${f}`); }
  // Every relative import must land on a file in the copy, and none may climb out of it.
  const missing = [];
  for (const f of copied) {
    if (!['.html', '.js'].includes(extname(f))) continue;
    for (const spec of imports(readFileSync(join(out, f), 'utf8'))) {
      if (/^(https?:)?\/\//.test(spec)) { missing.push(`${f}: ${spec} (another site)`); continue; }
      if (spec.startsWith('/')) { missing.push(`${f}: ${spec} (this site's root)`); continue; }
      const to = resolve(dirname(join(out, f)), spec.split('?')[0]);
      if (relative(out, to).startsWith('..') || !existsSync(to)) missing.push(`${f}: ${spec}`);
    }
  }
  if (missing.length) throw new Error(`the copy would not load:\n  ${missing.join('\n  ')}`);
  const size = copied.reduce((n, f) => n + statSync(join(out, f)).size, 0);
  return { out, files: copied.length, size };
}

export function zip(out) {
  const file = `${out}.zip`; rmSync(file, { force: true });
  execFileSync('zip', ['-q', '-r', '-X', file, '.'], { cwd: out });
  return { file, size: statSync(file).size };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), slug = args.find(a => !a.startsWith('--'));
  const portal = (args.find(a => a.startsWith('--portal=')) ?? '--portal=itch').slice(9);
  if (!slug) { console.error('usage: node scripts/portal-zip.mjs <experiment> [--portal=itch|strict] [--no-zip]'); process.exit(2); }
  const made = build({ slug, portal });
  console.log(`${relative(process.cwd(), made.out)}: ${made.files} files, ${(made.size / 1024).toFixed(0)} KB`);
  if (!args.includes('--no-zip')) { const z = zip(made.out); console.log(`${relative(process.cwd(), z.file)}: ${(z.size / 1024).toFixed(0)} KB`); }
}
