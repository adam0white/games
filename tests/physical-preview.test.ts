import { describe, expect, it } from 'vitest';
import { physicalSceneOutput } from '../src/components/PhysicalObjectScene';
import { createGame, dispatch, loadGame, saveGame } from '../src/game/engine';

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

  it('keeps the failed carry dark after the animation and after restoring the save', () => {
    const state = createGame(42);
    const job = state.jobs[0];
    if (!job) throw new Error('Missing opening object');
    const result = dispatch(state, { type: 'verify', jobId: job.id, condition: 'movement' });
    expect(result.ok).toBe(true);
    const tested = result.state.jobs[0];
    if (!tested) throw new Error('Missing tested object');
    expect(physicalSceneOutput(tested).output).toBe(0);
    const restored = loadGame(saveGame(result.state));
    const restoredJob = restored.jobs[0];
    if (!restoredJob) throw new Error('Missing restored object');
    expect(physicalSceneOutput(restoredJob).output).toBe(0);
    const off = dispatch(result.state, { type: 'power', jobId: job.id, on: false });
    const stopped = off.state.jobs[0];
    if (!stopped) throw new Error('Missing stopped object');
    expect(physicalSceneOutput(stopped).output).toBe(0);
  });

  it('invalidates the displayed failure after work and shows the next successful carry', () => {
    let state = createGame(42);
    const id = state.jobs[0]?.id;
    if (!id) throw new Error('Missing opening object');
    state = dispatch(state, { type: 'verify', jobId: id, condition: 'movement' }).state;
    state = dispatch(state, {
      type: 'work',
      jobId: id,
      componentId: 'switch',
      intervention: 'replace',
    }).state;
    const repaired = state.jobs[0];
    if (!repaired) throw new Error('Missing repaired object');
    expect(physicalSceneOutput(repaired).output).toBeGreaterThan(0);
    state = dispatch(state, { type: 'verify', jobId: id, condition: 'movement' }).state;
    const tested = state.jobs[0];
    if (!tested) throw new Error('Missing tested object');
    expect(physicalSceneOutput(tested).output).toBeGreaterThan(0);
  });
});
