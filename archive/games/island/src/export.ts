/** Current Island exports verify both the physical world and the HF person. */
import { isDeepStrictEqual } from 'node:util';
import { type DeepReadonly, type RunArchive, replay } from '@adam0white/human-framework';
import { Hf4Mind } from './minds/hf4.ts';
import { runIsland } from './run.ts';
import { PERSONA, type Recording } from './types.ts';

export interface IslandExport {
  format: 'island-replay@1';
  recording: Recording;
  native: DeepReadonly<RunArchive>;
}
export function exportIsland(recording: Recording, native: DeepReadonly<RunArchive>): IslandExport {
  return { format: 'island-replay@1', recording, native };
}
/** Reconstruct the entire host from the seed and HF decisions, including resets.
 * A native replay alone cannot establish the physical world's outcomes. */
export async function verifyIsland(value: unknown): Promise<Recording> {
  if (!value || typeof value !== 'object' || !('format' in value) || value.format !== 'island-replay@1')
    throw new Error('This Island export is from an older edition. Begin a new run.');
  const file = value as IslandExport;
  const recording = file.recording;
  if (recording?.format !== 'island-recording@1' || recording.hf !== '4.17.0' || recording.mind !== 'hf4')
    throw new Error('This Island export needs the current edition. Begin a new run.');
  if (!Number.isSafeInteger(recording.seed) || !recording.config)
    throw new Error('Invalid Island seed or configuration.');
  const { freeEpisodes, stepsPerEpisode, taskSteps } = recording.config;
  if (
    ![freeEpisodes, stepsPerEpisode, taskSteps].every(
      (n) => Number.isSafeInteger(n) && n >= 0 && n <= 10_000,
    ) ||
    freeEpisodes > 100 ||
    typeof recording.config.task !== 'string' ||
    recording.config.task.length > 10_000 ||
    freeEpisodes * stepsPerEpisode + taskSteps > 10_000
  )
    throw new Error('Invalid Island configuration: at most 100 free episodes and 10,000 recorded steps.');
  const count = freeEpisodes * stepsPerEpisode + taskSteps;
  if (
    !Array.isArray(recording.frames) ||
    recording.frames.length !== count ||
    !Array.isArray(recording.notes) ||
    recording.notes.length !== freeEpisodes + 1
  )
    throw new Error('Island recording does not match its episode configuration.');
  if (!file.native || JSON.stringify(file.native).length > 16 * 1024 * 1024)
    throw new Error('Island native replay requires an archive no larger than 16 MiB.');
  const native = replay(file.native);
  if (!native.ok || !native.value.verified)
    throw new Error('The native Island history cannot be replayed. Begin a new run.');
  const mind = new Hf4Mind({ seed: recording.seed, persona: PERSONA });
  const repeated = await runIsland(mind, recording.seed, recording.config);
  if (!isDeepStrictEqual(repeated, recording) || !isDeepStrictEqual(mind.archive(), file.native))
    throw new Error('Island replay differs from the recorded world or person.');
  return repeated;
}
