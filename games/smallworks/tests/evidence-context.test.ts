import { describe, expect, it } from 'vitest';
import { createGame, dispatch } from '../src/game/engine';
import { evidenceContext } from '../src/game/evidence-context';
import { measure } from '../src/game/model';
import { chooseActivity } from '../src/game/people';
import type { Evidence, GameState, Job, MeasurementRequest, WorkOption } from '../src/game/types';
import { readyToLearn, restore, snapshot } from './hf-fixture';

function job(): Job {
  const result = createGame(42).jobs[0];
  if (!result) throw new Error('Missing job');
  return structuredClone(result);
}

function reading(
  target: Job,
  id: number,
  condition: MeasurementRequest['condition'],
  extra: Partial<Evidence> = {},
): Evidence {
  const request: MeasurementRequest = { mode: 'voltage', a: 'B', b: 'C', condition };
  const observation = measure(target.model, request);
  return {
    ...observation,
    id,
    at: 600 + id,
    kind: 'measurement',
    componentId: 'switch',
    request,
    actorId: 'player',
    witnessedBy: ['sam'],
    ...extra,
  };
}

describe('received measurement comparisons', () => {
  it('uses the public object and requested use only for intake and examination', () => {
    const target = job();
    target.requiredConditions = ['load'];
    const intake = evidenceContext(target, 'sam');
    expect(intake['requested-use']).toBe('lantern:load');
    for (const component of target.model.components) component.condition = 'good';
    target.status = 'ready';
    target.verified = ['load'];
    expect(evidenceContext(target, 'sam')).toEqual(intake);
    target.evidence = [
      {
        id: 1,
        at: 600,
        kind: 'inspection',
        actorId: 'sam',
        componentId: 'switch',
        summary: 'The exterior looks intact.',
        cues: { part: 'switch', signal: 'intact' },
      },
    ];
    expect(evidenceContext(target, 'sam')).toMatchObject({
      stage: 'examined',
      'requested-use': 'lantern:load',
    });
    target.evidence.push(reading(target, 2, 'load', { actorId: 'sam' }));
    const measured = evidenceContext(target, 'sam');
    expect(measured.stage).toBe('measured');
    expect(measured['requested-use']).toBeUndefined();
    expect(Object.keys(measured).length).toBeLessThanOrEqual(8);
    // Someone who received none of those observations still has only the public intake brief.
    expect(evidenceContext(target, 'nora')).toEqual(intake);
  });
  it('does not disclose a host verification to an actor who did not observe it', () => {
    const target = job();
    target.status = 'ready';
    target.verified = ['movement'];
    target.evidence = [
      {
        id: 1,
        at: 600,
        kind: 'use',
        condition: 'movement',
        actorId: 'player',
        summary: 'The carried light stays steady.',
        cues: { signal: 'steady-output' },
      },
    ];
    expect(evidenceContext(target, 'sam').stage).toBe('intake');
    expect(evidenceContext(target, 'player').stage).toBe('ready');
    const observed = target.evidence[0];
    if (!observed) throw new Error('Missing test observation');
    observed.witnessedBy = ['sam'];
    expect(evidenceContext(target, 'sam').stage).toBe('ready');
    target.evidence.push({
      id: 2,
      at: 615,
      kind: 'use',
      condition: 'movement',
      actorId: 'sam',
      summary: 'The carried light goes dark.',
      cues: { signal: 'no-output' },
    });
    expect(evidenceContext(target, 'sam').stage).toBe('measured');
  });
  it('retains the actual contrast when the latest reading is normal, in either order', () => {
    const target = job();
    const bench = reading(target, 1, 'bench');
    const movement = reading(target, 2, 'movement');
    target.evidence = [bench, movement];
    const forward = evidenceContext(target, 'sam');
    target.evidence = [
      { ...movement, id: 1 },
      { ...bench, id: 2 },
    ];
    expect(evidenceContext(target, 'sam')).toEqual(forward);
    expect(forward).toMatchObject({
      part: 'switch',
      signal: 'voltage',
      'observed-span': 'voltage:B:C:bench+movement',
      'comparison-movement': 'higher-than-bench',
    });
    target.evidence.reverse();
    expect(evidenceContext(target, 'sam')).toEqual(forward);
  });

  it('uses own readings or witnessed readings, never another actor’s unobserved reading', () => {
    const target = job();
    target.evidence = [
      reading(target, 1, 'bench'),
      reading(target, 2, 'movement', { witnessedBy: [] }),
    ];
    expect(evidenceContext(target, 'sam')['comparison-movement']).toBeUndefined();
    expect(evidenceContext(target, 'player')['comparison-movement']).toBe('higher-than-bench');
    target.evidence[1] = reading(target, 2, 'movement', { witnessedBy: [], actorId: 'sam' });
    expect(evidenceContext(target, 'sam')['comparison-movement']).toBe('higher-than-bench');
    expect(evidenceContext(target, 'nora')).toEqual({
      family: 'electrical',
      stage: 'intake',
      'requested-use': 'lantern:movement',
    });
  });

  it('invalidates old comparisons after any work, including work the actor did not see', () => {
    const target = job();
    target.evidence = [reading(target, 1, 'bench'), reading(target, 2, 'movement')];
    target.evidence.push({
      id: 3,
      at: 630,
      kind: 'work',
      actorId: 'player',
      componentId: 'contact',
      summary: 'Worked on contact',
      cues: { part: 'contact', signal: 'worked' },
    });
    expect(evidenceContext(target, 'sam')).toEqual({
      family: 'electrical',
      stage: 'intake',
      'requested-use': 'lantern:movement',
    });
    expect(evidenceContext(target, 'player').stage).toBe('repaired');
    target.evidence.push(reading(target, 4, 'movement'));
    expect(evidenceContext(target, 'sam')['comparison-movement']).toBeUndefined();
    target.evidence.push(reading(target, 5, 'bench'));
    expect(evidenceContext(target, 'sam')['comparison-movement']).toBe('higher-than-bench');
  });

  it('requires the same component, probe span, mode and unit', () => {
    for (const change of [
      { componentId: 'contact' },
      { request: { mode: 'voltage' as const, a: 'C', b: 'D', condition: 'movement' as const } },
      { request: { mode: 'continuity' as const, a: 'B', b: 'C', condition: 'movement' as const } },
      { unit: 'Ω' },
      { value: null },
      { value: Number.NaN },
      { cues: { part: 'switch', signal: 'invalid' } },
      { cues: { part: 'switch', signal: 'power-off' } },
    ]) {
      const target = job();
      target.evidence = [reading(target, 1, 'bench'), reading(target, 2, 'movement', change)];
      expect(evidenceContext(target, 'sam')['comparison-movement']).toBeUndefined();
    }
  });

  it('treats reversed probe polarity as the same magnitude comparison and stays bounded', () => {
    const target = job();
    target.kind = 'music-box';
    target.evidence = [
      reading(target, 1, 'bench'),
      reading(target, 2, 'movement', {
        value: -6,
        request: { mode: 'voltage', a: 'C', b: 'B', condition: 'movement' },
      }),
      reading(target, 3, 'load'),
    ];
    const context = evidenceContext(target, 'sam');
    expect(context['comparison-movement']).toBe('higher-than-bench');
    expect(context['comparison-load']).toBe('higher-than-bench');
    expect(Object.keys(context)).toHaveLength(8);
    const before = evidenceContext(target, 'sam');
    for (const component of target.model.components) component.condition = 'good';
    expect(evidenceContext(target, 'sam')).toEqual(before);
  });
});

