import { type Affordance, begin, decide, promise } from '@adam0white/human-framework';
import { expect, it } from 'vitest';
import { createGame, getView, restoreGame, serializeGame, transition } from '../src/game/engine';
import * as published from '../src/game/engine19';
import { positiveAction } from './support/public-attendance';

it('setting Mum’s unfinished lamp aside opens actual own work without a handover or reward', () => {
  let s = createGame(17);
  s = positiveAction(s, 'talk-family');
  s = positiveAction(s, 'inspect');
  s = positiveAction(s, 'shelve');
  const family = structuredClone(s.objects.find((o) => o.id === 'family'));
  const repairs = s.repairs;
  const parts = structuredClone(s.parts);
  expect(family).toMatchObject({ location: 'shelf', verified: false, repaired: false });
  expect(getView(s).actions.some((a) => a.id === 'bring-bedside')).toBe(true);
  s = positiveAction(s, 'bring-bedside');
  expect(s.objects.find((o) => o.id === 'family')).toEqual(family);
  expect(s.objects.filter((o) => o.id === 'personal')).toHaveLength(1);
  expect(s.objects.find((o) => o.id === 'personal')).toMatchObject({
    owner: 'You',
    inspected: false,
    repaired: false,
    verified: false,
  });
  expect(s.repairs).toBe(repairs);
  expect(s.parts).toEqual(parts);
  expect(getView(s).actions.some((a) => a.id === 'bring-bedside')).toBe(false);
  expect(getView(s).actions.some((a) => a.id === 'talk-garage')).toBe(true);
  s = positiveAction(s, 'inspect');
  expect(s.objects.find((o) => o.id === 'personal')?.inspected).toBe(true);
  s = transition(s, { type: 'select', id: 'family' });
  expect(s.objects.find((o) => o.id === 'family')?.verified).toBe(false);
  expect(s.objects.find((o) => o.id === 'family')?.collectedAt).toBeUndefined();
  expect(restoreGame(serializeGame(s))).toEqual(s);
});

it('remembering the bedside lamp does not retrieve it while the player keeps an earlier obligation', () => {
  let s = createGame(17);
  for (const id of ['talk-family', 'shelve']) s = positiveAction(s, id);
  const player = s.people.player;
  if (!player) throw Error('Missing player');
  const duty = promise(player, {
    kind: 'appointment',
    toId: 'dad',
    actions: ['check-in'],
    from: s.now,
    until: s.now + 30,
    importance: 1,
    label: 'Earlier promised check-in',
  });
  const offer: Affordance = {
    id: 'bedside-prior-duty',
    label: 'Keep my earlier promise',
    action: 'check-in',
    duration: 30,
    effort: 0,
    fulfills: [duty.id],
    advertises: { belonging: 0.3 },
  };
  begin(player, offer, decide(player, [offer]));
  const before = structuredClone(s);
  s = transition(s, { type: 'action', id: 'bring-bedside' });
  expect(s.now).toBe(before.now);
  expect(s.objects).toEqual(before.objects);
  expect(s.parts).toEqual(before.parts);
  expect(s.people.player?.activity?.affordanceId).toBe('bedside-prior-duty');
  expect(getView(s).actions.some((a) => a.id === 'bring-bedside')).toBe(true);
});

it('an already shelved published save receives the opportunity without rewriting its earlier story', () => {
  let prior = published.createGame(17);
  for (const id of ['talk-family', 'inspect', 'shelve'])
    prior = published.transition(prior, { type: 'action', id });
  const raw = published.serializeGame(prior);
  const current = restoreGame(raw);
  expect(current.objects.find((o) => o.id === 'family')?.location).toBe('shelf');
  expect(getView(current).actions.some((a) => a.id === 'bring-bedside')).toBe(true);
  expect(current.engine3Save).toBe(raw);
  expect(current.inputs).toEqual(prior.inputs);
  expect(current.objects).toEqual(prior.objects);
  expect(current.journal).toEqual(prior.journal);
});

it('the actual fresh-player pickup during bedside retrieval creates only one lamp and preserves its partial work', () => {
  let s = createGame(1701);
  for (const id of [
    'talk-family',
    'inspect',
    'test-battery',
    'clean-contact',
    'reassemble',
    'verify',
    'rest',
    'check-result',
    'leave-ready-family',
  ])
    s = transition(s, { type: 'action', id });
  expect(s.now).toBe(907);
  expect(s.objects.some((o) => o.id === 'personal')).toBe(false);
  expect(s.objects.find((o) => o.id === 'family')?.awaitingCollection).toBe(true);
  s = transition(s, { type: 'action', id: 'bring-bedside' });
  expect(s.objects.find((o) => o.id === 'family')).toMatchObject({
    location: 'returned',
    awaitingCollection: false,
  });
  expect(s.objects.filter((o) => o.id === 'personal')).toHaveLength(1);
  for (const id of ['inspect', 'talk-garage', 'search-donor', 'fit-holder'])
    s = transition(s, { type: 'action', id });
  const lamp = structuredClone(s.objects.find((o) => o.id === 'personal'));
  expect(lamp).toMatchObject({ repaired: true, verified: false });
  s = transition(s, { type: 'action', id: 'shelve' });
  expect(s.objects.filter((o) => o.id === 'personal')).toHaveLength(1);
  expect(s.objects.find((o) => o.id === 'personal')).toEqual({ ...lamp, location: 'shelf' });
  expect(restoreGame(serializeGame(s))).toEqual(s);
});
