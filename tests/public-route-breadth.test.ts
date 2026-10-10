import { expect, it } from 'vitest';
import { restoreGame, serializeGame } from '../src/game/engine';
import { earnedHandoff } from './support/earned-handoff';
import { beginPrivateWeek } from './support/public-attendance';

for (const seed of [17, 42, 1701, 1000, 1, 2, 3, 7, 99, 256, 2026, 65535])
  for (const eager of [false, true])
    it(`public breadth ${seed} eager ${eager}`, () => {
      let s = earnedHandoff(eager, seed);
      expect(restoreGame(serializeGame(s))).toEqual(s);
      s = beginPrivateWeek(s);
      expect(s.serviceWeek?.conclusion).toBe('small');
      expect(restoreGame(serializeGame(s))).toEqual(s);
    }, 20_000);
