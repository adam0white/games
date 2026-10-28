import { exportRun, preview, replay, restoreRun } from '@adam0white/human-framework';
import { describe, expect, it } from 'vitest';
import {
  adoptGoal,
  attachWorkshop,
  createPeopleRuntime,
  createPerson,
  exportPersonRun,
  methodEvidence,
  promise,
  snapshotRuntime,
} from '../src/game/hf';
import {
  chooseActivity,
  finishActivity,
  notePlayerWord,
  startActivity,
  teachObserved,
} from '../src/game/people';
import type { WorkOption } from '../src/game/types';

function opening(body: Parameters<typeof createPerson>[1]['body'] = {}) {
  const people = createPeopleRuntime(72, 600, [
    'rest',
    'eat',
    'sleep',
    'clean:contact',
    'replace:contact',
  ]);
  const person = createPerson(people, {
    id: 'sam',
    name: 'Sam',
    age: 20,
    sex: 'male',
    now: 600,
    body,
  });
  return { people, person };
}
const rest: WorkOption = {
  id: 'rest',
  action: 'rest',
  label: 'Take a break',
  duration: 30,
  effort: 0,
};
function beginRest(person: ReturnType<typeof opening>['person']) {
  chooseActivity(person, 'break', {}, [rest], 600);
  expect(startActivity(person, rest, 600)).toBe(true);
}

describe('published HF4 workshop actor boundary', () => {
  it('saves an unresolved request and starts the exact same activity after JSON restore', () => {
    const original = opening();
    chooseActivity(original.person, 'break', {}, [rest], 600);
    const saved = JSON.parse(
      JSON.stringify({ people: original.people, hf: snapshotRuntime(original.people) }),
    );
    const pending = structuredClone(saved.hf.pending);
    attachWorkshop(saved);
    expect(saved.hf.pending).toEqual(pending);
    expect(startActivity(original.person, rest, 600)).toBe(true);
    expect(startActivity(saved.people.sam, rest, 600)).toBe(true);
    expect(snapshotRuntime(saved.people)).toEqual(snapshotRuntime(original.people));
  });
  it('continues active work exactly and verifies the whole native archive', () => {
    const original = opening({ exertion: 0.75, sleepPressure: 0.4 });
    beginRest(original.person);
    const saved = JSON.parse(
      JSON.stringify({ people: original.people, hf: snapshotRuntime(original.people) }),
    );
    attachWorkshop(saved);
    finishActivity(original.person, rest, true, 630);
    finishActivity(saved.people.sam, rest, true, 630);
    const archive = snapshotRuntime(original.people).archive;
    expect(snapshotRuntime(saved.people)).toEqual(snapshotRuntime(original.people));
    expect(original.person.body.exertion).toBeLessThan(0.75);
    const result = replay(archive);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    expect(result.value.verified).toBe(true);
    expect(result.value.fullHash).toBe(archive.hashes.full);
  });
  it('credits a declared goal only after a real accepted action completes', () => {
    const { people, person } = opening();
    const goal = adoptGoal(
      person,
      {
        label: 'Take a real break',
        serves: ['achievement'],
        importance: 0.2,
        advancedBy: [{ action: 'rest', amount: 1 }],
      },
      600,
    );
    beginRest(person);
    expect(person.agenda.goals.find((g) => g.id === goal.id)?.status).toBe('active');
    finishActivity(person, rest, true, 630);
    expect(person.agenda.goals.find((g) => g.id === goal.id)?.status).toBe('achieved');
    const result = replay(snapshotRuntime(people).archive);
    expect(result.ok && result.value.verified).toBe(true);
  });
  it('keeps inspection and a hypothetical bodily projection read only', () => {
    const { person } = opening();
    const archive = exportPersonRun(person),
      run = restoreRun(archive);
    expect(run.ok).toBe(true);
    if (!run.ok) throw new Error('restore');
    const before = exportRun(run.value);
    const result = preview(run.value, {
      perspective: { kind: 'person', observer: 'sam' },
      person: 'sam',
      until: archive.current.at + 30 * 60000,
      inputs: [],
      bodyForecast: [
        { label: 'rest', durationMs: 30 * 60000, load: { mode: 'awake', effort: 0, focus: 0 } },
      ],
    });
    expect(result.ok).toBe(true);
    expect(exportRun(run.value)).toEqual(before);
    expect(exportPersonRun(person)).toEqual(archive);
  });
  it('records actually received demonstrations and voice promises through public inputs', () => {
    const { person } = opening();
    const before = person.will.voices.find((v) => v.voiceId === 'player')!.trust;
    expect(
      teachObserved(
        person,
        'lamp',
        { signal: 'dirty' },
        'clean:contact',
        'demo-clean',
        'success',
        600,
      ),
    ).toBe(true);
    expect(person.methods.rules.some((r) => r.action === 'clean:contact')).toBe(true);
    notePlayerWord(person, false, 'start-lesson', 600);
    expect(person.will.voices.find((v) => v.voiceId === 'player')!.trust).toBeLessThan(before);
  });
  it('checks a remembered unavailable method on a hypothetical run without changing the live archive', () => {
    const { person } = opening();
    expect(
      teachObserved(
        person,
        'lamp',
        { signal: 'dirty' },
        'clean:contact',
        'method-preview',
        'success',
        600,
      ),
    ).toBe(true);
    const before = exportPersonRun(person);
    expect(methodEvidence(person, 'clean:contact', 'lamp').support).toBeGreaterThan(0);
    const after = exportPersonRun(person);
    expect(after.hashes.full).toBe(before.hashes.full);
    expect(after).toEqual(before);
  });
});

