// Fixed reproducibility check. Run with the pinned Node version.
// node loadtest/repeat-bench.mjs --out /tmp/crumbwar-bench [--assert-targets]
// Each mode gets a fresh Node process. The three cycles counterbalance order.
import { spawnSync } from 'node:child_process';
import { appendFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const value = flag => { const i = args.indexOf(flag); return i < 0 ? undefined : args[i + 1]; };
const node = value('--node') ?? process.execPath;
const output = resolve(value('--out') ?? join(tmpdir(), `crumbwar-bench-${Date.now()}`));
const benchmark = fileURLToPath(new URL('./bench.mjs', import.meta.url));
const cycles = [['classic', 'feast', 'rush'], ['feast', 'rush', 'classic'], ['rush', 'classic', 'feast']];
const rows = [], median = values => [...values].sort((a, b) => a - b)[values.length >> 1];
writeFileSync(`${output}.jsonl`, '');
for (let cycle = 0; cycle < cycles.length; cycle++) {
  for (let position = 0; position < cycles[cycle].length; position++) {
    const mode = cycles[cycle][position];
    const result = spawnSync(node, [benchmark, '--modes', mode], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Benchmark failed: ${mode}\n${result.stderr}`);
    const measured = result.stdout.trim().split('\n').map(line => JSON.parse(line));
    if (measured.length !== 3 || measured.some((r, i) => r.mode !== mode || r.people !== [12, 60, 240][i] || r.seconds !== 150)) throw new Error('Unexpected benchmark workload');
    for (const row of measured) {
      Object.assign(row, { cycle: cycle + 1, position: position + 1 });
      rows.push(row); appendFileSync(`${output}.jsonl`, `${JSON.stringify(row)}\n`);
    }
    console.error(`Completed cycle ${cycle + 1}: ${mode}`);
  }
}
const summary = [];
for (const mode of ['classic', 'feast', 'rush']) for (const people of [12, 60, 240]) {
  const runs = rows.filter(r => r.mode === mode && r.people === people);
  const means = runs.map(r => r.meanTickMs), cpuMeans = runs.map(r => r.meanProcessCpuMs);
  const item = { mode, people, meansMs: means, medianMs: median(means), pooledMeanMs: means.reduce((sum, v) => sum + v, 0) / means.length, rangeMs: [Math.min(...means), Math.max(...means)],
    cpuMeansMs: cpuMeans, medianCpuMs: median(cpuMeans), pooledMeanCpuMs: cpuMeans.reduce((sum, v) => sum + v, 0) / cpuMeans.length, bytesPerClientSecond: runs.map(r => r.bytesPerClientSecond),
    snapshotsPerSecond: runs[0].snapshotsPerSecond };
  if (people === 240) { item.medianTickPass = item.medianMs < 1; item.meanTickPass = item.pooledMeanMs < 1; }
  else item.bytePass = runs.every(r => r.bytePass);
  summary.push(item);
}
writeFileSync(`${output}.summary.json`, `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify({ rows: `${output}.jsonl`, summary: `${output}.summary.json`, results: summary }));
if (args.includes('--assert-targets') && summary.some(r => r.bytePass === false || r.meanTickPass === false)) process.exitCode = 1;
