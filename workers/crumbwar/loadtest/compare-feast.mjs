// Sequential, counterbalanced before/after measurements in fresh Node processes.
// node loadtest/compare-feast.mjs --base <commit> --out loadtest/results/feast-comparison.json
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const value = flag => { const i = args.indexOf(flag); return i < 0 ? undefined : args[i + 1]; };
const modes = (value('--modes') ?? 'classic,feast,rush').split(',');
if (!modes.includes('feast') || modes.some(m => !['classic', 'feast', 'rush'].includes(m))) throw new Error('Include feast and only known modes');
const cwd = fileURLToPath(new URL('../', import.meta.url));
const gitRoot = execFileSync('git', ['-c', 'core.fsmonitor=false', 'rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' }).trim();
const base = execFileSync('git', ['-c', 'core.fsmonitor=false', 'rev-parse', value('--base') ?? 'HEAD'], { cwd, encoding: 'utf8' }).trim();
const prefix = 'workers/crumbwar/';
const temp = mkdtempSync(join(tmpdir(), 'crumbwar-feast-bench-'));
const rows = [];
const beforeDir = join(temp, 'before'), afterDir = join(temp, 'after');
const diff = execFileSync('git', ['-c', 'core.fsmonitor=false', 'diff', base, '--', prefix + 'src/', prefix + 'public/', prefix + 'loadtest/bench.mjs'], { cwd: gitRoot });
const sourceDiffSha256 = createHash('sha256').update(diff).digest('hex');
try {
  mkdirSync(join(afterDir, 'loadtest'), { recursive: true });
  for (const dir of ['src', 'public']) cpSync(join(cwd, dir), join(afterDir, dir), { recursive: true });
  cpSync(join(cwd, 'loadtest/bench.mjs'), join(afterDir, 'loadtest/bench.mjs'));
  const files = execFileSync('git', ['-c', 'core.fsmonitor=false', 'ls-tree', '-r', '--name-only', base, '--', prefix], { cwd: gitRoot, encoding: 'utf8' }).trim().split('\n');
  for (const path of files) {
    const local = path.slice(prefix.length);
    if (!local.startsWith('src/') && !local.startsWith('public/') && local !== 'loadtest/bench.mjs') continue;
    const dest = join(beforeDir, local);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, execFileSync('git', ['-c', 'core.fsmonitor=false', 'show', `${base}:${path}`], { cwd: gitRoot, maxBuffer: 8 * 1024 * 1024 }));
  }
  for (let cycle = 0; cycle < 3; cycle++) {
    for (const mode of modes) {
      for (const version of cycle % 2 ? ['after', 'before'] : ['before', 'after']) {
        const runDir = version === 'before' ? beforeDir : afterDir;
        const stdout = execFileSync(process.execPath, ['loadtest/bench.mjs', '--modes', mode], { cwd: runDir, encoding: 'utf8' });
        for (const row of stdout.trim().split('\n').map(JSON.parse)) rows.push({ cycle, version, ...row });
        console.error(`cycle ${cycle + 1}: ${mode} ${version}`);
      }
    }
  }
  const summaries = [];
  for (const mode of modes) for (const people of [12, 60, 240]) {
    const means = version => {
      const runs = rows.filter(r => r.mode === mode && r.people === people && r.version === version);
      return { meanTickMs: runs.reduce((s,r) => s+r.meanTickMs, 0)/runs.length,
        cpuMs: runs.reduce((s,r) => s+r.meanProcessCpuMs, 0)/runs.length,
        bytesPerClientSecond: runs.map(r => r.bytesPerClientSecond) };
    };
    const before = means('before'), after = means('after');
    summaries.push({ mode, people, before, after, tickRatio: after.meanTickMs/before.meanTickMs,
      unchangedBytes: before.bytesPerClientSecond.every((n,i) => n === after.bytesPerClientSecond[i]) });
  }
  const feast = summaries.filter(r => r.mode === 'feast');
  const targets = {
    bytes12: feast.find(r => r.people === 12).after.bytesPerClientSecond.every(n => n < 1300),
    bytes60: feast.find(r => r.people === 60).after.bytesPerClientSecond.every(n => n < 2200),
    tick240: feast.find(r => r.people === 240).tickRatio <= 1.1,
    ...(modes.includes('classic') && modes.includes('rush') ? { otherModesBytes: summaries.filter(r => r.mode !== 'feast').every(r => r.unchangedBytes) } : {}),
  };
  const result = { base, sourceDiffSha256, node: process.version, ticksPerRun: 3000, warmupTicks: 200, summaries, targets, rows };
  if (value('--out')) writeFileSync(resolve(cwd, value('--out')), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ base, summaries, targets }));
  if (Object.values(targets).some(pass => !pass)) process.exitCode = 1;
} finally { rmSync(temp, { recursive: true, force: true }); }
