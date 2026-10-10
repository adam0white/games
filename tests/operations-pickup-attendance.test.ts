import { type Affordance, begin, decide, promise } from '@adam0white/human-framework';
import { expect, it } from 'vitest';
import { createGame, getView, transition } from '../src/game/engine';
import { freshOperations } from '../src/game/operations';
import { freshServiceWeek } from '../src/game/service-week';
import { freshWorkshop } from '../src/game/workshop';

function pickup() {
  let s = createGame(17);
  s.chapter = 'garage';
  if (s.campaign) s.campaign.graduated = true;
  s.serviceWeek = { ...freshServiceWeek(), conclusion: 'regular' };
  s.workshop = { ...freshWorkshop(), cash: 800 };
  // Isolate the already agreed, fetched cargo arrangement. Actor decisions remain real.
  s.operations = {
    ...freshOperations(s.now),
    route: 'regular',
    packing: 'padded-crate',
    collectionPlan: 'store-display',
  };
  s.operations.crates = {
    ...s.operations.crates,
    location: 'bench',
    borrowedFor: 1,
    transportAgreed: true,
  };
  s = transition(s, { type: 'action', id: 'operations-arrange-delivery' });
  s = transition(s, { type: 'action', id: 'rest' });
  expect(getView(s).actions.some((a) => a.id === 'operations-round-pickup')).toBe(true);
  return s;
}
it('a custodian keeping a stronger existing commitment cannot move the crates', () => {
  const s = pickup(),
    leila = s.people.leila;
  if (!leila) throw Error('Missing Leila');
  const commitment = promise(leila, {
    kind: 'promise',
    toId: 'mum',
    actions: ['check-in'],
    from: s.now,
    until: s.now + 60,
    importance: 1,
  });
  const offer: Affordance = {
    id: 'kept-check-in',
    action: 'check-in',
    label: 'Keep the promised check-in',
    duration: 60,
    effort: 0,
    advertises: { belonging: 0.3 },
    fulfills: [commitment.id],
  };
  expect(begin(leila, offer, decide(leila, [offer]))).toBeTruthy();
  const after = transition(s, { type: 'action', id: 'operations-round-pickup' });
  expect(after.now).toBe(s.now);
  expect(after.operations).toEqual(s.operations);
  expect(after.people.leila?.activity).toEqual(s.people.leila?.activity);
  expect(after.workshop?.cash).toBe(s.workshop?.cash);
});
it('a newly due custodian appointment interrupts pickup without a cargo receipt', () => {
  const s = pickup(),
    leila = s.people.leila;
  if (!leila) throw Error('Missing Leila');
  promise(leila, {
    kind: 'appointment',
    toId: 'mum',
    actions: ['check-in'],
    from: s.now + 8,
    until: s.now + 12,
    importance: 1,
  });
  const after = transition(s, { type: 'action', id: 'operations-round-pickup' });
  expect(after.now).toBeGreaterThan(s.now);
  expect(after.now).toBeLessThan(s.now + 25);
  expect(after.operations?.crates).toEqual(s.operations?.crates);
  expect(after.operations?.completedRounds).toEqual([]);
  expect(after.operations?.pendingMovement).toBeUndefined();
});
it('an available custodian actually attends the complete pickup interval', () => {
  const s = pickup();
  const after = transition(s, { type: 'action', id: 'operations-round-pickup' });
  expect(after.now).toBe(s.now + 25);
  expect(after.people.leila?.now).toBe(after.now);
  expect(after.operations?.crates.location).toBe('store');
  expect(after.operations?.completedRounds).toEqual([1]);
});
