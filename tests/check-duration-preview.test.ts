import { expect, it } from 'vitest';
import { createGame, getView, restoreGame, serializeGame, transition } from '../src/game/engine';
import { positiveAction } from './support/public-attendance';

it('the light-wait preview uses its actual remaining time and still requires reading the result', () => {
  let s = createGame(42);
  for (const id of ['talk-family', 'inspect', 'clean-contact', 'reassemble', 'verify'])
    s = positiveAction(s, id);
  s = transition(s, { type: 'action', id: 'wait-check' });
  const beforeAsk = s.now;
  s = transition(s, { type: 'action', id: 'ask-mum' });
  expect(s.now).toBe(beforeAsk);
  expect(getView(s).actions.find((action) => action.id === 'wait-check')?.detail).toContain(
    '10 quiet minutes',
  );
  const before = s.now;
  s = transition(s, { type: 'action', id: 'wait-check' });
  expect(s.now - before).toBe(10);
  expect(s.objects.find((item) => item.id === 'family')?.verified).toBe(false);
  expect(getView(s).actions.some((action) => action.id === 'wait-check')).toBe(false);
  expect(getView(s).actions.some((action) => action.id === 'check-result')).toBe(true);
  s = positiveAction(s, 'check-result');
  expect(s.objects.find((item) => item.id === 'family')?.verified).toBe(true);
  expect(restoreGame(serializeGame(s))).toEqual(s);
});
