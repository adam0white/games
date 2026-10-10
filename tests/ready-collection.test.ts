import { type Affordance, begin, decide, promise } from '@adam0white/human-framework';
import { beforeAll, expect, it } from 'vitest';
import { createGame, getView, restoreGame, serializeGame, transition } from '../src/game/engine';
import * as old from '../src/game/engine18';
import { advanceReadyCollections, leaveReady } from '../src/game/ready-collection';
import type { GameInput, GameState } from '../src/game/types';
import owner from './fixtures/eighteen-owner-exhausted.json';
import { earnedHandoff } from './support/earned-handoff';
import { positiveAction } from './support/public-attendance';

const act = (s: GameState, id: string) => transition(s, { type: 'action', id });
function checked() {
  let s = createGame(17);
  s.chapter = 'garage';
  if (s.campaign) s.campaign.graduated = true;
  s.unlocked.push('story:observer-invite');
  s = act(s, 'mechanical-intake-stand');
  for (const id of [
    'inspect',
    'test-mechanical-empty',
    'test-mechanical-loaded',
    'open-access',
    'clear-obstruction',
    'reassemble',
    'check-result',
  ])
    s = act(s, id);
  return s;
}
it('a safe labelled object remains workshop property until its owner really picks it up', () => {
  let s = checked();
  const sam = s.people.sam;
  if (!sam) throw Error('Missing Sam');
  const c = promise(sam, {
    kind: 'promise',
    toId: 'mum',
    actions: ['check-in'],
    from: s.now,
    until: s.now + 90,
    importance: 1,
    label: 'Earlier promised check-in',
  });
  const offer: Affordance = {
    id: 'own-check-in',
    action: 'check-in',
    label: 'Keep earlier check-in',
    duration: 90,
    effort: 0,
    fulfills: [c.id],
    advertises: { belonging: 0.3 },
  };
  begin(sam, offer, decide(sam, [offer]));
  s = act(s, 'leave-ready-mechanical-stand');
  const cash = s.workshop?.cash;
  expect(s.objects.find((o) => o.id === 'mechanical-stand')).toMatchObject({
    location: 'shelf',
    awaitingCollection: true,
    verified: true,
  });
  expect(s.objects.find((o) => o.id === 'mechanical-stand')?.collectedAt).toBeUndefined();
  expect(getView(s).saturdayWindow?.blockerObjects.some((o) => o.id === 'mechanical-stand')).toBe(
    false,
  );
  s = transition(s, { type: 'select', id: 'mechanical-stand' });
  expect(s.objects.find((o) => o.id === 'mechanical-stand')?.location).toBe('shelf');
  expect(getView(s).actions.some((a) => a.id === 'inspect')).toBe(false);
  s = act(s, 'find-paper-street');
  s = act(s, 'inspect');
  expect(s.objects.find((o) => o.id === 'mechanical-stand')?.collectedAt).toBeUndefined();
  expect(s.people.sam?.activity?.affordanceId).toBe('own-check-in');
  expect(s.workshop?.cash).toBe(cash);
  const player = s.people.player;
  if (!player) throw Error('Missing player');
  promise(player, {
    kind: 'appointment',
    toId: 'dad',
    actions: ['meet'],
    from: s.now + 10000,
    until: s.now + 10100,
    importance: 1,
    label: 'Later commitment',
  });
  expect(getView(s).saturdayWindow?.departureBlockers).not.toContain(
    'Keep or cancel the agreed time: Later commitment.',
  );
  promise(player, {
    kind: 'appointment',
    toId: 'dad',
    actions: ['meet'],
    from: s.now + 10,
    until: s.now + 30,
    importance: 1,
    label: 'During the outing',
  });
  expect(getView(s).saturdayWindow?.departureBlockers).toContain(
    'Keep or cancel the agreed time: During the outing.',
  );
});
let expertStart: GameState;
beforeAll(() => {
  let s = old.createGame(owner.seed);
  for (const e of owner.inputs) s = old.transition(s, e.input as GameInput);
  expertStart = restoreGame(old.serializeGame(s));
  for (const id of [
    'wait-known-sam-2121900',
    'mechanical-intake-stand',
    'arrange-learning',
    'inspect',
    'test-mechanical-loaded',
    'test-mechanical-empty',
    'open-access',
    'clear-obstruction',
    'reassemble',
    'test-mechanical-loaded',
    'check-result',
  ])
    expertStart = act(expertStart, id);
}, 20000);
it('the actual expert’s13:45 branch can leave the stand and continue useful work without handover polling', {
  timeout: 20000,
}, () => {
  let s = expertStart;
  expect(s.now).toBe(2121945);
  s = act(s, 'leave-ready-mechanical-stand');
  expect(s.objects.find((o) => o.id === 'mechanical-stand')?.readyCollection).toBeDefined();
  for (const id of [
    'saturday-open-look',
    'saturday-agree',
    'saturday-compare-loaded',
    'saturday-look-under',
    'saturday-refit-brace',
    'saturday-check-load',
  ])
    s = act(s, id);
  const stand = s.objects.find((o) => o.id === 'mechanical-stand');
  expect(stand).toMatchObject({ location: 'returned', awaitingCollection: false, verified: true });
  expect(stand?.collectedAt).toBeGreaterThan(2121945);
  expect(s.saturdayWindow?.shelf.checked).toBe(true);
  expect(
    s.inputs
      .slice(expertStart.inputs.length)
      .some((e) => e.input.type === 'action' && e.input.id.startsWith('wait')),
  ).toBe(false);
  expect(restoreGame(serializeGame(s))).toEqual(s);
});
it('ordinary school repairs can be left for their owner before graduation', () => {
  let s = createGame(17);
  s.chapter = 'garage';
  s.objects.push({
    id: 'school-timer',
    title: 'Mum’s kitchen timer',
    owner: 'Mum',
    story: 'A checked school-holiday repair',
    form: 'timer',
    appearance: 'timer',
    fault: 'jam',
    location: 'bench',
    observations: ['The full repeated-operation check passed.'],
    inspected: true,
    tested: true,
    attempted: 1,
    repaired: true,
    verified: true,
    discovered: true,
  });
  s.focusId = 'school-timer';
  expect(s.campaign?.graduated).not.toBe(true);
  expect(getView(s).actions.some((a) => a.id === 'leave-ready-school-timer')).toBe(true);
  s = act(s, 'leave-ready-school-timer');
  s = act(s, 'find-paper-street');
  s = act(s, 'inspect');
  expect(s.objects.find((o) => o.id === 'school-timer')).toMatchObject({
    location: 'returned',
    awaitingCollection: false,
    verified: true,
  });
  expect(s.objects.find((o) => o.id === 'paper-street')?.inspected).toBe(true);
});

