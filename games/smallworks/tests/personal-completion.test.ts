import { describe, expect, it } from 'vitest';
import { createCommunityEvent, eventOptions } from '../src/game/community';
import { createGame, dispatch, loadGame, saveGame } from '../src/game/engine';
import { teachObserved } from '../src/game/people';
import { replayRecordedRun } from '../src/game/replay';
import type { Command, GameState } from '../src/game/types';
import { acceptRepairOffer } from './repair-offer';

function act(state: GameState, command: Command): GameState {
  const result = dispatch(state, command);
  expect(result.ok, result.message).toBe(true);
  return result.state;
}

describe('retained personal-project completion', () => {
  it('replays a real shared-project completion without turning it into a customer return', () => {
    let state = createGame(416);
    const theatre = state.jobs.find((j) => j.isPersonal);
    if (!theatre) throw new Error('Missing project');
    state = act(state, { type: 'watch', enabled: true });
    state = act(state, {
      type: 'calibrate',
      jobId: theatre.id,
      componentId: 'governor',
      setting: 1,
    });
    state = act(state, { type: 'verify', jobId: theatre.id, condition: 'load' });
    state = act(state, { type: 'watch', enabled: false });
    state = acceptRepairOffer(state, theatre.id);
    state = act(state, { type: 'wait', minutes: 10 });
    expect(state.jobs.find((j) => j.id === theatre.id)?.completedBy).toBe('sam');
    expect(state.jobs.find((j) => j.id === theatre.id)?.status).toBe('ready');
    expect(state.independentRepairs).toBe(0);
    expect(state.cash).toBe(24);
    expect(state.reputation).toBe(0);
    expect(
      replayRecordedRun(
        { seed: state.seed, inputs: state.inputs, provenance: state.provenance },
        saveGame(state),
      ),
    ).toMatchObject({ ok: true });
  });
  it('finishes accepted checked work through HF while retaining the theatre and its use', () => {
    let state = createGame(416);
    const sam = state.people.sam;
    const theatre = state.jobs.find((j) => j.isPersonal);
    if (!sam || !theatre) throw new Error('Missing workshop');
    const lessons = [
      [{ family: 'mechanical', stage: 'intake', 'requested-pace': '12' }, 'probe:motion:0:C:load'],
      [
        {
          family: 'mechanical',
          stage: 'measured',
          'requested-pace': '12',
          part: 'drive',
          signal: 'rotation',
        },
        'calibrate:governor:1',
      ],
      [
        {
          family: 'mechanical',
          stage: 'repaired',
          'requested-pace': '12',
          part: 'governor',
          signal: 'worked',
        },
        'verify:load',
      ],
    ] as const;
    for (const [index, [cues, action]] of lessons.entries())
      teachObserved(sam, 'prior', cues, action, `personal-control-${index}`, 'success', state.now);
    const cash = state.cash;
    const reputation = state.reputation;
    const jobCount = state.jobs.length;
    state = acceptRepairOffer(state, theatre.id);
    const goalId = state.jobs.find((j) => j.id === theatre.id)?.responsibility?.goalId;
    expect(
      state.people.sam?.agenda.commitments.some(
        (c) => c.targetId === theatre.id && c.actions.includes('deliver'),
      ),
    ).toBe(false);
    state = dispatch(state, { type: 'wait', minutes: 45 }).state;
    expect(state.npcWork.find((w) => w.personId === 'sam')?.option.action).toBe('complete-project');
    const snapshot = loadGame(saveGame(state));
    state = dispatch(state, { type: 'wait', minutes: 10 }).state;
    expect(saveGame(dispatch(snapshot, { type: 'wait', minutes: 10 }).state)).toBe(saveGame(state));
    const retained = state.jobs.find((j) => j.id === theatre.id);
    expect(retained?.status).toBe('ready');
    expect(retained?.completedBy).toBe('sam');
    expect(retained?.assignedTo).toBeUndefined();
    expect(state.people.sam?.agenda.goals.find((g) => g.id === goalId)?.status).toBe('achieved');
    expect(state.cash).toBe(cash);
    expect(state.reputation).toBe(reputation);
    expect(state.jobs).toHaveLength(jobCount);
    expect(state.independentRepairs).toBe(0);
    expect(
      eventOptions(state, createCommunityEvent()).find((f) => f.format === 'theatre')?.ready,
    ).toBe(true);
    expect(saveGame(loadGame(saveGame(state)))).toBe(saveGame(state));
    const goalCount = state.people.sam?.agenda.goals.length;
    state = dispatch(state, { type: 'assign', jobId: theatre.id, personId: 'sam' }).state;
    if (state.pendingRequest) state = dispatch(state, { type: 'wait', minutes: 45 }).state;
    expect(state.jobs.find((j) => j.id === theatre.id)?.assignedTo).toBeUndefined();
    expect(state.people.sam?.agenda.goals.length).toBe(goalCount);
    expect(
      state.jobs
        .find((j) => j.id === theatre.id)
        ?.contributions.filter((c) => c.action === 'complete-project'),
    ).toHaveLength(1);
    state = dispatch(state, {
      type: 'calibrate',
      jobId: theatre.id,
      componentId: 'governor',
      setting: 2,
    }).state;
    state = acceptRepairOffer(state, theatre.id);
    expect(state.jobs.find((j) => j.id === theatre.id)?.assignedTo).toBe('sam');
    expect(state.jobs.find((j) => j.id === theatre.id)?.responsibility?.goalId).not.toBe(goalId);
    expect(state.independentRepairs).toBe(0);
    expect(saveGame(loadGame(saveGame(state)))).toBe(saveGame(state));
  });
});
