import { expect, it } from 'vitest';
import { restoreGame, serializeGame } from '../src/game/engine';
import { earnedHandoff } from './support/earned-handoff';

it('a new fourteen-year-old can finish school, find teaching without an earlier chat and hand over a real whole repair', () => {
  const s = earnedHandoff();
  expect(restoreGame(serializeGame(s))).toEqual(s);
});
