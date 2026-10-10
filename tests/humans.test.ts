import {
  begin,
  createPerson,
  decide,
  finish,
  relationshipWith,
  tick,
} from '@adam0white/human-framework';
import { expect, it } from 'vitest';
import { askMumToHelp, shareTea } from '../src/game/humans';

it('shared tea causally changes ties, social need and Mum’s subsequent choice at matched elapsed time', () => {
  const mum = createPerson({
    id: 'mum',
    name: 'Mum',
    seed: 42,
    bornAt: -52 * 365 * 1440,
    sex: 'female',
    relationships: [{ otherId: 'player', roles: ['child'] }],
  });
  const player = createPerson({
    id: 'player',
    name: 'You',
    seed: 42,
    bornAt: -25 * 365 * 1440,
    sex: 'male',
  });
  const control = structuredClone(mum);
  shareTea(player, mum, 30);
  const neutral = {
    id: 'quiet-rest',
    action: 'rest',
    label: 'Sit quietly alone',
    duration: 30,
    effort: 0,
    focus: 0.05,
    advertises: { leisure: 0.1 },
  };
  begin(control, neutral, decide(control, [neutral]));
  tick(control, 30);
  finish(control, {
    affordanceId: neutral.id,
    action: neutral.action,
    at: 30,
    status: 'completed',
    summary: neutral.label,
    needs: { leisure: 0.1 },
  });
  expect(relationshipWith(mum, 'player').affection).toBeGreaterThan(
    relationshipWith(control, 'player').affection,
  );
  expect(askMumToHelp(control)).toBe(true);
  expect(askMumToHelp(mum)).toBe(false);
  expect(mum.now).toBe(control.now);
  const social = (p: typeof mum) =>
    p.trace
      .at(-1)
      ?.considered.find((x) => x.affordanceId === 'hold-light')
      ?.terms.find((x) => x.source === 'social:player')?.value;
  expect(social(mum)).toBeLessThan(social(control) ?? 0);
  expect(mum.trace.at(-1)?.chosenAffordanceId).toBe('read-chapter');
});

it('a customer’s own needs change the unchecked-return choice under identical host offers', async () => {
  const { chooseUncheckedReturn } = await import('../src/game/humans');
  const cautious = createPerson({
    id: 'customer',
    name: 'Customer',
    seed: 51,
    now: 840,
    bornAt: -30 * 365 * 1440,
    sex: 'female',
    needs: { safety: 0.05, autonomy: 0.95, belonging: 0.95, competence: 0.95 },
  });
  const independent = createPerson({
    id: 'customer',
    name: 'Customer',
    seed: 51,
    now: 840,
    bornAt: -30 * 365 * 1440,
    sex: 'female',
    needs: { safety: 0.95, autonomy: 0.05, belonging: 0.95, competence: 0.95 },
  });
  expect(chooseUncheckedReturn(cautious)).toBe(true);
  expect(chooseUncheckedReturn(independent)).toBe(false);
  expect(
    cautious.trace
      .at(-1)
      ?.considered.map((x) => x.affordanceId)
      .sort(),
  ).toEqual(
    independent.trace
      .at(-1)
      ?.considered.map((x) => x.affordanceId)
      .sort(),
  );
});

it('Sam’s understood dog obligation changes his visit choice with the same curiosity and opportunities', async () => {
  const { chooseSamVisit } = await import('../src/game/humans');
  const withoutDuty = createPerson({
    id: 'sam',
    name: 'Sam',
    seed: 42,
    now: 1020,
    bornAt: -27 * 365 * 1440,
    sex: 'male',
    needs: { competence: 0.1, belonging: 0.2, leisure: 0.9, autonomy: 0.9 },
  });
  const withDuty = createPerson({
    id: 'sam',
    name: 'Sam',
    seed: 42,
    now: 1020,
    bornAt: -27 * 365 * 1440,
    sex: 'male',
    needs: { competence: 0.1, belonging: 0.2, leisure: 0.9, autonomy: 0.9 },
    commitments: [
      { kind: 'duty', toId: 'self', actions: ['walk'], from: 960, until: 1140, importance: 0.9 },
    ],
  });
  expect(chooseSamVisit(withoutDuty)).toBe(true);
  expect(chooseSamVisit(withDuty)).toBe(false);
  expect(withDuty.activity?.action).toBe('walk');
  expect(withoutDuty.activity?.action).toBe('learn');
});

it('ordinary routines preserve need gains, decisions and RNG when elapsed time is fragmented', async () => {
  const { liveOrdinaryTime } = await import('../src/game/humans');
  const whole = createPerson({
    id: 'mum',
    name: 'Mum',
    seed: 42,
    now: 840,
    bornAt: -52 * 365 * 1440,
    sex: 'female',
  });
  const pieces = structuredClone(whole);
  liveOrdinaryTime(whole, 960);
  for (let at = 844; at <= 960; at += 4) liveOrdinaryTime(pieces, at);
  expect(pieces.rng).toEqual(whole.rng);
  const rounded = (value: unknown) =>
    JSON.parse(
      JSON.stringify(value, (_key, item) =>
        typeof item === 'number' ? Math.round(item * 1e8) / 1e8 : item,
      ),
    );
  expect(rounded(pieces.trace)).toEqual(rounded(whole.trace));
  for (const key of Object.keys(whole.needs) as (keyof typeof whole.needs)[])
    expect(pieces.needs[key]).toBeCloseTo(whole.needs[key], 8);
  for (const key of ['satiety', 'hydration', 'sleepPressure', 'health', 'exertion'] as const)
    expect(pieces.body[key]).toBeCloseTo(whole.body[key], 8);
  expect(rounded(pieces.activity)).toEqual(rounded(whole.activity));
});

it('reports Mum’s actual retained meal rather than inventing a chapter when helping cannot begin', () => {
  const mum = createPerson({
    id: 'mum',
    name: 'Mum',
    seed: 42,
    now: 840,
    bornAt: -52 * 365 * 1440,
    sex: 'female',
  });
  const meal = {
    id: 'ordinary-meal',
    action: 'eat',
    label: 'Having something to eat and drink',
    duration: 30,
    effort: 0,
    advertises: { food: 0.2, water: 0.2 },
  };
  begin(mum, meal, decide(mum, [meal]));
  const before = structuredClone(mum.activity);
  const reports: { kind: string; activity?: string }[] = [];
  expect(askMumToHelp(mum, (report) => reports.push(report))).toBe(false);
  expect(reports).toEqual([{ kind: 'kept-activity', activity: meal.label }]);
  expect(mum.activity).toEqual(before);
  expect(mum.now).toBe(848);
});
