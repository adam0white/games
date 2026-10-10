import { expect, it } from 'vitest';
import { getView, restoreGame, serializeGame } from '../src/game/engine';
import { earnedHandoff } from './support/earned-handoff';
import { choose } from './support/school-route';

for (const seed of [17, 42, 1701, 1000, 1, 2, 3, 7, 99, 256, 2026, 65535])
  for (const eager of [false, true])
    it(`public breadth ${seed} eager ${eager}`, () => {
      let s = earnedHandoff(eager, seed);
      expect(restoreGame(serializeGame(s))).toEqual(s);
      s = choose(s, 'service-begin');
      s = choose(s, 'service-private');
      for (
        let n = 0;
        n < 10 && !getView(s).actions.some((a) => a.id === 'service-close-small');
        n++
      )
        s = choose(s, 'service-next-day');
      s = choose(s, 'service-close-small');
      expect(s.serviceWeek?.conclusion).toBe('small');
      expect(restoreGame(serializeGame(s))).toEqual(s);
    });
