import { snapshot } from '@adam0white/human-framework';
import { describe, expect, it } from 'vitest';
import { createGame, dispatch } from '../src/game/engine';
import { loadGame, saveGame } from '../src/game/persistence';
import { SAVE_PROVENANCE } from '../src/game/recording';
import { replayRecordedRun } from '../src/game/replay';

describe('published HF plain narration', () => {
  it('opts every fresh person in and persists the choice', () => {
    const state = createGame(42);
    expect(SAVE_PROVENANCE.framework).toBe('2.21.0');
    for (const person of Object.values(state.people)) {
      expect(snapshot(person).lexicon?.plainEnglish).toBe(true);
    }
    expect(saveGame(loadGame(saveGame(state)))).toBe(saveGame(state));
  });

  it('replays pinned people without replacing their saved narration choice', () => {
    const opening = createGame(42).people;
    opening.sam!.lexicon = { plainEnglish: false, names: { player: 'You' } };
    let state = createGame(42, 'current', opening);
    state = dispatch(state, { type: 'request-lesson' }).state;
    const saved = saveGame(state);
    expect(loadGame(saved).people.sam!.lexicon).toEqual(opening.sam!.lexicon);
    expect(replayRecordedRun({ ...state, inputs: state.inputs }, saved).ok).toBe(true);
  });

  it('refuses an earlier package export with a start-fresh message', () => {
    const old = JSON.parse(saveGame(createGame(42)));
    old.provenance.framework = '2.18.0';
    expect(() => loadGame(JSON.stringify(old))).toThrow('Start fresh');
    expect(replayRecordedRun(old).ok).toBe(false);
  });
});
