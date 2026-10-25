import { snapshot } from '@adam0white/human-framework';
import { describe, expect, it } from 'vitest';
import { createGame, dispatch } from '../src/game/engine';
import { loadGame, saveGame } from '../src/game/persistence';
import { SAVE_PROVENANCE } from '../src/game/recording';
import { replayRecordedRun } from '../src/game/replay';

describe('published HF plain narration', () => {
  it('opts every fresh person in and persists the choice', () => {
    const state = createGame(42);
    expect(SAVE_PROVENANCE.framework).toBe('3.0.0');
    expect(state.people.sam!.engine).toBe('2.23.0');
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

describe('HF3 raw continuation', () => {
  it('preserves every saved field, RNG and semantic narration history across resume', () => {
    for (const seed of [7, 42, 1001]) {
      let state = createGame(seed);
      const jobId = state.selectedJobId;
      const commands = [
        { type: 'verify', jobId, condition: 'movement' },
        { type: 'work', jobId, componentId: 'switch', intervention: 'replace' },
        { type: 'verify', jobId, condition: 'movement' },
        { type: 'deliver', jobId },
        { type: 'request-lesson' },
        { type: 'wait', minutes: 30 },
        { type: 'next-day' },
      ] as const;
      for (const command of commands) {
        const saved = saveGame(state);
        const restored = loadGame(saved);
        expect(saveGame(restored)).toBe(saved);
        const continuous = dispatch(state, command);
        const resumed = dispatch(restored, command);
        expect(resumed.ok).toBe(continuous.ok);
        expect(saveGame(resumed.state)).toBe(saveGame(continuous.state));
        state = continuous.state;
      }
      const saved = saveGame(state);
      expect(replayRecordedRun(JSON.parse(saved), saved).ok).toBe(true);
    }
  });
});
