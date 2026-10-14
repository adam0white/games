import { describe, expect, it } from 'vitest';
import { createGame, dispatch } from '../src/game/engine';
import { createModel } from '../src/game/model';
import type { Command, GameState } from '../src/game/types';

function act(state: GameState, command: Command): GameState {
  const result = dispatch(state, command);
  expect(result.ok, `${command.type}: ${result.message}`).toBe(true);
  return result.state;
}

function lesson(state: GameState): GameState {
  for (let attempt = 0; attempt < 12 && !state.watching; attempt++) {
    if (state.pendingRequest?.status === 'ready') state = act(state, { type: 'start-lesson' });
    else if (!state.pendingRequest) state = act(state, { type: 'watch', enabled: true });
    if (state.watching) break;
    const work = state.npcWork.find((activity) => activity.personId === 'sam');
    if (!work) break;
    state = act(state, { type: 'wait', minutes: work.endsAt - state.now });
  }
  expect(state.watching).toBe(true);
  return state;
}

function outcomes(state: GameState, action: string) {
  return (state.people.sam?.methods?.rules ?? [])
    .filter((rule) => rule.action === action)
    .flatMap((rule) => rule.evidence.map((evidence) => evidence.outcome));
}

describe('condition-specific observed intervention outcomes', () => {
  it('does not credit an ineffective clean for a bench pass after a carried-light failure', () => {
    let state = lesson(createGame(416));
    const jobId = state.selectedJobId;
    state = act(state, { type: 'verify', jobId, condition: 'movement' });
    state = act(state, { type: 'work', jobId, componentId: 'contact', intervention: 'clean' });
    state = act(state, { type: 'verify', jobId, condition: 'bench' });
    expect(state.jobs[0]?.evidence.at(-1)?.cues.signal).toBe('steady-output');
    expect(outcomes(state, 'clean:contact')).toHaveLength(0);
    expect(state.jobs[0]?.pendingLessons).toHaveLength(1);
    state = act(state, { type: 'verify', jobId, condition: 'movement' });
    expect(outcomes(state, 'clean:contact')).toEqual(['failure']);
    expect(state.jobs[0]?.verified).not.toContain('movement');
  });

  it('does not credit a bench pass against a movement measurement and waits for a local comparison', () => {
    let state = lesson(createGame(416));
    const jobId = state.selectedJobId;
    const request = { mode: 'voltage' as const, a: 'B', b: 'C', condition: 'movement' as const };
    state = act(state, { type: 'measure', jobId, request });
    state = act(state, { type: 'work', jobId, componentId: 'switch', intervention: 'adjust' });
    state = act(state, { type: 'verify', jobId, condition: 'bench' });
    expect(outcomes(state, 'adjust:switch')).toHaveLength(0);
    expect(state.jobs[0]?.pendingLessons).toHaveLength(1);
    state = act(state, { type: 'verify', jobId, condition: 'movement' });
    // A failed whole-object use check cannot isolate the measured component's outcome.
    expect(outcomes(state, 'adjust:switch')).toHaveLength(0);
    expect(state.jobs[0]?.pendingLessons).toHaveLength(1);
    state = act(state, { type: 'measure', jobId, request });
    expect(outcomes(state, 'adjust:switch')).toEqual(['failure']);
  });

  it('credits a restored pass under the same condition as the observed failure', () => {
    let state = lesson(createGame(416));
    const jobId = state.selectedJobId;
    state = act(state, { type: 'verify', jobId, condition: 'movement' });
    state = act(state, { type: 'work', jobId, componentId: 'switch', intervention: 'replace' });
    state = act(state, { type: 'verify', jobId, condition: 'movement' });
    expect(outcomes(state, 'replace:switch')).toEqual(['success']);
    expect(state.jobs[0]?.pendingLessons).toHaveLength(0);
  });

  it('retains a measured local improvement when a different fault still blocks use', () => {
    let state = createGame(416);
    const job = state.jobs[0];
    if (!job) throw new Error('Missing object');
    // Two physical causes isolate local attribution; the learner receives only actual observations.
    job.model = createModel('lantern', 416, [
      { componentId: 'contact', condition: 'dirty' },
      { componentId: 'switch', condition: 'worn' },
    ]);
    state = lesson(state);
    const request = { mode: 'voltage' as const, a: 'C', b: 'D', condition: 'bench' as const };
    state = act(state, { type: 'measure', jobId: job.id, request });
    state = act(state, {
      type: 'work',
      jobId: job.id,
      componentId: 'contact',
      intervention: 'clean',
    });
    state = act(state, { type: 'verify', jobId: job.id, condition: 'movement' });
    expect(outcomes(state, 'clean:contact')).toHaveLength(0);
    expect(state.jobs[0]?.pendingLessons).toHaveLength(1);
    state = act(state, { type: 'measure', jobId: job.id, request });
    expect(outcomes(state, 'clean:contact')).toEqual(['success']);
    expect(state.jobs[0]?.verified).not.toContain('movement');
  });

  it('requires the owner’s loaded-use check before resolving a calibration lesson', () => {
    let state = lesson(createGame(416));
    const theatre = state.jobs.find((job) => job.isPersonal);
    if (!theatre) throw new Error('Missing theatre');
    state = act(state, { type: 'verify', jobId: theatre.id, condition: 'bench' });
    state = act(state, {
      type: 'calibrate',
      jobId: theatre.id,
      componentId: 'governor',
      setting: 1,
    });
    state = act(state, { type: 'verify', jobId: theatre.id, condition: 'bench' });
    expect(outcomes(state, 'calibrate:governor:1')).toHaveLength(0);
    expect(state.jobs.find((job) => job.id === theatre.id)?.pendingLessons).toHaveLength(1);
    state = act(state, { type: 'verify', jobId: theatre.id, condition: 'load' });
    expect(outcomes(state, 'calibrate:governor:1')).toEqual(['success']);
  });
});
