import { expect, it } from 'vitest';
import {
  type createGame,
  getView,
  restoreGame,
  serializeGame,
  transition,
} from '../src/game/engine';
import * as old from '../src/game/engine3';

const act = (s: ReturnType<typeof createGame>, id: string) => transition(s, { type: 'action', id });
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
  return act(s, 'arrange-learning');
}
function teachLight(s: ReturnType<typeof createGame>, repeat = false) {
  s = act(s, 'learning-light');
  for (const id of ['inspect', 'test-battery']) {
    s = act(s, id);
    if (!repeat) s = act(s, 'explain-step');
  }
  const item = s.objects.find((x) => x.id === s.focusId);
  s = act(s, item?.fault === 'battery' ? 'replace-battery' : 'clean-contact');
  s = act(s, 'explain-step');
  s = act(s, 'verify');
  if (!repeat) s = act(s, 'explain-step');
  s = act(s, 'wait-check');
  if (!repeat) s = act(s, 'explain-step');
  s = act(s, 'wait-check');
  s = act(s, 'check-result');
  if (!repeat) s = act(s, 'explain-step');
  s = act(s, 'return');
  return repeat ? s : act(s, 'explain-step');
}
it('the actual explained-manual-input route teaches Sam, saves a pending independent step, and replays its owner outcome', () => {
  let s = arrive(adultHistory());
  expect(s.apprentice?.arranged).toBe(true);
  s = teachLight(s);
  s = teachLight(s, true);
  expect(s.people.sam?.methods?.rules.length).toBeGreaterThan(5);
  s = arrive(s);
  s = act(s, 'supervised-intake');
  for (let n = 0; n < 8 && s.apprentice?.jobId; n++) s = act(s, 'watch-sam');
  expect(s.apprentice?.supervisedCompleted).toBe(true);
  s = arrive(s);
  s = act(s, 'independent-intake');
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
  while (delayed.apprentice?.jobId) delayed = act(delayed, 'watch-sam');
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
