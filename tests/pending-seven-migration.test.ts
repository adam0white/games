import { expect, it } from 'vitest';
import { restoreGame, serializeGame, transition } from '../src/game/engine';
import * as seven from '../src/game/engine7';
import type { GameInput } from '../src/game/types';
import fixture from './fixtures/published-seven-route.json';

it('a publicly generated seven pending wait continues through migration without reversing actor time', () => {
  let s = seven.createGame(fixture.seed);
  for (const input of fixture.inputs) {
    s = seven.transition(s, input as GameInput);
    if (input.type === 'action' && input.id === 'supervised-intake') break;
  }
  let found = 0;
  for (let i = 0; i < 40 && s.apprentice?.jobId; i++) {
    const quiet = seven
      .getView(s)
      .actions.find((a) => a.kind === 'quiet' && a.id !== 'rest' && a.id !== 'tea');
    s = seven.transition(s, { type: 'action', id: quiet?.id ?? 'watch-sam' });
    if (s.apprentice?.pending?.step === 'wait-check') {
      const item = s.objects.find((o) => o.id === s.apprentice?.jobId);
      expect(s.apprentice.pending.endsAt).toBeLessThan((item?.checkStarted ?? 0) + 20);
      found++;
      const before = s.people.sam?.now ?? s.now;
      let current = restoreGame(seven.serializeGame(s));
      for (let j = 0; j < 5 && current.apprentice?.jobId; j++) {
        current = transition(current, { type: 'action', id: 'watch-sam' });
        expect(current.people.sam?.now).toBeGreaterThanOrEqual(before);
        expect(current.people.sam?.now).toBe(current.now);
      }
      expect(restoreGame(serializeGame(current))).toEqual(current);
    }
  }
  expect(found).toBeGreaterThan(0);
});