it('a paid public workshop route settles once at actual labelled pickup, never while held', {
  timeout: 30000,
}, () => {
  let s = earnedHandoff(true);
  const reach = (id: string) => {
    for (let n = 0; n < 100 && !getView(s).actions.some((a) => a.id === id); n++)
      s = positiveAction(
        s,
        getView(s).actions.some((a) => a.id === 'wait-appointment') ? 'wait-appointment' : 'rest',
      );
    expect(
      getView(s).actions.some((a) => a.id === id),
      id,
    ).toBe(true);
    s = positiveAction(s, id);
  };
  for (const id of [
    'workshop-referral-ask',
    'workshop-priced',
    'workshop-intake-space',
    'workshop-leila-arrival',
    'workshop-quote-leila',
    'workshop-accept-leila',
  ])
    reach(id);
  for (const id of ['inspect', 'test-battery', 'replace-battery', 'verify'])
    s = positiveAction(s, id);
  if (getView(s).actions.some((a) => a.id === 'wait-check')) s = positiveAction(s, 'wait-check');
  reach('check-result');
  const before = s.workshop?.cash ?? 0;
  const owner = s.people.leila;
  if (!owner) throw Error('Missing Leila');
  const withheld = structuredClone(s);
  const busy = withheld.people.leila;
  if (!busy) throw Error('Missing Leila');
  const duty = promise(busy, {
    kind: 'appointment',
    toId: 'mum',
    actions: ['check-in'],
    from: busy.now,
    until: busy.now + 90,
    importance: 1,
    label: 'Earlier promised check-in',
  });
  const offer: Affordance = {
    id: 'paid-pickup-duty',
    label: 'Keep the earlier check-in',
    action: 'check-in',
    duration: 90,
    effort: 0,
    fulfills: [duty.id],
    advertises: { belonging: 0.3 },
  };
  begin(busy, offer, decide(busy, [offer]));
  let held = positiveAction(withheld, 'leave-ready-workshop-leila');
  held = positiveAction(held, 'find-paper-street');
  held = positiveAction(held, 'inspect');
  expect(held.workshop?.cash).toBe(before);
  expect(held.workshop?.jobs.find((j) => j.id === 'workshop-leila')?.stage).toBe('accepted');
  expect(held.objects.find((o) => o.id === 'workshop-leila')?.collectedAt).toBeUndefined();
  reach('leave-ready-workshop-leila');
  reach('find-paper-street');
  reach('inspect');
  for (let n = 0; n < 50 && !s.objects.find((o) => o.id === 'workshop-leila')?.collectedAt; n++)
    s = positiveAction(s, 'rest');
  const item = s.objects.find((o) => o.id === 'workshop-leila');
  const job = s.workshop?.jobs.find((j) => j.id === item?.id);
  expect(job).toMatchObject({ stage: 'complete', collectedAt: item?.collectedAt });
  expect(s.workshop?.cash).toBe(before + (job?.fee ?? 0));
  expect(job?.fee).toBeGreaterThan(0);
  expect(
    (s.journal ?? []).filter((line) => line.at === item?.collectedAt && line.speaker === 'Leila'),
  ).toHaveLength(1);
  s = positiveAction(s, 'rest');
  expect(s.workshop?.ledger.filter((e) => e.id === 'workshop-leila:fee')).toHaveLength(1);
  expect(restoreGame(serializeGame(s))).toEqual(s);
});

