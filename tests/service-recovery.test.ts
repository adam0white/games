import { expect, it } from 'vitest';
import { getView, restoreGame, serializeGame, transition } from '../src/game/engine';
import type { GameState } from '../src/game/types';
import { earnedHandoff } from './support/earned-handoff';
import { choose } from './support/school-route';

const has = (s: GameState, id: string) => getView(s).actions.some((a) => a.id === id);

it('an honestly unchecked service return can recover or settle without trapping the week', () => {
  let s = earnedHandoff();
  s = choose(s, 'service-begin');
  s = choose(s, 'service-regular');
  for (let n = 0; n < 100 && !has(s, 'service-hear-leila'); n++)
    s = choose(s, has(s, 'wait-appointment') ? 'wait-appointment' : 'rest');
  s = choose(s, 'service-hear-leila');
  s = choose(s, 'service-accept-leila');
  for (const id of ['inspect', 'test-battery', 'replace-battery', 'verify', 'early-return'])
    s = choose(s, id);
  // Leila is out when this route offers the unchecked lamp. Custody changes
  // only when she actually returns and collects it.
  expect(s.objects.find((o) => o.id === 'service-leila')).toMatchObject({
    location: 'shelf',
    awaitingCollection: true,
  });
  for (
    let n = 0;
    n < 100 && s.objects.find((o) => o.id === 'service-leila')?.awaitingCollection;
    n++
  )
    s = choose(s, has(s, 'wait-appointment') ? 'wait-appointment' : 'rest');
  const item = s.objects.find((o) => o.id === 'service-leila');
  expect(item?.verified).toBe(false);
  expect(item?.location).toBe('returned');
  expect(item?.awaitingCollection).toBe(false);
  expect(item?.collectedAt).toBeDefined();
  expect(s.workshop?.cash ?? 0).toBe(0);
  for (let n = 0; n < 6 && has(s, 'service-next-day'); n++) s = choose(s, 'service-next-day');
  expect(s.objects.find((o) => o.id === 'service-leila')?.location).toBe('returned');
  expect(s.serviceWeek?.jobs.find((j) => j.id === 'service-leila')?.stage).toBe('accepted');
  s = choose(s, 'rest');
  if (s.objects.find((o) => o.id === 'service-leila')?.location === 'shelf') {
    expect(s.objects.find((o) => o.id === 'service-leila')?.callbackSeen).toBe(true);
    s = transition(s, { type: 'select', id: 'service-leila' });
  }
  // A non-completed promise must remain honest; either an agreed settlement or
  // a concrete path back to physical checking must remain available.
  expect(
    has(s, 'verify') ||
      has(s, 'service-close-regular') ||
      getView(s).actions.some((a) => /revisit|unfinished|withdraw|recover/i.test(a.label)),
  ).toBe(true);
});

it('actual owner consent settles or returns an unchecked light without inventing fee, kept promise or independent credit', () => {
  let s = earnedHandoff();
  for (const id of ['service-begin', 'service-regular']) s = choose(s, id);
  for (let waits = 0; waits < 80 && !has(s, 'service-hear-leila'); waits++)
    s = choose(s, has(s, 'wait-appointment') ? 'wait-appointment' : 'rest');
  for (const id of [
    'service-hear-leila',
    'service-accept-leila',
    'inspect',
    'test-battery',
    'replace-battery',
    'verify',
    'early-return',
  ])
    s = choose(s, id);
  for (let days = 0; days < 20 && has(s, 'service-next-day'); days++)
    s = choose(s, 'service-next-day');
  const priorPromise = structuredClone(
    s.people.player?.agenda.commitments.find(
      (c) => c.label === 'Checked collection: service-leila',
    ),
  );
  for (
    let n = 0;
    n < 8 &&
    s.serviceWeek?.jobs.find((j) => j.id === 'service-leila')?.stage === 'accepted' &&
    s.objects.find((o) => o.id === 'service-leila')?.location === 'returned';
    n++
  ) {
    s = choose(s, 'service-revisit-unfinished-leila');
    if (has(s, 'wait-appointment')) s = choose(s, 'wait-appointment');
  }
  expect(s.workshop?.cash ?? 0).toBe(0);
  expect(s.objects.find((o) => o.id === 'service-leila')?.verified).toBe(false);
  expect(
    s.people.player?.agenda.commitments.find(
      (c) => c.label === 'Checked collection: service-leila',
    ),
  ).toEqual(priorPromise);
  const item = s.objects.find((o) => o.id === 'service-leila');
  if (item?.location === 'bench') {
    expect(item.checkStarted).toBeUndefined();
    for (const id of ['verify', 'wait-check', 'check-result', 'return']) s = choose(s, id);
  } else {
    expect(s.serviceWeek?.jobs.find((j) => j.id === 'service-leila')?.stage).toBe(
      'returned-unchecked',
    );
    expect(s.workshop?.cash ?? 0).toBe(0);
  }
  expect(has(s, 'service-close-regular')).toBe(true);
  s = choose(s, 'service-close-regular');
  expect(s.serviceWeek?.conclusion).toBe('regular');
  expect(s.objects.find((o) => o.id === 'service-leila')?.independent).not.toBe(true);
  expect(restoreGame(serializeGame(s))).toEqual(s);
}, 30_000);
