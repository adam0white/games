import { describe, expect, it } from 'vitest';
import { createGame as createBaseGame, dispatch } from '../src/game/engine';
import type { GameState } from '../src/game/types';
import { readyToLearn } from './hf-fixture';

function createGame(seed: number): GameState {
  const state = createBaseGame(seed);
  readyToLearn(state.people.sam!);
  return state;
}
function attend(state: GameState): void {
  expect(state.watching).toBe(true);
}

describe('causal teaching and current checks', () => {
  it('does not credit separate interventions from one later successful use', () => {
    let state = dispatch(createGame(42), { type: 'watch', enabled: true }).state;
    const jobId = state.selectedJobId;
    attend(state);
    state = dispatch(state, {
      type: 'measure',
      jobId,
      request: { mode: 'voltage', a: 'A', b: 'B', condition: 'movement' },
    }).state;
    attend(state);
    state = dispatch(state, {
      type: 'work',
      jobId,
      componentId: 'contact',
      intervention: 'clean',
    }).state;
    attend(state);
    state = dispatch(state, {
      type: 'work',
      jobId,
      componentId: 'switch',
      intervention: 'replace',
    }).state;
    attend(state);
    state = dispatch(state, { type: 'verify', jobId, condition: 'movement' }).state;
    expect(state.jobs[0]?.status).toBe('ready');
    const rules = state.people.sam?.methods?.rules ?? [];
    expect(
      rules
        .find((r) => r.action === 'clean:contact')
        ?.evidence.some((e) => e.outcome === 'success') ?? false,
    ).toBe(false);
    expect(
      rules
        .find((r) => r.action === 'replace:switch')
        ?.evidence.some((e) => e.outcome === 'success') ?? false,
    ).toBe(false);
  });
  it('keeps an isolated attended before/after improvement learnable', () => {
    let state = createGame(42);
    const job = state.jobs[0];
    if (!job) throw new Error('Missing job');
    for (const component of job.model.components)
      component.condition = component.id === 'contact' ? 'dirty' : 'good';
    state = dispatch(state, { type: 'watch', enabled: true }).state;
    state = dispatch(state, { type: 'power', jobId: job.id, on: false }).state;
    const request = { mode: 'continuity' as const, a: 'C', b: 'D', condition: 'bench' as const };
    attend(state);
    state = dispatch(state, { type: 'measure', jobId: job.id, request }).state;
    attend(state);
    state = dispatch(state, {
      type: 'work',
      jobId: job.id,
      componentId: 'contact',
      intervention: 'clean',
    }).state;
    attend(state);
    state = dispatch(state, { type: 'measure', jobId: job.id, request }).state;
    expect(
      state.people.sam?.methods?.rules.find((r) => r.action === 'clean:contact')?.evidence.at(-1)
        ?.outcome,
    ).toBe('success');
  });
  it('requires a new attended baseline after earlier work before crediting the next repair', () => {
    let state = dispatch(createGame(42), { type: 'watch', enabled: true }).state;
    const jobId = state.selectedJobId;
    const reading = {
      type: 'measure' as const,
      jobId,
      request: { mode: 'voltage' as const, a: 'B', b: 'C', condition: 'movement' as const },
    };
    attend(state);
    state = dispatch(state, reading).state;
    attend(state);
    state = dispatch(state, {
      type: 'work',
      jobId,
      componentId: 'contact',
      intervention: 'clean',
    }).state;
    attend(state);
    state = dispatch(state, reading).state;
    attend(state);
    state = dispatch(state, {
      type: 'work',
      jobId,
      componentId: 'switch',
      intervention: 'replace',
    }).state;
    attend(state);
    state = dispatch(state, { type: 'verify', jobId, condition: 'movement' }).state;
    expect(
      state.people.sam?.methods?.rules.find((r) => r.action === 'replace:switch')?.evidence.at(-1)
        ?.outcome,
    ).toBe('success');
    expect(
      state.people.sam?.methods?.rules
        .find((r) => r.action === 'clean:contact')
        ?.evidence.some((e) => e.outcome === 'success') ?? false,
    ).toBe(false);
  });
  it('does not credit cleaning a normal reading because an already working object passes', () => {
    let state = createGame(42);
    const job = state.jobs[0];
    if (!job) throw new Error('Missing job');
    for (const component of job.model.components) component.condition = 'good';
    state = dispatch(state, { type: 'watch', enabled: true }).state;
    state = dispatch(state, { type: 'power', jobId: job.id, on: false }).state;
    attend(state);
    state = dispatch(state, {
      type: 'measure',
      jobId: job.id,
      request: { mode: 'continuity', a: 'C', b: 'D', condition: 'bench' },
    }).state;
    attend(state);
    state = dispatch(state, {
      type: 'work',
      jobId: job.id,
      componentId: 'contact',
      intervention: 'clean',
    }).state;
    state = dispatch(state, { type: 'power', jobId: job.id, on: true }).state;
    attend(state);
    state = dispatch(state, { type: 'verify', jobId: job.id, condition: 'movement' }).state;
    expect(state.jobs[0]?.status).toBe('ready');
    expect(
      state.people.sam?.methods?.rules
        .find((r) => r.action === 'clean:contact')
        ?.evidence.some((e) => e.outcome === 'success') ?? false,
    ).toBe(false);
  });
  it('invalidates readiness after a failed required recheck and refuses checked delivery', () => {
    let state = createGame(42);
    const jobId = state.selectedJobId;
    state = dispatch(state, {
      type: 'work',
      jobId,
      componentId: 'switch',
      intervention: 'replace',
    }).state;
    state = dispatch(state, { type: 'verify', jobId, condition: 'movement' }).state;
    expect(state.jobs[0]?.status).toBe('ready');
    state = dispatch(state, { type: 'power', jobId, on: false }).state;
    state = dispatch(state, { type: 'verify', jobId, condition: 'movement' }).state;
    expect(state.jobs[0]?.verified).toEqual([]);
    expect(state.jobs[0]?.status).toBe('active');
    const before = state.cash;
    expect(dispatch(state, { type: 'deliver', jobId }).ok).toBe(false);
    expect(state.cash).toBe(before);
  });
  it('keeps the agreed lesson promise when an attended step finishes exactly at its deadline', () => {
    let state = dispatch(createGame(42), { type: 'watch', enabled: true }).state;
    const until = state.watchUntil;
    state = dispatch(state, { type: 'wait', minutes: 75 }).state;
    attend(state);
    state = dispatch(state, {
      type: 'verify',
      jobId: state.selectedJobId,
      condition: 'movement',
    }).state;
    expect(state.now).toBe(until);
    expect(state.jobs[0]?.evidence.at(-1)?.witnessedBy).toContain('sam');
    expect(
      state.people.sam?.agenda.commitments.find(
        (c) => c.actions.includes('complete-lesson') && c.until === until,
      )?.status,
    ).toBe('kept');
    expect(state.watching).toBe(false);
    expect(
      state.log.filter((e) => e.text.includes('agreed learning session has ended')),
    ).toHaveLength(1);
  });
  it.each(['help', 'unavailable'] as const)(
    'cancelling a queued retry preserves its previous %s block',
    (kind) => {
      let state = createGame(42);
      const jobId = state.selectedJobId;
      state = dispatch(state, { type: 'assign', jobId, personId: 'sam' }).state;
      state = dispatch(state, { type: 'wait', minutes: 11 }).state;
      const blocked = state.jobs[0]?.blocked;
      if (!blocked) throw new Error('Missing block');
      blocked.kind = kind;
      const original = structuredClone(blocked);
      state = dispatch(state, { type: 'retry-sam', jobId }).state;
      expect(state.pendingRequest?.kind).toBe('repair');
      expect(state.jobs[0]?.blocked).toEqual(original);
      state = dispatch(state, { type: 'cancel-request' }).state;
      expect(state.pendingRequest).toBeUndefined();
      expect(state.jobs[0]?.blocked).toEqual(original);
    },
  );
  it('reports explicitly when offering a repair ends the active lesson', () => {
    let state = dispatch(createGame(42), { type: 'watch', enabled: true }).state;
    const until = state.watchUntil;
    state = dispatch(state, { type: 'assign', jobId: state.selectedJobId, personId: 'sam' }).state;
    expect(state.watching).toBe(false);
    expect(
      state.log.some(
        (e) => e.text === 'We are ending the lesson so I can consider this repair offer.',
      ),
    ).toBe(true);
    expect(
      state.people.sam?.agenda.commitments.find(
        (c) => c.actions.includes('complete-lesson') && c.until === until,
      )?.status,
    ).toBe('released');
  });
});
