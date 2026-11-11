import { expect, it } from 'vitest';
import { handoverHands } from '../src/ui/first-party.ts';

it('a save without the hand-over record does not describe the current kitchen as inherited', () => {
  expect(handoverHands(undefined)).toBe('An experienced helper ran the service until you took over.');
  expect(
    handoverHands('An experienced helper ran the service until now. You are not cooking anything.'),
  ).toBe('An experienced helper ran the service until now. You are not cooking anything.');
});
