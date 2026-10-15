import { describe, expect, it } from 'vitest';
import { physicalSceneOutput } from '../src/components/PhysicalObjectScene';
import { createGame, dispatch, saveGame } from '../src/game/engine';

describe('physical object preview', () => {
  it('shows visible bench behavior without awarding a check or teaching anyone', () => {
    const state = createGame(42);
    const job = state.jobs[0];
    if (!job) throw new Error('Missing opening object');
    const before = saveGame(state);
    expect(physicalSceneOutput(job).output).toBeGreaterThan(0);
    expect(saveGame(state)).toBe(before);
    expect(job.verified).toHaveLength(0);
    expect(job.evidence).toHaveLength(0);
  });

  it('shows a failed carry result during the test, then returns to the actual table state', () => {
    const state = createGame(42);
    const job = state.jobs[0];
    if (!job) throw new Error('Missing opening object');
    const result = dispatch(state, { type: 'verify', jobId: job.id, condition: 'movement' });
    expect(result.ok).toBe(true);
    const tested = result.state.jobs[0];
    if (!tested) throw new Error('Missing tested object');
    expect(physicalSceneOutput(tested, true).output).toBe(0);
    expect(physicalSceneOutput(tested).output).toBeGreaterThan(0);
    const off = dispatch(result.state, { type: 'power', jobId: job.id, on: false });
    const stopped = off.state.jobs[0];
    if (!stopped) throw new Error('Missing stopped object');
    expect(physicalSceneOutput(stopped).output).toBe(0);
    expect(physicalSceneOutput(stopped, true).output).toBe(0);
  });
});
