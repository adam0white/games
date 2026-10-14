import { createGame, dispatch } from './engine';
import { saveGame } from './persistence';
import { isInputRecording, isSupportedProvenance, SAVE_PROVENANCE } from './recording';
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

/** Replay current-engine inputs. Exported recordings must match the supported provenance. */
export function replayRecordedRun(
  recording: { seed: number; inputs: unknown; provenance?: unknown },
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
  if (expectedSave !== undefined) {
    try {
      const expected = JSON.parse(expectedSave);
      if (
        expected?.schema !== SAVE_PROVENANCE.engine ||
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
  let state = createGame(recording.seed);
  for (const [index, command] of recording.inputs.entries()) {
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
  const save = saveGame(state);
  if (expectedSave !== undefined) {
    try {
      if (canonical(JSON.parse(save)) !== canonical(JSON.parse(expectedSave))) {
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
