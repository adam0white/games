import { describe, expect, it } from 'vitest';
import { act, createGame, hashState, view } from '../src/game';
import { coldPolicy } from './support/cold-policy';
import { expectReplay } from './support/replay';

// One case per seed: each full HF 4 run and its replay stay inside the default per-test budget.
for (const approach of ['ask-first', 'repair-refusal'] as const) {
  describe(`the screen-only ${approach} policy wins and replays across 32 seeds`, () => {
    for (let seed = 0; seed < 32; seed++)
      it(`seed ${seed}`, () => {
        const state = createGame(seed);
        const decide = coldPolicy(approach);
        for (let step = 0; step < 80 && state.result === 'playing'; step++) {
          const screen = view(state);
          const choice = decide({
            text: [
              `${state.remaining} minutes before Osman leaves`,
              screen.title,
              ...screen.prose,
              screen.speech ?? '',
            ].join('\n'),
            choices: screen.choices,
          });
          act(state, { choice });
        }
        expect(state.result, `seed ${seed}`).toBe('win');
        const replay = expectReplay(state);
        expect(hashState(replay)).toBe(hashState(state));
      });
  });
}
