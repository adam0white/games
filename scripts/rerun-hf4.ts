/** Ten-seed published-HF experiment. Outputs stay outside retained legacy recordings. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { replay } from 'hf4';
import { exactPermutation, holmAdjust, median } from '../src/compare.ts';
import { measureRecording } from '../src/measures.ts';
import { Hf4Mind } from '../src/minds/hf4.ts';
import random from '../src/minds/random.ts';
import { runIsland } from '../src/run.ts';
import { PERSONA, type Recording } from '../src/types.ts';
import { apply, createWorld, reset } from '../src/world.ts';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function physicalReplay(recording: Recording) {
  let state = createWorld(recording.seed),
    episode = 0;
  for (const frame of recording.frames) {
    if (frame.e !== episode) {
      state = reset(state);
      episode = frame.e;
    }
    const result = apply(state, frame.action);
    state = result.state;
    assert.deepEqual(frame.me, state.me);
    assert.deepEqual(frame.events, result.events);
    assert.equal(frame.carrying, state.carrying);
    assert.deepEqual(
      frame.objects,
      state.objects.flatMap((o) => (o.at ? [{ id: o.id, x: o.at.x, y: o.at.y, level: o.level }] : [])),
    );
  }
  return recording.frames.length;
}
export function statisticsFor(runs: Recording[], controls: Recording[]) {
  const keys = [
    'cellsVisited',
    'kindEntropy',
    'manipulationShare',
    'idleShare',
    'freeSpireObjects',
    'freeMaxStack',
    'repeatedPursuit',
    'taskScore',
  ];
  const p = keys.map((k) =>
    exactPermutation(
      runs.map((r) => measureRecording(r)[k] as number),
      controls.map((r) => measureRecording(r)[k] as number),
    ),
  );
  const adjusted = holmAdjust(p);
  const statistics = keys.map((key, i) => ({
    key,
    hf4Median: median(runs.map((r) => measureRecording(r)[key] as number)),
    randomMedian: median(controls.map((r) => measureRecording(r)[key] as number)),
    p: p[i],
    holmP: adjusted[i],
  }));
  return statistics;
}
export async function batch(directory: string) {
  await mkdir(directory, { recursive: true });
  const latest = execFileSync('npm', ['view', '@adam0white/human-framework', 'version'], {
    encoding: 'utf8',
  }).trim();
  if (latest !== '4.5.1')
    throw new Error(`Registry latest is ${latest}; update the exact alias before starting this batch.`);
  const startedAt = new Date().toISOString();
  const rows = [],
    controls: Recording[] = [],
    runs: Recording[] = [];
  for (let seed = 1; seed <= 10; seed++) {
    const mind = new Hf4Mind({ seed, persona: PERSONA });
    const run = await runIsland(mind, seed);
    assert.equal(run.frames.length, 240);
    physicalReplay(run);
    const archive = mind.archive();
    const verified = replay(archive);
    assert.ok(verified.ok, JSON.stringify(verified));
    assert.equal(verified.value.fullHash, archive.hashes.full);
    await writeFile(resolve(directory, `hf4-${seed}.json`), `${JSON.stringify(run, null, 2)}\n`);
    if (seed === 1) await writeFile(resolve(directory, 'hf4-1.archive.json'), `${JSON.stringify(archive)}\n`);
    const control = await runIsland(random({ seed, persona: PERSONA }), seed);
    physicalReplay(control);
    controls.push(control);
    runs.push(run);
    await writeFile(resolve(directory, `random-${seed}.json`), `${JSON.stringify(control, null, 2)}\n`);
    const row = {
      seed,
      hash: hash(run),
      archiveHash: archive.hashes.full,
      replay: verified.value.verified,
      ...run.measures,
      projectAdoptions: Math.max(0, ...run.frames.map((f) => Number(f.inner?.projects ?? 0))),
      maxProjectProgress: Math.max(0, ...run.frames.map((f) => Number(f.inner?.projectProgress ?? 0))),
    };
    rows.push(row);
    console.log(JSON.stringify(row));
  }
  const repeat = new Hf4Mind({ seed: 1, persona: PERSONA });
  const repeated = await runIsland(repeat, 1);
  assert.equal(hash(repeated), hash(runs[0]));
  assert.equal(repeat.archive().hashes.full, rows[0]?.archiveHash);
  const statistics = statisticsFor(runs, controls);
  const composition = (records: Recording[]) => {
    const counts: Record<string, number> = {};
    for (const r of records)
      for (const f of r.frames.filter((f) => f.e < 3)) {
        const kind = f.action.split(' ')[0] ?? '';
        counts[kind] = (counts[kind] ?? 0) + 1;
      }
    return Object.fromEntries(Object.entries(counts).map(([k, n]) => [k, n / 1800]));
  };
  const result = {
    latest,
    startedAt,
    finishedAt: new Date().toISOString(),
    seeds: rows,
    repeatSeed1Hash: hash(repeated),
    statistics,
    composition: { hf4: composition(runs), random: composition(controls) },
    controls: controls.map((r) => ({ seed: r.seed, hash: hash(r), ...measureRecording(r) })),
  };
  await writeFile(resolve(directory, 'summary.json'), `${JSON.stringify(result, null, 2)}\n`);
  return result;
}
export async function summarize(directory: string) {
  const summaryPath = resolve(directory, 'summary.json');
  const summary = JSON.parse(await readFile(summaryPath, 'utf8'));
  const runs: Recording[] = [],
    controls: Recording[] = [];
  for (let seed = 1; seed <= 10; seed++) {
    runs.push(JSON.parse(await readFile(resolve(directory, `hf4-${seed}.json`), 'utf8')));
    controls.push(JSON.parse(await readFile(resolve(directory, `random-${seed}.json`), 'utf8')));
  }
  summary.statistics = statisticsFor(runs, controls);
  summary.controls = controls.map((r) => ({ seed: r.seed, hash: hash(r), ...measureRecording(r) }));
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  return summary;
}
if (process.argv[1]?.endsWith('rerun-hf4.ts')) {
  const directory = resolve(process.argv[2] ?? 'scratch/hf4');
  (process.argv.includes('--summarize') ? summarize(directory) : batch(directory)).catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
