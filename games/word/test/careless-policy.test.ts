import { describe, expect, it } from 'vitest';
import { act, createGame, view } from '../src/game';
import { carelessPolicy } from './support/careless-policy';
import { expectReplay } from './support/replay';

// One case per seed: each full HF 4 run and its replay stay inside the default per-test budget.
describe('uninformed drafting and refusal retries retain a real loss across 64 seeds', () => {
  for (let seed = 0; seed < 64; seed++)
    it(`seed ${seed}`, () => {
      const state = createGame(seed);
      const decide = carelessPolicy(seed);
      for (let step = 0; step < 100 && state.result === 'playing'; step++) {
        const screen = view(state);
        act(state, { choice: decide({ text: screen.prose.join('\n'), choices: screen.choices }) });
      }
      expect(state.result).toBe('loss');
      expect(state.remaining).toBe(0);
      expectReplay(state);
    });
});
