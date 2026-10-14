import { methodEvidence, receiveMethodCues } from '@adam0white/human-framework';
import { describe, expect, it } from 'vitest';
import { createGame, dispatch, loadGame, saveGame } from '../src/game/engine';
import { createPeople, teachObserved } from '../src/game/people';
import type { Command, GameState } from '../src/game/types';
import { acceptRepairOffer } from './repair-offer';

function act(state: GameState, command: Command): GameState {
  const result = dispatch(state, command);
  expect(result.ok, `${command.type}: ${result.message}`).toBe(true);
  return result.state;
}
function lesson(state: GameState): GameState {
  for (let i = 0; i < 12 && !state.watching; i++) {
    if (!state.pendingRequest) state = act(state, { type: 'watch', enabled: true });
    if (state.pendingRequest?.status === 'ready') state = act(state, { type: 'start-lesson' });
    if (state.watching) break;
    const activity = state.npcWork.find((work) => work.personId === 'sam');
    if (!activity) break;
    state = act(state, { type: 'wait', minutes: activity.endsAt - state.now });
  }
  expect(state.watching).toBe(true);
  return state;
}
function attendedTransfer(attended: boolean, procedure: 'verify' | 'probe' | 'inspect') {
  let state = createGame(416);
  const source = state.jobs.find((job) => job.isPersonal);
  if (!source) throw new Error('Missing personal theatre');
  if (attended) state = lesson(state);
  state = act(
    state,
    procedure === 'verify'
      ? { type: 'verify', jobId: source.id, condition: 'load' }
      : procedure === 'inspect'
        ? { type: 'inspect', jobId: source.id, componentId: 'gear' }
        : {
            type: 'measure',
            jobId: source.id,
            request: { mode: 'motion', a: '0', b: 'C', condition: 'load' },
          },
  );
  state = act(state, { type: 'next-day' });
  const target = state.jobs.find((job) => job.title === 'Nora’s keepsake music box');
  if (!target) throw new Error('Missing fresh music box');
  expect(source.model.desiredRPM ?? 15).not.toBe(target.model.desiredRPM ?? 15);
  expect(target.evidence).toHaveLength(0);
  state = act(state, { type: 'accept', jobId: target.id });
  const before = saveGame(state);
  const transfer = (input: GameState) => {
    let result = acceptRepairOffer(input, target.id);
    result = act(result, { type: 'wait', minutes: 76 });
    return result;
  };
  state = transfer(state);
  expect(saveGame(transfer(loadGame(before)))).toBe(saveGame(state));
  return state.jobs.find((job) => job.id === target.id);
}

describe('public requested pace and observed procedure scope', () => {
  it.each(['verify', 'probe', 'inspect'] as const)(
    'transfers an actually attended %s procedure across requested paces',
    (procedure) => {
      const trained = attendedTransfer(true, procedure);
      const withheld = attendedTransfer(false, procedure);
      const observations = trained?.evidence.filter((entry) => entry.actorId === 'sam') ?? [];
      expect(observations.length).toBeGreaterThan(0);
      if (procedure === 'verify')
        expect(
          observations.some((entry) => entry.kind === 'use' && entry.condition === 'load'),
        ).toBe(true);
      else if (procedure === 'inspect')
        expect(
          observations.some((entry) => entry.kind === 'inspection' && entry.componentId === 'gear'),
        ).toBe(true);
      else
        expect(
          observations.some(
            (entry) =>
              entry.request?.mode === 'motion' &&
              entry.request.a === '0' &&
              entry.request.b === 'C',
          ),
        ).toBe(true);
      expect(trained?.contributions.every((entry) => entry.actorId === 'sam')).toBe(true);
      expect(withheld?.evidence.filter((entry) => entry.actorId === 'sam')).toHaveLength(0);
      expect(withheld?.blocked?.kind).toBe('help');
    },
  );

  // Adapter scope controls: synthetic received cues isolate matching semantics.
  // They are not evidence of an attended complete autonomous repair.
  it.each(['inspect:gear', 'measure:gear:load', 'replace:gear', 'clean:gear', 'adjust:gear'])(
    'keeps sensory conditions but does not bind %s to numeric pace',
    (action) => {
      const person = createPeople(416, 600).sam;
      if (!person) throw new Error('Missing Sam');
      const cues = {
        family: 'mechanical',
        stage: 'measured',
        part: 'gear',
        signal: 'slow-drive',
        'observed-span': 'motion:A:B:bench+load',
        'comparison-load': 'lower-than-bench',
        'requested-pace': '15',
      };
      expect(teachObserved(person, 'source', cues, action, 'demo', 'success', 600)).toBe(true);
      const support = (changed: Record<string, string>) => {
        receiveMethodCues(person, {
          contextId: 'target',
          cues: Object.entries({ ...cues, ...changed }).map(([cue, value]) => ({ cue, value })),
        });
        return methodEvidence(person, action, 'target').support;
      };
      expect(support({ 'requested-pace': '18' })).toBeGreaterThan(0);
      expect(support({ 'requested-pace': '18', 'comparison-load': 'equal-than-bench' })).toBe(0);
    },
  );

  it('keeps fixed governor settings bounded by the observed requested pace', () => {
    const person = createPeople(416, 600).sam;
    if (!person) throw new Error('Missing Sam');
    const cues = {
      family: 'mechanical',
      stage: 'measured',
      signal: 'slow-drive',
      'requested-pace': '15',
    };
    teachObserved(person, 'source', cues, 'calibrate:governor:2', 'demo', 'success', 600);
    for (const pace of ['15', '18']) {
      receiveMethodCues(person, {
        contextId: 'target',
        cues: Object.entries({ ...cues, 'requested-pace': pace }).map(([cue, value]) => ({
          cue,
          value,
        })),
      });
      const support = methodEvidence(person, 'calibrate:governor:2', 'target').support;
      if (pace === '15') expect(support).toBeGreaterThan(0);
      else expect(support).toBe(0);
    }
  });
});
