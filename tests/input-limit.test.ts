import { expect, it } from 'vitest';
import { createGame, dispatch, loadGame, replayCommands, saveGame } from '../src/game/engine';
import { MAX_RECORDED_INPUTS } from '../src/game/recording';
import { replayRecordedRun } from '../src/game/replay';
import type { Command, GameState } from '../src/game/types';

function act(s: GameState, c: Command) {
  const result = dispatch(s, c);
  expect(result.ok, result.message).toBe(true);
  return result.state;
}

it.each([false, true])(
  'resumes a long workshop without inventing replay (optional=%s)',
  (optional) => {
    let s = createGame(42);
    if (optional) {
      s = act(s, { type: 'start-cast-outcomes' });
      s = act(s, { type: 'watch', enabled: true });
      s = act(s, { type: 'inspect', jobId: s.selectedJobId, componentId: 'switch' });
      s = act(s, { type: 'ask-about-work', personId: 'sam' });
      s = act(s, { type: 'watch', enabled: false });
      s = act(s, { type: 'cast-outcome', action: 'sam-correction' });
      s = act(s, { type: 'wait', minutes: 15 });
      expect(s.castOutcomes?.receipts.some((r) => r.action === 'sam-correction')).toBe(true);
    } else {
      s = act(s, { type: 'inspect', jobId: s.selectedJobId, componentId: 'switch' });
    }
    const account = structuredClone(s.castOutcomes);
    const filled = replayCommands(
      s,
      Array.from(
        { length: MAX_RECORDED_INPUTS - (s.inputs?.length ?? 0) },
        (): Command => ({ type: 'select', jobId: s.selectedJobId }),
      ),
    );
    expect(filled.ok).toBe(true);
    if (!filled.ok) throw new Error(filled.message);
    s = filled.state;
    expect(s.inputs).toHaveLength(MAX_RECORDED_INPUTS);
    expect(saveGame(loadGame(saveGame(s)))).toBe(saveGame(s));
    s = act(s, { type: 'select', jobId: s.selectedJobId });
    expect(s.inputs).toBeUndefined();
    const raw = saveGame(s);
    let resumed = loadGame(raw);
    expect(saveGame(resumed)).toBe(raw);
    for (const command of [{ type: 'wait', minutes: 7 }, { type: 'next-day' }] as const) {
      s = act(s, command);
      resumed = act(resumed, command);
      expect(saveGame(resumed)).toBe(saveGame(s));
      expect(resumed.inputs).toBeUndefined();
      resumed = loadGame(saveGame(resumed));
    }
    expect(resumed.provenance).toEqual(s.provenance);
    expect(resumed.castOutcomes).toEqual(account);
    expect(
      replayRecordedRun({ ...resumed, inputs: resumed.inputs }, saveGame(resumed)),
    ).toMatchObject({
      ok: false,
      reason: 'invalid-recording',
    });
    if (optional) {
      for (const mutate of [
        (v: GameState) => {
          if (v.provenance) v.provenance.scenario = 'canonical-workshop@2';
        },
        (v: GameState) => {
          if (v.castOutcomes) v.castOutcomes.startedAt = 541;
        },
        (v: GameState) => {
          v.inputs = [];
        },
        (v: GameState) => {
          v.inputs = [{ type: 'select', jobId: v.selectedJobId }];
        },
      ]) {
        const invalid = JSON.parse(saveGame(resumed)) as GameState;
        mutate(invalid);
        expect(() => loadGame(JSON.stringify(invalid))).toThrow();
      }
    }
  },
  120_000,
);
