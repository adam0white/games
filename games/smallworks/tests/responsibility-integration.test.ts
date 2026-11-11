import { describe, expect, it } from 'vitest';
import { createGame, dispatch, loadGame, saveGame } from '../src/game/engine';
import { promise } from '../src/game/hf';
import { chooseActivity, finishActivity, startActivity, teachObserved } from '../src/game/people';
import { MASTERY_LABEL } from '../src/game/responsibility';
import type { GameState } from '../src/game/types';
import { native, reAuthor, readyToLearn } from './hf-fixture';
import { acceptRepairOffer } from './repair-offer';

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Missing fixture');
  return value;
}

function sam(state: GameState) {
  const person = state.people.sam;
  if (!person) throw new Error('Missing Sam');
  return person;
}
function nativePurpose(state: GameState) {
  const handle = state.jobs[0]?.responsibility;
  if (!handle) throw new Error('Missing responsibility');
  const goal = sam(state).agenda.goals.find((candidate) => candidate.id === handle.goalId);
  if (!goal) throw new Error('Missing native goal');
  return goal;
}

describe('native responsibility integration', () => {
  it('accepts through an actual native choice and one minute of receiving, with no expertise or progress credit', () => {
    const initial = createGame(42);
    const state = dispatch(initial, {
      type: 'assign',
      jobId: initial.selectedJobId,
      personId: 'sam',
    }).state;
    expect(state.now).toBe(initial.now);
    expect(state.jobs[0]?.assignedTo).toBe('sam');
    expect(sam(state).trace.at(-1)?.chosenAction).toBe('accept-repair');
    expect(sam(state).activity?.action).toBe('accept-repair');
    expect(state.npcWork.find((work) => work.personId === 'sam')?.endsAt).toBe(state.now + 1);
    expect(sam(state).methods?.rules ?? []).toEqual([]);
    expect(nativePurpose(state).progress).toBe(0);
    expect(saveGame(loadGame(saveGame(state)))).toBe(saveGame(state));
    const received = dispatch(state, { type: 'wait', minutes: 1 }).state;
    expect(
      native(sam(received)).memory.expectations.find(
        (outcome) => outcome.key === 'accept-repair@ordinary-day',
      )?.needs.competence,
    ).toBe(0);
    expect(received.jobs[0]?.contributions).toEqual([
      { actorId: 'sam', action: 'intake', at: received.now },
    ]);
    expect(sam(received).activity?.action).toBe('ask-help');
    expect(nativePurpose(received).progress).toBe(0);
  });

  it.each(['food', 'water', 'promise'] as const)(
    'declines under urgent %s without adopting responsibility or a delivery promise',
    (pressure) => {
      const state = createGame(42);
      const person = sam(state);
      if (pressure === 'food')
        reAuthor(person, { body: { satiety: 0.1 } as Parameters<typeof reAuthor>[1]['body'] });
      if (pressure === 'water')
        reAuthor(person, { body: { hydration: 0.1 } as Parameters<typeof reAuthor>[1]['body'] });
      if (pressure === 'promise')
        promise(person, {
          kind: 'promise',
          label: 'A promise I already made',
          actions: ['personal'],
          from: state.now,
          until: state.now + 30,
          importance: 1,
        });
      const result = dispatch(state, {
        type: 'assign',
        jobId: state.selectedJobId,
        personId: 'sam',
      });
      expect(result.state.jobs[0]?.assignedTo).toBeUndefined();
      expect(result.state.jobs[0]?.responsibility).toBeUndefined();
      expect(result.message).toContain('declined');
      expect(
        sam(result.state).agenda.commitments.some(
          (commitment) =>
            commitment.targetId === state.selectedJobId && commitment.actions.includes('deliver'),
        ),
      ).toBe(false);
      expect(sam(result.state).activity?.action).toBe(
        pressure === 'food' ? 'eat' : pressure === 'water' ? 'drink' : 'personal',
      );
      expect(saveGame(loadGame(saveGame(result.state)))).toBe(saveGame(result.state));
    },
  );

  it('retains purpose across blocked overnight work and caps repeated help without claiming mastery', () => {
    const initial = createGame(42);
    let state = acceptRepairOffer(initial, initial.selectedJobId);
    state = dispatch(state, { type: 'wait', minutes: 10 }).state;
    expect(state.jobs[0]?.blocked?.kind).toBe('help');
    expect(nativePurpose(state).progress).toBe(0.1);
    const handle = structuredClone(state.jobs[0]?.responsibility);
    const replay = loadGame(saveGame(state));
    for (let retry = 0; retry < 4; retry++) {
      state = dispatch(state, { type: 'retry-sam', jobId: state.selectedJobId }).state;
      state = dispatch(state, { type: 'wait', minutes: 45 }).state;
    }
    expect(nativePurpose(state).progress).toBe(0.1);
    expect(sam(state).agenda.goals.find((goal) => goal.label === MASTERY_LABEL)?.progress).toBe(0);
    const morning = dispatch(replay, { type: 'next-day' }).state;
    expect(morning.jobs[0]?.responsibility).toEqual(handle);
    expect(nativePurpose(morning).status).toBe('active');
    expect(saveGame(loadGame(saveGame(morning)))).toBe(saveGame(morning));
    const recalled = dispatch(morning, { type: 'recall', jobId: morning.selectedJobId }).state;
    expect(recalled.jobs[0]?.responsibility).toBeUndefined();
    expect(sam(recalled).agenda.goals.find((goal) => goal.id === handle?.goalId)?.status).toBe(
      'abandoned',
    );
  });

  it('allows an aspiration despite full competence but never treats accepting or observing as mastery', () => {
    const state = createGame(42);
    const person = sam(state);
    readyToLearn(person, 1);
    const accepted = dispatch(state, {
      type: 'assign',
      jobId: state.selectedJobId,
      personId: 'sam',
    }).state;
    expect(accepted.jobs[0]?.assignedTo).toBe('sam');
    const p = sam(accepted);
    // Isolate an actual completed observation; no demonstration is supplied here.
    finishActivity(
      p,
      { id: 'accept-repair', action: 'accept-repair', label: 'accept', duration: 1, effort: 0 },
      true,
      p.now + 1,
    );
    const observe = { id: 'observe', action: 'observe', label: 'Watch', duration: 10, effort: 0 };
    chooseActivity(p, 'lesson', {}, [observe], p.now);
    expect(startActivity(p, observe, p.now)).toBe(true);
    finishActivity(p, observe, true, p.now + 10);
    expect(p.agenda.goals.find((goal) => goal.label === MASTERY_LABEL)?.progress).toBe(0);
    expect(p.methods?.rules ?? []).toEqual([]);
  });

  it('completes both native purposes only after an independently diagnosed repaired checked delivery', () => {
    let state = createGame(42);
    const person = sam(state);
    const lessons = [
      [{ family: 'electrical', stage: 'intake' }, 'inspect:switch'],
      [
        { family: 'electrical', stage: 'examined', part: 'switch', signal: 'intact' },
        'measure:switch:movement',
      ],
      [
        { family: 'electrical', stage: 'measured', part: 'switch', signal: 'high-drop' },
        'replace:switch',
      ],
      [
        { family: 'electrical', stage: 'repaired', part: 'switch', signal: 'worked' },
        'verify:movement',
      ],
    ] as const;
    required(state.jobs[0]).requiredConditions = ['movement'];
    for (const [index, [cues, action]] of lessons.entries())
      teachObserved(person, 'prior', cues, action, `prior-${index}`, 'success', state.now);
    state = acceptRepairOffer(state, state.selectedJobId);
    state = dispatch(state, { type: 'wait', minutes: 75 }).state;
    expect(state.independentRepairs).toBe(1);
    expect(state.jobs[0]?.status).toBe('delivered');
    expect(nativePurpose(state).status).toBe('achieved');
    expect(sam(state).agenda.goals.find((goal) => goal.label === MASTERY_LABEL)?.status).toBe(
      'achieved',
    );
    expect(saveGame(loadGame(saveGame(state)))).toBe(saveGame(state));
  });

  it('rejects orphan, copied job and altered native goal handles', () => {
    const initial = createGame(42);
    const state = dispatch(initial, {
      type: 'assign',
      jobId: initial.selectedJobId,
      personId: 'sam',
    }).state;
    for (const mutate of [
      (saved: GameState) => {
        required(required(saved.jobs[0]).responsibility).jobId = 'other';
      },
      (saved: GameState) => {
        required(required(saved.jobs[0]).responsibility).goalId = 'missing';
      },
      (saved: GameState) => {
        required(saved.jobs[0]).responsibility = undefined;
      },
      (saved: GameState) => {
        required(saved.jobs[1]).responsibility = required(saved.jobs[0]).responsibility;
      },
      (saved: GameState) => {
        required(
          required(saved.people.sam).agenda.goals.find(
            (goal) => goal.id === required(required(saved.jobs[0]).responsibility).goalId,
          ),
        ).progress = 0.9;
      },
    ]) {
      const saved = JSON.parse(saveGame(state));
      mutate(saved);
      expect(() => loadGame(JSON.stringify(saved))).toThrow('invalid');
    }
  });
});
