/** Exact, unpaired label permutation test on |difference in means|; all C(20,10) allocations,
 * inclusive ties. Medians describe each sample. Seed-matched terrain is retained but the test requested
 * here is unpaired. Exploratory p values include Holm correction within the stated comparison families;
 * families are not jointly corrected, and a large p does not establish equivalence.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { measureRecording } from './measures.ts';
import type { Recording } from './types.ts';

export function median(values: number[]): number {
  if (!values.length) throw new Error('Median needs observations');
  const sorted = [...values].sort((a, b) => a - b);
  return (
    ((sorted[Math.floor((sorted.length - 1) / 2)] as number) +
      (sorted[Math.floor(sorted.length / 2)] as number)) /
    2
  );
}
export function exactPermutation(a: number[], b: number[]): number {
  if (!a.length || !b.length || [...a, ...b].some((v) => !Number.isFinite(v)))
    throw new Error('Finite nonempty samples required');
  const values = [...a, ...b];
  const sumA = a.reduce((s, v) => s + v, 0);
  const sum = values.reduce((s, v) => s + v, 0);
  const statistic = (s: number) => Math.abs(s / a.length - (sum - s) / b.length);
  const observed = statistic(sumA);
  let extreme = 0;
  let total = 0;
  function enumerate(start: number, remaining: number, subtotal: number): void {
    if (remaining === 0) {
      total++;
      if (statistic(subtotal) >= observed - 1e-12 * Math.max(1, observed)) extreme++;
      return;
    }
    for (let i = start; i <= values.length - remaining; i++)
      enumerate(i + 1, remaining - 1, subtotal + (values[i] as number));
  }
  enumerate(0, a.length, 0);
  return extreme / total;
}

/** Holm step-down adjusted p values, returned in the original hypothesis order. */
export function holmAdjust(pValues: number[]): number[] {
  if (pValues.some((p) => !Number.isFinite(p) || p < 0 || p > 1))
    throw new Error('Finite p values between zero and one required');
  const ordered = pValues.map((p, index) => ({ p, index })).sort((a, b) => a.p - b.p);
  const adjusted: number[] = Array(pValues.length);
  let previous = 0;
  ordered.forEach(({ p, index }, rank) => {
    previous = Math.min(1, Math.max(previous, (pValues.length - rank) * p));
    adjusted[index] = previous;
  });
  return adjusted;
}

export async function compare(directory = 'viewer/runs'): Promise<string> {
  const names = ['hf', 'random', 'hf2', 'hf2-no-boredom', 'hf2-no-memory', 'hf2-no-goals'];
  const samples = new Map<string, Record<string, number>[]>();
  for (const name of names) {
    const records = [];
    for (let seed = 1; seed <= 10; seed++) {
      const r = JSON.parse(await readFile(resolve(directory, `${name}-${seed}.json`), 'utf8')) as Recording;
      if (
        r.seed !== seed ||
        r.mind !== name ||
        r.hf !== '2.9.0' ||
        r.frames.length !== 240 ||
        r.config.freeEpisodes !== 3 ||
        r.config.stepsPerEpisode !== 60 ||
        r.config.taskSteps !== 60
      )
        throw new Error(`Unexpected run ${name}-${seed}`);
      records.push(measureRecording(r));
    }
    samples.set(name, records);
  }
  const rows = [
    'Exact unpaired permutation tests of absolute mean differences, including ties. Medians describe samples. Holm correction uses one eight-test family per arm vs random (seven free-time metrics plus task score), one singleton family per task-score comparison vs hf, and one two-test family per hf2 ablation comparison. Families are exploratory and are not jointly corrected; large p values do not establish equivalence. The hf baseline has no task comparison with itself.',
    '',
    '| Comparison | Measure | Median A | Median B | Exact p | Holm p |',
    '|---|---|---:|---:|---:|---:|',
  ];
  const metrics: [string, string][] = [
    ['cellsVisited', 'Cells visited'],
    ['kindEntropy', 'Kind entropy'],
    ['manipulationShare', 'Manipulation share'],
    ['idleShare', 'Idle share'],
    ['freeSpireObjects', 'Spire objects'],
    ['freeMaxStack', 'Tallest stack'],
    ['repeatedPursuit', 'Repeated pursuit'],
  ];
  function append(a: string, b: string, fields: [string, string][]) {
    const results = fields.map(([key, label]) => {
      const av = (samples.get(a) ?? []).map((m) => m[key] as number);
      const bv = (samples.get(b) ?? []).map((m) => m[key] as number);
      return { label, medianA: median(av), medianB: median(bv), p: exactPermutation(av, bv) };
    });
    const adjusted = holmAdjust(results.map(({ p }) => p));
    results.forEach(({ label, medianA, medianB, p }, index) => {
      rows.push(
        `| ${a} vs ${b} | ${label} | ${medianA.toFixed(4)} | ${medianB.toFixed(4)} | ${p.toFixed(6)} | ${(adjusted[index] as number).toFixed(6)} |`,
      );
    });
  }
  for (const arm of ['hf', 'hf2', 'hf2-no-memory', 'hf2-no-boredom'])
    append(arm, 'random', [...metrics, ['taskScore', 'Task score']]);
  for (const arm of ['hf2', 'hf2-no-memory', 'hf2-no-boredom'])
    append(arm, 'hf', [['taskScore', 'Task score']]);
  for (const arm of names.slice(3))
    append('hf2', arm, [
      ['taskScore', 'Task score'],
      ['rememberedTargetMoves', 'Remembered-target moves (all)'],
    ]);
  return rows.join('\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(await compare());
}
