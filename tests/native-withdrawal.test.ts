import { AGENDA_DEFAULTS, abandonGoal, adoptGoal } from '@adam0white/human-framework';
import { describe, expect, it } from 'vitest';
import { createGame, dispatch, loadGame, saveGame } from '../src/game/engine';
import { chooseActivity, promiseJob, startActivity } from '../src/game/people';
import { replayRecordedRun } from '../src/game/replay';
import { adoptResponsibility } from '../src/game/responsibility';
import type { Command, GameState, WorkOption } from '../src/game/types';

function act(state: GameState, command: Command): GameState {
  const result = dispatch(state, command);
  expect(result.ok, result.message).toBe(true);
  return result.state;
}

describe('native responsibility withdrawal', () => {
  it('isolated history-capacity control removes only a pruned completed-job handle', () => {
    let state = createGame(42);
    const jobId = state.selectedJobId;
    for (const command of [
      { type: 'watch', enabled: true },
      { type: 'work', jobId, componentId: 'switch', intervention: 'replace' },
      { type: 'verify', jobId, condition: 'movement' },
      { type: 'watch', enabled: false },
      { type: 'assign', jobId, personId: 'sam' },
      { type: 'wait', minutes: 60 },
    ] satisfies Command[])
      state = act(state, command);
    const completed = state.jobs.find((job) => job.id === jobId);
    const sam = state.people.sam;
    if (!completed?.responsibility || !sam) throw new Error('Missing completed native purpose');
    const goalId = completed.responsibility.goalId;
    expect(completed.status).toBe('delivered');
    expect(sam.agenda.goals.find((goal) => goal.id === goalId)?.status).toBe('achieved');
    state = act(state, { type: 'wait', minutes: 60 });
    expect(state.jobs.find((job) => job.id === jobId)?.responsibility?.goalId).toBe(goalId);
    const person = state.people.sam;
    if (!person) throw new Error('Missing learner');
    for (let index = 0; index <= AGENDA_DEFAULTS.maxClosedGoals; index++) {
      const goal = adoptGoal(
        person,
        {
          label: `Isolated history ${index}`,
          serves: ['achievement'],
          importance: 0.2,
          advancedBy: [],
        },
        state.now,
      );
      abandonGoal(person, goal.id);
    }
    state = act(state, { type: 'wait', minutes: 60 });
    expect(state.people.sam?.agenda.goals.some((goal) => goal.id === goalId)).toBe(false);
    expect(state.jobs.find((job) => job.id === jobId)?.responsibility).toBeUndefined();
    expect(state.jobs.find((job) => job.id === jobId)?.status).toBe('delivered');
    expect(saveGame(loadGame(saveGame(state)))).toBe(saveGame(state));
  });
  it('returns naturally neglected work to the player and preserves save and input replay', () => {
    let state = createGame(416);
    const theatre = state.jobs.find((job) => job.isPersonal);
    if (!theatre) throw new Error('Missing personal project');
    state = act(state, { type: 'assign', jobId: theatre.id, personId: 'sam' });
    const goalId = state.jobs.find((job) => job.id === theatre.id)?.responsibility?.goalId;
    state = act(state, { type: 'wait', minutes: 11 });
    while (state.day < 10) {
      if (state.ended) state = act(state, { type: 'continue' });
      state = act(state, { type: 'next-day' });
    }
    const held = state.jobs.find((job) => job.id === theatre.id);
    expect(state.people.sam?.agenda.goals.find((goal) => goal.id === goalId)?.status).toBe(
      'abandoned',
    );
    expect(held?.assignedTo).toBeUndefined();
    expect(held?.responsibility).toBeUndefined();
    expect(held?.blocked).toBeUndefined();
    expect(held?.due).toBe(theatre.due);
    expect(state.log.some((entry) => entry.text.includes('back on the bench'))).toBe(true);
    expect(saveGame(loadGame(saveGame(state)))).toBe(saveGame(state));
    expect(
      replayRecordedRun(
        { seed: state.seed, inputs: state.inputs, provenance: state.provenance },
        saveGame(state),
      ),
    ).toMatchObject({ ok: true });
    state = act(state, { type: 'inspect', jobId: theatre.id, componentId: 'governor' });
    expect(state.jobs.find((job) => job.id === theatre.id)?.assignedTo).toBeUndefined();
  });

  it.each(['replace:switch', 'rest'])(
    'isolated withdrawal during %s returns only job reservations and preserves unrelated activity',
    (action) => {
      let state = createGame(42);
      const job = state.jobs[0];
      const sam = state.people.sam;
      if (!job || !sam) throw new Error('Missing workshop');
      job.assignedTo = sam.id;
      job.responsibility = adoptResponsibility(sam, job.id, state.now);
      promiseJob(sam, job.id, job.due, state.now);
      const option: WorkOption = {
        id: action,
        action,
        label: 'Controlled in-progress activity',
        duration: 30,
        effort: 0,
      };
      chooseActivity(sam, action === 'rest' ? 'ordinary-day' : job.id, {}, [option], state.now);
      expect(startActivity(sam, option, state.now)).toBe(true);
      if (action === 'replace:switch') {
        state.stock.switch = (state.stock.switch ?? 0) - 1;
        state.npcWork.push({
          personId: sam.id,
          jobId: job.id,
          option,
          startedAt: state.now,
          endsAt: state.now + 30,
          reservedPart: 'switch',
        });
      } else {
        job.blocked = { at: state.now, kind: 'help', reason: 'Controlled blocked responsibility' };
        state.npcWork.push({
          personId: sam.id,
          option,
          startedAt: state.now,
          endsAt: state.now + 30,
        });
      }
      state = loadGame(saveGame(state));
      const restoredJob = state.jobs[0];
      const restoredSam = state.people.sam;
      if (!restoredJob?.responsibility || !restoredSam)
        throw new Error('Missing saved responsibility');
      const goalId = restoredJob.responsibility.goalId;
      const acquiredMethods = structuredClone(restoredSam.methods);
      abandonGoal(restoredSam, goalId);
      state = act(state, { type: 'wait', minutes: 1 });
      expect(state.jobs[0]?.assignedTo).toBeUndefined();
      expect(state.jobs[0]?.due).toBe(job.due);
      expect(state.stock.switch).toBe(1);
      expect(state.people.sam?.agenda.goals.find((goal) => goal.id === goalId)?.status).toBe(
        'abandoned',
      );
      expect(state.people.sam?.methods).toEqual(acquiredMethods);
      expect(
        state.people.sam?.agenda.commitments.find(
          (commitment) => commitment.targetId === job.id && commitment.actions.includes('deliver'),
        )?.status,
      ).toBe('released');
      expect(state.npcWork.some((work) => work.jobId === job.id)).toBe(false);
      if (action === 'rest') {
        expect(state.people.sam?.activity?.action).toBe('rest');
        expect(state.npcWork.find((work) => work.personId === 'sam')?.endsAt).toBe(570);
      }
      state = act(state, { type: 'wait', minutes: 1 });
      expect(state.stock.switch).toBe(1);
      expect(saveGame(loadGame(saveGame(state)))).toBe(saveGame(state));
    },
  );
});
