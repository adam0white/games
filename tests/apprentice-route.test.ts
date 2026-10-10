import { expect, it } from 'vitest';
import { type createGame, getView, restoreGame, serializeGame } from '../src/game/engine';
import * as old from '../src/game/engine3';
import { positiveAction } from './support/public-attendance';

const act = positiveAction;
function adultHistory() {
  let s = old.createGame(42);
  const action = (id: string) => {
    s = old.transition(s, { type: 'action', id });
  };
  for (const id of [
    'talk-family',
    'inspect',
    'clean-contact',
    'verify',
    'rest',
    'check-result',
    'return',
    'inspect',
    'shelve',
    'talk-garage',
    'talk-friends',
  ])
    action(id);
  for (let n = 0; n < 2; n++) {
    action('accept-request');
    action('inspect');
    action('test-battery');
    const item = s.objects.find((x) => x.id === s.focusId);
    action(
      item?.fault === 'battery'
        ? 'replace-battery'
        : item?.fault === 'cap'
          ? 'twist-cap'
          : 'clean-contact',
    );
    action('verify');
    action('rest');
    action('check-result');
    if (n === 1) action('observer-invite');
    action('return');
  }
  return restoreGame(old.serializeGame(s));
}
function arrive(s: ReturnType<typeof createGame>) {
  s = act(s, 'next-day');
  for (let n = 0; n < 8; n++) s = act(s, 'wait-person');
  for (let n = 0; n < 80; n++) {
    if (getView(s).actions.some((x) => x.id === 'arrange-learning')) s = act(s, 'arrange-learning');
    if (s.apprentice?.arranged && s.now < s.apprentice.visitUntil) return s;
    s = act(s, getView(s).actions.some((x) => x.id === 'wait-person') ? 'wait-person' : 'next-day');
  }
  throw Error('No genuine learning agreement reached');
}
function teachLight(s: ReturnType<typeof createGame>) {
  s = act(s, 'learning-light');
  for (const id of ['inspect', 'test-battery']) {
    s = act(s, id);
  }
  const tired = getView(s).focus?.observations.some((observation) =>
    observation.includes('old battery is tired'),
  );
  s = act(s, tired ? 'replace-battery' : 'clean-contact');
  s = act(s, 'reassemble');
  expect(
    s.people.sam?.methods?.rules.some((rule) =>
      ['open-access', 'reassemble'].includes(rule.action),
    ),
  ).toBe(false);
  s = act(s, 'verify');
  s = act(s, 'wait-check');
  if (getView(s).actions.some((a) => a.id === 'wait-check')) s = act(s, 'wait-check');
  s = act(s, 'check-result');
  if ((s.apprentice?.visitUntil ?? 0) - s.now < 25 || s.people.sam?.activity?.action !== 'learn')
    s = arrive(s);
  s = act(s, 'return');
  return s;
}
it('the actual watched manual-input route teaches Sam, saves a pending independent step, and replays its owner outcome', () => {
  let s = arrive(adultHistory());
  expect(s.apprentice?.arranged).toBe(true);
  s = teachLight(s);
  s = teachLight(arrive(s));
  expect(s.people.sam?.methods?.rules.length).toBeGreaterThan(5);
  s = arrive(s);
  s = act(s, 'supervised-intake');
  for (let n = 0; n < 8 && s.apprentice?.jobId; n++) s = act(s, 'watch-sam');
  expect(s.apprentice?.supervisedCompleted).toBe(true);
  s = arrive(s);
  s = act(s, 'independent-intake');
  // The separate physical refit adds three real minutes before verification.
  for (
    let n = 0;
    n < 3 && s.objects.find((item) => item.id === 'independent-light')?.checkStarted === undefined;
    n++
  )
    s = act(s, 'watch-sam');
  expect(s.apprentice?.needsHelp, JSON.stringify(s.apprentice)).toBeUndefined();
  expect(s.apprentice?.jobId).toBe('independent-light');
  expect(s.objects.find((x) => x.id === 'independent-light')?.checkStarted).toBeDefined();
  const saved = serializeGame(s);
  s = restoreGame(saved);
  expect(serializeGame(s)).toBe(saved);
  let delayed = structuredClone(s);
  if (!delayed.world?.presence.nora) throw Error('Missing Nora');
  delayed.world.presence.nora.awayUntil = delayed.now + 120;
  for (
    let n = 0;
    n < 5 && !delayed.objects.find((x) => x.id === 'independent-light')?.awaitingCollection;
    n++
  )
    delayed = act(delayed, 'watch-sam');
  expect(delayed.objects.find((x) => x.id === 'independent-light')?.awaitingCollection).toBe(true);
  for (let waits = 0; waits < 80 && delayed.apprentice?.jobId; waits++)
    delayed = act(delayed, 'watch-sam');
  expect(delayed.objects.find((x) => x.id === 'independent-light')?.awaitingCollection).toBe(false);
  expect(delayed.apprentice?.completedJobIds).toEqual(['independent-light']);
  for (let n = 0; n < 8 && s.apprentice?.jobId; n++) s = act(s, 'watch-sam');
  expect(s.apprentice?.completedJobIds).toEqual(['independent-light']);
  expect(
    s.objects
      .find((x) => x.id === 'independent-light')
      ?.stepDecisions?.every((d) => d.methods.length),
  ).toBe(true);
  expect(restoreGame(serializeGame(s))).toEqual(s);
  const before = serializeGame(s);
  getView(s);
  getView(s);
  expect(serializeGame(s)).toBe(before);
});