function learningGame(): GameState {
  const state = createGame(42);
  readyToLearn(state.people.sam!);
  return state;
}
function attend(state: GameState): void {
  expect(state.watching).toBe(true);
}

describe('command demonstrations with controlled observer availability', () => {
  it.each([
    ['bench', 'movement'],
    ['movement', 'bench'],
  ] as const)('learns a matching contrast in %s then %s order', (first, second) => {
    let state = dispatch(learningGame(), { type: 'watch', enabled: true }).state;
    const jobId = state.selectedJobId;
    const probe = (condition: MeasurementRequest['condition']) => {
      attend(state);
      state = dispatch(state, {
        type: 'measure',
        jobId,
        request: { mode: 'voltage', a: 'B', b: 'C', condition },
      }).state;
    };
    probe(first);
    probe(second);
    attend(state);
    state = dispatch(state, {
      type: 'work',
      jobId,
      componentId: 'switch',
      intervention: 'replace',
    }).state;
    probe('movement');
    const sam = state.people.sam;
    if (!sam) throw new Error('Missing Sam');
    const rule = sam.methods?.rules.find((r) => r.action === 'replace:switch');
    expect(rule?.evidence.at(-1)?.outcome).toBe('success');
    expect(rule?.conditions).toContainEqual({
      cue: 'comparison-movement',
      value: 'higher-than-bench',
    });
    const options: WorkOption[] = ['replace:switch', 'clean:switch', 'ask-help'].map((action) => ({
      id: action,
      action,
      label: action,
      duration: 10,
      effort: 0.15,
    }));
    const choose = (target: Job) =>
      chooseActivity(
        restore(snapshot(sam)),
        target.id,
        evidenceContext(target, 'sam'),
        options,
        sam.now,
      ).chosenId;
    const transfer = job();
    transfer.id = 'new-object';
    transfer.evidence = [reading(transfer, 1, 'bench'), reading(transfer, 2, 'movement')];
    expect(choose(transfer)).toBe('replace:switch');
    transfer.evidence = [reading(transfer, 1, 'bench')];
    expect(choose(transfer)).toBe('ask-help');
    transfer.evidence = [
      reading(transfer, 1, 'bench'),
      reading(transfer, 2, 'movement', { witnessedBy: [] }),
    ];
    expect(choose(transfer)).toBe('ask-help');
    for (const component of transfer.model.components)
      component.condition = component.id === 'switch' ? 'dirty' : 'good';
    transfer.evidence = [reading(transfer, 1, 'bench'), reading(transfer, 2, 'movement')];
    expect(evidenceContext(transfer, 'sam')['comparison-movement']).toBe('equal-than-bench');
    expect(choose(transfer)).toBe('ask-help');
  });
});
