import { describe, expect, it } from 'vitest';
import { createGame, dispatch } from '../src/game/engine';
import { loadGame, saveGame } from '../src/game/persistence';
import { replayRecordedRun } from '../src/game/replay';
import type { Command, GameState } from '../src/game/types';

function step(state: GameState, command: Command): GameState {
  const result = dispatch(state, command);
  expect(result.ok, result.message).toBe(true);
  return result.state;
}

describe('canonical workshop edition', () => {
  it('keeps a discovery private until shared work and an explicit question, then replays it', () => {
    let state = createGame(42);
    expect(state.discoveries).toEqual([]);
    const denied = dispatch(state, { type: 'ask-about-work', personId: 'sam' });
    expect(denied.ok).toBe(false);
    expect(denied.state).toBe(state);
    state = step(state, { type: 'watch', enabled: true });
    state = step(state, { type: 'inspect', jobId: state.selectedJobId, componentId: 'switch' });
    state = step(state, { type: 'ask-about-work', personId: 'sam' });
    expect(state.log.at(-1)?.text).toContain('without reproducing');
    expect(state.discoveries).toEqual(['sam']);
    const saved = saveGame(state);
    expect(saveGame(loadGame(saved))).toBe(saved);
    expect(
      replayRecordedRun(
        { seed: state.seed, inputs: state.inputs, provenance: state.provenance },
        saved,
      ).ok,
    ).toBe(true);
  });

  it('replaces Evan without assigning his family or expertise to Rafi or Halil', () => {
    const state = createGame(42);
    expect(state.people.evan).toBeUndefined();
    expect(state.people.rafi?.name).toBe('Rafi');
    expect(state.people.halil?.name).toBe('Halil');
    expect(state.people.rafi?.methods?.rules ?? []).toEqual([]);
    expect(state.people.halil?.methods?.rules ?? []).toEqual([]);
    expect(dispatch(state, { type: 'ask-about-work', personId: 'halil' }).ok).toBe(false);
  });

  it('brings Halil in a later authored visit and leaves his debt and illness unresolved', () => {
    let state = step(createGame(42), { type: 'next-day' });
    state = step(state, { type: 'next-day' });
    const lantern = state.jobs.find((job) => job.ownerId === 'halil');
    expect(lantern).toBeDefined();
    state = step(state, { type: 'accept', jobId: lantern!.id });
    state = step(state, { type: 'inspect', jobId: lantern!.id, componentId: 'switch' });
    state = step(state, { type: 'ask-about-work', personId: 'halil' });
    expect(state.log.at(-1)?.text).toContain('does not treat his illness or settle his debts');
    expect(state.log.at(-1)?.text).toContain('Nuran');
  });
  it('requires actual shared objects before Nora or Rafi volunteer a private account', () => {
    let state = step(createGame(42), { type: 'next-day' });
    for (const personId of ['nora', 'rafi'] as const) {
      expect(dispatch(state, { type: 'ask-about-work', personId }).ok).toBe(false);
      const job = state.jobs.find((candidate) => candidate.ownerId === personId);
      expect(job).toBeDefined();
      state = step(state, { type: 'accept', jobId: job!.id });
      state = step(state, {
        type: 'inspect',
        jobId: job!.id,
        componentId: job!.model.components[0]!.id,
      });
      state = step(state, { type: 'ask-about-work', personId });
    }
    expect(state.discoveries).toEqual(['nora', 'rafi']);
    expect(state.log.at(-1)?.text).toContain('No money has been repaid');
    expect(
      replayRecordedRun(
        { seed: state.seed, inputs: state.inputs, provenance: state.provenance },
        saveGame(state),
      ).ok,
    ).toBe(true);
  });
});
