import { expect, it } from 'vitest';
import { getView, restoreGame, serializeGame, transition } from '../src/game/engine';
import { earnedHandoff } from './support/earned-handoff';

it('waits directly for the actually heard Sam time despite an earlier Nora time, without granting an agreement', () => {
  let s = earnedHandoff();
  s = transition(s, { type: 'action', id: 'next-day' });
  const view = getView(s);
  const nora = view.knownAppointments?.find((x) => x.personId === 'nora');
  const sam = view.knownAppointments?.find((x) => x.personId === 'sam');
  expect(nora).toBeTruthy();
  expect(sam).toBeTruthy();
  if (!nora || !sam) throw Error('Missing received morning cues');
  expect(nora.at).toBeLessThan(sam.at);
  const action = view.dayPlan?.entries.find((x) => x.id === `known-sam-${sam.at}`)?.actionIds?.[0];
  expect(action).toBe(`wait-known-sam-${sam.at}`);
  const deadline = s.apprentice?.visitUntil;
  s = transition(s, { type: 'action', id: action ?? '' });
  expect(s.now).toBe(sam.at);
  expect(Object.values(s.people).every((x) => x.now === s.now)).toBe(true);
  expect(s.apprentice?.visitUntil).toBe(deadline);
  expect(restoreGame(serializeGame(s))).toEqual(s);
}, 30_000);
it('exposes no targeted wait for a withheld routine or an arbitrary future target', () => {
  let s = earnedHandoff();
  s = transition(s, { type: 'action', id: 'next-day' });
  s.samPlans = undefined;
  s.unlocked = s.unlocked.filter(
    (x) =>
      !x.startsWith('known-request:') &&
      !x.startsWith('heard-counter:') &&
      x !== 'sam-afternoon-note',
  );
  const view = getView(s);
  expect(view.knownAppointments?.some((x) => x.personId === 'sam')).toBe(false);
  expect(view.actions.some((x) => x.id.startsWith('wait-known-sam-'))).toBe(false);
  expect(() => transition(s, { type: 'action', id: `wait-known-sam-${s.now + 10000}` })).toThrow(
    'not available',
  );
}, 30_000);