it('a newly due owner appointment is offered before a longer ordinary activity ends', () => {
  const s = checked();
  const sam = s.people.sam;
  const item = s.objects.find((o) => o.id === 'mechanical-stand');
  if (!sam || !item) throw Error('Missing pickup actors');
  leaveReady(s, item);
  const rest: Affordance = {
    id: 'pickup-rest',
    label: 'Finish resting',
    action: 'rest',
    duration: 30,
    effort: 0,
    advertises: { rest: 1 },
  };
  begin(sam, rest, decide(sam, [rest]));
  const from = sam.now + 2;
  const duty = promise(sam, {
    kind: 'appointment',
    toId: 'mum',
    actions: ['check-in'],
    from,
    until: from + 3,
    importance: 1,
    label: 'Short promised visit',
  });
  advanceReadyCollections(
    s,
    sam.now + 10,
    () => true,
    () => {},
  );
  expect(sam.agenda.commitments.find((c) => c.id === duty.id)?.status).toBe('kept');
});

it('an older returned-but-still-held real label requires actual owner pickup; a wrong-owner label cannot authorize it', () => {
  const s = checked();
  const item = s.objects.find((o) => o.id === 'mechanical-stand');
  const sam = s.people.sam;
  if (!item || !sam) throw Error('Missing retained property');
  leaveReady(s, item);
  item.location = 'returned';
  const beforeRepairs = s.repairs;
  const blocked = structuredClone(s);
  const wrong = blocked.objects.find((o) => o.id === item.id);
  if (!wrong?.readyCollection) throw Error('Missing actual label');
  wrong.readyCollection.ownerId = 'nora';
  advanceReadyCollections(
    blocked,
    s.now + 10,
    () => true,
    () => {},
  );
  expect(wrong.awaitingCollection).toBe(true);
  expect(wrong.collectedAt).toBeUndefined();
  const receipts: number[] = [];
  advanceReadyCollections(
    s,
    s.now + 10,
    () => false,
    (_item, at) => receipts.push(at),
  );
  expect(item.awaitingCollection).toBe(true);
  expect(item.collectedAt).toBeUndefined();
  expect(s.repairs).toBe(beforeRepairs);
  advanceReadyCollections(
    s,
    sam.now + 20,
    () => true,
    (_item, at) => receipts.push(at),
  );
  expect(item.awaitingCollection).toBe(false);
  expect(item.location).toBe('returned');
  expect(receipts).toHaveLength(1);
  const count = s.repairs;
  advanceReadyCollections(
    s,
    sam.now + 20,
    () => true,
    (_item, at) => receipts.push(at),
  );
  expect(receipts).toHaveLength(1);
  expect(s.repairs).toBe(count);
});

