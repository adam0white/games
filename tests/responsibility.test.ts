import {
  type Affordance,
  agendaTerms,
  decide,
  onFinished,
  promise,
  restore,
  snapshot,
} from '@adam0white/human-framework';
import { describe, expect, it } from 'vitest';
import { createPeople, teachObserved } from '../src/game/people';
import {
  abandonResponsibility,
  adoptResponsibility,
  advertiseResponsibility,
  completeResponsibility,
  responsibilityAdvances,
  responsibilityOutcomeAdvances,
} from '../src/game/responsibility';

const now = 600;
function person() {
  const p = createPeople(72, now).sam;
  if (!p) throw new Error('Missing Sam');
  for (const need of Object.keys(p.needs) as (keyof typeof p.needs)[]) p.needs[need] = 1;
  return p;
}
function offer(action: string, targetId = 'lamp'): Affordance {
  return {
    id: action,
    action,
    label: action,
    targetId,
    methodContext: targetId,
    duration: action === 'drink' ? 5 : 10,
    effort:
      action === 'rest' || action === 'ask-help' || action === 'drink' || action === 'eat'
        ? 0
        : 0.03,
    mode: 'awake',
    advertises:
      action === 'drink'
        ? { water: 0.7 }
        : action === 'eat'
          ? { food: 0.7, water: 0.4 }
          : action === 'rest'
            ? { rest: 0.7, leisure: 0.05 }
            : action === 'ask-help'
              ? { competence: 0.4, belonging: 0.08 }
              : { competence: 0.075 },
  };
}

describe('accepted repair responsibility', () => {
  it('adds the same native purpose term to every legal repair and help, scoped to the accepted job', () => {
    const p = person();
    const responsibility = adoptResponsibility(p, 'lamp', now);
    for (const action of [
      'inspect:contact',
      'measure:contact:load',
      'probe:voltage:a:b:load',
      'clean:contact',
      'adjust:contact',
      'replace:contact',
      'calibrate:governor:3',
      'verify:load',
      'ask-help',
      'deliver',
    ]) {
      const advertised = advertiseResponsibility(p, responsibility, offer(action));
      expect(
        agendaTerms(p, advertised, now).find((t) => t.source === `goal:${responsibility.goalId}`)
          ?.value,
      ).toBe(0.1);
      expect(responsibilityAdvances(p, responsibility, 'bell', action)).toEqual([]);
    }
    for (const action of ['rest', 'eat', 'drink', 'personal', 'sleep', 'leisure', 'observe'])
      expect(responsibilityAdvances(p, responsibility, 'lamp', action)).toEqual([]);
  });

  it('chooses accepted work with full competence while urgent food and water still override it', () => {
    for (const urgent of [undefined, 'eat', 'drink'] as const) {
      const p = person();
      const responsibility = adoptResponsibility(p, 'lamp', now);
      if (urgent === 'eat') p.body.satiety = 0.1;
      if (urgent === 'drink') p.body.hydration = 0.1;
      const offers = ['inspect:contact', 'rest', 'eat', 'drink'].map((action) =>
        advertiseResponsibility(p, responsibility, offer(action)),
      );
      expect(decide(p, offers, { now }).chosenAffordanceId).toBe(urgent ?? 'inspect:contact');
    }
  });

  it('known methods compete against the same purpose term as cheap help', () => {
    const p = person();
    const responsibility = adoptResponsibility(p, 'lamp', now);
    teachObserved(p, 'lamp', { signal: 'dirty' }, 'clean:contact', 'lesson', 'success', now);
    const offers = ['clean:contact', 'replace:contact', 'inspect:contact', 'ask-help', 'rest'].map(
      (action) => advertiseResponsibility(p, responsibility, offer(action)),
    );
    expect(decide(p, offers, { now }).chosenAffordanceId).toBe('clean:contact');
  });

  it('unknown work can choose cheap help without receiving a fault-specific action preference', () => {
    const p = person();
    const responsibility = adoptResponsibility(p, 'lamp', now);
    const offers = ['clean:contact', 'replace:contact', 'ask-help', 'rest'].map((action) =>
      advertiseResponsibility(p, responsibility, offer(action)),
    );
    expect(decide(p, offers, { now }).chosenAffordanceId).toBe('ask-help');
  });

  it('physical repetition earns no progress and help advances once per received revision without keeping delivery', () => {
    const p = person();
    const responsibility = adoptResponsibility(p, 'lamp', now);
    const commitment = promise(p, {
      kind: 'job',
      targetId: 'lamp',
      actions: ['deliver'],
      from: now,
      until: now + 60,
      importance: 0.9,
      label: 'Return lamp',
    });
    const goal = p.agenda.goals.find((g) => g.id === responsibility.goalId);
    if (!goal) throw new Error('Missing responsibility goal');
    const outcome = (action: string, communicated: boolean, revision: number) =>
      onFinished(p, {
        affordanceId: action,
        action,
        targetId: 'lamp',
        at: now,
        status: 'completed',
        advances: responsibilityOutcomeAdvances(
          p,
          responsibility,
          'lamp',
          action,
          communicated,
          revision,
        ),
      });
    for (let i = 0; i < 30; i++) outcome('clean:contact', true, i);
    expect(goal.progress).toBe(0);
    outcome('ask-help', false, 1);
    expect(goal.progress).toBe(0);
    outcome('ask-help', true, 1);
    for (let i = 0; i < 30; i++) outcome('ask-help', true, 1);
    expect(goal.progress).toBe(0.1);
    for (let i = 2; i < 30; i++) outcome('ask-help', true, i);
    expect(goal.progress).toBe(0.2);
    expect(goal.status).toBe('active');
    expect(commitment.status).toBe('pending');
  });

  it('completes only a validated delivery of the same job and abandons on recall', () => {
    const p = person();
    const lamp = adoptResponsibility(p, 'lamp', now);
    const bell = adoptResponsibility(p, 'bell', now);
    expect(completeResponsibility(p, lamp, 'bell', true, now)).toBe(false);
    expect(completeResponsibility(p, lamp, 'lamp', false, now)).toBe(false);
    expect(completeResponsibility(p, lamp, 'lamp', true, now)).toBe(true);
    expect(p.agenda.goals.find((g) => g.id === bell.goalId)?.progress).toBe(0);
    expect(abandonResponsibility(p, bell)).toBe(true);
    expect(responsibilityAdvances(p, bell, 'bell', 'inspect:contact')).toEqual([]);
    expect(completeResponsibility(p, bell, 'bell', true, now)).toBe(false);
  });

  it('preserves goal association and help retry protection across a save', () => {
    const p = person();
    const responsibility = adoptResponsibility(p, 'lamp', now);
    expect(responsibilityOutcomeAdvances(p, responsibility, 'lamp', 'ask-help', true, 7)).toEqual([
      responsibility.goalId,
    ]);
    const restored = restore(snapshot(p));
    const handle = JSON.parse(JSON.stringify(responsibility));
    expect(responsibilityOutcomeAdvances(restored, handle, 'lamp', 'ask-help', true, 7)).toEqual(
      [],
    );
    expect(responsibilityAdvances(restored, handle, 'lamp', 'inspect:contact')).toEqual([
      handle.goalId,
    ]);
  });
});