function prayerOpening() {
  const people = createPeopleRuntime(42, 600, ['rest', 'pray', 'sleep']);
  const person = createPerson(people, {
    id: 'nora',
    name: 'Nora',
    age: 20,
    sex: 'female',
    now: 600,
    needs: {
      safety: 1,
      belonging: 1,
      esteem: 1,
      autonomy: 1,
      competence: 1,
      leisure: 1,
      meaning: 1,
    },
  });
  const duty = promise(person, {
    kind: 'worship',
    actions: ['pray'],
    from: 600,
    until: 660,
    importance: 1,
    label: 'Retained prayer duty',
  });
  return { person, duty };
}

it('lets the host start and finish a chosen retained prayer opportunity', () => {
  const { person, duty } = prayerOpening();
  const options: WorkOption[] = [{ ...rest, duration: 15 }];
  const choice = chooseActivity(person, 'workshop', {}, options, 600);
  expect(choice.chosenId).toBe('pray');
  const selected = options.find((option) => option.id === choice.chosenId);
  expect(selected).toBeDefined();
  expect(startActivity(person, selected!, 600)).toBe(true);
  expect(finishActivity(person, selected!, true, 615)).not.toBeNull();
  expect(person.agenda.commitments.find((c) => c.id === duty.id)?.status).toBe('kept');
  const archive = exportPersonRun(person);
  const exact = replay(archive);
  expect(exact.ok && exact.value.verified).toBe(true);
});

it.each([
  {
    label: 'a sleep-only night',
    option: { id: 'sleep', action: 'sleep', label: 'Sleep', duration: 600, effort: 0 },
  },
  { label: 'less than fifteen minutes', option: { ...rest, duration: 1 } },
])('does not advertise an unsupported prayer opportunity during $label', ({ option }) => {
  const { person } = prayerOpening();
  const options: WorkOption[] = [option];
  chooseActivity(person, 'workshop', {}, options, 600);
  expect(options.map((option) => option.id)).toEqual([option.id]);
  expect(person.trace[0]?.considered.some((candidate) => candidate.affordanceId === 'pray')).toBe(
    false,
  );
});
