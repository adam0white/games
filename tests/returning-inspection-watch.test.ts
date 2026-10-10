import { begin, decide, finish, promise } from '@adam0white/human-framework';
import { expect, it } from 'vitest';
import { advanceApprentice, hasIntakeMethod, startApprenticeJob } from '../src/game/apprentice';
import { getView, restoreGame, transition } from '../src/game/engine';
import * as eighteen from '../src/game/engine18';
import type { GameInput } from '../src/game/types';
import original from './fixtures/eighteen-owner-exhausted.json';
import prefix from './fixtures/twenty-returning-watch-prefix.json';

function watchingOwner() {
  let old = eighteen.createGame(original.seed);
  for (const e of original.inputs) old = eighteen.transition(old, e.input as GameInput);
  let s = restoreGame(eighteen.serializeGame(old));
  for (const e of prefix.inputs) s = transition(s, e.input as GameInput);
  return s;
}
it('the actual returning owner keeps the accepted watch and teaches the missing first inspection through ordinary work', () => {
  const s = watchingOwner();
  expect(s.now % 1440).toBe(16 * 60 + 4);
  expect(hasIntakeMethod(s)).toBe(false);
  expect(getView(s).workCompanion?.state).toBe('watching');
  expect(getView(s).actions.some((a) => a.id === 'supervised-repair')).toBe(false);
  expect(getView(s).actions.some((a) => a.id === 'inspect')).toBe(true);
  expect(getView(s).dayPlan?.entries.find((e) => e.id === 'sam-work')?.detail).toContain(
    'actual inspection',
  );
  const no = structuredClone(s),
    sam = no.people.sam;
  if (!sam?.activity) throw Error('Missing watch');
  finish(sam, {
    affordanceId: sam.activity.affordanceId,
    action: sam.activity.action,
    at: sam.now,
    status: 'interrupted',
    summary: 'The observed stretch ends before the inspection.',
  });
  const yes = transition(s, { type: 'action', id: 'inspect' });
  const withheld = transition(no, { type: 'action', id: 'inspect' });
  expect(yes.objects.find((o) => o.id === 'service-leila')?.inspected).toBe(true);
  expect(hasIntakeMethod(yes)).toBe(true);
  expect(hasIntakeMethod(withheld)).toBe(false);
  expect(getView(withheld).dayPlan?.entries.find((e) => e.id === 'sam-work')?.status).not.toBe(
    'underway',
  );
});
it('an already stopped uninspected repair offers a real demonstration; a stronger current duty preserves its custody and knowledge', () => {
  const s = watchingOwner();
  const item = s.objects.find((o) => o.id === 'service-leila');
  if (!item) throw Error('Missing actual retained lamp');
  // Reproduce the old host's already-assigned stop without granting a method.
  startApprenticeJob(s, item, true, () => {});
  advanceApprentice(
    s,
    s.now + 4,
    () => {},
    () => false,
  );
  s.now += 4;
  expect(s.apprentice?.needsHelp).toBeTruthy();
  expect(getView(s).actions.find((a) => a.id === 'show-corrective-step')?.label).toBe(
    'Show Sam how you begin looking',
  );
  const sam = s.people.sam;
  if (!sam) throw Error('Missing Sam');
  if (sam.activity)
    finish(sam, {
      affordanceId: sam.activity.affordanceId,
      action: sam.activity.action,
      at: sam.now,
      status: 'interrupted',
      summary: 'Control begins the previously agreed check-in.',
    });
  const duty = promise(sam, {
    kind: 'promise',
    toId: 'mum',
    actions: ['check-in'],
    from: sam.now,
    until: sam.now + 30,
    importance: 1,
    label: 'Previously agreed check-in',
  });
  const own = {
    id: 'promised-check-in',
    action: 'check-in',
    label: 'Keeping the promised check-in',
    duration: 30,
    effort: 0,
    fulfills: [duty.id],
    with: ['mum'],
    advertises: { belonging: 0.1 },
  };
  expect(begin(sam, own, decide(sam, [own]))).toBeTruthy();
  const before = structuredClone(s);
  const refused = transition(s, { type: 'action', id: 'show-corrective-step' });
  expect(refused.apprentice?.jobId).toBe(before.apprentice?.jobId);
  expect(refused.objects.find((o) => o.id === item.id)?.inspected).toBe(false);
  expect(hasIntakeMethod(refused)).toBe(false);
  expect(refused.people.sam?.activity?.affordanceId).toBe('promised-check-in');
});
