import { describe, expect, it } from 'vitest';
import { exportIsland, verifyIsland } from '../src/export.ts';
import { Hf4Mind } from '../src/minds/hf4.ts';
import { runIsland } from '../src/run.ts';
import { PERSONA } from '../src/types.ts';

describe('current complete Island export', () => {
  it('replays HF and every host action across a reset and rejects changed evidence', async () => {
    const mind = new Hf4Mind({ seed: 7, persona: PERSONA });
    const recording = await runIsland(mind, 7, { freeEpisodes: 1, stepsPerEpisode: 3, taskSteps: 3 });
    const file = JSON.parse(JSON.stringify(exportIsland(recording, mind.archive())));
    expect((await verifyIsland(file)).frames).toHaveLength(6);
    const changed = structuredClone(file);
    changed.recording.frames[0].events.push('invented outcome');
    await expect(verifyIsland(changed)).rejects.toThrow();
    const wrongNative = structuredClone(file);
    wrongNative.native.hashes.full = '0'.repeat(64);
    await expect(verifyIsland(wrongNative)).rejects.toThrow();
    const wrongSeed = structuredClone(file);
    wrongSeed.recording.seed++;
    await expect(verifyIsland(wrongSeed)).rejects.toThrow();
    const wrongReset = structuredClone(file);
    wrongReset.recording.frames[3].e = 0;
    await expect(verifyIsland(wrongReset)).rejects.toThrow();
    const endless = structuredClone(file);
    endless.recording.config = {
      ...endless.recording.config,
      freeEpisodes: Number.MAX_SAFE_INTEGER,
      stepsPerEpisode: 0,
      taskSteps: 0,
    };
    endless.native = null;
    await expect(verifyIsland(endless)).rejects.toThrow(/episode|configuration/i);
  }, 30_000);
  it('refuses old exports with a start-fresh message', async () => {
    await expect(verifyIsland({ format: 'island-replay@0' })).rejects.toThrow(/new run/i);
  });
});
