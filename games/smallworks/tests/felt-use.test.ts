import { describe, expect, it } from 'vitest';
import { createGame } from '../src/game/engine';
import { feltUse, runUseTest } from '../src/game/model';

describe('felt use checks (engine 5)', () => {
  it('never prints a percentage or rpm for trying an object', () => {
    const state = createGame(416);
    for (const job of state.jobs)
      for (const condition of ['bench', 'movement', 'load'] as const) {
        const text = feltUse(job.model, condition, runUseTest(job.model, condition));
        expect(text).not.toMatch(/%|rpm|\d/);
      }
  });
});
