import { createGame, dispatch, upgradeRules } from './engine';
import { loadGame, saveGame } from './persistence';
import {
  isInputRecording,
  isLegacyProvenance,
  isMigratedFrom,
  isSupportedProvenance,
} from './recording';
import type { Command, GameState } from './types';

export type ReplayResult =
  | { ok: true; state: GameState; save: string }
  | {
      ok: false;
      reason: 'invalid-recording' | 'unsupported-version' | 'command-failed' | 'state-mismatch';
      message: string;
      index?: number;
      command?: Command;
    };

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * Replay recorded inputs. Engine-4 recordings replay under engine-4 rules; a migrated world replays engine-4 rules up
 * to its recorded input index and the current rules after it. A comparison save is read through `loadGame`, so an
 * older HF snapshot's engine stamp is normalised the same way a restore normalises it.
 */
export function replayRecordedRun(
  recording: { seed: number; inputs: unknown; provenance?: unknown; migratedFrom?: unknown },
  expectedSave?: string,
): ReplayResult {
  if (
    !Number.isInteger(recording.seed) ||
    recording.seed < 0 ||
    recording.seed > 0xffffffff ||
    !isInputRecording(recording.inputs)
  ) {
    return {
      ok: false,
      reason: 'invalid-recording',
      message: 'The seed or recorded inputs are invalid.',
    };
  }
  const unsupported = (): ReplayResult => ({
    ok: false,
    reason: 'unsupported-version',
    message: 'This recording belongs to a different game, scenario, or framework version.',
  });
  if (recording.provenance !== undefined && !isSupportedProvenance(recording.provenance))
    return unsupported();
  if (recording.migratedFrom !== undefined && !isMigratedFrom(recording.migratedFrom))
    return unsupported();
  const migratedAt = recording.migratedFrom?.atInput;
  if (migratedAt !== undefined && migratedAt > recording.inputs.length) return unsupported();
  const legacy = migratedAt !== undefined || isLegacyProvenance(recording.provenance);
  let expectedCanonical: string | undefined;
  if (expectedSave !== undefined) {
    try {
      const expected = JSON.parse(expectedSave);
      if (
        expected?.schema !== expected?.provenance?.engine ||
        !isSupportedProvenance(expected?.provenance)
      )
        return unsupported();
      if (expected.seed !== recording.seed)
        return {
          ok: false,
          reason: 'state-mismatch',
          message: 'The recording and comparison save have different seeds.',
        };
    } catch {
      return {
        ok: false,
        reason: 'state-mismatch',
        message: 'The comparison save is invalid JSON.',
      };
    }
  }
  if (expectedSave !== undefined) {
    try {
      expectedCanonical = canonical(JSON.parse(saveGame(loadGame(expectedSave))));
    } catch (error) {
      return {
        ok: false,
        reason: 'state-mismatch',
        message: `The comparison save does not load: ${error instanceof Error ? error.message : 'invalid'}`,
      };
    }
  }
  let state = createGame(recording.seed, legacy ? 'legacy' : 'current');
  for (const [index, command] of recording.inputs.entries()) {
    if (index === migratedAt) state = upgradeRules(structuredClone(state));
    const result = dispatch(state, structuredClone(command));
    if (!result.ok) {
      return {
        ok: false,
        reason: 'command-failed',
        index,
        command: structuredClone(command),
        message: `Recorded input ${index + 1} failed: ${result.message}`,
      };
    }
    state = result.state;
  }
  if (migratedAt === recording.inputs.length) state = upgradeRules(structuredClone(state));
  const save = saveGame(state);
  if (expectedCanonical !== undefined) {
    try {
      if (canonical(JSON.parse(save)) !== expectedCanonical) {
        return {
          ok: false,
          reason: 'state-mismatch',
          message: 'The recorded inputs did not reproduce the exported world.',
        };
      }
    } catch {
      return {
        ok: false,
        reason: 'state-mismatch',
        message: 'The comparison save is invalid JSON.',
      };
    }
  }
  return { ok: true, state, save };
}