it('a new checked return while its owner is out keeps shelf custody and defers completion to actual pickup', () => {
  let s = act(createGame(1701), 'talk-family');
  for (const id of [
    'inspect',
    'test-battery',
    'clean-contact',
    'reassemble',
    'verify',
    'wait-check',
    'check-result',
  ])
    s = positiveAction(s, id);
  const item = s.objects.find((o) => o.id === 'family');
  if (!item || !s.world) throw Error('Missing actual family repair');
  expect(item.verified).toBe(true);
  s.world.presence.mum = { awayUntil: s.now + 90, activity: 'Keeping her own plans' };
  const before = s.repairs;
  s = positiveAction(s, 'return');
  const held = s.objects.find((o) => o.id === 'family');
  expect(held).toMatchObject({ location: 'shelf', awaitingCollection: true, verified: true });
  expect(held?.readyCollection).toMatchObject({ ownerId: 'mum', repairCounted: false });
  expect(held?.collectedAt).toBeUndefined();
  expect(s.repairs).toBe(before);
});

it('a labelled service pickup gives one contextual owner response and one fee without independent credit', {
  timeout: 30000,
}, () => {
  let s = earnedHandoff();
  const reach = (id: string) => {
    for (let n = 0; n < 100 && !getView(s).actions.some((a) => a.id === id); n++)
      s = positiveAction(
        s,
        getView(s).actions.some((a) => a.id === 'wait-appointment') ? 'wait-appointment' : 'rest',
      );
    expect(
      getView(s).actions.some((a) => a.id === id),
      id,
    ).toBe(true);
    s = positiveAction(s, id);
  };
  for (const id of [
    'service-begin',
    'service-regular',
    'service-hear-leila',
    'service-accept-leila',
  ])
    reach(id);
  for (const id of ['inspect', 'test-battery', 'replace-battery', 'verify'])
    s = positiveAction(s, id);
  if (getView(s).actions.some((a) => a.id === 'wait-check')) s = positiveAction(s, 'wait-check');
  reach('check-result');
  const cash = s.workshop?.cash ?? 0;
  const independent = s.apprentice?.independentCompleted;
  reach('leave-ready-service-leila');
  for (let n = 0; n < 100 && !s.objects.find((o) => o.id === 'service-leila')?.collectedAt; n++)
    s = positiveAction(
      s,
      getView(s).actions.some((a) => a.id === 'wait-appointment') ? 'wait-appointment' : 'rest',
    );
  const item = s.objects.find((o) => o.id === 'service-leila');
  expect(item).toMatchObject({ location: 'returned', awaitingCollection: false, verified: true });
  expect(item?.collectedAt).toBeDefined();
  const ownerLines = (s.journal ?? []).filter(
    (line) =>
      line.speaker === 'Leila' &&
      line.at !== undefined &&
      line.at >= (item?.collectedAt ?? Infinity),
  );
  expect(ownerLines).toHaveLength(1);
  expect(ownerLines[0]?.text).toContain('I read your note and picked up my lamp');
  expect(s.serviceWeek?.jobs.find((j) => j.id === 'service-leila')).toMatchObject({
    stage: 'returned',
    independent: false,
    samFee: 0,
  });
  expect(s.workshop?.cash).toBe(cash + 500);
  expect(s.apprentice?.independentCompleted).toBe(independent);
  const promiseStatus = s.people.player?.agenda.commitments.find(
    (c) => c.label === 'Checked collection: service-leila',
  )?.status;
  s = positiveAction(s, 'rest');
  expect(s.workshop?.ledger.filter((entry) => entry.id === 'service-leila:fee')).toHaveLength(1);
  expect(s.workshop?.cash).toBe(cash + 500);
  expect(s.apprentice?.independentCompleted).toBe(independent);
  expect(
    s.people.player?.agenda.commitments.find((c) => c.label === 'Checked collection: service-leila')
      ?.status,
  ).toBe(promiseStatus);
});
