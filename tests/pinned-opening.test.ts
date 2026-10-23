import { describe, expect, it } from 'vitest';
import { createGame, dispatch } from '../src/game/engine';
import { loadGame, saveGame } from '../src/game/persistence';
import { replayRecordedRun } from '../src/game/replay';

describe('pinned initial people', () => {
  it('retains actual incoming person state through construction, reload and replay', () => {
    const opening = createGame(42).people;
    opening.sam!.traits.honesty = 0.91;
    opening.sam!.body.satiety = 0.42;
    const changed = structuredClone(opening);
    let state = createGame(42, 'current', opening);
    expect(state.people.sam!.traits.honesty).toBe(0.91);
    expect(state.people.sam!.body.satiety).toBe(0.42);
    expect(opening).toEqual(changed);
    state = dispatch(state, { type: 'wait', minutes: 15 }).state;
    const saved = saveGame(state);
    expect(saveGame(loadGame(saved))).toBe(saved);
    expect(
      replayRecordedRun(
        {
          seed: 42,
          inputs: state.inputs,
          provenance: state.provenance,
          openingPeople: state.openingPeople,
        },
        saved,
      ).ok,
    ).toBe(true);
    expect(
      replayRecordedRun({ seed: 42, inputs: state.inputs, provenance: state.provenance }, saved).ok,
    ).toBe(false);
  });
});
