/** Public authored fixtures. These are controlled openings, not live actor mutations. */
import {
  createPerson,
  createRun,
  inspect,
  type PersonAuthoring,
  type Result,
  readRunHistory,
  step,
} from '@adam0white/human-framework';
import {
  attachWorkshop,
  checkpointPeople,
  type DecisionRecord,
  exportPersonRun,
  type Person,
  workshopRoster,
} from '../src/game/hf';

const need = <T>(r: Result<T>): T => {
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
};
export const native = (person: Person) => exportPersonRun(person).current.people[person.id]!;
export const nativeOf = (person: Person | undefined) => (person ? native(person) : undefined);
export const snapshot = (p: Person) => structuredClone(checkpointPeople(p));
export function restore(saved: ReturnType<typeof checkpointPeople>): Person {
  const state = structuredClone(saved);
  attachWorkshop(state);
  return state.people[state.selected]!;
}
export function reAuthor(
  person: Person,
  changes: Partial<
    Pick<PersonAuthoring['state'], 'body' | 'needs' | 'traits' | 'values' | 'agenda'>
  >,
): void {
  const state = checkpointPeople(person),
    archive = state.hf.archive,
    run = need(createRun(archive.initial.spec));
  for (const initial of archive.initial.people) {
    const authored = structuredClone(initial) as PersonAuthoring;
    if (authored.id === person.id)
      for (const [key, value] of Object.entries(changes))
        Object.assign(authored.state[key as keyof typeof changes], value);
    need(createPerson(run, authored));
  }
  for (const tx of readRunHistory(archive))
    need(step(run, { until: tx.until, inputs: tx.inputs, fidelity: tx.fidelity }));
  const fresh = awaitlessExport(run);
  state.hf.archive = fresh;
  // Keep the fixture's public handles; attach rebuilds every inspection cache from the authored run.
  state.people = workshopRoster(person);
  state.hf.decisions = {};
  const view = need(
    inspect(run, {
      perspective: { kind: 'host' },
      people: Object.keys(state.people),
      select: ['events'],
    }),
  );
  for (const event of view.events)
    if ('access' in event && event.access === 'host' && event.data.kind === 'decision') {
      const decision = event.data.decision;
      const actor = state.hf.archive.current.events.find((e) => e.id === event.id)?.person;
      if (actor)
        state.hf.decisions[actor] = {
          ...structuredClone(decision),
          at: Math.floor(decision.at / 60000),
          narration: event.narration.map((l) => l.text).join(' '),
        } as DecisionRecord;
    }
  attachWorkshop(state);
}

import { exportRun } from '@adam0white/human-framework';

function awaitlessExport(run: Parameters<typeof exportRun>[0]) {
  return structuredClone(exportRun(run)) as ReturnType<typeof checkpointPeople>['hf']['archive'];
}
export function readyToLearn(person: Person, competence = 0): void {
  reAuthor(person, {
    needs: { safety: 1, belonging: 1, esteem: 1, autonomy: 1, competence, leisure: 1, meaning: 1 },
    body: { exertion: 0 } as PersonAuthoring['state']['body'],
  });
}

import { snapshotRuntime } from '../src/game/hf';
import type { GameState } from '../src/game/types';
export function cloneGame(state: GameState): GameState {
  const copy = structuredClone({ ...state, hf: snapshotRuntime(state.people) });
  attachWorkshop(copy);
  return copy;
}

export const maxClosedGoals = (person: Person) =>
  exportPersonRun(person).initial.effective.builtins.AGENDA_DEFAULTS.maxClosedGoals;
