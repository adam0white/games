import { type Affordance, begin, decide, promise } from '@adam0white/human-framework';
import { expect, it } from 'vitest';
import { createGame, getView, transition } from '../src/game/engine';
import { freshServiceWeek } from '../src/game/service-week';
import type { GameState } from '../src/game/types';
import { freshWorkshop } from '../src/game/workshop';

function fixture() {
  const s = createGame(17);
  s.chapter = 'garage';
  if (s.campaign) s.campaign.graduated = true;
  s.serviceWeek = { ...freshServiceWeek(), conclusion: 'regular' };
  s.workshop = { ...freshWorkshop(), cash: 800 };
  return s;
}
const act = (s: GameState, id: string) => transition(s, { type: 'action', id });
function promisedCheckIn(s: GameState) {
  const player = s.people.player;
  if (!player) throw Error('Missing player');
  const commitment = promise(player, {
    kind: 'promise',
    toId: 'mum',
    actions: ['check-in'],
    from: s.now,
    until: s.now + 60,
    importance: 1,
    label: 'Stay for the promised check-in',
  });
  const offer: Affordance = {
    id: 'promised-check-in',
    action: 'check-in',
    label: 'The promised check-in',
    duration: 60,
    effort: 0,
    advertises: { belonging: 0.3 },
    fulfills: [commitment.id],
  };
  expect(begin(player, offer, decide(player, [offer]))).toBeTruthy();
}
function personalWorkFixture() {
  let s = fixture();
  s.objects.push({
    id: 'paper-street',
    title: 'Your paper street',
    owner: 'You',
    story: 'Retained model',
    form: 'timer',
    fault: 'gear',
    location: 'shelf',
    observations: [],
    inspected: false,
    tested: false,
    attempted: 0,
    repaired: false,
    verified: false,
    discovered: true,
  });
  for (const id of [
    'operations-begin',
    'operations-route-private',
    'operations-personal-open',
    'operations-personal-measure',
  ])
    s = act(s, id);
  return s;
}
it('declining a personal session for an existing promised activity preserves that activity and earns no session', () => {
  let s = personalWorkFixture();
  promisedCheckIn(s);
  const before = structuredClone(s);
  s = act(s, 'operations-personal-make-insert');
  expect(s.now).toBe(before.now);
  expect(s.people.player?.activity).toEqual(before.people.player?.activity);
  expect(s.operations).toEqual(before.operations);
  expect(s.operations?.completedRounds).toEqual([]);
  expect(s.conversation.at(-1)?.text).not.toContain('spend twenty-five');
});
it('a new duty interrupting an attended session does not earn its completion', () => {
  let s = personalWorkFixture();
  const player = s.people.player;
  if (!player) throw Error('Missing player');
  promise(player, {
    kind: 'appointment',
    toId: 'mum',
    actions: ['check-in'],
    from: s.now + 8,
    until: s.now + 12,
    importance: 1,
    label: 'A promised check-in starts soon',
  });
  const before = s.now;
  s = act(s, 'operations-personal-make-insert');
  expect(s.now).toBeGreaterThan(before);
  expect(s.now).toBeLessThan(before + 25);
  expect(s.operations?.completedRounds).toEqual([]);
});
function acceptedTrolley() {
  let s = fixture();
  for (const id of [
    'operations-begin',
    'operations-route-regular',
    'operations-hear-operations-trolley-first',
    'rest',
    'operations-request-operations-trolley-first',
    'operations-accept-operations-trolley-first',
  ])
    s = act(s, id);
  return s;
}
it('a concluded solo service week opens the finite later chapter without independent repair credit', () => {
  let s = fixture();
  expect(getView(s).actions.some((a) => a.id === 'operations-begin')).toBe(true);
  s = act(s, 'operations-begin');
  expect(getView(s).operations?.episode).toBe(1);
  s = act(s, 'operations-route-regular');
  s = act(s, 'operations-hear-operations-trolley-first');
  s = act(s, 'rest');
  s = act(s, 'operations-request-operations-trolley-first');
  s = act(s, 'operations-accept-operations-trolley-first');
  expect(s.objects.find((o) => o.id === 'operations-trolley-first')).toMatchObject({
    form: 'trolley',
    trolley: { permission: true },
    inspected: false,
  });
  expect(
    s.people.player?.agenda.commitments.some((c) => c.label?.includes('operations-trolley-first')),
  ).toBe(true);
  expect(s.workshop?.cash).toBe(800);
  expect(getView(s).focus?.trolleyPresentation?.observed).toBe('unknown');
});

