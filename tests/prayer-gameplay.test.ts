import {
  createPerson as authorPerson,
  createRun,
  exportRun,
  replay,
  step,
} from '@adam0white/human-framework';
import { expect, it } from 'vitest';
import { createGame, dispatch, loadGame, saveGame } from '../src/game/engine';
import { attachWorkshop, promise, snapshotRuntime } from '../src/game/hf';
import type { Command, GameState } from '../src/game/types';
import { readyToLearn } from './hf-fixture';

function required<T>(value: T | undefined | null): T {
  if (value === undefined || value === null) throw new Error('Missing prayer fixture');
  return value;
}
function act(state: GameState, command: Command): GameState {
  const result = dispatch(state, command);
  expect(result.ok, result.message).toBe(true);
  return result.state;
}
// Synthetic causal opening: public authoring registers prayer before replaying
// the opening inputs. No private actor fields or native outcomes are changed.
function opening(): GameState {
  const state = createGame(42);
  readyToLearn(required(state.people.sam), 1);
  const runtime = snapshotRuntime(state.people);
  const spec = structuredClone(runtime.archive.initial.spec);
  spec.definitions = {
    ...spec.definitions,
    actions: [
      ...spec.definitions.actions,
      {
        id: 'pray',
        label: 'Pray',
        demands: { effort: 0, focus: 0, mode: 'awake', requires: {} },
        tags: ['worship'],
        norms: [],
      },
    ],
  };
  const created = createRun(spec);
  if (!created.ok) throw new Error(JSON.stringify(created.error));
  const run = created.value;
  for (const person of runtime.archive.initial.people) {
    const result = authorPerson(run, person);
    if (!result.ok) throw new Error(JSON.stringify(result.error));
  }
  for (const tx of runtime.archive.history) {
    const result = step(run, { until: tx.until, inputs: tx.inputs, fidelity: tx.fidelity });
    if (!result.ok) throw new Error(JSON.stringify(result.error));
  }
  state.hf = { ...runtime, archive: structuredClone(exportRun(run)) as typeof runtime.archive };
  attachWorkshop(state);
  return state;
}
function duty(state: GameState, from = state.now) {
  return promise(required(state.people.sam), {
    kind: 'worship',
    actions: ['pray'],
    from,
    until: from + 60,
    importance: 1,
    label: 'Retained prayer duty',
  });
}
function exactSave(state: GameState): void {
  const raw = saveGame(state);
  expect(saveGame(loadGame(raw))).toBe(raw);
  const native = replay(JSON.parse(raw).hf.archive);
  expect(native.ok && native.value.verified).toBe(true);
  for (const person of Object.values(state.people)) expect(person.now).toBe(state.now);
}

it('settles actual shorter watcher prayer before the player finishes a replacement', () => {
  let state = opening();
  state = act(state, { type: 'watch', enabled: true });
  expect(state.watching).toBe(true);
  const commitment = duty(state);
  const start = state.now;
  state = act(state, {
    type: 'work',
    jobId: state.selectedJobId,
    componentId: 'cell',
    intervention: 'replace',
  });
  expect(
    required(state.people.sam).trace.some((choice) => choice.chosenAffordanceId === 'pray'),
  ).toBe(true);
  expect(state.now).toBe(start + 30);
  expect(
    required(state.people.sam).agenda.commitments.find((c) => c.id === commitment.id)?.status,
  ).toBe('kept');
  const completion = snapshotRuntime(state.people)
    .archive.history.flatMap((tx) => tx.inputs)
    .find(
      (input) =>
        input.kind === 'action.resolved' &&
        input.payload.person === 'sam' &&
        input.payload.stage === 'finish',
    );
  expect(completion?.kind).toBe('action.resolved');
  expect(Math.floor(required(completion).at / 60_000)).toBe(start + 15);
  if (completion?.kind === 'action.resolved')
    expect(completion.payload.disposition).toBe('completed');
  exactSave(state);
});

it('completes assigned prayer without repair credit or a bench reservation', () => {
  let state = opening();
  const jobId = state.selectedJobId;
  const commitment = duty(state, state.now + 1);
  state = act(state, { type: 'assign', jobId, personId: 'sam' });
  expect(required(state.jobs[0]).assignedTo).toBe('sam');
  state = act(state, { type: 'wait', minutes: 1 });
  const prayer = state.npcWork.find((work) => work.personId === 'sam');
  expect(prayer?.option.action).toBe('pray');
  const jobBefore = structuredClone(required(state.jobs.find((job) => job.id === jobId)));
  const responsibility = required(state.people.sam).agenda.goals.find(
    (goal) => goal.id === required(jobBefore.responsibility).goalId,
  );
  const progress = responsibility?.progress;
  state = act(state, { type: 'wait', minutes: 15 });
  const job = required(state.jobs.find((candidate) => candidate.id === jobId));
  expect(job.contributions).toEqual(jobBefore.contributions);
  expect(job.evidence).toEqual(jobBefore.evidence);
  expect(job.model).toEqual(jobBefore.model);
  expect(
    required(state.people.sam).agenda.goals.find(
      (goal) => goal.id === required(jobBefore.responsibility).goalId,
    )?.progress,
  ).toBe(progress);
  expect(
    required(state.people.sam).agenda.commitments.find((c) => c.id === commitment.id)?.status,
  ).toBe('kept');
  exactSave(state);
});

// A second authored physical object isolates the one-bench exclusion. It is a
// synthetic world fixture; both people still choose and act through native HF.
it('leaves the only bench available while assigned Sam prays', () => {
  let state = opening();
  const family = required(state.jobs[0]);
  const other = structuredClone(family);
  other.id = 'prayer-bench-control';
  state.jobs.push(other);
  duty(state, state.now + 1);
  state = act(state, { type: 'assign', jobId: family.id, personId: 'sam' });
  state = act(state, { type: 'wait', minutes: 1 });
  expect(state.npcWork.find((work) => work.personId === 'sam')?.option.action).toBe('pray');
  state = act(state, { type: 'inspect', jobId: other.id, componentId: 'contact' });
  expect(required(state.jobs.find((job) => job.id === other.id)).evidence.length).toBeGreaterThan(
    0,
  );
  exactSave(state);
});
