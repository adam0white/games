import { describe, expect, it } from 'vitest';
import { createGame, dispatch, loadGame, saveGame } from '../src/game/engine';
import type { Command, GameState } from '../src/game/types';
import { firstRepairProgress } from '../src/ui/first-repair';

function act(state: GameState, command: Command): GameState {
  const result = dispatch(state, command);
  expect(result.ok, result.message).toBe(true);
  return result.state;
}

describe('first repair disclosure', () => {
  it('begins with trying one family object, without revealing its fault', () => {
    const state = createGame(42);
    const before = saveGame(state);
    expect(firstRepairProgress(state)).toMatchObject({
      openingJobId: state.jobs[0]?.id,
      phase: 'try',
      workshopAvailable: false,
    });
    expect(saveGame(state)).toBe(before);
    // A hidden model change is not a player observation.
    for (const part of state.jobs[0]?.model.components ?? []) part.condition = 'good';
    expect(firstRepairProgress(state).phase).toBe('try');
  });

  it('teaches operating the meter, then follows actual abnormal readings', () => {
    let state = createGame(42);
    const job = state.jobs[0];
    if (!job) throw new Error('Missing opening object');
    state = act(state, { type: 'verify', jobId: job.id, condition: 'movement' });
    expect(firstRepairProgress(state).phase).toBe('open');
    state = act(state, { type: 'inspect', jobId: job.id, componentId: 'contact' });
    expect(firstRepairProgress(state)).toMatchObject({
      phase: 'measure-source',
      suggestedPair: { a: 'A', b: '0', mode: 'voltage' },
    });
    state = act(state, {
      type: 'measure',
      jobId: job.id,
      request: { mode: 'voltage', a: 'A', b: '0', condition: 'movement' },
    });
    expect(firstRepairProgress(state)).toMatchObject({
      phase: 'measure-path',
      suggestedPart: 'switch',
      suggestedPair: { a: 'B', b: 'C', condition: 'movement' },
    });
    state = act(state, {
      type: 'measure',
      jobId: job.id,
      request: { mode: 'voltage', a: 'B', b: 'C', condition: 'movement' },
    });
    expect(firstRepairProgress(state)).toMatchObject({ phase: 'inspect', suggestedPart: 'switch' });
    state = act(state, { type: 'inspect', jobId: job.id, componentId: 'switch' });
    expect(firstRepairProgress(state).phase).toBe('repair');
    state = act(state, {
      type: 'work',
      jobId: job.id,
      componentId: 'switch',
      intervention: 'replace',
    });
    expect(firstRepairProgress(state).phase).toBe('check');
    state = act(state, { type: 'verify', jobId: job.id, condition: 'movement' });
    expect(firstRepairProgress(state).phase).toBe('return');
    state = act(state, { type: 'deliver', jobId: job.id });
    expect(firstRepairProgress(state)).toMatchObject({
      phase: 'complete',
      workshopAvailable: true,
    });
    expect(firstRepairProgress(loadGame(saveGame(state)))).toEqual(firstRepairProgress(state));
  });

  it('does not demand a scripted test if the player finds a different valid route', () => {
    let state = createGame(42);
    const id = state.jobs[0]?.id;
    if (!id) throw new Error('Missing opening object');
    state = act(state, { type: 'work', jobId: id, componentId: 'switch', intervention: 'replace' });
    expect(firstRepairProgress(state).phase).toBe('check');
    state = act(state, { type: 'verify', jobId: id, condition: 'movement' });
    expect(firstRepairProgress(state).phase).toBe('return');
  });

  it('keeps later workshops available and ignores invalid meter attempts as teaching progress', () => {
    let state = createGame(42);
    const id = state.jobs[0]?.id;
    if (!id) throw new Error('Missing opening object');
    state = act(state, { type: 'verify', jobId: id, condition: 'movement' });
    state = act(state, { type: 'inspect', jobId: id, componentId: 'cell' });
    const invalid = dispatch(state, {
      type: 'measure',
      jobId: id,
      request: { mode: 'motion', a: 'A', b: '0', condition: 'bench' },
    });
    expect(invalid.ok).toBe(false);
    state = invalid.state;
    expect(firstRepairProgress(state).phase).toBe('measure-source');
    state = act(state, { type: 'next-day' });
    expect(firstRepairProgress(state).workshopAvailable).toBe(true);
  });

  it('keeps an imported prior lesson available after the lesson ends', () => {
    let state = act(createGame(416), { type: 'watch', enabled: true });
    expect(state.watching).toBe(true);
    state = loadGame(saveGame(state));
    expect(firstRepairProgress(state)).toMatchObject({
      workshopAvailable: true,
      apprenticeshipAvailable: true,
    });
    state = act(state, { type: 'watch', enabled: false });
    expect(firstRepairProgress(state)).toMatchObject({
      workshopAvailable: true,
      apprenticeshipAvailable: true,
    });
  });

  it('tries the owner condition instead of treating a passed bench test as the complaint', () => {
    let state = createGame(42);
    const id = state.jobs[0]?.id;
    if (!id) throw new Error('Missing opening object');
    state = act(state, { type: 'verify', jobId: id, condition: 'bench' });
    expect(firstRepairProgress(state).phase).toBe('try');
    state = act(state, { type: 'inspect', jobId: id, componentId: 'switch' });
    expect(firstRepairProgress(state).suggestedPair?.condition).toBe('movement');
  });
});