it('the solo loaded route returns checked borrowed property only after its actual time', () => {
  let s = acceptedTrolley();
  for (const id of [
    'inspect',
    'test-trolley-unloaded',
    'test-trolley-loaded',
    'align-trolley-wheel',
    'check-trolley-route',
    'operations-plan-display',
    'operations-arrange-crates',
    'rest',
    'operations-agree-crate-loan',
    'operations-fetch-crates',
    'operations-pack-crate',
  ]) {
    if (id === 'operations-fetch-crates') {
      const refusal = structuredClone(s);
      promisedCheckIn(refusal);
      const refused = act(refusal, id);
      expect(refused.now).toBe(refusal.now);
      expect(refused.operations).toEqual(refusal.operations);
      expect(refused.people.player?.activity).toEqual(refusal.people.player?.activity);
    }
    s = act(s, id);
  }
  const refusal = structuredClone(s);
  promisedCheckIn(refusal);
  const refused = act(refusal, 'operations-round-solo');
  expect(refused.now).toBe(refusal.now);
  expect(refused.operations).toEqual(refusal.operations);
  expect(refused.objects).toEqual(refusal.objects);
  expect(refused.people.player?.activity).toEqual(refusal.people.player?.activity);
  const before = s.now,
    cash = s.workshop?.cash ?? 0;
  s = act(s, 'operations-round-solo');
  expect(s.now).toBe(before + 25);
  expect(s.objects.find((o) => o.id === 'operations-trolley-first')).toMatchObject({
    location: 'returned',
    collectedAt: before + 25,
    verified: true,
  });
  expect(s.workshop?.cash).toBe(cash + 500);
  expect(s.operations?.jobs.find((j) => j.id === 'operations-trolley-first')?.stage).toBe(
    'returned',
  );
  expect(() => act(s, 'operations-round-solo')).toThrow('not available');
});

it('a paid delivery keeps its actual HF activity and prevents simultaneous bench handling', () => {
  let s = acceptedTrolley();
  for (const id of [
    'inspect',
    'test-trolley-unloaded',
    'test-trolley-loaded',
    'align-trolley-wheel',
    'check-trolley-route',
    'operations-plan-display',
    'operations-arrange-crates',
    'rest',
    'operations-agree-crate-loan',
    'operations-fetch-crates',
    'operations-pack-crate',
  ])
    s = act(s, id);
  for (let tries = 0; !s.operations?.delivery && tries < 20; tries++) {
    if (getView(s).actions.some((a) => a.id === 'operations-round-leila'))
      s = act(s, 'operations-round-leila');
    if (!s.operations?.delivery) s = act(s, 'rest');
  }
  expect(s.operations?.delivery?.status).toBe('working');
  expect(s.people.leila?.activity?.affordanceId).toBe('operations-packing-delivery');
  expect(s.focusId).toBeNull();
  expect(() => transition(s, { type: 'select', id: 'operations-trolley-first' })).toThrow(
    'Unknown object',
  );
  const cash = s.workshop?.cash ?? 0;
  let recalled = act(s, 'operations-interrupt-delivery');
  expect(recalled.operations?.crates.location).toBe('route-stop');
  expect(recalled.workshop?.cash).toBe(cash);
  expect(() => transition(recalled, { type: 'select', id: 'operations-trolley-first' })).toThrow(
    'Unknown object',
  );
  const recoveryAt = recalled.now;
  recalled = act(recalled, 'operations-recover-route');
  expect(recalled.now).toBe(recoveryAt + 20);
  expect(recalled.operations?.crates.location).toBe('bench');
  expect(transition(recalled, { type: 'select', id: 'operations-trolley-first' }).focusId).toBe(
    'operations-trolley-first',
  );
  expect(recalled.workshop?.ledger.filter((e) => e.kind === 'delivery-pay')).toHaveLength(0);
  s = act(s, 'rest');
  expect(s.operations?.delivery?.status).toBe('complete');
  expect(s.workshop?.cash).toBe(cash + 500 - 200);
  expect(s.workshop?.ledger.filter((e) => e.kind === 'delivery-pay')).toHaveLength(1);
});

