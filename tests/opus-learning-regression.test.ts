import { describe, expect, it } from 'vitest';
import { createGame, dispatch } from '../src/game/engine';
import { createModel } from '../src/game/model';
import { chooseActivity, startActivity } from '../src/game/people';
import type { Command, GameState, WorkOption } from '../src/game/types';
import { acceptRepairOffer } from './repair-offer';

function act(state: GameState, command: Command): GameState {
  const result = dispatch(state, command);
  expect(result.ok, result.message).toBe(true);
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

/** This unit fixture isolates resolution/setup, not autonomous choice or teaching transfer. */
function npcStep(state: GameState, action: string): GameState {
  const job = state.jobs[0];
  const sam = state.people.sam;
  if (!job || !sam) throw new Error('Missing attribution fixture');
  expect(sam.activity).toBeFalsy();
  const option: WorkOption = { id: action, action, label: action, duration: 1, effort: 0 };
  chooseActivity(sam, job.id, {}, [option], state.now);
  expect(startActivity(sam, option, state.now)).toBe(true);
  job.assignedTo = 'sam';
  state.npcWork.push({
    personId: 'sam',
    jobId: job.id,
    option,
    startedAt: state.now,
    endsAt: state.now + 1,
  });
  return act(state, { type: 'wait', minutes: 1 });
}

describe('reviewed observation attribution and temporary meter setup', () => {
  it('cancels an older pending demonstration when Sam performs another intervention', () => {
    let state = createGame(416);
    const job = state.jobs[0];
    if (!job) throw new Error('Missing object');
    // An explicit pending-attribution fixture. No acquired rule or person state is fabricated.
    job.pendingLessons.push({
      observerId: 'sam',
      action: 'clean:contact',
      demonstrationId: 'prior-revision',
      cues: { family: 'electrical', stage: 'measured', part: 'contact', signal: 'high-drop' },
      baseline: {
        id: 100,
        at: state.now,
        kind: 'measurement',
        componentId: 'contact',
        summary: 'A prior contact reading',
        cues: { part: 'contact', signal: 'high-drop' },
        value: 2,
        unit: 'V',
        request: { mode: 'voltage', a: 'C', b: 'D', condition: 'movement' },
      },
    });
    state = npcStep(state, 'replace:switch');
    expect(state.jobs[0]?.pendingLessons).toHaveLength(0);
    expect(state.people.sam?.methods?.rules ?? []).toHaveLength(0);
  });

  it('resolves a bench-baselined lesson from the bench reading in a load-tester pair', () => {
    let state = createGame(416);
    const job = state.jobs[0];
    if (!job) throw new Error('Missing object');
    // Physical/instrument availability fixture; the learner still chooses and attends normally.
    job.model = createModel('lantern', 416, [{ componentId: 'contact', condition: 'dirty' }]);
    state.cash = 100;
    state = lesson(state);
    state = act(state, {
      type: 'measure',
      jobId: job.id,
      request: { mode: 'voltage', a: 'C', b: 'D', condition: 'bench' },
    });
    state = act(state, {
      type: 'work',
      jobId: job.id,
      componentId: 'contact',
      intervention: 'clean',
    });
    expect(state.jobs[0]?.pendingLessons[0]?.baseline?.request?.condition).toBe('bench');
    state = act(state, { type: 'upgrade', id: 'precision-meter' });
    state = act(state, {
      type: 'measure',
      jobId: job.id,
      request: { mode: 'voltage', a: 'C', b: 'D', condition: 'bench' },
    });
    expect(
      state.jobs[0]?.evidence.slice(-2).every((evidence) => evidence.witnessedBy?.includes('sam')),
    ).toBe(true);
    expect(state.jobs[0]?.pendingLessons).toHaveLength(0);
    expect(
      state.people.sam?.methods?.rules
        .find((rule) => rule.action === 'clean:contact')
        ?.evidence.at(-1)?.outcome,
    ).toBe('success');
  });

  it('does not start observation or accuse Sam of inattention during a courier return', () => {
    let state = createGame(416);
    const jobId = state.selectedJobId;
    state = act(state, { type: 'work', jobId, componentId: 'switch', intervention: 'replace' });
    state = act(state, { type: 'verify', jobId, condition: 'movement' });
    state = lesson(state);
    const observations = state.people.sam?.trace.filter(
      (record) => record.chosenAction === 'observe',
    ).length;
    state = act(state, { type: 'deliver', jobId });
    expect(
      state.people.sam?.trace.filter((record) => record.chosenAction === 'observe').length,
    ).toBe(observations);
    expect(state.log.some((entry) => entry.text.includes('did not follow that observation'))).toBe(
      false,
    );
  });

  it('teaches a performed diagnostic check while retaining its failed physical result', () => {
    let state = lesson(createGame(416));
    const jobId = state.selectedJobId;
    state = act(state, { type: 'verify', jobId, condition: 'movement' });
    expect(state.jobs[0]?.evidence.at(-1)?.cues.signal).toBe('weak-output');
    expect(state.jobs[0]?.verified).toHaveLength(0);
    state = act(state, { type: 'work', jobId, componentId: 'contact', intervention: 'clean' });
    state = act(state, { type: 'verify', jobId, condition: 'movement' });
    const rules = state.people.sam?.methods?.rules ?? [];
    expect(
      rules
        .filter((rule) => rule.action === 'verify:movement')
        .every((rule) => rule.evidence.every((evidence) => evidence.outcome === 'success')),
    ).toBe(true);
    expect(rules.find((rule) => rule.action === 'clean:contact')?.evidence.at(-1)?.outcome).toBe(
      'failure',
    );
    expect(state.jobs[0]?.status).toBe('active');
  });

  it('restores the prior power setup after an NPC continuity measurement', () => {
    let state = createGame(416);
    const job = state.jobs[0];
    if (!job) throw new Error('Missing object');
    job.model = createModel('lantern', 416, []);
    state = npcStep(state, 'probe:continuity:B:C:movement');
    expect(state.jobs[0]?.evidence.at(-1)?.value).toBe(0.08);
    expect(state.jobs[0]?.model.power).toBe(true);
    // Consume the real next activity before applying the isolated verification step.
    state = act(state, { type: 'recall', jobId: job.id });
    state = npcStep(state, 'verify:movement');
    expect(state.jobs[0]?.verified).toContain('movement');
  });

  it('transfers an actually attended continuity repair through a complete ordinary handoff', () => {
    let state = lesson(createGame(416));
    const jobId = state.selectedJobId;
    state = act(state, { type: 'inspect', jobId, componentId: 'switch' });
    state = act(state, { type: 'power', jobId, on: false });
    state = act(state, {
      type: 'measure',
      jobId,
      request: { mode: 'continuity', a: 'B', b: 'C', condition: 'movement' },
    });
    state = act(state, { type: 'work', jobId, componentId: 'switch', intervention: 'replace' });
    state = act(state, { type: 'power', jobId, on: true });
    state = act(state, { type: 'verify', jobId, condition: 'movement' });
    state = act(state, { type: 'deliver', jobId });
    state = act(state, { type: 'next-day' });
    state = act(state, { type: 'next-day' });
    const target = state.jobs.find((job) => job.title === 'Halil’s visiting lantern');
    if (!target) throw new Error('Missing carried-light offer');
    state = act(state, { type: 'accept', jobId: target.id });
    state = act(state, { type: 'buy', part: 'switch' });
    state = acceptRepairOffer(state, target.id);
    state = act(state, { type: 'wait', minutes: 180 });
    const returned = state.jobs.find((job) => job.id === target.id);
    expect(returned?.status).toBe('delivered');
    expect(returned?.contributions.map((entry) => entry.action)).toEqual([
      'intake',
      'inspect:switch',
      'probe:continuity:B:C:movement',
      'replace:switch',
      'verify:movement',
    ]);
    expect(state.independentRepairs).toBe(1);
  });
});
