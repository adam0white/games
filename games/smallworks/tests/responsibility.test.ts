import { describe, expect, it } from 'vitest';
import { begin, createPeopleRuntime, createPerson, decide, finish } from '../src/game/hf';
import {
  abandonResponsibility,
  adoptResponsibility,
  completeResponsibility,
  responsibilityAdvances,
} from '../src/game/responsibility';

const opening = () => {
  const people = createPeopleRuntime(72, 600, [
    'deliver',
    'complete-project',
    'delivery-independent',
    'inspect:contact',
    'rest',
  ]);
  return createPerson(people, { id: 'sam', name: 'Sam', age: 20, sex: 'male', now: 600 });
};
describe('HF4 accepted repair responsibility', () => {
  it('scopes the purpose advertisement to its accepted object and physical work', () => {
    const p = opening(),
      r = adoptResponsibility(p, 'lamp', 600);
    expect(responsibilityAdvances(p, r, 'lamp', 'inspect:contact')).toEqual([r.goalId]);
    expect(responsibilityAdvances(p, r, 'bell', 'inspect:contact')).toEqual([]);
    expect(responsibilityAdvances(p, r, 'lamp', 'rest')).toEqual([]);
  });
  it('host validation alone never completes the person goal', () => {
    const p = opening(),
      r = adoptResponsibility(p, 'lamp', 600);
    expect(completeResponsibility(p, r, 'lamp', true, 600)).toBe(true);
    expect(p.agenda.goals.find((g) => g.id === r.goalId)?.status).toBe('active');
  });
  it('credits actual delivery, and rejects a physical repetition as completion', () => {
    const p = opening(),
      r = adoptResponsibility(p, 'lamp', 600);
    for (const action of ['inspect:contact', 'deliver']) {
      const a = {
        id: action,
        action,
        label: action,
        duration: 10,
        effort: 0,
        advertises: {},
        targetId: 'lamp',
      };
      const d = decide(p, [a], { now: p.now });
      expect(begin(p, a, d)).not.toBeNull();
      finish(p, {
        affordanceId: action,
        action,
        at: p.now + 10,
        status: 'completed',
        advances: [],
      });
      expect(p.agenda.goals.find((g) => g.id === r.goalId)?.status).toBe(
        action === 'deliver' ? 'achieved' : 'active',
      );
    }
  });
  it('withdraws a purpose through HF rather than erasing its record', () => {
    const p = opening(),
      r = adoptResponsibility(p, 'lamp', 600);
    expect(abandonResponsibility(p, r)).toBe(true);
    expect(p.agenda.goals.find((g) => g.id === r.goalId)?.status).toBe('abandoned');
  });
});