it('year passage protects customer custody outside named request prefixes while retaining personal work', () => {
  for (const owner of ['Nora', 'You']) {
    let s = fixture();
    s.objects.push({
      id: 'unusual-case-custody',
      title: 'The retained case',
      owner,
      story: 'An already accepted case.',
      form: 'box',
      fault: 'hinge',
      location: 'shelf',
      observations: [],
      inspected: false,
      tested: false,
      attempted: 0,
      repaired: false,
      verified: false,
      discovered: true,
    });
    s.focusId = null;
    for (const id of [
      'operations-begin',
      'operations-route-private',
      'operations-display-label',
      'operations-close-private-period',
    ])
      s = act(s, id);
    expect(getView(s).actions.some((a) => a.id === 'operations-next-period')).toBe(owner === 'You');
    if (owner === 'Nora') {
      expect(getView(s).operations?.blockedReasons.join(' ')).toContain('The retained case');
      s = act(s, 'operations-review-open-work');
      expect(s.focusId).toBe('unusual-case-custody');
    }
  }
});

it('an owner’s newly due appointment interrupts acceptance without transferring their property', () => {
  let s = fixture();
  for (const id of [
    'operations-begin',
    'operations-route-regular',
    'operations-hear-operations-trolley-first',
    'rest',
    'operations-request-operations-trolley-first',
  ])
    s = act(s, id);
  const leila = s.people.leila;
  if (!leila) throw Error('Missing Leila');
  promise(leila, {
    kind: 'appointment',
    toId: 'mum',
    actions: ['check-in'],
    from: s.now + 2,
    until: s.now + 10,
    importance: 1,
    label: 'A received appointment',
  });
  const before = structuredClone(s);
  s = act(s, 'operations-accept-operations-trolley-first');
  expect(s.now).toBeGreaterThan(before.now);
  expect(s.now).toBeLessThan(before.now + 5);
  expect(s.operations).toEqual(before.operations);
  expect(s.objects).toEqual(before.objects);
  expect(s.workshop?.cash).toBe(before.workshop?.cash);
});

it.each(['player', 'leila'])(
  'an already-active short appointment for %s competes before acceptance begins',
  (personId) => {
    let s = fixture();
    for (const id of [
      'operations-begin',
      'operations-route-regular',
      'operations-hear-operations-trolley-first',
      'rest',
      'operations-request-operations-trolley-first',
    ])
      s = act(s, id);
    for (const id of ['player', 'leila']) {
      const p = s.people[id];
      if (p) p.activity = null;
    }
    const viable = act(structuredClone(s), 'operations-accept-operations-trolley-first');
    expect(viable.objects.some((o) => o.id === 'operations-trolley-first')).toBe(true);
    const person = s.people[personId];
    if (!person) throw Error('Missing participant');
    const commitment = promise(person, {
      kind: 'appointment',
      toId: 'mum',
      actions: ['check-in'],
      from: s.now,
      until: s.now + 3,
      importance: 1,
      label: 'The check-in is happening now',
    });
    const before = structuredClone(s);
    s = act(s, 'operations-accept-operations-trolley-first');
    expect(s.now).toBe(before.now);
    expect(s.operations).toEqual(before.operations);
    expect(s.objects).toEqual(before.objects);
    expect(s.people[personId]?.agenda.commitments.find((c) => c.id === commitment.id)?.status).toBe(
      'pending',
    );
    expect(s.people[personId]?.trace.at(-1)?.chosenAffordanceId).toBe(`attend-${commitment.id}`);
  },
);
