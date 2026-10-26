import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import random from '../src/minds/random.ts';
import { runIsland } from '../src/run.ts';
import { type Mind, type Observation, PERSONA } from '../src/types.ts';
import { apply, createWorld } from '../src/world.ts';

async function scratchDirectory() {
  return mkdtemp(join(tmpdir(), 'island-runner-test-'));
}

describe('runner', () => {
  it('records deterministic complete default runs', async () => {
    const a = await runIsland(random({ seed: 23, persona: PERSONA }), 23);
    const b = await runIsland(random({ seed: 23, persona: PERSONA }), 23);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.frames).toHaveLength(240);
    expect(a.frames.map((f) => f.e)).toEqual([
      ...Array(60).fill(0),
      ...Array(60).fill(1),
      ...Array(60).fill(2),
      ...Array(60).fill(3),
    ]);
    expect(a.frames.at(-1)?.s).toBe(59);
    expect(a.notes).toEqual(['', '', '', '']);
    expect(a.cost).toEqual({ calls: 0, inputTokens: 0, outputTokens: 0, usd: 0 });
    expect(Object.keys(a.measures).length).toBeGreaterThan(0);
  });

  it('passes prior events and remaining steps and records post-action frames', async () => {
    const observations: Observation[] = [];
    const endings: Observation[] = [];
    let reports = 0;
    const mind: Mind & { cost(): { calls: number; inputTokens: number; outputTokens: number; usd: number } } =
      {
        name: 'probe',
        step(obs) {
          observations.push(structuredClone(obs));
          const action = obs.actions.find((a) => a.kind === 'move') ?? obs.actions[0];
          if (!action) throw new Error('No actions');
          return { action: action.id, why: 'probe', inner: { interest: 0.5 } };
        },
        endEpisode(obs) {
          endings.push(structuredClone(obs));
          return `note ${obs.episode}`;
        },
        async selfReport() {
          reports++;
          return { text: 'report', boredom: 2 };
        },
        cost() {
          return { calls: 4, inputTokens: 5, outputTokens: 6, usd: 0.01 };
        },
      };
    const recording = await runIsland(mind, 23, { freeEpisodes: 1, stepsPerEpisode: 2, taskSteps: 1 });
    expect(observations.map((o) => o.stepsLeft)).toEqual([2, 1, 1]);
    expect(observations.map((o) => o.task)).toEqual([
      '',
      '',
      'Put as many cubes as you can on the Spire before the hour ends.',
    ]);
    expect(observations[0]?.events).toEqual([]);
    expect(observations[1]?.events).toEqual(recording.frames[0]?.events);
    expect(observations[2]?.events).toEqual([]);
    expect(endings.map((o) => o.stepsLeft)).toEqual([0, 0]);
    expect(endings[0]?.events).toEqual(recording.frames[1]?.events);
    expect(endings[1]?.events).toEqual(recording.frames[2]?.events);
    const firstFrame = recording.frames[0];
    if (!firstFrame) throw new Error('Expected a first frame');
    const firstState = apply(createWorld(23), firstFrame.action).state;
    expect(firstFrame.me).toEqual(firstState.me);
    expect(firstFrame.carrying).toBe(firstState.carrying);
    expect(firstFrame.objects).toEqual(
      firstState.objects.flatMap((object) =>
        object.at ? [{ id: object.id, x: object.at.x, y: object.at.y, level: object.level }] : [],
      ),
    );
    expect(recording.frames[0]?.me).not.toEqual(recording.frames[1]?.me);
    expect(recording.frames.map((f) => [f.e, f.s])).toEqual([
      [0, 0],
      [0, 1],
      [1, 0],
    ]);
    expect(recording.frames[0]?.why).toBe('probe');
    expect(recording.frames[0]?.inner).toEqual({ interest: 0.5 });
    expect(recording.notes).toEqual(['note 0', 'note 1']);
    expect(reports).toBe(2);
    expect(recording.selfReports).toEqual([
      { episode: 0, text: 'report', boredom: 2 },
      { episode: 1, text: 'report', boredom: 2 },
    ]);
    expect(recording.cost).toEqual({ calls: 4, inputTokens: 5, outputTokens: 6, usd: 0.01 });
  });

  it('writes recordings and a deterministic index through the CLI', async () => {
    const directory = await scratchDirectory();
    try {
      const out = join(directory, 'random-8.json');
      const args = ['src/run.ts', '--mind', 'random', '--seed', '8', '--out', out];
      execFileSync(process.execPath, args);
      const first = await readFile(out, 'utf8');
      const index = await readFile(join(directory, 'index.json'), 'utf8');
      execFileSync(process.execPath, args);
      expect(await readFile(out, 'utf8')).toBe(first);
      expect(await readFile(join(directory, 'index.json'), 'utf8')).toBe(index);
      expect(JSON.parse(index)).toEqual([
        { file: 'random-8.json', mind: 'random', seed: 8, measures: JSON.parse(first).measures },
      ]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('loads all four HF2 arms through the CLI', async () => {
    const directory = await scratchDirectory();
    try {
      for (const arm of ['hf2', 'hf2-no-boredom', 'hf2-no-memory', 'hf2-no-goals']) {
        const out = join(directory, `${arm}-1.json`);
        execFileSync(process.execPath, ['src/run.ts', `--mind=${arm}`, '--seed=1', `--out=${out}`]);
        const run = JSON.parse(await readFile(out, 'utf8'));
        expect(run.mind).toBe(arm);
        expect(run.frames).toHaveLength(240);
        expect(run.cost.calls).toBe(0);
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, 15000);

  it('preserves the complete inline output path when it contains equals signs', async () => {
    const directory = await scratchDirectory();
    try {
      const out = join(directory, 'random=8.json');
      const result = spawnSync(process.execPath, ['src/run.ts', '--mind=random', `--out=${out}`]);
      expect(result.status).toBe(0);
      expect(await readdir(directory)).toContain('random=8.json');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('rejects the reserved index filename without overwriting it', async () => {
    const directory = await scratchDirectory();
    try {
      const out = join(directory, 'index.json');
      await writeFile(out, 'preserve this index');
      const result = spawnSync(process.execPath, ['src/run.ts', '--mind=random', '--out', out], {
        encoding: 'utf8',
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('index.json');
      expect(await readFile(out, 'utf8')).toBe('preserve this index');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('skips malformed sibling JSON when building the recording index', async () => {
    const directory = await scratchDirectory();
    try {
      await writeFile(join(directory, 'unrelated.json'), '{');
      const out = join(directory, 'random-1.json');
      const result = spawnSync(process.execPath, ['src/run.ts', '--mind=random', '--out', out]);
      expect(result.status).toBe(0);
      const index = JSON.parse(await readFile(join(directory, 'index.json'), 'utf8'));
      expect(index.map((entry: { file: string }) => entry.file)).toEqual(['random-1.json']);
      expect(await readFile(join(directory, 'unrelated.json'), 'utf8')).toBe('{');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
