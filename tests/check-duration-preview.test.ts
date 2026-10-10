import { expect, it } from 'vitest';
import { createGame, getView, restoreGame, serializeGame, transition } from '../src/game/engine';

it('the light-wait preview uses its actual remaining time and still requires reading the result', () => {
  let s = createGame(42);
  for (const id of ['talk-family', 'inspect', 'clean-contact', 'verify', 'wait-check', 'ask-mum'])
    s = transition(s, { type: 'action', id });
  expect(getView(s).actions.find((action) => action.id === 'wait-check')?.detail).toContain(
    '2 quiet minutes',
  );
  const before = s.now;
  s = transition(s, { type: 'action', id: 'wait-check' });
  expect(s.now - before).toBe(2);
  expect(s.objects.find((item) => item.id === 'family')?.verified).toBe(false);
  expect(getView(s).actions.some((action) => action.id === 'wait-check')).toBe(false);
  expect(getView(s).actions.some((action) => action.id === 'check-result')).toBe(true);
  s = transition(s, { type: 'action', id: 'check-result' });
  expect(s.objects.find((item) => item.id === 'family')?.verified).toBe(true);
  expect(restoreGame(serializeGame(s))).toEqual(s);
});
