import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';

// Keep these source snapshots fixed even as main becomes a different game.
const snapshots = [
  { slug: 'small-works', title: 'Small Works', date: '2026-10-14', description: 'A diagnostic workshop with physical repairs, finite parts and a shared day.', commit: 'ea16976cb0ec5234da62bd2d0667bf8ea4549f28' },
  { slug: 'repair-campaign', title: 'Repair campaign', date: '2026-10-12', description: 'The earlier home-and-garage campaign, with school years, retained projects and apprenticeship.', commit: '60fe450e7e752526c43f96b71cfb26d0ab288f47' },
];
const repository = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const output = resolve(repository, process.argv[2] ?? 'dist');
if (!existsSync(join(output, 'index.html'))) throw Error('Build the primary site before adding archives');
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: 'inherit' });
function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : /\.[jt]sx?$/.test(path) ? [path] : [];
  });
}
for (const snapshot of snapshots) {
  const temporary = mkdtempSync(join(tmpdir(), 'repair-archive-'));
  const checkout = join(temporary, 'source');
  try {
    run('git', ['worktree', 'add', '--detach', checkout, snapshot.commit], repository);
    run('npm', ['ci', '--no-audit', '--no-fund'], checkout);
    const prefix = `repair-archive:${snapshot.slug}:`;
    const storagePath = join(checkout, 'src/archive-storage.ts');
    // Build-only adapter: historical saves remain exportable/importable, while
    // visits cannot read or overwrite root-game or other-archive autosaves.
    for (const file of sourceFiles(join(checkout, 'src'))) {
      const original = readFileSync(file, 'utf8');
      const scoped = original.replaceAll('/third-party-notices.txt', `/experiments/${snapshot.slug}/third-party-notices.txt`);
      if (scoped !== original) writeFileSync(file, scoped);
      if (!/\blocalStorage\b/.test(original)) continue;
      const rewritten = scoped.replace(/\bwindow\.localStorage\b|\blocalStorage\b/g, 'archiveStorage');
      let path = relative(dirname(file), storagePath).replaceAll('\\', '/').replace(/\.ts$/, '');
      if (!path.startsWith('.')) path = `./${path}`;
      writeFileSync(file, `import { archiveStorage } from '${path}';\n${rewritten}`);
    }
    writeFileSync(storagePath, `const prefix = ${JSON.stringify(prefix)};\nexport const archiveStorage = {\n  getItem(key: string) { return window.localStorage.getItem(prefix + key); },\n  setItem(key: string, value: string) { window.localStorage.setItem(prefix + key, value); },\n  removeItem(key: string) { window.localStorage.removeItem(prefix + key); },\n};\n`);
    run('npm', ['run', 'build', '--', '--base', `/experiments/${snapshot.slug}/`], checkout);
    const destination = join(output, 'experiments', snapshot.slug);
    if (existsSync(destination)) throw Error(`Archive output already exists: ${destination}`);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(join(checkout, 'dist'), destination, { recursive: true });
    writeFileSync(join(destination, 'archive.json'), JSON.stringify({
      sourceCommit: snapshot.commit,
      sourceBranch: `archive/${snapshot.slug}`,
      base: `/experiments/${snapshot.slug}/`,
      storagePrefix: prefix,
      adaptations: ['Vite asset base', 'namespaced localStorage access', 'archive-local license link'],
      historicalCommitUnchanged: true,
      buildNode: process.version,
      archiveBuilderSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),
    }, null, 2) + '\n');
    const html = readFileSync(join(destination, 'index.html'), 'utf8');
    if (!html.includes(`/experiments/${snapshot.slug}/assets/`)) throw Error('Archive asset base was not applied');
    if (!existsSync(join(destination, 'third-party-notices.txt'))) throw Error('Archive third-party notices missing');
    console.log(`Built ${snapshot.slug} from ${snapshot.commit} at ${destination}`);
  } finally {
    if (existsSync(checkout)) run('git', ['worktree', 'remove', '--force', checkout], repository);
    rmSync(temporary, { recursive: true, force: true });
  }
}

const cards = snapshots.map((snapshot) => `<article>
  <p class="date"><time datetime="${snapshot.date}">${snapshot.date}</time> · Historical snapshot</p>
  <h2><a href="/experiments/${snapshot.slug}/">${snapshot.title}</a></h2>
  <p>${snapshot.description}</p>
  <p class="status">No active development.</p>
  <p class="commit">Source commit <code>${snapshot.commit}</code></p>
  <a class="play" href="/experiments/${snapshot.slug}/">Play ${snapshot.title}<span aria-hidden="true"> →</span></a>
</article>`).join('\n');
writeFileSync(join(output, 'experiments/index.html'), `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Earlier experiments · Repair workshop</title>
<style>
:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#17261f;color:#f2ecd7;line-height:1.6}
*{box-sizing:border-box}body{margin:0}main{max-width:1000px;margin:auto;padding:clamp(24px,5vw,64px)}
a{color:#ffe6af;text-underline-offset:.2em}a:hover{color:#fff}a:focus-visible{outline:3px solid #dcb46e;outline-offset:5px}
h1,h2{line-height:1.2}h1{font-size:clamp(2rem,5vw,3rem);margin-bottom:20px}h2{margin-top:8px}
.intro{max-width:65ch;color:#d6d9ce}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:24px;margin-top:32px}
article{background:#24322d;border:1px solid #6a786b;border-radius:12px;padding:24px;display:flex;flex-direction:column}
.date,.status,.commit{font-size:.875rem;color:#c4c9bd}.commit code{display:block;overflow-wrap:anywhere;font-size:.8rem}
.play{margin-top:auto;padding-top:16px;font-weight:650}footer{margin-top:32px;color:#c4c9bd;font-size:.875rem}
</style>
</head>
<body><main>
<nav aria-label="Main"><a href="/">← Current workshop</a></nav>
<h1>Earlier experiments</h1>
<p class="intro">These playable versions preserve earlier approaches to the repair game. They are historical snapshots with no active development.</p>
<p class="intro">Each version saves separately in this browser. Opening an experiment does not load or overwrite another version’s autosave. You can import a compatible exported save inside its original version.</p>
<section class="cards" aria-label="Playable historical versions">${cards}</section>
<footer>Dates identify the preserved source snapshots. Asset paths, save namespaces and license links are adapted for these archive addresses.</footer>
</main></body></html>\n`);
console.log(`Built archive index at ${join(output, 'experiments/index.html')}`);
